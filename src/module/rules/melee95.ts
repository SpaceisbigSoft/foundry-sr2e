/**
 * v0.95.0 rules completeness (melee, actions, Dice Pools): pure functions for RULES.MELEE_V95 (config95/melee.ts).
 * No Foundry globals. The Foundry side is applications/melee95.ts.
 *
 * Under the Unified Rules Revamp (RULES.URR_V80.active) a switch for a rule the Revamp changes itself
 * (REVAMP_MELEE_RULES) answers the Revamp's way; the others read the same under either source.
 */
import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { poolRefreshPerAction } from './combat923.ts';

const V = () => RULES.MELEE_V95;
const num = (x: unknown): number => (Number.isFinite(Number(x)) ? Number(x) : 0);
const int = (x: unknown): number => Math.floor(num(x));

type Sw = typeof RULES.MELEE_V95;
/**
 * The MELEE_V95 switches for rules the Revamp changes itself: total surprise (the Revamp has none) and the pools'
 * refresh (every pool at the new Combat Turn). Quick draw is changed too, but keeps the test (see quickDrawPlan).
 */
export const REVAMP_MELEE_RULES: ReadonlySet<keyof Sw> = new Set<keyof Sw>(['totalSurprise', 'otherPools']);

function is<K extends keyof Sw>(key: K, value: Sw[K]): boolean {
  if (RULES.URR_V80?.active && REVAMP_MELEE_RULES.has(key)) return false;
  return V()[key] === value;
}

// ---------------------------------------------------------------- no actions (Core pp. 86, 112)

/** The reasons a character takes no actions (language keys; applications/sheets.ts shows them on greyed buttons). */
export const NO_ACTIONS = {
  reaction: 'SR2E.Melee95.whyReaction',
  surprised: 'SR2E.Melee95.whySurprised',
} as const;

export function reactionOutOn(): boolean { return is('reactionOut', 'book'); }
export function totalSurpriseOn(): boolean { return is('totalSurprise', 'book'); }

/**
 * Whether wounds have taken Reaction to 0 or less (Core p. 112): the Initiative formula's base (Reaction) less its
 * modifier (`minus`, the wound part). Never without a modifier (a Reaction of 0 on its own isn't a wound).
 */
export function reactionOut(f: { base: number; minus: number } | null | undefined): boolean {
  if (!reactionOutOn() || !f) return false;
  return num(f.minus) > 0 && num(f.base) - num(f.minus) <= 0;
}

/** Why a character in a fight takes no actions now ('' = it may act): Reaction gone, or completely surprised. */
export function noActionsWhy(o: { inFight: boolean; reactionOut: boolean; surprised: boolean }): string {
  if (!o.inFight) return '';
  if (o.surprised && totalSurpriseOn()) return NO_ACTIONS.surprised;
  if (o.reactionOut && reactionOutOn()) return NO_ACTIONS.reaction;
  return '';
}

/** Whether a greyed-button reason is one of these (so the sheet translates it). */
export function isNoActionsWhy(key: string): boolean {
  return key === NO_ACTIONS.reaction || key === NO_ACTIONS.surprised;
}

// ---------------------------------------------------------------- surprise (Core p. 86)

export interface SurpriseEntry { id: string; side: string; successes: number }

/**
 * Whether two sides oppose each other. Different sides do. When every entry shows the same side (a world where all
 * tokens share one disposition), sides can't be told apart and everyone else is an opponent.
 */
export function sidesTold(entries: ReadonlyArray<{ side: string }>): boolean {
  return new Set(entries.map((e) => String(e.side))).size > 1;
}

/** The opponents of one entry. */
export function opponentsOf<T extends SurpriseEntry>(me: T, entries: readonly T[]): T[] {
  const told = sidesTold(entries);
  return entries.filter((o) => o.id !== me.id && (!told || String(o.side) !== String(me.side)));
}

/**
 * The completely surprised (Core p. 86): those who rolled more successes than no opponent, with at least one
 * opponent who rolled more than they did. [] when the rule is off (or under the Revamp, which has none).
 */
export function totallySurprised(entries: readonly SurpriseEntry[]): string[] {
  if (!totalSurpriseOn()) return [];
  return entries.filter((me) => {
    const foes = opponentsOf(me, entries);
    if (!foes.length) return false;
    const beatsSomeone = foes.some((o) => num(me.successes) > num(o.successes));
    const beaten = foes.some((o) => num(o.successes) > num(me.successes));
    return !beatsSomeone && beaten;
  }).map((e) => e.id);
}

/**
 * The surprise turn's target limit by sides: of the targets the limit would block, only opponents stay blocked (an
 * ally is never an opponent). Unchanged when the rule is off or sides can't be told apart.
 */
export function blockedOpponents<T extends { id: string }>(attackerSide: string, blocked: readonly T[], sideOf: (t: T) => string, allSides: readonly string[]): T[] {
  if (!totalSurpriseOn() || new Set(allSides.map(String)).size <= 1) return [...blocked];
  return blocked.filter((t) => String(sideOf(t)) !== String(attackerSide));
}

/** A combatant's side: player characters stand with the friendly disposition (1); others by their token's. */
export function sideOf(o: { playerOwned: boolean; disposition: unknown }): string {
  return o.playerOwned ? '1' : String(int(o.disposition));
}

// ---------------------------------------------------------------- quick draw (Core p. 82)

export function quickDrawTest(): boolean { return V().quickDraw === 'test'; }

/** Whether a quick-draw holster still draws for free (the v0.94.2 way only). */
export function freeDraw(weaponSystem: { quickDraw?: unknown } | null | undefined): boolean {
  return Boolean(weaponSystem?.quickDraw) && !quickDrawTest();
}

/** The firing modes fired with a Simple Action (Core p. 82): single shot, semi-automatic, burst. */
export const SIMPLE_FIRE_MODES: readonly string[] = ['SS', 'SA', 'BF'];

/**
 * Whether a weapon can be quick-drawn: a firearm (not melee, thrown or a blast), pistol-sized (Concealability at or
 * over the limit) and fired in a mode that takes a Simple Action.
 */
export function quickDrawEligible(w: { melee?: unknown; blast?: unknown; thrown?: unknown; concealability?: unknown; mode?: string | null }): boolean {
  if (!quickDrawTest()) return false;
  if (w.melee || w.blast || w.thrown) return false;
  if (int(w.concealability) < int(V().quickDrawConceal)) return false;
  return SIMPLE_FIRE_MODES.includes(String(w.mode ?? ''));
}

/**
 * The quick-draw test: the attribute rolled and its TN. The book: Reaction vs 4, +2 without a proper holster, +2
 * when a second firearm is drawn too. The Revamp: Quickness vs the same base, no modifiers.
 */
export function quickDrawPlan(o: { holster: boolean; second?: boolean }): { attribute: 'reaction' | 'quickness'; tn: number; modifiers: Array<{ id: string; value: number }> } {
  const base = Math.max(num(RULES.MIN_TARGET_NUMBER), int(V().quickDrawTn));
  if (RULES.URR_V80?.active) return { attribute: 'quickness', tn: base, modifiers: [] };
  const modifiers: Array<{ id: string; value: number }> = [];
  if (!o.holster && int(V().quickDrawNoHolsterTn)) modifiers.push({ id: 'noHolster', value: int(V().quickDrawNoHolsterTn) });
  if (o.second && int(V().quickDrawSecondTn)) modifiers.push({ id: 'secondWeapon', value: int(V().quickDrawSecondTn) });
  return { attribute: 'reaction', tn: Math.max(num(RULES.MIN_TARGET_NUMBER), base + modifiers.reduce((n, m) => n + m.value, 0)), modifiers };
}

/** One success clears the weapon. */
export function quickDrawCleared(successes: number): boolean { return int(successes) >= 1; }

/** A card note list with the "drawn (a Simple Action)" note swapped for the quick-draw one. */
export function swapNote(note: string | undefined, from: string, to: string): string {
  const parts = String(note ?? '').split(', ').filter(Boolean);
  const i = parts.indexOf(from);
  if (i >= 0) parts[i] = to; else parts.push(to);
  return parts.join(', ');
}

// ---------------------------------------------------------------- subduing (Core p. 103)

export function subdueStunOnly(): boolean { return V().subdue === 'stunOnly'; }
export function subdueControlOn(): boolean { return V().subdueControl === 'book'; }

/** Whether a weapon may be used to subdue: any under the old way, only one that does Stun damage by the book. */
export function subdueAllowed(w: { damageType?: unknown; stunWeapon?: unknown } | null | undefined): boolean {
  if (!subdueStunOnly()) return true;
  return String(w?.damageType ?? '') === 'stun' || Boolean(w?.stunWeapon);
}

export interface ThreeRatings { unarmed: number; strength: number; quickness: number }
export type RatingKind = keyof ThreeRatings;
const KINDS: readonly RatingKind[] = ['unarmed', 'strength', 'quickness'];

/** The best of the three (the dice a side rolls): the first of Unarmed Combat, Strength, Quickness at the highest. */
export function bestRating(r: ThreeRatings): { kind: RatingKind; dice: number } {
  let kind: RatingKind = 'unarmed';
  for (const k of KINDS) if (int(r[k]) > int(r[kind])) kind = k;
  return { kind, dice: Math.max(0, int(r[kind])) };
}

/** The lowest of the three (the TN the other side rolls against), never under the minimum TN. */
export function lowestRating(r: ThreeRatings): number {
  return Math.max(num(RULES.MIN_TARGET_NUMBER), Math.min(...KINDS.map((k) => Math.max(0, int(r[k])))));
}

/** The maintenance test's two sides: the holder's dice and TN, the held one's dice and TN (+ the resist modifier). */
export function maintainPlan(holder: ThreeRatings, held: ThreeRatings): { holder: { kind: RatingKind; dice: number; tn: number }; held: { kind: RatingKind; dice: number; tn: number; plus: number } } {
  const h = bestRating(holder), d = bestRating(held);
  return {
    holder: { ...h, tn: lowestRating(held) },
    held: { ...d, tn: lowestRating(holder), plus: Math.max(0, int(V().subdueResistTn)) },
  };
}

/** The subdued state kept on the held actor (flag `subdued95`). */
export interface Subdued { by: string; boxes: number; at: number }

/** A stored flag cleaned (null when it isn't one). */
export function subduedOf(raw: unknown): Subdued | null {
  const o = raw as Partial<Subdued> | null | undefined;
  if (!o || typeof o !== 'object' || typeof o.by !== 'string' || !o.by) return null;
  const boxes = Math.max(0, Math.min(int(RULES.MONITOR_BOXES) || 10, int(o.boxes)));
  return { by: o.by, boxes, at: num(o.at) };
}

/**
 * Subduing Stun wearing off (1 box per `subdueReleaseSeconds` since control was last kept): how many boxes come off
 * now, and the state left (null once none is left). `stun` is the held one's Stun track now.
 */
export function subdueWearOff(s: Subdued, now: number, stun: number): { off: number; left: Subdued | null } {
  const per = Math.max(1, num(V().subdueReleaseSeconds));
  const due = Math.max(0, Math.floor((num(now) - s.at) / per));
  const off = Math.min(due, s.boxes, Math.max(0, int(stun)));
  if (due <= 0) return { off: 0, left: s };
  const boxes = Math.min(s.boxes - off, Math.max(0, int(stun) - off));
  return { off, left: boxes > 0 ? { by: s.by, boxes, at: s.at + due * per } : null };
}

/**
 * The maintenance test's outcome: each net success (the holder's less the held one's) puts back one box of the
 * subduing Stun that has worn off (`worn` = the first total less what is left), and the clock starts again.
 */
export function maintainOutcome(o: { holder: number; held: number; state: Subdued; total: number; now: number; stun: number }): { net: number; restored: number; state: Subdued } {
  const net = Math.max(0, int(o.holder) - int(o.held));
  const max = int(RULES.MONITOR_BOXES) || 10;
  const worn = Math.max(0, int(o.total) - o.state.boxes);
  const restored = Math.max(0, Math.min(net, worn, max - Math.max(0, int(o.stun))));
  return { net, restored, state: { by: o.state.by, boxes: o.state.boxes + restored, at: net > 0 ? num(o.now) : o.state.at } };
}

// ---------------------------------------------------------------- knocked back into a wall (Core p. 102)

export function wallOn(): boolean { return V().wall === 'book'; }

/** The status put on a character knocked back against a wall. */
export const WALL_STATUS = 'sr2eWall95';

/** The point `metres` straight back from `target`, away from `attacker` (pixels); null when they share a point. */
export function backPoint(attacker: { x: number; y: number }, target: { x: number; y: number }, metres: number, pxPerMetre: number): { x: number; y: number } | null {
  const dx = num(target.x) - num(attacker.x), dy = num(target.y) - num(attacker.y);
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  const d = Math.max(0, num(metres)) * Math.max(0, num(pxPerMetre));
  return { x: num(target.x) + (dx / len) * d, y: num(target.y) + (dy / len) * d };
}

/** How far back to look for the wall: the stagger (at least the rule's own metre). */
export function wallReach(staggerMetres: number): number {
  return Math.max(num(V().wallMetres), num(staggerMetres));
}

/** The TN modifier of a character against a wall (none when the rule is off or the status isn't on). */
export function wallModifiers(against: boolean, label: string): TargetNumberModifier[] {
  const v = int(V().wallTn);
  return against && wallOn() && v ? [{ id: 'againstWall95', label, value: v }] : [];
}

// ---------------------------------------------------------------- interception (Core p. 83)

export function interceptionOn(): boolean { return V().interception === 'offer'; }

/** The shortest distance from a point to the segment a → b (same units as the points). */
export function distanceToPath(a: { x: number; y: number }, b: { x: number; y: number }, p: { x: number; y: number }): number {
  const dx = num(b.x) - num(a.x), dy = num(b.y) - num(a.y);
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((num(p.x) - num(a.x)) * dx + (num(p.y) - num(a.y)) * dy) / len2)) : 0;
  return Math.hypot(num(p.x) - (num(a.x) + t * dx), num(p.y) - (num(a.y) + t * dy));
}

export interface Bystander { id: string; x: number; y: number; side: string; canMelee: boolean; bodyMetres: number }

/**
 * Who may intercept one leg (`from` → `to`) of a move that ends at `end` (pixels; token centres): opponents able to
 * make a melee attack whose centre the leg passes within the distance (the rule's metre, plus `bodyMetres`: half a
 * space each for the two bodies), and who the mover isn't standing beside at the end (stopping beside someone is
 * closing with them, not passing: Core p. 83 is about passing without attacking). A move that starts beside them
 * counts: leaving is passing.
 */
export function interceptors(o: { from: { x: number; y: number }; to: { x: number; y: number }; end?: { x: number; y: number }; moverSide: string; pxPerMetre: number; others: readonly Bystander[]; sidesTold: boolean }): string[] {
  if (!interceptionOn()) return [];
  const ppm = Math.max(1e-6, num(o.pxPerMetre));
  const end = o.end ?? o.to;
  if (Math.hypot(num(o.to.x) - num(o.from.x), num(o.to.y) - num(o.from.y)) < 1e-6) return [];
  return o.others.filter((b) => {
    if (!b.canMelee) return false;
    if (o.sidesTold && String(b.side) === String(o.moverSide)) return false;
    const reach = (Math.max(0, num(V().interceptMetres)) + Math.max(0, num(b.bodyMetres))) * ppm + 1e-6;
    if (distanceToPath(o.from, o.to, b) > reach) return false;
    return Math.hypot(num(end.x) - num(b.x), num(end.y) - num(b.y)) > reach;
  }).map((b) => b.id);
}

/** The key of one offer: one card per mover and interceptor in a Combat Phase. */
export function offerKey(o: { moverId: string; interceptorId: string; round: number; pass: number }): string {
  return `${o.moverId}|${o.interceptorId}|${int(o.round)}|${int(o.pass)}`;
}

// ---------------------------------------------------------------- the other Dice Pools (Core p. 84)

/**
 * Whether the Spell and Hacking Pools refresh at each of the character's actions: the switch, with the Combat
 * Pool doing the same (COMBAT_V923.poolRefresh 'action'), and never under the Revamp (every pool at the new turn).
 */
export function otherPoolsPerAction(): boolean {
  return is('otherPools', 'action') && poolRefreshPerAction();
}

const SPELL_KEYS = ['system.poolSpent.spell', 'system.poolSpent.spellConc', 'system.poolSpent.spellSpec'] as const;
// The Task Pool is Rigger 2's (and Shadowtech's): "all Dice Pools refresh at the beginning of each Combat Turn" there, so
// it stays per Combat Turn like the Control Pool.
const ACTION_KEYS = [...SPELL_KEYS, 'system.poolSpent.hacking'] as const;

/**
 * The update a new Combat Turn makes to an actor's pools, cut down. `keepCombat` (COMBAT_V923.poolRefresh 'action'):
 * the Combat Pool's dice last until the first action; with the other pools per action so do the Spell, Hacking and
 * the spell defense dice, so their keys are dropped. The Control and Task Pools always refresh here (Rigger 2).
 * `acted` false: the character had no action last Combat Turn (Reaction 0, surprised): their other pools refresh here,
 * at least once a Combat Turn.
 */
export function turnRefresh<T extends Record<string, unknown>>(update: T, keepCombat: boolean, acted = true): Partial<T> {
  if (!keepCombat || !acted || !otherPoolsPerAction()) return update;
  const out: Record<string, unknown> = { ...update };
  for (const k of [...ACTION_KEYS, 'system.spellDefense']) delete out[k];
  return out as Partial<T>;
}

/**
 * The update the start of a character's action makes to the Spell and Hacking Pools (null: nothing to change, or the rule is
 * off), and the spell defense dice that went back to the Spell Pool (Core p. 132: allotted again each time).
 */
export function actionRefreshUpdate(sys: { poolSpent?: Record<string, unknown> | null; spellDefense?: unknown } | null | undefined): { update: Record<string, number>; defenseBack: number } | null {
  if (!otherPoolsPerAction() || !sys?.poolSpent) return null;
  const update: Record<string, number> = {};
  for (const k of ACTION_KEYS) {
    const leaf = k.split('.').pop() as string;
    if (num(sys.poolSpent[leaf]) > 0) update[k] = 0;
  }
  const defenseBack = Math.max(0, int(sys.spellDefense));
  if (defenseBack > 0) update['system.spellDefense'] = 0;
  return Object.keys(update).length ? { update, defenseBack } : null;
}

/** Whether a character had an action in the Combat Turn just ended: a `poolRefreshed` key of theirs that round. */
export function actedIn(refreshed: { round?: unknown; keys?: unknown } | null | undefined, round: number, combatantId: string): boolean {
  if (!refreshed || int(refreshed.round) !== int(round) || !Array.isArray(refreshed.keys)) return false;
  return refreshed.keys.some((k) => String(k).split('|')[3] === String(combatantId));
}

// ---------------------------------------------------------------- subduing damage done (Core p. 103)

/** The subduing Stun each attacker did to one character (flag `subdueDone95`, a list: uuids have dots). */
export interface SubdueDone { by: string; boxes: number }

/** A stored list cleaned (bad entries dropped, one entry per attacker, at most the monitor's boxes). */
export function subdueDoneOf(raw: unknown): SubdueDone[] {
  const max = int(RULES.MONITOR_BOXES) || 10;
  const out = new Map<string, number>();
  for (const e of Array.isArray(raw) ? raw : []) {
    const by = typeof e?.by === 'string' ? e.by : '';
    const boxes = Math.max(0, Math.min(max, int(e?.boxes)));
    if (by && boxes > 0) out.set(by, Math.min(max, (out.get(by) ?? 0) + boxes));
  }
  return [...out].slice(0, 20).map(([by, boxes]) => ({ by, boxes }));
}

/** The list after `delta` Stun boxes from `by`'s subduing blow (a re-roll can take some back). */
export function addSubdueDone(raw: unknown, by: string, delta: number): SubdueDone[] {
  const list = subdueDoneOf(raw).filter((e) => e.by !== by);
  const had = subdueDoneOf(raw).find((e) => e.by === by)?.boxes ?? 0;
  const now = Math.max(0, Math.min(int(RULES.MONITOR_BOXES) || 10, had + int(delta)));
  return now > 0 ? [...list, { by, boxes: now }] : list;
}

/** The subduing Stun `by` did that is still on the track (never more than the Stun there is). */
export function subdueBoxesBy(raw: unknown, by: string, stun: number): number {
  return Math.min(Math.max(0, int(stun)), subdueDoneOf(raw).find((e) => e.by === by)?.boxes ?? 0);
}

/** Whether the holder is close enough to take control: within `metres` of each other (unknown distance: no). */
export function closeEnough(metres: number | null | undefined, limit: number): boolean {
  return metres !== null && metres !== undefined && Number.isFinite(Number(metres)) && num(metres) <= Math.max(0, num(limit)) + 1e-6;
}

// ---------------------------------------------------------------- the interception attack (Core p. 83)

/** The Attack's situational rows an interception keeps: the attacker's own movement. */
export const INTERCEPT_SITUATIONAL: readonly string[] = ['attackerWalking', 'attackerRunning', 'attackerWalkingRough', 'attackerRunningRough'];

/** The situational ids an interception keeps (the rest are dropped). */
export function interceptSituational(ids: readonly string[]): string[] {
  return ids.filter((id) => INTERCEPT_SITUATIONAL.includes(id));
}
