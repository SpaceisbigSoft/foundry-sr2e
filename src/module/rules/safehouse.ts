/**
 * Safehouse construction (v0.53.0): pure functions that add up a safehouse built from a location, a
 * size and any options in `RULES.SAFEHOUSE`. Nothing here is book data (VERIFY / house rules): SR2
 * has lifestyles but no construction rules. The sheet (`applications/safehouse.ts`) shows the totals
 * and turns them into a security site actor, a ward barrier, a home host and library/lodge gear.
 */
import { RULES } from './config.ts';
import { DAY_SECONDS } from './upkeep.ts';
import { generateSheaf } from './sheafgen.ts';
import type { TargetNumberModifier } from './dice.ts';
import { t as tx } from '../helpers/i18n.ts';

export type SafehouseOptionDef = (typeof RULES.SAFEHOUSE.options)[number];
export type SafehouseLocation = (typeof RULES.SAFEHOUSE.locations)[number];
export type SafehouseSize = (typeof RULES.SAFEHOUSE.sizes)[number];

/** One chosen option on a safehouse sheet. */
export interface SafehouseChoice { id?: string; key: string; rating?: number; notes?: string }

export interface SafehouseDevice { kind: string; name: string; rating: number; sense: string; scanKind: string; identifies: boolean; key: string }

export interface SafehouseLine {
  key: string; label: string; category: string; rating: number; rated: boolean;
  cost: number; upkeep: number; space: number; note: string; problems: string[];
  /** v0.89.5: false for a repeat of a one-off option or one missing what it needs (listed, counts for nothing). */
  counted?: boolean;
  /** v0.89.5: a repeat of a one-off option. */
  duplicate?: boolean;
}

export interface SafehouseTotals {
  location: SafehouseLocation;
  size: SafehouseSize;
  lines: SafehouseLine[];
  buildCost: number;
  upkeep: number;
  space: number;
  spaceUsed: number;
  security: number;
  concealment: number;
  comfort: string;
  comfortSteps: number;
  barrier: number;
  ward: number;
  medical: number;
  workshop: number;
  garage: number;
  supplies: number;
  host: number;
  magicSites: Array<{ kind: string; rating: number; label: string }>;
  devices: SafehouseDevice[];
  residents: number;
  warnings: string[];
}

const LIFESTYLES = (): string[] => RULES.UPKEEP.lifestyles.map((l) => l.id);

export function safehouseOption(key: string): SafehouseOptionDef | undefined {
  return RULES.SAFEHOUSE.options.find((o) => o.id === key);
}
export function safehouseLocation(id: string): SafehouseLocation {
  return RULES.SAFEHOUSE.locations.find((l) => l.id === id) ?? RULES.SAFEHOUSE.locations.find((l) => l.id === 'residential') ?? RULES.SAFEHOUSE.locations[0]!;
}
export function safehouseSize(id: string): SafehouseSize {
  return RULES.SAFEHOUSE.sizes.find((s) => s.id === id) ?? RULES.SAFEHOUSE.sizes.find((s) => s.id === 'apartment') ?? RULES.SAFEHOUSE.sizes[0]!;
}

/** The rating an option counts at: clamped to its range (unrated options count as 1). */
export function optionRating(def: SafehouseOptionDef, rating: unknown): number {
  const range = (def as any).rating as readonly [number, number] | undefined;
  if (!range) return 1;
  const n = Math.floor(Number(rating));
  return Math.max(range[0], Math.min(range[1], Number.isFinite(n) ? n : range[0]));
}

/** Move a lifestyle id up (+) or down (−) by whole steps, within the list. */
export function lifestyleStep(id: string, steps: number): string {
  const order = LIFESTYLES();
  const i = Math.max(0, order.indexOf(id));
  return order[Math.max(0, Math.min(order.length - 1, i + Math.trunc(steps)))]!;
}

/** The better (higher) of two lifestyle ids. */
export function betterLifestyle(a: string, b: string): string {
  const order = LIFESTYLES();
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

/** The lower of two lifestyle ids. */
function lowerLifestyle(a: string, b: string): string {
  const order = LIFESTYLES();
  const ia = order.indexOf(a), ib = order.indexOf(b);
  if (ia < 0) return b;
  if (ib < 0) return a;
  return ib < ia ? b : a;
}

/** Add up a safehouse. Unknown option keys are listed as warnings and count for nothing. */
export function safehouseTotals(o: { location: string; size: string; options: ReadonlyArray<SafehouseChoice> }): SafehouseTotals {
  const loc = safehouseLocation(o.location);
  const size = safehouseSize(o.size);
  const warnings: string[] = [];
  const lines: SafehouseLine[] = [];
  const devices: SafehouseDevice[] = [];
  const magicSites: SafehouseTotals['magicSites'] = [];
  const sum = { security: loc.security, concealment: loc.concealment, comfort: 0, barrier: size.barrier, ward: 0, medical: 0, workshop: 0, garage: 0, supplies: 0, host: 0 };
  let cost = Math.round(size.cost * loc.costMult);
  let upkeep = size.upkeep;
  let spaceUsed = 0;
  const choices = o.options ?? [];
  const keys = new Set(choices.map((c) => c.key));
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const c of choices) {
    const def = safehouseOption(c.key);
    if (!def) { warnings.push(tx('SR2E.Text.Safehouse.unknownOptionIsIgnored', { key: c.key })); continue; }
    const problems: string[] = [];
    // v0.89.5: what the line's problems mean is kept as flags, never read back from their text.
    const duplicate = seen.has(def.id) && !(def as any).repeat;
    let missingNeed = false;
    if (duplicate) problems.push(tx('SR2E.Text.Safehouse.onlyOneOfTheseCounts'));
    seen.add(def.id);
    const rating = optionRating(def, c.rating);
    const range = (def as any).rating as readonly [number, number] | undefined;
    if (range && c.rating != null && Number(c.rating) !== rating) problems.push(tx('SR2E.Text.Safehouse.ratingRange', { min: range[0], max: range[1] }));
    const mult = (def as any).perRating ? rating : 1;
    for (const req of ((def as any).requires ?? []) as string[]) {
      if (!keys.has(req)) { missingNeed = true; problems.push(tx('SR2E.Text.Safehouse.needs', { label: safehouseOption(req)?.label ?? req })); }
    }
    // A duplicate of a one-off option, or one missing what it needs, is listed but counts for nothing.
    const counted = !duplicate && !missingNeed;
    const line: SafehouseLine = {
      key: def.id, label: def.label, category: def.category, rating, rated: Boolean(range),
      cost: def.cost * mult, upkeep: def.upkeep * mult, space: def.space * ((def as any).spacePerRating ? rating : 1),
      note: (def as any).note ?? '', problems, counted, duplicate,
    };
    lines.push(line);
    if (!counted) continue;
    counts.set(def.id, (counts.get(def.id) ?? 0) + 1);
    cost += line.cost;
    upkeep += line.upkeep;
    spaceUsed += line.space;
    const e: any = def.effects ?? {};
    for (const k of ['security', 'concealment', 'comfort', 'barrier', 'medical', 'workshop', 'garage', 'supplies'] as const) {
      if (typeof e[k] === 'number') sum[k] += e[k] * mult;
    }
    if (typeof e.ward === 'number') sum.ward = Math.max(sum.ward, e.ward * rating);
    if (typeof e.host === 'number') sum.host = Math.max(sum.host, e.host * rating);
    if (e.magicSite) magicSites.push({ kind: String(e.magicSite), rating, label: def.label });
    if (e.device) {
      const n = counts.get(def.id) ?? 1;
      devices.push({
        key: def.id, kind: String(e.device.kind), name: `${e.device.name}${(def as any).repeat ? ` ${n}` : ''}`, rating,
        sense: String(e.device.sense ?? ''), scanKind: String(e.device.scanKind ?? ''), identifies: Boolean(e.device.identifies),
      });
    }
  }
  const space = size.space;
  if (spaceUsed > space) warnings.push(tx('SR2E.Text.Safehouse.usesSpaceTheHas', { spaceUsed, size: size.label.toLowerCase(), space }));
  for (const l of lines) for (const p of l.problems) warnings.push(tx('SR2E.Text.Safehouse.lineProblem', { label: l.label, problem: p }));
  const comfortSteps = Math.floor(sum.comfort);
  const raw = lifestyleStep(size.comfort, comfortSteps);
  const comfort = lowerLifestyle(raw, loc.comfortCap);
  if (comfort !== raw) warnings.push(tx('SR2E.Text.Safehouse.comfortIsCappedAt', { lifestyle: RULES.UPKEEP.lifestyles.find((l) => l.id === loc.comfortCap)?.label ?? loc.comfortCap }));
  return {
    location: loc, size, lines,
    buildCost: Math.max(0, Math.round(cost)),
    upkeep: Math.max(0, Math.round(upkeep * loc.upkeepMult)),
    space, spaceUsed,
    security: Math.max(0, Math.min(RULES.SAFEHOUSE.caps.security, Math.floor(sum.security))),
    concealment: Math.max(-RULES.SAFEHOUSE.caps.concealment, Math.min(RULES.SAFEHOUSE.caps.concealment, Math.floor(sum.concealment))),
    comfort, comfortSteps,
    barrier: Math.max(0, Math.floor(sum.barrier)),
    ward: Math.floor(sum.ward),
    medical: Math.floor(sum.medical),
    workshop: Math.floor(sum.workshop),
    garage: Math.floor(sum.garage),
    supplies: Math.floor(sum.supplies),
    host: Math.floor(sum.host),
    magicSites, devices, residents: size.residents, warnings,
  };
}

/** Paying `months` of upkeep: the cost and the new "paid until" (from now, or from the old date if later). */
export function paySafehouse(o: { upkeep: number; months: number; paidUntil: number; now: number }): { cost: number; paidUntil: number } {
  const months = Math.max(0, Math.floor(o.months) || 0);
  const from = Math.max(o.now, o.paidUntil);
  return { cost: Math.max(0, Math.round(o.upkeep)) * months, paidUntil: from + months * RULES.UPKEEP.monthDays * DAY_SECONDS };
}

/** Upkeep status: days left (negative overdue; null never paid), and whether it is past the grace days. */
export function safehouseUpkeepStatus(paidUntil: number, now: number): { days: number | null; overdue: boolean; lapsed: boolean } {
  if (!(paidUntil >= 0)) return { days: null, overdue: false, lapsed: false };
  const d = (paidUntil - now) / DAY_SECONDS;
  const days = d >= 0 ? Math.floor(d) : -Math.ceil(-d);
  return { days, overdue: days < 0, lapsed: days < 0 && -days > RULES.SAFEHOUSE.graceDays };
}

/** The comfort the residents get now: lapsed upkeep drops it to `overdueComfort` (if that is lower). */
export function safehouseComfort(comfort: string, lapsed: boolean): string {
  return lapsed ? lowerLifestyle(comfort, RULES.SAFEHOUSE.overdueComfort) : comfort;
}

/** What still has to be paid to build it (never negative: removed options are not refunded). */
export function buildOwed(buildCost: number, buildPaid: number): number {
  return Math.max(0, Math.round(buildCost) - Math.max(0, Math.round(buildPaid) || 0));
}

/** Searching for the safehouse: the TN and its modifiers. */
export function searchTarget(concealment: number, extra = 0): { tn: number; modifiers: TargetNumberModifier[]; needed: number } {
  const s = RULES.SAFEHOUSE.search;
  const modifiers: TargetNumberModifier[] = [];
  if (concealment) modifiers.push({ id: 'safehouseConcealment', label: tx('SR2E.Card.Mod.safehouseConcealment'), value: concealment });
  if (extra) modifiers.push({ id: 'other', label: tx('SR2E.Card.Mod.other'), value: extra });
  const total = s.baseTn + concealment + extra;
  // Keep the minimum TN: a negative concealment can't take it below `minTn`.
  if (total < s.minTn) modifiers.push({ id: 'minimumTn', label: tx('SR2E.Card.Mod.minimumTn'), value: s.minTn - total });
  return { tn: s.baseTn, modifiers, needed: s.successes };
}

/** How long the search takes with `successes` (null: not found). */
export function searchDays(successes: number): number | null {
  const s = RULES.SAFEHOUSE.search;
  if (successes < s.successes) return null;
  return Math.max(1, Math.ceil(s.days / Math.max(1, successes)));
}

/** Home care: the better of the resident's own lifestyle and the safehouse's comfort, plus its medical modifier. */
export function safehouseHomeCare(own: string, homes: ReadonlyArray<{ comfort: string; medical: number; name: string }>): { lifestyle: string; medical: number; from: string } {
  if (!RULES.SAFEHOUSE.homeCare || !homes.length) return { lifestyle: own, medical: 0, from: '' };
  let best = { lifestyle: own, medical: 0, from: '' };
  const order = LIFESTYLES();
  const score = (l: string, m: number) => order.indexOf(l) * 10 - m;
  for (const h of homes) {
    const l = betterLifestyle(own, h.comfort);
    if (score(l, h.medical) > score(best.lifestyle, best.medical)) best = { lifestyle: l, medical: h.medical, from: h.name };
  }
  return best;
}

/** The home host's data for a host actor of that Security Value. */
export function safehouseHostData(name: string, value: number): { name: string; type: string; system: Record<string, unknown> } {
  const v = Math.max(1, Math.min(20, Math.floor(value) || 1));
  const code = v <= 2 ? 'blue' : v <= 4 ? 'green' : v <= 6 ? 'orange' : 'red';
  const subs = Object.fromEntries(RULES.MATRIX.subsystems.map((k: string, i: number) => [k, Math.max(2, Math.min(20, Math.round(v * 1.5) + ((i % 3) - 1)))]));
  // v0.71.0 (R9): a generated security sheaf (RULES.FIXES_V71.sheafOnGenerated), the same for the same name and value.
  const sheaf = RULES.FIXES_V71.sheafOnGenerated ? { sheaf: generateSheaf({ securityCode: code, securityValue: v, seed: `${name}|${code}|${v}` }) } : {};
  return { name: `${name} host`, type: 'host', system: { securityCode: code, securityValue: v, subsystems: subs, ...sheaf } };
}

/** The site actor's device list for these devices (ids from `idOf`). */
export function siteDevicesFor(devices: ReadonlyArray<SafehouseDevice>, idOf: (i: number) => string): Array<Record<string, unknown>> {
  return devices.map((d, i) => ({
    id: idOf(i), name: d.name, kind: d.kind, rating: d.rating, sense: d.sense, scanKind: d.scanKind, identifies: d.identifies,
    active: true, bypassed: false, tokenUuid: '', sceneId: '', wallId: '', tamper: 0, notes: `Safehouse: ${d.key}`,
  }));
}

/** A short line of what an option does, for the catalog ("Security +0.5/rating · camera (visual)"). */
export function describeOption(def: SafehouseOptionDef): string {
  const e: any = def.effects ?? {};
  const per = (def as any).perRating ? tx('SR2E.Text.Safehouse.perRating') : '';
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const parts: string[] = [];
  const names: Record<string, string> = { security: tx('SR2E.Text.Safehouse.security'), concealment: tx('SR2E.Text.Safehouse.concealment'), comfort: tx('SR2E.Text.Safehouse.comfortStep'), barrier: tx('SR2E.Text.Safehouse.barrier'), medical: tx('SR2E.Text.Safehouse.healingTn'), workshop: tx('SR2E.Text.Safehouse.buildRepairTn'), garage: tx('SR2E.Text.Safehouse.vehicleBay'), supplies: tx('SR2E.Text.Safehouse.weekOfSupplies') };
  for (const k of Object.keys(names)) if (typeof e[k] === 'number' && e[k]) parts.push(tx('SR2E.Text.Safehouse.effectPart', { name: names[k], value: sign(e[k]), per }));
  if (e.ward) parts.push(tx('SR2E.Text.Safehouse.wardOfForceRating'));
  if (e.host) parts.push(tx('SR2E.Text.Safehouse.homeHostSecurityValue'));
  if (e.magicSite) parts.push(e.magicSite === 'lodge' ? tx('SR2E.Text.Safehouse.lodgeOfThatRating') : e.magicSite === 'library' ? tx('SR2E.Text.Safehouse.libraryOfThatRating') : tx('SR2E.Text.Safehouse.circleOfThatRating'));
  if (e.device) {
    const detail = e.device.sense ? e.device.sense : e.device.scanKind ? e.device.scanKind : '';
    parts.push(detail ? tx('SR2E.Text.Safehouse.deviceDetail', { kind: e.device.kind, detail }) : e.device.identifies ? tx('SR2E.Text.Safehouse.deviceIdentifies', { kind: e.device.kind }) : tx('SR2E.Text.Safehouse.device', { kind: e.device.kind }));
  }
  const req = ((def as any).requires ?? []) as string[];
  if (req.length) parts.push(tx('SR2E.Text.Safehouse.needsList', { list: req.map((r) => safehouseOption(r)?.label ?? r).join(', ') }));
  return parts.join(' · ');
}

/** The rating a newly added option starts at: devices at 4 (within range), others at the minimum. */
export function defaultRating(def: SafehouseOptionDef): number {
  const range = (def as any).rating as readonly [number, number] | undefined;
  if (!range) return 1;
  return (def.effects as any)?.device ? Math.max(range[0], Math.min(range[1], 4)) : range[0];
}
