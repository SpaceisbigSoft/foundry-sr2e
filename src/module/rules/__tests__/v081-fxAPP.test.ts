/**
 * v0.81.0 fixer FX-APP: the trusted-card rule (rules/trust.ts, applications/trust.ts) and the application-side
 * fixes of the A review and the SEC1 / SEC2 security audits. Each test failed before its fix.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  safeInt, safePath, safeKey, userOwns, trustedSource, safeAutoApply, gmApplyShapeOk, describeGmChange, undoFieldsToKeep, diffPaths,
  methodRequestProblems, cardSourceUuids, deepSafeKeys, type CardTrust,
} from '../trust.ts';

const g = globalThis as any;

// ---------------------------------------------------------------- Foundry stubs (enough to import the app files)
const hooks: Record<string, Function[]> = {};
g.Hooks = { on: (n: string, f: Function) => { (hooks[n] ??= []).push(f); }, once: (n: string, f: Function) => { (hooks[n] ??= []).push(f); } };
const confirms: any[] = [];
let confirmAnswer = true;
g.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: new Proxy({}, { get: () => class { constructor(..._a: any[]) {} } }) },
  utils: { escapeHTML: (s: string) => s, randomID: () => 'rid', deepClone: (v: any) => structuredClone(v) },
  applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (c: any) => c, DialogV2: { confirm: async (o: any) => { confirms.push(o); return confirmAnswer; }, prompt: async () => null } }, sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} }, ux: {} },
  documents: {},
};
g.CONFIG = { Actor: {}, Item: {}, Combat: {}, ui: {}, TextEditor: {} };
g.Actor = class {}; g.Item = class {}; g.Combat = class {}; g.Combatant = class {}; g.Application = class {};
g.ChatMessage = { create: async (d: any) => { posted.push(d); return d; }, getSpeaker: () => ({}), getSpeakerActor: (sp: any) => (sp?.actor ? docs.get(`Actor.${sp.actor}`) ?? null : null) };
const warnings: string[] = [];
g.ui = { notifications: { warn: (m: string) => { warnings.push(m); }, info() {}, error() {} } };
const posted: any[] = [];
const docs = new Map<string, any>();
g.fromUuidSync = (u: string) => docs.get(u) ?? null;
g.fromUuid = async (u: string) => docs.get(u) ?? null;

/** A minimal DOM: elements with children, text nodes, attributes, dataset, listeners; innerHTML writes recorded. */
const written: string[] = [];
class El {
  tagName: string; className = ''; children: any[] = []; dataset: any = {}; attrs: Record<string, string> = {}; listeners: Record<string, Function[]> = {};
  title = ''; type = ''; disabled = false; _text = ''; _html = '';
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); }
  set innerHTML(v: string) { this._html = v; written.push(v); } get innerHTML() { return this._html; }
  set textContent(v: string) { this._text = v; } get textContent(): string { return this._text + this.children.map((c) => c.textContent ?? '').join(''); }
  appendChild(c: any) { this.children.push(c); return c; }
  addEventListener(n: string, f: Function) { (this.listeners[n] ??= []).push(f); }
  removeAttribute(n: string) { delete this.attrs[n]; }
  setAttribute(n: string, v: string) { this.attrs[n] = v; }
  getAttribute(n: string) { return this.attrs[n] ?? null; }
  get classList() { const self = this; return { add: (c: string) => { self.className = `${self.className} ${c}`.trim(); }, contains: (c: string) => self.className.split(' ').includes(c), remove() {}, toggle() {} }; }
  all(): El[] { return this.children.flatMap((c) => (c instanceof El ? [c, ...c.all()] : [])); }
  matches(sel: string): boolean {
    return sel.split(',').map((s) => s.trim()).some((s) => {
      if (s === '[data-sr2e-action]' || s === 'button[data-sr2e-action]') return this.dataset['sr2eAction'] !== undefined && (s.startsWith('[') || this.tagName === 'BUTTON');
      if (s === '[style]') return this.attrs['style'] !== undefined;
      if (s.startsWith('.message-content ')) return false;
      if (s.startsWith('.')) return this.className.split(' ').includes(s.slice(1));
      return false;
    });
  }
  querySelectorAll(sel: string): El[] {
    const out = this.all().filter((e) => e.matches(sel));
    // '.message-content [style]' / '.message-content': everything inside a .message-content
    if (sel.includes('.message-content')) for (const mc of this.all().filter((e) => e.className.split(' ').includes('message-content'))) out.push(mc, ...mc.all().filter((e) => e.attrs['style'] !== undefined));
    return [...new Set(out)];
  }
  querySelector(sel: string): El | null { return this.querySelectorAll(sel)[0] ?? null; }
  click() { for (const f of this.listeners['click'] ?? []) f({ preventDefault() {}, stopPropagation() {} }); }
}
class Text { constructor(public textContent: string) {} }
g.document = { createElement: (t: string) => new El(t), createTextNode: (t: string) => new Text(t), querySelectorAll: () => [], querySelector: () => null, body: new El('body') };

const GM = { id: 'gm', name: 'GM', isGM: true };
const P1 = { id: 'p1', name: 'Player One', isGM: false };
const P2 = { id: 'p2', name: 'Player Two', isGM: false };
const users = Object.assign([GM, P1, P2], { activeGM: { id: 'gm', isSelf: true }, get: (id: string) => [GM, P1, P2].find((u) => u.id === id) });
g.game = { user: GM, users, settings: { get: () => true }, messages: { contents: [] }, actors: [], scenes: [] };

/** A stub actor owned by `owners` (user ids). */
function actor(id: string, owners: string[], extra: any = {}): any {
  const a = { id, uuid: `Actor.${id}`, name: extra.name ?? id, type: extra.type ?? 'character', ownership: Object.fromEntries(owners.map((o) => [o, 3])), system: extra.system ?? {}, isOwner: true,
    testUserPermission: (u: any, lvl: string) => lvl === 'OWNER' && (u.isGM || owners.includes(u.id)), items: { get: () => null }, getFlag: () => undefined, ...extra };
  docs.set(a.uuid, a);
  return a;
}
/** A stub chat message by `author` with sr2e flags. */
function message(author: any, flags: Record<string, any>, extra: any = {}): any {
  return { id: extra.id ?? `m${Math.random()}`, author, content: extra.content ?? '', speaker: extra.speaker ?? {}, flags: { sr2e: flags }, isOwner: true,
    getFlag: (_s: string, k: string) => flags[k], setFlag: async (_s: string, k: string, v: any) => { flags[k] = v; }, ...extra };
}

const OWNS_NOTHING: CardTrust = { authorIsGm: false, owns: () => false };
const ownsOnly = (...uuids: string[]): CardTrust => ({ authorIsGm: false, owns: (u) => uuids.includes(u) });

// ---------------------------------------------------------------- rules/trust.ts
describe('rules/trust.ts: the pure part', () => {
  test('safeInt: non-numbers fall back, numbers are truncated and clamped', () => {
    assert.equal(safeInt('7', 0, 10, 1), 7);
    assert.equal(safeInt(99, 0, 10, 1), 10);
    assert.equal(safeInt(-5, 0, 10, 1), 0);
    assert.equal(safeInt('x', 0, 10, 1), 1);
    assert.equal(safeInt(Infinity, 0, 10, 1), 1);
    assert.equal(safeInt(null, 0, 10, 3), 3);
    assert.equal(safeInt(true, 0, 10, 3), 3);
    assert.equal(safeInt(2.9, 0, 10, 0), 2);
  });
  test('safePath / safeKey / deepSafeKeys refuse prototype segments', () => {
    assert.equal(safePath('COMBAT.prone.targetMelee'), true);
    for (const p of ['__proto__', 'COMBAT.__proto__.x', 'constructor.prototype.bad', 'a..b', '']) assert.equal(safePath(p), false, p);
    assert.equal(safeKey('constructor'), false);
    assert.equal(deepSafeKeys(JSON.parse('{"a":{"__proto__":{"x":1}}}')), false);
    assert.equal(deepSafeKeys({ a: [{ b: 1 }] }), true);
  });
  test('userOwns: GMs own everything; players by Foundry\'s check or the ownership map', () => {
    const doc = { ownership: { p1: 3, default: 0 } };
    assert.equal(userOwns(GM, doc), true);
    assert.equal(userOwns(P1, doc), true);
    assert.equal(userOwns(P2, doc), false);
    assert.equal(userOwns(P2, { ownership: { default: 3 } }), true);
    assert.equal(userOwns(null, doc), false);
    assert.equal(userOwns(P1, { testUserPermission: () => false, ownership: { p1: 3 } }), false);
  });
  test('trustedSource: a GM author, or one who owns a named source', () => {
    assert.equal(trustedSource({ authorIsGm: true, owns: () => false }, []), true);
    assert.equal(trustedSource(ownsOnly('Actor.a'), ['Actor.b', 'Actor.a']), true);
    assert.equal(trustedSource(ownsOnly('Actor.a'), ['Actor.b', null, 3]), false);
  });
});

describe('SEC1-4 safeAutoApply: allow-listed keys, author binding, never the dangerous kinds', () => {
  const me = ownsOnly('Actor.decker');
  const src = { sourceUuid: 'Actor.decker' };
  test('a host change: only raising by itself (no reset, alert set, passcode, file op)', () => {
    // v0.81.1 round 2 (FIX2-BRIEF B): no host change applies by itself any more (the rest of this test still holds).
    assert.equal(safeAutoApply('applyHost', { hostChange: { hostUuid: 'Actor.h', minAlert: 'passive', ...src } }, me), false);
    for (const bad of [{ resetTally: true }, { setAlert: 'none' }, { setAlert: 'shutdown' }, { validate: 'Actor.decker' }, { decrypt: 'f1' }, { removeFile: 'f1' }, { addFile: { name: 'x' } }, { defuse: {} }]) {
      assert.equal(safeAutoApply('applyHost', { hostChange: { hostUuid: 'Actor.h', ...src, ...bad } }, me), false, JSON.stringify(bad));
    }
    // A host change bound to nobody the author owns waits for the GM.
    assert.equal(safeAutoApply('applyHost', { hostChange: { hostUuid: 'Actor.h', minAlert: 'passive' } }, me), false);
    // Files found by a decker the author doesn't own: no.
    assert.equal(safeAutoApply('applyHost', { hostChange: { hostUuid: 'Actor.h', found: { deckerUuid: 'Actor.other', ids: ['a'] }, ...src } }, me), false);
    assert.equal(safeAutoApply('applyHost', { hostChange: { hostUuid: 'Actor.h', found: { deckerUuid: 'Actor.decker', ids: ['a'] } } }, me), false);
  });
  test('a site change: no door or device bypass, no lowering the tally', () => {
    // Round 2 (B): no site change by itself.
    assert.equal(safeAutoApply('applySite', { siteChange: { siteUuid: 'Actor.s', add: 2, ...src } }, me), false);
    assert.equal(safeAutoApply('applySite', { siteChange: { siteUuid: 'Actor.s', deviceId: 'd1', bypassed: true, ...src } }, me), false);
    assert.equal(safeAutoApply('applySite', { siteChange: { siteUuid: 'Actor.s', add: -30, ...src } }, me), false);
    assert.equal(safeAutoApply('applySite', { siteChange: { siteUuid: 'Actor.s', add: 2, extra: 1, ...src } }, me), false, 'a key outside the allow-list');
  });
  test('tally: bound to an owned source and positive', () => {
    // Round 2 (B): no tally by itself.
    assert.equal(safeAutoApply('applyTally', { tally: { hostUuid: 'Actor.h', successes: 3, ...src } }, me), false);
    assert.equal(safeAutoApply('applyTally', { tally: { hostUuid: 'Actor.h', successes: 3 } }, me), false, 'no source the author owns');
    assert.equal(safeAutoApply('applyTally', { tally: { hostUuid: 'Actor.h', successes: 3, sourceUuid: 'Actor.other' } }, me), false);
    assert.equal(safeAutoApply('applyTally', { tally: { hostUuid: 'Actor.h', successes: -30, ...src } }, me), false);
    // v0.81.1 (SEC1-6, design 3): the test's roller and the speaker no longer count as sources (the author sets them).
    assert.equal(safeAutoApply('applyTally', { tally: { hostUuid: 'Actor.h', successes: 3 }, test: { actorUuid: 'Actor.decker' } }, me), false);
  });
  test('jams and holds: only on what the author owns', () => {
    assert.equal(safeAutoApply('applyJam', { jam: { droneUuid: 'Actor.otherDecker', by: 'Me', rating: 4 } }, me), false);
    assert.equal(safeAutoApply('applyHold', { hold: { targetUuid: 'Actor.boss', holderUuid: 'Actor.decker' } }, me), false);
    // v0.81.1 (RB2-2): an intercept is always of someone else's drone: it waits for the GM.
    assert.equal(safeAutoApply('applyDroneLink', { droneLink: { droneUuid: 'Actor.d', kind: 'intercept', byUuid: 'Actor.decker', by: 'Me' } }, me), false);
    assert.equal(safeAutoApply('applyDroneLink', { droneLink: { droneUuid: 'Actor.d', kind: 'intercept', byUuid: 'Actor.someone', by: 'Me' } }, me), false);
  });
  test('actor updates: damage, nuyen and removals never by themselves (R2-SEC-9: nor healing an actor the author doesn\'t own)', () => {
    // v0.81.0 round 2 (R2-SEC-9): a heal "from an owned source" no longer applies by itself; it waits for the GM.
    assert.equal(safeAutoApply('applyActorUpdate', { actorUpdate: { uuid: 'Actor.boss', monitor: { track: 'physical', boxes: -2 }, ...src } }, me), false);
    assert.equal(safeAutoApply('applyActorUpdate', { actorUpdate: { uuid: 'Actor.boss', monitor: { track: 'physical', boxes: 20 }, ...src } }, me), false);
    assert.equal(safeAutoApply('applyActorUpdate', { actorUpdate: { uuid: 'Actor.boss', nuyen: { amount: 1000, label: 'x' }, ...src } }, me), false);
    assert.equal(safeAutoApply('applyActorUpdate', { actorUpdate: { uuid: 'Actor.boss', remove: true, ...src } }, me), false);
    assert.equal(safeAutoApply('applyActorUpdate', { actorUpdate: { uuid: 'Actor.boss', monitor: { track: 'physical', boxes: -2 } } }, OWNS_NOTHING), false);
  });
  test('SEC1-1: an actorUpdate with a free-form `update` never has the right shape (click or auto)', () => {
    assert.equal(gmApplyShapeOk('applyActorUpdate', { actorUpdate: { uuid: 'User.p1', update: { role: 4 } } }), false);
    assert.equal(gmApplyShapeOk('applyActorUpdate', { actorUpdate: { uuid: 'Actor.n', monitor: { track: 'stun', boxes: 1 }, update: {} } }), false);
    assert.equal(gmApplyShapeOk('applyActorUpdate', { actorUpdate: { uuid: 'Actor.n', monitor: { track: 'stun', boxes: 1 } } }), true);
    assert.equal(gmApplyShapeOk('applyActorUpdate', { actorUpdate: { uuid: 'Actor.n', handSpirit: { toUuid: 'Actor.b', services: 3, oldSummonerUuid: '' } } }), true);
  });
  test('the confirmation lines come from the flags and name what changes', () => {
    const lines = describeGmChange('applyHost', { hostChange: { hostUuid: 'Actor.h', resetTally: true, validate: 'Actor.p' } }, (u) => (u === 'Actor.h' ? 'Ares host' : u === 'Actor.p' ? 'Dodger' : ''));
    assert.deepEqual(lines, ['Host Ares host:', 'the security tally RESET to 0', 'a passcode GIVEN to Dodger']);
    assert.match(describeGmChange('applySite', { siteChange: { siteUuid: 'Actor.s', deviceId: 'd1', bypassed: true } }).join(' '), /BYPASSED/);
    assert.deepEqual(cardSourceUuids('applyHold', { hold: { targetUuid: 'Actor.t', holderUuid: 'Actor.h' }, test: { actorUuid: 'Actor.r' } }), ['Actor.h', 'Actor.r']);
  });
});

describe('SEC1-9 / A-5 undo: only the fields the server changed, never ownership', () => {
  test('a forged "before" for ownership or Karma is dropped; the real change is kept', () => {
    const filed = [{ path: 'system.notes', had: true, before: 'a' }, { path: 'ownership.p2', had: true, before: 3 }, { path: 'system.karma.good', had: true, before: 999 }, { path: '__proto__.x', had: true, before: 1 }];
    const kept = undoFieldsToKeep(filed, { system: { notes: 'b' }, _stats: { modifiedTime: 1 } });
    assert.deepEqual(kept.map((f) => f.path), ['system.notes']);
  });
  test('a field recorded whole, or a change to a parent object, still counts', () => {
    assert.deepEqual(undoFieldsToKeep([{ path: 'system.monitor' }], { system: { monitor: { physical: 3 } } }).length, 1);
    assert.deepEqual(undoFieldsToKeep([{ path: 'flags.sr2e.x.y' }], { flags: { sr2e: { '-=x': null } } }).length, 1);
    assert.deepEqual(diffPaths({ a: { b: 1, '-=c': null }, d: [1] }).sort(), ['a.b', 'a.c', 'd']);
  });
});

describe('SEC1-10 approvals: the data is checked again on approval', () => {
  test('methodRequestProblems: a buyItem price that isn\'t the filed one, a negative number, a prototype key', () => {
    assert.deepEqual(methodRequestProblems({ method: 'buyItem', args: ['i1', 500, 0, 1] }, { karma: 0, nuyen: 500 }), []);
    assert.equal(methodRequestProblems({ method: 'buyItem', args: ['i1', 0, 0, 1] }, { karma: 0, nuyen: 500 }).length, 1);
    assert.ok(methodRequestProblems({ method: 'buyItem', args: ['i1', -50000, 0, 1] }, { karma: 0, nuyen: -50000 }).length >= 1);
    assert.ok(methodRequestProblems({ method: 'improve', args: [JSON.parse('{"__proto__":{"x":1}}')] }, { karma: 1, nuyen: 0 }).length >= 1);
  });
  test('approvals.ts: an edited request is refused, and the GM panel says what it runs', async () => {
    const ap = await import('../../applications/approvals.ts');
    const a: any = actor('corvo', ['p1'], { flags: { sr2e: { requests: { r1: { id: 'r1', kind: 'add', label: 'Pay for Ares Predator', karma: 0, nuyen: 500, userId: 'p1', userName: 'Corvo', at: 1, data: { method: 'buyItem', args: ['i1', 0, 0, 1] } } } } } });
    g.game.actors = [a];
    let ran = false;
    a.buyItem = async () => { ran = true; return true; };
    a.update = async () => a;
    const r = ap.requestsOf(a)[0]!;
    assert.match(ap.requestProblems(a, r).join(' '), /¥0, but ¥500 was filed/);
    assert.equal(await ap.approveRequest(a, 'r1'), false);
    assert.equal(ran, false);
    assert.match(ap.pendingRequests()[0]!.text, /buyItem\(i1, 0, 0, 1\) \(asked as "Pay for Ares Predator"\).*⚠/);
    g.game.actors = [];
  });
});

describe('SEC1-7 / A-1 / A-10 the socket relay', () => {
  test('the sender comes from the transport: a forged GM userId is refused and runs nothing', async () => {
    const socket = await import('../../applications/socket.ts');
    const sent: any[] = [];
    g.game.socket = { emit: (_n: string, m: any) => { sent.push(m); }, on() {} };
    const seen: any[] = [];
    socket.onRelay('spendSpellDefense', async (_d, user) => { seen.push(user); return { ok: true }; });
    await socket.handleSocket({ type: 'request', id: 'q1', op: 'spendSpellDefense', userId: 'gm', data: {} } as any, 'p1');
    assert.deepEqual(seen, []);
    assert.deepEqual({ ok: sent.at(-1).ok, to: sent.at(-1).to }, { ok: false, to: 'p1' });
    await socket.handleSocket({ type: 'request', id: 'q2', op: 'spendSpellDefense', userId: 'p1', data: {} } as any, 'p1');
    assert.equal((seen.at(-1) as any)?.id, 'p1', 'run as the real sender');
    // No sender at all (not from the socket): nothing runs.
    await socket.handleSocket({ type: 'request', id: 'q3', op: 'spendSpellDefense', userId: 'gm', data: {} } as any);
    assert.equal(seen.length, 1);
    delete g.game.socket;
  });
  test('requestGm on the active GM\'s own client turns a throwing handler into {ok:false}', async () => {
    const socket = await import('../../applications/socket.ts');
    socket.onRelay('roundTicks', async () => { throw new Error('boom'); });
    const r = await socket.requestGm('roundTicks', {});
    assert.deepEqual(r, { ok: false, note: 'boom' });
  });
});

describe('SEC2-9 house rules: setPath/getPath refuse prototype segments', () => {
  test('advanced JSON can\'t swap the prototype of RULES or a section', async () => {
    const { applyHouseRules, setPath, getPath } = await import('../../settings.ts');
    const { RULES } = await import('../index.ts');
    const adv = JSON.parse('{"__proto__": {"POLLUTED": 7}, "COMBAT.__proto__": {"zzz": 1}, "constructor.prototype.bad": 1}');
    const problems = applyHouseRules({ advanced: adv, values: {} });
    assert.equal((RULES as any).POLLUTED, undefined);
    assert.equal((RULES as any).COMBAT.zzz, undefined);
    assert.equal(({} as any).bad, undefined);
    assert.equal(problems.length, 3);
    const o: any = { a: { b: 1 } };
    assert.equal(setPath(o, '__proto__.x', 1), false);
    assert.equal(getPath(o, 'a.constructor'), undefined);
    assert.equal(getPath(o, 'a.b'), 1);
  });
});

describe('chat.ts: the render hook (SEC2-1) and card handlers', () => {
  let chat: any;
  const setup = async () => {
    if (chat) return chat;
    chat = await import('../../applications/chat.ts');
    chat.registerChatHandlers();
    return chat;
  };
  const render = (msg: any, root: El) => { for (const f of hooks['renderChatMessageHTML'] ?? []) f(msg, root); };

  test('a player-named target and a forged soak type never reach innerHTML (pan links and GM tools are elements)', async () => {
    await setup();
    const evil = '<img src=x onerror="window.__pwn=1">';
    actor('victim', ['p2'], { name: evil });
    written.length = 0;
    const msg = message(P1, { attack: { targetUuid: 'Actor.victim' }, test: { kind: 'soak', actorUuid: 'Actor.victim', soak: { mode: 'stage', track: false, type: '<svg onload="window.__pwn2=1">' } } });
    const root = new El();
    const content = new El(); content.className = 'message-content'; root.appendChild(content);
    render(msg, root);
    assert.ok(!written.some((w) => w.includes('onerror') || w.includes('<svg')), written.join('\n'));
    const links = content.all().filter((e) => e.className === 'sr2e-pan');
    assert.equal(links.length, 1);
    assert.match(links[0]!.textContent, /<img src=x/, 'the name is text');
    const box = content.all().find((e) => e.dataset['sr2eAction'] === 'gmBox');
    assert.equal(box?.dataset['track'], 'physical', 'an unknown track is physical');
  });

  test('inline styles come off a card with a system button (a forged full-screen button)', async () => {
    const { stripCardStyles } = await setup();
    const root = new El();
    const content = new El(); content.className = 'message-content'; root.appendChild(content);
    const wrap = new El(); wrap.setAttribute('style', 'font-size:500px'); content.appendChild(wrap);
    const b = new El('button'); b.dataset['sr2eAction'] = 'resist'; b.setAttribute('style', 'position:fixed;inset:0'); wrap.appendChild(b);
    stripCardStyles(root as any);
    assert.equal(b.getAttribute('style'), null);
    assert.equal(wrap.getAttribute('style'), null);
    // A plain message keeps its styles (v0.81.1 round 2, FIX2-BRIEF C: a GM's message untouched; a player's keeps its
    // colour and bold and loses only what places or hides things).
    const plain = new El(); const pc = new El(); pc.className = 'message-content'; plain.appendChild(pc); const sp = new El(); sp.setAttribute('style', 'color:red'); pc.appendChild(sp);
    stripCardStyles(plain as any, { author: { id: 'gm', isGM: true } });
    assert.equal(sp.getAttribute('style'), 'color:red');
    const pl = new El(); const plc = new El(); plc.className = 'message-content'; pl.appendChild(plc); const sp2 = new El(); sp2.setAttribute('style', 'color:red; font-weight:bold; position:fixed; inset:0'); plc.appendChild(sp2);
    stripCardStyles(pl as any, { author: { id: 'p1', isGM: false } });
    assert.equal(sp2.getAttribute('style'), 'color:red; font-weight:bold');
  });

  test('a GM tool button written into a card\'s content does nothing (only decorateCard\'s own)', async () => {
    await setup();
    const boss = actor('boss', [], { type: 'npc' });
    let adjusted = 0;
    g.CONFIG.Actor.documentClass = { gmAdjustBoxes: async () => { adjusted++; return true; } };
    const msg = message(P1, { test: { kind: 'skill', actorUuid: boss.uuid } });
    const root = new El();
    const content = new El(); content.className = 'message-content'; root.appendChild(content);
    const forged = new El('button'); forged.dataset['sr2eAction'] = 'gmBox'; forged.dataset['delta'] = '-40'; content.appendChild(forged);
    render(msg, root);
    forged.click();
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(adjusted, 0);
  });

  test('A-6: two copies of a card button clicked at once run once', async () => {
    await setup();
    const caster = actor('caster', ['gm']);
    let runs = 0;
    caster.usePower = async () => { runs++; await new Promise((r) => setTimeout(r, 20)); };
    docs.set('Item.pow', { parent: caster });
    const msg = message(GM, { repeat: { powerUuid: 'Item.pow', targetUuids: [] } }, { id: 'm-a6' });
    const copies = [new El(), new El()].map((root) => { const b = new El('button'); b.dataset['sr2eAction'] = 'repeatPower'; root.appendChild(b); render(msg, root); return b; });
    copies[0]!.click(); copies[1]!.click();
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(runs, 1);
    copies[1]!.click();
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(runs, 2, 'free again once the first run is over');
  });

  test('SEC1-6: a forged card can\'t make a player\'s own client spend their Karma or fire their power', async () => {
    await setup();
    const mine = actor('mine', ['p2']);
    let used = 0;
    mine.usePower = async () => { used++; };
    docs.set('Item.pow2', { parent: mine });
    g.game.user = P2;
    const forged = message(P1, { repeat: { powerUuid: 'Item.pow2', targetUuids: ['Actor.x'] } });
    const root = new El(); const b = new El('button'); b.dataset['sr2eAction'] = 'repeatPower'; root.appendChild(b);
    render(forged, root); b.click();
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(used, 0);
    assert.match(warnings.at(-1) ?? '', /posted by Player One/);
    g.game.user = GM;
  });

  test('SEC1-3: a pending spirit is only a spirit or a barrier, never with the card\'s ownership', async () => {
    const { spiritCreateData } = await setup();
    assert.equal(spiritCreateData({ name: 'Boss', type: 'npc', ownership: { p1: 3 } }), null);
    assert.equal(spiritCreateData(JSON.parse('{"type":"spirit","name":"x","system":{"__proto__":{"a":1}}}')), null);
    const r = spiritCreateData({ name: 'Fire spirit', type: 'spirit', ownership: { p1: 3 }, folder: 'f', _id: 'x', system: { summonerUuid: 'Actor.s', force: 99 }, items: [{ name: 'Engulf', type: 'power', ownership: { p1: 3 }, _id: 'i' }] });
    assert.equal(r.data.ownership, undefined);
    assert.equal(r.data.folder, undefined);
    assert.equal(r.data._id, undefined);
    assert.equal(r.data.system.force, 30);
    assert.deepEqual(r.data.items, [{ name: 'Engulf', type: 'power' }]);
    assert.equal(r.summonerUuid, 'Actor.s');
  });

  test('SEC1-3: Create spirit from another player\'s summoner does nothing; from the author\'s own, it takes the summoner\'s owners', async () => {
    await setup();
    const created: any[] = [];
    g.Actor = { implementation: { create: async (d: any) => { created.push(d); return { uuid: 'Actor.new', name: d.name, system: d.system }; } } };
    const theirs = actor('theirs', ['p2']);
    const own = actor('own', ['p1']);
    const press = (msg: any) => { const root = new El(); const b = new El('button'); b.dataset['sr2eAction'] = 'createSpirit'; root.appendChild(b); render(msg, root); b.click(); };
    press(message(P1, { pendingSpirit: { name: 'Ally', type: 'spirit', ownership: { p1: 3 }, system: { summonerUuid: theirs.uuid }, flags: { sr2e: { allyRitual: true } } } }));
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(created.length, 0);
    press(message(P1, { pendingSpirit: { name: 'Watcher', type: 'spirit', ownership: { default: 3 }, system: { summonerUuid: own.uuid } } }));
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(created.length, 1);
    assert.deepEqual(created[0].ownership, { p1: 3 });
    press(message(P1, { pendingSpirit: { name: 'Boss', type: 'npc', system: {} } }));
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(created.length, 1);
  });

  test('SEC1-5: an Apply (GM) click on another player\'s card asks the GM, from the flags; a card naming an actor the author doesn\'t own is refused', async () => {
    await setup();
    let applied = 0;
    g.CONFIG.Actor.documentClass = { applyHostChange: async () => { applied++; return '<p>ok</p>'; }, setHeld: async () => { applied++; } };
    actor('host1', [], { type: 'host', name: 'Ares host' });
    const press = (msg: any, action: string) => { const root = new El(); const b = new El('button'); b.dataset['sr2eAction'] = action; root.appendChild(b); render(msg, root); b.click(); };
    confirms.length = 0; confirmAnswer = false;
    press(message(P1, { hostChange: { hostUuid: 'Actor.host1', resetTally: true } }), 'applyHost');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(applied, 0);
    assert.equal(confirms.length, 1);
    assert.match(confirms[0].content, /RESET to 0/);
    assert.match(confirms[0].content, /Player One/);
    confirmAnswer = true;
    press(message(P1, { hostChange: { hostUuid: 'Actor.host1', resetTally: true } }), 'applyHost');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(applied, 1);
    // A hold whose holder the author doesn't own: refused without asking.
    actor('boss2', [], { type: 'npc' }); actor('notmine', ['p2']);
    confirms.length = 0;
    press(message(P1, { hold: { targetUuid: 'Actor.boss2', holderUuid: 'Actor.notmine' } }), 'applyHold');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(applied, 1);
    assert.equal(confirms.length, 0);
    // A free-form update: refused by its shape.
    let updated = 0;
    g.CONFIG.Actor.documentClass = { applyActorUpdate: async () => { updated++; return true; } };
    press(message(P1, { actorUpdate: { uuid: 'User.p1', update: { role: 4 } } }), 'applyActorUpdate');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(updated, 0);
  });

  test('SEC1-18: a card with flags of an odd shape doesn\'t throw out of the hooks', async () => {
    await setup();
    const msg = message(P1, { damages: 'x', attacks: {}, attack: 5, spells: [null, 3], pendingSpirit: 'big' }, { content: '<button data-sr2e-action="resist">' });
    const root = new El(); const c = new El(); c.className = 'message-content'; root.appendChild(c);
    assert.doesNotThrow(() => render(msg, root));
    assert.doesNotThrow(() => { for (const f of hooks['createChatMessage'] ?? []) f(msg); });
    await new Promise((r) => setTimeout(r, 350));
  });
});

describe('A-8 walls rated 0, A-4 migrations, A-17 quick rolls', () => {
  test('a wall saved with 0 counts the default for gunfire; one damaged down to 0 stays 0', async () => {
    const { wallRating } = await import('../../applications/canvas.ts');
    const { RULES } = await import('../index.ts');
    const def = RULES.COMBAT.barriers.defaultWallRating;
    const wall = (flags: any) => ({ flags: { sr2e: flags }, getFlag: (_s: string, k: string) => flags[k] });
    assert.equal(wallRating(wall({ barrierRating: 0 })), def);
    assert.equal(wallRating(wall({})), def);
    assert.equal(wallRating(wall({ barrierRating: 7 })), 7);
    assert.equal(wallRating(wall({ barrierRating: 0, barrierFull: 6 })), 0);
  });
  test('Killing Hands moves once (marked), and an unlinked token\'s actor migrates only its delta\'s items', async () => {
    const mig = await import('../../migrations.ts');
    const kh = { type: 'adeptpower', system: { special: 'killingHands', level: 2 } };
    assert.deepEqual(mig.killingHandsMigrationUpdate(kh), { 'system.level': 3 });
    assert.equal(mig.killingHandsMigrationUpdate({ ...kh, flags: { sr2e: { mig077: true } } }), null);
    const items = [{ id: 'base1' }, { id: 'delta1' }];
    const synthetic = { isToken: true, items, token: { delta: { _source: { items: [{ _id: 'delta1' }] } } } };
    assert.deepEqual(mig.ownItems(synthetic).map((i: any) => i.id), ['delta1']);
    assert.deepEqual(mig.ownItems({ items }).map((i: any) => i.id), ['base1', 'delta1']);
  });
  test('disarmQuickRoll drops an armed quick roll', async () => {
    const hk = await import('../../applications/hotkeys.ts');
    const doc: any = g.document;
    let clickHandler: any = null;
    doc.addEventListener = (_n: string, f: any) => { clickHandler = f; };
    hk.registerQuickRolls();
    const el: any = { dataset: { action: 'rollSkill' }, closest: (s: string) => (s.includes('[data-action]') ? el : el) };
    clickHandler({ shiftKey: true, target: { closest: () => el } });
    assert.equal(hk.quickRollArmed(), true);
    hk.disarmQuickRoll();
    assert.equal(hk.quickRollArmed(), false);
  });
});
