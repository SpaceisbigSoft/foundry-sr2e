import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import {
  RULES, aimCap, multipleTargetModifier, reloadAmount, weaponArmorKind, shotgunTnModifier,
  combinedBlastPower, holdOutcome, stimEffect, tranqBoxes, antidoteEffect, surgicalTrauma,
} from '../index.ts';

const R = RULES as any;

describe('v0.55.0 Take Aim', () => {
  test('the cap is half the skill, at least 1', () => {
    assert.equal(aimCap(6), 3);
    assert.equal(aimCap(1), 1);
    assert.equal(aimCap(0), 1);
    R.COMBAT.aim.max = 2;
    try { assert.equal(aimCap(8), 2); } finally { R.COMBAT.aim.max = 0; }
  });
});

describe('v0.55.0 several targets in one phase', () => {
  test('+2 per different target shot at earlier this phase', () => {
    assert.deepEqual(multipleTargetModifier([], 'A'), []);
    assert.deepEqual(multipleTargetModifier(['A'], 'A'), []);
    assert.deepEqual(multipleTargetModifier(['A', 'B', 'B'], 'C'), [{ label: 'Another target this phase (2)', value: 4 }]);
  });
});

describe('v0.55.0 reloading by feed', () => {
  test('a clip or belt fills it; others a few rounds per action', () => {
    assert.equal(reloadAmount('clip', 3, 15), 12);
    assert.equal(reloadAmount('belt', 0, 50), 50);
    assert.equal(reloadAmount('cylinder', 0, 6), 2);
    assert.equal(reloadAmount('cylinder', 5, 6), 1);
    assert.equal(reloadAmount('break', 2, 2), 0);
  });
});

describe('v0.55.0 armor kind per weapon', () => {
  test('own setting, melee impact, thrown and bows by house rule, else ballistic', () => {
    assert.equal(weaponArmorKind({ armorKind: 'impact' }), 'impact');
    assert.equal(weaponArmorKind({ melee: true }), 'impact');
    assert.equal(weaponArmorKind({ skill: 'Throwing Weapons' }), 'impact');
    assert.equal(weaponArmorKind({ skill: 'Projectile Weapons', name: 'Ranger X bow' }), 'ballistic');
    assert.equal(weaponArmorKind({ skill: 'Pistols' }), 'ballistic');
    R.COMBAT.armorFor.bow = 'impact';
    try { assert.equal(weaponArmorKind({ name: 'Crossbow' }), 'impact'); } finally { R.COMBAT.armorFor.bow = 'ballistic'; }
  });
});

describe('v0.55.0 shotgun TN, combined blasts, holds', () => {
  test('shotgun TN is off by default', () => {
    assert.deepEqual(shotgunTnModifier(3), []);
    R.COMBAT.shotgunTnPerMetre = -1;
    try { assert.deepEqual(shotgunTnModifier(2), [{ label: 'Shotgun spread', value: -2 }]); } finally { R.COMBAT.shotgunTnPerMetre = 0; }
  });
  test('combined blasts: strongest + half of the rest', () => {
    assert.equal(combinedBlastPower([10, 8]), 14);
    assert.equal(combinedBlastPower([6, 12, 5]), 12 + 3 + 2);
    assert.equal(combinedBlastPower([]), 0);
  });
  test('holds: more successes pins, ties go free', () => {
    assert.equal(holdOutcome(3, 2), 'held');
    assert.equal(holdOutcome(2, 2), 'free');
  });
});

describe('v0.55.0 slap patches and surgical trauma', () => {
  test('stim: off now, back later with interest', () => {
    // No minutes rolled: rating hours (the old way; v0.78.0's book rule passes the 2D6 minutes).
    assert.deepEqual(stimEffect(5, 3), { off: 3, backHours: 3, backSeconds: 10800, back: 4 });
    assert.deepEqual(stimEffect(0, 3), { off: 0, backHours: 3, backSeconds: 10800, back: 0 });
  });
  test('tranq and antidote', () => {
    assert.equal(tranqBoxes(6, 2), 4);
    assert.equal(tranqBoxes(3, 5), 0);
    assert.deepEqual(antidoteEffect(4), { dice: 4, hours: 4 });
  });
  test('surgical trauma by size, off by default', () => {
    assert.equal(surgicalTrauma(2), null);
    R.BIOWARE.surgery.trauma.enabled = true;
    try {
      assert.deepEqual(surgicalTrauma(0.3), { level: 'L', type: 'physical' });
      assert.deepEqual(surgicalTrauma(1), { level: 'M', type: 'physical' });
      assert.deepEqual(surgicalTrauma(5), { level: 'D', type: 'physical' });
      assert.equal(surgicalTrauma(0), null);
    } finally { R.BIOWARE.surgery.trauma.enabled = false; }
  });
});
