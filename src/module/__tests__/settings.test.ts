import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const g = globalThis as any;
let mod: any;
let RULES: any;

before(async () => {
  g.foundry = { applications: { api: { ApplicationV2: class {} } } };
  mod = await import('../settings.ts');
  ({ RULES } = await import('../rules/index.ts'));
});

describe('house rules', () => {
  test('every curated rule path exists, with a value of its declared type', () => {
    for (const d of mod.HOUSE_RULES) {
      const v = mod.getPath(RULES, d.path);
      assert.notEqual(v, undefined, d.path);
      if (d.type === 'number') assert.equal(typeof v, 'number', d.path);
      if (d.type === 'boolean') assert.equal(typeof v, 'boolean', d.path);
      if (d.type === 'select') assert.ok(d.choices.includes(v), `${d.path} = ${v}`);
    }
  });

  test('applying, coercing and resetting', () => {
    const problems = mod.applyHouseRules({ values: { 'RANGE_TN.short': '3', 'COMBAT.melee.opposed': false }, advanced: { 'COMBAT.prone.targetMelee': -1, 'NOPE.x': 1, 'MIN_TARGET_NUMBER': 'abc' } });
    assert.equal(RULES.RANGE_TN.short, 3);
    assert.equal(RULES.COMBAT.melee.opposed, false);
    assert.equal(RULES.COMBAT.prone.targetMelee, -1);
    assert.equal(problems.length, 2);
    assert.deepEqual(mod.changedRules().sort(), ['COMBAT.melee.opposed', 'RANGE_TN.short']);
    mod.applyHouseRules({});
    assert.equal(RULES.RANGE_TN.short, 4);
    assert.equal(RULES.COMBAT.melee.opposed, true);
    assert.equal(RULES.COMBAT.prone.targetMelee, -2);
    assert.deepEqual(mod.changedRules(), []);
  });

  test('the advanced box can replace a whole table; the fields win over it', () => {
    mod.applyHouseRules({ values: { 'RANGE_TN.long': 7 }, advanced: { 'RANGE_TN.long': 8, 'HEALING.natural.periodHours.physical': 12 } });
    assert.equal(RULES.RANGE_TN.long, 7);
    assert.equal(RULES.HEALING.natural.periodHours.physical, 12);
    mod.applyHouseRules({});
    assert.equal(RULES.HEALING.natural.periodHours.physical, 24);
  });
});
