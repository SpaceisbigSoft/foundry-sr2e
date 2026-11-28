/**
 * v0.99.0 cyberware and bioware (RULES.WARE_V99): the Foundry side with the stubs of v096-health-glue.test.ts: the model
 * (orthoskin and plating, cyberlimb Strength and Essence, the sheet warnings), the documents (bioware recovery after
 * surgery, the trauma damper on Stun, leading with a cyberlimb), and the install hooks (applications/ware99.ts); for
 * each switch, that 'v980' gives the v0.98.0 behaviour.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { WARE_V980_WAY } from '../rules/__tests__/ware980.ts';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Until the lead merges the i18n draft into public/lang/en.json: its English (no draft, no harm).
{
  const file = join('i18n-drafts', 'ware99.json');
  if (existsSync(file)) {
    const en = ((globalThis as any).__SR2E_EN__ ??= {});
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(file, 'utf8')))) if (!(k in en)) en[k] = v;
  }
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
  a.uuid = `Actor.w99-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}


const PLAYER = () => ({ id: 'p1', name: 'Player', isGM: false, can: () => true });
let WG: any;
before(async () => { WG = await import('../applications/ware99.ts'); });
function world(...actors: any[]) {
  g.game.actors = Object.assign([...actors], { get: (id: string) => actors.find((a) => a.id === id) });
  g.game.messages = Object.assign(chat, { contents: chat, get: (id: string) => chat.find((m) => m.id === id) });
}
beforeEach(() => { world(); });
const cw = (id: string, name: string, system: Record<string, any> = {}) => ({ id, type: 'cyberware', name,
  flags: {} as any, getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; }, async setFlag(s: string, k: string, v: any) { ((this.flags ??= {})[s] ??= {})[k] = v; },
  system: { essenceCost: 0, grade: 'standard', installed: true, bioware: false, kind: 'other', rating: 0, attributes: {}, reaction: 0, initiativeDice: 0, armorBallistic: 0, armorImpact: 0, housedIn: '', ...system } });
const bio = (id: string, bioKind: string, rating: number, more: Record<string, any> = {}) => cw(id, bioKind, { bioware: true, bioKind, rating, bodyIndex: 0.4, ...more });
const arm = (strength: number, quickness: number, location = 'rightArm') => cw(`arm-${location}`, 'Cyberarm', { kind: 'cyberlimb', essenceCost: 1, limb: { location, strength, quickness, capacity: 1 } });
const warnText = (a: any) => (a.system.derived.cyberWarnings as string[]).join('\n');

describe('v0.99.0 ware glue: orthoskin and dermal plating in the model', () => {
  test('plating 2 beats orthoskin 3: no orthoskin armor, the plating\'s Body stays; the sheet says which counts', (t) => {
    const a = who({}, [cw('dp', 'Dermal plating 2', { rating: 2, essenceCost: 1 }), bio('os', 'orthoskin', 3, { bodyIndex: 1.5 })]);
    assert.equal(a.system.attributes.body.total, 6);
    assert.deepEqual(a.system.derived.cyberArmor, { ballistic: 0, impact: 0 });
    assert.match(warnText(a), /only Dermal plating 2 counts, orthoskin gives nothing/);
    assert.doesNotMatch(warnText(a), /don't stack/, 'the old warning is replaced');
    t.after(oldWay(WARE_V980_WAY));
    a.system.prepareDerivedData();
    assert.equal(a.system.attributes.body.total, 6);
    assert.deepEqual(a.system.derived.cyberArmor, { ballistic: 1, impact: 2 }, 'v0.98.0: both count');
    assert.match(warnText(a), /don't stack/);
  });
  test('orthoskin 3 beats plating 1: the plating\'s Body and dermal level go', () => {
    const a = who({}, [cw('dp', 'Dermal plating 1', { rating: 1, essenceCost: 0.5 }), bio('os', 'orthoskin', 3, { bodyIndex: 1.5 })]);
    assert.equal(a.system.attributes.body.total, 4);
    assert.equal(a.system.derived.cyber.dermal, 0);
    assert.deepEqual(a.system.derived.cyberArmor, { ballistic: 1, impact: 2 });
  });
});

describe('v0.99.0 ware glue: cyberlimbs', () => {
  test('a Strength 7 arm costs .4 Essence more; the derived limb and the attack use the book Strength', (t) => {
    const a = who({}, [arm(7, 4)]);
    assert.equal(a.system.derived.essence, 4.6);
    assert.equal(a.system.derived.cyber.limbs[0].strength, 7);
    assert.equal(a.system.derived.cyber.limbs[0].essence99, 0.4);
    t.after(oldWay(WARE_V980_WAY));
    a.system.prepareDerivedData();
    assert.equal(a.system.derived.essence, 5);
  });
  test('a troll\'s cyberarm entered at 4 has Strength 8 on attacks made with it', (t) => {
    const a = who({ metatype: 'troll' }, [arm(4, 4)]);
    assert.equal(a.system.derived.cyber.limbs[0].strength, 8);
    assert.equal(a.attackStrength('arm-rightArm').strength, 8);
    t.after(oldWay(WARE_V980_WAY));
    a.system.prepareDerivedData();
    assert.equal(a.attackStrength('arm-rightArm').strength, 4);
  });
  test('leading with a stronger arm in melee: + (limb − four limbs\' average) TN; v980: none', (t) => {
    // Strength 4 natural; a Strength 8 arm: (8 + 4 + 4 + 4) / 4 = 5 → +3.
    const a = who({}, [arm(8, 4)]);
    const p = a.previewAttack(SR2Actor.unarmed(), { limbId: 'arm-rightArm' });
    const m = p.modifiers.find((x: any) => x.id === 'limbLead99');
    assert.equal(m?.value, 3);
    assert.match(m.label, /Leading with Cyberarm \(four limbs' average Strength 5\)/);
    assert.equal(a.previewAttack(SR2Actor.unarmed(), {}).modifiers.some((x: any) => x.id === 'limbLead99'), false, 'no limb, no TN');
    t.after(oldWay(WARE_V980_WAY));
    assert.equal(a.previewAttack(SR2Actor.unarmed(), { limbId: 'arm-rightArm' }).modifiers.some((x: any) => x.id === 'limbLead99'), false);
  });
  test('the average cap warning (twice Body or Body + 4)', () => {
    const a = who({}, [arm(12, 4, 'leftArm'), { ...arm(12, 4, 'rightArm') }], { body: 2, quickness: 5, strength: 4, charisma: 4, intelligence: 5, willpower: 5 });
    assert.match(warnText(a), /average Strength 8 is over the cap of 4/);
  });
});

describe('v0.99.0 ware glue: boosted reflexes on the sheet', () => {
  test('boosted reflexes with a control rig: a warning; the rig keeps its level', (t) => {
    const a = who({}, [cw('br', 'Boosted reflexes 1', { initiativeDice: 1 }), cw('vcr', 'Vehicle control rig 1', { controlRig: 1, essenceCost: 2 })]);
    assert.match(warnText(a), /Boosted reflexes 1 and Vehicle control rig 1 are both installed/);
    t.after(oldWay(WARE_V980_WAY));
    a.system.prepareDerivedData();
    assert.doesNotMatch(warnText(a), /both installed/);
  });
});

describe('v0.99.0 ware glue: bioware surgery recovery', () => {
  const biotech = { id: 'bt', type: 'skill', name: 'Biotech', system: { rating: 5, attribute: 'intelligence', kind: 'active', specialization: '', specializationRating: 0 } };
  test('bioware recovers × 3 (Body Cost .4, 2 successes: 2 days → 6); cultured × 2; v980: 2', async (t) => {
    const doc = who({}, [biotech]);
    const run = async (more: Record<string, any>) => {
      const p = who({}, [bio('ma', 'muscleAugmentation', 1, { installed: false, ...more })]);
      world(doc, p);
      faces.push(5, 5, 1, 1, 1);
      await p.surgery('ma', { surgeon: doc, care: 'hospital', pay: false });
      const r = p.system.recovering.find((x: any) => x.itemId === 'ma');
      return Math.round((r.until - Number(g.game.time.worldTime ?? 0)) / 86400);
    };
    assert.equal(await run({}), 6);
    assert.equal(await run({ cultured: true }), 4);
    t.after(oldWay(WARE_V980_WAY));
    assert.equal(await run({}), 2);
  });
});

describe('v0.99.0 ware glue: the trauma damper on Stun', () => {
  test('one box off whatever its rating; with a pain editor none; v980: the rating', async (t) => {
    const stunHit = async (items: any[]) => {
      const a = who({}, items);
      faces.push(1, 1, 1, 1);
      await a.resistDamage({ power: 6, level: 'S', armor: 0, type: 'stun' });
      return a.system.monitor.stun;
    };
    assert.equal(await stunHit([]), 6);
    assert.equal(await stunHit([bio('td', 'traumaDamper', 3)]), 5);
    assert.equal(await stunHit([bio('td', 'traumaDamper', 1), bio('pe', 'painEditor', 1)]), 6);
    t.after(oldWay(WARE_V980_WAY));
    assert.equal(await stunHit([bio('td', 'traumaDamper', 3)]), 3);
    assert.equal(await stunHit([bio('td', 'traumaDamper', 1), bio('pe', 'painEditor', 1)]), 5);
  });
});

describe('v0.99.0 ware glue: the install hooks', () => {
  const setup = () => {
    const a = who({}, [cw('br', 'Boosted reflexes 2', { reaction: 1, initiativeDice: 1 }), cw('wr', 'Wired reflexes 1', { installed: false, reaction: 2, initiativeDice: 1 })]);
    return { a, wr: a.items.get('wr') };
  };
  test('a player switching wired reflexes on beside boosted reflexes: refused with a warning; the rest goes through', () => {
    const { wr } = setup();
    g.game.users = Object.assign([GM(), PLAYER()], { get: (id: string) => (id === 'gm1' ? GM() : PLAYER()), activeGM: { id: 'gm1', isSelf: false } });
    WG.registerWare99();
    const pre = hooks.get('preUpdateItem')!.at(-1)!;
    assert.equal(pre(wr, { system: { installed: true } }, {}, 'p1'), false);
    assert.match(warnings.at(-1)!, /Wired reflexes 1 can.{1,6}t go in beside Boosted reflexes 2/);
    const change: any = { name: 'Wired reflexes (alpha)', system: { installed: true, rating: 1 } };
    assert.equal(WG.preUpdateWare(wr, change, 'p1'), undefined);
    assert.deepEqual(change, { name: 'Wired reflexes (alpha)', system: { rating: 1 } });
    const gmChange: any = { system: { installed: true } };
    assert.equal(WG.preUpdateWare(wr, gmChange, 'gm1'), undefined, 'a GM is only warned');
    assert.equal(gmChange.system.installed, true);
  });
  test('created installed by a player: created uninstalled; a GM: as it is', () => {
    const { a } = setup();
    g.game.users = Object.assign([GM(), PLAYER()], { get: (id: string) => (id === 'gm1' ? GM() : PLAYER()) });
    const made: any = { type: 'cyberware', name: 'Vehicle control rig 2', system: { controlRig: 2, installed: true }, parent: a, updateSource(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); } };
    WG.preCreateWare(made, { system: { installed: true } }, 'p1');
    assert.equal(made.system.installed, false);
    const byGm: any = { ...made, system: { controlRig: 2, installed: true }, updateSource: made.updateSource };
    WG.preCreateWare(byGm, { system: { installed: true } }, 'gm1');
    assert.equal(byGm.system.installed, true);
  });
  test('the surgery button refuses a player, warns a GM; v980: nothing', (t) => {
    const { wr } = setup();
    g.game.user = PLAYER();
    assert.equal(WG.surgeryClash(wr), true);
    g.game.user = GM();
    assert.equal(WG.surgeryClash(wr), false);
    assert.equal(warnings.length, 2);
    t.after(oldWay(WARE_V980_WAY));
    g.game.user = PLAYER();
    assert.equal(WG.surgeryClash(wr), false);
    assert.equal(WG.preUpdateWare(wr, { system: { installed: true } }, 'p1'), undefined);
  });
});
