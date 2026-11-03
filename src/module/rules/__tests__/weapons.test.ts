import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import {
  effectiveStrength, weaponPower, weaponRange, damageLabel, unarmedWeapon, heavyRecoil, ammoType, ammoDamage, armorAfterAmmo,
  calledShotDamage, blastPower, blastRadius, scatter, shotgunSpread, splitRounds, spreadFireModifiers, reachModifiers,
  resolveMelee, attackerReachModifiers, lightFromDarkness,
  scatterDiceFor, scatterMetres, confinedBlast, grenadeKind, blastFalloff, inShotgunCone, wastedRounds, brighter, lightFromSource,
  smokeModifier, proneModifiers, friendsModifiers, chargeModifiers, encumbrancePenalty, gyroOffset, barrierArmor, visibilityModifier, coverFromSightLines, movementState, knockdownTriggered, bodyIndex,
} from '../weapons.ts';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';

const base = { melee: true, damagePower: 2, damageLevel: 'M' as const, range: { short: 5, medium: 20, long: 40, extreme: 60 } };

describe('weapons', () => {
  test('Strength-based Power, with a bow cap', () => {
    assert.equal(effectiveStrength(6, 0), 6);
    assert.equal(effectiveStrength(6, 4), 4);
    assert.equal(weaponPower({ ...base, strengthPower: true }, 5), 7);
    assert.equal(weaponPower({ ...base, strengthPower: true, strengthCap: 3 }, 5), 5);
    assert.equal(weaponPower(base, 5), 2);
    assert.equal(damageLabel({ strengthPower: true, damagePower: 2, damageLevel: 'M' }), '(STR+2)M');
    assert.equal(damageLabel({ strengthPower: true, damagePower: 0, damageLevel: 'L' }), '(STR)L');
    assert.equal(damageLabel({ strengthPower: false, damagePower: 9, damageLevel: 'M' }), '9M');
  });

  test('thrown ranges are multiples of Strength; fixed ranges stay', () => {
    assert.deepEqual(weaponRange({ ...base, strengthRange: true }, 4), { short: 4, medium: 8, long: 12, extreme: 20 });
    assert.deepEqual(weaponRange({ ...base, strengthRange: true, strengthCap: 2, strengthRangeMultipliers: { short: 5, medium: 10, long: 15, extreme: 20 } }, 6), { short: 10, medium: 20, long: 30, extreme: 40 });
    assert.deepEqual(weaponRange(base, 4), base.range);
  });

  test('unarmed is Strength M stun, Unarmed Combat', () => {
    const u = unarmedWeapon();
    assert.equal(u.skill, 'Unarmed Combat');
    assert.equal(weaponPower(u, 4), 4);
    assert.equal(u.damageType, 'stun');
  });

  test('heavy weapons double recoil', () => {
    assert.equal(heavyRecoil(3, true), 6);
    assert.equal(heavyRecoil(3, false), 3);
  });

  test('ammunition: APDS halves armor, explosive adds Power, flechette stages up, gel is stun vs impact', () => {
    assert.equal(ammoType('nope').id, 'standard');
    assert.equal(armorAfterAmmo(5, ammoType('apds').armorMultiplier), 2);
    assert.deepEqual(ammoDamage(9, 'M', 'exex'), { power: 11, level: 'M' });
    assert.deepEqual(ammoDamage(9, 'M', 'flechette'), { power: 9, level: 'S' });
    assert.equal(ammoType('gel').damageType, 'stun');
    assert.equal(ammoType('gel').armorKind, 'impact');
    assert.deepEqual(ammoDamage(1, 'L', 'gel'), { power: 0, level: 'L' });
  });

  test('called shots stage damage or ignore armor', () => {
    assert.deepEqual(calledShotDamage('M', 'damage'), { level: 'S', ignoreArmor: false });
    assert.deepEqual(calledShotDamage('M', 'armor'), { level: 'M', ignoreArmor: true });
    assert.deepEqual(calledShotDamage('M', 'none'), { level: 'M', ignoreArmor: false });
  });

  test('blast Power falls off per metre; radius is the last metre with Power left', () => {
    assert.equal(blastPower(10, 0), 10);
    assert.equal(blastPower(10, 3.7), 7);
    assert.equal(blastRadius(10), 9);
    assert.deepEqual(scatter([4], 3), { metres: 4, angleDeg: 120 });
  });

  test('shotgun spread widens with distance and costs Power per full metre', () => {
    assert.deepEqual(shotgunSpread(20, 5, 10), { width: 4, power: 6, loss: 4 });
    assert.deepEqual(shotgunSpread(3, 5, 10), { width: 0.6, power: 10, loss: 0 });
  });

  test('full-auto rounds split evenly; extra targets add the configured TN', () => {
    assert.deepEqual(splitRounds(10, 3), [4, 3, 3]);
    assert.deepEqual(splitRounds(6, 1), [6]);
    assert.deepEqual(spreadFireModifiers(2), RULES.COMBAT.spreadFire.extraTargetTn ? [{ label: 'Spread over 3 targets', value: 2 * RULES.COMBAT.spreadFire.extraTargetTn }] : []);
  });

  test('v0.79.0 reach: the shorter side +1 per point on its own roll', () => {
    assert.deepEqual(reachModifiers(2, 0), [{ label: "Opponent's reach +2", value: 2 }]);
    assert.deepEqual(reachModifiers(0, 1), [{ label: 'Reach +1', value: -1 }]);
    assert.deepEqual(attackerReachModifiers(0, 1), [{ label: "Opponent's reach +1", value: 1 }]);
    assert.deepEqual(attackerReachModifiers(2, 0), [{ label: 'Reach +2', value: -2 }]);
  });

  test('reach: the side with the longer weapon gets the TN bonus on its own roll', (t) => {
    t.after(oldWay({ 'DOCS_V79.meleeReachShorter': 'longer' })); // v0.79.0: the old way (a house rule)
    assert.deepEqual(reachModifiers(2, 0), []);
    assert.deepEqual(reachModifiers(0, 1), [{ label: 'Reach +1', value: -1 }]);
    assert.deepEqual(reachModifiers(1, 1), []);
    assert.deepEqual(attackerReachModifiers(2, 0), [{ label: 'Reach +2', value: -2 }]);
    assert.deepEqual(attackerReachModifiers(0, 1), []);
  });

  test('opposed melee: more successes wins; a winning defender counterattacks; ties hurt nobody', () => {
    const attacker = { power: 6, level: 'M' as const };
    const defender = { power: 4, level: 'L' as const };
    assert.deepEqual(resolveMelee({ attackerSuccesses: 4, defenderSuccesses: 1, attacker, defender }), { winner: 'attacker', net: 3, power: 6, level: 'S' });
    assert.deepEqual(resolveMelee({ attackerSuccesses: 1, defenderSuccesses: 2, attacker, defender }), { winner: 'defender', net: 1, power: 4, level: 'L' });
    assert.equal(resolveMelee({ attackerSuccesses: 2, defenderSuccesses: 2, attacker, defender }).winner, 'none');
    assert.equal(resolveMelee({ attackerSuccesses: 0, defenderSuccesses: 2, attacker, defender: null }).winner, 'none');
  });

  test('scene light and vision', () => {
    assert.equal(lightFromDarkness(0), 'normal');
    assert.equal(lightFromDarkness(0.4), 'partial');
    assert.equal(lightFromDarkness(0.7), 'minimal');
    assert.equal(lightFromDarkness(1), 'darkness');
    assert.deepEqual(visibilityModifier('darkness'), { value: 8, using: 'normal' });
    assert.deepEqual(visibilityModifier('darkness', { lowLight: true, thermographic: true }), { value: 4, using: 'thermographic' });
    assert.deepEqual(visibilityModifier('partial', { lowLight: true, lowLightNatural: true }), { value: 0, using: 'lowLight' });
    // v0.79.0: cybernetic low-light in partial light +1 (RULES.DOCS_V79.visionCyberNatural).
    assert.deepEqual(visibilityModifier('partial', { lowLight: true }), { value: 1, using: 'lowLight' });
  });

  test('cover from blocked sight lines', () => {
    assert.equal(coverFromSightLines(0, 5), 'none');
    assert.equal(coverFromSightLines(2, 5), 'partial');
    assert.equal(coverFromSightLines(5, 5), 'blind');
  });

  test('movement: walking up to Quickness metres, running beyond', () => {
    assert.equal(movementState(0, 4), 'none');
    assert.equal(movementState(3, 4), 'walking');
    assert.equal(movementState(9, 4), 'running');
  });

  test('knockdown when Power exceeds Body and damage was taken', () => {
    assert.equal(knockdownTriggered({ power: 9, body: 4, level: 'L' }), true);
    assert.equal(knockdownTriggered({ power: 4, body: 4, level: 'S' }), false);
    assert.equal(knockdownTriggered({ power: 9, body: 4, level: null }), false);
  });

  test('bioware Body Index against natural Body, with Magic cost', () => {
    const r = bodyIndex([{ bioware: true, installed: true, bodyIndex: 1.4 }, { bioware: true, installed: true, bodyIndex: 1 }, { bioware: true, installed: false, bodyIndex: 5 }, { installed: true, bodyIndex: 9 }], { body: 2, essence: 6 });
    assert.deepEqual(r, { used: 2.4, max: 2, over: true, magicLoss: 1 });
  });

  test('scatter: dice by range, less 2 m per success', () => {
    assert.equal(scatterDiceFor('medium'), 2);
    assert.equal(scatterDiceFor(undefined), 1);
    assert.equal(scatterMetres([3, 4], 2), 3);
    assert.equal(scatterMetres([2], 3), 0);
  });

  test('confined blasts reflect off nearby walls', () => {
    const open8 = Array(8).fill(Infinity);
    assert.deepEqual(confinedBlast(10, 1, open8), { confined: false, bonus: 0 });
    assert.deepEqual(confinedBlast(10, 1, [2, 2, 3, 3, 4, 4, Infinity, Infinity]), { confined: true, bonus: 4 });   // Power 8 at 2 m, half
  });

  test('grenade kinds', () => {
    assert.equal(blastFalloff('defensive', 3), 2); // v0.77.0: −1 per 0.5 m
    assert.equal(blastFalloff('custom', 3), 3);
    assert.equal(grenadeKind('concussion').damageType, 'stun');
    assert.equal(grenadeKind('flash').effect, 'blind');
  });

  test('shotgun cone widens with distance along the line', () => {
    assert.equal(inShotgunCone({ along: 10, perpendicular: 1, targetDistance: 10, choke: 4 }), true);    // half spread 1.25
    assert.equal(inShotgunCone({ along: 10, perpendicular: 2, targetDistance: 10, choke: 4 }), false);
    assert.equal(inShotgunCone({ along: 2, perpendicular: 1, targetDistance: 10, choke: 4 }), false);
    assert.equal(inShotgunCone({ along: 14, perpendicular: 0, targetDistance: 10, choke: 4 }), false);   // beyond the target
  });

  test('walking fire wastes a round per metre between targets', () => {
    assert.equal(wastedRounds([2.5, 1.2]), 3);
  });

  test('light sources and smoke', () => {
    assert.equal(brighter('darkness', 'partial'), 'partial');
    assert.equal(lightFromSource(true, true), 'normal');
    assert.equal(lightFromSource(false, true), 'partial');
    assert.equal(lightFromSource(false, false), null);
    assert.deepEqual(smokeModifier('smoke', { thermographic: true }), { value: 0, using: 'thermographic' });
    assert.deepEqual(smokeModifier('thermal', { thermographic: true }), { value: 4, using: 'normal' });
  });

  test('prone, friends in melee, charging', () => {
    assert.deepEqual(proneModifiers({ melee: true, targetProne: true, attackerProne: false }), [{ id: 'targetProne', label: 'Target prone', value: -2 }]);
    assert.deepEqual(proneModifiers({ melee: false, targetProne: false, attackerProne: true }), [{ id: 'attackerProne', label: 'Attacker prone', value: -1 }]);
    assert.deepEqual(friendsModifiers(2), [{ label: 'Friends in melee (2)', value: -2 }]);
    assert.deepEqual(friendsModifiers(9)[0]!.value, -4);
    assert.deepEqual(chargeModifiers(true), [{ label: 'Charging', value: -1 }]);
  });

  test('armor encumbrance, gyro mounts, barriers', () => {
    assert.equal(encumbrancePenalty(6, 4, 4), 2);
    assert.equal(encumbrancePenalty(3, 2, 4), 0);
    assert.deepEqual(gyroOffset({ recoil: 3, movement: 4, gyro: 5 }), { recoil: 0, movement: 2, used: 5 });
    assert.deepEqual(gyroOffset({ recoil: 0, movement: 0, gyro: 3 }), { recoil: 0, movement: 0, used: 0 });
    assert.equal(barrierArmor([4, 6]), 10);
  });
});
