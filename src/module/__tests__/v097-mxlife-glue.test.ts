import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Until the lead merges an i18n draft into public/lang/en.json: its English, for keys not there yet (no draft, no harm).
for (const name of ['mxlife97.json']) {
  const file = fileURLToPath(new URL(`../../../i18n-drafts/${name}`, import.meta.url));
  if (!existsSync(file)) continue;
  const draft = JSON.parse(readFileSync(file, 'utf8'));
  const en = ((globalThis as any).__SR2E_EN__ ??= {});
  for (const [k, v] of Object.entries(draft)) if (!(k in en)) en[k] = v;
}

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
  g.ChatMessage = { create: async (d: any) => { const m = asMessage({ author: g.game.user, ...d }); chat.push(m); return m; }, getSpeaker: () => ({}) };
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
  a.uuid = `Actor.mxl97-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}


const SYS = 'shadowrun2e_unified';
const PLAYER = () => ({ id: 'p1', name: 'Player', isGM: false, can: () => true });
let G97: any;
before(async () => { G97 = await import('../applications/mxlife97.ts'); });

function world(...actors: any[]) {
  g.game.actors = Object.assign([...actors], { get: (id: string) => actors.find((a) => a.id === id) });
  g.game.messages = Object.assign(chat, { contents: chat, get: (id: string) => chat.find((m) => m.id === id) });
}
function pc(extra: any = {}, items: any[] = [], attrs?: Record<string, number>) {
  const a = who(extra, items, attrs);
  a.testUserPermission = (u: any) => Boolean(u?.isGM || u?.id === 'p1');
  a.hasPlayerOwner = true;
  return a;
}
const dialogs = (o: any) => { g.foundry.applications.api.DialogV2 = { confirm: async () => true, prompt: async () => null, wait: async () => null, ...o }; };
const last = () => chat[chat.length - 1];
const btn = () => ({ disabled: false }) as any;
const text = () => chat.map((m) => String(m.content ?? '')).join('\n');

beforeEach(() => { world(); dialogs({}); });
const DAY = 86400;
const U = 9e15; // MATRIX_V923's "until recovered" (PSYCHE_UNTIL_RECOVERED)
const psyche = (kind: string, rating = 5, icName = 'Psycho-5') => ({ kind, icName, rating, until: U });
const recoverCard = () => chat.filter((m) => m.flags?.[SYS]?.mxl97Recover);
const skill = (id: string, name: string, rating: number, attribute = 'intelligence') => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, concentration: '', concentrationRating: 0 } });
const deck = (extra: any = {}) => ({ id: 'deck', type: 'cyberdeck', name: 'Deck', system: { active: true, mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 1, activeMemory: 900, storageMemory: 500, ioSpeed: 100, signal: 0, tortoise: false, living: false, damage: { mpcp: 0, bod: 0, evasion: 0, masking: 0, sensors: 0 }, files: [], ...extra } });
const MATRIX = (more: any = {}) => ({ matrix: { psyche: [], channels: { access: 0, control: 0, index: 0, files: 0, slave: 0 }, ...more } });

describe('v0.97.0 psychotropic recovery on the world clock (VR2 p. 50)', () => {
  test('the clock starts, a week later the GM gets a card; the roll (medicated) takes the effect off', async () => {
    const a = pc({ name: 'Decker', ...MATRIX({ psyche: [psyche('frenzy', 5)] }) }); world(a);
    await SR2Actor.timedEffects({ worldTime: 1000, anyGm: true });
    assert.equal(recoverCard().length, 0, 'the clock starts');
    assert.equal(a.getFlag(SYS, 'psycheRecovery97')[0].next, 1000 + DAY, 'Matrix maniac: daily');
    await SR2Actor.timedEffects({ worldTime: 1000 + DAY + 5, anyGm: true });
    const card = recoverCard()[0];
    assert.ok(card, 'a card is due');
    assert.deepEqual(card.whisper, ['gm1']);
    assert.match(card.content, /Tests due: 1/);
    dialogs({ prompt: async () => ({ care: 'medication', spell: false, caught: false }) });
    faces.push(1, 1, 4, 1, 1); // Willpower 5 vs TN 5 − 1 = 4: one success
    await G97.onCard(card, btn(), 'mxl97Recover');
    assert.deepEqual(a.system.matrix.psyche, []);
    assert.match(last().content, /recovers from Frenzy.*TN 4/);
    assert.equal(card.getFlag(SYS, 'mxl97Done'), true);
    await G97.onCard(card, btn(), 'mxl97Recover');
    assert.match(warnings.at(-1) ?? '', /already/);
  });
  test('a failed test leaves it; several periods passed give several tests on one card', async () => {
    const a = pc({ name: 'Decker', ...MATRIX({ psyche: [psyche('conditioning', 4)] }) }); world(a);
    await SR2Actor.timedEffects({ worldTime: 0, anyGm: true });
    await SR2Actor.timedEffects({ worldTime: 21 * DAY, anyGm: true });
    const card = recoverCard()[0];
    assert.equal(card.flags[SYS].mxl97Recover.tests, 3);
    dialogs({ prompt: async () => ({ care: 'none', spell: false, caught: false }) });
    faces.push(1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3); // TN 4 + 1 = 5: three failures
    await G97.onCard(card, btn(), 'mxl97Recover');
    assert.equal(a.system.matrix.psyche.length, 1);
    assert.match(last().content, /still afflicted by Positive conditioning.*TN 5, successes 0, 0, 0/);
  });
  test('cyberphobia untreated and an uncaught Judas can\'t begin; a player can\'t roll it', async () => {
    const a = pc({ name: 'Decker', ...MATRIX({ psyche: [psyche('cyberphobia', 5), psyche('judas', 4, 'Judas-4')] }) }); world(a);
    await SR2Actor.timedEffects({ worldTime: 0, anyGm: true });
    await SR2Actor.timedEffects({ worldTime: 7 * DAY, anyGm: true });
    const [phobia, judas] = recoverCard();
    assert.ok(phobia && judas);
    dialogs({ prompt: async () => ({ care: 'none', spell: false, caught: false }) });
    const b = btn();
    await G97.onCard(phobia, b, 'mxl97Recover');
    assert.match(warnings.at(-1) ?? '', /medication or magical treatment/);
    assert.equal(b.disabled, false);
    await G97.onCard(judas, btn(), 'mxl97Recover');
    assert.match(warnings.at(-1) ?? '', /companions/);
    assert.equal(a.system.matrix.psyche.length, 2);
    g.game.user = PLAYER();
    await G97.onCard(phobia, btn(), 'mxl97Recover');
    assert.match(warnings.at(-1) ?? '', /Only the GM/);
  });
  test('the IC\'s rating comes from the actor, not the card', async () => {
    const a = pc({ name: 'Decker', ...MATRIX({ psyche: [psyche('frenzy', 6)] }) }); world(a);
    await SR2Actor.timedEffects({ worldTime: 0, anyGm: true });
    await SR2Actor.timedEffects({ worldTime: DAY, anyGm: true });
    const card = recoverCard()[0];
    card.flags[SYS].mxl97Recover.rating = 2;
    const forged = { ...card, author: PLAYER(), getFlag: card.getFlag, setFlag: card.setFlag };
    dialogs({ prompt: async () => { throw new Error('a player-made card asks nothing'); } });
    await G97.onCard(forged, btn(), 'mxl97Recover');
    dialogs({ prompt: async () => ({ care: 'none', spell: false, caught: false }) });
    faces.push(5, 5, 5, 5, 5);
    await G97.onCard(card, btn(), 'mxl97Recover');
    assert.match(last().content, /TN 6, successes 0/);
  });
  test('v965: no clock, no card (the GM clears it by hand); a fixed-time effect has none either', async () => {
    const a = pc({ name: 'Decker', ...MATRIX({ psyche: [psyche('frenzy', 5), { kind: 'cyberphobia', icName: 'X', rating: 3, until: 50 * DAY }] }) }); world(a);
    const undo = oldWay({ 'MXLIFE_V97.psychRecovery': 'v965' });
    await SR2Actor.timedEffects({ worldTime: 0, anyGm: true });
    await SR2Actor.timedEffects({ worldTime: 9 * DAY, anyGm: true });
    assert.equal(recoverCard().length, 0);
    assert.equal(a.getFlag(SYS, 'psycheRecovery97'), undefined);
    undo();
    await SR2Actor.timedEffects({ worldTime: 10 * DAY, anyGm: true });
    assert.equal(a.getFlag(SYS, 'psycheRecovery97').length, 1, 'only the book effect gets a clock');
  });
});

describe('v0.97.0 paydata going stale (VR2 p. 65)', () => {
  const files = () => [
    { name: 'Paydata 1', size: 60, value: 5000, paydata: true, source: 'Host' },
    { name: 'Johnson job', size: 30, value: 20000, paydata: true, source: 'Host' },
    { name: 'Paydata 2', size: 90, value: 5000, paydata: true, source: 'Host' },
  ];
  test('a point a day, the oldest first; the GM\'s story file is left; the owner is told', async () => {
    const a = pc({ name: 'Decker' }, [deck({ files: files() })]); world(a);
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: true } });
    await SR2Actor.timedEffects({ worldTime: 100, anyGm: true });
    assert.equal(a.getFlag(SYS, 'paydataSince97'), 100);
    await SR2Actor.timedEffects({ worldTime: 100 + DAY + 1, anyGm: true });
    const f = a.items.get('deck').system.files;
    assert.deepEqual(f.map((x: any) => [x.value, x.paydata]), [[0, false], [20000, true], [5000, true]]);
    assert.match(last().content, /goes stale.*lost 1 \(Paydata 1\), left 1/);
    assert.deepEqual(last().whisper, ['gm1', 'p1']);
    await SR2Actor.timedEffects({ worldTime: 100 + 5 * DAY, anyGm: true });
    assert.equal(a.items.get('deck').system.files[2].value, 0);
    assert.equal(a.getFlag(SYS, 'paydataSince97'), undefined, 'no stock, no clock');
    assert.equal(a.items.get('deck').system.files[1].value, 20000);
  });
  test('v965: it keeps', async (t) => {
    t.after(oldWay({ 'MXLIFE_V97.paydataDecay': 'v965' }));
    const a = pc({ name: 'Decker' }, [deck({ files: files() })]); world(a);
    await SR2Actor.timedEffects({ worldTime: 100, anyGm: true });
    await SR2Actor.timedEffects({ worldTime: 100 + 9 * DAY, anyGm: true });
    assert.deepEqual(a.items.get('deck').system.files.map((x: any) => x.value), [5000, 20000, 5000]);
  });
});

describe('v0.97.0 Cook and Installation tasks (VR2 pp. 77, 82–88)', () => {
  test('a new deck\'s MPCP: design, then cook and install, their days added', async () => {
    const a = pc({ name: 'Builder', nuyen: 1_000_000 }, [skill('br', 'Computer B/R', 4)]); world(a);
    faces.push(5, 5, 1, 1); // design: MPCP 4, TN 4, 128 Mp × 1 day: 2 successes, 64 days
    faces.push(5, 1, 1, 1); // cook: base 12, TN 4: 1 success, 12 days
    faces.push(5, 5, 5, 5); // install: base 8, TN 4: 4 successes, 2 days
    await a.buildDeckPart({ deckId: null, part: 'mpcp', rating: 4, name: 'Homebrew' });
    const c = last().content;
    assert.match(c, /78 days/);
    assert.match(c, /Cook Task: Computer B\/R against TN 4, base 12 days, successes 1 \(tries 1\): 12 days/);
    assert.match(c, /Installation Task: Computer B\/R against TN 4, base 8 days, successes 4 \(tries 1\): 2 days/);
  });
  test('a failed cook wastes base ÷ 2D6 days and is tried again', async () => {
    const a = pc({ name: 'Builder', nuyen: 1_000_000 }, [skill('br', 'Computer B/R', 4)]); world(a);
    faces.push(5, 5, 1, 1);
    faces.push(1, 1, 1, 1, 3, 3); // cook fails; 2D6 = 6: 12 ÷ 6 = 2 days lost
    faces.push(5, 5, 1, 1); // cook: 2 successes, 6 days
    faces.push(5, 5, 5, 5);
    await a.buildDeckPart({ deckId: null, part: 'mpcp', rating: 4, name: 'Homebrew' });
    assert.match(last().content, /Cook Task: .*successes 2 \(tries 2\): 8 days/);
    assert.match(last().content, /74 days/);
  });
  test('v965: the design\'s days only', async (t) => {
    t.after(oldWay({ 'MXLIFE_V97.cookInstall': 'v965' }));
    const a = pc({ name: 'Builder', nuyen: 1_000_000 }, [skill('br', 'Computer B/R', 4)]); world(a);
    faces.push(5, 5, 1, 1);
    await a.buildDeckPart({ deckId: null, part: 'mpcp', rating: 4, name: 'Homebrew' });
    assert.match(last().content, /64 days/);
    assert.doesNotMatch(last().content, /Cook Task/);
    assert.equal(faces.length, 0);
  });
});

describe('v0.97.0 otaku (VR2 pp. 144–145; otaku errata)', () => {
  let was: boolean;
  before(() => { was = RULES.MATRIX.otaku.enabled; (RULES.MATRIX.otaku as any).enabled = true; });
  after(() => { (RULES.MATRIX.otaku as any).enabled = was; });
  const otaku = (karma = 30) => pc({ name: 'Otaku', karma: { good: karma, pool: 0, poolSpent: 0, career: karma }, ...MATRIX() }, [skill('sk', 'Computer', 5), deck({ living: true })], { ...A, willpower: 6, intelligence: 6, charisma: 4 });
  test('a channel costs Karma as a Willpower skill and may pass the MPCP', async () => {
    const a = otaku(); world(a);
    assert.equal(await a.raiseChannel('access'), true);
    assert.equal(a.system.karma.good, 29, 'a new skill\'s first point (CORE_V923.newSkill)');
    const mpcp = a.system.derived.matrix.mpcp;
    a.system.matrix.channels.access = mpcp;
    assert.equal(await a.raiseChannel('access'), true, 'no MPCP cap');
    assert.equal(a.otakuChannel('access'), mpcp + 1);
  });
  test('v965: rating × 2 Karma, at most MPCP', async (t) => {
    t.after(oldWay({ 'MXLIFE_V97.otakuChannels': 'v965' }));
    const a = otaku(); world(a);
    assert.equal(await a.raiseChannel('access'), true);
    assert.equal(a.system.karma.good, 28);
    a.system.matrix.channels.access = a.system.derived.matrix.mpcp;
    assert.equal(await a.raiseChannel('access'), false);
  });
  test('a complex form: refused above Computer or operational; else a programming task, then made', async () => {
    const a = otaku(); world(a);
    assert.equal(await a.learnComplexForm({ kind: 'analyze', rating: 3 }), null);
    assert.match(warnings.at(-1) ?? '', /operational utility/);
    assert.equal(await a.learnComplexForm({ kind: 'attack', rating: 6 }), null);
    assert.match(warnings.at(-1) ?? '', /Computer Skill/);
    assert.equal(a.system.karma.good, 30);
    faces.push(5, 5, 1, 1, 1); // Computer 5 vs TN 4: 2 successes
    await a.learnComplexForm({ kind: 'attack', rating: 4, damageLevel: 'M' });
    const form = a.items.find((i: any) => i.type === 'program');
    assert.ok(form?.system.complexForm, 'made (WAITING is off in these tests)');
    assert.equal(a.system.karma.good, 26);
    assert.match(last().content, /otaku task bonus 3/);
  });
  test('a failed design costs no Karma and makes nothing', async () => {
    const a = otaku(); world(a);
    faces.push(1, 1, 1, 1, 1, 3, 4); // no success; 2D6 = 7
    assert.equal(await a.learnComplexForm({ kind: 'attack', rating: 4 }), null);
    assert.equal(a.system.karma.good, 30);
    assert.equal(a.items.filter((i: any) => i.type === 'program').length, 0);
    assert.match(last().content, /flawed/);
  });
  test('v965: learned at once, no test', async (t) => {
    t.after(oldWay({ 'MXLIFE_V97.complexForms': 'v965' }));
    const a = otaku(); world(a);
    const form = await a.learnComplexForm({ kind: 'attack', rating: 4 });
    assert.ok(form?.system.complexForm);
    assert.equal(faces.length, 0);
  });
  test('the free Armor = Willpower on persona damage; v965: none', async (t) => {
    const a = otaku(); world(a);
    faces.push(...Array(12).fill(1));
    await a.resistMatrixDamage({ power: 8, level: 'M', damageType: 'physical' } as any, 0);
    assert.match(text(), /Living persona Armor \(Willpower\) 6/);
    chat.length = 0; faces.length = 0;
    t.after(oldWay({ 'MXLIFE_V97.otakuArmor': 'v965' }));
    faces.push(...Array(12).fill(1));
    await a.resistMatrixDamage({ power: 8, level: 'M', damageType: 'physical' } as any, 0);
    assert.doesNotMatch(text(), /Living persona Armor/);
  });
});

describe('v0.97.0 IC on the GM\'s viewed Matrix scene', () => {
  const sceneWith = (tokens: any[]) => {
    const made: any[] = [];
    const scene = { grid: { size: 100 }, tokens: { contents: tokens }, async createEmbeddedDocuments(_t: string, docs: any[]) { made.push(...docs); return docs; } };
    g.game.scenes = { viewed: scene };
    return made;
  };
  const host = { uuid: 'Actor.host1', id: 'host1', type: 'host' };
  const ic = { uuid: 'Actor.ic1', type: 'ic', system: { hostUuid: 'Actor.host1' }, async getTokenDocument(d: any) { return { toObject: () => ({ name: 'Killer', actorLink: true, ...d }) }; } };
  test('a hidden token beside the host\'s token', async () => {
    const made = sceneWith([{ actor: host, actorId: 'host1', _source: { x: 300, y: 400 }, x: 0, y: 0 }]);
    await G97.placeIcToken(host, ic);
    assert.deepEqual(made.map((d) => [d.x, d.y, d.hidden]), [[400, 400, true]]);
  });
  test('no host token on the viewed scene, a player, or v965: nothing', async (t) => {
    const made = sceneWith([]);
    assert.equal(await G97.placeIcToken(host, ic), null);
    const made2 = sceneWith([{ actor: host, actorId: 'host1', x: 300, y: 400 }]);
    g.game.user = PLAYER();
    assert.equal(await G97.placeIcToken(host, ic), null);
    g.game.user = GM();
    t.after(oldWay({ 'MXLIFE_V97.icToken': 'v965' }));
    assert.equal(await G97.placeIcToken(host, ic), null);
    assert.equal(made.length + made2.length, 0);
  });
});
