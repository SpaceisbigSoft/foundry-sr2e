import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, lightModifier, smokeLook, perceptionRangeModifier, livingSenses, livingConcealment, perceptionSightModifiers,
  stealthMovementModifier, attackVisibility, metatypePrejudice, attitudeFor, drivingVisibility, sensorRangeModifier,
  vehicleTestVision, type TargetNumberModifier,
} from '../index.ts';

// v0.81.0: situation.modifierTotal was removed (tests only); the same sum, for these tests.
const modifierTotal = (list: ReadonlyArray<TargetNumberModifier>): number => list.reduce((n, m) => n + (Number(m.value) || 0), 0);

const withRule = (obj: any, key: string, value: unknown, fn: () => void) => { const old = obj[key]; obj[key] = value; try { fn(); } finally { obj[key] = old; } };

describe('v0.50.0 TN automation: sight', () => {
  test('light by the best vision, labelled; normal light gives nothing', () => {
    assert.equal(lightModifier('normal'), null);
    assert.deepEqual(lightModifier('minimal'), { label: 'Minimal light', value: 6 }); // v0.79.0 docs check (was 4)
    // v0.79.0: natural low-light +2, cybernetic +4 (RULES.DOCS_V79.visionCyberNatural).
    assert.deepEqual(lightModifier('minimal', { lowLight: true, lowLightNatural: true }), { label: 'Minimal light (low-light)', value: 2 });
    assert.deepEqual(lightModifier('minimal', { lowLight: true }), { label: 'Minimal light (low-light)', value: 4 });
    assert.equal(lightModifier(null), null);
  });
  test('smoke by vision; thermographic sees through ordinary smoke', () => {
    assert.equal(smokeLook('none'), null);
    assert.equal(smokeLook('smoke', {}, 'fire')!.value, 4);
    assert.match(smokeLook('smoke', {}, 'fire')!.label, /Smoke \(fire\)/);
    assert.equal(smokeLook('smoke', { thermographic: true }), null);
  });
  test('perception range bands; unmeasured is nothing', () => {
    assert.deepEqual(perceptionRangeModifier(1), { label: 'Within 2 m', value: -1 });
    assert.equal(perceptionRangeModifier(10), null);
    assert.equal(perceptionRangeModifier(50)!.value, 1);
    assert.equal(perceptionRangeModifier(500)!.value, 2);
    assert.equal(perceptionRangeModifier(null), null);
  });
  test('living concealment: invisibility blinds eyes; the observer uses the sense fooled least', () => {
    assert.deepEqual(livingSenses({ thermographic: true }), ['visual', 'thermal']);
    assert.equal(livingConcealment({}, [{ kind: 'invisibility', rating: 3 }]).blind, true);
    const suit = [{ kind: 'chameleon', rating: 4, source: 'Suit' }];
    assert.deepEqual(livingConcealment({}, suit).modifier, { label: 'Suit 4', value: 4 });
    // Thermographic eyes aren't fooled by a chameleon suit.
    assert.equal(livingConcealment({ thermographic: true }, suit).modifier, null);
    assert.equal(livingConcealment({}, []).modifier, null);
  });
  test('perception: light, smoke, weather, range and concealment add up', () => {
    const r = perceptionSightModifiers({ light: 'partial', smoke: { kind: 'smoke', source: 'fire' }, weather: { label: 'Rain', value: 1 }, metres: 50, concealment: [{ kind: 'chameleon', rating: 2 }] });
    assert.equal(r.unseen, false);
    assert.equal(modifierTotal(r.modifiers), 2 + 4 + 1 + 1 + 2);
  });
  test('perception: walls, blindness or invisibility mean by ear only (light and smoke drop out)', () => {
    const r = perceptionSightModifiers({ light: 'darkness', los: false, smoke: { kind: 'smoke' }, metres: 1 });
    assert.equal(r.unseen, true);
    assert.deepEqual(r.modifiers.map((m) => m.value), [RULES.TN_AUTO.perception.hearingTn, -1]);
    assert.equal(perceptionSightModifiers({ blind: true }).why, 'blinded');
    assert.equal(perceptionSightModifiers({ concealment: [{ kind: 'invisibility', rating: 2, source: 'Invisibility' }] }).unseen, true);
  });
  test('perception: noSight block and ignore', () => {
    withRule(RULES.TN_AUTO.perception, 'noSight', 'block', () => assert.equal(perceptionSightModifiers({ los: false }).blocked, true));
    withRule(RULES.TN_AUTO.perception, 'noSight', 'ignore', () => {
      const r = perceptionSightModifiers({ los: false, light: 'minimal' });
      assert.equal(r.unseen, false);
      assert.equal(r.modifiers[0]!.value, 6); // v0.79.0 docs check (was 4)
    });
  });
  test('sneaker movement', () => {
    assert.equal(stealthMovementModifier('none'), null);
    assert.equal(stealthMovementModifier('walking'), null);
    assert.deepEqual(stealthMovementModifier('running'), { label: 'Sneaker running', value: 4 });
  });
});

describe('v0.50.0 TN automation: attacks', () => {
  const light = { label: 'Minimal light', value: 4 }, smoke = { label: 'Smoke', value: 4 }, weather = { label: 'Fog', value: 2 };
  const blindFire = { label: 'Blind fire', value: 8 }, blinded = { label: 'Blinded', value: 8 };
  test('blind fire and a blinded attacker count once, and light, smoke and weather drop out', () => {
    assert.deepEqual(attackVisibility({ light, smoke, weather, blindFire, blinded }), [blindFire]);
    assert.deepEqual(attackVisibility({ light, weather, blinded }), [blinded]);
  });
  test('seeing attackers get light, smoke, weather and concealment', () => {
    assert.equal(modifierTotal(attackVisibility({ light, smoke, weather, concealment: { label: 'Suit 2', value: 2 } })), 12);
  });
  test('switched off: everything adds up as before', () => {
    withRule(RULES.TN_AUTO.attack, 'blindNotStacked', false, () => assert.equal(modifierTotal(attackVisibility({ light, weather, blindFire, blinded })), 22));
  });
});

describe('v0.50.0 TN automation: social', () => {
  test('prejudice either way round; same metatype or no row is nothing', () => {
    assert.equal(metatypePrejudice('human', 'ork')!.value, 2);
    assert.equal(metatypePrejudice('ork', 'human')!.value, 2);
    assert.equal(metatypePrejudice('ork', 'ork'), null);
    assert.equal(metatypePrejudice('dwarf', 'human'), null);
    assert.equal(metatypePrejudice('', 'ork'), null);
  });
  test('attitude: stored first, else the token disposition', () => {
    assert.equal(attitudeFor('hostile', 1), 'hostile');
    assert.equal(attitudeFor('', -1), 'suspicious');
    assert.equal(attitudeFor(null, 1), 'friendly');
    assert.equal(attitudeFor(null, null), 'neutral');
    assert.equal(attitudeFor('nonsense', 0), 'neutral');
    withRule(RULES.TN_AUTO.social, 'attitudeFromToken', false, () => assert.equal(attitudeFor(null, 1), 'neutral'));
  });
});

describe('v0.50.0 TN automation: vehicles', () => {
  test('poor visibility from the dark or smoke; weather replaces it, the worse counts', () => {
    assert.deepEqual(drivingVisibility({ light: 'normal' }), []);
    assert.equal(drivingVisibility({ light: 'darkness' })[0]!.value, 2);
    assert.deepEqual(drivingVisibility({ light: 'minimal', vision: { thermographic: true, thermographicNatural: true } }), []); // v0.79.0: natural column
    assert.equal(drivingVisibility({ smoke: true }).length, 1);
    const fog = { label: 'Fog (driving)', value: 3 };
    assert.deepEqual(drivingVisibility({ light: 'darkness', weather: fog }), [fog]);
    assert.deepEqual(drivingVisibility({ light: 'normal', weather: fog }), [fog]);
  });
  test('sensor range bands from the Sensor rating', () => {
    assert.equal(sensorRangeModifier(50, 2), null);
    assert.equal(sensorRangeModifier(300, 2)!.value, 1);
    assert.equal(sensorRangeModifier(5000, 2)!.value, 4);
    assert.equal(sensorRangeModifier(null, 2), null);
  });
  test('vehicle vision: sensors when jumped in or on autopilot, else the driver', () => {
    assert.deepEqual(vehicleTestVision({ mode: 'manual', sensors: { thermographic: true }, driver: { lowLight: true } }), { lowLight: true });
    assert.deepEqual(vehicleTestVision({ mode: 'jumped', sensors: { thermographic: true }, driver: { lowLight: true } }), { thermographic: true });
    assert.deepEqual(vehicleTestVision({ mode: 'autopilot', sensors: {} }), {});
  });
});

import { rescoreResult, tnCandidates } from '../index.ts';

describe('v0.50.0 the GM changes a TN afterwards', () => {
  const dice = [{ faces: [6, 2], total: 8, success: true }, { faces: [5], total: 5, success: true }, { faces: [3], total: 3, success: false }];
  const r = { baseTargetNumber: 4, modifiers: [{ label: 'Rain', value: 1 }], targetNumber: 5, targetNumberClamped: false, totalDice: 3, dice, successes: 2, botch: false };
  test('the same dice against a new TN; the minimum TN still holds', () => {
    const a = rescoreResult(r, { baseTargetNumber: 4, modifiers: [{ label: 'Smoke', value: 4 }] });
    assert.equal(a.targetNumber, 8);
    assert.equal(a.successes, 1);
    assert.deepEqual(a.dice.map((d) => d.success), [true, false, false]);
    assert.equal(r.dice[1]!.success, true);              // the original is untouched
    const b = rescoreResult(r, { baseTargetNumber: 4, modifiers: [{ label: 'GM', value: -5 }] });
    assert.equal(b.targetNumber, 2);
    assert.equal(b.targetNumberClamped, true);
    assert.equal(b.successes, 3);
  });
  test('bought successes stay; a disaster stays a disaster', () => {
    assert.equal(rescoreResult(r, { baseTargetNumber: 9, modifiers: [], bought: 1 }).successes, 1);
    assert.equal(rescoreResult({ ...r, botch: true }, { baseTargetNumber: 2, modifiers: [] }).successes, 0);
  });
  test('candidates by test kind come from the system tables', () => {
    const atk = tnCandidates('attack');
    assert.ok(atk.some((g) => g.group === 'Situation' && g.rows.some((m) => m.label.startsWith('Target in partial cover'))));
    assert.ok(atk.some((g) => g.group === 'Visibility'));
    assert.ok(tnCandidates('social').some((g) => g.group === 'Attitude'));
    assert.ok(tnCandidates('drive').some((g) => g.group === 'Terrain'));
    assert.ok(tnCandidates('perceive').some((g) => g.group === 'Perception'));
    assert.ok(tnCandidates('plain').every((g) => g.rows.every((m) => m.value !== 0)));
  });
});
