import { RULES } from './config.ts';
import { docsSkillCost } from './docs79-social-core.ts';
import { urrCoreKarmaAward, urrCoreSkillCost } from './urr80-core.ts';
import { t as tx } from '../helpers/i18n.ts';

/** Upkeep (v0.33.0): lifestyle, Karma, contacts and buying gear. Values in RULES.UPKEEP (VERIFY). */

export const DAY_SECONDS = 86400;

export function lifestyleOf(id: string): { id: string; label: string; cost: number } {
  return RULES.UPKEEP.lifestyles.find((l) => l.id === id) ?? RULES.UPKEEP.lifestyles[0]!;
}

/** Paying `months` of a lifestyle: the cost and the new "paid until" (from now, or from the old date if later). */
export function payLifestyle(o: { lifestyle: string; months: number; paidUntil: number; now: number }): { cost: number; paidUntil: number } {
  const months = Math.max(0, Math.floor(o.months) || 0);
  const from = Math.max(o.now, o.paidUntil);
  return { cost: lifestyleOf(o.lifestyle).cost * months, paidUntil: from + months * RULES.UPKEEP.monthDays * DAY_SECONDS };
}

/** Days of lifestyle left (positive) or overdue (negative); null when never paid. */
export function lifestyleDays(paidUntil: number, now: number): number | null {
  if (!(paidUntil >= 0)) return null;
  const d = (paidUntil - now) / DAY_SECONDS;
  return d >= 0 ? Math.floor(d) : -Math.ceil(-d);
}

/** Karma earned: how much goes to Good Karma and how much to the Karma Pool. */
export function karmaAward(o: { careerBefore: number; amount: number; metahuman: boolean }): { good: number; pool: number; career: number } {
  // v0.80.0 (RULES.URR_V80.coreKarmaGrowth 'perAward'): each award's first point to the pool, the next 10 to Good Karma.
  const urr = urrCoreKarmaAward(o);
  if (urr) return urr;
  const amount = Math.max(0, Math.floor(o.amount) || 0);
  const k = RULES.UPKEEP.karma;
  const every = Math.max(1, o.metahuman ? k.poolEvery.metahuman : k.poolEvery.human);
  const before = Math.max(0, o.careerBefore || 0);
  const career = before + amount;
  const pool = Math.floor(career / every) - Math.floor(before / every);
  return { good: k.diverts ? amount - Math.min(pool, amount) : amount, pool, career };
}

/** Karma to raise an attribute to `to` (refused above the natural maximum). */
export function attributeCost(o: { to: number; max: number }): { cost: number; ok: boolean; reason: string } {
  if (o.to > o.max) return { cost: 0, ok: false, reason: tx('SR2E.Text.Upkeep.aboveTheNaturalMaximum', { max: o.max }) };
  return { cost: Math.ceil(o.to * RULES.UPKEEP.karma.attributeMultiplier), ok: true, reason: '' };
}

/**
 * Karma to raise a skill (or its specialization) to `to`, by its kind and linked attribute. v0.79.0
 * (RULES.DOCS_V79.skillKarma 'flat'): an active or B/R skill costs new rating × 2, a concentration × 1.5, a
 * specialization × 1, with no attribute bands (the Karma cost table, "Good Karma Cost for
 * Skills"); knowledge and language skills, and 'bands', keep the bands below.
 */
export function skillCost(o: { to: number; attribute: number; kind: 'active' | 'knowledge' | 'language' | 'buildRepair'; specialization?: boolean; concentration?: boolean }): number {
  // v0.80.0 (RULES.URR_V80.coreLanguageKarma): a language at new rating × 1 (null in the book).
  const urr = urrCoreSkillCost(o);
  if (urr != null) return urr;
  const flat = docsSkillCost(o);
  if (flat != null) return flat;
  const k = RULES.UPKEEP.karma;
  const bands = k.skills[o.kind === 'active' || o.kind === 'buildRepair' ? 'active' : 'knowledge'];
  const attr = Math.max(1, o.attribute || 1);
  const band = bands.find((b) => o.to <= b.upTo * attr) ?? bands[bands.length - 1]!;
  const base = o.to * band.multiplier;
  return Math.ceil(o.specialization ? base * k.specializationFraction : o.concentration ? base * RULES.SKILLS.concentrationFraction : base);
}

/** Legwork through a contact: the TN and what the successes buy. */
export function legworkTarget(o: { difficultyTn: number; contactLevel: number }): number {
  const c = RULES.UPKEEP.contacts;
  // v0.78.0 (RULES.BOOK_V78.legwork 'book'): a closer contact adds dice (legworkLevelDice), not a lower TN.
  if (RULES.BOOK_V78.legwork.mode === 'book') return Math.max(c.minTn, o.difficultyTn);
  return Math.max(c.minTn, o.difficultyTn - Math.max(0, (o.contactLevel || 1) - 1) * c.tnPerLevel);
}
/** v0.78.0: the legwork difficulty list for the current rule (the book's table, or the old one). */
export function legworkDifficulties(): ReadonlyArray<{ id: string; label: string; tn: number }> {
  return RULES.BOOK_V78.legwork.mode === 'book' ? RULES.BOOK_V78.legwork.difficulties : RULES.UPKEEP.contacts.difficulties;
}
/** v0.78.0: extra legwork dice from a closer contact (book rule; 0 under the old TN rule). */
export function legworkLevelDice(contactLevel: number): number {
  const L = RULES.BOOK_V78.legwork;
  if (L.mode !== 'book') return 0;
  const i = Math.max(1, Math.floor(contactLevel || 1)) - 1;
  return Math.max(0, L.levelDice[Math.min(L.levelDice.length - 1, i)] ?? 0);
}
/** v0.78.0: the book's legwork TN modifiers (the contact's specialty, a fixer or Mr. Johnson, a friend of a friend). */
export function legworkModifiers(o: { specialty?: boolean; fixer?: boolean; friendOfFriend?: boolean }): Array<{ id?: string; label: string; value: number }> {
  const L = RULES.BOOK_V78.legwork;
  if (L.mode !== 'book') return [];
  const out: Array<{ id?: string; label: string; value: number }> = [];
  if (o.specialty) out.push({ id: 'contactSSpecialty', label: tx('SR2E.Card.Mod.contactSSpecialty'), value: L.specialtyTn });
  if (o.fixer) out.push({ id: 'fixerOrMrJohnson', label: tx('SR2E.Card.Mod.fixerOrMrJohnson'), value: L.fixerTn });
  if (o.friendOfFriend) out.push({ id: 'friendOfAFriend', label: tx('SR2E.Card.Mod.friendOfAFriend'), value: L.friendOfFriendTn });
  return out;
}
export function legworkTier(successes: number): string {
  const t = RULES.UPKEEP.contacts.tiers;
  return t[Math.min(t.length - 1, Math.max(0, successes))]!;
}

/** v0.81.1 (RC2-6): the time units Availability understands, as hours per unit. */
function availabilityUnitHours(u: string): number | null {
  if (/^(?:min|mins|minute|minutes)$/.test(u)) return 1 / 60;
  if (/^(?:s|sec|secs|second|seconds)$/.test(u)) return 1 / 3600;
  if (/^(?:h|hr|hrs|hour|hours)$/.test(u)) return 1;
  if (/^(?:d|day|days)$/.test(u)) return 24;
  if (/^(?:w|wk|wks|week|weeks)$/.test(u)) return 168;
  if (/^(?:m|mo|mos|month|months)$/.test(u)) return 24 * RULES.UPKEEP.monthDays;
  if (/^(?:y|yr|yrs|year|years)$/.test(u)) return 24 * RULES.GM_TOOLS.yearDays;
  return null;
}

/**
 * "6/14 days", "4/48 hrs", "8/1 wk", "4/30 min", "8/1 year", "4/1-2 weeks", "Always": the TN and base time in hours
 * (TN 0 = always available). A range takes its upper end. v0.81.1 (RC2-6): a time whose unit isn't known ("4/30 fortnights",
 * "6/1.5.2 days") gives the default time and `unknownUnit`, not that many hours.
 */
export function parseAvailability(text: string): { tn: number; hours: number; unknownUnit?: true } {
  const s = String(text ?? '').trim().toLowerCase();
  // v0.81.1 round 2 (V-REST 7): a range may use an en or em dash ("8/2–3 days") as well as a hyphen.
  const m = /^(\d+)\s*(?:\/\s*(\d+(?:\.\d+)?)(?:\s*[-\u2013\u2014]\s*(\d+(?:\.\d+)?))?(.*))?/s.exec(s);
  if (!m) return { tn: 0, hours: 0 };
  const tn = Number(m[1]);
  if (m[2] === undefined) return { tn, hours: RULES.UPKEEP.availability.defaultHours };
  const n = Number(m[3] ?? m[2]);
  const rest = (m[4] ?? '').trim();
  const word = /^([a-z]+)\b/.exec(rest)?.[1];
  // No unit at all (and nothing after the number) is hours, as before.
  const per = word ? availabilityUnitHours(word) : rest === '' || /^[^a-z0-9.]/.test(rest) ? 1 : null;
  if (per === null) return { tn, hours: RULES.UPKEEP.availability.defaultHours, unknownUnit: true };
  return { tn, hours: n * per };
}

/** How long finding it took: base / successes (null = not found this time). */
export function findTime(hours: number, successes: number): number | null {
  return successes > 0 ? Math.max(0, hours) / successes : null;
}

/** Price of an item: cost x Street Index x quantity, rounded. */
export function itemPrice(o: { cost: number; streetIndex: number; quantity: number }): number {
  return Math.round(Math.max(0, o.cost) * (o.streetIndex > 0 ? o.streetIndex : 1) * Math.max(1, o.quantity || 1));
}

/** Hours as words: "36 hours", "2.5 days". */
export function hoursLabel(h: number): string {
  if (h < 48) return `${Math.round(h * 10) / 10} hour${h === 1 ? '' : 's'}`;
  const d = Math.round((h / 24) * 10) / 10;
  return `${d} days`;
}
