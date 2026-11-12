import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, stageForNetSuccesses, initiativeWoundPenalty, midTurnWoundDrop, wareCost, cyberCost, bioCost, totalEssenceLoss } from '../index.ts';

const R = RULES as any;

describe('v0.54.0 damage staging house rule', () => {
  test("'afterFirst' (the v0.92.2 default) keeps the old behaviour", () => {
    assert.equal(RULES.ATTACK_STAGING, 'all');                         // v0.92.3: the book's way is the default (Core p. 91)
    R.ATTACK_STAGING = 'afterFirst';
    try {
      assert.equal(stageForNetSuccesses('M', 2), 'M');
      assert.equal(stageForNetSuccesses('M', 3), 'S');
    } finally { R.ATTACK_STAGING = 'all'; }
  });
  test("'all': every 2 net successes stage up", () => {
    R.ATTACK_STAGING = 'all';
    try {
      assert.equal(stageForNetSuccesses('M', 1), 'M');
      assert.equal(stageForNetSuccesses('M', 2), 'S');
      assert.equal(stageForNetSuccesses('M', 4), 'D');
      assert.equal(stageForNetSuccesses('L', 3), 'M');
    } finally { R.ATTACK_STAGING = 'all'; }
  });
});

describe('v0.54.0 wounds lower Initiative', () => {
  test('the penalty is the wound modifier', () => {
    assert.equal(initiativeWoundPenalty(0), 0);
    assert.equal(initiativeWoundPenalty(2), 2);
    assert.equal(initiativeWoundPenalty(-1), 0);
  });
  test('mid-turn: only a rise lowers the score; off switches', () => {
    R.INITIATIVE_WOUNDS.midTurn = true;                                // v0.92.3: off by default (Core p. 112); the house rule on
    assert.equal(midTurnWoundDrop(1, 3), 2);
    assert.equal(midTurnWoundDrop(3, 1), 0);
    assert.equal(midTurnWoundDrop(2, 2), 0);
    R.INITIATIVE_WOUNDS.midTurn = false;
    try { assert.equal(midTurnWoundDrop(0, 3), 0); } finally { R.INITIATIVE_WOUNDS.midTurn = false; }
    R.INITIATIVE_WOUNDS.enabled = false;
    try { assert.equal(initiativeWoundPenalty(3), 0); assert.equal(midTurnWoundDrop(0, 3), 0); } finally { R.INITIATIVE_WOUNDS.enabled = true; }
  });
});

describe('v0.54.0 one price for ware', () => {
  test('cyberware by grade, bioware by cultured (no grade)', () => {
    assert.equal(wareCost({ cost: 1000, grade: 'alpha' }), cyberCost(1000, 'alpha'));
    assert.equal(wareCost({ cost: 1000, grade: 'alpha', bioware: true }), bioCost(1000, false));
    assert.equal(wareCost({ cost: 1000, bioware: true, cultured: true }), bioCost(1000, true));
    assert.equal(wareCost({}), 0);
  });
});

describe('v0.54.0 Essence goes at implant', () => {
  test('an item still healing in counts its Essence, not its bonuses', () => {
    const items = [
      { essenceCost: 1, grade: 'standard' as const, installed: false, essenceCounted: true },
      { essenceCost: 0.5, grade: 'standard' as const, installed: true },
      { essenceCost: 2, grade: 'standard' as const, installed: false },
    ];
    assert.equal(totalEssenceLoss(items), 1.5);
  });
});

describe('v0.54.0 which spells an elemental serves', async () => {
  const { elementalServes, elementalServesLabel } = await import('../index.ts');
  test("'category' (default): fire combat, water illusion, air detection, earth manipulation", () => {
    assert.equal(RULES.MAGIC_EXTRA.elementalMatch, 'category');
    assert.equal(elementalServes('Fire', { category: 'combat', element: 'cold' }), true);
    assert.equal(elementalServes('water', { category: 'combat', element: 'water' }), false);
    assert.equal(elementalServes('earth', { category: 'manipulation' }), true);
    assert.equal(elementalServes('lightning', { category: 'combat' }), false);
    assert.equal(elementalServesLabel('air'), 'detection spells');
  });
  test("'element' and 'any'", () => {
    R.MAGIC_EXTRA.elementalMatch = 'element';
    try { assert.equal(elementalServes('fire', { element: 'fire', category: 'illusion' }), true); assert.equal(elementalServes('fire', { element: 'cold' }), false); }
    finally { R.MAGIC_EXTRA.elementalMatch = 'category'; }
    R.MAGIC_EXTRA.elementalMatch = 'any';
    try { assert.equal(elementalServes('', {}), true); } finally { R.MAGIC_EXTRA.elementalMatch = 'category'; }
  });
});
