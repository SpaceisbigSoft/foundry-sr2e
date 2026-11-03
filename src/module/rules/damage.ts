import { RULES, type DamageLevel } from './config.ts';
import { DAMAGE_LEVELS as LEVELS } from './util.ts';

export type DamageType = 'physical' | 'stun';

export interface DamageCode {
  power: number;
  level: DamageLevel;
}

/** Parse a damage code such as "9M" or "10S". Returns null if it is not one. */
export function parseDamageCode(code: string): DamageCode | null {
  const m = /^\s*(\d+)\s*([LMSD])\s*$/i.exec(code);
  if (!m) return null;
  return { power: Number(m[1]), level: (m[2] as string).toUpperCase() as DamageLevel };
}

/** Raise damage level by `steps`, capped at Deadly. */
export function stageUp(level: DamageLevel, steps: number): DamageLevel {
  const i = Math.min(LEVELS.length - 1, LEVELS.indexOf(level) + Math.max(0, steps));
  return LEVELS[i] as DamageLevel;
}

/** Lower damage level by `steps`. Returns null once it drops below Light (no damage). */
export function stageDown(level: DamageLevel, steps: number): DamageLevel | null {
  const i = LEVELS.indexOf(level) - Math.max(0, steps);
  return i < 0 ? null : (LEVELS[i] as DamageLevel);
}

/**
 * Attacker's net successes stage the damage level up one step per RULES.SUCCESSES_PER_STAGE: counted beyond the
 * first ('afterFirst') or from the first (RULES.ATTACK_STAGING 'all', v0.54.0).
 */
export function stageForNetSuccesses(level: DamageLevel, netSuccesses: number): DamageLevel {
  // The first success hits; each further SUCCESSES_PER_STAGE successes raise the level one step
  // ('afterFirst'), or every SUCCESSES_PER_STAGE net successes do ('all', v0.54.0).
  const extra = Math.max(0, RULES.ATTACK_STAGING === 'all' ? netSuccesses : netSuccesses - 1);
  return stageUp(level, Math.floor(extra / RULES.SUCCESSES_PER_STAGE));
}

/** TN for the damage-resistance (Body) test: Power minus applicable armor, never below the minimum. */
export function resistanceTargetNumber(power: number, armor: number): number {
  return Math.max(RULES.MIN_TARGET_NUMBER, power - Math.max(0, armor));
}

/** After the resistance test, every 2 successes stage the damage down one level. */
export function resolveResistance(level: DamageLevel, resistanceSuccesses: number): DamageLevel | null {
  return stageDown(level, Math.floor(resistanceSuccesses / RULES.SUCCESSES_PER_STAGE));
}

export interface Monitor {
  physical: number;
  stun: number;
}

export type Status = 'ok' | 'unconscious' | 'dying' | 'dead';

/**
 * The condition a monitor puts a character in: dead once Physical overflow (boxes past a full track) reaches
 * Body (passes it with RULES.URR_V80.hsDeathPastOverflow); dying with a full Physical track; unconscious with a
 * full Stun track; else ok.
 */
export function monitorStatus(m: Monitor, body: number): Status {
  const overflow = m.physical - RULES.MONITOR_BOXES;
  // v0.80.0 (RULES.URR_V80.hsDeathPastOverflow, the URR): dead only with MORE damage than 10 + Body.
  if (overflow >= body + (RULES.URR_V80.hsDeathPastOverflow ? 1 : 0) && m.physical > RULES.MONITOR_BOXES) return 'dead';
  if (m.physical >= RULES.MONITOR_BOXES) return 'dying';
  if (m.stun >= RULES.MONITOR_BOXES) return 'unconscious';
  return 'ok';
}

/**
 * Apply resolved damage to a monitor. Stun beyond a full Stun track converts to
 * Physical. Returns the new monitor plus the new status; the input is not mutated.
 */
export function applyDamageToMonitor(
  monitor: Monitor,
  type: DamageType,
  level: DamageLevel | null,
  body: number,
): { monitor: Monitor; boxes: number; status: Status } {
  if (level === null) return { monitor: { ...monitor }, boxes: 0, status: monitorStatus(monitor, body) };

  const boxes = RULES.BOXES_PER_LEVEL[level];
  let { physical, stun } = monitor;

  if (type === 'physical') {
    physical += boxes;
  } else {
    ({ physical, stun } = addStun({ physical, stun }, boxes));
  }

  const next = { physical, stun };
  return { monitor: next, boxes, status: monitorStatus(next, body) };
}

/**
 * Stun boxes onto a monitor: past a full Stun track they go onto Physical, STUN_OVERFLOW_PER_PHYSICAL_BOX Stun to a
 * box. v0.70.0 (RULES.FIXES_V70.stunOverflowCarry): an odd box isn't lost on each hit; it waits past the track's end
 * (shown as "+1") until the next Stun makes a whole Physical box. Before, repeated Light Stun never reached Physical.
 */
export function addStun(monitor: Monitor, boxes: number): Monitor {
  let physical = Number(monitor.physical) || 0;
  let stun = (Number(monitor.stun) || 0) + Math.max(0, Math.floor(Number(boxes) || 0));
  const max = RULES.MONITOR_BOXES;
  if (stun > max) {
    const ratio = Math.max(1, Math.floor(Number(RULES.STUN_OVERFLOW_PER_PHYSICAL_BOX) || 1));
    const overflow = stun - max;
    physical += Math.floor(overflow / ratio);
    stun = max + (RULES.FIXES_V70.stunOverflowCarry ? overflow % ratio : 0);
  }
  return { physical, stun };
}

function trackWoundModifier(boxes: number): number {
  for (const [min, mod] of RULES.WOUND_MODIFIERS) if (boxes >= min) return mod;
  return 0;
}

/** TN modifier applied to every test because of current wounds. */
export function woundModifier(m: Monitor): number {
  const p = trackWoundModifier(m.physical);
  const s = trackWoundModifier(m.stun);
  return RULES.WOUNDS_CUMULATIVE ? p + s : Math.max(p, s);
}

/** Heals boxes from a track, never below zero. */
export function heal(monitor: Monitor, type: DamageType, boxes: number): Monitor {
  const next = { ...monitor };
  next[type] = Math.max(0, next[type] - Math.max(0, boxes));
  return next;
}
