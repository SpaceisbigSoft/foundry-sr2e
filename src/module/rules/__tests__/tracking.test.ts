import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import {
  signatureAgeHours, signatureLifeHours, signatureHoursLeft, pruneSignatures, freshnessModifier, trackingHours,
  geasaPenalty, unmetCastingGeasa,
} from '../tracking.ts';

const H = 3600;
const sig = (force: number, at: number, id = 'x') => ({ id, sceneId: 's', kind: 'spell', label: 'Manabolt', force, worldTime: at });

describe('astral signatures and tracking', () => {
  test('age, life and time left', () => {
    assert.equal(signatureAgeHours(sig(4, 0), 2 * H), 2);
    assert.equal(signatureLifeHours(4), 4);
    assert.equal(signatureHoursLeft(sig(4, 0), 3 * H), 1);
    assert.equal(signatureHoursLeft(sig(4, 0), 9 * H), 0);
  });
  test('pruning drops faded signatures and caps the list', () => {
    const list = [sig(1, 0, 'a'), sig(6, 0, 'b'), sig(6, H, 'c')];
    assert.deepEqual(pruneSignatures(list, 2 * H).map((s) => s.id), ['b', 'c']);
    assert.deepEqual(pruneSignatures(list, 2 * H, 1).map((s) => s.id), ['c']);
  });
  test('freshness modifier by age', () => {
    assert.deepEqual(freshnessModifier(0.5), []);
    assert.deepEqual(freshnessModifier(3), [{ label: 'Trail 3 h old', value: 1 }]);
    assert.equal(freshnessModifier(12)[0]?.value, 2);
    assert.equal(freshnessModifier(48)[0]?.value, 4);
  });
  test('tracking time is base / successes (v0.92.2 base 6 h)', (t) => {
    t.after(oldWay({ 'TRACKING.baseHours': 6 }));
    assert.equal(trackingHours(3), 2);
    assert.equal(trackingHours(0), null);
    assert.equal(trackingHours(4, 10), 2.5);
  });
});

describe('geasa', () => {
  const g = [
    { text: 'Must speak aloud', magic: 1, met: true, checkOnCast: true },
    { text: 'Only at night', magic: 2, met: false, checkOnCast: true },
    { text: 'Fasting', magic: 1, met: false, checkOnCast: false },
  ];
  test('unmet geasa take away the Magic they protect (v0.92.2)', (t) => {
    t.after(oldWay({ 'SPIRITS_V923.geasa': 'v922' }));
    assert.equal(geasaPenalty(g), 3);
    assert.equal(geasaPenalty([]), 0);
  });
  test('only unmet, flagged geasa warn when casting', () => {
    assert.deepEqual(unmetCastingGeasa(g).map((x) => x.text), ['Only at night']);
  });
});
