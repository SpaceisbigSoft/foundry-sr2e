/**
 * v0.92.3 book alignment, damage, health and hazards: the Foundry glue for RULES.HEALTH_V923 (rules/config923/health.ts),
 * each with the book's way (the default) and the old way (oldWay), and the Revamp unchanged (urrMode). The stubs are a
 * copy of v080-health-social.test.ts's. These check OUR wiring, not that Foundry behaves as the stubs do.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { urrMode } from '../rules/__tests__/urrmode.ts';
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
  a.uuid = `Actor.v923h-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness', more: any = {}) => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, ...more } });



const medkit = { id: 'k1', type: 'gear', name: 'Medkit', system: { medkitRating: 2 } };
const medic = (rating = 4) => who({ name: 'Medic' }, [skill('bt', 'Biotech', rating, 'intelligence'), medkit]);

const off = (patch: Record<string, unknown>) => oldWay(patch);
const ones = (n: number) => faces.push(...Array(n).fill(1));
const fives = (n: number) => faces.push(...Array(n).fill(5));
const spell = (id: string, name: string, system: any) => ({ id, type: 'spell', name, system: { category: 'health', spellType: 'mana', learnedForce: 4, targetNumber: 4, damageLevel: 'M', damageType: 'physical', duration: 'instant', range: 'touch', heals: true, healTrack: 'physical', ...system } });
const mage = (extra: any = {}, items: any[] = []) => who({ magic: 6, tradition: 'hermetic', ...extra }, [skill('sorc', 'Sorcery', 4, 'willpower'), ...items]);
const bioware = (bi: number) => ({ id: 'bw', type: 'cyberware', name: 'Lots of bioware', system: { bioware: true, bodyIndex: bi, installed: true, essenceCost: 0, grade: 'standard', attributes: {} } });

describe('v0.92.3 death and bleeding (HEALTH_V923.death, bleed; Core p. 111)', () => {
  test('dead only past the natural Body: one box beyond the Overflow row; cyber Body does not count', (t) => {
    assert.equal(who({ monitor: { physical: 14, stun: 0 } }).system.derived.status, 'dying');
    assert.equal(who({ monitor: { physical: 15, stun: 0 } }).system.derived.status, 'dead');
    const boosted = who({ monitor: { physical: 15, stun: 0 } });
    boosted.system.attributes.body.mod = 2; boosted.system.prepareDerivedData();   // Body 6 by augmentation, natural 4
    assert.equal(boosted.system.attributes.body.total, 6);
    assert.equal(boosted.system.derived.status, 'dead');
    assert.equal(boosted.system.derived.vitals.overflowBody, 4);
    t.after(off({ 'HEALTH_V923.death': 'total' }));
    assert.equal(who({ monitor: { physical: 14, stun: 0 } }).system.derived.status, 'dead');
    boosted.system.prepareDerivedData();
    assert.equal(boosted.system.derived.status, 'dying');                         // total Body 6: dead at 16
  });
  test('the Revamp keeps its own switch (augmented Body, one box more)', (t) => {
    t.after(urrMode());
    const b = who({ monitor: { physical: 15, stun: 0 } });
    b.system.attributes.body.mod = 2; b.system.prepareDerivedData();
    assert.equal(b.system.derived.status, 'dying');
    b.system.monitor.physical = 17; b.system.prepareDerivedData();
    assert.equal(b.system.derived.status, 'dead');
  });
  test('bleeding: a box every 10 minutes unattended; the old way every (Body) Combat Turns', async (t) => {
    const a = who({ name: 'Downed', monitor: { physical: 10, stun: 0 } });
    a.flags.sr2e = { dyingAt: { t: 0, boxes: 0 } };
    g.game.actors = [a];
    await SR2Actor.timedEffects({ worldTime: 599, anyGm: true });
    assert.equal(a.system.monitor.physical, 10);
    await SR2Actor.timedEffects({ worldTime: 600, anyGm: true });
    assert.equal(a.system.monitor.physical, 11);
    assert.match(a.system.derived.bleedEvery, /10 minutes/);
    t.after(off({ 'HEALTH_V923.bleed': 'bodyTurns' }));
    const b = who({ name: 'Downed', monitor: { physical: 10, stun: 0 } });
    b.flags.sr2e = { dyingAt: { t: 0, boxes: 0 } };
    g.game.actors = [b];
    await SR2Actor.timedEffects({ worldTime: 24, anyGm: true });                  // 8 turns, Body 4: 2 boxes
    assert.equal(b.system.monitor.physical, 12);
  });
});

describe('v0.92.3 first aid (HEALTH_V923.firstAid, firstAidStun, selfStabilise, firstAidTime; Core p. 115)', () => {
  test('one success lowers the wound one level, never more; the card gives the time', async (t) => {
    const p = who({ name: 'Patient', monitor: { physical: 4, stun: 0 } });
    faces.push(5, 1, 1, 1);                                           // Biotech 4 vs 6 − 1 (natural Body 4): 1 success
    await medic().firstAid(p, { medkitId: 'k1' });
    assert.equal(p.system.monitor.physical, 1);                       // Moderate → the lowest box of Light
    assert.match(chat.at(-1).content, /takes 20 minutes/i);
    t.after(off({ 'HEALTH_V923.firstAid': 'boxes', 'HEALTH_V923.firstAidTime': 'hidden' }));
    const q = who({ name: 'Patient', monitor: { physical: 4, stun: 0 } });
    faces.push(5, 1, 1, 1);
    await medic().firstAid(q, { medkitId: 'k1' });
    assert.equal(q.system.monitor.physical, 3);
    assert.doesNotMatch(chat.at(-1).content, /minutes/);
  });
  test('a Deadly wound is only stabilised; a failed attempt gives the patient a natural Body (10) test', async (t) => {
    const p = who({ name: 'Dying', monitor: { physical: 10, stun: 0 } });
    faces.push(6, 1, 1, 1, 5);                                        // TN 10 − 1 = 9: the 6 re-rolls a 5 (11), one success
    await medic().firstAid(p, { medkitId: 'k1' });
    assert.equal(p.system.monitor.physical, 10);
    assert.equal(p.system.care.stabilised, true);
    const q = who({ name: 'Dying', monitor: { physical: 10, stun: 0 } });
    faces.push(1, 1, 1, 1);                                           // first aid fails
    faces.push(1, 1, 1, 1);                                           // natural Body 4 vs 10: fails
    await medic().firstAid(q, { medkitId: 'k1' });
    assert.ok(chat.some((c: any) => /Self-stabilisation/i.test(c.content)), chat.map((c: any) => c.content).join('\n'));
    t.after(off({ 'HEALTH_V923.selfStabilise': 'none' }));
    chat.length = 0;
    const r = who({ name: 'Dying', monitor: { physical: 10, stun: 0 } });
    faces.push(1, 1, 1, 1);
    await medic().firstAid(r, { medkitId: 'k1' });
    assert.ok(!chat.some((c: any) => /Self-stabilisation/i.test(c.content)));
  });
  test('Physical only: first aid on Stun is refused; the old way allows it', async (t) => {
    const p = who({ name: 'Dazed', monitor: { physical: 0, stun: 4 } });
    assert.equal(await medic().firstAid(p, { track: 'stun', medkitId: 'k1' }), null);
    assert.match(warnings.at(-1) ?? '', /Physical damage only/);
    t.after(off({ 'HEALTH_V923.firstAidStun': 'both' }));
    faces.push(5, 1, 1, 1);
    assert.ok(await medic().firstAid(p, { track: 'stun', medkitId: 'k1' }));
  });
  test('a better healer may try again; once per wound the old way', async (t) => {
    const p = who({ name: 'Patient', monitor: { physical: 7, stun: 0 } });
    faces.push(1, 1, 1);
    await medic(3).firstAid(p, { medkitId: 'k1' });
    faces.push(1, 1, 1, 1, 1);
    assert.ok(await medic(5).firstAid(p, { medkitId: 'k1' }));
    t.after(off({ 'HEALTH_V923.firstAidRetry': 'once' }));
    const q = who({ name: 'Patient', monitor: { physical: 7, stun: 0 } });
    faces.push(1, 1, 1);
    await medic(3).firstAid(q, { medkitId: 'k1' });
    assert.equal(await medic(5).firstAid(q, { medkitId: 'k1' }), null);
  });
  test('a magician treated without the +2 tests for Magic loss, twice for a Deadly wound', async (t) => {
    const p = who({ name: 'Mage', magic: 5, monitor: { physical: 10, stun: 0 } });
    faces.push(1, 1, 1, 1, 1, 1, 1, 1);
    await medic().firstAid(p, { medkitId: 'k1', applyMagician: false });
    assert.equal(chat.filter((c: any) => /data-sr2e-action="magicLoss"/.test(c.content)).length, 2);
    t.after(off({ 'HEALTH_V923.magicLossUntreated': 'none' }));
    chat.length = 0;
    const q = who({ name: 'Mage', magic: 5, monitor: { physical: 10, stun: 0 } });
    faces.push(1, 1, 1, 1, 1, 1, 1, 1);
    await medic().firstAid(q, { medkitId: 'k1', applyMagician: false });
    assert.equal(chat.filter((c: any) => /data-sr2e-action="magicLoss"/.test(c.content)).length, 0);
  });
  test('the trauma patch: a natural Body test vs 4 by the book; stabilises outright the old way', async (t) => {
    const p = who({ name: 'Dying', monitor: { physical: 10, stun: 0 } });
    faces.push(1, 1, 1, 1);                                           // natural Body 4 vs 4: fails
    await SR2Actor.patchEffect(p, { kind: 'trauma', rating: 3, name: 'Trauma patch' });
    assert.equal(p.system.care.stabilised, false);
    assert.equal(p.getFlag('sr2e', 'traumaPatched923'), true);
    t.after(off({ 'HEALTH_V923.traumaPatch': 'stabilise' }));
    const q = who({ name: 'Dying', monitor: { physical: 10, stun: 0 } });
    await SR2Actor.patchEffect(q, { kind: 'trauma', rating: 3, name: 'Trauma patch' });
    assert.equal(q.system.care.stabilised, true);
  });
});

describe('v0.92.3 Stun recovery and Body Index (HEALTH_V923.stunRecovery, bodyIndexHealing; Core p. 112, Shadowtech)', () => {
  test('the higher of Body and Willpower vs 2 + the wound modifiers, no care, no fee; the old way Body vs 4 with care', async (t) => {
    const a = who({ name: 'Dazed', nuyen: 1000, monitor: { physical: 1, stun: 4 } });   // Willpower 5 > Body 4
    fives(5);
    const r = await a.naturalHeal({ track: 'stun', hours: 1, care: 'hospital' });
    assert.ok(r, warnings.join(' | '));
    assert.equal(r.targetNumber, 5);                                  // 2 + Moderate Stun 2 + Light Physical 1
    assert.match(chat.at(-1).content, /5 dice vs TN/);
    assert.equal(a.system.nuyen, 1000);
    t.after(off({ 'HEALTH_V923.stunRecovery': 'old' }));
    const b = who({ name: 'Dazed', nuyen: 1000, monitor: { physical: 1, stun: 4 } });
    fives(4);
    const o = await b.naturalHeal({ track: 'stun', hours: 1, care: 'hospital' });
    assert.ok(o, warnings.join(' | '));
    assert.equal(o.targetNumber, 2);                                  // Body vs 4 (Moderate), hospital −2
    assert.equal(b.system.nuyen, 500);
  });
  test('½ Body Index on magical healing (Treat 8 − Essence), not on first aid or rest', async (t) => {
    const p = who({ name: 'Patient', essence: 3, monitor: { physical: 3, stun: 1 } }, [bioware(2)]);
    fives(5);
    const rest = await p.naturalHeal({ track: 'stun', hours: 1 });
    assert.ok(!rest.modifiers.some((m: any) => /^Body Index/.test(String(m.label))));
    const treat = spell('tr', 'Treat', { treat: true });
    const c = mage({ name: 'Healer' }, [treat]);
    fives(30);
    const r = await c.castSpell(c.items.get('tr'), { targetUuid: p.uuid, force: 4 });
    assert.equal(r.targetNumber, 6);                                  // 8 − 3, + ½ of Body Index 2
    assert.ok(r.modifiers.some((m: any) => /^Body Index/.test(String(m.label)) && m.value === 1));
    t.after(off({ 'HEALTH_V923.bodyIndexHealing': 'natural', 'HEALTH_V923.treatTn': 'same' }));
    const p2 = who({ name: 'Patient', essence: 3, monitor: { physical: 3, stun: 1 } }, [bioware(2)]);
    fives(30);
    const o = await c.castSpell(c.items.get('tr'), { targetUuid: p2.uuid, force: 4 });
    assert.equal(o.targetNumber, 7);                                  // 10 − 3, no Body Index
    fives(5);
    const rest2 = await p2.naturalHeal({ track: 'stun', hours: 1 });
    assert.ok(rest2.modifiers.some((m: any) => /^Body Index/.test(String(m.label))));
  });
  test('no spell heals Stun by the book', async (t) => {
    const p = who({ name: 'Dazed', monitor: { physical: 0, stun: 4 } });
    const c = mage({ name: 'Healer' }, [spell('hs', 'Heal', { healTrack: 'stun' })]);
    assert.equal(await c.castSpell(c.items.get('hs'), { targetUuid: p.uuid, force: 4 }), null);
    assert.match(warnings.at(-1) ?? '', /no spell heals Stun/);
    t.after(off({ 'HEALTH_V923.spellsHealStun': 'yes' }));
    fives(10);
    assert.ok(await c.castSpell(c.items.get('hs'), { targetUuid: p.uuid, force: 4 }));
  });
});

describe('v0.92.3 permanent damage and drastic surgery (HEALTH_V923.permanentDamage, surgeryMagicLoss; Core p. 114)', () => {
  test('reaching Deadly offers the Body (4) test on the damage card; 0 successes cost an attribute', async (t) => {
    const a = who({ name: 'Hurt', monitor: { physical: 7, stun: 0 } });
    ones(4);
    await a.resistDamage({ power: 9, level: 'S' });
    const card = chat.find((c: any) => /data-sr2e-action="permanentDamage923"/.test(c.content));
    assert.ok(card);
    assert.equal(card.flags.sr2e.permanentDamageFor, a.uuid);
    ones(4); faces.push(3, 1);                                        // no successes; 1D6 = 3: Quickness
    const out = await a.rollPermanentDamage();
    assert.deepEqual({ kind: out.kind, result: out.result }, { kind: 'attribute', result: 'quickness' });
    assert.match(chat.at(-1).content, /Quickness/);
    t.after(off({ 'HEALTH_V923.permanentDamage': 'none' }));
    chat.length = 0;
    const b = who({ name: 'Hurt', monitor: { physical: 7, stun: 0 } });
    ones(4);
    await b.resistDamage({ power: 9, level: 'S' });
    assert.ok(!chat.some((c: any) => /permanentDamage923/.test(c.content)));
  });
  test('a trauma patch makes it +2; 1 success costs a limb or eye', async () => {
    const a = who({ name: 'Hurt', monitor: { physical: 10, stun: 0 }, flags: { sr2e: { traumaPatched923: true } } });
    faces.push(6, 1, 1, 1, 1); faces.push(6, 4);                      // vs 6: one success (6 + 1 = 7); 1D6 = 6 (an eye), 4: left
    const out = await a.rollPermanentDamage();
    assert.deepEqual({ kind: out.kind, result: out.result }, { kind: 'limb', result: 'leftEye' });
    assert.match(chat.at(-1).content, /vs 6/);
  });
  test('a magician through drastic surgery is asked for a Magic loss test', async (t) => {
    const doc = who({ name: 'Doc' }, [skill('bt', 'Biotech', 5, 'intelligence')]);
    const ware = { id: 'ww', type: 'cyberware', name: 'Wired Reflexes 1', system: { essenceCost: 2, grade: 'standard', installed: false, attributes: {}, reaction: 2, initiativeDice: 1 } };
    const p = who({ name: 'Adept', magic: 5 }, [ware]);
    fives(6);
    await p.surgery('ww', { surgeon: doc, pay: false });
    assert.ok(chat.some((c: any) => /drastic invasive surgery/.test(c.content) && /data-sr2e-action="magicLoss"/.test(c.content)));
    t.after(off({ 'HEALTH_V923.surgeryMagicLoss': 'none' }));
    chat.length = 0;
    const q = who({ name: 'Adept', magic: 5 }, [{ ...ware, id: 'w2' }]);
    fives(6);
    await q.surgery('w2', { surgeon: doc, pay: false });
    assert.ok(!chat.some((c: any) => /drastic invasive surgery/.test(c.content)));
  });
});

describe('v0.92.3 hazards (HEALTH_V923.falling, breathHold, drowning, burning; Fields of Fire p. 76, Cyberpirates, Grimoire)', () => {
  const vest = { id: 'arm', type: 'armor', name: 'Vest', system: { worn: true, ballistic: 4, impact: 4 } };
  test('falling: Deadly, Power ½ the metres less ½ impact armor, an Athletics test takes Power off', async (t) => {
    const a = who({ name: 'Faller' }, [vest, skill('ath', 'Athletics', 3, 'body')]);
    faces.push(5, 5, 1);                                              // Athletics 3 vs 10: none... (TN 10)
    ones(4);                                                          // Body 4 vs 5 − 2
    await a.resistHazard('falling', 10);
    assert.ok(chat.some((c: any) => /falls 10 m: Athletics/.test(c.content)));
    assert.match(chat.at(-1).content, /Resist 5D physical, armor 2/);
    t.after(off({ 'HEALTH_V923.falling': 'old' }));
    ones(4);
    await a.resistHazard('falling', 8);
    assert.match(chat.at(-1).content, /Resist 8S physical, armor 2/);
  });
  test('falling: Athletics successes can take all the Power', async () => {
    const a = who({ name: 'Cat' }, [skill('ath', 'Athletics', 4, 'body')]);
    faces.push(6, 6, 1, 1, 1, 1);                                      // vs 4 m: two 6s re-roll to 7 → 2 successes; Power 2 − 2
    await a.resistHazard('falling', 4);
    assert.match(chat.at(-1).content, /lands without harm/);
  });
  test('held breath 30 s per Body, then 1 unresisted Stun box an action phase', async (t) => {
    const a = who({ name: 'Diver' });                                 // Body 4: 120 s = 40 Combat Turns
    await a.resistHazard('drowning', 40);
    assert.match(chat.at(-1).content, /still holds their breath \(held breath, 40 Combat Turns\)/);
    await a.resistHazard('drowning', 46);
    assert.equal(a.system.monitor.stun, 6);
    await a.resistHazard('suffocation', 46);                          // 6 more: 12 Stun = full track + 2 Physical
    assert.deepEqual({ ...a.system.monitor }, { physical: 2, stun: 10 });
    t.after(off({ 'HEALTH_V923.drowning': 'test', 'HEALTH_V923.breathHold': 'none' }));
    const b = who({ name: 'Diver' });
    faces.push(1, 1, 1, 2);
    await b.resistHazard('drowning', 2);
    assert.match(chat.at(-1).content, /Drowning \(2 turns under\)/);
  });
  test('burning clothes: 6M after the first turn, +2 Power each turn after', async (t) => {
    const a = who({ name: 'Torch' });
    a.flags.sr2e = { onFire: { combatId: 'A', round: 1 } };
    const A = { id: 'A', started: true, round: 2, combatants: [{ actor: a }], scene: null };
    g.game.combats = { get: (id: string) => (id === 'A' ? A : undefined) };
    ones(4);
    await SR2Actor.burningTick(a, 2, 'A');
    assert.ok(chat.some((c: any) => /Resist 6M physical/.test(c.content)));
    ones(4);
    await SR2Actor.burningTick(a, 3, 'A');
    assert.ok(chat.some((c: any) => /Resist 8M physical/.test(c.content)));
    t.after(off({ 'HEALTH_V923.burning': 'flat' }));
    let burned = 0;
    a.resistHazard = async () => { burned++; };
    await SR2Actor.burningTick(a, 4, 'A');
    assert.equal(burned, 1);
  });
});

describe('v0.92.3 shock weapons (HEALTH_V923.shock; Core p. 103)', () => {
  test('a stun weapon marks the hit; the target is disoriented, +2 to every TN, for Power − ½ impact − successes turns', async (t) => {
    const shooter = who({ name: 'Cop' });
    const taser = { id: 't', name: 'Taser', system: { melee: false, skill: 'Firearms', damagePower: 10, damageLevel: 'S', damageType: 'physical', modes: 'SA', ammo: 4, ammoMax: 4, recoilComp: 0, stunWeapon: true } };
    assert.equal(shooter.planAttack(taser, { range: 'short' }).extras.shock, true);
    const a = who({ name: 'Mark' }, [{ id: 'arm', type: 'armor', name: 'Vest', system: { worn: true, ballistic: 4, impact: 4 } }]);
    ones(4);                                                          // soak: Body 4 vs 10 − 2
    faces.push(5, 1, 1, 1, 1);                                        // Willpower 5 (higher) vs 4: 1 success
    await a.resistFromState({ targetUuid: a.uuid, melee: false, damageType: 'stun', power: 10, level: 'S', armorKind: 'impact', armorMultiplier: 0.5, shock: true } as any, 0);
    const fx = (a.getFlag('sr2e', 'powerEffects') ?? []).find((e: any) => e.id === 'shockDisoriented923');
    assert.ok(fx);
    assert.equal(fx.testsTn, 2);
    assert.match(chat.at(-1).content, /disoriented by the shock for 7 Combat Turns/);   // 10 − 2 − 1
    assert.ok(a.previewModifiers().some((m: any) => m.value === 2 && /Disoriented/.test(String(m.label))));
    t.after(off({ 'HEALTH_V923.shock': 'none' }));
    const b = who({ name: 'Mark' });
    ones(4);
    await b.resistFromState({ targetUuid: b.uuid, melee: false, damageType: 'stun', power: 10, level: 'S', armorKind: 'impact', armorMultiplier: 0.5, shock: true } as any, 0);
    assert.equal((b.getFlag('sr2e', 'powerEffects') ?? []).length, 0);
  });
});

describe('v0.92.3 toxins and gear (HEALTH_V923.respirator, dwarfResistance; Core p. 244, p. 186)', () => {
  test('a worn respirator is its own air: inhaled toxins have no effect', async (t) => {
    const resp = { id: 'r', type: 'gear', name: 'Respirator', system: { quantity: 1, protection: { kind: 'respirator', rating: 2, worn: true } } };
    const a = who({ name: 'Masked' }, [resp]);
    await a.resistToxin({ name: 'Neuro-stun', vector: 'inhalation', power: 8, level: 'S', damageType: 'stun' });
    assert.match(chat.at(-1).content, /Respirator: Neuro-stun has no effect/);
    t.after(off({ 'HEALTH_V923.respirator': 'dice' }));
    ones(6);
    await a.resistToxin({ name: 'Neuro-stun', vector: 'inhalation', power: 8, level: 'S', damageType: 'stun' });
    assert.match(chat.at(-1).content, /Respirator 2 \+2/);
  });
  test('a dwarf\'s extra dice count against disease only', async (t) => {
    const d = who({ name: 'Dwarf', metatype: 'dwarf' });
    assert.equal(d.system.derived.toxinDice, 0);
    assert.equal(d.system.derived.raceDiseaseDice, 2);
    ones(5);
    await d.resistToxin({ name: 'Narcoject', vector: 'injection', power: 6, level: 'D', damageType: 'stun' });
    assert.match(chat.at(-1).content, /5 dice vs TN/);                // Body 5, no racial dice
    ones(7);
    await d.resistToxin({ name: 'VITAS-3', vector: 'inhalation', power: 6, level: 'D', damageType: 'physical', kind: 'disease' });
    assert.match(chat.at(-1).content, /7 dice vs TN/);
    t.after(off({ 'HEALTH_V923.dwarfResistance': 'both' }));
    d.system.prepareDerivedData();
    assert.equal(d.system.derived.toxinDice, 2);
    assert.equal(d.system.derived.raceDiseaseDice, 0);
  });
  test('still exposed: the GM\'s button posts a fresh card for everyone on it', async () => {
    const gm = who({ name: 'GM' });
    const a = who({ name: 'Victim' });
    const gas = { id: 'g', type: 'gear', name: 'Neuro-stun', system: { quantity: 1, toxin: { kind: 'toxin', vector: 'inhalation', power: 6, level: 'S', damageType: 'stun', speed: 'turn', effect: '' } } };
    await gm.exposeTo(gas, [a.uuid]);
    assert.match(chat.at(-1).content, /data-sr2e-action="reexposeToxin923"/);
  });
});

describe('v0.92.3 addiction by Shadowtech (HEALTH_V923.addiction; Shadowtech pp. 87–89)', () => {
  const H = 3600;
  const drug = (extra: any = {}) => ({ id: 'j', type: 'gear', name: 'Jazz', system: { quantity: 5, carried: true, toxin: { kind: 'drug', vector: 'inhalation', power: 0, level: 'L', damageType: 'stun', speed: 'immediate', effect: '', attributes: {}, reaction: 2, initiativeDice: 1, extra: {}, durationMinutes: 10, crashPower: 0, crashLevel: '', addiction: 4, addictionType: 'mental', tolerance: 0, strength: 0, ...extra } } });
  test('a mental addict needs a dose every Willpower × 4 hours; then forced withdrawal, +3 and the pain of Moderate Stun', async (t) => {
    const a = who({ name: 'Junkie' }, [drug()]);                      // Willpower 5: 20 hours
    ones(5);
    await a.takeDrug('j');
    assert.equal(a.system.addictions[0].addicted, true);
    assert.match(chat.at(-1).content, /every 20 hours/);
    g.game.actors = [a];
    await SR2Actor.timedEffects({ worldTime: 19 * H, anyGm: true });
    assert.equal(a.system.addictions[0].withdrawalNoted, false);
    await SR2Actor.timedEffects({ worldTime: 21 * H, anyGm: true });
    assert.equal(a.system.addictions[0].withdrawalNoted, true);
    g.game.time.worldTime = 21 * H;
    const mods = a.previewModifiers();
    assert.ok(mods.some((m: any) => /Withdrawal/.test(String(m.label)) && m.value === 3));
    assert.ok(mods.some((m: any) => /Moderate Stun/.test(String(m.label)) && m.value === 2));
    assert.ok(a.previewModifiers({ magical: true }).some((m: any) => /Withdrawal/.test(String(m.label)) && m.value === 6));
    t.after(off({ 'HEALTH_V923.addiction': 'old' }));
    const o = a.previewModifiers();
    assert.ok(!o.some((m: any) => /Withdrawal/.test(String(m.label))));   // 21 h: before the old 24 hours
  });
  test('kicking it: Willpower vs the rating +1 at any time, then recovery (+2) while the rating falls 1 every 3 days', async () => {
    const a = who({ name: 'Junkie' }, [drug({ strength: 1 })]);       // every dose adds +1
    ones(5);
    await a.takeDrug('j');
    assert.equal(a.system.addictions[0].rise, 1);
    assert.match(chat.at(-1).content, /Willpower vs 5/);              // the character's rating: 4 + 1
    faces.push(6, 1, 1, 1, 1, 1);                                     // vs 5 + 1 = 6: one success
    await a.drugAddictionTest('Jazz', 'kick');
    assert.match(chat.at(-1).content, /Willpower vs 5 \+1/);
    assert.ok(a.system.addictions[0].recovering >= 0);
    assert.ok(a.previewModifiers().some((m: any) => /Withdrawal/.test(String(m.label)) && m.value === 2));
    g.game.actors = [a];
    await SR2Actor.timedEffects({ worldTime: 2 * 86400, anyGm: true });
    assert.equal(a.system.addictions[0].addicted, true);
    await SR2Actor.timedEffects({ worldTime: 3 * 86400, anyGm: true });
    assert.equal(a.system.addictions[0].addicted, false);
    assert.match(chat.at(-1).content, /no longer addicted to Jazz/);
  });
  test('tolerance: no successes on Body vs the Tolerance rating, and the drug never works again', async () => {
    const a = who({ name: 'User' }, [drug({ addiction: 2, tolerance: 6 })]);
    fives(5);                                                         // addiction: Willpower vs 2, fine
    ones(4);                                                          // tolerance: Body 4 vs 6, none
    await a.takeDrug('j');
    assert.equal(a.system.addictions[0].immune, true);
    const before = a.system.drugs.length;
    await a.takeDrug('j');
    assert.match(chat.at(-1).content, /immune to it, it has no effect/);
    assert.equal(a.system.drugs.length, before);
  });
});
