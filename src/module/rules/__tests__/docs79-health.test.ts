/**
 * v0.79.0 (health): the documents' healing rules (RULES.DOCS_V79, config79-health.ts), the new way and the old way.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import {
  healsInStages, healingAttributeStep, healingStage, stageRest, selfRecoveryTest, canRollStage,
  doctoringCareOptions, doctoringModifiers, firstAidKitDice, firstAidModifiers,
} from '../docs79-health.ts';

describe('v0.79.0 healing in stages (DOCS_V79.healing, SRII Healing Table)', () => {
  test('Physical heals in stages; Stun stays per box', () => {
    assert.equal(healsInStages('physical'), true);
    assert.equal(healsInStages('stun'), false);
  });
  test('TN by level, base time ÷ successes, the minimum, one level down', () => {
    assert.deepEqual(healingStage({ boxes: 1, successes: 1 }), { level: 'L', tn: 4, hours: 24, toBoxes: 0 });
    assert.deepEqual(healingStage({ boxes: 2, successes: 20 }), { level: 'L', tn: 4, hours: 2, toBoxes: 0 });
    assert.deepEqual(healingStage({ boxes: 4, successes: 2 }), { level: 'M', tn: 6, hours: 120, toBoxes: 1 });
    assert.deepEqual(healingStage({ boxes: 8, successes: 4 }), { level: 'S', tn: 8, hours: 120, toBoxes: 3 });
    assert.deepEqual(healingStage({ boxes: 10, successes: 3 }), { level: 'D', tn: 10, hours: 240, toBoxes: 6 });
    assert.deepEqual(healingStage({ boxes: 10, successes: 30 }), { level: 'D', tn: 10, hours: 72, toBoxes: 6 });
    assert.deepEqual(healingStage({ boxes: 12, successes: 1 }).toBoxes, 6);
  });
  test('no successes: no progress', () => {
    assert.deepEqual(healingStage({ boxes: 4, successes: 0 }), { level: 'M', tn: 6, hours: null, toBoxes: 4 });
  });
  test('symbiotes shorten the stage, not below the minimum', () => {
    assert.equal(healingStage({ boxes: 4, successes: 1, timeFactor: 0.5 }).hours, 120);
    assert.equal(healingStage({ boxes: 1, successes: 10, timeFactor: 0.5 }).hours, 2);
  });
  test('a rest finishes the stage only when long enough', () => {
    assert.deepEqual(stageRest({ boxes: 7, successes: 2, hours: 240 }), { tn: 8, stageHours: 240, done: true, boxes: 4, level: 'S' });
    assert.deepEqual(stageRest({ boxes: 7, successes: 2, hours: 100 }), { tn: 8, stageHours: 240, done: false, boxes: 0, level: 'S' });
    assert.equal(stageRest({ boxes: 7, successes: 0, hours: 9999 }).boxes, 0);
  });
  test('the old way: per box, no stages', (t) => {
    t.after(oldWay({ 'DOCS_V79.healing': 'boxes' }));
    assert.equal(healsInStages('physical'), false);
    assert.deepEqual(selfRecoveryTest(4), { level: 'M', tn: null, needsDoctor: false });
  });
});

describe('v0.79.0 the self-recovery gate (DOCS_V79.healingGate, SRII Wound Table)', () => {
  test('natural Body vs 2 / 4 / 6; Deadly needs a doctor', () => {
    assert.deepEqual([1, 3, 6].map((b) => selfRecoveryTest(b).tn), [2, 4, 6]);
    assert.deepEqual(selfRecoveryTest(10), { level: 'D', tn: null, needsDoctor: true });
    assert.deepEqual(selfRecoveryTest(0), { level: null, tn: null, needsDoctor: false });
  });
  test('a failed test needs medical attention', () => {
    assert.equal(canRollStage({ boxes: 4, care: 'none', gate: 'untested' }).ok, false);
    assert.equal(canRollStage({ boxes: 4, care: 'none', gate: 'passed' }).ok, true);
    assert.equal(canRollStage({ boxes: 4, care: 'none', gate: 'failed' }).ok, false);
    assert.equal(canRollStage({ boxes: 4, care: 'hospital', gate: 'failed' }).ok, true);
    assert.equal(canRollStage({ boxes: 10, care: 'none', gate: 'untested' }).ok, false);
    assert.equal(canRollStage({ boxes: 10, care: 'intensive', gate: 'untested' }).ok, true);
  });
  test('the old way: no gate', (t) => {
    t.after(oldWay({ 'DOCS_V79.healingGate': 'none' }));
    assert.equal(selfRecoveryTest(4).tn, null);
    assert.equal(canRollStage({ boxes: 10, care: 'none', gate: 'untested' }).ok, true);
  });
});

describe('v0.79.0 the Doctoring Table (DOCS_V79.doctoring)', () => {
  test('steps for natural Body and Willpower', () => {
    const s = RULES.DOCS_V79.doctoringTable.attributeSteps;
    assert.deepEqual([1, 3, 4, 6, 7, 9, 10, 14].map((r) => healingAttributeStep(r, s)), [0, 0, -1, -1, -2, -2, -3, -3]);
  });
  test('only with a doctor; the modifiers', () => {
    assert.deepEqual(doctoringModifiers({ care: 'none', magician: true, naturalBody: 6, naturalWillpower: 6 }), []);
    assert.deepEqual(doctoringModifiers({ care: 'intensive', magicalCare: true, magician: true, naturalBody: 5, naturalWillpower: 7 })!.map((m) => m.value), [-2, -2, 2, -1, -2]);
    assert.deepEqual(doctoringModifiers({ care: 'hospital', naturalBody: 3, naturalWillpower: 3 }), []);
    assert.deepEqual(doctoringModifiers({ care: 'home', naturalBody: 3, naturalWillpower: 3 })!.map((m) => m.value), [2]);
    assert.deepEqual(doctoringModifiers({ care: 'poor', naturalBody: 3, naturalWillpower: 3 })!.map((m) => m.value), [3]);
    assert.deepEqual(doctoringModifiers({ care: 'terrible', naturalBody: 3, naturalWillpower: 3 })!.map((m) => m.value), [4]);
    assert.deepEqual(doctoringModifiers({ care: 'hospital', magician: true, applyMagician: false, naturalBody: 3, naturalWillpower: 3 }), []);
    assert.deepEqual(doctoringCareOptions()!.map((c) => [c.id, c.tn]), [['none', 0], ['medkit', 2], ['home', 2], ['hospital', 0], ['intensive', -2], ['poor', 3], ['terrible', 4]]);
  });
  test('the old way: the care rows (null here)', (t) => {
    t.after(oldWay({ 'DOCS_V79.doctoring': 'care' }));
    assert.equal(doctoringModifiers({ care: 'hospital', naturalBody: 6, naturalWillpower: 6 }), null);
    assert.equal(doctoringCareOptions(), null);
  });
});

describe('v0.79.0 the First Aid Table modifiers (DOCS_V79.firstAidMods)', () => {
  test('no medkit dice; no medkit +4, conditions, magician +2, natural Body', () => {
    assert.equal(firstAidKitDice(3), 0);
    assert.deepEqual(firstAidModifiers({ medkit: false, naturalBody: 3 }).map((m) => m.value), [4]);
    assert.deepEqual(firstAidModifiers({ medkit: true, conditions: 'bad', magician: true, naturalBody: 8 }).map((m) => m.value), [1, 2, -2]);
    assert.deepEqual(firstAidModifiers({ medkit: true, conditions: 'terrible', naturalBody: 10 }).map((m) => m.value), [3, -3]);
    assert.deepEqual(firstAidModifiers({ medkit: true, magician: true, applyMagician: false, naturalBody: 2 }), []);
  });
  test('the old way: the medkit rating as dice, no table modifiers', (t) => {
    t.after(oldWay({ 'DOCS_V79.firstAidMods': 'medkitDice' }));
    assert.equal(firstAidKitDice(3), 3);
    assert.deepEqual(firstAidModifiers({ medkit: false, magician: true, naturalBody: 8 }), []);
  });
});
