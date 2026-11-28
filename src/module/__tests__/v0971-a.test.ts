/**
 * v0.97.1 (A): the v0.97.0 live run's findings 1, 2, 3, 7 and 8 (bomb wording, the answered choice card), through the
 * real documents/index.ts, models/index.ts and applications/mxic97.ts with the stubs of v097-mxic-glue.test.ts:
 * suppression and the host's maneuver records end with the visit to the host (VR2 p. 40), won positions and improvised
 * attacks are the host's record (a forged flag on the decker gives nothing), the deckers in a host are prepared again
 * when its record changes, and the bomb's choice card names the file and is disabled once answered.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as X from '../rules/mxic97.ts';
import { gmApplyShapeOk } from '../rules/trust.ts';
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
let CharacterDataModel: any, IcDataModel: any, HostDataModel: any, SR2Actor: any, MXG: any;

const GM = () => ({ id: 'gm1', name: 'GM', isGM: true, can: () => true });

/** A chat message as Foundry gives it back: an id and getFlag. */
const asMessage = (d: any) => ({ id: `m${++mid}`, timestamp: mid, ...d, getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; }, async setFlag(s: string, k: string, v: any) { ((this.flags ??= {})[s] ??= {})[k] = v; } });

before(async () => {
  // This area's English while its draft isn't merged into public/lang/en.json (the lead deletes the draft then).
  for (const f of ['mxic97.json', 'mxic97-fix.json']) {
    const draft = join('i18n-drafts', f);
    if (existsSync(draft)) g.__SR2E_EN__ = { ...(g.__SR2E_EN__ ?? {}), ...JSON.parse(readFileSync(draft, 'utf8')) };
  }
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
    prepareData() { this.system?.prepareDerivedData?.(); }
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
  MXG = await import('../applications/mxic97.ts');
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
const btn = (): any => ({ disabled: false });
const card = (key: string) => [...chat].reverse().find((m: any) => m.flags?.[F]?.[key]);
const prog = (d: any, p: any) => {
  d.items.push({ ...p, system: { size: 0, loaded: true, ...p.system }, parent: d, async update(x: any) { for (const [k, v] of Object.entries(x)) setPath(this, k, v); d.system.prepareDerivedData(); } });
  d.system.prepareDerivedData();
};

const PLAYER = () => ({ id: 'p1', name: 'Pat', isGM: false, can: () => true });

/** v0.97.1 (A fix round): a maneuver test's card as #post stores it (the GM side reads the result from it). */
async function mvCard(d: any, kind: string, vs: string, id: string, mine: number, theirs: number, more: any = {}): Promise<string> {
  const m = await g.ChatMessage.create({ content: 'maneuver', flags: { [F]: { test: { kind: 'maneuver', actorUuid: d.uuid, successes: mine, rerolls: 0, maneuver: { kind, targetUuid: vs, opp: theirs, entry97: id } , ...more } } } });
  return m.id;
}


const file = (extra: any = {}) => ({ id: 'f1', name: 'Data', size: 10, value: 0, paydata: false, encrypted: 0, scramble: 0, bomb: 0, ...extra });
const sleaze = (d: any) => prog(d, { id: 'sl', type: 'program', name: 'Sleaze', system: { kind: 'sleaze', rating: 5 } });
/** Move a jacked-in decker to another host as jackIn does (a new visit stamp), then the lead GM's upkeep (optional). */
async function move(d: any, to: any, upkeep = true) {
  await d.update({ 'system.matrix.hostUuid': to.uuid, ...MXG.visitUpdate() });
  if (upkeep) await MXG.onActorUpdateMx97(d, { system: { matrix: { hostUuid: to.uuid } } }, true);
}
/** Crash an IC for this decker and suppress it (the GM's client). */
async function suppress(h: any, d: any, ic: any) {
  ic.system.matrix.monitor = 10; ic.system.prepareDerivedData();
  await MXG.offerCrash(h, d, ic);
  await MXG.onCard(card('mxic97Choice'), btn(), 'mxic97Suppress');
}

describe('v0.97.1 pure: visits, the host\'s positions and improvised attacks', () => {
  test('MX97_MANEUVER_OPS is exactly the maneuver ops, every one a request op', () => {
    assert.deepEqual([...X.MX97_MANEUVER_OPS], ['parry', 'unparry', 'evade', 'unevade', 'exposed', 'pos', 'unpos'], 'never unexposed');
    for (const op of X.MX97_MANEUVER_OPS) assert.ok((X.MX97_OPS as readonly string[]).includes(op));
    assert.deepEqual(X.cleanMx97({ op: 'pos', deckerUuid: 'D', vs: 'I', id: 'e', net: 99 }), { op: 'pos', deckerUuid: 'D', vs: 'I', id: 'e', net: 30 });
    assert.equal(gmApplyShapeOk('applyHost', { hostChange: { hostUuid: 'H', mx97: { op: 'unpos', deckerUuid: 'D', id: 'e' } } }), true);
    assert.equal(gmApplyShapeOk('applyHost', { hostChange: { hostUuid: 'H', mx97: { op: 'improvise', deckerUuid: 'D', cardId: 'm1', net: 3 } } }), true);
    assert.equal(gmApplyShapeOk('applyHost', { hostChange: { hostUuid: 'H', mx97: { op: 'pos', deckerUuid: 'D', net: 31 } } }), false);
  });
  test('an entry counts only in the visit it was recorded in', () => {
    const rec = { parry: [{ decker: 'D', vs: 'I', net: 3, id: 'p', run: 'v1' }], pos: [{ decker: 'D', vs: 'I', net: 2, id: 'q', run: 'v1' }], suppressed: [{ decker: 'D', id: 'i', name: 'i', points: 4, run: 'v1' }],
      improvised: [{ decker: 'D', id: 'm', power: 3, level: 'M', evasion: 2, bod: 1, run: 'v1' }], evade: [{ decker: 'D', vs: 'I', net: 2, tallyAt: 0, round: 3, worldTime: 0, combatId: '', run: 'v1' }] };
    assert.equal(X.hostParry(rec, 'D', 'I', [], 'v1')?.net, 3);
    assert.equal(X.hostParry(rec, 'D', 'I', [], 'v2'), null);
    assert.equal(X.hostPos(rec, 'D', 'I', [], 'v1')?.net, 2);
    assert.equal(X.hostPos(rec, 'D', 'I', ['q'], 'v1'), null, 'used up');
    assert.equal(X.hostPos(rec, 'D', 'I', [], 'v2'), null);
    assert.equal(X.suppressedDfLoss(rec, 'D', 'v2'), 0);
    assert.equal(X.hostImprovised(rec, 'D', [], 'v2'), null);
    assert.equal(X.hostImprovised(rec, 'D', [], 'v1')?.power, 3);
    assert.equal(X.hostEvade(rec, 'D', 'I', 'v2'), null);
    assert.equal(X.hostMx({ pos: [{ decker: 'D', vs: 'I', net: 99, id: 'x' }] }).pos[0]!.net, 30, 'bounded');
  });
  test('withoutDecker drops only the leaver\'s own entries; one naming them as the opponent ends with their visit (vsRun)', () => {
    const rec = { parry: [{ decker: 'D', vs: 'I', net: 3, id: 'p' }, { decker: 'E', vs: 'D', net: 1, id: 'p2', vsRun: 'd1' }], exposed: [{ decker: 'E', vs: 'D', net: 2, id: 'x', vsRun: 'd1' }],
      pos: [{ decker: 'D', vs: 'I', net: 2, id: 'q' }], suppressed: [{ decker: 'D', id: 'i', name: 'i', points: 4 }], offered: ['i'] };
    const out = X.withoutDecker(rec, 'D')!;
    assert.deepEqual(out.parry.map((e) => e.id), ['p2'], 'E\'s parry against D stays');
    assert.equal(out.exposed.length, 1, 'D\'s position on E stays on the record');
    assert.equal(out.pos.length + out.suppressed.length, 0);
    assert.deepEqual(out.offered, ['i'], 'the crash choice stays offered');
    assert.equal(X.withoutDecker(rec, 'Z'), null);
    assert.equal(X.hostParry(out, 'E', 'D', [], '', 'd1')?.net, 1);
    assert.equal(X.hostParry(out, 'E', 'D', [], '', 'd2'), null, 'D\'s new visit: it no longer counts');
    assert.equal(X.hostExposed(out, 'E', 'D', [], '', 'd2'), null);
  });
  test('maneuverFromCard: the card\'s own result, kind, opponent and entry id', () => {
    const card = (successes: number, opp: number, more: any = {}) => ({ kind: 'maneuver', actorUuid: 'D', successes, rerolls: 0, maneuver: { kind: 'parry', targetUuid: 'I', opp, entry97: 'e' }, ...more });
    const m = { op: 'parry', deckerUuid: 'D', vs: 'I', id: 'e' };
    assert.deepEqual(X.maneuverFromCard(card(5, 2), m), { net: 3, rev: 0 });
    assert.equal(X.maneuverFromCard(card(2, 2), m), null, 'a tie fails');
    assert.equal(X.maneuverFromCard(card(5, 2), { ...m, op: 'evade' }), null, 'another kind');
    assert.equal(X.maneuverFromCard(card(5, 2), { ...m, vs: 'J' }), null);
    assert.equal(X.maneuverFromCard(card(5, 2), { ...m, id: 'f' }), null);
    assert.equal(X.maneuverFromCard(card(5, 2), { ...m, deckerUuid: 'E' }), null);
    assert.equal(X.maneuverFromCard(card(5, 2, { kind: 'plain' }), m), null);
    assert.equal(X.maneuverFromCard(card(5, 2, { rerolls: 1 }), m)?.rev, 1000);
    const pos = (s: number, o: number) => ({ kind: 'maneuver', actorUuid: 'D', successes: s, rerolls: 0, maneuver: { kind: 'position', targetUuid: 'I', opp: o, entry97: 'e' } });
    assert.equal(X.maneuverFromCard(pos(1, 4), { op: 'exposed', deckerUuid: 'D', vs: 'I', id: 'e' })?.net, 3);
    assert.equal(X.maneuverFromCard(pos(1, 4), { op: 'pos', deckerUuid: 'D', vs: 'I', id: 'e' }), null);
    assert.equal(X.maneuverFromCard(pos(1, 4), { op: 'unexposed', deckerUuid: 'D', vs: 'I', id: 'e' }), null, 'still lost: the penalty stays');
    assert.ok(X.maneuverFromCard(pos(4, 1), { op: 'unexposed', deckerUuid: 'D', vs: 'I', id: 'e' }));
  });
  test('the give-back is only what the improvisation took and what is still off', () => {
    assert.deepEqual(X.giveBackRecorded({ bod: 3, evasion: 2, masking: 0, sensors: 0 }, { evasion: 2, bod: 1 }), { bod: 2, evasion: 0, masking: 0, sensors: 0 });
    assert.deepEqual(X.giveBackRecorded({ bod: 0, evasion: 0, masking: 0, sensors: 0 }, { evasion: 30, bod: 30 }), { bod: 0, evasion: 0, masking: 0, sensors: 0 });
  });
});

describe('v0.97.1 finding 1: suppression and maneuvers end with the visit (VR2 p. 40)', () => {
  test('suppress in H, move to E and back: the Detection Factor is back, the entry gone, Release adds nothing', async () => {
    const h = host(), e = host();
    const ic = icIn(h);
    const d = inside(h);
    sleaze(d);
    g.game.actors = [d, ic, h, e];
    await d.update(MXG.runStartUpdate(d));
    await suppress(h, d, ic);
    assert.equal(d.liveDetectionFactor(), 4);
    const release = card('mxic97Release');
    await move(d, e);
    assert.equal((h.flags[F].mxic97.suppressed ?? []).length, 0, 'the host it left drops it');
    assert.equal(d.liveDetectionFactor(), 5);
    await move(d, h);
    assert.equal(d.liveDetectionFactor(), 5, 'a new visit');
    await MXG.onCard(release, btn(), 'mxic97Release');
    assert.equal(h.system.tallies.find((t: any) => t.key === d.uuid), undefined, 'no tally for an ended suppression');
  });
  test('without the GM\'s upkeep the read side alone ends it (the visit stamp); a leftover Release only clears it', async () => {
    const h = host(), e = host();
    const ic = icIn(h);
    const d = inside(h);
    sleaze(d);
    g.game.actors = [d, ic, h, e];
    await d.update(MXG.runStartUpdate(d));
    await suppress(h, d, ic);
    const release = card('mxic97Release');
    // The host is written while the decker is away by someone else (the GM's record keeps them out of it) - simulate a
    // record that kept the old entry: put it back by hand.
    const kept = JSON.parse(JSON.stringify(h.flags[F].mxic97));
    await move(d, e, false);
    await move(d, h, false);
    h.flags[F].mxic97 = kept;
    assert.equal(h.flags[F].mxic97.suppressed.length, 1);
    assert.equal(d.liveDetectionFactor(), 5);
    d.system.prepareDerivedData();
    assert.equal(d.system.derived.matrix.detectionFactor, 5, 'the sheet too');
    await MXG.onCard(release, btn(), 'mxic97Release');
    assert.equal(h.system.tallies.find((t: any) => t.key === d.uuid), undefined);
    assert.equal(h.flags[F].mxic97.suppressed.length, 0);
  });
  test('the real jackIn to another host gives a new visit stamp; staying keeps it', async () => {
    const h = host(), e = host();
    const d = inside(h);
    g.game.actors = [d, h, e];
    await d.update(MXG.runStartUpdate(d));
    const s0 = d.flags[F].run97;
    assert.ok(s0);
    await d.jackIn(h.uuid);
    assert.equal(d.flags[F].run97, s0, 'the same host');
    await d.jackIn(e.uuid);
    assert.notEqual(d.flags[F].run97, s0);
  });
  test('a parry and a position won end when the decker leaves the host', async () => {
    const h = host(), e = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic, h, e];
    await d.update(MXG.runStartUpdate(d));
    await MXG.applyMx97(h, { op: 'parry', deckerUuid: d.uuid, vs: ic.uuid, id: 'p1', cardId: await mvCard(d, 'parry', ic.uuid, 'p1', 3, 0) });
    await MXG.applyMx97(h, { op: 'pos', deckerUuid: d.uuid, vs: ic.uuid, id: 'q1', cardId: await mvCard(d, 'position', ic.uuid, 'q1', 2, 0) });
    assert.equal(MXG.parryMod(d, ic.uuid).mod?.value, 3);
    assert.ok(MXG.attackMods(d, ic).mods.some((m: any) => m.id === 'positionManeuver'));
    await move(d, e);
    await move(d, h);
    assert.equal(MXG.parryMod(d, ic.uuid).mod, null);
    assert.equal(MXG.attackMods(d, ic).mods.length, 0);
    assert.equal((h.flags[F].mxic97.parry ?? []).length + (h.flags[F].mxic97.pos ?? []).length, 0);
  });
  test('jacking out drops the entries too', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic, h];
    await MXG.applyMx97(h, { op: 'parry', deckerUuid: d.uuid, vs: ic.uuid, id: 'p1', cardId: await mvCard(d, 'parry', ic.uuid, 'p1', 3, 0) });
    await d.update({ 'system.matrix.jackedIn': false, 'system.matrix.hostUuid': '' });
    await MXG.onActorUpdateMx97(d, { system: { matrix: { jackedIn: false, hostUuid: '' } } }, true);
    assert.equal(h.flags[F].mxic97.parry.length, 0);
  });
  test('not the lead GM: no writes', async () => {
    const h = host(), e = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic, h, e];
    await MXG.applyMx97(h, { op: 'parry', deckerUuid: d.uuid, vs: ic.uuid, id: 'p1', cardId: await mvCard(d, 'parry', ic.uuid, 'p1', 3, 0) });
    await d.update({ 'system.matrix.hostUuid': e.uuid });
    await MXG.onActorUpdateMx97(d, { system: { matrix: { hostUuid: e.uuid } } }, false);
    assert.equal(h.flags[F].mxic97.parry.length, 1);
  });
});

describe('v0.97.1 finding 2: a won position is the host\'s record (VR2 p. 122)', () => {
  test('forge: a position on the decker\'s own flag gives nothing', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    d.flags[F] = { ...(d.flags[F] ?? {}), mx97: { parry: [], pos: [{ id: 'z', vs: ic.uuid, net: 30, hostUuid: h.uuid }], exposed: [], evade: [] } };
    const m = MXG.attackMods(d, ic);
    assert.equal(m.mods.length, 0);
    assert.equal(m.power, 0);
    faces.push(1, 1, 1, 1);
    const a = await d.matrixAttack({ targetUuid: ic.uuid, programId: 'atk' });
    assert.equal(a.targetNumber, 5, 'no −30');
  });
  test('the GM side caps a request at the decker\'s dice (and 30)', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    await MXG.applyMx97(h, { op: 'pos', deckerUuid: d.uuid, vs: ic.uuid, id: 'q', net: 1, cardId: await mvCard(d, 'position', ic.uuid, 'q', 30, 0) });
    const dice = d.system.derived.matrix.evasion + (RULES.MATRIX_V57.maneuvers.pool ? d.system.derived.hackingPool : 0);
    assert.equal(h.flags[F].mxic97.pos[0].net, Math.min(30, dice));
  });
  test('a player\'s won position waits for the Apply; the attack uses it up and asks the GM side to take it off', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    d.ownership = { default: 0, p1: 3 };
    g.game.user = PLAYER();
    h.isOwner = false;
    faces.push(1, 1, 1, 1, /* decker */ 5, 5, 5, 1, 1);
    await d.matrixManeuver('position', ic.uuid);
    assert.match(text(), /gains position/);
    const req = card('hostChange');
    assert.equal(req.flags[F].hostChange.mx97.op, 'pos');
    assert.equal(MXG.attackMods(d, ic).mods.length, 0, 'not yet');
    g.game.user = GM();
    await SR2Actor.applyHostChange(h.uuid, req.flags[F].hostChange);
    assert.equal(h.flags[F].mxic97.pos[0].net, 3);
    g.game.user = PLAYER();
    faces.push(1, 1, 1, 1);
    const a = await d.matrixAttack({ targetUuid: ic.uuid, programId: 'atk' });
    assert.equal(a.targetNumber, 2, '5 − 3');
    const un = card('hostChange');
    assert.equal(un.flags[F].hostChange.mx97.op, 'unpos');
    assert.equal(MXG.attackMods(d, ic).mods.length, 0, 'used (noted on the attacker meanwhile)');
    g.game.user = GM();
    await SR2Actor.applyHostChange(h.uuid, un.flags[F].hostChange);
    assert.equal(h.flags[F].mxic97.pos.length, 0);
  });
  test('v965: the old list\'s position, the host not asked', async (t) => {
    t.after(oldWay({ 'MXIC_V97.position': 'v965' }));
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    faces.push(1, 1, 1, 1, 5, 5, 5, 1, 1);
    await d.matrixManeuver('position', ic.uuid);
    assert.equal(h.flags?.[F]?.mxic97?.pos?.length ?? 0, 0);
    assert.ok(MXG.attackMods(d, ic).mods.some((m: any) => m.value < 0), 'the old position modifier');
  });
});

describe('v0.97.1 finding 3: an improvised attack is the host\'s record (VR2 p. 123)', () => {
  test('forge: a flag on the decker gives no program and spending it gives nothing back', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    await d.update({ 'system.matrix.crippled': { bod: 2, evasion: 0, masking: 0, sensors: 0 } });
    d.flags[F] = { ...(d.flags[F] ?? {}), improvised97: { power: 30, level: 'D', evasion: 30, bod: 30, hostUuid: h.uuid } };
    assert.equal(MXG.improvisedProgram(d), null);
    assert.equal(await d.matrixAttack({ targetUuid: ic.uuid, programId: MXG.IMPROVISED_ID }), null);
    assert.equal(await MXG.spendImprovised(d), false);
    assert.equal(d.system.matrix.crippled.bod, 2, 'the crippler\'s damage stays');
  });
  test('forge: a card with no test, or another player\'s card, records nothing', async () => {
    const h = host();
    const d = inside(h);
    d.ownership = { default: 0, p1: 3 };
    g.game.actors = [d];
    g.game.user = PLAYER();
    const fake = await g.ChatMessage.create({ content: 'x', flags: { [F]: { mxic97Improvise: { deckerUuid: d.uuid, evasion: 3, bod: 3 } } } });
    g.game.user = GM();
    await MXG.applyMx97(h, { op: 'improvise', deckerUuid: d.uuid, cardId: fake.id, net: 6 });
    assert.equal((h.flags?.[F]?.mxic97?.improvised ?? []).length, 0, 'no rolls');
    assert.equal(d.system.matrix.crippled.evasion, 0);
    const other = { id: 'p2', name: 'Other', isGM: false };
    const r = new g.Roll('5d6'); faces.push(6, 6, 6, 6, 6, 1, 1, 1, 1, 1); await r.evaluate();
    const theirs = await g.ChatMessage.create({ author: other, content: 'x', rolls: [r], flags: { [F]: { mxic97Improvise: { deckerUuid: d.uuid, evasion: 3, bod: 3 } } } });
    await MXG.applyMx97(h, { op: 'improvise', deckerUuid: d.uuid, cardId: theirs.id, net: 6 });
    assert.equal((h.flags?.[F]?.mxic97?.improvised ?? []).length, 0, 'not the decker\'s owner');
  });
  test('a player\'s improvisation: the GM side takes the points, the level from the card\'s dice; the attack gives back only those', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    await d.update({ 'system.matrix.crippled': { bod: 1, evasion: 0, masking: 0, sensors: 0 } });
    d.ownership = { default: 0, p1: 3 };
    g.game.user = PLAYER();
    h.isOwner = false;
    faces.push(5, 5, 1, 1, 1);
    assert.equal(await MXG.improvise(d, { fromEvasion: 2, fromBod: 1 }), true);
    assert.equal(MXG.improvisedProgram(d), null, 'not before the GM\'s Apply');
    assert.equal(d.system.matrix.crippled.evasion, 0, 'the points are the GM side\'s to take');
    const req = card('hostChange');
    assert.equal(req.flags[F].hostChange.mx97.op, 'improvise');
    g.game.user = GM();
    h.isOwner = true;
    await SR2Actor.applyHostChange(h.uuid, req.flags[F].hostChange);
    await SR2Actor.applyHostChange(h.uuid, req.flags[F].hostChange);
    assert.deepEqual([d.system.matrix.crippled.evasion, d.system.matrix.crippled.bod], [2, 2], 'taken once');
    const p = MXG.improvisedProgram(d);
    assert.deepEqual([p.system.rating, p.system.damageLevel], [3, 'M']);
    // The decker raises their own flag: nothing changes.
    d.flags[F] = { ...(d.flags[F] ?? {}), improvised97: { power: 30, level: 'D', evasion: 30, bod: 30, hostUuid: h.uuid } };
    assert.equal(MXG.improvisedProgram(d).system.rating, 3);
    faces.push(1, 1, 1);
    const r = await d.matrixAttack({ targetUuid: ic.uuid, programId: MXG.IMPROVISED_ID });
    assert.equal(r.totalDice, 3);
    assert.deepEqual([d.system.matrix.crippled.evasion, d.system.matrix.crippled.bod], [0, 1], 'only what it took; the crippler\'s point stays');
    assert.equal(MXG.improvisedProgram(d), null, 'one shot');
  });
  test('a failed test: the points are off until Restore, which gives back only those, once', async () => {
    const h = host();
    const d = inside(h);
    g.game.actors = [d];
    faces.push(1, 1, 1, 1, 1);
    assert.equal(await MXG.improvise(d, { fromEvasion: 2, fromBod: 0 }), false);
    assert.equal(d.system.derived.matrix.evasion, 3);
    assert.equal(MXG.improvisedProgram(d), null);
    await MXG.onCard(card('mxic97Restore'), btn(), 'mxic97Restore');
    assert.equal(d.system.derived.matrix.evasion, 5);
    await MXG.onCard(card('mxic97Restore'), btn(), 'mxic97Restore');
    assert.ok(warnings.some((w) => /already/i.test(w)));
  });
  test('leaving the host with an improvised attack not used: the points come back, the attack is gone', async () => {
    const h = host(), e = host();
    const d = inside(h);
    g.game.actors = [d, h, e];
    faces.push(5, 5, 1, 1, 1);
    assert.equal(await MXG.improvise(d, { fromEvasion: 2, fromBod: 1 }), true);
    assert.deepEqual([d.system.matrix.crippled.evasion, d.system.matrix.crippled.bod], [2, 1]);
    await move(d, e);
    assert.deepEqual([d.system.matrix.crippled.evasion, d.system.matrix.crippled.bod], [0, 0]);
    await move(d, h);
    assert.equal(MXG.improvisedProgram(d), null);
  });
  test('v965: no improvising', async (t) => {
    t.after(oldWay({ 'MXIC_V97.improvised': 'v965' }));
    const h = host();
    const d = inside(h);
    g.game.actors = [d];
    assert.equal(await MXG.improvise(d, { fromEvasion: 1, fromBod: 0 }), false);
    assert.equal(chat.length, 0);
  });
});

describe('v0.97.1 finding 7: the deckers in a host follow its record at once', () => {
  test('a suppression prepares the decker again and redraws an open sheet', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    sleaze(d);
    let drawn = 0;
    d.sheet = { rendered: true, render: () => { drawn++; } };
    g.game.actors = [d, ic, h];
    await suppress(h, d, ic);
    assert.equal(d.system.derived.matrix.detectionFactor, 5, 'stale until prepared again (no hook in the stubs)');
    await MXG.onActorUpdateMx97(h, { flags: { [F]: { mxic97: {} } } }, false);
    assert.equal(d.system.derived.matrix.detectionFactor, 4);
    assert.equal(drawn, 1);
    await MXG.onActorUpdateMx97(h, { system: { alert: 'active' } }, false);
    assert.equal(drawn, 1, 'only the record\'s changes');
  });
});

describe('v0.97.1 finding 8: the data bomb\'s choice card', () => {
  test('it names the file; once answered its buttons are disabled', async () => {
    const h = host({ files: [file({ bomb: 4, name: 'ZZ Bombed' })] });
    const d = inside(h);
    g.game.actors = [d];
    await SR2Actor.applyHostChange(h.uuid, { bombOff: { fileId: 'f1', erase: true }, mx97: { op: 'bomb', deckerUuid: d.uuid, id: 'f:f1' } });
    const c = card('mxic97Choice');
    assert.match(String(c.content), /goes off<\/strong> on ZZ Bombed\./);
    assert.doesNotMatch(String(c.content), /Data bomb \(/);
    c.update = async (u: any) => { for (const [k, v] of Object.entries(u)) setPath(c, k, v); };
    await MXG.onCard(c, btn(), 'mxic97Count');
    assert.equal((String(c.content).match(/ disabled>/g) ?? []).length, 2);
    assert.equal(c.flags[F].mxic97Done, true);
    assert.equal(h.system.tallies.find((t: any) => t.key === d.uuid)?.tally, 4);
  });
});

describe('v0.97.1 fix round: a maneuver request is only what its test card shows', () => {
  test('forge: a player\'s own request with net 30 and no card, another\'s card, or the same card twice records nothing', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    d.ownership = { default: 0, p1: 3 };
    g.game.actors = [d, ic];
    for (const op of ['parry', 'evade', 'pos']) await SR2Actor.applyHostChange(h.uuid, { mx97: { op, deckerUuid: d.uuid, vs: ic.uuid, id: 'z', net: 30 } });
    const r = h.flags?.[F]?.mxic97 ?? {};
    assert.equal((r.parry ?? []).length + (r.evade ?? []).length + (r.pos ?? []).length, 0, 'no card');
    const other = { id: 'p2', name: 'Other', isGM: false };
    const theirs = await g.ChatMessage.create({ author: other, content: 'x', flags: { [F]: { test: { kind: 'maneuver', actorUuid: d.uuid, successes: 9, rerolls: 0, maneuver: { kind: 'parry', targetUuid: ic.uuid, opp: 0, entry97: 'z' } } } } });
    await SR2Actor.applyHostChange(h.uuid, { mx97: { op: 'parry', deckerUuid: d.uuid, vs: ic.uuid, id: 'z', cardId: theirs.id } });
    assert.equal((h.flags?.[F]?.mxic97?.parry ?? []).length, 0, 'not by the decker\'s owner');
    const id = await mvCard(d, 'parry', ic.uuid, 'z', 4, 2);
    await SR2Actor.applyHostChange(h.uuid, { mx97: { op: 'parry', deckerUuid: d.uuid, vs: ic.uuid, id: 'z', net: 30, cardId: id } });
    assert.equal(h.flags[F].mxic97.parry[0].net, 2, 'the card\'s 4 − 2, not the request\'s 30');
    faces.push(1, 1, 1, 1);
    await ic.icAttack({ targetUuid: d.uuid });
    assert.equal(h.flags[F].mxic97.parry.length, 0, 'used up');
    await SR2Actor.applyHostChange(h.uuid, { mx97: { op: 'parry', deckerUuid: d.uuid, vs: ic.uuid, id: 'z', cardId: id } });
    assert.equal(h.flags[F].mxic97.parry.length, 0, 'the same card once');
    // A Karma re-roll updates the same card: its request applies again.
    const c = chat.find((m: any) => m.id === id);
    c.flags[F].test = { ...c.flags[F].test, successes: 5, rerolls: 1 };
    await SR2Actor.applyHostChange(h.uuid, { mx97: { op: 'parry', deckerUuid: d.uuid, vs: ic.uuid, id: 'z', cardId: id } });
    assert.equal(h.flags[F].mxic97.parry[0].net, 3);
  });
  test('unexposed needs the card to show the position is no longer lost', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    const id = await mvCard(d, 'position', ic.uuid, 'x', 1, 3);
    await MXG.applyMx97(h, { op: 'exposed', deckerUuid: d.uuid, vs: ic.uuid, id: 'x', cardId: id });
    assert.equal(h.flags[F].mxic97.exposed[0].net, 2);
    await MXG.applyMx97(h, { op: 'unexposed', deckerUuid: d.uuid, vs: ic.uuid, id: 'x' });
    await MXG.applyMx97(h, { op: 'unexposed', deckerUuid: d.uuid, vs: ic.uuid, id: 'x', cardId: id });
    assert.equal(h.flags[F].mxic97.exposed.length, 1, 'no card, or the card still shows the loss');
    const c = chat.find((m: any) => m.id === id);
    c.flags[F].test = { ...c.flags[F].test, successes: 4, rerolls: 1 };
    await MXG.applyMx97(h, { op: 'unexposed', deckerUuid: d.uuid, vs: ic.uuid, id: 'x', cardId: id });
    assert.equal(h.flags[F].mxic97.exposed.length, 0, 'the re-roll won');
  });
  test('the real flow: the request names the maneuver\'s card, sent after it is posted', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    d.ownership = { default: 0, p1: 3 };
    g.game.actors = [d, ic];
    g.game.user = PLAYER();
    h.isOwner = false;
    faces.push(1, 1, 1, 1, 5, 5, 5, 1, 1);
    await d.matrixManeuver('evade', ic.uuid);
    const req = card('hostChange');
    const mvc = chat.find((m: any) => m.flags?.[F]?.test?.kind === 'maneuver');
    assert.ok(mvc && chat.indexOf(mvc) < chat.indexOf(req), 'the card first');
    assert.equal(req.flags[F].hostChange.mx97.cardId, mvc.id);
    g.game.user = GM();
    await SR2Actor.applyHostChange(h.uuid, req.flags[F].hostChange);
    assert.equal(h.flags[F].mxic97.evade[0].net, 3);
  });
});

describe('v0.97.1 fix round: leaving drops only the leaver\'s entries; Log On and Log Off renew the visit', () => {
  test('A moving away and back doesn\'t wipe B\'s parry against A on the record, but it no longer counts', async () => {
    const h = host(), e = host();
    const a = inside(h), b = inside(h);
    g.game.actors = [a, b, h, e];
    await a.update(MXG.runStartUpdate(a));
    await b.update(MXG.runStartUpdate(b));
    await MXG.applyMx97(h, { op: 'parry', deckerUuid: b.uuid, vs: a.uuid, id: 'bp', cardId: await mvCard(b, 'parry', a.uuid, 'bp', 3, 0) });
    assert.equal(MXG.parryMod(b, a.uuid).mod?.value, 3);
    await move(a, e);
    assert.equal(h.flags[F].mxic97.parry.length, 1, 'B\'s entry stays');
    await move(a, h);
    assert.equal(MXG.parryMod(b, a.uuid).mod, null, 'A\'s new visit');
  });
  test('Log On to a host gives a new visit stamp', async () => {
    const h = host();
    const d = decker({});
    d.system.matrix.jackedIn = true; d.system.prepareDerivedData();
    g.game.actors = [d, h];
    await d.update(MXG.runStartUpdate(d));
    const s0 = d.flags[F].run97;
    faces.push(1, 1, 1, 1, 5, 5, 5, 5, 5);
    await d.systemTest('', { operationId: 'logon', targetUuid: h.uuid });
    assert.equal(d.system.matrix.hostUuid, h.uuid);
    assert.notEqual(d.flags[F].run97, s0);
  });
});
