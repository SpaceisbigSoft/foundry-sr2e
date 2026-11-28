/**
 * v0.98.0 rules completeness, rigging, drones, sensors and electronic warfare (RULES.VRIG_V98): behaviour through the
 * real documents/index.ts, models/index.ts, helpers/initiative.ts and applications/vrig98.ts with the stubs of
 * v073.test.ts (scripted dice, a chat log, warnings): the rig with move-by-wire, the ECM Test before a Sensor Test and
 * the results line, shared mount points on the model, Comprehension Tests on a group command, the captain's chair,
 * network drones in the rigger's phase, the remote link's Flux, and MIJI with the GM's re-count; and for each switch
 * that 'v971' gives the v0.97.1 behaviour at the read site.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/index.ts';
import { initiativeFormula } from '../helpers/initiative.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { SYSTEM_ID } from '../config/system.ts';

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

let CharacterDataModel: any, VehicleDataModel: any, SR2Actor: any, VG: any;

const GM = () => ({ id: 'gm1', name: 'GM', isGM: true, can: () => true });
const PLAYER = () => ({ id: 'p1', name: 'Corvo', isGM: false, can: () => false });

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
  ({ CharacterDataModel, VehicleDataModel } = await import('../models/index.ts'));
  ({ SR2Actor } = await import('../documents/index.ts'));
  g.CONFIG = { Actor: { documentClass: SR2Actor } };
  VG = await import('../applications/vrig98.ts');
  // This area's English while its draft isn't merged into public/lang/en.json (the lead deletes the draft then).
  for (const f of ['vrig98.json', 'vrig98-fix.json', 'vrig98-fix2.json']) {
    const draft = join('i18n-drafts', f);
    if (existsSync(draft)) g.__SR2E_EN__ = { ...(g.__SR2E_EN__ ?? {}), ...JSON.parse(readFileSync(draft, 'utf8')) };
  }
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
  a.uuid = `Actor.v98-${++n}`; a.id = `id${n}`;
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
  Object.assign(v, { type: 'vehicle', name: extra.name ?? 'Americar', uuid: `Actor.v98veh-${++n}`, id: `veh${n}`, system: sys, statuses: new Set<string>() });
  v.items = withGet(weapons.map((w) => ({ ...w, system: { ...w.system }, parent: v, async update(d: any) { for (const [k, val] of Object.entries(d)) setPath(this, k, val); } })));
  sys.parent = v;
  sys.prepareDerivedData();
  uuidRegistry.set(v.uuid, v);
  return v;
}
const mg = (mount: string, extra: any = {}, name = `MG (${mount})`) => ({ id: `w${mount}${extra.guidance ? 'g' : ''}`, name, type: 'weapon',
  system: { melee: false, skill: '', mount, mountPoint: '', damagePower: 7, damageLevel: 'S', damageType: 'physical', modes: 'SA/BF/FA', ammo: 0, ammoMax: 0, recoilComp: 0, antiVehicle: false, guidance: 0, ...extra } });

/** A rigger with Gunnery 6, Car 5 and a control rig (as glue.test.ts's). */
const rigger = (more: any[] = []) => who({ name: 'Rigger' }, [
  skill('gun', 'Gunnery', 6, 'intelligence'), skill('car', 'Car', 5, 'quickness'),
  { id: 'vcr', type: 'cyberware', name: 'Control rig', system: { installed: true, essenceCost: 2, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0, controlRig: 1 } },
  ...more,
]);

beforeEach(() => {
  // Foundry sets a message's author to the user who posts it (the MIJI card's Apply checks it).
  g.ChatMessage.create = async (d: any) => { const m: any = asMessage({ author: g.game.user, ...d }); chat.push(m); return m; };
});

const cyber = (id: string, name: string, system: any) => ({ id, type: 'cyberware', name, system: { installed: true, essenceCost: 1, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0, controlRig: 0, kind: 'other', rating: 0, ...system } });
const rcd = (rating: number, extra: any = {}) => ({ id: `rcd${rating}`, type: 'gear', name: 'Remote control deck', system: { rcdRating: rating, signal: 0, jammer: 0, carried: true, ...extra } });
const owners = (a: any, ids: string[]) => { a.ownership = Object.fromEntries(ids.map((id) => [id, 3])); a.testUserPermission = (u: any, _l: string) => Boolean(u?.isGM) || ids.includes(u?.id); return a; };

describe('the control rig with move-by-wire (Rigger 2 p. 17)', () => {
  test("move-by-wire 1 takes a level off the rig's bonuses and 1 die off the Control Pool; 'v971' leaves them", (t) => {
    const items = [cyber('vcr', 'Control rig', { controlRig: 2 }), cyber('mbw', 'Move-by-Wire System', { rating: 1, reaction: 2, initiativeDice: 1 })];
    const r = who({ name: 'Wire' }, items);
    const d = r.system.derived;
    const natural = d.reaction - 2;    // the move-by-wire's own +2 Reaction is cyber Reaction, not counted while rigging
    assert.equal(d.rigging.reaction, natural + 2);
    assert.equal(d.rigging.initiativeDice, 2);
    assert.equal(d.controlPool, natural + 4 - 1);
    t.after(oldWay({ 'VRIG_V98.rigWare': 'v971' }));
    r.system.prepareDerivedData();
    assert.equal(r.system.derived.rigging.reaction, natural + 4);
    assert.equal(r.system.derived.rigging.initiativeDice, 3);
    assert.equal(r.system.derived.controlPool, natural + 4);
  });
});

describe('the Sensor Test: the ECM Test and the results line (Rigger 2 pp. 28, 31)', () => {
  const setup = () => {
    const drone = vehicle({ name: 'Doberman', drone: true, pilot: 3, autonav: 0, sensor: 2 });
    const target = vehicle({ name: 'Jammer', signature: 3, ecm: 2 });
    g.game.actors = [drone, target];
    return { drone, target };
  };
  test('the jammer wins: its Signature rises by its successes for the test, on its own card; the result tells what was learned', async () => {
    const { drone, target } = setup();
    // ECM Flux 3 vs Sensor 2: three successes; the sensors' Flux 3 vs ECM 2: one. Then the Sensor Test: 2 dice vs 3 + 3.
    faces.push(5, 5, 5, 2, 1, 1, 6, 1, 2);
    const r = await drone.sensorTest(target.uuid);
    assert.equal(r.targetNumber, 6);
    const ecmCard = chat.find((m) => /Electronic countermeasures/.test(m.content));
    assert.ok(ecmCard);
    assert.match(ecmCard.content, /Signature is 3 higher/);
    assert.ok(r.modifiers.some((m: any) => m.id === 'ecm98' && m.value === 3));
    assert.match(chat.map((m) => m.content).join('\n'), /Basic contact|No contact/);
  });
  test("'v971': the ECM beyond ECCM on the TN, no ECM Test, no results line", async (t) => {
    t.after(oldWay({ 'VRIG_V98.ecmTest': 'v971', 'VRIG_V98.sensorResults': 'v971' }));
    const { drone, target } = setup();
    faces.push(1, 1);
    const r = await drone.sensorTest(target.uuid);
    assert.equal(r.targetNumber, 5);
    assert.equal(chat.some((m) => /Electronic countermeasures|No contact/.test(m.content)), false);
  });
});

describe('shared mount points on the vehicle model (Rigger 2 p. 22)', () => {
  test('Body 3 with two hardpoint weapons is over its budget', () => {
    const v = vehicle({ body: 3 }, [mg('fixed', {}, 'HMG'), { ...mg('turret', {}, 'Assault cannon'), id: 'ac' }]);
    assert.equal(v.system.derived.mountUsage.over, true);
    assert.match(v.system.derived.mountUsage.label, /4\/3/);
  });
});

describe('Comprehension Tests on a group command (Rigger 2 p. 66)', () => {
  const setup = () => {
    const r = rigger([rcd(3)]);
    const d1 = vehicle({ name: 'Dumb', drone: true, pilot: 2, autonav: 0 });
    r.system.rigging.subscribed = [d1.uuid];
    r.system.prepareDerivedData();
    g.game.actors = [r, d1];
    return { r, d1 };
  };
  test('a drone that fails its Comprehension Test does not act; one that passes drives', async () => {
    const { r } = setup();
    faces.push(1, 2);    // the Comprehension Test: 2 dice vs 4, no success
    assert.equal(await r.groupDrive({}), 0);
    assert.match(chat.at(-1).content, /does not understand/);
    faces.push(5, 1, 5, 1);    // understood (1 success), then its Driving Test
    assert.equal(await r.groupDrive({}), 1);
    assert.ok(chat.some((m) => /understands the command/.test(m.content)));
  });
  test("'v971': no test, the drone drives", async (t) => {
    t.after(oldWay({ 'VRIG_V98.comprehension': 'v971' }));
    const { r } = setup();
    faces.push(5, 1);
    assert.equal(await r.groupDrive({}), 1);
    assert.equal(chat.some((m) => /understand/.test(m.content)), false);
  });
});

describe("the captain's chair and network drones (Rigger 2 pp. 65–66)", () => {
  test("in the captain's chair the rig's Initiative counts; 'v971' the plain one", async (t) => {
    const r = rigger([rcd(3)]);
    await VG.toggleChair(r);
    assert.equal(r.flags[SYSTEM_ID].vrig98Chair, true);
    const f = initiativeFormula(r);
    assert.deepEqual({ dice: f.dice, base: f.base }, { dice: r.system.derived.rigging.initiativeDice, base: r.system.derived.rigging.reaction });
    t.after(oldWay({ 'VRIG_V98.captainsChair': 'v971' }));
    assert.equal(initiativeFormula(r).base, r.system.derived.reaction);
  });
  test("drones take their rigger's score after initiative; at a tie the rigger first; another side's drone does not", async () => {
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: true } });
    const r = owners(rigger([rcd(3)]), ['p1']);
    const mine = owners(vehicle({ name: 'Mine', drone: true, pilot: 3 }), ['p1']);
    const npc = owners(vehicle({ name: 'NPC drone', drone: true, pilot: 3 }), []);
    r.system.rigging.subscribed = [mine.uuid, npc.uuid];
    g.game.actors = [r, mine, npc];
    const cbt = (id: string, actor: any, initiative: number) => ({ id, actor, initiative, canUserModify: () => true });
    const combat: any = { combatants: [cbt('c1', r, 14), cbt('c2', mine, 7), cbt('c3', npc, 9)], async updateEmbeddedDocuments(_t: string, ups: any[]) { for (const u of ups) combat.combatants.find((c: any) => c.id === u._id).initiative = u.initiative; } };
    await VG.networkPhase(combat);
    assert.deepEqual(combat.combatants.map((c: any) => c.initiative), [14, 14, 9]);
    assert.equal(VG.networkOrder(combat.combatants[0], combat.combatants[1]), -1);
    assert.equal(VG.networkOrder(combat.combatants[1], combat.combatants[0]), 1);
  });
});

describe('Flux of the remote link (Rigger 2 p. 30)', () => {
  test("the scene's conditions and the link's encryption change the deck's Flux; 'v971' the plain one", (t) => {
    const r = rigger([rcd(3, { signal: 4 })]);
    const d = vehicle({ name: 'Spotter', drone: true, pilot: 3 });
    d.system.link = { encryption: 2, intercepted: { byUuid: '', by: '' }, spoofed: { active: false, byUuid: '', by: '' } };
    d.sceneHere = () => ({ flags: { [SYSTEM_ID]: { vrig98Flux: ['urban'] } } });
    assert.equal(r.remoteLink(d).signal, 2.5);
    t.after(oldWay({ 'VRIG_V98.flux': 'v971' }));
    assert.equal(r.remoteLink(d).signal, 4);
  });
});

describe('MIJI and the Signal Monitor (Rigger 2 pp. 69–72)', () => {
  const setup = () => {
    const intruder = owners(who({ name: 'Trixie' }, [skill('car', 'Car', 4), cyber('vcr', 'Control rig', { controlRig: 1 }), rcd(6, { signal: 8 }), { id: 'pem', type: 'gear', name: 'Protocol Emulation Module 6', system: { carried: true } }]), ['p1']);
    const corp = owners(rigger([rcd(3, { signal: 5 })]), []);
    corp.name = 'Corp rigger';
    const drone = owners(vehicle({ name: 'Corp drone', drone: true, pilot: 3 }), []);
    drone.system.link = { encryption: 0, intercepted: { byUuid: intruder.uuid, by: 'Trixie' }, spoofed: { active: false, byUuid: '', by: '' } };
    corp.system.rigging.subscribed = [drone.uuid];
    corp.system.prepareDerivedData();
    g.game.actors = [intruder, corp, drone];
    return { intruder, corp, drone };
  };
  /** The player's meaconing card (Trixie: 8 dice vs 3, five successes) and the GM back at the table. */
  const playerCard = async () => {
    const s = setup();
    g.game.user = PLAYER();
    s.corp.isOwner = false;
    faces.push(3, 3, 4, 5, 5, 1, 1, 2);
    const res = await VG.mijiTest(s.intruder, s.corp, 'meaconing', 'system');
    const card = [...chat].reverse().find((m) => m.flags?.[SYSTEM_ID]?.vrig98Miji);
    g.game.user = GM();
    s.corp.isOwner = true;
    return { ...s, res, card };
  };
  const confirming = async <T>(fn: () => Promise<T>, seen: string[] = []): Promise<T> => {
    const dlg = g.foundry.applications.api.DialogV2;
    const confirm0 = dlg.confirm;
    dlg.confirm = async (o: any) => { seen.push(String(o?.content ?? '')); return true; };
    try { return await fn(); } finally { dlg.confirm = confirm0; }
  };
  test("a player's meaconing card: only the intruder's dice are on it; the GM's Apply rolls the defender and degrades the corp network", async () => {
    const { corp, drone, res, card } = await playerCard();
    assert.deepEqual(res, { target: 0, self: 0, pending: true });
    assert.equal(corp.flags?.[SYSTEM_ID]?.vrig98Signal, undefined);    // not the player's to write
    assert.match(card.content, /vrig98Apply/);
    assert.equal(card.rolls.length, 1);                                   // the defender isn't rolled on the player's client
    // S5: the corp rolls on the GM's client (5 dice vs the PEM 6: one success, the 6 re-rolled to 8).
    // R4: a forged "defender" roll of all ones added to the card leaves faces over: the card is refused until it's gone.
    card.rolls.push({ dice: [{ results: [1, 1, 1, 1, 1].map((result) => ({ result })) }] });
    assert.equal(await confirming(() => VG.applyMiji(card)), false);
    assert.equal(corp.flags?.[SYSTEM_ID]?.vrig98Signal, undefined);
    card.rolls.pop();
    faces.push(6, 1, 2, 3, 1, 2);
    const seen: string[] = [];
    assert.equal(await confirming(() => VG.applyMiji(card), seen), true);
    assert.equal(corp.flags[SYSTEM_ID].vrig98Signal.system.boxes, 4);
    // The GM's dialog shows both sides' dice and TNs, the PEM and the ECCM.
    assert.match(seen[0]!, /8 dice vs TN 3, rolled 3, 3, 4, 5, 5, 1, 1, 2: 5 successes/);
    assert.match(seen[0]!, /5 dice vs TN 6, rolled 8, 1, 2, 3, 1: 1 successes/);
    assert.match(seen[0]!, /Protocol emulation module 6/);
    assert.match(seen[0]!, /ECCM 0/);
    // The GM's own card carries the defender's roll.
    assert.ok(chat.some((m) => m !== card && m.rolls?.length > 0 && /GM: Trixie/.test(m.content) && /8, 1, 2, 3, 1 vs TN 6/.test(m.content)));
    // The meaconed system channel: +2 on the corp drone's own Pilot tests.
    assert.deepEqual(VG.driveMods(drone, drone, 'autopilot', false).map((m: any) => m.value), [2]);
  });
  test('S6: applied once, remembered on the target network, not on the card; a reposted copy is refused', async () => {
    const { corp, card } = await playerCard();
    faces.push(1, 1, 1, 1, 1);
    assert.equal(await confirming(() => VG.applyMiji(card)), true);
    assert.equal(corp.flags[SYSTEM_ID].vrig98Signal.system.boxes, 5);
    assert.equal(corp.flags[SYSTEM_ID].vrig98MijiApplied.length, 3);    // id, dice, turn
    // The player's own card flags count for nothing (the old once-guard lived there).
    card.flags[SYSTEM_ID].vrig98Done = false;
    assert.equal(await confirming(() => VG.applyMiji(card)), false);
    assert.ok(warnings.some((w) => /already been applied/.test(w)));
    // A copy posted again (a new message, the same flags and dice): refused by its dice signature.
    const copy = await g.ChatMessage.create({ author: PLAYER(), content: card.content, rolls: card.rolls, flags: JSON.parse(JSON.stringify(card.flags)) });
    assert.notEqual(copy.id, card.id);
    assert.equal(await confirming(() => VG.applyMiji(copy)), false);
    assert.ok(warnings.some((w) => /match a MIJI card already applied/.test(w)));
    assert.equal(corp.flags[SYSTEM_ID].vrig98Signal.system.boxes, 5);
  });
  test('R3: a jammer of 1000 counts as EW_MAX: the defender rolls vs TN 20 on the GM\'s client, the dialog shows 20', async () => {
    const s = setup();
    s.intruder.items.push({ id: 'jam', type: 'gear', name: 'Jammer', system: { jammer: 1000, carried: true } });
    g.game.user = PLAYER();
    s.corp.isOwner = false;
    faces.push(3, 3, 4, 5, 5, 1, 1, 2);
    await VG.mijiTest(s.intruder, s.corp, 'jamming', 'command');
    const card = [...chat].reverse().find((m) => m.flags?.[SYSTEM_ID]?.vrig98Miji);
    g.game.user = GM();
    s.corp.isOwner = true;
    faces.push(5, 5, 5, 5, 5);
    const seen: string[] = [];
    assert.equal(await confirming(() => VG.applyMiji(card), seen), true);
    assert.match(seen[0]!, /5 dice vs TN 20,/);
    assert.match(seen[0]!, /ECM 20/);
    assert.equal(s.corp.flags[SYSTEM_ID].vrig98Signal.command.boxes, 5);
    assert.equal(s.corp.flags[SYSTEM_ID].vrig98Signal.by.rating, 20);
  });
  test('R4: a card with faces missing is refused; once per intruder, target and channel per Combat Turn', async () => {
    const { corp, intruder, card } = await playerCard();
    const short = await g.ChatMessage.create({ author: PLAYER(), content: card.content, rolls: [{ dice: [{ results: [3, 3, 4].map((result) => ({ result })) }] }], flags: JSON.parse(JSON.stringify(card.flags)) });
    assert.equal(await confirming(() => VG.applyMiji(short)), false);
    faces.push(1, 1, 1, 1, 1);
    assert.equal(await confirming(() => VG.applyMiji(card), []), true);
    // A fresh roll (other dice) by the same intruder on the same channel in the same turn: refused.
    const again = await g.ChatMessage.create({ author: PLAYER(), content: card.content, rolls: [{ dice: [{ results: [5, 5, 5, 5, 5, 5, 5, 5].map((result) => ({ result })) }] }], flags: JSON.parse(JSON.stringify(card.flags)) });
    assert.equal(await confirming(() => VG.applyMiji(again)), false);
    assert.ok(warnings.some((w) => /already been applied this Combat Turn/.test(w)));
    assert.equal(corp.flags[SYSTEM_ID].vrig98Signal.system.boxes, 5);
    // Later (another world time outside combat; in combat the next round): it counts.
    g.game.time.worldTime = 10;
    faces.push(1, 1, 1, 1, 1);
    assert.equal(await confirming(() => VG.applyMiji(again)), true);
    assert.equal(corp.flags[SYSTEM_ID].vrig98Signal.system.boxes, 10);
    assert.ok(intruder);
  });
  test('P5: a double click on Apply is one Apply (one dialog, one roll, one write)', async () => {
    const { corp, card } = await playerCard();
    faces.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
    let dialogs = 0;
    const dlg = g.foundry.applications.api.DialogV2;
    const confirm0 = dlg.confirm;
    dlg.confirm = async () => { dialogs++; await new Promise((r) => setTimeout(r, 5)); return true; };
    const button: any = { disabled: false };
    try { await Promise.all([VG.onCard(card, button, 'vrig98Apply'), VG.onCard(card, button, 'vrig98Apply')]); } finally { dlg.confirm = confirm0; }
    assert.equal(dialogs, 1);
    assert.equal(corp.flags[SYSTEM_ID].vrig98Signal.system.boxes, 5);
    assert.equal(button.disabled, true);
    assert.equal(faces.length, 5);                                        // the defender rolled once
  });
  test('C6: the GM write runs under the GM lock, inline inside a card re-run (no deadlock)', async () => {
    const { corp, card } = await playerCard();
    faces.push(1, 1, 1, 1, 1);
    const run = confirming(() => SR2Actor.runAsAuthor(GM(), () => VG.applyMiji(card)));
    const timeout = new Promise((r) => { const tm = setTimeout(() => r('deadlock'), 2000); (tm as any).unref?.(); });
    assert.equal(await Promise.race([run, timeout]), true);
    assert.equal(corp.flags[SYSTEM_ID].vrig98Signal.system.boxes, 5);
    // Outside a re-run it waits for the lock: another GM task holding it finishes first.
    const second = await playerCard();
    faces.push(1, 1, 1, 1, 1);
    const { withGmLock } = await import('../applications/gmlock.ts');
    let release!: () => void;
    const held = withGmLock(() => new Promise<void>((r) => { release = r; }));
    const apply = confirming(() => VG.applyMiji(second.card));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(second.corp.flags?.[SYSTEM_ID]?.vrig98Signal, undefined);
    release();
    await held;
    assert.equal(await apply, true);
    assert.equal(second.corp.flags[SYSTEM_ID].vrig98Signal.system.boxes, 5);
  });
  test('a card whose author does not own the intruder is refused; so is a card whose dice don\'t add up', async () => {
    const { corp, card } = await playerCard();
    card.author = { id: 'p2', name: 'Someone else', isGM: false };
    assert.equal(await VG.applyMiji(card), false);
    card.author = PLAYER();
    card.rolls = [];
    assert.equal(await VG.applyMiji(card), false);
    assert.equal(corp.flags?.[SYSTEM_ID]?.vrig98Signal, undefined);
  });
  test('the GM side writes at once; a lost command channel stops group commands; ECCM regenerates it', async () => {
    const { intruder, corp } = setup();
    corp.flags[SYSTEM_ID] = { vrig98Signal: { command: { boxes: 9, ops: ['jamming'] }, by: { rating: 6, uuid: intruder.uuid } } };
    assert.equal(VG.commandLost(corp), '');
    intruder.items.push({ id: 'jam', type: 'gear', name: 'Jammer', system: { jammer: 4, carried: true } });
    faces.push(5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1);
    await VG.mijiTest(intruder, corp, 'jamming', 'command');
    assert.equal(corp.flags[SYSTEM_ID].vrig98Signal.command.boxes, 10);
    assert.notEqual(VG.commandLost(corp), '');
    assert.equal(await corp.groupDrive({}), 0);
    corp.items.push({ id: 'eccm', type: 'gear', name: 'ECCM 6', system: { carried: true } });
    faces.push(6, 6, 6, 1, 1, 1, 3, 3, 3);    // ECCM 6 vs 6 + 3: three 6s re-rolled to 9, three successes: one box
    const off = await VG.regenerate(corp, 'command');
    assert.equal(off, 1);
    assert.equal(VG.commandLost(corp), '');
  });
  test("'v971': the drone-link dialog's own way, no degradation on tests", (t) => {
    const { corp, drone } = setup();
    corp.flags[SYSTEM_ID] = { vrig98Signal: { system: { boxes: 6, ops: ['meaconing'] } } };
    assert.deepEqual(VG.driveMods(drone, drone, 'autopilot', false).map((m: any) => m.value), [3]);
    t.after(oldWay({ 'VRIG_V98.miji': 'v971' }));
    assert.deepEqual(VG.driveMods(drone, drone, 'autopilot', false), []);
  });
});

describe('v0.98.0 review fixes (glue)', () => {
  test('C2: network drones taking the rigger\'s score keep the acting combatant acting (GM client)', async () => {
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: true } });
    const r = owners(rigger([rcd(3)]), ['p1']);
    const mine = owners(vehicle({ name: 'Mine', drone: true, pilot: 3 }), ['p1']);
    const npc = owners(vehicle({ name: 'NPC drone', drone: true, pilot: 3 }), []);
    r.system.rigging.subscribed = [mine.uuid];
    g.game.actors = [r, mine, npc];
    const cbt = (id: string, actor: any, initiative: number) => ({ id, actor, initiative, canUserModify: () => true });
    const combat: any = {
      started: true, turn: 1, combatants: [cbt('c1', r, 14), cbt('c2', mine, 7), cbt('c3', npc, 9)],
      get turns() { return [...this.combatants].sort((a: any, b: any) => b.initiative - a.initiative || VG.networkOrder(a, b)); },
      get combatant() { return this.turns[this.turn]; },
      async updateEmbeddedDocuments(_t: string, ups: any[]) { for (const u of ups) combat.combatants.find((c: any) => c.id === u._id).initiative = u.initiative; },
      async update(d: any) { Object.assign(combat, d); },
    };
    assert.equal(combat.combatant.id, 'c3');                              // the NPC drone acts
    await VG.networkPhase(combat);
    assert.deepEqual(combat.turns.map((c: any) => c.id), ['c1', 'c2', 'c3']);
    assert.equal(combat.combatant.id, 'c3');                              // still the NPC drone
  });
  test('C3: a preview of a continuous-lock missile writes no launch; the attack that rolled does', async () => {
    const missile = mg('hardpoint', { guidance: 4, damagePower: 12, modes: 'SS' }, 'Missile');
    const d = vehicle({ name: 'Hunter', drone: true, pilot: 4, sensor: 4, hardpoints: 1 }, [missile]);
    const prey = vehicle({ name: 'Prey', signature: 4 });
    g.game.actors = [d, prey];
    g.game.combat = { started: true, round: 2, id: 'cb1' };
    d.system.locks = [{ targetUuid: prey.uuid, targetName: 'Prey', successes: 2, round: 2, worldTime: 0, combatId: 'cb1' }];
    const w = d.items.get(missile.id);
    const o = { mounted: { vehicleUuid: d.uuid, role: 'autopilot' }, missileMode98: 'continuous', targetUuid: prey.uuid };
    assert.ok(d.planAttack(w, o).guidance98 > 0);
    d.previewAttack(w, o);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(d.flags?.[SYSTEM_ID]?.vrig98Lock, undefined);
    for (let i = 0; i < 40; i++) faces.push(4);
    const res = await d.fireMounted(d, w, { range: 'short', missileMode98: 'continuous', targetUuid: prey.uuid });
    assert.ok(res, warnings.join(' | '));
    assert.deepEqual(d.flags[SYSTEM_ID].vrig98Lock, { round: 2, combatId: 'cb1' });
  });
  test("P7: the captain's chair needs a control rig as well as the deck", () => {
    const deckOnly = who({ name: 'Decker' }, [rcd(3)]);
    assert.equal(VG.chairContext(deckOnly), null);
    assert.deepEqual(VG.chairContext(rigger([rcd(3)])), { on: false });
  });
  test("P8: with the optional ED rule, a player's own Sensor card gets no ED row (one electronic warfare row); the GM's does", async (t) => {
    t.after(oldWay({ 'VRIG_V98.ed': 'book' }));
    const scanner = vehicle({ name: 'Doberman', drone: true, pilot: 3, sensor: 4 });
    const target = vehicle({ name: 'Ghost', ed: 3 });
    g.game.user = PLAYER();
    faces.push(5, 5, 1);                                                  // ED 3 dice vs Sensor 4: two successes
    const mine = await VG.sensorEw(scanner, target);
    assert.deepEqual(mine.map((m: any) => [m.id, m.value]), [['ew98', 2]]);
    assert.doesNotMatch(mine[0].label, /deception|ED/);
    g.game.user = GM();
    faces.push(5, 5, 1);
    assert.deepEqual((await VG.sensorEw(scanner, target)).map((m: any) => m.id), ['ed98']);
  });
  test("P9 / C11: the link's Flux takes the deck's encryption (linkEncryption) and ECCM gear (eccmOf); 'v971' the plain one", (t) => {
    const r = rigger([rcd(3, { signal: 4, radio: { encryption: 2 } }), { id: 'eccm', type: 'gear', name: 'ECCM 4', system: { carried: true } }]);
    const d = vehicle({ name: 'Spotter', drone: true, pilot: 3 });
    d.sceneHere = () => ({ flags: {} });
    assert.equal(r.remoteLink(d).signal, 1.5);                            // 4 − 0.5 (the deck's encryption) − 2 (ECCM 4)
    t.after(oldWay({ 'VRIG_V98.flux': 'v971' }));
    assert.equal(r.remoteLink(d).signal, 4);
  });
  test('C9: a lost command channel refuses a group command with one warning, not one per drone', async () => {
    const r = rigger([rcd(3)]);
    const a = vehicle({ name: 'One', drone: true, pilot: 3 }), b = vehicle({ name: 'Two', drone: true, pilot: 3 });
    r.system.rigging.subscribed = [a.uuid, b.uuid];
    g.game.actors = [r, a, b];
    r.flags[SYSTEM_ID] = { vrig98Signal: { command: { boxes: 10, ops: ['jamming'] } } };
    assert.equal(await r.groupDrive({}), 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /command channel is lost/);
    warnings.length = 0;
    assert.equal(await r.groupAttack(a.uuid, {}), 0);
    assert.equal(warnings.length, 1);
  });
});
