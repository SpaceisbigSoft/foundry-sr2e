/**
 * v0.95.0 core (RULES.CORE_V95), behaviour through the real documents/index.ts and applications/core95.ts with the
 * stubs of v078.test.ts (scripted dice, a chat log, warnings): Team Karma on the Karma paths, racism in the social
 * sides for the GM and a player, athletics, the instructor, lifestyle, contacts and the card buttons; and for each
 * switch, that its other choice gives the v0.94.2 behaviour at a read site.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';

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
  a.uuid = `Actor.c95-${++n}`; a.id = `id${n}`;
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
const PLAYER = () => ({ id: 'p1', name: 'Player', isGM: false, can: () => true });
let C95: any;
before(async () => { C95 = await import('../applications/core95.ts'); });

/** The world's actors and messages as Foundry's collections (get by id). */
function world(...actors: any[]) {
  g.game.actors = Object.assign([...actors], { get: (id: string) => actors.find((a) => a.id === id) });
  g.game.messages = Object.assign(chat, { contents: chat, get: (id: string) => chat.find((m) => m.id === id) });
}
/** A character with an own Karma Pool, owned by the player p1. */
function pc(poolN = 0, extra: any = {}, items: any[] = [], attrs?: Record<string, number>) {
  const a = who({ karma: { pool: poolN, poolSpent: 0, good: 30, career: 30 }, ...extra }, items, attrs);
  a.testUserPermission = (u: any) => Boolean(u?.isGM || u?.id === 'p1');
  a.hasPlayerOwner = true;
  return a;
}
const team = (members: string[], p: number, spent = 0) => { settings['teamPool95'] = { members, pool: p, spent }; };
const pool = () => settings['teamPool95'] as any;
const dialogs = (o: any) => { g.foundry.applications.api.DialogV2 = { confirm: async () => true, prompt: async () => null, wait: async () => null, ...o }; };
const last = () => chat[chat.length - 1];

beforeEach(() => { world(); dialogs({}); });

describe('v0.95.0 core glue: the Team Karma Pool on the Karma paths', () => {
  test('Karma dice through #runTest: the ticked roll takes them from the team pool, the own pool is untouched', async () => {
    const a = pc(0); world(a); team([a.id], 3);
    C95.setTeamDiceForTest(true);
    faces.push(5, 5, 5, 5, 5, 5, 5);
    await a.rollAttribute('quickness', { targetNumber: 4, karmaDice: 2 });
    assert.equal(pool().spent, 2);
    assert.equal(a.system.karma.poolSpent, 0);
    assert.ok(chat.some((m) => /Karma/.test(String(m.content))));
  });
  test('without the tick the dice come from the own pool only (v0.94.2)', async () => {
    const a = pc(1); world(a); team([a.id], 3);
    faces.push(5, 5, 5, 5, 5, 5);
    await a.rollAttribute('quickness', { targetNumber: 4, karmaDice: 2 });
    assert.equal(pool().spent, 0);
    assert.equal(a.system.karma.poolSpent, 1, 'capped at the own pool');
  });
  test('the roll dialog row shows for a member with no own pool, capped at own + team', () => {
    const a = pc(0); world(a); team([a.id], 3);
    const row = C95.karmaDiceRow(a, 0, true, 5);
    assert.match(row, /max="3"/); assert.match(row, /name="teamKarma95" checked/);
    team([], 3);
    assert.equal(C95.karmaDiceRow(a, 0, true, 5), '', 'not a member: the book row (nothing with no own pool)');
  });
  test('a Karma re-roll through #spendKarma: a member with no own pool pays from the team; it reports the spend', async () => {
    const a = pc(0); world(a); team([a.id], 3);
    faces.push(1, 1, 1, 1, 1);
    await a.rollAttribute('quickness', { targetNumber: 4 });
    const snap = last().getFlag(SYS, 'test');
    faces.push(5, 5, 5, 5, 5);
    dialogs({ wait: async () => 'team' });
    const spent = await a.karmaReroll(snap, last());
    assert.equal(spent, true);
    assert.equal(pool().spent, 1);
    assert.equal(a.system.karma.poolSpent, 0);
  });
  test('buySuccess paid by the team for good', async (t) => {
    t.after(oldWay({ 'KARMA.buyPermanent': true }));
    const a = pc(0); world(a); team([a.id], 3);
    faces.push(5, 1, 1, 1, 1);
    await a.rollAttribute('quickness', { targetNumber: 4 });
    const msg = last();
    dialogs({ wait: async () => 'team' });
    assert.equal(await a.buySuccess(msg.getFlag(SYS, 'test'), msg), true);
    assert.equal(pool().pool, 2, 'gone for good'); assert.equal(pool().spent, 0);
  });
  test('the relay: a player takes team points for good only on their own card of that character', async () => {
    const a = pc(0); world(a); team([a.id], 3);
    faces.push(5, 1, 1, 1, 1);
    await a.rollAttribute('quickness', { targetNumber: 4 });
    const msg = last();
    msg.author = { id: 'p1' };
    assert.equal((await C95.teamRelay({ op: 'spend', actorId: a.id, n: 1, permanent: true, cardId: 'nope' }, PLAYER())).ok, false);
    assert.equal(pool().pool, 3);
    assert.ok((await C95.teamRelay({ op: 'spend', actorId: a.id, n: 1, permanent: true, cardId: msg.id }, PLAYER())).ok);
    assert.equal(pool().pool, 2);
    msg.author = { id: 'p2' };
    assert.equal((await C95.teamRelay({ op: 'spend', actorId: a.id, n: 1, permanent: true, cardId: msg.id }, PLAYER())).ok, false, 'someone else\'s card');
  });
  test('v0.96.5: the team pool write is the relay\'s own, and one that does not land pays nothing', async () => {
    const a = pc(0); world(a); team([a.id], 3);
    const gs: any = (globalThis as any).game.settings;
    const plain = gs.set;
    try {
      // Like the acting-author guard in a GM's re-run of a player's card: only a write marked as the relay's goes through.
      gs.set = async (_s: string, k: string, v: unknown, o: any = {}) => { if (o?.sr2eRelay) settings[k] = v; };
      assert.ok((await C95.teamRelay({ op: 'spend', actorId: a.id, n: 1 }, PLAYER())).ok);
      assert.equal(pool().spent, 1, 'stored through the guard');
      // A write that does not land: refused, nothing counts as paid, no team line posted.
      gs.set = async () => undefined;
      const n0 = chat.length;
      const r = await C95.teamRelay({ op: 'spend', actorId: a.id, n: 1 }, PLAYER());
      assert.equal(r.ok, false);
      assert.match(String(r.note), /could not be saved/);
      assert.equal(pool().spent, 1);
      assert.equal(chat.length, n0);
    } finally { gs.set = plain; }
  });
  test('the tracker choice: no team source on the Karma paths (v0.94.2)', async (t) => {
    t.after(oldWay({ 'CORE_V95.teamKarma': 'tracker' }));
    const a = pc(0); world(a); team([a.id], 3);
    assert.equal(await C95.karmaFromTeam(a, 1), null);
    assert.equal(C95.karmaDiceRow(a, 0, true, 5), '');
  });
});

describe('v0.95.0 core glue: racism in the social sides', () => {
  const setup = () => {
    const sp = pc(0, { metatype: 'ork' }, [skill('s1', 'Negotiation', 3, 'charisma')]);
    const npc = who({ name: 'Bouncer', type: 'npc', metatype: 'human' }, [skill('s2', 'Negotiation', 2, 'charisma')]);
    npc.flags = { [SYS]: { racism95: { points: 3, all: false, against: ['ork'], own: 'human', at: 7 } } };
    world(sp, npc);
    return { sp, npc };
  };
  test('a posted card with the racism row hides its numbers from every player, the speaker too', async () => {
    const { carriesRacism } = await import('../applications/hidden941.ts');
    assert.equal(carriesRacism({ flags: { [SYS]: { test: { modifiers: [{ id: 'racism95', label: 'x', value: 2 }] } } } }), true);
    assert.equal(carriesRacism({ flags: { [SYS]: { test: { modifiers: [{ id: 'prejudice', label: 'x', value: 2 }] } } } }), false, 'the metatype table row is public as before');
    assert.equal(carriesRacism({ flags: {} }), false);
    // A social test is a contest card: its sides carry the results.
    assert.equal(carriesRacism({ flags: { [SYS]: { contest: { kind: 'social', sides: [{ result: { modifiers: [{ id: 'racism95', label: 'x', value: 2 }] } }] } } } }), true, 'a social (contest) card');
    assert.equal(carriesRacism({ flags: { [SYS]: { contest: { kind: 'social', sides: [{ result: { modifiers: [{ id: 'prejudice', label: 'x', value: 2 }] } }] } } } }), false);
  });
  test('the GM\'s preview shows it; a player\'s preview never does', () => {
    const { sp, npc } = setup();
    assert.ok(sp.socialPreview(npc, 'Negotiation').mine.some((m: any) => m.id === 'racism95' && m.value === 3));
    g.game.user = PLAYER();
    assert.ok(!sp.socialPreview(npc, 'Negotiation').mine.some((m: any) => m.id === 'racism95' || m.id === 'prejudice'), 'no racism row, and no metatype table row either');
  });
  test('the secret Charisma test is rolled on the GM\'s client and kept on the NPC; the test then uses what is left', async () => {
    const { sp, npc } = setup();
    faces.push(6, 6, 1, 1, 1, 1, 1, 1);
    await C95.racismCharisma(sp, npc, 'Negotiation');
    const off = npc.flags[SYS].racismOffsets95[sp.id];
    assert.deepEqual(off, { n: 2, at: 7 });
    assert.ok(last().whisper?.includes('gm1') && !last().blind);
    assert.equal(sp.flags?.[SYS]?.racismOffset95, undefined, 'nothing on the player\'s own actor');
    assert.equal(C95.racismFor(sp, npc).mod.value, 1);
  });
  test('a player\'s request for someone else\'s character is refused', async () => {
    const { npc } = setup();
    const other = who({ metatype: 'ork' }, [skill('s3', 'Negotiation', 3, 'charisma')]);
    other.testUserPermission = () => false;
    world(other, npc);
    const r = await C95.core95Relay({ op: 'racism', speakerUuid: other.uuid, npcUuid: npc.uuid, skillName: 'Negotiation' }, PLAYER());
    assert.equal(r.ok, false);
  });
  test('the table choice: the metatype table stands in (v0.94.2)', (t) => {
    t.after(oldWay({ 'CORE_V95.racism': 'table' }));
    const { sp, npc } = setup();
    assert.equal(C95.racismFor(sp, npc), null);
    assert.ok(sp.socialPreview(npc, 'Negotiation').mine.some((m: any) => m.id === 'prejudice' && m.value === 2), 'TN_AUTO.social.prejudice: human/ork +2');
  });
});

describe('v0.95.0 core glue: athletics', () => {
  test('a book jump: the test against the metres to clear, a tenth more per success', async () => {
    const a = pc(0, {}, [skill('s1', 'Athletics', 3, 'body')], { body: 2, quickness: 4, strength: 9, charisma: 3, intelligence: 3, willpower: 3 });
    faces.push(6, 6, 6, 1, 1, 1);
    await a.athleticsTest('jump', { running: true, c95: { metres: 6, vertical: false, water: 'swim', tread: [] } });
    assert.match(String(last().content), /6\.\d m|7\.\d m|6 m/);
    assert.match(String(last().content), /clears 6 m/);
  });
  test('floating: Body against 4 with the treading-water table; Body × successes Combat Turns', async () => {
    const a = pc(0, { metatype: 'elf' }, [], { body: 4, quickness: 4, strength: 4, charisma: 3, intelligence: 3, willpower: 3 });
    faces.push(5, 5, 1, 1);
    await a.athleticsTest('swim', { c95: { metres: 0, vertical: false, water: 'float', tread: [] } });
    assert.match(String(last().content), /8 Combat Turns/);
  });
  test('the old choices: no book plan (v0.94.2)', (t) => {
    t.after(oldWay({ 'CORE_V95.jumping': 'old', 'CORE_V95.swimming': 'old' }));
    const a = pc(0);
    assert.equal(C95.athleticsPlan(a, 'jump', false, null), null);
    assert.equal(C95.athleticsPlan(a, 'swim', false, { water: 'float', tread: [] }), null);
  });
});

describe('v0.95.0 core glue: the instructor through #resolvePlain', () => {
  const setup = () => {
    const student = pc(0, { training: [{ id: 't1', label: 'Firearms', attribute: '', skillId: 'f', part: 'rating', to: 4, cost: 8, startedAt: 0, readyAt: 56 * 86400, days: 56, baseDays: 56, by: '', approvedBy: '' }] }, [skill('f', 'Firearms', 3)]);
    const teacher = who({ name: 'Teacher' }, [skill('i1', 'Instruction', 4, 'charisma'), skill('f2', 'Firearms', 6)]);
    world(student, teacher);
    return { student, teacher };
  };
  test('two successes add one to the student\'s: with their own 2, 56 days ÷ 3', async () => {
    const { student, teacher } = setup();
    student.flags = { [SYS]: { training95: { t1: { self: 2, help: 0 } } } };
    faces.push(5, 5, 1, 1);
    await student.trainWith('t1', teacher.uuid);
    assert.equal(student.system.training[0].days, 19);
    assert.deepEqual(student.flags[SYS].training95.t1, { self: 2, help: 1 });
  });
  test('an old card re-resolved after a newer change leaves the training alone', async () => {
    const { student } = setup();
    const r = await C95.instruction(student, { trainingId: 't1', instructorName: 'T', instructorRating: 6, newRating: 4, readyAt: 123 }, 4, true);
    assert.match(r.html, /changed since/);
    assert.equal(student.system.training[0].days, 56);
  });
  test('off: the v0.94.2 instructor result stands', (t) => {
    t.after(oldWay({ 'CORE_V95.trainingTest': 'off' }));
    return C95.instruction(null, { trainingId: 't1', instructorName: 'T', instructorRating: 6, newRating: 4 }, 2, true).then((r: any) => assert.equal(r, null));
  });
});

describe('v0.95.0 core glue: lifestyle', () => {
  const DAY = 86400;
  const tenant = (late: number) => {
    const a = pc(0, { nuyen: 0, lifestyle: { level: 'middle', paidUntil: 100 * DAY, outright: false } });
    g.game.time = { worldTime: 100 * DAY + late * DAY };
    world(a);
    return a;
  };
  test('a missed month: 1D6 above the months is absorbed', async (t) => {
    t.after(oldWay({ 'UPKEEP.effects.overdue': 'auto' }));
    const a = tenant(3);
    faces.push(4);
    assert.equal(await C95.lifestyleTick(a), true);
    assert.match(String(last().content), /covers it/);
    assert.equal(a.system.lifestyle.level, 'middle');
    assert.equal(await C95.lifestyleTick(a), true); // the same month: no second roll
    assert.equal(chat.length, 1);
  });
  test('catching up three months rolls once a month; a drop moves down and the months carry on', async (t) => {
    t.after(oldWay({ 'UPKEEP.effects.overdue': 'auto' }));
    const a = tenant(65);
    faces.push(6, 6, 2);
    await C95.lifestyleTick(a);
    assert.equal(chat.filter((m) => /covers it/.test(String(m.content))).length, 2);
    assert.equal(a.system.lifestyle.level, 'low');
    assert.equal(a.getFlag(SYS, 'lifestyleDebt95'), 5000);
    // A day after the drop, the first payment at the new level is missed: 4 in a row now.
    g.game.time = { worldTime: g.game.time.worldTime + DAY };
    faces.push(5);
    await C95.lifestyleTick(a);
    assert.match(String(last().content), /\(4 in a row\)/);
  });
  test('with the GM\'s card, the months carry on after the GM moves them down', async (t) => {
    t.after(oldWay({ 'UPKEEP.effects.overdue': 'card' }));
    const a = tenant(3);
    faces.push(1);
    await C95.lifestyleTick(a);
    assert.match(String(last().content), /data-sr2e-action="evict"/);
    await a.moveLifestyleDown();
    g.game.time = { worldTime: g.game.time.worldTime + DAY };
    faces.push(6);
    await C95.lifestyleTick(a);
    assert.match(String(last().content), /\(2 in a row\)/);
  });
  test('grace: the v0.94.2 rule runs instead', (t) => {
    t.after(oldWay({ 'CORE_V95.missedPayments': 'grace' }));
    return C95.lifestyleTick(tenant(3)).then((r: boolean) => assert.equal(r, false));
  });
  test('selling: moves to the level picked, pays the dice × 10 percent, once', async () => {
    const a = pc(0, { nuyen: 0, lifestyle: { level: 'middle', paidUntil: -1, outright: true } });
    world(a);
    let release: (v: any) => void = () => {};
    dialogs({ wait: () => new Promise((r) => { release = r; }) });
    const first = C95.sellLifestyle(a);
    assert.equal(await C95.sellLifestyle(a), true, 'a second click while the first is open does nothing');
    faces.push(3, 4);
    release({ dice: 2, to: 'low' });
    await first;
    assert.equal(a.system.lifestyle.level, 'low'); assert.equal(a.system.lifestyle.outright, false);
    assert.equal(a.system.nuyen, Math.round(5000 * 100 * 7 / 10));
    assert.equal(await C95.sellLifestyle(a), false, 'no longer owned outright');
  });
  test('off: can\'t be sold (v0.94.2)', (t) => {
    t.after(oldWay({ 'CORE_V95.sellLifestyle': 'off' }));
    const a = pc(0, { lifestyle: { level: 'middle', paidUntil: -1, outright: true } });
    return C95.sellLifestyle(a).then((r: boolean) => assert.equal(r, false));
  });
});

describe('v0.95.0 core glue: contacts and the card buttons', () => {
  const contact = { id: 'c1', name: 'Fixer', level: 2, role: '', notes: '', loyalty: 1, skills: '', fee: 0, dice: 0, favours: 0, fixer: false };
  test('legwork: the GM\'s card comes from the GM\'s client, to the GMs only, not blind', async () => {
    const a = pc(0, { contacts: [{ ...contact }] }, [skill('e', 'Etiquette', 3, 'charisma')]);
    world(a);
    faces.push(5, 5, 1, 1, 1, 1);
    await a.legwork('c1');
    const card = chat.find((m) => m.flags?.[SYS]?.c95Contact);
    assert.ok(card); assert.deepEqual(card.whisper, ['gm1']); assert.ok(!card.blind);
    assert.equal(card.flags[SYS].c95Contact.successes, 2);
  });
  test('the meet and fee buttons are the GM\'s', async () => {
    const msg = asMessage({ flags: { [SYS]: { c95Contact: { actorUuid: 'x', successes: 2, name: 'F' } } }, author: GM() });
    g.game.user = PLAYER();
    await C95.onCard(msg, { disabled: false } as any, 'c95Meet');
    assert.ok(warnings.some((w) => /Only the GM/.test(w)));
  });
  test('off: no card after legwork (v0.94.2)', async (t) => {
    t.after(oldWay({ 'CORE_V95.contactMeet': 'off', 'CORE_V95.contactFee': 'flat' }));
    const a = pc(0, { contacts: [{ ...contact }] }, [skill('e', 'Etiquette', 3, 'charisma')]);
    world(a);
    faces.push(5, 5, 1, 1, 1, 1);
    await a.legwork('c1');
    assert.ok(!chat.some((m) => m.flags?.[SYS]?.c95Contact));
  });
  test('Pay on a GM card pays once; a player-posted card pays nothing', async () => {
    const a = pc(0, { nuyen: 1000 }); world(a);
    const card = asMessage({ author: GM(), flags: { [SYS]: { c95Fee: { actorUuid: a.uuid, fee: 300 } } } });
    const b = { disabled: false } as any;
    await C95.onCard(card, b, 'c95PayFee');
    await C95.onCard(card, b, 'c95PayFee');
    assert.equal(a.system.nuyen, 700);
    const forged = asMessage({ author: PLAYER(), flags: { [SYS]: { c95Fee: { actorUuid: a.uuid, fee: 300 } } } });
    await C95.onCard(forged, b, 'c95PayFee');
    assert.equal(a.system.nuyen, 700);
  });
  test('the paid map keeps only the newest 50 cards', async () => {
    const a = pc(0, { nuyen: 0 }); world(a);
    a.flags = { [SYS]: { paid95: Object.fromEntries(Array.from({ length: 60 }, (_x, i) => [`old${i}`, i + 1])) } };
    await C95.onCard(asMessage({ author: GM(), flags: { [SYS]: { c95Fee: { actorUuid: a.uuid, fee: 0 } } } }), { disabled: false } as any, 'c95PayFee');
    assert.equal(Object.keys(a.flags[SYS].paid95).filter((k) => a.flags[SYS].paid95[k] != null).length, 50);
  });
  test('contact upkeep: the first tick marks a year; when due, a card; lowering works once', async (t) => {
    t.after(oldWay({ 'CORE_V95.contactUpkeep': 'book' }));
    const a = pc(0, { contacts: [{ ...contact }] }); world(a);
    await C95.contactUpkeepTick(a);
    assert.equal(chat.length, 0);
    g.game.time = { worldTime: 366 * 86400 };
    await C95.contactUpkeepTick(a);
    const card = last();
    assert.match(String(card.content), /3000/);
    card.author = GM();
    await C95.onCard(card, { disabled: false } as any, 'c95LowerContact');
    await C95.onCard(card, { disabled: false } as any, 'c95LowerContact');
    assert.equal(a.system.contacts[0].level, 1, 'lowered once');
  });
  test('contact upkeep off: nothing is marked (v0.94.2)', async () => {
    const a = pc(0, { contacts: [{ ...contact }] }); world(a);
    await C95.contactUpkeepTick(a);
    assert.equal(a.flags?.[SYS]?.contactUpkeep95, undefined);
  });
});

describe('v0.95.0 core glue: group tests', () => {
  test('group Perception: average Intelligence + a die per member; off: nothing', async (t) => {
    const a = who({}, [], { ...A, intelligence: 4 }), b = who({}, [], { ...A, intelligence: 6 });
    faces.push(5, 5, 5, 1, 1, 1, 1);
    const r = await C95.groupPerception([a, b]);
    assert.equal(r.dice.length, 7);
    t.after(oldWay({ 'CORE_V95.groupPerception': 'off', 'CORE_V95.groupAverage': 'off' }));
    assert.equal(await C95.groupPerception([a, b]), null);
    assert.equal(await C95.groupAverages([a, b]), null);
  });
});

describe('v0.95.0 core glue: the review fixes', () => {
  /** A dialog element with buttons and an optional ticked box (enough of the DOM for watchDialog). */
  const fakeDialog = (ticked: boolean | null) => {
    const handlers: Array<() => void> = [];
    const button = { addEventListener: (_e: string, fn: () => void) => { handlers.push(fn); } };
    const box = ticked === null ? null : { checked: ticked };
    return { root: { querySelectorAll: () => [button], querySelector: () => box }, click: () => handlers.forEach((f) => f()) };
  };
  test('the team tick belongs to its own dialog: another dialog pressed later uses the own pool', () => {
    const a = pc(0); world(a); team([a.id], 3);
    const d1 = fakeDialog(true), d2 = fakeDialog(null);
    C95.watchDialog(d1.root); C95.watchDialog(d2.root);
    d1.click();
    assert.equal(C95.takeTeamDice(a), true);
    assert.equal(C95.takeTeamDice(a), false, 'once');
    d1.click(); d2.click();
    assert.equal(C95.takeTeamDice(a), false, 'the dialog pressed last had no tick');
  });
  test('Cancel on a ticked dialog leaves nothing for a later roll to take from the team pool', () => {
    const a = pc(0); world(a); team([a.id], 3);
    const handlers: Record<string, Array<() => void>> = { ok: [], cancel: [] };
    const btn = (action: string) => ({ dataset: { action }, addEventListener: (_e: string, fn: () => void) => { handlers[action]!.push(fn); } });
    const root = { querySelectorAll: () => [btn('ok'), btn('cancel')], querySelector: () => ({ checked: true }) };
    C95.watchDialog(root);
    handlers.cancel!.forEach((f) => f());
    assert.equal(C95.takeTeamDice(a), false, 'cancelled');
    handlers.ok!.forEach((f) => f());
    handlers.cancel!.forEach((f) => f());
    assert.equal(C95.takeTeamDice(a), false, 'a Cancel after the roll button clears it too');
    handlers.ok!.forEach((f) => f());
    assert.equal(C95.takeTeamDice(a), true, 'the roll button arms it');
  });
  test('the window has no Draw button: points are drawn only where a test spends Karma', () => {
    const a = pc(0); world(a); team([a.id], 3);
    g.game.user = PLAYER();
    a.isOwner = true;
    assert.doesNotMatch(C95.teamWindowHtml(), /data-op="spend"/);
  });
  test('the GM\'s own Team Karma change waits for the GM lock', async () => {
    const { withGmLock } = await import('../applications/gmlock.ts');
    const a = pc(1); world(a); team([a.id], 3);
    let release: () => void = () => {};
    const held = withGmLock(() => new Promise<void>((r) => { release = r; }));
    const spend = C95.spendTeam(a, 1);
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(pool().spent, 0, 'not while another locked task runs');
    release(); await held; await spend;
    assert.equal(pool().spent, 1);
  });
  test('a GM\'s own card: a team spend inside its re-run (which holds the GM lock) runs inline, no deadlock', async () => {
    const a = pc(1); world(a); team([a.id], 3);
    const cls: any = (globalThis as any).CONFIG?.Actor?.documentClass;
    assert.equal(typeof cls?.runAsAuthor, 'function', 'the real actor class is the document class here');
    const gm = (globalThis as any).game.user;
    const run = cls.runAsAuthor(gm, () => C95.spendTeam(a, 1));
    const out = await Promise.race([run, new Promise((r) => setTimeout(() => r('deadlock'), 500))]);
    assert.equal(out, true, 'spent from the team pool, not waiting for itself');
    assert.equal(pool().spent, 1);
    assert.equal(cls.inAuthorRun, false, 'the count goes back down');
  });
  test('a player\'s request to take points for good without a card is refused', async () => {
    const a = pc(0); world(a); team([a.id], 3);
    assert.equal((await C95.teamRelay({ op: 'spend', actorId: a.id, n: 1, permanent: true }, PLAYER())).ok, false);
    assert.deepEqual(pool(), { members: [a.id], pool: 3, spent: 0 });
  });
  test('a contest card shows the Karma buttons to a member with no own pool', async (t) => {
    t.after(oldWay({ 'CORE_V95.contactMeet': 'off', 'CORE_V95.contactFee': 'flat' }));
    const a = pc(0, { contacts: [{ id: 'c1', name: 'Fixer', level: 1, role: '', notes: '', loyalty: 1, skills: '', fee: 0, dice: 0, favours: 0, fixer: false }] }, [skill('e', 'Etiquette', 3, 'charisma')]);
    world(a);
    faces.push(5, 1, 1);
    await a.legwork('c1');
    const html = String(chat.find((m) => m.flags?.[SYS]?.contest)?.content ?? '');
    assert.doesNotMatch(html, /contestKarma/, 'not a member: no buttons (v0.94.2)');
    chat.length = 0; team([a.id], 3);
    faces.length = 0; faces.push(6, 1, 1, 1);
    await a.legwork('c1');
    const html2 = String(chat.find((m) => m.flags?.[SYS]?.contest)?.content ?? '');
    assert.match(html2, /data-op="reroll"/);
    assert.match(html2, /data-op="buy"/);
  });

});
