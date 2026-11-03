import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, meleeDefaultAttribute, scatterDirection, groupSearchModifiers, laserInRange, withScopeVision,
  objectResistanceTn, objectSpellPower, chargeDisarmTn, rangedShieldDice, confinedBlast,
} from '../index.ts';

const withRule = (obj: any, key: string, value: unknown, fn: () => void) => { const old = obj[key]; obj[key] = value; try { fn(); } finally { obj[key] = old; } };

describe('v0.47.0 combat', () => {
  test('melee defaults to the linked attribute, or a fixed one by house rule', () => {
    assert.equal(meleeDefaultAttribute('Edged Weapons'), 'strength');
    assert.equal(meleeDefaultAttribute('Unarmed Combat'), 'strength');
    assert.equal(meleeDefaultAttribute('Edged Weapons', 'quickness'), 'quickness');
    withRule(RULES.COMBAT.melee, 'defaultAttribute', 'quickness', () => assert.equal(meleeDefaultAttribute('Edged Weapons'), 'quickness'));
    withRule(RULES.COMBAT.melee, 'defaultAttribute', 'strength', () => assert.equal(meleeDefaultAttribute('Anything'), 'strength'));
  });
  test('scatter reads along the throw, or by compass with no throw line', () => {
    assert.deepEqual(scatterDirection(1, 90), { angleDeg: 90, label: 'beyond the target', along: true });
    assert.deepEqual(scatterDirection(4, 90), { angleDeg: 270, label: 'short of the target', along: true });
    assert.deepEqual(scatterDirection(2, 330), { angleDeg: 30, label: 'beyond and to the right', along: true });
    assert.deepEqual(scatterDirection(1, null), { angleDeg: 0, label: 'north' });
    assert.deepEqual(scatterDirection(9, null), { angleDeg: 300, label: 'north-west' });
    withRule(RULES.COMBAT.scatter, 'diagram', 'compass', () => assert.deepEqual(scatterDirection(3, 90), { angleDeg: 120, label: 'south-east' }));
  });
  test('confined blasts: off, nearest wall, or the average', () => {
    const walls = [1, 1, 1, 1, 1, 5, 9, 9];
    const near = confinedBlast(10, 1, walls);
    assert.ok(near.confined);
    assert.equal(near.bonus, Math.floor((10 - 1) * 0.5));
    withRule(RULES.COMBAT.confined, 'mode', 'average', () => {
      const avg = confinedBlast(10, 1, walls);
      assert.ok(avg.bonus < near.bonus);
    });
    withRule(RULES.COMBAT.confined, 'enabled', false, () => assert.deepEqual(confinedBlast(10, 1, walls), { confined: false, bonus: 0 }));
    withRule(RULES.COMBAT.confined, 'rays', 8, () => assert.equal(confinedBlast(10, 1, walls).confined, true));
    withRule(RULES.COMBAT.confined, 'rays', 9, () => assert.equal(confinedBlast(10, 1, walls).confined, false));
  });
});

describe('v0.47.0 gear', () => {
  test('group searches add TN per extra person', () => {
    assert.deepEqual(groupSearchModifiers(1), []);
    assert.deepEqual(groupSearchModifiers(3), [{ label: 'Searching 3 people at once', value: 2 }]);
  });
  test('laser range and scope vision', () => {
    assert.ok(laserInRange(null) && laserInRange(50) && !laserInRange(51));
    withRule(RULES.GEAR.accessories, 'laserRangeMetres', 0, () => assert.ok(laserInRange(500)));
    const v = { lowLight: false, thermographic: false, ultrasound: false };
    assert.deepEqual(withScopeVision(v, 'thermographic'), { ...v, thermographic: true });
    assert.deepEqual(withScopeVision(v, 'lowLight'), { ...v, lowLight: true });
    assert.equal(withScopeVision(v, ''), v);
    withRule(RULES.GEAR.accessories, 'scopeVision', false, () => assert.equal(withScopeVision(v, 'lowLight'), v));
  });
  test('spells against objects: TN by kind; a wall takes Force + successes', () => {
    assert.equal(objectResistanceTn('natural'), 3);
    assert.equal(objectResistanceTn('processed'), 10);
    assert.equal(objectResistanceTn('nonsense'), 5);
    assert.equal(objectSpellPower(6, 3), 9);
    assert.equal(objectSpellPower(6, -1), 6);
  });
  test('disarming a charge: base TN plus the setter\'s successes', () => {
    assert.equal(chargeDisarmTn(0), 4);
    assert.equal(chargeDisarmTn(3), 7);
  });
  test('shields add their Parry to a ranged dodge, or not', () => {
    assert.equal(rangedShieldDice(2), 2);
    withRule(RULES.GEAR.shields, 'ranged', 'off', () => assert.equal(rangedShieldDice(2), 0));
  });
});
