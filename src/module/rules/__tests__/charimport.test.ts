import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCharacterSheet, characterImportPlan, parseNuyen, parseKarmaText, parseLifestyle,
  metatypeFromText, parseContactEntry, parseQualityEntry,
} from '../charimport.ts';
import { STAT_BLOCK_ITEM_CHOICES } from '../statblock.ts';
import { RULES } from '../config.ts';

// Invented characters in the usual write-up layouts; not copied from any book or sheet.
const SAMURAI = `Name: Rourke "Razorback" Delaney
Street name: Razorback
Player: Dana
Metatype: Ork
Archetype: Street Samurai

Body 8   Quickness 5 (6)   Strength 7 (8)
Charisma 2   Intelligence 3   Willpower 4
Essence 0.85   Magic 0
Reaction 4 (8)   Initiative 8 + 3D6

Skills: Firearms 6 (Pistols 8), Armed Combat 4 (Cyber-implant 6), Unarmed Combat 4,
  Stealth 3, Bike 3, Etiquette (Street) 2
Knowledge skills: Seattle Gangs 4, Small Unit Tactics 3
Languages: English 3 (native), Or'zet 2
Cyberware: Wired Reflexes 2, Smartlink, Retractable Spurs, Dermal Plating 1,
  Cybereyes (low-light, flare comp), Muscle Replacement 1
Gear:
  Ares Predator II [9M, SA, 15 (c), smartgun]
  Ingram Smartgun 7M SMG BF/FA 32 (c)
  Katana (STR+3)M
  Armor jacket 5/3
  Helmet
  Medkit (Rating 3)
  2x Flash-pak
  Ammo x50
  Fuchi Cyber-4 cyberdeck
Contacts: Fixer (Level 2), Joe the bartender — Bartender, level 1, Mr. Johnson (Buddy)
Edges and flaws: Ambidextrous (+2), Bad Luck (-4)
Nuyen: 12,500¥
Karma: 5 (total 23)
Karma Pool 2
Lifestyle: Middle (2 months)
Notes: Owes the Ancients a favour.
  Hates Lone Star.
`;

const SHAMAN = `Whisper — Elf Shaman
Player: Pell

B  Q  S  C  I  W  E  M  R
3  4  2  6  5  6  6  6  4

Tradition: Shamanic
Totem: Raven
Initiate grade: 0

Active skills: Sorcery 6 (Manipulation 8), Conjuring 5, Etiquette 3 (Street 5), Firearms 2
Knowledge skills:
  Magical Theory 5
  Seattle Street Lore 3 (Redmond 5)
Language skills: English (native), Sperethiel 3, Japanese 2 (R/W 1)
Build/Repair skills: Car 1

Spells: Manabolt 5, Heal 4 (exclusive), Levitate 3, Mask 3, Detect Enemies 4
Foci: Power focus 2, Spell focus (Combat) 3

Gear:
  Ceska Black Scorpion [6L, SA/BF, 35 (c)]
  Lined coat
  Stim patch (Rating 4) x3
  Fetish kit
Armor: Armor vest 2/1

Contacts:
  Old Lou — Talismonger (Loyalty 3)
  Sister Morrow: Street doc, Friend for life
Edges: Bonus spell (2)
Flaws: Allergy (Mild, Pollen) 2

Nuyen: 2.750 nuyen
Good Karma 4
Total Karma 12
Lifestyle Low, 3 months prepaid

Background:
Grew up in the Barrens.

Raven called her at twelve.
Age: 24
Height: 1.80 m
`;

describe('parseCharacterSheet: street samurai', () => {
  const p = parseCharacterSheet(SAMURAI);
  test('identity and metatype', () => {
    assert.equal(p.name, 'Razorback');
    assert.equal(p.realName, 'Rourke "Razorback" Delaney');
    assert.equal(p.player, 'Dana');
    assert.equal(p.metatype, 'ork');
    assert.equal(p.archetype, 'Street Samurai');
  });
  test('attribute lines, augmented values, Essence, Reaction, initiative', () => {
    assert.deepEqual(p.attributes.body, { base: 8 });
    assert.deepEqual(p.attributes.quickness, { base: 5, augmented: 6 });
    assert.deepEqual(p.attributes.strength, { base: 7, augmented: 8 });
    assert.deepEqual(p.attributes.willpower, { base: 4 });
    assert.equal(p.essence, 0.85);
    assert.equal(p.magic, 0);
    assert.deepEqual(p.reaction, { base: 4, augmented: 8 });
    assert.equal(p.initiativeDice, 3);
  });
  test('skills of every kind, with specializations and a native language', () => {
    const fa = p.skills.find((s) => s.name === 'Firearms');
    assert.equal(fa?.rating, 6);
    assert.equal(fa?.specialization, 'Pistols 8');
    assert.equal(fa?.kind, 'active');
    assert.equal(p.skills.find((s) => s.name === 'Etiquette')?.specialization, 'Street');
    assert.equal(p.skills.find((s) => s.name === 'Seattle Gangs')?.kind, 'knowledge');
    const en = p.skills.find((s) => s.name === 'English');
    assert.equal(en?.kind, 'language');
    assert.equal(en?.native, true);
    assert.equal(en?.rating, 3);
    assert.equal(p.skills.find((s) => s.name === "Or'zet")?.native, undefined);
  });
  test('weapons by damage code, bracketed or not', () => {
    const pred = p.weapons.find((w) => w.name === 'Ares Predator II');
    assert.equal(pred?.power, 9);
    assert.equal(pred?.level, 'M');
    assert.equal(pred?.skill, 'Firearms');
    assert.equal(pred?.ammoMax, 15);
    assert.equal(pred?.smartgun, true);
    const ingram = p.weapons.find((w) => w.name === 'Ingram Smartgun');
    assert.equal(ingram?.power, 7);
    assert.equal(ingram?.modes, 'BF/FA');
    assert.equal(ingram?.ammoMax, 32);
    const katana = p.weapons.find((w) => w.name === 'Katana');
    assert.equal(katana?.strengthPower, true);
    assert.equal(katana?.power, 3);
    assert.equal(katana?.melee, true);
  });
  test('gear: armor, quantities, ratings, a deck', () => {
    const jacket = p.gear.find((g) => g.name === 'Armor jacket');
    assert.equal(jacket?.kind, 'armor');
    assert.equal(jacket?.ballistic, 5);
    assert.equal(jacket?.impact, 3);
    assert.equal(p.gear.find((g) => g.name === 'Helmet')?.kind, 'armor');
    assert.equal(p.gear.find((g) => g.name === 'Medkit')?.rating, 3);
    assert.equal(p.gear.find((g) => g.name === 'Flash-pak')?.quantity, 2);
    assert.equal(p.gear.find((g) => g.name === 'Ammo')?.quantity, 50);
    assert.ok(p.gear.some((g) => /cyberdeck/i.test(g.name)));
    assert.ok(p.warnings.some((w) => /cyberdeck item/.test(w)));
  });
  test('contacts with levels and roles', () => {
    assert.equal(p.contacts.length, 3);
    assert.deepEqual(p.contacts[0], { name: 'Fixer', role: 'Fixer', level: 2, notes: '' });
    assert.deepEqual(p.contacts[1], { name: 'Joe the bartender', role: 'Bartender', level: 1, notes: '' });
    assert.equal(p.contacts[2]?.name, 'Mr. Johnson');
    assert.equal(p.contacts[2]?.level, 2);
  });
  test('edges and flaws by sign', () => {
    assert.deepEqual(p.qualities.map((q) => [q.name, q.kind, q.points]), [['Ambidextrous', 'edge', 2], ['Bad Luck', 'flaw', 4]]);
  });
  test('money, Karma, lifestyle, notes', () => {
    assert.equal(p.nuyen, 12500);
    assert.deepEqual(p.karma, { good: 5, total: 23, pool: 2 });
    assert.equal(p.karmaPool, 2);
    assert.deepEqual(p.lifestyle, { name: 'Middle', level: 'middle', months: 2 });
    assert.match(p.notes, /Owes the Ancients a favour\.\n\s*Hates Lone Star\./);
    assert.match(p.notes, /Player: Dana/);
    assert.deepEqual(p.unknown, []);
  });
});

describe('characterImportPlan: street samurai', () => {
  const p = parseCharacterSheet(SAMURAI);
  const plan = characterImportPlan(p, { itemNames: [{ type: 'skill', name: 'firearms' }, { type: 'weapon', name: 'Katana' }], makeId: () => 'id1' });
  const u = plan.actorUpdate;
  test('actor update paths', () => {
    assert.equal(u['name'], 'Razorback');
    assert.equal(u['system.metatype'], 'ork');
    assert.equal(u['system.racialModifiers'], false);
    assert.equal(u['system.attributes.body.base'], 8);
    assert.equal(u['system.nuyen'], 12500);
    assert.equal(u['system.karma.good'], 5);
    assert.equal(u['system.karma.career'], 23);
    assert.equal(u['system.karma.pool'], 2);
    assert.equal(u['system.lifestyle.level'], 'middle');
    assert.match(String(u['system.notes']), /^<p>/);
  });
  test('attribute mods leave out what imported cyberware adds (muscle replacement +1 Str/Qui)', () => {
    assert.equal(u['system.attributes.quickness.base'], 5);
    assert.equal(u['system.attributes.quickness.mod'], 0);
    assert.equal(u['system.attributes.strength.mod'], 0);
    // v0.92.3 (GEAR_V923.dermal 'body'): Dermal Plating 1 adds +1 Body, which the shown Body 8 already holds.
    assert.equal(u['system.attributes.body.mod'], -1);
  });
  test('values for after the items exist', () => {
    assert.deepEqual(plan.after, { essenceShown: 0.85, reactionShown: 8, initiativeDice: 3, lifestyleMonths: 2, lifestyleSeconds: 2 * RULES.UPKEEP.monthDays * 86400 });
  });
  test('items: types, model fields and replace flags', () => {
    const fa = plan.items.find((i) => i.type === 'skill' && i.name === 'Firearms');
    assert.equal(fa?.replace, true);
    assert.deepEqual(fa?.system, { rating: 6, attribute: 'quickness', kind: 'active', specialization: 'Pistols', specializationRating: 8 });
    assert.equal(plan.items.find((i) => i.name === 'Katana')?.replace, true);
    assert.equal(plan.items.find((i) => i.name === 'Ares Predator II')?.replace, undefined);
    assert.deepEqual(plan.items.find((i) => i.name === 'English')?.system, { rating: 3, attribute: 'intelligence', kind: 'language', native: true });
    assert.deepEqual(plan.items.find((i) => i.name === 'Armor jacket')?.system, { ballistic: 5, impact: 3, worn: true });
    assert.equal(plan.items.find((i) => i.name === 'Helmet')?.system['adds'], true);
    assert.deepEqual(plan.items.find((i) => i.name === 'Medkit')?.system, { quantity: 1, medkitRating: 3 });
    assert.equal(plan.items.find((i) => i.name === 'Flash-pak')?.system['quantity'], 2);
    const wired = plan.items.find((i) => i.name === 'Wired Reflexes');
    assert.equal(wired?.type, 'cyberware');
    assert.ok((STAT_BLOCK_ITEM_CHOICES.cyberwareKinds as readonly string[]).includes(String(wired?.system['kind'])));
    const pred = plan.items.find((i) => i.name === 'Ares Predator II')?.system;
    assert.equal(pred?.['damagePower'], 9);
    assert.equal(pred?.['ammoMax'], 15);
    assert.equal(pred?.['smartgun'], true);
  });
  test('contacts and qualities in the model shape', () => {
    assert.equal(plan.contacts?.length, 3);
    assert.deepEqual(plan.contacts?.[0], { id: 'id1', notes: '', loyalty: 1, skills: '', fee: 0, dice: 0, favours: 0, name: 'Fixer', level: 2, role: 'Fixer' });
    assert.deepEqual(plan.qualities?.[1], { id: 'id1', target: '', tn: 0, notes: '', name: 'Bad Luck', kind: 'flaw', points: 4 });
  });
  test('summary', () => {
    assert.equal(plan.summary[0], 'Razorback (Ork), Street Samurai');
    assert.ok(plan.summary.includes('Body 8, Quickness 5 (6), Strength 7 (8), Charisma 2, Intelligence 3, Willpower 4'));
    assert.ok(plan.summary.includes('3 contacts'));
    assert.ok(plan.summary.some((l) => /^10 skills \(6 active, 2 knowledge, 2 language\)$/.test(l)));
    assert.ok(plan.summary.some((l) => /3 weapons/.test(l) && /6 cyberware/.test(l)));
    assert.ok(plan.summary.includes('2 items already on the actor will be updated'));
  });
});

describe('parseCharacterSheet: shaman', () => {
  const p = parseCharacterSheet(SHAMAN);
  const plan = characterImportPlan(p);
  test('first-line name and metatype, header row attributes', () => {
    assert.equal(p.name, 'Whisper');
    assert.equal(p.metatype, 'elf');
    assert.deepEqual(p.attributes.charisma, { base: 6 });
    assert.equal(p.magic, 6);
    assert.equal(p.essence, 6);
    assert.deepEqual(p.reaction, { base: 4 });
  });
  test('tradition and totem (dice from the built-in table)', () => {
    assert.equal(p.tradition, 'shamanic');
    assert.equal(p.totem, 'Raven');
    assert.equal(plan.actorUpdate['system.tradition'], 'shamanic');
    assert.equal(plan.actorUpdate['system.totem.name'], 'Raven');
    assert.equal(plan.actorUpdate['system.totem.manipulation'], 2);
    assert.equal(plan.actorUpdate['system.initiateGrade'], 0);
  });
  test('knowledge on separate lines, native language from Intelligence, Read/Write dropped, B/R named', () => {
    assert.equal(p.skills.find((s) => s.name === 'Magical Theory')?.kind, 'knowledge');
    assert.equal(p.skills.find((s) => s.name === 'Seattle Street Lore')?.specialization, 'Redmond 5');
    const en = p.skills.find((s) => s.name === 'English');
    assert.equal(en?.rating, 5);
    assert.equal(en?.native, true);
    assert.equal(p.skills.find((s) => s.name === 'Japanese')?.rating, 2);
    assert.equal(p.skills.find((s) => s.name === 'Japanese')?.specialization, undefined);
    const br = p.skills.find((s) => s.kind === 'buildRepair');
    assert.equal(br?.name, 'Car B/R');
    assert.equal(br?.attribute, 'intelligence');
    assert.equal(p.skills.find((s) => s.name === 'Sorcery')?.specialization, 'Manipulation 8');
  });
  test('spells through the statblock parser', () => {
    assert.deepEqual(p.spells.map((s) => [s.name, s.force]), [['Manabolt', 5], ['Heal', 4], ['Levitate', 3], ['Mask', 3], ['Detect Enemies', 4]]);
    assert.equal(p.spells.find((s) => s.name === 'Heal')?.exclusive, true);
    assert.equal(plan.items.filter((i) => i.type === 'spell').length, 5);
  });
  test('foci, armor section, table armor, patches', () => {
    const pf = plan.items.find((i) => i.name === 'Power focus');
    assert.deepEqual(pf?.system, { focusType: 'power', rating: 2, bonded: true, active: true });
    const sf = plan.items.find((i) => i.name === 'Spell focus');
    assert.equal(sf?.system['category'], 'combat');
    assert.equal(sf?.system['rating'], 3);
    assert.deepEqual(plan.items.find((i) => i.name === 'Armor vest')?.system, { ballistic: 2, impact: 1, worn: true });
    assert.deepEqual(plan.items.find((i) => i.name === 'Lined coat')?.system, { ballistic: 4, impact: 2, worn: true });
    assert.deepEqual(plan.items.find((i) => i.name === 'Stim patch')?.system, { quantity: 3, patch: { kind: 'stim', rating: 4 } });
    assert.equal(plan.items.find((i) => i.name === 'Ceska Black Scorpion')?.system['modes'], 'SA/BF');
  });
  test('contacts with loyalty and "friend for life"', () => {
    assert.deepEqual(p.contacts[0], { name: 'Old Lou', role: 'Talismonger', level: 1, loyalty: 3, notes: '' });
    assert.deepEqual(p.contacts[1], { name: 'Sister Morrow', role: 'Street doc', level: 3, notes: '' });
  });
  test('separate Edges and Flaws sections', () => {
    assert.deepEqual(p.qualities.map((q) => [q.name, q.kind, q.points, q.notes]), [['Bonus spell', 'edge', 2, ''], ['Allergy', 'flaw', 2, 'Mild, Pollen']]);
  });
  test('nuyen with a dot for thousands, karma lines, lifestyle', () => {
    assert.equal(p.nuyen, 2750);
    assert.deepEqual(p.karma, { good: 4, total: 12 });
    assert.deepEqual(p.lifestyle, { name: 'Low', level: 'low', months: 3 });
  });
  test('biography paragraphs and physical lines', () => {
    assert.match(p.biography, /Grew up in the Barrens\.\n\nRaven called her at twelve\./);
    assert.match(p.biography, /Age: 24/);
    assert.match(p.biography, /Height: 1\.80 m/);
    assert.match(String(plan.actorUpdate['system.biography']), /<p>Grew up in the Barrens\.<\/p><p>Raven called her at twelve\.<\/p>/);
  });
  test('no stray warnings about lines', () => {
    assert.deepEqual(p.unknown, []);
  });
});

describe('edge cases', () => {
  test('header row and attribute lines give the same attributes', () => {
    const a = parseCharacterSheet('B Q S C I W E M R\n4 5 (6) 3 2 4 3 5.5 - 5 (7)');
    const b = parseCharacterSheet('Body 4\nQuickness: 5 (6)\nStr 3\nCha 2\nInt 4\nWil 3\nEssence 5.5\nReaction 5 (7)');
    assert.deepEqual(a.attributes, b.attributes);
    assert.equal(a.essence, b.essence);
    assert.deepEqual(a.reaction, b.reaction);
  });
  test('attributes on one comma line after an "Attributes:" label', () => {
    const p = parseCharacterSheet('Attributes: Body 5, Quickness 4 (6), Strength 3, Charisma 2, Intelligence 5, Willpower 4');
    assert.equal(Object.keys(p.attributes).length, 6);
    assert.deepEqual(p.attributes.quickness, { base: 4, augmented: 6 });
  });
  test('initiative line with augmented form in parentheses', () => {
    const p = parseCharacterSheet('Initiative: 4 + 1D6 (8 + 3D6)');
    assert.equal(p.initiativeDice, 3);
    assert.deepEqual(p.reaction, { base: 4, augmented: 8 });
  });
  test('metatype variants', () => {
    assert.deepEqual(metatypeFromText('Orc'), { id: 'ork', variant: false });
    assert.deepEqual(metatypeFromText('elven'), { id: 'elf', variant: false });
    assert.deepEqual(metatypeFromText('Dwarves'), { id: 'dwarf', variant: false });
    assert.deepEqual(metatypeFromText('TROLL'), { id: 'troll', variant: false });
    assert.deepEqual(metatypeFromText('Homo sapiens robustus'), { id: 'ork', variant: false });
    assert.deepEqual(metatypeFromText('Elf (Night One)'), { id: 'elf', variant: true });
    assert.deepEqual(metatypeFromText('Gnome'), { id: 'dwarf', variant: true });
    assert.equal(metatypeFromText('Dragon'), null);
    const p = parseCharacterSheet('Race: Dragon');
    assert.equal(p.metatype, undefined);
    assert.ok(p.warnings.some((w) => /Metatype "Dragon" not recognised/.test(w)));
    const v = parseCharacterSheet('Race: Fomori');
    assert.equal(v.metatype, 'troll');
    assert.ok(v.warnings.some((w) => /metavariant/.test(w)));
  });
  test('karma forms', () => {
    assert.deepEqual(parseKarmaText('Karma: 5 (total 23)'), { good: 5, total: 23 });
    assert.deepEqual(parseKarmaText('Good Karma 5'), { good: 5 });
    assert.deepEqual(parseKarmaText('Karma Pool 2'), { pool: 2 });
    assert.deepEqual(parseKarmaText('Karma: 5/23'), { good: 5, total: 23 });
    assert.deepEqual(parseKarmaText('Karma: 23 total, 5 unspent, pool 3'), { good: 5, total: 23, pool: 3 });
    assert.deepEqual(parseKarmaText('Total Karma: 1,120'), { total: 1120 });
  });
  test('nuyen forms', () => {
    assert.equal(parseNuyen('12,500¥'), 12500);
    assert.equal(parseNuyen('¥12,500'), 12500);
    assert.equal(parseNuyen('12.500 nuyen'), 12500);
    assert.equal(parseNuyen('12 500 ¥ (certified credstick)'), 12500);
    assert.equal(parseNuyen('1,234,567'), 1234567);
    assert.equal(parseNuyen('12.5k'), 12500);
    assert.equal(parseNuyen('750'), 750);
    assert.equal(parseNuyen('none'), null);
    assert.equal(parseCharacterSheet('Cash: 3,000¥').nuyen, 3000);
    assert.equal(parseCharacterSheet('Nuyen 450').nuyen, 450);
  });
  test('lifestyles', () => {
    assert.deepEqual(parseLifestyle('Medium, 1 year'), { name: 'Middle', level: 'middle', months: 12 });
    assert.deepEqual(parseLifestyle('Squatter'), { name: 'Squatter', level: 'squatter' });
    assert.equal(parseLifestyle('Opulent'), null);
  });
  test('gear quantities', () => {
    const p = parseCharacterSheet('Gear: 2x Flash-pak, Ammo x50, Flare x 3, Rope (qty 2), 3 Doses of Jazz, Medkit');
    const q = Object.fromEntries(p.gear.map((g) => [g.name, g.quantity]));
    assert.deepEqual(q, { 'Flash-pak': 2, Ammo: 50, Flare: 3, Rope: 2, 'Doses of Jazz': 3, Medkit: 1 });
  });
  test('same gear twice adds up', () => {
    const p = parseCharacterSheet('Gear: Flash-pak, Flash-pak x2');
    assert.equal(p.gear.length, 1);
    assert.equal(p.gear[0]?.quantity, 3);
  });
  test('unknown lines are warned about and kept in the notes', () => {
    const p = parseCharacterSheet('Name: Test\nBody 4\nFavourite colour: teal\nsomething odd');
    assert.deepEqual(p.unknown, ['Favourite colour: teal', 'something odd']);
    assert.ok(p.warnings.some((w) => w.includes('Favourite colour: teal')));
    assert.match(p.notes, /Not imported:\nFavourite colour: teal\nsomething odd/);
  });
  test('dice pools are not imported (derived)', () => {
    const p = parseCharacterSheet('Combat Pool: 7');
    assert.ok(p.warnings.some((w) => /worked out by the system/.test(w)));
  });
  test('multiple labels on one line', () => {
    const p = parseCharacterSheet('Name: Ghost    Metatype: Elf    Archetype: Decker');
    assert.equal(p.name, 'Ghost');
    assert.equal(p.metatype, 'elf');
    assert.equal(p.archetype, 'Decker');
  });
  test('contact forms', () => {
    assert.deepEqual(parseContactEntry('Fixer (Level 2)'), { name: 'Fixer', role: 'Fixer', level: 2, notes: '' });
    assert.deepEqual(parseContactEntry('Mr. Johnson (Buddy)'), { name: 'Mr. Johnson', role: 'Mr. Johnson', level: 2, notes: '' });
    assert.deepEqual(parseContactEntry('Kim Lee — Corp secretary (2, owes me one)'), { name: 'Kim Lee', role: 'Corp secretary', level: 2, notes: 'owes me one' });
    assert.deepEqual(parseContactEntry('Tanya Vask'), { name: 'Tanya Vask', role: '', level: 1, notes: '' });
  });
  test('edges and flaws without a section kind', () => {
    const w: string[] = [];
    assert.deepEqual(parseQualityEntry('Ambidextrous (+2)', 'qualities', (x) => w.push(x)), { name: 'Ambidextrous', kind: 'edge', points: 2, notes: '' });
    assert.deepEqual(parseQualityEntry('Phobia (snakes) 2', 'qualities', (x) => w.push(x)), { name: 'Phobia', kind: 'flaw', points: 2, notes: 'snakes' });
    assert.deepEqual(parseQualityEntry('Flaw: Sinner', 'qualities', (x) => w.push(x)), { name: 'Sinner', kind: 'flaw', points: 1, notes: '' });
    assert.ok(w.some((x) => /Sinner: no point value/.test(x)));
  });
  test('"Edges: A; Flaws: B" on one line', () => {
    const p = parseCharacterSheet('Edges: Toughness +3; Flaws: Bad Luck -4');
    assert.deepEqual(p.qualities.map((q) => [q.name, q.kind, q.points]), [['Toughness', 'edge', 3], ['Bad Luck', 'flaw', 4]]);
  });
  test('adept: a plain "Powers:" list are adept powers, tradition from them', () => {
    const p = parseCharacterSheet('Magic 6\nPowers: Improved Reflexes 2, Killing Hands (S), Increased Strength 2\nStrength 4 (6)');
    assert.equal(p.tradition, 'adept');
    const plan = characterImportPlan(p);
    assert.equal(plan.items.filter((i) => i.type === 'adeptpower').length, 3);
    // Increased Strength 2 already gives the +2: no manual mod.
    assert.equal(plan.actorUpdate['system.attributes.strength.mod'], 0);
    assert.equal(plan.actorUpdate['system.tradition'], 'adept');
  });
  test('silly values are clamped and flagged', () => {
    const p = parseCharacterSheet('Metatype: Human\nBody 0\nQuickness 25\nEssence 7.5\nMagic 9\nContacts: Bob (Level 5)\nLifestyle: High (200 months)');
    const plan = characterImportPlan(p);
    assert.equal(plan.actorUpdate['system.attributes.body.base'], 1);
    assert.equal(plan.actorUpdate['system.attributes.quickness.base'], 20);
    assert.equal(plan.after.essenceShown, 6);
    assert.equal(plan.contacts?.[0]?.['level'], 3);
    assert.equal(plan.after.lifestyleMonths, 120);
    for (const re of [/Body 0/, /Quickness 25/, /Essence 7\.5/, /Magic 9/, /level 5/, /natural maximum/]) assert.ok(plan.warnings.some((w) => re.test(w)), String(re));
  });
  test('existing contacts and qualities are kept, same names updated', () => {
    const p = parseCharacterSheet('Contacts: Fixer (Level 3)\nEdges: Toughness (+2)');
    const plan = characterImportPlan(p, {
      contacts: [{ id: 'a', name: 'Fixer', level: 1, role: 'Fixer', notes: 'old', loyalty: 4, skills: '', fee: 100, dice: 0, favours: 2 }, { id: 'b', name: 'Other', level: 1 }],
      qualities: [{ id: 'q', name: 'Toughness', kind: 'edge', points: 1, target: '', tn: 0, notes: '' }],
      notes: '<p>old notes</p>',
    });
    assert.deepEqual(plan.contacts?.map((c) => [c['id'], c['name'], c['level'], c['fee'], c['loyalty']]), [['a', 'Fixer', 3, 100, 4], ['b', 'Other', 1, undefined, undefined]]);
    assert.deepEqual(plan.qualities?.map((q) => [q['id'], q['points']]), [['q', 2]]);
  });
  test('header row armor becomes one armor item when no armor is listed', () => {
    const plan = characterImportPlan(parseCharacterSheet('B Q S C I W E M R Armor\n4 4 4 3 3 3 6 - 4 5/3'));
    assert.deepEqual(plan.items.find((i) => i.type === 'armor'), { type: 'armor', name: 'Armor (imported)', system: { ballistic: 5, impact: 3, worn: true } });
  });
  test('empty text', () => {
    const plan = characterImportPlan(parseCharacterSheet(''));
    assert.deepEqual(plan.actorUpdate, {});
    assert.deepEqual(plan.items, []);
    assert.ok(plan.warnings.includes('Nothing was recognised in the text.'));
  });
});

describe('v0.66.0 review fixes (import)', () => {
  test('an item listed twice is made once (the last)', () => {
    const plan = characterImportPlan(parseCharacterSheet('Skills: Firearms 3, Firearms 5'));
    const f = plan.items.filter((i) => i.type === 'skill' && i.name === 'Firearms');
    assert.equal(f.length, 1);
    assert.equal(f[0]!.system['rating'], 5);
  });
});
