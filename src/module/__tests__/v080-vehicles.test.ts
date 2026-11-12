/**
 * v0.80.0 (vehicles): the Unified Rules Revamp's vehicle rules, the Foundry glue side (documents/index.ts,
 * models/index.ts). Each change is checked under the SR2E Book Rules (the shipped values: the old behaviour) and under
 * urrMode(). The stubs are a copy of v071.test.ts's (scripted dice, a chat log of message objects with getFlag,
 * warnings). These check OUR wiring, not that Foundry behaves as the stubs do.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { urrMode } from '../rules/__tests__/urrmode.ts';
import { useV922Vehicles } from '../rules/__tests__/v922vehicles.ts';

const g = globalThis as any;
const faces: number[] = [];
const chat: any[] = [];
const warnings: string[] = [];
const uuidRegistry = new Map<string, any>();
const created: any[] = [];
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

let CharacterDataModel: any, VehicleDataModel: any, SR2Actor: any;

const GM = () => ({ id: 'gm1', name: 'GM', isGM: true, can: () => true });

/** A chat message as Foundry gives it back: an id and getFlag. */
const asMessage = (d: any) => ({ id: `m${++mid}`, timestamp: mid, ...d, getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; } });

before(async () => {
  // As in glue.test.ts and v070.test.ts: rules that add steps or prompts are off unless a test turns them on.
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
    },
    applications: { api: { DialogV2: { confirm: async () => false, prompt: async () => null, wait: async () => null } } },
  };
  g.Roll = StubRoll;
  g.ChatMessage = { create: async (d: any) => { const m = asMessage(d); chat.push(m); return m; }, getSpeaker: () => ({}) };
  g.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
  g.game = {
    i18n: { localize: (k: string) => k }, user: GM(), users: Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } }),
    time: { worldTime: 0 }, settings: { get: (_s: string, k: string) => settings[k], set: async () => {}, register: () => {} },
    actors: [], messages: { contents: [] },
  };
  g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
  g.fromUuid = async (u: string) => uuidRegistry.get(u) ?? null;
  g.ui = { notifications: { warn: (m: string) => { warnings.push(m); }, info: () => {}, error: () => {} } };
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
});

beforeEach(() => {
  faces.length = 0; chat.length = 0; warnings.length = 0; created.length = 0; settings = {};
  g.game.user = GM();
  g.game.users = Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } });
  g.game.time = { worldTime: 0 };
  g.game.actors = [];
  g.game.messages = { contents: [] };
  delete g.game.combat;
  delete g.game.scenes;
});

const A = { body: 4, quickness: 5, strength: 4, charisma: 4, intelligence: 5, willpower: 5 };
const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
let n = 0;

/** A character (or NPC) on the real data model, registered for fromUuid. */
function who(extra: any = {}, items: any[] = [], attrs: Record<string, number> = A): any {
  const sys = Object.create(CharacterDataModel.prototype);
  sys.attributes = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, { base: v, mod: 0 }]));
  const { name, type, ...rest } = extra;
  Object.assign(sys, {
    essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 30, career: 30 }, metamagic: {}, initiateGrade: 0,
    nuyen: 0, sustaining: [], drugs: [], geasa: [], ledger: [], recovering: [], diseases: [], care: { stabilised: false, dyingSince: -1 }, contacts: [],
    poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, monitor: { physical: 0, stun: 0 }, rigging: { vehicleUuid: '', jumpedIn: false, subscribed: [] }, ...rest,
  });
  const a = new SR2Actor();
  a.system = sys;
  a.name = name ?? 'Runner'; a.type = type ?? 'character';
  a.uuid = `Actor.v80veh-${++n}`; a.id = `id${n}`;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness') => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0 } });

/** A vehicle on the real data model (as glue.test.ts's). */
function vehicle(extra: any = {}): any {
  const v = new SR2Actor();
  const sys = Object.create(VehicleDataModel.prototype);
  Object.assign(sys, { category: 'car', skill: '', drone: false, handling: 4, handlingOffroad: 8, speed: 90, accel: 10, body: 4, armor: 3, signature: 2, autonav: 2, pilot: 0, sensor: 1,
    condition: 0, currentSpeed: 60, offroad: false, controllerUuid: '', controlMode: 'autopilot', occupants: [], mods: [], systems: { tires: false, engine: false, sensors: false }, ...extra });
  sys.prepareDerivedData();
  Object.assign(v, { type: 'vehicle', name: extra.name ?? 'Americar', uuid: `Actor.v80vv-${++n}`, system: sys, items: withGet(extra.items ?? []), statuses: new Set<string>() });
  sys.parent = v;
  uuidRegistry.set(v.uuid, v);
  return v;
}
const adapted = [{ name: 'Rigger adaptation', kind: 'adaptation', installed: true, rating: 1 }];

/** A rigger with a Car skill 5, a control rig and wired reflexes (as glue.test.ts's). */
const rigger = (vcr = 2) => who({ name: 'Rigger' }, [
  skill('car', 'Car', 5),
  ...(vcr ? [{ id: 'vcr', type: 'cyberware', name: 'Control rig', system: { installed: true, essenceCost: 2, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0, controlRig: vcr } }] : []),
  { id: 'wr', type: 'cyberware', name: 'Wired reflexes', system: { installed: true, essenceCost: 2, grade: 'standard', attributes: {}, reaction: 2, initiativeDice: 1 } },
]);

// ---------------------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------------------

const gunnery = skill('gun', 'Gunnery', 6, 'intelligence');
const mg = (mount: string, extra: any = {}) => ({ id: `w${mount}`, name: `MG (${mount})`, type: 'weapon', update: async () => {}, system: { melee: false, skill: '', mount, damagePower: 7, damageLevel: 'S', damageType: 'physical', modes: 'SA/BF/FA', ammo: 0, ammoMax: 0, recoilComp: 0, antiVehicle: false, ...extra } });
/** A jumped-in rigger (Car 5, Gunnery 6, control rig 2: Control Pool 9) aboard a fresh adapted car. */
async function jumped(extra: any = {}) {
  const v = vehicle({ mods: adapted, ...extra });
  const a = rigger(2);
  a.items.push(gunnery);
  a.system.prepareDerivedData();
  v.system.occupants.push(a.uuid);
  assert.equal(await a.takeControl(v, 'jumped'), true);
  return { v, a };
}
/** Dice rolled by fn (faces scripted as 5s). */
async function diceUsed(fn: () => Promise<unknown>, face = 5): Promise<number> {
  faces.length = 0;
  for (let i = 0; i < 40; i++) faces.push(face);
  await fn();
  const used = 40 - faces.length;
  faces.length = 0;
  return used;
}

describe('v0.80.0 vehicles: Control Pool', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  test('a driving test: any Control Pool dice (book); at most the skill (Revamp)', async (t) => {
    let { a } = await jumped();
    assert.equal(await diceUsed(() => a.driveTest({ poolDice: 8 })), 13);
    assert.equal(a.system.poolSpent.control, 8);
    t.after(urrMode());
    ({ a } = await jumped());
    assert.equal(await diceUsed(() => a.driveTest({ poolDice: 8 })), 10);
    assert.equal(a.system.poolSpent.control, 5);
  });

  test('evasive driving by a jumped-in rigger: capped the same way under the Revamp', async (t) => {
    const atk = (v: any) => ({ attackerUuid: 'x', targetUuid: v.uuid, weaponName: 'Gun', melee: false, damageType: 'physical', power: 8, level: 'M', attackSuccesses: 2, targetNumber: 4, antiVehicle: true });
    let { v } = await jumped();
    assert.equal(await diceUsed(() => v.defend(atk(v), 8)), 13);
    t.after(urrMode());
    ({ v } = await jumped());
    assert.equal(await diceUsed(() => v.defend(atk(v), 8)), 10);
  });

  test("a jumped-in driver's mounted gun: Control Pool (book), Combat Pool (Revamp)", async (t) => {
    let { v, a } = await jumped({ items: [mg('turret')] });
    await diceUsed(() => a.fireMounted(v, v.items.get('wturret'), { range: 'short', poolDice: 3 }));
    assert.equal(a.system.poolSpent.control, 3);
    assert.equal(a.system.poolSpent.combat, 0);
    t.after(urrMode());
    ({ v, a } = await jumped({ items: [mg('turret')] }));
    await diceUsed(() => a.fireMounted(v, v.items.get('wturret'), { range: 'short', poolDice: 3 }));
    assert.equal(a.system.poolSpent.control, 0);
    assert.equal(a.system.poolSpent.combat, 3);
  });
});

describe('v0.80.0 vehicles: damage', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  const hit = (v: any, extra: any = {}) => ({ targetUuid: v.uuid, melee: false, damageType: 'physical', power: 10, level: 'S', ...extra });

  test('a normal weapon: half Power, a level down (book); Power − Body − Armor, staged by Body (Revamp)', async (t) => {
    let v = vehicle();
    faces.push(1, 1, 1, 1);
    await v.resistVehicleDamage(hit(v));
    assert.match(chat.at(-1).content, /resists 5M/);
    t.after(urrMode());
    v = vehicle();
    faces.push(1, 1, 1, 1);
    await v.resistVehicleDamage(hit(v, { vehHit: { basePower: 10 } }));
    assert.match(chat.at(-1).content, /resists 3M/);
  });

  test("the rigger's Control Pool on the vehicle's resistance: not used (book); added (Revamp)", async (t) => {
    let { v, a } = await jumped();
    assert.equal(await diceUsed(() => v.resistVehicleDamage(hit(v, { antiVehicle: true }), 4), 1), 4);
    assert.equal(a.system.poolSpent.control, 0);
    t.after(urrMode());
    ({ v, a } = await jumped());
    assert.equal(await diceUsed(() => v.resistVehicleDamage(hit(v, { antiVehicle: true }), 4), 1), 8);
    assert.equal(a.system.poolSpent.control, 4);
  });

  test('feedback and passengers after a Serious hit; nothing after a Light one under the Revamp', async (t) => {
    let { v } = await jumped();
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    await v.resistVehicleDamage(hit(v, { antiVehicle: true }));
    let text = chat.map((m) => m.content).join('\n');
    assert.match(text, /Resist feedback \(Rigger: Willpower vs 10, S stun\)/i);
    assert.match(text, /carries through/);
    t.after(urrMode());
    ({ v } = await jumped());
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1, 1, 1, 1);
    await v.resistVehicleDamage(hit(v, { antiVehicle: true }));
    text = chat.map((m) => m.content).join('\n');
    assert.match(text, /Resist feedback \(Rigger: Body vs 6, M physical\)/i);
    assert.doesNotMatch(text, /carries through/);
    ({ v } = await jumped());
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1, 1, 1, 1);
    await v.resistVehicleDamage(hit(v, { antiVehicle: true, power: 6, level: 'L' }));
    assert.doesNotMatch(chat.map((m) => m.content).join('\n'), /Resist feedback/);
  });

  test('a crash: Power rounded down, passengers at M (book); rounded up, passengers at the vehicle\'s level (Revamp)', async (t) => {
    const rider = who({ name: 'Rider' });
    let v = vehicle({ occupants: [rider.uuid] });
    await v.crash(95);
    assert.match(chat.at(-1).content, /everyone aboard 9M/);
    t.after(urrMode());
    v = vehicle({ occupants: [rider.uuid] });
    await v.crash(95);
    assert.match(chat.at(-1).content, /everyone aboard 10S/);
  });

  test('a ram: Body + speed ÷ 10 (book); speed ÷ 10 rounded up (Revamp)', async (t) => {
    const target = vehicle({ name: 'Target' });
    let v = vehicle({ currentSpeed: 65 });
    faces.push(5, 5);
    await v.ram(target.uuid);
    assert.match(chat.at(-1).content, /, 10S\)/);
    t.after(urrMode());
    v = vehicle({ currentSpeed: 65 });
    faces.push(5, 5);
    await v.ram(target.uuid);
    assert.match(chat.at(-1).content, /, 7S\)/);
  });

  test('damage lowers the Speed only under the Revamp', async (t) => {
    assert.equal(vehicle({ condition: 6, speed: 90 }).system.derived.working.speed, 90);
    t.after(urrMode());
    assert.equal(vehicle({ condition: 6, speed: 90 }).system.derived.working.speed, 45);
    assert.equal(vehicle({ condition: 3, speed: 90 }).system.derived.working.speed, 67);
  });
});

describe('v0.80.0 vehicles: gunnery and repair', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  test('a drone firing at a moving car: moving modifiers (book); speed difference and size (Revamp)', async (t) => {
    const target = vehicle({ name: 'Target car', currentSpeed: 40 });
    const drone = () => vehicle({ name: 'Drone', drone: true, pilot: 3, autonav: 0, currentSpeed: 30, condition: 3, items: [mg('turret')] });
    let d = drone();
    faces.push(1, 1, 1);
    let r = await d.fireMounted(d, d.items.get('wturret'), { range: 'short', targetUuid: target.uuid });
    assert.equal(r.targetNumber, 8);                                   // 4 + moving 1 + damage 2 + target moving 1
    t.after(urrMode());
    d = drone();
    faces.push(1, 1, 1);
    r = await d.fireMounted(d, d.items.get('wturret'), { range: 'short', targetUuid: target.uuid });
    assert.equal(r.targetNumber, 7);                                   // 4 + damage 2 + speed difference 2 + car −1
  });

  test('repair TN: 4 (book); by the worst damage, Serious 6 (Revamp)', async (t) => {
    const mech = () => who({ name: 'Mechanic' }, [skill('br', 'Car B/R', 4, 'intelligence')]);
    faces.push(5, 5, 5, 5);
    assert.deepEqual(await mech().repairVehicleTest(vehicle({ condition: 7 }), { tools: 'shop' }), { repaired: 7 });
    t.after(urrMode());
    faces.push(5, 5, 5, 5);
    assert.deepEqual(await mech().repairVehicleTest(vehicle({ condition: 7 }), { tools: 'shop' }), { repaired: 0 });
  });
});
