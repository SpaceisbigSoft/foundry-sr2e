/**
 * v0.79.0 (vehicles): the verified fixes backed by Rigger 2 (rules/config79-vehicles.ts). Each switch in
 * RULES.DOCS_V79 defaults to the documents' way; the old way is checked through oldWay().
 */
import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import {
  impactLevel, crashVehicleLevel, ramLevels, mountRecoilComp, mountedRecoil, sensorTableRows, sensorTableModifiers,
  segRigger2, segRows, segConditionModifiers, sensorGunneryByMode, vehicleRepairByMode,
} from '../docs79-vehicles.ts';

describe('v0.79.0 impact damage levels (Rigger 2 Impact Damage Levels table)', () => {
  test('1–20 L, 21–60 M, 61–200 S, 201+ D', () => {
    assert.deepEqual([0, 1, 20, 21, 60, 61, 200, 201, 500].map(impactLevel), ['L', 'L', 'L', 'M', 'M', 'S', 'S', 'D', 'D']);
  });
});

describe('v0.79.0 crash level (DOCS_V79.vehCrashLevel)', () => {
  test('the documents: by speed', () => {
    assert.deepEqual([15, 50, 95, 250].map(crashVehicleLevel), ['L', 'M', 'S', 'D']);
  });
  test('the old way: always the fixed level', (t) => {
    t.after(oldWay({ 'DOCS_V79.vehCrashLevel': 'fixed' }));
    assert.deepEqual([15, 250].map(crashVehicleLevel), [RULES.VEHICLES.crash.vehicleLevel, RULES.VEHICLES.crash.vehicleLevel]);
  });
});

describe('v0.79.0 ramming level (DOCS_V79.vehRamLevel)', () => {
  test('the documents: by the rammer\'s speed, the rammer at the same level', () => {
    assert.deepEqual(ramLevels({ currentSpeed: 40, speed: 100 }), { level: 'M', selfLevel: 'M' });
    assert.deepEqual(ramLevels({ currentSpeed: 120, speed: 100 }), { level: 'S', selfLevel: 'S' });
    assert.deepEqual(ramLevels({ currentSpeed: 15, speed: 100 }), { level: 'L', selfLevel: 'L' });
  });
  test('the old way: M, S above half Speed, the rammer one level lower', (t) => {
    t.after(oldWay({ 'DOCS_V79.vehRamLevel': 'half' }));
    assert.deepEqual(ramLevels({ currentSpeed: 40, speed: 100 }), { level: 'M', selfLevel: 'L' });
    assert.deepEqual(ramLevels({ currentSpeed: 60, speed: 100 }), { level: 'S', selfLevel: 'M' });
  });
});

describe('v0.79.0 mounted recoil (DOCS_V79.vehMountRecoil, Rigger 2 p131)', () => {
  test('the documents: fixed and turret halve (round down), pintle 2 and ring 6 compensation', (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedRecoil': 'freeFirst' })); // the ranged area's recoil count (v0.79.0) has its own tests
    assert.equal(mountRecoilComp('pintle'), 2);
    assert.equal(mountRecoilComp('ring'), 6);
    assert.equal(mountRecoilComp('turret'), 0);
    assert.equal(mountedRecoil({ rounds: 3, mounted: true, mount: 'turret' }), 1);                    // BF: 2 → 1
    assert.equal(mountedRecoil({ rounds: 10, mounted: true, mount: 'fixed' }), 4);                    // 9 → 4
    assert.equal(mountedRecoil({ rounds: 10, mounted: true, mount: 'fixed', recoilComp: 1 }), 3);     // halve, then compensate
    assert.equal(mountedRecoil({ rounds: 10, mounted: true, mount: 'pintle' }), 7);
    assert.equal(mountedRecoil({ rounds: 10, mounted: true, mount: 'ring' }), 3);
    assert.equal(mountedRecoil({ rounds: 3, mounted: true, mount: 'ring' }), 0);
    assert.equal(mountedRecoil({ rounds: 10, mounted: true, mount: 'pintle', heavy: true }), 14);
    assert.equal(mountedRecoil({ rounds: 10, mounted: false, mount: 'fixed' }), 9);                   // not fired as mounted
    assert.equal(mountedRecoil({ rounds: 1, earlierRoundsThisPhase: 0, mounted: true, mount: 'turret' }), 0);
  });
  test('the old way: fixed and turret ignore recoil, pintle gets nothing', (t) => {
    t.after(oldWay({ 'DOCS_V79.vehMountRecoil.mode': 'old', 'DOCS_V79.rangedRecoil': 'freeFirst' }));
    assert.equal(mountRecoilComp('ring'), 0);
    assert.equal(mountedRecoil({ rounds: 10, mounted: true, mount: 'fixed' }), 0);
    assert.equal(mountedRecoil({ rounds: 10, mounted: true, mount: 'pintle' }), 9);
    assert.equal(mountedRecoil({ rounds: 10, mounted: true, mount: 'pintle', heavy: true }), 18);
  });
  test('the old way with mountedIgnoreRecoil off: no help at all', (t) => {
    t.after(oldWay({ 'DOCS_V79.vehMountRecoil.mode': 'old', 'VEHICLES.mountedIgnoreRecoil': false, 'DOCS_V79.rangedRecoil': 'freeFirst' }));
    assert.equal(mountedRecoil({ rounds: 10, mounted: true, mount: 'fixed' }), 9);
  });
});

describe('v0.79.0 sensor test modifiers (DOCS_V79.vehSensorTable, Rigger 2 Sensor Test Modifiers table)', () => {
  test('the documents: the table\'s rows and a spirit\'s Force', () => {
    assert.deepEqual(sensorTableRows().map((r) => [r.id, r.value]), [['directLos', -2], ['urban', 1], ['fog', 1], ['restricted', 1], ['tight', 2]]);
    assert.deepEqual(sensorTableModifiers({ ids: ['directLos', 'tight', 'nope'], spiritForce: 4 }).map((m) => m.value), [-2, 2, 4]);
    assert.deepEqual(sensorTableModifiers({}), []);
  });
  test('the old way: nothing offered', (t) => {
    t.after(oldWay({ 'DOCS_V79.vehSensorTable.mode': 'off' }));
    assert.deepEqual(sensorTableRows(), []);
    assert.deepEqual(sensorTableModifiers({ ids: ['urban'], spiritForce: 3 }), []);
  });
});

describe('v0.79.0 sensor-enhanced gunnery (VEHICLES_V57.sensorGunnery rigger2, Rigger 2 Sensor-Enhanced Targeting Modifiers table)', () => {
  const o = { lock: true, signature: 3, rangeTn: 6, sensor: 5, gunneryDice: 4, targetEcm: 3, firerEccm: 1 };
  test('rigger2: Gunnery + half Sensor vs Signature + ECM beyond ECCM, no movement modifiers', (t) => {
    t.after(oldWay({ 'VEHICLES_V57.sensorGunnery': 'rigger2' }));
    assert.equal(segRigger2(), true);
    const r = sensorGunneryByMode(o);
    assert.equal(r.dice, 6);
    assert.equal(r.replaceRange, true);
    assert.equal(r.noMovement, true);
    assert.deepEqual(r.modifiers.map((m) => m.value), [-3, 2]);
    assert.deepEqual(sensorGunneryByMode({ ...o, signature: 6, targetEcm: 0 }).modifiers, []);
    const none = sensorGunneryByMode({ ...o, lock: false });
    assert.deepEqual([none.dice, none.replaceRange, none.noMovement, none.modifiers.length], [4, false, false, 0]);
    assert.deepEqual(segRows().map((x) => [x.id, x.value]), [['urban', 2], ['directLos', -3], ['interruptedLos', 0]]);
    assert.deepEqual(segConditionModifiers(['urban', 'directLos', 'interruptedLos']).map((m) => m.value), [2, -3]);
  });
  test('the old way (flat): the v0.57.0 flat bonus, no table rows', (t) => {
    t.after(oldWay({ 'VEHICLES_V57.sensorGunnery': 'flat' }));
    assert.equal(segRigger2(), false);
    const r = sensorGunneryByMode(o);
    assert.deepEqual(r.modifiers, [{ label: 'Sensor lock', value: RULES.VEHICLES.sensorLock.tn }]);
    assert.equal(r.dice, 4);
    assert.equal(r.noMovement, false);
    assert.deepEqual(segRows(), []);
    assert.deepEqual(segConditionModifiers(['urban']), []);
  });
  test('the other old way (signature): Gunnery capped at Sensor', (t) => {
    t.after(oldWay({ 'VEHICLES_V57.sensorGunnery': 'signature' }));
    assert.equal(sensorGunneryByMode({ ...o, sensor: 2 }).dice, 2);
  });
});

describe('v0.79.0 vehicle repair time (DOCS_V79.vehRepair, Rigger 2 p26)', () => {
  const base = { successes: 3, condition: 5, systems: {}, destroyed: false, boxesPerSuccess: 1, hoursPerBox: 1, partsFirst: true, rebuild: true, rebuildFactor: 2, fixEnabled: true };
  test('the documents: all the damage, 16 h per box ÷ successes', () => {
    assert.deepEqual(vehicleRepairByMode(base), { boxes: 5, parts: [], rebuild: false, hours: 26.7 });
    assert.deepEqual(vehicleRepairByMode({ ...base, successes: 0 }), { boxes: 0, parts: [], rebuild: false, hours: 0 });
    assert.deepEqual(vehicleRepairByMode({ ...base, successes: 2, systems: { tires: true } }), { boxes: 5, parts: ['tires'], rebuild: false, hours: 48 });
    assert.deepEqual(vehicleRepairByMode({ ...base, successes: 4, condition: 10, destroyed: true }), { boxes: 10, parts: [], rebuild: true, hours: 80 });
    assert.deepEqual(vehicleRepairByMode({ ...base, fixEnabled: false, systems: { tires: true } }), { boxes: 5, parts: [], rebuild: false, hours: 26.7 });
  });
  test('the old way: boxes per success, hours per box', (t) => {
    t.after(oldWay({ 'DOCS_V79.vehRepair.mode': 'perSuccess' }));
    assert.deepEqual(vehicleRepairByMode(base), { boxes: 3, parts: [], rebuild: false, hours: 3 });
    assert.deepEqual(vehicleRepairByMode({ ...base, fixEnabled: false }), { boxes: 3, parts: [], rebuild: false, hours: 3 });
  });
});
