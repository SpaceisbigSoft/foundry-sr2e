/**
 * v0.80.0 magic: the Unified Rules Revamp's pure functions (rules/urr80-magic.ts), under the book (shipped values)
 * and under urrMode(). The wired existing functions are checked in __tests__/v080-magic.test.ts.
 */
import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { RULES } from '../config.ts';
import { urrMode } from './urrmode.ts';
import {
  urrMagCastingDice, urrMagElementalTn, urrMagRuleOfOneDrain, urrMagSpellTie, urrMagSustainCapProblem, urrMagSpellForceBonus,
  urrMagLearnTnFactor, urrMagLearnExtraDice, urrMagRitualProblem, urrMagRitualMaterials, urrMagRitualResistTn,
  urrMagConjuringDrainLevel, urrMagConjuringDrainType, urrMagNatureSpiritConflict, urrMagAstralReactionFactor,
  urrMagProjectionHours, urrMagWeaponFocusRating, urrMagAstralDamage, urrMagTrackingMods, urrMagAstralDrainType,
  urrMagAstralModeFor, urrMagWardDrain, urrMagWardForceProblem, urrMagSiteCost, urrMagNoTotemDice, urrMagAdeptFoci, urrMagLossHit,
} from '../urr80-magic.ts';

const focus = (focusType: string, rating: number, active = true) => ({ focusType, rating, active, category: '', target: '' });

describe('v0.80.0 magic: the book (shipped switches)', () => {
  test('every switch ships at the book way', () => {
    const u = RULES.URR_V80;
    assert.equal(u.magCastDice, 'sorcery');
    assert.equal(u.magSustainCap, 'off');
    assert.equal(u.magConjDrain, 'book');
    assert.equal(u.magAstralReaction, 1);
    assert.equal(u.magLossLe, false);
    assert.equal(RULES.SPELLCRAFT.exclusiveDrainMod, -2);
    assert.equal(RULES.ASTRAL.initiativeBonus, 20);
  });
  test('the functions give the book answers', () => {
    assert.equal(urrMagCastingDice({ dice: 5, force: 3 }), 5);
    assert.equal(urrMagElementalTn(6), 6);
    assert.deepEqual(urrMagRuleOfOneDrain(true), []);
    assert.equal(urrMagSpellTie(3, 3), null);
    assert.equal(urrMagSustainCapProblem([{}, {}, {}], 1), null);
    assert.equal(urrMagSpellForceBonus({ exclusive: true, fetish: true }), 0);
    assert.equal(urrMagLearnTnFactor(), 1);
    assert.equal(urrMagLearnExtraDice(4), 0);
    assert.equal(urrMagRitualProblem({ category: 'combat', sorcery: [6, 1, 1] }), null);
    assert.equal(urrMagRitualMaterials(4, 'health'), null);
    assert.deepEqual(urrMagRitualResistTn(3, 6), {});
    assert.equal(urrMagConjuringDrainLevel(2, 4), null);
    assert.equal(urrMagConjuringDrainType(5, 4), null);
    assert.equal(urrMagNatureSpiritConflict(2), null);
    assert.equal(urrMagAstralReactionFactor(), 1);
    assert.equal(urrMagProjectionHours(1.5), null);
    assert.deepEqual(urrMagAstralDamage({ mode: 'magician', power: 5, level: 'M', focusRating: 3 }), { power: 5, level: 'M', note: '' });
    assert.deepEqual(urrMagTrackingMods(3, 5), []);
    assert.equal(urrMagAstralDrainType('stun', 'projecting'), 'stun');
    assert.equal(urrMagAstralModeFor('sorcerer', 'projecting'), 'projecting');
    assert.equal(urrMagWardDrain(4, 3), null);
    assert.equal(urrMagWardForceProblem(20, 3), null);
    assert.equal(urrMagSiteCost('library', 0, 4, 1000, 1), null);
    assert.equal(urrMagNoTotemDice('shamanist'), false);
    assert.equal(urrMagAdeptFoci('adept', [focus('power', 2), focus('weapon', 1)]).length, 2);
    assert.equal(urrMagLossHit(5, 5), false);
    assert.equal(urrMagLossHit(4, 5), true);
  });
});

describe('v0.80.0 magic: the Unified Rules Revamp', () => {
  test('casting: Force dice, elemental TN 4, Rule of One +2 drain, a tie at L, the Force bonuses', (t) => {
    t.after(urrMode());
    assert.equal(urrMagCastingDice({ dice: 5, force: 3 }), 3);
    assert.equal(urrMagCastingDice({ dice: 5, force: 3, innate: true }), 5);
    assert.equal(urrMagElementalTn(6), 4);
    assert.deepEqual(urrMagRuleOfOneDrain(true), [{ label: 'Rule of One on the casting', value: 2 }]);
    assert.deepEqual(urrMagRuleOfOneDrain(false), []);
    assert.deepEqual(urrMagSpellTie(3, 3), { hit: true, netSuccesses: 0, level: 'L' });
    assert.equal(urrMagSpellTie(0, 0), null);
    assert.equal(urrMagSpellTie(3, 2), null);
    assert.equal(urrMagSpellForceBonus({ exclusive: true }), 2);
    assert.equal(urrMagSpellForceBonus({ fetish: true }), 1);
    assert.equal(RULES.SPELLCRAFT.exclusiveDrainMod, 0);
    assert.equal(RULES.SPELLCRAFT.fetishDrainMod, 0);
    assert.equal(RULES.TN_AUTO.magic.environment, 'all');
  });
  test('sustaining: at most Sorcery self-sustained spells; foci, quickened and spirit-held ones are free', (t) => {
    t.after(urrMode());
    assert.match(urrMagSustainCapProblem([{}, {}], 2) ?? '', /at most 2 spells/);
    assert.equal(urrMagSustainCapProblem([{}, { focusId: 'f' }, { quickened: true }, { spiritUuid: 's' }], 2), null);
  });
  test('learning: Sorcery + Magical Theory vs 2 × Force', (t) => {
    t.after(urrMode());
    assert.equal(urrMagLearnTnFactor(), 2);
    assert.equal(urrMagLearnExtraDice(3), 3);
  });
  test('ritual: no combat spells, team cap, materials by category, resistance TN', (t) => {
    t.after(urrMode());
    assert.match(urrMagRitualProblem({ category: 'combat', sorcery: [6] }) ?? '', /Combat spells/);
    assert.match(urrMagRitualProblem({ category: 'health', sorcery: [6, 2, 4] }) ?? '', /at most 2 members/);
    assert.equal(urrMagRitualProblem({ category: 'health', sorcery: [6, 3, 4] }), null);
    assert.equal(urrMagRitualMaterials(4, 'detection'), 400);
    assert.equal(urrMagRitualMaterials(4, 'health'), 2000);
    assert.equal(urrMagRitualMaterials(4, 'Manipulation'), 4000);
    assert.deepEqual(urrMagRitualResistTn(3, 6), { resistTn: 6 });
    assert.deepEqual(urrMagRitualResistTn(6, 4), {});
  });
  test('conjuring drain: L below half Charisma, S and D over Charisma and Physical', (t) => {
    t.after(urrMode());
    assert.equal(urrMagConjuringDrainLevel(1, 4), 'L');
    assert.equal(urrMagConjuringDrainLevel(2, 4), 'M');                // exactly half is M (the book: L)
    assert.equal(urrMagConjuringDrainLevel(4, 4), 'M');
    assert.equal(urrMagConjuringDrainLevel(7, 4), 'S');                // the book: D above 1.5 ×
    assert.equal(urrMagConjuringDrainLevel(8, 4), 'S');
    assert.equal(urrMagConjuringDrainLevel(9, 4), 'D');
    assert.equal(urrMagConjuringDrainType(4, 4), 'stun');
    assert.equal(urrMagConjuringDrainType(5, 4), 'physical');
    assert.match(urrMagNatureSpiritConflict(1) ?? '', /only one at a time/);
    assert.equal(urrMagNatureSpiritConflict(0), null);
  });
  test('astral: Reaction × 2, full hours, unarmed L / focus M, tracking ±2, Physical drain, aspected', (t) => {
    t.after(urrMode());
    assert.equal(urrMagAstralReactionFactor(), 2);
    assert.equal(RULES.ASTRAL.initiativeBonus, 15);
    assert.equal(urrMagProjectionHours(1.5), 1);
    assert.equal(urrMagProjectionHours(0.9), 0);
    assert.equal(urrMagWeaponFocusRating([focus('weapon', 3), focus('weapon', 4, false), focus('power', 5)]), 3);
    assert.deepEqual(urrMagAstralDamage({ mode: 'magician', power: 5, level: 'M', focusRating: 0 }), { power: 5, level: 'L', note: '' });
    assert.deepEqual(urrMagAstralDamage({ mode: 'magician', power: 5, level: 'M', focusRating: 3 }), { power: 8, level: 'M', note: ' [weapon focus +3 Power]' });
    assert.deepEqual(urrMagAstralDamage({ mode: 'spirit', power: 5, level: 'M', focusRating: 3 }), { power: 5, level: 'M', note: '' });
    assert.deepEqual(urrMagTrackingMods(3, 5), [{ label: 'Force within your Sorcery', value: -2 }]);
    assert.deepEqual(urrMagTrackingMods(6, 5), [{ label: 'Force over your Sorcery', value: 2 }]);
    assert.equal(RULES.TRACKING.baseHours, 12);
    assert.equal(urrMagAstralDrainType('stun', 'projecting'), 'physical');
    assert.equal(urrMagAstralDrainType('stun', 'perceiving'), 'stun');
    assert.equal(urrMagAstralModeFor('sorcerer', 'projecting'), 'physical');
    assert.equal(urrMagAstralModeFor('conjurer', 'perceiving'), 'physical');
    assert.equal(urrMagAstralModeFor('shamanist', 'projecting'), 'projecting');
  });
  test('wards and sites; traditions; Magic loss on ≤', (t) => {
    t.after(urrMode());
    assert.deepEqual(urrMagWardDrain(4, 3), { drainTn: 7, type: 'stun' });
    assert.equal(RULES.MAGIC_V56.ward.skill, 'Sorcery');
    assert.match(urrMagWardForceProblem(7, 3) ?? '', /at most 6/);
    assert.equal(urrMagWardForceProblem(6, 3), null);
    assert.deepEqual(urrMagSiteCost('library', 2, 4, 1000, 1), { nuyen: 12000, days: 2 });
    assert.deepEqual(urrMagSiteCost('circle', 0, 6, 500, 1), { nuyen: 3000, days: 0.25 });
    assert.deepEqual(urrMagSiteCost('lodge', 0, 3, 500, 1), { nuyen: 1500, days: 3 });
    assert.equal(urrMagNoTotemDice('shamanist'), true);
    assert.equal(urrMagNoTotemDice('shamanic'), false);
    assert.deepEqual(urrMagAdeptFoci('adept', [focus('power', 2), focus('weapon', 1)]).map((f) => f.focusType), ['weapon']);
    assert.equal(urrMagAdeptFoci('hermetic', [focus('power', 2)]).length, 1);
    assert.equal(urrMagLossHit(5, 5), true);
    assert.equal(urrMagLossHit(6, 5), false);
  });
});
