/**
 * v0.96.0 rules completeness, spirits and astral (RULES.SPIRITS_V96): the pure rules (rules/spirits96.ts), the
 * statblock importer's adept costs, and for each switch that its other value ('v951') gives the v0.95.1 result.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/config.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as S from '../rules/spirits96.ts';
import { HOUSE_SPIRITS_V96 } from '../rules/config96/spirits.ts';
import { powerModifierBundle } from '../rules/bestiary.ts';
import { parseStatBlock, statBlockItems } from '../rules/statblock.ts';

const DAY = 86400;

describe('v0.96.0 spirits: the switches', () => {
  test('every switch has a house-rules row, the book first and the default; numbers as shipped', () => {
    const v: any = RULES.SPIRITS_V96;
    for (const r of HOUSE_SPIRITS_V96) {
      const key = r.path.split('.')[1]!;
      assert.ok(key in v, r.path);
      if (r.type === 'select') { assert.equal(v[key], r.choices![0], `${r.path} defaults to its first choice`); assert.deepEqual(r.choices, ['book', 'v951']); }
    }
    for (const k of Object.keys(v)) assert.ok(HOUSE_SPIRITS_V96.some((r) => r.path === `SPIRITS_V96.${k}`), k);
    assert.equal(v.disruptionDays, 28);
    assert.equal(v.watcherHours, 1);
  });
});

describe('an elemental\'s day of waiting (Core p. 141)', () => {
  test('a service per full 24 hours', () => {
    assert.equal(S.waitingServices(0, DAY - 1), 0);
    assert.equal(S.waitingServices(0, DAY), 1);
    assert.equal(S.waitingServices(100, 100 + 3 * DAY + 5), 3);
    assert.equal(S.waitingServices(NaN, DAY), 0);
  });
  test('v951: none', (t) => { t.after(oldWay({ 'SPIRITS_V96.elementalWaiting': 'v951' })); assert.equal(S.waitingServices(0, 5 * DAY), 0); });
});

describe('aid in spell defense (Core p. 141)', () => {
  test('up to what is left, the rest stays', () => {
    assert.deepEqual(S.aidDefenseDice(4, 3), { dice: 3, left: 1 });
    assert.deepEqual(S.aidDefenseDice(2, 9), { dice: 2, left: 0 });
  });
  test('v951: none', (t) => { t.after(oldWay({ 'SPIRITS_V96.aidDefense': 'v951' })); assert.deepEqual(S.aidDefenseDice(4, 3), { dice: 0, left: 4 }); });
});

describe('tech melee enhancements against spirits (Awakenings p. 101)', () => {
  test('the weapon\'s own Power is lost against a manifest spirit only', () => {
    assert.equal(S.techPowerLost({ melee: true, targetType: 'spirit', materialized: true, weaponTweakPower: 1 }), 1);
    assert.equal(S.techPowerLost({ melee: true, targetType: 'spirit', materialized: false, weaponTweakPower: 1 }), 0);
    assert.equal(S.techPowerLost({ melee: true, targetType: 'npc', weaponTweakPower: 1 }), 0);
    assert.equal(S.techPowerLost({ melee: false, targetType: 'spirit', weaponTweakPower: 1 }), 0);
    assert.equal(S.techPowerLost({ melee: true, targetType: 'spirit', weaponTweakPower: -2 }), 0, 'a penalty stays');
  });
  test('v951: kept', (t) => { t.after(oldWay({ 'SPIRITS_V96.techVsSpirits': 'v951' })); assert.equal(S.techPowerLost({ melee: true, targetType: 'spirit', weaponTweakPower: 2 }), 0); });
});

describe('spirit against spirit (Core p. 143)', () => {
  test('the book example: Force 4 fire vs Force 3 water, 3 to 1: the water loses 2', () => {
    assert.deepEqual(S.duelTns(4, 3), { a: 3, b: 4 });
    assert.deepEqual(S.spiritDuel({ aForce: 4, bForce: 3, aSuccesses: 3, bSuccesses: 1 }), { loser: 'b', loss: 2, force: 1, destroyed: false });
  });
  test('to 0 is destroyed; a tie does nothing', () => {
    assert.equal(S.spiritDuel({ aForce: 2, bForce: 5, aSuccesses: 0, bSuccesses: 4 })!.destroyed, true);
    assert.equal(S.spiritDuel({ aForce: 2, bForce: 2, aSuccesses: 1, bSuccesses: 1 }), null);
  });
});

describe('disruption (Grimoire p. 64)', () => {
  test('28 − Force days, at least one', () => {
    assert.equal(S.disruptionDays(4), 24);
    assert.equal(S.disruptionDays(30), 1);
    assert.equal(S.disruptedUntil(1000, 6), 1000 + 22 * DAY);
  });
  test('v951: no date', (t) => { t.after(oldWay({ 'SPIRITS_V96.disruption': 'v951' })); assert.equal(S.disruptedUntil(0, 4), null); });
});

describe('a free spirit\'s true name (Grimoire p. 77)', () => {
  test('only a free spirit, only without the name', () => {
    assert.equal(S.freeSpiritBanishRefusal({ spiritKind: 'free', knowsName: false }), 'SR2E.Spirits96.Why.trueName');
    assert.equal(S.freeSpiritBanishRefusal({ spiritKind: 'free', knowsName: true }), null);
    assert.equal(S.freeSpiritBanishRefusal({ spiritKind: 'elemental', knowsName: false }), null);
    assert.ok(S.trueNameMatches(' Azreth ', 'azreth'));
    assert.ok(!S.trueNameMatches('', ''));
  });
  test('v951: anyone', (t) => { t.after(oldWay({ 'SPIRITS_V96.freeSpiritBanish': 'v951' })); assert.equal(S.freeSpiritBanishRefusal({ spiritKind: 'free', knowsName: false }), null); });
});

describe('watchers (Grimoire p. 73)', () => {
  test('the book example: 4 hours, 3 successes: Force 1, 4L Stun', () => {
    assert.equal(S.watcherTn(4), 4);
    assert.equal(S.watcherForce(3), 1);
    assert.deepEqual(S.watcherDrain(1, 4), { tn: 4, level: 'L', type: 'stun' });
    assert.equal(S.watcherDissolvesAt(0, 4), 4 * 3600);
  });
  test('the summoner may take less Force; hours default to the switch; TN never below 2', () => {
    assert.equal(S.watcherForce(8, 2), 2);
    assert.equal(S.watcherForce(3, 5), 1);
    assert.equal(S.watcherHours(undefined), 1);
    assert.equal(S.watcherTn(1), 2);
  });
});

describe('the astral attack skill (Core p. 147)', () => {
  test('the better of Unarmed (Armed with a focus) and Sorcery', () => {
    assert.equal(S.astralAttackSkill({ sorcery: 3, unarmed: 5, armed: 0, focus: false }), 'unarmed');
    assert.equal(S.astralAttackSkill({ sorcery: 5, unarmed: 5, armed: 0, focus: false }), 'sorcery');
    assert.equal(S.astralAttackSkill({ sorcery: 2, unarmed: 6, armed: 4, focus: true }), 'armed');
  });
  test('v951: none (the attack skill rule)', (t) => { t.after(oldWay({ 'SPIRITS_V96.astralSkill': 'v951' })); assert.equal(S.astralAttackSkill({ sorcery: 1, unarmed: 6, armed: 0, focus: false }), null); });
});

describe('reading an aura again (Grimoire p. 90)', () => {
  test('+2 per attempt, refused above Magic; a first attempt always', () => {
    assert.deepEqual(S.assenseAttempt({ tries: 0, baseTn: 4, magic: 3 }), { tn: 4, extra: 0 });
    assert.deepEqual(S.assenseAttempt({ tries: 1, baseTn: 4, magic: 6 }), { tn: 6, extra: 2 });
    assert.equal(S.assenseAttempt({ tries: 2, baseTn: 4, magic: 6 }).why, 'SR2E.Spirits96.Why.assenseAgain');
  });
  test('the record keeps one scene', () => {
    let r: unknown = null;
    r = S.assenseTriesAfter(r, 's1', 'A');
    r = S.assenseTriesAfter(r, 's1', 'A');
    r = S.assenseTriesAfter(r, 's1', 'B');
    assert.equal(S.assenseTriesOf(r, 's1', 'A'), 2);
    assert.equal(S.assenseTriesOf(r, 's1', 'B'), 1);
    assert.equal(S.assenseTriesOf(r, 's2', 'A'), 0);
    r = S.assenseTriesAfter(r, 's2', 'B');
    assert.equal(S.assenseTriesOf(r, 's2', 'A'), 0, 'a new scene starts afresh');
    assert.ok(Array.isArray((r as any).tries));
  });
  test('v951: no limit', (t) => { t.after(oldWay({ 'SPIRITS_V96.assenseRepeat': 'v951' })); assert.deepEqual(S.assenseAttempt({ tries: 5, baseTn: 4, magic: 1 }), { tn: 4, extra: 0 }); });
});

describe('reflecting (Awakenings p. 99)', () => {
  test('the book example: 4 shielding successes vs 2: back at Force 2', () => {
    assert.deepEqual(S.reflectBook({ shieldSuccesses: 4, casterSuccesses: 2, force: 4 }), { force: 2 });
    assert.deepEqual(S.reflectBook({ shieldSuccesses: 9, casterSuccesses: 2, force: 4 }), { force: 4 }, 'at most its Force');
    assert.equal(S.reflectBook({ shieldSuccesses: 2, casterSuccesses: 2, force: 4 }), null);
    assert.deepEqual(S.reflectBook({ shieldSuccesses: 3, casterSuccesses: 0, force: 1, reflected: true }), { dissipates: true });
  });
  test('the shielding dice are tagged as rolled and counted at the current TN, wherever they end up', () => {
    const dice: any[] = [6, 6, 1, 5, 2, 4].map((t) => ({ total: t }));
    S.tagShieldDice(dice, { from: 2, count: 3 });
    assert.deepEqual(dice.map((d) => Boolean(d.shield)), [false, false, true, true, true, false]);
    assert.equal(S.shieldSuccesses96(dice, 4), 1);
    assert.equal(S.shieldSuccesses96([...dice].reverse(), 2), 2, 'a re-roll reorders the dice: the tags go with them');
  });
});

describe('cleansing (Awakenings p. 100)', () => {
  test('a count up to the grade; (count)D Drain', () => {
    assert.equal(S.cleanseRefusal(3, 2), 'SR2E.Spirits96.Why.cleanseGrade');
    assert.equal(S.cleanseRefusal(2, 2), null);
    assert.deepEqual(S.cleanseDrain(2), { tn: 2, level: 'D' });
  });
  test('v951: any count, no Drain', (t) => { t.after(oldWay({ 'SPIRITS_V96.cleansing': 'v951' })); assert.equal(S.cleanseRefusal(5, 0), null); assert.equal(S.cleanseDrain(3), null); });
});

describe('adept power costs (Core pp. 125–126; Awakenings p. 116)', () => {
  test('Improved Physical Attributes by band (racial maximum 6)', () => {
    assert.equal(S.improvedAttributeCost(2, 1, 6), 0.5);
    assert.equal(S.improvedAttributeCost(5, 2, 6), 2.5, '6 at 1, 7 at 1.5');
    assert.equal(S.improvedAttributeCost(3, 3, 6), 3);
  });
  test('Improved Ability by skill; paired strikes double', () => {
    assert.equal(S.improvedAbilityPerDie('Stealth'), 0.25);
    assert.equal(S.improvedAbilityPerDie('Unarmed Combat'), 0.5);
    assert.equal(S.improvedAbilityPerDie('Firearms'), 1);
    assert.equal(S.improvedAbilityPerDie('Negotiation'), null);
    assert.equal(S.pairedStrikeCost(2, true), 4);
    assert.equal(S.pairedStrikeCost(2, false), 2);
  });
  test('the stat block importer: Distance Strike doubles beside Killing Hands; Improved Strength by band', (t) => {
    const p = parseStatBlock('B Q S C I W E M R\n4 5 5 3 4 5 6 6 5\nAdept Powers: Killing Hands (M), Distance Strike, Improved Strength 2');
    const items = statBlockItems(p, { adept: true }).items.filter((i) => i.type === 'adeptpower');
    const ds = items.find((i) => /distance/i.test(i.name))!;
    assert.equal((ds.system as any).cost, 4);
    const st = items.find((i) => /strength/i.test(i.name));
    assert.ok(st); assert.equal((st!.system as any).cost, 2, 'the block shows 5 with the power: from 3 to 5, at 1 each (racial maximum 6)');
    t.after(oldWay({ 'SPIRITS_V96.adeptCosts': 'v951' }));
    const old = statBlockItems(p, { adept: true }).items.filter((i) => i.type === 'adeptpower');
    assert.equal((old.find((i) => /distance/i.test(i.name))!.system as any).cost, 2);
    const ost = old.find((i) => /strength/i.test(i.name));
    assert.equal((ost!.system as any).cost, 1);
  });
});

describe('Confusion, Fear, Engulf (Predator and Prey pp. 89–92)', () => {
  test('which powers; Confusion half the net, Fear severity, Engulf entry', () => {
    assert.equal(S.opposedPower('fear', 'Fear'), 'fear');
    assert.equal(S.opposedPower('', 'Engulf (water)'), 'engulf');
    assert.equal(S.opposedPower('guard', 'Guard'), null);
    assert.equal(S.confusionTn(5), 2);
    assert.deepEqual([0, 1, 2, 3, 4, 6].map(S.fearSeverity), [null, 'runs', 'stays', 'stays', 'sweats', 'phobia']);
    assert.deepEqual([0, 1, 3].map(S.engulfEntry), [null, 'walk', 'run']);
  });
  test('Confusion\'s TN on the effect: half the net successes; v951: the being\'s Essence', (t) => {
    assert.deepEqual(powerModifierBundle('confusion', { force: 6, successes: 5 }), { testsTn: 2 });
    t.after(oldWay({ 'SPIRITS_V96.critterOpposed': 'v951' }));
    assert.deepEqual(powerModifierBundle('confusion', { force: 6, successes: 5 }), { testsTn: 6 });
    assert.equal(S.opposedPower('fear', 'Fear'), null);
  });
});

describe('the Astral Combat Pool while perceiving (Core p. 147)', () => {
  test('a perceiving magician, not an adept, a spirit or a projector', () => {
    const o = { astral: 'perceiving', type: 'character', tradition: 'hermetic', magic: 6 };
    assert.ok(S.astralPoolWhilePerceiving(o));
    assert.ok(!S.astralPoolWhilePerceiving({ ...o, astral: 'projecting' }));
    assert.ok(!S.astralPoolWhilePerceiving({ ...o, tradition: 'adept' }));
    assert.ok(!S.astralPoolWhilePerceiving({ ...o, type: 'spirit' }));
  });
  test('v951: the Combat Pool', (t) => { t.after(oldWay({ 'SPIRITS_V96.astralPerceiving': 'v951' })); assert.ok(!S.astralPoolWhilePerceiving({ astral: 'perceiving', type: 'character', tradition: 'hermetic', magic: 6 })); });
});
