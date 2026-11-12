/**
 * v0.92.1: the flexible record sheet's glue: custom tweaks in the derived data and attacks, Carried (weight, armor,
 * searches, use), the description's accessories on SR2Item, the rating lock with the approval queue, the advising
 * wizard and the sheets' wiring. Stubs as in v0920.test.ts.
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

let CharacterDataModel: any, SR2Actor: any, SR2Item: any;

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
      mergeObject: (a: any, b: any) => { const out = JSON.parse(JSON.stringify(a ?? {})); const m = (x: any, y: any) => { for (const [k, v] of Object.entries(y ?? {})) { if (v && typeof v === 'object' && !Array.isArray(v) && x[k] && typeof x[k] === 'object') m(x[k], v); else x[k] = v; } }; m(out, b); return out; },
      randomID: () => Math.random().toString(36).slice(2, 12), deepClone: (o: any) => JSON.parse(JSON.stringify(o)), flattenObject: flatten,
      getProperty: (o: any, p: string) => p.split('.').reduce((x: any, k: string) => x?.[k], o),
    },
    applications: { api: { DialogV2: { confirm: async () => false, prompt: async () => null, wait: async () => null }, HandlebarsApplicationMixin: (B: any) => B, ApplicationV2: class {} }, instances: new Map() },
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
  ({ SR2Actor, SR2Item } = await import('../documents/index.ts'));
  // The Add window registers how a shop purchase makes its items.
  await import('../applications/adding.ts');
  g.CONFIG = { Actor: { documentClass: SR2Actor } };
});

beforeEach(() => {
  faces.length = 0; chat.length = 0; warnings.length = 0; infos.length = 0; created.length = 0; settings = {};
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
  a.uuid = `Actor.v91-${++n}`; a.id = `id${n}`;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}

/** Run with a RULES path changed, put back afterwards. */
async function withRule<T>(obj: any, key: string, value: unknown, fn: () => T | Promise<T>): Promise<T> {
  const prev = obj[key];
  obj[key] = value;
  try { return await fn(); } finally { obj[key] = prev; }
}



// ---------------------------------------------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const lang = JSON.parse(read('public', 'lang', 'en.json'));
const keyIn = (k: string) => k.split('.').reduce((o: any, p) => o?.[p], lang) !== undefined;
const SRC = (f: string) => read('src', 'module', ...f.split('/'));

const S921 = RULES.SHEET_V921 as any;
const GUN = (extra: any = {}) => ({ id: 'gun', type: 'weapon', name: 'ZZ Pistol', system: { melee: false, skill: 'Firearms', damagePower: 9, damageLevel: 'M', damageType: 'physical', range: { short: 5, medium: 20, long: 40, extreme: 60 }, modes: 'SA', ammo: 10, ammoMax: 10, ready: true, ...extra } });

describe('v0.92.1 custom tweaks in the derived data', () => {
  test('installed ware with tweaks: an attribute, Reaction, initiative dice, the Combat Pool and armor', () => {
    const tw = [
      { id: 'a', target: 'attribute', key: 'quickness', value: 1, on: true, label: 'Tuned' },
      { id: 'b', target: 'reaction', value: 1, on: true }, { id: 'c', target: 'initiativeDice', value: 1, on: true },
      { id: 'd', target: 'pool', key: 'combat', value: 2, on: true }, { id: 'e', target: 'armor', key: 'ballistic', value: 1, on: true },
    ];
    const base = who({ name: 'Base' });
    const a = who({ name: 'Tweaked' }, [{ id: 'w1', type: 'cyberware', name: 'ZZ Ware', system: { installed: true, essenceCost: 0, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0, tweaks: tw } }]);
    assert.equal(a.system.attributes.quickness.total, base.system.attributes.quickness.total + 1);
    // Reaction (Q + I) / 2: 5 → (6 + 5) / 2 = 5, then the tweak's +1.
    assert.equal(a.system.derived.reaction, base.system.derived.reaction + 1);
    assert.equal(a.system.derived.initiativeDice, base.system.derived.initiativeDice + 1);
    // The Combat Pool (Q + I + W) / 2: 7 → 8 with Quickness 6, then the tweak's +2.
    assert.equal(a.system.derived.combatPool, base.system.derived.combatPool + 3);
    assert.equal(a.system.derived.cyberArmor.ballistic, base.system.derived.cyberArmor.ballistic + 1);
    assert.equal(a.system.derived.tweaks.list.length, 5);
  });
  test('uninstalled ware, a tweak switched off and the house rule off add nothing', async () => {
    const tw = [{ id: 'a', target: 'attribute', key: 'body', value: 2, on: true }];
    const off = who({}, [{ id: 'w1', type: 'cyberware', name: 'ZZ Ware', system: { installed: false, essenceCost: 0, grade: 'standard', attributes: {}, tweaks: tw } }]);
    assert.equal(off.system.attributes.body.total, A.body);
    const unticked = who({}, [{ id: 'g1', type: 'gear', name: 'ZZ Charm', system: { quantity: 1, tweaks: [{ ...tw[0], on: false }] } }]);
    assert.equal(unticked.system.attributes.body.total, A.body);
    await withRule(S921, 'tweaks', 'off', () => {
      const r = who({}, [{ id: 'g1', type: 'gear', name: 'ZZ Charm', system: { quantity: 1, tweaks: tw } }]);
      assert.equal(r.system.attributes.body.total, A.body);
      assert.equal(r.system.derived.tweaks.list[0].active, false);
    });
  });
  test('a skill tweak on carried gear joins the skill bonuses; left behind, it doesn\'t', () => {
    const g = (carried: boolean) => who({}, [{ id: 'g1', type: 'gear', name: 'ZZ Lenses', system: { quantity: 1, carried, tweaks: [{ id: 'a', target: 'skillDice', key: 'Firearms', value: 2, on: true, label: 'Lenses' }] } }]);
    assert.ok(g(true).system.derived.cyber.skillMods.some((m: any) => m.mods[0].skill === 'Firearms' && m.mods[0].dice === 2));
    assert.ok(!g(false).system.derived.cyber.skillMods.some((m: any) => m.mods[0].skill === 'Firearms'));
  });
  test('a weapon\'s own Power tweak and an every-attack tweak raise the attack\'s Power', () => {
    const plain = who({}, [GUN()]);
    const tweaked = who({}, [GUN({ tweaks: [{ id: 'a', target: 'damage', key: 'self', value: 2, on: true }] }), { id: 'g1', type: 'gear', name: 'ZZ Charm', system: { quantity: 1, tweaks: [{ id: 'b', target: 'damage', key: 'ranged', value: 1, on: true }] } }]);
    const p0 = plain.planAttack(plain.items.get('gun'), {});
    const p1 = tweaked.planAttack(tweaked.items.get('gun'), {});
    assert.equal(p1.power, p0.power + 3);
    assert.ok(p1.notes.some((n: string) => /custom tweak Power \+3/.test(n)));
  });
});

describe('v0.92.1 Carried', () => {
  test('left behind: no weight, armor doesn\'t count, a search doesn\'t find it', () => {
    const heavy = (carried: boolean) => who({}, [{ id: 'g1', type: 'gear', name: 'ZZ Anvil', system: { quantity: 1, weight: 200, carried } }]);
    assert.ok(heavy(true).system.derived.load.penalty > 0);
    assert.equal(heavy(false).system.derived.load.penalty, 0);
    const vest = (carried: boolean) => who({}, [{ id: 'ar', type: 'armor', name: 'ZZ Vest', system: { ballistic: 9, impact: 9, worn: true, carried } }]);
    // v0.92.3 (COMBAT_V923.armorPenalty 'pool', Dice Pools p. 85): heavy armor costs Combat Pool dice, not Quickness.
    assert.ok(vest(true).system.derived.combatPool < vest(false).system.derived.combatPool);
    const undo = oldWay({ 'COMBAT_V923.armorPenalty': 'quickness' });
    try {
      assert.ok(vest(true).system.derived.encumbrance > 0);
      assert.equal(vest(false).system.derived.encumbrance, 0);
    } finally { undo(); }
    const a = who({}, [GUN({ carried: false, concealability: 5 }), { id: 'k', type: 'weapon', name: 'ZZ Knife', system: { melee: true, concealability: 8 } }]);
    assert.deepEqual(a.carriedItems().map((i: any) => i.name), ['ZZ Knife']);
  });
  test('a weapon left behind can\'t attack', async () => {
    const a = who({}, [GUN({ carried: false })]);
    const r = await a.attackWith(a.items.get('gun'), {});
    assert.equal(r, null);
    assert.ok(warnings.some((w) => /isn.t carried/.test(w)), warnings.join(' | '));
  });
  test('leaving it behind takes armor off and holsters a weapon; wearing or drawing it brings it along', () => {
    const ch1: any = { carried: false };
    SR2Item.carriedRules('armor', { worn: true, carried: true }, ch1);
    assert.deepEqual(ch1, { carried: false, worn: false });
    const ch2: any = { carried: false };
    SR2Item.carriedRules('weapon', { ready: true, supportSetUp: true }, ch2);
    assert.deepEqual(ch2, { carried: false, ready: false, supportSetUp: false });
    const ch3: any = { worn: true };
    SR2Item.carriedRules('armor', { worn: false, carried: false }, ch3);
    assert.deepEqual(ch3, { worn: true, carried: true });
    const ch4: any = { carried: false };
    SR2Item.carriedRules('gear', { optics: { worn: true }, chip: { slotted: true } }, ch4);
    assert.deepEqual(ch4, { carried: false, optics: { worn: false }, chip: { slotted: false } });
    const ch5: any = { carried: false };
    assert.equal(SR2Item.carriedRules('cyberware', {}, ch5), 0, 'ware is never left behind');
    withRule(S921, 'carried', 'off', () => { const c: any = { carried: false }; SR2Item.carriedRules('armor', { worn: true }, c); assert.deepEqual(c, { carried: false }); });
  });
});

describe('v0.92.1 accessories read on SR2Item', () => {
  test('a new description fills the defaults, adds notes and a record; a value this edit sets wins', () => {
    const changed: any = { system: { description: '<p>Gas-vent 2, laser sight, folding stock.</p>', laserSight: false } };
    SR2Item.readDescriptionInto(changed, { recoilComp: 0, laserSight: false, tweaks: [] }, null);
    assert.equal(changed.system.recoilComp, 2);
    assert.equal(changed.system.laserSight, false, 'set by hand in the same edit');
    assert.deepEqual(changed.system.tweaks.map((t: any) => t.id), ['accfoldingStock']);
    assert.equal(changed.system.tweaks[0].target, 'note');
    assert.match(changed.system.tweaks[0].label, /From the description: Folding stock/);
    const rec = changed.flags.sr2e.fromDescription;
    assert.deepEqual(rec.fields.recoilComp, { id: 'gasVent', value: 2, before: 0, text: 'Gas-vent 2' });
    assert.deepEqual(rec.noted, ['foldingStock']);
  });
  test('an undone accessory and an existing note are not read again; the house rule off reads nothing', async () => {
    const changed: any = { system: { description: 'laser sight and a folding stock' } };
    SR2Item.readDescriptionInto(changed, { laserSight: false }, { fields: {}, dismissed: ['laserSight'], noted: ['foldingStock'] });
    assert.equal(changed.system.laserSight, undefined);
    assert.equal(changed.flags, undefined);
    await withRule(S921, 'accessories', 'off', () => {
      const c: any = { system: { description: 'laser sight' } };
      SR2Item.readDescriptionInto(c, { laserSight: false }, null);
      assert.equal(c.system.laserSight, undefined);
    });
  });
});

describe('v0.92.1 the rating lock follows the approval queue', () => {
  let adv: any;
  before(async () => { adv = await import('../applications/advancement.ts'); });
  test('queue off: a player\'s typed raise is kept, with a notice; queue on: refused; \'always\': refused', async () => {
    const a = who({ name: 'Done' });
    a.flags.sr2e = { creation: { v: 1, finishedAt: 'x', attributes: {} } };
    g.game.user = { id: 'player', name: 'P', isGM: false };
    settings['approvalQueue'] = false;
    const ch: Record<string, unknown> = { 'system.attributes.body.base': 6 };
    assert.deepEqual(adv.refuseLockedRaises(a, 'actor', ch), []);
    assert.deepEqual(Object.keys(ch), ['system.attributes.body.base']);
    assert.ok(infos.some((m) => /no Karma was spent/.test(m)));
    settings['approvalQueue'] = true;
    assert.deepEqual(adv.refuseLockedRaises(a, 'actor', { 'system.attributes.body.base': 6 }), ['system.attributes.body.base']);
    settings['approvalQueue'] = false;
    await withRule(S921, 'ratingLock', 'always', () => assert.deepEqual(adv.refuseLockedRaises(a, 'actor', { 'system.attributes.body.base': 6 }), ['system.attributes.body.base']));
  });
});

describe('v0.92.1 wiring: sheets, wizard, shop, reference, language', () => {
  test('the Combat tab is called Armory; the item sheet has the tweak rows, Carried, the grade line and Undo', () => {
    assert.match(SRC('applications/sheets.ts'), /\{ id: "combat", label: tx\('SR2E\.App\.Sheets\.armory'\) \}/);
    assert.equal(lang.SR2E.App.Sheets.armory, 'Armory');
    const t = read('public', 'templates', 'item-sheet.hbs');
    for (const s of ['data-action="addTweak"', 'data-action="deleteTweak"', 'name="tweak.{{index}}.target"', 'name="system.carried"', 'data-action="undoDescription"', 'gradeEssence.essence']) assert.ok(t.includes(s), s);
    const c = read('public', 'templates', 'actor-character-sheet.hbs');
    assert.equal((c.match(/data-action="toggleCarried"/g) ?? []).length, 3, 'weapons, armor, gear');
    assert.match(c, /\{\{#if essenceWare\}\} title="\{\{essenceWare\}\}"/);
    assert.match(read('public', 'templates', 'combat-column.hbs'), /\{\{#each weapons\}\}\{\{#unless leftBehind\}\}/);
  });
  test('the wizard advises: choices aren\'t greyed out and attributes aren\'t clamped unless the house rule says block', () => {
    const w = read('public', 'templates', 'creation-wizard.hbs');
    assert.equal((w.match(/\{\{#if @root\.blocks\}\}\{\{#unless allowed\}\}\{\{#unless selected\}\}disabled/g) ?? []).length, 2);
    const src = SRC('applications/creation.ts');
    assert.match(src, /RULES\.SHEET_V921\.wizard === 'block' \? Math\.min\(RULES\.CREATION\.attributeMax, n\) : n/);
    assert.match(SRC('applications/adding.ts'), /RULES\.SHEET_V921\.wizard === 'advise' && inCreation\(actor\)/);
  });
  test('the reference pane: a title-bar button, a drop that opens the shop, the API', () => {
    assert.match(SRC('applications/sheets.ts'), /if \(data\?\.type === REFERENCE_DRAG_TYPE\) return dropReferenceEntry\(this\.document, data\);/);
    assert.match(SRC('sr2e-system.ts'), /registerReference\(\);/);
    assert.match(SRC('sr2e-system.ts'), /reference: \(actor: any\) => openReference\(actor\)/);
    assert.ok(read('public', 'templates', 'reference.hbs').includes('data-ref-drag'));
  });
  test('every new house rule has its label; every new key a template names is in the language file', () => {
    for (const k of ['tweaks', 'carried', 'accessories', 'wizard', 'ratingLock']) assert.ok(keyIn(`SR2E.HouseRules.Rule.SHEET_V921__${k}`), k);
    const keys = [...read('public', 'templates', 'reference.hbs').matchAll(/sr2eT "([^"]+)"/g), ...read('public', 'templates', 'item-sheet.hbs').matchAll(/sr2eT "([^"]+)"/g)].map((m) => m[1]!);
    assert.deepEqual(keys.filter((k) => !keyIn(k)), []);
  });
});

describe('v0.92.1 review fixes (glue)', () => {
  test('negative tweaks never take initiative dice below 1 or Reaction below 0', () => {
    const a = who({}, [{ id: 'g1', type: 'gear', name: 'ZZ Curse', system: { quantity: 1, tweaks: [{ id: 'a', target: 'initiativeDice', value: -5, on: true }, { id: 'b', target: 'reaction', value: -20, on: true }] } }]);
    assert.equal(a.system.derived.initiativeDice, 1);
    assert.equal(a.system.derived.reaction, 0);
  });
  test('a Spell Pool tweak gives a mundane nothing', () => {
    const a = who({}, [{ id: 'g1', type: 'gear', name: 'ZZ Charm', system: { quantity: 1, tweaks: [{ id: 'a', target: 'pool', key: 'spell', value: 3, on: true }] } }]);
    assert.equal(a.system.derived.spellPool, 0);
  });
  test('left behind: no parry with it, no drug, no armor rating', async () => {
    const a = who({}, [{ id: 'k', type: 'weapon', name: 'ZZ Katana', system: { melee: true, carried: false } }, { id: 'ar', type: 'armor', name: 'ZZ Coat', system: { ballistic: 4, impact: 2, worn: true, carried: false } }]);
    assert.ok(!a.meleeWeapons().some((w: any) => w.name === 'ZZ Katana'));
    assert.equal(a.armorRating('ballistic'), a.sys?.derived?.cyberArmor?.ballistic ?? 0);
  });
  test('an edit reads only accessories it newly mentions; a copy already read isn\'t read again', () => {
    const c: any = { system: { description: 'smartgun link and a laser sight' } };
    SR2Item.readDescriptionInto(c, { smartgun: false, laserSight: false }, { fields: {}, dismissed: [], noted: [] }, { oldDescription: 'smartgun link' });
    assert.equal(c.system.smartgun, undefined, 'cleared by hand before: not ticked again');
    assert.equal(c.system.laserSight, true);
    assert.match(SRC('documents/index.ts'), /!data\?\.flags\?\.sr2e\?\.fromDescription\) \{/);
  });
  test('with the lock on, a player\'s new or stronger tweak is refused; a note or switching one off is fine', async () => {
    const adv: any = await import('../applications/advancement.ts');
    assert.equal(adv.tweaksRaise([], [{ id: 'a', target: 'note', label: 'x' }]), false);
    assert.equal(adv.tweaksRaise([], [{ id: 'a', target: 'attribute', key: 'body', value: 2, on: true }]), true);
    assert.equal(adv.tweaksRaise([{ id: 'a', target: 'attribute', key: 'body', value: 2, on: true }], [{ id: 'a', target: 'attribute', key: 'body', value: 2, on: false }]), false);
    assert.equal(adv.tweaksRaise([{ id: 'a', target: 'attribute', key: 'body', value: 2, on: true }], [{ id: 'a', target: 'attribute', key: 'body', value: 3, on: true }]), true);
    const a = who({ name: 'Locked' });
    a.flags.sr2e = { creation: { v: 1, finishedAt: 'x', attributes: {} } };
    g.game.user = { id: 'player', name: 'P', isGM: false };
    settings['approvalQueue'] = true;
    const skill = { type: 'skill', parent: a, system: { rating: 3, tweaks: [] } };
    const ch: Record<string, unknown> = { 'system.tweaks': [{ id: 'z', target: 'pool', key: 'combat', value: 9, on: true }] };
    assert.deepEqual(adv.refuseLockedRaises(skill, 'item', ch), ['system.tweaks']);
    assert.ok(!('system.tweaks' in ch));
  });
  test('the new tweak row is a note; a row whose kind changes drops its old key', () => {
    const s = SRC('applications/sheets.ts');
    assert.match(s, /target: "note", key: "", value: 0, on: true \}\] \}\);/);
    assert.match(s, /was && was !== target \? \{ key: "" \} : \{\}/);
  });
});
