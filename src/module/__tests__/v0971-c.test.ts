/**
 * v0.97.1 (Builder C): players' Matrix maneuver results applied by themselves (setting `autoApplyManeuvers97`, owner
 * 27 Nov 2026), the GM's confirm line for `mx97` requests in words (live-run finding 8), and no "Host: no change."
 * note after an applied Matrix request. Pure checks on rules/trust.ts and rules/automation941.ts; glue through
 * applications/chat.ts with the stubs of v081-r2app.test.ts.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeAutoApply, describeGmChange, mx97Line, maneuverOnly97, type CardTrust } from '../rules/trust.ts';
import { AUTOMATION_SETTINGS, AUTOMATION_DEFAULTS, MANUAL_SETTINGS, RULESET_PRESETS, effectiveSetting } from '../rules/automation941.ts';

// The new keys' English until the lead merges them into en.json (en.json wins once it has them).
const EN_C: Record<string, string> = {
  'SR2E.MxIc97.Trust.line': 'Matrix, {name}: {what}',
  'SR2E.MxIc97.Trust.parry': 'parry against {vs} (+{net} TN on its next attack)',
  'SR2E.MxIc97.Trust.unparry': 'take back the parry against {vs}',
  'SR2E.MxIc97.Trust.evade': 'evade {vs} (for {net} turns)',
  'SR2E.MxIc97.Trust.pos': 'won a position on {vs} (−{net} TN or +{net} Power on their next attack)',
  'SR2E.MxIc97.Trust.count': 'count the crash of {vs} on the security tally',
  'SR2E.MxIc97.Trust.countAny': 'count the crash on the security tally',
  'SR2E.MxIc97.Trust.suppress': 'suppress {vs} (Detection Factor −1 while they stay in this system)',
  'SR2E.MxIc97.Trust.release': 'release the suppressed {vs} (its points go on the security tally)',
  'SR2E.MxIc97.Trust.bomb': '{vs} goes off against them',
  'SR2E.MxIc97.Trust.bombInFile': 'the data bomb on {file}',
  'SR2E.MxIc97.Trust.aDataBomb': 'a data bomb',
  'SR2E.MxIc97.Trust.anIcon': 'an icon that is gone',
  'SR2E.MxIc97.Trust.someone': 'an unknown decker',
  'SR2E.MxIc97.Gm.autoApplied': "{by}'s card applied by itself: {line}",
};
const EN = ((globalThis as any).__SR2E_EN__ ??= {});
for (const [k, v] of Object.entries(EN_C)) if (!Object.hasOwn(EN, k)) EN[k] = v;

let settingsNow: Record<string, unknown> = {};
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
g.game = { user: GM, users, settings: { get: (_s: string, k: string) => settingsNow[k] ?? false }, messages: { contents: [] }, actors: [], scenes: [] };

/** A stub actor owned by `owners` (user ids). */
function actor(id: string, owners: string[], extra: any = {}): any {
  const a = { id, uuid: `Actor.${id}`, name: extra.name ?? id, type: extra.type ?? 'character', ownership: Object.fromEntries(owners.map((o) => [o, 3])), system: extra.system ?? {}, isOwner: true,
    testUserPermission: (u: any, lvl: string) => lvl === 'OWNER' && (u.isGM || owners.includes(u.id)), items: { get: () => null }, getFlag: () => undefined, ...extra };
  docs.set(a.uuid, a);
  return a;
}
/** A stub chat message by `author` with sr2e flags. */
function message(author: any, flags: Record<string, any>, extra: any = {}): any {
  return { id: extra.id ?? `m${Math.random()}`, author, content: extra.content ?? '', speaker: extra.speaker ?? {}, flags: { shadowrun2e_unified: flags }, isOwner: true,
    getFlag: (_s: string, k: string) => flags[k], setFlag: async (_s: string, k: string, v: any) => { flags[k] = v; }, ...extra };
}

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
let chat: any;
const setup = async () => { if (chat) return chat; chat = await import('../applications/chat.ts'); chat.registerChatHandlers(); return chat; };
const arrive = (msg: any) => { for (const f of hooks['createChatMessage'] ?? []) f(msg); };
const render = (msg: any, root: El) => { for (const f of hooks['renderChatMessageHTML'] ?? []) f(msg, root); };
const press = (msg: any, action: string) => { const root = new El(); const b = new El('button'); b.dataset['sr2eAction'] = action; root.appendChild(b); render(msg, root); b.click(); };

const MINE = 'Actor.deckC';
const t = (on: boolean, owns: string[] = [MINE]): CardTrust => ({ authorIsGm: false, owns: (u) => owns.includes(u), maneuvers97: on });
const hc = (mx97: any, extra: any = {}) => ({ hostChange: { hostUuid: 'Actor.hostC', mx97, sourceUuid: MINE, ...extra } });
const names: Record<string, string> = { [MINE]: 'ZZ Decker', 'Actor.icC': 'Killer-6', 'Actor.hostC': 'ZZ Host' };
const nameOf = (u: string) => names[u] ?? '';

describe('v0.97.1 C: maneuver results by themselves (pure)', () => {
  test('a maneuver-only change applies by itself only with the setting on and the decker owned', () => {
    const parry = hc({ op: 'parry', deckerUuid: MINE, vs: 'Actor.icC', id: 'p1', net: 3 });
    assert.equal(safeAutoApply('applyHost', parry, t(false)), false, 'setting off: as before');
    assert.equal(safeAutoApply('applyHost', parry, t(true)), true);
    assert.equal(safeAutoApply('applyHost', parry, t(true, [])), false, 'not the author\'s decker');
    for (const op of ['evade', 'unevade', 'unparry', 'exposed', 'unexposed']) {
      assert.equal(safeAutoApply('applyHost', hc({ op, deckerUuid: MINE, vs: 'Actor.icC', id: 'x', net: 2 }), t(true)), true, op);
    }
    assert.equal(maneuverOnly97({ hostUuid: 'H', mx97: { op: 'parry', deckerUuid: MINE, vs: 'V', id: 'p' } }, (u) => u === MINE), true, 'no source key: fine');
  });
  test('everything else in a host change still waits for the GM', () => {
    for (const op of ['count', 'suppress', 'release', 'bomb']) assert.equal(safeAutoApply('applyHost', hc({ op, deckerUuid: MINE, id: 'f:f1', cardId: 'c1' }), t(true)), false, op);
    const p = { op: 'parry', deckerUuid: MINE, vs: 'Actor.icC', id: 'p1', net: 3 };
    assert.equal(safeAutoApply('applyHost', hc(p, { minAlert: 'passive' }), t(true)), false, 'another key beside it');
    assert.equal(safeAutoApply('applyHost', hc(p, { decrypt: 'f1' }), t(true)), false);
    assert.equal(safeAutoApply('applyHost', hc(p, { sourceUuid: 'Actor.other' }), t(true, [MINE, 'Actor.other'])), false, 'source is not the decker');
    assert.equal(safeAutoApply('applyHost', hc({ ...p, net: 31 }), t(true)), false, 'net over 30');
    assert.equal(safeAutoApply('applyHost', hc({ ...p, extra: 1 }), t(true)), false, 'shape');
    assert.equal(safeAutoApply('applyHost', { hostChange: { hostUuid: 'Actor.hostC', minAlert: 'passive', sourceUuid: MINE } }, t(true)), false);
    assert.equal(safeAutoApply('applyHost', { hostChange: { hostUuid: 'Actor.hostC', sourceUuid: MINE } }, t(true)), false, 'no request at all');
  });
  test('trust.ts never reads Foundry settings', () => {
    const src = readFileSync(new URL('../rules/trust.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /game\.settings/);
  });
  test('the setting sits with autoApplyGm: off by default, off under Manual table and in the presets', () => {
    assert.ok(AUTOMATION_SETTINGS.some((s) => s.key === 'autoApplyManeuvers97' && s.group === 'combat'));
    assert.equal(AUTOMATION_DEFAULTS['autoApplyManeuvers97'], false);
    assert.ok(Object.hasOwn(MANUAL_SETTINGS, 'autoApplyManeuvers97'));
    assert.equal(effectiveSetting('autoApplyManeuvers97', true, true), false);
    for (const p of RULESET_PRESETS) if ('autoApplyGm' in p.settings) assert.equal(p.settings['autoApplyManeuvers97'], p.settings['autoApplyGm'], p.id);
    const reg = readFileSync(new URL('../settings.ts', import.meta.url), 'utf8');
    assert.match(reg, /register\(SYSTEM\.id, "autoApplyManeuvers97", \{[^}]*scope: "world", config: true, type: Boolean, default: false/);
  });
});

describe('v0.97.1 C: the confirm line for Matrix requests (finding 8)', () => {
  test('names, not uuids; the op in words; the net only where it means something', () => {
    const parry = describeGmChange('applyHost', hc({ op: 'parry', deckerUuid: MINE, vs: 'Actor.icC', id: 'p1', net: 3 }), nameOf).join(' | ');
    assert.match(parry, /ZZ Decker: parry against Killer-6 \(\+3 TN/);
    const count = describeGmChange('applyHost', hc({ op: 'count', deckerUuid: MINE, cardId: 'c1' }), nameOf).join(' | ');
    assert.match(count, /ZZ Decker: count the crash on the security tally/);
    assert.doesNotMatch(count, /\(0\)|against/);
    const told = describeGmChange('applyHost', hc({ op: 'count', deckerUuid: MINE, cardId: 'c1' }), nameOf, (m) => (m.cardId === 'c1' ? 'Killer-6' : '')).join(' | ');
    assert.match(told, /count the crash of Killer-6/);
    const rel = mx97Line({ op: 'release', deckerUuid: MINE, id: 'Actor.1R9qnp4tNLR8pGet' }, nameOf);
    assert.doesNotMatch(rel, /Actor\./, rel);
    assert.match(rel, /release the suppressed an icon that is gone/);
    assert.match(mx97Line({ op: 'release', deckerUuid: MINE, id: 'bomb:Actor.hostC|f:f1' }, nameOf), /release the suppressed a data bomb/);
    assert.match(mx97Line({ op: 'bomb', deckerUuid: MINE, id: 'f:f1' }, nameOf), /a data bomb goes off/);
    assert.match(mx97Line({ op: 'bomb', deckerUuid: MINE, id: 'f:f1' }, nameOf, () => 'the data bomb on ZZ Bombed'), /the data bomb on ZZ Bombed goes off/);
    assert.match(mx97Line({ op: 'parry', deckerUuid: 'Actor.gone', vs: 'Actor.gone2', net: 2 }, nameOf), /an unknown decker: parry against an icon that is gone/);
    assert.match(mx97Line({ op: 'pos', deckerUuid: MINE, vs: 'Actor.icC', net: 2 }, nameOf), /won a position on Killer-6/);
  });
});

describe('v0.97.1 C: the GM side (chat.ts)', () => {
  let applied: any[] = [];
  let noteOut = '';
  beforeEach(() => {
    applied = []; posted.length = 0; confirms.length = 0; warnings.length = 0; confirmAnswer = true;
    actor('deckC', ['p1'], { name: 'ZZ Decker' });
    actor('icC', [], { name: 'Killer-6', type: 'ic' });
    actor('hostC', [], { name: 'ZZ Host', type: 'host' });
    noteOut = '<p>ZZ Host: ZZ Decker\'s parry +3 recorded.</p>';
    g.CONFIG.Actor.documentClass = { applyHostChange: async (u: string, c: any) => { applied.push({ u, c }); return noteOut; } };
    g.game.user = GM;
  });
  const parryCard = (extra: any = {}) => message(P1, { ...hc({ op: 'parry', deckerUuid: MINE, vs: 'Actor.icC', id: 'p1', net: 3 }) }, { content: '<button data-sr2e-action="applyHost"></button>', ...extra });

  test('setting on: a parry card applies by itself, with one short GM line', async () => {
    await setup();
    settingsNow = { autoApplyManeuvers97: true };
    const msg = parryCard();
    arrive(msg);
    await tick(80);
    assert.equal(applied.length, 1);
    assert.equal(applied[0].c.mx97.op, 'parry');
    assert.equal(msg.flags.shadowrun2e_unified.hostApplied, true);
    assert.equal(confirms.length, 0, 'no confirm');
    assert.equal(posted.length, 1, posted.map((p) => p.content).join(' || '));
    assert.match(posted[0].content, /Player One's card applied by itself: Matrix, ZZ Decker: parry against Killer-6/);
    assert.match(posted[0].content, /parry \+3 recorded/);
    assert.deepEqual(posted[0].whisper, ['gm']);
  });
  test('setting off, a count, or another pending action: nothing by itself', async () => {
    await setup();
    settingsNow = {};
    arrive(parryCard());
    await tick(50);
    settingsNow = { autoApplyManeuvers97: true };
    arrive(message(P1, { ...hc({ op: 'count', deckerUuid: MINE, cardId: 'c1' }) }, { content: '<button data-sr2e-action="applyHost"></button>' }));
    await tick(50);
    arrive(parryCard({ content: '<button data-sr2e-action="applyHost"></button><button data-sr2e-action="applyTally"></button>' }));
    await tick(50);
    arrive(message(P2, { ...hc({ op: 'parry', deckerUuid: MINE, vs: 'Actor.icC', id: 'p1', net: 3 }) }, { content: '<button data-sr2e-action="applyHost"></button>' }));
    await tick(50);
    assert.deepEqual(applied, []);
  });
  test('a clicked Matrix request whose host note says only "no change" posts no note; other changes still do', async () => {
    await setup();
    settingsNow = {};
    noteOut = '<p>ZZ Host: no change.</p>';
    const msg = message(P1, { ...hc({ op: 'count', deckerUuid: MINE, cardId: 'c1' }) }, { content: '<button data-sr2e-action="applyHost"></button>' });
    press(msg, 'applyHost');
    await tick(80);
    assert.equal(applied.length, 1);
    assert.equal(confirms.length, 1);
    assert.match(JSON.stringify(confirms[0]), /count the crash on the security tally/);
    assert.equal(posted.filter((p) => /no change/.test(String(p.content))).length, 0, posted.map((p) => p.content).join(' || '));
    const other = message(P1, { hostChange: { hostUuid: 'Actor.hostC', decrypt: 'f1', sourceUuid: MINE } }, { content: '<button data-sr2e-action="applyHost"></button>' });
    press(other, 'applyHost');
    await tick(80);
    assert.equal(posted.filter((p) => /no change/.test(String(p.content))).length, 1, 'a plain host change keeps its note');
  });
});
