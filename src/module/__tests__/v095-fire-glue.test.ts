/**
 * v0.95.0 rules completeness (area: ranged combat), the Foundry glue: the hooks in documents/index.ts
 * (documents/fire95.ts) and the canvas, dialog and card side (applications/fire95.ts) as wired for RULES.FIRE_V95.
 * Each rule is checked the book's way and the v0.94.2 way. The stubs are a copy of v0923-combat.test.ts's (scripted
 * dice, a chat log of message objects with getFlag); they check our wiring, not that Foundry behaves as the stubs do.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
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

let CharacterDataModel: any, SR2Actor: any;
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
  ({ SR2Actor } = await import('../documents/index.ts'));
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
  a.uuid = `Actor.v95f-${++n}`; a.id = `id${n}`;
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


const pistol = (over: any = {}) => ({ id: 'w1', name: 'Predator', system: { modes: 'SA BF', skill: 'Pistols', damagePower: 9, damageLevel: 'M', damageType: 'physical', ammo: 15, ammoMax: 15, recoilComp: 0, ...over } });
const F = 'shadowrun2e_unified';
const sum = (p: any) => p.modifiers.reduce((n: number, m: any) => n + m.value, 0);
const mod = (p: any, re: RegExp) => p.modifiers.find((m: any) => re.test(String(m.label)));
const combatOn = (over: any = {}) => { g.game.combat = { started: true, id: 'c95', round: 1, pass: 0, combatant: { id: 'cb1' }, combatants: [], ...over }; };
const shooter = (items: any[] = []) => who({ name: 'Shooter' }, [skill('s1', 'Pistols', 4), ...items]);
const gun = (id: string, over: any = {}) => ({ id, type: 'weapon', name: id === 'w1' ? 'Predator' : 'Second', system: { melee: false, modes: 'SA BF', skill: 'Pistols', damagePower: 9, damageLevel: 'M', damageType: 'physical', ammo: 15, ammoMax: 15, recoilComp: 0, ...over } });
const stage = (tokens: any[] = [], walls: any[] = []) => {
  g.canvas = {
    grid: { size: 100, distance: 1, units: 'm', measurePath: (pts: any[]) => ({ distance: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) / 100 }) },
    tokens: { placeables: tokens, controlled: [] }, walls: { placeables: walls }, scene: null,
  };
};
const token = (actor: any, x: number, y: number) => ({ actor, name: actor.name, center: { x, y }, document: { width: 1, height: 1 } });
const wall = (c: number[], rating: number | null) => ({ document: { c, move: 1, getFlag: (_s: string, k: string) => (k === 'barrierRating' ? rating : null) } });
const card = (flags: any, author: any = GM()) => {
  const m: any = asMessage({ flags: { [F]: flags }, author });
  return m;
};
const button = (index = 0): any => ({ dataset: { index: String(index) }, disabled: false });

describe('v0.95.0 fire glue: laser sight in bad air (Core p. 90)', () => {
  test('book: smoke on the line of fire drops the laser sight, with a note', () => {
    const a = shooter();
    const clear = a.planAttack(pistol({ laserSight: true }), { mode: 'SA', sight: {}, situational: ['laserSight'] });
    const smoky = a.planAttack(pistol({ laserSight: true }), { mode: 'SA', sight: { smoke: { label: 'Smoke', value: 4 } }, situational: ['laserSight'] });
    assert.equal(sum(smoky) - sum(clear), 5);                           // the smoke's +4 and the laser's −1 gone
    assert.ok(smoky.notes.includes('laser sight: no use through smoke'));
    assert.equal(smoky.situational.includes('laserSight'), false);
    assert.equal(clear.situational.includes('laserSight'), true);
  });
  test('book: fog where the shooter stands drops it too; off: it stays; the Revamp source: dropped as well', (t) => {
    const a = shooter();
    a.weatherHere = () => 'fog';
    const o = { mode: 'SA', sight: {} };
    assert.equal(sum(a.planAttack(pistol(), { ...o, situational: ['laserSight'] })), sum(a.planAttack(pistol(), { ...o, situational: [] })));
    assert.ok(a.planAttack(pistol(), { ...o, situational: ['laserSight'] }).notes.includes('laser sight: no use in this weather'));
    const undo = urrMode();
    assert.equal(a.planAttack(pistol(), { ...o, situational: ['laserSight'] }).situational.includes('laserSight'), false);
    undo();
    t.after(oldWay({ 'FIRE_V95.laser': 'off' }));
    assert.equal(sum(a.planAttack(pistol(), { ...o, situational: ['laserSight'] })), sum(a.planAttack(pistol(), { ...o, situational: [] })) - 1);
  });
  test('the Attack dialog\'s own check: weather, or the smoke kind found on the line', async (t) => {
    const { laserAir95 } = await import('../applications/fire95.ts');
    const a = shooter();
    assert.equal(laserAir95(a, 'none'), false);
    assert.equal(laserAir95(a, 'smoke'), true);
    a.weatherHere = () => 'lightRain';
    assert.equal(laserAir95(a, null), true);
    t.after(oldWay({ 'FIRE_V95.laser': 'off' }));
    assert.equal(laserAir95(a, 'smoke'), false);
  });
});

describe('v0.95.0 fire glue: two firearms (Core p. 90)', () => {
  const twoGunsFired = () => {
    combatOn();
    const a = shooter();
    const key = a.currentPhaseKey();
    a.flags[F] = { recoil: { phase: key, rounds: 3, firstSingle: false }, recoil95: { phase: key, guns: { w2: { rounds: 3, recoil: 2, firstSingle: false } } } };
    return a;
  };
  test('book: the second gun\'s single shot has no recoil of its own and takes the first gun\'s 2', () => {
    const a = twoGunsFired();
    const p = a.planAttack(pistol(), { mode: 'SA', sight: {}, situational: ['secondWeapon'] });
    assert.equal(mod(p, /^Recoil from the other gun$/)?.value, 2);
    assert.equal(mod(p, /^Recoil$/), undefined);
  });
  test('book: without the tick, and off: every round that phase is the firing gun\'s recoil, as before', (t) => {
    const a = twoGunsFired();
    const plain = a.planAttack(pistol(), { mode: 'SA', sight: {}, situational: [] });
    assert.equal(mod(plain, /^Recoil from the other gun$/), undefined);
    assert.ok(mod(plain, /^Recoil$/).value > 0);
    t.after(oldWay({ 'FIRE_V95.sharedRecoil': 'off' }));
    const off = a.planAttack(pistol(), { mode: 'SA', sight: {}, situational: ['secondWeapon'] });
    assert.equal(mod(off, /^Recoil from the other gun$/), undefined);
    assert.equal(mod(off, /^Recoil$/).value, mod(plain, /^Recoil$/).value);
  });
  test('book: a shot is remembered per gun: its rounds and the recoil it was left with', async () => {
    combatOn();
    const a = shooter([gun('w1'), gun('w2')]);
    a.useAction = async () => true;
    faces.push(2, 2, 2, 2);
    await a.attackWith(a.items.get('w1'), { mode: 'BF', sight: {}, situational: ['secondWeapon'] });
    const s = a.getFlag(F, 'recoil95');
    assert.equal(s.phase, a.currentPhaseKey());
    assert.equal(s.guns.w1.rounds, 3);
    assert.ok(s.guns.w1.recoil > 0);
    const second = a.planAttack(a.items.get('w2'), { mode: 'SA', sight: {}, situational: ['secondWeapon'] });
    assert.equal(mod(second, /^Recoil from the other gun$/).value, s.guns.w1.recoil);
    assert.equal(mod(second, /^Recoil$/), undefined);
    faces.push(2, 2, 2, 2);
    await a.attackWith(a.items.get('w2'), { mode: 'SA', sight: {}, situational: ['secondWeapon'] });
    assert.deepEqual(a.getFlag(F, 'recoil95').guns.w2, { rounds: 1, recoil: 0, firstSingle: true });
    assert.equal(a.getFlag(F, 'recoil').rounds, 4);                    // the old total still counts every round
  });
  test('off: nothing is remembered', async (t) => {
    t.after(oldWay({ 'FIRE_V95.sharedRecoil': 'off' }));
    combatOn();
    const a = shooter([gun('w1')]);
    a.useAction = async () => true;
    faces.push(2, 2, 2, 2);
    await a.attackWith(a.items.get('w1'), { mode: 'SA', sight: {} });
    assert.equal(a.getFlag(F, 'recoil95'), undefined);
  });
});

describe('v0.95.0 fire glue: an aim over several phases and pool dice (Core p. 82)', () => {
  const aiming = (began: string | null) => {
    combatOn();
    const a = shooter([gun('w1')]);
    const t = who({ name: 'Target' });
    a.flags[F] = { aim: { targetUuid: t.uuid, weaponId: 'w1', actions: 2, round: 1, combatId: 'c95', ...(began === null ? {} : { phase95: began || a.currentPhaseKey() }) } };
    return { a, t, w: a.items.get('w1') };
  };
  const aimed = (p: any) => mod(p, /^Aimed/)?.value;
  test('book: Combat Pool dice on the shot lose an aim begun in an earlier phase (the preview shows it)', () => {
    const { a, t, w } = aiming('c95:1:0:earlier');
    assert.equal(aimed(a.planAttack(w, { mode: 'SA', sight: {}, targetUuid: t.uuid })), -2);
    const p = a.planAttack(w, { mode: 'SA', sight: {}, targetUuid: t.uuid, poolDice: 1 });
    assert.equal(aimed(p), undefined);
    assert.ok(p.notes.includes('aim lost: pool dice used after aiming over several phases'));
  });
  test('book: an aim begun this phase, or saved before v0.95.0, keeps its bonus with pool dice; off: always', (t) => {
    const same = aiming('');
    assert.equal(aimed(same.a.planAttack(same.w, { mode: 'SA', sight: {}, targetUuid: same.t.uuid, poolDice: 2 })), -2);
    const old = aiming(null);
    assert.equal(aimed(old.a.planAttack(old.w, { mode: 'SA', sight: {}, targetUuid: old.t.uuid, poolDice: 2 })), -2);
    t.after(oldWay({ 'FIRE_V95.aimPool': 'off' }));
    const { a, t: tgt, w } = aiming('c95:1:0:earlier');
    assert.equal(aimed(a.planAttack(w, { mode: 'SA', sight: {}, targetUuid: tgt.uuid, poolDice: 2 })), -2);
  });
  test('takeAim stamps the phase the aim began in and keeps it while the aim is held', async () => {
    const { a, t } = aiming(null);
    a.flags[F] = {};
    a.useAction = async () => true;
    await a.takeAim('w1', t.uuid);
    const began = a.currentPhaseKey();
    assert.equal(a.getFlag(F, 'aim').phase95, began);
    g.game.combat.pass = 1;
    await a.takeAim('w1', t.uuid);
    assert.equal(a.getFlag(F, 'aim').actions, 2);
    assert.equal(a.getFlag(F, 'aim').phase95, began);
    assert.notEqual(a.currentPhaseKey(), began);
  });
  test('book: pool dice on a resistance test lose the aim held over phases, with a line in chat; off: the aim stays', async (t) => {
    const { a } = aiming('c95:1:0:earlier');
    faces.push(2, 2, 2, 2, 2);                                          // Body 4 + 1 pool die
    await a.resistDamage({ power: 4, level: 'L', poolDice: 1 });
    assert.equal(a.getFlag(F, 'aim'), undefined);
    assert.ok(chat.some((m) => /the aim is lost/.test(m.content)));
    const same = aiming('');
    faces.push(2, 2, 2, 2, 2);
    await same.a.resistDamage({ power: 4, level: 'L', poolDice: 1 });
    assert.equal(same.a.getFlag(F, 'aim').actions, 2);                  // begun this phase: kept
    t.after(oldWay({ 'FIRE_V95.aimPool': 'off' }));
    const off = aiming('c95:1:0:earlier');
    faces.push(2, 2, 2, 2, 2);
    await off.a.resistDamage({ power: 4, level: 'L', poolDice: 1 });
    assert.equal(off.a.getFlag(F, 'aim').actions, 2);
  });
});

describe('v0.95.0 fire glue: explosive rounds (Core p. 93)', () => {
  test('book: all ones: a misfire card with the normal round against the shooter, 1D6 successes, no Combat Pool', async () => {
    const a = shooter();
    const t = who({ name: 'Target' });
    faces.push(1, 1, 1, 1, 3);                                          // the attack: all ones; the 1D6: 3
    const r = await a.attackWith(pistol(), { mode: 'SA', sight: {}, ammoType: 'explosive', targetUuid: t.uuid });
    assert.equal(r.botch, true);
    const m = chat.at(-1);
    assert.match(m.content, /Predator: misfire/);
    assert.match(m.content, /data-sr2e-action="resist" data-index="0"/);
    const d = m.flags[F].damage;
    assert.deepEqual(d, { targetUuid: a.uuid, melee: false, damageType: 'physical', power: 9, level: 'M', noPool: true, cleanMiss80: { hits: 3, net: 3, noClean: true } });
    assert.deepEqual(m.flags[F].damages, [d]);
    faces.push(1, 1, 1, 1);                                             // Body 4 only, though 3 pool dice were asked for
    await a.resistFromState(d, 3);
    assert.equal(faces.length, 0);
    assert.equal(a.system.poolSpent.combat, 0);
    assert.equal(a.system.monitor.physical, 6);                         // 3 vs 0: M → S
  });
  test('book: normal rounds, or a roll that is not all ones: no card; off: none either', async (t) => {
    const a = shooter();
    faces.push(1, 1, 1, 1);
    await a.attackWith(pistol(), { mode: 'SA', sight: {} });
    assert.equal(chat.some((m) => /misfire/.test(m.content)), false);
    faces.push(1, 1, 1, 2);
    await a.attackWith(pistol(), { mode: 'SA', sight: {}, ammoType: 'explosive' });
    assert.equal(chat.some((m) => /misfire/.test(m.content)), false);
    t.after(oldWay({ 'FIRE_V95.misfire': 'off' }));
    faces.push(1, 1, 1, 1);
    await a.attackWith(pistol(), { mode: 'SA', sight: {}, ammoType: 'explosive' });
    assert.equal(faces.length, 0);
    assert.equal(chat.some((m) => /misfire/.test(m.content)), false);
  });
});

describe('v0.95.0 fire glue: shotgun shot (Core p. 95)', () => {
  const hit = (def: any, over: any = {}) => ({ targetUuid: def.uuid, melee: false, damageType: 'physical', power: 4, level: 'M', ...over });
  test('book: the extra dice are rolled with Body and named on the card; the number is bounded', async () => {
    const def = who();
    faces.push(2, 2, 2, 2, 2, 2);                                       // Body 4 + 2
    await def.resistFromState(hit(def, { screen95: 2 }), 0);
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /\+2 dice behind others in the spread/);
    faces.push(...Array(14).fill(2));                                   // Body 4 + 10 at the most
    await def.resistFromState(hit(def, { screen95: 500 }), 0);
    assert.equal(faces.length, 0);
  });
  test('book: an attack on a screened target carries the dice to its resistance (Defend)', async () => {
    const def = who();
    faces.push(2, 2, 2, 2, 2);                                          // Body 4 + 1
    await def.defend(shot(def, { screen95: 1 }), 0);
    assert.equal(faces.length, 0);
  });
  test('off: Body only', async (t) => {
    t.after(oldWay({ 'FIRE_V95.shotScreen': 'off' }));
    const def = who();
    faces.push(2, 2, 2, 2);
    await def.resistFromState(hit(def, { screen95: 2 }), 0);
    assert.equal(faces.length, 0);
    assert.doesNotMatch(chat.at(-1).content, /behind others/);
  });
  test('the Attack dialog: each hit gets one die per other target closer to the gun; attackWith carries it', async () => {
    const { screenHits95 } = await import('../applications/fire95.ts');
    const hits = screenHits95([{ targetUuid: 'a', powerDelta: -1 }, { targetUuid: 'b', powerDelta: 0 }, { targetUuid: 'c', powerDelta: -2 }],
      [{ uuid: 'b', metres: 3 }, { uuid: 'a', metres: 7 }, { uuid: 'c', metres: 12 }, { uuid: undefined, metres: 1 }]);
    assert.deepEqual(hits, [{ targetUuid: 'a', powerDelta: -1, screen95: 1 }, { targetUuid: 'b', powerDelta: 0 }, { targetUuid: 'c', powerDelta: -2, screen95: 2 }]);
    const a = shooter();
    const near = who({ name: 'Near' }), far = who({ name: 'Far' });
    faces.push(5, 5, 2, 2);
    await a.attackWith(pistol(), { mode: 'SA', sight: {}, hits: [{ targetUuid: near.uuid }, { targetUuid: far.uuid, screen95: 1 }] });
    const targets = chat.at(-1).flags[F].test.attackTargets;
    assert.equal(targets[0].screen95, undefined);
    assert.equal(targets[1].screen95, 1);
  });
});

describe('v0.95.0 fire glue: blast in a confined space (Core p. 98)', () => {
  const blast = { weaponName: 'Grenade', power: 10, level: 'S', damageType: 'physical', perMetre: 1, kind: 'offensive', successes: 2 };
  test('book: the rebound is added to that target\'s Power and named on its row', async () => {
    const thrower = who({ name: 'Thrower' });
    const a = who({ name: 'Cornered' }), b = who({ name: 'Open' });
    await thrower.postBlast({ ...blast, attackerUuid: thrower.uuid } as any,
      [{ targetUuid: a.uuid, name: 'Cornered', metres: 4, rebound95: 2 }, { targetUuid: b.uuid, name: 'Open', metres: 4 }], '');
    const m = chat.at(-1);
    assert.deepEqual(m.flags[F].damages.map((d: any) => d.power), [8, 6]);
    assert.match(m.content, /Cornered: <strong>8S<\/strong> \(\+2 rebound\)/);
    assert.doesNotMatch(m.content, /Open: <strong>6S<\/strong> \(/);
  });
  test('nearest (v0.94.2): a rebound on the hit is ignored', async (t) => {
    t.after(oldWay({ 'FIRE_V95.rebound': 'nearest' }));
    const thrower = who({ name: 'Thrower' });
    const a = who({ name: 'Cornered' });
    await thrower.postBlast({ ...blast, attackerUuid: thrower.uuid } as any, [{ targetUuid: a.uuid, name: 'Cornered', metres: 4, rebound95: 2 }], '');
    assert.equal(chat.at(-1).flags[F].damages[0].power, 6);
  });
  test('the canvas: walls on the line through the blast and the token, past it and behind the blast', async (t) => {
    const { rebound95 } = await import('../applications/fire95.ts');
    const ctx = { power: 10, perMetre: 1 };
    const tok = token(who({ name: 'Cornered' }), 400, 0);              // 4 m east of the blast
    stage([tok], [wall([600, -500, 600, 500], 8)]);                     // a wall 6 m east: 4 Power there, rated 8: holds
    t.after(() => { delete g.canvas; });
    assert.deepEqual(rebound95({ x: 0, y: 0 }, tok, ctx, false), { rebound95: 2 });
    assert.deepEqual(rebound95({ x: 0, y: 0 }, tok, ctx, true), {});   // a wall between them: shielded, no rebound
    stage([tok], [wall([600, -500, 600, 500], 2)]);                     // rated 2: the blast breaks it
    assert.deepEqual(rebound95({ x: 0, y: 0 }, tok, ctx, false), {});
    stage([tok], [wall([-100, -500, -100, 500], null)]);                // an unrated wall 1 m behind the blast: holds
    assert.deepEqual(rebound95({ x: 0, y: 0 }, tok, ctx, false), { rebound95: 4 });     // back after 1 + 1 + 4 = 6 m
    stage([tok], [wall([600, 100, 600, 500], 8)]);                      // off the line
    assert.deepEqual(rebound95({ x: 0, y: 0 }, tok, ctx, false), {});
    const undo = oldWay({ 'FIRE_V95.rebound': 'nearest' });
    stage([tok], [wall([600, -500, 600, 500], 8)]);
    assert.deepEqual(rebound95({ x: 0, y: 0 }, tok, ctx, false), {});
    undo();
  });
});

describe('v0.95.0 fire glue: stray shots (Core p. 93, optional)', () => {
  const smg = (over: any = {}) => ({ id: 'w9', type: 'weapon', name: 'SMG', system: { melee: false, modes: 'FA', skill: 'Pistols', damagePower: 6, damageLevel: 'M', damageType: 'physical', ammo: 30, ammoMax: 30, recoilComp: 0, range: { short: 10, medium: 40, long: 80, extreme: 150 }, ...over } });
  const player = () => ({ id: 'p1', name: 'Player', isGM: false });
  const scene = (gunOver: any = {}) => {
    const a = who({ name: 'Shooter' }, [skill('s1', 'Pistols', 4), smg(gunOver)]);
    a.weaponById = (id: string) => a.items.get(id);
    const t1 = who({ name: 'First' }), t2 = who({ name: 'Second' }), mid = who({ name: 'Between' }), out = who({ name: 'Behind' });
    const from = token(a, 0, 0), k1 = token(t1, 1000, 0), k2 = token(t2, 0, 1000), km = token(mid, 500, 500), ko = token(out, -500, 0);
    for (const [act, tk] of [[a, from], [t1, k1], [t2, k2], [mid, km], [out, ko]] as const) act.getActiveTokens = () => [tk];
    stage([from, k1, k2, km, ko]);
    return { a, from, k1, k2, t1, t2, mid };
  };
  test('ships off: no card', async (t) => {
    const { strayCard95 } = await import('../applications/fire95.ts');
    t.after(() => { delete g.canvas; });
    const { a, from, k1, k2 } = scene();
    await strayCard95(a, a.items.get('w9'), { from, targets: [k1, k2], wasted: 4, smartlinked: false });
    assert.equal(chat.length, 0);
  });
  test('book: the shooter\'s card names nobody in the way (only the GM\'s client looks), and carries only uuids', async (t) => {
    const { strayCard95 } = await import('../applications/fire95.ts');
    t.after(oldWay({ 'FIRE_V95.stray': 'book' }));
    t.after(() => { delete g.canvas; });
    const { a, from, k1, k2, t1, t2 } = scene();
    await strayCard95(a, a.items.get('w9'), { from, targets: [k1, k2], wasted: 4, smartlinked: true });
    assert.equal(chat.length, 0);                                       // a smartlinked smartgun: never
    await strayCard95(a, a.items.get('w9'), { from, targets: [k1, k2], wasted: 4, smartlinked: false, opts: { ammoType: 'explosive' } });
    const m = chat.at(-1);
    assert.doesNotMatch(m.content, /Between|Behind/);
    assert.match(m.content, /4 rounds may have strayed/);
    assert.match(m.content, /data-sr2e-action="strayList95"/);
    assert.deepEqual(m.flags[F].strayAsk95, { attackerUuid: a.uuid, weaponId: 'w9', ammoType: 'explosive', targets: [t1.uuid, t2.uuid] });
  });
  test('book: the GM\'s list: worked out again on the GM\'s canvas, posted as the GM\'s whisper, once per card', async (t) => {
    const { onStrayList95 } = await import('../applications/fire95.ts');
    t.after(oldWay({ 'FIRE_V95.stray': 'book' }));
    t.after(() => { delete g.canvas; delete g.game.messages.contents; g.game.messages = { contents: [] }; });
    const { a, t1, t2, mid } = scene();
    const ask = card({ strayAsk95: { attackerUuid: a.uuid, weaponId: 'w9', ammoType: '', targets: [t1.uuid, t2.uuid] } });
    g.game.messages = { contents: chat };
    await onStrayList95(ask, button());
    const m = chat.at(-1);
    assert.deepEqual(m.whisper, ['gm1']);
    const f = m.flags[F].stray95;
    assert.equal(f.source, ask.id);
    assert.equal(f.rounds, 10);                                         // the 14.1 m gap, worked out again: 10 wasted (capped)
    assert.deepEqual(f.rows, [{ uuid: mid.uuid, name: 'Between', tn: 4 }]);            // 7.1 m with an SMG: short range
    assert.deepEqual([f.power, f.level, f.damageType], [6, 'M', 'physical']);
    assert.match(m.content, /Between \(7\.1 m\): 2 dice vs TN 4 <button type="button" data-sr2e-action="stray95" data-index="0">/);
    assert.doesNotMatch(m.content, /Behind/);
    m.author = GM();                                                    // Foundry sets the author (the stub doesn't)
    const n = chat.length;
    await onStrayList95(ask, button());                                 // listed already
    assert.equal(chat.length, n);
    assert.equal(warnings.length, 1);
  });
  test('the GM\'s list: a smartlinked smartgun strays nothing (from the documents, not the card); a player can\'t list', async (t) => {
    const { onStrayList95 } = await import('../applications/fire95.ts');
    t.after(oldWay({ 'FIRE_V95.stray': 'book' }));
    t.after(() => { delete g.canvas; });
    const { a, t1, t2 } = scene({ smartgun: true });
    a.system.derived.smartlink = true;
    const ask = card({ strayAsk95: { attackerUuid: a.uuid, weaponId: 'w9', targets: [t1.uuid, t2.uuid] } });
    await onStrayList95(ask, button());
    assert.equal(chat.length, 0);
    g.game.user = player();
    await onStrayList95(card({ strayAsk95: { attackerUuid: a.uuid, weaponId: 'w9', targets: [t1.uuid, t2.uuid] } }), button());
    assert.equal(chat.length, 0);
  });
  test('the GM\'s list: a player\'s card for a shooter they don\'t own is refused', async (t) => {
    const { onStrayList95 } = await import('../applications/fire95.ts');
    t.after(oldWay({ 'FIRE_V95.stray': 'book' }));
    t.after(() => { delete g.canvas; });
    const { a, t1, t2 } = scene();
    await onStrayList95(card({ strayAsk95: { attackerUuid: a.uuid, weaponId: 'w9', targets: [t1.uuid, t2.uuid] } }, player()), button());
    assert.equal(chat.length, 0);
  });
  test('the Roll button (GM): a hit posts the damage with the successes + 1D6; each person once, at most the stray rounds', async (t) => {
    const { onStray95 } = await import('../applications/fire95.ts');
    t.after(oldWay({ 'FIRE_V95.stray': 'book' }));
    const a = shooter();
    const by = who({ name: 'Between' }), other = who({ name: 'Other' });
    const m = card({ stray95: { attackerUuid: a.uuid, weaponName: 'SMG', rounds: 1, power: 6, level: 'M', damageType: 'physical', extra: {}, rows: [{ uuid: by.uuid, name: 'Between', tn: 4 }, { uuid: other.uuid, name: 'Other', tn: 5 }] } });
    faces.push(5, 2, 4);                                                // 1 success; 1D6: 4
    await onStray95(m, button(0));
    const out = chat.at(-1);
    assert.match(out.content, /Hit, with 5 attack successes/);
    assert.deepEqual(out.flags[F].damage, { targetUuid: by.uuid, melee: false, damageType: 'physical', power: 6, level: 'M', cleanMiss80: { hits: 5, net: 5 } });
    assert.deepEqual(m.getFlag(F, 'stray95Used'), [0]);
    const n = chat.length;
    await onStray95(m, button(0));                                      // the same person again
    await onStray95(m, button(1));                                      // no stray rounds left
    assert.equal(chat.length, n);
    assert.equal(warnings.length, 2);
  });
  test('the Roll button: a miss posts no damage; a player can\'t roll; a list a player posted is refused (its used marks are theirs)', async (t) => {
    const { onStray95 } = await import('../applications/fire95.ts');
    t.after(oldWay({ 'FIRE_V95.stray': 'book' }));
    const a = shooter();
    const by = who({ name: 'Between' });
    const flags = () => ({ stray95: { attackerUuid: a.uuid, weaponName: 'SMG', rounds: 9, power: 6, level: 'M', damageType: 'physical', rows: [{ uuid: by.uuid, name: 'Between', tn: 4 }] } });
    faces.push(2, 3);
    await onStray95(card(flags()), button(0));
    assert.match(chat.at(-1).content, /The round misses/);
    assert.equal(chat.at(-1).flags, undefined);
    const n = chat.length;
    g.game.user = player();
    await onStray95(card(flags()), button(0));
    g.game.user = GM();
    await onStray95(card({ stray95: { ...flags().stray95, power: 9999 } }, player()), button(0));
    assert.equal(chat.length, n);
    assert.equal(faces.length, 0);
  });
});

describe('v0.95.0 fire glue: suppressive fire the Fields of Fire way (FoF p. 78, optional)', () => {
  const lmg = () => gun('w1', { modes: 'FA', damagePower: 7, damageLevel: 'S', ammo: 30, ammoMax: 30 });
  const fofCombat = (over: any = {}) => combatOn({ turn: 0, turns: [{}, {}, {}], ...over });
  const at = { combatId: 'c95', round: 1, pass: 0, turn: 0 };
  const supp = (a: any, over: any = {}) => ({ suppress95: { at, attackerUuid: a.uuid, weaponName: 'LMG', rounds: 10, metres: 2, perMetre: 5, power: 7, level: 'S', damageType: 'physical', extra: {}, ...over } });
  test('ships the house way: the Suppress button is not taken over', async () => {
    const { suppressFof95 } = await import('../applications/fire95.ts');
    const a = shooter([lmg()]);
    assert.equal(await suppressFof95(a, 'w1'), false);
    assert.equal(chat.length, 0);
  });
  test('fof: rounds and width asked, the action and the rounds spent, a card with the GM button and when it was laid', async (t) => {
    const { suppressFof95 } = await import('../applications/fire95.ts');
    t.after(oldWay({ 'FIRE_V95.suppression': 'fof' }));
    fofCombat({ round: 2, pass: 1, turn: 2 });
    const a = shooter([lmg()]);
    a.weaponById = (id: string) => a.items.get(id);
    const used: string[] = [];
    a.useAction = async (k: string) => { used.push(k); return true; };
    g.foundry.applications.api.DialogV2.prompt = async () => ({ rounds: 8, metres: 4 });
    t.after(() => { g.foundry.applications.api.DialogV2.prompt = async () => null; });
    assert.equal(await suppressFof95(a, 'w1'), true);
    assert.deepEqual(used, ['suppress']);
    assert.equal(a.items.get('w1').system.ammo, 22);
    const m = chat.at(-1);
    assert.match(m.content, /8 rounds over 4 m \(2 per metre\) for 10 Combat Phases/);
    assert.match(m.content, /data-sr2e-action="suppress95"/);
    assert.deepEqual(m.flags[F].suppress95, { at: { combatId: 'c95', round: 2, pass: 1, turn: 2 }, attackerUuid: a.uuid, weaponName: 'Predator', rounds: 8, metres: 4, perMetre: 2, power: 7, level: 'S', damageType: 'physical', extra: {} });
  });
  test('fof: an uneven split, no running combat, no full auto, a closed dialog: refused, nothing spent', async (t) => {
    const { suppressFof95 } = await import('../applications/fire95.ts');
    t.after(oldWay({ 'FIRE_V95.suppression': 'fof' }));
    const a = shooter([gun('w1'), gun('w2', { modes: 'FA', ammo: 30, ammoMax: 30 })]);
    a.weaponById = (id: string) => a.items.get(id);
    a.useAction = async () => true;
    assert.equal(await suppressFof95(a, 'w1'), true);                   // no full auto
    assert.equal(await suppressFof95(a, 'w2'), true);                   // the stub's prompt answers null
    g.foundry.applications.api.DialogV2.prompt = async () => ({ rounds: 10, metres: 3 });
    t.after(() => { g.foundry.applications.api.DialogV2.prompt = async () => null; });
    fofCombat();
    assert.equal(await suppressFof95(a, 'w2'), true);                   // 10 over 3 m: uneven
    assert.match(warnings.at(-1)!, /don't spread evenly/);
    delete g.game.combat;
    g.foundry.applications.api.DialogV2.prompt = async () => ({ rounds: 9, metres: 3 });
    assert.equal(await suppressFof95(a, 'w2'), true);                   // no combat
    assert.match(warnings.at(-1)!, /running combat/);
    assert.equal(a.items.get('w2').system.ammo, 30);
    assert.equal(chat.length, 0);
    assert.equal(warnings.length, 3);
  });
  test('the card\'s button (GM): the targeted tokens are tested: dice per metre vs 4 + cover + wounds, a hit per 2 successes', async (t) => {
    const { onSuppress95 } = await import('../applications/fire95.ts');
    fofCombat();
    const a = shooter();
    const out = who({ name: 'Exposed' });
    const m = card(supp(a));
    await onSuppress95(m, button());
    assert.equal(warnings.length, 1);                                   // nobody targeted
    g.game.user = { ...GM(), targets: new Set([token(out, 300, 0)]) };
    g.foundry.applications.api.DialogV2.prompt = async () => 4;        // partial cover
    t.after(() => { g.foundry.applications.api.DialogV2.prompt = async () => null; });
    faces.push(6, 6, 6, 6, 1, 2, 2, 2, 2);                              // TN 8: four 6s re-rolled 2: 4 successes
    await onSuppress95(m, button());
    assert.equal(faces.length, 0);
    const c = chat.at(-1);
    assert.match(c.content, /Exposed: 5 dice vs TN 8, 4 successes\. <strong>2 rounds hit\.<\/strong>/);
    assert.equal(c.flags[F].damages.length, 2);
    assert.deepEqual(c.flags[F].damages[0], { targetUuid: out.uuid, melee: false, damageType: 'physical', power: 7, level: 'S' });
    faces.push(1, 2, 3, 2, 1);                                          // TN 4 (no cover): none
    g.foundry.applications.api.DialogV2.prompt = async () => 0;
    await onSuppress95(m, button());
    assert.match(chat.at(-1).content, /0 successes\. <strong>0 rounds hit\.<\/strong>/);
    assert.equal(chat.at(-1).flags, undefined);
    g.game.user = { id: 'p1', name: 'Player', isGM: false, targets: new Set([token(out, 300, 0)]) };
    const n = chat.length;
    await onSuppress95(m, button());
    assert.equal(chat.length, n);                                       // a player can't
  });
  test('the card\'s button: after 10 Combat Phases, in another combat, or with none, the fire is over', async () => {
    const { onSuppress95 } = await import('../applications/fire95.ts');
    const a = shooter();
    const out = who({ name: 'Exposed' });
    g.game.user = { ...GM(), targets: new Set([token(out, 300, 0)]) };
    for (const now of [{ round: 4, pass: 0, turn: 1 }, { id: 'other' }, { started: false }]) {
      fofCombat(now);
      await onSuppress95(card(supp(a)), button());
    }
    fofCombat();
    await onSuppress95(card(supp(a, { at: null })), button());           // a card without its start
    assert.equal(chat.length, 0);
    assert.equal(warnings.filter((w) => /suppressive fire is over/.test(w)).length, 4);
    fofCombat({ round: 3, pass: 0, turn: 2 });                          // 3 + 3 + 2 = 8 phases: still on (the stub's prompt cancels)
    await onSuppress95(card(supp(a)), button());
    assert.equal(warnings.filter((w) => /suppressive fire is over/.test(w)).length, 4);
  });
  test('the card\'s button: a player\'s card is refused for a shooter they don\'t own (a forged attacker), and needs the GM\'s yes otherwise', async (t) => {
    const { onSuppress95 } = await import('../applications/fire95.ts');
    fofCombat();
    const a = shooter();
    const out = who({ name: 'Exposed' });
    g.game.user = { ...GM(), targets: new Set([token(out, 300, 0)]) };
    let asked = 0;
    g.foundry.applications.api.DialogV2.confirm = async () => { asked++; return false; };
    t.after(() => { g.foundry.applications.api.DialogV2.confirm = async () => false; });
    await onSuppress95(card(supp(a), { id: 'p1', name: 'Player', isGM: false }), button());
    assert.equal(asked, 0);                                             // refused before any dialog: they don't own the shooter
    assert.match(warnings.at(-1)!, /Player/);
    a.ownership = { default: 0, p1: 3 };
    g.game.users = Object.assign([GM(), { id: 'p1', name: 'Player', isGM: false }], { activeGM: { id: 'gm1', isSelf: true }, get: (id: string) => (id === 'p1' ? { id: 'p1', name: 'Player', isGM: false } : GM()) });
    t.after(() => { g.game.users = Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } }); });
    await onSuppress95(card(supp(a), { id: 'p1', name: 'Player', isGM: false }), button());
    assert.equal(asked, 1);                                             // their own shooter: the GM is asked (and says no)
    assert.equal(chat.length, 0);
  });
});

describe('v0.95.0 fire glue: the review fixes', () => {
  test('two guns with walking fire: the wasted rounds count once in the gun\'s record', async () => {
    combatOn();
    const a = shooter([gun('w1', { modes: 'FA', ammo: 30, ammoMax: 30 }), gun('w2')]);
    a.useAction = async () => true;
    faces.push(...Array(10).fill(2));
    await a.attackWith(a.items.get('w1'), { mode: 'FA', rounds: 5, wastedRounds: 3, sight: {}, situational: ['secondWeapon'] });
    assert.equal(a.getFlag(F, 'recoil95').guns.w1.rounds, 8);
    assert.equal(a.getFlag(F, 'recoil').rounds, 8);                     // the same count as the old total
    const p = a.planAttack(a.items.get('w2'), { mode: 'SA', sight: {}, situational: ['secondWeapon'] });
    assert.equal(mod(p, /^Recoil$/), undefined);                        // the second gun's own first shot: no recoil
    faces.length = 0;
  });
  test('the misfire card says a re-roll or an avoided disaster cancels it', async () => {
    const a = shooter();
    faces.push(1, 1, 1, 1, 3);
    await a.attackWith(pistol(), { mode: 'SA', sight: {}, ammoType: 'explosive' });
    assert.match(chat.at(-1).content, /Karma re-roll or an avoided disaster/);
  });
  test('the shot cone\'s main target is measured centre to centre along the line, like the others', async (t) => {
    const { alongLine95 } = await import('../applications/fire95.ts');
    stage([]);
    t.after(() => { delete g.canvas; });
    const from = { center: { x: 0, y: 0 } }, to = { center: { x: 600, y: 0 } };
    assert.equal(alongLine95(from, to, to), 6);
    assert.equal(alongLine95(from, to, { center: { x: 600, y: 200 } }), 6);   // level with the target: not in front
    assert.equal(alongLine95(from, to, { center: { x: 300, y: 50 } }), 3);
    assert.equal(alongLine95(from, from, to), null);
  });
  test('rebound: a wall damaged to 0 holds nothing; with walls not stopping blasts, none rebounds', async (t) => {
    const { rebound95 } = await import('../applications/fire95.ts');
    const ctx = { power: 10, perMetre: 1 };
    const tok = token(who({ name: 'Cornered' }), 400, 0);
    t.after(() => { delete g.canvas; });
    const broken = { document: { c: [600, -500, 600, 500], move: 1, flags: { [F]: { barrierRating: 0, barrierFull: 8 } }, getFlag: (_s: string, k: string) => (k === 'barrierRating' ? 0 : k === 'barrierFull' ? 8 : null) } };
    stage([tok], [broken]);
    assert.deepEqual(rebound95({ x: 0, y: 0 }, tok, ctx, false), {});
    stage([tok], [wall([600, -500, 600, 500], 8)]);
    assert.deepEqual(rebound95({ x: 0, y: 0 }, tok, ctx, false), { rebound95: 2 });
    t.after(oldWay({ 'COMBAT.wallsBlock': false }));
    assert.deepEqual(rebound95({ x: 0, y: 0 }, tok, ctx, false), {});
  });
  test('detonateAt end to end: the cornered target\'s card row carries the rebound; the old way adds the nearest-wall share instead', async (t) => {
    const { detonateAt } = await import('../applications/chat.ts');
    const thrower = who({ name: 'Thrower' });
    const cornered = who({ name: 'Cornered' }), open = who({ name: 'Open' });
    stage([token(cornered, 400, 0), token(open, 0, 400)], [wall([600, -50, 600, 50], 8)]);
    t.after(() => { delete g.canvas; });
    const ctx: any = { attackerUuid: thrower.uuid, weaponName: 'Grenade', power: 10, level: 'S', damageType: 'physical', perMetre: 1, kind: 'offensive', successes: 0 };
    await detonateAt(thrower, ctx, { x: 0, y: 0 }, '');
    const m = chat.at(-1);
    const byName = Object.fromEntries(m.flags[F].damages.map((d: any) => [d.targetUuid === cornered.uuid ? 'c' : 'o', d.power]));
    assert.deepEqual(byName, { c: 8, o: 6 });                           // 6 passing + 2 back off the wall; 6 in the open
    assert.match(m.content, /\(\+2 rebound\)/);
    chat.length = 0;
    t.after(oldWay({ 'FIRE_V95.rebound': 'nearest' }));
    await detonateAt(thrower, ctx, { x: 0, y: 0 }, '');
    assert.deepEqual(chat.at(-1).flags[F].damages.map((d: any) => d.power), [6, 6]);   // no 8-ray walls on the stub: no confined share
    assert.doesNotMatch(chat.at(-1).content, /rebound/);
  });
});

describe('v0.95.0 fire glue: the wiring', () => {
  // The Attack dialog and the chat dispatch are not exported (no stubbed render): their small hooks are checked as
  // source; everything they call is exercised above.
  test('chat.ts dispatches the three GM buttons; sheets.ts calls the dialog hooks', async () => {
    const { readFileSync } = await import('node:fs');
    const src = (f: string) => readFileSync(new URL(`../applications/${f}`, import.meta.url), 'utf8');
    const chatSrc = src('chat.ts'), sheets = src('sheets.ts');
    for (const a of ['stray95', 'strayList95', 'suppress95']) assert.ok(new RegExp(`else if \\(action === '${a}'\\) return on[A-Za-z0-9]+\\(message, button\\);`).test(chatSrc), a);
    for (const call of ['laserAir95(actor, h.smoke?.kind)', 'screenHits95([', 'alongLine95(fromToken, to, to)', 'strayCard95(actor, weapon,', 'suppressFof95(this.document,']) assert.ok(sheets.includes(call), call);
  });
});
