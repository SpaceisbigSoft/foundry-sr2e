/**
 * v0.97.0 rules completeness, Matrix IC and cybercombat (RULES.MXIC_V97): behaviour through the real
 * documents/index.ts, models/index.ts and applications/mxic97.ts with the stubs of v0923-matrix-glue.test.ts (scripted
 * dice, a chat log, warnings): suppressing IC and data bombs, black IC's last shot and the wipe, improvised attacks,
 * the book's parry, position and evade, the Ripper and Tar Pit Tests, the tar's opposed test, scramble's Poison Test,
 * defusing data bombs, reality filters and running cool; and for each switch that 'v965' gives the v0.96.5 behaviour
 * at the read site.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { existsSync, readFileSync } from 'node:fs';
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
let CharacterDataModel: any, IcDataModel: any, HostDataModel: any, SR2Actor: any, MXG: any;

const GM = () => ({ id: 'gm1', name: 'GM', isGM: true, can: () => true });

/** A chat message as Foundry gives it back: an id and getFlag. */
const asMessage = (d: any) => ({ id: `m${++mid}`, timestamp: mid, ...d, getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; }, async setFlag(s: string, k: string, v: any) { ((this.flags ??= {})[s] ??= {})[k] = v; } });

before(async () => {
  // This area's English while its draft isn't merged into public/lang/en.json (the lead deletes the draft then).
  const draft = join('i18n-drafts', 'mxic97.json');
  if (existsSync(draft)) g.__SR2E_EN__ = { ...(g.__SR2E_EN__ ?? {}), ...JSON.parse(readFileSync(draft, 'utf8')) };
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
const btn = (): any => ({ disabled: false });
const card = (key: string) => [...chat].reverse().find((m: any) => m.flags?.[F]?.[key]);
const prog = (d: any, p: any) => {
  d.items.push({ ...p, system: { size: 0, loaded: true, ...p.system }, parent: d, async update(x: any) { for (const [k, v] of Object.entries(x)) setPath(this, k, v); d.system.prepareDerivedData(); } });
  d.system.prepareDerivedData();
};

describe('v0.97.0 suppressing IC (VR2 p. 40)', () => {
  test('a crash asks: suppressing takes 1 off the Detection Factor and no tally; releasing puts the points on', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    prog(d, { id: 'sl', type: 'program', name: 'Sleaze', system: { kind: 'sleaze', rating: 5 } });
    g.game.actors = [d, ic];
    assert.equal(d.liveDetectionFactor(), 5);
    faces.push(1, 1, 1, 1);
    await ic.resistMatrixDamage({ targetUuid: ic.uuid, melee: false, damageType: 'physical', power: 6, level: 'D', matrix: true, matrixAttacker: d.uuid });
    assert.equal(ic.system.derived.crashed, true);
    assert.equal(h.system.tallies.find((t: any) => t.key === d.uuid), undefined, 'nothing yet');
    const choice = card('mxic97Choice');
    assert.ok(choice);
    await MXG.onCard(choice, btn(), 'mxic97Suppress');
    assert.equal(d.liveDetectionFactor(), 4);
    assert.equal(d.system.derived.matrix.detectionFactor, 4);
    await MXG.onCard(choice, btn(), 'mxic97Count');
    assert.ok(warnings.some((w) => /already/i.test(w)), 'answered once');
    assert.equal(h.system.tallies.find((t: any) => t.key === d.uuid), undefined);
    await MXG.onCard(card('mxic97Release'), btn(), 'mxic97Release');
    assert.equal(d.liveDetectionFactor(), 5);
    assert.equal(h.system.tallies.find((t: any) => t.key === d.uuid)?.tally, 6);
  });
  test('counting it puts the points on; a live IC can\'t be suppressed', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    await MXG.choiceCard({ host: h, decker: d, id: ic.uuid, name: ic.name, points: 6, line: 'x' });
    Object.assign(card('mxic97Choice'), { author: g.game.user });
    await MXG.onCard(card('mxic97Choice'), btn(), 'mxic97Suppress');
    assert.ok(warnings.some((w) => /hasn't crashed/.test(w)));
    await MXG.onCard(card('mxic97Choice'), btn(), 'mxic97Count');
    assert.equal(h.system.tallies.find((t: any) => t.key === d.uuid)?.tally, 6);
  });
  test('v965: the tally at once', async (t) => {
    t.after(oldWay({ 'MXIC_V97.suppress': 'v965' }));
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    faces.push(1, 1, 1, 1);
    await ic.resistMatrixDamage({ targetUuid: ic.uuid, melee: false, damageType: 'physical', power: 6, level: 'D', matrix: true, matrixAttacker: d.uuid });
    assert.equal(h.system.tallies.find((t2: any) => t2.key === d.uuid)?.tally, 6);
    assert.equal(card('mxic97Choice'), undefined);
  });
});

describe('v0.97.0 black IC\'s last shot (VR2 p. 48)', () => {
  const blackHit = { targetUuid: '', melee: false, damageType: 'physical', power: 6, level: 'D', matrix: true, black: true, ic: { behavior: 'killer', icUuid: 'Actor.x', icName: 'Black 6', rating: 6, category: 'black' } };
  test('killing the decker: Blaster at double the rating; a destroyed MPCP wipes the run\'s downloads and goes to 0', async () => {
    const h = host();
    const d = inside(h);
    d.system.monitor.physical = 13; d.system.prepareDerivedData();
    g.game.actors = [d];
    const deck = d.items.get('deck');
    deck.system.files = [{ name: 'Old', size: 1 }];
    Object.assign(d.flags, { [F]: { ...(d.flags[F] ?? {}), ...MXG.runStartUpdate(d)[`flags.${F}.runFiles97`] ? { runFiles97: MXG.runStartUpdate(d)[`flags.${F}.runFiles97`] } : {} } });
    deck.system.files = [{ name: 'Old', size: 1 }, { name: 'Loot', size: 9, source: 'Host' }];
    faces.push(1, 1, 1, 1);
    await d.resistMatrixDamage({ ...blackHit, targetUuid: d.uuid });
    const dd = card('deckDamage');
    assert.ok(dd, text());
    assert.equal(dd.flags[F].deckDamage.rating, 12);
    assert.equal(dd.flags[F].deckDamage.wipe97, true);
    faces.push(...Array(12).fill(6), ...Array(12).fill(2));
    await d.takeDeckDamage('Black 6', 12, 'last shot', { wipe97: true });
    assert.equal(deck.system.damage.mpcp, 6);
    assert.deepEqual(deck.system.files.map((f: any) => f.name), ['Old']);
    assert.match(text(), /MPCP of Deck is destroyed/);
  });
  test('a hit that doesn\'t kill: no shot; v965: none', async (t) => {
    const h = host();
    const d = inside(h);
    g.game.actors = [d];
    faces.push(1, 1, 1, 1);
    await d.resistMatrixDamage({ ...blackHit, targetUuid: d.uuid });
    assert.equal(card('deckDamage'), undefined);
    t.after(oldWay({ 'MXIC_V97.blackIcKill': 'v965' }));
    d.system.monitor.physical = 13; d.system.prepareDerivedData();
    faces.push(1, 1, 1, 1);
    await d.resistMatrixDamage({ ...blackHit, targetUuid: d.uuid });
    assert.equal(card('deckDamage'), undefined);
  });
});

describe('v0.97.0 improvised attacks (VR2 pp. 120, 123)', () => {
  test('points off Evasion and Bod, a Computer Test vs the Power for the level; the attack gives them back', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    faces.push(5, 5, 1, 1, 1);
    assert.equal(await MXG.improvise(d, { fromEvasion: 2, fromBod: 1 }), true);
    assert.match(text(), /Improvised attack ready: 3M/);
    assert.deepEqual([d.system.derived.matrix.evasion, d.system.derived.matrix.bod], [3, 3]);
    faces.push(1, 1, 1);
    const r = await d.matrixAttack({ targetUuid: ic.uuid, programId: MXG.IMPROVISED_ID });
    assert.equal(r.totalDice, 3);
    assert.deepEqual([d.system.derived.matrix.evasion, d.system.derived.matrix.bod], [5, 4]);
    assert.equal(MXG.improvisedProgram(d), null, 'one shot');
  });
  test('Power above the MPCP is refused; a failed test keeps the points off until Restore', async () => {
    const h = host();
    const d = inside(h);
    g.game.actors = [d];
    assert.equal(await MXG.improvise(d, { fromEvasion: 5, fromBod: 4 }), false);
    assert.ok(warnings.some((w) => /MPCP/.test(w)));
    faces.push(1, 1, 1, 1, 1);
    assert.equal(await MXG.improvise(d, { fromEvasion: 2, fromBod: 0 }), false);
    assert.equal(d.system.derived.matrix.evasion, 3);
    await MXG.onCard(card('mxic97Restore'), btn(), 'mxic97Restore');
    assert.equal(d.system.derived.matrix.evasion, 5);
  });
  test('v965: no improvised program', (t) => {
    t.after(oldWay({ 'MXIC_V97.improvised': 'v965' }));
    const h = host();
    const d = inside(h, {});
    d.flags[F] = { improvised97: { power: 3, level: 'M', evasion: 0, bod: 0, hostUuid: h.uuid } };
    assert.equal(MXG.improvisedProgram(d), null);
  });
});

describe('v0.97.0 combat maneuvers (VR2 pp. 121–122)', () => {
  test('parry: +net TN on the IC\'s next attack only, no cap', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    faces.push(1, 1, 1, 1, /* decker Evasion 5 vs SV 4 */ 5, 5, 5, 5, 5);
    await d.matrixManeuver('parry', ic.uuid);
    assert.match(text(), /parries/);
    faces.push(1, 1, 1, 1);
    const r1 = await ic.icAttack({ targetUuid: d.uuid });
    assert.equal(r1.targetNumber, 4 + 5);
    faces.push(1, 1, 1, 1);
    const r2 = await ic.icAttack({ targetUuid: d.uuid });
    assert.equal(r2.targetNumber, 4, 'used up');
  });
  test('position backfires: the IC gets the net off its next attack; won: +Power on the decker\'s attack', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    faces.push(5, 5, 5, 1, /* decker */ 5, 1, 1, 1, 1);
    await d.matrixManeuver('position', ic.uuid);
    assert.match(text(), /backfires/);
    faces.push(1, 1, 1, 1);
    const r = await ic.icAttack({ targetUuid: d.uuid });
    assert.equal(r.targetNumber, 2);
    faces.push(1, 1, 1, 1, /* decker */ 5, 5, 5, 1, 1);
    await d.matrixManeuver('position', ic.uuid);
    faces.push(1, 1, 1, 1);
    const a = await d.matrixAttack({ targetUuid: ic.uuid, programId: 'atk', positionAs97: 'power' });
    assert.equal(a.targetNumber, 5);
    assert.match(text(), /Attack \([^)]*, 7M\)/);
    faces.push(1, 1, 1, 1);
    await d.matrixAttack({ targetUuid: ic.uuid, programId: 'atk', positionAs97: 'power' });
    assert.match(String(chat.at(-1).content), /, 4M\)/, 'used up');
  });
  test('evade: the IC can\'t attack for net Combat Turns, 1 less per tally point', async () => {
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    g.game.combat = { started: true, round: 3, id: 'c1' };
    faces.push(1, 1, 1, 1, 5, 5, 5, 1, 1);
    await d.matrixManeuver('evade', ic.uuid);
    assert.match(text(), /evades/);
    assert.equal(await ic.icAttack({ targetUuid: d.uuid }), null);
    g.game.combat.round = 6;
    assert.equal(await ic.icAttack({ targetUuid: d.uuid }), null, 'through round 3 + 3');
    g.game.combat.round = 5;
    assert.equal(await ic.icAttack({ targetUuid: d.uuid }), null);
    h.system.tallies = [{ key: d.uuid, name: d.name, tally: 2 }];
    faces.push(1, 1, 1, 1);
    assert.ok(await ic.icAttack({ targetUuid: d.uuid }), 'the tally rose 2: found again sooner');
  });
  test('v965: the old parry (capped, a turn long)', async (t) => {
    t.after(oldWay({ 'MXIC_V97.parry': 'v965' }));
    const h = host();
    const ic = icIn(h);
    const d = inside(h);
    g.game.actors = [d, ic];
    faces.push(1, 1, 1, 1, 5, 5, 5, 5, 5);
    await d.matrixManeuver('parry', ic.uuid);
    faces.push(1, 1, 1, 1);
    assert.equal((await ic.icAttack({ targetUuid: d.uuid })).targetNumber, 4 + RULES.MATRIX_V57.maneuvers.maxTn);
    faces.push(1, 1, 1, 1);
    assert.equal((await ic.icAttack({ targetUuid: d.uuid })).targetNumber, 4 + RULES.MATRIX_V57.maneuvers.maxTn, 'not used up');
  });
});

describe('v0.97.0 ripper and tar IC (VR2 pp. 42–43)', () => {
  test('a ripper cripples the icon, then its Ripper Test takes a chip point per success', async () => {
    const h = host();
    const r = icIn(h, { behavior: 'ripper', attribute: 'masking', name: 'Ripper-6' });
    const d = inside(h);
    d.items.get('deck').system.hardening = 0; d.system.prepareDerivedData();
    g.game.actors = [d, r];
    faces.push(5, 5, 5, 5);
    await r.icAttack({ targetUuid: d.uuid });
    faces.push(1, 1, 1, 1, 1, /* Ripper 6 vs MPCP 6 */ 6, 6, 1, 1, 1, 1, /* the 6s roll on */ 1, 1);
    await d.defend(card('test')?.flags?.[F]?.attack ?? chat.at(-1).flags[F].attack, 0);
    assert.equal(d.system.matrix.crippled.masking, 2);
    assert.equal(d.items.get('deck').system.damage?.masking, 2);
    assert.match(text(), /2 off Deck's masking chip/);
  });
  test('tar baby: its rating vs the utility\'s, the utility\'s rating back; more tar successes crash both; armor is spared', async () => {
    const h = host();
    const tb = icIn(h, { behavior: 'tarBaby', rating: 5, name: 'Tar baby-5' });
    const d = inside(h);
    prog(d, { id: 'ar', type: 'program', name: 'Armor', system: { kind: 'armor', rating: 6 } });
    g.game.actors = [d, tb];
    faces.push(5, 5, 5, 1, 1);
    const r = await tb.icAttack({ targetUuid: d.uuid });
    assert.deepEqual([r.totalDice, r.targetNumber], [5, 4], 'Attack 4 (the best non-passive utility)');
    faces.push(5, 1, 1, 1);
    await d.defend(chat.at(-1).flags[F].attack, 0);
    assert.equal(d.items.get('atk').system.loaded, false);
    assert.equal(tb.system.matrix.monitor, RULES.MATRIX.monitorBoxes);
    assert.equal(d.items.get('ar').system.loaded, true);
  });
  test('tar pit: the Tar Pit Test vs MPCP + Hardening; no success and the utility can be reloaded', async () => {
    const h = host();
    const tp = icIn(h, { behavior: 'tarPit', rating: 5, name: 'Tar pit-5' });
    const d = inside(h);
    d.items.get('deck').system.hardening = 0; d.system.prepareDerivedData();
    g.game.actors = [d, tp];
    faces.push(5, 5, 5, 1, 1);
    await tp.icAttack({ targetUuid: d.uuid, programId: 'atk' });
    faces.push(1, 1, 1, 1, /* Tar Pit 5 vs 6 */ 1, 1, 1, 1, 1);
    await d.defend(chat.at(-1).flags[F].attack, 0);
    assert.equal(d.items.get('atk').system.loaded, false);
    assert.notEqual(d.items.get('atk').system.erased, true);
    assert.match(text(), /viral code is defeated/);
  });
  test('v965: the tar baby rolls the Security Value', async (t) => {
    t.after(oldWay({ 'MXIC_V97.tar': 'v965' }));
    const h = host();
    const tb = icIn(h, { behavior: 'tarBaby', rating: 5, name: 'Tar baby-5' });
    const d = inside(h);
    g.game.actors = [d, tb];
    faces.push(1, 1, 1, 1);
    const r = await tb.icAttack({ targetUuid: d.uuid, programId: 'atk' });
    assert.equal(r.totalDice, 4);
  });
});

describe('v0.97.0 scramble IC and data bombs (VR2 pp. 41–42, 96)', () => {
  const file = (extra: any = {}) => ({ id: 'f1', name: 'Data', size: 10, value: 0, paydata: false, encrypted: 0, scramble: 0, bomb: 0, ...extra });
  test('a failed decryption of poison scramble: the Poison Test vs Computer decides', async () => {
    const h = host({ files: [file({ scramble: 5 })] });
    const d = inside(h);
    g.game.actors = [d];
    h.system.files[0].foundBy = [d.uuid];
    noDetect(); faces.push(1, 2, 2, 2, 2, /* Poison 5 vs Computer 5 */ 1, 1, 1, 1, 1);
    await d.systemTest('files', { operationId: 'decryptFile', fileId: 'f1' });
    assert.match(text(), /suppresses the poison IC/);
    assert.equal(h.system.files.length, 1);
    chat.length = 0;
    noDetect(); faces.push(1, 2, 2, 2, 2, 5, 1, 1, 1, 1);
    await d.systemTest('files', { operationId: 'decryptFile', fileId: 'f1' });
    assert.match(text(), /scramble IC destroys Data/);
    assert.equal(h.system.files.length, 0);
  });
  test('defusing: Files − Defuse; all 1s sets it off: its damage, and the tally or suppress (no alert)', async () => {
    const h = host({ files: [file({ bomb: 4 })] });
    const d = inside(h);
    prog(d, { id: 'df', type: 'program', name: 'Defuse', system: { kind: 'defuse', rating: 3 } });
    g.game.actors = [d];
    Object.assign(h.system.files[0], { foundBy: [d.uuid], bombFoundBy: [d.uuid] });
    noDetect(); faces.push(1, 1, 1, 1, 1);
    const r = await d.systemTest('files', { operationId: 'defuseBomb', fileId: 'f1' });
    assert.equal(r.targetNumber, 2, 'Files 5 − Defuse 3');
    assert.match(text(), /A data bomb goes off/);
    assert.ok(card('mxic97Choice'));
    assert.equal(h.system.alert, 'none');
  });
  test('v965: Decrypt vs the bomb\'s rating; scramble destroys on any failure', async (t) => {
    t.after(oldWay({ 'MXIC_V97.dataBomb': 'v965', 'MXIC_V97.scramble': 'v965' }));
    const h = host({ files: [file({ bomb: 4, scramble: 3 })] });
    const d = inside(h);
    g.game.actors = [d];
    Object.assign(h.system.files[0], { foundBy: [d.uuid], bombFoundBy: [d.uuid] });
    noDetect(); faces.push(1, 1, 1, 1, 1);
    const r = await d.systemTest('files', { operationId: 'defuseBomb', fileId: 'f1' });
    assert.equal(r.targetNumber, 4);
    assert.equal(card('mxic97Choice'), undefined);
  });
});

describe('v0.97.0 persona speed (VR2 pp. 84–87, 120)', () => {
  test('a reality filter: one more level and MPCP −1; running cool 1D6 less; the non-combat actions', () => {
    const d = decker();
    assert.deepEqual([d.system.derived.matrix.reaction, d.system.derived.matrix.initiativeDice, d.system.derived.matrix.nonCombat97], [7, 1, 1]);
    d.items.get('deck').system.realityFilter = true; d.system.prepareDerivedData();
    assert.deepEqual([d.system.derived.matrix.mpcp, d.system.derived.matrix.reaction, d.system.derived.matrix.initiativeDice], [5, 9, 2]);
    d.system.matrix.sim = 'hot'; d.system.prepareDerivedData();
    assert.deepEqual([d.system.derived.matrix.reaction, d.system.derived.matrix.initiativeDice, d.system.derived.matrix.nonCombat97], [11, 4, 5]);
  });
  test('v965: the old filter bonus, no cool penalty, no actions shown', (t) => {
    t.after(oldWay({ 'MXIC_V97.realityFilter': 'v965', 'MXIC_V97.coolInit': 'v965', 'MXIC_V97.nonCombat': 'v965' }));
    const d = decker();
    d.items.get('deck').system.realityFilter = true; d.system.prepareDerivedData();
    assert.deepEqual([d.system.derived.matrix.mpcp, d.system.derived.matrix.reaction, d.system.derived.matrix.initiativeDice, d.system.derived.matrix.nonCombat97], [6, 7, 2, null]);
  });
});
