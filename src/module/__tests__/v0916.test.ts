/**
 * v0.91.6: finding through contacts and fixers. The pure rules (rules/fixers.ts), the find test with a contact's help
 * or a fixer's own find (documents/index.ts #findCore), the card (re-rolls, time, the fixer's cut, no Haggle), the
 * "Find through…" dialog's form (applications/through.ts), the contact form's new field, and the switch back to the
 * old way. Stubs as in v0915.test.ts.
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

let CharacterDataModel: any, SR2Actor: any;

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
  ({ CharacterDataModel } = await import('../models/index.ts'));
  ({ SR2Actor } = await import('../documents/index.ts'));
  // The Add window registers how a shop purchase makes its items.
  await import('../applications/adding.ts');
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
  a.uuid = `Actor.v91-${++n}`; a.id = `id${n}`;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness') => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0 } });

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

const shopper = (nuyen = 5000) => who({ name: 'Shopper', nuyen }, [skill('et', 'Etiquette', 4, 'charisma')]);

import {
  throughLegalMods, throughTimeFactor, fixerFeeOf, fixerDice, throughPlan, throughSuccesses, contactLevelTnMods, throughSuffix, isFixer,
  LEGAL_FIND_MOD,
} from '../rules/index.ts';

const RIFLE = { id: 't5', type: 'weapon', name: 'ZZ Rifle', system: { cost: 2000, availability: '4/48 hrs', streetIndex: 1, legality: 'restricted' } };
const CANNON = { id: 't6', type: 'weapon', name: 'ZZ Cannon', system: { cost: 10000, availability: '4/48 hrs', streetIndex: 1, legality: 'forbidden' } };
const BENNY = { id: 'c1', name: 'Benny', level: 2, loyalty: 2, fee: 50, dice: 3, favours: 0, fixer: false, role: '', notes: '', skills: '' };
const FIXIT = { id: 'f1', name: 'Fixit', level: 2, loyalty: 1, fee: 0, dice: 0, favours: 0, fixer: true, role: '', notes: '', skills: '' };
const withContacts = (nuyen = 5000, contacts: any[] = [BENNY, FIXIT]) => {
  const a = shopper(nuyen);
  a.system.contacts = contacts.map((c) => ({ ...c }));
  return a;
};

describe('v0.91.6 contacts and fixers: the rules (rules/fixers.ts)', () => {
  test('the legality row: halved through a contact, gone through a fixer; the time', () => {
    assert.equal(throughLegalMods('restricted', 'self')[0]!.value, 2);
    const h = throughLegalMods('restricted', 'help');
    assert.equal(h.length, 1); assert.equal(h[0]!.value, 1); assert.equal(h[0]!.id, LEGAL_FIND_MOD);
    assert.doesNotMatch(h[0]!.label, /found openly/, 'live run: the contact row names the category, not the open row');
    assert.equal(throughLegalMods('forbidden', 'help')[0]!.value, 2);
    assert.deepEqual(throughLegalMods('forbidden', 'fixer'), []);
    assert.deepEqual(throughLegalMods('legal', 'help'), []);
    assert.equal(throughTimeFactor('forbidden', 'self'), 2);
    assert.equal(throughTimeFactor('forbidden', 'help'), 2, 'a contact keeps the time');
    assert.equal(throughTimeFactor('forbidden', 'fixer'), 1.5, 'a fixer: no legality time, ×1.5 of their own');
    assert.equal(throughTimeFactor('', 'fixer'), 1.5);
  });
  test('the fixer\'s cut and dice', () => {
    assert.equal(fixerFeeOf(2000), 200);
    assert.equal(fixerFeeOf(-5), 0);
    assert.equal(fixerDice({ dice: 0, level: 2 }), 4);
    assert.equal(fixerDice({ dice: 7, level: 1 }), 7);
    assert.equal(fixerDice({ level: 9 } as any), 6, 'level capped at 3');
    assert.equal(isFixer(FIXIT), true); assert.equal(isFixer(BENNY), false); assert.equal(isFixer(null), false);
  });
  test('a plan is worked out from the contact row; stale or forged choices are refused', () => {
    const p = throughPlan([BENNY], { contactId: 'c1', mode: 'help', pay: 250 });
    assert.equal(p.refused, '');
    assert.equal(p.closer, 1); assert.equal(p.bought, 2); assert.equal(p.dice, 3);
    assert.equal(p.pay, 200, 'only what buys dice is paid'); assert.equal(p.fee, 50); assert.equal(p.payNow, 250);
    assert.equal(p.theirDice, 3);
    assert.equal(throughPlan([BENNY], { contactId: 'c1', mode: 'help', digs: false }).theirDice, 0);
    assert.equal(throughPlan([BENNY], { contactId: 'zz', mode: 'help' }).refused, 'noContact');
    assert.equal(throughPlan([BENNY], { contactId: 'c1', mode: 'fixer' }).refused, 'notFixer');
    assert.equal(throughPlan([{ ...BENNY, favours: -5 }], { contactId: 'c1', mode: 'help', favour: true }).refused, 'tooManyFavours');
    const f = throughPlan([FIXIT], { contactId: 'f1', mode: 'fixer', favour: true });
    assert.equal(f.dice, 6, 'four of their own and two for the favour'); assert.equal(f.fee, 0); assert.equal(f.waiveCut, true);
    assert.deepEqual(f.favour, { after: -1, debt: true });
    const h = throughPlan([{ ...BENNY, favours: 2 }], { contactId: 'c1', mode: 'help', favour: true });
    assert.equal(h.fee, 0, 'a favour waives the fee'); assert.equal(h.payNow, 0); assert.equal(h.waiveCut, false);
  });
  test('successes: a helping contact\'s roll counts as in legwork; the old legwork rule lowers the TN', async () => {
    assert.equal(throughSuccesses('help', 1, 3), 3);
    assert.equal(throughSuccesses('help', 2, null), 2);
    assert.equal(throughSuccesses('fixer', 2, 5), 2);
    assert.deepEqual(contactLevelTnMods({ level: 3 }), []);
    await withRule(RULES.BOOK_V78.legwork, 'mode', 'tn', () => assert.equal(contactLevelTnMods({ level: 3 })[0]!.value, -2));
    assert.equal(throughSuffix({ closer: 0, bought: 0, favourDice: 0 }), '');
    assert.match(throughSuffix({ closer: 1, bought: 2, favourDice: 0 }), /\+1.*\+2/);
  });
});

describe('v0.91.6 the find test through a contact or a fixer (documents/index.ts)', () => {
  test('helped by a contact: their dice, their roll, the halved legality row, the fee paid now', async () => {
    settings['itemTemplates'] = [RIFLE];
    const a = withContacts();
    // Etiquette 4 + closer 1 + paid 2 = 7 dice vs TN 4 + 1 (restricted, halved) = 5; then Benny's 3 dice.
    faces.push(5, 5, 1, 1, 1, 1, 1, 5, 5, 5);
    const r = await a.findFromShop('tpl:w:t5', { through: { contactId: 'c1', mode: 'help', pay: 200 } });
    assert.equal(faces.length, 0, 'all ten dice rolled');
    assert.equal(r.found, true);
    assert.equal(r.hours, 16, '48 hours ÷ the better result, 3');
    const c = chat.at(-1).flags.sr2e.contest;
    assert.equal(c.sides.length, 2);
    assert.equal(c.sides[0].result.targetNumber, 5);
    assert.equal(c.sides[1].uuid, undefined, 'the contact\'s side has no Karma buttons');
    assert.equal(c.deal.through.mode, 'help');
    assert.equal(c.deal.price, 2000);
    assert.equal(chat.at(-1).flags.sr2e.buy.hours, 16);
    assert.equal(a.system.nuyen, 4750, 'fee 50 and pay 200');
    const html = SR2Actor.contestContent(c);
    assert.match(html, /data-sr2e-action="haggle"/);
    assert.match(html, /Benny/);
  });
  test('a fixer finds it: their roll alone, no legality, the cut on the price, more time, no Haggle', async () => {
    settings['itemTemplates'] = [CANNON];
    const a = withContacts();
    // Fixit rolls 2 × level 2 = 4 dice vs TN 4 (forbidden's row is gone).
    faces.push(5, 5, 1, 1);
    const r = await a.findFromShop('tpl:w:t6', { through: { contactId: 'f1', mode: 'fixer' } });
    assert.equal(faces.length, 0);
    assert.equal(r.found, true);
    assert.equal(r.hours, 36, '48 × 1.5 ÷ 2 (the forbidden ×2 doesn\'t count)');
    assert.equal(r.price, 11000, 'the cut is on the price');
    const c = chat.at(-1).flags.sr2e.contest;
    assert.equal(c.sides.length, 1);
    assert.equal(c.sides[0].uuid, undefined);
    assert.equal(c.sides[0].result.targetNumber, 4);
    assert.equal(c.deal.through.fee, 1000);
    assert.equal(chat.at(-1).flags.sr2e.buy.price, 11000);
    assert.equal(a.system.nuyen, 5000, 'nothing paid until Buy');
    const html = SR2Actor.contestContent(c);
    assert.doesNotMatch(html, /data-sr2e-action="haggle"/);
    assert.match(html, /data-sr2e-action="buyItem"/);
    assert.match(html, /1,000/);
  });
  test('a fixer\'s price passes the Buy checks', async () => {
    settings['itemTemplates'] = [RIFLE];
    const a = withContacts();
    const ok = await a.buyFromShop('tpl:w:t5', 2200, 0, 1);
    assert.equal(ok, true);
    assert.equal(a.system.nuyen, 2800);
  });
  test('refused: a contact who isn\'t a fixer, a contact gone; nothing rolled or paid', async () => {
    settings['itemTemplates'] = [RIFLE];
    const a = withContacts();
    assert.equal(await a.findFromShop('tpl:w:t5', { through: { contactId: 'c1', mode: 'fixer' } }), null);
    assert.equal(await a.findFromShop('tpl:w:t5', { through: { contactId: 'gone', mode: 'help', pay: 500 } }), null);
    assert.equal(chat.length, 0);
    assert.equal(a.system.nuyen, 5000);
    assert.equal(warnings.length, 2);
  });
  test('a favour: dice, no fee, counted on the contact', async () => {
    settings['itemTemplates'] = [RIFLE];
    const a = withContacts(5000, [{ ...BENNY, favours: 1, dice: 0 }]);
    // 4 + closer 1 + favour 2 = 7 dice.
    faces.push(1, 1, 1, 1, 1, 1, 5);
    await a.findFromShop('tpl:w:t5', { through: { contactId: 'c1', mode: 'help', favour: true } });
    assert.equal(faces.length, 0);
    assert.equal(a.system.contacts[0].favours, 0);
    assert.equal(a.system.nuyen, 5000, 'the favour waived the fee');
    assert.ok(chat.at(-1).flags.sr2e.contest.deal.favNote);
  });
  test('not enough nuyen for the fee: nothing rolled', async () => {
    settings['itemTemplates'] = [RIFLE];
    const a = withContacts(10);
    assert.equal(await a.findFromShop('tpl:w:t5', { through: { contactId: 'c1', mode: 'help' } }), null);
    assert.equal(chat.length, 0);
  });
  test('re-scored cards (Karma Pool, the GM\'s TN change) use the contact\'s roll too', () => {
    const res = (s: number) => ({ successes: s, dice: [], targetNumber: 5, baseTargetNumber: 4, modifiers: [], botch: false });
    const c: any = { kind: 'find', id: 'k', actorName: 'X', sides: [{ name: 'X', uuid: 'Actor.x', label: 'X', result: res(1) }, { name: 'B', label: 'B', result: res(4) }],
      deal: { avHours: 48, price: 2000, buy: { shop: 'tpl:w:t5' }, through: { mode: 'help', name: 'B', fee: 0 } } };
    assert.equal(SR2Actor.contestFlags(c).buy.hours, 12);
    c.deal.through = { mode: 'nonsense' };
    assert.equal(SR2Actor.contestFlags(c).buy.hours, 48, 'an odd mode counts as the character\'s own find');
  });
  test('the switch back: every find is the character\'s own', async () => {
    settings['itemTemplates'] = [RIFLE];
    const a = withContacts();
    faces.push(1, 1, 1, 1);
    await withRule(RULES.SHOP_V916, 'through', 'off', () => a.findFromShop('tpl:w:t5', { through: { contactId: 'f1', mode: 'fixer' } }));
    const c = chat.at(-1).flags.sr2e.contest;
    assert.equal(c.sides.length, 1);
    assert.equal(c.sides[0].uuid, a.uuid);
    assert.equal(c.sides[0].result.targetNumber, 6);
    assert.equal(c.deal.through, undefined);
  });
  test('an NPC never goes through contacts', async () => {
    settings['itemTemplates'] = [RIFLE];
    const a = withContacts();
    a.type = 'npc';
    faces.push(1, 1, 1, 1);
    await a.findFromShop('tpl:w:t5', { through: { contactId: 'f1', mode: 'fixer' } });
    assert.equal(chat.at(-1).flags.sr2e.contest.sides[0].uuid, a.uuid);
  });
  test('a new contact keeps the form\'s fields, the fixer tick among them', async () => {
    const a = shopper();
    await a.addContact({ name: 'Fix', level: 2, loyalty: 4, fee: 30, dice: 5, favours: 2, fixer: true, skills: 'guns' });
    const c = a.system.contacts[0];
    assert.equal(c.loyalty, 4); assert.equal(c.fee, 30); assert.equal(c.dice, 5); assert.equal(c.favours, 2); assert.equal(c.fixer, true); assert.equal(c.skills, 'guns');
    await a.addContact({ name: 'Plain', loyalty: 99, favours: 99 });
    const d = a.system.contacts[1];
    assert.equal(d.loyalty, RULES.STREET.contacts.maxLoyalty); assert.equal(d.favours, RULES.STREET.contacts.maxFavours); assert.equal(d.fixer, false);
  });
});

describe('v0.91.6 the "Find through…" dialog (applications/through.ts)', () => {
  test('its form: every contact helps, only fixers find; names escaped; read back', async () => {
    const { throughForm, readThrough, offersThrough } = await import('../applications/through.ts');
    const html = throughForm([{ ...BENNY, name: '<b>x</b>' }, FIXIT]);
    assert.doesNotMatch(html, /<b>x<\/b>/);
    assert.match(html, /value="help:c1"/); assert.match(html, /value="help:f1"/);
    assert.match(html, /value="fixer:f1"/); assert.doesNotMatch(html, /value="fixer:c1"/);
    assert.equal(readThrough({ how: { value: 'self' } }), null);
    assert.deepEqual(readThrough({ how: { value: 'fixer:f1' }, pay: { value: '150.7' }, favour: { checked: true } }), { mode: 'fixer', contactId: 'f1', pay: 150, favour: true, digs: true });
    assert.equal(readThrough({ how: { value: 'boss:f1' } }), null);
    const a = withContacts();
    assert.equal(offersThrough(a), true);
    assert.equal(offersThrough(shopper()), false, 'no contacts, no question');
    await withRule(RULES.SHOP_V916, 'through', 'off', () => assert.equal(offersThrough(a), false));
  });
  test('the shipped defaults, the house rules, the texts and the wiring', () => {
    assert.equal(RULES.SHOP_V916.through, 'on');
    const set = read('src', 'module', 'settings.ts');
    assert.match(set, /path: "SHOP_V916\.through", type: "select", choices: \["on", "off"\]/);
    for (const m of set.matchAll(/path: "(SHOP_V916\.[^"]+)"/g)) assert.ok(keyIn(`SR2E.HouseRules.Rule.${m[1]!.replace(/\./g, '__')}`), m[1]);
    for (const k of ['SR2E.Dialog.Through.title', 'SR2E.Dialog.Sheet.isAFixerFinds', 'SR2E.UI.fixer', 'SR2E.Card.Through.feeIncluded', 'SR2E.Notify.Through.notFixer', 'SR2E.Guide.Topic.contacts.b4'])
      assert.ok(keyIn(k), k);
    const adding = read('src', 'module', 'applications', 'adding.ts');
    assert.match(adding, /askFindThrough\(actor/);
    const sheets = read('src', 'module', 'applications', 'sheets.ts');
    assert.equal((sheets.match(/askFindThrough\(/g) ?? []).length, 3, 'Find… on the character sheet and the item sheet, and the item sheet\'s Buy');
    assert.match(sheets, /fixer: Boolean\(e\.fixer\?\.checked\)/);
    assert.match(read('src', 'module', 'models', 'index.ts'), /fixer: new fields\.BooleanField/);
  });
});

describe('v0.91.6 review fixes', () => {
  test('R1: a dearer fixer cut still passes the Buy checks; a price above it is cut back', async () => {
    settings['itemTemplates'] = [RIFLE];
    const a = withContacts(10000);
    await withRule(RULES.SHOP_V916, 'fixerFee', 0.4, async () => {
      assert.equal(await a.buyFromShop('tpl:w:t5', 2800, 0, 1), true);
      assert.equal(a.system.nuyen, 7200);
      assert.equal(await a.buyFromShop('tpl:w:t5', 9999, 0, 1), true);
      assert.equal(a.system.nuyen, 4400, 'no more than list + the cut');
    });
  });
  test('R2: Haggle on a fixer\'s card is refused', async () => {
    const src = read('src', 'module', 'applications', 'chat.ts');
    assert.match(src, /deal\?\.through\?\.mode === 'fixer'\) return ui\.notifications\.warn\(tx\('SR2E\.Notify\.Through\.noHaggle'\)\)/);
  });
  test('R3: contact and fixer dice are capped', () => {
    const p = throughPlan([{ ...BENNY, dice: 5000 }], { contactId: 'c1', mode: 'help' });
    assert.equal(p.theirDice, 30);
    assert.equal(fixerDice({ dice: 5000, level: 1 }), 30);
  });
  test('a readily available thing: the choice is dropped, nothing paid, no favour used', async () => {
    settings['itemTemplates'] = [{ ...RIFLE, id: 't8', system: { ...RIFLE.system, availability: '' } }];
    const a = withContacts(5000, [{ ...BENNY, favours: 1 }]);
    const r = await a.findFromShop('tpl:w:t8', { through: { contactId: 'c1', mode: 'help', pay: 200, favour: true } });
    assert.equal(r.found, true);
    assert.equal(a.system.nuyen, 5000);
    assert.equal(a.system.contacts[0].favours, 1);
  });
  test('a failed fixer find: the retry wait is the fixer\'s longer time', async () => {
    settings['itemTemplates'] = [RIFLE];
    g.game.user = { id: 'p1', name: 'Player', isGM: false, can: () => true };
    const a = withContacts();
    faces.push(1, 1, 1, 1);
    const r = await a.findFromShop('tpl:w:t5', { through: { contactId: 'f1', mode: 'fixer' } });
    assert.equal(r.found, false);
    assert.equal(chat.at(-1).flags.sr2e.contest.deal.avHours, 72);
    const waits: any = Object.values(a.flags.sr2e.findRetry ?? {});
    assert.equal(waits.length, 1);
    assert.equal(waits[0].at, 72 * 3600);
  });
});
