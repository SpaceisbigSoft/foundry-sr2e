import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import {
  speedChangeLimit, clampSpeed, pushResult, speedLimited, crashTestAfterDamage, vehiclePart,
  vehicleCalledShotModifier, vehicleSystemsEffect, maneuverScore, maneuverPosition, positionModifier,
  sensorGunnery, designVehicle, lockTypeOf, bypassTool, bypassPlan,
} from '../roadwork.ts';
import { useV922Vehicles } from './v922vehicles.ts';

const R = RULES as any;
const V = R.VEHICLES_V57;
const S = R.SECURITY_V57;

describe('v0.57.0 acceleration', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  test('accelerating is limited to Accel (+ extra)', () => {
    assert.deepEqual(speedChangeLimit({ accel: 10, from: 50, to: 60 }), { allowed: true, max: 10, braking: false, change: 10 });
    assert.equal(speedChangeLimit({ accel: 10, from: 50, to: 61 }).allowed, false);
    assert.equal(speedChangeLimit({ accel: 10, from: 50, to: 75, extra: 15 }).allowed, true);
  });
  test('braking doubles the limit, extra too', () => {
    const r = speedChangeLimit({ accel: 10, from: 50, to: 30 });
    assert.equal(r.braking, true);
    assert.equal(r.max, 20);
    assert.equal(r.change, -20);
    assert.equal(r.allowed, true);
    assert.equal(speedChangeLimit({ accel: 10, from: 50, to: 10, extra: 10 }).max, 40);
  });
  test('brakeMultiplier house rule', () => {
    V.accel.brakeMultiplier = 3;
    try { assert.equal(speedChangeLimit({ accel: 10, from: 50, to: 30 }).max, 30); } finally { V.accel.brakeMultiplier = 2; }
  });
  test('clampSpeed', () => {
    assert.deepEqual(clampSpeed({ accel: 10, turnStart: 50, to: 80 }), { speed: 60, clamped: true, limit: 10 });
    assert.deepEqual(clampSpeed({ accel: 10, turnStart: 50, to: 0 }), { speed: 30, clamped: true, limit: 20 });
    assert.deepEqual(clampSpeed({ accel: 10, turnStart: 50, to: 55 }), { speed: 55, clamped: false, limit: 10 });
    assert.equal(clampSpeed({ accel: 10, turnStart: 5, to: 0 }).speed, 0);
    assert.equal(clampSpeed({ accel: 10, turnStart: 5, to: -10 }).speed, 0);
    assert.equal(clampSpeed({ accel: 10, turnStart: 50, to: 80, extra: 20 }).speed, 80);
  });
  test('pushResult', () => {
    assert.deepEqual(pushResult(0, false, 10), { extra: 0, crash: false });
    assert.deepEqual(pushResult(2, false, 10), { extra: 20, crash: false });
    assert.deepEqual(pushResult(0, true, 10), { extra: 0, crash: true });
    V.accel.perSuccess = 0.5;
    try { assert.equal(pushResult(2, false, 10).extra, 10); } finally { V.accel.perSuccess = 1; }
  });
  test('speedLimited', () => {
    assert.equal(speedLimited(true), true);
    assert.equal(speedLimited(false), false);
    V.accel.outsideCombat = 'limited';
    try { assert.equal(speedLimited(false), true); } finally { V.accel.outsideCombat = 'free'; }
    V.accel.enabled = false;
    try { assert.equal(speedLimited(true), false); } finally { V.accel.enabled = true; }
  });
});

describe('v0.57.0 crash test after damage', () => {
  test('Serious or worse to a moving, intact vehicle', () => {
    assert.equal(crashTestAfterDamage('S', true, false), true);
    assert.equal(crashTestAfterDamage('D', true, false), true);
    assert.equal(crashTestAfterDamage('M', true, false), false);
    assert.equal(crashTestAfterDamage('S', false, false), false);
    assert.equal(crashTestAfterDamage('D', true, true), false);
    assert.equal(crashTestAfterDamage(null, true, false), false);
  });
  test('house rules: at L, disabled', () => {
    V.crashAfterDamage.at = 'L';
    try { assert.equal(crashTestAfterDamage('L', true, false), true); } finally { V.crashAfterDamage.at = 'S'; }
    V.crashAfterDamage.enabled = false;
    try { assert.equal(crashTestAfterDamage('D', true, false), false); } finally { V.crashAfterDamage.enabled = true; }
  });
});

describe('v0.57.0 called shots at vehicles', () => {
  test('parts and modifiers', () => {
    assert.equal(vehiclePart('tires')?.crashTn, 2);
    assert.equal(vehiclePart('nope'), null);
    assert.equal(vehiclePart(null), null);
    assert.deepEqual(vehicleCalledShotModifier('tires'), { label: 'Called shot: Tires', value: 4 });
    assert.deepEqual(vehicleCalledShotModifier('occupant'), { label: 'Called shot: An occupant', value: 6 });
    assert.equal(vehicleCalledShotModifier('wings').value, 4);
  });
  test('vehicleSystemsEffect', () => {
    const base = { handling: 4, handlingOffroad: 0, sensor: 1, speed: 105 };
    const none = vehicleSystemsEffect({}, base);
    assert.deepEqual(none, { ...base, notes: [] });
    const all = vehicleSystemsEffect({ tires: true, sensors: true, engine: true }, base);
    assert.equal(all.handling, 5);
    assert.equal(all.handlingOffroad, 0);
    assert.equal(all.sensor, 0);
    assert.equal(all.speed, 52);
    assert.equal(all.notes.length, 3);
    assert.equal(all.notes[0], 'Tires shot out (Handling +1)');
    assert.equal(vehicleSystemsEffect({ tires: true }, { ...base, handlingOffroad: 6 }).handlingOffroad, 7);
  });
});

describe('v0.57.0 maneuver scores', () => {
  test('maneuverScore', () => {
    assert.equal(maneuverScore({ successes: 3, speed: 50 }), 5);
    assert.equal(maneuverScore({ successes: 3, speed: 500 }), 7);
    assert.equal(maneuverScore({ successes: 2, speed: -40 }), 2);
  });
  test('maneuverPosition', () => {
    assert.deepEqual(maneuverPosition(5, 3), { winner: 'a', net: 2, tn: 2 });
    assert.deepEqual(maneuverPosition(1, 9), { winner: 'b', net: 8, tn: 3 });
    assert.deepEqual(maneuverPosition(4, 4), { winner: 'none', net: 0, tn: 0 });
    V.maneuver.netPerTn = 2;
    try { assert.equal(maneuverPosition(5, 2).tn, 1); } finally { V.maneuver.netPerTn = 1; }
  });
  test('positionModifier only in score mode and the same round', () => {
    const pos = { winnerUuid: 'A', loserUuid: 'B', tn: 2, round: 3 };
    assert.equal(positionModifier(pos, 'A', 'B', 3), null);
    V.maneuver.mode = 'score';
    try {
      assert.deepEqual(positionModifier(pos, 'A', 'B', 3), { label: 'Maneuver position', value: -2 });
      assert.deepEqual(positionModifier(pos, 'B', 'A', 3), { label: 'Out-maneuvered', value: 2 });
      assert.equal(positionModifier(pos, 'A', 'C', 3), null);
      assert.equal(positionModifier(pos, 'A', 'B', 4), null);
      assert.equal(positionModifier(pos, 'A', 'B', null), null);
      assert.equal(positionModifier({ ...pos, tn: 0 }, 'A', 'B', 3), null);
      assert.equal(positionModifier(null, 'A', 'B', 3), null);
    } finally { V.maneuver.mode = 'gap'; }
  });
});

describe('v0.57.0 sensor-enhanced gunnery', () => {
  const o = { lock: true, signature: 3, rangeTn: 6, sensor: 2, gunneryDice: 5 };
  test('flat', () => {
    // roadwork.sensorGunnery is the old way's function ('flat' / 'signature'); v0.79.0's 'rigger2' is docs79-vehicles.sensorGunneryByMode.
    const r = sensorGunnery(o);
    assert.deepEqual(r.modifiers, [{ label: 'Sensor lock', value: -2 }]);
    assert.equal(r.dice, 5);
    assert.equal(r.replaceRange, false);
    assert.deepEqual(sensorGunnery({ ...o, lock: false }).modifiers, []);
  });
  test('signature', () => {
    V.sensorGunnery = 'signature';
    try {
      const r = sensorGunnery(o);
      assert.equal(r.replaceRange, true);
      assert.deepEqual(r.modifiers, [{ label: 'Sensor lock: Signature 3 instead of range 6', value: -3 }]);
      assert.equal(r.dice, 2);
      assert.match(r.note, /capped/);
      assert.deepEqual(sensorGunnery({ ...o, signature: 6 }).modifiers, []);
      assert.equal(sensorGunnery({ ...o, sensor: 0 }).dice, 5);
      const none = sensorGunnery({ ...o, lock: false });
      assert.equal(none.replaceRange, false);
      assert.equal(none.dice, 5);
    } finally { V.sensorGunnery = 'rigger2'; } // v0.79.0: the shipped default
  });
});

describe('v0.57.0 vehicle design', () => {
  test('base build', () => {
    const r = designVehicle({ chassis: 'sedan', powerplant: 'performance', spend: {} })!;
    assert.deepEqual(r.stats, { body: 3, handling: 4, speed: 137, accel: 12, armor: 0, signature: 2, cf: 12, mounts: 0 });
    assert.deepEqual(r.points, { total: 12, spent: 0, left: 12 });
    assert.equal(r.cost, 40000);
    assert.deepEqual(r.warnings, []);
  });
  test('spending points', () => {
    const r = designVehicle({ chassis: 'compact', powerplant: 'gasoline', spend: { armor: 3, handling: 5, speed: 2, mounts: 1, body: -4 } })!;
    assert.equal(r.stats.armor, 3);
    assert.equal(r.stats.handling, 1);
    assert.equal(r.stats.speed, 110);
    assert.equal(r.stats.mounts, 1);
    assert.equal(r.stats.body, 2);
    assert.equal(r.points.spent, 6 + 15 + 2 + 2);
    assert.equal(r.points.left, 10 - 25);
    assert.equal(r.cost, 15000 + 2000 + 9000 + 25000 + 2000 + 2500);
    assert.deepEqual(r.warnings, ['Over the design points', 'Armor above Body × 1']);
  });
  test('unknown parts', () => {
    assert.equal(designVehicle({ chassis: 'tank', powerplant: 'gasoline', spend: {} }), null);
    assert.equal(designVehicle({ chassis: 'van', powerplant: 'fusion', spend: {} }), null);
  });
});

describe('v0.57.0 maglocks', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  const base = { rating: 4, lockType: 'keypad', casing: 0, casingOpen: false, skillDice: 3, tools: [], light: null, vision: {} };
  test('lookups', () => {
    assert.equal(lockTypeOf('retina').tn, 3);
    assert.equal(lockTypeOf('bogus').id, '');
    assert.equal(lockTypeOf(null).id, '');
    assert.equal(bypassTool('sequencer')?.mode, 'replace');
    assert.equal(bypassTool('lockpick'), null);
    assert.equal(bypassTool(undefined), null);
  });
  test('casing first', () => {
    const r = bypassPlan({ ...base, casing: 1, light: 'minimal' });
    assert.equal(r.step, 'casing');
    assert.equal(r.tn, 2);
    assert.equal(r.dice, 3);
    assert.equal(r.tool, null);
    assert.deepEqual(r.modifiers, [{ label: 'Minimal light', value: 3 }]); // v0.79.0 docs check: +6 × 0.5 (was +4 × 0.5)
    assert.equal(bypassPlan({ ...base, casing: 5, casingOpen: true }).step, 'circuit');
  });
  test('no tools', () => {
    const r = bypassPlan(base);
    assert.equal(r.step, 'circuit');
    assert.equal(r.tn, 4);
    assert.deepEqual(r.modifiers, [{ label: 'No tools', value: 2 }]);
    assert.equal(r.tool, null);
  });
  test('replace tool', () => {
    const r = bypassPlan({ ...base, tools: [{ kind: 'sequencer', rating: 6, name: 'Seq' }] });
    assert.equal(r.dice, 6);
    assert.equal(r.tool?.mode, 'replace');
    assert.deepEqual(r.modifiers, []);
  });
  test('kit works on any lock; picks the biggest benefit', () => {
    const r = bypassPlan({ ...base, lockType: 'retina', tools: [{ kind: 'sequencer', rating: 6, name: 'Seq' }, { kind: 'electronicsKit', rating: 5, name: 'Kit' }] });
    assert.equal(r.tool?.kind, 'electronicsKit');
    assert.equal(r.dice, 3);
    assert.deepEqual(r.modifiers, [{ label: 'Retinal scanner', value: 3 }, { label: 'Kit 5', value: -2 }]);
    const k = bypassPlan({ ...base, tools: [{ kind: 'sequencer', rating: 4, name: 'Seq' }, { kind: 'maglockKit', rating: 3, name: 'MK' }] });
    assert.equal(k.tool?.kind, 'maglockKit');
    const s = bypassPlan({ ...base, tools: [{ kind: 'sequencer', rating: 8, name: 'Seq' }, { kind: 'maglockKit', rating: 3, name: 'MK' }] });
    assert.equal(s.tool?.kind, 'sequencer');
  });
  test('a kit that does not work still counts as tools', () => {
    const r = bypassPlan({ ...base, lockType: 'print', tools: [{ kind: 'sequencer', rating: 6, name: 'Seq' }] });
    assert.equal(r.tool, null);
    assert.deepEqual(r.modifiers, [{ label: 'Print scanner', value: 4 }]); // v0.77.0 book check
  });
  test('dice mode tool (house rule) and light factor', (t) => {
    t.after(oldWay({ 'DOCS_V79.visionCyberNatural': 'single' })); // v0.79.0: one vision column (a house rule)
    S.tools[0].mode = 'dice';
    try {
      const r = bypassPlan({ ...base, tools: [{ kind: 'sequencer', rating: 2, name: 'Seq' }], light: 'darkness', vision: { thermographic: true } });
      assert.equal(r.dice, 5);
      assert.deepEqual(r.modifiers, [{ label: 'Total darkness (thermographic)', value: 2 }]);
    } finally { S.tools[0].mode = 'replace'; }
    S.light.enabled = false;
    try { assert.deepEqual(bypassPlan({ ...base, light: 'darkness' }).modifiers, [{ label: 'No tools', value: 2 }]); } finally { S.light.enabled = true; }
    assert.equal(bypassPlan({ ...base, light: 'partial', vision: { lowLight: true } }).modifiers.length, 1);
  });
});
