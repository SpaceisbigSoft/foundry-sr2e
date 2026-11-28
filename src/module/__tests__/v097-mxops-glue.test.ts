/**
 * v0.97.0 rules completeness, the Matrix's system operations (RULES.MXOPS_V97), behaviour through the real
 * documents/index.ts and applications/mxops97.ts with the stubs of v0923-matrix-glue.test.ts (scripted dice, a chat log,
 * warnings): Analyze Host an item per success, the new operations (Analyze Subsystem, Decoy, Dump Log, Locate Decker,
 * Scan Icon), Validate Passcode's level, days and the active alert, Slow and Restore the book's way, the question's
 * modifier and "not here"; and for each switch, that its other value gives the v0.96.5 behaviour at the read site.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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
  a.uuid = `Actor.v97o-${++n}`; a.id = `id${n}`;
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
  Object.assign(h, { type: 'host', name, uuid: `Actor.v97ohost-${++n}`, system: sys, items: withGet([]) });
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
  Object.assign(a, { type: 'ic', name: extra.name ?? `Killer ${sys.rating}`, uuid: `Actor.v97oic-${++n}`, id: `ic${n}`, system: sys, items: withGet([]), statuses: new Set<string>() });
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

// The new strings come from public/lang/en.json (english-lang.ts); until the lead merges the draft, from the draft.
const SID = 'shadowrun2e_unified';
const DRAFT = join(import.meta.dirname, '..', '..', '..', 'i18n-drafts', 'mxops97.json');
before(() => {
  const en = (globalThis as any).__SR2E_EN__ ?? ((globalThis as any).__SR2E_EN__ = {});
  if (existsSync(DRAFT)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(DRAFT, 'utf8')))) if (!(k in en)) en[k] = v;
});

/** A loaded program on an actor. */
function give(a: any, id: string, kind: string, rating: number): any {
  const p = { id, type: 'program', name: `${kind} ${rating}`, system: { kind, rating, size: 0, loaded: true }, parent: a,
    async update(x: any) { for (const [k, v] of Object.entries(x)) setPath(this, k, v); a.system.prepareDerivedData(); } };
  a.items.push(p);
  a.system.prepareDerivedData();
  return p;
}
/** The decker's 5 dice: `hits` successes against TN 5 (fives), the rest ones. */
const deckerRoll = (hits: number) => faces.push(...Array.from({ length: 5 }, (_, i) => (i < hits ? 5 : 1)));
/** Five dice with `hits` sixes that each re-roll to a 1 (7: a success up to TN 7). */
const sixes = (hits: number, n = 5) => { faces.push(...Array.from({ length: n }, (_, i) => (i < hits ? 6 : 1)), ...Array.from({ length: hits }, () => 1)); };

describe('v0.97.0 Analyze Host: an item per success (VR2 p. 111)', () => {
  test('one success: the Security Rating only, the code learned; switch: everything and the bombs', async () => {
    const h = host({ securityCode: 'red', securityValue: 4, bombs: [{ subsystem: 'files', rating: 5, pavlov: false, foundBy: [] }] });
    const d = inside(h);
    g.game.actors = [d];
    noDetect(); deckerRoll(1);
    await d.systemTest('', { operationId: 'analyzeHost' });
    assert.match(text(), /Security Rating <strong>Red-4<\/strong>/);
    assert.doesNotMatch(text(), /Access <strong>/);
    assert.equal(h.system.bombs[0].foundBy.length, 0, 'Analyze Host finds no data bomb');
    chat.length = 0;
    noDetect(); deckerRoll(2);
    await d.systemTest('', { operationId: 'analyzeHost', mx97: { first: 'files' } });
    assert.match(text(), /Files <strong>5<\/strong>, Security Rating/);
    chat.length = 0;
    const undo = oldWay({ 'MXOPS_V97.analyzeHost': 'v965' });
    try {
      noDetect(); deckerRoll(1);
      await d.systemTest('', { operationId: 'analyzeHost' });
      assert.match(text(), /Access 5, Control 5/);
      assert.equal(h.system.bombs[0].foundBy.length, 1);
    } finally { undo(); }
  });
});

describe('v0.97.0 the new system operations (VR2 pp. 111–117)', () => {
  test('Analyze Subsystem on the picked subsystem: its guarding IC and data bombs (found)', async () => {
    const h = host({ bombs: [{ subsystem: 'files', rating: 5, pavlov: false, foundBy: [] }] });
    const ic = icIn(h, { behavior: 'barrier', guards: 'files', name: 'Barrier 5', rating: 5 });
    const d = inside(h);
    g.game.actors = [d, ic];
    noDetect(); deckerRoll(1);
    const r = await d.systemTest('files', { operationId: 'analyzeSubsystem', force: true });
    assert.match(r.label ?? text(), /Files 5/);
    assert.match(text(), /Barrier 5/);
    assert.match(text(), /data bomb, rating 5/);
    assert.deepEqual(h.system.bombs[0].foundBy, [d.uuid]);
  });

  test('Decoy: the successes on the decker; an IC whose 1D6 is no higher hits the decoy', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    noDetect(); deckerRoll(3);
    await d.systemTest('', { operationId: 'decoy' });
    assert.deepEqual(d.flags[SID].decoy97, { hostUuid: h.uuid, successes: 3, boxes: 0 });
    chat.length = 0;
    faces.push(2);
    const r = await ic.icAttack({ targetUuid: d.uuid });
    assert.equal(r, null);
    assert.match(text(), /attacks Decker's decoy instead/);
    assert.equal(d.flags[SID].decoy97.boxes, 6, 'an Orange host: S, 6 boxes');
    chat.length = 0;
    faces.push(5, 1, 1, 1, 1);
    const r2 = await ic.icAttack({ targetUuid: d.uuid });
    assert.ok(r2, 'a 5 misses the decoy: the decker is attacked');
    assert.match(text(), /ignores Decker's decoy/);
  });

  test('switch: none of the new operations', async (t) => {
    t.after(oldWay({ 'MXOPS_V97.operations': 'v965' }));
    const h = host();
    const d = inside(h);
    g.game.actors = [d];
    const r = await d.systemTest('', { operationId: 'decoy' });
    assert.equal(r, null);
    assert.ok(warnings.length > 0);
  });

  test('Dump Log: the access log is a file the decker has found; once per host', async () => {
    const h = host({ securityValue: 4 });
    const d = inside(h);
    g.game.actors = [d];
    noDetect(); deckerRoll(1); faces.push(3, 4);
    await d.systemTest('', { operationId: 'dumpLog' });
    const f = h.system.files.find((x: any) => x.foundBy.includes(d.uuid));
    assert.ok(f);
    assert.equal(f.size, 3500, '2D6 7 × 5 (Easy) × 100 Mp');
    noDetect(); deckerRoll(1);
    await d.systemTest('', { operationId: 'dumpLog' });
    assert.equal(h.system.files.length, 1);
  });

  test('Locate Decker: a Sensor Test; deckers with Masking + sleaze at most its successes', async () => {
    const h = host();
    const d = inside(h);
    const low = inside(h); low.name = 'Low';
    const deck = low.items.find((i: any) => i.type === 'cyberdeck'); deck.system.masking = 2; low.system.prepareDerivedData();
    const high = inside(h); high.name = 'High';
    g.game.actors = [d, low, high];
    noDetect(); deckerRoll(1); faces.push(6, 6, 5, 1, 1, 1);
    await d.systemTest('', { operationId: 'locateDeckerOp' });
    assert.match(text(), /Located: <strong>Low<\/strong>/);
    assert.doesNotMatch(text(), /High/);
  });

  test('Scan Icon: Computer vs the icon\'s Masking, + its sleaze; an item per success', async () => {
    const h = host();
    const d = inside(h);
    give(d, 'sc', 'scanner', 2);
    const o = inside(h); o.name = 'Other';
    give(o, 'sl', 'sleaze', 3);
    g.game.actors = [d, o];
    noDetect(); sixes(2);
    const r = await d.systemTest('', { operationId: 'scanIcon', targetUuid: o.uuid });
    assert.equal(r.targetNumber, 6, 'Masking 5 − scanner 2 + sleaze 3');
    assert.match(text(), /Other: MPCP <strong>6<\/strong>, Bod <strong>4<\/strong>/);
    const none = await d.systemTest('', { operationId: 'scanIcon', targetUuid: '' });
    assert.equal(none, null);
  });
});

describe('v0.97.0 Validate Passcode (VR2 p. 118)', () => {
  test('supervisor +6 TN; 1D6 × net days; past them no longer Legitimate; an active alert deletes it', async () => {
    const h = host();
    const d = inside(h);
    g.game.actors = [d];
    // TN Control 5 + 6: two sixes that re-roll to fives (11).
    noDetect(); faces.push(6, 6, 1, 1, 1, 5, 5, /* 1D6 */ 3);
    const r = await d.systemTest('', { operationId: 'validatePasscode', mx97: { level: 'supervisor' } });
    assert.ok(r.modifiers.some((m: any) => m.id === 'passcodeLevel97' && m.value === 6));
    assert.deepEqual(h.system.validated, [d.uuid]);
    assert.match(text(), /lasts 6 days/);
    const G97 = await import('../applications/mxops97.ts');
    assert.equal(G97.passcodeLiveFor(d, h.uuid), true);
    g.game.time = { worldTime: 6 * 86400 };
    assert.equal(G97.passcodeLiveFor(d, h.uuid), false);
    g.game.time = { worldTime: 0 };
    await G97.alertPasscodes(h, 'active');
    assert.deepEqual(h.system.validated, []);
  });
  test('switch: no level modifier, no days', async (t) => {
    t.after(oldWay({ 'MXOPS_V97.validatePasscode': 'v965' }));
    const h = host();
    const d = inside(h);
    g.game.actors = [d];
    noDetect(); deckerRoll(2);
    const r = await d.systemTest('', { operationId: 'validatePasscode', mx97: { level: 'supervisor' } });
    assert.ok(!r.modifiers.some((m: any) => m.id === 'passcodeLevel97'));
    assert.doesNotMatch(text(), /days/);
    assert.equal(d.flags?.[SID]?.passcodes97, undefined);
  });
});

describe('v0.97.0 Slow and Restore (VR2 pp. 99–100)', () => {
  test('Slow: the rating vs the code TN, opposed by the Security Value vs the rating; not on reactive IC', async () => {
    const h = host();
    const ic = icIn(h);
    const probe = icIn(h, { behavior: 'probe', name: 'Probe 4' });
    const d = inside(h);
    const p = give(d, 'sl', 'slow', 4);
    g.game.actors = [d, ic, probe];
    assert.equal(await d.useUtility(p.id, { targetUuid: probe.uuid }), null);
    assert.match(warnings.join(' '), /reactive IC/);
    faces.push(1, 1, 1, 1, /* decker */ 5, 5, 5, 5);
    const r = await d.useUtility(p.id, { targetUuid: ic.uuid });
    assert.deepEqual([r.totalDice, r.targetNumber], [4, 5], 'Slow 4 vs Orange, the IC Legitimate: 5');
    assert.match(text(), /loses 2 action/);
  });
  test('switch: Computer vs the IC\'s rating', async (t) => {
    t.after(oldWay({ 'MXOPS_V97.slow': 'v965' }));
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    const p = give(d, 'sl', 'slow', 4);
    g.game.actors = [d, ic];
    faces.push(1, 1, 1, 1, 1);
    const r = await d.useUtility(p.id, { targetUuid: ic.uuid });
    assert.equal(r.targetNumber, 6);
  });
  test('Restore: vs the crippler\'s rating, a point per 2 successes, no wear', async () => {
    const h = host();
    const d = inside(h, { crippled: { bod: 2, evasion: 0, masking: 0, sensors: 0 } });
    d.flags = { [SID]: { crippledBy97: 6 } };
    const p = give(d, 'rs', 'restore', 5);
    g.game.actors = [d];
    sixes(4);
    const r = await d.useUtility(p.id, {});
    assert.equal(r.targetNumber, 6);
    assert.equal(d.system.matrix.crippled.bod, 0);
    assert.equal(p.system.rating, 5);
  });
  test('switch: TN 4, a point per success, it wears', async (t) => {
    t.after(oldWay({ 'MXOPS_V97.restore': 'v965' }));
    const h = host();
    const d = inside(h, { crippled: { bod: 2, evasion: 0, masking: 0, sensors: 0 } });
    const p = give(d, 'rs', 'restore', 5);
    g.game.actors = [d];
    faces.push(5, 1, 1, 1, 1);
    const r = await d.useUtility(p.id, {});
    assert.equal(r.targetNumber, 4);
    assert.equal(d.system.matrix.crippled.bod, 1);
    assert.equal(p.system.rating, 4);
  });
});

describe('v0.97.0 interrogations (VR2 p. 110)', () => {
  test('the question\'s modifier, and "not here" at 3 successes with nothing to find', async () => {
    const h = host({ files: [] });
    const d = inside(h);
    g.game.actors = [d];
    noDetect(); sixes(3);
    const r = await d.systemTest('', { operationId: 'locateFile', mx97: { query: 'vague' } });
    assert.ok(r.modifiers.some((m: any) => m.id === 'query97' && m.value === 1));
    assert.match(text(), /does not hold what is sought/);
  });
  test('switch: neither', async (t) => {
    t.after(oldWay({ 'MXOPS_V97.interrogation': 'v965' }));
    const h = host({ files: [] });
    const d = inside(h);
    g.game.actors = [d];
    noDetect(); deckerRoll(3);
    const r = await d.systemTest('', { operationId: 'locateFile', mx97: { query: 'vague' } });
    assert.ok(!r.modifiers.some((m: any) => m.id === 'query97'));
    assert.doesNotMatch(text(), /does not hold/);
  });
});
