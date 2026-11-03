import { test, describe, afterEach } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { RULES } from '../config.ts';
import {
  skillModMatches, skillGearBonus, earsDerived, hearingModifiers, canHear, deafeningBlocked,
  superiorPositionModifiers, armingCheck, stunCharge, selfHitCheck, grenadeSmoke,
} from '../kit.ts';

const R = RULES as any;
const ORIGINAL = structuredClone(RULES.COMBAT_V61);
afterEach(() => { R.COMBAT_V61 = structuredClone(ORIGINAL); });
const V = () => R.COMBAT_V61;

describe('v0.61.0 skill gear', () => {
  const climbing = { name: 'Climbing gear', mods: [{ skill: 'Athletics', tn: -2 }] };
  const recorder = { name: 'Reflex recorder', mods: [{ skill: 'athletics', dice: 1 }] };
  const balance = { name: 'Balance augmenter', mods: [{ skill: 'Climbing', dice: 2, tn: -1 }] };
  test('matching: name, concentration, specialization; case-insensitive; * and empty never', () => {
    const sk = { name: 'Athletics', concentration: 'Climbing', specialization: 'Free climbing' };
    assert.ok(skillModMatches('ATHLETICS', sk));
    assert.ok(skillModMatches(' climbing ', sk));
    assert.ok(skillModMatches('free climbing', sk));
    assert.ok(!skillModMatches('*', sk));
    assert.ok(!skillModMatches('', sk));
    assert.ok(!skillModMatches('Stealth', sk));
    assert.ok(!skillModMatches('', { name: '' }));
    assert.ok(!skillModMatches(undefined as any, sk));
  });
  test('best (default): most dice from one item, lowest TN from one item', () => {
    const r = skillGearBonus([climbing, recorder, balance], { name: 'Athletics', concentration: 'Climbing' });
    assert.equal(r.dice, 2);
    assert.deepEqual(r.modifiers, [{ label: 'Climbing gear', value: -2 }]);
    assert.deepEqual(r.names.sort(), ['Balance augmenter', 'Climbing gear']);
  });
  test('only matching items count', () => {
    const r = skillGearBonus([climbing, recorder, balance], { name: 'Athletics' });
    assert.deepEqual(r, { dice: 1, modifiers: [{ label: 'Climbing gear', value: -2 }], names: ['Reflex recorder', 'Climbing gear'] });
    assert.deepEqual(skillGearBonus([climbing], { name: 'Stealth' }), { dice: 0, modifiers: [], names: [] });
  });
  test('sum house rule adds everything', () => {
    V().skillGear.stack = 'sum';
    const r = skillGearBonus([climbing, recorder, balance], { name: 'Athletics', concentration: 'Climbing' });
    assert.equal(r.dice, 3);
    assert.deepEqual(r.modifiers, [{ label: 'Climbing gear', value: -2 }, { label: 'Balance augmenter', value: -1 }]);
    assert.deepEqual(r.names, ['Climbing gear', 'Reflex recorder', 'Balance augmenter']);
  });
  test('bad input never throws', () => {
    assert.deepEqual(skillGearBonus(null as any, { name: 'Athletics' }), { dice: 0, modifiers: [], names: [] });
    const r = skillGearBonus([null as any, { name: 'X' } as any, { name: '', mods: [null as any, { skill: 'Athletics', dice: 'abc' as any, tn: NaN }] },
      { name: '', mods: [{ skill: 'Athletics', dice: '2' as any }] }], { name: 'Athletics' });
    assert.deepEqual(r, { dice: 2, modifiers: [], names: ['Gear'] });
    assert.deepEqual(skillGearBonus([{ name: 'Wild', mods: [{ skill: '*', dice: 3 }] }], { name: 'Athletics' }).dice, 0);
  });
});

describe('v0.61.0 hearing', () => {
  test('earsDerived: best amp capped, flags OR-ed', () => {
    const e = earsDerived([{ hearingAmp: 2, dampener: true }, { hearingAmp: 5, highFrequency: true }, { recorder: true }], true);
    assert.deepEqual(e, { amp: 3, dampener: true, highFrequency: true, lowFrequency: false, recorder: true, adept: true });
    assert.deepEqual(earsDerived([]), { amp: 0, dampener: false, highFrequency: false, lowFrequency: false, recorder: false, adept: false });
    assert.equal(earsDerived(null as any).amp, 0);
    assert.equal(earsDerived([{ hearingAmp: -2 }, null as any, { hearingAmp: 'x' as any }]).amp, 0);
    V().hearing.ampMax = 2;
    assert.equal(earsDerived([{ hearingAmp: 3 }]).amp, 2);
  });
  test('modifiers: amp, adept, noise', () => {
    const ears = earsDerived([{ hearingAmp: 2 }], true);
    assert.deepEqual(hearingModifiers({ ears, deaf: false, noise: 'noisy' }), [
      { label: 'Hearing amplification 2', value: -2 },
      { label: 'Improved hearing (adept)', value: -1 },
      { label: 'Noise: noisy', value: 2 },
    ]);
    assert.deepEqual(hearingModifiers({ ears: null, deaf: false }), []);
    assert.deepEqual(hearingModifiers({ ears: null, deaf: false, noise: 'quiet' }), []);
    assert.deepEqual(hearingModifiers({ ears: null, deaf: false, noise: 'bogus' }), []);
    assert.deepEqual(hearingModifiers({ ears: null, deaf: false, noise: 'toString' }), []);
  });
  test('deaf: only the deaf TN, amp does not help', () => {
    const ears = earsDerived([{ hearingAmp: 3 }], true);
    assert.deepEqual(hearingModifiers({ ears, deaf: true, noise: 'loud' }), [{ label: 'Deaf', value: RULES.STATUSES.deaf.hearingTn }]);
  });
  test('house rule override of amp per rating', () => {
    V().hearing.ampPerRating = -2;
    assert.deepEqual(hearingModifiers({ ears: earsDerived([{ hearingAmp: 1 }]), deaf: false }), [{ label: 'Hearing amplification 1', value: -2 }]);
    V().hearing.ampPerRating = 0;
    assert.deepEqual(hearingModifiers({ ears: earsDerived([{ hearingAmp: 1 }]), deaf: false }), []);
  });
  test('canHear: out-of-range sounds need the frequency option', () => {
    const hi = earsDerived([{ highFrequency: true }]);
    assert.ok(canHear({ ears: null }));
    assert.ok(canHear({ ears: null, range: 'normal' }));
    assert.ok(!canHear({ ears: null, range: 'high' }));
    assert.ok(canHear({ ears: hi, range: 'high' }));
    assert.ok(!canHear({ ears: hi, range: 'low' }));
    assert.ok(canHear({ ears: earsDerived([{ lowFrequency: true }]), range: 'low' }));
  });
  test('deafeningBlocked by a damper unless the house rule turns it off', () => {
    const d = earsDerived([{ dampener: true }]);
    assert.ok(deafeningBlocked(d));
    assert.ok(!deafeningBlocked(earsDerived([])));
    assert.ok(!deafeningBlocked(null));
    V().hearing.dampenerBlocksDeafening = false;
    assert.ok(!deafeningBlocked(d));
  });
});

describe('v0.61.0 superior position', () => {
  test('on by default, −1 for the holder only (v0.79.0, SR2 Melee Modifiers Table)', () => {
    assert.equal(RULES.COMBAT_V61.superiorPosition.enabled, true);
    assert.deepEqual(superiorPositionModifiers('attacker', 'attacker'), [{ label: 'Superior position', value: -1 }]);
    assert.deepEqual(superiorPositionModifiers('attacker', 'defender'), []);
    V().superiorPosition.enabled = false;
    assert.deepEqual(superiorPositionModifiers('attacker', 'attacker'), []);
  });
  test('enabled: holder and against', () => {
    V().superiorPosition.enabled = true;
    V().superiorPosition.against = 1; // v0.79.0: the book's 0 (was 1)
    assert.deepEqual(superiorPositionModifiers('attacker', 'attacker'), [{ label: 'Superior position', value: -1 }]);
    assert.deepEqual(superiorPositionModifiers('attacker', 'defender'), [{ label: 'Opponent has superior position', value: 1 }]);
    assert.deepEqual(superiorPositionModifiers('defender', 'defender'), [{ label: 'Superior position', value: -1 }]);
    assert.deepEqual(superiorPositionModifiers('', 'attacker'), []);
    assert.deepEqual(superiorPositionModifiers('bogus' as any, 'attacker'), []);
    assert.deepEqual(superiorPositionModifiers('attacker', 'bogus' as any), []);
    V().superiorPosition.holder = -2;
    assert.deepEqual(superiorPositionModifiers('defender', 'defender'), [{ label: 'Superior position', value: -2 }]);
  });
});

describe('v0.61.0 launcher arming range', () => {
  test('armed beyond, dud inside, none without min range', () => {
    assert.deepEqual(armingCheck({ distance: 10, minRange: 5 }), { armed: true, blocked: false, note: '' });
    assert.deepEqual(armingCheck({ distance: 5, minRange: 5 }).armed, true);
    const r = armingCheck({ distance: 3, minRange: 5 });
    assert.equal(r.armed, false); assert.equal(r.blocked, false); assert.match(r.note, /5 m/);
    assert.deepEqual(armingCheck({ distance: 1, minRange: 0 }), { armed: true, blocked: false, note: '' });
    assert.deepEqual(armingCheck({ distance: 1, minRange: NaN }), { armed: true, blocked: false, note: '' });
  });
  test('unknown distance: armed with a reminder', () => {
    const r = armingCheck({ distance: null, minRange: 5 });
    assert.equal(r.armed, true); assert.match(r.note, /unknown/i);
    assert.equal(armingCheck({ distance: 'x' as any, minRange: 5 }).armed, true);
  });
  test('block house rule', () => {
    V().launcher.dud = 'block';
    assert.equal(armingCheck({ distance: 2, minRange: 5 }).blocked, true);
    assert.equal(armingCheck({ distance: 2, minRange: 5 }).armed, false);
  });
});

describe('v0.61.0 stun baton charges', () => {
  test('not a stun weapon / untracked / charged / empty', () => {
    assert.deepEqual(stunCharge({ stunWeapon: false, ammo: 5, ammoMax: 10 }), { stun: false, spend: 0, note: '', blocked: false });
    assert.deepEqual(stunCharge({ stunWeapon: true, ammo: 0, ammoMax: 0 }), { stun: true, spend: 0, note: '', blocked: false });
    assert.deepEqual(stunCharge({ stunWeapon: true, ammo: 3, ammoMax: 10 }), { stun: true, spend: 1, note: '', blocked: false });
    assert.deepEqual(stunCharge({ stunWeapon: true, ammo: 0, ammoMax: 10 }), { stun: false, spend: 0, note: 'out of charge: hits as a club', blocked: false });
    assert.equal(stunCharge({ stunWeapon: true, ammo: NaN, ammoMax: 10 }).stun, false);
    assert.equal(stunCharge(null as any).stun, false);
  });
  test('block house rule', () => {
    V().stunBaton.emptyAs = 'block';
    const r = stunCharge({ stunWeapon: true, ammo: 0, ammoMax: 10 });
    assert.equal(r.blocked, true); assert.equal(r.stun, false);
  });
});

describe('v0.61.0 monowhip self-hit', () => {
  test('botch by default', (t) => {
    t.after(oldWay({"COMBAT_V61.monowhip.on": "botch"})); // v0.78.0: the old rule (a house rule)
    assert.ok(selfHitCheck({ selfHit: true, botch: true, missed: true }));
    assert.ok(!selfHitCheck({ selfHit: true, botch: false, missed: true }));
    assert.ok(!selfHitCheck({ selfHit: false, botch: true, missed: true }));
    assert.ok(!selfHitCheck(null as any));
  });
  test('miss house rule', () => {
    V().monowhip.on = 'miss';
    assert.ok(selfHitCheck({ selfHit: true, botch: false, missed: true }));
    assert.ok(selfHitCheck({ selfHit: true, botch: true, missed: false }));
    assert.ok(!selfHitCheck({ selfHit: true, botch: false, missed: false }));
  });
});

describe('v0.61.0 smoke grenades', () => {
  test('kinds, override, unknowns', () => {
    assert.deepEqual(grenadeSmoke('smoke'), { smoke: 'smoke', radius: 10, turns: 20 });
    assert.deepEqual(grenadeSmoke('thermalSmoke', 6), { smoke: 'thermal', radius: 6, turns: 20 });
    assert.deepEqual(grenadeSmoke('smoke', -3), { smoke: 'smoke', radius: 10, turns: 20 });
    assert.equal(grenadeSmoke('frag'), null);
    assert.equal(grenadeSmoke('toString'), null);
    assert.equal(grenadeSmoke(undefined as any), null);
  });
  test('house rule override', () => {
    V().smoke.radiusMetres = 15;
    V().smoke.kinds.custom = 'thermal';
    V().smoke.kinds.broken = 'fog';
    assert.deepEqual(grenadeSmoke('custom'), { smoke: 'thermal', radius: 15, turns: 20 });
    assert.equal(grenadeSmoke('broken'), null);
  });
});

describe('v0.61.0 skill mods text (lead)', () => {
  test('parses dice and TN entries and writes them back', async () => {
    const { parseSkillMods, skillModsText } = await import('../kit.ts');
    const list = parseSkillMods('Athletics +2; Perception TN -1, Stealth +1 TN -1\nnothing; Climbing: +3 dice');
    assert.deepEqual(list, [
      { skill: 'Athletics', dice: 2, tn: 0 },
      { skill: 'Perception', dice: 0, tn: -1 },
      { skill: 'Stealth', dice: 1, tn: -1 },
      { skill: 'Climbing', dice: 3, tn: 0 },
    ]);
    assert.equal(skillModsText(list), 'Athletics +2; Perception TN -1; Stealth +1 TN -1; Climbing +3');
    assert.deepEqual(parseSkillMods(skillModsText(list)), list);
    assert.deepEqual(parseSkillMods(null), []);
    // Review: unsigned numbers count as +, and the minus sign works.
    assert.deepEqual(parseSkillMods('Climbing 2; Athletics 12, Stealth TN 1; Perception −1'), [
      { skill: 'Climbing', dice: 2, tn: 0 }, { skill: 'Athletics', dice: 12, tn: 0 }, { skill: 'Stealth', dice: 0, tn: 1 }, { skill: 'Perception', dice: -1, tn: 0 },
    ]);
    assert.equal(skillModsText('x'), '');
  });
});
