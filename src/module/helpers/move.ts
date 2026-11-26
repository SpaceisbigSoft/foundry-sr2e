/**
 * v0.93.1: moving a world from the old system id `sr2e` to `shadowrun2e_unified`.
 *
 * The id changed because another Shadowrun 2e system (futurekill's) uses `sr2e` too. A world made with SR2e up to v0.93.0
 * names `sr2e` as its system; once the GM points it at the new id (the move guide, docs/MOVING.md), its data still sits
 * under the old name: flags under `flags.sr2e`, settings named `sr2e.<key>`, and paths such as `systems/sr2e/tokens/...` and
 * `Compendium.sr2e.…` in token art, backdrops, chat cards and links. The move copies all of it to the new name, once.
 *
 * Nothing is deleted: the old flags and settings stay where they are (harmless under the new id), so the move can run again
 * safely, and a world pointed back at the old id still opens with v0.93.0.
 */

/** The id SR2e had up to v0.93.0. */
export const OLD_ID = 'sr2e';

/** The world setting the old id stored its update version under. */
export const OLD_MARKER = `${OLD_ID}.migrationVersion`;

/** The setting the move writes when it is done (under the new id). */
export const MOVE_DONE_KEY = 'movedFromSr2e';

/** Pure: the text with the old id's file paths and compendium ids changed to the new id's. */
export function movePathsIn(text: string, newId: string): string {
  if (!text || !text.includes(OLD_ID)) return text;
  return text
    .replaceAll(`systems/${OLD_ID}/`, `systems/${newId}/`)
    .replaceAll(`Compendium.${OLD_ID}.`, `Compendium.${newId}.`)
    // A sheet chosen for a document or a type (`flags.core.sheetClass`, the `core.sheetClasses` setting): `sr2e.SR2…Sheet`.
    .replace(new RegExp(`(^|["'])${OLD_ID}\\.(SR2\\w*Sheet)\\b`, 'g'), `$1${newId}.$2`);
}

/** Pure: a copy of any value with every string's paths moved (objects and arrays walked; the rest kept). */
export function movePathsDeep<T>(value: T, newId: string): T {
  if (typeof value === 'string') return movePathsIn(value, newId) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => movePathsDeep(v, newId)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = movePathsDeep(v, newId);
    return out as T;
  }
  return value;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Pure: `base` with `top` laid over it, key by key (objects merged, everything else from `top`). */
export function mergeUnder(base: Record<string, unknown>, top: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(top)) out[k] = isPlain(v) && isPlain(out[k]) ? mergeUnder(out[k] as Record<string, unknown>, v) : v;
  return out;
}

/**
 * Pure: the update one document needs (its own fields only; `skip` = its embedded collections' field names, moved on their
 * own): the old flags copied to the new id (when the new id has none yet), and each field holding an old path, rewritten.
 * Objects are walked down to their fields; an array is one value. Null when nothing changes.
 */
export function moveUpdate(source: Record<string, any> | null | undefined, newId: string, skip: readonly string[] = []): Record<string, unknown> | null {
  if (!source || typeof source !== 'object') return null;
  const up: Record<string, unknown> = {};
  // Review 2: merged key by key under what the new id already holds (it wins), so a flag written before the move (an
  // approval request, a combatant's wound) doesn't keep the rest from coming across.
  const old = source.flags?.[OLD_ID];
  // v0.93.2: an empty old flags object has nothing to bring across (it was counted as a changed document).
  if (old && typeof old === 'object' && !Array.isArray(old) && Object.keys(old).length) {
    const cur = source.flags?.[newId];
    const merged = mergeUnder(movePathsDeep(old, newId), cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : {});
    if (!sameJson(merged, cur ?? undefined)) up[`flags.${newId}`] = merged;
  }
  const walk = (obj: Record<string, any>, path: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const p = path ? `${path}.${k}` : k;
      if (!path && (skip.includes(k) || k === '_id' || k === '_stats')) continue;
      if (p === `flags.${OLD_ID}` || p === `flags.${newId}`) continue;
      if (v && typeof v === 'object' && !Array.isArray(v)) { walk(v, p); continue; }
      const moved = movePathsDeep(v, newId);
      if (!sameJson(moved, v)) up[p] = moved;
    }
  };
  walk(source, '');
  return Object.keys(up).length ? up : null;
}

/** A stored world setting, as Foundry keeps it (`value` is JSON text). */
export interface StoredSetting { key: string; value: unknown; user?: string | null }

/**
 * Pure: the settings to write under the new id: each old `sr2e.<key>` setting this system registers (`registered`), with its
 * paths moved. Futurekill's marker (`sr2e.systemMigrationVersion`) and keys this system doesn't have are left out.
 */
export function settingsToMove(stored: readonly StoredSetting[], registered: (key: string) => boolean, newId: string): StoredSetting[] {
  const out: StoredSetting[] = [];
  for (const s of stored ?? []) {
    const key = String(s?.key ?? '');
    if (!key.startsWith(`${OLD_ID}.`)) continue;
    const name = key.slice(OLD_ID.length + 1);
    if (name === 'systemMigrationVersion' || !registered(name)) continue;
    const value = typeof s.value === 'string' ? movePathsIn(s.value, newId) : movePathsDeep(s.value, newId);
    out.push({ key: `${newId}.${name}`, value, user: s.user ?? null });
  }
  return out;
}

/**
 * Pure: whether a world still needs the move: it is running under a new id, it holds the old id's marker setting, and the
 * move hasn't finished in it.
 */
export function needsMove(settings: readonly StoredSetting[] | null | undefined, newId: string): boolean {
  if (newId === OLD_ID) return false;
  const keys = (settings ?? []).map((s) => String(s?.key ?? ''));
  return hasOldSettings(keys) && !keys.includes(`${newId}.${MOVE_DONE_KEY}`);
}

/**
 * Pure: whether a world holds settings of the old id (review 8: any of them, not only the update marker, which a world
 * whose first update failed never got). The other system's own marker doesn't count (the foreign-world guard runs first).
 */
export function hasOldSettings(keys: readonly string[]): boolean {
  return keys.some((k) => k.startsWith(`${OLD_ID}.`) && k !== `${OLD_ID}.systemMigrationVersion`);
}

/**
 * Pure: Foundry's hotkey setting (`core.keybindings`, JSON keyed `<namespace>.<action>`) with this system's customised keys
 * copied from the old id (when the new id has none); null when nothing changes.
 */
export function keybindingsMoved(json: string | null | undefined, newId: string): string | null {
  if (!json) return null;
  let data: any;
  try { data = JSON.parse(json); } catch { return null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  let changed = false;
  for (const k of Object.keys(data)) {
    if (!k.startsWith(`${OLD_ID}.`)) continue;
    const to = `${newId}.${k.slice(OLD_ID.length + 1)}`;
    if (data[to] === undefined) { data[to] = data[k]; changed = true; }
  }
  return changed ? JSON.stringify(data) : null;
}

/** Pure: the browser-stored (client) settings to copy: old `sr2e.<key>` entries for registered client keys the new id lacks. */
export function clientKeysToMove(storageKeys: readonly string[], clientKeys: readonly string[], newId: string): Array<{ from: string; to: string }> {
  const have = new Set(storageKeys);
  return clientKeys
    .filter((k) => have.has(`${OLD_ID}.${k}`) && !have.has(`${newId}.${k}`))
    .map((k) => ({ from: `${OLD_ID}.${k}`, to: `${newId}.${k}` }));
}

// ---------------------------------------------------------------- glue (Foundry)

/**
 * The options every move write carries: not logged for undo (review 1: a Ctrl+Z after the move would put old paths back),
 * not noted in the advancement log, and marked so hooks can leave it alone.
 */
const MOVE_OPTS = { sr2eMove: true, sr2eUndoing: true, sr2eNoAdvance: true } as const;

/** The world collections the move walks (each document, then its embedded ones). */
const WORLD_COLLECTIONS = ['actors', 'items', 'scenes', 'journal', 'macros', 'messages', 'combats', 'users', 'playlists', 'tables', 'cards', 'folders'] as const;

/** The embedded collections a document type holds (name and the field in its data), from Foundry's metadata. */
function embeddedOf(doc: any): Array<{ name: string; field: string }> {
  const meta: Record<string, string> = doc?.constructor?.metadata?.embedded ?? {};
  return Object.entries(meta).map(([name, field]) => ({ name, field: String(field) }));
}

/**
 * Move one parent's embedded documents of one kind (in batches), then theirs. Returns how many changed. An unlinked token's
 * actor (its delta) is moved through the token's own actor, as the migrations do: only what the delta holds.
 */
async function moveEmbedded(parent: any, name: string, field: string, newId: string): Promise<number> {
  // Review 5: a token's delta is moved once, by moveTokenDelta (only what the delta itself holds).
  if (name === 'ActorDelta') return 0;
  const coll: any = parent?.getEmbeddedCollection?.(name);
  if (!coll || typeof coll[Symbol.iterator] !== 'function') return 0;
  let n = 0;
  const ups: any[] = [];
  for (const child of coll) {
    const up = moveUpdate(child?._source, newId, embeddedOf(child).map((e) => e.field));
    if (up) ups.push({ _id: child.id, ...up });
  }
  for (let i = 0; i < ups.length; i += 100) { await parent.updateEmbeddedDocuments(name, ups.slice(i, i + 100), { diff: false, render: false, ...MOVE_OPTS }); n += ups.slice(i, i + 100).length; }
  for (const child of coll) {
    for (const e of embeddedOf(child)) n += await moveEmbedded(child, e.name, e.field, newId);
    if (name === 'Token') n += await moveTokenDelta(child, newId);
  }
  void field;
  return n;
}

/** An unlinked token's own data (its delta: flags, image, its own items). */
async function moveTokenDelta(token: any, newId: string): Promise<number> {
  if (token?.actorLink) return 0;
  const delta: any = token?.delta;
  const actor: any = token?.actor;
  if (!delta || !actor) return 0;
  let n = 0;
  const own = moveUpdate(delta._source, newId, ['items', 'effects', 'system']);
  if (own) { await actor.update(own, { diff: false, render: false, ...MOVE_OPTS }); n++; }
  for (const kind of ['Item', 'ActiveEffect'] as const) {
    const field = kind === 'Item' ? 'items' : 'effects';
    const ups = (delta._source?.[field] ?? []).map((src: any) => { const up = moveUpdate(src, newId, kind === 'Item' ? ['effects'] : []); return up ? { _id: src._id, ...up } : null; }).filter(Boolean);
    if (ups.length) { await actor.updateEmbeddedDocuments(kind, ups, { diff: false, render: false, ...MOVE_OPTS }); n += ups.length; }
  }
  return n;
}

/** Move every world document (and its embedded ones). Returns the count of documents changed, by collection. */
export async function moveWorldDocuments(newId: string): Promise<Record<string, number>> {
  const g: any = (globalThis as any).game;
  const counts: Record<string, number> = {};
  for (const key of WORLD_COLLECTIONS) {
    const coll: any = g?.[key];
    if (!coll?.contents) continue;
    let n = 0;
    const docs: any[] = [...coll.contents];
    const ups: any[] = [];
    for (const doc of docs) {
      const up = moveUpdate(doc?._source, newId, embeddedOf(doc).map((e) => e.field));
      if (up) ups.push({ _id: doc.id, ...up });
    }
    const cls: any = coll.documentClass;
    for (let i = 0; i < ups.length; i += 100) { await cls.updateDocuments(ups.slice(i, i + 100), { diff: false, render: false, ...MOVE_OPTS }); n += ups.slice(i, i + 100).length; }
    for (const doc of docs) for (const e of embeddedOf(doc)) n += await moveEmbedded(doc, e.name, e.field, newId);
    if (n) counts[key] = n;
  }
  // The world's own compendiums (the GM's exported templates and the like); a locked one is unlocked for the move and locked again.
  for (const pack of [...(g?.packs ?? [])] as any[]) {
    if (pack?.metadata?.packageType !== 'world') continue;
    let n = 0;
    const wasLocked = Boolean(pack.locked);
    try {
      if (wasLocked) await pack.configure({ locked: false });
      const docs: any[] = await pack.getDocuments();
      const ups = docs.map((doc) => { const up = moveUpdate(doc?._source, newId, embeddedOf(doc).map((e) => e.field)); return up ? { _id: doc.id, ...up } : null; }).filter(Boolean) as any[];
      const cls: any = pack.documentClass;
      for (let i = 0; i < ups.length; i += 100) { await cls.updateDocuments(ups.slice(i, i + 100), { pack: pack.collection, diff: false, render: false, ...MOVE_OPTS }); n += ups.slice(i, i + 100).length; }
      for (const doc of docs) for (const e of embeddedOf(doc)) n += await moveEmbedded(doc, e.name, e.field, newId);
    } finally {
      if (wasLocked) { try { await pack.configure({ locked: true }); } catch { /* left unlocked */ } }
    }
    if (n) counts[`pack ${pack.collection}`] = n;
  }
  return counts;
}

/**
 * Pure: whether a moved setting may be written over the one the new id already has: only when that one is still the default
 * (written in the seconds before the move, by a ready hook) or can't be read. A value someone changed (after an earlier,
 * interrupted move) is kept.
 */
export function mayOverwrite(currentJson: unknown, defaultValue: unknown): boolean {
  if (typeof currentJson !== 'string') return true;
  try { return JSON.stringify(JSON.parse(currentJson)) === JSON.stringify(defaultValue ?? null); } catch { return true; }
}

/** Write the moved world settings (a default the new id wrote before the move is replaced; a changed one is kept). */
export async function moveWorldSettings(newId: string, registered: (key: string) => boolean): Promise<number> {
  const g: any = (globalThis as any).game;
  const Setting: any = (globalThis as any).getDocumentClass?.('Setting') ?? (globalThis as any).Setting;
  const storage: any = g?.settings?.storage?.get?.('world');
  const stored: StoredSetting[] = ((g?.data?.settings ?? []) as any[]).map((s) => ({ key: s.key, value: s.value, user: s.user ?? null }));
  const todo = settingsToMove(stored, registered, newId);
  // The default sheet per type (Foundry's own setting) names the sheets by the old id.
  const sheets = stored.find((x) => x.key === 'core.sheetClasses' && !x.user);
  if (sheets && typeof sheets.value === 'string' && movePathsIn(sheets.value, newId) !== sheets.value) todo.push({ key: 'core.sheetClasses', value: movePathsIn(sheets.value, newId), user: null });
  let n = 0;
  for (const s of todo) {
    const have: any = storage?.find?.((x: any) => x.key === s.key && (x.user ?? null) === (s.user ?? null));
    if (have) {
      const def = s.key === 'core.sheetClasses' ? {} : g?.settings?.settings?.get?.(s.key)?.default;
      if (!mayOverwrite(have._source?.value ?? have.value, def)) continue;
      await have.update({ value: s.value }, { ...MOVE_OPTS });
    } else await Setting.create({ key: s.key, value: s.value, ...(s.user ? { user: s.user } : {}) }, { ...MOVE_OPTS });
    n++;
  }
  return n;
}

/** Copy this browser's client settings from the old id (each client, at init, only in a world that came from the old id). */
export function moveClientSettings(newId: string, clientKeys: readonly string[]): number {
  try {
    const g: any = (globalThis as any).game;
    if (!hasOldSettings(((g?.data?.settings ?? []) as any[]).map((s) => String(s?.key ?? '')))) return 0;
    const ls: Storage | undefined = (globalThis as any).localStorage;
    if (!ls) return 0;
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k) keys.push(k); }
    const todo = clientKeysToMove(keys, clientKeys, newId);
    for (const { from, to } of todo) { const v = ls.getItem(from); if (v !== null) ls.setItem(to, movePathsIn(v, newId)); }
    // The player's own hotkeys for this system (Configure Controls) come across too.
    const keys2 = keybindingsMoved(ls.getItem('core.keybindings'), newId);
    if (keys2) ls.setItem('core.keybindings', keys2);
    return todo.length + (keys2 ? 1 : 0);
  } catch { return 0; }
}
