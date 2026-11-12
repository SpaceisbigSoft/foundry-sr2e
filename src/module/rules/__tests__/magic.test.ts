import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import {
  spellResistAttribute, drainTargetNumber, drainDamageType, resolveCombatSpell, clampForce,
} from '../magic.ts';

describe('magic rules', () => {
  test('mana resisted by Willpower, physical by Body', () => {
    assert.equal(spellResistAttribute('mana'), 'willpower');
    assert.equal(spellResistAttribute('physical'), 'body');
  });
  test('drain TN is floor(F/2) + modifier, min 2', () => {
    assert.equal(drainTargetNumber(6, 0), 3);
    assert.equal(drainTargetNumber(5, 1), 3);
    assert.equal(drainTargetNumber(8, 2), 6);
    assert.equal(drainTargetNumber(1, 0), 2);
    assert.equal(drainTargetNumber(2, -2), 2);
  });
  test('drain is stun unless Force exceeds Magic', () => {
    assert.equal(drainDamageType(6, 6), 'stun');
    assert.equal(drainDamageType(7, 6), 'physical');
  });
  test('combat spell outcome', (t) => {
    // v0.92.3: the v0.92.2 rule (RULES.SORCERY_V923).
    t.after(oldWay({ 'SORCERY_V923.spellTie': 'v922' }));
    assert.deepEqual(resolveCombatSpell({ casterSuccesses: 2, resistSuccesses: 2, level: 'M' }), { hit: false, netSuccesses: 0, level: null });
    assert.deepEqual(resolveCombatSpell({ casterSuccesses: 3, resistSuccesses: 2, level: 'M' }), { hit: true, netSuccesses: 1, level: 'M' });
    assert.equal(resolveCombatSpell({ casterSuccesses: 5, resistSuccesses: 0, level: 'M' }).level, 'D');
  });
  test('force clamping', () => {
    assert.equal(clampForce(4, 6), 4);
    assert.equal(clampForce(9, 6), 6);
    assert.equal(clampForce(0, 6), 1);
    assert.equal(clampForce(3.7, 6), 3);
    assert.equal(clampForce(NaN, 6), 1);
    assert.equal(clampForce(3, 0), 1);
  });
});
