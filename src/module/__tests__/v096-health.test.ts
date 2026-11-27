/**
 * v0.96.0 health (RULES.HEALTH_V96): the pure rules of rules/health96.ts and the hooks in rules/health923.ts and
 * rules/lifeline.ts, the book value and (oldWay) the v0.95.1 value of each switch.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as H from '../rules/health96.ts';
import { currentRise, doseIntervalHours, bookWithdrawalTn } from '../rules/health923.ts';
import { docwagonCall } from '../rules/lifeline.ts';
import { HOUSE_HEALTH_V96, HEALTH_V96 } from '../rules/config96/health.ts';

const DAY = 86400;

describe('v0.96.0 health: the switches', () => {
  test('every select ships its first choice; every row names a real switch', () => {
    for (const r of HOUSE_HEALTH_V96) {
      const v = r.path.split('.').slice(1).reduce((o: any, k) => o?.[k], HEALTH_V96 as any);
      assert.notEqual(v, undefined, r.path);
      if (r.type === 'select') assert.equal(v, r.choices![0], r.path);
    }
    assert.equal((RULES as any).HEALTH_V96, HEALTH_V96);
  });
});

describe('v0.96.0 health: interrupted Stun rest (Core p. 112)', () => {
  test('a re-test never counts more than the first roll', () => {
    assert.equal(H.restSuccesses(5, 2), 2);
    assert.equal(H.restSuccesses(1, 2), 1);
    assert.equal(H.restSuccesses(4, null), 4);
    assert.equal(H.stunRestKept({ successes: 3 }), 3);
    assert.equal(H.stunRestKept(null), null);
    assert.deepEqual(H.stunRestNext({ first: true, successes: 3, after: 4 }), { set: { successes: 3 }, clear: false });
    assert.deepEqual(H.stunRestNext({ first: false, successes: 3, after: 4 }), { set: null, clear: false });
    assert.deepEqual(H.stunRestNext({ first: true, successes: 3, after: 0 }), { set: null, clear: true });
  });
  test('off: the switch reads off', (t) => {
    t.after(oldWay({ 'HEALTH_V96.stunRestInterrupted': 'off' }));
    assert.equal(H.stunRestOn(), false);
  });
});

describe('v0.96.0 health: the minimum lifestyle and medical costs (Core p. 113)', () => {
  test('the Healing Table minimum; a hospital counts as hospitalized', () => {
    assert.equal(H.lifestyleShort(1, 'home', 'squatter'), 'low');
    assert.equal(H.lifestyleShort(1, 'home', 'low'), null);
    assert.equal(H.lifestyleShort(7, 'home', 'middle'), 'high');
    assert.equal(H.lifestyleShort(10, 'home', 'luxury'), 'hospital');
    assert.equal(H.lifestyleShort(10, 'hospital', 'street'), null);
    assert.equal(H.lifestyleShort(0, 'home', 'street'), null);
  });
  test('off: no warning', (t) => {
    t.after(oldWay({ 'HEALTH_V96.healingLifestyle': 'off' }));
    assert.equal(H.lifestyleShort(10, 'home', 'street'), null);
  });
  test('the table: paramedic, doctor per day, hospital, intensive care; DocWagon extended care', () => {
    assert.equal(H.paramedicFee(1), 50);
    assert.equal(H.paramedicFee(10), 400);
    assert.equal(H.restCareCost({ care: 'medkit', hours: 48, boxes: 4 }), 200);
    assert.equal(H.restCareCost({ care: 'hospital', hours: 10, boxes: 4 }), 500);
    assert.equal(H.restCareCost({ care: 'intensive', hours: 24, boxes: 10 }), 1000);
    assert.equal(H.restCareCost({ care: 'none', hours: 24, boxes: 10 }), 0);
    assert.equal(H.restCareCost({ care: 'hospital', hours: 24, boxes: 4, tier: 'platinum' }), 250);
    assert.equal(H.restCareCost({ care: 'hospital', hours: 24, boxes: 4, tier: 'gold' }), 450);
  });
  test('a doctor\'s fee only where a doctor is involved: the Doctoring Table\'s doctor rows', (t) => {
    assert.equal(H.restCareCost({ care: 'home', hours: 24, boxes: 4 }), 100);
    assert.equal(H.restCareCost({ care: 'poor', hours: 24, boxes: 7 }), 200);
    assert.equal(H.restCareCost({ care: 'none', hours: 24, boxes: 7 }), 0);
    t.after(oldWay({ 'DOCS_V79.doctoring': 'care' }));
    assert.equal(H.restCareCost({ care: 'medkit', hours: 24, boxes: 4 }), 0, 'the care rows name no doctor');
    assert.equal(H.restCareCost({ care: 'hospital', hours: 24, boxes: 4 }), 500);
  });
  test('off: null (RULES.HEALTH.careCosts), no paramedic fee, no discount', (t) => {
    t.after(oldWay({ 'HEALTH_V96.medicalCosts': 'off', 'HEALTH_V96.docwagonExtendedCare': 'off' }));
    assert.equal(H.restCareCost({ care: 'hospital', hours: 24, boxes: 4 }), null);
    assert.equal(H.paramedicFee(10), 0);
    assert.equal(H.discounted(500, 'platinum'), 500);
  });
});

describe('v0.96.0 health: healing spells (Core p. 155)', () => {
  test('boxes first, the rest to time; the table\'s turns ÷ the time successes', () => {
    assert.deepEqual(H.healSplit(5, 3), { boxes: 3, time: 2 });
    assert.deepEqual(H.healSplit(2, 3), { boxes: 2, time: 0 });
    assert.deepEqual(H.healSplit(5, 3, 4), { boxes: 1, time: 4 });
    assert.equal(H.healSpellTurns(3, 2), 5, 'Moderate 10 ÷ 2');
    assert.equal(H.healSpellTurns(10, 0), 20, 'Deadly, nothing to time');
    assert.equal(H.healSpellUntil(100, 3, 5, 3), 100 + 5 * 3);
    assert.equal(H.healSpellUntil(100, 3, 0, 3), null);
  });
  test('off: null (MAGIC_V56.permanent)', (t) => {
    t.after(oldWay({ 'HEALTH_V96.healingSpellTime': 'off' }));
    assert.equal(H.healSpellUntil(100, 3, 5, 3), null);
  });
});

describe('v0.96.0 health: patches (Core pp. 186, 250; Awakenings p. 99)', () => {
  const dermal = { type: 'cyberware', name: 'Dermal plating', system: { installed: true, armorBallistic: 2 } };
  const filter = { type: 'cyberware', name: 'Blood filter', system: { installed: true, kind: 'filtration', filterKind: 'blood', rating: 3 } };
  test('dermal armor lowers the rating, blood filtration stops it, the trauma patch is left alone', () => {
    assert.deepEqual(H.patchAfterImplants('stim', 5, [dermal]), { rating: 3, blocked: false, armor: 2 });
    assert.equal(H.patchAfterImplants('antidote', 4, [filter])?.blocked, true);
    assert.equal(H.patchAfterImplants('trauma', 4, [filter]), null);
    assert.deepEqual(H.patchAfterImplants('tranq', 4, []), { rating: 4, blocked: false, armor: 0 });
  });
  test('the antidote asks the GM on a dying, unstabilised patient', () => {
    assert.equal(H.antidoteAttentionDue('dying', false), true);
    assert.equal(H.antidoteAttentionDue('dying', true), false);
    assert.equal(H.antidoteAttentionDue('ok', false), false);
  });
  test('the stim patch: Core against the rating; Awakenings against the 24-hour total; rating 0 rolls nothing', (t) => {
    assert.equal(H.stimMagicTest(3, [{ t: 0, rating: 2 }], 100)?.tn, 3);
    assert.equal(H.stimMagicTest(0, [], 100), null);
    t.after(oldWay({ 'HEALTH_V96.stimMagic': 'awakenings' }));
    const r = H.stimMagicTest(3, [{ t: 0, rating: 2 }, { t: -DAY - 1, rating: 6 }], 100)!;
    assert.equal(r.tn, 5);
    assert.equal(r.history.length, 2);
  });
  test('off: nothing changes', (t) => {
    t.after(oldWay({ 'HEALTH_V96.patchImplants': 'off', 'HEALTH_V96.stimMagic': 'off', 'HEALTH_V96.antidoteAttention': 'off' }));
    assert.equal(H.patchAfterImplants('stim', 5, [dermal]), null);
    assert.equal(H.stimMagicTest(3, [], 0), null);
    assert.equal(H.antidoteAttentionDue('dying', false), false);
  });
});

describe('v0.96.0 health: bioware (Shadowtech pp. 26, 29, 30)', () => {
  test('nephritic screen: −1 Power on pathogens and injected toxins only', () => {
    assert.equal(H.nephriticCut({ kind: 'disease', vector: 'contact', screen: true }), 1);
    assert.equal(H.nephriticCut({ kind: 'toxin', vector: 'injection', screen: true }), 1);
    assert.equal(H.nephriticCut({ kind: 'toxin', vector: 'inhalation', screen: true }), 0);
    assert.equal(H.nephriticCut({ kind: 'toxin', vector: 'injection', screen: false }), 0);
  });
  test('trauma damper moves one new Physical box to Stun; not with a pain editor, not onto a full Stun track', () => {
    assert.deepEqual(H.damperShift({ physical: 0, stun: 0 }, { physical: 3, stun: 0 }, { damper: true, painEditor: false }), { physical: 2, stun: 1 });
    assert.equal(H.damperShift({ physical: 0, stun: 0 }, { physical: 3, stun: 0 }, { damper: true, painEditor: true }), null);
    assert.equal(H.damperShift({ physical: 0, stun: 10 }, { physical: 3, stun: 10 }, { damper: true, painEditor: false }), null);
    assert.equal(H.damperShift({ physical: 9, stun: 0 }, { physical: 12, stun: 0 }, { damper: true, painEditor: false }), null, 'not from the Overflow');
    assert.equal(H.damperShift({ physical: 0, stun: 0 }, { physical: 3, stun: 0 }, { damper: true, painEditor: false, compensatorBoxes: 2 }), null, 'the compensator still copes with Stun');
    assert.deepEqual(H.damperShift({ physical: 0, stun: 3 }, { physical: 3, stun: 3 }, { damper: true, painEditor: false, compensatorBoxes: 2 }), { physical: 2, stun: 4 }, 'both tracks past it');
  });
  test('pain editor: not knocked out by Stun', () => {
    assert.equal(H.painEditorStatus('unconscious', true), 'ok');
    assert.equal(H.painEditorStatus('dying', true), 'dying');
    assert.equal(H.painEditorStatus('unconscious', false), 'unconscious');
  });
  test('hasBio reads installed, working bioware (as bioEffect and bioVitals do)', (t) => {
    t.after(oldWay({ 'HEALTH_V72.bioware.enabled': true }));
    assert.equal(H.hasBio([{ type: 'cyberware', system: { installed: true, bioKind: 'traumaDamper', rating: 1 } }], 'traumaDamper'), true);
    assert.equal(H.hasBio([{ type: 'cyberware', system: { installed: false, bioKind: 'traumaDamper', rating: 1 } }], 'traumaDamper'), false);
    assert.equal(H.hasBio([{ type: 'cyberware', system: { installed: true, bioKind: 'traumaDamper', rating: 0 } }], 'traumaDamper'), false, 'rating 0 does nothing');
    assert.equal(H.hasBio([{ id: 'x', type: 'cyberware', system: { installed: true, bioKind: 'traumaDamper', rating: 1 } }], 'traumaDamper', ['x']), false, 'still healing in');
    const screen = [{ type: 'cyberware', system: { installed: true, bioKind: 'nephriticScreen', rating: 1 } }];
    assert.equal(H.hasBio(screen, 'nephriticScreen'), true);
    (RULES.HEALTH_V72.bioware as any).enabled = false;
    assert.equal(H.hasBio(screen, 'nephriticScreen'), false, 'a Shadowtech kind only while HEALTH_V72.bioware is on');
  });
  test('off: the v0.95.1 results', (t) => {
    t.after(oldWay({ 'HEALTH_V96.nephriticPower': 'off', 'HEALTH_V96.traumaDamper': 'off', 'HEALTH_V96.painEditor': 'off' }));
    assert.equal(H.nephriticCut({ kind: 'disease', vector: 'contact', screen: true }), 0);
    assert.equal(H.damperShift({ physical: 0, stun: 0 }, { physical: 3, stun: 0 }, { damper: true, painEditor: false }), null);
    assert.equal(H.painEditorStatus('unconscious', true), 'unconscious');
  });
});

describe('v0.96.0 health: addiction (Shadowtech pp. 87–88)', () => {
  const who = { body: 5, willpower: 3 };
  test('both kinds: two tests, the shorter clock (through health923)', () => {
    assert.deepEqual(H.doseTestAttributes('both'), ['body', 'willpower']);
    assert.deepEqual(H.doseTestAttributes('physical'), ['body']);
    assert.equal(doseIntervalHours('both', who), 12);
    assert.equal(doseIntervalHours('physical', who), 20);
  });
  test('forced withdrawal falls 1 a day (through currentRise), never below the base', () => {
    const a = { rating: 4, type: 'mental', lastDose: 0, addicted: true, rise: 3, withdrawalAt96: 10 * 3600 };
    assert.equal(currentRise(a as any, 10 * 3600 + 2 * DAY + 5), 1);
    assert.equal(currentRise(a as any, 10 * 3600 + 9 * DAY), 0);
    assert.equal(currentRise({ ...a, lastDose: 20 * 3600 } as any, 10 * 3600 + 2 * DAY), 3, 'a dose since: no fall');
  });
  test('the rest after a recovery: +1 (+2 concentration) through bookWithdrawalTn', () => {
    const a = { rating: 4, type: 'mental', lastDose: 0, addicted: false, restUntil96: 4 * DAY };
    assert.deepEqual(bookWithdrawalTn(a as any, DAY, who), { kind: 'recovery', tn: 1 });
    assert.deepEqual(bookWithdrawalTn(a as any, DAY, who, true), { kind: 'recovery', tn: 2 });
    assert.equal(bookWithdrawalTn(a as any, 5 * DAY, who), null);
    assert.equal(H.restUntil(0, 4), 4 * DAY);
    assert.equal(H.restOver(a, 5 * DAY), true);
  });
  test('the weekly attrition: starts the clock, then due each week; not while recovering', () => {
    assert.deepEqual(H.attritionStep({ addicted: true }, 100), { due: false, next: 100 + 7 * DAY });
    assert.deepEqual(H.attritionStep({ addicted: true, attritionAt96: 50 }, 100), { due: true, next: 50 + 7 * DAY });
    assert.deepEqual(H.attritionStep({ addicted: true, recovering: 5, attritionAt96: 50 }, 100), { due: false, next: null });
  });
  test('off: the v0.95.1 numbers', (t) => {
    t.after(oldWay({ 'HEALTH_V96.addictionBoth': 'off', 'HEALTH_V96.addictionFall': 'off', 'HEALTH_V96.addictionRest': 'off', 'HEALTH_V96.addictionAttrition': 'off', 'HEALTH_V96.addictionTiming': 'dose' }));
    assert.equal(doseIntervalHours('both', who), 12, 'the v0.92.3 Willpower clock for a non-physical type');
    assert.deepEqual(H.doseTestAttributes('both'), ['willpower']);
    const a = { rating: 4, type: 'mental', lastDose: 0, addicted: true, rise: 3, withdrawalAt96: 10 * 3600 };
    assert.equal(currentRise(a as any, 10 * 3600 + 2 * DAY + 5), 3);
    assert.equal(bookWithdrawalTn({ rating: 4, type: 'mental', lastDose: 0, addicted: false, restUntil96: 4 * DAY } as any, DAY, who), null);
    assert.equal(H.attritionStep({ addicted: true, attritionAt96: 50 }, 100).due, false);
    assert.equal(H.testsAtWearOff(), false);
  });
});

describe('v0.96.0 health: DocWagon (Neo-Anarchist\'s Guide p. 95; Core p. 250)', () => {
  test('the unit and the minutes, at least 4', () => {
    assert.equal(H.docwagonAir(5), true);
    assert.equal(H.docwagonAir(4), false);
    assert.equal(H.docwagonAir(4, true), true);
    assert.equal(H.docwagonMinutes(3, true), 4);
    assert.equal(H.docwagonMinutes(12, true), 10);
    assert.equal(H.docwagonMinutes(12, false, 2), 14);
    assert.equal(H.docwagonMinutes(12, false, 0, true), 11, 'an HTR team dispatched at once −1');
    assert.equal(H.htrCharge('gold', true), 0, 'a tier with HTR included pays nothing');
  });
  test('HTR: Gold half, Platinum free (through docwagonCall)', () => {
    const gold = docwagonCall({ tier: 'gold', active: true, status: 'dying', hostile: true, resuscitationsUsed: 0 });
    assert.equal(gold.fees.find((f) => f.amount > 0)?.amount, 2500);
    const plat = docwagonCall({ tier: 'platinum', active: true, status: 'dying', hostile: true, resuscitationsUsed: 0 });
    assert.equal(plat.total, 0);
  });
  test('off: the tier\'s own fee and fixed minutes', (t) => {
    t.after(oldWay({ 'HEALTH_V96.docwagonHtr': 'off', 'HEALTH_V96.docwagonResponse': 'off' }));
    const gold = docwagonCall({ tier: 'gold', active: true, status: 'dying', hostile: true, resuscitationsUsed: 0 });
    assert.equal(gold.total, 5000);
    assert.equal(H.htrCharge('gold'), null);
    assert.equal(H.docwagonResponseOn(), false);
  });
});

describe('v0.96.0 health: neuro-stun and the medkit (Core pp. 186, 250)', () => {
  test('neuro-stun disorients an hour at +2; other toxins nothing', () => {
    assert.deepEqual(H.neuroStunEffect('Neuro-Stun VIII'), { seconds: 3600, tn: 2 });
    assert.equal(H.neuroStunEffect('Gamma-scopolamine'), null);
  });
  test('the medkit lends Biotech 3 when it beats the healer\'s dice, or the healer would default', () => {
    assert.equal(H.medkitAdviceDice(1, false, true), 3);
    assert.equal(H.medkitAdviceDice(4, false, true), null);
    assert.equal(H.medkitAdviceDice(5, true, true), 3, 'defaulting to Intelligence: the kit advises');
    assert.equal(H.medkitAdviceDice(0, true, false), null);
  });
  test('off: nothing', (t) => {
    t.after(oldWay({ 'HEALTH_V96.neuroStun': 'off', 'HEALTH_V96.medkitAdvice': 'off' }));
    assert.equal(H.neuroStunEffect('Neuro-Stun VIII'), null);
    assert.equal(H.medkitAdviceDice(0, true, true), null);
  });
});
