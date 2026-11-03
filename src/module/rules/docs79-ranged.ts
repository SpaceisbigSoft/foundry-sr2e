/**
 * v0.79.0 (ranged): the verified fixes, pure rules side. Each function reads its switch in RULES.DOCS_V79 (see
 * rules/config79-ranged.ts for the rules and their official sources) and gives the old behaviour when the switch is
 * set to the old way. No Foundry dependency. Imports only config and damage (firing.ts and weapons.ts import this
 * file for recoil and Strength ranges, so it must not import them).
 */
import { RULES, type DamageLevel } from './config.ts';
import { stageUp } from './damage.ts';
import { t as tx } from '../helpers/i18n.ts';

const D = () => RULES.DOCS_V79;
const num = (x: unknown): number => { const v = Number(x); return Number.isFinite(v) ? v : 0; };

type Limits = { short: number; medium: number; long: number; extreme: number };

// ---------------------------------------------------------------- reloading (SRII pp. 81–83, action chart)

/**
 * The action kind a reload spends (RULES.ACTIONS.costs): 'actions' — a clip is Remove + Insert (two Simple Actions,
 * 'reload:clip'), one Simple Action with a smartgun (it ejects the clip as a Free Action), anything else is a Complex
 * Action ('reload:complex'); 'oneSimple' — 'reload' (one Simple Action) for everything (old).
 */
export function reloadActionKind(feed: string | null | undefined, o: { smartgun?: boolean } = {}): 'reload' | 'reload:clip' | 'reload:complex' {
  if (D().rangedReload !== 'actions') return 'reload';
  const f = String(feed || 'clip');
  if (f === 'clip') return o.smartgun ? 'reload' : 'reload:clip';
  return 'reload:complex';
}

/** A short label for the reload's action cost (for the notification / tooltip). */
export function reloadActionLabel(kind: string): string {
  return kind === 'reload:clip' ? tx('SR2E.Text.Docs79Ranged.twoSimpleActionsRemove') : kind === 'reload:complex' ? tx('SR2E.Text.Docs79Ranged.aComplexAction') : tx('SR2E.Text.Docs79Ranged.aSimpleAction');
}

// ---------------------------------------------------------------- Combat Pool cap on offence (SRII p. 83)

/**
 * Combat Pool dice usable on an offensive test: 'skill' — at most the rating of the skill rolled (never below 0);
 * 'none' — as asked (the caller still clamps to what is left in the pool). Resistance tests never call this.
 */
export function offensivePoolDice(requested: number, skillRating: number): number {
  const want = Math.max(0, Math.floor(num(requested)));
  if (D().rangedPoolCap !== 'skill') return want;
  return Math.min(want, Math.max(0, Math.floor(num(skillRating))));
}

// ---------------------------------------------------------------- Strength ranges (SRII Weapon / Grenade Range Tables)

const DEFAULT_MULT: Limits = { short: 1, medium: 2, long: 3, extreme: 5 };
const sameLimits = (a: Partial<Limits> | null | undefined, b: Limits): boolean =>
  Boolean(a) && (['short', 'medium', 'long', 'extreme'] as const).every((k) => num(a![k]) === b[k]);

/** v0.81.1 (SEC2b-8): each row's pattern compiled once; a house-rule pattern that doesn't compile is null (skipped). */
const ROW_RE = new Map<string, RegExp | null>();
function rowRegExp(match: unknown): RegExp | null {
  const src = String(match ?? '');
  if (!ROW_RE.has(src)) {
    let re: RegExp | null = null;
    try { re = src ? new RegExp(src, 'i') : null; } catch { re = null; }
    ROW_RE.set(src, re);
  }
  return ROW_RE.get(src)!;
}

/**
 * The book's Strength-range row a weapon name matches (RULES.DOCS_V79.rangedStrengthRows, first match), or null.
 * v0.81.1 (SEC2b-8): a house-rule row that isn't an object, or whose pattern doesn't compile, is skipped, not thrown on.
 */
export function bookStrengthRow(name: string | null | undefined): Limits | null {
  const n = String(name ?? '');
  if (!n) return null;
  const rows = D().rangedStrengthRows;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== 'object') continue;
    if (rowRegExp(r.match)?.test(n)) return { short: r.short, medium: r.medium, long: r.long, extreme: r.extreme };
  }
  return null;
}

/**
 * The Strength multipliers to use: 'book' — the item's own, unless they are still the shipped default (1/2/3/5) and
 * its name matches a book row, then that row; 'item' — the item's own (old). `fallback` is RULES.COMBAT.strengthRange.
 */
export function strengthRangeMultipliers(w: { strengthRangeMultipliers?: Partial<Limits> | null }, name: string | null | undefined, fallback: Limits = DEFAULT_MULT): Limits {
  const own = w.strengthRangeMultipliers;
  const base: Limits = {
    short: num(own?.short ?? fallback.short), medium: num(own?.medium ?? fallback.medium),
    long: num(own?.long ?? fallback.long), extreme: num(own?.extreme ?? fallback.extreme),
  };
  if (D().rangedStrengthRange !== 'book') return base;
  if (own && !sameLimits(own, fallback) && !sameLimits(own, DEFAULT_MULT)) return base;
  return bookStrengthRow(name) ?? base;
}

// ---------------------------------------------------------------- recoil (SRII Ranged Combat Modifiers Table)

/**
 * Free (uncounted) rounds in the phase's recoil: 'book' — 1 when the phase's first shot was a single shot (SA's
 * second shot is +1; bursts and full auto count every round), else 0; 'freeFirst' — RULES.FIRING.recoilFreeRounds
 * (old). `firstShotSingle` unknown: with no earlier rounds this shot decides (one round = single); after earlier
 * rounds, assume a single first shot (the old count).
 */
export function recoilFreeRounds(o: { rounds: number; earlierRoundsThisPhase?: number; firstShotSingle?: boolean }): number {
  if (D().rangedRecoil !== 'book') return RULES.FIRING.recoilFreeRounds;
  return firstShotWasSingle(o) ? 1 : 0;
}

/** Whether the phase's first shot was a single shot (stored with the recoil record by the caller). */
export function firstShotWasSingle(o: { rounds: number; earlierRoundsThisPhase?: number; firstShotSingle?: boolean }): boolean {
  if (typeof o.firstShotSingle === 'boolean') return o.firstShotSingle;
  return Math.max(0, num(o.earlierRoundsThisPhase)) > 0 ? true : Math.max(0, num(o.rounds)) === 1;
}

// ---------------------------------------------------------------- flechette (SRII p. 93)

/** Whether planAttack leaves the flechette stage to the soak (switch 'armor' and a flechette round). */
export function flechetteAtSoak(ammoId: string | null | undefined): boolean {
  const f = D().rangedFlechette;
  return f.mode === 'armor' && f.ammoIds.includes(String(ammoId ?? ''));
}

/**
 * Flechette against this target's armor (call only when flechetteAtSoak was true for the attack): no ballistic or
 * impact armor at all (dermal included) — the level stages up one and no armor counts; otherwise no stage, and the
 * armor is the higher of the two ratings × armorMultiplier.
 */
export function flechetteSoak(o: { ballistic: number; impact: number; level: DamageLevel }): { level: DamageLevel; armor: number; armored: boolean; note: string } {
  const b = Math.max(0, Math.floor(num(o.ballistic))), i = Math.max(0, Math.floor(num(o.impact)));
  const armored = b > 0 || i > 0;
  if (!armored) return { level: stageUp(o.level, 1), armor: 0, armored, note: tx('SR2E.Text.Docs79Ranged.flechetteVsNoArmor') };
  const m = Math.max(0, num(D().rangedFlechette.armorMultiplier));
  const best = Math.max(b, i);
  return { level: o.level, armor: Math.floor(best * m), armored, note: b >= i ? tx('SR2E.Text.Docs79Ranged.flechetteVsArmorBallistic', { best, m }) : tx('SR2E.Text.Docs79Ranged.flechetteVsArmorImpact', { best, m }) };
}

// ---------------------------------------------------------------- grenade scatter (SRII Grenade Range Table)

export type ScatterType = 'standard' | 'aerodynamic' | 'launcher';

/**
 * A blast weapon's grenade type for scatter: thrown (Throwing skill or `thrown`) → 'aerodynamic' when its name says
 * "aero", else 'standard'; a launcher (Launch Weapons skill or "launcher" in the name) firing a grenade → 'launcher';
 * rockets, missiles and demolition charges → null (they keep the range-band dice).
 */
export function grenadeScatterType(w: { blastKind?: string | null; skill?: string | null; name?: string | null; thrown?: boolean }): ScatterType | null {
  const kind = String(w.blastKind ?? '');
  if (/rocket/i.test(kind) || kind === 'demolition') return null;
  const skill = String(w.skill ?? ''), name = String(w.name ?? '');
  if (w.thrown || /throw/i.test(skill)) return /aero/i.test(name) ? 'aerodynamic' : 'standard';
  if (/launch/i.test(skill) || /launcher/i.test(name)) return /missile|rocket/i.test(name) ? null : 'launcher';
  return null;
}

/** Scatter dice: 'byType' and a grenade type — the type's dice; otherwise the old range-band dice (`byRange`). */
export function scatterDiceV79(type: ScatterType | null | undefined, byRange: number): number {
  const s = D().rangedScatter;
  if (s.mode !== 'byType' || !type) return byRange;
  return Math.max(0, Math.floor(num(s.scatterDice[type] ?? byRange)));
}

// ---------------------------------------------------------------- surprise (SRII p. 86)

/** Whether the surprise test sets a turn order by successes ('order') instead of costing the losers a pass. */
export function surpriseByOrder(): boolean {
  return D().rangedSurprise.mode === 'order';
}

/** The surprise turn's initiative score for a number of successes: successes + 1, at most maxScore (one pass). */
export function surpriseInitiative(successes: number): number {
  const cap = Math.max(1, Math.floor(num(D().rangedSurprise.maxScore)) || 10);
  return Math.min(cap, Math.max(0, Math.floor(num(successes))) + 1);
}

/** Target limit in the surprise turn: nobody may act against an opponent who rolled more successes. */
export function surpriseMayTarget(attackerSuccesses: number, targetSuccesses: number): boolean {
  return Math.floor(num(attackerSuccesses)) >= Math.floor(num(targetSuccesses));
}

/**
 * The surprise turn's target check: given the stored successes by combatant id, the attacker's combatant id and the
 * targets' (missing ids = not in the surprise test, never blocked), the target ids out of reach. Only while `active`
 * (the surprise turn: the flag's round, first pass) and in 'order' mode.
 */
export function surpriseBlockedTargets(o: { active: boolean; successes: Record<string, number>; attackerId: string | null; targetIds: readonly string[] }): string[] {
  if (!surpriseByOrder() || !o.active || !o.attackerId || !(o.attackerId in o.successes)) return [];
  const mine = num(o.successes[o.attackerId]);
  return o.targetIds.filter((t) => t in o.successes && !surpriseMayTarget(mine, num(o.successes[t])));
}
