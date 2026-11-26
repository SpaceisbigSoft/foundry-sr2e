/**
 * v0.94.1 (report item 23): the getter for automation settings. `auto('autoApplyGm', false)` is the setting's stored
 * value, or what the master switch `manualTable` makes of it while it is on (rules/automation941.ts). The stored value
 * is never written here.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { effectiveSetting } from '../rules/automation941.ts';

function stored(key: string, fallback: unknown): unknown {
  try { return (game as any).settings.get(SYSTEM_ID, key) ?? fallback; } catch { return fallback; }
}

/** Whether Manual table is on (a world setting: the GM's choice, read by every client). */
export function manualTableOn(): boolean {
  return stored('manualTable', false) === true;
}

/** An automation setting as the code should act on it now (the fallback when it is not registered). */
export function auto<T>(key: string, fallback: T): T {
  return effectiveSetting(key, stored(key, fallback), manualTableOn()) as T;
}
