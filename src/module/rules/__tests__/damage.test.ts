import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDamageCode, stageUp, stageDown, stageForNetSuccesses,
  resistanceTargetNumber, resolveResistance, applyDamageToMonitor, monitorStatus, woundModifier, heal,
} from '../damage.ts';
import { oldWay } from './oldway.ts';

describe('damage codes', () => {
  test('parses and formats', () => {
    assert.deepEqual(parseDamageCode('9M'), { power: 9, level: 'M' });
    assert.deepEqual(parseDamageCode(' 12d '), { power: 12, level: 'D' });
  });
  test('rejects junk', () => {
    assert.equal(parseDamageCode('M9'), null);
    assert.equal(parseDamageCode('9X'), null);
    assert.equal(parseDamageCode(''), null);
  });
});

describe('staging', () => {
  test('up is capped at Deadly', () => {
    assert.equal(stageUp('L', 1), 'M');
    assert.equal(stageUp('S', 5), 'D');
  });
  test('down below Light means no damage', () => {
    assert.equal(stageDown('M', 1), 'L');
    assert.equal(stageDown('L', 1), null);
    assert.equal(stageDown('D', 2), 'M');
  });
  test('attacker staging: first success hits, then every 2 more raise a level', () => {
    assert.equal(stageForNetSuccesses('M', 1), 'M');
    assert.equal(stageForNetSuccesses('M', 2), 'M');
    assert.equal(stageForNetSuccesses('M', 3), 'S');
    assert.equal(stageForNetSuccesses('M', 5), 'D');
  });
  test('defender staging: every 2 successes lower a level', () => {
    assert.equal(resolveResistance('S', 0), 'S');
    assert.equal(resolveResistance('S', 1), 'S');
    assert.equal(resolveResistance('S', 2), 'M');
    assert.equal(resolveResistance('S', 6), null);
  });
});

describe('resistance TN', () => {
  test('Power minus armor, minimum 2', () => {
    assert.equal(resistanceTargetNumber(9, 4), 5);
    assert.equal(resistanceTargetNumber(4, 10), 2);
    assert.equal(resistanceTargetNumber(6, -3), 6);
  });
});

describe('condition monitor', () => {
  test('damage fills the right track', () => {
    const r = applyDamageToMonitor({ physical: 0, stun: 0 }, 'physical', 'M', 6);
    assert.deepEqual(r.monitor, { physical: 3, stun: 0 });
    assert.equal(r.boxes, 3);
    assert.equal(r.status, 'ok');
  });
  test('null level (fully resisted) does nothing', () => {
    const r = applyDamageToMonitor({ physical: 2, stun: 1 }, 'stun', null, 6);
    assert.deepEqual(r.monitor, { physical: 2, stun: 1 });
    assert.equal(r.boxes, 0);
  });
  test('full stun track means unconscious', () => {
    const r = applyDamageToMonitor({ physical: 0, stun: 6 }, 'stun', 'S', 6);
    assert.equal(r.monitor.stun, 10);
    assert.equal(r.status, 'unconscious');
  });
  test('stun overflow converts to physical', (t) => {
    // v0.92.3: box for box by the book (Core p. 111): stun 8 + Serious(6) = 14 -> clamp 10, 4 overflow -> 4 physical
    assert.deepEqual(applyDamageToMonitor({ physical: 0, stun: 8 }, 'stun', 'S', 6).monitor, { physical: 4, stun: 10 });
    // the old 2:1
    t.after(oldWay({ STUN_OVERFLOW_PER_PHYSICAL_BOX: 2 }));
    const r = applyDamageToMonitor({ physical: 0, stun: 8 }, 'stun', 'S', 6);
    assert.deepEqual(r.monitor, { physical: 2, stun: 10 });
  });
  test('full physical track means dying, then dead at overflow equal to Body', (t) => {
    // v0.92.3: the old way (the book's one box past Body: v0923-health.test.ts).
    t.after(oldWay({ 'HEALTH_V923.death': 'total' }));
    assert.equal(monitorStatus({ physical: 10, stun: 0 }, 5), 'dying');
    assert.equal(monitorStatus({ physical: 14, stun: 0 }, 5), 'dying');
    assert.equal(monitorStatus({ physical: 15, stun: 0 }, 5), 'dead');
  });
  test('input monitor is not mutated', () => {
    const m = { physical: 1, stun: 1 };
    applyDamageToMonitor(m, 'physical', 'D', 5);
    assert.deepEqual(m, { physical: 1, stun: 1 });
  });
  test('healing floors at zero', () => {
    assert.deepEqual(heal({ physical: 2, stun: 5 }, 'physical', 9), { physical: 0, stun: 5 });
  });
});

describe('wound modifiers', () => {
  test('thresholds', () => {
    assert.equal(woundModifier({ physical: 0, stun: 0 }), 0);
    assert.equal(woundModifier({ physical: 1, stun: 0 }), 1);
    assert.equal(woundModifier({ physical: 2, stun: 0 }), 1);
    assert.equal(woundModifier({ physical: 3, stun: 0 }), 2);
    assert.equal(woundModifier({ physical: 5, stun: 0 }), 2);
    assert.equal(woundModifier({ physical: 6, stun: 0 }), 3);
    assert.equal(woundModifier({ physical: 9, stun: 0 }), 3);
  });
  test('physical and stun modifiers stack by default', () => {
    assert.equal(woundModifier({ physical: 3, stun: 1 }), 3);
  });
});
