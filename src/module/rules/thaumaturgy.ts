import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { isShamanic, type Focus } from './arcana.ts';
import { urrMagProjectionHours, urrMagNatureSpiritConflict, urrMagNoTotemDice } from './urr80-magic.ts';
import { t as tx } from '../helpers/i18n.ts';

const X = () => RULES.MAGIC_EXTRA;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Armor that counts against an elemental manipulation spell (half impact by default). VERIFY */
export function elementalArmor(armor: { ballistic: number; impact: number }): number {
  const e = X().elemental;
  return Math.floor(Math.max(0, armor[e.armorKind]) * e.armorFraction);
}

/** Whether an elemental (of `spiritElement`) can aid or sustain a spell of `spellElement`. */
export function elementMatches(spiritElement: string, spellElement: string): boolean {
  return Boolean(spiritElement) && Boolean(spellElement) && same(spiritElement, spellElement);
}

/** v0.54.0: whether an elemental may aid or sustain this spell (RULES.MAGIC_EXTRA.elementalMatch). */
export function elementalServes(spiritElement: string, spell: { element?: string; category?: string }): boolean {
  const m = X().elementalMatch;
  if (m === 'any') return true;
  if (m === 'element') return elementMatches(spiritElement, spell.element ?? '');
  const cat = X().elementalCategories[String(spiritElement ?? '').trim().toLowerCase()];
  return Boolean(cat) && same(String(cat), String(spell.category ?? ''));
}

/** What an elemental can serve, for messages ("combat spells", "fire spells"). */
export function elementalServesLabel(spiritElement: string): string {
  const m = X().elementalMatch;
  if (m === 'any') return 'any spell';
  if (m === 'element') return `${spiritElement || 'its element\'s'} spells`;
  return `${X().elementalCategories[String(spiritElement ?? '').trim().toLowerCase()] ?? 'no'} spells`;
}

/** Dice an elemental adds to Sorcery when it aids a spell. VERIFY */
export function elementalAidDice(force: number): number {
  return Math.max(0, Math.floor(force));
}

/** Projection: the time limit in hours, how far over it the magician is, and the Essence that costs. VERIFY */
export function projectionOverstay(hoursElapsed: number, essence: number): { limit: number; over: number; essenceLoss: number } {
  const p = X().projection;
  // v0.92.3 (RULES.SPIRITS_V923.projection 'book', Core pp. 146–147): the body loses 1 Essence for every hour projected,
  // from the start (full hours). The Revamp's own reading (magProjFullHours) keeps its path below.
  if (RULES.SPIRITS_V923.projection === 'book' && !RULES.URR_V80.magProjFullHours) {
    const over = Math.max(0, Number(hoursElapsed) || 0);
    return { limit: 0, over: Math.round(over * 100) / 100, essenceLoss: Math.floor(over + 1e-9) * p.essenceLossPerHour };
  }
  const limit = Math.max(0, Math.floor(essence)) * p.hoursPerEssence;
  const over = Math.max(0, hoursElapsed - limit);
  // v0.80.0 (RULES.URR_V80.magProjFullHours, URR): only full hours cost Essence.
  const full = urrMagProjectionHours(over);
  return { limit, over: Math.round(over * 100) / 100, essenceLoss: over > 0 ? (full ?? Math.ceil(over - 1e-9)) * p.essenceLossPerHour : 0 };
}

/** Area spell radius in metres. VERIFY */
export function areaRadius(force: number, magic: number): number {
  const a = X().area;
  return Math.max(0, a.radiusFrom === 'magic' ? magic : force) * a.metresPerPoint;
}

/** Masking: TN modifier against assensing or tracking a masked initiate. VERIFY */
export function maskingModifiers(grade: number, techniques: readonly string[]): TargetNumberModifier[] {
  const v = techniques.includes('masking') ? Math.max(0, grade) * X().masking.tnPerGrade : 0;
  return v > 0 ? [{ id: 'masking', label: tx('SR2E.Card.Mod.masking'), value: v }] : [];
}

/** A warning if the magician already has a nature spirit in this domain. VERIFY */
export function domainConflict(existingDomains: readonly string[], domain: string): string | null {
  // v0.80.0 (RULES.URR_V80.magNatureOneOnly, URR): one nature spirit in service at a time.
  const one = urrMagNatureSpiritConflict(existingDomains.length);
  if (one) return one;
  if (!X().domains.onePerDomain || !domain.trim()) return null;
  return existingDomains.some((d) => same(d, domain)) ? tx('SR2E.Text.Thaumaturgy.aNatureSpiritAlreadyServes', { domain }) : null;
}

/** Conjuring materials and time for an elemental. VERIFY */
export function bindingCost(force: number): { nuyen: number; hours: number } {
  const b = X().binding;
  return { nuyen: Math.max(0, force) * b.nuyenPerForce, hours: Math.max(0, force) * b.hoursPerForce };
}

/**
 * Restrictions for elementalists and shamanists. Elementalists cast only their element's spell
 * category (or spells of their element) and summon only elementals of their element; shamanists
 * cast only categories their totem favours (bonus dice above 0) and summon only nature spirits. VERIFY
 */
export function aspectRestriction(tradition: string, act: 'cast' | 'conjure', o: {
  aspectElement?: string; category?: string; spellElement?: string; spiritKind?: string; spiritElement?: string;
  totem?: Record<string, unknown>;
}): string | null {
  if (tradition === 'elementalist') {
    const el = (o.aspectElement ?? '').toLowerCase();
    if (!el) return tx('SR2E.Text.Thaumaturgy.setTheElementalistsElement');
    if (act === 'cast') {
      // v0.81.0 (RB-6): the same table elementals serve by (MAGIC_EXTRA.elementalCategories).
      const cat = X().elementalCategories[el];
      if (o.spellElement && same(o.spellElement, el)) return null;
      return cat && o.category && same(cat, o.category) ? null : tx('SR2E.Text.Thaumaturgy.elementalistCastsOnly', { el, category: cat ?? el });
    }
    if (o.spiritKind !== 'elemental') return tx('SR2E.Text.Thaumaturgy.elementalistSummonsOnly', { el });
    return o.spiritElement && !same(o.spiritElement, el) ? tx('SR2E.Text.Thaumaturgy.elementalistSummonsOnly', { el }) : null;
  }
  if (tradition === 'shamanist') {
    if (act === 'cast') {
      const bonus = Number(o.totem?.[o.category ?? ''] ?? 0);
      return bonus > 0 ? null : tx('SR2E.Text.Thaumaturgy.aShamanistCastsOnly', { category: o.category });
    }
    return o.spiritKind === 'nature' ? null : tx('SR2E.Text.Thaumaturgy.aShamanistSummonsOnly');
  }
  return null;
}

/** Comma- or semicolon-separated tags, lower-cased (spaces stay inside a tag: "normal weapons"). */
export function tags(text: string): string[] {
  return (text ?? '').split(/[,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
}

/** Totem dice for being in (or out of) the totem's environment, from the scene's environment tags. VERIFY */
export function totemEnvironmentDice(tradition: string, totem: { environment?: string; inEnvironment?: number; outEnvironment?: number } | undefined, sceneTags: readonly string[]): { dice: number; note: string } {
  if (!isShamanic(tradition) || !totem || !tags(totem.environment ?? '').length) return { dice: 0, note: '' };
  // v0.80.0 (RULES.URR_V80.magShamanistNoTotem, URR): shamanists get no totem modifiers.
  if (urrMagNoTotemDice(tradition)) return { dice: 0, note: '' };
  const inside = tags(totem.environment ?? '').some((t) => sceneTags.includes(t));
  const dice = Math.trunc(Number(inside ? totem.inEnvironment : totem.outEnvironment) || 0);
  return { dice, note: dice ? `totem ${inside ? 'environment' : 'away from environment'} ${dice > 0 ? '+' : ''}${dice}` : '' };
}

/** Focus addiction risk: total rating of active, bonded foci against Magic. VERIFY */
export function focusAddiction(foci: ReadonlyArray<Focus & { bonded?: boolean }>, magic: number): { total: number; risk: boolean } {
  const total = foci.filter((f) => f.active && f.bonded !== false).reduce((s, f) => s + Math.max(0, f.rating), 0);
  return { total, risk: total > magic };
}

/** Whether a weapon attack ignores immunity to normal weapons. VERIFY */
export function ignoresImmunity(weaponMagical: boolean, hasWeaponFocus: boolean): boolean {
  return X().immunity.magicWeaponsIgnore && (weaponMagical || hasWeaponFocus);
}

/** Why a spell cannot reach a target across the astral/physical divide, or null. VERIFY */
export function castingPlaneProblem(caster: { mode: string; isSpirit?: boolean }, target: { astralOnly: boolean; name: string }, spellType: string): string | null {
  const p = X().planes;
  if (p.projectingTargetsAstralOnly && caster.mode === 'projecting' && !target.astralOnly) {
    return tx('SR2E.Text.Thaumaturgy.aProjectingMagicianCanOnly', { name: target.name });
  }
  if (target.astralOnly) {
    if (caster.mode === 'physical' && !caster.isSpirit) return tx('SR2E.Text.Thaumaturgy.isOnlyOnTheAstralPerceive', { name: target.name });
    if (p.astralTargetsNeedMana && spellType !== 'mana') return tx('SR2E.Text.Thaumaturgy.isOnlyOnTheAstralMana', { name: target.name });
  }
  return null;
}

/** Extra resistance dice when a spell is cast through a ward or mana barrier. VERIFY */
export function barrierSpellDice(rating: number): number {
  return Math.max(0, Math.floor(rating));
}

/**
 * v0.78.0 (RULES.BOOK_V78.manaBarrier.spells): what a barrier between caster and target does to a spell: a mana
 * barrier adds its rating to the caster's TN ('casterTn', Core Rules) or to the target's resistance dice
 * ('resistDice', the old way); a ward follows `wards` (the notes don't cover wards).
 */
export function barrierSpellEffect(rating: number, barrierKind: string): { dice: number; tn: number } {
  const M = RULES.BOOK_V78.manaBarrier;
  const r = barrierSpellDice(rating);
  const mode = (barrierKind || 'ward') === 'ward' ? M.wards : M.spells;
  return mode === 'casterTn' ? { dice: 0, tn: r } : { dice: r, tn: 0 };
}

/** Good Karma to learn a spell at a Force, or to raise it to a new Force. VERIFY */
export function spellKarmaCost(newForce: number): number {
  return Math.max(0, newForce) * X().karmaCosts.spellPerForce;
}

/** Whether a ritual can reach its target: in sight, a material link, or (if allowed) a spotter. VERIFY */
export function ritualCanReach(o: { materialLink: boolean; spotter: boolean }): boolean {
  return o.materialLink || (X().ritual.spotterReplacesLink && o.spotter);
}

export const MATERIAL_KINDS = ['', 'raw', 'refined', 'radical', 'fetish'] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

/** What an enchanting task does to the material stock on success. VERIFY */
export function materialStep(task: string, successes: number, stock: { raw: number; refined: number; radical: number }): { consume: { kind: MaterialKind; n: number } | null; produce: { kind: MaterialKind; n: number } | null; short: string | null } {
  const s = Math.max(0, successes);
  if (s <= 0) return { consume: null, produce: null, short: null };
  switch (task) {
    case 'gather': return { consume: null, produce: { kind: 'raw', n: s }, short: null };
    case 'refine': {
      const n = Math.min(s, stock.raw);
      return n > 0 ? { consume: { kind: 'raw', n }, produce: { kind: 'refined', n }, short: null } : { consume: null, produce: null, short: tx('SR2E.Text.Thaumaturgy.noRawMaterialsToRefine') };
    }
    case 'alchemy': {
      const n = Math.min(s, stock.refined);
      return n > 0 ? { consume: { kind: 'refined', n }, produce: { kind: 'radical', n }, short: null } : { consume: null, produce: null, short: tx('SR2E.Text.Thaumaturgy.noRefinedMaterialsFor') };
    }
    case 'fetish': {
      const need = X().materials.fetishUses;
      return stock.refined >= need ? { consume: { kind: 'refined', n: need }, produce: { kind: 'fetish', n: 1 }, short: null } : { consume: null, produce: null, short: tx('SR2E.Text.Thaumaturgy.aFetishNeedsRefinedMaterial', { need }) };
    }
    default: return { consume: null, produce: null, short: null };
  }
}

/** Material a focus of this rating needs. VERIFY */
export function focusMaterialNeed(rating: number): { kind: MaterialKind; n: number } {
  const m = X().materials;
  return { kind: m.focusMaterial, n: Math.max(1, rating) * m.focusUnitsPerRating };
}
