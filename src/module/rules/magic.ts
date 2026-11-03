import { RULES, type DamageLevel } from './config.ts';
import { netSuccesses } from './dice.ts';
import { stageForNetSuccesses } from './damage.ts';
import { urrMagSpellTie } from './urr80-magic.ts';

export const SPELL_CATEGORIES = ['combat', 'detection', 'health', 'illusion', 'manipulation'] as const;
export type SpellCategory = (typeof SPELL_CATEGORIES)[number];
export type SpellType = 'mana' | 'physical';

/** Mana spells are resisted with Willpower, physical spells with Body. VERIFY */
export function spellResistAttribute(type: SpellType): 'willpower' | 'body' {
  return type === 'mana' ? 'willpower' : 'body';
}

/** Drain TN: half the Force (rounded down) plus the spell's drain modifier, never below the minimum TN. */
export function drainTargetNumber(force: number, drainModifier: number): number {
  return Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(force / 2) + drainModifier);
}

/** Drain is Stun, unless the spell's Force exceeded the caster's Magic, then it is Physical. VERIFY */
export function drainDamageType(force: number, magic: number): 'stun' | 'physical' {
  return force > magic ? 'physical' : 'stun';
}

export interface SpellOutcome {
  hit: boolean;
  netSuccesses: number;
  /** Damage level after staging; null if the spell was fully resisted or not cast successfully. */
  level: DamageLevel | null;
}

/**
 * Combat spell vs target: the target's resistance successes cancel the caster's; any left over
 * means the spell takes effect and stages its base damage up. No armor applies. VERIFY
 */
export function resolveCombatSpell(opts: {
  casterSuccesses: number;
  resistSuccesses: number;
  level: DamageLevel;
}): SpellOutcome {
  const net = netSuccesses(opts.casterSuccesses, opts.resistSuccesses);
  // v0.80.0 (RULES.URR_V80.magSpellTie 'caster', URR): a tie takes effect at the lowest level.
  const tie = urrMagSpellTie(opts.casterSuccesses, opts.resistSuccesses);
  if (tie) return tie;
  if (net <= 0) return { hit: false, netSuccesses: 0, level: null };
  return { hit: true, netSuccesses: net, level: stageForNetSuccesses(opts.level, net) };
}

/** Force must be a whole number from 1 up to the Force the spell was learned at. */
export function clampForce(force: number, learnedForce: number): number {
  const max = Math.max(1, Math.floor(learnedForce));
  return Math.min(max, Math.max(1, Math.floor(force || 1)));
}
