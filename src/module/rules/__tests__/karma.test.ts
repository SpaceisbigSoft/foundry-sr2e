import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { karmaRerollCost, avoidDisasterCost } from '../karma.ts';

describe('karma costs', () => {
  test('re-roll cost escalates 1, 2, 3', () => {
    assert.equal(karmaRerollCost(0), 1);
    assert.equal(karmaRerollCost(1), 2);
    assert.equal(karmaRerollCost(2), 3);
  });
  test('bad input is treated as no previous re-rolls', () => {
    assert.equal(karmaRerollCost(-3), 1);
    assert.equal(karmaRerollCost(NaN), 1);
  });
  test('avoiding a disaster costs 1', () => {
    assert.equal(avoidDisasterCost(), 1);
  });
});
