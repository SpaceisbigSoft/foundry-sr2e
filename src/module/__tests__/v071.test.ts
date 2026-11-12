/**
 * v0.71.0: the common rules holes from the v0.69.0 review (docs/REVIEW-v0.69.md, section 2, R1–R21), the Foundry
 * glue side (documents/index.ts and applications/*). The pure rules (R3, R4, R7, R8, R9, R21) are in
 * rules/__tests__/v071creation.test.ts and v071matrix.test.ts. The stubs are a copy of v070.test.ts's (scripted
 * dice, a chat log of message objects with getFlag, warnings). These check OUR wiring, not that Foundry behaves
 * as the stubs do.
 */
import { test, describe, before, beforeEach, after } from 'node:test';
import { SORCERY_V922 } from '../rules/__tests__/sorcery922.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { SPIRITS_V922_WAY } from '../rules/__tests__/spirits922.ts';
import assert from 'node:assert/strict';
import { RULES, haggledPrice, hotFencePrice, icInitiative, initiativeWoundPenalty } from '../rules/index.ts';
import { buttonCost } from '../rules/interface.ts';
import { vehicleRepairPlan } from '../rules/roadwork.ts';
import { initiativeFormula } from '../helpers/initiative.ts';
import { useV922Vehicles } from '../rules/__tests__/v922vehicles.ts';
// v0.92.3: this file pins the v0.92.2 conjuring, astral and initiation rules (the book way: v0923-spirits.test.ts).
let spirits922: () => void = () => {};
before(() => { spirits922 = oldWay(SPIRITS_V922_WAY); });
after(() => spirits922());

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

let CharacterDataModel: any, VehicleDataModel: any, SR2Actor: any, SR2Combatant: any;

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
  ({ SR2Actor, SR2Combatant } = await import('../documents/index.ts'));
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
  a.uuid = `Actor.v71-${++n}`; a.id = `id${n}`;
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
  Object.assign(v, { type: 'vehicle', name: extra.name ?? 'Americar', uuid: `Actor.v71veh-${++n}`, system: sys, items: withGet([]), statuses: new Set<string>() });
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

/** Run with a RULES path changed, put back afterwards. */
async function withRule<T>(obj: any, key: string, value: unknown, fn: () => T | Promise<T>): Promise<T> {
  const prev = obj[key];
  obj[key] = value;
  try { return await fn(); } finally { obj[key] = prev; }
}

// ---------------------------------------------------------------------------------------------------------------

describe('R1 Karma Pool on contest and street cards', () => {
  const dealer = (pool = 3, items: any[] = []) => who({ name: 'Face', karma: { pool, poolSpent: 0, good: 10, career: 10 } },
    [skill('neg', 'Negotiation', 4, 'charisma'), skill('eti', 'Etiquette', 3, 'charisma'), ...items]);

  test('haggle posts a contest card with Karma buttons for the side with a Karma Pool (not the seller)', async () => {
    const a = dealer();
    faces.push(5, 1, 1, 1, 2, 2, 2, 2);                                  // 1 success vs the seller's 0
    const price = await a.haggle({ itemId: 'x', price: 1000, name: 'Ares Predator' });
    const card = chat.at(-1);
    const c = card.flags.sr2e.contest;
    assert.equal(c.kind, 'haggle');
    assert.ok(c.id, 'a contest id');
    assert.equal(price, haggledPrice(1000, 1).price);
    assert.equal(card.flags.sr2e.buy.price, price);
    assert.equal(card.flags.sr2e.haggled, true);
    assert.match(card.content, /data-sr2e-action="contestKarma" data-side="0" data-op="reroll"/);
    assert.match(card.content, /data-sr2e-action="contestKarma" data-side="0" data-op="buy"/);
    assert.doesNotMatch(card.content, /data-side="1"/);
  });

  test('contestContent: no Karma buttons with contestKarma off, nor for an actor with no Karma Pool', async () => {
    const a = dealer();
    faces.push(5, 1, 1, 1, 2, 2, 2, 2);
    await a.haggle({ itemId: 'x', price: 1000, name: 'Gun' });
    const c = chat.at(-1).flags.sr2e.contest;
    assert.match(SR2Actor.contestContent(c), /contestKarma/);
    await withRule(RULES.FIXES_V71, 'contestKarma', false, () => {
      assert.doesNotMatch(SR2Actor.contestContent(c), /contestKarma/);
    });
    const broke = dealer(0);
    assert.doesNotMatch(SR2Actor.contestContent({ ...c, sides: c.sides.map((s: any, i: number) => (i === 0 ? { ...s, uuid: broke.uuid } : s)) }), /contestKarma/);
  });

  test('contestKarma reroll: spends the pool, posts a newer card of the same contest; the old one counts as replaced', async () => {
    const a = dealer();
    faces.push(5, 1, 1, 1, 2, 2, 2, 2);
    await a.haggle({ itemId: 'x', price: 1000, name: 'Gun' });
    const old = chat.at(-1);
    g.game.messages = { contents: [old] };
    assert.equal(SR2Actor.isReplaced(old), false);
    faces.push(5, 5, 1);                                                 // the 3 failures: 2 more successes
    const next = await SR2Actor.contestKarma(old, 0, 'reroll');
    assert.ok(next);
    assert.equal(a.system.karma.poolSpent, 1);
    const c = next.flags.sr2e.contest;
    assert.equal(c.id, old.flags.sr2e.contest.id);
    assert.equal(c.sides[0].result.successes, 3);
    assert.equal(c.sides[0].rerolls, 1);
    assert.equal(next.flags.sr2e.buy.price, haggledPrice(1000, 3).price);
    assert.match(next.content, /Karma re-roll #1/);
    g.game.messages = { contents: [old, next] };
    assert.equal(SR2Actor.isReplaced(old), true);
    assert.equal(SR2Actor.isReplaced(next), false);
    assert.equal(await SR2Actor.contestKarma(old, 0, 'reroll'), null);
    assert.match(warnings.at(-1) ?? '', /replaced by a later one/);
  });

  test('contestKarma buy: one more success (the pool point is permanent by default); avoid: a disaster undone', async () => {
    const a = dealer();
    faces.push(5, 1, 1, 1, 2, 2, 2, 2);
    await a.haggle({ itemId: 'x', price: 1000, name: 'Gun' });
    const bought = await SR2Actor.contestKarma(chat.at(-1), 0, 'buy');
    assert.equal(bought.flags.sr2e.contest.sides[0].result.successes, 2);
    assert.equal(bought.flags.sr2e.contest.sides[0].bought, 1);
    if (RULES.KARMA.buyPermanent) assert.equal(a.system.karma.pool, 2); else assert.equal(a.system.karma.poolSpent, 1);
    assert.equal(bought.flags.sr2e.buy.price, haggledPrice(1000, 2).price);
    // A disaster on a find test: avoid it.
    const b = dealer(3, [{ id: 'gun', type: 'gear', name: 'Gun', system: { availability: '4/48hrs', cost: 500, streetIndex: 1, quantity: 1 } }]);
    faces.push(1, 1, 1);                                                 // Etiquette 3: all ones
    const r = await b.findItem('gun');
    assert.deepEqual({ found: r.found, hours: r.hours }, { found: false, hours: null });
    const card = chat.at(-1);
    assert.equal(card.flags.sr2e.contest.sides[0].result.botch, true);
    assert.match(card.content, /data-op="avoid"/);
    assert.equal(card.flags.sr2e.buy, undefined, 'not found: no Buy flag');
    const saved = await SR2Actor.contestKarma(card, 0, 'avoid');
    assert.equal(saved.flags.sr2e.contest.sides[0].result.botch, false);
    assert.equal(saved.flags.sr2e.contest.sides[0].avoided, true);
    assert.equal(b.system.karma.poolSpent, 1);
  });

  test('contestKarma does nothing with the switch off', async () => {
    const a = dealer();
    faces.push(5, 1, 1, 1, 2, 2, 2, 2);
    await a.haggle({ itemId: 'x', price: 1000, name: 'Gun' });
    const card = chat.at(-1);
    await withRule(RULES.FIXES_V71, 'contestKarma', false, async () => {
      assert.equal(await SR2Actor.contestKarma(card, 0, 'reroll'), null);
    });
    assert.equal(a.system.karma.poolSpent, 0);
  });

  test('findItem: a contest card; found: the Buy flag carries the hours; a Karma re-roll can find it', async () => {
    const b = dealer(3, [{ id: 'gun', type: 'gear', name: 'Gun', system: { availability: '4/48hrs', cost: 500, streetIndex: 1, quantity: 1 } }]);
    faces.push(2, 2, 2);                                                 // no successes, no disaster
    const r = await b.findItem('gun');
    assert.equal(r.found, false);
    const card = chat.at(-1);
    assert.equal(card.flags.sr2e.contest.kind, 'find');
    assert.match(card.content, /Not found/);
    faces.push(5, 5, 2);
    const again = await SR2Actor.contestKarma(card, 0, 'reroll');
    assert.equal(again.flags.sr2e.buy.hours, 24);                        // 48 h ÷ 2 successes
    assert.equal(again.flags.sr2e.buy.itemId, 'gun');
    assert.match(again.content, /Found in/);
  });

  test('fence: the offer on the card flag; a share the heat eats whole: the fence passes, no Sell flag', async (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.fence': 'old' }));
    const loot = (heat: number) => ({ id: 'loot', type: 'gear', name: 'Loot', system: { cost: 1000, streetIndex: 1, quantity: 1, heat, heatAt: 0 } });
    const a = dealer(3, [loot(0)]);
    faces.push(5, 5, 1, 1, 2, 2, 2, 2);
    const offer = await a.fence('loot');
    const card = chat.at(-1);
    assert.equal(card.flags.sr2e.contest.kind, 'fence');
    assert.equal(card.flags.sr2e.sell.price, offer);
    assert.equal(offer, hotFencePrice(1000, 2, 0).price);
    assert.match(card.content, /data-op="reroll"/);
    const hot = dealer(3, [loot(8)]);
    faces.push(2, 2, 2, 2, 5, 5, 1, 1);                                  // −2 net at Heat 8
    assert.equal(await hot.fence('loot'), 0);
    assert.match(chat.at(-1).content, /The fence passes/);
    assert.equal(chat.at(-1).flags.sr2e.sell, undefined);
  });

  test('legwork: a contest card with Karma buttons', async (t) => {
    t.after(oldWay({"BOOK_V78.legwork.mode": "tn"})); // v0.78.0: the old rule (a house rule)
    const a = dealer();
    a.system.contacts = [{ id: 'c1', name: 'Fixer', level: 2, fee: 0, loyalty: 2, dice: 0, favours: 0 }];
    faces.push(5, 1, 1);
    const r = await a.legwork('c1', { difficultyTn: 4 });
    assert.equal(r.successes, 1);
    const card = chat.at(-1);
    assert.equal(card.flags.sr2e.contest.kind, 'legwork');
    assert.match(card.content, /data-sr2e-action="contestKarma" data-side="0"/);
  });

  test('contestFlags: haggle price from the net, fence offer (none when it passes), find hours (none when not found)', () => {
    const res = (successes: number) => ({ successes, dice: [], botch: false });
    const haggle = { kind: 'haggle', actorName: 'A', sides: [{ name: 'A', label: '', result: res(3) }, { name: 'S', label: '', result: res(1) }], deal: { price: 2000, buy: { itemId: 'i', price: 2000 } } };
    assert.deepEqual(SR2Actor.contestFlags(haggle), { buy: { itemId: 'i', price: haggledPrice(2000, 2).price }, haggled: true });
    const fence = { kind: 'fence', actorName: 'A', sides: [{ name: 'A', label: '', result: res(2) }, { name: 'F', label: '', result: res(0) }], deal: { value: 1000, heat: 0, sell: { itemId: 'i', price: 0 } } };
    assert.deepEqual(SR2Actor.contestFlags(fence), { sell: { itemId: 'i', price: hotFencePrice(1000, 2, 0).price } });
    assert.deepEqual(SR2Actor.contestFlags({ ...fence, sides: [{ name: 'A', label: '', result: res(0) }, { name: 'F', label: '', result: res(4) }], deal: { value: 1000, heat: 8, sell: {} } }), {});
    const find = { kind: 'find', actorName: 'A', sides: [{ name: 'A', label: '', result: res(3) }], deal: { avHours: 48, buy: { itemId: 'i' } } };
    assert.deepEqual(SR2Actor.contestFlags(find), { buy: { itemId: 'i', hours: 16 } });
    assert.deepEqual(SR2Actor.contestFlags({ ...find, sides: [{ name: 'A', label: '', result: res(0) }] }), {});
    assert.deepEqual(SR2Actor.contestFlags({ kind: 'social', actorName: 'A', sides: [{ name: 'A', label: '', result: res(3) }] }), {});
  });
});

describe('R2 contests through the shared skill-dice path', () => {
  const sneaky = () => who({ name: 'Sneak' }, [
    skill('st', 'Stealth', 3), skill('per', 'Perception', 4, 'intelligence'),
    { id: 'suit', type: 'gear', name: 'Sneaksuit', system: { quantity: 1, skillMods: [{ skill: 'Stealth', dice: 2, tn: 0 }, { skill: 'Perception', dice: 1, tn: 0 }] } },
    { id: 'ap', type: 'adeptpower', name: 'Improved Stealth', system: { cost: 1, active: true, level: 1, attributes: {}, reaction: 0, initiativeDice: 0, skill: 'Stealth', skillDice: 1, ballistic: 0, impact: 0, special: '', sense: '' } },
  ]);

  test('stealthSide: Stealth + named-skill gear + adept dice; the old raw rating with the switch off', async () => {
    const a = sneaky();
    const s = a.stealthSide();
    assert.equal(s.rating, 3);
    assert.equal(s.dice, 6);                                             // 3 + suit 2 + adept 1
    assert.match(s.suffix ?? '', /adept \+1/);
    assert.match(s.suffix ?? '', /Sneaksuit \+2/);
    await withRule(RULES.FIXES_V71, 'contestSkillDice', false, () => { assert.equal(a.stealthSide().dice, 3); });
  });

  test('perceptionDice: Perception + gear dice; the old raw rating with the switch off; no skill: Intelligence', async (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.perception': 'opposed' }));
    const a = sneaky();
    const p = a.perceptionDice();
    assert.equal(p.dice, 5);                                             // 4 + suit 1
    assert.match(p.label, /Perception 4/);
    await withRule(RULES.FIXES_V71, 'contestSkillDice', false, () => { assert.equal(a.perceptionDice().dice, 4); });
    const plain = who({ name: 'Guard' });
    assert.equal(plain.perceptionDice().dice, A.intelligence);
  });
});

describe('R5 a jumped-in rigger dodges with a driving test', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  const atk = (v: any) => ({ attackerUuid: 'x', targetUuid: v.uuid, weaponName: 'Gun', melee: false, damageType: 'physical', power: 8, level: 'M', attackSuccesses: 2, targetNumber: 4, antiVehicle: true });

  test("riggerDodge 'skill': Car skill + Control Pool against Handling; 'pool': the pool alone", async () => {
    const v = vehicle({ mods: adapted });
    const a = rigger(2);
    v.system.occupants.push(a.uuid);
    assert.equal(await a.takeControl(v, 'jumped'), true);
    faces.push(5, 5, 5, 5, 5, 5, 5, 5);                                  // Car 5 + 3 Control Pool
    await v.defend(atk(v), 3);
    const card = chat.at(-1);
    assert.match(card.content, /evasive driving \(Rigger, jumped in, Handling \d+\).*\+ 3 Control Pool/);
    assert.equal(faces.length, 0, 'all 8 dice rolled');
    assert.equal(a.system.poolSpent.control, 3);
    await a.refreshPools?.();
    a.system.poolSpent.control = 0; a.system.prepareDerivedData();
    faces.push(5, 5, 5);
    await withRule(RULES.FIXES_V71, 'riggerDodge', 'pool', () => v.defend(atk(v), 3));
    assert.match(chat.at(-1).content, /Evasive driving \(Rigger, Control Pool\)/);
    assert.equal(faces.length, 0);
  });
});

describe('R10 a counterattack keeps the defending weapon\'s extras', () => {
  const attack = (def: any) => ({ attackerUuid: 'Actor.nobody', targetUuid: def.uuid, weaponName: 'Katana', melee: true, damageType: 'physical', power: 6, level: 'M', attackSuccesses: 1, targetNumber: 4, reach: 1 });
  const defender = (w: any) => who({ name: 'Guard' }, [skill('cl', 'Clubs', 4, 'strength'), { id: 'w1', type: 'weapon', name: w.name, system: { melee: true, skill: 'Clubs', strengthPower: false, damagePower: 6, damageLevel: 'M', damageType: 'physical', reach: 1, ...w.system } }]);

  test('a stun baton: Stun against half impact armor, a charge spent', async () => {
    const def = defender({ name: 'Stun baton', system: { stunWeapon: true, ammo: 10, ammoMax: 10 } });
    faces.push(5, 5, 5, 1);                                              // 3 vs 1: counterattack
    await def.defend(attack(def), 0, { weaponId: 'w1' });
    const d = chat.at(-1).flags.sr2e.damage;
    assert.match(chat.at(-1).content, /Counterattack!/);
    assert.equal(d.targetUuid, 'Actor.nobody');
    assert.equal(d.damageType, 'stun');
    assert.equal(d.armorKind, RULES.STUN_WEAPONS.armorKind);
    assert.equal(d.armorMultiplier, RULES.STUN_WEAPONS.armorMultiplier);
    assert.equal(def.items.get('w1').system.ammo, 9);
  });

  test('a silver blade: material on the damage; switched off: the old plain damage', async () => {
    const def = defender({ name: 'Silver sword', system: { material: 'silver' } });
    faces.push(5, 5, 5, 1);
    await def.defend(attack(def), 0, { weaponId: 'w1' });
    assert.equal(chat.at(-1).flags.sr2e.damage.material, 'silver');
    const baton = defender({ name: 'Stun baton', system: { stunWeapon: true, ammo: 10, ammoMax: 10, material: 'silver' } });
    faces.push(5, 5, 5, 1);
    await withRule(RULES.FIXES_V71, 'counterWeaponExtras', false, () => baton.defend(attack(baton), 0, { weaponId: 'w1' }));
    const d = chat.at(-1).flags.sr2e.damage;
    assert.equal(d.damageType, 'physical');
    assert.equal(d.armorKind, undefined);
    assert.equal(d.armorMultiplier, undefined);
    assert.equal(d.material, undefined);
    assert.equal(baton.items.get('w1').system.ammo, 10);
  });
});

describe('R11 a partial dispel shrinks the spell\'s effect', () => {
  const spec = { name: 'Armor', attributes: {}, perSuccess: true, bundle: { ballistic: 1, impact: 1 }, kind: 'spell' as const, capAt: 6, step: 1 };
  const setup = () => {
    const subj = who({ name: 'Subject' });
    const oldSubj = who({ name: 'Old subject' });
    const caster = who({ name: 'Caster', magic: 6, tradition: 'hermetic',
      sustaining: [{ spellName: 'Armor', force: 4, category: 'manipulation', focusId: '', successes: 3, quickened: false, effectId: 'fx1', targetUuids: [subj.uuid, oldSubj.uuid] }] });
    subj.flags.sr2e = { powerEffects: [SR2Actor.fxEntry(spec, 3, 'fx1', caster.uuid, 'Caster')] };
    const oldFx = { id: 'fx1', fromUuid: caster.uuid, fromName: 'Caster', name: 'Armor', attributes: {}, kind: 'spell', ballistic: 3, impact: 3 };
    oldSubj.flags.sr2e = { powerEffects: [oldFx] };
    const d = who({ name: 'Dispeller', magic: 6, tradition: 'hermetic', metamagic: { dispelling: true }, initiateGrade: 1 }, [skill('sorc', 'Sorcery', 4, 'willpower')]);
    return { subj, oldSubj, caster, d, oldFx };
  };

  test('2 of 3 successes dispelled: the subject\'s effect is rebuilt at 1; an old entry (no spec) is left with a note', async (t) => {
    // v0.92.3: 'the book' here is the v0.92.2 reading (RULES.SORCERY_V923 at its old way); the book's way is in v0923-sorcery.test.ts.
    t.after(oldWay(SORCERY_V922));
    const { subj, oldSubj, caster, d, oldFx } = setup();
    assert.equal(subj.getFlag('sr2e', 'powerEffects')[0].ballistic, 3);
    faces.push(5, 5, 1, 1, ...Array(12).fill(5));                        // 2 successes; drain
    await d.dispel(caster, 0);
    assert.equal(caster.system.sustaining[0].successes, 1);
    const fx = subj.getFlag('sr2e', 'powerEffects');
    assert.equal(fx.length, 1);
    assert.equal(fx[0].successes, 1);
    assert.equal(fx[0].ballistic, 1);
    assert.deepEqual(oldSubj.getFlag('sr2e', 'powerEffects'), [oldFx]);
    assert.ok(chat.some((m) => /predates v0\.71\.0/.test(m.content) && /Old subject/.test(m.content)));
  });

  test('switched off: the effect keeps its size', async (t) => {
    // v0.92.3: 'the book' here is the v0.92.2 reading (RULES.SORCERY_V923 at its old way); the book's way is in v0923-sorcery.test.ts.
    t.after(oldWay(SORCERY_V922));
    const { subj, caster, d } = setup();
    faces.push(5, 5, 1, 1, ...Array(12).fill(5));
    await withRule(RULES.FIXES_V71, 'dispelShrinks', false, () => d.dispel(caster, 0));
    assert.equal(caster.system.sustaining[0].successes, 1);
    assert.equal(subj.getFlag('sr2e', 'powerEffects')[0].successes, 3);
  });
});

describe('R12 invisibility before spells and powers', () => {
  const power = { name: 'Fear', system: { active: true, dice: 'force', rating: 4, tnSource: 'willpower', targetNumber: 4, resist: 'willpower', effect: 'damage', damageLevel: 'M', damageType: 'stun' } };
  const invisible = () => who({ name: 'Ghost', magic: 6, tradition: 'hermetic', sustaining: [{ spellName: 'Invisibility', force: 4, category: 'illusion', focusId: '', successes: 3, quickened: false }] });

  test('spellPreview lists an invisible target the caster hasn\'t seen through as unseen', () => {
    const t = invisible();
    const caster = who({ name: 'Mage', magic: 6, tradition: 'hermetic' });
    assert.equal(t.concealmentFor(caster)[0]?.kind, 'invisibility');
    const spell = { name: 'Stunbolt', system: { category: 'combat', spellType: 'mana', targetNumber: 4 } };
    assert.deepEqual(caster.spellPreview(spell, { targetUuids: [t.uuid] }).unseen, ['Ghost']);
  });

  test("a critter power at an unseen invisible target is refused with lineOfSight 'block'", async () => {
    const t = invisible();
    const critter = who({ name: 'Hellhound', type: 'npc' });
    faces.push(1, 1, 1, 1, 1);                                           // Intelligence 5 vs the spell: not seen through
    await withRule(RULES.TN_AUTO.magic, 'lineOfSight', 'block', async () => {
      assert.equal(await critter.usePower(power, { targetUuid: t.uuid }), null);
    });
    assert.match(warnings.at(-1) ?? '', /no line of sight to Ghost/);
  });

  test('spotInvisible: an owner resists; a non-owner or a vehicle does nothing', async () => {
    const t = invisible();
    const owner = who({ name: 'Watcher' });
    faces.push(5, 5, 5, 5, 5);
    await owner.spotInvisible([t]);
    assert.equal(faces.length, 0);
    assert.ok(Object.values(owner.getFlag('sr2e', 'seenThrough') ?? {}).length === 1);
    const stranger = who({ name: 'Stranger' });
    stranger.isOwner = false;
    const before = chat.length;
    await stranger.spotInvisible([t]);
    assert.equal(chat.length, before);
    assert.equal(stranger.getFlag('sr2e', 'seenThrough'), undefined);
    await vehicle().spotInvisible([t]);
    assert.equal(chat.length, before);
    await withRule(RULES.FIXES_V71, 'invisibilityEverywhere', false, () => who({ name: 'Off' }).spotInvisible([t]));
    assert.equal(chat.length, before);
  });
});

describe('R13 holds and berserk', () => {
  test('movementHold: held in a grapple, bound by a binding power; nothing with the switch off', async () => {
    const holder = who({ name: 'Troll' });
    const a = who({ name: 'Held' });
    assert.equal(a.movementHold(), '');
    a.flags.sr2e = { heldBy: holder.uuid };
    assert.equal(a.movementHold(), 'held by Troll');
    const b = who({ name: 'Bound' });
    b.flags.sr2e = { powerEffects: [{ id: 'b1', special: 'binding', name: 'Binding', fromName: 'Spirit', fromUuid: '', attributes: {} }] };
    assert.equal(b.movementHold(), 'bound by Binding (Spirit)');
    await withRule(RULES.FIXES_V71, 'holds', false, () => { assert.equal(a.movementHold(), ''); assert.equal(b.movementHold(), ''); });
  });

  test('releaseHolds: by holder, and among the uuids of an ended combat', async () => {
    const h1 = who({ name: 'H1' }), h2 = who({ name: 'H2' });
    const v1 = who({ name: 'V1' }), v2 = who({ name: 'V2' }), free = who({ name: 'Free' });
    await SR2Actor.setHeld(v1, h1.uuid, true);
    await SR2Actor.setHeld(v2, h2.uuid, true);
    g.game.actors = [h1, h2, v1, v2, free];
    assert.equal(await SR2Actor.releaseHolds({ holderUuid: h1.uuid }), 1);
    assert.equal(v1.getFlag('sr2e', 'heldBy'), undefined);
    assert.equal(v2.getFlag('sr2e', 'heldBy'), h2.uuid);
    assert.match(chat.at(-1).content, /V1<\/strong> is free: H1 can no longer hold on/);
    assert.equal(await SR2Actor.releaseHolds({ uuids: [free.uuid] }), 0);
    assert.equal(await SR2Actor.releaseHolds({ uuids: [h2.uuid] }), 1);
    assert.equal(v2.getFlag('sr2e', 'heldBy'), undefined);
    assert.match(chat.at(-1).content, /the fight is over/);
    await SR2Actor.setHeld(v1, h1.uuid, true);
    await withRule(RULES.FIXES_V71, 'holds', false, async () => { assert.equal(await SR2Actor.releaseHolds({ holderUuid: h1.uuid }), 0); });
    assert.equal(v1.getFlag('sr2e', 'heldBy'), h1.uuid);
  });

  test('berserk refuses castSpell (and summoning); other actions still go', async () => {
    const a = who({ name: 'Shaman', magic: 6, tradition: 'shamanic' });
    a.statuses.add('sr2eBerserk');
    assert.equal(a.canAct('castSpell'), false);
    assert.match(warnings.at(-1) ?? '', /berserk/);
    assert.equal(a.canAct('conjure'), false);
    assert.equal(a.canAct('attack'), true);
    await withRule(RULES.FIXES_V71, 'holds', false, () => { assert.equal(a.canAct('castSpell'), true); });
  });
});

describe('R14 the your-turn helper knows every button that costs an action', () => {
  test('buttonCost', () => {
    const c = RULES.ACTIONS.costs;
    assert.equal(buttonCost('matrixPerceive'), c['matrix:simple']);
    assert.equal(buttonCost('useUtility'), c['matrix:complex']);
    assert.equal(buttonCost('sneak'), c.perceive);
    assert.equal(buttonCost('sensorTest'), c.sensor);
    assert.equal(buttonCost('ramVehicle'), c.drive);
    assert.equal(buttonCost('pushSpeed'), c.drive);
    assert.deepEqual(['matrixPerceive', 'useUtility', 'sneak', 'sensorTest', 'ramVehicle', 'pushSpeed'].map((b) => buttonCost(b)),
      ['simple', 'complex', 'simple', 'complex', 'complex', 'complex']); // v0.92.3: a sensor test is Complex (Rigger 2 p. 58)
  });
});

describe('R15 one initiative formula for the combatant and the strip', () => {
  test('a plain character with wounds: Reaction + dice − the wound penalty; the combatant rolls the same', () => {
    const a = who({ monitor: { physical: 3, stun: 0 } });
    const d = a.system.derived;
    const f = initiativeFormula(a);
    assert.deepEqual(f, { dice: d.initiativeDice, base: d.reaction, minus: initiativeWoundPenalty(d.woundModifier), label: '' });
    assert.ok(f.minus > 0);
    const c = new SR2Combatant();
    c.actor = a;
    assert.equal(c.getInitiativeRoll().formula, `${f.dice}d6 + ${f.base} - ${f.minus}`);
  });

  test('a jacked-in decker, a projecting magician, a spirit\'s bonus', () => {
    const decker = { type: 'character', system: { derived: { initiativeDice: 1, reaction: 5, woundModifier: 1, matrix: { jackedIn: true, initiativeDice: 3, reaction: 10 } } } };
    assert.deepEqual(initiativeFormula(decker), { dice: 3, base: 10, minus: initiativeWoundPenalty(1), label: 'Matrix' });
    const mage = { type: 'character', system: { derived: { initiativeDice: 1, reaction: 5, woundModifier: 2, astralMode: 'projecting', astral: { initiativeDice: 2, initiativeBase: 25 } } } };
    // v0.72.0 (O20): a projecting magician's wounds lower Initiative too (MAGIC_V72.astralWounds 'both').
    assert.deepEqual(initiativeFormula(mage), { dice: 2, base: 25, minus: initiativeWoundPenalty(2), label: 'astral' });
    const sp = { type: 'spirit', system: { derived: { initiativeDice: 1, reaction: 5, initiativeBonus: 10, woundModifier: 0 } } };
    assert.deepEqual(initiativeFormula(sp), { dice: 1, base: 15, minus: 0, label: '' });
  });

  test('a jumped-in vehicle takes its rigger\'s rigged speed and wounds; an autopilot its own', () => {
    const rig = { system: { derived: { woundModifier: 1, rigging: { jumpedIn: true, initiativeDice: 3, reaction: 9 } } } };
    const v = { type: 'vehicle', system: { controlMode: 'jumped', derived: { initiativeDice: 1, reaction: 4 } }, controller: () => rig };
    assert.deepEqual(initiativeFormula(v), { dice: 3, base: 9, minus: initiativeWoundPenalty(1), label: 'rigged' });
    const auto = { type: 'vehicle', system: { controlMode: 'autopilot', derived: { initiativeDice: 1, reaction: 4 } }, controller: () => null };
    assert.deepEqual(initiativeFormula(auto), { dice: 1, base: 4, minus: 0, label: 'autopilot' });
  });

  test('IC: its rating (or its host\'s value) + dice by the security code', () => {
    const host = { uuid: 'Actor.v71host', system: { securityValue: 6, securityCode: 'red' } };
    uuidRegistry.set(host.uuid, host);
    const ic = { type: 'ic', system: { rating: 5, hostUuid: host.uuid, initiativeDice: 0 } };
    const ii = icInitiative({ rating: 5, securityValue: 6, code: 'red', ownDice: 0 });
    assert.deepEqual(initiativeFormula(ic), { dice: ii.dice, base: ii.base, minus: 0, label: 'IC' });
  });
});

describe('R17 rigger adaptation', () => {
  test('a drone counts as adapted; a car only with the modification', () => {
    assert.equal(vehicle({ drone: true }).system.derived.adaptation, true);
    assert.equal(vehicle().system.derived.adaptation, false);
    assert.equal(vehicle({ mods: adapted }).system.derived.adaptation, true);
    assert.equal(vehicle({ mods: [{ ...adapted[0], installed: false }] }).system.derived.adaptation, false);
  });

  test('jumping into a car without it is refused by default; manual driving is not', async () => {
    assert.equal(RULES.RIGGING.needsAdaptation, true);
    const v = vehicle();
    const a = rigger(2);
    v.system.occupants.push(a.uuid);
    assert.equal(await a.takeControl(v, 'jumped'), false);
    assert.match(warnings.at(-1) ?? '', /no rigger adaptation/);
    assert.equal(a.system.rigging.jumpedIn, false);
    assert.equal(await a.takeControl(v, 'manual'), true);
    await withRule(RULES.RIGGING, 'needsAdaptation', false, async () => { assert.equal(await a.takeControl(v, 'jumped'), true); });
    assert.equal(a.system.rigging.jumpedIn, true);
  });
});

describe('R18 vehicle repair', () => {
  useV922Vehicles(); // v0.92.3: these pin the v0.92.2 vehicle rules
  const plan = (o: any) => vehicleRepairPlan({ successes: 0, condition: 0, systems: {}, destroyed: false, boxesPerSuccess: 1, hoursPerBox: 1, partsFirst: true, rebuild: true, rebuildFactor: 2, ...o });

  test('vehicleRepairPlan: parts first, then boxes; boxes first; a rebuild', () => {
    assert.deepEqual(plan({ successes: 2, condition: 3, systems: { tires: true, engine: true } }), { boxes: 0, parts: ['tires', 'engine'], rebuild: false, hours: 2 });
    assert.deepEqual(plan({ successes: 3, condition: 3, systems: { tires: true, engine: true } }), { boxes: 1, parts: ['tires', 'engine'], rebuild: false, hours: 3 });
    assert.deepEqual(plan({ successes: 2, condition: 3, systems: { tires: true }, partsFirst: false }), { boxes: 2, parts: [], rebuild: false, hours: 2 });
    assert.deepEqual(plan({ successes: 9, condition: 2, systems: {} }), { boxes: 2, parts: [], rebuild: false, hours: 2 });
    assert.deepEqual(plan({ successes: 1, condition: 10, systems: { tires: true }, destroyed: true }), { boxes: 10, parts: ['tires'], rebuild: true, hours: 22 });
    assert.deepEqual(plan({ successes: 0, condition: 10, destroyed: true }), { boxes: 0, parts: [], rebuild: false, hours: 0 });
    assert.equal(plan({ successes: 1, condition: 10, destroyed: true, rebuild: false }).rebuild, false);
  });

  const mechanic = () => who({ name: 'Mechanic' }, [skill('br', 'Car B/R', 4, 'intelligence')]);
  const easier = [{ label: 'Easy job', value: -4 }];

  test('no tools: + the no-tools TN; the success fixes the shot-out tires first, then a box', async (t) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    t.after(oldWay({ 'CHARACTERS_V58.tools.none': 'tn' }));
    t.after(oldWay({ 'DOCS_V79.vehRepair.mode': 'perSuccess' })); // v0.79.0: the old rule (a house rule)
    const m = mechanic();
    const v = vehicle({ condition: 2, systems: { tires: true, engine: false, sensors: false } });
    faces.push(5, 5, 1, 1);
    const r = await m.repairVehicleTest(v, { modifiers: easier });
    assert.deepEqual(r, { repaired: 1 });
    assert.match(chat.at(-1).content, /No tools/);
    assert.equal(v.system.systems.tires, false);
    assert.equal(v.system.condition, 1);
  });

  test("CHARACTERS_V58.tools.none 'block': refused without tools", async () => {
    const m = mechanic();
    const v = vehicle({ condition: 2 });
    await withRule(RULES.CHARACTERS_V58.tools, 'none', 'block', async () => { assert.equal(await m.repairVehicleTest(v), null); });
    assert.match(warnings.at(-1) ?? '', /can't repair Americar/);
    assert.equal(faces.length, 0);
  });

  test('a destroyed vehicle needs a success to start a rebuild; then everything is fixed', async (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CHARACTERS_V58.tools.none': 'tn' }));
    const m = mechanic();
    const v = vehicle({ condition: RULES.VEHICLES.conditionBoxes, systems: { tires: true, engine: true, sensors: false } });
    assert.equal(v.system.derived.destroyed, true);
    faces.push(2, 2, 2, 2);
    assert.deepEqual(await m.repairVehicleTest(v, { modifiers: easier }), { repaired: 0 });
    assert.match(chat.at(-1).content, /needs a rebuild/);
    assert.equal(v.system.condition, RULES.VEHICLES.conditionBoxes);
    faces.push(5, 2, 2, 2);
    await m.repairVehicleTest(v, { modifiers: easier });
    assert.match(chat.at(-1).content, /A full rebuild/);
    assert.equal(v.system.condition, 0);
    assert.deepEqual({ ...v.system.systems }, { tires: false, engine: false, sensors: false });
  });

  test('switched off: the old box-by-box repair, no tools TN', async (t) => {
    t.after(oldWay({ 'DOCS_V79.vehRepair.mode': 'perSuccess' })); // v0.79.0: the old rule (a house rule)
    const m = mechanic();
    const v = vehicle({ condition: 3, systems: { tires: true, engine: false, sensors: false } });
    faces.push(5, 5, 1, 1);
    await withRule(RULES.FIXES_V71.vehicleRepair, 'enabled', false, () => m.repairVehicleTest(v, { modifiers: easier }));
    assert.doesNotMatch(chat.at(-1).content, /No tools/);
    assert.equal(v.system.condition, 1);
    assert.equal(v.system.systems.tires, true);
  });
});

describe('R19 switching to the astral costs an action', () => {
  const mage = () => {
    const a = who({ name: 'Mage', magic: 6, tradition: 'hermetic' });
    const asked: string[] = [];
    let answer = true;
    a.useAction = async (k: string) => { asked.push(k); return answer; };
    return { a, asked, refuse: () => { answer = false; } };
  };

  test('perceiving and projecting call useAction; back to physical is free', async () => {
    const { a, asked } = mage();
    await a.onAstralModeChange('physical', 'perceiving');
    await a.onAstralModeChange('perceiving', 'projecting');
    await a.onAstralModeChange('projecting', 'physical');
    assert.deepEqual(asked, ['astralPerceive', 'astralProject']);
    await a.onAstralModeChange('physical', 'perceiving', { noAction: true });
    await withRule(RULES.FIXES_V71, 'astralSwitchCost', false, () => a.onAstralModeChange('physical', 'perceiving'));
    assert.deepEqual(asked, ['astralPerceive', 'astralProject']);
  });

  test('a refused action puts the switch back', async () => {
    const { a, asked, refuse } = mage();
    refuse();
    a.system.astral = 'projecting';
    await a.onAstralModeChange('physical', 'projecting');
    assert.deepEqual(asked, ['astralProject']);
    assert.equal(a.system.astral, 'physical');
    assert.equal(a.getFlag('sr2e', 'projectionStart'), undefined);
  });
});

describe('R20 a timed elemental summoning drains when it ends', () => {
  const mage = () => who({ name: 'Mage', magic: 6, tradition: 'hermetic' }, [skill('conj', 'Conjuring', 5, 'charisma')], { ...A, charisma: 6 });
  const waiting = <T>(fn: () => Promise<T>) => withRule(RULES.WAITING, 'enabled', true, fn);

  test('no drain at once; the project\'s finishElemental carries it; finishElemental rolls it', async () => {
    const a = mage();
    await waiting(async () => {
      faces.push(5, 5, 1, 1, 1);                                         // Conjuring 5 vs TN 3: 2 successes
      await a.conjure({ force: 3, spiritKind: 'elemental', spiritType: 'Fire elemental' });
    });
    assert.equal(faces.length, 0);
    assert.ok(!chat.some((m) => /Conjuring drain/.test(m.content)), 'no drain yet');
    const p = a.projects().find((x: any) => x.kind === 'elemental');
    assert.ok(p, 'a project under way');
    const args = p.effect.call.args;
    assert.equal(p.effect.call.method, 'finishElemental');
    assert.deepEqual(args[1], { force: 3, pool: 0 });
    assert.equal(args[0].system.services, 2);
    faces.push(5, 5, 5, 5, 5, 5);
    assert.equal(await a.finishElemental(args[0], args[1]), true);
    assert.equal(created.length, 1);
    assert.ok(chat.some((m) => /Conjuring drain/.test(m.content)));
  });

  test('a failed summoning drains at once', async () => {
    const a = mage();
    await waiting(async () => {
      faces.push(2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5);
      await a.conjure({ force: 3, spiritKind: 'elemental', spiritType: 'Fire elemental' });
    });
    assert.equal(a.projects().length, 0);
    assert.ok(chat.some((m) => /no spirit answers/.test(m.content)));
    assert.ok(chat.some((m) => /Conjuring drain/.test(m.content)));
  });

  test('switched off: the drain comes at once even when the summoning takes its hours', async () => {
    const a = mage();
    await withRule(RULES.FIXES_V71, 'conjureDrainAtEnd', false, () => waiting(async () => {
      faces.push(5, 5, 1, 1, 1, 5, 5, 5, 5, 5, 5);
      await a.conjure({ force: 3, spiritKind: 'elemental', spiritType: 'Fire elemental' });
    }));
    assert.ok(chat.some((m) => /Conjuring drain/.test(m.content)));
    const p = a.projects().find((x: any) => x.kind === 'elemental');
    assert.equal(p.effect.call.args.length, 1);
  });
});

describe('v0.71.0 review fixes', () => {
  const dealer = () => who({ name: 'Face', karma: { pool: 3, poolSpent: 0, good: 10, career: 10 } }, [skill('neg', 'Negotiation', 4, 'charisma'), skill('eti', 'Etiquette', 3, 'charisma')]);

  test('F1: Karma refused on a card whose deal is closed (bought, sold or haggled); the GM TN change keeps it closed', async () => {
    const a = dealer();
    faces.push(5, 1, 1, 1, 2, 2, 2, 2);
    await a.haggle({ itemId: 'x', price: 1000, name: 'Gun' });
    const card = chat.at(-1);
    card.flags.sr2e.bought = true;
    g.game.messages = { contents: [card] };
    assert.equal(await SR2Actor.contestKarma(card, 0, 'reroll'), null);
    assert.match(warnings.at(-1) ?? '', /Already paid for/);
    assert.equal(a.system.karma.poolSpent, 0);
    assert.equal(SR2Actor.dealDone({ getFlag: (_s: string, k: string) => (k === 'sold' ? true : undefined) }), 'Already sold');
  });

  test('F7: a Karma re-roll keeps a success bought before it', async () => {
    const a = dealer();
    faces.push(5, 1, 1, 1, 2, 2, 2, 2);
    await a.haggle({ itemId: 'x', price: 1000, name: 'Gun' });
    const first = chat.at(-1);
    g.game.messages = { contents: [first] };
    const bought = await SR2Actor.contestKarma(first, 0, 'buy');
    assert.equal(bought.flags.sr2e.contest.sides[0].result.successes, 2);
    g.game.messages = { contents: [first, bought] };
    faces.push(1, 1, 1);
    const rr = await SR2Actor.contestKarma(bought, 0, 'reroll');
    assert.equal(rr.flags.sr2e.contest.sides[0].result.successes, 2, 'the die kept + the bought one');
  });

  test('F5: giving up a timed summoning still rolls its drain (onCancel giveUpElemental)', async () => {
    const a = who({ name: 'Mage', magic: 6, tradition: 'hermetic' }, [skill('conj', 'Conjuring', 5, 'charisma')], { ...A, charisma: 6 });
    await withRule(RULES.WAITING, 'enabled', true, async () => {
      faces.push(5, 5, 1, 1, 1);
      await a.conjure({ force: 3, spiritKind: 'elemental', spiritType: 'Fire elemental' });
      const p = a.projects().find((x: any) => x.kind === 'elemental');
      assert.equal(p.onCancel.call.method, 'giveUpElemental');
      faces.push(5, 5, 5, 5, 5, 5);
      await a.cancelProject(p.id);
    });
    assert.equal(a.projects().length, 0);
    assert.ok(chat.some((m) => /Conjuring drain/.test(m.content)));
  });

});
