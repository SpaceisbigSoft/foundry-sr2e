/**
 * v0.98.0 rules completeness, building security and vehicle upkeep (RULES.VSEC_V98): the Foundry glue
 * (applications/vsec98.ts) with small stubs (scripted dice, a chat log, users, plain actors): an access step's request,
 * the owner's roll and the GM's re-checked Apply (the trust checks), rigger combat's card and its resistance, the site
 * panel's device ratings, the security rigger's Perception Test, motion sensors in detection, the repair card's parts
 * line and the rigger decking TN; and for the switches that 'v971' gives the v0.97.1 behaviour at the read site.
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
const siteChanges: any[] = [];
let confirmAnswer = true;
let promptAnswer: unknown = null;
let mid = 0;
let G: any;

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
  const m: any = { id: `m${++mid}`, author, ...d, isOwner: author.isGM || g.game.user.id === author.id,
    getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; },
    async setFlag(s: string, k: string, v: any) { ((this.flags ??= {})[s] ??= {})[k] = v; } };
  return m;
}

function actor(o: any) {
  const a: any = {
    type: 'character', items: [], flags: {}, owners: [] as string[], ...o,
    get isOwner() { return g.game.user.isGM || this.owners.includes(g.game.user.id); },
    testUserPermission(u: any) { return u.isGM || this.owners.includes(u.id); },
    findSkill(n: string) { const r = this.skills?.[n]; return r ? { name: n, system: { rating: r } } : null; },
    getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; },
    async setFlag(s: string, k: string, v: any) { ((this.flags ??= {})[s] ??= {})[k] = v; },
    async update(u: Record<string, any>) {
      for (const [p, v] of Object.entries(u)) {
        const parts = p.split('.');
        let t: any = this;
        for (const q of parts.slice(0, -1)) t = (t[q] ??= {});
        t[parts[parts.length - 1]!] = v;
      }
    },
  };
  registry.set(a.uuid, a);
  return a;
}
const attrs = (w: number, b: number, i: number) => ({ willpower: { total: w }, body: { total: b }, intelligence: { total: i }, quickness: { total: 4 } });

before(async () => {
  const draft = join('i18n-drafts', 'vsec98.json');
  if (existsSync(draft)) g.__SR2E_EN__ = { ...(g.__SR2E_EN__ ?? {}), ...JSON.parse(readFileSync(draft, 'utf8')) };
  g.foundry = { abstract: { TypeDataModel: class {} }, utils: { randomID: () => `r${++mid}` }, applications: { api: { DialogV2: {
    confirm: async () => confirmAnswer, prompt: async () => promptAnswer, wait: async () => null,
  } } } };
  g.Roll = StubRoll;
  g.ui = { notifications: { warn: (t: string) => warnings.push(t), info: () => {} } };
  g.game = { user: GM, users: [GM, P1, P2], messages: { get: (id: string) => chat.find((m) => m.id === id) ?? null, get contents() { return chat; } }, combat: null };
  g.ChatMessage = { create: async (d: any) => { const m = asMessage(d, g.game.user); chat.push(m); return m; }, getSpeaker: () => ({}) };
  g.fromUuidSync = (u: string) => registry.get(u) ?? null;
  g.fromUuid = async (u: string) => registry.get(u) ?? null;
  g.CONFIG = { Actor: { documentClass: { changeSite: async (site: any, c: any) => { siteChanges.push({ site: site.uuid, ...c }); }, tokenFor: () => null } } };
  G = await import('../applications/vsec98.ts');
});

let site: any, runner: any, sec: any;
beforeEach(() => {
  chat.length = 0; warnings.length = 0; siteChanges.length = 0; faces.length = 0; confirmAnswer = true; promptAnswer = null;
  g.game.user = GM;
  site = actor({ uuid: 'Actor.site', name: 'Plant', type: 'site', system: { alert: 'none', riggerUuid: 'Actor.sec', devices: [], slaved: [] },
    flags: { [S]: { vsec98: { technical: 5, vigilance: 'green' } } } });
  runner = actor({ uuid: 'Actor.run', name: 'Runner', owners: ['p1'], skills: { Electronics: 4 }, system: { attributes: attrs(5, 4, 6), derived: { controlPoolLeft: 6, rigging: { vcr: 2 } } } });
  sec = actor({ uuid: 'Actor.sec', name: 'Eyes', system: { attributes: attrs(4, 6, 5), derived: { controlPoolLeft: 5, rigging: { rcd: 2 } } } });
});

/** The GM's request, the owner's roll (scripted `dice`), and the roll card. */
async function requestAndRoll(step: string, device: number, dice: number[]): Promise<{ req: any; res: any }> {
  const req = await G.requestAccess(site, runner, step, device);
  g.game.user = P1;
  faces.push(...dice);
  await G.onCard(req, { disabled: false } as any, 'vsec98Roll');
  g.game.user = GM;
  return { req, res: chat[chat.length - 1] };
}

describe('accessing a rigged system: request, roll, the GM\'s re-checked Apply', () => {
  test('the request takes its dice, TN and successes from the site and the intruder (GM-side)', async () => {
    const req = await G.requestAccess(site, runner, 'tap', 3);
    assert.deepEqual(req.flags[S].vsec98Req, { siteUuid: 'Actor.site', intruderUuid: 'Actor.run', step: 'tap', dice: 7, tn: 5, need: 2, alertOnFail: false });
    assert.ok(req.whisper.includes('p1') && req.whisper.includes('gm1'));
  });
  test('done: the site records the step (a key without dots)', async () => {
    const { res } = await requestAndRoll('tap', 3, [6, 5, 1, 1, 2, 3, 4, 2]);
    assert.equal(res.author.id, 'p1');
    assert.ok(await G.applyAccess(res));
    assert.equal(site.flags[S].vsec98.access.Actor_run, 1);
    assert.equal(await G.applyAccess(res), false, 'once per roll card');
  });
  test('a second roll for the same request doesn\'t count; the request is used up once applied', async () => {
    const { req } = await requestAndRoll('tap', 3, [1, 1, 1, 1, 1, 2, 2]);
    g.game.user = P1;
    faces.push(6, 6, 6, 5, 5, 5, 5, 1, 1, 1);
    await G.onCard(req, { disabled: false } as any, 'vsec98Roll');
    g.game.user = GM;
    const second = chat[chat.length - 1];
    assert.equal(await G.applyAccess(second), false);
    const first = chat.find((m) => m.flags?.[S]?.vsec98Res && m !== second);
    assert.ok(await G.applyAccess(first));
    assert.equal(req.flags[S].vsec98Used, true);
  });
  test('a failed decryption puts the site on alert', async () => {
    const { res } = await requestAndRoll('decrypt', 3, [1, 2, 3, 4, 2, 1, 1, 1, 2]);
    assert.ok(await G.applyAccess(res));
    assert.equal(siteChanges[0].minAlert, 'active');
  });
  test('a request a player posted is refused', async () => {
    g.game.user = P1;
    const fake = asMessage({ flags: { [S]: { vsec98Req: { siteUuid: 'Actor.site', intruderUuid: 'Actor.run', step: 'tap', dice: 30, tn: 2, need: 1 } } } }, P1);
    chat.push(fake);
    await G.onCard(fake, { disabled: false } as any, 'vsec98Roll');
    assert.ok(warnings.length);
    const res = asMessage({ flags: { [S]: { vsec98Res: { reqId: fake.id } } }, rolls: [] }, P1);
    g.game.user = GM;
    assert.equal(await G.applyAccess(res), false);
  });
  test('a roll card from someone who doesn\'t own the intruder is refused', async () => {
    const { res } = await requestAndRoll('tap', 3, [6, 6, 1, 1, 1, 1, 1, 2, 2]);
    res.author = P2;
    assert.equal(await G.applyAccess(res), false);
    assert.equal(site.flags[S].vsec98.access, undefined);
  });
  test('dice that don\'t make the requested test (a die added) are refused', async () => {
    const { res } = await requestAndRoll('tap', 3, [6, 5, 1, 1, 2, 3, 4, 2]);
    res.rolls[0].dice[0].results.push({ result: 6 });
    assert.equal(await G.applyAccess(res), false);
    res.rolls[0].dice[0].results.pop();
    res.rolls.push({ dice: [{ results: [{ result: 6 }] }] });
    assert.equal(await G.applyAccess(res), false, 'a throw too many');
    res.rolls.pop();
    res.rolls[0].dice[0].results[2] = { result: 9 };
    assert.equal(await G.applyAccess(res), false, 'a face off the die');
  });
  test('the GM can decline in the confirmation', async () => {
    const { res } = await requestAndRoll('tap', 3, [6, 5, 1, 1, 2, 3, 4, 2]);
    confirmAnswer = false;
    assert.equal(await G.applyAccess(res), false);
  });
  test('a player can\'t apply', async () => {
    const { res } = await requestAndRoll('tap', 3, [6, 5, 1, 1, 2, 3, 4, 2]);
    g.game.user = P1;
    await G.onCard(res, { disabled: false } as any, 'vsec98Apply');
    assert.equal(site.flags[S].vsec98.access, undefined);
  });
});

describe('rigger combat (Rigger 2 pp. 79–80)', () => {
  test('the GM rolls; the loser\'s owner resists from the GM\'s card, Control Pool up to Body', async () => {
    const calls: any[] = [];
    runner.resistRiggerCombat98 = async (r: any) => { calls.push(r); };
    sec.spendControl98 = async () => {};
    // The security rigger attacks with 2 pool dice: 6 dice vs TN 5; the runner 5 dice vs TN 4.
    faces.push(6, 5, 6, 1, 1, 1, /* reroll */ 2, 3, 1, 1, 1, 1, 2);
    const out = await G.riggerCombat({ attacker: sec, defender: runner, pool: 2 });
    assert.equal(out.winner, 'attacker');
    const card = chat[chat.length - 1];
    assert.deepEqual(card.flags[S].vsec98Hit, { loserUuid: 'Actor.run', tn: 4, level: 'M', attribute: 'body', poolCap: 4 });
    g.game.user = P1;
    promptAnswer = 3;
    await G.onCard(card, { disabled: false } as any, 'vsec98Resist');
    assert.deepEqual(calls, [{ tn: 4, level: 'M', attribute: 'body', pool: 3 }]);
    await G.onCard(card, { disabled: false } as any, 'vsec98Resist');
    assert.equal(calls.length, 1, 'once');
  });
  test('a damage card a player posted is refused', async () => {
    const calls: any[] = [];
    runner.resistRiggerCombat98 = async (r: any) => { calls.push(r); };
    g.game.user = P2;
    const fake = asMessage({ flags: { [S]: { vsec98Hit: { loserUuid: 'Actor.run', tn: 2, level: 'L', attribute: 'body', poolCap: 9 } } } }, P2);
    await G.onCard(fake, { disabled: false } as any, 'vsec98Resist');
    assert.equal(calls.length, 0);
  });
  test('a decker: +2 TN on their test; resists with Willpower', async () => {
    faces.push(1, 1, 1, 1, 1, 1, 1, /* rigger */ 6, 6, 1, 1, /* re-rolls */ 1, 1);
    await G.riggerCombat({ attacker: runner, defender: sec, attackerDecker: true, emulation: 4, pool: 9 });
    const card = chat[chat.length - 1];
    assert.equal(card.flags[S].vsec98Hit.attribute, 'willpower');
    assert.equal(card.flags[S].vsec98Hit.tn, 6, 'the rigger\'s Willpower 4 + 2');
    assert.equal(card.flags[S].vsec98Hit.poolCap, 0);
  });
  test('v971: not built', async (t) => {
    t.after(oldWay({ 'VSEC_V98.riggerCombat': 'v971' }));
    assert.equal(await G.riggerCombat({ attacker: sec, defender: runner }), null);
  });
});

describe('the site panel, perception, sensors and hooks', () => {
  test('device ratings by the levels (GM only)', async () => {
    site.system.devices = [{ id: 'a', kind: 'camera', rating: 1 }, { id: 'b', kind: 'maglock', lockType: 'print', rating: 1 }, { id: 'c', kind: 'gas', rating: 1 }];
    const v = G.siteValues(site);
    v.levels.surveillance = 3; v.levels.alarms = 2;
    assert.equal(await G.applyRatings(site, v), 2);
    assert.deepEqual(site.system.devices.map((d: any) => d.rating), [4, 6, 1]);
    g.game.user = P1;
    assert.equal(await G.applyRatings(site, v, { high: true }), 0);
  });
  test('the panel shows the CCSS limits and the OSL', () => {
    site.system.slaved = ['x', 'y', 'z'];
    const html = G.sitePanelInfo(site);
    assert.match(html, /Eyes/);
    assert.match(html, /1 slaved drones more/);
  });
  test('the rigger\'s Perception Test: −2 on alert; an alarm needs none', async () => {
    site.system.alert = 'active';
    faces.push(4, 4, 1, 1, 1);
    const r = await G.riggerPerception(site, 'door');
    assert.equal(r.targetNumber, 3);
    assert.equal(r.successes, 2);
    assert.equal(await G.riggerPerception(site, 'alarm'), null);
  });
  test('a motion sensor: no success sets it off (tally and alert through the site)', async () => {
    runner.stealthSide = () => ({ dice: 3, modifiers: [] });
    faces.push(1, 2, 3);
    const out = await G.sensorDetect(site, { name: 'PIR', rating: 4, sense: 'motion' }, runner);
    assert.equal(out.detected, true);
    assert.equal(siteChanges.length, 1);
    faces.push(5, 1, 1);
    assert.equal((await G.sensorDetect(site, { name: 'PIR', rating: 4, sense: 'motion' }, runner)).detected, false);
    assert.equal(siteChanges.length, 1);
  });
  test('the repair parts line and the rigger decking TN; v971 gives none', (t) => {
    const v = { system: { cost: 40000, availability: '4/48 hrs', mods: [] } };
    assert.match(G.repairPartsLine(v, 2), /4,000¥/);
    assert.deepEqual(G.riggerDeckingMods(runner).map((m: any) => m.value), [1]);
    t.after(oldWay({ 'VSEC_V98.repairParts': 'v971', 'VSEC_V98.riggerDecking': 'v971' }));
    assert.equal(G.repairPartsLine(v, 2), '');
    assert.deepEqual(G.riggerDeckingMods(runner), []);
  });
});
