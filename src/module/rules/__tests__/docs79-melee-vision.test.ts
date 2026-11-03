/**
 * v0.79.0 (melee_vision): the Visibility Table's columns, smoke, weather, reach and Perception sight rows. Each
 * switch in RULES.DOCS_V79 defaults to the documents' way; the old way is checked through oldWay().
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import {
  visionColumn, visibilityV79, smokeV79, smokeKindOld, weatherV79, reachV79, perceptionSightRows, perceptionSightModifiers,
} from '../docs79-melee-vision.ts';

const elf = { lowLight: true, lowLightNatural: true };
const cyberLL = { lowLight: true };
const dwarf = { thermographic: true, thermographicNatural: true };
const cyberThermo = { thermographic: true };

describe('v0.79.0 visibility: cybernetic and natural columns', () => {
  test('the defaults are the documents\' way', () => {
    assert.equal(RULES.DOCS_V79.visionCyberNatural, 'split');
    assert.equal(RULES.DOCS_V79.visionSmokeRows, 'book');
    assert.equal(RULES.DOCS_V79.visionWeatherFold, 'smoke');
    assert.equal(RULES.DOCS_V79.meleeReachShorter, 'both');
    assert.equal(RULES.DOCS_V79.perceptionSightBook, 'book');
  });
  test('natural if flagged, else cybernetic', () => {
    assert.equal(visionColumn(elf, 'lowLight'), 'natural');
    assert.equal(visionColumn(cyberLL, 'lowLight'), 'cyber');
    assert.equal(visionColumn({ thermographic: true, thermographicNatural: false }, 'thermographic'), 'cyber');
  });
  test('low-light: cyber partial +1 / natural 0, minimal +4 / +2, darkness +8 / +8', () => {
    assert.deepEqual(visibilityV79('partial', cyberLL), { value: 1, using: 'lowLight' });
    assert.deepEqual(visibilityV79('partial', elf), { value: 0, using: 'lowLight' });
    assert.equal(visibilityV79('minimal', cyberLL)!.value, 4); // normal minimal is +6 after the config.ts edit (+4 before)
    assert.deepEqual(visibilityV79('minimal', elf), { value: 2, using: 'lowLight' });
    assert.equal(visibilityV79('darkness', cyberLL)!.value, 8);
    assert.equal(visibilityV79('darkness', elf)!.value, 8);
  });
  test('thermographic: cyber partial +2 / natural +1, minimal +4 / +2, darkness +4 / +2', () => {
    assert.equal(visibilityV79('partial', cyberThermo)!.value, 2);
    assert.equal(visibilityV79('partial', dwarf)!.value, 1);
    assert.equal(visibilityV79('minimal', cyberThermo)!.value, 4);
    assert.equal(visibilityV79('minimal', dwarf)!.value, 2);
    assert.deepEqual(visibilityV79('darkness', cyberThermo), { value: 4, using: 'thermographic' });
    assert.deepEqual(visibilityV79('darkness', dwarf), { value: 2, using: 'thermographic' });
  });
  test('the normal column comes from RULES.COMBAT.vision.normal; the best eyes count', () => {
    assert.deepEqual(visibilityV79('partial', {}), { value: RULES.COMBAT.vision.normal.partial, using: 'normal' });
    assert.deepEqual(visibilityV79('normal', cyberLL), { value: 0, using: 'normal' });
    assert.deepEqual(visibilityV79('minimal', { ...elf, ...cyberThermo }), { value: 2, using: 'lowLight' });
    // Cybereyes on top of natural vision: the natural column is never worse.
    assert.equal(visibilityV79('minimal', { lowLight: true, lowLightNatural: true })!.value, 2);
  });
  test('ultrasound still counts', () => {
    assert.deepEqual(visibilityV79('darkness', { ultrasound: true }), { value: RULES.CYBERWARE.ultrasound.vision.darkness, using: 'ultrasound' });
  });
  test('glare and mist', () => {
    assert.deepEqual(visibilityV79('glare', {}), { value: 2, using: 'normal' });
    assert.equal(visibilityV79('glare', cyberLL)!.value, 2); // normal +2 beats cyber low-light +4
    assert.equal(visibilityV79('glare', dwarf)!.value, 2);
    assert.deepEqual(visibilityV79('mist', {}), { value: 2, using: 'normal' });
    assert.deepEqual(visibilityV79('mist', elf), { value: 0, using: 'lowLight' });
    assert.equal(visibilityV79('mist', cyberLL)!.value, 2);
    assert.deepEqual(visibilityV79('mist', cyberThermo), { value: 0, using: 'thermographic' });
  });
  test('old way: one column, light levels go back to the caller; glare and mist use the natural column', (t) => {
    t.after(oldWay({ 'DOCS_V79.visionCyberNatural': 'single' }));
    assert.equal(visibilityV79('minimal', cyberLL), null);
    assert.equal(visibilityV79('darkness', dwarf), null);
    assert.equal(visionColumn(cyberLL, 'lowLight'), 'natural');
    assert.equal(visibilityV79('mist', cyberLL)!.value, 0);
  });
});

describe('v0.79.0 smoke: heavy smoke and the natural low-light column', () => {
  test('light smoke +4: low-light +4 / +2, thermographic 0', () => {
    assert.deepEqual(smokeV79('smoke', {}), { value: 4, using: 'normal' });
    assert.equal(smokeV79('smoke', cyberLL)!.value, 4);
    assert.deepEqual(smokeV79('smoke', elf), { value: 2, using: 'lowLight' });
    assert.deepEqual(smokeV79('smoke', cyberThermo), { value: 0, using: 'thermographic' });
  });
  test('heavy smoke +6: low-light +6 / +4, thermographic +1 / 0', () => {
    assert.deepEqual(smokeV79('heavySmoke', {}), { value: 6, using: 'normal' });
    assert.equal(smokeV79('heavySmoke', cyberLL)!.value, 6);
    assert.equal(smokeV79('heavySmoke', elf)!.value, 4);
    assert.equal(smokeV79('heavySmoke', cyberThermo)!.value, 1);
    assert.equal(smokeV79('heavySmoke', dwarf)!.value, 0);
  });
  test('thermal smoke: as smoke, thermographic as the normal column', () => {
    assert.equal(smokeV79('thermal', elf)!.value, 2);
    assert.equal(smokeV79('thermal', dwarf)!.value, 4);
    assert.equal(smokeV79('heavyThermal', cyberThermo)!.value, 6);
    assert.equal(smokeV79('heavyThermal', elf)!.value, 4);
  });
  test('no smoke', () => {
    assert.deepEqual(smokeV79('none', elf), { value: 0, using: 'normal' });
  });
  test('one column (\'single\'): the cybernetic numbers', (t) => {
    t.after(oldWay({ 'DOCS_V79.visionCyberNatural': 'single' }));
    assert.equal(smokeV79('smoke', elf)!.value, 4);
    assert.equal(smokeV79('heavySmoke', dwarf)!.value, 1);
  });
  test('old way: back to the caller; heavy smoke counts as smoke', (t) => {
    t.after(oldWay({ 'DOCS_V79.visionSmokeRows': 'old' }));
    assert.equal(smokeV79('heavySmoke', elf), null);
    assert.equal(smokeKindOld('heavySmoke'), 'smoke');
    assert.equal(smokeKindOld('heavyThermal'), 'thermal');
    assert.equal(smokeKindOld('thermal'), 'thermal');
  });
});

describe('v0.79.0 weather: rain and fog are the smoke rows', () => {
  test('light rain and fog as light smoke, heavy rain and thick fog as heavy smoke', () => {
    assert.deepEqual(weatherV79('lightRain', {}), { label: 'Light rain', value: 4 });
    assert.equal(weatherV79('fog', elf)!.value, 2);
    assert.equal(weatherV79('fog', cyberThermo), null);
    assert.equal(weatherV79('heavyRain', {})!.value, 6);
    assert.equal(weatherV79('heavyFog', cyberThermo)!.value, 1);
    assert.equal(weatherV79('heavyFog', elf)!.value, 4);
  });
  test('weather the table doesn\'t cover, and clear, go back to the caller', () => {
    assert.equal(weatherV79('snow', {}), undefined);
    assert.equal(weatherV79('storm', {}), undefined);
    assert.equal(weatherV79('clear', {}), undefined);
  });
  test('rain still uses the book rows with the smoke switch on old', (t) => {
    t.after(oldWay({ 'DOCS_V79.visionSmokeRows': 'old' }));
    assert.equal(weatherV79('heavyRain', elf)!.value, 4);
  });
  test('old way: the weather table', (t) => {
    t.after(oldWay({ 'DOCS_V79.visionWeatherFold': 'own' }));
    assert.equal(weatherV79('lightRain', {}), undefined);
  });
});

describe('v0.79.0 reach: the shorter side +1 per point', () => {
  test('longer −1 per point, shorter +1 per point, each on its own test', () => {
    assert.deepEqual(reachV79(2, 0), [{ label: 'Reach +2', value: -2 }]);
    assert.deepEqual(reachV79(0, 1), [{ label: 'Opponent\'s reach +1', value: 1 }]);
    assert.deepEqual(reachV79(1, 1), []);
  });
  test('the defender house rule keeps its own code', (t) => {
    t.after(oldWay({ 'COMBAT.reach.appliesTo': 'defender' }));
    assert.equal(reachV79(0, 1), null);
  });
  test('old way: only the longer side', (t) => {
    t.after(oldWay({ 'DOCS_V79.meleeReachShorter': 'longer' }));
    assert.equal(reachV79(0, 1), null);
  });
});

describe('v0.79.0 Perception sight rows', () => {
  test('the book rows', () => {
    assert.deepEqual(perceptionSightRows().map((r) => [r.id, r.value]), [
      ['veryObvious', -4], ['brightlyColored', -2], ['normal', 0], ['partlyHidden', 2], ['notObvious', 4], ['verySmall', 6],
    ]);
  });
  test('rows stack, each once; old ids keep their numbers', () => {
    assert.deepEqual(perceptionSightModifiers(['verySmall', 'partlyHidden', 'verySmall']), [
      { label: 'Very small object', value: 6 }, { label: 'Object partially hidden', value: 2 },
    ]);
    assert.deepEqual(perceptionSightModifiers('veryObvious'), [{ label: 'Action very obvious', value: -4 }]);
    assert.deepEqual(perceptionSightModifiers('hidden'), [{ label: 'Action not obvious', value: 4 }]);
    assert.deepEqual(perceptionSightModifiers('wellHidden'), [{ label: 'Very small object', value: 6 }]);
    assert.deepEqual(perceptionSightModifiers('obvious'), [{ label: 'Object brightly colored', value: -2 }]);
    assert.deepEqual(perceptionSightModifiers('normal'), []);
    assert.deepEqual(perceptionSightModifiers(null), []);
    assert.deepEqual(perceptionSightModifiers('bogus'), []);
  });
  test('old way: the obviousness scale', (t) => {
    t.after(oldWay({ 'DOCS_V79.perceptionSightBook': 'scale' }));
    assert.equal(perceptionSightModifiers('hidden'), null);
    assert.deepEqual(perceptionSightRows(), RULES.CHARACTERS_V58.notice.obviousness);
  });
});
