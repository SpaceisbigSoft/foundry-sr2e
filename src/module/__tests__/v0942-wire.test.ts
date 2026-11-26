/**
 * v0.94.2 (lead): the give/stash/loot core (rules/trade942.ts) wired to the item nesting (rules/nesting942.ts): a bag
 * moves with what is in it, a gun with its accessories, the moved item leaves its own parent, and every link follows
 * ids that had to change on the receiving side (a grandchild included). The safehouse shows one stash list.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planTransfer, type TradeItem, type TradeActor } from '../rules/trade942.ts';
import { TRADE_NEST_HOOKS, NEST_FLAG, readLink } from '../rules/nesting942.ts';
import { SYSTEM_ID } from '../config/system.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const mod = (...p: string[]) => readFileSync(join(ROOT, 'src', 'module', ...p), 'utf8');
const link = (parent: string, kind: 'mounted' | 'inside') => ({ [SYSTEM_ID]: { [NEST_FLAG]: { parent, kind } } });
const item = (id: string, type: string, name: string, flags: Record<string, any> = {}, system: Record<string, any> = {}): TradeItem =>
  ({ id, type, name, system, data: { _id: id, name, type, system: { ...system }, flags } });
const actor = (uuid: string, items: TradeItem[]): TradeActor => ({ uuid, type: 'character', items, nuyen: 0, loot: null });
const opts = { ...TRADE_NEST_HOOKS, scope: SYSTEM_ID };

describe('v0.94.2 trade and nesting wired', () => {
  const bag = item('bag', 'gear', 'Bag', {}, { quantity: 1, nest942: { container: true } });
  const gun = item('gun', 'weapon', 'Pistol', link('bag', 'inside'));
  const scope = item('scope', 'gear', 'Scope', link('gun', 'mounted'), { quantity: 1, nest942: { accessory: 'scope', rating: 1 } });
  const loose = item('loose', 'gear', 'Rope', {}, { quantity: 1 });
  const from = actor('A', [bag, gun, scope, loose]);

  test('the whole family moves with the bag, and the giver loses all of it', () => {
    const p = planTransfer({ kind: 'give', fromUuid: 'A', toUuid: 'B', itemId: 'bag', qty: 1 } as any, from, actor('B', []), opts);
    assert.deepEqual(p.target.create.map((d) => d['_id']).sort(), ['bag', 'gun', 'scope']);
    assert.deepEqual([...p.source.deleteIds].sort(), ['bag', 'gun', 'scope']);
  });

  test('a grandchild follows its parent when the receiver already uses its ids', () => {
    const to = actor('B', [item('bag', 'gear', 'Other'), item('gun', 'weapon', 'Other gun')]);
    const p = planTransfer({ kind: 'give', fromUuid: 'A', toUuid: 'B', itemId: 'bag', qty: 1 } as any, from, to, { ...opts, makeId: (() => { let n = 0; return () => `new${++n}`; })() });
    const byName = Object.fromEntries(p.target.create.map((d) => [d['name'], d]));
    const bagId = byName['Bag']!['_id'];
    const gunId = byName['Pistol']!['_id'];
    assert.notEqual(bagId, 'bag');
    assert.notEqual(gunId, 'gun');
    assert.equal(readLink(byName['Pistol'])?.parent, bagId);
    assert.equal(readLink(byName['Scope'])?.parent, gunId);
  });

  test('an item given out of a bag leaves the bag (its own link is cleared)', () => {
    const p = planTransfer({ kind: 'give', fromUuid: 'A', toUuid: 'B', itemId: 'gun', qty: 1 } as any, from, actor('B', []), opts);
    const moved = p.target.create.find((d) => d['_id'] === 'gun');
    assert.equal(readLink(moved), null);
    assert.equal(readLink(p.target.create.find((d) => d['_id'] === 'scope'))?.parent, 'gun');
  });

  test('the glue uses these hooks, and the safehouse shows only the trade stash while trading is on', () => {
    assert.match(mod('applications', 'trade942.ts'), /\{ \.\.\.TRADE_NEST_HOOKS \}/);
    assert.match(mod('applications', 'nesting942.ts'), /type === 'safehouse' && !tradeIsOn\(\)\) decorateSafehouseSheet/);
  });
});
