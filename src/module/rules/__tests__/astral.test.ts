import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { astrallyActive, astralForm, perceivingModifiers } from '../astral.ts';

const A = { body: 5, quickness: 6, strength: 4, charisma: 3, intelligence: 5, willpower: 4 };

describe('astral rules', () => {
  test('who is astrally active', () => {
    assert.equal(astrallyActive('physical', false), false);
    assert.equal(astrallyActive(undefined, false), false);
    assert.equal(astrallyActive('perceiving', false), true);
    assert.equal(astrallyActive('projecting', false), true);
    assert.equal(astrallyActive('physical', true), true);
  });
  test('astral form stats and initiative', () => {
    assert.deepEqual(astralForm(A), { body: 4, quickness: 5, strength: 3, reaction: 5, initiativeBase: 25, initiativeDice: 1 });
  });
  test('perceiving penalizes physical attacks', () => {
    assert.deepEqual(perceivingModifiers('perceiving'), [{ id: 'astralPerception', label: 'Astral perception', value: 2 }]);
    assert.deepEqual(perceivingModifiers('projecting'), []);
    assert.deepEqual(perceivingModifiers('physical'), []);
  });
});
