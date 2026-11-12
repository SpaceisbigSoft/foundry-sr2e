/**
 * v0.92.0: the layered Magic Pool (rules/magicpool.ts, RULES.MAGIC_V920) and the rules interpretations
 * (rules/interpretations.ts, applications/interpretations.ts). Stubs as in v0916.test.ts.
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

import { narrowCovers, sorceryUse, poolLayers, narrowRating, narrowLeft, poolForUse, spendPlan, sorcerySkillOf } from '../rules/magicpool.ts';
import { INTERPRETATIONS, interpMark, interpLine, interpsForSnapshot, interpsForFind, ruleValue } from '../rules/interpretations.ts';

const M = RULES.MAGIC_V920;
const SORC = { rating: 4, concentration: 'Spellcasting', concentrationRating: 6, specialization: 'Combat spells', specializationRating: 8 };
const sorc = (sys: any = SORC) => ({ id: 'so', type: 'skill', name: 'Sorcery', system: { attribute: 'willpower', kind: 'active', ...sys } });
const BOLT = { id: 'sp1', type: 'spell', name: 'ZZ Bolt', system: { category: 'combat', spellType: 'mana', learnedForce: 4, drainLevel: 'M', drainModifier: 0 } };
const HEAL = { id: 'sp2', type: 'spell', name: 'ZZ Heal', system: { category: 'health', spellType: 'mana', learnedForce: 3, drainLevel: 'L', drainModifier: 0 } };
const mage = (sys: any = SORC, extra: any = {}) => who({ name: 'Mage', tradition: 'hermetic', magic: 6, ...extra }, [sorc(sys), BOLT, HEAL]);

describe('v0.92.0 the layered pool (rules/magicpool.ts)', () => {
  test('a name covers an action by its kind, the spell\'s category or its name', () => {
    assert.equal(narrowCovers('Spellcasting', 'cast'), true);
    assert.equal(narrowCovers('Spell Defense', 'defense'), true);
    assert.equal(narrowCovers('Dispelling', 'dispel'), true);
    assert.equal(narrowCovers('Combat spells', 'cast', { category: 'combat' }), true);
    assert.equal(narrowCovers('Combat spells', 'cast', { category: 'health' }), false);
    assert.equal(narrowCovers('ZZ Bolt', 'cast', { spellName: 'ZZ Bolt' }), true);
    assert.equal(narrowCovers('Spellcasting', 'dispel'), false);
    assert.equal(narrowCovers('', 'cast'), false);
  });
  test('the layers: each the rating above the one below; a specialization brings its concentration', () => {
    assert.deepEqual(poolLayers(SORC), { conc: 2, spec: 2, concName: 'Spellcasting', specName: 'Combat spells' });
    assert.deepEqual(poolLayers({ rating: 4, specialization: 'Combat spells', specializationRating: 6 }), { conc: 0, spec: 2, concName: '', specName: 'Combat spells' });
    assert.deepEqual(sorceryUse(SORC, 'cast', { category: 'combat' }), { conc: true, spec: true });
    assert.deepEqual(sorceryUse(SORC, 'cast', { category: 'health' }), { conc: true, spec: false });
    assert.deepEqual(sorceryUse(SORC, 'dispel'), { conc: false, spec: false });
    assert.equal(narrowRating(SORC, { conc: true, spec: true }), 8);
    assert.equal(narrowRating(SORC, { conc: true, spec: false }), 6);
    assert.equal(narrowRating(SORC, { conc: false, spec: false }), 4);
  });
  test('the pool for a use and a spend: narrow first, never more than there is', () => {
    const left = narrowLeft({ conc: 2, spec: 2 }, { conc: 1, spec: 0 });
    assert.deepEqual(left, { conc: 1, spec: 2 });
    assert.equal(poolForUse(4, left, { conc: true, spec: true }), 7);
    assert.equal(poolForUse(4, left, { conc: false, spec: false }), 4);
    assert.deepEqual(spendPlan(5, 4, left, { conc: true, spec: true }), { spec: 2, conc: 1, general: 2 });
    assert.deepEqual(spendPlan(9, 4, left, { conc: true, spec: true }), { spec: 2, conc: 1, general: 4 });
    assert.deepEqual(spendPlan(3, 4, left, { conc: false, spec: false }), { spec: 0, conc: 0, general: 3 });
  });
  test('the switches back: flat, plain Sorcery', async () => {
    await withRule(M, 'poolLayers', 'flat', async () => assert.deepEqual(poolLayers(SORC), { conc: 0, spec: 0, concName: '', specName: '' }));
    await withRule(M, 'castNarrow', 'off', async () => assert.equal(narrowRating(SORC, { conc: true, spec: true }), 4));
    assert.equal(sorcerySkillOf([{ type: 'skill', name: 'sorcery', system: { rating: 2 } }, { type: 'skill', name: 'Sorcery', system: { rating: 5 } }])?.system.rating, 5);
  });
});

describe('v0.92.0 the layered pool on a character (glue)', () => {
  test('the derived layers and what a combat spell may use', () => {
    const a = mage();
    assert.equal(a.system.derived.spellPool, 4);
    assert.deepEqual({ ...a.system.derived.spellLayers }, { conc: 2, spec: 2, concName: 'Spellcasting', specName: 'Combat spells', concLeft: 2, specLeft: 2 });
    assert.equal(a.spellPoolFor(a.sorceryUseFor('cast', { category: 'combat' })), 8);
    assert.equal(a.spellPoolFor(a.sorceryUseFor('cast', { category: 'health' })), 6);
    assert.equal(a.spellPoolFor(a.sorceryUseFor('dispel')), 4);
  });
  test('a combat spell rolls the specialization, spends narrow dice first; the Magic cap holds', async () => {
    const a = mage();
    faces.push(...Array(8 + 6).fill(5), ...Array(20).fill(5));
    await a.castSpell(a.items.get('sp1'), { force: 4, poolDice: 7, drainPoolDice: 0 });
    const card = chat.find((m: any) => m.flags?.sr2e?.test?.kind === 'spell' || m.flags?.sr2e?.test?.kind === 'attack') ?? chat[0];
    assert.match(card.flags.sr2e.test.label, /Combat spells 8/);
    // 7 asked, the Magic cap 6: specialization 2, concentration 2, general 2.
    assert.equal(a.system.poolSpent.spellSpec, 2);
    assert.equal(a.system.poolSpent.spellConc, 2);
    assert.equal(a.system.poolSpent.spell, 2);
    assert.match(card.content, /data-sr2e-interp="magicPoolLayers"/);
    assert.match(card.content, /data-sr2e-interp="narrowCasting"/);
  });
  test('flat and off: the old way (Sorcery 4, the general pool only)', async () => {
    await withRule(M, 'poolLayers', 'flat', async () => withRule(M, 'castNarrow', 'off', async () => {
      const a = mage();
      assert.equal(a.spellPoolFor(a.sorceryUseFor('cast', { category: 'combat' })), 4);
      faces.push(...Array(40).fill(5));
      await a.castSpell(a.items.get('sp1'), { force: 4, poolDice: 3, drainPoolDice: 0 });
      assert.doesNotMatch(chat.at(-2)?.flags?.sr2e?.test?.label ?? chat.at(-1).flags.sr2e.test.label, /Combat spells 8/);
      assert.equal(a.system.poolSpent.spell, 3);
      assert.equal(a.system.poolSpent.spellConc ?? 0, 0);
    }));
  });
  test('the refresh empties the narrow layers too', () => {
    assert.match(read('src', 'module', 'documents', 'index.ts'), /'system\.poolSpent\.spell': 0, 'system\.poolSpent\.spellConc': 0, 'system\.poolSpent\.spellSpec': 0/);
    assert.match(read('src', 'module', 'applications', 'ui.ts'), /'system\.poolSpent\.spellConc': 0, 'system\.poolSpent\.spellSpec': 0/);
  });
});

describe('v0.92.0 interpretations (rules/interpretations.ts)', () => {
  test('every entry has its texts and a switch that exists', () => {
    assert.ok(INTERPRETATIONS.length >= 12);
    for (const i of INTERPRETATIONS) {
      for (const part of ['title', 'summary', 'gap', 'resolution', 'sources']) assert.ok(keyIn(`SR2E.Interp.List.${i.id}.${part}`), `${i.id}.${part}`);
      assert.notEqual(ruleValue(RULES, i.rule), undefined, i.rule);
      assert.ok(keyIn(`SR2E.Interp.Area.${i.area}`));
    }
  });
  test('the mark and the line: escaped, unknown ids dropped, repeats once', () => {
    const m = interpMark('magicPoolLayers');
    assert.match(m, /data-sr2e-interp="magicPoolLayers"/);
    assert.match(m, /data-tooltip="Sorcery/);
    assert.equal(interpMark('nope'), '');
    const l = interpLine(['fixer', 'nope', 'fixer', 'contactHelp']);
    assert.equal((l.match(/data-sr2e-interp=/g) ?? []).length, 2);
    assert.equal(interpLine([]), '');
  });
  test('what a card rests on, from its snapshot or find', () => {
    assert.deepEqual(interpsForSnapshot({ learn: { foreign: true, extraDice: 2, from: 'x' } }, RULES), ['otherTradition', 'teacher', 'formulaRequired']);
    assert.deepEqual(interpsForSnapshot({ narrow: { layers: true, rating: false } }, RULES), ['magicPoolLayers']);
    assert.deepEqual(interpsForSnapshot(null, RULES), []);
    assert.deepEqual(interpsForFind({ legalityCounts: true, through: 'fixer' }), ['legalityFind', 'fixer']);
    assert.deepEqual(interpsForFind({ legalityCounts: false, through: 'self' }), []);
  });
});

describe('v0.92.0 wiring', () => {
  test('house rules, the tool, the guide, the window and the click handler', () => {
    const set = read('src', 'module', 'settings.ts');
    for (const k of Object.keys(M)) { assert.match(set, new RegExp(`path: "MAGIC_V920\\.${k}"`)); assert.ok(keyIn(`SR2E.HouseRules.Rule.MAGIC_V920__${k}`)); }
    assert.match(read('src', 'module', 'rules', 'tools.ts'), /id: 'interpretations'/);
    assert.match(read('src', 'module', 'applications', 'tools.ts'), /interpretations: \(\) => \{ SR2Interpretations\.open\(\); \}/);
    assert.ok(keyIn('SR2E.Tools.interpretations.label') && keyIn('SR2E.Window.Interpretations.title'));
    assert.match(read('src', 'module', 'rules', 'guide.ts'), /topic\('interpretations', 'both', \[\]/);
    assert.ok(keyIn('SR2E.Guide.Topic.interpretations.b2.i3'));
    assert.match(read('public', 'templates', 'interpretations.hbs'), /data-interp-id="\{\{id\}\}"/);
    assert.match(read('src', 'module', 'sr2e-system.ts'), /registerInterpretations\(\);/);
    assert.match(read('public', 'templates', 'status-strip.hbs'), /\{\{\{narrowMark\}\}\}/);
  });
});

describe('v0.92.0 review fixes', () => {
  test('B1: a specialization counts only where its concentration does (no Spell Defense or Spellcasting leak)', () => {
    const def = { rating: 4, concentration: 'Spell Defense', concentrationRating: 6, specialization: 'Combat', specializationRating: 8 };
    assert.deepEqual(sorceryUse(def, 'cast', { category: 'combat' }), { conc: false, spec: false });
    assert.deepEqual(sorceryUse(SORC, 'ritual', { category: 'combat' }), { conc: false, spec: false }, 'Spellcasting is not Ritual Sorcery');
    assert.deepEqual(sorceryUse({ rating: 4, specialization: 'Combat', specializationRating: 6 }, 'cast', { category: 'combat' }), { conc: false, spec: true }, 'no concentration: the specialization alone');
  });
  test('B2: a specialization named after a spell covers that spell only', () => {
    const cs = { rating: 4, specialization: 'Combat Sense', specializationRating: 6 };
    assert.deepEqual(sorceryUse(cs, 'cast', { category: 'combat', spellName: 'Manabolt' }), { conc: false, spec: false });
    assert.deepEqual(sorceryUse(cs, 'cast', { category: 'detection', spellName: 'Combat Sense' }), { conc: false, spec: true });
    assert.equal(narrowCovers('Combat spells', 'cast', { category: 'combat' }), true);
  });
  test('R4: the rating never drops below the concentration; R6: a Spell Defense layer is left out', () => {
    assert.equal(narrowRating({ rating: 4, concentration: 'Spellcasting', concentrationRating: 6, specialization: 'Combat', specializationRating: 5 }, { conc: true, spec: true }), 6);
    assert.deepEqual(poolLayers({ rating: 4, concentration: 'Spell Defense', concentrationRating: 6, specialization: 'Combat', specializationRating: 8 }), { conc: 0, spec: 0, concName: '', specName: '' });
  });
  test('R7: dispelling a combat spell inside Dispelling + Combat', () => {
    assert.deepEqual(sorceryUse({ rating: 4, concentration: 'Dispelling', concentrationRating: 6, specialization: 'Combat', specializationRating: 8 }, 'dispel', { category: 'combat' }), { conc: true, spec: true });
  });
  test('R5: Drain takes narrow dice only with drainNarrow on', async () => {
    const a = mage();
    const use = a.sorceryUseFor('cast', { category: 'combat' });
    assert.equal(a.drainPoolFor(use), 8);
    await withRule(M, 'drainNarrow', 'off', async () => assert.equal(a.drainPoolFor(use), 4));
  });
  test('N9: one interpretation line on a find card; N8: the handler takes only the system\'s marks', () => {
    assert.deepEqual(interpsForFind({ legalityCounts: true, through: 'help', retried: true }), ['legalityFind', 'contactHelp', 'findRetry']);
    const src = read('src', 'module', 'applications', 'interpretations.ts');
    assert.match(src, /closest\?\.\('a\.sr2e-interp\[data-sr2e-interp\]'\)/);
    assert.match(src, /isContentEditable/);
  });
});
