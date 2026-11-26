/**
 * v0.94.0 ("imports"), Agent A: the Nullsheen converter. A Nullsheen JSON file becomes write-up text, and that text
 * is checked through the real character import (parseCharacterSheet → characterImportPlan): attributes, items by
 * type and name, contacts, nuyen, Karma and warnings. Fixtures are invented (fixtures/nullsheen-*.json).
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { looksLikeNullsheen, nullsheenToWriteUp, NULLSHEEN_MAX_LIST } from '../rules/nullsheen.ts';
import { parseCharacterSheet, characterImportPlan, type CharacterImportPlan } from '../rules/charimport.ts';
import { statBlockAttributeBonuses } from '../rules/statblock.ts';
import { tRaw } from '../helpers/i18n.ts';

const FIX = join(import.meta.dirname, 'fixtures');
const fixture = (f: string): Record<string, unknown> => JSON.parse(readFileSync(join(FIX, f), 'utf8'));
/** The new strings, until the lead merges them into lang/en.json (then that file has them and this adds nothing). */
const DRAFT = '/home/claude/work/strings-094-A.json';
const draft = (): Record<string, string> => (existsSync(DRAFT) ? JSON.parse(readFileSync(DRAFT, 'utf8')) : {});
before(() => {
  const en = (globalThis as any).__SR2E_EN__ ?? ((globalThis as any).__SR2E_EN__ = {});
  for (const [k, v] of Object.entries(draft())) if (!(k in en)) en[k] = v;
});

/** A warning by its key, whatever its English: the key itself, or its text with any values in the placeholders. */
const hasWarning = (list: string[], key: string) => {
  const tpl = tRaw(key);
  const re = new RegExp(`^${tpl.split(/\{[A-Za-z_]\w*\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]*')}$`);
  return list.some((w) => w === key || re.test(w));
};
const run = (data: unknown): { r: ReturnType<typeof nullsheenToWriteUp>; plan: CharacterImportPlan; unknown: string[] } => {
  const r = nullsheenToWriteUp(data);
  const p = parseCharacterSheet(r.text);
  return { r, plan: characterImportPlan(p, { makeId: () => 'x' }), unknown: p.unknown };
};
const item = (plan: CharacterImportPlan, type: string, name: string) => plan.items.find((i) => i.type === type && i.name === name);
const augmented = (plan: CharacterImportPlan, attr: string): number => {
  const bonus = statBlockAttributeBonuses(plan.items.filter((i) => i.type !== 'skill') as any) as Record<string, number>;
  return Number(plan.actorUpdate[`system.attributes.${attr}.base`]) + Number(plan.actorUpdate[`system.attributes.${attr}.mod`]) + (bonus[attr] ?? 0);
};

describe('v0.94.0 Nullsheen: detection', () => {
  test('the fixtures are Nullsheen; other JSON is not', () => {
    for (const f of ['nullsheen-sr2-samurai.json', 'nullsheen-sr2-adept.json', 'nullsheen-sr3-mage.json']) assert.equal(looksLikeNullsheen(fixture(f)), true, f);
    for (const v of [null, undefined, 0, 'x', [], {}, { attributes: [] }, { attributes: { Body: 3 } }, { edition: 'SR2' }]) assert.equal(looksLikeNullsheen(v), false, JSON.stringify(v));
    // A Foundry actor export (futurekill or SR2e's own) is not Nullsheen, even with an attributes block.
    assert.equal(looksLikeNullsheen({ name: 'X', type: 'character', system: {}, _stats: { systemId: 'sr2e' }, attributes: { Body: 3 }, street_name: 'X' }), false);
    assert.equal(looksLikeNullsheen({ attributes: { body: 3 }, edition: 'sr3' }), true, 'keys and edition read case-insensitively');
  });
});

describe('v0.94.0 Nullsheen: a full SR2 file through the import', () => {
  const { r, plan, unknown } = run(fixture('nullsheen-sr2-samurai.json'));
  const up = plan.actorUpdate;

  test('result shape: source, key, name, edition; every line is read by the import', () => {
    assert.equal(r.source, 'nullsheen');
    assert.match(r.key, /^nullsheen:sample runner#[0-9a-f]{8}$/);
    assert.equal(r.name, 'Sample Runner');
    assert.equal(r.edition, 'SR2');
    assert.deepEqual(unknown, [], 'no line the import does not recognise');
    assert.equal(up['name'], 'Sample Runner', 'the street name wins');
    assert.equal(up['system.metatype'], 'ork');
    assert.match(String(up['system.notes']), /Pat Example/, 'the real name goes to the notes');
  });

  test('attributes: natural = points + race bonus; augmented adds the cyber bonuses (no double count with the ware)', () => {
    const want: Record<string, [number, number]> = { body: [6, 6], quickness: [5, 6], strength: [6, 7], charisma: [1, 1], intelligence: [2, 2], willpower: [3, 3] };
    for (const [k, [nat, aug]] of Object.entries(want)) {
      assert.equal(up[`system.attributes.${k}.base`], nat, `${k} natural`);
      assert.equal(augmented(plan, k), aug, `${k} augmented`);
    }
    assert.equal(up['system.racialModifiers'], false);
    assert.equal(plan.after.essenceShown, 2.3, '6 less 2 + 1 + 0.5 + 0.2');
    assert.equal(plan.after.reactionShown, 5, '(5 + 2) / 2 = 3, +2 from wired reflexes');
    assert.equal(plan.after.initiativeDice, 2);
  });

  test('skills: concentration and specialization ratings, knowledge, languages (native), B/R; comma and colon in names', () => {
    assert.deepEqual(item(plan, 'skill', 'Firearms')?.system, { rating: 4, attribute: 'quickness', kind: 'active', specialization: 'Pistols', specializationRating: 6 });
    const armed = item(plan, 'skill', 'Armed Combat')?.system;
    assert.equal(armed?.rating, 2);
    assert.equal(armed?.specialization, 'Katana');
    assert.equal(armed?.specializationRating, 6);
    assert.equal(item(plan, 'skill', 'Stealth')?.system.rating, 3, 'a rating written as text');
    assert.equal(item(plan, 'skill', 'Etiquette - Street')?.system.rating, 2, 'colon in a name, lower-case first letter');
    assert.equal(item(plan, 'skill', 'Street Gangs/Local')?.system.kind, 'knowledge', 'comma in a name');
    assert.equal(item(plan, 'skill', 'English')?.system.native, true);
    assert.equal(item(plan, 'skill', 'Spanish')?.system.kind, 'language', '"Language" with a concentration is that language');
    assert.equal(item(plan, 'skill', 'Motorcycle B/R')?.system.kind, 'buildRepair');
    assert.ok(hasWarning(r.warnings, 'SR2E.Import.Nullsheen.skillsSkipped'), 'the nameless and non-object skill entries');
    assert.ok(hasWarning(r.warnings, 'SR2E.Import.Nullsheen.skillConcentrationDropped'));
  });

  test('cyberware and bioware with their Essence / Body Index; weapons, armor, gear', () => {
    assert.equal(item(plan, 'cyberware', 'Wired Reflexes')?.system.essenceCost, 2);
    assert.equal(item(plan, 'cyberware', 'Wired Reflexes')?.system.rating, 1);
    assert.equal(item(plan, 'cyberware', 'Smartlink')?.system.essenceCost, 0.5, '".5" read as 0.5');
    assert.equal(item(plan, 'cyberware', 'Datajack')?.system.essenceCost, 0.2);
    assert.equal(item(plan, 'cyberware', 'Trauma Damper')?.system.bodyIndex, 0.4);
    assert.equal(item(plan, 'cyberware', 'Trauma Damper')?.system.bioware, true);
    const pistol = item(plan, 'weapon', 'Example Heavy Pistol')?.system;
    assert.equal(pistol?.damagePower, 9);
    assert.equal(pistol?.damageLevel, 'M');
    assert.equal(pistol?.modes, 'SA');
    assert.equal(pistol?.ammoMax, 10);
    const smg = item(plan, 'weapon', 'Sample SMG/folding stock')?.system;
    assert.equal(smg?.modes, 'SA/BF', 'a comma in the weapon name does not split the entry');
    assert.equal(smg?.ammoMax, 32);
    const katana = item(plan, 'weapon', 'Example Katana')?.system;
    assert.equal(katana?.melee, true);
    assert.equal(katana?.strengthPower, true);
    assert.equal(katana?.damagePower, 3);
    assert.equal(katana?.reach, 1);
    assert.equal(item(plan, 'weapon', 'Combat Knife')?.system.damageLevel, 'L', 'a weapon in the gear list');
    assert.ok(item(plan, 'gear', 'Mystery Device'), 'a weapon with no damage code is gear');
    assert.ok(hasWarning(r.warnings, 'SR2E.Import.Nullsheen.weaponNoDamage'));
    assert.deepEqual(item(plan, 'armor', 'Armor Jacket')?.system, { ballistic: 5, impact: 3, worn: true });
    assert.ok(item(plan, 'gear', 'Ordinary Clothing'), 'clothing with "-" armor is gear');
    assert.equal(item(plan, 'gear', 'Medkit')?.system.medkitRating, 3);
    assert.equal(item(plan, 'gear', 'Rope/50m - synthetic')?.system.quantity, 2);
  });

  test('contacts, nuyen, Karma, lifestyle, text; what is not imported is warned and named in the notes', () => {
    assert.deepEqual(plan.contacts?.map((c) => [c.name, c.role, c.level]), [['Sample Fixer', 'Fixer', 1], ['Doe/Jane', 'Street Doc', 2]]);
    assert.equal(up['system.nuyen'], 1450, '5000 - 3800 + 250');
    assert.ok(hasWarning(r.warnings, 'SR2E.Import.Nullsheen.nuyenWorkedOut'));
    assert.equal(up['system.karma.good'], 3);
    assert.equal(up['system.karma.career'], 5);
    assert.equal(up['system.karma.pool'], 1);
    assert.equal(up['system.lifestyle.level'], 'low');
    assert.equal(plan.after.lifestyleMonths, 2);
    assert.match(String(up['system.biography']), /Tall, scarred\. Wears a long coat\./, 'new lines in text become spaces');
    assert.match(String(up['system.notes']), /none of this is a label/, 'label-like words inside the notes stay notes');
    assert.equal(up['system.karma.good'], 3, '"Karma: 99" inside the notes is not read');
    assert.match(String(up['system.notes']), /Example Bike/);
    assert.match(String(up['system.notes']), /Linked to the heavy pistol/, 'an item note goes to the notes');
    assert.ok(hasWarning(r.warnings, 'SR2E.Import.Nullsheen.notImported'));
    assert.ok(!r.warnings.some((w) => hasWarning([w], 'SR2E.Import.Nullsheen.sr3')));
  });
});

describe('v0.94.0 Nullsheen: an adept and an SR3 magician', () => {
  test('adept: tradition, powers (levels, the skill option), magical attribute bonus, initiative dice, foci', () => {
    const { r, plan, unknown } = run(fixture('nullsheen-sr2-adept.json'));
    assert.deepEqual(unknown, []);
    assert.match(r.key, /^nullsheen:example adept#[0-9a-f]{8}$/);
    assert.equal(plan.actorUpdate['system.tradition'], 'adept');
    assert.equal(plan.actorUpdate['system.magic'], 6);
    assert.equal(plan.actorUpdate['system.attributes.strength.base'], 4);
    assert.equal(augmented(plan, 'strength'), 5, 'Increased Strength 1');
    assert.equal(item(plan, 'adeptpower', 'Improved Reflexes')?.system.level, 2);
    assert.equal(item(plan, 'adeptpower', 'Improved Ability')?.system.skill, 'Unarmed Combat');
    assert.equal(item(plan, 'adeptpower', 'Improved Ability')?.system.level, 2);
    assert.ok(item(plan, 'adeptpower', 'Astral Perception'));
    assert.equal(plan.after.initiativeDice, 3, '1 + 2 from the powers');
    assert.equal(item(plan, 'focus', 'Weapon focus')?.system.rating, 1);
    assert.equal(item(plan, 'skill', 'Athletics')?.system.specialization, 'Running');
    assert.ok(hasWarning(r.warnings, 'SR2E.Import.Nullsheen.skillExtraChoices'), 'a second concentration is not kept');
    assert.equal(plan.actorUpdate['system.karma.pool'], 1, '"1" as text');
  });

  test('SR3: converted with a clear warning; tradition and totem, spells with drain, edges and flaws', () => {
    const { r, plan, unknown } = run(fixture('nullsheen-sr3-mage.json'));
    assert.deepEqual(unknown, []);
    assert.equal(r.edition, 'SR3');
    assert.ok(hasWarning(r.warnings, 'SR2E.Import.Nullsheen.sr3'));
    assert.equal(plan.actorUpdate['system.metatype'], 'elf');
    assert.equal(plan.actorUpdate['system.attributes.charisma.base'], 6);
    assert.equal(plan.actorUpdate['system.tradition'], 'shamanic');
    assert.equal(plan.actorUpdate['system.totem.name'], 'Example Totem');
    const bolt = item(plan, 'spell', 'Manabolt')?.system;
    assert.equal(bolt?.learnedForce, 4, 'trailing blanks in the name, Force as text');
    assert.equal(bolt?.drainModifier, 1);
    assert.equal(bolt?.drainLevel, 'S');
    assert.equal(bolt?.exclusive, true);
    assert.equal(item(plan, 'spell', 'Heal')?.system.drainLevel, 'M');
    assert.equal(item(plan, 'spell', 'Example Glamour/Lesser')?.system.fetish, true);
    assert.ok(hasWarning(r.warnings, 'SR2E.Import.Nullsheen.drainUnread'));
    assert.deepEqual(plan.qualities?.map((q) => [q.name, q.kind, q.points]), [['Example Edge', 'edge', 2], ['Example Flaw', 'flaw', 2]]);
    assert.equal(plan.actorUpdate['system.karma.good'], 6);
    assert.equal(plan.actorUpdate['system.karma.career'], 10);
    assert.equal(item(plan, 'skill', 'Sorcery')?.system.specializationRating, 7);
  });
});

describe('v0.94.0 Nullsheen: forgiving reading', () => {
  test('garbage, wrong types and near-empty files never throw', () => {
    const odd: unknown[] = [null, undefined, 42, 'text', [], [1, 2], {}, { attributes: 'bad' }, { edition: 'SR2' },
      { attributes: { Body: 'x', Quickness: null }, skills: 'nope', weapons: [null, 5, { Name: 7 }, { Name: { a: 1 } }], gear: {}, contacts: [{}], spells: [{ Name: '', Rating: 'x' }], cyberware: [{ Name: 'X', EssCost: 'none' }] },
      { attributes: { Body: 3 }, street_name: ['array'], race: { a: 1 }, priorities: 'A', karma: 'lots', cash: Infinity, raceBonuses: [1] },
      Object.create(null)];
    for (const v of odd) {
      const { r, plan } = run(v);
      assert.equal(typeof r.text, 'string');
      assert.ok(Array.isArray(r.warnings));
      assert.ok(Array.isArray(plan.items));
      assert.ok(r.key.startsWith('nullsheen:'));
    }
    assert.equal(nullsheenToWriteUp(null).text, '');
    assert.ok(nullsheenToWriteUp(null).warnings.length > 0);
    assert.ok(hasWarning(nullsheenToWriteUp({ edition: 'SR2' }).warnings, 'SR2E.Import.Nullsheen.notNullsheen'));
    // A getter that throws is caught.
    const evil = { attributes: { Body: 3 }, street_name: 'Evil' } as Record<string, unknown>;
    Object.defineProperty(evil, 'skills', { enumerable: true, get() { throw new Error('boom'); } });
    assert.doesNotThrow(() => nullsheenToWriteUp(evil));
    assert.ok(hasWarning(nullsheenToWriteUp(evil).warnings, 'SR2E.Import.Nullsheen.failed'));
  });

  test('a natural rating below 1 (a troll-like Intelligence) is set to 1 and warned; Essence lower in the file wins', () => {
    const { r, plan } = run({ edition: 'SR2', street_name: 'Big', race: 'Troll', raceBonuses: { Intelligence: -2, Body: 5 }, attributes: { Body: 4, Quickness: 2, Strength: 1, Charisma: 4, Willpower: 3, Intelligence: 1, Essence: '5.5', Magic: 0 } });
    assert.equal(plan.actorUpdate['system.attributes.intelligence.base'], 1);
    assert.equal(plan.actorUpdate['system.attributes.body.base'], 9);
    assert.ok(hasWarning(r.warnings, 'SR2E.Import.Nullsheen.attributeBelowOne'));
    assert.equal(plan.after.essenceShown, 5.5);
    assert.ok(hasWarning(r.warnings, 'SR2E.Import.Nullsheen.essenceDiffers'));
    assert.equal(plan.actorUpdate['system.magic'], undefined, 'a mundane gets no Magic line');
    assert.equal(plan.after.reactionShown, undefined, 'no ware or powers: Reaction is left to the system');
  });

  test('awkward names: brackets, semicolons, new lines, lower case, "|" and very long text stay in one entry', () => {
    const { plan, unknown } = run({
      edition: 'SR2', street_name: 'Odd | Name\nTwo',
      attributes: { Body: 3, Quickness: 3, Strength: 3, Charisma: 3, Willpower: 3, Intelligence: 3 },
      gear: [{ Name: 'flashlight (red; dim', Amount: 1 }, { Name: 'Tool kit [electronics], small', Rating: 2 }],
      contacts: [{ Name: 'Smith - the elder: retired', Archtype: 'Fence', Level: 3, GeneralInfo: 'Talks (a lot)\nand more' }],
      notes: 'x'.repeat(50_000),
    });
    assert.deepEqual(unknown, []);
    assert.equal(plan.actorUpdate['name'], 'Odd / Name Two');
    assert.ok(item(plan, 'gear', 'Flashlight - red/dim') || item(plan, 'gear', 'Flashlight red/dim'), JSON.stringify(plan.items.map((i) => i.name)));
    assert.ok(plan.items.some((i) => i.type === 'gear' && /^Tool kit - electronics\/small$/.test(i.name)), JSON.stringify(plan.items.map((i) => i.name)));
    assert.equal(plan.contacts?.length, 1);
    assert.equal(plan.contacts?.[0]?.role, 'Fence');
    assert.equal(plan.contacts?.[0]?.level, 3);
    assert.ok(String(plan.actorUpdate['system.notes']).length < 10_000, 'free text is capped');
  });

  test('an entry that starts like an attribute line ("Magic 8 Ball") stays an entry and changes no attribute', () => {
    const base = { edition: 'SR2', street_name: 'Toy', attributes: { Body: 3, Quickness: 3, Strength: 3, Charisma: 3, Willpower: 3, Intelligence: 3, Magic: 0 } };
    const a = run({ ...base, gear: [{ Name: 'Magic 8 Ball' }, { Name: 'Rope' }] });
    assert.deepEqual(a.unknown, []);
    assert.ok(item(a.plan, 'gear', 'Magic 8 Ball'));
    assert.ok(item(a.plan, 'gear', 'Rope'));
    assert.equal(a.plan.actorUpdate['system.magic'], undefined);
    const b = run({ ...base, gear: [{ Name: 'Str 5 weights' }] });
    assert.ok(item(b.plan, 'gear', 'Str 5 weights'), JSON.stringify(b.plan.items.map((i) => i.name)));
    assert.equal(b.plan.actorUpdate['system.attributes.strength.base'], 3);
  });

  test('lists are capped and the text stays under the import limit', () => {
    const many = Array.from({ length: 2000 }, (_, i) => ({ Name: `Widget ${String.fromCharCode(65 + (i % 26))}${i}x`, Amount: 1 }));
    const r = nullsheenToWriteUp({ edition: 'SR2', street_name: 'Hoarder', attributes: { Body: 3 }, gear: many });
    assert.equal(r.text.split('\n').filter((l) => /^Widget /.test(l)).length, NULLSHEEN_MAX_LIST);
    assert.ok(r.text.length <= 100_000);
  });

  test('re-import: the key is stable (case, spacing, changed values), and a second import updates the same items', () => {
    const base = fixture('nullsheen-sr2-samurai.json');
    const a = nullsheenToWriteUp(base);
    const b = nullsheenToWriteUp({ ...base, karma: 40, street_name: '  sample   RUNNER ', cash: 9999 });
    assert.equal(a.key, b.key);
    assert.match(nullsheenToWriteUp({ attributes: { Body: 3 }, name: 'Only Real', edition: 'SR2' }).key, /^nullsheen:only real#[0-9a-f]{8}$/);
    const first = characterImportPlan(parseCharacterSheet(a.text));
    const second = characterImportPlan(parseCharacterSheet(b.text), { itemNames: first.items.map((i) => ({ type: i.type, name: i.name })), contacts: first.contacts });
    assert.ok(second.items.length > 0);
    assert.ok(second.items.every((i) => i.replace === true), 'every item matches by type and name');
    assert.equal(second.contacts?.length, first.contacts?.length, 'contacts updated in place, not doubled');
    assert.equal(second.actorUpdate['system.karma.career'], 40);
  });
});
