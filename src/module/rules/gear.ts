import type { BarrierAttackKind } from './config78.ts';
import { RULES } from './config.ts';
import { t as tx, tList } from '../helpers/i18n.ts';

/** Gear and combat leftovers (v0.37.0): armor layering, load, muzzle devices, tracers, barriers, demolitions. */

const C = () => RULES.COMBAT;

export interface ArmorPiece { ballistic: number; impact: number; adds?: boolean; degraded?: number }

/** Worn armor of one kind under the layering rule (degraded points come off each piece). */
export function armorTotal(pieces: ArmorPiece[], kind: 'ballistic' | 'impact'): number {
  const v = (p: ArmorPiece) => Math.max(0, (p[kind] ?? 0) - Math.max(0, p.degraded ?? 0));
  const adds = pieces.filter((p) => p.adds).reduce((n, p) => n + v(p), 0);
  const rest = pieces.filter((p) => !p.adds).map(v).sort((a, b) => b - a);
  const mode = C().armorLayering;
  if (mode === 'sum') return adds + rest.reduce((n, x) => n + x, 0);
  const best = rest[0] ?? 0;
  // v0.80.0 (RULES.URR_V80.cbtArmorLayers, URR): two layers at most, so only the next piece adds half.
  if (mode === 'highestPlusHalf') return adds + best + rest.slice(1, RULES.URR_V80.cbtArmorLayers ? 2 : undefined).reduce((n, x) => n + Math.floor(x / 2), 0);
  return adds + best;
}

/** Carried weight: the limit and the Quickness lost (0 within it). */
export function carriedLoad(kg: number, strength: number): { kg: number; limit: number; penalty: number } {
  const l = C().load;
  const limit = Math.max(0, strength) * l.kgPerStrength;
  const step = Math.max(1, strength) * l.stepKgPerStrength;
  const over = Math.max(0, kg - limit);
  return { kg: Math.round(kg * 10) / 10, limit, penalty: l.enabled && over > 0 ? Math.ceil(over / step) * l.penaltyPerStep : 0 };
}

/** A muzzle device: whether the firing mode is allowed, and the Perception TN to notice the shot. */
export function muzzleCheck(muzzle: string, mode: string): { ok: boolean; perceptionTn: number; reason: string } {
  if (muzzle === 'silencer') {
    const ok = !mode || C().silencer.modes.includes(mode);
    return { ok, perceptionTn: C().silencer.perceptionTn, reason: ok ? '' : tx('SR2E.Text.Gear.aSilencerWorksOnlyWith', { modes: tList(C().silencer.modes, 'disjunction') }) };
  }
  if (muzzle === 'suppressor') return { ok: true, perceptionTn: C().suppressor.perceptionTn, reason: '' };
  return { ok: true, perceptionTn: 0, reason: '' };
}

/**
 * Tracers in burst or full auto: the TN bonus from bursts already fired this phase (every 3 earlier
 * rounds count as one burst; v0.81.0: 1-2 earlier rounds, e.g. a single shot, give nothing).
 */
export function tracerModifier(o: { ammo: string; mode: string; earlierRounds: number }): number {
  if (o.ammo !== 'tracer' || !['BF', 'FA'].includes(o.mode)) return 0;
  const bursts = Math.floor(Math.max(0, Number(o.earlierRounds) || 0) / 3);
  const per = Number(C().tracer.tnPerBurst) || 0;
  if (!bursts || !per) return 0;
  // v0.81.0: capped at the size of maxTn either way (as chaseSpeedModifier), so a positive house-rule step can't flip the cap.
  const cap = Math.abs(Number(C().tracer.maxTn) || 0);
  return per < 0 ? Math.max(-cap, bursts * per) : Math.min(cap, bursts * per);
}

/** Damage to a barrier: Power over its rating (× for anti-vehicle or shaped charges), off its rating. */
export function barrierDamage(o: { rating: number; power: number; antiVehicle?: boolean; shaped?: boolean; kind?: BarrierAttackKind; door?: 'none' | 'ordinary' | 'security'; full?: number }): { damage: number; left: number; breached: boolean; holes: number; adjusted: number } {
  const b = C().barriers;
  const mult = o.shaped ? b.shapedMultiplier : o.antiVehicle ? b.avMultiplier : 1;
  const P = Math.floor(Math.max(0, Number(o.power) || 0) * mult);
  const rating = Math.max(0, Math.floor(Number(o.rating) || 0));
  const B = RULES.BOOK_V78.barriers;
  if (B.mode === 'book') {
    // v0.78.0 (RULES.BOOK_V78.barriers 'book', Core Rules barrier table): the rating is doubled against firearms, melee
    // and combat spells; below half the adjusted rating nothing; up to it −1; above it −1 and a ½ m hole per
    // half-rating step over. An ordinary door breaks at half its rating, a security door at 0. VERIFY (the top row).
    const adjusted = rating * Math.max(1, Number(B.ratingMultiplier[o.kind ?? 'firearm'] ?? 1));
    const half = adjusted / 2;
    let damage = 0, holes = 0;
    if (rating > 0 && P >= half) {
      damage = 1;
      if (P > adjusted) holes = Math.max(1, Math.floor((P - adjusted) / Math.max(0.5, half)));
    }
    const left = Math.max(0, rating - damage);
    const full = Math.max(rating, Math.floor(Number(o.full ?? rating) || rating));
    const doorBreaks = B.doors && o.door === 'ordinary' && left <= Math.floor(full / 2);
    return { damage, left, breached: rating > 0 && (left === 0 || (damage > 0 && doorBreaks)), holes, adjusted };
  }
  const damage = Math.max(0, P - rating);
  const left = Math.max(0, rating - damage);
  return { damage, left, breached: rating > 0 && left === 0, holes: 0, adjusted: rating };
}

/** A set charge: its Power after the Demolitions test. */
export function chargePower(base: number, successes: number): number {
  return Math.max(0, base + Math.max(0, successes) * C().demolitions.powerPerSuccess);
}

/** Where a thrown-back grenade lands: metres of scatter from the original thrower (d6 − successes). */
export function throwBackScatter(rolled: number, successes: number): number {
  return Math.max(0, rolled - Math.max(0, successes));
}
