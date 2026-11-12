/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: core): pure functions. Each reads its switch in
 * RULES.URR_V80 (config80-core.ts) and behaves the book way while the switch is at its shipped value.
 */
import { RULES } from './config.ts';
import type { DieResult, TargetNumberModifier } from './dice.ts';
import { opposedOutcome } from './social.ts';
import { skillTestDice, webDistance, type SkillDiceInput, type SkillDice, type WebLink } from './skills.ts';
import type { AttrKey } from './core.ts';
import { escHtml } from './html.ts';
import { webAttributeDefault } from './core923.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

const V = () => RULES.URR_V80;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));

// ---------------------------------------------------------------- Dice and tests

/** Critical successes (coreCriticals): one per full 6 points a die's total goes over the TN; 0 when off. */
export function urrCoreCriticals(dice: readonly DieResult[] | null | undefined, tn: number): number {
  if (!V().coreCriticals) return 0;
  const t = num(tn);
  return (dice ?? []).reduce((n, d) => n + Math.max(0, Math.floor((num(d?.total) - t) / 6)), 0);
}

/** The card line for critical successes ('' when off, none, or a botch). */
export function urrCoreCriticalNote(dice: readonly DieResult[] | null | undefined, tn: number, botch = false): string {
  const n = botch ? 0 : urrCoreCriticals(dice, tn);
  if (!n) return '';
  return tCount(n, 'SR2E.Text.Urr80Core.criticalSuccesses');
}

/** The TN presets for a roll dialog: the knowledge table for a knowledge skill, else the difficulty table; [] when off. */
export function urrCoreTnPresets(kind = ''): ReadonlyArray<{ id: string; label: string; tn: number }> {
  if (kind === 'knowledge' && V().coreKnowledgeTest) return V().coreKnowledgeTns;
  return V().coreTnPresets ? V().coreDifficulty : [];
}

/** A roll dialog's preset row (a select named `tnPreset` whose value is the TN); '' when off. */
export function urrCoreTnPresetRow(kind = ''): string {
  const list = urrCoreTnPresets(kind);
  if (!list.length) return '';
  const label = kind === 'knowledge' && V().coreKnowledgeTest ? tx('SR2E.Text.Urr80Core.informationSought') : tx('SR2E.Text.Urr80Core.difficulty');
  // v0.81.0 (RB-16): config labels are GM-editable (advanced house-rules JSON), so they are escaped.
  return `<div class="form-group"><label>${label}</label><select name="tnPreset"><option value="">${tx('SR2E.Text.Urr80Core.typeTheTn')}</option>${list.map((r) => `<option value="${num(r.tn)}">${tx('SR2E.Text.Urr80Core.presetTn', { label: escHtml(r.label), tn: num(r.tn) })}</option>`).join('')}</select></div>`;
}

/** Whether a skill test's card says what a knowledge test's successes give (coreKnowledgeTest). */
export function urrCoreKnowledgeCard(kind: string, language = false): boolean {
  return Boolean(V().coreKnowledgeTest) && kind === 'knowledge' && !language;
}

/** What a knowledge test's successes give ('Nothing useful.' for 0). */
export function urrCoreKnowledgeText(successes: number): string {
  const s = whole(successes);
  let text = tx('SR2E.Text.Urr80Core.nothingUseful');
  // v0.81.0 (RB-18): rows taken in ascending order of successes, whatever order an override lists them in.
  for (const r of [...V().coreKnowledgeReveals].sort((a, b) => a.successes - b.successes)) if (s >= r.successes) text = r.text;
  return text;
}

/**
 * An opposed test's outcome (coreTies 'actor'): as opposedOutcome, but a tie with at least one success goes to the
 * side that made the test (net 0). 'none': opposedOutcome unchanged.
 */
export function urrCoreOpposed(initiator: number, defender: number): { winner: 'initiator' | 'defender' | 'none'; net: number } {
  const o = opposedOutcome(initiator, defender);
  if (o.winner === 'none' && V().coreTies === 'actor' && num(initiator) >= 1) return { winner: 'initiator', net: 0 };
  return o;
}

// ---------------------------------------------------------------- Karma Pool

/** Karma Pool dice bought for a test (coreKarmaDice): at most what is left; 0 when off. */
export function urrCoreKarmaDice(wanted: number | undefined, left: number): number {
  if (!V().coreKarmaDice) return 0;
  return Math.min(whole(wanted), whole(left));
}

/** A roll dialog's Karma dice row ('' when off, no pool left, or the skill isn't rated). */
export function urrCoreKarmaDiceRow(left: number, rated = true): string {
  const l = whole(left);
  if (!V().coreKarmaDice || !rated || l <= 0) return '';
  return `<div class="form-group"><label title="${tx('SR2E.Text.Urr80Core.karmaPoolPointADie')}">${tx('SR2E.Text.Urr80Core.karmaPoolDiceLeft', { l })}</label><input name="karmaDice" type="number" min="0" max="${l}" value="0"></div>`;
}

/** The starting Karma Pool when the creation wizard finishes (coreStartPoolByMeta): an update, or {} (human, or off). */
export function urrCoreStartPool(metatype: string | null | undefined, pool: number): Record<string, unknown> {
  if (!V().coreStartPoolByMeta) return {};
  const m = String(metatype ?? 'human');
  if (m === 'human') return {};
  const want = whole(V().coreStartPoolMeta);
  return whole(pool) < want ? { 'system.karma.pool': want } : {};
}

/**
 * Karma earned (coreKarmaGrowth 'perAward'): the first coreAwardPool point(s) of the award go to the Karma Pool, the
 * next coreAwardGood to Good Karma, round again; each award starts over. null = the book way (upkeep.karmaAward).
 */
export function urrCoreKarmaAward(o: { careerBefore: number; amount: number }): { good: number; pool: number; career: number } | null {
  if (V().coreKarmaGrowth !== 'perAward') return null;
  const amount = whole(o.amount);
  const p = whole(V().coreAwardPool), g = whole(V().coreAwardGood);
  const cycle = p + g;
  let pool = 0;
  if (cycle > 0) pool = Math.floor(amount / cycle) * p + Math.min(p, amount % cycle);
  return { good: amount - pool, pool, career: Math.max(0, num(o.careerBefore)) + amount };
}

// ---------------------------------------------------------------- Attributes

/** The change to a natural maximum by the URR's table (coreMetaMax); 0 when off. */
export function urrCoreMaxAdjust(metatype: string | null | undefined, key: AttrKey): number {
  if (!V().coreMetaMax) return 0;
  return num(V().coreMetaMaxAdjust[String(metatype ?? 'human')]?.[key]);
}

/** Essence as it caps Magic: rounded down (coreEssenceFloor), else rounded up (book). */
export function urrCoreEssenceRound(essence: number): number {
  return V().coreEssenceFloor ? Math.floor(num(essence)) : Math.ceil(num(essence));
}

// ---------------------------------------------------------------- Skills and the Skill Web

/** skillTestDice with defaulting from a concentration or specialization (coreSubSkillDefault) and a traced attribute TN. */
export function urrCoreSkillTestDice(input: SkillDiceInput & { attributeTn?: number }): SkillDice {
  const v = V();
  if (v.coreSubSkillDefault && !(num(input.rating) > 0) && !(input.related && input.related.rating > 0)) {
    const conc = whole(input.concentrationRating), spec = whole(input.specializationRating);
    if (conc > 0) return { dice: conc, modifier: { id: 'defaultingFromTheConcentration', label: tx('SR2E.Card.Mod.defaultingFromTheConcentration'), value: num(v.coreConcDefaultTn) }, using: 'concentration' };
    if (spec > 0) return { dice: spec, modifier: { id: 'defaultingFromTheSpecialization', label: tx('SR2E.Card.Mod.defaultingFromTheSpecialization'), value: num(v.coreConcDefaultTn) + num(v.coreSpecDefaultTn) }, using: 'specialization' };
  }
  const r = skillTestDice(input);
  // v0.92.3 (RULES.CORE_V923.attributeDefault 'web', Core p. 68): the book traces attribute defaults through the web too.
  if (r.using === 'attribute' && (v.coreWebAttributes || webAttributeDefault()) && input.attributeTn !== undefined) {
    return { ...r, modifier: { id: 'defaultingToAttributeSkillWeb', label: tx('SR2E.Card.Mod.defaultingToAttributeSkillWeb'), value: num(input.attributeTn) } };
  }
  return r;
}

/** The attribute-defaulting TN traced through the Skill Web (coreWebAttributes): { attributeTn } or {} (no link, or off). */
export function urrCoreAttributeTn(links: readonly WebLink[], skill: string, attribute: string): { attributeTn?: number } {
  if (!(V().coreWebAttributes || webAttributeDefault()) || !links.length || !skill || !attribute) return {};
  const name = attribute.charAt(0).toUpperCase() + attribute.slice(1);
  const d = webDistance(links, skill, name);
  return d !== null && d > 0 ? { attributeTn: d * RULES.SKILLS.web.perStep } : {};
}

/** Points added to the free native language rating (coreNativeBonus; 0 in the book). */
export function urrCoreNativeBonus(): number {
  return Math.max(0, Math.floor(num(V().coreNativeBonus)));
}

/** Karma to raise a language (coreLanguageKarma > 0): new rating × it; null = the book's cost. */
export function urrCoreSkillCost(o: { to: number; kind: string; specialization?: boolean; concentration?: boolean }): number | null {
  const m = num(V().coreLanguageKarma);
  if (!(m > 0) || o.kind !== 'language' || o.specialization || o.concentration) return null;
  return Math.ceil(whole(o.to) * m);
}

// ---------------------------------------------------------------- Training

const urrTraining = () => V().coreTraining === 'urr';

/**
 * Days of training (coreTraining 'urr'): Karma spent × hours per Karma, trained the daily hours (or Willpower hours,
 * if more) a day, at least the minimum days. null = the book way (everyday.trainingDays).
 */
export function urrCoreTrainingDays(o: { cost: number; willpower?: number }): number | null {
  if (!urrTraining()) return null;
  const v = V();
  const hours = whole(o.cost) * Math.max(0, num(v.coreTrainHoursPerKarma));
  const perDay = Math.max(1, num(v.coreTrainDailyHours), whole(o.willpower));
  return Math.max(RULES.CHARACTERS_V58.training.minimumDays, Math.ceil(hours / perDay));
}

/**
 * An instructor's test (coreTraining 'urr'): the base days ÷ (1 + successes); the instructor needs the skill at the
 * new rating + the margin (no rating for an attribute). null = the book way (everyday.instructionResult).
 */
export function urrCoreInstruction(o: { days: number; successes: number; instructorRating: number; newRating: number; attribute?: boolean }): { days: number; usable: boolean; note: string } | null {
  if (!urrTraining()) return null;
  const min = RULES.CHARACTERS_V58.training.minimumDays;
  const days = Math.max(0, num(o.days));
  const need = whole(o.newRating) + whole(V().coreInstructorMargin);
  const usable = Boolean(o.attribute) || num(o.instructorRating) >= need;
  if (!usable) return { days, usable, note: tx('SR2E.Text.Urr80Core.instructorRatingIsBelow', { instructorRating: num(o.instructorRating), need, margin: whole(V().coreInstructorMargin) }) };
  const s = whole(o.successes);
  if (s <= 0) return { days, usable, note: tx('SR2E.Text.Urr80Core.noSuccessesTrainingTakes') };
  const d = Math.max(min, Math.ceil(days / (1 + s)));
  return { days: d, usable, note: tCount(d, 'SR2E.Text.Urr80Core.daysDividedBySuccesses', { days, s }) };
}

/** What an instructor's test card needs to know besides the book's fields ({} in the book). */
export function urrCoreInstructExtra(t: { attribute?: string } | null | undefined): { attribute?: boolean } {
  return urrTraining() ? { attribute: Boolean(t?.attribute) } : {};
}

/** The instructor rule in words, for the Instructor dialog. */
export function urrCoreInstructorRule(): string {
  if (!urrTraining()) return tx('SR2E.Text.Urr80Core.theirOwnRatingMustReach');
  return tx('SR2E.Text.Urr80Core.theirOwnSkillMustBe', { margin: whole(V().coreInstructorMargin) });
}

// ---------------------------------------------------------------- Gear

/** The extra TN for finding gear (coreFindTn); [] in the book. */
export function urrCoreFindMods(): TargetNumberModifier[] {
  const n = Math.floor(num(V().coreFindTn));
  return n ? [{ id: 'acquisition', label: tx('SR2E.Card.Mod.acquisition'), value: n }] : [];
}

/** The seller's TN when haggling: the buyer's Intelligence (coreHaggleTn 'intelligence') or RULES.STREET.haggle.tn. */
export function urrCoreHaggleSellerTn(buyerIntelligence: number): number {
  const book = RULES.STREET.haggle.tn;
  if (V().coreHaggleTn !== 'intelligence') return book;
  const i = whole(buyerIntelligence);
  return i > 0 ? Math.max(RULES.MIN_TARGET_NUMBER, i) : book;
}
