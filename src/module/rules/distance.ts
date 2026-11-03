import { RULES, type RangeBand } from './config.ts';
import { rangeBandForDistance, type RangeLimits } from './combat.ts';
import { t as tx } from '../helpers/i18n.ts';

/** Measuring combat distance on the canvas (v0.19.0). No Foundry dependency. */

const D = () => RULES.DISTANCE;

/** Metres per scene distance unit, or null if the unit is not recognised. Empty counts as metres. */
export function metresPerUnit(units: string | null | undefined): number | null {
  const key = String(units ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (!key) return 1;
  const v = D().units[key];
  return typeof v === 'number' ? v : null;
}

/**
 * Combine a horizontal distance with an elevation difference (same units). If the grid already
 * measured in 3D (`measured3d` is longer than the flat distance), that value is used as is.
 */
export function withElevation(flat: number, elevationDiff: number, measured3d?: number | null): number {
  const dz = Math.abs(elevationDiff || 0);
  if (!D().useElevation || dz === 0) return flat;
  if (measured3d != null && measured3d > flat + 1e-6) return measured3d;
  return Math.sqrt(flat * flat + dz * dz);
}

/** The shortest of several measured distances (nearest occupied spaces); null if there are none. */
export function nearest(distances: readonly number[]): number | null {
  const ok = distances.filter((d) => Number.isFinite(d));
  return ok.length ? Math.min(...ok) : null;
}

/** How far a melee weapon reaches, in metres. `stepMetres` is one grid step (diagonal) on the scene. VERIFY */
export function meleeReachMetres(reach: number, stepMetres = 0): number {
  const m = D().melee;
  return Math.max(m.baseMetres, stepMetres) + Math.max(0, reach || 0) * m.metresPerReach;
}

export type RangeStatus = 'ok' | 'out' | 'unmeasured';

export interface RangeCheck {
  status: RangeStatus;
  /** Ranged only: the band the distance falls in (extreme when beyond it). */
  band?: RangeBand;
  /** Whether an out-of-range attack is refused (unless overridden). */
  blocks: boolean;
  note: string;
}

const fmt = (n: number) => `${Math.round(n * 10) / 10} m`;

/** Check a measured distance (metres) against a weapon: its range band, or its melee reach. */
export function checkWeaponDistance(opts: {
  metres: number | null; melee: boolean; limits: RangeLimits; reach?: number; stepMetres?: number; unitsNote?: string;
}): RangeCheck {
  const extra = opts.unitsNote ? ` (${opts.unitsNote})` : '';
  if (opts.metres == null) return { status: 'unmeasured', blocks: false, note: '' };
  if (opts.melee) {
    const limit = meleeReachMetres(opts.reach ?? 0, opts.stepMetres ?? 0);
    const inReach = opts.metres <= limit + 1e-6;
    return inReach
      ? { status: 'ok', blocks: false, note: tx('SR2E.Text.Distance.measuredReach', { metres: fmt(opts.metres), limit: fmt(limit), extra }) }
      : { status: 'out', blocks: D().outOfReach === 'block', note: tx('SR2E.Text.Distance.measuredOutOfMeleeReach', { metres: fmt(opts.metres), limit: fmt(limit), extra }) };
  }
  const band = rangeBandForDistance(opts.metres, opts.limits);
  return band
    ? { status: 'ok', band, blocks: false, note: tx('SR2E.Text.Distance.measured', { metres: fmt(opts.metres), extra }) }
    : { status: 'out', band: 'extreme', blocks: D().beyondExtreme === 'block', note: tx('SR2E.Text.Distance.measuredBeyondExtremeRange', { metres: fmt(opts.metres), limit: fmt(opts.limits.extreme), extra }) };
}
