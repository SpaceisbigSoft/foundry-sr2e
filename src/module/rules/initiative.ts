import { RULES } from './config.ts';
import type { DiceRoller } from './dice.ts';

export interface InitiativeResult {
  score: number;
  reaction: number;
  dice: number[];
}

/** Initiative = Reaction + Nd6 (N = 1 plus bonus dice from wired reflexes, spells, etc.). */
export async function rollInitiative(opts: {
  reaction: number;
  bonusDice?: number;
  roll: DiceRoller;
}): Promise<InitiativeResult> {
  const count = RULES.BASE_INITIATIVE_DICE + Math.max(0, opts.bonusDice ?? 0);
  const dice = await opts.roll(count);
  return { score: opts.reaction + dice.reduce((a, b) => a + b, 0), reaction: opts.reaction, dice };
}

// v0.81.0: the pass helpers (actingOnPass, passesInTurn, turnOrderForPass) were removed: the Combat class
// handles passes itself (documents/index.ts SR2Combat).

/** v0.54.0: what a wound modifier takes off Initiative (RULES.INITIATIVE_WOUNDS). */
export function initiativeWoundPenalty(woundModifier: number): number {
  return RULES.INITIATIVE_WOUNDS.enabled ? Math.max(0, Math.floor(Number(woundModifier) || 0)) : 0;
}

/**
 * v0.54.0: a wound taken mid-turn: how much a combatant's score drops (only when the wound modifier
 * rises; healing never raises it). 0 when the rule or `midTurn` is off.
 */
export function midTurnWoundDrop(before: number, after: number): number {
  if (!RULES.INITIATIVE_WOUNDS.enabled || !RULES.INITIATIVE_WOUNDS.midTurn) return 0;
  return Math.max(0, initiativeWoundPenalty(after) - initiativeWoundPenalty(before));
}
