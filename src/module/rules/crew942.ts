/**
 * v0.94.2 (improvement plan item 42): crew stations on a vehicle, the pure parts (no Foundry). The glue is
 * applications/crew942.ts.
 *
 * - Stations: the driver, one gunner per weapon a gunner can work (turret, pintle or ring mount; none for a vehicle
 *   with only fixed mounts, at most four), sensors, and a commander.
 * - The driver's seat IS the vehicle's controller (`system.controllerUuid`): it is never stored twice. The other seats
 *   are stored on the vehicle (flag `crew942`: `{ seats: {station: actorUuid}, ready: {station: true} }`).
 * - One station per actor. Changing who sits at a station clears its ready mark.
 * - Firing still goes through the vehicle's own rules (rules/vehicles.ts `canFireMount`, SR2Actor.mountedRole): a
 *   station only decides which guns are shown first.
 */
import { canFireMount, type FirerRole } from './vehicles.ts';

export const CREW_FLAG = 'crew942';

export type StationRole = 'driver' | 'gunner' | 'sensors' | 'commander';
export interface Station { id: string; role: StationRole; n: number }
export interface CrewState { seats: Record<string, string>; ready: Record<string, boolean> }

/** The most gunner stations a vehicle shows. */
export const MAX_GUNNERS = 4;

/** Mounts a gunner aboard works (a fixed mount is the driver's or the autopilot's). */
const gunnerMount = (m: string): boolean => canFireMount(m, 'gunner');

/** Pure: a vehicle's stations, from its mounted weapons' mounts. */
export function stationsFor(mounts: ReadonlyArray<string>): Station[] {
  const gunners = Math.min(MAX_GUNNERS, mounts.filter((m) => m && m !== 'none' && gunnerMount(m)).length);
  return [
    { id: 'driver', role: 'driver', n: 1 },
    ...Array.from({ length: gunners }, (_, i) => ({ id: `gunner${i + 1}`, role: 'gunner' as const, n: i + 1 })),
    { id: 'sensors', role: 'sensors', n: 1 },
    { id: 'commander', role: 'commander', n: 1 },
  ];
}

const STATION_ID = /^(driver|gunner[1-4]|sensors|commander)$/;
export const validStation = (id: unknown): id is string => typeof id === 'string' && STATION_ID.test(id);

/** Pure: a stored crew flag, cleaned (unknown stations, non-strings and empty seats dropped; null = nothing set). */
export function crewOf(raw: unknown): CrewState {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const seats: Record<string, string> = {};
  const ready: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(r.seats && typeof r.seats === 'object' ? r.seats : {})) if (validStation(k) && k !== 'driver' && typeof v === 'string' && v && v.length <= 400) seats[k] = v;
  for (const [k, v] of Object.entries(r.ready && typeof r.ready === 'object' ? r.ready : {})) if (validStation(k) && v === true) ready[k] = true;
  return { seats, ready };
}

/**
 * Pure: v0.94.2 review (6): the crew without ghost seats: a seat whose actor no longer resolves, or whose station the
 * vehicle no longer has (a gun removed), is dropped with its ready mark.
 */
export function pruneCrew(state: CrewState, stations: ReadonlyArray<Station>, resolves: (uuid: string) => boolean): CrewState {
  const have = new Set(stations.map((s) => s.id));
  const seats: Record<string, string> = {}, ready: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(state.seats)) if (have.has(k) && resolves(v)) seats[k] = v;
  for (const k of Object.keys(state.ready)) if (have.has(k) && (k === 'driver' || seats[k])) ready[k] = true;
  return { seats, ready };
}

/** Pure: who sits at a station (the driver from the vehicle's controller). */
export function seatOf(state: CrewState, station: string, controllerUuid: string): string {
  return station === 'driver' ? String(controllerUuid ?? '') : String(state.seats[station] ?? '');
}

/** Pure: the stations an actor sits at (at most one stored seat, plus the driver's seat when they drive). */
export function stationsOfActor(state: CrewState, uuid: string, controllerUuid: string): string[] {
  if (!uuid) return [];
  const out = uuid === controllerUuid ? ['driver'] : [];
  for (const [k, v] of Object.entries(state.seats)) if (v === uuid) out.push(k);
  return out;
}

/**
 * Pure: the crew after seating `uuid` at a (non-driver) station: they leave any other stored seat, and every station
 * whose occupant changed loses its ready mark. '' empties the station.
 */
export function seat(state: CrewState, station: string, uuid: string): CrewState {
  const seats = { ...state.seats }, ready = { ...state.ready };
  if (!validStation(station) || station === 'driver') return { seats, ready };
  if (uuid) for (const [k, v] of Object.entries(seats)) if (v === uuid && k !== station) { delete seats[k]; delete ready[k]; }
  if ((seats[station] ?? '') !== uuid) delete ready[station];
  if (uuid) seats[station] = uuid; else delete seats[station];
  return { seats, ready };
}

/** Pure: a ready mark set or taken off. */
export function markReady(state: CrewState, station: string, on: boolean): CrewState {
  const ready = { ...state.ready };
  if (validStation(station) && on) ready[station] = true; else delete ready[station];
  return { seats: { ...state.seats }, ready };
}

/** Pure: every ready mark taken off. */
export const clearReady = (state: CrewState): CrewState => ({ seats: { ...state.seats }, ready: {} });

/** Pure: whether every occupied station is marked ready (and at least one is occupied). */
export function allReady(state: CrewState, stations: ReadonlyArray<Station>, controllerUuid: string): boolean {
  const filled = stations.filter((s) => seatOf(state, s.id, controllerUuid));
  return filled.length > 0 && filled.every((s) => state.ready[s.id] === true);
}

/** Pure: the role a station fires mounted weapons as (none for sensors and the commander). */
export function stationFirerRole(role: StationRole): FirerRole | null {
  return role === 'driver' ? 'driver' : role === 'gunner' ? 'gunner' : null;
}

/**
 * Pure: the weapons a station may fire, by the mount rules. Gunner stations share the gunner weapons out in order
 * (gunner 1 the first, gunner 2 the second, …); the last gunner station also gets any left over.
 */
export function stationGuns<W extends { mount: string }>(station: Station, weapons: ReadonlyArray<W>, gunnerCount: number): W[] {
  const role = stationFirerRole(station.role);
  if (!role) return [];
  const usable = weapons.filter((w) => canFireMount(w.mount, role));
  if (role !== 'gunner') return usable;
  const n = Math.max(1, gunnerCount);
  return usable.filter((_, i) => (i < n ? i === station.n - 1 : station.n === n));
}

/** Pure: stations in the order this user sees them: their own first, then the rest as listed. */
export function stationOrder(stations: ReadonlyArray<Station>, mine: ReadonlyArray<string>): Station[] {
  const set = new Set(mine);
  return [...stations.filter((s) => set.has(s.id)), ...stations.filter((s) => !set.has(s.id))];
}

/**
 * Pure: who may do what at a station.
 * - claim: a free station, for an actor the user owns, when the user owns the vehicle or the actor is aboard (or
 *   drives it already); the GM always.
 * - assign: the GM or the vehicle's owner seat anyone; v0.94.2 review (2): at the driver's station only an actor the
 *   user owns too (seating a driver writes that actor's rigging and releases any other vehicle they drive).
 * - leave: the seated actor's owner, the vehicle's owner, the GM.
 * - ready: the seated actor's owner, the GM.
 */
export function crewMay(what: 'claim' | 'assign' | 'leave' | 'ready', o: { isGM: boolean; ownsVehicle: boolean; ownsActor: boolean; aboard: boolean; free: boolean; driver?: boolean }): boolean {
  if (o.isGM) return true;
  switch (what) {
    case 'claim': return o.free && o.ownsActor && (o.ownsVehicle || o.aboard);
    case 'assign': return o.ownsVehicle && (!o.driver || o.ownsActor);
    case 'leave': return o.ownsActor || o.ownsVehicle;
    case 'ready': return o.ownsActor;
  }
}
