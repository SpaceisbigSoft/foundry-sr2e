/**
 * v0.92.2 (RULES.CLOCK_V922): the system's clock, world time less a whole-days offset (rules/clock.ts). Every timer the
 * system keeps reads `sysNow()`; the time of day (sunrise and sunset, darkness, the clock shown to people) and the undo
 * log's clock steps read Foundry's own world time.
 */
import { SYSTEM } from '../config/system.ts';
import { cleanClock, systemTime, type ClockState } from '../rules/clock.ts';

export const CLOCK_SETTING = 'clock';

export function clockState(): ClockState {
  try { return cleanClock((globalThis as any).game?.settings?.get?.(SYSTEM.id, CLOCK_SETTING)); } catch { return cleanClock(null); }
}

/** The system's time now (seconds). */
export function sysNow(): number {
  return systemTime(Number((globalThis as any).game?.time?.worldTime ?? 0), clockState());
}

/** The system's time for a world time (an updateWorldTime hook's value). */
export function toSysTime(worldTime: number): number {
  return systemTime(Number(worldTime ?? 0), clockState());
}

/** Options for a clock change the system makes itself: it always counts as time passed (no question). */
export const COUNTED_TIME = { sr2eTime: 'count' } as const;

export function registerClockSetting(): void {
  (game as any).settings.register(SYSTEM.id, CLOCK_SETTING, { scope: 'world', config: false, type: Object, default: { offset: 0, last: null } });
}
