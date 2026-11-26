/**
 * v0.93.4 (the lead's part): Play/Edit finished (report item 25), list sort and filter (26), Foundry's tooltips and
 * popped-out windows (49), one roll window at a time (50), and the clearer prompt and dialog wording.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sortRows, nextSort, isSortMode, rowsHaveValue, LIST_FILTER_MIN, LIST_SORT_MIN } from '../rules/lists0934.ts';
import { moveTitle, TOOLTIP_SCOPE } from '../applications/tooltips.ts';
import { onEveryDocument, noteDocument, resetDocuments, isPoppedOut, docOf } from '../helpers/docs.ts';

const read = (f: string) => fs.readFileSync(f, 'utf8');

describe('v0.93.4 list sort', () => {
  const rows = [
    { name: 'Firearms', value: 6 }, { name: 'athletics', value: 3 }, { name: 'Car', value: null }, { name: 'Etiquette', value: 6 }, { name: 'Biotech', value: 2 },
  ];
  test('the sheet order is kept as it is', () => {
    assert.deepEqual(sortRows(rows, 'sheet'), [0, 1, 2, 3, 4]);
  });
  test('A to Z ignores case, Z to A reverses it', () => {
    assert.deepEqual(sortRows(rows, 'name').map((i) => rows[i]!.name), ['athletics', 'Biotech', 'Car', 'Etiquette', 'Firearms']);
    assert.deepEqual(sortRows(rows, 'nameDesc').map((i) => rows[i]!.name), ['Firearms', 'Etiquette', 'Car', 'Biotech', 'athletics']);
  });
  test('highest number first, ties by name, rows without a number last', () => {
    assert.deepEqual(sortRows(rows, 'value').map((i) => rows[i]!.name), ['Etiquette', 'Firearms', 'athletics', 'Biotech', 'Car']);
  });
  test('numbers in names sort as numbers', () => {
    const r = [{ name: 'Clip 10', value: null }, { name: 'Clip 9', value: null }];
    assert.deepEqual(sortRows(r, 'name'), [1, 0]);
  });
  test('the click cycle: sheet, A–Z, Z–A, highest (only with numbers), sheet', () => {
    assert.equal(nextSort('sheet', true), 'name');
    assert.equal(nextSort('name', true), 'nameDesc');
    assert.equal(nextSort('nameDesc', true), 'value');
    assert.equal(nextSort('value', true), 'sheet');
    assert.equal(nextSort('nameDesc', false), 'sheet');
    assert.ok(rowsHaveValue(rows));
    assert.ok(!rowsHaveValue([{ name: 'x', value: null }]));
    assert.ok(isSortMode('value') && !isSortMode('rating') && !isSortMode(undefined));
    assert.ok(LIST_SORT_MIN <= LIST_FILTER_MIN);
  });
});

/** A small stand-in for an element's attributes. */
function el(attrs: Record<string, string>, text = '') {
  const a = new Map(Object.entries(attrs));
  return {
    attrs: a, textContent: text,
    getAttribute: (n: string) => (a.has(n) ? a.get(n)! : null),
    setAttribute: (n: string, v: string) => { a.set(n, v); },
    removeAttribute: (n: string) => { a.delete(n); },
  };
}

describe('v0.93.4 Foundry tooltips', () => {
  test('a title moves to Foundry\'s tooltip attributes, escaped for the HTML one', () => {
    const e = el({ title: 'Reload <b>"Ares"</b> & go' }, '');
    assert.ok(moveTitle(e));
    assert.equal(e.getAttribute('title'), null);
    assert.equal(e.getAttribute('data-tooltip-text'), 'Reload <b>"Ares"</b> & go');
    assert.equal(e.getAttribute('data-tooltip'), 'Reload &lt;b&gt;&quot;Ares&quot;&lt;/b&gt; &amp; go');
    // An icon with no words keeps the text as its name for screen readers.
    assert.equal(e.getAttribute('aria-label'), 'Reload <b>"Ares"</b> & go');
  });
  test('a control with words or its own label keeps them; an empty title is just dropped', () => {
    const w = el({ title: 'Roll' }, 'Firearms');
    moveTitle(w);
    assert.equal(w.getAttribute('aria-label'), null);
    const l = el({ title: 'Roll', 'aria-label': 'Roll Firearms' });
    moveTitle(l);
    assert.equal(l.getAttribute('aria-label'), 'Roll Firearms');
    const empty = el({ title: '  ' });
    assert.equal(moveTitle(empty), false);
    assert.equal(empty.getAttribute('title'), null);
    assert.equal(empty.getAttribute('data-tooltip'), null);
    assert.equal(moveTitle(el({})), false);
  });
  test('only SR2e\'s own windows and cards, never in a popped-out window', () => {
    for (const c of ['.sr2e', '.sr2e-dialog', '.sr2e-card', '.sr2e-hover-card']) assert.ok(TOOLTIP_SCOPE.includes(c));
    const src = read('src/module/applications/tooltips.ts');
    assert.match(src, /isPoppedOut\(el\)/);
    assert.match(src, /'pointerover', onReach, true/);
    assert.match(read('src/module/sr2e-system.ts'), /registerFoundryTooltips\(\);/);
  });
});

describe('v0.93.4 popped-out windows', () => {
  test('a page-wide listener is set up for the main page and again for each new document, once each', () => {
    resetDocuments();
    const calls: any[] = [];
    const main: any = { name: 'main', defaultView: {} };
    const pop: any = { name: 'pop', defaultView: { closed: false } };
    noteDocument(main);
    onEveryDocument((d) => calls.push((d as any).name ?? d));
    noteDocument(pop);
    noteDocument(pop);
    assert.equal(calls.filter((c) => c === 'pop').length, 1);
    assert.ok(calls.includes('main'));
    resetDocuments();
  });
  test('an element outside the main page counts as popped out', () => {
    const other: any = {};
    assert.equal(isPoppedOut({ ownerDocument: other } as any), (globalThis as any).document !== undefined);
    assert.equal(docOf({ ownerDocument: other } as any), other);
  });
  test('the page-wide listeners go through onEveryDocument; the wheel and focus checks use the field\'s own document', () => {
    for (const f of ['hotkeys', 'help', 'inline', 'interpretations', 'a11y']) {
      const s = read(`src/module/applications/${f}.ts`);
      assert.doesNotMatch(s, /\bdocument\.addEventListener\(/, `${f}.ts still listens on the main document only`);
      assert.match(s, /onEveryDocument\(/);
    }
    assert.match(read('src/module/applications/interface.ts'), /t\.ownerDocument\.activeElement !== t/);
    assert.doesNotMatch(read('src/module/applications/a11y.ts'), /document\.activeElement/);
    assert.match(read('src/module/sr2e-system.ts'), /registerPopOutWatch\(\);/);
  });
});

describe('v0.93.4 one roll window at a time', () => {
  test('the other open roll windows are found, not this one and not other dialogs', async () => {
    const { otherRollWindows } = await import('../applications/interface.ts');
    const roll = (id: string) => ({ id, element: { classList: { contains: (c: string) => c === 'sr2e-roll-dialog' }, isConnected: true } });
    const me = roll('a'), other = roll('b'), gone = { id: 'c', element: { classList: { contains: () => true }, isConnected: false } };
    const plain = { id: 'd', element: { classList: { contains: () => false }, isConnected: true } };
    assert.deepEqual(otherRollWindows(me, [me, other, gone, plain, null], null).map((a) => a.id), ['b']);
    // Review: a Defend or Resist window is never closed, and a new one closes nothing.
    const answerEl = { classList: { contains: (c: string) => c === 'sr2e-roll-dialog' }, isConnected: true, querySelector: (q: string) => (q === '.sr2e-resist-preview' ? {} : null) };
    const defend = { id: 'e', element: answerEl };
    assert.deepEqual(otherRollWindows(me, [me, other, defend], null).map((a) => a.id), ['b']);
    assert.deepEqual(otherRollWindows(defend, [me, other, defend], answerEl), []);
  });
  test('a client setting, on by default, in the Rolls section', () => {
    const s = read('src/module/applications/interface.ts');
    assert.match(s, /s\.register\(ID, 'oneRollWindow', \{[\s\S]*?scope: 'client', config: true, type: Boolean, default: true/);
    assert.match(s, /if \(setting\('oneRollWindow', true\)\) closeOtherRollWindows\(app, root\);/);
    assert.match(read('src/module/rules/interface.ts'), /oneRollWindow/);
  });
});

describe('v0.93.4 Play / Edit', () => {
  const src = read('src/module/applications/sheettools.ts');
  test('a two-part Edit | Play switch, the current mode pressed, inside the stuck strip', async () => {
    const { modeSwitchHtml } = await import('../applications/sheettools.ts');
    const h = modeSwitchHtml('play');
    assert.match(h, /data-mode="edit" aria-pressed="false"/);
    assert.match(h, /class="sr2e-mode-btn active" data-action="sheetMode" data-mode="play" aria-pressed="true"/);
    assert.match(src, /if \(stuck\) stuck\.appendChild\(bar\)/);
  });
  test('a finished character opens in Play; an item follows its actor; a choice is kept', async () => {
    const { defaultSheetMode, sheetMode, setSheetMode } = await import('../applications/sheettools.ts');
    const store = new Map<string, string>();
    (globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    try {
      const fresh: any = { uuid: 'Actor.a', type: 'character', documentName: 'Actor', flags: {}, getFlag: () => undefined };
      assert.equal(defaultSheetMode(fresh), 'edit');
      const npc: any = { uuid: 'Actor.n', type: 'npc', documentName: 'Actor', flags: {}, getFlag: () => undefined };
      assert.equal(sheetMode(npc), 'edit');
      setSheetMode(fresh, 'play');
      assert.equal(sheetMode(fresh), 'play');
      const item: any = { uuid: 'Actor.a.Item.i', documentName: 'Item', parent: fresh };
      assert.equal(sheetMode(item), 'play');
      setSheetMode(item, 'edit');
      assert.equal(sheetMode(item), 'edit');
      assert.equal(sheetMode(fresh), 'play');
      const world: any = { uuid: 'Item.w', documentName: 'Item', parent: null };
      assert.equal(sheetMode(world), 'edit');
    } finally { delete (globalThis as any).localStorage; }
  });
  test('locked fields say why; the item sheet gets the switch and keeps its play fields', () => {
    assert.match(src, /const why = tx\('SR2E\.App\.Sheettools\.lockedInPlay'\);\n    d\['tooltip'\] = why;\n    d\['tooltipText'\] = why;/);
    // Review: Edit puts back what the template gave the field (disabled or read-only), its title and tooltips.
    assert.match(src, /d\['sr2eWasOff'\] = box \?/);
    assert.match(src, /el\.setAttribute\('title', d\['sr2eTitleWas'\]\)/);
    for (const f of ['system.turret.facing', 'system.exposed', 'system.erased', 'system.damage.mpcp']) assert.ok(src.includes(`'${f}'`), f);
    assert.doesNotMatch(src, /sw\.outerHTML/);
    for (const f of ['system.carried', 'system.ready', 'system.ammo', 'system.quantity', 'system.notes', 'system.loaded']) assert.ok(src.includes(`'${f}'`), f);
    const sheets = read('src/module/applications/sheets.ts');
    assert.match(sheets, /sheetMode: SHEET_TOOL_ACTIONS\.sheetMode/);
    assert.match(sheets, /decorateItemSheet\(this\)/);
    assert.match(read('src/module/applications/adding.ts'), /const want = t\?\.dataset\?\.\['mode'\]/);
  });
  test('the list tools run on every sheet render', () => {
    assert.match(src, /decorateLists\(body, sheet\)/);
    assert.match(src, /LIST_FILTER_MIN/);
  });
});

describe('v0.93.4 review fixes', () => {
  test('the monitor boxes set Foundry\'s tooltip before it reads it, never a title', () => {
    const s = read('src/module/applications/interface.ts');
    assert.match(s, /box\.dataset\['tooltipText'\] = tip;/);
    assert.match(s, /box\.addEventListener\('pointerover', show\);/);
    assert.doesNotMatch(s, /box\.title = /);
  });
  test('the tracker hides only our own wound icon, and shows the modifier only to owners', () => {
    const css = read('public/style/sr2e.css');
    assert.ok(css.includes('img.sr2e-wound-dot { display: none; }'));
    assert.ok(!css.includes('img[src*="/wound-"] { display: none; }'));
    const t = read('src/module/applications/tokens.ts');
    assert.match(t, /actor\?\.isOwner \? actor\?\.system\?\.derived\?\.woundModifier : undefined/);
  });
});

describe('v0.93.4 wording', () => {
  const lang = JSON.parse(read('public/lang/en.json'));
  const get = (k: string) => k.split('.').reduce((o: any, p) => o?.[p], lang);
  test('no code notation in the drain line; the prompt says what to roll and where the button stays', () => {
    assert.doesNotMatch(String(get('SR2E.Dialog.Sheet.drainWillpowerVsFloorForce2')), /floor\(/);
    assert.match(String(get('SR2E.Dialog.Chat.promptTitle')), /\{name\}: \{verb\}\?/);
    assert.match(String(get('SR2E.Dialog.Chat.now')), /chat card/);
    assert.match(read('src/module/applications/chat.ts'), /tx\('SR2E\.Dialog\.Chat\.promptTitle', \{ name: target\.name, verb \}\)/);
  });
});
