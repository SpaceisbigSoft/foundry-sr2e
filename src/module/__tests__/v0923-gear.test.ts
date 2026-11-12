/**
 * v0.92.3 book alignment, gear, cyberware and bioware (RULES.GEAR_V923), the Foundry glue side: models/index.ts and
 * documents/index.ts. The pure rules are in rules/__tests__/v0923-gear.test.ts. The stubs are a copy of v078.test.ts's
 * (scripted dice, a chat log, warnings), with dice of any size. These check OUR wiring, not Foundry.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';

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
    const m = /^(\d+)d\d+(?:\s*\+\s*(\d+))?$/.exec(this.formula);
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

let CharacterDataModel: any, SR2Actor: any;

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
  ({ CharacterDataModel } = await import('../models/index.ts'));
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
  a.uuid = `Actor.v923g-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}


const bio = (id: string, name: string, bioKind: string, rating: number, bodyIndex = 0.4) => ({ id, type: 'cyberware', name,
  system: { bioware: true, bioKind, rating, bodyIndex, installed: true, essenceCost: 0, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0 } });


/** A cyberware item with flags (the surgery and the adrenal pump keep theirs on the item). */
const ware = (id: string, name: string, system: any) => ({ id, type: 'cyberware', name, flags: {} as any,
  getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; }, async setFlag(s: string, k: string, v: any) { ((this.flags ??= {})[s] ??= {})[k] = v; },
  system: { essenceCost: 0, grade: 'standard', installed: true, bioware: false, kind: 'other', rating: 0, attributes: {}, reaction: 0, initiativeDice: 0, armorBallistic: 0, armorImpact: 0, housedIn: '', ...system } });
const limb = (id: string, location: string, name = 'Cyberarm') => ware(id, name, { kind: 'cyberlimb', essenceCost: 1, limb: { location, strength: 4, quickness: 4, capacity: 1 } });

describe('v0.92.3 gear glue: dermal plating, cyberlimbs, bone lacing', () => {
  test('dermal plating adds to Body, not armor; armor: the old way', (t) => {
    const a = who({}, [ware('dp', 'Dermal plating 2', { rating: 2, armorBallistic: 2, armorImpact: 2, essenceCost: 1 })]);
    assert.equal(a.system.attributes.body.total, 6);
    assert.deepEqual(a.system.derived.cyberArmor, { ballistic: 0, impact: 0 });
    assert.equal(a.system.derived.cyber.dermal, 2);
    t.after(oldWay({ 'GEAR_V923.dermal': 'armor' }));
    a.system.prepareDerivedData();
    assert.equal(a.system.attributes.body.total, 4);
    assert.deepEqual(a.system.derived.cyberArmor, { ballistic: 2, impact: 2 });
  });
  test('review fix: plating that is Body no longer takes orthoskin\'s armor away; the old way keeps the conflict', (t) => {
    const ortho = { id: 'os', type: 'cyberware', name: 'Orthoskin 3', system: { bioware: true, bioKind: 'orthoskin', rating: 3, bodyIndex: 0.5, installed: true, attributes: {} } };
    const a = who({}, [ware('dp', 'Dermal plating 2', { rating: 2, armorBallistic: 2, armorImpact: 2, essenceCost: 1 }), ortho]);
    assert.deepEqual(a.system.derived.cyberArmor, { ballistic: 1, impact: 2 }, 'orthoskin 3: 2 impact, 1 ballistic');
    assert.ok(a.system.derived.cyberWarnings.some((w: string) => /Orthoskin/.test(w)), 'still incompatible (a warning)');
    t.after(oldWay({ 'GEAR_V923.dermal': 'armor' }));
    a.system.prepareDerivedData();
    assert.deepEqual(a.system.derived.cyberArmor, { ballistic: 2, impact: 2 }, 'the old way: the plating\'s armor, orthoskin cancelled');
  });
  test('dermal plating counts once on the permanent damage test (in Body; the old way as dermal armor dice)', async (t) => {
    const a = who({}, [ware('dp', 'Dermal plating 2', { rating: 2, armorBallistic: 2, armorImpact: 2, essenceCost: 1 })]);
    faces.push(...Array(12).fill(1));
    await a.rollPermanentDamage();
    assert.match(chat.at(-1).content, /Body 6 dice \(dermal armor 0\)/);
    t.after(oldWay({ 'GEAR_V923.dermal': 'armor' }));
    a.system.prepareDerivedData();
    faces.length = 0; faces.push(...Array(12).fill(1));
    await a.rollPermanentDamage();
    assert.match(chat.at(-1).content, /Body 6 dice \(dermal armor 2\)/);
  });
  test('a pair of cyberarms adds +1 Body; off: none', (t) => {
    const a = who({}, [limb('l', 'leftArm'), limb('r', 'rightArm')]);
    assert.equal(a.system.attributes.body.total, 5);
    t.after(oldWay({ 'GEAR_V923.limbPairs': 'off' }));
    a.system.prepareDerivedData();
    assert.equal(a.system.attributes.body.total, 4);
  });
  test('ware housed in a cyberarm: a smartlink costs .25, other ware its full Essence; capacity: none', (t) => {
    const a = who({}, [limb('l', 'leftArm'), ware('sl', 'Smartlink', { essenceCost: 0.5, housedIn: 'l' }), ware('gun', 'Cyber gun', { essenceCost: 0.4, housedIn: 'l' })]);
    assert.equal(a.system.derived.essence, 6 - 1 - 0.25 - 0.4);
    t.after(oldWay({ 'GEAR_V923.limbHoused': 'capacity' }));
    a.system.prepareDerivedData();
    assert.equal(a.system.derived.essence, 5);
  });
  test('titanium bone lacing: +2 Body, +1/+1 armor, no soak dice; dice: the old way', (t) => {
    const a = who({}, [ware('bl', 'Bone lacing (titanium)', { kind: 'boneLacing', lacing: 'titanium', essenceCost: 2.25 })]);
    assert.equal(a.system.attributes.body.total, 6);
    assert.deepEqual(a.system.derived.cyberArmor, { ballistic: 1, impact: 1 });
    assert.equal(a.system.derived.cyber.lacing.soakDice, 0);
    assert.equal(a.system.derived.cyber.lacing.unarmedPower, 3);
    t.after(oldWay({ 'GEAR_V923.boneLacing': 'dice' }));
    a.system.prepareDerivedData();
    assert.equal(a.system.attributes.body.total, 4);
    assert.equal(a.system.derived.cyber.lacing.soakDice, 3);
  });
});

describe('v0.92.3 gear glue: Essence, bioware', () => {
  test('Essence exactly 0 is alive; dead: the old way', (t) => {
    const a = who({}, [ware('w', 'Wired reflexes 3', { essenceCost: 5 }), ware('d', 'Datajack', { essenceCost: 1 })]);
    assert.equal(a.system.derived.essence, 0);
    assert.notEqual(a.system.derived.status, 'dead');
    t.after(oldWay({ 'GEAR_V923.essenceZero': 'dead' }));
    a.system.prepareDerivedData();
    assert.equal(a.system.derived.status, 'dead');
  });
  test('a magician pays Essence for bioware (Magic follows); magic: Magic − half the Body Index', (t) => {
    const a = who({ magic: 6, tradition: 'hermetic' }, [bio('ma', 'Muscle augmentation 2', 'muscleAugmentation', 2, 1.6)]);
    assert.equal(a.system.derived.essence, 4.4);
    t.after(oldWay({ 'GEAR_V923.awakenedBioware': 'magic' }));
    a.system.prepareDerivedData();
    assert.equal(a.system.derived.essence, 6);
    assert.equal(a.system.derived.magic, 6 - Math.floor(1.6 * 0.5));
  });
  test('muscle augmentation raises Quickness (and Reaction); an adrenal pump +2 Reaction, its Quickness not', async (t) => {
    const a = who({}, [bio('ma', 'Muscle augmentation 1', 'muscleAugmentation', 1, 0.8)]);
    assert.deepEqual([a.system.attributes.quickness.total, a.system.attributes.strength.total, a.system.derived.reaction], [6, 5, 5]);
    const b = who({}, [{ ...bio('ap', 'Adrenal pump 1', 'adrenalPump', 1, 1.25), getFlag() { return undefined; }, async setFlag() {} }]);
    const before = b.system.derived.reaction;
    faces.push(4);
    await b.setAdrenalPump('ap', true);
    assert.equal(b.system.attributes.quickness.total, 6);
    assert.equal(b.system.derived.reaction, before + 2);
    assert.match(chat.at(-1).content, /4 turns/);
    t.after(oldWay({ 'GEAR_V923.bioware': 'old' }));
    b.system.prepareDerivedData();
    assert.equal(b.system.derived.reaction, Math.floor((6 + 5) / 2));
  });
  test('the adrenal crash: Deadly Stun at half the turns; old: Body vs 6, M Stun', async (t) => {
    const it = { ...bio('ap', 'Adrenal pump 1', 'adrenalPump', 1, 1.25), flags: {} as any, getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; }, async setFlag(s: string, k: string, v: any) { ((this.flags ??= {})[s] ??= {})[k] = v; } };
    const a = who({}, [it]);
    faces.push(5);
    await a.setAdrenalPump('ap', true);
    await a.setAdrenalPump('ap', false);
    assert.match(chat.at(-1).content, /Body vs 2, D Stun/);
    assert.equal(chat.at(-1).flags.sr2e.adrenalCrash.turns, 5);
    t.after(oldWay({ 'GEAR_V923.adrenalCrash': 'old' }));
    await a.setAdrenalPump('ap', true);
    await a.setAdrenalPump('ap', false);
    assert.match(chat.at(-1).content, /Body vs 6, M Stun/);
  });
  test('over the Body Index: system shock on Body tests; rejection: none', (t) => {
    const a = who({}, [bio('s', 'Suprathyroid', 'other', 1, 5.5)]);
    assert.deepEqual(a.bodyShockMods().map((m: any) => m.value), [2]);
    t.after(oldWay({ 'GEAR_V923.overBodyIndex': 'rejection' }));
    assert.deepEqual(a.bodyShockMods(), []);
  });
  test('Body Index and healing: ½ the Body Index (which healing it applies to is HEALTH_V923.bodyIndexHealing)', () => {
    const a = who({}, [bio('s', 'Suprathyroid', 'other', 1, 4)]);
    assert.deepEqual(SR2Actor.bodyIndexHealingMods(a).map((m: any) => m.value), [2]);
  });
  test('cultured bioware: Body Cost × .75', (t) => {
    const a = who({}, [{ ...bio('ma', 'Muscle augmentation 1', 'muscleAugmentation', 1, 0.8), system: { ...bio('ma', '', 'muscleAugmentation', 1, 0.8).system, cultured: true } }]);
    assert.equal(a.system.derived.bodyIndex.used, 0.6);
    t.after(oldWay({ 'GEAR_V923.cultured': 'old' }));
    a.system.prepareDerivedData();
    assert.equal(a.system.derived.bodyIndex.used, 0.8);
  });
});

describe('v0.92.3 gear glue: carrying and heavy armor', () => {
  const gear = (id: string, kg: number) => ({ id, type: 'gear', name: 'Crate', system: { weight: kg, quantity: 1, carried: true } });
  test('Strength × 5 kg free; × 15 is Moderate fatigue, half movement, no running; old: Quickness −', (t) => {
    const a = who({}, [gear('c', 50)]);
    assert.equal(a.system.derived.load.level, 'M');
    assert.equal(a.system.attributes.quickness.total, 5);
    assert.equal(a.system.derived.woundModifier, 2);
    assert.deepEqual(a.system.derived.movement, { walk: 2, run: 2 });
    t.after(oldWay({ 'GEAR_V923.load': 'old' }));
    a.system.prepareDerivedData();
    assert.equal(a.system.attributes.quickness.total, 5 - Math.ceil((50 - 40) / 20));
  });
  test('heavy armor costs Combat Pool dice; old: any armor lowers Quickness', (t) => {
    const armor = (id: string, name: string, b: number, i: number) => ({ id, type: 'armor', name, system: { ballistic: b, impact: i, worn: true, adds: false, degraded: 0, carried: true } });
    const a = who({}, [armor('h', 'Heavy armor (full suit)', 8, 6)]);
    const pool = Math.floor((5 + 5 + 5) / 2);
    assert.equal(a.system.attributes.quickness.total, 5);
    assert.equal(a.system.derived.combatPool, pool - 3);
    const j = who({}, [armor('j', 'Armor jacket', 6, 3)]);
    assert.equal(j.system.derived.combatPool, pool);
    t.after(oldWay({ 'GEAR_V923.armorEncumbrance': 'old' }));
    j.system.prepareDerivedData();
    assert.equal(j.system.attributes.quickness.total, 4);
  });
});

describe('v0.92.3 gear glue: surgery and system damage', () => {
  const biotech = { id: 'bt', type: 'skill', name: 'Biotech', system: { rating: 5, attribute: 'intelligence', kind: 'active', specialization: '', specializationRating: 0 } };
  test('cybersurgery: TN 10 − Essence left; no successes still installs it at +15% Essence', async () => {
    const doc = who({}, [biotech]);
    const p = who({}, [ware('ww', 'Wired reflexes 1', { essenceCost: 2, installed: false, reaction: 2, initiativeDice: 1 })]);
    faces.push(1, 1, 1, 2, 2); // vs TN 6 (10 − 4): nothing
    await p.surgery('ww', { surgeon: doc });
    const it = p.items.get('ww');
    assert.equal(it.system.installed, true);
    assert.equal(it.system.essenceCost, 2.3);
    assert.match(chat.at(-1).content, /Essence cost is 2\.3 \(was 2\)/);
    assert.doesNotMatch(chat.at(-1).content, /Complications/);
  });
  test('review fix: a cost that would take the patient below 0 Essence stops at 0 (Cybertechnology p. 54)', async () => {
    const doc = who({}, [biotech]);
    const p = who({ essence: 2.2 }, [ware('ww', 'Wired reflexes 1', { essenceCost: 2, installed: false, reaction: 2, initiativeDice: 1 })]);
    faces.push(1, 1, 1, 2, 2); // vs TN 10 (10 − 0): nothing, +15% = 2.3 > 2.2 left
    await p.surgery('ww', { surgeon: doc });
    const it = p.items.get('ww');
    assert.equal(it.system.essenceCost, 2.2);
    assert.equal(p.system.derived.essence, 0);
    assert.notEqual(p.system.derived.status, 'dead');
    assert.match(chat.at(-1).content, /survives at Essence 0/);
  });
  test('old: TN 4 + grade, no successes is complications', async (t) => {
    t.after(oldWay({ 'GEAR_V923.surgery': 'old' }));
    const doc = who({}, [biotech]);
    const p = who({}, [ware('ww', 'Wired reflexes 1', { essenceCost: 2, installed: false })]);
    faces.push(1, 1, 1, 2, 2);
    await p.surgery('ww', { surgeon: doc });
    assert.match(chat.at(-1).content, /Complications/);
    assert.equal(p.items.get('ww').system.essenceCost, 2);
  });
  test('a Deadly wound hits 1D6 − 2 systems; Moderate or worse stops one; old: the 1d6-per-item roll', async (t) => {
    const a = who({}, [ware('a', 'Datajack', { essenceCost: 0.2 }), ware('b', 'Smartlink', { essenceCost: 0.5 })]);
    faces.push(4, 1, 3, 2, 1); // 4 − 2 = 2 systems: Datajack Moderate; Smartlink Light
    const hit = await a.cyberDamageCheck('', 'D');
    assert.deepEqual(hit, ['Datajack']);
    assert.equal(a.items.get('a').system.damaged, true);
    assert.equal(Boolean(a.items.get('b').system.damaged), false);
    t.after(oldWay({ 'GEAR_V923.cyberDamage': 'old' }));
    a.items.get('a').system.damaged = false;
    faces.push(6, 1);
    assert.deepEqual(await a.cyberDamageCheck('', 'D'), ['Smartlink']);
  });
  test('alpha ware resists with 5 dice; one success ignores the damage', async () => {
    const a = who({}, [ware('a', 'Datajack', { essenceCost: 0.2, grade: 'alpha' })]);
    faces.push(3, 1, 6, 6, 1, 1, 1, 1, 1); // 1 system; die 6 = Deadly; 5 dice vs 6 (the 6 rerolls, +1): one success
    assert.deepEqual(await a.cyberDamageCheck('', 'D'), []);
    assert.equal(Boolean(a.items.get('a').system.damaged), false);
  });
});

describe('v0.92.3 gear glue: filtration opposes the toxin (Core p. 248)', () => {
  const filter = ware('f', 'Blood filtration', { kind: 'filtration', filterKind: 'blood', rating: 4, essenceCost: 0.8 });
  test('a filter that wins stops the toxin', async () => {
    const a = who({}, [filter]);
    faces.push(6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1); // filter 4 dice vs Power 6: a 6 (+1 rerolled = 7): 1; toxin 6 dice vs 4: 0
    await a.resistToxin({ name: 'Narcoject', vector: 'injection', power: 6, level: 'S', damageType: 'stun' });
    assert.match(chat.at(-1).content, /Blood filtration stops Narcoject \(1 against 0 successes\)/);
    assert.equal(a.system.monitor.stun, 0);
  });
  test('a filter that fails adds nothing; dice: the rating adds dice', async (t) => {
    const a = who({}, [filter]);
    faces.push(1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1); // filter: 0; toxin 6 vs 4: 1; then Body 4 vs 6: 0
    await a.resistToxin({ name: 'Narcoject', vector: 'injection', power: 6, level: 'S', damageType: 'stun' });
    assert.match(JSON.stringify(chat.at(-1).flags), /fails \(0 against 1\)/);
    t.after(oldWay({ 'GEAR_V923.filtration': 'dice' }));
    faces.push(1, 1, 1, 1, 1, 1, 1, 1);
    await a.resistToxin({ name: 'Narcoject', vector: 'injection', power: 6, level: 'S', damageType: 'stun' });
    assert.match(JSON.stringify(chat.at(-1).flags), /Blood filtration \+4/);
  });
});
