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
  gmStepsOk, raiseKeyAllowed, stepRulesKarma, planSignature, withRevertDone, revertDoneFor, saidWord, isInitiationLine, type GmRevertContext, type StepCostInfo,
} from '../rules/revert942.ts';
import { attributeKarmaCost } from '../rules/charfix.ts';
import { skillCost } from '../rules/upkeep.ts';
import { newSkillCost } from '../rules/core923.ts';
import { spellKarmaCost } from '../rules/thaumaturgy.ts';
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

// ---------------------------------------------------------------- v0.94.2 review findings 1, 4, 13, 17

/** The GM's context: Body natural 5 (max 6), a skill and a spell on the sheet, nothing reverted yet. */
const gmCtx = (o: { done?: string[]; natural?: number } = {}): GmRevertContext => ({
  itemType: (id) => ({ sk1: 'skill', sp1: 'spell', ap1: 'adeptpower' } as Record<string, string>)[id] ?? null,
  skillRating: (id) => (id === 'sk1' ? 4 : 0),
  costInfo: (st): StepCostInfo => (st.doc === 'actor' && st.key === 'system.attributes.body.base' ? { kind: 'attribute', natural: o.natural ?? 5, max: 6, augmented: 9 }
    : st.doc === 'item' && st.itemId === 'sk1' ? { kind: 'skill', skillKind: 'active', attribute: 4 } : st.doc === 'item' && st.itemId === 'sp1' ? { kind: 'spell' } : null),
  done: new Set(o.done ?? []),
});
const have = { karma: 0, nuyen: 0 };
const bodyCost5 = attributeKarmaCost({ to: 5, max: 6, augmented: 9 }).cost;

describe('v0.94.2 review (1): the GM never trusts a forged log', () => {
  test('a double refund: the GM\'s own record refuses a line it already reverted, whatever the line now says', () => {
    // The player removed revertedAt and rewrote the step to match Body 4 now.
    const forged = line('a', [{ ...body(3, 4), back: 4 }], { karma: -10 });
    const p = planRevert([forged], 'a', () => 4, have, gmCtx({ done: ['a'] }));
    assert.equal(p.ok, false); assert.equal(p.why, 'reverted'); assert.deepEqual(p.refund, { karma: 0, nuyen: 0 });
    // Under a fresh id the rewritten step still doesn't lower anything (back is not from).
    assert.equal(planRevert([{ ...forged, id: 'b' }], 'b', () => 4, have, gmCtx({ done: ['a'] })).why, 'forged');
  });
  test('a refund for nothing: a step that writes back the value it holds is refused', () => {
    const p = planRevert([line('a', [{ ...body(4, 5), back: 5 }], { karma: -200 })], 'a', () => 5, have, gmCtx());
    assert.equal(p.ok, false); assert.equal(p.why, 'forged'); assert.deepEqual(p.actor, {});
  });
  test('a "lowering" that raises: back above from, or from not below to, is refused', () => {
    assert.equal(planRevert([line('a', [{ ...body(4, 5), back: 9 }])], 'a', () => 5, have, gmCtx()).why, 'forged');
    assert.equal(planRevert([line('a', [{ ...body(9, 5), back: 9 }])], 'a', () => 5, have, gmCtx()).why, 'forged');
    assert.equal(planRevert([line('a', [body(5, 5)])], 'a', () => 5, have, gmCtx()).why, 'forged');
    assert.equal(planRevert([line('a', [{ ...body(4, 5), from: 4.5, back: 4.5 }])], 'a', () => 5, have, gmCtx()).why, 'forged');
  });
  test('a key outside the allow-list, or not of that item\'s type, is refused', () => {
    const step = (o: Partial<UndoStep>): UndoStep => ({ ...body(4, 5), ...o });
    for (const st of [step({ key: 'system.karma.good' }), step({ key: 'system.nuyen' }), step({ key: 'system.attributes.essence.base' }), step({ key: 'system.attributes.body.value' }),
      step({ doc: 'item', itemId: 'sp1', key: 'system.rating' }), step({ doc: 'item', itemId: 'sk1', key: 'system.learnedForce' }), step({ doc: 'item', itemId: 'sk1', key: 'system.quantity' })]) {
      assert.equal(planRevert([line('a', [st], { karma: -10 })], 'a', () => 5, have, gmCtx()).why, 'forged', st.key);
    }
    assert.equal(raiseKeyAllowed('actor', 'system.magic', null), true);
    assert.equal(raiseKeyAllowed('item', 'system.learnedForce', 'spell'), true);
    assert.equal(raiseKeyAllowed('item', 'system.level', 'adeptpower'), true);
    assert.equal(raiseKeyAllowed('item', 'system.specializationRating', 'skill'), true);
    assert.equal(raiseKeyAllowed('actor', 'system.initiateGrade', null), false);
    // Two steps on the same field (to price it twice) are refused.
    assert.equal(gmStepsOk([body(4, 5), body(4, 5)], gmCtx()), false);
  });
  test('a refund above cost: at most what the rules charge for the raise', () => {
    const p = planRevert([line('a', [body(4, 5)], { karma: -500 })], 'a', () => 5, have, gmCtx());
    assert.equal(p.ok, true);
    assert.equal(p.refund.karma, bodyCost5);
    assert.deepEqual(p.claimed, { karma: 500, nuyen: 0 });
    assert.equal(p.actor['system.karma.good'], bodyCost5);
    // A line that asks less than the cost gets what it asks.
    assert.equal(planRevert([line('a', [body(4, 5)], { karma: -1 })], 'a', () => 5, have, gmCtx()).refund.karma, Math.min(1, bodyCost5));
  });
  test('no price in the rules (Magic, an adept power\'s level): no Karma refund, and the plan says so', () => {
    const magic: UndoStep = { doc: 'actor', key: 'system.magic', from: 5, to: 6, back: 5, label: 'Magic' };
    const p = planRevert([line('a', [magic], { karma: -30 })], 'a', () => 6, have, gmCtx());
    assert.equal(p.ok, true); assert.equal(p.refund.karma, 0); assert.equal(p.costUnknown, true);
    assert.deepEqual(p.actor, { 'system.magic': 5 });
  });
  test('no nuyen refund on the GM\'s path; the player\'s own route is unchanged', () => {
    const p = planRevert([line('a', [body(4, 5)], { karma: -10, nuyen: -5000 })], 'a', () => 5, { karma: 0, nuyen: 100 }, gmCtx());
    assert.equal(p.refund.nuyen, 0); assert.equal(p.nuyenRefused, true); assert.equal(p.actor['system.nuyen'], undefined);
    assert.equal(planRevert([line('a', [body(4, 5)], { karma: -10, nuyen: -5000 })], 'a', () => 5, { karma: 0, nuyen: 100 }).refund.nuyen, 5000);
  });
  test('skills and spells are priced by their rules; an unset specialization goes back to 0', () => {
    const sk: UndoStep = { doc: 'item', itemId: 'sk1', key: 'system.rating', from: 3, to: 4, back: 3, label: 'Firearms' };
    assert.equal(stepRulesKarma(sk, { kind: 'skill', skillKind: 'active', attribute: 4 }), newSkillCost(3, 4) ?? skillCost({ to: 4, attribute: 4, kind: 'active' }));
    const sp: UndoStep = { doc: 'item', itemId: 'sp1', key: 'system.learnedForce', from: 3, to: 5, back: 3, label: 'Stunbolt' };
    assert.equal(stepRulesKarma(sp, { kind: 'spell' }), spellKarmaCost(5));
    // Specialization shown from the skill's rating (4), written back as unset (0).
    const spec: UndoStep = { doc: 'item', itemId: 'sk1', key: 'system.specializationRating', from: 4, to: 5, back: 0, label: 'Firearms (Pistols)' };
    assert.equal(gmStepsOk([spec], gmCtx()), true);
    assert.equal(gmStepsOk([{ ...spec, from: 2 }], gmCtx()), false, 'an unset sub-rating must start at the skill\'s rating');
    assert.equal(stepRulesKarma(spec, { kind: 'skill', skillKind: 'active', attribute: 4 }), skillCost({ to: 5, attribute: 4, kind: 'active', specialization: true }));
    assert.equal(stepRulesKarma(body(4, 5), null), null);
  });
  test('the confirmed plan and the fresh plan: the same signature unless what is written changes', () => {
    const log = [line('a', [body(4, 5)], { karma: -10 })];
    const a = planRevert(log, 'a', () => 5, { karma: 3, nuyen: 0 }, gmCtx());
    const b = planRevert(log, 'a', () => 5, { karma: 7, nuyen: 0 }, gmCtx());
    assert.equal(planSignature(a), planSignature(b), 'only the running Karma total moved');
    const c = planRevert([line('a', [body(3, 5)], { karma: -10 })], 'a', () => 5, { karma: 3, nuyen: 0 }, gmCtx());
    assert.notEqual(planSignature(a), planSignature(c));
  });
  test('the GM\'s record of reverted lines', () => {
    const d1 = withRevertDone({}, 'Actor.x', 'a');
    const d2 = withRevertDone(d1, 'Actor.x', 'b');
    assert.deepEqual(d2, { 'Actor.x': ['a', 'b'] });
    assert.deepEqual([...revertDoneFor(d2, 'Actor.x')], ['a', 'b']);
    assert.deepEqual([...revertDoneFor(d2, 'Actor.y')], []);
    assert.deepEqual([...revertDoneFor(null, 'Actor.x')], []);
    assert.deepEqual(withRevertDone(withRevertDone({}, 'A', 'a', 2), 'A', 'b', 2), { A: ['a', 'b'] });
    assert.deepEqual(withRevertDone({ A: ['a', 'b'] }, 'A', 'c', 2), { A: ['b', 'c'] });
  });
  test('wired: the hidden world setting, the in-lock checks, and the actor written before the items', () => {
    assert.match(read('src', 'module', 'settings.ts'), /"revertDone", \{ scope: "world", config: false, type: Object, default: \{\} \}/);
    const chat = read('src', 'module', 'applications', 'chat.ts');
    assert.match(chat, /await gmLocked\(message, button, async \(\) => \{\s*\/\/[^\n]*\n\s*if \(message\.getFlag\(SYSTEM_ID, 'advRevertApplied'\)\) return;\s*button\.disabled = true;\s*if \(await applyAdvRevertAsGm/);
    const glue = read('src', 'module', 'applications', 'revert942.ts');
    assert.match(glue, /planSignature\(plan\) !== o\.expect/);
    assert.match(glue, /expect: planSignature\(plan\)/);
    assert.ok(glue.indexOf('await actor.update({') < glue.indexOf('await item.update(changes'), 'the actor first');
  });
});

describe('v0.94.2 review (4) and (13): initiation and whole-word matching', () => {
  test('an initiation gets no undo step; its line is marked and greyed with a reason', () => {
    const events: AdvanceEvent[] = [
      { kind: 'ledger', entry: { kind: 'karma', amount: -18, reason: 'Initiation to grade 1' } },
      { kind: 'raise', label: 'Initiation', from: 0, to: 1, alias: 'Initiation', key: 'system.initiateGrade', back: 0 } as any,
    ];
    const lines = attachUndo(composeAdvancement(events, { ...base, ids: () => 'i1' }), events) as RevertLine[];
    assert.equal(lines.length, 1);
    assert.equal(lines[0]!.undo, undefined);
    assert.equal(lines[0]!.noRevert, 'initiation');
    assert.equal(revertCheck(lines, 'i1', () => 1).why, 'initiation');
    // A line logged before this fix with a grade step is refused too.
    const old = line('o', [{ doc: 'actor', key: 'system.initiateGrade', from: 0, to: 1, back: 0, label: 'Initiation' }], { karma: -18 });
    assert.equal(isInitiationLine(old), true);
    assert.equal(revertCheck([old], 'o', () => 1).why, 'initiation');
    assert.equal(planRevert([old], 'o', () => 1, have).refund.karma, 0);
  });
  test('a raise attaches to a Karma line naming it as a whole word, never to a nuyen purchase', () => {
    assert.equal(saidWord('Bought Bodyguard drone', 'Body'), false);
    assert.equal(saidWord('Raised Body 4 → 5', 'Body'), true);
    assert.equal(saidWord('Firearms (Pistols) 4 → 5', 'Firearms (Pistols)'), true);
    const events: AdvanceEvent[] = [
      { kind: 'ledger', entry: { kind: 'nuyen', amount: -5000, reason: 'Bought Bodyguard drone' } },
      { kind: 'item', type: 'gear', name: 'Bodyguard drone' },
      { kind: 'raise', label: 'Body', from: 4, to: 5, alias: 'Body', key: 'system.attributes.body.base', back: 4 } as any,
    ];
    const lines = attachUndo(composeAdvancement(events, { ...base, ids: (() => { let i = 0; return () => `n${i++}`; })() }), events);
    const buy = lines.find((l) => l.nuyen < 0)!;
    assert.equal(buy.undo, undefined, 'the purchase is not undone by lowering Body');
    const karma = [{ kind: 'ledger', entry: { kind: 'nuyen', amount: -5000, reason: 'Bought Body armour' } }, { kind: 'raise', label: 'Body', from: 4, to: 5, key: 'system.attributes.body.base', back: 4 }] as any[];
    assert.ok(attachUndo(composeAdvancement(karma, base), karma).every((l) => !l.undo || l.karma < 0 || l.what === 'Body 4 → 5'));
  });
});

describe('v0.94.2 review (1, 12): applying a revert (glue with stubs)', () => {
  const g = globalThis as any;
  const get = (o: any, k: string) => k.split('.').reduce((a: any, p: string) => (a == null ? undefined : a[p]), o);
  const setp = (o: any, k: string, v: unknown) => { const ps = k.split('.'); let a = o; for (const p of ps.slice(0, -1)) a = a[p] ??= {}; a[ps[ps.length - 1]!] = v; };
  let stored: Record<string, unknown> = {};
  const warns: string[] = [], errors: string[] = [];
  const mkActor = (opts: { failItem?: boolean } = {}) => {
    const item: any = { id: 'sk1', type: 'skill', name: 'Firearms', system: { rating: 4, kind: 'active', attribute: 'quickness' },
      update: async (ch: Record<string, unknown>) => { if (opts.failItem) throw new Error('nope'); for (const [k, v] of Object.entries(ch)) setp(item, k, v); } };
    const actor: any = {
      uuid: 'Actor.pc', name: 'Rook', isOwner: true, documentName: 'Actor',
      system: { attributes: { body: { base: 5, natural: 5 }, quickness: { base: 4, natural: 4 } }, karma: { good: 2 }, nuyen: 0, ledger: [], metatype: 'human', qualities: [] },
      flags: { shadowrun2e_unified: { advancement: [] as any[] } },
      items: { get: (id: string) => (id === 'sk1' ? item : undefined) },
      usesMetatypeSafe: () => false,
      updates: [] as any[],
      update: async (ch: Record<string, unknown>) => { actor.updates.push(ch); for (const [k, v] of Object.entries(ch)) setp(actor, k, v); },
    };
    return { actor, item };
  };
  let mod: typeof import('../applications/revert942.ts');
  const setup = async () => {
    g.foundry = { utils: { getProperty: get, randomID: () => 'r1' }, applications: { api: { DialogV2: { confirm: async () => true } } } };
    g.ui = { notifications: { warn: (m: string) => warns.push(m), error: (m: string) => errors.push(m), info: () => {} } };
    g.game = { user: { id: 'gm', name: 'GM', isGM: true }, users: [], time: { worldTime: 0 },
      settings: { get: (_s: string, k: string) => (k === 'revertDone' ? stored : undefined), set: async (_s: string, _k: string, v: any) => { stored = v; } } };
    mod ??= await import('../applications/revert942.ts');
  };
  test('a GM\'s revert pays at most the rules\' cost, records the line, and writes the actor before the items', async () => {
    await setup(); stored = {};
    const { actor, item } = mkActor();
    const sk: UndoStep = { doc: 'item', itemId: 'sk1', key: 'system.rating', from: 3, to: 4, back: 3, label: 'Firearms' };
    actor.flags.shadowrun2e_unified.advancement = [line('L1', [sk], { karma: -999 })];
    const expected = Math.min(999, newSkillCost(3, 4) ?? skillCost({ to: 4, attribute: 4, kind: 'active' }));
    assert.equal(await mod.applyRevert(actor, 'L1', 'GM'), true);
    assert.equal(item.system.rating, 3);
    assert.equal(actor.system.karma.good, 2 + expected);
    assert.deepEqual(stored, { 'Actor.pc': ['L1'] });
    // Clearing the actor's own mark doesn't make it revertable again on the GM's client.
    actor.flags.shadowrun2e_unified.advancement = actor.flags.shadowrun2e_unified.advancement.map((l: any) => ({ ...l, revertedAt: undefined }));
    item.system.rating = 4;
    assert.equal(await mod.applyRevert(actor, 'L1', 'GM'), false);
    assert.equal(actor.system.karma.good, 2 + expected, 'no second refund');
  });
  test('a plan that changed after the GM confirmed it is refused', async () => {
    await setup(); stored = {};
    const { actor } = mkActor();
    actor.flags.shadowrun2e_unified.advancement = [line('L1', [body(4, 5)], { karma: -10 })];
    warns.length = 0;
    assert.equal(await mod.applyRevert(actor, 'L1', 'GM', { expect: 'something else' }), false);
    assert.equal(actor.updates.length, 0);
    assert.equal(warns.length, 1);
  });
  test('an item that fails to update puts the actor, the record and the other items back', async () => {
    await setup(); stored = {};
    const { actor, item } = mkActor({ failItem: true });
    const sk: UndoStep = { doc: 'item', itemId: 'sk1', key: 'system.rating', from: 3, to: 4, back: 3, label: 'Firearms' };
    const log = [line('L1', [sk, body(4, 5)], { karma: -10 })];
    actor.flags.shadowrun2e_unified.advancement = log;
    errors.length = 0;
    const orig = console.error; console.error = () => {};
    try { assert.equal(await mod.applyRevert(actor, 'L1', 'GM'), false); } finally { console.error = orig; }
    assert.equal(actor.system.karma.good, 2);
    assert.equal(actor.system.attributes.body.base, 5);
    assert.equal(item.system.rating, 4);
    assert.deepEqual(actor.flags.shadowrun2e_unified.advancement, log);
    assert.deepEqual(stored, {});
    assert.equal(errors.length, 1);
  });
});
