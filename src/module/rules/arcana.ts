import { dispelForceAfter } from './spirits923.ts';
import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { modifierIs } from './dice.ts';
import type { Augmentation } from './cyberware.ts';
import { urrMagNoTotemDice } from './urr80-magic.ts';
import type { Attributes } from './stats.ts';
import { own } from './util.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

export const TRADITIONS = ['none', 'hermetic', 'shamanic', 'adept', 'sorcerer', 'conjurer', 'elementalist', 'shamanist', 'toxic', 'insect'] as const;
export type Tradition = (typeof TRADITIONS)[number];

/** Traditions that follow a totem like shamans (toxic and insect shamans since v0.45.0). */
export const SHAMANIC_TRADITIONS: readonly string[] = ['shamanic', 'shamanist', 'toxic', 'insect'];
/** Whether a tradition follows a totem. */
export function isShamanic(tradition: string): boolean {
  return SHAMANIC_TRADITIONS.includes(String(tradition ?? ''));
}
/** v0.81.0 (RB-14): traditions that work hermetically (libraries and circles, not lodges). */
export const HERMETIC_TRADITIONS: readonly string[] = ['hermetic', 'elementalist', 'sorcerer', 'conjurer'];
/** Whether a tradition works hermetically. */
export function isHermetic(tradition: string): boolean {
  return HERMETIC_TRADITIONS.includes(String(tradition ?? ''));
}

export const FOCUS_TYPES = ['spell', 'sustaining', 'spirit', 'power', 'weapon'] as const;
export type FocusType = (typeof FOCUS_TYPES)[number];

export const SPELL_DURATIONS = ['instant', 'sustained', 'permanent'] as const;

export interface Focus {
  id?: string;
  focusType: FocusType;
  rating: number;
  active: boolean;
  /** Spell category for spell/sustaining foci ('' = any). */
  category: string;
  /** A spell name, spirit type/kind or weapon name the focus is tied to ('' = any for its type). */
  target: string;
}

export interface SustainedSpell {
  spellName: string;
  force: number;
  category: string;
  /** Sustaining focus holding it; empty means the magician sustains it (and takes the TN penalty). */
  focusId: string;
  /** Successes the casting scored; dispelling wears these down. */
  successes?: number;
  /** Quickened (metamagic): permanent, no TN penalty. */
  quickened?: boolean;
  /** An elemental sustaining it for the magician: no TN penalty. */
  spiritUuid?: string;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** +2 TN per spell the magician sustains personally (focus-held spells are free). VERIFY */
export function sustainingModifiers(sustained: readonly SustainedSpell[]): TargetNumberModifier[] {
  const n = sustained.filter((s) => !s.focusId && !s.quickened && !s.spiritUuid).length;
  return n > 0 && RULES.MAGIC.sustainedTnMod
    ? [{ id: 'sustaining', label: tCount(n, 'SR2E.Card.Arcana.sustainingSpells'), value: n * RULES.MAGIC.sustainedTnMod }]
    : [];
}

const best = (foci: readonly Focus[], pick: (f: Focus) => boolean) =>
  foci.filter((f) => f.active && (f as { bonded?: boolean }).bonded !== false && f.rating > 0 && pick(f)).reduce((m, f) => Math.max(m, f.rating), 0);

export interface FocusDice {
  dice: number;
  notes: string[];
}

/** Extra dice from active foci for a Sorcery test: the best matching spell focus plus the best power focus. VERIFY */
export function sorceryFocusDice(foci: readonly Focus[], spell: { name: string; category: string }): FocusDice {
  const spellF = best(foci, (f) => f.focusType === 'spell'
    && (f.target ? same(f.target, spell.name) : !f.category || same(f.category, spell.category)));
  return withPower(foci, 'sorcery', spellF, tx('SR2E.Text.Arcana.spellFocus'));
}

/** Extra dice from active foci for summoning or banishing: best matching spirit focus plus power focus. VERIFY */
export function conjuringFocusDice(foci: readonly Focus[], spirit: { kind: string; type: string } | null): FocusDice {
  const spiritF = spirit
    ? best(foci, (f) => f.focusType === 'spirit' && (!f.target || same(f.target, spirit.kind) || (spirit.type !== '' && same(f.target, spirit.type))))
    : 0;
  return withPower(foci, 'conjuring', spiritF, tx('SR2E.Text.Arcana.spiritFocus'));
}

/** Weapon focus dice: for a named melee weapon, or (no name) the best weapon focus for an astral attack. VERIFY */
export function weaponFocusDice(foci: readonly Focus[], weaponName: string | null): FocusDice {
  const w = best(foci, (f) => f.focusType === 'weapon' && (weaponName === null || !f.target || same(f.target, weaponName)));
  return withPower(foci, weaponName === null ? 'astral' : null, w, tx('SR2E.Text.Arcana.weaponFocus'));
}

/**
 * v0.78.0 (RULES.BOOK_V78.powerFocus 'magic', Core Rules): the best active, bonded power focus's rating, which raises
 * the Magic used for the drain type and adds to the Spell Pool. 0 under the old rule ('dice'), where it adds dice
 * to the tests in RULES.MAGIC.powerFocusTests instead.
 */
export function powerFocusRating(foci: readonly Focus[]): number {
  return RULES.BOOK_V78.powerFocus === 'magic' ? best(foci, (f) => f.focusType === 'power') : 0;
}

function withPower(foci: readonly Focus[], test: 'sorcery' | 'conjuring' | 'astral' | null, own: number, label: string): FocusDice {
  const power = test && RULES.BOOK_V78.powerFocus === 'dice' && RULES.MAGIC.powerFocusTests.includes(test) ? best(foci, (f) => f.focusType === 'power') : 0;
  const notes: string[] = [];
  if (own) notes.push(tx('SR2E.Text.Arcana.focusPlus', { label, own }));
  if (power) notes.push(tx('SR2E.Text.Arcana.powerFocusPlus', { power }));
  return { dice: own + power, notes };
}

/** A free sustaining focus that can hold a spell of this Force and category, or null. VERIFY */
export function availableSustainingFocus(foci: readonly Focus[], sustained: readonly SustainedSpell[], spell: { force: number; category: string }): Focus | null {
  const used = new Set(sustained.map((s) => s.focusId).filter(Boolean));
  return foci.find((f) => f.focusType === 'sustaining' && f.active && (f as { bonded?: boolean }).bonded !== false && f.rating >= spell.force
    && (!f.category || same(f.category, spell.category)) && !(f.id && used.has(f.id))) ?? null;
}

export interface Totem {
  name: string;
  combat: number; detection: number; health: number; illusion: number; manipulation: number;
  conjuring: number;
}

/** Totem bonus (or penalty) dice for a spell category or conjuring. Only shamans have a totem. */
export function totemDice(tradition: Tradition, totem: Partial<Totem> | undefined, what: keyof Omit<Totem, 'name'>): number {
  if (!isShamanic(tradition) || !totem) return 0;
  // v0.80.0 (RULES.URR_V80.magShamanistNoTotem, URR): shamanists get no totem modifiers.
  if (urrMagNoTotemDice(tradition)) return 0;
  return Math.trunc(Number(totem[what] ?? 0)) || 0;
}

/** Why this tradition cannot do something, or null. Adepts cannot cast or conjure. */
export function traditionBlocks(tradition: Tradition, act: 'cast' | 'conjure'): string | null {
  if (tradition === 'adept') return act === 'cast' ? tx('SR2E.Text.Arcana.adeptsCannotCastSpells') : tx('SR2E.Text.Arcana.adeptsCannotSummonSpirits');
  if (tradition === 'sorcerer' && act === 'conjure') return tx('SR2E.Text.Arcana.aspectedSorcerersCannotSummon');
  if (tradition === 'conjurer' && act === 'cast') return tx('SR2E.Text.Arcana.aspectedConjurersCannotCast');
  return null;
}

/** A warning if the tradition normally cannot summon this kind of spirit. VERIFY */
export function traditionSpiritWarning(tradition: Tradition, spiritKind: string): string | null {
  const banned = own(RULES.MAGIC.traditionSpiritWarnings, tradition) ?? [];
  if (!banned.includes(spiritKind)) return null;
  const name = tradition.charAt(0).toUpperCase() + tradition.slice(1);
  return spiritKind === 'nature' ? tx('SR2E.Text.Arcana.magiciansDoNotSummonNature', { name }) : tx('SR2E.Text.Arcana.magiciansDoNotSummonKind', { name, spiritKind });
}

export interface AdeptPower {
  cost: number;
  active: boolean;
  attributes?: Partial<Attributes>;
  reaction?: number;
  initiativeDice?: number;
  /** Extra dice to tests with this skill (matched by name). */
  skill?: string;
  skillDice?: number;
  ballistic?: number;
  impact?: number;
}

/** Adept powers as zero-Essence augmentations, so their bonuses add up like cyberware. */
export function adeptAugmentations(powers: readonly AdeptPower[]): Augmentation[] {
  return powers.map((p) => ({
    essenceCost: 0, grade: 'standard', installed: p.active,
    ...(p.attributes ? { attributes: p.attributes } : {}),
    reaction: p.reaction ?? 0, initiativeDice: p.initiativeDice ?? 0,
  }));
}

/**
 * Power points spent and available (Magic x points per Magic). `spent` counts every power on the sheet, active or
 * not, while bestiary.ts adeptBudget counts active powers only (RB-8: which one the book means is open; VERIFY).
 */
export function adeptPowerPoints(powers: readonly AdeptPower[], magic: number): { spent: number; available: number } {
  const spent = Math.round(powers.reduce((s, p) => s + Math.max(0, p.cost), 0) * 100) / 100;
  return { spent, available: magic * RULES.MAGIC.adeptPointsPerMagic };
}

/** Extra skill dice from active adept powers for a skill name. */
export function adeptSkillDice(powers: readonly AdeptPower[], skillName: string): number {
  return powers.filter((p) => p.active && p.skill && same(p.skill, skillName)).reduce((s, p) => s + (p.skillDice ?? 0), 0);
}

/** Armor from active adept powers (e.g. mystic armor). */
export function adeptArmor(powers: readonly AdeptPower[], kind: 'ballistic' | 'impact'): number {
  return powers.filter((p) => p.active).reduce((s, p) => s + (p[kind] ?? 0), 0);
}

export const METAMAGIC = ['centering', 'shielding', 'quickening', 'dispelling', 'masking', 'anchoring', 'cleansing', 'divining', 'invoking', 'possessing', 'reflecting'] as const;
export type Metamagic = (typeof METAMAGIC)[number];

/** Magic after initiation: each grade adds RULES.MAGIC.magicPerGrade (only for the magically active). VERIFY */
export function initiateMagic(magic: number, grade: number): number {
  return magic > 0 ? magic + Math.max(0, Math.floor(grade || 0)) * RULES.MAGIC.magicPerGrade : 0;
}

/** Shielding: extra dice when resisting spells. VERIFY */
export function shieldingDice(grade: number, techniques: readonly string[]): number {
  return techniques.includes('shielding') ? Math.max(0, grade) * RULES.MAGIC.shieldingDicePerGrade : 0;
}

/**
 * Centering: cancels up to grade points of wound and sustaining penalties on a magical test,
 * never more than those penalties add. VERIFY
 */
export function centeringModifiers(grade: number, techniques: readonly string[], penalties: readonly TargetNumberModifier[]): TargetNumberModifier[] {
  if (!techniques.includes('centering')) return [];
  const total = penalties.filter((m) => m.value > 0 && (modifierIs(m, 'wounds', /^Wounds/) || modifierIs(m, 'sustaining', /^Sustaining/))).reduce((s, m) => s + m.value, 0);
  const cut = Math.min(total, Math.max(0, grade) * RULES.MAGIC.centeringPerGrade);
  return cut > 0 ? [{ id: 'centering', label: tx('SR2E.Card.Mod.centering'), value: -cut }] : [];
}

/** Dispelling: each success removes one of the spell's successes; at 0 it ends. VERIFY */
export function resolveDispel(spellSuccesses: number, dispelSuccesses: number, force?: number): { remaining: number; dispelled: boolean; forceLeft?: number } {
  // v0.92.3 (RULES.SPIRITS_V923.dispelling 'book', Grimoire p. 45): every 2 successes take 1 off the spell's Force; at
  // 0 it is broken (its successes are left alone until then).
  if (RULES.SPIRITS_V923.dispelling === 'book' && typeof force === 'number') {
    const forceLeft = dispelForceAfter(force, dispelSuccesses);
    return { remaining: forceLeft > 0 ? Math.max(0, spellSuccesses) : 0, dispelled: forceLeft <= 0, forceLeft };
  }
  const remaining = Math.max(0, spellSuccesses - Math.max(0, dispelSuccesses));
  return { remaining, dispelled: remaining <= 0 };
}

/** Area effects: the TN against several targets (highest or lowest of their attributes). VERIFY */
export function areaTargetNumber(values: readonly number[]): number {
  if (!values.length) return 0;
  return RULES.MAGIC.areaTn === 'lowest' ? Math.min(...values) : Math.max(...values);
}

/** Forcing through a ward or barrier: net successes lower its rating. VERIFY */
export function resolveBarrier(opts: { attackerSuccesses: number; barrierSuccesses: number; rating: number }): { netSuccesses: number; rating: number; breached: boolean } {
  const net = Math.max(0, opts.attackerSuccesses - opts.barrierSuccesses);
  const rating = Math.max(0, opts.rating - net * RULES.BARRIERS.ratingLossPerNetSuccess);
  return { netSuccesses: net, rating, breached: rating <= 0 };
}
