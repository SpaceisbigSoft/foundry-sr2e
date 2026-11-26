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
    assert.ok(src.includes("if (input.source === 'writeup' && !input.text.trim() && input.warnings.length) throw new Error(input.warnings[0]);"));
    assert.ok(src.includes("await actor.setFlag(SYSTEM.id, 'importedFrom', { source: input.source, key: input.key });"));
  });
  test('the window loads a file into the box (read in the browser) and previews it; the GM path finds an earlier import', () => {
    assert.ok(src.includes('data-sr2e-import-file') && src.includes('f.text().then('));
    assert.ok(src.includes('const input = importInput(area.value);'));
    assert.ok(src.includes("sameImport(a.getFlag?.(SYSTEM.id, 'importedFrom'), input)"));
  });
});
