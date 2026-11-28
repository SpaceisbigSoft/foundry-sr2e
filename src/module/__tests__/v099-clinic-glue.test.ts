/**
 * v0.99.0 rules completeness, clinics, surgery and ware damage (RULES.CLINIC_V99): the Foundry glue
 * (applications/clinic99.ts) with small stubs (scripted dice, a chat log, users, world settings, plain actors and
 * items): the GM's clinic search and its world record, the removal test, the ware damage levels (the owner's item level,
 * the lead GM's copy into the record, a player lowering their own level, the GM's confirmed clear after a player's
 * repair), the feedback penalty, the surgeon's fee once per operation; and for the switches that 'v980' gives the
 * v0.98.0 behaviour at the read site.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { SYSTEM_ID as S } from '../config/system.ts';

const g = globalThis as any;
const faces: number[] = [];
const chat: any[] = [];
const warnings: string[] = [];
const registry = new Map<string, any>();
const settings: Record<string, any> = {};
const hooks: Record<string, Array<(...a: any[]) => any>> = {};
let confirmAnswer = true;
let mid = 0;
let G: any;
let X: any;

class StubRoll {
  formula: string;
  dice: any[] = [];
  constructor(formula: string) { this.formula = formula; }
  async evaluate() {
    const n = Number(/^(\d+)d6$/.exec(this.formula)![1]);
    const results = Array.from({ length: n }, () => { const f = faces.shift(); if (f === undefined) throw new Error('out of scripted faces'); return { result: f }; });
    this.dice = [{ results }];
    return this;
  }
}

const GM = { id: 'gm1', name: 'GM', isGM: true };
const P1 = { id: 'p1', name: 'Player', isGM: false };
const P2 = { id: 'p2', name: 'Other', isGM: false };

function asMessage(d: any, author: any) {
  return { id: `m${++mid}`, author, ...d,
    getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; },
    async update(u: Record<string, any>) {
      if (!(g.game.user.isGM || g.game.user.id === this.author.id)) return;
      for (const [p, v] of Object.entries(u)) { const [, sys, k] = p.split('.'); ((this.flags ??= {})[sys!] ??= {})[k!] = v; }
    } } as any;
}

function setPath(o: any, path: string, v: unknown): void {
  const parts = path.split('.');
  let t: any = o;
  for (const q of parts.slice(0, -1)) t = (t[q] ??= {});
  t[parts[parts.length - 1]!] = v;
}

function actor(o: any) {
  const a: any = {
    type: 'character', items: [], flags: {}, owners: [] as string[], nuyen: 1_000_000, ...o,
    get isOwner() { return g.game.user.isGM || this.owners.includes(g.game.user.id); },
    testUserPermission(u: any) { return u.isGM || this.owners.includes(u.id); },
    findSkill(n: string) { const r = this.skills?.[n]; return r ? { name: n, system: { rating: r } } : null; },
    getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; },
    async setFlag(s: string, k: string, v: any) { if (!this.isOwner) throw new Error('not owner'); ((this.flags ??= {})[s] ??= {})[k] = v; },
    async update(u: Record<string, any>) { if (!this.isOwner) throw new Error('not owner'); for (const [p, v] of Object.entries(u)) setPath(this, p, v); },
    async adjustNuyen(n: number) { if (this.nuyen + n < 0) return false; this.nuyen += n; return true; },
    woundModifiers() { return []; },
  };
  registry.set(a.uuid, a);
  return a;
}
/** A repair test's card (as SR2Actor.#post makes it) by the current user, for the runner's wired reflexes. */
async function repairCard(testId: string, totals: number[], o: any = {}) {
  return g.ChatMessage.create({ content: '', flags: { [S]: { test: { kind: 'cyberRepair', testId, actorUuid: 'Actor.run', targetNumber: 3, successes: totals.filter((x) => x >= 3).length, dice: totals.map((total) => ({ total })), cyberRepair: { itemId: 'w', itemName: 'Wired Reflexes', ownerUuid: 'Actor.run' }, ...o } } } });
}

function item(parent: any, o: any) {
  const i: any = {
    type: 'cyberware', flags: {}, parent, ...o, uuid: `${parent.uuid}.Item.${o.id}`,
    system: { installed: true, grade: 'standard', essenceCost: 1, cost: 10000, ...(o.system ?? {}) },
    getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; },
    async setFlag(s: string, k: string, v: any) { if (!parent.isOwner) throw new Error('not owner'); ((this.flags ??= {})[s] ??= {})[k] = v; for (const h of hooks['updateItem'] ?? []) h(this, { flags: { [s]: { [k]: v } } }); },
    async update(u: Record<string, any>) { if (!parent.isOwner) throw new Error('not owner'); for (const [p, v] of Object.entries(u)) setPath(this, p, v); },
  };
  parent.items.push(i);
  registry.set(i.uuid, i);
  return i;
}

before(async () => {
  for (const f of ['clinic99.json', 'clinic99-fix.json', 'clinic99-fix-replace.json']) {
    const draft = join('i18n-drafts', f);
    if (!existsSync(draft)) continue;
    const add = Object.fromEntries(Object.entries(JSON.parse(readFileSync(draft, 'utf8')) as Record<string, string>).map(([k, v]) => [k.replace(/^REPLACE:/, ''), v]));
    g.__SR2E_EN__ = { ...(g.__SR2E_EN__ ?? {}), ...add };
  }
  g.foundry = { abstract: { TypeDataModel: class {} }, utils: { randomID: () => `r${++mid}` }, applications: { api: { DialogV2: {
    confirm: async () => confirmAnswer, prompt: async () => null, wait: async () => null,
  } } } };
  g.Roll = StubRoll;
  g.ui = { notifications: { warn: (t: string) => warnings.push(t), info: () => {} } };
  g.Hooks = { on: (k: string, f: any) => { (hooks[k] ??= []).push(f); }, once: () => {} };
  const users: any = [GM, P1, P2];
  users.get = (id: string) => users.find((u: any) => u.id === id);
  g.game = { user: GM, users, actors: [] as any[], time: { worldTime: 100 }, messages: { contents: chat },
    settings: {
      register: () => {},
      get: (_s: string, k: string) => settings[k] ?? {},
      set: async (_s: string, k: string, v: any) => { if (!g.game.user.isGM) throw new Error('players cannot write world settings'); settings[k] = v; },
    } };
  g.ChatMessage = { create: async (d: any) => { const by = d.author ? g.game.users.get(d.author) : g.game.user; const m = asMessage({ ...d, author: undefined }, by); m.author = by; chat.push(m); return m; }, getSpeaker: () => ({}) };
  g.fromUuidSync = (u: string) => registry.get(u) ?? null;
  g.fromUuid = async (u: string) => registry.get(u) ?? null;
  g.CONFIG = { Actor: { documentClass: { essenceOf: (i: any) => Number(i.system.essenceCost) } } };
  G = await import('../applications/clinic99.ts');
  X = await import('../rules/clinic99.ts');
  G.registerClinic99(() => g.game.user.isGM);
});

let runner: any, fixer: any, doc: any, wired: any;
beforeEach(() => {
  chat.length = 0; warnings.length = 0; faces.length = 0; confirmAnswer = true;
  for (const k of Object.keys(settings)) delete settings[k];
  X?.resetRecordCache?.();
  g.CONFIG.Actor.documentClass.actingAuthor = null;
  g.game.user = GM;
  runner = actor({ uuid: 'Actor.run', name: 'Runner', owners: ['p1'], system: { essence: 6, essenceShift: 0, derived: { essence: 4.5 }, attributes: { intelligence: { total: 5 } } } });
  fixer = actor({ uuid: 'Actor.fix', name: 'Fixer', skills: { Etiquette: 4 }, system: { attributes: { intelligence: { total: 5 }, charisma: { total: 3 } } } });
  doc = actor({ uuid: 'Actor.doc', name: 'Doc', skills: { Biotech: 5, Cybertechnology: 3 }, system: { attributes: { intelligence: { total: 4 } } } });
  wired = item(runner, { id: 'w', name: 'Wired Reflexes', system: { essenceCost: 2 } });
  g.game.actors = [runner, fixer, doc];
});

describe('finding a shadow clinic: the GM\'s client rolls, the world record keeps it', () => {
  test('the contact knows one: Etiquette (Street) vs 12; the record names the character\'s alpha clinic', async () => {
    faces.push(6, 6, 1, 1, 6, 1, ...Array(20).fill(1));
    const r = await G.findClinic({ patient: runner, contact: fixer, grade: 'alpha', route: 'street', mode: 'knows', etiquette: 4, intelligence: 5, charisma: 3 });
    assert.equal(r.found, true);
    assert.ok(settings[G.CLINIC_SETTING].Actor_run.alpha);
    assert.equal(G.surgeryCharges(runner, { system: { grade: 'alpha' } }, 0.5).clinic, true);
    assert.equal(G.surgeryCharges(runner, { system: { grade: 'beta' } }, 0.5).clinic, false);
  });
  test('a failed search records nothing; a player can\'t run it', async () => {
    faces.push(...Array(30).fill(1));
    const r = await G.findClinic({ patient: runner, contact: fixer, grade: 'beta', route: 'corp', mode: 'search', etiquette: 4, intelligence: 5, charisma: 3 });
    assert.equal(r.found, false);
    assert.equal(settings[G.CLINIC_SETTING], undefined);
    g.game.user = P1;
    assert.equal(await G.findClinic({ patient: runner, grade: 'delta', route: 'corp', mode: 'knows', etiquette: 0, intelligence: 0, charisma: 0 }), null);
  });
  test('delta: no test, the GM\'s record', async () => {
    await G.findClinic({ patient: runner, grade: 'delta', route: 'corp', mode: 'knows', etiquette: 0, intelligence: 0, charisma: 0 });
    assert.ok(settings[G.CLINIC_SETTING].Actor_run.delta);
  });
  test('v980: no clinic note on graded surgery', (t) => {
    t.after(oldWay({ 'CLINIC_V99.clinicSearch': 'v980' }));
    assert.equal(G.surgeryCharges(runner, { system: { grade: 'alpha' } }, 0.5).clinic, null);
  });
});

describe('ware damage levels: the owner\'s level, the GM\'s record', () => {
  test('a hit on the owner\'s client sets the item\'s level; the lead GM copies the rise into the record', async () => {
    g.game.user = P1;
    assert.equal(await G.recordHit(wired, 'L'), 'L');
    assert.equal(settings[G.DAMAGE_SETTING], undefined, 'a player writes no world setting');
    // The lead GM's client sees the item's flag change (the hook every client runs).
    g.game.user = GM;
    for (const h of hooks['updateItem'] ?? []) h(wired, { flags: { [S]: { [X.WARE_FLAG]: 'L' } } });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(wired.flags[S][X.WARE_FLAG], 'L');
    assert.equal(settings[G.DAMAGE_SETTING].Actor_run_Item_w, 'L');
    // The player lowers their own item's level: the record still counts.
    g.game.user = P1;
    await wired.update({ [`flags.${S}.${X.WARE_FLAG}`]: '' });
    assert.equal(X.wareLevel(wired), 'L');
  });
  test('hits accumulate; Moderate+ marks it damaged; the feedback penalty', async () => {
    await G.recordHit(wired, 'L');
    assert.equal(await G.recordHit(wired, 'S'), 'D');
    assert.equal(wired.system.damaged, true);
    assert.equal(settings[G.DAMAGE_SETTING].Actor_run_Item_w, 'D');
    runner.items.push(item(runner, { id: 'e', name: 'Cybereyes' }));
    assert.deepEqual(G.feedbackMods(runner).map((m: any) => m.value), [2]);
  });
  test('a player\'s repair asks the GM; the GM\'s confirmed click clears the record (the author must own the ware)', async () => {
    await G.recordHit(wired, 'M');
    g.game.user = P1;
    await repairCard('t1', [5]);
    const note = await G.repaired(wired, { repairer: runner, testId: 't1' });
    assert.ok(note);
    assert.equal(wired.flags[S][X.WARE_FLAG], '');
    assert.equal(X.wareLevel(wired), 'M', 'still counts until the GM clears it');
    const card = chat[chat.length - 1];
    assert.deepEqual(card.flags[S][G.CLEAR_FLAG], { itemUuid: 'Actor.run.Item.w', ownerUuid: 'Actor.run', testId: 't1' });
    await G.onCard(card, { disabled: false }, 'clinic99Clear');
    assert.ok(warnings.length, 'a player cannot use it');
    assert.equal(X.wareLevel(wired), 'M');
    g.game.user = GM;
    confirmAnswer = false;
    await G.onCard(card, { disabled: false }, 'clinic99Clear');
    assert.equal(X.wareLevel(wired), 'M', 'declined');
    confirmAnswer = true;
    await G.onCard(card, { disabled: false }, 'clinic99Clear');
    assert.equal(X.wareLevel(wired), '');
  });
  test('a card by someone who doesn\'t own the ware is refused', async () => {
    await G.recordHit(wired, 'S');
    g.game.user = P2;
    const forged = await g.ChatMessage.create({ content: '', flags: { [S]: { [G.CLEAR_FLAG]: { itemUuid: 'Actor.run.Item.w' } } } });
    g.game.user = GM;
    await G.onCard(forged, { disabled: false }, 'clinic99Clear');
    assert.equal(X.wareLevel(wired), 'S');
  });
  test('a GM\'s own repair clears both at once; destroyed ware has no repair', async () => {
    await G.recordHit(wired, 'S');
    assert.equal(await G.repaired(wired), '');
    assert.equal(X.wareLevel(wired), '');
    await G.setLevelAsGm(wired, 'X');
    assert.equal(G.repairSpecFor(wired).why, 'SR2E.Clinic99.Why.destroyed');
  });
  test('repair by level: the lower skill, the TN and the hours', async () => {
    await G.setLevelAsGm(wired, 'L');
    assert.equal(G.repairSkill(doc).name, 'Cybertechnology');
    assert.deepEqual(G.repairSpecFor(wired), { tn: 2, hours: 4, level: 'L' });
    assert.equal(G.repairNote(wired, 2).hours, 2);
    assert.match(G.repairNoteHtml(wired), /TN 2/);
  });
  test('v980: the hit writes no level; the old repair pick', async (t) => {
    t.after(oldWay({ 'CLINIC_V99.damageLevels': 'v980', 'CLINIC_V99.repair': 'v980' }));
    assert.equal(await G.recordHit(wired, 'S'), '');
    assert.equal(wired.flags[S]?.[X.WARE_FLAG], undefined);
    assert.equal(G.repairSkill(doc), undefined);
    assert.equal(G.repairSpecFor(wired), null);
    assert.deepEqual(G.feedbackMods(runner), []);
    assert.deepEqual(G.repairChanges(), []);
  });
});

describe('removing cyberware: the GM\'s client', () => {
  test('no successes: the ware comes out and 10% more Essence goes', async () => {
    faces.push(...Array(10).fill(1));
    const r = await G.removeWare(runner, wired, doc);
    assert.deepEqual(r, { successes: 0, loss: 0.2 });
    assert.equal(wired.system.installed, false);
    assert.equal(runner.system.essenceShift, -0.2);
  });
  test('a success: no extra loss; a player can\'t run it; v980 off', async (t) => {
    faces.push(6, 1, 1, ...Array(10).fill(1));
    assert.deepEqual(await G.removeWare(runner, wired, doc), { successes: 1, loss: 0 });
    const other = item(runner, { id: 'o', name: 'Datajack', system: { essenceCost: 0.2 } });
    g.game.user = P1;
    assert.equal(await G.removeWare(runner, other, doc), null);
    g.game.user = GM;
    t.after(oldWay({ 'CLINIC_V99.removal': 'v980' }));
    assert.equal(await G.removeWare(runner, other, doc), null);
  });
});

describe('the surgeon\'s fee: once per operation, graded × 50', () => {
  test('alpha ware, 0.5 Essence: the list price by the Essence it costs (fix C3: .4 at alpha, 5,000), charged once', async () => {
    const alpha = item(runner, { id: 'a', name: 'Cybereyes', system: { grade: 'alpha', essenceCost: 0.5, installed: false } });
    runner.nuyen = 2_000_000;
    const n1 = await G.chargeSurgeonFee(runner, alpha, { id: 'op1', points: 0.5, pay: true, itemName: 'Cybereyes' });
    assert.ok(n1);
    assert.equal(runner.nuyen, 2_000_000 - 5_000);
    await G.chargeSurgeonFee(runner, alpha, { id: 'op1', points: 0.5, pay: true, itemName: 'Cybereyes' });
    assert.equal(runner.nuyen, 1_995_000, 'once');
    assert.equal(G.careFactor99(alpha), 50);
    assert.equal(G.feeApplyText(runner, alpha, { id: 'op1', points: 0.5, pay: true }), '');
  });
  test('not enough money: noted, nothing charged; v980: no fee', async (t) => {
    runner.nuyen = 10;
    const std = item(runner, { id: 's', name: 'Datajack', system: { essenceCost: 0.2, installed: false } });
    await G.chargeSurgeonFee(runner, std, { id: 'op2', points: 0.2, pay: true, itemName: 'Datajack' });
    assert.equal(runner.nuyen, 10);
    t.after(oldWay({ 'CLINIC_V99.surgeonFee': 'v980', 'CLINIC_V99.gradedFees': 'v980' }));
    runner.nuyen = 100_000;
    await G.chargeSurgeonFee(runner, std, { id: 'op3', points: 0.2, pay: true, itemName: 'Datajack' });
    assert.equal(runner.nuyen, 100_000);
    assert.equal(G.careFactor99({ system: { grade: 'delta' } }), 1);
  });
});

describe('the model\'s hooks (models/index.ts augmentationsOf)', () => {
  test('Light halves the ware\'s Reaction and Initiative dice; Moderate stops it; v980 the old numbers', async (t) => {
    g.Actor ??= class {};
    g.Item ??= class {};
    const { augmentationsOf } = await import('../models/index.ts');
    const a = actor({ uuid: 'Actor.m', name: 'M', system: { recovering: [], qualities: [], magic: 0 } });
    const w = item(a, { id: 'r', name: 'Wired Reflexes', system: { reaction: 2, initiativeDice: 1, attributes: { quickness: 2 } } });
    await G.setLevelAsGm(w, 'L');
    const l: any = augmentationsOf(a)[0];
    assert.deepEqual([l.reaction, l.initiativeDice, l.attributes.quickness, l.damaged], [1, 0, 1, false]);
    await G.setLevelAsGm(w, 'M');
    assert.equal((augmentationsOf(a)[0] as any).damaged, true);
    t.after(oldWay({ 'CLINIC_V99.damageLevels': 'v980' }));
    w.system.damaged = false;
    const o: any = augmentationsOf(a)[0];
    assert.deepEqual([o.reaction, o.initiativeDice, o.damaged], [2, 1, false]);
  });
});

describe('v0.99.0 fixes: the record\'s trust (S1–S5, P1–P3)', () => {
  const cls = () => g.CONFIG.Actor.documentClass;
  const lastClear = () => [...chat].reverse().find((m: any) => m.flags?.[S]?.[G.CLEAR_FLAG]);

  test('S1: a GM\'s re-run of a player\'s repair asks (as that player) instead of clearing; a re-run for a non-owner is refused', async () => {
    await G.recordHit(wired, 'M');
    cls().actingAuthor = P1;
    await G.repaired(wired, { repairer: runner, testId: 't1' });
    assert.equal(X.wareLevel(wired), 'M', 'not cleared with the GM\'s rights');
    assert.equal(lastClear()?.author?.id, 'p1', 'the ask is the player\'s');
    chat.length = 0;
    wired.flags[S][X.WARE_FLAG] = 'M';
    cls().actingAuthor = P2;
    assert.equal(await G.repaired(wired, { repairer: runner, testId: 't1' }), '');
    assert.equal(chat.length, 0);
    assert.equal(wired.flags[S][X.WARE_FLAG], 'M', 'nothing written');
  });

  test('S4, P1: the clear needs a real repair test of this ware; a used card or test is refused', async () => {
    await G.recordHit(wired, 'M');
    g.game.user = P1;
    await G.repaired(wired, { repairer: runner, testId: 'none' });
    g.game.user = GM;
    await G.onCard(lastClear(), null, 'clinic99Clear');
    assert.equal(X.wareLevel(wired), 'M', 'no repair card behind it');
    g.game.user = P1;
    await repairCard('t2', [2, 2], { successes: 4 });
    await G.repaired(wired, { repairer: runner, testId: 't2' });
    g.game.user = GM;
    await G.onCard(lastClear(), null, 'clinic99Clear');
    assert.equal(X.wareLevel(wired), 'M', 'forged successes: none at TN 3 counted again');
    g.game.user = P1;
    await repairCard('t3', [6]);
    await G.repaired(wired, { repairer: runner, testId: 't3' });
    const card = lastClear();
    g.game.user = GM;
    await G.onCard(card, null, 'clinic99Clear');
    assert.equal(X.wareLevel(wired), '');
    // The ware is hit again; the same card, or a copy naming the same test, clears nothing.
    await G.recordHit(wired, 'M');
    await G.onCard(card, null, 'clinic99Clear');
    g.game.user = P1;
    await G.repaired(wired, { repairer: runner, testId: 't3' });
    g.game.user = GM;
    await G.onCard(lastClear(), null, 'clinic99Clear');
    assert.equal(X.wareLevel(wired), 'M');
    assert.ok(settings[G.META_SETTING].used.includes('test:t3'));
  });

  test('S4: a repair card by another player, or of other ware, is no proof', async () => {
    await G.recordHit(wired, 'S');
    g.game.user = P2;
    await repairCard('t4', [6, 6]);
    g.game.user = P1;
    await G.repaired(wired, { repairer: runner, testId: 't4' });
    g.game.user = GM;
    assert.equal(await G.applyClear(lastClear()), false);
    assert.equal(X.wareLevel(wired), 'S');
  });

  test('S5, P3: a project repair clears nothing at the start; its effect\'s test id makes the lead GM clear (the GM\'s test) or ask (a player\'s)', async () => {
    await G.recordHit(wired, 'M');
    assert.equal(await G.repaired(wired, { project: true, repairer: runner }), '');
    assert.equal(wired.flags[S][X.WARE_FLAG], 'M', 'the item keeps its level while the work goes on');
    const changes = G.repairChanges('t5');
    assert.deepEqual(changes.map((c: any) => c[0]), [`flags.${S}.${X.WARE_FLAG}`, `flags.${S}.${G.FIX_FLAG}`]);
    g.game.user = P1;
    await repairCard('t5', [6]);
    g.game.user = GM;
    for (const [k, v] of changes) setPath(wired, k, v);
    for (const h of hooks['updateItem'] ?? []) h(wired, { flags: { [S]: { [X.WARE_FLAG]: '', [G.FIX_FLAG]: 't5' } } });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(X.wareLevel(wired), 'M', 'a player\'s repair: the GM is asked');
    assert.equal(lastClear()?.flags[S][G.CLEAR_FLAG].testId, 't5');
    assert.equal(lastClear()?.author?.id, 'gm1');
    await G.onCard(lastClear(), null, 'clinic99Clear');
    assert.equal(X.wareLevel(wired), '');
    // The GM's own repair project: cleared at once when done.
    await G.recordHit(wired, 'M');
    await repairCard('t6', [6]);
    assert.equal(await G.completedRepair(wired, 't6'), true);
    assert.equal(X.wareLevel(wired), 'M', 'the item\'s own level is still M until the effect clears it');
    wired.flags[S][X.WARE_FLAG] = '';
    assert.equal(X.wareLevel(wired), '');
    // A made-up test id gets no card at all.
    await G.recordHit(wired, 'M');
    const n = chat.length;
    assert.equal(await G.completedRepair(wired, 'nothing'), false);
    assert.equal(chat.length, n);
  });

  test('P2: the reload sweep ignores an item level the GM cleared since it last changed', async () => {
    await G.recordHit(wired, 'M');
    wired._stats = { modifiedTime: Date.now() - 1000 };
    await G.setLevelAsGm(wired, '');
    wired.flags[S][X.WARE_FLAG] = 'M'; // a stale level left on the item
    await G.sweepLevels();
    assert.equal(X.recordedLevel(wired.uuid), '');
    wired._stats = { modifiedTime: Date.now() + 1000 }; // changed since: a new hit
    await G.sweepLevels();
    assert.equal(X.recordedLevel(wired.uuid), 'M');
  });

  test('S2: the sweep drops keys whose item is gone; a character\'s full share whispers the GM and skips the write', async () => {
    settings[G.DAMAGE_SETTING] = { Actor_gone_Item_x: 'S', Actor_run_Item_w: 'L' };
    X.resetRecordCache();
    await G.sweepLevels();
    assert.deepEqual(Object.keys(settings[G.DAMAGE_SETTING]), ['Actor_run_Item_w']);
    const full: Record<string, string> = {};
    for (let i = 0; i < X.RECORD_PER_ACTOR; i++) full[`Actor_run_Item_f${i}`] = 'L';
    settings[G.DAMAGE_SETTING] = full;
    X.resetRecordCache();
    chat.length = 0;
    assert.equal(await G.recordRise(wired, 'S'), false);
    assert.equal(settings[G.DAMAGE_SETTING].Actor_run_Item_w, undefined);
    assert.ok(chat.some((m: any) => /100/.test(m.content)), 'the GM is told');
  });

  test('S3: ware a player deletes keeps its level for the same ware made again on that character; the GM\'s delete doesn\'t', async () => {
    await G.recordHit(wired, 'S');
    await G.wareDeleted(wired, 'p1');
    assert.equal(settings[G.DAMAGE_SETTING].Actor_run_Item_w, undefined, 'its key leaves the record');
    const again = item(runner, { id: 'w2', name: 'Wired Reflexes' });
    assert.equal(await G.wareCreated(again), true);
    assert.equal(X.wareLevel(again), 'S');
    assert.ok(chat.at(-1).whisper.includes('gm1'));
    assert.equal(await G.wareCreated(item(runner, { id: 'w3', name: 'Wired Reflexes' })), false, 'once');
    await G.wareDeleted(again, 'gm1');
    assert.equal(await G.wareCreated(item(runner, { id: 'w4', name: 'Wired Reflexes' })), false);
  });
});

describe('v0.99.0 fixes: removal, the tool and the surgeon\'s fee (C6, S6, S8, P4, P6, C7)', () => {
  const cls = () => g.CONFIG.Actor.documentClass;

  test('C6: a player\'s unticking of Installed is refused; a GM is warned; a GM\'s re-run for a player is refused; v980 lets it', (t) => {
    const ch = () => ({ system: { installed: false } });
    let c: any = ch();
    assert.equal(G.preUntick(wired, c, 'p1'), false);
    c = { system: { installed: false, notes: 'x' } };
    G.preUntick(wired, c, 'p1');
    assert.deepEqual(c, { system: { notes: 'x' } });
    c = ch();
    assert.equal(G.preUntick(wired, c, 'gm1'), undefined);
    assert.equal(c.system.installed, false, 'the GM\'s own change goes through');
    cls().actingAuthor = P1;
    assert.equal(G.preUntick(wired, ch(), 'gm1'), false);
    cls().actingAuthor = null;
    assert.equal(G.preUntick(wired, { system: { installed: true } }, 'p1'), undefined);
    t.after(oldWay({ 'CLINIC_V99.removal': 'v980' }));
    assert.equal(G.preUntick(wired, ch(), 'p1'), undefined);
  });

  test('S8: the removal checks the ware is still in inside its step', async () => {
    const Real = g.Roll;
    g.Roll = class extends Real { async evaluate() { wired.system.installed = false; return super.evaluate(); } };
    faces.push(...Array(10).fill(1));
    try { assert.equal(await G.removeWare(runner, wired, doc), null); } finally { g.Roll = Real; }
    assert.equal(runner.system.essenceShift, 0, 'no Essence taken');
  });

  test('S8, P6: the tool opens once at a time', async () => {
    const api = g.foundry.applications.api.DialogV2;
    const real = api.wait;
    let calls = 0;
    let done: (v: any) => void = () => {};
    api.wait = () => { calls++; return new Promise((r) => { done = r; }); };
    try {
      const first = G.openClinicTool();
      await G.openClinicTool();
      done(null);
      await first;
      assert.equal(calls, 1);
      const second = G.openClinicTool();
      done(null);
      await second;
      assert.equal(calls, 2, 'open again once closed');
    } finally { api.wait = real; }
  });

  test('S6, P4: the GM\'s client keeps the paid mark in its own record (the patient\'s flag doesn\'t count); once per ware; the frozen grade', async () => {
    const eyes = item(runner, { id: 'e', name: 'Cybereyes', system: { grade: 'standard', essenceCost: 0.5, installed: false } });
    runner.flags[S] = { ...(runner.flags[S] ?? {}), [G.FEE_FLAG]: { 'op-op9': 1, 'e-install': 1 } };
    runner.nuyen = 100_000;
    assert.match(G.feeApplyText(runner, eyes, { id: 'op9', points: 0.5, pay: true }), /25,000/, 'a forged mark is ignored');
    await G.chargeSurgeonFee(runner, eyes, { id: 'op9', points: 0.5, pay: true, itemName: 'Cybereyes' });
    assert.equal(runner.nuyen, 75_000);
    assert.equal(settings[G.FEE_SETTING].Actor_run['e-install'], 25_000);
    await G.chargeSurgeonFee(runner, eyes, { id: 'op10', points: 0.5, pay: true, itemName: 'Cybereyes' });
    assert.equal(runner.nuyen, 75_000, 'a second operation on the same ware pays nothing more');
    // The grade frozen on the card when rolled, not the item's later grade.
    eyes.system.grade = 'standard';
    assert.equal(G.careFactor99(eyes, 'delta'), 200);
    assert.equal(G.careFactor99(eyes), 1);
    assert.deepEqual(G.frozenGrade({ system: { grade: 'beta' } }), { grade99: 'beta' });
  });

  test('P4: no surgery on ware already in; one Surgery dialog per item at a time; v980 allows it', async (t) => {
    assert.equal(G.surgeryRefused(wired), true);
    assert.equal(G.surgeryRefused({ name: 'x', system: { installed: false } }), false);
    let runs = 0;
    let done: () => void = () => {};
    const a = G.oneSurgery('k', () => { runs++; return new Promise<void>((r) => { done = r; }); });
    await G.oneSurgery('k', async () => { runs++; });
    done();
    await a;
    assert.equal(runs, 1);
    t.after(oldWay({ 'CLINIC_V99.surgeonFee': 'v980' }));
    assert.equal(G.surgeryRefused(wired), false);
  });

  test('C7: a change of care refunds no more than was paid; v980 the old refund', (t) => {
    assert.equal(G.careRefund({ paidAmount: 300 }, 60_000), 300);
    assert.equal(G.careRefund({}, 600), 600, 'a recovery from before: the old way');
    t.after(oldWay({ 'CLINIC_V99.gradedFees': 'v980' }));
    assert.equal(G.careRefund({ paidAmount: 300 }, 60_000), 60_000);
  });
});
