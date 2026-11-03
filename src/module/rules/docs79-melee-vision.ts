/**
 * v0.79.0 (melee_vision): the Visibility Table's cybernetic and natural columns, heavy smoke, rain and fog as the
 * smoke rows, glare and mist, reach for the shorter side, and the book's Perception sight rows. Switches and
 * tables in RULES.DOCS_V79 (rules/config79-melee-vision.ts). Pure rules; no Foundry.
 *
 * Each function returns null (or undefined where null means "no modifier") when its switch is set to the old way,
 * so the existing function it is wired into falls through to its old code.
 */
import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import type { V79Light } from './config79-melee-vision.ts';
import { t as tx } from '../helpers/i18n.ts';

const D = () => RULES.DOCS_V79;

/**
 * Vision with where it comes from. `lowLightNatural` / `thermographicNatural`: the actor has that vision naturally
 * (metatype, adept Improved Senses, bioware, its own flags); otherwise a set `lowLight` / `thermographic` is
 * cybernetic (cybereyes, vision gear, scope, sensors).
 */
export interface SourcedVision {
  lowLight?: boolean; thermographic?: boolean; ultrasound?: boolean;
  lowLightNatural?: boolean; thermographicNatural?: boolean;
}
export type V79VisionKind = 'normal' | 'lowLight' | 'thermographic' | 'ultrasound';
export type V79SmokeKind = 'none' | 'smoke' | 'thermal' | 'heavySmoke' | 'heavyThermal';

/** Which column of the Visibility Table this eye uses: natural beats cybernetic (never worse in any row). */
export function visionColumn(vision: SourcedVision, kind: 'lowLight' | 'thermographic'): 'cyber' | 'natural' {
  if (D().visionCyberNatural !== 'split') return 'natural';
  return (kind === 'lowLight' ? vision.lowLightNatural : vision.thermographicNatural) ? 'natural' : 'cyber';
}

const has = (v: SourcedVision, k: 'lowLight' | 'thermographic') =>
  Boolean(v[k] || (k === 'lowLight' ? v.lowLightNatural : v.thermographicNatural));

/** The best of the candidate values (first wins a tie, normal first). */
function best(c: Array<[V79VisionKind, number]>): { value: number; using: V79VisionKind } {
  let out = c[0]!;
  for (const x of c) if (x[1] < out[1]) out = x;
  return { value: out[1], using: out[0] };
}

/**
 * The Visibility Table TN for a light level (or glare / mist) with the best eyes the observer has. Null for a light
 * level under 'single' (the caller's old visibilityModifier applies); glare and mist answer either way.
 */
export function visibilityV79(light: V79Light, vision: SourcedVision = {}): { value: number; using: V79VisionKind } | null {
  const cond = light === 'glare' || light === 'mist';
  if (!cond && D().visionCyberNatural !== 'split') return null;
  const t = D().visionTable;
  const c: Array<[V79VisionKind, number]> = [['normal', cond ? t.normal[light] : RULES.COMBAT.vision.normal[light]]];
  for (const k of ['lowLight', 'thermographic'] as const) if (has(vision, k)) c.push([k, t[k][visionColumn(vision, k)][light]]);
  if (vision.ultrasound && !cond) c.push(['ultrasound', RULES.CYBERWARE.ultrasound.vision[light]]);
  return best(c);
}

/** The old smoke kind for a new one (heavy smoke counts as smoke under the old rows). */
export function smokeKindOld(kind: V79SmokeKind): 'none' | 'smoke' | 'thermal' {
  return kind === 'heavySmoke' ? 'smoke' : kind === 'heavyThermal' ? 'thermal' : kind;
}

/** Smoke TN by the observer's best eyes from the book rows; null under 'old' (the caller's smokeModifier applies). */
export function smokeV79(kind: V79SmokeKind, vision: SourcedVision = {}): { value: number; using: V79VisionKind } | null {
  if (D().visionSmokeRows !== 'book') return null;
  return smokeRowsBest(kind, vision);
}

/** The book smoke rows by the observer's best eyes (shared by smokeV79 and weatherV79; v0.81.0 RB-2). */
function smokeRowsBest(kind: V79SmokeKind, vision: SourcedVision): { value: number; using: V79VisionKind } {
  if (kind === 'none') return { value: 0, using: 'normal' };
  const row = D().visionSmokeTable[kind];
  if (!row) return { value: 0, using: 'normal' };
  const c: Array<[V79VisionKind, number]> = [['normal', row.normal]];
  for (const k of ['lowLight', 'thermographic'] as const) {
    if (!has(vision, k)) continue;
    // Under 'single' there is one column: the cybernetic one (the old rows' numbers).
    const col = D().visionCyberNatural === 'split' ? visionColumn(vision, k) : 'cyber';
    c.push([k, row[k][col]]);
  }
  if (vision.ultrasound) c.push(['ultrasound', RULES.CYBERWARE.ultrasound.smoke[smokeKindOld(kind) as 'smoke' | 'thermal']]);
  return best(c);
}

/**
 * Weather as the Visibility Table's rows: rain and fog as light / heavy smoke, mist as mist. `undefined` when this
 * doesn't decide it ('own', or a weather id the table doesn't cover): the caller's weatherModifier applies; null =
 * no modifier.
 */
export function weatherV79(id: string, vision: SourcedVision = {}): { label: string; value: number } | null | undefined {
  if (D().visionWeatherFold !== 'smoke') return undefined;
  const as = D().visionWeatherAs[id];
  const w = RULES.HEALTH.weather.find((x) => x.id === id);
  if (!as || !w) return undefined;
  // Rain and fog use the book's smoke rows whatever visionSmokeRows says: the weather switch alone decides.
  const v = as === 'mist' ? visibilityV79('mist', vision) : smokeRowsBest(as, vision);
  return v && v.value ? { label: w.label, value: v.value } : null;
}

/**
 * Reach on one side's own melee test (attacker or defender): −`reachTnPerPoint` per point longer, + per point
 * shorter. Null under 'longer' or with RULES.COMBAT.reach.appliesTo 'defender' (the caller's old code applies).
 */
export function reachV79(ownReach: number, opponentReach: number): TargetNumberModifier[] | null {
  if (D().meleeReachShorter !== 'both' || RULES.COMBAT.reach.appliesTo !== 'longer') return null;
  const diff = Math.floor(Number(ownReach) || 0) - Math.floor(Number(opponentReach) || 0);
  if (!diff) return [];
  const per = RULES.COMBAT.melee.reachTnPerPoint;
  return diff > 0 ? [{ label: tx('SR2E.Card.Mod.reach', { diff }), value: -diff * per }] : [{ label: tx('SR2E.Card.Mod.opponentSReach', { value: -diff }), value: -diff * per }];
}

/** The Perception sight rows on offer: the book's under 'book', the old obviousness scale under 'scale'. */
export function perceptionSightRows(): ReadonlyArray<{ id: string; label: string; value: number }> {
  return D().perceptionSightBook === 'book' ? D().perceptionSightRows : RULES.CHARACTERS_V58.notice.obviousness;
}

/**
 * The Perception sight modifiers for one row id or several (they stack, each row once; old obviousness ids map to
 * the book row with the same number). Null under 'scale' (the caller's old one-row noticeTest applies).
 */
export function perceptionSightModifiers(ids: string | ReadonlyArray<string> | null | undefined): TargetNumberModifier[] | null {
  if (D().perceptionSightBook !== 'book') return null;
  const rows = D().perceptionSightRows;
  const seen = new Set<string>();
  const out: TargetNumberModifier[] = [];
  for (const id of typeof ids === 'string' ? [ids] : ids ?? []) {
    const r = rows.find((x) => x.id === id) ?? rows.find((x) => x.alias === id);
    if (!r || !r.value || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({ label: r.label, value: r.value });
  }
  return out;
}
