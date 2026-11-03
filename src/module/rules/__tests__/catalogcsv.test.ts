import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  rowsToTemplates, templatesToCsv, catalogueToJson, parseCatalogueJson, mergeTemplates, parseNumberCell, parseBooleanCell,
  parseCatalogueDamage, parseCatalogueDrain, CATALOGUE_COLUMNS, CATALOGUE_TYPES, CATALOGUE_FORMAT,
} from '../catalogcsv.ts';
import type { ItemTemplate } from '../items.ts';

const ids = () => { let n = 0; return () => `id${++n}`; };

describe('v0.66.0 catalogue tools: delimited text', () => {
  // v0.81.1 (RC2-8): parseDelimited (a test-only wrapper) is gone; the same reading is checked through rowsToTemplates.
  test('commas, quotes with "" escapes, newlines inside quotes, CRLF, trimming, empty rows', () => {
    const r = rowsToTemplates('Name, Cost ,Notes\r\n"ZZ Pistol, Mk 2", 1500 ,"Says ""hi""\nline two"\r\n,,\r\n\r\nZZ Knife,10,\r\n', { defaultType: 'gear', makeId: ids() });
    assert.deepEqual(r.templates.map((t) => [t.name, t.system.cost, t.system.description ?? '']), [['ZZ Pistol, Mk 2', 1500, 'Says "hi"\nline two'], ['ZZ Knife', 10, '']]);
  });

  test('tabs (as copied from a spreadsheet) and semicolons are detected from the header', () => {
    assert.deepEqual(rowsToTemplates('Name\tCost\nZZ Pistol\t1,500', { defaultType: 'gear', makeId: ids() }).templates.map((t) => [t.name, t.system.cost]), [['ZZ Pistol', 1500]]);
    const semi = rowsToTemplates('Name;Cost;Essence\nZZ Eye;1.500;0,2', { defaultType: 'cyberware', makeId: ids() });
    assert.deepEqual(semi.templates.map((t) => [t.name, t.system.cost, t.system.essenceCost]), [['ZZ Eye', 1500, 0.2]]);
    assert.deepEqual(rowsToTemplates('Name,Cost\n"a;b;c;d",2', { defaultType: 'gear', makeId: ids() }).templates.map((t) => [t.name, t.system.cost]), [['a;b;c;d', 2]], 'delimiters inside quotes do not count');
  });

  test('numbers, booleans, damage and drain codes', () => {
    assert.equal(parseNumberCell('1,500'), 1500);
    assert.equal(parseNumberCell('¥1,500'), 1500);
    assert.equal(parseNumberCell('1.500', true), 1500);
    assert.equal(parseNumberCell('1.5'), 1.5);
    assert.equal(parseNumberCell('0,5'), 0.5);
    assert.equal(parseNumberCell('2 000 nuyen'), 2000);
    assert.equal(parseNumberCell('-2'), -2);
    assert.ok(Number.isNaN(parseNumberCell('lots')));
    for (const t of ['yes', 'Y', 'TRUE', 'x', '1', '✓']) assert.equal(parseBooleanCell(t), true, t);
    for (const t of ['no', 'false', '0', 'N']) assert.equal(parseBooleanCell(t), false, t);
    assert.equal(parseBooleanCell('maybe'), null);
    assert.deepEqual(parseCatalogueDamage('9M'), { power: 9, level: 'M', stun: null, strength: false });
    assert.deepEqual(parseCatalogueDamage('6S Stun'), { power: 6, level: 'S', stun: true, strength: false });
    assert.deepEqual(parseCatalogueDamage('(STR+2)M'), { power: 2, level: 'M', stun: null, strength: true });
    assert.deepEqual(parseCatalogueDamage('STR-1 L'), { power: -1, level: 'L', stun: null, strength: true });
    assert.equal(parseCatalogueDamage('lots'), null);
    assert.deepEqual(parseCatalogueDrain('[(F/2)+1]S'), { modifier: 1, level: 'S' });
    assert.deepEqual(parseCatalogueDrain('(F/2)-1 M'), { modifier: -1, level: 'M' });
    assert.deepEqual(parseCatalogueDrain('+2D'), { modifier: 2, level: 'D' });
    assert.deepEqual(parseCatalogueDrain('S'), { modifier: 0, level: 'S' });
    assert.equal(parseCatalogueDrain('F/2'), null);
  });
});

describe('v0.66.0 catalogue tools: rows to templates', () => {
  test('header aliases fill nested system data, only the columns given', () => {
    const r = rowsToTemplates('Name\tConceal\tAmmo\tMode\tDamage\tRange\tAvail\t¥\tStreet Index\tSmartgun\nZZ Pistol\t5\t12 (c)\tSA\t9M\t5/20/40/60\t4/48 hrs\t"1,500"\t1.5\tyes', { defaultType: 'weapon', makeId: ids() });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.unknownColumns, []);
    assert.equal(r.templates.length, 1);
    const t = r.templates[0]!;
    assert.equal(t.id, 'id1');
    assert.equal(t.type, 'weapon');
    assert.equal(t.name, 'ZZ Pistol');
    assert.deepEqual(t.system, {
      concealability: 5, ammoMax: 12, ammo: 12, feed: 'clip', modes: 'SA',
      damagePower: 9, strengthPower: false, damageLevel: 'M', damageType: 'physical',
      range: { short: 5, medium: 20, long: 40, extreme: 60 },
      availability: '4/48 hrs', cost: 1500, streetIndex: 1.5, smartgun: true,
    });
    assert.deepEqual(r.columns.map((c) => c.path), ['name', 'concealability', 'ammoMax, ammo, feed', 'modes', 'damagePower, damageLevel, damageType, strengthPower',
      'range.short, range.medium, range.long, range.extreme', 'availability', 'cost', 'streetIndex', 'smartgun']);
  });

  test('a Type column per row, Strength damage, stun, armor shorthand, bioware and choice prefixes', () => {
    const csv = [
      'Type,Name,Damage,Armor,Ess,Grade,Body Index,Cost (¥),Reach',
      'Weapon,ZZ Club,(STR+1)M Stun,,,,,50,1',
      'Armour,ZZ Vest,,5/3,,,,200,',
      'Cyberware,ZZ Eye,,,0.2,alphaware,,1000,',
      'Bioware,ZZ Gland,,,,,0.4,9000,',
      'Spell,ZZ Bolt,S,,,,,,',
    ].join('\n');
    const r = rowsToTemplates(csv, { makeId: ids() });
    assert.deepEqual(r.errors, []);
    const [club, vest, eye, gland, bolt] = r.templates;
    assert.deepEqual(club!.system, { damagePower: 1, strengthPower: true, damageLevel: 'M', damageType: 'stun', cost: 50, reach: 1 });
    assert.deepEqual(vest!.system, { ballistic: 5, impact: 3, cost: 200 });
    assert.deepEqual(eye!.system, { essenceCost: 0.2, grade: 'alpha', cost: 1000 });
    assert.equal(gland!.type, 'cyberware');
    assert.deepEqual(gland!.system, { bioware: true, bodyIndex: 0.4, cost: 9000 });
    assert.deepEqual(bolt!.system, { damageLevel: 'S', damageType: 'physical' });
    assert.deepEqual(r.warnings, [], 'empty cells in columns another type uses are no bother');
  });

  test('spells: Type M/P read as the spell type, drain shorthand, duration letters', () => {
    const r = rowsToTemplates('Name;Category;Type;Duration;Drain;Force\nZZ Glow;Manipulation;P;S;[(F/2)+1]M;3', { defaultType: 'spell', makeId: ids() });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.templates[0]!.system, { category: 'manipulation', spellType: 'physical', duration: 'sustained', drainModifier: 1, drainLevel: 'M', learnedForce: 3 });
    assert.ok(r.warnings.some((w) => /spellType/.test(w)));
  });

  test('bad cells, unknown types, missing names: row errors naming the cell, 1-based rows with the header as row 1', () => {
    const csv = 'Type,Name,Cost,Damage,Level\nweapon,ZZ A,lots,9M,\nweapon,ZZ B,10,9Q,\nwidget,ZZ C,,,\nweapon,,5,,\nweapon,ZZ E,5,,Z\nweapon,ZZ F,7,6L,';
    const r = rowsToTemplates(csv, { makeId: ids() });
    assert.deepEqual(r.templates.map((t) => t.name), ['ZZ F']);
    const rows = r.errors.map((e) => e.row);
    assert.deepEqual(rows, [2, 3, 4, 5, 6]);
    assert.match(r.errors[0]!.message, /Cost: "lots" is not a number/);
    assert.match(r.errors[1]!.message, /Damage: "9Q"/);
    assert.match(r.errors[2]!.message, /"widget" is not an item type/);
    assert.match(r.errors[3]!.message, /No name/);
    assert.match(r.errors[4]!.message, /Level: "Z" is not one of L, M, S, D/);
  });

  test('integers, minimums and a whole-number check', () => {
    const r = rowsToTemplates('Name,Conceal,Weight\nZZ A,2.5,1.5\nZZ B,-1,\nZZ C,-,', { defaultType: 'weapon', makeId: ids() });
    assert.match(r.errors[0]!.message, /not a whole number/);
    assert.match(r.errors[1]!.message, /below the minimum 0/);
    assert.deepEqual(r.templates.map((t) => t.system), [{}], 'a dash means empty');
  });

  test('unknown columns are listed once and ignored; no Name column is an error', () => {
    const r = rowsToTemplates('Name,Page,Flavour,Cost\nZZ A,12,x,1\nZZ B,13,y,2', { defaultType: 'gear', makeId: ids() });
    assert.deepEqual(r.unknownColumns, ['Page', 'Flavour']);
    assert.deepEqual(r.columns[1], { header: 'Page', path: null });
    assert.equal(r.templates.length, 2);
    assert.deepEqual(r.templates[1]!.system, { cost: 2 });
    const none = rowsToTemplates('Item Cost,Weight\n1,2', { defaultType: 'gear', makeId: ids() });
    assert.equal(none.errors[0]!.row, 1);
  });

  test('a row matching an existing template keeps its id and says it replaces it; duplicates in the paste: last wins', () => {
    const existing: ItemTemplate[] = [{ id: 'old1', type: 'gear', name: 'ZZ Rope', system: { cost: 1 } }, { id: 'old2', type: 'weapon', name: 'ZZ Rope', system: {} }];
    const r = rowsToTemplates('Name,Qty,Cost\nzz rope,2,5\nZZ Torch,1,3\nZZ Torch,1,4', { defaultType: 'gear', existing, makeId: ids() });
    assert.deepEqual(r.templates.map((t) => [t.id, t.name, t.system.cost]), [['old1', 'zz rope', 5], ['id1', 'ZZ Torch', 4]]);
    assert.ok(r.warnings.some((w) => /Row 2: "zz rope" replaces the existing gear template/.test(w)));
    assert.ok(r.warnings.some((w) => /Row 4: .* appears twice/.test(w)));
  });

  test('a column meaning nothing for one row type is warned about, not an error', () => {
    const r = rowsToTemplates('Type,Name,Ballistic,Cost\narmor,ZZ Coat,4,100\ngear,ZZ Box,2,5', { makeId: ids() });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.templates[1]!.system, { cost: 5 });
    assert.ok(r.warnings.some((w) => /"Ballistic" column means nothing for a gear/.test(w)));
  });

  test('header lookup', () => {
    // v0.81.0: catalogueHeaderPath was dead (the paste preview reads CatalogueImport.columns); the same lookups through it.
    const catalogueHeaderPath = (type: string, header: string) =>
      rowsToTemplates(`Name,${header}\nX,`, { defaultType: type, makeId: () => 'id' }).columns.find((c) => c.header === header)?.path ?? null;
    assert.equal(catalogueHeaderPath('weapon', 'Recoil Comp.'), 'recoilComp');
    assert.equal(catalogueHeaderPath('weapon', 'Price'), 'cost');
    assert.equal(catalogueHeaderPath('cyberware', 'ESS'), 'essenceCost');
    assert.equal(catalogueHeaderPath('gear', 'Weight (kg)'), 'weight');
    assert.equal(catalogueHeaderPath('weapon', 'system.turret.facing'), 'turret.facing');
    assert.equal(catalogueHeaderPath('weapon', 'Flavour'), null);
  });

  test('every column path and type is well-formed', () => {
    for (const t of CATALOGUE_TYPES) {
      const paths = CATALOGUE_COLUMNS[t].map((c) => c.path);
      assert.equal(new Set(paths).size, paths.length, `${t} has a path twice`);
      for (const c of CATALOGUE_COLUMNS[t]) if (c.kind === 'choice') assert.ok(c.choices && c.choices.length > 0, `${t}.${c.path}`);
    }
  });
});

describe('v0.66.0 catalogue tools: CSV export', () => {
  const templates: ItemTemplate[] = [
    { id: 'a', type: 'weapon', name: 'ZZ Pistol, "Mk 2"', system: { damagePower: 9, damageLevel: 'M', range: { short: 5, medium: 20, long: 40, extreme: 60 }, ammo: 10, ammoMax: 12, smartgun: false, cost: 1500, availability: '4/48 hrs', turret: { facing: 90 }, toxinId: '007', description: 'Two\nlines' } },
    { id: 'b', type: 'armor', name: 'ZZ Vest', system: { ballistic: 5, impact: 3, cost: 200, worn: true } },
    { id: 'c', type: 'program', name: 'ZZ Hammer', system: { kind: 'attack', rating: 4, options: ['a', 'b'] } },
  ];

  test('header Type, Name, known columns then others as system.path; quoting where needed', () => {
    const csv = templatesToCsv(templates);
    const header = csv.split('\r\n')[0]!.split(',');
    assert.deepEqual(header.slice(0, 2), ['Type', 'Name']);
    assert.ok(header.includes('loaded'), 'the loaded rounds column avoids the Ammo shorthand');
    assert.ok(header.indexOf('damagePower') < header.indexOf('system.options'));
    assert.deepEqual(header.filter((h) => h.startsWith('system.')), ['system.options', 'system.toxinId', 'system.turret.facing']);
    assert.equal(rowsToTemplates(csv, { makeId: ids() }).templates[0]!.name, 'ZZ Pistol, "Mk 2"');
    assert.equal(templatesToCsv(templates, 'armor').split('\r\n')[0], 'Type,Name,ballistic,impact,worn,cost');
  });

  test('round trip through rowsToTemplates', () => {
    const r = rowsToTemplates(templatesToCsv(templates), { existing: templates, makeId: ids() });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.unknownColumns, []);
    assert.deepEqual(r.templates, templates);
  });
});

describe('v0.66.0 catalogue tools: catalogue JSON and merging', () => {
  const tpl: ItemTemplate = { id: 't1', type: 'gear', name: 'ZZ Rope', system: { cost: 5 }, world: true };
  const kit = { name: 'ZZ Kit', lines: [{ templateId: 't1', qty: 2 }] };

  test('export and read back', () => {
    const text = catalogueToJson({ templates: [tpl], kits: [kit], exportedAt: '2026-10-22T00:00:00Z', systemVersion: '0.66.0' });
    const data = JSON.parse(text);
    assert.equal(data.format, CATALOGUE_FORMAT);
    assert.equal(data.version, 2); // v0.84.0: version 2 (actors); version 1 files still read
    assert.equal(data.templates[0].world, undefined);
    assert.equal(data.actors, undefined, 'no actors list when there are none');
    const back = parseCatalogueJson(text);
    assert.deepEqual(back.errors, []);
    assert.deepEqual(back.templates, [{ id: 't1', type: 'gear', name: 'ZZ Rope', system: { cost: 5 } }]);
    assert.deepEqual(back.kits, [kit]);
  });

  test('validation', () => {
    assert.match(parseCatalogueJson('{oops').errors[0]!, /Not valid JSON/);
    assert.match(parseCatalogueJson('{"format":"other","version":1}').errors[0]!, /Not a catalogue/);
    assert.match(parseCatalogueJson(`{"format":"${CATALOGUE_FORMAT}","version":3}`).errors[0]!, /newer/);
    const mixed = parseCatalogueJson(JSON.stringify({
      format: CATALOGUE_FORMAT, version: 1,
      templates: [tpl, { type: 'widget', name: 'X', system: {} }, { type: 'gear', name: '', system: {} }, { type: 'gear', name: 'Y', system: 3 }, 'nope'],
      kits: [kit, { name: 'bad' }, { lines: [] }],
    }));
    assert.equal(mixed.templates.length, 1);
    assert.equal(mixed.kits.length, 1);
    assert.equal(mixed.errors.length, 6);
    assert.match(mixed.errors[0]!, /Template 2 \("X"\): unknown item type/);
  });

  test('merge modes: replace keeps the old id, skip keeps the old, copy numbers the name', () => {
    const existing: ItemTemplate[] = [{ id: 'e1', type: 'gear', name: 'ZZ Rope', system: { cost: 1 } }];
    const incoming: ItemTemplate[] = [{ id: 'e1', type: 'gear', name: 'zz rope', system: { cost: 9 } }, { id: 'n1', type: 'gear', name: 'ZZ Torch', system: {} }];
    const rep = mergeTemplates(existing, incoming, 'replace', ids());
    assert.deepEqual([rep.added, rep.replaced, rep.skipped], [1, 1, 0]);
    assert.deepEqual(rep.list.map((t) => [t.id, t.name, t.system.cost]), [['e1', 'zz rope', 9], ['n1', 'ZZ Torch', undefined]]);
    assert.equal(existing[0]!.system.cost, 1, 'inputs untouched');
    const skip = mergeTemplates(existing, incoming, 'skip', ids());
    assert.deepEqual([skip.added, skip.replaced, skip.skipped], [1, 0, 1]);
    assert.equal(skip.list[0]!.system.cost, 1);
    const copy = mergeTemplates(existing, [...incoming, { id: '', type: 'gear', name: 'ZZ Rope (2)', system: {} }], 'copy', ids());
    assert.deepEqual(copy.list.map((t) => [t.id, t.name]), [['e1', 'ZZ Rope'], ['id1', 'zz rope (2)'], ['n1', 'ZZ Torch'], ['id2', 'ZZ Rope (3)']]);
    assert.equal(copy.added, 3);
  });
});

describe('v0.66.0 review fixes (catalogue)', () => {
  test('a header through a prototype is ignored', () => {
    const r = rowsToTemplates('Name,Type,system.__proto__.polluted\nX,gear,1', { makeId: () => 'id' });
    assert.equal(({} as any).polluted, undefined);
    assert.ok(r.unknownColumns.length >= 1);
  });
});
