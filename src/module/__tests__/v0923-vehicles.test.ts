/**
 * v0.92.3 book alignment (vehicles, rigging and building security): the Foundry glue side (documents/index.ts,
 * helpers/initiative.ts). Each change is checked at the book's default and with its switch at the v0.92.2 way
 * (v922Vehicles). The stubs are a copy of v080-vehicles.test.ts's. These check OUR wiring, not Foundry.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { urrMode } from '../rules/__tests__/urrmode.ts';

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
  a.uuid = `Actor.v923veh-${++n}`; a.id = `id${n}`;
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
  Object.assign(v, { type: 'vehicle', name: extra.name ?? 'Americar', uuid: `Actor.v923vv-${++n}`, system: sys, items: withGet(extra.items ?? []), statuses: new Set<string>() });
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
import { v922Vehicles } from '../rules/__tests__/v922vehicles.ts';
import { initiativeFormula } from '../helpers/initiative.ts';

const hit = (v: any, extra: any = {}) => ({ targetUuid: v.uuid, melee: false, damageType: 'physical', power: 10, level: 'S', ...extra });
const allText = () => chat.map((m) => m.content).join('\n');

describe('v0.92.3 vehicles: driving tests', () => {
  test('a Driving Test adds the autonav in dice; the Control Pool at most the skill; the rig −2 a level', async (t) => {
    let { a } = await jumped();
    // Car 5 + autonav 2 + Control Pool 5 (asked 8, capped at the skill)
    assert.equal(await diceUsed(() => a.driveTest({ poolDice: 8 })), 12);
    assert.equal(a.system.poolSpent.control, 5);
    assert.match(chat.at(-1).content, /Control rig 2[^<]*?−4|Control rig 2[^<]*?-4/);
    t.after(v922Vehicles());
    ({ a } = await jumped());
    assert.equal(await diceUsed(() => a.driveTest({ poolDice: 8 })), 13);
  });
  test('an autonav of rating 1 does not drive by itself', async (t) => {
    const v = vehicle({ autonav: 1 });
    assert.equal(await v.driveTest({}), null);
    assert.ok(warnings.some((w) => /autonav/i.test(w)));
    t.after(v922Vehicles());
    faces.push(5);
    assert.ok(await vehicle({ autonav: 1 }).driveTest({}));
  });
  test('review fix: a crash test an autonav 1 can\'t roll is an automatic crash (the crash-damage card), not lost', async () => {
    const v = vehicle({ autonav: 1 });
    assert.equal(await v.crashTestFor({ why: 'test' }), null);
    assert.equal(await v.crashUndriven(), true);
    assert.match(chat.at(-1).content, /data-sr2e-action="vehicleCrash"/);
    assert.equal(chat.at(-1).flags.sr2e.crash.vehicleUuid, v.uuid);
    assert.equal(await vehicle({ autonav: 1, currentSpeed: 0 }).crashUndriven(), false, 'standing still: no crash');
    assert.equal(await vehicle({ autonav: 2 }).crashUndriven(), false, 'an autonav that drives rolls the test');
  });
});

describe('v0.92.3 vehicles: attacks on a vehicle', () => {
  test('no dodge test; the Control Pool goes on the resistance (at most the skill); a complete miss', async (t) => {
    let { v, a } = await jumped();
    const atk = { attackerUuid: 'x', targetUuid: v.uuid, weaponName: 'Gun', melee: false, damageType: 'physical', power: 4, level: 'M', attackSuccesses: 2, targetNumber: 4, antiVehicle: true };
    assert.equal(await diceUsed(() => v.defend(atk, 8)), 0);
    assert.equal(a.system.poolSpent.control, 0);
    // Body 4 + Control Pool 5 (asked 8: capped at Car 5); AV Power 4 − half of Armor 3 (1) = TN 3: all 5s stage it away
    chat.length = 0;
    assert.equal(await diceUsed(() => v.resistVehicleDamage(hit(v, { power: 4, level: 'M', antiVehicle: true, attackHits: 2 }), 8)), 9);
    assert.equal(a.system.poolSpent.control, 5);
    const soak = chat.find((m) => m.flags?.sr2e?.snapshot?.soak || /resists/.test(m.content));
    assert.ok(soak);
    assert.match(allText(), /complete miss/i);
    t.after(v922Vehicles());
    ({ v, a } = await jumped());
    assert.equal(await diceUsed(() => v.defend(atk, 8)), 5 + 8); // the old evasive-driving test: Car 5 + any pool dice
  });
  test('feedback only at Serious (6M Physical, Body); a weapon hit does not reach the people aboard', async (t) => {
    let { v } = await jumped();
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    await v.resistVehicleDamage(hit(v, { antiVehicle: true }));
    let text = allText();
    assert.match(text, /Resist feedback \(Rigger: Body vs 6, M physical\)/i);
    assert.doesNotMatch(text, /carries through/);
    // a Moderate hit: nothing
    ({ v } = await jumped());
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    await v.resistVehicleDamage(hit(v, { antiVehicle: true, level: 'M' }));
    assert.doesNotMatch(allText(), /feedback/i);
    t.after(v922Vehicles());
    ({ v } = await jumped());
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    await v.resistVehicleDamage(hit(v, { antiVehicle: true }));
    text = allText();
    assert.match(text, /Resist feedback \(Rigger: Willpower vs 10, S stun\)/i);
    assert.match(text, /carries through/);
  });
  test('a rigger aboard a destroyed vehicle resists 6S Physical (not dump shock)', async (t) => {
    let { v } = await jumped();
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    await v.resistVehicleDamage(hit(v, { antiVehicle: true, level: 'D', power: 20 }));
    assert.match(allText(), /Resist feedback \(Rigger: Body vs 6, S physical\)/i);
    t.after(v922Vehicles());
    ({ v } = await jumped());
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    await v.resistVehicleDamage(hit(v, { antiVehicle: true, level: 'D', power: 20 }));
    assert.match(allText(), /dump shock/i);
  });
  test('review fix (the hit-level reading): a Moderate hit that destroys an already Serious vehicle is 6S feedback', async () => {
    const { v } = await jumped({ condition: 8 });
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    await v.resistVehicleDamage(hit(v, { antiVehicle: true, level: 'M' }));
    assert.match(allText(), /Resist feedback \(Rigger: Body vs 6, S physical\)/i);
  });
  test('a Body 0 drone is destroyed by any hit that gets through', async (t) => {
    let v = vehicle({ body: 0, armor: 0, drone: true, pilot: 2 });
    await v.resistVehicleDamage(hit(v, { power: 6, level: 'L', antiVehicle: true }));
    assert.equal(v.system.condition, 10);
    t.after(v922Vehicles());
    v = vehicle({ body: 0, armor: 0, drone: true, pilot: 2 });
    await v.resistVehicleDamage(hit(v, { power: 6, level: 'L', antiVehicle: true }));
    assert.equal(v.system.condition, 1);
  });
});

describe('v0.92.3 vehicles: crashes and initiative', () => {
  test('a crash card lists only the vehicle; the people aboard take the level its test leaves', async (t) => {
    const p = who({ name: 'Passenger' });
    let v = vehicle({ occupants: [p.uuid], currentSpeed: 100 });
    chat.length = 0;
    await v.crash(100);
    let card = chat.at(-1);
    assert.equal(card.flags.sr2e.damages.length, 1);
    faces.push(1, 1, 1, 1);
    await v.resistFromState(card.flags.sr2e.damages[0]);
    assert.match(allText(), /carries through/);
    t.after(v922Vehicles());
    v = vehicle({ occupants: [p.uuid], currentSpeed: 100 });
    await v.crash(100);
    card = chat.at(-1);
    assert.equal(card.flags.sr2e.damages.length, 2);
  });
  test('review fix: the people aboard a crash resist the same damage even when the vehicle escapes it, with no Combat Pool', async () => {
    const p = who({ name: 'Passenger' });
    const v = vehicle({ occupants: [p.uuid], currentSpeed: 100 });
    chat.length = 0;
    await v.crash(100);
    const crash = chat.at(-1).flags.sr2e.damages[0];
    faces.push(...Array(30).fill(6), ...Array(30).fill(1));            // the vehicle's Body: all successes
    await v.resistFromState(crash);
    const pass = chat.flatMap((c: any) => c.flags?.sr2e?.damages ?? []).filter((d: any) => d.targetUuid === p.uuid);
    assert.equal(pass.length, 1, chat.map((c: any) => c.content).join(' | '));
    assert.equal(pass[0].level, crash.level);
    assert.equal(pass[0].noPool, true);
    faces.length = 0;
    assert.equal(await diceUsed(() => p.resistFromState(pass[0], 3)), p.system.attributes.body.total, 'no Combat Pool dice');
  });
  test('review fix: a re-resolved soak card (the GM\'s TN change) still offers the crash of a destroyed moving vehicle', async () => {
    const v = vehicle({ condition: 8, currentSpeed: 60 });
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    await v.resistFromState(hit(v, { antiVehicle: true, level: 'S' }));
    const first = chat.at(-1);
    assert.match(first.content, /data-sr2e-action="vehicleCrash"/);
    Object.assign(first, { author: g.game.user, async update(d: any) { for (const [k, val] of Object.entries(d)) setPath(this, k, val); }, async setFlag(this: any, sc: string, k: string, val: any) { ((this.flags ??= {})[sc] ??= {})[k] = val; } });
    const snap = first.flags.sr2e.test;
    await SR2Actor.retarget(first, { baseTargetNumber: snap.baseTargetNumber, modifiers: [] });
    const again = chat.at(-1);
    assert.notEqual(again, first);
    assert.match(again.content, /data-sr2e-action="vehicleCrash"/);
  });
  test("vehicle damage lowers its driver's Initiative", (t) => {
    const v = vehicle({ condition: 3 });
    assert.equal(initiativeFormula(v).minus, 2);
    t.after(v922Vehicles());
    assert.equal(initiativeFormula(v).minus, 0);
  });
});

describe('v0.92.3 vehicles: shot inside a vehicle', () => {
  test('no Combat Pool, and a jacked-in rigger +3 TN', async (t) => {
    const { a } = await jumped();
    chat.length = 0;
    const d = { targetUuid: a.uuid, melee: false, damageType: 'physical', power: 8, level: 'M', occupantShot: true, extraArmor: 4 };
    assert.equal(await diceUsed(() => a.resistFromState(d, 3)), 4);
    assert.match(chat.at(-1).content, /TN (<strong>)?7\b|vs 7|target number 7/i);
    t.after(v922Vehicles());
    assert.equal(await diceUsed(() => a.resistFromState(d, 3)), 4 + 3);
  });
});

describe('v0.92.3 vehicles: ramming (Rigger 2 pp. 47, 50)', () => {
  const ram = async () => {
    const truck = vehicle({ name: 'Ram truck', body: 3, currentSpeed: 152, speed: 200 });
    const drv = rigger();
    const victim = vehicle({ name: 'Victim', currentSpeed: 300, speed: 300 });
    await drv.takeControl(truck, 'manual');
    faces.push(5, 5, 1, 1, 1);                                           // Car 5: 2 successes
    await drv.ram(victim.uuid);
    return { truck, victim, card: chat.at(-1) };
  };
  test('the speed difference; the rammer less Body × successes; the victim resists with no armor', async (t) => {
    const { victim, card } = await ram();
    const atk = card.flags.sr2e.attack;
    assert.deepEqual([atk.power, atk.level, atk.ram.power, atk.ram.bodyPerSuccess], [15, 'S', 15, 3]);
    await victim.defend(atk, 0);
    const def = chat.at(-1);
    assert.equal(def.flags.sr2e.ramSelf.power, 15 - 3 * 2);
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    await victim.resistFromState(def.flags.sr2e.damage);
    assert.match(allText(), /resists 15S/);                                  // armor 3 doesn't count against a collision
    t.after(v922Vehicles());
    const old = await ram();
    assert.equal(old.card.flags.sr2e.attack.power, 3 + 15);
  });
});

describe('v0.92.3 vehicles: gunnery and the Revamp', () => {
  test("a jumped-in driver's mounted gun rolls with the Combat Pool", async (t) => {
    let { v, a } = await jumped({ items: [mg('turret')] });
    await diceUsed(() => a.fireMounted(v, v.items.get('wturret'), { range: 'short', poolDice: 3 }));
    assert.deepEqual([a.system.poolSpent.control, a.system.poolSpent.combat], [0, 3]);
    t.after(v922Vehicles());
    ({ v, a } = await jumped({ items: [mg('turret')] }));
    await diceUsed(() => a.fireMounted(v, v.items.get('wturret'), { range: 'short', poolDice: 3 }));
    assert.deepEqual([a.system.poolSpent.control, a.system.poolSpent.combat], [3, 0]);
  });
  test('under the Revamp its own vehicle rules are as before (its evasive driving, its uncapped pool on resistance); the book\'s autonav dice, which the Revamp is silent on, apply there too', async (t) => {
    t.after(urrMode());
    let { v, a } = await jumped();
    const atk = { attackerUuid: 'x', targetUuid: v.uuid, weaponName: 'Gun', melee: false, damageType: 'physical', power: 8, level: 'M', attackSuccesses: 2, targetNumber: 4, antiVehicle: true };
    assert.equal(await diceUsed(() => v.defend(atk, 8)), 10);
    ({ v, a } = await jumped());
    assert.equal(await diceUsed(() => v.resistVehicleDamage(hit(v, { antiVehicle: true }), 8), 1), 4 + 8);
    assert.equal(a.system.poolSpent.control, 8);
    assert.equal(await diceUsed(() => a.driveTest({ poolDice: 0 })), 5 + 2);    // Car 5 + autonav 2 (Rigger 2 p. 20)
  });
});
