/**
 * v0.92.3 book alignment, the Matrix: the Foundry glue (documents/index.ts, models/index.ts) for RULES.MATRIX_V923:
 * opposed system tests, a passive alert, the jackpoint on Access tests, the persona's Reaction, cybercombat by the
 * security code, IC resisting with the Security Value, crashing IC onto the tally, black IC on the decker, dump shock
 * on a jack-out, Graceful Logoff, Locate File and paydata. Each with the switch giving the v0.92.2 result. The stubs
 * are a copy of v073.test.ts's (scripted dice, a chat log, warnings). These check OUR wiring, not Foundry.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { matrix922 } from './helpers/matrix922.ts';
const g = globalThis as any;
const faces: number[] = [];
const chat: any[] = [];
const warnings: string[] = [];
const infos: string[] = [];
const uuidRegistry = new Map<string, any>();
const created: any[] = [];
const hooks = new Map<string, Array<(...a: any[]) => any>>();
let settings: Record<string, unknown> = {};
let mid = 0;

class StubRoll {
  formula: string;
  dice: any[] = [];
  total = 0;
  constructor(formula: string) { this.formula = formula; }
  async evaluate() {
    const m = /^(\d+)d6(?:\s*\+\s*(\d+))?$/.exec(this.formula);
    if (!m) throw new Error(`unexpected formula ${this.formula}`);
    const n = Number(m[1]);
    const results = Array.from({ length: n }, () => {
      const f = faces.shift();
      if (f === undefined) throw new Error('out of scripted faces');
      return { result: f };
    });
    this.dice = [{ results }];
    this.total = results.reduce((a, r) => a + r.result, 0) + Number(m[2] ?? 0);
    return this;
  }
}

function setPath(obj: any, path: string, value: unknown) {
  const parts = path.split('.');
  let o = obj;
  for (const p of parts.slice(0, -1)) o = (o[p] ??= {});
  const last = parts[parts.length - 1] as string;
  if (last.startsWith('-=')) delete o[last.slice(2)]; else o[last] = value;
}
function flatten(o: any, pre = '', out: Record<string, unknown> = {}) {
  for (const [k, v] of Object.entries(o ?? {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) flatten(v, `${pre}${k}.`, out); else out[`${pre}${k}`] = v;
  }
  return out;
}
let CharacterDataModel: any, IcDataModel: any, HostDataModel: any, SR2Actor: any;

const GM = () => ({ id: 'gm1', name: 'GM', isGM: true, can: () => true });

/** A chat message as Foundry gives it back: an id and getFlag. */
const asMessage = (d: any) => ({ id: `m${++mid}`, timestamp: mid, ...d, getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; }, async setFlag(s: string, k: string, v: any) { ((this.flags ??= {})[s] ??= {})[k] = v; } });

before(async () => {
  // As in glue.test.ts and v072.test.ts: rules that add steps or prompts are off unless a test turns them on.
  (RULES.DISASTERS as any).prompt = false;
  (RULES.MAGIC_V39.ritualStages as any).enabled = false;
  (RULES.MAGIC_V39.sites as any).enforce = 'off';
  (RULES.MAGIC_V39.domains as any).enforce = 'off';
  (RULES.MAGIC_V56.learning as any).enabled = false;
  (RULES.WAITING as any).enabled = false;
  g.foundry = {
    abstract: { TypeDataModel: class {} },
    data: { fields: new Proxy({}, { get: () => class { constructor(..._a: any[]) {} } }) },
    utils: {
      randomID: () => Math.random().toString(36).slice(2, 12), deepClone: (o: any) => JSON.parse(JSON.stringify(o)), flattenObject: flatten,
      getProperty: (o: any, p: string) => p.split('.').reduce((x: any, k: string) => x?.[k], o),
      setProperty: (o: any, p: string, v: unknown) => { setPath(o, p, v); return true; },
    },
    applications: { api: { DialogV2: { confirm: async () => false, prompt: async () => null, wait: async () => null } } },
  };
  g.Roll = StubRoll;
  g.ChatMessage = { create: async (d: any) => { const m = asMessage(d); chat.push(m); return m; }, getSpeaker: () => ({}) };
  g.Hooks = { on: (h: string, fn: any) => { if (!hooks.has(h)) hooks.set(h, []); hooks.get(h)!.push(fn); }, once: () => {}, callAll: () => {} };
  g.game = {
    i18n: { localize: (k: string) => k }, user: GM(), users: Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } }),
    time: { worldTime: 0 }, settings: { get: (_s: string, k: string) => settings[k], set: async () => {}, register: () => {} },
    actors: [], messages: { contents: [] },
  };
  g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
  g.fromUuid = async (u: string) => uuidRegistry.get(u) ?? null;
  g.ui = { notifications: { warn: (m: string) => { warnings.push(m); }, info: (m: string) => { infos.push(m); }, error: () => {} } };
  g.Actor = class {
    items: any[] = []; system: any; flags: any = {}; isOwner = true; ownership: any = { default: 0 };
    getFlag(scope: string, key: string) { return this.flags[scope]?.[key]; }
    async setFlag(scope: string, key: string, v: any) { (this.flags[scope] ??= {})[key] = v; }
    async unsetFlag(scope: string, key: string) { if (this.flags[scope]) delete this.flags[scope][key]; }
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); this.system.parent ??= this; this.system.prepareDerivedData?.(); }
    async createEmbeddedDocuments(_t: string, docs: any[]) { let n = this.items.length; const made = docs.map((d) => ({ id: `i${n++}`, ...d, system: { ...d.system } })); this.items.push(...made); this.system.prepareDerivedData?.(); return made; }
    async updateEmbeddedDocuments(_t: string, ups: any[]) { for (const u of ups) { const it = this.items.find((i) => i.id === u._id); if (it) Object.assign(it.system, u.system); } this.system.prepareDerivedData?.(); }
  };
  (g.Actor as any).implementation = { create: async (d: any) => { created.push(d); return { uuid: `Actor.made${created.length}`, ...d }; } };
  g.Item = class {};
  g.Combatant = class { actor: any; };
  g.Combat = class { combatants: any[] = []; flags: any = {}; getFlag(_s: string, k: string) { return this.flags[k]; } async setFlag(_s: string, k: string, v: any) { this.flags[k] = v; } };
  ({ CharacterDataModel, IcDataModel, HostDataModel } = await import('../models/index.ts'));
  ({ SR2Actor } = await import('../documents/index.ts'));
  g.CONFIG = { Actor: { documentClass: SR2Actor } };
});

beforeEach(() => {
  faces.length = 0; chat.length = 0; warnings.length = 0; infos.length = 0; created.length = 0; settings = {};
  hooks.clear();
  g.game.user = GM();
  g.game.users = Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } });
  g.game.time = { worldTime: 0 };
  g.game.actors = [];
  g.game.messages = { contents: [] };
  delete g.game.combat;
  delete g.game.combats;
  delete g.game.scenes;
});

const A = { body: 4, quickness: 5, strength: 4, charisma: 4, intelligence: 5, willpower: 5 };
const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
let n = 0;

/** A character (or NPC) on the real data model, registered for fromUuid. */
function who(extra: any = {}, items: any[] = [], attrs: Record<string, number> = A): any {
  const sys = Object.create(CharacterDataModel.prototype);
  sys.attributes = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, { base: v, mod: 0 }]));
  const { name, type, flags, ...rest } = extra;
  Object.assign(sys, {
    essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 30, career: 30 }, metamagic: {}, initiateGrade: 0,
    nuyen: 0, sustaining: [], drugs: [], geasa: [], ledger: [], recovering: [], diseases: [], care: { stabilised: false, dyingSince: -1 }, contacts: [],
    addictions: [], anchored: [], qualities: [], lifestyle: { level: 'low', paidUntil: -1, outright: false }, training: [], metatype: 'human', racialModifiers: true,
    poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, monitor: { physical: 0, stun: 0 }, rigging: { vehicleUuid: '', jumpedIn: false, subscribed: [] }, ...rest,
  });
  const a = new SR2Actor();
  a.system = sys;
  a.name = name ?? 'Runner'; a.type = type ?? 'character';
  a.uuid = `Actor.v923-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness', more: any = {}) => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, ...more } });
/** A decker with a deck (as glue.test.ts's v0.28.0 decker). */
const D = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 6, willpower: 5 };
function decker(matrix: any = {}): any {
  return who({ name: 'Decker', matrix: { jackedIn: false, hostUuid: '', monitor: 0, sim: 'cold', connection: 'jackpoint', crippled: { bod: 0, evasion: 0, masking: 0, sensors: 0 }, passed: [],
    trace: { active: false, icUuid: '', icName: '', mode: 'dump', rating: 0, hostUuid: '', round: -1, worldTime: -1 }, numbers: [], knownHosts: [], engagedBy: [], maneuvers: [], ...matrix } }, [
    skill('comp', 'Computer', 5, 'intelligence'),
    { id: 'deck', type: 'cyberdeck', name: 'Deck', system: { active: true, mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 1, activeMemory: 400, storageMemory: 500, ioSpeed: 100, files: [] } },
    { id: 'de', type: 'program', name: 'Deception', system: { kind: 'deception', rating: 2, size: 0, loaded: true } },
  ], D);
}
/** A host, LTG or RTG on the real data model. */
function node(name: string, gridKind = 'host', parentUuid = '', extra: any = {}): any {
  const h = new SR2Actor();
  const sys = Object.create(HostDataModel.prototype);
  Object.assign(sys, { gridKind, parentUuid, securityCode: 'orange', securityValue: 4, ltgNumber: '', subsystems: { access: 5, control: 5, index: 5, files: 5, slave: 5 }, tally: 0, alert: 'none', sheaf: [],
    files: [], bombs: [], ...extra });
  sys.prepareDerivedData();
  Object.assign(h, { type: 'host', name, uuid: `Actor.v923host-${++n}`, system: sys, items: withGet([]) });
  sys.parent = h;
  uuidRegistry.set(h.uuid, h);
  return h;
}
/** A node's Security Value 4 detection roll: nothing. */
const noDetect = () => faces.push(1, 1, 1, 1);

/** IC on the real data model, in a host. */
function icIn(host: any, extra: any = {}): any {
  const a = new SR2Actor();
  const sys = Object.create(IcDataModel.prototype);
  Object.assign(sys, { rating: 6, category: 'white', icType: 'Killer', damageLevel: 'M', damageType: 'physical', initiativeDice: 0, hostUuid: host.uuid, kind: 'ic', ownerUuid: '', smart: false,
    behavior: 'killer', guards: '', traceMode: 'dump', payload: '', attribute: 'evasion', party: '', construct: [], matrix: { monitor: 0 }, ...extra });
  Object.assign(a, { type: 'ic', name: extra.name ?? `Killer ${sys.rating}`, uuid: `Actor.v923ic-${++n}`, id: `ic${n}`, system: sys, items: withGet([]), statuses: new Set<string>() });
  sys.parent = a; sys.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
/** A host that can be written (tallies, files). */
function host(extra: any = {}): any {
  const h = node('Host', 'host', '', { tallies: [], ...extra });
  Object.assign(h, { isOwner: true, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(h, k, v); h.system.prepareDerivedData(); } });
  return h;
}
const attackProg = { id: 'atk', type: 'program', name: 'Attack', system: { kind: 'attack', rating: 4, size: 0, loaded: true, damageLevel: 'M' } };
/** A decker jacked in to a host (with an attack utility). */
function inside(h: any, matrix: any = {}): any {
  const d = decker({ jackedIn: true, hostUuid: h.uuid, ...matrix });
  d.items.push({ ...attackProg, system: { ...attackProg.system }, parent: d, async update(x: any) { for (const [k, v] of Object.entries(x)) setPath(this, k, v); d.system.prepareDerivedData(); } });
  d.system.prepareDerivedData();
  return d;
}
const text = () => chat.map((m) => String(m.content ?? '')).join('\n');

describe('v0.92.3 Matrix glue: the persona and system tests', () => {
  test('the persona\'s Reaction is the decker\'s own + 2 per counted Response Increase (switch: Intelligence + 2)', () => {
    const d = decker();
    assert.equal(d.system.derived.matrix.reaction, 7);
    const undo = matrix922();
    try { d.system.prepareDerivedData(); assert.equal(d.system.derived.matrix.reaction, 8); } finally { undo(); d.system.prepareDerivedData(); }
  });

  test('an opposed system test: equal successes fail; the switch lets 1+ succeed', async () => {
    const h = host();
    const d = inside(h);
    g.game.actors = [d];
    faces.push(5, 5, 1, 1, /* decker */ 5, 5, 1, 1, 1);
    await d.systemTest('', { operationId: 'analyzeSecurity' });
    assert.match(text(), /Analyze security fails\./);
    chat.length = 0;
    const undo = oldWay({ 'MATRIX_V923.systemTests': 'success' });
    try {
      faces.push(5, 5, 1, 1, 5, 5, 1, 1, 1);
      await d.systemTest('', { operationId: 'analyzeSecurity' });
      assert.match(text(), /Analyze security succeeds/);
    } finally { undo(); }
  });

  test('a passive alert adds 2 to the subsystem; the jackpoint modifies Access tests only', async () => {
    const h = host({ alert: 'passive' });
    const d = inside(h, { connection: 'legal' });
    g.game.actors = [d];
    noDetect(); faces.push(1, 1, 1, 1, 1);
    const r = await d.systemTest('', { operationId: 'analyzeSecurity' });
    assert.equal(r.targetNumber, 7);
    assert.ok(!r.modifiers.some((m: any) => m.id === 'jackpoint'));
    const h2 = host();
    const d2 = decker({ connection: 'legal' });
    d2.system.matrix.jackedIn = true; d2.system.prepareDerivedData();
    g.game.actors = [d2];
    noDetect(); faces.push(1, 1, 1, 1, 1);
    const r2 = await d2.systemTest('', { operationId: 'logon', targetUuid: h2.uuid });
    assert.ok(r2.modifiers.some((m: any) => m.id === 'jackpoint' && m.value === -2));
  });

  test('review fix: the v0.92.2 connections add a cellular link\'s +1 to a logon once, not twice', async (t) => {
    t.after(oldWay({ 'MATRIX_V923.connections': 'v922' }));
    const h = host();
    const d = decker({ connection: 'cellular' });
    d.system.matrix.jackedIn = true; d.system.prepareDerivedData();
    g.game.actors = [d];
    noDetect(); faces.push(1, 1, 1, 1, 1);
    const r = await d.systemTest('', { operationId: 'logon', targetUuid: h.uuid });
    assert.equal(r.modifiers.filter((m: any) => /Cellular/.test(String(m.label))).length, 1);
  });

  test('Locate File adds up net successes: a file every 5 (switch: a file per success)', async () => {
    const files = [1, 2, 3].map((i) => ({ id: `f${i}`, name: `File ${i}`, size: 10, value: 0, paydata: false, encrypted: 0, scramble: 0, foundBy: [] }));
    const h = host({ files });
    const d = inside(h);
    g.game.actors = [d];
    noDetect(); faces.push(5, 5, 5, 1, 1);
    await d.systemTest('', { operationId: 'locateFile' });
    assert.equal(h.system.files.filter((f: any) => f.foundBy.includes(d.uuid)).length, 0);
    noDetect(); faces.push(5, 5, 5, 1, 1);
    await d.systemTest('', { operationId: 'locateFile' });
    assert.equal(h.system.files.filter((f: any) => f.foundBy.includes(d.uuid)).length, 1);
    const undo = oldWay({ 'MATRIX_V923.operations': 'v922' });
    try {
      const h3 = host({ files: files.map((f) => ({ ...f, foundBy: [] })) });
      const d3 = inside(h3);
      g.game.actors = [d3];
      noDetect(); faces.push(5, 5, 1, 1, 1);
      await d3.systemTest('', { operationId: 'locateFile' });
      assert.equal(h3.system.files.filter((f: any) => f.foundBy.includes(d3.uuid)).length, 2);
    } finally { undo(); }
  });

  test('Graceful Logoff leaves the Matrix with no dump shock (switch: to the parent grid)', async () => {
    const h = host();
    const d = inside(h);
    g.game.actors = [d];
    noDetect(); faces.push(5, 5, 1, 1, 1);
    await d.systemTest('', { operationId: 'gracefulLogoff' });
    assert.equal(d.system.matrix.jackedIn, false);
    assert.doesNotMatch(text(), /Resist dump shock/);
    const undo = oldWay({ 'MATRIX_V923.logoff': 'v922' });
    try {
      const d2 = inside(h);
      g.game.actors = [d2];
      noDetect(); faces.push(5, 5, 1, 1, 1);
      await d2.systemTest('', { operationId: 'gracefulLogoff' });
      assert.equal(d2.system.matrix.jackedIn, true);
    } finally { undo(); }
  });

  test('jacking out without a Graceful Logoff: dump shock, softened by a cool deck (switch: free)', async () => {
    const h = host({ securityCode: 'red', securityValue: 6 });
    const d = inside(h);
    g.game.actors = [d];
    await d.jackOut();
    assert.equal(d.system.matrix.jackedIn, false);
    assert.match(text(), /Resist dump shock \(Willpower vs 4, S\)/);
    chat.length = 0;
    const undo = oldWay({ 'MATRIX_V923.dumpShock': 'v922' });
    try {
      const d2 = inside(h);
      g.game.actors = [d2];
      await d2.jackOut();
      assert.doesNotMatch(text(), /Resist dump shock/);
    } finally { undo(); }
  });

  test('paydata: a 5,000¥ point per file, 2D6 × 20 Mp on Blue (switch: per Mp)', async () => {
    const h = host({ securityCode: 'blue', securityValue: 4 });
    faces.push(3, /* file 1 */ 3, 4, 6, /* file 2 */ 1, 1, 2);
    assert.equal(await SR2Actor.generatePaydata(h), 2);
    assert.deepEqual(h.system.files.map((f: any) => [f.size, f.value]), [[140, 5000], [40, 5000]]);
    const undo = oldWay({ 'MATRIX_V923.paydata': 'v922' });
    try {
      const h2 = host({ securityCode: 'blue', securityValue: 4 });
      faces.push(3, 3, 4, 6, 1, 1, 2);
      await SR2Actor.generatePaydata(h2);
      assert.deepEqual(h2.system.files.map((f: any) => f.size), [35, 10]);
    } finally { undo(); }
  });
});

describe('v0.92.3 Matrix glue: cybercombat and IC', () => {
  test('a decker attacks with the utility\'s rating vs the TN by code and status (switch: Computer vs the IC\'s rating)', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    faces.push(1, 1, 1, 1);
    const r = await d.matrixAttack({ targetUuid: ic.uuid, programId: 'atk' });
    assert.deepEqual([r.totalDice, r.targetNumber], [4, 5]);
    const undo = oldWay({ 'MATRIX_V923.cybercombat': 'v922' });
    try {
      faces.push(1, 1, 1, 1, 1);
      const r2 = await d.matrixAttack({ targetUuid: ic.uuid, programId: 'atk' });
      assert.deepEqual([r2.totalDice, r2.targetNumber], [5, 6]);
    } finally { undo(); }
  });

  test('IC resist with the Security Value, and crashing them raises the attacker\'s tally by the rating', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    faces.push(1, 1, 1, 1);
    await ic.resistMatrixDamage({ targetUuid: ic.uuid, melee: false, damageType: 'physical', power: 6, level: 'D', matrix: true, matrixAttacker: d.uuid });
    assert.match(text(), /Security Value 4/);
    assert.equal(ic.system.derived.crashed, true);
    assert.equal(h.system.tallies.find((t: any) => t.key === d.uuid)?.tally, 6);
  });

  test('IC attack a persona by the code TN with the Security Value\'s dice and the code\'s damage level', async () => {
    const h = host({ securityCode: 'red', securityValue: 7 });
    const ic = icIn(h, { damageLevel: 'L' });
    const d = inside(h);
    g.game.actors = [d, ic];
    faces.push(1, 1, 1, 1, 1, 1, 1);
    const r = await ic.icAttack({ targetUuid: d.uuid });
    assert.deepEqual([r.totalDice, r.targetNumber], [7, 3]);
    assert.match(text(), /6S/);
  });

  test('black IC: Body vs Power − Hardening, no Hacking Pool (switch: Willpower vs the Power)', async () => {
    const h = host();
    const d = inside(h);
    g.game.actors = [d];
    faces.push(1, 1, 1, 1);
    await d.resistMatrixDamage({ targetUuid: d.uuid, melee: false, damageType: 'physical', power: 6, level: 'S', matrix: true, black: true }, 2);
    assert.match(text(), /\(Body, Hardening 2\)|\(Body/);
    const undo = oldWay({ 'MATRIX_V923.blackIc': 'v922' });
    try {
      chat.length = 0;
      faces.push(1, 1, 1, 1, 1);
      await d.resistMatrixDamage({ targetUuid: d.uuid, melee: false, damageType: 'physical', power: 6, level: 'S', matrix: true, black: true });
      assert.match(text(), /\(Willpower/);
    } finally { undo(); }
  });
  test('review fix: with ICCM dice set back to 1 per rating, the book\'s black IC still adds none (no double count)', async (t) => {
    t.after(oldWay({ 'MATRIX.iccm.dicePerRating': 1 }));
    const h = host();
    const d = inside(h);
    d.items.push({ id: 'ic1', type: 'cyberware', name: 'ICCM biofeedback filter', system: { kind: 'iccm', rating: 1, essenceCost: 0.2, installed: true, bioware: false, grade: 'standard', attributes: {} } });
    d.system.prepareDerivedData();
    assert.ok(Number(d.system.derived.cyber.iccm) > 0);
    g.game.actors = [d];
    const before = faces.length;
    faces.push(...Array(20).fill(1));
    await d.resistMatrixDamage({ targetUuid: d.uuid, melee: false, damageType: 'physical', power: 6, level: 'S', matrix: true, black: true });
    const used = 20 + before - faces.length;
    faces.length = 0;
    assert.equal(used, Math.max(d.system.attributes.body.total, d.system.attributes.willpower.total));
  });
});

describe('v0.92.3 review fix: a re-resolved miss takes back the marks of the hit', () => {
  test('a black IC hit that a GM\'s TN change turns into a miss releases the hold it took', async () => {
    const h = host();
    const d = inside(h);
    const bl = icIn(h, { category: 'black', rating: 4, name: 'Black 4', damageType: 'stun' });
    g.game.actors = [d, bl];
    chat.length = 0;
    faces.push(5, 5, 5, 5, 5, 5, 5, 5, 5, 5);
    await bl.icAttack({ targetUuid: d.uuid });
    assert.deepEqual(d.system.matrix.engagedBy, [bl.uuid]);
    const card = chat.find((c: any) => c.flags?.sr2e?.test?.kind === 'attack' || c.flags?.sr2e?.test?.attack);
    assert.ok(card, chat.map((c: any) => JSON.stringify(c.flags?.sr2e?.test?.kind)).join(','));
    Object.assign(card, { author: g.game.user, async update(dd: any) { for (const [k, v] of Object.entries(dd)) setPath(this, k, v); }, async setFlag(this: any, sc: string, k: string, v: any) { ((this.flags ??= {})[sc] ??= {})[k] = v; } });
    await SR2Actor.retarget(card, { baseTargetNumber: 30, modifiers: [] });
    assert.deepEqual(d.system.matrix.engagedBy, []);
  });
});

describe('v0.92.3 review fix: party IC (VR2 p. 52)', () => {
  test('the party\'s modifiers count every program, a crashed one too', () => {
    const h = host();
    const a = icIn(h, { party: 'p1', name: 'A' }), b = icIn(h, { party: 'p1', name: 'B' }), c = icIn(h, { party: 'p1', name: 'C', matrix: { monitor: 10 } });
    g.game.actors = [a, b, c];
    assert.equal(c.system.derived.crashed, true);
    assert.equal(a.partyMembers().length, 2);
    assert.equal(a.partySize(), 3);
  });
});

describe('v0.92.3 Matrix glue: trace, psychotropic and gray IC', () => {
  test('trace IC hunt against the Trace Factor; the trace reports (switch: Evasion, its own mode)', async () => {
    const h = host();
    const tr = icIn(h, { behavior: 'trace', rating: 4, traceMode: 'dump', name: 'Trace 4' });
    const d = inside(h, { connection: 'device' });
    g.game.actors = [d, tr];
    faces.push(1, 1, 1, 1);
    const r = await tr.icAttack({ targetUuid: d.uuid });
    // Evasion 5 − 4 + the remote device's +4 = 5; from a legal jackpoint (−2) the minimum, 2.
    assert.equal(r.targetNumber, 5);
    d.system.matrix.connection = 'legal'; d.system.prepareDerivedData();
    faces.push(1, 1, 1, 1);
    assert.equal((await tr.icAttack({ targetUuid: d.uuid })).targetNumber, 2);
    faces.push(5, 5, 5, 5);
    await tr.icAttack({ targetUuid: d.uuid });
    assert.equal(d.system.matrix.trace.mode, 'report');
    const undo = oldWay({ 'MATRIX_V923.trace': 'v922' });
    try {
      faces.push(1, 1, 1, 1);
      const r2 = await tr.icAttack({ targetUuid: d.uuid });
      assert.equal(r2.targetNumber, 5);
    } finally { undo(); }
  });

  test('review fix: the datatrail card a player\'s jack-out makes is blind (GM only)', async () => {
    const h = host();
    const tr = icIn(h, { behavior: 'trace', rating: 4, traceMode: 'report', name: 'Trace 4' });
    const d = inside(h, { connection: 'legal' });
    g.game.actors = [d, tr];
    faces.push(5, 5, 5, 5);
    await tr.icAttack({ targetUuid: d.uuid });
    assert.equal(d.system.matrix.trace?.active, true);
    chat.length = 0;
    g.game.user = { id: 'p1', name: 'Player', isGM: false, can: () => true };
    faces.push(6, 6, 6, 6, 6, 6);
    try { await d.jackOut({ force: true }); } finally { g.game.user = GM(); }
    const card = chat.find((c: any) => /datatrail|Datatrail/.test(String(c.content)));
    assert.ok(card, chat.map((c: any) => c.content).join(' | '));
    assert.equal(card.blind, true);
  });

  test('review fix: a Judas card under the book says "until they recover", not billions of days', async () => {
    const d = decker();
    g.game.actors = [d];
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1, 1, 1, 1);
    await d.resistPsychotropic({ icName: 'Judas 5', rating: 5, kind: 'judas' });
    const all = chat.map((c: any) => String(c.content)).join(' | ');
    assert.match(all, /betray their team to the host's owners until they recover/);
    assert.doesNotMatch(all, /\d{6,}/);
  });

  test('psychotropic IC: the hit marks the decker; the test comes at the jack-out', async () => {
    const h = host({ securityValue: 4 });
    const ps = icIn(h, { behavior: 'psychotropic', category: 'black', damageType: 'stun', payload: 'cyberphobia', name: 'Cyberphobia 5', rating: 5 });
    const d = inside(h);
    g.game.actors = [d, ps];
    faces.push(5, 5, 5, 5);
    await ps.icAttack({ targetUuid: d.uuid });
    assert.doesNotMatch(text(), /data-sr2e-action="psychotropic"/);
    assert.equal(d.flags.sr2e?.psyche923?.length, 1);
    chat.length = 0;
    await d.jackOut({ force: true });
    assert.match(text(), /data-sr2e-action="psychotropic"/);
  });

  test('gray IC damage is permanent: no repair test (switch: the repair test)', async () => {
    const d = decker();
    d.items.get('deck').system.damage = { mpcp: 1, bod: 0, evasion: 0, masking: 0, sensors: 0 };
    assert.equal(await d.repairDeckTest(), null);
    assert.match(warnings.at(-1) ?? '', /replace its chip/);
  });
});

describe('v0.92.3 Matrix glue: defenses', () => {
  const attackOn = (d: any, ic: any, extra: any = {}) => ({ attackerUuid: ic.uuid, targetUuid: d.uuid, weaponName: ic.name, melee: false, damageType: 'physical', power: 6, level: 'S',
    attackSuccesses: 3, targetNumber: 4, matrix: true, matrixDice: 7, ic: { behavior: 'killer', icUuid: ic.uuid, icName: ic.name, rating: 6, category: 'white' }, ...extra });

  test('a loaded Shield parries: Shield dice vs the attacker\'s skill, and it loses a point (switch: it soaks)', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    d.items.push({ id: 'sh', type: 'program', name: 'Shield', parent: d, system: { kind: 'shield', rating: 4, size: 0, loaded: true }, async update(x: any) { for (const [k, v] of Object.entries(x)) setPath(this, k, v); } });
    g.game.actors = [d, ic];
    assert.equal(SR2Actor.matrixCanDefend(d, attackOn(d, ic)), true);
    faces.push(1, 1, 1, 1);
    await d.defend(attackOn(d, ic), 0);
    assert.match(text(), /Matrix defense \(Shield 4 vs 7\)/);
    assert.equal(d.items.get('sh').system.rating, 3);
    const undo = oldWay({ 'MATRIX_V923.shield': 'soak' });
    try { assert.equal(SR2Actor.matrixCanDefend(d, attackOn(d, ic)), false); } finally { undo(); }
  });

  test('a crippler is opposed by the persona program against its rating (switch: no roll)', async () => {
    const h = host();
    const ic = icIn(h, { behavior: 'crippler', attribute: 'bod', name: 'Acid 4', rating: 4 });
    const d = inside(h);
    g.game.actors = [d, ic];
    const a = attackOn(d, ic, { ic: { behavior: 'crippler', icUuid: ic.uuid, icName: ic.name, rating: 4, category: 'white', attribute: 'bod' } });
    assert.equal(SR2Actor.matrixCanDefend(d, a), true);
    faces.push(1, 1, 1, 1);
    await d.defend(a, 0);
    assert.match(text(), /Matrix defense \(Bod 4 vs 4\)/);
    const undo = oldWay({ 'MATRIX_V923.cybercombat': 'v922' });
    try { assert.equal(SR2Actor.matrixCanDefend(d, a), false); } finally { undo(); }
  });
});
