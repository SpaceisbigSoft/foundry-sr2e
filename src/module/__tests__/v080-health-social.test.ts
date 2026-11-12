/**
 * v0.80.0 health-social: the Foundry glue for the Unified Rules Revamp's health and social switches
 * (RULES.URR_V80.hs*, rules/config80-health-social.ts), each under the Revamp (urrMode) and the book. The stubs are
 * a copy of v078.test.ts's. These check OUR wiring, not that Foundry behaves as the stubs do.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { urrMode } from '../rules/__tests__/urrmode.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { after } from 'node:test';

// v0.92.3: the "book" in these tests is the v0.92.2 Book Rules; the book's own rules for these switches are now the
// defaults (RULES.HEALTH_V923, v0923-health tests), so the old ways are set here for the whole file. The Revamp's
// results (urrMode) don't depend on them.
let restore923: () => void = () => {};
before(() => {
  restore923 = oldWay({ 'HEALTH_V923.death': 'total', 'HEALTH_V923.bleed': 'bodyTurns', 'HEALTH_V923.stunRecovery': 'old', 'HEALTH_V923.firstAid': 'boxes',
    'HEALTH_V923.firstAidTime': 'hidden', 'HEALTH_V923.selfStabilise': 'none', 'HEALTH_V923.firstAidRetry': 'once', 'HEALTH_V923.traumaPatch': 'stabilise',
    'HEALTH_V923.magicLossUntreated': 'none', 'HEALTH_V923.breathHold': 'none', 'HEALTH_V923.falling': 'old', 'HEALTH_V923.drowning': 'test',
    'HEALTH_V923.bodyIndexHealing': 'natural', 'HEALTH_V923.firstAidStun': 'both', 'HEALTH_V923.permanentDamage': 'none', STUN_OVERFLOW_PER_PHYSICAL_BOX: 2 });
});
after(() => restore923());

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
  a.uuid = `Actor.v80hs-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness', more: any = {}) => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, ...more } });



const medkit = { id: 'k1', type: 'gear', name: 'Medkit', system: { medkitRating: 2 } };
const medic = (rating = 4) => who({ name: 'Medic' }, [skill('bt', 'Biotech', rating, 'intelligence'), medkit]);

describe('v0.80.0 health-social: death and bleeding (URR_V80.hsDeathPastOverflow, hsBleedMinutes)', () => {
  test('book: dead with a full Overflow row; Revamp: one box more', (t) => {
    assert.equal(who({ monitor: { physical: 14, stun: 0 } }).system.derived.status, 'dead');
    t.after(urrMode());
    assert.equal(who({ monitor: { physical: 14, stun: 0 } }).system.derived.status, 'dying');
    assert.equal(who({ monitor: { physical: 15, stun: 0 } }).system.derived.status, 'dead');
  });
  test('bleeding on game time: book every Body Combat Turns; Revamp every 10 minutes', async (t) => {
    const a = who({ name: 'Downed', monitor: { physical: 10, stun: 0 } });
    a.flags.sr2e = { dyingAt: { t: 0, boxes: 0 } };
    g.game.actors = [a];
    await SR2Actor.timedEffects({ worldTime: 24, anyGm: true });   // 8 turns, Body 4: 2 boxes
    assert.equal(a.system.monitor.physical, 12);
    t.after(urrMode());
    const b = who({ name: 'Downed', monitor: { physical: 10, stun: 0 } });
    b.flags.sr2e = { dyingAt: { t: 0, boxes: 0 } };
    g.game.actors = [b];
    await SR2Actor.timedEffects({ worldTime: 599, anyGm: true });
    assert.equal(b.system.monitor.physical, 10);
    await SR2Actor.timedEffects({ worldTime: 600, anyGm: true });
    assert.equal(b.system.monitor.physical, 11);
  });
});

describe('v0.80.0 health-social: first aid (URR_V80.hsFirstAid, hsFirstAidTime, hsSelfStabilise, hsFirstAidRetry, hsMagicLossUntreated)', () => {
  test('book: one box per success', async () => {
    const p = who({ name: 'Patient', monitor: { physical: 4, stun: 0 } });
    faces.push(5, 1, 1, 1);                                           // Biotech 4 vs 6 − 1 (natural Body 4): 1 success
    await medic().firstAid(p, { medkitId: 'k1' });
    assert.equal(p.system.monitor.physical, 3);
    assert.doesNotMatch(chat.at(-1).content, /Treatment takes/);
  });
  test('Revamp: one success lowers the wound a level, and the card gives the time', async (t) => {
    t.after(urrMode());
    const p = who({ name: 'Patient', monitor: { physical: 4, stun: 0 } });
    faces.push(5, 1, 1, 1);
    await medic().firstAid(p, { medkitId: 'k1' });
    assert.equal(p.system.monitor.physical, 1);                       // Moderate → the lowest Light box
    assert.match(chat.at(-1).content, /Treatment takes 20 minutes/);
  });
  test('Revamp: a Deadly wound is only stabilised', async (t) => {
    t.after(urrMode());
    const p = who({ name: 'Patient', monitor: { physical: 10, stun: 0 } });
    faces.push(6, 1, 1, 1, 3);                                        // vs 10 − 1: 6 + 3 = 9
    await medic().firstAid(p, { medkitId: 'k1' });
    assert.equal(faces.length, 0);
    assert.equal(p.system.monitor.physical, 10);
    assert.equal(p.system.care.stabilised, true);
    assert.match(chat.at(-1).content, /can only be stabilised/);
  });
  test('failed first aid on the dying: book nothing more; Revamp natural Body vs 10', async (t) => {
    const p = who({ name: 'Patient', monitor: { physical: 10, stun: 0 } });
    faces.push(1, 1, 1, 1);
    await medic().firstAid(p, { medkitId: 'k1' });
    assert.equal(faces.length, 0);
    assert.equal(p.system.care.stabilised, false);
    t.after(urrMode());
    const q = who({ name: 'Patient', monitor: { physical: 10, stun: 0 } });
    faces.push(1, 1, 1, 1);                                           // first aid fails
    faces.push(6, 1, 1, 1, 4);                                        // natural Body 4 vs 10: 6 + 4
    await medic().firstAid(q, { medkitId: 'k1' });
    assert.equal(faces.length, 0);
    assert.equal(q.system.care.stabilised, true);
    assert.ok(chat.some((m) => /self-stabilisation/.test(m.content)));
  });
  test('a better healer may try again (Revamp only)', async (t) => {
    const p = who({ name: 'Patient', monitor: { physical: 3, stun: 0 } });
    faces.push(1, 1);
    await medic(2).firstAid(p, { medkitId: 'k1' });
    assert.equal(await medic(4).firstAid(p, { medkitId: 'k1' }), null);
    t.after(urrMode());
    const q = who({ name: 'Patient', monitor: { physical: 3, stun: 0 } });
    faces.push(1, 1);
    await medic(2).firstAid(q, { medkitId: 'k1' });
    assert.equal(await medic(2).firstAid(q, { medkitId: 'k1' }), null);
    faces.push(1, 1, 1, 1);
    assert.notEqual(await medic(4).firstAid(q, { medkitId: 'k1' }), null);
  });
  test('a magician treated without the +2: a Magic loss card under the Revamp only', async (t) => {
    const p = who({ name: 'Mage', magic: 4, monitor: { physical: 3, stun: 0 } });
    faces.push(1, 1, 1, 1);
    await medic().firstAid(p, { medkitId: 'k1', applyMagician: false });
    assert.ok(!chat.some((m) => m.flags?.sr2e?.magicLossFor));
    t.after(urrMode());
    const q = who({ name: 'Mage', magic: 4, monitor: { physical: 3, stun: 0 } });
    faces.push(1, 1, 1, 1);
    await medic().firstAid(q, { medkitId: 'k1', applyMagician: false });
    assert.equal(chat.at(-1).flags.sr2e.magicLossFor, q.uuid);
    chat.length = 0;
    faces.push(1, 1, 1, 1);
    const r = who({ name: 'Mage', magic: 4, monitor: { physical: 3, stun: 0 } });
    await medic().firstAid(r, { medkitId: 'k1' });
    assert.ok(!chat.some((m) => m.flags?.sr2e?.magicLossFor));
  });
});

describe('v0.80.0 health-social: trauma patch (URR_V80.hsTraumaPatch)', () => {
  const plating = { id: 'dp', type: 'cyberware', name: 'Dermal plating 2', system: { installed: true, kind: 'other', armorBallistic: 2, armorImpact: 1, essenceCost: 0, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0, rating: 2 } };
  test('book: stabilises outright', async () => {
    const p = who({ name: 'Patient', monitor: { physical: 10, stun: 0 } });
    const text = await SR2Actor.patchEffect(p, { kind: 'trauma', rating: 1, name: 'Trauma 1' });
    assert.match(text, /stabilised/);
    assert.equal(p.system.care.stabilised, true);
  });
  test('Revamp: natural Body vs 4, dermal armor adds its rating', async (t) => {
    t.after(urrMode());
    const p = who({ name: 'Patient', monitor: { physical: 10, stun: 0 } });
    faces.push(4, 1, 1, 1);
    assert.match(await SR2Actor.patchEffect(p, { kind: 'trauma', rating: 1, name: 'Trauma 1' }), /stabilised/);
    assert.equal(p.system.care.stabilised, true);
    const q = who({ name: 'Plated', monitor: { physical: 10, stun: 0 } }, [plating]);
    faces.push(4, 1, 1, 1);                                           // vs 4 + 2
    assert.match(await SR2Actor.patchEffect(q, { kind: 'trauma', rating: 1, name: 'Trauma 1' }), /still bleeding/);
    assert.equal(q.system.care.stabilised, false);
    assert.equal(faces.length, 0);
  });
});

describe('v0.80.0 health-social: Stun recovery (URR_V80.hsStunRecovery)', () => {
  test('book: Body vs the wound TN, no wound modifiers', async () => {
    const a = who({ name: 'Tired', monitor: { physical: 0, stun: 4 } });
    faces.push(4, 4, 1, 1);                                           // Body 4 vs 4
    await a.naturalHeal({ track: 'stun', hours: 1 });
    assert.equal(faces.length, 0);
    assert.equal(a.system.monitor.stun, 2);
    assert.doesNotMatch(chat.at(-1).content, /Wounds/);
  });
  test('Revamp: the higher of Body and Willpower vs 2 + wound modifiers', async (t) => {
    t.after(urrMode());
    const a = who({ name: 'Tired', monitor: { physical: 0, stun: 4 } });
    faces.push(4, 4, 1, 1, 1);                                        // Willpower 5 vs 2 + 2
    await a.naturalHeal({ track: 'stun', hours: 1 });
    assert.equal(faces.length, 0);
    assert.equal(a.system.monitor.stun, 2);
    assert.match(chat.at(-1).content, /Wounds/);
    assert.equal(chat.at(-1).flags.sr2e.test.targetNumber, 4);
  });
});

describe('v0.80.0 health-social: hazards and athletics (URR_V80.hsFalling, hsBreathHold, hsAthletics)', () => {
  test('falling: Revamp nothing up to 2 m; 8 m is 4S with no armor', async (t) => {
    t.after(urrMode());
    const a = who({ name: 'Faller' });
    await a.resistHazard('falling', 2);
    assert.equal(chat.length, 0);
    faces.push(1, 1, 1, 2);
    await a.resistHazard('falling', 8);
    assert.match(chat.at(-1).content, /Resist 4S physical/);
  });
  test('holding breath: book the drowning test now; Revamp 30 s per Body first', async (t) => {
    const a = who({ name: 'Diver' });
    faces.push(1, 1, 1, 2);
    await a.resistHazard('drowning', 5);
    assert.equal(faces.length, 0);
    t.after(urrMode());
    const b = who({ name: 'Diver' });
    await b.resistHazard('drowning', 5);
    assert.match(chat.at(-1).content, /still holds their breath \(held breath, 40 Combat Turns\)/);
  });
  test('athletics: Revamp jumps by Fitness, climbs up to Fitness', async (t) => {
    t.after(urrMode());
    const a = who({ name: 'Runner' }, [skill('at', 'Athletics', 3, 'body')]);
    faces.push(5, 5, 1);                                              // 2 successes: Fitness 4 + 1
    assert.deepEqual(await a.athleticsTest('jump', { running: true, weather: false }), { successes: 2, metres: 5 });
    faces.push(6, 6, 6, 1, 1, 1);                                     // vs 3: 3 successes, Fitness 4
    assert.deepEqual(await a.athleticsTest('climb', { condition: 'easy', weather: false }), { successes: 3, metres: 3 });
  });
});

describe('v0.80.0 health-social: the gated rules functions (damage, look, core, docs79-health, vitals)', () => {
  test('book values unchanged', async () => {
    const R: any = await import('../rules/index.ts');
    assert.equal(R.monitorStatus({ physical: 14, stun: 0 }, 4), 'dead');
    assert.equal(R.overflowView(14, 4).boxes.length, 4);
    assert.equal(R.firstAidBoxes(1, 4), 1);
    assert.equal(R.firstAidTarget(10).maxBoxes, 5);
    assert.equal(R.dyingTick(4, 4), true);
    assert.deepEqual(R.canRollStage({ boxes: 10, care: 'hospital', gate: 'untested' }), { ok: true, reason: '' });
    const od = R.overdoseTest({ name: 'Upper', power: 6, level: 'M' }, 1);
    assert.deepEqual([od.power, od.level], [7, 'M']);
  });
  test('Revamp values', async (t) => {
    t.after(urrMode());
    const R: any = await import('../rules/index.ts');
    assert.equal(R.monitorStatus({ physical: 14, stun: 0 }, 4), 'dying');
    const v = R.overflowView(14, 4);
    assert.equal(v.boxes.length, 5);
    assert.equal(v.boxes[4].dead, true);
    assert.equal(R.firstAidBoxes(1, 4), 3);
    assert.equal(R.firstAidBoxes(0, 4), 0);
    assert.equal(R.firstAidBoxes(2, 10), 0);
    assert.equal(R.firstAidBoxes(1, 10, 'stun'), 4);
    assert.equal(R.dyingTick(4, 4), false);
    assert.equal(R.dyingTick(200, 4), true);
    assert.equal(R.canRollStage({ boxes: 10, care: 'hospital', gate: 'untested' }).ok, false);
    assert.equal(R.canRollStage({ boxes: 10, care: 'intensive', gate: 'untested' }).ok, true);
    const od = R.overdoseTest({ name: 'Upper', power: 6, level: 'M' }, 1);
    assert.deepEqual([od.power, od.level], [6, 'S']);
    const od2 = R.overdoseTest({ name: 'Upper', power: 6, level: 'M' }, 3);
    assert.deepEqual([od2.power, od2.level], [8, 'S']);
  });
});
