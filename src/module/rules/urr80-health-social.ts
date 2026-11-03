/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: health-social): pure functions. Each reads its switch in
 * RULES.URR_V80 (config80-health-social.ts) and behaves the book way while the switch is at its shipped value.
 * Functions returning null under the book leave the caller's existing (book) path in charge.
 */
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { woundModifier, stageUp, type Monitor } from './damage.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

const U = () => RULES.URR_V80;
const NEXT_DOWN: Record<DamageLevel, DamageLevel | null> = { D: 'S', S: 'M', M: 'L', L: null };

/** The worst wound level on a track (as core.ts woundLevel; kept here so core.ts can import this file). */
function levelOf(boxes: number): DamageLevel | null {
  const b = RULES.BOXES_PER_LEVEL;
  if (boxes >= b.D) return 'D';
  if (boxes >= b.S) return 'S';
  if (boxes >= b.M) return 'M';
  if (boxes >= b.L) return 'L';
  return null;
}

// ---------------------------------------------------------------- Death and bleeding

/** Boxes past a full Overflow row before death: 1 under the Revamp (dead only beyond 10 + Body), 0 under the book. */
export function deathBoxExtra(): number {
  return U().hsDeathPastOverflow ? 1 : 0;
}

/** Combat Turns per box while dying: the Revamp's minutes of game time, else the book's (Body) turns. */
export function bleedTurnsPerBox(body: number): number {
  const min = Number(U().hsBleedMinutes) || 0;
  if (min > 0) return Math.max(1, Math.round((min * 60) / Math.max(1, Number(RULES.COMBAT_TURN_SECONDS) || 3)));
  const per = RULES.CONDITIONS.dying.turnsPerBox;
  return per === 'body' ? Math.max(1, Math.floor(Number(body) || 0)) : Math.max(1, Number(per));
}

/** v0.82.0: how often a dying character loses another box, for the sheet and the Effects tab ("every 4 Combat Turns",
 * "every 10 minutes of game time"), following the book's rule, its house rule and the Revamp alike. */
export function bleedEveryText(body: number): string {
  const min = Number(U().hsBleedMinutes) || 0;
  if (min > 0) return tCount(min, 'SR2E.Text.Urr80HealthSocial.everyMinutesOfGameTime');
  const per = bleedTurnsPerBox(body);
  return tCount(per, 'SR2E.Text.Urr80HealthSocial.everyCombatTurns');
}

/** The "is dying" card's line under the Revamp; '' under the book (the caller keeps its own text). */
export function bleedRateText(): string {
  const min = Number(U().hsBleedMinutes) || 0;
  return min > 0 ? tx('SR2E.Text.Urr80HealthSocial.loses1MorePhysicalBox', { min }) : '';
}

/** Self-stabilisation after failed first aid: natural Body vs 10, no modifiers. Null under the book (no test). */
export function selfStabiliseTest(naturalBody: number): { dice: number; tn: number } | null {
  if (!U().hsSelfStabilise) return null;
  return { dice: Math.max(0, Math.floor(Number(naturalBody) || 0)), tn: Math.max(2, Math.floor(Number(U().hsSelfStabiliseTn) || 10)) };
}

type ItemLike = { type?: string; name?: string; system?: Record<string, any> };

/** Dermal armor and blood filters that hinder a trauma patch: their ratings as TN modifiers. */
export function traumaPatchInhibitors(items: Iterable<ItemLike> | null | undefined): TargetNumberModifier[] {
  const out: TargetNumberModifier[] = [];
  for (const it of items ?? []) {
    const s = it?.system ?? {};
    if (it?.type !== 'cyberware' || s['installed'] === false) continue;
    if (s['kind'] === 'filtration' && s['filterKind'] === 'blood' && Number(s['rating']) > 0) out.push({ label: `${it.name ?? tx('SR2E.Card.Urr80HealthSocial.bloodFilter')}`, value: Math.floor(Number(s['rating'])) });
    else if (!s['bioware'] && s['kind'] !== 'cyberlimb' && Number(s['armorBallistic'] ?? 0) > 0) out.push({ label: `${it.name ?? tx('SR2E.Card.Urr80HealthSocial.dermalArmor')}`, value: Math.floor(Number(s['armorBallistic'])) });
  }
  return out;
}

/** A trauma patch's self-stabilisation test (natural Body vs 4 + dermal armor / blood filter). Null under the book (it just stabilises). */
export function traumaPatchTest(naturalBody: number, items: Iterable<ItemLike> | null | undefined): { dice: number; tn: number; modifiers: TargetNumberModifier[] } | null {
  if (U().hsTraumaPatch !== 'bodyTest') return null;
  return { dice: Math.max(0, Math.floor(Number(naturalBody) || 0)), tn: Math.max(2, Math.floor(Number(U().hsTraumaPatchTn) || 4)), modifiers: traumaPatchInhibitors(items) };
}

// ---------------------------------------------------------------- Stun recovery

/**
 * The Stun recovery test under the Revamp: the higher of Body and Willpower vs 2 + the wound modifiers (both tracks),
 * no care rows. Null under the book (Body vs the wound's TN, no wound modifiers).
 */
export function stunRecoveryTest(o: { body: number; willpower: number; monitor: Monitor }): { attribute: 'body' | 'willpower'; tn: number; modifiers: TargetNumberModifier[] } | null {
  if (U().hsStunRecovery !== 'urr') return null;
  const attribute = Number(o.willpower) > Number(o.body) ? 'willpower' : 'body';
  const w = woundModifier({ physical: Number(o.monitor?.physical) || 0, stun: Number(o.monitor?.stun) || 0 });
  return { attribute, tn: Math.max(2, Math.floor(Number(U().hsStunRecoveryTn) || 2)), modifiers: w ? [{ id: 'wounds', label: tx('SR2E.Card.Mod.wounds'), value: w }] : [] };
}

// ---------------------------------------------------------------- First aid

/** Whether first aid lowers the wound one level (the Revamp) rather than healing boxes (the book). */
export function firstAidByLevel(): boolean {
  return U().hsFirstAid === 'level';
}

/** A Deadly Physical wound that first aid can only stabilise (Revamp); false under the book. */
export function firstAidDeadlyOnly(track: 'physical' | 'stun' | string, boxes: number): boolean {
  return firstAidByLevel() && track !== 'stun' && levelOf(Math.floor(Number(boxes) || 0)) === 'D';
}

/**
 * The boxes first aid takes off under the Revamp: the wound drops to the lowest box of the next level down (Light
 * clears); a Deadly Physical wound none (stabilise only). Null under the book (1 box per success, at most half).
 */
export function firstAidLevelBoxes(boxes: number, track: 'physical' | 'stun' | string = 'physical'): number | null {
  if (!firstAidByLevel()) return null;
  const b = Math.max(0, Math.floor(Number(boxes) || 0));
  const level = levelOf(b);
  if (!level) return 0;
  if (firstAidDeadlyOnly(track, b)) return 0;
  const next = NEXT_DOWN[level];
  return b - (next ? Math.min(b, RULES.BOXES_PER_LEVEL[next]) : 0);
}

/** The treatment time in minutes (base by level ÷ successes, round up); null under the book, for Deadly, or no successes. */
export function firstAidMinutes(boxes: number, successes: number): number | null {
  if (!U().hsFirstAidTime || !(successes > 0)) return null;
  const level = levelOf(Math.floor(Number(boxes) || 0));
  if (!level || level === 'D') return null;
  const base = Number(U().hsFirstAidMinutes[level]) || 0;
  return base > 0 ? Math.ceil(base / successes) : null;
}

/** Whether a healer may try first aid again on a wound already treated: a higher Biotech than the best before (Revamp). */
export function firstAidRetryAllowed(previousBest: number | null | undefined, mine: number): boolean {
  if (!U().hsFirstAidRetry || typeof previousBest !== 'number') return false;
  return Math.floor(Number(mine) || 0) > previousBest;
}

/** Whether first aid on a magician without the +2 "patient is a magician" modifier calls for a Magic loss test (Revamp). */
export function magicLossOnTreatment(o: { magician: boolean; applyMagician?: boolean }): boolean {
  return Boolean(U().hsMagicLossUntreated) && Boolean(o.magician) && o.applyMagician === false;
}

/** A Deadly wound's healing stage outside intensive care (Revamp): the reason it can't be rolled; null when it can. */
export function deadlyNeedsIntensive(boxes: number, care: string): string | null {
  if (!U().hsDeadlyIntensive) return null;
  if (levelOf(Math.floor(Number(boxes) || 0)) !== 'D' || (care || 'none') === 'intensive') return null;
  return tx('SR2E.Text.Urr80HealthSocial.aDeadlyWoundHealsOnly');
}

// ---------------------------------------------------------------- Drugs

/**
 * An overdose's Power and level under the Revamp: the second dose (one active) stages the level up one; each dose
 * after adds +1 Power. Null under the book. `dosesBefore`: doses already active.
 */
export function overdoseStats(basePower: number, level: DamageLevel, dosesBefore: number): { power: number; level: DamageLevel } | null {
  if (U().hsOverdose !== 'urr') return null;
  const n = Math.max(0, Math.floor(Number(dosesBefore) || 0));
  if (n <= 0) return null;
  return { power: Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(Number(basePower) || 0) + (n - 1)), level: stageUp(level, 1) };
}

// ---------------------------------------------------------------- Physical feats

/** Combat Turns a character holds their breath before drowning or suffocation tests count (Revamp); 0 under the book. */
export function breathHoldTurns(body: number): number {
  if (!U().hsBreathHold) return 0;
  const secs = Math.max(0, Math.floor(Number(body) || 0)) * Math.max(0, Number(U().hsBreathSecondsPerBody) || 0);
  return Math.floor(secs / Math.max(1, Number(RULES.COMBAT_TURN_SECONDS) || 3));
}

/** Fitness = (Strength + Quickness) ÷ 2, round down. */
export function fitness(strength: number, quickness: number): number {
  return Math.max(0, Math.floor(((Number(strength) || 0) + (Number(quickness) || 0)) / 2));
}

/**
 * Metres an athletics test covers under the Revamp: climbing 1 m per success, at most Fitness; jumping Fitness × 0.5
 * standing or × 1 running (round up), +1 Fitness per 2 successes; swimming a quarter of the walking (or running)
 * speed with +1 Quickness per success (round down). Null under the book (RULES.STREET.athletics distances).
 */
export function athleticsDistanceUrr(kind: 'climb' | 'swim' | 'jump', successes: number, running: boolean, a: { strength: number; quickness: number; runMultiplier?: number }): number | null {
  if (U().hsAthletics !== 'urr') return null;
  const s = Math.max(0, Math.floor(Number(successes) || 0));
  const fit = fitness(a.strength, a.quickness);
  if (kind === 'climb') return Math.min(s, fit);
  if (kind === 'jump') return Math.ceil((fit + Math.floor(s / 2)) * (running ? 1 : 0.5));
  const q = Math.max(0, Math.floor(Number(a.quickness) || 0)) + s;
  const speed = q * (running ? Math.max(1, Number(a.runMultiplier ?? RULES.COMBAT.movement.run) || 1) : RULES.COMBAT.movement.walk);
  return Math.floor(speed * 0.25);
}

/**
 * Falling under the Revamp: no damage up to 2 m; Power = half the metres (round down); level by height (over 2 m L,
 * over 4 m M, over 6 m S, over 8 m D); no armor. Null under the book (RULES.HAZARDS.falling).
 */
export function fallingDamageUrr(metres: number): { power: number; level: DamageLevel | null; armor: number } | null {
  if (U().hsFalling !== 'urr') return null;
  const m = Math.max(0, Number(metres) || 0);
  const level: DamageLevel | null = m > 8 ? 'D' : m > 6 ? 'S' : m > 4 ? 'M' : m > 2 ? 'L' : null;
  return { power: level ? Math.max(1, Math.floor(m / 2)) : 0, level, armor: 0 };
}

// ---------------------------------------------------------------- Social

/** Extra rows for the social dialog (Revamp: visible armor in a luxury setting); none under the book. */
export function socialExtraRows(): Array<{ id: string; label: string; value: number }> {
  return U().hsVisibleArmor ? [{ id: 'visibleArmor', label: tx('SR2E.Card.Mod.visibleArmorInALuxurySetting'), value: Math.floor(Number(U().hsVisibleArmorTn) || 0) }] : [];
}
