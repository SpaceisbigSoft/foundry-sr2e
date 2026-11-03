import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// v0.62.0, the UI pass: file-level checks that need no Foundry.
const root = process.cwd();
const tplDir = join(root, 'public', 'templates');
const templates = readdirSync(tplDir).filter((f) => f.endsWith('.hbs'));
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const srcFiles = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? (d.name === '__tests__' ? [] : srcFiles(join(dir, d.name))) : d.name.endsWith('.ts') ? [join(dir, d.name)] : []);
const allSource = srcFiles('src/module').map((f) => read(f)).join('\n');

describe('v0.62.0 UI pass', () => {
  test('every sheet and window part keeps its scroll place on re-render', () => {
    for (const f of ['sheets.ts', 'safehouse.ts', 'ui.ts', 'npcgen.ts']) {
      const s = read('src/module/applications', f);
      const parts = [...s.matchAll(/main:\s*\{\s*template:\s*`[^`]*`[^}]*\}/g)].map((m) => m[0]);
      assert.ok(parts.length > 0, `${f} has PARTS`);
      for (const p of parts) assert.match(p, /scrollable:\s*\[\s*(''|"")\s*\]/, `${f}: ${p}`);
    }
  });

  test('the item sheet can be resized', () => {
    const s = read('src/module/applications/sheets.ts');
    const block = s.slice(s.indexOf('export class SR2ItemSheet'), s.indexOf('actions:', s.indexOf('export class SR2ItemSheet')));
    assert.match(block, /resizable:\s*true/);
  });

  test('Handlebars blocks are balanced in every template', () => {
    for (const f of templates) {
      const s = read('public/templates', f);
      for (const k of ['if', 'each', 'unless', 'with']) {
        const open = (s.match(new RegExp(`\\{\\{#${k}\\b`, 'g')) ?? []).length;
        const close = (s.match(new RegExp(`\\{\\{/${k}\\}\\}`, 'g')) ?? []).length;
        assert.equal(open, close, `${f}: {{#${k}}} ${open} vs {{/${k}}} ${close}`);
      }
    }
  });

  test('every data-action in a template has a handler in the code', () => {
    const missing: string[] = [];
    for (const f of templates) {
      for (const m of read('public/templates', f).matchAll(/data-action="([^"{]+)"/g)) {
        const a = m[1] as string;
        const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Registered as a handler key (actions: { name: … }); a bare quoted string doesn't count.
        if (!new RegExp(`(?<![\\w.])${esc}\\s*:`).test(allSource)) missing.push(`${f}: ${a}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  test('actor sheet headers put the name over its controls', () => {
    for (const f of templates.filter((t) => t.startsWith('actor-'))) {
      const s = read('public/templates', f);
      assert.match(s, /<header class="sr2e-header">\s*<img [^>]*>\s*<div class="sr2e-header-main">\s*<input type="text" name="name"/, f);
    }
  });

  test('NPC and spirit stat lines are compact cells, one per attribute', () => {
    for (const f of ['actor-npc-sheet.hbs', 'actor-spirit-sheet.hbs']) {
      const s = read('public/templates', f);
      assert.ok(s.includes('class="sr2e-statgrid"'), f);
      assert.ok(!s.includes('sr2e-statline'), `${f} still has the old table`);
      assert.match(s, /\{\{#each attributes\}\}<div class="sr2e-stat"><a class="sr2e-stat-label" data-action="rollAttribute"/, f);
    }
    assert.match(read('public/templates', 'actor-npc-sheet.hbs'), /name="system\.attributes\.\{\{key\}\}\.base"/);
  });

  test('the stylesheet: balanced braces, no clashing pip or pool rules, every sheet scrolls', () => {
    const css = read('public/style/sr2e.css');
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"]*"/g, '""');
    assert.equal((bare.match(/\{/g) ?? []).length, (bare.match(/\}/g) ?? []).length, 'braces');
    // v0.37.0's ammo pips and the tracker's pools reused the summary's class names and restyled them.
    assert.equal((bare.match(/(^|\})\s*\.sr2e-pip\s*\{/gm) ?? []).length, 1, 'one bare .sr2e-pip rule (the pools); ammo pips are scoped');
    assert.ok(!/(^|\})\s*\.sr2e-pools\s*\{[^}]*font-size:\s*0\.7rem/m.test(bare), 'the tracker restyles the summary pools');
    assert.match(css, /\.sr2e\.sheet \.window-content > \.sr2e-sheet,[\s\S]*?overflow-y:\s*auto/);
    assert.match(css, /\.application\.dialog > \.window-content \{[^}]*overflow-y:\s*auto/);
    // Review fixes: sheet button rules stay inside the window content (not the window header or rich-text menus),
    // list and heading rules skip rich text, and money fields are wide.
    const layer = css.slice(css.indexOf('v0.62.0: the UI pass'));
    assert.ok(!/\.sr2e\.sheet button[\s,{]/.test(layer), 'an unscoped sheet button rule');
    assert.ok(!/ul:not\(\.sr2e-warnings\)[^,]/.test(layer), 'a list rule that reaches rich text');
    assert.match(layer, /h2:not\(\.sr2e-rich h2\)/);
    // The open rich-text editor is a flex column with a height (display:block hid its text since v0.59.0).
    assert.match(layer, /\.sr2e prose-mirror\.sr2e-rich\.active \{ display: flex; flex-direction: column; height: 22rem; \}/);
    assert.match(layer, /input\[type="number"\]\[name="system\.nuyen"\][^{]*\{ width: 7\.5rem/);
  });

  test('the tracker uses its own pool class', () => {
    const s = read('src/module/applications/tokens.ts');
    assert.ok(s.includes("'sr2e-tracker-pools'") && !s.includes("'sr2e-pools'"));
  });
});
