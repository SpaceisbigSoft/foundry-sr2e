/** v0.82.0: the sheet's dying line follows the rules in force (book, its house rule, or the Revamp's minutes). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../index.ts';
import { bleedEveryText } from '../urr80-health-social.ts';

test('bleedEveryText: the book, a fixed number of turns, and the Revamp minutes', () => {
  const R: any = RULES;
  const minutes = R.URR_V80.hsBleedMinutes;
  const per = R.CONDITIONS.dying.turnsPerBox;
  const bleed923 = R.HEALTH_V923.bleed;
  try {
    // v0.92.3 (RULES.HEALTH_V923.bleed 'tenMinutes', Core p. 111): the book's 10 minutes a box; 'bodyTurns' is v0.92.2's.
    R.URR_V80.hsBleedMinutes = 0;
    assert.equal(bleedEveryText(4), 'every 10 minutes of game time');
    R.HEALTH_V923.bleed = 'bodyTurns'; R.CONDITIONS.dying.turnsPerBox = 'body';
    assert.equal(bleedEveryText(4), 'every 4 Combat Turns');
    assert.equal(bleedEveryText(1), 'every 1 Combat Turn');
    R.CONDITIONS.dying.turnsPerBox = 3;
    assert.equal(bleedEveryText(6), 'every 3 Combat Turns');
    R.URR_V80.hsBleedMinutes = 10;
    assert.equal(bleedEveryText(6), 'every 10 minutes of game time');
  } finally { R.URR_V80.hsBleedMinutes = minutes; R.CONDITIONS.dying.turnsPerBox = per; R.HEALTH_V923.bleed = bleed923; }
});

test('v0.82.1: a request to change an edge or flaw by hand carries only an id and/or one quality, and costs nothing', async () => {
  const { methodRequestProblems } = await import('../trust.ts');
  const ok = (method: string, args: unknown[], karma = 0) => methodRequestProblems({ method, args }, { karma, nuyen: 0 });
  assert.deepEqual(ok('addQuality', [{ name: 'Lucky', kind: 'edge', points: 2 }]), []);
  assert.deepEqual(ok('editQuality', ['abc', { name: 'Lucky', kind: 'edge', points: 2 }]), []);
  assert.deepEqual(ok('removeQuality', ['abc']), []);
  assert.ok(ok('addQuality', ['Lucky']).length);
  assert.ok(ok('removeQuality', ['abc', 'def']).length);
  assert.ok(ok('editQuality', [{ name: 'x' }, 'abc']).length);
  assert.ok(ok('addQuality', [{ name: 'Lucky' }], 5).length, 'a by-hand change is filed at no cost');
});
