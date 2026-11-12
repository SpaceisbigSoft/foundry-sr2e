/**
 * v0.91.2: a tidier shop. The categories (rules/shopfilters.ts) and their wiring in the Add window.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shopGroupOf, shopGroupRank, passesGroups, SHOP_GROUPS, SHOP_GROUP_KEYS, RULES } from '../rules/index.ts';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const lang = JSON.parse(read('public', 'lang', 'en.json'));
const keyIn = (k: string) => k.split('.').reduce((o: any, p) => o?.[p], lang) !== undefined;

describe('v0.91.2 the shop categories', () => {
  test('weapons by what they are', () => {
    const g = (name: string, s: any) => shopGroupOf('weapon', name, s);
    assert.equal(g('Katana', { melee: true, skill: 'Edged Weapons' }), 'melee');
    assert.equal(g('Heavy pistol', { skill: 'Firearms', specialization: 'Pistols' }), 'pistol');
    assert.equal(g('Example Machine Pistol', { skill: 'Firearms' }), 'smg');
    assert.equal(g('Submachine gun', { skill: 'Firearms', specialization: 'SMGs' }), 'smg');
    assert.equal(g('AK-97', { skill: 'Firearms', specialization: 'Assault rifles' }), 'rifle');
    assert.equal(g('Example Sniper', { skill: 'Firearms', specialization: 'Rifles' }), 'rifle');
    assert.equal(g('Shotgun', { shotgun: true }), 'shotgun');
    assert.equal(g('Light machine gun', { skill: 'Gunnery', heavy: true }), 'heavy');
    assert.equal(g('Offensive Grenade', { blast: true, skill: 'Throwing Weapons' }), 'grenade');
    assert.equal(g('Example Launcher', { blast: true, skill: 'Launch Weapons' }), 'launcher');
    assert.equal(g('Shuriken', { skill: 'Throwing Weapons' }), 'thrown');
    assert.equal(g('Crossbow', { skill: 'Projectile Weapons' }), 'bow');
    assert.equal(g('Something', {}), 'otherWeapon');
  });
  test('armor, gear, ware, foci, programs, decks and spells', () => {
    assert.equal(shopGroupOf('armor', 'Riot shield', { parry: 1 }), 'shield');
    assert.equal(shopGroupOf('armor', 'Helmet', { adds: true }), 'helmet');
    assert.equal(shopGroupOf('armor', 'Forearm guards', { adds: true }), 'addon');
    assert.equal(shopGroupOf('armor', 'Armor jacket', {}), 'body');
    assert.equal(shopGroupOf('gear', 'Explosive rounds', { ammoType: 'ex' }), 'ammo');
    assert.equal(shopGroupOf('gear', 'Medkit', { medkitRating: 3 }), 'medical');
    assert.equal(shopGroupOf('gear', 'Low-light goggles', { optics: { lowLight: true } }), 'vision');
    assert.equal(shopGroupOf('gear', 'Pocket radio', { radio: { rating: 2 } }), 'electronics');
    assert.equal(shopGroupOf('gear', 'Rope', {}), 'survival');
    assert.equal(shopGroupOf('gear', 'Laser sight', {}), 'accessories');
    assert.equal(shopGroupOf('gear', 'Example Portacam', {}), 'media');
    assert.equal(shopGroupOf('gear', 'Fake SIN', {}), 'ids');
    assert.equal(shopGroupOf('gear', 'Anti-Vehicle Rocket', {}), 'ammo');
    assert.equal(shopGroupOf('gear', 'Something odd', {}), 'otherGear');
    assert.equal(shopGroupOf('cyberware', 'Muscle toner', { bioware: true }), 'bioware');
    assert.equal(shopGroupOf('cyberware', 'Cybereyes', { kind: 'eyes' }), 'headware');
    assert.equal(shopGroupOf('cyberware', 'Cyberarm', { kind: 'cyberlimb' }), 'limb');
    assert.equal(shopGroupOf('cyberware', 'Hand razors', { weapon: { damagePower: 1 } }), 'cyberweapon');
    assert.equal(shopGroupOf('cyberware', 'Wired reflexes', { kind: 'reflexes' }), 'bodyware');
    assert.equal(shopGroupOf('focus', 'x', { focusType: 'power' }), 'focusPower');
    assert.equal(shopGroupOf('program', 'x', { kind: 'attack' }), 'progCombat');
    assert.equal(shopGroupOf('program', 'x', { kind: 'browse' }), 'progOperation');
    assert.equal(shopGroupOf('cyberdeck', 'x', { mpcp: 6 }), 'deckMid');
    assert.equal(shopGroupOf('spell', 'x', { category: 'health' }), 'spellHealth');
    assert.equal(shopGroupOf('gear', 'x', {}) !== '', true);
    assert.equal(shopGroupOf('skill', 'x', {}), '');
  });
  test('every built-in template falls in a listed group; every group has a label', () => {
    for (const t of RULES.ITEM_TEMPLATES as any[]) {
      const g = shopGroupOf(t.type, t.name, t.system);
      if (SHOP_GROUPS[t.type]) assert.ok(SHOP_GROUPS[t.type]!.includes(g), `${t.type} ${t.name} → ${g}`);
    }
    for (const list of Object.values(SHOP_GROUPS)) for (const g of list) { assert.ok(SHOP_GROUP_KEYS[g], g); assert.ok(keyIn(SHOP_GROUP_KEYS[g]!), g); }
    assert.ok(shopGroupRank('weapon', 'melee') < shopGroupRank('weapon', 'pistol'));
  });
  test('none ticked shows every row; ticked shows only those', () => {
    assert.equal(passesGroups('pistol', new Set()), true);
    assert.equal(passesGroups('pistol', new Set(['rifle'])), false);
    assert.equal(passesGroups('pistol', ['rifle', 'pistol']), true);
  });
});

describe('v0.91.2 the window', () => {
  test('the Shop button opens only the tabs that sell things; the categories filter with the search', () => {
    const add = read('src', 'module', 'applications', 'adding.ts');
    // v0.91.8: and the Spells tab while spell formulas are on (a row's Buy a formula…).
    assert.match(add, /const types = windowTypesFor\(actor\.type\)\.filter\(\(t\) => !o\.shop \|\| soldInShop\(t\) \|\| \(t === 'spell' && formulasRequired\(\)\)\);/);
    assert.match(add, /tr\.hidden = !matchesSearch\(tr\.dataset\['search'\] \?\? '', this\.query\) \|\| !passesGroups\(tr\.dataset\['group'\] \?\? '', this\.groups\);/);
    assert.match(add, /return this\.shopMode \? tx\('SR2E\.Window\.Adding\.shopFor'/);
    const tpl = read('public', 'templates', 'add-window.hbs');
    assert.match(tpl, /class="sr2e-add-group" value="\{\{id\}\}"/);
    assert.match(tpl, /data-group="\{\{group\}\}"/);
    assert.match(tpl, /\{\{#if hasLegal\}\}<th>/);
  });
});

describe('v0.91.2 review fixes', () => {
  const g = (name: string, s: any) => shopGroupOf('weapon', name, s);
  test('B1–B3: launchers, flamers and heavy guns go where they belong', () => {
    assert.equal(g('Grenade launcher', { blast: true, skill: 'Launch Weapons' }), 'launcher');
    assert.equal(g('Example Flamethrower', { areaKind: 'flame', skill: 'Throwing Weapons' }), 'heavy');
    assert.equal(g('Example MP-LMG', { skill: 'Firearms', specialization: 'LMG', heavy: true }), 'heavy');
    assert.equal(g('Throwing knife', { skill: 'Throwing Weapons' }), 'thrown');
  });
  test('R2: a firearm with no specialization falls back by its size and modes', () => {
    assert.equal(g('Example A', { skill: 'Firearms', concealability: 6, modes: 'SA' }), 'pistol');
    assert.equal(g('Example B', { skill: 'Firearms', concealability: 5, modes: 'SA/BF' }), 'smg');
    assert.equal(g('Example C', { skill: 'Firearms', concealability: 2, modes: 'SA/BF/FA' }), 'rifle');
  });
  test('B4, R6: gear words that misfired', () => {
    assert.equal(shopGroupOf('gear', 'Explosive sniffer', {}), 'electronics');
    assert.equal(shopGroupOf('gear', 'Battery recharger', {}), 'otherGear');
    assert.equal(shopGroupOf('gear', 'Shaped charge', {}), 'explosives');
    assert.equal(shopGroupOf('gear', 'Fiberoptic cable', {}) === 'vision', false);
    assert.equal(shopGroupOf('gear', 'Data library', {}) === 'magic', false);
    assert.equal(shopGroupOf('gear', 'Telescope', {}) === 'accessories', false);
    assert.equal(shopGroupOf('cyberware', 'Control rig', { controlRig: 1 }), 'headware');
    assert.equal(shopGroupOf('gear', 'Surgical instruments', {}), 'medical');
    assert.equal(shopGroupOf('gear', 'Thermal imaging scanner', {}), 'electronics');
    assert.equal(shopGroupOf('cyberware', 'Cyberheart', {}) === 'headware', false);
    assert.equal(shopGroupOf('cyberware', 'Gear dampener', {}) === 'headware', false);
  });
  test('R1: the compendium index carries every field the categories read', () => {
    const src = read('src', 'module', 'rules', 'shopfilters.ts');
    const shop = read('src', 'module', 'applications', 'shop.ts');
    const fields = new Set([...src.matchAll(/s\?\.([a-zA-Z]+)/g)].map((m) => m[1]!));
    for (const f of fields) assert.ok(shop.includes(`'system.${f}'`), f);
  });
  test('R3, R5, B5: the title follows the mode, entries are classified once, the ticked count says "not shown"', () => {
    const add = read('src', 'module', 'applications', 'adding.ts');
    assert.match(add, /window: \{ title: w\.title \}/);
    assert.match(add, /const groupOf = new Map<Entry, string>/);
    assert.match(add, /this\.shopMode && buying\.length && !inCreation\(actor\)/);
    assert.doesNotMatch(lang.SR2E.App.Adding.tickedHidden, /search/);
  });
});
