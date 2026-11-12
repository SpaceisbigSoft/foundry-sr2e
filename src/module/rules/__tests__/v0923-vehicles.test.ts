/**
 * v0.92.3 book alignment: vehicles, rigging and building security (RULES.VEHICLES_V923 and the values moved in place).
 * Each change: the default is the book's (Rigger 2 first, the core book where it is silent, the Corporate Security
 * Handbook for building security), the switch gives the v0.92.2 result, and the Unified Rules Revamp is unchanged.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import { urrMode } from './urrmode.ts';
import { v922Vehicles } from './v922vehicles.ts';
import {
  veh923, drivingRows, drivingModifiers, vcrTnFactor, crashSpeedModifier, vehicleDamageInitiative, vehicleIncomingDamage,
  crashDamage, riggerFeedback, ramDamage, ramSelfPower, bookFireModifiers,
} from '../vehicles.ts';
import {
  veh80PoolCap, veh80GunneryPool, veh80ResistPool, veh80ResistPoolOn, veh80PassengerDamage, veh80PassengersTargeted,
  veh80OccupantArmor, veh80DamagedSpeed, veh80FireModifiers, veh80RepairTn, veh80RamDamage, veh80Feedback,
} from '../urr80-vehicles.ts';
import { controlRigTn } from '../gridwork.ts';
import { speedChangeLimit, bypassPlan } from '../roadwork.ts';
import { bypassOutcome } from '../security.ts';
import { dsCasingModifiers, dsLockToolStep, dsInterceptPlan } from '../urr80-drones-security.ts';
import { actionCost } from '../index.ts';
import { VEHICLES_V923, VEHICLES_V923_OLD, HOUSE_VEHICLES_V923, REVAMP_VEHICLE_RULES } from '../config923/vehicles.ts';
const TEMPLATE = (id: string): any => (RULES.ITEM_TEMPLATES as any[]).find((t) => t.id === id)?.system;

const sum = (m: Array<{ value: number }>) => m.reduce((n, x) => n + x.value, 0);

describe('v0.92.3 vehicles: the switches', () => {
  test('every switch ships at the book way; its old choice is a listed choice; every row is a VEHICLES_V923 path or a moved value', () => {
    for (const [k, old] of Object.entries(VEHICLES_V923_OLD)) {
      const row = HOUSE_VEHICLES_V923.find((r) => r.path === `VEHICLES_V923.${k}`);
      assert.ok(row, k);
      assert.equal(row!.choices?.[0], (VEHICLES_V923 as any)[k], `${k}: first choice is the shipped one`);
      assert.ok(row!.choices?.includes(old as string), `${k}: the old choice is offered`);
      assert.notEqual((VEHICLES_V923 as any)[k], old, k);
    }
  });
  test('under the Revamp a switch for a rule the Revamp changes itself reads its v0.92.2 choice; a book fix the Revamp is silent on applies', (t) => {
    t.after(urrMode());
    for (const [k, old] of Object.entries(VEHICLES_V923_OLD)) {
      if (REVAMP_VEHICLE_RULES.has(k as any)) assert.equal(veh923(k as any), old, k);
      else assert.equal(veh923(k as any), (VEHICLES_V923 as any)[k], k);
    }
    for (const k of ['vcrTn', 'autonavDice', 'autonavMin', 'damageInit', 'accel', 'circuitFail', 'autoCrash']) assert.ok(!REVAMP_VEHICLE_RULES.has(k as any), k);
  });
});

describe('v0.92.3 vehicles: damage to vehicles (Rigger 2 pp. 23, 53)', () => {
  test('anti-vehicle fire loses half the armor (round down), no level drop, never stopped', (t) => {
    const r = vehicleIncomingDamage({ power: 8, level: 'D', armor: 9, antiVehicle: true });
    assert.deepEqual([r.power, r.level, r.armor, r.stopped, r.tn], [8, 'D', 4, false, 4]);
    // armor above twice the Power: still a test, at the minimum TN
    const r2 = vehicleIncomingDamage({ power: 3, level: 'S', armor: 10, antiVehicle: true });
    assert.deepEqual([r2.stopped, r2.tn], [false, 2]);
    t.after(v922Vehicles());
    const o = vehicleIncomingDamage({ power: 8, level: 'D', armor: 9, antiVehicle: true });
    assert.deepEqual([o.armor, o.stopped], [9, true]);
  });
  test('a normal weapon: Power not halved, one level lower, armor still a barrier (powerMultiplier 1)', (t) => {
    assert.equal(RULES.VEHICLES.damage.normalWeapons.powerMultiplier, 1);
    const r = vehicleIncomingDamage({ power: 10, level: 'S', armor: 3 });
    assert.deepEqual([r.power, r.level, r.stopped, r.tn], [10, 'M', false, 7]);
    assert.equal(vehicleIncomingDamage({ power: 6, level: 'S', armor: 6 }).stopped, true);
    t.after(v922Vehicles());
    assert.equal(vehicleIncomingDamage({ power: 10, level: 'S', armor: 3 }).power, 5);
  });
  test('combat spells count their half armor (GEAR.spellsVsVehicles.combatArmor on)', () => {
    assert.equal(RULES.GEAR.spellsVsVehicles.combatArmor, true);
  });
  test("the Control Pool on the vehicle's resistance, at most the rigger's skill", (t) => {
    assert.equal(veh80ResistPoolOn(), true);
    assert.equal(veh80ResistPool(8, 9, 5), 5);
    assert.equal(veh80ResistPool(3, 2, 5), 2);
    t.after(v922Vehicles());
    assert.equal(veh80ResistPoolOn(), false);
    assert.equal(veh80ResistPool(8, 9, 5), 0);
  });
  test('under the Revamp: its own uncapped pool, as before', (t) => {
    t.after(urrMode());
    assert.equal(veh80ResistPool(8, 9, 5), 8);
  });
  test('damage lowers the driver\'s Initiative 1 / 2 / 3 and the Speed 25 % / 50 %', (t) => {
    assert.deepEqual([0, 1, 3, 6, 10].map(vehicleDamageInitiative), [0, 1, 2, 3, 3]);
    assert.deepEqual([0, 1, 3, 6].map((b) => veh80DamagedSpeed(100, b).speed), [100, 100, 75, 50]);
    t.after(v922Vehicles());
    assert.deepEqual([3, 6].map(vehicleDamageInitiative), [0, 0]);
    assert.equal(veh80DamagedSpeed(100, 6).speed, 100);
  });
});

describe('v0.92.3 vehicles: rigger feedback (Rigger 2 p. 49)', () => {
  test('only at Serious (6M) or Destroyed (6S), Physical, with Body', (t) => {
    assert.equal(riggerFeedback({ level: 'M', power: 9 }), null);
    assert.deepEqual(riggerFeedback({ level: 'S', power: 9 }), { tn: 6, level: 'M', type: 'physical', attribute: 'body' });
    assert.deepEqual(veh80Feedback({ level: 'D', power: 9 }), { tn: 6, level: 'S', type: 'physical', attribute: 'body' });
    t.after(v922Vehicles());
    assert.deepEqual(riggerFeedback({ level: 'M', power: 9 }), { tn: 9, level: 'M', type: 'stun' });
  });
});

describe('v0.92.3 vehicles: the Control Pool and the control rig (Rigger 2 pp. 16, 20, 45–48)', () => {
  test('Control Pool dice on a driving test: at most the skill', (t) => {
    assert.equal(veh80PoolCap(8, 5), 5);
    t.after(v922Vehicles());
    assert.equal(veh80PoolCap(8, 5), 8);
  });
  test('gunnery: the Combat Pool for a jumped-in driver and a security rigger', (t) => {
    assert.equal(veh80GunneryPool('control', 'driver'), 'combat');
    assert.equal(veh80GunneryPool('control', 'security'), 'combat');
    assert.equal(veh80GunneryPool('combat', 'gunner'), 'combat');
    t.after(v922Vehicles());
    assert.equal(veh80GunneryPool('control', 'driver'), 'control');
    assert.equal(veh80GunneryPool('control', 'security'), 'control');
  });
  test('the Revamp leaves a security rigger to the security rules (Control Pool), as before', (t) => {
    t.after(urrMode());
    assert.equal(veh80GunneryPool('control', 'driver'), 'combat');
    assert.equal(veh80GunneryPool('control', 'security'), 'control');
  });
  test('no Control Pool on sensor tests; a sensor test is Complex', (t) => {
    assert.equal(RULES.VEHICLES.sensors.controlPool, false);
    assert.equal(actionCost('sensor'), 'complex');
    t.after(v922Vehicles());
    assert.equal(RULES.VEHICLES.sensors.controlPool, true);
    assert.equal(actionCost('sensor'), 'simple');
  });
  test('the rig: ×2 on a Driving Test, ×1 on maneuvers and rams, none on crash tests, gunnery, sensors, evasion', (t) => {
    const rig = (kind: any) => sum(drivingModifiers({ mode: 'jumped', vcr: 2, kind }).filter((m) => /Control rig/.test(m.label)));
    assert.deepEqual([rig('driving'), rig('maneuver'), rig('ram'), rig('crash'), rig('evasion')], [-4, -2, -2, 0, 0]);
    assert.deepEqual(['gunnery', 'sensor'].map((k) => vcrTnFactor(k as any)), [0, 0]);
    assert.deepEqual(controlRigTn({ test: 'gunnery', vcr: 2, jumpedIn: true }), []);
    t.after(v922Vehicles());
    assert.deepEqual([rig('driving'), rig('maneuver'), rig('crash')], [-2, -2, -2]);
    assert.equal(controlRigTn({ test: 'gunnery', vcr: 2, jumpedIn: true })[0]?.value, -2);
  });
  test('under the Revamp (silent on the control rig) the book\'s rig applies too: a book fix reaches Revamp worlds', (t) => {
    t.after(urrMode());
    const rig = (kind: any) => sum(drivingModifiers({ mode: 'jumped', vcr: 2, kind }).filter((m) => /Control rig/.test(m.label)));
    assert.deepEqual([rig('driving'), rig('maneuver'), rig('crash')], [-4, -2, 0]);
  });
});

describe('v0.92.3 vehicles: the Driving Test table (Rigger 2 p. 20)', () => {
  test('the book rows; the old rows behind the switch; the Revamp keeps its own', (t) => {
    const val = (id: string) => drivingRows().find((r) => r.id === id)?.value;
    assert.deepEqual(['easy', 'hard', 'large', 'veryLarge', 'inCombat', 'datajack', 'unfamiliar'].map(val), [-1, 3, 2, 3, 2, -1, 1]);
    assert.equal(sum(drivingModifiers({ mode: 'manual', situational: ['hard', 'large'] })), 5);
    const restore = oldWay({ 'VEHICLES_V923.drivingRows': 'old' });
    assert.deepEqual(['hard', 'large'].map(val), [2, undefined]);
    restore();
    t.after(urrMode());
    assert.equal(val('heavyCongested'), 4);
  });
  test('Crash Test: terrain −1 / 0 / +2 / +4 and the speed against Reaction × 20 / 30 / 40', (t) => {
    const terr = (terrain: string, kind: any) => sum(drivingModifiers({ mode: 'manual', terrain, kind }));
    assert.deepEqual(['open', 'normal', 'restricted', 'tight'].map((x) => terr(x, 'crash')), [-1, 0, 2, 4]);
    assert.deepEqual(['open', 'normal', 'restricted', 'tight'].map((x) => terr(x, 'ram')), [-1, 0, 1, 2]);
    assert.deepEqual(['restricted', 'tight'].map((x) => terr(x, 'driving')), [1, 3]);
    assert.deepEqual([50, 120, 170, 300].map((s) => crashSpeedModifier(s, 5)?.value ?? 0), [0, 1, 2, 4]);
    t.after(v922Vehicles());
    assert.deepEqual(['restricted', 'tight'].map((x) => terr(x, 'crash')), [1, 3]);
    assert.equal(terr('tight', 'ram'), 3);
  });
});

describe('v0.92.3 vehicles: impacts (Rigger 2 pp. 47, 50, 52)', () => {
  test('crash Power: speed ÷ 10 rounded up, no minimum', (t) => {
    assert.deepEqual([crashDamage(155).power, crashDamage(5).power], [16, 1]);
    t.after(v922Vehicles());
    assert.deepEqual([crashDamage(155).power, crashDamage(5).power], [15, 2]);
  });
  test('ramming: the speed difference, its level; the rammer less Body × successes (TN at least 2)', (t) => {
    // the book's example: 300 vs 152 → 15S; Body 3 × 5 successes takes it to the minimum
    const r = ramDamage({ body: 3, currentSpeed: 152, speed: 200, otherSpeed: 300 });
    assert.deepEqual([r.power, r.level, r.selfPower, r.selfLevel, r.bodyPerSuccess], [15, 'S', 15, 'S', 3]);
    assert.equal(ramSelfPower(r, 5), 2);
    assert.equal(ramSelfPower(r, 2), 9);
    assert.equal(veh80RamDamage({ body: 3, currentSpeed: 152, speed: 200, otherSpeed: 300 }).power, 15);
    t.after(v922Vehicles());
    const o = ramDamage({ body: 3, currentSpeed: 152, speed: 200, otherSpeed: 300 });
    assert.equal(o.power, 3 + 15);
    assert.equal(ramSelfPower(o, 5), o.power);
  });
  test('a pedestrian: speed ÷ 10 one level higher (a Destroyed-level hit + half the Power); the vehicle a level lower', () => {
    const p = ramDamage({ body: 3, currentSpeed: 60, speed: 100, pedestrian: true });
    assert.deepEqual([p.power, p.level, p.selfLevel], [6, 'S', 'L']);
    const fast = ramDamage({ body: 3, currentSpeed: 250, speed: 300, pedestrian: true });
    assert.deepEqual([fast.power, fast.level, fast.selfLevel], [25 + 12, 'D', 'S']);
    assert.equal(ramDamage({ body: 3, currentSpeed: 15, speed: 100, pedestrian: true }).selfLevel, null);
  });
  test('the Revamp ram is unchanged', (t) => {
    t.after(urrMode());
    const r = veh80RamDamage({ body: 3, armor: 2, currentSpeed: 152, speed: 200, otherSpeed: null });
    assert.deepEqual([r.power, r.level, r.selfPower], [16, 'S', 16 - 4]);
  });
});

describe('v0.92.3 vehicles: people aboard (Rigger 2 pp. 50, 53)', () => {
  test('a weapon hit on the vehicle reaches no one aboard; an impact does, at its Power and level', (t) => {
    assert.equal(veh80PassengersTargeted(), true);
    assert.equal(veh80PassengerDamage({ power: 10, level: 'S', vehicleArmor: 2 }), null);
    assert.deepEqual(veh80PassengerDamage({ power: 10, level: 'S', vehicleArmor: 2, impact: true }), { power: 10, level: 'S' });
    t.after(v922Vehicles());
    assert.deepEqual(veh80PassengerDamage({ power: 10, level: 'S', vehicleArmor: 2 }), { power: 8, level: 'M' });
  });
  test('shot inside: the higher of Armor or Body', (t) => {
    assert.equal(veh80OccupantArmor({ body: 5, armor: 2 }), 5);
    t.after(v922Vehicles());
    assert.equal(veh80OccupantArmor({ body: 5, armor: 2 }), 2);
  });
});

describe('v0.92.3 vehicles: manual gunnery (Rigger 2 p. 57)', () => {
  const car = { vehicle: true, category: 'car' };
  test('relative speed (speeds under 5 count as 5), the target size, an unmounted weapon', (t) => {
    const v = (m: any[], id: string) => m.find((x) => x.id === id)?.value ?? 0;
    const m = bookFireModifiers({ firing: { speed: 100, currentSpeed: 100 }, mounted: false, targetSpeed: 40, target: car });
    assert.deepEqual([v(m, 'relativeSpeed'), v(m, 'targetSize'), v(m, 'unmountedWeapon')], [4, -1, 2]);
    assert.equal(v(bookFireModifiers({ firing: { speed: 100, currentSpeed: 100 }, mounted: true, targetSpeed: 90, target: car }), 'relativeSpeed'), 0);
    assert.equal(v(bookFireModifiers({ firing: null, targetSpeed: 60, target: car }), 'relativeSpeed'), 6);
    assert.equal(v(bookFireModifiers({ firing: { speed: 100, currentSpeed: 3 }, mounted: true, targetSpeed: 2, target: car }), 'relativeSpeed'), 0);
    // through the Revamp wrapper (its switch at the book way)
    assert.equal(v(veh80FireModifiers({ firing: { speed: 100, currentSpeed: 100, mounted: true }, mounted: true, targetSpeed: 30, target: car }), 'relativeSpeed'), 6);
    t.after(v922Vehicles());
    const o = veh80FireModifiers({ firing: { speed: 100, currentSpeed: 100, mounted: true }, mounted: true, targetMoving: true, targetSpeed: 30, target: car });
    assert.equal(sum(o), 2 + 1); // above half its Speed +2, the target moving +1
  });
});

describe('v0.92.3 vehicles: speed and repair (Rigger 2 pp. 22, 26, 45)', () => {
  test('safe braking up to Acceleration × 4', (t) => {
    assert.equal(speedChangeLimit({ accel: 10, from: 100, to: 50 }).max, 40);
    t.after(v922Vehicles());
    assert.equal(speedChangeLimit({ accel: 10, from: 100, to: 50 }).max, 20);
  });
  test('repair TN: the boxes repaired + 2', (t) => {
    assert.deepEqual([veh80RepairTn(3, 4), veh80RepairTn(10, 4), veh80RepairTn(1, 4, 0)], [5, 12, 2]);
    t.after(v922Vehicles());
    assert.equal(veh80RepairTn(3, 4), 4);
  });
  test('Load leaves out passengers; a missile needs a lock; the remote control deck at 5,000¥ × Rating', () => {
    assert.equal(RULES.VEHICLES.cargo.personKg, 0);
    assert.equal(RULES.DRONES_V73.missiles.needsLock, true);
    const rcd = TEMPLATE('rcd');
    assert.deepEqual([rcd.cost / rcd.rcdRating, rcd.weight, rcd.signal], [5000, 3, 2]);
  });
});

describe('v0.92.3 building security (CSH p. 100)', () => {
  const tools = (kind: string, rating: number) => [{ kind, rating, name: kind }];
  test('a card reader casing at twice the rating', (t) => {
    assert.equal(sum(dsCasingModifiers('card', 4)), 4);
    assert.equal(sum(dsCasingModifiers('keypad', 4)), 0);
    t.after(v922Vehicles());
    assert.equal(sum(dsCasingModifiers('card', 4)), 0);
  });
  test('no successes on the circuit: a passive alert as well as the tally (a disaster still active)', (t) => {
    assert.deepEqual(bypassOutcome(0, false, 'circuit'), { opened: false, tally: RULES.SECURITY.bypass.failTally, minAlert: 'passive' });
    assert.equal(bypassOutcome(0, true, 'circuit').minAlert, 'active');
    assert.equal(bypassOutcome(0, false, 'casing').minAlert, '');
    t.after(v922Vehicles());
    assert.equal(bypassOutcome(0, false, 'circuit').minAlert, '');
  });
  test('a passkey: its rating vs the reader, the casing left shut; a sequencer: opposed with the keypad', (t) => {
    const p = bypassPlan({ rating: 5, lockType: 'card', casing: 5, casingOpen: false, skillDice: 3, tools: tools('passkey', 3), light: null, vision: {} });
    assert.deepEqual([p.step, p.dice, p.tn, p.modifiers.length], ['circuit', 3, 5, 0]);
    // Review fix: a better skill works the lock instead (through the casing); a passkey's failure is an alarm.
    assert.equal(bypassPlan({ rating: 5, lockType: 'card', casing: 5, casingOpen: false, skillDice: 6, tools: tools('passkey', 3), light: null, vision: {} }).step, 'casing');
    { const u = oldWay({ 'VEHICLES_V923.circuitFail': 'tally' }); try { assert.equal(bypassOutcome(0, false, 'circuit', { passkey: true }).minAlert, 'passive'); assert.equal(bypassOutcome(0, false, 'circuit').minAlert, ''); } finally { u(); } }
    const s = dsLockToolStep({ lockType: 'keypad', rating: 5, skillDice: 2, tools: tools('sequencer', 4) });
    assert.deepEqual([s?.step, s?.dice], ['voice', 4]);
    t.after(v922Vehicles());
    const o = bypassPlan({ rating: 5, lockType: 'card', casing: 5, casingOpen: false, skillDice: 6, tools: tools('passkey', 3), light: null, vision: {} });
    assert.equal(o.step, 'casing');
    assert.equal(dsLockToolStep({ lockType: 'keypad', rating: 5, skillDice: 2, tools: tools('sequencer', 4) }), null);
  });
  test("intercepting a drone's link: the deck rating vs the target deck + 3, decryption first", (t) => {
    const plan = dsInterceptPlan({ ownRcd: 6, targetRcd: 3, pilot: 2, encryption: 4, hasEwSkill: true });
    assert.equal(plan?.intercept.dice, 6);
    assert.equal(plan!.intercept.baseTn + sum(plan!.intercept.modifiers), 6);
    assert.equal(plan?.decrypt?.baseTn, 4);
    assert.equal(plan?.decrypt?.need, 2);
    t.after(v922Vehicles());
    assert.equal(dsInterceptPlan({ ownRcd: 6, targetRcd: 3, pilot: 2, encryption: 4, hasEwSkill: true }), null);
  });
});
