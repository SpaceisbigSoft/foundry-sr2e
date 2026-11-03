import { RULES } from './config.ts';
import { CHARACTERS_V73 } from './config73/characters.ts';
import { socialAttribute } from './social.ts';
import { lifestyleOf, DAY_SECONDS } from './upkeep.ts';
import { lifestyleOutright } from './paperwork.ts';
import { naturalReaction } from './everyday.ts';
import { metatype, racialModifier, attributeMaximums, checkAttributeLimits, type AttrKey } from './core.ts';
import type { Quality } from './street.ts';
import { t as tx, tCount, tKey } from '../helpers/i18n.ts';
// v0.81.0: urrCoreMaxAdjust is applied in rules/core.ts attributeMaximums.

/**
 * v0.73.0 characters, skills, the street and NPCs (REVIEW-v0.69 O29–O38). Pure rules, no Foundry. Values and
 * switches in RULES.CHARACTERS_V73 (rules/config73/characters.ts), read at call time so house rules count; every
 * function honours its switch so the old behaviour comes back.
 */

type C73 = typeof CHARACTERS_V73;
const C = (): C73 => ((RULES as any).CHARACTERS_V73 ?? CHARACTERS_V73) as C73;
const num = (v: unknown, d = 0): number => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown): number => Math.max(0, Math.floor(num(v)));
const ATTRS: readonly AttrKey[] = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'];
/** An attribute's name in the user's language (its key, capitalised, when lang/en.json has none). */
const capName = (k: string) => {
  const key = `SR2E.Attribute.${k}`;
  const label = tKey(key);
  return label === key ? k.charAt(0).toUpperCase() + k.slice(1) : label;
};

// ---------------------------------------------------------------- O29: what the skill dialog remembers

/**
 * The fields the skill roll dialog remembers (the rememberMarker list). The complementary skill only with
 * `rollMemory.rememberComplementary` (the old way); helpers are never remembered.
 */
export function skillRollMemoryFields(): string[] {
  const m = C().rollMemory;
  const base = (Array.isArray(m.skillFields) ? m.skillFields : ['useSpec', 'useConc']).filter((f) => f !== 'comp' && f !== 'helper');
  return m.rememberComplementary ? [...base, 'comp'] : base;
}

// ---------------------------------------------------------------- O30: Negotiation's opposed attribute

const SOCIAL_ATTRS = ['charisma', 'willpower', 'intelligence'] as const;
type SocialAttr = typeof SOCIAL_ATTRS[number];

/**
 * The attribute whose rating is each side's TN in an opposed Negotiation test (negotiating pay): the house-rule key
 * CHARACTERS_V58.negotiation.opposedAttribute with `negotiation.useOpposedAttribute`, else (the old way, or an
 * attribute that isn't Charisma, Willpower or Intelligence) RULES.SOCIAL.skills' Negotiation (Charisma).
 */
export function negotiationAttribute(): SocialAttr {
  const fallback = (socialAttribute(RULES.CHARACTERS_V58?.negotiation?.skill ?? 'Negotiation') ?? 'charisma') as SocialAttr;
  if (!C().negotiation.useOpposedAttribute) return fallback;
  const want = String((RULES.CHARACTERS_V58?.negotiation as any)?.opposedAttribute ?? '').trim().toLowerCase();
  return (SOCIAL_ATTRS as readonly string[]).includes(want) ? (want as SocialAttr) : fallback;
}

// ---------------------------------------------------------------- O31: a lifestyle owned outright

export interface LifestyleStanding { days: number | null; permanent: boolean; overdue: boolean }

/**
 * Where a lifestyle stands: days paid ahead (negative = overdue; null = never paid), or `permanent` when owned
 * outright (system.lifestyle.outright) and `lifestyle.outrightPermanent` is on (then `days` is null and it is never
 * overdue). With the switch off an outright flag is ignored (the old way: the months paid ahead run out).
 */
export function lifestyleStanding(o: { paidUntil: number; now: number; outright?: boolean }): LifestyleStanding {
  if (o.outright && C().lifestyle.outrightPermanent) return { days: null, permanent: true, overdue: false };
  const paid = num(o.paidUntil, -1);
  if (!(paid >= 0)) return { days: null, permanent: false, overdue: false };
  const d = (paid - num(o.now)) / DAY_SECONDS;
  const days = d >= 0 ? Math.floor(d) : -Math.ceil(-d);
  return { days, permanent: false, overdue: days < 0 };
}

/** The Upkeep tab's status text for a lifestyle (as upkeepContext writes it, plus "Owned outright"). */
export function lifestyleStatusText(st: { days: number | null; permanent?: boolean }): string {
  if (st.permanent) return tx('SR2E.Text.Charfix.ownedOutright');
  if (st.days == null) return tx('SR2E.Text.Charfix.notPaidYet');
  return st.days >= 0 ? tCount(st.days, 'SR2E.Text.Charfix.paidForDays') : tCount(-st.days, 'SR2E.Text.Charfix.daysOverdue');
}

/**
 * What finishing creation writes for the lifestyle: outright (with the switch on) sets the flag and leaves paidUntil
 * at now (nothing is "paid ahead"); otherwise (and the old way) paidUntil = now + months (outright: the creation
 * outright months, as before).
 */
export function creationLifestylePatch(o: { outright: boolean; months: number; now: number }): Record<string, unknown> {
  const now = num(o.now);
  if (o.outright && C().lifestyle.outrightPermanent) return { 'system.lifestyle.outright': true, 'system.lifestyle.paidUntil': now };
  const months = o.outright ? lifestyleOutright({ lifestyle: 'low' }).months : Math.max(0, Math.floor(num(o.months)));
  return { 'system.lifestyle.outright': false, 'system.lifestyle.paidUntil': now + RULES.UPKEEP.monthDays * months * DAY_SECONDS };
}

export interface OutrightPurchase { ok: boolean; cost: number; credit: number; reason: string; label: string }

/**
 * Buying the current lifestyle outright after creation: the creation price (STREET_V61.creation.lifestyleOutright
 * months × the monthly cost), less whole months already paid ahead with `creditPaidMonths`. Refused when the switch
 * is off, it is already owned, or the cash is short.
 */
export function outrightPurchase(o: { lifestyle: string; outright?: boolean; paidUntil: number; now: number; nuyen: number }): OutrightPurchase {
  const l = C().lifestyle;
  const life = lifestyleOf(String(o.lifestyle ?? ''));
  const label = life.label;
  if (!l.buyLater || !l.outrightPermanent) return { ok: false, cost: 0, credit: 0, reason: tx('SR2E.Text.Charfix.outrightAfterCreationOff'), label };
  if (o.outright) return { ok: false, cost: 0, credit: 0, reason: tx('SR2E.Text.Charfix.alreadyOwnedOutright', { label }), label };
  const price = lifestyleOutright({ lifestyle: life.id }).cost;
  const paidMonths = num(o.paidUntil, -1) > num(o.now) ? Math.floor((num(o.paidUntil) - num(o.now)) / (RULES.UPKEEP.monthDays * DAY_SECONDS)) : 0;
  const credit = l.creditPaidMonths ? Math.min(price, paidMonths * Math.max(0, life.cost)) : 0;
  const cost = Math.max(0, price - credit);
  if (whole(o.nuyen) < cost) return { ok: false, cost, credit, reason: tx('SR2E.Text.Charfix.itCosts', { cost: cost.toLocaleString(), has: whole(o.nuyen).toLocaleString() }), label };
  return { ok: true, cost, credit, reason: '', label };
}

/**
 * An update that changes the lifestyle level: the extra fields it needs. An outright lifestyle is the old level's;
 * a new level is rented, unpaid from now (unless `keepOnLevelChange`). Empty when the level doesn't change or it
 * wasn't owned outright.
 */
export function lifestyleLevelChangePatch(o: { from: string; to: string | undefined; outright?: boolean; now: number }): Record<string, unknown> {
  if (o.to === undefined || o.to === o.from || !o.outright || !C().lifestyle.outrightPermanent || C().lifestyle.keepOnLevelChange) return {};
  return { 'system.lifestyle.outright': false, 'system.lifestyle.paidUntil': num(o.now) };
}

// ---------------------------------------------------------------- O32: a new skill trained with time keeps its specialization

/**
 * The system data for a skill learned with Karma under training time (created at rating 0, then trained to 1).
 * With `training.keepSpecialization` the specialization typed in the picker is kept by name at rating 0 (raised with
 * its own ⊕ once the skill is 1); `note` says so for the dialog's cost text. Off: the old way (dropped).
 */
export function timedNewSkillSystem(r: { kind: string; attribute: string; spec?: string }): { system: Record<string, unknown>; note: string } {
  const spec = String(r.spec ?? '').trim();
  const system: Record<string, unknown> = { kind: r.kind, attribute: r.attribute, rating: 0 };
  if (!spec) return { system, note: '' };
  if (!C().training.keepSpecialization) return { system, note: tx('SR2E.Text.Charfix.specializationNotKept', { spec }) };
  return { system: { ...system, specialization: spec, specializationRating: 0 }, note: tx('SR2E.Text.Charfix.specializationKept', { spec }) };
}

// ---------------------------------------------------------------- O33: one linked-attribute rating for Karma bands

type AttrBlock = { natural?: number; total?: number; base?: number } | undefined;

/**
 * The linked attribute's rating a skill's Karma band reads (skillCost's `attribute`), the same for the skill picker
 * and improve() with `skillCost.agree`: 'natural' (Reaction = natural (Q + I) / 2) or 'augmented' (totals; Reaction
 * = `derivedReaction`). With `agree` off (the old way) the picker (`caller` 'picker') reads derived Reaction and
 * natural ratings otherwise, and improve() natural everything. At least 1.
 */
export function skillBandAttribute(key: string, attributes: Record<string, AttrBlock>, o: { derivedReaction?: number; caller?: 'picker' | 'improve' } = {}): number {
  const s = C().skillCost;
  const augmented = s.agree ? s.basis === 'augmented' : false;
  const natOf = (k: string) => { const a = attributes?.[k]; return num(a?.natural ?? a?.base ?? a?.total, 1); };
  const totOf = (k: string) => { const a = attributes?.[k]; return num(a?.total ?? a?.natural ?? a?.base, 1); };
  if (key === 'reaction') {
    const oldPicker = !s.agree && o.caller === 'picker';
    if (augmented || oldPicker) return Math.max(1, Math.floor(num(o.derivedReaction, naturalReaction(totOf('quickness'), totOf('intelligence')))));
    return Math.max(1, naturalReaction(natOf('quickness'), natOf('intelligence')));
  }
  return Math.max(1, Math.floor(augmented ? totOf(key) : natOf(key)));
}

// ---------------------------------------------------------------- O34: racial modifiers can't take an attribute below 1

/** An attribute's natural rating from its base and racial modifier: at least `racialFloor.min` in 'floor' mode. */
export function racialNatural(base: number, racial: number): { natural: number; floored: boolean } {
  const f = C().racialFloor;
  const raw = num(base) + num(racial);
  if (f.mode !== 'floor') return { natural: raw, floored: false };
  const min = Math.max(0, num(f.min, 1));
  return raw < min ? { natural: min, floored: true } : { natural: raw, floored: false };
}

/**
 * The new base rating when Karma (or finished training) raises an attribute to natural rating `to`. `rawNatural` is
 * the natural rating before the floor (base + racial + any shapeshift: models' `a.rawNatural`). base + (to − raw),
 * at least +1: the same as the old `base + (to − natural)` unless the floor lifted the rating, when it buys the rise
 * for real instead of nothing.
 */
export function attributeRaiseBase(base: number, rawNatural: number, to: number): number {
  return Math.floor(num(base)) + Math.max(1, Math.floor(num(to)) - Math.floor(num(rawNatural)));
}

/** The attributes whose base + racial modifier is below the minimum (for the build check and the sheet), [] when 'off'. */
export function racialFloorProblems(metatypeId: string, bases: Partial<Record<AttrKey, number>>, applyRace = true): Array<{ key: AttrKey; base: number; racial: number; natural: number; needBase: number }> {
  const f = C().racialFloor;
  if (f.mode === 'off' || !applyRace) return [];
  const min = Math.max(0, num(f.min, 1));
  const out: Array<{ key: AttrKey; base: number; racial: number; natural: number; needBase: number }> = [];
  for (const key of ATTRS) {
    if (bases[key] === undefined) continue;
    const base = num(bases[key]);
    const racial = racialModifier(metatypeId, key);
    if (base + racial < min) out.push({ key, base, racial, natural: base + racial, needBase: min - racial });
  }
  return out;
}

/** Sheet warnings for racialFloorProblems (one line each). */
export function racialFloorWarnings(metatypeId: string, bases: Partial<Record<AttrKey, number>>, applyRace = true): string[] {
  const label = metatype(metatypeId).label;
  return racialFloorProblems(metatypeId, bases, applyRace).map((p) => tx('SR2E.Text.Charfix.racialFloorWarning', { attribute: capName(p.key), base: p.base, sign: p.racial < 0 ? '−' : '+', racial: Math.abs(p.racial), label, natural: p.natural, needBase: p.needBase }));
}

/** The build check's row (null when nothing is below the minimum or the rule is off). */
export function racialFloorRow(metatypeId: string, bases: Partial<Record<AttrKey, number>>): { label: string; used: string; allowed: string; ok: boolean; note?: string } | null {
  const bad = racialFloorProblems(metatypeId, bases);
  if (!bad.length) return null;
  const min = Math.max(0, num(C().racialFloor.min, 1));
  return { label: tx('SR2E.Text.Charfix.racialModifiers'), used: bad.map((p) => `${capName(p.key)} ${p.base}${p.racial < 0 ? '' : '+'}${p.racial} = ${p.natural}`).join(', '), allowed: tx('SR2E.Text.Charfix.eachAttributeAtLeast', { min }), ok: false,
    note: tx('SR2E.Text.Charfix.raiseTheBase', { list: bad.map((p) => tx('SR2E.Text.Charfix.attributeTo', { attribute: capName(p.key), needBase: p.needBase })).join(', ') }) };
}

// ---------------------------------------------------------------- O35: NPC Threat Rating, Professional Rating, Karma Pool

/**
 * The generator's ratings for a Threat Level (0–5): Threat Rating (`npcs.threatRating`, else 0 as before),
 * Professional Rating (`professionalRatings`, or the NPCGEN table's with `professionalFromTable`), and Karma Pool
 * ('none' for everyone, 'singles' only when not a grunt group, 'all' = the table's, the old way).
 */
export function npcRatings(o: { threat: number; grunts?: number; tablePr: number; tableKarmaPool: number }): { threatRating: number; professionalRating: number; karmaPool: number } {
  const n = C().npcs;
  const t = Math.max(0, Math.floor(num(o.threat)));
  const at = (list: readonly number[], d: number) => (Array.isArray(list) && list.length ? whole(list[Math.min(t, list.length - 1)]) : d);
  const threatRating = n.threatRating ? at(n.threatRatings, t) : 0;
  const professionalRating = n.professionalFromTable ? whole(o.tablePr) : at(n.professionalRatings, whole(o.tablePr));
  const group = Math.max(1, Math.floor(num(o.grunts, 1))) > 1;
  const karmaPool = n.karmaPool === 'all' ? whole(o.tableKarmaPool) : n.karmaPool === 'singles' && !group ? whole(o.tableKarmaPool) : 0;
  return { threatRating, professionalRating, karmaPool };
}

/**
 * The Karma Pool a new NPC starts with when its creation data doesn't give one (null = leave the schema's
 * default): `npcs.handMadeKarmaPool`. Only for type 'npc'.
 */
export function npcStartingKarmaPool(type: string, data: any): number | null {
  if (type !== 'npc') return null;
  const v = C().npcs.handMadeKarmaPool;
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return null;
  const given = data?.system?.karma?.pool ?? data?.['system.karma.pool'];
  if (given !== undefined && given !== null) return null;
  return whole(v);
}

// ---------------------------------------------------------------- O36: metatypes read at call time

/** The metatype ids now (house rules included). */
export function metatypeIds(): string[] {
  return Object.keys(RULES.METATYPES?.types ?? {});
}

/** Whether a metatype id is in the list now. */
export function metatypeKnown(id: string | null | undefined): boolean {
  return Boolean(id) && Object.prototype.hasOwnProperty.call(RULES.METATYPES?.types ?? {}, String(id));
}

/**
 * The metatype select's options now: every listed metatype, and (with `metatypes.open`) an id that is no longer
 * listed kept as "(not in the metatype list)" so saving the sheet doesn't change it.
 */
export function metatypeOptions(current?: string | null): Array<{ key: string; label: string }> {
  const list = Object.entries(RULES.METATYPES?.types ?? {}).map(([key, t]) => ({ key, label: String((t as any)?.label ?? key) }));
  const cur = String(current ?? '');
  if (cur && C().metatypes.open && !metatypeKnown(cur)) list.push({ key: cur, label: tx('SR2E.Text.Charfix.notInMetatypeList', { id: cur }) });
  return list;
}

// ---------------------------------------------------------------- O37: one name per skill

const lc = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** The canonical name for a skill name (`skillNames.aliases`, compared case-insensitively); unchanged otherwise or with the switch off. */
export function canonicalSkillName(name: string): string {
  const s = C().skillNames;
  const raw = String(name ?? '').trim();
  if (!s.canonical) return raw;
  return s.aliases?.[lc(raw)] ?? raw;
}

/** A list of skill names (the picker's, the starter list's) with aliases replaced and duplicates dropped. */
export function canonicalSkillNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names ?? []) {
    const c = canonicalSkillName(n);
    if (!c || seen.has(lc(c))) continue;
    seen.add(lc(c));
    out.push(c);
  }
  return out;
}

/** Whether two skill names are the same skill (case-insensitive; aliases equal their canonical name with the switch on). */
export function sameSkillName(a: string, b: string): boolean {
  return lc(canonicalSkillName(a)) === lc(canonicalSkillName(b)) && lc(a) !== '';
}

// ---------------------------------------------------------------- O38: edges and flaws with an effect

const qualitiesOn = () => Boolean(RULES.STREET?.qualities?.enabled);

/** Exceptional Attribute: + to this attribute's natural maximum from the edges (0 when off or none). */
export function exceptionalAttributeBonus(list: readonly Quality[] | null | undefined, key: string): number {
  const e = C().qualities.exceptionalAttribute;
  if (!e.enabled || !qualitiesOn()) return 0;
  const match = lc(e.match);
  let levels = 0;
  for (const q of list ?? []) {
    if (!q || q.kind === 'flaw' || !match || !lc(q.name).includes(match)) continue;
    const target = lc(q.target);
    if (target !== lc(key)) continue;
    const per = num(e.pointsPerLevel);
    levels += per > 0 ? Math.max(1, Math.floor(whole(q.points) / per)) : 1;
  }
  const cap = whole(e.maxLevels);
  return Math.min(levels, cap > 0 ? cap : levels) * num(e.perLevel, 1);
}

/** attributeMaximums with the Exceptional Attribute edge: natural + bonus, augmented from the new natural. */
export function attributeMaximumsWith(metatypeId: string | null | undefined, key: AttrKey, list?: readonly Quality[] | null): { natural: number; augmented: number } {
  // v0.81.0: one formula (rules/core.ts), the edge as its natural bonus.
  return attributeMaximums(metatypeId, key, exceptionalAttributeBonus(list, key));
}

/** checkAttributeLimits with the edges counted (same warnings and clamping as rules/core.ts). */
export function attributeLimitsWith(metatypeId: string | null | undefined, values: Partial<Record<AttrKey, { natural: number; total: number }>>, list?: readonly Quality[] | null): { warnings: string[]; capped: Partial<Record<AttrKey, number>> } {
  // v0.81.0: one check (rules/core.ts), the edge as each attribute's natural bonus.
  const bonus = Object.fromEntries((Object.keys(values) as AttrKey[]).map((k) => [k, exceptionalAttributeBonus(list, k)])) as Partial<Record<AttrKey, number>>;
  return checkAttributeLimits(metatypeId, values, bonus);
}

/**
 * Surplus flaw points at creation (house rule `qualities.surplusFlaws`): flaws − edges, at most `maxPoints`, as extra
 * attribute points, skill points or nuyen. All zero with `use` 'none' (the old way) or edges and flaws off.
 */
export function surplusFlawBonus(list: readonly Quality[] | null | undefined): { points: number; attributes: number; skills: number; nuyen: number } {
  const s = C().qualities.surplusFlaws;
  const none = { points: 0, attributes: 0, skills: 0, nuyen: 0 };
  if (s.use === 'none' || !qualitiesOn()) return none;
  let edges = 0, flaws = 0;
  for (const q of list ?? []) { const n = whole(q?.points); if (q?.kind === 'flaw') flaws += n; else edges += n; }
  const max = whole(s.maxPoints);
  const points = Math.min(Math.max(0, flaws - edges), max > 0 ? max : Infinity);
  if (!points) return none;
  return { points, attributes: s.use === 'attributes' ? points * whole(s.perPoint) : 0, skills: s.use === 'skills' ? points * whole(s.perPoint) : 0, nuyen: s.use === 'nuyen' ? points * whole(s.nuyenPerPoint) : 0 };
}

/**
 * Karma to raise an attribute to `to` (upkeep.attributeCost with the house-rule band): up to `max` (the natural
 * maximum) at new rating × UPKEEP.karma.attributeMultiplier; above it, with `karmaAboveRacial.enabled`, up to
 * `augmented` at new rating × `multiplier`; else refused (the old way).
 */
export function attributeKarmaCost(o: { to: number; max: number; augmented?: number }): { cost: number; ok: boolean; reason: string; band: 'normal' | 'aboveRacial' } {
  const to = Math.floor(num(o.to));
  if (to <= o.max) return { cost: Math.ceil(to * RULES.UPKEEP.karma.attributeMultiplier), ok: true, reason: '', band: 'normal' };
  const k = C().qualities.karmaAboveRacial;
  const cap = num(o.augmented, Math.floor(o.max * RULES.METATYPES.augmentedMultiplier));
  if (!k.enabled) return { cost: 0, ok: false, reason: tx('SR2E.Text.Charfix.aboveNaturalMaximum', { max: o.max }), band: 'normal' };
  if (to > cap) return { cost: 0, ok: false, reason: tx('SR2E.Text.Charfix.aboveAugmentedMaximum', { max: cap }), band: 'aboveRacial' };

  return { cost: Math.ceil(to * num(k.multiplier, 3)), ok: true, reason: '', band: 'aboveRacial' };
}
