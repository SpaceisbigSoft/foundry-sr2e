import { RULES, type DamageLevel } from './config.ts';
import { woundLevel } from './core.ts';
import type { TargetNumberModifier } from './dice.ts';
import { combatStamp, levelIndex, sameCombatRound, type Clock, type ClockDue, own } from './util.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

/** Utility programs a decker can load. 'attack' utilities deal damage in cybercombat. */
export const UTILITY_KINDS = [
  'attack', 'sleaze', 'deception', 'analyze', 'browse', 'decrypt', 'evaluate', 'read/write', 'relocate',
  'medic', 'mirrors', 'shield', 'smoke', 'spoof', 'validate', 'track', 'armor', 'cloak', 'lock-on', 'frame', 'smart-frame', 'agent', 'other',
  // v0.57.0
  'slow', 'restore',
] as const;
export type UtilityKind = (typeof UTILITY_KINDS)[number];

/** IC categories: white and gray IC attack the persona; black IC attack the decker. */
export const IC_CATEGORIES = ['white', 'gray', 'black'] as const;
export type IcCategory = (typeof IC_CATEGORIES)[number];

export type Subsystem = 'access' | 'control' | 'index' | 'files' | 'slave';
export type SecurityCode = 'blue' | 'green' | 'orange' | 'red' | 'black';
export type AlertLevel = 'none' | 'passive' | 'active' | 'shutdown';

export interface Deck {
  mpcp: number;
  bod: number;
  evasion: number;
  masking: number;
  sensors: number;
  hardening: number;
  responseIncrease: number;
  activeMemory: number;
}

export interface Program {
  kind: string;
  rating: number;
  size: number;
  loaded: boolean;
  damageLevel?: string;
  /** Erased by tar pit: cannot be loaded until restored. */
  erased?: boolean;
  /** v0.49.0: an otaku's complex form (no memory), and program options written into it. */
  complexForm?: boolean;
  options?: readonly string[];
}

/** Hacking Pool: (Intelligence + MPCP) / 3, rounded down. VERIFY */
export function hackingPool(intelligence: number, mpcp: number): number {
  return Math.max(0, Math.floor((Math.max(0, intelligence) + Math.max(0, mpcp)) / RULES.MATRIX.hackingPoolDivisor));
}

/** Response Increase actually counted (0 to the configured maximum). */
function responseLevel(responseIncrease: number): number {
  return Math.max(0, Math.min(RULES.MATRIX.maxResponseIncrease, Math.floor(responseIncrease || 0)));
}

/** Matrix Reaction: Intelligence + 2 per level of Response Increase. VERIFY */
export function matrixReaction(intelligence: number, responseIncrease: number): number {
  return Math.max(0, intelligence) + RULES.MATRIX.reactionPerResponse * responseLevel(responseIncrease);
}

/** Matrix initiative dice: 1 + Response Increase. VERIFY */
export function matrixInitiativeDice(responseIncrease: number): number {
  return RULES.MATRIX.baseInitiativeDice + responseLevel(responseIncrease);
}

/** Problems with a deck's persona programs (each at most MPCP; together at most 3 x MPCP). */
export function personaWarnings(deck: Deck): string[] {
  const out: string[] = [];
  const parts: Array<[string, number]> = [['Bod', deck.bod], ['Evasion', deck.evasion], ['Masking', deck.masking], ['Sensors', deck.sensors]];
  for (const [name, v] of parts) if (v > deck.mpcp) out.push(tx('SR2E.Text.Matrix.isAboveMpcp', { name, value: v, mpcp: deck.mpcp }));
  const total = parts.reduce((s, [, v]) => s + v, 0);
  const max = deck.mpcp * RULES.MATRIX.personaTotalPerMpcp;
  if (total > max) out.push(tx('SR2E.Text.Matrix.personaTotalIsAbove', { total, max, per: RULES.MATRIX.personaTotalPerMpcp }));
  if (deck.responseIncrease > RULES.MATRIX.maxResponseIncrease) out.push(tx('SR2E.Text.Matrix.responseIncreaseCountsOnly', { max: RULES.MATRIX.maxResponseIncrease }));
  return out;
}

/** Active memory used by loaded programs. */
export function memoryUse(programs: readonly Program[], activeMemory: number): { used: number; free: number; over: boolean } {
  const free = (p: Program) => Boolean(p.complexForm) && RULES.MATRIX.otaku.complexForms.noMemory;
  const used = programs.filter((p) => p.loaded && !p.erased && !free(p)).reduce((s, p) => s + Math.max(0, programSize(p)), 0);
  return { used, free: activeMemory - used, over: used > activeMemory };
}

/** The best loaded utility of a kind (rating 0 if none is loaded). */
export function loadedUtility<T extends Program>(programs: readonly T[], kind: string): T | null {
  return programs.filter((p) => p.loaded && !p.erased && p.kind === kind).sort((a, b) => b.rating - a.rating)[0] ?? null;
}

/** Detection Factor: (Masking + Sleaze) / 2, rounded up. VERIFY */
export function detectionFactor(masking: number, sleaze: number): number {
  const half = (Math.max(0, masking) + Math.max(0, sleaze)) / 2;
  return Math.max(RULES.MIN_TARGET_NUMBER, RULES.MATRIX.detectionRounding === 'up' ? Math.ceil(half) : Math.floor(half));
}

/** TN modifiers for a system test from the utility used (lowers the subsystem rating). VERIFY */
export function utilityModifiers(utility: { name: string; rating: number } | null): TargetNumberModifier[] {
  if (!utility || !RULES.MATRIX.utilityLowersTn || !(utility.rating > 0)) return [];
  return [{ label: utility.name, value: -utility.rating }];
}

/** Boxes on the Matrix condition monitor after damage, and whether it crashed. */
export function applyMatrixDamage(before: number, level: DamageLevel | null): { after: number; boxes: number; crashed: boolean } {
  const max = RULES.MATRIX.monitorBoxes;
  const boxes = level ? RULES.BOXES_PER_LEVEL[level] : 0;
  const after = Math.min(max, Math.max(0, before) + boxes);
  return { after, boxes, crashed: after >= max };
}

export function matrixCrashed(monitor: number): boolean {
  return monitor >= RULES.MATRIX.monitorBoxes;
}

/** A step of a host's security sheaf: when the tally reaches `step`, the event happens. */
export interface SheafStep {
  step: number;
  event: string;
  /** Raise the host's alert to this level ('' = no change). */
  alert: AlertLevel | '';
}

/** Add host successes to the security tally; return the new tally and the sheaf steps it crossed. */
export function advanceTally(before: number, successes: number, sheaf: readonly SheafStep[]): { tally: number; triggered: SheafStep[] } {
  const tally = Math.max(0, before) + Math.max(0, successes);
  const triggered = sheaf.filter((s) => s.step > before && s.step <= tally).sort((a, b) => a.step - b.step);
  return { tally, triggered };
}

/** The alert level after some steps trigger: alerts only ever go up. */
export function raiseAlert(current: AlertLevel, triggered: readonly SheafStep[]): AlertLevel {
  const order = RULES.MATRIX.alerts;
  let i = order.indexOf(current);
  for (const s of triggered) if (s.alert) i = Math.max(i, order.indexOf(s.alert));
  return order[Math.max(0, i)] as AlertLevel;
}

/** The next sheaf step still to come, or null. */
export function nextSheafStep(tally: number, sheaf: readonly SheafStep[]): SheafStep | null {
  return [...sheaf].filter((s) => s.step > tally).sort((a, b) => a.step - b.step)[0] ?? null;
}

/** IC initiative dice for a host's security code. VERIFY */
export function icInitiativeDice(code: string): number {
  return own(RULES.MATRIX.icInitiativeDice, code) ?? 1;
}

// ---------------------------------------------------------------- Matrix depth (v0.27.0)

/** What an IC does when it acts (RULES.MATRIX.icAttackTn and the notes there). */
export const IC_BEHAVIORS = ['killer', 'blaster', 'sparky', 'psychotropic', 'probe', 'scout', 'trace', 'tarBaby', 'tarPit', 'crippler', 'ripper', 'barrier', 'scramble', 'other'] as const;
export type IcBehavior = (typeof IC_BEHAVIORS)[number];
export const IC_BEHAVIOR_LABELS: Record<IcBehavior, string> = {
  killer: 'Killer', blaster: 'Blaster', sparky: 'Sparky', psychotropic: 'Psychotropic', probe: 'Probe', scout: 'Scout', trace: 'Trace',
  tarBaby: 'Tar baby', tarPit: 'Tar pit', crippler: 'Crippler', ripper: 'Ripper', barrier: 'Barrier', scramble: 'Scramble', other: 'Other',
};
export const TRACE_MODES = ['dump', 'report', 'burn'] as const;
export type TraceMode = (typeof TRACE_MODES)[number];
export const PERSONA_ATTRIBUTES = ['bod', 'evasion', 'masking', 'sensors'] as const;
export type PersonaAttribute = (typeof PERSONA_ATTRIBUTES)[number];

/** Guess an IC behavior from its type name (e.g. "Trace and Dump" → trace), else null. */
export function behaviorFromName(name: string): IcBehavior | null {
  const n = String(name ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (!n) return null;
  if (n.startsWith('tarbaby')) return 'tarBaby';
  if (n.startsWith('tarpit')) return 'tarPit';
  for (const b of IC_BEHAVIORS) if (n.startsWith(b.toLowerCase())) return b;
  if (n.startsWith('access')) return 'barrier';
  if (/^(cyberphobia|frenzy|judas|positiveconditioning|conditioning)/.test(n)) return 'psychotropic';
  return null;
}

/** How an IC's action works: damage, the tally, a persona program, a utility, a trace, or nothing (guards). */
export function icActionKind(b: string): 'damage' | 'tally' | 'attribute' | 'utility' | 'trace' | 'passive' | 'report' {
  switch (b) {
    case 'killer': case 'blaster': case 'sparky': case 'psychotropic': return 'damage';
    case 'probe': case 'scout': return 'tally';
    case 'crippler': case 'ripper': return 'attribute';
    case 'tarBaby': case 'tarPit': return 'utility';
    case 'trace': return 'trace';
    case 'barrier': case 'scramble': return 'passive';
    default: return 'report';
  }
}

/** Persona values as the IC sees them. */
export interface PersonaView { evasion: number; masking: number; detectionFactor: number; bod: number; sensors: number }

/** The TN an IC's action rolls against, and a label for the card. */
export function icActionTarget(b: string, persona: PersonaView, opts: { attribute?: string; utilityRating?: number } = {}): { tn: number; label: string } {
  const from = own(RULES.MATRIX.icAttackTn, b) ?? 'evasion';
  const min = RULES.MIN_TARGET_NUMBER;
  if (from === 'attribute') {
    const a = (PERSONA_ATTRIBUTES as readonly string[]).includes(opts.attribute ?? '') ? opts.attribute as PersonaAttribute : 'evasion';
    return { tn: Math.max(min, persona[a] ?? 0), label: tx('SR2E.Text.Matrix.thePersonasAttribute', { attribute: a.charAt(0).toUpperCase() + a.slice(1) }) };
  }
  if (from === 'utility') return { tn: Math.max(min, opts.utilityRating ?? 0), label: tx('SR2E.Text.Matrix.theUtilitysRating') };
  if (from === 'detectionFactor') return { tn: Math.max(min, persona.detectionFactor), label: tx('SR2E.Text.Matrix.theDetectionFactor') };
  if (from === 'masking') return { tn: Math.max(min, persona.masking), label: tx('SR2E.Text.Matrix.thePersonasMasking') };
  return { tn: Math.max(min, persona.evasion), label: tx('SR2E.Text.Matrix.thePersonasEvasion') };
}

/** Points a crippler or ripper takes off a persona program for its net successes. */
export function personaAttributeLoss(net: number): number {
  if (!(net > 0)) return 0;
  const a = RULES.MATRIX.attributeDamage;
  return Math.max(a.minOnHit, Math.floor(net / Math.max(1, a.successesPerPoint)));
}

/** Combat Turns until a trace completes, for its net successes (null: no lock). */
export function traceTurns(net: number): number | null {
  if (!(net > 0)) return null;
  return Math.max(1, Math.ceil(RULES.MATRIX.trace.baseTurns / net));
}

/** When a trace started now completes: a Combat Turn number in combat (and v0.81.0 the combat's id), and a world time either way. */
export function traceDue(o: { round: number | null; worldTime: number; turns: number; combatId?: string | null }): ClockDue {
  return {
    round: o.round != null ? o.round + o.turns : -1,
    worldTime: o.worldTime + o.turns * RULES.MATRIX.trace.secondsPerTurn,
    ...combatStamp(o),
  };
}

/** Whether a trace is complete (by Combat Turn in the combat it started in, or by world time). */
export function traceComplete(t: { round: number; worldTime: number; combatId?: string }, now: { round?: number | null; worldTime?: number; combatId?: string | null }): boolean {
  const byRound = sameCombatRound(t, now) && now.round! >= t.round;
  const byTime = t.worldTime >= 0 && now.worldTime != null && now.worldTime >= t.worldTime;
  return byRound || byTime;
}

/** MPCP damage from a blaster/sparky crash or a trace and burn: IC successes vs TN = MPCP. */
export function mpcpDamage(successes: number): number {
  return Math.max(0, Math.floor(Math.max(0, successes) / Math.max(1, RULES.MATRIX.mpcpDamage.successesPerPoint)));
}

export interface DeckDamage { mpcp: number; bod: number; evasion: number; masking: number; sensors: number }
export const NO_DECK_DAMAGE: DeckDamage = { mpcp: 0, bod: 0, evasion: 0, masking: 0, sensors: 0 };

/** v0.71.0 (R7): whether programs and persona values are capped at the (damaged) MPCP (RULES.FIXES_V71.mpcpCaps 'cap'). */
export function mpcpCapsOn(): boolean {
  return RULES.FIXES_V71.mpcpCaps !== 'warn';
}

/**
 * The deck's working values after damage to the deck (ripper, blaster) and temporary crippling.
 * v0.71.0 (R7): with RULES.FIXES_V71.mpcpCaps 'cap' (or `opts.cap`), each persona program (Bod,
 * Evasion, Masking, Sensors) is also capped at the working (damaged) MPCP, so MPCP 6→3 drops a Bod of
 * 6 to 3. `capped` names the persona values the cap lowered. VERIFY (SR2/VR2: persona programs ≤ MPCP).
 */
export function effectivePersona<T extends Deck>(deck: T, damage: Partial<DeckDamage> = {}, crippled: Partial<DeckDamage> = {}, opts: { cap?: boolean } = {}): T & { damaged: boolean; capped: PersonaAttribute[] } {
  const v = (k: keyof DeckDamage) => Math.max(0, (deck[k] ?? 0) - Math.max(0, damage[k] ?? 0) - Math.max(0, crippled[k] ?? 0));
  const damaged = (Object.keys(NO_DECK_DAMAGE) as Array<keyof DeckDamage>).some((k) => (damage[k] ?? 0) > 0 || (crippled[k] ?? 0) > 0);
  const mpcp = v('mpcp');
  const cap = opts.cap ?? mpcpCapsOn();
  const capped: PersonaAttribute[] = [];
  const p = (k: PersonaAttribute) => {
    const x = v(k);
    if (cap && x > mpcp) { capped.push(k); return mpcp; }
    return x;
  };
  return { ...deck, mpcp, bod: p('bod'), evasion: p('evasion'), masking: p('masking'), sensors: p('sensors'), damaged, capped };
}

/**
 * v0.71.0 (R7): the rating a program actually runs at on a deck with this working (damaged) MPCP.
 * With mpcpCaps 'cap' a program rated above the MPCP runs at the MPCP (capped true); with 'warn' the
 * rating is unchanged (capped false). VERIFY (SR2/VR2: a deck can't run a program above its MPCP).
 */
export function programRunRating(rating: number, effectiveMpcp: number, opts: { cap?: boolean } = {}): { rating: number; capped: boolean } {
  const r = Math.max(0, Math.floor(Number(rating) || 0));
  const m = Math.max(0, Math.floor(Number(effectiveMpcp) || 0));
  if (!(opts.cap ?? mpcpCapsOn()) || r <= m) return { rating: r, capped: false };
  return { rating: m, capped: true };
}

/** v0.71.0 (R7): a loaded program rated above the working MPCP, and the rating it runs at. */
export interface ProgramOverMpcp { id: string; name: string; kind: string; rating: number; runs: number }

/**
 * v0.71.0 (R7): the loaded (not erased) programs rated above the working MPCP, whatever the switch
 * (with 'warn', `runs` = the rating). Pass the deck's effective MPCP (derived.matrix.mpcp).
 */
export function programsOverMpcp(programs: ReadonlyArray<{ id?: string; name?: string; kind: string; rating: number; loaded: boolean; erased?: boolean }>, effectiveMpcp: number, opts: { cap?: boolean } = {}): ProgramOverMpcp[] {
  const m = Math.max(0, Math.floor(Number(effectiveMpcp) || 0));
  return programs.filter((p) => p.loaded && !p.erased && (Number(p.rating) || 0) > m)
    .map((p) => ({ id: p.id ?? '', name: p.name ?? p.kind, kind: p.kind, rating: Number(p.rating) || 0, runs: programRunRating(p.rating, m, opts).rating }));
}

/** v0.71.0 (R7): one warning line per program over the working MPCP ("Attack 8 runs at MPCP 4"). */
export function mpcpProgramWarnings(over: readonly ProgramOverMpcp[], effectiveMpcp: number, opts: { cap?: boolean } = {}): string[] {
  const cap = opts.cap ?? mpcpCapsOn();
  return over.map((p) => cap ? tx('SR2E.Text.Matrix.runsAtMpcp', { name: p.name, rating: p.rating, runs: p.runs, mpcp: effectiveMpcp }) : tx('SR2E.Text.Matrix.isAboveMpcp', { name: p.name, value: p.rating, mpcp: effectiveMpcp }));
}

/**
 * v0.71.0 (R8): whether a program can be loaded into active memory. `state` is what memoryUse reads
 * (the active memory and every program, loaded or not); `unloading` are programs being swapped out in
 * the same go (matched by `id`, else by identity) and free their memory first. With
 * RULES.FIXES_V71.activeMemory 'warn' (or `opts.mode`) it is always ok, with a `reason` note when it
 * doesn't fit. `free` is the memory free before loading (after unloading); `need` the program's size.
 * An already loaded program, or a complex form that takes no memory, always fits.
 */
export function canLoadProgram(
  state: { activeMemory: number; programs: readonly Program[] },
  program: Program & { id?: string; name?: string },
  opts: { unloading?: ReadonlyArray<Program & { id?: string }>; mode?: 'block' | 'warn' } = {},
): { ok: boolean; reason?: string; free: number; need: number } {
  const mode = opts.mode ?? (RULES.FIXES_V71.activeMemory === 'warn' ? 'warn' : 'block');
  const out = opts.unloading ?? [];
  const isOut = (p: Program & { id?: string }) => out.some((u) => u === p || (u.id != null && p.id != null && u.id === p.id));
  const isSelf = (p: Program & { id?: string }) => p === program || (program.id != null && p.id != null && p.id === program.id);
  const rest = state.programs.filter((p) => !isOut(p) && !isSelf(p));
  const free = memoryUse(rest, Math.max(0, Number(state.activeMemory) || 0)).free;
  const noMemory = Boolean(program.complexForm) && RULES.MATRIX.otaku.complexForms.noMemory;
  const need = noMemory ? 0 : Math.max(0, programSize(program));
  if (need <= free) return { ok: true, free, need };
  const label = program.name ?? program.kind;
  return mode === 'warn'
    ? { ok: true, reason: tCount(Math.max(0, free), 'SR2E.Text.Matrix.needsMpOverActiveMemory', { label, need, free: Math.max(0, free) }), free, need }
    : { ok: false, reason: tCount(Math.max(0, free), 'SR2E.Text.Matrix.needsMpUnloadFirst', { label, need, free: Math.max(0, free) }), free, need };
}

/** Repairing a deck: which damage points each success fixes, MPCP first. */
export function repairDeck(damage: DeckDamage, successes: number): { after: DeckDamage; repaired: number } {
  let left = Math.max(0, successes) * RULES.MATRIX.repair.pointsPerSuccess;
  const after = { ...damage };
  let repaired = 0;
  for (const k of ['mpcp', 'bod', 'evasion', 'masking', 'sensors'] as const) {
    const fix = Math.min(left, Math.max(0, after[k]));
    after[k] -= fix; left -= fix; repaired += fix;
  }
  return { after, repaired };
}

/** A utility's size from the book's formula: rating² × the kind's multiplier. */
export function utilitySize(kind: string, rating: number, damageLevel = 'M'): number {
  const u = RULES.MATRIX.utilitySize;
  const mult = kind === 'attack' ? (own(u.attack, damageLevel) ?? 0) : (own(u.kinds, kind) ?? 0);
  const r = Math.max(0, Math.floor(rating || 0));
  return r * r * mult;
}

/** v0.49.0: the size multiplier of the program options written into a program (RULES.MATRIX.programming.options). */
export function optionSizeMultiplier(ids: readonly string[] | null | undefined): number {
  const list = RULES.MATRIX.programming.options;
  return [...new Set(ids ?? [])].reduce((m, id) => m * (list.find((o) => o.id === id)?.size ?? 1), 1);
}

/** A program's memory: its own Size, or the book formula when that is 0 (with its options, v0.49.0). */
export function programSize(p: { kind: string; rating: number; size: number; damageLevel?: string; options?: readonly string[] }): number {
  if (p.size > 0) return p.size;
  const base = utilitySize(p.kind, p.rating, p.damageLevel);
  return base > 0 && p.options?.length ? Math.max(1, Math.ceil(base * optionSizeMultiplier(p.options))) : base;
}

/** Medic: the TN for the persona's current damage, and the boxes repaired. */
export function medicTarget(boxes: number): { tn: number; level: DamageLevel | null } {
  const level = woundLevel(boxes);
  // `?? 4`: a guard for an override that drops a level from tnByLevel. Undamaged: the floor TN (nothing to repair).
  return { tn: level ? (own(RULES.MATRIX.medic.tnByLevel, level) ?? 4) : RULES.MIN_TARGET_NUMBER, level };
}
export function medicRepair(boxes: number, successes: number): { after: number; repaired: number } {
  const repaired = Math.min(Math.max(0, boxes), Math.max(0, successes) * RULES.MATRIX.medic.boxesPerSuccess);
  return { after: Math.max(0, boxes) - repaired, repaired };
}

export type OperationDef = (typeof RULES.MATRIX.operations)[number];

/** A system operation by id (null if unknown). */
export function operation(id: string | null | undefined): OperationDef | null {
  return RULES.MATRIX.operations.find((o) => o.id === id) ?? null;
}

/** A file in a host's data stores. */
export interface DataFile {
  id: string; name: string; size: number; value: number; paydata: boolean;
  /** Encryption rating (0 = none) and scramble IC rating (0 = none) protecting it. */
  encrypted: number; scramble: number;
  /** Deckers (actor UUIDs) who have located it. */
  foundBy: string[];
  /** v0.46.0: who edited it and how; who uploaded it. */
  edited?: string;
  uploadedBy?: string;
  /** v0.57.0: a data bomb's rating (0 = none), a Pavlov bomb, and who has scanned it. */
  bomb?: number;
  pavlov?: boolean;
  bombFoundBy?: string[];
}

/** Locate File / Locate Paydata: each success finds one more file this decker has not found yet. */
export function locateFiles(files: readonly DataFile[], deckerUuid: string, successes: number, paydataOnly: boolean): string[] {
  return files.filter((f) => (!paydataOnly || f.paydata) && !f.foundBy.includes(deckerUuid)).slice(0, Math.max(0, successes)).map((f) => f.id);
}

/** Combat Turns a download takes at the deck's I/O speed. */
export function downloadTurns(size: number, ioSpeed: number): number {
  const rate = Math.max(1, ioSpeed) * RULES.MATRIX.download.ioPerTurn;
  return Math.max(1, Math.ceil(Math.max(0, size) / rate));
}

/**
 * Paydata for a host's security code, from rolled dice: `points` (the Nd6 for the number of
 * files), then per file `sizes` (sizeDice d6 each) and one `defense` d6.
 */
export function paydataCount(code: string, pointDice: readonly number[]): number {
  const c = own(RULES.MATRIX.paydata.codes, code) ?? RULES.MATRIX.paydata.codes['orange']!;
  return Math.max(0, pointDice.slice(0, c.pointsDice).reduce((a, b) => a + b, 0) + c.pointsMod);
}
/**
 * One paydata file: size from its size dice, value per Mp by code, and its defense from the defense d6: up to
 * plainUpTo none, up to encryptedUpTo encrypted, above that scramble IC (which then replaces the encryption, so
 * a file has one defense, rated at the Security Value).
 */
export function paydataFile(code: string, securityValue: number, sizeDice: readonly number[], defenseDie: number, n: number): Omit<DataFile, 'id' | 'foundBy'> {
  const p = RULES.MATRIX.paydata;
  const c = p.codes[code] ?? p.codes['orange']!;
  const size = sizeDice.slice(0, c.sizeDice).reduce((a, b) => a + b, 0) * c.sizeMultiplier;
  const encrypted = defenseDie > p.plainUpTo ? Math.max(1, securityValue) : 0;
  const scramble = defenseDie > p.encryptedUpTo ? Math.max(1, securityValue) : 0;
  return { name: `Paydata ${n}`, size, value: size * c.valuePerMp, paydata: true, encrypted: scramble ? 0 : encrypted, scramble };
}

/** A live guard IC on a subsystem that this decker has not got past (or null). */
export function guardingIc<T extends { uuid: string; behavior: string; guards: string; crashed: boolean }>(ic: readonly T[], subsystem: string, passed: readonly string[]): T | null {
  return ic.find((i) => i.behavior === 'barrier' && i.guards === subsystem && !i.crashed && !passed.includes(i.uuid)) ?? null;
}

// ---------------------------------------------------------------- The grid, sims, frames, connections (v0.28.0)

export type GridKind = 'host' | 'ltg' | 'rtg';
export interface GridNode { uuid: string; gridKind: GridKind; parentUuid: string }

/**
 * Whether a decker at `from` ('' = not in any node, i.e. at a jackpoint) can log on to `to`:
 * its parent, its children, a node with no parent, or (from outside) any LTG or RTG.
 */
export function gridReachable(from: GridNode | null, to: GridNode): boolean {
  if (!to.parentUuid) return true;
  if (!from) return to.gridKind !== 'host';
  return to.parentUuid === from.uuid || from.parentUuid === to.uuid || to.uuid === from.uuid;
}

/** The route up from a node to the top of its grid (node first). */
export function gridPath(start: GridNode, nodes: readonly GridNode[]): GridNode[] {
  const out: GridNode[] = [start];
  let cur = start;
  // 10: a guard against a malformed (very deep or looping) grid, not a rule.
  while (cur.parentUuid && out.length < 10) {
    const p = nodes.find((n) => n.uuid === cur.parentUuid);
    if (!p || out.some((n) => n.uuid === p.uuid)) break;
    out.push(p); cur = p;
  }
  return out;
}

/** Hot sim changes: extra initiative dice. */
export function simInitiativeDice(sim: string): number {
  return sim === 'hot' ? RULES.MATRIX.sim.hot.initiativeDice : 0;
}

/** Whether Matrix damage at this level calls for a simsense overload test (hot sim only). */
export function simsenseOverload(sim: string, level: DamageLevel | null): boolean {
  if (sim !== 'hot' || !level) return false;
  return levelIndex(level) >= levelIndex(RULES.MATRIX.sim.hot.overloadAt);
}

/** The damage type of dump shock and of black IC for a sim mode. */
export function dumpShockType(sim: string): 'physical' | 'stun' {
  return sim === 'hot' ? RULES.MATRIX.sim.hot.dumpShockType : 'stun';
}
export function blackIcDamageType(sim: string, type: 'physical' | 'stun'): 'physical' | 'stun' {
  return sim === 'cold' && RULES.MATRIX.sim.cold.coldBlackIcStun ? 'stun' : type;
}

/** A frame's dice: its core rating, plus pool dice for a smart frame. */
export function frameDice(rating: number, smart: boolean): { dice: number; pool: number } {
  const r = Math.max(0, Math.floor(rating || 0));
  return { dice: r, pool: smart ? Math.floor(r * RULES.MATRIX.frames.smartPoolPerRating) : 0 };
}

/** TN modifiers from how the decker connects (and from a moving vehicle they are aboard). */
export function connectionModifiers(connection: string, movingVehicle: boolean): Array<{ id?: string; label: string; value: number }> {
  const out: Array<{ id?: string; label: string; value: number }> = [];
  const c = RULES.MATRIX.connections.find((x) => x.id === connection);
  if (c && c.tn) out.push({ label: c.label, value: c.tn });
  if (movingVehicle && RULES.MATRIX.movingVehicle) out.push({ id: 'movingVehicle', label: tx('SR2E.Card.Mod.movingVehicle'), value: RULES.MATRIX.movingVehicle });
  return out;
}

// ---------------------------------------------------------------- Matrix leftovers (v0.40.0)

export type PsychotropicKind = 'cyberphobia' | 'frenzy' | 'judas' | 'conditioning';
export const PSYCHOTROPIC_LABELS: Record<PsychotropicKind, string> = {
  cyberphobia: 'Cyberphobia', frenzy: 'Frenzy', judas: 'Judas', conditioning: 'Positive conditioning',
};
/** A psychotropic effect on a decker: until a world time (−1: until they jack out). */
export interface PsycheEffect { kind: string; icName: string; rating: number; until: number }

/** Guess a psychotropic payload from an IC's name (e.g. "Judas-6"), else cyberphobia. */
export function psychotropicKindFromName(name: string): PsychotropicKind {
  const n = String(name ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (n.includes('frenzy')) return 'frenzy';
  if (n.includes('judas')) return 'judas';
  if (n.includes('conditioning')) return 'conditioning';
  return 'cyberphobia';
}

/** The effect a failed psychotropic test leaves: frenzy lasts the run, the rest rating × days. */
export function psychotropicEffect(kind: string, icName: string, rating: number, worldTime: number): PsycheEffect {
  const days = Math.max(1, Math.floor(rating || 0)) * Math.max(0, RULES.MATRIX.psychotropic.daysPerRating);
  return { kind, icName, rating, until: kind === 'frenzy' ? -1 : worldTime + days * 86400 };
}

/** Psychotropic effects still in force at a world time (−1 ones last until jacking out). */
export function activePsyche(list: readonly PsycheEffect[], worldTime: number): PsycheEffect[] {
  return list.filter((e) => e.until < 0 || e.until > worldTime);
}

/** TN modifiers on Matrix tests from psychotropic effects (cyberphobia). */
export function psycheModifiers(list: readonly PsycheEffect[], worldTime: number): TargetNumberModifier[] {
  const phobia = activePsyche(list, worldTime).some((e) => e.kind === 'cyberphobia');
  return phobia && RULES.MATRIX.psychotropic.cyberphobiaTn ? [{ id: 'cyberphobia', label: tx('SR2E.Card.Mod.cyberphobia'), value: RULES.MATRIX.psychotropic.cyberphobiaTn }] : [];
}

/** rating × per, rounded down, at least 1 (0 for no rating). */
function perRating(rating: number, per: number): number {
  const r = Math.max(0, Math.floor(rating || 0));
  return r > 0 ? Math.max(1, Math.floor(r * per)) : 0;
}

/** Mirrors: the TN added to attacks against the persona's Evasion. */
export function mirrorsTn(rating: number): number {
  return perRating(rating, RULES.MATRIX.utilities.mirrors.tnPerRating);
}

/** Smoke: the TN added to Matrix tests in the host, and how long it lasts. */
export function smokeTn(rating: number): number {
  return perRating(rating, RULES.MATRIX.utilities.smoke.tnPerRating);
}
export function smokeTurns(rating: number): number {
  return Math.max(1, Math.floor(Math.max(0, rating || 0) * RULES.MATRIX.utilities.smoke.turnsPerRating));
}

/** A smoke cloud in a host: its TN, and when it clears (Combat Turn in combat, else world time). */
export interface SmokeCloud { rating: number; tn: number; by: string; round: number; worldTime: number; /** v0.81.0: the combat `round` belongs to. */ combatId?: string }
/** A new smoke cloud released now by `by`: it lasts smokeTurns(rating) Combat Turns (or their seconds out of combat). */
export function smokeCloud(rating: number, by: string, now: Clock): SmokeCloud {
  const turns = smokeTurns(rating);
  return { rating, tn: smokeTn(rating), by, round: now.round != null ? now.round + turns : -1, worldTime: now.worldTime + turns * RULES.MATRIX.utilities.smoke.secondsPerTurn, ...combatStamp(now) };
}
/** Whether a smoke cloud still hangs in the host: it has a TN and its end (same test as a trace's) hasn't come. */
export function smokeActive(c: SmokeCloud | null | undefined, now: { round?: number | null; worldTime?: number; combatId?: string | null }): boolean {
  if (!c || !(c.tn > 0)) return false;
  return !traceComplete(c, now);
}

/** Matrix damage Power after Hardening and a soaking utility (Armor, or Shield vs black IC). */
export function matrixSoakTn(power: number, hardening: number, utilityRating: number): number {
  return Math.max(RULES.MIN_TARGET_NUMBER, power - Math.max(0, hardening) - Math.max(0, utilityRating));
}

/** How many utilities a frame or agent of this rating can carry. */
export function carryLimit(rating: number): number {
  return Math.max(0, Math.floor(Math.max(0, rating || 0) * RULES.MATRIX.carry.carryPerRating));
}

/** An agent's dice: rating plus its pool. */
export function agentDice(rating: number): { dice: number; pool: number } {
  const r = Math.max(0, Math.floor(rating || 0));
  return { dice: r, pool: Math.floor(r * RULES.MATRIX.agents.poolPerRating) };
}

/** An agent's own Detection Factor: (rating + carried Sleaze) ÷ 2. */
export function agentDetectionFactor(rating: number, sleaze: number): number {
  return detectionFactor(rating, sleaze);
}

/**
 * Hops between grids on the route from one node to another (through their common grid):
 * only edges joining two grids (LTG/RTG) count; a host and its own grid are next door.
 */
export function gridHops(from: GridNode | null, to: GridNode, nodes: readonly GridNode[]): number {
  if (!from) return 0;
  const up = (n: GridNode) => gridPath(n, nodes);
  const a = up(from), b = up(to);
  const common = a.find((n) => b.some((m) => m.uuid === n.uuid));
  // No common grid: count both routes to their tops, plus a hop between the tops.
  const legA = common ? a.slice(0, a.findIndex((n) => n.uuid === common.uuid) + 1) : a;
  const legB = common ? b.slice(0, b.findIndex((n) => n.uuid === common.uuid) + 1) : b;
  const isGrid = (n: GridNode) => n.gridKind !== 'host';
  const count = (leg: GridNode[]) => leg.slice(1).filter((n, i) => isGrid(n) && isGrid(leg[i]!)).length;
  let hops = count(legA) + count(legB);
  if (!common) {
    const ta = legA.at(-1)!, tb = legB.at(-1)!;
    if (isGrid(ta) && isGrid(tb)) hops += 1;
  }
  return hops;
}

/** Combat Turns of grid travel for some hops. */
export function travelTurns(hops: number): number {
  return Math.max(0, Math.floor(hops)) * Math.max(0, RULES.MATRIX.travel.turnsPerHop);
}
