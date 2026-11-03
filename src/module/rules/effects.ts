/**
 * v0.56.0: one shape for what a sustained spell or a critter / spirit power puts on its target
 * (kept in the target's `powerEffects` flag and summed in prepareDerivedData).
 */
import type { Attributes } from './stats.ts';

type AttributeKey = keyof Attributes;

export interface EffectBundle {
  /** Attribute changes (may be negative). */
  attributes: Partial<Record<AttributeKey, number>>;
  reaction: number;
  initiativeDice: number;
  /** Armor added (ballistic / impact). */
  ballistic: number;
  impact: number;
  /** TN added to every test the bearer makes. */
  testsTn: number;
  /** TN added to tests to perceive the bearer. */
  perceivedTn: number;
  /** TN added to attacks and spells against the bearer. */
  attackedTn: number;
  /** Movement multiplied by this (1 = unchanged; below 1 divides). */
  movementFactor: number;
}

export const EFFECT_NUMBER_KEYS = ['reaction', 'initiativeDice', 'ballistic', 'impact', 'testsTn', 'perceivedTn', 'attackedTn'] as const;
export type EffectNumberKey = (typeof EFFECT_NUMBER_KEYS)[number];

export function emptyBundle(): EffectBundle {
  return { attributes: {}, reaction: 0, initiativeDice: 0, ballistic: 0, impact: 0, testsTn: 0, perceivedTn: 0, attackedTn: 0, movementFactor: 1 };
}
