import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, weaponLayout, weaponSections, weaponLayoutFlags, itemWarnings, templatesFor } from '../index.ts';

describe('v0.41.0 item sheets (rules)', () => {
  test('a weapon\'s layout comes from its flags, and each layout shows its own fields', () => {
    assert.equal(weaponLayout({ melee: true }), 'melee');
    assert.equal(weaponLayout({ shotgun: true }), 'shotgun');
    assert.equal(weaponLayout({ blast: true, strengthRange: true }), 'grenade');
    assert.equal(weaponLayout({ blast: true, guidance: 3 }), 'launcher');
    assert.equal(weaponLayout({ areaKind: 'flame' }), 'flamethrower');
    assert.equal(weaponLayout({ strengthRange: true }), 'thrown');
    assert.equal(weaponLayout({}), 'firearm');
    assert.deepEqual(Object.entries(weaponSections('melee')).filter(([, v]) => v).map(([k]) => k), ['melee', 'strength']);
    const gun = weaponSections('firearm');
    assert.equal(gun.gun && gun.ammo && gun.ranges, true);
    assert.equal(gun.blast || gun.melee || gun.strengthRange, false);
    assert.equal(weaponSections('grenade').strengthRange, true);
  });

  test('picking a kind sets the flags behind it and clears the others', () => {
    assert.deepEqual(weaponLayoutFlags('melee'), { 'system.melee': true, 'system.blast': false, 'system.shotgun': false, 'system.areaKind': '', 'system.strengthRange': false, 'system.guidance': 0 });
    assert.equal(weaponLayoutFlags('launcher', { guidance: 0 })['system.guidance'], 1);
    assert.equal(weaponLayoutFlags('launcher', { guidance: 4 })['system.guidance'], 4);
    assert.equal(weaponLayoutFlags('shotgun', { choke: 0 })['system.choke'], 1);
    for (const l of ['melee', 'firearm', 'shotgun', 'thrown', 'grenade', 'launcher', 'flamethrower'] as const) {
      const flags = weaponLayoutFlags(l, {});
      const s = { melee: flags['system.melee'], blast: flags['system.blast'], shotgun: flags['system.shotgun'], areaKind: flags['system.areaKind'], strengthRange: flags['system.strengthRange'], guidance: flags['system.guidance'], antiVehicle: flags['system.antiVehicle'] };
      assert.equal(weaponLayout(s), l);
    }
  });

  test('warnings catch impossible settings', () => {
    const w = (type: string, s: any) => itemWarnings(type, s).join(' | ');
    assert.match(w('weapon', { shotgun: true, choke: 0, damagePower: 10, range: { short: 5, medium: 10, long: 20, extreme: 30 } }), /choke of at least 1/);
    assert.match(w('weapon', { blast: true, damagePower: 0, strengthRange: true }), /Power 0 hurts nobody/);
    assert.match(w('weapon', { damagePower: 9, range: { short: 0, medium: 0, long: 0, extreme: 0 } }), /No range bands/);
    assert.match(w('weapon', { damagePower: 9, range: { short: 50, medium: 20, long: 40, extreme: 60 } }), /grow from short to extreme/);
    assert.match(w('weapon', { melee: true, strengthPower: true, modes: 'SA', ammoMax: 10 }), /no firing modes or ammunition/);
    assert.match(w('weapon', { damagePower: 9, modes: 'BF/FA', muzzle: 'silencer', range: { short: 5, medium: 20, long: 40, extreme: 60 } }), /silencer works only in SS or SA/);
    assert.match(w('weapon', { damagePower: 9, ammo: 12, ammoMax: 10, modes: 'SA', range: { short: 5, medium: 20, long: 40, extreme: 60 } }), /more than the capacity/);
    assert.equal(w('weapon', { damagePower: 9, damageLevel: 'M', modes: 'SA', ammo: 10, ammoMax: 10, range: { short: 5, medium: 20, long: 40, extreme: 60 } }), '');
    assert.match(w('armor', { ballistic: 0, impact: 0 }), /protects nothing/);
    assert.match(w('cyberware', { essenceCost: 0 }), /Essence cost 0/);
    assert.equal(w('cyberware', { essenceCost: 0, housedIn: 'arm' }), '');
    assert.match(w('skill', { rating: 4, specialization: 'Pistols', specializationRating: 0 }), /needs a rating/);
    assert.match(w('spell', { learnedForce: 0, category: 'combat' }), /can't be cast/);
    assert.match(w('focus', { rating: 2, active: true, bonded: false }), /not bonded/);
    assert.match(w('gear', { toxin: { kind: 'drug', power: 0 } }), /Power 0 does nothing/);
  });

  test('every built-in template is valid for its type, and world templates come first', () => {
    for (const t of RULES.ITEM_TEMPLATES) {
      if (t.type === 'weapon') assert.deepEqual(itemWarnings('weapon', t.system), [], `${t.name}: ${itemWarnings('weapon', t.system).join('; ')}`);
      if (t.type === 'armor') assert.deepEqual(itemWarnings('armor', t.system), [], t.name);
    }
    const kinds = new Set(RULES.ITEM_TEMPLATES.filter((t) => t.type === 'weapon').map((t) => weaponLayout(t.system)));
    assert.equal(kinds.size, 7);                                  // every weapon layout has a template
    const list = templatesFor('weapon', [{ id: 'w-1', type: 'weapon', name: 'House pistol', system: {} }, { id: 'w-2', type: 'armor', name: 'Coat', system: {} }]);
    assert.equal(list[0]!.name, 'House pistol');
    assert.equal(list[0]!.world, true);
    assert.equal(list.filter((t) => t.world).length, 1);
    assert.equal(new Set(RULES.ITEM_TEMPLATES.map((t) => t.id)).size, RULES.ITEM_TEMPLATES.length);
  });
});
