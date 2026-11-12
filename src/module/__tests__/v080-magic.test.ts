/**
 * v0.80.0 magic: the Unified Rules Revamp's magic rows, the Foundry glue side (documents/index.ts, models/index.ts)
 * and the existing pure functions the wiring gates. The new pure functions are in rules/__tests__/urr80-magic.test.ts.
 * The stubs are a copy of v078.test.ts's. Each change is checked under the Revamp's magic patch and under the book.
 * The Revamp side lays only this area's patch (magicMode), so the other areas' rows can't move these dice.
 */
import { test, describe, before, beforeEach, after } from 'node:test';
import { SORCERY_V922 } from '../rules/__tests__/sorcery922.ts';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { SPIRITS_V922_WAY } from '../rules/__tests__/spirits922.ts';
import { URR80_PATCH_MAGIC } from '../rules/config80-magic.ts';
import {
  magicLossOutcome, resolveCombatSpell, conjuringDrainLevel, conjuringDrainType, astralForm, projectionOverstay, domainConflict,
  totemDice, totemEnvironmentDice, learningPlan, wardPlan, siteRaiseCost, missingSites, ritualMaterialsCost,
} from '../rules/index.ts';
// v0.92.3: this file pins the v0.92.2 conjuring, astral and initiation rules (the book way: v0923-spirits.test.ts).
let spirits922: () => void = () => {};
before(() => { spirits922 = oldWay(SPIRITS_V922_WAY); });
after(() => spirits922());

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
  a.uuid = `Actor.v80m-${++n}`; a.id = `id${n}`;
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

describe('v0.80.0 magic loss on 2D6 ≤ Magic (URR_V80.magLossLe)', () => {
  test('the book: a roll equal to Magic keeps it', async (t) => {
    // v0.92.3 (RULES.HEALTH_V923.magicLoss 'atOrBelow', Core p. 115): the book itself says "less than or equal to";
    // the v0.92.2 Book Rules kept it.
    const b = mage();
    faces.push(3, 3);
    assert.deepEqual(await b.rollMagicLoss(), { total: 6, lost: 1 });
    t.after(oldWay({ 'HEALTH_V923.magicLoss': 'below' }));
    const m = mage();
    faces.push(3, 3);
    assert.deepEqual(await m.rollMagicLoss(), { total: 6, lost: 0 });
    assert.equal(m.system.magic, 6);
  });
  test('the Revamp: a roll equal to Magic loses a point', async (t) => {
    t.after(magicMode());
    const m = mage();
    faces.push(3, 3);
    assert.deepEqual(await m.rollMagicLoss(), { total: 6, lost: 1 });
    assert.equal(m.system.magic, 5);
    assert.deepEqual(magicLossOutcome(7, 6), { lost: 0, threshold: 6 });
  });
});

describe('v0.80.0 casting (magCastDice, magRuleOfOneDrain, magExclusiveForce, magSustainCap, magAstralDrainPhysical)', () => {
  test('the book: Sorcery dice; no drain change on a disaster', async (t) => {
    // v0.92.3: 'the book' here is the v0.92.2 reading (RULES.SORCERY_V923 at its old way); the book's way is in v0923-sorcery.test.ts.
    t.after(oldWay(SORCERY_V922));
    const m = mage();
    faces.push(1, 1, 1, 1, 1);                                        // Sorcery 5: a disaster
    faces.push(5, 5, 1, 1, 1);                                        // drain: Willpower 5 vs 2
    const r = await m.castSpell(spell(), { force: 3 });
    assert.equal(r.totalDice, 5);
    assert.equal(faces.length, 0);
    assert.equal(drainCard().flags.sr2e.test.targetNumber, 2);
  });
  test('the Revamp: the Force as dice; a disaster adds 2 to the drain TN', async (t) => {
    t.after(magicMode());
    const m = mage();
    faces.push(1, 1, 1);                                              // Force 3: a disaster
    faces.push(5, 5, 1, 1, 1);                                        // drain: Willpower 5 vs 2 + 2
    const r = await m.castSpell(spell(), { force: 3 });
    assert.equal(r.totalDice, 3);
    assert.equal(faces.length, 0);
    assert.equal(drainCard().flags.sr2e.test.targetNumber, 4);
  });
  test('the Revamp: an exclusive spell takes effect 2 Force higher, drain at the chosen Force, no drain cut', async (t) => {
    t.after(magicMode());
    const m = mage();
    faces.push(5, 5, 5, 1, 1, 1);                                     // Force 4 + 2 = 6 dice
    faces.push(5, 5, 1, 1, 1);                                        // drain vs floor(4 / 2) = 2
    const r = await m.castSpell(spell({ learnedForce: 4, exclusive: true }), { force: 4 });
    assert.equal(r.totalDice, 6);
    assert.match(chat[0].content, /Force 6/);
    assert.equal(drainCard().flags.sr2e.test.targetNumber, 2);
    assert.doesNotMatch(drainCard().content, /physical/);
  });
  test('the book: an exclusive spell is cast at its Force, drain TN −2', async (t) => {
    // v0.92.3: 'the book' here is the v0.92.2 reading (RULES.SORCERY_V923 at its old way); the book's way is in v0923-sorcery.test.ts.
    t.after(oldWay(SORCERY_V922));
    const m = mage();
    faces.push(5, 5, 5, 1, 1);
    faces.push(5, 5, 1, 1, 1);
    const r = await m.castSpell(spell({ learnedForce: 4, exclusive: true }), { force: 4 });
    assert.equal(r.totalDice, 5);
    assert.equal(drainCard().flags.sr2e.test.targetNumber, 2);       // max(2, 2 − 2)
    assert.ok(drainCard().flags.sr2e.test.modifiers.some((x: any) => x.label === 'Exclusive' && x.value === -2));
  });
  test('sustaining: the Revamp stops at the Sorcery rating; the book has no limit', async (t) => {
    // v0.92.3: 'the book' here is the v0.92.2 reading (RULES.SORCERY_V923 at its old way); the book's way is in v0923-sorcery.test.ts.
    t.after(oldWay(SORCERY_V922));
    const held = [{ spellName: 'Armor', force: 2, category: 'manipulation', focusId: '' }];
    const m1 = who({ name: 'Mage', magic: 6, tradition: 'hermetic', sustaining: [...held] }, [skill('so', 'Sorcery', 1, 'willpower')]);
    faces.push(5);                                                    // Sorcery 1
    faces.push(5, 1, 1, 1, 1);                                        // drain
    assert.ok(await m1.castSpell(spell({ duration: 'sustained' }), { force: 3 }));
    const undo = magicMode(); t.after(undo);
    warnings.length = 0;
    const m2 = who({ name: 'Mage', magic: 6, tradition: 'hermetic', sustaining: [...held] }, [skill('so', 'Sorcery', 1, 'willpower')]);
    assert.equal(await m2.castSpell(spell({ duration: 'sustained' }), { force: 3 }), null);
    assert.match(warnings.at(-1) ?? '', /at most 1 spell/);
  });
  test('cast while projecting: the Revamp makes the drain Physical', async (t) => {
    const m1 = mage({ astral: 'projecting' });
    faces.push(1, 2, 2, 2, 2); faces.push(5, 5, 1, 1, 1);
    await m1.castSpell(spell(), { force: 3 });
    assert.doesNotMatch(drainCard().content, /physical/);
    t.after(magicMode());
    const m2 = mage({ astral: 'projecting' });
    faces.push(1, 2, 2); faces.push(5, 5, 1, 1, 1);
    await m2.castSpell(spell(), { force: 3 });
    assert.match(drainCard().content, /physical/);
  });
  test('ritual: the Revamp refuses a combat spell by ritual', async (t) => {
    t.after(magicMode());
    const m = mage();
    const r = await m.castSpell(spell({ category: 'combat' }), { force: 3, ritual: { teamUuids: [], materialLink: true } });
    assert.equal(r, null);
    assert.match(warnings.at(-1) ?? '', /Combat spells cannot be cast by ritual/);
  });
});

describe('v0.80.0 spell resistance: a tie (magSpellTie) and a ritual leader (magRitualResistTn)', () => {
  const state = (t: any, over: any = {}) => ({ casterUuid: 'x', targetUuid: t.uuid, spellName: 'Manabolt', force: 5, resistAttribute: 'willpower',
    level: 'M', damageType: 'physical', casterSuccesses: 1, ...over });
  test('the book: a tie is resisted', async (ctx) => {
    // v0.92.3: 'the book' here is the v0.92.2 reading (RULES.SORCERY_V923 at its old way); the book's way is in v0923-sorcery.test.ts.
    ctx.after(oldWay(SORCERY_V922));
    const t = who({ name: 'Goon' });
    faces.push(5, 1, 1, 1, 1);                                        // Willpower 5 vs 5: 1 success
    await t.resistSpell(state(t), 0);
    assert.equal(t.system.monitor.physical, 0);
    assert.match(chat.at(-1).content, /Resisted/);
    assert.equal(resolveCombatSpell({ casterSuccesses: 2, resistSuccesses: 2, level: 'S' }).hit, false);
  });
  test('the Revamp: a tie takes effect at L; a set resistance TN is used', async (t) => {
    t.after(magicMode());
    const tg = who({ name: 'Goon' });
    faces.push(5, 1, 1, 1, 1);
    await tg.resistSpell(state(tg), 0);
    assert.equal(tg.system.monitor.physical, 1);
    assert.match(chat.at(-1).content, /takes effect/);
    faces.push(6, 1, 1, 1, 1); faces.push(1);                         // vs the leader's 7: the 6 + 1 = 7 succeeds
    await tg.resistSpell(state(tg, { resistTn: 7, casterSuccesses: 3 }), 0);
    assert.equal(chat.at(-1).flags.sr2e.test.targetNumber, 7);
  });
});

describe('v0.80.0 astral (magAstralReaction, magAspectedNoAstral, magAstralDamage, magProjFullHours, magTrackRating)', () => {
  const smart = { ...A, intelligence: 6 };
  test('initiative: Int + 20 (book), 2 × Int + 15 (Revamp)', (t) => {
    assert.equal(mage({ astral: 'projecting' }, [], smart).system.derived.astral.initiativeBase, 26);
    assert.equal(astralForm(smart as any).reaction, 6);
    t.after(magicMode());
    assert.equal(mage({ astral: 'projecting' }, [], smart).system.derived.astral.initiativeBase, 27);
  });
  test('aspected sorcerers: astral in the book, not in the Revamp', (t) => {
    assert.equal(mage({ tradition: 'sorcerer', astral: 'projecting' }).system.derived.astralMode, 'projecting');
    t.after(magicMode());
    assert.equal(mage({ tradition: 'sorcerer', astral: 'projecting' }).system.derived.astralMode, 'physical');
    assert.equal(mage({ tradition: 'hermetic', astral: 'projecting' }).system.derived.astralMode, 'projecting');
  });
  const wf = { id: 'wf', type: 'focus', name: 'Sword focus', system: { focusType: 'weapon', rating: 3, active: true, bonded: true, category: '', target: '' } };
  test('a magician\'s astral attack: Charisma M (book)', async () => {
    const m = mage({ astral: 'perceiving' }); const foe = mage({ name: 'Foe', astral: 'projecting' });
    faces.push(5, 5, 1, 1, 1);                                        // Sorcery 5
    await m.astralAttack({ targetUuid: foe.uuid });
    assert.deepEqual([chat.at(-1).flags.sr2e.attack.power, chat.at(-1).flags.sr2e.attack.level], [4, 'M']);
  });
  test('the Revamp: unarmed L; a weapon focus adds its rating to the Power at M', async (t) => {
    t.after(magicMode());
    const foe = mage({ name: 'Foe', astral: 'projecting' });
    const m = mage({ astral: 'perceiving' });
    faces.push(5, 5, 1, 1, 1);
    await m.astralAttack({ targetUuid: foe.uuid });
    assert.deepEqual([chat.at(-1).flags.sr2e.attack.power, chat.at(-1).flags.sr2e.attack.level], [4, 'L']);
    const armed = mage({ astral: 'perceiving' }, [wf]);
    faces.push(5, 5, 1, 1, 1, 1, 1, 1);                               // Sorcery 5 + focus 3
    await armed.astralAttack({ targetUuid: foe.uuid });
    assert.deepEqual([chat.at(-1).flags.sr2e.attack.power, chat.at(-1).flags.sr2e.attack.level], [7, 'M']);
    assert.equal(faces.length, 0);
  });
  test('projection: the book allows Essence × 2 hours; the Revamp costs each full hour', (t) => {
    assert.deepEqual(projectionOverstay(2.5, 6), { limit: 12, over: 0, essenceLoss: 0 });
    t.after(magicMode());
    assert.deepEqual(projectionOverstay(2.5, 6), { limit: 0, over: 2.5, essenceLoss: 2 });
  });
  test('tracking: the Revamp adds −2 for a Force within the tracker\'s Sorcery', async (t) => {
    const sig = { kind: 'spell', label: 'A spell', force: 3, worldTime: 0, onObject: true };
    const m1 = mage({ astral: 'perceiving' });
    faces.push(5, 1, 1, 1, 1);
    await m1.track({ signature: sig as any });
    assert.equal(chat.at(-1).flags.sr2e.test.targetNumber, 4);
    t.after(magicMode());
    const m2 = mage({ astral: 'perceiving' });
    faces.push(5, 1, 1, 1, 1);
    await m2.track({ signature: sig as any });
    assert.equal(chat.at(-1).flags.sr2e.test.targetNumber, 2);
    assert.equal(chat.at(-1).flags.sr2e.test.track.baseHours, 12);
  });
});

describe('v0.80.0 conjuring, wards, learning, sites and traditions', () => {
  test('conjuring drain: the book table and Magic; the Revamp by Charisma', (t) => {
    assert.deepEqual([conjuringDrainLevel(2, 4), conjuringDrainLevel(7, 4), conjuringDrainType(5, 6, 4)], ['L', 'D', 'stun']);
    assert.equal(domainConflict(['forest'], 'city'), null);
    t.after(magicMode());
    assert.deepEqual([conjuringDrainLevel(2, 4), conjuringDrainLevel(7, 4), conjuringDrainType(5, 6, 4), conjuringDrainType(5, 6)], ['M', 'S', 'physical', 'stun']);
    assert.match(domainConflict(['forest'], 'city') ?? '', /only one at a time/);
  });
  test('wards: the Revamp uses Sorcery, caps the Force and drains at Force + successes, Stun', async (t) => {
    // v0.92.3: 'the book' here is the v0.92.2 reading (RULES.SORCERY_V923 at its old way); the book's way is in v0923-sorcery.test.ts.
    t.after(oldWay(SORCERY_V922));
    const book = wardPlan(4, 2);
    assert.deepEqual([book.drainTn, book.drainLevel, book.nuyen], [2, 'M', 0]);
    t.after(magicMode());
    const m = mage();
    assert.equal(await m.raiseWardRitual({ force: 13, payMaterials: false }), null);
    assert.match(warnings.at(-1) ?? '', /at most 12/);
    faces.push(5, 5, 1, 1, 1);                                        // Sorcery 5 vs 3: 2 successes
    faces.push(5, 5, 5, 5, 5);                                        // drain: Willpower 5 vs 3 + 2
    await m.raiseWardRitual({ force: 3, payMaterials: false });
    const d = drainCard();
    assert.equal(d.flags.sr2e.test.targetNumber, 5);
    assert.match(d.content, /Ward drain L/);
    assert.equal(wardPlan(3, 0).nuyen, 300);
  });
  test('learning: Sorcery vs Force (book); + Magical Theory vs 2 × Force (Revamp)', async (t) => {
    // v0.92.3: 'the book' here is the v0.92.2 reading (RULES.SORCERY_V923 at its old way); the book's way is in v0923-sorcery.test.ts.
    t.after(oldWay(SORCERY_V922));
    t.after(oldWay({ 'MAGIC_V56.learning.enabled': true, 'MAGIC_V56.learning.site': 'off' }));
    const m1 = mage({}, [skill('mt', 'Magical Theory', 3, 'intelligence')]);
    faces.push(5, 5, 1, 1, 1);
    const r1 = await m1.learnSpellTest({ name: 'Heal', force: 3 });
    assert.deepEqual([r1.totalDice, r1.targetNumber], [5, 3]);
    t.after(magicMode());
    const m2 = mage({}, [skill('mt', 'Magical Theory', 3, 'intelligence')]);
    faces.push(5, 5, 1, 1, 1, 1, 1, 1);
    const r2 = await m2.learnSpellTest({ name: 'Heal', force: 3 });
    assert.deepEqual([r2.totalDice, r2.targetNumber], [8, 6]);
    assert.equal(learningPlan(3, 0).tn, 6);
  });
  test('sites, ritual materials and the hermetic ritual site', (t) => {
    // v0.92.3: 'the book' here is the v0.92.2 reading (RULES.SORCERY_V923 at its old way); the book's way is in v0923-sorcery.test.ts.
    t.after(oldWay(SORCERY_V922));
    const lib = [{ kind: 'library', tag: 'sorcery', rating: 5, name: 'Library' }] as any[];
    assert.deepEqual(siteRaiseCost('library', 0, 3), { nuyen: 3000, days: 3 });
    assert.equal(ritualMaterialsCost(4, 'health'), 0);
    assert.deepEqual(missingSites('ritual', 'hermetic', lib, { force: 4 }), []);
    t.after(magicMode());
    assert.deepEqual(siteRaiseCost('library', 0, 3), { nuyen: 9000, days: 3 });
    assert.equal(ritualMaterialsCost(4, 'health'), 2000);
    assert.match(missingSites('ritual', 'hermetic', lib, { force: 4 })[0] ?? '', /hermetic circle/);
  });
  test('shamanists lose totem dice; adepts keep only weapon foci (Revamp)', (t) => {
    const totem = { name: 'Rat', combat: 0, detection: 2, health: 0, illusion: 0, manipulation: 0, conjuring: 1, environment: 'urban', inEnvironment: 1, outEnvironment: 0 };
    const pf = { id: 'pf', type: 'focus', name: 'Power focus', system: { focusType: 'power', rating: 2, active: true, bonded: true, category: '', target: '' } };
    assert.equal(totemDice('shamanist', totem, 'detection'), 2);
    assert.equal(totemEnvironmentDice('shamanist', totem, ['urban']).dice, 1);
    assert.equal(who({ name: 'Adept', magic: 4, tradition: 'adept' }, [pf]).foci().length, 1);
    t.after(magicMode());
    assert.equal(totemDice('shamanist', totem, 'detection'), 0);
    assert.equal(totemDice('shamanic', totem, 'detection'), 2);
    assert.equal(totemEnvironmentDice('shamanist', totem, ['urban']).dice, 0);
    assert.equal(who({ name: 'Adept', magic: 4, tradition: 'adept' }, [pf]).foci().length, 0);
  });
});
