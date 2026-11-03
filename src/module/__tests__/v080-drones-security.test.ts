/**
 * v0.80.0: the "SR2E Unified Rules Revamp" rules source, drones-security area, the Foundry glue side (documents/index.ts,
 * rules/roadwork.ts, rules/netrig.ts). Each hook under the Revamp (urrMode) and under the book. The pure rules are in
 * rules/__tests__/urr80-drones-security.test.ts. The stubs are a copy of v073.test.ts's (scripted dice, a chat log of message
 * objects with getFlag, warnings). These check OUR wiring, not that Foundry behaves as the stubs do.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { urrMode } from '../rules/__tests__/urrmode.ts';

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

let CharacterDataModel: any, VehicleDataModel: any, SiteDataModel: any, SR2Actor: any;

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
  ({ CharacterDataModel, VehicleDataModel, SiteDataModel } = await import('../models/index.ts'));
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
  a.uuid = `Actor.v80ds-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness', more: any = {}) => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, ...more } });

/** A vehicle on the real data model (as v071.test.ts's), with its weapons as items. */
function vehicle(extra: any = {}, weapons: any[] = []): any {
  const v = new SR2Actor();
  const sys = Object.create(VehicleDataModel.prototype);
  Object.assign(sys, { category: 'car', skill: '', drone: false, handling: 4, handlingOffroad: 8, speed: 100, accel: 10, body: 4, armor: 3, signature: 3, autonav: 2, pilot: 0, sensor: 4,
    ecm: 0, eccm: 0, ecd: 0, locks: [], chase: { quarryUuid: '', metres: 0 }, condition: 0, currentSpeed: 0, offroad: false, controllerUuid: '', controlMode: 'autopilot', occupants: [], mods: [],
    systems: { tires: false, engine: false, sensors: false }, jammed: { active: false, by: '', rating: 0 }, firmpoints: 0, hardpoints: 0, ...extra });
  Object.assign(v, { type: 'vehicle', name: extra.name ?? 'Americar', uuid: `Actor.v80dsveh-${++n}`, id: `veh${n}`, system: sys, statuses: new Set<string>() });
  v.items = withGet(weapons.map((w) => ({ ...w, system: { ...w.system }, parent: v, async update(d: any) { for (const [k, val] of Object.entries(d)) setPath(this, k, val); } })));
  sys.parent = v;
  sys.prepareDerivedData();
  uuidRegistry.set(v.uuid, v);
  return v;
}

/** A security site with devices (as v078.test.ts's). */
function site(devices: any[]): any {
  const s = new SR2Actor();
  const sys = Object.create(SiteDataModel.prototype);
  Object.assign(sys, { devices, tally: 0, alert: 'none', steps: [], response: { round: -1, worldTime: -1, arrived: false, force: '' }, riggerUuid: '', slaved: [], hostUuid: '', guards: [] });
  sys.prepareDerivedData?.();
  Object.assign(s, { type: 'site', name: 'Lab', uuid: `Actor.v80dssite-${++n}`, system: sys, items: withGet([]) });
  sys.parent = s;
  uuidRegistry.set(s.uuid, s);
  return s;
}
const dev = (id: string, extra: any = {}) => ({ id, name: id, kind: 'maglock', rating: 4, tokenUuid: '', sceneId: '', wallId: '', active: true, bypassed: false, scanKind: '', sense: '', tamper: 0, identifies: false, notes: '', casing: 0, casingOpen: false, lockType: '', ...extra });
const tool = (id: string, kind: string, rating: number) => ({ id, type: 'gear', name: id, system: { quantity: 1, bypassTool: { kind, rating } } });
const testTn = () => chat.filter((m) => m.flags?.sr2e?.test).at(-1)?.flags.sr2e.test.targetNumber;

describe('v0.80.0 drones-security: drone-link interception (dsLinkIntercept)', () => {
  const rcd = (r: number, extra: any = {}) => ({ id: `rcd${r}`, type: 'gear', name: `RCD ${r}`, system: { rcdRating: r, ...extra } });
  const setup = (link: any = null, hackerItems: any[] = [skill('el', 'Electronics', 4, 'intelligence'), rcd(4)]) => {
    const d = vehicle({ name: 'Roto-drone', drone: true, pilot: 3, autonav: 0, ...(link ? { link } : {}) });
    const rig = who({ name: 'Rigger', rigging: { vehicleUuid: '', jumpedIn: false, subscribed: [d.uuid] } }, [rcd(2)]);
    g.game.actors = [rig];
    return { d, rig, h: who({ name: 'Spoofer' }, hackerItems) };
  };
  test('book: the link skill vs the radio rule', async () => {
    const { d, h } = setup();
    faces.push(4, 1, 1, 1);
    assert.deepEqual(await h.interceptDroneLink(d.uuid), { intercepted: true });
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /4 dice vs TN <strong>4<\/strong>/);
  });
  test('Revamp: deck 4 vs the target deck 2 + 3; one success', async (t) => {
    t.after(urrMode());
    const { d, h } = setup();
    faces.push(5, 1, 1, 1);
    assert.deepEqual(await h.interceptDroneLink(d.uuid), { intercepted: true });
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /deck 4 vs remote control deck 2/);
    assert.match(chat.at(-1).content, /4 dice vs TN <strong>5<\/strong>/);
    assert.equal(d.system.link.intercepted.byUuid, h.uuid);
  });
  test('Revamp: an encrypted link is decrypted first; a failed decryption stops there', async (t) => {
    t.after(urrMode());
    const link = { encryption: 1, intercepted: { byUuid: '', by: '' }, spoofed: { active: false, byUuid: '', by: '' } };
    const { d, h } = setup(link, [skill('ew', 'Electronic Warfare', 3, 'intelligence'), rcd(4)]);
    faces.push(5, 1, 2);                                               // Electronic Warfare 3 vs 1 + 4: 1 (needs 1)
    faces.push(5, 1, 1, 1);                                            // deck 4 vs 2 + 3
    assert.deepEqual(await h.interceptDroneLink(d.uuid), { intercepted: true });
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /decrypts Roto-drone's link \(Electronic Warfare/);
    assert.match(chat.at(-1).content, /The encryption is broken/);
    const s2 = setup(link, [skill('ew', 'Electronic Warfare', 3, 'intelligence'), rcd(4)]);
    faces.push(2, 1, 2);
    assert.deepEqual(await s2.h.interceptDroneLink(s2.d.uuid), { intercepted: false });
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /The encryption holds/);
  });
  test('Revamp: a radio alone is not enough (a deck is needed)', async (t) => {
    t.after(urrMode());
    const { d, h } = setup(null, [skill('el', 'Electronics', 4, 'intelligence'), { id: 'rad', type: 'gear', name: 'Radio', system: { radio: { rating: 3 } } }]);
    assert.equal(await h.interceptDroneLink(d.uuid), null);
    assert.match(warnings.at(-1) ?? '', /needs a remote control deck to intercept/);
  });
});

describe('v0.80.0 drones-security: listening in on encrypted radio (dsRadioDecrypt)', () => {
  const pair = () => ({
    target: who({ name: 'Mark' }, [{ id: 'r', type: 'gear', name: 'Radio', system: { radio: { rating: 3, encryption: 2 } } }]),
    ear: who({ name: 'Ear' }, [skill('el', 'Electronics', 3, 'intelligence')]),
  });
  test('book: Electronics vs the encryption, at least 4', async () => {
    const { target, ear } = pair();
    faces.push(5, 1, 2);
    await ear.interceptComms(target.uuid);
    assert.equal(faces.length, 0);
    assert.equal(testTn(), 4);
  });
  test('Revamp: vs the encryption + 3, needing half the encryption', async (t) => {
    t.after(urrMode());
    const { target, ear } = pair();
    faces.push(5, 1, 2);
    await ear.interceptComms(target.uuid);
    assert.equal(faces.length, 0);
    assert.equal(testTn(), 5);
    assert.ok(chat.some((m) => /needs 1 success\)/.test(m.content ?? '') || /needs 1 success\)/.test(m.flags?.sr2e?.test?.label ?? '')));
  });
});

describe('v0.80.0 drones-security: maglocks (dsLockCasing, lockTypes, dsPasskey, dsSequencer)', () => {
  const thief = (items: any[] = []) => who({ name: 'Thief' }, [skill('br', 'Electronics B/R', 3, 'intelligence', { kind: 'buildRepair' }), skill('el', 'Electronics', 3, 'intelligence'), ...items]);
  test('a card reader casing: 3 under the book, doubled under the Revamp', async (t) => {
    faces.push(1, 1, 2);
    await thief().bypassLock(site([dev('lock', { lockType: 'card', casing: 3 })]), 'lock');
    assert.equal(testTn(), 3);
    t.after(urrMode());
    faces.push(1, 1, 2);
    await thief().bypassLock(site([dev('lock', { lockType: 'card', casing: 3 })]), 'lock');
    assert.equal(testTn(), 6);
    assert.equal(faces.length, 0);
  });
  test('a retinal scanner circuit: +3 under the book, +4 under the Revamp', async (t) => {
    faces.push(1, 1, 2);
    await thief().bypassLock(site([dev('lock', { lockType: 'retina' })]), 'lock');
    assert.equal(testTn(), 4 + 3 + RULES.SECURITY_V57.noToolsTn);
    t.after(urrMode());
    faces.push(1, 1, 2);
    await thief().bypassLock(site([dev('lock', { lockType: 'retina' })]), 'lock');
    assert.equal(testTn(), 4 + 4 + RULES.SECURITY_V57.noToolsTn);
    assert.equal(faces.length, 0);
  });
  test('a passkey: the lock TN + 2 under the book; the reader rating alone under the Revamp', async (t) => {
    const s = site([dev('lock', { lockType: 'card' })]);
    faces.push(1, 1, 2, 1, 1);
    await thief([tool('Key', 'passkey', 5)]).bypassLock(s, 'lock');
    assert.equal(testTn(), 6);
    t.after(urrMode());
    faces.push(4, 1, 2, 1, 1);
    await thief([tool('Key', 'passkey', 5)]).bypassLock(s, 'lock');
    assert.equal(testTn(), 4);
    assert.equal(faces.length, 0);
    assert.equal(s.system.devices[0].bypassed, true);
  });
  test('a sequencer: the rating as dice under the book; opposed against the keypad under the Revamp', async (t) => {
    const s1 = site([dev('lock', { lockType: 'keypad' })]);
    faces.push(4, 1, 1, 1, 1);
    await thief([tool('Seq', 'sequencer', 5)]).bypassLock(s1, 'lock');
    assert.equal(faces.length, 0);
    assert.equal(s1.system.devices[0].bypassed, true);
    t.after(urrMode());
    const s2 = site([dev('lock', { lockType: 'keypad' })]);
    faces.push(4, 4, 4, 1, 1);                                         // the sequencer: 5 dice vs the keypad's 4: 3
    faces.push(5, 1, 1, 1);                                            // the keypad: 4 dice vs the sequencer's 5: 1
    await thief([tool('Seq', 'sequencer', 5)]).bypassLock(s2, 'lock');
    assert.equal(faces.length, 0);
    assert.equal(s2.system.devices[0].bypassed, true);
    assert.ok(chat.some((m) => /Crack lock/.test(m.flags?.sr2e?.test?.label ?? m.content ?? '') || /Crack lock/.test(m.content ?? '')));
    assert.ok(chat.some((m) => /accepts the code<\/strong> \(3 vs the lock's 1\) after 5 s/.test(m.content ?? '')));
  });
});

describe('v0.80.0 drones-security: weapon detectors (dsMadScan)', () => {
  const pair = () => ({
    runner: who({ name: 'Runner' }, [
      { id: 'a', type: 'weapon', name: 'Pistol', system: { melee: false, concealability: 5 } },
      { id: 'b', type: 'weapon', name: 'Knife', system: { melee: true, concealability: 6 } },
    ]),
    guard: who({ name: 'Door guard' }, [{ id: 'mad', type: 'gear', name: 'Weapon detector', system: { quantity: 1, scanner: { kind: 'weapon', rating: 3 } } }]),
  });
  test('book: a test per item', async () => {
    const { runner, guard } = pair();
    faces.push(5, 1, 2, 1, 2, 2);
    assert.deepEqual(await guard.searchFor(runner.uuid, { method: 'scanner', scannerId: 'mad' }), { found: ['Pistol'], missed: ['Knife'] });
    assert.equal(faces.length, 0);
  });
  test('Revamp: one roll; the highest die finds everything hidden no better', async (t) => {
    t.after(urrMode());
    const { runner, guard } = pair();
    faces.push(5, 2, 1);
    assert.deepEqual(await guard.searchFor(runner.uuid, { method: 'scanner', scannerId: 'mad' }), { found: ['Pistol'], missed: ['Knife'] });
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /highest die 5/);
  });
  test('Revamp (review #7): the Rule of Six applies, so concealment 7 can be found', async (t) => {
    t.after(urrMode());
    const runner = who({ name: 'Runner' }, [{ id: 'a', type: 'weapon', name: 'Holdout', system: { melee: false, concealability: 7 } }]);
    const guard = who({ name: 'Door guard' }, [{ id: 'mad', type: 'gear', name: 'Weapon detector', system: { quantity: 1, scanner: { kind: 'weapon', rating: 3 } } }]);
    faces.push(6, 2, 1, 1);                                          // 6 re-rolled: 7
    assert.deepEqual(await guard.searchFor(runner.uuid, { method: 'scanner', scannerId: 'mad' }), { found: ['Holdout'], missed: [] });
    assert.match(chat.at(-1).content, /highest die 7/);
  });
});

describe('v0.80.0 drones-security: dump shock disorientation (dsDumpDisorient)', () => {
  const shock = { tn: 6, level: 'S' as const, type: 'stun' as const, kind: 'dump' as const, attribute: 'body' as const };
  test('book: the damage test only', async () => {
    const a = who({ name: 'Rigger' });
    faces.push(2, 2, 2, 2);
    await a.rollRiggerShock(shock);
    assert.equal(faces.length, 0);
    assert.ok(!chat.some((m) => /Disoriented/.test(m.content ?? '')));
  });
  test('Revamp: Willpower vs 4 after it: 10 turns ÷ successes', async (t) => {
    t.after(urrMode());
    const a = who({ name: 'Rigger' });
    faces.push(2, 2, 2, 2);
    faces.push(4, 4, 1, 1, 2);                                         // Willpower 5 vs 4: 2
    await a.rollRiggerShock(shock);
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /Disoriented<\/strong>: \+2 TN on skill tests for 5 Combat Turns/);
    faces.push(2, 2, 2, 2);
    await a.rollRiggerShock({ ...shock, kind: 'feedback' });
    assert.equal(faces.length, 0);
  });
});

describe('v0.80.0 drones-security: comms ECCM against jamming (dsCommsEccm)', () => {
  const setup = () => {
    const r = who({ name: 'Remote' }, [{ id: 'rcd', type: 'gear', name: 'RCD', system: { rcdRating: 2, signal: 0, quantity: 1 } }]);
    const d = vehicle({ name: 'Drone', drone: true, pilot: 3, eccm: 0 });
    r.system.rigging.subscribed = [d.uuid];
    const jammer = vehicle({ name: 'Jammer van', ecm: 4, drone: false });
    g.game.actors = [r, d, jammer];
    return { d, jammer };
  };
  test('book: TN = the signal (2)', async () => {
    const { d, jammer } = setup();
    faces.push(2, 1, 1, 1);
    assert.deepEqual(await jammer.jamTest(d.uuid), { jammed: true });
    assert.equal(faces.length, 0);
  });
  test('Revamp: ECCM 1 at least: TN 3', async (t) => {
    t.after(urrMode());
    const { d, jammer } = setup();
    faces.push(2, 1, 1, 1);
    assert.deepEqual(await jammer.jamTest(d.uuid), { jammed: false });
    assert.equal(faces.length, 0);
  });
});
