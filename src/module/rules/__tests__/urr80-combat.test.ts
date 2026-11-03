/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: combat): the pure functions in rules/urr80-combat.ts,
 * each under the shipped (book) values and under the Revamp (urrMode()).
 */
import { test, describe } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { RULES } from '../config.ts';
import { URR80_PATCH_COMBAT, URR_V80_COMBAT } from '../config80-combat.ts';
import * as C from '../urr80-combat.ts';
import { urrMode } from './urrmode.ts';

const sysOf = (o: { reaction: number; q: number; qn?: number; i: number; in?: number }) => ({
  derived: { reaction: o.reaction },
  attributes: { quickness: { total: o.q, natural: o.qn ?? o.q }, intelligence: { total: o.i, natural: o.in ?? o.i } },
});

describe('v0.80.0 combat: the shipped values are the book', () => {
  test('every switch ships at the book way', () => {
    assert.equal(URR_V80_COMBAT.cbtTies, 'book');
    assert.equal(URR_V80_COMBAT.cbtDefense, 'dodge');
    assert.equal(URR_V80_COMBAT.cbtKnockdown, 'book');
    assert.equal(URR_V80_COMBAT.cbtReload, 'book');
    assert.equal(URR_V80_COMBAT.cbtStrengthRecoil, false);
    assert.equal(URR_V80_COMBAT.cbtTracers, 'book');
    assert.equal(URR_V80_COMBAT.cbtShotgun, 'book');
    assert.equal(URR_V80_COMBAT.cbtScatter, 'book');
    assert.equal(URR_V80_COMBAT.cbtBlastStaging, false);
    assert.equal(URR_V80_COMBAT.cbtSubdueTn, 0);
    assert.equal(URR_V80_COMBAT.cbtChargePower, 0);
    assert.equal(URR_V80_COMBAT.cbtArmorPool, 'quickness');
    assert.equal(URR_V80_COMBAT.cbtArmorLayers, false);
    assert.equal(URR_V80_COMBAT.cbtGradedCover, false);
    assert.equal(RULES.URR_V80.cbtDefense, 'dodge');
  });

  test('the patched existing paths keep their book values until the Revamp is on', (t) => {
    assert.equal(RULES.ATTACK_STAGING, 'afterFirst');
    assert.equal(RULES.COMBAT.melee.tie, 'none');
    assert.equal(RULES.INITIATIVE_WOUNDS.midTurn, true);
    assert.equal(RULES.DELAY.lostAtPassEnd, true);
    t.after(urrMode());
    assert.equal(RULES.ATTACK_STAGING, 'all');
    assert.equal(RULES.COMBAT.melee.tie, 'attacker');
    assert.equal(RULES.INITIATIVE_WOUNDS.midTurn, false);
    assert.equal(RULES.DELAY.lostAtPassEnd, false);
    assert.equal(RULES.COMBAT.demolitions.tn, 2);
    assert.equal(RULES.COMBAT_V72.blastBarriers.holdMultiplier, 2);
    assert.equal(RULES.COMBAT.spreadFire.wastedRoundsPerMetre, 0);
  });

  test('the patch tables keep the shipped rows (only the Revamp\'s changes differ)', () => {
    const sit = URR80_PATCH_COMBAT['SITUATIONAL_MODIFIERS'] as Array<{ id: string; value: number }>;
    for (const m of RULES.SITUATIONAL_MODIFIERS) assert.equal(sit.find((x) => x.id === m.id)?.value, m.value, m.id);
    const gr = URR80_PATCH_COMBAT['COMBAT.grenades'] as Array<{ id: string; perMetre?: number }>;
    for (const k of RULES.COMBAT.grenades) {
      const mine = gr.find((x) => x.id === k.id);
      assert.ok(mine, k.id);
      if (k.id !== 'apRocket' && k.id !== 'avRocket') assert.deepEqual(mine, k, k.id);
    }
    assert.equal(gr.find((x) => x.id === 'apRocket')?.perMetre, 2);
    assert.equal(gr.find((x) => x.id === 'avRocket')?.perMetre, 8);
    const ammo = URR80_PATCH_COMBAT['COMBAT.ammo'] as Array<{ id: string }>;
    for (const a of RULES.COMBAT.ammo) assert.deepEqual(ammo.find((x) => x.id === a.id), a, a.id);
    assert.ok(ammo.some((a) => a.id === 'shot'));
  });
});

describe('v0.80.0 combat: initiative ties', () => {
  test('book: Reaction, then Quickness', () => {
    assert.deepEqual(C.cbtTieKeys(), ['reaction', 'quickness']);
    assert.equal(C.cbtTieValue('quickness', sysOf({ reaction: 5, q: 6, i: 4 })), 6);
    assert.equal(C.cbtTieValue('reaction', sysOf({ reaction: 5, q: 6, i: 4 })), 5);
    assert.equal(C.cbtTieValue('reaction', undefined), 0);
  });
  test('Revamp: Reaction, then natural Reaction', (t) => {
    t.after(urrMode());
    assert.deepEqual(C.cbtTieKeys(), ['reaction', 'naturalReaction']);
    // wired reflexes: Reaction 9, natural Quickness 5 + Intelligence 4 → 4
    assert.equal(C.cbtTieValue('naturalReaction', sysOf({ reaction: 9, q: 7, qn: 5, i: 4 })), 4);
    assert.equal(C.cbtTieValue('naturalReaction', { attributes: { quickness: { total: 6 }, intelligence: { total: 5 } } }), 5);
  });
});

describe('v0.80.0 combat: the clean-miss defense flow', () => {
  const ranged = { astral: false, matrix: false };
  test('book: no attack takes the clean-miss path', () => {
    assert.equal(C.cbtCleanMissOn(), false);
    assert.equal(C.cbtCleanMissRanged(ranged, false), false);
    assert.equal(C.cbtFullDefenseDice(5), 5);
    assert.equal(C.cbtMeleeDefensePool(true, 3), 3);
    assert.deepEqual(C.cbtMeleeDamage('M', 3, 2), {});
    assert.equal(C.cbtFullDefenseText('Quickness', false), '+Quickness dice against every attack until your next action');
    assert.equal(C.cbtFullDefenseText('Quickness', true), '+Quickness dice (already declared)');
    assert.equal(C.cbtDefendPoolLabel(4, false), 'Combat Pool dice (4 left)');
  });
  test('Revamp: ranged attacks on characters skip the dodge; the special ones keep the book path', (t) => {
    t.after(urrMode());
    assert.equal(C.cbtCleanMissRanged(ranged, false), true);
    assert.equal(C.cbtCleanMissRanged(ranged, true), false);                  // opposed melee
    for (const k of ['astral', 'matrix', 'ram', 'flame', 'elemental', 'suppressive', 'fixedDamage', 'noDodge']) {
      assert.equal(C.cbtCleanMissRanged({ [k]: true } as any, false), false, k);
    }
    assert.equal(C.cbtCleanMissRanged(null, false), false);
    assert.equal(C.cbtFullDefenseDice(5), 0);
    assert.equal(C.cbtMeleeDefensePool(true, 3), 0);
    assert.equal(C.cbtMeleeDefensePool(false, 3), 3);
    assert.deepEqual(C.cbtMeleeDamage('M', 3, 2), { level: 'M', cleanMiss80: { hits: 3, net: 2, noClean: true } });
    assert.deepEqual(C.cbtMeleeDamage('M', 3, 2, true), { level: 'M', cleanMiss80: { hits: 3, net: 2 } });
    assert.match(C.cbtDefendPoolLabel(4, true), /resistance test \(4 left\)/);
  });
  test('clean miss: pool successes must beat the attack successes', () => {
    assert.equal(C.cbtCleanMiss(3, 2), true);
    assert.equal(C.cbtCleanMiss(2, 2), false);
    assert.equal(C.cbtCleanMiss(0, 0), false);
  });
  test('net staging: every 2 either way', () => {
    assert.equal(C.cbtNetStage('M', 4, 0), 'D');
    assert.equal(C.cbtNetStage('M', 3, 0), 'S');
    assert.equal(C.cbtNetStage('M', 2, 1), 'M');
    assert.equal(C.cbtNetStage('M', 1, 3), 'L');
    assert.equal(C.cbtNetStage('L', 0, 2), null);
    assert.equal(C.cbtNetStage('S', 2, 2), 'S');
  });
  test('the soak result: clean miss first, then net staging', () => {
    const cm = C.cbtSoakLevel('M', { hits: 3, net: 3 }, 4, 4);
    assert.equal(cm.level, null); assert.equal(cm.clean, true); assert.match(cm.lead, /pool successes beat/);
    const st = C.cbtSoakLevel('M', { hits: 3, net: 3 }, 1, 1);
    assert.equal(st.level, 'S'); assert.equal(st.clean, false);              // 3 attack vs 1 resistance: 2 net, up one
    assert.equal(C.cbtSoakLevel('S', { hits: 3, net: 1 }, 5, 2).level, 'L'); // 1 vs 5: down two
  });
});

describe('v0.80.0 combat: knockdown', () => {
  test('book: the soak TN, the book trigger, down on no successes', () => {
    assert.equal(C.cbtKnockdownTn({ power: 10, tn: 6, melee: false }), 6);
    assert.equal(C.cbtKnockdownDue(false, 'M'), false);
    assert.equal(C.cbtKnockdownDue(true, 'M'), true);
    assert.deepEqual(C.cbtKnockdownFlag('M'), {});
    assert.deepEqual(C.cbtKnockdownResult(0, 'M'), { down: true, staggerMetres: 0 });
    assert.deepEqual(C.cbtKnockdownResult(1, 'S'), { down: false, staggerMetres: 0 });
  });
  test('Revamp: half Power ranged, the Power in melee, any damage, successes by level', (t) => {
    t.after(urrMode());
    assert.equal(C.cbtKnockdownTn({ power: 9, tn: 6, melee: false }), 4);
    assert.equal(C.cbtKnockdownTn({ power: 3, tn: 2, melee: false }), 2);    // never below the minimum TN
    assert.equal(C.cbtKnockdownTn({ power: 7, tn: 6, melee: true }), 7);
    assert.equal(C.cbtKnockdownDue(false, 'L'), true);
    assert.equal(C.cbtKnockdownDue(true, null), false);
    assert.deepEqual(C.cbtKnockdownFlag('S'), { level: 'S' });
    assert.deepEqual(C.cbtKnockdownResult(0, 'L'), { down: true, staggerMetres: 0 });
    assert.deepEqual(C.cbtKnockdownResult(1, 'M'), { down: false, staggerMetres: 2 });
    assert.deepEqual(C.cbtKnockdownResult(4, 'S'), { down: false, staggerMetres: 0 });
    assert.deepEqual(C.cbtKnockdownResult(6, 'D'), { down: true, staggerMetres: 0 });
  });
});

describe('v0.80.0 combat: reloading, recoil, tracers', () => {
  test('book: the values passed in', () => {
    assert.equal(C.cbtReloadAmount(2, 'cylinder', 0, 6, 5), 2);
    assert.equal(C.cbtStrengthRecoil(4, 9, true), 4);
    assert.deepEqual(C.cbtTracer(-1, { ammo: 'tracer', mode: 'BF', rounds: 3, smartgun: false }), { tn: -1, powerOff: 0 });
  });
  test('Revamp: Quickness rounds, a whole break action; strong shooters; tracers by thirds', (t) => {
    t.after(urrMode());
    assert.equal(C.cbtReloadAmount(2, 'cylinder', 0, 6, 5), 5);
    assert.equal(C.cbtReloadAmount(2, 'internal', 4, 6, 5), 2);               // only the room left
    assert.equal(C.cbtReloadAmount(2, 'break', 0, 2, 1), 2);
    assert.equal(C.cbtReloadAmount(7, 'clip', 0, 7, 5), 7);
    assert.equal(C.cbtStrengthRecoil(4, 4, true), 4);
    assert.equal(C.cbtStrengthRecoil(4, 6, true), 3);
    assert.equal(C.cbtStrengthRecoil(4, 8, true), 2);
    assert.equal(C.cbtStrengthRecoil(4, 12, true), 0);
    assert.equal(C.cbtStrengthRecoil(4, 12, false), 4);                       // vehicle mounts
    assert.deepEqual(C.cbtTracer(-1, { ammo: 'tracer', mode: 'BF', rounds: 3, smartgun: false }), { tn: 0, powerOff: 0 });
    assert.deepEqual(C.cbtTracer(0, { ammo: 'tracer', mode: 'FA', rounds: 10, smartgun: false }), { tn: -3, powerOff: 3 });
    assert.deepEqual(C.cbtTracer(0, { ammo: 'tracer', mode: 'FA', rounds: 6, smartgun: true }), { tn: 0, powerOff: 2 });
    assert.deepEqual(C.cbtTracer(0, { ammo: 'standard', mode: 'FA', rounds: 6, smartgun: false }), { tn: 0, powerOff: 0 });
  });
});

describe('v0.80.0 combat: shotguns', () => {
  const book = { width: 2.5, power: 0, loss: 2 };
  test('book: always spreads; the values passed in', () => {
    assert.equal(C.cbtShotgunSpreads('standard'), true);
    assert.equal(C.cbtShotgunSpreads(undefined), true);
    assert.equal(C.cbtShotgunSpread(book, 10, 4, 0), book);
    assert.deepEqual(C.cbtShotgunTn([], 10, 4), []);
  });
  test('Revamp: slugs by default; shot spreads in a doubling cone, −1 TN and Power a step', (t) => {
    t.after(urrMode());
    assert.equal(C.cbtShotgunSpreads('standard'), false);
    assert.equal(C.cbtShotgunSpreads(undefined), false);
    assert.equal(C.cbtShotgunSpreads('shot'), true);
    assert.deepEqual(C.cbtShotgunSpread(book, 3, 4, 10), { width: 1, power: 9, loss: 1 });
    assert.deepEqual(C.cbtShotgunSpread(book, 10, 4, 10), { width: 4, power: 7, loss: 3 });
    assert.deepEqual(C.cbtShotgunTn([], 10, 4), [{ label: 'Shot spread', value: -3 }]);
    assert.ok(RULES.DOCS_V79.rangedFlechette.ammoIds.includes('shot'));
  });
});

describe('v0.80.0 combat: scatter and blasts', () => {
  test('book: the values passed in, no rocket fields, no staging', () => {
    assert.deepEqual(C.cbtScatterExtras({ blastKind: 'heRocket', name: 'Missile', guidance: 3 }), {});
    assert.equal(C.cbtScatterDice({ scatterType: 'aerodynamic' }, 2), 2);
    assert.equal(C.cbtScatterPerSuccess({ scatterType: 'aerodynamic' }), RULES.COMBAT.scatter.metresPerSuccess);
    assert.equal(C.cbtScatterMetres(5, [6, 3], 2, { scatterType: 'aerodynamic' }), 5);
    const ctx = { level: 'M' as const, successes: 4 };
    assert.equal(C.cbtBlastStaged(ctx), ctx);
  });
  test('Revamp: metres by type, rockets and missiles 2D6 −1 m, a missile\'s Intelligence; successes stage', (t) => {
    t.after(urrMode());
    assert.equal(C.cbtScatterPerSuccess({ scatterType: 'standard' }), 2);
    assert.equal(C.cbtScatterPerSuccess({ scatterType: 'aerodynamic' }), 4);
    assert.equal(C.cbtScatterPerSuccess({ scatterType: 'launcher' }), 4);
    assert.equal(C.cbtScatterMetres(0, [6, 5], 2, { scatterType: 'aerodynamic' }), 3);
    const rocket = C.cbtScatterExtras({ blastKind: 'heRocket', name: 'Rocket launcher', guidance: 0 });
    assert.deepEqual(rocket, { rocket80: 'rocket', guidance80: 0 });
    const missile = C.cbtScatterExtras({ blastKind: 'avRocket', name: 'Launcher', guidance: 3 }) as any;
    assert.equal(missile.rocket80, 'missile');
    assert.equal(C.cbtScatterDice(missile, 4), 2);
    assert.equal(C.cbtScatterMetres(0, [6, 6], 2, missile), 7);              // 12 − 2 − 3
    assert.deepEqual(C.cbtScatterExtras({ blastKind: 'offensive', name: 'Grenade' }), {});
    assert.equal(C.cbtBlastStaged({ level: 'M' as const, successes: 4 }).level, 'D');
    assert.equal(C.cbtBlastStaged({ level: 'M' as const, successes: 0 }).level, 'M');
  });
});

describe('v0.80.0 combat: melee extras, armor, cover', () => {
  test('book: no subdue TN, no charge Power, the old charging label', () => {
    assert.deepEqual(C.cbtSubdueMods(true), []);
    assert.equal(C.cbtChargePower(true), 0);
    assert.equal(C.cbtChargeLabel(), '-1');
    assert.equal(C.cbtEncumbrance(3), 3);
    assert.equal(C.cbtArmorPoolPenalty(8, 5), 0);
    assert.equal(C.cbtIsCoverId('partialCover'), true);
    assert.equal(C.cbtIsCoverId('partialCoverLight'), false);
  });
  test('Revamp: +2 TN subduing, +1 Power charging, armor costs pool dice, two layers, graded cover', (t) => {
    t.after(urrMode());
    assert.deepEqual(C.cbtSubdueMods(true), [{ label: 'Subduing', value: 2 }]);
    assert.deepEqual(C.cbtSubdueMods(false), []);
    assert.equal(C.cbtChargePower(true), 1);
    assert.equal(C.cbtChargePower(false), 0);
    assert.equal(C.cbtChargeLabel(), '+1 Power');
    assert.equal(C.cbtEncumbrance(3), 0);
    assert.equal(C.cbtArmorPoolPenalty(8, 5), 3);
    assert.equal(C.cbtArmorPoolPenalty(4, 5), 0);
    assert.equal(C.cbtIsCoverId('partialCoverLight'), true);
    assert.equal(C.cbtIsCoverId('partialCoverHeavy'), true);
    assert.equal(C.cbtIsCoverId('targetRunning'), false);
  });
});
