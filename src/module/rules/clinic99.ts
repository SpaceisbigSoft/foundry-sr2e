/**
 * v0.99.0 rules completeness, clinics, surgery and ware damage. Pure functions over RULES.CLINIC_V99
 * (rules/config99/clinic.ts), from the Street Samurai Catalog (SSC), Shadowtech and Cybertechnology. Each behaves the
 * book's way at the shipped value of its switch; at the other value ('v980') the caller keeps the v0.98.0 code. No
 * Foundry dependency (the GM-written damage record is read through a source the glue sets). A refusal is a language
 * key (`why`), never text.
 */
import { RULES } from './config.ts';
import { SYSTEM_ID } from '../config/system.ts';
import { CLINIC_V99_TABLES as T } from './config99/clinic.ts';

const V = () => RULES.CLINIC_V99;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));
const minTn = (n: number) => Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(num(n)));
const own = <X>(o: Record<string, X>, k: string): X | undefined => (Object.hasOwn(o, k) ? o[k] : undefined);
const WHY = 'SR2E.Clinic99.Why.';

export type Clinic99Switch = Exclude<keyof typeof RULES.CLINIC_V99, 'feeAlphaBeta' | 'feeDelta'>;
/** Whether a switch is at the book's way. */
export const on = (key: Clinic99Switch): boolean => (V() as any)[key] === 'book';

// ---------------------------------------------------------------- Finding a shadow clinic (SSC p. 99)

export const CLINIC_GRADES = ['alpha', 'beta', 'delta'] as const;
export type ClinicGrade = (typeof CLINIC_GRADES)[number];
export const ROUTES = ['street', 'corp'] as const;
export const SEARCH_MODES = ['knows', 'search'] as const;

/** The contact's ratings the test needs (the GM's client reads or types them). */
export interface ContactRatings { etiquette: number; intelligence: number; charisma: number }

/**
 * The clinic test (SSC p. 99): does the contact know one (Etiquette (Street) vs the TN, 1 success), or searching
 * (Intelligence + the lower of Charisma and Etiquette (Street) vs the TN; 2 successes for alpha, 3 for beta). Delta
 * has no test (Cybertechnology p. 44: the GM decides).
 */
export function clinicTest(o: { grade: string; route: string; mode: string } & ContactRatings): { dice: number; tn: number; need: number; why?: string } {
  if (!on('clinicSearch')) return { dice: 0, tn: 0, need: 0, why: `${WHY}off` };
  if (o.grade !== 'alpha' && o.grade !== 'beta') return { dice: 0, tn: 0, need: 0, why: `${WHY}delta` };
  const tn = own(T.searchTn, (ROUTES as readonly string[]).includes(o.route) ? o.route : 'street')![o.grade]!;
  const ett = Math.min(20, whole(o.etiquette));
  if (o.mode === 'search') return { dice: Math.min(40, whole(o.intelligence) + Math.min(ett, Math.min(20, whole(o.charisma)))), tn, need: T.searchNeed[o.grade]!, ...(whole(o.intelligence) + ett <= 0 ? { why: `${WHY}noDice` } : {}) };
  return { dice: ett, tn, need: 1, ...(ett <= 0 ? { why: `${WHY}noDice` } : {}) };
}

/** Found or not; a search takes the base 5 days ÷ the successes (to the tenth of a day). */
export function clinicOutcome(successes: number, t: { need: number }, mode: string): { found: boolean; days: number } {
  const s = whole(successes);
  const found = s >= Math.max(1, whole(t.need));
  return { found, days: mode === 'search' && s > 0 ? Math.round((T.searchDays / s) * 10) / 10 : 0 };
}

/** One character's found clinics (GM-written world record), by grade. */
export interface ClinicEntry { at: number; route: string; by: string }
export type ClinicRecord = Record<string, Partial<Record<ClinicGrade, ClinicEntry>>>;

/** The stored record, bounded (anything malformed dropped). */
export function clinicRecord(raw: unknown): ClinicRecord {
  const out: ClinicRecord = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 500)) {
    if (!safeKey(k) || !v || typeof v !== 'object') continue;
    const e: Partial<Record<ClinicGrade, ClinicEntry>> = {};
    for (const g of CLINIC_GRADES) {
      const x: any = (v as any)[g];
      if (x && typeof x === 'object') e[g] = { at: num(x.at), route: ROUTES.includes(x.route) ? x.route : 'street', by: String(x.by ?? '').slice(0, 120) };
    }
    if (Object.keys(e).length) out[k] = e;
  }
  return out;
}

/** The record with a clinic found for this character. */
export function withClinic(rec: ClinicRecord, key: string, grade: ClinicGrade, e: ClinicEntry): ClinicRecord {
  if (!safeKey(key)) return rec;
  return { ...rec, [key]: { ...(rec[key] ?? {}), [grade]: e } };
}

/** Whether the character has a clinic for ware of this grade (a better clinic does the lesser grades too; VERIFY). */
export function hasClinic(rec: ClinicRecord, key: string, grade: string): boolean {
  const i = CLINIC_GRADES.indexOf(grade as ClinicGrade);
  if (i < 0) return true;
  const e = rec[key] ?? {};
  return CLINIC_GRADES.slice(i).some((g) => Boolean(e[g]));
}

// ---------------------------------------------------------------- Fees (Cybertechnology pp. 44, 54; Core pp. 114–115)

/** The operation's size as the wound it gives (Core p. 114 for cyberware; Shadowtech's Body Index bands for bioware). */
export function surgerySize(points: number, bioware: boolean): 'L' | 'M' | 'S' | 'D' {
  const p = Math.max(0, num(points));
  if (bioware) return p <= 0.25 ? 'L' : p <= 0.75 ? 'M' : p <= 1.5 ? 'S' : 'D';
  return p <= 0 ? 'L' : p <= 0.4 ? 'M' : p < 1 ? 'S' : 'D';
}

/**
 * The graded clinic's multiplier on the doctor's fees and hospitalization (Cybertechnology p. 44): the daily care rates
 * only, never the surgery's own cost (the Medical Costs Table, Cybertechnology p. 54). 1 for standard ware or bioware.
 */
export function feeFactor(grade: string, bioware = false): number {
  if (!on('gradedFees') || bioware) return 1;
  if (grade === 'alpha' || grade === 'beta') return Math.max(1, whole(V().feeAlphaBeta));
  if (grade === 'delta') return Math.max(1, whole(V().feeDelta));
  return 1;
}

/**
 * The surgeon's fee for an operation at its list price (Cybertechnology p. 54, "Surgery (includes cost of surgeon)"),
 * sized by the Essence the ware actually costs (its grade applied; bioware by its Body Index); 0 when the fee is off.
 * The graded × 50 / × 200 is not on it (Cybertechnology p. 44 multiplies the daily rates: the care).
 */
export function surgeonFee(points: number, bioware: boolean): number {
  if (!on('surgeonFee')) return 0;
  return T.surgeryFee[surgerySize(points, bioware)]!;
}

/** A surgery's grade as frozen on its card when rolled (a known grade, else ''): the fees use it, not the item's later grade. */
export function gradeOf(v: unknown): string {
  return ['standard', 'alpha', 'beta', 'delta'].includes(String(v ?? '')) ? String(v) : '';
}

/** The GM-written record of surgeons' fees paid: patient key → entry → ¥ (an operation's id, or an item's install). */
export type FeeRecord = Record<string, Record<string, number>>;
export function feeRecord(raw: unknown): FeeRecord {
  const out: FeeRecord = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(-500)) {
    if (!safeKey(k) || !v || typeof v !== 'object') continue;
    const e: Record<string, number> = {};
    for (const [x, n] of Object.entries(v as Record<string, unknown>).slice(-200)) if (safeKey(x)) e[x] = Math.max(0, num(n));
    if (Object.keys(e).length) out[k] = e;
  }
  return out;
}
/** The entries of one operation: its id, and the item's install (a second operation putting the same ware in pays nothing more). */
export function feeKeys(opId: unknown, itemId: unknown): string[] {
  const keys: string[] = [];
  const o = String(opId ?? ''), i = String(itemId ?? '');
  if (o && safeKey(`op-${o}`)) keys.push(`op-${o}`);
  if (i && safeKey(`${i}-install`)) keys.push(`${i}-install`);
  return keys;
}
/** Whether a fee is recorded for any of these entries. */
export function feePaid(entries: Record<string, unknown> | null | undefined, keys: readonly string[]): boolean {
  return Boolean(entries) && keys.some((k) => Object.hasOwn(entries!, k) && entries![k] !== null);
}
/** The record with these entries paid (newest kept). */
export function feeWith(rec: FeeRecord, patientKey: string, keys: readonly string[], fee: number): FeeRecord {
  if (!safeKey(patientKey)) return rec;
  const e = { ...(rec[patientKey] ?? {}) };
  for (const k of keys) { delete e[k]; e[k] = Math.max(0, num(fee)); }
  const next = { ...rec };
  delete next[patientKey];
  next[patientKey] = e;
  return feeRecord(next);
}
/** The record without an item's install (the ware came out: a new operation pays again). */
export function feeWithout(rec: FeeRecord, patientKey: string, itemId: string): FeeRecord {
  const e = rec[patientKey];
  const k = `${itemId}-install`;
  if (!e || !Object.hasOwn(e, k)) return rec;
  const n = { ...e };
  delete n[k];
  return { ...rec, [patientKey]: n };
}

// ---------------------------------------------------------------- Removal (Shadowtech pp. 36–41)

/** The removal test's TN: 10 − the patient's current Essence, rounded down (never below 2). */
export function removalTn(essence: number): number {
  return minTn(10 - Math.floor(Math.max(0, num(essence))));
}

/** The extra Essence lost when the removal test gets no successes: 10% of the ware's cost, rounded up to the tenth. */
export function removalLoss(essenceCost: number, successes: number): number {
  if (whole(successes) > 0) return 0;
  const c = Math.max(0, num(essenceCost));
  return c > 0 ? Math.ceil(Math.round(c * T.removalLoss * 1e6) / 1e5 - 1e-9) / 10 : 0;
}

/** Of the skills found (name, rating), the lower-rated (Shadowtech: Biotech or Cybertechnology, whichever is lower). */
export function lowerSkill<S extends { rating: number }>(found: ReadonlyArray<S | null | undefined>): S | null {
  const xs = found.filter((s): s is S => Boolean(s) && num(s!.rating) > 0);
  if (!xs.length) return null;
  return xs.reduce((a, b) => (num(b.rating) < num(a.rating) ? b : a));
}

// ---------------------------------------------------------------- Ware damage levels (Shadowtech pp. 36–41)

export const WARE_LEVELS = ['L', 'M', 'S', 'D', 'X'] as const;
export type WareLevel = (typeof WARE_LEVELS)[number] | '';
/** The item flag with the ware's own damage level (player-writable: it can only make the damage worse). */
export const WARE_FLAG = 'ware99Dmg';

export function levelOf(v: unknown): WareLevel {
  return (WARE_LEVELS as readonly string[]).includes(String(v ?? '')) ? (String(v) as WareLevel) : '';
}
const rank = (l: WareLevel): number => (l ? WARE_LEVELS.indexOf(l) + 1 : 0);
/** The worse of two levels. */
export function worse(a: unknown, b: unknown): WareLevel {
  const x = levelOf(a), y = levelOf(b);
  return rank(x) >= rank(y) ? x : y;
}
/** A new hit on ware already damaged: one step past the worse of the two (Shadowtech: damage accumulates; VERIFY). */
export function accumulate(old: unknown, hit: unknown): WareLevel {
  const o = levelOf(old), h = levelOf(hit);
  if (!o || !h) return o || h;
  return WARE_LEVELS[Math.min(WARE_LEVELS.length - 1, rank(worse(o, h)))]!;
}
/** Moderate or worse (destroyed too) stops the ware working. */
export function levelStops(l: unknown): boolean {
  return rank(levelOf(l)) >= 2;
}
/** Light damage: a bonus at half, fractions dropped (toward 0). */
export function halfBonus(v: unknown): number {
  return Math.trunc(num(v) / 2);
}
/** The TN penalty on every test from the damaged systems: Serious +1, Deadly +2 each; destroyed none. */
export function feedbackTn(levels: readonly unknown[]): number {
  return levels.reduce<number>((n, l) => n + (own(T.feedbackTn, levelOf(l)) ?? 0), 0);
}

/** A key for a uuid in a world record (no dots: Foundry nests dotted keys). */
export function recordKey(uuid: unknown): string {
  return String(uuid ?? '').replace(/\./g, '_').slice(0, 200);
}
function safeKey(k: string): boolean {
  return typeof k === 'string' && k.length > 0 && k.length <= 200 && !k.includes('.') && k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
}

/** The most entries the damage record keeps (the newest), and per character (the actor part of the key). */
export const RECORD_MAX = 2000;
export const RECORD_PER_ACTOR = 100;

/** The GM-written damage record: item key → level (the newest RECORD_MAX kept). */
export type DamageRecord = Record<string, WareLevel>;
export function damageRecord(raw: unknown): DamageRecord {
  const out: DamageRecord = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(-RECORD_MAX)) { const l = levelOf(v); if (safeKey(k) && l) out[k] = l; }
  return out;
}

/** The actor part of an item's record key (Actor_x of Actor_x_Item_y; a token's actor with its scene and token). */
export function actorKeyOf(key: string): string {
  const i = String(key ?? '').lastIndexOf('_Item_');
  return i > 0 ? key.slice(0, i) : '';
}

/**
 * The record with this item at `level`, as the newest entry. `refused` when the character already has RECORD_PER_ACTOR
 * other entries (the write is skipped: it wouldn't survive); `full` when this write fills the character's share.
 */
export function recordWith(rec: DamageRecord, key: string, level: WareLevel): { rec: DamageRecord; refused: boolean; full: boolean } {
  if (!safeKey(key) || !level) return { rec, refused: true, full: false };
  const ak = actorKeyOf(key);
  const mine = Object.keys(rec).filter((k) => k !== key && actorKeyOf(k) === ak).length;
  if (ak && mine >= RECORD_PER_ACTOR) return { rec, refused: true, full: true };
  const next: DamageRecord = { ...rec };
  delete next[key];
  next[key] = level;
  return { rec: damageRecord(next), refused: false, full: Boolean(ak) && mine + 1 >= RECORD_PER_ACTOR };
}

/** The record without these keys. */
export function recordWithout(rec: DamageRecord, keys: Iterable<string>): DamageRecord {
  const next: DamageRecord = { ...rec };
  for (const k of keys) delete next[k];
  return next;
}

let recordSource: () => unknown = () => ({});
let cached: DamageRecord | null = null;
/** The glue sets where the GM-written record is read from (a world setting). */
export function setDamageRecordSource(fn: () => unknown): void { recordSource = fn; cached = null; }
/** The record changed (the setting's onChange, a write on this client): read it again next time. */
export function resetRecordCache(): void { cached = null; }
/** The level the GM-written record keeps for an item (by its uuid); the record is parsed once per change. */
export function recordedLevel(uuid: unknown): WareLevel {
  try { cached ??= damageRecord(recordSource()); return cached[recordKey(uuid)] ?? ''; } catch { return ''; }
}

// ---------------------------------------------------------------- The record's GM-side notes (world setting)

/** A recorded ware deleted by a player: kept by character, name and kind, so the same ware made again keeps its level. */
export interface GoneEntry { actor: string; name: string; kind: string; level: WareLevel; at: number }
/**
 * The damage record's notes: when the GM cleared each key (a reload's sweep then ignores an item level set before
 * that), the repair tests and clear cards already used to clear (a copy is refused), and deleted recorded ware.
 */
export interface DamageMeta { cleared: Record<string, number>; used: string[]; gone: GoneEntry[] }
export const META_USED_MAX = 500;
export const META_GONE_MAX = 200;
const short = (v: unknown, n: number): string => String(v ?? '').slice(0, n);
export function damageMeta(raw: unknown): DamageMeta {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const cleared: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.cleared && typeof r.cleared === 'object' ? r.cleared : {}).slice(-RECORD_MAX)) if (safeKey(k)) cleared[k] = num(v);
  const used = (Array.isArray(r.used) ? r.used : []).map((x: unknown) => short(x, 80)).filter(Boolean).slice(-META_USED_MAX);
  const gone: GoneEntry[] = (Array.isArray(r.gone) ? r.gone : []).filter((g: any) => g && typeof g === 'object' && safeKey(String(g.actor ?? '')) && levelOf(g.level))
    .map((g: any) => ({ actor: short(g.actor, 200), name: short(g.name, 200), kind: short(g.kind, 60), level: levelOf(g.level), at: num(g.at) })).slice(-META_GONE_MAX);
  return { cleared, used, gone };
}
/** The notes after the GM cleared a key at `at` (ms). */
export function metaCleared(m: DamageMeta, key: string, at: number): DamageMeta {
  if (!safeKey(key)) return m;
  const cleared = { ...m.cleared };
  delete cleared[key];
  cleared[key] = num(at);
  return damageMeta({ ...m, cleared });
}
/** The notes with these ids used (a repair test's id, a clear card's id). */
export function metaUse(m: DamageMeta, ids: readonly unknown[]): DamageMeta {
  const add = ids.map((x) => short(x, 80)).filter(Boolean);
  return damageMeta({ ...m, used: [...m.used.filter((x) => !add.includes(x)), ...add] });
}
export function metaUsed(m: DamageMeta, ids: readonly unknown[]): boolean {
  return ids.some((x) => { const s = short(x, 80); return Boolean(s) && m.used.includes(s); });
}
/** The notes with a deleted ware kept (the same character, name and kind replaced). */
export function metaGone(m: DamageMeta, e: GoneEntry): DamageMeta {
  const same = (g: GoneEntry): boolean => g.actor === e.actor && g.name === e.name && g.kind === e.kind;
  return damageMeta({ ...m, gone: [...m.gone.filter((g) => !same(g)), e] });
}
/** The deleted ware a new item on this character matches (by name and kind), and the notes without it. */
export function metaTake(m: DamageMeta, actor: string, name: string, kind: string): { entry: GoneEntry | null; meta: DamageMeta } {
  const i = m.gone.findIndex((g) => g.actor === actor && g.name === String(name ?? '').slice(0, 200) && g.kind === String(kind ?? '').slice(0, 60));
  if (i < 0) return { entry: null, meta: m };
  return { entry: m.gone[i]!, meta: { ...m, gone: m.gone.filter((_, n) => n !== i) } };
}
/** A reload's sweep ignores an item's own level the GM cleared since it was last changed (its modified time, ms). */
export function clearedSince(m: DamageMeta, key: string, modified: unknown): boolean {
  const at = m.cleared[key];
  return at !== undefined && num(modified, 0) <= at;
}

// ---------------------------------------------------------------- Proof of a repair (the GM's check of a clear card)

/**
 * Whether a repair test's card snapshot proves a repair of this item: a cyberRepair of the same item and owner, and
 * successes at the level's TN counted again from its dice (a typed result has no faces: its successes). 0 otherwise.
 */
export function repairProof(snap: any, o: { itemId: string; ownerUuid: string; tn: number }): number {
  if (!snap || typeof snap !== 'object' || snap.kind !== 'cyberRepair') return 0;
  const c = snap.cyberRepair;
  if (!c || String(c.itemId ?? '') !== o.itemId || (c.ownerUuid && String(c.ownerUuid) !== o.ownerUuid)) return 0;
  const tn = Math.max(minTn(o.tn), minTn(snap.targetNumber));
  if (snap.typed) return Math.min(40, whole(snap.successes));
  const dice: any[] = Array.isArray(snap.dice) ? snap.dice.slice(0, 60) : [];
  return Math.min(whole(snap.successes), dice.filter((d) => num(d?.total) >= tn).length);
}

/** A repair that fails after all (a GM's TN change) marks the ware damaged again only when its level stops it (or it has none). */
export function redamages(level: unknown): boolean {
  const l = levelOf(level);
  return !on('damageLevels') || !l || levelStops(l);
}

/** An item's own level (its flag). */
export function itemLevel(item: any): WareLevel {
  const f = typeof item?.getFlag === 'function' ? item.getFlag(SYSTEM_ID, WARE_FLAG) : item?.flags?.[SYSTEM_ID]?.[WARE_FLAG];
  return levelOf(f);
}

/**
 * The item's own level as far as it is trusted. Every level is worse for the player than none, 'destroyed' too:
 * destroyed from the item alone stops the ware for good (no repair) and has no feedback penalty (Shadowtech pp. 36–41).
 */
export function trustedOwnLevel(item: any): WareLevel {
  return itemLevel(item);
}

/** The level that counts (book only): the worse of the item's own (trusted) and the GM's record; '' for bioware or under 'v980'. */
export function wareLevel(item: any): WareLevel {
  if (!on('damageLevels') || !item || item.type !== 'cyberware' || item.system?.bioware) return '';
  return worse(trustedOwnLevel(item), recordedLevel(item.uuid));
}

/** Whether the ware gives nothing (book: Moderate or worse). The old `system.damaged` still counts too (the caller's). */
export function wareStops(item: any): boolean {
  return levelStops(wareLevel(item));
}

/**
 * An augmentation as the rules engine sees it after its damage level: Light halves its attribute bonuses, Reaction
 * and Initiative dice; Moderate or worse marks it damaged. Unchanged under 'v980' or with no level.
 */
export function wareAug<A extends { attributes?: Record<string, number>; reaction?: number; initiativeDice?: number; damaged?: boolean }>(item: any, aug: A): A {
  const l = wareLevel(item);
  if (!l) return aug;
  if (levelStops(l)) return { ...aug, damaged: true };
  const attributes: Record<string, number> = {};
  for (const [k, v] of Object.entries(aug.attributes ?? {})) attributes[k] = halfBonus(v);
  return { ...aug, attributes, reaction: halfBonus(aug.reaction), initiativeDice: halfBonus(aug.initiativeDice) };
}

/** The feedback penalty from an actor's installed cyberware (book only). */
export function actorFeedbackTn(items: Iterable<any>): { tn: number; names: string[] } {
  if (!on('damageLevels')) return { tn: 0, names: [] };
  let tn = 0;
  const names: string[] = [];
  for (const i of items ?? []) {
    if (i?.type !== 'cyberware' || !i.system?.installed) continue;
    const v = feedbackTn([wareLevel(i)]);
    if (v) { tn += v; names.push(String(i.name ?? '')); }
  }
  return { tn, names };
}

// ---------------------------------------------------------------- Repair by damage level (Shadowtech pp. 36–41)

/**
 * The repair test for ware at this level (Shadowtech): TN by level × the grade's factor; base hours twice the base
 * Essence cost × the level's multiple (× delta's 4, Cybertechnology p. 44); a destroyed system can't be repaired.
 */
export function repairSpec(level: unknown, grade: string, baseEssence: number): { tn: number; hours: number; why?: string } {
  if (!on('repair')) return { tn: 0, hours: 0, why: `${WHY}off` };
  const l = levelOf(level);
  if (l === 'X') return { tn: 0, hours: 0, why: `${WHY}destroyed` };
  const lv = l || 'M';
  const tn = minTn(T.repairTn[lv]! * (own(T.repairGradeTn, grade) ?? 1));
  const hours = Math.round(2 * Math.max(0, num(baseEssence)) * T.repairTime[lv]! * (own(T.repairGradeTime, grade) ?? 1) * 100) / 100;
  return { tn, hours };
}

/** The repair's hours after the successes (the base ÷ the successes). */
export function repairHours(baseHours: number, successes: number): number {
  const s = whole(successes);
  return s > 0 ? Math.round((Math.max(0, num(baseHours)) / s) * 100) / 100 : 0;
}

/** Repair parts (Shadowtech): the ware's cost × 5% / 10% / 20% / 40% by level. */
export function repairParts(level: unknown, cost: number): number {
  const l = levelOf(level);
  const f = l && l !== 'X' ? T.repairParts[l]! : 0;
  return Math.round(Math.max(0, num(cost)) * f);
}
