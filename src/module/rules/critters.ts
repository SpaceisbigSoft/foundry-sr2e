/** Adept power effects and critter weaknesses and powers (v0.39.0). All VERIFY. */
import { RULES } from './config.ts';
import type { DamageLevel } from './config.ts';
import { stageUp, type Monitor } from './damage.ts';
import { tags } from './thaumaturgy.ts';
import { own } from './util.ts';

export const ADEPT_SPECIALS = ['', 'killingHands', 'combatSense', 'painResistance', 'enhancedPerception', 'astralPerception', 'rapidHealing', 'distanceStrike', 'spellResistance', 'improvedSenses'] as const;
export type AdeptSpecial = (typeof ADEPT_SPECIALS)[number];

/** Sum of the levels of active adept powers with this special. */
export function adeptSpecialLevel(powers: ReadonlyArray<{ special?: string; level?: number; active?: boolean }>, special: AdeptSpecial): number {
  if (!special) return 0;
  return powers.filter((p) => p.active !== false && p.special === special).reduce((s, p) => s + Math.max(0, p.level ?? 0), 0);
}

/** Killing hands: the unarmed damage level for a power level (null if the adept has none). */
export function killingHandsLevel(level: number): DamageLevel | null {
  if (level <= 0) return null;
  const l = RULES.ADEPT.killingHands.levels;
  return l[Math.min(l.length - 1, level - 1)] ?? null;
}

export const POWER_SPECIALS = ['', 'allergy', 'vulnerability', 'essenceLoss', 'essenceDrain', 'regeneration', 'dualNatured', 'infection', 'immunity', 'concealment', 'confusion', 'movement', 'fear', 'guard', 'paralysis', 'petrification', 'binding'] as const;
export type PowerSpecial = (typeof POWER_SPECIALS)[number];
/** v0.78.0: 'extreme' added (Core Rules); 'moderate' kept for saved data (the book rule counts it as Mild). */
export const ALLERGY_SEVERITIES = ['nuisance', 'mild', 'moderate', 'severe', 'extreme'] as const;
export type AllergySeverity = (typeof ALLERGY_SEVERITIES)[number];

export interface CritterTrait { special: PowerSpecial | string; substance?: string; severity?: string; exposed?: boolean; name?: string }

/**
 * v0.78.0: an allergy severity's row: the book's (RULES.BOOK_V78.allergy 'book': Nuisance nothing, Mild +1 TN,
 * Severe +2 weapon Power, Extreme +2 Power and Light contact damage; 'moderate' as Mild) or the old table
 * (RULES.CRITTERS.allergy; 'extreme' as severe there).
 */
export function allergyRow(severity: string): { tn: number; power: number; contact: string } {
  const sev = String(severity || 'mild');
  if (RULES.BOOK_V78.allergy.mode === 'book') {
    const L = RULES.BOOK_V78.allergy.levels;
    const r = own(L, sev) ?? L['mild']!;
    return { tn: Number(r.tn) || 0, power: Number(r.power) || 0, contact: String(r.contact ?? '') };
  }
  const T = RULES.CRITTERS.allergy as Record<string, { tn: number; contact: string }>;
  const r = own(T, sev) ?? (sev === 'extreme' ? T['severe'] : T['mild']) ?? { tn: 0, contact: '' };
  return { tn: Number(r.tn) || 0, power: 0, contact: String(r.contact ?? '') };
}

/** TN modifier from allergies the critter is exposed to right now (the worst counts). */
export function allergyTn(traits: readonly CritterTrait[]): { value: number; names: string[] } {
  let value = 0;
  const names: string[] = [];
  for (const t of traits) {
    if (t.special !== 'allergy' || !t.exposed) continue;
    const v = allergyRow(t.severity ?? 'mild').tn;
    if (v > value) value = v;
    names.push(t.substance || t.name || 'allergen');
  }
  return { value, names };
}

/** Damage a touch of the substance does (unresisted), or null. */
export function allergyContact(severity: string): DamageLevel | null {
  const c = allergyRow(severity).contact;
  return c ? (c as DamageLevel) : null;
}

/** v0.78.0 (BOOK_V78.allergy 'book'): + Power for a weapon made of something the critter is (severely) allergic to (the worst counts). */
export function allergyWeaponPower(traits: readonly CritterTrait[], material: string): number {
  const m = tags(material);
  if (!m.length) return 0;
  let best = 0;
  for (const t of traits) {
    if (t.special !== 'allergy' || !tags(t.substance ?? '').some((x) => m.includes(x))) continue;
    best = Math.max(best, allergyRow(t.severity ?? 'mild').power);
  }
  return best;
}

/** The vulnerability (if any) a weapon of `material` hits. Materials and substances are tag lists. */
export function vulnerabilityTo(traits: readonly CritterTrait[], material: string): CritterTrait | null {
  const m = tags(material);
  if (!m.length) return null;
  return traits.find((t) => t.special === 'vulnerability' && tags(t.substance ?? '').some((s) => m.includes(s))) ?? null;
}

/** Damage level after a vulnerability. */
export function vulnerableLevel(level: DamageLevel): DamageLevel {
  return stageUp(level, RULES.CRITTERS.vulnerability.stageUp);
}

/** Essence moved by an Essence drain with this many net successes. */
export function essenceDrained(net: number, victimEssence: number, drainerEssence: number): { taken: number; gained: number } {
  const want = Math.max(0, net) * RULES.CRITTERS.essenceDrain.perNet;
  const taken = Math.round(Math.min(want, Math.max(0, victimEssence)) * 100) / 100;
  const room = Math.max(0, RULES.CRITTERS.essenceDrain.maxEssence - drainerEssence);
  return { taken, gained: Math.round(Math.min(taken, room) * 100) / 100 };
}

/** Essence loss periods that have passed since `since` (world time, seconds). */
export function essenceLossPeriods(since: number, now: number): number {
  const p = RULES.CRITTERS.essenceLoss.days * 86400;
  if (!(p > 0) || now <= since) return 0;
  return Math.floor((now - since) / p);
}

/** Regeneration: the Physical boxes left after healing (damage from a vulnerability stays). */
export function regenerate(monitor: Monitor, noRegen: number): { physical: number; healed: number } {
  const keep = Math.min(monitor.physical, Math.max(0, noRegen));
  const can = monitor.physical - keep;
  const per = RULES.CRITTERS.regeneration.boxesPerTurn;
  const healed = per > 0 ? Math.min(can, per) : can;
  return { physical: monitor.physical - healed, healed };
}
