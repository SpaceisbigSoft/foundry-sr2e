import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toxinResistDice, toxinSpeed, effectEnds, effectEnded, fallingDamage, fireDamage, exposureTest, blindModifier } from '../hazards.ts';

describe('toxins, drugs and hazards (v0.31.0)', () => {
  test('toxin resistance: Body plus toxin dice; inhalant dice only for inhaled toxins', () => {
    assert.equal(toxinResistDice({ attribute: 5, toxinDice: 2, inhalantDice: 3, vector: 'inhalation' }), 10);
    assert.equal(toxinResistDice({ attribute: 5, toxinDice: 2, inhalantDice: 3, vector: 'injection' }), 7);
    assert.equal(toxinResistDice({ attribute: 2, toxinDice: -4, inhalantDice: 0, vector: 'contact' }), 0);
  });

  test('speeds and timed effects', () => {
    assert.equal(toxinSpeed('minute').seconds, 60);
    assert.equal(toxinSpeed('nonsense').id, 'immediate');
    assert.deepEqual(effectEnds({ round: 3, worldTime: 100, seconds: 600 }), { round: 203, worldTime: 700 });
    assert.deepEqual(effectEnds({ round: null, worldTime: 0, seconds: 9 }), { round: -1, worldTime: 9 });
    assert.equal(effectEnded({ round: 5, worldTime: 700 }, { round: 5 }), true);
    assert.equal(effectEnded({ round: 5, worldTime: 700 }, { round: 4, worldTime: 600 }), false);
    assert.equal(effectEnded({ round: -1, worldTime: 9 }, { worldTime: 9 }), true);
  });

  test('falling and fire: Power, level, and half impact armor', () => {
    assert.deepEqual(fallingDamage(7.6, { impact: 5, ballistic: 3 }), { power: 7, level: 'S', armor: 2 });
    assert.deepEqual(fireDamage('blaze', { impact: 4, ballistic: 0 }), { power: 8, level: 'S', armor: 2, label: 'Blaze' });
    assert.equal(fireDamage('nonsense', { impact: 0, ballistic: 0 }).label, 'Small fire');
  });

  test('drowning, cold and fatigue: Body against a rising TN', () => {
    assert.deepEqual(exposureTest('drowning', 3), { tn: 7, level: 'M', type: 'stun', label: 'Drowning (3 turns under)' });
    assert.equal(exposureTest('cold', 'freezing').tn, 6);
    assert.equal(exposureTest('fatigue', 4).tn, 7);
    assert.equal(exposureTest('fatigue', 0).tn, 4);
  });

  test('blinded: +8 to attacks and spells, nothing else by default', () => {
    assert.equal(blindModifier('attack'), 8);
    assert.equal(blindModifier('spell'), 8);
    assert.equal(blindModifier('other'), 0);
  });
});
