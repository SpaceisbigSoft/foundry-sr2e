import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { NETRIG_V73 } from '../config73/netrig.ts';
import { RULES } from '../config.ts';
import {
  logoffHoldCheck, personaInitiativePenalty, jackedInInitiativeMinus, initiativeWoundScore,
  hostKnowledge, learnHost, hostEntryKnowledge, hostTag, hostChoices,
  ramSelfOnAttackCard, ramSelfAfterDefense, ramPassengersHurt, controlRigTn,
  sensorLockStamp, sensorLockLapse, sweepSensorLocks,
} from '../gridwork.ts';
import { midTurnWoundDrop } from '../initiative.ts';

const N = NETRIG_V73 as any;
/** Set a dotted path on an object for the length of fn. */
const withPath = (root: any, path: string, value: unknown, fn: () => void) => {
  const keys = path.split('.');
  const last = keys.pop()!;
  const o = keys.reduce((x, k) => x[k], root);
  const old = o[last];
  o[last] = value;
  try { fn(); } finally { o[last] = old; }
};
const withRule = (path: string, value: unknown, fn: () => void) => withPath(N, path, value, fn);

describe('v0.73.0 O22: Graceful Logoff and a black IC hold', () => {
  const hold = { name: 'Black IC 6' };
  test('a held decker cannot log off gracefully', () => {
    const r = logoffHoldCheck({ hold, deckerName: 'Dodger' });
    assert.equal(r.block, true);
    assert.match(r.note, /Black IC 6 is holding Dodger/);
  });
  test('no hold, a frame, the force flag or the GM: no block', () => {
    assert.equal(logoffHoldCheck({ hold: null }).block, false);
    assert.equal(logoffHoldCheck({ hold, frame: true }).block, false);
    assert.equal(logoffHoldCheck({ hold, force: true }).block, false);
    assert.equal(logoffHoldCheck({ hold, isGM: true }).block, false);
  });
  test('gmOverride off: the GM is held to it too', () => {
    withRule('logoffHold.gmOverride', false, () => assert.equal(logoffHoldCheck({ hold, isGM: true }).block, true));
  });
  test('off: the old way', () => {
    withRule('logoffHold.enabled', false, () => assert.equal(logoffHoldCheck({ hold }).block, false));
  });
});

describe('v0.73.0 O23: persona damage on Matrix initiative', () => {
  test('the persona wound bands (1/3/6 boxes = 1/2/3)', () => {
    assert.equal(personaInitiativePenalty(0), 0);
    assert.equal(personaInitiativePenalty(1), 1);
    assert.equal(personaInitiativePenalty(3), 2);
    assert.equal(personaInitiativePenalty(7), 3);
  });
  test('body and persona penalties add, or the worse one counts', () => {
    assert.equal(jackedInInitiativeMinus(2, 3), 4);
    withRule('personaInitiative.combine', 'max', () => assert.equal(jackedInInitiativeMinus(2, 6), 3));
    assert.equal(jackedInInitiativeMinus(1, 0), 1);
  });
  test('off, Matrix wound modifiers off, or initiative wounds off: the body only', () => {
    withRule('personaInitiative.enabled', false, () => assert.equal(jackedInInitiativeMinus(2, 6), 2));
    withPath(RULES, 'MATRIX_V57.wounds.enabled', false, () => assert.equal(jackedInInitiativeMinus(2, 6), 2));
    withPath(RULES, 'INITIATIVE_WOUNDS.enabled', false, () => assert.equal(personaInitiativePenalty(6), 0));
  });
  test('the mid-turn score: persona damage taken while jacked in drops the score', () => {
    const before = initiativeWoundScore({ woundModifier: 1, jackedIn: true, matrixBoxes: 0 });
    const after = initiativeWoundScore({ woundModifier: 1, jackedIn: true, matrixBoxes: 3 });
    assert.equal(midTurnWoundDrop(before, after), 2);
    assert.equal(initiativeWoundScore({ woundModifier: 1, jackedIn: false, matrixBoxes: 6 }), 1);
  });
});

describe('v0.73.0 O24: the hosts a character knows', () => {
  const host = { uuid: 'H1', name: 'Mitsuhama', gridKind: 'host', parentUuid: 'L1', ltgNumber: '(1206) 555-1234', securityCode: 'red', securityValue: 8 };
  const ltg = { uuid: 'L1', name: 'Seattle LTG', gridKind: 'ltg', parentUuid: 'R1', securityCode: 'green', securityValue: 4 };
  const other = { uuid: 'H2', name: 'Stuffer Shack', gridKind: 'host', parentUuid: 'L1', securityCode: 'blue', securityValue: 3 };
  test('a player knows nothing of a host by default; the GM sees all', () => {
    assert.equal(hostKnowledge(host, { known: [] }), 'none');
    assert.equal(hostKnowledge(host, { known: [], isGM: true }), 'analyzed');
  });
  test('known lists, the current node, its parent and a known LTG number', () => {
    assert.equal(hostKnowledge(host, { known: [{ uuid: 'H1', analyzed: false }] }), 'located');
    assert.equal(hostKnowledge(host, { known: [{ uuid: 'H1', analyzed: true }] }), 'analyzed');
    assert.equal(hostKnowledge(host, { known: [], currentUuid: 'H1' }), 'located');
    assert.equal(hostKnowledge(other, { known: [], currentUuid: 'H1', currentParentUuid: 'L1' }), 'none');
    assert.equal(hostKnowledge(ltg, { known: [], currentUuid: 'H1', currentParentUuid: 'L1' }), 'located');
    assert.equal(hostKnowledge(host, { known: [], numbers: ['12065551234'] }), 'located');
  });
  test('public grids: located, analyzed or hidden', () => {
    assert.equal(hostKnowledge(ltg, { known: [] }), 'located');
    withRule('knownHosts.grids', 'analyzed', () => assert.equal(hostKnowledge(ltg, { known: [] }), 'analyzed'));
    withRule('knownHosts.grids', 'hidden', () => assert.equal(hostKnowledge(ltg, { known: [] }), 'none'));
  });
  test('learning never downgrades', () => {
    let k = learnHost([], 'H1', 'located');
    assert.deepEqual(k, [{ uuid: 'H1', analyzed: false }]);
    k = learnHost(k, 'H1', 'analyzed');
    assert.deepEqual(k, [{ uuid: 'H1', analyzed: true }]);
    assert.deepEqual(learnHost(k, 'H1', 'located'), [{ uuid: 'H1', analyzed: true }]);
    assert.equal(hostEntryKnowledge(), 'located');
  });
  test('labels and the list', () => {
    assert.equal(hostTag(host, 'analyzed'), 'HOST Red-8');
    assert.equal(hostTag(host, 'located'), 'HOST, code unknown');
    const list = hostChoices([host, ltg, other], { known: [{ uuid: 'H1', analyzed: false }] });
    assert.deepEqual(list.map((c) => c.label), ['Mitsuhama (HOST, code unknown)', 'Seattle LTG (LTG, code unknown)']);
  });
  test('off: everyone sees every host and its code (the old way)', () => {
    withRule('knownHosts.enabled', false, () => {
      assert.equal(hostChoices([host, ltg, other], { known: [] }).length, 3);
      assert.equal(hostKnowledge(other, { known: [] }), 'analyzed');
    });
  });
});

describe('v0.73.0 O25: ramming', () => {
  const ram = { power: 4, level: 'M' };
  test('the rammer\'s damage waits for the defense', () => {
    assert.equal(ramSelfOnAttackCard(3), false);
    assert.deepEqual(ramSelfAfterDefense({ hit: true, ram }), { offer: true, note: '' });
    const miss = ramSelfAfterDefense({ hit: false, ram, vehicleName: 'Bulldog' });
    assert.equal(miss.offer, false);
    assert.match(miss.note, /Bulldog takes no damage/);
    assert.equal(ramSelfAfterDefense({ hit: true, ram: null }).offer, false);
    assert.equal(ramSelfAfterDefense({ hit: true, ram: { power: 1, level: null } }).offer, false);
  });
  test('off: on the attack card at any success (the old way)', () => {
    withRule('ram.afterDefense', false, () => {
      assert.equal(ramSelfOnAttackCard(1), true);
      assert.equal(ramSelfOnAttackCard(0), false);
      assert.equal(ramSelfAfterDefense({ hit: true, ram }).offer, false);
    });
  });
  test('passengers: attacks and the rammer\'s share carry through, crashes do not', () => {
    assert.equal(ramPassengersHurt({}), true);
    assert.equal(ramPassengersHurt({ crash: true }), false);
    assert.equal(ramPassengersHurt({ crash: true, ramSelf: true }), true);
    withRule('ram.passengers', false, () => assert.equal(ramPassengersHurt({ crash: true, ramSelf: true }), false));
  });
});

describe('v0.73.0 O26: the control rig on gunnery and evasion', () => {
  test('a jumped-in rigger with a rig gets it', () => {
    assert.deepEqual(controlRigTn({ test: 'gunnery', vcr: 2, jumpedIn: true }), [{ label: 'Control rig 2', value: 2 * RULES.RIGGING.vcr.tnPerLevel }]);
    assert.equal(controlRigTn({ test: 'evasion', vcr: 1, jumpedIn: true }).length, 1);
  });
  test('not jumped in, no rig, the switch off, or no TN per level: nothing', () => {
    assert.deepEqual(controlRigTn({ test: 'gunnery', vcr: 2, jumpedIn: false }), []);
    assert.deepEqual(controlRigTn({ test: 'gunnery', vcr: 0, jumpedIn: true }), []);
    withRule('controlRig.gunnery', false, () => assert.deepEqual(controlRigTn({ test: 'gunnery', vcr: 2, jumpedIn: true }), []));
    withPath(RULES, 'RIGGING.vcr.tnPerLevel', 0, () => assert.deepEqual(controlRigTn({ test: 'evasion', vcr: 2, jumpedIn: true }), []));
  });
});

describe('v0.73.0 O27: sensor locks lapse', () => {
  const lock = { targetUuid: 'T', targetName: 'Citymaster', successes: 2, ...sensorLockStamp({ round: 2, worldTime: 100 }) };
  test('the stamp', () => {
    assert.deepEqual(sensorLockStamp({ round: null, worldTime: 50 }), { round: -1, worldTime: 50 });
  });
  test('by Combat Turns', () => {
    assert.equal(sensorLockLapse(lock, { now: { round: 4, worldTime: 106 }, sensorRating: 3 }).lapsed, false);
    const r = sensorLockLapse(lock, { now: { round: 5, worldTime: 109 }, sensorRating: 3 });
    assert.equal(r.lapsed, true);
    assert.match(r.why, /3 Combat Turns/);
  });
  test('by world time outside combat (or a lock made outside combat)', () => {
    const out = { targetUuid: 'T', targetName: 'x', successes: 1, ...sensorLockStamp({ round: null, worldTime: 100 }) };
    assert.equal(sensorLockLapse(out, { now: { round: null, worldTime: 108 }, sensorRating: 3 }).lapsed, false);
    assert.equal(sensorLockLapse(out, { now: { round: 1, worldTime: 109 }, sensorRating: 3 }).lapsed, true);
    assert.equal(sensorLockLapse(lock, { now: { round: null, worldTime: 109 }, sensorRating: 3 }).lapsed, true);
  });
  test('an old lock with no stamp never lapses by time; turns 0 = no time limit', () => {
    assert.equal(sensorLockLapse({}, { now: { round: 99, worldTime: 9999 }, sensorRating: 3 }).lapsed, false);
    withRule('sensorLocks.turns', 0, () => assert.equal(sensorLockLapse(lock, { now: { round: 50, worldTime: 999 }, sensorRating: 3 }).lapsed, false));
  });
  test('range, off the scene, sensors shot out', () => {
    const now = { round: 2, worldTime: 100 };
    assert.equal(sensorLockLapse(lock, { now, metres: 2900, sensorRating: 3 }).lapsed, false);
    assert.match(sensorLockLapse(lock, { now, metres: 3100, sensorRating: 3 }).why, /out of sensor range/);
    assert.equal(sensorLockLapse(lock, { now, metres: null, sensorRating: 3 }).why, 'target gone');
    assert.equal(sensorLockLapse(lock, { now, metres: undefined, sensorRating: 3 }).lapsed, false);
    assert.equal(sensorLockLapse(lock, { now, sensorRating: 3, sensorsOut: true }).why, 'sensors shot out');
    withRule('sensorLocks.range', false, () => assert.equal(sensorLockLapse(lock, { now, metres: 9999, sensorRating: 3 }).lapsed, false));
  });
  test('the sweep', () => {
    const other = { targetUuid: 'U', targetName: 'Roto', successes: 1, ...sensorLockStamp({ round: 2, worldTime: 100 }) };
    const r = sweepSensorLocks([lock, other], { now: { round: 3, worldTime: 103 }, metres: { T: 50, U: null }, sensorRating: 2 });
    assert.deepEqual(r.keep.map((l) => l.targetUuid), ['T']);
    assert.deepEqual(r.dropped, [{ targetUuid: 'U', targetName: 'Roto', why: 'target gone' }]);
  });
  test('off: locks never lapse (the old way)', () => {
    withRule('sensorLocks.enabled', false, () => {
      assert.equal(sensorLockLapse(lock, { now: { round: 50, worldTime: 999 }, metres: null, sensorRating: 1, sensorsOut: true }).lapsed, false);
    });
  });
});

describe('v0.73.0 review fixes (sensor locks)', () => {
  test('a lock from an earlier combat (higher round) falls back to world time', () => {
    const old = { targetUuid: 'T', targetName: 'X', successes: 1, ...sensorLockStamp({ round: 6, worldTime: 100 }) };
    assert.equal(sensorLockLapse(old, { now: { round: 1, worldTime: 200 }, sensorRating: 3 }).lapsed, true);
    assert.equal(sensorLockLapse(old, { now: { round: 1, worldTime: 102 }, sensorRating: 3 }).lapsed, false);
  });
});
