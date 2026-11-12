/**
 * The Matrix, v0.57.0 ("data war"): per-decker tallies, utility loading, Matrix wounds, black IC
 * holds, host shutdown, perception, cybercombat maneuvers, utilities, data bombs, comcalls,
 * reality filters, hitcher jacks and chips. Pure rules, no Foundry. Every value is read from
 * RULES.MATRIX_V57 at call time (house rules mutate RULES at runtime).
 */
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { advanceTally, icInitiativeDice, type DeckDamage, type SheafStep } from './matrix.ts';
import { combatStamp, sameCombatRound, type Clock, type ClockDue, own } from './util.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';

const V = () => RULES.MATRIX_V57;
const minTn = (n: number) => Math.max(RULES.MIN_TARGET_NUMBER, n);
/** v0.81.0: `combatId` (optional) names the combat a round belongs to (util.ts Clock / ClockDue). */
type Now = Clock;
type Due = ClockDue;

// ---------------------------------------------------------------- Per-decker security tally

export interface DeckerTally { key: string; name: string; tally: number }

/** Whose tally a detection roll goes on: a frame's → its owner; an agent's → its own uuid ('own') or its owner ('owner'); else the decker. */
export function tallyKeyFor(o: { deckerUuid: string; frame?: { uuid: string; kind: 'frame' | 'agent'; ownerUuid: string } | null }): string {
  const f = o.frame;
  if (!f) return o.deckerUuid;
  if (f.kind === 'agent' && V().tally.agentTally === 'own') return f.uuid;
  return f.ownerUuid || o.deckerUuid;
}

/** The highest tally among all deckers (0 for none). */
export function highestTally(tallies: readonly DeckerTally[]): number {
  return tallies.reduce((m, t) => Math.max(m, t.tally), 0);
}

/** One key's tally (0 when missing). */
export function deckerTallyOf(tallies: readonly DeckerTally[], key: string): number {
  return tallies.find((t) => t.key === key)?.tally ?? 0;
}

/** Add successes to one key's tally; triggered = sheaf steps crossed by this key's tally; highest = max after. */
export function advanceDeckerTally(tallies: readonly DeckerTally[], key: string, name: string, successes: number, sheaf: readonly SheafStep[]): { tallies: DeckerTally[]; before: number; after: number; triggered: SheafStep[]; highest: number } {
  const before = deckerTallyOf(tallies, key);
  const copy = tallies.map((t) => ({ ...t }));
  if (successes <= 0) return { tallies: copy, before, after: before, triggered: [], highest: highestTally(copy) };
  const { tally, triggered } = advanceTally(before, successes, sheaf);
  const entry = copy.find((t) => t.key === key);
  if (entry) entry.tally = tally;
  else copy.push({ key, name, tally });
  return { tallies: copy, before, after: tally, triggered, highest: highestTally(copy) };
}

// ---------------------------------------------------------------- Loading utilities (Swap Memory)

/** The deck's load speed: its own loadSpeed when > 0, else its ioSpeed when loading.fromIo, else 0. */
export function loadSpeedOf(deck: { loadSpeed?: number; ioSpeed?: number }): number {
  if ((deck.loadSpeed ?? 0) > 0) return deck.loadSpeed as number;
  // v0.92.3: I/O speed is Mp per second, so × RULES.MATRIX.download.ioPerTurn a Combat Turn (VR2 p. 86).
  return V().loading.fromIo ? Math.max(0, deck.ioSpeed ?? 0) * Math.max(0, RULES.MATRIX.download.ioPerTurn) : 0;
}

/** Combat Turns to load a utility of `size` Mp: 0 for size <= 0, else ceil(size / loadSpeed), at least 1. */
export function loadTurns(size: number, loadSpeed: number): number {
  if (size <= 0) return 0;
  if (loadSpeed <= 0) return 1;
  return Math.max(1, Math.ceil(size / loadSpeed));
}

/** When something lasting `turns` Combat Turns of `secondsPerTurn` each, started now, is due. */
function dueAfter(now: Now, turns: number, secondsPerTurn: number): Due {
  return { round: now.round != null ? now.round + turns : -1, worldTime: now.worldTime + turns * secondsPerTurn, ...combatStamp(now) };
}

/** When a load started now finishes (round −1 outside combat). */
export function loadingDue(now: Now, turns: number): Due {
  return dueAfter(now, turns, V().loading.secondsPerTurn);
}

/** Whether a load is done (by round in the combat it started in, else by world time). */
export function loadingDone(due: Due, now: { round?: number | null; worldTime?: number; combatId?: string | null }): boolean {
  if (due.round < 0 && due.worldTime < 0) return true;
  if (sameCombatRound(due, now)) return now.round! >= due.round;
  return now.worldTime != null && now.worldTime >= due.worldTime;
}

/** What toggling a utility does: instant (unload, off, size 0, free off-line) or a timed load. */
export function swapMemoryPlan(o: { jackedIn: boolean; load: boolean; size: number; loadSpeed: number; now: Now }): { instant: boolean; turns: number; due: Due | null; action: 'free' | 'simple' | 'complex' } {
  const L = V().loading;
  const instant = !o.load || !L.enabled || o.size <= 0 || (!o.jackedIn && L.freeOffline);
  if (instant) return { instant: true, turns: 0, due: null, action: 'free' };
  const turns = loadTurns(o.size, o.loadSpeed);
  return { instant: false, turns, due: loadingDue(o.now, turns), action: L.action };
}

// ---------------------------------------------------------------- Matrix damage modifiers

/** The wound modifier of `boxes` Matrix damage boxes (RULES.WOUND_MODIFIERS bands), [] when none or off. */
export function matrixWoundModifiers(boxes: number, opts: { who?: string; ic?: boolean } = {}): TargetNumberModifier[] {
  const w = V().wounds;
  if (boxes <= 0 || !w.enabled || (opts.ic && !w.ic)) return [];
  const band = RULES.WOUND_MODIFIERS.find(([min]) => boxes >= min);
  if (!band || band[1] === 0) return [];
  return [{ label: tx('SR2E.Card.Mod.matrixDamage', { part: opts.who ? opts.who + "'s " : '' }), value: band[1] }];
}

// ---------------------------------------------------------------- Black IC holding a decker

export interface HoldingIc { uuid: string; name: string; rating: number; black: boolean; crashed: boolean; hostUuid: string }

/** The live black IC in this host engaging (and not evaded by) the decker, highest rating first; null when none or off. */
export function holdingIc(engaged: readonly string[], ics: readonly HoldingIc[], hostUuid: string, evaded: readonly string[]): HoldingIc | null {
  if (!V().blackIcHold.enabled) return null;
  const live = ics.filter((ic) => engaged.includes(ic.uuid) && ic.black && !ic.crashed && ic.hostUuid === hostUuid && !evaded.includes(ic.uuid));
  return live.reduce<HoldingIc | null>((best, ic) => (!best || ic.rating > best.rating ? ic : best), null);
}

/**
 * The jack-out test against a holding black IC: attribute dice vs the IC's rating. v0.89.5: `name` (the IC's own name)
 * goes into the label, which is built whole here rather than rewritten by the caller.
 */
export function jackOutTest(ic: HoldingIc, attributeRating: number, name?: string): { dice: number; tn: number; needed: number; label: string } {
  const h = V().blackIcHold;
  const tn = minTn(ic.rating);
  const key = `SR2E.Attribute.${h.attribute}`;
  const shown = tKey(key);
  const attr = shown === key ? h.attribute.charAt(0).toUpperCase() + h.attribute.slice(1) : shown;
  const who = name || tx('SR2E.Card.Datawar.blackIcRating', { rating: ic.rating });
  return { dice: Math.max(0, attributeRating), tn, needed: h.successes, label: tx('SR2E.Card.Datawar.breakFreeOf', { name: who, attr, tn }) };
}

// ---------------------------------------------------------------- Host shutdown

/** When a shutdown that starts now dumps everyone (turns 0 = now). */
export function shutdownDue(now: Now, turns?: number): Due {
  const S = V().shutdown;
  const t = turns ?? S.turns;
  if (t <= 0) return { round: now.round ?? -1, worldTime: now.worldTime, ...combatStamp(now) };
  return dueAfter(now, t, S.secondsPerTurn);
}

// ---------------------------------------------------------------- Book-value options

/** Dump shock level: fixed (RULES.MATRIX.dumpShockLevel) or by the host's security code. */
export function dumpShockLevel(code: string): DamageLevel {
  const d = V().dumpShock;
  const fixed = RULES.MATRIX.dumpShockLevel;
  return d.levelBy === 'code' ? (own(d.byCode, code) ?? fixed) : fixed;
}

/** IC initiative base and dice, from its rating or the host's Security Value. */
export function icInitiative(o: { rating: number; securityValue: number; code: string; ownDice: number }): { base: number; dice: number; note: string } {
  const I = V().icInitiative;
  if (I.from === 'securityValue') {
    const dice = o.ownDice > 0 ? o.ownDice : (own(I.diceByCode, o.code) ?? 1);
    return { base: o.securityValue, dice, note: tx('SR2E.Text.Datawar.securityValuePlusDice', { securityValue: o.securityValue, dice }) };
  }
  const dice = o.ownDice > 0 ? o.ownDice : icInitiativeDice(o.code);
  return { base: o.rating, dice, note: tx('SR2E.Text.Datawar.ratingPlusDice', { rating: o.rating, dice }) };
}

/** IC attack dice: its rating, or the host's Security Value (when > 0). */
export function icAttackDiceFor(o: { rating: number; securityValue: number }): { dice: number; note: string } {
  if (V().icAttackDice === 'securityValue' && o.securityValue > 0) return { dice: o.securityValue, note: tx('SR2E.Text.Datawar.securityValue', { securityValue: o.securityValue }) };
  return { dice: o.rating, note: '' };
}

// ---------------------------------------------------------------- Matrix perception

export type PerceptionKind = 'locateDecker' | 'locateIc' | 'analyzeIcon';

/** Perception TN: a persona's Detection Factor (or Masking to analyze), else the icon's rating; Lock-On as a modifier. */
export function perceptionTarget(kind: PerceptionKind, target: { kind: 'persona' | 'ic' | 'frame' | 'agent'; name: string; detectionFactor?: number; masking?: number; rating?: number }, lockOn = 0): { tn: number; label: string; modifiers: TargetNumberModifier[] } {
  let base: number;
  let label: string;
  if (target.kind === 'persona' && kind === 'analyzeIcon') { base = target.masking ?? 0; label = tx('SR2E.Text.Datawar.sMasking', { name: target.name }); }
  else if (target.kind === 'persona') { base = target.detectionFactor ?? 0; label = tx('SR2E.Text.Datawar.sDetectionFactor', { name: target.name }); }
  else { base = target.rating ?? 0; label = tx('SR2E.Text.Datawar.sRating', { name: target.name }); }
  const modifiers: TargetNumberModifier[] = lockOn > 0 ? [{ label: tx('SR2E.Card.Mod.lockOn', { lockOn }), value: -lockOn }] : [];
  return { tn: minTn(base), label, modifiers };
}

/** Perception dice: persona Sensors or the Computer skill. */
export function perceptionDice(o: { sensors: number; computer: number }): { dice: number; label: string } {
  return V().perception.dice === 'computer' ? { dice: o.computer, label: tx('SR2E.Text.Datawar.computer', { computer: o.computer }) } : { dice: o.sensors, label: tx('SR2E.Text.Datawar.sensors', { sensors: o.sensors }) };
}

/** Everything Analyze reveals at that many successes (cumulative, de-duplicated, in order). */
export function analyzeReveals(successes: number): string[] {
  const out: string[] = [];
  for (const row of V().perception.analyze) if (row.successes <= successes) for (const r of row.reveals) if (!out.includes(r)) out.push(r);
  return out;
}

// ---------------------------------------------------------------- Cybercombat maneuvers

export type ManeuverKind = 'position' | 'parry' | 'evade';
export interface Maneuver { kind: ManeuverKind; targetUuid: string; net: number; round: number; worldTime: number; /** v0.81.0: the combat `round` belongs to. */ combatId?: string }

/** Both sides of an opposed maneuver: the decker's Evasion vs the opponent's Sensors (IC: rating), and back. */
export function maneuverSides(o: { evasion: number; cloak: number; opponent: { ic: boolean; rating: number; sensors: number; lockOn: number } }): { mine: { dice: number; tn: number; modifiers: TargetNumberModifier[] }; theirs: { dice: number; tn: number; modifiers: TargetNumberModifier[] } } {
  const opp = o.opponent.ic ? o.opponent.rating : o.opponent.sensors;
  return {
    mine: { dice: o.evasion, tn: minTn(opp), modifiers: o.cloak > 0 ? [{ label: tx('SR2E.Card.Mod.cloak', { cloak: o.cloak }), value: -o.cloak }] : [] },
    theirs: { dice: opp, tn: minTn(o.evasion), modifiers: o.opponent.lockOn > 0 ? [{ label: tx('SR2E.Card.Mod.lockOn', { lockOn: o.opponent.lockOn }), value: -o.opponent.lockOn }] : [] },
  };
}

/** A maneuver's outcome from both sides' successes. */
export function maneuverOutcome(kind: ManeuverKind, mine: number, theirs: number): { net: number; won: boolean; tn: number; frees: boolean } {
  const net = mine - theirs;
  const won = net > 0;
  return { net, won, tn: won && kind !== 'evade' ? Math.min(net, V().maneuvers.maxTn) : 0, frees: kind === 'evade' && won };
}

/** A maneuver entry lasting maneuvers.turns Combat Turns from now. */
export function maneuverEntry(kind: ManeuverKind, targetUuid: string, net: number, now: Now): Maneuver {
  const M = V().maneuvers;
  return { kind, targetUuid, net, ...dueAfter(now, M.turns, M.secondsPerTurn) };
}

/** Whether one maneuver is still in force now (by round in the combat it was made in, else by world time). */
function inForce(m: Maneuver, now: Now): boolean {
  return sameCombatRound(m, now) ? now.round! <= m.round : now.worldTime <= m.worldTime;
}

/** The maneuvers still in force. */
export function activeManeuvers(list: readonly Maneuver[], now: Now): Maneuver[] {
  return list.filter((m) => inForce(m, now));
}

/** The best active maneuver of a kind against a uuid. */
function best(list: readonly Maneuver[], kind: ManeuverKind, uuid: string, now: Now): Maneuver | null {
  return activeManeuvers(list, now).filter((m) => m.kind === kind && m.targetUuid === uuid).reduce<Maneuver | null>((b, m) => (!b || m.net > b.net ? m : b), null);
}

/** The decker's best active 'position' against targetUuid as a TN bonus, or null. */
export function positionBonus(list: readonly Maneuver[], targetUuid: string, now: Now): TargetNumberModifier | null {
  const m = best(list, 'position', targetUuid, now);
  return m && m.net > 0 ? { id: 'positionManeuver', label: tx('SR2E.Card.Mod.positionManeuver'), value: -Math.min(m.net, V().maneuvers.maxTn) } : null;
}

/** On the defender's list: their best active 'parry' against attackerUuid as a TN penalty, or null. */
export function parryPenalty(list: readonly Maneuver[], attackerUuid: string, defenderName: string, now: Now): TargetNumberModifier | null {
  const m = best(list, 'parry', attackerUuid, now);
  return m && m.net > 0 ? { label: tx('SR2E.Card.Mod.parries', { defenderName }), value: Math.min(m.net, V().maneuvers.maxTn) } : null;
}

/** Whether the decker has an active 'evade' against icUuid (and maneuvers.evadeBlocks). */
export function evadedBy(list: readonly Maneuver[], icUuid: string, now: Now): boolean {
  return V().maneuvers.evadeBlocks && activeManeuvers(list, now).some((m) => m.kind === 'evade' && m.targetUuid === icUuid);
}

/** The list without 'position' entries against targetUuid and without expired ones. */
export function consumePosition(list: readonly Maneuver[], targetUuid: string, now: Now): Maneuver[] {
  return activeManeuvers(list, now).filter((m) => !(m.kind === 'position' && m.targetUuid === targetUuid)).map((m) => ({ ...m }));
}

// ---------------------------------------------------------------- Utilities

/** Slow: net successes (at most the rating) × initiativePerNet off the IC's Initiative. */
export function slowEffect(net: number, rating: number): { net: number; initiative: number } {
  if (net <= 0) return { net: 0, initiative: 0 };
  const n = Math.min(net, Math.max(0, rating));
  return { net: n, initiative: n * V().utilities.slow.initiativePerNet };
}

const PERSONA_KEYS = ['bod', 'evasion', 'masking', 'sensors'] as const;

/** Take one point off the largest of `keys` in `d` (first in order on ties); false when all are 0. */
function restoreOne(d: DeckDamage, keys: ReadonlyArray<keyof DeckDamage>): boolean {
  let k: keyof DeckDamage | null = null;
  for (const key of keys) if (d[key] > 0 && (k == null || d[key] > d[k])) k = key;
  if (k == null) return false;
  d[k] -= 1;
  return true;
}

/** Restore: each success restores a crippled point (largest first), then deck damage (MPCP first) when allowed. */
export function restorePlan(crippled: DeckDamage, deckDamage: DeckDamage, successes: number): { crippled: DeckDamage; deckDamage: DeckDamage; restored: number } {
  const c = { ...crippled };
  const d = { ...deckDamage };
  let restored = 0;
  for (let i = 0; i < Math.max(0, successes); i++) {
    if (restoreOne(c, PERSONA_KEYS)) { restored++; continue; }
    if (!V().utilities.restore.deckDamage) break;
    if (d.mpcp > 0) { d.mpcp -= 1; restored++; continue; }
    if (restoreOne(d, PERSONA_KEYS)) { restored++; continue; }
    break;
  }
  return { crippled: c, deckDamage: d, restored };
}

/** A validated decker's Detection Factor in that host. */
export function validatedDf(df: number, validated: boolean): number {
  return validated ? df + V().utilities.validate.dfBonus : df;
}

// ---------------------------------------------------------------- Data bombs

/** A data bomb going off: Matrix damage of its rating, erasing the file unless Pavlov. */
export function bombBlast(rating: number, pavlov: boolean): { power: number; level: DamageLevel; erases: boolean; alert: string } {
  const B = V().bombs;
  return { power: rating, level: B.level, erases: !pavlov, alert: B.alert };
}

/** Whether an operation effect touches a file (and so sets off its bomb). */
export function touchesFile(effect: string): boolean {
  return effect === 'download' || effect === 'editFile' || effect === 'decryptFile';
}

// ---------------------------------------------------------------- Comcalls

export interface Comcall { id: string; from: string; to: string; by: string; tappedBy: string[]; rerouted: string }

/** Copy a call list, applying `fn` to the call with that id. */
function mapCall(calls: readonly Comcall[], id: string, fn: (c: Comcall) => Comcall): Comcall[] {
  return calls.map((c) => (c.id === id ? fn({ ...c, tappedBy: [...c.tappedBy] }) : { ...c, tappedBy: [...c.tappedBy] }));
}

/** Place a new call (replacing one with the same id). */
export function placeCall(calls: readonly Comcall[], call: { id: string; from: string; to: string; by: string }): Comcall[] {
  return [...mapCall(calls, '', (c) => c).filter((c) => c.id !== call.id), { ...call, tappedBy: [], rerouted: '' }];
}

/** Tap a call (adds `who` once). */
export function tapCall(calls: readonly Comcall[], id: string, who: string): Comcall[] {
  return mapCall(calls, id, (c) => (c.tappedBy.includes(who) ? c : { ...c, tappedBy: [...c.tappedBy, who] }));
}

/** Reroute a call to another number. */
export function rerouteCall(calls: readonly Comcall[], id: string, to: string): Comcall[] {
  return mapCall(calls, id, (c) => ({ ...c, rerouted: to }));
}

/** End a call. */
export function endCall(calls: readonly Comcall[], id: string): Comcall[] {
  return mapCall(calls, '', (c) => c).filter((c) => c.id !== id);
}

// ---------------------------------------------------------------- Reality filter

/** The reality filter test on entering a host: MPCP vs the Security Value. */
export function realityFilterTest(mpcp: number, securityValue: number): { dice: number; tn: number } {
  return { dice: Math.max(0, mpcp), tn: minTn(securityValue) };
}

/** What the reality filter gives in a host: a bonus on success, a TN penalty on failure, nothing untested. */
export function realityFilterEffect(ok: boolean | null): { reaction: number; pool: number; modifiers: TargetNumberModifier[] } {
  const F = V().realityFilter;
  if (ok === true) return { reaction: F.reaction, pool: F.pool, modifiers: [] };
  if (ok === false) return { reaction: 0, pool: 0, modifiers: F.failTn ? [{ id: 'realityFilterFails', label: tx('SR2E.Card.Mod.realityFilterFails'), value: F.failTn }] : [] };
  return { reaction: 0, pool: 0, modifiers: [] };
}

// ---------------------------------------------------------------- Hitcher jacks

/** A deck's hitcher jacks: capacity and free places. */
export function hitcherRoom(deck: { hitchers?: number }, riding: number): { capacity: number; free: number } {
  const capacity = Math.max(0, deck.hitchers ?? 0);
  return { capacity, free: Math.max(0, capacity - Math.max(0, riding)) };
}

// ---------------------------------------------------------------- BTL and simsense chips

/** Whether the user can play a chip, and via which hardware (first of chips.needs). */
export function chipPlayable(hw: { chipjack?: boolean; datajack?: boolean; simrig?: boolean }): { ok: boolean; via: string | null } {
  const via = V().chips.needs.find((n) => (hw as Record<string, boolean | undefined>)[n] === true) ?? null;
  return { ok: via != null, via };
}

const CHIP_LABELS: Record<string, string> = { simsense: 'Simsense', btl: 'BTL', dreamchip: 'Dreamchip', moodchip: 'Moodchip', personafix: 'Personafix' };

/** A chip kind's behaviour (burns out, addictive) and label. */
export function chipBehaviour(kind: string): { burnsOut: boolean; addictive: boolean; label: string } {
  const C = V().chips;
  return { burnsOut: C.burnsOut.includes(kind), addictive: C.addictive.includes(kind), label: CHIP_LABELS[kind] ?? '' };
}
