/**
 * v0.93.0: safety and the owner's decisions. The guard against another system's world (helpers/foreign.ts), the backup
 * prompt and the update report (migrations.ts), SR2e's look only on its own cards and the banner on top (look.ts, sr2e.css),
 * right-click to lower (applications/lower.ts) and "how many?" when a stack moves (drops.ts).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(join(here, '..', '..', '..', ...p), 'utf8');
const SRC = (p: string) => read('src', 'module', p);

// ---------------------------------------------------------------- a small DOM with the selectors lower.ts uses

type Attrs = Record<string, string>;
class Node0 {
  tagName: string; parentElement: Node0 | null = null; children: Node0[] = []; attrs: Attrs = {}; clicks = 0;
  value = ''; type = ''; step = ''; min = ''; readOnly = false; disabled = false; events: string[] = [];
  constructor(tag: string, attrs: Attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    if (attrs['type']) this.type = attrs['type'];
    if (attrs['value'] !== undefined) this.value = attrs['value'];
    if (attrs['min'] !== undefined) this.min = attrs['min'];
  }
  add(...kids: Node0[]): this { for (const k of kids) { k.parentElement = this; this.children.push(k); } return this; }
  get dataset(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.attrs)) if (k.startsWith('data-')) out[k.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] = v;
    return out;
  }
  get classList() { const cls = (this.attrs['class'] ?? '').split(/\s+/).filter(Boolean); return { contains: (c: string) => cls.includes(c) }; }
  matches(sel: string): boolean { return sel.split(',').some((one) => matchOne(this, one.trim())); }
  closest(sel: string): Node0 | null { let n: Node0 | null = this; while (n) { if (n.matches(sel)) return n; n = n.parentElement; } return null; }
  all(): Node0[] { return this.children.flatMap((c) => [c, ...c.all()]); }
  querySelectorAll(sel: string): Node0[] { return this.all().filter((e) => e.matches(sel)); }
  querySelector(sel: string): Node0 | null { return this.querySelectorAll(sel)[0] ?? null; }
  click(): void { this.clicks++; }
  dispatchEvent(e: { type: string }): boolean { this.events.push(e.type); return true; }
}
function matchOne(n: Node0, sel: string): boolean {
  const m = /^([a-z]*)((?:\.[\w-]+|\[[^\]]+\])*)$/i.exec(sel);
  if (!m) throw new Error(`stub selector: ${sel}`);
  if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
  for (const part of (m[2] ?? '').match(/\.[\w-]+|\[[^\]]+\]/g) ?? []) {
    if (part.startsWith('.')) { if (!n.classList.contains(part.slice(1))) return false; continue; }
    const am = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(part)!;
    const have = am[1] === 'type' ? (n.type || n.attrs['type']) : n.attrs[am[1]!];
    if (have === undefined) return false;
    if (am[2] !== undefined && have !== am[2]) return false;
  }
  return true;
}
(globalThis as any).Event = class { type: string; constructor(t: string) { this.type = t; } };
const el = (tag: string, attrs: Attrs = {}, ...kids: Node0[]) => new Node0(tag, attrs).add(...kids);

// ---------------------------------------------------------------- 1. another system's world

describe('v0.93.0: the guard against another system\'s world', () => {
  test('futurekill\'s marker setting and its own types are found; an SR2e world shows nothing', async () => {
    const { foreignWorldSigns, FOREIGN_WORLD } = await import('../helpers/foreign.ts');
    assert.deepEqual(foreignWorldSigns({ settings: [{ key: 'sr2e.migrationVersion', value: '"0.92.5"' }], actors: [{ type: 'character', items: [{ type: 'skill' }] }], items: [{ type: 'gear' }] }), []);
    assert.deepEqual(foreignWorldSigns(null), []);
    assert.deepEqual(foreignWorldSigns({ settings: [{ key: FOREIGN_WORLD.setting, value: '"0.164"' }] }), ['sr2e.systemMigrationVersion']);
    const signs = foreignWorldSigns({ actors: [{ type: 'frame' }, { type: 'character', items: [{ type: 'quality' }, { type: 'quality' }, { type: 'bioware' }] }], items: [{ type: 'lifestyle' }] });
    assert.deepEqual(signs.sort(), ['Actor frame (1)', 'Item bioware (1)', 'Item lifestyle (1)', 'Item quality (2)']);
    assert.deepEqual(foreignWorldSigns({ scenes: [{ tokens: [{ delta: { items: [{ type: 'contact' }] } }, { delta: null }] }] }), ['Item contact (1)'], 'an unlinked token\'s own items');
    // SR2e's own types never count (adeptpower is ours; adept_power is theirs).
    assert.deepEqual(foreignWorldSigns({ items: [{ type: 'adeptpower' }, { type: 'cyberdeck' }, { type: 'power' }] }), []);
  });

  test('isForeignWorld reads game.data once; the GM\'s override lets it through', async () => {
    const f = await import('../helpers/foreign.ts');
    const g: any = globalThis as any;
    const old = g.game;
    try {
      let ignore = false;
      g.game = { data: { settings: [{ key: 'sr2e.systemMigrationVersion' }] }, settings: { get: (_ns: string, key: string) => (key === 'ignoreForeignWorld' ? ignore : undefined) } };
      f.resetForeignWorldCache();
      assert.equal(f.isForeignWorld(), true);
      ignore = true;
      assert.equal(f.isForeignWorld(), true, 'cached for the session');
      f.resetForeignWorldCache();
      assert.equal(f.isForeignWorld(), false);
      g.game = { data: {}, settings: { get: () => { throw new Error('not registered'); } } };
      f.resetForeignWorldCache();
      assert.equal(f.isForeignWorld(), false);
    } finally { g.game = old; f.resetForeignWorldCache(); }
  });

  test('the migrations, the session Karma refresh and the timer sweep check it before writing', () => {
    const mig = SRC('migrations.ts');
    const at = mig.indexOf('const signs = foreignWorldSigns(data);');
    assert.ok(at > 0 && at < mig.indexOf('const todo = MIGRATIONS.filter'), 'the guard comes before any step');
    assert.match(mig, /if \(signs\.length && !ignoringForeignWorld\(\)\) \{[\s\S]{0,600}?return;\n  \}/);
    assert.match(mig, /"ignoreForeignWorld", \{ scope: "world", config: false, type: Boolean, default: false \}/);
    assert.match(SRC('applications/chat.ts'), /if \(isForeignWorld\(\) \|\| !sessionRefreshDue\(last, today\)\) return;/);
    assert.match(SRC('applications/canvas.ts'), /Hooks\.once\('ready', \(\) => \{ if \(isForeignWorld\(\)\) return;/);
    // Review 2: the module look and the refused-house-rules report write settings too; the guard writes no chat message.
    assert.match(SRC('applications/modules.ts'), /Hooks\.once\('ready', \(\) => \{ if \(!isForeignWorld\(\)\) void matchModuleLook\(\); \}\);/);
    assert.match(SRC('settings.ts'), /if \(!isLeadGm\(\)\) return false;\n    \/\/ v0\.93\.0 \(review 2\)[^\n]*\n    if \(isForeignWorld\(\)\) return false;/);
    const guard = mig.slice(at, mig.indexOf('const stored = String(game.settings.get'));
    assert.doesNotMatch(guard, /ChatMessage/);
  });

  test('the GM\'s card escapes the signs and names the override for this system\'s id', async () => {
    const { foreignWorldHtml } = await import('../migrations.ts');
    const html = foreignWorldHtml(['Item <b>x</b> (1)']);
    assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;') && !html.includes('<b>x</b>'));
    assert.match(html, /game\.settings\.set\(&#0?39;sr2e&#0?39;, &#0?39;ignoreForeignWorld&#0?39;, true\)|game\.settings\.set\(&#x27;sr2e&#x27;/);
  });
});

// ---------------------------------------------------------------- 5. back up first

describe('v0.93.0: back up before a world update, and a report after', () => {
  test('the prompt comes only when a step changes data and the world has documents', async () => {
    const { needsBackupPrompt } = await import('../migrations.ts');
    assert.equal(needsBackupPrompt([{ changes: true }], { actors: [{}] }), true);
    assert.equal(needsBackupPrompt([{ changes: true }], { items: [{}] }), true);
    assert.equal(needsBackupPrompt([{ changes: true }], { actors: [], items: [] }), false, 'a new, empty world');
    assert.equal(needsBackupPrompt([{}, { changes: false }], { actors: [{}] }), false, 'notices only');
    assert.equal(needsBackupPrompt([], { actors: [{}] }), false);
  });

  test('the steps that change data say so; "Not now" stores nothing', () => {
    const mig = SRC('migrations.ts');
    for (const v of ['0.27.0', '0.40.0', '0.59.0', '0.77.0', '0.81.1']) assert.match(mig, new RegExp(`version: "${v.replace(/\./g, '\\.')}", label: "[^"]+", changes: true, run:`), v);
    for (const v of ['0.22.0', '0.92.3']) assert.doesNotMatch(mig, new RegExp(`version: "${v.replace(/\./g, '\\.')}", label: "[^"]+", changes: true`), v);
    assert.match(mig, /if \(needsBackupPrompt\(todo, data\) && !\(await askBackup\(todo\)\)\) return;/);
    assert.ok(mig.indexOf('askBackup(todo)))') < mig.indexOf('for (const m of todo)'));
  });

  test('the report lists what ran and the step that failed, escaped', async () => {
    const { migrationReport } = await import('../migrations.ts');
    assert.equal(migrationReport([], null), '');
    const ok = migrationReport([{ version: '0.59.0', label: 'A & B' }], null);
    assert.ok(ok.includes('0.59.0: A &amp; B') && !ok.includes('sr2e-warn'));
    const bad = migrationReport([], { version: '0.77.0', label: '<x>' });
    assert.ok(bad.includes('sr2e-warn') && bad.includes('&lt;x&gt;') && !bad.includes('<x>'));
  });
});

// ---------------------------------------------------------------- 2-3. chat look

describe('v0.93.0: the look only on SR2e\'s own cards, and the banner on top', () => {
  test('other messages get no shell; the banner is not moved', () => {
    const look = SRC('applications/look.ts');
    assert.match(look, /if \(!isOurCard\(message, html\)\) return;/);
    assert.doesNotMatch(look, /roll\.after\(banner\)/);
  });

  test('a message that isn\'t ours keeps its classes', async () => {
    const { decorateLookCard } = await import('../applications/look.ts');
    const classes: string[] = [];
    const html: any = { classList: { add: (...c: string[]) => classes.push(...c) }, querySelector: () => null, querySelectorAll: () => [] };
    decorateLookCard({ content: 'typed chat', style: 1, flags: {} }, html);
    assert.deepEqual(classes, []);
  });

  test('the two dialog layout rules reach only SR2e\'s dialogs', () => {
    const css = read('public', 'style', 'sr2e.css');
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /\.application\.dialog(?!\.sr2e-dialog)[\s>.]/);
    assert.ok(css.includes('.application.dialog.sr2e-dialog > .window-content { max-height'));
    assert.ok(css.includes('.application.dialog.sr2e-dialog .form-group > label { flex: 1 0 100%; }'));
  });
});

// ---------------------------------------------------------------- 4. right-click to lower

describe('v0.93.0: right-click lowers a value by one', () => {
  const track = () => {
    const boxes = [1, 2, 3, 4].map((v) => el('a', { class: `sr2e-box${v <= 3 ? ' filled' : ''}`, 'data-action': 'setMonitor', 'data-track': 'physical', 'data-value': String(v) }));
    const stun = [1, 2].map((v) => el('a', { class: 'sr2e-box filled', 'data-action': 'setMonitor', 'data-track': 'stun', 'data-value': String(v) }));
    const root = el('div', { class: 'sr2e-cm' }, el('div', { class: 'sr2e-cm-track' }, ...boxes), el('div', { class: 'sr2e-cm-track' }, ...stun));
    return { root, boxes, stun };
  };

  test('a box: the last filled one in its own track is clicked (it clears to one less)', async () => {
    const { lowerStep } = await import('../applications/lower.ts');
    const { boxes, stun } = track();
    for (const b of boxes) assert.equal((lowerStep(b as any) as any)?.el, boxes[2], 'any box of the track');
    assert.equal((lowerStep(stun[0] as any) as any)?.el, stun[1], 'Stun is its own track');
    const empty = [1, 2].map((v) => el('a', { class: 'sr2e-box', 'data-action': 'setCondition', 'data-value': String(v) }));
    el('div', { class: 'sr2e-track' }, ...empty);
    assert.equal(lowerStep(empty[0] as any), null, 'nothing filled, nothing to lower');
  });

  test('review 1: with damage in Overflow, a main-row box finds the last filled Overflow box (one less, not two)', async () => {
    const { lowerStep } = await import('../applications/lower.ts');
    const main = Array.from({ length: 10 }, (_, i) => el('a', { class: 'sr2e-box filled', 'data-action': 'setMonitor', 'data-track': 'physical', 'data-value': String(i + 1) }));
    const over = [11, 12, 13].map((v) => el('a', { class: `sr2e-box${v <= 12 ? ' filled' : ''}`, 'data-action': 'setMonitor', 'data-track': 'physical', 'data-value': String(v) }));
    const stun = [1].map((v) => el('a', { class: 'sr2e-box filled', 'data-action': 'setMonitor', 'data-track': 'stun', 'data-value': String(v) }));
    el('div', { class: 'sr2e-cm' }, el('div', { class: 'sr2e-cm-track' }, ...main), el('div', { class: 'sr2e-cm-track' }, ...stun), el('div', { class: 'sr2e-cm-track' }, ...over));
    assert.equal((lowerStep(main[3] as any) as any)?.el, over[1]);
    assert.equal((lowerStep(over[2] as any) as any)?.el, over[1]);
    assert.equal((lowerStep(stun[0] as any) as any)?.el, stun[0]);
  });

  test('a pool pip: the last filled pip of that pool', async () => {
    const { lowerStep } = await import('../applications/lower.ts');
    const pips = [1, 2, 3].map((v) => el('a', { class: `sr2e-pip${v <= 2 ? ' filled' : ''}`, 'data-action': 'setPool', 'data-pool': 'combat', 'data-value': String(v) }));
    el('span', { class: 'sr2e-strip-pool' }, ...pips);
    assert.equal((lowerStep(pips[2] as any) as any)?.el, pips[1]);
  });

  test('a − / + pair: the − is clicked, from either button', async () => {
    const { lowerStep } = await import('../applications/lower.ts');
    const down = el('a', { 'data-action': 'stepMonitor', 'data-track': 'stun', 'data-delta': '-1' });
    const up = el('a', { 'data-action': 'stepMonitor', 'data-track': 'stun', 'data-delta': '1' });
    const otherDown = el('a', { 'data-action': 'stepMonitor', 'data-track': 'physical', 'data-delta': '-1' });
    el('span', {}, otherDown, down, up);
    assert.equal((lowerStep(up as any) as any)?.el, down, 'the same track\'s −');
    assert.equal((lowerStep(down as any) as any)?.el, down);
    const gmDown = el('a', { 'data-action': 'box', 'data-uuid': 'Actor.b', 'data-track': 'physical', 'data-delta': '-1' });
    const gmUp = el('a', { 'data-action': 'box', 'data-uuid': 'Actor.b', 'data-track': 'physical', 'data-delta': '1' });
    el('span', {}, el('a', { 'data-action': 'box', 'data-uuid': 'Actor.a', 'data-track': 'physical', 'data-delta': '-1' }), gmDown, gmUp);
    assert.equal((lowerStep(gmUp as any) as any)?.el, gmDown, 'the same actor\'s −');
  });

  test('number fields: in a stepper (its − button) or a listed play field; weapon rounds', async () => {
    const { lowerStep, doLower } = await import('../applications/lower.ts');
    const input = el('input', { type: 'number', value: '3', min: '0', class: 'sr2e-rowedit' });
    const downBtn = el('button', { class: 'sr2e-step sr2e-step-down' });
    el('span', { class: 'sr2e-stepper' }, downBtn, input, el('button', { class: 'sr2e-step sr2e-step-up' }));
    const s = lowerStep(input as any) as any;
    assert.equal(s?.kind, 'input');
    assert.equal(await doLower(s, null), true);
    assert.equal(downBtn.clicks, 1, 'the stepper\'s − does it (its own undo and limits)');
    const bare = el('input', { type: 'number', value: '1', min: '0', class: 'sr2e-rowedit' });
    el('div', {}, bare);
    assert.equal(lowerStep(bare as any), null, 'not a listed field');
    const b2 = lowerStep(bare as any, 'input[type="number"].sr2e-rowedit') as any;
    assert.equal(b2?.kind, 'input');
    await doLower(b2, null);
    assert.equal(bare.value, '0');
    assert.deepEqual(bare.events, ['input', 'change']);
    await doLower(b2, null);
    assert.equal(bare.value, '0', 'never under its min');
    const ammo = el('b', { 'data-sr2e-lower': 'ammo', 'data-item-id': 'w1' });
    assert.deepEqual(lowerStep(ammo as any), { kind: 'ammo', itemId: 'w1' });
    let wrote: any = null;
    const actor = { isOwner: true, items: { get: (id: string) => (id === 'w1' ? { isOwner: true, system: { ammo: 5, ammoMax: 10 }, update: async (u: any) => { wrote = u; } } : null) } };
    await doLower({ kind: 'ammo', itemId: 'w1' }, actor);
    assert.deepEqual(wrote, { 'system.ammo': 4 });
    wrote = null;
    await doLower({ kind: 'ammo', itemId: 'w1' }, { items: { get: () => ({ isOwner: false, system: { ammo: 5, ammoMax: 10 }, update: async (u: any) => { wrote = u; } }) } });
    assert.equal(wrote, null, 'only the weapon\'s owner');
  });

  test('stepDown and ammoDown', async () => {
    const { stepDown, ammoDown } = await import('../applications/lower.ts');
    assert.equal(stepDown('5', {}), '4');
    assert.equal(stepDown('0.5', { step: '0.25' }), '0.25');
    assert.equal(stepDown('1', { min: '1' }), null);
    assert.equal(stepDown('', {}), '-1');
    assert.equal(stepDown('x', {}), null);
    assert.equal(ammoDown({ ammo: 3, ammoMax: 10 }), 2);
    assert.equal(ammoDown({ ammo: 0, ammoMax: 10 }), null);
    assert.equal(ammoDown({ ammo: 3, ammoMax: 0 }), null, 'untracked');
  });

  test('wired on the sheets, the roll dialogs and the GM panel; the templates mark the rounds', () => {
    const iface = SRC('applications/interface.ts');
    assert.match(iface, /bindLower\(body, actor, SHEET_STEP_FIELDS\);/);
    assert.match(iface, /bindLower\(content, null, 'input\[type="number"\]'\);/);
    assert.match(SRC('applications/ui.ts'), /bindLower\(root\);/);
    assert.match(read('public', 'templates', 'status-strip.hbs'), /data-sr2e-lower="ammo" data-item-id="\{\{strip\.weapon\.id\}\}"/);
    assert.match(read('public', 'templates', 'combat-column.hbs'), /data-sr2e-lower="ammo" data-item-id="\{\{id\}\}"/);
    assert.match(SRC('applications/lower.ts'), /if \(ev\.shiftKey\) return;/, 'Shift keeps the browser menu');
  });
});

// ---------------------------------------------------------------- 17. how many?

describe('v0.93.0: "how many?" when a stack moves', () => {
  test('stack size, answers and matching stacks', async () => {
    const { stackSize, howManyAnswer, sameStack } = await import('../applications/drops.ts');
    assert.equal(stackSize({ quantity: 6 }), 6);
    assert.equal(stackSize({}), 1);
    assert.equal(stackSize({ quantity: 'x' }), 1);
    assert.equal(howManyAnswer('3', 6), 3);
    assert.equal(howManyAnswer('7', 6), null);
    assert.equal(howManyAnswer('0', 6), null);
    assert.equal(howManyAnswer('2.9', 6), 2);
    assert.equal(howManyAnswer('', 6), null);
    assert.equal(sameStack({ type: 'gear', name: 'Medkit', system: { quantity: 2, rating: 3 } }, { type: 'gear', name: 'Medkit', system: { rating: 3, quantity: 5 } }), true);
    assert.equal(sameStack({ type: 'gear', name: 'Medkit', system: { quantity: 2, rating: 3 } }, { type: 'gear', name: 'Medkit', system: { quantity: 2, rating: 4 } }), false);
    assert.equal(sameStack({ type: 'gear', name: 'Medkit', system: {} }, { type: 'weapon', name: 'Medkit', system: {} }), false);
    assert.equal(sameStack(null, { type: 'gear' }), false);
  });

  test('the drop asks only for a moved stack, moves part of it and merges', () => {
    const d = SRC('applications/drops.ts');
    assert.match(d, /if \(moves && have > 1\) \{\n    const n = await askHowMany\(item\.name, have\);\n    if \(n === null\) return null;/);
    assert.match(d, /if \(take < have\) await item\.update\(\{ 'system\.quantity': have - take \}\); else await source\.deleteEmbeddedDocuments/);
    assert.match(d, /stack\.update\(\{ 'system\.quantity': before \+ take \}\)/);
    // Review 3: the stack is read again after the dialog, and never more than it holds moves.
    assert.match(d, /const now: any = source\.items\?\.get\?\.\(item\.id\);\n    if \(!now\)[^\n]*return null; \}\n    have = stackSize\(now\.system\);\n    take = Math\.min\(n, have\);/);
    // Review 4: a failed change on the giver undoes the receiver's side.
    assert.match(d, /if \(stack\) await stack\.update\(\{ 'system\.quantity': before \}\); else await made\.delete\(\);/);
    // Review 5: the receiver's stack is compared on its stored data.
    assert.match(d, /system: i\._source\?\.system \?\? i\.system/);
  });
});

// ---------------------------------------------------------------- texts

test('v0.93.0: every new text is in lang/en.json', () => {
  const en = JSON.parse(read('public', 'lang', 'en.json'));
  const get = (k: string) => k.split('.').reduce((o: any, p) => o?.[p], en);
  for (const k of ['SR2E.Card.Migrations.foreignTitle', 'SR2E.Card.Migrations.foreignBody', 'SR2E.Card.Migrations.foreignOverride', 'SR2E.Card.Migrations.ranSteps', 'SR2E.Card.Migrations.failedStep', 'SR2E.Card.Migrations.reportTitle',
    'SR2E.Notify.Migrations.foreignWorld', 'SR2E.Dialog.Migrations.backupTitle', 'SR2E.Dialog.Migrations.backupBody', 'SR2E.Dialog.Migrations.backupContinue', 'SR2E.Dialog.Migrations.backupLater',
    'SR2E.Dialog.Drops.howManyTitle', 'SR2E.Dialog.Drops.howManyLabel', 'SR2E.Dialog.Drops.howManyMove', 'SR2E.Dialog.Drops.howManyCancel', 'SR2E.Notify.Drops.howManyBad', 'SR2E.UI.roundsLeftRightClick']) assert.equal(typeof get(k), 'string', k);
});
