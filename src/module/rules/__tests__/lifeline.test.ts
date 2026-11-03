import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import {
  docwagonTier, docwagonStatus, docwagonPay, docwagonCall, docwagonArrivalAt, docwagonShouldCall,
  toxinOnset, toxinOnsetDue, toxinOnsetLabel, drugEffectBundle, drugEffectLines, combineDrugEffects,
  damageImmunity, drugImmunity, healApplyRoute,
} from '../lifeline.ts';
import { critterImmunities } from '../bestiary.ts';

const R = RULES as any;
const SAVED = structuredClone(RULES.HEALTH_V61);
const SAVED_TOX = structuredClone(RULES.TOXINS);
afterEach(() => { R.HEALTH_V61 = structuredClone(SAVED); R.TOXINS = structuredClone(SAVED_TOX); });
const H = () => R.HEALTH_V61;
const YEAR = 31536000;

describe('v0.61.0 DocWagon tiers and status', () => {
  test('tiers by id; unknown or off = null', () => {
    assert.equal(docwagonTier('basic')?.yearlyFee, 5000);
    assert.equal(docwagonTier('gold')?.yearlyFee, 25000);
    assert.equal(docwagonTier('platinum')?.yearlyFee, 50000);
    assert.equal(docwagonTier('superPlatinum'), null);
    assert.equal(docwagonTier(undefined as any), null);
    H().docwagon.enabled = false;
    assert.equal(docwagonTier('gold'), null);
  });
  test('status: active, lapsed, never paid, unknown tier, off', () => {
    assert.deepEqual(docwagonStatus({ tier: 'gold', paidUntil: 86400 * 10, now: 0 }), { active: true, secondsLeft: 864000, label: 'DocWagon Gold: 10 days left' });
    assert.equal(docwagonStatus({ tier: 'gold', paidUntil: 100, now: 99 }).label, 'DocWagon Gold: 1 day left');
    assert.deepEqual(docwagonStatus({ tier: 'gold', paidUntil: 100, now: 100 }), { active: false, secondsLeft: 0, label: 'DocWagon Gold: lapsed' });
    assert.equal(docwagonStatus({ tier: 'basic', paidUntil: 0, now: 0 }).label, 'DocWagon Basic: not paid');
    assert.equal(docwagonStatus({ tier: 'basic', paidUntil: NaN, now: 5 }).active, false);
    assert.equal(docwagonStatus({ tier: 'nope', paidUntil: 1e9, now: 0 }).label, 'No DocWagon contract');
    assert.equal(docwagonStatus(null as any).active, false);
    H().docwagon.enabled = false;
    assert.deepEqual(docwagonStatus({ tier: 'gold', paidUntil: 1e9, now: 0 }), { active: false, secondsLeft: 0, label: 'DocWagon off' });
  });
  test('pay: extends from the later of paidUntil and now', () => {
    assert.deepEqual(docwagonPay({ tier: 'gold', years: 1, paidUntil: 0, now: 1000 }), { cost: 25000, paidUntil: 1000 + YEAR });
    assert.deepEqual(docwagonPay({ tier: 'basic', years: 2, paidUntil: 5000, now: 1000 }), { cost: 10000, paidUntil: 5000 + 2 * YEAR });
    assert.deepEqual(docwagonPay({ tier: 'platinum', years: 1.9, paidUntil: 0, now: 0 }), { cost: 50000, paidUntil: YEAR });
  });
  test('pay: bad input is free and unchanged', () => {
    assert.deepEqual(docwagonPay({ tier: 'gold', years: 0, paidUntil: 7, now: 0 }), { cost: 0, paidUntil: 7 });
    assert.deepEqual(docwagonPay({ tier: 'gold', years: -3, paidUntil: 7, now: 0 }), { cost: 0, paidUntil: 7 });
    assert.deepEqual(docwagonPay({ tier: 'gold', years: NaN, paidUntil: 7, now: 0 }), { cost: 0, paidUntil: 7 });
    assert.deepEqual(docwagonPay({ tier: 'x', years: 1, paidUntil: 7, now: 0 }), { cost: 0, paidUntil: 7 });
    assert.deepEqual(docwagonPay(null as any), { cost: 0, paidUntil: 0 });
  });
  test('house rule: fees and year length', () => {
    H().docwagon.tiers[1].yearlyFee = 30000;
    H().docwagon.yearSeconds = 100;
    assert.deepEqual(docwagonPay({ tier: 'gold', years: 2, paidUntil: 0, now: 10 }), { cost: 60000, paidUntil: 210 });
  });
});

describe('v0.61.0 DocWagon calls', () => {
  const base = { tier: 'gold', active: true, status: 'wounded' as const, hostile: false, resuscitationsUsed: 0 };
  test('no response when inactive or unknown', () => {
    const r = docwagonCall({ ...base, active: false });
    assert.equal(r.responds, false);
    assert.equal(r.total, 0);
    assert.match(r.notes[0]!, /not paid up/);
    assert.equal(docwagonCall({ ...base, tier: 'nope' }).responds, false);
    assert.equal(docwagonCall(null as any).responds, false);
  });
  test('wounded, quiet area: arrives, no fees', () => {
    assert.deepEqual(docwagonCall(base), { responds: true, responseSeconds: 600, htr: false, fees: [], total: 0, notes: [] });
    assert.equal(docwagonCall({ ...base, tier: 'platinum' }).responseSeconds, 300);
  });
  test('hostile: HTR by tier', () => {
    const gold = docwagonCall({ ...base, hostile: true });
    assert.equal(gold.htr, true);
    assert.deepEqual(gold.fees, [{ label: 'High Threat Response', amount: 5000 }]);
    assert.equal(gold.total, 5000);
    const plat = docwagonCall({ ...base, tier: 'platinum', hostile: true });
    assert.equal(plat.htr, true);
    assert.equal(plat.total, 0);
    const basic = docwagonCall({ ...base, tier: 'basic', hostile: true });
    assert.equal(basic.responds, true);
    assert.equal(basic.htr, false);
    assert.match(basic.notes.join(' '), /won't enter a firefight/);
  });
  test('dead: free resuscitations, then the fee', () => {
    assert.equal(docwagonCall({ ...base, status: 'dead' }).total, 0);
    assert.match(docwagonCall({ ...base, status: 'dead' }).notes[0]!, /Free resuscitation \(1 of 1/);
    assert.deepEqual(docwagonCall({ ...base, status: 'dead', resuscitationsUsed: 1 }).fees, [{ label: 'Resuscitation', amount: 8000 }]);
    assert.equal(docwagonCall({ ...base, tier: 'basic', status: 'dead' }).total, 8000);
    assert.equal(docwagonCall({ ...base, tier: 'platinum', status: 'dead', resuscitationsUsed: 3 }).total, 0);
    assert.equal(docwagonCall({ ...base, tier: 'platinum', status: 'dead', resuscitationsUsed: 4 }).total, 8000);
    assert.equal(docwagonCall({ ...base, status: 'dead', resuscitationsUsed: NaN }).total, 0);
    assert.equal(docwagonCall({ ...base, status: 'dying' }).total, 0);
  });
  test('employee deaths and stacked fees', () => {
    const r = docwagonCall({ ...base, status: 'dead', hostile: true, resuscitationsUsed: 1, employeesKilled: 2 });
    assert.deepEqual(r.fees.map((f) => f.amount), [5000, 8000, 40000]);
    assert.equal(r.total, 53000);
    assert.equal(r.fees[2]!.label, 'Employee death ×2');
    assert.equal(docwagonCall({ ...base, employeesKilled: -1 }).total, 0);
  });
  test('house rule: basic gets HTR, response time', () => {
    Object.assign(H().docwagon.tiers[0], { htrAvailable: true, htrFee: 2000, responseMinutes: 15 });
    const r = docwagonCall({ ...base, tier: 'basic', hostile: true });
    assert.equal(r.htr, true);
    assert.equal(r.total, 2000);
    assert.equal(r.responseSeconds, 900);
  });
  test('arrival time', () => {
    assert.equal(docwagonArrivalAt(1000, 600), 1600);
    assert.equal(docwagonArrivalAt(1000, -5), 1000);
    assert.equal(docwagonArrivalAt(NaN, 600), 600);
  });
  test('auto call on entering dying (or straight to dead)', () => {
    assert.equal(docwagonShouldCall('ok', 'dying'), true);
    assert.equal(docwagonShouldCall('unconscious', 'dying'), true);
    assert.equal(docwagonShouldCall('ok', 'dead'), true);
    assert.equal(docwagonShouldCall('dying', 'dead'), false);
    assert.equal(docwagonShouldCall('dying', 'dying'), false);
    assert.equal(docwagonShouldCall('ok', 'unconscious'), false);
    assert.equal(docwagonShouldCall('dead', 'ok'), false);
    assert.equal(docwagonShouldCall(undefined as any, 'dying'), true);
    assert.equal(docwagonShouldCall('ok', 'bogus'), false);
  });
  test('callOn house rules and off', () => {
    H().docwagon.callOn = 'unconscious';
    assert.equal(docwagonShouldCall('ok', 'unconscious'), true);
    assert.equal(docwagonShouldCall('unconscious', 'dying'), false);
    H().docwagon.callOn = 'deadlyWound';
    assert.equal(docwagonShouldCall('ok', 'dying'), true);
    H().docwagon.callOn = 'dead';
    assert.equal(docwagonShouldCall('ok', 'dying'), false);
    assert.equal(docwagonShouldCall('dying', 'dead'), true);
    H().docwagon.enabled = false;
    assert.equal(docwagonShouldCall('dying', 'dead'), false);
  });
});

describe('v0.61.0 toxin onset', () => {
  test('by Speed', () => {
    assert.deepEqual(toxinOnset({ speed: 'immediate', worldTime: 100 }), { immediate: true, seconds: 0, at: 100, rounds: 0, label: 'takes effect now' });
    assert.deepEqual(toxinOnset({ speed: 'turn', worldTime: 100, round: 2 }), { immediate: false, seconds: 3, at: 103, rounds: 1, label: 'takes effect in 1 Combat Turn' });
    assert.deepEqual(toxinOnset({ speed: 'minute', worldTime: 0 }), { immediate: false, seconds: 60, at: 60, rounds: 20, label: 'takes effect in 1 minute' });
    assert.equal(toxinOnset({ speed: 'tenMinutes', worldTime: 0 }).label, 'takes effect in 10 minutes');
    assert.equal(toxinOnset({ speed: 'hour', worldTime: 0 }).label, 'takes effect in 1 hour');
    assert.equal(toxinOnset({ speed: 'day', worldTime: 0 }).label, 'takes effect in 1 day');
  });
  test('bad input: unknown speed is immediate, bad time is 0', () => {
    assert.equal(toxinOnset({ speed: 'bogus', worldTime: 5 }).immediate, true);
    assert.equal(toxinOnset({ speed: 'minute', worldTime: NaN }).at, 60);
    assert.equal(toxinOnset(null as any).immediate, true);
  });
  test('house rules: onset off, new speed, turn length', () => {
    H().onset.enabled = false;
    assert.equal(toxinOnset({ speed: 'hour', worldTime: 9 }).immediate, true);
    assert.equal(toxinOnset({ speed: 'hour', worldTime: 9 }).at, 9);
    H().onset.enabled = true;
    R.TOXINS.speeds = [...R.TOXINS.speeds, { id: 'slow', label: 'Slow', seconds: 12 }];
    R.TOXINS.secondsPerTurn = 4;
    const r = toxinOnset({ speed: 'slow', worldTime: 0 });
    assert.equal(r.rounds, 3);
    assert.equal(r.label, 'takes effect in 3 Combat Turns');
  });
  test('due', () => {
    const o = toxinOnset({ speed: 'minute', worldTime: 0 });
    assert.equal(toxinOnsetDue(o, { worldTime: 59 }), false);
    assert.equal(toxinOnsetDue(o, { worldTime: 60 }), true);
    assert.equal(toxinOnsetDue(o, { worldTime: 61 }), true);
    assert.equal(toxinOnsetDue({ at: 1e9, immediate: true }, { worldTime: 0 }), true);
    assert.equal(toxinOnsetDue(null as any, { worldTime: 0 }), true);
    assert.equal(toxinOnsetDue({ at: 10 }, null as any), false);
  });
  test('labels count down', () => {
    assert.equal(toxinOnsetLabel(60, 0, 60), 'takes effect in 1 minute');
    assert.equal(toxinOnsetLabel(60, 1, 60), 'takes effect in 20 Combat Turns');
    assert.equal(toxinOnsetLabel(60, 54, 60), 'takes effect in 2 Combat Turns');
    assert.equal(toxinOnsetLabel(60, 59, 60), 'takes effect in 1 Combat Turn');
    assert.equal(toxinOnsetLabel(600, 0, 600), 'takes effect in 10 minutes');
    assert.equal(toxinOnsetLabel(600, 540, 600), 'takes effect in 1 minute');
    assert.equal(toxinOnsetLabel(7200, 0, 7200), 'takes effect in 2 hours');
    assert.equal(toxinOnsetLabel(86400 * 3, 0, 86400 * 3), 'takes effect in 3 days');
    assert.equal(toxinOnsetLabel(60, 60, 60), 'takes effect now');
    assert.equal(toxinOnsetLabel(60, 999, 60), 'takes effect now');
    assert.equal(toxinOnsetLabel(0, 0, 100), 'takes effect now');
    assert.equal(toxinOnsetLabel(NaN, NaN, NaN), 'takes effect now');
  });
});

describe('v0.61.0 drug effects', () => {
  test('bundle: allowed keys kept and sanitised, others dropped', () => {
    const b = drugEffectBundle({ testsTn: -1, ballistic: '2', impact: 'x', movementFactor: 2, ignoreWounds: true, stunIgnoreBoxes: 2.7, reaction: 3, attributes: { body: 2 }, bogus: 9 });
    assert.equal(b.testsTn, -1);
    assert.equal(b.ballistic, 2);
    assert.equal(b.impact, 0);
    assert.equal(b.movementFactor, 2);
    assert.equal(b.ignoreWounds, true);
    assert.equal(b.stunIgnoreBoxes, 2);
    assert.equal(b.reaction, 0);
    assert.deepEqual(b.attributes, {});
    assert.equal('bogus' in b, false);
  });
  test('bundle: bad input', () => {
    const empty = drugEffectBundle(null);
    assert.equal(empty.movementFactor, 1);
    assert.equal(empty.testsTn, 0);
    assert.equal(empty.ignoreWounds, false);
    assert.equal(drugEffectBundle('junk').stunIgnoreBoxes, 0);
    assert.equal(drugEffectBundle({ movementFactor: 0 }).movementFactor, 1);
    assert.equal(drugEffectBundle({ movementFactor: -2 }).movementFactor, 1);
    assert.equal(drugEffectBundle({ stunIgnoreBoxes: -3 }).stunIgnoreBoxes, 0);
    assert.equal(drugEffectBundle({ ignoreWounds: 1 }).ignoreWounds, false);
    assert.equal(drugEffectBundle({ ignoreWounds: 'true' }).ignoreWounds, true);
    assert.equal(drugEffectBundle({ perceivedTn: Infinity }).perceivedTn, 0);
  });
  test('house rule: more keys allowed, extras removed', () => {
    H().drugs.effectKeys = [...H().drugs.effectKeys, 'reaction', 'attributes'];
    H().drugs.extras = [];
    const b = drugEffectBundle({ reaction: 2, attributes: { body: 1, quickness: 'x', luck: 3 }, ignoreWounds: true });
    assert.equal(b.reaction, 2);
    assert.deepEqual(b.attributes, { body: 1 });
    assert.equal(b.ignoreWounds, false);
    assert.deepEqual(drugEffectLines({ reaction: 2, attributes: { body: 1 } }), ['Body +1', 'Reaction +2']);
  });
  test('lines', () => {
    assert.deepEqual(drugEffectLines({ testsTn: -1, perceivedTn: 2, attackedTn: 1, ballistic: 1, impact: -1, movementFactor: 0.5, ignoreWounds: true, stunIgnoreBoxes: 1 }), [
      'Ballistic armor +1', 'Impact armor −1', 'TN −1 on all tests', 'TN +2 to perceive them', 'TN +1 on attacks against them',
      'Movement ×0.5', 'Ignores wound modifiers', 'Ignores 1 Stun box for modifiers',
    ]);
    assert.deepEqual(drugEffectLines({ stunIgnoreBoxes: 3 }), ['Ignores 3 Stun boxes for modifiers']);
    assert.deepEqual(drugEffectLines(undefined), []);
  });
  test('combine', () => {
    const c = combineDrugEffects([{ testsTn: -1, movementFactor: 2 }, { testsTn: -1, ballistic: 1, movementFactor: 1.5, stunIgnoreBoxes: 2 }, { ignoreWounds: true, stunIgnoreBoxes: 1 }, null, 'x']);
    assert.equal(c.bundle.testsTn, -2);
    assert.equal(c.bundle.ballistic, 1);
    assert.equal(c.bundle.movementFactor, 3);
    assert.equal(c.ignoreWounds, true);
    assert.equal(c.stunIgnoreBoxes, 2);
    assert.equal('ignoreWounds' in c.bundle, false);
    const z = combineDrugEffects(undefined as any);
    assert.equal(z.bundle.movementFactor, 1);
    assert.equal(z.ignoreWounds, false);
    assert.equal(combineDrugEffects([{ movementFactor: 0.1 }, { movementFactor: 0.2 }]).bundle.movementFactor, 0.02);
  });
});

describe('v0.61.0 immunity', () => {
  test('fire damage stopped by immunity to fire', () => {
    const imm = critterImmunities([{ special: 'immunity', substance: 'fire' }]);
    assert.deepEqual(damageImmunity(imm, { fire: true }), { immune: true, reason: 'Immune to fire' });
    assert.equal(damageImmunity(imm, { element: 'Fire' }).immune, true);
    assert.equal(damageImmunity(imm, { element: 'flame' }).immune, true);
    assert.equal(damageImmunity(imm, { element: 'water' }).immune, false);
    assert.equal(damageImmunity(imm, {}).immune, false);
    assert.equal(damageImmunity({ fire: false }, { fire: true }).immune, false);
  });
  test('bad input', () => {
    assert.deepEqual(damageImmunity(null as any, { fire: true }), { immune: false, reason: '' });
    assert.equal(damageImmunity({ fire: true }, null as any).immune, false);
    assert.equal(drugImmunity(null as any), false);
  });
  test('drugs: drugs flag, or poisons when configured', () => {
    assert.equal(drugImmunity({ drugs: true }), true);
    assert.equal(drugImmunity(critterImmunities([{ special: 'immunity', substance: 'poisons' }])), true);
    assert.equal(drugImmunity({ fire: true }), false);
    H().immunity.drugsCountAsPoisons = false;
    assert.equal(drugImmunity({ poisons: true }), false);
    assert.equal(drugImmunity({ drugs: true }), true);
  });
  test('house rule: more fire elements', () => {
    H().immunity.fireElements = ['fire', 'plasma'];
    assert.equal(damageImmunity({ fire: true }, { element: 'plasma' }).immune, true);
    assert.equal(damageImmunity({ fire: true }, { element: 'flame' }).immune, false);
  });
});

describe('v0.61.0 heal routing', () => {
  test('owner or GM apply; others post a GM card', () => {
    assert.equal(healApplyRoute({ isOwner: true, isGm: false, gmOnline: false }), 'apply');
    assert.equal(healApplyRoute({ isOwner: false, isGm: true, gmOnline: true }), 'apply');
    assert.equal(healApplyRoute({ isOwner: false, isGm: false, gmOnline: true }), 'gmCard');
    assert.equal(healApplyRoute({ isOwner: false, isGm: false, gmOnline: false }), 'gmCard');
    assert.equal(healApplyRoute(null as any), 'none');
    assert.equal(healApplyRoute({ isOwner: 'yes' as any, isGm: false, gmOnline: true }), 'gmCard');
  });
});
