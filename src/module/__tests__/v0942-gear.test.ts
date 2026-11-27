/**
 * v0.94.2 (plan items 39 and 44): nested items. The parent link and its kinds, dangling links, the accessory merge
 * (one function), the field ⇄ item conversion, containers (carried, at hand, load), programs on decks, the derived
 * data rebuilt from stored values, the item sheet's form proxy, and the glue's pure helpers and wiring.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NEST_FLAG, readLink, linkValue, linkKindFor, resolveParent, lookupOf, childrenOf, descendantsOf, linkedTo, canNest, parentChoices,
  accessoryOf, isContainer, isAmmoClip, isStowed, mergeAccessories, accessoryEffects, conversionPlan, conversionClears, revertUpdate,
  containerLoad, programMayLoad, programDeck, remapLinks, withoutLink, ACCESSORY_FIELD_DEFAULTS, ACCESSORY_KINDS, ACCESSORY_KIND_KEYS, OPTION_KEYS, MAX_DEPTH,
} from '../rules/nesting942.ts';
import { isCarried, isAtHand, tweakItemLive } from '../rules/tweaks.ts';
import { RULES } from '../rules/config.ts';
import { nestDerived942, formSystem942 } from '../helpers/nesting942.ts';
import { accessoryName, duplicateData, itemSheetSection } from '../applications/nesting942.ts';
import { itemTypeProblem } from '../applications/drops.ts';
import { TOOLS } from '../rules/tools.ts';

const SYS = 'shadowrun2e_unified';
const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const en = (globalThis as any).__SR2E_EN__ as Record<string, string>;

const link = (parent: string, kind: string, extra: any = {}) => ({ [SYS]: { [NEST_FLAG]: { parent, kind, ...extra } } });
const gear = (id: string, nest: any = {}, o: any = {}) => ({ id, type: 'gear', name: o.name ?? id, system: { quantity: 1, weight: 0, carried: true, nest942: { container: false, capacity: 0, accessory: '', rating: 0, option: '', ...nest }, ...(o.system ?? {}) }, flags: o.flags ?? {} });
const weapon = (id: string, system: any = {}, flags: any = {}) => ({ id, type: 'weapon', name: id, system: { ...ACCESSORY_FIELD_DEFAULTS, ready: true, carried: true, ...system }, flags });

/** Items on a fake actor: each item's `parent.items.get` finds its siblings, and `_source.system` holds the stored data. */
function onActor(list: any[]): any[] {
  // Foundry's Collection: a Map whose iterator gives the documents.
  class Collection extends Map<string, any> { override [Symbol.iterator](): any { return this.values(); } }
  const actor: any = { items: new Collection() };
  for (const i of list) { i.parent = actor; i._source = { system: JSON.parse(JSON.stringify(i.system)) }; actor.items.set(i.id, i); }
  return list;
}

describe('v0.94.2 nesting: the link', () => {
  test('readLink accepts only a valid parent id and kind (null flags are "not set")', () => {
    assert.deepEqual(readLink({ flags: link('abc123', 'inside') }), { parent: 'abc123', kind: 'inside' });
    assert.deepEqual(readLink({ flags: link('abc123', 'mounted', { conv: true }) }), { parent: 'abc123', kind: 'mounted', conv: true });
    assert.equal(readLink({ flags: { [SYS]: { [NEST_FLAG]: null } } }), null);
    assert.equal(readLink({ flags: link('bad id!', 'inside') }), null);
    assert.equal(readLink({ flags: link('abc', 'glued') }), null);
    assert.equal(readLink({}), null);
    assert.deepEqual(linkValue('x1', 'mounted', true), { parent: 'x1', kind: 'mounted', conv: true });
  });
  test('kinds: accessories on weapons, programs on decks, weapons/armor/gear in containers', () => {
    const scope = gear('s', { accessory: 'scope', rating: 2 });
    const bag = gear('b', { container: true });
    assert.equal(linkKindFor(scope, weapon('w')), 'mounted');
    assert.equal(linkKindFor({ id: 'p', type: 'program' }, { id: 'd', type: 'cyberdeck' }), 'mounted');
    assert.equal(linkKindFor(weapon('w'), bag), 'inside');
    assert.equal(linkKindFor({ id: 'a', type: 'armor' }, bag), 'inside');
    assert.equal(linkKindFor(scope, bag), 'inside', 'an accessory can be packed too');
    assert.equal(linkKindFor(gear('g'), weapon('w')), null, 'plain gear is no accessory');
    assert.equal(linkKindFor({ id: 'c', type: 'cyberware' }, bag), null);
    assert.equal(linkKindFor(bag, bag), null);
  });
  test('a dangling link (parent not on this actor, no longer fitting, a loop) is ignored: the item is free', () => {
    const [w, s, lost] = onActor([weapon('w'), gear('s', { accessory: 'laserSight' }, { flags: link('w', 'mounted') }), gear('l', { accessory: 'laserSight' }, { flags: link('gone', 'mounted') })]);
    assert.equal(resolveParent(s, lookupOf((w as any).parent.items))?.parent.id, 'w');
    assert.equal(resolveParent(lost, lookupOf((w as any).parent.items)), null);
    // The container unmarked: its contents are free.
    const [bag, knife] = onActor([gear('b', { container: false }), weapon('k', {}, link('b', 'inside'))]);
    assert.equal(resolveParent(knife, lookupOf((bag as any).parent.items)), null);
    // A loop: A in B, B in A.
    const [a, b] = onActor([gear('a', { container: true }, { flags: link('b', 'inside') }), gear('b', { container: true }, { flags: link('a', 'inside') })]);
    assert.equal(resolveParent(a, lookupOf((a as any).parent.items)), null);
    assert.equal(resolveParent(b, lookupOf((a as any).parent.items)), null);
    // An item that arrives on another actor with its old link (its parent stayed behind).
    const [other] = onActor([gear('s', { accessory: 'laserSight' }, { flags: link('w', 'mounted') })]);
    assert.equal(resolveParent(other, lookupOf((other as any).parent.items)), null);
  });
  test('children, descendants, linked items and the "Put in…" choices; no loops allowed', () => {
    const items = onActor([
      gear('boot', { container: true }), gear('bag', { container: true }, { flags: link('boot', 'inside') }),
      weapon('gun', {}, link('bag', 'inside')), gear('scope', { accessory: 'scope', rating: 1 }, { flags: link('gun', 'mounted') }), gear('free'),
    ]);
    assert.deepEqual(childrenOf('boot', items).map((i) => i.id), ['bag']);
    assert.deepEqual(descendantsOf('boot', items).map((i) => i.id), ['bag', 'gun', 'scope']);
    assert.deepEqual(childrenOf('gun', items, 'inside'), []);
    assert.deepEqual(linkedTo('gun', items).map((i) => i.id), ['scope']);
    const boot = items[0]; const bag = items[1];
    assert.equal(canNest(boot, bag, items), null, 'the boot can\'t go into the bag inside it');
    assert.equal(canNest(items[4], bag, items), 'inside');
    assert.deepEqual(parentChoices(items[3], items).map((c) => c.item.id), ['boot', 'bag', 'gun']);
    assert.ok(isStowed(items[3], lookupOf((boot as any).parent.items)), 'a scope on a packed gun is packed');
    assert.ok(MAX_DEPTH >= 4);
  });
});

describe('v0.94.2 nesting: accessories', () => {
  test('accessory specs and what each gives', () => {
    assert.deepEqual(accessoryOf(gear('x', { accessory: 'gyro', rating: 3 })), { kind: 'gyro', rating: 3, option: '' });
    assert.equal(accessoryOf(gear('x', { accessory: 'bogus' })), null);
    assert.deepEqual(accessoryEffects({ kind: 'scope', rating: 5, option: 'thermographic' }), { scope: 3, scopeVision: 'thermographic' });
    assert.deepEqual(accessoryEffects({ kind: 'support', rating: 0, option: 'tripod' }), { support: 'tripod' });
    assert.deepEqual(accessoryEffects({ kind: 'support', rating: 0, option: 'pogo' }), {});
    assert.deepEqual(accessoryEffects({ kind: 'recoilComp', rating: 0, option: '' }), {});
    assert.deepEqual(accessoryEffects({ kind: 'laserSight', rating: 0, option: '' }), { laserSight: true });
    for (const k of ACCESSORY_KINDS) assert.ok(en[ACCESSORY_KIND_KEYS[k]!], k);
    for (const k of Object.values(OPTION_KEYS)) assert.ok(en[k], k);
  });
  test('the merge: booleans OR, ratings max, choices best; stored fields kept where nothing beats them', () => {
    const stored = { ...ACCESSORY_FIELD_DEFAULTS, scope: 2, recoilComp: 1, support: 'tripod', muzzle: 'suppressor' };
    const r = mergeAccessories(stored, [
      { name: 'Laser', spec: { kind: 'laserSight', rating: 0, option: '' } },
      { name: 'Scope 1', spec: { kind: 'scope', rating: 1, option: 'lowLight' } },
      { name: 'Vent', spec: { kind: 'recoilComp', rating: 3, option: '' } },
      { name: 'Bipod', spec: { kind: 'support', rating: 0, option: 'bipod' } },
      { name: 'Silencer', spec: { kind: 'muzzle', rating: 0, option: 'silencer' } },
    ]);
    assert.equal(r.values['laserSight'], true);
    assert.equal(r.values['scope'], 2, 'the stored magnification beats a weaker scope');
    assert.equal(r.values['scopeVision'], 'lowLight');
    assert.equal(r.values['recoilComp'], 3);
    assert.equal(r.values['support'], 'tripod', 'a stored tripod beats a bipod');
    assert.equal(r.values['muzzle'], 'suppressor');
    assert.deepEqual(r.from['recoilComp'], ['Vent']);
    assert.deepEqual(r.from['laserSight'], ['Laser']);
    assert.equal(r.from['support'], undefined);
    // Nothing attached: exactly the stored values.
    assert.deepEqual(mergeAccessories(stored, []).values, stored);
  });
  test('conversion: fields become items and clear; back to fields restores them exactly', () => {
    const stored = { ...ACCESSORY_FIELD_DEFAULTS, laserSight: true, scope: 3, scopeVision: 'thermographic', support: 'bipod', gyro: 4, muzzle: 'silencer', smartgun: true };
    const plan = conversionPlan(stored);
    assert.deepEqual(plan.map((p) => p.kind).sort(), ['gyro', 'laserSight', 'muzzle', 'scope', 'smartgun', 'support']);
    const clears = conversionClears(plan);
    assert.deepEqual(clears, { 'system.laserSight': false, 'system.smartgun': false, 'system.scope': 0, 'system.scopeVision': '', 'system.support': 'none', 'system.muzzle': '', 'system.gyro': 0 });
    const cleared: Record<string, unknown> = { ...stored };
    for (const [k, v] of Object.entries(clears)) cleared[k.slice(7)] = v;
    const specs = plan.map((p) => ({ kind: p.kind, rating: p.rating, option: p.option }));
    // Effective values unchanged by the conversion.
    assert.deepEqual(mergeAccessories(cleared, specs.map((spec) => ({ name: '', spec }))).values, mergeAccessories(stored, []).values);
    // Back to fields.
    const back = revertUpdate(cleared, specs);
    const restored: Record<string, unknown> = { ...cleared };
    for (const [k, v] of Object.entries(back)) restored[k.slice(7)] = v;
    assert.deepEqual(restored, stored);
    assert.deepEqual(conversionPlan(ACCESSORY_FIELD_DEFAULTS), []);
    // A vision-only scope converts too.
    assert.deepEqual(conversionPlan({ scopeVision: 'lowLight' }).map((p) => [p.kind, p.rating, p.option]), [['scope', 0, 'lowLight']]);
  });
  test('accessory item names', () => {
    assert.equal(accessoryName({ kind: 'scope', rating: 2, option: 'lowLight' }), 'Scope (2, Low-light)');
    assert.equal(accessoryName({ kind: 'laserSight', rating: 0, option: '' }), 'Laser sight');
  });
});

describe('v0.94.2 nesting: derived data from stored values', () => {
  test('a weapon sees its attached accessories; detaching restores the stored value (no stale value survives)', () => {
    const items = onActor([weapon('w', { recoilComp: 1 }), gear('l', { accessory: 'laserSight' }, { flags: link('w', 'mounted') }), gear('v', { accessory: 'recoilComp', rating: 2 }, { flags: link('w', 'mounted') }), gear('broken', { accessory: 'smartgun' }, { flags: link('w', 'mounted'), system: { damaged: true } })]);
    const w = items[0];
    const model = Object.assign(w.system, { parent: w });
    nestDerived942(model);
    assert.equal(w.system.laserSight, true);
    assert.equal(w.system.recoilComp, 2);
    assert.equal(w.system.smartgun, false, 'a broken accessory gives nothing');
    assert.equal(w._source.system.laserSight, false, 'stored field untouched');
    // Detach the laser: prepared again, the effective value is the stored one.
    items[1].flags = {};
    nestDerived942(model);
    assert.equal(w.system.laserSight, false);
    // The item sheet's form shows the stored values.
    items[1].flags = link('w', 'mounted'); nestDerived942(model);
    const form = formSystem942(w);
    assert.equal(form.laserSight, false);
    assert.equal(form.recoilComp, 1);
    assert.equal(form.ammoMax, w.system.ammoMax);
  });
  test('packed: a weapon isn\'t ready, armor isn\'t worn; tweaks and optics stop; carried follows the container', () => {
    const prev = RULES.SHEET_V921.carried;
    (RULES.SHEET_V921 as any).carried = 'on';
    try {
      const items = onActor([gear('bag', { container: true }), weapon('gun', { ready: true }, link('bag', 'inside')), { id: 'vest', type: 'armor', name: 'vest', system: { worn: true, carried: true }, flags: link('bag', 'inside') }, gear('goggles', {}, { flags: link('bag', 'inside') }), gear('laser', { accessory: 'laserSight' }, { flags: link('gun', 'mounted') })]);
      const [bag, gun, vest, goggles, laser] = items;
      nestDerived942(Object.assign(gun.system, { parent: gun }));
      nestDerived942(Object.assign(vest.system, { parent: vest }));
      assert.equal(gun.system.ready, false);
      assert.equal(vest.system.worn, false);
      assert.ok(isCarried(goggles) && !isAtHand(goggles));
      assert.equal(tweakItemLive(goggles), false);
      assert.equal(tweakItemLive(gun), false);
      // The bag left behind: nothing in it is carried, the accessory follows its gun.
      bag.system.carried = false;
      assert.equal(isCarried(goggles), false);
      assert.equal(isCarried(laser), false);
      laser.system.carried = false; bag.system.carried = true;
      assert.equal(isCarried(laser), true, 'an attached accessory goes where its weapon goes');
      // Taken out: ready again from the stored value.
      gun.flags = {}; nestDerived942(gun.system);
      assert.equal(gun.system.ready, true);
    } finally { (RULES.SHEET_V921 as any).carried = prev; }
  });
  test('a container\'s load and capacity', () => {
    const items = onActor([gear('bag', { container: true, capacity: 5 }), gear('rope', {}, { flags: link('bag', 'inside'), system: { weight: 2, quantity: 2 } }), weapon('gun', { weight: 1.5 }, link('bag', 'inside'))]);
    assert.deepEqual(containerLoad(items[0], items), { kg: 5.5, count: 2, capacity: 5, over: true });
    assert.ok(isContainer(items[0]));
    assert.ok(isAmmoClip(gear('clip', {}, { system: { ammoType: 'apds' } })));
    assert.equal(isAmmoClip(gear('clip', { container: true }, { system: { ammoType: 'apds' } })), false);
  });
  test('programs: a free one loads as before; one stored on a deck loads only while that deck is in use', () => {
    const items = onActor([{ id: 'd1', type: 'cyberdeck', name: 'Fuchi', system: { active: false } }, { id: 'p1', type: 'program', name: 'Sleaze', system: { loaded: true }, flags: link('d1', 'mounted') }, { id: 'p2', type: 'program', name: 'Attack', system: { loaded: true }, flags: {} }]);
    const lookup = lookupOf((items[0] as any).parent.items);
    assert.equal(programDeck(items[1], lookup)?.id, 'd1');
    assert.equal(programMayLoad(items[1], lookup), false);
    assert.equal(programMayLoad(items[2], lookup), true);
    nestDerived942(Object.assign(items[1].system, { parent: items[1] }));
    assert.equal(items[1].system.loaded, false);
    assert.equal(tweakItemLive(items[1]), false);
    items[0].system.active = true;
    nestDerived942(items[1].system);
    assert.equal(items[1].system.loaded, true);
  });
});

describe('v0.94.2 nesting: moving and copying', () => {
  test('links follow new ids; others are left to dangle; copies of attached items arrive free', () => {
    const data = [{ _id: 'a', flags: link('w', 'mounted') }, { _id: 'b', flags: link('elsewhere', 'inside') }];
    const out = remapLinks(data, new Map([['w', 'w2']]));
    assert.equal(readLink(out[0])?.parent, 'w2');
    assert.equal(readLink(out[1])?.parent, 'elsewhere');
    assert.equal(readLink(withoutLink({ flags: link('w', 'mounted') })), null);
    assert.equal(readLink(duplicateData({ flags: link('w', 'mounted') })), null);
    assert.equal(readLink(duplicateData({ flags: link('bag', 'inside') }))?.parent, 'bag', 'a copy in a bag stays in it');
  });
  test('vehicles hold armor (a boot) and safehouses hold weapons, armor and gear (a stash)', () => {
    for (const t of ['weapon', 'armor', 'gear']) { assert.equal(itemTypeProblem('safehouse', t), null); assert.equal(itemTypeProblem('vehicle', t), null); }
    assert.ok(itemTypeProblem('safehouse', 'spell'));
  });
});

describe('v0.94.2 nesting: sheets and wiring', () => {
  test('the item sheet section escapes names and offers the conversion', () => {
    const items = onActor([weapon('w', { laserSight: true }), gear('x', { accessory: 'scope', rating: 1 }, { name: '<b>Scope</b>', flags: link('w', 'mounted') })]);
    for (const i of items) i.isOwner = true;
    const html = itemSheetSection(items[0]);
    assert.match(html, /data-sr2e-nest="convert"/);
    assert.ok(html.includes('&lt;b&gt;Scope&lt;/b&gt;') && !html.includes('<b>Scope</b>'));
    const gearHtml = itemSheetSection(items[1]);
    assert.match(gearHtml, /name="system\.nest942\.accessory"/);
    assert.match(gearHtml, /name="system\.nest942\.rating"/);
  });
  test('wired in: models, sheets, drops, duplicate, swap memory, settings, tools, strings', () => {
    const models = read('src', 'module', 'models', 'index.ts');
    assert.equal((models.match(/prepareDerivedData\(\): void \{ nestDerived942\(this\); \}/g) ?? []).length, 3);
    assert.match(models, /nest942: new fields\.SchemaField/);
    assert.match(read('src', 'module', 'applications', 'sheets.ts'), /system: formSystem942\(item\)/);
    const drops = read('src', 'module', 'applications', 'drops.ts');
    assert.match(drops, /nestDropOnRow\(sheet, event, item\)/);
    assert.match(drops, /copyChildren\(source, item\.id, actor, made\.id/);
    assert.match(read('src', 'module', 'applications', 'adding.ts'), /duplicateChildren\(actor, item, made\[0\]\)/);
    assert.match(read('src', 'module', 'documents', 'index.ts'), /programMayLoad\(p, lookupOf\(this\.items\)\)/);
    assert.match(read('src', 'module', 'settings.ts'), /"nestOnDrop"/);
    assert.match(read('src', 'module', 'sr2e-system.ts'), /registerNesting942\(\)/);
    assert.ok(TOOLS.some((t) => t.id === 'accessoryItems' && t.who === 'gm'));
    const glue = read('src', 'module', 'applications', 'nesting942.ts');
    for (const m of glue.matchAll(/tx\('(SR2E\.[A-Za-z0-9.]+)'/g)) assert.ok(en[m[1]!], String(m[1]));
    assert.ok(!/unsetFlag|-=nest942/.test(glue + read('src', 'module', 'rules', 'nesting942.ts')), 'links are cleared through helpers/flags.ts');
    // The strings draft exists only in the cloud workspace where it was written (merged into en.json since).
    const DRAFT = '/home/claude/work/strings-gear.json';
    if (existsSync(DRAFT)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(DRAFT, 'utf8')))) assert.equal(en[k], v, k);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// v0.94.2 review fixes (review-0942-gear-trade.md): findings 3, 4 and 13
// ---------------------------------------------------------------------------------------------------------------------
import { sumTweaks } from '../rules/tweaks.ts';
import { accessoryItemsToFields } from '../applications/nesting942.ts';

describe('v0.94.2 review 3: tweaks follow nesting (and nothing changes without it)', () => {
  const tw = (value: number) => [{ id: 't1', label: '', target: 'attribute', key: 'body', value, on: true }];
  const withRules = (fn: () => void) => {
    const prev = { ...RULES.SHEET_V921 };
    Object.assign(RULES.SHEET_V921 as any, { carried: 'on', tweaks: 'on' });
    try { fn(); } finally { Object.assign(RULES.SHEET_V921 as any, prev); }
  };
  test('regression: with no nesting, the item documents sum exactly as the plain copies did', () => withRules(() => {
    const items = onActor([gear('goggles', {}, { system: { tweaks: tw(1) } }), weapon('gun', { tweaks: tw(2) }), gear('left', {}, { system: { tweaks: tw(4), carried: false } }), { id: 'ware', type: 'cyberware', name: 'ware', system: { installed: true, tweaks: tw(8) }, flags: {} }]);
    const plain = sumTweaks(items.map((i: any) => ({ id: i.id, name: i.name, type: i.type, system: i.system })));
    const docs = sumTweaks(items);
    assert.deepEqual(docs, plain);
    assert.equal(docs.attributes['body'], 11);
  }));
  test('packed goggles and an accessory on a gun in a left-behind bag give nothing; taken out they count', () => withRules(() => {
    const items = onActor([gear('bag', { container: true }), gear('goggles', {}, { flags: link('bag', 'inside'), system: { tweaks: tw(1) } }), weapon('gun', {}, {}), gear('laser', { accessory: 'laserSight' }, { flags: link('gun', 'mounted'), system: { tweaks: tw(2) } }), gear('pack2', { container: true }, { system: { carried: false } })]);
    assert.equal(sumTweaks(items).attributes['body'] ?? 0, 2, 'the packed goggles stop; the laser on a carried gun counts');
    items[2].flags = link('pack2', 'inside');
    assert.equal(sumTweaks(items).attributes['body'] ?? 0, 0, 'the gun went into a bag left behind: its laser goes with it');
    items[1].flags = {};
    assert.equal(sumTweaks(items).attributes['body'] ?? 0, 1);
  }));
  test('wiring: models pass the item documents; the HUD reads carried from the document', () => {
    assert.match(read('src', 'module', 'models', 'index.ts'), /const tw = sumTweaks\(\[\.\.\.\(\(this as any\)\.parent\?\.items \?\? \[\]\)\], \{ recovering: healing, adeptOver: overIds \}\);/);
    assert.match(read('src', 'module', 'applications', 'tah.ts'), /if \(i\.type === 'weapon'\) system\['carried'\] = isCarried\(i\);/);
  });
});

describe('v0.94.2 review 4: saving an off-deck program keeps its stored loaded', () => {
  test('the sheet drops system.loaded from the form while the program\'s deck is not in use', () => {
    const sheets = read('src', 'module', 'applications', 'sheets.ts');
    const at = sheets.indexOf('doc.system?.nest942Derived?.offDeck');
    assert.ok(at > 0);
    assert.ok(at < sheets.indexOf('if (data && doc.type === "program" && doc.parent?.swapProgram)'), 'before the Swap Memory compare');
    assert.match(sheets.slice(at, at + 300), /delete flatO\["system\.loaded"\]/);
  });
  test('the effective value is false off-deck while the stored one stays true (what the form must not write)', () => {
    const items = onActor([{ id: 'deck', type: 'cyberdeck', name: 'deck', system: { active: false }, flags: {} }, { id: 'p', type: 'program', name: 'p', system: { loaded: true }, flags: link('deck', 'mounted') }]);
    const p = items[1];
    nestDerived942(Object.assign(p.system, { parent: p }));
    assert.equal(p.system.loaded, false);
    assert.equal(p.system.nest942Derived.offDeck, true);
    assert.equal(p._source.system.loaded, true);
  });
});

describe('v0.94.2 review 13: "Back to fields" leaves damaged and used-up accessories as items', () => {
  test('only working converted accessories go back into the fields', async () => {
    const items = onActor([weapon('gun'), gear('sc', { accessory: 'scope', rating: 2 }, { flags: link('gun', 'mounted', { conv: true }), system: { damaged: true } }), gear('las', { accessory: 'laserSight' }, { flags: link('gun', 'mounted', { conv: true }) }), gear('gy', { accessory: 'gyro', rating: 3 }, { flags: link('gun', 'mounted', { conv: true }), system: { quantity: 0 } })]);
    const gun = items[0]; const actor = gun.parent;
    const updates: any[] = []; const deleted: string[] = [];
    gun.isOwner = true;
    gun.update = async (u: any) => { updates.push(u); };
    actor.deleteEmbeddedDocuments = async (_t: string, ids: string[]) => { deleted.push(...ids); };
    assert.equal(await accessoryItemsToFields(gun, { quiet: true }), 1);
    assert.deepEqual(updates, [{ 'system.laserSight': true }]);
    assert.deepEqual(deleted, ['las']);
  });
});

describe('v0.94.2 (lead, test plan): conversions run once at a time; a non-owner\'s sheet takes a gift drop', () => {
  test('a second "Make accessory items" click while the first writes does nothing, and the weapon is read again', async () => {
    const { makeAccessoryItems } = await import('../applications/nesting942.ts');
    const items = onActor([weapon('gun', { laserSight: true, scope: 2 })]);
    const gun = items[0]; const actor = gun.parent;
    gun.isOwner = true;
    let creates = 0;
    actor.createEmbeddedDocuments = async (_t: string, list: any[]) => { creates++; await new Promise((r) => setTimeout(r, 5)); return list.map((d, n) => ({ ...d, id: `new${creates}${n}` })); };
    gun.update = async (u: any) => { for (const [k, v] of Object.entries(u)) gun._source.system[k.replace('system.', '')] = v; };
    const [a, b] = await Promise.all([makeAccessoryItems(gun, { quiet: true }), makeAccessoryItems(gun, { quiet: true })]);
    assert.deepEqual([a, b], [2, 0]);
    assert.equal(creates, 1);
    assert.equal(await makeAccessoryItems(gun, { quiet: true }), 0, 'the fields were cleared: nothing left to convert');
  });
  test('sheetTakesDrops: an editable sheet always; any actor sheet while trading is on', async () => {
    const { sheetTakesDrops } = await import('../applications/drops.ts');
    const g: any = globalThis;
    const prev = g.game;
    try {
      g.game = { settings: { get: () => true } };
      assert.equal(sheetTakesDrops({ document: { documentName: 'Actor' } }, false), true);
      g.game = { settings: { get: () => false } };
      assert.equal(sheetTakesDrops({ document: { documentName: 'Actor' } }, false), false);
      assert.equal(sheetTakesDrops({ document: { documentName: 'Actor' } }, true), true);
    } finally { g.game = prev; }
    const sheets = read('src', 'module', 'applications', 'sheets.ts');
    assert.equal((sheets.match(/_canDragDrop\(selector: string\): boolean \{/g) ?? []).length, 2, 'character (npc, spirit) and vehicle sheets');
    assert.match(sheets, /if \(!this\.document\?\.isOwner && data\?\.type !== "Item"\) return;/);
    assert.match(read('src', 'module', 'applications', 'safehouse.ts'), /sheetTakesDrops\(this,/);
  });
});
