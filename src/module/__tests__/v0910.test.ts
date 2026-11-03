/**
 * v0.91.0: the shop. The pure rules (rules/shop.ts), and the find and the purchase from the Add window on the glue
 * stubs of v0081-doc.test.ts (scripted dice, a chat log of messages with getFlag): findFromShop, buyFromShop, the
 * retry wait, the shop list for players, the approval queue, and the request checks.
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

const PLAYER = () => ({ id: 'p1', name: 'Player', isGM: false, can: () => true });

import {
  shopShows, parseShopKey, shopSourceOf, retryFlagKey, retryHoursLeft, retryReadyAt, copiesOrQuantity, buysByFinding, shopRowInfo, shopListMode, isOrder,
  catalogueToJson, parseCatalogueJson,
} from '../rules/index.ts';
import { methodRequestProblems } from '../rules/trust.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const lang = JSON.parse(read('public', 'lang', 'en.json'));
const keyIn = (k: string) => k.split('.').reduce((o: any, p) => o?.[p], lang) !== undefined;

const PISTOL = { id: 't1', type: 'weapon', name: 'ZZ Pistol', system: { cost: 500, availability: '4/48 hrs', streetIndex: 2 } };
const shopper = (nuyen = 5000) => who({ name: 'Shopper', nuyen }, [skill('et', 'Etiquette', 4, 'charisma')]);

describe('v0.91.0 the shop rules (rules/shop.ts)', () => {
  test('shop keys: where an entry comes from', () => {
    assert.equal(shopSourceOf('tpl:b:heavyPistol'), 'builtin');
    assert.equal(shopSourceOf('tpl:w:t1'), 'world');
    assert.equal(shopSourceOf('world:Item.abc'), 'worldItem');
    assert.equal(shopSourceOf('pack:Compendium.x.y.Item.z'), 'pack');
    assert.deepEqual(parseShopKey('kit:k1#2'), { source: 'kit', id: 'k1', line: 2 });
    assert.deepEqual(parseShopKey('world:Item.abc'), { source: 'worldItem', id: 'Item.abc' });
    assert.deepEqual(parseShopKey('pack:Compendium.x.y.Item.z'), { source: 'pack', id: 'Compendium.x.y.Item.z' });
    assert.equal(parseShopKey('kit:k1'), null);
    assert.equal(parseShopKey('Item.abc'), null);
    assert.equal(parseShopKey(`tpl:w:${'x'.repeat(400)}`), null);
    assert.equal(shopListMode('nonsense'), 'all');
  });
  test('what players see: the list mode, forbidden things, and what the shop does not sell', () => {
    const base = { type: 'weapon', mode: 'all' as const, isGM: false, allowForbidden: false };
    assert.equal(shopShows({ ...base, key: 'tpl:b:x' }), true);
    assert.equal(shopShows({ ...base, key: 'tpl:b:x', legality: 'forbidden' }), false);
    assert.equal(shopShows({ ...base, key: 'tpl:b:x', legality: 'forbidden', allowForbidden: true }), true);
    assert.equal(shopShows({ ...base, key: 'tpl:b:x', legality: 'forbidden', isGM: true }), true);
    assert.equal(shopShows({ ...base, mode: 'catalogue', key: 'tpl:b:x' }), false);
    assert.equal(shopShows({ ...base, mode: 'catalogue', key: 'pack:Compendium.a.b.Item.c' }), false);
    assert.equal(shopShows({ ...base, mode: 'catalogue', key: 'tpl:w:x' }), true);
    assert.equal(shopShows({ ...base, mode: 'catalogue', key: 'world:Item.x' }), true);
    assert.equal(shopShows({ ...base, mode: 'marked', key: 'tpl:w:x' }), false);
    assert.equal(shopShows({ ...base, mode: 'marked', key: 'tpl:w:x', marked: true }), true);
    assert.equal(shopShows({ ...base, mode: 'marked', key: 'kit:k1', type: 'kit' }), true);
    assert.equal(shopShows({ ...base, mode: 'marked', key: 'tpl:b:x', type: 'spell' }), true, 'spells are not sold (yet): never filtered');
  });
  test('who finds before buying (RULES.SHOP_V91.buying), and the old way back', async () => {
    assert.equal(buysByFinding({ isGM: false, actorType: 'character', inCreation: false }), true);
    assert.equal(buysByFinding({ isGM: true, actorType: 'character', inCreation: false }), false);
    assert.equal(buysByFinding({ isGM: false, actorType: 'npc', inCreation: false }), false);
    assert.equal(buysByFinding({ isGM: false, actorType: 'character', inCreation: true }), false);
    await withRule(RULES.SHOP_V91, 'buying', 'now', () => assert.equal(buysByFinding({ isGM: false, actorType: 'character', inCreation: false }), false));
  });
  test('the retry wait: its flag key, its time, the GM never held back, and the old way', async () => {
    const k = retryFlagKey('pack:Compendium.world.gear.Item.abc');
    assert.ok(!k.includes('.'), 'flag keys may not hold dots');
    assert.notEqual(retryFlagKey('world:Item.a_b'), retryFlagKey('world:Item.a.b'));
    assert.equal(retryReadyAt(100, 2), 7300);
    assert.equal(retryHoursLeft({ at: 7300 }, 100), 2);
    assert.equal(retryHoursLeft({ at: 7300 }, 7300), 0);
    assert.equal(retryHoursLeft({ at: 7300 }, 100, true), 0);
    assert.equal(retryHoursLeft(null, 100), 0);
    await withRule(RULES.SHOP_V91, 'retry', 'any', () => assert.equal(retryHoursLeft({ at: 7300 }, 100), 0));
  });
  test('a row: price with its Street Index, Availability, base time, legality; copies or quantity', () => {
    const r = shopRowInfo('weapon', { cost: 500, streetIndex: 2, availability: '4/48 hrs', legality: 'restricted' });
    assert.equal(r.price, 1000);
    assert.equal(r.streetIndex, 2);
    assert.equal(r.avail, '4/48 hrs');
    assert.equal(r.tn, 4);
    assert.equal(r.baseHours, 48);
    assert.equal(r.legality, 'restricted');
    assert.ok(r.legalityLabel);
    assert.equal(copiesOrQuantity('weapon', 50), 20);
    assert.equal(copiesOrQuantity('gear', 50), 50);
    assert.equal(copiesOrQuantity('focus', 5), 1, 'a focus is bought at its listed rating');
    assert.equal(isOrder({ kind: 'order' }), true);
    assert.equal(isOrder({ kind: 'learn' }), false);
  });
  test('the "in the shop" mark travels with a catalogue file', () => {
    const json = catalogueToJson({ templates: [{ ...PISTOL, shop: true }, { ...PISTOL, id: 't2', name: 'Other' }], kits: [], exportedAt: 0, systemVersion: 'x' });
    const back = parseCatalogueJson(json);
    assert.equal(back.templates[0]!.shop, true);
    assert.equal(back.templates[1]!.shop, undefined);
  });
});

describe('v0.91.0 finding and buying from the shop (documents/index.ts)', () => {
  test('Find & buy: the Availability test on a catalogue entry, the card carrying the shop key, price and time', async () => {
    settings['itemTemplates'] = [PISTOL];
    const a = shopper();
    faces.push(5, 5, 1, 1);
    const r = await a.findFromShop('tpl:w:t1');
    assert.deepEqual(r, { found: true, hours: 24, price: 1000 });
    const card = chat.at(-1);
    assert.equal(card.flags.sr2e.buy.shop, 'tpl:w:t1');
    assert.equal(card.flags.sr2e.buy.itemId, undefined);
    assert.equal(card.flags.sr2e.buy.price, 1000);
    assert.equal(card.flags.sr2e.buy.hours, 24);
    assert.equal(a.items.length, 1, 'nothing goes on the sheet until it is bought');
  });

  test('Buy: the entry read again from its source, the price bounded, the item made (waiting off) or ordered (waiting on)', async () => {
    settings['itemTemplates'] = [PISTOL];
    const a = shopper();
    assert.equal(await a.buyFromShop('tpl:w:t1', -1e9, 0, 1), true);
    assert.equal(a.system.nuyen, 5000 - 750, 'never below the best haggled price');
    assert.ok(a.items.some((i: any) => i.name === 'ZZ Pistol' && i.type === 'weapon'));
    const b = shopper();
    await withRule(RULES.WAITING, 'enabled', true, async () => {
      assert.equal(await b.buyFromShop('tpl:w:t1', 1000, 24, 1), true);
    });
    const projects = Object.values(b.flags.sr2e?.projects ?? {}) as any[];
    assert.equal(projects.length, 1);
    assert.equal(projects[0].kind, 'order');
    assert.equal(projects[0].hours, 24);
    assert.equal(projects[0].paid.nuyen, 1000);
    assert.equal(b.system.nuyen, 4000);
    assert.equal(b.items.filter((i: any) => i.name === 'ZZ Pistol').length, 0, 'it arrives later');
    const c = shopper(10);
    assert.equal(await c.buyFromShop('tpl:w:t1', 1000, 0, 1), false, 'not enough nuyen');
    assert.equal(c.system.nuyen, 10);
    assert.equal(await c.buyFromShop('tpl:w:gone', 10, 0, 1), false);
  });

  test("a player's shop: an unmarked entry (shop list 'marked') or a forbidden one can't be found or bought", async () => {
    g.game.user = PLAYER();
    settings['itemTemplates'] = [PISTOL, { ...PISTOL, id: 't3', name: 'ZZ Banned', system: { ...PISTOL.system, legality: 'forbidden' } }];
    settings['shopList'] = 'marked';
    const a = shopper();
    assert.equal(await a.findFromShop('tpl:w:t1'), null);
    assert.equal(await a.buyFromShop('tpl:w:t1', 1000, 0, 1), false);
    settings['itemTemplates'] = [{ ...PISTOL, shop: true }, { id: 't3', type: 'weapon', name: 'ZZ Banned', shop: true, system: { ...PISTOL.system, legality: 'forbidden' } }];
    assert.equal(await a.buyFromShop('tpl:w:t1', 1000, 0, 1), true);
    assert.equal(await a.buyFromShop('tpl:w:t3', 1000, 0, 1), false, 'forbidden: hidden from players');
    settings['shopForbidden'] = true;
    assert.equal(await a.buyFromShop('tpl:w:t3', 1000, 0, 1), true);
    settings['shopList'] = 'catalogue';
    assert.equal(await a.buyFromShop('tpl:b:heavyPistol', 450, 0, 1), false, 'built-in templates are not the GM\'s catalogue');
  });

  test('a failed find waits for its base time before the next try (VERIFY); the GM is never held back', async () => {
    g.game.user = PLAYER();
    settings['itemTemplates'] = [PISTOL];
    const a = shopper();
    faces.push(1, 1, 1, 1);
    const r = await a.findFromShop('tpl:w:t1');
    assert.deepEqual(r, { found: false, hours: null, price: 1000 });
    const entry = a.flags.sr2e.findRetry[retryFlagKey('tpl:w:t1')];
    assert.equal(entry.at, 48 * 3600);
    assert.equal(await a.findFromShop('tpl:w:t1'), null);
    assert.ok(warnings.some((w) => /tryAgainLater|try again/.test(w)));
    g.game.time.worldTime = 48 * 3600;
    faces.push(5, 1, 1, 1);
    assert.equal((await a.findFromShop('tpl:w:t1'))?.found, true);
    assert.equal(a.flags.sr2e.findRetry[retryFlagKey('tpl:w:t1')], undefined, 'found: the wait is gone');
    // A sheet item's Find… waits the same way.
    const b = who({ name: 'B', nuyen: 0 }, [skill('et', 'Etiquette', 4, 'charisma'), { id: 'g1', type: 'gear', name: 'Medkit', system: { cost: 100, availability: '6/12 hrs', quantity: 1 } }]);
    faces.push(1, 1, 1, 1);
    await b.findItem('g1');
    assert.equal(await b.findItem('g1'), null);
    g.game.user = GM();
    faces.push(1, 1, 1, 1);
    assert.ok(await b.findItem('g1'), 'the GM may try again at once');
  });

  test('with the approval queue on, Buy files the purchase (price and wait), and the GM approving it buys it', async () => {
    g.game.user = PLAYER();
    settings['itemTemplates'] = [PISTOL];
    settings['approvalQueue'] = true;
    const a = shopper();
    a.testUserPermission = () => true;
    assert.equal(await a.buyFromShop('tpl:w:t1', 900, 12, 1), 'requested');
    const reqs = Object.values(a.flags.sr2e.requests) as any[];
    assert.equal(reqs.length, 1);
    assert.deepEqual(reqs[0].data, { method: 'buyFromShop', args: ['tpl:w:t1', 900, 12, 1] });
    assert.equal(reqs[0].nuyen, 900);
    assert.equal(a.system.nuyen, 5000);
    g.game.user = GM();
    const { approveRequest } = await import('../applications/approvals.ts');
    assert.equal(await approveRequest(a, reqs[0].id), true);
    assert.equal(a.system.nuyen, 4100);
    assert.ok(a.items.some((i: any) => i.name === 'ZZ Pistol'));
  });

  test('Haggle on a shop card: the price haggled over is the entry\'s own, and the new card keeps the shop key', async () => {
    settings['itemTemplates'] = [PISTOL];
    const a = shopper();
    a.items.push({ id: 'neg', type: 'skill', name: 'Negotiation', system: { rating: 4, attribute: 'charisma', kind: 'active', specialization: '', specializationRating: 0 } });
    faces.push(...Array(40).fill(5));
    const p = await a.haggle({ shop: 'tpl:w:t1', price: 1, name: 'x', qty: 1, hours: 24 });
    assert.equal(typeof p, 'number');
    const card = chat.at(-1);
    assert.equal(card.flags.sr2e.buy.shop, 'tpl:w:t1');
    assert.equal(card.flags.sr2e.contest.deal.price, 1000, 'the list price, not the card\'s 1');
    settings['itemTemplates'] = [];
    assert.equal(await a.haggle({ shop: 'tpl:w:t1', price: 1, name: 'x', qty: 1 }), null, 'gone from the shop: no haggle');
  });

  test('a kit line can be found and bought on its own', async () => {
    settings['starterKits'] = [{ id: 'k1', name: 'ZZ Kit', lines: [{ type: 'weapon', name: 'ZZ Knife', system: { cost: 30 }, amount: 1 }] }];
    const a = shopper(100);
    assert.equal(await a.buyFromShop('kit:k1#0', 30, 0, 1), true);
    assert.equal(a.system.nuyen, 70);
    assert.equal(await a.buyFromShop('kit:k1#5', 30, 0, 1), false);
  });

  test('the request check: a shop purchase pays exactly what was filed, and its key is a short string', () => {
    assert.deepEqual(methodRequestProblems({ method: 'buyFromShop', args: ['tpl:w:t1', 900, 12, 1] }, { karma: 0, nuyen: 900 }), []);
    assert.ok(methodRequestProblems({ method: 'buyFromShop', args: ['tpl:w:t1', 900, 12, 1] }, { karma: 0, nuyen: 100 }).length);
    assert.ok(methodRequestProblems({ method: 'buyFromShop', args: [{ x: 1 }, 900, 12, 1] }, { karma: 0, nuyen: 900 }).length);
    assert.ok(methodRequestProblems({ method: 'buyFromShop', args: ['tpl:w:t1', 900, 12, 5000] }, { karma: 0, nuyen: 900 }).length);
  });
});

describe('v0.91.0 the wiring', () => {
  test("a find card's Buy and Haggle follow the shop key; a request spends the card", () => {
    const chatSrc = read('src', 'module', 'applications', 'chat.ts');
    assert.match(chatSrc, /shopKey \? await actor\.buyFromShop\(shopKey,/);
    assert.match(chatSrc, /if \(bought === 'requested'\) \{ if \(message\.isOwner\) await message\.setFlag\(SYSTEM_ID, 'requested', true\); \}/);
    assert.match(read('src', 'module', 'applications', 'approvals.ts'), /'buyFromShop',/);
    assert.match(read('src', 'module', 'documents', 'index.ts'), /if \(message\?\.getFlag\?\.\(SYSTEM_ID, 'requested'\)\) return tx\('SR2E\.Card\.Shop\.alreadyRequested'\);/);
  });
  test('the request runner for adds never passes a shop price (only buyFromShop does)', () => {
    const add = read('src', 'module', 'applications', 'adding.ts');
    assert.match(add, /if \(shop && \(payment !== 'buy' \|\| lines\.length !== 1\)\) return done;/);
    assert.match(add, /const made = await addLines\(actor, lines, String\(data\['payment'\] \?\? 'free'\) as AddPayment, Boolean\(data\['ready'\]\)\);/);
  });
  test('the settings, house rules and texts are in place', () => {
    const set = read('src', 'module', 'settings.ts');
    assert.match(set, /"shopList", \{/);
    assert.match(set, /"shopForbidden", \{/);
    assert.match(set, /path: "SHOP_V91\.buying", type: "select", choices: \["find", "now"\]/);
    assert.match(set, /path: "SHOP_V91\.retry", type: "select", choices: \["wait", "any"\]/);
    for (const k of ['SR2E.Settings.shopList.Choices.marked', 'SR2E.Settings.shopForbidden.Hint', 'SR2E.HouseRules.Rule.SHOP_V91__buying', 'SR2E.HouseRules.Rule.SHOP_V91__retry', 'SR2E.UI.openOrders', 'SR2E.UI.findTicked'])
      assert.ok(keyIn(k), k);
    assert.equal(RULES.SHOP_V91.buying, 'find');
    assert.equal(RULES.SHOP_V91.retry, 'wait');
  });
});

describe('v0.91.0 review fixes', () => {
  test('B1/R3: a compendium entry is checked through its pack (Observer), also for a filer this GM client never saw', async () => {
    const { resolveShopKey } = await import('../applications/shop.ts');
    const pack: any = { documentName: 'Item', metadata: { label: 'ZZ' }, ownership: { PLAYER: 'OBSERVER' }, getUserLevel: (u: any) => (u?.id === 'p1' ? 2 : 1) };
    const doc: any = { documentName: 'Item', type: 'weapon', name: 'ZZ Packed', inCompendium: true, compendium: pack, parent: null, ownership: { default: 0 }, flags: {},
      toObject: () => ({ name: 'ZZ Packed', type: 'weapon', system: { cost: 100 } }) };
    uuidRegistry.set('Compendium.zz.items.Item.a', doc);
    g.game.items = { fromCompendium: (d: any) => d.toObject() };
    assert.ok(await resolveShopKey('pack:Compendium.zz.items.Item.a', PLAYER()), 'an observer of the pack');
    assert.equal(await resolveShopKey('pack:Compendium.zz.items.Item.a', { id: 'p2', isGM: false }), null, 'limited only: not listed, not bought');
    assert.ok(await resolveShopKey('pack:Compendium.zz.items.Item.a', { isGM: false }), 'an unseen filer: the pack\'s player access');
    pack.ownership.PLAYER = 'LIMITED';
    assert.equal(await resolveShopKey('pack:Compendium.zz.items.Item.a', { isGM: false }), null);
    uuidRegistry.delete('Compendium.zz.items.Item.a');
  });

  test('B2/B3: two queued purchases of the same thing are two requests; a request not filed leaves the card live', async () => {
    g.game.user = PLAYER();
    settings['itemTemplates'] = [PISTOL];
    settings['approvalQueue'] = true;
    const a = shopper();
    assert.equal(await a.buyFromShop('tpl:w:t1', 1000, 12, 1), 'requested');
    assert.equal(await a.buyFromShop('tpl:w:t1', 1000, 12, 1), 'requested');
    assert.equal(Object.values(a.flags.sr2e.requests).length, 2);
    const b = shopper();
    b.isOwner = false;
    assert.equal(await b.buyFromShop('tpl:w:t1', 1000, 12, 1), false, 'fileRequest refused (not the owner): nothing filed');
  });

  test('B4: a failed find turned into a success by the Karma Pool drops the retry wait', async () => {
    g.game.user = PLAYER();
    settings['itemTemplates'] = [PISTOL];
    const a = shopper();
    a.system.karma.pool = 5; a.system.prepareDerivedData();
    faces.push(1, 1, 2, 2);
    await a.findFromShop('tpl:w:t1');
    assert.ok(a.flags.sr2e.findRetry[retryFlagKey('tpl:w:t1')]);
    const card = chat.at(-1);
    faces.push(5, 5, 5, 5);
    await SR2Actor.contestKarma(card, 0, 'reroll');
    assert.equal(a.flags.sr2e.findRetry[retryFlagKey('tpl:w:t1')], undefined);
  });

  test('R2: a find time of 0 for something with an Availability test becomes its base time', async () => {
    settings['itemTemplates'] = [PISTOL];
    const b = shopper();
    await withRule(RULES.WAITING, 'enabled', true, async () => { assert.equal(await b.buyFromShop('tpl:w:t1', 1000, 0, 1), true); });
    assert.equal((Object.values(b.flags.sr2e.projects) as any[])[0].hours, 48);
  });

  test('R1: a Buy now add request from a character who must find first, or holding a Forbidden item, is refused on the GM side', async () => {
    const { requestProblems } = await import('../applications/approvals.ts');
    const a = shopper();
    const line = { type: 'weapon', name: 'X', amount: 1, system: { cost: 10 }, data: { name: 'X', type: 'weapon', system: { cost: 10 } } };
    const r: any = { id: 'r1', kind: 'add', label: 'x', karma: 0, nuyen: 10, data: { payment: 'buy', ready: false, lines: [line] } };
    assert.ok(requestProblems(a, r).some((p: string) => /find/i.test(p)));
    await withRule(RULES.SHOP_V91, 'buying', 'now', () => {
      assert.deepEqual(requestProblems(a, r), []);
      const f = { ...line, data: { ...line.data, system: { cost: 10, legality: 'forbidden' } } };
      assert.ok(requestProblems(a, { ...r, data: { ...r.data, lines: [f] } }).some((p: string) => /Forbidden/.test(p)));
    });
  });

  test('R8: a replaced template keeps the GM\'s shop mark; saving or taking it in again keeps its id and mark', async () => {
    const { mergeTemplates } = await import('../rules/catalogcsv.ts');
    const m = mergeTemplates([{ ...PISTOL, shop: true }], [{ ...PISTOL, id: 'x', system: { cost: 600 } }], 'replace', () => 'n');
    assert.equal(m.list[0]!.shop, true);
    assert.equal(m.list[0]!.id, 't1');
    assert.match(read('src', 'module', 'applications', 'sheets.ts'), /id: old\?\.id \?\? `w-\$\{foundry\.utils\.randomID\(\)\}`, type: item\.type, name, system, \.\.\.\(old\?\.shop \? \{ shop: true \} : \{\}\)/);
    assert.match(read('src', 'module', 'applications', 'qol.ts'), /id: old\?\.id \?\? `w-\$\{foundry\.utils\.randomID\(\)\}`, type: d\.type, name: d\.name, system, \.\.\.\(old\?\.shop \? \{ shop: true \} : \{\}\)/);
  });

  test('R4: Buy and Haggle on one card run one at a time on a client', () => {
    const c = read('src', 'module', 'applications', 'chat.ts');
    assert.match(c, /const dealBusy = new Set<string>\(\);/);
    assert.equal((c.match(/if \(dealBusy\.has\(id\)\) return;/g) ?? []).length, 2);
  });
});
