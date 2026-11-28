/**
 * v0.97.1 (builder B): the live run's findings 4, 5, 6 and two of 8, through the real documents/index.ts and the
 * v0.97.0 glue (stubs as v097-mxic-glue.test.ts): a player's tar baby and Slow go to the GM through a host change; the
 * Cook and Installation Tasks are rolled on the GM's client only; a Karma re-roll of a decrypt after a survived Poison
 * Test posts its host change; Analyze Host's hint; the system test's utility modifier id. New strings are asserted by
 * their keys (the lead merges the draft into en.json; a missing key falls back to its name).
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
let CharacterDataModel: any, IcDataModel: any, HostDataModel: any, SR2Actor: any;

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
  // Foundry sets a message's author to the user who posts it.
  g.ChatMessage = { create: async (d: any) => { const m: any = asMessage({ author: g.game.user, ...d }); m.isOwner = Boolean(g.game.user?.isGM) || m.author === g.game.user; chat.push(m); return m; }, getSpeaker: () => ({}) };
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
  ({ CharacterDataModel, IcDataModel, HostDataModel } = await import('../models/index.ts'));
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
  g.game.messages = { contents: chat, get: (id: string) => chat.find((m: any) => m.id === id) };
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
  a.uuid = `Actor.v97-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness', more: any = {}) => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, ...more } });
/** A decker with a deck (as glue.test.ts's v0.28.0 decker). */
const D = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 6, willpower: 5 };
function decker(matrix: any = {}): any {
  return who({ name: 'Decker', matrix: { jackedIn: false, hostUuid: '', monitor: 0, sim: 'cold', connection: 'jackpoint', crippled: { bod: 0, evasion: 0, masking: 0, sensors: 0 }, passed: [],
    trace: { active: false, icUuid: '', icName: '', mode: 'dump', rating: 0, hostUuid: '', round: -1, worldTime: -1 }, numbers: [], knownHosts: [], engagedBy: [], maneuvers: [], ...matrix } }, [
    skill('comp', 'Computer', 5, 'intelligence'),
    { id: 'deck', type: 'cyberdeck', name: 'Deck', system: { active: true, mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 1, activeMemory: 400, storageMemory: 500, ioSpeed: 100, files: [] } },
    { id: 'de', type: 'program', name: 'Deception', system: { kind: 'deception', rating: 2, size: 0, loaded: true } },
  ], D);
}
/** A host, LTG or RTG on the real data model. */
function node(name: string, gridKind = 'host', parentUuid = '', extra: any = {}): any {
  const h = new SR2Actor();
  const sys = Object.create(HostDataModel.prototype);
  Object.assign(sys, { gridKind, parentUuid, securityCode: 'orange', securityValue: 4, ltgNumber: '', subsystems: { access: 5, control: 5, index: 5, files: 5, slave: 5 }, tally: 0, alert: 'none', sheaf: [],
    files: [], bombs: [], ...extra });
  sys.prepareDerivedData();
  Object.assign(h, { type: 'host', name, uuid: `Actor.v97host-${++n}`, system: sys, items: withGet([]) });
  sys.parent = h;
  uuidRegistry.set(h.uuid, h);
  return h;
}
/** A node's Security Value 4 detection roll: nothing. */
const noDetect = () => faces.push(1, 1, 1, 1);

/** IC on the real data model, in a host. */
function icIn(host: any, extra: any = {}): any {
  const a = new SR2Actor();
  const sys = Object.create(IcDataModel.prototype);
  Object.assign(sys, { rating: 6, category: 'white', icType: 'Killer', damageLevel: 'M', damageType: 'physical', initiativeDice: 0, hostUuid: host.uuid, kind: 'ic', ownerUuid: '', smart: false,
    behavior: 'killer', guards: '', traceMode: 'dump', payload: '', attribute: 'evasion', party: '', construct: [], matrix: { monitor: 0 }, ...extra });
  Object.assign(a, { type: 'ic', name: extra.name ?? `Killer ${sys.rating}`, uuid: `Actor.v97ic-${++n}`, id: `ic${n}`, system: sys, items: withGet([]), statuses: new Set<string>() });
  sys.parent = a; sys.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
/** A host that can be written (tallies, files). */
function host(extra: any = {}): any {
  const h = node('Host', 'host', '', { tallies: [], ...extra });
  Object.assign(h, { isOwner: true, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(h, k, v); h.system.prepareDerivedData(); } });
  return h;
}
const attackProg = { id: 'atk', type: 'program', name: 'Attack', system: { kind: 'attack', rating: 4, size: 0, loaded: true, damageLevel: 'M' } };
/** A decker jacked in to a host (with an attack utility). */
function inside(h: any, matrix: any = {}): any {
  const d = decker({ jackedIn: true, hostUuid: h.uuid, ...matrix });
  d.items.push({ ...attackProg, system: { ...attackProg.system }, parent: d, async update(x: any) { for (const [k, v] of Object.entries(x)) setPath(this, k, v); d.system.prepareDerivedData(); } });
  d.system.prepareDerivedData();
  return d;
}
const text = () => chat.map((m) => String(m.content ?? '')).join('\n');

const F = 'shadowrun2e_unified';
const card = (key: string) => [...chat].reverse().find((m: any) => m.flags?.[F]?.[key]);
const prog = (d: any, p: any) => {
  d.items.push({ ...p, system: { size: 0, loaded: true, ...p.system }, parent: d, async update(x: any) { for (const [k, v] of Object.entries(x)) setPath(this, k, v); d.system.prepareDerivedData(); } });
  d.system.prepareDerivedData();
};

const PLAYER = () => ({ id: 'p1', name: 'Pat', isGM: false, can: () => true });

describe('v0.97.1 finding 6: a Karma re-roll of a decrypt after a survived Poison Test (VR2 p. 42)', () => {
  const file = (extra: any = {}) => ({ id: 'f1', name: 'Data', size: 10, value: 0, paydata: false, encrypted: 4, scramble: 5, bomb: 0, ...extra });
  /** A player's failed decrypt (all 1s), the Poison Test failed (the data survives); then the Karma re-roll on the card itself. */
  async function failedThenReroll(dice3d: any): Promise<{ h: any; done: boolean }> {
    const h = host({ files: [file()] });
    h.isOwner = false;
    g.game.user = PLAYER();
    const d = inside(h);
    d.system.karma.pool = 5; d.system.prepareDerivedData();
    g.game.actors = [d];
    h.system.files[0].foundBy = [d.uuid];
    noDetect(); faces.push(1, 1, 1, 1, 1, /* Poison 5 vs Computer 5 */ 1, 1, 1, 1, 1);
    await d.systemTest('files', { operationId: 'decryptFile', fileId: 'f1' });
    assert.match(text(), /suppresses the poison IC/);
    assert.equal(card('hostChange'), undefined, 'nothing for the GM yet');
    const sys = chat.find((c: any) => c.flags?.[F]?.test?.kind === 'system');
    Object.assign(sys, { isOwner: true, async update(dd: any) { for (const [k, v] of Object.entries(dd)) setPath(this, k.replace('.==', '.'), v); } });
    g.game.dice3d = dice3d;
    faces.push(5, 5, 5, 5, 5);
    const done = await Promise.race([d.karmaReroll(sys.flags[F].test, sys).then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 300))]);
    delete g.game.dice3d;
    return { h, done };
  }
  test('the re-roll that succeeds posts its host change (the decryption) for the GM', async () => {
    const { h, done } = await failedThenReroll(undefined);
    assert.ok(done);
    assert.match(text(), /Data<\/strong> is decrypted/);
    assert.equal(card('hostChange')?.flags[F].hostChange.decrypt, 'f1');
    assert.equal(h.system.files[0].encrypted, 4, 'the GM applies it');
  });
  test('Dice So Nice that never finishes its animation (a hidden tab) does not hold the host change back', async () => {
    let shown = 0;
    const { done } = await failedThenReroll({ showForRoll: () => { shown++; return new Promise(() => {}); } });
    assert.ok(done, 'the re-roll finished');
    assert.ok(shown >= 1, 'the dice were still shown');
    assert.equal(card('hostChange')?.flags[F].hostChange.decrypt, 'f1');
  });
});

const SH = () => import('../rules/trust.ts');
let TR: any;
const T0 = () => TR;
before(async () => { TR = await import('../rules/trust.ts'); });

describe('v0.97.1 finding 4a: a player\'s tar baby or tar pit derezzes through the GM (VR2 pp. 42–43)', () => {
  /** A tar baby beats a player's defense: the player's client resolves the hit; the IC and the host are the GM's. */
  async function tarWins(behavior = 'tarBaby'): Promise<{ h: any; tb: any; d: any; writes: string[] }> {
    const h = host();
    const tb = icIn(h, { behavior, rating: 5, name: 'Tar-5' });
    const d = inside(h);
    d.items.get('deck').system.hardening = 0; d.system.prepareDerivedData();
    g.game.actors = [d, tb];
    faces.push(5, 5, 5, 1, 1);
    await tb.icAttack({ targetUuid: d.uuid, programId: 'atk' });
    const attack = chat.at(-1).flags[F].attack;
    // The player's client: no right to write the IC or the host (Foundry would refuse with a red error).
    g.game.user = PLAYER();
    h.isOwner = false;
    tb.isOwner = false;
    const writes: string[] = [];
    const real = tb.update.bind(tb);
    tb.update = async (x: any) => { if (!g.game.user?.isGM) { writes.push('player wrote the IC'); throw new Error('lacks permission'); } return real(x); };
    faces.push(1, 1, 1, 1, /* a tar pit's test */ 5, 5, 5, 5, 5);
    await d.defend(attack, 0);
    return { h, tb, d, writes };
  }
  const change = () => { const { hostUuid: _h, sourceUuid: _s, ...c } = card('hostChange').flags[F].hostChange; return c; };
  test('no write the player may not make; an Apply (GM) card asks for it; the GM\'s Apply derezzes it', async () => {
    const { h, tb, d, writes } = await tarWins();
    assert.deepEqual(writes, [], 'never tried');
    assert.equal(d.items.get('atk').system.loaded, false, 'the utility crashed');
    assert.doesNotMatch(text(), /GM: derez/);
    assert.match(text(), /Gm\.tarSent|sent to the GM/);
    const hc = card('hostChange');
    const atkCard = chat.find((m) => m.flags?.[F]?.attack?.ic?.icUuid === tb.uuid);
    assert.deepEqual(hc.flags[F].hostChange.crashIc97, { icUuid: tb.uuid, deckerUuid: d.uuid, programId: 'atk', cardId: atkCard.id });
    assert.equal(T0().mx97OwnerOk(hc.flags[F].hostChange, (u: string) => u === d.uuid), true);
    assert.equal(T0().mx97OwnerOk(hc.flags[F].hostChange, () => false), false, 'only the decker\'s owner');
    const T = await SH();
    assert.equal(T.gmApplyShapeOk('applyHost', hc.flags[F]), true);
    assert.equal(T.safeAutoApply('applyHost', hc.flags[F], { authorIsGm: false, owns: () => true } as any), false, 'the GM clicks');
    assert.notEqual(tb.system.matrix.monitor, RULES.MATRIX.monitorBoxes);
    g.game.user = GM();
    await SR2Actor.applyHostChange(h.uuid, change());
    assert.equal(tb.system.matrix.monitor, RULES.MATRIX.monitorBoxes, 'derezzed on the GM\'s client');
    // The same card again (the tar back up): refused, the card was used.
    tb.system.matrix.monitor = 0; tb.system.prepareDerivedData();
    const again = await SR2Actor.applyHostChange(h.uuid, change());
    assert.equal(tb.system.matrix.monitor, 0);
    assert.match(again, /cardUsed|already applied/);
  });
  test('forged: no attack card of that tar, a player-authored one, or not its newest: refused', async () => {
    const { h, tb, d } = await tarWins();
    g.game.user = GM();
    const c0 = change();
    const atk = chat.find((m) => m.id === c0.crashIc97.cardId);
    await SR2Actor.applyHostChange(h.uuid, { crashIc97: { ...c0.crashIc97, cardId: 'nope' } } as any);
    assert.notEqual(tb.system.matrix.monitor, RULES.MATRIX.monitorBoxes);
    // A player posts a copy of the attack card: not the GM's, and the newest attack is no longer the real one.
    chat.push({ ...atk, id: 'forged', author: PLAYER() });
    await SR2Actor.applyHostChange(h.uuid, { crashIc97: { ...c0.crashIc97, cardId: 'forged' } } as any);
    assert.notEqual(tb.system.matrix.monitor, RULES.MATRIX.monitorBoxes, 'a player-authored copy is no attack');
    // A newer attack of that tar (the GM's): the older card no longer counts.
    chat.push({ ...atk, id: 'newer', author: GM() });
    await SR2Actor.applyHostChange(h.uuid, c0);
    assert.notEqual(tb.system.matrix.monitor, RULES.MATRIX.monitorBoxes, 'only its newest attack');
    chat.pop(); chat.pop();
    await SR2Actor.applyHostChange(h.uuid, c0);
    assert.equal(tb.system.matrix.monitor, RULES.MATRIX.monitorBoxes);
    assert.ok(d);
  });
  test('a tar pit too (book); the GM side refuses a forged request (a killer, another host, a loaded utility)', async () => {
    const { h, tb } = await tarWins('tarPit');
    assert.ok(card('hostChange').flags[F].hostChange.crashIc97);
    g.game.user = GM();
    const killer = icIn(h, { behavior: 'killer', name: 'Killer-6' });
    const d2 = inside(h);
    const cardId = change().crashIc97.cardId;
    const note1 = await SR2Actor.applyHostChange(h.uuid, { crashIc97: { icUuid: killer.uuid, deckerUuid: d2.uuid, programId: 'atk', cardId } } as any);
    assert.equal(killer.system.matrix.monitor, 0);
    assert.match(note1, /tarNoCard|attack card/);
    const note2 = await SR2Actor.applyHostChange(h.uuid, { crashIc97: { icUuid: tb.uuid, deckerUuid: d2.uuid, programId: 'atk', cardId } } as any);
    assert.notEqual(tb.system.matrix.monitor, RULES.MATRIX.monitorBoxes, 'not that decker\'s attack');
    const other = host();
    await SR2Actor.applyHostChange(other.uuid, change());
    assert.notEqual(tb.system.matrix.monitor, RULES.MATRIX.monitorBoxes, 'not that host\'s IC');
    const T = await SH();
    assert.equal(T.hostChangeShapeOk({ crashIc97: { icUuid: tb.uuid, deckerUuid: 'x', programId: 'atk', cardId: 'c', extra: 1 } }), false);
    assert.equal(T.hostChangeShapeOk({ crashIc97: { icUuid: tb.uuid, deckerUuid: 'x', programId: 'atk' } }), false, 'a card id is required');
    assert.ok(note2);
  });
  test('on the GM\'s client it derezzes at once (no card)', async () => {
    const h = host();
    const tb = icIn(h, { behavior: 'tarBaby', rating: 5, name: 'Tar-5' });
    tb.isOwner = true;
    const d = inside(h);
    g.game.actors = [d, tb];
    faces.push(5, 5, 5, 1, 1);
    await tb.icAttack({ targetUuid: d.uuid, programId: 'atk' });
    faces.push(1, 1, 1, 1);
    await d.defend(chat.at(-1).flags[F].attack, 0);
    assert.equal(tb.system.matrix.monitor, RULES.MATRIX.monitorBoxes);
    assert.equal(card('hostChange'), undefined);
  });
});

describe('v0.97.1 finding 4b: a player\'s Slow lowers the GM\'s IC\'s Initiative through the GM (VR2 p. 99)', () => {
  function arena(ic: any, initiative = 19) {
    const cb: any = { id: 'cb1', actor: ic, actorId: ic.id, initiative, isOwner: false, async update(x: any) { Object.assign(this, x); } };
    const combat: any = { id: 'c1', started: true, round: 1, combatants: withGet([cb]) };
    cb.combat = combat;
    g.game.combat = combat;
    g.game.combats = { get: (id: string) => (id === 'c1' ? combat : null) };
    return cb;
  }
  async function playerSlows(): Promise<{ h: any; ic: any; d: any; cb: any }> {
    const h = host({ securityCode: 'green', securityValue: 4 });
    const ic = icIn(h, { behavior: 'killer', rating: 4, name: 'Killer-4' });
    const d = inside(h);
    prog(d, { id: 'sl', type: 'program', name: 'Slow', system: { kind: 'slow', rating: 6 } });
    g.game.actors = [d, ic];
    const cb = arena(ic);
    g.game.user = PLAYER();
    h.isOwner = false;
    faces.push(1, 1, 1, 1, /* the attack */ 5, 5, 5, 5, 5, 5);
    await d.useUtility('sl', { targetUuid: ic.uuid });
    return { h, ic, d, cb };
  }
  test('the player\'s card sends it; the GM\'s Apply takes the Initiative off; a forged one is refused or bounded', async () => {
    const { h, ic, d, cb } = await playerSlows();
    assert.equal(cb.initiative, 19, 'nothing written on the player\'s client');
    assert.doesNotMatch(text(), /by hand/);
    const hc = card('hostChange');
    assert.ok(hc, 'an Apply (GM) card');
    const s97 = hc.flags[F].hostChange.slow97;
    const slowCard = chat.find((m) => m.flags?.[F]?.test?.mutility?.kind === 'slow');
    assert.deepEqual([s97.icUuid, s97.deckerUuid, s97.combatId, s97.combatantId, s97.testId], [ic.uuid, d.uuid, 'c1', 'cb1', slowCard.flags[F].test.testId]);
    assert.equal(slowCard.flags[F].test.mutility.applied, s97.delta, 'the card records what was sent');
    // The Slow card is the player's: the stub's message author must own the decker.
    d.testUserPermission = (u: any) => Boolean(u?.isGM || u?.id === 'p1');
    assert.ok(s97.delta > 0 && s97.delta % RULES.MXOPS_V97.slowPerAction === 0, String(s97.delta));
    const T = await SH();
    assert.equal(T.gmApplyShapeOk('applyHost', hc.flags[F]), true);
    g.game.user = GM();
    const { hostUuid: _h, sourceUuid: _s, ...c } = hc.flags[F].hostChange;
    await SR2Actor.applyHostChange(h.uuid, c);
    assert.equal(cb.initiative, 19 - s97.delta);
    // The same card again (or a forged delta): nothing more; its result, not the request, says how much.
    cb.initiative = 30;
    await SR2Actor.applyHostChange(h.uuid, { slow97: { ...s97, delta: 999 } } as any);
    assert.equal(cb.initiative, 30, 'used once');
    // No Slow card behind it, or a card not by the decker's owner: refused.
    await SR2Actor.applyHostChange(h.uuid, { slow97: { ...s97, testId: 'nope' } } as any);
    assert.equal(cb.initiative, 30);
    slowCard.author = { id: 'p2', name: 'Other', isGM: false };
    const t2 = { ...slowCard.flags[F].test, testId: 'other' };
    chat.push({ ...slowCard, id: 'x2', flags: { [F]: { test: t2 } } });
    await SR2Actor.applyHostChange(h.uuid, { slow97: { ...s97, testId: 'other' } } as any);
    assert.equal(cb.initiative, 30, 'not the decker\'s owner\'s card');
    // A Karma re-roll with more successes: only the difference, never more than the cap in all.
    slowCard.author = PLAYER();
    slowCard.flags[F].test = { ...slowCard.flags[F].test, successes: 30 };
    await SR2Actor.applyHostChange(h.uuid, { slow97: s97 } as any);
    assert.equal(cb.initiative, 30 - (4 * RULES.MXOPS_V97.slowPerAction - s97.delta));
    cb.initiative = 30;
    await SR2Actor.applyHostChange(h.uuid, { slow97: s97 } as any);
    assert.equal(cb.initiative, 30, 'capped in all');
    ic.system.behavior = 'tarBaby';
    slowCard.flags[F].test = { ...slowCard.flags[F].test, successes: 0, mutility: { ...slowCard.flags[F].test.mutility } };
    await SR2Actor.applyHostChange(h.uuid, { slow97: s97 } as any);
    assert.equal(cb.initiative, 30, 'reactive IC: Slow does not work on it');
  });
  test('v965: the old note (the GM by hand), no request', async (t) => {
    t.after(oldWay({ 'MXOPS_V97.slow': 'v965' }));
    const h = host();
    const ic = icIn(h, { behavior: 'killer', rating: 4, name: 'Killer-4' });
    const d = inside(h);
    prog(d, { id: 'sl', type: 'program', name: 'Slow', system: { kind: 'slow', rating: 6 } });
    g.game.actors = [d, ic];
    const cb = arena(ic);
    g.game.user = PLAYER();
    faces.push(5, 5, 5, 5, 5);
    await d.useUtility('sl', { targetUuid: ic.uuid });
    assert.equal(cb.initiative, 19);
    assert.equal(card('hostChange'), undefined);
  });
});

describe('v0.97.1 finding 8: Analyze Host\'s hint; the system test\'s utility modifier has an id', () => {
  test('"N tell all" only when N is below the items; the utility modifier is `utility`', async (t) => {
    const M97 = await import('../rules/mxops97.ts');
    assert.equal(M97.analyzeHostAllHint(), null, '7 items, 7 tell all: no hint');
    const undo = (() => { const was = RULES.MXOPS_V97.analyzeHostAll; (RULES.MXOPS_V97 as any).analyzeHostAll = 4; return () => { (RULES.MXOPS_V97 as any).analyzeHostAll = was; }; })();
    t.after(undo);
    assert.equal(M97.analyzeHostAllHint(), 4);
    const h = host();
    const d = inside(h);
    prog(d, { id: 'dc', type: 'program', name: 'Decrypt', system: { kind: 'decrypt', rating: 4 } });
    g.game.actors = [d];
    h.system.files = [{ id: 'f1', name: 'Data', size: 1, value: 0, paydata: false, encrypted: 4, scramble: 0, bomb: 0, foundBy: [d.uuid] }];
    noDetect(); faces.push(5, 5, 5, 5, 5);
    await d.systemTest('files', { operationId: 'decryptFile', fileId: 'f1' });
    const snap = chat.find((c: any) => c.flags?.[F]?.test?.kind === 'system').flags[F].test;
    const mods: any[] = snap.modifiers ?? [];
    const u = mods.find((m: any) => /Decrypt/.test(String(m.label)));
    assert.ok(u, JSON.stringify(mods));
    assert.equal(u.id, 'utility');
    assert.ok(mods.every((m: any) => m.id !== undefined), 'no undefined ids');
  });
});

describe('v0.97.1 finding 5: a player\'s Cook and Installation Tasks are rolled on the GM\'s client (VR2 p. 77)', () => {
  const builder = () => {
    const a = who({ name: 'Builder', nuyen: 1_000_000, karma: { pool: 3, poolSpent: 0, good: 30, career: 30 } }, [skill('br', 'Computer B/R', 4, 'intelligence')]);
    a.testUserPermission = (u: any) => Boolean(u?.isGM || u?.id === 'p1');
    g.game.actors = [a];
    return a;
  };
  /** Two clients over the stub socket: the player's (asks), the GM's lead window (answers). */
  let requests = 0;
  async function twoClients(): Promise<void> {
    const S = await import('../applications/socket.ts');
    const gmUser = GM();
    const player = PLAYER();
    const users = Object.assign([gmUser, player], { activeGM: { id: 'gm1', isSelf: false }, get: (id: string) => [gmUser, player].find((u) => u.id === id) });
    g.game.users = users;
    g.game.user = player;
    g.game.socket = {
      emit: (_s: string, msg: any) => {
        if (msg?.type === 'request') {
          requests++;
          setTimeout(async () => {
            g.game.user = gmUser; users.activeGM.isSelf = true;
            await S.handleSocket(msg, 'p1');
          }, 0);
        } else if (msg?.type === 'reply') {
          g.game.user = player; users.activeGM.isSelf = false;
          void S.handleSocket(msg, 'gm1');
        }
      },
    };
  }
  test('nothing secret on the player\'s client: the GM rolls, whispers the GMs (its own message), once', async () => {
    requests = 0;
    const a = builder();
    await twoClients();
    faces.push(5, 5, 1, 1); // design: MPCP 4, 2 successes, 64 days
    faces.push(5, 1, 1, 1); // the GM's cook: 1 success, 12 days
    faces.push(5, 5, 5, 5); // the GM's install: 2 days
    await a.buildDeckPart({ deckId: null, part: 'mpcp', rating: 4, name: 'Homebrew' });
    assert.equal(requests, 1);
    const mine = chat.filter((m) => m.author?.id === 'p1');
    assert.ok(mine.length >= 1);
    for (const m of mine) assert.doesNotMatch(String(m.content), /Cook Task|Installation Task: Computer|TN 4, base/, 'no secret on a player-authored message');
    const design = mine.find((m) => m.flags?.[F]?.test?.kind === 'code');
    assert.match(design.content, /64 days/);
    assert.match(design.content, /publicAsked|GM rolls the Cook/);
    assert.doesNotMatch(design.content, /more days/);
    const gm = chat.find((m) => m.flags?.[F]?.cook97Job);
    assert.equal(gm.author.id, 'gm1');
    assert.deepEqual(gm.whisper, ['gm1']);
    assert.match(gm.content, /Cook Task: Computer B\/R against TN 4, base 12 days, successes 1/);
    assert.equal(design.flags[F].test.code.cook97.asked, true);
    assert.equal(design.flags[F].test.code.cook97.rolled, undefined, 'no result on the player\'s card');
    // A Karma re-roll of the design asks nothing again.
    faces.push(5, 1);
    await a.karmaReroll(design.flags[F].test, design);
    assert.equal(requests, 1);
    assert.equal(faces.length, 0);
    // The GM's own guard: the same job again (a player who cleared `asked`) is not rolled again.
    g.game.user = GM();
    const whispers = chat.filter((m) => m.flags?.[F]?.cook97Job).length;
    const G97 = await import('../applications/mxlife97.ts');
    const r = await G97.applyCookAsGm({ op: 'cook', actorUuid: a.uuid, testId: design.flags[F].test.testId, projectId: '' }, PLAYER());
    assert.equal(r.ok, true);
    assert.equal(chat.filter((m) => m.flags?.[F]?.cook97Job).length, whispers);
    // A made-up key (no design card of that test): refused, nothing rolled.
    const bad = await G97.applyCookAsGm({ op: 'cook', actorUuid: a.uuid, testId: 'madeup', key: 'x' }, PLAYER());
    assert.equal(bad.ok, false);
    assert.equal(chat.filter((m) => m.flags?.[F]?.cook97Job).length, whispers);
    // The GM re-resolving the player's design card: no new roll, no days added.
    const before = faces.length;
    const code = { ...design.flags[F].test.code, cook97: { ...design.flags[F].test.code.cook97 } };
    const again = await G97.cookInstall(code, a);
    assert.equal(again?.days, 0);
    assert.equal(faces.length, before);
    assert.equal(chat.filter((m) => m.flags?.[F]?.cook97Job).length, whispers);
    delete g.game.socket;
  });
  test('the GM side: only the builder\'s owner; the days go on the project under way (and its record), a failure gives it up', async () => {
    const a = builder();
    const G97 = await import('../applications/mxlife97.ts');
    const stranger = { id: 'p2', name: 'Other', isGM: false };
    const refused = await G97.applyCookAsGm({ op: 'cook', actorUuid: a.uuid, projectId: 'k1' }, stranger);
    assert.equal(refused.ok, false);
    assert.equal(chat.filter((m) => m.flags?.[F]?.cook97Job).length, 0);
    const pr = await a.startProject({ kind: 'code', area: 'matrix', label: 'Homebrew: MPCP 4', hours: 64 * 24, paid: { nuyen: 0 }, effect: { call: { method: 'finishDeckPart', args: [null, 'Homebrew', 'mpcp', 4, false] } } });
    faces.push(5, 1, 1, 1, 5, 5, 5, 5); // cook 12 days, install 2 days
    // Two requests at once: one roll.
    const [ok, twin] = await Promise.all([G97.applyCookAsGm({ op: 'cook', actorUuid: a.uuid, projectId: pr.id, part: 'hardening', rating: 9 }, PLAYER()), G97.applyCookAsGm({ op: 'cook', actorUuid: a.uuid, projectId: pr.id }, PLAYER())]);
    assert.equal(twin.ok, true);
    assert.equal(chat.filter((m) => m.flags?.[F]?.cook97Job).length, 1, 'rolled once');
    assert.equal(ok.ok, true);
    assert.match(chat.at(-1).content, /TN 4, base 12 days/, 'the project\'s part and rating, not the request\'s');
    const p = a.projects().find((x: any) => x.id === pr.id);
    assert.equal(p.hours, (64 + 14) * 24);
    assert.equal(G97.cookHoursFor(a, pr.id), 14 * 24);
    const pr2 = await a.startProject({ kind: 'code', area: 'matrix', label: 'Homebrew2: MPCP 4', hours: 24, paid: { nuyen: 0 }, effect: { call: { method: 'finishDeckPart', args: [null, 'Homebrew2', 'mpcp', 4, false] } } });
    for (let i = 0; i < 10; i++) faces.push(1, 1, 1, 1, 3, 4); // the cook fails ten times
    await G97.applyCookAsGm({ op: 'cook', actorUuid: a.uuid, projectId: pr2.id }, PLAYER());
    assert.equal(a.projects().some((x: any) => x.id === pr2.id), false, 'given up');
    assert.match(chat.at(-1).content, /Cook Task failed after 10 tries/);
  });
});
