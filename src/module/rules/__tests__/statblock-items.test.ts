import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseStatBlock, statBlockItems, statBlockAttributeBonuses, STAT_BLOCK_ITEM_CHOICES as C, type StatBlockItem } from '../statblock.ts';
import { RULES } from '../config.ts';
import { POWER_DICE_SOURCES, POWER_RESIST } from '../powers.ts';

// Invented samples in the general SR2 layout; not copied from any book.
const FULL = `Street Samurai Mage-Hunter
B  Q  S  C  I  W  E   M  R      Armor
5  6  6  2  4  4  0.4 -  6 (10) 5/3
Initiative: 10 + 3D6
Karma Pool/Professional Rating: 2/4
Skills: Firearms 6, Unarmed Combat 5, Sorcery 4
Cyberware: Alpha Wired Reflexes 2, Smartlink, Dermal Plating 2,
  Cybereyes (low-light, thermographic, flare compensation), Datajack,
  Retractable Spur, Cyberarm (Strength 6) [Essence 1], Headware Radio,
  Muscle Replacement 2 (beta), Skillwires 3, Encephalon 1, Muscle Augmentation 1
Bioware: Synaptic Accelerator 1 (cultured), Platelet Factory [BI .4], Orthoskin 2
Spells: Manabolt 5, Heal (4), Stunball 6, Improved Invisibility 4,
  Armor 3 (exclusive), Fireball 5 [Drain +1 S], Frobnicate 3
Powers: Enhanced Senses (low-light, thermographic), Fear, Engulf
Critter Powers: Essence Drain, Regeneration, Dual Natured, Immunity to Normal Weapons
Weaknesses: Allergy (sunlight, severe), Vulnerability (iron)
Gear: Armor jacket, Heavy pistol [9M]`;

const ADEPT = `Adept Bodyguard
B  Q  S  C  I  W  E  M  R
5  6  5  3  4  5  6  5  5 (9)
Skills: Unarmed Combat 6, Firearms 5
Powers: Improved Reflexes 2, Killing Hands (S), Increased Body 2, Combat Sense 2,
  Pain Resistance 3, Improved Ability (Firearms) 2, Astral Perception, Levitation Dance`;

const byName = (items: StatBlockItem[], name: string) => {
  const i = items.find((x) => x.name === name);
  assert.ok(i, `no item named ${name}`);
  return i;
};

describe('statblock items: parsing cyberware', () => {
  const p = parseStatBlock(FULL);
  const cw = (name: string) => {
    const c = p.cyberware.find((x) => x.name === name);
    assert.ok(c, `no cyberware ${name}`);
    return c;
  };
  test('reads every entry across wrapped lines, both sections', () => {
    assert.equal(p.cyberware.length, 15);
    assert.deepEqual(p.cyberware.filter((c) => c.bioware).map((c) => c.name), ['Muscle Augmentation', 'Synaptic Accelerator', 'Platelet Factory', 'Orthoskin']);
  });
  test('rating and grade forms', () => {
    assert.deepEqual({ ...cw('Wired Reflexes') }, { name: 'Wired Reflexes', rating: 2, grade: 'alpha', options: '', bioware: false });
    assert.equal(cw('Muscle Replacement').grade, 'beta');
    assert.equal(cw('Muscle Replacement').rating, 2);
    assert.equal(cw('Smartlink').rating, 0);
    const q = parseStatBlock('Cyber: Wired Reflexes (3), Boosted Reflexes 2 Delta, Dermal Plating (2, alpha)');
    assert.deepEqual(q.cyberware.map((c) => [c.name, c.rating, c.grade]), [
      ['Wired Reflexes', 3, 'standard'], ['Boosted Reflexes', 2, 'delta'], ['Dermal Plating', 2, 'alpha'],
    ]);
  });
  test('essence, body index and options', () => {
    assert.equal(cw('Cyberarm').essence, 1);
    assert.equal(cw('Cyberarm').options, 'Strength 6');
    assert.equal(cw('Cybereyes').options, 'low-light, thermographic, flare compensation');
    assert.equal(cw('Platelet Factory').bodyIndex, 0.4);
    const q = parseStatBlock('Cyberware: Datajack (.5 E), Smartlink (2 Essence), Wired Reflexes 1 [Essence 2.0]');
    assert.deepEqual(q.cyberware.map((c) => c.essence), [0.5, 2, 2]);
  });
});

describe('statblock items: parsing spells and powers', () => {
  const p = parseStatBlock(FULL);
  test('spells: force, category, type, area, options, elemental, drain', () => {
    assert.deepEqual(p.spells.map((s) => [s.name, s.force, s.category, s.spellType, s.area]), [
      ['Manabolt', 5, 'combat', 'mana', false], ['Heal', 4, 'health', 'mana', false], ['Stunball', 6, 'combat', 'mana', true],
      ['Improved Invisibility', 4, 'illusion', 'physical', false], ['Armor', 3, 'manipulation', 'physical', false],
      ['Fireball', 5, 'manipulation', 'physical', true], ['Frobnicate', 3, 'manipulation', 'mana', false],
    ]);
    const s = p.spells;
    assert.equal(s[2]?.damageType, 'stun');
    assert.equal(s[4]?.exclusive, true);
    assert.equal(s[1]?.heals, true);
    assert.equal(s[5]?.elemental, true);
    assert.equal(s[5]?.element, 'fire');
    assert.deepEqual(s[5]?.drain, { modifier: 1, level: 'S' });
  });
  test('unknown spell names give a warning, not a crash', () => {
    assert.ok(p.warnings.some((w) => w.includes('"Frobnicate"')));
    assert.equal(p.spells[6]?.known, false);
    const q = parseStatBlock('Spells: Hellbolt 4, Detect Foes 3, Increase Quickness 4, Heal');
    assert.equal(q.spells[0]?.category, 'combat');
    assert.equal(q.spells[1]?.category, 'detection');
    assert.equal(q.spells[2]?.known, true);
    assert.ok(q.warnings.some((w) => w.includes('"Heal" has no Force')));
  });
  test('powers: sections, weaknesses, options', () => {
    assert.deepEqual(p.powers.map((x) => [x.name, x.section, x.adept, x.weakness]), [
      ['Enhanced Senses', 'powers', false, false], ['Fear', 'powers', false, false], ['Engulf', 'powers', false, false],
      ['Essence Drain', 'critter', false, false], ['Regeneration', 'critter', false, false], ['Dual Natured', 'critter', false, false],
      ['Immunity to Normal Weapons', 'critter', false, false],
      ['Allergy', 'weaknesses', false, true], ['Vulnerability', 'weaknesses', false, true],
    ]);
    assert.equal(p.powers[7]?.options, 'sunlight, severe');
  });
  test('adept powers are recognised for a Magic-rated non-magician', () => {
    const q = parseStatBlock(ADEPT);
    assert.ok(q.powers.filter((x) => x.name !== 'Levitation Dance').every((x) => x.adept));
    assert.equal(q.powers.find((x) => x.name === 'Killing Hands')?.level, 'S');
    assert.equal(q.powers.find((x) => x.name === 'Improved Ability')?.options, 'Firearms');
    assert.equal(q.powers.find((x) => x.name === 'Improved Ability')?.rating, 2);
  });
  test('an "Adept Powers" label always means adept', () => {
    const q = parseStatBlock('Adept Powers: Combat Sense 1');
    assert.equal(q.powers[0]?.adept, true);
  });
});

describe('statblock items: empty and old blocks', () => {
  test('no sections give empty arrays', () => {
    const p = parseStatBlock('B Q S C I W\n3 3 3 3 3 3');
    assert.deepEqual([p.cyberware, p.spells, p.powers], [[], [], []]);
    assert.deepEqual(statBlockItems(p), { items: [], warnings: [] });
  });
  test('empty section labels give empty arrays', () => {
    const p = parseStatBlock('Cyberware:\nSpells:\nPowers:');
    assert.deepEqual([p.cyberware, p.spells, p.powers], [[], [], []]);
  });
  test('junk entries never throw', () => {
    const p = parseStatBlock('Cyberware: (), [Essence 2], ???\nSpells: (4)\nPowers: ()');
    assert.doesNotThrow(() => statBlockItems(p));
  });
});

describe('statBlockItems: cyberware and bioware data', () => {
  const p = parseStatBlock(FULL);
  const { items, warnings } = statBlockItems(p);
  test('one item per entry with the right types', () => {
    assert.equal(items.filter((i) => i.type === 'cyberware').length, 15);
    assert.equal(items.filter((i) => i.type === 'spell').length, 7);
    assert.equal(items.filter((i) => i.type === 'power').length, 9);
  });
  test('wired reflexes: kind, reflexes, Reaction, dice, grade, guessed Essence', () => {
    const s = byName(items, 'Wired Reflexes').system;
    assert.equal(s.kind, 'reflexes');
    assert.equal(s.reflexes, 'wired');
    assert.equal(s.reaction, 4);
    assert.equal(s.initiativeDice, 2);
    assert.equal(s.grade, 'alpha');
    assert.equal(s.essenceCost, 3);
  });
  test('given Essence is stored as the standard cost; guesses are listed', () => {
    assert.equal(byName(items, 'Cyberarm').system.essenceCost, 1);
    assert.ok(warnings.some((w) => w.startsWith('Essence guessed') && w.includes('Wired Reflexes (2.4)') && !w.includes('Cyberarm')));
  });
  test('effect fields', () => {
    assert.equal(byName(items, 'Smartlink').system.smartlink, true);
    assert.equal(byName(items, 'Smartlink').system.smartlinkLevel, 1);
    assert.equal(byName(items, 'Dermal Plating').system.armorBallistic, 2);
    const eyes = byName(items, 'Cybereyes').system;
    assert.deepEqual([eyes.kind, eyes.lowLight, eyes.thermographic, eyes.flareComp, eyes.essenceCost], ['eyes', true, true, true, 0.2]);
    // v0.78.0 (BOOK_V78.senseAllowance): eyes 0.2 + low-light, thermographic and flare compensation (0.5) free inside cybereyes (was 0.7).
    assert.equal(byName(items, 'Datajack').system.kind, 'datajack');
    assert.deepEqual(byName(items, 'Cyberarm').system.limb, { location: 'rightArm', strength: 6 });
    assert.deepEqual((byName(items, 'Muscle Replacement').system.attributes as any).strength, 2);
    assert.deepEqual([byName(items, 'Skillwires').system.kind, byName(items, 'Skillwires').system.rating], ['skillwires', 3]);
    assert.equal(byName(items, 'Encephalon').system.kind, 'encephalon');
  });
  test('cyberweapon links the unarmed skill when not also listed as a weapon', () => {
    const s = byName(items, 'Retractable Spur').system;
    assert.equal(s.kind, 'cyberweapon');
    assert.deepEqual(s.weapon, { strengthPower: true, damagePower: 0, damageLevel: 'M', damageType: 'physical', reach: 0, skill: 'Unarmed Combat' });
    const q = parseStatBlock('Cyberware: Retractable Spur\nGear: Retractable spur [(STR)M]');
    const r = statBlockItems(q);
    assert.equal(r.items[0]?.system.kind, 'other');
    assert.ok(r.warnings.some((w) => w.includes('also a weapon')));
  });
  test('bioware: flagged, kind, rating at least 1, Body Index, no Essence', () => {
    const ma = byName(items, 'Muscle Augmentation').system;
    assert.deepEqual([ma.bioware, ma.bioKind, ma.rating, ma.essenceCost], [true, 'muscleAugmentation', 1, 0]);
    const sa = byName(items, 'Synaptic Accelerator').system;
    assert.equal(sa.cultured, true);
    assert.equal(byName(items, 'Platelet Factory').system.bodyIndex, 0.4);
    assert.equal(byName(items, 'Platelet Factory').system.rating, 1);
    assert.ok(warnings.some((w) => w.startsWith('Body Index guessed') && w.includes('Orthoskin (0.5)') && !w.includes('Platelet')));
  });
  test('unknown cyberware warns and gets Essence 0', () => {
    const r = statBlockItems(parseStatBlock('Cyberware: Gizmo Implant 2, Wired Reflexes'));
    assert.equal(r.items[0]?.system.kind, 'other');
    assert.equal(r.items[0]?.system.essenceCost, 0);
    assert.ok(r.warnings.some((w) => w.includes('"Gizmo Implant" not recognised')));
    assert.ok(r.warnings.some((w) => w.includes('Essence unknown') && w.includes('Gizmo Implant')));
    assert.ok(r.warnings.some((w) => w.includes('Wired Reflexes: no rating given; assumed 1')));
    assert.equal(r.items[1]?.system.essenceCost, 2);
  });
  test('Bioware word in a Cyberware list is bioware', () => {
    // v0.72.0 (O9): suprathyroid is modelled now; a reflex recorder still isn't.
    const r = statBlockItems(parseStatBlock('Cyberware: Pain Editor, Trauma Damper 2, Suprathyroid Gland, Reflex Recorder'));
    assert.deepEqual(r.items.map((i) => [i.system.bioware, i.system.bioKind]), [[true, 'painEditor'], [true, 'traumaDamper'], [true, 'suprathyroid'], [true, 'other']]);
    assert.ok(r.warnings.some((w) => w.includes('Reflex Recorder: its effects are not applied')));
    assert.ok(!r.warnings.some((w) => w.includes('Suprathyroid Gland: its effects are not applied')));
  });
});

describe('statBlockItems: spells and powers data', () => {
  const p = parseStatBlock(FULL);
  const { items, warnings } = statBlockItems(p);
  test('spell fields', () => {
    const m = byName(items, 'Manabolt').system;
    assert.deepEqual([m.category, m.spellType, m.learnedForce, m.damageType, m.duration, m.area], ['combat', 'mana', 5, 'physical', 'instant', false]);
    const h = byName(items, 'Heal').system;
    assert.deepEqual([h.heals, h.healTrack, h.duration], [true, 'physical', 'permanent']);
    const f = byName(items, 'Fireball').system;
    assert.deepEqual([f.elemental, f.element, f.drainModifier, f.drainLevel, f.area], [true, 'fire', 1, 'S', true]);
    assert.equal(byName(items, 'Armor').system.exclusive, true);
    assert.ok(warnings.some((w) => w.startsWith('Drain not given') && w.includes('Manabolt') && !w.includes('Fireball')));
  });
  test('critter powers and weaknesses', () => {
    assert.equal(byName(items, 'Fear').system.active, true);
    assert.equal(byName(items, 'Engulf').system.effect, 'damage');
    assert.equal(byName(items, 'Enhanced Senses').system.active, false);
    assert.equal(byName(items, 'Enhanced Senses').system.notes, 'low-light, thermographic');
    assert.equal(byName(items, 'Essence Drain').system.special, 'essenceDrain');
    assert.equal(byName(items, 'Regeneration').system.special, 'regeneration');
    assert.equal(byName(items, 'Dual Natured').system.special, 'dualNatured');
    const al = byName(items, 'Allergy').system;
    assert.deepEqual([al.special, al.substance, al.severity, al.active], ['allergy', 'sunlight', 'severe', false]);
    assert.deepEqual([byName(items, 'Vulnerability').system.special, byName(items, 'Vulnerability').system.substance], ['vulnerability', 'iron']);
    // v0.56.0: immunities are a Special with what they cover.
    assert.deepEqual([byName(items, 'Immunity to Normal Weapons').system.special, byName(items, 'Immunity to Normal Weapons').system.substance], ['immunity', 'Normal Weapons']);
    assert.equal(byName(items, 'Fear').system.special, 'fear');
  });
  test('adept powers', () => {
    const r = statBlockItems(parseStatBlock(ADEPT));
    const s = (n: string) => byName(r.items, n);
    assert.ok(r.items.filter((i) => i.name !== 'Levitation Dance').every((i) => i.type === 'adeptpower'));
    assert.deepEqual([s('Improved Reflexes').system.reaction ?? 0, s('Improved Reflexes').system.initiativeDice, s('Improved Reflexes').system.level], [0, 2, 2]); // v0.77.0: dice only
    assert.deepEqual([s('Killing Hands').system.special, s('Killing Hands').system.level], ['killingHands', 3]); // v0.77.0: (S) = level 3 of L/M/S/D
    assert.equal((s('Increased Body').system.attributes as any).body, 2);
    assert.deepEqual([s('Combat Sense').system.special, s('Combat Sense').system.level], ['combatSense', 2]);
    assert.equal(s('Pain Resistance').system.special, 'painResistance');
    assert.deepEqual([s('Improved Ability').system.skill, s('Improved Ability').system.skillDice], ['Firearms', 2]);
    assert.deepEqual([s('Astral Perception').system.special, s('Astral Perception').system.level], ['astralPerception', 1]);
    assert.ok(r.warnings.some((w) => w.startsWith('Adept power point costs guessed')));
    // Not an adept power name: stays a critter power, with a warning.
    assert.equal(s('Levitation Dance').type, 'power');
    assert.ok(r.warnings.some((w) => w.includes('"Levitation Dance" not recognised')));
  });
  test('ctx.adept overrides the guess for a plain Powers list', () => {
    const p2 = parseStatBlock('Powers: Combat Sense 2');
    assert.equal(statBlockItems(p2).items[0]?.type, 'power');
    assert.equal(statBlockItems(p2, { adept: true }).items[0]?.type, 'adeptpower');
    const p3 = parseStatBlock(ADEPT);
    assert.ok(statBlockItems(p3, { adept: false }).items.every((i) => i.type === 'power'));
  });
  test('attribute bonuses the items add (to subtract from manual modifiers)', () => {
    assert.deepEqual(statBlockAttributeBonuses(items), { strength: 3, quickness: 2 });
    assert.deepEqual(statBlockAttributeBonuses(statBlockItems(parseStatBlock(ADEPT)).items), { body: 2 });
  });
});

describe('statBlockItems: every value is valid for the item models', () => {
  // Inline choices copied from src/module/models/index.ts (models can't load outside Foundry).
  const SPELL_TYPES = ['mana', 'physical'];
  const LEVELS = ['L', 'M', 'S', 'D'];
  const DAMAGE_TYPES = ['physical', 'stun'];
  const SPELL_RESIST = ['none', 'body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'];
  const LIMBS = RULES.CYBERWARE.limbs.locations;
  const all = [...statBlockItems(parseStatBlock(FULL)).items, ...statBlockItems(parseStatBlock(ADEPT)).items,
    ...statBlockItems(parseStatBlock('Cyberware: Boosted Reflexes 3, Reaction Enhancers 2, Vehicle Control Rig 2, Tailored Pheromones 1, Cyberleg (left, Quickness 5), Hand Razors, Smartlink 2, Headware Memory 100 Mp, Bone Lacing (titanium), Cyberears (damper), Adrenal Pump 1, Damage Compensator 2\nSpells: Stunbolt 4, Lightning Bolt 5, Mind Probe 4, Decrease Body 3, Sleep 4 (fetish), Toxic Wave 6\nPowers: Influence, Venom 4, Allergy to silver (mild), Essence Loss, Mystic Armor 2')).items];
  const inList = (v: unknown, list: readonly unknown[], what: string) => assert.ok(list.includes(v), `${what}: ${String(v)} not in ${list.join('|')}`);
  const int = (v: unknown, what: string, min = 0) => assert.ok(Number.isInteger(v) && (v as number) >= min, `${what}: ${String(v)} is not an integer >= ${min}`);
  const num = (v: unknown, what: string) => assert.ok(typeof v === 'number' && v >= 0 && Number.isFinite(v), `${what}: ${String(v)} is not a number >= 0`);

  test('only the four item types', () => {
    for (const i of all) inList(i.type, ['cyberware', 'spell', 'power', 'adeptpower'], 'type');
  });
  test('cyberware', () => {
    for (const { name, type, system: s } of all.filter((i) => i.type === 'cyberware')) {
      const w = `${type} ${name}`;
      inList(s.kind, C.cyberwareKinds, `${w} kind`);
      inList(s.grade, C.grades, `${w} grade`);
      if ('reflexes' in s) inList(s.reflexes, C.reflexTypes, `${w} reflexes`);
      if ('bioKind' in s) inList(s.bioKind, C.bioKinds, `${w} bioKind`);
      num(s.essenceCost, `${w} essenceCost`);
      if ('bodyIndex' in s) num(s.bodyIndex, `${w} bodyIndex`);
      int(s.rating, `${w} rating`);
      for (const k of ['reaction', 'initiativeDice', 'armorBallistic', 'armorImpact', 'controlRig', 'pheromones']) if (k in s) int(s[k], `${w} ${k}`);
      if ('smartlinkLevel' in s) assert.ok([0, 1, 2].includes(s.smartlinkLevel as number));
      if ('magnification' in s) assert.ok([0, 1, 2, 3].includes(s.magnification as number));
      if (s.limb) inList((s.limb as any).location, LIMBS, `${w} limb`);
      if (s.weapon) {
        inList((s.weapon as any).damageLevel, LEVELS, `${w} weapon level`);
        inList((s.weapon as any).damageType, DAMAGE_TYPES, `${w} weapon type`);
      }
      if (s.attributes) assert.deepEqual(Object.keys(s.attributes as object).sort(), ['body', 'charisma', 'intelligence', 'quickness', 'strength', 'willpower']);
    }
  });
  test('spells', () => {
    for (const { name, system: s } of all.filter((i) => i.type === 'spell')) {
      inList(s.category, C.spellCategories, `${name} category`);
      inList(s.spellType, SPELL_TYPES, `${name} spellType`);
      inList(s.duration, C.spellDurations, `${name} duration`);
      inList(s.resist, SPELL_RESIST, `${name} resist`);
      if ('learnedForce' in s) int(s.learnedForce, `${name} learnedForce`, 1);
      if ('damageType' in s) inList(s.damageType, DAMAGE_TYPES, `${name} damageType`);
      if ('damageLevel' in s) inList(s.damageLevel, LEVELS, `${name} damageLevel`);
      if ('drainLevel' in s) inList(s.drainLevel, LEVELS, `${name} drainLevel`);
      if ('healTrack' in s) inList(s.healTrack, DAMAGE_TYPES, `${name} healTrack`);
      if (s.elemental) assert.ok(String(s.element) in RULES.MAGIC_V39.elementEffects, `${name} element`);
    }
  });
  test('critter powers', () => {
    for (const { name, system: s } of all.filter((i) => i.type === 'power')) {
      if ('special' in s) inList(s.special, C.powerSpecials, `${name} special`);
      if ('severity' in s) inList(s.severity, C.allergySeverities, `${name} severity`);
      if ('dice' in s) inList(s.dice, POWER_DICE_SOURCES, `${name} dice`);
      if ('resist' in s) inList(s.resist, POWER_RESIST, `${name} resist`);
      if ('effect' in s) inList(s.effect, ['effect', 'damage'], `${name} effect`);
      if ('damageType' in s) inList(s.damageType, DAMAGE_TYPES, `${name} damageType`);
      if ('rating' in s) int(s.rating, `${name} rating`);
      assert.equal(typeof s.active, 'boolean');
    }
  });
  test('adept powers', () => {
    for (const { name, system: s } of all.filter((i) => i.type === 'adeptpower')) {
      if ('special' in s) inList(s.special, C.adeptSpecials, `${name} special`);
      int(s.level, `${name} level`);
      if ('cost' in s) num(s.cost, `${name} cost`);
      for (const k of ['reaction', 'initiativeDice', 'skillDice', 'ballistic', 'impact']) if (k in s) int(s[k], `${name} ${k}`);
    }
  });
  test('the sample covers the extra kinds', () => {
    const names = all.map((i) => `${i.name}:${String(i.system.kind ?? i.system.special ?? i.system.category)}`);
    for (const n of ['Reaction Enhancers:reflexes', 'Tailored Pheromones:pheromones', 'Cyberleg:cyberlimb', 'Hand Razors:cyberweapon', 'Headware Memory:memory', 'Essence Loss:essenceLoss']) {
      assert.ok(names.includes(n), n);
    }
    const leg = all.find((i) => i.name === 'Cyberleg')!.system.limb as any;
    assert.deepEqual(leg, { location: 'leftLeg', quickness: 5 });
    assert.equal(all.find((i) => i.name === 'Smartlink' && i.system.smartlinkLevel === 2)?.type, 'cyberware');
    assert.equal(all.find((i) => i.name === 'Allergy to silver')?.system.substance, 'silver');
  });
});
