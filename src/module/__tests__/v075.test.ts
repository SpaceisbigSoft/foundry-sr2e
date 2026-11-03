/**
 * v0.75.0: the flag-write sweep. Flags cleared or map keys dropped on an unlinked token's actor now stick.
 *
 * The flag model here follows what Foundry v14.369 did in the live probe (23 Oct 2026, see helpers/flags.ts):
 * - linked documents: setFlag/update merge objects, `-=` deletes, `==` replaces;
 * - a synthetic (unlinked token) actor: its own changes sit in a delta over the base actor's flags; a `-=` on one of
 *   its own top-level flags is deleted on the server but stays on the open client (stale: modelled as no change);
 *   `-=` / `==` can't remove what the base has; null writes stick.
 * The glue tests run the real SR2Actor methods on such stubs.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isSynthetic, clearFlag, clearFlagUpdate, dropFlagKeys, dropFlagKeysUpdate, replaceFlag, replaceFlagUpdate, deltaSafeUpdate } from '../helpers/flags.ts';
import { RULES } from '../rules/index.ts';

const g = globalThis as any;
const chat: any[] = [];
const warnings: string[] = [];
const uuidRegistry = new Map<string, any>();
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

const isObj = (v: unknown): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v: any) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** Foundry's merge of an update into data: dotted keys expanded, objects merged, `-=` deletes, `==` replaces. */
function applyPath(target: any, path: string, value: any, o: { staleTopDelete?: boolean } = {}): void {
  const parts = path.split('.');
  let t = target;
  for (const p of parts.slice(0, -1)) {
    // As Foundry's expandObject/setProperty: a missing step is made, but a value (or null) in the way throws.
    if (t[p] === undefined) t[p] = {};
    else if (!isObj(t[p])) throw new TypeError(`Cannot use 'in' operator to search for '${p}' in ${t[p]}`);
    t = t[p];
  }
  const last = parts[parts.length - 1]!;
  if (last.startsWith('-=')) {
    // Synthetic: a top-level flag key (flags.sr2e.-=k) stays on the client (deleted only on the server).
    if (o.staleTopDelete && parts.length === 2) return;
    delete t[last.slice(2)];
  } else if (last.startsWith('==')) t[last.slice(2)] = clone(value);
  else if (isObj(value) && isObj(t[last])) { for (const [k, v] of Object.entries(value)) applyPath(t[last], k, v, {}); }
  else t[last] = clone(value);
}
/** Base flags with the delta over them (as the synthetic actor reads them). */
function merged(base: any, delta: any): any {
  const out: any = clone(base) ?? {};
  for (const [k, v] of Object.entries(delta ?? {})) out[k] = isObj(v) && isObj(out[k]) ? merged(out[k], v) : clone(v);
  return out;
}

/** Give a stub document Foundry-like flag methods. `base` (synthetic only): the base actor's flags. */
function flagged(doc: any, o: { synthetic?: boolean; base?: Record<string, any> } = {}): any {
  const delta: any = {};
  const base = { sr2e: clone(o.base ?? {}) };
  const own: any = { sr2e: {} };
  const refresh = () => { doc.flags = o.synthetic ? merged(base, delta) : own; };
  doc.documentName ??= 'Actor';
  if (o.synthetic) { doc.isToken = true; doc.token = { actorLink: false, delta: { flags: delta } }; } else doc.isToken = false;
  doc.getFlag = (s: string, k: string) => doc.flags?.[s]?.[k];
  doc.update = async (d: any, _opts?: any) => {
    for (const [k, v] of Object.entries(d)) {
      if (k.startsWith('flags.')) applyPath(o.synthetic ? delta : own, k.slice(6), v, { staleTopDelete: o.synthetic });
      else if (doc.system) applyPath(doc, k, v);
    }
    refresh();
    doc.system?.prepareDerivedData?.();
  };
  doc.setFlag = async (s: string, k: string, v: any) => doc.update({ [`flags.${s}.${k}`]: v });
  doc.unsetFlag = async (s: string, k: string) => doc.update({ [`flags.${s}.-=${k}`]: null });
  doc._delta = delta;
  refresh();
  return doc;
}

const linked = (flags: Record<string, any> = {}) => { const d = flagged({ name: 'Linked' }); Object.assign(d.flags.sr2e, clone(flags)); return d; };
const synth = (base: Record<string, any> = {}) => flagged({ name: 'Token' }, { synthetic: true, base });

// ============================================================================================ The model itself

describe('the stub model matches what Foundry did live', () => {
  test('synthetic: unsetFlag on its own flag stays (the bug), a base flag stays, null sticks', async () => {
    const a = synth({ inherited: true });
    await a.setFlag('sr2e', 'k', true);
    await a.unsetFlag('sr2e', 'k');
    assert.equal(a.getFlag('sr2e', 'k'), true);
    await a.unsetFlag('sr2e', 'inherited');
    assert.equal(a.getFlag('sr2e', 'inherited'), true);
    await a.setFlag('sr2e', 'k', null);
    assert.equal(a.getFlag('sr2e', 'k'), null);
  });
  test('setFlag merges objects (a dropped key stays) on both kinds', async () => {
    for (const a of [linked(), synth()]) {
      await a.setFlag('sr2e', 'm', { a: 1, b: 2 });
      await a.setFlag('sr2e', 'm', { a: 1 });
      assert.deepEqual(a.getFlag('sr2e', 'm'), { a: 1, b: 2 });
    }
  });
});

// ============================================================================================ helpers/flags.ts

describe('isSynthetic', () => {
  test('an unlinked token actor and what sits in it; not linked actors, messages or scenes', () => {
    const s = synth();
    assert.equal(isSynthetic(s), true);
    assert.equal(isSynthetic({ documentName: 'Item', parent: s }), true);
    assert.equal(isSynthetic({ documentName: 'ActiveEffect', parent: { documentName: 'Item', parent: s } }), true);
    assert.equal(isSynthetic(linked()), false);
    assert.equal(isSynthetic({ documentName: 'Item', parent: linked() }), false);
    assert.equal(isSynthetic({ documentName: 'ChatMessage' }), false);
    assert.equal(isSynthetic({ documentName: 'Scene' }), false);
    assert.equal(isSynthetic(null), false);
  });
});

describe('clearFlag', () => {
  test('linked: deleted for real (no null left)', async () => {
    const a = linked({ k: { x: 1 } });
    await clearFlag(a, 'k');
    assert.equal('k' in a.flags.sr2e, false);
  });
  test('synthetic: its own flag and an inherited one both read as not set at once', async () => {
    const a = synth({ inherited: 'yes' });
    await a.setFlag('sr2e', 'own', { t: 1 });
    await clearFlag(a, 'own');
    await clearFlag(a, 'inherited');
    assert.equal(a.getFlag('sr2e', 'own') ?? undefined, undefined);
    assert.equal(a.getFlag('sr2e', 'inherited') ?? undefined, undefined);
  });
  test('false and 0 are cleared too; a flag that is not set writes nothing', async () => {
    const a = synth();
    await a.setFlag('sr2e', 'f', false);
    await clearFlag(a, 'f');
    assert.equal(a.getFlag('sr2e', 'f'), null);
    let writes = 0;
    const b = linked();
    const up = b.update; b.update = async (...x: any[]) => { writes++; return up(...x); };
    await clearFlag(b, 'missing');
    assert.equal(writes, 0);
  });
  test('options go along with the write (sr2eUndoing and the like)', async () => {
    const seen: any[] = [];
    for (const a of [linked({ k: 1 }), synth()]) {
      if (a.isToken) await a.setFlag('sr2e', 'k', 1);
      const up = a.update; a.update = async (d: any, opts: any) => { seen.push(opts); return up(d, opts); };
      await clearFlag(a, 'k', { sr2eNoAdvance: true });
      assert.equal(a.getFlag('sr2e', 'k') ?? undefined, undefined);
    }
    assert.deepEqual(seen, [{ sr2eNoAdvance: true }, { sr2eNoAdvance: true }]);
  });
  test('clearFlagUpdate: `-=` on linked, null on synthetic', () => {
    assert.deepEqual(clearFlagUpdate(linked(), 'a', 'b'), { 'flags.sr2e.-=a': null, 'flags.sr2e.-=b': null });
    assert.deepEqual(clearFlagUpdate(synth(), 'a'), { 'flags.sr2e.a': null });
  });
});

describe('dropFlagKeys (map-shaped flags: projects, requests)', () => {
  test('linked: keys deleted', async () => {
    const a = linked({ projects: { p1: { id: 'p1' }, p2: { id: 'p2' } } });
    await dropFlagKeys(a, 'projects', ['p1']);
    assert.deepEqual(Object.keys(a.getFlag('sr2e', 'projects')), ['p2']);
  });
  test('synthetic: own and inherited keys read as gone', async () => {
    const a = synth({ projects: { base: { id: 'base' } } });
    await a.update({ 'flags.sr2e.projects.p1': { id: 'p1' } });
    await dropFlagKeys(a, 'projects', ['p1', 'base']);
    const p = a.getFlag('sr2e', 'projects');
    assert.equal(Object.values(p).filter(Boolean).length, 0);
  });
  test('no ids, no write; the update form is mergeable', async () => {
    let writes = 0;
    const a = linked(); a.update = async () => { writes++; };
    await dropFlagKeys(a, 'projects', []);
    assert.equal(writes, 0);
    assert.deepEqual(dropFlagKeysUpdate(synth(), 'requests', ['r1']), { 'flags.sr2e.requests.r1': null });
    assert.deepEqual(dropFlagKeysUpdate(linked(), 'requests', ['r1']), { 'flags.sr2e.requests.-=r1': null });
  });
});

describe('replaceFlag (an object flag written exactly)', () => {
  test('linked: keys left out are dropped; nested objects are replaced, not merged', async () => {
    const a = linked({ repeatPower: { powerUuid: 'old', modifiers: [{ v: -2 }], exclude: ['x'], extra: { a: 1, b: 2 } } });
    await replaceFlag(a, 'repeatPower', { powerUuid: 'new', extra: { a: 1 } });
    assert.deepEqual(a.getFlag('sr2e', 'repeatPower'), { powerUuid: 'new', extra: { a: 1 } });
  });
  test('synthetic: the same, with dropped keys (own and inherited) as null', async () => {
    const a = synth({ build: { A: 'magic', B: 'attributes', C: 'skills' } });
    await a.update({ 'flags.sr2e.build.D': 'resources' });
    await replaceFlag(a, 'build', { A: 'attributes' });
    const b = a.getFlag('sr2e', 'build');
    assert.equal(b.A, 'attributes');
    for (const k of ['B', 'C', 'D']) assert.equal(b[k], null, k);
  });
  test('review fix: on a synthetic actor a value or list flag is replaced in one key (no null with keys under it)', () => {
    const s = synth({ build: ['old'] });
    assert.deepEqual(replaceFlagUpdate(s, 'build', { A: 'magic' }), { 'flags.sr2e.build': { A: 'magic' } });
  });
  test('a flag that was a value or a list before becomes the object', async () => {
    const a = linked({ build: ['old'] });
    await replaceFlag(a, 'build', { A: 'magic' });
    assert.deepEqual(a.getFlag('sr2e', 'build'), { A: 'magic' });
    const s = synth();
    await s.setFlag('sr2e', 'build', 'old');
    await replaceFlag(s, 'build', { A: 'magic' });
    assert.deepEqual(s.getFlag('sr2e', 'build'), { A: 'magic' });
  });
  test('the first write of a new flag is just its keys', () => {
    assert.deepEqual(replaceFlagUpdate(linked(), 'x', { a: 1 }), { 'flags.sr2e.x.a': 1 });
  });
});

describe('deltaSafeUpdate (the undo log\'s inverse update)', () => {
  test('synthetic: flag deletions become null writes, other keys untouched', () => {
    const inv = { 'flags.sr2e.-=broken': null, 'flags.sr2e.projects.-=p1': null, 'flags.sr2e.==aim': { a: 1 }, 'system.-=foo': null, 'system.monitor.stun': 2 };
    assert.deepEqual(deltaSafeUpdate(synth(), inv), { 'flags.sr2e.broken': null, 'flags.sr2e.projects.p1': null, 'flags.sr2e.==aim': { a: 1 }, 'system.-=foo': null, 'system.monitor.stun': 2 });
  });
  test('linked: returned as it was', () => {
    const inv = { 'flags.sr2e.-=broken': null };
    assert.equal(deltaSafeUpdate(linked(), inv), inv);
  });
  test('review fix: undoing the first sr2e flag ever (the whole namespace added) nulls its keys, never the namespace', async () => {
    const { beforeValues, inverseUpdate } = await import('../rules/index.ts');
    const a = flagged({ name: 'Bare' }, { synthetic: true });
    delete a._delta.sr2e; a.flags = {};
    const change = { flags: { sr2e: { broken: true } } };
    const fields = beforeValues({ flags: a.flags }, change);
    await a.update({ 'flags.sr2e.broken': true });
    const inv = deltaSafeUpdate(a, inverseUpdate(fields));
    assert.equal('flags.sr2e' in inv, false, JSON.stringify(inv));
    await a.update(inv);
    assert.equal(a.getFlag('sr2e', 'broken') ?? undefined, undefined);
    assert.ok(a._delta.sr2e && typeof a._delta.sr2e === 'object', 'the namespace stays an object');
  });
  test('an undone flag on a synthetic actor reads as not set', async () => {
    const a = synth();
    await a.setFlag('sr2e', 'broken', true);
    await a.update(deltaSafeUpdate(a, { 'flags.sr2e.-=broken': null }));
    assert.equal(a.getFlag('sr2e', 'broken') ?? undefined, undefined);
  });
});

// ============================================================================================ Glue: SR2Actor on a synthetic actor

let SR2Actor: any, CharacterDataModel: any;

before(async () => {
  (RULES.DISASTERS as any).prompt = false;
  (RULES.WAITING as any).enabled = false;
  g.foundry = {
    abstract: { TypeDataModel: class {} },
    data: { fields: new Proxy({}, { get: () => class { constructor(..._a: any[]) {} } }) },
    utils: {
      randomID: () => Math.random().toString(36).slice(2, 12), deepClone: clone, flattenObject: (o: any) => o,
      getProperty: (o: any, p: string) => p.split('.').reduce((x: any, k: string) => x?.[k], o),
      setProperty: (o: any, p: string, v: unknown) => { applyPath(o, p, v); return true; },
    },
    applications: { api: { DialogV2: { confirm: async () => false, prompt: async () => null, wait: async () => null } } },
  };
  g.ChatMessage = { create: async (d: any) => { chat.push(d); return { id: `m${chat.length}`, ...d }; }, getSpeaker: () => ({}) };
  g.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
  g.game = { i18n: { localize: (k: string) => k }, user: { id: 'gm1', isGM: true }, users: [], time: { worldTime: 0 }, settings: { get: () => undefined, set: async () => {}, register: () => {} }, actors: [], messages: { contents: [] } };
  g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
  g.fromUuid = async (u: string) => uuidRegistry.get(u) ?? null;
  g.ui = { notifications: { warn: (m: string) => { warnings.push(m); }, info: () => {}, error: () => {} } };
  g.Actor = class { items: any[] = []; system: any; flags: any = {}; isOwner = true; };
  g.Item = class {};
  g.Combatant = class {};
  g.Combat = class {};
  ({ CharacterDataModel } = await import('../models/index.ts'));
  ({ SR2Actor } = await import('../documents/index.ts'));
  g.CONFIG = { Actor: { documentClass: SR2Actor } };
});

beforeEach(() => { chat.length = 0; warnings.length = 0; delete g.game.combat; g.game.time = { worldTime: 0 }; });

let n = 0;
/** A character on the real data model with the flag model above (synthetic by default: an unlinked token's actor). */
function token(base: Record<string, any> = {}, o: { synthetic?: boolean } = { synthetic: true }): any {
  const sys = Object.create(CharacterDataModel.prototype);
  sys.attributes = Object.fromEntries(['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'].map((k) => [k, { base: 4, mod: 0 }]));
  Object.assign(sys, { essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 10, career: 10 }, metamagic: {}, initiateGrade: 0, nuyen: 100,
    sustaining: [], drugs: [], geasa: [], ledger: [], recovering: [], diseases: [], care: { stabilised: false, dyingSince: -1 }, contacts: [], addictions: [], anchored: [], qualities: [],
    lifestyle: { level: 'low', paidUntil: -1, outright: false }, training: [], metatype: 'human', racialModifiers: true, poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 },
    monitor: { physical: 0, stun: 0 }, rigging: { vehicleUuid: '', jumpedIn: false, subscribed: [] } });
  const a = new SR2Actor();
  a.system = sys; a.name = 'Ganger'; a.type = 'character'; a.uuid = `Scene.s.Token.t${++n}.Actor.a`; a.id = `a${n}`;
  a.items = Object.assign([], { get: () => undefined });
  a.statuses = new Set<string>();
  flagged(a, { synthetic: o.synthetic !== false, base });
  if (o.synthetic === false) Object.assign(a.flags.sr2e, clone(base));
  sys.parent = a; sys.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}

describe('glue: flags cleared on an unlinked token stay cleared', () => {
  test('delaying: Act now clears "delayed" and Done clears "acting now"', async () => {
    const a = token();
    g.game.combat = { started: true, id: 'c1', round: 1, pass: 1, combatant: { actor: a }, nextTurn: async () => {} };
    assert.equal(await a.delayAction(), true);
    assert.equal(a.isDelaying(), true);
    assert.equal(await a.actNow(), true);
    assert.equal(a.isDelaying(), false);
    assert.equal(a.actingNow(), true);
    await a.endDelayedAction();
    assert.equal(a.actingNow(), false);
    assert.equal(await a.actNow(), false, 'no second delayed action from a stale flag');
  });
  test('live fix: two Act now clicks at once take the delayed action once (one card)', async () => {
    const a = token();
    g.game.combat = { started: true, id: 'c1', round: 1, pass: 1, combatant: { actor: a }, nextTurn: async () => {} };
    await a.delayAction();
    const before = chat.length;
    const rs = await Promise.all([a.actNow(), a.actNow()]);
    assert.deepEqual(rs.sort(), [false, true]);
    assert.equal(chat.slice(before).filter((m: any) => /delayed action now/.test(String(m.content))).length, 1);
    assert.equal(await a.actNow(), false);
  });
  test('a hold let go: heldBy and heldStatus both clear (heldStatus false too)', async () => {
    const t = token();
    await SR2Actor.setHeld(t, 'Actor.holder', true);
    assert.equal(t.getFlag('sr2e', 'heldBy'), 'Actor.holder');
    assert.equal(t.getFlag('sr2e', 'heldStatus'), true);
    await SR2Actor.setHeld(t, 'Actor.holder', false);
    assert.equal(t.getFlag('sr2e', 'heldBy') ?? undefined, undefined);
    assert.equal(t.getFlag('sr2e', 'heldStatus') ?? undefined, undefined);
    // Prone already when grabbed: heldStatus is false, and it still goes.
    t.statuses.add(RULES.COMBAT.hold.status);
    await SR2Actor.setHeld(t, 'Actor.holder', true);
    assert.equal(t.getFlag('sr2e', 'heldStatus'), false);
    await SR2Actor.setHeld(t, 'Actor.holder', false);
    assert.equal(t.getFlag('sr2e', 'heldStatus') ?? undefined, undefined);
  });
  test('an astral quest ended stays ended', async () => {
    const a = token();
    await a.startQuest({ name: 'Q', stages: 2, targetNumber: 4 });
    assert.ok(a.quest());
    await a.endQuest();
    assert.equal(a.quest(), null);
  });
  test('a project given up leaves the list, even one the base actor carries', async () => {
    const p = (id: string) => ({ id, label: `Job ${id}`, kind: 'gear', startedAt: 0, readyAt: 3600, hours: 1, paid: { karma: 0, nuyen: 0 }, effect: { call: { method: 'finishDesign', args: [] } } });
    const a = token({ projects: { base: p('base') } });
    await a.update({ 'flags.sr2e.projects.own': p('own') });
    assert.deepEqual(a.projects().map((x: any) => x.id).sort(), ['base', 'own']);
    assert.equal(await a.cancelProject('own'), true);
    assert.equal(await a.cancelProject('base'), true);
    assert.deepEqual(a.projects(), []);
  });
  test('focus addiction cleared by the GM reads as gone, own or inherited from the base actor', async () => {
    for (const a of [token({ focusAddict: true }), token()]) {
      if (!a.getFlag('sr2e', 'focusAddict')) await a.setFlag('sr2e', 'focusAddict', true);
      await a.clearFocusAddiction();
      assert.equal(Boolean(a.getFlag('sr2e', 'focusAddict')), false);
    }
  });
  test('the old unsetFlag way still leaves it set on this stub (so the tests above would catch a revert)', async () => {
    const a = token();
    await a.setFlag('sr2e', 'focusAddict', true);
    await a.unsetFlag('sr2e', 'focusAddict');
    assert.equal(a.getFlag('sr2e', 'focusAddict'), true);
  });
  test('a linked character still gets the key deleted (nothing null left behind)', async () => {
    const a = token({}, { synthetic: false });
    await a.startQuest({ name: 'Q', stages: 2, targetNumber: 4 });
    await a.endQuest();
    assert.equal('quest' in a.flags.sr2e, false);
  });
});

describe('review fix: a build with only null columns counts as no build', () => {
  test('buildRowsFor', async () => {
    const { buildRowsFor } = await import('../applications/buildinput.ts');
    const a = token();
    await a.update({ 'flags.sr2e.build': { A: null, B: null } });
    assert.deepEqual(buildRowsFor(a), []);
  });
});

describe('glue: the approval queue drops requests on an unlinked token', () => {
  test('dropRequest', async () => {
    const { requestsOf, dropRequest } = await import('../applications/approvals.ts');
    const a = token();
    await a.update({ 'flags.sr2e.requests.r1': { id: 'r1', at: 1, kind: 'improve', label: 'x' }, 'flags.sr2e.requests.r2': { id: 'r2', at: 2, kind: 'improve', label: 'y' } });
    await dropRequest(a, 'r1');
    assert.deepEqual(requestsOf(a).map((r: any) => r.id), ['r2']);
  });
});

// ============================================================================================ The sweep stays swept

describe('source sweep', () => {
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : files(join(dir, e.name))) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []));
  const src = files(join(process.cwd(), 'src', 'module'));
  test('no unsetFlag on actors: only chat messages call it (and the helper)', () => {
    const hits = src.flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l })).filter((x) => /\.unsetFlag\(/.test(x.l)));
    const bad = hits.filter((x) => !x.f.endsWith(join('helpers', 'flags.ts')) && !/message\.unsetFlag/.test(x.l));
    assert.deepEqual(bad.map((x) => `${x.f}:${x.i}`), []);
  });
  test('no hand-written `-=` flag deletions on actors (walls and drawings only)', () => {
    const hits = src.flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l })).filter((x) => /flags\.\$\{SYSTEM(_ID|\.id)\}\.[\w.${}]*-=/.test(x.l)));
    const bad = hits.filter((x) => !/breached|barrierFull|fuel/.test(x.l));
    assert.deepEqual(bad.map((x) => `${x.f}:${x.i}`), []);
  });
  test('the key-dropping writes use replaceFlag, and undo makes its inverse delta-safe', () => {
    const idx = read('src', 'module', 'documents', 'index.ts');
    assert.match(idx, /replaceFlag\(this, 'repeatPower'/);
    assert.match(idx, /replaceFlag\(this, 'build'/);
    assert.match(read('src', 'module', 'applications', 'sheets.ts'), /replaceFlag\(actor, "build"/);
    assert.match(read('src', 'module', 'applications', 'undo.ts'), /deltaSafeUpdate\(doc, inverseUpdate\(/);
  });
});
