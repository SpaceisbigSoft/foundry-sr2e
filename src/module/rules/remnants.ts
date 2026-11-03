import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { fencePrice } from './street.ts';
import { programDesign } from './netrig.ts';
import { optionSizeMultiplier } from './matrix.ts';
import { bearingDiff } from './util.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

/**
 * Street, Matrix, rigging and security leftovers (v0.49.0). Pure rules, no Foundry dependency.
 * Values in RULES.STREET (qualities.karma, contacts, heat), RULES.MORALE.mixed,
 * RULES.UPKEEP.effects, RULES.MATRIX (otaku channels and complex forms, programming suites and
 * options, deck parts), RULES.VEHICLES (turrets, install, cargo), RULES.SECURITY (guards,
 * identity, tamper). All VERIFY: from memory of SR2, the Shadowrun Companion, Virtual Realities 2.0
 * and the Rigger Black Book, or house rules.
 */

const clampInt = (n: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(Number(n) || 0)));

// ---------------------------------------------------------------- Builder: skills and gear

export type SkillKind = 'active' | 'knowledge' | 'language' | 'buildRepair';

export interface BuilderSkill { name: string; rating: number; kind: SkillKind; specialization?: string; specializationRating?: number }

/** Split a list on commas, semicolons and new lines that are not inside brackets or parentheses (or a number's thousands). */
export function splitList(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  const t = String(text ?? '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    // A comma between digits is a thousands separator (5,000¥), not a new entry.
    const thousands = ch === ',' && /\d/.test(t[i - 1] ?? '') && /\d{3}/.test(t.slice(i + 1, i + 4));
    if ((ch === ',' || ch === '\n' || ch === ';') && depth === 0 && !thousands) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.replace(/\r/g, '').trim()).filter(Boolean);
}

/**
 * The builder's skill list: "Firearms 5, Stealth 3 (Urban 5), Computer B/R 2". A specialization in
 * parentheses takes the rating after it (else rating + 2, the usual SR2 split). Names ending in "B/R"
 * are Build/Repair skills when the list is of active skills.
 */
export function parseSkillList(text: string, kind: 'active' | 'knowledge' | 'language' = 'active'): { skills: BuilderSkill[]; warnings: string[] } {
  const skills: BuilderSkill[] = [];
  const warnings: string[] = [];
  for (const entry of splitList(text)) {
    const m = /^(.+?)\s+(\d+)\s*(?:\(\s*([^)]*?)\s*(\d+)?\s*\))?$/.exec(entry);
    if (!m) { warnings.push(tx('SR2E.Text.Remnants.cantReadSkill', { entry })); continue; }
    // "Firearms (Pistols) 5": the specialization written before the rating.
    const named = !m[3] ? /^(.+?)\s*\((.+)\)$/.exec(m[1]!.trim()) : null;
    const name = (named ? named[1]! : m[1]!).trim();
    const rating = Math.max(0, Number(m[2]));
    const k: SkillKind = kind === 'active' && /\bB\s*\/\s*R\b/i.test(name) ? 'buildRepair' : kind;
    const s: BuilderSkill = { name, rating, kind: k };
    if (m[3]) { s.specialization = m[3].trim(); s.specializationRating = m[4] ? Number(m[4]) : rating + 2; }
    else if (named) { s.specialization = named[2]!.trim(); s.specializationRating = rating + 2; }
    if (skills.some((x) => x.name.toLowerCase() === name.toLowerCase())) warnings.push(tx('SR2E.Text.Remnants.isListedTwiceTheLast', { name }));
    const i = skills.findIndex((x) => x.name.toLowerCase() === name.toLowerCase());
    if (i >= 0) skills.splice(i, 1);
    skills.push(s);
  }
  return { skills, warnings };
}

export interface GearTemplate { id?: string; type: string; name: string; system: Record<string, unknown> }
export interface BuilderGear { name: string; type: string; system: Record<string, unknown>; cost: number; qty: number; template: string }

/**
 * The builder's gear list: "Heavy pistol, Armor jacket ×2, Medkit ¥250, Fake SIN ¥5000". A name that
 * matches an item template (case-insensitive) takes its item type and fields, and its price unless one
 * is given (¥ before or after the number, or "nuyen"). Anything else becomes plain gear at its price.
 */
export function parseGearList(text: string, templates: readonly GearTemplate[]): { items: BuilderGear[]; total: number; warnings: string[] } {
  const items: BuilderGear[] = [];
  const warnings: string[] = [];
  for (const raw of splitList(text)) {
    let entry = raw;
    let price: number | null = null;
    const pr = /¥\s*([\d,]+)|([\d,]+)\s*(?:¥|nuyen\b)/i.exec(entry);
    if (pr) {
      price = Math.round(Number(String(pr[1] ?? pr[2]).replace(/,/g, '')));
      entry = `${entry.slice(0, pr.index)} ${entry.slice(pr.index + pr[0].length)}`.replace(/\(\s*\)/g, '').trim();
    }
    let qty = 1;
    const q = /\s*[×*]\s*(\d+)\s*$|\s+x\s*(\d+)\s*$/i.exec(entry);
    if (q) { qty = Math.max(1, Number(q[1] ?? q[2])); entry = entry.slice(0, q.index).trim(); }
    const name = entry.replace(/[\s,:-]+$/, '').trim();
    if (!name) { warnings.push(tx('SR2E.Text.Remnants.cantReadGear', { raw })); continue; }
    const t = templates.find((x) => x.name.toLowerCase() === name.toLowerCase());
    const listCost = Number(t?.system?.['cost'] ?? 0);
    const cost = Math.max(0, price ?? listCost);
    if (price == null && !listCost) warnings.push(tx('SR2E.Text.Remnants.noPriceAddOne', { name }));
    const type = t?.type ?? 'gear';
    const system: Record<string, unknown> = { ...(t ? structuredClone(t.system) : {}), cost };
    if (type === 'gear') system['quantity'] = qty;
    items.push({ name: t ? t.name : name, type, system, cost, qty, template: t?.id ?? '' });
  }
  const total = items.reduce((n, i) => n + i.cost * i.qty, 0);
  return { items, total, warnings };
}

// ---------------------------------------------------------------- Edges and flaws with Karma

/** Good Karma to gain an edge, or to buy off a flaw, after creation. */
export function qualityKarmaCost(kind: 'edge' | 'flaw', points: number): number {
  const k = RULES.STREET.qualities.karma;
  const p = Math.max(0, Math.floor(Number(points) || 0));
  return p * (kind === 'flaw' ? k.flawPerPoint : k.edgePerPoint);
}

// ---------------------------------------------------------------- Contacts' own dice and favours

/** The successes legwork ends with when the contact digs too (RULES.STREET.contacts.ownDice). */
export function contactDigSuccesses(mine: number, theirs: number | null): { successes: number; note: string } {
  const mode = RULES.STREET.contacts.ownDice;
  if (theirs == null || mode === 'off') return { successes: Math.max(0, mine), note: '' };
  const a = Math.max(0, mine), b = Math.max(0, theirs);
  if (mode === 'add') return { successes: a + b, note: tx('SR2E.Text.Remnants.yoursPlusTheirs', { a, b }) };
  if (mode === 'instead') return { successes: b, note: tx('SR2E.Text.Remnants.theContacts', { b }) };
  return { successes: Math.max(a, b), note: tx('SR2E.Text.Remnants.theBetterOfYours', { a, b }) };
}

/** Calling in a favour: extra dice, the fee waived or not, and the favour count after (into debt below 0). */
export function callFavour(favours: number): { dice: number; waiveFee: boolean; after: number; debt: boolean; refused: boolean } {
  const c = RULES.STREET.contacts;
  const now = Math.floor(Number(favours) || 0);
  if (now <= -c.maxFavours) return { dice: 0, waiveFee: false, after: now, debt: true, refused: true };
  const after = now - 1;
  return { dice: Math.max(0, c.favourDice), waiveFee: Boolean(c.favourWaivesFee), after, debt: after < 0, refused: false };
}

/** A favour count kept within ±RULES.STREET.contacts.maxFavours. */
export function clampFavours(n: number): number {
  const m = RULES.STREET.contacts.maxFavours;
  return clampInt(n, -m, m);
}

// ---------------------------------------------------------------- Heat on stolen goods

/** An item's Heat now: it cools by 1 every coolDays of world time after it was set. */
export function currentHeat(heat: number, heatAt: number, now: number): number {
  const h = RULES.STREET.heat;
  const base = clampInt(heat, 0, h.max);
  if (!base || !(heatAt >= 0) || !(h.coolDays > 0)) return base;
  const cooled = Math.floor(Math.max(0, now - heatAt) / (h.coolDays * 86400));
  return Math.max(0, base - cooled);
}

/** What a fence pays for hot goods: the usual offer less percentPerPoint% per point of Heat, or a refusal. */
export function hotFencePrice(value: number, net: number, heat: number): { price: number; percent: number; refused: boolean; heatCut: number } {
  const h = RULES.STREET.heat;
  const base = fencePrice(value, net);
  const hv = h.enabled ? Math.max(0, Math.floor(heat || 0)) : 0;
  if (hv > h.refuseAbove) return { price: 0, percent: 0, refused: true, heatCut: 0 };
  const cut = Math.min(base.percent, hv * h.percentPerPoint);
  const percent = Math.max(0, base.percent - cut);
  return { price: Math.max(0, Math.round(value * percent / 100)), percent, refused: false, heatCut: cut };
}

// ---------------------------------------------------------------- Morale for mixed groups

/** The Professional Rating a mixed group tests with (RULES.MORALE.mixed). */
export function mixedMoraleRating(ratings: readonly number[], leader: number, mode: string = RULES.MORALE.mixed): number {
  const r = ratings.map((x) => Math.max(0, Math.floor(Number(x) || 0)));
  if (mode === 'leader' || !r.length) return Math.max(0, Math.floor(leader || 0));
  if (mode === 'lowest') return Math.min(...r);
  if (mode === 'average') return Math.floor(r.reduce((a, b) => a + b, 0) / r.length);
  return Math.max(...r);
}

// ---------------------------------------------------------------- Lifestyle beyond the bill

const LIFESTYLE_ORDER = () => RULES.UPKEEP.lifestyles.map((l) => l.id);

/** The lifestyle one step down (street stays street). */
export function lifestyleDown(level: string): string {
  const order = LIFESTYLE_ORDER();
  const i = order.indexOf(level);
  return i > 0 ? order[i - 1]! : order[0]!;
}

/** Whether rent is overdue past the grace days (`days` = days left: negative is overdue, null never paid). */
export function lifestyleOverdue(days: number | null, level: string): { overdue: boolean; evict: boolean; daysLate: number } {
  const e = RULES.UPKEEP.effects;
  const order = LIFESTYLE_ORDER();
  if (days == null || days >= 0 || level === order[0]) return { overdue: false, evict: false, daysLate: 0 };
  const late = Math.ceil(-days);
  return { overdue: true, evict: e.overdue !== 'off' && late > e.graceDays, daysLate: late };
}

/** The lifestyle's connections on availability tests (finding gear). */
export function lifestyleAvailabilityMods(level: string): TargetNumberModifier[] {
  const v = Number(RULES.UPKEEP.effects.availabilityTn[level] ?? 0);
  const label = RULES.UPKEEP.lifestyles.find((l) => l.id === level)?.label ?? level;
  return v ? [{ label: tx('SR2E.Card.Mod.lifestyle', { label }), value: v }] : [];
}

/** The lifestyle home care counts as: the street one once the rent is overdue past the grace days (RULES.UPKEEP.effects.overdueHomeCare). */
export function homeCareLifestyle(level: string, days: number | null): string {
  const o = RULES.UPKEEP.effects.overdueHomeCare;
  return o && days != null && -days > RULES.UPKEEP.effects.graceDays ? o : level;
}

// ---------------------------------------------------------------- Otaku channels and complex forms

/** The most a channel or complex form can be rated. */
export function otakuCap(mpcp: number): number {
  return Math.max(0, Math.floor(mpcp || 0));
}

/** Good Karma to raise a channel to `to`. */
export function channelRaiseCost(to: number): number {
  return Math.max(0, Math.floor(to)) * RULES.MATRIX.otaku.channels.karmaPerRating;
}

/** Good Karma to learn a complex form of this rating. */
export function complexFormCost(rating: number): number {
  return Math.max(0, Math.floor(rating)) * RULES.MATRIX.otaku.complexForms.karmaPerRating;
}

/**
 * How a channel helps a test on its subsystem: as a utility (the better of the channel and the
 * loaded utility lowers the TN; returns the rating that should count) or as extra dice.
 */
export function channelEffect(channel: number, utilityRating: number): { utility: number; dice: number; note: string } {
  const c = Math.max(0, Math.floor(channel || 0));
  const u = Math.max(0, Math.floor(utilityRating || 0));
  if (!c) return { utility: u, dice: 0, note: '' };
  if (RULES.MATRIX.otaku.channels.mode === 'dice') return { utility: u, dice: c, note: tx('SR2E.Text.Remnants.channelDice', { c }) };
  return c > u ? { utility: c, dice: 0, note: tx('SR2E.Text.Remnants.channel', { c }) } : { utility: u, dice: 0, note: '' };
}

// ---------------------------------------------------------------- Programming suites and options

export type ProgramOption = (typeof RULES.MATRIX.programming.options)[number];

/** The options picked, from RULES.MATRIX.programming.options (unknown ids dropped). */
export function programOptions(ids: readonly string[] | null | undefined): ProgramOption[] {
  const list = RULES.MATRIX.programming.options;
  return [...new Set(ids ?? [])].map((id) => list.find((o) => o.id === id)).filter((o): o is ProgramOption => Boolean(o));
}

/** A program's size with its options applied (rounded up, at least 1 when it had any size). */
export function sizeWithOptions(size: number, ids: readonly string[] | null | undefined): number {
  const s = Math.max(0, size);
  return s ? Math.max(1, Math.ceil(s * optionSizeMultiplier(ids))) : 0;
}

/** Writing a program with options: its size, TN and base days. */
export function programPlan(o: { kind: string; rating: number; damageLevel?: string; options?: readonly string[] }): { size: number; tn: number; baseDays: number; labels: string[] } {
  const base = programDesign(o);
  const opts = programOptions(o.options);
  const size = sizeWithOptions(base.size, o.options);
  const tn = Math.max(RULES.MIN_TARGET_NUMBER, base.tn + opts.reduce((n, x) => n + x.tn, 0));
  const daysMult = opts.reduce((m, x) => m * x.days, 1);
  return { size, tn, baseDays: Math.max(1, Math.ceil(Math.max(1, size) * RULES.MATRIX.programming.daysPerMp * daysMult)), labels: opts.map((x) => x.label) };
}

/** What a programming suite gives: dice or a TN reduction, capped at the programmer's Computer rating. */
export function suiteBonus(suite: number, computerRating: number): { dice: number; modifiers: TargetNumberModifier[]; note: string } {
  const s = RULES.MATRIX.programming.suites;
  let r = Math.max(0, Math.floor(suite || 0));
  if (s.capAtSkill) r = Math.min(r, Math.max(0, Math.floor(computerRating || 0)));
  if (!r) return { dice: 0, modifiers: [], note: '' };
  return s.mode === 'tn' ? { dice: 0, modifiers: [{ label: tx('SR2E.Card.Mod.programmingSuite', { r }), value: -r }], note: tx('SR2E.Text.Remnants.suite', { r }) } : { dice: r, modifiers: [], note: tx('SR2E.Text.Remnants.suitePlus', { r }) };
}

// ---------------------------------------------------------------- Turrets

export interface TurretCheck { inLimit: boolean; limitOffBy: number; turn: number; steps: number; modifiers: TargetNumberModifier[]; refused: boolean; newFacing: number; note: string }

/**
 * Bringing a turret to bear on a target `relBearing` degrees from the vehicle's front: within its
 * limit (an arc centred on the front), how far it turns, and what turning further than its
 * traverse costs (RULES.VEHICLES.turrets).
 */
export function turretCheck(t: { facing?: number; traverse?: number; limit?: number }, relBearing: number): TurretCheck {
  const c = RULES.VEHICLES.turrets;
  const limit = Math.max(0, Math.min(360, Number(t.limit) > 0 ? Number(t.limit) : c.limit));
  const traverse = Math.max(0, Number(t.traverse) > 0 ? Number(t.traverse) : c.traverse);
  const rel = ((relBearing % 360) + 360) % 360;
  const fromFront = bearingDiff(rel, 0);
  const inLimit = limit >= 360 || fromFront <= limit / 2 + 1e-9;
  const limitOffBy = inLimit ? 0 : Math.round(fromFront - limit / 2);
  const facing = ((Number(t.facing) || 0) % 360 + 360) % 360;
  const turn = Math.round(bearingDiff(facing, rel));
  const steps = traverse > 0 ? Math.max(0, Math.ceil(turn / traverse - 1e-9) - 1) : 0;
  const over = steps > 0;
  const modifiers: TargetNumberModifier[] = over && c.overTraverse === 'tn' && c.tnPerStep ? [{ label: tx('SR2E.Card.Mod.turretTraverse', { turn }), value: steps * c.tnPerStep }] : [];
  const refused = over && c.overTraverse === 'block';
  // Fired past its limit anyway, it stops at the edge of the limit.
  const edge = limit / 2;
  const signed = rel > 180 ? rel - 360 : rel;
  const newFacing = inLimit ? Math.round(rel) : Math.round(((Math.sign(signed) * edge) + 360) % 360);
  const head = limit < 360 ? tx('SR2E.Text.Remnants.toTurnTraverseLimit', { turn, traverse, limit }) : tx('SR2E.Text.Remnants.toTurnTraverse', { turn, traverse });
  const note = !inLimit ? tx('SR2E.Text.Remnants.outsideItsLimit', { head, limitOffBy }) : over ? tCount(steps, 'SR2E.Text.Remnants.stepsTooFar', { head }) : head;
  return { inLimit, limitOffBy, turn, steps, modifiers, refused, newFacing, note };
}

// ---------------------------------------------------------------- Modification installation

/** Installing a modification of this rating: the TN and the base hours. */
export function modInstallPlan(rating: number): { tn: number; baseHours: number } {
  const i = RULES.VEHICLES.install;
  const r = Math.max(1, Math.floor(rating || 1));
  return { tn: Math.max(RULES.MIN_TARGET_NUMBER, i.tn + i.tnPerRating * r), baseHours: r * i.hoursPerRating };
}

// ---------------------------------------------------------------- Security: guards, masks, tamper

/** What the guards' noticing does to the site: tally per guard who noticed, and the alert. */
export function guardsNotice(noticed: number): { add: number; minAlert: string } | null {
  const g = RULES.SECURITY.guards;
  const n = Math.max(0, Math.floor(noticed || 0));
  if (!n) return null;
  return { add: n * g.tallyPerGuard, minAlert: g.alert };
}

/** A mask against a device that identifies people: a TN modifier (none for mana masks or devices that don't identify). */
export function maskEffect(kind: string, rating: number, identifies: boolean): TargetNumberModifier[] {
  if (!identifies || !['mask', 'physicalMask'].includes(kind)) return [];
  const v = Math.floor((Number(RULES.SECURITY.identity[kind]) || 0) * Math.max(0, rating || 0));
  return v ? [{ label: `${kind === 'physicalMask' ? tx('SR2E.Card.Remnants.physicalMask') : tx('SR2E.Card.Remnants.mask')} ${rating}`, value: v }] : [];
}

/**
 * Forcing a device (its door broken, or the device smashed or cut out): a tamper alarm trips with no
 * roll; a device without one still drops off the board (RULES.SECURITY.tamper.deadTally).
 */
export function forcedDevice(tamper: number, how: 'breach' | 'force'): { trips: boolean; add: number; minAlert: string; note: string } {
  const t = RULES.SECURITY.tamper;
  const on = how === 'breach' ? t.onBreach : t.onForce;
  if (tamper > 0 && on) return { trips: true, add: t.tally, minAlert: t.alert, note: tx('SR2E.Text.Remnants.itsTamperAlarmTrips') };
  if (how === 'force' && t.deadTally > 0) return { trips: false, add: t.deadTally, minAlert: '', note: tx('SR2E.Text.Remnants.itGoesDeadOnThe') };
  return { trips: false, add: 0, minAlert: '', note: '' };
}
