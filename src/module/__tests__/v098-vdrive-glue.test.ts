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
  for (const f of ['vdrive98.json', 'vdrive98-fix.json']) {
    const draft = join('i18n-drafts', f);
    if (existsSync(draft)) g.__SR2E_EN__ = { ...(g.__SR2E_EN__ ?? {}), ...JSON.parse(readFileSync(draft, 'utf8')) };
  }
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
    const { v, a } = await jumped({ currentSpeed: 60, stress98: 3 });
    // Car 5 + autonav 2: seven 1s; the Stress Test 2D6 (against the Stress before the Rule of One, C7); the 1D6.
    faces.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 4);
    await a.driveTest({ vehicle: v });
    assert.equal(v.system.stress98, 7);
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
    c.combatants = [{ actor: v }, { actor: p1 }, { actor: p2 }];
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
    // A GM is warned, never refused (S3); a player is refused.
    assert.equal(VD.offenceRefused(pass, null), false);
    assert.ok(warnings.some((w) => /Driver Points/.test(w) && /GM/.test(w)), warnings.join('|'));
    g.game.user = { id: 'p1', name: 'Player', isGM: false, can: () => true };
    assert.equal(VD.offenceRefused(pass, null), true);
    pass.myCombatant = () => ({ initiative: 7 });
    assert.equal(VD.offenceRefused(pass, null), false);
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
  test('seat belts and APPS lower a passenger\'s crash damage; a crash cage and the Crash Test pool add dice', async () => {
    const { v } = await jumped({ belted98: true, apps98: true, crashCage98: true });
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

// ================================================================ v0.98.0 review fixes (fix98.md, "vdrive")

const P1 = () => ({ id: 'p1', name: 'Player One', isGM: false, can: () => true });
const P2 = () => ({ id: 'p2', name: 'Player Two', isGM: false, can: () => true });
/** Users GM, p1, p2; `doc` owned by the listed players (a GM owns everything). */
function withPlayers(): void {
  const list = [GM(), P1(), P2()];
  g.game.users = Object.assign(list, { activeGM: { id: 'gm1', isSelf: true }, get: (id: string) => list.find((u) => u.id === id) });
}
function own<T extends Record<string, any>>(doc: T, ...players: string[]): T {
  (doc as any).testUserPermission = (u: any, lvl: string) => lvl === 'OWNER' && (Boolean(u?.isGM) || players.includes(u?.id));
  return doc;
}
/** A chat message by `author` with sr2e flags. */
function card(author: any, flags: Record<string, any>): any {
  const f = { ...flags };
  return { id: `card${++mid}`, author, flags: { [NS]: f }, getFlag: (_s: string, k: string) => f[k], async setFlag(_s: string, k: string, v: any) { f[k] = v; } };
}
const button = (): any => ({ disabled: false, dataset: {} });
const asPlayer = () => { g.game.user = P1(); };
const scoreRec = (v: any, driver: number) => ({ combatId: 'c98', round: 1, scores: [{ v: v.uuid, score: 30, driver, partial: 19 }], carry: [], hides: [] });
function withConfirm(t: any, answer = true): void {
  const api = g.foundry.applications.api.DialogV2;
  const was = api.confirm;
  api.confirm = async () => answer;
  t.after(() => { api.confirm = was; });
}

describe('v0.98.0 review S3: who rides in a player\'s vehicle counts only on its side', () => {
  test('a player\'s vehicle listing an NPC: the NPC is no passenger (no phase limit); the player\'s own character is', async () => {
    withPlayers();
    const c = combat(1);
    const v = own(vehicle({ name: 'Runner van' }), 'p1');
    const npc = who({ name: 'Ganger' });
    const pc = own(who({ name: 'Blade' }), 'p1');
    v.system.occupants.push(npc.uuid, pc.uuid);
    g.game.actors = [v, npc, pc];
    c.flags[NS] = { vdrive98: scoreRec(v, 11) };
    npc.myCombatant = () => ({ initiative: 17 });
    pc.myCombatant = () => ({ initiative: 17 });
    asPlayer();
    assert.equal(VD.offenceRefused(npc, null), false);
    assert.equal(warnings.length, 0, warnings.join('|'));
    assert.equal(VD.offenceRefused(pc, null), true);
  });
  test('a GM-owned vehicle\'s passengers count; a GM acting is warned, not refused', async () => {
    withPlayers();
    const c = combat(1);
    const v = own(vehicle({ name: 'Patrol car' }));
    const npc = who({ name: 'Officer' });
    v.system.occupants.push(npc.uuid);
    g.game.actors = [v, npc];
    c.flags[NS] = { vdrive98: scoreRec(v, 11) };
    npc.myCombatant = () => ({ initiative: 17 });
    assert.equal(VD.offenceRefused(npc, null), false);
    assert.ok(warnings.some((w) => /Patrol car/.test(w) && /GM/.test(w)), warnings.join('|'));
  });
  test('the hidden-contact refusal: a player\'s vehicle claiming an NPC as its driver doesn\'t put the NPC in it', async () => {
    withPlayers();
    const c = combat(1);
    const mine = own(vehicle({ name: 'Runner van' }), 'p1');
    const theirs = own(vehicle({ name: 'Patrol car' }));
    const npc = who({ name: 'Officer' });
    const pc = own(who({ name: 'Blade' }), 'p1');
    mine.system.controllerUuid = npc.uuid;
    theirs.system.occupants.push(pc.uuid);
    g.game.actors = [mine, theirs, npc, pc];
    c.flags[NS] = { vdrive98: { ...scoreRec(mine, 5), hides: [{ hider: mine.uuid, from: [theirs.uuid], successes: 2, round: 1 }] } };
    asPlayer();
    // The NPC isn't in the player's van, so attacks at it aren't refused as at a hidden vehicle.
    assert.equal(VD.offenceRefused(pc, npc.uuid), false);
  });
});

describe('v0.98.0 review S4 / S8 / P11: the GM\'s Maneuver Scores from a player\'s vehicle', () => {
  test('speed capped GM-side; type by category until the GM picks one (kept on the record); an NPC driver on a player\'s vehicle doesn\'t count', async () => {
    withPlayers();
    const c = combat(1);
    const v = own(vehicle({ name: 'Runner van', currentSpeed: 1000, speed: 90, vehicleType98: 'fighterJet', autonav: 0 }), 'p1');
    const cop = own(vehicle({ name: 'Patrol car', currentSpeed: 0, autonav: 0 }));
    const npc = who({ name: 'Ace' }, [skill('car', 'Car', 6)]);
    v.system.controllerUuid = npc.uuid; v.system.controlMode = 'manual';
    cop.system.chase = { quarryUuid: v.uuid, metres: 50 };
    g.game.actors = [v, cop, npc];
    c.combatants = [{ actor: v }, { actor: cop }];
    for (let i = 0; i < 60; i++) faces.push(1);
    assert.equal(await VD.rollScores(), true);
    let s = c.flags[NS].vdrive98.scores.find((x: any) => x.v === v.uuid);
    // car 0, normal terrain −2, 135 (1.5 × 90) ÷ 10 = 13; the NPC's Car 6 doesn't drive it: no Open Test dice.
    assert.equal(s.partial, 11);
    assert.equal(s.driver, 0);
    assert.ok(/Runner van \(/.test(chat.at(-1).content) && /135/.test(chat.at(-1).content), chat.at(-1).content);
    assert.equal(await VD.rollScores({}, { [v.uuid]: 'fighterJet' }), true);
    s = c.flags[NS].vdrive98.scores.find((x: any) => x.v === v.uuid);
    assert.equal(s.partial, 31);
    assert.equal(await VD.rollScores(), true);
    s = c.flags[NS].vdrive98.scores.find((x: any) => x.v === v.uuid);
    assert.equal(s.partial, 31, 'the GM\'s type stays on the record');
  });
  test('ctlOf / cpBound: a controller counts on the vehicle\'s side or pointing back at it', () => {
    withPlayers();
    const v = own(vehicle({ name: 'Runner van' }), 'p1');
    const npc = who({ name: 'Ace' }, [skill('car', 'Car', 6)]);
    v.system.controllerUuid = npc.uuid;
    assert.equal(VD.ctlOf(v), null);
    assert.equal(VD.cpBound(v), 0);
    npc.system.rigging.vehicleUuid = v.uuid;
    assert.equal(VD.ctlOf(v), npc);
    const pc = own(who({ name: 'Blade' }, [skill('car', 'Car', 5)]), 'p1');
    v.system.controllerUuid = pc.uuid;
    assert.equal(VD.cpBound(v), 5);
  });
  test('P11: the scores rolled twice in a Combat Turn keep the positioning successes carried over', async () => {
    const c = combat(2);
    const a1 = vehicle({ name: 'A', autonav: 0, currentSpeed: 0 });
    const b1 = vehicle({ name: 'B', autonav: 0, currentSpeed: 0 });
    b1.system.chase = { quarryUuid: a1.uuid, metres: 50 };
    g.game.actors = [a1, b1];
    c.combatants = [{ actor: a1 }, { actor: b1 }];
    c.flags[NS] = { vdrive98: { combatId: 'c98', round: 1, scores: [], carry: [{ v: a1.uuid, pos: 4 }], hides: [] } };
    assert.equal(await VD.rollScores(), true);
    assert.equal(c.flags[NS].vdrive98.scores.find((x: any) => x.v === a1.uuid).driver, 4);
    assert.equal(await VD.rollScores(), true);
    assert.equal(c.flags[NS].vdrive98.scores.find((x: any) => x.v === a1.uuid).driver, 4);
  });
});

describe('v0.98.0 review S9: a pursuer counts only with a combatant in the combat', () => {
  test('a vehicle chasing with no combatant adds no "more than one opponent" row', async () => {
    const c = combat(1);
    const { v, a } = await jumped({ currentSpeed: 250, speed: 210 });
    const p1 = vehicle({ name: 'Cruiser 1', autonav: 0 });
    const p2 = vehicle({ name: 'Cruiser 2', autonav: 0 });
    p1.system.chase = { quarryUuid: v.uuid, metres: 300 };
    p2.system.chase = { quarryUuid: v.uuid, metres: 300 };
    g.game.actors = [v, p1, p2, a];
    c.combatants = [{ actor: v }, { actor: p1 }];
    assert.ok(!modValues(a.previewDrive({ vehicle: v, push: 260 })).includes('opponents98:1'));
    c.combatants.push({ actor: p2 });
    assert.ok(modValues(a.previewDrive({ vehicle: v, push: 260 })).includes('opponents98:1'));
  });
});

describe('v0.98.0 review Lead/C: the passengers\' extra dice only from a card that may give them', () => {
  test('a GM\'s card keeps them; the vehicle\'s owner\'s card at most the crash cage + the controller\'s skill; anyone else none', () => {
    withPlayers();
    const v = own(vehicle({ name: 'Runner van', crashCage98: true }), 'p1');
    const pc = own(who({ name: 'Blade' }, [skill('car', 'Car', 5)]), 'p1');
    v.system.controllerUuid = pc.uuid;
    const d = { targetUuid: pc.uuid, power: 6, level: 'M', vdrive98Dice: 40, vdrive98Veh: v.uuid };
    assert.equal(VD.trustDice(card(GM(), {}), d).vdrive98Dice, 40);
    assert.equal(VD.trustDice(card(P1(), {}), d).vdrive98Dice, 11);
    assert.equal(VD.trustDice(card(P2(), {}), d).vdrive98Dice, undefined);
    assert.equal(VD.trustDice(card(P1(), {}), { ...d, vdrive98Veh: undefined }).vdrive98Dice, undefined);
    assert.equal(VD.trustDice(card(P2(), {}), { targetUuid: pc.uuid, power: 6, level: 'M' }).vdrive98Dice, undefined);
  });
  test('safePassengers bounds the Crash Test pool by the counted controller and names the vehicle', async () => {
    const { v } = await jumped({ crashCage98: true });
    const out = VD.safePassengers(v, [{ targetUuid: 'x', power: 9, level: 'M' }], 30);
    assert.equal(out[0].vdrive98Dice, 6 + 5);
    assert.equal(out[0].vdrive98Veh, v.uuid);
  });
});

describe('v0.98.0 review S6 / P5: a Deadly hit\'s Light to the vehicle, once (GM-side record)', () => {
  test('applied once even when the author clears the card\'s flag; a double click gives one box', async (t) => {
    withPlayers();
    withConfirm(t);
    const v = own(vehicle({ name: 'Patrol car' }));
    const pc = own(who({ name: 'Blade' }), 'p1');
    const m = card(P1(), { vdrive98Light: { vehicleUuid: v.uuid, passengerUuid: pc.uuid } });
    await Promise.all([VD.onCard(m, button(), 'vdrive98Light'), VD.onCard(m, button(), 'vdrive98Light')]);
    assert.equal(v.system.condition, 1);
    m.flags[NS].vdrive98Done = null;
    await VD.onCard(m, button(), 'vdrive98Light');
    assert.equal(v.system.condition, 1);
    assert.ok(VD.lightDone(m, v));
    assert.deepEqual(v.flags[NS][VD.LIGHT_FLAG], [m.id]);
  });
});

describe('v0.98.0 review C4 / P2: a player\'s chase turn\'s positioning, recorded by the GM\'s button', () => {
  test('the player\'s card carries the successes; the GM records them once (bounded by the dice), rolling the NPC side', async (t) => {
    withPlayers();
    withConfirm(t);
    const c = combat(1);
    const mine = own(vehicle({ name: 'Runner van', autonav: 0 }), 'p1');
    const cop = own(vehicle({ name: 'Patrol car', autonav: 0, currentSpeed: 60 }));
    g.game.actors = [mine, cop];
    asPlayer();
    const r = { successes: 3, totalDice: 5 }, q = { successes: 0, totalDice: 4 };
    const got = { html: await VD.afterPositioning(mine, cop, r, q), flags: VD.positionFlags(mine, cop, r, q) };
    assert.match(got.html, /vdrive98Pos/);
    assert.equal((c as any).flags[NS], undefined, 'a player\'s client writes nothing');
    g.game.user = GM();
    // A forged card: 50 successes on 5 dice count 5; the NPC side is rolled here.
    const m = card(P1(), { vdrive98Pos: { ...got.flags.vdrive98Pos, ps: 50 } });
    const before = chat.length;
    for (let i = 0; i < 40; i++) faces.push(6);
    await Promise.all([VD.onCard(m, button(), 'vdrive98Pos'), VD.onCard(m, button(), 'vdrive98Pos')]);
    const st = c.flags[NS].vdrive98;
    assert.equal(st.carry.find((x: any) => x.v === mine.uuid).pos, 5);
    assert.ok(chat.length > before);
    const copPos = st.carry.find((x: any) => x.v === cop.uuid)?.pos ?? 0;
    // A second copy of the card for the same pair and turn: refused.
    const again = card(P1(), { vdrive98Pos: got.flags.vdrive98Pos });
    await VD.onCard(again, button(), 'vdrive98Pos');
    assert.equal(c.flags[NS].vdrive98.carry.find((x: any) => x.v === mine.uuid).pos, 5);
    assert.equal(c.flags[NS].vdrive98.carry.find((x: any) => x.v === cop.uuid)?.pos ?? 0, copPos);
    assert.ok(warnings.some((w) => /already/.test(w)), warnings.join('|'));
  });
  test('a GM running the turn records at once, and only once per pair and turn', async () => {
    const c = combat(1);
    const a1 = vehicle({ name: 'A' }), b1 = vehicle({ name: 'B' });
    await VD.afterPositioning(a1, b1, { successes: 2, totalDice: 4 }, { successes: 1, totalDice: 4 });
    assert.equal(c.flags[NS].vdrive98.carry.find((x: any) => x.v === a1.uuid).pos, 2);
    const again = await VD.afterPositioning(a1, b1, { successes: 4, totalDice: 4 }, { successes: 0, totalDice: 4 });
    assert.equal(c.flags[NS].vdrive98.carry.find((x: any) => x.v === a1.uuid).pos, 2);
    assert.ok(!/vdrive98Pos/.test(again));
    assert.equal(VD.positionFlags(a1, b1, { successes: 2, totalDice: 4 }, null), null);
  });
  test('v971: no positioning record, no button', async (t) => {
    t.after(one('chase', 'v971'));
    combat(1);
    asPlayer();
    assert.equal(await VD.afterPositioning(vehicle(), vehicle(), { successes: 2, totalDice: 4 }, null), '');
    assert.equal(VD.positionFlags(vehicle(), vehicle(), { successes: 2, totalDice: 4 }, null), null);
  });
});

describe('v0.98.0 review C1: the passengers\' safety gear only in a collision or crash', () => {
  test('gunfire carried through to the people aboard isn\'t staged by the seat belts', async (t) => {
    // Gunfire reaches the people aboard only under the old v0.92.3 passengers rule (Rigger 2 p. 50 says it doesn't).
    t.after(oldWay({ 'VEHICLES_V923.passengers': 'old' }));
    const v = vehicle({ name: 'Van', belted98: true, apps98: true, armor: 0, body: 1 });
    const pc = who({ name: 'Blade' });
    v.system.occupants.push(pc.uuid);
    for (let i = 0; i < 20; i++) faces.push(1);
    await v.resistFromState({ targetUuid: v.uuid, melee: false, damageType: 'physical', power: 10, level: 'S' } as any, 0);
    const carried = chat.find((m) => m.flags?.[NS]?.damages?.[0]?.targetUuid === pc.uuid);
    assert.ok(carried, chat.map((m) => m.content).join('|'));
    const d = carried.flags[NS].damages[0];
    assert.equal(d.vdrive98Dice, undefined);
    assert.ok(!(d.level === 'M' && Number(d.power) <= 5), JSON.stringify(d));
  });
});

describe('v0.98.0 review C7: the Stress Test before the Rule of One adds (Rigger 2 p. 26\'s example)', () => {
  test('Stress 2, Body 3: the test (4) holds against 2; then the Rule of One +4 makes 6, twice the Body: a system fails', async () => {
    const { v, a } = await jumped({ currentSpeed: 60, stress98: 2, body: 3 });
    faces.push(1, 1, 1, 1, 1, 1, 1, 2, 2, 4);
    await a.driveTest({ vehicle: v });
    assert.equal(v.system.stress98, 6);
    assert.ok(chat.some((m) => /vehicleCrashTest/.test(m.content ?? '')), chat.map((m) => m.content).join('|'));
  });
});

describe('v0.98.0 review C10 / C12: the sheet\'s score of 0; a turret hit without a named weapon', () => {
  test('a Maneuver Score of 0 shows', () => {
    const c = combat(1);
    const v = vehicle();
    c.flags[NS] = { vdrive98: { combatId: 'c98', round: 1, scores: [{ v: v.uuid, score: 0, driver: 0, partial: 0 }], carry: [], hides: [] } };
    const ctx = VD.sheetContext(v);
    assert.equal(ctx.score, 0);
    assert.equal(ctx.hasScore, true);
    const tpl = readFileSync(join('public', 'templates', 'actor-vehicle-sheet.hbs'), 'utf8');
    assert.ok(tpl.includes('{{#if vdrive98.hasScore}}') && !tpl.includes('{{#if vdrive98.score}}'));
  });
  test('a called shot at the mount with no weapon named: the first mounted weapon\'s turret needs Serious', (t) => {
    const items = [{ id: 'w1', type: 'weapon', name: 'MG', system: { mount: 'turret', jammed: false } }];
    const v = vehicle({ items });
    assert.equal(VD.partHits(v, 'mount', 'M', null), false);
    assert.equal(VD.partHits(v, 'mount', 'S', null), true);
    t.after(one('calledThreshold', 'v971'));
    assert.equal(VD.partHits(v, 'mount', 'L', null), true);
  });
});
