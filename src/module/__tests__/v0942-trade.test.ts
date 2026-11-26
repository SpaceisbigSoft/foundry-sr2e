/**
 * v0.94.2 (improvement plan items 28 and 32): give, stash and loot (rules/trade942.ts, applications/trade942.ts and its
 * wiring), and the GM's catalogue in a world compendium (rules/catalogue942.ts, applications/catalogue942.ts).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  lootMarkOf, transferRoute, gmMayTransfer, transferShapeOk, transferProblems, planTransfer, tradeable, tradeableItems, tradeStackKey, tradeStackSize,
  countAnswer, MAX_TRANSFER_NUYEN, type TradeActor, type TradeItem, type TransferRequest,
} from '../rules/trade942.ts';
import {
  sparseSystem, templateFromPackItem, packDataFromTemplate, catalogueSyncPlan, migrationPlan, oldCopyCovered, templateSignature, CATALOGUE_PACK_NAME,
  type Stored,
} from '../rules/catalogue942.ts';
import { GM_APPLY_SPECS, gmApplyShapeOk, safeAutoApply, describeGmChange, cardSourceUuids } from '../rules/trust.ts';
import { gearStackKey } from '../rules/catalogue.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

const item = (id: string, type: string, name: string, system: Record<string, any> = {}, flags: Record<string, any> = {}): TradeItem =>
  ({ id, type, name, system, data: { _id: id, name, type, system: { ...system }, flags } });
const actor = (uuid: string, items: TradeItem[], o: Partial<TradeActor> = {}): TradeActor => ({ uuid, type: 'character', items, nuyen: 0, loot: null, ...o });
const TYPES = { character: ['weapon', 'armor', 'gear', 'cyberware', 'focus', 'cyberdeck', 'skill'], safehouse: ['weapon', 'armor', 'gear', 'cyberware', 'focus', 'cyberdeck'], host: [] };

describe('v0.94.2 trade: routes and the GM-side check (item 28)', () => {
  test('the GM and a player who owns both move it at once', () => {
    assert.equal(transferRoute('give', { isGm: true, ownsFrom: false, ownsTo: false }, null), 'direct');
    assert.equal(transferRoute('stash', { isGm: false, ownsFrom: true, ownsTo: true }, null), 'direct');
    assert.equal(transferRoute('loot', { isGm: false, ownsFrom: true, ownsTo: true }, null), 'direct', 'your own actor needs no loot mark');
  });
  test('give to someone else: a card; not your item: refused', () => {
    assert.equal(transferRoute('give', { isGm: false, ownsFrom: true, ownsTo: false }, null), 'card');
    assert.equal(transferRoute('give', { isGm: false, ownsFrom: false, ownsTo: true }, null), 'refused');
    assert.equal(transferRoute('stash', { isGm: false, ownsFrom: false, ownsTo: false }, null), 'refused');
  });
  test('loot: a card, the relay when free for all, refused when not lootable or not into your own', () => {
    const who = { isGm: false, ownsFrom: false, ownsTo: true };
    assert.equal(transferRoute('loot', who, { on: true, free: false }), 'card');
    assert.equal(transferRoute('loot', who, { on: true, free: true }), 'relay');
    assert.equal(transferRoute('loot', who, null), 'refused');
    assert.equal(transferRoute('loot', { ...who, ownsTo: false }, { on: true, free: true }), 'refused');
  });
  test('the GM side: give needs the author to own the giver; loot a lootable source and the author\'s own receiver', () => {
    assert.equal(gmMayTransfer('give', { isGm: false, ownsFrom: true, ownsTo: false }, null, 'card'), true);
    assert.equal(gmMayTransfer('give', { isGm: false, ownsFrom: false, ownsTo: true }, null, 'card'), false, 'a forged give of someone else\'s item');
    assert.equal(gmMayTransfer('give', { isGm: false, ownsFrom: true, ownsTo: false }, null, 'relay'), false, 'a give never goes through the relay');
    assert.equal(gmMayTransfer('loot', { isGm: false, ownsFrom: false, ownsTo: true }, { on: true, free: false }, 'card'), true);
    assert.equal(gmMayTransfer('loot', { isGm: false, ownsFrom: false, ownsTo: true }, { on: true, free: false }, 'relay'), false, 'the relay only for free for all');
    assert.equal(gmMayTransfer('loot', { isGm: false, ownsFrom: false, ownsTo: true }, { on: true, free: true }, 'relay'), true);
    assert.equal(gmMayTransfer('loot', { isGm: false, ownsFrom: false, ownsTo: true }, null, 'card'), false, 'no longer lootable');
    assert.equal(gmMayTransfer('loot', { isGm: false, ownsFrom: false, ownsTo: false }, { on: true, free: true }, 'relay'), false);
    assert.equal(gmMayTransfer('loot', { isGm: true, ownsFrom: false, ownsTo: false }, null, 'relay'), true);
  });
  test('the loot mark: only {on: true}; null and junk are not lootable', () => {
    assert.deepEqual(lootMarkOf({ on: true }), { on: true, free: false });
    assert.deepEqual(lootMarkOf({ on: true, free: true }), { on: true, free: true });
    for (const v of [null, undefined, true, 'yes', [], { on: 'true' }, { free: true }]) assert.equal(lootMarkOf(v), null);
  });
});

describe('v0.94.2 trade: request shape and checks (item 28)', () => {
  const base = { kind: 'give', fromUuid: 'Actor.a', toUuid: 'Actor.b' };
  test('exactly one of an item or nuyen, bounded', () => {
    assert.ok(transferShapeOk({ ...base, itemId: 'i1', qty: 2 }));
    assert.ok(transferShapeOk({ ...base, itemId: 'i1' }));
    assert.ok(transferShapeOk({ ...base, nuyen: 500 }));
    assert.ok(!transferShapeOk({ ...base, itemId: 'i1', nuyen: 5 }));
    assert.ok(!transferShapeOk({ ...base }));
    assert.ok(!transferShapeOk({ ...base, nuyen: 0 }));
    assert.ok(!transferShapeOk({ ...base, nuyen: MAX_TRANSFER_NUYEN + 1 }));
    assert.ok(!transferShapeOk({ ...base, nuyen: '50' }));
    assert.ok(!transferShapeOk({ ...base, itemId: 'i1', qty: 0 }));
    assert.ok(!transferShapeOk({ ...base, itemId: 'i1', qty: 1.5 }));
    assert.ok(!transferShapeOk({ ...base, nuyen: 5, qty: 1 }));
    assert.ok(!transferShapeOk({ ...base, kind: 'steal', nuyen: 5 }));
    assert.ok(!transferShapeOk({ ...base, nuyen: 5, update: { x: 1 } }), 'no extra keys');
    assert.ok(!transferShapeOk({ ...base, fromUuid: '', nuyen: 5 }));
  });
  test('problems: gone, same actor, not there, not tradeable, the receiver refuses, not enough', () => {
    const med = item('m', 'gear', 'Medkit', { quantity: 3 });
    const ware = item('w', 'cyberware', 'Cybereyes', { installed: true });
    const skill = item('s', 'skill', 'Pistols', {});
    const a = actor('Actor.a', [med, ware, skill]);
    const b = actor('Actor.b', []);
    const r = (o: Partial<TransferRequest>): TransferRequest => ({ kind: 'give', fromUuid: 'Actor.a', toUuid: 'Actor.b', ...o } as TransferRequest);
    assert.deepEqual(transferProblems(r({ itemId: 'm', qty: 2 }), a, b, TYPES), []);
    assert.deepEqual(transferProblems(r({ itemId: 'm', qty: 4 }), a, b, TYPES), ['notEnough']);
    assert.deepEqual(transferProblems(r({ itemId: 'x' }), a, b, TYPES), ['noItem']);
    assert.deepEqual(transferProblems(r({ itemId: 'w' }), a, b, TYPES), ['notTradeable']);
    assert.deepEqual(transferProblems(r({ itemId: 's' }), a, b, TYPES), ['notTradeable']);
    assert.deepEqual(transferProblems(r({ itemId: 'm' }), a, { ...b, type: 'host' }, TYPES), ['targetRefuses']);
    assert.deepEqual(transferProblems(r({ itemId: 'm' }), null, b, TYPES), ['noSource']);
    assert.deepEqual(transferProblems(r({ itemId: 'm' }), a, null, TYPES), ['noTarget']);
    assert.deepEqual(transferProblems(r({ itemId: 'm' }), a, a, TYPES), ['sameActor']);
    assert.deepEqual(transferProblems(r({ nuyen: 10 }), { ...a, nuyen: 5 }, b, TYPES), ['notEnoughNuyen']);
    assert.deepEqual(transferProblems(r({ nuyen: 10 }), { ...a, nuyen: 50 }, { ...b, type: 'safehouse', nuyen: null }, TYPES), ['noNuyenField']);
    assert.deepEqual(transferProblems({ kind: 'give' } as any, a, b, TYPES), ['badRequest']);
  });
  test('tradeable: physical and not installed; the list sorts by type then name and drops empty stacks', () => {
    assert.ok(tradeable({ type: 'cyberware', system: { installed: false } }));
    assert.ok(!tradeable({ type: 'spell', system: {} }));
    const list = tradeableItems([item('1', 'gear', 'Zeta'), item('2', 'weapon', 'Ares'), item('3', 'gear', 'Alpha'), item('4', 'gear', 'Empty', { quantity: 0 }), item('5', 'spell', 'Bolt')]);
    assert.deepEqual(list.map((i) => i.name), ['Ares', 'Alpha', 'Zeta']);
  });
  test('count answers', () => {
    assert.equal(countAnswer('3', 5), 3);
    assert.equal(countAnswer('6', 5), null);
    assert.equal(countAnswer('0', 5), null);
    assert.equal(countAnswer('x', 5), null);
    assert.equal(tradeStackSize({}), 1);
    assert.equal(tradeStackSize({ quantity: 4 }), 4);
  });
});

describe('v0.94.2 trade: the plan (split, merge, nuyen, nesting hooks) (item 28)', () => {
  const r = (o: Partial<TransferRequest>): TransferRequest => ({ kind: 'give', fromUuid: 'Actor.a', toUuid: 'Actor.b', ...o } as TransferRequest);
  test('part of a stack: the giver keeps the rest; the receiver gets a new stack with the count', () => {
    const a = actor('Actor.a', [item('m', 'gear', 'Medkit', { quantity: 5, medkitRating: 3 })]);
    const b = actor('Actor.b', []);
    const p = planTransfer(r({ itemId: 'm', qty: 2 }), a, b);
    assert.deepEqual(p.source, { deleteIds: [], updates: [{ _id: 'm', 'system.quantity': 3 }] });
    assert.equal(p.target.create.length, 1);
    assert.equal(p.target.create[0]!['system'].quantity, 2);
    assert.equal(p.target.create[0]!['_id'], 'm', 'keeps its id when the receiver has none like it');
    assert.equal(p.moved, 2);
    assert.equal(a.items[0]!.data['system'].quantity, 5, 'the source data is not changed');
  });
  test('a whole stack merges into the receiver\'s matching stack (gearStackKey), and is deleted from the giver', () => {
    const a = actor('Actor.a', [item('m', 'gear', 'Medkit', { quantity: 2, medkitRating: 3, description: 'mine' })]);
    const b = actor('Actor.b', [item('n', 'gear', 'medkit ', { quantity: 1, medkitRating: 3 })]);
    const p = planTransfer(r({ itemId: 'm' }), a, b);
    assert.deepEqual(p.target.updates, [{ _id: 'n', 'system.quantity': 3 }]);
    assert.deepEqual(p.target.create, []);
    assert.deepEqual(p.source.deleteIds, ['m']);
    assert.ok(p.merged);
    assert.equal(tradeStackKey('gear', 'Medkit', { medkitRating: 3 }), `gear|${gearStackKey('Medkit', { medkitRating: 3 })}`);
  });
  test('different gear (another rating, damaged) and other types with different data never merge', () => {
    const a = actor('Actor.a', [item('m', 'gear', 'Medkit', { quantity: 1, medkitRating: 4 }), item('g', 'weapon', 'Ares', { quantity: 1, ammo: 3 })]);
    const b = actor('Actor.b', [item('n', 'gear', 'Medkit', { quantity: 1, medkitRating: 3 }), item('h', 'weapon', 'Ares', { quantity: 1, ammo: 10 })]);
    assert.equal(planTransfer(r({ itemId: 'm' }), a, b).target.create.length, 1);
    assert.equal(planTransfer(r({ itemId: 'g' }), a, b).target.create.length, 1);
    const same = actor('Actor.c', [item('k', 'weapon', 'Ares', { quantity: 1, ammo: 3 })]);
    assert.deepEqual(planTransfer(r({ itemId: 'g', toUuid: 'Actor.c' }), a, same).target.updates, [{ _id: 'k', 'system.quantity': 2 }]);
  });
  test('an id the receiver already uses: a fresh one', () => {
    const a = actor('Actor.a', [item('m', 'armor', 'Vest', { worn: true })]);
    const b = actor('Actor.b', [item('m', 'gear', 'Other', {})]);
    const p = planTransfer(r({ itemId: 'm' }), a, b, { makeId: () => 'fresh0000000001' });
    assert.equal(p.target.create[0]!['_id'], 'fresh0000000001');
  });
  test('arrival reset (not worn) and the clutter (folder, sort, ownership) left out', () => {
    const v = item('v', 'armor', 'Vest', { worn: true });
    v.data['folder'] = 'f'; v.data['sort'] = 5; v.data['ownership'] = { default: 3 };
    const p = planTransfer(r({ itemId: 'v' }), actor('Actor.a', [v]), actor('Actor.b', []), { arrival: (type, s) => (type === 'armor' && s.worn ? { worn: false } : {}) });
    const d = p.target.create[0]!;
    assert.equal(d['system'].worn, false);
    assert.equal(d['folder'], undefined); assert.equal(d['sort'], undefined); assert.equal(d['ownership'], undefined);
  });
  test('nesting hook: children go with the whole item, its parent link is cleared, children relinked on a new id', () => {
    const box = item('box', 'gear', 'Case', { quantity: 1 }, { sr2e: { parentId: 'bag', other: 1 } });
    const kid = item('kid', 'gear', 'Clip', { quantity: 1 }, { sr2e: { parentId: 'box' } });
    const a = actor('Actor.a', [box, kid]);
    const childrenOf = (i: TradeItem, all: readonly TradeItem[]) => all.filter((x) => (x.data['flags']?.sr2e?.parentId) === i.id);
    const relink = (c: Record<string, any>, _o: string, n: string) => ({ ...c, flags: { sr2e: { parentId: n } } });
    const p = planTransfer(r({ itemId: 'box' }), a, actor('Actor.b', [item('box', 'gear', 'Taken')]), { childrenOf, clearFlags: ['parentId'], relink, makeId: () => 'newbox000000001' });
    assert.deepEqual(p.source.deleteIds, ['box', 'kid']);
    assert.deepEqual(p.children, ['kid']);
    assert.equal(p.target.create.length, 2);
    assert.equal(p.target.create[0]!['flags'].sr2e.parentId, undefined, 'its own link cleared');
    assert.equal(p.target.create[0]!['flags'].sr2e.other, 1, 'other flags kept');
    assert.equal(p.target.create[1]!['flags'].sr2e.parentId, 'newbox000000001');
    assert.equal(p.merged, false);
    assert.equal(box.data['flags'].sr2e.parentId, 'bag', 'the source data is not changed');
  });
  test('nesting hook: part of a stack leaves the children; the default hooks do nothing', () => {
    const box = item('box', 'gear', 'Case', { quantity: 2 });
    const kid = item('kid', 'gear', 'Clip', { quantity: 1 });
    const p = planTransfer(r({ itemId: 'box', qty: 1 }), actor('Actor.a', [box, kid]), actor('Actor.b', []), { childrenOf: () => [kid] });
    assert.deepEqual(p.children, []);
    assert.deepEqual(planTransfer(r({ itemId: 'box' }), actor('Actor.a', [box, kid]), actor('Actor.b', [])).children, []);
  });
  test('a container (with children) never merges into a stack', () => {
    const box = item('box', 'gear', 'Case', { quantity: 1 });
    const kid = item('kid', 'gear', 'Clip', { quantity: 1 });
    const p = planTransfer(r({ itemId: 'box' }), actor('Actor.a', [box, kid]), actor('Actor.b', [item('c2', 'gear', 'Case', { quantity: 1 })]), { childrenOf: (i) => (i.id === 'box' ? [kid] : []) });
    assert.equal(p.merged, false);
    assert.equal(p.target.create.length, 2);
  });
  test('nuyen: the giver pays, the receiver gets it', () => {
    const p = planTransfer(r({ nuyen: 300 }), actor('Actor.a', [], { nuyen: 1000 }), actor('Actor.b', [], { nuyen: 50 }));
    assert.deepEqual(p.nuyen, { from: 700, to: 350 });
  });
});

describe('v0.94.2 trade: the GM-apply card spec (item 28)', () => {
  const flags = (t: Record<string, unknown>) => ({ transfer: t });
  const give = { kind: 'give', fromUuid: 'Actor.a', toUuid: 'Actor.b', itemId: 'i1', qty: 1, name: 'Medkit', sourceUuid: 'Actor.a' };
  test('a spec with both actors as sources, and the shape check', () => {
    assert.equal(GM_APPLY_SPECS['applyTransfer']!.flag, 'transfer');
    assert.deepEqual([...GM_APPLY_SPECS['applyTransfer']!.sources], ['fromUuid', 'toUuid']);
    assert.ok(gmApplyShapeOk('applyTransfer', flags(give)));
    assert.ok(!gmApplyShapeOk('applyTransfer', flags({ ...give, nuyen: 5 })));
    assert.deepEqual(cardSourceUuids('applyTransfer', flags(give)), ['Actor.a', 'Actor.b']);
  });
  test('auto-apply: a give of the author\'s own item may; a loot or someone else\'s item never', () => {
    const owns = (set: string[]) => ({ authorIsGm: false, owns: (u: string) => set.includes(u) });
    assert.equal(safeAutoApply('applyTransfer', flags(give), owns(['Actor.a'])), true);
    assert.equal(safeAutoApply('applyTransfer', flags(give), owns(['Actor.b'])), false);
    assert.equal(safeAutoApply('applyTransfer', flags({ ...give, kind: 'loot' }), owns(['Actor.a', 'Actor.b'])), false);
  });
  test('the confirm names both actors and what moves', () => {
    const lines = describeGmChange('applyTransfer', flags(give), (u) => ({ 'Actor.a': 'Alice', 'Actor.b': 'Bob' } as any)[u] ?? '');
    assert.ok(lines[0]!.includes('Alice') && lines[0]!.includes('Bob') && lines[0]!.includes('Medkit'), String(lines[0]));
  });
});

describe('v0.94.2 trade: wiring (item 28)', () => {
  const chat = read('src', 'module', 'applications', 'chat.ts');
  const glue = read('src', 'module', 'applications', 'trade942.ts');
  test('chat.ts: the done-flag, the auto-apply runner, the dispatch, and the handler bound to message.author under the lock', () => {
    assert.ok(chat.includes("applyTransfer: 'transferApplied',"));
    assert.ok(chat.includes('applyTransfer: onApplyTransfer,'));
    assert.ok(chat.includes("else if (action === 'applyTransfer') return onApplyTransfer(message, button);"));
    assert.ok(chat.includes("const r = await applyTransferAsGm(v, message.author ?? null, 'card');"));
    const body = chat.slice(chat.indexOf('async function onApplyTransfer('), chat.indexOf('/** Patch cards being applied'));
    assert.ok(body.indexOf('gmApplyFlag(') < body.indexOf('gmLocked('), 'the dialog before the lock');
  });
  test('the GM side reads ownership and the loot mark from the documents and never queues on the lock', () => {
    const body = glue.slice(glue.indexOf('export async function applyTransferAsGm('), glue.indexOf('/** Post the GM-apply card'));
    assert.ok(body.includes('userOwns(user, from)') && body.includes('userOwns(user, to)'));
    assert.ok(body.includes('gmMayTransfer(r.kind, who, fa?.loot ?? null, via)'));
    assert.ok(body.includes('transferProblems(r, fa, ta, ITEM_TYPES_FOR)'));
    assert.ok(!glue.includes('withGmLock'), 'the card step and the relay already hold the lock');
    assert.ok(glue.includes("onRelay('trade942', async (data, user) => applyTransferAsGm(data?.['req'], user, 'relay'));"));
  });
  test('the relay op, the drop hook, the safehouse stash, the tool and the How many? prompt', () => {
    assert.ok(read('src', 'module', 'applications', 'socket.ts').includes("| 'trade942'"));
    const drops = read('src', 'module', 'applications', 'drops.ts');
    assert.ok(drops.includes('export async function askHowMany('));
    assert.ok(drops.includes('if (actor && item && !actor.isOwner) return giveByDrop(item, actor);'));
    assert.ok(drops.includes("safehouse: ['weapon', 'armor', 'gear', 'cyberware', 'focus', 'cyberdeck']"));
    assert.ok(glue.includes('askHowMany(String(item.name), have)'));
    assert.ok(read('src', 'module', 'rules', 'tools.ts').includes("{ id: 'loot',"));
  });
  test('loot flag cleared through helpers/flags (no unsetFlag)', () => {
    assert.ok(glue.includes('await clearFlag(actor, LOOT_FLAG);'));
    assert.ok(!glue.includes('unsetFlag'));
  });
});

describe('v0.94.2 catalogue compendium (item 32)', () => {
  test('sparse system: only what differs from an empty item (nested, lists whole)', () => {
    const initial = { cost: 0, weight: 0, radio: { rating: 0, encryption: 0 }, skillMods: [] };
    assert.deepEqual(sparseSystem({ cost: 200, weight: 0, radio: { rating: 3, encryption: 0 }, skillMods: [] }, initial), { cost: 200, radio: { rating: 3 } });
    assert.deepEqual(sparseSystem({ skillMods: [{ a: 1 }] }, initial), { skillMods: [{ a: 1 }] });
    assert.deepEqual(sparseSystem({ cost: 5 }, null), { cost: 5 });
    assert.deepEqual(sparseSystem(JSON.parse('{"__proto__": {"x": 1}, "cost": 1}'), {}), { cost: 1 });
  });
  test('a compendium item and a template, both ways (template id and shop mark on the flags)', () => {
    const t = templateFromPackItem({ _id: 'd1', name: 'Medkit', type: 'gear', system: { cost: 200, weight: 0 }, flags: { sr2e: { templateId: 'w-abc', shop: true } } }, { cost: 0, weight: 0 }, 'sr2e');
    assert.deepEqual(t, { id: 'w-abc', type: 'gear', name: 'Medkit', system: { cost: 200 }, shop: true });
    const bare = templateFromPackItem({ _id: 'd2', name: 'Rope', type: 'gear', system: {} }, {}, 'sr2e');
    assert.equal(bare.id, 'p-d2');
    assert.deepEqual(packDataFromTemplate(t, 'sr2e').flags, { sr2e: { templateId: 'w-abc', shop: true } });
    assert.deepEqual(packDataFromTemplate(bare, 'sr2e').flags, { sr2e: {} }, 'a hand-placed item gets no template id');
    assert.equal(CATALOGUE_PACK_NAME, 'sr2e-item-templates', 'the compendium the old export wrote to');
  });
  const st = (docId: string, id: string, name: string, system: Record<string, unknown> = {}, shop = false): Stored => ({ docId, template: { id, type: 'gear', name, system, ...(shop ? { shop } : {}) } });
  test('a save: create, update the changed, remove the dropped; the reader\'s `world` mark is not data', () => {
    const stored = [st('d1', 'w-1', 'A', { cost: 1 }), st('d2', 'w-2', 'B'), st('d3', 'p-d3', 'C')];
    const next = [{ id: 'w-1', type: 'gear', name: 'A', system: { cost: 2 }, world: true }, { id: 'w-2', type: 'gear', name: 'B', system: {} }, { id: 'w-9', type: 'gear', name: 'New', system: {} }] as any;
    const p = catalogueSyncPlan(stored, next);
    assert.deepEqual(p.create.map((t) => t.id), ['w-9']);
    assert.deepEqual(p.update.map((u) => u.docId), ['d1']);
    assert.ok(!('world' in p.update[0]!.template));
    assert.deepEqual(p.remove, ['d3']);
    assert.deepEqual(catalogueSyncPlan(stored, next, { keepOthers: true }).remove, []);
    assert.equal(templateSignature({ id: 'x', type: 'gear', name: 'A', system: { b: 1, a: 2 } }), templateSignature({ id: 'y', type: 'gear', name: 'A', system: { a: 2, b: 1 } }));
  });
  test('the one-time move: copies the setting in, the setting wins over an old export, never removes', () => {
    const stored = [st('d1', 'w-1', 'A', { cost: 1 }), st('d5', 'p-d5', 'Hand', {}), st('d6', 'w-old', 'Renamed', {})];
    const old = [{ id: 'w-1', type: 'gear', name: 'A', system: { cost: 9 } }, { id: 'w-2', type: 'gear', name: 'B', system: {} }, { id: 'w-new', type: 'gear', name: 'Renamed', system: { cost: 3 } }];
    const p = migrationPlan(stored, old);
    assert.deepEqual(p.create.map((t) => t.id), ['w-2']);
    assert.deepEqual(p.update.map((u) => [u.docId, u.template.id]).sort(), [['d1', 'w-1'], ['d6', 'w-new']]);
    assert.deepEqual(p.remove, []);
    assert.deepEqual(oldCopyCovered(stored, old), { covered: false, missing: ['B', 'Renamed'] });
    assert.equal(oldCopyCovered([...stored, st('d7', 'w-2', 'B'), st('d6', 'w-new', 'Renamed')], old).covered, true);
  });
  test('every reader and writer of the old setting goes through the store', () => {
    for (const f of ['shop.ts', 'catalogue.ts', 'newentry.ts', 'setup.ts', 'qol.ts', 'sheets.ts']) {
      const src = read('src', 'module', 'applications', f);
      assert.ok(!/settings\.(get|set)\(\s*SYSTEM(_ID|\.id),\s*["']itemTemplates["']/.test(src), `${f} still uses the setting`);
    }
    const shop = read('src', 'module', 'applications', 'shop.ts');
    assert.ok(shop.includes('if (pack.collection === catalogueCollection()) continue;'), 'the compendium is not listed twice');
    const store = read('src', 'module', 'applications', 'catalogue942.ts');
    assert.ok(store.includes("await (game as any).settings.set(SYSTEM_ID, 'itemTemplates', []);"), 'the old copy is removed only by removeOldCatalogueCopy');
    assert.equal(store.split("settings.set(SYSTEM_ID, 'itemTemplates', []").length - 1, 1);
    assert.ok(store.indexOf('oldCopyCovered(') < store.indexOf("settings.set(SYSTEM_ID, 'itemTemplates', [])"), 'checked before');
  });
});
