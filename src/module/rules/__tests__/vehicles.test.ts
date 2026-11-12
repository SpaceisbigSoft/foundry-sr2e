import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import {
  vehicleCategory, controlRigRating, riggedStats, controlPool, autopilotStats, vehicleDamageModifier, vehicleDestroyed,
  handlingFor, drivingModifiers, vehicleIncomingDamage, applyVehicleDamage, crashDamage, riggerFeedback, overSpeed,
} from '../vehicles.ts';
import { RULES } from '../config.ts';
import { useV922Vehicles } from './v922vehicles.ts';

describe('vehicles and rigging (v0.24.0)', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  test('categories name their default skill; unknown falls back to other', () => {
    assert.equal(vehicleCategory('rotor').skill, 'Rotor Aircraft');
    assert.equal(vehicleCategory('nope').id, 'other');
  });

  test('control rig: the best installed rating, capped', () => {
    assert.equal(controlRigRating([{ installed: true, controlRig: 1 }, { installed: true, controlRig: 2 }, { installed: false, controlRig: 3 }]), 2);
    assert.equal(controlRigRating([{ controlRig: 9 }]), RULES.RIGGING.maxVcr);
    assert.equal(controlRigRating([]), 0);
  });

  test('rigged Reaction drops cyber reflexes and adds 2 per rig level; dice 1 + level', () => {
    assert.deepEqual(riggedStats({ reaction: 8, cyberReaction: 2, cyberDice: 1, vcr: 2 }), { reaction: 10, initiativeDice: 3 });
    const keep = RULES.RIGGING.cyberReflexesWhileRigging;
    (RULES.RIGGING as any).cyberReflexesWhileRigging = true;
    try {
      assert.deepEqual(riggedStats({ reaction: 8, cyberReaction: 2, cyberDice: 1, vcr: 2 }), { reaction: 12, initiativeDice: 4 });
    } finally { (RULES.RIGGING as any).cyberReflexesWhileRigging = keep; }
  });

  test('Control Pool: the rigged Reaction, none without a rig', () => {
    assert.equal(controlPool({ reaction: 5, riggedReaction: 9, vcr: 2 }), 9);
    assert.equal(controlPool({ reaction: 5, riggedReaction: 9, vcr: 0 }), 0);
    const keep = RULES.RIGGING.controlPool.from;
    (RULES.RIGGING.controlPool as any).from = 'reaction';
    try { assert.equal(controlPool({ reaction: 5, riggedReaction: 9, vcr: 1 }), 5); } finally { (RULES.RIGGING.controlPool as any).from = keep; }
  });

  test('autopilot: Reaction = rating x 2, 1 die', () => {
    assert.deepEqual(autopilotStats(3), { reaction: 6, initiativeDice: 1 });
  });

  test('vehicle damage modifiers follow the wound thresholds; destroyed at 10', () => {
    assert.deepEqual([0, 1, 3, 6, 10, 14].map(vehicleDamageModifier), [0, 1, 2, 3, 3, 3]);
    assert.equal(vehicleDestroyed(9), false);
    assert.equal(vehicleDestroyed(10), true);
  });

  test('handling: off-road uses the second value when there is one', () => {
    assert.equal(handlingFor({ handling: 4, handlingOffroad: 8 }, true), 8);
    assert.equal(handlingFor({ handling: 4, handlingOffroad: 0 }, true), 4);
    assert.equal(handlingFor({ handling: 4, handlingOffroad: 8 }, false), 4);
  });

  test('driving modifiers: terrain, maneuvers, damage and the rig when jumped in', () => {
    const mods = drivingModifiers({ terrain: 'tight', situational: ['hard', 'nope'], damageBoxes: 3, mode: 'jumped', vcr: 2 });
    assert.deepEqual(mods, [
      { label: 'Tight terrain', value: 3 }, { label: 'Hard maneuver', value: 2 },
      { label: 'Vehicle damage', value: 2 }, { label: 'Control rig 2', value: -2 },
    ]);
    assert.deepEqual(drivingModifiers({ terrain: 'normal', mode: 'manual', vcr: 2 }), []);
    assert.deepEqual(drivingModifiers({ terrain: 'open', mode: 'autopilot' }), [{ label: 'Open terrain', value: -1 }]);
  });

  test('incoming damage: normal weapons halved and a level lower; armor at or above Power stops it', () => {
    const pistol = vehicleIncomingDamage({ power: 9, level: 'M', armor: 3 });
    assert.deepEqual({ p: pistol.power, l: pistol.level, s: pistol.stopped }, { p: 4, l: 'L', s: false });
    assert.equal(pistol.tn, 2);
    const stopped = vehicleIncomingDamage({ power: 6, level: 'M', armor: 4 });
    assert.equal(stopped.stopped, true);                       // 3 <= 4
    const av = vehicleIncomingDamage({ power: 12, level: 'D', armor: 6, antiVehicle: true });
    assert.deepEqual({ p: av.power, l: av.level, s: av.stopped, tn: av.tn }, { p: 12, l: 'D', s: false, tn: 6 });
    const light = vehicleIncomingDamage({ power: 8, level: 'L', armor: 0 });
    assert.equal(light.level, null);
    assert.equal(light.stopped, true);
  });

  test('vehicle condition track fills and destroys', () => {
    assert.deepEqual(applyVehicleDamage(2, 'M'), { after: 5, boxes: 3, destroyed: false });
    assert.deepEqual(applyVehicleDamage(5, 'S'), { after: 10, boxes: 6, destroyed: true });
    assert.deepEqual(applyVehicleDamage(5, null), { after: 5, boxes: 0, destroyed: false });
  });

  test('crash damage from speed', () => {
    assert.deepEqual(crashDamage(95), { power: 9, vehicleLevel: 'S', passengerLevel: 'M' });
    assert.equal(crashDamage(50).vehicleLevel, 'M');   // v0.79.0 (DOCS_V79.vehCrashLevel 'speed'): by the impact table
    assert.equal(crashDamage(250).vehicleLevel, 'D');
    assert.equal(crashDamage(5).power, RULES.VEHICLES.crash.minPower);
  });

  test('feedback to a jumped-in rigger', () => {
    assert.deepEqual(riggerFeedback({ level: 'M', power: 7 }), { tn: 7, level: 'M', type: 'stun' });
    assert.equal(riggerFeedback({ level: null, power: 7 }), null);
    assert.equal(riggerFeedback({ level: 'L', power: 1 })?.tn, 2);
  });

  test('over speed', () => {
    assert.equal(overSpeed(120, 100), true);
    assert.equal(overSpeed(100, 100), false);
    assert.equal(overSpeed(50, 0), false);
  });
});

import { oldWay } from './oldway.ts';
import {
  canFireMount, mountedSkill, vehicleFireModifiers, passengerDamage, ramDamage, sensorTarget,
  rcdCapacity, chaseSpeedModifier, chaseTurn,
} from '../vehicles.ts';

describe('vehicle combat, sensors, remote decks, chases (v0.25.0)', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  test('who may fire which mount', () => {
    assert.deepEqual(['driver', 'gunner', 'autopilot'].map((r) => canFireMount('fixed', r as any)), [true, false, true]);
    assert.deepEqual(['driver', 'gunner', 'autopilot'].map((r) => canFireMount('turret', r as any)), [true, true, true]);
    assert.deepEqual(['driver', 'gunner', 'autopilot'].map((r) => canFireMount('pintle', r as any)), [false, true, false]);
    assert.deepEqual(['driver', 'gunner', 'autopilot'].map((r) => canFireMount('ring', r as any)), [false, true, false]); // v0.79.0
    assert.equal(canFireMount('none', 'driver'), false);
  });

  test('mounted weapons use Gunnery unless they name a skill; fixed and turret mounts ignore recoil', () => {
    assert.equal(mountedSkill(''), 'Gunnery');
    assert.equal(mountedSkill('Heavy Weapons'), 'Heavy Weapons');
  });

  test('firing from and at moving vehicles, vehicle damage and a sensor lock', () => {
    assert.deepEqual(vehicleFireModifiers({ firing: { speed: 100, currentSpeed: 30, damageBoxes: 3, mounted: true }, targetMoving: true, sensorLock: true }), [
      { label: 'Firing from a moving vehicle', value: 1 }, { label: 'Vehicle damage', value: 2 },
      { label: 'Target in a moving vehicle', value: 1 }, { label: 'Sensor lock', value: -2 },
    ]);
    assert.deepEqual(vehicleFireModifiers({ firing: { speed: 100, currentSpeed: 80, damageBoxes: 3 } }), [{ label: 'Firing from a fast vehicle', value: 2 }]);
    assert.deepEqual(vehicleFireModifiers({ firing: { speed: 100, currentSpeed: 0 } }), []);
  });

  test('passengers take what gets through the armor, a level lower', () => {
    assert.deepEqual(passengerDamage({ power: 10, level: 'S', vehicleArmor: 4 }), { power: 6, level: 'M' });
    assert.equal(passengerDamage({ power: 10, level: 'L', vehicleArmor: 4 }), null);
    assert.equal(passengerDamage({ power: 4, level: 'D', vehicleArmor: 4 }), null);
  });

  test('ramming: Body + speed/10, Serious when fast; the rammer takes half a level lower', (t) => {
    t.after(oldWay({ 'DOCS_V79.vehRamLevel': 'half' })); // v0.79.0: the old rule (a house rule)
    assert.deepEqual(ramDamage({ body: 4, currentSpeed: 40, speed: 100 }), { power: 8, level: 'M', selfPower: 4, selfLevel: 'L' });
    assert.equal(ramDamage({ body: 4, currentSpeed: 60, speed: 100 }).level, 'S');
  });

  test('sensor TN: Signature + ECM beyond ECCM', () => {
    assert.deepEqual(sensorTarget({ signature: 4, targetEcm: 3, scannerEccm: 1 }), { tn: 4, modifiers: [{ label: 'ECM 3 − ECCM 1', value: 2 }] });
    assert.deepEqual(sensorTarget({ signature: 1, targetEcm: 2, scannerEccm: 4 }), { tn: 2, modifiers: [] });
  });

  test('remote deck capacity', () => {
    assert.equal(rcdCapacity(3), 3); // v0.77.0: one per rating point
    assert.equal(rcdCapacity(0), 0);
  });

  test('chases: speed advantage, drift and positioning', () => {
    assert.equal(chaseSpeedModifier(100, 55), -2);
    assert.equal(chaseSpeedModifier(200, 0), -3);
    assert.equal(chaseSpeedModifier(50, 60), 0);
    assert.deepEqual(chaseTurn({ metres: 100, pursuerSpeed: 90, quarrySpeed: 80, pursuerSuccesses: 3, quarrySuccesses: 1 }), { metres: 80, drift: -10, shift: -10, winner: 'pursuer' });
    assert.equal(chaseTurn({ metres: 5, pursuerSpeed: 90, quarrySpeed: 60, pursuerSuccesses: 0, quarrySuccesses: 0 }).metres, 0);
    assert.equal(chaseTurn({ metres: 50, pursuerSpeed: 60, quarrySpeed: 60, pursuerSuccesses: 0, quarrySuccesses: 2 }).winner, 'quarry');
  });
});
