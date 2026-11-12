/**
 * v0.81.0 fixer FX-DOC: documents/index.ts. One test (or more) per fix: the review findings D1, D2, D3 and the method
 * side of the security audit SEC1/SEC2 (RV/D1.md, D2.md, D3.md, SEC1.md, SEC2.md). Each failed on v0.81.0 before the
 * fix. The harness is the v0.71.0 glue stubs (scripted dice, a chat log of messages with getFlag).
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';

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

let CharacterDataModel: any, VehicleDataModel: any, SR2Actor: any;

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
  ({ SR2Actor } = await import('../documents/index.ts'));
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
  a.uuid = `Actor.d81-${++n}`; a.id = `id${n}`;
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
  Object.assign(v, { type: 'vehicle', name: extra.name ?? 'Americar', uuid: `Actor.d81veh-${++n}`, system: sys, items: withGet([]), statuses: new Set<string>() });
  sys.parent = v;
  uuidRegistry.set(v.uuid, v);
  return v;
}

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

const PLAYER = () => ({ id: 'p1', name: 'Player', isGM: false, can: () => true });
/** Owners for the trust checks: `who`'s actors have no testUserPermission of their own. */
const ownedBy = (a: any, ...ids: string[]) => { a.testUserPermission = (u: any) => Boolean(u?.isGM) || ids.includes(u?.id); return a; };

describe('SEC1-1 applyActorUpdate: typed changes on actors only', () => {
  test('a free-form update is refused, on a User or anything else', async () => {
    const user: any = { role: 1, documentName: 'User', async update(d: any) { Object.assign(this, d); } };
    uuidRegistry.set('User.p1', user);
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: 'User.p1', update: { role: 4 } }), false);
    assert.equal(user.role, 1);
    const a = who({ name: 'Boss' });
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: a.uuid, update: { 'system.nuyen': 5 } }), false);
    // A typed change on a non-actor document is refused too.
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: 'User.p1', monitor: { track: 'physical', boxes: 2 } }), false);
  });

  test('monitor and nuyen are bounded (SEC2-8): no NaN, no Infinity, no 1e9', async () => {
    const a = who({ name: 'Boss', nuyen: 10 });
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: a.uuid, monitor: { track: 'stun', boxes: 1e9 } }), true);
    assert.equal(a.system.monitor.stun, RULES.MONITOR_BOXES);
    await SR2Actor.applyActorUpdate({ uuid: a.uuid, monitor: { track: 'physical', boxes: NaN } });
    assert.equal(a.system.monitor.physical, 0);
    await SR2Actor.applyActorUpdate({ uuid: a.uuid, nuyen: { amount: Infinity, label: 'x' } });
    assert.equal(a.system.nuyen, 10);
    await SR2Actor.applyActorUpdate({ uuid: a.uuid, nuyen: { amount: 1e12, label: 'x' } });
    assert.equal(a.system.nuyen, 1_000_010);
  });

  test('from a card, the author must own the actor the change comes from (`by`)', async () => {
    const boss = who({ name: 'Boss', nuyen: 0 });
    const mine = ownedBy(who({ name: 'Mine' }), 'p1');
    const author = PLAYER();
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: boss.uuid, nuyen: { amount: 500, label: 'x' } }, { author }), false);
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: boss.uuid, nuyen: { amount: 500, label: 'x' }, by: ownedBy(who({ name: 'Other' }), 'p2').uuid }, { author }), false);
    assert.equal(boss.system.nuyen, 0);
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: boss.uuid, nuyen: { amount: 500, label: 'x' }, by: mine.uuid }, { author }), true);
    assert.equal(boss.system.nuyen, 500);
    // An object from data that only says it is a GM is not a user (no `game.users.get` match).
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: true }, get(id: string) { return (this as unknown as any[]).find((u: any) => u.id === id); } });
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: boss.uuid, nuyen: { amount: 500, label: 'x' } }, { author: { id: 'gm1', isGM: true } }), false);
  });

  test("a spirit goes free only when its master is really dead", async () => {
    const master = who({ name: 'Master' });
    const sp = who({ name: 'Spirit', type: 'spirit', spiritKind: 'ally', summonerUuid: master.uuid, services: 2 });
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: sp.uuid, masterDied: true }), false);
    assert.equal(sp.system.summonerUuid, master.uuid);
  });
});

describe('SEC1-2 a project flag never runs privileged calls on what its players do not own', () => {
  const forged = (id: string, method: string, args: any[]) => ({ id, kind: 'learn', area: 'magic', label: 'x', startedAt: 0, readyAt: 0, hours: 0, paid: { karma: 0, nuyen: 0 }, effect: { call: { method, args } } });

  test("created actors are forced to their type and the project actor's owners; a refund to someone else's actor waits for the GM", async () => {
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: true } });
    const mine = ownedBy(who({ name: 'Player PC' }), 'p1');
    mine.ownership = { default: 0, p1: 3 };
    const victim = ownedBy(who({ name: 'Other PC', nuyen: 5 }), 'p2');
    mine.flags.sr2e = { projects: {
      a: forged('a', 'finishWard', [{ name: 'Loot', type: 'character', ownership: { default: 3 }, system: { nuyen: 999999, rating: 99 }, items: [{ name: 'Gun', type: 'weapon' }] }, 'w']),
      b: forged('b', 'refundModPayer', [victim.uuid, 1000000, 'x']),
      c: forged('c', 'finishAlly', [{ name: 'Ally', type: 'npc', ownership: { default: 3 }, system: { force: 99, summonerUuid: victim.uuid } }]),
      d: { ...forged('d', 'x', []), effect: { actor: [['ownership.default', 3], ['system.karma.good', 1]] } },
    } };
    g.game.actors = [mine, victim];
    await SR2Actor.timedEffects({ worldTime: 10 });
    const ward = created.find((d) => d.name === 'Loot');
    assert.equal(ward.type, 'barrier');
    assert.equal(ward.ownership, undefined);
    assert.equal(ward.items, undefined);
    assert.equal(ward.system.rating, 30);
    const ally = created.find((d) => d.name === 'Ally');
    assert.equal(ally.type, 'spirit');
    assert.deepEqual(ally.ownership, { default: 0, p1: 3 });
    assert.equal(ally.system.summonerUuid, mine.uuid);
    assert.equal(ally.system.force, 30);
    assert.equal(victim.system.nuyen, 5, 'no refund straight to an actor the project actor\'s players do not own');
    // v0.81.1 (D3-6): on the GM's clock that refund is refused outright (a GM-authored card would skip the confirm).
    assert.ok(!chat.some((m) => m.flags?.sr2e?.actorUpdate?.nuyen), 'no GM-authored refund card either');
    assert.equal(mine.ownership.default, 0);
    assert.equal(mine.system.karma.good, 1);
  });
});

describe('SEC1-6 buying and selling re-derive the price', () => {
  const shop = () => who({ name: 'Buyer', nuyen: 1000 }, [{ id: 'g1', type: 'gear', name: 'Medkit', system: { cost: 100, streetIndex: 1, quantity: 1 } }]);

  test('a negative or huge price from a card is moved back to what haggling allows', async () => {
    const a = shop();
    assert.equal(await a.buyItem('g1', -50000, 0, 1), true);
    assert.equal(a.system.nuyen, 1000 - 75, 'at least the best haggled price (25% off)');
    const b = shop();
    assert.equal(await b.buyItem('g1', 999999, 0, 1), true);
    assert.equal(b.system.nuyen, 1000 - 125, 'at most the worst haggled price (25% on)');
    const c = shop();
    assert.equal(await c.buyItem('nothing', 10, 0, 1), false);
    assert.equal(c.system.nuyen, 1000);
  });

  test('a sale never pays more than a fence could', async () => {
    const a = who({ name: 'Seller', nuyen: 0 }, [{ id: 'w', type: 'weapon', name: 'Gun', system: { cost: 1000, streetIndex: 1 } }]);
    a.items[0].delete = async () => { a.items.splice(0, 1); };
    assert.equal(await a.sellItem('w', 1e9, 0), true);
    assert.equal(a.system.nuyen, 1000 * RULES.STREET.fence.maxPercent / 100);
  });
});

describe('SEC1-11 / D3-6 jams', () => {
  test("a card's jam needs a jammer its author owns", async () => {
    const d = who({ name: 'Decker', matrix: { jackedIn: true, hostUuid: '', connection: 'cellular' } });
    const author = PLAYER();
    assert.equal(await SR2Actor.applyJam(d.uuid, 'nobody', 1, { author }), false);
    assert.equal(d.system.matrix.jackedIn, true);
    const j = ownedBy(who({ name: 'Jammer' }), 'p2');
    j.jammerRating = () => 4;
    assert.equal(await SR2Actor.applyJam(d.uuid, 'Jammer', 4, { author, jammerUuid: j.uuid }), false);
    assert.equal(d.system.matrix.jackedIn, true);
  });

  test('a decker dumped by a jam gets the dump shock card and their hitchers are unplugged', async () => {
    const d = who({ name: 'Decker', matrix: { jackedIn: true, hostUuid: '', connection: 'cellular' } });
    const rider = who({ name: 'Rider', matrix: { ridingWith: d.uuid } });
    g.game.actors = [d, rider];
    await withRule(RULES.RIGGING.jamming, 'onDecker', 'dump', async () => {
      assert.equal(await SR2Actor.applyJam(d.uuid, 'Van', 4), true);
    });
    assert.equal(d.system.matrix.jackedIn, false);
    assert.ok(chat.some((m) => m.flags?.sr2e?.dumpShockFor === d.uuid), 'dump shock card');
    assert.equal(rider.system.matrix.ridingWith, '');
  });
});

describe('SEC1-12 a charge goes off with the Power on record', () => {
  test('storedCharge reads the setter\'s record, bounded; an unknown id is nothing', () => {
    // v0.81.1 (SEC1-16): a record is bounded by the explosive item it names; one with no such item is nothing.
    const a = who({ name: 'Setter' }, [{ id: 'cx', type: 'gear', name: 'C-12', system: { quantity: 0, explosive: { power: 200, perMetre: 1, shaped: false } } }]);
    a.flags.sr2e = { setCharges: [{ id: 'c1', itemId: 'cx', name: 'C-12', power: 999, perMetre: 1, shaped: false }, { id: 'c2', name: 'C-12', power: 999, perMetre: 1, shaped: false }] };
    assert.ok(SR2Actor.storedCharge(a, 'c1')?.power <= 200);
    // Round 3 (V2 #2): a record with no explosive item behind it is refused again (SEC1-16); a GM confirms instead.
    assert.equal(SR2Actor.storedCharge(a, 'c2'), null);
    assert.equal(SR2Actor.storedCharge(a, 'nope'), null);
    assert.equal(SR2Actor.storedCharge(who({ name: 'Victim' }), 'c1'), null);
  });
});

describe('SEC2-8 GM tools validate their numbers', () => {
  test('gmAdjustBoxes: only physical or stun, a finite delta, kept on the track', async () => {
    const a = who({ name: 'Boss' });
    assert.equal(await SR2Actor.gmAdjustBoxes(a.uuid, 'physical', Infinity), false);
    assert.equal(await SR2Actor.gmAdjustBoxes(a.uuid, 'physical', NaN), false);
    assert.equal(a.system.monitor.physical, 0);
    assert.equal(await SR2Actor.gmAdjustBoxes(a.uuid, '__proto__' as any, 2), false);
    await SR2Actor.gmAdjustBoxes(a.uuid, 'stun', 1e9);
    assert.equal(a.system.monitor.stun, RULES.MONITOR_BOXES);
    assert.equal(await SR2Actor.gmAdjustBoxes(a.uuid, 'stun', -2, { author: PLAYER() }), false, 'a player\'s card on an actor they do not own');
  });

  test('gmUndoSoak: a forged snapshot is clamped, and bound to its author', async () => {
    const a = who({ name: 'Boss' });
    assert.equal(await SR2Actor.gmUndoSoak({ actorUuid: a.uuid, label: 'x', soak: { before: { physical: 10, stun: 10 } } } as any, { author: PLAYER() }), false);
    assert.equal(a.system.monitor.physical, 0);
    await SR2Actor.gmUndoSoak({ actorUuid: a.uuid, label: 'x', soak: { before: { physical: 1e9, stun: 3 } } } as any);
    assert.ok(a.system.monitor.physical <= RULES.MONITOR_BOXES + 20);
    assert.equal(await SR2Actor.gmUndoSoak({ actorUuid: a.uuid, label: 'x', soak: { before: { physical: NaN, stun: 0 } } } as any), false);
  });

  test('karmaReroll: a forged snapshot with 100,000 dice rolls nothing', async () => {
    const a = who({ name: 'Roller', karma: { pool: 5, poolSpent: 0, good: 0, career: 0 } });
    const dice = Array.from({ length: 100000 }, () => ({ faces: [1], total: 1, success: false }));
    await a.karmaReroll({ actorUuid: a.uuid, kind: 'plain', label: 'x', rerolls: 0, dice, successes: 0, botch: false, targetNumber: 4, baseTargetNumber: 4, modifiers: [], totalDice: 100000 } as any);
    assert.equal(a.system.karma.poolSpent, 0);
    assert.equal(chat.length, 0);
  });
});

describe('D1 findings (index.ts 1-5800)', () => {
  test('D1-1: a GM TN change that drops an installed operation to no successes harms nobody and keeps it in', async () => {
    const doc = who({ name: 'Doc' }, [{ id: 'bt', type: 'skill', name: 'Biotech', system: { rating: 5, attribute: 'intelligence', kind: 'active', specialization: '', specializationRating: 0 } }]);
    const patient = who({ name: 'Pat' }, [{ id: 'ww', type: 'cyberware', name: 'Wired Reflexes 1', system: { essenceCost: 2, grade: 'alpha', installed: false, attributes: {}, reaction: 2, initiativeDice: 1 } }]);
    faces.push(5, 5, 1, 1, 1);
    await patient.surgery('ww', { surgeon: doc });
    // v0.81.1 (SEC1-1): the card has an author (the GM's here): a retarget re-runs it as them.
    const card = asMessage({ author: GM(), ...chat.at(-1), update: async () => {} });
    assert.equal(patient.items.get('ww').system.installed, true);
    const hurt = patient.system.monitor.physical;
    await SR2Actor.retarget(card, { baseTargetNumber: 6, modifiers: [] });
    assert.equal(chat.at(-1).flags.sr2e.test.successes, 0);
    assert.equal(patient.system.monitor.physical, hurt, 'no complications on top of an earlier success');
    assert.equal(patient.items.get('ww').system.installed, true);
    assert.doesNotMatch(chat.at(-1).content, /Complications/);
  });

  test('D1-2: a broken group that passes a later morale test stays broken until rallied', async (tt) => {
    // v0.92.3: the old (v0.92.2) rule this test pins (RULES.CORE_V923 / book alignment).
    tt.after(oldWay({ 'CORE_V923.morale': 'old' }));
    const npc = who({ name: 'Goon', type: 'npc', professionalRating: 3 });
    await npc.setFlag('sr2e', 'broken', true);
    faces.push(5, 5, 5);
    await npc.moraleTest();
    assert.equal(npc.isBroken(), true);
    assert.match(chat.at(-1).content, /still broken/);
  });

  test("D1-3: a test card's title is escaped once (names can't add markup)", async () => {
    faces.push(5, 5);
    await SR2Actor.gmRoll({ dice: 2, targetNumber: 4, label: '<button data-sr2e-action="resist">Bob & co</button>' });
    const html = chat.at(-1).content;
    assert.doesNotMatch(html, /<button data-sr2e-action/);
    assert.match(html, /<h3>&lt;button data-sr2e-action="resist"&gt;Bob &amp; co&lt;\/button&gt;<\/h3>/);
  });

  test("D1-3: a perception label with a typed 'what' is escaped once, not twice", async () => {
    const a = who({ name: 'Watcher' });
    faces.push(...Array(10).fill(1));
    await a.notice({ what: 'R&D <lab>' });
    assert.match(chat.at(-1).content, /looking: R&amp;D &lt;lab&gt;/);
    assert.doesNotMatch(chat.at(-1).content, /&amp;amp;/);
  });

  test('D1-4: a re-roll that resists an Essence drain gives the Essence back', async () => {
    const caster = who({ name: 'Wendigo' });
    const victim = who({ name: 'Victim', karma: { pool: 3, poolSpent: 0, good: 0, career: 0 } });
    victim.system.essenceShift = -1; victim.system.prepareDerivedData();
    caster.system.essenceShift = 1; caster.system.prepareDerivedData();
    const snap: any = {
      actorUuid: victim.uuid, kind: 'soak', label: 'Resist Essence drain', rerolls: 0, testId: 't1',
      dice: [{ faces: [1], total: 1, success: false }, { faces: [1], total: 1, success: false }, { faces: [5], total: 5, success: true }],
      successes: 1, botch: false, targetNumber: 4, baseTargetNumber: 4, modifiers: [], totalDice: 3, targetNumberClamped: false,
      soak: { mode: 'spell', effectOnly: true, casterSuccesses: 2, spellName: 'Essence Drain', noun: 'damage', level: 'M', type: 'stun', body: 4, before: { physical: 0, stun: 0 },
        essenceDrain: { casterUuid: caster.uuid, moved: true, taken: 1, gained: 1 } },
    };
    faces.push(5, 5);                                                   // both failures now succeed: 3 vs 2, resisted
    await victim.karmaReroll(snap);
    assert.equal(victim.system.essenceShift, 0);
    assert.equal(caster.system.essenceShift, 0);
    assert.equal(chat.at(-1).flags.sr2e.test.soak.essenceDrain.taken, 0);
  });

  test('D1-5: follow-up cards are per call, not instance fields two tests could share', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../documents/index.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /#(physicalBeforeSoak|dumpShockPending|riggerShockPending|hostChangePending|overloadPending|deckDamagePending|siteChangePending|passengerDamagePending)\b/);
  });

  test("D1-6: an unlinked sibling token can't delay on another token's turn", async () => {
    const a = who({ name: 'Grunt A' });
    const b = who({ name: 'Grunt B' });
    b.id = a.id; b.isToken = true;                                      // same base actor, another token
    g.game.combat = { started: true, combatant: { actor: a }, nextTurn: async () => {} };
    assert.equal(await b.delayAction(), false);
    assert.equal(b.getFlag('sr2e', 'delayed'), undefined);
  });

  test('D1-8: an exclusive spell blocks perception and street tests too (blocksAllTests)', async () => {
    const a = who({ name: 'Mage', sustaining: [{ spellName: 'Trance', force: 4, exclusive: true }] });
    await withRule(RULES.MAGIC_V61.exclusive, 'blocksAllTests', true, async () => {
      assert.equal(await a.notice({}), null);
      assert.equal(await a.haggle({ itemId: 'x', price: 100, name: 'Gun' }), null);
    });
    assert.match(warnings.at(-1) ?? '', /no other tests/);
  });

  test("D1-9: a card with another player's button stays public under a private roll mode", async () => {
    const { withRollMode } = await import('../documents/index.ts');
    const saved = g.ChatMessage.applyMode;
    g.ChatMessage.applyMode = (d: any) => ({ ...d, whisper: ['gm1'] });
    settings = { rollPrivacy: {} };
    g.game.settings.get = (s: string, k: string) => (s === 'core' && k === 'messageMode' ? 'gm' : settings[k]);
    try {
      const d = withRollMode({ content: '<button type="button" data-sr2e-action="whipCheck">Whip check</button>' });
      assert.equal(d.whisper, undefined);
      const r = withRollMode({ content: '<button type="button" data-sr2e-action="rejectionTest">Rejection test</button>' });
      assert.equal(r.whisper, undefined);
    } finally { g.ChatMessage.applyMode = saved; g.game.settings.get = (_s: string, k: string) => settings[k]; }
  });

  test('D1-10: a GM TN change of a botched test posts no second disaster card', async () => {
    await withRule(RULES.DISASTERS, 'prompt', true, async () => {
      const a = who({ name: 'Unlucky' });
      faces.push(1, 1, 1, 1);
      await a.rollAttribute('body', { targetNumber: 4 });
      const cards = () => chat.filter((m) => m.flags?.sr2e?.disaster).length;
      assert.equal(cards(), 1);
      await SR2Actor.retarget(asMessage({ author: GM(), ...chat.find((m) => m.flags?.sr2e?.test), update: async () => {} }), { baseTargetNumber: 5, modifiers: [] });
      assert.equal(cards(), 1);
    });
  });
});

describe('D2 findings (index.ts 5800-11600)', () => {
  test('D2-1: a refused release keeps the anchored spell', async () => {
    const a = who({ name: 'Mage', magic: 6, tradition: 'hermetic', monitor: { physical: 0, stun: 10 },
      anchored: [{ spellId: 's1', spellName: 'Stunbolt', force: 4, trigger: 'door opens' }] },
    [{ id: 's1', type: 'spell', name: 'Stunbolt', system: { category: 'combat', spellType: 'mana', force: 6, learnedForce: 6, drainLevel: 'D', drainModifier: 0, range: 'los', duration: 'instant', damageType: 'stun' } }]);
    await withRule(RULES.CONDITIONS, 'blockActions', true, async () => {
      assert.equal(await a.releaseAnchored(0), null);
    });
    assert.equal(a.system.anchored.length, 1);
  });

  test("D2-3: banishing someone else's spirit posts an Apply (GM) card, and the card remembers the Force that is really there", async () => {
    const mage = who({ name: 'Shaman', magic: 6, tradition: 'shamanic' }, [skill('conj', 'Conjuring', 4, 'charisma')], { ...A, charisma: 6 });
    const spirit = who({ name: 'Watcher', type: 'spirit', force: 3, spiritKind: 'nature', services: 1, spiritEnergy: 0 });
    spirit.isOwner = false;
    faces.push(1, 1, 1);                                                // the spirit resists: nothing
    faces.push(...Array(60).fill(5));                                   // the banishing, then the drain
    await mage.banish(spirit);
    const gm = chat.find((m) => m.flags?.sr2e?.actorUpdate?.lower);
    assert.ok(gm, 'a GM card');
    assert.deepEqual(gm.flags.sr2e.actorUpdate.lower, { key: 'force', from: 3, to: 0 });
    assert.equal(gm.flags.sr2e.actorUpdate.by, mage.uuid);
    const card = chat.find((m) => m.flags?.sr2e?.test?.banish);
    assert.equal(card.flags.sr2e.test.banish.forceAfter, 3, 'nothing was written, so the Force is still 3');
    assert.equal(spirit.system.force, 3);
    assert.equal(await SR2Actor.applyActorUpdate(gm.flags.sr2e.actorUpdate), true);
    assert.equal(spirit.system.force, 0);
  });

  test('D2-5: a hazard test takes no background count modifier (it is not magic)', async () => {
    const a = who({ name: 'Hiker' });
    a.backgroundInfo = () => ({ penalty: 3, toxic: true, bonusDice: 0, rating: 3 });
    faces.push(...Array(20).fill(5));
    await withRule(RULES.MAGIC_V39.background, 'toxicAffectsDrain', true, () => a.resistHazard('cold', 'cold'));
    const card = chat.find((m) => m.flags?.sr2e?.test);
    assert.doesNotMatch(card.content, /background count/i);
  });

  test("D2-6: an aspected sorcerer (Revamp) can't project: no action spent, back to physical", async () => {
    const a = who({ name: 'Sorc', magic: 6, tradition: 'sorcerer' });
    const asked: string[] = [];
    a.useAction = async (k: string) => { asked.push(k); return true; };
    await withRule(RULES.URR_V80, 'magAspectedNoAstral', true, async () => {
      a.system.astral = 'projecting';
      await a.onAstralModeChange('physical', 'projecting');
    });
    assert.deepEqual(asked, []);
    assert.equal(a.system.astral, 'physical');
    assert.equal(a.getFlag('sr2e', 'projectionStart'), undefined);
  });

  test('D2-8: radiation past a day of hourly tests says the rest were not rolled', async () => {
    const a = who({ name: 'Stalker' });
    faces.push(...Array(400).fill(5));
    await a.resistHazard('radiation', 4, { hours: 30 });
    assert.ok(chat.some((m) => /6 more hourly radiation tests are not rolled/.test(String(m.content))));
  });

  test('D2-13: a double click on Take dose takes one dose', async () => {
    const a = who({ name: 'User' }, [{ id: 'd1', type: 'gear', name: 'Jazz', system: { quantity: 2, toxin: { kind: 'drug', vector: 'inhalation', power: 4, level: 'L', damageType: 'stun', speed: 'immediate', durationMinutes: 10, bonuses: {} } } }]);
    faces.push(...Array(40).fill(5));
    const [one, two] = await Promise.all([a.takeDrug('d1'), a.takeDrug('d1')]);
    assert.equal(two, false);
    assert.equal(a.items.get('d1').system.quantity, one ? 1 : 2);
  });
});

describe('D3 findings (index.ts 11583-17340)', () => {
  test('D3-3: taking the controls of a destroyed vehicle spends no action', async () => {
    const r = rigger();
    const v = vehicle({ condition: 10 });
    const asked: string[] = [];
    r.useAction = async (k: string) => { asked.push(k); return true; };
    assert.equal(await r.takeControl(v, 'manual'), false);
    assert.deepEqual(asked, []);
  });

  test("D3-9: taking a vehicle from a driver this client can't write is refused before anything is written", async () => {
    const prev = rigger();
    const v = vehicle({ controllerUuid: prev.uuid, controlMode: 'manual' });
    prev.system.rigging.vehicleUuid = v.uuid;
    prev.isOwner = false;
    prev.update = async () => { throw new Error('not the owner'); };
    const me = rigger();
    assert.equal(await v.setController(me, 'manual'), false);
    assert.equal(v.system.controllerUuid, prev.uuid);
    assert.equal(me.system.rigging.vehicleUuid, '');
    assert.match(warnings.at(-1) ?? '', /let go first/);
  });

  test('D3-20: a player can\'t create a complex form by dropping an item', async () => {
    const { SR2Item } = await import('../documents/index.ts');
    const it: any = Object.create(SR2Item.prototype);
    const set: any[] = [];
    it.updateSource = (d: any) => { set.push(d); };
    it.system = {};
    await it._preCreate({ type: 'program', name: 'Form', system: { complexForm: true } }, {}, PLAYER());
    assert.deepEqual(set, [{ 'system.complexForm': false }]);
    set.length = 0;
    await it._preCreate({ type: 'program', name: 'Form', system: { complexForm: true } }, { sr2eComplexForm: true }, PLAYER());
    assert.deepEqual(set, []);
  });

  test("D3-22: a player can't spend a protector's spell defense from outside the fight", async () => {
    const { registerCombatRelay } = await import('../documents/index.ts');
    const { requestGm } = await import('../applications/socket.ts');
    registerCombatRelay();
    const protector = ownedBy(who({ name: 'Mage', spellDefense: 4 }), 'p2');
    const target = ownedBy(who({ name: 'Me' }), 'p1');
    g.game.user = PLAYER();
    g.game.users = Object.assign([GM(), g.game.user], { activeGM: { id: 'p1', isSelf: true } });
    const r = await requestGm('spendSpellDefense', { protectorUuid: protector.uuid, targetUuid: target.uuid, amount: 4 });
    assert.equal(r.ok, false);
    assert.equal(protector.system.spellDefense, 4);
  });
});

describe('D3 findings, more', () => {
  test("D3-7: jamming someone else's drone puts no dump shock button on the card until the GM applies the jam", async () => {
    const r = rigger();
    const d = vehicle({ drone: true, controllerUuid: r.uuid, controlMode: 'jumped' });
    r.system.rigging.vehicleUuid = d.uuid; r.system.rigging.jumpedIn = true;
    d.isOwner = false;
    const jammer = who({ name: 'Van' });
    faces.push(5, 5, 5, 5);
    await withRule(RULES.RIGGING.jamming, 'dumpShock', true, () => jammer.jamTest(d.uuid, { rating: 4 }));
    const card = chat.at(-1);
    assert.ok(card.flags.sr2e.jam, 'an Apply (GM) card');
    assert.equal(card.flags.sr2e.riggerShock, undefined);
    assert.doesNotMatch(card.content, /data-sr2e-action="riggerShock"/);
    // The GM's Apply pushes the rigger out and posts the shock.
    d.isOwner = true;
    await withRule(RULES.RIGGING.jamming, 'dumpShock', true, () => SR2Actor.applyJam(d.uuid, 'Van', 4, { jammerUuid: jammer.uuid }));
    assert.ok(chat.some((m) => m.flags?.sr2e?.riggerShock?.riggerUuid === r.uuid));
  });

  test("D3-10: resetting a site clears the response's combat marker", async () => {
    const s = who({ name: 'Plant', type: 'site', tally: 5, alert: 'active', response: { round: 2, worldTime: -1, arrived: false }, devices: [{ id: 'd1', name: 'Cam', bypassed: true }] });
    s.flags.sr2e = { responseCombat: 'c1' };
    await s.resetSite(true);
    assert.equal(s.flags.sr2e.responseCombat, '');
    assert.equal(s.system.devices[0].bypassed, false);
  });
});
