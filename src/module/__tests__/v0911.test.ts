/**
 * v0.91.1: making a new entry. The stat-line reader and the entry builder (rules/newentry.ts), the request's safe
 * reading, the new buying fields on foci, programs and decks, and the wiring (the shop's button, the tools window,
 * the Setup tab, the Requests tab's Review…, the catalogue files' book-text warning).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ENTRY_KINDS, entryFields, entryFieldKey, ENTRY_KIND_KEYS, parseStatLine, buildEntry, entryRequestData, entryDescriptionHtml, entryItemType, entryKindForType,
  STAT_LINE_MAX, CATALOGUE_COLUMNS,
} from '../rules/index.ts';
import { TOOLS } from '../rules/tools.ts';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const lang = JSON.parse(read('public', 'lang', 'en.json'));
const keyIn = (k: string) => k.split('.').reduce((o: any, p) => o?.[p], lang) !== undefined;
const sys = (kind: any, line: string) => { const r = parseStatLine(kind, line); return { r, b: buildEntry(kind, r.name, r.values, '') }; };

describe('v0.91.1 the stat-line reader', () => {
  test('a firearm row: name, conceal, ammo, mode, damage, weight, Availability, cost, Street Index', () => {
    const { r, b } = sys('weapon', 'Example Pistol  5  15(c)  SA  9M  2.25  3/24 hrs  450  .5');
    assert.equal(r.name, 'Example Pistol');
    assert.deepEqual(r.skipped, []);
    assert.equal(b.type, 'weapon');
    assert.deepEqual(b.problems, []);
    assert.equal(b.system.damagePower, 9); assert.equal(b.system.damageLevel, 'M'); assert.equal(b.system.modes, 'SA');
    assert.equal(b.system.ammoMax, 15); assert.equal(b.system.feed, 'clip'); assert.equal(b.system.concealability, 5);
    assert.equal(b.system.weight, 2.25); assert.equal(b.system.availability, '3/24 hrs'); assert.equal(b.system.cost, 450); assert.equal(b.system.streetIndex, 0.5);
  });
  test('a Strength damage code makes a melee weapon (conceal, reach, weight, cost, SI)', () => {
    const { b } = sys('weapon', 'Example Blade 3 1 (STR+3)M 1 4/72 hrs 1,000 1');
    assert.equal(b.system.melee, true); assert.equal(b.system.strengthPower, true); assert.equal(b.system.damagePower, 3);
    assert.equal(b.system.reach, 1); assert.equal(b.system.cost, 1000);
  });
  test('labelled values in any order, with pipes', () => {
    const { b } = sys('weapon', 'Example SMG | Conceal 5 | Ammo 32(c) | Mode SA/BF | Damage 6M | Avail 4/48 hrs | Cost 950 ¥ | SI 1');
    assert.equal(b.system.modes, 'SA/BF'); assert.equal(b.system.ammoMax, 32); assert.equal(b.system.cost, 950); assert.equal(b.system.concealability, 5);
  });
  test('armor, with B/I in one cell or two', () => {
    assert.deepEqual([sys('armor', 'Example Jacket 5 5 3 2 5/36 hrs 900 .75').b.system.ballistic, sys('armor', 'Example Jacket 5 5 3 2 5/36 hrs 900 .75').b.system.impact], [5, 3]);
    const c = sys('armor', 'Example Coat 6 4/2 2 4/48 hrs 700 1').b.system;
    assert.deepEqual([c.ballistic, c.impact, c.concealability, c.cost], [4, 2, 6, 700]);
  });
  test('cyberware and bioware: Essence or Body Index, the level in brackets, cost with thousands', () => {
    const w = sys('cyberware', 'Example Reflexes (Level 1) 2 4/8 days 55,000 1');
    assert.equal(w.r.name, 'Example Reflexes');
    assert.deepEqual([w.b.system.essenceCost, w.b.system.rating, w.b.system.cost], [2, 1, 55000]);
    const bio = sys('bioware', 'Example Toner (Level 2) .4 6/10 days 50,000 1').b;
    assert.equal(bio.type, 'cyberware'); assert.equal(bio.system.bioware, true); assert.equal(bio.system.bodyIndex, 0.4);
  });
  test('spells: type, duration, drain code and category words', () => {
    const s = sys('spell', 'Example Bolt Type: M Duration: I Drain: [(F/2)+1]D Combat').b.system;
    assert.deepEqual([s.spellType, s.duration, s.drainModifier, s.drainLevel, s.category], ['mana', 'instant', 1, 'D', 'combat']);
    const h = sys('spell', 'Example Mend Type P Range Touch Duration P Drain (F/2)M Health').b.system;
    assert.deepEqual([h.spellType, h.range, h.duration, h.category], ['physical', 'touch', 'permanent', 'health']);
  });
  test('programs (size in Mp, kind from the name), decks in column order, foci (type from the name), adept powers', () => {
    const p = sys('program', 'Attack 4 12 Mp 2,400 1').b.system;
    assert.deepEqual([p.kind, p.rating, p.size, p.cost], ['attack', 4, 12, 2400]);
    const d = sys('cyberdeck', 'Example Deck 6 3 100 500 30 1 4/2 wks 125,000 1').b.system;
    assert.deepEqual([d.mpcp, d.hardening, d.activeMemory, d.storageMemory, d.ioSpeed, d.responseIncrease, d.cost], [6, 3, 100, 500, 30, 1, 125000]);
    const f = sys('focus', 'Power focus 2 4/48 hrs 90,000').b.system;
    assert.deepEqual([f.focusType, f.rating, f.cost], ['power', 2, 90000]);
    assert.equal(sys('adeptpower', 'Example Power .5').b.system.cost, 0.5);
  });
  test('words it doesn\'t know are listed and never kept; a paragraph is refused', () => {
    const r = parseStatLine('gear', 'Example Kit 1 4/12 hrs 200 1 this kit holds bandages and tools');
    assert.ok(r.skipped.includes('bandages'));
    const b = buildEntry('gear', r.name, r.values, '');
    assert.ok(!JSON.stringify(b.system).includes('bandages'));
    assert.equal(parseStatLine('gear', 'x'.repeat(STAT_LINE_MAX + 1)).tooLong, true);
    // A long run of words is not a name.
    assert.equal(parseStatLine('gear', 'one two three four five six seven eight nine 200').name, '');
  });
});

describe('v0.91.1 building an entry', () => {
  test('only the kind\'s own fields are read; bad values are problems; a name is needed', () => {
    const b = buildEntry('gear', '', { cost: 'lots', 'system.ownership': 'x', __proto__: 'y', quantity: '2' }, '');
    assert.equal(b.problems.length, 2, 'no name, and a cost that is not a number');
    assert.equal(b.system.quantity, 2);
    assert.equal(Object.keys(b.system).includes('ownership'), false);
    assert.equal(buildEntry('nonsense', 'X', {}, '').type, 'gear');
  });
  test('the description is plain text (escaped), limited in length', () => {
    assert.equal(entryDescriptionHtml('a <b>bold</b>\nline\n\nnext'), '<p>a &lt;b&gt;bold&lt;/b&gt;<br>line</p><p>next</p>');
    assert.ok(entryDescriptionHtml('x'.repeat(5000)).length < 2100);
    assert.equal(buildEntry('gear', 'X', {}, '<img src=x onerror=1>').system.description, '<p>&lt;img src=x onerror=1&gt;</p>');
  });
  test('a request is read safely: strings only, the kind\'s fields only, a known kind', () => {
    assert.equal(entryRequestData({ kind: 'boat', name: 'x' }), null);
    assert.equal(entryRequestData(null), null);
    const d = entryRequestData({ kind: 'gear', name: 'X', values: { cost: 5, nope: '1', quantity: { a: 1 } }, description: 'd' })!;
    assert.deepEqual(d.values, { cost: '5' });
  });
  test('every kind maps to a catalogue type, and every field is a known column or shorthand, with a label key', () => {
    for (const k of ENTRY_KINDS) {
      const type = entryItemType(k);
      // v0.91.4: a vehicle or drone is a vehicle actor (its columns: VEHICLE_COLUMNS).
      assert.ok(type === 'vehicle' || CATALOGUE_COLUMNS[type as keyof typeof CATALOGUE_COLUMNS], k);
      const fields = entryFields(k);
      assert.ok(fields.length >= 4, k);
      for (const f of fields) { assert.ok(f.column || f.shorthand, `${k} ${f.id}`); assert.ok(keyIn(f.labelKey), f.labelKey); assert.ok(f.help, `${k} ${f.id} help`); }
      assert.ok(keyIn(ENTRY_KIND_KEYS[k]), k);
    }
    assert.equal(entryFieldKey('shDamage'), 'SR2E.App.NewEntry.field.shDamage');
    assert.equal(entryKindForType('nonsense'), 'gear');
  });
});

describe('v0.91.1 foci, programs and decks can be bought', () => {
  test('the models and catalogue columns have cost, Availability, Street Index and legality', () => {
    const models = read('src', 'module', 'models', 'index.ts');
    for (const cls of ['FocusDataModel', 'ProgramDataModel', 'CyberdeckDataModel']) {
      const body = models.slice(models.indexOf(`export class ${cls}`), models.indexOf('\n}\n', models.indexOf(`export class ${cls}`)));
      for (const f of ['cost:', 'availability:', 'streetIndex:', '...legalFields()']) assert.ok(body.includes(f), `${cls} ${f}`);
    }
    for (const t of ['focus', 'program', 'cyberdeck'] as const) for (const p of ['cost', 'availability', 'streetIndex', 'legality']) assert.ok(CATALOGUE_COLUMNS[t].some((c) => c.path === p), `${t} ${p}`);
    assert.equal(CATALOGUE_COLUMNS.cyberdeck.filter((c) => c.path === 'cost').length, 1);
    assert.match(read('src', 'module', 'applications', 'sheets.ts'), /buyable: \["weapon", "armor", "gear", "cyberware", "focus", "program", "cyberdeck"\]/);
  });
});

describe('v0.91.1 the wiring', () => {
  test('opened from the shop, the tools window, the Setup tab and the API; Review… on a player\'s entry', () => {
    assert.match(read('public', 'templates', 'add-window.hbs'), /data-action="newEntry"/);
    assert.ok(TOOLS.some((t) => t.id === 'newEntry' && t.who === 'player'));
    assert.match(read('src', 'module', 'applications', 'tools.ts'), /newEntry: \(\) => \{ SR2NewEntry\.open/);
    const gm = read('public', 'templates', 'gm-panel.hbs');
    assert.match(gm, /data-action="newEntry"/);
    assert.match(gm, /\{\{#if entry\}\}<button type="button" data-action="reviewEntry"/);
    assert.match(read('src', 'module', 'sr2e-system.ts'), /newEntry: \(o: \{ kind\?: string; actorUuid\?: string \} = \{\}\) => SR2NewEntry\.open\(o\)/);
    const ap = read('src', 'module', 'applications', 'approvals.ts');
    assert.match(ap, /r\.kind === 'entry' \? r\.kind : 'method'/);
    assert.match(ap, /export async function finishRequest\(/);
  });
  test('catalogue files warn that book text stays at the table', () => {
    const cat = read('src', 'module', 'applications', 'catalogue.ts');
    assert.equal((cat.match(/tx\('SR2E\.Notify\.Catalogue\.bookTextWarning'\)/g) ?? []).length, 2);
    assert.ok(keyIn('SR2E.UI.catalogueBookText'));
  });
  test('the window never keeps the pasted line, and a player\'s entry is a request rebuilt on the GM side', () => {
    const w = read('src', 'module', 'applications', 'newentry.ts');
    assert.match(w, /this\.statLine = '';/);
    assert.match(w, /kind: 'entry', label: tx\('SR2E\.Text\.NewEntry\.requestLabel'/);
    assert.match(w, /registerRequestRunner\('entry', async \(_actor, data\) => \{\n  const d = entryRequestData\(data\);/);
  });
});

describe('v0.91.1 review fixes', () => {
  test('B2: a long line of near-codes reads at once (no backtracking over read text)', () => {
    const t = Date.now();
    parseStatLine('spell', `F/2 type:${'a'.repeat(385)}`);
    for (const k of ENTRY_KINDS) for (const f of ['a ', '1 ', '( ', 'F/2 ', '/ ', '  ', 'str+', '9M ']) parseStatLine(k, `x ${f.repeat(200)}`.slice(0, STAT_LINE_MAX));
    assert.ok(Date.now() - t < 2000, `${Date.now() - t} ms`);
  });
  test('B3: choices read as typed become their values (the select shows them)', () => {
    const r = parseStatLine('spell', 'Example Bolt Type: M Duration: I Drain: (F/2)D Combat');
    assert.equal(r.values['spellType'], 'mana'); assert.equal(r.values['duration'], 'instant'); assert.equal(r.values['category'], 'combat');
  });
  test('B4/B5: "Spell focus (Combat)" and an unlabelled spell line', () => {
    const f = parseStatLine('focus', 'Spell focus (Combat) 3 4/48 hrs 45,000');
    assert.equal(f.name, 'Spell focus'); assert.equal(f.values['focusType'], 'spell'); assert.equal(f.values['target'], undefined); assert.equal(f.values['rating'], '3');
    const s = parseStatLine('spell', 'Example Bolt Combat M P Instant LOS (F/2)D');
    assert.equal(s.name, 'Example Bolt'); assert.equal(s.values['duration'], 'instant'); assert.equal(s.values['range'], 'los'); assert.equal(s.values['category'], 'combat');
  });
  test('B1/B6: a plain Approve never replaces a GM template; a replaced template keeps its shop mark', () => {
    const w = read('src', 'module', 'applications', 'newentry.ts');
    assert.match(w, /worldTemplates\(\)\.some\(\(t\) => t\.type === b\.type && t\.name\.toLowerCase\(\) === b\.name\.toLowerCase\(\)\)\) out\.push\(tx\('SR2E\.App\.NewEntry\.nameTaken'/);
    assert.match(w, /\.\.\.\(o\.inShop \|\| old\?\.shop \? \{ shop: true \} : \{\}\)/);
    assert.ok(keyIn('SR2E.App.NewEntry.nameTaken'));
  });
  test('R6: an adept power\'s cost never carries over from or to another kind', () => {
    assert.match(read('src', 'module', 'applications', 'newentry.ts'), /if \(k === 'adeptpower' \|\| this\.kind === 'adeptpower'\) keep\.delete\('cost'\);/);
  });
});

describe('v0.91.1 the Shop button', () => {
  test('a Shop tool (toolbar and tools window), a title-bar button on character sheets, the API', () => {
    assert.ok(TOOLS.some((t) => t.id === 'shop' && t.who === 'player' && t.toolbar));
    assert.ok(keyIn('SR2E.Tools.shop.label') && keyIn('SR2E.Tools.shop.hint'));
    assert.match(read('src', 'module', 'applications', 'tools.ts'), /shop: \(\) => \{ void openShop\(\); \},/);
    const add = read('src', 'module', 'applications', 'adding.ts');
    assert.match(add, /doc\.type !== 'character' \|\| !doc\.isOwner\) return false;/);
    assert.match(add, /if \(o\.shop\) \{ w\.payment = w\.finds \? 'find' : 'buy';/);
    assert.match(read('src', 'module', 'sr2e-system.ts'), /registerShopButton\(\);/);
    assert.match(read('src', 'module', 'sr2e-system.ts'), /openShop: \(actor\?: any\) => openShop\(actor\)/);
  });
});
