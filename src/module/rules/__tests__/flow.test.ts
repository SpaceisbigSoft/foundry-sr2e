import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { delayValid, fullDefenseCost, fullDefenseActive, canBuySuccess, disasterSuggestion, sessionRefreshDue } from '../flow.ts';
import { RULES } from '../config.ts';

describe('combat flow (v0.35.0)', () => {
  test('a delayed action lasts to the end of the pass', () => {
    const f = { combatId: 'c', round: 2, pass: 0 };
    assert.equal(delayValid(f, { combatId: 'c', round: 2, pass: 0 }), true);
    assert.equal(delayValid(f, { combatId: 'c', round: 2, pass: 1 }), false);
    assert.equal(delayValid(f, { combatId: 'c', round: 3, pass: 0 }), false);
    assert.equal(delayValid(null, { combatId: 'c', round: 2, pass: 0 }), false);
  });
  test('full defense: its cost, and how long it lasts', () => {
    assert.equal(fullDefenseCost({ inCombat: false, ownPhase: false }), 'none');
    assert.equal(fullDefenseCost({ inCombat: true, ownPhase: true }), 'action');
    assert.equal(fullDefenseCost({ inCombat: true, ownPhase: false }), 'initiative');
    const f = { combatId: 'c', round: 1, pass: 0 };
    assert.equal(fullDefenseActive(f, { combatId: 'c', round: 1, pass: 0, reachedOwnTurn: true }), true);
    assert.equal(fullDefenseActive(f, { combatId: 'c', round: 1, pass: 1, reachedOwnTurn: false }), true);
    assert.equal(fullDefenseActive(f, { combatId: 'c', round: 1, pass: 1, reachedOwnTurn: true }), false);
    assert.equal(fullDefenseActive(f, { combatId: 'c', round: 2, pass: 0, reachedOwnTurn: false }), false);
  });
  test('buying successes, disaster suggestions, session refresh', () => {
    assert.deepEqual(canBuySuccess({ successes: 1, poolLeft: 2, botch: false }), { ok: true, cost: 1, reason: '' });
    assert.equal(canBuySuccess({ successes: 0, poolLeft: 2, botch: false }).ok, false);
    assert.equal(canBuySuccess({ successes: 2, poolLeft: 0, botch: false }).ok, false);
    assert.match(disasterSuggestion('attack'), /jams/);
    assert.match(disasterSuggestion('nonsense'), /GM call/);
    assert.equal(sessionRefreshDue('2026-10-18', '2026-10-19'), false); // refresh is 'manual' by default
    (RULES.KARMA as any).refresh = 'session';
    try {
      assert.equal(sessionRefreshDue('2026-10-18', '2026-10-19'), true);
      assert.equal(sessionRefreshDue('2026-10-19', '2026-10-19'), false);
    } finally { (RULES.KARMA as any).refresh = 'manual'; }
  });
});
