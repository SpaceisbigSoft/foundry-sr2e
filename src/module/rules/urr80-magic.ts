/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: magic): pure functions. Each reads its switch in
 * RULES.URR_V80 (config80-magic.ts) and behaves the book way while the switch is at its shipped value.
 */
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

const U = () => RULES.URR_V80;
const whole = (v: unknown) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : 0; };

// ---------------------------------------------------------------- Sorcery

/** Base dice of a spell success test: the Sorcery dice (book), or the Force under 'force'. Innate casters keep theirs. */
export function urrMagCastingDice(o: { dice: number; force: number; innate?: boolean }): number {
  if (U().magCastDice !== 'force' || o.innate) return Math.max(0, whole(o.dice));
  return Math.max(0, whole(o.force));
}

/** A ranged manipulation (elemental) spell's TN: the spell's own (book), or the Revamp's fixed TN. */
export function urrMagElementalTn(spellTn: number): number {
  const t = whole(U().magElementalTn);
  return t > 0 ? t : Number(spellTn);
}

/** Drain TN modifiers from a disaster (all ones) on the casting test; none in the book. */
export function urrMagRuleOfOneDrain(botch: boolean): TargetNumberModifier[] {
  const v = whole(U().magRuleOfOneDrain);
  return botch && v ? [{ id: 'ruleOfOneOnTheCasting', label: tx('SR2E.Card.Mod.ruleOfOneOnTheCasting'), value: v }] : [];
}

/**
 * A tie on a damaging spell: under 'caster' a tie with at least one caster success takes effect at Light damage.
 * Null when the book applies (no effect without a net success).
 */
export function urrMagSpellTie(casterSuccesses: number, resistSuccesses: number): { hit: true; netSuccesses: 0; level: DamageLevel } | null {
  if (U().magSpellTie !== 'caster') return null;
  const c = whole(casterSuccesses);
  return c > 0 && c === whole(resistSuccesses) ? { hit: true, netSuccesses: 0, level: 'L' } : null;
}

/** Why one more self-sustained spell is too many (Sorcery-rating limit), or null. */
export function urrMagSustainCapProblem(sustained: ReadonlyArray<{ focusId?: string; quickened?: boolean; spiritUuid?: string }>, sorcery: number): string | null {
  if (U().magSustainCap === 'off') return null;
  const own = (sustained ?? []).filter((s) => !s.focusId && !s.quickened && !s.spiritUuid).length;
  const cap = Math.max(0, whole(sorcery));
  return own >= cap ? tCount(cap, 'SR2E.Text.Urr80Magic.canSustainAtMost') : null;
}

/** Extra Force an exclusive or fetish spell takes effect at (drain stays at the normal Force); 0 in the book. */
export function urrMagSpellForceBonus(o: { exclusive?: boolean; fetish?: boolean }): number {
  return (o.exclusive ? Math.max(0, whole(U().magExclusiveForce)) : 0) + (o.fetish ? Math.max(0, whole(U().magFetishForce)) : 0);
}

/** Learning a spell: the TN multiplier on the Force (book 1, 'theory' 2). */
export function urrMagLearnTnFactor(): number {
  return U().magLearning === 'theory' ? 2 : 1;
}

/** Learning a spell: Magical Theory dice added to Sorcery ('theory'); 0 in the book. */
export function urrMagLearnExtraDice(theoryRating: number): number {
  return U().magLearning === 'theory' ? Math.max(0, whole(theoryRating)) : 0;
}

// ---------------------------------------------------------------- Ritual sorcery

/**
 * Why this ritual can't go ahead, or null: a combat spell (magRitualNoCombat), or more members than the lowest
 * Sorcery rating among them (magRitualTeamCap; `sorcery` = every member's rating, leader and spotter included).
 */
export function urrMagRitualProblem(o: { category: string; sorcery: readonly number[] }): string | null {
  if (U().magRitualNoCombat && String(o.category ?? '') === 'combat') return tx('SR2E.Text.Urr80Magic.combatSpellsCannotBeCast');
  if (U().magRitualTeamCap && o.sorcery.length) {
    const low = Math.max(0, Math.min(...o.sorcery.map(whole)));
    if (o.sorcery.length > low) return tCount(low, 'SR2E.Text.Urr80Magic.aRitualTeamCanHave', { size: o.sorcery.length });
  }
  return null;
}

/** Ritual materials in nuyen by spell category ('category'), or null for the book's per-Force cost. */
export function urrMagRitualMaterials(force: number, category: string): number | null {
  if (U().magRitualMaterials !== 'category') return null;
  const per = Number(U().magRitualMaterialsPerForce[String(category ?? '').toLowerCase()] ?? 0) || 0;
  return Math.max(0, force) * per;
}

/** The TN a ritual spell is resisted against: { resistTn } when the leader's Sorcery is higher ('leader'), else {}. */
export function urrMagRitualResistTn(force: number, leaderSorcery: number): { resistTn?: number } {
  if (U().magRitualResistTn !== 'leader') return {};
  const s = whole(leaderSorcery);
  return s > whole(force) ? { resistTn: s } : {};
}

// ---------------------------------------------------------------- Conjuring

/** Conjuring drain level under 'charisma': L below half Charisma (strictly), else the table. Null = the book. */
export function urrMagConjuringDrainLevel(force: number, charisma: number): DamageLevel | null {
  if (U().magConjDrain !== 'charisma') return null;
  const f = Math.floor(force);
  const levels = RULES.CONJURING.drainLevels;
  for (let i = 0; i < levels.length; i++) {
    const [ratio, level] = levels[i]!;
    // The first band (L) is "less than", the rest "up to".
    if (i === 0 ? f < ratio * charisma : f <= ratio * charisma) return level;
  }
  return 'D';
}

/** Conjuring drain type under 'charisma': Physical when Force is over Charisma. Null = the book. */
export function urrMagConjuringDrainType(force: number, charisma: number): 'stun' | 'physical' | null {
  if (U().magConjDrain !== 'charisma') return null;
  return Math.floor(force) > Math.floor(charisma) ? 'physical' : 'stun';
}

/** One nature spirit in service at a time: a warning when one already serves, else null. */
export function urrMagNatureSpiritConflict(serving: number): string | null {
  return U().magNatureOneOnly && whole(serving) > 0 ? tx('SR2E.Text.Urr80Magic.aNatureSpiritAlreadyServes') : null;
}

// ---------------------------------------------------------------- Astral

/** Astral Reaction multiplier on Intelligence (book 1). */
export function urrMagAstralReactionFactor(): number {
  const m = Number(U().magAstralReaction);
  return Number.isFinite(m) && m > 0 ? m : 1;
}

/** Essence lost for `over` hours past the limit: full hours only under magProjFullHours, else null (the book). */
export function urrMagProjectionHours(over: number): number | null {
  return U().magProjFullHours ? Math.max(0, Math.floor(over + 1e-9)) : null;
}

/** The best active, bonded weapon focus's rating. */
export function urrMagWeaponFocusRating(foci: ReadonlyArray<{ focusType: string; rating: number; active: boolean; bonded?: boolean }>): number {
  return (foci ?? []).filter((f) => f.focusType === 'weapon' && f.active && f.bonded !== false && f.rating > 0).reduce((m, f) => Math.max(m, whole(f.rating)), 0);
}

/** A magician's astral attack Power and level ('urr': unarmed L; with a weapon focus + its rating at M). */
export function urrMagAstralDamage(o: { mode: string; power: number; level: DamageLevel; focusRating: number }): { power: number; level: DamageLevel; note: string } {
  if (U().magAstralDamage !== 'urr' || o.mode !== 'magician') return { power: o.power, level: o.level, note: '' };
  const f = Math.max(0, whole(o.focusRating));
  return f > 0 ? { power: o.power + f, level: 'M', note: ` [weapon focus +${f} Power]` } : { power: o.power, level: 'L', note: '' };
}

/** Astral tracking: −2 TN when the Force is at most the tracker's Sorcery, +2 when higher (magTrackRating). */
export function urrMagTrackingMods(force: number, trackerSorcery: number): TargetNumberModifier[] {
  if (!U().magTrackRating || !(whole(force) > 0)) return [];
  return whole(force) <= whole(trackerSorcery)
    ? [{ id: 'forceWithinYourSorcery', label: tx('SR2E.Card.Mod.forceWithinYourSorcery'), value: -2 }]
    : [{ id: 'forceOverYourSorcery', label: tx('SR2E.Card.Mod.forceOverYourSorcery'), value: 2 }];
}

/** Drain from a spell cast while projecting is Physical (magAstralDrainPhysical); otherwise the type given. */
export function urrMagAstralDrainType(type: 'stun' | 'physical', astralMode: string | undefined): 'stun' | 'physical' {
  return U().magAstralDrainPhysical && astralMode === 'projecting' ? 'physical' : type;
}

/** Aspected sorcerers and conjurers have no astral access (magAspectedNoAstral): their mode is physical. */
export function urrMagAstralModeFor<M extends string>(tradition: string, mode: M): M | 'physical' {
  return U().magAspectedNoAstral && ['sorcerer', 'conjurer'].includes(String(tradition ?? '')) ? 'physical' : mode;
}

// ---------------------------------------------------------------- Wards and sites

/** Ward drain under 'urr': TN = Force + successes, always Stun. Null = the book. */
export function urrMagWardDrain(force: number, successes: number): { drainTn: number; type: 'stun' } | null {
  if (U().magWardDrain !== 'urr') return null;
  return { drainTn: Math.max(RULES.MIN_TARGET_NUMBER, whole(force) + Math.max(0, whole(successes))), type: 'stun' };
}

/** Why a ward of this Force is too strong for the team's combined Magic, or null. */
export function urrMagWardForceProblem(force: number, combinedMagic: number): string | null {
  const m = whole(U().magWardMaxForce);
  if (!(m > 0)) return null;
  const cap = m * Math.max(0, whole(combinedMagic));
  return whole(force) > cap ? tx('SR2E.Text.Urr80Magic.aWardsForceCanBe', { cap, m, magic: whole(combinedMagic) }) : null;
}

/** Raising a site under 'urr': a library costs rating² × the price; a circle takes hours (as days). Null = the book. */
export function urrMagSiteCost(kind: string, from: number, to: number, perRating: number, daysPerRating: number): { nuyen: number; days: number } | null {
  if (U().magSiteCost !== 'urr') return null;
  const a = Math.max(0, whole(from)), b = Math.max(0, whole(to));
  const diff = Math.max(0, b - a);
  const nuyen = kind === 'library' ? Math.max(0, b * b - a * a) * perRating : diff * perRating;
  const days = kind === 'circle' ? Math.round((diff / 24) * 100) / 100 : diff * daysPerRating;
  return { nuyen, days };
}

// ---------------------------------------------------------------- Traditions

/** Shamanists get no totem dice (magShamanistNoTotem). */
export function urrMagNoTotemDice(tradition: string): boolean {
  return Boolean(U().magShamanistNoTotem) && String(tradition ?? '') === 'shamanist';
}

/** Physical adepts use only weapon foci (magAdeptFoci). */
export function urrMagAdeptFoci<F extends { focusType: string }>(tradition: string, foci: F[]): F[] {
  return U().magAdeptFoci && String(tradition ?? '') === 'adept' ? foci.filter((f) => f.focusType === 'weapon') : foci;
}

// ---------------------------------------------------------------- Magic loss

/** The Magic loss test: lost on a total below the threshold (book), or at or below it (magLossLe). */
export function urrMagLossHit(total: number, threshold: number): boolean {
  return U().magLossLe ? total <= threshold : total < threshold;
}
