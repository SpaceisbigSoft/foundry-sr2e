/**
 * v0.92.3 book alignment (sorcery): pure functions. Each reads its switch in RULES.SORCERY_V923
 * (config923/sorcery.ts) and behaves the book way while the switch is at its default ('book').
 */
import { RULES, type DamageLevel } from './config.ts';
import type { DieResult, TargetNumberModifier } from './dice.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';
import {
  urrMagRuleOfOneDrain, urrMagSustainCapProblem, urrMagSpellForceBonus, urrMagLearnTnFactor, urrMagLearnExtraDice,
  urrMagRitualProblem, urrMagRitualMaterials, urrMagRitualResistTn, urrMagSiteCost,
} from './urr80-magic.ts';

const S = () => RULES.SORCERY_V923;
const whole = (v: unknown) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : 0; };
const book = (k: keyof typeof RULES.SORCERY_V923) => S()[k] === 'book';

export function s923(k: keyof typeof RULES.SORCERY_V923): boolean { return book(k); }

// ---------------------------------------------------------------- Magic and Essence

/**
 * Magic after Essence loss, the book's way (Core p. 47; Ka-Ge 7 Q21): every point or part of a point of Essence lost
 * takes a point of Magic, whatever the Magic was. Null when the old setting decides ('v922').
 */
export function bookMagicFromEssence(baseMagic: number, essence: number, baseEssence = 6): number | null {
  if (!book('magicFromEssence')) return null;
  const lost = Math.max(0, Math.round((Number(baseEssence) - Number(essence)) * 100) / 100);
  return Math.max(0, whole(baseMagic) - Math.ceil(lost - 1e-9));
}

/**
 * v0.92.3 review fix: the base Magic to store for a write-up or stat block that shows Magic after its Essence loss.
 * The book's way (bookMagicFromEssence) takes a point per point or part of Essence lost from the stored base, so the
 * shown rating gets that back (else it would come off twice); the old cap is the same either way.
 */
export function importedBaseMagic(shown: number, essenceLost: number): number {
  const m = Math.max(0, whole(shown));
  if (m <= 0 || !RULES.MAGIC_CAPPED_BY_ESSENCE || RULES.URR_V80.coreEssenceFloor || !book('magicFromEssence')) return m;
  const lost = Math.max(0, Math.round(Number(essenceLost) * 100) / 100 || 0);
  return m + Math.ceil(lost - 1e-9);
}

// ---------------------------------------------------------------- The Revamp's switches that are also the book's rule
// Each wrapper gives the Revamp's result when its switch is on (so the Revamp behaves as before), else the book's
// (the same rule) while the SORCERY_V923 switch is 'book', else the old way.

/** Drain TN modifiers after all ones on the casting test (Core p. 131: +2). */
export function ruleOfOneDrainMods(botch: boolean): TargetNumberModifier[] {
  const urr = urrMagRuleOfOneDrain(botch);
  if (urr.length) return urr;
  const v = whole(S().ruleOfOneDrain);
  return botch && v ? [{ id: 'ruleOfOneOnTheCasting', label: tx('SR2E.Card.Mod.ruleOfOneOnTheCasting'), value: v }] : [];
}

/** Why one more self-sustained spell is too many (Core p. 128: at most the Sorcery rating), or null. */
export function sustainCapProblem(sustained: ReadonlyArray<{ focusId?: string; quickened?: boolean; spiritUuid?: string }>, sorcery: number): string | null {
  const urr = urrMagSustainCapProblem(sustained, sorcery);
  if (urr || !book('sustainCap')) return urr;
  const own = (sustained ?? []).filter((s) => !s.focusId && !s.quickened && !s.spiritUuid).length;
  const cap = Math.max(0, whole(sorcery));
  return own >= cap ? tCount(cap, 'SR2E.Text.Urr80Magic.canSustainAtMost') : null;
}

/**
 * Extra Force an exclusive or fetish spell takes effect at: the Revamp's while its own switches are on (review fix: the
 * Revamp keeps its rule, as for the other wrappers here), else the book's (Core p. 133), else none.
 */
export function spellForceBonus(o: { exclusive?: boolean; fetish?: boolean; expendable?: boolean }): number {
  const U = RULES.URR_V80;
  if (Math.max(0, whole(U.magExclusiveForce)) > 0 || Math.max(0, whole(U.magFetishForce)) > 0) return urrMagSpellForceBonus(o);
  return restrictedForceBonus(o) ?? urrMagSpellForceBonus(o);
}

/** Learning a spell: the TN multiplier on the Force (Core p. 132: 2). */
export function learnTnFactor(): number {
  return book('learning') ? 2 : urrMagLearnTnFactor();
}

/** Learning a spell: Magical Theory dice added to Sorcery (Core p. 132). */
export function learnExtraDice(theoryRating: number): number {
  return book('learning') ? Math.max(0, whole(theoryRating)) : urrMagLearnExtraDice(theoryRating);
}

/** Why this ritual can't go ahead (Core p. 135: no combat spells; team at most the lowest Sorcery), or null. */
export function ritualProblem(o: { category: string; sorcery: readonly number[] }): string | null {
  const urr = urrMagRitualProblem(o);
  if (urr || !book('ritualTeam')) return urr;
  if (String(o.category ?? '') === 'combat') return tx('SR2E.Text.Urr80Magic.combatSpellsCannotBeCast');
  if (o.sorcery.length) {
    const low = Math.max(0, Math.min(...o.sorcery.map(whole)));
    if (o.sorcery.length > low) return tCount(low, 'SR2E.Text.Urr80Magic.aRitualTeamCanHave', { size: o.sorcery.length });
  }
  return null;
}

/** Whether a hermetic ritual needs a hermetic circle (Core p. 135), the Revamp's switch or the book's. */
export function ritualNeedsCircle(): boolean {
  return Boolean(RULES.URR_V80.magRitualCircle) || book('ritualTeam');
}

/** Ritual materials in nuyen by category (Core p. 135), or null for the old per-Force cost. */
export function ritualMaterials(force: number, category: string): number | null {
  const urr = urrMagRitualMaterials(force, category);
  if (urr !== null || !book('ritualMaterials')) return urr;
  const per = Number(RULES.URR_V80.magRitualMaterialsPerForce[String(category ?? '').toLowerCase()] ?? 0) || 0;
  return Math.max(0, force) * per;
}

/** The TN a ritual spell is resisted against (Core p. 136): { resistTn } when the leader's Sorcery is higher. */
export function ritualResistTn(force: number, leaderSorcery: number): { resistTn?: number } {
  const urr = urrMagRitualResistTn(force, leaderSorcery);
  if (urr.resistTn !== undefined || !book('ritualResist')) return urr;
  const s = whole(leaderSorcery);
  return s > whole(force) ? { resistTn: s } : {};
}

/** Whether the ritual's astral spotter resists Drain (Core p. 135). */
export function spotterDrains(): boolean {
  return Boolean(RULES.URR_V80.magSpotterDrain) || book('ritualSpotter');
}

/** Raising a site (Core pp. 123–124): library rating² × price, circle an hour per rating; null = the old cost. */
export function siteCost(kind: string, from: number, to: number, perRating: number, daysPerRating: number): { nuyen: number; days: number } | null {
  const urr = urrMagSiteCost(kind, from, to, perRating, daysPerRating);
  if (urr || !book('siteCost')) return urr;
  const a = Math.max(0, whole(from)), b = Math.max(0, whole(to));
  const diff = Math.max(0, b - a);
  const nuyen = kind === 'library' ? Math.max(0, b * b - a * a) * perRating : diff * perRating;
  const days = kind === 'circle' ? Math.round((diff / 24) * 100) / 100 : diff * daysPerRating;
  return { nuyen, days };
}

// ---------------------------------------------------------------- Casting

/** Extra Force an exclusive or fetish spell takes effect at (Core p. 133); null when the old way ('v922') applies. */
export function restrictedForceBonus(o: { exclusive?: boolean; fetish?: boolean; expendable?: boolean }): number | null {
  if (!book('restrictedSpells')) return null;
  const f = S().restrictedForce;
  return (o.exclusive ? Math.max(0, whole(f.exclusive)) : 0) + (o.fetish ? Math.max(0, whole(o.expendable ? f.fetishExpendable : f.fetishReusable)) : 0);
}

/** Whether exclusive and fetish spells still change the Drain TN (the old way only). */
export function restrictedDrainMods(): boolean { return !book('restrictedSpells'); }

/** A ranged damaging manipulation's base TN (Core p. 130: 4), or null for the spell's own. */
export function elementalBaseTn(): number | null {
  const t = whole(S().elementalTn);
  return t > 0 ? t : null;
}

/** Successes a roll scores against another TN: dice whose total reaches it, plus successes bought; none on a botch. */
export function successesAt(dice: ReadonlyArray<Pick<DieResult, 'total'> | number>, tn: number, o: { bought?: number; botch?: boolean } = {}): number {
  if (o.botch) return 0;
  const t = Math.max(RULES.MIN_TARGET_NUMBER, whole(tn));
  return dice.filter((d) => (typeof d === 'number' ? d : Number(d?.total ?? 0)) >= t).length + Math.max(0, whole(o.bought));
}

/**
 * An area spell target's own successes (Core p. 130): the roll counted against the TN the card rolled, moved by the
 * difference between this target's resisting attribute and the attribute the card's TN started from.
 */
export function areaTargetSuccesses(o: { dice: ReadonlyArray<Pick<DieResult, 'total'>>; cardTn: number; cardBase: number; ownBase: number; bought?: number; botch?: boolean; modifiers?: ReadonlyArray<{ value: number }> }): number {
  // Review fix: with the card's modifiers, the target's own base plus them (then the minimum), so a card TN clamped at 2
  // doesn't move this target's TN by the clamp.
  const tn = Array.isArray(o.modifiers) ? whole(o.ownBase) + o.modifiers.reduce((n, m) => n + (Number.isFinite(Number(m?.value)) ? Math.trunc(Number(m.value)) : 0), 0)
    : whole(o.cardTn) + whole(o.ownBase) - whole(o.cardBase);
  return successesAt(o.dice, tn, { bought: o.bought, botch: o.botch });
}

/** Why a sustained spell can't be cast while projecting (Core p. 128), or null. */
export function sustainWhileProjectingProblem(o: { lasting: boolean; projecting: boolean; held: boolean }): string | null {
  if (!book('sustainProjecting') || !o.lasting || !o.projecting || o.held) return null;
  return tx('SR2E.Text.Sorcery923.noSustainingWhileProjecting');
}

/** Self-sustained spells (no focus, not quickened, not an elemental's) dropped when projection starts. */
export function dropOnProjecting<T extends { focusId?: string; quickened?: boolean; spiritUuid?: string }>(list: readonly T[]): { keep: T[]; dropped: T[] } {
  if (!book('sustainProjecting')) return { keep: [...list], dropped: [] };
  const keep: T[] = [], dropped: T[] = [];
  for (const s of list) (!s.focusId && !s.quickened && !s.spiritUuid ? dropped : keep).push(s);
  return { keep, dropped };
}

// ---------------------------------------------------------------- Learning and design

/** The learning test's extra TN for a formula with no teacher (Grimoire p. 114), as a modifier list. */
export function formulaAloneMods(o: { teacher: boolean; formula: boolean }): TargetNumberModifier[] {
  const v = whole(S().formulaAloneTn);
  return v && o.formula && !o.teacher ? [{ id: 'formulaNoTeacher', label: tx('SR2E.Card.Mod.formulaNoTeacher'), value: v }] : [];
}

const LEVELS: DamageLevel[] = ['L', 'M', 'S', 'D'];
const step = (l: DamageLevel, n: number): DamageLevel => LEVELS[Math.max(0, Math.min(3, LEVELS.indexOf(l) + n))]!;

/**
 * Book changes to a designed spell's drain (Grimoire pp. 117–121), applied on top of the old design (which leaves out
 * its area and sustained TN modifiers under 'book'): detection spells start at M, an area spell raises the level,
 * touch takes −1 level as well as −1 TN, a sustained detection, health or illusion spell adds +1 TN. Null when the
 * old design applies.
 */
export function bookDesignDrain(d: { category: string; area?: boolean; touch?: boolean; duration?: string }, old: { drainModifier: number; drainLevel: DamageLevel; notes: string[] }): { drainModifier: number; drainLevel: DamageLevel; notes: string[] } | null {
  if (!book('design')) return null;
  let mod = old.drainModifier;
  let level = old.drainLevel;
  const notes = [...old.notes];
  if (d.category === 'detection' && RULES.OCCULT.design.baseLevel.detection === 'L' && level === 'L') level = 'M';
  if (d.area) { level = step(level, 1); notes.push(tx('SR2E.Text.Sorcery923.areaLevel')); }
  if (d.touch) { level = step(level, -1); notes.push(tx('SR2E.Text.Sorcery923.touchLevel')); }
  if (d.duration === 'sustained' && ['detection', 'health', 'illusion'].includes(d.category)) { mod += 1; notes.push(tx('SR2E.Text.Sorcery923.sustainedTn')); }
  return { drainModifier: mod, drainLevel: level, notes };
}

/**
 * The design test the book's way (Grimoire p. 115): the effective Magical Theory (at most the site's rating; a higher
 * site adds 1 die per 2 points above and +50% time), TN 2 × Force − Magic + the drain modifier (min 2), and the
 * base days by drain level. Null when the old test applies.
 */
export function bookDesignTest(o: { force: number; magic: number; theory: number; siteRating: number; drainModifier: number; drainLevel: DamageLevel }): { dice: number; tn: number; baseDays: number } | null {
  if (!book('design')) return null;
  const skill = Math.max(0, whole(o.theory));
  const site = Math.max(0, whole(o.siteRating));
  const above = site > skill ? Math.floor((site - skill) / 2) : 0;
  const dice = site > 0 ? Math.min(skill, site) + above : skill;
  const tn = Math.max(RULES.MIN_TARGET_NUMBER, 2 * Math.max(1, whole(o.force)) - whole(o.magic) + whole(o.drainModifier));
  const base = Number(S().designDays[o.drainLevel] ?? S().designDays['M'] ?? 18) || 18;
  return { dice, tn, baseDays: above > 0 ? Math.ceil(base * 1.5) : base };
}

/** Days a design takes with these successes (null: failed). */
export function bookDesignDays(baseDays: number, successes: number): number | null {
  return successes > 0 ? Math.max(1, Math.ceil(baseDays / successes)) : null;
}

// ---------------------------------------------------------------- Foci and enchanting

/** Spell focus dice for the Drain test (both kinds) or for resisting a spell (category foci only). 0 under 'v922'. */
export function spellFocusDiceFor(foci: ReadonlyArray<{ focusType: string; active?: boolean; bonded?: boolean; rating: number; target?: string; category?: string }>, spell: { name?: string; category?: string }, use: 'drain' | 'resist'): number {
  if (!book('spellFocus')) return 0;
  const same = (a: unknown, b: unknown) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
  return (foci ?? []).filter((f) => f.focusType === 'spell' && f.active && f.bonded !== false && f.rating > 0)
    .filter((f) => (f.target ? use === 'drain' && same(f.target, spell.name) : Boolean(f.category) && same(f.category, spell.category)))
    .reduce((m, f) => Math.max(m, whole(f.rating)), 0);
}

/** Whether a spell lock holds a spell of any Force (Core p. 138). */
export function spellLockAnyForce(): boolean { return book('spellLock'); }

/** Bonding Karma for a weapon focus (Grimoire p. 27: 6 × rating), or null for the old small/large table. */
export function weaponFocusKarma(rating: number): number | null {
  const k = whole(S().weaponFocusKarma);
  return k > 0 ? Math.max(0, whole(rating)) * k : null;
}

/** The focus-making TN (Grimoire p. 25), or null for the old flat TN. */
export function enchantFocusTn(focusType: string, rating: number, specific: boolean): number | null {
  if (!book('enchanting')) return null;
  const t = S().enchantTn;
  if (focusType === 'sustaining') return Math.max(RULES.MIN_TARGET_NUMBER, whole(t.sustaining));
  const key = focusType === 'spell' ? (specific ? 'spellSpecific' : 'spellCategory') : focusType;
  const base = Number(t[key] ?? 6) || 6;
  return Math.max(RULES.MIN_TARGET_NUMBER, base + Math.max(0, whole(rating)));
}

/** The focus-making base days (Grimoire p. 25: 30), or null for the old task days. */
export function enchantFocusDays(): number | null {
  return book('enchanting') ? Math.max(1, whole(S().enchantDays)) : null;
}

/**
 * Focus addiction the book's way (Awakenings p. 103): after a failed Magic test, 2D6 ≤ Magic loses a point (not at
 * Magic 1 or less); 2 points lost this way bring the focus geas.
 */
export function focusAddictionLoss(o: { roll: number; magic: number; lostBefore: number }): { lost: number; geas: boolean } {
  const lost = whole(o.magic) > 1 && whole(o.roll) <= whole(o.magic) ? 1 : 0;
  return { lost, geas: whole(o.lostBefore) < 2 && whole(o.lostBefore) + lost >= 2 };
}

// ---------------------------------------------------------------- Ritual sorcery and wards

/** The ritual team's dice: the other members' Magic Pools (book), or null for the old ½ Sorcery. */
export function ritualPoolDice(memberPools: readonly number[]): number | null {
  if (!book('ritualPool')) return null;
  return memberPools.reduce((s, n) => s + Math.max(0, whole(n)), 0);
}

/** A ward the book's way (Grimoire p. 92, Grimoire II errata): Drain TN Force × successes, L, Stun; or null. */
export function bookWardDrain(force: number, successes: number): { drainTn: number; level: DamageLevel; type: 'stun' } | null {
  if (!book('ward')) return null;
  return { drainTn: Math.max(RULES.MIN_TARGET_NUMBER, Math.max(1, whole(force)) * Math.max(1, whole(successes))), level: 'L', type: 'stun' };
}

/** Why a ward of this Force is too strong for the leader (Force at most 2 × Magic), or null. */
export function bookWardForceProblem(force: number, magic: number): string | null {
  if (!book('ward')) return null;
  const cap = 2 * Math.max(0, whole(magic));
  return whole(force) > cap ? tx('SR2E.Text.Sorcery923.wardForceCap', { cap, magic: whole(magic) }) : null;
}

// ---------------------------------------------------------------- Initiation and metamagic

/**
 * The grade the next initiation reaches. Book (Grimoire p. 38): the first initiation makes a Grade 0 initiate (no Magic
 * added: Magic + grade); the next Grade 1, and so on. 'v922': the first is grade 1. The stored grade is the grade
 * itself (a Grade 0 initiate stores grade 0 and the `initiated` flag), so a character initiated before v0.92.3 keeps
 * the grade, and the Magic, it has.
 */
export function nextInitiationGrade(grade: number, initiated: boolean): number {
  const g = Math.max(0, whole(grade));
  return book('initiation') && g === 0 && !initiated ? 0 : g + 1;
}

/** Initiation's Good Karma rounded (Grimoire p. 38): down under 'book', up under 'v922'. */
export function roundInitiationKarma(raw: number): number {
  return Math.max(0, book('initiation') ? Math.floor(raw + 1e-9) : Math.ceil(raw - 1e-9));
}

/** Why an initiate can't dispel a spell of this Force (Grimoire p. 45: Force ≤ grade), or null. */
export function dispelGradeProblem(force: number, grade: number): string | null {
  if (!book('dispelling')) return null;
  const g = Math.max(0, whole(grade));
  return whole(force) > g ? tx('SR2E.Text.Sorcery923.dispelGrade', { force: whole(force), grade: g }) : null;
}

/** The dispelling TN (Grimoire p. 45): the higher of the Force and the Karma that quickened it. */
export function dispelTn(force: number, quickenKarma = 0): number {
  return Math.max(RULES.MIN_TARGET_NUMBER, whole(force), book('dispelling') ? whole(quickenKarma) : 0);
}

/** Force left after a dispelling test (every 2 successes take 1 off). */
export function dispelForce(forceBefore: number, successes: number): { remaining: number; dispelled: boolean } {
  const remaining = Math.max(0, whole(forceBefore) - Math.floor(Math.max(0, whole(successes)) / 2));
  return { remaining, dispelled: remaining <= 0 };
}

/** Penalty points a book centering test takes off (Grimoire p. 44): 1 per 2 successes, never more than the penalties. */
export function bookCenteringCut(successes: number, penaltyTotal: number): number {
  return Math.min(Math.floor(Math.max(0, whole(successes)) / 2), Math.max(0, whole(penaltyTotal)));
}

/** Geasa the book's way (Grimoire p. 52): +2 TN per broken (unmet) geas on non-astral magical tests. */
export function brokenGeasaMods(geasa: ReadonlyArray<{ met?: boolean }>): TargetNumberModifier[] {
  if (!book('geasa')) return [];
  const n = (geasa ?? []).filter((g) => g && g.met === false).length;
  return n ? [{ id: 'brokenGeasa', label: tx('SR2E.Card.Mod.brokenGeasa', { count: n }), value: 2 * n }] : [];
}

// ---------------------------------------------------------------- Elementals

/**
 * An elemental's aid the book's way (Core p. 141): `left` dice remain from the aid started earlier (0 = a new aid,
 * which costs a service and starts at its Force). Returns the dice used, what is left, and whether a service is due.
 */
export function elementalAidUse(o: { force: number; left: number; want?: number }): { dice: number; left: number; service: boolean; spent: boolean } {
  const fresh = !(whole(o.left) > 0);
  const pool = fresh ? Math.max(0, whole(o.force)) : whole(o.left);
  const want = o.want === undefined || o.want === null ? pool : Math.max(0, whole(o.want));
  const dice = Math.min(pool, want);
  const left = pool - dice;
  return { dice, left, service: fresh, spent: left <= 0 };
}

// ---------------------------------------------------------------- Detection range

/** A sense spell's range from the Force test (Core p. 128): successes × Magic metres. */
export function detectionRangeFromTest(successes: number, magic: number): number {
  return Math.max(0, whole(successes)) * Math.max(0, whole(magic));
}
