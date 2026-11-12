import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from '../../__tests__/helpers/assert-rows.ts';
import {
  healingTargetNumber, boxesHealed, spellOptionDrainMods, backgroundCountModifiers, ritualTeamDice, ritualHours,
  reachedDeadly, magicLossOutcome, enchantingDays, focusKarmaCost, banishResistDice, spiritOwesServices,
  advanceQuest, questStatus,
} from '../spellcraft.ts';

describe('spellcraft', () => {
  test('healing TN is 10 - Essence, min 2; heals 1 box per success up to the damage', () => {
    assert.equal(healingTargetNumber(6, 4), 4);
    assert.equal(healingTargetNumber(2.5, 4), 8);
    assert.equal(healingTargetNumber(9, 4), 2);
    assert.equal(boxesHealed(3, 5), 3);
    assert.equal(boxesHealed(4, 2), 2);
  });
  test('exclusive and fetish lower drain TN', () => {
    assert.deepEqual(spellOptionDrainMods({ exclusive: true, fetish: true }), [{ label: 'Exclusive', value: -2 }, { label: 'Fetish', value: -1 }]);
    assert.deepEqual(spellOptionDrainMods({}), []);
  });
  test('background count', () => {
    assert.deepEqual(backgroundCountModifiers(2), [{ label: 'Background count', value: 2 }]);
    assert.deepEqual(backgroundCountModifiers(0), []);
  });
  test('ritual team adds half each member\'s Sorcery; takes Force hours', () => {
    assert.equal(ritualTeamDice([4, 5, 1]), 2 + 2 + 0);
    assert.equal(ritualHours(6), 6);
  });
  test('magic loss when Deadly and the roll is under Magic', (t) => {
    assert.equal(reachedDeadly(10), true);
    assert.equal(reachedDeadly(9), false);
    assert.deepEqual(magicLossOutcome(5, 6), { lost: 1, threshold: 6 });
    // v0.92.3: at or below Magic by the book (Core p. 115); the old way only below it.
    assert.deepEqual(magicLossOutcome(6, 6), { lost: 1, threshold: 6 });
    assert.deepEqual(magicLossOutcome(7, 6), { lost: 0, threshold: 6 });
    t.after(oldWay({ 'HEALTH_V923.magicLoss': 'below' }));
    assert.deepEqual(magicLossOutcome(6, 6), { lost: 0, threshold: 6 });
  });
  test('enchanting time and focus Karma', (t) => {
    t.after(oldWay({"BOOK_V78.focusKarma.mode": "flat"})); // v0.78.0: the old rule (a house rule)
    assert.equal(enchantingDays(7, 2), 3.5);
    assert.equal(enchantingDays(7, 0), null);
    assert.equal(focusKarmaCost('power', 2), 10);
    assert.equal(focusKarmaCost('spell', 3), 3);
  });
  test('free spirits resist banishing with spirit energy; allies and free spirits owe no services', () => {
    assert.equal(banishResistDice(5, 'free', 3), 8);
    assert.equal(banishResistDice(5, 'nature', 3), 5);
    assert.equal(spiritOwesServices('ally'), false);
    assert.equal(spiritOwesServices('nature'), true);
  });
  test('astral quests advance on success and end on failure', () => {
    const q = { name: 'Dweller', stages: 2, passed: 0, targetNumber: 6, failed: false };
    const q1 = advanceQuest(q, 1);
    assert.equal(q1.passed, 1);
    assert.equal(questStatus(advanceQuest(q1, 2)), 'complete');
    assert.equal(questStatus(advanceQuest(q1, 0)), 'failed');
    assert.equal(advanceQuest({ ...q, failed: true }, 3).passed, 0);
  });
});
