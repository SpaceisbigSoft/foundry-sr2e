import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, searchTargets, searchFinds, accessoryRecoil, attackMagnification, laserAndSmartlink, spellVsVehicle, shieldParry,
  blastScatterDice, fusedScatter, canThrowBack, stopsAtWalls, aimOffMetres, wallRepair, cyberDamageDue, cyberDamageChances, limbArmorFor,
  type CarriedItem,
} from '../index.ts';

describe('v0.43.0 concealment and scanners', () => {
  const items: CarriedItem[] = [
    { id: 'h', name: 'Hold-out', type: 'weapon', concealability: 8 },
    { id: 'r', name: 'Rifle', type: 'weapon', concealability: 0 },
    { id: 'j', name: 'Armor jacket', type: 'armor', concealability: 0, worn: true },
    { id: 'c', name: 'Armor clothing', type: 'armor', concealability: 6, worn: true },
    { id: 'p', name: 'Spare jacket', type: 'armor', concealability: 0, worn: false },
    { id: 'k', name: 'Credstick', type: 'gear', concealability: 0 },
    { id: 'x', name: 'C-12', type: 'gear', concealability: 5, explosive: true },
    { id: 's', name: 'Spur', type: 'cyberware', concealability: 0, worn: true, kind: 'cyberweapon' },
    { id: 'a', name: 'Cyberarm', type: 'cyberware', concealability: 4, worn: true, kind: 'cyberlimb' },
    { id: 'm', name: 'Muscle aug', type: 'cyberware', concealability: 0, worn: true, bioware: true },
  ];

  test('looking: Concealability is the TN; unconcealable weapons and worn armor are seen; plain gear is not listed', () => {
    const t = searchTargets(items, 'look');
    const by = Object.fromEntries(t.map((x) => [x.id, x.tn]));
    assert.deepEqual(by, { h: 8, r: null, j: null, c: 6, x: 5, a: 4 });
  });

  test('frisking lowers each TN, never below the minimum', () => {
    const t = searchTargets([...items, { id: 'z', name: 'Coin', type: 'gear', concealability: 2 }], 'frisk');
    assert.equal(t.find((x) => x.id === 'h')!.tn, 8 + RULES.GEAR.concealment.friskTn);
    assert.equal(t.find((x) => x.id === 'z')!.tn, RULES.MIN_TARGET_NUMBER);
  });

  test('scanners: weapons (and cyberweapons), cyberware (not bioware), explosives', () => {
    const d = RULES.GEAR.concealment.defaultTn;
    assert.deepEqual(searchTargets(items, 'scanner', 'weapon').map((x) => [x.id, x.tn]), [['h', 8], ['r', d], ['s', d]]);
    assert.deepEqual(searchTargets(items, 'scanner', 'cyber').map((x) => x.id), ['s', 'a']);
    assert.deepEqual(searchTargets(items, 'scanner', 'explosive').map((x) => x.id), ['x']);
    assert.equal(searchFinds(1), true);
    assert.equal(searchFinds(0), false);
  });
});

describe('v0.43.0 weapon accessories', () => {
  test('a shock pad always; a bipod or tripod once set up, or prone', () => {
    assert.deepEqual(accessoryRecoil({ shockPad: true, support: 'bipod', supportSetUp: false }).value, 1);
    assert.equal(accessoryRecoil({ support: 'bipod', supportSetUp: true }).value, 2);
    assert.equal(accessoryRecoil({ support: 'tripod' }, true).value, 6);
    assert.deepEqual(accessoryRecoil({ support: 'tripod', supportSetUp: true, shockPad: true }).parts, ['shock pad 1', 'tripod 6']);
  });

  test('scope and cyber-eye magnification: the better counts, capped', () => {
    assert.equal(attackMagnification(2, 1), 2);
    assert.equal(attackMagnification(0, 3), 3);
    (RULES.GEAR.accessories as any).scopeStacks = true;
    try { assert.equal(attackMagnification(2, 2), 3); } finally { (RULES.GEAR.accessories as any).scopeStacks = false; }
  });

  test('a laser sight is dropped next to the smartlink', () => {
    assert.deepEqual(laserAndSmartlink(['smartlink', 'laserSight']), { situational: ['smartlink'], dropped: true });
    assert.deepEqual(laserAndSmartlink(['laserSight']), { situational: ['laserSight'], dropped: false });
  });
});

describe('v0.43.0 spells against vehicles and shields', () => {
  test('mana spells cannot touch vehicles; the TN is the Object Resistance', () => {
    assert.equal(spellVsVehicle({ spellType: 'mana' }).ok, false);
    assert.deepEqual(spellVsVehicle({ spellType: 'physical' }), { ok: true, tn: RULES.GEAR.spellsVsVehicles.objectResistance, reason: '' });
    assert.equal(spellVsVehicle({ spellType: 'physical', objectResistance: 6 }).tn, 6);
  });

  test('the best worn shield adds its Parry as dice, or off the TN', () => {
    const list = [{ name: 'Buckler', worn: true, parry: 1 }, { name: 'Riot shield', worn: true, parry: 2 }, { name: 'Tower', worn: false, parry: 4 }];
    assert.deepEqual(shieldParry(list), { dice: 2, tn: 0, name: 'Riot shield' });
    (RULES.GEAR.shields as any).parryAs = 'tn';
    try { assert.deepEqual(shieldParry(list), { dice: 0, tn: -2, name: 'Riot shield' }); } finally { (RULES.GEAR.shields as any).parryAs = 'dice'; }
    assert.deepEqual(shieldParry([]), { dice: 0, tn: 0, name: '' });
  });
});

describe('v0.43.0 grenades and walls', () => {
  test('bounced throws scatter more; smart grenades and airbursts less', () => {
    assert.equal(blastScatterDice(2, true), 3);
    assert.equal(blastScatterDice(2, false), 2);
    assert.equal(fusedScatter(7, { smart: true, successes: 2 }), 5);
    assert.equal(fusedScatter(7, { fuse: 'airburst' }), 3);
    assert.equal(fusedScatter(1, { smart: true, successes: 3 }), 0);
  });

  test('throwing back and walls by fuse', () => {
    assert.equal(canThrowBack('offensive', ''), true);
    assert.equal(canThrowBack('offensive', 'airburst'), false);
    assert.equal(canThrowBack('offensive', 'impact'), false);
    assert.equal(canThrowBack('heRocket', ''), false);
    assert.equal(stopsAtWalls(''), true);
    assert.equal(stopsAtWalls('airburst'), false);
    assert.equal(aimOffMetres(99), RULES.GEAR.grenades.aimOffMetres);
    assert.equal(aimOffMetres(-3), 0);
  });

  test('wall repair: fully, or by successes up to the original', () => {
    assert.equal(wallRepair({ rating: 0, original: 6, full: true }), 6);
    assert.equal(wallRepair({ rating: 1, original: 6, successes: 3 }), 4);
    assert.equal(wallRepair({ rating: 5, original: 6, successes: 4 }), 6);
  });
});

describe('v0.43.0 cyberware damage and cyberlimbs', () => {
  test('a check only for heavy Physical damage', () => {
    assert.equal(cyberDamageDue('D', 'physical'), true);
    assert.equal(cyberDamageDue('S', 'physical'), false);
    assert.equal(cyberDamageDue('D', 'stun'), false);
    assert.equal(cyberDamageDue(null, 'physical'), false);
    (RULES.GEAR.cyberDamage as any).mode = 'off';
    try { assert.equal(cyberDamageDue('D', 'physical'), false); } finally { (RULES.GEAR.cyberDamage as any).mode = 'button'; }
  });

  test('a called shot at a cyberlimb raises its chance, and that of what it houses', () => {
    const ware = [
      { id: 'arm', name: 'Cyberarm', kind: 'cyberlimb', location: 'rightArm' },
      { id: 'gun', name: 'Arm gun', housedIn: 'arm' },
      { id: 'eye', name: 'Cybereyes' },
      { id: 'bio', name: 'Muscle aug', bioware: true },
      { id: 'old', name: 'Broken jack', damaged: true },
    ];
    const c = RULES.GEAR.cyberDamage;
    assert.deepEqual(cyberDamageChances(ware, 'rightArm'), [{ id: 'arm', name: 'Cyberarm', chance: c.calledChance }, { id: 'gun', name: 'Arm gun', chance: c.calledChance }, { id: 'eye', name: 'Cybereyes', chance: c.chance }]);
    assert.ok(cyberDamageChances(ware).every((x) => x.chance === c.chance));
  });

  test('cyberlimb armor only against a called shot at it', () => {
    const limbs = [{ location: 'leftArm', ballistic: 2, impact: 1 }, { location: 'rightLeg', ballistic: 1, impact: 1 }];
    assert.equal(limbArmorFor(limbs, 'ballistic'), 0);
    assert.equal(limbArmorFor(limbs, 'ballistic', 'leftArm'), 2);
    (RULES.GEAR.cyberlimbs as any).armorCalledOnly = false;
    try { assert.equal(limbArmorFor(limbs, 'ballistic'), 3); } finally { (RULES.GEAR.cyberlimbs as any).armorCalledOnly = true; }
  });
});
