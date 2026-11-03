import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { lifestyleOf } from './upkeep.ts';
import { perceptionSightModifiers } from './docs79-melee-vision.ts';
import { urrCoreNativeBonus } from './urr80-core.ts';
import { own } from './util.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

/**
 * Everyday character rules (v0.58.0): plain Perception, time ÷ successes, Build/Repair tools,
 * creation costs for contacts and lifestyle, languages, training time, pay negotiation, the Karma
 * award breakdown, recognition and Reaction-linked skills. Values in RULES.CHARACTERS_V58 (VERIFY).
 * Pure rules; no Foundry.
 */

const C = () => RULES.CHARACTERS_V58;

/** A finite number or 0. */
const num = (n: unknown): number => (Number.isFinite(Number(n)) ? Number(n) : 0);
/** Strip float noise (0.30000000000000004 → 0.3). */
const clean = (n: number): number => Number(n.toFixed(10));
/** The highest `reveals` row reached by these successes, or `none`. */
const reveal = (rows: ReadonlyArray<{ successes: number; text: string }>, successes: number, none: string): string => {
  const s = Math.floor(num(successes));
  let best: { successes: number; text: string } | null = null;
  for (const r of rows) if (r.successes <= s && r.successes > 0 && (!best || r.successes > best.successes)) best = r;
  return best ? best.text : none;
};

// ---------------------------------------------------------------- Plain Perception

/** v0.58.0: a plain Perception test (no opponent): Intelligence (+ `extra` dice) vs notice.baseTn with the obviousness row. */
export function noticeTest(o: { intelligence: number; obviousness?: string | readonly string[]; extra?: number }): { dice: number; tn: number; modifiers: TargetNumberModifier[] } {
  const n = C().notice;
  // v0.79.0: the book's sight rows, which stack (RULES.DOCS_V79.perceptionSightBook).
  const book = perceptionSightModifiers(o.obviousness);
  const first = typeof o.obviousness === 'string' ? o.obviousness : o.obviousness?.[0];
  const row = n.obviousness.find((r) => r.id === first) ?? n.obviousness.find((r) => r.id === 'normal');
  const modifiers = book ?? (row && row.value ? [{ label: tx('SR2E.Card.Mod.obviousness', { obvLabel: row.label }), value: row.value }] : []);
  return { dice: Math.max(0, Math.floor(num(o.intelligence)) + Math.floor(num(o.extra))), tn: n.baseTn, modifiers };
}

/** v0.58.0: what a plain Perception test's successes reveal ('Notices nothing.' for 0). */
export function noticeReveal(successes: number): string {
  return reveal(C().notice.reveals, successes, tx('SR2E.Text.Everyday.noticesNothing'));
}

// ---------------------------------------------------------------- Time ÷ successes

/** v0.58.0: base time ÷ successes, rounded up to time.roundTo of the unit; 0 successes means not done. */
export function timeTaken(base: number, unit: string, successes: number): { ok: boolean; value: number; unit: string; label: string; seconds: number } {
  const units = C().time.units;
  const u = units.find((x) => x.id === unit) ?? units.find((x) => x.id === 'hours') ?? { id: 'hours', label: 'hours', seconds: 3600 };
  const s = Math.floor(num(successes));
  const b = Math.max(0, num(base));
  if (s <= 0) return { ok: false, value: 0, unit: u.id, label: tx('SR2E.Card.Mod.notDoneNoSuccesses'), seconds: 0 };
  const step = num(C().time.roundTo);
  const raw = b / s;
  const value = step > 0 ? clean(Math.ceil(clean(raw / step)) * step) : clean(raw);
  return { ok: true, value, unit: u.id, label: tx('SR2E.Text.Everyday.timeTakenLabel', { value, unit: u.label, base: clean(b), successes: s }), seconds: clean(value * u.seconds) };
}

// ---------------------------------------------------------------- Build/Repair tools

/** Index of a tools level (unknown → 'none', i.e. 0). */
const toolIndex = (id: string): number => Math.max(0, C().tools.levels.findIndex((l) => l.id === id));
const toolLabel = (i: number): string => C().tools.levels[i]?.label ?? '';

/** v0.58.0: the TN modifier (or a block) for working with `have` tools on a job that needs `need`. */
export function toolsModifier(need: string, have: string): { blocked: boolean; modifier: TargetNumberModifier | null; note: string } {
  const t = C().tools;
  const n = toolIndex(need), h = toolIndex(have);
  if (h >= n) return { blocked: false, modifier: null, note: n ? tx('SR2E.Text.Everyday.isEnoughNeeds', { have: toolLabel(h), need: toolLabel(n) }) : tx('SR2E.Text.Everyday.noToolsNeeded') };
  if (h === 0) {
    if (t.none === 'block') return { blocked: true, modifier: null, note: tx('SR2E.Text.Everyday.cantBeDoneWithoutTools', { need: toolLabel(n) }) };
    return { blocked: false, modifier: { label: tx('SR2E.Card.Mod.noToolsNeeds', { toolLabel: toolLabel(n) }), value: t.noneTn }, note: tx('SR2E.Text.Everyday.noToolsTn', { tn: t.noneTn }) };
  }
  const value = (n - h) * t.perStepTn;
  return { blocked: false, modifier: { label: tx('SR2E.Card.Mod.toolsNeeds', { toolLabel: toolLabel(h), toolLabel2: toolLabel(n) }), value }, note: tCount(n - h, 'SR2E.Text.Everyday.levelsShortTn', { value }) };
}

/** v0.58.0: the best tools level among owned tools for this skill (blank skill = any), or 'none'. */
export function bestTools(owned: ReadonlyArray<{ level: string; skill?: string }>, skillName: string): string {
  const want = String(skillName ?? '').trim().toLowerCase();
  let best = 0;
  for (const o of owned) {
    const sk = String(o.skill ?? '').trim().toLowerCase();
    if (sk && sk !== want) continue;
    best = Math.max(best, toolIndex(o.level));
  }
  return C().tools.levels[best]?.id ?? 'none';
}

/** v0.58.0: how to repair a damaged weapon or piece of gear: skill (weapon skill + B/R), TN, base hours, tools needed. */
export function gearRepairPlan(o: { kind: 'weapon' | 'gear'; weaponSkill?: string }): { skill: string; fallbackAttribute: string; tn: number; baseHours: number; needs: string } {
  const g = C().tools.gearRepair;
  const ws = String(o.weaponSkill ?? '').trim();
  const skill = o.kind === 'weapon' && ws ? (ws.toLowerCase().endsWith(g.skillSuffix.toLowerCase()) ? ws : `${ws}${g.skillSuffix}`) : g.fallbackSkill;
  return { skill, fallbackAttribute: g.fallbackAttribute, tn: g.tn, baseHours: g.baseHours, needs: g.needs };
}

// ---------------------------------------------------------------- Creation costs

/** v0.58.0: one contact's creation cost by level (unknown levels: the nearest lower defined level; below 1 → 1). */
export function contactLevelCost(level: number): number {
  const table = C().creation.contactCost;
  const defined = Object.keys(table).map(Number).filter((k) => Number.isFinite(k)).sort((a, b) => a - b);
  if (!defined.length) return 0;
  const l = Math.max(1, Math.floor(num(level)));
  const at = [...defined].reverse().find((k) => k <= l) ?? defined[0]!;
  return Math.max(0, num(table[at]));
}

/**
 * v0.58.0: contacts paid from Resources. The first `freeContacts` slots each cover up to a Level 1 contact's price
 * (cheapest contacts first; a dearer contact in a free slot pays the difference); the rest pay in full.
 */
export function contactsCost(contacts: ReadonlyArray<{ level: number }>): { free: number; paid: number; cost: number } {
  const costs = contacts.map((c) => contactLevelCost(c.level));
  const free = Math.min(costs.length, Math.max(0, Math.floor(num(C().creation.freeContacts))));
  const cover = contactLevelCost(1);
  const all = costs.reduce((n, x) => n + x, 0);
  const asc = [...costs].sort((a, b) => a - b);
  const covered = asc.slice(0, free).reduce((n, x) => n + Math.min(x, cover), 0);
  const cost = Math.max(0, all - covered);
  return { free, paid: costs.length - free, cost };
}

/** v0.58.0: lifestyle months paid from Resources at creation (0 when months ≤ 0 or lifestyleMonthsPaid is off). */
export function lifestyleCost(lifestyleId: string, months: number): number {
  const m = Math.floor(num(months));
  if (m <= 0 || !C().creation.lifestyleMonthsPaid) return 0;
  return m * lifestyleOf(lifestyleId).cost;
}

// ---------------------------------------------------------------- Languages

/** v0.58.0: the native language's rating: Intelligence when nativeAtIntelligence, else 0. */
export function nativeLanguageRating(intelligence: number): number {
  // v0.80.0 (RULES.URR_V80.coreNativeBonus): Intelligence + 2 under the Revamp (+0 in the book).
  return C().languages.nativeAtIntelligence ? Math.max(0, Math.floor(num(intelligence))) + urrCoreNativeBonus() : 0;
}

/** v0.58.0: the Read/Write rating of a language: half rounded up ('half') or the same. */
export function readWriteRating(rating: number): number {
  const r = Math.max(0, Math.floor(num(rating)));
  return C().languages.readWrite === 'half' ? Math.ceil(r / 2) : r;
}

/** v0.58.0: what a language test's successes understand ('Understands nothing.' for 0). */
export function languageReveal(successes: number): string {
  return reveal(C().languages.reveals, successes, tx('SR2E.Text.Everyday.understandsNothing'));
}

/** v0.58.0: points of a native language that come free at creation: min(rating, native rating by Intelligence). */
export function freeLanguagePoints(intelligence: number, nativeRating: number): number {
  return Math.max(0, Math.min(Math.floor(num(nativeRating)), nativeLanguageRating(intelligence)));
}

// ---------------------------------------------------------------- Training

/** v0.58.0: days to train to a new rating: new rating × daysPerRating[kind] (unknown → active), at least minimumDays. */
export function trainingDays(o: { kind: string; newRating: number }): number {
  const t = C().training;
  const per = num(own(t.daysPerRating, o.kind) ?? t.daysPerRating['active']);
  return Math.max(t.minimumDays, Math.max(0, Math.floor(num(o.newRating))) * per);
}

/** v0.58.0: an instructor's Instruction test divides training days by successes (instructor rating must reach the new one). */
export function instructionResult(o: { days: number; successes: number; instructorRating: number; newRating: number }): { days: number; usable: boolean; note: string } {
  const min = C().training.minimumDays;
  const days = Math.max(0, num(o.days));
  const usable = num(o.instructorRating) >= num(o.newRating);
  if (!usable) return { days, usable, note: tx('SR2E.Text.Everyday.instructorRatingIsBelow', { instructorRating: num(o.instructorRating), newRating: num(o.newRating) }) };
  const s = Math.floor(num(o.successes));
  if (s <= 0) return { days, usable, note: tx('SR2E.Text.Everyday.noSuccessesTrainingTakes') };
  const d = Math.max(min, Math.ceil(days / s));
  return { days: d, usable, note: tCount(d, 'SR2E.Text.Everyday.daysDividedBySuccesses', { days, s }) };
}

/** v0.58.0: when training started at `startSeconds` (world time) finishes. */
export function trainingReadyAt(startSeconds: number, days: number): number {
  return num(startSeconds) + Math.max(0, num(days)) * 86400;
}

// ---------------------------------------------------------------- Pay negotiation

/** v0.58.0: a job's pay after negotiation: perNet per net success (runner's side), capped, to the nearest ¥10. */
export function negotiatedPay(base: number, net: number): { pay: number; change: number; percent: number } {
  const g = C().negotiation;
  const b = Math.max(0, num(base));
  const n = Math.floor(num(net));
  const frac = Math.sign(n) * Math.min(num(g.cap), num(g.perNet) * Math.abs(n));
  const pay = Math.max(0, Math.round((b * (1 + frac)) / 10) * 10);
  return { pay, change: pay - b, percent: clean(frac * 100) || 0 };
}

// ---------------------------------------------------------------- Karma award

/** v0.58.0: a Karma award: team values clamped 0..max, individual true = the row's value or a number clamped; lines per non-zero row. */
export function karmaAwardTotal(o: { team: Record<string, number>; individual: Record<string, boolean | number> }): { team: number; individual: number; total: number; lines: string[] } {
  const k = C().karmaAward;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.floor(num(v))));
  const lines: string[] = [];
  let team = 0, individual = 0;
  for (const r of k.team) {
    if (!(r.id in (o.team ?? {}))) continue;
    const v = clamp(o.team[r.id]!, r.max);
    if (v) { team += v; lines.push(`${r.label} +${v}`); }
  }
  for (const r of k.individual) {
    const x = (o.individual ?? {})[r.id];
    const v = x === true ? clamp(r.value, r.max) : typeof x === 'number' ? clamp(x, r.max) : 0;
    if (v) { individual += v; lines.push(`${r.label} +${v}`); }
  }
  return { team, individual, total: team + individual, lines };
}

// ---------------------------------------------------------------- Recognition

/** v0.58.0: the TN to recognise someone: recognition.baseTn − Public Awareness, at least the minimum TN. */
export function recognitionTn(publicAwareness: number): number {
  return Math.max(RULES.MIN_TARGET_NUMBER, C().recognition.baseTn - Math.max(0, Math.floor(num(publicAwareness))));
}

// ---------------------------------------------------------------- Reaction-linked skills

/** v0.58.0: natural Reaction: (Quickness + Intelligence) / 2, rounded down. */
export function naturalReaction(quickness: number, intelligence: number): number {
  return Math.floor((num(quickness) + num(intelligence)) / 2);
}

/** v0.58.0: the rating of a skill's linked attribute; 'reaction' returns the Reaction passed in. */
export function skillAttributeRating(key: string, attributes: Record<string, { total?: number; natural?: number } | undefined>, reaction: number, natural = false): number {
  if (key === 'reaction') return num(reaction);
  const a = attributes[key];
  return num(natural ? (a?.natural ?? a?.total) : a?.total);
}

const VEHICLE_SKILLS = new Set(['car', 'bike', 'hovercraft', 'motorboat', 'ship', 'fixed wing aircraft', 'rotor aircraft', 'rotorcraft', 'vectored thrust aircraft', 'lta aircraft', 'winged aircraft', 'submarine']);

/** v0.58.0: 'reaction' for vehicle skills (Car, Bike, … any "… Aircraft" or "Drone"), null otherwise and for B/R skills. */
export function vehicleSkillAttribute(name: string): 'reaction' | null {
  const n = String(name ?? '').trim().toLowerCase().replace(/[-\s]+/g, ' ');
  if (!n || n.endsWith(' b/r')) return null;
  return VEHICLE_SKILLS.has(n) || n.endsWith('aircraft') || n.includes('drone') ? 'reaction' : null;
}
