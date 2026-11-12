/**
 * v0.81.0 round 2, fixer RF-APP: the R2-SEC findings whose code is in the application files (chat.ts, trust.ts,
 * rules/trust.ts, settings.ts). The Foundry stubs are the reviewer's (RV/try-R2-SEC r2sec.test.ts); each test uses the
 * reviewer's failing input (Q1-Q8) and failed before its fix.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { safeAutoApply, gmApplyShapeOk, describeGmChange, type CardTrust } from '../rules/trust.ts';

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
const created = (h: string) => { for (const f of hooks[h] ?? []) return f; return null; };
void created;

describe('v0.81.0 round 2 (RF-APP): the R2-SEC findings in the application files', () => {
  test('R2-SEC-9 (Q1): an owned "source" no longer heals any actor by itself', () => {
    const f = { actorUpdate: { uuid: 'Actor.someoneElse', monitor: { track: 'physical', boxes: -20 }, sourceUuid: 'Actor.own' } };
    assert.equal(safeAutoApply('applyActorUpdate', f, ownsOnly('Actor.own')), false);
    const f2 = { actorUpdate: { uuid: 'Actor.someoneElse', monitor: { track: 'stun', boxes: -20 } } };
    assert.equal(safeAutoApply('applyActorUpdate', f2, ownsOnly('Actor.own')), false);
    // The author's own actor still applies by itself.
    assert.equal(safeAutoApply('applyActorUpdate', f2, ownsOnly('Actor.someoneElse')), true);
  });

  test('R2-SEC-2 (Q2): flags edited during the first auto-applied action never reach the second', async () => {
    // v0.81.1 round 2 (FIX2-BRIEF B): site and host changes no longer apply by themselves, so the two kinds here are
    // ones that still do (a sensor lock for the author's own vehicle, boxes on the author's own actor).
    await setup();
    const own = actor('own', ['p1']);
    actor('van9', ['p1'], { type: 'vehicle' });
    const flags: any = {
      sensorLocks: { vehicleUuid: 'Actor.van9', targetUuid: 'Actor.x', targetName: 'X', successes: 2, sourceUuid: own.uuid },
      actorUpdate: { uuid: own.uuid, monitor: { track: 'stun', boxes: -1 } },
    };
    const updates: any[] = [];
    g.CONFIG.Actor.documentClass = {
      applySensorLock: async () => {
        flags.actorUpdate = { uuid: 'Actor.someoneElse', monitor: { track: 'physical', boxes: 20 } };
        return true;
      },
      applyActorUpdate: async (change: any) => { updates.push(change); return true; },
    };
    g.game.user = GM;
    const msg = message(P1, flags, { content: '<button data-sr2e-action="applyLocks"></button><button data-sr2e-action="applyActorUpdate"></button>' });
    confirms.length = 0;
    for (const f of hooks['createChatMessage'] ?? []) f(msg);
    await tick(400);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0], { uuid: own.uuid, monitor: { track: 'stun', boxes: -1 } }, 'the vetted copy, not the edited flags');
    assert.equal(confirms.length, 0);
  });


  test('R2-SEC-1 (Q3): Create spirit drops the card\'s projects and other flags, and the GM confirms it', async () => {
    const { spiritCreateData } = await setup();
    const projects = { x: { id: 'x', kind: 'x', area: 'magic', startedAt: 0, readyAt: 0, hours: 0, paid: { karma: 0, nuyen: 0 }, label: 'x', effect: { call: { method: 'refundModPayer', args: ['Actor.own3', 10000000, 'x'] } } } };
    const r = spiritCreateData({ name: 'Mote', type: 'spirit', system: {}, flags: { sr2e: { projects, familiar: { allyUuid: 'x' }, allyRitual: true }, core: { sheetClass: 'x' } },
      items: [{ name: 'P', type: 'power', flags: { sr2e: { projects } }, effects: [{ name: 'e', changes: [{ key: 'flags.sr2e.projects', mode: 5, value: '{}' }, { key: 'system.attributes.body.mod', mode: 2, value: '1' }] }] }],
      prototypeToken: { name: 'x', flags: { sr2e: { a: 1 } } } });
    assert.deepEqual(r.data.flags, { sr2e: { allyRitual: true } });
    assert.equal(r.data.items[0].flags, undefined);
    assert.deepEqual(r.data.items[0].effects[0].changes, [{ key: 'system.attributes.body.mod', mode: 2, value: '1' }]);
    assert.equal(r.data.prototypeToken.flags, undefined);

    const made: any[] = [];
    g.Actor = { implementation: { create: async (d: any) => { made.push(d); return { uuid: 'Actor.new', name: d.name, system: d.system }; } } };
    actor('own3', ['p1']);
    g.game.user = GM; confirms.length = 0; confirmAnswer = false;
    press(message(P1, { pendingSpirit: { name: 'Mote', type: 'spirit', system: {}, flags: { sr2e: { projects } } } }, { speaker: { actor: 'own3' } }), 'createSpirit');
    await tick();
    assert.equal(made.length, 0, 'declined: nothing created');
    assert.equal(confirms.length, 1);
    assert.match(confirms[0].content, /Mote/);
    assert.match(confirms[0].content, /owned by the GM only/);
    confirmAnswer = true;
    press(message(P1, { pendingSpirit: { name: 'Mote', type: 'spirit', system: {}, flags: { sr2e: { projects } } } }, { speaker: { actor: 'own3' } }), 'createSpirit');
    await tick();
    assert.equal(made.length, 1);
    assert.equal(made[0].flags?.sr2e?.projects, undefined);
  });

  test('R2-SEC-5 (Q4): a healer\'s URR Magic loss card for another player\'s patient: the patient\'s owner and the GM can roll it (after a confirm)', async () => {
    await setup();
    let rolled = 0;
    actor('patient4', ['p2'], { system: { magic: 5 }, rollMagicLoss: async () => { rolled++; } });
    actor('healer4', ['p1'], { name: 'Doc' });
    const card = () => message(P1, { magicLossFor: 'Actor.patient4', magicLossBy: 'Actor.healer4' }, { speaker: { actor: 'patient4' } });
    confirms.length = 0; confirmAnswer = true;
    g.game.user = P2; press(card(), 'magicLoss'); await tick();
    g.game.user = GM; press(card(), 'magicLoss'); await tick();
    assert.equal(rolled, 2);
    assert.equal(confirms.length, 2);
    assert.match(confirms[0].content, /Player One/);
    assert.match(confirms[0].content, /Magic loss/);
    assert.match(confirms[0].content, /Doc/);
  });

  test('R2-SEC-7 (Q5): a card by P1 (speaker = P1\'s character) about P2\'s character asks P2 first; declined, nothing is rolled', async () => {
    await setup();
    actor('own5', ['p1']);
    let rolled = 0; const tox: any[] = [];
    actor('mage5', ['p2'], { system: { magic: 6 }, rollMagicLoss: async () => { rolled++; }, resistToxin: async (t: any) => { tox.push(t); } });
    g.game.user = P2; confirms.length = 0; confirmAnswer = false;
    press(message(P1, { magicLossFor: 'Actor.mage5' }, { speaker: { actor: 'own5' } }), 'magicLoss'); await tick();
    press(message(P1, { toxinHit: { targetUuid: 'Actor.mage5', toxin: { name: 'X', power: 99, level: 'D', damageType: 'physical', vector: 'injection' } } }, { speaker: { actor: 'own5' } }), 'toxinHit'); await tick();
    assert.equal(rolled, 0, 'Magic loss (permanent) asks P2, who declines');
    // v0.81.1 (design 2): the speaker is no real source, so this toxin hit (no test of P1's behind it) asks P2 too
    // (v0.81.0 let it through on the speaker alone).
    assert.equal(tox.length, 0);
    assert.equal(confirms.length, 2);
    assert.match(confirms[0].content, /Player One/);
    g.game.user = GM; confirmAnswer = true;
  });

  test('R2-SEC-8: onToxinHit and onInfection bound the toxin\'s Power and level (Q5 input, accepted)', async () => {
    await setup();
    actor('own8', ['p1']);
    const tox: any[] = [];
    actor('vic8', ['p2'], { resistToxin: async (t: any) => { tox.push(t); } });
    g.game.user = P2; confirmAnswer = true;
    press(message(P1, { toxinHit: { targetUuid: 'Actor.vic8', toxin: { name: 'X', power: 99, level: 'Q', damageType: 'physical', vector: 'injection' } } }, { speaker: { actor: 'own8' } }), 'toxinHit'); await tick();
    press(message(P1, { infection: { targetUuid: 'Actor.vic8', toxin: { name: 'Y', power: 500, level: 'D' } } }, { speaker: { actor: 'own8' } }), 'infection'); await tick();
    g.game.user = GM;
    assert.equal(tox.length, 2);
    assert.equal(tox[0].power, 60); assert.equal(tox[0].level, 'L');
    assert.equal(tox[1].power, 60); assert.equal(tox[1].kind, 'disease');
  });

  test('R2-SEC-8: a knockdown card\'s level is bounded', async () => {
    await setup();
    const got: any[] = [];
    actor('kd', ['p1'], { rollKnockdown: async (tn: number, lvl: any) => { got.push([tn, lvl]); } });
    g.game.user = P1;
    press(message(P1, { knockdown: { actorUuid: 'Actor.kd', tn: 99, level: '<x>' } }), 'knockdown'); await tick();
    g.game.user = GM;
    assert.deepEqual(got, [[30, 'L']]);
  });

  test('R2-SEC-3 (Q7): a gunner\'s turret card turns the turret; one from an unrelated player doesn\'t', async () => {
    await setup();
    let upd = 0;
    actor('gunner7', ['p1']);
    const van = { type: 'vehicle', uuid: 'Actor.van', system: { occupants: ['Actor.gunner7'], controllerUuid: '' } };
    docs.set('Actor.van.Item.gun', { uuid: 'Actor.van.Item.gun', parent: van, system: { mount: 'turret' }, ownership: { gm: 3 }, testUserPermission: (u: any) => u.isGM, update: async () => { upd++; } });
    g.game.user = GM;
    for (const f of hooks['createChatMessage'] ?? []) f(message(P2, { turretFacing: { weaponUuid: 'Actor.van.Item.gun', facing: 90 } }));
    await tick();
    assert.equal(upd, 0, 'P2 owns no one aboard');
    for (const f of hooks['createChatMessage'] ?? []) f(message(P1, { turretFacing: { weaponUuid: 'Actor.van.Item.gun', facing: 90 } }));
    await tick();
    assert.equal(upd, 1);
    // The reviewer's exact input (a weapon on no vehicle): still not applied.
    docs.set('Actor.x.Item.gun', { uuid: 'Actor.x.Item.gun', ownership: { gm: 3 }, testUserPermission: (u: any) => u.isGM, update: async () => { upd++; } });
    for (const f of hooks['createChatMessage'] ?? []) f(message(P1, { turretFacing: { weaponUuid: 'Actor.x.Item.gun', facing: 90 } }));
    await tick();
    assert.equal(upd, 1);
  });

  test('R2-SEC-4 (Q8): the GM takes a bug off from a player\'s sweep card (after a confirm naming it)', async () => {
    await setup();
    let removed = 0;
    g.CONFIG.Actor.documentClass = { removeBug: async () => { removed++; return true; } };
    docs.set('Actor.npc.Item.bug', { uuid: 'Actor.npc.Item.bug', name: 'Fly', system: { surveillance: { plantedOn: 'Actor.bob', plantedName: 'Bob' } }, ownership: { gm: 3 }, testUserPermission: (u: any) => u.isGM });
    g.game.user = GM; confirms.length = 0; confirmAnswer = true;
    press(message(P1, {}), 'removeBug', { bugUuid: 'Actor.npc.Item.bug' }); await tick();
    assert.equal(removed, 1);
    assert.equal(confirms.length, 1);
    assert.match(confirms[0].content, /Fly is taken off Bob/);
    // Planted on the author's own character: no confirm needed.
    actor('mine8', ['p1']);
    docs.set('Actor.npc.Item.bug2', { uuid: 'Actor.npc.Item.bug2', name: 'Fly', system: { surveillance: { plantedOn: 'Actor.mine8' } }, ownership: { gm: 3 }, testUserPermission: (u: any) => u.isGM });
    press(message(P1, {}), 'removeBug', { bugUuid: 'Actor.npc.Item.bug2' }); await tick();
    assert.equal(removed, 2);
    assert.equal(confirms.length, 1);
  });

  test('R2-SEC-11: the confirmation names the patient and boxes, the surgery item, the effect bundle; host keys in words', () => {
    const nameOf = (u: string) => ({ 'Actor.doc': 'Doc', 'Actor.bob': 'Bob' } as Record<string, string>)[u] ?? '';
    const heal = describeGmChange('applyHeal', { healApply: { healerUuid: 'Actor.doc', snap: { successes: 4, heal: { targetUuid: 'Actor.bob', track: 'physical', mode: 'firstAid', before: 6 } } } }, nameOf).join(' | ');
    assert.match(heal, /of Bob/); assert.match(heal, /6 boxes/); assert.match(heal, /4 successes/);
    const surg = describeGmChange('applySurgery', { surgeryApply: { surgeonUuid: 'Actor.doc', snap: { successes: 3, surgery: { patientUuid: 'Actor.bob', itemName: 'Wired Reflexes', points: 2 } } } }, nameOf).join(' | ');
    assert.match(surg, /Wired Reflexes/); assert.match(surg, /on Bob/); assert.match(surg, /3 successes/);
    const fx = describeGmChange('applyPowerEffect', { powerEffect: { targetUuid: 'Actor.bob', effect: { name: 'Mana Barrier', attributes: { quickness: -6 } } } }, nameOf).join(' | ');
    assert.match(fx, /Quickness −6|Quickness -6/);
    const host = describeGmChange('applyHost', { hostChange: { hostUuid: 'Actor.h', removeFile: 'f1', addFile: { name: 'Paydata', value: 5000 } } }, nameOf).join(' | ');
    assert.match(host, /file f1 DELETED/); assert.match(host, /"Paydata" uploaded/);
    assert.doesNotMatch(host, /\{/);
  });

  test('R2-SEC-11: a power effect outside the fxEntry shape is refused', () => {
    const ok = { targetUuid: 'Actor.b', effect: { id: 'e', name: 'Guard', attributes: { body: 1 }, attackedTn: 2, kind: 'spell', successes: 3 } };
    assert.equal(gmApplyShapeOk('applyPowerEffect', { powerEffect: ok }), true);
    assert.equal(gmApplyShapeOk('applyPowerEffect', { powerEffect: { ...ok, effect: { ...ok.effect, attributes: { quickness: -99 } } } }), false);
    assert.equal(gmApplyShapeOk('applyPowerEffect', { powerEffect: { ...ok, effect: { ...ok.effect, ownership: { p1: 3 } } } }), false);
    assert.equal(gmApplyShapeOk('applyPowerEffect', { powerEffect: { ...ok, effect: { ...ok.effect, spec: { attributes: { body: 500 } } } } }), false);
    assert.equal(gmApplyShapeOk('applyPowerEffect', { powerEffect: { targetUuid: 'Actor.b', effect: null, removeId: 'e' } }), true);
  });

  test('R2-SEC-10: a blast from a flag falls off at least as fast as the gentlest RULES kind', async () => {
    const { boundBlast } = await setup();
    const { RULES } = await import('../rules/index.ts');
    const gentlest = Math.min(...(RULES.COMBAT.grenades as any[]).map((g) => Number(g.perMetre)).filter((n) => n > 0));
    assert.equal(boundBlast({ power: 200, perMetre: 0 }).perMetre, gentlest);
    assert.ok(gentlest > 0);
    // v0.92.4: with the anti-vehicle rocket's old falloff on (COMBAT_V923.avRocket 'old'), its 0.25 is allowed again.
    const was = (RULES as any).COMBAT_V923.avRocket;
    (RULES as any).COMBAT_V923.avRocket = 'old';
    try { assert.equal(boundBlast({ power: 200, perMetre: 0 }).perMetre, 0.25); } finally { (RULES as any).COMBAT_V923.avRocket = was; }
  });

  test('R2-SEC-7: Resist all on a player\'s card says who posted it; auto-resist skips a player\'s card', async () => {
    await setup();
    prompts.length = 0;
    actor('npc9', [], { type: 'npc' });
    g.game.user = GM;
    const root = new El();
    const msg = message(P1, { damages: [{ targetUuid: 'Actor.npc9', power: 6, level: 'M', damageType: 'physical' }, { targetUuid: 'Actor.npc9', power: 4, level: 'L', damageType: 'physical' }] });
    // the GM tool button only works when decorateCard built it: call the handler through a built one.
    render(msg, root);
    const tool = root.all().find((e) => e.dataset['sr2eAction'] === 'resistAll');
    assert.ok(tool, 'decorateCard built Resist all');
    tool!.click(); await tick();
    assert.match(prompts.at(-1)?.content ?? '', /Posted by <strong>Player One<\/strong>/);
    let resisted = 0;
    actor('npc10', [], { type: 'npc', resistFromState: async () => { resisted++; } });
    const card = message(P1, { damage: { targetUuid: 'Actor.npc10', power: 6, level: 'M' } }, { content: '<button data-sr2e-action="resist"></button>' });
    for (const f of hooks['createChatMessage'] ?? []) f(card);
    await tick(350);
    assert.equal(resisted, 0);
  });

  test('R2-SEC-14: author names are escaped in the warnings', async () => {
    await setup();
    const mine = actor('mine14', ['p2']);
    mine.usePower = async () => {};
    docs.set('Item.pow14', { parent: mine });
    g.game.user = P2;
    press(message({ id: 'p9', name: '<b>Eve</b>', isGM: false }, { repeat: { powerUuid: 'Item.pow14', targetUuids: [] } }), 'repeatPower'); await tick();
    g.game.user = GM;
    assert.match(warnings.at(-1) ?? '', /&lt;b&gt;Eve/);
  });
});
