/**
 * v0.79.0 (ranged): the verified fixes backed by SRII tables and pages (rules/config79-ranged.ts). Each switch in
 * RULES.DOCS_V79 defaults to the documents' way; the old way is checked through oldWay().
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import {
  reloadActionKind, reloadActionLabel, offensivePoolDice, bookStrengthRow, strengthRangeMultipliers, recoilFreeRounds,
  firstShotWasSingle, flechetteAtSoak, flechetteSoak, grenadeScatterType, scatterDiceV79, surpriseByOrder,
  surpriseInitiative, surpriseMayTarget, surpriseBlockedTargets,
} from '../docs79-ranged.ts';

/** The recoil count as the v0.79.0 recoilModifier does it (firing.ts imports recoilFreeRounds). */
const recoil = (o: { rounds: number; earlierRoundsThisPhase?: number; recoilComp?: number; firstShotSingle?: boolean }) =>
  Math.max(0, o.rounds + (o.earlierRoundsThisPhase ?? 0) - recoilFreeRounds(o) - (o.recoilComp ?? 0));

describe('v0.79.0 reloading (DOCS_V79.rangedReload, SRII pp. 81–83)', () => {
  test('the documents: clip = remove + insert, smartgun ejects free, non-clip Complex', () => {
    assert.equal(reloadActionKind('clip'), 'reload:clip');
    assert.equal(reloadActionKind(undefined), 'reload:clip');
    assert.equal(reloadActionKind('clip', { smartgun: true }), 'reload');
    assert.deepEqual(['belt', 'cylinder', 'internal', 'break'].map((f) => reloadActionKind(f)), Array(4).fill('reload:complex'));
    assert.match(reloadActionLabel('reload:clip'), /two Simple/);
    assert.match(reloadActionLabel('reload:complex'), /Complex/);
  });
  test('the old way: one Simple Action for everything', (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedReload': 'oneSimple' }));
    assert.deepEqual(['clip', 'belt', 'cylinder'].map((f) => reloadActionKind(f)), ['reload', 'reload', 'reload']);
  });
});

describe('v0.79.0 Combat Pool cap on offence (DOCS_V79.rangedPoolCap, SRII p. 83)', () => {
  test('the documents: at most the skill rating', () => {
    assert.equal(offensivePoolDice(8, 5), 5);
    assert.equal(offensivePoolDice(3, 5), 3);
    assert.equal(offensivePoolDice(4, 0), 0);
    assert.equal(offensivePoolDice(-2, 5), 0);
  });
  test('the old way: no cap', (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedPoolCap': 'none' }));
    assert.equal(offensivePoolDice(8, 5), 8);
  });
});

describe('v0.79.0 Strength ranges (DOCS_V79.rangedStrengthRange, Weapon / Grenade Range Tables)', () => {
  test('book rows by name', () => {
    assert.deepEqual(bookStrengthRow('Bow'), { short: 1, medium: 10, long: 30, extreme: 60 });
    assert.deepEqual(bookStrengthRow('Ranger longbow'), { short: 1, medium: 10, long: 30, extreme: 60 });
    assert.deepEqual(bookStrengthRow('Light crossbow'), { short: 2, medium: 8, long: 20, extreme: 40 });
    assert.deepEqual(bookStrengthRow('Medium Crossbow'), { short: 3, medium: 12, long: 30, extreme: 50 });
    assert.deepEqual(bookStrengthRow('Heavy crossbow'), { short: 5, medium: 15, long: 40, extreme: 60 });
    assert.deepEqual(bookStrengthRow('Shuriken'), { short: 1, medium: 2, long: 5, extreme: 7 });
    assert.deepEqual(bookStrengthRow('Offensive grenade'), { short: 3, medium: 5, long: 10, extreme: 20 });
    assert.deepEqual(bookStrengthRow('Aerodynamic offensive grenade'), { short: 3, medium: 5, long: 20, extreme: 30 });
    assert.equal(bookStrengthRow('Crossbow'), null);
    assert.equal(bookStrengthRow('Throwing knife'), null);
  });
  test('an item still on the default multipliers takes its row; its own set values win', () => {
    const def = { strengthRangeMultipliers: { short: 1, medium: 2, long: 3, extreme: 5 } };
    assert.deepEqual(strengthRangeMultipliers(def, 'Shuriken'), { short: 1, medium: 2, long: 5, extreme: 7 });
    assert.deepEqual(strengthRangeMultipliers({}, 'Heavy crossbow'), { short: 5, medium: 15, long: 40, extreme: 60 });
    assert.deepEqual(strengthRangeMultipliers(def, 'Throwing knife'), { short: 1, medium: 2, long: 3, extreme: 5 });
    const own = { strengthRangeMultipliers: { short: 2, medium: 4, long: 6, extreme: 8 } };
    assert.deepEqual(strengthRangeMultipliers(own, 'Shuriken'), { short: 2, medium: 4, long: 6, extreme: 8 });
    // The shipped default is read from RULES.COMBAT.strengthRange when passed.
    assert.deepEqual(strengthRangeMultipliers(def, 'Bow', RULES.COMBAT.strengthRange), { short: 1, medium: 10, long: 30, extreme: 60 });
  });
  test('the old way: the item\'s own multipliers', (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedStrengthRange': 'item' }));
    assert.deepEqual(strengthRangeMultipliers({ strengthRangeMultipliers: { short: 1, medium: 2, long: 3, extreme: 5 } }, 'Shuriken'), { short: 1, medium: 2, long: 3, extreme: 5 });
  });
});

describe('v0.79.0 recoil (DOCS_V79.rangedRecoil, Ranged Combat Modifiers Table)', () => {
  test('the documents: SA second shot +1, bursts +3 / +6, full auto +1 per round', () => {
    assert.equal(recoil({ rounds: 1 }), 0);
    assert.equal(recoil({ rounds: 1, earlierRoundsThisPhase: 1, firstShotSingle: true }), 1);
    assert.equal(recoil({ rounds: 3 }), 3);
    assert.equal(recoil({ rounds: 3, earlierRoundsThisPhase: 3, firstShotSingle: false }), 6);
    assert.equal(recoil({ rounds: 10 }), 10);
    assert.equal(recoil({ rounds: 3, recoilComp: 1 }), 2);
    assert.equal(recoil({ rounds: 3, earlierRoundsThisPhase: 1, firstShotSingle: true }), 3);
    assert.equal(firstShotWasSingle({ rounds: 3 }), false);
    assert.equal(firstShotWasSingle({ rounds: 1 }), true);
    assert.equal(firstShotWasSingle({ rounds: 3, earlierRoundsThisPhase: 3 }), true);
  });
  test('the old way: the first round of the phase is always free', (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedRecoil': 'freeFirst' }));
    assert.equal(recoil({ rounds: 3 }), 2);
    assert.equal(recoil({ rounds: 3, earlierRoundsThisPhase: 3, firstShotSingle: false }), 5);
    assert.equal(recoil({ rounds: 10 }), 9);
  });
});

describe('v0.79.0 flechette (DOCS_V79.rangedFlechette, SRII p. 93)', () => {
  test('the documents: +1 level only against no armor; against armor the higher rating doubled', () => {
    assert.equal(flechetteAtSoak('flechette'), true);
    assert.equal(flechetteAtSoak('standard'), false);
    assert.deepEqual(flechetteSoak({ ballistic: 0, impact: 0, level: 'M' }).level, 'S');
    assert.equal(flechetteSoak({ ballistic: 0, impact: 0, level: 'M' }).armor, 0);
    const jacket = flechetteSoak({ ballistic: 5, impact: 3, level: 'M' });
    assert.deepEqual([jacket.level, jacket.armor, jacket.armored], ['M', 10, true]);
    const impactOnly = flechetteSoak({ ballistic: 1, impact: 4, level: 'L' });
    assert.deepEqual([impactOnly.level, impactOnly.armor], ['L', 8]);
    // Dermal armor alone counts as armor: no extra level.
    assert.equal(flechetteSoak({ ballistic: 1, impact: 1, level: 'M' }).level, 'M');
  });
  test('the old way: the stage stays in planAttack', (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedFlechette.mode': 'always' }));
    assert.equal(flechetteAtSoak('flechette'), false);
  });
});

describe('v0.79.0 grenade scatter (DOCS_V79.rangedScatter, Grenade Range Table)', () => {
  test('grenade types', () => {
    assert.equal(grenadeScatterType({ blastKind: 'offensive', skill: 'Throwing Weapons', name: 'Offensive grenade' }), 'standard');
    assert.equal(grenadeScatterType({ blastKind: 'offensive', skill: 'Throwing Weapons', name: 'Aerodynamic grenade' }), 'aerodynamic');
    assert.equal(grenadeScatterType({ blastKind: 'offensive', skill: 'Launch Weapons', name: 'Grenade launcher' }), 'launcher');
    assert.equal(grenadeScatterType({ blastKind: 'heRocket', skill: 'Launch Weapons', name: 'Missile launcher' }), null);
    assert.equal(grenadeScatterType({ blastKind: 'offensive', skill: 'Launch Weapons', name: 'Missile launcher' }), null);
    assert.equal(grenadeScatterType({ blastKind: 'demolition', skill: '', name: 'Charge' }), null);
  });
  test('the documents: 1D6 / 2D6 / 3D6 by type; other blasts by range', () => {
    assert.deepEqual((['standard', 'aerodynamic', 'launcher'] as const).map((t) => scatterDiceV79(t, 4)), [1, 2, 3]);
    assert.equal(scatterDiceV79(null, 4), 4);
  });
  test('the old way: by range band', (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedScatter.mode': 'byRange' }));
    assert.equal(scatterDiceV79('launcher', 2), 2);
  });
});

describe('v0.79.0 surprise (DOCS_V79.rangedSurprise, SRII p. 86)', () => {
  test('the documents: order by successes, one pass, no acting against more successes', () => {
    assert.equal(surpriseByOrder(), true);
    assert.deepEqual([0, 1, 4, 9, 15].map(surpriseInitiative), [1, 2, 5, 10, 10]);
    assert.equal(surpriseMayTarget(2, 2), true);
    assert.equal(surpriseMayTarget(1, 2), false);
    const successes = { a: 1, b: 3, c: 1, d: 0 };
    assert.deepEqual(surpriseBlockedTargets({ active: true, successes, attackerId: 'a', targetIds: ['b', 'c', 'd', 'x'] }), ['b']);
    assert.deepEqual(surpriseBlockedTargets({ active: false, successes, attackerId: 'a', targetIds: ['b'] }), []);
    assert.deepEqual(surpriseBlockedTargets({ active: true, successes, attackerId: 'x', targetIds: ['b'] }), []);
  });
  test('the old way: no order, no target limit', (t) => {
    t.after(oldWay({ 'DOCS_V79.rangedSurprise.mode': 'losePass' }));
    assert.equal(surpriseByOrder(), false);
    assert.deepEqual(surpriseBlockedTargets({ active: true, successes: { a: 0, b: 3 }, attackerId: 'a', targetIds: ['b'] }), []);
  });
});
