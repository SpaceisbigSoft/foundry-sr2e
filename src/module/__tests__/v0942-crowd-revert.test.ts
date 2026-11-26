/**
 * v0.94.2 (improvement plan item 31): advancement-log revert with refund (rules/revert942.ts, its Apply (GM) spec in
 * rules/trust.ts and its wiring).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  keyedItemRaises, keyedActorRaises, attachUndo, revertCheck, planRevert, revertedLog, revertRoute, undoSteps, targetOf, type RevertLine, type UndoStep,
} from '../rules/revert942.ts';
import { composeAdvancement, type AdvanceEvent } from '../rules/advancement.ts';
import { GM_APPLY_SPECS, gmApplyShapeOk, safeAutoApply, cardTargetUuid, cardSourceUuids } from '../rules/trust.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

const base = { at: '2026-01-01T00:00:00Z', t: 0, by: 'Ann', approvedBy: '' };
const body = (from: number, to: number): UndoStep => ({ doc: 'actor', key: 'system.attributes.body.base', from, to, back: from, label: 'Body' });
const line = (id: string, undo?: UndoStep[], extra: Partial<RevertLine> = {}): RevertLine => ({ ...base, id, what: id, karma: 0, nuyen: 0, kind: 'gain', ...(undo ? { undo } : {}), ...extra });

describe('v0.94.2 revert: keyed raises (item 31)', () => {
  test('item raises carry their field and the raw value before', () => {
    assert.deepEqual(keyedItemRaises('skill', 'Firearms', { rating: 3 }, { 'system.rating': 4, 'system.notes': 'x' }), [{ label: 'Firearms', from: 3, to: 4, key: 'system.rating', back: 3 }]);
    // An unset specialization rating shows as the skill's rating but goes back to unset (0).
    const s = keyedItemRaises('skill', 'Firearms', { rating: 4, specialization: 'Pistols', specializationRating: 0 }, { 'system.specializationRating': 5 });
    assert.equal(s[0]!.from, 4); assert.equal(s[0]!.back, 0); assert.equal(s[0]!.key, 'system.specializationRating');
    assert.deepEqual(keyedItemRaises('skill', 'Firearms', { rating: 3 }, { 'system.rating': 2 }), []);
  });
  test('actor raises carry their field', () => {
    const r = keyedActorRaises({ attributes: { body: { base: 4 } }, magic: 6 }, { 'system.attributes.body.base': 5, 'system.magic': 5, 'system.nuyen': 9 });
    assert.equal(r.length, 1);
    assert.equal(r[0]!.key, 'system.attributes.body.base'); assert.equal(r[0]!.back, 4); assert.equal(r[0]!.to, 5);
  });
});

describe('v0.94.2 revert: attaching undo to composed lines', () => {
  test('a raise covered by a Karma line goes on that line; a lone raise on its own line', () => {
    const events: AdvanceEvent[] = [
      { kind: 'ledger', entry: { kind: 'karma', amount: -10, reason: 'Raised Body 4 → 5' } },
      { kind: 'raise', label: 'Body', from: 4, to: 5, alias: 'Body', key: 'system.attributes.body.base', back: 4 } as any,
      { kind: 'raise', label: 'Firearms', from: 3, to: 4, key: 'system.rating', back: 3, itemId: 'abc123' } as any,
    ];
    const lines = attachUndo(composeAdvancement(events, { ...base, ids: (() => { let i = 0; return () => `id${i++}`; })() }), events);
    const karma = lines.find((l) => l.karma === -10)!;
    assert.equal(karma.undo?.length, 1); assert.equal(karma.undo![0]!.doc, 'actor');
    const fa = lines.find((l) => l.what.startsWith('Firearms'))!;
    assert.deepEqual(fa.undo, [{ doc: 'item', itemId: 'abc123', key: 'system.rating', from: 3, to: 4, back: 3, label: 'Firearms' }]);
  });
  test('raises without a field (an older client) attach nothing; the input lines are not changed', () => {
    const events: AdvanceEvent[] = [{ kind: 'raise', label: 'Body', from: 4, to: 5 }];
    const composed = composeAdvancement(events, base);
    const out = attachUndo(composed, events);
    assert.equal(out[0]!.undo, undefined);
    assert.equal((composed[0] as any).undo, undefined);
  });
});

describe('v0.94.2 revert: may this line be reverted?', () => {
  const cur = (v: number) => () => v;
  test('a plain raise at its value can be', () => {
    assert.deepEqual(revertCheck([line('a', [body(4, 5)])], 'a', cur(5)), { ok: true, why: '' });
  });
  test('reasons: missing, reverted, nothing to undo, changed, item gone', () => {
    assert.equal(revertCheck([], 'a', cur(5)).why, 'missing');
    assert.equal(revertCheck([line('a', [body(4, 5)], { revertedAt: 'x' })], 'a', cur(5)).why, 'reverted');
    assert.equal(revertCheck([line('a')], 'a', cur(5)).why, 'notRevertable');
    const c = revertCheck([line('a', [body(4, 5)])], 'a', cur(6));
    assert.equal(c.why, 'changed'); assert.equal(c.now, 6); assert.equal(c.expected, 5);
    assert.equal(revertCheck([line('a', [{ ...body(4, 5), doc: 'item', itemId: 'i1' }])], 'a', () => null).why, 'itemGone');
  });
  test('only the latest un-reverted raise of a field: a later one blocks, until it is reverted', () => {
    const log = [line('a', [body(4, 5)]), line('b', [body(5, 6)])];
    const c = revertCheck(log, 'a', cur(6));
    assert.equal(c.why, 'later'); assert.equal(c.laterId, 'b');
    assert.equal(revertCheck(log, 'b', cur(6)).ok, true);
    const after = [log[0]!, { ...log[1]!, revertedAt: 'x' }];
    assert.equal(revertCheck(after, 'a', cur(5)).ok, true);
  });
  test('a later raise of another field, or the same key on another item, does not block', () => {
    const other: UndoStep = { doc: 'actor', key: 'system.magic', from: 5, to: 6, back: 5, label: 'Magic' };
    assert.equal(revertCheck([line('a', [body(4, 5)]), line('b', [other])], 'a', cur(5)).ok, true);
    const it = (id: string): UndoStep => ({ doc: 'item', itemId: id, key: 'system.rating', from: 1, to: 2, back: 1, label: id });
    assert.notEqual(targetOf(it('x')), targetOf(it('y')));
    assert.equal(revertCheck([line('a', [it('x')]), line('b', [it('y')])], 'a', cur(2)).ok, true);
  });
  test('damaged undo data counts as nothing to undo', () => {
    assert.deepEqual(undoSteps(line('a', [{ ...body(4, 5), key: 'flags.core.x' } as any])), []);
    assert.deepEqual(undoSteps(line('a', [{ ...body(4, 5), doc: 'item', itemId: '../x' } as any])), []);
    assert.deepEqual(undoSteps(line('a', [{ ...body(4, 5), back: 'NaN' } as any])), []);
  });
});

describe('v0.94.2 revert: the plan and the log', () => {
  test('puts fields back and refunds what was spent into Good Karma and nuyen', () => {
    const item: UndoStep = { doc: 'item', itemId: 'i1', key: 'system.rating', from: 3, to: 4, back: 3, label: 'Firearms' };
    const p = planRevert([line('a', [body(4, 5), item], { karma: -10, nuyen: -500 })], 'a', (s) => s.to, { karma: 2, nuyen: 100 });
    assert.equal(p.ok, true);
    assert.deepEqual(p.actor, { 'system.attributes.body.base': 4, 'system.karma.good': 12, 'system.nuyen': 600 });
    assert.deepEqual(p.items, { i1: { 'system.rating': 3 } });
    assert.deepEqual(p.refund, { karma: 10, nuyen: 500 });
  });
  test('a line that gained Karma or nuyen refunds nothing; a refused plan changes nothing', () => {
    const p = planRevert([line('a', [body(4, 5)], { karma: 3 })], 'a', (s) => s.to, { karma: 0, nuyen: 0 });
    assert.deepEqual(p.refund, { karma: 0, nuyen: 0 });
    assert.deepEqual(p.actor, { 'system.attributes.body.base': 4 });
    const no = planRevert([line('a', [body(4, 5)], { karma: -10 })], 'a', () => 7, { karma: 0, nuyen: 0 });
    assert.equal(no.ok, false); assert.deepEqual(no.actor, {}); assert.deepEqual(no.refund, { karma: 0, nuyen: 0 });
  });
  test('the line stays, marked, and a refund line follows', () => {
    const log = revertedLog([line('a', [body(4, 5)], { karma: -10 })], 'a', { by: 'GM', at: 'now', t: 5, id: 'r1', what: 'Reverted: a', refund: { karma: 10, nuyen: 0 } });
    assert.equal(log.length, 2);
    assert.equal(log[0]!.revertedAt, 'now'); assert.equal(log[0]!.revertedBy, 'GM');
    assert.equal(log[1]!.revertOf, 'a'); assert.equal(log[1]!.karma, 10); assert.equal(log[1]!.undo, undefined);
    assert.equal(revertCheck(log, 'r1', () => 0).why, 'notRevertable', 'a refund line is never reverted itself');
  });
  test('who may revert, and how', () => {
    assert.equal(revertRoute({ isGM: true, isOwner: false, locked: true }), 'direct');
    assert.equal(revertRoute({ isGM: false, isOwner: true, locked: false }), 'direct');
    assert.equal(revertRoute({ isGM: false, isOwner: true, locked: true }), 'card');
    assert.equal(revertRoute({ isGM: false, isOwner: false, locked: false }), 'none');
  });
});

describe('v0.94.2 revert: the Apply (GM) card', () => {
  const flags = (f: any) => ({ advRevert: f });
  test('its spec: only the actor and the line id; never by itself', () => {
    assert.deepEqual([...GM_APPLY_SPECS['applyAdvRevert']!.keys], ['actorUuid', 'lineId']);
    assert.equal(gmApplyShapeOk('applyAdvRevert', flags({ actorUuid: 'Actor.abc', lineId: 'xYz123' })), true);
    assert.equal(gmApplyShapeOk('applyAdvRevert', flags({ actorUuid: 'Actor.abc', lineId: 'xYz123', karma: 50 })), false);
    assert.equal(gmApplyShapeOk('applyAdvRevert', flags({ actorUuid: 'Actor.abc', lineId: '../x' })), false);
    assert.equal(safeAutoApply('applyAdvRevert', flags({ actorUuid: 'Actor.abc', lineId: 'x1' }), { authorIsGm: true, owns: () => true } as any), false);
    assert.equal(cardTargetUuid('applyAdvRevert', flags({ actorUuid: 'Actor.abc', lineId: 'x1' })), 'Actor.abc');
    assert.deepEqual(cardSourceUuids('applyAdvRevert', flags({ actorUuid: 'Actor.abc', lineId: 'x1' })), ['Actor.abc']);
  });
  test('wired: chat dispatch and done-flag, the sheet control, the hooks keep the fields', () => {
    const chat = read('src', 'module', 'applications', 'chat.ts');
    assert.match(chat, /applyAdvRevert: 'advRevertApplied'/);
    assert.match(chat, /action === 'applyAdvRevert'\) return onApplyAdvRevert/);
    assert.match(read('src', 'module', 'applications', 'sheets.ts'), /advRevert: function/);
    assert.match(read('public', 'templates', 'actor-character-sheet.hbs'), /data-action="advRevert"/);
    const adv = read('src', 'module', 'applications', 'advancement.ts');
    assert.match(adv, /attachUndo\(composeAdvancementV73/);
    assert.match(adv, /keyedItemRaises\(/);
    assert.match(adv, /itemId: item\.id/);
  });
});
