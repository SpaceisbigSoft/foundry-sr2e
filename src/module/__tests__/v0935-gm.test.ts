/**
 * v0.93.5 ("interface polish"), Agent C: the GM windows. The GM panel's six tabs (old tab ids still open the right
 * place), the party view for players (only what the user may see), progress bars on long jobs (throttled), and the
 * Spend Karma window with no Good Karma (one banner, disabled buttons with their reason).
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  GM_PANEL_TABS, GM_PANEL_VIEWS, gmViewFor, gmFocusFor, coarseWound, partyAccess, partyRow, monitorTextOf, spendRow, progressState, progressThrottle, OWNERSHIP,
  type PartyFacts,
} from '../rules/gm935.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const tpl = (f: string) => read('public', 'templates', f);
const src = (f: string) => read('src', 'module', 'applications', f);
/** The new strings, until the lead merges them into lang/en.json (then that file has them and this adds nothing). */
const DRAFT = '/home/claude/work/strings-C.json';
const draft = (): Record<string, string> => (existsSync(DRAFT) ? JSON.parse(readFileSync(DRAFT, 'utf8')) : {});
const balanced = (s: string) => (s.match(/\{\{#(if|each|unless|with)\b/g) ?? []).length === (s.match(/\{\{\/(if|each|unless|with)\}\}/g) ?? []).length;

before(() => {
  const en = (globalThis as any).__SR2E_EN__ ?? ((globalThis as any).__SR2E_EN__ = {});
  for (const [k, v] of Object.entries(draft())) if (!(k in en)) en[k] = v;
});

describe('v0.93.5 the GM panel: six tabs, the rest in the top row', () => {
  const ui = src('ui.ts');
  const gm = tpl('gm-panel.hbs');

  test('six tabs; History (log) and Setup are views; every old id maps to its new home', () => {
    assert.deepEqual([...GM_PANEL_TABS], ['scene', 'combat', 'party', 'npcs', 'world', 'requests']);
    assert.deepEqual([...GM_PANEL_VIEWS], ['log', 'setup']);
    for (const id of [...GM_PANEL_TABS, ...GM_PANEL_VIEWS]) assert.equal(gmViewFor(id), id);
    assert.equal(gmViewFor('tools'), 'npcs', 'the old Tools tab: its calculator and NPC generator are on the NPCs tab');
    assert.equal(gmFocusFor('tools'), 'calc');
    assert.equal(gmViewFor('history'), 'log');
    assert.equal(gmViewFor('nonsense'), 'scene');
    assert.equal(gmViewFor(undefined), 'scene');
    assert.equal(gmViewFor('__proto__'), 'scene');
  });

  test('every tab id the other files set still opens a real place (tools.ts, tours, the checklist)', () => {
    const ids = new Set<string>();
    for (const m of src('tools.ts').matchAll(/gmPanelAt\('(\w+)'\)/g)) ids.add(m[1]!);
    for (const m of src('tours.ts').matchAll(/gmTab: '(\w+)'/g)) ids.add(m[1]!);
    for (const m of read('src', 'module', 'rules', 'setup.ts').matchAll(/'tab:(\w+)'/g)) ids.add(m[1]!);
    assert.ok(ids.has('tools') && ids.has('log') && ids.has('setup') && ids.has('requests'), [...ids].join());
    for (const id of ids) {
      const v = gmViewFor(id);
      assert.ok(v !== 'scene' || id === 'scene', `${id} fell back to the Scene tab`);
      assert.ok(id === v || id === 'tools', `${id} → ${v}`);
    }
  });

  test('ui.ts: GM_TABS has six tabs, GM_VIEWS the top row, the tab setter maps names, open(tab) takes a name', () => {
    const tabs = ui.slice(ui.indexOf('static GM_TABS = ['), ui.indexOf('];', ui.indexOf('static GM_TABS = [')));
    assert.deepEqual([...tabs.matchAll(/id: '(\w+)'/g)].map((m) => m[1]), [...GM_PANEL_TABS]);
    const views = ui.slice(ui.indexOf('static GM_VIEWS = ['), ui.indexOf('];', ui.indexOf('static GM_VIEWS = [')));
    assert.deepEqual([...views.matchAll(/id: '(\w+)'/g)].map((m) => m[1]), ['log', 'setup', 'tools']);
    assert.match(views, /action: 'gmTools'/);
    assert.match(ui, /static set tab\(v: string\) \{ SR2GmPanel\.#tab = gmViewFor\(v\);/);
    assert.match(ui, /static open\(tab\?: string\): SR2GmPanel \| null \{/);
    assert.match(ui, /gmTools: \(\) => \{ void \(game as any\)\.sr2e\?\.api\?\.openTools\?\.\(\); \}/);
    assert.match(read('src', 'module', 'sr2e-system.ts'), /gmPanel: \(tab\?: string\) => SR2GmPanel\.open\(tab\)/);
  });

  test('gm-panel.hbs: no Tools tab; the calculator and NPC generator on the NPCs tab; History and Setup still render', () => {
    assert.ok(balanced(gm));
    assert.ok(!gm.includes('{{#if tab.tools}}'));
    const npcs = gm.slice(gm.indexOf('{{#if tab.npcs}}'), gm.indexOf('{{#if tab.world}}'));
    assert.match(npcs, /data-gm-focus="calc"[\s\S]*data-calc="dice"[\s\S]*data-action="calcRoll"/);
    assert.match(npcs, /data-gm-focus="npcgen"[\s\S]*data-action="npcGenerator"/);
    assert.ok(gm.includes('{{#if tab.log}}') && gm.includes('{{#if tab.setup}}') && gm.includes('{{#if tab.requests}}'));
    // The top row's buttons are not tabs (a11y.ts makes gmTab links a tablist).
    const bar = gm.slice(gm.indexOf('sr2e-gm-undobar'), gm.indexOf('{{#if tab.scene}}'));
    assert.match(bar, /\{\{#each views\}\}<button type="button" data-action="\{\{action\}\}" data-tab="\{\{id\}\}"/);
    assert.ok(!bar.includes('gmTab'));
    assert.match(gm, /\{\{#each tabs\}\}<a data-action="gmTab"[^>]*>.*\{\{#if count\}\} <span class="sr2e-badge">\{\{count\}\}<\/span>/, 'Requests keeps its count');
  });
});

describe('v0.93.5 the party view: what each user may see', () => {
  const facts: PartyFacts = {
    uuid: 'Actor.a', name: 'Runner', img: 'r.webp', player: 'Pat', physical: 7, stun: 2, status: 'ok',
    monitorText: 'P 7/10 (S) · S 2/10', wound: 2, pools: 'Combat 3/7', initiative: 14, acting: true, statusText: '',
  };

  test('coarse wound states', () => {
    assert.equal(coarseWound(0, 0), 'unhurt');
    assert.equal(coarseWound(1, 0), 'hurt');
    assert.equal(coarseWound(0, 5), 'hurt');
    assert.equal(coarseWound(6, 0), 'badly');
    assert.equal(coarseWound(0, 10), 'down');
    assert.equal(coarseWound(12, 0), 'down');
    assert.equal(coarseWound(2, 2, 'unconscious'), 'down');
    assert.equal(coarseWound('x', -3), 'unhurt');
  });

  test('access: GM and owner in full, Limited/Observer coarse only with the setting, below Limited not listed', () => {
    assert.deepEqual(partyAccess({ isGM: true, level: 0, woundsSetting: false }), { listed: true, full: true, coarse: false });
    assert.deepEqual(partyAccess({ isGM: false, level: OWNERSHIP.OWNER, woundsSetting: false }), { listed: true, full: true, coarse: false });
    for (const level of [OWNERSHIP.LIMITED, OWNERSHIP.OBSERVER]) {
      assert.deepEqual(partyAccess({ isGM: false, level, woundsSetting: true }), { listed: true, full: false, coarse: true });
      assert.deepEqual(partyAccess({ isGM: false, level, woundsSetting: false }), { listed: true, full: false, coarse: false });
    }
    assert.equal(partyAccess({ isGM: false, level: OWNERSHIP.NONE, woundsSetting: true }).listed, false);
  });

  test('rows carry only what the user may see', () => {
    const full = partyRow(facts, partyAccess({ isGM: false, level: 3, woundsSetting: true }), { canOpen: true })!;
    assert.equal(full.kind, 'full');
    assert.ok(full.kind === 'full' && full.monitorText === facts.monitorText && full.woundText === '+2 TN' && full.initiative === 14 && full.hurt);
    const coarse = partyRow(facts, partyAccess({ isGM: false, level: 2, woundsSetting: true }), { canOpen: true })!;
    assert.deepEqual(Object.keys(coarse).sort(), ['canOpen', 'img', 'kind', 'name', 'player', 'uuid', 'wound']);
    assert.ok(coarse.kind === 'coarse' && coarse.wound === 'badly');
    const name = partyRow(facts, partyAccess({ isGM: false, level: 1, woundsSetting: false }), { canOpen: false })!;
    assert.deepEqual(Object.keys(name).sort(), ['canOpen', 'img', 'kind', 'name', 'player', 'uuid']);
    for (const r of [coarse, name]) for (const k of ['monitorText', 'pools', 'initiative', 'woundText', 'statusText', 'physical', 'stun']) assert.ok(!(k in r), `${r.kind} has ${k}`);
    assert.equal(partyRow(facts, partyAccess({ isGM: false, level: 0, woundsSetting: true }), { canOpen: false }), null);
  });

  test('the monitor as text, as the status strip shows it', () => {
    const cm = { tracks: [{ short: 'P', filled: 10, boxes: 10, reached: 'D' }, { short: 'S', filled: 0, boxes: 10, reached: '' }], overflow: { filled: 2, body: 5, idle: false } };
    assert.equal(monitorTextOf(cm, 'OF'), 'P 10/10 (D) · S 0/10 · OF 2/5');
    assert.equal(monitorTextOf({ ...cm, overflow: { filled: 0, body: 5, idle: true } }), 'P 10/10 (D) · S 0/10');
  });

  test('the window, with stub Foundry: a player sees their own in full, an observed member coarse, an unseen one not at all', async () => {
    const g = globalThis as any;
    const prev = { foundry: g.foundry, game: g.game, Hooks: g.Hooks, canvas: g.canvas };
    g.foundry = { ...(g.foundry ?? {}), applications: { ...(g.foundry?.applications ?? {}), api: { ...(g.foundry?.applications?.api ?? {}), HandlebarsApplicationMixin: (B: any) => B, ApplicationV2: class { constructor(_o?: any) {} } } } };
    const me = { id: 'u1', name: 'Pat', isGM: false, character: null as any };
    const lvl = (map: Record<string, number>) => (u: any) => map[u.id] ?? 0;
    const actor = (id: string, levels: Record<string, number>, p: number) => ({
      id, uuid: `Actor.${id}`, name: id, img: `${id}.webp`, type: 'character', hasPlayerOwner: true,
      system: { monitor: { physical: p, stun: 0 }, derived: { status: 'ok', woundModifier: p ? 1 : 0, combatPool: 6, combatPoolLeft: 4 }, attributes: { body: { total: 4 } }, karma: { pool: 0 } },
      getUserLevel: lvl(levels), testUserPermission: (u: any, n: string) => (levels[u.id] ?? 0) >= ({ OWNER: 3, OBSERVER: 2, LIMITED: 1 } as any)[n],
    });
    const mine = actor('Mine', { u1: 3 }, 3), seen = actor('Seen', { u1: 2, u2: 3 }, 7), hidden = actor('Hidden', { u2: 3 }, 1);
    let woundsOn = true;
    g.game = { user: me, users: [me, { id: 'u2', name: 'Sam', isGM: false }], actors: [mine, seen, hidden], combat: null, settings: { get: () => woundsOn }, i18n: { localize: (k: string) => k, format: (k: string) => k } };
    g.Hooks = { on: () => 0 };
    try {
      const { SR2PartyView, userLevel } = await import('../applications/party.ts');
      assert.equal(userLevel(seen, me), 2);
      const ctx = await (new (SR2PartyView as any)() as any)._prepareContext({});
      assert.deepEqual(ctx.rows.map((r: any) => r.name), ['Mine', 'Seen']);
      const [a, b] = ctx.rows;
      assert.ok(a.full && /^P 3\/10/.test(a.monitorText) && a.pools.includes('Combat 4/6') && a.canOpen);
      assert.ok(b.coarse && b.wound === 'badly' && b.woundText === 'Badly hurt' && b.canOpen);
      assert.ok(!('monitorText' in b) && !('pools' in b));
      woundsOn = false;
      const ctx2 = await (new (SR2PartyView as any)() as any)._prepareContext({});
      assert.ok(!ctx2.rows[1].coarse && !('wound' in ctx2.rows[1]));
      // The GM sees everyone in full.
      g.game.user = { id: 'gm', isGM: true };
      const ctx3 = await (new (SR2PartyView as any)() as any)._prepareContext({});
      assert.equal(ctx3.rows.length, 3);
      assert.ok(ctx3.rows.every((r: any) => r.full));
    } finally { Object.assign(g, prev); }
  });

  test('party.ts: read-only, opened three ways, the sheet only when observed, no innerHTML', () => {
    const p = src('party.ts');
    assert.ok(!/\.update\(|\.delete\(|createEmbedded|innerHTML/.test(p), 'changes nothing, builds no HTML strings');
    assert.match(p, /userLevel\(a, user\) >= OWNERSHIP\.OBSERVER/);
    assert.match(p, /key: 'KeyP', modifiers: \['Alt'\]/);
    assert.match(p, /'renderActorDirectory'/);
    const sys = read('src', 'module', 'sr2e-system.ts');
    assert.match(sys, /partyView: \(\) => SR2PartyView\.open\(\)/);
    assert.match(sys, /registerPartyView\(\);/);
    assert.match(read('src', 'module', 'settings.ts'), /register\(SYSTEM\.id, "partyWounds", \{[\s\S]*?scope: "world", config: true, type: Boolean, default: true/);
    const t = tpl('party-view.hbs');
    assert.ok(balanced(t));
    assert.ok(!t.includes('{{{'), 'everything escaped');
    assert.match(t, /\{\{#if canOpen\}\}<a class="sr2e-pv-name" data-action="pvOpen"/);
  });
});

describe('v0.93.5 progress on long jobs', () => {
  test('state and throttle: at most one draw every 100 ms, the last always', () => {
    assert.deepEqual(progressState(3, 12), { done: 3, total: 12, pct: 0.25 });
    assert.deepEqual(progressState(20, 0), { done: 1, total: 1, pct: 1 });
    const th = progressThrottle(100);
    assert.equal(th.due(0, 1, 10), true);
    assert.equal(th.due(50, 2, 10), false);
    assert.equal(th.due(100, 3, 10), true);
    assert.equal(th.due(120, 10, 10), true, 'the end');
  });

  test('startProgress: Foundry\'s progress notification with "n of N", throttled, removed at the end', async () => {
    const g = globalThis as any;
    const prev = g.ui;
    const updates: any[] = [];
    let removed = 0;
    g.ui = { notifications: { info: (_m: string, o: any) => (o?.progress ? { update: (u: any) => updates.push(u) } : null), remove: () => { removed++; } } };
    try {
      const { startProgress, progressText } = await import('../applications/progress.ts');
      assert.equal(progressText('Building the scene', 3, 12), 'Building the scene 3 of 12');
      const pr = startProgress('Job', 1000, { minMs: 1e9 });
      for (let i = 0; i < 999; i++) pr.tick();
      assert.ok(updates.length <= 1, `${updates.length} updates for 999 steps`);
      pr.done();
      assert.equal(updates.at(-1).pct, 1);
      assert.equal(updates.at(-1).message, 'Job 1000 of 1000');
      assert.equal(removed, 1);
    } finally { g.ui = prev; }
  });

  test('wired into the catalogue load and the scene builder (with a bar in the builder window)', () => {
    const cat = src('catalogue.ts');
    assert.match(cat, /startProgress\(tx\('SR2E\.Notify\.Catalogue\.loadingTheCatalogue'\), catalogueLoadSteps\(parsed, r\.fill\)\)/);
    assert.match(cat, /finally \{ progress\.done\(\); \}/);
    assert.match(cat, /progress\?\.tick\(undefined, chunk\.length\)/);
    const sb = src('scenebuilder.ts');
    assert.equal((sb.match(/pr\?\.tick\(\);/g) ?? []).length, 11, 'nine fixed steps and one per people row (two places)');
    assert.match(sb, /return 9 \+ \(spec\.people\?\.length \?\? 0\);/);
    assert.match(tpl('scene-builder.hbs'), /<div class="sr2e-progress" data-sr2e-progress role="status" hidden><progress max="1" value="0" aria-label="\{\{sr2eT "SR2E\.SceneBuilder\.progress"\}\}"><\/progress> <span data-sr2e-progress-text><\/span><\/div>/);
  });
});

describe('v0.93.5 Spend Karma with no Good Karma', () => {
  const needs = (c: number, g: number) => `needs ${c}, has ${g}`;
  test('one banner instead of "needs N, has 0" on every row; other reasons stay; the tooltip always has the reason', () => {
    assert.deepEqual(spendRow({ ok: true, cost: 10 }, 0, needs), { afford: false, why: 'needs 10, has 0', hint: '' });
    assert.deepEqual(spendRow({ ok: true, cost: 10 }, 4, needs), { afford: false, why: 'needs 10, has 4', hint: 'needs 10, has 4' });
    assert.deepEqual(spendRow({ ok: false, cost: 0, reason: 'at its maximum' }, 0, needs), { afford: false, why: 'at its maximum', hint: 'at its maximum' });
    assert.deepEqual(spendRow({ ok: true, cost: 3 }, 4, needs), { afford: true, why: '', hint: '' });
  });
  test('the template: the banner, and a disabled button with its reason as a Foundry tooltip on every kind of row', () => {
    const t = tpl('spend-karma.hbs');
    assert.ok(balanced(t));
    assert.match(t, /\{\{#if broke\}\}<p class="sr2e-spend-broke" role="status">.*\{\{sr2eT "SR2E\.UI\.spendKarmaBroke"\}\}/);
    assert.equal((t.match(/<span class="sr2e-spend-off" data-tooltip="\{\{(raise\.|spec\.|conc\.)?why\}\}"><button type="button" disabled/g) ?? []).length, 5);
    assert.ok(!/<span class="hint">\{\{(raise\.|spec\.|conc\.)?why\}\}<\/span>/.test(t), 'the old per-row text is gone');
    assert.match(src('spendkarma.ts'), /broke: good <= 0/);
  });
});
