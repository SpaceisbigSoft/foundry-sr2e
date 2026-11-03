import { RULES, type DamageLevel, type RangeBand } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { netSuccesses } from './dice.ts';
import { stageForNetSuccesses } from './damage.ts';
import { t as tx } from '../helpers/i18n.ts';

export const RANGE_BANDS = ['short', 'medium', 'long', 'extreme'] as const;

export interface RangeLimits {
  short: number;
  medium: number;
  long: number;
  extreme: number;
}

/**
 * Which range band a distance falls in for a weapon, or null if the target is beyond
 * extreme range. A distance exactly on a limit belongs to the nearer band.
 */
export function rangeBandForDistance(distance: number, limits: RangeLimits): RangeBand | null {
  for (const band of RANGE_BANDS) {
    if (distance <= limits[band]) return band;
  }
  return null;
}

/** Base TN and its label for an attack: melee has one base, ranged depends on the range band. */
export function attackBaseTargetNumber(opts: { melee: boolean; range?: RangeBand }): TargetNumberModifier {
  if (opts.melee) return { id: 'melee', label: tx('SR2E.Card.Mod.melee'), value: RULES.MELEE_BASE_TN };
  const band = opts.range ?? 'short';
  return { label: tx('SR2E.Card.Mod.range', { band }), value: RULES.RANGE_TN[band] };
}

/** Ranged attacks are stopped by ballistic armor, melee attacks by impact armor. */
export function armorKindFor(melee: boolean): 'ballistic' | 'impact' {
  return melee ? 'impact' : 'ballistic';
}

export interface AttackOutcome {
  hit: boolean;
  /** Attacker successes minus defender successes, never negative. */
  netSuccesses: number;
  power: number;
  /** Damage level after staging up for net successes; null on a miss. */
  level: DamageLevel | null;
}

/** Opposed attack: the defender's successes cancel the attacker's; any left over is a hit and stages the damage. */
export function resolveAttack(opts: {
  attackSuccesses: number;
  defenseSuccesses: number;
  power: number;
  level: DamageLevel;
}): AttackOutcome {
  const net = netSuccesses(opts.attackSuccesses, opts.defenseSuccesses);
  if (net <= 0) return { hit: false, netSuccesses: 0, power: opts.power, level: null };
  return { hit: true, netSuccesses: net, power: opts.power, level: stageForNetSuccesses(opts.level, net) };
}
