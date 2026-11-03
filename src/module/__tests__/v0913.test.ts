/**
 * v0.91.3: the Catalogue (rules/codex.ts, applications/codex.ts): a window to browse everything you can get, a page per
 * entry, linked from the shop's rows.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CODEX_TYPES, isCodexType, codexStats, codexKind, codexTarget, RULES, BOUGHT_TYPES } from '../rules/index.ts';
import { TOOLS } from '../rules/tools.ts';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const lang = JSON.parse(read('public', 'lang', 'en.json'));
const keyIn = (k: string) => k.split('.').reduce((o: any, p) => o?.[p], lang) !== undefined;
const stat = (type: string, s: any) => Object.fromEntries(codexStats(type, s).map((x) => [x.id, x.yes ? 'yes' : x.value]));

describe('v0.91.3 the Catalogue: what it lists and what a page shows', () => {
  test('the tabs are everything a character can get: what is bought, spells and adept powers', () => {
    for (const t of BOUGHT_TYPES) assert.ok(isCodexType(t), t);
    assert.ok(isCodexType('spell') && isCodexType('adeptpower'));
    assert.ok(!isCodexType('skill') && !isCodexType('kit'));
    assert.ok(isCodexType('vehicle'), 'v0.91.4: vehicles and drones');
  });
  test('a weapon page: its codes written back the way a stat line has them', () => {
    assert.deepEqual(stat('weapon', { skill: 'Firearms', damagePower: 9, damageLevel: 'M', modes: 'SA', ammoMax: 15, feed: 'clip', range: { short: 5, medium: 20, long: 40, extreme: 60 }, concealability: 5, cost: 450, availability: '3/36 hrs' }),
      { skill: 'Firearms', shDamage: '9M', modes: 'SA', shAmmo: '15 (c)', shRange: '5/20/40/60', concealability: '5' });
    assert.deepEqual(stat('weapon', { melee: true, strengthPower: true, damagePower: 2, damageLevel: 'L', damageType: 'stun', reach: 1 }), { melee: 'yes', shDamage: '(STR+2)L Stun', reach: '1' });
  });
  test('spells, decks, bioware, adept powers', () => {
    assert.deepEqual(stat('spell', { category: 'combat', spellType: 'mana', duration: 'instant', damageLevel: 'S', drainLevel: 'D', drainModifier: 1 }),
      { category: 'combat', spellType: 'mana', duration: 'instant', shDamage: 'S', shDrain: '(F/2)+1D' });
    assert.equal(stat('cyberdeck', { mpcp: 6, bod: 3, evasion: 2, masking: 1, sensors: 0 }).shPersona, '3/2/1/0');
    assert.equal(codexKind('cyberware', { bioware: true }), 'bioware');
    assert.ok('bodyIndex' in stat('cyberware', { bioware: true, bodyIndex: 0.4 }));
    // An adept power's cost is power points, so it is a stat (not the price line).
    assert.equal(stat('adeptpower', { cost: 0.5 }).cost, '0.5');
    // The price line's fields are not repeated among the stats; blanks and zeros are left out.
    assert.deepEqual(stat('gear', { cost: 100, availability: '2/24 hrs', streetIndex: 1, legality: 'restricted', quantity: 0 }), {});
  });
  test('every built-in template has a page that reads without throwing; long text is cut', () => {
    for (const t of RULES.ITEM_TEMPLATES as any[]) if (isCodexType(t.type)) assert.doesNotThrow(() => codexStats(t.type, t.system), t.name);
    assert.ok(stat('weapon', { skill: 'x'.repeat(500) }).skill!.length <= 120);
  });
  test('a link asks only for a known tab and a short key', () => {
    assert.deepEqual(codexTarget({ type: 'spell', key: 'tpl:b:x' }), { type: 'spell', key: 'tpl:b:x' });
    assert.deepEqual(codexTarget({ type: 'skill', key: 5 }), { type: 'weapon', key: '' });
    assert.equal(codexTarget({ type: 'gear', key: 'k'.repeat(400) }).key, '');
  });
});

describe('v0.91.3 the window and its links', () => {
  const codex = read('src', 'module', 'applications', 'codex.ts');
  const shop = read('src', 'module', 'applications', 'shop.ts');
  const add = read('src', 'module', 'applications', 'adding.ts');
  const hbs = read('public', 'templates', 'codex.hbs');
  test('players see what their shop shows; a page is read through the user\'s own shop rules', () => {
    assert.match(codex, /\.filter\(\(e\) => entryShown\(e\)\)/);
    assert.match(codex, /const thing = await resolveCatalogueKey\(e\.key\);/);
    assert.match(shop, /export async function resolveCatalogueKey\(key: unknown, user: any = game\.user\): Promise<ShopThing \| null> \{\n  if \(shopSourceOf\(key\) === 'kit'\) return null;\n  return resolveKey\(key, user, CODEX_TYPES\);/);
    assert.match(shop, /return resolveKey\(key, user, BOUGHT_TYPES\);/);
  });
  test('the description is cleaned, enriched without secrets and cleaned again; nothing else is unescaped', () => {
    assert.match(codex, /cleanRichHtml\(await TE\.enrichHTML\(raw, \{ secrets: false,/);
    assert.match(codex, /const raw = withoutSecrets\(cleanRichHtml\(String\(\(thing\.type === 'vehicle' \? s\.notes : s\.description\) \?\? ''\)\)\);/);
    const triple = hbs.match(/\{\{\{[^}]+\}\}\}/g) ?? [];
    assert.deepEqual(triple, ['{{{page.description}}}']);
    assert.match(codex, /img: img \? safeImgSrc\(img\) : ''/);
  });
  test('the GM-only buttons check the GM again', () => {
    assert.match(codex, /if \(!page\?\.uuid \|\| !game\.user\?\.isGM\) return;/);
    assert.match(codex, /if \(!page\?\.markable \|\| !game\.user\?\.isGM\) return;/);
  });
  test('shop rows link to their page; Buy opens the shop at the entry', () => {
    assert.match(read('public', 'templates', 'add-window.hbs'), /\{\{#if codex\}\} <a class="sr2e-add-info" data-action="codexOpen" data-key="\{\{key\}\}"/);
    assert.match(add, /SR2Codex\.open\(\{ type: this\.type, key: t\.dataset\['key'\] \?\? '' \}\)/);
    assert.match(add, /if \(typeof o\.query === 'string'\) \{ w\.query = o\.query\.slice\(0, 100\); w\.groups\.clear\(\); \}/);
    assert.match(codex, /await openShop\(undefined, \{ type: page\.type, query: page\.name, shop: !learn, \.\.\.\(learn \? \{ payment: 'karma' as const \} : \{\}\) \}\);/);
    // Review B1: the link doesn't tick the row.
    assert.match(add, /if \(\(ev\.target as HTMLElement \| null\)\?\.closest\?\.\('\[data-action\]'\)\) return;/);
  });
  test('opened from the tools window, the toolbar, the shop and the API; the guide has a topic', () => {
    const tool = TOOLS.find((t) => t.id === 'catalogue');
    assert.ok(tool && tool.who === 'player' && tool.toolbar);
    assert.match(read('src', 'module', 'applications', 'tools.ts'), /catalogue: \(\) => \{ SR2Codex\.open\(\); \}/);
    assert.match(read('src', 'module', 'sr2e-system.ts'), /openCatalogue: \(o: \{ type\?: string; key\?: string \} = \{\}\) => SR2Codex\.open\(o\)/);
    for (const k of ['SR2E.Window.Codex.title', 'SR2E.Tools.catalogue.label', 'SR2E.Tools.catalogue.hint', 'SR2E.Guide.Topic.catalogue.title', 'SR2E.App.Codex.shown', 'SR2E.Notify.Codex.cannotHold']) assert.ok(keyIn(k), k);
    assert.match(read('src', 'module', 'rules', 'guide.ts'), /topic\('catalogue', 'both'/);
    assert.match(read('src', 'module', 'settings.ts'), /includes\?\.\("sr2e-codex"\)/);
  });
  test('every tab has an icon', () => {
    for (const t of CODEX_TYPES) assert.match(codex, new RegExp(`\\b${t}: 'fa-solid`), t);
  });
});

describe('v0.91.3 review (R6): a page is read only through the user\'s own shop rules', () => {
  const g: any = globalThis;
  const settings: Record<string, unknown> = { shopList: 'all', shopForbidden: false, itemTemplates: [], starterKits: [] };
  const setup = () => {
    g.game = { settings: { get: (_s: string, k: string) => settings[k] }, user: { isGM: false, id: 'p1' }, items: [], packs: [] };
    g.foundry = { utils: { deepClone: (x: any) => structuredClone(x) } };
  };
  const player = { isGM: false, id: 'p1' };
  const gm = { isGM: true, id: 'g1' };
  test('built-in, catalogue, marked, forbidden, kit and hidden-pack keys', async () => {
    setup();
    const { resolveCatalogueKey, resolveShopKey } = await import('../applications/shop.ts');
    const builtIn = (RULES.ITEM_TEMPLATES as any[]).find((t) => t.type === 'weapon');
    const spell = (RULES.ITEM_TEMPLATES as any[]).find((t) => t.type === 'spell');
    settings['itemTemplates'] = [
      { id: 'w1', type: 'weapon', name: 'ZZ Marked', system: { cost: 10 }, shop: true },
      { id: 'w2', type: 'weapon', name: 'ZZ Unmarked', system: { cost: 10 } },
      { id: 'w3', type: 'weapon', name: 'ZZ Forbidden', system: { cost: 10, legality: 'forbidden' }, shop: true },
    ];
    settings['shopList'] = 'all';
    assert.ok(await resolveCatalogueKey(`tpl:b:${builtIn.id}`, player));
    assert.ok(await resolveCatalogueKey(`tpl:b:${spell.id}`, player), 'spells: not on the shop list (learned)');
    assert.equal(await resolveShopKey(`tpl:b:${spell.id}`, player), null, 'the shop itself still sells no spells');
    assert.equal(await resolveCatalogueKey('tpl:w:w3', player), null, 'forbidden');
    assert.ok(await resolveCatalogueKey('tpl:w:w3', gm), 'the GM sees forbidden things');
    settings['shopList'] = 'catalogue';
    assert.equal(await resolveCatalogueKey(`tpl:b:${builtIn.id}`, player), null, 'catalogue only: no built-ins');
    assert.ok(await resolveCatalogueKey('tpl:w:w2', player));
    settings['shopList'] = 'marked';
    assert.equal(await resolveCatalogueKey('tpl:w:w2', player), null, 'marked only: an unmarked template');
    assert.ok(await resolveCatalogueKey('tpl:w:w1', player));
    settings['starterKits'] = [{ id: 'k1', name: 'Kit', lines: [{ type: 'weapon', name: 'x', system: {} }] }];
    assert.equal(await resolveCatalogueKey('kit:k1#0', gm), null, 'never a kit line');
    // A compendium item in a pack the player can't see.
    g.fromUuid = async () => ({ documentName: 'Item', type: 'weapon', name: 'ZZ Pack Gun', parent: null, inCompendium: true, flags: {},
      compendium: { metadata: {}, getUserLevel: () => 0, visible: false }, toObject: () => ({ name: 'ZZ Pack Gun', type: 'weapon', system: {} }) });
    g.game.items = { fromCompendium: (d: any) => d.toObject() };
    settings['shopList'] = 'all';
    assert.equal(await resolveCatalogueKey('pack:Compendium.x.y.Item.z', player), null, 'a hidden pack');
    assert.equal(await resolveCatalogueKey('nonsense', gm), null);
  });
});
