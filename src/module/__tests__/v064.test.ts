/**
 * v0.64.0: creation, advancement and the approval queue. Glue checks with small stubs (the wizard, the
 * tabs and the windows themselves are checked in the live run), plus template and stylesheet checks.
 */
import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/index.ts';

const g = globalThis as any;
let ap: typeof import('../applications/approvals.ts');
let adv: typeof import('../applications/advancement.ts');
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

const hooks = new Map<string, Array<(...a: any[]) => any>>();
const notes: string[] = [];
const chats: any[] = [];
let settings: Record<string, unknown> = {};

function setPath(o: any, path: string, v: unknown) {
  const parts = path.split('.');
  let x = o;
  for (const p of parts.slice(0, -1)) { x[p] ??= {}; x = x[p]; }
  const last = parts.at(-1)!;
  if (last.startsWith('-=')) delete x[last.slice(2)]; else x[last] = v;
}
function getPath(o: any, path: string) { return path.split('.').reduce((x, p) => (x == null ? undefined : x[p]), o); }
function flatten(o: any, pre = '', out: Record<string, unknown> = {}) {
  for (const [k, v] of Object.entries(o ?? {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) flatten(v, `${pre}${k}.`, out); else out[`${pre}${k}`] = v;
  }
  return out;
}

/** A character stub whose update runs the pre/post hooks like Foundry does on the acting client. */
function character(extra: any = {}): any {
  const items: any[] = [];
  const a: any = {
    type: 'character', name: 'ZZ Runner', uuid: `Actor.zz${Math.random()}`, isOwner: true, flags: {},
    system: { attributes: { body: { base: 4 } }, karma: { good: 20, career: 0, pool: 1 }, nuyen: 5000, ledger: [], magic: 0, ...extra },
    items: Object.assign(items, { get: (id: string) => items.find((i) => i.id === id) }),
    calls: [] as any[],
    getFlag(s: string, k: string) { return this.flags[s]?.[k]; },
    async setFlag(s: string, k: string, v: unknown) { await this.update({ [`flags.${s}.${k}`]: v }); },
    async update(data: any, options: any = {}) {
      const flat = flatten(data);
      for (const fn of hooks.get('preUpdateActor') ?? []) fn(this, data, options, g.game.user.id);
      for (const [k, v] of Object.entries(flat)) setPath(this, k, v);
      for (const fn of hooks.get('updateActor') ?? []) fn(this, data, options, g.game.user.id);
    },
    async improve(t: any) { this.calls.push(['improve', t]); return true; },
    async evil() { this.calls.push(['evil']); return true; },
  };
  return a;
}

before(async () => {
  g.Hooks = { on: (h: string, fn: any) => { if (!hooks.has(h)) hooks.set(h, []); hooks.get(h)!.push(fn); }, callAll() {} };
  g.ui = { notifications: { info: (m: string) => notes.push(m), warn: (m: string) => notes.push(m) } };
  g.ChatMessage = { create: async (d: any) => { chats.push(d); return d; } };
  g.foundry = { utils: { randomID: () => Math.random().toString(36).slice(2, 12), deepClone: (o: any) => JSON.parse(JSON.stringify(o)), flattenObject: flatten, getProperty: getPath } };
  g.game = { user: { id: 'player', name: 'Corvo', isGM: false }, users: [{ id: 'gm', isGM: true }], settings: { get: (_s: string, k: string) => settings[k] }, time: { worldTime: 0 }, actors: [] };
  g.fromUuidSync = (uuid: string) => g.game.actors.find((x: any) => x.uuid === uuid) ?? null;
  ap = await import('../applications/approvals.ts');
  adv = await import('../applications/advancement.ts');
  adv.registerAdvancementHooks();
});

beforeEach(() => { notes.length = 0; chats.length = 0; settings = { approvalQueue: true }; g.game.user = { id: 'player', name: 'Corvo', isGM: false }; g.game.actors = []; });

describe('v0.64.0 the approval queue (glue)', () => {
  test('a player on a finished or never-built character waits; GMs, the queue off and the wizard don\'t', () => {
    const a = character();
    assert.equal(ap.approvalNeeded(a), true);
    a.flags.sr2e = { creationDraft: { step: 'skills' } };
    assert.equal(ap.inCreation(a), true);
    assert.equal(ap.approvalNeeded(a), false, 'in the wizard');
    a.flags.sr2e.creation = { v: 1, finishedAt: 'x', attributes: {} };
    assert.equal(ap.inCreation(a), false, 'a record beats a stale draft');
    assert.equal(ap.approvalNeeded(a), true);
    settings['approvalQueue'] = false;
    assert.equal(ap.approvalNeeded(a), false);
    settings['approvalQueue'] = true;
    g.game.user = { id: 'gm', name: 'GM AI', isGM: true };
    assert.equal(ap.approvalNeeded(a), false);
  });

  test('filing, approving (with the player credited) and declining', async () => {
    const a = character();
    g.game.actors = [a];
    assert.equal(await ap.fileRequest(a, { kind: 'improve', label: 'Raise Body 4 → 5', karma: 10, data: { method: 'improve', args: [{ attribute: 'body' }] } }), true);
    assert.equal(ap.requestsOf(a).length, 1);
    // v0.81.0 (A-9): the GM panel says what will run (from the data), with the player's label after it.
    // v0.81.1 round 2 (F): a filer this GM client didn't see file it is marked.
    assert.equal(ap.pendingRequests()[0]!.text, 'Corvo (filer not verified): improve({"attribute":"body"}) (asked as "Raise Body 4 → 5")');
    // A player can't approve.
    assert.equal(await ap.approveRequest(a, ap.requestsOf(a)[0]!.id), false);
    g.game.user = { id: 'gm', name: 'GM AI', isGM: true };
    let seen: any = null;
    a.improve = async function (t: any) { seen = { t, ctx: ap.approvalContext(a.uuid), needed: ap.approvalNeeded(a) }; return true; };
    assert.equal(await ap.approveRequest(a, ap.requestsOf(a)[0]!.id), true);
    assert.deepEqual(seen.t, { attribute: 'body' });
    assert.deepEqual(seen.ctx, { requester: 'Corvo', gm: 'GM AI' });
    assert.equal(ap.approvalContext(a.uuid), null, 'the context ends with the action');
    assert.equal(ap.requestsOf(a).length, 0);
    assert.deepEqual(chats.at(-1).whisper.sort(), ['gm', 'player']);
    // Decline.
    g.game.user = { id: 'player', name: 'Corvo', isGM: false };
    await ap.fileRequest(a, { kind: 'buyOff', label: 'Buy off Bad luck', karma: 4, data: { method: 'buyOffFlaw', args: ['q1'] } });
    g.game.user = { id: 'gm', name: 'GM AI', isGM: true };
    assert.equal(await ap.declineRequest(a, ap.requestsOf(a)[0]!.id, 'not yet'), true);
    assert.match(chats.at(-1).content, /declined.*not yet/);
    assert.equal(ap.requestsOf(a).length, 0);
  });

  test('an approved action that fails closes the request (never paid twice); only listed methods run', async () => {
    const a = character();
    g.game.actors = [a];
    await ap.fileRequest(a, { kind: 'improve', label: 'Raise Body', data: { method: 'improve', args: [{ attribute: 'body' }] } });
    await ap.fileRequest(a, { kind: 'improve', label: 'Something else', data: { method: 'evil', args: [] } });
    assert.equal(ap.requestsOf(a).length, 2);
    g.game.user = { id: 'gm', name: 'GM AI', isGM: true };
    a.improve = async () => false;
    const [first, second] = ap.requestsOf(a);
    assert.equal(await ap.approveRequest(a, first!.id), false);
    assert.deepEqual(ap.requestsOf(a).map((r) => r.id), [second!.id]);
    assert.match(chats.at(-1).content, /didn't go through/);
    assert.equal(await ap.approveRequest(a, second!.id), false);
    assert.deepEqual(a.calls, [], 'an unlisted method never runs');
  });

  test('requests are stored by id: a repeat replaces the older one, a drop removes only its own', async () => {
    const a = character();
    await ap.fileRequest(a, { kind: 'improve', label: 'Raise Body', karma: 10, data: {} });
    await ap.fileRequest(a, { kind: 'improve', label: 'Raise Body', karma: 10, data: {} });
    await ap.fileRequest(a, { kind: 'improve', label: 'Raise Quickness', karma: 10, data: {} });
    const list = ap.requestsOf(a);
    assert.deepEqual(list.map((r) => r.label), ['Raise Body', 'Raise Quickness']);
    assert.equal(Array.isArray(a.flags.sr2e.requests), false);
    await ap.dropRequest(a, list[0]!.id);
    assert.deepEqual(ap.requestsOf(a).map((r) => r.label), ['Raise Quickness']);
  });
});

describe('v0.64.0 the advancement log (glue)', () => {
  test('nothing is logged before the creation record', async () => {
    const a = character();
    g.game.actors = [a];
    await a.update({ 'system.karma.good': 25, 'system.ledger': [{ t: 0, kind: 'karma', amount: 5, reason: 'Run' }] });
    await adv.flushAdvancement();
    assert.equal(adv.advancementOf(a).length, 0);
  });

  test('a recorded character logs awards, raises and items; an approved one credits both', async () => {
    const a = character();
    g.game.actors = [a];
    a.flags.sr2e = { creation: { v: 1, finishedAt: 'x', attributes: {} } };
    await a.update({ 'system.karma.good': 25, 'system.karma.career': 5, 'system.ledger': [{ t: 0, kind: 'karma', amount: 5, reason: 'Run: docks' }] });
    // A raise in its own update (as improve does for attributes): base and the ledger together.
    await a.update({ 'system.attributes.body.base': 5, 'system.karma.good': 15, 'system.ledger': [{ t: 0, kind: 'karma', amount: 5, reason: 'Run: docks' }, { t: 0, kind: 'karma', amount: -10, reason: 'Body 4 → 5' }] });
    // A free item (createItem hook).
    for (const fn of hooks.get('createItem') ?? []) fn({ type: 'gear', name: 'Medkit', system: { quantity: 2 }, parent: a }, {}, 'player');
    await adv.flushAdvancement();
    const log = adv.advancementOf(a);
    assert.deepEqual(log.map((l) => l.what), ['Run: docks', 'Body 4 → 5', 'Gained Medkit ×2']);
    assert.equal(log[1]!.karma, -10);
    assert.equal(log[0]!.by, 'Corvo');
    // The log's own write isn't logged again.
    await adv.flushAdvancement();
    assert.equal(adv.advancementOf(a).length, 3);
  });

  test('a batched item update logs each item\'s own raise once; credit splits between bursts', async () => {
    const a = character();
    g.game.actors = [a];
    a.flags.sr2e = { creation: { v: 1, finishedAt: 'x', attributes: {} } };
    const s1 = { id: 's1', type: 'skill', name: 'Firearms', system: { rating: 3 }, parent: a };
    const s2 = { id: 's2', type: 'skill', name: 'Stealth', system: { rating: 2 }, parent: a };
    const options: any = {};
    for (const fn of hooks.get('preUpdateItem') ?? []) { fn(s1, { system: { rating: 4 } }, options, 'player'); fn(s2, { system: { rating: 3 } }, options, 'player'); }
    for (const fn of hooks.get('updateItem') ?? []) { fn(s1, {}, options, 'player'); fn(s2, {}, options, 'player'); }
    // Now the GM (another burst on the same client) gains something.
    g.game.user = { id: 'player', name: 'Someone else', isGM: false };
    for (const fn of hooks.get('createItem') ?? []) fn({ type: 'gear', name: 'Rope', system: {}, parent: a }, {}, 'player');
    await adv.flushAdvancement();
    await new Promise((r) => setTimeout(r, 10));
    const log = adv.advancementOf(a);
    assert.deepEqual(log.map((l) => `${l.what}|${l.by}`).sort(), ['Firearms 3 → 4|Corvo', 'Gained Rope|Someone else', 'Stealth 2 → 3|Corvo']);
  });

  test('another user\'s change is logged on their client, not here', async () => {
    const a = character();
    g.game.actors = [a];
    a.flags.sr2e = { creation: { v: 1, finishedAt: 'x', attributes: {} } };
    for (const fn of hooks.get('createItem') ?? []) fn({ type: 'gear', name: 'Rope', system: {}, parent: a }, {}, 'someone-else');
    await adv.flushAdvancement();
    assert.equal(adv.advancementOf(a).length, 0);
  });
});

describe('v0.64.0 rating edits after creation (glue)', () => {
  // v0.92.1: the old lock is RULES.SHEET_V921.ratingLock 'always' (the default 'queue' locks only with the queue on).
  const lockWas = RULES.SHEET_V921.ratingLock;
  before(() => { (RULES.SHEET_V921 as any).ratingLock = 'always'; });
  after(() => { (RULES.SHEET_V921 as any).ratingLock = lockWas; });
  test('a player\'s typed raise is dropped; a GM\'s stays; money only with the queue on', () => {
    const a = character();
    a.flags.sr2e = { creation: { v: 1, finishedAt: 'x', attributes: {} } };
    const ch: Record<string, unknown> = { 'system.attributes.body.base': 6, 'system.attributes.body.mod': 2, 'system.nuyen': 9000 };
    assert.deepEqual(adv.refuseLockedRaises(a, 'actor', ch).sort(), ['system.attributes.body.base', 'system.nuyen']);
    assert.deepEqual(Object.keys(ch), ['system.attributes.body.mod']);
    settings['approvalQueue'] = false;
    const ch2: Record<string, unknown> = { 'system.nuyen': 9000 };
    assert.deepEqual(adv.refuseLockedRaises(a, 'actor', ch2), []);
    g.game.user = { id: 'gm', name: 'GM AI', isGM: true };
    const ch3: Record<string, unknown> = { 'system.attributes.body.base': 6 };
    assert.deepEqual(adv.refuseLockedRaises(a, 'actor', ch3), []);
    // Items: a skill's rating, through its parent.
    g.game.user = { id: 'player', name: 'Corvo', isGM: false };
    const skill = { type: 'skill', parent: a, system: { rating: 3 } };
    const ch4: Record<string, unknown> = { 'system.rating': 4 };
    assert.deepEqual(adv.refuseLockedRaises(skill, 'item', ch4), ['system.rating']);
    const ch5: Record<string, unknown> = { 'system.rating': 2 };
    assert.deepEqual(adv.refuseLockedRaises(skill, 'item', ch5), [], 'lowering is fine');
  });

  test('before the record: unlocked with the queue off or in the wizard; locked with the queue on', () => {
    const a = character();
    settings['approvalQueue'] = false;
    assert.deepEqual(adv.refuseLockedRaises(a, 'actor', { 'system.attributes.body.base': 6 }), []);
    settings['approvalQueue'] = true;
    assert.deepEqual(adv.refuseLockedRaises(a, 'actor', { 'system.attributes.body.base': 6 }), ['system.attributes.body.base'], 'a character made before the wizard, in play');
    a.flags.sr2e = { creationDraft: { step: 'attributes' } };
    assert.deepEqual(adv.refuseLockedRaises(a, 'actor', { 'system.attributes.body.base': 6 }), [], 'in the wizard');
  });
});

describe('v0.64.0 templates and wiring', () => {
  test('the wizard has every step, the totals and a Finish', () => {
    const t = read('public/templates', 'creation-wizard.hbs');
    for (const s of ['priorities', 'metatype', 'attributes', 'magic', 'skills', 'resources', 'contacts', 'review']) assert.match(t, new RegExp(`\\{\\{#if is\\.${s}\\}\\}`), s);
    assert.match(t, /sr2e-wiz-totals/);
    assert.match(t, /data-action="wizFinish"/);
    assert.match(t, /data-wiz="priority"/);
  });

  test('the character sheet has Current beside Main and a Creation tab with the log', () => {
    const t = read('public/templates', 'actor-character-sheet.hbs');
    assert.ok(t.indexOf('data-tab="current"') > t.indexOf('data-tab="main"') && t.indexOf('data-tab="current"') < t.indexOf('data-tab="combat"'));
    assert.match(t, /data-tab="creation"/);
    assert.match(t, /sr2e-advlog/);
    assert.match(t, /data-action="openWizard"/);
    assert.match(t, /data-action="spendKarma"/);
    const sheets = read('src/module/applications', 'sheets.ts');
    assert.match(sheets, /\{ id: "main", label: tx\('SR2E\.App\.Sheets\.main'\) \}, \.\.\.\(actor\.type === "character" \? \[\{ id: "current", label: tx\('SR2E\.App\.Sheets\.current'\) \}\] : \[\]\)/);
  });

  test('the GM panel has the Requests tab; the setting is off by default', () => {
    assert.match(read('public/templates', 'gm-panel.hbs'), /\{\{#if tab\.requests\}\}/);
    assert.match(read('src/module/applications', 'ui.ts'), /id: 'requests'/);
    assert.match(read('src/module', 'settings.ts'), /"approvalQueue", \{[\s\S]*?default: false/);
  });

  test('the Karma paths are gated; raiseSpellForce writes a ledger line', () => {
    const doc = read('src/module/documents', 'index.ts');
    for (const m of ['improve', 'raiseSpellForce', 'gainEdge', 'buyOffFlaw', 'learnFormula']) assert.match(doc, new RegExp(`method: '${m}'`), m);
    assert.match(doc, /reason: `\$\{spell\.name\} Force \$\{from\} → \$\{newForce\}`/);
  });

  test('the stylesheet has the v0.64.0 section', () => {
    const css = read('public/style', 'sr2e.css');
    assert.match(css, /v0\.64\.0: creation and advancement/);
    assert.match(css, /\.sr2e-wizard \.sr2e-wiz-totals/);
  });
});
