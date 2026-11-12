/**
 * v0.91.8: spell formulas. Pure rules: a formula's price and Availability, its shop key, the gear item it is, whether a
 * held formula covers a spell at a Force, the other tradition's penalty, a teacher's dice and fee. A formula is a gear
 * item with `system.formula.spell` set (the owner's choice: a kind of gear, no new item type). The Foundry glue is in
 * `applications/shop.ts` (the shop key), `documents/index.ts` (`learnFormula`, `learnFromFormula`, `learnFromTeacher`)
 * and `applications/formulas.ts` (the dialogs). Values in RULES.FORMULA_V918, all VERIFY.
 */
import { RULES } from './config.ts';
import { isShamanic } from './arcana.ts';

/** A formula's tradition: hermetic or shamanic ('' = either, for one made before traditions were kept). */
export type FormulaTradition = '' | 'hermetic' | 'shamanic';

/** The formula part of a gear item's data. */
export interface FormulaData { spell: string; force: number; tradition: FormulaTradition; category: string; data: Record<string, unknown> }

const F = () => RULES.FORMULA_V918;
const num = (v: unknown, d = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/** Is the requirement on (learning needs a formula, a teacher, the grimoire or a design)? */
export function formulasRequired(): boolean { return F().required === 'on'; }
/** Does raising a known spell's Force need a formula of the new Force? */
export function raiseNeedsFormula(): boolean { return formulasRequired() && F().raise === 'on'; }
/** Are teachers on? */
export function teachersOn(): boolean { return F().teacher === 'on'; }

/** A Force read safely: a whole number from 1 to 12. */
export function formulaForce(v: unknown): number { return Math.min(12, Math.max(1, Math.floor(num(v, 1)) || 1)); }

/** A tradition value read safely. */
export function normTradition(v: unknown): FormulaTradition { const s = String(v ?? ''); return s === 'hermetic' || s === 'shamanic' ? s : ''; }

/** The tradition a magician learns in: shamanic, hermetic, or '' (no spellcasting tradition: an adept, a mundane). */
export function learnerTradition(tradition: unknown): FormulaTradition {
  const t = String(tradition ?? 'none');
  if (!t || t === 'none' || t === 'adept') return '';
  return isShamanic(t) ? 'shamanic' : 'hermetic';
}

/** Is a formula (or a teacher) of tradition `formula` the other tradition for a learner of `learner`? */
export function isForeign(formula: unknown, learner: unknown): boolean {
  if (F().foreign !== 'harder') return false;
  const a = normTradition(formula); const b = normTradition(learner);
  return Boolean(a && b && a !== b);
}

/** A formula's price: Force × nuyenPerForce, × combatFactor for a combat spell. */
export function formulaPrice(category: unknown, force: unknown): number {
  const f = formulaForce(force);
  const base = f * Math.max(0, num(F().nuyenPerForce, 0));
  return Math.round(String(category ?? '') === 'combat' ? base * Math.max(0, num(F().combatFactor, 1)) : base);
}

/** A formula's Availability as the catalogue writes it ("TN/N days"). */
export function formulaAvailability(force: unknown): string {
  const tn = Math.max(2, Math.round(formulaForce(force) * Math.max(0, num(F().tnPerForce, 1))));
  const days = Math.max(0, num(F().availDays, 7));
  return `${tn}/${days} days`;
}

/**
 * The shop key of a formula: `formula:<force>:<tradition or ->:<the spell's key>`. The spell's key is a shop or
 * catalogue key (a template, a world item, a compendium item), so a formula is read back from the spell itself.
 */
export function formulaKey(force: unknown, tradition: unknown, spellKey: string): string {
  return `formula:${formulaForce(force)}:${normTradition(tradition) || '-'}:${spellKey}`;
}

/** A formula key's parts; null when it isn't one (or is too long, or holds another formula). */
export function parseFormulaKey(key: unknown): { force: number; tradition: FormulaTradition; spellKey: string } | null {
  const k = String(key ?? '');
  if (k.length > 300) return null;
  const m = /^formula:(\d{1,2}):(hermetic|shamanic|-):(.+)$/.exec(k);
  if (!m || m[3]!.startsWith('formula:')) return null;
  const force = Number(m[1]);
  if (!(force >= 1 && force <= 12)) return null;
  return { force, tradition: m[2] === '-' ? '' : (m[2] as FormulaTradition), spellKey: m[3]! };
}

/** The spell data a formula carries (no Force: the learner picks it; nothing that belongs to a caster). */
export function formulaSpellData(system: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const s: Record<string, unknown> = { ...(system ?? {}) };
  for (const k of ['learnedForce', 'sustained', 'sustainedBy', 'focusId', 'fetish', 'exclusive', 'quickened', 'anchored']) delete s[k];
  return s;
}

/** The gear data of a formula for `spell` at `force` in `tradition` (cost, Availability, Street Index, formula). */
export function formulaGearSystem(spell: { name: string; system: Record<string, unknown> | null | undefined }, force: unknown, tradition: unknown): Record<string, unknown> {
  const f = formulaForce(force);
  const category = String(spell.system?.['category'] ?? '');
  const formula: FormulaData = { spell: String(spell.name ?? ''), force: f, tradition: normTradition(tradition), category, data: formulaSpellData(spell.system) };
  return { quantity: 1, cost: formulaPrice(category, f), availability: formulaAvailability(f), streetIndex: Math.max(0.1, num(F().streetIndex, 1)), legality: '', formula };
}

/** Is a gear item's data a spell formula? */
export function isFormula(system: any): boolean { return Boolean(system && typeof system.formula?.spell === 'string' && system.formula.spell.trim()); }

/** Does a held formula cover learning `spell` at `force`? */
export function formulaCovers(system: any, spell: string, force: number): boolean {
  return isFormula(system) && system.formula.spell === spell && formulaForce(system.formula.force) >= Math.floor(num(force, 1));
}

/** The best formula among an actor's gear for `spell` at `force`: the learner's own tradition first. */
export function bestFormula<T extends { system?: any }>(items: readonly T[], spell: string, force: number, learner: FormulaTradition): T | null {
  const list = items.filter((i) => formulaCovers(i.system, spell, force));
  return list.find((i) => !isForeign(i.system.formula.tradition, learner)) ?? list[0] ?? null;
}

/** A learning plan's TN and days with the other tradition's penalty. */
export function foreignAdjust(plan: { tn: number; days: number | null; baseDays: number }, foreign: boolean): { tn: number; days: number | null; baseDays: number } {
  if (!foreign) return plan;
  const t = Math.max(1, num(F().foreignTime, 1));
  return { tn: plan.tn + Math.max(0, Math.floor(num(F().foreignTn, 0))), baseDays: plan.baseDays * t, days: plan.days === null ? null : Math.ceil(plan.days * t) };
}

/** A teacher's extra dice for the learning test: their successes, up to their Sorcery. */
export function teacherDice(successes: unknown, sorcery: unknown): number {
  return Math.max(0, Math.min(Math.floor(num(successes, 0)), Math.floor(num(sorcery, 0))));
}

/** A teacher's fee: none for one a player owns (or the student's own), else Force × feePerForce. */
export function teacherFee(force: unknown, playerOwned: boolean): number {
  return playerOwned ? 0 : Math.round(formulaForce(force) * Math.max(0, num(F().feePerForce, 0)));
}

/** Can this teacher teach `spell` at `force` (they know it at that Force or more, and aren't the student)? */
export function canTeach(teacherSpells: ReadonlyArray<{ name: string; system?: any }>, spell: string, force: number): boolean {
  return teacherSpells.some((s) => s.name === spell && Math.floor(num(s.system?.learnedForce, 0)) >= Math.floor(num(force, 1)));
}
