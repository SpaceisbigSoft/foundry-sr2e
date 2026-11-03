import type { DamageLevel } from './config.ts';

/**
 * v0.81.0: small helpers shared by the rules files (they used to be written out in each file).
 * Pure; no Foundry, no RULES.
 */

/** A finite number or 0 (numeric strings count). */
export const num = (n: unknown): number => (Number.isFinite(Number(n)) ? Number(n) : 0);

/** A finite number or 0 (only real numbers count; '3' is 0). */
export const finiteNum = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

/** Round to 2 decimals, to avoid floating-point noise such as 0.30000000000000004 in Essence values. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** The damage levels, lightest first. */
export const DAMAGE_LEVELS: readonly DamageLevel[] = ['L', 'M', 'S', 'D'];

/** A damage level's place in DAMAGE_LEVELS (−1 for anything else). */
export const levelIndex = (level: unknown): number => DAMAGE_LEVELS.indexOf(level as DamageLevel);

/**
 * v0.81.1 (RA2-5, RC2-5): `rec[key]` for the record's own keys only. A plain `rec[key]` with a key from data
 * answers 'constructor', 'toString' or '__proto__' with an Object.prototype member.
 */
export function own<T>(rec: Readonly<Record<string, T>> | null | undefined, key: unknown): T | undefined {
  return rec != null && typeof key === 'string' && Object.hasOwn(rec, key) ? rec[key] : undefined;
}

/** The smallest angle between two bearings in degrees (0–180). */
export function bearingDiff(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

// ---------------------------------------------------------------- Round-or-time clocks

/**
 * v0.81.0: "now" for a timer: the Combat Turn of a started combat (null outside one), the world time, and
 * the id of that combat. `combatId` undefined = the caller doesn't say (the pre-v0.81 behaviour: rounds are
 * compared whenever both sides have one); '' or null = not in a combat.
 */
export type Clock = { round: number | null; worldTime: number; combatId?: string | null };

/** v0.81.0: when a timer is due: a Combat Turn (−1 = none), a world time, and the combat the round belongs to. */
export type ClockDue = { round: number; worldTime: number; combatId?: string };

/**
 * v0.81.0: whether `due.round` may be compared with `now.round`: both have a round, and (when `now` names
 * its combat) the round was set in that same combat. A round from another combat, or old data with no
 * combat id, is not comparable, so the caller goes by world time instead.
 */
export function sameCombatRound(due: { round: number; combatId?: string | null }, now: { round?: number | null; combatId?: string | null }): boolean {
  if (now.round == null || !(due.round >= 0)) return false;
  if (now.combatId === undefined) return true;
  return !!now.combatId && due.combatId === now.combatId;
}

/** v0.81.0: the combat id to stamp on a new ClockDue: `{ combatId }` when `now` is in a named combat, else nothing. */
export function combatStamp(now: { round?: number | null; combatId?: string | null }): { combatId?: string } {
  return now.round != null && now.combatId ? { combatId: now.combatId } : {};
}
