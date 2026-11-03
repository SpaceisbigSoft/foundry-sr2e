import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { metresPerUnit, withElevation, nearest, meleeReachMetres, checkWeaponDistance } from '../distance.ts';

const limits = { short: 5, medium: 20, long: 40, extreme: 60 };

describe('distance', () => {
  test('scene units convert to metres; unknown units give null, blank is metres', () => {
    assert.equal(metresPerUnit('m'), 1);
    assert.equal(metresPerUnit('Metres'), 1);
    assert.equal(metresPerUnit('ft.'), 0.3048);
    assert.equal(metresPerUnit('km'), 1000);
    assert.equal(metresPerUnit(''), 1);
    assert.equal(metresPerUnit('parsecs'), null);
  });

  test('elevation: Pythagoras unless the grid already measured further in 3D', () => {
    assert.equal(withElevation(4, 0), 4);
    assert.equal(withElevation(3, 4), 5);
    assert.equal(withElevation(3, -4), 5);
    assert.equal(withElevation(3, 4, 3), 5); // grid ignored elevation
    assert.equal(withElevation(3, 4, 4), 4); // grid measured in 3D with its own diagonal rule
  });

  test('nearest picks the shortest finite distance', () => {
    assert.equal(nearest([3, 1.5, 2]), 1.5);
    assert.equal(nearest([]), null);
    assert.equal(nearest([NaN, 2]), 2);
  });

  test('melee reach: base metres or one grid step, plus 1 m per point of Reach', () => {
    assert.equal(meleeReachMetres(0), 1);
    assert.equal(meleeReachMetres(0, 1.5), 1.5);
    assert.equal(meleeReachMetres(2, 1), 3);
  });

  test('ranged: band from the distance; beyond extreme is out, uses extreme and blocks', () => {
    const near = checkWeaponDistance({ metres: 12.34, melee: false, limits });
    assert.equal(near.status, 'ok');
    assert.equal(near.band, 'medium');
    assert.equal(near.note, 'Measured 12.3 m');
    const far = checkWeaponDistance({ metres: 75, melee: false, limits, unitsNote: 'scene measured in ft' });
    assert.equal(far.status, 'out');
    assert.equal(far.band, 'extreme');
    assert.equal(far.blocks, true);
    assert.match(far.note, /beyond extreme range \(60 m\) \(scene measured in ft\)/);
  });

  test('melee: in reach when adjacent (diagonal step counts), out of reach otherwise', () => {
    assert.equal(checkWeaponDistance({ metres: 1.5, melee: true, limits, stepMetres: 1.5 }).status, 'ok');
    assert.equal(checkWeaponDistance({ metres: 2, melee: true, limits, stepMetres: 1.5 }).status, 'out');
    assert.equal(checkWeaponDistance({ metres: 2, melee: true, limits, reach: 1, stepMetres: 1 }).status, 'ok');
    const out = checkWeaponDistance({ metres: 4, melee: true, limits, reach: 1 });
    assert.equal(out.blocks, true);
    assert.match(out.note, /out of melee reach \(2 m\)/);
  });

  test('no measurement: unmeasured, never blocks', () => {
    const c = checkWeaponDistance({ metres: null, melee: false, limits });
    assert.equal(c.status, 'unmeasured');
    assert.equal(c.blocks, false);
  });
});
