/**
 * v0.91.4: vehicles and drones in the shop and the Catalogue: their shop keys and categories, the new-entry form's
 * vehicle and drone kinds, a vehicle for sale and its bought copy, and the purchase's wiring (the GM's client makes it).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  shopSourceOf, parseShopKey, shopShows, vehicleGroup, shopGroupOf, SHOP_GROUPS, SHOP_GROUP_KEYS, entrySummary, entryPrice, parseStatLine, buildEntry,
  entryFields, ENTRY_KINDS, ENTRY_KIND_KEYS, entryItemType, isVehicleKind, codexStats, codexKind, isCodexType, BOUGHT_TYPES, amountLocked, paymentChoices, PROJECT_CALLS,
} from '../rules/index.ts';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const lang = JSON.parse(read('public', 'lang', 'en.json'));
const keyIn = (k: string) => k.split('.').reduce((o: any, p) => o?.[p], lang) !== undefined;

describe('v0.91.4 vehicles in the shop: keys, lists and categories', () => {
  test('a world vehicle\'s key, and what each shop list shows of it', () => {
    assert.equal(shopSourceOf('actor:Actor.abc'), 'worldActor');
    assert.deepEqual(parseShopKey('actor:Actor.abc'), { source: 'worldActor', id: 'Actor.abc' });
    assert.equal(parseShopKey('actor:'), null);
    const show = (mode: any, marked = false, legality = '') => shopShows({ key: 'actor:Actor.abc', type: 'vehicle', legality, marked, mode, isGM: false, allowForbidden: false });
    assert.equal(show('all'), true);
    assert.equal(show('catalogue'), true, 'the GM\'s vehicles are their catalogue');
    assert.equal(show('marked'), false);
    assert.equal(show('marked', true), true);
    assert.equal(show('all', false, 'forbidden'), false);
  });
  test('vehicles are bought (never learned), one per row', () => {
    assert.ok(BOUGHT_TYPES.includes('vehicle'));
    assert.deepEqual(paymentChoices('vehicle', 'character'), ['free', 'buy']);
    assert.equal(amountLocked('vehicle', 'free'), true);
    assert.equal(entryPrice('vehicle', { cost: 20000, streetIndex: 1.5 }), 30000);
    assert.equal(entryPrice('vehicle', { cost: 0 }), 0);
    assert.equal(entrySummary('vehicle', { handling: 4, handlingOffroad: 8, speed: 120, body: 3, armor: 0 }), 'Handling 4/8 · Speed 120 · Body 3 · Armor 0');
    assert.match(entrySummary('vehicle', { drone: true, handling: 3, speed: 80, body: 2, armor: 0, pilot: 3 }), /Pilot 3$/);
  });
  test('categories: vehicles by kind, drones by where they go; every group has a label', () => {
    assert.equal(vehicleGroup({ category: 'car' }), 'car');
    assert.equal(vehicleGroup({ category: 'ship' }), 'boat');
    assert.equal(vehicleGroup({ category: 'vectorThrust' }), 'aircraft');
    assert.equal(vehicleGroup({ category: 'other' }), 'otherVehicle');
    assert.equal(vehicleGroup({ category: 'rotor', drone: true }), 'droneAir');
    assert.equal(vehicleGroup({ category: 'boat', drone: true }), 'droneWater');
    assert.equal(vehicleGroup({ category: 'car', drone: true }), 'droneGround');
    assert.equal(vehicleGroup({ category: 'other', drone: true }), 'droneOther');
    assert.equal(shopGroupOf('vehicle', 'x', { category: 'bike' }), 'bike');
    for (const g of SHOP_GROUPS['vehicle']!) assert.ok(keyIn(SHOP_GROUP_KEYS[g]!), g);
  });
});

describe('v0.91.4 the new-entry form: vehicles and drones', () => {
  test('two new kinds, each with labelled fields and help', () => {
    assert.ok(ENTRY_KINDS.includes('vehicle') && ENTRY_KINDS.includes('drone'));
    for (const k of ['vehicle', 'drone'] as const) {
      assert.equal(entryItemType(k), 'vehicle');
      assert.ok(isVehicleKind(k));
      assert.ok(keyIn(ENTRY_KIND_KEYS[k]), k);
      for (const f of entryFields(k)) { assert.ok(keyIn(f.labelKey), `${k} ${f.labelKey}`); assert.ok(f.help, `${k} ${f.id}`); }
    }
    assert.ok(entryFields('drone').some((f) => f.id === 'pilot') && !entryFields('vehicle').some((f) => f.id === 'pilot'));
  });
  test('a stat line: Handling code, then the numbers in the table\'s order; a drone is marked; the text goes in the notes', () => {
    const r = parseStatLine('vehicle', 'Example Sedan 4/8 120 10 3 0 2 1 1 22,000 1');
    assert.equal(r.name, 'Example Sedan');
    const b = buildEntry('vehicle', r.name, r.values, 'Our own words');
    assert.deepEqual(b.problems, []);
    assert.equal(b.type, 'vehicle');
    assert.equal(b.system['handling'], 4); assert.equal(b.system['handlingOffroad'], 8);
    assert.equal(b.system['speed'], 120); assert.equal(b.system['body'], 3); assert.equal(b.system['cost'], 22000);
    assert.equal(b.system['notes'], '<p>Our own words</p>');
    assert.equal(b.system['description'], undefined);
    const d = buildEntry('drone', 'Example Drone', { shHandling: '3', pilot: '3', body: '2', cost: '8000' }, '');
    assert.equal(d.system['drone'], true); assert.equal(d.system['pilot'], 3); assert.equal(d.system['handling'], 3);
    assert.ok(buildEntry('vehicle', 'X', { shHandling: 'fast' }, '').problems.length);
  });
  test('the Catalogue page: a vehicle or drone page shows its stats', () => {
    assert.ok(isCodexType('vehicle'));
    assert.equal(codexKind('vehicle', { drone: true }), 'drone');
    const s = Object.fromEntries(codexStats('vehicle', { category: 'car', handling: 4, handlingOffroad: 8, speed: 120, body: 3, cost: 9000 }).map((x) => [x.id, x.value]));
    assert.equal(s['shHandling'], '4/8'); assert.equal(s['speed'], '120'); assert.equal(s['category'], 'car');
    assert.equal(s['cost'], undefined, 'the price line, not a stat');
  });
});

describe('v0.91.4 a vehicle for sale and its bought copy (mocked Foundry)', () => {
  const g: any = globalThis;
  const settings: Record<string, unknown> = { shopList: 'all', shopForbidden: false, itemTemplates: [], starterKits: [] };
  const folder = (name: string, parent: any = null) => ({ name, folder: parent });
  const cat = folder('Cars', folder('Vehicles', folder('Catalogue (SR2e)')));
  const vehicle = (o: any) => ({ documentName: 'Actor', type: 'vehicle', inCompendium: false, parent: null, hasPlayerOwner: false, flags: {}, folder: null, name: 'V', uuid: 'Actor.v',
    toObject: () => ({ _id: 'x', name: o.name ?? 'V', type: 'vehicle', folder: 'f', ownership: { default: 0, p: 3 }, system: { cost: 10000, condition: 4, controllerUuid: 'Actor.d', occupants: ['a'], link: { encryption: 2, intercepted: { by: 'x' } }, handling: 4 }, flags: { sr2e: { shop: true } }, items: [{ _id: 'i', name: 'Gun' }], prototypeToken: { actorLink: false } }), ...o });
  test('for sale: in the catalogue folder, or marked; never a player\'s', async () => {
    g.game = { settings: { get: (_s: string, k: string) => settings[k] }, user: { isGM: true }, actors: [], items: [], packs: [] };
    g.foundry = { utils: { deepClone: (x: any) => structuredClone(x) } };
    const { vehicleForSale, inCatalogueFolder, vehicleCopyData, resolveShopKey, resolveCatalogueKey } = await import('../applications/shop.ts');
    assert.equal(inCatalogueFolder({ folder: cat }), true);
    assert.equal(vehicleForSale(vehicle({ folder: cat })), true);
    assert.equal(vehicleForSale(vehicle({ flags: { sr2e: { shop: true } } })), true);
    assert.equal(vehicleForSale(vehicle({})), false, 'a GM vehicle elsewhere, unmarked');
    assert.equal(vehicleForSale(vehicle({ folder: cat, hasPlayerOwner: true })), false, 'a player\'s');
    assert.equal(vehicleForSale({ documentName: 'Actor', type: 'npc', folder: cat }), false);
    // The bought copy: no ids, owners, folder, shop mark or live state; its token linked.
    const c = vehicleCopyData(vehicle({}).toObject());
    assert.equal(c._id, undefined); assert.equal(c.folder, undefined); assert.equal(c.ownership, undefined);
    assert.equal(c.system.condition, undefined); assert.equal(c.system.controllerUuid, undefined); assert.equal(c.system.occupants, undefined);
    assert.deepEqual(c.system.link, { encryption: 2 });
    assert.equal(c.flags.sr2e.shop, undefined); assert.equal(c.items[0]._id, 'i', 'embedded ids are kept (per parent)'); assert.equal(c.prototypeToken.actorLink, true);
    assert.equal(c.system.cost, 10000);
    // Read back from a key: for sale only, in this user's shop.
    const forSale = vehicle({ folder: cat, flags: {} });
    g.fromUuid = async (id: string) => (id === 'Actor.v' ? forSale : null);
    const player = { isGM: false, id: 'p1' };
    const t = await resolveShopKey('actor:Actor.v', player);
    assert.ok(t && t.type === 'vehicle' && t.data.system.condition === undefined);
    assert.ok(await resolveCatalogueKey('actor:Actor.v', player));
    settings['shopList'] = 'marked';
    assert.equal(await resolveShopKey('actor:Actor.v', player), null, 'marked only: an unmarked vehicle');
    settings['shopList'] = 'all';
    forSale.hasPlayerOwner = true;
    assert.equal(await resolveShopKey('actor:Actor.v', { isGM: true }), null, 'a player\'s vehicle is never sold');
    settings['starterKits'] = [{ id: 'k1', name: 'Kit', lines: [{ type: 'vehicle', name: 'x', system: {} }] }];
    assert.equal(await resolveShopKey('kit:k1#0', { isGM: true }), null, 'a kit line is never a vehicle');
  });
});

describe('v0.91.4 the purchase\'s wiring', () => {
  const doc = read('src', 'module', 'documents', 'index.ts');
  const add = read('src', 'module', 'applications', 'adding.ts');
  test('the vehicle has buying fields and the sheet a Cost and legality section', () => {
    const models = read('src', 'module', 'models', 'index.ts');
    const i = models.indexOf('export class VehicleDataModel');
    assert.match(models.slice(i, i + 9000), /cost: new fields\.NumberField\(\{ required: true, integer: true, min: 0, initial: 0 \}\),\n\s+availability: new fields\.StringField[^\n]+\n\s+streetIndex: new fields\.NumberField[^\n]+\n\s+\.\.\.legalFields\(\),/);
    assert.match(read('public', 'templates', 'actor-vehicle-sheet.hbs'), /data-heading="Cost and legality"[\s\S]*name="system\.cost"[\s\S]*name="system\.legality"/);
  });
  test('a found vehicle is bought on the GM\'s client: the relay, and every value checked again there', () => {
    assert.match(doc, /if \(t\.type === 'vehicle'\) \{\n\s+const ok = await this\.shopVehicle\('buy', t\.key, p, hours, ctx \? requester : null\);/);
    assert.match(doc, /else r = await requestGm\('vehicleShop', \{ action, actorUuid: this\.uuid,/);
    assert.match(doc, /onRelay\('vehicleShop', async \(d, user\) => \{[\s\S]{0,500}return actor\.vehicleShopAsGm\(action, d\['key'\], d\['price'\], d\['hours'\], user\);/);
    const gm = doc.slice(doc.indexOf('async vehicleShopAsGm('), doc.indexOf('async deliverVehicle('));
    assert.match(gm, /if \(!\(game as any\)\.user\?\.isGM\) return/);
    assert.match(gm, /!this\.testUserPermission\(user, 'OWNER'\)/);
    assert.match(gm, /const t = await resolveShopKey\(String\(key \?\? ''\), player \? user : \{ isGM: true \}\);/);
    assert.match(gm, /if \(list <= 0 && player\) return/);
    // v0.91.6: the upper bound also allows a fixer's cut.
    assert.match(gm, /Math\.max\(haggledPrice\(list, most\)\.price, Math\.min\(Math\.max\(haggledPrice\(list, -most\)\.price, list \+ fixerFeeOf\(list\)\),/);
    assert.match(gm, /const orderId = await recordVehicleOrder\(\{ actorUuid: String\(this\.uuid\), key: t\.key, purchaserId: purchaser, paid: p, name: t\.name \}\);/);
    assert.match(gm, /effect: \{ call: \{ method: 'deliverVehicle', args: \[orderId\] \} \}/);
    // Review R2: the queue and the wait are checked on the GM's side too; a player's gift needs the GM's approval.
    assert.match(gm, /if \(player && !o\.approved && needsApproval\(\{ queueOn: queueOn\(\), isGM: false, actorType: String\(this\.type\), inCreation: inCreation\(this\) \}\)\) return/);
    assert.match(gm, /if \(player\) h = Math\.max\(h, floor\);/);
    assert.match(gm, /if \(player && !o\.approved\) return \{ ok: false, note: tx\('SR2E\.Notify\.VehicleShop\.freeGmOnly'\) \};/);
  });
  test('an ordered vehicle arrives through a checked project call', () => {
    assert.ok((PROJECT_CALLS as readonly string[]).includes('deliverVehicle'));
    // Review B1: a project names only an order the GM recorded; B2: an undelivered order gives back what the record says.
    assert.match(doc, /case 'deliverVehicle': \{\n\s+const id = String\(a\[0\] \?\? ''\);\n\s+return \/\^\[A-Za-z0-9\]\{1,64\}\$\/\.test\(id\) \? \[id\] : null;/);
    const dv = doc.slice(doc.indexOf('async deliverVehicle('), doc.indexOf('async deliverVehicle(') + 900);
    assert.match(dv, /const order = await takeVehicleOrder\(orderId, String\(this\.uuid\)\);\n\s+if \(!order\) return false;/);
    assert.match(dv, /if \(!made && order\.paid > 0\) await this\.adjustNuyen\(order\.paid,/);
    // Only the GM cancels one, refunding the record's amount.
    assert.match(doc, /if \(vehicleOrder && !\(game as any\)\.user\?\.isGM\) \{ ui\.notifications\?\.warn\?\.\(tx\('SR2E\.Notify\.VehicleShop\.gmCancels'\)\); return false; \}/);
    assert.match(doc, /if \(order && order\.paid > 0\) await this\.adjustNuyen\(order\.paid,/);
    // Review R1: no answer in time leaves the card's Buy spent.
    assert.match(doc, /if \(ok === 'pending'\) return 'requested';/);
  });
  test('the Add window: a Vehicles tab for characters, no Blank vehicle, a vehicle line keeps its key for the GM', () => {
    assert.match(add, /const types = actorType === 'character' \? \[\.\.\.addTypesFor\(actorType\), 'vehicle'\] : addTypesFor\(actorType\);/);
    assert.match(read('public', 'templates', 'add-window.hbs'), /\{\{#unless isVehicle\}\}<button type="button" data-action="blankNew"/);
    assert.match(add, /lines\.map\(\(\{ key: k, \.\.\.l \}\) => \(l\.type === 'vehicle' \? \{ \.\.\.l, key: k \} : l\)\)/);
    assert.match(add, /await actor\.shopVehicle\(payment === 'free' \? 'free' : 'buy', l\.key,/);
  });
  test('the copy is the buyer\'s: their players own it, it is in Owned vehicles, the Rigging tab lists it', () => {
    const shop = read('src', 'module', 'applications', 'shop.ts');
    assert.match(shop, /if \(!game\.user\?\.isGM \|\| !buyer \|\| !data\) return null;/);
    assert.match(shop, /for \(const u of \(\(game as any\)\.users \?\? \[\]\)\) if \(!u\.isGM && buyer\.testUserPermission\?\.\(u, 'OWNER'\)\) ownership\[u\.id\] = 3;/);
    assert.match(shop, /flags: \{ \.\.\.\(copy\.flags \?\? \{\}\), \[SYSTEM\.id\]: \{ \.\.\.\(copy\.flags\?\.\[SYSTEM\.id\] \?\? \{\}\), boughtBy: buyer\.uuid \} \}/);
    const sheets = read('src', 'module', 'applications', 'sheets.ts');
    assert.match(sheets, /return allActors\(\)\.filter\(\(a: any\) => a\.type === "vehicle" && a\.flags\?\.\[SYSTEM\.id\]\?\.boughtBy === actor\.uuid/);
    assert.match(sheets, /const hasRigging = Boolean\(actor\.system\.derived\?\.rigging\) \|\| \(actor\.type === "character" && ownedVehicles\(actor\)\.length > 0\);/);
    assert.match(sheets, /if \(buyer\?\.sheet\?\.rendered\) void buyer\.sheet\.render\(\);/);
    assert.match(read('public', 'templates', 'rigging-section.hbs'), /\{\{#each rigging\.owned\}\}<a data-action="openActor" data-uuid="\{\{uuid\}\}">/);
    for (const k of ['SR2E.App.VehicleShop.folder', 'SR2E.Card.VehicleShop.delivered', 'SR2E.UI.yourVehicles', 'SR2E.Notify.VehicleShop.noPrice']) assert.ok(keyIn(k), k);
  });
});

describe('v0.91.4 review fixes', () => {
  test('B3: a single Handling number is the first column; N7: a vehicle is said not to be a drone', () => {
    const r = parseStatLine('drone', 'Example Drone 3 80 10 2 0 3 3 2 8,000 1.5');
    assert.equal(r.values['shHandling'], '3'); assert.equal(r.values['speed'], '80'); assert.equal(r.values['sensor'], '2'); assert.equal(r.values['streetIndex'], '1.5');
    assert.equal(buildEntry('vehicle', 'X', { speed: '90' }, '').system['drone'], false);
  });
  test('R5: only changes the lists show refresh them', async () => {
    const g: any = globalThis;
    g.foundry = { utils: { deepClone: (x: any) => structuredClone(x), flattenObject: (o: any, p = ''): any => Object.entries(o ?? {}).reduce((acc: any, [k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? { ...acc, ...g.foundry.utils.flattenObject(v, `${p}${k}.`) } : { ...acc, [`${p}${k}`]: v }), {}) } };
    const { vehicleListChange } = await import('../applications/shop.ts');
    assert.equal(vehicleListChange({ system: { currentSpeed: 40, condition: 2 } }), false);
    assert.equal(vehicleListChange({ system: { cost: 5000 } }), true);
    assert.equal(vehicleListChange({ flags: { sr2e: { shop: true } } }), true);
    assert.equal(vehicleListChange({ name: 'X' }), true);
  });
  test('B1: orders are the GM\'s record, used up once, for their own buyer only (mocked)', async () => {
    const g: any = globalThis;
    const store: Record<string, any> = { vehicleOrders: {} };
    g.game = { settings: { get: (_s: string, k: string) => store[k], set: async (_s: string, k: string, v: any) => { store[k] = v; } }, user: { isGM: true } };
    g.foundry = { ...(g.foundry ?? {}), utils: { ...(g.foundry?.utils ?? {}), randomID: () => 'abc123', deepClone: (x: any) => structuredClone(x) } };
    const { recordVehicleOrder, takeVehicleOrder } = await import('../applications/shop.ts');
    const id = await recordVehicleOrder({ actorUuid: 'Actor.a', key: 'actor:Actor.v', purchaserId: 'p1', paid: 15000.4, name: 'Car' });
    assert.equal(id, 'abc123');
    assert.equal(store['vehicleOrders'].abc123.paid, 15000);
    assert.equal(await takeVehicleOrder('abc123', 'Actor.other'), null, 'another actor\'s order');
    assert.equal((await takeVehicleOrder('abc123', 'Actor.a'))?.key, 'actor:Actor.v');
    assert.equal(await takeVehicleOrder('abc123', 'Actor.a'), null, 'used up');
    g.game.user = { isGM: false };
    assert.equal(await recordVehicleOrder({ actorUuid: 'Actor.a', key: 'k', purchaserId: '', paid: 1, name: 'x' }), null, 'a player can\'t record one');
    assert.match(read('src', 'module', 'settings.ts'), /register\(SYSTEM\.id, "vehicleOrders", \{ scope: "world", config: false, type: Object, default: \{\} \}\)/);
  });
});
