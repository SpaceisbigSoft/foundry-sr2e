/**
 * v0.92.3 book alignment (area: combat), the Foundry glue: documents/index.ts and models/index.ts as wired for
 * RULES.COMBAT_V923. Each hook is checked the book's way (the shipped defaults) and the v0.92.2 way (combat922()). The
 * stubs are a copy of v080-combat.test.ts's (scripted dice, a chat log of message objects with getFlag); they check our
 * wiring, not that Foundry behaves as the stubs do. The dialogs in applications/ are covered through their pure
 * functions (rules/__tests__/v0923-combat.test.ts).
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { combat922 } from '../rules/__tests__/combat922.ts';
import { urrMode } from '../rules/__tests__/urrmode.ts';

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
  a.uuid = `Actor.v923c-${++n}`; a.id = `id${n}`;
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


const pistol = (over: any = {}) => ({ id: 'w1', name: 'Predator', system: { modes: 'SA BF', skill: 'Pistols', damagePower: 9, damageLevel: 'M', damageType: 'physical', ammo: 15, ammoMax: 15, recoilComp: 0, ...over } });

describe('v0.92.3 combat: ranged defense (Core pp. 87, 91; Ka-Ge 7 Q4)', () => {
  test('book: no dodge card; the pool dice go into the resistance test; pool successes above the attack\'s are a clean miss', async () => {
    const def = who();
    faces.push(1, 2, 1, 2, 5, 5);                                     // Body 4 + 2 pool dice vs TN 4: 2 pool successes > 1
    await def.defend(shot(def), 2);
    assert.equal(faces.length, 0);
    assert.equal(chat.length, 1);
    assert.match(chat[0].content, /Clean miss/);
    assert.deepEqual({ ...def.system.monitor }, { physical: 0, stun: 0 });
    assert.equal(def.system.poolSpent.combat, 2);
  });
  test('book: the Ka-Ge example: 9M, 6 attack successes against 8 resistance successes is Light', async () => {
    const vest = { id: 'a1', type: 'armor', name: 'Vest', system: { worn: true, ballistic: 5, impact: 3 } };
    const def = who({}, [vest], { ...A, body: 8 });
    faces.push(5, 5, 5, 5, 5, 5, 5, 5);                               // Body 8 vs TN 9 − 5 = 4: 8 successes
    await def.defend(shot(def, { power: 9, attackSuccesses: 6 }), 0);
    assert.equal(def.system.monitor.physical, 1);                      // 8 vs 6: 2 net down, M → L
  });
  test('old: a dodge card stages the hit by net successes', async (t) => {
    t.after(combat922());
    const def = who();
    await def.defend(shot(def, { attackSuccesses: 4 }), 0);
    assert.match(chat.at(-1).content, /Hit!/);
    assert.equal(chat.at(-1).flags.sr2e.damage.level, 'S');
  });
  test('Revamp source: the v0.92.3 switch is inert (the Revamp\'s own cbtDefense decides)', async (t) => {
    t.after(urrMode({ 'URR_V80.cbtDefense': 'dodge' }));
    const def = who();
    await def.defend(shot(def, { attackSuccesses: 4 }), 0);
    assert.match(chat.at(-1).content, /Hit!/);
  });
});

describe('v0.92.3 combat: melee (Core pp. 100–102)', () => {
  test('book: a tie goes to the attacker; 2 net successes stage up one level', async () => {
    const def = who({}, [skill('s1', 'Unarmed Combat', 1, 'strength')]);
    faces.push(5);                                                     // 1 vs 1
    await def.defend(katana(def, { attackSuccesses: 1, reach: 0 }), 0);
    assert.match(chat.at(-1).content, /Hit!/);
    assert.equal(chat.at(-1).flags.sr2e.damage.level, 'M');
    chat.length = 0;
    const d2 = who({}, [skill('s1', 'Unarmed Combat', 1, 'strength')]);
    faces.push(1);                                                     // 2 vs 0
    await d2.defend(katana(d2, { attackSuccesses: 2, reach: 0 }), 0);
    assert.equal(chat.at(-1).flags.sr2e.damage.level, 'S');            // 2 net: M → S
  });
  test('book: full defense adds no dice and no pool, costs no initiative; the hit carries the tally, a clean miss on the soak\'s pool', async () => {
    const def = who({}, [skill('s1', 'Unarmed Combat', 3, 'strength')]);
    faces.push(2, 2, 2);                                               // the skill's 3 dice only
    await def.defend(katana(def), 2, { fullDefense: true });
    assert.equal(faces.length, 0);
    assert.equal(def.system.poolSpent.combat, 0);
    const dmg = chat.at(-1).flags.sr2e.damage;
    assert.equal(dmg.level, 'S');                                       // 3 net: M → S (staged at the melee test)
    assert.deepEqual(dmg.cleanMiss80, { hits: 3, net: 3, apart: true });
    faces.push(1, 1, 1, 1, 6, 6, 6, 6, 1, 1, 1, 1);                    // Body 4 all ones; 4 pool dice re-rolled 6s: 4 pool successes > 3
    await def.resistFromState(dmg, 4);
    assert.match(chat.at(-1).content, /Clean miss/);
    assert.equal(def.system.monitor.physical, 0);
  });
  test('book: on full defense without a clean miss, the soak stages the (already staged) hit down by its own successes', async () => {
    const def = who({}, [skill('s1', 'Unarmed Combat', 3, 'strength')]);
    faces.push(2, 2, 2);
    await def.defend(katana(def), 0, { fullDefense: true });
    const dmg = chat.at(-1).flags.sr2e.damage;
    faces.push(6, 6, 1, 1, 1, 1);                                       // TN 6: 2 successes (6 re-rolled 1 → 7), no pool: S → M
    await def.resistFromState(dmg, 0);
    assert.equal(def.system.monitor.physical, 3);
  });
  test('old: full defense adds Quickness dice; a tie hurts nobody', async (t) => {
    t.after(combat922());
    const def = who({}, [skill('s1', 'Unarmed Combat', 3, 'strength')]);
    faces.push(...Array(8).fill(2));
    await def.defend(katana(def), 0, { fullDefense: true });
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /Full defense \(\+5\)/);
    chat.length = 0;
    const d2 = who({}, [skill('s1', 'Unarmed Combat', 1, 'strength')]);
    faces.push(5);
    await d2.defend(katana(d2, { attackSuccesses: 1, reach: 0 }), 0);
    assert.match(chat.at(-1).content, /No damage/);
  });
});

describe('v0.92.3 combat: knockdown (Core pp. 92, 102)', () => {
  const light = (def: any, over: any = {}) => ({ targetUuid: def.uuid, melee: false, damageType: 'physical', power: 3, level: 'M', ...over });
  test('book: any damage calls for the test at half the Power; 1–2 successes on a Moderate stagger 1 m', async () => {
    const def = who();
    faces.push(1, 2, 2, 2);                                            // resist TN 3: none; M stays
    await def.resistFromState(light(def, { power: 9 }), 0);
    const k = chat.at(-1).flags.sr2e.knockdown;
    assert.deepEqual(k, { actorUuid: def.uuid, tn: 4, level: 'M' });
    faces.push(5, 1, 5, 1);                                            // 2 successes, not past 2
    await def.rollKnockdown(k.tn, k.level);
    assert.match(chat.at(-1).content, /staggers back 1 m/);
    assert.equal(def.statuses.has('prone'), false);
  });
  test('book: a melee hit\'s knockdown TN is the attacker\'s Strength; gel rounds the Power', async () => {
    const def = who();
    faces.push(1, 1, 1, 1);
    await def.resistFromState({ ...light(def, { power: 7 }), melee: true, strength: 5 }, 0);
    assert.equal(chat.at(-1).flags.sr2e.knockdown.tn, 5);
    faces.push(1, 1, 1, 1);
    await def.resistFromState({ ...light(def, { power: 7 }), gel: true, armorKind: 'impact', damageType: 'stun' }, 0);
    assert.equal(chat.at(-1).flags.sr2e.knockdown.tn, 7);
  });
  test('old: Power 3 doesn\'t beat Body 4: no knockdown test', async (t) => {
    t.after(combat922());
    const def = who();
    faces.push(1, 2, 2, 2);
    await def.resistFromState(light(def), 0);
    assert.equal(chat.at(-1).flags.sr2e.knockdown, undefined);
  });
});

describe('v0.92.3 combat: blasts (Core p. 97)', () => {
  test('book: the blast card\'s entries carry the attack\'s successes; the soak compares', async () => {
    const thrower = who({ name: 'Thrower' });
    const def = who({ name: 'Target' });
    await thrower.postBlast({ attackerUuid: thrower.uuid, weaponName: 'Grenade', power: 10, level: 'S', damageType: 'physical', perMetre: 1, kind: 'offensive', successes: 4 } as any,
      [{ targetUuid: def.uuid, name: 'Target', metres: 2 }], '');
    const d = chat.at(-1).flags.sr2e.damages[0];
    assert.equal(d.power, 8);
    assert.deepEqual(d.cleanMiss80, { hits: 4, net: 4, noClean: true });
    faces.push(1, 1, 1, 1, 6, 1, 1);                                   // Body 4 vs 8: none; 2 pool dice, the 6 re-rolled 1 (7): none
    await def.resistFromState(d, 2);
    assert.equal(def.system.monitor.physical, 10);                     // 4 vs 0: S → D
  });
  test('old: no tally; the soak only stages down', async (t) => {
    t.after(combat922());
    const thrower = who({ name: 'Thrower' });
    const def = who({ name: 'Target' });
    await thrower.postBlast({ attackerUuid: thrower.uuid, weaponName: 'Grenade', power: 10, level: 'S', damageType: 'physical', perMetre: 1, kind: 'offensive', successes: 4 } as any,
      [{ targetUuid: def.uuid, name: 'Target', metres: 2 }], '');
    assert.equal(chat.at(-1).flags.sr2e.damages[0].cleanMiss80, undefined);
  });
});

describe('v0.92.3 combat: the attack plan (Core pp. 89–98)', () => {
  const shooter = () => who({}, [skill('s1', 'Pistols', 4)]);
  test('book: two rounds left in a burst: a short burst, +2 Power, no extra level', () => {
    const p = shooter().planAttack(pistol({ ammo: 2 }), { mode: 'BF', sight: {} });
    assert.equal(p.rounds, 2);
    assert.equal(p.power, 11);
    assert.equal(p.level, 'M');
    assert.equal(p.ammoShort, null);
  });
  test('old: the burst can\'t be fired', (t) => {
    t.after(combat922());
    const p = shooter().planAttack(pistol({ ammo: 2 }), { mode: 'BF', sight: {} });
    assert.ok(p.ammoShort);
  });
  test('book: a barrier rated above the Power stops the shot; explosive rounds double it', () => {
    const p = shooter().planAttack(pistol(), { mode: 'SA', sight: {}, barrierArmor: 6 });
    assert.equal(p.extras.extraArmor, 6);
    assert.equal(p.extras.barrierStopped, undefined);
    const q = shooter().planAttack(pistol(), { mode: 'SA', sight: {}, barrierArmor: 6, ammoType: 'explosive' });
    assert.equal(q.extras.extraArmor, 12);
    assert.equal(q.extras.barrierStopped, true);
  });
  test('book: a stopped shot does no damage', async () => {
    const def = who();
    await def.resistFromState({ targetUuid: def.uuid, melee: false, damageType: 'physical', power: 9, level: 'M', barrierStopped: true }, 0);
    assert.match(chat.at(-1).content, /stops it cold/);
    assert.equal(def.system.monitor.physical, 0);
  });
  test('old: the barrier only adds to armor', (t) => {
    t.after(combat922());
    const q = shooter().planAttack(pistol(), { mode: 'SA', sight: {}, barrierArmor: 6, ammoType: 'explosive' });
    assert.equal(q.extras.extraArmor, 6);
    assert.equal(q.extras.barrierStopped, undefined);
  });
  test('book: a second firearm drops the smartlink and laser rows', () => {
    const sum = (p: any) => p.modifiers.reduce((n: number, m: any) => n + m.value, 0);
    const a = shooter();
    const both = sum(a.planAttack(pistol(), { mode: 'SA', sight: {}, situational: ['secondWeapon', 'laserSight'] }));
    const only = sum(a.planAttack(pistol(), { mode: 'SA', sight: {}, situational: ['secondWeapon'] }));
    assert.equal(both, only);
  });
  test('book: full auto spread: the third target\'s burst is +4; gel rounds are marked', () => {
    const smg = { id: 'w2', name: 'SMG', system: { modes: 'FA', skill: 'Pistols', damagePower: 6, damageLevel: 'M', damageType: 'physical', ammo: 30, ammoMax: 30, recoilComp: 0 } };
    const p = shooter().planAttack(smg, { mode: 'FA', rounds: 3, sight: {}, spreadExtraTargets: 2, spreadIndex: 2 });
    assert.equal(p.modifiers.filter((m: any) => m.id === 'spreadTargets').reduce((n: number, m: any) => n + m.value, 0), 4);
    const g = shooter().planAttack(pistol(), { mode: 'SA', sight: {}, ammoType: 'gel' });
    assert.equal(g.extras.gel, true);
  });
});

describe('v0.92.3 combat: flechette (Core p. 93)', () => {
  const jacket = { id: 'a1', type: 'armor', name: 'Armor jacket', system: { worn: true, ballistic: 5, impact: 3 } };
  const hit = (def: any) => ({ targetUuid: def.uuid, melee: false, damageType: 'physical', power: 9, level: 'M', flechette: true });
  test('book: an armor jacket (5/3) counts 6 against flechette (TN 3)', async () => {
    const def = who({}, [jacket]);
    faces.push(1, 1, 1, 1);
    await def.resistFromState(hit(def), 0);
    assert.equal(chat.at(-1).flags.sr2e.test.targetNumber, 3);
  });
  test('old: the higher doubled: 10 (TN 2)', async (t) => {
    t.after(combat922());
    const def = who({}, [jacket]);
    faces.push(1, 1, 1, 1);
    await def.resistFromState(hit(def), 0);
    assert.equal(chat.at(-1).flags.sr2e.test.targetNumber, 2);
  });
  test('dermal armor stops the extra level: an unarmored troll (CORE_V923.trollDermal \'body\') takes M, a human S', async () => {
    const human = who({});
    faces.push(...Array(30).fill(1));
    await human.resistFromState(hit(human), 0);
    const troll = who({ name: 'Troll', metatype: 'troll' });
    faces.length = 0; faces.push(...Array(30).fill(1));
    await troll.resistFromState(hit(troll), 0);
    assert.equal(human.system.monitor.physical, 6);
    assert.equal(troll.system.monitor.physical, 3);
  });
});

describe('v0.92.3 combat: heavy armor and the Combat Pool (Dice Pools p. 85)', () => {
  const heavy = { id: 'a1', type: 'armor', name: 'Heavy', system: { worn: true, ballistic: 8, impact: 2 } };
  test('book: Quickness stays; each point of ballistic over it is a Combat Pool die less', () => {
    const base = who().system.derived.combatPool;
    const a = who({}, [heavy]);
    assert.equal(a.system.attributes.quickness.total, 5);
    assert.equal(a.system.derived.combatPool, base - 3);
  });
  test('old: armor over Quickness lowers Quickness', (t) => {
    t.after(combat922());
    const a = who({}, [heavy]);
    assert.equal(a.system.attributes.quickness.total, 2);
  });
});

describe('v0.92.3 combat: pools and delays (Core pp. 78, 80, 84)', () => {
  test('book: a new Combat Turn keeps the Combat Pool\'s spent dice; the action refreshes it', async () => {
    const a = who();
    a.system.poolSpent.combat = 3; a.system.poolSpent.spell = 2;
    await a.refreshPools({ keepCombat: true });
    assert.equal(a.system.poolSpent.combat, 3);
    assert.equal(a.system.poolSpent.spell, 0);
    await a.refreshCombatPool();
    assert.equal(a.system.poolSpent.combat, 0);
  });
  test('book: the acting combatant\'s pool refreshes once per action', async () => {
    const a = who();
    const combat = new SR2Combat();
    Object.assign(combat, { id: 'cmb1', round: 2, started: true, combatant: { id: 'cA', actor: a } });
    combat.flags = { pass: 0 };
    a.system.poolSpent.combat = 4;
    await combat.refreshActingPool();
    assert.equal(a.system.poolSpent.combat, 0);
    a.system.poolSpent.combat = 2;                                     // spent during the same action
    await combat.refreshActingPool();
    assert.equal(a.system.poolSpent.combat, 2);
    combat.flags.pass = 1;                                             // the next pass: a new action
    await combat.refreshActingPool();
    assert.equal(a.system.poolSpent.combat, 0);
  });
  test('book: using pool dice while delaying breaks the delay', async () => {
    const a = who();
    g.game.combat = { started: true, id: 'cmb2', round: 1, pass: 0 };
    await a.setFlag('sr2e', 'delayed', { combatId: 'cmb2', round: 1, pass: 0 });
    assert.equal(a.isDelaying(), true);
    faces.push(1, 1, 1, 1, 5);
    await a.resistDamage({ power: 6, level: 'L', poolDice: 1 });
    assert.equal(a.isDelaying(), false);
    assert.ok(chat.some((m) => /delayed action is lost/.test(String(m.content))));
  });
  test('old: pool dice don\'t matter', async (t) => {
    t.after(combat922({ 'DELAY.lostAtPassEnd': false }));
    const a = who();
    g.game.combat = { started: true, id: 'cmb3', round: 1, pass: 0 };
    await a.setFlag('sr2e', 'delayed', { combatId: 'cmb3', round: 1, pass: 0 });
    faces.push(1, 1, 1, 1, 5);
    await a.resistDamage({ power: 6, level: 'L', poolDice: 1 });
    assert.equal(a.isDelaying(), true);
  });
});
