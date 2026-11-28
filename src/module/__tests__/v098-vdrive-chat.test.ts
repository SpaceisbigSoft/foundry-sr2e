/**
 * v0.98.0 review fixes, vehicles (fix98.md "vdrive"): the chat-card steps in applications/chat.ts with the stubs of
 * v0971-c.test.ts: a Crash Test card's TN modifier from 0 (C5 / P1: a 0 was raised to +2), the Crash Test pool carried
 * to the passengers bounded by a controller on the vehicle's side only (S8).
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const EN = ((globalThis as any).__SR2E_EN__ ??= {});
for (const f of ['vdrive98.json', 'vdrive98-fix.json']) {
  const draft = join('i18n-drafts', f);
  if (existsSync(draft)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(draft, 'utf8')))) if (!Object.hasOwn(EN, k)) EN[k] = v;
}

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
const render = (msg: any, root: El) => { for (const f of hooks['renderChatMessageHTML'] ?? []) f(msg, root); };
const press = (msg: any, action: string) => { const root = new El(); const b = new El('button'); b.dataset['sr2eAction'] = action; root.appendChild(b); render(msg, root); b.click(); };

beforeEach(() => { warnings.length = 0; posted.length = 0; g.game.user = GM; });

/** A vehicle stub that records its Crash Test and crash calls. */
function car(owners: string[], ctl: any = null): any {
  const calls: any[] = [];
  const v = actor(`veh${Math.floor(Math.random() * 1e9)}`, owners, { type: 'vehicle', name: 'Van', system: { controllerUuid: ctl ? ctl.uuid : '', currentSpeed: 60 },
    controller: () => ctl, crashTestFor: async (o: any) => { calls.push(['test', o]); return { successes: 1 }; }, crash: async (speed: number, cp: number) => { calls.push(['crash', speed, cp]); } });
  v.calls = calls;
  return v;
}

describe('v0.98.0 review C5 / P1: a Crash Test card\'s TN modifier', () => {
  test('tn 0 rolls with no modifier (was +2); a tires card keeps its +n', async () => {
    await setup();
    const v = car(['p1']);
    press(message(GM, { crashTest: { vehicleUuid: v.uuid, tn: 0, why: 'x' } }), 'vehicleCrashTest');
    await tick(60);
    assert.deepEqual(v.calls[0], ['test', { tn: 0, why: 'x' }]);
    const w = car(['p1']);
    press(message(GM, { crashTest: { vehicleUuid: w.uuid, tn: 3, why: 'tires' } }), 'vehicleCrashTest');
    await tick(60);
    assert.deepEqual(w.calls[0], ['test', { tn: 3, why: 'tires' }]);
  });
});

describe('v0.98.0 review S8: the Crash Test pool carried to the passengers', () => {
  test('bounded by the controller only when on the vehicle\'s side; else 0', async () => {
    await setup();
    const npc = actor(`npc${Math.random()}`, [], { vehicleSkillRating: () => 5 });
    const v = car(['p1'], npc);
    press(message(GM, { crash: { vehicleUuid: v.uuid, speed: 60, cp98: 20 } }), 'vehicleCrash');
    await tick(60);
    assert.deepEqual(v.calls[0], ['crash', 60, 0]);
    const pc = actor(`pc${Math.random()}`, ['p1'], { vehicleSkillRating: () => 5 });
    const w = car(['p1'], pc);
    press(message(GM, { crash: { vehicleUuid: w.uuid, speed: 60, cp98: 20 } }), 'vehicleCrash');
    await tick(60);
    assert.deepEqual(w.calls[0], ['crash', 60, 5]);
  });
});
