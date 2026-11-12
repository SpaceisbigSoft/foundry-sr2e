/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: combat), the Foundry glue side: documents/index.ts,
 * models/index.ts and rules/gear.ts as wired by combat-WIRING.md. The pure rules are in rules/__tests__/urr80-combat.test.ts.
 * Every hook is tested the book way (the shipped values) and the Revamp's way. The Revamp here is the combat area's own
 * patch (URR80_PATCH_COMBAT), so the other areas' patches can't move these numbers. The stubs are a copy of
 * v078.test.ts's (scripted dice, a chat log of message objects with getFlag). These check OUR wiring, not that Foundry
 * behaves as the stubs do. The dialogs in applications/chat.ts and sheets.ts (Defend, Attack, reload, shotgun spread,
 * scatter) are covered through their pure functions only.
 */
import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { URR80_PATCH_COMBAT } from '../rules/config80-combat.ts';
import { armorTotal } from '../rules/gear.ts';
import { combat922 } from '../rules/__tests__/combat922.ts';

// v0.92.3: this file's "book" is the v0.92.2 Book Rules (COMBAT_V923 at its old choices, the moved defaults put back);
// the book alignment is tested in v0923-combat.test.ts.
let undo922: () => void = () => {};
before(() => { undo922 = combat922(); });
after(() => undo922());

const g = globalThis as any;
const faces: number[] = [];
const chat: any[] = [];
const warnings: string[] = [];
const uuidRegistry = new Map<string, any>();
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

let CharacterDataModel: any, SR2Actor: any, SR2Combat: any;
const GM = () => ({ id: 'gm1', name: 'GM', isGM: true, can: () => true });
const asMessage = (d: any) => ({ id: `m${++mid}`, timestamp: mid, ...d, getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; }, async setFlag(s: string, k: string, v: any) { ((this.flags ??= {})[s] ??= {})[k] = v; } });

/** The combat area's Revamp values only (a copy, so the tables aren't shared). */
const combatMode = () => oldWay(Object.fromEntries(Object.entries(URR80_PATCH_COMBAT).map(([k, v]) => [k, structuredClone(v)])));

before(async () => {
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
      randomID: () => Math.random().toString(36).slice(2, 12), deepClone: (o: any) => JSON.parse(JSON.stringify(o)),
      getProperty: (o: any, p: string) => p.split('.').reduce((x: any, k: string) => x?.[k], o),
      setProperty: (o: any, p: string, v: unknown) => { setPath(o, p, v); return true; },
    },
    applications: { api: { DialogV2: { confirm: async () => false, prompt: async () => null, wait: async () => null } } },
  };
  g.Roll = StubRoll;
  g.ChatMessage = { create: async (d: any) => { const m = asMessage(d); chat.push(m); return m; }, getSpeaker: () => ({}) };
  g.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
  g.game = {
    i18n: { localize: (k: string) => k }, user: GM(), users: Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } }),
    time: { worldTime: 0 }, settings: { get: () => undefined, set: async () => {}, register: () => {} },
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
  g.Item = class {};
  g.Combatant = class { actor: any; };
  g.Combat = class { combatants: any[] = []; flags: any = {}; getFlag(_s: string, k: string) { return this.flags[k]; } async setFlag(_s: string, k: string, v: any) { this.flags[k] = v; } };
  ({ CharacterDataModel } = await import('../models/index.ts'));
  ({ SR2Actor, SR2Combat } = await import('../documents/index.ts'));
  g.CONFIG = { Actor: { documentClass: SR2Actor } };
});

beforeEach(() => {
  faces.length = 0; chat.length = 0; warnings.length = 0;
  g.game.user = GM();
  delete g.game.combat;
});

const A = { body: 4, quickness: 5, strength: 4, charisma: 4, intelligence: 5, willpower: 5 };
const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
let n = 0;

function who(extra: any = {}, items: any[] = [], attrs: Record<string, number> = A): any {
  const sys = Object.create(CharacterDataModel.prototype);
  sys.attributes = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, { base: v, mod: 0 }]));
  const { name, type, ...rest } = extra;
  Object.assign(sys, {
    essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 30, career: 30 }, metamagic: {}, initiateGrade: 0,
    nuyen: 0, sustaining: [], drugs: [], geasa: [], ledger: [], recovering: [], diseases: [], care: { stabilised: false, dyingSince: -1 }, contacts: [],
    addictions: [], anchored: [], qualities: [], lifestyle: { level: 'low', paidUntil: -1, outright: false }, training: [], metatype: 'human', racialModifiers: true,
    poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, monitor: { physical: 0, stun: 0 }, rigging: { vehicleUuid: '', jumpedIn: false, subscribed: [] }, ...rest,
  });
  const a = new SR2Actor();
  a.system = sys;
  a.name = name ?? 'Runner'; a.type = type ?? 'character';
  a.uuid = `Actor.v80c-${++n}`; a.id = `id${n}`;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.toggleStatusEffect = async (id: string, o: any) => { if (o?.active === false) a.statuses.delete(id); else a.statuses.add(id); };
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness') => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0 } });
const shot = (def: any, over: any = {}) => ({ attackerUuid: 'Actor.nobody', targetUuid: def.uuid, weaponName: 'Predator', melee: false,
  damageType: 'physical', power: 4, level: 'M', attackSuccesses: 1, targetNumber: 5, ...over });
const katana = (def: any, over: any = {}) => ({ attackerUuid: 'Actor.nobody', targetUuid: def.uuid, weaponName: 'Katana', melee: true,
  damageType: 'physical', power: 6, level: 'M', attackSuccesses: 3, targetNumber: 4, reach: 1, ...over });

describe('v0.80.0 combat: the ranged defense flow (URR_V80.cbtDefense)', () => {
  test('book: a dodge card stages the hit by net successes', async () => {
    const def = who();
    await def.defend(shot(def, { attackSuccesses: 4 }), 0);
    assert.match(chat.at(-1).content, /Hit!/);
    assert.equal(chat.at(-1).flags.sr2e.damage.level, 'S');
    assert.equal(chat.at(-1).flags.sr2e.damage.cleanMiss80, undefined);
  });

  test('Revamp: no dodge card; the pool dice go to the resistance test, and beating the attack is a clean miss', async (t) => {
    t.after(combatMode());
    const def = who();
    faces.push(1, 2, 1, 2, 5, 5);                                     // Body 4 + 2 pool dice vs TN 4: 2 pool successes > 1
    await def.defend(shot(def), 2);
    assert.equal(faces.length, 0);
    assert.equal(chat.length, 1);                                      // straight to the soak card
    assert.match(chat[0].content, /Clean miss/);
    assert.equal(chat[0].flags.sr2e.test.soak.cleanMiss80.hits, 1);
    assert.deepEqual({ ...def.system.monitor }, { physical: 0, stun: 0 });
    assert.equal(def.system.poolSpent.combat, 2);
  });

  test('Revamp: otherwise attack successes vs resistance successes stage the damage', async (t) => {
    t.after(combatMode());
    const def = who();
    faces.push(5, 1, 2, 1);                                            // Body 4 vs TN 4: 1 success; 4 attack → 3 net: M → S
    await def.defend(shot(def, { attackSuccesses: 4 }), 0);
    assert.equal(def.system.monitor.physical, 6);
    assert.match(chat.at(-1).content, /Takes <strong>S<\/strong>/);
  });

  test('Revamp: a target who never saw it coming adds no pool dice', async (t) => {
    t.after(combatMode());
    const def = who();
    faces.push(5, 5, 5, 2);                                            // Body only: 3 successes vs 1 attack: down one, M → L
    await def.defend(shot(def, { unaware: true }), 3);
    assert.equal(faces.length, 0);
    assert.equal(def.system.poolSpent.combat, 0);
    assert.equal(def.system.monitor.physical, 1);
  });

  test('Revamp: a Matrix-free special attack (suppressive fire) keeps the dodge card', async (t) => {
    t.after(combatMode());
    const def = who();
    await def.defend(shot(def, { suppressive: true }), 0);
    assert.match(chat.at(-1).content, /Hit!/);
  });
});

describe('v0.80.0 combat: opposed melee and full defense (URR_V80.cbtDefense)', () => {
  test('book: the winner\'s damage is staged on the hit card; full defense adds Quickness', async () => {
    const def = who({}, [skill('s1', 'Unarmed Combat', 3, 'strength')]);
    faces.push(2, 2, 2);
    await def.defend(katana(def), 0);
    assert.equal(chat.at(-1).flags.sr2e.damage.level, 'S');
    chat.length = 0;
    faces.push(...Array(8).fill(2));                                   // 3 skill + 5 Quickness
    await def.defend(katana(def), 0, { fullDefense: true });
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /Full defense \(\+5\)/);
  });

  test('Revamp: the base level and the tally go to the soak, which stages by net vs resistance', async (t) => {
    t.after(combatMode());
    const def = who({}, [skill('s1', 'Unarmed Combat', 3, 'strength')]);
    faces.push(2, 2, 2);
    await def.defend(katana(def), 0);
    const dmg = chat.at(-1).flags.sr2e.damage;
    assert.equal(dmg.level, 'M');
    assert.deepEqual(dmg.cleanMiss80, { hits: 3, net: 3, noClean: true });
    faces.push(1, 2, 2, 2);                                            // Body 4 vs 6: none; 3 net: M → S
    await def.resistFromState(dmg, 0);
    assert.equal(def.system.monitor.physical, 6);
  });

  test('Revamp: full defense adds no dice and no pool to the melee test', async (t) => {
    t.after(combatMode());
    const def = who({}, [skill('s1', 'Unarmed Combat', 3, 'strength')]);
    faces.push(2, 2, 2);                                               // the skill's 3 dice only
    await def.defend(katana(def), 2, { fullDefense: true });
    assert.equal(faces.length, 0);
    assert.equal(def.system.poolSpent.combat, 0);
    assert.doesNotMatch(chat.at(-1).content, /Full defense \(\+/);
  });

  test('Revamp (review #4): in melee, pool successes on the soak make a clean miss only on full defense', async (t) => {
    t.after(combatMode());
    const def = who({}, [skill('s1', 'Unarmed Combat', 3, 'strength')]);
    faces.push(2, 2, 2);
    await def.defend(katana(def), 0);
    const dmg = chat.at(-1).flags.sr2e.damage;
    faces.push(1, 1, 1, 1, 6, 6, 6, 6, 1, 1, 1, 1);                    // Body 4 all ones; 4 pool dice: 6s re-rolled to 7s: 4 pool successes
    await def.resistFromState(dmg, 4);
    assert.doesNotMatch(chat.at(-1).content, /Clean miss/);
    assert.ok(def.system.monitor.physical > 0);
    const full = who({}, [skill('s1', 'Unarmed Combat', 3, 'strength')]);
    faces.push(2, 2, 2);
    await full.defend(katana(full), 0, { fullDefense: true });
    const d2 = chat.at(-1).flags.sr2e.damage;
    assert.equal(d2.cleanMiss80.noClean, undefined);
    faces.push(1, 1, 1, 1, 6, 6, 6, 6, 1, 1, 1, 1);
    await full.resistFromState(d2, 4);
    assert.match(chat.at(-1).content, /Clean miss/);
    assert.equal(full.system.monitor.physical, 0);
  });

  test('Revamp: a melee tie goes to the attacker (COMBAT.melee.tie)', async (t) => {
    t.after(combatMode());
    const def = who({}, [skill('s1', 'Unarmed Combat', 1, 'strength')]);
    faces.push(5);                                                     // 1 vs 1
    await def.defend(katana(def, { attackSuccesses: 1, reach: 0 }), 0);
    assert.match(chat.at(-1).content, /Hit!/);
  });
});

describe('v0.80.0 combat: knockdown (URR_V80.cbtKnockdown)', () => {
  const light = (def: any) => ({ targetUuid: def.uuid, melee: false, damageType: 'physical', power: 3, level: 'M' });
  test('book: Power 3 doesn\'t beat Body 4: no knockdown test', async () => {
    const def = who();
    faces.push(1, 2, 2, 2);
    await def.resistFromState(light(def), 0);
    assert.equal(chat.at(-1).flags.sr2e.knockdown, undefined);
  });
  test('Revamp: any damage: Body vs half the Power, the level needed; one success short of 3 staggers', async (t) => {
    t.after(combatMode());
    const def = who();
    faces.push(1, 2, 2, 2);                                            // TN 3: none; M stays
    await def.resistFromState(light(def), 0);
    const k = chat.at(-1).flags.sr2e.knockdown;
    assert.deepEqual(k, { actorUuid: def.uuid, tn: 2, level: 'M' });
    faces.push(1, 1, 2, 1);                                            // 1 success vs 2: 2 short of 3
    await def.rollKnockdown(k.tn, k.level);
    assert.match(chat.at(-1).content, /staggers back 2 m/);
    assert.equal(def.statuses.has('prone'), false);
  });
  test('book: one success keeps them up, no stagger', async () => {
    const def = who();
    faces.push(1, 1, 2, 1);
    await def.rollKnockdown(2, 'M');
    assert.doesNotMatch(chat.at(-1).content, /staggers|knocked down/);
  });
});

describe('v0.80.0 combat: initiative ties (URR_V80.cbtTies)', () => {
  const c = (id: string, q: number, qn: number, i: number) => ({ id, name: id, initiative: 10,
    actor: { system: { derived: { reaction: 5 }, attributes: { quickness: { total: q, natural: qn }, intelligence: { total: i, natural: i } } } } });
  test('book: Quickness breaks the tie; Revamp: natural Reaction', (t) => {
    const combat = new SR2Combat();
    const fast = c('fast', 6, 4, 4), steady = c('steady', 5, 5, 5);
    assert.ok(combat._sortCombatants(fast, steady) < 0);
    t.after(combatMode());
    assert.ok(combat._sortCombatants(fast, steady) > 0);
  });
});

describe('v0.80.0 combat: the attack plan (recoil, tracers, charging)', () => {
  const rifle = { id: 'w1', name: 'Rifle', system: { modes: 'FA', skill: 'Assault Rifles', damagePower: 8, damageLevel: 'M', damageType: 'physical', ammo: 30, ammoMax: 30, recoilComp: 0, ammoType: 'tracer' } };
  const strong = () => who({}, [skill('s1', 'Assault Rifles', 4)], { ...A, strength: 8 });
  const sum = (mods: any[], label: string) => mods.filter((m) => m.label.startsWith(label)).reduce((n, m) => n + m.value, 0);
  test('book: full recoil, no tracer bonus on a first burst, the full Power', () => {
    const p = strong().planAttack(rifle, { mode: 'FA', fullAutoRounds: 6, ammoType: 'tracer', sight: {} });
    assert.equal(sum(p.modifiers, 'Recoil'), 6);
    assert.equal(sum(p.modifiers, 'Tracers'), 0);
    assert.equal(p.power, 14);
  });
  test('Revamp: Strength 8 takes 2 off the recoil; tracers −2 TN and −2 Power', (t) => {
    t.after(combatMode());
    const p = strong().planAttack(rifle, { mode: 'FA', fullAutoRounds: 6, ammoType: 'tracer', sight: {} });
    assert.equal(sum(p.modifiers, 'Recoil'), 4);
    assert.equal(sum(p.modifiers, 'Tracers'), -2);
    assert.equal(p.power, 12);
  });
  test('a charging blow\'s Power option (set by the Attack dialog only under the Revamp)', () => {
    const a = who();
    const club = { id: 'c1', name: 'Club', system: { melee: true, skill: 'Clubs', damagePower: 2, damageLevel: 'M', damageType: 'physical', strengthPower: true, reach: 1 } };
    assert.equal(a.planAttack(club, { sight: {} }).power, 6);
    assert.equal(a.planAttack(club, { sight: {}, chargePower80: 1 }).power, 7);
  });
});

describe('v0.80.0 combat: armor (URR_V80.cbtArmorPool, cbtArmorLayers)', () => {
  const heavy = { id: 'a1', type: 'armor', name: 'Heavy', system: { worn: true, ballistic: 8, impact: 2 } };
  test('book: armor over Quickness lowers Quickness', (t) => {
    t.after(oldWay({ 'GEAR_V923.armorEncumbrance': 'old' })); // v0.92.3: the old way; the book's: v0923-gear.test.ts
    const a = who({}, [heavy]);
    assert.equal(a.system.attributes.quickness.total, 2);
    assert.equal(a.system.derived.encumbrance, 3);
  });
  test('Revamp: Quickness stays; each point of ballistic over it is a Combat Pool die less', (t) => {
    const book = who().system.derived.combatPool;
    t.after(combatMode());
    const a = who({}, [heavy]);
    assert.equal(a.system.attributes.quickness.total, 5);
    assert.equal(a.system.derived.combatPool, book - 3);
    assert.equal(a.system.derived.combatPoolLeft, book - 3);
  });
  test('Revamp (review #6): the pool penalty uses the layered rating (5 + half of 4 = 7 over Quickness 5: 2 dice)', (t) => {
    const book = who().system.derived.combatPool;
    t.after(combatMode());
    const a = who({}, [{ id: 'a1', type: 'armor', name: 'Jacket', system: { worn: true, ballistic: 5, impact: 3 } }, { id: 'a2', type: 'armor', name: 'Coat', system: { worn: true, ballistic: 4, impact: 2 } }]);
    assert.equal(a.system.derived.combatPool, book - 2);
  });
  test('layering: book best only; Revamp best plus half the next, two layers at most', (t) => {
    const pieces = [{ ballistic: 5, impact: 3 }, { ballistic: 4, impact: 2 }, { ballistic: 2, impact: 2 }];
    assert.equal(armorTotal(pieces, 'ballistic'), 5);
    const undo = oldWay({ 'COMBAT.armorLayering': 'highestPlusHalf' });
    assert.equal(armorTotal(pieces, 'ballistic'), 8);                 // the house rule: half of every other piece
    undo();
    t.after(combatMode());
    assert.equal(armorTotal(pieces, 'ballistic'), 7);
  });
});
