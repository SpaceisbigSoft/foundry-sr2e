import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { reaction, combatPool, spellPool, deriveStats } from '../stats.ts';
import { rollInitiative } from '../initiative.ts';
import { woundTnModifiers } from '../modifiers.ts';
import { scripted } from './helpers.ts';

describe('derived stats', () => {
  test('reaction rounds down and adds bonus', () => {
    assert.equal(reaction({ quickness: 5, intelligence: 4 }), 4);
    assert.equal(reaction({ quickness: 5, intelligence: 4 }, 2), 6);
  });
  test('combat pool', () => {
    assert.equal(combatPool({ quickness: 5, intelligence: 4, willpower: 3 }), 6);
  });
  test('spell pool is zero for the mundane', () => {
    assert.equal(spellPool({ intelligence: 5, willpower: 5 }, 0), 0);
    assert.equal(spellPool({ intelligence: 5, willpower: 4 }, 6), 5);
  });
  test('deriveStats bundles them', () => {
    const d = deriveStats({ body: 4, quickness: 6, strength: 3, charisma: 3, intelligence: 4, willpower: 4 }, { magic: 6 });
    assert.deepEqual(d, { reaction: 5, combatPool: 7, spellPool: 4 });
  });
});

describe('initiative', () => {
  test('reaction plus 1d6 by default', async () => {
    const r = await rollInitiative({ reaction: 5, roll: scripted([4]) });
    assert.equal(r.score, 9);
  });
  test('bonus dice from cyberware', async () => {
    const r = await rollInitiative({ reaction: 7, bonusDice: 2, roll: scripted([3, 6, 2]) });
    assert.equal(r.score, 18);
  });
});

describe('modifier helpers', () => {
  test('wound TN modifier is empty when healthy', () => {
    assert.deepEqual(woundTnModifiers({ physical: 0, stun: 0 }), []);
    assert.deepEqual(woundTnModifiers({ physical: 3, stun: 0 }), [{ id: 'wounds', label: 'Wounds', value: 2 }]);
  });
});
