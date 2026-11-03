/**
 * v0.51.0 undo log glue, with small stubs of Foundry's hooks and documents. Checks our wiring
 * (what is noted before a change, what GM clients log, how Undo puts it back), not Foundry itself.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const g = globalThis as any;
const hooks = new Map<string, Array<(...a: any[]) => unknown>>();
const docs = new Map<string, any>();
const created: any[] = [];
let confirmAnswer = true;
let confirms = 0;
let advanced: number[] = [];

const zzWait = () => new Promise((r) => setTimeout(r, 30));
function fire(name: string, ...args: any[]) { for (const fn of hooks.get(name) ?? []) fn(...args); }

const clone = (v: any) => JSON.parse(JSON.stringify(v));
function setPath(o: any, path: string, v: any) {
  const segs = path.split('.');
  let last = segs.pop()!;
  for (const s of segs) { o[s] ??= {}; o = o[s]; }
  if (last.startsWith('-=')) { delete o[last.slice(2)]; return; }
  if (last.startsWith('==')) last = last.slice(2);
  o[last] = clone(v);
}

/** A stub document: `_source`, update through the hooks (pre on the caller, post on "every client"). */
class Doc {
  documentName: string; id: string; _source: any; parent: any = null; pack = null;
  constructor(documentName: string, id: string, source: any, parent: any = null) {
    this.documentName = documentName; this.id = id; this._source = clone(source); this.parent = parent;
    docs.set(this.uuid, this);
  }
  get uuid() { return this.parent ? `${this.parent.uuid}.${this.documentName}.${this.id}` : `${this.documentName}.${this.id}`; }
  get name() { return this._source.name; }
  get content() { return this._source.content; }
  get flags() { return this._source.flags ?? {}; }
  get rolls() { return this._source.rolls ?? []; }
  get key() { return this._source.key; }
  toObject() { return { _id: this.id, ...clone(this._source) }; }
  async update(changes: any, options: any = {}) {
    const flat: Record<string, unknown> = {};
    const expanded: any = {};
    for (const [k, v] of Object.entries(changes)) { flat[k] = v; setPath(expanded, k.replace(/(^|\.)(-=|==)/g, '$1$2'), v); }
    // Pre-hooks see the expanded change (operators kept as -= / == keys here).
    const exp: any = {};
    for (const [k, v] of Object.entries(changes)) {
      const segs = k.split('.'); let o = exp;
      for (const s of segs.slice(0, -1)) { o[s] ??= {}; o = o[s]; }
      o[segs.at(-1)!] = v;
    }
    fire(`preUpdate${this.documentName}`, this, exp, options, 'u1');
    for (const [k, v] of Object.entries(flat)) setPath(this._source, k, v);
    // "The server" hands the same options to every client.
    fire(`update${this.documentName}`, this, exp, clone(options), g.__userId ?? 'u1');
    return this;
  }
  async delete(options: any = {}) { docs.delete(this.uuid); fire(`delete${this.documentName}`, this, options, g.__userId ?? 'u1'); return this; }
  getEmbeddedDocument(_n: string, id: string) { return [...docs.values()].find((d) => d.parent === this && d.id === id) ?? null; }
}

before(async () => {
  g.Hooks = {
    on: (n: string, fn: any) => { if (!hooks.has(n)) hooks.set(n, []); hooks.get(n)!.push(fn); },
    once: (n: string, fn: any) => g.Hooks.on(n, fn),
    callAll: (n: string, ...a: any[]) => fire(n, ...a),
  };
  let n = 0;
  g.foundry = {
    utils: {
      randomID: () => `r${++n}`,
      getDocumentClass: (name: string) => ({ create: async (data: any, opts: any) => {
        created.push({ name, data, opts });
        const d = new Doc(name, data._id, (({ _id, ...rest }) => rest)(data), opts.parent ?? null);
        fire(`create${name}`, d, opts, 'u1');
        return d;
      } }),
    },
    applications: { api: { DialogV2: { confirm: async () => { confirms++; return confirmAnswer; } } } },
  };
  g.game = {
    user: { id: 'gm1', isGM: true },
    users: { get: (id: string) => ({ name: id === 'p1' ? 'Player' : 'GM' }) },
    world: { id: 'w' },
    time: { worldTime: 3600, advance: async (s: number) => { advanced.push(s); g.game.time.worldTime += s; } },
    collections: { get: (name: string) => ({ get: (id: string) => docs.get(`${name}.${id}`) ?? null }) },
  };
  g.ui = { notifications: { info: () => {}, warn: () => {} } };
  g.fromUuid = async (u: string) => docs.get(u) ?? null;
  const store = new Map<string, string>();
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  const { registerUndoHooks } = await import('../applications/undo.ts');
  registerUndoHooks();
});

let SR2Undo: any;
beforeEach(async () => {
  ({ SR2Undo } = await import('../applications/undo.ts'));
  SR2Undo.clear();
  SR2Undo.endQuiet();
  docs.clear(); created.length = 0; confirms = 0; confirmAnswer = true; advanced = [];
  g.game.user.isGM = true;
  g.__userId = 'u1';
});

describe('v0.51.0 undo log', () => {
  test('an update is noted before it happens and logged on the GM client with before and after', async () => {
    const a = new Doc('Actor', 'a1', { name: 'Ganger', system: { monitor: { physical: 1, stun: 0 }, nuyen: 50 } });
    await a.update({ 'system.monitor.physical': 4, 'system.nuyen': 20 });
    const step = SR2Undo.newest();
    assert.ok(step);
    const e = step.entries[0];
    assert.equal(e.op, 'update');
    assert.deepEqual(e.fields.map((f: any) => [f.path, f.before, f.after]), [['system.monitor.physical', 1, 4], ['system.nuyen', 50, 20]]);
    assert.equal(step.label, 'Ganger: Physical 1 → 4, nuyen 50 → 20');
  });

  test('Undo puts the values back and drops the step; its own change is not logged', async () => {
    const a = new Doc('Actor', 'a1', { name: 'Ganger', system: { monitor: { physical: 1 }, flags: {} } });
    await a.update({ 'system.monitor.physical': 4, 'system.extra': { x: 1 } });
    const r = await SR2Undo.undoLast();
    assert.equal(r.done, 1);
    assert.deepEqual(a._source.system, { monitor: { physical: 1 }, flags: {} });
    assert.equal(SR2Undo.newest(), null);
  });

  test('a player\'s change reaches the GM log through the options; non-GM clients log nothing', async () => {
    g.__userId = 'p1';
    const a = new Doc('Actor', 'a1', { name: 'PC', system: { nuyen: 100 } });
    await a.update({ 'system.nuyen': 90 });
    assert.equal(SR2Undo.newest().userName, 'Player');
    SR2Undo.clear();
    g.game.user.isGM = false;
    await a.update({ 'system.nuyen': 80 });
    assert.equal(SR2Undo.newest(), null);
  });

  test("an unlinked token's actor: noted from the ActorDelta, logged from updateActor", async () => {
    const synthetic: any = new Doc('Actor', 'base', { name: 'Token guard', system: { monitor: { physical: 0 } } });
    synthetic.isToken = true;
    synthetic.token = { id: 'tok1' };
    const delta = { parent: { id: 'tok1', actor: synthetic } };
    const options: any = {};
    fire('preUpdateActorDelta', delta, { system: { monitor: { physical: 3 } } }, options);
    synthetic._source.system.monitor.physical = 3;
    fire('updateActor', synthetic, { system: { monitor: { physical: 3 } } }, { ...options }, 'u1');
    const e = SR2Undo.newest().entries[0];
    assert.deepEqual([e.fields[0].path, e.fields[0].before, e.fields[0].after], ['system.monitor.physical', 0, 3]);
  });

  test('changes within the window are one step, undone newest first', async () => {
    const a = new Doc('Actor', 'a1', { name: 'A', system: { n: 1 } });
    await a.update({ 'system.n': 2 });
    await a.update({ 'system.n': 3 });
    assert.equal(SR2Undo.steps().length, 1);
    await SR2Undo.undoLast();
    assert.equal(a._source.system.n, 1);
  });

  test('a second Undo just after one (a double-click) is ignored; Undo to here chains', async () => {
    const a = new Doc('Actor', 'a1', { name: 'A', system: { n: 1 } });
    await a.update({ 'system.n': 2 });
    g.__userId = 'u2';
    await a.update({ 'system.n': 3 });
    assert.ok(await SR2Undo.undoLast());
    assert.equal(await SR2Undo.undoLast(), null);
    assert.equal(a._source.system.n, 2);
    assert.ok(await SR2Undo.undoLast({ chain: true }));
    assert.equal(a._source.system.n, 1);
  });

  test('a card created with the change is deleted by Undo; a plain chat line alone is not logged', async () => {
    const chat = new Doc('ChatMessage', 'c0', { content: '<p>hello</p>' });
    fire('createChatMessage', chat, {}, 'u1');
    assert.equal(SR2Undo.newest(), null);
    const a = new Doc('Actor', 'a1', { name: 'A', system: { n: 1 } });
    await a.update({ 'system.n': 2 });
    const card = new Doc('ChatMessage', 'c1', { content: '<div class="sr2e-roll"><h3>Attack: Pistol</h3></div>', flags: { sr2e: { test: {} } } });
    fire('createChatMessage', card, {}, 'u1');
    assert.equal(SR2Undo.newest().label, 'Attack: Pistol');
    await SR2Undo.undoLast();
    assert.equal(docs.has('ChatMessage.c1'), false);
    assert.equal(a._source.system.n, 1);
  });

  test('a deleted item comes back with its id, inside its actor', async () => {
    const a = new Doc('Actor', 'a1', { name: 'A', system: {} });
    const it = new Doc('Item', 'i1', { name: 'Medkit', system: { quantity: 2 } }, a);
    await it.delete();
    assert.equal(SR2Undo.newest().label, 'item “Medkit” deleted');
    await SR2Undo.undoLast();
    assert.equal(created[0].opts.keepId, true);
    assert.equal(created[0].opts.parent, a);
    assert.equal(created[0].opts.sr2eUndoing, true);
    assert.equal(docs.get('Actor.a1.Item.i1').name, 'Medkit');
    // Recreating it during the undo is not logged as a new step.
    assert.equal(SR2Undo.newest(), null);
  });

  test('changed since: the GM is asked; no means nothing happens', async () => {
    const a = new Doc('Actor', 'a1', { name: 'A', system: { n: 1 } });
    await a.update({ 'system.n': 2 });
    a._source.system.n = 7; // changed without the log seeing it
    confirmAnswer = false;
    assert.equal(await SR2Undo.undoLast(), null);
    assert.equal(confirms, 1);
    assert.equal(a._source.system.n, 7);
    confirmAnswer = true;
    await SR2Undo.undoLast();
    assert.equal(a._source.system.n, 1);
  });

  test('token moves are not logged; other token changes are', async () => {
    const t = new Doc('Token', 't1', { name: 'Guard', x: 0, y: 0, hidden: false });
    await t.update({ x: 100, y: 50 });
    assert.equal(SR2Undo.newest(), null);
    await t.update({ hidden: true });
    assert.equal(SR2Undo.newest().entries[0].fields[0].path, 'hidden');
  });

  test('settings: world time and the system\'s settings are logged, others not; time is put back by advancing', async () => {
    const other = new Doc('Setting', 's0', { key: 'core.fog', value: '1' });
    await other.update({ value: '2' });
    const mig = new Doc('Setting', 's1', { key: 'sr2e.migrationVersion', value: '"0.1"' });
    await mig.update({ value: '"0.2"' });
    assert.equal(SR2Undo.newest(), null);
    const time = new Doc('Setting', 's2', { key: 'core.time', value: '3600' });
    await time.update({ key: 'core.time', value: '90000' });
    g.game.time.worldTime = 90000;
    const e = SR2Undo.newest().entries[0];
    assert.deepEqual(e.fields.map((f: any) => f.path), ['value']);
    assert.equal(SR2Undo.newest().label, 'world time 01:00:00 → day 2, 01:00:00');
    await SR2Undo.undoLast();
    assert.deepEqual(advanced, [3600 - 90000]);
  });

  test('a document that is gone is reported, the rest still undone', async () => {
    const a = new Doc('Actor', 'a1', { name: 'A', system: { n: 1 } });
    const b = new Doc('Actor', 'b1', { name: 'B', system: { n: 1 } });
    await a.update({ 'system.n': 2 });
    await b.update({ 'system.n': 2 });
    docs.delete('Actor.b1');
    const problems = await SR2Undo.problems(SR2Undo.newest());
    assert.match(problems[0], /B is gone/);
    const r = await SR2Undo.undoLast();
    assert.equal(r.done, 1);
    assert.equal(r.failed.length, 1);
    assert.equal(a._source.system.n, 1);
  });

  test("v14: an unlinked token's actor fires preUpdateActor under its own id; updateActor finds it", async () => {
    const synthetic: any = new Doc('Actor', 'base2', { name: 'Token ganger', system: { monitor: { physical: 0 } } });
    synthetic.isToken = true;
    synthetic.token = { id: 'tok2' };
    await synthetic.update({ 'system.monitor.physical': 3 });
    const e = SR2Undo.newest().entries[0];
    assert.deepEqual([e.fields[0].path, e.fields[0].before, e.fields[0].after], ['system.monitor.physical', 0, 3]);
    await SR2Undo.undoLast();
    assert.equal(synthetic._source.system.monitor.physical, 0);
  });

  test('fields sent again with the same value are left out; an update of nothing but those is not logged', async () => {
    const a = new Doc('Actor', 'a1', { name: 'A', system: { mode: 'basic', n: 1 } });
    await a.update({ 'system.mode': 'basic', 'system.n': 2 });
    assert.deepEqual(SR2Undo.newest().entries[0].fields.map((f: any) => f.path), ['system.n']);
    SR2Undo.clear();
    await a.update({ 'system.mode': 'basic' });
    assert.equal(SR2Undo.newest(), null);
  });

  test('a second Undo while one is running does nothing', async () => {
    const a = new Doc('Actor', 'a1', { name: 'A', system: { n: 1 } });
    await a.update({ 'system.n': 2 });
    g.__userId = 'u2';
    await a.update({ 'system.n': 3 });
    const [r1, r2] = await Promise.all([SR2Undo.undoLast(), SR2Undo.undoLast()]);
    assert.ok(r1);
    assert.equal(r2, null);
    assert.equal(a._source.system.n, 2);
    assert.equal(SR2Undo.steps().length, 1);
  });

  test('review: the same field twice in one step is not "changed since"; an update then a delete of a doc is not "gone"', async () => {
    const a = new Doc('Actor', 'a1', { name: 'A', system: { n: 0 } });
    await a.update({ 'system.n': 1 });
    await a.update({ 'system.n': 2 });
    assert.deepEqual(await SR2Undo.problems(SR2Undo.newest()), []);
    const it = new Doc('Item', 'i1', { name: 'Knife', system: { q: 1 } }, a);
    await it.update({ 'system.q': 2 });
    await it.delete();
    assert.deepEqual(await SR2Undo.problems(SR2Undo.newest()), []);
    await SR2Undo.undoLast();
    assert.equal(a._source.system.n, 0);
    assert.equal(docs.get('Actor.a1.Item.i1')._source.system.q, 1);
  });

  test("review: this client's own changes just after an undo aren't logged; another user's are", async () => {
    const a = new Doc('Actor', 'a1', { name: 'A', system: { n: 0 } });
    await a.update({ 'system.n': 1 });
    await SR2Undo.undoLast();
    g.__userId = 'gm1';
    await a.update({ 'system.n': 5 });
    assert.equal(SR2Undo.newest(), null);
    g.__userId = 'p1';
    a._source.system.n = 6;
    fire('updateActor', a, { system: { n: 6 } }, { sr2eUndo: { [a.uuid]: [{ path: 'system.n', had: true, before: 5 }] } }, 'p1');
    assert.equal(SR2Undo.newest().userName, 'Player');
  });

  test('review: undoing a setting saved for the first time puts back its default; the first world time goes back to 0', async () => {
    const sets: any[] = [];
    g.game.settings = { settings: new Map([['sr2e.scenePresets', { default: [] }]]), set: async (...a: any[]) => { sets.push(a); } };
    const st = new Doc('Setting', 's9', { key: 'sr2e.scenePresets', value: '[{"id":"x"}]' });
    fire('createSetting', st, {}, 'u1');
    assert.equal(SR2Undo.newest().label, 'setting “scenePresets” first saved');
    await SR2Undo.undoLast();
    assert.deepEqual(sets, [['sr2e', 'scenePresets', []]]);
    SR2Undo.endQuiet();
    g.game.time.worldTime = 500;
    const t = new Doc('Setting', 's10', { key: 'core.time', value: '500' });
    fire('createSetting', t, {}, 'u1');
    await SR2Undo.undoLast();
    assert.deepEqual(advanced, [-500]);
    delete g.game.settings;
  });

  test('review: a deleted document too big to keep is listed as not coming back', async () => {
    const { MAX_DELETED_DATA } = await import('../applications/undo.ts');
    const big = new Doc('Scene', 'sc1', { name: 'Huge', blob: 'x'.repeat(MAX_DELETED_DATA + 10) });
    await big.delete();
    const p = await SR2Undo.problems(SR2Undo.newest());
    assert.match(p[0], /too big to keep/);
  });

  test("review: options are keyed by uuid, so an unlinked token's actor never takes its base actor's values", async () => {
    const base = new Doc('Actor', 'same', { name: 'Base', system: { n: 1 } });
    const synthetic: any = new Doc('Actor', 'same', { name: 'Tok', system: { n: 9 } });
    synthetic.isToken = true;
    Object.defineProperty(synthetic, 'uuid', { get: () => 'Scene.s.Token.t.Actor.same' });
    docs.set(synthetic.uuid, synthetic);
    const options: any = {};
    fire('preUpdateActor', base, { system: { n: 2 } }, options);
    fire('updateActor', synthetic, { system: { n: 9 } }, clone(options), 'u1');
    assert.equal(SR2Undo.newest(), null);
  });

  test("Ctrl+Z: Foundry's canvas undo when its entry is newer, the log when the step is", async () => {
    const layer: any = { history: [] as any[] };
    g.canvas = { activeLayer: layer, layers: [layer], scene: { id: 's1' } };
    const a = new Doc('Actor', 'a1', { name: 'A', system: { n: 1 } });
    // v0.81.1 (SEC1-15): Ctrl+Z takes the GM's own newest step (another user's is undone from the panel).
    g.__userId = 'gm1';
    await a.update({ 'system.n': 2 });
    layer.history.push({ type: 'update', data: [{ _id: 't1' }], _sr2eAt: Date.now() + 5000 });
    assert.equal(SR2Undo.ctrlZ(), 'canvas');
    assert.equal(a._source.system.n, 2);
    layer.history[0]._sr2eAt = 0;
    assert.equal(SR2Undo.ctrlZ(), 'sr2e');
    await zzWait();
    assert.equal(a._source.system.n, 1);
    g.game.user.isGM = false;
    assert.equal(SR2Undo.ctrlZ(), 'canvas');
    delete g.canvas;
  });

  test("undoing a step drops the stale canvas entries for those documents and what the undo itself added", async () => {
    const layer: any = { history: [] as any[] };
    g.canvas = { activeLayer: layer, layers: [layer], scene: { id: 's1' } };
    const scene = new Doc('Scene', 's1', { name: 'S' });
    const wall = new Doc('Wall', 'w1', { ds: 0 }, scene);
    await wall.update({ ds: 1 });
    layer.history.push({ type: 'update', data: [{ _id: 'w1', ds: 0 }], _sr2eAt: 1 }, { type: 'update', data: [{ _id: 'w9' }], _sr2eAt: 1 });
    // Foundry would record the undo's own update too: simulate it during the revert.
    const hook = () => { layer.history.push({ type: 'update', data: [{ _id: 'w1', ds: 1 }], _sr2eAt: 2 }); };
    g.Hooks.on('updateWall', hook);
    await SR2Undo.undoLast();
    assert.equal(wall._source.ds, 0);
    assert.deepEqual(layer.history.map((e: any) => e.data[0]._id), ['w9']);
    delete g.canvas;
  });

  test("Foundry's own undo (isUndo) isn't logged, and the log forgets the change it put back", async () => {
    const scene = new Doc('Scene', 's1', { name: 'S' });
    const wall = new Doc('Wall', 'w2', { ds: 0 }, scene);
    await wall.update({ ds: 1 });
    assert.equal(SR2Undo.steps().length, 1);
    SR2Undo.endQuiet();
    await wall.update({ ds: 0 }, { isUndo: true });
    assert.equal(SR2Undo.steps().length, 0);
  });
});

