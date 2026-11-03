import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { tokenVision, visionMatches, monitorBars, woundStatus, ASTRAL_DETECTION_RANGE } from '../tokens.ts';

describe('tokens (v0.36.0)', () => {
  test('vision from the eyes', () => {
    assert.deepEqual(tokenVision({}), { visionMode: 'basic', range: 0, detection: null });
    assert.deepEqual(tokenVision({ lowLight: true }), { visionMode: 'lightAmplification', range: 0, detection: null });
    assert.deepEqual(tokenVision({ lowLight: true, thermographic: true, ultrasound: true }), { visionMode: 'darkvision', range: 30, detection: { id: 'feelTremor', range: 50 } });
    assert.equal(visionMatches({ enabled: true, visionMode: 'darkvision', range: 30 }, tokenVision({ thermographic: true })), true);
    assert.equal(visionMatches({ enabled: true, visionMode: 'basic', range: 0 }, tokenVision({ thermographic: true })), false);
  });
  test('bars and wound icons', () => {
    assert.deepEqual(monitorBars({ physical: 3, stun: 12 }), { physical: { value: 7, max: 10 }, stun: { value: 0, max: 10 } });
    assert.equal(woundStatus({ physical: 0, stun: 0 }), null);
    assert.equal(woundStatus({ physical: 1, stun: 0 }), 'sr2eWoundL');
    assert.equal(woundStatus({ physical: 3, stun: 6 }), 'sr2eWoundS');
    assert.equal(woundStatus({ physical: 12, stun: 0 }), 'sr2eWoundD');
  });
  test('v0.58.0: astral sight sees invisible tokens', () => {
    assert.deepEqual(tokenVision({ astral: true }), { visionMode: 'basic', range: 0, detection: null, seeInvisible: { id: 'seeInvisibility', range: ASTRAL_DETECTION_RANGE } });
    assert.equal(tokenVision({ astral: false }).seeInvisible, null);
    assert.equal(tokenVision({ thermographic: true, astral: true }).visionMode, 'darkvision');
    assert.equal(tokenVision(null).seeInvisible, undefined);
    const vis = (RULES as any).GEAR_V58.visibility;
    vis.enabled = false;
    try { assert.equal(tokenVision({ astral: true }).seeInvisible, null); } finally { vis.enabled = true; }
  });
});
