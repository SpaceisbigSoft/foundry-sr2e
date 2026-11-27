import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Until the lead merges i18n-drafts/health96.json into public/lang/en.json: its English, for keys not there yet.
try {
  const draft = JSON.parse(readFileSync(fileURLToPath(new URL('../../../i18n-drafts/health96.json', import.meta.url)), 'utf8'));
  const en = ((globalThis as any).__SR2E_EN__ ??= {});
  for (const [k, v] of Object.entries(draft)) if (!(k in en)) en[k] = v;
} catch { /* merged already */ }

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
  a.uuid = `Actor.h96-${++n}`; a.id = `id${n}`;
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
let H96G: any;
before(async () => { H96G = await import('../applications/health96.ts'); });

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
const bio = (bioKind: string, more: any = {}) => ({ id: `b-${bioKind}`, type: 'cyberware', name: bioKind, system: { bioware: true, bioKind, installed: true, rating: 1, bodyIndex: 0.4, essenceCost: 0, ...more } });

beforeEach(() => { world(); dialogs({}); });

describe('v0.96.0 health glue: interrupted Stun rest (Core p. 112)', () => {
  test('the first rest is kept; a re-test with more successes counts only the first roll\'s', async () => {
    const a = pc({ monitor: { physical: 0, stun: 5 } }); world(a);
    faces.push(5, 1, 1, 1, 1);
    await a.naturalHeal({ track: 'stun', hours: 1, care: 'none' });
    assert.equal(a.system.monitor.stun, 4, '1 success: 1 hour a box');
    assert.deepEqual(a.getFlag(SYS, 'stunRest96'), { successes: 1 });
    faces.push(5, 5, 5, 5, 5);
    await a.naturalHeal({ track: 'stun', hours: 1, care: 'none' });
    assert.equal(a.system.monitor.stun, 3, 'capped at the first roll: still 1 box an hour');
    assert.match(String(a.getFlag(SYS, 'test') ?? '') + text(), /Interrupted rest/);
  });
  test('off: every rest is a fresh test (v0.95.1)', async (t) => {
    t.after(oldWay({ 'HEALTH_V96.stunRestInterrupted': 'off' }));
    const a = pc({ monitor: { physical: 0, stun: 5 } }); world(a);
    faces.push(5, 1, 1, 1, 1);
    await a.naturalHeal({ track: 'stun', hours: 1, care: 'none' });
    assert.equal(a.getFlag(SYS, 'stunRest96'), undefined);
    faces.push(5, 5, 5, 5, 5);
    await a.naturalHeal({ track: 'stun', hours: 1, care: 'none' });
    assert.equal(a.system.monitor.stun, 0);
  });
});

describe('v0.96.0 health glue: the rest card and medical costs (Core p. 113)', () => {
  test('the lifestyle line; the doctor\'s fee; DocWagon Platinum halves it', (t) => {
    const a = pc({ lifestyle: { level: 'low', paidUntil: 1e9, outright: false } });
    assert.match(H96G.restNote(a, { care: 'home', track: 'physical', before: 4 }), /minimum lifestyle/);
    assert.equal(H96G.restNote(a, { care: 'hospital', track: 'physical', before: 10 }), '');
    assert.equal(H96G.restCost(a, { care: 'medkit', hours: 24, track: 'physical', before: 4 }), 100);
    a.system.docwagon = { tier: 'platinum', paidUntil: 1e9, resuscitationsUsed: 0 };
    assert.equal(H96G.restCost(a, { care: 'hospital', hours: 24, track: 'physical', before: 4 }), 250);
    t.after(oldWay({ 'HEALTH_V96.medicalCosts': 'off', 'HEALTH_V96.docwagonExtendedCare': 'off', 'HEALTH_V96.healingLifestyle': 'off' }));
    assert.equal(H96G.restCost(a, { care: 'hospital', hours: 24, track: 'physical', before: 4 }), null);
    assert.equal(H96G.restNote(a, { care: 'home', track: 'physical', before: 4 }), '');
  });
  test('a paramedic\'s fee card: the player pays once from a GM card', async () => {
    const npc = who({ name: 'Medic', type: 'npc' });
    const a = pc({ nuyen: 1000 }); world(a, npc);
    await H96G.paramedicFee(npc, a, 4);
    const msg = last();
    assert.match(String(msg.content), /h96PayFee/);
    msg.author = GM();
    g.game.user = PLAYER();
    await H96G.onCard(msg, btn(), 'h96PayFee');
    assert.equal(a.system.nuyen, 900);
    await H96G.onCard(msg, btn(), 'h96PayFee');
    assert.equal(a.system.nuyen, 900, 'once per card');
  });
  test('a fee card a player posted can\'t charge', async () => {
    const npc = who({ name: 'Medic', type: 'npc' });
    const a = pc({ nuyen: 1000 }); world(a, npc);
    await H96G.paramedicFee(npc, a, 4);
    const msg = last(); msg.author = PLAYER();
    await H96G.onCard(msg, btn(), 'h96PayFee');
    assert.equal(a.system.nuyen, 1000);
  });
});

describe('v0.96.0 health glue: patches (Core pp. 186, 250)', () => {
  test('blood filtration: the stim patch does nothing', async () => {
    const a = pc({ monitor: { physical: 0, stun: 4 } }, [{ id: 'f1', type: 'cyberware', name: 'Blood filter', system: { installed: true, kind: 'filtration', filterKind: 'blood', rating: 2, essenceCost: 0 } }]); world(a);
    const out = await SR2Actor.patchEffect(a, { kind: 'stim', rating: 3, name: 'Stim' });
    assert.match(out, /blood filtration/);
    assert.equal(a.system.monitor.stun, 4);
  });
  test('a magician fails the stim patch\'s Magic test: the Magic loss card', async () => {
    const a = pc({ magic: 4, tradition: 'hermetic', monitor: { physical: 0, stun: 4 } }); world(a);
    faces.push(3, 3, 1, 1, 1, 1);
    await SR2Actor.patchEffect(a, { kind: 'stim', rating: 3, name: 'Stim' });
    const m = chat.find((x) => x.flags?.[SYS]?.magicLossFor === a.uuid);
    assert.ok(m, 'magic loss card');
  });
  test('off: no Magic test', async (t) => {
    t.after(oldWay({ 'HEALTH_V96.stimMagic': 'off' }));
    const a = pc({ magic: 4, tradition: 'hermetic', monitor: { physical: 0, stun: 4 } }); world(a);
    faces.push(3, 3);
    await SR2Actor.patchEffect(a, { kind: 'stim', rating: 3, name: 'Stim' });
    assert.equal(chat.some((x) => x.flags?.[SYS]?.magicLossFor), false);
  });
  test('an antidote patch on the dying: the GM stabilises them from the card', async () => {
    const a = pc({ monitor: { physical: 10, stun: 0 } }); world(a);
    assert.equal(a.system.derived.status, 'dying');
    await SR2Actor.patchEffect(a, { kind: 'antidote', rating: 3, name: 'Antidote' });
    const msg = chat.find((x) => x.flags?.[SYS]?.h96Antidote);
    assert.ok(msg);
    g.game.user = PLAYER();
    await H96G.onCard(msg, btn(), 'h96Stabilise');
    assert.equal(a.system.care.stabilised, false, 'a player can\'t');
    g.game.user = GM(); msg.author = GM();
    await H96G.onCard(msg, btn(), 'h96Stabilise');
    assert.equal(a.system.care.stabilised, true);
  });
});

describe('v0.96.0 health glue: bioware (Shadowtech pp. 26, 30)', () => {
  test('a pain editor\'s wearer is not knocked out by a full Stun track; off: unconscious', (t) => {
    const a = pc({ monitor: { physical: 0, stun: 10 } }, [bio('painEditor')]);
    assert.equal(a.system.derived.status, 'ok');
    t.after(oldWay({ 'HEALTH_V96.painEditor': 'off' }));
    a.system.prepareDerivedData();
    assert.equal(a.system.derived.status, 'unconscious');
  });
  test('neuro-stun: disoriented for an hour; the nephritic screen cuts a disease\'s Power', async () => {
    const a = pc({}, [bio('nephriticScreen')]); world(a);
    faces.push(...Array(40).fill(5));
    await a.resistToxin({ name: 'Neuro-Stun VIII', vector: 'inhalation', power: 6, level: 'S', damageType: 'stun' });
    const fx = (a.getFlag(SYS, 'powerEffects') ?? []).find((e: any) => e.id === 'neuroStun96');
    assert.ok(fx, 'the disorientation');
    assert.equal(fx.testsTn, 2);
    await a.resistToxin({ name: 'Flu', vector: 'contact', power: 5, level: 'M', damageType: 'physical', kind: 'disease' });
    assert.match(text(), /nephritic screen −1 Power/);
  });
});

describe('v0.96.0 health glue: DocWagon (Neo-Anarchist\'s Guide p. 95)', () => {
  test('the call rolls the unit and 3D6 minutes', async () => {
    const a = pc({ docwagon: { tier: 'platinum', paidUntil: 1e9, resuscitationsUsed: 0 } }); world(a);
    faces.push(5, 4, 4, 4);
    await a.callDocwagon();
    const m = chat.find((x) => x.flags?.[SYS]?.docwagon);
    assert.ok(m);
    assert.equal(m.flags[SYS].docwagon.arriveAt, 10 * 60, 'air: 12 − 2 minutes');
    assert.match(String(m.content), /by air/);
  });
  test('off: the contract\'s minutes', async (t) => {
    t.after(oldWay({ 'HEALTH_V96.docwagonResponse': 'off' }));
    const a = pc({ docwagon: { tier: 'platinum', paidUntil: 1e9, resuscitationsUsed: 0 } }); world(a);
    await a.callDocwagon();
    const m = chat.find((x) => x.flags?.[SYS]?.docwagon);
    assert.equal(m.flags[SYS].docwagon.arriveAt, Number(RULES.HEALTH_V61.docwagon.tiers.find((t: any) => t.id === 'platinum')!.responseMinutes) * 60);
  });
});

describe('v0.96.0 health glue: addiction (Shadowtech pp. 87–88)', () => {
  test('the weekly card; the GM takes the Essence', async () => {
    const a = pc({ addictions: [{ drug: 'Novacoke', rating: 4, type: 'physical', recent: [], lastDose: 0, addicted: true, dosesAddicted: 1, withdrawalNoted: false, attritionAt96: 100 }] }); world(a);
    const ad = a.system.addictions.map((x: any) => ({ ...x }));
    const changed = await H96G.addictionTick(a, ad, 200);
    assert.equal(changed, true);
    const msg = chat.find((x) => x.flags?.[SYS]?.h96Attrition);
    assert.ok(msg);
    msg.author = GM();
    await H96G.onCard(msg, btn(), 'h96Attrition');
    assert.equal(a.system.essenceShift, -0.5);
    await H96G.onCard(msg, btn(), 'h96Attrition');
    assert.equal(a.system.essenceShift, -0.5, 'once');
  });
  test('the tests when the dose wears off; at the dose with \'dose\'', async (t) => {
    const a = pc({ addictions: [{ drug: 'Novacoke', rating: 4, type: 'physical', recent: [], lastDose: 0, addicted: false, dosesAddicted: 0, withdrawalNoted: false }] }); world(a);
    faces.push(5, 5, 5, 5, 5, 5);
    await H96G.afterWearOff(a, 'Novacoke');
    assert.ok(chat.some((m) => m.flags?.[SYS]?.test?.addiction), 'an addiction test card');
    chat.length = 0;
    t.after(oldWay({ 'HEALTH_V96.addictionTiming': 'dose' }));
    await H96G.afterWearOff(a, 'Novacoke');
    assert.equal(chat.length, 0);
  });
});
