/**
 * v0.81.1 fix round, fixer FX-APP: the second-pass findings in the application files (chat.ts, trust.ts, richtext.ts,
 * inline.ts, look.ts, tah.ts, catalogue.ts, socket.ts, groups.ts / ui.ts, approvals.ts, undo.ts, settings.ts,
 * migrations.ts) and rules/trust.ts. The Foundry stubs are v081-r2app's; each test uses the reviewer's failing input
 * (RV/try-SEC1 Y1-Y5, RV/try-A A1-A5, RV/try-D2 P1-P2, RV/try-RB Q1-Q9, RV/try-SEC2) inverted, and failed before its fix.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeAutoApply, gmApplyShapeOk, describeGmChange, powerEffectShapeOk, undoFieldsToKeep, MAX_UNDO_FIELD, type CardTrust } from '../rules/trust.ts';


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

const ownsOnly = (...uuids: string[]): CardTrust => ({ authorIsGm: false, owns: (u) => uuids.includes(u) });



const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
let chat: any;
const setup = async () => { if (chat) return chat; chat = await import('../applications/chat.ts'); chat.registerChatHandlers(); return chat; };
const render = (msg: any, root: El) => { for (const f of hooks['renderChatMessageHTML'] ?? []) f(msg, root); };
const press = (msg: any, action: string, data: Record<string, string> = {}) => { const root = new El(); const b = new El('button'); b.dataset['sr2eAction'] = action; Object.assign(b.dataset, data); root.appendChild(b); render(msg, root); b.click(); };
void prompts; void ownsOnly;
const SRC = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** Back to the GM, answering yes, with no dialogs recorded (the start of a test). */
const resetUser = () => { g.game.user = GM; confirmAnswer = true; confirms.length = 0; };
/** Back to the GM, answering yes (the end of a test: the dialogs it recorded stay for its asserts). */
const restore = () => { g.game.user = GM; confirmAnswer = true; };

// ---------------------------------------------------------------- design 1: a GM re-resolves a player's card as its author

describe('design 1 (SEC1-1 critical, D1-1): a GM re-running a player\'s card acts as the card\'s author', () => {
  test('Change target number on P1\'s card runs SR2Actor.retarget as P1 (and a GM card as before)', async () => {
    const c = await setup();
    const { SR2Actor } = await import('../documents/index.ts');
    const S: any = SR2Actor;
    const seen: any[] = [];
    const orig = S.retarget;
    S.retarget = async () => { seen.push(S.actingAuthor); return null; };
    actor('rt1', ['p1'], { sceneCandidates: () => [] });
    const origPrompt = g.foundry.applications.api.DialogV2.prompt;
    g.foundry.applications.api.DialogV2.prompt = async () => ({ side: 0, baseTargetNumber: 5, modifiers: [] });
    try {
      resetUser();
      const snap = { actorUuid: 'Actor.rt1', kind: 'soak', label: 'Soak', baseTargetNumber: 4, targetNumber: 4, modifiers: [], dice: [], testId: 'tRT1' };
      await c.openRetarget(message(P1, { test: snap }));
      await c.openRetarget(message(GM, { test: { ...snap, testId: 'tRT2' } }));
    } finally { S.retarget = orig; g.foundry.applications.api.DialogV2.prompt = origPrompt; }
    assert.equal(seen.length, 2);
    assert.equal(seen[0]?.id, 'p1', 'as P1');
    assert.equal(seen[1], null, 'a GM card runs with the GM\'s own rights');
    assert.equal(S.actingAuthor, null, 'restored afterwards');
  });

  test('a GM\'s Karma re-roll, Avoid disaster and Buy success on P1\'s card run as P1', async () => {
    await setup();
    const { SR2Actor } = await import('../documents/index.ts');
    const S: any = SR2Actor;
    const seen: string[] = [];
    actor('k1', ['p1'], { system: { karma: { poolSpent: 0, pool: 5 } },
      karmaReroll: async () => { seen.push(`reroll:${S.actingAuthor?.id}`); }, avoidDisaster: async () => { seen.push(`avoid:${S.actingAuthor?.id}`); },
      buySuccess: async () => { seen.push(`buy:${S.actingAuthor?.id}`); return true; } });
    resetUser();
    const snap = { actorUuid: 'Actor.k1', kind: 'skill', dice: [{ total: 1, success: false }], botch: true };
    press(message(P1, { test: { ...snap, testId: 'tK1' } }), 'karmaReroll'); await tick();
    press(message(P1, { test: { ...snap, testId: 'tK2' } }), 'avoidDisaster'); await tick();
    press(message(P1, { test: { ...snap, testId: 'tK3' } }), 'buySuccess'); await tick();
    assert.deepEqual(seen, ['reroll:p1', 'avoid:p1', 'buy:p1']);
  });

  test('without SR2Actor.runAsAuthor the GM re-resolve of a player\'s card is refused (the guard)', async () => {
    const c = await setup();
    const { SR2Actor } = await import('../documents/index.ts');
    const saved = Object.getOwnPropertyDescriptor(SR2Actor, 'runAsAuthor')!;
    Object.defineProperty(SR2Actor, 'runAsAuthor', { value: undefined, configurable: true, writable: true });
    let ran = 0;
    try {
      resetUser(); warnings.length = 0;
      assert.equal(await c.asCardAuthor(message(P1, {}), 'Test', async () => { ran++; return 1; }), null);
      assert.equal(await c.asCardAuthor(message(GM, {}), 'Test', async () => { ran++; return 2; }), 2, 'a GM card still runs');
      g.game.user = P1;
      assert.equal(await c.asCardAuthor(message(P1, {}), 'Test', async () => { ran++; return 3; }), 3, 'a player\'s own click still runs');
    } finally { Object.defineProperty(SR2Actor, 'runAsAuthor', saved); restore(); }
    assert.equal(ran, 2);
    assert.match(warnings.at(-1) ?? '', /posted by a player/);
  });

  test('Use again, Send ritual, Offer to grimoire and a blast set off are wrapped too (source check)', () => {
    const s = SRC('applications/chat.ts');
    // v0.89.3: the names are translations now (SR2E.Card.Chat.*): look each English text's key up in en.json.
    const lang = JSON.parse(readFileSync(new URL('../../../public/lang/en.json', import.meta.url), 'utf8'));
    const chat = lang.SR2E.Card.Chat as Record<string, unknown>;
    for (const what of ['Use again', 'Send ritual', 'Offer to a grimoire', 'Detonate', 'It goes off', 'Scatter', 'Change target number', 'Karma re-roll', 'Buy a success', 'Avoid disaster']) {
      const keys = Object.keys(chat).filter((k) => chat[k] === what);
      assert.ok(keys.length, `no SR2E.Card.Chat key reads "${what}"`);
      assert.ok(keys.some((k) => new RegExp(`asCardAuthor\\(message, tx\\('SR2E\\.Card\\.Chat\\.${k}'\\)`).test(s)), what);
    }
  });
});

// ---------------------------------------------------------------- design 2: the routine rule

describe('design 2 (SEC1-3, A-1, D1-8, D3-8, RB2-1): the routine rule trusts only real source fields', () => {
  test('Y1 inverted: deck, cyberware, disease, overload and adrenal cards from P1 (speaker = own char) all ask P2', async () => {
    await setup();
    actor('ownY1', ['p1']);
    const hits: string[] = [];
    actor('deckerY1', ['p2'], { takeDeckDamage: async () => { hits.push('deck'); }, cyberDamageCheck: async () => { hits.push('cyber'); }, resistPsychotropic: async () => { hits.push('psyche'); },
      rollDiseaseTick: async () => { hits.push('disease'); }, rollOverload: async () => { hits.push('overload'); }, rollAdrenalCrash: async () => { hits.push('adrenal'); }, system: { diseases: [{ name: 'VITAS', pending: true }] } });
    g.game.user = P2; confirms.length = 0; confirmAnswer = false;
    const sp = { speaker: { actor: 'ownY1' } };
    press(message(P1, { deckDamage: { deckerUuid: 'Actor.deckerY1', icName: 'Blaster', rating: 20, reason: 'x' } }, sp), 'deckDamage'); await tick();
    press(message(P1, { cyberDamage: { actorUuid: 'Actor.deckerY1', location: 'head' } }, sp), 'cyberDamage'); await tick();
    press(message(P1, { diseaseTick: { actorUuid: 'Actor.deckerY1', index: 0, name: 'VITAS' } }, sp), 'diseaseTick'); await tick();
    press(message(P1, { overload: { deckerUuid: 'Actor.deckerY1', tn: 30 } }, sp), 'overload'); await tick();
    press(message(P1, { adrenalCrash: { actorUuid: 'Actor.deckerY1', rating: 10 } }, sp), 'adrenalCrash'); await tick();
    restore();
    assert.deepEqual(hits, []);
    assert.equal(confirms.length, 5);
  });

  test('a Defend from P1\'s attack card (its attacker is P1\'s) still goes ahead on P2\'s client with no confirm', async () => {
    await setup();
    actor('atkD', ['p1']);
    let defended = 0;
    actor('defD', ['p2'], { system: { derived: { combatPoolLeft: 0 } }, defend: async () => { defended++; }, poolFor: () => 'combat' });
    g.game.user = P2; confirms.length = 0;
    press(message(P1, { attack: { targetUuid: 'Actor.defD', attackerUuid: 'Actor.atkD', weaponName: 'Ares', power: 9, level: 'M', damageType: 'physical', attackSuccesses: 3, astral: true } }, { speaker: { actor: 'ownY1' } }), 'defend'); await tick();
    restore();
    assert.equal(defended, 1);
    assert.equal(confirms.length, 0);
  });

  test('a routine test whose only "source" is the speaker asks (Defend naming someone else\'s attacker)', async () => {
    await setup();
    actor('own2', ['p1']); actor('notMine', ['p2']);
    let defended = 0;
    actor('defD2', ['p2'], { system: { derived: { combatPoolLeft: 0 } }, defend: async () => { defended++; }, poolFor: () => 'combat' });
    g.game.user = P2; confirms.length = 0; confirmAnswer = false;
    press(message(P1, { attack: { targetUuid: 'Actor.defD2', attackerUuid: 'Actor.notMine', weaponName: 'X', power: 9, level: 'M', astral: true } }, { speaker: { actor: 'own2' } }), 'defend'); await tick();
    restore();
    assert.equal(defended, 0);
    assert.equal(confirms.length, 1);
  });

  test('D2 P1 / RB2-1 inverted: a forged disease on a toxins card asks, and its recoveries and interval are bounded', async () => {
    await setup();
    actor('p1char', ['p1']);
    const got: any[] = [];
    actor('p2char', ['p2'], { resistToxin: async (t: any) => { got.push(t); } });
    const card = () => message(P1, { test: { actorUuid: 'Actor.p1char' }, toxins: [{ targetUuid: 'Actor.p2char', kind: 'disease', name: 'Forged plague', power: 6, level: 'S', damageType: 'physical', vector: 'contact', recoveries: 1e9, intervalHours: 0, incubationHours: 0, contagious: 'airborne' }] }, { speaker: { actor: 'p1char' } });
    g.game.user = P2; confirms.length = 0; confirmAnswer = false;
    press(card(), 'resistToxin', { index: '0' }); await tick(50);
    assert.equal(got.length, 0, 'declined: nothing rolled');
    assert.equal(confirms.length, 1, 'a disease confirms even from the author\'s own character');
    confirmAnswer = true;
    press(card(), 'resistToxin', { index: '0' }); await tick(50);
    restore();
    assert.equal(got.length, 1);
    assert.ok(got[0].recoveries <= 30 && got[0].intervalHours >= 1, JSON.stringify(got[0]));
  });

  test('A5 inverted: the whip check reaches rollWhipCheck bounded (Power, level, text)', async () => {
    await setup();
    actor('ownA5', ['p1']);
    const got: any[] = [];
    actor('vicA5', ['p2'], { rollWhipCheck: async (w: any) => { got.push(w); } });
    g.game.user = P2;
    press(message(P1, { whipCheck: { attackerUuid: 'Actor.vicA5', skill: 'Whips', power: '<img src=x>999', level: 'Q', damageType: 'physical', weaponName: 'W' } }, { speaker: { actor: 'ownA5' } }), 'whipCheck'); await tick();
    restore();
    assert.equal(got.length, 1);
    assert.equal(got[0].power, 0);
    assert.equal(got[0].level, 'L');
  });

  test('every { routine } site in chat.ts is on ROUTINE_ACTIONS (source scan)', async () => {
    const { ROUTINE_ACTIONS } = await import('../applications/trust.ts');
    const s = SRC('applications/chat.ts');
    const handlers = new Map<string, string>();
    for (const m of s.matchAll(/async function (on\w+)\(([\s\S]*?)\n}\n/g)) handlers.set(m[1]!, m[2]!);
    const routine = [...handlers].filter(([, body]) => /routine:/.test(body)).map(([n]) => n);
    const allowed = new Set(ROUTINE_ACTIONS.map((a: string) => `on${a.charAt(0).toUpperCase()}${a.slice(1)}`));
    assert.ok(routine.length >= 9, `the scan found ${routine.join(', ')}`);
    for (const n of routine) assert.ok(allowed.has(n), `${n} is routine but not on ROUTINE_ACTIONS`);
    for (const a of ['cyberDamage', 'deckDamage', 'psychotropic', 'overload', 'diseaseTick', 'morale', 'vehicleCrash', 'riggerShock', 'fireBurn']) assert.ok(!ROUTINE_ACTIONS.includes(a), a);
    assert.equal(/routine: true/.test(s), false, 'no boolean routine left (the speaker came in through origin())');
  });
});

// ---------------------------------------------------------------- prompts (SEC1-4) and the prompt guard (A-5)

describe('prompts: one per target, capped, and through the click guard', () => {
  test('Y2 inverted: 150 attacks and damages on one NPC from a card whose attacker P1 doesn\'t own ask the GM nothing', async () => {
    await setup();
    actor('npcY2', ['gm-only'], { type: 'npc' });
    resetUser(); confirmAnswer = false;
    const attacks = Array.from({ length: 150 }, () => ({ targetUuid: 'Actor.npcY2', attackerUuid: 'x', weaponName: 'Pea shooter' }));
    const damages = Array.from({ length: 150 }, () => ({ targetUuid: 'Actor.npcY2', power: 1, level: 'L' }));
    const msg = message(P1, { attacks, damages }, { content: '<button data-sr2e-action="defend"></button><button data-sr2e-action="resist"></button>' });
    for (const f of hooks['createChatMessage'] ?? []) f(msg);
    await tick(500);
    restore();
    assert.equal(confirms.length, 0);
  });

  test('one prompt per target; a GM card is capped at MAX_CARD_PROMPTS; a player card past it prompts none', async () => {
    const c = await setup();
    actor('atkP', ['p1']);
    for (let i = 0; i < 20; i++) actor(`npcP${i}`, [], { type: 'npc' });
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ targetUuid: `Actor.npcP${i}`, attackerUuid: 'Actor.atkP', weaponName: 'W' }));
    const twice = [...many(3), ...many(3)];
    assert.equal(c.promptEntries(message(P1, { attacks: twice }, { content: 'data-sr2e-action="defend"' })).length, 3);
    assert.equal(c.promptEntries(message(GM, { attacks: many(20) }, { content: 'data-sr2e-action="defend"' })).length, c.MAX_CARD_PROMPTS);
    // Round 2 (E): past the cap the first MAX_CARD_PROMPTS still prompt; the rest are named in `more`.
    const plan = c.promptPlan(message(P1, { attacks: many(c.MAX_CARD_PROMPTS + 1) }, { content: 'data-sr2e-action="defend"' }));
    assert.equal(plan.entries.length, c.MAX_CARD_PROMPTS);
    assert.equal(plan.more.length, 1);
    assert.equal(c.promptEntries(message(P1, { attacks: many(5) }, { content: 'data-sr2e-action="defend"' })).length, 5);
  });

  test('A4 inverted: the Resist prompt and a click on the same entry resist once', async () => {
    await setup();
    let resisted = 0;
    (P2 as any).active = true;
    actor('vicA4', ['p2'], { system: { derived: { combatPoolLeft: 0 } }, resistFromState: async () => { resisted++; await tick(60); } });
    g.game.user = P2;
    const origConfirm = g.foundry.applications.api.DialogV2.confirm;
    g.foundry.applications.api.DialogV2.confirm = async () => { await tick(40); return true; };
    const msg = message(P2, { damage: { targetUuid: 'Actor.vicA4', power: 6, level: 'M', damageType: 'physical' } }, { content: '<button data-sr2e-action="resist"></button>', id: 'mA4' });
    try {
      for (const f of hooks['createChatMessage'] ?? []) f(msg);
      await tick(310);
      press(msg, 'resist');
      await tick(250);
    } finally { g.foundry.applications.api.DialogV2.confirm = origConfirm; (P2 as any).active = false; restore(); }
    assert.equal(resisted, 1);
  });
});

// ---------------------------------------------------------------- auto-resist (SEC1-11, A-6) and auto-apply (design 3)

describe('auto-resist and auto-apply', () => {
  test('Y4 inverted: a player\'s spell on a GM NPC is resisted by itself again (its caster is the author\'s)', async () => {
    await setup();
    let resisted = 0;
    actor('casterY4', ['p1']);
    actor('npcY4', [], { type: 'npc', resistSpell: async () => { resisted++; } });
    resetUser(); confirmAnswer = false;
    const msg = message(P1, { test: { actorUuid: 'Actor.casterY4' }, spells: [{ targetUuid: 'Actor.npcY4', casterUuid: 'Actor.casterY4', spellName: 'Manabolt', force: 4, level: 'S' }] }, { speaker: { actor: 'casterY4' }, content: '<button data-sr2e-action="resistSpell" data-index="0"></button>' });
    for (const f of hooks['createChatMessage'] ?? []) f(msg);
    await tick(400);
    restore();
    assert.equal(resisted, 1);
    assert.equal(confirms.length, 0);
  });

  test('a spell card whose caster isn\'t the author\'s still waits', async () => {
    await setup();
    let resisted = 0;
    actor('otherCaster', ['p2']);
    actor('npcY4b', [], { type: 'npc', resistSpell: async () => { resisted++; } });
    resetUser(); confirmAnswer = false;
    const msg = message(P1, { spells: [{ targetUuid: 'Actor.npcY4b', casterUuid: 'Actor.otherCaster', spellName: 'Manabolt', force: 4 }] }, { content: '<button data-sr2e-action="resistSpell" data-index="0"></button>' });
    for (const f of hooks['createChatMessage'] ?? []) f(msg);
    await tick(400);
    restore();
    assert.equal(resisted, 0);
  });

  test('Y3 inverted: with autoApplyGm on, the speaker vouches for nothing (tally, cleanse, a GM drone\'s lock)', async () => {
    await setup();
    actor('ownY3', ['p1']);
    const calls: string[] = [];
    g.CONFIG.Actor.documentClass = {
      applyTallyCard: async () => { calls.push('tally'); return '<p>t</p>'; },
      applyCleansing: async () => { calls.push('cleanse'); return true; },
      applySensorLock: async () => { calls.push('lock'); return true; },
    };
    resetUser();
    const sp = { speaker: { actor: 'ownY3' } };
    for (const [flags, btn] of [
      [{ tally: { hostUuid: 'Actor.gmHost', successes: 30 } }, 'applyTally'],
      [{ cleanse: { sceneId: 'scene1', points: 20 } }, 'applyCleanse'],
      [{ sensorLocks: { vehicleUuid: 'Actor.gmDrone', targetUuid: 'Actor.p2char', targetName: 'x', successes: 30 } }, 'applyLocks'],
    ] as const) {
      const msg = message(P1, { ...flags }, { ...sp, content: `<button data-sr2e-action="${btn}"></button>` });
      for (const f of hooks['createChatMessage'] ?? []) f(msg);
      await tick(50);
    }
    assert.deepEqual(calls, []);
  });

  test('RB2-2 / SEC1-6 (Q1, Q2): no shutdown, active alert, cleanse, drone link, foreign lock or foreign tally by itself', () => {
    const MINE = 'Actor.mine';
    const t: CardTrust = { authorIsGm: false, owns: (u) => u === MINE };
    assert.equal(safeAutoApply('applyHost', { hostChange: { hostUuid: 'Actor.corpHost', minAlert: 'shutdown', sourceUuid: MINE } }, t), false);
    assert.equal(safeAutoApply('applyHost', { hostChange: { hostUuid: 'Actor.corpHost', minAlert: 'active', sourceUuid: MINE } }, t), false);
    assert.equal(safeAutoApply('applyHost', { hostChange: { hostUuid: 'Actor.corpHost', minAlert: 'passive', sourceUuid: MINE } }, t), false, 'round 2 (B): no host change by itself');
    assert.equal(safeAutoApply('applyCleanse', { cleanse: { sceneId: 'anyScene', points: 20, sourceUuid: MINE } }, t), false);
    assert.equal(safeAutoApply('applyTally', { tally: { hostUuid: 'Actor.h', successes: 30, key: 'Actor.otherDecker', name: 'x', sourceUuid: MINE } }, t), false);
    assert.equal(safeAutoApply('applyTally', { tally: { hostUuid: 'Actor.h', successes: 3, key: MINE, sourceUuid: MINE } }, t), false, 'round 2 (B): no tally by itself');
    assert.equal(safeAutoApply('applySite', { siteChange: { siteUuid: 'Actor.s', add: 30, minAlert: 'active', sourceUuid: MINE } }, t), false);
    assert.equal(safeAutoApply('applyLocks', { sensorLocks: { vehicleUuid: 'Actor.gmVehicle', targetUuid: 'Actor.anyone', successes: 30, sourceUuid: MINE } }, t), false);
    assert.equal(safeAutoApply('applyLocks', { sensorLocks: { vehicleUuid: MINE, targetUuid: 'Actor.anyone', successes: 3, sourceUuid: MINE } }, t), true);
    assert.equal(safeAutoApply('applyDroneLink', { droneLink: { droneUuid: 'Actor.d', kind: 'intercept', byUuid: MINE, by: 'x' } }, t), false);
    // A3 / Q8: the test's roller is no source either.
    assert.equal(safeAutoApply('applyTally', { tally: { hostUuid: 'Actor.h', successes: 3 }, test: { actorUuid: MINE } }, t), false);
  });
});

// ---------------------------------------------------------------- design 5: test ids bound to their author (SEC1-2)

describe('design 5 (SEC1-2): a card reusing another\'s testId', () => {
  test('Y5 inverted: a forged card with the GM\'s testId neither replaces the GM\'s card nor marks its target defended', async () => {
    const c = await setup();
    actor('pcY5', ['p2']);
    const gmMsg = message(GM, { test: { testId: 'tGM1', actorUuid: 'Actor.npc' }, attack: { targetUuid: 'Actor.pcY5', attackerUuid: 'Actor.npc' } }, { id: 'gmY5' });
    const forgedMsg = message(P1, { test: { testId: 'tGM1', actorUuid: 'Actor.x' }, defended: [0], resisted: [0, 1, 2] }, { id: 'p1Y5' });
    g.game.messages = { contents: [gmMsg, forgedMsg] };
    try {
      assert.equal(c.cardReplaced(gmMsg), false);
      assert.deepEqual(c.defendedOn(gmMsg), []);
      assert.equal(c.cardReplaced(forgedMsg), false, 'the forged card isn\'t "older" either');
    } finally { g.game.messages = { contents: [] }; }
  });

  test('a Karma re-roll card by the same author (or a GM\'s) still replaces; a contest side\'s owner joins its contest', async () => {
    const c = await setup();
    actor('sideA', ['p1']); actor('sideB', ['p2']);
    const first = message(P1, { test: { testId: 't1', actorUuid: 'Actor.sideA' } }, { id: 'f1' });
    const again = message(P1, { test: { testId: 't1', actorUuid: 'Actor.sideA' } }, { id: 'f2' });
    const gmCard = message(GM, { test: { testId: 't1', actorUuid: 'Actor.sideA' } }, { id: 'f3' });
    const contest = { id: 'c1', sides: [{ uuid: 'Actor.sideA' }, { uuid: 'Actor.sideB' }] };
    const c1 = message(P1, { contest }, { id: 'c1m' });
    const c2 = message(P2, { contest }, { id: 'c2m' });
    g.game.messages = { contents: [first, again, gmCard, c1, c2] };
    try {
      assert.equal(c.cardReplaced(first), 'newer');
      assert.equal(c.cardReplaced(again), 'newer');
      assert.equal(c.cardReplaced(gmCard), false);
      assert.equal(c.cardReplaced(c1), 'newer', 'the other side\'s Karma card replaces the contest card');
    } finally { g.game.messages = { contents: [] }; }
  });
});

// ---------------------------------------------------------------- design 6: inline styles (SEC1-10)

describe('design 6 (SEC1-10): inline styles and inline tests on others\' messages', () => {
  test('a player\'s card with no system button loses the styles that place things (round 2: a GM\'s keeps them)', async () => {
    const c = await setup();
    const mk = () => { const root = new El(); const content = new El(); content.className = 'message-content'; root.appendChild(content); const div = new El(); div.setAttribute('style', 'position:fixed;inset:0;z-index:100000;color:blue'); content.appendChild(div); return { root, div }; };
    const p = mk(); c.stripCardStyles(p.root as any, message(P1, {}));
    assert.equal(p.div.getAttribute('style'), 'color:blue');
    const gmMsg = mk(); c.stripCardStyles(gmMsg.root as any, message(GM, {}));
    assert.equal(gmMsg.div.getAttribute('style'), 'position:fixed;inset:0;z-index:100000;color:blue');
  });

  test('round 2 (D): the inline-test click refusal is gone (a link rolls for the clicker\'s own character)', () => {
    assert.equal(/inlineClickAllowed/.test(SRC('applications/inline.ts')), false);
  });
});

// ---------------------------------------------------------------- design 7: rich text, the DOM path (SEC2b-4)

/** A minimal HTML DOM for cleanRichHtml's <template> path: elements, attributes (entities decoded), text, remove(). */
class MNode { parent: MEl | null = null; remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; } }
class MText extends MNode { constructor(public text: string) { super(); } }
class MEl extends MNode {
  children: MNode[] = []; attributes: Array<{ name: string; value: string }> = [];
  constructor(public localName: string) { super(); }
  get tagName() { return this.localName.toUpperCase(); }
  get content() { return this; }
  removeAttribute(n: string) { this.attributes = this.attributes.filter((a) => a.name !== n); }
  getAttribute(n: string) { return this.attributes.find((a) => a.name === n)?.value ?? null; }
  all(): MEl[] { return this.children.flatMap((c) => (c instanceof MEl ? [c, ...c.all()] : [])); }
  querySelectorAll(sel: string): MEl[] { const names = sel.split(',').map((s) => s.trim().toLowerCase()); return this.all().filter((e) => names.includes('*') || names.includes(e.localName.toLowerCase())); }
  get innerHTML(): string {
    return this.children.map((c) => (c instanceof MText ? c.text : `<${(c as MEl).localName}${(c as MEl).attributes.map((a) => ` ${a.name}="${a.value.replace(/"/g, '&quot;')}"`).join('')}>${(c as MEl).innerHTML}</${(c as MEl).localName}>`)).join('');
  }
  set innerHTML(s: string) { this.children = []; parseInto(this, s); }
}
const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'base', 'source']);
const decode = (v: string) => v.replace(/&#x([0-9a-f]+);?/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);?/g, (_m, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function parseInto(root: MEl, html: string): void {
  const stack: MEl[] = [root];
  const re = /<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  for (const m of html.matchAll(re)) {
    const top = stack[stack.length - 1]!;
    if (m[1]) { const i = stack.map((e) => e.localName).lastIndexOf(m[1]); if (i > 0) stack.length = i; continue; }
    if (m[5] !== undefined) { const t = new MText(m[5]); t.parent = top; top.children.push(t); continue; }
    const el = new MEl(m[2]!); el.parent = top; top.children.push(el);
    for (const a of (m[3] ?? '').matchAll(/([^\s=>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) el.attributes.push({ name: a[1]!.toLowerCase(), value: decode((a[2] ?? '').replace(/^["']|["']$/g, '')) });
    if (!m[4] && !VOID.has(el.localName.toLowerCase())) stack.push(el);
  }
}

describe('design 7 (SEC2b-4): cleanRichHtml in a DOM, before and after enriching', () => {
  const withDom = async <T>(fn: (rt: any) => Promise<T>): Promise<T> => {
    const doc = g.document, fu = g.foundry.utils;
    g.document = { createElement: (t: string) => new MEl(t) };
    g.foundry.utils = { ...fu, cleanHTML: (s: string) => s.replace(/\son[a-z]+="[^"]*"/gi, '') };
    try { return await fn(await import('../applications/richtext.ts')); } finally { g.document = doc; g.foundry.utils = fu; }
  };

  test('form controls go (an <input name="ownership.default"> joined the sheet\'s form)', async () => {
    const out = await withDom(async (rt) => rt.cleanRichHtml('<p>Hi<input type="hidden" name="ownership.default" value="3"><form><input name="x"></form><button>b</button><select><option>1</option></select><textarea>t</textarea><fieldset>f</fieldset></p>'));
    assert.ok(!/<(input|form|button|select|option|textarea|fieldset)\b/i.test(out), out);
    assert.match(out, /<p>Hi/);
  });

  test('scripted URLs are caught through tabs and entities, and SVG animate / set go', async () => {
    const out = await withDom(async (rt) => rt.cleanRichHtml('<a href="java&#9;script:alert(1)">a</a><a href="&#x6A;avascript:alert(2)">b</a><a href=" JaVaScRiPt:x">c</a><svg><a><animate attributeName="href" to="javascript:alert(1)"/><set attributeName="href" to="javascript:x"/><text>t</text></a></svg><img src="data:image/png;base64,AAAA"><img src="data:image/svg+xml,<svg/>">'));
    assert.ok(!/javascript/i.test(out), out);
    assert.ok(!/<(animate|set)\b/i.test(out), out);
    assert.match(out, /data:image\/png/);
    assert.ok(!/svg\+xml/.test(out), out);
  });

  test('style, data-action and data-sr2e-* go; other data attributes stay', async () => {
    const out = await withDom(async (rt) => rt.cleanRichHtml('<p><span data-action="dropPowerEffect" data-sr2e-action="resist" data-id="y" style="position:fixed;inset:0" onclick="x()">.</span></p>'));
    assert.ok(!/style=|data-action=|data-sr2e-action=|onclick=/.test(out), out);
    assert.match(out, /data-id="y"/);
  });

  test('what an enricher returns is cleaned again (a content-link label written as entities)', async () => {
    const out = await withDom(async (rt) => {
      g.foundry.applications.ux = { TextEditor: { implementation: { enrichHTML: async (s: string) => s.replace('LABEL', '<img src="x" onerror="window.__u=1"><input name="ownership.default" value="3">') } } };
      try { return (await rt.enrichFields({ system: { biography: '<p>@UUID[Actor.a]{LABEL}</p>' }, isOwner: true })).biography; } finally { g.foundry.applications.ux = {}; }
    });
    assert.ok(!/onerror|<input/i.test(out), out);
  });

  test('unsafeUrl', async () => {
    const { unsafeUrl } = await import('../applications/richtext.ts');
    for (const u of ['javascript:x', 'java\tscript:x', ' \nJAVASCRIPT:x', 'vbscript:x', 'data:text/html,x', 'data:image/svg+xml,x']) assert.equal(unsafeUrl(u), true, JSON.stringify(u));
    for (const u of ['https://x', '/systems/sr2e/a.png', 'data:image/png;base64,AA', 'icons/svg/d20.svg']) assert.equal(unsafeUrl(u), false, u);
  });
});

// ---------------------------------------------------------------- rules/trust.ts shapes (RB2-3, RB2-4, SEC1-7, A-3)

describe('Apply (GM) shapes and confirms', () => {
  test('RB2-3 (Q3) inverted: a power effect spec with string numbers, or one that grows past ±30, is refused; the confirm says it grows', () => {
    const e = { name: 'Harmless', attributes: { body: 1 }, successes: 60, spec: { name: 'x', attributes: { body: '30' }, perSuccess: true, capAt: 0, step: 1, kind: 'spell' } };
    assert.equal(powerEffectShapeOk(e), false, 'a numeric string');
    const e2 = { ...e, spec: { ...e.spec, attributes: { body: 30 } } };
    assert.equal(powerEffectShapeOk(e2), false, '30 × 60 successes');
    const ok = { name: 'Increase Body', attributes: { body: 2 }, successes: 2, kind: 'spell', spec: { name: 'Increase Body', attributes: { body: 1 }, perSuccess: true, capAt: 6, step: 1, kind: 'spell' } };
    assert.equal(powerEffectShapeOk(ok), true);
    const lines = describeGmChange('applyPowerEffect', { powerEffect: { targetUuid: 'Actor.npc', effect: ok } }).join(' | ');
    assert.match(lines, /grows with successes/);
  });

  test('RB2-4 (Q9) inverted: a Force 12 being\'s Movement power passes', async () => {
    const { powerModifierBundle } = await import('../rules/bestiary.ts');
    const b: any = powerModifierBundle('movement', { force: 12, successes: 3 });
    const entry = { ...b, attributes: {}, id: 'e1', fromUuid: 'Actor.spirit', fromName: 'Spirit', name: 'Movement', kind: 'power', successes: 3, special: 'movement',
      spec: { name: 'Movement', attributes: {}, perSuccess: false, special: 'movement', force: 12, kind: 'power' } };
    assert.equal(powerEffectShapeOk(entry), true);
  });

  test('A-3 (A2) inverted: possession attributes and skills are bounded, and the confirm shows them with the real name', () => {
    const bad = { possession: { targetUuid: 'Actor.npc', by: { uuid: 'Actor.own', name: 'Spirit', attributes: { willpower: 999, intelligence: -50, charisma: 1e9 }, skills: [{ name: 'Firearms', rating: 99 }] } } };
    assert.equal(gmApplyShapeOk('applyPossession', bad), false);
    const good = { possession: { targetUuid: 'Actor.npc', by: { uuid: 'Actor.own', name: 'Friendly spirit', attributes: { willpower: 6, intelligence: 5, charisma: 4 }, skills: [{ name: 'Sorcery', rating: 5, attribute: 'willpower' }] } } };
    assert.equal(gmApplyShapeOk('applyPossession', good), true);
    const lines = describeGmChange('applyPossession', good, (u) => (u === 'Actor.own' ? 'Mage Bob' : 'Guard')).join(' | ');
    assert.match(lines, /POSSESSED by Mage Bob \(the card calls it "Friendly spirit"\)/);
    assert.match(lines, /willpower 6/);
    assert.match(lines, /Sorcery 5/);
  });

  test('SEC1-7 / RA2-1 (X6) inverted: a surgery card with a negative or huge ¥ paid is refused; the confirm shows the money', () => {
    const base = { surgeonUuid: 'Actor.doc', snap: { successes: 3, surgery: { id: 'op1', patientUuid: 'Actor.bob', itemId: 'i1', itemName: 'Datajack', points: 0.2, care: 'hospital', pay: true, paid: true, paidAmount: 0 } } };
    assert.equal(gmApplyShapeOk('applySurgery', { surgeryApply: base }), true);
    for (const paidAmount of [-4000, 9e12, '100']) assert.equal(gmApplyShapeOk('applySurgery', { surgeryApply: { ...base, snap: { ...base.snap, surgery: { ...base.snap.surgery, paidAmount } } } }), false, String(paidAmount));
    assert.equal(gmApplyShapeOk('applySurgery', { surgeryApply: { ...base, snap: { ...base.snap, surgery: { ...base.snap.surgery, id: undefined } } } }), false, 'no operation id');
    assert.equal(gmApplyShapeOk('applySurgery', { surgeryApply: { ...base, snap: { ...base.snap, surgery: { ...base.snap.surgery, extra: 1 } } } }), false, 'a key outside the list');
    const lines = describeGmChange('applySurgery', { surgeryApply: { ...base, snap: { ...base.snap, surgery: { ...base.snap.surgery, paidAmount: 500 } } } }).join(' | ');
    assert.match(lines, /¥500/);
  });

  test('SEC1-7 / RA2-2 / D3-11: host change keys keep their shapes; the smoke line says how long', () => {
    const ok = (c: any) => gmApplyShapeOk('applyHost', { hostChange: { hostUuid: 'Actor.h', ...c } });
    assert.equal(ok({ minAlert: 'passive', found: { deckerUuid: 'Actor.d', ids: ['f1'] }, smoke: { rating: 4, tn: 2, by: 'D', round: 5, worldTime: 100, combatId: 'c' } }), true);
    assert.equal(ok({ setAlert: 'off' }), false);
    assert.equal(ok({ found: { ids: 'x' } }), false);
    assert.equal(ok({ smoke: { rating: 1, tn: 99, round: 1, worldTime: 1 } }), false);
    assert.equal(ok({ addFile: { name: 'Pay', size: 10, value: 1000, paydata: true, foundBy: 'x' } }), false);
    assert.equal(ok({ call: { op: 'explode', id: 'c' } }), false);
    assert.equal(ok({ addFile: { name: 'Pay', size: 10, value: 1000, paydata: true, uploadedBy: 'Actor.d', foundBy: [] }, call: { op: 'tap', id: 'c', by: 'Actor.d' } }), true);
    const lines = describeGmChange('applyHost', { hostChange: { hostUuid: 'Actor.h', smoke: { rating: 4, tn: 2, round: 9, worldTime: 120 } } }).join(' | ');
    assert.match(lines, /until Combat Turn 9/);
  });

  test('SEC1-15: a filed undo "before" value over MAX_UNDO_FIELD is not kept', () => {
    const big = 'x'.repeat(MAX_UNDO_FIELD + 10);
    const kept = undoFieldsToKeep([{ path: 'system.notes', had: true, before: big }, { path: 'system.nuyen', had: true, before: 5 }] as any[], { system: { notes: 'y', nuyen: 6 } });
    assert.deepEqual(kept.map((f) => f.path), ['system.nuyen']);
  });

  test('RB2-7: NO_TRUST is gone', () => {
    assert.equal(/NO_TRUST/.test(SRC('rules/trust.ts')), false);
  });
});

// ---------------------------------------------------------------- bounds from flags (A-2, D2-2)

describe('bounded flag data', () => {
  test('boundToxin and boundAttack', async () => {
    const c = await setup();
    const t = c.boundToxin({ name: 'x'.repeat(500), power: 999, level: 'Q', damageType: 'acid', recoveries: 1e9, intervalHours: 0, incubationHours: -5, contagious: 'everyone', kind: 'disease' });
    assert.equal(t.power, 60); assert.equal(t.level, 'L'); assert.equal(t.damageType, 'physical'); assert.equal(t.name.length, 120);
    assert.equal(t.recoveries, 30); assert.equal(t.intervalHours, 1); assert.equal(t.incubationHours, 0); assert.equal(t.contagious, '');
    const a = c.boundAttack({ targetUuid: 'Actor.t', attackerUuid: 'Actor.a', power: '<b>9</b>', level: 'X', attackSuccesses: 1e9, damageType: 'x', weaponName: 'W', toxinHit: { power: 500, level: 'D' } });
    assert.equal(a.power, 0); assert.equal(a.level, 'L'); assert.equal(a.attackSuccesses, 99); assert.equal(a.damageType, 'physical'); assert.equal(a.toxinHit.power, 60);
  });
});

// ---------------------------------------------------------------- nags (A-7, SEC1-12, D1) and D-slice items in chat.ts

describe('chat.ts: nags and D-slice items', () => {
  test('contest Karma: a GM spends an NPC\'s Karma with no dialog; P2 spends on their own side of P1\'s contest with none', async () => {
    await setup();
    const { SR2Actor } = await import('../documents/index.ts');
    const S: any = SR2Actor;
    const orig = S.contestKarma;
    const spent: number[] = [];
    S.contestKarma = async (_m: any, side: number) => { spent.push(side); return {}; };
    try {
      actor('cA', ['p1']); actor('cB', ['p2']); actor('cGuard', [], { type: 'npc' });
      resetUser(); confirmAnswer = false;
      press(message(P1, { contest: { id: 'k1', sides: [{ uuid: 'Actor.cA' }, { uuid: 'Actor.cGuard' }] } }), 'contestKarma', { side: '1', op: 'reroll' }); await tick();
      g.game.user = P2;
      press(message(P1, { contest: { id: 'k2', sides: [{ uuid: 'Actor.cA' }, { uuid: 'Actor.cB' }] } }), 'contestKarma', { side: '1', op: 'reroll' }); await tick();
    } finally { S.contestKarma = orig; restore(); }
    assert.deepEqual(spent, [1, 1]);
    assert.equal(confirms.length, 0);
  });

  test('notice ritual: no confirm (a perception roll for the clicker\'s own character)', async () => {
    await setup();
    let rolled = 0;
    actor('ritT', ['p2'], { noticeRitual: async () => { rolled++; } });
    g.game.user = P2; confirms.length = 0; confirmAnswer = false;
    press(message(P1, { ritualNotice: { targetUuid: 'Actor.ritT', tn: 4, spellName: 'X', force: 3, casterName: 'Y' } }), 'noticeRitual'); await tick();
    restore();
    assert.equal(rolled, 1);
  });

  test('D1-5: a haggle that posts no new card leaves the find card\'s Buy live', async () => {
    await setup();
    actor('hag', ['p1'], { haggle: async () => null });
    g.game.user = P1;
    const msg = message(P1, { buy: { actorUuid: 'Actor.hag', itemId: 'i', price: 100, name: 'X' } }, { unsetFlag: async (_s: string, k: string) => { delete (msg.flags.sr2e as any)[k]; } });
    press(msg, 'haggle'); await tick();
    restore();
    assert.equal(msg.getFlag('sr2e', 'superseded'), undefined);
  });

  test('D2-3 (P2) inverted: the re-rolled summoning\'s Create spirit doesn\'t make a second spirit', async () => {
    await setup();
    actor('mage', ['p1']);
    const made: any[] = [];
    (g.Actor as any).implementation = { create: async (d: any) => { const s = { ...d, uuid: `Actor.sp${made.length}`, name: d.name }; made.push(s); return s; } };
    const data = { name: 'Spirit (F4)', type: 'spirit', system: { force: 4, services: 2, summonerUuid: 'Actor.mage' } };
    const t = { testId: 'TS1', kind: 'conjure', actorUuid: 'Actor.mage' };
    const first = message(P1, { pendingSpirit: structuredClone(data), test: t }, { id: 'cs1', speaker: { actor: 'mage' } });
    const reroll = message(P1, { pendingSpirit: { ...structuredClone(data), system: { ...data.system, services: 3 } }, test: { ...t, rerolls: 1 } }, { id: 'cs2', speaker: { actor: 'mage' } });
    g.game.messages = { contents: [first] };
    resetUser();
    press(first, 'createSpirit'); await tick(50);
    g.game.messages = { contents: [first, reroll] };
    press(reroll, 'createSpirit'); await tick(50);
    g.game.messages = { contents: [] };
    delete (g.Actor as any).implementation;
    assert.equal(made.length, 1);
    assert.match(warnings.at(-1) ?? '', /already created/);
  });

  test('D2-1 / D3-2: spell defense is offered only from the target\'s own side', async () => {
    const c = await setup();
    const pc = actor('sdPc', ['p1']), ally = actor('sdAlly', ['p1']), other = actor('sdOther', ['p2']), npc = actor('sdNpc', []), npc2 = actor('sdNpc2', []);
    assert.equal(c.sameSide(pc, ally), true);
    assert.equal(c.sameSide(pc, other), false);
    assert.equal(c.sameSide(pc, npc), false, 'an enemy NPC mage');
    assert.equal(c.sameSide(npc, npc2), true);
    assert.equal(c.sameSide(npc, pc), false);
  });
});

// ---------------------------------------------------------------- the other application files

describe('settings, migrations, undo, socket, approvals and the small ones', () => {
  test('SEC2b-8 inverted: house rules of the wrong shape are ignored (a bad regex row, [null], COMBAT null)', async () => {
    const s = await import('../settings.ts');
    try {
      assert.ok(s.applyHouseRules({ advanced: { 'DOCS_V79.rangedStrengthRows': [{ match: '(' }] } }).length > 0);
      assert.ok(s.applyHouseRules({ advanced: { 'DOCS_V79.rangedStrengthRows': [null] } }).length > 0);
      assert.ok(s.applyHouseRules({ advanced: { COMBAT: null } }).length > 0);
      assert.deepEqual(s.applyHouseRules({}, 'urr'), [], 'the Revamp\'s own patch still applies');
      assert.equal(s.ruleShapeOk([{ upTo: 2 }, { upTo: Infinity }], [{ upTo: null }]), true, 'an open band stored as JSON null');
      assert.equal(s.ruleShapeOk([[0.5, 'L'], [1, 'M']], [[2, 'S']]), true, 'tuples');
    } finally { s.applyHouseRules({}); }
  });

  test('RB2-6: house rules for removed rules are dropped, the merged one moved across', async () => {
    const { houseRulesCleanup } = await import('../migrations.ts');
    const isRule = (p: string) => !['MAGIC_EXTRA.elementCategories', 'GONE.rule'].includes(p);
    const r = houseRulesCleanup({ values: { 'GONE.rule': 3, 'COMBAT.x': 1 }, advanced: { 'MAGIC_EXTRA.elementCategories': { water: 'manipulation' } } }, isRule);
    assert.deepEqual(r.next.advanced, { 'MAGIC_EXTRA.elementalCategories': { water: 'manipulation' } });
    assert.deepEqual(r.next.values, { 'COMBAT.x': 1 });
    assert.deepEqual(r.dropped, ['GONE.rule']);
    assert.equal(r.moved.length, 1);
    // The new rule set by the world too: the old one is dropped, not moved over it.
    const r2 = houseRulesCleanup({ advanced: { 'MAGIC_EXTRA.elementCategories': { a: 'b' }, 'MAGIC_EXTRA.elementalCategories': { c: 'd' } } }, isRule);
    assert.deepEqual(r2.next.advanced, { 'MAGIC_EXTRA.elementalCategories': { c: 'd' } });
    assert.deepEqual(r2.dropped, ['MAGIC_EXTRA.elementCategories']);
  });

  test('SEC1-15: Ctrl+Z takes the GM\'s own newest step, not a player\'s newer one', async () => {
    const { SR2Undo } = await import('../applications/undo.ts');
    const U: any = SR2Undo;
    const saved = U.log;
    U.clear?.();
    U.log = [{ id: 'a', userId: 'gm', userName: 'GM', started: 1, last: 10, label: 'GM edit', entries: [] }, { id: 'b', userId: 'p1', userName: 'P1', started: 2, last: 20, label: 'P1 edit', entries: [] }];
    try {
      assert.equal(U.newest()?.id, 'b');
      assert.equal(U.newestOwn('gm')?.id, 'a');
    } finally { U.log = saved; }
    assert.match(SRC('applications/undo.ts'), /pickUndo\(SR2Undo\.newestOwn\(\)\?\.last \?\? null, canvasNewest\(\)\);\n\s*if \(choice === 'sr2e'\) void SR2Undo\.undoLast\(\{ mine: true \}\);/);
  });

  test('S2-6: a relay request nobody answers says it timed out', async () => {
    const { requestGm } = await import('../applications/socket.ts');
    const users0 = g.game.users;
    g.game.users = Object.assign([GM, P1], { activeGM: { id: 'gm', isSelf: false }, get: users0.get });
    g.game.user = P1; g.game.socket = { emit() {} };
    try {
      const r = await requestGm('dismissSpirit', { actorUuid: 'Actor.x' }, 20);
      assert.equal(r.ok, false);
      assert.equal(r.timedOut, true);
    } finally { g.game.users = users0; delete g.game.socket; restore(); }
  });

  test('A-9: the GM sees who really filed a request (the update\'s sender), not the name it carries', async () => {
    const ap = await import('../applications/approvals.ts');
    ap.registerApprovalHooks();
    const r = { id: 'rq1', userId: 'gm', userName: 'GM', at: Date.now(), label: 'x', kind: 'method', data: {} };
    resetUser();
    for (const f of hooks['updateActor'] ?? []) f({ name: 'Bob' }, { flags: { sr2e: { requests: { rq1: r } } } }, {}, 'p2');
    assert.deepEqual(ap.filerOf(r), { id: 'p2', name: 'Player Two' });
    assert.equal(ap.filerOf({ id: 'never-seen' }), null);
    // SEC1-14: the request checked is a copy (what runs is what was checked).
    assert.match(SRC('applications/approvals.ts'), /r = structuredClone\(found\)/);
  });


  test('RC review: the character import matches "replace" items by the plan\'s key (inner blanks collapsed)', async () => {
    const { importNameKey } = await import('../applications/catalogue.ts');
    assert.equal(importNameKey('Ares  Predator '), importNameKey('ares predator'));
    assert.match(SRC('applications/catalogue.ts'), /area\?\.addEventListener\('input', later\)/, 'RC2-7: the CSV preview waits for the typing to stop');
  });

  test('RC2-5: @SR2Test[constructor] shows an unreadable test instead of throwing; a forged card kind gives a plain area class', async () => {
    const { inlineTestElement } = await import('../applications/inline.ts');
    for (const spec of ['constructor', '__proto__', 'toString']) {
      const el: any = inlineTestElement(spec);
      assert.match(el.className, /sr2e-inline-invalid|sr2e-inline-test/, spec);
    }
    const { decorateLookCard } = await import('../applications/look.ts');
    const root = new El(); const content = new El(); content.className = 'message-content'; root.appendChild(content);
    assert.doesNotThrow(() => decorateLookCard({ flags: { sr2e: { test: { kind: 'constructor' } } } }, root as any));
    assert.ok(!/function|\(/.test(root.className), root.className);
  });

  test('design 8 (SEC2b-1): the GM panel and wound groups draw at most MAX_OVERFLOW_BODY Overflow boxes', async () => {
    const { overflowBody, MAX_OVERFLOW_BODY } = await import('../applications/groups.ts');
    const { monitorView } = await import('../rules/look.ts');
    assert.equal(overflowBody({ attributes: { body: { total: 3_000_000 } } }), MAX_OVERFLOW_BODY);
    assert.equal(overflowBody({ attributes: { body: { total: 2 ** 32 } } }), MAX_OVERFLOW_BODY);
    assert.equal(overflowBody({ derived: { vitals: { overflowBody: 'x' } } }), 0);
    assert.equal(overflowBody({ attributes: { body: { total: 6 } } }), 6);
    const v: any = monitorView({ physical: 0, stun: 0 }, overflowBody({ attributes: { body: { total: 1e9 } } }), { overflow: true });
    assert.ok((v.overflow?.boxes?.length ?? 0) <= MAX_OVERFLOW_BODY + 5);
    assert.match(SRC('applications/ui.ts'), /monitorView\(a\.system\.monitor, overflowBody\(a\.system\)/);
  });

  test('A-15: an Apply (GM) actor update that does nothing says why', async () => {
    await setup();
    actor('auSrc', ['p1']); actor('auT', []);
    g.CONFIG.Actor.documentClass = { applyActorUpdate: async () => false };
    resetUser(); warnings.length = 0;
    press(message(P1, { actorUpdate: { uuid: 'Actor.auT', by: 'Actor.auSrc', monitor: { track: 'physical', boxes: -1 } } }, { content: '<button data-sr2e-action="applyActorUpdate"></button>' }), 'applyActorUpdate'); await tick(30);
    assert.match(warnings.at(-1) ?? '', /Not applied/);
  });
});

// ---------------------------------------------------------------- FX-DOC wiring: the two new Apply (GM) kinds and the rest

describe('FX-DOC wiring: applyVehicleJob and applyTimedStatus, charges, tally source, surgery money', () => {
  test('the specs and the done-flags agree (GM_APPLY_SPECS, GM_APPLY_ACTIONS)', async () => {
    const c = await setup();
    const { GM_APPLY_SPECS } = await import('../rules/trust.ts');
    assert.deepEqual(Object.keys(c.GM_APPLY_ACTIONS).sort(), Object.keys(GM_APPLY_SPECS).sort());
    assert.equal(GM_APPLY_SPECS['applyVehicleJob']!.flag, 'vehicleJob');
    assert.equal(GM_APPLY_SPECS['applyTimedStatus']!.flag, 'timedStatus');
    assert.equal(c.GM_APPLY_ACTIONS['applyVehicleJob'], 'vehicleJobApplied');
    assert.equal(c.GM_APPLY_ACTIONS['applyTimedStatus'], 'timedStatusApplied');
  });

  test('shapes: only the two vehicle calls, at most 6 plain arguments; only blindness, 1-600 s, +0-10 TN', () => {
    const job = (j: any) => gmApplyShapeOk('applyVehicleJob', { vehicleJob: j });
    assert.equal(job({ actorUuid: 'Actor.mech', method: 'finishModInstall', args: ['Actor.van', 0, 'Actor.mech', 'Armor plates', 500, null], jobId: 'j1' }), true);
    assert.equal(job({ actorUuid: 'Actor.mech', method: 'finishVehicleRepair', args: ['Actor.van', 3, ['tires']], jobId: 'j2' }), true);
    assert.equal(job({ actorUuid: 'Actor.mech', method: 'finishVehicleRepair', args: ['Actor.van', 3, ['tires']] }), false, 'round 3: a job with no id is refused');
    assert.equal(job({ actorUuid: 'Actor.mech', method: 'adjustNuyen', args: [] }), false, 'no other method');
    assert.equal(job({ actorUuid: 'Actor.mech', method: 'finishModInstall', args: [1, 2, 3, 4, 5, 6, 7] }), false, 'too many arguments');
    assert.equal(job({ actorUuid: 'Actor.mech', method: 'finishModInstall', args: [JSON.parse('{"__proto__":{"x":1}}')] }), false, 'a prototype key');
    assert.equal(job({ actorUuid: 'Actor.mech', method: 'finishModInstall', args: [], update: {} }), false, 'a key outside the list');
    const st = (s: any) => gmApplyShapeOk('applyTimedStatus', { timedStatus: s });
    assert.equal(st({ targetUuid: 'Actor.g', status: 'blind', seconds: 30, flashTn: 4, sourceUuid: 'Actor.t' }), true);
    assert.equal(st({ targetUuid: 'Actor.g', status: 'paralysed', seconds: 30 }), false);
    assert.equal(st({ targetUuid: 'Actor.g', status: 'blind', seconds: 1e6 }), false);
    assert.equal(st({ targetUuid: 'Actor.g', status: 'blind', seconds: '30' }), false, 'integers only (intIn)');
    assert.equal(st({ targetUuid: 'Actor.g', status: 'blind', seconds: 30, flashTn: 50 }), false);
    // Neither applies by itself.
    const any: CardTrust = { authorIsGm: false, owns: () => true };
    assert.equal(safeAutoApply('applyVehicleJob', { vehicleJob: { actorUuid: 'Actor.mech', method: 'finishVehicleRepair', args: [] } }, any), false);
    assert.equal(safeAutoApply('applyTimedStatus', { timedStatus: { targetUuid: 'Actor.g', status: 'blind', seconds: 30 } }, any), false);
  });

  test('the confirm says what changes: the mechanic, the job, the vehicle, the ¥; who is blinded, how long, the TN', () => {
    const names: Record<string, string> = { 'Actor.mech': 'Mech', 'Actor.van': 'Van', 'Actor.g': 'Guard', 'Actor.t': 'Tosser' };
    const nm = (u: string) => names[u] ?? '';
    const job = describeGmChange('applyVehicleJob', { vehicleJob: { actorUuid: 'Actor.mech', method: 'finishModInstall', args: ['Actor.van', 0, 'Actor.mech', 'Armor plates', 500, null] } }, nm).join(' | ');
    assert.match(job, /Mech's mod install \(Armor plates\) on Van: ¥500 was paid up front/);
    const rep = describeGmChange('applyVehicleJob', { vehicleJob: { actorUuid: 'Actor.mech', method: 'finishVehicleRepair', args: ['Actor.van', 3, ['tires']] } }, nm).join(' | ');
    assert.match(rep, /Mech's vehicle repair on Van: 3 box\(es\) and tires/);
    const st = describeGmChange('applyTimedStatus', { timedStatus: { targetUuid: 'Actor.g', status: 'blind', seconds: 30, flashTn: 4, sourceUuid: 'Actor.t' } }, nm).join(' | ');
    assert.match(st, /Guard is BLINDED for 30 s \(\+4 TN\) \(Tosser's flash\)/);
  });

  test('a forged card: the wrong shape is refused at once; a player\'s card asks the GM, and No applies nothing', async () => {
    await setup();
    actor('fjMech', ['p1']); actor('fjVan', [], { type: 'vehicle' }); actor('fjGuard', [], { type: 'npc' });
    const calls: string[] = [];
    g.CONFIG.Actor.documentClass = { applyVehicleJobAsGm: async () => { calls.push('job'); return true; }, applyTimedStatusAsGm: async () => { calls.push('status'); return true; } };
    resetUser(); warnings.length = 0;
    press(message(P1, { vehicleJob: { actorUuid: 'Actor.fjMech', method: 'adjustNuyen', args: ['Actor.p2char', -50000] } }, { content: '<button data-sr2e-action="applyVehicleJob"></button>' }), 'applyVehicleJob'); await tick();
    press(message(P1, { timedStatus: { targetUuid: 'Actor.fjGuard', status: 'blind', seconds: 1e6 } }, { content: '<button data-sr2e-action="applyTimedStatus"></button>' }), 'applyTimedStatus'); await tick();
    assert.deepEqual(calls, []);
    assert.equal(confirms.length, 0, 'refused before any dialog');
    assert.equal(warnings.filter((w) => /not what the system posts/.test(w)).length, 2);
    confirmAnswer = false;
    press(message(P1, { vehicleJob: { actorUuid: 'Actor.fjMech', method: 'finishVehicleRepair', args: ['Actor.fjVan', 3], jobId: 'fj1' } }, { content: '<button data-sr2e-action="applyVehicleJob"></button>' }), 'applyVehicleJob'); await tick();
    press(message(P1, { timedStatus: { targetUuid: 'Actor.fjGuard', status: 'blind', seconds: 30, sourceUuid: 'Actor.fjMech' } }, { content: '<button data-sr2e-action="applyTimedStatus"></button>' }), 'applyTimedStatus'); await tick();
    assert.equal(confirms.length, 2, 'a player\'s card: the GM confirms');
    assert.match(confirms[0].content, /vehicle repair on fjVan/);
    assert.match(confirms[1].content, /fjGuard is BLINDED for 30 s/);
    assert.deepEqual(calls, []);
    confirmAnswer = true;
    press(message(GM, { timedStatus: { targetUuid: 'Actor.fjGuard', status: 'blind', seconds: 30 } }, { content: '<button data-sr2e-action="applyTimedStatus"></button>' }), 'applyTimedStatus'); await tick();
    restore();
    assert.deepEqual(calls, ['status'], 'the GM\'s own card applies');
  });

  test('SEC1-16 / D1-11: a player\'s Detonate card with no charge on record does nothing', async () => {
    await setup();
    actor('chSetter', ['p1']);
    g.CONFIG.Actor.documentClass = { storedCharge: () => null, armedCharges: () => [] };
    g.game.user = P1; warnings.length = 0;
    press(message(P1, { charge: { actorUuid: 'Actor.chSetter', name: 'C4', power: 200, perMetre: 0.25, shaped: false, chargeId: 'gone', sceneId: 's' } }), 'detonateCharge'); await tick();
    restore();
    assert.match(warnings.at(-1) ?? '', /isn't on record/);
  });

  test('D3-7: Apply (GM) tally passes the card\'s source; the surgery confirm carries the documents\' money line', async () => {
    await setup();
    actor('tsDecker', ['p1']); actor('tsHost', [], { type: 'host' });
    const got: any[] = [];
    g.CONFIG.Actor.documentClass = { applyTallyCard: async (...a: any[]) => { got.push(a); return '<p>t</p>'; }, surgeryApplyMoney: () => '¥1,200 for care charged to Bob', applySurgeryAsGm: async () => false };
    resetUser();
    press(message(P1, { tally: { hostUuid: 'Actor.tsHost', successes: 3, key: 'Actor.tsDecker', name: 'D', sourceUuid: 'Actor.tsDecker' } }, { content: '<button data-sr2e-action="applyTally"></button>' }), 'applyTally'); await tick();
    assert.equal(got[0]?.[3], 'Actor.tsDecker');
    confirmAnswer = false;
    actor('sgDoc', ['p1']); actor('sgBob', []);
    press(message(P1, { surgeryApply: { surgeonUuid: 'Actor.sgDoc', snap: { successes: 3, surgery: { id: 'op', patientUuid: 'Actor.sgBob', itemId: 'i', itemName: 'Datajack', points: 0.2 } } } }, { content: '<button data-sr2e-action="applySurgery"></button>' }), 'applySurgery'); await tick();
    restore();
    assert.match(confirms.at(-1)?.content ?? '', /money: ¥1,200 for care charged to Bob/);
  });

  test('D1-10: an inline resistance roll asks rollAttribute to skip the exclusive-spell block (source check)', () => {
    assert.match(SRC('applications/inline.ts'), /\{ resist: true \}/);
  });
});

// ---------------------------------------------------------------- round 2 (FIX2-BRIEF; V-SEC, V-REST)

describe('round 2: the GM lock (A2, A3, A6)', () => {
  test('A2: an Apply (GM) click waits for a running locked task (a re-run) before it applies', async () => {
    await setup();
    const { withGmLock } = await import('../applications/gmlock.ts');
    actor('lkSrc', ['p1']); actor('lkHost', [], { type: 'host' });
    const calls: string[] = [];
    g.CONFIG.Actor.documentClass = { applyTallyCard: async () => { calls.push('tally'); return '<p>t</p>'; } };
    resetUser();
    let release!: () => void;
    const held = withGmLock(() => new Promise<void>((r) => { release = r; }));
    press(message(GM, { tally: { hostUuid: 'Actor.lkHost', successes: 3 } }, { content: '<button data-sr2e-action="applyTally"></button>' }), 'applyTally');
    await tick(30);
    assert.deepEqual(calls, [], 'waits while the lock is held');
    release(); await held; await tick(30);
    assert.deepEqual(calls, ['tally']);
  });

  test('A2: another client\'s relay request runs under the lock; A3: on the GM\'s own client a re-run\'s request is judged as the player', async () => {
    const sock = await import('../applications/socket.ts');
    const { withGmLock } = await import('../applications/gmlock.ts');
    const seen: string[] = [];
    sock.onRelay('nextTurn', async (_d, user) => { seen.push(String(user?.id)); return { ok: true }; });
    g.game.socket = { emit() {} };
    resetUser();
    let release!: () => void;
    const held = withGmLock(() => new Promise<void>((r) => { release = r; }));
    const req = sock.handleSocket({ type: 'request', id: 'r1', op: 'nextTurn', userId: 'p2', data: {} } as any, 'p2');
    await tick(20);
    assert.deepEqual(seen, [], 'queued behind the lock');
    release(); await held; await req;
    assert.deepEqual(seen, ['p2']);
    // A3: the GM's own request inside a re-run (actingAuthor P1): the handler sees P1, and nothing waits for the lock.
    const prev = g.CONFIG.Actor.documentClass;
    g.CONFIG.Actor.documentClass = { actingAuthor: P1 };
    try { await sock.requestGm('nextTurn', {}); } finally { g.CONFIG.Actor.documentClass = prev; delete g.game.socket; }
    assert.deepEqual(seen, ['p2', 'p1']);
  });

  test('A6 (V-SEC 3, p3 inverted): a blast drawn while the GM re-runs a player\'s card is drawn once the re-run ends', async () => {
    const cv = await import('../applications/canvas.ts');
    const { withGmLock } = await import('../applications/gmlock.ts');
    cv.registerAreaHooks();
    const made: any[] = [];
    const scene = { id: 'scA', active: true, createEmbeddedDocuments: async (_t: string, d: any[]) => { made.push(...d); return d; } };
    g.game.scenes = { get: (id: string) => (id === 'scA' ? scene : null), contents: [scene], [Symbol.iterator]: function* () { yield scene; } };
    g.canvas = { scene, grid: { size: 100, distance: 1 } };
    const prev = g.CONFIG.Actor.documentClass;
    resetUser();
    try {
      await withGmLock(async () => {
        g.CONFIG.Actor.documentClass = { actingAuthor: P1 };
        try { await cv.drawArea({ x: 10, y: 10 }, 5, 'Grenade (5 m)', 20, 'scA'); } finally { g.CONFIG.Actor.documentClass = prev; }
        assert.equal(made.length, 0, 'not inside the re-run (the write guard would cancel it)');
      });
      await tick(20);
      assert.equal(made.length, 1, 'drawn after it');
      assert.match(String(made[0].name), /Grenade/);
    } finally { g.CONFIG.Actor.documentClass = prev; delete g.canvas; g.game.scenes = []; }
  });
});

describe('round 2: B auto-apply, C styles, E targets, F filers, G contests', () => {
  test('B (V-SEC 4, p2 inverted): a tally, site, host or cleanse card never applies by itself, even from the author\'s own character', () => {
    const t: CardTrust = { authorIsGm: false, owns: (u) => u === 'Actor.mine' };
    assert.equal(safeAutoApply('applyTally', { tally: { hostUuid: 'Actor.gmHost', successes: 30, sourceUuid: 'Actor.mine' } }, t), false);
    assert.equal(safeAutoApply('applySite', { siteChange: { siteUuid: 'Actor.gmSite', add: 30, sourceUuid: 'Actor.mine' } }, t), false);
    assert.equal(safeAutoApply('applyHost', { hostChange: { hostUuid: 'Actor.gmHost', minAlert: 'passive', sourceUuid: 'Actor.mine' } }, t), false);
    assert.equal(safeAutoApply('applyHost', { hostChange: { hostUuid: 'Actor.gmHost', found: { deckerUuid: 'Actor.mine', ids: ['f'] }, sourceUuid: 'Actor.mine' } }, t), false);
    assert.equal(safeAutoApply('applyCleanse', { cleanse: { sceneId: 's', points: 5, sourceUuid: 'Actor.mine' } }, t), false);
    // What is left: a monitor change on the author's own actor.
    assert.equal(safeAutoApply('applyActorUpdate', { actorUpdate: { uuid: 'Actor.mine', monitor: { track: 'stun', boxes: -1 } } }, t), true);
  });

  test('C: playerStyle keeps text and box looks only', async () => {
    const c = await setup();
    assert.equal(c.playerStyle('position:fixed; inset:0; z-index:9; color:red; font-weight:bold; background-color:#000; border:1px solid red'), 'color:red; font-weight:bold; background-color:#000; border:1px solid red');
    assert.equal(c.playerStyle('background-color: url(x); color: expression(alert(1)); display:none; opacity:0; width:100vw'), '');
    assert.equal(c.playerStyle('text-decoration-line: underline; padding-left: 2px; list-style-type: disc'), 'text-decoration-line: underline; padding-left: 2px; list-style-type: disc');
  });

  test('E: past the cap a player\'s card still prompts its first 12 and tells this client about the rest', async () => {
    await setup();
    actor('atkE', ['p1']);
    for (let i = 0; i < 15; i++) actor(`npcE${i}`, [], { type: 'npc' });
    const infos: string[] = [];
    const prevInfo = g.ui.notifications.info;
    g.ui.notifications.info = (m: string) => { infos.push(m); };
    resetUser(); confirmAnswer = false;
    try {
      const attacks = Array.from({ length: 15 }, (_, i) => ({ targetUuid: `Actor.npcE${i}`, attackerUuid: 'Actor.atkE', weaponName: 'W' }));
      const msg = message(P1, { attacks }, { content: '<button data-sr2e-action="defend"></button>' });
      for (const f of hooks['createChatMessage'] ?? []) f(msg);
      await tick(450);
    } finally { g.ui.notifications.info = prevInfo; restore(); }
    assert.equal(confirms.length, 12);
    assert.ok(infos.some((m) => /3 more targets on this card: use its buttons/.test(m)), JSON.stringify(infos));
  });

  test('F (V-SEC 11): a request whose filer this GM client didn\'t see arrive is marked "(filer not verified)"', async () => {
    const ap = await import('../applications/approvals.ts');
    assert.equal(ap.filerLabel({ id: 'never-seen-F', userName: 'GM' }), 'GM (filer not verified)');
    ap.registerApprovalHooks();
    const r = { id: 'rqF', userId: 'gm', userName: 'GM', at: Date.now(), label: 'x', kind: 'method', data: {} };
    for (const f of hooks['updateActor'] ?? []) f({ name: 'Bob' }, { flags: { sr2e: { requests: { rqF: r } } } }, {}, 'p1');
    assert.equal(ap.filerLabel(r), 'Player One');
    assert.match(SRC('applications/ui.ts'), /escHtml\(filerLabel\(r\)\)/, 'the approve dialog uses it too');
  });

  test('G (V-SEC 7): a GM spending Karma for a player\'s side of their contest card does it as that player; an NPC side as the GM', async () => {
    await setup();
    const { SR2Actor } = await import('../documents/index.ts');
    const S: any = SR2Actor;
    const orig = S.contestKarma;
    const as: any[] = [];
    S.contestKarma = async () => { as.push(S.actingAuthor?.id ?? null); return {}; };
    try {
      actor('gA', ['p1']); actor('gGuard', [], { type: 'npc' });
      resetUser();
      press(message(P1, { contest: { id: 'gk1', sides: [{ uuid: 'Actor.gA' }, { uuid: 'Actor.gGuard' }] } }), 'contestKarma', { side: '0', op: 'reroll' }); await tick();
      press(message(P1, { contest: { id: 'gk2', sides: [{ uuid: 'Actor.gA' }, { uuid: 'Actor.gGuard' }] } }), 'contestKarma', { side: '1', op: 'reroll' }); await tick();
    } finally { S.contestKarma = orig; restore(); }
    assert.deepEqual(as, ['p1', null]);
  });
});

describe('round 2: I (V-REST)', () => {
  test('I1 (V-REST 1, hr.mts inverted): mixed-kind tables are accepted; SEC2b-8\'s shapes stay refused', async () => {
    const s = await import('../settings.ts');
    const { RULES } = await import('../rules/index.ts');
    const D = s.RULE_DEFAULTS;
    try {
      const p = s.applyHouseRules({ advanced: {
        'SECURITY.concealment': { ...D.SECURITY.concealment, ultrasound: { ...D.SECURITY.concealment.ultrasound, silence: 'blind' } },
        'COMBAT.reloadFeed': { ...D.COMBAT.reloadFeed, clip: 10 },
      } }, 'book');
      assert.deepEqual(p, []);
      assert.equal((RULES as any).SECURITY.concealment.ultrasound.silence, 'blind');
      assert.equal((RULES as any).COMBAT.reloadFeed.clip, 10);
      assert.ok(s.applyHouseRules({ advanced: { COMBAT: null } }).length > 0);
      assert.ok(s.applyHouseRules({ advanced: { 'COMBAT.reloadFeed': { ...D.COMBAT.reloadFeed, clip: { x: 1 } } } }).length > 0, 'an object in a cell');
    } finally { s.applyHouseRules({}); }
    const { houseRulesNote } = await import('../migrations.ts');
    assert.match(houseRulesNote({ moved: [], dropped: [] }, ['COMBAT: not a rule, or the wrong kind of value']), /Not applied.*COMBAT/);
    assert.equal(houseRulesNote({ moved: [], dropped: [] }, []), '');
  });

  test('I2 (V-REST 4, imp.mts): shuriken, throwing knives and shock gloves are weapons again; the jerrycan stays gear', async () => {
    const ci = await import('../rules/charimport.ts');
    const p: any = ci.parseCharacterSheet('Name: Ghost\nGear: Ares Predator 9M, Jerrycan of fuel 20L, Shuriken 4L, Throwing knife 3L, Shock glove 7L, Medkit\nNuyen 5,000');
    const weapons = p.weapons.map((w: any) => w.name);
    for (const w of ['Shuriken', 'Throwing knife', 'Shock glove']) assert.ok(weapons.includes(w), `${w}: ${JSON.stringify(weapons)}`);
    assert.ok(!weapons.some((w: string) => /Jerrycan/.test(w)));
  });

  test('I3 (V-REST 5): TAH names lose < and > but are not entity-escaped', () => {
    const s = SRC('applications/tah.ts');
    assert.match(s, /name: noTags\(i18n\(a\.name\)\)/);
    assert.match(s, /replace\(\/\[<>"\]\/g, ''\)/, 'round 3: quotes too');
  });

  test('I4 (V-REST 7, avail.mts): an en dash or em dash range reads like a hyphen', async () => {
    const up = await import('../rules/upkeep.ts');
    const hyphen: any = up.parseAvailability('8/2-3 days');
    assert.deepEqual(up.parseAvailability('8/2–3 days'), hyphen);
    assert.deepEqual(up.parseAvailability('8/2—3 days'), hyphen);
  });

  test('I4 (V-REST 8): the table lookups ignore Object.prototype keys', async () => {
    const cw = await import('../rules/cyberware.ts');
    const sec = await import('../rules/security.ts');
    for (const k of ['constructor', '__proto__', 'toString']) {
      assert.equal(cw.cyberCost(1000, k), 1000, k);
      assert.equal(sec.hostAlertFor(k), 'none', k);
    }
    // v0.92.3: cyberware's grade tables are read in gear923.ts now (RULES.GEAR_V923.grades).
    for (const f of ['arcana', 'gear923', 'matrix', 'security', 'situation', 'spellcraft', 'statblock', 'bioware', 'critters', 'docs79-health', 'everyday', 'fieldsfire', 'npcgen']) {
      assert.match(SRC(`rules/${f}.ts`), /\bown\(/, f);
    }
  });

  test('I4 (V-REST 6, changed in v0.85.0): a name in a notification is escaped once, never twice', () => {
    // v0.81.1 took escHtml off these two names because they sat inside a note that was escaped again. Since the
    // v0.85.0 sweep every notification value is escaped exactly once: never an escHtml inside a template that is
    // itself passed to escHtml.
    const s = SRC('applications/sheets.ts');
    const nested = /escHtml\([^)\n]*`[^`\n]*\$\{escHtml\(/;
    assert.deepEqual(s.split('\n').filter((l) => /notifications/.test(l) && nested.test(l)), []);
    // v0.89.1: the text moved into lang/en.json; the name inside the default note is still escaped once, by the outer escHtml.
    assert.match(s, /note: escHtml\(r\.note \?\? tx\('SR2E\.Notify\.Sheet\.wasNotDismissed', \{ actorName: actor\.name \}\)\)/);
  });

  test('optional: the sheet\'s Cover targets control', () => {
    assert.match(SRC('applications/sheets.ts'), /coverSpellDefense: SR2CharacterSheet\.#onCoverSpellDefense/);
    assert.match(readFileSync(new URL('../../../public/templates/actor-character-sheet.hbs', import.meta.url), 'utf8'), /data-action="coverSpellDefense"/);
  });
});

// ---------------------------------------------------------------- round 3 (FIX3-BRIEF; RV/V2.md probes, inverted)

/** A player's re-run holding the GM lock until released (V2's holdRerun). */
const holdRerun = async (S: any, who: any) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => { release = r; });
  let started!: () => void;
  const st = new Promise<void>((r) => { started = r; });
  const done = S.runAsAuthor(who, async () => { started(); await gate; });
  await st;
  return { release: async () => { release(); await done; } };
};

describe('round 3: V2 findings in the application files', () => {
  test('1 (V2-gmcard): a GM\'s Karma re-roll on a GM card waits for a player\'s re-run, then runs with the GM\'s rights', async () => {
    await setup();
    const { SR2Actor } = await import('../documents/index.ts');
    const S: any = SR2Actor;
    const prev = g.CONFIG.Actor.documentClass;
    g.CONFIG.Actor.documentClass = S;
    const seen: any[] = [];
    actor('npcK3', [], { system: { karma: { poolSpent: 0, pool: 5 } }, karmaReroll: async () => { seen.push(S.actingAuthor?.id ?? null); } });
    resetUser();
    try {
      const h = await holdRerun(S, P1);
      press(message(GM, { test: { actorUuid: 'Actor.npcK3', kind: 'skill', label: 'Shoot', dice: [], testId: 'tK3' } }), 'karmaReroll');
      await tick(30);
      const during = [...seen];
      await h.release(); await tick(30);
      assert.deepEqual(during, [], 'not during the player\'s re-run');
      assert.deepEqual(seen, [null], 'then with the GM\'s rights');
    } finally { g.CONFIG.Actor.documentClass = prev; }
  });

  test('1: contest Karma for an NPC side on a player\'s card waits too and runs with the GM\'s rights', async () => {
    await setup();
    const { SR2Actor } = await import('../documents/index.ts');
    const S: any = SR2Actor;
    const orig = S.contestKarma;
    const as: any[] = [];
    S.contestKarma = async () => { as.push(S.actingAuthor?.id ?? null); return {}; };
    actor('cA3', ['p1']); actor('cGuard3', [], { type: 'npc' });
    resetUser();
    try {
      const h = await holdRerun(S, P1);
      press(message(P1, { contest: { id: 'k3', sides: [{ uuid: 'Actor.cA3' }, { uuid: 'Actor.cGuard3' }] } }), 'contestKarma', { side: '1', op: 'reroll' });
      await tick(30);
      const during = [...as];
      await h.release(); await tick(30);
      assert.deepEqual(during, []);
      assert.deepEqual(as, [null]);
    } finally { S.contestKarma = orig; restore(); }
  });

  test('2 / 8 (V2-h5): a GM clicking Detonate on a player\'s card with no record confirms, naming the Power; a player is refused', async () => {
    await setup();
    actor('setter3', ['p1'], {});
    const prev = g.CONFIG.Actor.documentClass;
    g.CONFIG.Actor.documentClass = { storedCharge: () => null, armedCharges: () => [] };
    resetUser(); warnings.length = 0; confirmAnswer = false;
    try {
      press(message(P1, { charge: { actorUuid: 'Actor.setter3', name: 'C-4', power: 12, perMetre: 1, shaped: false } }), 'detonateCharge');
      await tick(30);
      assert.equal(confirms.length, 1, `no GM confirm; warnings: ${warnings.join(' | ')}`);
      assert.match(confirms[0].content, /C-4 goes off at Power 12/);
      g.game.user = P1; warnings.length = 0;
      press(message(P1, { charge: { actorUuid: 'Actor.setter3', name: 'C-4', power: 200, perMetre: 0.25, shaped: false, chargeId: 'x' } }), 'detonateCharge');
      await tick(30);
      assert.match(warnings.at(-1) ?? '', /isn't on record/);
    } finally { g.CONFIG.Actor.documentClass = prev; restore(); }
  });

  test('2: the documents\' detonateConfirmText, when there, gives the line and the Power', async () => {
    await setup();
    actor('setter3b', ['p1'], {});
    const prev = g.CONFIG.Actor.documentClass;
    g.CONFIG.Actor.documentClass = { storedCharge: () => null, armedCharges: () => [], detonateConfirmText: () => ({ text: 'Recorded C-4: Power 9', power: 9, perMetre: 1 }) };
    resetUser(); confirmAnswer = false;
    try {
      press(message(P1, { charge: { actorUuid: 'Actor.setter3b', name: 'C-4', power: 150, perMetre: 1, chargeId: 'r1' } }), 'detonateCharge');
      await tick(30);
    } finally { g.CONFIG.Actor.documentClass = prev; restore(); }
    assert.match(confirms.at(-1)?.content ?? '', /Recorded C-4: Power 9/);
  });

  test('5 (V2-relay): a request whose turn comes after the requester gave up is not run on the GM', async () => {
    const sock = await import('../applications/socket.ts');
    const { withGmLock } = await import('../applications/gmlock.ts');
    assert.equal(sock.RELAY_TIMEOUT_MS, 20_000);
    assert.ok(sock.RELAY_EXPIRE_MS < sock.RELAY_TIMEOUT_MS);
    let spent = 0;
    sock.onRelay('spendSpellDefense', async () => { spent += 4; return { ok: true }; });
    const replies: any[] = [];
    g.game.socket = { emit(_s: string, m: any) { replies.push(m); } };
    resetUser();
    let release!: () => void;
    const held = withGmLock(() => new Promise<void>((r) => { release = r; }));
    try {
      const handled = sock.handleSocket({ type: 'request', id: 'rq3', op: 'spendSpellDefense', userId: 'p1', data: {} } as any, 'p1', 20);
      await tick(60);
      release(); await held; await handled;
    } finally { delete g.game.socket; }
    assert.equal(spent, 0, 'the protector keeps its dice');
    assert.equal(replies.at(-1)?.ok, false);
    assert.match(String(replies.at(-1)?.note), /timed out/);
  });

  test('6 (V2-region): a re-run acting as a player with REGION_CREATE still draws through the queued path', async () => {
    const cv = await import('../applications/canvas.ts');
    const { SR2Actor } = await import('../documents/index.ts');
    const S: any = SR2Actor;
    const prev = g.CONFIG.Actor.documentClass;
    g.CONFIG.Actor.documentClass = S;
    const made: string[] = [];
    const scene: any = { id: 'scR3', active: true, createEmbeddedDocuments: async (_t: string, d: any[]) => { made.push(String(S.actingAuthor?.id ?? 'none')); return d; } };
    g.game.scenes = { get: (id: string) => (id === 'scR3' ? scene : null), contents: [scene], [Symbol.iterator]: function* () { yield scene; } };
    g.canvas = { scene, grid: { size: 100, distance: 1 } };
    const P1R = { ...P1, hasPermission: (p: string) => p === 'REGION_CREATE' };
    resetUser();
    try {
      await S.runAsAuthor(P1R, async () => { await cv.drawArea({ x: 10, y: 10 }, 5, 'Grenade (5 m)', 20, 'scR3'); assert.deepEqual(made, []); });
      await tick(30);
    } finally { g.CONFIG.Actor.documentClass = prev; delete g.canvas; g.game.scenes = []; }
    assert.deepEqual(made, ['none'], 'drawn after the re-run, with no acting author');
  });

  test('7 (V2-inline): a GM step on a card whose auto-apply is only queued waits for the lock', async () => {
    await setup();
    const { SR2Actor } = await import('../documents/index.ts');
    const S: any = SR2Actor;
    const prev = g.CONFIG.Actor.documentClass;
    g.CONFIG.Actor.documentClass = S;
    actor('sumX3', ['p1'], {}); actor('mineX3', ['p1'], {});
    const seen: any[] = [];
    g.Actor.implementation = { create: async (d: any) => { seen.push(S.actingAuthor?.id ?? null); return { uuid: 'Actor.newSpirit3', ...d }; } };
    resetUser();
    try {
      const h = await holdRerun(S, P1);
      const msg = message(P1, {
        pendingSpirit: { type: 'spirit', name: 'Watcher', system: { summonerUuid: 'Actor.sumX3', force: 2 } },
        actorUpdate: { uuid: 'Actor.mineX3', monitor: { track: 'stun', boxes: -1 } },
      }, { content: '<button data-sr2e-action="applyActorUpdate"></button><button data-sr2e-action="createSpirit"></button>' });
      for (const f of hooks['createChatMessage'] ?? []) f(msg);
      press(msg, 'createSpirit');
      await tick(40);
      const during = [...seen];
      await h.release(); await tick(60);
      assert.deepEqual(during, [], 'not during the player\'s re-run');
    } finally { delete g.Actor.implementation; g.CONFIG.Actor.documentClass = prev; }
  });

  test('8 (V2-hr): "lots" in a numeric cell of a whole-section override is refused; reloadFeed and concealment still pass', async () => {
    const s = await import('../settings.ts');
    const D: any = s.RULE_DEFAULTS;
    const bad: any = structuredClone(D.COMBAT);
    const find = (o: any, path: string[]): string[] | null => { for (const [k, v] of Object.entries(o)) { if (typeof v === 'number') return [...path, k]; if (v && typeof v === 'object' && !Array.isArray(v)) { const r = find(v, [...path, k]); if (r) return r; } } return null; };
    const path = find(bad, [])!;
    let o = bad; for (const k of path.slice(0, -1)) o = o[k];
    o[path.at(-1)!] = 'lots';
    try {
      assert.ok(s.applyHouseRules({ advanced: { COMBAT: bad } }).length > 0, `accepted COMBAT.${path.join('.')} = "lots"`);
      assert.deepEqual(s.applyHouseRules({ advanced: {
        'SECURITY.concealment': { ...D.SECURITY.concealment, ultrasound: { ...D.SECURITY.concealment.ultrasound, silence: 'blind' } },
        'COMBAT.reloadFeed': { ...D.COMBAT.reloadFeed, clip: 10, cylinder: 'all' },
      } }), []);
      assert.deepEqual(s.applyHouseRules({}, 'urr'), []);
    } finally { s.applyHouseRules({}); }
  });

  test('11 (V2-style): font-size up to 2em and a plain background survive; big sizes, border-image and gradients don\'t', async () => {
    const c = await setup();
    assert.equal(c.playerStyle('font-size: 1.5em'), 'font-size: 1.5em');
    assert.equal(c.playerStyle('background: #ffeeaa'), 'background: #ffeeaa');
    assert.equal(c.playerStyle('font-size: 40px'), '');
    assert.equal(c.playerStyle('font-size: 500%'), '');
    assert.equal(c.playerStyle('border-image-source: linear-gradient(red, red); border-image-outset: 5000px'), '');
    assert.equal(c.playerStyle('background: linear-gradient(red, blue)'), '');
    assert.equal(c.playerStyle('background: image-set("x.png" 1x)'), '');
  });

  test('nits: TAH names lose quotes too (V2 #13); refused house rules are whispered at a GM load once per list (V2 #17)', async () => {
    const tahSrc = SRC('applications/tah.ts');
    assert.match(tahSrc, /replace\(\/\[<>"\]\/g, ''\)/);
    const s = await import('../settings.ts');
    const stored: Record<string, unknown> = {};
    const prevSettings = g.game.settings;
    g.game.settings = { get: (_s: string, k: string) => stored[k] ?? '', set: async (_s: string, k: string, v: unknown) => { stored[k] = v; } };
    posted.length = 0;
    resetUser();
    try {
      assert.equal(await s.reportRefusedHouseRules(['COMBAT: not a rule, or the wrong kind of value']), true);
      assert.equal(await s.reportRefusedHouseRules(['COMBAT: not a rule, or the wrong kind of value']), false, 'once per list');
    } finally { g.game.settings = prevSettings; }
    assert.match(String(posted.at(-1)?.content), /house rules not applied/);
  });
});
