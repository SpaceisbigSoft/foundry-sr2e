import type { TargetNumberModifier } from './dice.ts';
import { woundModifier, type Monitor } from './damage.ts';
import { t as tx } from '../helpers/i18n.ts';

/** Wound modifier as a labeled TN modifier (empty if the character is unhurt). */
export function woundTnModifiers(monitor: Monitor): TargetNumberModifier[] {
  const value = woundModifier(monitor);
  return value > 0 ? [{ id: 'wounds', label: tx('SR2E.Card.Mod.wounds'), value }] : [];
}
