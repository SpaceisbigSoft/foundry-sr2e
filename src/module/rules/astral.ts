import { RULES } from './config.ts';
import type { Attributes } from './stats.ts';
import { urrMagAstralReactionFactor } from './urr80-magic.ts';
import type { TargetNumberModifier } from './dice.ts';
import { t as tx } from '../helpers/i18n.ts';

export const ASTRAL_MODES = ['physical', 'perceiving', 'projecting'] as const;
export type AstralMode = (typeof ASTRAL_MODES)[number];

/** Whether an actor can be attacked on, and attack into, the astral plane. Spirits always can. VERIFY */
export function astrallyActive(mode: AstralMode | undefined, isSpirit: boolean): boolean {
  return isSpirit || mode === 'perceiving' || mode === 'projecting';
}

export interface AstralForm {
  body: number;
  quickness: number;
  strength: number;
  /** Projecting only: astral Reaction and initiative. */
  reaction: number;
  initiativeBase: number;
  initiativeDice: number;
}

/** Astral form stats from (total) attributes. VERIFY */
export function astralForm(a: Attributes): AstralForm {
  const map = RULES.ASTRAL.formAttributes;
  // v0.80.0 (RULES.URR_V80.magAstralReaction, URR): astral Reaction = 2 × Intelligence under the Revamp.
  const reaction = a[RULES.ASTRAL.reactionAttribute] * urrMagAstralReactionFactor();
  return {
    body: a[map.body],
    quickness: a[map.quickness],
    strength: a[map.strength],
    reaction,
    initiativeBase: reaction + RULES.ASTRAL.initiativeBonus,
    initiativeDice: RULES.ASTRAL.initiativeDice,
  };
}

/** TN modifier for physical-world attacks while astrally perceiving. VERIFY */
export function perceivingModifiers(mode: AstralMode | undefined): TargetNumberModifier[] {
  return mode === 'perceiving' && RULES.ASTRAL.perceivingTnMod
    ? [{ id: 'astralPerception', label: tx('SR2E.Card.Mod.astralPerception'), value: RULES.ASTRAL.perceivingTnMod }]
    : [];
}
