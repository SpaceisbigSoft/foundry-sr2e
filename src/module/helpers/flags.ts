/**
 * v0.75.0: flag writes that work on unlinked tokens too.
 *
 * An unlinked token's actor (a "synthetic" actor) keeps its changes in the token's ActorDelta. Checked live on
 * Foundry v14.369 (23 Oct 2026):
 * - `unsetFlag` (a `-=` key) is deleted on the server, but every open client keeps the old value until it reloads,
 *   so a cleared flag still reads as set for the rest of the session (the v0.73.0 "broken never clears" bug).
 * - `-=` and `==` on a key the token inherits from its base actor do nothing: a delta can't remove what the base has.
 * - Writing `null` works everywhere, at once and after a reload.
 *
 * So on synthetic actors (and items or effects inside them) a cleared flag or dropped map key is written as `null`;
 * on everything else the key is deleted for real (no null left behind). Readers treat `null` as "not set".
 */
import { SYSTEM } from '../config/system.ts';

const NS = SYSTEM.id;

/** An unlinked token's actor, or an item or effect inside one (their changes live in the token's ActorDelta). */
export function isSynthetic(doc: any): boolean {
  // The document itself, or the actor it sits in (an item, or an effect on an item); `isToken` is Actor's own getter.
  for (let d = doc, i = 0; d && i < 3; d = d.parent, i++) {
    if (d.isToken === true) return true;
    if (d.documentName === 'Actor' || d.documentName === 'Scene' || d.documentName === 'ChatMessage') return false;
  }
  return false;
}

/** The update entries that clear these flags on `doc` (merge them into a larger update). */
export function clearFlagUpdate(doc: any, ...keys: string[]): Record<string, null> {
  const syn = isSynthetic(doc);
  const out: Record<string, null> = {};
  for (const k of keys) out[syn ? `flags.${NS}.${k}` : `flags.${NS}.-=${k}`] = null;
  return out;
}

/** Clear a flag (`unsetFlag` that also works on unlinked tokens). Does nothing when it isn't set. */
export async function clearFlag(doc: any, key: string, options: Record<string, unknown> = {}): Promise<void> {
  if (!doc) return;
  const now = typeof doc.getFlag === 'function' ? doc.getFlag(NS, key) : doc.flags?.[NS]?.[key];
  if (now == null) return;
  const withOptions = Object.keys(options).length > 0;
  if (!isSynthetic(doc) && typeof doc.unsetFlag === 'function') {
    if (withOptions) await doc.update(clearFlagUpdate(doc, key), options);
    else await doc.unsetFlag(NS, key);
    return;
  }
  // A synthetic actor, or a document without unsetFlag (a stub): written as null.
  if (!withOptions && typeof doc.setFlag === 'function') await doc.setFlag(NS, key, null);
  else await doc.update?.({ [`flags.${NS}.${key}`]: null }, options);
}

/** The update entries that drop these keys from the map-shaped flag `flag` (merge them into a larger update). */
export function dropFlagKeysUpdate(doc: any, flag: string, ids: Iterable<string>): Record<string, null> {
  const syn = isSynthetic(doc);
  const out: Record<string, null> = {};
  for (const id of ids) out[syn ? `flags.${NS}.${flag}.${id}` : `flags.${NS}.${flag}.-=${id}`] = null;
  return out;
}

/** Drop keys from a map-shaped flag (e.g. projects or requests by id). */
export async function dropFlagKeys(doc: any, flag: string, ids: Iterable<string>, options: Record<string, unknown> = {}): Promise<void> {
  const up = dropFlagKeysUpdate(doc, flag, ids);
  if (doc && Object.keys(up).length) await doc.update(up, options);
}

/**
 * The update that makes the object flag `flag` exactly `next`: its keys set, and the keys it had before that
 * `next` leaves out dropped (setFlag merges, so they would stay). Nested objects in `next` are written whole.
 */
export function replaceFlagUpdate(doc: any, flag: string, next: Record<string, unknown>): Record<string, unknown> {
  const prev = doc?.getFlag?.(NS, flag);
  const syn = isSynthetic(doc);
  const out: Record<string, unknown> = {};
  const isObj = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (prev != null && !isObj(prev)) {
    // Not an object before (a value or an old list): the whole flag is replaced, in one key (a null followed by
    // keys under it would make Foundry's expandObject walk into the null). An object over a value replaces it.
    out[syn ? `flags.${NS}.${flag}` : `flags.${NS}.==${flag}`] = { ...next };
    return out;
  }
  const had = isObj(prev) ? (prev as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(next)) {
    // Nested objects whole, so their old keys go too (null-filled on a synthetic actor, where `==` can't drop inherited keys).
    if (isObj(v) && isObj(had[k])) {
      if (syn) for (const [kk, vv] of Object.entries(replaceNested(had[k] as Record<string, unknown>, v as Record<string, unknown>))) out[`flags.${NS}.${flag}.${k}.${kk}`] = vv;
      else out[`flags.${NS}.${flag}.==${k}`] = v;
    } else out[`flags.${NS}.${flag}.${k}`] = v;
  }
  for (const k of Object.keys(had)) if (!(k in next) && had[k] !== null) out[syn ? `flags.${NS}.${flag}.${k}` : `flags.${NS}.${flag}.-=${k}`] = null;
  return out;
}

/** One level of a nested replacement on a synthetic actor: new keys set, dropped keys null. */
function replaceNested(had: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...next };
  for (const k of Object.keys(had)) if (!(k in next) && had[k] !== null) out[k] = null;
  return out;
}

/** Write an object flag as exactly `next` (unlike setFlag, keys left out are dropped). */
export async function replaceFlag(doc: any, flag: string, next: Record<string, unknown>, options: Record<string, unknown> = {}): Promise<void> {
  if (!doc) return;
  await doc.update(replaceFlagUpdate(doc, flag, next), options);
}

/**
 * v0.75.0: an undo's inverse update made safe for a synthetic actor: `-=` keys under `flags` become null writes
 * (system fields keep `-=`: their schema has every field, so they never need it on a delta).
 */
export function deltaSafeUpdate(doc: any, update: Record<string, unknown>): Record<string, unknown> {
  if (!isSynthetic(doc)) return update;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(update)) {
    const segs = k.split('.');
    const last = segs[segs.length - 1] ?? '';
    if (segs[0] === 'flags' && last.startsWith('-=')) {
      if (segs.length === 2) {
        // A whole namespace added by the change (the actor had no flags of it before): null each key it holds now,
        // never the namespace itself (a null namespace in the delta would hide every later base flag of it).
        const ns = last.slice(2);
        for (const key of Object.keys(doc?.flags?.[ns] ?? {})) out[`flags.${ns}.${key}`] = null;
      } else out[[...segs.slice(0, -1), last.slice(2)].join('.')] = null;
    } else out[k] = v;
  }
  return out;
}
