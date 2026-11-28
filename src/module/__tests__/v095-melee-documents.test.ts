/**
 * v0.95.0 rules completeness (melee, actions, Dice Pools): documents/index.ts as wired for RULES.MELEE_V95, the book's
 * way (the defaults) and the v0.94.2 way (the second choices). The stubs are a copy of v0923-combat.test.ts's (scripted
 * dice, a chat log of message objects); they check our wiring, not that Foundry behaves as the stubs do.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { SYSTEM_ID as NS } from '../config/system.ts';
import { WALL_STATUS } from '../rules/melee95.ts';

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
  a.uuid = `Actor.v95m-${++n}`; a.id = `id${n}`;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.toggleStatusEffect = async (id: string, o: any) => { if (o?.active === false) a.statuses.delete(id); else a.statuses.add(id); };
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}

const saved = JSON.parse(JSON.stringify(RULES.MELEE_V95));
const restore = () => { Object.assign(RULES.MELEE_V95, JSON.parse(JSON.stringify(saved))); };
const skill = (id: string, name: string, rating: number, attribute = 'quickness') => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0 } });
const pistol = (over: any = {}) => ({ id: 'w1', type: 'weapon', name: 'Predator', system: { modes: 'SA', skill: 'Pistols', damagePower: 9, damageLevel: 'M', damageType: 'physical', ammo: 15, ammoMax: 15, recoilComp: 0, concealability: 5, ready: false, quickDraw: true, ...over } });
/** A started fight with `acting` up; the others are in it too. */
function fight(acting: any, others: any[] = [], extra: any = {}): any {
  const list = [acting, ...others].map((a, i) => ({ id: `c${i}`, name: a.name, actor: a, actorId: a.id, token: { disposition: extra.dispositions?.[i] ?? 0 }, initiative: 10 - i }));
  const c: any = new SR2Combat();
  Object.assign(c, { id: 'cmb95', round: 1, started: true, turn: 0, combatants: Object.assign(list, { get: (id: string) => list.find((x) => x.id === id), find: Array.prototype.find.bind(list) }), combatant: list[0] });
  c.flags = { pass: 0 };
  g.game.combat = c;
  return c;
}
const player = () => ({ id: 'p1', name: 'Player', isGM: false, can: () => true });

describe('v0.95.0 documents: no actions (Core p. 112)', () => {
  test('Reaction 0 from wounds: no turn, and a player\'s action is refused', async (t) => {
    t.after(restore);
    const a = who({ monitor: { physical: 6, stun: 0 } }, [], { ...A, quickness: 2, intelligence: 2 });   // Reaction 2, Serious −3
    assert.equal(a.system.derived.reaction, 2);
    assert.equal(SR2Combat.canTakeTurns({ actor: a }, []), false);
    assert.equal(a.canAct('attack'), true, 'no fight: no rule');
    fight(a);
    g.game.user = player();
    assert.equal(a.canAct('attack'), false);
    assert.equal(warnings.length, 1);
    assert.equal(a.canAct('physical test'), true);
    g.game.user = GM();
    assert.equal(a.canAct('attack'), true, 'the GM is told and may go on');
    RULES.MELEE_V95.reactionOut = 'off';
    g.game.user = player();
    assert.equal(a.canAct('attack'), true);
    assert.equal(SR2Combat.canTakeTurns({ actor: a }, []), true);
  });
  test('a lighter wound still acts', () => {
    const a = who({ monitor: { physical: 3, stun: 0 } });
    fight(a);
    g.game.user = player();
    assert.equal(a.canAct('attack'), true);
    assert.equal(SR2Combat.canTakeTurns({ actor: a }, []), true);
  });
});

describe('v0.95.0 documents: quick draw (Core p. 82)', () => {
  test('a success draws and fires in one action; the card says quick-drawn', async (t) => {
    t.after(restore);
    const a = who({}, [skill('s1', 'Pistols', 4), pistol()]);
    fight(a);
    const gun = a.items.get('w1');
    faces.push(4, 1, 1, 1, 1, /* attack */ 5, 5, 1, 1);               // Reaction 5 dice vs 4: 1 success
    const r = await a.attackWith(gun, { quickDraw95: true });
    assert.ok(r);
    assert.equal(gun.system.ready, true);
    assert.equal(a.flags[NS]?.actions?.used ?? 0, 0, 'no Simple Action for the draw (the shot\'s own is the Attack window\'s)');
    assert.match(chat.at(-1).content, /quick-drawn/i);
    assert.doesNotMatch(chat.at(-1).content, /drawn \(a Simple Action\)/i);
  });
  test('a failure: nothing fires, the action is spent, the weapon stays holstered', async () => {
    const a = who({}, [skill('s1', 'Pistols', 4), pistol({ quickDraw: false })]);
    fight(a);
    const gun = a.items.get('w1');
    faces.push(5, 5, 5, 5, 5);                                        // no holster: TN 6
    assert.equal(await a.attackWith(gun, { quickDraw95: true }), null);
    assert.equal(gun.system.ready, false);
    assert.equal(gun.system.ammo, 15);
    assert.equal(a.flags[NS]?.actions?.used ?? 0, 1);
    assert.match(chat.at(-1).content, /vs 6/);
  });
  test('drawing first costs the Simple Action, holster or not; the old way a holster is free', async (t) => {
    t.after(restore);
    const a = who({}, [skill('s1', 'Pistols', 4), pistol()]);
    fight(a);
    faces.push(5, 5, 1, 1);
    await a.attackWith(a.items.get('w1'), { quickDraw95: false });
    assert.equal(a.flags[NS]?.actions?.used ?? 0, 1, 'the draw');
    assert.match(chat.at(-1).content, /drawn \(a Simple Action\)/i);
    RULES.MELEE_V95.quickDraw = 'holster';
    const b = who({}, [skill('s1', 'Pistols', 4), pistol()]);
    fight(b);
    faces.push(5, 5, 1, 1);
    await b.attackWith(b.items.get('w1'), {});
    assert.equal(b.flags[NS]?.actions?.used ?? 0, 0);
    assert.match(chat.at(-1).content, /quick-drawn/i);
  });
});

describe('v0.95.0 documents: subduing (Core p. 103)', () => {
  test('v0.96.4: only the holder\'s owner (or the GM) can try a hold', async (t) => {
    t.after(restore);
    const h = who({ name: 'Watcher' }), v = who({ name: 'Victim' });
    h.isOwner = false;
    const n0 = chat.length;
    assert.equal(await h.holdTarget(v.uuid), null);
    assert.equal(chat.length, n0, 'no hold test card');
    assert.match(warnings.at(-1)!, /Only Watcher's owner or the GM/);
  });
  test('H1: the soak records a subduing blow\'s Stun; Hold takes only that; Let go leaves the Drain; the old way is the hold test', async (t) => {
    t.after(restore);
    const h = who({ name: 'Holder' }), v = who({ name: 'Victim' });
    faces.push(1, 1, 1, 1);                                           // Drain-like: Body 4 vs 3, no successes: M Stun (3 boxes)
    await v.resistDamage({ power: 3, level: 'M', type: 'stun', poolDice: 0 });
    assert.equal(v.system.monitor.stun, 3);
    assert.equal(v.flags[NS]?.subdueDone95, undefined, 'not subduing damage');
    faces.push(1, 1, 1, 1);                                           // the subduing blow: D Stun, the track fills (7 more)
    await v.resistDamage({ power: 3, level: 'D', type: 'stun', poolDice: 0, subdueBy95: h.uuid });
    assert.equal(v.system.monitor.stun, 10);
    assert.deepEqual(v.flags[NS].subdueDone95, [{ by: h.uuid, boxes: 7 }]);
    const other = who({ name: 'Bystander' });
    faces.push(1, 1, 1, 1, 1, 1, 1, 1);
    assert.equal(await other.holdTarget(v.uuid), 'free', 'not their subduing: the old hold test');
    assert.equal(v.flags[NS]?.subdued95, undefined);
    faces.length = 0;
    assert.equal(await h.holdTarget(v.uuid), 'held');
    assert.deepEqual([v.flags[NS].subdued95.by, v.flags[NS].subdued95.boxes], [h.uuid, 7]);
    assert.equal(v.flags[NS].heldBy, h.uuid);
    assert.equal(faces.length, 0, 'no test to take control');
    const card = chat.at(-1);
    await (await import('../applications/melee95.ts')).onRelease95(card, { disabled: false } as any);
    assert.equal(v.system.monitor.stun, 3, 'only the subduing Stun comes off');
    assert.equal(v.flags[NS]?.heldBy ?? null, null);
    RULES.MELEE_V95.subdueControl = 'off';
    const w = who({ name: 'Other', monitor: { physical: 0, stun: 10 } });
    faces.push(1, 1, 1, 1, 1, 1, 1, 1);
    assert.equal(await h.holdTarget(w.uuid), 'free');
    assert.equal(w.flags[NS]?.subdued95, undefined);
  });
  test('H1: a subduing attack carries its attacker to the card; a Physical weapon\'s does not', async (t) => {
    t.after(restore);
    const a = who({ name: 'A' }, [skill('s1', 'Clubs', 3, 'strength')]), d = who({ name: 'D' });
    const club = { id: 'c', name: 'Club', system: { melee: true, skill: 'Clubs', damagePower: 1, damageLevel: 'M', damageType: 'stun', reach: 1, strengthPower: true } };
    faces.push(5, 5, 5);
    await a.attackWith(club, { targetUuid: d.uuid, subdue: true });
    assert.equal(chat.at(-1).flags[NS].attack.subdueBy95, a.uuid);
    faces.push(5, 5, 5);
    await a.attackWith({ ...club, system: { ...club.system, damageType: 'physical' } }, { targetUuid: d.uuid, subdue: true });
    assert.equal(chat.at(-1).flags[NS].attack.subdueBy95, undefined);
  });
});

describe('v0.95.0 documents: interception (Core p. 83)', () => {
  const offer = (a: any, m: any) => asMessage({ author: { isGM: true }, flags: { [NS]: { intercept95: { interceptorUuid: a.uuid, moverUuid: m.uuid } } } });
  test('M2: TN 4 with only reach and the attacker\'s movement; without the GM\'s offer it is refused', async (t) => {
    t.after(() => { restore(); g.game.messages.contents = []; });
    const a = who({ name: 'Guard' }, [skill('s1', 'Clubs', 3, 'strength')]), m = who({ name: 'Runner' });
    const club = { id: 'c', name: 'Club', system: { melee: true, skill: 'Clubs', damagePower: 1, damageLevel: 'M', damageType: 'stun', reach: 1, strengthPower: true } };
    const o = { targetUuid: m.uuid, intercept95: true, situational: ['attackerRunning', 'targetRunning'], modifiers: [{ label: 'Other', value: 3 }], targetReach: 0 };
    const plan = a.planAttack(club, o);
    assert.deepEqual(plan.modifiers.map((x: any) => x.value), [4, -1], 'running +4, reach −1; the rest dropped');
    assert.equal(plan.base.value, 4);
    assert.equal(await a.attackWith(club, o), null, 'no offer');
    assert.equal(chat.length, 0);
    g.game.messages.contents = [offer(a, m)];
    faces.push(5, 5, 5);
    assert.ok(await a.attackWith(club, o));
    assert.equal(chat.at(-1).flags[NS].attack.intercept95, true);
    g.game.messages.contents.push(chat.at(-1));
    faces.push(5, 5, 5);
    assert.equal(await a.attackWith(club, o), null, 'one attack per offer');
  });
  test('M2: the one intercepted defends as on full defense: no counterattack', async (t) => {
    t.after(() => { restore(); g.game.messages.contents = []; });
    const a = who({ name: 'Guard' }), m = who({ name: 'Runner' }, [skill('s1', 'Unarmed Combat', 4, 'strength')]);
    const blow = { attackerUuid: a.uuid, targetUuid: m.uuid, weaponName: 'Club', melee: true, damageType: 'stun', power: 4, level: 'M', attackSuccesses: 1, targetNumber: 4, reach: 1, intercept95: true };
    faces.push(5, 5, 5, 5);                                           // the runner wins the melee test
    await m.defend(blow, 0, { weaponId: 'unarmed' });
    assert.match(chat.at(-1).content, /data-sr2e-action="resist"/, 'marked as an interception without the GM\'s offer: the counterattack stands');
    chat.length = 0;
    g.game.messages.contents = [offer(a, m)];
    faces.push(5, 5, 5, 5);
    await m.defend(blow, 0, { weaponId: 'unarmed' });
    assert.doesNotMatch(chat.at(-1).content, /data-sr2e-action="resist"/);
    assert.equal(m.flags[NS]?.fullDefense, undefined, 'no full-defense cost of its own');
  });
});

describe('v0.95.0 documents: against a wall (Core p. 102)', () => {
  test('a stagger with a wall behind: the status, and +2 on the character\'s tests until it is cleared', async (t) => {
    t.after(() => { restore(); delete g.CONFIG.Canvas; delete g.canvas; g.game.messages.contents = []; });
    g.canvas = { grid: { size: 100, distance: 1, units: 'm' } };
    const atk = who({ name: 'Attacker' }), def = who({ name: 'Defender' });
    atk.getActiveTokens = () => [{ center: { x: 0, y: 0 } }];
    def.getActiveTokens = () => [{ center: { x: 100, y: 0 } }];
    g.game.messages.contents = [asMessage({ flags: { [NS]: { attack: { attackerUuid: atk.uuid, targetUuid: def.uuid, melee: true } } } })];
    g.CONFIG.Canvas = { polygonBackends: { move: { testCollision: () => true } } };
    faces.push(4, 1, 1, 1);                                           // Body 4 vs 4: 1 success, a Moderate wound: staggered
    await def.rollKnockdown(4, 'M');
    assert.ok(def.statuses.has(WALL_STATUS));
    // M3: on melee attacks (and melee defense), not on every test.
    const wallOn = (mods: any[]) => mods.filter((m: any) => m.id === 'againstWall95').map((m: any) => m.value);
    const club = { id: 'c', name: 'Club', system: { melee: true, skill: 'Clubs', damagePower: 1, damageLevel: 'M', damageType: 'stun', reach: 1, strengthPower: true } };
    assert.deepEqual(wallOn(def.planAttack(club, {}).modifiers), [2]);
    assert.deepEqual(wallOn(def.planAttack(pistol(), {}).modifiers), [], 'not a ranged attack');
    assert.deepEqual(wallOn(def.previewModifiers()), [], 'not a Perception test or a spell');
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1);
    await def.defend({ attackerUuid: atk.uuid, targetUuid: def.uuid, weaponName: 'Club', melee: true, damageType: 'stun', power: 4, level: 'M', attackSuccesses: 1, targetNumber: 4, reach: 0 }, 0, { weaponId: 'unarmed' });
    assert.match(chat.at(-1).content, /Against a wall/, 'the melee defense test lists it');
    def.statuses.delete(WALL_STATUS);
    assert.deepEqual(wallOn(def.planAttack(club, {}).modifiers), []);
    RULES.MELEE_V95.wall = 'off';
    faces.push(4, 1, 1, 1);
    await def.rollKnockdown(4, 'M');
    assert.equal(def.statuses.has(WALL_STATUS), false);
  });
});

describe('v0.95.0 documents: surprise (Core p. 86)', () => {
  test('the completely surprised get no turn in the surprise turn and are named on the card', async (t) => {
    t.after(restore);
    const pc = who({ name: 'Slow' }, [], { ...A, quickness: 1, intelligence: 1 }), foe = who({ name: 'Quick' });
    const c = fight(pc, [foe], { dispositions: [1, -1] });
    c.updateEmbeddedDocuments = async (_t: string, ups: any[]) => { for (const u of ups) Object.assign(c.combatants.get(u._id), u); };
    c.setupTurns = () => [];
    faces.push(1, /* Quick: Reaction 5 */ 5, 5, 1, 1, 1);
    const out = await c.rollSurprise();
    assert.deepEqual(out, ['c0']);
    assert.deepEqual(c.flags.surprise.ids, ['c0']);
    assert.deepEqual(c.surprisedNow(), ['c0']);
    assert.match(chat.at(-1).content, /Completely surprised/);
    g.game.user = player();
    assert.equal(pc.canAct('attack'), false);
    assert.equal(foe.canAct('attack'), true);
    RULES.MELEE_V95.totalSurprise = 'off';
    faces.push(1, 5, 5, 1, 1, 1);
    assert.deepEqual(await c.rollSurprise(), []);
  });
});

describe('v0.95.0 documents: the other pools (Core p. 84)', () => {
  test('book: the Spell Pool and spell defense last into the new Combat Turn and refresh at the action, with a note', async (t) => {
    t.after(restore);
    const a = who({ poolSpent: { combat: 3, spell: 2, hacking: 1, control: 2, task: 1 }, spellDefense: 2 });
    await a.refreshPools({ keepCombat: true });
    assert.deepEqual([a.system.poolSpent.combat, a.system.poolSpent.spell, a.system.poolSpent.hacking, a.system.poolSpent.control, a.system.poolSpent.task], [3, 2, 1, 0, 0], 'the Control and Task Pools per Combat Turn (Rigger 2)');
    assert.equal(a.system.spellDefense, 2);
    const c = fight(a);
    await c.refreshActingPool();
    assert.equal(a.system.poolSpent.combat, 0);
    assert.equal(a.system.poolSpent.spell, 0);
    assert.equal(a.system.poolSpent.hacking, 0);
    assert.equal(a.system.spellDefense, 0);
    assert.equal(chat.length, 1);
    assert.match(chat[0].content, /2 spell defense dice/);
    a.system.poolSpent.spell = 1;
    await c.refreshActingPool();
    assert.equal(a.system.poolSpent.spell, 1, 'once per action');
  });
  test('turn (v0.94.2): everything but the Combat Pool at the new Combat Turn, nothing more at the action', async (t) => {
    t.after(restore);
    RULES.MELEE_V95.otherPools = 'turn';
    const a = who({ poolSpent: { combat: 3, spell: 2, hacking: 1, control: 2, task: 1 }, spellDefense: 2 });
    await a.refreshPools({ keepCombat: true });
    assert.equal(a.system.poolSpent.spell, 0);
    assert.equal(a.system.spellDefense, 0);
    assert.equal(a.system.poolSpent.combat, 3);
    a.system.poolSpent.spell = 2;
    const c = fight(a);
    await c.refreshActingPool();
    assert.equal(a.system.poolSpent.spell, 2);
    assert.equal(chat.length, 0);
  });
  test('L4: no action last Combat Turn: the Spell and Hacking Pools refresh at the new one', async (t) => {
    t.after(restore);
    const a = who({ poolSpent: { combat: 3, spell: 2, hacking: 1, control: 2, task: 1 }, spellDefense: 2 });
    await a.refreshPools({ keepCombat: true, acted: false });
    assert.deepEqual([a.system.poolSpent.spell, a.system.poolSpent.hacking, a.system.spellDefense], [0, 0, 0]);
    assert.equal(a.system.poolSpent.combat, 3);
  });
  test('L5: the refresh at the action waits for a spell defense spend in flight', async (t) => {
    t.after(restore);
    const { queueSpellDefense } = await import('../documents/index.ts');
    const a = who({ poolSpent: { combat: 0, spell: 1, hacking: 0, control: 0, task: 0 }, spellDefense: 3 });
    const c = fight(a);
    let release: () => void = () => {};
    const order: string[] = [];
    const spend = queueSpellDefense(String(a.uuid), () => new Promise<void>((r) => { release = () => { a.system.spellDefense = 1; a.system.poolSpent.spell = 3; order.push('spend'); r(); }; }));
    const refresh = c.refreshActingPool().then(() => order.push('refresh'));
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(a.system.spellDefense, 3, 'not written while the spend runs');
    release();
    await Promise.all([spend, refresh]);
    assert.deepEqual(order, ['spend', 'refresh']);
    assert.deepEqual([a.system.spellDefense, a.system.poolSpent.spell], [0, 0]);
    assert.match(chat.at(-1).content, /1 spell defense die/, 'the value after the spend');
  });
  test('a plain refresh (no fight) clears every pool as before', async () => {
    const a = who({ poolSpent: { combat: 3, spell: 2, hacking: 1, control: 2, task: 1 }, spellDefense: 2 });
    await a.refreshPools();
    assert.deepEqual([a.system.poolSpent.combat, a.system.poolSpent.spell, a.system.poolSpent.hacking, a.system.poolSpent.control, a.system.poolSpent.task, a.system.spellDefense], [0, 0, 0, 0, 0, 0]);
  });
});
