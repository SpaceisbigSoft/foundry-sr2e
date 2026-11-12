/**
 * v0.73.0: the occasional and rare items from the v0.69.0 review (docs/REVIEW-v0.69.md, section 3, O22–O43), the
 * Foundry glue side: documents/index.ts, models/index.ts, the applications (chat, undo, canvas, tokens, advancement,
 * sheets, adding, creation) and the rules files that now call the v0.73.0 helpers (creation.ts buildCheck,
 * npcgen.ts, charimport.ts). The pure rules (gridwork.ts, dronelink.ts, charfix.ts, bookkeeping.ts) are in
 * rules/__tests__/v073*.test.ts. The stubs are a copy of v072.test.ts's (scripted dice, a chat log of message
 * objects with getFlag, warnings, a hook registry). These check OUR wiring, not that Foundry behaves as the stubs do.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES, buildCheck, generateNpc, npcActorData, makeRng, characterImportPlan, parseCharacterSheet, initiativeWoundPenalty } from '../rules/index.ts';
import { initiativeFormula } from '../helpers/initiative.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { shown } from './helpers/shown.ts';
import { useV922Vehicles } from '../rules/__tests__/v922vehicles.ts';

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
const fire = async (name: string, ...args: any[]) => { for (const fn of hooks.get(name) ?? []) await fn(...args); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

let CharacterDataModel: any, VehicleDataModel: any, HostDataModel: any, SR2Actor: any, SR2Item: any;

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
  ({ CharacterDataModel, VehicleDataModel, HostDataModel } = await import('../models/index.ts'));
  ({ SR2Actor, SR2Item } = await import('../documents/index.ts'));
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
  a.uuid = `Actor.v73-${++n}`; a.id = `id${n}`;
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
  Object.assign(v, { type: 'vehicle', name: extra.name ?? 'Americar', uuid: `Actor.v73veh-${++n}`, id: `veh${n}`, system: sys, statuses: new Set<string>() });
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
  Object.assign(h, { type: 'host', name, uuid: `Actor.v73host-${++n}`, system: sys, items: withGet([]) });
  sys.parent = h;
  uuidRegistry.set(h.uuid, h);
  return h;
}
/** A node's Security Value 4 detection roll: nothing. */
const noDetect = () => faces.push(1, 1, 1, 1);

/** Run with a RULES path changed, put back afterwards. */
async function withRule<T>(obj: any, key: string, value: unknown, fn: () => T | Promise<T>): Promise<T> {
  const prev = obj[key];
  obj[key] = value;
  try { return await fn(); } finally { obj[key] = prev; }
}
const NR = () => RULES.NETRIG_V73 as any;
const DR = () => RULES.DRONES_V73 as any;
const CH = () => RULES.CHARACTERS_V73 as any;
const CX = () => RULES.CROSSCUT_V73 as any;

const sheets = read('src', 'module', 'applications', 'sheets.ts');

// =============================================================================================== Matrix and rigging

describe('O22 Graceful Logoff and a black IC hold (systemTest)', () => {
  const held = () => {
    const h = node('Fortress');
    const ic = { type: 'ic', uuid: `Actor.v73ic-${++n}`, name: 'Black IC 6', system: { hostUuid: h.uuid, rating: 6, category: 'black', derived: { crashed: false } } };
    uuidRegistry.set(ic.uuid, ic);
    const d = decker({ jackedIn: true, hostUuid: h.uuid, engagedBy: [ic.uuid] });
    g.game.actors = [d, ic];
    return { h, ic, d };
  };

  test('a held player is refused before rolling, with the reason; the GM may still log them off', async () => {
    const { d } = held();
    assert.ok(d.blackIcHold(), 'the hold is seen');
    g.game.user = PLAYER();
    assert.equal(await d.systemTest('', { operationId: 'gracefulLogoff' }), null);
    assert.match(shown(warnings.at(-1)), /Black IC 6 is holding Decker: Graceful Logoff can't get away from it/);
    assert.equal(faces.length, 0);
    g.game.user = GM();
    noDetect(); faces.push(5, 1, 1, 1, 1);
    assert.ok(await d.systemTest('', { operationId: 'gracefulLogoff' }));
  });

  test('a logoff that lands while held (forced past the check) leaves the decker in the host', async () => {
    const { h, d } = held();
    g.game.user = PLAYER();
    noDetect(); faces.push(5, 1, 1, 1, 1);
    assert.ok(await d.systemTest('', { operationId: 'gracefulLogoff', force: true }));
    assert.equal(d.system.matrix.hostUuid, h.uuid);
    assert.match(chat.at(-1).content, /Black IC 6 is holding Decker: Graceful Logoff can(&#39;|')t get away from it/);
  });

  test('switched off: the old way (the player is not stopped)', async () => {
    const { d } = held();
    g.game.user = PLAYER();
    noDetect(); faces.push(5, 1, 1, 1, 1);
    await withRule(NR().logoffHold, 'enabled', false, async () => {
      assert.ok(await d.systemTest('', { operationId: 'gracefulLogoff' }));
    });
    assert.ok(!warnings.some((w) => /Graceful Logoff can't get away/.test(shown(w))));
  });
});

describe('O23 persona damage on Matrix initiative', () => {
  test('initiativeFormula: a jacked-in decker loses the persona\'s wound penalty too; off = the body only', async () => {
    const h = node('InitHost');
    const d = decker({ jackedIn: true, hostUuid: h.uuid, monitor: 3 });
    assert.equal(d.system.derived.matrix?.jackedIn, true);
    const f = initiativeFormula(d);
    assert.equal(f.label, 'Matrix');
    assert.ok(f.minus > 0, `minus ${f.minus}`);
    await withRule(NR().personaInitiative, 'enabled', false, () => { assert.equal(initiativeFormula(d).minus, 0); });
    // Body wounds too: 'add' adds, 'max' takes the worse.
    await d.update({ 'system.monitor.physical': 3 });
    const body = initiativeWoundPenalty(d.system.derived.woundModifier);
    assert.equal(initiativeFormula(d).minus, body + f.minus);
    await withRule(NR().personaInitiative, 'combine', 'max', () => { assert.equal(initiativeFormula(d).minus, Math.max(body, f.minus)); });
  });

  test('tokens.ts: persona damage taken mid-turn lowers the combatant\'s score at once (switch off: it doesn\'t)', async () => {
    const { registerTokenHooks } = await import('../applications/tokens.ts');
    registerTokenHooks();
    const h = node('InitHost2');
    const run = async () => {
      const d = decker({ jackedIn: true, hostUuid: h.uuid, monitor: 0 });
      const c: any = { actor: d, initiative: 15, isOwner: true, flags: {}, getFlag(_s: string, k: string) { return this.flags[k]; },
        async update(u: any) { this.initiative = u.initiative; } };
      g.game.combats = [{ started: true, round: 1, combatants: [c] }];
      const change = { system: { matrix: { monitor: 3 } } };
      const options: any = {};
      await fire('preUpdateActor', d, change, options, 'gm1');
      await d.update({ 'system.matrix.monitor': 3 });
      await fire('updateActor', d, change, options, 'gm1');
      return c.initiative;
    };
    // v0.92.3: INITIATIVE_WOUNDS.midTurn is off by default (Core p. 112); this is the house rule on.
    await withRule(RULES.INITIATIVE_WOUNDS, 'midTurn', true, async () => {
      assert.ok(await run() < 15);
      assert.equal(await withRule(NR().personaInitiative, 'enabled', false, run), 15);
    });
  });
});

describe('O24 the hosts a character knows', () => {
  test('jackIn and logging on teach the host (located); Analyze host teaches its code', async () => {
    const ltg = node('LTG', 'ltg');
    const a1 = node('HostA', 'host', ltg.uuid);
    const d = decker({ jackedIn: false });
    g.game.actors = [d, ltg, a1];
    assert.equal(d.hostKnowledgeOf(a1), 'analyzed');                     // the GM sees all
    g.game.user = PLAYER();
    assert.equal(d.hostKnowledgeOf(a1), 'none');
    assert.equal(d.hostKnowledgeOf(ltg), 'located');                     // grids are 'located' by default
    assert.equal(await d.jackIn(ltg.uuid), true);
    assert.deepEqual(d.system.matrix.knownHosts, [{ uuid: ltg.uuid, analyzed: false }]);
    noDetect(); faces.push(5, 1, 1, 1, 1);
    await d.systemTest('', { operationId: 'logon', targetUuid: a1.uuid });
    assert.equal(d.system.matrix.hostUuid, a1.uuid);
    assert.equal(d.hostKnowledgeOf(a1), 'located');
    noDetect(); faces.push(5, 5, 1, 1, 1);
    await d.systemTest('', { operationId: 'analyzeHost' });
    assert.equal(d.hostKnowledgeOf(a1), 'analyzed');
    assert.deepEqual(d.system.matrix.knownHosts.find((k: any) => k.uuid === a1.uuid), { uuid: a1.uuid, analyzed: true });
  });

  test('onEntry analyzed: logging on shows the code at once; switched off everyone knows everything', async () => {
    const h = node('Shop');
    const d = decker({ jackedIn: false });
    g.game.user = PLAYER();
    await withRule(NR().knownHosts, 'onEntry', 'analyzed', () => d.jackIn(h.uuid));
    assert.equal(d.hostKnowledgeOf(h), 'analyzed');
    const other = node('Other');
    assert.equal(d.hostKnowledgeOf(other), 'none');
    await withRule(NR().knownHosts, 'enabled', false, () => { assert.equal(d.hostKnowledgeOf(other), 'analyzed'); });
  });

  test('sheets.ts: the log-on, Move and agent-search lists go through hostChoices; the header hides an unknown code', () => {
    assert.equal(sheets.match(/hostChoices\(allActors\(\)/g)?.length, 3);
    assert.ok(sheets.includes('known: actor.hostKnowledgeOf ? actor.hostKnowledgeOf(host) === "analyzed" : true'));
    assert.match(read('public', 'templates', 'matrix-section.hbs'), /\{\{#if matrix\.host\.known\}\} \(\{\{matrix\.host\.code\}\}-\{\{matrix\.host\.value\}\}\)\{\{\/if\}\}/);
  });
});

describe('O25 ramming: the rammer\'s share after the defense; its passengers take theirs', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  const ram = async () => {
    const truck = vehicle({ name: 'Ram truck', body: 6, currentSpeed: 60, speed: 100 });
    const drv = rigger();
    const victim = vehicle({ name: 'Victim' });
    await drv.takeControl(truck, 'manual');
    faces.push(5, 5, 1, 1, 1);                                           // Car 5: 2 successes
    await drv.ram(victim.uuid);
    return { truck, drv, victim, card: chat.at(-1) };
  };

  test('the attack card has no rammer\'s button; the victim\'s defense card offers it when the ram still hits', async () => {
    const { truck, victim, card } = await ram();
    assert.equal(card.flags.sr2e.ramSelf, undefined);
    const atk = card.flags.sr2e.attack;
    assert.equal(atk.ram.vehicleUuid, truck.uuid);
    await victim.defend(atk, 0);                                         // on its autopilot: no dodge
    const def = chat.at(-1);
    const rs = def.flags.sr2e.ramSelf;
    assert.ok(rs, 'the rammer\'s share is on the defense card');
    assert.deepEqual({ t: rs.targetUuid, p: rs.power, l: rs.level, c: rs.crash, r: rs.ramSelf }, { t: truck.uuid, p: atk.ram.power, l: atk.ram.level, c: true, r: true });
    assert.match(def.content, /data-sr2e-action="ramSelf"[^>]*>Rammer's damage \(Ram truck: /);
    assert.ok(def.flags.sr2e.damage, 'and the victim\'s own damage');
  });

  test('a ram the defense turns into a miss: no rammer\'s damage, a line saying so', async () => {
    const { victim, card } = await ram();
    const atk = { ...card.flags.sr2e.attack, attackSuccesses: 0 };
    await victim.defend(atk, 0);
    const def = chat.at(-1);
    assert.match(def.content, /Missed\./);
    assert.match(def.content, /The ram missed: Ram truck takes no damage\./);
    assert.equal(def.flags.sr2e.ramSelf, undefined);
  });

  test('switched off (afterDefense false): the old button on the attack card, none on the defense', async () => {
    await withRule(NR().ram, 'afterDefense', false, async () => {
      const { truck, victim, card } = await ram();
      assert.equal(card.flags.sr2e.ramSelf.targetUuid, truck.uuid);
      assert.match(card.content, /data-sr2e-action="ramSelf"/);
      await victim.defend(card.flags.sr2e.attack, 0);
      assert.equal(chat.at(-1).flags.sr2e.ramSelf, undefined);
    });
  });

  test('the rammer\'s own share carries through to its passengers (switch off: it doesn\'t; a crash never does)', async () => {
    const soak = async (extra: any) => {
      const truck = vehicle({ name: 'Ram truck', body: 4, armor: 0 });
      const p = who({ name: 'Passenger' });
      truck.system.occupants = [p.uuid];
      chat.length = 0;
      faces.push(1, 1, 1, 1);
      await truck.resistFromState({ targetUuid: truck.uuid, melee: false, damageType: 'physical', power: 10, level: 'S', crash: true, ...extra });
      return { p, damages: chat.flatMap((m) => m.flags?.sr2e?.damages ?? []) };
    };
    const hit = await soak({ ramSelf: true });
    assert.equal(hit.damages.length, 1);
    assert.equal(hit.damages[0].targetUuid, hit.p.uuid);
    assert.equal((await soak({})).damages.length, 0);                 // a plain crash
    assert.equal((await withRule(NR().ram, 'passengers', false, () => soak({ ramSelf: true }))).damages.length, 0);
  });
});

describe('O26 the control rig on gunnery and the Control-Pool dodge', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  const jumped = async () => {
    const v = vehicle({ name: 'Bulldog', mods: [{ name: 'Rigger adaptation', kind: 'adaptation', installed: true, rating: 1 }] }, [mg('turret')]);
    const rig = rigger();
    v.system.occupants = [rig.uuid];
    assert.equal(await rig.takeControl(v, 'jumped'), true);
    return { v, rig };
  };

  test('fireMounted: a jumped-in rigger gets the rig\'s −1 on gunnery; switched off it doesn\'t', async () => {
    const { v, rig } = await jumped();
    faces.push(...Array(12).fill(1));
    const r = await rig.fireMounted(v, v.items.get('wturret'), { range: 'short', mode: 'SA', earlierRoundsThisPhase: 0 });
    assert.ok(r.modifiers.some((m: any) => m.label === 'Control rig 1' && m.value === -1), JSON.stringify(r.modifiers));
    faces.push(...Array(12).fill(1));
    const off = await withRule(NR().controlRig, 'gunnery', false, () => rig.fireMounted(v, v.items.get('wturret'), { range: 'short', mode: 'SA', earlierRoundsThisPhase: 0 }));
    assert.equal(off.targetNumber, r.targetNumber + 1);
    assert.ok(!off.modifiers.some((m: any) => /^Control rig/.test(m.label)));
  });

  test('the Control-Pool dodge (riggerDodge \'pool\') takes the rig\'s −1 too; switched off it doesn\'t', async () => {
    const { v } = await jumped();
    const attack = { targetUuid: v.uuid, attackerUuid: 'Actor.x', melee: false, damageType: 'physical', power: 9, level: 'M', targetNumber: 5, attackSuccesses: 1 };
    const tnOf = () => chat.at(-1).flags.sr2e.test.targetNumber;
    await withRule(RULES.FIXES_V71, 'riggerDodge', 'pool', async () => {
      faces.push(1, 1);
      await v.defend(attack, 2);
      assert.match(chat.at(-1).content, /Evasive driving \(Rigger, Control Pool\)/);
      assert.equal(tnOf(), 4);
      faces.push(1, 1);
      await withRule(NR().controlRig, 'evasion', false, () => v.defend(attack, 2));
      assert.equal(tnOf(), 5);
    });
  });
});

describe('O27 sensor locks lapse', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  const setup = (round: number) => {
    g.game.combat = { id: 'c1', started: true, round };
    const drone = vehicle({ name: 'Doberman', drone: true, pilot: 3, autonav: 0, sensor: 4 }, [mg('turret')]);
    const target = vehicle({ name: 'Target car', signature: 3 });
    g.game.actors = [drone, target];
    return { drone, target };
  };

  test('a sensor test stamps the lock with the Combat Turn and the world time', async () => {
    const { drone, target } = setup(2);
    g.game.time.worldTime = 120;
    faces.push(5, 5, 1, 1);
    await drone.sensorTest(target.uuid);
    assert.deepEqual(drone.system.locks.map((l: any) => ({ t: l.targetUuid, r: l.round, w: l.worldTime })), [{ t: target.uuid, r: 2, w: 120 }]);
  });

  test('lapseSensorLocks: kept for 3 Combat Turns, then dropped with a card; switched off it stays', async () => {
    const { drone, target } = setup(1);
    faces.push(5, 5, 1, 1);
    await drone.sensorTest(target.uuid);
    g.game.combat.round = 3;
    await SR2Actor.lapseSensorLocks();
    assert.equal(drone.system.locks.length, 1);
    g.game.combat.round = 4;
    await withRule(NR().sensorLocks, 'enabled', false, () => SR2Actor.lapseSensorLocks());
    assert.equal(drone.system.locks.length, 1);
    await SR2Actor.lapseSensorLocks();
    assert.equal(drone.system.locks.length, 0);
    assert.match(chat.at(-1).content, /Doberman<\/strong> loses its sensor lock: Target car \(no sensor test for 3 Combat Turns\)/);
  });

  test('only the active GM sweeps; sensors shot out drop the lock at once', async () => {
    const { drone, target } = setup(1);
    faces.push(5, 5, 1, 1);
    await drone.sensorTest(target.uuid);
    drone.system.systems.sensors = true;
    g.game.users = Object.assign([GM()], { activeGM: { id: 'gm2', isSelf: false } });
    await SR2Actor.lapseSensorLocks();
    assert.equal(drone.system.locks.length, 1);
    g.game.users = Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } });
    await SR2Actor.lapseSensorLocks();
    assert.equal(drone.system.locks.length, 0);
    assert.match(chat.at(-1).content, /sensors shot out/);
  });

  test('fireMounted: a lapsed lock gives no lock bonus even before the sweep drops it', async () => {
    const { drone, target } = setup(1);
    faces.push(5, 5, 1, 1);
    await drone.sensorTest(target.uuid);
    const fire = async () => { faces.push(...Array(8).fill(1)); return drone.fireMounted(drone, drone.items.get('wturret'), { range: 'short', targetUuid: target.uuid }); };
    const held = await fire();
    g.game.combat.round = 4;
    const lapsed = await fire();
    assert.ok(lapsed.targetNumber > held.targetNumber, `${held.targetNumber} → ${lapsed.targetNumber}`);
    await withRule(NR().sensorLocks, 'enabled', false, async () => { assert.equal((await fire()).targetNumber, held.targetNumber); });
  });

  test('tokens.ts: a new Combat Turn, or a clock step outside combat, runs the sweep', async () => {
    const { registerTokenHooks } = await import('../applications/tokens.ts');
    registerTokenHooks();
    const saved = SR2Actor.lapseSensorLocks;
    let calls = 0;
    SR2Actor.lapseSensorLocks = async () => { calls++; };
    try {
      await fire('updateCombat', {}, { round: 2 });
      await fire('updateCombat', {}, { turn: 1 });
      assert.equal(calls, 1);
      g.game.combat = { started: true };
      await fire('updateWorldTime', 10);
      assert.equal(calls, 1);
      delete g.game.combat;
      await fire('updateWorldTime', 10);
      assert.equal(calls, 2);
    } finally { SR2Actor.lapseSensorLocks = saved; }
  });
});

describe('O28 (5-A9) intercepting and spoofing a drone\'s link', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  const radio = { id: 'rad', type: 'gear', name: 'Radio', system: { radio: { rating: 3 } } };
  const rcd = { id: 'rcd', type: 'gear', name: 'RCD', system: { rcdRating: 2 } };
  const hacker = (gear: any[] = [radio, rcd]) => who({ name: 'Spoofer' }, [skill('el', 'Electronics', 4, 'intelligence'), ...gear]);
  const drone = (extra: any = {}) => vehicle({ name: 'Roto-drone', drone: true, pilot: 3, autonav: 0, ...extra });

  test('intercept: Electronics vs the radio rule (unencrypted: base TN 4); the drone is marked intercepted by them', async () => {
    const h = hacker(), d = drone();
    faces.push(5, 5, 1, 1);
    assert.deepEqual(await h.interceptDroneLink(d.uuid), { intercepted: true });
    assert.match(chat.at(-1).content, /4 dice vs TN <strong>4<\/strong>/);
    assert.match(chat.at(-1).content, /Spoofer intercepts Roto-drone's link \(Electronics.*unencrypted\)/);
    assert.match(chat.at(-1).content, /Link intercepted/);
    assert.deepEqual({ ...d.system.link.intercepted }, { byUuid: h.uuid, by: 'Spoofer' });
  });

  test('intercept: encryption 6 raises the TN (a miss leaves the link closed); no radio or deck: refused', async () => {
    const h = hacker(), d = drone({ link: { encryption: 6, intercepted: { byUuid: '', by: '' }, spoofed: { active: false, byUuid: '', by: '' } } });
    faces.push(5, 5, 1, 1);
    assert.deepEqual(await h.interceptDroneLink(d.uuid), { intercepted: false });
    assert.match(chat.at(-1).content, /encryption 6/);
    assert.match(chat.at(-1).content, /The link stays closed/);
    assert.equal(d.system.link.intercepted.byUuid, '');
    assert.equal(await hacker([]).interceptDroneLink(d.uuid), null);
    assert.match(warnings.at(-1) ?? '', /needs a remote control deck or a radio to intercept/);
  });

  test('a drone driven by hand has no link to intercept', async () => {
    const h = hacker(), d = drone(), drv = rigger();
    d.system.occupants = [drv.uuid];
    await drv.takeControl(d, 'manual');
    assert.equal(await h.interceptDroneLink(d.uuid), null);
    assert.match(warnings.at(-1) ?? '', /Roto-drone: driven by hand/);
  });

  test('someone else\'s drone: a GM card (applies by itself, safeAutoApply); applyDroneLink marks it', async () => {
    const { safeAutoApply, GM_APPLY_ACTIONS } = await import('../applications/chat.ts');
    const h = hacker(), d = drone();
    d.isOwner = false;
    faces.push(5, 5, 1, 1);
    await h.interceptDroneLink(d.uuid);
    const card = chat.at(-1);
    assert.equal(d.system.link?.intercepted?.byUuid ?? '', '');
    assert.match(card.content, /data-sr2e-action="applyDroneLink"/);
    assert.deepEqual(card.flags.sr2e.droneLink, { droneUuid: d.uuid, kind: 'intercept', byUuid: h.uuid, by: 'Spoofer' });
    assert.equal(GM_APPLY_ACTIONS['applyDroneLink'], 'droneLinkApplied');
    // v0.81.0: by itself only when the card's author owns the interceptor (rules/trust.ts); v0.81.1 (RB2-2): never
    // (the drone is someone else's): the GM applies it.
    const mine = { authorIsGm: false, owns: (u: string) => u === h.uuid };
    assert.equal(safeAutoApply('applyDroneLink', card.flags.sr2e, mine), false);
    assert.equal(safeAutoApply('applyDroneLink', card.flags.sr2e, { authorIsGm: false, owns: () => false }), false);
    assert.equal(safeAutoApply('applyDroneLink', { droneLink: { ...card.flags.sr2e.droneLink, kind: 'spoof' } }, mine), false);
    assert.equal(await SR2Actor.applyDroneLink(card.flags.sr2e.droneLink), true);
    assert.equal(d.system.link.intercepted.byUuid, h.uuid);
    assert.equal(await SR2Actor.applyDroneLink({ ...card.flags.sr2e.droneLink, droneUuid: 'Actor.gone' }), false);
  });

  test('spoof: refused until intercepted; then vs its Pilot; one command by default (nothing stored)', async () => {
    const h = hacker(), d = drone();
    assert.equal(await h.spoofDroneLink(d.uuid, { command: 'land' }), null);
    assert.match(warnings.at(-1) ?? '', /Intercept the link first/);
    faces.push(5, 5, 1, 1);
    await h.interceptDroneLink(d.uuid);
    faces.push(5, 5, 1, 1);
    assert.deepEqual(await h.spoofDroneLink(d.uuid, { command: 'land' }), { spoofed: true });
    assert.match(chat.at(-1).content, /Spoofer spoofs Roto-drone \(Electronics.* vs Pilot 3\)/);
    assert.match(chat.at(-1).content, /Command: <em>land<\/em>/);
    assert.match(chat.at(-1).content, /carries out the spoofed command/);
    assert.equal(d.system.link.spoofed?.active ?? false, false);
    assert.equal(await hacker([radio]).spoofDroneLink(d.uuid), null);   // spoofing needs a remote control deck
    assert.match(warnings.at(-1) ?? '', /needs a remote control deck to spoof/);
  });

  test('spoof takeover: the drone is taken; its rigger can\'t jump in until the GM clears it', async () => {
    await withRule(DR().link.spoof, 'effect', 'takeover', async () => {
      const h = hacker(), d = drone();
      const rig = rigger([{ id: 'rcd', type: 'gear', name: 'RCD', system: { rcdRating: 2 } }]);
      faces.push(5, 5, 1, 1);
      await h.interceptDroneLink(d.uuid);
      faces.push(5, 5, 1, 1);
      await h.spoofDroneLink(d.uuid);
      assert.deepEqual({ ...d.system.link.spoofed }, { active: true, byUuid: h.uuid, by: 'Spoofer' });
      assert.equal(await d.setController(rig, 'jumped'), false);
      assert.match(warnings.at(-1) ?? '', /Roto-drone: its link has been spoofed by Spoofer/);
      await d.clearDroneLink();
      assert.deepEqual({ a: d.system.link.spoofed.active, i: d.system.link.intercepted.byUuid }, { a: false, i: '' });
    });
  });

  test('switched off: no interception or spoofing (the sheet\'s Drone link button goes too)', async () => {
    const h = hacker(), d = drone();
    await withRule(DR().link, 'enabled', false, async () => {
      assert.equal(await h.interceptDroneLink(d.uuid), null);
      assert.equal(await h.spoofDroneLink(d.uuid), null);
    });
    assert.ok(sheets.includes('if (RULES.DRONES_V73.link.enabled && (actor.type === "character" || actor.type === "npc") && allActors().some((a: any) => a.type === "vehicle")) out.push({ action: "droneLink"'));
    assert.ok(sheets.includes('droneLink: SR2CharacterSheet.#onDroneLink'));
    assert.ok(sheets.includes('clearDroneLink: SR2VehicleSheet.#onClearDroneLink'));
    assert.match(sheets, /#onClearDroneLink\(this: SR2VehicleSheet\) \{\s*if \(!game\.user\?\.isGM\) return ui\.notifications\.warn/);
    const chatSrc = read('src', 'module', 'applications', 'chat.ts');
    // v0.81.0: the click handler's chain became `dispatch` (it returns the handler's promise for the in-flight guard).
    assert.ok(chatSrc.includes("else if (action === 'applyDroneLink') return onApplyDroneLink(message, button);"));
    assert.ok(chatSrc.includes('applyDroneLink: onApplyDroneLink'));
  });
});

describe('O28 (5-A10) firmpoints and hardpoints', () => {
  const newWeapon = (v: any, data: any) => {
    const it: any = new SR2Item();
    Object.assign(it, { parent: v, type: 'weapon', name: data.name, id: null, system: {} });
    return it._preCreate({ type: 'weapon', ...data }, {}, 'gm1');
  };

  test('the vehicle model counts the points; untracked (both 0) as before', () => {
    const v = vehicle({ firmpoints: 1, hardpoints: 1 }, [mg('fixed'), { ...mg('turret', {}, 'Assault cannon'), id: 'ac' }]);
    const u = v.system.derived.mountUsage;
    assert.deepEqual({ t: u.tracked, f: u.firmNeeded, h: u.hardNeeded, o: u.over }, { t: true, f: 1, h: 1, o: false });
    assert.match(u.label, /Firmpoints 1\/1 · hardpoints 1\/1/);
    const plain = vehicle({}, [mg('fixed'), mg('turret')]);
    assert.equal(plain.system.derived.mountUsage.tracked, false);
  });

  test('adding a weapon past them: warned (and mounted) by default, refused in block mode, unchecked when off', async () => {
    const v = vehicle({ name: 'Bulldog', firmpoints: 1 }, [mg('fixed')]);
    assert.notEqual(await newWeapon(v, { name: 'LMG', system: { mount: 'turret' } }), false);
    assert.match(warnings.at(-1) ?? '', /Bulldog: LMG needs a firmpoint \(or a spare hardpoint\), and none is free: .* \(mounted anyway\)/);
    await withRule(DR().mounts, 'mode', 'block', async () => {
      assert.equal(await newWeapon(v, { name: 'LMG', system: { mount: 'turret' } }), false);
      assert.notEqual(await newWeapon(v, { name: 'Pistol', system: { mount: 'none' } }), false);   // not mounted: no point
      assert.equal(await newWeapon(v, { name: 'Assault cannon', system: { mount: 'turret' } }), false);
      assert.match(warnings.at(-1) ?? '', /Assault cannon needs a hardpoint/);
    });
    warnings.length = 0;
    await withRule(DR().mounts, 'mode', 'off', () => newWeapon(v, { name: 'LMG', system: { mount: 'turret' } }));
    assert.equal(warnings.length, 0);
  });

  test('_preUpdate: mounting an existing weapon is checked the same way; an item on a character never is', async () => {
    const v = vehicle({ name: 'Bulldog', firmpoints: 1 }, [mg('fixed'), { ...mg('none'), id: 'spare', name: 'Spare MG' }]);
    const it: any = new SR2Item();
    Object.assign(it, { parent: v, type: 'weapon', name: 'Spare MG', id: 'spare', system: { ...v.items.get('spare').system } });
    await withRule(DR().mounts, 'mode', 'block', async () => {
      assert.equal(await it._preUpdate({ system: { mount: 'pintle' } }, {}, GM()), false);
      assert.notEqual(await it._preUpdate({ system: { damagePower: 8 } }, {}, GM()), false);
      const carried: any = new SR2Item();
      Object.assign(carried, { parent: who(), type: 'weapon', name: 'Rifle', system: {} });
      assert.notEqual(await carried._preCreate({ type: 'weapon', name: 'Rifle', system: { mount: 'turret' } }, {}, 'gm1'), false);
    });
  });

  test('sheets: the vehicle and item sheets show the points', () => {
    assert.ok(sheets.includes('mountUsage: sys.derived?.mountUsage ?? null'));
    assert.ok(sheets.includes('mountsTracked: RULES.DRONES_V73.mounts.mode !== "off"'));
    assert.ok(sheets.includes(`mountPointChoices: [{ key: "", label: tx('SR2E.App.Sheets.byKind') }, { key: "firm", label: tx('SR2E.App.Sheets.firmpoint') }, { key: "hard", label: tx('SR2E.App.Sheets.hardpoint') }]`));
    const vs = read('public', 'templates', 'actor-vehicle-sheet.hbs');
    assert.ok(vs.includes('name="system.firmpoints"') && vs.includes('name="system.hardpoints"') && vs.includes('name="system.link.encryption"'));
    assert.ok(vs.includes('data-action="clearDroneLink"'));
    assert.ok(read('public', 'templates', 'item-sheet.hbs').includes('name="system.mountPoint"'));
  });
});

describe('O28 (5-A11) guided missiles lock on to Signature', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  const fireAt = async (targetExtra: any = {}) => {
    const d = vehicle({ name: 'Launcher drone', drone: true, pilot: 3, autonav: 0 }, [mg('turret', { guidance: 3, damagePower: 12, damageLevel: 'D', antiVehicle: true }, 'Missile launcher')]);
    const target = vehicle({ name: 'APC', signature: 3, ...targetExtra });
    faces.push(...Array(12).fill(1));
    const r = await d.fireMounted(d, d.items.get('wturretg'), { range: 'long', targetUuid: target.uuid });
    return { r, d, target };
  };

  test('at a vehicle: the Signature replaces the long range TN, ECM above ECCM adds; switched off the range TN stands', async () => {
    const { r } = await fireAt();
    const off = await withRule(DR().missiles, 'signature', false, async () => (await fireAt()).r);
    assert.ok(off.targetNumber > r.targetNumber, `${off.targetNumber} vs ${r.targetNumber}`);
    assert.equal(off.targetNumber - r.targetNumber, RULES.RANGE_TN.long - 3);
    const ecm = (await fireAt({ ecm: 2 })).r;
    assert.equal(ecm.targetNumber, r.targetNumber + 2);
    assert.equal(r.totalDice, 3 + 3);                                    // Pilot 3 + the missile's Intelligence 3
  });

  test('needsLock: a vehicle\'s missile without a sensor lock flies unguided (no Intelligence dice)', async () => {
    const { r } = await withRule(DR().missiles, 'needsLock', true, () => fireAt());
    assert.equal(r.totalDice, 3);
  });
});

// =============================================================================================== Characters, skills, the street

describe('O29 the skill dialog does not remember the complementary skill', () => {
  test('sheets.ts: the skill dialog\'s memory marker reads skillRollMemoryFields()', () => {
    assert.ok(sheets.includes('${rememberMarker(`skill|${actor.uuid}|${item.id ?? item.name}`, skillRollMemoryFields())}'));
    assert.ok(!sheets.includes('["useSpec", "useConc", "comp"]'));
  });
});

describe('O30 negotiating pay reads the opposed-attribute house rule', () => {
  const pair = () => {
    const face = who({ name: 'Face' }, [skill('neg', 'Negotiation', 4, 'charisma')]);
    const mrj = who({ name: 'Johnson' }, [skill('neg', 'Negotiation', 3, 'charisma')], { ...A, charisma: 2, willpower: 6 });
    return { face, mrj };
  };

  test('negotiatePay: each side\'s TN is the other\'s Willpower (CHARACTERS_V58.negotiation.opposedAttribute)', async () => {
    const { face, mrj } = pair();
    faces.push(1, 1, 1, 1, 1, 1, 1);
    assert.ok(await face.negotiatePay(10000, mrj.uuid));
    assert.match(chat.at(-1).content, /Face: Negotiation vs Johnson's Willpower 6/);
    assert.match(chat.at(-1).content, /Johnson: Negotiation vs Face's Willpower 5/);
    assert.equal(chat.at(-1).flags.sr2e.contest.pay, 10000);
  });

  test('switched off: the social skills table (Willpower since the v0.77.0 book check; Charisma when the GM sets it back); the preview agrees with the roll', async () => {
    const { face, mrj } = pair();
    faces.push(1, 1, 1, 1, 1, 1, 1);
    await withRule(CH().negotiation, 'useOpposedAttribute', false, () => face.negotiatePay(10000, mrj.uuid));
    assert.match(chat.at(-1).content, /Face: Negotiation vs Johnson's Willpower 6/);
    assert.equal(face.socialPreview(mrj, 'Negotiation', [], 'willpower').tnMine, 6);
    assert.equal(face.socialPreview(mrj, 'Negotiation', []).tnMine, 6);
    await withRule(RULES.SOCIAL.skills as any, 'Negotiation', 'charisma', async () => {
      faces.push(1, 1, 1, 1, 1, 1, 1);
      await withRule(CH().negotiation, 'useOpposedAttribute', false, () => face.negotiatePay(10000, mrj.uuid));
      assert.match(chat.at(-1).content, /Face: Negotiation vs Johnson's Charisma 2/);
    });
    assert.ok(sheets.includes('actor.socialPreview(who, g.skill, [], negotiationAttribute())'));
  });
});

describe('O31 a lifestyle bought outright is owned for good', () => {
  test('lifestyleStatus: permanent, never overdue; payLifestyle has nothing to pay; switched off the old days count', async () => {
    const a = who({ name: 'Owner', nuyen: 5000, lifestyle: { level: 'low', paidUntil: 0, outright: true } });
    g.game.time.worldTime = 400 * 86400;
    assert.deepEqual({ p: a.lifestyleStatus().permanent, d: a.lifestyleStatus().days }, { p: true, d: null });
    assert.equal(await a.payLifestyle(1), false);
    assert.match(infos.at(-1) ?? '', /owned outright: nothing to pay/);
    assert.equal(a.system.nuyen, 5000);
    await withRule(CH().lifestyle, 'outrightPermanent', false, () => {
      const st = a.lifestyleStatus();
      assert.equal(st.permanent, false);
      assert.ok((st.days ?? 0) < 0);
    });
  });

  test('buyLifestyleOutright: the creation price, a card; refused when short or already owned', async () => {
    const { lifestyleOutright } = await import('../rules/index.ts');
    const price = lifestyleOutright({ lifestyle: 'low' }).cost;
    const a = who({ name: 'Buyer', nuyen: price + 100, lifestyle: { level: 'low', paidUntil: -1, outright: false } });
    assert.equal(await a.buyLifestyleOutright(), true);
    assert.equal(a.system.nuyen, 100);
    assert.equal(a.system.lifestyle.outright, true);
    assert.equal(a.lifestyleStatus().permanent, true);
    assert.match(chat.at(-1).content, /Buyer<\/strong> buys the .* lifestyle outright \(¥/);
    assert.equal(a.system.ledger.at(-1).amount, -price);
    assert.equal(await a.buyLifestyleOutright(), false);
    assert.match(warnings.at(-1) ?? '', /already owned outright/);
    const poor = who({ name: 'Poor', nuyen: 10 });
    assert.equal(await poor.buyLifestyleOutright(), false);
    assert.match(warnings.at(-1) ?? '', /Can't buy the .* lifestyle outright: it costs/);
    await withRule(CH().lifestyle, 'buyLater', false, async () => { assert.equal(await who({ nuyen: price }).buyLifestyleOutright(), false); });
  });

  test('with the approval queue: the player\'s purchase waits; the GM\'s approval buys it', async () => {
    const { lifestyleOutright } = await import('../rules/index.ts');
    const { approveRequest, requestsOf } = await import('../applications/approvals.ts');
    const price = lifestyleOutright({ lifestyle: 'low' }).cost;
    settings['approvalQueue'] = true;
    const a = who({ name: 'Buyer', nuyen: price });
    g.game.user = PLAYER();
    assert.equal(await a.buyLifestyleOutright(), false);
    const reqs = requestsOf(a);
    assert.equal(reqs.length, 1);
    assert.match(reqs[0]!.label, /Buy .* lifestyle outright \(¥/);
    assert.equal(a.system.nuyen, price);
    g.game.user = GM();
    assert.equal(await approveRequest(a, reqs[0]!.id), true);
    assert.equal(a.system.lifestyle.outright, true);
    assert.equal(a.system.nuyen, 0);
  });

  test('_preUpdate: a new lifestyle level is rented from now (keepOnLevelChange keeps it owned)', async () => {
    g.game.time.worldTime = 5000;
    const a = who({ name: 'Mover', lifestyle: { level: 'low', paidUntil: 0, outright: true } });
    const ch: any = { system: { lifestyle: { level: 'middle' } } };
    await a._preUpdate(ch, {}, null);
    assert.deepEqual({ ...ch.system.lifestyle }, { level: 'middle', outright: false, paidUntil: 5000 });
    const same: any = { system: { lifestyle: { level: 'middle', outright: true } } };
    await a._preUpdate(same, {}, null);
    assert.equal(same.system.lifestyle.outright, true);                 // the same update says so
    const kept: any = { 'system.lifestyle.level': 'high' };
    await withRule(CH().lifestyle, 'keepOnLevelChange', true, () => a._preUpdate(kept, {}, null));
    assert.equal(kept.system?.lifestyle?.outright, undefined);
  });

  test('applyBuild (the quick builder) and the wizard: outright = owned for good; switched off the old months', async () => {
    const a = who({ name: 'Built', nuyen: 0 });
    g.game.time.worldTime = 1000;
    await a.applyBuild({ priorities: { resources: 'A' }, outright: true });
    assert.deepEqual({ o: a.system.lifestyle.outright, p: a.system.lifestyle.paidUntil }, { o: true, p: 1000 });
    const b = who({ name: 'Built old', nuyen: 0 });
    await withRule(CH().lifestyle, 'outrightPermanent', false, () => b.applyBuild({ priorities: { resources: 'A' }, outright: true }));
    assert.equal(b.system.lifestyle.outright, false);
    assert.ok(b.system.lifestyle.paidUntil > 1000 + 30 * 86400);
    const wizard = read('src', 'module', 'applications', 'creation.ts');
    assert.ok(wizard.includes('creationLifestylePatch({ outright: Boolean(out), months: d.months, now } as any)'));
    // v0.89.2: the dialog text is in lang/en.json now
    assert.ok(wizard.includes("RULES.CHARACTERS_V73.lifestyle.outrightPermanent ? tx('SR2E.Dialog.Creation.outrightOwnedForGood')"));
  });

  test('sheets.ts: the Pay dialog offers Buy outright; the Upkeep tab shows "Owned outright"; approvals may run it', () => {
    assert.ok(sheets.includes('if (choice?.outright) await actor.buyLifestyleOutright();'));
    assert.ok(sheets.includes('status: lifestyleStatusText(st),'));
    assert.ok(sheets.includes('overdue: !st.permanent && st.days != null && st.days < 0,'));
    assert.match(read('src', 'module', 'applications', 'approvals.ts'), /const METHODS = new Set\(\[[^\]]*'buyLifestyleOutright'/);
  });
});

describe('O32 / O33 / O37 the skill picker (adding.ts)', () => {
  const adding = read('src', 'module', 'applications', 'adding.ts');
  test('O32: a skill learned with training time is made from timedNewSkillSystem (the specialization kept)', () => {
    assert.ok(adding.includes('const ts = timedNewSkillSystem({ kind: r.kind, attribute, spec: r.spec } as any);'));
    assert.ok(adding.includes("createEmbeddedDocuments('Item', [{ name: r.name, type: 'skill', system: ts.system }])"));
  });
  test('O33: the picker prices the band from skillBandAttribute (as improve() does)', () => {
    assert.ok(adding.includes("skillBandAttribute(key, actor.system?.attributes ?? {}, { derivedReaction: Number(actor.system?.derived?.reaction ?? 1), caller: 'picker' } as any)"));
  });
  test('O37: the picker lists canonical names, saves "Rotorcraft" as "Rotor Aircraft" and refuses an alias already on the sheet', () => {
    assert.ok(adding.includes('canonicalSkillNames(COMMON_SKILLS[k])'));
    assert.ok(adding.includes('r.name = canonicalSkillName(r.name);'));
    assert.ok(adding.includes("sameSkillName(i.name, r.name)"));
  });
});

describe('O33 improve(): the Karma band for a Reaction-linked skill', () => {
  const sam = () => who({ name: 'Wheelman' }, [
    skill('car', 'Car', 5, 'reaction'),
    { id: 'wr', type: 'cyberware', name: 'Wired reflexes 2', system: { installed: true, essenceCost: 3, grade: 'standard', attributes: {}, reaction: 4, initiativeDice: 2 } },
  ]);
  test('natural Reaction by default (5 → 6 above it); the augmented basis reads the wired Reaction (cheaper); agree off = natural', async (t) => {
    t.after(oldWay({ 'DOCS_V79.skillKarma.mode': 'bands' })); // v0.79.0: attribute bands only exist in the old skill Karma
    const a = sam();
    assert.ok(a.system.derived.reaction > 5);
    const nat = a.improveCost({ skillId: 'car' }).cost;
    const aug = await withRule(CH().skillCost, 'basis', 'augmented', () => a.improveCost({ skillId: 'car' }).cost);
    assert.ok(aug < nat, `${aug} < ${nat}`);
    assert.equal(await withRule(CH().skillCost, 'agree', false, () => a.improveCost({ skillId: 'car' }).cost), nat);
  });
});

describe('O34 racial modifiers cannot take an attribute below 1', () => {
  const troll = () => who({ name: 'Troll', metatype: 'troll', karma: { pool: 0, poolSpent: 0, good: 50, career: 50 } }, [], { ...A, charisma: 2 });
  test('the model floors the natural rating at 1, keeps the raw one and warns', () => {
    const t = troll();
    const ch = t.system.attributes.charisma;
    assert.deepEqual({ n: ch.natural, r: ch.rawNatural, t: ch.total }, { n: 1, r: 0, t: 1 });
    assert.ok(t.system.derived.attributeWarnings.some((w: string) => /Charisma: base 2 − 2 \(Troll\) is 0; the base must be at least 3/.test(w)));
  });
  test('improve() from a floored rating buys the rise for real (base 2 → 4: natural 2)', async () => {
    await withRule(RULES.CHARACTERS_V58.training, 'mode', 'instant', () => raise());
  });
  const raise = async () => {
    const t = troll();
    const c = t.improveCost({ attribute: 'charisma' });
    assert.deepEqual({ f: c.from, to: c.to }, { f: 1, to: 2 });
    assert.equal(await t.improve({ attribute: 'charisma' }), true);
    assert.equal(t.system.attributes.charisma.base, 4);
    assert.equal(t.system.attributes.charisma.natural, 2);
  };
  test("'warn' warns without flooring; 'off' is the old way (0, no warning)", async () => {
    await withRule(CH().racialFloor, 'mode', 'warn', () => {
      const t = troll();
      assert.equal(t.system.attributes.charisma.natural, 0);
      assert.ok(t.system.derived.attributeWarnings.some((w: string) => /Charisma/.test(w)));
    });
    await withRule(CH().racialFloor, 'mode', 'off', () => {
      const t = troll();
      assert.equal(t.system.attributes.charisma.natural, 0);
      assert.deepEqual(t.system.derived.attributeWarnings, []);
    });
  });
  test('buildCheck: a Racial modifiers row fails until the base is high enough', () => {
    const input = (cha: number) => ({ priorities: {}, metatype: 'troll', magic: 'none' as const, attributes: { body: 4, quickness: 4, strength: 4, charisma: cha, intelligence: 4, willpower: 4 }, intelligence: 4, activeSkills: [], knowledgeSkills: [], gearCost: 0, nuyen: 0, essence: 6 });
    const row = buildCheck(input(2)).find((r) => r.label === 'Racial modifiers');
    assert.ok(row && !row.ok);
    assert.match(String(row.note), /Charisma to 3/);
    assert.equal(buildCheck(input(3)).find((r) => r.label === 'Racial modifiers'), undefined);
  });
});

describe('O35 NPCs: Threat Rating, Professional Rating 1–4, no grunt Karma Pool', () => {
  test('generateNpc and npcActorData carry the Threat Rating; PR from 1–4; no Karma Pool', () => {
    const p = generateNpc({ threat: 5, archetype: 'guard', magic: 'none' }, makeRng(3));
    assert.deepEqual({ t: p.threatRating, pr: p.professionalRating, k: p.karmaPool }, { t: 5, pr: 4, k: 0 });
    assert.equal(npcActorData(p).actor.system['threatRating'], 5);
    const p0 = generateNpc({ threat: 0, archetype: 'guard', magic: 'none' }, makeRng(3));
    assert.equal(p0.professionalRating, 1);                             // level 0 no longer fails every morale test
  });
  test('switched off: no Threat Rating and the table\'s PR and Karma Pool (the old way)', async () => {
    const npcs = CH().npcs;
    await withRule(npcs, 'threatRating', false, () => withRule(npcs, 'professionalFromTable', true, () => withRule(npcs, 'karmaPool', 'all', () => {
      const p = generateNpc({ threat: 5, archetype: 'guard', magic: 'none' }, makeRng(3));
      assert.equal(p.threatRating, 0);
      assert.equal(p.professionalRating, RULES.NPCGEN.threat[5]!.professionalRating);
      assert.equal(p.karmaPool, RULES.NPCGEN.threat[5]!.karmaPool);
    })));
  });
  test('a generated NPC\'s Threat Rating adds to its Combat Pool', (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.threat': 'pool' }));
    const npc = who({ name: 'Guard', type: 'npc', threatRating: 3 });
    const plain = who({ name: 'Guard 2', type: 'npc', threatRating: 0 });
    assert.equal(npc.system.derived.combatPool - plain.system.derived.combatPool, RULES.STREET.threat.addsToPool ? 3 : 0);
  });
  test('_preCreate: a new hand-made NPC starts with Karma Pool 0 unless given one; characters keep theirs', async () => {
    const make = (type: string) => { const a = who({ name: 'New', type, karma: { pool: 1, poolSpent: 0, good: 0, career: 0 } }); a.updateSource = (u: any) => { for (const [k, v] of Object.entries(u)) setPath(a, k, v); }; return a; };
    const npc = make('npc');
    await npc._preCreate({ type: 'npc', name: 'New' }, {}, 'gm1');
    assert.equal(npc.system.karma.pool, 0);
    const given = make('npc');
    await given._preCreate({ type: 'npc', name: 'New', system: { karma: { pool: 2 } } }, {}, 'gm1');
    assert.equal(given.system.karma.pool, 1);                           // left alone (the creation data has its own)
    const pc = make('character');
    await pc._preCreate({ type: 'character', name: 'New' }, {}, 'gm1');
    assert.equal(pc.system.karma.pool, 1);
    const old = make('npc');
    await withRule(CH().npcs, 'handMadeKarmaPool', null, () => old._preCreate({ type: 'npc', name: 'New' }, {}, 'gm1'));
    assert.equal(old.system.karma.pool, 1);
  });
});

describe('O36 house-rule metatypes', () => {
  const centaur = { label: 'Centaur', mods: { body: 2, quickness: 1, strength: 2, charisma: 0, intelligence: -1, willpower: 0 } };
  const withCentaur = async <T>(fn: () => T | Promise<T>): Promise<T> => {
    const types = RULES.METATYPES.types as any;
    types.centaur = { ...types.human, ...centaur };
    try { return await fn(); } finally { delete types.centaur; }
  };

  test('the model has no fixed metatype choices; the sheet lists metatypeOptions (house rules included)', () => {
    const models = read('src', 'module', 'models', 'index.ts');
    assert.ok(models.includes("metatype: new fields.StringField({ required: true, initial: 'human' }),"));
    assert.ok(!models.includes('choices: METATYPE_IDS'));
    assert.ok(sheets.includes('metatypeChoices: metatypeOptions(actor.system.metatype),'));
  });

  test('characterImportPlan: a house-rule metatype is set; an unknown one is refused, naming the list as it is now', async () => {
    await withCentaur(() => {
      const plan: any = characterImportPlan({ ...parseCharacterSheet(''), metatype: 'centaur' });
      assert.equal(plan.actorUpdate['system.metatype'], 'centaur');
      assert.ok(!plan.warnings.some((w: string) => /centaur/.test(w)));
    });
    const plan: any = characterImportPlan({ ...parseCharacterSheet(''), metatype: 'centaur' });
    assert.equal(plan.actorUpdate['system.metatype'], undefined);
    assert.ok(plan.warnings.some((w: string) => /Metatype "centaur" is not one of human, .*troll/.test(w)));
  });

  test('a house-rule metatype\'s racial modifiers apply on the sheet', async () => {
    await withCentaur(() => {
      const a = who({ name: 'Hoofs', metatype: 'centaur' });
      assert.equal(a.system.attributes.body.natural, A.body + 2);
      assert.equal(a.system.derived.metatype, 'Centaur');
    });
  });
});

describe('O37 one name per skill', () => {
  test('findSkill: a skill saved as "Rotorcraft" answers to "Rotor Aircraft" (and back); switched off only the exact name', async () => {
    const a = who({ name: 'Pilot' }, [skill('rc', 'Rotorcraft', 4, 'reaction')]);
    assert.equal(a.findSkill('Rotor Aircraft')?.id, 'rc');
    const b = who({ name: 'Pilot 2' }, [skill('ra', 'Rotor Aircraft', 3, 'reaction')]);
    assert.equal(b.findSkill('Rotorcraft')?.id, 'ra');
    await withRule(CH().skillNames, 'canonical', false, () => { assert.equal(a.findSkill('Rotor Aircraft'), undefined); });
  });
  test('the NPC generator\'s rigger has Rotor Aircraft, not Rotorcraft', () => {
    const names = Array.from({ length: 6 }, (_, t) => generateNpc({ threat: t, archetype: 'rigger', magic: 'none' }, makeRng(7)).skills.map((s: any) => s.name)).flat();
    assert.ok(names.includes('Rotor Aircraft'), names.join(', '));
    assert.ok(!names.includes('Rotorcraft'));
  });
});

describe('O38 Exceptional Attribute, a dearer Karma band, surplus flaws', () => {
  const on = <T>(fn: () => T | Promise<T>) => withRule(RULES.STREET.qualities, 'enabled', true, fn);
  const edge = [{ name: 'Exceptional Attribute', kind: 'edge', points: 2, target: 'Strength' }];

  test('improveCost: at the racial maximum, refused; Exceptional Attribute allows one more', async (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.aboveMax': 'refuse' }));
    const plain = who({ name: 'Strong' }, [], { ...A, strength: 6 });
    assert.equal(plain.improveCost({ attribute: 'strength' }).ok, false);
    await on(() => {
      const a = who({ name: 'Exceptional', qualities: edge }, [], { ...A, strength: 6 });
      const c = a.improveCost({ attribute: 'strength' });
      assert.deepEqual({ ok: c.ok, to: c.to }, { ok: true, to: 7 });
      assert.ok(!a.system.derived.attributeWarnings.some((w: string) => /Strength/.test(w)));
      const b = who({ name: 'Exceptional 7', qualities: edge }, [], { ...A, strength: 7 });
      assert.ok(!b.system.derived.attributeWarnings.some((w: string) => /Strength 7 is above the natural maximum/.test(w)));
      const c7 = who({ name: 'Plain 7' }, [], { ...A, strength: 7 });
      assert.ok(c7.system.derived.attributeWarnings.some((w: string) => /Strength 7 is above the natural maximum 6/.test(w)));
    });
  });

  test('karmaAboveRacial (house rule): past the racial maximum at the dearer band, labelled', async () => {
    const a = who({ name: 'Strong' }, [], { ...A, strength: 6 });
    await withRule(CH().qualities.karmaAboveRacial, 'enabled', true, () => {
      const c = a.improveCost({ attribute: 'strength' });
      assert.deepEqual({ ok: c.ok, cost: c.cost }, { ok: true, cost: 7 * CH().qualities.karmaAboveRacial.multiplier });
      assert.match(c.label, /Strength \(above the racial maximum\)/);
    });
  });

  test('buildCheck: surplus flaw points add to the Skills row with the house rule (none by default)', async () => {
    const input = { priorities: { skills: 'C' as const }, metatype: 'human', magic: 'none' as const, attributes: {}, intelligence: 4, activeSkills: [], knowledgeSkills: [], gearCost: 0, nuyen: 0, essence: 6,
      qualities: [{ name: 'Bad Rep', kind: 'flaw' as const, points: 3 }, { name: 'Ambidextrous', kind: 'edge' as const, points: 1 }] };
    await on(async () => {
      const base = Number(buildCheck(input).find((r) => r.label === 'Skills')!.allowed);
      const more = await withRule(CH().qualities.surplusFlaws, 'use', 'skills', () => buildCheck(input));
      assert.equal(Number(more.find((r) => r.label === 'Skills')!.allowed), base + 2);
      const q = more.find((r) => /edges|flaws|qualit/i.test(r.label));
      assert.match(String(q?.note ?? ''), /2 surplus flaw points: \+2 skill points/);
    });
  });
});

// =============================================================================================== Cross-cutting bookkeeping

describe('O39 Region documents in the undo log (undo.ts hooks) and why an area is swept (canvas.ts)', () => {
  const region = (id: string, name: string) => ({ documentName: 'Region', id, uuid: `Scene.s1.Region.${id}`, name, parent: { uuid: 'Scene.s1' }, toObject() { return { _id: id, name }; } });
  const undo = async () => {
    const mod = await import('../applications/undo.ts');
    mod.registerUndoHooks();
    mod.SR2Undo.clear();
    mod.SR2Undo.endQuiet();
    return mod.SR2Undo;
  };

  test('a Region the GM draws or deletes is a step; switched off it isn\'t', async () => {
    const U = await undo();
    await fire('createRegion', region('r1', 'Smoke cloud'), {}, 'gm1');
    assert.equal(U.steps().length, 1);
    assert.deepEqual(U.steps()[0]!.entries.map((e: any) => [e.op, e.docName, e.name]), [['create', 'Region', 'Smoke cloud']]);
    U.clear();
    await withRule(CX().undo, 'regions', false, async () => {
      await fire('createRegion', region('r2', 'Ward'), {}, 'gm1');
      await fire('deleteRegion', region('r2', 'Ward'), {}, 'gm1');
    });
    assert.equal(U.steps().length, 0);
  });

  test('a timer sweep\'s deletion is not a step; a clock or Combat Turn sweep\'s is (skipTimedOut off: all are)', async () => {
    const U = await undo();
    await fire('deleteRegion', region('r3', 'Gas'), { sr2eAreaSweep: 'timer' }, 'gm1');
    assert.equal(U.steps().length, 0);
    await fire('deleteRegion', region('r4', 'Smoke'), { sr2eAreaSweep: 'clock' }, 'gm1');
    assert.equal(U.steps().length, 1);
    assert.equal(U.steps()[0]!.entries[0]!.op, 'delete');
    U.clear();
    await withRule(CX().undo, 'skipTimedOut', false, () => fire('deleteRegion', region('r5', 'Gas'), { sr2eAreaSweep: 'timer' }, 'gm1'));
    assert.equal(U.steps().length, 1);
    assert.ok(/limits: undoLimitsV73\((UNDO_LIMITS|undoLimits\(\))\)/.test(read('src', 'module', 'applications', 'ui.ts')));
  });

  test('registerAreaHooks: the sweep tells why it deletes (round, clock, combat end)', async () => {
    const { registerAreaHooks } = await import('../applications/canvas.ts');
    registerAreaHooks();
    const calls: any[] = [];
    const area = { id: 'a1', getFlag(_s: string, k: string) { return k === 'area' ? true : k === 'expires' ? { round: 1, combatId: 'c1' } : undefined; } };
    g.game.scenes = [{ regions: [area], async deleteEmbeddedDocuments(t: string, ids: string[], o: any) { calls.push({ t, ids, o }); } }];
    g.game.combats = [{ id: 'c1', started: true, round: 2 }];
    await fire('updateCombat', {}, { round: 2 });
    await fire('updateWorldTime', 30);
    await fire('deleteCombat', {});
    await wait(180);
    assert.deepEqual(calls.map((c) => c.o.sr2eAreaSweep).sort(), ['clock', 'combatEnd', 'round']);
    assert.deepEqual(calls[0].ids, ['a1']);
  });
});

describe('O40 the GM\'s "Change target number…" list (chat.ts)', () => {
  test('openRetarget builds its groups with retargetGroupsV73, passing the card\'s reveal kind and the applied rows', () => {
    const src = read('src', 'module', 'applications', 'chat.ts');
    assert.ok(src.includes('retargetGroupsV73(sd.kind, { reveal: sd.reveal, applied: [...have] } as any)'));
    assert.ok(src.includes('reveal: (snap as any).reveal?.kind'));
    assert.ok(!/\btnCandidates\(/.test(src), 'the old list is not called any more');
  });
});

describe('O41 statuses that outlive their reason', () => {
  test('tokens.ts: morale "broken" comes off everyone in a combat when it ends (active GM; switch off: it stays)', async () => {
    const { registerTokenHooks } = await import('../applications/tokens.ts');
    registerTokenHooks();
    const run = async () => {
      const a = who({ name: 'Ganger', flags: { sr2e: { broken: true } } });
      await fire('deleteCombat', { combatants: [{ actor: a }, { actor: a }] });
      await wait(5);
      return a.getFlag('sr2e', 'broken');
    };
    // v0.81.0 (A-13): cleared through helpers/flags.ts clearFlag (null on an unlinked token's actor, deleted elsewhere).
    assert.ok(!(await run()));
    assert.equal(await withRule(CX().statuses, 'brokenEndsWithCombat', false, run), true);
    g.game.users = Object.assign([GM()], { activeGM: { id: 'gm2', isSelf: false } });
    assert.equal(await run(), true);
  });

  test('timedEffects: a timed paralysis takes its power-effect entry with it; a sustained one stays; switch off: both stay', async () => {
    const run = async () => {
      const a = who({ name: 'Victim', flags: { sr2e: {
        powerEffects: [{ id: 'fx1', name: 'Paralyzing touch', status: 'paralysis', holdTurns: 2 }, { id: 'fx2', name: 'Binding', status: 'sr2eBound', holdTurns: 0 }],
        statusUntil: { paralysis: { round: -1, worldTime: 6 } },
      } } });
      g.game.actors = [a];
      await SR2Actor.timedEffects({ worldTime: 10 });
      return { ids: (a.getFlag('sr2e', 'powerEffects') ?? []).map((e: any) => e.id), until: a.getFlag('sr2e', 'statusUntil') };
    };
    const r = await run();
    assert.deepEqual(r.ids, ['fx2']);
    assert.deepEqual(r.until, { paralysis: null }); // live fix: null, since setFlag merges
    assert.match(chat.at(-1).content, /Victim is no longer paralysis/);
    assert.deepEqual((await withRule(CX().statuses, 'timedHoldEnds', false, run)).ids, ['fx1', 'fx2']);
  });
});

describe('O42 the advancement log and projects', () => {
  const recorded = (extra: any = {}, items: any[] = []) => who({ name: 'Ann', flags: { sr2e: { creation: { v: 1 }, advancement: [] } }, ...extra }, items);
  const log = (a: any) => a.getFlag('sr2e', 'advancement') as any[];

  test('logProjectDone: the requester, approved by the GM (and the GM who finished it early, once)', async () => {
    const { logProjectDone } = await import('../applications/advancement.ts');
    const a = recorded();
    await logProjectDone(a, 'Ares Predator', 'Corvo', false, 'GM');
    assert.deepEqual({ by: log(a)[0].by, ap: log(a)[0].approvedBy, w: log(a)[0].what }, { by: 'Corvo', ap: 'GM', w: 'Done: Ares Predator' });
    await logProjectDone(a, 'Ares Predator', 'Corvo', true, 'GM');
    assert.equal(log(a)[1].approvedBy, 'GM');
    assert.match(log(a)[1].what, /finished early by the GM/);
  });

  test('a project started by an approved request is the player\'s; its Done line says so', async () => {
    const { fileRequest, approveRequest, requestsOf } = await import('../applications/approvals.ts');
    settings['approvalQueue'] = true;
    const a = recorded();
    g.game.user = PLAYER();
    await fileRequest(a, { kind: 'improve', label: 'Order a Predator', data: { method: 'improve', args: [{}] } });
    g.game.user = GM();
    a.improve = async () => { await a.startProject({ kind: 'order', area: 'gear', label: 'Ares Predator', hours: 1, effect: {} }); return true; };
    assert.equal(await approveRequest(a, requestsOf(a)[0]!.id), true);
    const p = a.projects()[0];
    assert.deepEqual({ by: p.by, ap: p.approvedBy }, { by: 'Corvo', ap: 'GM' });
    g.game.actors = [a];
    await SR2Actor.timedEffects({ worldTime: 7200 });
    assert.equal(a.projects().length, 0);
    const done = log(a).find((l: any) => l.what === 'Done: Ares Predator');
    assert.deepEqual({ by: done?.by, ap: done?.approvedBy }, { by: 'Corvo', ap: 'GM' });
  });

  test('creditRequester off: the old way (the GM who clicked)', async () => {
    const { fileRequest, approveRequest, requestsOf } = await import('../applications/approvals.ts');
    settings['approvalQueue'] = true;
    const a = recorded();
    g.game.user = PLAYER();
    await fileRequest(a, { kind: 'improve', label: 'Order a Predator', data: { method: 'improve', args: [{}] } });
    g.game.user = GM();
    a.improve = async () => { await a.startProject({ kind: 'order', area: 'gear', label: 'Ares Predator', hours: 1, effect: {} }); return true; };
    await withRule(CX().advancement, 'creditRequester', false, () => approveRequest(a, requestsOf(a)[0]!.id));
    assert.deepEqual({ by: a.projects()[0].by, ap: a.projects()[0].approvedBy }, { by: 'GM', ap: undefined });
  });

  test('finished training: one Done line credited to who started it ("quiet": none)', async () => {
    const train = async () => {
      const a = recorded({}, [skill('pis', 'Pistols', 3)]);
      g.game.user = PLAYER();
      assert.equal(await a.improve({ skillId: 'pis' }), true);
      g.game.user = GM();
      const t = a.system.training[0];
      assert.equal(t.by, 'Corvo');
      g.game.actors = [a];
      await SR2Actor.timedEffects({ worldTime: t.readyAt });
      assert.equal(a.items.get('pis').system.rating, 4);
      return log(a).filter((l: any) => /^Done: Training/.test(l.what));
    };
    await withRule(RULES.CHARACTERS_V58.training, 'mode', 'timed', async () => {
      const lines = await train();
      assert.equal(lines.length, 1);
      assert.deepEqual({ by: lines[0].by, w: lines[0].what }, { by: 'Corvo', w: 'Done: Training Pistols 3 → 4' });
      assert.equal((await withRule(CX().advancement, 'trainingDone', 'quiet', train)).length, 0);
    });
  });

  test('a nuyen refund on Give up goes into the log when its purchase is there (advancement.ts hooks); off: not', async () => {
    const adv = await import('../applications/advancement.ts');
    adv.registerAdvancementHooks();
    const run = async () => {
      const a = recorded({ nuyen: 0 });
      a.flags.sr2e.advancement = [{ id: 's', at: '', t: 0, by: 'Ann', approvedBy: '', karma: 0, nuyen: -5000, kind: 'gain', what: 'Bought Ares Predator' }];
      const update = a.update.bind(a);
      a.update = async (d: any, o: any = {}) => { await fire('preUpdateActor', a, d, o, 'gm1'); await update(d); await fire('updateActor', a, d, o, 'gm1'); };
      const id = `p${++n}`;
      await a.update({ [`flags.sr2e.projects.${id}`]: { id, kind: 'order', area: 'gear', label: 'Ares Predator on order', hours: 24, startedAt: 0, readyAt: 86400, paid: { karma: 0, nuyen: 5000 }, effect: {}, by: 'Ann' } }, { sr2eNoAdvance: true });
      assert.equal(await a.cancelProject(id), true);
      assert.equal(a.system.nuyen, 5000);
      await adv.flushAdvancement();
      return log(a).filter((l: any) => l.nuyen > 0);
    };
    const lines = await run();
    assert.equal(lines.length, 1);
    assert.deepEqual({ n: lines[0].nuyen, r: lines[0].refund, w: lines[0].what }, { n: 5000, r: true, w: 'Given up (refund): Ares Predator on order' });
    assert.equal((await withRule(CX().advancement, 'nuyenRefunds', 'off', run)).length, 0);
    assert.ok(read('src', 'module', 'applications', 'charinfo.ts').includes('totals: advancementTotalsV73(log),'));
  });
});

describe('O43 a vehicle mod installed over time is paid up front', () => {
  const setup = (payerIsMech = true) => {
    const mech = who({ name: 'Mech', nuyen: 10000 }, [skill('br', 'Car B/R', 4, 'intelligence')]);
    const owner = who({ name: 'Owner', nuyen: 10000 });
    // Named: an unnamed mod never goes in at the end of the project (see the BUG test below).
    const v = vehicle({ name: 'Van', mods: [{ id: 'm', name: 'Armor plates', kind: 'armor', rating: 2, cost: 0, installed: false, stat: '', delta: 0 }] });
    g.game.actors = [mech, owner, v];
    return { mech, owner, v, payer: payerIsMech ? mech : owner };
  };
  const waiting = <T>(fn: () => T | Promise<T>) => withRule(RULES.WAITING, 'enabled', true, fn);
  const install = async (mech: any, v: any, payer: any) => { faces.push(6, 6, 1, 1, 1, 1); return mech.installModTest(v, 0, { payer }); };

  test('the installer pays now; the mod goes in later without a second charge; Give up pays it back', async () => {
    await waiting(async () => {
      const { mech, v } = setup();
      await install(mech, v, mech);
      assert.equal(mech.system.nuyen, 2000);                            // ¥8,000 now
      assert.match(chat.at(-1).content, /paid now \(¥8,000; given back if it's given up\)/);
      const p = mech.projects()[0];
      assert.equal(p.paid.nuyen, 8000);
      await SR2Actor.timedEffects({ worldTime: p.readyAt });
      assert.equal(v.system.mods[0].installed, true);
      assert.equal(mech.system.nuyen, 2000);
      const again = setup();
      await install(again.mech, again.v, again.mech);
      await again.mech.cancelProject(again.mech.projects()[0].id);
      assert.equal(again.mech.system.nuyen, 10000);
    });
  });

  test('someone else pays: refunded to them on Give up (refundModPayer), and when the mod can\'t go in', async () => {
    await waiting(async () => {
      const { mech, owner, v } = setup(false);
      await install(mech, v, owner);
      assert.equal(owner.system.nuyen, 2000);
      assert.equal(mech.system.nuyen, 10000);
      assert.equal(mech.projects()[0].paid.nuyen, 0);
      await mech.cancelProject(mech.projects()[0].id);
      assert.equal(owner.system.nuyen, 10000);
      const b = setup(false);
      await install(b.mech, b.v, b.owner);
      b.v.system.mods = [];                                              // the mod is gone meanwhile
      await SR2Actor.timedEffects({ worldTime: b.mech.projects()[0].readyAt });
      assert.equal(b.owner.system.nuyen, 10000);
      // v0.81.1 (D1-3): the note now says what really happened (the call ran and gave back what was paid up front).
      assert.match(chat.at(-1).content, /couldn't be finished .* what was paid up front was given back/);
    });
  });

  test('switched off: paid when it goes in (the old way)', async () => {
    await waiting(() => withRule(CX().modInstall, 'payUpFront', false, async () => {
      const { mech, v } = setup();
      await install(mech, v, mech);
      assert.equal(mech.system.nuyen, 10000);
      assert.match(chat.at(-1).content, /it is paid for then/);
      await SR2Actor.timedEffects({ worldTime: mech.projects()[0].readyAt });
      assert.equal(v.system.mods[0].installed, true);
      assert.equal(mech.system.nuyen, 2000);
    }));
  });
});

describe('v0.73.0 review: known gaps (skipped until fixed)', () => {
  // BUG (finishModInstall since v0.65.0; since v0.73.0 O43 it pays the parts back instead of charging): documents/index.ts
  // finishModInstall compares mods[index].name ('' for a mod saved without a name, the vehicle sheet's default) with the
  // modName installModTest passed (the kind's label), then looks for a mod NAMED that label, finds none and gives up:
  // with waiting time on, an unnamed mod never goes in ("couldn't be finished"). Un-skip when fixed.
  test('an unnamed mod (the sheet\'s default) goes in when its project ends', async () => {
    await withRule(RULES.WAITING, 'enabled', true, async () => {
      const mech = who({ name: 'Mech', nuyen: 10000 }, [skill('br', 'Car B/R', 4, 'intelligence')]);
      const v = vehicle({ name: 'Van', mods: [{ id: 'm', name: '', kind: 'armor', rating: 2, cost: 0, installed: false, stat: '', delta: 0 }] });
      g.game.actors = [mech, v];
      faces.push(6, 6, 1, 1, 1, 1);
      await mech.installModTest(v, 0, { payer: mech });
      await SR2Actor.timedEffects({ worldTime: mech.projects()[0].readyAt });
      assert.equal(v.system.mods[0].installed, true);
      assert.equal(mech.system.nuyen, 2000);
    });
  });

  // BUG (O36, partly): rules/charimport.ts metatypeFromText only knows the built-in words (METATYPE_WORDS), so a sheet
  // saying "Metatype: Centaur" is refused even when the house rules add a centaur, and the warning lists "centaur" as
  // known. characterImportPlan accepts the id, but nothing in the text import produces it. Un-skip when fixed.
  test('a pasted sheet with a house-rule metatype imports it', () => {
    const types = RULES.METATYPES.types as any;
    types.centaur = { ...types.human, label: 'Centaur', mods: { body: 2 } };
    try {
      assert.equal(parseCharacterSheet('Name: Hoofs\nMetatype: Centaur\n').metatype, 'centaur');
    } finally { delete types.centaur; }
  });
});
