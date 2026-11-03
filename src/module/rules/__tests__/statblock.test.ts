import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseStatBlock, guessSkillAttribute } from '../statblock.ts';

// Invented sample in the general SR2 layout; not copied from any book.
const SAMPLE = `Corporate Guard
B  Q  S  C  I  W  E   M  R      Armor
4  5  4  2  3  3  5.2 -  5 (7)  5/3
Initiative: 7 + 2D6
Dice Pools: Combat 5
Karma Pool/Professional Rating: 1/3
Skills: Firearms 5, Unarmed Combat 4 (Martial Arts 6),
  Stealth 3, Etiquette (Corporate) 2
Cyberware: Wired Reflexes (1), Smartlink
Gear: Armor jacket, Heavy pistol [12 rounds, 9M],
  Stun baton [Reach 1, 6S Stun], Commlink`;

describe('parseStatBlock: attributes', () => {
  const p = parseStatBlock(SAMPLE);
  test('reads the six attributes', () => {
    assert.deepEqual(p.attributes.body, { base: 4 });
    assert.deepEqual(p.attributes.quickness, { base: 5 });
    assert.deepEqual(p.attributes.willpower, { base: 3 });
  });
  test('reads essence (decimal), magic dash as 0, augmented reaction', () => {
    assert.equal(p.essence, 5.2);
    assert.equal(p.magic, 0);
    assert.deepEqual(p.reaction, { base: 5, augmented: 7 });
  });
  test('reads armor as ballistic/impact', () => {
    assert.deepEqual(p.armor, { ballistic: 5, impact: 3 });
  });
  test('initiative dice, karma pool, professional rating', () => {
    assert.equal(p.initiativeDice, 2);
    assert.equal(p.karmaPool, 1);
    assert.equal(p.professionalRating, 3);
  });
});

describe('parseStatBlock: skills', () => {
  const p = parseStatBlock(SAMPLE);
  test('reads skills across a wrapped line, with specializations', () => {
    assert.deepEqual(p.skills.map((s) => [s.name, s.rating]), [
      ['Firearms', 5], ['Unarmed Combat', 4], ['Stealth', 3], ['Etiquette', 2],
    ]);
    assert.equal(p.skills[1]?.specialization, 'Martial Arts 6');
  });
  test('a specialization written before the rating is split out of the name', () => {
    assert.equal(p.skills[3]?.specialization, 'Corporate');
    assert.equal(p.skills[3]?.attribute, 'charisma');
  });
  test('an entry with no rating becomes a warning, not a bad skill', () => {
    const q = parseStatBlock('Skills: Firearms 4, Biotech');
    assert.equal(q.skills.length, 1);
    assert.ok(q.warnings.some((w) => w.includes('"Biotech"')));
  });
  test('guesses linked attributes', () => {
    assert.equal(guessSkillAttribute('Firearms'), 'quickness');
    assert.equal(guessSkillAttribute('Unarmed Combat'), 'strength');
    assert.equal(guessSkillAttribute('Etiquette'), 'charisma');
    assert.equal(guessSkillAttribute('Sorcery'), 'willpower');
    assert.equal(guessSkillAttribute('Computer'), 'intelligence');
  });
});

describe('parseStatBlock: weapons', () => {
  const p = parseStatBlock(SAMPLE);
  test('only bracketed entries with a damage code become weapons', () => {
    assert.deepEqual(p.weapons.map((w) => w.name), ['Heavy pistol', 'Stun baton']);
  });
  test('ranged weapon links to the firearms skill', () => {
    const w = p.weapons[0];
    assert.deepEqual({ ...w }, { name: 'Heavy pistol', power: 9, level: 'M', damageType: 'physical', melee: false, skill: 'Firearms' });
  });
  test('melee stun weapon is detected and linked to a melee skill', () => {
    const w = p.weapons[1];
    assert.equal(w?.melee, true);
    assert.equal(w?.damageType, 'stun');
    assert.equal(w?.level, 'S');
    assert.equal(w?.skill, 'Unarmed Combat');
  });
});

describe('parseStatBlock: robustness', () => {
  test('no header row is a warning and nothing else breaks', () => {
    const p = parseStatBlock('Skills: Firearms 3');
    assert.ok(p.warnings[0]?.includes('No attribute header'));
    assert.equal(p.skills.length, 1);
  });
  test('column mismatch is reported', () => {
    const p = parseStatBlock('B Q S C I W\n3 3 3 3 3');
    assert.ok(p.warnings.some((w) => w.includes('6 columns') && w.includes('5')));
    assert.equal(p.attributes.intelligence?.base, 3);
    assert.equal(p.attributes.willpower, undefined);
  });
  test('augmented attribute values', () => {
    const p = parseStatBlock('B Q S C I W\n4 5(7) 6 (8) 1 2 3');
    assert.deepEqual(p.attributes.quickness, { base: 5, augmented: 7 });
    assert.deepEqual(p.attributes.strength, { base: 6, augmented: 8 });
  });
  test('unreadable armor and cells are warnings', () => {
    const p = parseStatBlock('B Q S C I W Armor\n3 x 3 3 3 3 heavy');
    assert.ok(p.warnings.some((w) => w.includes('Q value "x"')));
    assert.ok(p.warnings.some((w) => w.includes('armor "heavy"')));
  });
  test('critter-style block with natural attacks and Windows line endings', () => {
    const p = parseStatBlock('B Q S C I W E R\r\n6 4 7 - 2/4 3 6 4\r\nAttacks: Bite [8S], Claws [7M]');
    assert.equal(p.attributes.strength?.base, 7);
    assert.equal(p.attributes.charisma?.base, 0);
    assert.ok(p.warnings.some((w) => w.includes('I value "2/4"')));
    assert.deepEqual(p.weapons.map((w) => [w.name, `${w.power}${w.level}`, w.melee]), [['Bite', '8S', true], ['Claws', '7M', true]]);
  });
  test('empty input', () => {
    const p = parseStatBlock('');
    assert.equal(p.skills.length, 0);
    assert.equal(p.weapons.length, 0);
    assert.equal(p.warnings.length, 1);
  });
});

import { parseStatBlock as parseSB } from '../statblock.ts';
test('stat-block weapons with Strength-based damage and reach', () => {
  const r = parseSB(`B Q S C I W E R\n5 4 6 2 3 3 6 3\nSkills: Unarmed Combat 4, Clubs 3\nGear: Club [(STR+1)M, Reach 1], Fists (STR M Stun), Dagger [(Str-1)L]`);
  const club = r.weapons.find((w) => w.name === 'Club')!;
  assert.deepEqual([club.strengthPower, club.power, club.level, club.reach, club.melee], [true, 1, 'M', 1, true]);
  const fists = r.weapons.find((w) => w.name === 'Fists')!;
  assert.deepEqual([fists.strengthPower, fists.power, fists.damageType], [true, 0, 'stun']);
  assert.equal(r.weapons.find((w) => w.name === 'Dagger')!.power, -1);
});
