import { test, describe, before, after } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import {
  bundleHasEffect, scaleBundle, sumBundles, describeBundle, woundLevelForBoxes, healDrainLevel, treatWindowProblem,
  touchReach, touchContact, learningPlan, permanentTurns, permanentUntil, wardPlan, detectionRangeMetres,
  detectionRangeProblem, assensingReveals, centeringCut, centeringMode, timeOfDayHours, nextDawnOrDusk,
  type AssenseSubject,
} from '../arcanum.ts';
import { RULES } from '../config.ts';

const R = RULES as any;
const V = R.MAGIC_V56;
const H = 3600;

describe('v0.56.0 effect bundles', () => {
  test('bundleHasEffect', () => {
    assert.equal(bundleHasEffect(null), false);
    assert.equal(bundleHasEffect(undefined), false);
    assert.equal(bundleHasEffect({}), false);
    assert.equal(bundleHasEffect({ attributes: { body: 0 }, reaction: 0, movementFactor: 1 }), false);
    assert.equal(bundleHasEffect({ attributes: { body: -1 } }), true);
    assert.equal(bundleHasEffect({ attackedTn: 2 }), true);
    assert.equal(bundleHasEffect({ movementFactor: 0.5 }), true);
  });
  test('scaleBundle: no successes, flat, per success, capped', () => {
    const base = { attributes: { quickness: 1, willpower: -1, body: 0 }, initiativeDice: 1, movementFactor: 2 };
    const none = scaleBundle(base, { perSuccess: true, successes: 0 });
    assert.equal(none.initiativeDice, 0);
    assert.deepEqual(none.attributes, {});
    assert.equal(none.movementFactor, 1);
    const flat = scaleBundle(base, { perSuccess: false, successes: 4 });
    assert.deepEqual(flat.attributes, { quickness: 1, willpower: -1 });
    assert.equal(flat.initiativeDice, 1);
    assert.equal(flat.reaction, 0);
    assert.equal(flat.movementFactor, 2);
    const per = scaleBundle(base, { perSuccess: true, successes: 3 });
    assert.deepEqual(per.attributes, { quickness: 3, willpower: -3 });
    assert.equal(per.initiativeDice, 3);
    assert.equal(per.movementFactor, 2);
    const capped = scaleBundle(base, { perSuccess: true, successes: 5, capAt: 2 });
    assert.deepEqual(capped.attributes, { quickness: 2, willpower: -2 });
    assert.equal(capped.initiativeDice, 2);
    const stepped = scaleBundle({ ballistic: 1 }, { perSuccess: true, successes: 5, step: 2 });
    assert.equal(stepped.ballistic, 2);
    assert.equal(stepped.movementFactor, 1);
    const tooFew = scaleBundle({ attributes: { body: 1 } }, { perSuccess: true, successes: 1, step: 2 });
    assert.deepEqual(tooFew.attributes, {});
  });
  test('scaleBundle reads the default step from config', () => {
    const old = V.spellEffects.step;
    V.spellEffects.step = 2;
    try {
      assert.equal(scaleBundle({ impact: 1 }, { perSuccess: true, successes: 4 }).impact, 2);
    } finally { V.spellEffects.step = old; }
  });
  test('sumBundles adds numbers and attributes, multiplies movement', () => {
    const s = sumBundles([
      { attributes: { body: 2 }, testsTn: 1, movementFactor: 2 },
      null,
      { attributes: { body: -2, quickness: 1 }, testsTn: 2, movementFactor: 0.5 },
      { initiativeDice: 1, movementFactor: 3 },
      undefined,
    ]);
    assert.deepEqual(s.attributes, { quickness: 1 });
    assert.equal(s.testsTn, 3);
    assert.equal(s.initiativeDice, 1);
    assert.equal(s.movementFactor, 3);
    assert.equal(sumBundles([]).movementFactor, 1);
  });
  test('describeBundle', () => {
    assert.equal(describeBundle({}), 'no change');
    assert.equal(
      describeBundle({ attributes: { quickness: 2, willpower: -1 }, reaction: 1, initiativeDice: 1, ballistic: 2, impact: 1, testsTn: 2, perceivedTn: 2, attackedTn: 2, movementFactor: 2 }),
      'Quickness +2, Willpower −1, Reaction +1, +1 initiative die, armor +2/+1, TN +2 on all tests, +2 TN to perceive, +2 TN to attack, movement ×2',
    );
    assert.equal(describeBundle({ initiativeDice: 2, impact: 3 }), '+2 initiative dice, armor +0/+3');
    assert.equal(describeBundle({ testsTn: -1, movementFactor: 0.5 }), 'TN −1 on all tests, movement ÷2');
    assert.equal(describeBundle({ movementFactor: 0.25 }), 'movement ÷4');
    assert.equal(describeBundle({ movementFactor: 0.4 }), 'movement ×0.4');
    assert.equal(describeBundle({ movementFactor: 1 }), 'no change');
  });
});

describe('v0.56.0 healing', () => {
  test('wound levels by boxes', () => {
    assert.equal(woundLevelForBoxes(0), null);
    assert.equal(woundLevelForBoxes(1), 'L');
    assert.equal(woundLevelForBoxes(2), 'L');
    assert.equal(woundLevelForBoxes(3), 'M');
    assert.equal(woundLevelForBoxes(9), 'S');
    assert.equal(woundLevelForBoxes(10), 'D');
    assert.equal(woundLevelForBoxes(12), 'D');
    assert.equal(healDrainLevel(4, 'D'), 'M');
    assert.equal(healDrainLevel(0, 'S'), 'S');
  });
  test('the Treat window', () => {
    assert.equal(treatWindowProblem(null, 10 * H), null);
    assert.equal(treatWindowProblem(undefined, 10 * H), null);
    assert.equal(treatWindowProblem(NaN, 10 * H), null);
    assert.equal(treatWindowProblem(0, H), null);
    assert.equal(treatWindowProblem(0, 3 * H), 'Treat only works within 1 hour of the wound (it was 3 hours ago).');
    assert.equal(treatWindowProblem(0, 1.25 * H), 'Treat only works within 1 hour of the wound (it was 1.3 hours ago).');
    const old = V.healing.treatHours;
    V.healing.treatHours = 0;
    try { assert.equal(treatWindowProblem(0, 100 * H), null); } finally { V.healing.treatHours = old; }
    V.healing.treatHours = 2;
    try {
      assert.equal(treatWindowProblem(0, 2 * H), null);
      assert.equal(treatWindowProblem(0, 5 * H), 'Treat only works within 2 hours of the wound (it was 5 hours ago).');
    } finally { V.healing.treatHours = old; }
  });
});

describe('v0.56.0 touch spells', () => {
  test('reach', () => {
    assert.equal(touchReach(null), 'unknown');
    assert.equal(touchReach(undefined), 'unknown');
    assert.equal(touchReach(NaN), 'unknown');
    assert.equal(touchReach(2), 'ok');
    assert.equal(touchReach(2.1), 'far');
  });
  test('contact: opposed needs more successes, else any', () => {
    assert.equal(touchContact(2, 1), true);
    assert.equal(touchContact(1, 1), false);
    assert.equal(touchContact(0, 0), false);
    const old = V.touch.opposed;
    V.touch.opposed = false;
    try {
      assert.equal(touchContact(1, 3), true);
      assert.equal(touchContact(0, 0), false);
    } finally { V.touch.opposed = old; }
  });
});

describe('v0.56.0 learning and permanent spells', () => {
  test('learning plan', (t) => {
    // v0.92.3: the v0.92.2 rule (RULES.SORCERY_V923).
    t.after(oldWay({ 'SORCERY_V923.learning': 'v922' }));
    assert.deepEqual(learningPlan(5, 2), { tn: 5, baseDays: 5, days: 3 });
    assert.deepEqual(learningPlan(1, 1), { tn: 2, baseDays: 1, days: 1 });
    assert.deepEqual(learningPlan(4, 0), { tn: 4, baseDays: 4, days: null });
  });
  test('permanent turns and time', () => {
    assert.equal(permanentTurns(6, 0), null);
    assert.equal(permanentTurns(6, 4), 2);
    assert.equal(permanentTurns(1, 5), 1);
    assert.equal(permanentUntil(100, 6, 4), 106);
    assert.equal(permanentUntil(100, 6, 0), null);
  });
});

describe('v0.56.0 wards', () => {
  test('ward plan', (t) => {
    // v0.92.3: the v0.92.2 rule (RULES.SORCERY_V923).
    t.after(oldWay({ 'SORCERY_V923.ward': 'v922', 'MAGIC_V56.ward.nuyenPerForce': 0 }));
    assert.deepEqual(wardPlan(5, 2), { tn: 5, baseHours: 5, hours: 3, nuyen: 0, drainTn: 2, drainLevel: 'M' });
    assert.deepEqual(wardPlan(8, 0), { tn: 8, baseHours: 8, hours: null, nuyen: 0, drainTn: 4, drainLevel: 'M' });
    const old = { ...V.ward };
    V.ward.nuyenPerForce = 100;
    V.ward.drainModifier = 1;
    V.ward.drainLevel = 'S';
    try {
      assert.deepEqual(wardPlan(6, 3), { tn: 6, baseHours: 6, hours: 2, nuyen: 600, drainTn: 4, drainLevel: 'S' });
    } finally { Object.assign(V.ward, old); }
  });
});

describe('v0.56.0 detection range', () => {
  test('range and the problem message', () => {
    assert.equal(detectionRangeMetres(6, 4, false), 24);
    assert.equal(detectionRangeMetres(6, 4, true), 240);
    assert.equal(detectionRangeMetres(-1, 4, false), 0);
    assert.equal(detectionRangeProblem(null, 6, 4, false), null);
    assert.equal(detectionRangeProblem(24, 6, 4, false), null);
    assert.equal(detectionRangeProblem(44.6, 6, 4, false), 'is 45 m away; the spell reaches 24 m (Magic 6 × Force 4).');
    assert.equal(detectionRangeProblem(300, 6, 4, true), 'is 300 m away; the spell reaches 240 m (Magic 6 × Force 4 × 10, extended).');
    assert.equal(detectionRangeProblem(100, 6, 4, true), null);
  });
});

describe('v0.56.0 assensing (the v0.92.2 table)', () => {
  let back: () => void = () => {};
  before(() => { back = oldWay({ 'SPIRITS_V923.assensing': 'v922' }); });
  after(() => back());
  const subject: AssenseSubject = {
    name: 'Kim', physical: 3, stun: 1, status: 'ok', essence: 5.25, magic: 6, awakened: true, tradition: 'hermetic',
    cyberware: ['datajack'], foci: ['power focus 2'], sustained: ['Armor'], emotion: 'anxious', signatures: ['Fireball'],
  };
  const me = { essence: 6, magic: 4 };
  test('nothing on no successes', () => {
    assert.deepEqual(assensingReveals(0, subject, me), []);
  });
  test('one success', () => {
    assert.deepEqual(assensingReveals(1, subject, me), ['Health: Physical 3 boxes, Stun 1 box', 'Mood: anxious', 'Awakened (hermetic)', 'Active foci: power focus 2']);
  });
  test('cumulative to four', () => {
    assert.deepEqual(assensingReveals(4, subject, me), [
      'Health: Physical 3 boxes, Stun 1 box', 'Mood: anxious', 'Awakened (hermetic)', 'Active foci: power focus 2',
      'Cyberware: yes', 'Essence: lower than yours', 'Magic: higher than yours',
      'Essence 5.25', 'Magic 6', 'Cyberware: datajack', 'Sustaining: Armor',
      'Recognises signatures: Fireball',
    ]);
  });
  test('a mundane, unhurt, calm subject with nothing to list', () => {
    const m: AssenseSubject = { name: 'Joe', physical: 0, stun: 0, status: 'ok', essence: 6, magic: 0, awakened: false, cyberware: [], foci: [], sustained: [] };
    assert.deepEqual(assensingReveals(9, m, { essence: 5.6, magic: 5 }), [
      'Health: unhurt', 'Mood: calm', 'Mundane', 'Cyberware: none', 'Essence: about the same as yours', 'Essence 6',
    ]);
  });
  test('status shown when not ok; unknown keys ignored', () => {
    const old = V.assensing;
    V.assensing = [{ successes: 1, reveals: ['health', 'bogus'] }];
    try {
      assert.deepEqual(assensingReveals(1, { ...subject, status: 'unconscious' }, me), ['Health: Physical 3 boxes, Stun 1 box (unconscious)']);
    } finally { V.assensing = old; }
  });
});

describe('v0.56.0 centering (the v0.92.2 way)', () => {
  let back: () => void = () => {};
  before(() => { back = oldWay({ 'SORCERY_V923.centering': 'v922' }); });
  after(() => back());
  test('cut is the least of successes, grade cap and penalties', () => {
    assert.equal(centeringCut(3, 2, 5), 2);
    assert.equal(centeringCut(1, 2, 5), 1);
    assert.equal(centeringCut(4, 4, 2), 2);
    assert.equal(centeringCut(-1, 2, 5), 0);
    assert.equal(centeringCut(3, -1, 5), 0);
  });
  test('mode', (t) => {
    // v0.92.3: the v0.92.2 rule (RULES.SORCERY_V923).
    t.after(oldWay({ 'SORCERY_V923.centering': 'v922' }));
    assert.equal(centeringMode('Centering (Dance)'), 'test');
    assert.equal(centeringMode('  '), 'auto');
    assert.equal(centeringMode(null), 'auto');
    const old = V.centering.mode;
    try {
      V.centering.mode = 'auto';
      assert.equal(centeringMode('Centering'), 'auto');
      V.centering.mode = 'test';
      assert.equal(centeringMode(''), 'test');
    } finally { V.centering.mode = old; }
  });
});

describe('v0.56.0 nature spirits and time of day', () => {
  test('time of day', () => {
    assert.equal(timeOfDayHours(0), 0);
    assert.equal(timeOfDayHours(6.5 * H), 6.5);
    assert.equal(timeOfDayHours(30 * H), 6);
    assert.equal(timeOfDayHours(-H), 23);
    const old = V.natureSpirits.dayStartHour;
    V.natureSpirits.dayStartHour = 20;
    try { assert.equal(timeOfDayHours(5 * H), 1); } finally { V.natureSpirits.dayStartHour = old; }
  });
  test('next sunrise or sunset', () => {
    assert.deepEqual(nextDawnOrDusk(0), { at: 6 * H, which: 'sunrise' });
    assert.deepEqual(nextDawnOrDusk(6 * H), { at: 18 * H, which: 'sunset' });
    assert.deepEqual(nextDawnOrDusk(6 * H - 1), { at: 6 * H, which: 'sunrise' });
    assert.deepEqual(nextDawnOrDusk(18 * H), { at: 30 * H, which: 'sunrise' });
    assert.deepEqual(nextDawnOrDusk(23 * H + 0.5), { at: 30 * H, which: 'sunrise' });
    assert.deepEqual(nextDawnOrDusk(3 * 24 * H + 12 * H), { at: 3 * 24 * H + 18 * H, which: 'sunset' });
    assert.deepEqual(nextDawnOrDusk(-H), { at: 6 * H, which: 'sunrise' });
  });
  test('next sunrise or sunset with a day start hour', () => {
    const old = V.natureSpirits.dayStartHour;
    V.natureSpirits.dayStartHour = 20;
    try {
      // world 0 = 20:00; sunrise 06:00 is 10 hours later.
      assert.deepEqual(nextDawnOrDusk(0), { at: 10 * H, which: 'sunrise' });
      assert.deepEqual(nextDawnOrDusk(10 * H), { at: 22 * H, which: 'sunset' });
    } finally { V.natureSpirits.dayStartHour = old; }
  });
});
