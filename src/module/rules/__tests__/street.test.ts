import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, buildPlan, qualityPoints, qualityCheck, qualityModifiers, movementRates, athleticsTn, athleticsDistance, openTestResult,
  complementaryDice, teamworkDice, streetCred, reputationModifiers, tableModifiers, rallyTarget, paidDice, haggledPrice, fencePrice, buildCheck,
} from '../index.ts';

const withRule = (obj: any, key: string, value: unknown, fn: () => void) => { const old = obj[key]; obj[key] = value; try { fn(); } finally { obj[key] = old; } };

describe('v0.44.0 builder and qualities', () => {
  test('the plan: cash after gear, lifestyle by Resources, contacts, Magic', () => {
    // v0.58.0: the lifestyle month (Low, ¥1,000) now comes out of the cash too.
    assert.deepEqual(buildPlan({ resources: 'C', magic: 'none', gearCost: 30000 }), { nuyen: 59000, lifestyle: 'low', lifestyleMonths: 1, contacts: { count: 2, level: 1 }, magic: 0, lifestyleCost: 1000, contactsCost: 0 });
    assert.equal(buildPlan({ resources: 'A', magic: 'adept', gearCost: 0 }).lifestyle, 'high');
    assert.equal(buildPlan({ resources: 'E', magic: 'full', gearCost: 9000 }).nuyen, 0);
    assert.equal(buildPlan({ resources: 'E', magic: 'full', gearCost: 0 }).magic, 6);
  });

  test('edges and flaws: points, the build-check row, TN modifiers only when switched on', () => {
    const list = [{ name: 'Night vision', kind: 'edge' as const, points: 2, target: 'Perception', tn: -1 }, { name: 'Bad luck', kind: 'flaw' as const, points: 1 }];
    assert.deepEqual(qualityPoints(list), { edges: 2, flaws: 1 });
    assert.equal(qualityCheck(list), null);
    assert.deepEqual(qualityModifiers(list, { skill: 'perception' }), []);
    withRule(RULES.STREET.qualities, 'enabled', true, () => {
      const row = qualityCheck(list)!;
      assert.equal(row.ok, false);
      assert.match(row.note ?? '', /more edges than flaws/);
      assert.deepEqual(qualityModifiers(list, { skill: 'perception' }), [{ label: 'Edge: Night vision', value: -1 }]);
      const rows = buildCheck({ priorities: {}, metatype: 'human', magic: 'none', attributes: {}, intelligence: 3, activeSkills: [], knowledgeSkills: [], gearCost: 0, nuyen: 0, essence: 6, qualities: list });
      assert.ok(rows.some((r) => r.label === 'Edges and flaws'));
    });
  });
});

describe('v0.44.0 movement, athletics and tests', () => {
  test('running by metatype; athletics TNs and distances', () => {
    assert.deepEqual(movementRates(5), { walk: 5, run: 15 });
    assert.deepEqual(movementRates(5, 2), { walk: 5, run: 10 });
    assert.equal(athleticsTn('climb', 'smooth').tn, 6);
    assert.equal(athleticsTn('swim', 'nope').tn, RULES.STREET.athletics.swim[1]!.tn);
    assert.equal(athleticsTn('jump').tn, 4);
    assert.equal(athleticsDistance('climb', 3), 6);
    assert.equal(athleticsDistance('jump', 3, true), 6);
  });

  test('open tests take the highest die; complementary and teamwork dice', () => {
    assert.equal(openTestResult([{ faces: [3], total: 3, success: false }, { faces: [6, 4], total: 10, success: false }]), 10);
    assert.equal(complementaryDice(5), 2);
    assert.equal(teamworkDice([2, 3], 4), 4);
    withRule(RULES.STREET.tests.teamwork, 'cap', 'none', () => assert.equal(teamworkDice([2, 3], 4), 5));
  });
});

describe('v0.44.0 the street', () => {
  test('reputation: Street Cred from Karma; a TN modifier only when switched on and set', () => {
    assert.equal(streetCred({ career: 47, manual: 0 }), 4);
    withRule(RULES.STREET.reputation, 'autoCred', false, () => assert.equal(streetCred({ career: 47, manual: 2 }), 2));
    assert.deepEqual(reputationModifiers(4), []);
    withRule(RULES.STREET.reputation, 'enabled', true, () => withRule(RULES.STREET.reputation, 'socialTnPerCred', 0.5, () => assert.deepEqual(reputationModifiers(4), [{ label: 'Street Cred 4', value: -2 }])));
  });

  test('modifier tables, rallying, paid legwork dice', () => {
    assert.deepEqual(tableModifiers(RULES.STREET.perception, ['distracted', 'searching']), [{ label: 'Observer distracted', value: 2 }, { label: 'Observer actively searching', value: -2 }]);
    assert.deepEqual(tableModifiers(RULES.STREET.social.attitudes, ['neutral']), []);
    assert.equal(rallyTarget(2), 6);
    assert.equal(paidDice(350, 2), 2);
    assert.equal(paidDice(350, 5), 3);
  });

  test('haggling and fencing prices', () => {
    assert.deepEqual(haggledPrice(1000, 2), { price: 900, percent: 10 });
    assert.deepEqual(haggledPrice(1000, -1), { price: 1050, percent: -5 });
    assert.equal(haggledPrice(1000, 10).percent, RULES.STREET.haggle.maxPercent);
    assert.deepEqual(fencePrice(1000, 0), { price: 300, percent: 30 });
    assert.deepEqual(fencePrice(1000, -10), { price: 0, percent: 0 });
    assert.equal(fencePrice(1000, 10).percent, RULES.STREET.fence.maxPercent);
  });
});
