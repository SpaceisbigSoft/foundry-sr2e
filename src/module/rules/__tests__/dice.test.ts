import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  successTest, finalTargetNumber, netSuccesses, rerollFailures, rollOpenEnded,
} from '../dice.ts';
import { scripted } from './helpers.ts';

describe('target numbers', () => {
  test('modifiers add to the base TN', () => {
    const r = finalTargetNumber(4, [{ label: 'a', value: 2 }, { label: 'b', value: 1 }]);
    assert.deepEqual(r, { targetNumber: 7, clamped: false });
  });
  test('TN never drops below 2', () => {
    const r = finalTargetNumber(3, [{ label: 'bonus', value: -5 }]);
    assert.deepEqual(r, { targetNumber: 2, clamped: true });
  });
});

describe('successTest', () => {
  test('counts dice meeting the TN', async () => {
    const r = await successTest({ dice: 4, targetNumber: 4, roll: scripted([2, 4, 5, 3]) });
    assert.equal(r.successes, 2);
    assert.equal(r.botch, false);
    assert.equal(r.targetNumber, 4);
  });

  test('pool dice are added to the rating', async () => {
    // The 6 explodes: one extra wave of one die (3), making that die total 9.
    const r = await successTest({ dice: 3, poolDice: 2, targetNumber: 5, roll: scripted([5, 1, 6, 2, 5], [3]) });
    assert.equal(r.totalDice, 5);
    assert.equal(r.dice.length, 5);
    // 5 ok, 1 fail, 6+3=9 ok, 2 fail, 5 ok
    assert.equal(r.successes, 3);
  });

  test('Rule of Six: a 6 is re-rolled and added', async () => {
    // TN 8 is impossible without exploding: 6 then 3 = 9
    const r = await successTest({ dice: 1, targetNumber: 8, roll: scripted([6], [3]) });
    assert.equal(r.dice[0]?.total, 9);
    assert.deepEqual(r.dice[0]?.faces, [6, 3]);
    assert.equal(r.successes, 1);
  });

  test('Rule of Six chains through multiple 6s', async () => {
    const r = await successTest({ dice: 1, targetNumber: 15, roll: scripted([6], [6], [4]) });
    assert.equal(r.dice[0]?.total, 16);
    assert.equal(r.successes, 1);
  });

  test('re-rolls are batched in waves across dice', async () => {
    // two dice both roll 6; wave 2 re-rolls both; one 6 again, then one more wave
    const dice = await rollOpenEnded(2, scripted([6, 6], [6, 2], [1]));
    assert.deepEqual(dice[0]?.faces, [6, 6, 1]);
    assert.deepEqual(dice[1]?.faces, [6, 2]);
  });

  test('Rule of One: all ones is a botch with zero successes', async () => {
    const r = await successTest({ dice: 3, targetNumber: 2, roll: scripted([1, 1, 1]) });
    assert.equal(r.botch, true);
    assert.equal(r.successes, 0);
  });

  test('a single 1 among other dice is not a botch', async () => {
    const r = await successTest({ dice: 3, targetNumber: 2, roll: scripted([1, 1, 2]) });
    assert.equal(r.botch, false);
    assert.equal(r.successes, 1);
  });

  test('Rule of One looks only at the first roll, not re-rolled 6s', async () => {
    const r = await successTest({ dice: 1, targetNumber: 2, roll: scripted([6], [1]) });
    assert.equal(r.botch, false);
    assert.equal(r.dice[0]?.total, 7);
    assert.equal(r.successes, 1);
  });

  test('zero dice is an automatic failure, not a botch, and never rolls', async () => {
    const r = await successTest({ dice: 0, targetNumber: 4, roll: scripted() });
    assert.equal(r.successes, 0);
    assert.equal(r.botch, false);
    assert.equal(r.dice.length, 0);
  });

  test('wound/situational modifiers change the TN used', async () => {
    const r = await successTest({
      dice: 2, targetNumber: 4, modifiers: [{ label: 'Wounds', value: 2 }], roll: scripted([5, 6], [1]),
    });
    assert.equal(r.targetNumber, 6);
    // 5 fails at TN6; 6 explodes to 7 and succeeds
    assert.equal(r.successes, 1);
  });

  test('rejects a roller that returns the wrong number of dice', async () => {
    await assert.rejects(() => successTest({ dice: 2, targetNumber: 4, roll: () => [3] }), /expected 2/);
  });

  test('rejects invalid faces', async () => {
    await assert.rejects(() => successTest({ dice: 1, targetNumber: 4, roll: () => [7] }), /Invalid d6/);
  });

  test('a roller stuck on 6 stops at the wave cap instead of looping forever', async () => {
    const r = await successTest({ dice: 1, targetNumber: 4, roll: (n) => Array(n).fill(6) });
    assert.equal(r.dice[0]?.faces.length, 51);
    assert.equal(r.successes, 1);
  });

  test('async rollers are supported', async () => {
    const r = await successTest({ dice: 1, targetNumber: 3, roll: async () => [4] });
    assert.equal(r.successes, 1);
  });
});

describe('defaulting and opposed tests', () => {
  test('net successes never go negative', () => {
    assert.equal(netSuccesses(3, 1), 2);
    assert.equal(netSuccesses(1, 4), 0);
  });
});

describe('Karma re-roll', () => {
  test('re-rolls only the failures and keeps the successes', async () => {
    const first = await successTest({ dice: 4, targetNumber: 4, roll: scripted([5, 2, 1, 6], [2]) });
    // dice 5 ok, 2 fail, 1 fail, 6 -> explodes with 2 = 8 ok  => 2 successes, 2 failures
    assert.equal(first.successes, 2);
    const second = await rerollFailures(first, scripted([4, 3]));
    assert.equal(second.successes, 3);
  });
  test('returns the same result when nothing failed', async () => {
    const first = await successTest({ dice: 2, targetNumber: 2, roll: scripted([3, 4]) });
    const second = await rerollFailures(first, scripted());
    assert.equal(second, first);
  });
});
