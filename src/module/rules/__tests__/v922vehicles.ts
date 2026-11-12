/**
 * v0.92.3: run vehicle tests under the v0.92.2 rules (before the book alignment of vehicles, rigging and building
 * security): every RULES.VEHICLES_V923 switch at its old choice and the values moved in place put back. Use as
 * `t.after(v922Vehicles())` in a test, or `useV922Vehicles()` inside a describe for the whole block.
 */
import { before, after } from 'node:test';
import { VEHICLES_V923_OLD } from '../config923/vehicles.ts';
import { oldWay } from './oldway.ts';

export const V922_VEHICLES: Record<string, unknown> = {
  ...Object.fromEntries(Object.entries(VEHICLES_V923_OLD).map(([k, v]) => [`VEHICLES_V923.${k}`, v])),
  'VEHICLES.damage.normalWeapons.powerMultiplier': 0.5,
  'VEHICLES.sensors.controlPool': true,
  'DRONES_V73.missiles.needsLock': false,
  'VEHICLES.cargo.personKg': 100,
  'ACTIONS.costs.sensor': 'simple',
  'GEAR.spellsVsVehicles.combatArmor': false,
};

export function v922Vehicles(extra: Record<string, unknown> = {}): () => void {
  return oldWay({ ...V922_VEHICLES, ...extra });
}

/** Inside a describe: the whole block under the v0.92.2 vehicle rules. */
export function useV922Vehicles(): void {
  let restore: (() => void) | null = null;
  before(() => { restore = v922Vehicles(); });
  after(() => { restore?.(); restore = null; });
}
