import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from '../../__tests__/helpers/assert-rows.ts';
import {
  sustainingModifiers, sorceryFocusDice, conjuringFocusDice, weaponFocusDice, availableSustainingFocus,
  totemDice, traditionBlocks, traditionSpiritWarning, adeptAugmentations, adeptPowerPoints, adeptSkillDice, adeptArmor,
  type Focus,
} from '../arcana.ts';
import { sumBonuses } from '../cyberware.ts';

const focus = (o: Partial<Focus>): Focus => ({ focusType: 'spell', rating: 2, active: true, category: '', target: '', ...o });

describe('sustained spells', () => {
  test('+2 TN per spell sustained personally; focus-held spells are free', () => {
    assert.deepEqual(sustainingModifiers([]), []);
    assert.deepEqual(sustainingModifiers([
      { spellName: 'Armor', force: 4, category: 'manipulation', focusId: '' },
      { spellName: 'Invisibility', force: 3, category: 'illusion', focusId: '' },
      { spellName: 'Heal', force: 3, category: 'health', focusId: 'f1' },
    ]), [{ id: 'sustaining', label: 'Sustaining 2 spells', value: 4 }]);
  });
  test('a sustaining focus must be active, strong enough, the right category and free', () => {
    const foci = [focus({ id: 'a', focusType: 'sustaining', rating: 3, category: 'health' }), focus({ id: 'b', focusType: 'sustaining', rating: 5 })];
    assert.equal(availableSustainingFocus(foci, [], { force: 3, category: 'health' })?.id, 'a');
    assert.equal(availableSustainingFocus(foci, [], { force: 4, category: 'health' })?.id, 'b');
    assert.equal(availableSustainingFocus(foci, [{ spellName: 'x', force: 1, category: '', focusId: 'b' }], { force: 4, category: 'combat' }), null);
  });
});

describe('foci', () => {
  const foci = [
    focus({ focusType: 'spell', rating: 2, category: 'combat' }),
    focus({ focusType: 'spell', rating: 3, target: 'Manabolt' }),
    focus({ focusType: 'spell', rating: 4, category: 'health', active: false }),
    focus({ focusType: 'power', rating: 1 }),
    focus({ focusType: 'spirit', rating: 2, target: 'elemental' }),
    focus({ focusType: 'weapon', rating: 3, target: 'Sword' }),
  ];
  test('sorcery: best matching spell focus plus power focus', (t) => {
    t.after(oldWay({"BOOK_V78.powerFocus": "dice"})); // v0.78.0: the old rule (a house rule)
    assert.deepEqual(sorceryFocusDice(foci, { name: 'Manabolt', category: 'combat' }), { dice: 4, notes: ['spell focus +3', 'power focus +1'] });
    assert.deepEqual(sorceryFocusDice(foci, { name: 'Powerbolt', category: 'combat' }).dice, 3);
    assert.deepEqual(sorceryFocusDice(foci, { name: 'Heal', category: 'health' }).dice, 1);   // inactive focus ignored
  });
  test('conjuring: spirit focus by kind or type plus power focus', (t) => {
    t.after(oldWay({"BOOK_V78.powerFocus": "dice"})); // v0.78.0: the old rule (a house rule)
    assert.equal(conjuringFocusDice(foci, { kind: 'elemental', type: 'Fire elemental' }).dice, 3);
    assert.equal(conjuringFocusDice(foci, { kind: 'nature', type: 'Forest spirit' }).dice, 1);
    assert.equal(conjuringFocusDice(foci, null).dice, 1);
  });
  test('weapon focus: the named weapon, or the best one for astral attacks; power focus not added by default', () => {
    assert.equal(weaponFocusDice(foci, 'sword').dice, 3);
    assert.equal(weaponFocusDice(foci, 'Knife').dice, 0);
    assert.equal(weaponFocusDice(foci, null).dice, 3);
  });
});

describe('traditions, totems and adepts', () => {
  test('totem dice only for shamans', () => {
    assert.equal(totemDice('shamanic', { combat: 2, health: -1 }, 'combat'), 2);
    assert.equal(totemDice('shamanic', { combat: 2, health: -1 }, 'health'), -1);
    assert.equal(totemDice('hermetic', { combat: 2 }, 'combat'), 0);
  });
  test('adepts cannot cast or conjure; tradition spirit warnings', () => {
    assert.match(traditionBlocks('adept', 'cast') ?? '', /cannot cast/);
    assert.equal(traditionBlocks('hermetic', 'cast'), null);
    assert.match(traditionSpiritWarning('hermetic', 'nature') ?? '', /Hermetic magicians do not normally summon nature spirits/);
    assert.match(traditionSpiritWarning('shamanic', 'elemental') ?? '', /elementals/);
    assert.equal(traditionSpiritWarning('none', 'nature'), null);
  });
  test('adept powers add bonuses like cyberware, cost points, add skill dice and armor', () => {
    const powers = [
      { cost: 3, active: true, reaction: 2, initiativeDice: 1 },
      { cost: 0.5, active: true, attributes: { strength: 1 }, impact: 2 },
      { cost: 1, active: true, skill: 'Unarmed Combat', skillDice: 2 },
      { cost: 1, active: false, reaction: 9, skill: 'Unarmed Combat', skillDice: 5, impact: 5 },
    ];
    const b = sumBonuses(adeptAugmentations(powers));
    assert.equal(b.reaction, 2);
    assert.equal(b.initiativeDice, 1);
    assert.equal(b.attributes.strength, 1);
    assert.deepEqual(adeptPowerPoints(powers, 6), { spent: 5.5, available: 6 });
    assert.equal(adeptSkillDice(powers, 'unarmed combat'), 2);
    assert.equal(adeptArmor(powers, 'impact'), 2);
  });
});

import { initiateMagic, shieldingDice, centeringModifiers, resolveDispel, areaTargetNumber, resolveBarrier } from '../arcana.ts';

describe('initiation, metamagic, area effects and barriers', () => {
  test('aspected traditions', () => {
    assert.match(traditionBlocks('sorcerer', 'conjure') ?? '', /sorcerers cannot summon/);
    assert.equal(traditionBlocks('sorcerer', 'cast'), null);
    assert.match(traditionBlocks('conjurer', 'cast') ?? '', /conjurers cannot cast/);
  });
  test('initiation raises Magic by grade; mundanes stay 0', () => {
    assert.equal(initiateMagic(6, 2), 8);
    assert.equal(initiateMagic(0, 3), 0);
  });
  test('quickened spells carry no penalty', () => {
    assert.deepEqual(sustainingModifiers([{ spellName: 'Armor', force: 4, category: '', focusId: '', quickened: true }]), []);
  });
  test('shielding and centering', () => {
    assert.equal(shieldingDice(2, ['shielding']), 2);
    assert.equal(shieldingDice(2, []), 0);
    const pen = [{ label: 'Wounds (physical)', value: 2 }, { label: 'Sustaining 1 spell', value: 2 }, { label: 'Other', value: 3 }];
    assert.deepEqual(centeringModifiers(3, ['centering'], pen), [{ label: 'Centering', value: -3 }]);
    assert.deepEqual(centeringModifiers(9, ['centering'], pen), [{ label: 'Centering', value: -4 }]);
    assert.deepEqual(centeringModifiers(3, [], pen), []);
  });
  test('dispelling wears down successes', () => {
    assert.deepEqual(resolveDispel(3, 1), { remaining: 2, dispelled: false });
    assert.deepEqual(resolveDispel(3, 5), { remaining: 0, dispelled: true });
  });
  test('area TN is the highest target attribute', () => {
    assert.equal(areaTargetNumber([3, 5, 4]), 5);
  });
  test('barriers lose rating per net success', () => {
    assert.deepEqual(resolveBarrier({ attackerSuccesses: 4, barrierSuccesses: 1, rating: 6 }), { netSuccesses: 3, rating: 3, breached: false });
    assert.deepEqual(resolveBarrier({ attackerSuccesses: 1, barrierSuccesses: 2, rating: 6 }), { netSuccesses: 0, rating: 6, breached: false });
    assert.equal(resolveBarrier({ attackerSuccesses: 8, barrierSuccesses: 0, rating: 4 }).breached, true);
  });
});
