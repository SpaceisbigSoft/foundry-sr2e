/**
 * v0.85.0: the open bugs and security leftovers.
 * - One GM window runs the automation (applications/leader.ts): two windows of the same GM user no longer both post
 *   the status cards, tick the timers, answer relay requests or show the prompts.
 * - The remaining GM-only buttons, and the GM's own Defend and Resist rolls, take the GM queue.
 * - Every notification value is escaped (the ratchet in v0811-scan.test.ts is 0).
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { leadsAmong, promptsAmong, isPeerMessage, handlePeer, isLeadClient, isLeadGm, isPromptWindow, madeHere, otherWindows, startPeers, leadSettled, _resetPeers, _selfId, PEER_TTL_MS, PROBE_WAIT_MS } from '../applications/leader.ts';

const g = globalThis as any;
const SRC = (p: string) => readFileSync(join(process.cwd(), 'src/module', p), 'utf8');

function setUser(id: string, isGM: boolean, active = true): void {
  const me = { id, isGM, isSelf: true };
  g.game = { user: me, users: { activeGM: active ? { id, isSelf: true } : { id: 'other', isSelf: false }, get: (x: string) => (x === id ? me : null) } };
}

describe('v0.85.0 the lead GM window', () => {
  beforeEach(() => { setUser('gm1', true); _resetPeers(1000, 'selfAAAA'); });

  test('pure: the oldest live window leads; ties by id; stale windows don\'t count', () => {
    const self = { clientId: 'b', since: 100 };
    assert.equal(leadsAmong(self, [], 0), true);
    assert.equal(leadsAmong(self, [{ clientId: 'a', since: 50, seen: 0 }], 10), false);
    assert.equal(leadsAmong(self, [{ clientId: 'c', since: 200, seen: 0 }], 10), true);
    assert.equal(leadsAmong(self, [{ clientId: 'a', since: 100, seen: 0 }], 10), false);
    assert.equal(leadsAmong(self, [{ clientId: 'c', since: 100, seen: 0 }], 10), true);
    assert.equal(leadsAmong(self, [{ clientId: 'a', since: 50, seen: 0 }], PEER_TTL_MS + 1), true);
    assert.equal(leadsAmong(self, [{ clientId: 'b', since: 1, seen: 0 }], 0), true, 'itself never counts');
  });

  test('a lone GM window leads; an older window of the same user takes over; a goodbye hands it back', () => {
    assert.equal(isLeadGm(), true);
    handlePeer({ type: 'peer', clientId: 'olderBBB', since: 500 }, 'gm1');
    assert.equal(isLeadClient(), false);
    assert.equal(isLeadGm(), false);
    assert.equal(otherWindows(), 1);
    handlePeer({ type: 'peer', clientId: 'olderBBB', since: 500, bye: true }, 'gm1');
    assert.equal(isLeadGm(), true);
  });

  test('a younger window doesn\'t take over', () => {
    handlePeer({ type: 'peer', clientId: 'youngCCC', since: 5000 }, 'gm1');
    assert.equal(isLeadGm(), true);
  });

  test('only this same user\'s windows count: a player can\'t silence the GM by claiming an older window', () => {
    handlePeer({ type: 'peer', clientId: 'forged11', since: 1 }, 'player1');
    handlePeer({ type: 'peer', clientId: 'forged22', since: 1 }, undefined);
    assert.equal(isLeadGm(), true);
    assert.equal(otherWindows(), 0);
  });

  test('malformed peer messages are ignored', () => {
    for (const m of [null, 'x', { type: 'peer' }, { type: 'peer', clientId: 'a b', since: 1 }, { type: 'peer', clientId: 'ok', since: 'x' }, { type: 'peer', clientId: 'x'.repeat(40), since: 1 }, { type: 'peer', clientId: 'ok', since: 1, bye: 'yes' }]) {
      assert.equal(isPeerMessage(m), false, JSON.stringify(m));
      handlePeer(m, 'gm1');
    }
    assert.equal(otherWindows(), 0);
  });

  test('a newcomer is greeted back at once (so it learns of the older window)', () => {
    const sent: any[] = [];
    const st = g.setTimeout, si = g.setInterval; g.setTimeout = () => 0; g.setInterval = () => 0;
    try { startPeers((m) => sent.push(m)); } finally { g.setTimeout = st; g.setInterval = si; }
    assert.equal(sent[0].probe, true, 'a window that starts asks the others to answer');
    assert.deepEqual({ type: sent[0].type, clientId: sent[0].clientId, since: sent[0].since }, { type: 'peer', clientId: 'selfAAAA', since: 1000 });
    const plain = () => sent.filter((m) => !m.probe && !m.bye).length;
    handlePeer({ type: 'peer', clientId: 'youngCCC', since: 5000 }, 'gm1');
    assert.equal(plain(), 1, 'greeted back');
    const n = sent.length;
    handlePeer({ type: 'peer', clientId: 'youngCCC', since: 5000 }, 'gm1');
    assert.equal(sent.length, n, 'a known window is not greeted again');
  });

  test('players don\'t greet (only GM windows run automation)', () => {
    setUser('p1', false, false);
    const sent: any[] = [];
    startPeers((m) => sent.push(m));
    assert.equal(sent.length, 0);
  });

  test('not the active GM user: never the lead GM', () => {
    setUser('gm2', true, false);
    assert.equal(isLeadGm(), false);
  });

  test('the relay: a second window of the GM user doesn\'t answer player requests', async () => {
    const socket = await import('../applications/socket.ts');
    assert.equal(socket.isRelayGm(), true);
    handlePeer({ type: 'peer', clientId: 'olderBBB', since: 500 }, 'gm1');
    assert.equal(socket.isRelayGm(), false);
    const emitted: any[] = [];
    g.game.socket = { emit: (_c: string, m: any) => emitted.push(m) };
    await socket.handleSocket({ type: 'request', id: 'r1', op: 'nextTurn', userId: 'p1', data: {} } as any, 'p1');
    assert.equal(emitted.length, 0, 'the non-lead window stays silent');
    // A peer message goes to the leader module through the same listener.
    await socket.handleSocket({ type: 'peer', clientId: 'olderBBB', since: 500, bye: true } as any, 'gm1');
    assert.equal(socket.isRelayGm(), true);
  });
});

describe('v0.85.0 review fixes: made here, prompts, probes, duplicates, start-up', () => {
  beforeEach(() => { setUser('gm1', true); _resetPeers(1000, 'selfAAAA'); });

  test('madeHere: only the window that stamped the change; another window of the same user doesn\'t count', () => {
    assert.equal(madeHere({ sr2eWin: 'selfAAAA' }, 'gm1'), true);
    assert.equal(madeHere({ sr2eWin: 'otherBBB' }, 'gm1'), false);
    assert.equal(madeHere({ sr2eWin: 'selfAAAA' }, 'someoneElse'), false);
    assert.equal(madeHere({}, undefined), false);
  });

  test('madeHere without a stamp: the lead window answers for its user (still once)', () => {
    assert.equal(madeHere({}, 'gm1'), true);
    handlePeer({ type: 'peer', clientId: 'olderBBB', since: 500 }, 'gm1');
    assert.equal(madeHere({}, 'gm1'), false);
    assert.equal(madeHere(undefined, 'gm1'), false);
  });

  test('every window stamps its own changes in the pre-hooks (and only its own user\'s)', async () => {
    const hooks: Record<string, Function[]> = {};
    g.Hooks = { on: (k: string, f: Function) => { (hooks[k] ??= []).push(f); } };
    const { registerWindowStamp } = await import('../applications/leader.ts');
    registerWindowStamp();
    for (const k of ['preCreateItem', 'preUpdateActor', 'preDeleteItem', 'preCreateChatMessage', 'preUpdateCombat', 'preUpdateActorDelta']) assert.ok(hooks[k]?.length, k);
    const o: any = {}; hooks['preUpdateActor']![0]!({}, {}, o, 'gm1');
    assert.equal(o.sr2eWin, _selfId());
    const c: any = {}; hooks['preCreateItem']![0]!({}, {}, c, 'gm1');
    assert.equal(c.sr2eWin, _selfId());
    const d: any = {}; hooks['preDeleteItem']![0]!({}, d, 'gm1');
    assert.equal(d.sr2eWin, _selfId());
    const x: any = {}; hooks['preUpdateActor']![0]!({}, {}, x, 'someoneElse');
    assert.equal(x.sr2eWin, undefined);
    delete g.Hooks;
  });

  test('prompts open in the window used most recently, not the lead', () => {
    assert.equal(promptsAmong({ clientId: 'a', since: 1, focusedAt: 10 }, [{ clientId: 'b', since: 2, seen: 0, focusedAt: 20 }], 0), false);
    assert.equal(promptsAmong({ clientId: 'b', since: 2, focusedAt: 20 }, [{ clientId: 'a', since: 1, seen: 0, focusedAt: 10 }], 0), true);
    assert.equal(promptsAmong({ clientId: 'b', since: 2, focusedAt: 0 }, [{ clientId: 'a', since: 1, seen: 0, focusedAt: 0 }], 0), false, 'never focused: the lead order');
    _resetPeers(1000, 'selfAAAA', 50);
    handlePeer({ type: 'peer', clientId: 'olderBBB', since: 500, focusedAt: 10 }, 'gm1');
    assert.equal(isLeadClient(), false);
    assert.equal(isPromptWindow(), true);
    handlePeer({ type: 'peer', clientId: 'olderBBB', since: 500, focusedAt: 90 }, 'gm1');
    assert.equal(isPromptWindow(), false);
  });

  test('a window that doesn\'t answer a probe is dropped (a reload\'s lost goodbye, a crash)', async () => {
    const sent: any[] = [];
    const timers: Function[] = [];
    const st = g.setTimeout, si = g.setInterval;
    g.setTimeout = (f: Function) => { timers.push(f); return 0; }; g.setInterval = () => 0;
    try {
      startPeers((m) => sent.push(m));
      handlePeer({ type: 'peer', clientId: 'ghostGGG', since: 100 }, 'gm1');
      assert.equal(isLeadClient(), false);
      // Hearing it for the first time sends a greeting and a probe; nothing answers before the wait ends.
      assert.ok(sent.some((m) => m.probe));
      const realNow = Date.now; Date.now = () => realNow() + 10;
      try { for (const t of timers) t(); } finally { Date.now = realNow; }
      assert.equal(isLeadClient(), true, 'the ghost is gone after PROBE_WAIT_MS');
    } finally { g.setTimeout = st; g.setInterval = si; }
    assert.ok(PROBE_WAIT_MS <= 5000);
  });

  test('a probe is answered at once', () => {
    const sent: any[] = [];
    const st = g.setTimeout, si = g.setInterval; g.setTimeout = () => 0; g.setInterval = () => 0;
    try { startPeers((m) => sent.push(m)); } finally { g.setTimeout = st; g.setInterval = si; }
    handlePeer({ type: 'peer', clientId: 'youngCCC', since: 5000 }, 'gm1');
    const n = sent.length;
    handlePeer({ type: 'peer', clientId: 'youngCCC', since: 5000, probe: true }, 'gm1');
    assert.equal(sent.length, n + 1);
    assert.equal(sent.at(-1).probe, undefined, 'the answer is a plain greeting (no probe storm)');
  });

  test('a duplicated tab (same id from elsewhere) takes a new id', () => {
    const before = _selfId();
    handlePeer({ type: 'peer', clientId: before, since: 1000 }, 'gm1');
    assert.notEqual(_selfId(), before);
  });

  test('leadSettled resolves at once for a player, and after the greeting starts for a GM', async () => {
    setUser('p1', false, false);
    _resetPeers(1000, 'selfAAAA');
    startPeers(() => {});
    await leadSettled();
  });

  test('the socket listener refuses messages with extra arguments (a forged sender id)', () => {
    const s = SRC('applications/socket.ts');
    assert.match(s, /\(\.\.\.args: any\[\]\) => \{ if \(args\.length === 2\) void handleSocket\(args\[0\], args\[1\]\); \}/);
  });

  test('once-per-session jobs wait for the windows to settle', () => {
    assert.match(SRC('migrations.ts'), /await leadSettled\(\);\n  if \(!isLeadGm\(\)\) return;/);
    assert.match(SRC('settings.ts'), /await leadSettled\(\);\n    if \(!isLeadGm\(\)\) return false;/);
    assert.match(SRC('applications/chat.ts'), /await leadSettled\(\);\n      if \(!isLeadGm\(\)\) return;\n      \/\/ v0\.81\.0: the local date/);
    assert.match(SRC('applications/canvas.ts'), /void leadSettled\(\)\.then\(\(\) => sweep\('timer'\)\)/);
  });

  test('a second GM window hands the round\'s timers to the lead window', () => {
    assert.match(SRC('applications/socket.ts'), /if \(op === 'roundTicks' && !isLeadGm\(\)\) \{\n      const r = await requestOtherWindow\(op, data, ROUND_TICKS_HANDOFF_MS\);\n      if \(!r\.timedOut\) return r;/);
  });
});

describe('v0.85.0 every automation check asks for the lead GM window', () => {
  function files(dir: string, out: string[] = []): string[] {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { if (n !== '__tests__') files(p, out); } else if (n.endsWith('.ts')) out.push(p);
    }
    return out;
  }
  test('no "activeGM.isSelf" or "activeGM.id === user.id" check outside leader.ts', () => {
    const bad: string[] = [];
    for (const f of files(join(process.cwd(), 'src/module'))) {
      if (f.endsWith('leader.ts')) continue;
      readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        if (/activeGM\?*\.isSelf|activeGM\?*\.id\s*[!=]==\s*\(?game|active\.isSelf|gm\.id === \(?game/.test(l)) bad.push(`${f}:${i + 1}`);
      });
    }
    assert.deepEqual(bad, []);
  });

  test('after-change hooks ask madeHere, not "did my user make this" (both GM windows share the user)', () => {
    const bad: string[] = [];
    for (const f of files(join(process.cwd(), 'src/module'))) {
      if (f.endsWith('leader.ts')) continue;
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((l, i) => {
        if (!/userId (===|!==) \(?game( as any)?\)?\.user\?\.id/.test(l)) return;
        // Pre-hooks run only in the window making the change: the user check is right there.
        const ctx = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
        if (/Hooks\.on\('pre|function wardMove|preUpdate/.test(ctx)) return;
        // A notice for someone else's request, and the undo log's own bookkeeping, are per window by design.
        if (/asksForGmPanelRequests|SR2Undo\.undoing/.test(l)) return; // v0.89.1: the notice's text is a key now
        // The art follow-up's fallback when no GM is online (players only).
        if (/return gm \? isLeadGm\(\) :/.test(l)) return;
        // "Another user's change, which the lead GM window follows up" (the GM's own windows are skipped).
        if (/userId !== \(game as any\)\.user\?\.id && isLeadGm\(\)/.test(l)) return;
        bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`);
      });
    }
    assert.deepEqual(bad, []);
  });

  test('the automatic Defend/Resist prompts show only in the window in use', () => {
    const s = SRC('applications/chat.ts');
    assert.match(s, /const leadWindow = !game\.user\?\.isGM \|\| isPromptWindow\(\);/);
    assert.match(s, /if \(!leadWindow \|\| !promptRecipients\(target/);
  });

  test('the guide tells the GM about two windows', () => {
    assert.match(JSON.stringify(JSON.parse(readFileSync(join(process.cwd(), 'public', 'lang', 'en.json'), 'utf8')).SR2E.Guide), /One GM, two windows/); // v0.89.7: the guide's text
  });
});

describe('v0.85.0 the GM-only buttons and the GM\'s own rolls take the GM queue', () => {
  const s = SRC('applications/chat.ts');
  const fn = (name: string): string => {
    const i = s.indexOf(`async function ${name}(`);
    assert.ok(i >= 0, name);
    const ends = [s.indexOf('\nasync function ', i + 10), s.indexOf('\nfunction ', i + 10), s.indexOf('\n/**', i + 10)].filter((x) => x > 0);
    return s.slice(i, Math.min(...ends));
  };
  for (const name of ['onBarrierDamage', 'onSpellWall', 'onStartFire', 'onJamWeapon', 'onEvict', 'onConfirmDeed', 'onRegionDetect', 'onRemoveBug']) {
    test(`${name} changes things under gmLocked, after its dialog`, () => {
      const body = fn(name);
      // onRemoveBug uses gmRoll: the lock for a GM, none for a player removing their own bug.
      assert.match(body, /await gm(Locked|Roll)\(message, button, async \(\) => \{/);
      const lock = Math.max(body.indexOf('gmLocked('), body.indexOf('gmRoll('));
      for (const dialog of ['gmMay(', 'DialogV2']) {
        const at = body.indexOf(dialog);
        if (at >= 0) assert.ok(at < lock, `${name}: ${dialog} comes before the lock`);
      }
    });
  }
  test('done-flags are checked again inside the lock', () => {
    for (const [name, flag] of [['onSpellWall', 'spellWallApplied'], ['onStartFire', 'fireStarted'], ['onEvict', 'evicted'], ['onConfirmDeed', 'deedDone'], ['onRegionDetect', 'regionDetected']]) {
      const body = fn(name!);
      assert.ok(body.indexOf(`getFlag(SYSTEM_ID, '${flag}')`, body.indexOf('gmLocked(')) > 0, `${name} re-checks ${flag}`);
    }
  });
  test('the GM\'s own Defend and Resist rolls go through gmRoll (the lock for a GM, none for a player)', () => {
    assert.match(s, /function gmRoll<T>\(message: any, button: any, fn: \(\) => Promise<T>\): Promise<T> \{\n  return game\.user\?\.isGM \? gmLocked\(message, button, fn\) : fn\(\);/);
    assert.equal((fn('onDefend').match(/await gmRoll\(message, button, \(\) => defender\.defend\(/g) ?? []).length, 4);
    assert.doesNotMatch(fn('onDefend'), /await defender\.defend\(/);
    // Review: inside the lock, a resistance that happened meanwhile (the NPC resisting by itself) stops the GM's.
    for (const [name, call, check] of [['onResist', 'target.resistFromState(damage, pool)', 'resistedOn(message, target)'], ['onResistSpell', 'target.resistSpell(spell, pool, { protectorUuid })', 'spellResistedOn(message, target)']] as const) {
      const body = fn(name);
      const lock = body.indexOf('await gmRoll(message, button, async () => {');
      assert.ok(lock > 0, name);
      assert.ok(body.indexOf(`!resistedBefore && game.user?.isGM && ${check}.includes(index)`, lock) > lock, `${name}: checked again inside`);
      assert.ok(body.indexOf(`await ${call};`, lock) > lock, `${name}: the roll is inside`);
    }
  });
});
