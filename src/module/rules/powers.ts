import { netSuccesses } from './dice.ts';
import type { Attributes } from './stats.ts';

/** Where a power's dice come from: the user's Force (spirits), the power's own rating, or an attribute. */
export const POWER_DICE_SOURCES = ['force', 'rating', 'body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower', 'magic'] as const;
export type PowerDiceSource = (typeof POWER_DICE_SOURCES)[number];

/** Target number: a fixed number, or one of the target's attributes. */
export const POWER_TN_SOURCES = ['fixed', 'body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'] as const;
export type PowerTnSource = (typeof POWER_TN_SOURCES)[number];

/** How the target resists: not at all, or with an attribute vs the power's potency. */
export const POWER_RESIST = ['none', 'body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'] as const;
export type PowerResist = (typeof POWER_RESIST)[number];

export interface PowerUser {
  attributes: Attributes;
  force?: number;
  magic?: number;
}

/** The power's rating: dice rolled to use it, and the TN for resisting it. Never below 0. */
export function powerPotency(source: PowerDiceSource, rating: number, user: PowerUser): number {
  let v: number;
  if (source === 'force') v = user.force ?? rating;
  else if (source === 'rating') v = rating;
  else if (source === 'magic') v = user.magic ?? 0;
  else v = user.attributes[source];
  return Math.max(0, Math.floor(Number.isFinite(v) ? v : 0));
}

/** The test's TN: a target's attribute when one is named and a target is known, else the fixed TN. */
export function powerTargetNumber(source: PowerTnSource, fixed: number, target: Attributes | null): { value: number; fromTarget: boolean } {
  if (source !== 'fixed' && target) return { value: target[source], fromTarget: true };
  return { value: fixed, fromTarget: false };
}

/** An effect-only power after resistance: net successes measure how well it worked. */
export function resolvePowerEffect(userSuccesses: number, resistSuccesses: number): { hit: boolean; netSuccesses: number } {
  const net = netSuccesses(userSuccesses, resistSuccesses);
  return { hit: net > 0, netSuccesses: net };
}
