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
const updates: any[] = [];
let refuseUpdates = false;
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
    async setFlag(s: string, k: string, v: any) { ((this.flags ??= {})[s] ??= {})[k] = v; },
    // As Foundry: only the author or a GM may update a card; a cancelled write leaves it unchanged.
    async update(u: Record<string, any>, o: any = {}) {
      updates.push({ id: this.id, u, o });
      if (!(g.game.user.isGM || g.game.user.id === this.author.id) || refuseUpdates) return;
      for (const [p, v] of Object.entries(u)) { const [, sys, k] = p.split('.'); ((this.flags ??= {})[sys!] ??= {})[k!] = v; }
    } };
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
  for (const f of ['vsec98.json', 'vsec98-fix.json', 'vsec98-fix2.json']) {
    const draft = join('i18n-drafts', f);
    if (existsSync(draft)) g.__SR2E_EN__ = { ...(g.__SR2E_EN__ ?? {}), ...JSON.parse(readFileSync(draft, 'utf8')) };
  }
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
  chat.length = 0; warnings.length = 0; siteChanges.length = 0; faces.length = 0; confirmAnswer = true; promptAnswer = null; updates.length = 0; refuseUpdates = false;
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
  test('dice that don\'t make the requested test count as a failed test (fix S2: no dodging the alert)', async () => {
    for (const spoil of [
      (res: any) => res.rolls[0].dice[0].results.push({ result: 6 }),
      (res: any) => res.rolls.push({ dice: [{ results: [{ result: 6 }] }] }),
      (res: any) => { res.rolls[0].dice[0].results[2] = { result: 9 }; },
    ]) {
      chat.length = 0; siteChanges.length = 0; delete site.flags[S].vsec98.access;
      // Decryption: 9 dice vs TN 5, 2 needed; two sixes (re-rolled 2, 2) would make it.
      const { res } = await requestAndRoll('decrypt', 3, [6, 6, 1, 1, 1, 1, 1, 1, 1, 2, 2]);
      spoil(res);
      assert.equal(await G.applyAccess(res), true);
      assert.equal(site.flags[S].vsec98.access, undefined, 'not recorded');
      assert.equal(siteChanges[0]?.minAlert, 'active', 'the failure\'s alert');
    }
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
    assert.deepEqual(calls, [{ tn: 4, level: 'M', attribute: 'body', pool: 3, hitId: card.id }]);
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

describe('review fixes (v0.98.0 fix vsec)', () => {
  const ok = [6, 6, 1, 1, 1, 1, 1, 1, 1, 2, 2]; // decryption: 2 successes (done)
  const bad = [1, 2, 3, 4, 2, 1, 1, 1, 2]; // none (failed: alert)
  const drop = (m: any) => { chat.splice(chat.indexOf(m), 1); };

  test('S2: the lead GM pins the first roll card; a failed card deleted and rolled again counts as the failure', async () => {
    const { req, res } = await requestAndRoll('decrypt', 3, bad);
    assert.equal(await G.pinFirstRoll(res), true);
    assert.deepEqual(req.flags[S][G.PIN_FLAG], { id: res.id, dice: [bad] });
    assert.equal(updates[0].o.sr2eRelay, true, 'the GM side\'s own write');
    drop(res);
    g.game.user = P1;
    faces.push(...ok);
    await G.onCard(req, { disabled: false } as any, 'vsec98Roll');
    g.game.user = GM;
    const second = chat[chat.length - 1];
    assert.equal(await G.pinFirstRoll(second), false, 'only the first is pinned');
    assert.equal(await G.applyAccess(second), true);
    assert.equal(site.flags[S].vsec98.access, undefined, 'not recorded');
    assert.equal(siteChanges[0].minAlert, 'active');
    assert.equal(await G.applyAccess(second), false, 'used up');
  });
  test('S2: a deleted pinned card gets the GM a card whose Apply counts it as failed', async () => {
    const { res } = await requestAndRoll('decrypt', 3, bad);
    await G.pinFirstRoll(res);
    drop(res);
    const notice = await G.lostRoll(res);
    assert.ok(notice?.flags[S].vsec98Lost);
    assert.ok(notice.whisper.every((id: string) => id === 'gm1'));
    assert.equal(await G.applyAccess(notice), true);
    assert.equal(siteChanges[0].minAlert, 'active');
    assert.equal(await G.lostRoll(res), null, 'nothing more once used');
  });
  test('S2: rolls rewritten after the pin count as failed; vsec98Applied on the player\'s card is not read', async () => {
    const { res } = await requestAndRoll('decrypt', 3, bad);
    await G.pinFirstRoll(res);
    res.flags[S].vsec98Applied = true;
    res.rolls = [{ dice: [{ results: [6, 6, 1, 1, 1, 1, 1, 1, 1].map((result) => ({ result })) }] }, { dice: [{ results: [{ result: 2 }, { result: 2 }] }] }];
    assert.equal(await G.applyAccess(res), true);
    assert.equal(site.flags[S].vsec98.access, undefined);
    assert.equal(siteChanges[0].minAlert, 'active');
  });
  test('S2: no pin for a roll card from someone who doesn\'t own the intruder, nor for a player\'s request', async () => {
    const { req, res } = await requestAndRoll('tap', 3, [6, 5, 1, 1, 2, 3, 4, 2]);
    res.author = P2;
    assert.equal(await G.pinFirstRoll(res), false);
    assert.equal(req.flags[S][G.PIN_FLAG], undefined);
    const fake = asMessage({ flags: { [S]: { vsec98Req: { ...req.flags[S].vsec98Req } } } }, P1);
    chat.push(fake);
    const r2 = asMessage({ flags: { [S]: { vsec98Res: { reqId: fake.id } } }, rolls: [] }, P1);
    assert.equal(await G.pinFirstRoll(r2), false);
  });
  test('S2 / P5: a double click on Apply applies once', async () => {
    const { res } = await requestAndRoll('decrypt', 3, bad);
    await G.pinFirstRoll(res);
    const button = { disabled: false } as any;
    await Promise.all([G.onCard(res, button, 'vsec98Apply'), G.onCard(res, button, 'vsec98Apply')]);
    assert.equal(siteChanges.length, 1);
    assert.equal(button.disabled, false, 'enabled again afterwards');
  });
  test('S2: a cancelled write on the request (not landed) applies nothing', async () => {
    const { res } = await requestAndRoll('decrypt', 3, bad);
    refuseUpdates = true;
    assert.equal(await G.applyAccess(res), false);
    assert.equal(siteChanges.length, 0);
  });

  async function hitCard(): Promise<any> {
    sec.spendControl98 = async () => {};
    faces.push(6, 5, 6, 1, 1, 1, 2, 3, 1, 1, 1, 1, 2);
    await G.riggerCombat({ attacker: sec, defender: runner, pool: 2 });
    return chat[chat.length - 1];
  }
  test('S1: a card id the player wrote into vsec98Resisted doesn\'t stop the GM\'s Resist', async () => {
    const calls: any[] = [];
    runner.resistRiggerCombat98 = async (r: any) => { calls.push(r); };
    const card = await hitCard();
    runner.flags[S] = { vsec98Resisted: [card.id] };
    promptAnswer = 0;
    await G.onCard(card, { disabled: false } as any, 'vsec98Resist');
    assert.equal(calls.length, 1);
    assert.ok(card.flags[S].vsec98Done, 'resisted, on the GM\'s card');
  });
  test('S1: the lead GM marks the damage card resisted from the owner\'s resistance card; then only a GM, after confirming', async () => {
    const calls: any[] = [];
    runner.resistRiggerCombat98 = async (r: any) => { calls.push(r); };
    const card = await hitCard();
    const forged = asMessage({ flags: { [S]: { test: { vsec98HitId: card.id } } } }, P2);
    assert.equal(await G.markResisted(forged), false, 'not the loser\'s owner');
    const resistCard = asMessage({ flags: { [S]: { test: { vsec98HitId: card.id } } } }, P1);
    assert.equal(await G.markResisted(resistCard), true);
    assert.equal(card.flags[S].vsec98Done, resistCard.id);
    g.game.user = P1;
    runner.flags[S] = {};
    await G.onCard(card, { disabled: false } as any, 'vsec98Resist');
    assert.equal(calls.length, 0, 'the player: already');
    g.game.user = GM;
    confirmAnswer = false;
    await G.onCard(card, { disabled: false } as any, 'vsec98Resist');
    assert.equal(calls.length, 0, 'the GM declined');
    confirmAnswer = true;
    promptAnswer = 0;
    await G.onCard(card, { disabled: false } as any, 'vsec98Resist');
    assert.equal(calls.length, 1, 'the GM resisted anyway');
  });
  test('S1: a damage card a player posted is never marked', async () => {
    const fakeHit = asMessage({ flags: { [S]: { vsec98Hit: { loserUuid: 'Actor.run', tn: 2, level: 'L', attribute: 'body', poolCap: 0 } } } }, P1);
    chat.push(fakeHit);
    assert.equal(await G.markResisted(asMessage({ flags: { [S]: { test: { vsec98HitId: fakeHit.id } } } }, P1)), false);
  });
  test('P5: a double click on Resist (with Control Pool) rolls one resistance test', async () => {
    const calls: any[] = [];
    runner.resistRiggerCombat98 = async (r: any) => { calls.push(r); };
    const card = await hitCard();
    g.game.user = P1;
    promptAnswer = 2;
    await Promise.all([G.onCard(card, { disabled: false } as any, 'vsec98Resist'), G.onCard(card, { disabled: false } as any, 'vsec98Resist')]);
    assert.equal(calls.length, 1);
  });
  test('C6: the GM\'s resistance runs under the GM lock, inline inside a card\'s re-run', async () => {
    const { gmLockHeld } = await import('../applications/gmlock.ts');
    const held: boolean[] = [];
    runner.resistRiggerCombat98 = async () => { held.push(gmLockHeld()); };
    promptAnswer = 0;
    const card = await hitCard();
    await G.onCard(card, { disabled: false } as any, 'vsec98Resist');
    const card2 = await hitCard();
    g.CONFIG.Actor.documentClass.inAuthorRun = true;
    try { await G.onCard(card2, { disabled: false } as any, 'vsec98Resist'); } finally { delete g.CONFIG.Actor.documentClass.inAuthorRun; }
    assert.deepEqual(held, [true, false]);
  });
  test('C6: the GM\'s Apply writes the site under the GM lock', async () => {
    const { gmLockHeld } = await import('../applications/gmlock.ts');
    const held: boolean[] = [];
    const was = g.CONFIG.Actor.documentClass.changeSite;
    g.CONFIG.Actor.documentClass.changeSite = async (s: any, c: any) => { held.push(gmLockHeld()); return was(s, c); };
    try {
      const { res } = await requestAndRoll('decrypt', 3, bad);
      assert.ok(await G.applyAccess(res));
    } finally { g.CONFIG.Actor.documentClass.changeSite = was; }
    assert.deepEqual(held, [true]);
  });
  test('the hooks: only the lead GM pins and marks', async () => {
    const hooks: Record<string, Array<(m: any) => void>> = {};
    g.Hooks = { on: (n: string, f: any) => { (hooks[n] ??= []).push(f); } };
    let lead = false;
    try {
      G.registerVsec98(() => lead);
      const { withGmLock } = await import('../applications/gmlock.ts');
      const { req, res } = await requestAndRoll('tap', 3, [6, 5, 1, 1, 2, 3, 4, 2]);
      for (const f of hooks.createChatMessage!) f(res);
      await withGmLock(async () => {});
      assert.equal(req.flags[S][G.PIN_FLAG], undefined, 'not the lead');
      lead = true;
      for (const f of hooks.createChatMessage!) f(res);
      await withGmLock(async () => {});
      assert.equal(req.flags[S][G.PIN_FLAG].id, res.id);
      drop(res);
      for (const f of hooks.deleteChatMessage!) f(res);
      await withGmLock(async () => {});
      assert.ok(chat.some((m) => m.flags?.[S]?.vsec98Lost));
    } finally { delete g.Hooks; }
  });
  test('P10: a datajack counts by its kind too (two: no decking penalty)', () => {
    runner.items = [{ type: 'cyberware', name: 'Rigger jack', system: { installed: true, kind: 'datajack' } }, { type: 'cyberware', name: 'Datajack', system: { installed: true } }];
    assert.deepEqual(G.riggerDeckingMods(runner), []);
    runner.items.pop();
    assert.deepEqual(G.riggerDeckingMods(runner).map((m: any) => m.value), [1]);
  });
  test('C8: the repair parts count a table-priced modification, at the level it reached', (t) => {
    // A sensor upgraded 2 → 3 (cost left 0: the table's price, Rigger 2 p. 136: level 3 = 25,000¥).
    const v = { system: { cost: 40000, sensor: 3, availability: '', mods: [{ kind: 'sensor', rating: 1, installed: true, cost: 0, stat: 'sensor', delta: 1 }] } };
    assert.match(G.repairPartsLine(v, 1), /3,250¥/);
    t.after(oldWay({ 'VSEC_V98.modSpecs': 'v971' }));
    // modSpecs v971: the old table price (cost × rating), still counted.
    assert.doesNotMatch(G.repairPartsLine(v, 1), /3,250¥/);
  });
});

describe('second-round fixes (v0.98.0 fix2 vsec)', () => {
  const ok = [6, 6, 1, 1, 1, 1, 1, 1, 1, 2, 2]; // decryption: 2 successes (done)
  const bad = [1, 2, 3, 4, 2, 1, 1, 1, 2]; // none (failed: alert)
  const drop = (m: any) => { chat.splice(chat.indexOf(m), 1); };
  const asked: string[] = [];
  const DLG = () => g.foundry.applications.api.DialogV2;
  let wasConfirm: any;
  beforeEach(() => {
    asked.length = 0;
    wasConfirm = DLG().confirm;
    DLG().confirm = async (o: any) => { asked.push(String(o?.content ?? '')); return confirmAnswer; };
  });
  const restore = () => { DLG().confirm = wasConfirm; };

  test('R1 (a, c): the GM request card applies its pinned roll; a pinned card that no longer names the request counts as failed', async () => {
    try {
      const { req, res } = await requestAndRoll('decrypt', 3, ok);
      assert.equal(await G.pinFirstRoll(res), true);
      res.flags[S].vsec98Res = { reqId: 'elsewhere' }; // the player re-points their card
      await G.onCard(req, { disabled: false } as any, 'vsec98ApplyPin');
      assert.equal(site.flags[S].vsec98.access, undefined, 'not recorded');
      assert.equal(siteChanges[0]?.minAlert, 'active', 'the failure\'s alert');
      assert.ok(req.flags[S].vsec98Used, 'used up');
      assert.ok(asked.some((c) => c.includes('no longer names this request')));
    } finally { restore(); }
  });
  test('R1 (a): the request card\'s button applies an intact pinned roll; a player can\'t use it', async () => {
    try {
      const { req, res } = await requestAndRoll('decrypt', 3, ok);
      await G.pinFirstRoll(res);
      g.game.user = P1;
      await G.onCard(req, { disabled: false } as any, 'vsec98ApplyPin');
      g.game.user = GM;
      assert.equal(req.flags[S].vsec98Used, undefined, 'the player: refused');
      await G.onCard(req, { disabled: false } as any, 'vsec98ApplyPin');
      assert.equal(site.flags[S].vsec98.access.Actor_run, 2);
      assert.equal(await G.applyAccess(req), false, 'once');
    } finally { restore(); }
  });
  test('R1 (b): a pinned card stripped of its request id, then deleted, still gets the GM the lost-card notice (and the hook fires)', async () => {
    const hooks: Record<string, Array<(m: any) => void>> = {};
    g.Hooks = { on: (n: string, f: any) => { (hooks[n] ??= []).push(f); } };
    try {
      G.registerVsec98(() => true);
      const { withGmLock } = await import('../applications/gmlock.ts');
      const { req, res } = await requestAndRoll('decrypt', 3, bad);
      await G.pinFirstRoll(res);
      delete res.flags[S].vsec98Res;
      drop(res);
      for (const f of hooks.deleteChatMessage!) f(res);
      await withGmLock(async () => {});
      const notice = chat.find((m) => m.flags?.[S]?.vsec98Lost);
      assert.ok(notice, 'the notice');
      assert.equal(notice.flags[S].vsec98Lost.reqId, req.id, 'found from the GM\'s request card');
      assert.ok(await G.applyAccess(notice));
      assert.equal(siteChanges[0].minAlert, 'active');
      // A deleted card no request pinned: nothing.
      const other = asMessage({ flags: { [S]: { vsec98Res: { reqId: req.id } } } }, P1);
      assert.equal(await G.lostRoll(other), null);
    } finally { delete g.Hooks; restore(); }
  });
  test('R2: without a pin the GM\'s confirmation says so and counts the roll cards', async () => {
    try {
      const { req, res } = await requestAndRoll('decrypt', 3, ok);
      g.game.user = P1;
      faces.push(...bad);
      await G.onCard(req, { disabled: false } as any, 'vsec98Roll');
      g.game.user = GM;
      confirmAnswer = false;
      assert.equal(await G.applyAccess(res), false, 'declined');
      assert.ok(asked.some((c) => c.includes('No first roll was pinned') && c.includes('the 2 roll card')), asked.join('|'));
    } finally { restore(); }
  });
  test('R2: the lead GM\'s ready pins the earliest surviving roll card of an open request, marked unpinned (shown)', async () => {
    try {
      const { req, res } = await requestAndRoll('decrypt', 3, ok);
      const { req: used } = await requestAndRoll('tap', 3, [6, 5, 1, 1, 2, 3, 4, 2]);
      used.flags[S].vsec98Used = true;
      g.game.user = P1;
      faces.push(...bad);
      await G.onCard(req, { disabled: false } as any, 'vsec98Roll');
      g.game.user = GM;
      assert.equal(await G.pinOpenRequests(), 1);
      assert.deepEqual(req.flags[S][G.PIN_FLAG], { id: res.id, dice: [ok.slice(0, 9), ok.slice(9)], unpinned: true });
      assert.equal(used.flags[S][G.PIN_FLAG], undefined, 'a used request is left alone');
      assert.equal(await G.pinOpenRequests(), 0, 'once');
      assert.ok(await G.applyAccess(res));
      assert.ok(asked.some((c) => c.includes('pinned late')));
    } finally { restore(); }
  });
  test('R2: the ready hook waits for the windows to settle, then pins as the lead GM', async () => {
    const once: Record<string, Array<() => void>> = {};
    g.Hooks = { on: () => {}, once: (n: string, f: any) => { (once[n] ??= []).push(f); } };
    try {
      G.registerVsec98(() => true);
      const { req } = await requestAndRoll('decrypt', 3, ok);
      for (const f of once.ready!) f();
      const { leadSettled } = await import('../applications/leader.ts');
      await leadSettled();
      const { withGmLock } = await import('../applications/gmlock.ts');
      await new Promise((r) => setTimeout(r, 0));
      await withGmLock(async () => {});
      assert.equal(req.flags[S][G.PIN_FLAG]?.unpinned, true);
    } finally { delete g.Hooks; restore(); }
  });
});
