import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import {
  payLifestyle, lifestyleDays, karmaAward, attributeCost, skillCost, legworkTarget, legworkTier, parseAvailability, findTime, itemPrice, DAY_SECONDS,
} from '../upkeep.ts';

describe('upkeep (v0.33.0)', () => {
  test('lifestyle: paying months extends from now or from the old date', () => {
    assert.deepEqual(payLifestyle({ lifestyle: 'low', months: 2, paidUntil: -1, now: 0 }), { cost: 2000, paidUntil: 60 * DAY_SECONDS });
    assert.equal(payLifestyle({ lifestyle: 'middle', months: 1, paidUntil: 10 * DAY_SECONDS, now: 0 }).paidUntil, 40 * DAY_SECONDS);
    assert.equal(lifestyleDays(-1, 0), null);
    assert.equal(lifestyleDays(5 * DAY_SECONDS + 10, 0), 5);
    assert.equal(lifestyleDays(0, 3 * DAY_SECONDS - 5), -3);
  });

  test('Karma: every 10 (human) or 20 (metahuman) earned goes into the pool', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'UPKEEP.karma.poolEvery.human': 10, 'UPKEEP.karma.poolEvery.metahuman': 20 }));
    assert.deepEqual(karmaAward({ careerBefore: 8, amount: 5, metahuman: false }), { good: 4, pool: 1, career: 13 });
    assert.deepEqual(karmaAward({ careerBefore: 8, amount: 5, metahuman: true }), { good: 5, pool: 0, career: 13 });
    assert.deepEqual(karmaAward({ careerBefore: 0, amount: 25, metahuman: false }), { good: 23, pool: 2, career: 25 });
  });

  test('improvement costs', (t) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    t.after(oldWay({ 'UPKEEP.karma.attributeMultiplier': 2, 'CORE_V923.skillKarma': 'old' }));
    t.after(oldWay({ 'DOCS_V79.skillKarma.mode': 'bands' })); // v0.79.0: the old bands (a house rule)
    assert.deepEqual(attributeCost({ to: 5, max: 6 }), { cost: 10, ok: true, reason: '' });
    assert.equal(attributeCost({ to: 7, max: 6 }).ok, false);
    assert.equal(skillCost({ to: 4, attribute: 5, kind: 'active' }), 6);      // 4 ≤ 5: × 1.5
    assert.equal(skillCost({ to: 6, attribute: 5, kind: 'active' }), 12);     // ≤ 7.5: × 2
    assert.equal(skillCost({ to: 8, attribute: 5, kind: 'active' }), 20);     // × 2.5
    assert.equal(skillCost({ to: 3, attribute: 4, kind: 'knowledge' }), 3);
    assert.equal(skillCost({ to: 5, attribute: 4, kind: 'active', specialization: true }), 5); // 5 × 2 ÷ 2
  });

  test('legwork and availability', (t) => {
    t.after(oldWay({"BOOK_V78.legwork.mode": "tn"})); // v0.78.0: the old rule (a house rule)
    assert.equal(legworkTarget({ difficultyTn: 6, contactLevel: 3 }), 4);
    assert.equal(legworkTarget({ difficultyTn: 3, contactLevel: 3 }), 2);
    assert.equal(legworkTier(0), 'Nothing useful');
    assert.equal(legworkTier(9), 'Everything they know');
    assert.deepEqual(parseAvailability('6/14 days'), { tn: 6, hours: 336 });
    assert.deepEqual(parseAvailability('4/48 hrs'), { tn: 4, hours: 48 });
    assert.deepEqual(parseAvailability('8/1 wk'), { tn: 8, hours: 168 });
    assert.deepEqual(parseAvailability('Always'), { tn: 0, hours: 0 });
    assert.deepEqual(parseAvailability('5'), { tn: 5, hours: 24 });
    assert.equal(findTime(48, 3), 16);
    assert.equal(findTime(48, 0), null);
    assert.equal(itemPrice({ cost: 450, streetIndex: 1.5, quantity: 2 }), 1350);
  });
});
