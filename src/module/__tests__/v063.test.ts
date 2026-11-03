/**
 * v0.63.0: adding things and sheet tidy-ups. Glue checks with small stubs (the window itself and the
 * sheet decoration are checked in the live run), plus template and stylesheet checks.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { join } from 'node:path';
import { readEnglish } from './helpers/english.ts';

const g = globalThis as any;
let tools: typeof import('../applications/sheettools.ts');
// v0.89.0: templates are read back in English (their text is in lang/en.json).
const read = (...p: string[]) => readEnglish(join(process.cwd(), ...p));

function actorWith(items: any[], extra: any = {}): any {
  const upd = async function (this: any, d: any) { for (const [k, v] of Object.entries(d)) { const parts = k.split('.'); let o = this; for (const p of parts.slice(0, -1)) o = o[p]; o[parts[parts.length - 1]!] = v; } };
  const list: any[] = items.map((i, n) => ({ id: `i${n}`, flags: {}, ...i, update: upd }));
  const actor: any = {
    type: 'character', name: 'ZZ', uuid: 'Actor.zz', flags: {}, isOwner: true,
    system: { attributes: { body: { base: 3 }, quickness: { base: 4 } }, derived: { essence: 6, magic: 0 }, ...extra },
    items: Object.assign(list, { get: (id: string) => list.find((x) => x.id === id) }),
    getFlag(s: string, k: string) { return this.flags[s]?.[k]; },
    async createEmbeddedDocuments(_t: string, docs: any[]) { const out = docs.map((d) => ({ id: `n${list.length}-${Math.random()}`, ...d, update: upd })); list.push(...out); return out; },
  };
  return actor;
}

before(async () => {
  g.foundry = { utils: { deepClone: (o: any) => JSON.parse(JSON.stringify(o)) } };
  g.game = { i18n: { localize: (k: string) => (k.startsWith('SR2E.Attribute.') ? k.split('.').pop() : k) } }; // v0.89.6: other keys fall back to the English preload
  tools = await import('../applications/sheettools.ts');
});

describe('v0.63.0 creating a basket', () => {
  test('copies, values, gear stacking and arrival states', async () => {
    const a = actorWith([{ type: 'gear', name: 'Medkit', system: { quantity: 1 } }]);
    const res = await tools.createFromBasket(a, [
      { type: 'weapon', name: 'Knife', system: {}, amount: 2, data: { name: 'Knife', type: 'weapon', system: { cost: 30 } } },
      { type: 'gear', name: 'Medkit', system: {}, amount: 2, data: { name: 'Medkit', type: 'gear', system: { quantity: 1 } } },
      { type: 'spell', name: 'Bolt', system: {}, amount: 5, data: { name: 'Bolt', type: 'spell', system: { learnedForce: 3 } } },
      { type: 'cyberware', name: 'Datajack', system: {}, amount: 1, data: { name: 'Datajack', type: 'cyberware', system: { installed: true } } },
    ], { ready: false });
    assert.deepEqual(res.made, ['Knife ×2', 'Medkit (now ×3)', 'Bolt', 'Datajack']);
    assert.equal(res.done.length, 4);
    assert.deepEqual(res.failed, []);
    const items = [...a.items];
    assert.equal(items.filter((i: any) => i.name === 'Knife').length, 2);
    assert.equal(items.find((i: any) => i.name === 'Medkit').system.quantity, 3, 'gear stacks on the one already there');
    assert.equal(items.find((i: any) => i.name === 'Bolt').system.learnedForce, 5);
    assert.equal(items.find((i: any) => i.name === 'Datajack').system.installed, false, 'not ready: needs surgery, as a drop');
    const k = items.filter((i: any) => i.name === 'Knife');
    assert.notEqual(k[0].system, k[1].system, 'each copy has its own data');
  });
  test('ready to use installs, bonds, wears and loads', async () => {
    const a = actorWith([]);
    await tools.createFromBasket(a, [
      { type: 'cyberware', name: 'Datajack', system: {}, amount: 1, data: { name: 'Datajack', type: 'cyberware', system: {} } },
      { type: 'focus', name: 'Power focus', system: {}, amount: 2, data: { name: 'Power focus', type: 'focus', system: {} } },
      { type: 'armor', name: 'Vest', system: {}, amount: 1, data: { name: 'Vest', type: 'armor', system: { worn: false } } },
    ], { ready: true });
    const items = [...a.items];
    assert.equal(items.find((i: any) => i.name === 'Datajack').system.installed, true);
    assert.equal(items.find((i: any) => i.name === 'Power focus').system.bonded, true);
    assert.equal(items.find((i: any) => i.name === 'Power focus').system.rating, 2, 'a focus number is its rating');
    assert.equal(items.find((i: any) => i.name === 'Vest').system.worn, true);
    assert.equal(tools.readyNote('weapon'), '');
    assert.equal(tools.readyNote('cyberware'), 'installed');
  });
});

describe('v0.63.0 stacking, failures and rollback', () => {
  test('gear stacks only on the same thing, also within one basket', async () => {
    const a = actorWith([{ type: 'gear', name: 'Medkit', system: { quantity: 1, medkitRating: 3 } }]);
    const res = await tools.createFromBasket(a, [
      { type: 'gear', name: 'Medkit', system: {}, amount: 1, data: { name: 'Medkit', type: 'gear', system: { quantity: 1, medkitRating: 6 } } },
      { type: 'gear', name: 'Medkit', system: {}, amount: 2, data: { name: 'Medkit', type: 'gear', system: { quantity: 1, medkitRating: 6 } } },
      { type: 'gear', name: 'Medkit', system: {}, amount: 1, data: { name: 'Medkit', type: 'gear', system: { quantity: 1, medkitRating: 3 } } },
    ], { ready: false });
    const kits = [...a.items].filter((i: any) => i.name === 'Medkit');
    assert.equal(kits.length, 2, 'a rating 6 medkit is a new row');
    assert.equal(kits.find((k: any) => k.system.medkitRating === 6).system.quantity, 3, 'the second rating 6 line stacks on the first');
    assert.equal(kits.find((k: any) => k.system.medkitRating === 3).system.quantity, 2);
    assert.equal(res.made.length, 3);
  });
  test('a refused create is reported, not counted; rollback takes everything back', async () => {
    const a = actorWith([{ type: 'gear', name: 'Rope', system: { quantity: 2 } }]);
    const deleted: string[] = [];
    const create = a.createEmbeddedDocuments.bind(a);
    a.createEmbeddedDocuments = async (t: string, docs: any[]) => (docs[0]?.name === 'Bad' ? [] : create(t, docs).then(() => docs.map((_d: any, n: number) => ({ id: `made${n}-${docs[0].name}` }))));
    a.deleteEmbeddedDocuments = async (_t: string, ids: string[]) => { deleted.push(...ids); };
    a.items.get = (id: string) => (id.startsWith('made') ? { id } : [...a.items].find((x: any) => x.id === id));
    const res = await tools.createFromBasket(a, [
      { type: 'weapon', name: 'Bad', system: {}, amount: 1, data: { name: 'Bad', type: 'weapon', system: {} } },
      { type: 'weapon', name: 'Knife', system: {}, amount: 2, data: { name: 'Knife', type: 'weapon', system: {} } },
      { type: 'gear', name: 'Rope', system: {}, amount: 3, data: { name: 'Rope', type: 'gear', system: { quantity: 1 } } },
    ], { ready: false });
    assert.deepEqual(res.failed, ['Bad']);
    assert.deepEqual(res.done.map((l) => l.name), ['Knife', 'Rope']);
    const rope = [...a.items].find((i: any) => i.name === 'Rope');
    assert.equal(rope.system.quantity, 5);
    await res.rollback();
    assert.deepEqual(deleted, ['made0-Knife', 'made1-Knife']);
    assert.equal(rope.system.quantity, 2, 'the stack goes back');
  });
});

describe('v0.63.0 the tools context', () => {
  test('pins keep only existing, pinnable items, with their actions', () => {
    const a = actorWith([{ type: 'weapon', name: 'Pistol', system: {} }, { type: 'armor', name: 'Vest', system: { ballistic: 2, impact: 1 } }, { type: 'skill', name: 'Firearms', system: {} }]);
    a.flags = { sr2e: { pins: ['i0', 'i1', 'gone', 'i2'] } };
    const c = tools.sheetToolsContext(a);
    assert.deepEqual(c.pins.map((p: any) => [p.name, p.action]), [['Pistol', 'attackWeapon'], ['Firearms', 'rollSkill']]);
    assert.deepEqual(c.pinSet, { i0: true, i2: true });
    assert.equal(c.mode, 'edit', 'edit by default (no storage in the tests)');
  });
  test('setup warnings counted, build rows included', () => {
    const a = actorWith([{ type: 'cyberware', name: 'Datajack', system: { installed: false, essenceCost: 0.2 } }], { attributes: { body: { base: 0 } } });
    const c = tools.sheetToolsContext(a, { build: [{ label: 'Skills', used: 50, allowed: 40, ok: false }] });
    assert.ok(c.warnCount >= 2, 'Body 0 and the build');
    assert.ok(c.noteCount >= 2, 'no skills and the datajack');
    assert.ok(c.warnings.some((w: any) => /Build: Skills 50/.test(w.text)));
  });
  test('no warnings for spirits', () => {
    const a = actorWith([]);
    a.type = 'spirit';
    assert.equal(tools.sheetToolsContext(a).warnings.length, 0);
  });
});

describe('v0.63.0 templates and styles', () => {
  test('every list heading on the sheets has an add button', () => {
    const ch = read('public/templates/actor-character-sheet.hbs');
    for (const t of ['weapon', 'armor', 'focus', 'adeptpower', 'spell', 'power', 'cyberware', 'gear']) assert.match(ch, new RegExp(`data-action="addItem" data-type="${t}"`), `character: ${t}`);
    assert.match(ch, /data-action="addSkill" data-kind="\{\{kind\}\}"/);
    const npc = read('public/templates/actor-npc-sheet.hbs');
    for (const t of ['weapon', 'spell', 'power', 'gear']) assert.match(npc, new RegExp(`data-action="addItem" data-type="${t}"`), `npc: ${t}`);
    assert.match(npc, /data-action="addSkill"/);
    const sp = read('public/templates/actor-spirit-sheet.hbs');
    for (const t of ['weapon', 'power']) assert.match(sp, new RegExp(`data-action="addItem" data-type="${t}"`), `spirit: ${t}`);
    assert.match(sp, /data-action="addSkill"/);
    const v = read('public/templates/actor-vehicle-sheet.hbs');
    for (const t of ['weapon', 'gear']) assert.match(v, new RegExp(`data-action="addItem" data-type="${t}"`), `vehicle: ${t}`);
    const m = read('public/templates/matrix-section.hbs');
    for (const t of ['cyberdeck', 'program']) assert.match(m, new RegExp(`data-action="addItem" data-type="${t}"`), `matrix: ${t}`);
  });
  test('row edits are unnamed (they change the item, not the actor form) and say which field', () => {
    for (const f of ['actor-character-sheet.hbs']) {
      const s = read('public/templates', f);
      const edits = [...s.matchAll(/<input[^>]*class="sr2e-rowedit[^"]*"[^>]*>/g)].map((x) => x[0]);
      assert.ok(edits.length >= 5, `${f}: ${edits.length}`);
      for (const e of edits) { assert.ok(!/\sname=/.test(e), e); assert.match(e, /data-field="system\.\w+"/); assert.match(e, /data-item-id="\{\{id\}\}"/); }
    }
  });
  test('the summary has the pinned bar and the setup banner; the Add window part scrolls', () => {
    const s = read('public/templates/sheet-summary.hbs');
    assert.match(s, /class="sr2e-pinbar"/);
    assert.match(s, /<details class="sr2e-setup">/);
    assert.match(s, /data-action="jumpTo"/);
    const a = read('src/module/applications/adding.ts');
    assert.match(a, /add-window\.hbs`, scrollable: \[''\]/);
    for (const k of ['addItem', 'addSkill', 'duplicateItem', 'pinItem', 'sheetMode', 'jumpTo']) assert.match(a, new RegExp(`\\n  ${k}: (async )?function`), k);
  });
  test('Play mode hides the setup controls; folded parts show while searching', () => {
    const css = read('public/style/sr2e.css');
    assert.match(css, /\.sr2e-sheet\.sr2e-play :is\(\.sr2e-add, \.sr2e-dup, a\[data-action="deleteItem"\]/);
    assert.match(css, /\.sr2e-sheet:not\(\.sr2e-searching\) \.sr2e-fold-away \{ display: none !important; \}/);
    assert.match(css, /prefers-reduced-motion/);
  });
});
