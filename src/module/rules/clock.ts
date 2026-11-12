/**
 * v0.92.2 (RULES.CLOCK_V922): the system's own clock. Pure.
 * The system's timers (drugs, healing, upkeep, training, deliveries, spirits, sustained spells, security responses…) run
 * on world time less an offset of whole days. A big jump the GM says "only changes the date" adds its whole days to the
 * offset, so nothing comes due by it; the time of day (sunrise and sunset, darkness) stays the calendar's.
 */
import { RULES } from './config.ts';

const DAY_SECONDS = 86400;

export interface ClockState {
  /** Seconds (whole days) the system's clock runs behind world time. */
  offset: number;
  /** The last date-only jump, so the same jump back (an undo, or the GM putting the date back) takes its days off again. */
  last: { from: number; to: number; add: number } | null;
}

export const EMPTY_CLOCK: ClockState = { offset: 0, last: null };

/** A stored clock state cleaned (anything odd reads as no offset). */
export function cleanClock(v: unknown): ClockState {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, any>;
  const offset = Number.isFinite(Number(o['offset'])) ? Math.trunc(Number(o['offset']) / DAY_SECONDS) * DAY_SECONDS : 0;
  const l = o['last'];
  const last = l && typeof l === 'object' && [l.from, l.to, l.add].every((x: unknown) => Number.isFinite(Number(x)))
    ? { from: Number(l.from), to: Number(l.to), add: Number(l.add) } : null;
  return { offset, last };
}

/** The system's time for a world time. */
export function systemTime(worldTime: number, state: ClockState | null | undefined): number {
  return Number(worldTime || 0) - Number(state?.offset ?? 0);
}

/** Whether a change of world time is big enough to ask about (the switch on, outside combat, not marked by the system). */
export function isBigJump(dt: number, o: { inCombat?: boolean; marked?: boolean } = {}, rules = RULES.CLOCK_V922): boolean {
  if (rules.bigJump !== 'ask' || o.inCombat || o.marked) return false;
  const days = Math.max(1, Number(rules.bigJumpDays) || 1);
  return Math.abs(Number(dt) || 0) >= days * DAY_SECONDS;
}

/** The whole days of a jump (toward zero): what "only the date" keeps off the system's clock. */
export function wholeDays(dt: number): number {
  return Math.trunc((Number(dt) || 0) / DAY_SECONDS) * DAY_SECONDS;
}

/** A jump back that undoes the last date-only jump exactly. */
export function undoesLast(state: ClockState, from: number, to: number): boolean {
  return Boolean(state.last && state.last.to === from && state.last.from === to);
}

/** The state after the GM's answer: 'date' adds the whole days; 'count' changes nothing; an exact undo takes them off. */
export function nextClock(state: ClockState, from: number, to: number, answer: 'date' | 'count'): ClockState {
  if (undoesLast(state, from, to)) return { offset: state.offset - (state.last?.add ?? 0), last: null };
  if (answer !== 'date') return { offset: state.offset, last: null };
  const add = wholeDays(to - from);
  return { offset: state.offset + add, last: add ? { from, to, add } : null };
}
