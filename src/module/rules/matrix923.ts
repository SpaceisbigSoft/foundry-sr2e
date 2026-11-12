/**
 * v0.92.3 book alignment, The Matrix (RULES.MATRIX_V923; rules/config923/matrix.ts). Pure rules, no Foundry: every value
 * is read at call time (house rules change RULES at runtime). Virtual Realities 2.0 (VR2) replaces the Core Matrix rules.
 */
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { own } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';

const V = () => RULES.MATRIX_V923;
const minTn = (n: number) => Math.max(RULES.MIN_TARGET_NUMBER, n);
const LEVELS: readonly DamageLevel[] = ['L', 'M', 'S', 'D'];

// ---------------------------------------------------------------- System tests (VR2 p. 19)

/** A system test's outcome: opposed (more successes than the host) or 1+ successes ('success'); `net` = what counts. */
export function systemTestOutcome(successes: number, hostSuccesses: number): { ok: boolean; net: number } {
  const s = Math.max(0, successes);
  if (V().systemTests !== 'opposed') return { ok: s > 0, net: s };
  const h = Math.max(0, hostSuccesses);
  return { ok: s > 0 && s > h, net: Math.max(0, s - h) };
}

/** VR2 p. 61: a passive (or higher) alert raises every subsystem rating. */
export function alertSubsystemBonus(alert: string): number {
  return ['passive', 'active', 'shutdown'].includes(alert) ? Math.max(0, Number(V().passiveAlert) || 0) : 0;
}

/** VR2 p. 110: Locate File adds up net successes; every `locateFileSuccesses` locate one file. */
export function locateFileProgress(before: number, net: number): { total: number; files: number } {
  const need = Math.max(1, Math.floor(Number(V().locateFileSuccesses) || 5));
  const b = Math.max(0, before);
  const total = b + Math.max(0, net);
  return { total, files: Math.floor(total / need) - Math.floor(b / need) };
}

// ---------------------------------------------------------------- Operations (VR2 p. 161)

type Op = (typeof RULES.MATRIX.operations)[number];

/** The operations in force: the book's table, or ('v922') the old values patched over it without the new rows. */
export function matrixOperations(): Op[] {
  const list = [...RULES.MATRIX.operations];
  if (V().operations !== 'v922') return list;
  const old = V().oldOperations;
  return list.filter((o) => !V().newOperations.includes(o.id)).map((o) => (own(old, o.id) ? { ...o, ...own(old, o.id) } as Op : o));
}

// ---------------------------------------------------------------- Persona speed (VR2 pp. 85, 87, 120, 145)

/**
 * The persona's Matrix Reaction and initiative dice (book): the decker's own Reaction + 2 per counted Response Increase
 * (at most the deck's maximum and MPCP ÷ 4), a hot deck as one more level; a tortoise halves Reaction (min 1) and gets
 * only Response Increase's dice; an otaku (I + W) ÷ 2 (round up) and 3D6. Null with 'v922' (the caller keeps the old way).
 */
export function personaSpeed(o: { reaction: number; responseIncrease: number; mpcp: number; sim: string; tortoise: boolean; otaku?: { intelligence: number; willpower: number } | null }): { reaction: number; dice: number; counted: number } | null {
  if (V().initiative !== 'book') return null;
  const per = RULES.MATRIX.reactionPerResponse;
  const ri = Math.max(0, Math.min(RULES.MATRIX.maxResponseIncrease, Math.floor(Math.max(0, o.mpcp) / 4), Math.floor(o.responseIncrease || 0)));
  if (o.tortoise) return { reaction: Math.max(1, Math.floor(Math.max(0, o.reaction) / 2)), dice: RULES.MATRIX.baseInitiativeDice + ri, counted: ri };
  if (o.otaku && V().otaku === 'book') {
    return { reaction: Math.ceil((Math.max(0, o.otaku.intelligence) + Math.max(0, o.otaku.willpower)) / 2), dice: 3, counted: 0 };
  }
  const hot = o.sim === 'hot' ? 1 : 0;
  return { reaction: Math.max(0, o.reaction) + per * (ri + hot), dice: RULES.MATRIX.baseInitiativeDice + ri + hot * Math.max(0, RULES.MATRIX.sim.hot.initiativeDice), counted: ri };
}

/** Warnings for a deck whose Response Increase is above MPCP ÷ 4 (book; VR2 p. 87). */
export function responseCapWarning(mpcp: number, responseIncrease: number): string[] {
  if (V().initiative !== 'book') return [];
  const cap = Math.floor(Math.max(0, mpcp) / 4);
  return responseIncrease > cap ? [tx('SR2E.Text.Matrix923.responseAboveMpcp', { ri: responseIncrease, cap, mpcp })] : [];
}

/** IC initiative dice by the host's code (VR2 p. 120), or the old table. */
export function icInitiativeTable(): Record<string, number> {
  return V().icInitiative === 'v922' ? V().oldIcInitiativeDice : RULES.MATRIX.icInitiativeDice;
}

// ---------------------------------------------------------------- Cybercombat (VR2 pp. 40, 52, 123)

export function cybercombatBook(): boolean {
  return V().cybercombat !== 'v922';
}

/** The Cybercombat Target Numbers Table: by the host's code and the target's status. */
export function cybercombatTn(code: string, legitimate: boolean): number {
  const t = legitimate ? V().attackTn.legitimate : V().attackTn.intruding;
  return minTn(own(t, code) ?? own(t, 'orange') ?? 4);
}

/** Crashing IC: what goes on the attacker's tally (VR2 p. 40). */
export function crashTallyPoints(rating: number): number {
  const r = Math.max(0, Math.floor(rating || 0));
  const m = V().crashTally;
  return m === 'rating' ? r : m === 'half' ? Math.ceil(r / 2) : 0;
}

/** Party IC (VR2 p. 52): +1 TN per member on the party's attacks and on attacks on a member (book). */
export function partyTn(members: number): number {
  return cybercombatBook() && members > 1 ? members : 0;
}

/** The IC's damage level: by the host's code (VR2 p. 123), or its own. */
export function icDamageLevelFor(code: string, ownLevel: string): DamageLevel {
  const lv = (LEVELS as readonly string[]).includes(ownLevel) ? ownLevel as DamageLevel : 'M';
  if (V().icDamageLevel !== 'code') return lv;
  return own(V().icDamageByCode, code) ?? lv;
}

/** Whether a cybercombat attack or maneuver is a Simple Action (VR2 pp. 120–123). */
export function matrixActionCost(kind: 'attack' | 'maneuver'): 'simple' | 'complex' | null {
  if (V().actions === 'v922') return null;
  return kind ? 'simple' : null;
}

// ---------------------------------------------------------------- Damage to the decker (VR2 pp. 17, 47, 86, 124)

/** One damage level lower (null below Light). */
export function levelDown(level: DamageLevel, steps = 1): DamageLevel | null {
  const i = LEVELS.indexOf(level) - Math.max(0, steps);
  return i < 0 ? null : LEVELS[i]!;
}

/** Dump shock (VR2 p. 124): a cool deck and an ICCM each take 2 off the Power and a level (book; 'v922' unchanged). */
export function dumpShockCode(o: { power: number; level: DamageLevel; cool: boolean; iccm: boolean }): { power: number; level: DamageLevel | null; note: string } {
  if (V().dumpShock === 'v922') return { power: o.power, level: o.level, note: '' };
  const n = (o.cool ? 1 : 0) + (o.iccm ? 1 : 0);
  const notes = [o.cool ? tx('SR2E.Text.Matrix923.coolDeck') : '', o.iccm ? 'ICCM' : ''].filter(Boolean).join(', ');
  return { power: minTn(o.power - 2 * n), level: levelDown(o.level, n), note: n ? notes : '' };
}

/** Simsense overload (VR2 p. 124): the TN for icon damage on a hot deck, or null (no test: cool, black IC, Deadly). */
export function overloadTnFor(level: DamageLevel | null, o: { hot: boolean; dni?: boolean; iccm?: boolean }): number | null {
  if (!level || !o.hot) return null;
  const tn = own(V().overloadTn, level);
  if (tn == null) return null;
  return minTn(tn + (o.dni !== false ? 2 : 0) - (o.iccm ? 2 : 0));
}

/** Black IC on the decker (book): the attribute (Body for lethal, Willpower for non-lethal) and the Power after Hardening. */
export function blackIcResistance(o: { damageType: 'physical' | 'stun'; power: number; hardening: number }): { attribute: 'body' | 'willpower'; tn: number } {
  return { attribute: o.damageType === 'stun' ? 'willpower' : 'body', tn: minTn(o.power - Math.max(0, o.hardening)) };
}

/** Gray IC (VR2 pp. 43–44): the Blaster/Sparky Test's TN against the deck. */
export function grayIcTn(o: { mpcp: number; hardening: number; sparky: boolean }): number {
  if (V().grayIc === 'v922') return minTn(o.mpcp);
  return minTn(o.mpcp + Math.max(0, o.hardening) + (o.sparky ? 2 : 0));
}

/** Sparky's damage to the decker (VR2 p. 44): (rating)M staged up a level per 2 Sparky successes, Hardening off the Power. */
export function sparkyDamage(o: { rating: number; successes: number; hardening: number }): { tn: number; level: DamageLevel } {
  const up = Math.floor(Math.max(0, o.successes) / 2);
  const i = Math.min(LEVELS.length - 1, LEVELS.indexOf('M') + up);
  return { tn: minTn(o.rating - Math.max(0, o.hardening)), level: LEVELS[i]! };
}

// ---------------------------------------------------------------- Trace (VR2 pp. 45–47)

export function traceBook(): boolean {
  return V().trace !== 'v922';
}

/** The jackpoint's Access and Trace modifiers (VR2 Grids and Hosts p. 28). */
export function jackpointMods(connection: string): { access: number; trace: number; reaction: number } {
  const j = own(V().jackpoints, connection) ?? { access: 0, trace: 0 };
  return { access: Number(j.access) || 0, trace: Number(j.trace) || 0, reaction: Number(j.reaction ?? 0) || 0 };
}

/** The Trace Factor: Evasion − the trace's rating + Camo + redirects + the jackpoint's modifier (minimum TN). */
export function traceFactor(o: { evasion: number; rating: number; camo: number; redirects: number; jackpoint: number }): number {
  return minTn(o.evasion - o.rating + Math.max(0, o.camo) + Math.max(0, o.redirects) + o.jackpoint);
}

/** The location cycle: 10 ÷ successes, rounded down (min 1); null without a hit. */
export function traceCycleTurns(successes: number): number | null {
  if (!(successes > 0)) return null;
  return Math.max(1, Math.floor(RULES.MATRIX.trace.baseTurns / successes));
}

/** Jacking out under a trace: the datatrail stays 1D6 − 1 turns (min 1); the trace completes if that reaches the turns left. */
export function datatrailHolds(d6: number, turnsLeft: number): { turns: number; completes: boolean } {
  const turns = Math.max(1, Math.floor(d6) - 1);
  return { turns, completes: turns >= Math.max(0, turnsLeft) };
}

/** A completed trace's bonuses (VR2 p. 46): proactive IC −1 TN on the decker, +1 on every tally increase. */
export function tracedModifiers(traced: boolean): TargetNumberModifier[] {
  return traced && traceBook() ? [{ id: 'traced', label: tx('SR2E.Card.Mod.traced923'), value: -1 }] : [];
}

// ---------------------------------------------------------------- Frames (VR2 pp. 104–105)

/** A frame's dice (book): a dumb frame rolls its owner's Computer, a smart frame its rating; null with 'v922'. */
export function frameDice923(o: { rating: number; smart: boolean; ownerComputer: number }): { dice: number; pool: number } | null {
  if (V().frames === 'v922') return null;
  return { dice: o.smart ? Math.max(0, Math.floor(o.rating || 0)) : Math.max(0, Math.floor(o.ownerComputer || 0)), pool: 0 };
}

/** What a frame may carry (book): the utilities' combined ratings ≤ its rating; null with 'v922' (a count). */
export function frameCarryOk(ratings: readonly number[], coreRating: number): boolean | null {
  if (V().frames === 'v922') return null;
  return ratings.reduce((s, r) => s + Math.max(0, r || 0), 0) <= Math.max(0, coreRating || 0);
}

// ---------------------------------------------------------------- Deck building (VR2 pp. 83–87)

/** A deck part's design size and TN (book), or null with 'v922' or a part the book table doesn't cover. */
export function deckPartBook(part: string, rating: number, mpcp: number): { size: number; tn: number } | null {
  if (V().deckBuilding === 'v922') return null;
  const r = Math.max(1, Math.floor(rating || 1));
  const m = Math.max(1, Math.floor(mpcp || 1));
  switch (part) {
    case 'mpcp': return { size: r * r * 8, tn: r };
    case 'bod': case 'evasion': return { size: r * r * 3, tn: r };
    case 'masking': case 'sensors': return { size: r * r * 2, tn: r };
    case 'hardening': return { size: m * m * r, tn: m };
    case 'responseIncrease': return { size: m * m * r * 2, tn: r * 2 };
    default: return null;
  }
}

// ---------------------------------------------------------------- Otaku (VR2 p. 145; otaku errata)

/** The otaku's living persona (book): MPCP and Masking rounded up, Hardening Willpower ÷ 2 (round up); null with 'v922'. */
export function otakuPersona923(attrs: Record<string, number>): { mpcp: number; masking: number; hardening: number } | null {
  if (V().otaku === 'v922') return null;
  const a = (k: string) => Math.max(0, Number(attrs[k] ?? 0) || 0);
  const mpcp = Math.max(1, Math.ceil((a('intelligence') + a('willpower') + a('charisma')) / 3));
  return { mpcp, masking: Math.min(mpcp, Math.ceil((a('willpower') + a('charisma')) / 2)), hardening: Math.ceil(a('willpower') / 2) };
}

// ---------------------------------------------------------------- Paydata (VR2 p. 65)

/** One paydata file (book): a Paydata Point of 5,000¥, size 2D6 × density by code, defenses by code (null with 'v922'). */
export function paydataFile923(code: string, securityValue: number, sizeDice: readonly number[], defenseDie: number, n: number): { name: string; size: number; value: number; paydata: true; encrypted: number; scramble: number; bomb: number } | null {
  if (V().paydata === 'v922') return null;
  const c = own(V().paydataDensity, code) ?? own(V().paydataDensity, 'orange') ?? 10;
  const d = own(V().paydataDefenses, code) ?? own(V().paydataDefenses, 'orange')!;
  const size = sizeDice.slice(0, 2).reduce((a, b) => a + b, 0) * c;
  const sv = Math.max(1, Math.floor(securityValue || 1));
  const roll = Math.floor(defenseDie);
  const bomb = roll > d.none && (roll <= d.bomb || roll > d.scramble) ? sv : 0;
  const scramble = roll > d.bomb ? sv : 0;
  return { name: `Paydata ${n}`, size, value: Math.max(0, Number(V().paydataPoint) || 0), paydata: true, encrypted: 0, scramble, bomb };
}

// ---------------------------------------------------------------- Psychotropic IC (VR2 pp. 49–50)

export function psychotropicBook(): boolean {
  return V().psychotropic !== 'v922';
}

/** Cyberphobia's TN modifier (book: the IC's rating). */
export function cyberphobiaTn(rating: number): number {
  return psychotropicBook() ? Math.max(0, Math.floor(rating || 0)) : RULES.MATRIX.psychotropic.cyberphobiaTn;
}

/** A psychotropic effect that lasts until the decker recovers (book): a world time far past any campaign. */
export const PSYCHE_UNTIL_RECOVERED = 9e15;

/** Host shutdown (VR2 p. 53): 1D6 per 2 points (or part) of the Security Value; null with 'fixed'. */
export function shutdownDice(securityValue: number): number | null {
  if (V().shutdown !== 'dice') return null;
  return Math.max(1, Math.ceil(Math.max(0, securityValue || 0) / 2));
}
