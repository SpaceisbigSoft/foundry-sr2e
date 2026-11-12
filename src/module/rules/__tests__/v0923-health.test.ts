/**
 * v0.92.3 book alignment, damage, health and hazards (RULES.HEALTH_V923, rules/health923.ts): each rule's default is the
 * book's, the switch gives the old (v0.92.2) result, and the Revamp's own switches still decide under the Revamp.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import { urrMode } from './urrmode.ts';
import * as H from '../health923.ts';
import { applyDamageToMonitor, monitorStatus, addStun } from '../damage.ts';
import { firstAidTarget, firstAidBoxes, dyingTick } from '../core.ts';
import { deathBoxExtra, bleedTurnsPerBox, stunRecoveryTest, selfStabiliseTest, traumaPatchTest, firstAidMinutes, firstAidRetryAllowed, magicLossOnTreatment, breathHoldTurns, firstAidDeadlyOnly } from '../urr80-health-social.ts';
import { healingTargetNumber, magicLossOutcome } from '../spellcraft.ts';
import { surgicalTrauma } from '../tactics.ts';
import { protectionFor, withdrawalState, withdrawalModifiers, type Addiction } from '../hazards.ts';
import { painToleranceMonitor, qualityVitals, sensitiveBodyIndex, sensitiveRejectionTn } from '../vitals.ts';
import { HEALTH_V923, HOUSE_HEALTH_V923 } from '../config923/health.ts';

describe('v0.92.3 health: the config', () => {
  test('wired into RULES; every switch has a window row whose first choice is the default', () => {
    assert.equal(RULES.HEALTH_V923, HEALTH_V923);
    for (const row of HOUSE_HEALTH_V923.filter((r) => r.type === 'select')) {
      const key = row.path.split('.').slice(1).join('.');
      assert.equal((HEALTH_V923 as any)[key], row.choices![0], row.path);
    }
  });
});

describe('v0.92.3 health: damage and death (Core p. 111)', () => {
  test('Stun past a full track goes onto Physical box for box; the old 2:1 by the house value', (t) => {
    assert.equal(RULES.STUN_OVERFLOW_PER_PHYSICAL_BOX, 1);
    // Core p. 111's example: Serious Stun on 6 boxes fills 4 Stun and 2 Physical.
    assert.deepEqual(applyDamageToMonitor({ physical: 0, stun: 6 }, 'stun', 'S', 4).monitor, { physical: 2, stun: 10 });
    t.after(oldWay({ STUN_OVERFLOW_PER_PHYSICAL_BOX: 2 }));
    assert.deepEqual(addStun({ physical: 0, stun: 6 }, 6), { physical: 1, stun: 10 });
  });
  test('dead only when the Overflow is more than the natural Body', (t) => {
    assert.equal(deathBoxExtra(), 1);
    assert.equal(monitorStatus({ physical: 14, stun: 0 }, 4), 'dying');
    assert.equal(monitorStatus({ physical: 15, stun: 0 }, 4), 'dead');
    assert.equal(H.deathBody(6, 4), 4);
    assert.equal(H.deathBody(6, undefined), 6);
    t.after(oldWay({ 'HEALTH_V923.death': 'total' }));
    assert.equal(deathBoxExtra(), 0);
    assert.equal(monitorStatus({ physical: 14, stun: 0 }, 4), 'dead');
    assert.equal(H.deathBody(6, 4), 6);
  });
  test('bleeding: a box every 10 minutes (200 Combat Turns of 3 s); the old way every (Body) turns', (t) => {
    assert.equal(H.bleedMinutes(), 10);
    assert.equal(bleedTurnsPerBox(4), 200);
    assert.equal(dyingTick(200, 4), true);
    assert.equal(dyingTick(4, 4), false);
    t.after(oldWay({ 'HEALTH_V923.bleed': 'bodyTurns' }));
    assert.equal(bleedTurnsPerBox(4), 4);
  });
});

describe('v0.92.3 health: first aid and Stun (Core pp. 112, 115)', () => {
  test('first aid lowers one level; Deadly only stabilised; time 10/20/30 ÷ successes', (t) => {
    assert.deepEqual(firstAidTarget(7), { tn: 8, maxBoxes: 4, level: 'S' });     // Serious 7 → Moderate 3
    assert.equal(firstAidBoxes(1, 7), 4);
    assert.equal(firstAidBoxes(0, 7), 0);
    assert.equal(firstAidBoxes(1, 2), 2);                                       // Light clears
    assert.equal(firstAidDeadlyOnly('physical', 10), true);
    assert.equal(firstAidBoxes(3, 10), 0);
    assert.equal(firstAidMinutes(4, 2), 10);                                    // Moderate 20 ÷ 2
    t.after(oldWay({ 'HEALTH_V923.firstAid': 'boxes', 'HEALTH_V923.firstAidTime': 'hidden' }));
    assert.equal(firstAidBoxes(1, 7), 1);
    assert.equal(firstAidMinutes(4, 2), null);
  });
  test('first aid on Physical only by the book', (t) => {
    assert.equal(H.firstAidOnStun(), false);
    t.after(oldWay({ 'HEALTH_V923.firstAidStun': 'both' }));
    assert.equal(H.firstAidOnStun(), true);
  });
  test('self-stabilisation, the trauma patch test, retry by a better healer, Magic loss on treatment', (t) => {
    const plating = { type: 'cyberware', name: 'Dermal plating', system: { installed: true, kind: 'other', armorBallistic: 2 } };
    assert.deepEqual(selfStabiliseTest(4), { dice: 4, tn: 10 });
    const tp = traumaPatchTest(5, [plating])!;
    assert.deepEqual({ dice: tp.dice, tn: tp.tn, mods: tp.modifiers.map((m) => m.value) }, { dice: 5, tn: 4, mods: [2] });
    assert.equal(firstAidRetryAllowed(2, 4), true);
    assert.equal(firstAidRetryAllowed(4, 4), false);
    assert.equal(magicLossOnTreatment({ magician: true, applyMagician: false }), true);
    assert.equal(H.magicLossUntreatedTests(true), 2);
    assert.equal(H.magicLossUntreatedTests(false), 1);
    t.after(oldWay({ 'HEALTH_V923.selfStabilise': 'none', 'HEALTH_V923.traumaPatch': 'stabilise', 'HEALTH_V923.firstAidRetry': 'once', 'HEALTH_V923.magicLossUntreated': 'none' }));
    assert.equal(selfStabiliseTest(4), null);
    assert.equal(traumaPatchTest(5, [plating]), null);
    assert.equal(firstAidRetryAllowed(2, 4), false);
    assert.equal(magicLossOnTreatment({ magician: true, applyMagician: false }), false);
    assert.equal(H.magicLossUntreatedTests(true), 1);
  });
  test('Stun recovery: the higher of Body and Willpower vs 2 + both tracks\' wound modifiers', (t) => {
    const s = stunRecoveryTest({ body: 4, willpower: 6, monitor: { physical: 3, stun: 1 } })!;
    assert.deepEqual({ a: s.attribute, tn: s.tn, mods: s.modifiers.map((m) => m.value) }, { a: 'willpower', tn: 2, mods: [3] });
    t.after(oldWay({ 'HEALTH_V923.stunRecovery': 'old' }));
    assert.equal(stunRecoveryTest({ body: 4, willpower: 6, monitor: { physical: 3, stun: 1 } }), null);
  });
  test('under the Revamp only its own switches count (a Revamp switch set to the book way stays the old way)', (t) => {
    t.after(urrMode({ 'URR_V80.hsFirstAid': 'boxes', 'URR_V80.hsBleedMinutes': 0, 'URR_V80.hsStunRecovery': 'book', 'URR_V80.hsDeathPastOverflow': false, 'URR_V80.magLossLe': false }));
    assert.equal(H.bookSource(), false);
    assert.equal(firstAidBoxes(1, 7), 1);
    assert.equal(bleedTurnsPerBox(4), 4);
    assert.equal(stunRecoveryTest({ body: 4, willpower: 6, monitor: { physical: 0, stun: 1 } }), null);
    assert.equal(deathBoxExtra(), 0);
    assert.equal(H.deathBody(6, 4), 6);
    assert.deepEqual(magicLossOutcome(6, 6), { lost: 0, threshold: 6 });
    assert.equal(H.magicLossUntreatedTests(true), 1);
  });
  test('the Revamp as shipped is unchanged', (t) => {
    t.after(urrMode());
    assert.equal(firstAidBoxes(1, 7), 4);
    assert.equal(bleedTurnsPerBox(4), 200);
    assert.equal(breathHoldTurns(4), 40);
    assert.equal(deathBoxExtra(), 1);
  });
});

describe('v0.92.3 health: magic (Core pp. 115, 155; Shadowtech bionetics)', () => {
  test('Magic loss at or below Magic; the old way only below', (t) => {
    assert.deepEqual(magicLossOutcome(6, 6), { lost: 1, threshold: 6 });
    t.after(oldWay({ 'HEALTH_V923.magicLoss': 'below' }));
    assert.deepEqual(magicLossOutcome(6, 6), { lost: 0, threshold: 6 });
  });
  test('Treat 8 − Essence, Heal 10 − Essence; the old way the same base', (t) => {
    assert.equal(healingTargetNumber(4, 4, true), 4);
    assert.equal(healingTargetNumber(4, 4, false), 6);
    assert.equal(healingTargetNumber(7, 4, true), 2);
    t.after(oldWay({ 'HEALTH_V923.treatTn': 'same' }));
    assert.equal(healingTargetNumber(4, 4, true), 6);
  });
  test('Body Index on magical healing only; the old way on first aid and rest', (t) => {
    assert.deepEqual([H.bodyIndexOn('spell'), H.bodyIndexOn('firstAid'), H.bodyIndexOn('natural')], [true, false, false]);
    t.after(oldWay({ 'HEALTH_V923.bodyIndexHealing': 'natural' }));
    assert.deepEqual([H.bodyIndexOn('spell'), H.bodyIndexOn('firstAid'), H.bodyIndexOn('natural')], [false, true, true]);
  });
  test('no spell heals Stun', (t) => {
    assert.equal(H.spellsHealStun(), false);
    t.after(oldWay({ 'HEALTH_V923.spellsHealStun': 'yes' }));
    assert.equal(H.spellsHealStun(), true);
  });
  test('drastic surgery: 1+ Essence, or more than 1.5 Body Index of bioware', (t) => {
    assert.equal(H.surgeryMagicLossDue(1, false), true);
    assert.equal(H.surgeryMagicLossDue(0.99, false), false);
    assert.equal(H.surgeryMagicLossDue(1.5, true), false);
    assert.equal(H.surgeryMagicLossDue(1.6, true), true);
    t.after(oldWay({ 'HEALTH_V923.surgeryMagicLoss': 'none' }));
    assert.equal(H.surgeryMagicLossDue(3, false), false);
  });
  test('surgery wound bands (when the surgery wound rule is on): the book\'s, or the old table', (t) => {
    t.after(oldWay({ 'BIOWARE.surgery.trauma.enabled': true }));
    assert.equal(surgicalTrauma(0.3)!.level, 'M');
    assert.equal(surgicalTrauma(0.5)!.level, 'S');
    assert.equal(surgicalTrauma(1)!.level, 'D');
    assert.equal(surgicalTrauma(0.2, true)!.level, 'L');
    assert.equal(surgicalTrauma(0.5, true)!.level, 'M');
    assert.equal(surgicalTrauma(1, true)!.level, 'S');
    assert.equal(surgicalTrauma(2, true)!.level, 'D');
    t.after(oldWay({ 'HEALTH_V923.surgeryBands': 'table' }));
    assert.equal(surgicalTrauma(0.3)!.level, 'L');
    assert.equal(surgicalTrauma(1)!.level, 'M');
  });
});

describe('v0.92.3 health: permanent damage (Core p. 114)', () => {
  test('TN 4, +2 after a trauma patch; 0 successes an attribute, 1 a limb or eye, 2 nothing', (t) => {
    assert.equal(H.permanentDamageTn(false), 4);
    assert.equal(H.permanentDamageTn(true), 6);
    assert.deepEqual(H.permanentDamageOutcome(0, 1), { kind: 'attribute', result: 'body' });
    assert.deepEqual(H.permanentDamageOutcome(0, 6), { kind: 'attribute', result: 'reaction' });
    assert.deepEqual(H.permanentDamageOutcome(1, 2), { kind: 'limb', result: 'leftArm' });
    assert.deepEqual(H.permanentDamageOutcome(1, 5, 2), { kind: 'limb', result: 'rightEar' });
    assert.deepEqual(H.permanentDamageOutcome(1, 6, 5), { kind: 'limb', result: 'leftEye' });
    assert.deepEqual(H.permanentDamageOutcome(2, 1), { kind: 'none', result: '' });
    t.after(oldWay({ 'HEALTH_V923.permanentDamage': 'none' }));
    assert.equal(H.permanentDamageTn(false), null);
  });
});

describe('v0.92.3 health: hazards (Fields of Fire p. 76, Cyberpirates, Grimoire, Core p. 103)', () => {
  test('falling: Deadly, ½ metres, ½ impact, Athletics successes off', (t) => {
    assert.deepEqual(H.fallingBook(9, 5, 1), { power: 3, level: 'D', armor: 2, cut: 1 });
    assert.deepEqual(H.fallingBook(3, 0, 5)!.power, 0);
    t.after(oldWay({ 'HEALTH_V923.falling': 'old' }));
    assert.equal(H.fallingBook(9, 5, 1), null);
  });
  test('held breath 30 s per Body; drowning 1 Stun box an action phase', (t) => {
    assert.equal(breathHoldTurns(4), 40);
    assert.equal(H.drowningBoxes(5, 2), 10);
    t.after(oldWay({ 'HEALTH_V923.breathHold': 'none', 'HEALTH_V923.drowning': 'test' }));
    assert.equal(breathHoldTurns(4), 0);
    assert.equal(H.drowningBoxes(5, 2), null);
  });
  test('burning clothes 6M, +2 Power a turn', (t) => {
    assert.deepEqual(H.burningDamage(1), { power: 6, level: 'M' });
    assert.deepEqual(H.burningDamage(3), { power: 10, level: 'M' });
    t.after(oldWay({ 'HEALTH_V923.burning': 'flat' }));
    assert.equal(H.burningDamage(1), null);
  });
  test('shock: Power − ½ impact − successes turns', (t) => {
    assert.equal(H.shockTurns(10, 5, 2), 6);
    assert.equal(H.shockTurns(4, 4, 5), 0);
    t.after(oldWay({ 'HEALTH_V923.shock': 'none' }));
    assert.equal(H.shockTurns(10, 5, 2), null);
  });
});

describe('v0.92.3 health: edges, flaws and gear (Companion, Core)', () => {
  test('Low Pain Tolerance counts the wound a level higher; the old way extra boxes', (t) => {
    const lo = qualityVitals([{ name: 'Low Pain Tolerance', kind: 'flaw', points: 3 }]);
    assert.deepEqual(painToleranceMonitor({ physical: 1, stun: 4 }, lo), { physical: 3, stun: 6 });
    assert.deepEqual(painToleranceMonitor({ physical: 7, stun: 0 }, lo), { physical: 7, stun: 0 });
    t.after(oldWay({ 'HEALTH_V923.lowPainTolerance': 'boxes' }));
    assert.deepEqual(painToleranceMonitor({ physical: 1, stun: 4 }, lo), { physical: 2, stun: 5 });
  });
  test('Sensitive System doubles the Body Index and has no rejection rule of its own', (t) => {
    const v = qualityVitals([{ name: 'Sensitive System', kind: 'flaw', points: 2 }]);
    assert.equal(sensitiveBodyIndex(0.5, v), 1);
    assert.equal(sensitiveRejectionTn(null, 0.5, v), null);
    t.after(oldWay({ 'HEALTH_V72.qualities.sensitiveSystem.bodyIndexMultiplier': 1, 'HEALTH_V72.qualities.sensitiveSystem.rejectionAlways': true }));
    const o = qualityVitals([{ name: 'Sensitive System', kind: 'flaw', points: 2 }]);
    assert.equal(sensitiveBodyIndex(0.5, o), 0.5);
    assert.equal(sensitiveRejectionTn(null, 0.5, o), RULES.BIOWARE.rejection.tn);
  });
  test('a respirator gives immunity to inhaled toxins; dwarf dice against disease only; Treat refused late', (t) => {
    const gear = [{ kind: 'respirator', rating: 3, worn: true, name: 'Resp' }];
    assert.equal(protectionFor(gear, 'inhalation').immune, true);
    assert.equal(H.dwarfDiceAgainst('toxin'), false);
    assert.equal(H.dwarfDiceAgainst('disease'), true);
    assert.equal(RULES.MAGIC_V56.healing.treatBlock, true);
    t.after(oldWay({ 'HEALTH_V923.respirator': 'dice', 'HEALTH_V923.dwarfResistance': 'both' }));
    assert.deepEqual(protectionFor(gear, 'inhalation'), { immune: false, dice: 3, label: 'Resp 3' });
    assert.equal(H.dwarfDiceAgainst('toxin'), true);
  });
});

describe('v0.92.3 health: addiction (Shadowtech pp. 87–89)', () => {
  const D = 86400;
  const base = (x: any = {}): Addiction & H.BookAddiction => ({ drug: 'Jazz', rating: 4, type: 'mental', recent: [], lastDose: 0, addicted: true, dosesAddicted: 0, ...x });
  const who = { body: 4, willpower: 5 };
  test('the dose interval: Willpower × 4 h (mental), Body × 4 h (physical); then forced withdrawal +3 (×2 concentration)', (t) => {
    assert.equal(H.doseIntervalHours('mental', who), 20);
    assert.equal(H.doseIntervalHours('physical', who), 16);
    assert.equal(withdrawalState(base(), 19 * 3600, who).withdrawal, false);
    assert.equal(withdrawalState(base(), 20 * 3600, who).withdrawal, true);
    assert.deepEqual(withdrawalModifiers([base()], 21 * 3600, { ...who, stunWoundTn: 0 }).map((m) => m.value), [3, 2]);
    assert.deepEqual(withdrawalModifiers([base()], 21 * 3600, { ...who, stunWoundTn: 3, concentration: true }).map((m) => m.value), [6]);
    t.after(oldWay({ 'HEALTH_V923.addiction': 'old' }));
    assert.equal(withdrawalState(base(), 21 * 3600, who).withdrawal, false);         // the old 24 hours
    assert.deepEqual(withdrawalModifiers([base()], 25 * 3600, who).map((m) => m.value), [2]);
  });
  test('kicking: any time, vs the rating +1/+3; recovery +2 while the rise falls 1 every 3 days', () => {
    assert.equal(withdrawalState(base(), 0, who).canKick, true);
    assert.equal(H.kickTn(base({ rise: 2 }), 0), 7);
    assert.equal(H.kickTn(base({ type: 'physical' }), 0), 7);
    const rec = base({ rise: 2, riseAtKick: 2, recovering: 0 });
    assert.deepEqual(H.bookWithdrawalTn(rec, D, who), { kind: 'recovery', tn: 2 });
    assert.equal(H.currentRise(rec, 3 * D), 1);
    assert.equal(H.recoveryDone(rec, 5 * D), false);
    assert.equal(H.recoveryDone(rec, 6 * D), true);
    assert.equal(withdrawalState(rec, D, who).canKick, false);
  });
  test('ratings rise every Strength-th dose and fall every (30 − Strength) clean days; a relapse adds 1', () => {
    assert.deepEqual(H.bookDose(base({ strength: 2, doses: 1, addicted: false }), 0, false), { rise: 1, doses: 2, relapse: false });
    assert.deepEqual(H.bookDose(base({ strength: 2, doses: 0, addicted: false }), 0, false), { rise: 0, doses: 1, relapse: false });
    assert.equal(H.currentRise(base({ rise: 3, strength: 10, addicted: false }), 40 * D), 1);   // 2 clean periods of 20 days
    assert.deepEqual(H.bookDose(base({ recovering: 0, riseAtKick: 1, rise: 1 }), D, false), { rise: 2, doses: 1, relapse: true });
    assert.equal(H.bookDose(base({ rise: 0 }), 21 * 3600, true).rise, 1);                       // easing forced withdrawal
    assert.equal(H.addictionRatingNow(base({ rise: 2 }), 0), 6);
  });
});
