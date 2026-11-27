/**
 * v0.95.0 rules completeness, core mechanics and characters: pure functions over RULES.CORE_V95
 * (rules/config95/core.ts). Each behaves the book's way at the shipped value of its switch; at the other value the
 * caller falls back to the v0.94.2 code. No Foundry dependency. A refusal is a language key (`why`), never text.
 */
import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { t as tx } from '../helpers/i18n.ts';

const V = () => RULES.CORE_V95;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));
const K = 'SR2E.Core95.';

// ---------------------------------------------------------------- The Team Karma Pool (Core p. 191, p. 47)

/** The world's Team Karma Pool: the members (actor ids), the points, and the points used since the last refresh. */
export interface TeamPool { members: string[]; pool: number; spent: number }
export const TEAM_POOL_MAX = 999;
export const TEAM_MEMBERS_MAX = 50;

export const teamBook = (): boolean => V().teamKarma === 'book';

/** A stored value as a safe pool (anything odd reads as an empty pool). */
export function teamPoolOf(raw: unknown): TeamPool {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const members = Array.isArray(r.members) ? [...new Set(r.members.filter((m: unknown) => typeof m === 'string' && m.length > 0 && m.length <= 64) as string[])].slice(0, TEAM_MEMBERS_MAX) : [];
  const pool = Math.min(TEAM_POOL_MAX, whole(r.pool));
  return { members, pool, spent: Math.min(pool, whole(r.spent)) };
}

export const teamLeft = (t: TeamPool): number => Math.max(0, whole(t.pool) - whole(t.spent));

export interface TeamChange { ok: boolean; team: TeamPool; why?: string; own?: number; lost?: number }
const no = (team: TeamPool, why: string): TeamChange => ({ ok: false, team, why: `${K}Team.Why.${why}` });

/**
 * A character joins: `teamKarmaJoin` of their own unspent Karma Pool goes into the team pool for good (`own`: what
 * their pool loses). The first member founds the team: it starts with `teamKarmaStart` points more (Core p. 47).
 */
export function teamJoin(t: TeamPool, actorId: string, ownLeft: number): TeamChange {
  if (!actorId) return no(t, 'noActor');
  if (t.members.includes(actorId)) return no(t, 'already');
  if (t.members.length >= TEAM_MEMBERS_MAX) return no(t, 'full');
  const cost = whole(V().teamKarmaJoin);
  if (whole(ownLeft) < cost) return no(t, 'ownShort');
  const start = t.members.length === 0 && t.pool === 0 ? whole(V().teamKarmaStart) : 0;
  return { ok: true, own: cost, team: { members: [...t.members, actorId], pool: Math.min(TEAM_POOL_MAX, t.pool + cost + start), spent: t.spent } };
}

/** A member gives `n` of their own unspent Karma Pool to the team pool, for good. */
export function teamGive(t: TeamPool, actorId: string, n: number, ownLeft: number): TeamChange {
  const k = whole(n);
  if (!t.members.includes(actorId)) return no(t, 'notMember');
  if (k < 1) return no(t, 'badNumber');
  if (whole(ownLeft) < k) return no(t, 'ownShort');
  if (t.pool + k > TEAM_POOL_MAX) return no(t, 'full');
  return { ok: true, own: k, team: { ...t, pool: t.pool + k } };
}

/** A member draws `n` points: used until the refresh, or gone for good (`permanent`: a bought success). */
export function teamSpend(t: TeamPool, actorId: string, n: number, permanent = false): TeamChange {
  const k = whole(n);
  if (!t.members.includes(actorId)) return no(t, 'notMember');
  if (k < 1) return no(t, 'badNumber');
  if (teamLeft(t) < k) return no(t, 'teamShort');
  return { ok: true, team: permanent ? { ...t, pool: t.pool - k } : { ...t, spent: t.spent + k } };
}

/** The pool refreshes with the scene (as a character's own Karma Pool). */
export const teamRefresh = (t: TeamPool): TeamPool => ({ ...t, spent: 0 });

export type TeamLeaveMode = 'half' | 'share' | 'died';

/**
 * A member leaves. 'half': half of the points go (round down what is lost; Core p. 191). 'share': the pool ÷ the
 * members, round up (Companion pp. 89–90, optional). 'died': nothing is lost (Core p. 191).
 */
export function teamLeave(t: TeamPool, actorId: string, mode: TeamLeaveMode): TeamChange {
  if (!t.members.includes(actorId)) return no(t, 'notMember');
  const lost = mode === 'died' ? 0 : mode === 'share' ? Math.min(t.pool, Math.ceil(t.pool / Math.max(1, t.members.length))) : Math.floor(t.pool / 2);
  const pool = t.pool - lost;
  return { ok: true, lost, team: { members: t.members.filter((m) => m !== actorId), pool, spent: Math.min(pool, t.spent) } };
}

/** The GM's correction: the points up or down (never below what is used, never above the cap). */
export function teamAdjust(t: TeamPool, delta: number): TeamChange {
  const d = Math.trunc(num(delta));
  const pool = t.pool + d;
  if (!d || pool < 0 || pool > TEAM_POOL_MAX) return no(t, 'badNumber');
  return { ok: true, team: { ...t, pool, spent: Math.min(pool, t.spent) } };
}

/**
 * Where a Karma spend of `points` may come from: the character's own pool, the team pool, both (ask), or neither.
 * `member`: the character is on the team's list.
 */
export function karmaSources(o: { points: number; ownLeft: number; team: TeamPool; member: boolean }): 'own' | 'team' | 'ask' | 'none' {
  const p = Math.max(1, whole(o.points));
  const own = whole(o.ownLeft) >= p;
  const team = teamBook() && o.member && teamLeft(o.team) >= p;
  return own && team ? 'ask' : team ? 'team' : own ? 'own' : 'none';
}

// ---------------------------------------------------------------- Racism and Charisma (Core p. 182)

export const racismBook = (): boolean => V().racism === 'book';

/** The Racism Table (Core p. 182): a D6 of 1 is everyone but the NPC's own metatype. */
export const RACISM_TABLE: readonly string[] = ['all', 'human', 'elf', 'dwarf', 'ork', 'troll'];

/** An NPC's racism as stored on the actor (flag `racism95`). */
export interface Racism { points: number; all: boolean; against: string[]; own: string; at: number }

/** Racism Points from the 2D6 roll: the total − 6, never below 0. */
export const racismPoints = (twoD6: number): number => Math.max(0, Math.floor(num(twoD6)) - 6);

/**
 * Whom the bias is against, from D6 rolls in order: a 1 is all but the NPC's own metatype; the NPC's own metatype is
 * ignored; rolling stops at two biases (the same one twice is one). `used`: how many rolls it took; `done`: false
 * when the rolls ran out first.
 */
export function racismBias(rolls: readonly number[], own: string): { all: boolean; against: string[]; used: number; done: boolean } {
  const against: string[] = [];
  let hits = 0, used = 0;
  for (const r of rolls) {
    used++;
    const who = RACISM_TABLE[Math.floor(num(r)) - 1];
    if (!who) continue;
    if (who === 'all') return { all: true, against: [], used, done: true };
    if (who === String(own ?? '').toLowerCase()) continue;
    hits++;
    if (!against.includes(who)) against.push(who);
    if (hits >= 2) return { all: false, against, used, done: true };
  }
  return { all: false, against, used, done: false };
}

/** A stored racism flag, checked (null when there is none). */
export function racismOf(raw: unknown): Racism | null {
  const r: any = raw && typeof raw === 'object' ? raw : null;
  if (!r) return null;
  const against = Array.isArray(r.against) ? r.against.filter((x: unknown) => typeof x === 'string' && RACISM_TABLE.includes(x) && x !== 'all').slice(0, 5) as string[] : [];
  return { points: Math.min(6, whole(r.points)), all: Boolean(r.all), against, own: String(r.own ?? '').toLowerCase().slice(0, 32), at: num(r.at) };
}

/** The points an NPC's racism holds against a speaker of `metatype` (0 when none). */
export function racismVs(r: Racism | null, metatype: unknown): number {
  const m = String(metatype ?? '').toLowerCase();
  if (!r || !r.points || !m) return 0;
  if (r.all) return m === r.own ? 0 : r.points;
  return r.against.includes(m) ? r.points : 0;
}

/** The secret Charisma test's target number: twice the points. */
export const racismCharismaTn = (points: number): number => Math.max(RULES.MIN_TARGET_NUMBER, 2 * whole(points));

/** What is left of the points after the Charisma test's successes. */
export const racismAfter = (points: number, successes: number): number => Math.max(0, whole(points) - whole(successes));

// ---------------------------------------------------------------- Training (Companion pp. 50, 52, 53)

/** Whether the book's training tests run (the Revamp's own training wins). */
export const trainingBook = (): boolean => V().trainingTest === 'book' && (RULES as any).URR_V80?.coreTraining !== 'urr';

/** The student's test: an attribute against the new rating, a new skill against 4, a skill against the new rating + 2. */
export function trainingSelfTn(o: { attribute?: boolean; to: number }): number {
  const to = whole(o.to);
  return Math.max(RULES.MIN_TARGET_NUMBER, o.attribute ? to : to <= 1 ? 4 : to + 2);
}

/** Successes an instructor's test adds to the student's (one per `instructorPerSuccess`). */
export const instructorHelp = (successes: number): number => Math.floor(whole(successes) / Math.max(1, whole(V().instructorPerSuccess)));

/**
 * The training days: the base ÷ (the student's successes + the instructor's help), round up; a student's test with no
 * successes and no help: the base × `trainingFailFactor`; no test rolled yet and no help: the base.
 */
export function trainingDays95(o: { baseDays: number; self: number | null; help: number }): number {
  const base = Math.max(0, num(o.baseDays));
  const min = num((RULES as any).CHARACTERS_V58?.training?.minimumDays, 1);
  const total = whole(o.self ?? 0) + whole(o.help);
  if (total > 0) return Math.max(min, Math.ceil(base / total));
  return o.self === null ? base : Math.ceil(base * Math.max(1, num(V().trainingFailFactor, 1.5)));
}

/** The Suggested Instructor Fees Table (Companion p. 52): nuyen a day by Instruction rating. */
export function instructorFee(instruction: number): number {
  const r = whole(instruction);
  const table = [0, 40, 50, 75, 100, 200, 400];
  return r <= 6 ? table[r]! : 400 + 100 * (r - 6);
}

/** A training's stored test results (flag `training95.<id>`). */
export function trainingMarkOf(raw: unknown): { self: number | null; help: number } {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  return { self: r.self === null || r.self === undefined ? null : Math.min(99, whole(r.self)), help: Math.min(99, whole(r.help)) };
}

// ---------------------------------------------------------------- Jumping and swimming (Fields of Fire pp. 76–77, Cyberpirates)

const urrAthletics = (): boolean => (RULES as any).URR_V80?.hsAthletics === 'urr';
export const jumpBook = (): boolean => V().jumping === 'book' && !urrAthletics();
export const swimBook = (): boolean => V().swimming === 'book' && !urrAthletics();

/**
 * Metres a jump covers without a test: half Strength (round down) less natural Body, plus Quickness with a run-up, at
 * least 1; a vertical jump a quarter of that.
 */
export function jumpBase(o: { strength: number; bodyNatural: number; quickness: number; running?: boolean; vertical?: boolean }): number {
  const flat = Math.max(1, Math.floor(whole(o.strength) / 2) - whole(o.bodyNatural) + (o.running ? whole(o.quickness) : 0));
  return o.vertical ? Math.floor(flat * 25) / 100 : flat;
}

/** The jumping test's target number: the metres to clear (round up), +1 when Strength is below Body. */
export function jumpTn(metres: number, strength: number, body: number): number {
  return Math.max(RULES.MIN_TARGET_NUMBER, Math.ceil(Math.max(0, num(metres)))) + (whole(strength) < whole(body) ? 1 : 0);
}

/** The distance with the test's successes: +10 percent each, rounded down to a tenth of a metre. */
export const jumpDistance = (base: number, successes: number): number => Math.floor(Math.max(0, num(base)) * (10 + whole(successes)) + 1e-9) / 10;

export type SwimMode = 'swim' | 'tread' | 'float';

/** A water test's target number and the table's modifiers: swimming, treading water or floating. */
export function waterTest(mode: SwimMode, metatype: unknown, checked: readonly string[] = []): { tn: number; modifiers: TargetNumberModifier[] } {
  if (mode === 'swim') return { tn: whole(V().swimTn), modifiers: [] };
  const rows = V().treadModifiers.filter((r) => checked.includes(r.id)).map((r) => ({ id: `tread95:${r.id}`, label: r.label, value: r.value }));
  const m = String(metatype ?? '').toLowerCase();
  const meta = num(V().treadMetatype[m]);
  return { tn: whole(mode === 'tread' ? V().treadTn : V().floatTn), modifiers: [...rows, ...(meta ? [{ id: 'tread95:metatype', label: tx('SR2E.Card.Mod.athleticsMetatype'), value: meta }] : [])] };
}

/** Combat Turns a floating character stays afloat: Body × successes. */
export const floatTurns = (body: number, successes: number): number => whole(body) * whole(successes);

// ---------------------------------------------------------------- Lifestyle (Core p. 190)

export const missedBook = (): boolean => V().missedPayments === 'book';
export const sellBook = (): boolean => V().sellLifestyle === 'book';

/** Payments missed in a row, from the days overdue: the first on the first day late, one more each month after. */
export function monthsMissed(daysLate: number, monthDays: number): number {
  const d = Math.ceil(num(daysLate));
  return d > 0 ? Math.floor((d - 1) / Math.max(1, whole(monthDays) || 30)) + 1 : 0;
}

/** The missed-payment roll: a die above the months missed is absorbed; otherwise the lifestyle drops. */
export const missedAbsorbed = (die: number, months: number): boolean => whole(die) > whole(months);

/** The state kept between ticks (flag `lifestyle95`): the unpaid date, months rolled for it, months carried from before a drop. */
export function missedMarkOf(raw: unknown, key: number): { rolled: number; carried: number } {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  return num(r.key, NaN) === key ? { rolled: whole(r.rolled), carried: whole(r.carried) } : { rolled: 0, carried: 0 };
}

/** Whether a lifestyle owned outright can be sold (Middle or better, by the lifestyles' order). */
export function canSellLifestyle(level: string, order: readonly string[]): boolean {
  if (!sellBook()) return false;
  const from = order.indexOf(String(V().sellLifestyleFrom));
  const at = order.indexOf(String(level));
  return from >= 0 && at >= from;
}

/** What a sold lifestyle brings: the dice total × 10 percent of its price. */
export const lifestyleSale = (price: number, diceTotal: number): number => Math.round(Math.max(0, num(price)) * whole(diceTotal) / 10);

// ---------------------------------------------------------------- Contacts (Core p. 200; Companion p. 62)

export const feeBook = (): boolean => V().contactFee === 'book';
export const meetBook = (): boolean => V().contactMeet === 'book';
export const upkeepBook = (): boolean => V().contactUpkeep === 'book';

/** A contact's fee for information: Etiquette × successes × (Charisma + Intelligence) × 10 nuyen. */
export function contactFee(o: { etiquette: number; successes: number; charisma: number; intelligence: number }): number {
  return Math.min(10_000_000, whole(o.etiquette) * whole(o.successes) * (whole(o.charisma) + whole(o.intelligence)) * 10);
}

/** The base time to arrange a meet, in minutes: 2D6 × 30. */
export const meetBaseMinutes = (twoD6: number): number => whole(twoD6) * 30;

/** The time after trading Etiquette successes (the base ÷ the successes traded, round up; none traded: the base). */
export function meetMinutes(base: number, traded: number): number {
  const b = whole(base), t = whole(traded);
  return t > 1 ? Math.max(1, Math.ceil(b / t)) : b;
}

/** A contact's yearly upkeep by level. */
export const contactUpkeepCost = (level: number): number => whole((V().contactUpkeepCost as Record<number, number>)[Math.max(1, Math.min(3, whole(level) || 1))]);

export const YEAR_SECONDS = 365 * 86400;

/**
 * Contact upkeep falling due. `marks`: contact id → the world time its next payment is due. A contact without a mark
 * gets one a year from now (nothing is due yet); one whose time has come is `due`.
 */
export function upkeepDue(contacts: ReadonlyArray<{ id: string; level?: number }>, marks: Record<string, unknown> | null | undefined, now: number): { marks: Record<string, number>; due: string[]; changed: boolean } {
  const out: Record<string, number> = {};
  const due: string[] = [];
  let changed = false;
  for (const c of contacts) {
    if (!c?.id) continue;
    const at = num((marks ?? {})[c.id], NaN);
    if (!Number.isFinite(at)) { out[c.id] = num(now) + YEAR_SECONDS; changed = true; continue; }
    out[c.id] = at;
    if (num(now) >= at) due.push(c.id);
  }
  if (Object.keys(marks ?? {}).some((k) => !(k in out))) changed = true;
  return { marks: out, due, changed };
}

// ---------------------------------------------------------------- Groups (Core p. 185, p. 180)

export const groupPerceptionOn = (): boolean => V().groupPerception === 'book';
export const groupAverageOn = (): boolean => V().groupAverage === 'book';

/** A list's average, rounded to the nearest whole number (0 for an empty list). */
export function average(values: readonly number[]): number {
  const v = values.map((x) => num(x)).filter((x) => Number.isFinite(x));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
}

/** A group Perception test's dice: the average Intelligence plus one per member. */
export const groupPerceptionDice = (intelligences: readonly number[]): number => (intelligences.length ? average(intelligences) + intelligences.length : 0);
