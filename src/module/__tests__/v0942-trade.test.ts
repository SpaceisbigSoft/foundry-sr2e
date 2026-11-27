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
    const owns = (set: string[]) => ({ authorIsGm: false, owns: (u: string) => set.includes(u), transferPlain: () => true });
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
    assert.ok(chat.includes("const r = await applyTransferAsGm(v, message.author ?? null, 'card', { plainOnly: autoButtons.has(button) });"));
    const body = chat.slice(chat.indexOf('async function onApplyTransfer('), chat.indexOf('/** Patch cards being applied'));
    assert.ok(body.indexOf('gmApplyFlag(') < body.indexOf('gmLocked('), 'the dialog before the lock');
  });
  test('the GM side reads ownership and the loot mark from the documents and never queues on the lock', () => {
    const body = glue.slice(glue.indexOf('export async function applyTransferAsGm('), glue.indexOf('/** Post the GM-apply card'));
    assert.ok(body.includes('userOwns(user, from)') && body.includes('userOwns(user, to)'));
    assert.ok(body.includes('gmMayTransfer(r.kind, who, fa?.loot ?? null, via)'));
    assert.ok(body.includes('transferProblems(r, fa, ta, ITEM_TYPES_FOR, nesting)'));
    assert.ok(!body.includes('withGmLock'), 'the card step and the relay already hold the lock');
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

// ---------------------------------------------------------------------------------------------------------------------
// v0.94.2 review fixes (review-0942-gear-trade.md): findings 1, 2, 5-12, 14, 15
// ---------------------------------------------------------------------------------------------------------------------
import {
  transferFamily, refusedChildren, itemExtras, transferIsPlain, lootSourceVisible, missingCreates,
} from '../rules/trade942.ts';
import { TRADE_NEST_HOOKS, NEST_FLAG as NEST, readLink as linkOf } from '../rules/nesting942.ts';
import { SYSTEM_ID as SID } from '../config/system.ts';
import { executePlan, applyTransferAsGm, requestTransfer, transferLiveLines, transferPlainNow } from '../applications/trade942.ts';
import { dropItemOnActor, ITEM_TYPES_FOR } from '../applications/drops.ts';
import { gmLockHeld } from '../applications/gmlock.ts';

class Coll extends Map<string, any> { override [Symbol.iterator](): any { return this.values(); } }
const lnk = (parent: string, kind: 'mounted' | 'inside') => ({ [SID]: { [NEST]: { parent, kind } } });
/** A fake item document on a fake actor (toObject follows later changes). */
function mkItem(parent: any, d: any): any {
  const data = JSON.parse(JSON.stringify(d));
  const it: any = { id: data._id, name: data.name, type: data.type, system: data.system ?? {}, flags: data.flags ?? {}, parent, documentName: 'Item' };
  it.toObject = () => JSON.parse(JSON.stringify({ ...data, system: it.system, flags: it.flags }));
  it.update = async (u: any) => { if ('system.quantity' in u) it.system.quantity = u['system.quantity']; return it; };
  it.delete = async () => { parent.items.delete(it.id); return it; };
  it.uuid = `${parent.uuid}.Item.${it.id}`;
  return it;
}
/** A fake actor: `refuse` item types its create skips (as the type guard does), `failDelete` makes its deletes throw. */
function fakeActor(uuid: string, type: string, items: any[], o: { name?: string; nuyen?: number; refuse?: string[]; failDelete?: boolean; loot?: any; token?: any; owners?: string[] } = {}): any {
  const a: any = { documentName: 'Actor', uuid, id: uuid.split('.').pop(), type, name: o.name ?? uuid, isOwner: true, system: { nuyen: o.nuyen ?? 0 }, items: new Coll(), log: [] as string[] };
  a.flags = { [SID]: o.loot ? { loot: o.loot } : {} };
  a.getFlag = (s: string, k: string) => a.flags?.[s]?.[k];
  a.isToken = Boolean(o.token); a.token = o.token ?? null;
  a.testUserPermission = (u: any) => Boolean(u?.isGM) || (o.owners ?? []).includes(u?.id);
  a.createEmbeddedDocuments = async (_t: string, list: any[]) => {
    a.log.push(`create:${gmLockHeld()}`);
    const out: any[] = [];
    for (const d of list) { if (o.refuse?.includes(d.type)) continue; const it = mkItem(a, d); a.items.set(it.id, it); out.push(it); }
    return out;
  };
  a.deleteEmbeddedDocuments = async (_t: string, ids: string[]) => { if (o.failDelete) throw new Error('x'); for (const id of ids) a.items.delete(id); return ids; };
  a.updateEmbeddedDocuments = async (_t: string, ups: any[]) => { for (const u of ups) { const it = a.items.get(u._id); if (it && 'system.quantity' in u) it.system.quantity = u['system.quantity']; } return ups; };
  a.update = async (u: any) => { if ('system.nuyen' in u) a.system.nuyen = u['system.nuyen']; return a; };
  for (const d of items) { const it = mkItem(a, d); a.items.set(it.id, it); }
  return a;
}
/** Foundry stand-ins for the glue: uuids resolve through `docs`; `tradeOn` and the user can be changed per test. */
function stage(docs: Record<string, any>, o: { tradeOn?: boolean; gm?: boolean; scenes?: any[] } = {}): { notes: string[]; chats: any[] } {
  const notes: string[] = []; const chats: any[] = [];
  const g: any = globalThis;
  g.game = { user: { id: 'gm1', isGM: o.gm !== false, name: 'GM' }, users: [], scenes: o.scenes ?? [], i18n: { localize: (k: string) => k, format: (k: string) => k }, settings: { get: (_s: string, k: string) => (k === 'tradeOn' ? o.tradeOn !== false : undefined) }, actors: [] };
  g.ui = { notifications: { info: (t: string) => notes.push(t), warn: (t: string) => notes.push(t), error: (t: string) => notes.push(t) } };
  g.fromUuid = async (u: string) => docs[u] ?? null;
  g.fromUuidSync = (u: string) => docs[u] ?? null;
  g.ChatMessage = { create: async (m: any) => { chats.push(m); return m; }, getSpeaker: () => ({}) };
  g.foundry = { ...(g.foundry ?? {}), utils: { ...(g.foundry?.utils ?? {}), randomID: () => Math.random().toString(36).slice(2, 12) } };
  g.Hooks = g.Hooks ?? { on: () => 0, once: () => 0, callAll: () => true };
  return { notes, chats };
}
const deckFamily = () => [
  { _id: 'deck', name: 'Fuchi', type: 'cyberdeck', system: { active: false }, flags: {} },
  { _id: 'prog1', name: 'Sleaze', type: 'program', system: { loaded: true }, flags: lnk('deck', 'mounted') },
  { _id: 'prog2', name: 'Attack', type: 'program', system: { loaded: false }, flags: lnk('deck', 'mounted') },
];
const nest = { childrenOf: TRADE_NEST_HOOKS.childrenOf };

describe('v0.94.2 review 1 (HIGH): a give never deletes children the receiver refused', () => {
  const ti = (d: any): TradeItem => ({ id: d._id, type: d.type, name: d.name, system: d.system, data: d });
  const from = actor('Actor.a', deckFamily().map(ti));
  const house = actor('Actor.h', [], { type: 'safehouse', nuyen: null });
  test('the plan check refuses a deck whose programs a safehouse can\'t hold, and names them', () => {
    const r = { kind: 'stash', fromUuid: 'Actor.a', toUuid: 'Actor.h', itemId: 'deck', qty: 1 } as TransferRequest;
    assert.deepEqual(transferProblems(r, from, house, ITEM_TYPES_FOR, nest), ['childRefused']);
    assert.deepEqual(refusedChildren(r, from, house, ITEM_TYPES_FOR, nest).sort(), ['Attack', 'Sleaze']);
    assert.deepEqual(transferProblems(r, from, { ...house, type: 'character' }, ITEM_TYPES_FOR, nest), [], 'a character holds programs');
    assert.deepEqual(transferProblems(r, from, house, ITEM_TYPES_FOR), [], 'without the nesting hook, nothing goes along');
    assert.deepEqual(transferFamily(r, from, nest).map((i) => i.id), ['deck', 'prog1', 'prog2']);
  });
  test('missingCreates names what the receiver didn\'t make', () => {
    assert.deepEqual(missingCreates({ target: { create: [{ _id: 'a' }, { _id: 'b' }], updates: [], keepIds: true } }, ['a']), ['b']);
    assert.deepEqual(missingCreates({ target: { create: [{ _id: 'a' }], updates: [], keepIds: true } }, ['a']), []);
  });
  test('executePlan: a create the receiver refuses undoes the receiver and leaves the giver whole', async () => {
    stage({});
    const a = fakeActor('Actor.a', 'character', deckFamily());
    const h = fakeActor('Actor.h', 'safehouse', [], { refuse: ['program'] });
    const r = { kind: 'stash', fromUuid: 'Actor.a', toUuid: 'Actor.h', itemId: 'deck', qty: 1 } as TransferRequest;
    const { tradeActorOf } = await import('../applications/trade942.ts');
    const plan = planTransfer(r, tradeActorOf(a)!, tradeActorOf(h)!, { ...TRADE_NEST_HOOKS, scope: SID });
    await assert.rejects(executePlan(a, h, plan, r));
    assert.deepEqual([...a.items.keys()].sort(), ['deck', 'prog1', 'prog2'], 'the giver keeps the deck and both programs');
    assert.equal(h.items.size, 0, 'the deck made on the receiver is taken back');
  });
  test('the GM card and relay path refuse it with the names, and nothing moves', async () => {
    const a = fakeActor('Actor.a', 'character', deckFamily(), { owners: ['p1'] });
    const h = fakeActor('Actor.h', 'safehouse', [], { refuse: ['program'] });
    stage({ 'Actor.a': a, 'Actor.h': h });
    const res = await applyTransferAsGm({ kind: 'stash', fromUuid: 'Actor.a', toUuid: 'Actor.h', itemId: 'deck', qty: 1 }, { id: 'p1', isGM: false, name: 'P' }, 'card');
    assert.equal(res.ok, false);
    assert.ok(res.note!.includes('Sleaze') && res.note!.includes('Attack'), String(res.note));
    assert.equal(a.items.size, 3);
    assert.equal(h.items.size, 0);
  });
});

describe('v0.94.2 review 2 (HIGH): what a give carries is shown, and never applies by itself', () => {
  const tweak = { id: 't1', label: 'Weak', target: 'attribute', key: 'body', value: -6, on: true };
  const fx = { _id: 'e1', name: 'Curse', changes: [{ key: 'system.attributes.body.value', mode: 2, value: '-6' }], disabled: false, transfer: true };
  const stick = (o: any = {}) => ({ _id: 'cs', name: 'Credstick', type: 'gear', system: { quantity: 1, tweaks: o.tweaks ?? [] }, flags: o.flags ?? {}, effects: o.effects ?? [] });
  test('itemExtras and transferIsPlain: tweaks and effects make an item not plain; a child counts too', () => {
    const ti = (d: any): TradeItem => ({ id: d._id, type: d.type, name: d.name, system: d.system, data: d });
    assert.equal(itemExtras(ti(stick())), null);
    const x = itemExtras(ti(stick({ tweaks: [tweak], effects: [fx] })))!;
    assert.equal(x.tweaks.length, 1);
    assert.ok(x.effects[0]!.changes[0]!.includes('system.attributes.body.value') && x.effects[0]!.changes[0]!.includes('-6'));
    const r = { kind: 'give', fromUuid: 'A', toUuid: 'B', itemId: 'cs', qty: 1 } as TransferRequest;
    assert.equal(transferIsPlain(r, actor('A', [ti(stick())]), nest), true);
    assert.equal(transferIsPlain(r, actor('A', [ti(stick({ effects: [fx] }))]), nest), false);
    const bag = { _id: 'bag', name: 'Bag', type: 'gear', system: { quantity: 1, nest942: { container: true } }, flags: {} };
    const inBag = { ...stick({ tweaks: [tweak] }), flags: lnk('bag', 'inside') };
    assert.equal(transferIsPlain({ ...r, itemId: 'bag' }, actor('A', [ti(bag), ti(inBag)]), nest), false, 'a child with a tweak');
    assert.equal(transferIsPlain({ ...r, itemId: 'nope' }, actor('A', [ti(bag)]), nest), false);
    assert.equal(transferIsPlain({ kind: 'give', fromUuid: 'A', toUuid: 'B', nuyen: 5 } as TransferRequest, null, nest), true);
  });
  test('safeAutoApply: a give of the author\'s own item applies by itself only when it is plain', () => {
    const f = { transfer: { kind: 'give', fromUuid: 'Actor.a', toUuid: 'Actor.b', itemId: 'cs', qty: 1 } };
    const trust = (plain: boolean | undefined) => ({ authorIsGm: false, owns: (u: string) => u === 'Actor.a', ...(plain === undefined ? {} : { transferPlain: () => plain }) });
    assert.equal(safeAutoApply('applyTransfer', f, trust(true)), true, 'normal items still auto-apply');
    assert.equal(safeAutoApply('applyTransfer', f, trust(false)), false);
    assert.equal(safeAutoApply('applyTransfer', f, trust(undefined)), false, 'no reading of the documents: the GM looks');
  });
  test('on the GM client: the confirmation lists the tweak, the effect and the flags; transferPlainNow reads the documents', () => {
    const a = fakeActor('Actor.a', 'character', [stick({ tweaks: [tweak], effects: [fx], flags: { [SID]: { focusMagicLost: true } } }), { ...stick(), _id: 'plain' }]);
    stage({ 'Actor.a': a, 'Actor.b': fakeActor('Actor.b', 'character', []) });
    const lines = transferLiveLines({ kind: 'give', fromUuid: 'Actor.a', toUuid: 'Actor.b', itemId: 'cs', qty: 1 }).join('\n');
    assert.ok(lines.includes('-6') && lines.includes('Curse') && lines.includes('system.attributes.body.value') && lines.includes('focusMagicLost'), lines);
    assert.equal(transferPlainNow({ kind: 'give', fromUuid: 'Actor.a', toUuid: 'Actor.b', itemId: 'cs', qty: 1 }), false);
    assert.equal(transferPlainNow({ kind: 'give', fromUuid: 'Actor.a', toUuid: 'Actor.b', itemId: 'plain', qty: 1 }), true);
  });
  test('applying by itself (plainOnly), such an item is refused; the GM\'s click moves it', async () => {
    const a = fakeActor('Actor.a', 'character', [stick({ effects: [fx] })], { owners: ['p1'] });
    const b = fakeActor('Actor.b', 'character', []);
    stage({ 'Actor.a': a, 'Actor.b': b });
    const req = { kind: 'give', fromUuid: 'Actor.a', toUuid: 'Actor.b', itemId: 'cs', qty: 1 };
    const p1 = { id: 'p1', isGM: false, name: 'P' };
    assert.equal((await applyTransferAsGm(req, p1, 'card', { plainOnly: true })).ok, false);
    assert.equal(a.items.size, 1);
    assert.equal((await applyTransferAsGm(req, p1, 'card')).ok, true);
    assert.equal(b.items.size, 1);
  });
  test('wiring: cardTrust passes the document read; the card applies with plainOnly when it is the auto-apply\'s', () => {
    assert.match(read('src', 'module', 'applications', 'trust.ts'), /transferPlain: transferPlainNow/);
    assert.match(read('src', 'module', 'rules', 'trust.ts'), /trust\.transferPlain\?\.\(f\) === true/);
  });
});

describe('v0.94.2 review 6, 9-12, 15: the GM lock, two GMs, trading off, hidden loot, one actor, escaping', () => {
  const gun = { _id: 'g1', name: 'Ares', type: 'weapon', system: { quantity: 1 }, flags: {} };
  test('6: a GM\'s own direct transfer writes under the GM lock (and a player\'s own doesn\'t queue)', async () => {
    const a = fakeActor('Actor.a', 'npc', [gun]);
    const b = fakeActor('Actor.b', 'character', []);
    stage({ 'Actor.a': a, 'Actor.b': b });
    assert.equal(await requestTransfer({ kind: 'give', fromUuid: 'Actor.a', toUuid: 'Actor.b', itemId: 'g1', qty: 1 }), true);
    assert.deepEqual(b.log, ['create:true']);
    assert.equal(a.items.size, 0);
    const c = fakeActor('Actor.c', 'character', []);
    stage({ 'Actor.b': b, 'Actor.c': c }, { gm: false });
    assert.equal(await requestTransfer({ kind: 'stash', fromUuid: 'Actor.b', toUuid: 'Actor.c', itemId: 'g1', qty: 1 }), true);
    assert.deepEqual(c.log, ['create:false']);
  });
  test('9: the card is claimed (applied flag set) before it moves and released on failure, inside the lock', () => {
    const chat = read('src', 'module', 'applications', 'chat.ts');
    const body = chat.slice(chat.indexOf('async function onApplyTransfer('), chat.indexOf('/** Patch cards being applied'));
    const locked = body.slice(body.indexOf('gmLocked('));
    assert.ok(locked.indexOf("if (message.getFlag(SYSTEM_ID, 'transferApplied')) return;") < locked.indexOf("setFlag(SYSTEM_ID, 'transferApplied', true)"));
    assert.ok(locked.indexOf("setFlag(SYSTEM_ID, 'transferApplied', true)") < locked.indexOf('applyTransferAsGm('));
    assert.match(locked, /if \(!r\.ok\) \{ await message\.setFlag\(SYSTEM_ID, 'transferApplied', false\)/);
  });
  test('10: with trading off the card and the relay are refused', async () => {
    const a = fakeActor('Actor.a', 'npc', [gun], { loot: { on: true, free: true } });
    const b = fakeActor('Actor.b', 'character', [], { owners: ['p1'] });
    stage({ 'Actor.a': a, 'Actor.b': b }, { tradeOn: false });
    const res = await applyTransferAsGm({ kind: 'loot', fromUuid: 'Actor.a', toUuid: 'Actor.b', itemId: 'g1', qty: 1 }, { id: 'p1', isGM: false }, 'relay');
    assert.equal(res.ok, false);
    assert.equal(a.items.size, 1);
  });
  test('11: a player can\'t loot an actor whose tokens are all hidden; a shown one is fine', async () => {
    assert.equal(lootSourceVisible([{ hidden: true }]), false);
    assert.equal(lootSourceVisible([{ hidden: true }, { hidden: false }]), true);
    assert.equal(lootSourceVisible([]), false);
    const p1 = { id: 'p1', isGM: false };
    const req = { kind: 'loot', fromUuid: 'Actor.a', toUuid: 'Actor.b', itemId: 'g1', qty: 1 };
    const tok = { hidden: true };
    const a = fakeActor('Actor.a', 'npc', [gun], { loot: { on: true, free: true }, token: tok });
    const b = fakeActor('Actor.b', 'character', [], { owners: ['p1'] });
    stage({ 'Actor.a': a, 'Actor.b': b });
    assert.equal((await applyTransferAsGm(req, p1, 'relay')).ok, false);
    tok.hidden = false;
    assert.equal((await applyTransferAsGm(req, p1, 'relay')).ok, true);
    // A world actor: its linked tokens on the scenes.
    const w = fakeActor('Actor.w', 'npc', [{ ...gun, _id: 'g2' }], { loot: { on: true, free: true } });
    const scene = { tokens: [{ actorLink: true, actorId: 'w', hidden: true }] };
    stage({ 'Actor.w': w, 'Actor.b': b }, { scenes: [scene] });
    assert.equal((await applyTransferAsGm({ ...req, fromUuid: 'Actor.w', itemId: 'g2' }, p1, 'relay')).ok, false);
  });
  test('12: two uuids for one actor are the same actor (nothing is written)', async () => {
    const a = fakeActor('Actor.a', 'character', [gun], { nuyen: 100 });
    stage({ 'Actor.a': a, 'Scene.s.Token.t.Actor.a': a });
    const res = await applyTransferAsGm({ kind: 'give', fromUuid: 'Actor.a', toUuid: 'Scene.s.Token.t.Actor.a', nuyen: 40 }, { id: 'gm', isGM: true }, 'card');
    assert.equal(res.ok, false);
    assert.equal(a.system.nuyen, 100);
    assert.equal(await requestTransfer({ kind: 'give', fromUuid: 'Actor.a', toUuid: 'Scene.s.Token.t.Actor.a', nuyen: 40 }), false);
    assert.equal(a.system.nuyen, 100);
  });
  test('15: notes are plain text (escaped once, where they are shown)', async () => {
    const a = fakeActor('Actor.a', 'character', [gun]);
    stage({ 'Actor.a': a, 'Actor.b': fakeActor('Actor.b', 'character', []) });
    const res = await applyTransferAsGm({ kind: 'give', fromUuid: 'Actor.a', toUuid: 'Actor.b', itemId: 'g1', qty: 1 }, { id: 'x', isGM: false, name: 'A&B' }, 'card');
    assert.ok(res.note!.includes('A&B') && !res.note!.includes('&amp;'), String(res.note));
  });
});

describe('v0.94.2 review 1, 5, 7, 8: a drag between sheets', () => {
  const sheetOf = (actor: any) => ({ actor });
  const setup = () => {
    (globalThis as any).Item = { implementation: { create: async (d: any, o: any) => (await o.parent.createEmbeddedDocuments('Item', [d]))[0] ?? null } };
  };
  const pistol = (id: string, flags: any = {}) => ({ _id: id, name: 'Ares Predator', type: 'weapon', system: { quantity: 1, damage: '9M' }, flags });
  const scope = { _id: 'sc', name: 'Scope', type: 'gear', system: { quantity: 1, nest942: { accessory: 'scope', rating: 2 } }, flags: lnk('gunA', 'mounted') };
  test('5: a gun with an accessory never merges into the receiver\'s identical gun; the scope goes on the new one', async () => {
    const a = fakeActor('Actor.a', 'character', [pistol('gunA'), scope]);
    const b = fakeActor('Actor.b', 'character', [pistol('gunB')]);
    stage({}); setup();
    const made = await dropItemOnActor(sheetOf(b), {}, a.items.get('gunA'), async () => null);
    assert.ok(made && made.id !== 'gunB');
    assert.equal(b.items.get('gunB').system.quantity, 1, 'the plain gun is not a stack of two');
    assert.equal(linkOf(b.items.get('sc'))?.parent, made.id);
    assert.equal(a.items.size, 0);
  });
  test('5: a plain gun doesn\'t join a receiver\'s gun that has an accessory', async () => {
    const a = fakeActor('Actor.a', 'character', [pistol('gunA')]);
    const b = fakeActor('Actor.b', 'character', [pistol('gunB'), { ...scope, flags: lnk('gunB', 'mounted') }]);
    stage({}); setup();
    const made = await dropItemOnActor(sheetOf(b), {}, a.items.get('gunA'), async () => null);
    assert.ok(made && made.id === 'gunA');
    assert.equal(b.items.get('gunB').system.quantity, 1);
  });
  test('1: a deck dragged to a safehouse with its programs is refused whole; the giver keeps everything', async () => {
    const a = fakeActor('Actor.a', 'character', deckFamily());
    const h = fakeActor('Actor.h', 'safehouse', [], { refuse: ['program'] });
    const { notes } = stage({}); setup();
    assert.equal(await dropItemOnActor(sheetOf(h), {}, a.items.get('deck'), async () => null), null);
    assert.equal(a.items.size, 3);
    assert.equal(h.items.size, 0);
    assert.ok(notes.some((n) => n.includes('Sleaze')), notes.join('|'));
  });
  test('7: when the giver can\'t be changed, the parent and its carried children are both undone', async () => {
    const a = fakeActor('Actor.a', 'character', [pistol('gunA'), scope], { failDelete: true });
    const b = fakeActor('Actor.b', 'character', []);
    stage({}); setup();
    assert.equal(await dropItemOnActor(sheetOf(b), {}, a.items.get('gunA'), async () => null), null);
    assert.equal(b.items.size, 0, 'no orphaned scope on the receiver');
    assert.equal(a.items.size, 2);
  });
  test('8: an item dragged out of a bag arrives without its old parent link', async () => {
    const bag = { _id: 'bag', name: 'Bag', type: 'gear', system: { quantity: 1, nest942: { container: true } }, flags: {} };
    const knife = { _id: 'kn', name: 'Knife', type: 'weapon', system: { quantity: 1 }, flags: lnk('bag', 'inside') };
    const a = fakeActor('Actor.a', 'character', [bag, knife]);
    const b = fakeActor('Actor.b', 'character', []);
    stage({}); setup();
    const made = await dropItemOnActor(sheetOf(b), {}, a.items.get('kn'), async () => null);
    assert.equal(linkOf(made), null);
  });
});

describe('v0.94.2 review 14: the catalogue save', () => {
  const st = (docId: string, id: string): Stored => ({ docId, template: { id, type: 'gear', name: id, system: {} } as any });
  test('a save removes only compendium items the saving list could have known', () => {
    const stored = [st('d1', 't1'), st('d2', 'p-d2'), st('d3', 't3')];
    const plan = catalogueSyncPlan(stored, [stored[0]!.template], { removable: new Set(['d3']) });
    assert.deepEqual(plan.remove, ['d3'], 'the hand-placed item the list never saw stays');
    assert.deepEqual(catalogueSyncPlan(stored, [stored[0]!.template]).remove.sort(), ['d2', 'd3'], 'without the set, as before');
  });
  test('the move runs on the write queue, and a save passes what the store knew when it was called', () => {
    const src = read('src', 'module', 'applications', 'catalogue942.ts');
    assert.match(src, /export function migrateCatalogue942\(\): Promise<number> \{\n[^\n]*\n\s*return onWriting\(migrateNow\);/);
    assert.match(src, /const known = new Set\(catalogueInPack\(\) \? \(stored \?\? \[\]\)\.map\(\(s\) => s\.docId\) : \[\]\);/);
    assert.match(src, /catalogueSyncPlan\(stored \?\? \[\], clean, \{ removable: known \}\)/);
  });
});
