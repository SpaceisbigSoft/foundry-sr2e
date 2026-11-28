/**
 * v0.98.0 rules completeness, vehicles (RULES.VDRIVE_V98): behaviour through the real documents/index.ts,
 * models/index.ts and applications/vdrive98.ts with the stubs of v0923-vehicles.test.ts (scripted dice, a chat log,
 * warnings): off-road Speed, the autonav and the chase's rows on driving tests, rigger defaulting, the ram's range,
 * the Speed cap and Stress, the GM's Maneuver Scores on the combat, the passenger phase limit, and for each that
 * 'v971' gives the v0.97.1 behaviour at the read site.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';

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
  a.uuid = `Actor.v98veh-${++n}`; a.id = `id${n}`;
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
  Object.assign(v, { type: 'vehicle', name: extra.name ?? 'Americar', uuid: `Actor.v98vv-${++n}`, system: sys, items: withGet(extra.items ?? []), statuses: new Set<string>() });
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


const gunnery = skill('gun', 'Gunnery', 6, 'intelligence');
/** A jumped-in rigger (Car 5, Gunnery 6, control rig 2) aboard a fresh adapted car. */
async function jumped(extra: any = {}) {
  const v = vehicle({ mods: adapted, ...extra });
  const a = rigger(2);
  a.items.push(gunnery);
  a.system.prepareDerivedData();
  v.system.occupants.push(a.uuid);
  assert.equal(await a.takeControl(v, 'jumped'), true);
  return { v, a };
}

const NS = 'shadowrun2e_unified';
const one = (k: string, v: string) => oldWay({ [`VDRIVE_V98.${k}`]: v });
let VD: any;
before(async () => {
  const draft = join('i18n-drafts', 'vdrive98.json');
  if (existsSync(draft)) g.__SR2E_EN__ = { ...(g.__SR2E_EN__ ?? {}), ...JSON.parse(readFileSync(draft, 'utf8')) };
  VD = await import('../applications/vdrive98.ts');
});

/** A started combat (GM-owned) whose flags take replaceFlag's updates. */
function combat(round = 1): any {
  const c: any = { id: 'c98', started: true, round, flags: {}, combatants: [],
    getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k.replace('.==', '.').replace(/\.-=.*$/, ''), v); } };
  g.game.combat = c;
  return c;
}
const modValues = (pv: any) => (pv?.modifiers ?? []).map((m: any) => `${m.id ?? m.label}:${m.value}`);

describe('v0.98.0 vehicles: off-road and the Speed cap', () => {
  test('off-road without suspension: half the Speed; with it, the Speed', () => {
    assert.equal(vehicle({ offroad: true }).system.derived.working.speed, 45);
    assert.equal(vehicle({ offroad: true, offroadSuspension98: true }).system.derived.working.speed, 90);
  });
  test('v971: the same Speed off-road', (t) => {
    t.after(one('offRoad', 'v971'));
    assert.equal(vehicle({ offroad: true }).system.derived.working.speed, 90);
  });
  test('a speed past 1.5 × the Speed is capped, and speeding up past the Speed costs a Stress Point', async () => {
    const v = vehicle({ currentSpeed: 80 });
    const ch: any = { system: { currentSpeed: 200 } };
    await v._preUpdate(ch, {}, GM());
    assert.equal(ch.system.currentSpeed, 135);
    assert.equal(ch.system.stress98, 1);
  });
  test('v971: no cap, no Stress', async (t) => {
    t.after(oldWay({ 'VDRIVE_V98.speedCap': 'v971', 'VDRIVE_V98.stress': 'v971' }));
    const v = vehicle({ currentSpeed: 80 });
    const ch: any = { system: { currentSpeed: 200 } };
    await v._preUpdate(ch, {}, GM());
    assert.equal(ch.system.currentSpeed, 200);
    assert.equal(ch.system.stress98, undefined);
  });
});

describe('v0.98.0 vehicles: the driving test rows', () => {
  test('an active autonav: + its rating on accelerating; switched off, none (and no autonav dice)', async () => {
    const { v, a } = await jumped();
    assert.ok(modValues(a.previewDrive({ vehicle: v, push: 100 })).includes('autonav98:2'));
    v.system.autonavOff98 = true;
    assert.ok(!modValues(a.previewDrive({ vehicle: v, push: 100 })).includes('autonav98:2'));
    assert.equal(a.previewDrive({ vehicle: v }).dice, 5);
    v.system.autonavOff98 = false;
    assert.equal(a.previewDrive({ vehicle: v }).dice, 7);
  });
  test('v971: no autonav row; the autonav adds its dice even off', async (t) => {
    t.after(one('autonavCombat', 'v971'));
    const { v, a } = await jumped({ autonavOff98: true });
    assert.ok(!modValues(a.previewDrive({ vehicle: v, push: 100 })).some((m: string) => m.startsWith('autonav98')));
    assert.equal(a.previewDrive({ vehicle: v }).dice, 7);
  });
  test('a rigger jumped in defaults to Reaction at +2 (+1 per dot), v971 at +4', async (t) => {
    const v = vehicle({ mods: adapted });
    const a = who({ name: 'Rigger' }, [{ id: 'vcr', type: 'cyberware', name: 'Control rig', system: { installed: true, essenceCost: 2, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0, controlRig: 1 } }]);
    v.system.occupants.push(a.uuid);
    assert.equal(await a.takeControl(v, 'jumped'), true);
    const def = (pv: any) => (pv.modifiers ?? []).filter((m: any) => m.value === 2 || m.value === 4).map((m: any) => m.value);
    assert.deepEqual(def(a.previewDrive({ vehicle: v })), [2]);
    t.after(one('riggerDefault', 'v971'));
    assert.deepEqual(def(a.previewDrive({ vehicle: v })), [4]);
  });
});

describe('v0.98.0 vehicles: ramming', () => {
  test('out of range (the chase gap at or above the Acceleration): refused before any roll', async () => {
    const { v, a } = await jumped();
    const other = vehicle({ name: 'Cruiser' });
    v.system.chase = { quarryUuid: other.uuid, metres: 50 };
    assert.equal(await a.ram(other.uuid), null);
    assert.ok(warnings.some((w) => /Acceleration/.test(w)), warnings.join('|'));
  });
  test('v971: no check (the ram is rolled)', async (t) => {
    t.after(one('ramRange', 'v971'));
    const { v, a } = await jumped();
    const other = vehicle({ name: 'Cruiser' });
    v.system.chase = { quarryUuid: other.uuid, metres: 50 };
    for (let i = 0; i < 30; i++) faces.push(5);
    assert.notEqual(await a.ram(other.uuid), null);
  });
});

describe('v0.98.0 vehicles: Stress on a Driving Test', () => {
  test('as many 1s as the skill: +1D6 Stress; the failed test\'s Stress Test fails: a Crash Test', async () => {
    const { v, a } = await jumped({ currentSpeed: 60 });
    // Car 5 + autonav 2: seven 1s; the 1D6 Stress roll; then the Stress Test 2D6.
    faces.push(1, 1, 1, 1, 1, 1, 1, 4, 1, 1);
    await a.driveTest({ vehicle: v });
    assert.equal(v.system.stress98, 4);
    assert.ok(chat.some((m) => /vehicleCrashTest/.test(m.content ?? '')), chat.map((m) => m.content).join('|'));
  });
  test('v971: no Stress', async (t) => {
    t.after(one('stress', 'v971'));
    const { v, a } = await jumped({ currentSpeed: 60 });
    faces.push(1, 1, 1, 1, 1, 1, 1);
    await a.driveTest({ vehicle: v });
    assert.equal(Number(v.system.stress98 ?? 0), 0);
  });
});

describe('v0.98.0 vehicles: the Maneuver Score chase (on the combat)', () => {
  test('the GM\'s scores go on the combat; the quarry\'s accelerating test reads the difference and the second pursuer', async () => {
    const c = combat(1);
    const { v, a } = await jumped({ currentSpeed: 250, speed: 210, vehicleType98: 'sportsCar' });
    const p1 = vehicle({ name: 'Cruiser 1', currentSpeed: 275, speed: 240, autonav: 0 });
    const p2 = vehicle({ name: 'Cruiser 2', currentSpeed: 275, speed: 240, autonav: 0 });
    p1.system.chase = { quarryUuid: v.uuid, metres: 300 };
    p2.system.chase = { quarryUuid: v.uuid, metres: 300 };
    g.game.actors = [v, p1, p2, a];
    // Open Tests: the rigger's Car 5 (highest 5 → 5), then each cruiser's autopilot rating 0 rolls nothing.
    faces.push(5, 4, 3, 2, 1);
    assert.equal(await VD.rollScores(), true);
    const st = c.flags[NS].vdrive98;
    assert.equal(st.combatId, 'c98');
    const mine = st.scores.find((s: any) => s.v === v.uuid);
    assert.equal(mine.partial, 26);
    assert.equal(mine.score, 31);
    const mods = modValues(a.previewDrive({ vehicle: v, push: 260 }));
    assert.ok(mods.includes('opponents98:1'), mods.join(','));
    assert.ok(mods.some((m: string) => m.startsWith('score98:')), mods.join(','));
  });
  test('a passenger acting above the Driver Points is refused; a player\'s client cannot write the record', async () => {
    const c = combat(1);
    const { v } = await jumped();
    const pass = who({ name: 'Blade' });
    v.system.occupants.push(pass.uuid);
    g.game.actors = [v, pass];
    c.flags[NS] = { vdrive98: { combatId: 'c98', round: 1, scores: [{ v: v.uuid, score: 30, driver: 11, partial: 19 }], carry: [], hides: [] } };
    pass.myCombatant = () => ({ initiative: 17 });
    assert.equal(VD.offenceRefused(pass, null), true);
    pass.myCombatant = () => ({ initiative: 7 });
    assert.equal(VD.offenceRefused(pass, null), false);
    g.game.user = { id: 'p1', name: 'Player', isGM: false, can: () => true };
    assert.equal(await VD.rollScores(), false);
  });
  test('v971: no record read, no limit', async (t) => {
    t.after(oldWay({ 'VDRIVE_V98.chase': 'v971', 'VDRIVE_V98.passengerPhase': 'v971' }));
    const c = combat(1);
    const { v, a } = await jumped();
    const pass = who({ name: 'Blade' });
    v.system.occupants.push(pass.uuid);
    g.game.actors = [v, pass];
    c.flags[NS] = { vdrive98: { combatId: 'c98', round: 1, scores: [{ v: v.uuid, score: 30, driver: 11, partial: 19 }], carry: [], hides: [] } };
    pass.myCombatant = () => ({ initiative: 17 });
    assert.equal(VD.offenceRefused(pass, null), false);
    assert.ok(!modValues(a.previewDrive({ vehicle: v, push: 100 })).some((m: string) => m.startsWith('score98')));
  });
});

describe('v0.98.0 vehicles: passengers in a crash', () => {
  test('seat belts and APPS lower a passenger\'s crash damage; a crash cage and the Crash Test pool add dice', () => {
    const v = vehicle({ belted98: true, apps98: true, crashCage98: true });
    const out = VD.safePassengers(v, [{ targetUuid: 'x', power: 15, level: 'S' }], 3);
    assert.deepEqual([out[0].power, out[0].level, out[0].vdrive98Dice], [8, 'M', 9]);
    assert.equal(VD.extraDice(out[0]), 9);
  });
  test('v971: as before', (t) => {
    t.after(oldWay({ 'VDRIVE_V98.passengerSafety': 'v971', 'VDRIVE_V98.cpCarry': 'v971' }));
    const v = vehicle({ belted98: true, apps98: true, crashCage98: true });
    const out = VD.safePassengers(v, [{ targetUuid: 'x', power: 15, level: 'S' }], 3);
    assert.deepEqual([out[0].power, out[0].level, out[0].vdrive98Dice], [15, 'S', undefined]);
  });
});
