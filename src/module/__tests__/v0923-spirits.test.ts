/**
 * v0.92.3 book alignment, conjuring, spirits, astral, initiation, allies and critters: the Foundry glue
 * (documents/index.ts, models/index.ts). The stubs are a copy of v080-magic.test.ts's. Each change is checked at the
 * book default and with its switch back at the v0.92.2 way. The pure functions are in rules/__tests__/v0923-spirits.test.ts.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { SPIRITS_V922_WAY } from '../rules/__tests__/spirits922.ts';

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
  ({ CharacterDataModel, SpiritDataModel } = await import('../models/index.ts'));
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

const mage = (extra: any = {}, items: any[] = [], attrs: Record<string, number> = A) =>
  who({ name: 'Mage', magic: 6, tradition: 'hermetic', ...extra }, [skill('so', 'Sorcery', 5, 'willpower'), ...items], attrs);
const spell = (over: any = {}) => ({ id: 'sp1', name: 'Detect Life', type: 'spell', system: {
  category: 'detection', spellType: 'mana', learnedForce: 3, damageLevel: 'L', damageType: 'stun', targetNumber: 4,
  drainModifier: 0, drainLevel: 'L', duration: 'instant', ...over } });


/** A spirit on the real data model (Force 4, immune to normal weapons), registered for fromUuid. */
function spirit(o: any = {}): any {
  const sys = Object.create(SpiritDataModel.prototype);
  sys.attributes = Object.fromEntries(Object.keys(A).map((k) => [k, { base: 0, mod: 0 }]));
  Object.assign(sys, {
    essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 0 }, sustaining: [], geasa: [],
    poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 }, astral: 'physical', materialized: true,
    force: 4, spiritKind: 'nature', spiritType: '', services: 1, summonerUuid: '', immuneNormalWeapons: true, spiritEnergy: 0, trueName: '',
    offsets: Object.fromEntries(Object.keys(A).map((k) => [k, 0])), ...(o.system ?? {}),
  });
  const s = new SR2Actor();
  Object.assign(s, { system: sys, type: 'spirit', name: o.name ?? 'Spirit', uuid: `Actor.v923sp-${++n}`, id: `sp${n}`, statuses: new Set<string>() });
  s.items = withGet([...(o.items ?? [])]);
  sys.parent = s;
  sys.prepareDerivedData();
  uuidRegistry.set(s.uuid, s);
  return s;
}
const conjurer = (extra: any = {}) => mage({ ...extra }, [skill('cj', 'Conjuring', 5, 'charisma')]);
const has = (re: RegExp) => chat.some((m) => re.test(String(m.content ?? '')));

describe('v0.92.3 conjuring drain and the Spirit Table (Core pp. 140, 144)', () => {
  test('book: a Force 5 spirit over Charisma 4 drains S Physical; it takes the Spirit Table attributes', async () => {
    const sh = conjurer({ tradition: 'shamanic' });
    faces.push(5, 5, 1, 1, 1);                        // Conjuring 5 vs 5: 2 successes (a 6 would roll again)
    faces.push(1, 1, 1, 1);                           // drain: Charisma 4 vs 5
    await sh.conjure({ force: 5, spiritKind: 'nature', spiritType: 'Forest Spirit', domain: 'forest' });
    assert.ok(has(/Conjuring drain S \(TN 5\): Force over Charisma, physical/));
    const made = created.at(-1);
    assert.deepEqual([made.system.offsets.body, made.system.offsets.quickness, made.system.offsets.strength, made.system.reactionBonus], [4, -2, 4, -1]);
  });
  test('v0.92.2: M Stun (Force at most Magic, up to 1.5 × Charisma); no table', async (t) => {
    t.after(oldWay(SPIRITS_V922_WAY));
    const sh = conjurer({ tradition: 'shamanic' });
    faces.push(5, 5, 1, 1, 1, 1, 1, 1, 1);
    await sh.conjure({ force: 5, spiritKind: 'nature', spiritType: 'Forest Spirit', domain: 'forest' });
    assert.ok(has(/Conjuring drain S \(TN 5\)/));
    assert.ok(!has(/Force over Charisma/));
    assert.equal(created.at(-1).system.offsets, undefined);
  });
  test('a nature spirit outside its domain is refused (block)', async (t) => {
    t.after(oldWay({ 'MAGIC_V39.domains.enforce': 'block' }));
    const sh = conjurer({ tradition: 'shamanic' });
    sh.environmentHere = () => ['urban'];
    assert.equal(await sh.conjure({ force: 3, spiritKind: 'nature', spiritType: 'Forest Spirit', domain: 'forest' }), null);
    assert.match(warnings.at(-1) ?? '', /outside its domain/);
  });
});

describe('v0.92.3 banishing (Core p. 143)', () => {
  test('book: 1 Force per 2 net successes, no drain; the Force comes back at 1 an hour', async () => {
    const m = conjurer();
    const s = spirit({ system: { force: 5 } });
    faces.push(1, 1, 1, 1, 1);                        // the spirit: Force 5 vs Magic 6, none
    faces.push(5, 5, 5, 1, 1);                        // Conjuring 5 vs 5: 3 successes
    await m.banish(s);
    assert.equal(s.system.force, 4);
    assert.ok(!has(/Conjuring drain/));
    assert.deepEqual(s.getFlag('sr2e', 'banishForce'), { lost: 1, at: 0 });
    g.game.actors = [s];
    g.game.time = { worldTime: 3600 };
    await SR2Actor.magicTicks({ worldTime: 3600 });
    assert.equal(s.system.force, 5);
    assert.equal(s.getFlag('sr2e', 'banishForce'), undefined);
  });
  test('book: the spirit winning takes 1 Magic per 2 net successes from the banisher', async () => {
    const m = conjurer();
    const s = spirit({ system: { force: 5 } });
    faces.push(6, 6, 6, 6, 1, 1, 1, 1, 1);            // the spirit vs Magic 6: 4 successes (each 6 rolls again)
    faces.push(1, 1, 1, 1, 1);                        // the banisher: none
    await m.banish(s);
    assert.deepEqual(m.getFlag('sr2e', 'banishMagic'), { lost: 2, at: 0 });
    m.system.prepareDerivedData();                    // (Foundry recomputes on the flag's update)
    assert.equal(m.system.derived.magic, 4);
    assert.ok(has(/loses 2 Magic/));
  });
  test('banishing your own spirit adds Charisma dice', async () => {
    const m = conjurer();
    const s = spirit({ system: { force: 3, summonerUuid: m.uuid } });
    faces.push(1, 1, 1);
    faces.push(...Array(9).fill(1));                  // Conjuring 5 + Charisma 4
    const r = await m.banish(s);
    assert.equal(r.totalDice, 9);
  });
  test('v0.92.2: 1 Force per net success and conjuring drain', async (t) => {
    t.after(oldWay(SPIRITS_V922_WAY));
    const m = conjurer();
    const s = spirit({ system: { force: 5 } });
    faces.push(1, 1, 1, 1, 1, 5, 5, 5, 1, 1, 1, 1, 1, 1);
    await m.banish(s);
    assert.equal(s.system.force, 2);
    assert.ok(has(/Conjuring drain/));
  });
  test('control contest: the holder rolls Conjuring vs Force; the challenger against Force + 2 keeps the services', async () => {
    const holder = conjurer({ name: 'Holder' });
    const m = conjurer({ name: 'Challenger' });
    const s = spirit({ system: { force: 3, summonerUuid: holder.uuid, services: 2, spiritKind: 'elemental' } });
    faces.push(1, 1, 1, 1, 1);                        // the holder: Conjuring 5 vs 3, none
    faces.push(5, 5, 1, 1, 1);                        // the challenger vs 5: 2 successes
    faces.push(1, 1, 1, 1);                           // the challenger's drain (Charisma 4)
    faces.push(1, 1, 1, 1);                           // the holder's drain
    await m.banish(s, { control: true });
    assert.ok(has(/Holder holds on to Spirit \(Conjuring vs Force 3\)/));
    assert.ok(has(/TN = Force 5/));
    assert.equal(s.system.summonerUuid, m.uuid);
    assert.equal(s.system.services, 2);
  });
  test('review fix: a holder this client can\'t write gets a Resist Drain card instead of a failed update', async () => {
    const holder = conjurer({ name: 'Holder' });
    holder.isOwner = false;
    const m = conjurer({ name: 'Challenger' });
    const s = spirit({ system: { force: 3, summonerUuid: holder.uuid, services: 2, spiritKind: 'elemental' } });
    faces.push(1, 1, 1, 1, 1);
    faces.push(5, 5, 1, 1, 1);
    faces.push(1, 1, 1, 1);                           // the challenger's drain only
    await m.banish(s, { control: true });
    const card = chat.find((c: any) => c.flags?.sr2e?.conjuringDrain923);
    assert.ok(card);
    assert.deepEqual(card.flags.sr2e.conjuringDrain923, { actorUuid: holder.uuid, force: 3 });
    assert.match(card.content, /data-sr2e-action="conjuringDrain923"/);
    assert.equal(holder.system.monitor.stun, 0);
  });
});

describe('v0.92.3 spirits and normal weapons (Core pp. 142–143)', () => {
  test('book: no immunity against a melee blow; a firearm still meets it', async (t) => {
    const s = spirit({ name: 'Storm spirit' });
    faces.push(...Array(20).fill(1));
    await s.resistFromState({ targetUuid: s.uuid, melee: true, damageType: 'physical', power: 6, level: 'M' }, 0);
    assert.match(chat.at(-1).content, /Resist 6M physical/);
    await s.resistFromState({ targetUuid: s.uuid, melee: false, damageType: 'physical', power: 6, level: 'M' }, 0);
    assert.match(chat.at(-1).content, /shrugs it off/);
    await s.resistFromState({ targetUuid: s.uuid, melee: false, damageType: 'physical', power: 6, level: 'M', noSpiritImmunity: true }, 0);
    assert.match(chat.at(-1).content, /Resist 6M physical/);
    t.after(oldWay({ 'SPIRITS_V923.immunityScope': 'v922' }));
    await s.resistFromState({ targetUuid: s.uuid, melee: true, damageType: 'physical', power: 6, level: 'M' }, 0);
    assert.match(chat.at(-1).content, /shrugs it off/);
  });
  test('a mundane attacker rolls Willpower with no Combat Pool', async (t) => {
    const a = who({ name: 'Sam' }, [skill('ua', 'Unarmed Combat', 6, 'strength')]);
    const s = spirit();
    faces.push(...Array(20).fill(1));
    const r = await a.attackWith(SR2Actor.unarmed(), { targetUuid: s.uuid, poolDice: 2 });
    assert.equal(r.totalDice, 5);                     // Willpower 5, no pool
    assert.ok(has(/Willpower against a spirit/));
    t.after(oldWay({ 'SPIRITS_V923.mundaneVsSpirits': 'v922' }));
    const r2 = await a.attackWith(SR2Actor.unarmed(), { targetUuid: s.uuid });
    assert.equal(r2.totalDice, 6);
  });
  test("a magician resists a spirit's blow with Conjuring", async (t) => {
    const m = mage({}, [skill('cj', 'Conjuring', 7, 'charisma')]);
    faces.push(...Array(20).fill(1));
    await m.resistFromState({ targetUuid: m.uuid, melee: true, damageType: 'physical', power: 5, level: 'M', spiritAttacker: true }, 0);
    assert.match(chat.at(-1).content, /Conjuring 7 against a spirit/);
    assert.match(chat.at(-1).content, /7 dice vs TN/);
    t.after(oldWay({ 'SPIRITS_V923.conjuringDefense': 'off' }));
    await m.resistFromState({ targetUuid: m.uuid, melee: true, damageType: 'physical', power: 5, level: 'M', spiritAttacker: true }, 0);
    assert.match(chat.at(-1).content, /4 dice vs TN/);
  });
  test('review fix: Conjuring only when it beats all it replaces (Body with bone lacing dice)', async (t) => {
    t.after(oldWay({ 'GEAR_V923.boneLacing': 'dice' }));
    const lace = { id: 'bl', type: 'cyberware', name: 'Bone lacing (titanium)', system: { kind: 'boneLacing', lacing: 'titanium', essenceCost: 2.25, grade: 'standard', installed: true, bioware: false, attributes: {} } };
    const m = mage({}, [skill('cj', 'Conjuring', 5, 'charisma'), lace]);
    const lacing = Number(m.system.derived.cyber.lacing.soakDice);
    assert.ok(4 + lacing > 5, `lacing ${lacing}`);
    faces.push(...Array(20).fill(1));
    await m.resistFromState({ targetUuid: m.uuid, melee: true, damageType: 'physical', power: 5, level: 'M', spiritAttacker: true }, 0);
    assert.doesNotMatch(chat.at(-1).content, /Conjuring 5 against a spirit/);
    assert.match(chat.at(-1).content, new RegExp(`${4 + lacing} dice vs TN`));
  });
});

describe('v0.92.3 the astral plane (Core p. 147; Grimoire p. 91)', () => {
  test('review fix: projecting costs the body Essence only while away; nothing is written; below 0 the card says the body died', async (t) => {
    const m = mage({ essence: 6 });
    g.game.time = { worldTime: 0 };
    await m.onAstralModeChange('physical', 'projecting');
    g.game.time = { worldTime: 3 * 3600 };
    await m.onAstralModeChange('projecting', 'physical');
    assert.equal(m.system.essence, 6);
    assert.match(chat.at(-1).content, /lost 3 Essence.*1 point a minute/);
    g.game.time = { worldTime: 0 };
    await m.onAstralModeChange('physical', 'projecting');
    g.game.time = { worldTime: 7 * 3600 };
    await m.onAstralModeChange('projecting', 'physical');
    assert.equal(m.system.essence, 6);
    assert.match(chat.at(-1).content, /the magician died/);
    t.after(oldWay({ 'SPIRITS_V923.projection': 'v922' }));
    g.game.time = { worldTime: 0 };
    await m.onAstralModeChange('physical', 'projecting');
    g.game.time = { worldTime: 15 * 3600 };
    await m.onAstralModeChange('projecting', 'physical');
    assert.equal(m.system.essence, 3, 'the old way: 2 × Essence free hours, then lost for good');
    g.game.time = { worldTime: 0 };
  });
  test('book: a projecting magician has the Astral Combat Pool and strikes for Charisma L', async (t) => {
    const m = mage({ astral: 'projecting', initiateGrade: 1 });
    assert.equal(m.system.derived.combatPool, 8);     // (5 + 5 + 4) ÷ 2 + grade 1
    assert.equal(m.poolFor({ astral: true }), 'combat');
    assert.equal(m.system.derived.astral.initiativeBase, 5 + 1 + 15);
    const s = spirit({ system: { materialized: false } });
    faces.push(...Array(10).fill(1));
    await m.astralAttack({ targetUuid: s.uuid });
    assert.ok(has(/Astral attack \(TN 4, 4L\)/));
    t.after(oldWay(SPIRITS_V922_WAY));
    const m2 = mage({ astral: 'projecting', initiateGrade: 1 });
    assert.equal(m2.poolFor({ astral: true }), 'spell');
    faces.push(...Array(10).fill(1));
    await m2.astralAttack({ targetUuid: s.uuid });
    assert.ok(has(/Astral attack \(TN 4, 4M\)/));
  });
  test('a barrier that wins hurts the intruder', async (t) => {
    const m = mage({ astral: 'projecting' });
    const b: any = { type: 'barrier', name: 'Ward', uuid: 'Actor.ward923', system: { rating: 4, baseRating: 4, barrierKind: 'ward' }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); } };
    uuidRegistry.set(b.uuid, b);
    faces.push(6, 6, 6, 1, 1, 1, 1);                  // the barrier: 4 dice vs Magic 6, 3 successes (and their re-rolls)
    faces.push(1, 1, 1, 1, 1);                        // Sorcery 5 vs 4: none
    await m.breachBarrier(b);
    assert.ok(has(/Ward strikes back: 4M/));
    assert.equal(chat.at(-1).flags.sr2e.damage.astral, true);
    t.after(oldWay({ 'SPIRITS_V923.barrierBacklash': 'v922' }));
    faces.push(6, 6, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1);
    chat.length = 0;
    await m.breachBarrier(b);
    assert.ok(!has(/strikes back/));
  });
});

describe('v0.92.3 initiation, allies, wards, geasa, dispelling (Grimoire; initiation, wards, geasa and dispelling are RULES.SORCERY_V923)', () => {
  test('book: the first initiation is Grade 0 for 18 Karma and adds no Magic; the next is Grade 1 for 21', async (t) => {
    const m = mage({ karma: { pool: 0, poolSpent: 0, good: 60, career: 60 } });
    assert.equal(await m.advanceInitiation(null), true);
    assert.deepEqual([m.system.initiateGrade, m.getFlag('sr2e', 'initiated'), m.system.karma.good, m.system.derived.magic], [0, true, 42, 6]);
    assert.equal(await m.advanceInitiation(null), true);
    assert.deepEqual([m.system.initiateGrade, m.system.karma.good, m.system.derived.magic], [1, 21, 7]);
    t.after(oldWay(SPIRITS_V922_WAY));
    const o = mage({ karma: { pool: 0, poolSpent: 0, good: 60, career: 60 } });
    assert.equal(await o.advanceInitiation(null), true);
    assert.deepEqual([o.system.initiateGrade, o.system.karma.good, o.system.derived.magic], [1, 39, 7]);
  });
  test('asceticism lowers a Physical attribute only', async () => {
    const m = mage({ karma: { pool: 0, poolSpent: 0, good: 60, career: 60 } });
    assert.equal(await m.advanceInitiation(null, { ordeal: 'asceticism', attribute: 'charisma' }), false);
    assert.equal(await m.advanceInitiation(null, { ordeal: 'asceticism', attribute: 'body' }), true);
    assert.equal(m.system.karma.good, 60 - 15);       // 6 × 2.5
  });
  test('book: an ally costs 5 × current Force Karma per point, a Magic point and a day of fatigue a day', async (t) => {
    const m = conjurer({ initiateGrade: 1, karma: { pool: 0, poolSpent: 0, good: 40, career: 40 } });
    faces.push(5, 5, 1, 1, 1);                        // Conjuring 5 vs 3: 2 successes, 2 days
    faces.push(...Array(12).fill(1));                 // 2 days' fatigue + the conjuring drain (Charisma 4 each)
    await m.createAlly({ force: 3, payMaterials: false });
    assert.ok(has(/Ally ritual, day 1: fatigue L \(TN 4\)/));
    assert.ok(has(/Ally ritual, day 2: fatigue L \(TN 5\)/));
    assert.deepEqual([m.system.karma.good, m.system.magic], [25, 5]);
    t.after(oldWay(SPIRITS_V922_WAY));
    const o = conjurer({ initiateGrade: 1, karma: { pool: 0, poolSpent: 0, good: 40, career: 40 } });
    faces.push(5, 5, 1, 1, 1, 1, 1, 1, 1);
    await o.createAlly({ force: 3, payMaterials: false });
    assert.deepEqual([o.system.karma.good, o.system.magic], [37, 6]);
  });
  test('book: a ward rolls Sorcery, drains (Force × days)L Stun and is capped at 2 × Magic', async () => {
    const m = mage();
    assert.equal(await m.raiseWardRitual({ force: 13, payMaterials: false }), null);
    assert.match(warnings.at(-1) ?? '', /at most 12/);
    faces.push(5, 5, 1, 1, 1);                        // Sorcery 5 vs 3: 2 successes
    faces.push(1, 1, 1, 1, 1);                        // drain: Willpower 5 vs 3 × 2
    await m.raiseWardRitual({ force: 3, payMaterials: false });
    assert.ok(has(/Ward drain L \(TN 6\)/));
    assert.ok(has(/lasts 2 day/));
  });
  test('book: a broken geas adds +2 TN to magical tests and takes no Magic', async (t) => {
    const m = mage({ geasa: [{ text: 'Talisman', magic: 1, met: false, checkOnCast: false }] });
    assert.equal(m.system.derived.magic, 6);
    faces.push(...Array(10).fill(1));
    await m.castSpell(spell(), { force: 3 });
    assert.ok(has(/Broken geasa/));
    t.after(oldWay({ 'SORCERY_V923.geasa': 'v922' }));
    const o = mage({ geasa: [{ text: 'Talisman', magic: 1, met: false, checkOnCast: false }] });
    assert.equal(o.system.derived.magic, 5);
  });
  test('book: dispelling only a spell of Force up to the grade', async () => {
    const caster = mage({ name: 'Caster', sustaining: [{ spellName: 'Armor', force: 3, category: 'manipulation', focusId: '', successes: 3 }] });
    const d = mage({ name: 'Dispeller', initiateGrade: 2, metamagic: { dispelling: true } });
    assert.equal(await d.dispel(caster, 0), null);
    assert.match(warnings.at(-1) ?? '', /up to the initiate grade \(2\)/);
    const d3 = mage({ name: 'Dispeller', initiateGrade: 3, metamagic: { dispelling: true } });
    faces.push(5, 5, 5, 5, 1);                        // Sorcery 5 vs 3: 4 successes, Force 3 → 1
    faces.push(...Array(10).fill(1));
    await d3.dispel(caster, 0);
    assert.equal(caster.system.sustaining[0].force, 1);
  });
  test('book: a free spirit bound by its true name: Force + Spirit Energy, no Karma, not opposed', async () => {
    const m = conjurer();
    const s = spirit({ system: { force: 4, spiritKind: 'free', spiritEnergy: 2, trueName: 'Ashkaran' } });
    faces.push(6, 1, 1, 1, 1, 1);                     // Conjuring 5 vs 6: 1 success (the 6 rolls again)
    faces.push(...Array(4).fill(1));                  // conjuring drain
    await m.bindByTrueName(s, 'Ashkaran');
    assert.ok(has(/TN = Force 6/));
    assert.ok(!has(/resists the binding/));
    assert.equal(m.system.karma.good, 30);
  });
});

describe('v0.92.3 regeneration (Core p. 219)', () => {
  test('book: a full Physical track calls for 1D6; a 1 kills; otherwise it heals', async (t) => {
    const c = who({ name: 'Troll', type: 'npc', monitor: { physical: 10, stun: 0 } }, [{ id: 'rg', type: 'power', name: 'Regeneration', system: { special: 'regeneration' } }]);
    faces.push(1);
    assert.equal(await c.regenerateTick(), 0);
    assert.ok(has(/it is dead/));
    const d = who({ name: 'Troll 2', type: 'npc', monitor: { physical: 10, stun: 0 } }, [{ id: 'rg', type: 'power', name: 'Regeneration', system: { special: 'regeneration' } }]);
    faces.push(5);
    assert.equal(await d.regenerateTick(), 10);
    t.after(oldWay({ 'SPIRITS_V923.regenDeath': 'v922' }));
    const e = who({ name: 'Troll 3', type: 'npc', monitor: { physical: 10, stun: 0 } }, [{ id: 'rg', type: 'power', name: 'Regeneration', system: { special: 'regeneration' } }]);
    assert.equal(await e.regenerateTick(), 10);
  });
});
