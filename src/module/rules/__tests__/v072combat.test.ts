import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { COMBAT_V72 } from '../config72/combat.ts';
import {
  blastThroughWalls, crossingFraction,
  aimHeld, aimModifierV72, nextAimV72, aimRating, aimRatingForWeapon,
  immunityStops, armorFromParts, smokeCounts, sightSmoke,
  ammoTable, findAmmo, isKnownAmmo, ammoDamageFrom, ammoExtras, ammoChoices,
  canFireIndirect, indirectFire, indirectScatterDice, indirectScatterMetres, nextAdjust,
} from '../fieldsfire.ts';

const V = COMBAT_V72 as any;
/** Change one switch for the length of a test (path inside COMBAT_V72). */
const withRule = (path: string, value: unknown, fn: () => void) => {
  const keys = path.split('.');
  const last = keys.pop()!;
  const o = keys.reduce((x, k) => x[k], V);
  const old = o[last];
  o[last] = value;
  try { fn(); } finally { o[last] = old; }
};

describe('v0.72.0 O1: blasts through barriers', () => {
  test('rating: a weak wall takes its rating off the Power beyond it', () => {
    const r = blastThroughWalls({ power: 10, perMetre: 1, walls: [{ metres: 2.5, rating: 2 }] });
    assert.equal(r.blocked, false);
    assert.equal(r.loss, 2);
    assert.equal(r.walls[0]!.powerAt, 8);
    assert.match(r.note, /−2 Power/);
  });
  test('rating: a wall the Power at it doesn\'t beat holds and stops the blast', () => {
    const r = blastThroughWalls({ power: 10, perMetre: 1, walls: [{ metres: 4, rating: 6 }] });
    assert.equal(r.blocked, true);
    assert.equal(r.walls[0]!.holds, true);
    // Exactly equal holds too.
    assert.equal(blastThroughWalls({ power: 10, perMetre: 1, walls: [{ metres: 4, rating: 5 }] }).blocked, false);
    assert.equal(blastThroughWalls({ power: 10, perMetre: 1, walls: [{ metres: 3, rating: 7 }] }).blocked, true);
  });
  test('rating: several walls in order, each taking from what is left', () => {
    const r = blastThroughWalls({ power: 12, perMetre: 1, walls: [{ metres: 5, rating: 3 }, { metres: 1, rating: 2 }] });
    // The near wall (1 m): Power 11 > 2, −2. The far wall (5 m): 12 − 5 − 2 = 5 > 3, −3.
    assert.equal(r.blocked, false);
    assert.deepEqual(r.walls.map((w) => w.powerAt), [11, 5]);
    assert.equal(r.loss, 5);
    // A thicker far wall holds.
    assert.equal(blastThroughWalls({ power: 12, perMetre: 1, walls: [{ metres: 5, rating: 5 }, { metres: 1, rating: 2 }] }).blocked, true);
  });
  test('holdMultiplier and reduceMultiplier', () => {
    withRule('blastBarriers.holdMultiplier', 2, () => {
      assert.equal(blastThroughWalls({ power: 10, perMetre: 1, walls: [{ metres: 0, rating: 5 }] }).blocked, true);
      assert.equal(blastThroughWalls({ power: 11, perMetre: 1, walls: [{ metres: 0, rating: 5 }] }).blocked, false);
    });
    withRule('blastBarriers.reduceMultiplier', 2, () => {
      assert.equal(blastThroughWalls({ power: 11, perMetre: 1, walls: [{ metres: 0, rating: 3 }] }).loss, 6);
    });
  });
  test('unrated walls: block (default) or the default rating', () => {
    assert.equal(blastThroughWalls({ power: 20, perMetre: 1, walls: [{ metres: 1, rating: null }] }).blocked, true);
    withRule('blastBarriers.unratedWalls', 'default', () => {
      const r = blastThroughWalls({ power: 20, perMetre: 1, walls: [{ metres: 1, rating: null }] }, undefined, 4);
      assert.equal(r.blocked, false);
      assert.equal(r.loss, 4);
      assert.equal(r.walls[0]!.unrated, true);
      // A rated wall of 0 (a window) barely slows it.
      assert.equal(blastThroughWalls({ power: 20, perMetre: 1, walls: [{ metres: 1, rating: 0 }] }).loss, 0);
    });
  });
  test('armor mode: the ratings add to armor, nothing is stopped', () => {
    withRule('blastBarriers.mode', 'armor', () => {
      const r = blastThroughWalls({ power: 10, perMetre: 1, walls: [{ metres: 4, rating: 8 }, { metres: 6, rating: 2 }] });
      assert.equal(r.blocked, false);
      assert.equal(r.extraArmor, 10);
      assert.equal(r.loss, 0);
    });
  });
  test('block mode: the old way, any wall stops it', () => {
    withRule('blastBarriers.mode', 'block', () => {
      assert.equal(blastThroughWalls({ power: 30, perMetre: 1, walls: [{ metres: 1, rating: 0 }] }).blocked, true);
      assert.equal(blastThroughWalls({ power: 30, perMetre: 1, walls: [] }).blocked, false);
    });
  });
  test('no walls: nothing happens', () => {
    const r = blastThroughWalls({ power: 10, perMetre: 1, walls: [] });
    assert.deepEqual([r.blocked, r.loss, r.extraArmor, r.note], [false, 0, 0, '']);
  });
  test('crossingFraction: where a wall is crossed', () => {
    assert.equal(crossingFraction({ x: 0, y: 0 }, { x: 100, y: 0 }, [25, -10, 25, 10]), 0.25);
    assert.equal(crossingFraction({ x: 0, y: 0 }, { x: 100, y: 0 }, [125, -10, 125, 10]), null);
    assert.equal(crossingFraction({ x: 0, y: 0 }, { x: 100, y: 0 }, [0, 5, 100, 5]), null);
  });
});

describe('v0.72.0 O2: Take Aim', () => {
  const now = { targetUuid: 'T', weaponId: 'W', round: 2, combatId: 'C' };
  const aim = { targetUuid: 'T', weaponId: 'W', round: 1, combatId: 'C', actions: 2 };
  test('kept into the next Combat Turn', () => {
    assert.equal(aimHeld(aim, now), true);
    assert.deepEqual(aimModifierV72(aim, now, 6), [{ label: 'Aimed (2 actions)', value: 2 * RULES.COMBAT.aim.tnPerAction }]);
    assert.equal(nextAimV72(aim, now).actions, 3);
    assert.equal(nextAimV72(aim, now).round, 2);
  });
  test('the old way: lost at the end of the turn', () => {
    withRule('aim.keepAcrossTurns', false, () => {
      assert.equal(aimHeld(aim, now), false);
      assert.deepEqual(aimModifierV72(aim, now, 6), []);
      assert.equal(nextAimV72(aim, now).actions, 1);
      assert.equal(aimHeld(aim, { ...now, round: 1 }), true);
    });
  });
  test('another target, weapon or combat loses it', () => {
    assert.equal(aimHeld(aim, { ...now, targetUuid: 'X' }), false);
    assert.equal(aimHeld(aim, { ...now, weaponId: 'X' }), false);
    assert.equal(aimHeld(aim, { ...now, combatId: 'X' }), false);
    assert.equal(aimHeld(null, now), false);
  });
  test('the cap is read from the rating rolled', () => {
    assert.equal(aimRating({ rating: 2, specializationRating: 6, useSpecialization: true }), 6);
    assert.equal(aimRating({ rating: 2, concentrationRating: 4, useConcentration: true }), 4);
    assert.equal(aimRating({ rating: 2, specializationRating: 6 }), 2);
    assert.equal(aimRating({ rating: 0, relatedRating: 4 }), 4);
    // With a specialization of 6 the cap is 3 actions, not 1.
    const big = { ...aim, actions: 5 };
    assert.equal(aimModifierV72(big, now, aimRating({ rating: 2, specializationRating: 6, useSpecialization: true }))[0]!.value, 3 * RULES.COMBAT.aim.tnPerAction);
    withRule('aim.capBy', 'base', () => {
      assert.equal(aimRating({ rating: 2, specializationRating: 6, useSpecialization: true }), 2);
    });
  });
  test('aimRatingForWeapon: the specialization when it names the weapon', () => {
    const skill = { rating: 3, specialization: 'Ares Predator', specializationRating: 5 };
    assert.equal(aimRatingForWeapon(skill, 'ares  predator'), 5);
    assert.equal(aimRatingForWeapon(skill, 'Colt Manhunter'), 3);
    assert.equal(aimRatingForWeapon(null, ''), 0);
  });
});

describe('v0.72.0 O3: immunity to normal weapons', () => {
  test('Power at or below the immunity: no effect', () => {
    assert.deepEqual(immunityStops({ power: 4, immunity: 12 }), { stops: true, against: 12 });
    assert.equal(immunityStops({ power: 12, immunity: 12 }).stops, true);
    assert.equal(immunityStops({ power: 13, immunity: 12 }).stops, false);
  });
  test('no immunity, or the switch off: never stops', () => {
    assert.equal(immunityStops({ power: 1, immunity: 0 }).stops, false);
    withRule('immunity.stopsWeak', false, () => assert.equal(immunityStops({ power: 1, immunity: 12 }).stops, false));
  });
  test('allArmor and ammoCounts', () => {
    assert.equal(immunityStops({ power: 14, immunity: 12, otherArmor: 3 }).stops, false);
    withRule('immunity.compare', 'allArmor', () => assert.equal(immunityStops({ power: 14, immunity: 12, otherArmor: 3 }).stops, true));
    assert.equal(immunityStops({ power: 8, immunity: 12, armorMultiplier: 0.5 }).stops, true);
    withRule('immunity.ammoCounts', true, () => {
      assert.deepEqual(immunityStops({ power: 8, immunity: 12, armorMultiplier: 0.5 }), { stops: false, against: 6 });
    });
  });
});

describe('v0.72.0 O4: called shot at a gap', () => {
  const parts = { worn: 5, adept: 1, cyber: 2, limb: 3, effect: 4, immunity: 6 };
  test('without a gap shot: everything counts', () => assert.equal(armorFromParts(parts, false), 21));
  test('a gap bypasses worn armor only', () => assert.equal(armorFromParts(parts, true), 16));
  test('the old way: worn, adept, cyber and limb', () => {
    withRule('calledShotGap.bypasses', ['worn', 'adept', 'cyber', 'limb'], () => assert.equal(armorFromParts(parts, true), 10));
  });
});

describe('v0.72.0 O5: smoke in melee', () => {
  const smoke = { label: 'Smoke', value: 4 };
  test('counts in melee and at range', () => {
    assert.equal(smokeCounts(true), true);
    assert.equal(sightSmoke(true, smoke), smoke);
    assert.equal(sightSmoke(false, smoke), smoke);
    assert.equal(sightSmoke(true, undefined), null);
  });
  test('the old way: not in melee', () => {
    withRule('meleeSmoke', false, () => {
      assert.equal(sightSmoke(true, smoke), null);
      assert.equal(sightSmoke(false, smoke), smoke);
    });
  });
});

describe('v0.72.0 O6: data-driven ammunition', () => {
  test('the base list plus the extra rows', () => {
    const t = ammoTable();
    assert.equal(t.length, RULES.COMBAT.ammo.length + COMBAT_V72.ammo.extra.length);
    assert.ok(isKnownAmmo('stickShock', t));
    assert.ok(isKnownAmmo('apds', t));
  });
  test('the GM adds and replaces rows', () => {
    withRule('ammo.extra', [{ id: 'gel', label: 'Gel (house)', power: -1, stages: 0, armorMultiplier: 1 }, { id: 'frangible', label: 'Frangible' }], () => {
      const t = ammoTable();
      assert.equal(findAmmo('gel', t).label, 'Gel (house)');
      assert.equal(findAmmo('frangible', t).armorMultiplier, 1);
      assert.equal(findAmmo('frangible', t).power, 0);
      assert.equal(t.filter((a) => a.id === 'gel').length, 1);
    });
  });
  test('switched off: the base list only', () => {
    withRule('ammo.dataDriven', false, () => {
      assert.equal(ammoTable().length, RULES.COMBAT.ammo.length);
      assert.equal(isKnownAmmo('stickShock'), false);
    });
  });
  test('unknown ids fall back to standard', () => {
    assert.equal(findAmmo('nonsense').id, 'standard');
    assert.equal(findAmmo(undefined).id, 'standard');
  });
  test('damage: Power, stages, a fixed level', () => {
    assert.deepEqual(ammoDamageFrom(9, 'M', findAmmo('exex')), { power: 11, level: 'M' });
    assert.deepEqual(ammoDamageFrom(9, 'M', findAmmo('flechette')), { power: 9, level: 'S' });
    assert.deepEqual(ammoDamageFrom(9, 'M', findAmmo('stickShock')), { power: 7, level: 'S' });
    assert.deepEqual(ammoDamageFrom(1, 'L', findAmmo('gel')), { power: 0, level: 'L' });
  });
  test('extras for the attack', () => {
    assert.deepEqual(ammoExtras(findAmmo('stickShock')), { armorMultiplier: 0.5, armorKind: 'impact', damageType: 'stun' });
    assert.deepEqual(ammoExtras(findAmmo('standard')), {});
    assert.deepEqual(ammoExtras(findAmmo('antiVehicle')), { armorMultiplier: 0.5, antiVehicle: true });
  });
  test('choices keep an unknown loaded id', () => {
    const c = ammoChoices('oldRound');
    assert.equal(c.at(-1)!.id, 'oldRound');
    assert.ok(c.at(-1)!.selected);
    assert.equal(ammoChoices('apds').filter((x) => x.selected).map((x) => x.id).join(), 'apds');
    assert.equal(ammoChoices('', undefined, true)[0]!.id, '');
    assert.ok(ammoChoices('', undefined, true)[0]!.selected);
  });
});

describe('v0.72.0 O7: indirect fire', () => {
  test('which weapons can lob', () => {
    assert.equal(canFireIndirect({ blast: true, skill: 'Launch Weapons' }), true);
    assert.equal(canFireIndirect({ blast: true, skill: 'gunnery' }), true);
    assert.equal(canFireIndirect({ blast: true, skill: 'Throwing' }), false);
    assert.equal(canFireIndirect({ blast: true, skill: 'Throwing', indirect: true }), true);
    assert.equal(canFireIndirect({ blast: false, skill: 'Gunnery' }), false);
    withRule('indirect.enabled', false, () => assert.equal(canFireIndirect({ blast: true, indirect: true }), false));
  });
  test('the spotter link sets the TN', () => {
    assert.deepEqual(indirectFire({ link: 'voice' }).modifiers, [{ label: 'Indirect fire, spotter by voice', value: 2 }]);
    assert.deepEqual(indirectFire({ link: 'designator' }).modifiers, []);
    assert.equal(indirectFire({ link: 'none' }).modifiers[0]!.value, RULES.COMBAT.cover.blindFireTn);
    withRule('indirect.noSpotter', 'block', () => assert.equal(indirectFire({ link: 'none' }).allowed, false));
    withRule('indirect.enabled', false, () => assert.equal(indirectFire({ link: 'voice' }).allowed, false));
  });
  test('walking fire in, capped', () => {
    assert.equal(indirectFire({ link: 'designator', adjustShots: 2 }).modifiers[0]!.value, -2);
    assert.equal(indirectFire({ link: 'designator', adjustShots: 9 }).modifiers[0]!.value, -3);
  });
  test('scatter: more dice, more metres, less for spotter successes', () => {
    assert.equal(indirectScatterDice(2), 3);
    // 10 on the dice × 2 = 20, less 2 attack successes × 2 m and 3 spotter successes × 2 m.
    assert.equal(indirectScatterMetres(10, { attackSuccesses: 2, spotterSuccesses: 3 }), 20 - 2 * RULES.COMBAT.scatter.metresPerSuccess - 6);
    assert.equal(indirectScatterMetres(3, { attackSuccesses: 9 }), 0);
  });
  test('nextAdjust: the same spot in the same combat counts earlier shots', () => {
    const a = nextAdjust(null, { x: 0, y: 0, combatId: 'C' }, 50);
    assert.deepEqual([a.earlierShots, a.state.shots], [0, 1]);
    const b = nextAdjust(a.state, { x: 30, y: 0, combatId: 'C' }, 50);
    assert.deepEqual([b.earlierShots, b.state.shots], [1, 2]);
    assert.equal(nextAdjust(b.state, { x: 300, y: 0, combatId: 'C' }, 50).earlierShots, 0);
    assert.equal(nextAdjust(b.state, { x: 30, y: 0, combatId: 'D' }, 50).earlierShots, 0);
  });
});
