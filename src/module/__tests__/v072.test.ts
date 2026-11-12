/**
 * v0.72.0: the occasional and rare items from the v0.69.0 review (docs/REVIEW-v0.69.md, section 3, O1–O21), the
 * Foundry glue side (documents/index.ts, models, helpers/initiative.ts, applications/regions.ts). The pure rules
 * are in rules/__tests__/v072combat.test.ts, v072health.test.ts and v072magic.test.ts. The stubs are a copy of
 * v071.test.ts's (scripted dice, a chat log of message objects with getFlag, warnings). These check OUR wiring,
 * not that Foundry behaves as the stubs do.
 */
import { test, describe, before, beforeEach, after } from 'node:test';
import { SORCERY_V922 } from '../rules/__tests__/sorcery922.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import assert from 'node:assert/strict';
import { RULES, initiativeWoundPenalty } from '../rules/index.ts';
import { initiativeFormula } from '../helpers/initiative.ts';

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

let CharacterDataModel: any, SpiritDataModel: any, SR2Actor: any;
let regions: typeof import('../applications/regions.ts');

const GM = () => ({ id: 'gm1', name: 'GM', isGM: true, can: () => true });
const PLAYER = () => ({ id: 'p1', name: 'Corvo', isGM: false, can: () => false });

/** A chat message as Foundry gives it back: an id and getFlag. */
const asMessage = (d: any) => ({ id: `m${++mid}`, timestamp: mid, ...d, getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; } });

before(async () => {
  // As in glue.test.ts and v071.test.ts: rules that add steps or prompts are off unless a test turns them on.
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
  ({ CharacterDataModel, SpiritDataModel } = await import('../models/index.ts'));
  ({ SR2Actor } = await import('../documents/index.ts'));
  g.CONFIG = { Actor: { documentClass: SR2Actor } };
  regions = await import('../applications/regions.ts');
});

beforeEach(() => {
  faces.length = 0; chat.length = 0; warnings.length = 0; infos.length = 0; created.length = 0; settings = {};
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
  const { name, type, ...rest } = extra;
  Object.assign(sys, {
    essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 30, career: 30 }, metamagic: {}, initiateGrade: 0,
    nuyen: 0, sustaining: [], drugs: [], geasa: [], ledger: [], recovering: [], diseases: [], care: { stabilised: false, dyingSince: -1 }, contacts: [],
    addictions: [], anchored: [], qualities: [], lifestyle: { level: 'low', paidUntil: -1 },
    poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, monitor: { physical: 0, stun: 0 }, rigging: { vehicleUuid: '', jumpedIn: false, subscribed: [] }, ...rest,
  });
  const a = new SR2Actor();
  a.system = sys;
  a.name = name ?? 'Runner'; a.type = type ?? 'character';
  a.uuid = `Actor.v72-${++n}`; a.id = `id${n}`;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness', more: any = {}) => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, ...more } });

/** A spirit on the real data model (as v070.test.ts's). */
function spirit(o: any = {}): any {
  const sys = Object.create(SpiritDataModel.prototype);
  sys.attributes = Object.fromEntries(Object.keys(A).map((k) => [k, { base: 0, mod: 0 }]));
  Object.assign(sys, {
    essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 0 }, sustaining: [],
    poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 }, astral: 'physical', materialized: true,
    force: 4, spiritKind: 'nature', spiritType: '', services: 1, summonerUuid: '', immuneNormalWeapons: true,
    offsets: Object.fromEntries(Object.keys(A).map((k) => [k, 0])), ...(o.system ?? {}),
  });
  sys.prepareDerivedData();
  const s = new SR2Actor();
  Object.assign(s, { system: sys, type: 'spirit', name: o.name ?? 'Spirit', uuid: `Actor.v72spirit-${++n}`, id: `sp${n}`, statuses: new Set<string>() });
  s.items = withGet([...(o.items ?? [])]);
  sys.parent = s;
  uuidRegistry.set(s.uuid, s);
  return s;
}

/** Run with a RULES path changed, put back afterwards. */
async function withRule<T>(obj: any, key: string, value: unknown, fn: () => T | Promise<T>): Promise<T> {
  const prev = obj[key];
  obj[key] = value;
  try { return await fn(); } finally { obj[key] = prev; }
}

const sumOf = (mods: any[]) => mods.reduce((s, m) => s + (Number(m.value) || 0), 0);
const bio = (id: string, name: string, bioKind: string, rating: number, bodyIndex = 0.4) => ({ id, type: 'cyberware', name,
  system: { bioware: true, bioKind, rating, bodyIndex, installed: true, essenceCost: 0, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0 } });
const spellItem = (id: string, name: string, sys: any = {}) => ({ id, name, type: 'spell', system: { category: 'combat', spellType: 'mana', learnedForce: 4, damageLevel: 'M', damageType: 'stun',
  targetNumber: 4, drainModifier: 0, drainLevel: 'M', duration: 'instant', resist: 'none', heals: false, healTrack: 'physical', exclusive: false, fetish: false,
  elemental: false, element: '', area: false, ...sys } });

// =============================================================================================== Combat and gear

describe('O1 postBlast takes the walls\' Power loss and armor', () => {
  const ctx = (a: any) => ({ attackerUuid: a.uuid, weaponName: 'Grenade', power: 10, level: 'S', damageType: 'physical', perMetre: 1, point: { x: 0, y: 0, elevation: 0 }, dodge: false, kind: 'offensive' });

  test('barrierLoss comes off the Power; barrierArmor rides on the damage as extraArmor; a hit the wall eats is left out', async () => {
    const a = who({ name: 'Grenadier' });
    await a.postBlast(ctx(a), [
      { targetUuid: 'Actor.x1', name: 'Behind glass', metres: 3, barrierLoss: 2 },
      { targetUuid: 'Actor.x2', name: 'Behind a door', metres: 2, barrierArmor: 3 },
      { targetUuid: 'Actor.x3', name: 'Behind concrete', metres: 4, barrierLoss: 8 },
      { targetUuid: 'Actor.x4', name: 'In the open', metres: 1 },
    ], 'On target.');
    const d = chat.at(-1).flags.sr2e.damages;
    assert.deepEqual(d.map((x: any) => x.targetUuid), ['Actor.x1', 'Actor.x2', 'Actor.x4']);
    assert.equal(d[0].power, 5);                                         // 10 − 3 m − 2 lost to the wall
    assert.equal(d[0].extraArmor, undefined);
    assert.equal(d[1].power, 8);
    assert.equal(d[1].extraArmor, 3);
    assert.equal(d[2].power, 9);
  });

  test('the extraArmor on a blast card counts when it is resisted', async () => {
    const a = who({ name: 'Grenadier' });
    const t = who({ name: 'Target' });
    await a.postBlast(ctx(a), [{ targetUuid: t.uuid, name: 'T', metres: 2, barrierArmor: 3 }], 'On target.');
    const dmg = chat.at(-1).flags.sr2e.damages[0];
    faces.push(1, 1, 1, 1);
    await t.resistFromState(dmg, 0);
    assert.match(chat.at(-1).content, /Resist 8S physical, armor 3/);
  });
});

describe('O2 Take Aim lasts across Combat Turns; the cap is by the rating rolled', () => {
  const setup = () => {
    g.game.combat = { id: 'c1', started: true, round: 1, combatants: [] };
    const a = who({ name: 'Shooter' }, [
      skill('pis', 'Pistols', 2, 'quickness', { specialization: 'Ares Predator', specializationRating: 4 }),
      { id: 'w1', type: 'weapon', name: 'Ares Predator', system: { melee: false, skill: 'Pistols', specialization: 'Ares Predator', damagePower: 9, damageLevel: 'M', damageType: 'physical', modes: 'SA', ammo: 10, ammoMax: 10, recoilComp: 0 } },
    ]);
    a.useAction = async () => true;
    const t = who({ name: 'Target' });
    return { a, t };
  };

  test('takeAim: aims add up into the next Combat Turn, capped by half the specialization (4 → 2)', async () => {
    const { a, t } = setup();
    assert.equal(await a.takeAim('w1', t.uuid), 1);
    assert.equal(await a.takeAim('w1', t.uuid), 2);
    g.game.combat.round = 2;
    assert.equal(await a.takeAim('w1', t.uuid), 2);                     // 3 actions, capped at 2
    assert.equal(a.getFlag('sr2e', 'aim').actions, 3);
    assert.match(chat.at(-1).content, /−2 TN on the next attack \(at the most\)/);
  });

  test("switched off: the aim is lost at a new Combat Turn; capBy 'base' caps by the base skill (2 → 1)", async () => {
    const { a, t } = setup();
    await withRule(RULES.COMBAT_V72.aim, 'keepAcrossTurns', false, async () => {
      await a.takeAim('w1', t.uuid);
      g.game.combat.round = 2;
      assert.equal(await a.takeAim('w1', t.uuid), 1);
      assert.equal(a.getFlag('sr2e', 'aim').actions, 1);
    });
    await withRule(RULES.COMBAT_V72.aim, 'capBy', 'base', async () => {
      await a.takeAim('w1', t.uuid);
      assert.equal(await a.takeAim('w1', t.uuid), 1);
    });
  });

  test('planAttack: the aim modifier is capped by the specialization when it is used, else by the base skill', async () => {
    const { a, t } = setup();
    await a.takeAim('w1', t.uuid);
    await a.takeAim('w1', t.uuid);
    g.game.combat.round = 2;                                             // held into the next turn
    const w = a.items.get('w1');
    const aimed = (p: any) => p.modifiers.find((m: any) => /^Aimed/.test(m.label));
    assert.equal(aimed(a.planAttack(w, { range: 'short', targetUuid: t.uuid, sight: {}, useSpecialization: true })).value, -2);
    assert.equal(aimed(a.planAttack(w, { range: 'short', targetUuid: t.uuid, sight: {} })).value, -1);
    await withRule(RULES.COMBAT_V72.aim, 'keepAcrossTurns', false, () => {
      assert.equal(aimed(a.planAttack(w, { range: 'short', targetUuid: t.uuid, sight: {}, useSpecialization: true })), undefined);
    });
  });
});

describe('O3 immunity to normal weapons stops a weak attack', () => {
  const hit = (s: any, over: any = {}) => ({ targetUuid: s.uuid, melee: false, damageType: 'physical', power: 6, level: 'M', ...over });

  test('Power at or under the immunity armor: shrugged off, no dice, no boxes', async () => {
    const s = spirit({ name: 'Storm spirit' });                          // Force 4: immunity armor 8
    assert.equal(s.armorRating('ballistic'), 8);
    await s.resistFromState(hit(s, { power: 8 }), 0);
    assert.match(chat.at(-1).content, /Storm spirit<\/strong> shrugs it off: Power 8 doesn't beat its immunity to normal weapons \(8\)/);
    assert.equal(s.system.monitor.physical, 0);
  });

  test('a stronger attack, an ignoreImmunity (magical) weapon, or an elemental one is resisted as before', async () => {
    const s = spirit({ name: 'Storm spirit' });
    faces.push(...Array(30).fill(1));
    await s.resistFromState(hit(s, { power: 9 }), 0);
    assert.doesNotMatch(chat.at(-1).content, /shrugs it off/);
    assert.match(chat.at(-1).content, /Resist 9M physical/);
    await s.resistFromState(hit(s, { power: 6, ignoreImmunity: true }), 0);
    assert.doesNotMatch(chat.at(-1).content, /shrugs it off/);
    assert.match(chat.at(-1).content, /Resist 6M physical/);
    await s.resistFromState(hit(s, { power: 6, elemental: true }), 0);
    assert.doesNotMatch(chat.at(-1).content, /shrugs it off/);
  });

  test('switched off (stopsWeak false): it only adds armor', async () => {
    const s = spirit({ name: 'Storm spirit' });
    faces.push(...Array(30).fill(1));
    await withRule(RULES.COMBAT_V72.immunity, 'stopsWeak', false, () => s.resistFromState(hit(s, { power: 8 }), 0));
    assert.doesNotMatch(chat.at(-1).content, /shrugs it off/);
    assert.match(chat.at(-1).content, /Resist 8M physical, armor 8/);
  });
});

describe('O4 a called shot at a gap bypasses worn armor only', () => {
  const sam = () => who({ name: 'Pell' }, [
    { id: 'ar', type: 'armor', name: 'Armor jacket', system: { worn: true, ballistic: 5, impact: 3 } },
    { id: 'dp', type: 'cyberware', name: 'Dermal plating 2', system: { installed: true, essenceCost: 1, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0, armorBallistic: 2, armorImpact: 2 } },
  ]);

  test('noWorn keeps the dermal plating; without noWorn the total is unchanged', async () => {
    const a = sam();
    assert.equal(a.armorRating('ballistic'), 7);
    assert.equal(a.armorRating('impact'), 5);
    assert.equal(a.armorRating('ballistic', { noWorn: true }), 2);
    assert.equal(a.armorRating('impact', { noWorn: true }), 2);
    const plain = who({ name: 'Plain' }, [{ id: 'ar', type: 'armor', name: 'Vest', system: { worn: true, ballistic: 4, impact: 3 } }]);
    assert.equal(plain.armorRating('ballistic'), 4);
    assert.equal(plain.armorRating('ballistic', { noWorn: true }), 0);
  });

  test('the old bypass list (worn, adept, cyber, limb) is a house rule away', async () => {
    const a = sam();
    await withRule(RULES.COMBAT_V72.calledShotGap, 'bypasses', ['worn', 'adept', 'cyber', 'limb'], () => {
      assert.equal(a.armorRating('ballistic', { noWorn: true }), 0);
      assert.equal(a.armorRating('ballistic'), 7);
    });
  });
});

describe('O5 smoke counts in melee', () => {
  test('planAttack in melee: the sight\'s smoke adds to the TN; switched off it doesn\'t', async () => {
    const a = who({ name: 'Brawler' }, [skill('ua', 'Unarmed Combat', 4, 'strength')]);
    const smoke = { label: 'Smoke', value: 4 };
    const clear = sumOf(a.planAttack(SR2Actor.unarmed(), { sight: {} }).modifiers);
    const smoky = sumOf(a.planAttack(SR2Actor.unarmed(), { sight: { smoke } }).modifiers);
    assert.equal(smoky - clear, 4);
    await withRule(RULES.COMBAT_V72, 'meleeSmoke', false, () => {
      assert.equal(sumOf(a.planAttack(SR2Actor.unarmed(), { sight: { smoke } }).modifiers), clear);
    });
  });

  test.skip('attackSight / the melee defense read smoke from the canvas (smokeBetweenTokens): needs tokens and scene fires', () => {});
});

describe('O6 data-driven ammunition', () => {
  const gun = (ammoType: string) => ({ id: 'g', name: 'Rifle', system: { melee: false, skill: 'Rifles', damagePower: 8, damageLevel: 'M', damageType: 'physical', modes: 'SA', ammo: 10, ammoMax: 10, recoilComp: 0, ammoType } });
  const row = { id: 'v72hot', label: 'Hot loads', power: 2, stages: 1, armorMultiplier: 1 };

  test('a house-rule row in COMBAT_V72.ammo.extra: Power and stage from the row', async () => {
    const a = who({ name: 'Shooter' });
    const extra = RULES.COMBAT_V72.ammo.extra;
    await withRule(RULES.COMBAT_V72.ammo, 'extra', [...extra, row], () => {
      const p = a.planAttack(gun('v72hot'), { range: 'short' });
      assert.deepEqual({ power: p.power, level: p.level }, { power: 10, level: 'S' });
      assert.ok(p.notes.includes('Hot loads'));
    });
    // Not in the list any more: standard.
    const p = a.planAttack(gun('v72hot'), { range: 'short' });
    assert.deepEqual({ power: p.power, level: p.level }, { power: 8, level: 'M' });
  });

  test('AV rounds make the attack anti-vehicle and halve armor; with dataDriven off they are unknown (standard)', async () => {
    const a = who({ name: 'Shooter' });
    const p = a.planAttack(gun('antiVehicle'), { range: 'short' });
    assert.equal(p.extras.antiVehicle, true);
    assert.equal(p.extras.armorMultiplier, 0.5);
    const s = a.planAttack(gun('stickShock'), { range: 'short' });
    assert.deepEqual({ t: s.damageType, k: s.extras.armorKind, l: s.level, p: s.power }, { t: 'stun', k: 'impact', l: 'S', p: 6 });
    await withRule(RULES.COMBAT_V72.ammo, 'dataDriven', false, () => {
      const q = a.planAttack(gun('antiVehicle'), { range: 'short' });
      assert.equal(q.extras.antiVehicle, undefined);
      assert.equal(q.extras.armorMultiplier, undefined);
    });
  });
});

describe('O7 indirect fire', () => {
  const mortar = { id: 'mt', name: 'Mortar', system: { melee: false, skill: 'Launch Weapons', blast: true, blastKind: 'offensive', blastPerMetre: 1, damagePower: 12, damageLevel: 'D', damageType: 'physical', modes: 'SS', ammo: 0, ammoMax: 0, recoilComp: 0 } };
  const gunner = () => who({ name: 'Gunner' }, [skill('lw', 'Launch Weapons', 4, 'intelligence')]);

  test('the firer\'s own visibility is dropped, the spotter\'s link TN added, blastExtras.indirect carries the spotter\'s successes', async () => {
    const a = gunner();
    const blind = a.planAttack(mortar, { range: 'long', visibility: 'blind', sight: { smoke: { label: 'Smoke', value: 4 } } });
    assert.ok(blind.modifiers.some((m: any) => /Blind fire/.test(m.label)));
    assert.equal(blind.blastExtras.indirect, undefined);
    const ind = a.planAttack(mortar, { range: 'long', visibility: 'blind', sight: { smoke: { label: 'Smoke', value: 4 } }, indirect: { link: 'voice', spotterSuccesses: 2 } });
    assert.ok(!ind.modifiers.some((m: any) => /Blind fire|Smoke/.test(m.label)));
    const link = ind.modifiers.find((m: any) => /Indirect fire, spotter by voice/.test(m.label));
    assert.equal(link?.value, RULES.COMBAT_V72.indirect.linkTn.voice);
    assert.deepEqual(ind.blastExtras.indirect, { spotterSuccesses: 2 });
    assert.ok(ind.notes.some((x: string) => /indirect fire \(spotter: voice\)/.test(x)));
    assert.equal(ind.ammoShort, null);
  });

  test("no spotter: blind fire TN; with noSpotter 'block' the shot is refused", async () => {
    const a = gunner();
    const p = a.planAttack(mortar, { range: 'long', indirect: { link: 'none' } });
    assert.ok(p.modifiers.some((m: any) => /no spotter \(blind\)/.test(m.label) && m.value === RULES.COMBAT.cover.blindFireTn));
    await withRule(RULES.COMBAT_V72.indirect, 'noSpotter', 'block', () => {
      assert.match(String(a.planAttack(mortar, { range: 'long', indirect: { link: 'none' } }).ammoShort), /Mortar: Indirect fire needs a spotter/);
    });
  });

  test('a thrown grenade (not a lobbing skill), or switched off: the indirect option is ignored', async () => {
    const a = gunner();
    const grenade = { ...mortar, system: { ...mortar.system, skill: 'Throwing' } };
    assert.equal(a.planAttack(grenade, { range: 'short', indirect: { link: 'voice' } }).blastExtras.indirect, undefined);
    await withRule(RULES.COMBAT_V72.indirect, 'enabled', false, () => {
      assert.equal(a.planAttack(mortar, { range: 'long', indirect: { link: 'voice' } }).blastExtras.indirect, undefined);
    });
  });
});

// =============================================================================================== Health

describe('O8 drug doses and overdoses', () => {
  const jazz = { id: 'j', type: 'gear', name: 'Jazz', system: { quantity: 5, toxin: { kind: 'drug', vector: 'inhalation', power: 6, level: 'M', damageType: 'physical', speed: 'immediate', effect: '',
    attributes: {}, reaction: 2, initiativeDice: 1, durationMinutes: 10, crashPower: 6, crashLevel: 'M', addiction: 0 } } };

  test('two doses: one entry with doses 2, the bonuses once, an overdose toxin card', async () => {
    const a = who({ name: 'User' }, [jazz]);
    const r0 = a.system.derived.reaction;
    assert.equal(await a.takeDrug('j'), true);
    assert.equal(a.system.drugs.length, 1);
    assert.equal(chat.length, 1);
    assert.equal(await a.takeDrug('j'), true);
    assert.equal(a.system.drugs.length, 1);
    assert.equal(a.system.drugs[0].doses, 2);
    assert.equal(a.system.derived.reaction, r0 + 2);
    assert.match(chat.at(-2).content, /Already in effect: the dose renews it \(dose 2\)/);
    const od = chat.at(-1);
    assert.match(od.content, /Overdose: Jazz \(dose 2 while active\)/);
    const t = od.flags.sr2e.toxins[0];
    assert.deepEqual({ name: t.name, power: t.power, level: t.level, vector: t.vector, target: t.targetUuid }, { name: 'Jazz overdose', power: 7, level: 'M', vector: 'inhalation', target: a.uuid });
  });

  test("doses 'stack': the old two entries, the bonuses twice", async () => {
    await withRule(RULES.HEALTH_V72.drugs, 'doses', 'stack', async () => {
      const a = who({ name: 'User' }, [jazz]);
      const r0 = a.system.derived.reaction;
      await a.takeDrug('j');
      await a.takeDrug('j');
      assert.equal(a.system.drugs.length, 2);
      assert.equal(a.system.derived.reaction, r0 + 4);
    });
  });

  test('overdose switched off: no toxin card', async () => {
    const a = who({ name: 'User' }, [jazz]);
    await withRule(RULES.HEALTH_V72.drugs.overdose, 'enabled', false, async () => {
      await a.takeDrug('j');
      await a.takeDrug('j');
    });
    assert.ok(!chat.some((m) => m.flags?.sr2e?.toxins));
    assert.equal(a.system.drugs[0].doses, 2);
  });
});

describe('O9 Shadowtech bioware: symbiotes, nephritic screen, extended-volume lungs', () => {
  test('natural healing: + symbiotes dice', async (t) => {
    t.after(oldWay({"BOOK_V78.symbiotes.mode": "dice"})); // v0.78.0: the old rule (a house rule)
    const a = who({ name: 'Patient', monitor: { physical: 0, stun: 3 } }, [bio('sy', 'Symbiotes 2', 'symbiotes', 2, 0.7)]);
    assert.equal(a.system.derived.bio.vitals.healingDice, 2);
    faces.push(1, 1, 1, 1, 1, 1);                                        // Body 4 + 2
    await a.naturalHeal({ track: 'stun', hours: 1 });
    assert.match(chat.at(-1).content, /\[symbiotes \+2\]/);
    assert.match(chat.at(-1).content, /6 dice vs TN/);
    assert.equal(faces.length, 0);
    await withRule(RULES.HEALTH_V72.bioware, 'enabled', false, async () => {
      a.system.prepareDerivedData();
      faces.push(1, 1, 1, 1);
      await a.naturalHeal({ track: 'stun', hours: 1 });
      assert.doesNotMatch(chat.at(-1).content, /symbiotes/);
      assert.equal(faces.length, 0);
    });
  });

  test('resistToxin: a nephritic screen adds dice against an injected toxin, not an inhaled one', async () => {
    const a = who({ name: 'Screened' }, [bio('ns', 'Nephritic screen', 'nephriticScreen', 1)]);
    faces.push(1, 1, 1, 1, 1);
    await a.resistToxin({ name: 'Narcoject', vector: 'injection', power: 6, level: 'M', damageType: 'stun' });
    assert.match(chat.at(-1).content, /nephritic screen \+1/);
    assert.match(chat.at(-1).content, /5 dice vs TN/);
    faces.push(1, 1, 1, 1);
    await a.resistToxin({ name: 'Neuro-stun', vector: 'inhalation', power: 6, level: 'M', damageType: 'stun' });
    assert.doesNotMatch(chat.at(-1).content, /nephritic/);
    assert.match(chat.at(-1).content, /4 dice vs TN/);
  });

  test('resistHazard drowning: extended-volume lungs hold the breath; past them the remaining turns count', async () => {
    const a = who({ name: 'Diver' }, [bio('ev', 'Extended volume 1', 'extendedVolume', 1, 0.2)]);
    await a.resistHazard('drowning', 6);
    assert.match(chat.at(-1).content, /still holds their breath \(extended-volume lungs, 15 Combat Turns\)/); // v0.77.0: 45 s per level
    assert.equal(faces.length, 0);
    faces.push(1, 1, 1, 2);
    await a.resistHazard('drowning', 17); // v0.77.0: 15 turns held
    assert.match(chat.at(-1).content, /Drowning \(2 turns under\)/);
  });
});

describe('O10 reaction enhancers don\'t work with boosted reflexes', () => {
  const ware = (id: string, name: string, reaction: number, dice: number) => ({ id, type: 'cyberware', name, system: { installed: true, essenceCost: 0.5, grade: 'standard', attributes: {}, reaction, initiativeDice: dice } });

  test('the model drops the enhancer\'s Reaction while boosted reflexes work; the old stacking is a house rule away', async () => {
    const base = who({ name: 'Plain' }).system.derived.reaction;
    const both = () => who({ name: 'Pell' }, [ware('br', 'Boosted Reflexes 1', 1, 1), ware('re', 'Reaction Enhancer 2', 2, 0)]);
    const a = both();
    assert.equal(a.system.derived.reaction, base + 1);
    assert.ok((a.system.derived.cyberWarnings ?? []).some((w: string) => /Reaction Enhancer 2 does not work with Boosted Reflexes 1/.test(w)), JSON.stringify(a.system.derived.cyberWarnings));
    const alone = who({ name: 'Enhanced' }, [ware('re', 'Reaction Enhancer 2', 2, 0)]);
    assert.equal(alone.system.derived.reaction, base + 2);
    await withRule(RULES.HEALTH_V72.reflexes, 'incompatible', [], () => {
      assert.equal(both().system.derived.reaction, base + 3);
    });
  });
});

describe('O11 Companion health edges and flaws', () => {
  const on = <T>(fn: () => T | Promise<T>) => withRule(RULES.STREET.qualities, 'enabled', true, fn);

  test('Will to Live: more Overflow boxes; the death check counts them', async () => {
    await on(async () => {
      const brave = who({ name: 'Brave', qualities: [{ name: 'Will to Live', kind: 'edge', points: 3 }], monitor: { physical: 13, stun: 0 } });
      assert.equal(brave.system.derived.vitals.overflowBody, 7);
      faces.push(1, 1, 1, 1);
      await brave.resistDamage({ power: 6, level: 'M', type: 'physical' });
      assert.match(chat.at(-1).content, /Status: <strong>dying<\/strong>/);
      assert.equal(brave.system.monitor.physical, 16);
      const plain = who({ name: 'Plain', monitor: { physical: 13, stun: 0 } });
      faces.push(1, 1, 1, 1);
      await plain.resistDamage({ power: 6, level: 'M', type: 'physical' });
      assert.match(chat.at(-1).content, /Status: <strong>dead<\/strong>/);
    });
  });

  // BUG (v0.72.0 O11): documents/index.ts applyUnresisted (applyDamageToMonitor with sys.attributes.body.total, not
  // + derived.vitals.overflowBoxes) reports "dead" for a Will to Live character the model (overflowBody) has dying.
  // The disease tick (rollDiseaseTick) has the same plain-Body status line. Un-skip when fixed.
  test('Will to Live: the GM\'s Apply unresisted card reports the same status as the model', async () => {
    await on(async () => {
      const brave = who({ name: 'Brave', qualities: [{ name: 'Will to Live', kind: 'edge', points: 3 }], monitor: { physical: 13, stun: 0 } });
      await brave.applyUnresisted({ targetUuid: brave.uuid, melee: false, damageType: 'physical', power: 6, level: 'M' });
      assert.equal(brave.system.derived.status, 'dying');
      assert.match(chat.at(-1).content, /Status: <strong>dying<\/strong>/);
    });
  });

  test('High Pain Tolerance: boxes ignored in woundModifiers() and derived.woundModifier; nothing with qualities off', async () => {
    const q = [{ name: 'High Pain Tolerance', kind: 'edge', points: 2 }];
    await on(() => {
      const a = who({ name: 'Tough', qualities: q, monitor: { physical: 3, stun: 0 } });
      const plain = who({ name: 'Plain', monitor: { physical: 3, stun: 0 } });
      assert.ok(sumOf(plain.woundModifiers()) > 0);
      assert.equal(sumOf(a.woundModifiers()), sumOf(who({ name: 'One', monitor: { physical: 1, stun: 0 } }).woundModifiers()));
      assert.ok(a.system.derived.woundModifier < plain.system.derived.woundModifier);
    });
    const off = who({ name: 'Tough', qualities: q, monitor: { physical: 3, stun: 0 } });
    assert.equal(sumOf(off.woundModifiers()), sumOf(who({ name: 'Plain', monitor: { physical: 3, stun: 0 } }).woundModifiers()));
  });

  test('Toughness: +1 die on resistDamage (Physical and Stun), named on the card', async () => {
    await on(async () => {
      const a = who({ name: 'Ox', qualities: [{ name: 'Toughness', kind: 'edge', points: 3 }] });
      faces.push(1, 1, 1, 1, 1);
      await a.resistDamage({ power: 6, level: 'M', type: 'physical' });
      assert.match(chat.at(-1).content, /Toughness \+1/);
      assert.match(chat.at(-1).content, /5 dice vs TN/);
      assert.equal(faces.length, 0);
    });
  });

  test('Sensitive System: cyberware Essence doubled; bioware within the Body Index still calls for a rejection test', async () => {
    const items = [
      { id: 'cy', type: 'cyberware', name: 'Datajack', system: { installed: true, essenceCost: 0.5, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0 } },
      bio('bw', 'Enhanced articulation', 'other', 1, 0.3),
    ];
    const plain = who({ name: 'Plain' }, items);
    assert.equal(plain.system.derived.essence, 5.5);
    assert.equal(await plain.rejectionTest(), null);
    assert.match(infos.at(-1) ?? '', /within the limit/);
    await on(async () => {
      const a = who({ name: 'Delicate', qualities: [{ name: 'Sensitive System', kind: 'flaw', points: 2 }] }, items);
      assert.equal(a.system.derived.essence, 5);
      faces.push(5, 5, 1, 1);
      const r = await a.rejectionTest();
      assert.ok(r);
      assert.match(chat.at(-1).content, /Bioware rejection \(Body vs 4/);
    });
  });
});

describe('O12 heat and electricity', () => {
  test('heat: Body vs the severity\'s TN, Stun; switched off: a warning, no roll', async () => {
    const a = who({ name: 'Walker' });
    faces.push(1, 1, 1, 2);
    await a.resistHazard('heat', 'searing');
    assert.match(chat.at(-1).content, /Heat: Searing/);
    assert.match(chat.at(-1).content, /TN <strong>6<\/strong>/);
    assert.ok(a.system.monitor.stun > 0);
    await withRule(RULES.HEALTH_V72.hazards.heat, 'enabled', false, () => a.resistHazard('heat', 'hot'));
    assert.match(warnings.at(-1) ?? '', /Heat exposure is switched off/);
  });

  test('electricity: half impact armor + insulation, then the shock test', async () => {
    const a = who({ name: 'Climber' }, [{ id: 'ar', type: 'armor', name: 'Vest', system: { worn: true, ballistic: 4, impact: 4 } }]);
    faces.push(1, 1, 1, 1);                                              // resist: none
    faces.push(6, 1, 6, 1, 6, 1, 6, 1);                                  // shock: Body 4 vs 6, each 6 re-rolls (7): passes
    await a.resistHazard('electricity', 'household', { insulation: 1 });
    assert.ok(chat.some((m) => /Resist 6M stun, armor 3/.test(m.content)));
    assert.match(chat.at(-1).content, /Shock \(Body vs Force 6\)/);
    assert.equal(faces.length, 0);
    await withRule(RULES.HEALTH_V72.hazards.electricity, 'enabled', false, () => a.resistHazard('electricity', 'fence'));
    assert.match(warnings.at(-1) ?? '', /Electric shocks are switched off/);
  });
});

// =============================================================================================== Magic

describe('O13 bound spirits when the master dies, by kind', () => {
  test('a nature spirit departs, an ally and an elemental go free, an insect spirit stays', async () => {
    const m = who({ name: 'Mage', magic: 6, tradition: 'shamanic', monitor: { physical: 15, stun: 0 } });
    const nature = spirit({ name: 'River spirit', system: { spiritKind: 'nature', summonerUuid: m.uuid, services: 2 } });
    const ally = spirit({ name: 'Ally', system: { spiritKind: 'ally', summonerUuid: m.uuid, services: 2 } });
    const elem = spirit({ name: 'Fire elemental', system: { spiritKind: 'elemental', summonerUuid: m.uuid, services: 2 } });
    const insect = spirit({ name: 'Wasp', system: { spiritKind: 'insect', summonerUuid: m.uuid, services: 2 } });
    g.game.actors = [m, nature, ally, elem, insect];
    assert.equal(m.system.derived.status, 'dead');
    await m.syncCondition('dying', { physical: true, stun: false });
    assert.deepEqual({ k: nature.system.spiritKind, s: nature.system.summonerUuid }, { k: 'nature', s: '' });
    assert.deepEqual({ k: ally.system.spiritKind, s: ally.system.summonerUuid }, { k: 'free', s: '' });
    assert.equal(elem.system.spiritKind, 'free');
    assert.deepEqual({ k: insect.system.spiritKind, s: insect.system.summonerUuid }, { k: 'insect', s: m.uuid });
    assert.ok(chat.some((c) => /River spirit: Master dead: the spirit departs/.test(c.content)));
    assert.ok(chat.some((c) => /Ally: Master dead: the spirit goes free/.test(c.content)));
  });

  test('byKind off: the old one mode for all (MAGIC_V61.masterDies)', async () => {
    const m = who({ name: 'Mage', magic: 6, tradition: 'shamanic', monitor: { physical: 15, stun: 0 } });
    const nature = spirit({ name: 'River spirit', system: { spiritKind: 'nature', summonerUuid: m.uuid } });
    g.game.actors = [m, nature];
    await withRule(RULES.MAGIC_V72.masterDies, 'byKind', false, () => withRule(RULES.MAGIC_V61, 'masterDies', 'free', () => m.syncCondition('dying', { physical: true, stun: false })));
    assert.equal(nature.system.spiritKind, 'free');
  });
});

describe('O14 an adept in astral combat', () => {
  // v0.77.0: the Unarmed Combat rule is a house rule now (off by default); these test it switched on.
  before(() => { (RULES as any).MAGIC_V72.adeptAstral.enabled = true; });
  after(() => { (RULES as any).MAGIC_V72.adeptAstral.enabled = false; });
  const power = (id: string, name: string, special: string, level: number) => ({ id, type: 'adeptpower', name, system: { cost: 0.5, active: true, level, attributes: {}, reaction: 0, initiativeDice: 0, skill: '', skillDice: 0, ballistic: 0, impact: 0, special, sense: '' } });
  const kh = (level: number) => power('kh', 'Killing hands', 'killingHands', level);
  // An adept perceives astrally only with the astral perception power (models: derived.astralMode).
  const adept = (items: any[] = []) => who({ name: 'Adept', magic: 6, tradition: 'adept', astral: 'perceiving' }, [skill('ua', 'Unarmed Combat', 5, 'strength'), power('ap', 'Astral perception', 'astralPerception', 1), ...items]);

  test('Unarmed Combat dice, the Combat Pool, killing hands\' damage level', async () => {
    const a = adept([kh(2)]);
    const t = spirit({ name: 'Watcher', system: { materialized: false, astral: 'astral' } });
    assert.ok(a.isAstral(), 'perceiving');
    assert.equal(a.poolFor({ astral: true }), 'combat');
    faces.push(5, 5, 1, 1, 1, 1);                                        // Unarmed 5 + 1 Combat Pool
    const r = await a.astralAttack({ targetUuid: t.uuid, poolDice: 1 });
    assert.ok(r);
    assert.equal(faces.length, 0);
    assert.equal(a.system.poolSpent.combat, 1);
    assert.equal(a.system.poolSpent.spell, 0);
    const atk = chat.at(-1).flags.sr2e.attack;
    assert.equal(atk.level, 'M'); // v0.77.0: level 2 is M (L/M/S/D)
    assert.match(chat.at(-1).content, /killing hands M/);
  });

  test('switched off: the old way (Sorcery, defaulting to Willpower; the Spell Pool)', async () => {
    const a = adept([kh(2)]);
    const t = spirit({ name: 'Watcher', system: { materialized: false, astral: 'astral' } });
    await withRule(RULES.MAGIC_V72.adeptAstral, 'enabled', false, async () => {
      assert.equal(a.poolFor({ astral: true }), RULES.ASTRAL.attackPool);
      faces.push(...Array(5).fill(2));                                   // Willpower 5 (no ones: not a disaster)
      await a.astralAttack({ targetUuid: t.uuid });
      assert.equal(faces.length, 0);
      // No successes: no attack flag; the card's label carries Power and level.
      assert.match(chat.at(-1).content, new RegExp(`Astral attack \\(TN ${RULES.ASTRAL.attackBaseTn}, ${A.charisma}${RULES.ASTRAL.damageLevel}\\)`));
      assert.doesNotMatch(chat.at(-1).content, /killing hands/);
    });
  });
});

describe('O15 metamagic limits for adepts and aspected magicians', () => {
  test('an adept can\'t take shielding (refused with a reason); centering is fine; mode warn lets it through', async () => {
    const a = who({ name: 'Adept', magic: 6, tradition: 'adept' });
    assert.equal(await a.advanceInitiation('shielding'), false);
    assert.match(warnings.at(-1) ?? '', /Physical adepts can learn only centering and masking/);
    assert.equal(a.system.initiateGrade, 0);
    assert.equal(await a.advanceInitiation('centering'), true);
    assert.equal(a.system.metamagic.centering, true);
    const b = who({ name: 'Adept 2', magic: 6, tradition: 'adept' });
    await withRule(RULES.MAGIC_V72.metamagicLimits, 'mode', 'warn', async () => {
      assert.equal(await b.advanceInitiation('shielding'), true);
    });
    assert.match(warnings.at(-1) ?? '', /only warns/);
    assert.equal(b.system.metamagic.shielding, true);
  });

  test('an aspected conjurer can\'t take quickening; a full magician can', async () => {
    const c = who({ name: 'Conjurer', magic: 6, tradition: 'conjurer' });
    assert.equal(await c.advanceInitiation('quickening'), false);
    assert.match(warnings.at(-1) ?? '', /needs sorcery/);
    const h = who({ name: 'Mage', magic: 6, tradition: 'hermetic' });
    assert.equal(await h.advanceInitiation('quickening'), true);
  });
});

describe('O16 Spell Pool dice for dispelling drain', () => {
  const setup = () => {
    const subj = who({ name: 'Subject' });
    const caster = who({ name: 'Caster', magic: 6, tradition: 'hermetic',
      sustaining: [{ spellName: 'Armor', force: 4, category: 'manipulation', focusId: '', successes: 3, quickened: false, targetUuids: [subj.uuid] }] });
    const d = who({ name: 'Dispeller', magic: 6, tradition: 'hermetic', metamagic: { dispelling: true }, initiateGrade: 1 }, [skill('sorc', 'Sorcery', 4, 'willpower')]);
    return { caster, d };
  };

  test('drainPoolDice are spent and rolled on the drain; switched off none are', async (t) => {
    // v0.92.3: 'the book' here is the v0.92.2 reading (RULES.SORCERY_V923 at its old way); the book's way is in v0923-sorcery.test.ts.
    t.after(oldWay(SORCERY_V922));
    const { caster, d } = setup();
    const left = d.system.derived.spellPoolLeft;
    assert.ok(left >= 2, `spell pool ${left}`);
    faces.push(1, 1, 1, 1);                                              // Sorcery 4: nothing dispelled
    faces.push(...Array(5 + 2).fill(5));                                 // Willpower 5 + 2 pool dice
    await d.dispel(caster, 0, { drainPoolDice: 2 });
    assert.equal(faces.length, 0);
    assert.equal(d.system.poolSpent.spell, 2);
    const e = setup();
    faces.push(1, 1, 1, 1, ...Array(5).fill(5));
    await withRule(RULES.MAGIC_V72, 'dispelDrainPool', false, () => e.d.dispel(e.caster, 0, { drainPoolDice: 2 }));
    assert.equal(faces.length, 0);
    assert.equal(e.d.system.poolSpent.spell, 0);
  });
});

describe('O17 Mana Barrier raises a barrier actor while sustained', () => {
  const dropHooks = async (a: any, index: number, userId: string) => {
    const opts: any = {};
    await a._preUpdate({ system: { sustaining: [] } }, opts, null);
    await a.dropSustained(index);
    a._onUpdate({ system: { sustaining: [] } }, opts, userId);
    await new Promise((r) => setTimeout(r, 5));
  };
  /** Actor.create that makes a findable barrier actor (in game.actors) that can be deleted. */
  const barrierFactory = () => {
    const deleted: string[] = [];
    (g.Actor as any).implementation = { create: async (d: any) => {
      created.push(d);
      const b: any = { ...d, uuid: `Actor.barrier${created.length}`, isOwner: true, getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; },
        async delete() { deleted.push(this.uuid); g.game.actors = g.game.actors.filter((x: any) => x !== this); } };
      uuidRegistry.set(b.uuid, b);
      g.game.actors.push(b);
      return b;
    } };
    return deleted;
  };
  const mage = () => who({ name: 'Mage', magic: 6, tradition: 'hermetic' }, [skill('sorc', 'Sorcery', 5, 'willpower'),
    spellItem('mb', 'Mana Barrier', { category: 'manipulation', duration: 'sustained' })]);

  test('GM: the barrier actor (barrierSpell flag, rating = Force); dropping the spell deletes it', async (t) => {
    t.after(oldWay({"BOOK_V78.manaBarrier.rating": "force"})); // v0.78.0: the old rule (a house rule)
    const deleted = barrierFactory();
    const a = mage();
    g.game.actors = [a];
    faces.push(5, 5, 1, 1, 1);                                           // Sorcery 5: 2 successes
    faces.push(...Array(10).fill(5));                                    // drain
    await a.castSpell(a.items.get('mb'), { force: 4 });
    assert.equal(a.system.sustaining.length, 1);
    const eff = a.system.sustaining[0].effectId;
    assert.ok(eff);
    assert.equal(created.length, 1);
    const b = created[0];
    assert.equal(b.type, 'barrier');
    assert.deepEqual({ ...b.system }, { barrierKind: 'mana barrier', rating: 4, baseRating: 4 });
    assert.equal(b.flags.sr2e.barrierSpell.effectId, eff);
    assert.equal(b.flags.sr2e.barrierSpell.casterUuid, a.uuid);
    assert.ok(SR2Actor.barrierOfSpell(eff));
    const card = chat.find((c) => c.flags?.sr2e?.wardPlace);
    assert.ok(card, 'a Draw it on the map card');
    assert.equal(card.flags.sr2e.wardPlace.radius, 6);                   // the caster's Magic
    await dropHooks(a, 0, 'gm1');
    assert.equal(deleted.length, 1);
    assert.equal(SR2Actor.barrierOfSpell(eff), null);
  });

  test('a player who can\'t create actors gets a GM card; their drop posts a GM remove card', async () => {
    barrierFactory();
    g.game.user = PLAYER();
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: false } });
    const a = mage();
    g.game.actors = [a];
    faces.push(5, 5, 1, 1, 1, ...Array(10).fill(5));
    await a.castSpell(a.items.get('mb'), { force: 4 });
    assert.equal(created.length, 0);
    const pending = chat.find((c) => c.flags?.sr2e?.pendingSpirit);
    assert.ok(pending);
    assert.equal(pending.flags.sr2e.pendingSpirit.type, 'barrier');
    // The GM makes it from the card (simulated); the player drops the spell.
    const eff = a.system.sustaining[0].effectId;
    const b: any = { ...pending.flags.sr2e.pendingSpirit, uuid: 'Actor.gmbarrier', getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; }, async delete() {} };
    g.game.actors.push(b);
    uuidRegistry.set(b.uuid, b);
    assert.equal(SR2Actor.barrierOfSpell(eff), b);
    await dropHooks(a, 0, 'p1');
    const gmCard = chat.find((c) => c.flags?.sr2e?.actorUpdate?.remove);
    assert.ok(gmCard, 'a GM remove card');
    assert.equal(gmCard.flags.sr2e.actorUpdate.uuid, 'Actor.gmbarrier');
    assert.match(gmCard.content, /Mana Barrier is dropped: remove/);
  });

  test('switched off: an ordinary sustained spell, no barrier', async () => {
    barrierFactory();
    const a = mage();
    faces.push(5, 5, 1, 1, 1, ...Array(10).fill(5));
    await withRule(RULES.MAGIC_V72.barrierSpells, 'enabled', false, () => a.castSpell(a.items.get('mb'), { force: 4 }));
    assert.equal(a.system.sustaining.length, 1);
    assert.equal(created.length, 0);
  });
});

describe('O18 a spirit with no Sorcery casts with its Force', () => {
  test('Force dice, an innate note; switched off it can\'t cast', async () => {
    const t = who({ name: 'Victim' });
    const s = spirit({ name: 'Ally', system: { force: 5, spiritKind: 'ally' }, items: [spellItem('sb', 'Stunbolt')] });
    faces.push(...Array(40).fill(1));
    const r = await s.castSpell(s.items.get('sb'), { force: 3, targetUuid: t.uuid });
    assert.ok(r, 'cast');
    const card = chat.find((c) => /Stunbolt \(Force 3/.test(c.content));
    assert.ok(card);
    assert.match(card.content, /\[innate: Force 5\]/);
    assert.match(card.content, /5 dice vs TN/);
    warnings.length = 0;
    await withRule(RULES.MAGIC_V72.innateSpells, 'enabled', false, async () => {
      assert.equal(await s.castSpell(s.items.get('sb'), { force: 3, targetUuid: t.uuid }), null);
    });
    assert.match(warnings.at(-1) ?? '', /has no Sorcery skill/);
  });
});

describe('O19 a ward on the map stops a materialized spirit (regions.ts wardMove)', () => {
  const setup = (barrierKind = 'ward') => {
    hooks.clear();
    regions.registerRegionHooks();
    const move = hooks.get('preUpdateToken')![0]!;
    const bar = { uuid: `Actor.ward-${++n}`, type: 'barrier', name: 'Ward', system: { rating: 4, barrierKind } };
    uuidRegistry.set(bar.uuid, bar);
    const region = { id: 'r1', name: 'Ward', flags: { sr2e: { env: { wardUuid: bar.uuid } } }, testPoint: (p: any) => p.x < 300 };
    const scene = { grid: { size: 100 }, regions: [region] };
    const token = (actor: any) => ({ actor, parent: scene, x: 0, y: 0, width: 1, height: 1, elevation: 0, name: actor.name });
    return { move, token };
  };

  test('a player\'s materialized spirit is stopped; switched off it walks through', async () => {
    g.game.user = PLAYER();
    const { move, token } = setup();
    const s = spirit({ name: 'Watcher', system: { materialized: true } });
    assert.equal(move(token(s), { x: 600 }, {}, 'p1'), false);
    assert.match(warnings.at(-1) ?? '', /Watcher can't pass Ward \(rating 4\) on the astral plane/);
    await withRule(RULES.MAGIC_V72.wardPresence, 'enabled', false, () => {
      assert.equal(move(token(s), { x: 600 }, {}, 'p1'), undefined);
    });
    // A mundane body passes a ward.
    assert.equal(move(token(who({ name: 'Joe' })), { x: 600 }, {}, 'p1'), undefined);
  });

  test('a physical barrier stops a body in the physical world, not an astral form', async () => {
    g.game.user = PLAYER();
    const { move, token } = setup('physical barrier');
    assert.equal(move(token(who({ name: 'Joe' })), { x: 600 }, {}, 'p1'), false);
    assert.match(warnings.at(-1) ?? '', /Joe can't pass Ward \(rating 4\) in the physical world/);
    const ghost = spirit({ name: 'Ghost', system: { materialized: false } });
    assert.equal(move(token(ghost), { x: 600 }, {}, 'p1'), undefined);
  });
});

describe('O20 a projecting magician\'s wounds', () => {
  const mage = () => who({ name: 'Mage', magic: 6, tradition: 'hermetic', astral: 'projecting', monitor: { physical: 3, stun: 0 } });

  test("initiativeFormula: the wound penalty applies when projecting ('both'); 'legacy' drops it", async () => {
    const a = mage();
    assert.equal(a.system.derived.astralMode, 'projecting');
    const f = initiativeFormula(a);
    assert.equal(f.label, 'astral');
    assert.equal(f.minus, initiativeWoundPenalty(a.system.derived.woundModifier));
    assert.ok(f.minus > 0);
    await withRule(RULES.MAGIC_V72, 'astralWounds', 'legacy', () => { assert.equal(initiativeFormula(a).minus, 0); });
  });

  test("woundModifiers(): 'neither' drops them on a projecting magician's tests", async () => {
    const a = mage();
    assert.ok(sumOf(a.woundModifiers()) > 0);
    await withRule(RULES.MAGIC_V72, 'astralWounds', 'neither', () => { assert.deepEqual(a.woundModifiers(), []); });
  });
});

describe('O21 anchoring and allies', () => {
  test('anchoring charges Good Karma by Force with a ledger line; too little Karma refuses; switched off it is free', async () => {
    const a = who({ name: 'Mage', magic: 6, tradition: 'hermetic', metamagic: { anchoring: true }, initiateGrade: 1 }, [skill('sorc', 'Sorcery', 4, 'willpower'), spellItem('sb', 'Stunbolt')]);
    assert.equal(await a.castSpell(a.items.get('sb'), { force: 3, anchor: { trigger: 'the door opens' } }), null);
    assert.equal(a.system.anchored.length, 1);
    assert.equal(a.system.anchored[0].karma, 3);
    assert.equal(a.system.karma.good, 27);
    assert.deepEqual({ ...a.system.ledger.at(-1), t: 0 }, { t: 0, kind: 'karma', amount: -3, reason: 'Anchored Stunbolt (Force 3)' });
    assert.match(chat.at(-1).content, /anchors Stunbolt \(Force 3\) for 3 Good Karma/);
    a.system.karma.good = 2;
    assert.equal(await a.anchorSpell('sb', 3, ''), false); // review fix: true/false for the approval queue
    assert.match(warnings.at(-1) ?? '', /costs 3 Good Karma; Mage has 2/);
    assert.equal(a.system.anchored.length, 1);
    await withRule(RULES.MAGIC_V72.anchoring, 'enabled', false, () => a.anchorSpell('sb', 3, ''));
    assert.equal(a.system.anchored.length, 2);
    assert.equal(a.system.karma.good, 2);
  });

  const pair = () => {
    const m = who({ name: 'Mage', magic: 6, tradition: 'hermetic' }, [spellItem('sb', 'Stunbolt', { learnedForce: 4 })]);
    const ally = spirit({ name: 'Familiar', system: { spiritKind: 'ally', summonerUuid: m.uuid, force: 4 } });
    return { m, ally };
  };

  test('teachAlly copies the spell and charges Karma; not twice; not someone else\'s spirit', async () => {
    const { m, ally } = pair();
    assert.equal(await m.teachAlly(ally.uuid, 'sb'), true);
    assert.ok(ally.items.some((i: any) => i.type === 'spell' && i.name === 'Stunbolt'));
    assert.equal(m.system.karma.good, 26);
    assert.equal(m.system.ledger.at(-1).reason, 'Taught Familiar Stunbolt');
    assert.match(chat.at(-1).content, /teaches Familiar Stunbolt for 4 Good Karma/);
    assert.equal(await m.teachAlly(ally.uuid, 'sb'), false);
    assert.match(warnings.at(-1) ?? '', /already knows Stunbolt/);
    const stray = spirit({ name: 'Stray', system: { spiritKind: 'ally', summonerUuid: 'Actor.other' } });
    assert.equal(await m.teachAlly(stray.uuid, 'sb'), false);
    assert.match(warnings.at(-1) ?? '', /not Mage's ally/);
    assert.equal(m.system.karma.good, 26);
  });

  test('buyAllyAbility sets the flag and charges Karma; the sense link then switches on', async () => {
    const { m, ally } = pair();
    await m.setSenseLink(ally.uuid, true);
    assert.match(warnings.at(-1) ?? '', /has no sense link/);
    assert.equal(await m.buyAllyAbility(ally.uuid, 'senseLink'), true);
    assert.deepEqual(ally.getFlag('sr2e', 'allyAbilities'), { senseLink: true });
    assert.equal(m.system.karma.good, 29);
    assert.equal(await m.buyAllyAbility(ally.uuid, 'senseLink'), false);
    await m.setSenseLink(ally.uuid, true);
    assert.deepEqual(m.getFlag('sr2e', 'senseLink'), { allyUuid: ally.uuid, on: true });
    await withRule(RULES.MAGIC_V72.ally, 'enabled', false, async () => {
      assert.equal(await m.buyAllyAbility(ally.uuid, 'astralGateway'), false);
    });
    assert.match(warnings.at(-1) ?? '', /switched off/);
  });
});

describe('v0.72.0 review fixes', () => {
  test('a player character with an "innate" spell and no Sorcery still can\'t cast it', async () => {
    const t = who({ name: 'Victim' });
    const a = who({ name: 'Street sam', magic: 0 }, [spellItem('sb', 'Stunbolt', { innate: true })]);
    warnings.length = 0;
    assert.equal(await a.castSpell(a.items.get('sb'), { force: 3, targetUuid: t.uuid }), null);
    assert.match(warnings.at(-1) ?? '', /has no Sorcery skill/);
  });

  test("doses 'stack' (the old way) posts no overdose card", async () => {
    const jazz = { id: 'j', type: 'gear', name: 'Jazz', system: { quantity: 5, toxin: { kind: 'drug', vector: 'inhalation', power: 6, level: 'M', damageType: 'physical', speed: 'immediate', effect: '',
      attributes: {}, reaction: 2, initiativeDice: 1, durationMinutes: 10, crashPower: 6, crashLevel: 'M', addiction: 0 } } };
    await withRule(RULES.HEALTH_V72.drugs, 'doses', 'stack', async () => {
      const a = who({ name: 'User' }, [jazz]);
      await a.takeDrug('j');
      await a.takeDrug('j');
      assert.equal(a.system.drugs.length, 2);
    });
    assert.ok(!chat.some((m) => m.flags?.sr2e?.toxins));
  });

  test("a spirit's or dual-natured critter's blow isn't stopped outright by immunity (it still counts as armor)", async () => {
    const s = spirit({ name: 'Storm spirit' });
    faces.push(...Array(30).fill(1));
    await s.resistFromState({ targetUuid: s.uuid, melee: true, damageType: 'physical', power: 6, level: 'M', awakenedAttacker: true }, 0);
    assert.doesNotMatch(chat.at(-1).content, /shrugs it off/);
    assert.match(chat.at(-1).content, /Resist 6M physical, armor 8/);
  });

  test('anchorSpell (the approval entry point) returns true when it anchors', async () => {
    const a = who({ name: 'Mage', magic: 6, tradition: 'hermetic', metamagic: { anchoring: true }, initiateGrade: 1 }, [skill('sorc', 'Sorcery', 4, 'willpower'), spellItem('sb', 'Stunbolt')]);
    assert.equal(await a.anchorSpell('sb', 3, ''), true);
  });

  test("the GM's remove card leaves a barrier whose spell is sustained again (a re-roll brought it back)", async () => {
    let gone = false;
    const caster: any = { uuid: 'Actor.caster', system: { sustaining: [{ effectId: 'spX' }] } };
    uuidRegistry.set(caster.uuid, caster);
    const b: any = { uuid: 'Actor.bX', documentName: 'Actor', type: 'barrier', name: 'Mana Barrier', flags: { sr2e: { barrierSpell: { casterUuid: caster.uuid, effectId: 'spX' } } }, getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; }, async delete() { gone = true; } };
    uuidRegistry.set(b.uuid, b);
    g.game.scenes = [];
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: b.uuid, remove: true }), true);
    assert.equal(gone, false);
    caster.system.sustaining = [];
    await SR2Actor.applyActorUpdate({ uuid: b.uuid, remove: true });
    assert.equal(gone, true);
  });
});
