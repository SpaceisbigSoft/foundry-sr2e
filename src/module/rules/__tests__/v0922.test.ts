/**
 * v0.92.2 (release testing): the accessory reader's ratings in the phrasings the in-Foundry tests found it missing.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readAccessories } from '../accessories.ts';

const read = (d: string) => Object.fromEntries(readAccessories(d).filter((h) => h.field).map((h) => [h.field, h.value]));

describe('v0.92.2 accessory ratings', () => {
  test('gas vents: plural, bracketed, "rating", after a comma', () => {
    assert.deepEqual(read('gas vents (2)'), { recoilComp: 2 });
    assert.deepEqual(read('Gas vents 3'), { recoilComp: 3 });
    assert.deepEqual(read('Gas vent (rating 3)'), { recoilComp: 3 });
    assert.deepEqual(read('gas vent system, rating 2'), { recoilComp: 2 });
    assert.deepEqual(read('Gas vents II'), { recoilComp: 2 });
    assert.deepEqual(read('Gas vent 2'), { recoilComp: 2 });
  });

  test('no rating read from words that only look like one', () => {
    assert.deepEqual(read('gas vent, i.e. a muzzle brake'), {});
    assert.deepEqual(read('gas vent (in the barrel)'), {});
    assert.deepEqual(read('no gas vents'), {});
  });

  test('recoil compensation in brackets', () => {
    assert.deepEqual(read('recoil compensation (3)'), { recoilComp: 3 });
    assert.deepEqual(read('Recoil compensation 2'), { recoilComp: 2 });
  });

  test('a scope\'s bracketed number is its magnification, also after a vision type', () => {
    assert.deepEqual(read('Smartgun link, scope (2)'), { smartgun: true, scope: 2 });
    assert.deepEqual(read('scope (low-light, magnification 2)'), { scopeVision: 'lowLight', scope: 2 });
    assert.deepEqual(read('thermographic scope, 3x'), { scopeVision: 'thermographic', scope: 3 });
    assert.deepEqual(read('low-light scope'), { scopeVision: 'lowLight', scope: 1 });
  });

  test('other accessories next to a rating still read', () => {
    assert.deepEqual(read('Gas vent system 2 and a laser sight'), { recoilComp: 2, laserSight: true });
  });
});

describe('v0.92.2 the HUD leaves out weapons left behind', async () => {
  const { hudActions } = await import('../hudactions.ts');
  const { RULES } = await import('../config.ts');
  const summary = (carried: boolean): any => ({
    type: 'character', name: 'Runner',
    attributes: { body: { total: 4 }, quickness: { total: 5 }, strength: { total: 4 }, charisma: { total: 3 }, intelligence: { total: 4 }, willpower: { total: 4 } },
    derived: { reaction: 4, initiativeDice: 1, magic: 0, essence: 6, astralMode: 'physical' },
    items: [{ id: 'w1', type: 'weapon', name: 'Pistol', system: { ammo: 8, ammoMax: 12, modes: 'SA', damagePower: 9, damageLevel: 'M', carried } }],
    flags: {},
  });
  const weaponIds = (carried: boolean) => hudActions(summary(carried)).filter((a: any) => a.groupId === 'weapons').map((a: any) => a.id);
  test('a carried weapon is offered, one left behind is not (and no reload for it)', () => {
    assert.ok(weaponIds(true).some((id: string) => id.includes('w1')));
    assert.ok(!weaponIds(false).some((id: string) => id.includes('w1')));
    assert.ok(!hudActions(summary(false)).some((a: any) => a.id === 'combat-reload'));
  });
  test('with the Carried house rule off every weapon is offered', () => {
    const S = RULES.SHEET_V921 as any; const prev = S.carried; S.carried = 'off';
    try { assert.ok(weaponIds(false).some((id: string) => id.includes('w1'))); } finally { S.carried = prev; }
  });
});
