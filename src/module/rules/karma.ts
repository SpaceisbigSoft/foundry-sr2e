import { RULES } from './config.ts';

/** Karma Pool cost of the next re-roll of a test that has already been re-rolled `rerollsSoFar` times. */
export function karmaRerollCost(rerollsSoFar: number): number {
  const n = Math.max(0, Math.floor(rerollsSoFar) || 0);
  return RULES.KARMA.escalating ? RULES.KARMA.firstRerollCost + n : RULES.KARMA.firstRerollCost;
}

export function avoidDisasterCost(): number {
  return RULES.KARMA.avoidDisasterCost;
}
