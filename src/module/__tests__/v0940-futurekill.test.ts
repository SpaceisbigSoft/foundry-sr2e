/**
 * v0.94.0 ("imports"), Agent B: futurekill's SR2 system → SR2e's character write-up (rules/fkimport.ts). Every case
 * checks the end result through the real import: the converter's text goes through parseCharacterSheet and
 * characterImportPlan, and the plan is asserted (attributes, items by type and name, contacts, edges and flaws, money,
 * Karma, warnings). Fixtures are invented (fixtures/futurekill-*.json), shaped like futurekill's data models.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { futurekillToWriteUp, looksLikeFuturekill, looksLikeSr2eExport, FK_MAX_ENTRIES } from '../rules/fkimport.ts';
import { parseCharacterSheet, characterImportPlan, MAX_SHEET_CHARS, MAX_SHEET_LINE } from '../rules/charimport.ts';

const FIX = join(import.meta.dirname, 'fixtures');
const fixture = (n: string): any => JSON.parse(readFileSync(join(FIX, `futurekill-${n}.json`), 'utf8'));
/** The new strings, until the lead merges them into lang/en.json (then that file has them and this adds nothing). */
const DRAFT = '/home/claude/work/strings-094-B.json';
const draft = (): Record<string, string> => (existsSync(DRAFT) ? JSON.parse(readFileSync(DRAFT, 'utf8')) : {});
before(() => {
  const en = (globalThis as any).__SR2E_EN__ ?? ((globalThis as any).__SR2E_EN__ = {});
  for (const [k, v] of Object.entries(draft())) if (!(k in en)) en[k] = v;
});
const en = (k: string): string => (globalThis as any).__SR2E_EN__?.[k] ?? k;
/** A warning made from a key: its text with any value in each placeholder (so no test hangs on the wording). */
const hasWarning = (ws: string[], key: string) => {
  const k = `SR2E.Import.Futurekill.${key}`;
  const re = new RegExp(`^${en(k).split(/\{\w+\}/).map((p) => p.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('[\\s\\S]*')}$`);
  return ws.some((w) => w === k || re.test(w));
};

function run(data: unknown) {
  const r = futurekillToWriteUp(data);
  const parsed = parseCharacterSheet(r.text);
  const plan = characterImportPlan(parsed, { makeId: () => 'id' });
  const item = (type: string, name: string) => plan.items.find((i) => i.type === type && i.name.toLowerCase() === name.toLowerCase());
  return { r, parsed, plan, item, a: plan.actorUpdate };
}

describe('v0.94.0 futurekill: detection', () => {
  test('a futurekill export is recognised; Nullsheen files, garbage and other JSON are not', () => {
    assert.equal(looksLikeFuturekill(fixture('full')), true);
    assert.equal(looksLikeFuturekill(fixture('adept')), true);
    // futurekill's shape without _stats
    const { _stats, ...noStats } = fixture('mage');
    assert.equal(looksLikeFuturekill(noStats), true);
    for (const bad of [null, undefined, 42, 'text', [], [fixture('full')], {}, { system: 5 }, { street_name: 'X', attributes: { Body: 3 }, edition: 'SR2' }]) {
      assert.equal(looksLikeFuturekill(bad), false, JSON.stringify(bad)?.slice(0, 60));
    }
  });

  test("SR2e's own exports (new id, and an old 'sr2e' world by its data shape) are told apart and answered with a warning", () => {
    const own = { name: 'Own Runner', type: 'character', system: { attributes: { body: { base: 4, mod: 0 } }, metatype: 'elf', racialModifiers: true }, items: [{ name: 'Sample', type: 'adeptpower', system: {} }], _stats: { systemId: 'shadowrun2e_unified' } };
    const old = { ...own, _stats: { systemId: 'sr2e' } };
    for (const d of [own, old]) {
      assert.equal(looksLikeSr2eExport(d), true);
      assert.equal(looksLikeFuturekill(d), true, 'routed here so the player gets the warning');
      const r = futurekillToWriteUp(d);
      assert.equal(r.text, '');
      assert.equal(r.name, 'Own Runner');
      assert.ok(hasWarning(r.warnings, 'sr2eExport'), r.warnings.join(' | '));
    }
    // futurekill's own 'sr2e' exports are not mistaken for SR2e's
    for (const n of ['full', 'adept', 'mage']) assert.equal(looksLikeSr2eExport(fixture(n)), false, n);
  });
});

describe('v0.94.0 futurekill: a full SR2 character through the import', () => {
  const { r, plan, item, a, parsed } = run(fixture('full'));

  test('result fields: name, source, edition, a key from the exported actor id', () => {
    assert.equal(r.name, 'Sample Runner');
    assert.equal(r.source, 'futurekill');
    assert.equal(r.edition, 'SR2');
    assert.equal(r.key, 'futurekill:AbCdEf1234567890');
    assert.equal(a['name'], 'Sample Runner');
    assert.equal(a['system.metatype'], 'ork');
  });

  test('attributes: natural = base + racial (+ edge point); augmented = + installed ware; the import keeps the total', () => {
    // Ork: Body 4+3, Strength 4+2 (+2 Muscle Replacement), Charisma 3-1, Intelligence 4-1, Willpower 3 + edge point.
    assert.match(r.text, /^Body 7$/m);
    assert.match(r.text, /^Quickness 4 \(6\)$/m);
    assert.match(r.text, /^Strength 6 \(8\)$/m);
    assert.equal(a['system.racialModifiers'], false);
    const want: Record<string, number> = { body: 7, quickness: 4, strength: 6, charisma: 2, intelligence: 3, willpower: 4 };
    for (const [k, v] of Object.entries(want)) assert.equal(a[`system.attributes.${k}.base`], v, k);
    // SR2e's own Muscle Replacement item adds the +2, so no extra modifier is left over.
    assert.equal(a['system.attributes.strength.mod'], 0);
    assert.equal(a['system.attributes.quickness.mod'], 0);
    assert.equal(parsed.essence, undefined, 'Essence is worked out from the imported ware');
    assert.equal(parsed.reaction, undefined);
  });

  test('skills of every kind; specialization; native language; names with commas', () => {
    const fa = item('skill', 'Firearms');
    assert.equal(fa?.system.rating, 5);
    assert.equal(fa?.system.specialization, 'Pistols');
    assert.equal(fa?.system.specializationRating, 7);
    assert.equal(item('skill', 'Etiquette')?.system.specialization, 'Street');
    assert.ok(hasWarning(r.warnings, 'concentrationDropped'));
    assert.equal(item('skill', 'Street Gangs Seattle')?.system.kind, 'knowledge');
    assert.equal(item('skill', 'English')?.system.native, true);
    assert.equal(item('skill', 'English')?.system.kind, 'language');
    assert.equal(item('skill', 'Car B/R')?.system.kind, 'buildRepair');
  });

  test('cyberware with grade and graded Essence, bioware, uninstalled ware warned', () => {
    const wr = item('cyberware', 'Wired Reflexes');
    assert.ok(wr);
    assert.equal(wr.system.grade, 'alpha');
    assert.match(r.text, /Alpha Wired Reflexes \[Rating 1, Essence 1\.6\]/);
    assert.ok(item('cyberware', 'Smartlink'));
    assert.ok(item('cyberware', 'Muscle Replacement'));
    const bio = item('cyberware', 'Sample Cartilage');
    assert.equal(bio?.system.bioware, true);
    assert.equal(bio?.system.cultured, true);
    assert.equal(item('cyberware', 'Cybereyes'), undefined);
    assert.ok(hasWarning(r.warnings, 'notInstalled'));
  });

  test('weapons (ranged, Strength-based melee), armor, gear with quantity and rating, ammo', () => {
    const pistol = item('weapon', 'Sample Heavy Pistol');
    assert.equal(pistol?.system.damagePower, 9);
    assert.equal(pistol?.system.damageLevel, 'M');
    assert.equal(pistol?.system.modes, 'SA');
    assert.equal(pistol?.system.ammoMax, 12);
    assert.equal(pistol?.system.smartgun, true);
    const blade = item('weapon', 'Sample Blade');
    assert.equal(blade?.system.strengthPower, true);
    assert.equal(blade?.system.damagePower, 3);
    assert.equal(blade?.system.reach, 1);
    assert.equal(blade?.system.melee, true);
    const vest = item('armor', 'Armor Vest');
    assert.equal(vest?.system.ballistic, 2);
    assert.equal(vest?.system.impact, 1);
    assert.equal(item('gear', 'Medkit')?.system.medkitRating, 3);
    assert.equal(item('gear', 'Rope 20m')?.system.quantity, 2);
    assert.equal(item('gear', 'Regular rounds')?.system.quantity, 50);
    // A weapon with no damage code comes in as gear (comma removed from the name), with a warning.
    assert.equal(item('gear', 'Sample Grenade Smoke')?.system.quantity, 3);
    assert.ok(hasWarning(r.warnings, 'weaponNoDamage'));
  });

  test('contacts (level from the relationship, loyalty), enemies to the notes; edges and flaws', () => {
    const c = plan.contacts ?? [];
    assert.equal(c.length, 2);
    const fixer = c.find((x) => x.name === 'Sample Fixer');
    assert.equal(fixer?.level, 2);
    assert.equal(fixer?.loyalty, 3);
    assert.equal(fixer?.role, 'Fixer');
    assert.equal(c.find((x) => x.name === 'Doe Jane')?.role, 'Talismonger');
    assert.ok(!c.some((x) => /Rival/.test(String(x.name))));
    assert.ok(hasWarning(r.warnings, 'enemy'));
    assert.match(String(a['system.notes']), /Sample Rival/);
    const q = plan.qualities ?? [];
    assert.deepEqual(q.map((x) => [x.name, x.kind, x.points]), [['Sample Grit', 'edge', 1], ['Sample Allergy', 'flaw', 2]]);
  });

  test('nuyen (a string in the file), Karma good and total, lifestyle item with months paid', () => {
    assert.equal(a['system.nuyen'], 1500);
    assert.equal(a['system.karma.good'], 5);
    assert.equal(a['system.karma.career'], 23);
    assert.equal(a['system.lifestyle.level'], 'middle');
    assert.equal(plan.after.lifestyleMonths, 2);
  });

  test('biography and notes as plain text; a label-like line in them stays text; real name in the notes', () => {
    const bio = String(a['system.biography']);
    assert.match(bio, /born in a sample city/);
    assert.match(bio, /too many, they say &amp; laugh/);
    assert.doesNotMatch(bio, /<p>Contacts:/);
    const notes = String(a['system.notes']);
    assert.match(notes, /Sample Legal Name/);
    assert.match(notes, /Keeps a sample notebook/);
    assert.equal(parsed.unknown.length, 0, parsed.unknown.join(' | '));
  });

  test('what has no place is listed in one warning', () => {
    const w = r.warnings.find((x) => /program/.test(x)) ?? '';
    assert.match(w, /2 × program/);
    assert.match(w, /1 × vehicle mod/);
    assert.doesNotMatch(w, /race/);
  });

  test('re-import: the same file gives the same text and key; renaming keeps the key; items marked to replace', () => {
    const again = futurekillToWriteUp(fixture('full'));
    assert.equal(again.text, r.text);
    assert.equal(again.key, r.key);
    const renamed = fixture('full');
    renamed.name = 'Sample Runner Renamed';
    assert.equal(futurekillToWriteUp(renamed).key, r.key);
    const plan2 = characterImportPlan(parseCharacterSheet(again.text), { itemNames: plan.items.map((i) => ({ type: i.type, name: i.name })), contacts: plan.contacts, qualities: plan.qualities });
    assert.ok(plan2.items.every((i) => i.replace), 'every item updates the one already on the actor');
    assert.equal(plan2.contacts?.length, 2, 'contacts are updated, not doubled');
    assert.equal(plan2.qualities?.length, 2);
    // Without an exported id, the key is the name.
    const { _stats, ...noStats } = fixture('mage');
    assert.equal(futurekillToWriteUp(noStats).key, 'futurekill:sample mage');
  });
});

describe('v0.94.0 futurekill: magic', () => {
  test('a physical adept with a metavariant and numbers as strings', () => {
    const { r, a, item, plan } = run(fixture('adept'));
    // Elf metavariant: its own modifiers (Quickness +1, Charisma +1, Intelligence +1), not the elf table.
    assert.equal(a['system.attributes.quickness.base'], 6);
    assert.equal(a['system.attributes.charisma.base'], 4);
    assert.equal(a['system.attributes.intelligence.base'], 5);
    assert.equal(a['system.attributes.body.base'], 4);
    assert.ok(hasWarning(r.warnings, 'metavariant'));
    // Improved Physical Attribute (Strength) at level 2: +2 in futurekill, so Strength 4 (6).
    assert.match(r.text, /^Strength 4 \(6\)$/m);
    assert.equal(a['system.attributes.strength.base'], 4);
    assert.equal(a['system.magic'], 6);
    assert.equal(a['system.tradition'], 'adept');
    assert.ok(item('adeptpower', 'Improved Reflexes'));
    assert.ok(item('adeptpower', 'Improved Ability'));
    assert.ok(item('adeptpower', 'Killing Hands'));
    assert.equal(item('skill', 'Armed Combat')?.system.rating, 6);
    const focus = plan.items.find((i) => i.type === 'focus');
    assert.equal(focus?.system.focusType, 'power');
    assert.equal(focus?.system.rating, 2);
    assert.equal(a['system.nuyen'], 251);
    assert.equal(a['system.karma.good'], 2);
    assert.equal(a['system.karma.career'], 9);
    assert.equal(a['system.lifestyle.level'], 'street');
  });

  test('a hermetic: spells with Force, drain and exclusive; initiate grade; a spell lock becomes a sustaining focus', () => {
    const { a, item, plan } = run(fixture('mage'));
    assert.equal(a['system.tradition'], 'hermetic');
    assert.equal(a['system.initiateGrade'], 1);
    const mb = item('spell', 'Manabolt');
    assert.equal(mb?.system.learnedForce, 5);
    assert.equal(mb?.system.drainModifier, 1);
    assert.equal(mb?.system.drainLevel, 'S');
    assert.equal(item('spell', 'Heal')?.system.learnedForce, 4);
    const barrier = item('spell', 'Sample Barrier Mass');
    assert.equal(barrier?.system.exclusive, true);
    assert.equal(barrier?.system.drainModifier, -1);
    assert.equal(plan.items.find((i) => i.type === 'focus')?.system.focusType, 'sustaining');
    assert.equal(item('skill', 'Sorcery')?.system.specialization, 'Spellcasting');
  });
});

describe('v0.94.0 futurekill: bad input never throws', () => {
  test('garbage and wrong types give empty text and a warning', () => {
    for (const bad of [null, undefined, 42, 'text', [], {}, { system: 'x' }, { name: 5, system: {} }]) {
      const r = futurekillToWriteUp(bad);
      assert.equal(r.source, 'futurekill');
      assert.ok(Array.isArray(r.warnings));
      assert.ok(r.text === '' || typeof r.text === 'string');
      characterImportPlan(parseCharacterSheet(r.text));
    }
    assert.ok(hasWarning(futurekillToWriteUp(null).warnings, 'notAnActor'));
    const v = futurekillToWriteUp({ name: 'Sample Car', type: 'vehicle', system: { handling: 3 }, _stats: { systemId: 'sr2e' } });
    assert.equal(v.text, '');
    assert.ok(hasWarning(v.warnings, 'notACharacter'));
  });

  test('a near-empty actor and hostile item data', () => {
    const r = futurekillToWriteUp({ name: 'Sample Blank', type: 'character', system: { body: { base: 'abc' } }, items: [null, 5, 'x', { name: '', type: 'gear' }, { name: 'Y' }, { name: 'Weird\nName: Notes = x (oops', type: 'gear', system: { quantity: 'many' } }] });
    const { plan } = run({ name: 'Sample Blank', type: 'character', system: { body: { base: 'abc' } }, items: [{ name: 'Weird\nName: Notes = x (oops', type: 'gear', system: { quantity: 'many' } }] });
    assert.ok(hasWarning(r.warnings, 'unnamedItems'));
    assert.equal(r.name, 'Sample Blank');
    const g = plan.items.filter((i) => i.type === 'gear');
    assert.equal(g.length, 1);
    assert.equal(g[0]!.name, 'Weird Name Notes x oops');
    assert.equal(plan.actorUpdate['system.notes'] !== undefined, true);
    assert.ok(!plan.warnings.some((w) => /not recognised/i.test(w)), plan.warnings.join(' | '));
  });

  test('an NPC converts with its attributes as written; an unknown race is warned', () => {
    const npc = run({ name: 'Sample Guard', type: 'npc', system: { race: 'troll', body: { base: 8, mod: 1 }, strength: { base: 7 } }, items: [] });
    assert.ok(hasWarning(npc.r.warnings, 'npc'));
    assert.equal(npc.a['system.attributes.body.base'], 8);
    assert.match(npc.r.text, /^Body 8 \(9\)$/m);
    const odd = run({ name: 'Sample Odd', type: 'character', system: { race: 'shapeshifter', body: { base: 3 } }, items: [] });
    assert.ok(hasWarning(odd.r.warnings, 'shapeshifter'));
    assert.equal(odd.a['system.metatype'], undefined);
  });

  test('size limits: a huge biography and too many items stay inside the import limits', () => {
    const items = Array.from({ length: FK_MAX_ENTRIES + 100 }, (_, i) => ({ name: `Sample Thing ${String.fromCharCode(65 + (i % 26))}${i}x`, type: 'gear', system: { quantity: 1 } }));
    const bio = `<p>${'word '.repeat(60_000)}</p>`;
    const r = futurekillToWriteUp({ name: 'Sample Big', type: 'character', system: { biography: bio, body: { base: 3 } }, items });
    assert.ok(hasWarning(r.warnings, 'tooManyItems'));
    assert.ok(r.text.length < MAX_SHEET_CHARS, String(r.text.length));
    assert.ok(r.text.split('\n').every((l) => l.length < MAX_SHEET_LINE));
    const p = parseCharacterSheet(r.text);
    assert.equal(p.gear.length, FK_MAX_ENTRIES);
  });
});

describe('v0.94.0 futurekill: strings', () => {
  test('every warning and heading key the converter uses has English (draft or en.json)', () => {
    const src = readFileSync(join(import.meta.dirname, '..', 'rules', 'fkimport.ts'), 'utf8');
    const keys = new Set<string>();
    for (const m of src.matchAll(/W\('(\w+)'/g)) keys.add(`SR2E.Import.Futurekill.${m[1]}`);
    for (const m of src.matchAll(/tx\('(SR2E\.Import\.Futurekill\.\w+)'/g)) keys.add(m[1]!);
    assert.ok(keys.size >= 15);
    for (const k of keys) assert.notEqual(en(k), k, `${k} has no English`);
  });
});
