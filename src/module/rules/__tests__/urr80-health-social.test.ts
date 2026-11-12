/**
 * v0.80.0 health-social: the Unified Rules Revamp's pure functions (rules/urr80-health-social.ts), each with the
 * shipped (book) values and under the Revamp (urrMode).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import {
  deathBoxExtra, bleedTurnsPerBox, bleedRateText, selfStabiliseTest, traumaPatchInhibitors, traumaPatchTest, stunRecoveryTest,
  firstAidByLevel, firstAidDeadlyOnly, firstAidLevelBoxes, firstAidMinutes, firstAidRetryAllowed, magicLossOnTreatment,
  deadlyNeedsIntensive, overdoseStats, breathHoldTurns, fitness, athleticsDistanceUrr, fallingDamageUrr,
  socialExtraRows,
} from '../urr80-health-social.ts';
import { urrMode } from './urrmode.ts';
import { oldWay } from './oldway.ts';

const plating = { type: 'cyberware', name: 'Dermal plating', system: { installed: true, kind: 'other', armorBallistic: 2 } };
const filter = { type: 'cyberware', name: 'Blood filter', system: { installed: true, kind: 'filtration', filterKind: 'blood', rating: 3 } };
const limb = { type: 'cyberware', name: 'Arm', system: { installed: true, kind: 'cyberlimb', armorBallistic: 2 } };

// v0.92.3: the Book Rules now follow the book where these Revamp switches give the book's rule (RULES.HEALTH_V923);
// with those switches set back to the v0.92.2 way, every Revamp switch is off as before.
const OLD923 = { 'HEALTH_V923.death': 'total', 'HEALTH_V923.bleed': 'bodyTurns', 'HEALTH_V923.stunRecovery': 'old', 'HEALTH_V923.firstAid': 'boxes',
  'HEALTH_V923.firstAidTime': 'hidden', 'HEALTH_V923.selfStabilise': 'none', 'HEALTH_V923.firstAidRetry': 'once', 'HEALTH_V923.traumaPatch': 'stabilise',
  'HEALTH_V923.magicLossUntreated': 'none', 'HEALTH_V923.breathHold': 'none', 'HEALTH_V923.falling': 'old' };

describe('v0.80.0 health-social: shipped values are the book', () => {
  test('every switch is off', (t) => {
    t.after(oldWay(OLD923));
    assert.equal(deathBoxExtra(), 0);
    assert.equal(bleedTurnsPerBox(4), 4);
    assert.equal(bleedRateText(), '');
    assert.equal(selfStabiliseTest(4), null);
    assert.equal(traumaPatchTest(4, [plating]), null);
    assert.equal(stunRecoveryTest({ body: 4, willpower: 6, monitor: { physical: 0, stun: 4 } }), null);
    assert.equal(firstAidByLevel(), false);
    assert.equal(firstAidDeadlyOnly('physical', 10), false);
    assert.equal(firstAidLevelBoxes(4), null);
    assert.equal(firstAidMinutes(4, 2), null);
    assert.equal(firstAidRetryAllowed(2, 4), false);
    assert.equal(magicLossOnTreatment({ magician: true, applyMagician: false }), false);
    assert.equal(deadlyNeedsIntensive(10, 'hospital'), null);
    assert.equal(overdoseStats(6, 'M', 1), null);
    assert.equal(breathHoldTurns(4), 0);
    assert.equal(athleticsDistanceUrr('jump', 2, true, { strength: 4, quickness: 5 }), null);
    assert.equal(fallingDamageUrr(8), null);
    assert.deepEqual(socialExtraRows(), []);
  });
  test('the book patch targets keep their book values', () => {
    // v0.92.3: 1, box for box, is the book's too (Core p. 111); the patch still sets it.
    assert.equal(RULES.STUN_OVERFLOW_PER_PHYSICAL_BOX, 1);
    assert.equal(RULES.METATYPES.types['troll']!.run, 3);
    assert.equal(RULES.STREET.haggle.percentPerNet, 5);
    assert.equal(RULES.SOCIAL.skills['Negotiation'], 'willpower');
    assert.deepEqual(RULES.STREET.athletics.climb.map((c) => c.tn), [2, 4, 6, 8]);
  });
  test('a numeric turnsPerBox still counts', (t) => {
    t.after(oldWay({ 'HEALTH_V923.bleed': 'bodyTurns' }));
    const keep = RULES.CONDITIONS.dying.turnsPerBox;
    (RULES.CONDITIONS.dying as any).turnsPerBox = 5;
    t.after(() => { (RULES.CONDITIONS.dying as any).turnsPerBox = keep; });
    assert.equal(bleedTurnsPerBox(4), 5);
  });
});

describe('v0.80.0 health-social: the Revamp', () => {
  test('death and bleeding', (t) => {
    t.after(urrMode());
    assert.equal(deathBoxExtra(), 1);
    assert.equal(bleedTurnsPerBox(4), 200);                          // 10 minutes of 3-second Combat Turns
    assert.match(bleedRateText(), /every 10 minutes/);
    assert.deepEqual(selfStabiliseTest(4), { dice: 4, tn: 10 });
  });
  test('trauma patch: natural Body vs 4 + dermal armor and blood filters (not cyberlimbs)', (t) => {
    t.after(urrMode());
    assert.deepEqual(traumaPatchInhibitors([plating, filter, limb]).map((m) => m.value), [2, 3]);
    const tp = traumaPatchTest(5, [plating]);
    assert.deepEqual({ dice: tp!.dice, tn: tp!.tn, mods: tp!.modifiers.length }, { dice: 5, tn: 4, mods: 1 });
    assert.deepEqual(traumaPatchInhibitors([{ ...plating, system: { ...plating.system, installed: false } }]), []);
  });
  test('Stun recovery: the higher attribute, TN 2 + wound modifiers', (t) => {
    t.after(urrMode());
    const s = stunRecoveryTest({ body: 4, willpower: 6, monitor: { physical: 1, stun: 4 } })!;
    assert.equal(s.attribute, 'willpower');
    assert.equal(s.tn, 2);
    assert.deepEqual(s.modifiers, [{ id: 'wounds', label: 'Wounds', value: 3 }]);  // Light Physical +1, Moderate Stun +2
    assert.equal(stunRecoveryTest({ body: 5, willpower: 5, monitor: { physical: 0, stun: 0 } })!.attribute, 'body');
    assert.deepEqual(stunRecoveryTest({ body: 5, willpower: 5, monitor: { physical: 0, stun: 0 } })!.modifiers, []);
  });
  test('first aid: one level, Deadly only stabilised, time, retry, Magic loss', (t) => {
    t.after(urrMode());
    assert.equal(firstAidLevelBoxes(1), 1);                          // Light clears
    assert.equal(firstAidLevelBoxes(5), 4);                          // Moderate → 1
    assert.equal(firstAidLevelBoxes(9), 6);                          // Serious → 3
    assert.equal(firstAidLevelBoxes(10), 0);                         // Deadly Physical: stabilise only
    assert.equal(firstAidLevelBoxes(10, 'stun'), 4);                 // Deadly Stun → 6
    assert.equal(firstAidLevelBoxes(0), 0);
    assert.equal(firstAidDeadlyOnly('physical', 12), true);
    assert.equal(firstAidDeadlyOnly('stun', 10), false);
    assert.equal(firstAidMinutes(2, 1), 10);
    assert.equal(firstAidMinutes(4, 3), 7);                          // 20 ÷ 3, round up
    assert.equal(firstAidMinutes(8, 2), 15);
    assert.equal(firstAidMinutes(10, 2), null);
    assert.equal(firstAidMinutes(4, 0), null);
    assert.equal(firstAidRetryAllowed(2, 4), true);
    assert.equal(firstAidRetryAllowed(4, 4), false);
    assert.equal(firstAidRetryAllowed(undefined, 4), false);
    assert.equal(magicLossOnTreatment({ magician: true, applyMagician: false }), true);
    assert.equal(magicLossOnTreatment({ magician: true }), false);
    assert.equal(magicLossOnTreatment({ magician: false, applyMagician: false }), false);
  });
  test('healing a Deadly wound needs intensive care', (t) => {
    t.after(urrMode());
    assert.match(deadlyNeedsIntensive(10, 'hospital')!, /intensive care/);
    assert.equal(deadlyNeedsIntensive(10, 'intensive'), null);
    assert.equal(deadlyNeedsIntensive(9, 'none'), null);
  });
  test('overdose: the second dose a level up, then +1 Power a dose', (t) => {
    t.after(urrMode());
    assert.equal(overdoseStats(6, 'M', 0), null);
    assert.deepEqual(overdoseStats(6, 'M', 1), { power: 6, level: 'S' });
    assert.deepEqual(overdoseStats(6, 'M', 3), { power: 8, level: 'S' });
    assert.deepEqual(overdoseStats(6, 'D', 1), { power: 6, level: 'D' });
  });
  test('breath, Fitness, athletics', (t) => {
    t.after(urrMode());
    assert.equal(breathHoldTurns(4), 40);                            // 120 s
    assert.equal(fitness(4, 5), 4);
    assert.equal(athleticsDistanceUrr('climb', 6, false, { strength: 4, quickness: 5 }), 4);
    assert.equal(athleticsDistanceUrr('climb', 2, false, { strength: 4, quickness: 5 }), 2);
    assert.equal(athleticsDistanceUrr('jump', 0, false, { strength: 4, quickness: 5 }), 2);
    assert.equal(athleticsDistanceUrr('jump', 3, false, { strength: 4, quickness: 5 }), 3);   // Fitness 5 × 0.5, round up
    assert.equal(athleticsDistanceUrr('jump', 2, true, { strength: 4, quickness: 5 }), 5);
    assert.equal(athleticsDistanceUrr('swim', 3, false, { strength: 4, quickness: 5 }), 2);   // (5 + 3) × 1 ÷ 4
    assert.equal(athleticsDistanceUrr('swim', 3, true, { strength: 4, quickness: 5, runMultiplier: 3 }), 6);
    assert.deepEqual(RULES.STREET.athletics.climb.map((c) => c.tn), [3, 5, 8, 14]);
    assert.equal(RULES.METATYPES.types['troll']!.run, 2);
  });
  test('falling by height', (t) => {
    t.after(urrMode());
    assert.deepEqual(fallingDamageUrr(2), { power: 0, level: null, armor: 0 });
    assert.deepEqual(fallingDamageUrr(3), { power: 1, level: 'L', armor: 0 });
    assert.deepEqual(fallingDamageUrr(5), { power: 2, level: 'M', armor: 0 });
    assert.deepEqual(fallingDamageUrr(8), { power: 4, level: 'S', armor: 0 });
    assert.deepEqual(fallingDamageUrr(9), { power: 4, level: 'D', armor: 0 });
  });
  test('social and perception', (t) => {
    t.after(urrMode());
    assert.deepEqual(socialExtraRows(), [{ id: 'visibleArmor', label: 'Visible armor in a luxury setting', value: 2 }]);
    assert.equal(RULES.SOCIAL.skills['Negotiation'], 'intelligence');
    assert.equal(RULES.STREET.haggle.percentPerNet, 10);
    assert.ok(RULES.STREET.perception.some((r) => r.id === 'grenade' && r.value === -8));
    assert.ok(RULES.DOCS_V79.perceptionSightRows.some((r) => r.id === 'camouflage' && r.value === 4));
    assert.equal(RULES.STUN_OVERFLOW_PER_PHYSICAL_BOX, 1);
  });
});
