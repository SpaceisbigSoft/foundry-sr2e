import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { powerPotency, powerTargetNumber, resolvePowerEffect } from '../powers.ts';

const A = { body: 5, quickness: 6, strength: 4, charisma: 3, intelligence: 4, willpower: 2 };

describe('critter powers', () => {
  test('potency from Force, rating, Magic or an attribute', () => {
    assert.equal(powerPotency('force', 3, { attributes: A, force: 6 }), 6);
    assert.equal(powerPotency('force', 3, { attributes: A }), 3);          // no Force: falls back to the rating
    assert.equal(powerPotency('rating', 3, { attributes: A, force: 6 }), 3);
    assert.equal(powerPotency('charisma', 0, { attributes: A }), 3);
    assert.equal(powerPotency('magic', 0, { attributes: A, magic: 5 }), 5);
    assert.equal(powerPotency('rating', -2, { attributes: A }), 0);
  });
  test('TN from the target when there is one', () => {
    assert.deepEqual(powerTargetNumber('willpower', 4, A), { value: 2, fromTarget: true });
    assert.deepEqual(powerTargetNumber('willpower', 4, null), { value: 4, fromTarget: false });
    assert.deepEqual(powerTargetNumber('fixed', 5, A), { value: 5, fromTarget: false });
  });
  test('effect-only resolution', () => {
    assert.deepEqual(resolvePowerEffect(3, 1), { hit: true, netSuccesses: 2 });
    assert.deepEqual(resolvePowerEffect(2, 2), { hit: false, netSuccesses: 0 });
  });
});
