/**
 * v0.81.1 (live-confirmed critical): a player's HTML field (biography, notes, description) is cleaned before a
 * sheet shows it. In Foundry the DOM path runs; here the no-DOM and no-cleaner paths are checked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const g = globalThis as any;

test('without Foundry\'s cleaner the text is escaped, never shown as HTML', async () => {
  g.foundry = { utils: {} };
  const { cleanRichHtml } = await import('../applications/richtext.ts');
  const out = cleanRichHtml('<img src=x onerror="window.__q=1">');
  assert.ok(!out.includes('<img'), out);
  assert.match(out, /&lt;img/);
});

test('with the cleaner but no DOM, the text is escaped (v0.81.1: the regex fallback is gone; the DOM path is in v0811-app)', async () => {
  // A stand-in for foundry.utils.cleanHTML that (like Foundry's) drops on* handlers but keeps data-* and style.
  g.foundry = { utils: { cleanHTML: (s: string) => s.replace(/\son[a-z]+="[^"]*"/gi, '') } };
  const { cleanRichHtml } = await import('../applications/richtext.ts');
  const out = cleanRichHtml('<p>x<span data-action="dropPowerEffect" data-sr2e-action="resist" data-id="y" style="position:fixed;inset:0">.</span><img src="x" onerror="window.__q=1"></p>');
  assert.ok(!out.includes('<span'), out);
  assert.match(out, /&lt;span/);
});

test('the sheets enrich through cleanRichHtml, before and after enriching (source check)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../applications/richtext.ts', import.meta.url), 'utf8');
  assert.match(src, /const safe = cleanRichHtml\(raw\);\n\s*out\[k\] = safe && TE\?\.enrichHTML \? cleanRichHtml\(await TE\.enrichHTML\(safe/);
  assert.match(src, /const safe = cleanRichHtml\(desc\);/);
});

test('v0.81.1 live (SEC2b-4d): every rich-text editor starts from the cleaned source, never the raw field', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = path.join(process.cwd(), 'public/templates');
  let editors = 0;
  for (const f of fs.readdirSync(dir).filter((x: string) => x.endsWith('.hbs'))) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of t.matchAll(/<prose-mirror\b[^>]*>/g)) {
      editors++;
      assert.match(m[0], /value="\{\{richSource\.\w+\}\}"/, `${f}: ${m[0]}`);
    }
  }
  assert.ok(editors >= 15, `found ${editors} editors`);
  const src = fs.readFileSync(path.join(process.cwd(), 'src/module/applications/richtext.ts'), 'utf8');
  assert.match(src, /context\.richSource = cleanFields\(this\.document\)/);
});

test('cleanFields cleans each HTML field (here: the no-DOM path escapes; Foundry runs the DOM path)', async () => {
  g.foundry = { utils: { cleanHTML: (s: string) => s } };
  const { cleanFields } = await import('../applications/richtext.ts');
  const out = cleanFields({ system: { biography: '<img src=x onerror="window.__pm=1">', notes: 'plain', hp: 3 } });
  assert.deepEqual(Object.keys(out).sort(), ['biography', 'notes']);
  assert.ok(!out.biography!.includes('<img'), out.biography);
  assert.equal(out.notes, 'plain');
});

test('v0.81.1: an item card\'s picture keeps only a relative path or http(s)', async () => {
  const { safeImgSrc } = await import('../applications/richtext.ts');
  const bag = 'icons/svg/item-bag.svg';
  assert.equal(safeImgSrc('systems/sr2e/icons/gun.svg'), 'systems/sr2e/icons/gun.svg');
  assert.equal(safeImgSrc('worlds/w/a b.png'), 'worlds/w/a b.png');
  assert.equal(safeImgSrc('https://example.com/a.png'), 'https://example.com/a.png');
  for (const bad of ['javascript:alert(1)', 'java\tscript:x', '//evil.example/x.png', 'data:text/html,x', 'vbscript:x', 'C:/x.png', '', null]) assert.equal(safeImgSrc(bad), bag, String(bad));
});
