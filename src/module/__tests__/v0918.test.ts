/**
 * v0.91.8: spell formulas. The pure rules (rules/formulas.ts), the formula key and the gear it sells
 * (applications/shop.ts resolveFormulaKey), learning only from a held formula, a formula item, a teacher's help, the
 * other tradition's penalty, raising a Force, the switches back, and the wiring (settings, language, templates, guide).
 * Stubs as in v0916.test.ts.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';

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

let CharacterDataModel: any, SR2Actor: any;

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
    applications: { api: { DialogV2: { confirm: async () => false, prompt: async () => null, wait: async () => null }, HandlebarsApplicationMixin: (B: any) => B, ApplicationV2: class {} }, instances: new Map() },
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
  ({ CharacterDataModel } = await import('../models/index.ts'));
  ({ SR2Actor } = await import('../documents/index.ts'));
  // The Add window registers how a shop purchase makes its items.
  await import('../applications/adding.ts');
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
  a.uuid = `Actor.v91-${++n}`; a.id = `id${n}`;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness') => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0 } });

/** Run with a RULES path changed, put back afterwards. */
async function withRule<T>(obj: any, key: string, value: unknown, fn: () => T | Promise<T>): Promise<T> {
  const prev = obj[key];
  obj[key] = value;
  try { return await fn(); } finally { obj[key] = prev; }
}


// ---------------------------------------------------------------------------------------------------------------


import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const lang = JSON.parse(read('public', 'lang', 'en.json'));
const keyIn = (k: string) => k.split('.').reduce((o: any, p) => o?.[p], lang) !== undefined;

import {
  formulaPrice, formulaAvailability, formulaKey, parseFormulaKey, isForeign, foreignAdjust, teacherDice, teacherFee, canTeach,
  bestFormula, formulaGearSystem, learnerTradition, formulaCovers, formulasRequired,
} from '../rules/formulas.ts';

const F = RULES.FORMULA_V918;
const STUN = { id: 's1', type: 'spell', name: 'ZZ Stunbolt', system: { category: 'combat', spellType: 'mana', learnedForce: 4, drainLevel: 'M' } };
const HEAL = { id: 's2', type: 'spell', name: 'ZZ Heal', system: { category: 'health', spellType: 'mana', learnedForce: 3 } };
const formula = (spell: any, force: number, tradition = 'hermetic', id = 'g1') => ({ id, type: 'gear', name: `Spell formula: ${spell.name} (Force ${force})`, system: formulaGearSystem({ name: spell.name, system: spell.system }, force, tradition) });
const sorcery = (r = 5) => skill('so', 'Sorcery', r, 'willpower');
const mage = (items: any[] = [], extra: any = {}) => who({ name: 'Mage', tradition: 'hermetic', magic: 6, nuyen: 10000, creation: { done: true }, ...extra }, [sorcery(), ...items]);

describe('v0.91.8 the rules (rules/formulas.ts)', () => {
  test('price by Force, combat dearer; Availability by Force', () => {
    assert.equal(formulaPrice('health', 3), 3 * F.nuyenPerForce);
    assert.equal(formulaPrice('combat', 3), 3 * F.nuyenPerForce * F.combatFactor);
    assert.equal(formulaAvailability(5), `5/${F.availDays} days`);
    assert.equal(formulaAvailability(1), `2/${F.availDays} days`, 'TN never below 2');
  });
  test('the key reads back; nested, out-of-range and long keys are refused', () => {
    const k = formulaKey(6, 'shamanic', 'tpl:w:s1');
    assert.equal(k, 'formula:6:shamanic:tpl:w:s1');
    assert.deepEqual(parseFormulaKey(k), { force: 6, tradition: 'shamanic', spellKey: 'tpl:w:s1' });
    assert.deepEqual(parseFormulaKey(formulaKey(3, '', 'pack:X')), { force: 3, tradition: '', spellKey: 'pack:X' });
    assert.equal(parseFormulaKey('formula:13:hermetic:tpl:w:s1'), null);
    assert.equal(parseFormulaKey('formula:0:hermetic:tpl:w:s1'), null);
    assert.equal(parseFormulaKey('formula:3:hermetic:formula:3:hermetic:x'), null);
    assert.equal(parseFormulaKey(`formula:3:hermetic:${'x'.repeat(400)}`), null);
    assert.equal(parseFormulaKey('tpl:w:s1'), null);
  });
  test('traditions: the learner\'s, the other one harder and slower', () => {
    assert.equal(learnerTradition('hermetic'), 'hermetic');
    assert.equal(learnerTradition('shamanic'), 'shamanic');
    assert.equal(learnerTradition('adept'), '');
    assert.equal(isForeign('shamanic', 'hermetic'), true);
    assert.equal(isForeign('', 'hermetic'), false);
    assert.deepEqual(foreignAdjust({ tn: 4, baseDays: 4, days: 2 }, true), { tn: 4 + F.foreignTn, baseDays: 4 * F.foreignTime, days: 2 * F.foreignTime });
    assert.deepEqual(foreignAdjust({ tn: 4, baseDays: 4, days: null }, true).days, null);
    const prev = F.foreign; F.foreign = 'same';
    try { assert.equal(isForeign('shamanic', 'hermetic'), false); } finally { F.foreign = prev; }
  });
  test('a teacher: dice up to Sorcery, a fee unless a player plays them, only at their Force', () => {
    assert.equal(teacherDice(5, 3), 3);
    assert.equal(teacherDice(2, 6), 2);
    assert.equal(teacherDice(-1, 6), 0);
    assert.equal(teacherFee(4, false), 4 * F.feePerForce);
    assert.equal(teacherFee(4, true), 0);
    assert.equal(canTeach([{ name: 'ZZ Heal', system: { learnedForce: 4 } }], 'ZZ Heal', 4), true);
    assert.equal(canTeach([{ name: 'ZZ Heal', system: { learnedForce: 3 } }], 'ZZ Heal', 4), false);
  });
  test('the gear data: no caster fields; covers its spell up to its Force; the own tradition first', () => {
    const sys: any = formulaGearSystem({ name: 'ZZ Stunbolt', system: { ...STUN.system, sustained: true, focusId: 'x' } }, 5, 'hermetic');
    assert.equal(sys.cost, formulaPrice('combat', 5));
    assert.equal(sys.formula.force, 5);
    assert.equal(sys.formula.data.learnedForce, undefined);
    assert.equal(sys.formula.data.sustained, undefined);
    assert.equal(sys.formula.data.category, 'combat');
    assert.equal(formulaCovers(sys, 'ZZ Stunbolt', 5), true);
    assert.equal(formulaCovers(sys, 'ZZ Stunbolt', 6), false);
    assert.equal(formulaCovers(sys, 'ZZ Heal', 1), false);
    const a = formula(STUN, 5, 'shamanic', 'a'); const b = formula(STUN, 5, 'hermetic', 'b');
    assert.equal((bestFormula([a, b], 'ZZ Stunbolt', 4, 'hermetic') as any).id, 'b');
    assert.equal((bestFormula([a], 'ZZ Stunbolt', 4, 'hermetic') as any).id, 'a');
    assert.equal(bestFormula([a], 'ZZ Stunbolt', 6, 'hermetic'), null);
  });
});

describe('v0.91.8 learning needs a formula (documents/index.ts)', () => {
  test('the shop\'s Learn without a formula: refused, nothing spent', async () => {
    const a = mage();
    assert.equal(await a.learnFormula('ZZ Stunbolt', { ...STUN.system, learnedForce: 4 }, 'study', { origin: 'shop' }), false);
    assert.equal(a.system.karma.good, 30);
    assert.ok(!a.items.some((i: any) => i.type === 'spell'));
    assert.match(warnings.at(-1)!, /needs a spell formula for ZZ Stunbolt at Force 4/);
  });
  test('with a formula held: learned, and the formula named as the source', async () => {
    const a = mage([formula(STUN, 5)]);
    assert.equal(await a.learnFormula('ZZ Stunbolt', { ...STUN.system, learnedForce: 4 }, 'study', { origin: 'shop' }), true);
    assert.ok(a.items.some((i: any) => i.type === 'spell' && i.name === 'ZZ Stunbolt'));
    assert.equal(a.system.karma.good, 26);
  });
  test('a formula of too low a Force doesn\'t do', async () => {
    const a = mage([formula(STUN, 3)]);
    assert.equal(await a.learnFormula('ZZ Stunbolt', { ...STUN.system, learnedForce: 4 }, 'study', { origin: 'shop' }), false);
  });
  test('NPCs, characters in creation and the switch off need none; a design or the grimoire needs none', async () => {
    const npc = mage([], { name: 'NPC' }); npc.type = 'npc';
    assert.equal(await npc.learnFormula('ZZ Stunbolt', { ...STUN.system, learnedForce: 2 }, 'study', { origin: 'shop' }), true);
    const off = mage();
    await withRule(F, 'required', 'off', async () => assert.equal(await off.learnFormula('ZZ Stunbolt', { ...STUN.system, learnedForce: 2 }, 'study', { origin: 'shop' }), true));
    const design = mage();
    assert.equal(await design.learnFormula('ZZ Stunbolt', { ...STUN.system, learnedForce: 2 }, 'their own design', { origin: 'design' }), true);
    // Review (R6): a call without an origin (a console call, an old request) needs a formula too.
    const bare = mage();
    assert.equal(await bare.learnFormula('ZZ Stunbolt', { ...STUN.system, learnedForce: 2 }, 'x'), false);
    assert.equal(formulasRequired(), true);
  });
  test('learning from a formula item: up to its Force; a wrong id is refused', async () => {
    const a = mage([formula(HEAL, 4)]);
    assert.equal(await a.learnFromFormula('nope', 3), false);
    assert.equal(await a.learnFromFormula('g1', 9), true, 'asked for 9, learned at the formula\'s 4');
    const sp = a.items.find((i: any) => i.type === 'spell');
    assert.equal(sp.name, 'ZZ Heal');
    assert.equal(sp.system.learnedForce, 4);
    assert.equal(sp.system.category, 'health');
  });
  test('raising a Force needs a formula of the new Force; the formula item raises it', async () => {
    const known = { id: 'k1', type: 'spell', name: 'ZZ Heal', system: { ...HEAL.system, learnedForce: 2 } };
    const a = mage([known]);
    assert.equal(await a.raiseSpellForce(a.items.get('k1'), 3), false);
    assert.match(warnings.at(-1)!, /needs a spell formula for ZZ Heal at Force 3/);
    const b = mage([{ ...known, system: { ...known.system } }, formula(HEAL, 4)]);
    assert.equal(await b.learnFromFormula('g1', 3), true);
    assert.equal(b.items.get('k1').system.learnedForce, 3);
    const c = mage([{ ...known, system: { ...known.system } }]);
    await withRule(F, 'raise', 'off', async () => assert.equal(await c.raiseSpellForce(c.items.get('k1'), 3), true));
  });
  test('the learning test: the other tradition\'s formula raises the TN; a teacher\'s dice are added (capped)', async () => {
    const L: any = RULES.MAGIC_V56.learning;
    const prev = { enabled: L.enabled, site: L.site };
    L.enabled = true; L.site = 'off';
    try {
      const a = mage([formula(STUN, 4, 'shamanic')]);
      faces.push(1, 1, 1, 1, 1);
      await a.learnFormula('ZZ Stunbolt', { ...STUN.system, learnedForce: 4 }, 'study', { origin: 'shop' });
      const snap = chat.at(-1).flags.sr2e.test;
      // v0.92.3 (RULES.SORCERY_V923.learning, formulaAloneTn; Core p. 132, Grimoire p. 114): 2 × Force, + the other
      // tradition's penalty, + 2 for a formula with no teacher.
      assert.equal(snap.targetNumber, 2 * 4 + F.foreignTn + RULES.SORCERY_V923.formulaAloneTn);
      assert.equal(snap.learn.foreign, true);
      const b = mage();
      faces.push(...Array(5 + 12).fill(1));
      await b.learnSpellTest({ name: 'ZZ Heal', force: 2, extraDice: 40 });
      assert.equal(faces.length, 0, 'Sorcery 5 + 12 capped extra dice');
    } finally { L.enabled = prev.enabled; L.site = prev.site; }
  });
});

describe('v0.91.8 formulas in the shop (applications/shop.ts)', () => {
  test('a formula key is the gear it sells, read back from the spell; off or unknown: nothing', async () => {
    settings['itemTemplates'] = [STUN];
    const { resolveShopKey } = await import('../applications/shop.ts');
    const t: any = await resolveShopKey(formulaKey(3, 'hermetic', 'tpl:w:s1'));
    assert.equal(t.type, 'gear');
    assert.equal(t.system.cost, formulaPrice('combat', 3));
    assert.equal(t.system.formula.spell, 'ZZ Stunbolt');
    assert.equal(t.data.system.formula.force, 3);
    assert.match(t.name, /SR2E\.Text\.Formula\.nameTradition|ZZ Stunbolt/);
    assert.equal(await resolveShopKey(formulaKey(3, 'hermetic', 'tpl:w:nope')), null);
    // Review (N4): still read with formulas off (orders and requests already made arrive).
    await withRule(F, 'required', 'off', async () => assert.equal((await resolveShopKey(formulaKey(3, 'hermetic', 'tpl:w:s1')))?.type, 'gear'));
  });
  test('bought like gear: the price is the key\'s, not the caller\'s; the formula arrives on the sheet', async () => {
    settings['itemTemplates'] = [STUN];
    const a = mage();
    a.system.nuyen = 100000;
    const key = formulaKey(2, 'hermetic', 'tpl:w:s1');
    assert.equal(await a.buyFromShop(key, 1), true, 'a low price is clamped to what haggling allows');
    const made = a.items.find((i: any) => i.type === 'gear');
    assert.equal(made.system.formula.spell, 'ZZ Stunbolt');
    assert.ok(a.system.nuyen < 100000 - 1, 'more than ¥1 was paid');
    assert.equal(await a.learnFormula('ZZ Stunbolt', { ...STUN.system, learnedForce: 2 }, 'study', { origin: 'shop' }), true);
  });
});

const TEACHER = () => {
  const t = who({ name: 'Teacher', tradition: 'hermetic', magic: 6 }, [skill('in', 'Instruction', 4, 'charisma'), skill('so', 'Sorcery', 2, 'willpower'), { ...HEAL, system: { ...HEAL.system, learnedForce: 5, exclusive: true } }]);
  t.type = 'npc';
  return t;
};
/** The messages as Foundry keeps them (by id), each authored by the current user. */
function messagesById() {
  g.game.messages = { contents: chat, get: (id: string) => chat.find((m: any) => m.id === id) };
  for (const m of chat) m.author ??= { id: g.game.user.id };
}

describe('v0.91.8 teachers', () => {
  test('the teacher\'s card offers the learning test; their successes (up to Sorcery) help; an NPC charges', async () => {
    const teacher = TEACHER();
    const a = mage();
    faces.push(5, 5, 5, 1);
    await a.learnFromTeacher(teacher.uuid, 'ZZ Heal', 4);
    const m = chat.at(-1);
    messagesById();
    const snap = m.flags.sr2e.test;
    assert.equal(snap.teach.spell, 'ZZ Heal');
    assert.equal(snap.teach.teacherUuid, teacher.uuid);
    assert.equal(snap.teach.system.exclusive, undefined, 'the teacher\'s own choices aren\'t taught');
    assert.match(m.content, /data-sr2e-action="learnTaught"/);
    assert.equal(await a.learnTaught(m.id), 'used');
    assert.equal(a.system.nuyen, 10000 - 4 * F.feePerForce);
    assert.equal(a.items.find((i: any) => i.type === 'spell')?.system.learnedForce, 4);
  });
  test('the help is read from the card: forged fee and dice are worked out again; another author\'s card is refused', async () => {
    const teacher = TEACHER();
    const a = mage();
    faces.push(5, 5, 5, 5);
    await a.learnFromTeacher(teacher.uuid, 'ZZ Heal', 3);
    const m = chat.at(-1);
    messagesById();
    m.flags.sr2e.test.teach.fee = 0; m.flags.sr2e.test.teach.sorcery = 12;
    const L: any = RULES.MAGIC_V56.learning;
    const prev = { enabled: L.enabled, site: L.site };
    L.enabled = true; L.site = 'off';
    try {
      // Sorcery 5 + the teacher's 4 successes capped at their Sorcery 2 = 7 dice.
      faces.push(...Array(7).fill(5));
      assert.equal(await a.learnTaught(m.id), 'used');
      assert.equal(faces.length, 0, '7 dice, not 5 + 4');
      assert.equal(a.system.nuyen, 10000 - 3 * F.feePerForce, 'the fee worked out again');
    } finally { L.enabled = prev.enabled; L.site = prev.site; }
    const b = mage();
    faces.push(5, 5, 1, 1);
    await b.learnFromTeacher(teacher.uuid, 'ZZ Heal', 3);
    const m2 = chat.at(-1);
    messagesById();
    m2.author = { id: 'someoneElse' };
    assert.equal(await b.learnTaught(m2.id), 'refused');
    assert.match(warnings.at(-1)!, /can't be used for this/);
  });
  test('no Good Karma: refused before any fee, and the card stays usable', async () => {
    const teacher = TEACHER();
    const a = mage();
    a.system.karma.good = 1;
    faces.push(5, 5, 1, 1);
    await a.learnFromTeacher(teacher.uuid, 'ZZ Heal', 4);
    messagesById();
    assert.equal(await a.learnTaught(chat.at(-1).id), 'refused');
    assert.equal(a.system.nuyen, 10000);
  });
  test('a teacher who doesn\'t know it at that Force, or the switch off: refused', async () => {
    const teacher = who({ name: 'T2' }, [{ ...HEAL, system: { ...HEAL.system, learnedForce: 2 } }]);
    const a = mage();
    assert.equal(await a.learnFromTeacher(teacher.uuid, 'ZZ Heal', 4), null);
    assert.match(warnings.at(-1)!, /doesn't know ZZ Heal at Force 4/);
    await withRule(F, 'teacher', 'off', async () => assert.equal(await a.learnFromTeacher(teacher.uuid, 'ZZ Heal', 1), null));
  });
  test('the card is spent once used (the chat button), even after a failed learning test', () => {
    const chatSrc = read('src', 'module', 'applications', 'chat.ts');
    assert.match(chatSrc, /if \(r === 'used'\) \{ try \{ await message\.setFlag\(SYSTEM_ID, 'taught', true\)/);
    assert.match(chatSrc, /if \(message\.getFlag\(SYSTEM_ID, 'taught'\)\) return/);
  });
});

describe('v0.91.8 wiring', () => {
  test('every switch is a house rule with its text; every Formula key the code uses is in the language file', () => {
    const set = read('src', 'module', 'settings.ts');
    for (const k of Object.keys(F)) {
      assert.match(set, new RegExp(`path: "FORMULA_V918\\.${k}"`), k);
      assert.ok(keyIn(`SR2E.HouseRules.Rule.FORMULA_V918__${k}`), k);
    }
    const code = ['documents/index.ts', 'applications/formulas.ts', 'applications/shop.ts', 'applications/adding.ts', 'applications/chat.ts', 'applications/sheets.ts'].map((f) => read('src', 'module', ...f.split('/'))).join('\n')
      + read('public', 'templates', 'item-sheet.hbs') + read('public', 'templates', 'add-window.hbs') + read('public', 'templates', 'actor-character-sheet.hbs');
    const used = new Set([...code.matchAll(/SR2E\.(?:Text|Notify|Card|Dialog|App)\.Formula\.[A-Za-z]+|SR2E\.UI\.(?:buyFormula\w*|spellFormula|formula\w+|learnFormula\w*|learnFromTeacher)/g)].map((m) => m[0]));
    assert.ok(used.size > 30, `${used.size} keys`);
    for (const k of used) assert.ok(keyIn(k), k);
  });
  test('the buttons are wired: the shop row, the item sheet, the Spells heading, the card', () => {
    assert.match(read('public', 'templates', 'add-window.hbs'), /data-action="buyFormula"/);
    assert.match(read('src', 'module', 'applications', 'adding.ts'), /buyFormula: SR2AddWindow\.#onBuyFormula/);
    assert.match(read('public', 'templates', 'item-sheet.hbs'), /data-action="learnFormulaItem"/);
    assert.match(read('src', 'module', 'applications', 'sheets.ts'), /learnFormulaItem: SR2ItemSheet\.#onLearnFormulaItem/);
    assert.match(read('public', 'templates', 'actor-character-sheet.hbs'), /data-action="learnFromTeacher"/);
    assert.match(read('src', 'module', 'applications', 'sheets.ts'), /learnFromTeacher: SR2CharacterSheet\.#onLearnFromTeacher/);
    assert.match(read('src', 'module', 'applications', 'chat.ts'), /action === 'learnTaught'\) return onLearnTaught/);
  });
  test('the guide has the topic, in the magic category', () => {
    const guide = read('src', 'module', 'rules', 'guide.ts');
    assert.match(guide, /topic\('spell-formulas', 'both', \[\]/);
    assert.match(guide, /category\('magic', 'players', \[[^\]]*'spell-formulas'/);
    assert.ok(keyIn('SR2E.Guide.Topic.spellFormulas.b2.i4'));
  });
});
