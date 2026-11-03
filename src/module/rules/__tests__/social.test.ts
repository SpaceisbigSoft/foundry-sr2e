import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { perceptionTargets, opposedOutcome, socialAttribute, gruntsStanding, nextGruntSteps, moraleTarget, moraleBroken } from '../social.ts';

describe('perception, social tests, grunts and morale (v0.32.0)', () => {
  test('perception: the observer vs Stealth, the sneaker vs the observer\'s Intelligence', () => {
    assert.deepEqual(perceptionTargets({ stealthRating: 5, observerAttribute: 4 }), { observerTn: 5, sneakerTn: 4 });
    assert.deepEqual(perceptionTargets({ stealthRating: 0, observerAttribute: 1 }), { observerTn: 2, sneakerTn: 2 });
  });

  test('opposed outcomes; ties go to nobody', () => {
    assert.deepEqual(opposedOutcome(3, 1), { winner: 'initiator', net: 2 });
    assert.deepEqual(opposedOutcome(1, 3), { winner: 'defender', net: 2 });
    assert.deepEqual(opposedOutcome(2, 2), { winner: 'none', net: 0 });
  });

  test('social skills and what opposes them', () => {
    assert.equal(socialAttribute('Negotiation'), 'willpower'); // v0.77.0 book check
    assert.equal(socialAttribute('Leadership'), 'intelligence');
    assert.equal(socialAttribute('interrogation'), 'willpower');
    assert.equal(socialAttribute('Etiquette (Street)'), 'charisma');
    assert.equal(socialAttribute('Firearms'), null);
  });

  test('grunts step in until the last one; morale gets harder with casualties', () => {
    assert.equal(gruntsStanding(5, 2), 3);
    assert.equal(gruntsStanding(0, 0), 1);
    assert.equal(nextGruntSteps(5, 3, 'unconscious'), true);
    assert.equal(nextGruntSteps(5, 4, 'unconscious'), false);
    assert.equal(nextGruntSteps(5, 0, 'ok'), false);
    assert.equal(moraleTarget({ casualties: 2, hurt: true }), 7);
    assert.equal(moraleTarget({ casualties: 0, hurt: false }), 4);
    assert.equal(moraleBroken(0), true);
    assert.equal(moraleBroken(1), false);
  });
});
