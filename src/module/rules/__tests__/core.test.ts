import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  metatype, racialModifier, attributeMaximums, checkAttributeLimits, woundLevel, firstAidTarget, firstAidBoxes,
  naturalHealing, careModifiers, incapacitated, conditionStatuses, dyingTick, actionCost, spendAction, actionsLeftLabel,
  compareInitiative, surprised,
} from '../core.ts';
import { oldWay } from './oldway.ts';

describe('core rules (v0.22.0)', () => {
  test('metatypes: modifiers and maximums', () => {
    assert.equal(metatype('nope').label, 'Human');
    assert.equal(racialModifier('troll', 'body'), 5);
    assert.equal(racialModifier('troll', 'intelligence'), -2);
    assert.equal(racialModifier('human', 'body'), 0);
    assert.deepEqual(attributeMaximums('troll', 'body'), { natural: 11, augmented: 16 });
    assert.deepEqual(attributeMaximums('elf', 'charisma'), { natural: 8, augmented: 12 });
    assert.deepEqual(attributeMaximums('ork', 'charisma'), { natural: 5, augmented: 7 });
    assert.equal(metatype('dwarf').vision.thermographic, true);
    assert.equal(metatype('troll').reach, 1);
  });

  test('attribute limit warnings', () => {
    const base = { body: { natural: 6, total: 6 }, quickness: { natural: 7, total: 10 }, strength: { natural: 6, total: 6 }, charisma: { natural: 3, total: 3 }, intelligence: { natural: 3, total: 3 }, willpower: { natural: 3, total: 3 } };
    const r = checkAttributeLimits('human', base);
    assert.equal(r.warnings.length, 2);
    assert.match(r.warnings[0]!, /Quickness 7 is above the natural maximum 6/);
    assert.match(r.warnings[1]!, /Quickness 10 is above the augmented maximum 9/);
    assert.equal(checkAttributeLimits('elf', base).warnings.length, 0);     // elf Q 7 is natural; 10 is exactly 7 × 1.5
  });

  test('wound levels and first aid', (t) => {
    // v0.92.3: the old 1 box per success (the book's one level: v0923-health.test.ts).
    t.after(oldWay({ 'HEALTH_V923.firstAid': 'boxes' }));
    assert.equal(woundLevel(0), null);
    assert.equal(woundLevel(2), 'L');
    assert.equal(woundLevel(4), 'M');
    assert.equal(woundLevel(7), 'S');
    assert.equal(woundLevel(10), 'D');
    assert.deepEqual(firstAidTarget(6), { tn: 8, maxBoxes: 3, level: 'S' });   // v0.79.0: SRII First Aid Table
    assert.deepEqual(firstAidTarget(1), { tn: 4, maxBoxes: 1, level: 'L' });
    assert.equal(firstAidBoxes(5, 6), 3);
    assert.equal(firstAidBoxes(2, 6), 2);
    assert.equal(firstAidBoxes(3, 0), 0);
  });

  test('natural healing: hours per box from successes', () => {
    assert.deepEqual(naturalHealing({ track: 'stun', boxes: 4, successes: 2, hours: 3 }), { tn: 4, hoursPerBox: 0.5, boxes: 4 });
    assert.deepEqual(naturalHealing({ track: 'physical', boxes: 6, successes: 3, hours: 24 }), { tn: 6, hoursPerBox: 8, boxes: 3 });
    assert.deepEqual(naturalHealing({ track: 'physical', boxes: 6, successes: 0, hours: 24 }), { tn: 6, hoursPerBox: null, boxes: 0 });
    assert.deepEqual(careModifiers('hospital'), [{ label: 'Hospital or clinic', value: -2 }]);
    assert.deepEqual(careModifiers('none'), []);
  });

  test('conditions', (t) => {
    // v0.92.3: the old (Body) Combat Turns per box (the book's 10 minutes: v0923-health.test.ts).
    t.after(oldWay({ 'HEALTH_V923.bleed': 'bodyTurns' }));
    assert.equal(incapacitated('ok'), false);
    assert.equal(incapacitated('unconscious'), true);
    assert.deepEqual(conditionStatuses('dying'), { unconscious: true, bleeding: true, dead: false });
    assert.deepEqual(conditionStatuses('dead'), { unconscious: false, bleeding: false, dead: true });
    assert.equal(dyingTick(4, 4), true);
    assert.equal(dyingTick(3, 4), false);
    assert.equal(dyingTick(0, 4), false);
  });

  test('actions: two simple or one complex per phase', () => {
    assert.equal(actionCost('fire:SA'), 'simple');
    assert.equal(actionCost('fire:FA'), 'complex');
    assert.equal(actionCost('melee'), 'complex');
    assert.deepEqual(spendAction(0, 'simple'), { ok: true, used: 1, left: 1 });
    assert.deepEqual(spendAction(1, 'simple'), { ok: true, used: 2, left: 0 });
    assert.deepEqual(spendAction(1, 'complex'), { ok: false, used: 3, left: 0 });
    assert.deepEqual(spendAction(2, 'free'), { ok: true, used: 2, left: 0 });
    assert.equal(actionsLeftLabel(1), 'one simple action');
  });

  test('initiative ties and surprise', () => {
    const a = { initiative: 12, ties: [5, 4] }, b = { initiative: 12, ties: [6, 1] }, c = { initiative: 15, ties: [1, 1] };
    assert.deepEqual([a, b, c].sort(compareInitiative), [c, b, a]);
    assert.deepEqual(surprised([{ id: 'p1', side: 'pc', successes: 2 }, { id: 'p2', side: 'pc', successes: 0 }, { id: 'g1', side: 'npc', successes: 1 }]).sort(), ['g1', 'p2']);
    assert.deepEqual(surprised([{ id: 'p1', side: 'pc', successes: 1 }, { id: 'g1', side: 'npc', successes: 1 }]), []);
  });
});
