/**
 * v0.96.0 rules completeness, sorcery: pure functions over RULES.SORCERY_V96 (rules/config96/sorcery.ts). Each behaves
 * the book's way at the shipped value of its switch; at the other value it answers "nothing to do" and the caller keeps
 * the v0.95.1 code. No Foundry dependency. A refusal is a language key (`why`), never text.
 */
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';

const V = () => RULES.SORCERY_V96;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));
const on = (k: keyof typeof RULES.SORCERY_V96): boolean => V()[k] === 'book';
export const s96 = on;
const WHY = 'SR2E.Sorcery96.Why.';

/** A name compared the way the tables keep them: lower case, letters and digits only ("Mana Bolt" = "manabolt"). */
export function nameKey(name: unknown): string {
  return String(name ?? '').toLowerCase().replace(/\(spell\)/g, '').replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------- Defaulting a magical skill (Awakenings p. 93)

export interface MagicDefault { dice: number; tn: number; from: string }

/**
 * The best way to default Sorcery (Awakenings p. 93): to Magical Theory, Conjuring or Enchanting, or to Willpower, at
 * +2 TN (RULES.SKILLS.web.perStep) a step. `steps` are the GM's Skill Web distances where it links them (null: not
 * linked: the switch's own steps). v0.96.1: the most expected successes win (dice × the chance a die beats the cast's
 * TN, `baseTn` + the defaulting TN, sixes re-rolled), so 3 dice at +2 beat 4 dice at +8; on a tie the lower TN. Null
 * when the switch is off or nothing has dice.
 */
export function magicDefault(o: { ratings: Partial<Record<'magicalTheory' | 'conjuring' | 'enchanting', number>>; willpower: number; steps?: Partial<Record<string, number | null>>; baseTn?: number }): MagicDefault | null {
  if (!on('magicDefault')) return null;
  const per = Math.max(0, num(RULES.SKILLS?.web?.perStep, 2));
  const own = V().magicDefaultSteps;
  const opts: MagicDefault[] = [];
  const add = (from: string, dice: number) => {
    const web = o.steps?.[from];
    const steps = typeof web === 'number' && web > 0 ? web : whole(own[from] ?? 0);
    if (whole(dice) > 0 && steps > 0) opts.push({ dice: whole(dice), tn: steps * per, from });
  };
  for (const k of ['magicalTheory', 'conjuring', 'enchanting'] as const) add(k, num(o.ratings[k]));
  add('willpower', o.willpower);
  if (!opts.length) return null;
  const base = Math.max(2, whole(o.baseTn ?? 4));
  const expect = (d: MagicDefault) => d.dice * dieChance(base + d.tn);
  opts.sort((a, b) => expect(b) - expect(a) || a.tn - b.tn || b.dice - a.dice);
  return opts[0]!;
}

/** The chance one die reaches `tn` (SR2's Rule of Six: a six is rolled again and added). */
export function dieChance(tn: number): number {
  const t = Math.floor(Number(tn) || 0);
  if (t <= 1) return 1;
  if (t <= 6) return (7 - t) / 6;
  return dieChance(t - 6) / 6;
}

/** The defaulting row for the casting test's modifiers. */
export function magicDefaultMod(d: MagicDefault): TargetNumberModifier {
  return { id: 'defaulting96', label: tx('SR2E.Sorcery96.Mod.defaulting', { from: tKey(`SR2E.Sorcery96.From.${d.from}`) }), value: d.tn };
}

// ---------------------------------------------------------------- Area spells, stacking, noticing (Core pp. 129–132)

/**
 * Shaping an area spell's radius (Core p. 130): `metres` < 0 shrinks it (2 dice withheld a metre), > 0 grows it (a die
 * a metre); at most the Force in dice. Null with the switch off or no change.
 */
export function areaShape(o: { force: number; radius: number; metres: number }): { withheld: number; radius: number } | { why: string } | null {
  if (!on('areaShape')) return null;
  const m = Math.trunc(num(o.metres));
  if (!m) return null;
  const withheld = m > 0 ? m : -2 * m;
  if (withheld > whole(o.force)) return { why: `${WHY}areaTooMuch` };
  const radius = num(o.radius) + m;
  if (radius < 0) return { why: `${WHY}areaBelowZero` };
  return { withheld, radius };
}

/** The most metres an area spell of this Force can grow and shrink by (the Cast window's limits). */
export function areaShapeLimits(force: number, radius: number): { grow: number; shrink: number } {
  if (!on('areaShape')) return { grow: 0, shrink: 0 };
  return { grow: whole(force), shrink: Math.min(Math.floor(whole(force) / 2), Math.max(0, Math.floor(num(radius)))) };
}

/** Spell stacking (Core p. 129): `others` more spells in the same action: + stackTn each, on the casting and the Drain. */
export function stackMods(others: number): TargetNumberModifier[] {
  if (!on('stacking')) return [];
  const n = Math.min(10, whole(others));
  return n > 0 ? [{ id: 'stacked96', label: tx('SR2E.Sorcery96.Mod.stacked', { count: n }), value: n * num(V().stackTn, 2) }] : [];
}

/** Noticing spellcasting (Core p. 132): onlookers' Perception TN, twice |Magic − Force|, at least noticeMinTn. Null when off. */
export function noticeTn(magic: number, force: number): number | null {
  if (!on('noticing')) return null;
  return Math.max(whole(V().noticeMinTn), 2 * Math.abs(whole(magic) - whole(force)));
}

// ---------------------------------------------------------------- Foci (Core p. 137)

/** Switching on one more focus with `active` already on (Core p. 137: at most Intelligence). */
export function fociLimit(active: number, intelligence: number): { refuse: boolean; why: string } | null {
  const mode = V().fociLimit;
  if (mode === 'off') return null;
  if (whole(active) + 1 <= whole(intelligence)) return null;
  return { refuse: mode === 'book', why: `${WHY}fociLimit` };
}

// ---------------------------------------------------------------- The Armor spell (Core p. 158)

/** Successes per step of a spell's effect: 2 for the half-success spells (Armor), else `step`. */
export function effectStep(spellName: unknown, step: number): number {
  if (!on('armorSpell')) return step;
  const k = nameKey(spellName);
  return (V().halfSuccessSpells ?? []).map(nameKey).includes(k) && k ? 2 : step;
}

// ---------------------------------------------------------------- Wards (Grimoire p. 92)

export const DAY_SECONDS = 86400;

/** When a ward raised now with `days` falls (world seconds); 0 = no ending kept (switch off, no days). */
export function wardEndsAt(now: number, days: number): number {
  if (V().wardExpiry === 'off' || !(whole(days) > 0)) return 0;
  return num(now) + whole(days) * DAY_SECONDS;
}

/** Whether a ward ending at `ends` has fallen by `now`, and whether its rating goes to 0 ('book') or a card only. */
export function wardFalls(ends: number, now: number): { fall: boolean; lower: boolean } {
  const mode = V().wardExpiry;
  if (mode === 'off' || !(num(ends) > 0) || num(now) < num(ends)) return { fall: false, lower: false };
  return { fall: true, lower: mode === 'book' };
}

// ---------------------------------------------------------------- Quickening (Grimoire pp. 44–45)

/** The Karma that may be paid to quicken a spell of this Force: the Force up to twice the Force. */
export function quickenKarma(force: number, asked: number): { karma: number } | { why: string } {
  const f = Math.max(1, whole(force));
  const k = whole(asked) || f;
  if (k < f || k > 2 * f) return { why: `${WHY}quickenKarma` };
  return { karma: k };
}

/** The actions to sustain: the dice of the Spell Success Test ÷ the successes (round up, at least 1); none: twice the dice. */
export function quickenActions(baseDice: number, successes: number): number {
  const b = Math.max(1, whole(baseDice));
  const s = whole(successes);
  return s > 0 ? Math.max(1, Math.ceil(b / s)) : 2 * b;
}

/**
 * The quickening's base: the casting test's dice and TN. Stored on the sustaining entry at the cast (`castDice96`,
 * `castTn96`) they win; an older entry takes what was asked, no fewer dice than the Sorcery rating and no lower TN than
 * the spell's own (4 when unknown).
 */
export function quickenBase(o: { storedDice?: number; storedTn?: number; askedDice?: number; askedTn?: number; sorcery: number; spellTn?: number }): { dice: number; tn: number } {
  if (whole(o.storedDice) > 0 && whole(o.storedTn) > 0) return { dice: Math.min(99, whole(o.storedDice)), tn: Math.max(2, Math.min(99, whole(o.storedTn))) };
  const minTn = Math.max(2, whole(o.spellTn) || 4);
  return { dice: Math.min(99, Math.max(1, whole(o.sorcery), whole(o.askedDice))), tn: Math.min(99, Math.max(minTn, whole(o.askedTn))) };
}

/** The quickening test's dice: Sorcery + the initiate grade (Grimoire p. 44). */
export function quickenDice(sorcery: number, grade: number): number { return whole(sorcery) + whole(grade); }

// ---------------------------------------------------------------- Anchoring (Grimoire p. 47)

/** Preparing an object to anchor a spell: Karma, the Enchanting TN and the base minutes. */
export function anchorPrep(force: number, links: number): { karma: number; tn: number; minutes: number } | null {
  if (!on('anchoring')) return null;
  const f = whole(force), l = whole(links);
  return { karma: f + l, tn: Math.max(2, Math.floor(f / 2) + l), minutes: Math.max(1, f + l) };
}

/** The preparing time: the base minutes ÷ the successes (none: the base time; the object is prepared anyway). */
export function anchorMinutes(base: number, successes: number): number {
  const s = whole(successes);
  return s > 0 ? Math.max(1, Math.ceil(whole(base) / s)) : whole(base);
}

// ---------------------------------------------------------------- Masking (Grimoire p. 46)

/**
 * Seeing through an initiate's masking: only an initiate may try; the successes needed are the subject's grade less
 * the viewer's, at least 1. Null with the switch off; `can` false for a viewer who isn't an initiate.
 */
export function maskThreshold(o: { subjectGrade: number; viewerGrade: number; viewerInitiate: boolean }): { can: boolean; need: number } | null {
  if (!on('masking')) return null;
  return { can: Boolean(o.viewerInitiate), need: Math.max(1, whole(o.subjectGrade) - whole(o.viewerGrade)) };
}

/** Whether the masking covers the subject's active foci (rating points up to the grade). */
export function maskCoversFoci(fociRating: number, grade: number): boolean { return whole(fociRating) <= whole(grade); }

// ---------------------------------------------------------------- Centering (Grimoire p. 43)

export type CenterUse = 'cast' | 'drain';
export function centerUse(v: unknown): CenterUse | null {
  if (!on('centeringUse')) return null;
  return v === 'cast' || v === 'drain' ? v : null;
}

/** Successes a centering test adds: 1 per 2, only to a test that got at least one success itself. */
export function centeringBonus(centerSuccesses: number, testSuccesses: number): number {
  return whole(testSuccesses) > 0 ? Math.floor(whole(centerSuccesses) / 2) : 0;
}

/**
 * A test's successes with centering's kept on the card (`center96`, already halved): added only while the dice
 * themselves (`natural`, not counting bought successes) score at least one (Grimoire p. 43), never on a botch.
 */
export function withCenter(natural: number, center96: unknown, botch = false): number {
  const n = whole(natural);
  return n > 0 && !botch ? n + Math.min(30, whole(center96)) : n;
}

// ---------------------------------------------------------------- Totem dice as Magic Pool dice (Core p. 119)

export interface TotemSplit { castFree: number; drainFree: number; castSpend: number; drainSpend: number }

/**
 * The cast's pool dice with a totem modifier as pool dice (Core p. 119): a bonus pays for the first dice asked (the
 * casting test's first, then the Drain's) without spending the pool; a penalty leaves fewer pool dice for this cast.
 * Null with the switch off or no modifier.
 */
export function totemPool(o: { totem: number; cast: number; drain: number; left: number }): TotemSplit | null {
  const t = Math.trunc(num(o.totem));
  if (!on('totemPool') || !t) return null;
  let cast = whole(o.cast), drain = whole(o.drain);
  const left = whole(o.left);
  if (t > 0) {
    // Nothing asked (a macro, a quick cast): the totem's dice go to the casting test.
    if (cast + drain === 0) return { castFree: t, drainFree: 0, castSpend: 0, drainSpend: 0 };
    const castFree = Math.min(t, cast);
    const drainFree = Math.min(t - castFree, drain);
    const castSpend = Math.min(left, cast - castFree);
    return { castFree, drainFree, castSpend, drainSpend: Math.min(left - castSpend, drain - drainFree) };
  }
  const avail = Math.max(0, left + t);
  cast = Math.min(cast, avail);
  drain = Math.min(drain, avail - cast);
  return { castFree: 0, drainFree: 0, castSpend: cast, drainSpend: drain };
}

/** The pool dice the Cast window may offer with this totem modifier. */
export function totemPoolMax(totem: number, left: number): number {
  const t = Math.trunc(num(totem));
  if (!on('totemPool') || !t) return whole(left);
  return Math.max(0, whole(left) + t);
}

// ---------------------------------------------------------------- Drain codes (Core pp. 151–159)

/**
 * The core spells' drain codes (Core pp. 151–158, the Table of Spells p. 159): modifier to Force ÷ 2, and the level.
 * Mechanics only. Spells whose level depends on the wound or the attribute (Heal, Treat, Increase Attribute,
 * Antidote...) are left out.
 */
export const DRAIN_CODES_V96: Readonly<Record<string, readonly [number, DamageLevel]>> = {
  fireball: [3, 'D'], hellblast: [6, 'D'], manabolt: [0, 'S'], manadart: [0, 'L'], manamissile: [0, 'M'], manaball: [0, 'S'],
  powerbolt: [1, 'S'], powerdart: [1, 'L'], powermissile: [1, 'M'], powerball: [1, 'S'], ram: [1, 'S'], sleep: [-1, 'S'],
  analyzedevice: [1, 'M'], analyzetruth: [0, 'S'], clairaudience: [0, 'M'], clairvoyance: [0, 'M'], combatsense: [1, 'S'],
  detectlifeform: [-1, 'L'], detectobject: [1, 'M'], detectenemies: [1, 'M'], detectindividual: [0, 'L'], detectlife: [0, 'L'],
  mindprobe: [2, 'D'], personalcombatsense: [1, 'M'],
  chaos: [2, 'M'], chaoticworld: [2, 'S'], confusion: [0, 'S'], entertainment: [1, 'L'], improvedinvisibility: [1, 'M'],
  invisibility: [0, 'M'], mask: [0, 'L'], stimulation: [1, 'L'], stink: [1, 'S'],
  armor: [2, 'M'], barrier: [2, 'S'], controlactions: [2, 'S'], controlemotion: [2, 'M'], controlthoughts: [2, 'D'],
  flamebomb: [1, 'D'], flamethrower: [1, 'S'], hibernate: [0, 'S'], icesheet: [1, 'S'], ignite: [2, 'D'], levitateitem: [1, 'L'],
  levitateperson: [1, 'M'], light: [2, 'M'], magicfingers: [2, 'M'], manabarrier: [1, 'S'], poltergeist: [1, 'S'], shadow: [2, 'M'],
  spark: [1, 'M'],
};

/** A spell's book drain code by name, or null (not in the table, or the switch off). */
export function bookDrain(name: unknown): { modifier: number; level: DamageLevel } | null {
  if (!on('drainTable')) return null;
  const row = DRAIN_CODES_V96[nameKey(name)];
  return row ? { modifier: row[0], level: row[1] } : null;
}

// ---------------------------------------------------------------- Dispelling's effect (Grimoire p. 45)

/**
 * A dispelled spell's effect spec at its new Force: the per-success cap follows the Force (a dispel re-roll that gives
 * Force back raises it again). Null when nothing changes (switch off, no cap kept, the same Force, or broken).
 */
export function dispelledSpec<T extends { capAt?: number; perSuccess?: boolean }>(spec: T | null | undefined, newForce: number): T | null {
  if (!on('dispelEffect') || !spec) return null;
  const cap = num(spec.capAt);
  const f = whole(newForce);
  if (!(cap > 0) || f === cap || f <= 0) return null;
  return { ...spec, capAt: f };
}

// ---------------------------------------------------------------- Grade 0 by hand (Grimoire pp. 37–38)

/** Whether the sheet shows the "Initiated (Grade 0)" tick for this grade. */
export function showGradeZero(grade: number): boolean {
  return on('gradeZero') && RULES.SORCERY_V923.initiation === 'book' && whole(grade) === 0;
}
