import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import { essenceLoss, totalEssenceLoss, currentEssence, effectiveMagic, sumBonuses, type Augmentation } from '../cyberware.ts';

const aug = (over: Partial<Augmentation> = {}): Augmentation => ({ essenceCost: 1, grade: 'standard', installed: true, ...over });

describe('essence', () => {
  test('grade multipliers reduce the cost', () => {
    assert.equal(essenceLoss({ essenceCost: 2, grade: 'standard' }), 2);
    assert.equal(essenceLoss({ essenceCost: 2, grade: 'alpha' }), 1.6);
    assert.equal(essenceLoss({ essenceCost: 2, grade: 'beta' }), 1.4);
    assert.equal(essenceLoss({ essenceCost: 2, grade: 'delta' }), 1);
  });
  test('no floating point noise when summing', () => {
    const items = [aug({ essenceCost: 0.1 }), aug({ essenceCost: 0.2 }), aug({ essenceCost: 0.3 })];
    assert.equal(totalEssenceLoss(items), 0.6);
    assert.equal(currentEssence(6, items), 5.4);
  });
  test('uninstalled items cost nothing', () => {
    assert.equal(totalEssenceLoss([aug({ essenceCost: 3, installed: false }), aug({ essenceCost: 1 })]), 1);
  });
  test('negative costs are ignored and essence never goes below zero', () => {
    assert.equal(essenceLoss({ essenceCost: -2, grade: 'standard' }), 0);
    assert.equal(currentEssence(6, [aug({ essenceCost: 9 })]), 0);
  });
});

describe('magic', () => {
  test('capped by current Essence rounded up', (t) => {
    // v0.92.3: the v0.92.2 rule (RULES.SORCERY_V923.magicFromEssence); the book's way is in v0923-sorcery.test.ts.
    t.after(oldWay({ 'SORCERY_V923.magicFromEssence': 'v922' }));
    assert.equal(effectiveMagic(6, 6), 6);
    assert.equal(effectiveMagic(6, 5.4), 6);   // ceil(5.4) = 6
    assert.equal(effectiveMagic(6, 4.9), 5);
    assert.equal(effectiveMagic(3, 4.9), 3);   // already below the cap
    assert.equal(effectiveMagic(6, 0), 0);
  });
  test('mundane characters stay at zero', () => {
    assert.equal(effectiveMagic(0, 6), 0);
  });
});

describe('sumBonuses', () => {
  test('adds installed bonuses and skips uninstalled ones', () => {
    const b = sumBonuses([
      aug({ attributes: { body: 1, strength: 2 }, reaction: 2, initiativeDice: 1 }),
      aug({ attributes: { body: 2 }, reaction: 1 }),
      aug({ attributes: { body: 9 }, reaction: 9, initiativeDice: 9, installed: false }),
    ]);
    assert.equal(b.attributes.body, 3);
    assert.equal(b.attributes.strength, 2);
    assert.equal(b.attributes.quickness, 0);
    assert.equal(b.reaction, 3);
    assert.equal(b.initiativeDice, 1);
  });
  test('empty list is all zeros', () => {
    const b = sumBonuses([]);
    assert.equal(b.reaction, 0);
    assert.equal(b.initiativeDice, 0);
    assert.equal(Object.values(b.attributes).every((v) => v === 0), true);
  });
});
