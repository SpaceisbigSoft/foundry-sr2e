/**
 * v0.96.0 sorcery (RULES.SORCERY_V96), the book paths through the real documents/index.ts: castSpell with stacking,
 * area shaping, centering and a totem; quickening (and the approval round trip of its third argument); anchoring's
 * preparing test; a dispelled spell's effect refit; assensing a masked initiate. The stubs are v072.test.ts's
 * (scripted dice, a chat log, warnings). These check OUR wiring, not that Foundry behaves as the stubs do.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { methodRequestProblems } from '../rules/trust.ts';

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
let approvals: typeof import('../applications/approvals.ts');

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
  ({ CharacterDataModel } = await import('../models/index.ts'));
  ({ SR2Actor } = await import('../documents/index.ts'));
  g.CONFIG = { Actor: { documentClass: SR2Actor } };
  approvals = await import('../applications/approvals.ts');
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
  a.uuid = `Actor.v96-${++n}`; a.id = `id${n}`;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness', more: any = {}) => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, ...more } });

const spellItem = (id: string, name: string, sys: any = {}) => ({ id, name, type: 'spell', system: { category: 'combat', spellType: 'mana', learnedForce: 4, damageLevel: 'M', damageType: 'stun',
  targetNumber: 4, drainModifier: 0, drainLevel: 'M', duration: 'instant', resist: 'none', heals: false, healTrack: 'physical', exclusive: false, fetish: false,
  elemental: false, element: '', area: false, ...sys } });

const SID = 'shadowrun2e_unified';
const tests = () => chat.map((m: any) => m.flags?.[SID]?.test).filter(Boolean);
const fives = (n: number) => { for (let i = 0; i < n; i++) faces.push(5); };

describe('v0.96.0 sorcery documents: castSpell (Core pp. 119, 129–132; Grimoire p. 43)', () => {
  const shaman = (extra: any = {}) => who({ name: 'Shaman', magic: 6, tradition: 'shamanic', totem: { name: 'Bear', combat: 2 }, metamagic: { centering: true }, initiateGrade: 1, centeringSkill: 'Singing', ...extra },
    [skill('sorc', 'Sorcery', 4, 'willpower'), skill('sing', 'Singing', 3, 'charisma'), spellItem('sb', 'Stunbolt', { learnedForce: 4 })]);

  test('stacking +2 on the cast and Drain; a totem with no pool asked adds its dice; centering against Drain adds a success, kept as center96', async () => {
    const t = who({ name: 'Target' });
    const a = shaman();
    fives(60);
    await a.castSpell(a.items.get('sb'), { force: 4, targetUuid: t.uuid, stack96: 1, center96: 'drain' });
    const all = tests();
    const cast = all.find((s: any) => s.kind === 'spell');
    assert.ok(cast, 'a casting card');
    assert.equal(cast.totalDice, 6); // Sorcery 4 + the totem's 2 as free pool dice
    assert.ok(cast.modifiers.some((m: any) => m.id === 'stacked96' && m.value === 2));
    const drain = all.find((s: any) => s.kind === 'soak');
    assert.ok(drain.modifiers.some((m: any) => m.id === 'stacked96' && m.value === 2));
    assert.equal(drain.center96, 1); // 3 centering successes → 1
    assert.equal(drain.bought ?? 0, 0);
    assert.ok(chat.some((m: any) => /Centering/i.test(String(m.content ?? '')) || /centerDrain/.test(String(m.content ?? ''))));
  });

  test('an exclusive spell refuses stacking; area shaping takes dice off (own Force) and refuses too many', async () => {
    const t = who({ name: 'Target' });
    const a = shaman();
    a.items.get('sb').system.exclusive = true;
    assert.equal(await a.castSpell(a.items.get('sb'), { force: 4, targetUuid: t.uuid, stack96: 1 }), null);
    assert.equal(warnings.length, 1);
    a.items.get('sb').system.exclusive = false;
    a.items.get('sb').system.area = true;
    assert.equal(await a.castSpell(a.items.get('sb'), { force: 2, targetUuids: [t.uuid], area96: -2 }), null); // 4 dice > Force 2
    fives(60);
    await a.castSpell(a.items.get('sb'), { force: 4, targetUuids: [t.uuid], area96: -1 });
    const cast = tests().find((s: any) => s.kind === 'spell');
    assert.equal(cast.totalDice, 4); // 4 + 2 totem − 2 withheld
  });

  test('off: no stacking row, the totem adds to the test as before (v0.95.1)', async (tc) => {
    tc.after(oldWay({ 'SORCERY_V96.stacking': 'off', 'SORCERY_V96.totemPool': 'off', 'SORCERY_V96.centeringUse': 'off' }));
    const t = who({ name: 'Target' });
    const a = shaman();
    fives(60);
    await a.castSpell(a.items.get('sb'), { force: 4, targetUuid: t.uuid, stack96: 1, center96: 'drain' });
    const cast = tests().find((s: any) => s.kind === 'spell');
    assert.equal(cast.totalDice, 6);
    assert.ok(!cast.modifiers.some((m: any) => m.id === 'stacked96'));
    assert.equal(tests().find((s: any) => s.kind === 'soak').center96, undefined);
  });
});

describe('v0.96.0 sorcery documents: quickening (Grimoire pp. 44–45)', () => {
  const mage = (entry: any = {}) => who({ name: 'Mage', magic: 6, tradition: 'hermetic', initiateGrade: 1, karma: { pool: 0, poolSpent: 0, good: 20, career: 20 }, metamagic: { quickening: true },
    sustaining: [{ spellName: 'Armor', force: 3, category: 'manipulation', focusId: '', successes: 2, quickened: false, castDice96: 9, castTn96: 5, drainMod96: 2, drainCenter96: 0, ...entry }] },
  [skill('sorc', 'Sorcery', 4, 'willpower'), spellItem('ar', 'Armor', { category: 'manipulation', duration: 'sustained', learnedForce: 3, drainModifier: 2 })]);

  test('the stored dice and TN win over the window; Karma Force..2×Force; the second Drain carries the cast\'s modifiers', async () => {
    const a = mage();
    fives(40);
    assert.equal(await a.quicken(0, 'Armor', { dice: 1, tn: 2, karma: 5 }), true);
    assert.equal(a.system.sustaining[0].quickened, true);
    assert.equal(a.system.sustaining[0].quickenKarma, 5);
    assert.equal(a.system.karma.good, 15);
    const qc = chat.find((m: any) => /quicken/i.test(String(m.content ?? '')));
    assert.match(String(qc.content), /\b5\b/); // TN 5 from the cast, not the window's 2
    const drain = tests().find((s: any) => s.kind === 'soak');
    assert.ok(drain.modifiers.some((m: any) => m.id === 'castDrain96' && m.value === 2));
    assert.equal(await a.quicken(0, 'Armor', { karma: 7 }), false); // already quickened
    // Review: two at once spend once.
    const c = mage();
    fives(80);
    const both = await Promise.all([c.quicken(0, 'Armor', { karma: 3 }), c.quicken(0, 'Armor', { karma: 3 })]);
    assert.deepEqual(both.filter(Boolean).length, 1);
    assert.equal(c.system.karma.good, 17);
    const b = mage();
    assert.equal(await b.quicken(0, 'Armor', { karma: 7 }), false); // above 2 × Force
    assert.equal(b.system.karma.good, 20);
  });

  test('a player files a request carrying the third argument; the trust rule wants the filed Karma', async () => {
    settings['approvalQueue'] = true;
    g.game.user = PLAYER();
    const a = mage({ castDice96: 0, castTn96: 0 });
    assert.equal(await a.quicken(0, 'Armor', { dice: 1, tn: 2, karma: 4 }), false);
    const reqs = approvals.requestsOf(a);
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0]!.karma, 4);
    assert.deepEqual(reqs[0]!.data, { method: 'quicken', args: [0, 'Armor', { dice: 4, tn: 4, karma: 4 }] }); // clamped: Sorcery 4, the spell's TN 4
    assert.deepEqual(methodRequestProblems(reqs[0]!.data as any, { karma: 4, nuyen: 0 }), []);
    assert.equal(methodRequestProblems({ method: 'quicken', args: [0, 'Armor', { karma: 6 }] }, { karma: 4, nuyen: 0 }).length, 1);
    assert.equal(methodRequestProblems({ method: 'quicken', args: [0, 'Armor', { karma: 4.5 }] }, { karma: 4.5, nuyen: 0 }).length, 1);
    // The GM approves: it runs with that argument.
    g.game.user = GM();
    fives(40);
    assert.equal(await a.quicken(0, 'Armor', (reqs[0]!.data as any).args[2]), true);
    assert.equal(a.system.sustaining[0].quickenKarma, 4);
  });
});

describe('v0.96.0 sorcery documents: anchoring (Grimoire p. 47)', () => {
  test('Karma = Force + links; the Enchanting test goes on the anchoring card; off: the old Karma', async (tc) => {
    const a = who({ name: 'Mage', magic: 6, tradition: 'hermetic', metamagic: { anchoring: true }, initiateGrade: 1 }, [skill('sorc', 'Sorcery', 4, 'willpower'), skill('ench', 'Enchanting', 3, 'intelligence'), spellItem('sb', 'Stunbolt')]);
    fives(10);
    assert.equal(await a.castSpell(a.items.get('sb'), { force: 3, anchor: { trigger: 'the door opens' } }), null);
    assert.equal(a.system.anchored[0].karma, 4); // Force 3 + 1 link
    assert.equal(a.system.karma.good, 26);
    assert.ok(chat.at(-1).rolls?.length, 'the Enchanting dice ride on the card');
    assert.ok(chat.at(-1).flavor, 'its line');
    tc.after(oldWay({ 'SORCERY_V96.anchoring': 'off' }));
    await a.anchorSpell('sb', 3, '');
    assert.equal(a.system.anchored[1].karma, 3);
  });
});

describe('v0.96.0 sorcery documents: a dispelled spell\'s effect (Grimoire p. 45)', () => {
  test('refitSpellEffect96 rebuilds the effect capped at the new Force; off leaves it', async (tc) => {
    const t = who({ name: 'Subject' });
    const spec = { name: 'Armor', attributes: {}, perSuccess: true, bundle: { ballistic: 1, impact: 1 }, kind: 'spell', capAt: 6, step: 1 };
    const fx = { ...SR2Actor.fxEntry(spec, 6, 'fx1', t.uuid, 'Caster') };
    await t.setFlag(SID, 'powerEffects', [fx]);
    assert.equal(t.getFlag(SID, 'powerEffects')[0].ballistic, 6);
    await SR2Actor.refitSpellEffect96({ effectId: 'fx1', targetUuids: [t.uuid] }, 4, t);
    assert.equal(t.getFlag(SID, 'powerEffects')[0].ballistic, 4);
    tc.after(oldWay({ 'SORCERY_V96.dispelEffect': 'off' }));
    await SR2Actor.refitSpellEffect96({ effectId: 'fx1', targetUuids: [t.uuid] }, 2, t);
    assert.equal(t.getFlag(SID, 'powerEffects')[0].ballistic, 4);
  });

  test('both dispel sites call it: the owner\'s dispel and the GM\'s Apply', async () => {
    const t = who({ name: 'Caster', magic: 6, tradition: 'hermetic' }, [spellItem('ar', 'Armor', { category: 'manipulation', duration: 'sustained', learnedForce: 6 })]);
    const spec = { name: 'Armor', attributes: {}, perSuccess: true, bundle: { ballistic: 1, impact: 1 }, kind: 'spell', capAt: 6, step: 1 };
    await t.setFlag(SID, 'powerEffects', [SR2Actor.fxEntry(spec, 6, 'fx2', t.uuid, 'Caster')]);
    t.system.sustaining = [{ spellName: 'Armor', force: 6, category: 'manipulation', focusId: '', successes: 6, quickened: false, effectId: 'fx2', targetUuids: [t.uuid] }];
    const d = who({ name: 'Dispeller', magic: 6, tradition: 'hermetic', metamagic: { dispelling: true }, initiateGrade: 6 }, [skill('sorc', 'Sorcery', 4, 'willpower')]);
    faces.push(6, 1, 6, 1, 1, 1); fives(30); // 2 successes at TN 6: Force 6 → 5
    await d.dispel(t, 0);
    assert.equal(t.system.sustaining[0].force, 5);
    assert.equal(t.getFlag(SID, 'powerEffects')[0].ballistic, 5);
  });
});

describe('v0.96.0 sorcery documents: assensing a masked initiate (Grimoire p. 46)', () => {
  test('a held mask: the card keeps masked96 and the aura reads as mundane; the second try is at +2; off: the old TN', async (tc) => {
    tc.after(oldWay({ 'SPIRITS_V96.assenseRepeat': 'v951' })); // v0.96.0 merge: the spirits area's repeated-assensing limit is tested in v096-spirits*
    const subject = who({ name: 'Masked', magic: 6, tradition: 'hermetic', metamagic: { masking: true }, initiateGrade: 4 });
    const viewer = who({ name: 'Viewer', magic: 7, tradition: 'hermetic', initiateGrade: 2, astral: 'perceiving' });
    faces.push(1, 1, 1, 1, 1, 1, 2); fives(10); // the mask test fails, the assensing succeeds
    await viewer.assense({ targetUuid: subject.uuid });
    const card = tests().find((s: any) => s.kind === 'assense');
    assert.equal(card.assense.masked96, true);
    assert.equal(viewer.getFlag(SID, 'maskTries96')[subject.uuid], 1);
    chat.length = 0;
    faces.push(1, 1, 1, 1, 1, 1, 2); fives(10);
    await viewer.assense({ targetUuid: subject.uuid });
    assert.ok(chat.some((m: any) => m.rolls !== undefined && /maskRetry|Second try/.test(JSON.stringify(m))) || viewer.getFlag(SID, 'maskTries96')[subject.uuid] === 2);
    tc.after(oldWay({ 'SORCERY_V96.masking': 'off' }));
    chat.length = 0;
    fives(10);
    await viewer.assense({ targetUuid: subject.uuid });
    const old = tests().find((s: any) => s.kind === 'assense');
    assert.equal(old.assense.masked96, undefined);
    assert.ok(old.modifiers.some((m: any) => m.id === 'masking'));
  });
});
