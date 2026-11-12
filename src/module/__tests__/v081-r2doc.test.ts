/**
 * v0.81.0 fix round 2, RF-DOC: documents/index.ts. One test (or more) per finding of RV/R2-DOC.md and the index.ts
 * findings of RV/R2-SEC.md, with the reviewers' own failing inputs (try-R2-DOC r2doc-probe P1/P2, try-R2-SEC Q3/Q6).
 * Each failed before its fix. The harness is v081-doc.test.ts's (the v0.71.0 glue stubs).
 */
import { test, describe, before, beforeEach, after } from 'node:test';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { SPIRITS_V922_WAY } from '../rules/__tests__/spirits922.ts';
import { SORCERY_V922 } from '../rules/__tests__/sorcery922.ts';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
// v0.92.3: this file pins the v0.92.2 conjuring, astral and initiation rules (the book way: v0923-spirits.test.ts).
let spirits922: () => void = () => {};
before(() => { spirits922 = oldWay(SPIRITS_V922_WAY); });
after(() => spirits922());

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
const skill = (id: string, name: string, rating: number, attribute = 'quickness') => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0 } });

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

const spiritOf = (extra: any = {}) => who({ name: 'Mote', type: 'spirit', force: 6, ...extra });

describe('R2-DOC 1 (D1-8): an exclusive spell blocks every other test', () => {
  test('P1: a non-physical skill (Etiquette) and a Willpower test are refused', async () => {
    const a = who({ name: 'Mage', sustaining: [{ spellName: 'Trance', force: 4, exclusive: true }] }, [skill('et', 'Etiquette', 4, 'charisma')]);
    await withRule(RULES.MAGIC_V61.exclusive, 'blocksAllTests', true, async () => {
      faces.push(5, 5, 5, 5, 5, 5, 5, 5, 5);
      assert.equal(await a.rollSkill(a.items.get('et'), { targetNumber: 4 }), null);
      assert.equal(await a.rollAttribute('willpower', { targetNumber: 4 }), null);
      assert.ok(warnings.some((w) => /exclusive spell Trance/.test(w)), warnings.join(' | '));
    });
  });

  test('without the exclusive spell (or with the switch off) the same tests roll', async () => {
    const a = who({ name: 'Mage', sustaining: [{ spellName: 'Trance', force: 4, exclusive: true }] }, [skill('et', 'Etiquette', 4, 'charisma')]);
    await withRule(RULES.MAGIC_V61.exclusive, 'blocksAllTests', false, async () => {
      faces.push(5, 5, 5, 5, 5, 5, 5, 5, 5);
      assert.notEqual(await a.rollSkill(a.items.get('et'), { targetNumber: 4 }), null);
      assert.notEqual(await a.rollAttribute('willpower', { targetNumber: 4 }), null);
    });
  });
});

describe('R2-DOC 2 (D1-4): an Essence drain the GM moves by hand', () => {
  test('P2: a re-roll asks the GM only for the difference, and to take it back when the victim now resists', async () => {
    const caster = who({ name: 'Wendigo' });
    caster.isOwner = false;
    const victim = who({ name: 'Victim', karma: { pool: 10, poolSpent: 0, good: 0, career: 0 } });
    const snap: any = {
      actorUuid: victim.uuid, kind: 'soak', label: 'Resist Essence drain', rerolls: 0, testId: 't1',
      dice: [{ faces: [1], total: 1, success: false }, { faces: [1], total: 1, success: false }, { faces: [1], total: 1, success: false }],
      successes: 0, botch: false, targetNumber: 4, baseTargetNumber: 4, modifiers: [], totalDice: 3, targetNumberClamped: false,
      soak: { mode: 'spell', effectOnly: true, casterSuccesses: 3, spellName: 'Essence Drain', noun: 'damage', level: 'M', type: 'stun', body: 4, before: { physical: 0, stun: 0 },
        essenceDrain: { casterUuid: caster.uuid } },
    };
    faces.push(1, 1, 1);
    await victim.karmaReroll(snap);
    const c1 = chat.at(-1);
    const ed1 = c1.flags.sr2e.test.soak.essenceDrain;
    assert.ok(ed1.gained > 0, JSON.stringify(ed1));
    assert.equal(ed1.gmGain, true);
    assert.match(c1.content, new RegExp(`GM: give Wendigo ${ed1.gained} Essence by hand`));
    assert.match(c1.content, /the GM gives Wendigo/);
    assert.doesNotMatch(c1.content, /Wendigo gains/);
    // The GM follows the note.
    caster.system.essenceShift = Number(caster.system.essenceShift ?? 0) + ed1.gained; caster.system.prepareDerivedData();
    // A second re-roll that changes nothing asks for nothing more.
    faces.push(1, 1, 1);
    await victim.karmaReroll({ ...c1.flags.sr2e.test });
    const c2 = chat.at(-1);
    assert.doesNotMatch(c2.content, /by hand/);
    assert.equal(c2.flags.sr2e.test.soak.essenceDrain.gained, ed1.gained);
    // A re-roll that now resists: the GM takes it back.
    faces.push(5, 5, 5);
    await victim.karmaReroll({ ...c2.flags.sr2e.test });
    const c3 = chat.at(-1);
    assert.match(c3.content, new RegExp(`GM: take ${ed1.gained} Essence back from Wendigo by hand`));
    assert.equal(c3.flags.sr2e.test.soak.essenceDrain.gained, 0);
  });

  test('R2-DOC 9: the victim\'s own failed write is left to the GM and the card says so', async () => {
    const caster = who({ name: 'Wendigo' });
    const victim = who({ name: 'Victim', karma: { pool: 10, poolSpent: 0, good: 0, career: 0 } });
    const realUpdate = victim.update.bind(victim);
    victim.update = async (d: any) => { if ('system.essenceShift' in d) throw new Error('no permission'); return realUpdate(d); };
    const snap: any = {
      actorUuid: victim.uuid, kind: 'soak', label: 'Resist Essence drain', rerolls: 0, testId: 't2',
      dice: [{ faces: [1], total: 1, success: false }], successes: 0, botch: false, targetNumber: 4, baseTargetNumber: 4, modifiers: [], totalDice: 1, targetNumberClamped: false,
      soak: { mode: 'spell', effectOnly: true, casterSuccesses: 3, spellName: 'Essence Drain', noun: 'damage', level: 'M', type: 'stun', body: 4, before: { physical: 0, stun: 0 }, essenceDrain: { casterUuid: caster.uuid } },
    };
    faces.push(1);
    await victim.karmaReroll(snap);
    const c = chat.at(-1);
    assert.match(c.content, /Essence drain:<\/strong> <em>GM: take [\d.]+ Essence from Victim by hand/);
    assert.match(c.content, /the GM takes [\d.]+ Essence from Victim/);
    assert.equal(c.flags.sr2e.test.soak.essenceDrain.gmTake, true);
  });
});

describe('R2-DOC 3 (D1-7): sneaking is a physical act', () => {
  test('someone down or a projecting body can\'t choose to sneak', async () => {
    const guard = who({ name: 'Guard', type: 'npc' });
    const down = who({ name: 'Down', monitor: { physical: 0, stun: 10 } }, [skill('st', 'Stealth', 3)]);
    faces.push(5, 5, 5, 5, 5, 5, 5, 5, 5, 5);
    assert.deepEqual(await down.sneakPast([guard.uuid], {}), []);
    const body = who({ name: 'Mage', magic: 6 }, [skill('st', 'Stealth', 3)]);
    body.system.derived.astralMode = 'projecting';
    assert.deepEqual(await body.sneakPast([guard.uuid], {}), []);
    assert.equal(chat.length, 0);
  });

  test('guards watching still spot an intruder who is down: no Stealth dice for them', async () => {
    const guard = who({ name: 'Guard', type: 'npc' });
    const down = who({ name: 'Down', monitor: { physical: 0, stun: 10 } }, [skill('st', 'Stealth', 3)]);
    faces.push(5, 5, 5, 5, 5, 5, 5, 5, 5, 5);
    const res = await down.sneakPast([guard.uuid], { watched: true });
    assert.deepEqual(res.map((x: any) => x.noticed), [true]);
    const side = chat.at(-1).flags.sr2e.contest.sides[0];
    assert.equal(side.result.totalDice, 0);
    assert.match(side.label, /is unconscious: no Stealth/);
  });
});

describe('R2-DOC 4 (D2-2): a ritual member\'s drain', () => {
  test('a drain that fails after posting its card is not asked for again; the card for another\'s member gives TN and level', async (t) => {
    // v0.92.3: 'the book' here is the v0.92.2 reading (RULES.SORCERY_V923 at its old way); the book's way is in v0923-sorcery.test.ts.
    t.after(oldWay(SORCERY_V922));
    const leader = who({ name: 'Leader', magic: 6, nuyen: 100000 }, [skill('cj', RULES.MAGIC_V56.ward.skill, 6, 'charisma')]);
    const mine = who({ name: 'Mine', magic: 5 }, [skill('cj2', RULES.MAGIC_V56.ward.skill, 4, 'charisma')]);
    mine.wardDrain = async function (this: any, ...args: any[]) { await SR2Actor.prototype.wardDrain.apply(this, args); throw new Error('a later update failed'); };
    const theirs = who({ name: 'Theirs', magic: 5 }, [skill('cj3', RULES.MAGIC_V56.ward.skill, 4, 'charisma')]);
    theirs.isOwner = false;
    for (let i = 0; i < 200; i++) faces.push(5);
    await leader.raiseWardRitual({ force: 3, teamUuids: [mine.uuid, theirs.uuid], payMaterials: false });
    const byHand = chat.filter((m) => /rolls it by hand/.test(m.content ?? ''));
    assert.equal(byHand.length, 1, byHand.map((m) => m.content).join(' | '));
    assert.match(byHand[0].content, /Theirs<\/strong> resists the ritual drain for the ward \(Force 3\) \(Willpower vs TN \d+, [LMSD] drain\)/);
    assert.ok(chat.some((m) => /Ward drain/.test(m.content ?? '') && m.flags?.sr2e?.test?.actorUuid === mine.uuid), 'Mine\'s drain card was posted once');
  });
});

describe('R2-DOC 5 (D3-20): a complex form copied from one the player owns stays a complex form', () => {
  const pre = async (data: any, options: any) => {
    const { SR2Item } = await import('../documents/index.ts');
    const it: any = Object.create(SR2Item.prototype);
    const set: any[] = [];
    it.updateSource = (d: any) => { set.push(d); };
    it.system = {};
    await it._preCreate(data, options, PLAYER());
    return set;
  };
  test('from an owned complex form: kept; from a compendium, someone else\'s or a plain program: stripped', async () => {
    const own = ownedBy({ uuid: 'Actor.o.Item.cf', documentName: 'Item', system: { complexForm: true } }, 'p1');
    const other = ownedBy({ uuid: 'Actor.x.Item.cf', documentName: 'Item', system: { complexForm: true } }, 'p2');
    const plain = ownedBy({ uuid: 'Actor.o.Item.pl', documentName: 'Item', system: { complexForm: false } }, 'p1');
    for (const d of [own, other, plain]) uuidRegistry.set(d.uuid, d);
    const data = () => ({ type: 'program', name: 'Form', system: { complexForm: true } });
    assert.deepEqual(await pre(data(), { sr2eComplexFormFrom: own.uuid }), []);
    assert.deepEqual(await pre({ ...data(), _stats: { duplicateSource: own.uuid } }, {}), []);
    assert.deepEqual(await pre(data(), { sr2eComplexFormFrom: other.uuid }), [{ 'system.complexForm': false }]);
    assert.deepEqual(await pre(data(), { sr2eComplexFormFrom: plain.uuid }), [{ 'system.complexForm': false }]);
    assert.deepEqual(await pre({ ...data(), _stats: { compendiumSource: 'Compendium.x.y.Item.z' } }, { sr2eComplexFormFrom: 'Compendium.x.y.Item.z' }), [{ 'system.complexForm': false }]);
    assert.deepEqual(await pre(data(), {}), [{ 'system.complexForm': false }]);
  });
});

describe('R2-DOC 6 (D2-3): lower and dispel from a player\'s card need a test card behind them', () => {
  const testCard = (author: any, test: any) => asMessage({ author, flags: { sr2e: { test } } });
  test('a forged lower is refused; the banishing card that works it out lets it through', async () => {
    const p = PLAYER();
    // realUser compares by identity: the same object is the author everywhere.
    g.game.users = Object.assign([GM(), p], { activeGM: { id: 'gm1', isSelf: true }, get(this: any[], id: string) { return this.find((u: any) => u.id === id); } });
    const mage = ownedBy(who({ name: 'Mage' }), 'p1');
    const sp = spiritOf();
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: sp.uuid, lower: { key: 'force', from: 6, to: 0 }, by: mage.uuid }, { author: p }), false);
    assert.equal(sp.system.force, 6);
    // A real banishing: 5 vs 2 successes against Force 6.
    g.game.messages = { contents: [testCard(p, { kind: 'banish', successes: 5, banish: { spiritUuid: sp.uuid, spiritName: 'Mote', spiritSuccesses: 2, forceBefore: 6, forceAfter: 6 } })] };
    const { resolveBanishing } = await import('../rules/index.ts');
    const to = resolveBanishing({ banisherSuccesses: 5, spiritSuccesses: 2, force: 6 }).force;
    assert.ok(to < 6);
    if (to !== 0) assert.equal(await SR2Actor.applyActorUpdate({ uuid: sp.uuid, lower: { key: 'force', from: 6, to: 0 }, by: mage.uuid }, { author: p }), false, 'not more than the test works out');
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: sp.uuid, lower: { key: 'force', from: 6, to }, by: mage.uuid }, { author: p }), true);
    assert.equal(sp.system.force, to);
  });

  test('a dispel: only what the dispelling card works out', async () => {
    const p = PLAYER();
    g.game.users = Object.assign([GM(), p], { activeGM: { id: 'gm1', isSelf: true }, get(this: any[], id: string) { return this.find((u: any) => u.id === id); } });
    const mage = ownedBy(who({ name: 'Mage' }), 'p1');
    const boss = who({ name: 'Boss', sustaining: [{ spellName: 'Armor', force: 5, successes: 4 }] });
    const ch = { uuid: boss.uuid, dispel: { spellName: 'Armor', force: 5, from: 4, to: 0 }, by: mage.uuid };
    assert.equal(await SR2Actor.applyActorUpdate(ch, { author: p }), false);
    const { resolveDispel } = await import('../rules/index.ts');
    const remaining = resolveDispel(4, 2).remaining;
    g.game.messages = { contents: [testCard(p, { kind: 'dispel', successes: 2, dispel: { targetUuid: boss.uuid, targetName: 'Boss', spellName: 'Armor', force: 5, successesBefore: 4, successesAfter: 4 } })] };
    assert.equal(await SR2Actor.applyActorUpdate({ ...ch, dispel: { ...ch.dispel, to: remaining } }, { author: p }), true);
    assert.equal(remaining <= 0 ? boss.system.sustaining.length : boss.system.sustaining[0].successes, remaining <= 0 ? 0 : remaining);
    // The GM's own Apply needs no test card.
    const boss2 = who({ name: 'Boss2', sustaining: [{ spellName: 'Armor', force: 5, successes: 4 }] });
    g.game.messages = { contents: [] };
    assert.equal(await SR2Actor.applyActorUpdate({ uuid: boss2.uuid, dispel: { spellName: 'Armor', force: 5, from: 4, to: 1 } }, { author: g.game.users[0] }), true);
  });
});

describe('R2-SEC (index.ts side)', () => {
  test('Q3 / R2-SEC 1: a project on an actor no player owns pays no player (a GM card instead)', async () => {
    const p = PLAYER();
    g.game.users = Object.assign([GM(), p], { activeGM: { id: 'gm1', isSelf: true } });
    const own3 = ownedBy(who({ name: 'Mine', nuyen: 0 }), 'p1');
    const mote = ownedBy(spiritOf());
    // The probe's project call: refundModPayer('Actor.<mine>', 10000000, 'x').
    await mote.refundModPayer(own3.uuid, 10000000, 'x');
    assert.equal(own3.system.nuyen, 0);
    assert.ok(chat.some((m) => m.flags?.sr2e?.actorUpdate?.nuyen?.amount === 10000000 && m.flags.sr2e.actorUpdate.uuid === own3.uuid), 'a GM card');
    // GM-owned to GM-owned still pays straight away.
    const npc = ownedBy(who({ name: 'Fixer', nuyen: 0 }));
    await mote.refundModPayer(npc.uuid, 500, 'x');
    assert.equal(npc.system.nuyen, 500);
  });

  test('Q6 / R2-SEC 6: storedCharge keeps a fractional fall-off', async () => {
    // v0.81.1 (SEC1-16): the record names its explosive item (a record without one is refused).
    const px = { id: 'px', system: { explosive: { power: 12, perMetre: 0.5, shaped: false } } };
    const setter = { uuid: 'Actor.s6', items: { get: (id: string) => (id === 'px' ? px : undefined) }, getFlag: (_s: string, k: string) => (k === 'setCharges' ? [{ id: 'c1', itemId: 'px', name: 'Plastique', power: 12, perMetre: 0.5, shaped: false }] : undefined) };
    const c = (SR2Actor as any).storedCharge(setter, 'c1', '');
    assert.equal(c.perMetre, 0.5);
    assert.equal(c.power, 12);
  });

  test('R2-SEC 10: an edited record is held to its explosive and the setter\'s Demolitions dice', async () => {
    const { chargePower } = await import('../rules/index.ts');
    const d = RULES.COMBAT.demolitions;
    const setter = who({ name: 'Sapper' }, [skill('dm', d.skill, 4, d.attribute), { id: 'px', type: 'gear', name: 'Plastique', system: { quantity: 0, explosive: { power: 6, perMetre: 0.5, shaped: false } } }]);
    setter.flags = { sr2e: { setCharges: [{ id: 'c1', itemId: 'px', successes: 99, name: 'Plastique', power: 200, perMetre: 0, shaped: false }] } };
    const c = SR2Actor.storedCharge(setter, 'c1', '');
    assert.equal(c!.power, chargePower(6, 4));
    assert.equal(c!.perMetre, 0.5);
    // A record that matches a real roll keeps its Power.
    setter.flags.sr2e.setCharges[0] = { id: 'c1', itemId: 'px', successes: 2, name: 'Plastique', power: chargePower(6, 2), perMetre: 0.5 };
    assert.equal(SR2Actor.storedCharge(setter, 'c1', '')!.power, chargePower(6, 2));
  });

  test('R2-SEC 9: a player\'s Apply (GM) card can\'t heal through applyActorUpdate', async () => {
    const p = PLAYER();
    g.game.users = Object.assign([GM(), p], { activeGM: { id: 'gm1', isSelf: true }, get(this: any[], id: string) { return this.find((u: any) => u.id === id); } });
    const mine = ownedBy(who({ name: 'Mine' }), 'p1');
    const npc = who({ name: 'Boss', monitor: { physical: 8, stun: 0 } });
    await SR2Actor.applyActorUpdate({ uuid: npc.uuid, monitor: { track: 'physical', boxes: -10 }, by: mine.uuid }, { author: p });
    assert.equal(npc.system.monitor.physical, 8);
    // The GM's own card may.
    await SR2Actor.applyActorUpdate({ uuid: npc.uuid, monitor: { track: 'physical', boxes: -3 } }, { author: g.game.users[0] });
    assert.equal(npc.system.monitor.physical, 5);
  });

  test('R2-SEC 12 (v0.81.1 round 2): spendSpellDefense finds the fight in any running combat, not only the viewed one', async () => {
    const { registerCombatRelay } = await import('../documents/index.ts');
    const { requestGm } = await import('../applications/socket.ts');
    registerCombatRelay();
    const protector = ownedBy(who({ name: 'Mage', spellDefense: 4 }), 'p2');
    const target = ownedBy(who({ name: 'Me' }), 'p1');
    g.game.user = PLAYER();
    g.game.users = Object.assign([GM(), g.game.user], { activeGM: { id: 'p1', isSelf: true } });
    const fight = { id: 'cb2', started: true, combatants: [{ actor: protector }, { actor: target }] };
    g.game.combat = { id: 'cb1', started: true, combatants: [] };
    g.game.combats = { contents: [g.game.combat, fight] };
    try {
      // v0.81.1 round 2 (V-DOC 2, FIX2-BRIEF H2): both in one running combat (any, not only the viewed one) covers,
      // unless their tokens put them on opposite sides.
      const r = await requestGm('spendSpellDefense', { protectorUuid: protector.uuid, targetUuid: target.uuid, amount: 2 });
      assert.equal(r.ok, true, r.note);
      assert.equal(protector.system.spellDefense, 2);
    } finally { delete g.game.combats; }
  });

  test('R2-SEC 3: the turret card names the firer, and mountedRole says a gunner aboard may aim', async () => {
    const gunner = who({ name: 'Gunner' });
    const van = vehicle({ name: 'Van' });
    van.isAboard = (a: any) => a === gunner;
    const gun: any = { uuid: `${van.uuid}.Item.gun`, name: 'Turret gun', parent: van, isOwner: false };
    await SR2Actor.setTurretFacing(gun, 90, gunner);
    assert.deepEqual(chat.at(-1).flags.sr2e.turretFacing, { weaponUuid: gun.uuid, facing: 90, firerUuid: gunner.uuid });
    assert.equal(SR2Actor.mountedRole(gunner, van), 'gunner');
    assert.equal(SR2Actor.mountedRole(who({ name: 'Stranger' }), van), null);
  });

  test('R2-SEC 5: the URR Magic loss card from a healer speaks as the healer and names them', async () => {
    const healer = who({ name: 'Doc' });
    const patient = who({ name: 'Mage', magic: 5 });
    await withRule(RULES.MAGIC_LOSS, 'enabled', true, () => SR2Actor.urrMagicLossCard(patient, healer));
    const m = chat.at(-1);
    assert.equal(m.flags.sr2e.magicLossFor, patient.uuid);
    assert.equal(m.flags.sr2e.magicLossBy, healer.uuid);
    assert.match(m.content, /treated by Doc/);
  });
});
