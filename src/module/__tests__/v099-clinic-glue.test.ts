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
  const draft = join('i18n-drafts', 'clinic99.json');
  if (existsSync(draft)) g.__SR2E_EN__ = { ...(g.__SR2E_EN__ ?? {}), ...JSON.parse(readFileSync(draft, 'utf8')) };
  g.foundry = { abstract: { TypeDataModel: class {} }, utils: { randomID: () => `r${++mid}` }, applications: { api: { DialogV2: {
    confirm: async () => confirmAnswer, prompt: async () => null, wait: async () => null,
  } } } };
  g.Roll = StubRoll;
  g.ui = { notifications: { warn: (t: string) => warnings.push(t), info: () => {} } };
  g.Hooks = { on: (k: string, f: any) => { (hooks[k] ??= []).push(f); }, once: () => {} };
  g.game = { user: GM, users: [GM, P1, P2], actors: [] as any[], time: { worldTime: 100 }, messages: { contents: chat },
    settings: {
      register: () => {},
      get: (_s: string, k: string) => settings[k] ?? {},
      set: async (_s: string, k: string, v: any) => { if (!g.game.user.isGM) throw new Error('players cannot write world settings'); settings[k] = v; },
    } };
  g.ChatMessage = { create: async (d: any) => { const m = asMessage(d, g.game.user); chat.push(m); return m; }, getSpeaker: () => ({}) };
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
    const note = await G.repaired(wired, { repairer: runner });
    assert.ok(note);
    assert.equal(wired.flags[S][X.WARE_FLAG], '');
    assert.equal(X.wareLevel(wired), 'M', 'still counts until the GM clears it');
    const card = chat[chat.length - 1];
    assert.deepEqual(card.flags[S][G.CLEAR_FLAG], { itemUuid: 'Actor.run.Item.w', ownerUuid: 'Actor.run' });
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
  test('alpha ware, 0.5 Essence: 25,000 × 50, charged once', async () => {
    const alpha = item(runner, { id: 'a', name: 'Cybereyes', system: { grade: 'alpha', essenceCost: 0.5, installed: false } });
    runner.nuyen = 2_000_000;
    const n1 = await G.chargeSurgeonFee(runner, alpha, { id: 'op1', points: 0.5, pay: true, itemName: 'Cybereyes' });
    assert.ok(n1);
    assert.equal(runner.nuyen, 2_000_000 - 1_250_000);
    await G.chargeSurgeonFee(runner, alpha, { id: 'op1', points: 0.5, pay: true, itemName: 'Cybereyes' });
    assert.equal(runner.nuyen, 750_000, 'once');
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
