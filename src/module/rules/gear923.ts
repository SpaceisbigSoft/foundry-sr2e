import { RULES, type DamageLevel } from './config.ts';
import { GEAR_V923_TABLES as T } from './config923/gear.ts';
import { num, round2, own } from './util.ts';

/**
 * v0.92.3 book alignment, gear, cyberware and bioware (RULES.GEAR_V923). Pure rules, no Foundry dependency.
 * The Unified Rules Revamp is the book's rules plus its own changes: under the Revamp source a switch for a rule the
 * Revamp changes itself (REVAMP_GEAR_RULES) reads as its old choice, so the Revamp's rule decides as before; every
 * other switch (a book correction the Revamp is silent on) reads the same under either source.
 */

type G = typeof RULES.GEAR_V923;
const BOOK: { [K in keyof G]: G[K] } = {
  grades: 'book', essenceZero: 'survive', dermal: 'body', limbPairs: 'body', limbHoused: 'book', boneLacing: 'book',
  bioware: 'book', wareTables: 'book', awakenedBioware: 'essence', overBodyIndex: 'shock',
  cultured: 'book', adrenalCrash: 'book', load: 'book', armorEncumbrance: 'book', surgery: 'book',
  cyberDamage: 'book', filtration: 'opposed',
};

/**
 * The GEAR_V923 switches for rules the Revamp changes itself: armorEncumbrance (heavy armor and the Combat Pool: the
 * Revamp's own URR_V80.cbtArmorPool).
 */
export const REVAMP_GEAR_RULES: ReadonlySet<keyof G> = new Set<keyof G>(['armorEncumbrance']);

/** Whether a GEAR_V923 switch is at the book's way (under the Revamp source never for REVAMP_GEAR_RULES). */
export function gearBook(key: keyof G): boolean {
  if ((RULES as any).URR_V80?.active && REVAMP_GEAR_RULES.has(key)) return false;
  return (RULES as any).GEAR_V923?.[key] === BOOK[key];
}

// ---------------------------------------------------------------- Grades (rows 2, 4, 5)

/** The Essence multiplier for a grade. */
export function gradeEssenceFactor(grade: string): number {
  const t = gearBook('grades') ? T.gradeEssence : (RULES.GRADE_ESSENCE_MULTIPLIER as Record<string, number>);
  return own(t, grade) ?? 1;
}

/** The nuyen multiplier for a grade. */
export function gradeCostFactor(grade: string): number {
  const t = gearBook('grades') ? T.gradeCost : (RULES.CYBERWARE.gradeCost as Record<string, number>);
  return own(t, grade) ?? 1;
}

/**
 * Essence after the grade: the book rounds up (to the hundredth) and never goes below .05 (a base cost under .05
 * keeps its own); the old way rounds to the hundredth.
 */
export function gradedEssence(base: number, grade: string): number {
  const b = Math.max(0, num(base));
  const f = gradeEssenceFactor(grade);
  if (!gearBook('grades') || f === 1) return round2(b * f);
  const up = Math.ceil(round2(b * f * 100 * 1000) / 1000) / 100;
  return round2(Math.max(up, Math.min(b, T.gradeMinEssence)));
}

// ---------------------------------------------------------------- Essence 0 (row 9)

/** Whether this Essence (before it is floored at 0) kills. */
export function essenceKills(rawEssence: number): boolean {
  return gearBook('essenceZero') ? rawEssence < 0 : rawEssence <= 0;
}

// ---------------------------------------------------------------- Dermal plating and cyberlimbs (rows 39, 43, 44)

/** Whether a cyberware item is dermal plating (by its name; not bioware, not a cyberlimb). */
export function isDermalPlating(i: { name?: string; bioware?: boolean; kind?: string }): boolean {
  return !i.bioware && i.kind !== 'cyberlimb' && /dermal\s*(?:plat|armou?r)/i.test(String(i.name ?? ''));
}

/** Dermal plating's rating: its rating, else its armor (the old template keeps it there). */
export function dermalRating(i: { rating?: number; armorBallistic?: number; armorImpact?: number }): number {
  return Math.max(0, Math.floor(Math.max(num(i.rating), num(i.armorBallistic), num(i.armorImpact))));
}

const PARTIAL_LIMB = /hand|foot|feet|fore\s*-?arm|lower\s*(?:arm|leg)|partial/i;

/** Full cyberlimbs by location; partial limbs, hands and feet don't count. */
function fullLimbs(limbs: ReadonlyArray<{ name?: string; location?: string }>): Set<string> {
  return new Set(limbs.filter((l) => !PARTIAL_LIMB.test(String(l.name ?? ''))).map((l) => String(l.location ?? '')));
}

/** Body from pairs of full cyberlimbs: +1 for both arms, +1 for both legs (Core p. 249; Cybertechnology p. 49). */
export function limbPairsBody(limbs: ReadonlyArray<{ name?: string; location?: string }>): number {
  if (!gearBook('limbPairs')) return 0;
  const at = fullLimbs(limbs);
  return (at.has('leftArm') && at.has('rightArm') ? 1 : 0) + (at.has('leftLeg') && at.has('rightLeg') ? 1 : 0);
}

/**
 * The Essence a piece of ware housed in a cyberlimb costs (before grade): null = the old way (no Essence, the limb's
 * capacity); otherwise the Cybertechnology p. 49 table, or its full cost.
 */
export function housedEssenceCost(i: { name?: string; essenceCost?: number }): number | null {
  if (!gearBook('limbHoused')) return null;
  const base = Math.max(0, num(i.essenceCost));
  const name = String(i.name ?? '');
  for (const row of T.limbHoused) {
    if (!new RegExp(row.re, 'i').test(name)) continue;
    if (row.essence !== undefined) return Math.min(base, row.essence);
    // "−25% (round down)".
    return Math.floor(base * (row.factor ?? 1) * 100) / 100;
  }
  return base;
}

// ---------------------------------------------------------------- Bone lacing (row 48)

export interface LacingBook { body: number; impact: number; ballistic: number }

/**
 * Bone lacing by the book (Shadowtech p. 42), less with cyber replacements (Cybertechnology pp. 49–50): three
 * replacements take 1 off its armor, more take every bonus away. Zeros under the old way.
 */
export function boneLacingBook(kind: string, replacements = 0): LacingBook {
  const none = { body: 0, impact: 0, ballistic: 0 };
  const r = gearBook('boneLacing') ? own(T.boneLacing, kind) : undefined;
  if (!r) return none;
  const n = Math.max(0, Math.floor(num(replacements)));
  if (n > 3) return none;
  if (n === 3) return { body: r.body, impact: Math.max(0, r.impact - 1), ballistic: Math.max(0, r.ballistic - 1) };
  return { ...r };
}

/** Cyber replacements for bone lacing: each full or partial cyberlimb, cyberskull or cybertorso. */
export function cyberReplacements(ware: ReadonlyArray<{ name?: string; kind?: string }>): number {
  return ware.filter((w) => w.kind === 'cyberlimb' || /cyber\s*-?(?:skull|torso)/i.test(String(w.name ?? ''))).length;
}

// ---------------------------------------------------------------- Bioware (rows 63–78)

/** Shadowtech's effects for a bioware kind at a rating (only the parts that differ from RULES.BIOWARE.effects). */
export function bioBookEffect(kind: string, rating: number): null | { attributes?: Record<string, number>; reaction?: number; impact?: number; ballistic?: number; physicalSkillDice?: number; allActiveDice?: number; perceptionTn?: number; taskPool?: number; reactionFromQuickness?: boolean } {
  if (!gearBook('bioware')) return null;
  const r = Math.max(0, Math.floor(num(rating)));
  if (r <= 0) return null;
  switch (kind) {
    case 'muscleAugmentation': return { attributes: { strength: r, quickness: r } };
    case 'adrenalPump': return { attributes: { quickness: r, strength: r, willpower: r }, reaction: 2 * r, reactionFromQuickness: false };
    case 'cerebralBooster': return { attributes: { intelligence: Math.min(2, r) }, taskPool: r >= 2 ? 1 : 0 };
    case 'orthoskin': { const row = T.orthoskin[Math.min(T.orthoskin.length, r) - 1]!; return { impact: row[0], ballistic: row[1] }; }
    case 'enhancedArticulation': return { physicalSkillDice: 0, allActiveDice: 1, reaction: 1 };
    case 'painEditor': return { attributes: { willpower: 1, intelligence: -1 }, perceptionTn: 0 };
    default: return null;
  }
}

/** The Essence a magician or adept pays for bioware: its Body Cost (Shadowtech p. 5); 0 under the old way. */
export function awakenedBioEssence(bodyCost: number, awakened: boolean): number {
  return awakened && gearBook('awakenedBioware') ? Math.max(0, num(bodyCost)) : 0;
}

/** System shock over the Body Index: +1 TN per point (or part) over, on Body tests (Shadowtech p. 6). */
export function systemShockTn(used: number, max: number): number {
  if (!gearBook('overBodyIndex')) return 0;
  const over = round2(num(used) - num(max));
  return over > 0 ? Math.ceil(over) : 0;
}

/** Neural bioware (always cultured; listed cost and Body Cost already count it; Shadowtech p. 6). */
export const NEURAL_BIOWARE = ['cerebralBooster', 'synapticAccelerator', 'damageCompensator', 'painEditor', 'traumaDamper', 'mnemonicEnhancer', 'reflexRecorder'] as const;

export function isNeuralBio(kind: string, name = ''): boolean {
  return (NEURAL_BIOWARE as readonly string[]).includes(kind) || /mnemonic|reflex\s*recorder|cerebral|synaptic|damage\s*compens|pain\s*editor|trauma\s*damper/i.test(name);
}

/** Cultured bioware's Body Cost (× .75, neural ware already counted). */
export function culturedBodyCost(bodyCost: number, cultured: boolean, kind: string, name = ''): number {
  const b = Math.max(0, num(bodyCost));
  if (!gearBook('cultured') || !cultured || isNeuralBio(kind, name)) return b;
  return round2(b * T.culturedBodyCost);
}

/** Whether the cultured price multiplier applies (never on neural ware under the book: it is in the list price). */
export function culturedPriceApplies(cultured: boolean, kind: string, name = ''): boolean {
  if (!cultured) return false;
  return !(gearBook('cultured') && isNeuralBio(kind, name));
}

/** The adrenal pump's crash by the book: Deadly Stun, Power = half the turns active, rounded down (min 1). */
export function adrenalCrashBook(turns: number): { attribute: 'body'; tn: number; level: DamageLevel } {
  return { attribute: 'body', tn: Math.max(1, Math.floor(Math.max(0, num(turns)) / 2)), level: 'D' };
}

// ---------------------------------------------------------------- Carrying and heavy armor (rows 102, 103)

export interface BookLoad { kg: number; limit: number; penalty: number; step: number; level: string; boxes: number; move: number; run: boolean; passOut: boolean }

/** Carrying by the book (Core p. 185). `penalty` stays 0 (Quickness isn't lowered). */
export function bookLoad(kg: number, strength: number): BookLoad {
  const s = Math.max(0, num(strength));
  const w = Math.max(0, num(kg));
  let step = 0;
  for (let i = 0; i < T.load.length; i++) if (w > s * T.load[i]!.times) step = i + 1;
  const passOut = step >= T.load.length;
  const row = T.load[Math.min(step, T.load.length - 1)]!;
  const effective = step === 0 ? T.load[0]! : row;
  return { kg: Math.round(w * 10) / 10, limit: s * T.load[0]!.times, penalty: 0, step, level: step === 0 ? '' : effective.level, boxes: step === 0 ? 0 : effective.boxes, move: step === 0 ? 1 : effective.move, run: step === 0 ? true : effective.run, passOut };
}

/** Heavy armor: partial and full suits (by name). */
export function isHeavyArmor(name: string): boolean {
  return /heavy|partial\s*suit|full\s*suit|military\s*(?:grade\s*)?armou?r|milspec/i.test(String(name ?? ''));
}

/**
 * Heavy armor's Combat Pool penalty (Core p. 84): 1 die per point of the heavy armor's Ballistic (a helmet worn with it
 * adds) over Quickness. 0 without heavy armor.
 */
export function heavyArmorPoolPenalty(worn: ReadonlyArray<{ name: string; ballistic: number; adds?: boolean }>, quickness: number): number {
  const heavy = worn.filter((w) => isHeavyArmor(w.name));
  if (!heavy.length) return 0;
  const best = Math.max(0, ...heavy.map((w) => num(w.ballistic)));
  const adds = worn.filter((w) => w.adds && !isHeavyArmor(w.name) && /helmet/i.test(w.name)).reduce((n, w) => n + num(w.ballistic), 0);
  return Math.max(0, best + adds - Math.max(0, num(quickness)));
}

// ---------------------------------------------------------------- Surgery (rows 14, 15)

/** The book's surgery TN: 10 − the Essence the patient ends up with, rounded down (never below 2). */
export function surgeryTnBook(essenceAfter: number): number {
  return Math.max(2, 10 - Math.floor(Math.max(0, num(essenceAfter))));
}

/** The Essence cost factor for the surgeon's successes (Cybertechnology p. 54). */
export function surgeryEssenceFactor(successes: number): number {
  const s = Math.max(0, Math.floor(num(successes)));
  for (const [min, f] of T.surgeryEssence) if (s >= min) return f;
  return 1.15;
}

/** A cost after the surgery's change, rounded up to the hundredth. */
export function surgeryEssenceCost(base: number, successes: number): number {
  return Math.ceil(round2(Math.max(0, num(base)) * surgeryEssenceFactor(successes) * 100 * 1000) / 1000) / 100;
}

// ---------------------------------------------------------------- System damage (rows 7, 17)

/** How many systems a wound can hit: 1D6 − 4 (Serious) or − 2 (Deadly); 0 for anything else. */
export function systemsHit(level: string, die: number): number {
  const less = own(T.systemsHitLess, level);
  return less === undefined ? 0 : Math.max(0, Math.floor(num(die)) - less);
}

/** A system's damage from its die (0–7): '' none, L, M, S, D, or 'X' destroyed. */
export function systemDamage(die: number): string {
  const d = Math.max(0, Math.min(7, Math.floor(num(die))));
  return T.systemDamage[d] ?? '';
}

/** Graded ware's resistance: 5 dice vs this TN (null: standard ware, no test). */
export function gradeResistTn(grade: string, level: string): number | null {
  const row = own(T.gradeResist, grade) ?? null;
  if (!row) return null;
  return level === 'D' ? row[1] : row[0];
}

/** Whether damage of this level stops a system working (Moderate or worse). */
export function systemStops(damage: string): boolean {
  return damage === 'M' || damage === 'S' || damage === 'D' || damage === 'X';
}
