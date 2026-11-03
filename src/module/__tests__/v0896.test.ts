/**
 * v0.89.6: localization, seventh slice: the text the code builds at run time (sheet previews and hints, option
 * labels, window text, Token Action HUD labels, tours, the printable sheet, import reports, Apply (GM) lines, NPC
 * generator descriptions, ledger reasons …) moves into lang/en.json: `SR2E.App.<File>` for the windows' code,
 * `SR2E.Text.<File>` for text the rules build, `SR2E.Card.Actor` / `SR2E.Text.Actor` for documents/index.ts.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src', 'module');
const lang = JSON.parse(readFileSync(join(ROOT, 'public', 'lang', 'en.json'), 'utf8'));
const files = (d: string, out: string[] = []): string[] => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== '__tests__') files(p, out); } else if (f.endsWith('.ts')) out.push(p);
  }
  return out;
};
const ALL = files(SRC).map((f) => ({ rel: relative(ROOT, f), src: readFileSync(f, 'utf8') }));
const CODE = ALL.map((x) => x.src).join('\n');
/** Leaf keys of a store; a counted text ({one, other}) is one key. */
const leaves = (o: any, p: string, out: string[] = []): string[] => {
  for (const [k, v] of Object.entries(o ?? {})) {
    if (v && typeof v === 'object' && !Object.keys(v as any).every((x) => ['zero', 'one', 'two', 'few', 'many', 'other'].includes(x))) leaves(v, `${p}.${k}`, out);
    else out.push(`${p}.${k}`);
  }
  return out;
};

describe('v0.89.6 the code-built text', () => {
  test('every SR2E.Text and SR2E.App key is used by the code (as a literal), and counted texts have an `other`', () => {
    const unused: string[] = [];
    for (const store of ['Text', 'App']) {
      for (const k of leaves(lang.SR2E[store], `SR2E.${store}`)) if (!CODE.includes(`'${k}'`) && !CODE.includes(`"${k}"`)) unused.push(k);
    }
    assert.deepEqual(unused, []);
    const bad: string[] = [];
    const PLURAL = ['zero', 'one', 'two', 'few', 'many', 'other'];
    const walk = (o: any, p: string) => { for (const [k, v] of Object.entries(o ?? {})) { if (v && typeof v === 'object') { const ks = Object.keys(v as any); if (ks.length && ks.every((x) => PLURAL.includes(x)) && !ks.includes('other')) bad.push(`${p}.${k}`); else walk(v, `${p}.${k}`); } } };
    for (const store of ['Text', 'App', 'Card', 'Count']) walk(lang.SR2E[store], `SR2E.${store}`);
    assert.deepEqual(bad, []);
  });

  test('no text in the new stores holds a tag or is itself a key', () => {
    const bad: string[] = [];
    for (const store of ['Text', 'App']) {
      for (const k of leaves(lang.SR2E[store], `SR2E.${store}`)) {
        const v = k.split('.').slice(1).reduce((o: any, p) => o?.[p], lang.SR2E);
        for (const t of typeof v === 'string' ? [v] : Object.values(v ?? {}) as string[]) {
          if (/<\/?(p|strong|em|b|i|u|br|span|div|ul|ol|li|a|code|kbd|pre|h[1-6]|table|tr|td|th|button|label|input|select|option|img)\b/i.test(String(t))) bad.push(`${k} holds a tag`);
          if (String(t).startsWith('SR2E.')) bad.push(`${k} is a key`);
        }
      }
    }
    assert.deepEqual(bad, []);
  });

  test('no tx call runs at module load in the rules (a top-level constant would keep the key)', () => {
    const bad: string[] = [];
    for (const { rel, src } of ALL) {
      if (!rel.includes('/rules/') && !rel.includes('/applications/')) continue;
      for (const line of src.split('\n')) {
        if (/^(export )?const [A-Za-z_$][\w$]* *(:[^=]+)?= *tx\(/.test(line)) bad.push(`${rel}: ${line.slice(0, 80)}`);
      }
    }
    assert.deepEqual(bad, []);
  });
});

describe('v0.89.6 review fixes', () => {
  const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
  test('label maps that hold keys are read with tKey everywhere (no raw key on the summon dialog or the site sheet)', () => {
    const sheets = read('src', 'module', 'applications', 'sheets.ts');
    for (const name of ['SPIRIT_KIND_LABELS', 'TRADITION_LABELS', 'SENSE_LABELS', 'CONCEAL_LABELS']) {
      const reads = [...sheets.matchAll(new RegExp(`${name}\\[[^\\]]+\\] \\?\\?`, 'g'))];
      assert.deepEqual(reads.map((m) => m[0]), [], `${name} read without tKey`);
    }
  });
  test('ledger lines and project labels the advancement log matches stay English; raises match an English alias too', async () => {
    const adding = read('src', 'module', 'applications', 'adding.ts');
    assert.match(adding, /`Bought \$\{timed\.map/);
    assert.match(adding, /`\$\{x\.l\.name\} on order`/);
    const { composeAdvancement, actorRaises } = await import('../rules/advancement.ts');
    const raises = actorRaises({ attributes: { body: { base: 4 } } }, { 'system.attributes.body.base': 5 });
    assert.equal(raises[0]!.alias, 'Body');
    const lines = composeAdvancement([{ kind: 'ledger', entry: { kind: 'karma', amount: -20, reason: 'Body 4 → 5' } }, { kind: 'raise', ...raises[0]!, label: 'Konstitution' }] as any, { by: 'u', at: 'now', t: 0 });
    assert.equal(lines.length, 1, 'the raise is covered by the English ledger line');
  });
  test('the effects groups and skill groups carry their English heading ids; the bug report stays English', () => {
    assert.match(read('public', 'templates', 'effects-section.hbs'), /data-heading="\{\{heading\}\}"/);
    assert.match(read('public', 'templates', 'actor-character-sheet.hbs'), /<h2 data-heading="\{\{heading\}\}">\{\{label\}\}/);
    assert.match(read('src', 'module', 'rules', 'bugreport.ts'), /'### What happened'/);
  });
  test('statblock warning codes survive a copy of the list', async () => {
    const S = await import('../rules/statblock.ts');
    const r: any = (S as any).parseStatBlock?.('ZZ Nobody\nno attributes here');
    const w: string[] = r?.warnings ?? [];
    for (const t of w) assert.equal(S.statBlockWarningCode([...w], t), S.statBlockWarningCode(w, t));
  });
});
