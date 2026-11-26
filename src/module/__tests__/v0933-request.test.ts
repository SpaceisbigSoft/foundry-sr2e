/**
 * v0.93.3: the GM's roll request card (report item 6): the pure state, tally and HTML (rules/rollrequest.ts) and the
 * Foundry glue (applications/rollrequest.ts) with small stubs: who may roll a row, which test card counts for the
 * tally (the author must own the row's actor; only a GM's request card is a request), re-rolls replacing a result,
 * hidden requests, and escaping.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRequest, makeRequest, applyResult, tallyRequest, rowStatus, requestHtml, requestCardContent, requestOfValue,
  MAX_REQUEST_ROWS, REQUEST_FLAG, type RollRequest,
} from '../rules/rollrequest.ts';

const g = globalThis as any;
const SYS = 'shadowrun2e_unified';

// ---------------------------------------------------------------- Foundry stubs (enough for the glue)
const hooks: Record<string, Function[]> = {};
g.Hooks = { on: (n: string, f: Function) => { (hooks[n] ??= []).push(f); }, once: (n: string, f: Function) => { (hooks[n] ??= []).push(f); } };
const prompts: any[] = [];
let promptAnswer: any = null;
g.foundry = {
  utils: { randomID: () => 'req1' },
  applications: { api: { DialogV2: { prompt: async (o: any) => { prompts.push(o); return promptAnswer; }, confirm: async () => true } } },
};
const notes: string[] = [];
g.ui = { notifications: { warn: (m: string) => { notes.push(m); }, info: (m: string) => { notes.push(m); }, error() {} } };
const posted: any[] = [];
g.ChatMessage = { create: async (d: any) => { const m = stubMessage({ id: `m${posted.length + 1}`, author: g.game.user, ...d }); posted.push(m); messages.set(m.id, m); return m; } };
const docs = new Map<string, any>();
g.fromUuidSync = (u: string) => docs.get(u) ?? null;
const messages = new Map<string, any>();

const GM = { id: 'gm', name: 'GM', isGM: true };
const P1 = { id: 'p1', name: 'Player One', isGM: false };
const P2 = { id: 'p2', name: 'Player Two', isGM: false };
const users = Object.assign([GM, P1, P2], { activeGM: { id: 'gm', isSelf: true }, get: (id: string) => [GM, P1, P2].find((u) => u.id === id) });
g.game = { user: GM, users, messages: { get: (id: string) => messages.get(id) }, actors: [], i18n: { localize: (k: string) => k } };

function setPath(obj: any, path: string, value: unknown) {
  const parts = path.split('.');
  let o = obj;
  for (const p of parts.slice(0, -1)) o = (o[p] ??= {});
  o[parts[parts.length - 1]!] = value;
}
function stubMessage(d: any): any {
  const m: any = {
    id: d.id, author: d.author, content: d.content ?? '', flags: structuredClone(d.flags ?? {}), timestamp: d.timestamp ?? Date.now(), updates: [] as any[],
    getFlag(scope: string, key: string) { return this.flags?.[scope]?.[key]; },
    async update(u: any) {
      this.updates.push(u);
      if (u.content !== undefined) this.content = u.content;
      if (u.flags) for (const [s, v] of Object.entries(u.flags)) this.flags[s] = { ...(this.flags[s] ?? {}), ...(v as any) };
      for (const [k, v] of Object.entries(u)) if (k.includes('.')) setPath(this, k, v);
      return this;
    },
  };
  return m;
}
const rolls: Array<{ who: string; kind: string; key: string; opts: any }> = [];
function stubActor(uuid: string, name: string, owners: string[], o: { type?: string; skills?: string[] } = {}): any {
  const a: any = {
    uuid, name, type: o.type ?? 'character',
    get hasPlayerOwner() { return owners.some((id) => id !== 'gm'); },
    get isOwner() { return g.game.user.isGM || owners.includes(g.game.user.id); },
    testUserPermission: (u: any, lvl: string) => lvl === 'OWNER' && (u.isGM || owners.includes(u.id)),
    items: (o.skills ?? []).map((n) => ({ type: 'skill', name: n, system: { rating: 3 } })),
    findSkill(n: string) { return this.items.find((i: any) => i.name.toLowerCase() === n.toLowerCase()); },
    async rollSkill(skill: any, opts: any) { rolls.push({ who: name, kind: 'skill', key: skill?.name, opts }); return { successes: 2 }; },
    async rollAttribute(key: string, opts: any) { rolls.push({ who: name, kind: 'attribute', key, opts }); return { successes: 1 }; },
  };
  docs.set(uuid, a);
  return a;
}

const glue = await import('../applications/rollrequest.ts');

const base = (rows = 3): RollRequest => makeRequest({
  id: 'r1', kind: 'skill', key: 'Stealth', tn: 5, hidden: false, now: 1000,
  rows: [{ actorUuid: 'Actor.a', name: 'Ann', playerOwned: true }, { actorUuid: 'Actor.b', name: 'Bob', playerOwned: true }, { actorUuid: 'Actor.n', name: 'Guard', playerOwned: false }].slice(0, rows),
})!;

describe('v0.93.3 roll request: the pure state', () => {
  test('makeRequest bounds the TN, keeps unique rows and refuses an empty request', () => {
    const s = makeRequest({ id: 'x', kind: 'skill', key: 'Stealth', tn: 99, hidden: true, rows: [{ actorUuid: 'Actor.a', name: 'A', playerOwned: true }, { actorUuid: 'Actor.a', name: 'A again', playerOwned: true }] })!;
    assert.equal(s.tn, 30);
    assert.equal(s.rows.length, 1);
    assert.equal(s.hidden, true);
    assert.equal(makeRequest({ id: 'x', kind: 'skill', key: 'Stealth', tn: 4, hidden: false, rows: [] }), null);
    assert.equal(makeRequest({ id: 'x', kind: 'skill', key: '  ', tn: 4, hidden: false, rows: [{ actorUuid: 'Actor.a', name: 'A', playerOwned: true }] }), null);
  });

  test('parseRequest refuses junk, an unknown attribute, and caps rows and successes', () => {
    assert.equal(parseRequest(null), null);
    assert.equal(parseRequest([]), null);
    assert.equal(parseRequest({ kind: 'attribute', key: 'magic', rows: [] }), null);
    assert.equal(parseRequest({ kind: 'spell', key: 'x' }), null);
    const many = Array.from({ length: 500 }, (_, i) => ({ actorUuid: `Actor.${i}`, name: `N${i}`, result: { successes: 1e9, botch: 'yes' } }));
    const s = parseRequest({ kind: 'attribute', key: 'body', tn: 'x', rows: many })!;
    assert.equal(s.rows.length, MAX_REQUEST_ROWS);
    assert.equal(s.tn, 4);
    assert.equal(s.rows[0]!.result!.successes, 99);
    assert.equal(s.rows[0]!.result!.botch, false);
    assert.equal(parseRequest({ kind: 'skill', key: 'S', rows: [{ actorUuid: 'bad uuid <x>', name: 'n' }] })!.rows.length, 0);
  });

  test('applyResult: a waiting row takes a result; another test is refused; a newer card of the same test replaces it', () => {
    const s0 = base();
    const a = applyResult(s0, 'Actor.a', { successes: 3, botch: false, cardId: 'c1', testId: 't1' });
    assert.equal(a.outcome, 'added');
    assert.equal(s0.rows[0]!.result, null, 'the input is not changed');
    assert.equal(applyResult(a.state, 'Actor.a', { successes: 5, botch: false, cardId: 'c2', testId: 't2' }).outcome, 'alreadyRolled');
    assert.equal(applyResult(a.state, 'Actor.a', { successes: 5, botch: false, cardId: 'c2', testId: '' }).outcome, 'alreadyRolled');
    const re = applyResult(a.state, 'Actor.a', { successes: 4, botch: false, cardId: 'c3', testId: 't1' });
    assert.equal(re.outcome, 'replaced');
    assert.equal(re.state.rows[0]!.result!.successes, 4);
    assert.equal(applyResult(re.state, 'Actor.a', { successes: 4, botch: false, cardId: 'c3', testId: 't1' }).outcome, 'same');
    assert.equal(applyResult(s0, 'Actor.zzz', { successes: 1, botch: false, cardId: 'c', testId: 't' }).outcome, 'noRow');
    assert.equal(applyResult(s0, 'Actor.a', { successes: -4, botch: 1, cardId: 'c', testId: 't' }).state.rows[0]!.result!.successes, 0);
  });

  test('the tally: rolled, total, best (ties), disasters not counted as successes', () => {
    let s = base();
    s = applyResult(s, 'Actor.a', { successes: 3, botch: false, cardId: 'c1', testId: 't1' }).state;
    s = applyResult(s, 'Actor.b', { successes: 3, botch: false, cardId: 'c2', testId: 't2' }).state;
    s = applyResult(s, 'Actor.n', { successes: 0, botch: true, cardId: 'c3', testId: 't3' }).state;
    assert.deepEqual(tallyRequest(s), { rows: 3, rolled: 3, waiting: 0, totalSuccesses: 6, botches: 1, best: { names: ['Ann', 'Bob'], successes: 3 } });
    assert.equal(tallyRequest(base()).best, null);
  });

  test('rowStatus and the HTML: a hidden request shows players "rolled" and no TN; the GM sees everything', () => {
    const s = { ...applyResult(base(), 'Actor.a', { successes: 4, botch: false, cardId: 'c1', testId: 't1' }).state, hidden: true };
    assert.equal(rowStatus(s.rows[0]!, true, false).kind, 'rolled');
    assert.equal(rowStatus(s.rows[0]!, true, true).kind, 'successes');
    const player = requestHtml(s, { gm: false, owns: (u) => u === 'Actor.b' });
    // v0.93.3: the English text (the test run loads lang/en.json).
    assert.ok(player.includes('(TN hidden)'));
    assert.ok(!/ vs TN \d/.test(player));
    assert.ok(!/4 success/.test(player), 'no number for players');
    assert.ok(player.includes('data-sr2e-rr="roll" data-index="1"'), 'a Roll button on the owned waiting row');
    assert.ok(!player.includes('data-index="0"'), 'none on a rolled row');
    assert.ok(!player.includes('rollFor') && !player.includes('rollNpcs'), 'no GM buttons for players');
    const gm = requestHtml(s, { gm: true, owns: () => true });
    assert.ok(gm.includes('4 successes'));
    assert.ok(gm.includes('data-sr2e-rr="rollFor" data-index="1"'));
    assert.ok(gm.includes('data-sr2e-rr="rollNpcs"'));
    assert.ok(requestCardContent(s).includes('sr2e-rr'));
    assert.ok(!requestCardContent(s).includes('<button'), 'the stored content has no buttons');
  });

  test('names are escaped', () => {
    const s = makeRequest({ id: 'x', kind: 'skill', key: '<img src=x onerror=1>', tn: 4, hidden: false, rows: [{ actorUuid: 'Actor.a', name: '<b>"x"</b>', playerOwned: true }] })!;
    const h = requestHtml(s, { gm: true, owns: () => true });
    assert.ok(!h.includes('<b>') && !h.includes('<img'));
    assert.ok(h.includes('&lt;b&gt;&quot;x&quot;&lt;/b&gt;'));
  });

  test('requestOfValue bounds the link', () => {
    assert.equal(requestOfValue('abc123'), 'abc123');
    assert.equal(requestOfValue('a"b'), '');
    assert.equal(requestOfValue(5), '');
    assert.equal(requestOfValue('x'.repeat(65)), '');
  });
});

describe('v0.93.3 roll request: the glue', () => {
  let ann: any, bob: any, guard: any;
  beforeEach(() => {
    posted.length = 0; messages.clear(); rolls.length = 0; notes.length = 0; prompts.length = 0; promptAnswer = null; docs.clear();
    glue.resetRollRequestsForTests();
    g.game.user = GM;
    ann = stubActor('Actor.a', 'Ann', ['p1'], { skills: ['Stealth'] });
    bob = stubActor('Actor.b', 'Bob', ['p2']);
    guard = stubActor('Actor.n', 'Guard', ['gm'], { type: 'npc' });
  });

  const post = () => glue.postRollRequest({ kind: 'skill', key: 'Stealth', tn: 5, actors: [ann, bob, guard] });
  const testCard = (id: string, author: any, snap: any, ts = Date.now() + 10) => { const m = stubMessage({ id, author, flags: { [SYS]: { test: snap } }, timestamp: ts }); messages.set(id, m); return m; };

  test('a GM posts one card with the state on its flags; a player cannot post one', async () => {
    const m = await post();
    assert.equal(posted.length, 1);
    const st = m.getFlag(SYS, REQUEST_FLAG);
    assert.equal(st.rows.length, 3);
    assert.equal(st.rows[2].playerOwned, false);
    g.game.user = P1;
    assert.equal(await glue.postRollRequest({ kind: 'skill', key: 'Stealth', tn: 5, actors: [ann] }), null);
    assert.equal(posted.length, 1);
  });

  test("a player's Roll opens their own character's window with the TN and the link", async () => {
    const m = await post();
    const calls: any[] = [];
    glue.registerRollRequests({ openRollWindow: async (actor, ask) => { calls.push({ actor: actor.name, ask }); return { successes: 1 }; } });
    g.game.user = P1;
    await glue.rollRequestRoll(m, { dataset: { index: '0' } } as any);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].actor, 'Ann');
    assert.equal(calls[0].ask.tn, 5);
    assert.equal(calls[0].ask.opts.requestOf, m.id);
    assert.equal(calls[0].ask.skill.name, 'Stealth');
    // Someone else's row: refused.
    await glue.rollRequestRoll(m, { dataset: { index: '1' } } as any);
    assert.equal(calls.length, 1);
    assert.ok(notes.some((n) => n.includes("isn't your character")));
  });

  test("a player's card with request flags is no request (no rolls, no tally)", async () => {
    const forged = stubMessage({ id: 'f1', author: P2, flags: { [SYS]: { [REQUEST_FLAG]: base() } } });
    messages.set('f1', forged);
    assert.equal(glue.requestOf(forged), null);
    g.game.user = P1;
    await glue.rollRequestRoll(forged, { dataset: { index: '0' } } as any);
    assert.equal(rolls.length, 0);
    g.game.user = GM;
    const card = testCard('t1', P1, { actorUuid: 'Actor.a', successes: 3, botch: false, testId: 'x1', requestOf: 'f1' });
    assert.equal(await glue.tallyTestCard(card), 'noRequest');
  });

  test('the tally: the author must own the row; a second test is refused; a re-roll of the same test replaces it', async () => {
    const m = await post();
    // Player Two posts a card claiming Ann's result: refused.
    assert.equal(await glue.tallyTestCard(testCard('t0', P2, { actorUuid: 'Actor.a', successes: 9, botch: false, testId: 'x0', requestOf: m.id })), 'notOwner');
    assert.equal(await glue.tallyTestCard(testCard('t1', P1, { actorUuid: 'Actor.a', successes: 3, botch: false, testId: 'x1', requestOf: m.id })), 'added');
    assert.equal(m.getFlag(SYS, REQUEST_FLAG).rows[0].result.successes, 3);
    assert.ok(!m.content.includes('<button'));
    assert.equal(await glue.tallyTestCard(testCard('t2', P1, { actorUuid: 'Actor.a', successes: 6, botch: false, testId: 'x2', requestOf: m.id })), 'alreadyRolled');
    assert.equal(await glue.tallyTestCard(testCard('t3', P1, { actorUuid: 'Actor.a', successes: 4, botch: false, testId: 'x1', requestOf: m.id })), 'replaced');
    assert.equal(m.getFlag(SYS, REQUEST_FLAG).rows[0].result.successes, 4);
    // A GM's card counts for anyone; an actor not on the request doesn't.
    assert.equal(await glue.tallyTestCard(testCard('t4', GM, { actorUuid: 'Actor.b', successes: 1, botch: true, testId: 'x4', requestOf: m.id })), 'added');
    assert.equal(await glue.tallyTestCard(testCard('t5', GM, { actorUuid: 'Actor.zz', successes: 1, testId: 'x5', requestOf: m.id })), 'noRow');
    // A card from before the request.
    assert.equal(await glue.tallyTestCard(testCard('t6', GM, { actorUuid: 'Actor.n', successes: 1, testId: 'x6', requestOf: m.id }, 1)), 'older');
    assert.equal(await glue.tallyTestCard(testCard('t7', GM, { actorUuid: 'Actor.n', successes: 1, testId: 'x7' })), 'notLinked');
  });

  test('"Roll the NPCs" rolls only the waiting rows with no player owner, with the link; GM only', async () => {
    const m = await post();
    g.game.user = P1;
    assert.equal(await glue.rollRequestNpcs(m), 0);
    g.game.user = GM;
    assert.equal(await glue.rollRequestNpcs(m), 1);
    assert.deepEqual(rolls.map((r) => r.who), ['Guard']);
    assert.equal(rolls[0]!.opts.requestOf, m.id);
    assert.equal(rolls[0]!.opts.targetNumber, 5);
    assert.equal(rolls[0]!.kind, 'skill');
    assert.equal(rolls[0]!.key, 'Stealth', 'a defaulting stand-in for a skill the NPC lacks');
  });

  test('"Roll for them" asks first, then rolls that row at the TN asked', async () => {
    const m = await post();
    promptAnswer = { tn: 7, mod: 1 };
    await glue.rollRequestFor(m, { dataset: { index: '1' } } as any);
    assert.equal(prompts.length, 1);
    assert.equal(rolls.length, 1);
    assert.equal(rolls[0]!.who, 'Bob');
    assert.equal(rolls[0]!.opts.targetNumber, 7);
    assert.equal(rolls[0]!.opts.modifiers[0].value, 1);
    g.game.user = P1;
    await glue.rollRequestFor(m, { dataset: { index: '1' } } as any);
    assert.equal(rolls.length, 1, 'players have no Roll for them');
  });

  test('a hidden request whispers the test to the GMs (requestPrivate) and an attribute request rolls the attribute', async () => {
    const m = await glue.postRollRequest({ kind: 'attribute', key: 'willpower', tn: 6, hidden: true, actors: [guard] });
    await glue.rollRequestNpcs(m);
    assert.equal(rolls[0]!.kind, 'attribute');
    assert.equal(rolls[0]!.key, 'willpower');
    assert.equal(rolls[0]!.opts.requestPrivate, true);
  });

  test('the createChatMessage hook tallies on the lead GM client only, through the lock', async () => {
    glue.registerRollRequests();
    const m = await post();
    const card = testCard('t1', P1, { actorUuid: 'Actor.a', successes: 2, botch: false, testId: 'x1', requestOf: m.id });
    g.game.user = P1;
    g.game.users.activeGM.isSelf = false;
    for (const f of hooks['createChatMessage'] ?? []) f(card);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(m.getFlag(SYS, REQUEST_FLAG).rows[0].result, null);
    g.game.user = GM;
    g.game.users.activeGM.isSelf = true;
    for (const f of hooks['createChatMessage'] ?? []) f(card);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(m.getFlag(SYS, REQUEST_FLAG).rows[0].result.successes, 2);
  });
});
