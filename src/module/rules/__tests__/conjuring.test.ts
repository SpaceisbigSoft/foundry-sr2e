import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampSpiritForce, conjuringDrainTargetNumber, conjuringDrainLevel, conjuringDrainType,
  servicesForSuccesses, spiritAttribute, immunityArmor, maxBoundElementals, resolveBanishing,
} from '../conjuring.ts';

describe('conjuring rules', () => {
  test('force clamps to a whole number of at least 1', () => {
    assert.equal(clampSpiritForce(4), 4);
    assert.equal(clampSpiritForce(4.9), 4);
    assert.equal(clampSpiritForce(0), 1);
    assert.equal(clampSpiritForce(NaN), 1);
  });
  test('drain TN is the Force, minimum 2', () => {
    assert.equal(conjuringDrainTargetNumber(5), 5);
    assert.equal(conjuringDrainTargetNumber(1), 2);
  });
  test('drain level from Force vs Charisma', () => {
    // Charisma 6: <=3 L, <=6 M, <=9 S, above D
    assert.equal(conjuringDrainLevel(3, 6), 'L');
    assert.equal(conjuringDrainLevel(4, 6), 'M');
    assert.equal(conjuringDrainLevel(6, 6), 'M');
    assert.equal(conjuringDrainLevel(7, 6), 'S');
    assert.equal(conjuringDrainLevel(9, 6), 'S');
    assert.equal(conjuringDrainLevel(10, 6), 'D');
    // Odd Charisma: 5 -> <=2.5 L
    assert.equal(conjuringDrainLevel(2, 5), 'L');
    assert.equal(conjuringDrainLevel(3, 5), 'M');
  });
  test('drain is physical only when Force exceeds Magic', () => {
    assert.equal(conjuringDrainType(6, 6), 'stun');
    assert.equal(conjuringDrainType(7, 6), 'physical');
  });
  test('services equal successes', () => {
    assert.equal(servicesForSuccesses(3), 3);
    assert.equal(servicesForSuccesses(0), 0);
    assert.equal(servicesForSuccesses(-1), 0);
  });
  test('spirit attributes are Force plus offset, at least 1', () => {
    assert.equal(spiritAttribute(4, 0), 4);
    assert.equal(spiritAttribute(4, 2), 6);
    assert.equal(spiritAttribute(2, -3), 1);
  });
  test('immunity armor is twice Force when immune', () => {
    assert.equal(immunityArmor(5, true), 10);
    assert.equal(immunityArmor(5, false), 0);
  });
  test('bound elementals limited by Charisma', () => {
    assert.equal(maxBoundElementals(4), 4);
  });
  test('banishing lowers Force by net successes', () => {
    assert.deepEqual(resolveBanishing({ banisherSuccesses: 3, spiritSuccesses: 1, force: 5 }), { netSuccesses: 2, force: 3, banished: false });
    assert.deepEqual(resolveBanishing({ banisherSuccesses: 1, spiritSuccesses: 2, force: 5 }), { netSuccesses: 0, force: 5, banished: false });
    assert.deepEqual(resolveBanishing({ banisherSuccesses: 7, spiritSuccesses: 0, force: 4 }), { netSuccesses: 7, force: 0, banished: true });
  });
});
