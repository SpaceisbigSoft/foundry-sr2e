import { RULES, type DamageLevel } from './config.ts';
import { netSuccesses } from './dice.ts';
import { drainDamageType } from './magic.ts';
import { urrMagConjuringDrainLevel, urrMagConjuringDrainType } from './urr80-magic.ts';

export const SPIRIT_KINDS = ['nature', 'elemental', 'watcher', 'ally', 'free', 'other', 'toxic', 'insect'] as const;
export type SpiritKind = (typeof SPIRIT_KINDS)[number];

/** Force must be a whole number of at least 1. */
export function clampSpiritForce(force: number): number {
  return Math.max(1, Math.floor(Number.isFinite(force) ? force : 1));
}

/** Conjuring drain TN: the spirit's Force, never below the minimum TN. VERIFY */
export function conjuringDrainTargetNumber(force: number): number {
  return Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(force));
}

/** Conjuring drain level, from the spirit's Force compared with the conjurer's Charisma. VERIFY */
export function conjuringDrainLevel(force: number, charisma: number): DamageLevel {
  // v0.80.0 (RULES.URR_V80.magConjDrain 'charisma', URR): L only strictly below half Charisma.
  const urr = urrMagConjuringDrainLevel(force, charisma);
  if (urr) return urr;
  for (const [ratio, level] of RULES.CONJURING.drainLevels) {
    if (force <= ratio * charisma) return level;
  }
  return 'D';
}

/** Conjuring drain is Stun, or Physical if the Force exceeds the conjurer's Magic (as for spells). VERIFY */
export function conjuringDrainType(force: number, magic: number, charisma?: number): 'stun' | 'physical' {
  // v0.80.0 (RULES.URR_V80.magConjDrain 'charisma', URR): Physical when the Force is over Charisma.
  if (typeof charisma === 'number') { const urr = urrMagConjuringDrainType(force, charisma); if (urr) return urr; }
  return drainDamageType(force, magic);
}

/** Services owed by a spirit for the successes on the summoning test. */
export function servicesForSuccesses(successes: number): number {
  return Math.max(0, successes) * RULES.CONJURING.servicesPerSuccess;
}

/** A spirit's attribute: its Force plus a per-attribute adjustment, never below 1. */
export function spiritAttribute(force: number, offset: number): number {
  return Math.max(1, force + offset);
}

/** Armor from immunity to normal weapons, if the spirit has it. VERIFY */
export function immunityArmor(force: number, immune: boolean): number {
  return immune ? Math.max(0, force) * RULES.CONJURING.immunityArmorPerForce : 0;
}

/** Most bound elementals a conjurer may hold at once (Infinity if unlimited). VERIFY */
export function maxBoundElementals(charisma: number): number {
  const per = RULES.CONJURING.maxElementalsPerCharisma;
  return per > 0 ? Math.floor(charisma * per) : Infinity;
}

export interface BanishOutcome {
  netSuccesses: number;
  force: number;
  banished: boolean;
}

/** Banishing: the banisher's net successes over the spirit's lower its Force; at 0 it is gone. VERIFY */
export function resolveBanishing(opts: { banisherSuccesses: number; spiritSuccesses: number; force: number }): BanishOutcome {
  const net = Math.max(0, netSuccesses(opts.banisherSuccesses, opts.spiritSuccesses));
  const force = Math.max(0, opts.force - net);
  return { netSuccesses: net, force, banished: force <= 0 };
}
