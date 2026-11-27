/**
 * v0.96.0 spirits and astral (RULES.SPIRITS_V96), behaviour through the real documents/index.ts and
 * applications/spirits96.ts with the stubs of v095-core-glue.test.ts (scripted dice, a chat log, warnings): the
 * world-time upkeep, disruption, a free spirit's true name, watchers, the astral skill and pool, reading an aura again,
 * reflecting, cleansing, the critter-power lines and the spirit duel; and for each switch, that its other value gives
 * the v0.95.1 behaviour at the read site.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
    time: { worldTime: 0 }, settings: { get: (_s: string, k: string) => settings[k], set: async (_s: string, k: string, v: unknown) => { settings[k] = v; }, register: () => {} },
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
  a.uuid = `Actor.s96-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness', more: any = {}) => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, ...more } });




const SYS = 'shadowrun2e_unified';
const DAY = 86400;
let G96: any;
// The new strings come from public/lang/en.json (english-lang.ts); until the lead merges the drafts, from the drafts.
const DRAFTS = ['spirits96.json', 'spirits96-fix.json'].map((f) => join(import.meta.dirname, '..', '..', '..', 'i18n-drafts', f));
before(async () => {
  G96 = await import('../applications/spirits96.ts');
  // The new strings, until the lead merges them into lang/en.json (then that file has them and this adds nothing).
  const en = (globalThis as any).__SR2E_EN__ ?? ((globalThis as any).__SR2E_EN__ = {});
  for (const d of DRAFTS) if (existsSync(d)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(d, 'utf8')))) if (!(k in en)) en[k] = v;
});

const dialogs = (o: any) => { g.foundry.applications.api.DialogV2 = { confirm: async () => true, prompt: async () => null, wait: async () => null, ...o }; };
beforeEach(() => { dialogs({}); });

/** A spirit on the real data model. */
function spirit(over: any = {}, name = 'Fire elemental'): any {
  const sys = Object.create(SpiritDataModel.prototype);
  sys.attributes = Object.fromEntries(Object.keys(A).map((k) => [k, { base: 0, mod: 0 }]));
  Object.assign(sys, {
    essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 0 },
    poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 }, astral: 'physical', materialized: true,
    force: 4, spiritKind: 'elemental', spiritType: name, services: 3, summonerUuid: 'Actor.mage', immuneNormalWeapons: true, element: 'fire', departsAt: -1, trueName: '',
    offsets: Object.fromEntries(Object.keys(A).map((k) => [k, 0])), ...over,
  });
  const s = new SR2Actor();
  Object.assign(s, { system: sys, type: 'spirit', name, uuid: `Actor.s96spirit-${++n}`, id: `sp${n}`, statuses: new Set<string>() });
  s.items = withGet([]);
  sys.parent = s; sys.prepareDerivedData();
  uuidRegistry.set(s.uuid, s);
  return s;
}
/** One scene holding tokens of these actors. */
const sceneWith = (...actors: any[]) => { g.game.scenes = Object.assign([{ id: 'sc1', tokens: actors.map((a) => ({ actorId: a.id, actorLink: true, actor: a })) }], { viewed: { id: 'sc1' } }); };
const last = () => chat[chat.length - 1];

describe('an elemental\'s day of waiting (Core p. 141)', () => {
  test('on a scene: the clock starts, each full day costs a service, the last one sends it away', async () => {
    const e = spirit(); sceneWith(e);
    await G96.elementalWaitTick(e, 1000);
    assert.equal(e.getFlag(SYS, G96.WAIT_FLAG), 1000);
    assert.equal(await G96.elementalWaitTick(e, 1000 + 2 * DAY + 5), true);
    assert.equal(e.system.services, 1);
    assert.equal(e.getFlag(SYS, G96.WAIT_FLAG), 1000 + 2 * DAY);
    await G96.elementalWaitTick(e, 1000 + 3 * DAY);
    assert.equal(e.system.services, 0);
    assert.match(String(last().content), /departs/);
  });
  test('a time in the future starts the clock now; placing its token starts it', async () => {
    const e = spirit(); sceneWith(e);
    await e.setFlag(SYS, G96.WAIT_FLAG, 10 * DAY);
    await G96.elementalWaitTick(e, DAY);
    assert.equal(e.getFlag(SYS, G96.WAIT_FLAG), DAY);
    const f = spirit(); g.game.time = { worldTime: 500 };
    await G96.tokenPlaced({ actor: f });
    assert.ok(Number.isFinite(Number(f.getFlag(SYS, G96.WAIT_FLAG))));
  });
  test('off every scene: no cost, the clock stops', async () => {
    const e = spirit(); g.game.scenes = Object.assign([], { viewed: null });
    await e.setFlag(SYS, G96.WAIT_FLAG, 0);
    assert.equal(await G96.elementalWaitTick(e, 5 * DAY), false);
    assert.equal(e.system.services, 3);
  });
  test('through the lead GM\'s magicTicks; v951: it may wait for ever', async (t) => {
    const e = spirit(); sceneWith(e); g.game.actors = [e];
    await SR2Actor.magicTicks({ worldTime: 0 });
    await SR2Actor.magicTicks({ worldTime: DAY });
    assert.equal(e.system.services, 2);
    t.after(oldWay({ 'SPIRITS_V96.elementalWaiting': 'v951' }));
    await SR2Actor.magicTicks({ worldTime: 5 * DAY });
    assert.equal(e.system.services, 2);
  });
});

describe('disruption (Grimoire p. 64)', () => {
  test('a return date 28 − Force days on, then back with no damage', async () => {
    const e = spirit({ force: 4 });
    g.game.time = { worldTime: 0 };
    const line = await G96.disrupted(e);
    assert.match(line, /24 day/);
    assert.deepEqual(e.getFlag(SYS, G96.DISRUPTED_FLAG), { at: 0, until: 24 * DAY });
    e.system.monitor = { physical: 10, stun: 3 };
    e.system.derived.status = 'disrupted';
    assert.equal(await G96.disruptionTick(e, 23 * DAY), false);
    assert.equal(await G96.disruptionTick(e, 24 * DAY), true);
    assert.deepEqual([e.system.monitor.physical, e.system.monitor.stun], [0, 0]);
    assert.equal(e.getFlag(SYS, G96.DISRUPTED_FLAG), undefined);
  });
  test('a forged flag heals nothing: not disrupted, or a shorter wait, just drops the flag', async () => {
    const e = spirit({ force: 4 });
    e.system.monitor = { physical: 5, stun: 0 };
    await e.setFlag(SYS, G96.DISRUPTED_FLAG, { at: 0, until: 0 });
    e.system.derived.status = 'disrupted';
    assert.equal(await G96.disruptionTick(e, DAY), false);
    assert.equal(e.system.monitor.physical, 5);
    assert.equal(e.getFlag(SYS, G96.DISRUPTED_FLAG), undefined);
    await e.setFlag(SYS, G96.DISRUPTED_FLAG, { at: 0, until: 24 * DAY });
    e.system.derived.status = 'ok';
    assert.equal(await G96.disruptionTick(e, 30 * DAY), false, 'not disrupted');
    assert.equal(e.system.monitor.physical, 5);
  });
  test('a watcher is destroyed instead; v951: no date', async (t) => {
    assert.match(await G96.disrupted(spirit({ spiritKind: 'watcher' })), /destroyed/);
    t.after(oldWay({ 'SPIRITS_V96.disruption': 'v951' }));
    const e = spirit();
    assert.equal(await G96.disrupted(e), '');
    assert.equal(e.getFlag(SYS, G96.DISRUPTED_FLAG), undefined);
  });
});

describe('a free spirit\'s true name (Grimoire p. 77)', () => {
  const mage = () => who({ name: 'Mage', magic: 6, tradition: 'hermetic' }, [skill('conj', 'Conjuring', 5, 'charisma')]);
  test('the wrong name: refused, no roll; the right one: the banishing goes ahead', async () => {
    const m = mage(); const f = spirit({ spiritKind: 'free', summonerUuid: '', trueName: 'Azreth' }, 'Free spirit');
    dialogs({ prompt: async () => 'Bob' });
    assert.equal(await m.banish(f), null);
    assert.ok(warnings.some((w) => /true name/.test(w)));
    dialogs({ prompt: async () => 'azreth' });
    assert.equal(await G96.mayBanish(m, f), true);
  });
  test('its binder knows it; another spirit needs nothing; v951: anyone', async (t) => {
    const m = mage();
    assert.equal(await G96.mayBanish(m, spirit({ spiritKind: 'free', summonerUuid: m.uuid, trueName: 'X' })), true);
    assert.equal(await G96.mayBanish(m, spirit()), true);
    t.after(oldWay({ 'SPIRITS_V96.freeSpiritBanish': 'v951' }));
    assert.equal(await G96.mayBanish(m, spirit({ spiritKind: 'free', summonerUuid: '', trueName: 'X' })), true);
  });
});

describe('watchers (Grimoire p. 73)', () => {
  const mage = () => who({ name: 'Mage', magic: 6, tradition: 'hermetic' }, [skill('conj', 'Conjuring', 7, 'charisma')], { ...A, charisma: 4 });
  test('the book example: TN = 4 hours, 3 successes give Force 1, 4L Stun Drain; it dissolves after 4 hours', async () => {
    const m = mage();
    g.game.time = { worldTime: 0 };
    faces.push(1, 1, 2, 3, 4, 4, 6, 1);          // Conjuring 7 vs 4: 3 successes (the 6 re-rolls a 1)
    faces.push(2, 2, 3, 5);                      // Drain: Charisma 4 vs 4: 1 success
    await m.conjure({ force: 6, spiritKind: 'watcher', spiritType: 'Watcher', watcherHours: 4 });
    assert.equal(faces.length, 0);
    assert.ok(chat.some((m2) => /Watcher Drain \(Force 1 × 4 h/.test(String(m2.content))));
    const made = created.find((d) => d.system?.spiritKind === 'watcher');
    assert.ok(made, 'the watcher was created');
    assert.equal(made.system.force, 1);
    assert.equal(made.system.departsAt, 4 * 3600);
    const w = spirit({ spiritKind: 'watcher', departsAt: 4 * 3600, force: 1 }, 'Watcher');
    assert.equal(await G96.watcherTick(w, 3 * 3600), false);
    assert.equal(await G96.watcherTick(w, 4 * 3600), true);
    assert.equal(w.system.services, 0);
  });
  test('a Karma re-roll that gives it Force: the Drain comes then, for the new Force', async () => {
    const m = mage();
    m.system.karma = { pool: 2, poolSpent: 0, good: 0, career: 0 }; m.system.prepareDerivedData();
    faces.push(5, 1, 1, 1, 1, 1, 1);             // 1 success: no Force, no watcher, no Drain
    await m.conjure({ force: 6, spiritKind: 'watcher', spiritType: 'Watcher', watcherHours: 4 });
    assert.ok(!chat.some((c) => /Watcher Drain/.test(String(c.content))));
    const msg = chat[chat.length - 1];
    faces.push(5, 5, 5, 1, 1, 1);                // the six failures again: 4 successes, Force 2
    faces.push(1, 1, 1, 1);                      // Drain: Charisma 4 vs 8
    dialogs({ wait: async () => 'own' });
    await m.karmaReroll(msg.getFlag(SYS, 'test'), msg);
    assert.ok(chat.some((c) => /Watcher Drain \(Force 2 × 4 h/.test(String(c.content))), chat.map((c) => c.content).join('\n'));
    assert.equal(created.find((d) => d.system?.spiritKind === 'watcher')?.system.force, 2);
    assert.equal(faces.length, 0);
  });
  test('v951: the TN is its Force (capped at 1), conjuring Drain', async (t) => {
    t.after(oldWay({ 'SPIRITS_V96.watchers': 'v951' }));
    const m = mage();
    faces.push(5, 5, 1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5);
    await m.conjure({ force: 6, spiritKind: 'watcher', spiritType: 'Watcher', watcherHours: 4 });
    assert.ok(warnings.some((x) => /Force/.test(x)), 'capped');
    assert.ok(!chat.some((m2) => /Watcher Drain/.test(String(m2.content))));
    assert.ok(chat.some((m2) => /Conjuring drain/i.test(String(m2.content))));
  });
  test('the Summon dialog\'s row and its value', (t) => {
    assert.match(G96.watcherHoursRow(), /name="watcherHours96"/);
    assert.equal(G96.readWatcherHours({ watcherHours96: { value: '3' } }), 3);
    assert.equal(G96.readWatcherHours({}), undefined);
    t.after(oldWay({ 'SPIRITS_V96.watchers': 'v951' }));
    assert.equal(G96.watcherHoursRow(), '');
  });
});

describe('the astral attack skill and the Astral Combat Pool (Core p. 147)', () => {
  const mage = (astral = 'perceiving') => who({ name: 'Mage', magic: 6, tradition: 'hermetic', astral }, [skill('sor', 'Sorcery', 3, 'willpower'), skill('una', 'Unarmed Combat', 5, 'strength')]);
  test('the better skill, Unarmed here', () => {
    const m = mage();
    assert.equal(G96.astralSkillFor(m, false).name, 'Unarmed Combat');
  });
  test('v951: none (the caller keeps ASTRAL.attackSkill)', (t) => { t.after(oldWay({ 'SPIRITS_V96.astralSkill': 'v951' })); assert.equal(G96.astralSkillFor(mage(), false), null); });
  test('perceiving: its own Astral Combat Pool count; projecting: the Combat Pool (the astral pool); v951: the Combat Pool', (t) => {
    const m = mage();
    assert.equal(m.poolFor({ astral: true }), 'astral');
    assert.equal(m.system.derived.astralPoolLeft, 7, '(5 + 5 + 4) ÷ 2');
    assert.equal(m.poolFor({}), 'combat', 'a physical action keeps the Combat Pool');
    assert.equal(mage('projecting').poolFor({ astral: true }), 'combat');
    t.after(oldWay({ 'SPIRITS_V96.astralPerceiving': 'v951' }));
    assert.equal(m.poolFor({ astral: true }), 'combat');
  });
});

describe('reading an aura again (Grimoire p. 90)', () => {
  test('+2 on the second reading, refused once above Magic; another scene starts afresh', async () => {
    const r = who({ name: 'Reader', magic: 6, tradition: 'hermetic' }); const tgt = who({ name: 'Subject' });
    const mag = Number(r.system.derived.magic);
    g.game.scenes = Object.assign([], { viewed: { id: 'sc1' } });
    assert.deepEqual(await G96.assenseAgain(r, tgt, 4), []);
    const mods = await G96.assenseAgain(r, tgt, 4);
    assert.equal(mods[0].value, 2);
    assert.ok(mag >= 6 && mag < 8, String(mag));
    assert.equal(await G96.assenseAgain(r, tgt, 4), false, '4 + 4 = 8 > Magic');
    g.game.scenes = Object.assign([], { viewed: { id: 'sc2' } });
    assert.deepEqual(await G96.assenseAgain(r, tgt, 4), []);
  });
  test('v951: nothing', async (t) => { t.after(oldWay({ 'SPIRITS_V96.assenseRepeat': 'v951' })); assert.equal(await G96.assenseAgain(who(), who(), 4), null); });
});

describe('reflecting (Awakenings p. 99)', () => {
  test('back at the net Force: the defender rolls it against the caster\'s Willpower; the card carries the Resist button', async () => {
    const caster = who({ name: 'Wage mage', magic: 4, tradition: 'hermetic' }, [], { ...A, willpower: 6 });
    const talon = who({ name: 'Talon', magic: 6, tradition: 'hermetic' });
    faces.push(6, 3, 5);                         // 2 dice vs 6: 6 and 3, the 6 re-rolls a 5 (11): 1 success
    const r = await G96.reflectRebound(talon, { casterUuid: caster.uuid, spellName: 'Manabolt', force: 4, resistAttribute: 'willpower', level: 'M', damageType: 'physical', defense: 6, reflected96: false }, 2, 4);
    assert.equal(r.flags.spell.force, 2);
    assert.equal(r.flags.spell.casterSuccesses, 1);
    assert.equal(r.flags.spell.reflected, true);
    assert.match(r.html, /data-sr2e-action="resistSpell"/);
    assert.match(r.html, /11, 3/, 'the dice are shown');
    assert.deepEqual(r.reflect.rebound96, { dice: [11, 3], tn: 6 });
    // Resolved again (a re-roll): the same dice, nothing rolled; a lower Force uses the first ones.
    const again = await G96.reflectRebound(talon, r.reflect, 2, 4);
    assert.equal(again.flags.spell.casterSuccesses, 1);
    const lower = await G96.reflectRebound(talon, r.reflect, 2, 3);
    assert.equal(lower.flags.spell.force, 1);
    assert.equal(faces.length, 0);
  });
  test('not enough shielding successes: nothing; a Force 1 spell reflected again dissipates', async () => {
    const talon = who({ name: 'Talon' });
    assert.equal((await G96.reflectRebound(talon, { casterUuid: '', spellName: 'X', force: 4 }, 2, 2)).html, '');
    assert.match((await G96.reflectRebound(talon, { casterUuid: '', spellName: 'X', force: 1, reflected96: true }, 0, 3)).html, /dissipates/);
  });
});

describe('reflecting through resistSpell', () => {
  const setup = () => {
    const caster = who({ name: 'Wage mage', magic: 4, tradition: 'hermetic' }, [], { ...A, willpower: 6 });
    const talon = who({ name: 'Talon', magic: 6, tradition: 'hermetic', spellDefense: 3 });
    Object.defineProperty(talon, 'initiate', { value: { grade: 1, techniques: ['reflecting'] }, configurable: true });
    const state = { casterUuid: caster.uuid, targetUuid: talon.uuid, spellName: 'Manabolt', force: 4, resistAttribute: 'willpower', level: 'M', damageType: 'stun', casterSuccesses: 1, noun: 'spell' };
    return { caster, talon, state };
  };
  test('only the 3 spell defense dice count: 3 successes vs 1 rebound at Force 2', async () => {
    const { talon, state } = setup();
    faces.push(1, 1, 1, 1, 1);                   // Willpower 5 vs 4: nothing
    faces.push(5, 5, 5);                         // the shielding (spell defense) dice: 3 successes
    faces.push(6, 2, 1);                         // the rebound: 2 dice vs Willpower 6: the 6 re-rolls a 2 (8): 1 success
    await talon.resistSpell(state, 0);
    const card = chat.find((c) => /reflects Manabolt back at Force 2/.test(String(c.content)));
    assert.ok(card, chat.map((c) => c.content).join('\n'));
  });
  test('too few shielding successes: nothing; a Karma re-roll keeps the tags (the re-rolled dice are reordered) and rebounds', async () => {
    const { talon, state } = setup();
    faces.push(1, 1, 1, 1, 1);
    faces.push(5, 1, 1);                         // shielding dice: 1 success, not more than the caster's 1
    await talon.resistSpell(state, 0);
    assert.ok(!chat.some((c) => /reflects Manabolt back/.test(String(c.content))));
    const msg = chat[chat.length - 1];
    const snap = msg.getFlag(SYS, 'test');
    assert.equal(snap.dice.filter((d: any) => d.shield).length, 3);
    talon.system.karma = { pool: 2, poolSpent: 0, good: 0, career: 0 }; talon.system.prepareDerivedData();
    faces.push(1, 1, 1, 1, 1, 5, 5);             // the 7 failed dice again: the last two (shielding) succeed
    faces.push(6, 2, 1);                         // the rebound at Force 2 (3 − 1): 1 success
    dialogs({ wait: async () => 'own' });
    await talon.karmaReroll(snap, msg);
    const after = chat.filter((c) => /reflects Manabolt back at Force 2/.test(String(c.content)));
    assert.ok(after.length >= 1, JSON.stringify([faces.length, warnings, chat.map((c) => c.content)]));
    const snap2 = (after[after.length - 1] as any).getFlag(SYS, 'test');
    assert.equal(snap2.dice.filter((d: any) => d.shield).length, 3, 'the tags went with the re-rolled dice');
    assert.deepEqual(snap2.soak.reflect.rebound96.dice.length, 2);
  });
  test('v951: all the resistance successes over the caster\'s bounce back', async (t) => {
    t.after(oldWay({ 'SPIRITS_V96.reflecting': 'v951' }));
    const { talon, state } = setup();
    faces.push(5, 5, 1, 1, 1, 5, 1, 1);          // 3 successes in all
    await talon.resistSpell(state, 0);
    assert.ok(!chat.some((c) => /reflects Manabolt back/.test(String(c.content))));
    assert.ok(chat.some((c) => /\(reflected\)|Reflected/i.test(String(c.content))), chat.map((c) => c.content).join('\n'));
  });
});

describe('cleansing (Awakenings p. 100)', () => {
  test('refused above the grade (no roll)', async () => {
    const m = who({ name: 'Init', magic: 6, tradition: 'hermetic', astral: 'perceiving', initiateGrade: 1, metamagic: { cleansing: true } }, [skill('sor', 'Sorcery', 6, 'willpower')]);
    m.backgroundInfo = () => ({ penalty: 3, toxic: false });
    g.game.scenes = Object.assign([{ id: 'sc1' }], { viewed: { id: 'sc1' } });
    Object.defineProperty(m, 'initiate', { value: { grade: 1, techniques: ['cleansing'] }, configurable: true });
    const r = await m.cleanse();
    assert.equal(r, null);
    assert.ok(warnings.some((w) => /grade/.test(w)), warnings.join(' | '));
  });
});

describe('cleansing (Awakenings p. 100): the Drain', () => {
  const init = (grade: number) => {
    const m = who({ name: 'Init', magic: 6, tradition: 'hermetic', astral: 'perceiving' }, [skill('sor', 'Sorcery', 6, 'willpower')]);
    m.backgroundInfo = () => ({ penalty: 2, toxic: false });
    Object.defineProperty(m, 'initiate', { value: { grade, techniques: ['cleansing'] }, configurable: true });
    g.game.scenes = Object.assign([{ id: 'sc1', getFlag: () => undefined, setFlag: async () => {} }], { viewed: { id: 'sc1' }, get: () => undefined });
    return m;
  };
  test('a count up to the grade: the test, then (2)D Drain against Willpower', async () => {
    const m = init(2);
    faces.push(1, 1, 1, 1, 1, 1);                // Sorcery 6 vs 4: nothing
    faces.push(5, 5, 5, 5, 5);                   // Drain: Willpower 5 vs 2
    await m.cleanse();
    assert.ok(chat.some((c) => /Cleansing Drain/.test(String(c.content))), chat.map((c) => c.content).join('\n'));
  });
  test('v951: no refusal, no Drain', async (t) => {
    t.after(oldWay({ 'SPIRITS_V96.cleansing': 'v951' }));
    const m = init(0);
    faces.push(1, 1, 1, 1, 1, 1);
    await m.cleanse();
    assert.ok(!chat.some((c) => /Cleansing Drain/.test(String(c.content))));
    assert.ok(!warnings.some((w) => /grade/.test(w)));
  });
});

describe('critter powers (Predator and Prey pp. 89–92)', () => {
  test('Fear\'s severity, Engulf\'s entry, Confusion\'s TN; nothing on a miss or under v951', (t) => {
    assert.match(G96.powerOutcomeLine('fear', 'Fear', 4, true), /sweats blood/);
    assert.match(G96.powerOutcomeLine('', 'Engulf', 1, true), /walking pace.*Strength/);
    assert.match(G96.powerOutcomeLine('confusion', 'Confusion', 5, true), /\+2/);
    assert.equal(G96.powerOutcomeLine('fear', 'Fear', 0, false), '');
    t.after(oldWay({ 'SPIRITS_V96.critterOpposed': 'v951' }));
    assert.equal(G96.powerOutcomeLine('fear', 'Fear', 4, true), '');
  });
});

describe('spirit against spirit (Core p. 143)', () => {
  test('Force 4 vs Force 3: 3 successes to 1, the water elemental drops to 1', async () => {
    const fire = spirit({ force: 4 }, 'Fire elemental'); const water = spirit({ force: 3 }, 'Water elemental');
    faces.push(3, 4, 5, 1);                      // fire: 4 dice vs 3: 3 successes
    faces.push(4, 1, 2);                         // water: 3 dice vs 4: 1 success
    const out = await G96.spiritDuel(fire, water);
    assert.deepEqual(out, { loser: 'b', loss: 2, force: 1, destroyed: false });
    assert.equal(water.system.force, 1);
    assert.match(String(last().content), /loses 2 Force/);
  });
  test('only for the GM; v951: no duel', async (t) => {
    g.game.user = { id: 'p1', isGM: false };
    assert.equal(await G96.spiritDuel(spirit(), spirit()), undefined);
    g.game.user = GM();
    t.after(oldWay({ 'SPIRITS_V96.spiritDuel': 'v951' }));
    assert.equal(await G96.spiritDuel(spirit(), spirit()), undefined);
  });
});

describe('aid in spell defense (Core p. 141)', () => {
  test('dice from an aid already started, as many as asked; they are gone', async () => {
    const m = who({ name: 'Mage', magic: 6, tradition: 'hermetic' });
    const e = spirit({ summonerUuid: m.uuid, element: 'fire' });
    await e.setFlag(SYS, 'aidLeft', 3);
    g.game.actors = [m, e];
    e.isOwner = true;
    dialogs({ prompt: async () => 2 });
    assert.equal(await G96.askAidDefense(m, { category: 'combat' }), 2);
    const r = await G96.aidDefense(m, { category: 'combat' }, () => true, 2);
    assert.equal(r.dice, 2);
    assert.equal(e.getFlag(SYS, 'aidLeft'), 1);
    assert.deepEqual(await G96.aidDefense(m, { category: 'illusion' }, () => true, 1), { dice: 0, note: '' }, 'a fire elemental aids combat spells only');
    assert.equal(await G96.askAidDefense(m, { category: 'illusion' }), 0);
  });
  test('never more than its Force; the GM isn\'t asked for a player\'s elemental; off with SORCERY_V923.elementalAid', async (t) => {
    const m = who({ name: 'Mage', magic: 6, tradition: 'hermetic' });
    const e = spirit({ summonerUuid: m.uuid, element: 'fire', force: 3 });
    await e.setFlag(SYS, 'aidLeft', 50);
    g.game.actors = [m, e];
    assert.equal(G96.aidLeftOf(e), 3);
    e.isOwner = true; e.hasPlayerOwner = true;
    let asked = false;
    dialogs({ prompt: async () => { asked = true; return 1; } });
    assert.equal(await G96.askAidDefense(m, { category: 'combat' }), 0);
    assert.equal(asked, false);
    t.after(oldWay({ 'SORCERY_V923.elementalAid': 'v922' }));
    assert.deepEqual(await G96.aidDefense(m, { category: 'combat' }, () => true, 2), { dice: 0, note: '' });
  });
  test('resistSpell under the GM lock asks nothing (it would deadlock): no aid dice without a count', async () => {
    const { withGmLock } = await import('../applications/gmlock.ts');
    const m = who({ name: 'Mage', magic: 6, tradition: 'hermetic' });
    const e = spirit({ summonerUuid: m.uuid, element: 'fire' });
    await e.setFlag(SYS, 'aidLeft', 3); e.isOwner = true;
    g.game.actors = [m, e];
    dialogs({ prompt: () => new Promise(() => {}) });   // a dialog nobody answers
    faces.push(1, 1, 1, 1, 1);
    const state = { casterUuid: who().uuid, targetUuid: m.uuid, spellName: 'Manabolt', force: 4, resistAttribute: 'willpower', level: 'M', damageType: 'stun', casterSuccesses: 1, noun: 'spell', aid96: { category: 'combat', element: '' } };
    const done = withGmLock(() => m.resistSpell(state, 0)).then(() => 'done');
    const out = await Promise.race([done, new Promise((r) => setTimeout(() => r('timeout'), 2000))]);
    assert.equal(out, 'done');
    assert.equal(e.getFlag(SYS, 'aidLeft'), 3, 'nothing taken');
  });
  test('v951: none', async (t) => {
    t.after(oldWay({ 'SPIRITS_V96.aidDefense': 'v951' }));
    assert.deepEqual(await G96.aidDefense(who(), { category: 'combat' }, () => true), { dice: 0, note: '' });
  });
});

describe('tech melee enhancements against spirits (Awakenings p. 101)', () => {
  test('the weapon\'s own tweak Power against a manifest spirit', (t) => {
    const sp = spirit();
    const tw = { weaponSelf: { w1: 1 } };
    t.after(oldWay({ 'SHEET_V921.tweaks': 'on' }));
    assert.equal(G96.techPowerLost({ id: 'w1' }, tw, sp.uuid), 1);
    assert.equal(G96.techPowerLost({ id: 'w1' }, tw, who().uuid), 0);
    assert.equal(G96.techPowerLost({ id: 'w1' }, tw, spirit({ materialized: false }).uuid), 0);
  });
});
