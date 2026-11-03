/**
 * v0.91.5: legality and permits in the shop. The pure rules (rules/legalbuy.ts), the find test's legality row and
 * time, the find card's warning, Get a permit… (paid, Under way or at once, the approval queue), the Permit box lock,
 * the request checks, and the switches back to the old ways. Stubs as in v0910.test.ts.
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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const lang = JSON.parse(read('public', 'lang', 'en.json'));
const keyIn = (k: string) => k.split('.').reduce((o: any, p) => o?.[p], lang) !== undefined;

const shopper = (nuyen = 5000) => who({ name: 'Shopper', nuyen }, [skill('et', 'Etiquette', 4, 'charisma')]);

import {
  legalityId, legalFindMods, legalFindTimeFactor, permitCategory, permitPlan, legalWarning, shopLegalTitle, permitTickLocked, permitsBought,
  LEGAL_FIND_MOD, PROJECT_CALLS,
} from '../rules/index.ts';
import { methodRequestProblems } from '../rules/trust.ts';


const RIFLE = { id: 't5', type: 'weapon', name: 'ZZ Rifle', system: { cost: 2000, availability: '4/48 hrs', streetIndex: 1, legality: 'restricted' } };
const CANNON = { id: 't6', type: 'weapon', name: 'ZZ Cannon', system: { cost: 10000, availability: '4/48 hrs', streetIndex: 1, legality: 'forbidden' } };
const KNIFE = { id: 't7', type: 'weapon', name: 'ZZ Knife', system: { cost: 50, availability: '', streetIndex: 1, legality: 'permit' } };

describe('v0.91.5 legality and permits: the rules (rules/legalbuy.ts)', () => {
  test('legality ids: only the known categories', () => {
    assert.equal(legalityId('restricted'), 'restricted');
    assert.equal(legalityId('Restricted'), '');
    assert.equal(legalityId('<b>'), '');
    assert.equal(legalityId(undefined), '');
  });
  test('the find\'s legality row and time, by category; off with the old way', async () => {
    assert.deepEqual(legalFindMods('legal'), []);
    assert.deepEqual(legalFindMods('permit'), [], 'Needs a permit: +0 by default');
    const r = legalFindMods('restricted');
    assert.equal(r.length, 1); assert.equal(r[0]!.value, 2); assert.equal(r[0]!.id, LEGAL_FIND_MOD); assert.ok(r[0]!.label);
    assert.equal(legalFindMods('forbidden')[0]!.value, 4);
    assert.equal(legalFindTimeFactor('restricted'), 1);
    assert.equal(legalFindTimeFactor('forbidden'), 2);
    assert.equal(legalFindTimeFactor(''), 1);
    await withRule(RULES.SHOP_V915, 'findByLegality', 'off', () => {
      assert.deepEqual(legalFindMods('forbidden'), []);
      assert.equal(legalFindTimeFactor('forbidden'), 1);
    });
  });
  test('which can have a permit, and what it costs and takes', () => {
    assert.equal(permitCategory('permit'), true);
    assert.equal(permitCategory('restricted'), true);
    assert.equal(permitCategory('forbidden'), false);
    assert.equal(permitCategory('legal'), false);
    assert.deepEqual(permitPlan({ legality: 'permit', cost: 500 }), { cost: 100, hours: 168, days: 7, legality: 'permit' }, 'the minimum');
    assert.deepEqual(permitPlan({ legality: 'permit', cost: 5000 }), { cost: 500, hours: 168, days: 7, legality: 'permit' });
    assert.deepEqual(permitPlan({ legality: 'restricted', cost: 10000 }), { cost: 2500, hours: 720, days: 30, legality: 'restricted' });
    assert.equal(permitPlan({ legality: 'restricted', cost: -50 })!.cost, 500, 'a negative cost counts as none');
    assert.equal(permitPlan({ legality: 'forbidden', cost: 100 }), null);
  });
  test('warnings: the fine without a permit; nothing with one or when legal', () => {
    assert.equal(legalWarning({ legality: 'legal' }), '');
    assert.equal(legalWarning({ legality: 'permit', permit: true }), '');
    assert.match(legalWarning({ legality: 'permit' }), /1,000/);
    assert.match(legalWarning({ legality: 'restricted' }), /5,000/);
    assert.match(legalWarning({ legality: 'forbidden', permit: true }), /25,000/, 'a permit never covers forbidden');
    const t = shopLegalTitle('restricted');
    assert.match(t, /\+2/); assert.match(t, /25%/); assert.match(t, /30/);
    assert.equal(shopLegalTitle(''), '');
  });
  test('the Permit box: the GM\'s with bought permits; anyone\'s with the old way', async () => {
    assert.equal(permitsBought(), true);
    assert.equal(permitTickLocked({ isGM: false }), true);
    assert.equal(permitTickLocked({ isGM: true }), false);
    await withRule(RULES.SHOP_V915, 'permits', 'tick', () => assert.equal(permitTickLocked({ isGM: false }), false));
  });
  test('the shipped defaults, the house rules and the texts', () => {
    assert.equal(RULES.SHOP_V915.findByLegality, 'graded');
    assert.equal(RULES.SHOP_V915.permits, 'buy');
    const set = read('src', 'module', 'settings.ts');
    assert.match(set, /path: "SHOP_V915\.findByLegality", type: "select", choices: \["graded", "off"\]/);
    assert.match(set, /path: "SHOP_V915\.permits", type: "select", choices: \["buy", "tick"\]/);
    for (const m of set.matchAll(/path: "(SHOP_V915\.[^"]+)"/g)) assert.ok(keyIn(`SR2E.HouseRules.Rule.${m[1]!.replace(/\./g, '__')}`), m[1]);
    for (const k of ['SR2E.UI.getPermit', 'SR2E.Dialog.Legal.content', 'SR2E.Card.Legal.granted', 'SR2E.Notify.Legal.tickLocked', 'SR2E.Card.Mod.legality', 'SR2E.Guide.Topic.adding.b7'])
      assert.ok(keyIn(k), k);
    assert.ok(PROJECT_CALLS.includes('finishPermit' as any));
  });
});

describe('v0.91.5 the find test and its card (documents/index.ts)', () => {
  test('a restricted entry: TN +2 on the roll, the warning on the card, the legality kept for re-rolls', async () => {
    settings['itemTemplates'] = [RIFLE];
    const a = shopper();
    // Etiquette 4 vs TN 4 + 2 = 6: two 6s succeed (each rolls again: the Rule of Six).
    faces.push(6, 6, 1, 1, 1, 1);
    const r = await a.findFromShop('tpl:w:t5');
    assert.equal(r.found, true);
    assert.equal(r.hours, 24);
    const card = chat.at(-1);
    const side = card.flags.sr2e.contest.sides[0];
    assert.equal(side.result.targetNumber, 6);
    assert.ok(side.result.modifiers.some((m: any) => m.id === LEGAL_FIND_MOD && m.value === 2));
    assert.equal(card.flags.sr2e.contest.deal.legality, 'restricted');
    assert.match(card.content, /data-sr2e-legal="restricted"/);
    assert.match(card.content, /5,000/);
  });
  test('the old way back: no legality row', async () => {
    settings['itemTemplates'] = [RIFLE];
    const a = shopper();
    faces.push(5, 5, 1, 1);
    await withRule(RULES.SHOP_V915, 'findByLegality', 'off', async () => {
      const r = await a.findFromShop('tpl:w:t5');
      assert.equal(r.found, true);
      assert.equal(chat.at(-1).flags.sr2e.contest.sides[0].result.targetNumber, 4);
    });
  });
  test('a forbidden entry (the GM sells them): TN +4 and twice the time, also for the retry wait', async () => {
    settings['itemTemplates'] = [CANNON];
    settings['shopForbidden'] = true;
    const a = shopper();
    faces.push(6, 1, 1, 1, 1);
    const r = await a.findFromShop('tpl:w:t6');
    assert.equal(chat.at(-1).flags.sr2e.contest.sides[0].result.targetNumber, 8);
    assert.equal(r.found, false, 'a 6 + 1 does not reach TN 8');
    assert.equal(chat.at(-1).flags.sr2e.contest.deal.avHours, 96);
  });
  test('readily available (no Availability): no test, but the warning is there', async () => {
    settings['itemTemplates'] = [KNIFE];
    const a = shopper();
    const r = await a.findFromShop('tpl:w:t7');
    assert.equal(r.found, true);
    assert.match(chat.at(-1).content, /data-sr2e-legal="permit"/);
  });
  test('a card\'s legality is read as an id: odd text is not shown', () => {
    const c = { kind: 'find', id: 'k', actorName: 'A', sides: [{ name: 'A', uuid: '', label: 'Finding', result: { successes: 1, dice: [], targetNumber: 4, baseTargetNumber: 4, modifiers: [], botch: false } }], deal: { avHours: 24, price: 10, buy: {}, legality: '<img src=x onerror=alert(1)>' } };
    const html = SR2Actor.contestContent(c);
    assert.doesNotMatch(html, /onerror/);
    assert.doesNotMatch(html, /data-sr2e-legal/);
  });
});

describe('v0.91.5 Get a permit… (documents/index.ts)', () => {
  const carrying = (legality = 'restricted', extra: any = {}) => who({ name: 'Holder', nuyen: 5000 }, [{ id: 'w1', type: 'weapon', name: 'ZZ Rifle', system: { cost: 4000, legality, permit: false, ...extra } }]);
  test('paid now; the permit is ticked at once with waiting off', async () => {
    const a = carrying();
    assert.equal(await a.getPermit('item:w1'), true);
    assert.equal(a.system.nuyen, 4000, '25% of ¥4,000 is ¥1,000');
    assert.equal(a.items.get('w1').system.permit, true);
    assert.match(a.system.ledger.at(-1).reason, /^Permit: ZZ Rifle$/);
    assert.match(chat.at(-1).content, /permit/i);
  });
  test('with waiting on: Under way for its days; a second ask is refused', async () => {
    const a = carrying('permit');
    (RULES.WAITING as any).enabled = true;
    try {
      assert.equal(await a.getPermit('item:w1'), true);
      assert.equal(a.system.nuyen, 4600, '10% of ¥4,000');
      assert.equal(a.items.get('w1').system.permit, false, 'not yet');
      const p: any = Object.values(a.flags.sr2e.projects)[0];
      assert.equal(p.kind, 'permit'); assert.equal(p.hours, 168); assert.equal(p.source, 'permit:item:w1');
      assert.deepEqual(p.effect, { updates: [{ itemId: 'w1', changes: [['system.permit', true]] }] });
      assert.equal(await a.getPermit('item:w1'), false);
      assert.ok(warnings.some((w) => /under way/i.test(w)));
    } finally { (RULES.WAITING as any).enabled = false; }
  });
  test('refused: forbidden, already held, gone, not enough nuyen', async () => {
    assert.equal(await carrying('forbidden').getPermit('item:w1'), false);
    assert.equal(await carrying('restricted', { permit: true }).getPermit('item:w1'), false);
    assert.equal(await carrying().getPermit('item:nope'), false);
    assert.equal(await carrying().getPermit('weird:w1'), false);
    const poor = carrying(); poor.system.nuyen = 10;
    assert.equal(await poor.getPermit('item:w1'), false);
    assert.equal(poor.system.nuyen, 10);
  });
  test('the approval queue: a player\'s permit is a request at its cost, and the request checks it', async () => {
    const a = carrying();
    settings['approvalQueue'] = true;
    g.game.user = PLAYER();
    a.flags.sr2e = { creation: { v: 1 } };
    const r = await a.getPermit('item:w1');
    assert.equal(r, 'requested');
    const req: any = Object.values(a.flags.sr2e.requests)[0];
    assert.equal(req.nuyen, 1000);
    assert.deepEqual(req.data, { method: 'getPermit', args: ['item:w1', 1000] });
    assert.deepEqual(methodRequestProblems(req.data, { karma: 0, nuyen: 1000 }), []);
    assert.ok(methodRequestProblems(req.data, { karma: 0, nuyen: 1 }).length, 'a cost that isn\'t what was filed');
    assert.ok(methodRequestProblems({ method: 'getPermit', args: ['actor:x', 1000] }, { karma: 0, nuyen: 1000 }).length);
    assert.ok(methodRequestProblems({ method: 'getPermit', args: ['item:w1', 1000] }, { karma: 1, nuyen: 1000 }).length);
    assert.equal(a.system.nuyen, 5000, 'nothing paid yet');
  });
  test('the request\'s method is allowed, and a vehicle\'s permit call is checked', () => {
    const ap = read('src', 'module', 'applications', 'approvals.ts');
    assert.match(ap, /'getPermit',/);
    const idx = read('src', 'module', 'documents', 'index.ts');
    assert.match(idx, /case 'finishPermit': \{[\s\S]{0,200}this\.#projectMayTouch\(v\)\) return null;/);
  });
});

describe('v0.91.5 the Permit box on the sheets (applications/permits.ts)', () => {
  test('a player ticking it on is refused (unticking is fine); the GM may; the old way lets anyone', async () => {
    const { refusePermitTick } = await import('../applications/permits.ts');
    const doc = { system: { permit: false } };
    g.game.user = PLAYER();
    const ch: Record<string, unknown> = { 'system.permit': true, 'system.cost': 5 };
    assert.equal(refusePermitTick(doc, ch), true);
    assert.deepEqual(ch, { 'system.cost': 5 });
    assert.ok(warnings.length);
    const off: Record<string, unknown> = { 'system.permit': false };
    assert.equal(refusePermitTick({ system: { permit: true } }, off), false);
    assert.deepEqual(off, { 'system.permit': false });
    await withRule(RULES.SHOP_V915, 'permits', 'tick', () => assert.equal(refusePermitTick(doc, { 'system.permit': true }), false));
    g.game.user = GM();
    assert.equal(refusePermitTick(doc, { 'system.permit': true }), false);
  });
  test('the sheet row: the button for a player\'s item needing one; none once held or under way', async () => {
    const { permitSheetContext } = await import('../applications/permits.ts');
    g.game.user = PLAYER();
    const item = (legality: string, permit = false) => ({ type: 'weapon', isOwner: true, system: { legality, permit, cost: 1000 } });
    const c = permitSheetContext(item('restricted'), { canGet: true });
    assert.equal(c.show, true); assert.equal(c.tickable, false); assert.equal(c.button, true);
    assert.match(c.buttonTitle, /500/); assert.match(c.warning, /5,000/);
    assert.equal(permitSheetContext(item('restricted', true), { canGet: true }).button, false);
    assert.equal(permitSheetContext(item('restricted', true), { canGet: true }).tickable, true, 'a held permit may be unticked');
    assert.equal(permitSheetContext(item('restricted'), { canGet: true, underWay: true }).button, false);
    assert.equal(permitSheetContext(item('restricted'), { canGet: false }).button, false);
    const f = permitSheetContext(item('forbidden'), { canGet: true });
    assert.equal(f.show, false); assert.match(f.warning, /25,000/);
  });
  test('the sheets wire it in: the item and vehicle sheets refuse the tick and offer the button', () => {
    const sh = read('src', 'module', 'applications', 'sheets.ts');
    assert.match(sh, /getPermit: SR2ItemSheet\.#onGetPermit/);
    assert.match(sh, /getPermit: SR2VehicleSheet\.#onGetPermit/);
    assert.equal((sh.match(/refusePermitTick\(this\.document, flat/g) ?? []).length, 2);
    for (const f of ['item-sheet.hbs', 'actor-vehicle-sheet.hbs']) {
      const t = read('public', 'templates', f);
      assert.match(t, /data-action="getPermit"/, f);
      assert.match(t, /\{\{#unless permit\.tickable\}\} disabled\{\{\/unless\}\}/, f);
    }
  });
});

describe('v0.91.5 review fixes', () => {
  const holder = (legality = 'restricted', extra: any = {}, more: any[] = []) => who({ name: 'Holder', nuyen: 5000 }, [{ id: 'w1', type: 'weapon', name: 'ZZ Rifle', system: { cost: 4000, legality, permit: false, ...extra } }, ...more]);
  test('R1: a player changing a permitted item\'s legality loses the permit; the GM doesn\'t', async () => {
    const { refusePermitTick } = await import('../applications/permits.ts');
    g.game.user = PLAYER();
    const ch: Record<string, unknown> = { 'system.legality': 'permit' };
    assert.equal(refusePermitTick({ system: { legality: 'restricted', permit: true } }, ch), true);
    assert.equal(ch['system.permit'], false);
    const same: Record<string, unknown> = { 'system.legality': 'restricted' };
    assert.equal(refusePermitTick({ system: { legality: 'restricted', permit: true } }, same), false);
    g.game.user = GM();
    const gm: Record<string, unknown> = { 'system.legality': 'permit' };
    assert.equal(refusePermitTick({ system: { legality: 'restricted', permit: true } }, gm), false);
    assert.equal(gm['system.permit'], undefined);
  });
  test('R2: a bought copy never brings the source\'s permit; the shop entry\'s permit doesn\'t silence the card', async () => {
    const { shopLine } = await import('../applications/shop.ts');
    const t: any = { type: 'weapon', name: 'X', system: { legality: 'restricted', permit: true }, data: { name: 'X', type: 'weapon', system: { legality: 'restricted', permit: true } } };
    const l = shopLine(t, 1);
    assert.equal(l.system.permit, false); assert.equal(l.data.system.permit, false);
    assert.equal(t.system.permit, true, 'the source is not changed');
    await withRule(RULES.SHOP_V915, 'permits', 'tick', () => assert.equal(shopLine(t, 1).system.permit, true));
    settings['itemTemplates'] = [{ ...RIFLE, system: { ...RIFLE.system, permit: true } }];
    const a = shopper();
    faces.push(6, 6, 1, 1, 1, 1);
    await a.findFromShop('tpl:w:t5');
    assert.match(chat.at(-1).content, /data-sr2e-legal="restricted"/);
    assert.equal(chat.at(-1).flags.sr2e.contest.deal.permit, false);
  });
  test('R3: the legality time counts however it is bought (itemAcquireHours)', async () => {
    const { itemAcquireHours } = await import('../rules/waiting.ts');
    const base = itemAcquireHours('weapon', { availability: '4/48 hrs' }, 0);
    assert.equal(itemAcquireHours('weapon', { availability: '4/48 hrs', legality: 'forbidden' }, 0), base * 2);
    await withRule(RULES.SHOP_V915, 'findByLegality', 'off', () => assert.equal(itemAcquireHours('weapon', { availability: '4/48 hrs', legality: 'forbidden' }, 0), base));
  });
  test('R5: a real licence covering it: no warning on the card, and no permit sold', async () => {
    const lic = { id: 'l1', type: 'gear', name: 'ZZ Licence', system: { quantity: 1, identity: { kind: 'licence', covers: 'restricted', fake: false, rating: 3 } } };
    const a = holder('restricted', {}, [lic]);
    assert.ok(a.licenceCover('ZZ Rifle', 'restricted'));
    assert.equal(await a.getPermit('item:w1'), false);
    assert.ok(warnings.some((w) => /covered/i.test(w)));
    assert.equal(a.system.nuyen, 5000);
  });
  test('a vehicle\'s permit: paid by its buyer, set on the vehicle (and only one the player owns)', async () => {
    const a = holder('legal');
    const v: any = new SR2Actor();
    v.type = 'vehicle'; v.name = 'ZZ Drone'; v.uuid = 'Actor.zzdrone'; v.id = 'zzdrone'; v.isOwner = true;
    v.system = { cost: 8000, legality: 'permit', permit: false };
    v.testUserPermission = () => true;
    uuidRegistry.set(v.uuid, v);
    g.game.users = Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } });
    assert.equal(await a.getPermit('vehicle:Actor.zzdrone'), true, 'the GM (no players own the buyer)');
    assert.equal(v.system.permit, true);
    assert.equal(a.system.nuyen, 4200, '10% of ¥8,000');
    v.system.permit = false; v.isOwner = false;
    g.game.user = PLAYER();
    assert.equal(await a.getPermit('vehicle:Actor.zzdrone'), false, 'a player must own the vehicle');
  });
  test('an approved request: the GM pays from the character at the filed cost; a changed cost is refused', async () => {
    const { approveRequest } = await import('../applications/approvals.ts');
    const a = holder();
    settings['approvalQueue'] = true;
    a.flags.sr2e = { creation: { v: 1 } };
    g.game.user = PLAYER();
    assert.equal(await a.getPermit('item:w1'), 'requested');
    const id = Object.keys(a.flags.sr2e.requests)[0]!;
    g.game.user = GM();
    a.items.get('w1').system.cost = 8000;
    assert.equal(await approveRequest(a, id), false, 'the cost changed since it was filed');
    assert.equal(a.system.nuyen, 5000);
    a.items.get('w1').system.cost = 4000;
    g.game.user = PLAYER();
    assert.equal(await a.getPermit('item:w1'), 'requested');
    const id2 = Object.entries(a.flags.sr2e.requests).find(([, r]: any) => r)![0];
    g.game.user = GM();
    assert.equal(await approveRequest(a, id2), true);
    assert.equal(a.system.nuyen, 4000);
    assert.equal(a.items.get('w1').system.permit, true);
  });
});
