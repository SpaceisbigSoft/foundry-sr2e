/**
 * v0.91.5: legality in the shop and permits. Pure rules over RULES.SHOP_V915 (rules/config91.ts) and the legality
 * categories (RULES.GEAR_V58.legality): how much harder an item is to find openly, what a permit costs and how long it
 * takes, and the warnings shown on shop rows, find cards and item sheets. The Foundry glue is `SR2Actor.getPermit`
 * (documents/index.ts), the find test `#findCore`, and `applications/permits.ts`. All numbers VERIFY.
 */
import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { legalityOf, legalCheck } from './outfit.ts';
import { t as tx } from '../helpers/i18n.ts';

const S = () => RULES.SHOP_V915;

/** A permit project's source (one permit at a time per item or vehicle): `permit:item:<id>`, `permit:vehicle:<actor id>`. */
export function permitSource(kind: 'item' | 'vehicle', id: string): string {
  return `permit:${kind}:${id}`;
}

/** The modifier id the find test's legality row carries. */
export const LEGAL_FIND_MOD = 'legality';

/** A legality value from a document (unknown or odd values count as not set). */
export function legalityId(v: unknown): string {
  const id = String(v ?? '');
  return RULES.GEAR_V58.legality.categories.some((c) => c.id === id) ? id : '';
}

/** Does legality change an open find (RULES.SHOP_V915.findByLegality)? */
export function legalityGrades(): boolean {
  return S().findByLegality === 'graded';
}

/** The find test's legality row: +findTn for the category (none when 0, or with findByLegality 'off'). */
export function legalFindMods(legality: unknown): TargetNumberModifier[] {
  const id = legalityId(legality);
  if (!id || !legalityGrades()) return [];
  const v = Math.floor(Number(S().findTn[id] ?? 0) || 0);
  return v ? [{ label: tx('SR2E.Card.Mod.legality', { label: legalityOf(id).label }), value: v, id: LEGAL_FIND_MOD }] : [];
}

/** The find's base time is multiplied by this (1 when legality doesn't count). */
export function legalFindTimeFactor(legality: unknown): number {
  const id = legalityId(legality);
  if (!id || !legalityGrades()) return 1;
  const f = Number(S().findTime[id] ?? 1);
  return Number.isFinite(f) && f > 0 ? f : 1;
}

/** Can something of this legality have a permit (its category's row says so)? */
export function permitCategory(legality: unknown): boolean {
  const id = legalityId(legality);
  return Boolean(id) && Boolean(legalityOf(id).permit);
}

/** Do players get permits through "Get a permit…" (the Permit box being the GM's)? */
export function permitsBought(): boolean {
  return S().permits === 'buy';
}

/** Is the Permit box closed to this user (ticking it on; unticking is always allowed)? */
export function permitTickLocked(o: { isGM: boolean }): boolean {
  return !o.isGM && permitsBought();
}

/**
 * A permit's cost and time for something of this legality and cost (the item's own cost, before the Street Index):
 * a share of the cost, at least the minimum; the days from RULES.SHOP_V915.permitDays. Null when it can't have one.
 */
export function permitPlan(o: { legality: unknown; cost: unknown }): { cost: number; hours: number; days: number; legality: string } | null {
  const id = legalityId(o.legality);
  if (!permitCategory(id)) return null;
  const c = S().permitCost[id] ?? { share: 0, minimum: 0 };
  const base = Math.max(0, Number(o.cost) || 0);
  const cost = Math.max(Math.max(0, Math.round(Number(c.minimum) || 0)), Math.round(base * Math.max(0, Number(c.share) || 0)));
  const days = Math.max(0, Number(S().permitDays[id] ?? 0) || 0);
  return { cost, hours: days * 24, days, legality: id };
}

/** What a holder risks: '' when nothing (legal, not set, or covered by a permit), else a warning line with the fine. */
export function legalWarning(o: { legality: unknown; permit?: boolean; rating?: unknown; licence?: string }): string {
  const id = legalityId(o.legality);
  if (!id) return '';
  // v0.91.5 review (R5): a licence covering it (rules/paperwork.ts legalWithLicences) is as good as a permit.
  if (o.licence && permitCategory(id)) return '';
  const c = legalCheck({ category: id, permit: Boolean(o.permit), rating: Number(o.rating) || 0 });
  if (c.ok) return '';
  const fine = c.fine.toLocaleString();
  if (id === 'forbidden') return c.fine ? tx('SR2E.Text.Legal.forbiddenFine', { fine }) : tx('SR2E.Text.Legal.forbidden');
  return c.fine ? tx('SR2E.Text.Legal.noPermitFine', { label: c.label, fine }) : tx('SR2E.Text.Legal.noPermit', { label: c.label });
}

/** The shop row's legality tooltip: how much harder it is to find openly, and what a permit takes. */
export function shopLegalTitle(legality: unknown): string {
  const id = legalityId(legality);
  if (!id) return '';
  const parts: string[] = [];
  const tn = legalFindMods(id)[0]?.value ?? 0;
  const time = legalFindTimeFactor(id);
  if (tn && time !== 1) parts.push(tx('SR2E.Text.Legal.harderTnTime', { tn, time }));
  else if (tn) parts.push(tx('SR2E.Text.Legal.harderTn', { tn }));
  else if (time !== 1) parts.push(tx('SR2E.Text.Legal.harderTime', { time }));
  if (permitCategory(id)) {
    const c = S().permitCost[id] ?? { share: 0, minimum: 0 };
    const days = Number(S().permitDays[id] ?? 0) || 0;
    parts.push(permitsBought()
      ? tx('SR2E.Text.Legal.permitTakes', { percent: Math.round((Number(c.share) || 0) * 100), minimum: (Number(c.minimum) || 0).toLocaleString(), days })
      : tx('SR2E.Text.Legal.permitTick'));
  }
  const warn = legalWarning({ legality: id });
  if (warn) parts.push(warn);
  return parts.join(' ');
}
