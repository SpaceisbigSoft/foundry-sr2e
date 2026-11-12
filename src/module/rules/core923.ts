/**
 * v0.92.3 book alignment, core mechanics and characters: pure functions over RULES.CORE_V923 (rules/config923/core.ts).
 * Each behaves the book's way at the shipped value of its switch and the old (v0.92.2) way at the other.
 * No Foundry dependency.
 */
import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { t as tx } from '../helpers/i18n.ts';

type Letter = 'A' | 'B' | 'C' | 'D' | 'E';
type AttrKey = 'body' | 'quickness' | 'strength' | 'charisma' | 'intelligence' | 'willpower';
const LETTERS: readonly Letter[] = ['A', 'B', 'C', 'D', 'E'];
const V = () => RULES.CORE_V923;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));
const letterOf = (l: unknown): Letter | null => {
  const s = String(l ?? '').trim().toUpperCase();
  return (LETTERS as readonly string[]).includes(s) ? (s as Letter) : null;
};
const isHuman = (metatype: unknown) => !metatype || String(metatype) === 'human';

// ---------------------------------------------------------------- The priority table

/** Whether the book's creation table is in use (Core pp. 45–47). */
export const bookPriorities = (): boolean => V().priorities !== 'old';

/** What a priority letter gives in the Attributes, Skills and Resources columns (the book's table or the old one). */
export function priorityRow(letter: unknown): { attributes: number; skills: number; resources: number } {
  const l = letterOf(letter);
  if (!l) return { attributes: 0, skills: 0, resources: 0 };
  const r = bookPriorities() ? V().bookPriorities[l] : RULES.CREATION.priorities[l];
  return { attributes: num(r?.attributes), skills: num(r?.skills), resources: num(r?.resources) };
}

/** The Race priority a metatype needs: a metahuman A (C with More Metahumans), a human anything (Core p. 45). */
export function raceNeed(metatype: unknown): Letter {
  if (!bookPriorities()) return (RULES.CREATION.race[String(metatype ?? 'human')] ?? 'E') as Letter;
  if (isHuman(metatype)) return 'E';
  return V().moreMetahumans ? 'C' : 'A';
}

/**
 * The magic a Magic priority allows for a metatype (Core p. 45): a human A full magician, B adept; a metahuman B full
 * magician, C adept (with More Metahumans: A full, B adept for everyone). 'adept' also covers aspected magicians.
 */
export function magicTier(letter: unknown, metatype: unknown = 'human'): 'full' | 'adept' | 'none' {
  const l = letterOf(letter);
  if (!l) return 'none';
  if (!bookPriorities()) return RULES.CREATION.priorities[l].magic;
  const meta = !isHuman(metatype) && !V().moreMetahumans;
  const full: Letter = meta ? 'B' : 'A';
  const adept: Letter = meta ? 'C' : 'B';
  return l === full ? 'full' : l === adept ? 'adept' : 'none';
}

/**
 * Force Points at creation (Core p. 47): by the Resources priority, 50/35/25/15/5, for magicians only. Null under the
 * old table (the caller uses the spell points by Magic priority). `magician` false (mundane) gives 0.
 */
export function forcePoints(o: { resources?: unknown; magician: boolean }): number | null {
  if (!bookPriorities()) return null;
  if (!o.magician) return 0;
  const l = letterOf(o.resources);
  return l ? whole(V().bookPriorities[l]?.forcePoints) : 0;
}

// ---------------------------------------------------------------- Metatypes

/** The book's racial modifiers missing from RULES.METATYPES (dwarf Q −1, troll W −1, Core p. 45); 0 the old way. */
export function racialExtra(metatype: unknown, key: AttrKey): number {
  if (V().racialMods === 'old' || RULES.URR_V80.coreMetaMax) return 0;
  return num(V().racialExtra[String(metatype ?? 'human')]?.[key]);
}

/** A metatype's racial modifiers with the book's extra ones. */
export function racialModsOf(metatype: unknown): Partial<Record<AttrKey, number>> {
  const base = (RULES.METATYPES.types[String(metatype ?? 'human')]?.mods ?? {}) as Partial<Record<AttrKey, number>>;
  const out: Partial<Record<AttrKey, number>> = { ...base };
  for (const k of ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'] as AttrKey[]) {
    const x = racialExtra(metatype, k);
    if (x) out[k] = num(out[k]) + x;
  }
  return out;
}

/** The troll's dermal armor as armor points (the old way) — 0 when it is +1 Body for damage resistance (Core p. 45). */
export function dermalArmor(dermal: number): number {
  return V().trollDermal === 'armor' ? whole(dermal) : 0;
}

/** Extra Body dice for Damage Resistance Tests from dermal armor (Core p. 45); 0 the old way or when astral. */
export function dermalSoakDice(dermal: number, astral = false): number {
  return V().trollDermal === 'body' && !astral ? whole(dermal) : 0;
}


/** The Karma Pool a character starts with when the creation wizard finishes (Core p. 47); null = no change. */
export function startingPool(metatype: unknown): number | null {
  if (V().startPool === 'old') return null;
  return !isHuman(metatype) && !V().moreMetahumans ? Math.max(1, whole(V().startPoolMetahuman)) : 1;
}

/** The creation wizard's update for the starting Karma Pool (Core p. 47): raised to it, never lowered; {} when not. */
export function startPoolPatch(metatype: unknown, pool: number): Record<string, unknown> {
  const want = startingPool(metatype);
  return want !== null && whole(pool) < want ? { 'system.karma.pool': want } : {};
}

// ---------------------------------------------------------------- Money at creation

/** Unspent Resources at 10:1 (Core p. 47): null the old way (the caller uses STREET_V61.creation.leftoverCash). */
export function leftoverAtRatio(nuyen: number): { kept: number; lost: number; note: string } | null {
  if (V().leftoverCash !== 'tenth') return null;
  const n = whole(nuyen);
  const ratio = Math.max(1, num(V().cashRatio, 10));
  const kept = Math.floor(n / ratio);
  const lost = n - kept;
  return { kept, lost, note: lost ? tx('SR2E.Text.Core923.leftoverRatio', { amount: n.toLocaleString(), ratio, kept: kept.toLocaleString() }) : '' };
}

/** The starting cash roll (Core p. 47): a formula like "3d6" and the nuyen per point, or null when off. */
export function startingCashRoll(): { formula: string; per: number } | null {
  if (V().startingCash !== 'roll') return null;
  const dice = whole(V().startingCashDice);
  const per = whole(V().startingCashPer);
  return dice > 0 && per > 0 ? { formula: `${dice}d6`, per } : null;
}

// ---------------------------------------------------------------- Languages

/** Points added to Intelligence for the free native language (Core p. 46: + 2; 0 the old way). */
export function nativeBonusBook(): number {
  return V().nativeLanguage === 'book' ? whole(V().nativeBonus) : 0;
}

/** A free street dialect at half Intelligence, rounded down, for a Street lifestyle at creation (Core p. 46); 0 otherwise. */
export function streetDialectRating(intelligence: number, lifestyle: unknown): number {
  if (V().streetDialect !== 'book' || String(lifestyle ?? '') !== 'street') return 0;
  return Math.floor(whole(intelligence) / 2);
}

/** The language test TNs (Core p. 184) or the old complexity list. */
export function languageTable(): ReadonlyArray<{ id: string; label: string; tn: number }> {
  return V().languageTns === 'book' ? V().languageTable : RULES.CHARACTERS_V58.languages.complexity;
}

/** The +2 for speaking a dialect (Core p. 184); null the old way. */
export function dialectModifier(): TargetNumberModifier | null {
  return V().languageTns === 'book' ? { id: 'speakingDialect', label: tx('SR2E.Card.Mod.speakingDialect'), value: num(V().dialectTn, 2) } : null;
}

// ---------------------------------------------------------------- Karma

/** Raising an attribute past its natural maximum at double cost with the GM's leave (Core p. 190); null = refused. */
export function aboveMaxCost(o: { to: number; max: number; augmented: number }): { cost: number; ok: boolean; reason: string } | null {
  if (V().aboveMax !== 'double') return null;
  const to = whole(o.to);
  if (to > o.augmented) return { cost: 0, ok: false, reason: tx('SR2E.Text.Charfix.aboveAugmentedMaximum', { max: o.augmented }) };
  return { cost: Math.ceil(to * num(RULES.UPKEEP.karma.attributeMultiplier, 1) * 2), ok: true, reason: '' };
}

/** How many Karma Pool dice a test may buy (Core p. 191): up to its own skill, attribute or rating dice; 0 when off. */
export function karmaDiceCap(baseDice: number): number {
  return V().karmaDice === 'book' ? whole(baseDice) : 0;
}

/**
 * Karma Pool dice for a test (Core p. 191): the Revamp's coreKarmaDice when on (no cap but the pool), else the book's
 * (at most the test's own dice, `baseDice`); 0 when off.
 */
export function karmaDiceFor(wanted: number | undefined, left: number, baseDice: number): number {
  if (RULES.URR_V80.coreKarmaDice) return Math.min(whole(wanted), whole(left));
  return Math.min(whole(wanted), whole(left), karmaDiceCap(baseDice));
}

/** A roll dialog's Karma dice row ('' when off, no pool left, or the skill isn't rated); `baseDice` caps it in the book. */
export function karmaDiceRow(left: number, rated = true, baseDice = 0): string {
  const urr = Boolean(RULES.URR_V80.coreKarmaDice);
  const max = urr ? whole(left) : Math.min(whole(left), karmaDiceCap(baseDice));
  if (!rated || max <= 0) return '';
  return `<div class="form-group"><label title="${urr ? tx('SR2E.Text.Urr80Core.karmaPoolPointADie') : tx('SR2E.Text.Core923.karmaDiceBook')}">${tx('SR2E.Text.Urr80Core.karmaPoolDiceLeft', { l: whole(left) })}</label><input name="karmaDice" type="number" min="0" max="${max}" value="0"></div>`;
}

/** Whether Karma may still be spent on a test after a disaster was avoided (Core p. 191: no). */
export function karmaAfterOops(disasterAvoided: unknown): boolean {
  return !(disasterAvoided && V().afterOops === 'book');
}

/**
 * Karma to raise a knowledge or language skill the book's way (Core p. 190): a language new rating × 1, a knowledge
 * skill a general skill (× 2, concentration × 1.5, specialization × 1). Null = not this rule (the caller goes on).
 */
export function bookSkillCost(o: { to: number; kind: string; specialization?: boolean; concentration?: boolean }): number | null {
  if (V().skillKarma !== 'book') return null;
  const to = whole(o.to);
  if (o.kind === 'language') return Math.ceil(to * 1);
  if (o.kind !== 'knowledge') return null;
  return Math.ceil(to * (o.specialization ? 1 : o.concentration ? 1.5 : 2));
}

/** A new skill's first point (Core p. 190: 1 Good Karma); null the old way. */
export function newSkillCost(from: number, to: number): number | null {
  if (V().newSkill !== 'book' || whole(from) !== 0 || whole(to) !== 1) return null;
  return whole(V().newSkillCost);
}

/**
 * Training days by the Karma spent (Companion pp. 50, 53): × 7 for an active, B/R or social skill or an attribute, × 15
 * for a knowledge or language skill (`skillKind` for a concentration or specialization); null = the old way.
 */
export function trainingDaysByKarma(o: { kind: string; skillKind?: string; cost: number }): number | null {
  if (V().trainingTime !== 'karma') return null;
  const t = V().trainingDaysPerKarma;
  const k = o.kind === 'specialization' || o.kind === 'concentration' ? String(o.skillKind ?? 'active') : o.kind;
  const per = num(t[k] ?? t['active'], 7);
  return Math.max(num(RULES.CHARACTERS_V58.training.minimumDays, 1), Math.ceil(whole(o.cost) * per));
}

/** The individual Karma awards (Core p. 199) or the old list (CHARACTERS_V58.karmaAward.individual). */
export function individualAwardRows(): ReadonlyArray<{ id: string; label: string; value: number; max: number }> {
  return V().awards === 'book' ? V().individualAwards : RULES.CHARACTERS_V58.karmaAward.individual;
}

// ---------------------------------------------------------------- Tests

/** Base time ÷ successes rounded to the nearest whole unit, at least 1 (Core p. 68); null the old way. */
export function roundTime(raw: number): number | null {
  if (V().timeRounding !== 'nearest') return null;
  const r = num(raw);
  return r > 0 ? Math.max(1, Math.round(r)) : 0;
}

/** Whether a Skill Web arrow blocks a default against it (Core p. 68). */
export const webArrowsBlock = (): boolean => V().webArrows === 'book';

/** Whether attribute defaulting traces the Skill Web from the attribute (Core p. 68). */
export const webAttributeDefault = (): boolean => V().attributeDefault === 'web';

// ---------------------------------------------------------------- Perception

export type PerceptionMode = 'book' | 'companion' | 'opposed';
export const perceptionMode = (): PerceptionMode => (['book', 'companion', 'opposed'].includes(V().perception) ? V().perception : 'book');

/**
 * The perception TNs by the rule (Core p. 185; Companion p. 90): the observer's TN (before the sight and situation
 * modifiers) and the sneaker's ('book': the sneaker doesn't roll, TN 0). `stealthSuccesses` is the sneaker's result
 * under 'companion' (each +1 to the observer). 'opposed': rules/social.ts perceptionTargets.
 */
export function bookPerceptionTargets(o: { stealthSuccesses?: number }): { observerTn: number; sneakerTn: number } {
  const base = Math.max(RULES.MIN_TARGET_NUMBER, num(V().perceptionTn, 4));
  if (perceptionMode() === 'companion') return { observerTn: base + whole(o.stealthSuccesses), sneakerTn: base };
  return { observerTn: base, sneakerTn: 0 };
}

/** The Companion's +1 TN per Stealth success as a modifier row (null for none). */
export function stealthTnModifier(successes: number): TargetNumberModifier | null {
  const n = whole(successes);
  return n ? { id: 'stealthSuccesses', label: tx('SR2E.Card.Mod.stealthSuccesses'), value: n } : null;
}

/** Book: noticed on one success (Core p. 185). */
export const bookNoticed = (observerSuccesses: number): boolean => whole(observerSuccesses) >= 1;

/**
 * The perception dialogs' situation rows: RULES.STREET.perception, plus the book's sense rows (Core p. 185) when the
 * list has none of its own (the Revamp's list already carries sense rows and is left as it is).
 */
export function perceptionRows(): ReadonlyArray<{ id: string; label: string; value: number }> {
  const base = RULES.STREET.perception;
  if (V().perceptionSounds !== 'book') return base;
  const ids = new Set(base.map((r) => r.id));
  if (V().senseRows.some((r) => ids.has(r.id))) return base;
  return [...base, ...V().senseRows];
}

// ---------------------------------------------------------------- Athletics

/**
 * Metres an athletics test covers the book's way: climbing ¼ × (the average of Quickness and Strength + 2 per success),
 * round down (Fields of Fire p. 75); swimming the running distance with Quickness + 1 per success, ÷ 5 (Cyberpirates).
 * Null for a jump or the old way.
 */
export function athleticsDistanceBook(kind: string, successes: number, a: { quickness: number; strength: number; runMultiplier: number }): number | null {
  if (V().athletics !== 'book') return null;
  const s = whole(successes);
  if (kind === 'climb') return Math.floor(((num(a.quickness) + num(a.strength)) / 2 + 2 * s) / 4);
  if (kind === 'swim') return Math.floor(((whole(a.quickness) + s) * Math.max(1, num(a.runMultiplier, 3))) / Math.max(1, num(V().swimDivisor, 5)));
  return null;
}

/** The Climbing Table's modifier rows for the dialog ([] the old way, or under the Revamp's athletics). */
export function climbModifierRows(): ReadonlyArray<{ id: string; label: string; value: number }> {
  // Under the Revamp's own athletics (URR_V80.hsAthletics 'urr') its rules stand alone.
  return V().athletics === 'book' && RULES.URR_V80.hsAthletics !== 'urr' ? V().climbModifiers : [];
}

// ---------------------------------------------------------------- NPCs

/** Whether a Threat Rating works the book's way: dice on every test, no Combat Pool (Core p. 187). */
export const threatBook = (): boolean => V().threat === 'book';

/** Threat dice added to an NPC's test (book), 0 otherwise. */
export function threatDice(o: { npc: boolean; threatRating: number }): number {
  return threatBook() && o.npc ? whole(o.threatRating) : 0;
}

/** Whether the book's morale is in use (Core p. 187). */
export const moraleBook = (): boolean => V().morale === 'book';

/**
 * The wound at which an NPC of this Professional Rating withdraws (Core p. 187): 1 Light, 2 Moderate, 3 Serious; null
 * for 4 (never), 0 (no rating) or the old rule.
 */
export function moraleWound(professionalRating: number): 'L' | 'M' | 'S' | 'D' | null {
  if (!moraleBook()) return null;
  const pr = whole(professionalRating);
  return (V().moraleWound as Record<number, 'L' | 'M' | 'S' | 'D'>)[pr] ?? null;
}

const LEVEL_ORDER = ['L', 'M', 'S', 'D'] as const;
/** Whether a wound grew to (or past) the withdrawal level just now: `before` and `after` are wound levels or null. */
export function moraleWithdraws(professionalRating: number, before: string | null, after: string | null): boolean {
  const at = moraleWound(professionalRating);
  if (!at || !after) return false;
  const rank = (l: string | null) => (l ? LEVEL_ORDER.indexOf(l as typeof LEVEL_ORDER[number]) : -1);
  return rank(after) >= rank(at) && rank(before) < rank(at);
}

/** Whether the book's recognition is in use (Core p. 199). */
export const recognitionBook = (): boolean => V().recognition === 'book';

/** The TN for an NPC to have heard of a character: (1,000 − rep) ÷ 50, rounded, at least 2 (Core p. 199). */
export function recognitionTnBook(rep: number): number {
  const top = num(V().recognitionRep, 1000);
  const per = Math.max(1, num(V().recognitionPer, 50));
  return Math.max(RULES.MIN_TARGET_NUMBER, Math.round((top - Math.max(0, num(rep))) / per));
}

/**
 * The fence's meet (Core p. 188): each side's Negotiation against the other's Willpower + 2 ('book'; the fence's
 * Willpower is RULES.STREET.fence.tn); the old way both at `tn`.
 */
export function fenceTns(o: { fenceWillpower: number; sellerWillpower: number; tn: number }): { mine: number; theirs: number } {
  if (V().fence !== 'book') return { mine: num(o.tn, 4), theirs: num(o.tn, 4) };
  const plus = num(V().fenceSuspicion, 2);
  return { mine: Math.max(RULES.MIN_TARGET_NUMBER, whole(o.fenceWillpower) + plus), theirs: Math.max(RULES.MIN_TARGET_NUMBER, whole(o.sellerWillpower) + plus) };
}

/** The least share a fence pays (Core p. 188: 10% when the fence wins); 0 the old way. */
export function fenceFloor(): number {
  return V().fence === 'book' ? whole(V().fenceMinPercent) : 0;
}

/** Whether the Edges and Flaws must come to 0 (Companion p. 21). */
export const qualitiesZero = (): boolean => V().qualities === 'zero';

/** Whether haggling follows the book (Core p. 184): the seller rolls against the buyer's Willpower. */
export const haggleBook = (): boolean => V().haggle === 'book';
