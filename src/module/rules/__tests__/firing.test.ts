import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseFiringModes, roundsForMode, recoilModifier, damageForMode, situationalModifiers } from '../firing.ts';
import { oldWay } from './oldway.ts';

describe('firing modes', () => {
  test('parses mode strings in any form, canonical order, unknowns ignored', () => {
    assert.deepEqual(parseFiringModes('SA/BF'), ['SA', 'BF']);
    assert.deepEqual(parseFiringModes('fa, sa'), ['SA', 'FA']);
    assert.deepEqual(parseFiringModes('SA/SA/XX'), ['SA']);
  });
  test('empty or nonsense means single shot', () => {
    assert.deepEqual(parseFiringModes(''), ['SS']);
    assert.deepEqual(parseFiringModes('auto'), ['SS']);
    assert.deepEqual(parseFiringModes(undefined as unknown as string), ['SS']);
  });
  test('rounds per mode, full auto clamped 3..10', () => {
    assert.equal(roundsForMode('SS'), 1);
    assert.equal(roundsForMode('SA'), 1);
    assert.equal(roundsForMode('BF'), 3);
    assert.equal(roundsForMode('FA', 6), 6);
    assert.equal(roundsForMode('FA', 1), 3);
    assert.equal(roundsForMode('FA', 25), 10);
    assert.equal(roundsForMode('FA', NaN), 3);
  });
});

describe('recoil', () => {
  test('first single shot has no recoil', () => {
    assert.equal(recoilModifier({ rounds: 1 }), 0);
  });
  test('second shot in the phase adds +1', () => {
    assert.equal(recoilModifier({ rounds: 1, earlierRoundsThisPhase: 1 }), 1);
  });
  test('burst is +2 before compensation, compensation offsets it but never below 0 (old way)', (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedRecoil': 'freeFirst' }));
    assert.equal(recoilModifier({ rounds: 3 }), 2);
    assert.equal(recoilModifier({ rounds: 3, recoilComp: 1 }), 1);
    assert.equal(recoilModifier({ rounds: 3, recoilComp: 5 }), 0);
  });
  test('v0.79.0: burst is +3, a second burst +6, full auto +1 per round (SRII table)', () => {
    assert.equal(recoilModifier({ rounds: 3 }), 3);
    assert.equal(recoilModifier({ rounds: 3, recoilComp: 1 }), 2);
    assert.equal(recoilModifier({ rounds: 3, earlierRoundsThisPhase: 3, firstShotSingle: false }), 6);
    assert.equal(recoilModifier({ rounds: 10 }), 10);
  });
  test('earlier rounds in the phase stack with this action', () => {
    assert.equal(recoilModifier({ rounds: 3, earlierRoundsThisPhase: 3, recoilComp: 2 }), 3);
  });
});

describe('damage by mode', () => {
  test('single shot and semi-auto unchanged', () => {
    assert.deepEqual(damageForMode(9, 'M', 'SS', 1), { power: 9, level: 'M' });
    assert.deepEqual(damageForMode(9, 'M', 'SA', 1), { power: 9, level: 'M' });
  });
  test('burst: +3 Power, +1 level', () => {
    assert.deepEqual(damageForMode(8, 'M', 'BF', 3), { power: 11, level: 'S' });
  });
  test('full auto: +1 Power per round, +1 level per 3 rounds, capped at Deadly', () => {
    assert.deepEqual(damageForMode(6, 'M', 'FA', 3), { power: 9, level: 'S' });
    assert.deepEqual(damageForMode(6, 'M', 'FA', 5), { power: 11, level: 'S' });
    assert.deepEqual(damageForMode(6, 'M', 'FA', 10), { power: 16, level: 'D' });
  });
});

describe('situational modifiers', () => {
  test('ticked ids become labeled modifiers; unknown ids ignored', () => {
    assert.deepEqual(situationalModifiers(['calledShot', 'smartlink', 'nope']), [
      { label: 'Called shot', value: 4 },
      { label: 'Smartlink (smartgun + implant)', value: -2 },
    ]);
  });
  test('visibility adds one modifier unless normal', () => {
    assert.deepEqual(situationalModifiers([], 'minimal'), [{ label: 'Minimal light', value: 6 }]); // v0.79.0 docs check (was 4)
    assert.deepEqual(situationalModifiers([], 'normal'), []);
    assert.deepEqual(situationalModifiers([], 'unknown'), []);
  });
});

import { combatPhaseKey, trackedRounds, recordRounds } from '../firing.ts';

describe('recoil carry-over', () => {
  const base = { combatId: 'c1', started: true, round: 2, pass: 1, combatantId: 'x' };
  test('phase key only exists inside a started combat with a current combatant', () => {
    assert.equal(combatPhaseKey(base), 'c1:2:1:x');
    assert.equal(combatPhaseKey({ ...base, started: false }), null);
    assert.equal(combatPhaseKey({ ...base, combatId: null }), null);
    assert.equal(combatPhaseKey({ ...base, combatantId: null }), null);
  });
  test('a new turn, pass or Combat Turn is a new phase', () => {
    const k = combatPhaseKey(base);
    assert.notEqual(combatPhaseKey({ ...base, combatantId: 'y' }), k);
    assert.notEqual(combatPhaseKey({ ...base, pass: 2 }), k);
    assert.notEqual(combatPhaseKey({ ...base, round: 3 }), k);
  });
  test('tracked rounds only count within the same phase', () => {
    const rec = { phase: 'c1:2:1:x', rounds: 3 };
    assert.equal(trackedRounds(rec, 'c1:2:1:x'), 3);
    assert.equal(trackedRounds(rec, 'c1:2:2:x'), 0);
    assert.equal(trackedRounds(rec, null), 0);
    assert.equal(trackedRounds(null, 'c1:2:1:x'), 0);
    assert.equal(trackedRounds({ phase: 'c1:2:1:x', rounds: NaN }, 'c1:2:1:x'), 0);
  });
  test('recording adds the rounds just fired to what was counted as earlier', () => {
    assert.deepEqual(recordRounds('p', 0, 3), { phase: 'p', rounds: 3 });
    assert.deepEqual(recordRounds('p', 3, 1), { phase: 'p', rounds: 4 });
  });
});
