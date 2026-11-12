import { magicLossHit, restrictedDrainMods, treatBase, weaponFocusKarma } from './sorcery923.ts';
import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { own } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';

/** Healing TN: 10 - the patient's Essence (min 2), or a fixed TN. VERIFY */
export function healingTargetNumber(patientEssence: number, fixed: number, treat = false): number {
  const h = RULES.SPELLCRAFT.healing;
  // v0.92.3 (RULES.SORCERY_V923.treatTn, Core p. 155): Treat is 8 − Essence, Heal 10 − Essence.
  const base = treat ? treatBase() ?? h.base : h.base;
  const tn = h.tn === 'essence' ? base - Math.floor(patientEssence) : fixed;
  return Math.max(RULES.MIN_TARGET_NUMBER, tn);
}

/** Boxes healed for the successes, never more than the boxes marked. */
export function boxesHealed(successes: number, marked: number): number {
  return Math.max(0, Math.min(marked, successes * RULES.SPELLCRAFT.healing.boxesPerSuccess));
}

/** Drain TN modifiers from spell options. VERIFY */
export function spellOptionDrainMods(opts: { exclusive?: boolean; fetish?: boolean }): TargetNumberModifier[] {
  const out: TargetNumberModifier[] = [];
  // v0.92.3 (RULES.SORCERY_V923.restrictedSpells 'book', Core p. 133): they take effect at a higher Force instead;
  // Drain is at the normal Force with no change.
  // (The Revamp's own exclusive/fetish switches keep its rows, at 0, as before.)
  if (!restrictedDrainMods() && !(RULES.URR_V80.magExclusiveForce || RULES.URR_V80.magFetishForce)) return out;
  if (opts.exclusive) out.push({ id: 'exclusive', label: tx('SR2E.Card.Mod.exclusive'), value: RULES.SPELLCRAFT.exclusiveDrainMod });
  if (opts.fetish) out.push({ id: 'fetish', label: tx('SR2E.Card.Mod.fetish'), value: RULES.SPELLCRAFT.fetishDrainMod });
  return out;
}

/** Background count as a TN modifier (0 = none). */
export function backgroundCountModifiers(count: number): TargetNumberModifier[] {
  const n = Math.floor(count || 0);
  return n ? [{ id: 'backgroundCount', label: tx('SR2E.Card.Mod.backgroundCount'), value: n }] : [];
}

/** Extra dice the rest of a ritual team adds. VERIFY */
export function ritualTeamDice(memberSorcery: readonly number[]): number {
  return memberSorcery.reduce((s, r) => s + Math.floor(Math.max(0, r) * RULES.RITUAL.teamDiceFraction), 0);
}

/** Hours a ritual takes. VERIFY */
export function ritualHours(force: number): number {
  return Math.max(0, force) * RULES.RITUAL.hoursPerForce;
}

/** Whether a physical damage total has reached Deadly (a full track). */
export function reachedDeadly(physicalBoxes: number, boxes = RULES.MONITOR_BOXES as number): boolean {
  return physicalBoxes >= boxes;
}

/** Magic loss test outcome: lose Magic if the dice total is below Magic (or a fixed number). VERIFY */
export function magicLossOutcome(total: number, magic: number): { lost: number; threshold: number } {
  const m = RULES.MAGIC_LOSS;
  const threshold = m.compareTo === 'magic' ? magic : m.fixed;
  // v0.80.0 (RULES.URR_V80.magLossLe, URR): under the Revamp a total equal to the threshold loses too.
  // v0.92.3 (RULES.SORCERY_V923.magicLoss 'book', Core p. 115): at or below Magic.
  return { lost: magicLossHit(total, threshold) ? m.loss : 0, threshold };
}

/** Days an enchanting task takes; null if it failed. */
export function enchantingDays(baseDays: number, successes: number): number | null {
  return successes > 0 ? Math.round((baseDays / successes) * 100) / 100 : null;
}

/** Good Karma to make a focus of this type and rating. VERIFY */
export function focusKarmaCost(focusType: string, rating: number, more: { target?: string; category?: string; size?: string } = {}): number {
  const r = Math.max(0, rating);
  // v0.78.0 (RULES.BOOK_V78.focusKarma 'book', Core Rules focus bonding table): a named spell 1, a category 3,
  // spirit 2, power 5, weapon 4 (small) or 5 (large) × rating; a spell lock (sustaining focus) 1 flat.
  const B = RULES.BOOK_V78.focusKarma;
  if (B.mode === 'book') {
    if (focusType === 'spell') return r * (String(more.target ?? '').trim() ? B.specificSpell : B.spellCategory);
    if (focusType === 'sustaining') return r > 0 ? B.spellLockFlat : 0;
    if (focusType === 'spirit') return r * B.spirit;
    if (focusType === 'power') return r * B.power;
    // v0.92.3 (RULES.SORCERY_V923.weaponFocusKarma, Grimoire p. 27): 6 × rating, whatever the size.
    if (focusType === 'weapon') return weaponFocusKarma(r) ?? r * (more.size === 'large' ? B.weaponLarge : B.weaponSmall);
  }
  return r * (own(RULES.ENCHANTING.focusKarma, focusType) ?? 1);
}

/** Dice a spirit resists banishing with: Force, plus spirit energy for free spirits. VERIFY */
export function banishResistDice(force: number, kind: string, spiritEnergy: number): number {
  return force + (kind === 'free' && RULES.SPIRITS_EXTRA.freeSpiritEnergyResists ? Math.max(0, spiritEnergy) : 0);
}

/** Whether a spirit kind counts services down (allies and free spirits do not). */
export function spiritOwesServices(kind: string): boolean {
  return kind !== 'ally' && kind !== 'free';
}

export interface QuestState {
  name: string;
  stages: number;
  passed: number;
  targetNumber: number;
  failed: boolean;
}

/** Advance an astral quest after a stage test. VERIFY */
export function advanceQuest(q: QuestState, successes: number): QuestState {
  if (q.failed || q.passed >= q.stages) return q;
  if (successes > 0) return { ...q, passed: q.passed + 1 };
  return RULES.QUESTS.failureEnds ? { ...q, failed: true } : q;
}

export function questStatus(q: QuestState): 'complete' | 'failed' | 'underway' {
  if (q.failed) return 'failed';
  return q.passed >= q.stages ? 'complete' : 'underway';
}
