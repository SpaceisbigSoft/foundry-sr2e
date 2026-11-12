/**
 * v0.92.3 book alignment (sorcery): the Foundry glue side (documents/index.ts, models/index.ts) of the
 * RULES.SORCERY_V923 switches. The stubs are a copy of v080-magic.test.ts's. Each change is checked at its default
 * (the book's way); the v0.92.2 way is checked where the flow differs. The pure functions are in
 * rules/__tests__/v0923-sorcery.test.ts.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { URR80_PATCH_MAGIC } from '../rules/config80-magic.ts';

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
  a.uuid = `Actor.v923s-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness', more: any = {}) => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, ...more } });

/** The Revamp's magic rows only (and the mode flag), for one test. */
const magicMode = (extra: Record<string, unknown> = {}) => {
  const patch: Record<string, unknown> = { 'URR_V80.active': true };
  for (const [k, v] of Object.entries(URR80_PATCH_MAGIC)) patch[k] = structuredClone(v);
  return oldWay({ ...patch, ...extra });
};
const mage = (extra: any = {}, items: any[] = [], attrs: Record<string, number> = A) =>
  who({ name: 'Mage', magic: 6, tradition: 'hermetic', ...extra }, [skill('so', 'Sorcery', 5, 'willpower'), ...items], attrs);
const spell = (over: any = {}) => ({ id: 'sp1', name: 'Detect Life', type: 'spell', system: {
  category: 'detection', spellType: 'mana', learnedForce: 3, damageLevel: 'L', damageType: 'stun', targetNumber: 4,
  drainModifier: 0, drainLevel: 'L', duration: 'instant', ...over } });
const drainCard = () => [...chat].reverse().find((m) => /(Drain|Ward drain) [LMSD] \(TN/.test(String(m.content ?? '')));

describe('v0.92.3 casting', () => {
  test('all ones on the casting test: Drain TN +2 (Core p. 131)', async () => {
    const m = mage();
    faces.push(1, 1, 1, 1, 1);                                        // Sorcery 5: all ones
    faces.push(5, 5, 1, 1, 1);                                        // drain: Willpower 5 vs 2 + 2
    await m.castSpell(spell(), { force: 3 });
    assert.equal(faces.length, 0);
    assert.equal(drainCard().flags.sr2e.test.targetNumber, 4);
  });
  test('an exclusive spell takes effect 2 Force higher, Drain at the chosen Force with no cut; an expendable fetish +2', async () => {
    const m = mage();
    faces.push(5, 5, 5, 1, 1); faces.push(5, 5, 1, 1, 1);
    await m.castSpell(spell({ learnedForce: 4, exclusive: true }), { force: 4 });
    assert.match(chat[0].content, /Force 6/);
    assert.equal(drainCard().flags.sr2e.test.targetNumber, 2);
    assert.ok(!drainCard().flags.sr2e.test.modifiers.some((x: any) => x.value < 0));
    chat.length = 0;
    faces.push(5, 5, 5, 1, 1); faces.push(5, 5, 1, 1, 1);
    await m.castSpell(spell({ learnedForce: 3, fetish: true, fetishExpendable: true }), { force: 3 });
    assert.match(chat[0].content, /Force 5/);
  });
  test('sustained spells: at most the Sorcery rating', async () => {
    const held = [{ spellName: 'Armor', force: 2, category: 'manipulation', focusId: '' }];
    const m = who({ name: 'Mage', magic: 6, tradition: 'hermetic', sustaining: [...held] }, [skill('so', 'Sorcery', 1, 'willpower')]);
    assert.equal(await m.castSpell(spell({ duration: 'sustained' }), { force: 3 }), null);
    assert.match(warnings.at(-1) ?? '', /at most 1 spell/);
  });
  test('no sustaining while projecting: the cast is refused, and projecting drops the spells sustained', async (t) => {
    const m = mage({ astral: 'projecting' });
    assert.equal(await m.castSpell(spell({ duration: 'sustained' }), { force: 3 }), null);
    assert.match(warnings.at(-1) ?? '', /projecting/);
    const p = mage({ sustaining: [{ spellName: 'Armor', force: 2, category: 'manipulation', focusId: '' }, { spellName: 'Locked', force: 2, category: 'health', focusId: 'f1' }] });
    await p.onAstralModeChange('physical', 'projecting', { noAction: true });
    assert.deepEqual(p.system.sustaining.map((s: any) => s.spellName), ['Locked']);
    t.after(oldWay({ 'SORCERY_V923.sustainProjecting': 'v922' }));
    const q = mage({ sustaining: [{ spellName: 'Armor', force: 2, category: 'manipulation', focusId: '' }] });
    await q.onAstralModeChange('physical', 'projecting', { noAction: true });
    assert.equal(q.system.sustaining.length, 1);
  });
  test('a tie on a resisted spell takes effect at the spell\'s base level', async () => {
    const tg = who({ name: 'Goon' });
    faces.push(5, 1, 1, 1, 1);                                        // Willpower 5 vs Force 5: 1 success, as the caster's
    await tg.resistSpell({ casterUuid: 'x', targetUuid: tg.uuid, spellName: 'Manabolt', force: 5, resistAttribute: 'willpower', level: 'M', damageType: 'physical', casterSuccesses: 1 }, 0);
    assert.equal(tg.system.monitor.physical, 3);
    assert.match(chat.at(-1).content, /takes effect/);
  });
  test('an area spell: one roll, each target counts it against its own TN', async () => {
    const m = mage();
    const low = who({ name: 'Low' }, [], { ...A, willpower: 3 });
    const high = who({ name: 'High' }, [], { ...A, willpower: 5 });
    faces.push(3, 3, 4, 5, 1);                                        // Sorcery 5 vs the lowest, 3: four successes
    faces.push(5, 5, 5, 1, 1);                                        // drain
    await m.castSpell(spell({ name: 'Manaball', category: 'combat', spellType: 'mana', area: true, damageLevel: 'M', drainLevel: 'S', learnedForce: 4 }), { force: 4, targetUuids: [low.uuid, high.uuid] });
    const card = chat.find((c) => c.flags?.sr2e?.spells);
    assert.ok(card, 'the cast card carries both targets');
    assert.equal(card.flags.sr2e.test.targetNumber, 3);
    assert.deepEqual(card.flags.sr2e.spells.map((s: any) => s.casterSuccesses), [4, 1]);
  });
  test('v922: an area spell rolls against the highest TN', async (t) => {
    t.after(oldWay({ 'SORCERY_V923.areaTargets': 'v922' }));
    const m = mage();
    const low = who({ name: 'Low' }, [], { ...A, willpower: 3 });
    const high = who({ name: 'High' }, [], { ...A, willpower: 5 });
    faces.push(3, 3, 4, 5, 1); faces.push(5, 5, 5, 1, 1);
    await m.castSpell(spell({ name: 'Manaball', category: 'combat', spellType: 'mana', area: true, damageLevel: 'M', drainLevel: 'S', learnedForce: 4 }), { force: 4, targetUuids: [low.uuid, high.uuid] });
    const card = chat.find((c) => c.flags?.sr2e?.spells);
    assert.equal(card.flags.sr2e.test.targetNumber, 5);
    assert.deepEqual(card.flags.sr2e.spells.map((s: any) => s.casterSuccesses), [1, 1]);
  });
});

describe('v0.92.3 metamagic, geasa, foci', () => {
  test('dispelling: only Force up to the grade; 2 successes take a Force off; at 0 the spell is broken', async () => {
    const caster = who({ name: 'Caster', magic: 6, tradition: 'hermetic', sustaining: [{ spellName: 'Armor', force: 2, category: 'manipulation', focusId: '', successes: 3 }, { spellName: 'Barrier', force: 3, category: 'manipulation', focusId: '', successes: 2 }] });
    const init = mage({ initiateGrade: 3, metamagic: { dispelling: true } });
    assert.equal(await init.dispel(caster, 1), null);               // Force 3 over the book's Grade 2
    assert.match(warnings.at(-1) ?? '', /Force up to the initiate grade \(2\)/);
    faces.push(5, 5, 5, 5, 1);                                        // Sorcery 5 vs 2: four successes
    faces.push(5, 5, 5, 5, 5);                                        // drain
    await init.dispel(caster, 0);
    assert.deepEqual(caster.system.sustaining.map((s: any) => s.spellName), ['Barrier']);
  });
  test('dispelling a Force 3 spell with 2 successes leaves it at Force 2', async () => {
    const caster = who({ name: 'Caster', magic: 6, tradition: 'hermetic', sustaining: [{ spellName: 'Barrier', force: 3, category: 'manipulation', focusId: '', successes: 2 }] });
    const init = mage({ initiateGrade: 4, metamagic: { dispelling: true } });
    faces.push(5, 5, 1, 1, 1);                                        // Sorcery 5 vs 3: two successes
    faces.push(5, 5, 5, 5, 5);
    await init.dispel(caster, 0);
    assert.deepEqual(caster.system.sustaining.map((s: any) => [s.spellName, s.force]), [['Barrier', 2]]);
  });
  test('geasa: a broken geas adds +2 TN to casting and keeps the Magic', async () => {
    const m = mage({ geasa: [{ text: 'Gesture', magic: 1, met: false, checkOnCast: false }] });
    assert.equal(m.system.derived.magic, 6);
    faces.push(5, 5, 1, 1, 1); faces.push(5, 5, 5, 1, 1);
    await m.castSpell(spell(), { force: 3 });
    assert.equal(chat[0].flags.sr2e.test.targetNumber, 6);
    assert.equal(drainCard().flags.sr2e.test.targetNumber, 4);
  });
  test('focus addiction: a Magic test; failed, 2D6 at or below Magic loses a point', async () => {
    const focus = (id: string) => ({ id, type: 'focus', name: id, system: { focusType: 'spell', rating: 4, category: 'combat', active: true, bonded: true } });
    const m = mage({}, [focus('f1'), focus('f2')]);
    faces.push(1, 2, 3, 4, 5, 1);                                     // Magic 6 vs 8: no success
    faces.push(3, 3);                                                 // 2D6 = 6, at Magic 6
    await m.focusAddictionTest();
    assert.equal(m.system.magic, 5);
    assert.equal(m.getFlag('sr2e', 'focusMagicLost'), 1);
  });
  test('a spell focus adds its dice to the Drain test', async () => {
    const m = mage({}, [{ id: 'f1', type: 'focus', name: 'Detect focus', system: { focusType: 'spell', rating: 2, target: 'Detect Life', active: true, bonded: true } }]);
    faces.push(5, 5, 1, 1, 1, 1, 1);                                  // Sorcery 5 + focus 2
    faces.push(5, 5, 1, 1, 1, 1, 1);                                  // drain: Willpower 5 + focus 2
    await m.castSpell(spell(), { force: 3 });
    assert.equal(faces.length, 0);
    assert.equal(drainCard().flags.sr2e.test.totalDice, 7);
  });
});

describe('v0.92.3 wards and learning', () => {
  test('a ward: Sorcery vs Force, Drain (Force × successes) L, Stun', async () => {
    const m = mage();
    assert.equal(await m.raiseWardRitual({ force: 13, payMaterials: false }), null);
    faces.push(5, 5, 1, 1, 1);                                        // Sorcery 5 vs 3: 2 successes
    faces.push(5, 5, 5, 5, 5);                                        // drain vs 3 × 2
    await m.raiseWardRitual({ force: 3, payMaterials: false });
    const d = drainCard();
    assert.equal(d.flags.sr2e.test.targetNumber, 6);
    assert.match(d.content, /Ward drain L/);
  });
  test('learning: Sorcery + Magical Theory vs 2 × Force; a formula with no teacher +2', async (t) => {
    t.after(oldWay({ 'MAGIC_V56.learning.enabled': true, 'MAGIC_V56.learning.site': 'off' }));
    const m = mage({}, [skill('mt', 'Magical Theory', 3, 'intelligence')]);
    faces.push(5, 5, 1, 1, 1, 1, 1, 1);
    const r = await m.learnSpellTest({ name: 'Heal', force: 3 });
    assert.deepEqual([r.totalDice, r.targetNumber], [8, 6]);
    faces.push(5, 5, 1, 1, 1, 1, 1, 1);
    const r2 = await m.learnSpellTest({ name: 'Heal', force: 3, alone: true });
    assert.equal(r2.targetNumber, 8);
  });
});

describe('v0.92.3 the Revamp: casting as before', () => {
  test('the Revamp: the Force as dice; a disaster +2; an exclusive spell 2 higher (with the book switches at their defaults)', async (t) => {
    t.after(magicMode());
    const m = mage();
    faces.push(1, 1, 1); faces.push(5, 5, 1, 1, 1);
    const r = await m.castSpell(spell(), { force: 3 });
    assert.equal(r.totalDice, 3);
    assert.equal(drainCard().flags.sr2e.test.targetNumber, 4);
  });
});
