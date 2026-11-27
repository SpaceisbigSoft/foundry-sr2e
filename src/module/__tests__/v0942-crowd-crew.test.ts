/**
 * v0.94.2 (improvement plan item 42): crew stations on the vehicle sheet (rules/crew942.ts, applications/crew942.ts).
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  stationsFor, crewOf, seatOf, stationsOfActor, seat, markReady, clearReady, allReady, stationGuns, stationOrder, crewMay, pruneCrew, stationFirerRole, validStation, MAX_GUNNERS,
} from '../rules/crew942.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

describe('v0.94.2 crew stations: which stations (item 42)', () => {
  test('driver, a gunner per gunner-worked mount, sensors, commander', () => {
    assert.deepEqual(stationsFor([]).map((s) => s.id), ['driver', 'sensors', 'commander']);
    assert.deepEqual(stationsFor(['fixed', 'none']).map((s) => s.id), ['driver', 'sensors', 'commander'], 'a fixed mount is the driver\'s');
    assert.deepEqual(stationsFor(['turret', 'pintle', 'fixed']).map((s) => s.id), ['driver', 'gunner1', 'gunner2', 'sensors', 'commander']);
    assert.equal(stationsFor(Array(9).fill('ring')).filter((s) => s.role === 'gunner').length, MAX_GUNNERS);
  });
  test('station ids are a closed list', () => {
    for (const ok of ['driver', 'gunner1', 'gunner4', 'sensors', 'commander']) assert.equal(validStation(ok), true);
    for (const no of ['gunner5', 'gunner0', '__proto__', 'driver ', 7]) assert.equal(validStation(no), false);
  });
});

describe('v0.94.2 crew stations: seats and ready marks', () => {
  test('a stored flag is cleaned; null is nothing', () => {
    assert.deepEqual(crewOf(null), { seats: {}, ready: {} });
    assert.deepEqual(crewOf({ seats: { gunner1: 'Actor.a', driver: 'Actor.x', bogus: 'Actor.b', sensors: 5 }, ready: { gunner1: true, sensors: 'yes' } }), { seats: { gunner1: 'Actor.a' }, ready: { gunner1: true } });
  });
  test('the driver seat is the controller', () => {
    const st = crewOf({ seats: { gunner1: 'Actor.a' } });
    assert.equal(seatOf(st, 'driver', 'Actor.d'), 'Actor.d');
    assert.equal(seatOf(st, 'gunner1', 'Actor.d'), 'Actor.a');
    assert.deepEqual(stationsOfActor(st, 'Actor.d', 'Actor.d'), ['driver']);
    assert.deepEqual(seat(st, 'driver', 'Actor.z'), st, 'the driver is never stored');
  });
  test('one station per actor; a changed occupant loses the ready mark', () => {
    let st = markReady(seat(crewOf(null), 'gunner1', 'Actor.a'), 'gunner1', true);
    st = markReady(seat(st, 'sensors', 'Actor.b'), 'sensors', true);
    const moved = seat(st, 'sensors', 'Actor.a');
    assert.deepEqual(moved.seats, { sensors: 'Actor.a' });
    assert.deepEqual(moved.ready, {}, 'both stations changed hands');
    const same = seat(st, 'gunner1', 'Actor.a');
    assert.equal(same.ready['gunner1'], true, 'seating the same actor again keeps the mark');
    assert.deepEqual(seat(st, 'gunner1', '').seats, { sensors: 'Actor.b' });
  });
  test('all ready: every occupied station marked, at least one occupied', () => {
    const stations = stationsFor(['turret']);
    assert.equal(allReady(crewOf(null), stations, ''), false);
    let st = seat(crewOf(null), 'gunner1', 'Actor.a');
    assert.equal(allReady(st, stations, 'Actor.d'), false);
    st = markReady(markReady(st, 'gunner1', true), 'driver', true);
    assert.equal(allReady(st, stations, 'Actor.d'), true);
    assert.equal(allReady(clearReady(st), stations, 'Actor.d'), false);
    assert.equal(allReady(markReady(st, 'gunner1', false), stations, 'Actor.d'), false);
  });
});

describe('v0.94.2 crew stations: guns and order', () => {
  const weapons = [{ id: 'f', mount: 'fixed' }, { id: 't1', mount: 'turret' }, { id: 'p', mount: 'pintle' }, { id: 't2', mount: 'turret' }];
  test('by the mount rules (canFireMount)', () => {
    const st = stationsFor(weapons.map((w) => w.mount));
    const driver = st.find((s) => s.id === 'driver')!;
    assert.deepEqual(stationGuns(driver, weapons, 3).map((w) => w.id), ['f', 't1', 't2'], 'the driver: fixed and turrets, never a pintle');
    assert.deepEqual(stationGuns(st.find((s) => s.id === 'gunner1')!, weapons, 3).map((w) => w.id), ['t1']);
    assert.deepEqual(stationGuns(st.find((s) => s.id === 'gunner3')!, weapons, 3).map((w) => w.id), ['t2']);
    assert.deepEqual(stationGuns(st.find((s) => s.id === 'sensors')!, weapons, 3), []);
    assert.equal(stationFirerRole('commander'), null);
  });
  test('the last gunner gets what is left over', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `g${i}`, mount: 'ring' }));
    const st = stationsFor(many.map((w) => w.mount));
    assert.deepEqual(stationGuns(st.find((s) => s.id === 'gunner4')!, many, 4).map((w) => w.id), ['g3', 'g4', 'g5']);
  });
  test('the user\'s own stations first', () => {
    assert.deepEqual(stationOrder(stationsFor(['turret']), ['sensors']).map((s) => s.id), ['sensors', 'driver', 'gunner1', 'commander']);
  });
});

describe('v0.94.2 crew stations: who may', () => {
  const o = (x: Partial<Parameters<typeof crewMay>[1]>) => ({ isGM: false, ownsVehicle: false, ownsActor: false, aboard: false, free: true, ...x });
  test('claim: a free station, an own actor, owning the vehicle or aboard', () => {
    assert.equal(crewMay('claim', o({ ownsActor: true, ownsVehicle: true })), true);
    assert.equal(crewMay('claim', o({ ownsActor: true, aboard: true })), true);
    assert.equal(crewMay('claim', o({ ownsActor: true })), false, 'neither the vehicle\'s owner nor aboard');
    assert.equal(crewMay('claim', o({ ownsActor: true, aboard: true, free: false })), false);
    assert.equal(crewMay('claim', o({ ownsVehicle: true })), false, 'not someone else\'s actor');
  });
  test('assign, leave, ready', () => {
    assert.equal(crewMay('assign', o({ ownsVehicle: true })), true);
    assert.equal(crewMay('assign', o({ ownsActor: true, aboard: true })), false);
    assert.equal(crewMay('leave', o({ ownsActor: true })), true);
    assert.equal(crewMay('ready', o({ ownsVehicle: true })), false, 'only the crew member (or the GM) marks ready');
    assert.equal(crewMay('ready', o({ ownsActor: true })), true);
    for (const w of ['claim', 'assign', 'leave', 'ready'] as const) assert.equal(crewMay(w, o({ isGM: true, free: false })), true);
  });
});

describe('v0.94.2 crew stations: the panel (glue with stubs)', () => {
  const g = globalThis as any;
  const registry = new Map<string, any>();
  const mk = (uuid: string, name: string, owner: boolean, type = 'character') => { const a = { uuid, name, type, isOwner: owner, testUserPermission: () => owner }; registry.set(uuid, a); return a; };
  let mod: typeof import('../applications/crew942.ts');
  let vehicle: any;
  before(async () => {
    g.game ??= {};
    g.game.user = { id: 'u1', name: 'Pat', isGM: false };
    g.game.settings = { get: () => true };
    g.game.users = [];
    g.fromUuidSync = (u: string) => registry.get(u) ?? null;
    mk('Actor.pc', 'Rook', true);
    mk('Actor.npc', 'Goon <b>', false, 'npc');
    g.game.actors = [...registry.values()];
    vehicle = {
      uuid: 'Actor.van', name: 'Van', type: 'vehicle', isOwner: false, testUserPermission: () => false,
      system: { controllerUuid: 'Actor.npc', occupants: ['Actor.pc'], locks: [], ecm: 0 },
      flags: { shadowrun2e_unified: { crew942: { seats: { gunner1: 'Actor.pc' }, ready: { gunner1: true } } } },
      items: [{ id: 'w1', type: 'weapon', name: 'Turret MG', system: { mount: 'turret' } }],
      isAboard: (a: any) => ['Actor.pc'].includes(a?.uuid),
    };
    mod = await import('../applications/crew942.ts');
  });
  test('the player\'s own station first and open, with their gun; names escaped', () => {
    const html = mod.crewPanelHtml(vehicle, 'sheet1');
    const firstTab = /data-station="(\w+)"/.exec(html)![1];
    assert.equal(firstTab, 'gunner1');
    assert.match(html, /sr2e-crew-panel active" data-station="gunner1"/);
    assert.match(html, /data-action="fireMounted" data-item-id="w1"/);
    assert.match(html, /data-action="crewReady" data-station="gunner1"/);
    assert.doesNotMatch(html, /Goon <b>/);
    // v0.94.2 review (7): the player can't view the NPC driver, so the seat only says it's taken.
    assert.doesNotMatch(html, /Goon &lt;b&gt;/);
    assert.match(html, /Driver <small>occupied<\/small>/);
    assert.doesNotMatch(html, /crewClearReady/, 'no GM control for a player');
    assert.doesNotMatch(html, /data-action="crewAssign"/, 'a player who doesn\'t own the vehicle assigns nobody');
  });
  test('the relay judges the sender: a player may not mark another\'s station or seat an NPC', () => {
    const player = { isGM: false, name: 'Pat' };
    // testUserPermission stubs answer by the actor's own owner flag.
    assert.equal(mod.crewOpAllowed(vehicle, player, { vehicleUuid: vehicle.uuid, op: 'ready', station: 'gunner1', on: true }), true);
    assert.equal(mod.crewOpAllowed(vehicle, player, { vehicleUuid: vehicle.uuid, op: 'ready', station: 'driver', on: true }), false);
    assert.equal(mod.crewOpAllowed(vehicle, player, { vehicleUuid: vehicle.uuid, op: 'seat', station: 'sensors', actorUuid: 'Actor.npc' }), false);
    assert.equal(mod.crewOpAllowed(vehicle, player, { vehicleUuid: vehicle.uuid, op: 'seat', station: 'sensors', actorUuid: 'Actor.pc' }), true, 'aboard: may take a free station');
    assert.equal(mod.crewOpAllowed(vehicle, player, { vehicleUuid: vehicle.uuid, op: 'clear' }), false);
    assert.equal(mod.crewOpAllowed(vehicle, player, { vehicleUuid: vehicle.uuid, op: 'seat', station: 'gunner9' as any, actorUuid: 'Actor.pc' }), false);
    assert.equal(mod.crewOpAllowed(vehicle, { isGM: true }, { vehicleUuid: vehicle.uuid, op: 'clear' }), true);
  });
  test('review (7): the vehicle\'s owner sees the name (escaped)', () => {
    const own = { ...vehicle, isOwner: true, testUserPermission: () => true };
    const html = mod.crewPanelHtml(own, 'sheet2');
    assert.match(html, /Goon &lt;b&gt;/);
    assert.doesNotMatch(html, /Goon <b>/);
  });
  test('review (2): a vehicle owner seats anyone as gunner, but only their own actor as driver; the GM anyone', () => {
    const own = { ...vehicle, isOwner: true, testUserPermission: () => true, system: { ...vehicle.system, controllerUuid: '' } };
    const player = { isGM: false, name: 'Pat' };
    assert.equal(mod.crewOpAllowed(own, player, { vehicleUuid: own.uuid, op: 'seat', station: 'driver', actorUuid: 'Actor.npc' }), false);
    assert.equal(mod.crewOpAllowed(own, player, { vehicleUuid: own.uuid, op: 'seat', station: 'driver', actorUuid: 'Actor.pc' }), true);
    assert.equal(mod.crewOpAllowed(own, player, { vehicleUuid: own.uuid, op: 'seat', station: 'sensors', actorUuid: 'Actor.npc' }), true);
    assert.equal(mod.crewOpAllowed(own, { isGM: true }, { vehicleUuid: own.uuid, op: 'seat', station: 'driver', actorUuid: 'Actor.npc' }), true);
  });
  test('review (6): seats of a deleted actor, or at a station that is gone, are dropped; a gone driver frees the seat', () => {
    const ghost = { ...vehicle, system: { ...vehicle.system, controllerUuid: 'Actor.deleted' }, flags: { shadowrun2e_unified: { crew942: { seats: { gunner1: 'Actor.deleted', gunner2: 'Actor.pc', sensors: 'Actor.npc' }, ready: { gunner1: true, gunner2: true } } } } };
    assert.deepEqual(mod.crewStateOf(ghost), { seats: { sensors: 'Actor.npc' }, ready: {} });
    const html = mod.crewPanelHtml(ghost, 'sheet3');
    assert.match(html, /data-action="crewClaim" data-station="gunner1"/, 'the ghost\'s station can be claimed');
    assert.doesNotMatch(html, /data-station="gunner2"/);
  });
  test('review (8): any seat change goes to the GM while the driver is someone else\'s', () => {
    const src = read('src', 'module', 'applications', 'crew942.ts');
    assert.match(src, /const driverDocs = req\.op === 'seat' \? \[req\.station === 'driver' \? fromUuidQuiet\(req\.actorUuid \?\? ''\) : null, fromUuidQuiet\(controllerOf\(vehicle\)\)\]/);
  });
  test('wired: sheet actions and render, the relay op, the setting', () => {
    const sheets = read('src', 'module', 'applications', 'sheets.ts');
    assert.match(sheets, /\.\.\.CREW_ACTIONS,/);
    assert.match(sheets, /decorateCrewStations\(this\);/);
    assert.match(read('src', 'module', 'applications', 'socket.ts'), /\| 'crewStation'/);
    assert.match(read('src', 'module', 'settings.ts'), /"crewStations", \{[\s\S]{0,200}default: true/);
  });
});

describe('v0.94.2 review: crew rules', () => {
  test('(2) assign at the driver\'s station needs the actor too', () => {
    const o = { isGM: false, ownsVehicle: true, ownsActor: false, aboard: false, free: true };
    assert.equal(crewMay('assign', { ...o, driver: true }), false);
    assert.equal(crewMay('assign', { ...o, driver: true, ownsActor: true }), true);
    assert.equal(crewMay('assign', o), true);
    assert.equal(crewMay('assign', { ...o, isGM: true, ownsVehicle: false, driver: true }), true);
  });
  test('(6) pruneCrew drops ghosts and their ready marks', () => {
    const st = stationsFor(['turret']);
    const out = pruneCrew({ seats: { gunner1: 'A', gunner2: 'B', sensors: 'X' }, ready: { gunner1: true, gunner2: true, sensors: true, driver: true } }, st, (u) => u !== 'X');
    assert.deepEqual(out, { seats: { gunner1: 'A' }, ready: { gunner1: true, driver: true } });
  });
});
