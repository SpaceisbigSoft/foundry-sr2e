/**
 * v0.94.0 (the lead's part): the import window's dispatcher (rules/imports094.ts) and the catalogue glue
 * (applications/catalogue.ts): a write-up passes through, a Nullsheen or futurekill file becomes a write-up, other JSON
 * is refused with a reason, and a re-import of the same file finds the same character.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { importInput, looksLikeJson, sameImport, MAX_IMPORT_JSON } from '../rules/imports094.ts';
import { parseCharacterSheet, characterImportPlan } from '../rules/charimport.ts';

const ROOT = process.cwd();
const fixture = (f: string) => readFileSync(join(ROOT, 'src', 'module', '__tests__', 'fixtures', f), 'utf8');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

describe('v0.94.0 what the import window was given', () => {
  test('a write-up passes through unchanged', () => {
    const r = importInput('Name: Sample Runner\nMetatype: Ork');
    assert.equal(r.source, 'writeup');
    assert.equal(r.text, 'Name: Sample Runner\nMetatype: Ork');
    assert.deepEqual(r.warnings, []);
    assert.equal(looksLikeJson('  {"a":1}'), true);
    assert.equal(looksLikeJson('Name: {x}'), false);
  });
  test('a Nullsheen file becomes a write-up the import reads', () => {
    const r = importInput(fixture('nullsheen-sr2-samurai.json'));
    assert.equal(r.source, 'nullsheen');
    assert.ok(r.key.startsWith('nullsheen:'));
    const plan = characterImportPlan(parseCharacterSheet(r.text));
    assert.ok(plan.items.length > 0);
  });
  test('a futurekill export becomes a write-up the import reads', () => {
    const r = importInput(fixture('futurekill-full.json'));
    assert.equal(r.source, 'futurekill');
    assert.ok(r.key.startsWith('futurekill:'));
    assert.ok(characterImportPlan(parseCharacterSheet(r.text)).items.length > 0);
  });
  test('broken, unknown and oversized JSON is refused with a reason, never thrown', () => {
    for (const raw of ['{"name": ', '{"hello": "world"}', '{' + ' '.repeat(MAX_IMPORT_JSON) + '}']) {
      const r = importInput(raw);
      assert.equal(r.text, '');
      assert.equal(r.warnings.length, 1);
    }
  });
  test('the same file finds the same character', () => {
    const r = importInput(fixture('nullsheen-sr2-adept.json'));
    assert.equal(sameImport({ source: 'nullsheen', key: r.key }, r), true);
    assert.equal(sameImport({ source: 'futurekill', key: r.key }, r), false);
    assert.equal(sameImport(null, r), false);
    assert.equal(sameImport({ source: 'writeup', key: '' }, { source: 'writeup', key: '' }), false);
    assert.equal(importInput(fixture('nullsheen-sr2-adept.json')).key, r.key);
  });
});

describe('v0.94.0 the catalogue glue', () => {
  const src = read('src', 'module', 'applications', 'catalogue.ts');
  test('the import converts first, stops on an unreadable file and marks the character', () => {
    assert.ok(src.includes('const input: ImportInput = importInput(text);'));
    assert.ok(src.includes("if (!input.text.trim() && input.warnings.length) throw new Error(input.warnings.join(' '));"));
    assert.ok(src.includes("await actor.setFlag(SYSTEM.id, 'importedFrom', { source: input.source, key: input.key });"));
  });
  test('the window loads a file into the box (read in the browser) and previews it; the GM path finds an earlier import', () => {
    assert.ok(src.includes('data-sr2e-import-file') && src.includes('f.text().then('));
    assert.ok(src.includes('const input = importInput(area.value);'));
    assert.ok(src.includes("sameImport(a.getFlag?.(SYSTEM.id, 'importedFrom'), input)"));
  });
});

describe('v0.94.0 review fixes', () => {
  test('a gear entry named like a label (Nuyen, Karma, Lifestyle) can\'t set those or end the list', () => {
    const ns = JSON.parse(fixture('nullsheen-sr2-samurai.json'));
    ns.gear = [...(Array.isArray(ns.gear) ? ns.gear : []), { Name: 'Nuyen 9999999', Type: 'Electronics', Amount: 1 }, { Name: 'Karma 500', Type: 'Electronics', Amount: 1 }, { Name: 'Sample Rope', Type: 'Survival', Amount: 1 }];
    const plan: any = characterImportPlan(parseCharacterSheet(importInput(JSON.stringify(ns)).text));
    assert.notEqual(plan.actorUpdate['system.nuyen'], 9999999);
    assert.notEqual(plan.actorUpdate['system.karma.good'], 500);
    assert.ok(plan.items.some((i: any) => /Sample Rope/i.test(i.name)), 'the gear after them still comes in');
  });
  test('two Nullsheen characters with the same name get different keys', () => {
    const a = JSON.parse(fixture('nullsheen-sr2-samurai.json'));
    const b = { ...a, race: a.race === 'Elf' ? 'Dwarf' : 'Elf' };
    assert.notEqual(importInput(JSON.stringify(a)).key, importInput(JSON.stringify(b)).key);
    assert.equal(importInput(JSON.stringify(a)).key, importInput(JSON.stringify({ ...a })).key);
  });
  test('a refused export stops the import (no empty character)', () => {
    const src = read('src', 'module', 'applications', 'catalogue.ts');
    assert.ok(src.includes("if (!input.text.trim() && input.warnings.length) throw new Error(input.warnings.join(' '));"));
    const r = importInput(JSON.stringify({ name: 'X', type: 'character', system: { attributes: { body: { base: 3 } }, metatype: 'human' }, items: [], _stats: { systemId: 'shadowrun2e_unified' } }));
    assert.equal(r.text.trim(), '');
    assert.ok(r.warnings.length >= 1);
  });
  test('a biography full of "<" is quick', () => {
    const fk = JSON.parse(fixture('futurekill-full.json'));
    fk.system.biography = '<'.repeat(60_000) + '<li'.repeat(20_000);
    const t0 = Date.now();
    importInput(JSON.stringify(fk));
    assert.ok(Date.now() - t0 < 500);
  });
  test('table lookups ignore inherited names (constructor, __proto__)', () => {
    const fk = JSON.parse(fixture('futurekill-full.json'));
    fk.system.race = 'constructor';
    fk.system.lifestyle = '__proto__';
    const r = importInput(JSON.stringify(fk));
    assert.ok(!/native code|\[object Object\]/.test(r.text));
  });
});
