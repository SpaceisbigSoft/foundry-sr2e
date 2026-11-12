/**
 * v0.92.3 book alignment, core mechanics and characters (RULES.CORE_V923): the Foundry glue. Each check runs the book's
 * way (the shipped values) and the old way (the switch put back). The stubs are a copy of v080-core.test.ts's (scripted
 * dice, a chat log of message objects with getFlag, warnings). The pure functions are in
 * rules/__tests__/v0923-core.test.ts.
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

let CharacterDataModel: any, SR2Actor: any, recordCreation: any;

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
  ({ recordCreation } = await import('../applications/advancement.ts'));
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
  a.uuid = `Actor.v923core-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}

const skill = (id: string, name: string, rating: number, attribute = 'quickness', more: any = {}) => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, concentration: '', concentrationRating: 0, ...more } });
const contestOf = () => chat.at(-1).flags.sr2e.contest;

describe('v0.92.3 core: perception on the sheet (Core p. 185; Companion p. 90)', () => {
  const pair = () => {
    const guard = who({ name: 'Guard' }, [skill('p', 'Perception', 3, 'intelligence')]);
    const ninja = who({ name: 'Ninja' }, [skill('s', 'Stealth', 4)]);
    guard.sightTo = () => ({ light: 'full', vision: {}, los: true, smoke: 'none', metres: 10, weather: null });
    return { guard, ninja };
  };

  test('the book: the observer\'s Intelligence vs 4, one success notices; the sneaker doesn\'t roll', async () => {
    const { guard, ninja } = pair();
    faces.push(4, 1, 1, 1, 1);                                     // Intelligence 5 (not Perception 3)
    const r = await guard.perceive(ninja.uuid);
    assert.deepEqual(r, { noticed: true, net: 1 });
    assert.equal(faces.length, 0);
    const c = contestOf();
    assert.equal(c.mode, 'book');
    assert.equal(c.sides.length, 1);
    assert.equal(c.sides[0].result.baseTargetNumber, 4);
    assert.match(chat.at(-1).content, /notices Ninja/);
    faces.push(1, 1, 1, 1, 2);
    assert.deepEqual(await guard.perceive(ninja.uuid), { noticed: false, net: 0 });
    assert.match(chat.at(-1).content, /goes unnoticed/);
  });

  test('the Companion: the sneaker\'s Stealth (4) first, each success +1 to the observer\'s TN', async (t) => {
    t.after(oldWay({ 'CORE_V923.perception': 'companion' }));
    const { guard, ninja } = pair();
    faces.push(5, 5, 1, 1);                                        // Stealth 4: 2 successes
    faces.push(6, 1, 5, 5, 5, 1);                                  // Intelligence 5 vs 6 (the 6 re-rolls a 1: 7)
    const r = await guard.perceive(ninja.uuid);
    assert.equal(faces.length, 0);
    const c = contestOf();
    assert.equal(c.mode, 'companion');
    assert.equal(c.sides[1].result.successes, 2);
    assert.equal(c.sides[0].result.targetNumber, 6);
    assert.equal(r!.noticed, true);
  });

  test('the old opposed test with the switch', async (t) => {
    t.after(oldWay({ 'CORE_V923.perception': 'opposed' }));
    const { guard, ninja } = pair();
    faces.push(5, 5, 5); faces.push(1, 1, 1, 1);
    const r = await guard.perceive(ninja.uuid);
    assert.equal(faces.length, 0);
    assert.equal(contestOf().mode, undefined);
    assert.equal(contestOf().sides[0].result.baseTargetNumber, 4, 'TN = the Stealth rating');
    assert.equal(r!.noticed, true);
  });

  test('sneaking past several: no Stealth roll in the book, each watcher\'s Intelligence vs 4', async () => {
    const { guard, ninja } = pair();
    const other = who({ name: 'Other' }, [], { ...A, intelligence: 2 });
    other.sightTo = guard.sightTo;
    faces.push(1, 1, 1, 1, 5);                                     // Guard: 1 success
    faces.push(1, 1);                                              // Other: none
    const out = await ninja.sneakPast([guard.uuid, other.uuid]);
    assert.equal(faces.length, 0);
    assert.deepEqual(out, [{ name: 'Guard', noticed: true }, { name: 'Other', noticed: false }]);
    assert.equal(contestOf().mode, 'book');
    assert.match(chat.at(-1).content, /Seen/);
  });
});

describe('v0.92.3 review fix: a creation draft keeps the priority table it was started with', () => {
  test('a draft saved before v0.92.3 (no table) checks against the old table; a new one against the book', async () => {
    const { draftTable } = await import('../applications/approvals.ts');
    const { buildRowsFor } = await import('../applications/buildinput.ts');
    const old = who({ name: 'Old draft' });
    old.flags = { sr2e: { creationDraft: { step: 'priorities' }, build: { attributes: 'A' } } };
    assert.equal(draftTable(old), 'old');
    const row = (a: any) => buildRowsFor(a).find((r: any) => r.label === 'Attributes');
    assert.equal(row(old)?.allowed, String(RULES.CREATION.priorities.A.attributes));
    const fresh = who({ name: 'New draft' });
    fresh.flags = { sr2e: { creationDraft: { step: 'priorities', table: 'book' }, build: { attributes: 'A' } } };
    assert.equal(draftTable(fresh), 'book');
    assert.equal(row(fresh)?.allowed, '30');
    const done = who({ name: 'No draft' });
    assert.equal(draftTable(done), null);
  });
});

describe('v0.92.3 core: NPCs (Core p. 187)', () => {
  test('a Threat Rating: no Combat Pool, its dice on tests, defence and damage resistance; the pool way with the switch', async (t) => {
    const npc = who({ name: 'Boss', type: 'npc', threatRating: 3 });
    assert.equal(npc.system.derived.combatPool, 0);
    faces.push(5, 5, 5, 5, 5, 5, 5);                              // Body 4 + Threat 3
    const r = await npc.rollAttribute('body', { targetNumber: 4 });
    assert.equal(r.totalDice, 7);
    assert.match(chat.at(-1).content, /Threat \+3/);
    faces.push(1, 1, 1, 1, 1, 1, 1);
    await npc.resistDamage({ power: 6, level: 'L', type: 'stun' });
    assert.equal(faces.length, 0, 'Body 4 + 3 dice');
    t.after(oldWay({ 'CORE_V923.threat': 'pool' }));
    const old = who({ name: 'Boss', type: 'npc', threatRating: 3 });
    const plain = who({ name: 'Mook', type: 'npc', threatRating: 0 });
    assert.equal(old.system.derived.combatPool - plain.system.derived.combatPool, 3);
    faces.push(5, 5, 5, 5);
    assert.equal((await old.rollAttribute('body', { targetNumber: 4 })).totalDice, 4);
  });

  test('review fix: a Threat-rated NPC uses no standard Dice Pool at all (Core p. 187); the pool way keeps them', (t) => {
    const mage = who({ name: 'Mage', type: 'npc', threatRating: 3, magic: 5, tradition: 'hermetic' }, [{ id: 's1', type: 'skill', name: 'Sorcery', system: { rating: 5, attribute: 'willpower' } }]);
    assert.equal(mage.system.derived.spellPool, 0);
    assert.equal(mage.system.derived.taskPool, 0);
    assert.equal(mage.system.derived.hackingPool, 0);
    assert.equal(mage.system.derived.controlPool, 0);
    t.after(oldWay({ 'CORE_V923.threat': 'pool' }));
    const old = who({ name: 'Mage', type: 'npc', threatRating: 3, magic: 5, tradition: 'hermetic' }, [{ id: 's1', type: 'skill', name: 'Sorcery', system: { rating: 5, attribute: 'willpower' } }]);
    assert.ok(old.system.derived.spellPool > 0);
  });

  test('review fix: Threat dice count as Combat Pool dice for a clean miss (Core p. 86), never spent', async () => {
    const npc = who({ name: 'Boss', type: 'npc', threatRating: 3 });
    faces.push(5, 5, 5, 5, 5, 5, 5);
    const r = await npc.rollAttribute('body', { targetNumber: 4 });
    assert.equal(r.dice.filter((d: any) => d.pool).length, 3, 'the Threat dice are tagged as pool dice');
    assert.equal(npc.system.poolSpent.combat, 0);
    faces.push(1, 1, 1, 1, 5, 5, 1);                               // Body 4 fail; Threat 2 of 3 succeed vs 1 attack success
    await npc.resistDamage({ power: 4, level: 'M', type: 'physical', cleanMiss80: { hits: 1, net: 1, apart: true } });
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /Clean miss/);
    assert.equal(npc.system.monitor.physical, 0);
  });

  test('morale: a Professional Rating 2 NPC withdraws at a Moderate wound; Willpower (4) lets it stay', async () => {
    const npc = who({ name: 'Cop', type: 'npc', professionalRating: 2 });
    npc.system.monitor = { physical: 3, stun: 0 };
    npc.system.prepareDerivedData();
    await npc.syncCondition('ok', { physical: true, stun: false }, { physical: 1, stun: 0 });
    assert.equal(npc.isBroken(), true);
    assert.match(chat.at(-1).content, /withdraws from the fight/);
    assert.match(chat.at(-1).content, /data-sr2e-action="morale"/);
    faces.push(6, 1, 1, 1, 1, 3);                                  // Willpower 5 vs 4 + 2 (Moderate): the 6 re-rolls to 9
    const r = await npc.moraleTest();
    assert.deepEqual(r, { broken: false });
    assert.equal(npc.isBroken(), false);
    assert.match(chat.at(-1).content, /stays in the fight/);
    // Professional Rating 4: never.
    const pro = who({ name: 'Pro', type: 'npc', professionalRating: 4 });
    pro.system.monitor = { physical: 9, stun: 0 };
    pro.system.prepareDerivedData();
    const n = chat.length;
    await pro.syncCondition('ok', { physical: true, stun: false }, { physical: 0, stun: 0 });
    assert.equal(pro.isBroken(), false);
    assert.equal(chat.length, n);
  });

  test('morale the old way: no withdrawal on a wound; the test rolls Professional Rating dice', async (t) => {
    t.after(oldWay({ 'CORE_V923.morale': 'old' }));
    const npc = who({ name: 'Cop', type: 'npc', professionalRating: 2 });
    npc.system.monitor = { physical: 3, stun: 0 };
    npc.system.prepareDerivedData();
    await npc.syncCondition('ok', { physical: true, stun: false }, { physical: 1, stun: 0 });
    assert.equal(npc.isBroken(), false);
    faces.push(1, 1);
    assert.deepEqual(await npc.moraleTest(), { broken: true });
  });

  test('recognition: the NPC\'s Etiquette vs (1,000 − career Karma) ÷ 50; Intelligence vs 10 − Public Awareness the old way', async (t) => {
    const runner = who({ name: 'Runner', karma: { pool: 0, poolSpent: 0, good: 0, career: 500 } });
    const fixer = who({ name: 'Fixer', type: 'npc' }, [skill('et', 'Etiquette', 3, 'charisma')]);
    faces.push(6, 1, 1, 5);                                        // Etiquette 3 vs 10: the 6 re-rolls a 5 → 11
    const seen = await runner.recognitionCheck([fixer.uuid]);
    assert.deepEqual(seen, ['Fixer']);
    assert.match(chat.at(-1).content, /vs 10/);
    faces.push(1, 1, 1);
    await runner.recognitionCheck([fixer.uuid], { publicRep: 100 });
    assert.match(chat.at(-1).content, /vs 18/);
    t.after(oldWay({ 'CORE_V923.recognition': 'old' }));
    faces.push(1, 1, 1, 1, 1);                                     // Intelligence 5
    await runner.recognitionCheck([fixer.uuid]);
    assert.equal(faces.length, 0);
  });
});

describe('v0.92.3 core: the metatypes on the sheet (Core p. 45)', () => {
  test('a troll: Willpower −1, no dermal armor points, +1 Body die resisting damage', async (t) => {
    const troll = who({ name: 'Troll', metatype: 'troll' });
    assert.equal(troll.system.attributes.willpower.racial, -1);
    assert.deepEqual({ ...troll.system.derived.cyberArmor }, { ballistic: 0, impact: 0 });
    faces.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1);                     // Body 4 + 5 + 1 dermal
    await troll.resistDamage({ power: 4, level: 'L', type: 'stun' });
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /dermal armor \+1 Body/);
    t.after(oldWay({ 'CORE_V923.trollDermal': 'armor', 'CORE_V923.racialMods': 'old' }));
    const old = who({ name: 'Troll', metatype: 'troll' });
    assert.equal(old.system.attributes.willpower.racial, 0);
    assert.deepEqual({ ...old.system.derived.cyberArmor }, { ballistic: 1, impact: 1 });
  });

  test('a dwarf\'s racial dice: against disease, not toxins (HEALTH_V923.dwarfResistance)', () => {
    const dwarf = who({ name: 'Dwarf', metatype: 'dwarf' });
    assert.equal(dwarf.system.attributes.quickness.racial, -1);
    assert.equal(dwarf.system.derived.raceDiseaseDice, 2);
    assert.equal(dwarf.system.derived.toxinDice, 0);
  });
});

describe('v0.92.3 core: Karma on the sheet (Core pp. 190–191)', () => {
  test('Karma Pool dice: at most the test\'s own dice, spent from the pool', async () => {
    const a = who({ karma: { pool: 5, poolSpent: 0, good: 0, career: 0 } }, [skill('pi', 'Pistols', 2)]);
    faces.push(5, 5, 5, 5);
    const r = await a.rollSkill(a.items.get('pi'), { targetNumber: 4, karmaDice: 4 });
    assert.equal(r.totalDice, 4, 'Pistols 2 + 2 Karma dice (not 4)');
    assert.equal(a.system.karma.poolSpent, 2);
  });

  test('after avoiding a disaster: no re-roll, no bought success', async (t) => {
    const a = who({ karma: { pool: 5, poolSpent: 0, good: 0, career: 0 } });
    faces.push(1, 1, 1, 1);
    await a.rollAttribute('body', { targetNumber: 4 });
    const snap = chat.at(-1).flags.sr2e.test;
    await a.avoidDisaster(snap);
    const avoided = chat.at(-1).flags.sr2e.test;
    assert.equal(avoided.disasterAvoided, true);
    assert.doesNotMatch(chat.at(-1).content, /karmaReroll|buySuccess/);
    await a.karmaReroll(avoided);
    assert.match(warnings.at(-1)!, /no more Karma/);
    t.after(oldWay({ 'CORE_V923.afterOops': 'old' }));
    faces.push(5, 5, 5, 5);
    await a.karmaReroll(avoided);
    assert.equal(faces.length, 0, 'the old way re-rolls');
  });

  test('raising an attribute: new rating × 1; the training days are the Karma × 7', async () => {
    const a = who({ karma: { pool: 0, poolSpent: 0, good: 30, career: 30 } });
    assert.equal(await a.improve({ attribute: 'quickness' }), true);
    assert.equal(a.system.karma.good, 30 - 6);
    assert.equal(a.system.training[0].days, 6 * 7);
  });

  test('a new skill\'s first point costs 1', () => {
    const a = who({}, [skill('k', 'Knives', 0)]);
    assert.equal(a.improveCost({ skillId: 'k' }).cost, 1);
  });

  test('the creation wizard\'s finish: a metahuman starts with Karma Pool 2', async () => {
    const plain = (o: any) => ({ type: 'character', name: 'New', items: [], flags: {} as any, system: { attributes: {}, essence: 6, ...o },
      getFlag(s: string, k: string) { return this.flags[s]?.[k]; }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); } });
    const b = plain({ metatype: 'troll', karma: { pool: 1, poolSpent: 0, good: 0, career: 0 } });
    await recordCreation(b, { how: 'wizard' });
    assert.equal(b.system.karma.pool, 2);
    const h = plain({ metatype: 'human', karma: { pool: 1, poolSpent: 0, good: 0, career: 0 } });
    await recordCreation(h, { how: 'wizard' });
    assert.equal(h.system.karma.pool, 1);
  });
});

describe('v0.92.3 core: the street on the sheet', () => {
  test('haggling: the seller rolls against the buyer\'s Willpower (book), the fixed TN with the switch', async (t) => {
    const a = who({}, [skill('ne', 'Negotiation', 2, 'charisma')], { ...A, willpower: 6 });
    faces.push(1, 1, 1, 1, 1, 1);
    await a.haggle({ itemId: 'x', price: 1000, name: 'Gun' });
    assert.equal(contestOf().sides[1].result.targetNumber, 6);
    t.after(oldWay({ 'CORE_V923.haggle': 'old' }));
    faces.push(1, 1, 1, 1, 1, 1);
    await a.haggle({ itemId: 'x', price: 1000, name: 'Gun' });
    assert.equal(contestOf().sides[1].result.targetNumber, RULES.STREET.haggle.tn);
  });

  test('climbing: a quarter of (the Quickness and Strength average + 2 a success)', async (t) => {
    const a = who({}, [skill('at', 'Athletics', 3, 'body')]);
    a.useAction = async () => true;
    a.weatherHere = () => null;
    faces.push(5, 5, 1);                                           // 2 successes: (4.5 + 4) ÷ 4 → 2 m
    const r = await a.athleticsTest('climb', { condition: 'easy', weather: false });
    assert.deepEqual(r, { successes: 2, metres: 2 });
    t.after(oldWay({ 'CORE_V923.athletics': 'old' }));
    faces.push(5, 5, 1);
    assert.deepEqual(await a.athleticsTest('climb', { condition: 'easy', weather: false }), { successes: 2, metres: 4 });
  });
});

describe('v0.92.3 rules-changes notice (migration 0.92.3; notice923.ts)', () => {
  const gun = (extra: any = {}) => ({ id: `w${Math.random()}`, type: 'weapon', name: 'Gun', system: { melee: false, ready: true, carried: true, ...extra } });
  const ware = (extra: any = {}) => ({ id: `c${Math.random()}`, type: 'cyberware', name: 'Ware', system: { essenceCost: 1, grade: 'standard', installed: true, bioware: false, kind: 'other', attributes: {}, ...extra } });
  test('lists the actors each new default changes, by reason; reads only; nothing when the world plays the old way', async (t) => {
    const { collectNotice923, notice923Html } = await import('../notice923.ts');
    const qOff = oldWay({ 'STREET.qualities.enabled': true });           // Sensitive System counts with edges and flaws on
    t.after(qOff);
    // Career Karma 5: the same Karma Pool at either rate (the Veteran's 40 isn't).
    const w = (extra: any, items: any[] = []) => who({ karma: { pool: 1, poolSpent: 0, good: 5, career: 5 }, ...extra }, items);
    const dwarf = w({ name: 'Dwarf', metatype: 'dwarf' });
    const mage = w({ name: 'Chromed mage', magic: 6, tradition: 'hermetic' }, [ware({ essenceCost: 1.5 })]);
    const beta = w({ name: 'Beta', }, [ware({ essenceCost: 1, grade: 'beta' })]);
    const boss = w({ name: 'Boss', type: 'npc', threatRating: 3 });
    const vet = w({ name: 'Veteran', karma: { pool: 4, poolSpent: 0, good: 0, career: 40 } });
    const armed = w({ name: 'Armed' }, [gun({ ready: false }), gun({ shotgun: true, choke: 4, ammoType: 'standard' })]);
    const dying = w({ name: 'Dying', monitor: { physical: 15, stun: 0 } }, [ware({ attributes: { body: 2 } })]);
    const plain = w({ name: 'Plain' });
    const drafted = w({ name: 'Drafting' });
    const mule = w({ name: 'Mule' }, [{ id: 'g1', type: 'gear', name: 'Anvil', system: { quantity: 1, weight: 30, carried: true } }]);
    const sensitive = w({ name: 'Sensitive', qualities: [{ id: 'q1', name: 'Sensitive System', kind: 'flaw', points: -2 }] }, [{ id: 'b1', type: 'cyberware', name: 'Muscle toner', system: { bioware: true, bioKind: 'other', rating: 1, bodyIndex: 0.5, installed: true, essenceCost: 0, grade: 'standard', attributes: {} } }]);
    const before = JSON.stringify([mage, dying, beta].map((a: any) => ({ magic: a.system.magic, essence: a.system.essence, monitor: a.system.monitor })));
    const derivedBefore = JSON.stringify([mage, dying].map((a: any) => [a.system.derived.magic, a.system.derived.status]));
    const groups = collectNotice923([dwarf, mage, beta, boss, vet, armed, dying, plain, drafted, mule, sensitive], { inCreation: (a: any) => a === drafted });
    const of = (id: string) => groups.find((g) => g.id === id)?.names ?? [];
    assert.deepEqual(of('racialMods'), ['Dwarf']);
    assert.deepEqual(of('magicFromEssence'), ['Chromed mage']);
    assert.deepEqual(of('essence'), ['Beta']);
    assert.deepEqual(of('threat'), ['Boss']);
    assert.deepEqual(of('karmaPool'), ['Veteran']);                // 40 career: 4 at 1 per 10, 3 at 1 per 11
    assert.deepEqual(of('notReady'), ['Armed']);
    assert.deepEqual(of('shotgun'), ['Armed']);
    assert.deepEqual(of('creation'), ['Drafting']);
    assert.ok(of('status').includes('Dying'), JSON.stringify(groups));
    assert.deepEqual(of('load'), ['Mule'], JSON.stringify(groups));
    assert.deepEqual(of('bodyIndex'), ['Sensitive'], JSON.stringify(groups));
    assert.ok(!groups.some((g) => g.names.includes('Plain')));
    assert.equal(JSON.stringify([mage, dying, beta].map((a: any) => ({ magic: a.system.magic, essence: a.system.essence, monitor: a.system.monitor }))), before, 'no data changed');
    assert.equal(JSON.stringify([mage, dying].map((a: any) => [a.system.derived.magic, a.system.derived.status])), derivedBefore, 'derived as it was');
    const html = notice923Html(groups);
    assert.match(html, /v0\.92\.3/);
    assert.match(html, /Racial modifiers/);
    assert.match(html, /<code>old<\/code>/);
    // Every switch back at its v0.92.2 choice: nothing to say.
    t.after(oldWay({ 'CORE_V923.racialMods': 'old', 'SORCERY_V923.magicFromEssence': 'v922', 'GEAR_V923.limbHoused': 'capacity', 'GEAR_V923.awakenedBioware': 'magic', 'GEAR_V923.grades': 'old',
      'HEALTH_V923.death': 'total', 'GEAR_V923.essenceZero': 'dead', 'CORE_V923.threat': 'pool', 'UPKEEP.karma.poolEvery': { human: 10, metahuman: 20 }, 'CORE_V923.priorities': 'old',
      'COMBAT.ready.rule': 'off', 'COMBAT_V923.shotgun': 'old', 'GEAR_V923.load': 'old', 'HEALTH_V72.qualities.sensitiveSystem.bodyIndexMultiplier': 1 }));
    assert.deepEqual(collectNotice923([dwarf, mage, beta, boss, vet, armed, dying, plain, drafted, mule, sensitive], { inCreation: (a: any) => a === drafted }), []);
    assert.equal(notice923Html([]), '');
  });
  test('names are escaped; the card goes to this (the lead) GM only', async () => {
    const { notice923Html } = await import('../notice923.ts');
    const html = notice923Html([{ id: 'threat', names: ['<img src=x onerror=alert(1)>'] }]);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img/);
    const { notifyRules923 } = await import('../migrations.ts');
    g.game.actors = [who({ name: 'Boss', type: 'npc', threatRating: 2 })];
    g.game.scenes = [];
    await notifyRules923();
    assert.deepEqual(chat.at(-1).whisper, ['gm1']);
    assert.match(chat.at(-1).content, /Boss/);
  });
});
