/**
 * v0.80.0 (vehicles): the Unified Rules Revamp's vehicle rules (rules/urr80-vehicles.ts). Each function is checked
 * with the shipped (book) values, where it must act as before, and under urrMode().
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { urrMode } from './urrmode.ts';
import { crashDamage, ramDamage, passengerDamage, riggerFeedback, vehicleIncomingDamage, vehicleFireModifiers } from '../vehicles.ts';
import {
  veh80ConditionLevel, veh80PoolCap, veh80GunneryPool, veh80ResistPool, veh80Feedback, veh80AutoStage, veh80Incoming,
  veh80PassengerDamage, veh80CrashPassengerLevel, veh80OccupantArmor, veh80CrashDamage, veh80BodyArmorFactor, veh80RamDamage,
  veh80DamagedSpeed, veh80SpeedDifference, veh80TargetSize, veh80FireModifiers, veh80HeavyRecoil, veh80RepairTn,
} from '../urr80-vehicles.ts';

describe('v0.80.0 vehicles: shipped values are the book way', () => {
  test('switches ship off', () => {
    const u = RULES.URR_V80;
    assert.equal(u.vehCpCap, 'none');
    assert.equal(u.vehCpGunnery, 'control');
    assert.equal(u.vehCpResist, false);
    assert.equal(u.vehFeedback.mode, 'book');
    assert.equal(u.vehDamage.mode, 'book');
    assert.equal(u.vehPassengers, 'book');
    assert.equal(u.vehOccupantArmor, 'book');
    assert.equal(u.vehImpact, 'book');
    assert.equal(u.vehDamageSpeed.mode, 'book');
    assert.equal(u.vehGunnery.mode, 'book');
    assert.equal(u.vehMountHeavy, 'book');
    assert.equal(u.vehRepairTn.mode, 'book');
  });

  test('every function gives the book result', () => {
    assert.equal(veh80PoolCap(6, 3), 6);
    assert.equal(veh80GunneryPool('control', 'driver'), 'control');
    assert.equal(veh80ResistPool(4, 6), 0);
    assert.deepEqual(veh80Feedback({ level: 'L', power: 7 }), riggerFeedback({ level: 'L', power: 7 }));
    const inc = { power: 8, level: 'S' as const, armor: 3 };
    assert.deepEqual(veh80Incoming({ ...inc, body: 4, rawArmor: 3, hit: { basePower: 8 } }), vehicleIncomingDamage(inc));
    assert.deepEqual(veh80Incoming({ ...inc, antiVehicle: true, body: 4 }), vehicleIncomingDamage({ ...inc, antiVehicle: true }));
    assert.deepEqual(veh80PassengerDamage({ power: 8, level: 'S', vehicleArmor: 2, impact: true }), passengerDamage({ power: 8, level: 'S', vehicleArmor: 2 }));
    assert.equal(veh80CrashPassengerLevel('M', 'S'), 'M');
    assert.equal(veh80OccupantArmor({ body: 6, armor: 2 }), 2);
    assert.deepEqual(veh80CrashDamage(95), crashDamage(95));
    assert.deepEqual(veh80RamDamage({ body: 4, armor: 2, currentSpeed: 80, speed: 120, otherSpeed: 60 }), ramDamage({ body: 4, currentSpeed: 80, speed: 120 }));
    assert.deepEqual(veh80DamagedSpeed(100, 7), { speed: 100, note: '' });
    const fire = { firing: { speed: 100, currentSpeed: 80, damageBoxes: 0, mounted: true }, targetMoving: true, sensorLock: false };
    assert.deepEqual(veh80FireModifiers({ ...fire, mounted: true, targetSpeed: 20, target: { vehicle: true, category: 'car' } }), vehicleFireModifiers(fire));
    assert.equal(veh80HeavyRecoil(true, true), true);
    assert.equal(veh80RepairTn(7, 4), 4);
  });
});

describe('v0.80.0 vehicles under the Unified Rules Revamp', () => {
  test('condition levels', () => {
    assert.deepEqual([0, 1, 2, 3, 5, 6, 9, 10].map(veh80ConditionLevel), [null, 'L', 'L', 'M', 'M', 'S', 'S', 'D']);
  });

  test('Control Pool: at most the skill on driving tests; Combat Pool on a driver\'s gunnery; any dice on resistance', (t) => {
    t.after(urrMode());
    assert.equal(veh80PoolCap(6, 3), 3);
    assert.equal(veh80PoolCap(2, 3), 2);
    assert.equal(veh80GunneryPool('control', 'driver'), 'combat');
    assert.equal(veh80GunneryPool('control', 'security'), 'control');
    assert.equal(veh80GunneryPool('combat', 'gunner'), 'combat');
    assert.equal(veh80ResistPool(4, 6), 4);
    assert.equal(veh80ResistPool(8, 6), 6);
  });

  test('rigger feedback: only Serious (6M) and Deadly (6S), Body, Physical', (t) => {
    t.after(urrMode());
    assert.equal(veh80Feedback({ level: 'L', power: 9 }), null);
    assert.equal(veh80Feedback({ level: 'M', power: 9 }), null);
    assert.deepEqual(veh80Feedback({ level: 'S', power: 9 }), { tn: 6, level: 'M', type: 'physical', attribute: 'body' });
    assert.deepEqual(veh80Feedback({ level: 'D', power: 9 }), { tn: 6, level: 'S', type: 'physical', attribute: 'body' });
  });

  test('weapon damage: Power − (Body + Armor), automatic staging by Body', (t) => {
    t.after(urrMode());
    assert.deepEqual([1, 2, 3, 5, 6, 8, 9, 12].map(veh80AutoStage), [1, 1, 2, 2, 3, 3, 4, 4]);
    // 12S from a normal weapon at a Body 4, Armor 2 car: TN 6, S staged down 2 → L.
    const r = veh80Incoming({ power: 12, level: 'S', armor: 2, body: 4, rawArmor: 2, hit: { basePower: 12 } });
    assert.equal(r.tn, 6);
    assert.equal(r.level, 'M', 'a base Power of 10+ negates one step');
    const r2 = veh80Incoming({ power: 9, level: 'S', armor: 2, body: 4, rawArmor: 2, hit: { basePower: 9 } });
    assert.equal(r2.level, 'L');
    assert.equal(r2.tn, 3);
    // Power reduced to 0 or below: Power 2.
    const low = veh80Incoming({ power: 6, level: 'D', armor: 2, body: 4, rawArmor: 2, hit: { basePower: 6 } });
    assert.equal(low.tn, 2);
    assert.equal(low.level, 'M');
    // Base Power not above the armor: no damage.
    const stop = veh80Incoming({ power: 4, level: 'M', armor: 4, body: 2, rawArmor: 4 });
    assert.equal(stop.stopped, true);
    // Staged two or more below Light: nothing.
    assert.equal(veh80Incoming({ power: 8, level: 'L', armor: 0, body: 6, rawArmor: 0 }).stopped, true);
  });

  test('anti-vehicle and armor-piercing rounds halve the armor; anti-vehicle skips the staging', (t) => {
    t.after(urrMode());
    const av = veh80Incoming({ power: 10, level: 'S', armor: 6, antiVehicle: true, body: 4, rawArmor: 6, hit: { basePower: 10 } });
    assert.equal(av.tn, 3);
    assert.equal(av.level, 'S');
    const ap = veh80Incoming({ power: 10, level: 'S', armor: 3, armorMultiplied: true, body: 4, rawArmor: 6, hit: { basePower: 10 } });
    assert.equal(ap.tn, 3);
    assert.equal(ap.level, 'M', 'still staged (2 by Body 4, less 1 for Power 10)');
  });

  test('combat spells: half the armor, no staging, always a test; impacts: Power, no armor; stun does nothing', (t) => {
    t.after(urrMode());
    const sp = veh80Incoming({ power: 5, level: 'D', armor: 0, body: 4, rawArmor: 8, ignoreArmor: true, hit: { spell: true } });
    assert.deepEqual([sp.tn, sp.level, sp.stopped], [2, 'D', false]);
    const crash = veh80Incoming({ power: 9, level: 'S', armor: 0, crash: true, body: 4, rawArmor: 3 });
    assert.deepEqual([crash.tn, crash.level, crash.stopped], [9, 'S', false]);
    const ram = veh80Incoming({ power: 7, level: 'M', armor: 3, antiVehicle: true, body: 4, rawArmor: 3, hit: { impact: true } });
    assert.deepEqual([ram.tn, ram.level], [7, 'M']);
    assert.equal(veh80Incoming({ power: 7, level: 'M', armor: 0, damageType: 'stun', body: 4 }).stopped, true);
  });

  test('passengers: only impacts carry through, at the vehicle\'s Power and level; crash at the vehicle\'s level', (t) => {
    t.after(urrMode());
    assert.equal(veh80PassengerDamage({ power: 8, level: 'S', vehicleArmor: 2 }), null);
    assert.deepEqual(veh80PassengerDamage({ power: 8, level: 'S', vehicleArmor: 2, impact: true }), { power: 8, level: 'S' });
    assert.equal(veh80PassengerDamage({ power: 8, level: null, vehicleArmor: 2, impact: true }), null);
    assert.equal(veh80CrashPassengerLevel('M', 'S'), 'S');
    assert.equal(veh80OccupantArmor({ body: 6, armor: 2 }), 6);
    assert.equal(veh80OccupantArmor({ body: 2, armor: 5 }), 5);
  });

  test('impacts: crash Power rounds up; ram Power from the ramming speed, the rammer less its Body-Armor factor', (t) => {
    t.after(urrMode());
    assert.equal(veh80CrashDamage(95).power, 10);
    assert.equal(veh80CrashDamage(5).power, RULES.VEHICLES.crash.minPower);
    assert.equal(veh80BodyArmorFactor(3, 3), 4);
    const head = veh80RamDamage({ body: 3, armor: 2, currentSpeed: 75, speed: 120 });
    assert.deepEqual(head, { power: 8, level: 'S', selfPower: 4, selfLevel: 'S', rammingSpeed: 75 });
    const chase = veh80RamDamage({ body: 6, armor: 4, currentSpeed: 110, speed: 120, otherSpeed: 80 });
    assert.deepEqual(chase, { power: 3, level: 'M', selfPower: 0, selfLevel: null, rammingSpeed: 30 });
  });

  test('damage slows the vehicle: Moderate ×0.75, Serious ×0.5', (t) => {
    t.after(urrMode());
    assert.deepEqual(veh80DamagedSpeed(100, 2), { speed: 100, note: '' });
    assert.equal(veh80DamagedSpeed(100, 3).speed, 75);
    assert.equal(veh80DamagedSpeed(90, 6).speed, 45);
  });

  test('manual gunnery: speed difference and target size replace the moving modifiers', (t) => {
    t.after(urrMode());
    assert.equal(veh80SpeedDifference(0, 0), null);
    assert.equal(veh80SpeedDifference(100, 90), null);
    assert.equal(veh80SpeedDifference(100, 50)?.value, 2);
    assert.equal(veh80SpeedDifference(30, 100)?.value, 4);
    assert.equal(veh80SpeedDifference(100, 20)?.value, 6);
    assert.equal(veh80SpeedDifference(60, 0)?.value, 6);
    assert.equal(veh80TargetSize({ vehicle: true, category: 'car' })?.value, -1);
    assert.equal(veh80TargetSize({ vehicle: true, category: 'lta' })?.value, -6);
    assert.equal(veh80TargetSize({ vehicle: true, category: 'car', drone: true })?.value, 1);
    assert.equal(veh80TargetSize({ vehicle: true, category: 'bike' }), null);
    assert.equal(veh80TargetSize({ vehicle: false }), null);
    const fire = { firing: { speed: 100, currentSpeed: 80, damageBoxes: 3, mounted: true }, targetMoving: true, sensorLock: false };
    const mods = veh80FireModifiers({ ...fire, mounted: true, targetSpeed: 20, target: { vehicle: true, category: 'car' } });
    assert.deepEqual(mods.map((m) => m.value), [RULES.VEHICLES.damageTnMods ? 2 : 0, 4, -1].filter((v) => v));
    // Not a vehicle target, not mounted, or sensor-enhanced: the book's modifiers.
    assert.deepEqual(veh80FireModifiers({ ...fire, mounted: true, targetSpeed: null }), vehicleFireModifiers(fire));
    assert.deepEqual(veh80FireModifiers({ ...fire, mounted: false, targetSpeed: 20 }), vehicleFireModifiers(fire));
    assert.deepEqual(veh80FireModifiers({ ...fire, mounted: true, still: true, targetSpeed: 20 }), vehicleFireModifiers(fire));
  });

  test('heavy weapons on a mount: no doubling; repair TN by stage', (t) => {
    t.after(urrMode());
    assert.equal(veh80HeavyRecoil(true, true), false);
    assert.equal(veh80HeavyRecoil(true, false), true);
    assert.deepEqual([1, 3, 6, 10].map((b) => veh80RepairTn(b, 4)), [2, 4, 6, 8]);
    assert.equal(veh80RepairTn(0, 4), 4);
  });

  test('patched tables: open terrain −2, the driving rows, the sensor table, no Control Pool on sensors', (t) => {
    t.after(urrMode());
    assert.equal(RULES.VEHICLES.terrain.find((x) => x.id === 'open')?.value, -2);
    assert.equal(RULES.VEHICLES.drivingModifiers.find((x) => x.id === 'hard')?.value, 3);
    assert.ok(RULES.VEHICLES.drivingModifiers.some((x) => x.id === 'poorVisibility'), 'the visibility row stays');
    assert.equal(RULES.DOCS_V79.vehSensorTable.rows.find((x) => x.id === 'open')?.value, -1);
    assert.equal(RULES.VEHICLES.sensors.controlPool, false);
    assert.equal(RULES.ACTIONS.costs['sensor'], 'complex');
  });
});
