/**
 * v0.97.0 rules completeness, the Matrix's system operations: pure functions over RULES.MXOPS_V97
 * (rules/config97/mxops.ts). Each behaves the book's way at the shipped value of its switch; at the other value
 * ('v965') the caller keeps the v0.96.5 code. No Foundry dependency. A refusal is a language key (`why`), never text.
 * Virtual Realities 2.0 (VR2) replaces the Core Rulebook's Matrix rules.
 */
import { RULES, type DamageLevel } from './config.ts';
import { tKey } from '../helpers/i18n.ts';

const V = () => RULES.MXOPS_V97;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));
const WHY = 'SR2E.MxOps97.Why.';

export type MxOps97Switch = 'analyzeHost' | 'operations' | 'validatePasscode' | 'slow' | 'restore' | 'interrogation';
/** Whether a switch is at the book's way. */
export const on = (key: MxOps97Switch): boolean => (V() as any)[key] === 'book';

// ---------------------------------------------------------------- The new catalog rows (VR2 p. 162)

type Sub = 'access' | 'control' | 'index' | 'files' | 'slave';
export interface OpRow97 { id: string; label: string; subsystem: Sub; utility: string; action: 'free' | 'simple' | 'complex'; effect: string; tn?: 'subsystem' | 'target'; anySub?: boolean }

/**
 * The System Operations Table's rows the catalog lacked (VR2 p. 162; the descriptions pp. 111–117). `anySub`: the
 * test is on the subsystem the decker picks ("targeted" or "appropriate" subsystem; Control by default). Crash
 * Application is Complex as on the table (its description, p. 112, says Simple). Scan Icon's test is special
 * (Computer vs the icon's Masking): its row's subsystem is only where the host's Security Test is made.
 */
const ROWS: ReadonlyArray<Omit<OpRow97, 'label'>> = [
  { id: 'analyzeSubsystem', subsystem: 'control', utility: 'analyze', action: 'simple', effect: 'analyzeSubsystem97', anySub: true },
  { id: 'crashApplication', subsystem: 'control', utility: 'crash', action: 'complex', effect: 'crashApplication97', anySub: true },
  { id: 'decoy', subsystem: 'control', utility: 'mirrors', action: 'complex', effect: 'decoy97' },
  { id: 'disinfect', subsystem: 'control', utility: 'disinfect', action: 'complex', effect: 'disinfect97', anySub: true },
  { id: 'dumpLog', subsystem: 'control', utility: 'validate', action: 'complex', effect: 'dumpLog97' },
  { id: 'locateDeckerOp', subsystem: 'index', utility: 'scanner', action: 'complex', effect: 'locateDecker97' },
  { id: 'locateFrame', subsystem: 'index', utility: 'scanner', action: 'complex', effect: 'locateFrame97' },
  { id: 'locateIcOp', subsystem: 'index', utility: 'analyze', action: 'complex', effect: 'locateIc97' },
  { id: 'retrain', subsystem: 'access', utility: 'commlink', action: 'free', effect: 'retrain97' },
  { id: 'scanIcon', subsystem: 'control', utility: 'scanner', action: 'simple', effect: 'scanIcon97', tn: 'target' },
];

/** The rows (with their translated labels) the catalog gets under 'book'; none under 'v965'. */
export function extraOperations(): OpRow97[] {
  if (!on('operations')) return [];
  return ROWS.map((r) => ({ ...r, label: tKey(`SR2E.MxOps97.Op.${r.id}`) }));
}

/** The operation ids this file adds (for the dialog and tests). */
export const OP_IDS: readonly string[] = ROWS.map((r) => r.id);

/** The subsystem an operation is tested on: the picked one for an `anySub` row, else the row's own. */
export function opSubsystem(op: { subsystem: string; anySub?: boolean } | null | undefined, picked: string): string | null {
  if (!op) return null;
  if (op.anySub && (RULES.MATRIX.subsystems as readonly string[]).includes(picked)) return picked;
  return op.subsystem;
}

// ---------------------------------------------------------------- Analyze Host and Scan Icon: an item per success

/**
 * What Analyze Host can tell (VR2 p. 111): the Security Rating, each subsystem's rating, and whether the host is a
 * virtual machine (`vm`; hosts have no such field, so the card asks the GM) — seven items, which is why seven
 * successes tell all (`analyzeHostAll`).
 */
export function analyzeHostItems(): string[] {
  return ['security', ...RULES.MATRIX.subsystems, 'vm'];
}
/** What Scan Icon can tell (VR2 p. 117): the MPCP, each persona rating, the Response Increase. */
export const SCAN_ITEMS: readonly string[] = ['mpcp', 'bod', 'evasion', 'masking', 'sensors', 'responseIncrease'];

/** The items in the order the decker asked for: `first` (if one of them), then the rest in the book's order. */
export function itemOrder(items: readonly string[], first: string | null | undefined): string[] {
  const f = first && items.includes(first) ? first : null;
  return f ? [f, ...items.filter((i) => i !== f)] : [...items];
}

/**
 * The items an Analyze Host tells (VR2 p. 111): one per net success in the decker's order; `analyzeHostAll`
 * successes or more tell them all. Null under 'v965' (the caller tells everything).
 */
export function analyzeHostReveal(net: number, first?: string | null): string[] | null {
  if (!on('analyzeHost')) return null;
  const all = itemOrder(analyzeHostItems(), first);
  const n = whole(net);
  return n >= Math.max(1, whole(V().analyzeHostAll)) ? all : all.slice(0, n);
}

/** Scan Icon (VR2 p. 117): an item per net success, in the decker's order. */
export function scanIconReveal(net: number, first?: string | null): string[] {
  return itemOrder(SCAN_ITEMS, first).slice(0, whole(net));
}

/** Scan Icon's TN modifier (VR2 p. 117): the target's sleaze raises the TN by its rating (the scanner already lowers it). */
export function scanIconSleazeMod(sleaze: number): number {
  return whole(sleaze);
}

// ---------------------------------------------------------------- Locate Decker (VR2 p. 114)

/** Whether a decker is located (VR2 p. 114): their Masking + loaded sleaze at most the Sensor Test's successes. */
export function deckerLocated(sensorSuccesses: number, masking: number, sleaze: number): boolean {
  return whole(masking) + whole(sleaze) <= whole(sensorSuccesses);
}

// ---------------------------------------------------------------- Records on the host (GM-owned)

/**
 * The decoys, passcodes and located icons live in flags on the host (the GM's document), written only through a
 * system test's host change (applied by the GM, judged by rules/trust.ts) and cleared when the decker leaves the host
 * (applications/mxops97.ts onActorUpdate97). Never read from the decker's own actor, which its player can write.
 */
export const HOST_DECOYS = 'decoys97';
export const HOST_PASSCODES = 'passcodes97';
export const HOST_LOCATED = 'located97';

const uuidOk = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 400;

// ---------------------------------------------------------------- Decoy (VR2 p. 112)

export interface Decoy97 { deckerUuid: string; successes: number; boxes: number }
/** A decoy's successes are kept at most 6: from 6 on it draws every attack (1D6 is at most 6), so more add nothing. */
export const DECOY_MAX = 6;

/** Whether a proactive IC's attack goes to the decoy (VR2 p. 112): 1D6 no higher than the decoy's successes (a tie fools it). */
export function decoyDraws(d6: number, successes: number): boolean {
  return whole(successes) > 0 && whole(d6) >= 1 && whole(d6) <= whole(successes);
}

/** The boxes a hit of that level fills (an icon's monitor: L 1, M 3, S 6, D 10). */
export function levelBoxes(level: DamageLevel | string): number {
  return ({ L: 1, M: 3, S: 6, D: 10 } as Record<string, number>)[String(level)] ?? 3;
}

/** A decoy after a hit at full damage (no resistance): its boxes, and whether it is gone. */
export function decoyHit(d: Decoy97, level: DamageLevel | string): { decoy: Decoy97; gone: boolean } {
  const boxes = whole(d.boxes) + levelBoxes(level);
  return { decoy: { ...d, boxes }, gone: boxes >= Math.max(1, whole(V().decoyBoxes)) };
}

/** A host's decoys, cleaned (from its flag). */
export function decoysOf(raw: unknown): Decoy97[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((d: any) => d && uuidOk(d.deckerUuid) && whole(d.successes) > 0)
    .map((d: any) => ({ deckerUuid: d.deckerUuid, successes: Math.min(DECOY_MAX, whole(d.successes)), boxes: whole(d.boxes) }));
}
/** The decoys with this decker's new one (an empty monitor), replacing an older one; 0 successes: none. */
export function withDecoy(list: readonly Decoy97[], deckerUuid: string, successes: number): Decoy97[] {
  const rest = list.filter((d) => d.deckerUuid !== deckerUuid);
  const n = Math.min(DECOY_MAX, whole(successes));
  return n > 0 ? [...rest, { deckerUuid, successes: n, boxes: 0 }] : rest;
}
/** This decker's decoy on the host (null when none). */
export function decoyFor(list: readonly Decoy97[], deckerUuid: string): Decoy97 | null {
  return list.find((d) => d.deckerUuid === deckerUuid) ?? null;
}

// ---------------------------------------------------------------- Located icons (VR2 pp. 114–115, 117)

export interface Located97 { deckerUuid: string; uuids: string[] }
/** A host's located icons per decker, cleaned. */
export function locatedOf(raw: unknown): Located97[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((l: any) => l && uuidOk(l.deckerUuid) && Array.isArray(l.uuids))
    .map((l: any) => ({ deckerUuid: l.deckerUuid, uuids: [...new Set((l.uuids as unknown[]).filter(uuidOk))].slice(0, 100) }));
}
/** The records with these icons added to what the decker has located. */
export function withLocated(list: readonly Located97[], deckerUuid: string, uuids: readonly string[]): Located97[] {
  const had = list.find((l) => l.deckerUuid === deckerUuid)?.uuids ?? [];
  const next = [...new Set([...had, ...uuids.filter(uuidOk)])].slice(0, 100);
  return [...list.filter((l) => l.deckerUuid !== deckerUuid), { deckerUuid, uuids: next }];
}
/** What a decker has located on the host. */
export function locatedBy(list: readonly Located97[], deckerUuid: string): string[] {
  return list.find((l) => l.deckerUuid === deckerUuid)?.uuids ?? [];
}
/** The records once a decker has left the host: their own list gone, and nobody keeps them located. */
export function locatedWithout(list: readonly Located97[], uuid: string): Located97[] {
  return list.filter((l) => l.deckerUuid !== uuid).map((l) => ({ ...l, uuids: l.uuids.filter((u) => u !== uuid) }));
}

// ---------------------------------------------------------------- Dump Log (VR2 p. 113)

/** A host's Intrusion Difficulty from its Security Value (VR2 p. 31 assigned numbers; VERIFY: Easy to 6, Average to 9). */
export function intrusionDifficulty(securityValue: number): 'easy' | 'average' | 'hard' {
  const sv = whole(securityValue);
  return sv <= 6 ? 'easy' : sv <= 9 ? 'average' : 'hard';
}

/** A 24-hour log's size (VR2 p. 113): the multiplier (2D6 × 5 Easy, × 2 Average, × 1 Hard) × 100 Mp. */
export function logSize(securityValue: number, twoD6: number): number {
  const per = { easy: 5, average: 2, hard: 1 }[intrusionDifficulty(securityValue)];
  return whole(twoD6) * per * 100;
}

// ---------------------------------------------------------------- Validate Passcode (VR2 p. 118)

export interface Passcode97 { deckerUuid: string; from: number; days: number; level: string }
export const PASSCODE_LEVELS: readonly string[] = ['user', 'superuser', 'supervisor'];
/** The longest a passcode can last (VR2 p. 118: 1D6 × net successes; 6 × 30), whatever a card says. */
export const PASSCODE_MAX_DAYS = 180;
const DAY = 86400;

/** The TN modifier for the passcode's level (VR2 p. 118: superuser +2, supervisor +6); 0 under 'v965'. */
export function passcodeLevelTn(level: string): number {
  if (!on('validatePasscode')) return 0;
  return num((V().passcodeTn as Record<string, number>)[level], 0);
}

/** How many days a validated passcode lasts (VR2 p. 118): 1D6 × the net successes (at most 180); null under 'v965'. */
export function passcodeDays(d6: number, net: number): number | null {
  if (!on('validatePasscode')) return null;
  return Math.min(PASSCODE_MAX_DAYS, Math.max(1, whole(d6)) * whole(net));
}

/** A host's passcode records, cleaned (from its flag): days clamped. */
export function passcodesOf(raw: unknown): Passcode97[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p: any) => p && uuidOk(p.deckerUuid) && Number.isFinite(Number(p.from)))
    .map((p: any) => ({ deckerUuid: p.deckerUuid, from: Number(p.from), days: Math.min(PASSCODE_MAX_DAYS, whole(p.days)), level: PASSCODE_LEVELS.includes(p.level) ? p.level : 'user' }));
}

/** The records with this decker's passcode set (replacing an older one), from `now`. */
export function withPasscode(list: readonly Passcode97[], deckerUuid: string, days: number, level: string, now: number): Passcode97[] {
  const lv = PASSCODE_LEVELS.includes(level) ? level : 'user';
  return [...list.filter((x) => x.deckerUuid !== deckerUuid), { deckerUuid, from: num(now), days: Math.min(PASSCODE_MAX_DAYS, whole(days)), level: lv }];
}

/**
 * Whether a decker's validated passcode on the host still works at `now` (VR2 p. 118). Fails closed under the book:
 * no record (or one set in the future) is not a live passcode; the record and the host's validated list are written by
 * the same host change. Always live under 'v965'.
 */
export function passcodeLive(list: readonly Passcode97[], deckerUuid: string, now: number): boolean {
  if (!on('validatePasscode')) return true;
  const p = list.find((x) => x.deckerUuid === deckerUuid);
  if (!p) return false;
  const t = num(now);
  return p.from <= t + DAY && t < p.from + Math.min(PASSCODE_MAX_DAYS, p.days) * DAY;
}

/** Whether an alert deletes the passcodes of the deckers on the host (VR2 p. 118: an active alert does). */
export function alertKillsPasscodes(alert: string): boolean {
  return on('validatePasscode') && (alert === 'active' || alert === 'shutdown');
}

// ---------------------------------------------------------------- Slow (VR2 p. 99)

/** The IC behaviors that are reactive (VR2 pp. 40–45): Slow does not work on them. */
export const REACTIVE_IC: readonly string[] = ['probe', 'scramble', 'tarBaby', 'tarPit', 'barrier'];

/** Why Slow cannot hit this IC (a language key), or null (VR2 p. 99): reactive IC; trace IC once it has locked on. */
export function slowRefusal(o: { behavior: string; traceLocked: boolean }): string | null {
  if (!on('slow')) return null;
  if (REACTIVE_IC.includes(o.behavior)) return `${WHY}slowReactive`;
  if (o.behavior === 'trace' && o.traceLocked) return `${WHY}slowTrace`;
  return null;
}

/** Slow's effect (VR2 p. 99): an action (one Initiative pass) per 2 net successes over the IC's Resistance Test. */
export function slowBook(successes: number, resistance: number): { net: number; actions: number; initiative: number } {
  const net = Math.max(0, whole(successes) - whole(resistance));
  const actions = Math.floor(net / 2);
  return { net, actions, initiative: actions * Math.max(1, whole(V().slowPerAction)) };
}

// ---------------------------------------------------------------- Restore (VR2 p. 100)

/** Restore's TN (VR2 p. 100): the highest rating of the programs that did the damage (`fallback` when none is known). */
export function restoreTn(ratings: readonly number[], fallback: number): number {
  const r = ratings.map(whole).filter((x) => x > 0);
  return Math.max(RULES.MIN_TARGET_NUMBER, r.length ? Math.max(...r) : whole(fallback));
}

/** The points a Restore Test mends (VR2 p. 100): one per 2 successes. */
export function restorePoints(successes: number): number {
  return Math.floor(whole(successes) / 2);
}

/** The highest crippler rating to remember (the damage is new when nothing was crippled before). */
export function crippledBy(before: Record<string, number> | null | undefined, previous: number, rating: number): number {
  const fresh = !before || Object.values(before).every((v) => !(Number(v) > 0));
  return fresh ? whole(rating) : Math.max(whole(previous), whole(rating));
}

// ---------------------------------------------------------------- Interrogations (VR2 p. 110)

/** The interrogation operations (VR2 pp. 110–117, the table's mark): the query modifier applies to these. */
export const INTERROGATIONS: readonly string[] = ['locateFile', 'locatePaydata', 'locateSlave', 'locateNumber', 'dumpLog97'];

/** The TN modifier for how the question is put (VR2 p. 110); 0 under 'v965' or for another operation. */
export function queryTn(effect: string, query: string): number {
  if (!on('interrogation') || !INTERROGATIONS.includes(effect)) return 0;
  const n = num((V().queryTn as Record<string, number>)[query], 0);
  // Locate Access Node (VR2 p. 114) runs from +1 to −1.
  return effect === 'locateNumber' ? Math.max(-1, Math.min(1, n)) : n;
}

/** Whether the host says it holds nothing more (VR2 p. 110): 3+ successes counted and nothing left to find. */
export function notThere(total: number, leftToFind: number): boolean {
  return on('interrogation') && whole(total) >= Math.max(1, whole(V().notThereAt)) && whole(leftToFind) === 0;
}
