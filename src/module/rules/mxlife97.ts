/**
 * v0.97.0 rules completeness, the decker's life outside a fight (Virtual Realities 2.0): pure functions over
 * RULES.MXLIFE_V97 (rules/config97/mxlife.ts). Each behaves the book's way at the shipped value of its switch; at the
 * other value ('v965') the caller keeps the v0.96.5 code. No Foundry dependency. A refusal is a language key, never
 * text.
 */
import { RULES } from './config.ts';
import { PSYCHE_UNTIL_RECOVERED, psychotropicBook } from './matrix923.ts';
import { programPlan } from './remnants.ts';

const V = () => RULES.MXLIFE_V97;
const num = (v: unknown, d = 0) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));
const DAY = 86400;
const WHY = 'SR2E.MxLife97.Why.';

export type MxLife97Switch = Exclude<keyof typeof RULES.MXLIFE_V97, 'icToken'>;
/** Whether a switch is at the book's way. */
export const on = (key: MxLife97Switch): boolean => (V() as any)[key] === 'book';
/** Whether launched IC gets a token on the GM's viewed Matrix scene. */
export const icTokenOn = (): boolean => V().icToken === 'scene';

// ---------------------------------------------------------------- Recovering from psychotropic effects (VR2 p. 50)

export type Care97 = 'none' | 'medication' | 'therapy';
export const CARES_97: readonly Care97[] = ['none', 'medication', 'therapy'];

/** A psychotropic effect that recovers by tests: the book's "until recovered" effect (MATRIX_V923.psychotropic). */
export function recovers(e: { until?: unknown; [k: string]: unknown } | null | undefined): boolean {
  return on('psychRecovery') && psychotropicBook() && num(e?.until, -1) === PSYCHE_UNTIL_RECOVERED;
}

/** Days between recovery tests (VR2 p. 50): daily for Matrix maniac (frenzy here), weekly for the rest. */
export function recoveryPeriodDays(kind: string): number {
  return kind === 'frenzy' ? 1 : 7;
}

/** The schedule key of an effect (plain characters only: no dots, which Foundry nests in flag keys). */
export function psycheKey(e: { kind?: unknown; icName?: unknown; rating?: unknown }): string {
  const safe = (v: unknown) => String(v ?? '').replace(/[^A-Za-z0-9 _#-]/g, '_').slice(0, 120);
  return `${safe(e?.kind)}|${safe(e?.icName)}|${whole(e?.rating)}`;
}

/**
 * Where an effect's recovery stands at `now`: tests due since `next` (each period that has passed is one test,
 * at most 52), and the time the next one falls due. A new effect starts its clock now.
 */
export function recoveryDue(kind: string, next: number | null | undefined, now: number): { due: number; next: number } {
  const period = recoveryPeriodDays(kind) * DAY;
  const n = num(next, NaN);
  if (!Number.isFinite(n) || n > now + period) return { due: 0, next: now + period };
  if (now < n) return { due: 0, next: n };
  const due = Math.min(52, Math.floor((now - n) / period) + 1);
  return { due, next: n + due * period };
}

/**
 * The recovery test's TN (VR2 p. 50): the IC's rating, −1 medication or magical treatment, −2 intensive psychotherapy
 * (not cumulative), a further −1 for a sustained spell, +1 for positive conditioning; never below 2.
 */
export function recoveryTn(o: { rating: number; kind: string; care: Care97; spell?: boolean }): number {
  const care = o.care === 'therapy' ? -2 : o.care === 'medication' ? -1 : 0;
  const tn = whole(o.rating) + care + (o.spell ? -1 : 0) + (o.kind === 'conditioning' ? 1 : 0);
  return Math.max(RULES.MIN_TARGET_NUMBER, tn);
}

/**
 * Why a recovery can't begin (a language key), or '' (VR2 p. 49): cyberphobia only once medicated or under magical
 * treatment; the Judas effect only once the companions have found it out and stop the decker.
 */
export function recoveryBlocked(o: { kind: string; care: Care97; spell?: boolean; caught?: boolean }): string {
  if (o.kind === 'cyberphobia' && o.care === 'none' && !o.spell) return `${WHY}phobiaUntreated`;
  if (o.kind === 'judas' && !o.caught) return `${WHY}judasUncaught`;
  return '';
}

// ---------------------------------------------------------------- Paydata going stale (VR2 p. 65)

/** Whether a deck file is one of the random method's Paydata Points (the GM's story files are left alone). */
export function isPaydataPoint(f: { paydata?: unknown; value?: unknown } | null | undefined): boolean {
  if (!f || !f.paydata || RULES.MATRIX_V923.paydata === 'v922') return false;
  const point = whole(RULES.MATRIX_V923.paydataPoint);
  return point > 0 && whole(f.value) === point;
}

/**
 * The stock's day clock (VR2 p. 65): with `points` unsold since `since`, how many go stale at `now` (one a full day,
 * at most the stock) and the clock after. No points: no clock. A missing or future start begins it now.
 */
export function paydataStale(points: number, since: number | null | undefined, now: number): { lost: number; since: number | null } {
  if (!on('paydataDecay') || whole(points) <= 0) return { lost: 0, since: null };
  const s = num(since, NaN);
  if (!Number.isFinite(s) || s > now) return { lost: 0, since: now };
  const days = Math.floor((now - s) / DAY);
  const lost = Math.min(whole(points), days);
  return { lost, since: lost >= whole(points) ? null : s + days * DAY };
}

// ---------------------------------------------------------------- Cook and Installation tasks (VR2 pp. 82–88)

export interface DeckTask97 { base: number; tn: number }

/**
 * A deck part's Cook and Installation tasks (VR2 pp. 82–88): base days and TN of each. `rating` is the part's rating
 * (for active and storage memory the Mp, for I/O speed the Mp per turn, as the deck-building code has it); `mpcp`
 * the deck's MPCP. A part with no Cook Task has `cook` null. Null under 'v965' or for a part the book doesn't cover.
 */
export function deckTasks(part: string, rating: number, mpcp: number): { cook: DeckTask97 | null; install: DeckTask97 } | null {
  if (!on('cookInstall')) return null;
  const r = Math.max(1, whole(rating));
  const m = Math.max(1, whole(mpcp));
  const t = (base: number, tn: number): DeckTask97 => ({ base: Math.max(1, Math.ceil(base)), tn: Math.max(RULES.MIN_TARGET_NUMBER, Math.ceil(tn)) });
  switch (part) {
    case 'mpcp': return { cook: t(r * 3, r), install: t(r * 2, r) };
    case 'bod': case 'evasion': case 'masking': case 'sensors': return { cook: t(r * 3, r), install: t(r * 2, r) };
    case 'hardening': return { cook: t(m * r, m), install: t(m * r * 2, m) };
    case 'responseIncrease': return { cook: t(m * r, r * 2), install: t(m + r, r * 2) };
    case 'activeMemory': case 'storageMemory': return { cook: null, install: t(r / 100, r / 100) };
    case 'ioSpeed': return { cook: null, install: t(r / 20, r / 100) };
    default: return null;
  }
}

/**
 * One task carried out (VR2 p. 77): each attempt's successes (`attempts`, in order) divide the base time; a failed
 * attempt wastes base ÷ 2D6 days (round up; `wasteRolls` its 2D6 totals, in order) and the task starts again. Days in
 * all, and whether it got done.
 */
export function taskDays(base: number, attempts: readonly number[], wasteRolls: readonly number[]): { days: number; done: boolean; tries: number } {
  const b = Math.max(1, whole(base));
  let days = 0;
  let w = 0;
  for (const [i, s] of attempts.entries()) {
    if (whole(s) > 0) return { days: days + Math.max(1, Math.ceil(b / whole(s))), done: true, tries: i + 1 };
    days += Math.ceil(b / Math.max(2, whole(wasteRolls[w++] ?? 7)));
  }
  return { days, done: false, tries: attempts.length };
}

/** How many times a task is tried before the card gives up (the dice can't do it). */
export const TASK_TRIES_97 = 10;

/** A deck task's TN with the builder's defaulting modifiers (`tnMod`), never below 2. */
export function taskTn(t: DeckTask97, tnMod: number): number {
  return Math.max(RULES.MIN_TARGET_NUMBER, t.tn + Math.floor(num(tnMod)));
}

// ---------------------------------------------------------------- Otaku (VR2 pp. 144–145; otaku errata)

/** The operational utilities (VR2 pp. 96–99): channel specializations, never complex forms (otaku errata entry 6). */
export const OPERATIONAL_97: readonly string[] = ['analyze', 'browse', 'commlink', 'crash', 'defuse', 'deception', 'decrypt', 'evaluate', 'mirrors', ['read', 'write'].join('/'), 'relocate', 'scanner', 'spoof', 'validate'];

/** Whether a channel's rating may go above the living persona's MPCP (book: a skill, no such cap). */
export function channelCapped(): boolean {
  return !on('otakuChannels') && RULES.MATRIX.otaku.channels.maxFromMpcp;
}

/**
 * Why an otaku can't make this complex form (a language key), '' when they can, or null under 'v965' (the caller's
 * MPCP cap). Book (VR2 p. 145; errata entries 5, 6): rating at most the Computer Skill; not an operational utility;
 * no Hardening form.
 */
export function complexFormRefusal(kind: string, rating: number, computer: number, willpower = 0): string | null {
  if (!on('complexForms')) return null;
  const k = kindRefusal(kind);
  if (k) return k;
  if (whole(rating) > whole(computer)) return `${WHY}formAboveComputer`;
  // VR2 p. 145: the living persona already has Armor = Willpower; an Armor form must be above it.
  if (kind === 'armor' && whole(rating) <= whole(willpower)) return `${WHY}formArmorBelow`;
  return '';
}

/** Why a kind can never be a complex form (book): an operational utility or Hardening; '' otherwise. */
export function kindRefusal(kind: string): string {
  if (OPERATIONAL_97.includes(kind)) return `${WHY}formOperational`;
  if (kind === 'hardening') return `${WHY}formHardening`;
  return '';
}

/** The otaku task bonus (VR2 p. 145): (Intelligence + Charisma) ÷ 4, round up. */
export function otakuTaskBonus(intelligence: number, charisma: number): number {
  return Math.ceil((whole(intelligence) + whole(charisma)) / 4);
}

/**
 * A complex form's task (VR2 pp. 77, 145): its size and base days as a program of that kind and rating (no options),
 * the Computer test's TN, and with `successes` the days of work: the task period (base ÷ successes, round up) cut by
 * the task bonus (a day's work does 1 + bonus days of the period). 0 successes: the days wasted (base ÷ 2D6 roll).
 */
export function complexFormTask(o: { kind: string; rating: number; bonus: number; successes: number; waste2d6?: number }): { size: number; base: number; tn: number; days: number; done: boolean } {
  const plan = programPlan({ kind: o.kind, rating: Math.max(1, whole(o.rating)) });
  const base = Math.max(1, plan.baseDays);
  const s = whole(o.successes);
  // VR2 p. 77: task bonuses apply to the days a flawed design wastes too.
  if (s <= 0) return { size: plan.size, base, tn: plan.tn, days: Math.max(1, Math.ceil(Math.ceil(base / Math.max(2, whole(o.waste2d6 ?? 7))) / (1 + whole(o.bonus)))), done: false };
  const period = Math.ceil(base / s);
  return { size: plan.size, base, tn: plan.tn, days: Math.max(1, Math.ceil(period / (1 + whole(o.bonus)))), done: true };
}

/**
 * The living persona's Armor (VR2 p. 145): Willpower, unless a loaded Armor (utility or complex form) rates higher (an equal one doesn't count).
 * Returns the rating that should count and whether it is the free one; null under 'v965' or for a deck.
 */
export function livingArmor(o: { living: boolean; willpower: number; loaded: number }): { rating: number; free: boolean } | null {
  if (!on('otakuArmor') || !o.living) return null;
  const w = whole(o.willpower);
  const l = whole(o.loaded);
  // Only a loaded Armor ABOVE Willpower replaces the free one (VR2 p. 145); an equal one leaves the free Armor (no wear).
  return l > w ? { rating: l, free: false } : { rating: w, free: true };
}

// ---------------------------------------------------------------- IC on the Matrix scene (a table convenience)

/** Where the `i`-th IC goes beside a host token at (x, y) on a `grid` px grid: rows of 4 to its right. */
export function icSpot(x: number, y: number, grid: number, i: number): { x: number; y: number } {
  const g = Math.max(1, num(grid, 100));
  const k = whole(i);
  return { x: num(x) + g * (1 + (k % 4)), y: num(y) + g * Math.floor(k / 4) };
}
