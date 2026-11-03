/**
 * v0.81.1 fix round, FX-DOC: documents/index.ts. One test (or more) per finding fixed from RV/{D1,D2,D3,RA,RB,SEC1,SEC2}.md,
 * with the reviewers' own failing inputs where they had one (try-SEC1 sec1b-doc X1-X6, try-D1 P1-P5, try-D2 P1-P2,
 * try-D3 P1-P4, inverted). Each failed before its fix. The harness is v081-r2doc.test.ts's (the v0.71.0 glue stubs).
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';

const g = globalThis as any;
const faces: number[] = [];
const chat: any[] = [];
const warnings: string[] = [];
const uuidRegistry = new Map<string, any>();
const created: any[] = [];
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

let CharacterDataModel: any, VehicleDataModel: any, SR2Actor: any;

const GM = () => ({ id: 'gm1', name: 'GM', isGM: true, can: () => true });

/** A chat message as Foundry gives it back: an id and getFlag. */
const asMessage = (d: any) => ({ id: `m${++mid}`, timestamp: mid, ...d, getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; } });

before(async () => {
  // As in glue.test.ts and v070.test.ts: rules that add steps or prompts are off unless a test turns them on.
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
  g.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
  g.game = {
    i18n: { localize: (k: string) => k }, user: GM(), users: Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } }),
    time: { worldTime: 0 }, settings: { get: (_s: string, k: string) => settings[k], set: async () => {}, register: () => {} },
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
  (g.Actor as any).implementation = { create: async (d: any) => { created.push(d); return { uuid: `Actor.made${created.length}`, ...d }; } };
  g.Item = class {};
  g.Combatant = class { actor: any; };
  g.Combat = class { combatants: any[] = []; flags: any = {}; getFlag(_s: string, k: string) { return this.flags[k]; } async setFlag(_s: string, k: string, v: any) { this.flags[k] = v; } };
  ({ CharacterDataModel, VehicleDataModel } = await import('../models/index.ts'));
  ({ SR2Actor } = await import('../documents/index.ts'));
  g.CONFIG = { Actor: { documentClass: SR2Actor } };
});

beforeEach(() => {
  faces.length = 0; chat.length = 0; warnings.length = 0; created.length = 0; settings = {};
  g.game.user = GM();
  g.game.users = Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } });
  g.game.time = { worldTime: 0 };
  g.game.actors = [];
  g.game.messages = { contents: [] };
  delete g.game.combat;
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
    poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, monitor: { physical: 0, stun: 0 }, rigging: { vehicleUuid: '', jumpedIn: false, subscribed: [] }, ...rest,
  });
  const a = new SR2Actor();
  a.system = sys;
  a.name = name ?? 'Runner'; a.type = type ?? 'character';
  a.uuid = `Actor.d81-${++n}`; a.id = `id${n}`;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}

/** A vehicle on the real data model (as glue.test.ts's). */
function vehicle(extra: any = {}): any {
  const v = new SR2Actor();
  const sys = Object.create(VehicleDataModel.prototype);
  Object.assign(sys, { category: 'car', skill: '', drone: false, handling: 4, handlingOffroad: 8, speed: 90, accel: 10, body: 4, armor: 3, signature: 2, autonav: 2, pilot: 0, sensor: 1,
    condition: 0, currentSpeed: 60, offroad: false, controllerUuid: '', controlMode: 'autopilot', occupants: [], mods: [], systems: { tires: false, engine: false, sensors: false }, ...extra });
  sys.prepareDerivedData();
  Object.assign(v, { type: 'vehicle', name: extra.name ?? 'Americar', uuid: `Actor.d81veh-${++n}`, system: sys, items: withGet([]), statuses: new Set<string>() });
  sys.parent = v;
  uuidRegistry.set(v.uuid, v);
  return v;
}

/** Run with a RULES path changed, put back afterwards. */
async function withRule<T>(obj: any, key: string, value: unknown, fn: () => T | Promise<T>): Promise<T> {
  const prev = obj[key];
  obj[key] = value;
  try { return await fn(); } finally { obj[key] = prev; }
}


// ---------------------------------------------------------------------------------------------------------------

const PLAYER = () => ({ id: 'p1', name: 'Player', isGM: false, can: () => true });
/** Owners for the trust checks: `who`'s actors have no testUserPermission of their own. */
const ownedBy = (a: any, ...ids: string[]) => { a.testUserPermission = (u: any) => Boolean(u?.isGM) || ids.includes(u?.id); return a; };

const P1 = () => ({ id: 'p1', name: 'Player One', isGM: false, can: () => true });
const P2 = () => ({ id: 'p2', name: 'Player Two', isGM: false, can: () => true });
const dice = (n: number, face = 6) => Array.from({ length: n }, () => ({ faces: [face], total: face, success: face >= 4 }));
/** A card authored by `author` carrying a test snapshot (a forged one, when the author wrote the flags). */
const cardBy = (author: any, snap: any, extra: any = {}) => asMessage({ author, speaker: {}, content: '<p>Sneaking test</p>', flags: { sr2e: { test: snap, ...extra } }, update: async function (this: any, d: any) { Object.assign(this, { _upd: d }); } });
const usersAll = () => Object.assign([GM(), P1(), P2()], { activeGM: { id: 'gm1', isSelf: true } });

// =============================================================================== design 1: act as the card's author
describe('SEC1-1 / D1-1: a GM re-running a player\'s card acts as that player', () => {
  test('X1 inverted: GM retarget of P1\'s card puts no effect on P2\'s character; an Apply (GM) card instead', async () => {
    g.game.users = usersAll();
    const mine = ownedBy(who({ name: 'Mine' }), 'p1');
    const victim = ownedBy(who({ name: 'Victim' }), 'p2');
    const snap: any = {
      actorUuid: mine.uuid, kind: 'skill', label: 'Sneaking', rerolls: 0, testId: 'tX1', baseTargetNumber: 4, targetNumber: 4, modifiers: [],
      dice: dice(3), successes: 3, botch: false,
      powerEffect: { kind: 'power', name: 'Innocent', targetUuids: [victim.uuid], attributes: { body: -20, quickness: -20 }, perSuccess: false },
    };
    const msg = cardBy(P1(), snap);
    g.game.messages = { contents: [msg] };
    const posted = await SR2Actor.retarget(msg, { baseTargetNumber: 4, modifiers: [] });
    assert.equal((victim.flags?.sr2e?.powerEffects ?? []).length, 0, 'no direct write on P2\'s character');
    assert.ok(chat.some((m: any) => m.flags?.sr2e?.powerEffect), 'an Apply (GM) card was posted');
    assert.equal(posted.author, 'p1', 'the replacement keeps P1 as its author');
    assert.equal(SR2Actor.actingAuthor, null, 'the acting author is cleared afterwards');
  });

  test('X2 inverted: a snapshot naming a roller the author doesn\'t own is refused', async () => {
    g.game.users = usersAll();
    const victim = ownedBy(who({ name: 'Victim' }), 'p2');
    const snap: any = {
      actorUuid: victim.uuid, kind: 'soak', label: 'Resist damage', rerolls: 0, testId: 'tX2', baseTargetNumber: 4, targetNumber: 4, modifiers: [],
      dice: dice(2, 1), successes: 0, botch: false,
      soak: { mode: 'stage', level: 'D', type: 'physical', noun: 'damage', body: 4, before: { physical: 0, stun: 0 } },
    };
    const msg = cardBy(P1(), snap);
    g.game.messages = { contents: [msg] };
    assert.equal(await SR2Actor.retarget(msg, { baseTargetNumber: 4, modifiers: [] }), null);
    assert.equal(Number(victim.system.monitor.physical), 0);
    assert.match(warnings.at(-1) ?? '', /doesn't own/);
  });

  test('X3 inverted: a GM Karma re-roll run as P1 (runAsAuthor) posts an Apply (GM) card, as P1\'s own would (X4)', async () => {
    g.game.users = usersAll();
    const mine = ownedBy(who({ name: 'Mine', karma: { pool: 5, poolSpent: 0, good: 0, career: 0 } }), 'p1');
    const victim = ownedBy(who({ name: 'Victim' }), 'p2');
    const snap: any = {
      actorUuid: mine.uuid, kind: 'skill', label: 'Sneaking', rerolls: 0, testId: 'tX3', baseTargetNumber: 4, targetNumber: 4, modifiers: [],
      dice: [...dice(2), ...dice(1, 1)], successes: 2, botch: false,
      powerEffect: { kind: 'power', name: 'Innocent', targetUuids: [victim.uuid], attributes: { willpower: -20 }, perSuccess: false },
    };
    faces.push(5);
    await SR2Actor.runAsAuthor(P1(), () => mine.karmaReroll(snap));
    assert.equal((victim.flags?.sr2e?.powerEffects ?? []).length, 0);
    assert.ok(chat.some((m: any) => m.flags?.sr2e?.powerEffect), 'an Apply (GM) card instead');
    assert.ok(chat.some((m: any) => m.flags?.sr2e?.test && m.author === 'p1'), 'the re-roll card is P1\'s');
  });

  test('X3 control: a GM-authored card (or none) runs with the GM\'s rights, as before', async () => {
    const mine = ownedBy(who({ name: 'Mine', karma: { pool: 5, poolSpent: 0, good: 0, career: 0 } }), 'p1');
    const npc = ownedBy(who({ name: 'NPC' }));
    const snap: any = {
      actorUuid: mine.uuid, kind: 'skill', label: 'Sneaking', rerolls: 0, testId: 'tX3b', baseTargetNumber: 4, targetNumber: 4, modifiers: [],
      dice: [...dice(2), ...dice(1, 1)], successes: 2, botch: false,
      powerEffect: { kind: 'power', name: 'Hex', targetUuids: [npc.uuid], attributes: { willpower: -1 }, perSuccess: false },
    };
    faces.push(5);
    await SR2Actor.runAsAuthor(GM(), () => mine.karmaReroll(snap));
    assert.equal((npc.flags?.sr2e?.powerEffects ?? []).length, 1);
  });

  test('X5 inverted: a GM retarget of a forged "bind by true name" card leaves P2\'s spirit with P2', async () => {
    g.game.users = usersAll();
    const mine = ownedBy(who({ name: 'Mine', karma: { pool: 0, poolSpent: 0, good: 50, career: 50 } }), 'p1');
    const theirs = ownedBy(who({ name: 'Theirs' }), 'p2');
    const spirit = ownedBy(who({ name: 'Their Watcher', type: 'spirit', force: 1, summonerUuid: theirs.uuid, services: 3 }), 'p2');
    spirit.ownership = { default: 0, p2: 3 };
    const snap: any = {
      actorUuid: mine.uuid, kind: 'bindName', label: 'Perception', rerolls: 0, testId: 'tX5', baseTargetNumber: 4, targetNumber: 4, modifiers: [],
      dice: dice(4), successes: 4, botch: false,
      bindName: { spiritUuid: spirit.uuid, spiritName: 'x', force: 1, spiritSuccesses: 0, summonerBefore: theirs.uuid, servicesBefore: 3 },
    };
    const msg = cardBy(P1(), snap);
    g.game.messages = { contents: [msg] };
    await SR2Actor.retarget(msg, { baseTargetNumber: 4, modifiers: [] });
    assert.equal(spirit.system.summonerUuid, theirs.uuid);
    assert.equal(spirit.ownership.p2, 3);
    assert.equal(spirit.ownership.p1, undefined);
  });

  test('the write guard: while acting as P1, a write to a document P1 doesn\'t own is cancelled; a card gets P1 as author', async () => {
    const { actingMayWrite, actingAuthorFor } = await import('../documents/index.ts');
    g.game.users = usersAll();
    const mine = ownedBy(who({ name: 'Mine' }), 'p1');
    const theirs = ownedBy(who({ name: 'Theirs' }), 'p2');
    assert.equal(actingMayWrite(theirs, 'update', 'Actor', 'gm1'), true, 'not acting: no change');
    await SR2Actor.runAsAuthor(P1(), async () => {
      assert.equal(actingMayWrite(theirs, 'update', 'Actor', 'gm1'), false);
      assert.equal(actingMayWrite(mine, 'update', 'Actor', 'gm1'), true);
      assert.equal(actingMayWrite({ parent: theirs }, 'create', 'Item', 'gm1'), false);
      assert.equal(actingMayWrite(theirs, 'update', 'Actor', 'p2'), true, 'another user\'s own write is not ours to judge');
      assert.equal(actingAuthorFor({}, 'gm1'), 'p1');
      assert.equal(actingAuthorFor({ author: 'p2' }, 'gm1'), null);
    });
    assert.equal(actingAuthorFor({}, 'gm1'), null);
  });
});

// =============================================================================== surgery (RA2-1, D1-2, SEC1-7, D1-7)
describe('surgery: progress and money from the patient, never the card', () => {
  const ware = (extra: any = {}) => ({ id: 'dj', type: 'cyberware', name: 'Datajack', system: { essenceCost: 0.2, grade: 'standard', installed: false, attributes: {}, ...extra } });

  test('X6 inverted: a forged paidAmount moves no nuyen', async () => {
    const surgeon = ownedBy(who({ name: 'Doc' }), 'p1');
    const patient = ownedBy(who({ name: 'Patient', nuyen: 5000 }, [ware()]), 'p2');
    const snap: any = { actorUuid: surgeon.uuid, kind: 'surgery', label: 'Surgery', rerolls: 0, testId: 'tX6', dice: dice(4), successes: 4, botch: false,
      surgery: { id: 'sX6', patientUuid: patient.uuid, patientName: 'Patient', itemId: 'dj', itemName: 'Datajack', points: 0.2, care: '', pay: false, installed: true, paid: true, paidAmount: -4000 } };
    await SR2Actor.applySurgeryAsGm(surgeon.uuid, snap);
    assert.equal(patient.system.nuyen, 5000);
    assert.equal(patient.items.get('dj').system.installed, true, 'the card\'s installed: true is ignored: it goes in now');
  });

  test('D1 P2 inverted: a card naming no cyberware the patient has is refused (no ¥50,000 drained)', async () => {
    const surgeon = ownedBy(who({ name: 'Doc' }), 'p1');
    const victim = ownedBy(who({ name: 'Victim', nuyen: 50000 }), 'p2');
    const snap: any = { actorUuid: surgeon.uuid, label: 'Surgery', kind: 'surgery', rerolls: 0, successes: 3, botch: false, dice: [], modifiers: [], baseTargetNumber: 4, targetNumber: 4, targetNumberClamped: false, totalDice: 3,
      surgery: { id: 'op2', patientUuid: victim.uuid, patientName: 'Victim', itemId: 'none', itemName: 'Datajack', points: 0.2, care: '', pay: false, paid: true, paidAmount: -50000 } };
    assert.equal(await SR2Actor.applySurgeryAsGm(surgeon.uuid, snap), false);
    assert.equal(victim.system.nuyen, 50000);
  });

  test('RA2-1: a huge positive paidAmount pays nothing; a bad care id falls back to the default care', () => {
    const patient = who({ name: 'Bob' }, [ware()]);
    const sg = SR2Actor.surgeryFromCard({ id: 'x', patientUuid: patient.uuid, itemId: 'dj', points: 99, care: 'constructor', pay: true, paid: true, paidAmount: 9e12, installed: true }, patient, true);
    assert.equal(sg.paid, false);
    assert.equal(sg.paidAmount, 0);
    assert.equal(sg.installed, false);
    assert.equal(sg.points, 0.2, 'points from the item, not the card');
    assert.equal(sg.care, RULES.BIOWARE.recovery.defaultCare);
    patient.flags.sr2e = { surgeryState: { x: { installed: true, paid: true, paidAmount: 300, harmed: false, traumaDone: true } } };
    const sg2 = SR2Actor.surgeryFromCard({ id: 'x', patientUuid: patient.uuid, itemId: 'dj', paidAmount: 0 }, patient, true);
    assert.equal(sg2.paidAmount, 300);
    assert.equal(sg2.installed, true);
  });

  test('D1-7: a re-roll\'s Apply (GM) surgery card marks the earlier unapplied one superseded', async () => {
    g.game.user = P1();
    g.game.users = usersAll();
    const surgeon = ownedBy(who({ name: 'Doc', karma: { pool: 5, poolSpent: 0, good: 0, career: 0 } }), 'p1');
    const patient = ownedBy(who({ name: 'Pat' }, [ware()]), 'p2');
    patient.isOwner = false;
    const old = asMessage({ author: P1(), flags: { sr2e: { surgeryApply: { surgeonUuid: surgeon.uuid, snap: { testId: 'tS' } } } } });
    old.testUserPermission = (u: any) => u?.id === 'p1';
    old.isOwner = true;
    old.setFlag = async (_s: string, k: string, v: any) => { old.flags.sr2e[k] = v; };
    g.game.messages = { contents: [old] };
    faces.push(5, 5, 5, 5, 5, 5, 5, 5);
    await patient.surgery('dj', { surgeon });
    const card = chat.find((m: any) => m.flags?.sr2e?.surgeryApply);
    assert.ok(card, 'an Apply (GM) card');
    // The new card's test id is fresh: give the old card the same id and resolve again (a Karma re-roll keeps it).
    old.flags.sr2e.surgeryApply.snap.testId = card.flags.sr2e.surgeryApply.snap.testId;
    faces.push(5);
    await surgeon.karmaReroll({ ...card.flags.sr2e.surgeryApply.snap, dice: [...dice(2), ...dice(1, 1)] });
    assert.equal(old.flags.sr2e.surgeryApplied, 'superseded');
  });
});

// =============================================================================== projects (D1-3, D1-6, D1-12, D3-1, D3-3, D3-6)
const forgedProject = (id: string, method: string, args: any[]) => ({ id, kind: 'learn', area: 'magic', label: 'x', startedAt: 0, readyAt: 0, hours: 0, paid: { karma: 0, nuyen: 0 }, effect: { call: { method, args } } });

describe('projects on the GM\'s clock', () => {
  test('D3 P1 inverted: a forged finishModInstall can\'t charge another player\'s character', async () => {
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: true } });
    const mine = ownedBy(who({ name: 'Player PC' }), 'p1');
    mine.ownership = { default: 0, p1: 3 };
    const victim = ownedBy(who({ name: 'Other PC', nuyen: 54321 }), 'p2');
    const van = ownedBy(vehicle({ name: 'My van', mods: [{ kind: 'armor', rating: 1, name: 'Plate', cost: 54321, installed: false }] }), 'p1');
    mine.flags.sr2e = { projects: { a: forgedProject('a', 'finishModInstall', [van.uuid, 0, victim.uuid, 'Plate', 0, null]) } };
    g.game.actors = [mine, victim, van];
    await SR2Actor.timedEffects({ worldTime: 10 });
    assert.equal(victim.system.nuyen, 54321);
  });

  test('D1 P3 inverted: a mod install on the party\'s GM van is carded for the GM, not dropped; Apply installs it', async () => {
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: true } });
    const mech = ownedBy(who({ name: 'Mech', nuyen: 1000 }), 'p1');
    const van = ownedBy(vehicle({ name: 'Party van', mods: [{ name: 'Armor', kind: 'armor', rating: 1, installed: false, cost: 500 }] }));
    let installed = 0; van.installMod = async () => { installed++; return true; };
    const p = { id: 'pr1', kind: 'install', label: 'Installing Armor in Party van', hours: 1, startedAt: 0, readyAt: 3600, paid: { karma: 0, nuyen: 0 }, by: 'Player',
      effect: { call: { method: 'finishModInstall', args: [van.uuid, 0, null, 'Armor', 500, mech.uuid] } } };
    mech.flags.sr2e = { projects: { pr1: p } };
    await mech.finishProject('pr1');
    assert.equal(installed, 0);
    const card = chat.find((m: any) => m.flags?.sr2e?.vehicleJob);
    assert.ok(card, 'a GM card');
    assert.doesNotMatch(chat.at(-1).content, /paid back/);
    assert.match(chat.at(-1).content, /the GM applies it/);
    assert.ok(await SR2Actor.applyVehicleJobAsGm(card.flags.sr2e.vehicleJob));
    assert.equal(installed, 1);
  });

  test('D1 P5 inverted: training whose skill was deleted gives its Karma back', async () => {
    const a = who({ name: 'Student', karma: { pool: 0, poolSpent: 0, good: 0, career: 30 },
      training: [{ id: 'tr1', label: 'Pistols 3 → 4', attribute: '', skillId: 'deleted', part: 'rating', to: 4, cost: 8, startedAt: 0, readyAt: 999999, days: 10, baseDays: 10 }] });
    assert.ok(await a.finishProject('tr1'));
    assert.equal(a.system.karma.good, 8);
    assert.equal(a.system.training.length, 0);
    assert.match(chat.at(-1).content, /no longer there/);
  });

  test('training: a refund is bounded (the list is the players\' to write)', async () => {
    const a = who({ name: 'Student', karma: { pool: 0, poolSpent: 0, good: 0, career: 30 },
      training: [{ id: 'tr2', label: 'x', attribute: '', skillId: 'deleted', part: 'rating', to: 4, cost: 1e9, startedAt: 0, readyAt: 0, days: 1, baseDays: 1 }] });
    await a.finishProject('tr2');
    assert.equal(a.system.karma.good, 100);
  });

  test('D3 P4 inverted: a player\'s finishCleanse posts an Apply (GM) card; the count is unchanged', async () => {
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: true } });
    const mine = ownedBy(who({ name: 'Player PC' }), 'p1');
    const flags: any = { sr2e: { backgroundCount: 6, backgroundSources: '' } };
    const scene: any = { id: 'S1', name: 'Hot zone', tokens: [{ actor: mine }], getFlag: (_s: string, k: string) => flags.sr2e[k], setFlag: async (_s: string, k: string, v: any) => { flags.sr2e[k] = v; } };
    g.game.scenes = { get: (id: string) => (id === 'S1' ? scene : null) };
    mine.flags.sr2e = { projects: { p4: forgedProject('p4', 'finishCleanse', ['S1', 30, []]) } };
    g.game.actors = [mine];
    await SR2Actor.timedEffects({ worldTime: 40 });
    assert.equal(flags.sr2e.backgroundCount, 6);
    // Round 2 (V-DOC 10): bounded at the real maximum background count (20), as the Apply card's own check is.
    assert.deepEqual(chat.find((m: any) => m.flags?.sr2e?.cleanse)?.flags.sr2e.cleanse, { sceneId: 'S1', points: 20, align: [], sourceUuid: mine.uuid });
  });

  test('D3-6: on the GM\'s clock, a player\'s project can\'t card a refund to someone its players don\'t own', async () => {
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: true } });
    const mine = ownedBy(who({ name: 'Player PC' }), 'p1');
    const other = ownedBy(who({ name: 'Other' }), 'p2');
    assert.equal(await mine.refundModPayer(other.uuid, 10_000_000, 'x'), false);
    assert.ok(!chat.some((m: any) => m.flags?.sr2e?.actorUpdate));
  });

  test('D1-12: a project can\'t write flags.core as a nested object', async () => {
    const a = who({ name: 'A' });
    a.flags.sr2e = { projects: { p: { id: 'p', kind: 'x', area: 'magic', label: 'x', startedAt: 0, readyAt: 0, hours: 0, paid: { karma: 0, nuyen: 0 }, effect: { actor: [['flags', { core: { sheetClass: 'evil' } }]] } } } };
    await a.finishProject('p');
    assert.equal(a.flags.core, undefined);
  });
});

describe('D3-4: handing a spirit to nobody', () => {
  test('D3 P2 inverted: "free again" clears the summoner', async () => {
    const binder = who({ name: 'Binder' });
    const sp = who({ name: 'Free one', type: 'spirit', spiritKind: 'free', summonerUuid: binder.uuid, services: 3 });
    await SR2Actor.handSpirit(sp, null, 0, binder.uuid, 'free again');
    assert.equal(sp.system.summonerUuid, '');
  });
});

// =============================================================================== possession, timers, tallies, hosts
describe('D3-5 / SEC1-7: possession takes the possessor\'s own mind, never the card\'s', () => {
  test('a card\'s Willpower 99 / skills are ignored; the possessor\'s attributes are stored', async () => {
    const mage = who({ name: 'Mage' });
    const npc = who({ name: 'Guard', type: 'npc' });
    mage.flags.sr2e = { possessing: { uuid: npc.uuid, name: 'Guard' } };
    assert.ok(await SR2Actor.setPossession(npc.uuid, { uuid: mage.uuid, name: 'Friendly spirit', attributes: { willpower: 99, intelligence: -20 }, skills: [] }));
    const by = npc.flags.sr2e.possessedBy;
    assert.equal(by.name, 'Mage');
    assert.equal(by.attributes.willpower, mage.system.attributes.willpower.total);
  });

  test('a possessor not possessing that body is refused', async () => {
    const mage = who({ name: 'Mage' });
    const npc = who({ name: 'Guard', type: 'npc' });
    assert.equal(await SR2Actor.setPossession(npc.uuid, { uuid: mage.uuid, name: 'x', attributes: {} }), false);
    assert.equal(npc.flags?.sr2e?.possessedBy, undefined);
  });
});

describe('SEC1-8: the GM\'s clock makes only the caster\'s own spell effect permanent', () => {
  test('a sustaining entry naming another caster\'s effect id leaves it untouched; its own spell takes', async () => {
    const p1 = who({ name: 'P1 mage' });
    const p2 = who({ name: 'P2' });
    p2.flags.sr2e = { powerEffects: [
      { id: 'curse', name: 'GM curse', kind: 'spell', fromUuid: 'Actor.gm-npc', fromName: 'NPC', attributes: { body: -2 }, successes: 2 },
      { id: 'mine', name: 'Heal-ish', kind: 'spell', fromUuid: p1.uuid, fromName: 'P1 mage', attributes: { body: 1 }, successes: 2 },
    ] };
    p1.system.sustaining = [
      { spellName: 'x', effectId: 'curse', permanentAt: 0, targetUuids: [p2.uuid], force: 1, successes: 1 },
      { spellName: 'y', effectId: 'mine', permanentAt: 0, targetUuids: [p2.uuid], force: 1, successes: 1 },
    ];
    g.game.actors = [p1, p2];
    await SR2Actor.magicTicks({ worldTime: 10 });
    const fx = p2.flags.sr2e.powerEffects;
    assert.notEqual(fx.find((e: any) => e.id === 'curse').permanent, true);
    assert.equal(fx.find((e: any) => e.id === 'mine').permanent, true);
  });
});

describe('D3-7: a tally card\'s owner is the decker its key names, checked against its source', () => {
  const host = () => { const h = who({ name: 'Corp host', type: 'host' }); h.system.sheaf = []; h.system.tallies = []; h.system.tally = 0; return h; };
  test('the name comes from the actor the key names, not the card', async () => {
    await withRule(RULES.MATRIX_V57.tally, 'perDecker', true, async () => {
      const h = host();
      const decker = who({ name: 'Real Decker' });
      await SR2Actor.applyTallyCard(h.uuid, 3, { key: decker.uuid, name: 'Alice' });
      assert.equal(h.system.tallies[0]?.name, 'Real Decker');
    });
  });
  test('a key that isn\'t the source\'s own tally is refused; a key that names nobody too', async () => {
    await withRule(RULES.MATRIX_V57.tally, 'perDecker', true, async () => {
      const h = host();
      g.game.users = usersAll();
      // Round 2 (V-DOC 11): a source no player owns (IC) is accepted for any key; a player's character is held to its own.
      const mine = ownedBy(who({ name: 'Mine' }), 'p1');
      const theirs = ownedBy(who({ name: 'Theirs' }), 'p2');
      assert.equal(await SR2Actor.applyTallyCard(h.uuid, 3, { key: theirs.uuid, name: 'x' }, mine.uuid), null);
      assert.equal(await SR2Actor.applyTallyCard(h.uuid, 3, { key: 'Actor.nobody', name: 'x' }), null);
      assert.equal(h.system.tallies.length, 0);
      assert.notEqual(await SR2Actor.applyTallyCard(h.uuid, 3, { key: mine.uuid, name: 'x' }, mine.uuid), null);
    });
  });
});

describe('D3-11 / RA2-2: a host change is shaped and written once', () => {
  const host = () => { const h = who({ name: 'Corp host', type: 'host' }); Object.assign(h.system, { files: [], alert: 'none', spotted: [], validated: [], bombs: [], calls: [] }); h.updates = 0; const up = h.update.bind(h); h.update = async (d: any) => { h.updates++; return up(d); }; return h; };
  test('forged smoke is rebuilt from its rating (its end from the clock now); an invalid alert is dropped; one update', async () => {
    const h = host();
    await SR2Actor.applyHostChange(h.uuid, { smoke: { rating: 1, tn: 2, round: 1e9, worldTime: 1e15, combatId: 'x', by: 'Me' } as any, setAlert: 'off', addFile: { name: 'Paydata', size: 1e9, value: 1e12, paydata: true, uploadedBy: '', foundBy: 'nope' as any } });
    assert.ok(Number(h.system.smoke.worldTime) < 1e6, 'the smoke ends by the rules, not the card');
    assert.equal(h.system.alert, 'none');
    assert.equal(h.system.files[0].value, 10_000_000);
    assert.deepEqual(h.system.files[0].foundBy, []);
    assert.equal(h.updates, 1);
  });
  test('found without ids no longer throws', async () => {
    const h = host();
    h.system.files = [{ id: 'f1', name: 'F', foundBy: [] }];
    assert.ok(await SR2Actor.applyHostChange(h.uuid, { found: { deckerUuid: 'Actor.x' } as any }));
  });
});

describe('SEC1-16: a stored charge is bounded by its explosive item, or is nothing', () => {
  test('round 3 (V2 #2, V2-charge inverted): a record with no explosive item is refused; a non-explosive item too', () => {
    const a = ownedBy(who({ name: 'Mundane' }, [{ id: 'rock', type: 'gear', name: 'Rock', system: { quantity: 1 } }]), 'p1');
    a.flags.sr2e = { setCharges: [{ id: 'forged', itemId: 'never-existed', successes: 50, name: 'C-12', power: 200, perMetre: 0.25, shaped: false }, { id: 'c2', itemId: 'rock', name: 'Rock', power: 50, perMetre: 1, shaped: false }] };
    assert.equal(SR2Actor.storedCharge(a, 'forged'), null);
    assert.equal(SR2Actor.storedCharge(a, 'c2'), null);
  });

  test('round 3 (FIX3-BRIEF 2, H5): only a GM gets the item-less record back, bounded, with the confirm text', () => {
    const a = who({ name: 'Sapper' });
    a.flags.sr2e = { setCharges: [{ id: 'c1', itemId: 'gone', name: 'C4', power: 999, perMetre: 0.01, shaped: false }] };
    g.game.user = P1();
    assert.equal(SR2Actor.chargeRecordForGm(a, 'c1'), null);
    g.game.user = GM();
    const r = SR2Actor.chargeRecordForGm(a, 'c1');
    assert.equal(r?.charge.power, 200);
    assert.equal(r?.charge.perMetre, 0.25);
    assert.match(r?.text ?? '', /recorded Power 200/);
    assert.equal(SR2Actor.chargeRecordForGm(a, 'nope'), null);
  });
});

// =============================================================================== spell defense (D2-1, D3-2, SEC1-12)
describe('spell defense: spent first, and only a covering protector', () => {
  const state = (caster: any) => ({ spellName: 'Manabolt', force: 4, noun: 'spell', level: 'M', damageType: 'physical', resistAttribute: 'willpower', casterSuccesses: 2, casterUuid: caster.uuid, targetUuid: '' });

  test('an enemy\'s held dice are not offered: not counted, not spent', async () => {
    g.game.users = usersAll();
    g.game.user = P1();
    const me = ownedBy(who({ name: 'Me' }), 'p1');
    const enemy = ownedBy(who({ name: 'Enemy mage', spellDefense: 6 }));
    faces.push(...Array(20).fill(1));
    await me.resistSpell({ ...state(enemy), targetUuid: me.uuid } as any, 0, { protectorUuid: enemy.uuid });
    assert.equal(enemy.system.spellDefense, 6);
    assert.doesNotMatch(chat.at(-1).content, /spell defense from/);
  });

  test('an own protector is spent before the roll, and its dice count once', async () => {
    const me = ownedBy(who({ name: 'Me', spellDefense: 2 }), 'p1');
    const caster = who({ name: 'Caster' });
    faces.push(...Array(20).fill(1));
    await me.resistSpell({ ...state(caster), targetUuid: me.uuid } as any, 0);
    assert.equal(me.system.spellDefense, 0);
    assert.match(chat.at(-1).content, /\+ 2 spell defense/);
  });

  test('the holder\'s covering link lets an ally\'s protector cover (SEC1-12: no combat needed)', () => {
    const me = ownedBy(who({ name: 'Me' }), 'p1');
    const ally = ownedBy(who({ name: 'Ally mage', spellDefense: 3 }), 'p2');
    assert.match(SR2Actor.spellDefenseCoverProblem(ally, me, P1()), /isn't covering/);
    ally.flags.sr2e = { spellDefenseCovers: [me.uuid] };
    assert.equal(SR2Actor.spellDefenseCoverProblem(ally, me, P1()), '');
    assert.equal(SR2Actor.spellDefenseCoverProblem(ally, me, P2()), '', 'its own owner');
  });
});

// =============================================================================== toxins, spirits, flashes, timers
describe('D2-2: a disease from a card is bounded where every route meets', () => {
  test('D2 P1 input: recoveries 1e9 and interval 0 are clamped', async () => {
    const p2 = who({ name: 'P2' });
    faces.push(...Array(30).fill(1));
    await p2.resistToxin({ kind: 'disease', name: 'Forged plague', power: 6, level: 'S', damageType: 'physical', vector: 'contact', recoveries: 1e9, intervalHours: 0, incubationHours: 0, contagious: 'airborne' } as any);
    const d = chat.find((m: any) => m.flags?.sr2e?.test?.disease)?.flags.sr2e.test.disease;
    assert.ok(d);
    assert.ok(d.needed <= 30);
    assert.ok(d.intervalHours >= 1);
    assert.equal(d.contagious, 'airborne');
  });
  test('an unknown contagion and a huge Power are dropped and clamped', async () => {
    const p2 = who({ name: 'P2' });
    faces.push(...Array(30).fill(1));
    await p2.resistToxin({ kind: 'disease', name: 'X', power: 1e6, level: '<b>', damageType: 'physical', vector: 'contact', contagious: '<img>' } as any);
    const d = chat.find((m: any) => m.flags?.sr2e?.test?.disease)?.flags.sr2e.test.disease;
    assert.equal(d.power, 60);
    assert.equal(d.level, 'L');
    assert.equal(d.contagious, undefined);
  });
});

describe('D2-3 / round 2 (V-DOC 4, 8): a summoning re-rolled after the GM created its spirit', () => {
  const setup = (services: number, authorOfStamp: any) => {
    g.game.user = { ...P1(), can: () => false };
    g.game.users = usersAll();
    const mage = ownedBy(who({ name: 'Mage', karma: { pool: 5, poolSpent: 0, good: 0, career: 0 } }), 'p1');
    const spirit = ownedBy(who({ name: 'Fire spirit', type: 'spirit', force: 4, services, summonerUuid: mage.uuid }), 'p1');
    const first = asMessage({ author: authorOfStamp, flags: { sr2e: { test: { testId: 'T1' }, pendingSpirit: { name: 'Fire spirit', type: 'spirit', system: { services: 1 } }, spiritCreated: spirit.uuid } } });
    g.game.messages = { contents: [first] };
    const snap: any = { actorUuid: mage.uuid, kind: 'conjure', label: 'Summon', rerolls: 0, testId: 'T1', baseTargetNumber: 4, targetNumber: 4, modifiers: [],
      dice: [...dice(3), ...dice(1, 1)], successes: 3, botch: false, conjure: { force: 4, spiritKind: 'elemental', spiritType: 'Fire', templateUuid: null, spiritUuid: null } };
    return { mage, spirit, snap };
  };

  test('a player\'s re-roll: no second Create spirit; the services change goes to an Apply (GM) card', async () => {
    const { mage, spirit, snap } = setup(1, GM());
    faces.push(5);
    await mage.karmaReroll(snap);
    const card = chat.find((m: any) => m.flags?.sr2e?.test);
    assert.equal(card.flags.sr2e.pendingSpirit, undefined, 'no second Create spirit');
    assert.equal(card.flags.sr2e.test.conjure.spiritUuid, spirit.uuid);
    assert.equal(spirit.system.services, 1, 'not written by the player\'s client');
    assert.ok(chat.some((m: any) => m.flags?.sr2e?.actorUpdate?.handSpirit), 'a GM card for the services');
  });

  test('VD-5 inverted: services used since the spirit was created are not given back', async () => {
    const { mage, spirit, snap } = setup(0, GM());
    g.game.user = GM();
    const msg = cardBy(GM(), snap);
    g.game.messages.contents.push(msg);
    await SR2Actor.retarget(msg, { baseTargetNumber: 4, modifiers: [] });
    assert.equal(spirit.system.services, 0);
    assert.match(chat.at(-1).content, /changed since it was created/);
    void mage;
  });

  test('round 3 (V2 #3, V2-spirit inverted): the real flow: the GM\'s Create spirit stamps the player\'s own card', async () => {
    const { mage, spirit, snap } = setup(1, P1());
    faces.push(5);
    await mage.karmaReroll(snap);
    const card = chat.find((m: any) => m.flags?.sr2e?.test);
    assert.equal(card.flags.sr2e.pendingSpirit, undefined, 'no second Create spirit');
    assert.equal(card.flags.sr2e.test.conjure.spiritUuid, spirit.uuid);
    assert.equal(spirit.system.services, 1, 'the change goes to the GM');
    assert.ok(chat.some((m: any) => m.flags?.sr2e?.actorUpdate?.handSpirit));
  });

  test('V-DOC 8: a stamp on a card by someone who doesn\'t own the summoner is not trusted', async () => {
    const { mage, spirit, snap } = setup(1, P2());
    faces.push(5);
    await mage.karmaReroll(snap);
    assert.ok(chat.find((m: any) => m.flags?.sr2e?.test)?.flags.sr2e.pendingSpirit, 'the stamp is ignored');
    assert.equal(spirit.system.services, 1);
  });
});

describe('D2-5: a player\'s flash on someone they don\'t own goes to the GM', () => {
  test('applyTimedStatusAsGm: only blindness, bounded', async () => {
    const npc = who({ name: 'Guard', type: 'npc' });
    const set: any[] = [];
    npc.setTimedStatus = async (id: string, s: number) => { set.push([id, s]); };
    assert.equal(await SR2Actor.applyTimedStatusAsGm({ targetUuid: npc.uuid, status: 'dead', seconds: 30 }), false);
    assert.ok(await SR2Actor.applyTimedStatusAsGm({ targetUuid: npc.uuid, status: 'blind', seconds: 1e9, flashTn: 99 }));
    assert.deepEqual(set, [['blind', 600]]);
    assert.equal(npc.flags.sr2e.flashTn, 10);
  });
});

describe('D2-7 / RA2-3: burning follows the combat whose round ticked', () => {
  test('a fire caught in fight B isn\'t re-stamped by fight A\'s round', async () => {
    await withRule(RULES.COMBAT.burning, 'enabled', true, async () => {
      const a = who({ name: 'Torch' });
      a.flags.sr2e = { onFire: { combatId: 'B', round: 1 } };
      const A = { id: 'A', started: true, round: 3, combatants: [{ actor: a }] };
      const B = { id: 'B', started: true, round: 1, combatants: [{ actor: a }] };
      g.game.combat = A;
      g.game.combats = { get: (id: string) => (id === 'A' ? A : id === 'B' ? B : undefined) };
      try {
        await SR2Actor.burningTick(a, 3, 'A');
        assert.deepEqual(a.flags.sr2e.onFire, { combatId: 'B', round: 1 }, 'left for fight B');
      } finally { delete g.game.combats; }
    });
  });
});

describe('D2-8: one actor\'s error doesn\'t stop the others\' timers', () => {
  test('a throwing actor is logged and the next one still ticks', async () => {
    const bad = who({ name: 'Broken' });
    bad.endDrug = async () => { throw new Error('scene gone'); };
    bad.system.drugs = [{ name: 'x', round: -1, worldTime: 0 }];
    const good = who({ name: 'Fine', training: [{ id: 't', label: 'x', attribute: '', skillId: 'gone', part: 'rating', to: 2, cost: 2, readyAt: 0 }] });
    g.game.actors = [bad, good];
    const err = console.error; console.error = () => {};
    try { await SR2Actor.timedEffects({ worldTime: 10 }); } finally { console.error = err; }
    assert.equal(good.system.training.length, 0, 'the second actor\'s training still finished');
  });
});

describe('RA2-4: a chase position is stamped with its combat', () => {
  test('the position carries the combat id', async () => {
    await withRule(RULES.VEHICLES_V57.maneuver, 'mode', 'score', async () => {
      const p = vehicle({ name: 'Pursuer' });
      const q = vehicle({ name: 'Quarry' });
      p.system.chase = { quarryUuid: q.uuid, metres: 50 };
      p.driveTest = async () => ({ successes: 6 });
      q.driveTest = async () => ({ successes: 0 });
      g.game.combat = { id: 'cA', started: true, round: 2, combatants: [] };
      await p.chaseTurn();
      assert.equal(p.system.position.combatId, 'cA');
    });
  });
});

// =============================================================================== smaller fixes
describe('D1-4: a guard who can\'t perceive spots nobody', () => {
  test('D1 P4 inverted: an unconscious guard doesn\'t notice the sneaker', async () => {
    await withRule(RULES.CONDITIONS, 'blockActions', true, async () => {
      const sneaker = who({ name: 'Sneak' });
      const guard = who({ name: 'Guard', type: 'npc', monitor: { physical: 0, stun: 10 } });
      faces.push(...Array(8).fill(1), ...Array(30).fill(5));
      const out = await sneaker.sneakPast([guard.uuid]);
      assert.equal(out[0]?.noticed, false);
      assert.equal(await guard.perceive(sneaker.uuid), null);
    });
  });
});

describe('D1-5 (contract for chat.ts onHaggle): haggle returns a price only when it posted a card', () => {
  test('an exclusive spell: null, no card', async () => {
    await withRule(RULES.MAGIC_V61.exclusive, 'blocksAllTests', true, async () => {
      const a = who({ name: 'Mage', sustaining: [{ spellName: 'Trance', force: 4, exclusive: true }] });
      assert.equal(await a.haggle({ itemId: 'x', price: 100, name: 'Gun' }), null);
      assert.equal(chat.length, 0);
    });
  });
});

describe('D1-10: an inline resistance roll isn\'t blocked by an exclusive spell', () => {
  test('rollAttribute with resist: true rolls', async () => {
    await withRule(RULES.MAGIC_V61.exclusive, 'blocksAllTests', true, async () => {
      const a = who({ name: 'Mage', sustaining: [{ spellName: 'Trance', force: 4, exclusive: true }] });
      assert.equal(await a.rollAttribute('willpower', { targetNumber: 4 }), null);
      faces.push(...Array(10).fill(5));
      assert.ok(await a.rollAttribute('willpower', { targetNumber: 4, resist: true }));
    });
  });
});

describe('SEC2b-2 / design 4: numbers from a snapshot are numbers on the card', () => {
  test('a forged casterSuccesses carrying markup prints as 0, and the word fields lose their markup', async () => {
    g.game.users = usersAll();
    const mine = ownedBy(who({ name: 'Mine' }), 'p1');
    const snap: any = {
      actorUuid: mine.uuid, kind: 'soak', label: 'Resist', rerolls: 0, testId: 'tS2', baseTargetNumber: 4, targetNumber: 4, modifiers: [],
      dice: dice(2, 1), successes: 0, botch: false,
      soak: { mode: 'spell', level: 'M', type: 'stun"><button data-sr2e-action="gmApply">', noun: 'damage', body: 4, before: { physical: 0, stun: 0 }, spellName: 'Bolt', casterSuccesses: '<button type="button" data-sr2e-action="applyHeal">Apply</button>' },
    };
    const msg = cardBy(P1(), snap);
    g.game.messages = { contents: [msg] };
    const posted = await SR2Actor.retarget(msg, { baseTargetNumber: 4, modifiers: [] });
    assert.doesNotMatch(posted.content, /data-sr2e-action="applyHeal"|data-sr2e-action="gmApply"/);
  });
});

describe('design 5: a card is replaced only by its own author\'s or a GM\'s', () => {
  test('another player\'s card with the same testId doesn\'t replace it', () => {
    g.game.users = usersAll();
    const real = asMessage({ author: GM(), flags: { sr2e: { test: { testId: 'tZ' } } } });
    const forgedCard = asMessage({ author: P1(), flags: { sr2e: { test: { testId: 'tZ' } } } });
    g.game.messages = { contents: [real, forgedCard] };
    assert.equal(SR2Actor.isReplaced(real), false);
    const reroll = asMessage({ author: GM(), flags: { sr2e: { test: { testId: 'tZ' } } } });
    g.game.messages = { contents: [real, forgedCard, reroll] };
    assert.equal(SR2Actor.isReplaced(real), true);
    const p1first = asMessage({ author: P1(), flags: { sr2e: { test: { testId: 'tY' } } } });
    const p1again = asMessage({ author: P1(), flags: { sr2e: { test: { testId: 'tY' } } } });
    g.game.messages = { contents: [p1first, p1again] };
    assert.equal(SR2Actor.isReplaced(p1first), true, 'a Karma re-roll by the same author still replaces');
  });
});

// =============================================================================== round 2 (FIX2-BRIEF A, G, H)
describe('round 2 A1 (V-SEC 1): runAsAuthor is serialized on the GM lock', () => {
  test('V-SEC P1 inverted: two overlapping re-runs each see only their own author; none is left behind', async () => {
    g.game.users = usersAll();
    const seen: any[] = [];
    let releaseA: any;
    const started = new Promise<void>((ok) => { (globalThis as any).__started = ok; });
    const a = SR2Actor.runAsAuthor(P1(), () => new Promise<void>((r) => { releaseA = r; (globalThis as any).__started(); }));
    const b = SR2Actor.runAsAuthor(P2(), async () => { seen.push(['B', SR2Actor.actingAuthor?.id ?? null]); });
    await started;
    seen.push(['during A', SR2Actor.actingAuthor?.id ?? null]);
    releaseA(); await a; await b;
    seen.push(['after both', SR2Actor.actingAuthor?.id ?? null]);
    assert.deepEqual(seen, [['during A', 'p1'], ['B', 'p2'], ['after both', null]]);
  });

  test('a throw restores; a second call for the same author while one awaits is queued, never inline (lead, after round 2)', async () => {
    await assert.rejects(SR2Actor.runAsAuthor(P1(), async () => { throw new Error('x'); }));
    assert.equal(SR2Actor.actingAuthor, null);
    // V-SEC 1 by the same player: run inline, B's tail ran with GM rights once A cleared the acting author.
    const seen: any[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    const a = SR2Actor.runAsAuthor(P1(), async () => { await gate; seen.push(['A done', SR2Actor.actingAuthor?.id ?? null]); });
    const b = SR2Actor.runAsAuthor(P1(), async () => { seen.push(['B start', SR2Actor.actingAuthor?.id ?? null]); await Promise.resolve(); seen.push(['B end', SR2Actor.actingAuthor?.id ?? null]); });
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(seen, [], 'B waits for A');
    release(); await a; await b;
    assert.deepEqual(seen, [['A done', 'p1'], ['B start', 'p1'], ['B end', 'p1']]);
    assert.equal(SR2Actor.actingAuthor, null);
  });

  test('a GM card re-run while a player\'s re-run awaits waits too (it is not judged as the player)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    const a = SR2Actor.runAsAuthor(P1(), async () => { await gate; });
    let during: any = 'not run';
    const b = SR2Actor.runAsAuthor(GM(), async () => { during = SR2Actor.actingAuthor; });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(during, 'not run');
    release(); await a; await b;
    assert.equal(during, null);
  });

  test('VD-7 inverted: a GM Apply that takes the lock waits for the re-run, then runs with the GM\'s rights', async () => {
    const { withGmLock } = await import('../applications/gmlock.ts');
    g.game.users = usersAll();
    const t = ownedBy(who({ name: 'Guard' }));
    t.setTimedStatus = async () => {};
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    const rerun = SR2Actor.runAsAuthor(P1(), async () => { await gate; });
    const apply = withGmLock(() => SR2Actor.applyTimedStatusAsGm({ targetUuid: t.uuid, status: 'blind', seconds: 9, flashTn: 0 }));
    release(); await rerun;
    assert.equal(await apply, true);
  });

  test('the GM ticks run under the lock too (never inside a player\'s re-run)', async () => {
    const { serialTicks } = await import('../documents/index.ts');
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    const rerun = SR2Actor.runAsAuthor(P1(), async () => { await gate; });
    let during: any = 'not run';
    const tick = serialTicks(async () => { during = SR2Actor.actingAuthor; });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(during, 'not run', 'queued behind the re-run');
    release(); await rerun; await tick;
    assert.equal(during, null);
  });
});

describe('round 2 A4: a cancelled write is never silent', () => {
  test('the guard warns the GM, naming the document and the player', async () => {
    const hooks: Record<string, Function[]> = {};
    const prevOn = g.Hooks.on;
    g.Hooks.on = (n: string, f: Function) => { (hooks[n] ??= []).push(f); };
    const { registerActingAuthorHooks } = await import('../documents/index.ts');
    registerActingAuthorHooks();
    g.Hooks.on = prevOn;
    g.game.users = usersAll();
    const npc = ownedBy(who({ name: 'Boss NPC' }));
    let res: any[] = [];
    await SR2Actor.runAsAuthor(P1(), async () => { res = (hooks['preUpdateActor'] ?? []).map((f) => f(npc, {}, {}, 'gm1')); });
    assert.ok(res.includes(false));
    assert.match(warnings.at(-1) ?? '', /Not changed: Boss NPC isn't Player One's/);
  });
});

describe('round 2 A5: rule gates follow the real GM, not the acting author', () => {
  test('a GM\'s re-run may still override the action economy (block mode)', async () => {
    await withRule(RULES.ACTIONS, 'enforce', 'block', async () => {
      const a = ownedBy(who({ name: 'Mage' }), 'p1');
      a.currentPhaseKey = () => 'p';
      a.isActing = () => true;
      a.actionsUsed = () => ({ simple: 2, complex: 1, free: 9 });
      const ok = await SR2Actor.runAsAuthor(P1(), () => a.useAction('complex', 'Use again'));
      assert.notEqual(ok, false);
      g.game.user = P1();
      assert.equal(await a.useAction('complex', 'Use again'), false, 'control: a player is blocked');
    });
  });
});

describe('round 2 A7 (V-DOC 14): the spell-defense relay spends once per protector, and really spends', () => {
  test('two quick spends: the second sees what is left; inside a re-run the dice leave the protector', async () => {
    const { registerCombatRelay, registerActingAuthorHooks } = await import('../documents/index.ts');
    const { requestGm } = await import('../applications/socket.ts');
    registerCombatRelay();
    // Round 3 (FIX3-BRIEF 12): the write goes through the real acting-author guard, and takes time (a server round
    // trip), so two unserialized spends would both read 4, and an unmarked write inside the re-run would be cancelled.
    const hooks: Record<string, Function[]> = {};
    const prevOn = g.Hooks.on;
    g.Hooks.on = (n: string, f: Function) => { (hooks[n] ??= []).push(f); };
    registerActingAuthorHooks();
    g.Hooks.on = prevOn;
    g.game.users = usersAll();
    g.game.users.activeGM = { id: 'gm1', isSelf: true };
    const target = ownedBy(who({ name: 'Me' }), 'p1');
    const protector = ownedBy(who({ name: 'Ally', spellDefense: 4 }), 'p2');
    protector.flags.sr2e = { spellDefenseCovers: [target.uuid] };
    protector.update = async (d: any, o: any = {}) => {
      await new Promise((r) => setTimeout(r, 5));
      if ((hooks['preUpdateActor'] ?? []).some((f) => f(protector, d, o, 'gm1') === false)) return undefined;
      for (const [k, v] of Object.entries(d)) setPath(protector, k, v);
      return protector;
    };
    const req = () => requestGm('spendSpellDefense', { protectorUuid: protector.uuid, targetUuid: target.uuid, amount: 4 });
    const [r1, r2] = await SR2Actor.runAsAuthor(P1(), () => Promise.all([req(), req()]));
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, false);
    assert.equal(protector.system.spellDefense, 0);
  });
});

describe('round 2 G (V-SEC 6, 7): contests', () => {
  test('V-SEC P4 inverted: the other side\'s owner\'s Karma card replaces the older card', () => {
    g.game.users = usersAll();
    const a = ownedBy(who({ name: 'A' }), 'p1');
    const b = ownedBy(who({ name: 'B' }), 'p2');
    const contest = { id: 'c1', kind: 'social', sides: [{ uuid: a.uuid, name: 'A', result: { successes: 1, dice: [] } }, { uuid: b.uuid, name: 'B', result: { successes: 1, dice: [] } }] };
    const m1 = asMessage({ author: P1(), flags: { sr2e: { contest } } });
    const m2 = asMessage({ author: P2(), flags: { sr2e: { contest: { ...contest } } } });
    const m3 = asMessage({ author: { id: 'p3', isGM: false }, flags: { sr2e: { contest: { ...contest } } } });
    g.game.messages = { contents: [m1, m3] };
    assert.equal(SR2Actor.isReplaced(m1), false, 'a stranger\'s copy doesn\'t');
    g.game.messages = { contents: [m1, m2] };
    assert.equal(SR2Actor.isReplaced(m1), true);
  });

  test('a GM spending Karma on a player\'s contest card posts the new card as the player\'s', async () => {
    await withRule(RULES.FIXES_V71, 'contestKarma', true, async () => {
      g.game.users = usersAll();
      const npc = ownedBy(who({ name: 'Guard', karma: { pool: 5, poolSpent: 0, good: 0, career: 0 } }));
      const contest = { id: 'c2', kind: 'sneak', sides: [{ uuid: 'Actor.x', name: 'Sneak', result: { successes: 2, dice: dice(2), targetNumber: 4, baseTargetNumber: 4, modifiers: [], totalDice: 2, botch: false } }, { uuid: npc.uuid, name: 'Guard', result: { successes: 0, dice: [...dice(1, 1), ...dice(1, 1)], targetNumber: 4, baseTargetNumber: 4, modifiers: [], totalDice: 2, botch: false } }] };
      const m = asMessage({ author: P1(), speaker: {}, flags: { sr2e: { contest } } });
      g.game.messages = { contents: [m] };
      faces.push(5, 5);
      const posted = await SR2Actor.contestKarma(m, 1, 'reroll');
      assert.equal(posted?.author, 'p1');
    });
  });
});

describe('round 2 H1 (V-DOC 1): the snapshot cleaner keeps word text in number keys', () => {
  test('VD-1 / VD-1b inverted: a toxin\'s speed id survives a retarget; markup in a number key is cut to its words', async () => {
    const mine = ownedBy(who({ name: 'Mine' }), 'p1');
    const snap: any = {
      actorUuid: mine.uuid, kind: 'skill', label: 'Resist', rerolls: 0, testId: 'tVD1', baseTargetNumber: 4, targetNumber: 4, modifiers: [],
      dice: dice(3), successes: 3, botch: false,
      blast: { toxin: { name: 'Narcoject', vector: 'injection', power: 6, level: 'S', damageType: 'stun', speed: 'hour', from: 'Dart', needsWound: false } },
      extra: { toxinHit: { name: 'Neuro', speed: 'minute', power: '6', level: 'M', damageType: 'physical' }, hours: '<button>' },
    };
    const msg = cardBy(GM(), snap);
    g.game.messages = { contents: [msg] };
    const t = (await SR2Actor.retarget(msg, { baseTargetNumber: 4, modifiers: [] })).flags.sr2e.test;
    assert.equal(t.blast.toxin.speed, 'hour');
    assert.equal(t.extra.toxinHit.speed, 'minute');
    assert.equal(t.extra.toxinHit.power, 6);
    assert.equal(t.extra.hours, 'button');
  });
});

describe('round 2 H2 (V-DOC 2): spell defense covers allies however they are found', () => {
  test('VD-3 inverted: both in a running combat the GM isn\'t viewing', () => {
    g.game.users = usersAll();
    const me = ownedBy(who({ name: 'Me' }), 'p1');
    const ally = ownedBy(who({ name: 'Ally mage', spellDefense: 3 }), 'p2');
    me.getActiveTokens = () => []; ally.getActiveTokens = () => [];
    g.game.combats = [{ started: true, combatants: [{ actor: me }, { actor: ally }] }];
    try { assert.equal(SR2Actor.spellDefenseCoverProblem(ally, me, P1()), ''); } finally { delete g.game.combats; }
  });

  test('VD-3b inverted: the same scene with the default (hostile) dispositions counts (NPC allies)', () => {
    g.game.users = usersAll();
    const me = ownedBy(who({ name: 'Me' }), 'p1');
    const ally = ownedBy(who({ name: 'Ally mage', spellDefense: 3 }), 'p2');
    const sc = { id: 'S1' };
    me.getActiveTokens = () => [{ parent: sc, disposition: -1 }]; ally.getActiveTokens = () => [{ parent: sc, disposition: -1 }];
    assert.equal(SR2Actor.spellDefenseCoverProblem(ally, me, P1()), '');
  });

  test('the token route on any scene (not this canvas), and an enemy on it never covers, even in the same fight', () => {
    g.game.users = usersAll();
    const me = ownedBy(who({ name: 'Me' }), 'p1');
    const ally = ownedBy(who({ name: 'Ally' }), 'p2');
    const foe = ownedBy(who({ name: 'Foe' }));
    const sc: any = { id: 'S2' };
    sc.tokens = [{ actorId: me.id, actorLink: true, disposition: 1, parent: sc }, { actorId: ally.id, actorLink: true, disposition: 1, parent: sc }, { actorId: foe.id, actorLink: true, disposition: -1, parent: sc }];
    g.game.scenes = [sc];
    g.game.combats = [{ started: true, combatants: [{ actor: me }, { actor: foe }] }];
    try {
      assert.equal(SR2Actor.spellDefenseCoverProblem(ally, me, P1()), '');
      assert.match(SR2Actor.spellDefenseCoverProblem(foe, me, P1()), /other side/);
    } finally { delete g.game.combats; delete g.game.scenes; }
  });

  test('a player who owns both the protector and the character', () => {
    g.game.users = usersAll();
    const me = ownedBy(who({ name: 'Me' }), 'p1', 'p2');
    const mine2 = ownedBy(who({ name: 'My other' }), 'p2');
    assert.equal(SR2Actor.spellDefenseCoverProblem(mine2, me, P1()), '');
  });
});

describe('round 2 H3 (V-DOC 3, 13): vehicle-job money moves at most once', () => {
  /** A finished project on the party's GM van: the clock posts the Apply (GM) card; its `vehicleJob` flag. */
  const jobCard = async (mech: any, id: string, method: string, args: any[]) => {
    mech.flags.sr2e = { ...(mech.flags.sr2e ?? {}), projects: { [id]: { id, kind: 'install', label: 'Work', hours: 1, startedAt: 0, readyAt: 0, paid: { karma: 0, nuyen: 0 }, effect: { call: { method, args } } } } };
    await mech.finishProject(id);
    return chat.filter((m: any) => m.flags?.sr2e?.vehicleJob).at(-1).flags.sr2e.vehicleJob;
  };

  test('VD-2 inverted: a job whose mod is gone refunds once', async () => {
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: true } });
    const mech = ownedBy(who({ name: 'Mech', nuyen: 0 }), 'p1');
    const van = ownedBy(vehicle({ name: 'Party van', mods: [] }));
    const job = await jobCard(mech, 'pj1', 'finishModInstall', [van.uuid, 0, null, 'Armor', 500, mech.uuid]);
    assert.equal(await SR2Actor.applyVehicleJobAsGm(job), 'refunded');
    assert.equal(await SR2Actor.applyVehicleJobAsGm(job), false);
    assert.equal(mech.system.nuyen, 500);
  });

  test('round 3 (V2 #4, V2-vj inverted): two separate identical repairs both apply; each card only once; a card with no job id is refused', async () => {
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: true } });
    const mech = ownedBy(who({ name: 'Mech' }), 'p1');
    const van = ownedBy(vehicle({ name: 'Party van', condition: 2 }));
    const j1 = await jobCard(mech, 'r1', 'finishVehicleRepair', [van.uuid, 2, [], false]);
    assert.equal(await SR2Actor.applyVehicleJobAsGm(j1), true);
    assert.equal(van.system.condition, 0);
    van.system.condition = 2;
    const j2 = await jobCard(mech, 'r2', 'finishVehicleRepair', [van.uuid, 2, [], false]);
    assert.equal(await SR2Actor.applyVehicleJobAsGm(j2), true, warnings.join(' | '));
    assert.equal(van.system.condition, 0);
    assert.equal(await SR2Actor.applyVehicleJobAsGm(j2), false);
    assert.equal(await SR2Actor.applyVehicleJobAsGm({ actorUuid: mech.uuid, method: 'finishVehicleRepair', args: [van.uuid, 2, [], false] }), false);
  });

  test('V-DOC 13: the vehicle deleted mid-install: the up-front money goes back', async () => {
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: true } });
    const mech = ownedBy(who({ name: 'Mech', nuyen: 100 }), 'p1');
    mech.flags.sr2e = { projects: { pr: { id: 'pr', kind: 'install', label: 'Installing Armor', hours: 1, startedAt: 0, readyAt: 0, paid: { karma: 0, nuyen: 0 },
      effect: { call: { method: 'finishModInstall', args: ['Actor.gone-van', 0, null, 'Armor', 500, mech.uuid] } } } } };
    await mech.finishProject('pr');
    assert.equal(mech.system.nuyen, 600);
    assert.match(chat.at(-1).content, /given back/);
  });
});

describe('round 2 H6: smaller fixes', () => {
  test('V-DOC 7: a new sensor lock keeps the others\' combat ids', async () => {
    const v = vehicle({ name: 'Drone' });
    v.system.locks = [{ targetUuid: 'Actor.a', targetName: 'A', successes: 2, round: 3, worldTime: 9, combatId: 'C1' }];
    await SR2Actor.applySensorLock({ vehicleUuid: v.uuid, targetUuid: 'Actor.b', targetName: 'B', successes: 2 });
    assert.equal(v.system.locks.find((l: any) => l.targetUuid === 'Actor.a').combatId, 'C1');
  });

  test('V-DOC 9: a burning character not in the tracker burns on the round of the combat on their scene', async () => {
    await withRule(RULES.COMBAT.burning, 'enabled', true, async () => {
      const a = who({ name: 'Torch' });
      let burned = 0;
      a.resistHazard = async () => { burned++; };
      a.flags.sr2e = { onFire: { combatId: 'A', round: 1 } };
      const sc: any = { id: 'S1' };
      sc.tokens = [{ actorId: a.id, actorLink: true, disposition: 0, parent: sc }];
      g.game.scenes = [sc];
      const A = { id: 'A', started: true, round: 2, combatants: [], scene: sc };
      g.game.combats = { get: (id: string) => (id === 'A' ? A : undefined) };
      try { await SR2Actor.burningTick(a, 2, 'A'); } finally { delete g.game.combats; delete g.game.scenes; }
      assert.equal(burned, 1);
    });
  });

  test('V-DOC 12: a paralysed observer still perceives; an unconscious one doesn\'t', async () => {
    const watcher = who({ name: 'Frozen guard' });
    watcher.hasStatus = (s: string) => s === 'paralysis';
    faces.push(...Array(30).fill(5));
    assert.notEqual(await watcher.perceive(who({ name: 'Sneak' }).uuid), null);
  });

  test('V-DOC 11: an IC source (no player owns it) puts successes on the decker it engages', async () => {
    await withRule(RULES.MATRIX_V57.tally, 'perDecker', true, async () => {
      g.game.users = usersAll();
      const h = who({ name: 'Host', type: 'host' }); Object.assign(h.system, { sheaf: [], tallies: [], tally: 0 });
      const ic = ownedBy(who({ name: 'Probe IC', type: 'ic' }));
      const decker = ownedBy(who({ name: 'Decker' }), 'p1');
      assert.notEqual(await SR2Actor.applyTallyCard(h.uuid, 2, { key: decker.uuid, name: 'x' }, ic.uuid), null);
    });
  });
});

// =============================================================================== round 3 (FIX3-BRIEF 1, 9, 10, nits)
describe('round 3 item 1 (V2 #1): GM cards and the queue', () => {
  test('V2-rt inverted, through the real chat path: a GM card\'s Change TN waits for a player\'s re-run, then runs with the GM\'s rights', async () => {
    const { asCardAuthor } = await import('../applications/chat.ts');
    g.game.users = usersAll();
    const npc = ownedBy(who({ name: 'Guard' }));
    const snap: any = { actorUuid: npc.uuid, kind: 'skill', label: 'Perception', rerolls: 0, testId: 'tRT', baseTargetNumber: 4, targetNumber: 4, modifiers: [], dice: dice(3), successes: 3, botch: false };
    const msg = cardBy(GM(), snap);
    g.game.messages = { contents: [msg] };
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    let started!: () => void;
    const st = new Promise<void>((r) => { started = r; });
    const rerun = SR2Actor.runAsAuthor(P1(), async () => { started(); await gate; });
    await st;
    let acting: any = 'not run';
    const out = asCardAuthor(msg, 'Change target number', async () => { acting = SR2Actor.actingAuthor; return SR2Actor.retarget(msg, { baseTargetNumber: 5, modifiers: [] }); });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(acting, 'not run', 'it waits for the re-run');
    release(); await rerun;
    const posted = await out;
    assert.equal(acting, null, 'then runs with the GM\'s rights');
    assert.notEqual(posted, null, warnings.join(' | '));
  });

  test('retarget\'s own rule: a player\'s card while acting for another player is refused (try again)', async () => {
    g.game.users = usersAll();
    const mine = ownedBy(who({ name: 'Mine' }), 'p1');
    const snap: any = { actorUuid: mine.uuid, kind: 'skill', label: 'x', rerolls: 0, testId: 'tR3', baseTargetNumber: 4, targetNumber: 4, modifiers: [], dice: dice(2), successes: 2, botch: false };
    const msg = cardBy(P1(), snap);
    g.game.messages = { contents: [msg] };
    const out = await SR2Actor.runAsAuthor(P2(), () => SR2Actor.retarget(msg, { baseTargetNumber: 4, modifiers: [] }));
    assert.equal(out, null);
    assert.match(warnings.at(-1) ?? '', /try again/);
    const ok = await SR2Actor.runAsAuthor(P1(), () => SR2Actor.retarget(msg, { baseTargetNumber: 4, modifiers: [] }));
    assert.notEqual(ok, null, 'inline for the same player');
  });
});

describe('round 3 item 9 (V2 #10): two PCs cover each other whatever their dispositions', () => {
  test('V2-sd inverted: same fight, one token left hostile', () => {
    g.game.users = usersAll();
    const me = ownedBy(who({ name: 'Me' }), 'p1');
    const ally = ownedBy(who({ name: 'Ally mage', spellDefense: 3 }), 'p2');
    const sc: any = { id: 'S1' };
    sc.tokens = [{ actorId: me.id, actorLink: true, disposition: -1, parent: sc }, { actorId: ally.id, actorLink: true, disposition: 1, parent: sc }];
    g.game.scenes = [sc];
    g.game.combats = [{ started: true, combatants: [{ actor: me }, { actor: ally }] }];
    try { assert.equal(SR2Actor.spellDefenseCoverProblem(ally, me, P1()), ''); } finally { delete g.game.combats; delete g.game.scenes; }
  });
  test('an NPC on the other side still doesn\'t cover a PC', () => {
    g.game.users = usersAll();
    const me = ownedBy(who({ name: 'Me' }), 'p1');
    const foe = ownedBy(who({ name: 'Foe' }));
    const sc: any = { id: 'S1' };
    sc.tokens = [{ actorId: me.id, actorLink: true, disposition: 1, parent: sc }, { actorId: foe.id, actorLink: true, disposition: -1, parent: sc }];
    g.game.scenes = [sc];
    try { assert.match(SR2Actor.spellDefenseCoverProblem(foe, me, P1()), /other side/); } finally { delete g.game.scenes; }
  });
});

describe('round 3 item 10 (V2 #11): burning in a combat linked to no scene', () => {
  test('someone on fire outside the tracker burns on its rounds, as before v0.81.1', async () => {
    await withRule(RULES.COMBAT.burning, 'enabled', true, async () => {
      const a = who({ name: 'Torch' });
      let burned = 0;
      a.resistHazard = async () => { burned++; };
      a.flags.sr2e = { onFire: { combatId: 'A', round: 1 } };
      const A = { id: 'A', started: true, round: 2, combatants: [], scene: null };
      g.game.combats = { get: (id: string) => (id === 'A' ? A : undefined) };
      try { await SR2Actor.burningTick(a, 2, 'A'); } finally { delete g.game.combats; }
      assert.equal(burned, 1);
    });
  });
});

describe('round 3 nit (V2 #15): only IC is exempt from the tally-source check', () => {
  test('a GM NPC as the source can\'t put successes on a player\'s decker\'s tally', async () => {
    await withRule(RULES.MATRIX_V57.tally, 'perDecker', true, async () => {
      g.game.users = usersAll();
      const h = who({ name: 'Host', type: 'host' }); Object.assign(h.system, { sheaf: [], tallies: [], tally: 0 });
      const npc = ownedBy(who({ name: 'Boss', type: 'npc' }));
      const decker = ownedBy(who({ name: 'Decker' }), 'p1');
      assert.equal(await SR2Actor.applyTallyCard(h.uuid, 2, { key: decker.uuid, name: 'x' }, npc.uuid), null);
    });
  });
});

describe('round 3 (FX-APP-WIRING3): the GM\'s Detonate confirm text', () => {
  test('detonateConfirmText gives the record\'s bounded numbers to a GM, nothing to a player or without a record', () => {
    const a = who({ name: 'Sapper' });
    a.flags.sr2e = { setCharges: [{ id: 'c1', itemId: 'gone', name: 'C4', power: 999, perMetre: 0.01, shaped: true }] };
    g.game.user = P1();
    assert.equal(SR2Actor.detonateConfirmText(a, 'c1', '', {}), null);
    g.game.user = GM();
    assert.deepEqual({ ...SR2Actor.detonateConfirmText(a, 'c1', '', {}), text: undefined }, { text: undefined, power: 200, perMetre: 0.25, shaped: true });
    assert.equal(SR2Actor.detonateConfirmText(a, 'none', '', {}), null);
  });
});
