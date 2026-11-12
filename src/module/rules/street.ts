import { RULES } from './config.ts';
import type { TargetNumberModifier, DieResult } from './dice.ts';
import { contactsCost, lifestyleCost } from './everyday.ts';
import { priorityRow, qualitiesZero, fenceFloor } from './core923.ts';
import { t as tx } from '../helpers/i18n.ts';

/**
 * Characters and the street (v0.44.0): the builder's plan, edges and flaws, movement rates and
 * athletics, open / complementary / teamwork tests, reputation, modifier tables, rallying, contact
 * payment, haggling and fencing. Pure rules; no Foundry.
 */

const S = () => RULES.STREET;

// ---------------------------------------------------------------- Builder

export interface BuildPlan {
  nuyen: number; lifestyle: string; lifestyleMonths: number; contacts: { count: number; level: number }; magic: number;
  /** v0.58.0: nuyen the lifestyle months cost at creation (0 when CHARACTERS_V58.creation.lifestyleMonthsPaid is off). */
  lifestyleCost?: number;
  /** v0.58.0: nuyen the contacts beyond the free ones cost at creation. */
  contactsCost?: number;
}

/**
 * What "Fill the sheet" sets besides attributes: cash left after gear, a lifestyle, free contacts, Magic.
 * v0.58.0: cash also pays the lifestyle months (when lifestyleMonthsPaid) and any contacts beyond the free
 * ones (`contacts`; default the builder's free contacts, which cost nothing).
 */
export function buildPlan(o: { resources?: string; magic: 'none' | 'full' | 'adept' | 'aspected'; gearCost: number; contacts?: Array<{ level: number }> }): BuildPlan {
  const b = S().builder;
  const p = (o.resources ?? 'E') as 'A' | 'B' | 'C' | 'D' | 'E';
  // v0.92.3 (RULES.CORE_V923.priorities): the book's Resources (Core p. 47) or the old table.
  const cash = priorityRow(p).resources;
  const lifestyle = b.lifestyles[p] ?? 'low';
  const life = lifestyleCost(lifestyle, b.lifestyleMonths);
  const contacts = o.contacts ? contactsCost(o.contacts).cost : 0;
  return {
    nuyen: Math.max(0, Math.floor(cash - Math.max(0, o.gearCost) - life - contacts)),
    lifestyle,
    lifestyleMonths: b.lifestyleMonths,
    contacts: { ...b.contacts },
    magic: o.magic === 'none' ? 0 : b.magicRating,
    lifestyleCost: life,
    contactsCost: contacts,
  };
}

// ---------------------------------------------------------------- Edges and flaws

export interface Quality { id?: string; name: string; kind: 'edge' | 'flaw'; points: number; target?: string; tn?: number; notes?: string }

/** Edge and flaw points in all. */
export function qualityPoints(list: readonly Quality[]): { edges: number; flaws: number } {
  let edges = 0, flaws = 0;
  for (const q of list) {
    const n = Math.max(0, Math.floor(Number(q.points) || 0));
    if (q.kind === 'flaw') flaws += n; else edges += n;
  }
  return { edges, flaws };
}

/** The build-check row for edges and flaws (null when they are switched off or none are taken). */
export function qualityCheck(list: readonly Quality[]): { label: string; used: string; allowed: string; ok: boolean; note?: string } | null {
  const q = S().qualities;
  if (!q.enabled || !list.length) return null;
  const p = qualityPoints(list);
  // v0.92.3 (RULES.CORE_V923.qualities 'zero', Companion p. 21): the Edges and Flaws must come to 0 (no per-side cap);
  // surplus flaws only with the house rule CHARACTERS_V73.qualities.surplusFlaws.
  const zero = qualitiesZero();
  if (zero) {
    const surplus = RULES.CHARACTERS_V73.qualities.surplusFlaws.use !== 'none';
    const bad = p.edges > p.flaws ? tx('SR2E.Text.Street.moreEdgesThanFlaws') : !surplus && p.flaws > p.edges ? tx('SR2E.Text.Core923.moreFlawsThanEdges') : '';
    return { label: tx('SR2E.Text.Street.edgesAndFlaws'), used: tx('SR2E.Text.Street.edgesFlaws', { edges: p.edges, flaws: p.flaws }), allowed: tx('SR2E.Text.Core923.qualitiesZero'), ok: !bad, ...(bad ? { note: bad } : {}) };
  }
  const problems = [p.edges > q.maxEdges ? tx('SR2E.Text.Street.edgesOver', { max: q.maxEdges }) : '', p.flaws > q.maxFlaws ? tx('SR2E.Text.Street.flawsOver', { max: q.maxFlaws }) : '', q.balance && p.edges > p.flaws ? tx('SR2E.Text.Street.moreEdgesThanFlaws') : ''].filter(Boolean);
  return { label: tx('SR2E.Text.Street.edgesAndFlaws'), used: tx('SR2E.Text.Street.edgesFlaws', { edges: p.edges, flaws: p.flaws }), allowed: q.balance ? tx('SR2E.Text.Street.atMostBalance', { maxEdges: q.maxEdges, maxFlaws: q.maxFlaws }) : tx('SR2E.Text.Street.atMost', { maxEdges: q.maxEdges, maxFlaws: q.maxFlaws }), ok: !problems.length, ...(problems.length ? { note: problems.join('; ') } : {}) };
}

/** TN modifiers from edges and flaws for a test of this skill or attribute (names match case-insensitively). */
export function qualityModifiers(list: readonly Quality[], o: { skill?: string; attribute?: string }): TargetNumberModifier[] {
  if (!S().qualities.enabled) return [];
  const want = [o.skill, o.attribute].filter(Boolean).map((x) => String(x).toLowerCase());
  return list.filter((q) => q.target && Number(q.tn) && want.includes(String(q.target).toLowerCase()))
    .map((q) => ({ label: `${q.kind === 'flaw' ? tx('SR2E.Card.Street.flaw') : tx('SR2E.Card.Street.edge')}: ${q.name}`, value: Math.floor(Number(q.tn)) }));
}

// ---------------------------------------------------------------- Movement and athletics

/** Metres per Combat Turn walking and running, by Quickness and the metatype's run multiplier. */
export function movementRates(quickness: number, runMultiplier: number = RULES.COMBAT.movement.run): { walk: number; run: number } {
  const q = Math.max(0, quickness);
  return { walk: q * RULES.COMBAT.movement.walk, run: q * Math.max(1, runMultiplier) };
}

export type AthleticsKind = 'climb' | 'swim' | 'jump';

/** An athletics test's TN for a condition. */
export function athleticsTn(kind: AthleticsKind, condition = ''): { tn: number; label: string } {
  const a = S().athletics;
  if (kind === 'jump') return { tn: a.jump.tn, label: 'Jump' };
  const list = a[kind];
  const c = list.find((x) => x.id === condition) ?? list[1] ?? list[0]!;
  return { tn: c.tn, label: c.label };
}

/** How far an athletics test gets: metres climbed, swum or jumped. */
export function athleticsDistance(kind: AthleticsKind, successes: number, running = false): number {
  const a = S().athletics;
  const s = Math.max(0, successes);
  if (kind === 'jump') return s * a.jump.metresPerSuccess * (running ? a.jump.runningMultiplier : 1);
  return s * a.metresPerSuccess;
}

// ---------------------------------------------------------------- Open, complementary and teamwork tests

/** An open test's result: the highest die (Rule of Six totals count). */
export function openTestResult(dice: readonly DieResult[]): number {
  return dice.reduce((n, d) => Math.max(n, d.total), 0);
}

/** Dice a complementary skill adds to the main test. */
export function complementaryDice(successes: number): number {
  return Math.floor(Math.max(0, successes) / Math.max(1, S().tests.complementary.successesPerDie));
}

/** Dice helpers add to the leader's test: their successes, at most the leader's rating (`teamwork.cap`). */
export function teamworkDice(helperSuccesses: readonly number[], leaderRating: number): number {
  const sum = helperSuccesses.reduce((n, x) => n + Math.max(0, x), 0);
  return S().tests.teamwork.cap === 'rating' ? Math.min(sum, Math.max(0, leaderRating)) : sum;
}

// ---------------------------------------------------------------- Reputation

/**
 * Street Cred: career Karma / credPerKarma when automatic, else the sheet's number.
 * v0.58.0: less Notoriety (at least 0) when CHARACTERS_V58.notoriety.offCred is on.
 */
export function streetCred(o: { career: number; manual: number; notoriety?: number }): number {
  const r = S().reputation;
  const cred = r.autoCred ? Math.floor(Math.max(0, o.career) / Math.max(1, r.credPerKarma)) : Math.max(0, Math.floor(o.manual || 0));
  const notoriety = Math.max(0, Math.floor(Number(o.notoriety) || 0));
  return RULES.CHARACTERS_V58.notoriety.offCred && notoriety ? Math.max(0, cred - notoriety) : cred;
}

/** Street Cred's TN modifier on social and legwork tests (empty when off or 0). */
export function reputationModifiers(cred: number): TargetNumberModifier[] {
  const r = S().reputation;
  const v = r.enabled ? -Math.floor(Math.max(0, cred) * r.socialTnPerCred) : 0;
  return v ? [{ label: tx('SR2E.Card.Mod.streetCred', { cred }), value: v }] : [];
}

// ---------------------------------------------------------------- Modifier tables, rallying

/** The picked rows of a modifier table, as TN modifiers. */
export function tableModifiers(table: ReadonlyArray<{ id: string; label: string; value: number }>, ids: readonly string[]): TargetNumberModifier[] {
  return table.filter((r) => ids.includes(r.id) && r.value).map((r) => ({ label: r.label, value: r.value }));
}

/** Rallying a broken group: the TN. */
export function rallyTarget(casualties: number): number {
  const r = S().rally;
  return r.tn + Math.max(0, casualties) * r.tnPerCasualty;
}

// ---------------------------------------------------------------- Contacts, haggling, fencing

/** Extra legwork dice bought with payment: one per nuyenPerDie, at most the contact's Loyalty. */
export function paidDice(nuyen: number, loyalty: number): number {
  const c = S().contacts;
  return Math.min(Math.max(0, Math.floor(loyalty || 0)), Math.floor(Math.max(0, nuyen) / Math.max(1, c.nuyenPerDie)));
}

/** A haggled price: each net success (positive: the buyer's) moves it percentPerNet, capped. */
export function haggledPrice(price: number, net: number): { price: number; percent: number } {
  const h = S().haggle;
  const pct = Math.max(-h.maxPercent, Math.min(h.maxPercent, net * h.percentPerNet));
  return { price: Math.max(0, Math.round(price * (100 - pct) / 100)), percent: pct };
}

/** What a fence pays for loot worth `value`: the base share plus percentPerNet per net success, capped. */
export function fencePrice(value: number, net: number): { price: number; percent: number } {
  const f = S().fence;
  // v0.92.3 (RULES.CORE_V923.fence 'book', Core p. 188): a fence who wins never pays below 10%.
  const pct = Math.max(fenceFloor(), Math.min(f.maxPercent, f.basePercent + net * f.percentPerNet));
  return { price: Math.max(0, Math.round(value * pct / 100)), percent: pct };
}
