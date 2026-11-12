/**
 * v0.80.0 (core): the "SR2E Unified Rules Revamp" wiring (RULES.URR_V80 core switches), the Foundry glue side and the
 * existing pure functions it changes. Each check runs under the SR2E Book Rules (shipped values: nothing changes) and
 * under the Revamp (urrMode). The pure functions are in rules/__tests__/urr80-core.test.ts. The stubs are a copy of
 * v078.test.ts's (scripted dice, a chat log of message objects with getFlag, warnings). These check OUR wiring, not
 * that Foundry behaves as the stubs do.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RULES, attributeMaximums, attributeMaximumsWith, effectiveMagic, nativeLanguageRating, karmaAward, skillCost, parseSkillWeb, webDistance, relatedDefaultTn } from '../rules/index.ts';
import { urrMode } from '../rules/__tests__/urrmode.ts';
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
  a.uuid = `Actor.v80core-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness', more: any = {}) => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, concentration: '', concentrationRating: 0, ...more } });

describe('v0.80.0 core: existing pure functions, wired', () => {
  test('natural maximums: dwarf Quickness 5 and troll Willpower 5 under the Revamp', (t) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    t.after(oldWay({ 'CORE_V923.racialMods': 'old' }));
    assert.equal(attributeMaximums('dwarf', 'quickness').natural, 6);
    assert.equal(attributeMaximumsWith('troll', 'willpower', []).natural, 6);
    t.after(urrMode());
    assert.equal(attributeMaximums('dwarf', 'quickness').natural, 5);
    assert.equal(attributeMaximums('dwarf', 'quickness').augmented, 7);
    assert.equal(attributeMaximumsWith('troll', 'willpower', []).natural, 5);
    assert.equal(attributeMaximums('troll', 'body').natural, 11);
  });

  test('Magic capped by Essence rounded down under the Revamp (up in the book)', (t) => {
    assert.equal(effectiveMagic(6, 4.2), 5);
    t.after(urrMode());
    assert.equal(effectiveMagic(6, 4.2), 4);
    assert.equal(effectiveMagic(0, 4.2), 0);
  });

  test('native language: Intelligence (book), Intelligence + 2 (Revamp)', (t) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    t.after(oldWay({ 'CORE_V923.nativeLanguage': 'old' }));
    assert.equal(nativeLanguageRating(5), 5);
    t.after(urrMode());
    assert.equal(nativeLanguageRating(5), 7);
  });

  test('Karma awards: per career Karma (book), each award\'s first point to the pool (Revamp)', (t) => {
    assert.deepEqual(karmaAward({ careerBefore: 0, amount: 5, metahuman: false }), { good: 5, pool: 0, career: 5 });
    t.after(urrMode());
    assert.deepEqual(karmaAward({ careerBefore: 0, amount: 5, metahuman: false }), { good: 4, pool: 1, career: 5 });
    assert.deepEqual(karmaAward({ careerBefore: 0, amount: 12, metahuman: true }), { good: 10, pool: 2, career: 12 });
  });

  test('a language at new rating × 1 under the Revamp; the knowledge bands in the book', (t) => {
    const book = skillCost({ to: 4, attribute: 5, kind: 'language' });
    t.after(urrMode());
    assert.equal(skillCost({ to: 4, attribute: 5, kind: 'language' }), 4);
    assert.notEqual(book, 4 * 0, 'the book cost is some positive value');
    assert.equal(skillCost({ to: 4, attribute: 5, kind: 'active' }), 8, 'active skills keep v0.79.0 × 2');
  });

  test('Skill Web: "A > B" is one-way and steps are unlimited under the Revamp', (t) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    t.after(oldWay({ 'CORE_V923.webArrows': 'old', 'SKILLS.web.maxSteps': 3 }));
    const links = parseSkillWeb('Firearms > Gunnery: 1\nGunnery - Car: 2\nCar - Bike: 1');
    assert.deepEqual(links[0], { a: 'Firearms', b: 'Gunnery', steps: 1, oneWay: true });
    assert.deepEqual(links[1], { a: 'Gunnery', b: 'Car', steps: 2 });
    // Book: both ways, at most 3 steps.
    assert.equal(webDistance(links, 'Gunnery', 'Firearms'), 1);
    assert.equal(webDistance(links, 'Firearms', 'Gunnery'), 1);
    assert.equal(webDistance(links, 'Bike', 'Gunnery'), 3);
    assert.equal(webDistance(links, 'Bike', 'Firearms'), null);
    t.after(urrMode());
    // Needing Gunnery, a Firearms user follows the arrow; needing Firearms, Gunnery can't go against it.
    assert.equal(webDistance(links, 'Gunnery', 'Firearms'), 1);
    assert.equal(webDistance(links, 'Firearms', 'Gunnery'), null);
    assert.equal(relatedDefaultTn(links, 'Gunnery', 'Firearms'), 2);
    assert.equal(webDistance(links, 'Bike', 'Firearms'), 4, 'no 3-step limit');
  });
});

describe('v0.80.0 core: tests on the sheet', () => {
  test('Karma Pool dice: ignored in the book, bought under the Revamp', async (t) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    t.after(oldWay({ 'CORE_V923.karmaDice': 'off' }));
    const a = who({ karma: { pool: 3, poolSpent: 0, good: 30, career: 30 } }, [skill('pi', 'Pistols', 2)]);
    faces.push(5, 1);
    const r1 = await a.rollSkill(a.items.get('pi'), { targetNumber: 4, karmaDice: 2 });
    assert.equal(r1.totalDice, 2);
    assert.equal(a.system.karma.poolSpent, 0);
    assert.equal(faces.length, 0);
    t.after(urrMode());
    faces.push(5, 1, 4, 2);
    const r2 = await a.rollSkill(a.items.get('pi'), { targetNumber: 4, karmaDice: 2 });
    assert.equal(r2.totalDice, 4);
    assert.equal(r2.successes, 2);
    assert.equal(a.system.karma.poolSpent, 2);
    assert.match(chat.at(-1).content, /Karma \+2/);
    // At most what is left (1), on an attribute test too.
    faces.push(3, 3, 3, 3, 3, 3);
    const r3 = await a.rollAttribute('quickness', { targetNumber: 4, karmaDice: 5 });
    assert.equal(r3.totalDice, 6);
    assert.equal(a.system.karma.poolSpent, 3);
    assert.equal(faces.length, 0);
  });

  test('without the general skill: the attribute (book), the concentration at +2 (Revamp)', async (t) => {
    const a = who({}, [skill('fa', 'Firearms', 0, 'quickness', { concentration: 'Pistols', concentrationRating: 3 })]);
    faces.push(5, 5, 5, 5, 5);
    const r1 = await a.rollSkill(a.items.get('fa'), { targetNumber: 4 });
    assert.equal(r1.totalDice, 5);
    assert.ok(r1.modifiers.some((m: any) => m.label === 'Defaulting to attribute' && m.value === RULES.ATTRIBUTE_DEFAULT_TN_MOD));
    t.after(urrMode());
    faces.push(6, 1, 1, 1);
    const r2 = await a.rollSkill(a.items.get('fa'), { targetNumber: 4 });
    assert.equal(r2.totalDice, 3);
    assert.ok(r2.modifiers.some((m: any) => m.label === 'Defaulting from the concentration' && m.value === 2));
    assert.equal(faces.length, 0);
  });

  test('knowledge tests say what the successes give, and critical successes show, only under the Revamp', async (t) => {
    const a = who({}, [skill('kn', 'Corporate Lore', 3, 'intelligence', { kind: 'knowledge' })]);
    faces.push(6, 2, 2, 5);                                           // 6 + 5 = 11 vs 4: one success, one critical
    await a.rollSkill(a.items.get('kn'), { targetNumber: 4 });
    assert.doesNotMatch(chat.at(-1).content, /general picture|critical success/);
    t.after(urrMode());
    faces.push(6, 2, 2, 5);
    await a.rollSkill(a.items.get('kn'), { targetNumber: 4 });
    assert.match(chat.at(-1).content, /general picture/);
    assert.match(chat.at(-1).content, /1 critical success/);
    assert.equal(faces.length, 0);
  });

  test('an opposed social tie: a stand-off (book), the speaker wins (Revamp)', async (t) => {
    const me = who({ name: 'Face' }, [skill('in', 'Intimidation', 2, 'charisma')]);
    const them = who({ name: 'Mark' }, [skill('in2', 'Intimidation', 1, 'charisma')]);
    faces.push(5, 1, 5);
    const o1 = await me.socialTest('Intimidation', them.uuid);
    assert.equal(o1.winner, 'none');
    assert.match(chat.at(-1).content, /A stand-off/);
    t.after(urrMode());
    faces.push(5, 1, 5);
    const o2 = await me.socialTest('Intimidation', them.uuid);
    assert.equal(o2.winner, 'initiator');
    assert.match(chat.at(-1).content, /wins<\/strong> the tie/);
    assert.equal(faces.length, 0);
  });
});

describe('v0.80.0 core: Karma and training', () => {
  test('raising an attribute: × 2 and days by rating (book); × 1.5 and Karma × 8 hours (Revamp)', async (t) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    t.after(oldWay({ 'UPKEEP.karma.attributeMultiplier': 2, 'CORE_V923.trainingTime': 'rating' }));
    const book = who({ karma: { pool: 0, poolSpent: 0, good: 30, career: 30 } });
    assert.equal(await book.improve({ attribute: 'quickness' }), true);
    assert.equal(book.system.karma.good, 30 - 12);
    assert.equal(book.system.training[0].days, 6 * RULES.CHARACTERS_V58.training.daysPerRating['attribute']!);
    t.after(urrMode());
    const urr = who({ karma: { pool: 0, poolSpent: 0, good: 30, career: 30 } });
    assert.equal(await urr.improve({ attribute: 'quickness' }), true);
    assert.equal(urr.system.karma.good, 30 - 9);
    assert.equal(urr.system.training[0].days, Math.ceil(9 * 8 / 5), 'Willpower 5 hours a day');
  });

  test('an instructor for an attribute: must reach the new rating (book); any rating, ÷ (1 + successes) (Revamp)', async (t) => {
    const run = async () => {
      const student = who({ name: 'Student', karma: { pool: 0, poolSpent: 0, good: 30, career: 30 } });
      const teacher = who({ name: 'Teacher' }, [skill('ins', 'Instruction', 3, 'charisma')]);
      await student.improve({ attribute: 'quickness' });
      const before = student.system.training[0].days;
      faces.push(5, 5, 1);
      await student.trainWith(student.system.training[0].id, teacher.uuid);
      assert.equal(faces.length, 0);
      return { before, after: student.system.training[0].days };
    };
    const b = await run();
    assert.equal(b.after, b.before, 'Quickness 5 is below the new rating 6: no help');
    assert.match(chat.at(-1).content, /no help/i);
    t.after(urrMode());
    const u = await run();
    assert.equal(u.after, Math.ceil(u.before / 3));
    assert.match(chat.at(-1).content, /cuts the training/);
  });

  test('a metahuman finishing the creation wizard: Karma Pool 1 (book), 2 (Revamp)', async (t) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    t.after(oldWay({ 'CORE_V923.startPool': 'old' }));
    // A plain actor (the record deep-copies its system).
    const who = (o: any) => ({ type: 'character', name: 'New', items: [], flags: {} as any, system: { attributes: {}, essence: 6, ...o },
      getFlag(s: string, k: string) { return this.flags[s]?.[k]; }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); } });
    const b = who({ metatype: 'troll', karma: { pool: 1, poolSpent: 0, good: 0, career: 0 } });
    await recordCreation(b, { how: 'wizard' });
    assert.equal(b.system.karma.pool, 1);
    t.after(urrMode());
    const u = who({ metatype: 'troll', karma: { pool: 1, poolSpent: 0, good: 0, career: 0 } });
    await recordCreation(u, { how: 'wizard' });
    assert.equal(u.system.karma.pool, 2);
    const asIs = who({ metatype: 'troll', karma: { pool: 1, poolSpent: 0, good: 0, career: 0 } });
    await recordCreation(asIs, { how: 'asIs' });
    assert.equal(asIs.system.karma.pool, 1, 'recorded as it stands: unchanged');
  });
});

describe('v0.80.0 core: gear', () => {
  const gun = { id: 'g1', type: 'gear', name: 'Thing', system: { cost: 1000, streetIndex: 1, availability: '4/48 hrs', quantity: 1 } };

  test('finding gear: the Availability TN (book), + 2 (Revamp)', async (t) => {
    const a = who({}, [skill('et', 'Etiquette', 3, 'charisma'), gun]);
    faces.push(5, 1, 1);
    await a.findItem('g1');
    const tn1 = chat.at(-1).flags.sr2e.contest.sides[0].result.targetNumber;
    t.after(urrMode());
    faces.push(5, 1, 1);
    await a.findItem('g1');
    const r2 = chat.at(-1).flags.sr2e.contest.sides[0].result;
    assert.equal(r2.targetNumber, tn1 + 2);
    assert.ok(r2.modifiers.some((m: any) => m.label === 'Acquisition' && m.value === 2));
    assert.equal(faces.length, 0);
  });

  test("haggling: the seller rolls vs 4 (book), vs the buyer's Intelligence (Revamp)", async (t) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    t.after(oldWay({ 'CORE_V923.haggle': 'old' }));
    const a = who({}, [skill('ne', 'Negotiation', 2, 'charisma')], { ...A, intelligence: 6 });
    faces.push(1, 1, 1, 1, 1, 1);
    await a.haggle({ itemId: 'x', price: 1000, name: 'Gun' });
    assert.equal(chat.at(-1).flags.sr2e.contest.sides[1].result.targetNumber, RULES.STREET.haggle.tn);
    t.after(urrMode());
    faces.push(1, 1, 1, 1, 1, 1);
    await a.haggle({ itemId: 'x', price: 1000, name: 'Gun' });
    assert.equal(chat.at(-1).flags.sr2e.contest.sides[1].result.targetNumber, 6);
  });
});

describe('v0.80.0 core: the roll dialogs (source)', () => {
  test('the skill and attribute dialogs show the Revamp rows only through urrCore helpers (empty in the book)', () => {
    const src = readFileSync(new URL('../applications/sheets.ts', import.meta.url), 'utf8');
    assert.match(src, /\$\{urrCoreTnPresetRow\(String\(item\.system\?\.kind \?\? ""\)\)\}\$\{extra58\}/);
    // v0.92.3: the Karma dice row comes through C923.karmaDiceRow (the Revamp's row when coreKarmaDice is on, the book's otherwise).
    assert.match(src, /C923\.karmaDiceRow\(Number\(actor\.system\?\.derived\?\.karmaPoolLeft \?\? 0\), Number\(item\.system\?\.rating \?\? 0\) > 0, Number\(item\.system\?\.rating \?\? 0\)\)/);
    assert.equal((src.match(/f\?\.elements\?\.tnPreset\?\.addEventListener/g) ?? []).length, 2);
    assert.match(src, /karmaDice: choice\.karmaDice/);
    assert.match(src, /karmaDice: c2\.karmaDice/);
    // v0.89.2: the hint's text is in lang/en.json; the Revamp rule is still filled in by its helper
    assert.match(src, /tx\('SR2E\.Dialog\.Sheet\.theInstructorSVs', \{[^}]*\b\w+: urrCoreInstructorRule\(\)/);
  });
});
