/**
 * v0.81.0: the trusted-card rule (security review SEC1), the pure part. The Foundry side is
 * `applications/trust.ts`.
 *
 * What can be trusted (checked live on Foundry v14.369):
 * - `message.author` (the server sets it; a player can't post as the GM) and the socket listener's second argument
 *   (`senderId`, the server-set sender).
 * - NOT message flags, message content, `data-*` attributes on buttons, socket data, or anything on a document a
 *   player owns. Foundry's content cleaner keeps `data-*` and inline `style`, so a forged message can lay an
 *   invisible full-screen system button under the GM's cursor: "it needs a GM click" means "it needs nothing".
 *
 * So a GM-side change made because of a card must be bound to the card's author: the author is a GM, or owns the
 * actor the change comes from (the roller, the healer, the holder), and the values are bounded here.
 */
import { describeBundle } from './arcanum.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';
import { RULES } from './config.ts';
import { EFFECT_NUMBER_KEYS } from './effects.ts';

/** Path segments that reach an object's prototype: never walked or set from data. */
export const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'prototype', 'constructor']);

/** A key that is safe to read or set on a plain object. */
export function safeKey(k: unknown): boolean {
  return typeof k === 'string' && !UNSAFE_KEYS.has(k);
}

/** A dotted path none of whose segments reach a prototype. */
export function safePath(path: unknown): boolean {
  return typeof path === 'string' && path.length > 0 && path.split('.').every((k) => k.length > 0 && safeKey(k));
}

/** An object with no prototype-reaching key at any depth (arrays included). Depth-capped at 32. */
export function deepSafeKeys(v: unknown, depth = 0): boolean {
  if (depth > 32) return false;
  if (Array.isArray(v)) return v.every((x) => deepSafeKeys(x, depth + 1));
  if (v && typeof v === 'object') return Object.keys(v).every((k) => safeKey(k) && deepSafeKeys((v as any)[k], depth + 1));
  return true;
}

/**
 * A whole number from untrusted input (a flag, a button's data, socket data): `fallback` when it isn't a finite
 * number, else truncated and clamped to [min, max].
 */
export function safeInt(v: unknown, min: number, max: number, fallback: number): number {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** A non-empty string under `max` characters (uuids, ids, names from flags). */
export function safeStr(v: unknown, max = 200): v is string {
  return typeof v === 'string' && v.length > 0 && v.length < max;
}

/** A number from untrusted input that is a whole number within [min, max] (no clamping: out of range is refused). */
export function intIn(v: unknown, min: number, max: number): boolean {
  // v0.81.1 (RB2-8): numbers only; '5', ' 0x1e ' and '' are not what the system posts.
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

/** Only these keys on an object (an allow-list: a new key can't ride along). */
export function onlyKeys(obj: unknown, allowed: readonly string[]): boolean {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const ok = new Set(allowed);
  return Object.keys(obj).every((k) => ok.has(k));
}

/** A user as the trust checks see it. */
export interface TrustUser { id?: string; isGM?: boolean }

/** Whether `user` is a GM or has OWNER permission on `doc` (Foundry's own check when the document has one). */
export function userOwns(user: TrustUser | null | undefined, doc: any): boolean {
  if (!user) return false;
  if (user.isGM) return true;
  if (!doc) return false;
  if (typeof doc.testUserPermission === 'function') {
    try { return Boolean(doc.testUserPermission(user, 'OWNER')); } catch { return false; }
  }
  const own = doc.ownership ?? {};
  const lvl = Number(user.id && own[user.id] !== undefined ? own[user.id] : own.default ?? 0);
  return lvl >= 3;
}

/** What a card's author may vouch for: whether the author is a GM, and which documents they own. */
export interface CardTrust { authorIsGm: boolean; owns: (uuid: string) => boolean }

/** The uuid strings in a list (anything else dropped, repeats once). */
export function uuidsOf(list: readonly unknown[]): string[] {
  return [...new Set(list.filter((u): u is string => safeStr(u, 400)))];
}

/** The author is a GM, or owns one of these actors (the change comes "from" one of them). */
export function trustedSource(t: CardTrust, uuids: readonly unknown[]): boolean {
  if (t.authorIsGm) return true;
  return uuidsOf(uuids).some((u) => { try { return t.owns(u); } catch { return false; } });
}

// ---------------------------------------------------------------- Apply (GM) cards

const LEVELS = ['L', 'M', 'S', 'D'];

/** Per Apply (GM) action: its flag, the keys the flag may carry, and the keys naming the actor the change is from. */
export const GM_APPLY_SPECS: Record<string, { flag: string; keys: readonly string[]; target: string; sources: readonly string[] }> = {
  applyTally: { flag: 'tally', keys: ['hostUuid', 'successes', 'key', 'name', 'sourceUuid'], target: 'hostUuid', sources: ['sourceUuid'] },
  applySite: { flag: 'siteChange', keys: ['siteUuid', 'add', 'minAlert', 'deviceId', 'bypassed', 'casingOpen', 'sourceUuid'], target: 'siteUuid', sources: ['sourceUuid'] },
  applyHost: {
    flag: 'hostChange',
    keys: ['hostUuid', 'found', 'decrypt', 'removeFile', 'minAlert', 'smoke', 'spot', 'setAlert', 'resetTally', 'addFile', 'editFile', 'validate', 'invalidate', 'bombFound', 'defuse', 'bombOff', 'call', 'sourceUuid'],
    target: 'hostUuid', sources: ['sourceUuid', 'found.deckerUuid', 'bombFound.deckerUuid'],
  },
  applyLocks: { flag: 'sensorLocks', keys: ['vehicleUuid', 'targetUuid', 'targetName', 'successes', 'sourceUuid'], target: 'vehicleUuid', sources: ['sourceUuid'] },
  applyJam: { flag: 'jam', keys: ['droneUuid', 'by', 'rating', 'jammerUuid', 'sourceUuid'], target: 'droneUuid', sources: ['jammerUuid', 'sourceUuid'] },
  applyDroneLink: { flag: 'droneLink', keys: ['droneUuid', 'kind', 'byUuid', 'by', 'sourceUuid'], target: 'droneUuid', sources: ['byUuid', 'sourceUuid'] },
  applyHold: { flag: 'hold', keys: ['targetUuid', 'holderUuid', 'sourceUuid'], target: 'targetUuid', sources: ['holderUuid', 'sourceUuid'] },
  applyCleanse: { flag: 'cleanse', keys: ['sceneId', 'points', 'align', 'sourceUuid'], target: '', sources: ['sourceUuid'] },
  applyPossession: { flag: 'possession', keys: ['targetUuid', 'by', 'sourceUuid'], target: 'targetUuid', sources: ['by.uuid', 'sourceUuid'] },
  applyPowerEffect: { flag: 'powerEffect', keys: ['targetUuid', 'effect', 'removeId', 'sourceUuid'], target: 'targetUuid', sources: ['effect.casterUuid', 'effect.fromUuid', 'sourceUuid'] },
  applyActorUpdate: { flag: 'actorUpdate', keys: ['uuid', 'by', 'monitor', 'remove', 'nuyen', 'masterDied', 'handSpirit', 'lower', 'dispel', 'sourceUuid'], target: 'uuid', sources: ['by', 'sourceUuid'] },
  applySurgery: { flag: 'surgeryApply', keys: ['surgeonUuid', 'snap', 'sourceUuid'], target: '', sources: ['surgeonUuid', 'sourceUuid'] },
  applyHeal: { flag: 'healApply', keys: ['healerUuid', 'snap', 'testId', 'sourceUuid'], target: '', sources: ['healerUuid', 'sourceUuid'] },
  applyPatch: { flag: 'patchApply', keys: ['targetUuid', 'kind', 'rating', 'name', 'byName', 'sourceUuid'], target: 'targetUuid', sources: ['sourceUuid'] },
  // v0.81.1 (D1-3, D2-5): a mechanic's timed job on someone else's vehicle; a flash's blindness on someone else.
  applyVehicleJob: { flag: 'vehicleJob', keys: ['actorUuid', 'method', 'args', 'jobId', 'sourceUuid'], target: '', sources: ['actorUuid', 'sourceUuid'] },
  applyTimedStatus: { flag: 'timedStatus', keys: ['targetUuid', 'status', 'seconds', 'flashTn', 'sourceUuid'], target: 'targetUuid', sources: ['sourceUuid'] },
};

function at(obj: any, path: string): unknown {
  return path.split('.').reduce((o: any, k) => (o && typeof o === 'object' && safeKey(k) && Object.hasOwn(o, k) ? o[k] : undefined), obj);
}

/**
 * The uuids a card names as where its change comes from: the kind's own keys and the test's roller (plus `extra`).
 * For the GM's confirm and its "the author owns none of them" refusal; v0.81.1 (SEC1-16): callers no longer pass the
 * speaker, which made that refusal never fire for a player who owns any character. Never a reason to apply unseen.
 */
export function cardSourceUuids(action: string, flags: Record<string, any>, extra: readonly unknown[] = []): string[] {
  const spec = GM_APPLY_SPECS[action];
  const f = spec ? flags?.[spec.flag] : null;
  const own = spec && f && typeof f === 'object' ? spec.sources.map((p) => at(f, p)) : [];
  return uuidsOf([...own, flags?.['test']?.actorUuid, ...extra]);
}

/** The document an Apply (GM) card changes (its uuid), or '' when it isn't one actor or item. */
export function cardTargetUuid(action: string, flags: Record<string, any>): string {
  const spec = GM_APPLY_SPECS[action];
  const f = spec ? flags?.[spec.flag] : null;
  const v = spec?.target && f ? at(f, spec.target) : '';
  return safeStr(v, 400) ? v : '';
}

/**
 * Pure: whether an Apply (GM) card's flag has the shape its kind allows (allow-listed keys, bounded numbers). A GM's
 * click on a card that fails this does nothing; the auto-apply needs it too.
 */
export function gmApplyShapeOk(action: string, flags: Record<string, any>): boolean {
  const spec = GM_APPLY_SPECS[action];
  if (!spec) return false;
  const f = flags?.[spec.flag];
  if (!f || typeof f !== 'object' || Array.isArray(f) || !onlyKeys(f, spec.keys) || !deepSafeKeys(f)) return false;
  if (f.sourceUuid !== undefined && !safeStr(f.sourceUuid, 400)) return false;
  switch (action) {
    case 'applyTally': return safeStr(f.hostUuid, 400) && intIn(f.successes, 0, 30) && (f.key === undefined || typeof f.key === 'string') && (f.name === undefined || typeof f.name === 'string');
    case 'applySite': return safeStr(f.siteUuid, 400) && (f.add === undefined || intIn(f.add, -30, 30))
      && (f.minAlert === undefined || (RULES.SECURITY.alerts as readonly string[]).includes(f.minAlert)) && (f.deviceId === undefined || typeof f.deviceId === 'string')
      && (f.bypassed === undefined || typeof f.bypassed === 'boolean') && (f.casingOpen === undefined || typeof f.casingOpen === 'boolean');
    // v0.81.1 (SEC1-7, RA2-2, D3-11): every key of a host change has the shape the system posts (an alert from the
    // list, bounded numbers, the nested objects' own keys), so the confirm shows what really changes.
    case 'applyHost': return safeStr(f.hostUuid, 400) && hostChangeShapeOk(f);
    case 'applyLocks': return safeStr(f.vehicleUuid, 400) && safeStr(f.targetUuid, 400) && intIn(f.successes, 0, 30);
    case 'applyJam': return safeStr(f.droneUuid, 400) && intIn(f.rating, 0, 30) && (f.jammerUuid === undefined || safeStr(f.jammerUuid, 400));
    case 'applyDroneLink': return safeStr(f.droneUuid, 400) && safeStr(f.byUuid, 400) && (f.kind === 'intercept' || f.kind === 'spoof');
    case 'applyHold': return safeStr(f.targetUuid, 400) && safeStr(f.holderUuid, 400);
    case 'applyCleanse': return safeStr(f.sceneId, 100) && intIn(f.points, -20, 20) && (f.align === undefined || (Array.isArray(f.align) && f.align.every((x: unknown) => typeof x === 'string')));
    // v0.81.1 (A-3, SEC1-7, D3-5): the possessor's copied attributes and skills are bounded and shown in the confirm.
    case 'applyPossession': return safeStr(f.targetUuid, 400) && (f.by === null || possessorShapeOk(f.by));
    case 'applyPowerEffect': return safeStr(f.targetUuid, 400) && (f.removeId === undefined || f.removeId === null || typeof f.removeId === 'string')
      && (f.effect === null || f.effect === undefined || powerEffectShapeOk(f.effect));
    case 'applyActorUpdate': {
      // SEC1-1: no free-form `update` (it is not in the allow-list above): monitor boxes, nuyen or a removal only.
      if (!safeStr(f.uuid, 400)) return false;
      if (f.monitor !== undefined && !(onlyKeys(f.monitor, ['track', 'boxes']) && ['physical', 'stun'].includes(f.monitor.track) && intIn(f.monitor.boxes, -20, 20))) return false;
      if (f.nuyen !== undefined && !(onlyKeys(f.nuyen, ['amount', 'label']) && intIn(f.nuyen.amount, -1_000_000, 1_000_000))) return false;
      if (f.remove !== undefined && typeof f.remove !== 'boolean') return false;
      if (f.masterDied !== undefined && typeof f.masterDied !== 'boolean') return false;
      if (f.by !== undefined && !safeStr(f.by, 400)) return false;
      if (f.lower !== undefined && !(onlyKeys(f.lower, ['key', 'from', 'to']) && ['force', 'rating'].includes(f.lower.key) && intIn(f.lower.from, 0, 1000) && intIn(f.lower.to, 0, 1000))) return false;
      if (f.dispel !== undefined && !(onlyKeys(f.dispel, ['spellName', 'force', 'from', 'to']) && typeof f.dispel.spellName === 'string' && intIn(f.dispel.force, 0, 100) && intIn(f.dispel.from, 0, 1000) && intIn(f.dispel.to, 0, 1000))) return false;
      if (f.handSpirit !== undefined && !(onlyKeys(f.handSpirit, ['toUuid', 'services', 'oldSummonerUuid']) && typeof f.handSpirit.toUuid === 'string'
        && typeof f.handSpirit.oldSummonerUuid === 'string' && intIn(f.handSpirit.services, 0, 99))) return false;
      return f.monitor !== undefined || f.nuyen !== undefined || f.remove === true || f.masterDied === true || f.handSpirit !== undefined || f.lower !== undefined || f.dispel !== undefined;
    }
    // v0.81.1 (SEC1-7, RA2-1, D1-2): the operation's own keys, typed and bounded (its money shown in the confirm).
    case 'applySurgery': return safeStr(f.surgeonUuid, 400) && surgerySnapShapeOk(f.snap);
    case 'applyHeal': return safeStr(f.healerUuid, 400) && Boolean(f.snap) && typeof f.snap === 'object';
    case 'applyPatch': return safeStr(f.targetUuid, 400) && intIn(f.rating, 0, 20) && typeof f.kind === 'string';
    // v0.81.1 (D1-3): the documents check the job's arguments again when it is applied (applyVehicleJobAsGm).
    case 'applyVehicleJob': return safeStr(f.actorUuid, 400) && ['finishVehicleRepair', 'finishModInstall'].includes(String(f.method)) && Array.isArray(f.args) && f.args.length <= 6 && deepSafeKeys(f.args) && safeStr(f.jobId, 65);
    // v0.81.1 (D2-5): only blindness, bounded.
    case 'applyTimedStatus': return safeStr(f.targetUuid, 400) && f.status === 'blind' && intIn(f.seconds, 1, 600) && (f.flashTn === undefined || intIn(f.flashTn, 0, 10));
    default: return false;
  }
}

/** An optional string under `max` characters. */
const optStr = (v: unknown, max = 400) => v === undefined || (typeof v === 'string' && v.length < max);
/** A list of at most `n` strings. */
const strList = (v: unknown, n: number) => Array.isArray(v) && v.length <= n && v.every((x) => typeof x === 'string' && x.length < 400);

/**
 * Pure (v0.81.1, SEC1-7 / RA2-2 / D3-11): a host change's keys have the shapes `HostChange` (documents/index.ts)
 * gives them: alerts from RULES.MATRIX.alerts, a smoke cloud's rating and TN bounded, a file's size and value bounded,
 * a comcall's op from its list, and no key outside each nested object's own.
 */
export function hostChangeShapeOk(f: any): boolean {
  const alerts = RULES.MATRIX.alerts as readonly string[];
  if (f.minAlert !== undefined && !alerts.includes(f.minAlert)) return false;
  if (f.setAlert !== undefined && !alerts.includes(f.setAlert)) return false;
  for (const k of ['decrypt', 'removeFile', 'spot', 'validate', 'invalidate']) if (!optStr(f[k])) return false;
  if (f.resetTally !== undefined && typeof f.resetTally !== 'boolean') return false;
  if (f.found !== undefined && !(onlyKeys(f.found, ['deckerUuid', 'ids']) && safeStr(f.found.deckerUuid, 400) && strList(f.found.ids, 200))) return false;
  if (f.smoke !== undefined && !(onlyKeys(f.smoke, ['rating', 'tn', 'by', 'round', 'worldTime', 'combatId']) && intIn(f.smoke.rating, 0, 20) && intIn(f.smoke.tn, 0, 20)
    && optStr(f.smoke.by) && optStr(f.smoke.combatId) && (f.smoke.round === undefined || intIn(f.smoke.round, -1, 100_000))
    && (f.smoke.worldTime === undefined || (typeof f.smoke.worldTime === 'number' && Number.isFinite(f.smoke.worldTime))))) return false;
  if (f.addFile !== undefined && !(onlyKeys(f.addFile, ['name', 'size', 'value', 'paydata', 'uploadedBy', 'foundBy']) && safeStr(f.addFile.name, 200)
    && intIn(f.addFile.size ?? 0, 0, 100_000) && intIn(f.addFile.value ?? 0, 0, 10_000_000) && (f.addFile.paydata === undefined || typeof f.addFile.paydata === 'boolean')
    && optStr(f.addFile.uploadedBy) && (f.addFile.foundBy === undefined || strList(f.addFile.foundBy, 50)))) return false;
  if (f.editFile !== undefined && !(onlyKeys(f.editFile, ['id', 'note']) && safeStr(f.editFile.id, 200) && optStr(f.editFile.note, 1000))) return false;
  if (f.bombFound !== undefined && !(onlyKeys(f.bombFound, ['deckerUuid', 'fileId', 'subsystem']) && safeStr(f.bombFound.deckerUuid, 400) && optStr(f.bombFound.fileId) && optStr(f.bombFound.subsystem))) return false;
  if (f.defuse !== undefined && !(onlyKeys(f.defuse, ['fileId', 'subsystem']) && optStr(f.defuse.fileId) && optStr(f.defuse.subsystem))) return false;
  if (f.bombOff !== undefined && !(onlyKeys(f.bombOff, ['fileId', 'subsystem', 'erase']) && optStr(f.bombOff.fileId) && optStr(f.bombOff.subsystem) && (f.bombOff.erase === undefined || typeof f.bombOff.erase === 'boolean'))) return false;
  if (f.call !== undefined && !(onlyKeys(f.call, ['op', 'id', 'from', 'to', 'by', 'who']) && ['place', 'tap', 'reroute', 'end'].includes(f.call.op)
    && safeStr(f.call.id, 200) && ['from', 'to', 'by', 'who'].every((k) => optStr(f.call[k])))) return false;
  return true;
}

/**
 * Pure (v0.81.1, A-3 / SEC1-7): a possessor as a possession card carries it (`#possess`): its uuid and name, mental
 * attributes (at most 10, each 0–50) and copied skills (at most 200, ratings 0–20).
 */
export function possessorShapeOk(by: any): boolean {
  if (!onlyKeys(by, ['uuid', 'name', 'attributes', 'skills']) || !safeStr(by.uuid, 400) || !optStr(by.name, 200)) return false;
  if (by.attributes !== undefined) {
    if (!by.attributes || typeof by.attributes !== 'object' || Array.isArray(by.attributes)) return false;
    const e = Object.entries(by.attributes);
    if (e.length > 10 || !e.every(([k, v]) => safeStr(k, 40) && typeof v === 'number' && intIn(v, 0, 50))) return false;
  }
  if (by.skills !== undefined) {
    if (!Array.isArray(by.skills) || by.skills.length > 200) return false;
    for (const s of by.skills) {
      if (!s || typeof s !== 'object' || Array.isArray(s) || !safeStr(s.name, 200)) return false;
      for (const [k, v] of Object.entries(s)) {
        if (typeof v === 'number') { if (!intIn(v, 0, 20)) return false; } else if (v !== null && typeof v !== 'string' && typeof v !== 'boolean') return false;
        if (typeof v === 'string' && v.length > 200) return false;
        void k;
      }
    }
  }
  return true;
}

/** The keys of a surgery snapshot's `surgery` (documents/index.ts `TestSnapshot.surgery`). */
const SURGERY_KEYS = ['patientUuid', 'patientName', 'itemId', 'itemName', 'points', 'installed', 'harmed', 'id', 'traumaDone', 'care', 'pay', 'paid', 'paidAmount'];

/**
 * Pure (v0.81.1, SEC1-7 / RA2-1 / D1-2): an Apply (GM) surgery card's snapshot: an operation id, its own keys with
 * their types, Essence or Body Index points 0–10, ¥ already paid 0–10,000,000 and at most 60 successes.
 */
export function surgerySnapShapeOk(snap: any): boolean {
  if (!snap || typeof snap !== 'object' || Array.isArray(snap) || !deepSafeKeys(snap)) return false;
  if (snap.successes !== undefined && !intIn(snap.successes, 0, 60)) return false;
  const sg = snap.surgery;
  if (!onlyKeys(sg, SURGERY_KEYS) || !safeStr(sg.id, 200) || !safeStr(sg.patientUuid, 400) || !safeStr(sg.itemId, 200)) return false;
  if (!optStr(sg.patientName, 200) || !optStr(sg.itemName, 200) || !optStr(sg.care, 60)) return false;
  if (!(typeof sg.points === 'number' && Number.isFinite(sg.points) && sg.points >= 0 && sg.points <= 10)) return false;
  for (const k of ['installed', 'harmed', 'traumaDone', 'pay', 'paid']) if (sg[k] !== undefined && typeof sg[k] !== 'boolean') return false;
  return sg.paidAmount === undefined || (typeof sg.paidAmount === 'number' && intIn(sg.paidAmount, 0, 10_000_000));
}

/** The keys a power or spell effect entry (documents/index.ts `FxEntry`, built by `SR2Actor.fxEntry`) carries. */
const FX_KEYS = ['id', 'fromUuid', 'fromName', 'name', 'attributes', 'kind', 'special', 'permanent', 'status', 'holdTurns', 'breakTn', 'successes', 'spec', 'until',
  'effectId', 'casterUuid', 'casterName', 'targetUuids', 'movementFactor', ...EFFECT_NUMBER_KEYS];

/**
 * The highest movement factor an effect may carry. v0.81.1 (RB2-4): a Movement power's factor is the being's Force,
 * and Force goes past 10 (great forms, high-Force elementals), so the old bound of 10 refused real cards.
 */
const MAX_MOVEMENT_FACTOR = 60;

/**
 * Pure (R2-SEC-11): whether a power effect on an Apply (GM) card has the shape `fxEntry` builds: its listed keys,
 * attribute and TN changes within ±30, a movement factor between 0 and 60, and a hold of at most 100 Combat Turns.
 * v0.81.1 (RB2-3): its `spec` (what a partial dispel rebuilds the entry from) holds only numbers, within ±30, and
 * what it can grow to with the entry's successes stays within ±30 too.
 */
export function powerEffectShapeOk(e: unknown): boolean {
  if (!e || typeof e !== 'object' || Array.isArray(e) || !onlyKeys(e, FX_KEYS) || !deepSafeKeys(e)) return false;
  const x: any = e;
  const inRange = (v: unknown, lo: number, hi: number) => v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi);
  if (!safeStr(x.name, 200)) return false;
  if (x.attributes !== undefined) {
    if (!x.attributes || typeof x.attributes !== 'object' || Array.isArray(x.attributes)) return false;
    const attrs = Object.entries(x.attributes);
    if (attrs.length > 20 || !attrs.every(([k, v]) => safeStr(k, 40) && inRange(v, -30, 30))) return false;
  }
  if (!EFFECT_NUMBER_KEYS.every((k) => inRange(x[k], -30, 30))) return false;
  if (!inRange(x.movementFactor, 0, MAX_MOVEMENT_FACTOR) || !inRange(x.holdTurns, 0, 100) || !inRange(x.breakTn, 0, 30) || !inRange(x.successes, 0, 60)) return false;
  for (const k of ['id', 'fromUuid', 'fromName', 'kind', 'special', 'status', 'effectId', 'casterUuid', 'casterName']) if (x[k] !== undefined && x[k] !== null && typeof x[k] !== 'string') return false;
  if (x.permanent !== undefined && typeof x.permanent !== 'boolean') return false;
  if (x.targetUuids !== undefined && !(Array.isArray(x.targetUuids) && x.targetUuids.length <= 50 && x.targetUuids.every((u: unknown) => typeof u === 'string'))) return false;
  if (x.spec !== undefined && x.spec !== null) {
    // The spec rebuilds the entry on a partial dispel: its numbers are bounded the same way.
    const sp = x.spec;
    if (typeof sp !== 'object' || Array.isArray(sp)) return false;
    // RB2-3: numbers only (a numeric string such as '30' was let through, and scaleBundle reads it as 30).
    const nums = (o: unknown) => o === undefined || o === null || (typeof o === 'object' && !Array.isArray(o) && Object.values(o).every((v) => v === undefined || (typeof v === 'number' && inRange(v, -30, 30))));
    if (sp.bundle !== undefined && sp.bundle !== null && (typeof sp.bundle !== 'object' || Array.isArray(sp.bundle))) return false;
    if (!nums(sp.attributes) || !nums(sp.bundle ? { ...sp.bundle, attributes: undefined, movementFactor: undefined } : null) || !nums(sp.bundle?.attributes)) return false;
    if (!inRange(sp.bundle?.movementFactor, 0, MAX_MOVEMENT_FACTOR) || !['force', 'capAt', 'step', 'essence', 'minutes'].every((k) => inRange(sp[k], 0, 60))) return false;
    if (sp.perSuccess !== undefined && typeof sp.perSuccess !== 'boolean') return false;
    if (Math.abs(specGrowth(sp, x.successes)) > 30) return false;
  }
  return true;
}

/**
 * Pure (v0.81.1, RB2-3): the largest attribute or TN change a power effect's `spec` gives at `successes` (as
 * `scaleBundle` scales it: per `step` successes when `perSuccess`, capped at `capAt` when that is above 0).
 */
export function specGrowth(sp: any, successes: unknown): number {
  if (!sp || typeof sp !== 'object') return 0;
  const vals = [...Object.values(sp.attributes ?? {}), ...Object.values(sp.bundle?.attributes ?? {}), ...EFFECT_NUMBER_KEYS.map((k) => sp.bundle?.[k])]
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const most = vals.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  if (!sp.perSuccess) return most;
  const step = Math.max(1, Math.floor(Number(sp.step) || 1));
  const n = Math.max(0, Math.floor(Number(successes) || 0));
  const grown = most * Math.max(1, Math.floor(n / step));
  return Number(sp.capAt) > 0 ? Math.min(grown, Number(sp.capAt)) : grown;
}


/**
 * Pure (SEC1-4): whether an Apply (GM) card may be applied by the active GM's client without anyone looking.
 * - The flag passes `gmApplyShapeOk` (per-kind allow-list, bounds).
 * - The author is bound to it: a GM, or the owner of an actor the kind's own source keys name (`GM_APPLY_SPECS`
 *   `sources`). v0.81.1 (SEC1-6, A-4, RB2-2, design 3): never the speaker or the test's roller, which the author
 *   chooses freely, and never a source the card names outside its kind's keys.
 * - Never by itself (v0.81.1 round 2, FIX2-BRIEF B): a security tally, a site change, a host change (alerts,
 *   passcodes, files), cleansing and background counts, jams and holds on documents the author doesn't own, drone-link
 *   takeovers and intercepts, sensor locks for a vehicle the author doesn't own, damage or healing on an actor the
 *   author doesn't own, nuyen, removals, and surgery, healing, possession, power effects, patches, vehicle jobs and
 *   timed statuses (those always wait for the GM's click). What is left: a jam or hold on what the author owns, a
 *   sensor lock for the author's own vehicle, and a monitor change on the author's own actor.
 * - In practice (R2-SEC-13) holds, jams and monitor changes always wait: the system posts those cards only when the
 *   author's own client couldn't make the change, so the author never owns the target.
 */
export function safeAutoApply(action: string, flags: Record<string, any>, trust: CardTrust): boolean {
  if (!gmApplyShapeOk(action, flags)) return false;
  const spec = GM_APPLY_SPECS[action]!;
  const f = flags[spec.flag];
  const owns = (u: unknown) => safeStr(u, 400) && (() => { try { return trust.authorIsGm || trust.owns(u); } catch { return false; } })();
  const sourced = trustedSource(trust, spec.sources.map((p) => at(f, p)));
  switch (action) {
    // v0.81.1 round 2 (FIX2-BRIEF B, V-SEC 4): a tally, a site change and a host change never apply by themselves,
    // whatever source the card names: a tally walks the sheaf (alerts, IC), a site's tally raises its alert, a host
    // change raises alerts or hands out passcodes, and the source is the author's own claim. The GM clicks them.
    case 'applyTally': case 'applySite': case 'applyHost': return false;
    case 'applyLocks': return sourced && owns(f.vehicleUuid);
    // Jams and holds only on what the author owns (anything else waits for the GM's click).
    case 'applyJam': return owns(f.droneUuid);
    // RB2-2: an intercept or a takeover is always of someone else's drone: the GM looks at it.
    case 'applyDroneLink': return false;
    case 'applyHold': return owns(f.targetUuid) && owns(f.holderUuid);
    // Design 3: a lowering (background count cleansed) never applies by itself.
    case 'applyCleanse': return false;
    case 'applyActorUpdate': {
      if (f.nuyen !== undefined || f.remove !== undefined || f.masterDied !== undefined || f.handSpirit !== undefined || f.lower !== undefined || f.dispel !== undefined || !f.monitor) return false;
      // Round 2 (R2-SEC-9): healing too only on an actor the author owns. A "source" the card names is the author's
      // choice and nothing ties the boxes to a test, so any other heal waits for the GM's click.
      return owns(f.uuid);
    }
    default: return false;
  }
}

/** A short plain-text view of a value from a flag (key: value pairs, not raw JSON). */
function plainOf(v: unknown, depth = 0): string {
  if (v === null || v === undefined) return tx('SR2E.Text.Trust.none');
  if (typeof v !== 'object') return String(v).slice(0, 80);
  if (depth > 1) return '…';
  if (Array.isArray(v)) return v.slice(0, 5).map((x) => plainOf(x, depth + 1)).join(', ') + (v.length > 5 ? ', …' : '');
  return Object.entries(v).slice(0, 6).map(([k, x]) => `${k} ${plainOf(x, depth + 1)}`).join(', ').slice(0, 160);
}

/** A damage or blast's Power and level from a flag, bounded (a forged card can't ask for Power 999). */
export function boundPower(v: unknown): number { return safeInt(v, 0, 60, 0); }
export function boundLevel(v: unknown): string { return LEVELS.includes(String(v)) ? String(v) : 'L'; }

/**
 * Pure: plain-text lines naming exactly what an Apply (GM) card changes, built from its flags (not its content),
 * for the GM's confirmation. `nameOf` turns a uuid into a name (or '').
 */
export function describeGmChange(action: string, flags: Record<string, any>, nameOf: (uuid: string) => string = () => ''): string[] {
  const spec = GM_APPLY_SPECS[action];
  const f: any = spec ? flags?.[spec.flag] ?? {} : {};
  const nm = (u: unknown) => (safeStr(u, 400) ? nameOf(u) || String(u) : tx('SR2E.Text.Trust.nobody'));
  const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;
  const out: string[] = [];
  switch (action) {
    case 'applyTally': out.push(f.name
      ? tx('SR2E.Text.Trust.tallyNamed', { host: nm(f.hostUuid), successes: Number(f.successes), name: String(f.name) })
      : tx('SR2E.Text.Trust.tally', { host: nm(f.hostUuid), successes: Number(f.successes) })); break;
    case 'applySite': {
      out.push(tx('SR2E.Text.Trust.site', { site: nm(f.siteUuid) }));
      if (f.add !== undefined) out.push(tx('SR2E.Text.Trust.toSecurityTally', { amount: signed(Number(f.add)) }));
      if (f.minAlert) out.push(tx('SR2E.Text.Trust.alertAtLeast', { alert: String(f.minAlert) }));
      if (f.deviceId) {
        const state = f.bypassed !== undefined ? (f.bypassed ? tx('SR2E.Text.Trust.deviceBypassed') : tx('SR2E.Text.Trust.deviceRestored')) : '';
        const casing = f.casingOpen !== undefined ? (f.casingOpen ? tx('SR2E.Text.Trust.casingOpened') : tx('SR2E.Text.Trust.casingClosed')) : '';
        out.push(tx('SR2E.Text.Trust.device', { id: String(f.deviceId), state, casing }));
      }
      break;
    }
    case 'applyHost': {
      out.push(tx('SR2E.Text.Trust.host', { host: nm(f.hostUuid) }));
      for (const k of Object.keys(f)) {
        if (k === 'hostUuid' || k === 'sourceUuid') continue;
        const v = f[k];
        if (k === 'resetTally') out.push(tx('SR2E.Text.Trust.securityTallyReset'));
        else if (k === 'setAlert') out.push(tx('SR2E.Text.Trust.alertSet', { alert: String(v) }));
        else if (k === 'minAlert') out.push(tx('SR2E.Text.Trust.alertAtLeast', { alert: String(v) }));
        else if (k === 'validate') out.push(tx('SR2E.Text.Trust.passcodeGiven', { name: nm(v) }));
        else if (k === 'invalidate') out.push(tx('SR2E.Text.Trust.passcodeTaken', { name: nm(v) }));
        else if (k === 'found') out.push(tCount(Array.isArray(v?.ids) ? v.ids.length : 0, 'SR2E.Text.Trust.findsFiles', { name: nm(v?.deckerUuid) }));
        else if (k === 'spot') out.push(tx('SR2E.Text.Trust.isSpotted', { name: nm(v) }));
        else if (k === 'decrypt') out.push(tx('SR2E.Text.Trust.fileDecrypted', { id: String(v) }));
        else if (k === 'removeFile') out.push(tx('SR2E.Text.Trust.fileDeleted', { id: String(v) }));
        else if (k === 'addFile') {
          const name = String(v?.name ?? '');
          const worth = v?.value !== undefined;
          const value = Number(v?.value) || 0;
          out.push(worth
            ? (v?.paydata ? tx('SR2E.Text.Trust.fileUploadedWorthPaydata', { name, value }) : tx('SR2E.Text.Trust.fileUploadedWorth', { name, value }))
            : (v?.paydata ? tx('SR2E.Text.Trust.fileUploadedPaydata', { name }) : tx('SR2E.Text.Trust.fileUploaded', { name })));
        }
        else if (k === 'editFile') out.push(tx('SR2E.Text.Trust.fileEdited', { id: String(v?.id ?? ''), note: String(v?.note ?? '').slice(0, 120) }));
        else if (k === 'smoke') {
          const tn = Number(v?.tn) || 0;
          const rating = Number(v?.rating) || 0;
          const until = Number(v?.round) >= 0;
          const world = Number.isFinite(Number(v?.worldTime));
          out.push(until
            ? (world ? tx('SR2E.Text.Trust.smokeUntilWorld', { tn, rating, round: Number(v.round), time: Number(v.worldTime) }) : tx('SR2E.Text.Trust.smokeUntil', { tn, rating, round: Number(v.round) }))
            : (world ? tx('SR2E.Text.Trust.smokeWorld', { tn, rating, time: Number(v.worldTime) }) : tx('SR2E.Text.Trust.smoke', { tn, rating })));
        }
        else if (k === 'bombFound') out.push(tx('SR2E.Text.Trust.findsDataBomb', { name: nm(v?.deckerUuid) }));
        else if (k === 'defuse') out.push(tx('SR2E.Text.Trust.dataBombDefused', { what: plainOf(v) }));
        else if (k === 'bombOff') out.push(tx('SR2E.Text.Trust.dataBombGoesOff', { what: plainOf(v) }));
        else out.push(`${k}: ${plainOf(v)}`);
      }
      break;
    }
    case 'applyLocks': out.push(tCount(Number(f.successes), 'SR2E.Text.Trust.sensorLock', { vehicle: nm(f.vehicleUuid), target: nm(f.targetUuid) })); break;
    case 'applyJam': out.push(f.by
      ? tx('SR2E.Text.Trust.jammedBy', { drone: nm(f.droneUuid), rating: Number(f.rating), by: String(f.by) })
      : tx('SR2E.Text.Trust.jammed', { drone: nm(f.droneUuid), rating: Number(f.rating) })); break;
    case 'applyDroneLink': out.push(f.kind === 'spoof'
      ? tx('SR2E.Text.Trust.linkTakenOver', { drone: nm(f.droneUuid), by: nm(f.byUuid) })
      : tx('SR2E.Text.Trust.linkIntercepted', { drone: nm(f.droneUuid), by: nm(f.byUuid) })); break;
    case 'applyHold': out.push(tx('SR2E.Text.Trust.held', { target: nm(f.targetUuid), holder: nm(f.holderUuid) })); break;
    case 'applyCleanse': out.push(tx('SR2E.Text.Trust.backgroundCount', { scene: String(f.sceneId), amount: `${Number(f.points) >= 0 ? '−' : '+'}${Math.abs(Number(f.points))}` })); break;
    case 'applyPossession': {
      if (!f.by) { out.push(tx('SR2E.Text.Trust.freedFromPossession', { target: nm(f.targetUuid) })); break; }
      // v0.81.1 (A-3): the possessor's real name (from its uuid), the card's name only beside it, and what it carries.
      const real = safeStr(f.by.uuid, 400) ? nameOf(f.by.uuid) : '';
      const said = typeof f.by.name === 'string' ? f.by.name.slice(0, 120) : '';
      const by = real || said || nm(f.by.uuid);
      out.push(real && said && said !== real
        ? tx('SR2E.Text.Trust.possessedCalled', { target: nm(f.targetUuid), by, said })
        : tx('SR2E.Text.Trust.possessed', { target: nm(f.targetUuid), by }));
      const attrs = f.by.attributes && typeof f.by.attributes === 'object' ? Object.entries(f.by.attributes) : [];
      if (attrs.length) out.push(tx('SR2E.Text.Trust.mentalAttributesReplace', { list: attrs.map(([k, v]) => `${k} ${Number(v)}`).join(', ') }));
      const skills = Array.isArray(f.by.skills) ? f.by.skills : [];
      if (skills.length) out.push(tCount(skills.length, 'SR2E.Text.Trust.bringsSkills', { list: `${skills.slice(0, 8).map((s: any) => `${String(s?.name ?? '?').slice(0, 40)} ${Number(s?.rating) || 0}`).join(', ')}${skills.length > 8 ? ', …' : ''}` }));
      break;
    }
    case 'applyPowerEffect': {
      if (!f.effect) { out.push(tx('SR2E.Text.Trust.effectTakenOff', { target: nm(f.targetUuid), id: String(f.removeId ?? '') })); break; }
      const e = f.effect;
      const name = e.name !== undefined && e.name !== null ? String(e.name) : tx('SR2E.Text.Trust.anEffect');
      out.push(e.fromName
        ? tx('SR2E.Text.Trust.effectPutOnFrom', { target: nm(f.targetUuid), name, from: String(e.fromName), bundle: describeBundle(e) })
        : tx('SR2E.Text.Trust.effectPutOn', { target: nm(f.targetUuid), name, bundle: describeBundle(e) }));
      if (e.status) {
        const status = String(e.status);
        const turns = Number(e.holdTurns) > 0;
        out.push(turns
          ? (e.breakTn ? tx('SR2E.Text.Trust.statusForBreak', { status, turns: Number(e.holdTurns), tn: Number(e.breakTn) }) : tx('SR2E.Text.Trust.statusFor', { status, turns: Number(e.holdTurns) }))
          : (e.breakTn ? tx('SR2E.Text.Trust.statusBreak', { status, tn: Number(e.breakTn) }) : tx('SR2E.Text.Trust.status', { status })));
      }
      if (e.permanent) out.push(tx('SR2E.Text.Trust.permanent'));
      // v0.81.1 (RB2-3): what a later partial dispel rebuilds it from.
      if (e.spec && typeof e.spec === 'object' && e.spec.perSuccess) out.push(tx('SR2E.Text.Trust.growsWithSuccesses', { successes: Number(e.successes) || 0, growth: specGrowth(e.spec, e.successes) }));
      break;
    }
    case 'applyActorUpdate': {
      const who = nm(f.uuid);
      if (f.monitor) out.push(tx('SR2E.Text.Trust.monitorBoxes', { who, amount: signed(Number(f.monitor.boxes)), track: String(f.monitor.track) }));
      if (f.nuyen) out.push(f.nuyen.label
        ? tx('SR2E.Text.Trust.nuyenLabel', { who, amount: signed(Number(f.nuyen.amount)), label: String(f.nuyen.label) })
        : tx('SR2E.Text.Trust.nuyen', { who, amount: signed(Number(f.nuyen.amount)) }));
      if (f.remove) out.push(tx('SR2E.Text.Trust.removed', { who }));
      if (f.masterDied) out.push(tx('SR2E.Text.Trust.masterDead', { who }));
      if (f.handSpirit) out.push(tCount(Number(f.handSpirit.services), 'SR2E.Text.Trust.changesHands', { who, to: nm(f.handSpirit.toUuid) }));
      if (f.lower) out.push(`${who}: ${String(f.lower.key)} ${Number(f.lower.from)} → ${Number(f.lower.to)}`);
      if (f.dispel) out.push(tx('SR2E.Text.Trust.dispelled', { who, spell: String(f.dispel.spellName), force: Number(f.dispel.force), from: Number(f.dispel.from), to: Number(f.dispel.to) }));
      if (f.by) out.push(tx('SR2E.Text.Trust.fromName', { name: nm(f.by) }));
      break;
    }
    case 'applySurgery': {
      const sg = f.snap?.surgery ?? {};
      const patient = safeStr(sg.patientUuid, 400) ? nm(sg.patientUuid) : (sg.patientName !== undefined && sg.patientName !== null ? String(sg.patientName) : tx('SR2E.Text.Trust.nobody'));
      const item = sg.itemName !== undefined && sg.itemName !== null ? String(sg.itemName) : tx('SR2E.Text.Trust.anItem');
      out.push(tx('SR2E.Text.Trust.surgery', { surgeon: nm(f.surgeonUuid), patient, item, points: Number(sg.points) || 0 }));
      const successes = Number(f.snap?.successes) || 0;
      out.push(sg.care
        ? (sg.pay ? tCount(successes, 'SR2E.Text.Trust.successesCarePaid', { care: String(sg.care) }) : tCount(successes, 'SR2E.Text.Trust.successesCare', { care: String(sg.care) }))
        : tCount(successes, 'SR2E.Text.Trust.successes'));
      // v0.81.1 (SEC1-7, RA2-1): the money and state the card carries, so the GM sees them.
      if (sg.pay || sg.paid || Number(sg.paidAmount) > 0) out.push(sg.paid
        ? tx('SR2E.Text.Trust.patientPaysAlreadyPaid', { amount: Number(sg.paidAmount) || 0 })
        : tx('SR2E.Text.Trust.patientPaysSoFar', { amount: Number(sg.paidAmount) || 0 }));
      const state = [sg.installed ? tx('SR2E.Text.Trust.alreadyInstalled') : '', sg.harmed ? tx('SR2E.Text.Trust.alreadyHarmed') : '', sg.traumaDone ? tx('SR2E.Text.Trust.traumaAlreadyApplied') : ''].filter(Boolean);
      if (state.length) out.push(tx('SR2E.Text.Trust.cardSays', { list: state.join(', ') }));
      break;
    }
    case 'applyHeal': {
      const h = f.snap?.heal ?? {};
      const patient = safeStr(h.targetUuid, 400) ? nm(h.targetUuid) : (h.targetName !== undefined && h.targetName !== null ? String(h.targetName) : tx('SR2E.Text.Trust.nobody'));
      const mode = h.mode === 'firstAid' ? tx('SR2E.Text.Trust.firstAid') : (h.mode !== undefined && h.mode !== null ? String(h.mode) : tx('SR2E.Text.Trust.healing'));
      out.push(tx('SR2E.Text.Trust.healingBy', { healer: nm(f.healerUuid), patient, track: String(h.track ?? '?'), mode }));
      const successes = Number(f.snap?.successes) || 0;
      const before = Number(h.before) || 0;
      out.push(h.after !== undefined && Number(h.after) !== Number(h.before)
        ? tCount(successes, 'SR2E.Text.Trust.healBoxesExpected', { before, after: Number(h.after) })
        : tCount(successes, 'SR2E.Text.Trust.healBoxes', { before }));
      break;
    }
    case 'applyPatch': out.push(tx('SR2E.Text.Trust.patchOn', { name: f.name !== undefined && f.name !== null ? String(f.name) : tx('SR2E.Text.Trust.aPatch'), kind: String(f.kind), rating: Number(f.rating), target: nm(f.targetUuid) })); break;
    case 'applyVehicleJob': {
      const a = Array.isArray(f.args) ? f.args : [];
      const vehicle = safeStr(a[0], 400) ? nameOf(a[0]) || String(a[0]) : tx('SR2E.Text.Trust.aVehicle');
      const who = (safeStr(f.actorUuid, 400) ? nameOf(f.actorUuid) : '') || tx('SR2E.Text.Trust.aMechanic');
      if (f.method === 'finishModInstall') {
        const mod = (a[3] !== undefined && a[3] !== null ? String(a[3]) : tx('SR2E.Text.Trust.aMod')).slice(0, 120);
        out.push(Number(a[4]) > 0
          ? tx('SR2E.Text.Trust.modInstallPaid', { who, mod, vehicle, paid: Math.trunc(Number(a[4])) })
          : tx('SR2E.Text.Trust.modInstall', { who, mod, vehicle }));
      } else {
        const boxes = Math.max(0, Math.trunc(Number(a[1]) || 0));
        out.push(Array.isArray(a[2]) && a[2].length
          ? tCount(boxes, 'SR2E.Text.Trust.vehicleRepairAnd', { who, vehicle, list: a[2].map((x: unknown) => String(x).slice(0, 20)).join(', ') })
          : tCount(boxes, 'SR2E.Text.Trust.vehicleRepair', { who, vehicle }));
      }
      out.push(tx('SR2E.Text.Trust.checkedAgainFromProject'));
      break;
    }
    case 'applyTimedStatus': {
      const target = nm(f.targetUuid);
      const seconds = Number(f.seconds);
      const tn = Number(f.flashTn) > 0;
      const src = safeStr(f.sourceUuid, 400) ? nameOf(f.sourceUuid) || tx('SR2E.Text.Trust.someone') : '';
      out.push(tn
        ? (src ? tx('SR2E.Text.Trust.blindedTnFlash', { target, seconds, tn: Number(f.flashTn), source: src }) : tx('SR2E.Text.Trust.blindedTn', { target, seconds, tn: Number(f.flashTn) }))
        : (src ? tx('SR2E.Text.Trust.blindedFlash', { target, seconds, source: src }) : tx('SR2E.Text.Trust.blinded', { target, seconds })));
      break;
    }
    default: out.push(action);
  }
  return out;
}

// ---------------------------------------------------------------- undo (SEC1-9)

/** The largest filed "before" value an undo keeps (characters of JSON): a biography or a long list fits. */
export const MAX_UNDO_FIELD = 20_000;

/** A value's size as JSON (Infinity when it can't be written). */
function undoValueSize(v: unknown): number {
  try { return (JSON.stringify(v ?? null) ?? '').length; } catch { return Infinity; }
}

/** Fields an undo never writes back (who owns a document, its identity, Foundry's own bookkeeping). */
const UNDO_FORBIDDEN = ['ownership', 'permission', '_stats', '_id', 'type', 'folder', 'flags.core', 'role'];

/** Every leaf path a change touches (Foundry's diff of an update): `-=` / `==` markers taken off. */
export function diffPaths(changed: unknown, prefix = '', depth = 0, out: string[] = []): string[] {
  if (!changed || typeof changed !== 'object' || Array.isArray(changed) || depth > 20) { if (prefix) out.push(prefix); return out; }
  const keys = Object.keys(changed);
  if (!keys.length && prefix) out.push(prefix);
  for (const raw of keys) {
    if (!prefix && (raw === '_id' || raw === '_stats')) continue;
    const k = raw.replace(/^(-=|==)/, '');
    const p = prefix ? `${prefix}.${k}` : k;
    const v = (changed as any)[raw];
    if (raw !== k || !v || typeof v !== 'object' || Array.isArray(v)) out.push(p);
    else diffPaths(v, p, depth + 1, out);
  }
  return out;
}

/**
 * Pure (SEC1-9 / A-5): keep only the filed undo fields the server actually changed (`changed`), with a safe path that
 * isn't ownership or bookkeeping. The "before" values travel in the update's options, which the changing client sets.
 */
export function undoFieldsToKeep<T extends { path: string }>(fields: readonly T[], changed: unknown): T[] {
  const real = diffPaths(changed);
  return fields.filter((f) => {
    if (!f || !safePath(f.path)) return false;
    if (UNDO_FORBIDDEN.some((x) => f.path === x || f.path.startsWith(`${x}.`))) return false;
    // v0.81.1 (SEC1-15): a filed "before" value past MAX_UNDO_FIELD (the changing client sets it) isn't kept: a few
    // bloated ones would push the GM's own steps out of the stored log.
    if (undoValueSize((f as any).before) > MAX_UNDO_FIELD) return false;
    return real.some((p) => p === f.path || p.startsWith(`${f.path}.`) || f.path.startsWith(`${p}.`));
  });
}

// ---------------------------------------------------------------- approvals (SEC1-10)

/**
 * Pure: problems with a `method` request's data before the GM's client runs it. Numbers in the arguments must be
 * finite and not negative; nested objects may not reach a prototype; `buyItem` pays exactly what was filed.
 */
export function methodRequestProblems(data: Record<string, unknown>, filed: { karma: number; nuyen: number }): string[] {
  const out: string[] = [];
  const args = Array.isArray(data['args']) ? (data['args'] as unknown[]) : [];
  if (args.length > 8) out.push(tx('SR2E.Text.Trust.tooManyArguments'));
  if (!deepSafeKeys(args)) out.push(tx('SR2E.Text.Trust.argumentReachesPrototype'));
  for (const a of args) if (typeof a === 'number' && !(Number.isFinite(a) && a >= 0)) out.push(tx('SR2E.Text.Trust.badNumber', { value: a }));
  // v0.82.1: an edge or flaw by hand: an id (string) and/or one plain quality object, nothing else.
  if (['addQuality', 'editQuality', 'removeQuality'].includes(String(data['method']))) {
    const m = String(data['method']);
    const want = m === 'addQuality' ? ['object'] : m === 'editQuality' ? ['string', 'object'] : ['string'];
    if (args.length !== want.length || args.some((a, i) => (want[i] === 'object' ? !a || typeof a !== 'object' || Array.isArray(a) : typeof a !== 'string' || a.length > 64))) out.push(tx('SR2E.Text.Trust.notEdgeOrFlaw'));
    if (filed.karma || filed.nuyen) out.push(tx('SR2E.Text.Trust.edgeFlawCostsNothing'));
  }
  // v0.91.0: a shop purchase pays what was filed too; its key is a short string.
  if (data['method'] === 'buyFromShop' && (typeof args[0] !== 'string' || !args[0] || String(args[0]).length > 300)) out.push(tx('SR2E.Text.Trust.badShopKey'));
  // v0.91.5: a permit: a short item/vehicle reference, and the cost it was filed with (what is paid).
  if (data['method'] === 'getPermit') {
    if (typeof args[0] !== 'string' || !/^(item|vehicle):/.test(String(args[0])) || String(args[0]).length > 300 || args.length > 2) out.push(tx('SR2E.Text.Trust.badPermitRef'));
    const cost = Number(args[1]);
    if (!(Number.isSafeInteger(cost) && cost >= 0)) out.push(tx('SR2E.Text.Trust.noPrice'));
    else if (cost !== Number(filed.nuyen)) out.push(tx('SR2E.Text.Trust.priceMismatch', { price: cost, filed: Number(filed.nuyen) }));
    if (filed.karma) out.push(tx('SR2E.Text.Trust.permitNoKarma'));
  }
  if (data['method'] === 'buyItem' || data['method'] === 'buyFromShop') {
    const price = Number(args[1]);
    if (!(Number.isFinite(price) && price >= 0)) out.push(tx('SR2E.Text.Trust.noPrice'));
    else if (price !== Number(filed.nuyen)) out.push(tx('SR2E.Text.Trust.priceMismatch', { price, filed: Number(filed.nuyen) }));
    if (!intIn(args[3] ?? 1, 1, 1000)) out.push(tx('SR2E.Text.Trust.badQuantity'));
  }
  return out;
}
