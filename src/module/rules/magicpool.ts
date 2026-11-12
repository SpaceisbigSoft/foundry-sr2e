/**
 * v0.92.0: the layered Magic (Spell) Pool and Sorcery's narrow uses (the owner's decisions, 2 and 12 Nov 2026; values in
 * RULES.MAGIC_V920, switches back to the flat pool). Pure: which of Sorcery's concentration and specialization an action
 * falls inside, the rating its test rolls, the pool's layers and how a spend takes from them.
 *
 * Sorcery 4, concentration Spellcasting 6, specialization Combat spells 8: 4 general dice for any magical action, +2 only
 * for spellcasting, +2 more only for combat spells (each layer is the rating above the one below it), so a combat spell
 * can use up to 8 pool dice (with castNarrow on, the rating its test rolls). The Magic cap on a test's pool dice still holds
 * (castingPoolDice). Narrow dice are spent first (they can't be used elsewhere), and may pay for that casting's Drain.
 */
import { RULES } from './config.ts';

/** What a magical action is, for matching Sorcery's concentration and specialization. */
export type SorceryAction = 'cast' | 'defense' | 'dispel' | 'ritual' | 'other';

/** A Sorcery skill's parts (its data). */
export interface SorcerySkill { rating?: number; concentration?: string; concentrationRating?: number; specialization?: string; specializationRating?: number }

/** Which narrow layers an action falls inside. */
export interface SorceryUse { conc: boolean; spec: boolean }

const M = () => RULES.MAGIC_V920;
const whole = (v: unknown): number => Math.max(0, Math.floor(Number(v) || 0));
const norm = (s: unknown): string => String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The words each action is named by (English and the system's own ids). */
const ACTION_WORDS: Record<SorceryAction, RegExp | null> = {
  cast: /\b(spell ?casting|casting|cast)\b/,
  defense: /\b(spell ?defen[cs]e|defen[cs]e|shield(ing)?)\b/,
  dispel: /\b(dispell?(ing)?|dispel)\b/,
  ritual: /\b(ritual( sorcery)?)\b/,
  other: null,
};
/** The spell categories. */
const CATEGORIES = ['combat', 'detection', 'health', 'illusion', 'manipulation'];

/**
 * Does a concentration or specialization name cover this action: its kind (Spellcasting, Dispelling…), the spell's own
 * name exactly, or the spell's category named on its own ("Combat", "Combat spells": review B2, so a specialization
 * named after a spell such as "Combat Sense" covers only that spell)?
 */
export function narrowCovers(name: unknown, action: SorceryAction, o: { category?: string; spellName?: string } = {}): boolean {
  const n = norm(name);
  if (!n) return false;
  const words = ACTION_WORDS[action];
  if (words && words.test(n)) return true;
  // Spell and category matches apply to what is done with a spell (cast, ritual, dispel).
  if (action === 'cast' || action === 'ritual' || action === 'dispel') {
    const sp = norm(o.spellName);
    if (sp && n === sp) return true;
    const cat = norm(o.category);
    if (cat && CATEGORIES.includes(cat) && (n === cat || n === `${cat} spell` || n === `${cat} spells`)) return true;
  }
  return false;
}

/** A name that only says spell defense (a layer no wired action can spend yet: review R6). */
function defenseOnly(name: unknown): boolean {
  const n = norm(name);
  return Boolean(n) && Boolean(ACTION_WORDS.defense?.test(n)) && !(['cast', 'dispel', 'ritual'] as SorceryAction[]).some((a) => ACTION_WORDS[a]?.test(n));
}

/** Is the layered pool on? */
export function layersOn(): boolean { return M().poolLayers === 'layered'; }
/** Does a casting test roll the concentration's or specialization's rating? */
export function narrowCastingOn(): boolean { return M().castNarrow === 'on'; }

/**
 * Which narrow layers an action falls inside. A specialization sits inside the concentration (when there is one), so a
 * matching specialization brings the concentration with it.
 */
export function sorceryUse(skill: SorcerySkill | null | undefined, action: SorceryAction, o: { category?: string; spellName?: string } = {}): SorceryUse {
  if (!skill) return { conc: false, spec: false };
  const hasConc = Boolean(String(skill.concentration ?? '').trim()) && whole(skill.concentrationRating) > 0;
  const hasSpec = Boolean(String(skill.specialization ?? '').trim()) && whole(skill.specializationRating) > 0;
  // Review (B1): a specialization sits inside its concentration, so it counts only where the concentration does.
  const conc = hasConc && narrowCovers(skill.concentration, action, o);
  const spec = hasSpec && (!hasConc || conc) && narrowCovers(skill.specialization, action, o);
  return { conc: conc || (spec && hasConc), spec };
}

/** The pool's layers: the general dice (from the caller: the pool as sized) and each narrow layer's extra dice. */
export function poolLayers(skill: SorcerySkill | null | undefined): { conc: number; spec: number; concName: string; specName: string } {
  if (!skill || !layersOn()) return { conc: 0, spec: 0, concName: '', specName: '' };
  const r = whole(skill.rating);
  const hasConc = Boolean(String(skill.concentration ?? '').trim()) && whole(skill.concentrationRating) > 0;
  const c = hasConc ? Math.max(r, whole(skill.concentrationRating)) : r;
  const hasSpec = Boolean(String(skill.specialization ?? '').trim()) && whole(skill.specializationRating) > 0;
  const s = hasSpec ? Math.max(c, whole(skill.specializationRating)) : c;
  // Review (R6): a Spell Defense concentration (and a specialization inside it) can't be spent yet: no layer for it.
  if (hasConc && defenseOnly(skill.concentration)) return { conc: 0, spec: 0, concName: '', specName: '' };
  return { conc: c - r, spec: hasSpec && defenseOnly(skill.specialization) ? 0 : s - c, concName: hasConc ? String(skill.concentration) : '', specName: hasSpec ? String(skill.specialization) : '' };
}

/** The rating a casting test rolls: the specialization's or concentration's when the action falls inside it (and it is higher). */
export function narrowRating(skill: SorcerySkill | null | undefined, use: SorceryUse): number {
  if (!skill) return 0;
  const r = whole(skill.rating);
  if (!narrowCastingOn()) return r;
  // Review (R4): never below the concentration it sits in.
  if (use.spec) return Math.max(r, use.conc ? whole(skill.concentrationRating) : 0, whole(skill.specializationRating));
  if (use.conc) return Math.max(r, whole(skill.concentrationRating));
  return r;
}

/** The narrow dice still there: each layer's size less what was spent of it (never below 0). */
export function narrowLeft(layers: { conc: number; spec: number }, spent: { conc?: number; spec?: number }): { conc: number; spec: number } {
  return { conc: Math.max(0, whole(layers.conc) - whole(spent.conc)), spec: Math.max(0, whole(layers.spec) - whole(spent.spec)) };
}

/** How many pool dice an action may use: the general dice left plus the narrow layers it falls inside. */
export function poolForUse(generalLeft: number, left: { conc: number; spec: number }, use: SorceryUse): number {
  return whole(generalLeft) + (use.conc ? whole(left.conc) : 0) + (use.spec ? whole(left.spec) : 0);
}

/** A spend of `dice` for an action: the specialization's dice first, then the concentration's, then the general dice. */
export function spendPlan(dice: number, generalLeft: number, left: { conc: number; spec: number }, use: SorceryUse): { spec: number; conc: number; general: number } {
  let n = whole(dice);
  const spec = use.spec ? Math.min(n, whole(left.spec)) : 0; n -= spec;
  const conc = use.conc ? Math.min(n, whole(left.conc)) : 0; n -= conc;
  const general = Math.min(n, whole(generalLeft));
  return { spec, conc, general };
}

/** May the narrow dice pay for the Drain of a casting inside them? */
export function drainNarrowOn(): boolean { return layersOn() && M().drainNarrow === 'on'; }

/** The Sorcery skill item among an actor's items (exact name, any case; the highest rating), or null. */
export function sorcerySkillOf<T extends { type?: string; name?: string; system?: any }>(items: Iterable<T> | null | undefined): T | null {
  let best: T | null = null;
  for (const i of items ?? []) {
    if (i?.type !== 'skill' || String(i.name ?? '').trim().toLowerCase() !== 'sorcery') continue;
    if (!best || whole(i.system?.rating) > whole(best.system?.rating)) best = i;
  }
  return best;
}
