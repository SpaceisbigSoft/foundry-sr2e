/**
 * v0.99.0 rules completeness, clinics, surgery and ware damage (RULES.CLINIC_V99): the pure rules (rules/clinic99.ts),
 * and for each switch that its other value ('v980') gives the v0.98.0 result.
 */
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/config.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { SYSTEM_ID as S } from '../config/system.ts';
import * as X from '../rules/clinic99.ts';
import { HOUSE_CLINIC_V99 } from '../rules/config99/clinic.ts';
import { CLINIC_V980_WAY } from '../rules/__tests__/clinic980.ts';

/** English from public/lang/en.json, with this area's draft while it isn't merged. */
function english(): Record<string, string> {
  const flat: Record<string, string> = {};
  const walk = (o: unknown, p: string): void => { if (typeof o === 'string') { flat[p] = o; return; } if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k); };
  walk(JSON.parse(readFileSync(join('public', 'lang', 'en.json'), 'utf8')), '');
  for (const f of ['clinic99.json', 'clinic99-fix.json', 'clinic99-fix-replace.json', 'clinic99-fix2.json', 'clinic99-fix2-replace.json']) {
    const draft = join('i18n-drafts', f);
    if (!existsSync(draft)) continue;
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(draft, 'utf8')) as Record<string, string>)) flat[k.replace(/^REPLACE:/, '')] = v;
  }
  return flat;
}
(globalThis as any).__SR2E_EN__ = { ...((globalThis as any).__SR2E_EN__ ?? {}), ...english() };

afterEach(() => X.setDamageRecordSource(() => ({})));

describe('v0.99.0 clinics and ware damage: the switches', () => {
  test('every switch has a house-rules row, the book first and the default', () => {
    const v: any = RULES.CLINIC_V99;
    for (const r of HOUSE_CLINIC_V99) {
      const key = r.path.split('.')[1]!;
      assert.ok(key in v, r.path);
      if (r.type === 'select') assert.equal(v[key], r.choices![0], `${r.path} defaults to its first choice`);
    }
    for (const k of Object.keys(v)) assert.ok(HOUSE_CLINIC_V99.some((r) => r.path === `CLINIC_V99.${k}`), k);
    assert.equal(Object.keys(CLINIC_V980_WAY).length, Object.keys(v).length - 2);
    assert.equal(v.feeAlphaBeta, 50);
    assert.equal(v.feeDelta, 200);
  });
  test('every house-rules row, the tool and every key the code uses has English', () => {
    const en = english();
    for (const r of HOUSE_CLINIC_V99) assert.ok(en[`SR2E.HouseRules.Rule.${r.path.replace('.', '__')}`], r.path);
    assert.ok(en['SR2E.Tools.clinic99.label'] && en['SR2E.Tools.clinic99.hint']);
    const src = ['src/module/rules/clinic99.ts', 'src/module/applications/clinic99.ts', 'src/module/documents/index.ts', 'src/module/applications/sheets.ts']
      .map((f) => readFileSync(join(...f.split('/')), 'utf8')).join('\n');
    const keys = new Set([...src.matchAll(/SR2E\.Clinic99\.[A-Za-z0-9_.]+[A-Za-z0-9]/g)].map((m) => m[0]));
    for (const dyn of ['Why', 'Grade', 'Level', 'Route', 'Mode', 'Tool']) keys.delete(`SR2E.Clinic99.${dyn}`);
    for (const k of X.CLINIC_GRADES) keys.add(`SR2E.Clinic99.Grade.${k}`);
    for (const k of ['none', ...X.WARE_LEVELS]) keys.add(`SR2E.Clinic99.Level.${k}`);
    for (const k of X.ROUTES) keys.add(`SR2E.Clinic99.Route.${k}`);
    for (const k of X.SEARCH_MODES) keys.add(`SR2E.Clinic99.Mode.${k}`);
    for (const k of ['search', 'remove', 'damage']) keys.add(`SR2E.Clinic99.Tool.${k}`);
    for (const k of ['off', 'delta', 'noDice', 'destroyed']) keys.add(`SR2E.Clinic99.Why.${k}`);
    for (const k of keys) assert.ok(en[k], k);
  });
});

describe('finding a shadow clinic (SSC p. 99)', () => {
  const c = { etiquette: 5, intelligence: 4, charisma: 3 };
  test('the street: Etiquette (Street) vs 12 (alpha) or 15 (beta), one success', () => {
    assert.deepEqual(X.clinicTest({ grade: 'alpha', route: 'street', mode: 'knows', ...c }), { dice: 5, tn: 12, need: 1 });
    assert.deepEqual(X.clinicTest({ grade: 'beta', route: 'street', mode: 'knows', ...c }), { dice: 5, tn: 15, need: 1 });
  });
  test('the corps: 11 (alpha) or 17 (beta)', () => {
    assert.equal(X.clinicTest({ grade: 'alpha', route: 'corp', mode: 'knows', ...c }).tn, 11);
    assert.equal(X.clinicTest({ grade: 'beta', route: 'corp', mode: 'knows', ...c }).tn, 17);
  });
  test('a search: Intelligence + the lower of Charisma and Etiquette, 2 successes (alpha) or 3 (beta), 5 days ÷ successes', () => {
    assert.deepEqual(X.clinicTest({ grade: 'alpha', route: 'street', mode: 'search', ...c }), { dice: 7, tn: 12, need: 2 });
    assert.equal(X.clinicTest({ grade: 'beta', route: 'street', mode: 'search', ...c }).need, 3);
    assert.deepEqual(X.clinicOutcome(2, { need: 2 }, 'search'), { found: true, days: 2.5 });
    assert.deepEqual(X.clinicOutcome(1, { need: 2 }, 'search'), { found: false, days: 5 });
    assert.deepEqual(X.clinicOutcome(1, { need: 1 }, 'knows'), { found: true, days: 0 });
  });
  test('delta has no test (Cybertechnology p. 44); no dice; the switch off', (t) => {
    assert.equal(X.clinicTest({ grade: 'delta', route: 'corp', mode: 'knows', ...c }).why, 'SR2E.Clinic99.Why.delta');
    assert.equal(X.clinicTest({ grade: 'alpha', route: 'street', mode: 'knows', etiquette: 0, intelligence: 4, charisma: 3 }).why, 'SR2E.Clinic99.Why.noDice');
    t.after(oldWay({ 'CLINIC_V99.clinicSearch': 'v980' }));
    assert.equal(X.clinicTest({ grade: 'alpha', route: 'street', mode: 'knows', ...c }).why, 'SR2E.Clinic99.Why.off');
  });
  test('the record: bounded; a better clinic does the lesser grades', () => {
    const rec = X.withClinic(X.clinicRecord({ junk: 3, 'a.b': { alpha: {} } }), 'Actor_x', 'beta', { at: 1, route: 'corp', by: 'Fixer' });
    assert.deepEqual(Object.keys(rec), ['Actor_x']);
    assert.ok(X.hasClinic(rec, 'Actor_x', 'alpha'));
    assert.ok(X.hasClinic(rec, 'Actor_x', 'beta'));
    assert.ok(!X.hasClinic(rec, 'Actor_x', 'delta'));
    assert.ok(!X.hasClinic(rec, 'Actor_y', 'alpha'));
    assert.ok(X.hasClinic(rec, 'Actor_y', 'standard'));
  });
});

describe('surgeon\'s fee and graded clinic fees (Cybertechnology pp. 44, 54; Core p. 114)', () => {
  test('the size bands and the fee table', () => {
    assert.equal(X.surgerySize(0, false), 'L');
    assert.equal(X.surgerySize(0.4, false), 'M');
    assert.equal(X.surgerySize(0.41, false), 'S');
    assert.equal(X.surgerySize(1, false), 'D');
    assert.equal(X.surgerySize(0.5, true), 'M');
    assert.equal(X.surgeonFee(0.3, false), 5000);
    assert.equal(X.surgeonFee(1.2, false), 250000);
  });
  test('alpha and beta × 50, delta × 200; bioware has no grade', () => {
    assert.equal(X.feeFactor('alpha'), 50);
    assert.equal(X.feeFactor('beta'), 50);
    assert.equal(X.feeFactor('delta'), 200);
    assert.equal(X.feeFactor('standard'), 1);
    assert.equal(X.feeFactor('alpha', true), 1);
    // Fix C3 (Cybertechnology pp. 44, 54): the × 50 is on the daily care rates, never on the surgery's list price.
    assert.equal(X.surgeonFee(0.3, false), 5000);
  });
  test('v980: no fee, standard rates', (t) => {
    t.after(oldWay({ 'CLINIC_V99.surgeonFee': 'v980', 'CLINIC_V99.gradedFees': 'v980' }));
    assert.equal(X.surgeonFee(1.2, false), 0);
    assert.equal(X.feeFactor('delta'), 1);
  });
});

describe('removing cyberware (Shadowtech pp. 36–41)', () => {
  test('10 − the current Essence, rounded down; never below 2', () => {
    assert.equal(X.removalTn(5.6), 5);
    assert.equal(X.removalTn(0.4), 10);
    assert.equal(X.removalTn(9), 2);
  });
  test('no successes: 10% of the cost more, rounded up to the tenth', () => {
    assert.equal(X.removalLoss(0.2, 0), 0.1);
    assert.equal(X.removalLoss(1.5, 0), 0.2);
    assert.equal(X.removalLoss(2, 0), 0.2);
    assert.equal(X.removalLoss(0.5, 1), 0);
  });
  test('the lower of the two skills', () => {
    assert.deepEqual(X.lowerSkill([{ n: 'a', rating: 5 }, { n: 'b', rating: 3 }]), { n: 'b', rating: 3 });
    assert.deepEqual(X.lowerSkill([null, { n: 'a', rating: 4 }]), { n: 'a', rating: 4 });
    assert.equal(X.lowerSkill([null, undefined]), null);
  });
});

const ware = (o: any = {}) => ({ type: 'cyberware', uuid: 'Actor.a.Item.w', name: 'Wired Reflexes', flags: {}, ...o, system: { installed: true, grade: 'standard', essenceCost: 2, ...(o.system ?? {}) } });

describe('ware damage levels (Shadowtech pp. 36–41)', () => {
  test('levels: the worse, accumulating one step past it, Moderate+ stops, destroyed past Deadly', () => {
    assert.equal(X.worse('L', 'S'), 'S');
    assert.equal(X.worse('', 'M'), 'M');
    assert.equal(X.accumulate('', 'L'), 'L');
    assert.equal(X.accumulate('L', 'L'), 'M');
    assert.equal(X.accumulate('S', 'L'), 'D');
    assert.equal(X.accumulate('D', 'M'), 'X');
    assert.ok(!X.levelStops('L'));
    assert.ok(X.levelStops('M') && X.levelStops('X'));
    assert.equal(X.feedbackTn(['S', 'D', 'X', 'L']), 3);
  });
  test('the level that counts: the worse of the item\'s own and the GM\'s record (lowering the item does nothing)', () => {
    X.setDamageRecordSource(() => ({ Actor_a_Item_w: 'S' }));
    assert.equal(X.wareLevel(ware({ flags: { [S]: { [X.WARE_FLAG]: 'L' } } })), 'S');
    assert.equal(X.wareLevel(ware({ flags: { [S]: { [X.WARE_FLAG]: '' } } })), 'S');
    assert.equal(X.wareLevel(ware({ flags: { [S]: { [X.WARE_FLAG]: 'D' } } })), 'D');
    assert.equal(X.wareLevel(ware({ system: { bioware: true } })), '');
    // Fix C4: 'destroyed' on the item alone counts (it stops, can't be repaired, no feedback): no better for the player.
    assert.equal(X.wareLevel(ware({ flags: { [S]: { [X.WARE_FLAG]: 'X' } } })), 'X');
    assert.equal(X.actorFeedbackTn([ware({ flags: { [S]: { [X.WARE_FLAG]: 'X' } } })]).tn, 0);
    assert.equal(X.wareStops(ware({ flags: { [S]: { [X.WARE_FLAG]: 'X' } } })), true);
    X.setDamageRecordSource(() => ({ Actor_a_Item_w: 'X' }));
    assert.equal(X.wareLevel(ware({ flags: { [S]: { [X.WARE_FLAG]: 'L' } } })), 'X');
  });
  test('Light halves the ware\'s bonuses; Moderate+ marks it damaged', () => {
    const aug = { attributes: { quickness: 3 }, reaction: 2, initiativeDice: 1, damaged: false, name: 'x' };
    const l = X.wareAug(ware({ flags: { [S]: { [X.WARE_FLAG]: 'L' } } }), aug);
    assert.deepEqual([l.attributes, l.reaction, l.initiativeDice, l.damaged], [{ quickness: 1 }, 1, 0, false]);
    assert.equal(X.wareAug(ware({ flags: { [S]: { [X.WARE_FLAG]: 'M' } } }), aug).damaged, true);
    assert.equal(X.wareAug(ware(), aug), aug);
    assert.ok(X.wareStops(ware({ flags: { [S]: { [X.WARE_FLAG]: 'S' } } })));
  });
  test('the feedback penalty adds up over installed systems', () => {
    const items = [ware({ name: 'A', flags: { [S]: { [X.WARE_FLAG]: 'S' } } }), ware({ uuid: 'Actor.a.Item.v', name: 'B', flags: { [S]: { [X.WARE_FLAG]: 'D' } } }), ware({ uuid: 'Actor.a.Item.u', name: 'C', flags: { [S]: { [X.WARE_FLAG]: 'D' } }, system: { installed: false } })];
    assert.deepEqual(X.actorFeedbackTn(items), { tn: 3, names: ['A', 'B'] });
  });
  test('v980: no levels, no halving, no penalty', (t) => {
    t.after(oldWay({ 'CLINIC_V99.damageLevels': 'v980' }));
    X.setDamageRecordSource(() => ({ Actor_a_Item_w: 'D' }));
    const aug = { attributes: { quickness: 3 }, reaction: 2, initiativeDice: 1, damaged: false };
    assert.equal(X.wareLevel(ware()), '');
    assert.equal(X.wareAug(ware({ flags: { [S]: { [X.WARE_FLAG]: 'L' } } }), aug), aug);
    assert.deepEqual(X.actorFeedbackTn([ware()]), { tn: 0, names: [] });
  });
});

describe('repair by damage level (Shadowtech pp. 36–41; Cybertechnology p. 44)', () => {
  test('TN 2/3/4/8, × 2 alpha, × 3 beta; 2 × Essence hours × 1/2/3/4', () => {
    assert.deepEqual(X.repairSpec('L', 'standard', 0.2), { tn: 2, hours: 0.4 });
    assert.deepEqual(X.repairSpec('M', 'standard', 1), { tn: 3, hours: 4 });
    assert.deepEqual(X.repairSpec('S', 'beta', 1), { tn: 12, hours: 6 });
    assert.deepEqual(X.repairSpec('D', 'alpha', 0.5), { tn: 16, hours: 4 });
    assert.deepEqual(X.repairSpec('M', 'delta', 1), { tn: 9, hours: 16 });
    assert.equal(X.repairSpec('X', 'standard', 1).why, 'SR2E.Clinic99.Why.destroyed');
    assert.equal(X.repairHours(6, 3), 2);
  });
  test('parts: 5% / 10% / 20% / 40% of the cost', () => {
    assert.equal(X.repairParts('L', 10000), 500);
    assert.equal(X.repairParts('D', 10000), 4000);
    assert.equal(X.repairParts('X', 10000), 0);
  });
  test('v980: the old repair', (t) => {
    t.after(oldWay({ 'CLINIC_V99.repair': 'v980' }));
    assert.equal(X.repairSpec('L', 'standard', 1).why, 'SR2E.Clinic99.Why.off');
  });
});

describe('v0.99.0 fixes: the damage record\'s bounds, notes and proofs (pure)', () => {
  test('S2: the newest entries are kept; a character holds at most RECORD_PER_ACTOR (fix2 M2: the oldest makes room)', () => {
    const raw: Record<string, string> = {};
    for (let i = 0; i < X.RECORD_MAX + 5; i++) raw[`Actor_a${i}_Item_w`] = 'L';
    const rec = X.damageRecord(raw);
    assert.equal(Object.keys(rec).length, X.RECORD_MAX);
    assert.ok(rec[`Actor_a${X.RECORD_MAX + 4}_Item_w`], 'the newest kept');
    assert.equal(rec.Actor_a0_Item_w, undefined, 'the oldest dropped');
    let mine: X.DamageRecord = {};
    for (let i = 0; i < X.RECORD_PER_ACTOR; i++) mine = X.recordWith(mine, `Actor_p_Item_i${i}`, 'M').rec;
    const over = X.recordWith(mine, 'Actor_p_Item_new', 'S');
    assert.deepEqual([over.refused, over.evicted, over.rec.Actor_p_Item_new], [false, ['Actor_p_Item_i0'], 'S']);
    const again = X.recordWith(mine, 'Actor_p_Item_i3', 'S');
    assert.equal(again.refused, false, 'a rise of an entry already there is kept');
    assert.equal(Object.keys(again.rec).pop(), 'Actor_p_Item_i3', 'and moves to the newest');
    // Lead fix (final re-review 1): a share full of installed ware at least as bad refuses the new entry; the lowest
    // level goes first; Light junk never pushes Deadly out.
    let deadly: X.DamageRecord = { Actor_q_Item_real: 'D' } as any;
    for (let i = 0; i < X.RECORD_PER_ACTOR - 1; i++) deadly = X.recordWith(deadly, `Actor_q_Item_j${i}`, 'L').rec;
    const junk = X.recordWith(deadly, 'Actor_q_Item_more', 'L');
    assert.equal(junk.refused, true, 'Light into a share whose lowest is Light: refused');
    const worse = X.recordWith(deadly, 'Actor_q_Item_hit', 'S');
    assert.equal(worse.refused, false);
    assert.equal(worse.rec.Actor_q_Item_real, 'D', 'the Deadly entry stays');
    assert.deepEqual(worse.evicted, ['Actor_q_Item_j0'], 'the oldest Light goes');
    assert.equal(X.actorKeyOf('Scene_s_Token_t_Actor_a_Item_w'), 'Scene_s_Token_t_Actor_a');
    assert.deepEqual(X.recordWithout({ a_Item_b: 'L', c_Item_d: 'M' } as any, ['a_Item_b']), { c_Item_d: 'M' });
  });
  test('the record is parsed once per change (C7): a source change shows only after the reset', () => {
    let raw: any = { Actor_a_Item_w: 'L' };
    X.setDamageRecordSource(() => raw);
    assert.equal(X.recordedLevel('Actor.a.Item.w'), 'L');
    raw = { Actor_a_Item_w: 'S' };
    assert.equal(X.recordedLevel('Actor.a.Item.w'), 'L', 'cached');
    X.resetRecordCache();
    assert.equal(X.recordedLevel('Actor.a.Item.w'), 'S');
  });
  test('S3, P1, P2: deleted ware kept by name and kind; used ids; the cleared stamp', () => {
    let m = X.damageMeta(null);
    m = X.metaGone(m, { actor: 'Actor_a', name: 'Wired Reflexes', kind: 'bodyware', level: 'S', at: 1 }).meta;
    assert.equal(X.metaTake(m, 'Actor_a', 'Wired Reflexes', 'headware').entry, null, 'another kind');
    const t = X.metaTake(m, 'Actor_a', 'Wired Reflexes', 'bodyware');
    assert.equal(t.entry!.level, 'S');
    assert.equal(t.meta.gone.length, 0);
    m = X.metaUse(m, ['card:m1', 'test:t1']);
    assert.ok(X.metaUsed(m, ['test:t1']) && !X.metaUsed(m, ['test:t2', '']));
    m = X.metaCleared(m, 'Actor_a_Item_w', 1000);
    assert.equal(X.clearedSince(m, 'Actor_a_Item_w', 900), true, 'the item\'s level is from before the clear');
    assert.equal(X.clearedSince(m, 'Actor_a_Item_w', 1100), false);
    assert.equal(X.clearedSince(m, 'Actor_a_Item_x', 0), false);
    const big = X.damageMeta({ used: Array.from({ length: 900 }, (_, i) => `x${i}`), gone: 'junk' });
    assert.equal(big.used.length, X.META_USED_MAX);
    assert.equal(big.used.at(-1), 'x899');
  });
  test('S4: a repair\'s proof: the same item and owner, successes counted again at the level\'s TN', () => {
    const snap = { kind: 'cyberRepair', cyberRepair: { itemId: 'w', ownerUuid: 'Actor.a' }, targetNumber: 3, successes: 5, dice: [{ total: 6 }, { total: 3 }, { total: 2 }] };
    assert.equal(X.repairProof(snap, { itemId: 'w', ownerUuid: 'Actor.a', tn: 3 }), 2, 'forged successes don\'t count');
    assert.equal(X.repairProof(snap, { itemId: 'w', ownerUuid: 'Actor.a', tn: 4 }), 1, 'the level\'s TN');
    assert.equal(X.repairProof(snap, { itemId: 'x', ownerUuid: 'Actor.a', tn: 3 }), 0);
    assert.equal(X.repairProof({ ...snap, kind: 'heal' }, { itemId: 'w', ownerUuid: 'Actor.a', tn: 3 }), 0);
    assert.equal(X.repairProof({ ...snap, cyberRepair: { itemId: 'w', ownerUuid: 'Actor.b' } }, { itemId: 'w', ownerUuid: 'Actor.a', tn: 3 }), 0);
  });
  test('C7: a repair undone marks the ware damaged again only for a level that stops it; v980 always', (t) => {
    assert.equal(X.redamages('L'), false);
    assert.equal(X.redamages('M'), true);
    assert.equal(X.redamages(''), true);
    t.after(oldWay({ 'CLINIC_V99.damageLevels': 'v980' }));
    assert.equal(X.redamages('L'), true);
  });
  test('P4, S6: the fee\'s entries by operation and by item; the frozen grade', () => {
    assert.deepEqual(X.feeKeys('op1', 'w'), ['op-op1', 'w-install']);
    let rec = X.feeWith({}, 'Actor_a', X.feeKeys('op1', 'w'), 5000);
    assert.equal(X.feePaid(rec.Actor_a, X.feeKeys('op2', 'w')), true, 'another operation on the same ware');
    assert.equal(X.feePaid(rec.Actor_a, X.feeKeys('op2', 'v')), false);
    rec = X.feeWithout(rec, 'Actor_a', 'w');
    assert.equal(X.feePaid(rec.Actor_a, X.feeKeys('op2', 'w')), false, 'the ware came out: a new operation pays');
    assert.equal(X.feePaid({ 'w-install': null } as any, ['w-install']), false, 'null is not set');
    assert.equal(X.gradeOf('alpha'), 'alpha');
    assert.equal(X.gradeOf('gold'), '');
  });
});
