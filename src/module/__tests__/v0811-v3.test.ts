/**
 * v0.81.1, the lead's fixes after the round-3 review (V3): every runAsAuthor call is queued (no fast path for a GM
 * card), the relay's expiry margin (10 s of 20 s) and the round timers that never expire, and house-rule cells that
 * take another kind only from their own column. Built from the reviewer's probes (RV/try-V3), inverted; the race and
 * relay-window probes are re-timed (the original race probe waited on the player's run itself, which now queues).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';


const g = globalThis as any;

// ---------------------------------------------------------------- Foundry stubs (enough to import the app files)
const hooks: Record<string, Function[]> = {};
g.Hooks = { on: (n: string, f: Function) => { (hooks[n] ??= []).push(f); }, once: (n: string, f: Function) => { (hooks[n] ??= []).push(f); } };
const confirms: any[] = [];
const prompts: any[] = [];
let confirmAnswer = true;
g.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: new Proxy({}, { get: () => class { constructor(..._a: any[]) {} } }) },
  utils: { escapeHTML: (s: string) => s, randomID: () => 'rid', deepClone: (v: any) => structuredClone(v) },
  applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (c: any) => c, DialogV2: { confirm: async (o: any) => { confirms.push(o); return confirmAnswer; }, prompt: async (o: any) => { prompts.push(o); return null; } } }, sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} }, ux: {} },
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




const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
let chat: any;
const setup = async () => { if (chat) return chat; chat = await import('../applications/chat.ts'); chat.registerChatHandlers(); return chat; };
const render = (msg: any, root: El) => { for (const f of hooks['renderChatMessageHTML'] ?? []) f(msg, root); };
const press = (msg: any, action: string, data: Record<string, string> = {}) => { const root = new El(); const b = new El('button'); b.dataset['sr2eAction'] = action; Object.assign(b.dataset, data); root.appendChild(b); render(msg, root); b.click(); };
void prompts;
/** Back to the GM, answering yes, with no dialogs recorded (the start of a test). */
const resetUser = () => { g.game.user = GM; confirmAnswer = true; confirms.length = 0; };

// =============================================================================== V3 probes, inverted
describe('V3 probes (applications)', () => {
  test('V3-race (inverted): a GM card is queued too, so a player\'s re-run started meanwhile waits for it', async () => {
    await setup();
    const { SR2Actor } = await import('../documents/index.ts');
    const S: any = SR2Actor;
    g.CONFIG.Actor.documentClass = S;
    const seen: any[] = [];
    actor('npcR', [], { system: { karma: { poolSpent: 0, pool: 5 } }, karmaReroll: async () => { seen.push(['start', S.actingAuthor?.id ?? null]); await tick(30); seen.push(['after await', S.actingAuthor?.id ?? null]); } });
    resetUser();
    press(message(GM, { test: { actorUuid: 'Actor.npcR', kind: 'skill', label: 'Shoot', dice: [], testId: 'tR' } }), 'karmaReroll');
    await tick(10);
    // meanwhile the GM Karma-re-rolls P1's card: it waits for the GM card's queued task
    const p1 = S.runAsAuthor(P1, async () => { seen.push(['P1', S.actingAuthor?.id ?? null]); });
    await p1; await tick(10);
    assert.deepEqual(seen, [['start', null], ['after await', null], ['P1', 'p1']]);
  });

  test('V2-relay (the expiry scaled to 40 ms here): a request whose turn comes after the expiry is not run', async () => {
    const sock = await import('../applications/socket.ts');
    const { withGmLock } = await import('../applications/gmlock.ts');
    let spent = 0;
    sock.onRelay('spendSpellDefense', async () => { spent += 4; return { ok: true }; });
    g.game.socket = { emit() {} };
    g.game.user = P1; const prevActive = users.activeGM; (users as any).activeGM = { id: 'gm', isSelf: false, active: true };
    let release!: () => void;
    const held = withGmLock(() => new Promise<void>((r) => { release = r; }));
    try {
      const asked = sock.requestGm('spendSpellDefense', { protectorUuid: 'Actor.ally', targetUuid: 'Actor.me', amount: 4 }, 50);
      g.game.user = GM; (users as any).activeGM = prevActive;
      const handled = sock.handleSocket({ type: 'request', id: 'rq', op: 'spendSpellDefense', userId: 'p1', data: {} } as any, 'p1', 40);
      const r = await asked;
      assert.equal(r.timedOut, true);
      release(); await held; await handled;
    } finally { g.game.user = GM; (users as any).activeGM = prevActive; delete g.game.socket; }
    assert.equal(spent, 0);
  });

  test('V3 #4: the round timers run however late their turn comes (never answered "timed out", never run twice)', async () => {
    const sock = await import('../applications/socket.ts');
    const { withGmLock } = await import('../applications/gmlock.ts');
    let ran = 0;
    sock.onRelay('roundTicks', async () => { ran++; return { ok: true }; });
    g.game.socket = { emit() {} };
    let release!: () => void;
    const held = withGmLock(() => new Promise<void>((r) => { release = r; }));
    try {
      const handled = sock.handleSocket({ type: 'request', id: 'rqT', op: 'roundTicks', userId: 'p1', data: {} } as any, 'p1', 5);
      await tick(20); release(); await held; await handled;
    } finally { delete g.game.socket; }
    assert.equal(ran, 1);
  });

  test('V3-relay-window (lead: a 10 s margin, scaled 25 vs 50 here): a request that starts just inside the expiry still answers before its requester gives up', async () => {
    const sock = await import('../applications/socket.ts');
    const { withGmLock } = await import('../applications/gmlock.ts');
    let spent = 0;
    sock.onRelay('spendSpellDefense', async () => { await tick(40); spent += 4; return { ok: true }; });
    g.game.socket = { emit() {} };
    g.game.user = P1; const prevActive = users.activeGM; (users as any).activeGM = { id: 'gm', isSelf: false, active: true };
    let release!: () => void;
    const held = withGmLock(() => new Promise<void>((r) => { release = r; }));
    let r: any;
    try {
      // scale: timeout 50 = 20 s, expiry 25 = 10 s; the handler's turn comes at ~30, after the expiry: not run
      const asked = sock.requestGm('spendSpellDefense', { protectorUuid: 'Actor.ally', targetUuid: 'Actor.me', amount: 4 }, 50);
      g.game.user = GM; (users as any).activeGM = prevActive;
      const handled = sock.handleSocket({ type: 'request', id: 'rq2', op: 'spendSpellDefense', userId: 'p1', data: {} } as any, 'p1', 25);
      await tick(30); release();
      r = await asked;
      await held; await handled;
    } finally { g.game.user = GM; (users as any).activeGM = prevActive; delete g.game.socket; }
    assert.ok(!(r.timedOut && spent === 4), 'the requester counted no dice, the protector lost 4');
  });

  test('V3-hr-str: a numeric cell given a string that appears ELSEWHERE in the section defaults is refused', async () => {
    const s = await import('../settings.ts');
    const D: any = s.RULE_DEFAULTS;
    const strs = new Set<string>();
    const walk = (o: any) => { if (typeof o === 'string') strs.add(o); else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
    walk(D.COMBAT);
    const word = [...strs].find((x) => /^[a-z]+$/i.test(x))!;
    const bad: any = structuredClone(D.COMBAT);
    const find = (o: any, path: string[]): string[] | null => { for (const [k, v] of Object.entries(o)) { if (typeof v === 'number') return [...path, k]; if (v && typeof v === 'object' && !Array.isArray(v)) { const r = find(v, [...path, k]); if (r) return r; } } return null; };
    const path = find(bad, [])!;
    let o = bad; for (const k of path.slice(0, -1)) o = o[k];
    o[path.at(-1)!] = word;
    try {
      const p = s.applyHouseRules({ advanced: { COMBAT: bad } });
      let r: any = (await import('../rules/index.ts') as any).RULES.COMBAT; for (const k of path) r = r?.[k];
      assert.ok(p.length > 0, `accepted: RULES.COMBAT.${path.join('.')} = ${JSON.stringify(r)}`);
    } finally { s.applyHouseRules({}); }
  });

  test('V3-hr-num: a string cell (damage level, skill name) given a number is refused', async () => {
    const s = await import('../settings.ts');
    const D: any = s.RULE_DEFAULTS;
    const bad: any = structuredClone(D.COMBAT);
    const find = (o: any, path: string[]): string[] | null => { for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && k !== 'match') return [...path, k]; if (v && typeof v === 'object' && !Array.isArray(v)) { const r = find(v, [...path, k]); if (r) return r; } } return null; };
    const path = find(bad, [])!;
    let o = bad; for (const k of path.slice(0, -1)) o = o[k];
    const was = o[path.at(-1)!];
    o[path.at(-1)!] = 7;
    try {
      const p = s.applyHouseRules({ advanced: { COMBAT: bad } });
      let r: any = (await import('../rules/index.ts') as any).RULES.COMBAT; for (const k of path) r = r?.[k];
      assert.ok(p.length > 0, `accepted: RULES.COMBAT.${path.join('.')} = ${JSON.stringify(r)} (default ${JSON.stringify(was)})`);
    } finally { s.applyHouseRules({}); }
  });
});

test('lead (V3 #2): only the mixed tables take another kind, and only their own words', async () => {
  g.foundry ??= {}; g.foundry.applications ??= { api: { ApplicationV2: class {} } };
  const s = await import('../settings.ts');
  const D: any = s.RULE_DEFAULTS;
  try {
    assert.deepEqual(s.applyHouseRules({ advanced: { 'COMBAT.reloadFeed': { ...D.COMBAT.reloadFeed, clip: 10, cylinder: 'all' } } }), []);
    assert.ok(s.applyHouseRules({ advanced: { 'COMBAT.reloadFeed': { ...D.COMBAT.reloadFeed, clip: 'lots' } } }).length > 0, 'clip: "lots"');
    assert.ok(s.applyHouseRules({ advanced: { 'COMBAT.melee': { ...D.COMBAT.melee, reachTnPerPoint: 'none' } } }).length > 0, 'reachTnPerPoint: "none"');
    assert.ok(s.applyHouseRules({ advanced: { 'COMBAT.melee': { ...D.COMBAT.melee, tie: 7 } } }).length > 0, 'tie: 7');
    assert.deepEqual(s.applyHouseRules({}, 'urr'), [], 'the Revamp patch still passes');
  } finally { s.applyHouseRules({}); }
});
