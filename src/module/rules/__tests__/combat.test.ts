import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { rangeBandForDistance, attackBaseTargetNumber, armorKindFor, resolveAttack } from '../combat.ts';

const limits = { short: 5, medium: 20, long: 40, extreme: 60 };

describe('rangeBandForDistance', () => {
  test('picks the nearest band that contains the distance', () => {
    assert.equal(rangeBandForDistance(0, limits), 'short');
    assert.equal(rangeBandForDistance(5, limits), 'short');
    assert.equal(rangeBandForDistance(5.1, limits), 'medium');
    assert.equal(rangeBandForDistance(40, limits), 'long');
    assert.equal(rangeBandForDistance(60, limits), 'extreme');
  });
  test('beyond extreme is out of range', () => {
    assert.equal(rangeBandForDistance(60.5, limits), null);
  });
});

describe('attackBaseTargetNumber', () => {
  test('ranged uses the band TN and labels it', () => {
    assert.deepEqual(attackBaseTargetNumber({ melee: false, range: 'long' }), { label: 'Range: long', value: 6 });
  });
  test('ranged defaults to short', () => {
    assert.equal(attackBaseTargetNumber({ melee: false }).value, 4);
  });
  test('melee ignores range', () => {
    assert.deepEqual(attackBaseTargetNumber({ melee: true, range: 'extreme' }), { label: 'Melee', value: 4 });
  });
});

describe('armorKindFor', () => {
  test('ballistic vs ranged, impact vs melee', () => {
    assert.equal(armorKindFor(false), 'ballistic');
    assert.equal(armorKindFor(true), 'impact');
  });
});

describe('resolveAttack', () => {
  test('defender matching or beating the attacker is a miss', () => {
    assert.deepEqual(resolveAttack({ attackSuccesses: 2, defenseSuccesses: 2, power: 9, level: 'M' }),
      { hit: false, netSuccesses: 0, power: 9, level: null });
    assert.equal(resolveAttack({ attackSuccesses: 1, defenseSuccesses: 4, power: 9, level: 'M' }).hit, false);
  });
  test('no attacker successes is a miss', () => {
    assert.equal(resolveAttack({ attackSuccesses: 0, defenseSuccesses: 0, power: 9, level: 'M' }).hit, false);
  });
  test('one net success hits at the base level', () => {
    assert.deepEqual(resolveAttack({ attackSuccesses: 3, defenseSuccesses: 2, power: 9, level: 'M' }),
      { hit: true, netSuccesses: 1, power: 9, level: 'M' });
  });
  test('net successes stage the damage up', () => {
    assert.equal(resolveAttack({ attackSuccesses: 4, defenseSuccesses: 0, power: 9, level: 'M' }).level, 'S');
    assert.equal(resolveAttack({ attackSuccesses: 9, defenseSuccesses: 0, power: 9, level: 'M' }).level, 'D');
  });
  test('power passes through unchanged', () => {
    assert.equal(resolveAttack({ attackSuccesses: 5, defenseSuccesses: 0, power: 12, level: 'L' }).power, 12);
  });
});
