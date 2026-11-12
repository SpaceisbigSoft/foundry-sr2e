import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import {
  RULES, recentDoses, drugAddictionTest, toleranceLoss, applyTolerance, withdrawalState, withdrawalModifiers,
  radiationTest, suffocationTn, careCost, homeCareModifier, protectionFor, weatherModifier,
} from '../index.ts';

const DAY = 86400;

describe('v0.42.0 health and environment (rules)', () => {
  test('addiction: recent doses raise the TN; the type picks the attribute', () => {
    const now = 30 * DAY;
    assert.deepEqual(recentDoses([now - 8 * DAY, now - 2 * DAY, now], now), [now - 2 * DAY, now]);
    assert.deepEqual(drugAddictionTest(4, 'physical', 1), { attribute: 'body', tn: 4 });
    assert.deepEqual(drugAddictionTest(4, 'mental', 3), { attribute: 'willpower', tn: 6 });
    assert.equal(drugAddictionTest(1, 'mental', 1).tn, RULES.MIN_TARGET_NUMBER);
  });

  test('tolerance takes points off positive bonuses only', () => {
    assert.equal(toleranceLoss(4), 0);
    assert.equal(toleranceLoss(5), 1);
    assert.equal(toleranceLoss(11), 2);
    assert.deepEqual(applyTolerance({ attributes: { quickness: 2, willpower: -1 }, reaction: 1, initiativeDice: 1 }, 1),
      { attributes: { quickness: 1, willpower: -1 }, reaction: 0, initiativeDice: 0 });
  });

  test('withdrawal sets in after a day without a dose; kicking needs the days clean', () => {
    const a = { drug: 'Novacoke', rating: 5, type: 'mental', recent: [], lastDose: 0, addicted: true, dosesAddicted: 0 };
    assert.equal(withdrawalState(a, 23 * 3600).withdrawal, false);
    assert.equal(withdrawalState(a, 24 * 3600).withdrawal, true);
    assert.equal(withdrawalState(a, 13 * DAY).canKick, false);
    assert.equal(withdrawalState(a, 14 * DAY).canKick, true);
    assert.equal(withdrawalState({ ...a, addicted: false }, 30 * DAY).withdrawal, false);
    const mods = withdrawalModifiers([a, { ...a, drug: 'Kamikaze' }], 2 * DAY);
    assert.equal(mods.length, 1);
    assert.equal(mods[0]!.value, RULES.HEALTH.addiction.withdrawalTn);
    assert.match(mods[0]!.label, /Novacoke, Kamikaze/);
  });

  test('radiation, suffocation, care costs and home care', () => {
    assert.deepEqual(radiationTest(6, 2.5), { tn: 6, level: 'M', type: 'physical', tests: 3 });
    assert.equal(suffocationTn(0), 4);
    assert.equal(suffocationTn(3), 7);
    assert.equal(careCost('hospital', 24), 500);
    assert.equal(careCost('hospital', 25), 1000);
    assert.equal(careCost('intensive', 1), 1000);
    assert.equal(careCost('none', 48), 0);
    assert.equal(homeCareModifier('street'), 2);
    assert.equal(homeCareModifier('luxury'), -1);
    assert.equal(homeCareModifier('unknown'), 0);
  });

  test('protection: a worn gas mask stops inhalants; respirators and chemsuits add dice', (t) => {
    // v0.92.3: the old respirator dice (by the book it is its own air supply: v0923-health.test.ts).
    t.after(oldWay({ 'HEALTH_V923.respirator': 'dice' }));
    const gear = [{ kind: 'gasMask', rating: 0, worn: false, name: 'Mask' }, { kind: 'respirator', rating: 3, worn: true, name: 'Resp' }, { kind: 'chemsuit', rating: 4, worn: true, name: 'Suit' }];
    assert.deepEqual(protectionFor(gear, 'inhalation'), { immune: false, dice: 3, label: 'Resp 3' });
    assert.equal(protectionFor([{ ...gear[0]!, worn: true }], 'inhalation').immune, true);
    assert.equal(protectionFor(gear, 'contact').dice, 4);
    assert.equal(protectionFor(gear, 'injection').dice, 0);
  });

  test('weather: the best vision counts', (t) => {
    t.after(oldWay({ 'DOCS_V79.visionWeatherFold': 'own' })); // v0.79.0: the old weather table (a house rule)
    assert.equal(weatherModifier('clear', {}), null);
    assert.equal(weatherModifier('heavyFog', {})!.value, 4);
    assert.equal(weatherModifier('heavyFog', { thermographic: true })!.value, 2);
    assert.equal(weatherModifier('snow', { lowLight: true, thermographic: true })!.value, 2);
  });
});
