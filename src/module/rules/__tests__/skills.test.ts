import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { skillTestDice, splitSpecialization, specializationMatches } from '../skills.ts';

describe('skillTestDice', () => {
  test('rated skill uses its rating', () => {
    assert.deepEqual(skillTestDice({ rating: 4, attributeRating: 6 }), { dice: 4, modifier: null, using: 'skill' });
  });
  test('specialization replaces the rating when used and present', () => {
    assert.deepEqual(skillTestDice({ rating: 4, specializationRating: 6, useSpecialization: true, attributeRating: 6 }),
      { dice: 6, modifier: null, using: 'specialization' });
    assert.equal(skillTestDice({ rating: 4, specializationRating: 6, useSpecialization: false, attributeRating: 6 }).dice, 4);
    assert.equal(skillTestDice({ rating: 4, specializationRating: 0, useSpecialization: true, attributeRating: 6 }).using, 'skill');
  });
  test('unskilled defaults to a related skill at +2', () => {
    const r = skillTestDice({ rating: 0, attributeRating: 6, related: { name: 'Firearms', rating: 5 } });
    assert.deepEqual(r, { dice: 5, modifier: { label: 'Defaulting to Firearms', value: 2 }, using: 'related' });
  });
  test('unskilled with no usable related skill defaults to the attribute at +4', () => {
    assert.deepEqual(skillTestDice({ rating: 0, attributeRating: 5, related: { name: 'X', rating: 0 } }),
      { dice: 5, modifier: { label: 'Defaulting to attribute', value: 4 }, using: 'attribute' });
    assert.equal(skillTestDice({ rating: 0, attributeRating: 5, related: null }).using, 'attribute');
  });
  test('a related skill is ignored when the character has the skill', () => {
    assert.equal(skillTestDice({ rating: 3, attributeRating: 5, related: { name: 'X', rating: 6 } }).dice, 3);
  });
});

describe('specialization helpers', () => {
  test('split name and rating', () => {
    assert.deepEqual(splitSpecialization('Martial Arts 6'), { name: 'Martial Arts', rating: 6 });
    assert.deepEqual(splitSpecialization('Corporate'), { name: 'Corporate', rating: 0 });
  });
  test('matching ignores case and spacing; empty never matches', () => {
    assert.equal(specializationMatches('Pistols', ' pistols '), true);
    assert.equal(specializationMatches('Heavy  Pistols', 'heavy pistols'), true);
    assert.equal(specializationMatches('Pistols', 'Rifles'), false);
    assert.equal(specializationMatches('', ''), false);
  });
});
