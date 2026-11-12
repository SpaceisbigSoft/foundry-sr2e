/**
 * v0.92.3 book alignment (area: combat): the pure rules. Each change is checked the book's way (the shipped default)
 * and the v0.92.2 way (combat922(): every COMBAT_V923 switch at its old choice and the moved defaults put back), and
 * the Unified Rules Revamp source is checked to be untouched by the new switches.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { COMBAT_V923, HOUSE_COMBAT_V923 } from '../config923/combat.ts';
import { stageForNetSuccesses } from '../damage.ts';
import { resolveMelee, blastFalloff, blastPower } from '../weapons.ts';
import { resolveCombatSpell } from '../magic.ts';
import { delayValid } from '../flow.ts';
import { aimCap } from '../tactics.ts';
import * as C923 from '../combat923.ts';
import * as U80C from '../urr80-combat.ts';
import { combat922 } from './combat922.ts';
import { urrMode } from './urrmode.ts';
import { oldWay } from './oldway.ts';

describe('v0.92.3 combat: the defaults are the book', () => {
  test('every switch ships at its first (book) choice, and each has a house-rules row', () => {
    for (const row of HOUSE_COMBAT_V923) {
      const key = row.path.replace('COMBAT_V923.', '') as keyof typeof COMBAT_V923;
      assert.ok(key in COMBAT_V923, row.path);
      if (row.type === 'select') assert.equal(COMBAT_V923[key], row.choices![0], row.path);
    }
    assert.equal(COMBAT_V923.subdueTn, 2);
    assert.equal(COMBAT_V923.rangedRows, true);
  });

  test('defaults moved in place (Core pp. 80, 82, 91, 98, 99, 101, 112)', () => {
    assert.equal(RULES.ATTACK_STAGING, 'all');
    assert.equal(RULES.COMBAT.melee.tie, 'attacker');
    assert.equal(RULES.INITIATIVE_WOUNDS.midTurn, false);
    assert.equal(RULES.DELAY.lostAtPassEnd, false);
    assert.equal(RULES.COMBAT.grenades.find((g) => g.id === 'apRocket')?.perMetre, 2);
    // v0.92.4 (the owner's decision): the anti-vehicle rocket's −8 per metre (Core p. 99).
    assert.equal(RULES.COMBAT.grenades.find((g) => g.id === 'avRocket')?.perMetre, 8);
    assert.equal(RULES.COMBAT.demolitions.tn, 2);
    assert.equal(RULES.COMBAT.ready.rule, 'action');
  });

  test('the Ranged Combat Modifiers Table rows (Core p. 89)', () => {
    const v = (id: string) => RULES.SITUATIONAL_MODIFIERS.find((m) => m.id === id)?.value;
    assert.equal(v('targetRunning'), 2);
    assert.equal(v('targetStationary'), -1);
    assert.equal(v('attackerInMelee'), 2);
    assert.equal(v('attackerInMelee2'), 4);
    assert.equal(v('attackerWalkingRough'), 2);
    assert.equal(v('attackerRunningRough'), 6);
    assert.equal(v('smartGoggles'), -1);
    assert.ok(C923.rangedRowShown('targetRunning'));
  });

  test('old: the new rows are hidden in the dialog; the old rows still show', (t) => {
    t.after(combat922());
    assert.equal(C923.rangedRowShown('targetRunning'), false);
    assert.equal(C923.rangedRowShown('smartGoggles'), false);
    assert.equal(C923.rangedRowShown('partialCover'), true);
  });
});

describe('v0.92.3 combat: staging (ATTACK_STAGING, Core pp. 91, 101, 110)', () => {
  test('book: 2 net successes stage M to S; 4 stage M to D', () => {
    assert.equal(stageForNetSuccesses('M', 2), 'S');
    assert.equal(stageForNetSuccesses('M', 4), 'D');
    assert.equal(stageForNetSuccesses('M', 1), 'M');
  });

  test('book: melee (Geist: 2 net take 4M Stun to S) and combat spells stage the same way', () => {
    const r = resolveMelee({ attackerSuccesses: 5, defenderSuccesses: 3, attacker: { power: 4, level: 'M' }, defender: null });
    assert.equal(r.level, 'S');
    assert.equal(resolveCombatSpell({ casterSuccesses: 4, resistSuccesses: 2, level: 'M' }).level, 'S');
  });

  test('old: 2 net is no stage, 3 is one', (t) => {
    t.after(combat922());
    assert.equal(stageForNetSuccesses('M', 2), 'M');
    assert.equal(stageForNetSuccesses('M', 3), 'S');
  });
});

describe('v0.92.3 combat: a melee tie (COMBAT.melee.tie, Core pp. 100–101)', () => {
  test('book: the tie goes to the attacker at base damage', () => {
    const r = resolveMelee({ attackerSuccesses: 2, defenderSuccesses: 2, attacker: { power: 6, level: 'M' }, defender: { power: 4, level: 'M' } });
    assert.equal(r.winner, 'attacker');
    assert.equal(r.level, 'M');
  });
  test('old: nobody is hurt', (t) => {
    t.after(combat922());
    const r = resolveMelee({ attackerSuccesses: 2, defenderSuccesses: 2, attacker: { power: 6, level: 'M' }, defender: { power: 4, level: 'M' } });
    assert.equal(r.winner, 'none');
  });
});

describe('v0.92.3 combat: ranged defense (COMBAT_V923.rangedDefense, Core pp. 87, 91; Ka-Ge 7 Q4)', () => {
  const shot = { astral: false };
  test('book: no dodge for a ranged attack; the Revamp\'s soak procedure is the book\'s', () => {
    assert.equal(U80C.cbtCleanMissRanged(shot, false), true);
    assert.equal(U80C.cbtCleanMissRanged(shot, true), false);                 // opposed melee keeps its own test
    assert.equal(U80C.cbtCleanMissRanged({ suppressive: true }, false), false);
  });
  test('review fix: a melee attack that isn\'t opposed (defender down, unaware) keeps the v0.92.2 path, not the ranged rule', (t) => {
    assert.equal(U80C.cbtCleanMissRanged({ melee: true }, false), false);
    t.after(urrMode({ 'URR_V80.cbtDefense': 'cleanMiss' }));
    assert.equal(U80C.cbtCleanMissRanged({ melee: true }, false), true, 'the Revamp\'s own flow still takes it');
  });
  test('book: Ka-Ge 7 Q4: 9M, 6 attack successes against 8 resistance is L', () => {
    const r = U80C.cbtSoakLevel('M', { hits: 6, net: 6 }, 8, 1);
    assert.equal(r.level, 'L');
    assert.equal(r.clean, false);
  });
  test('book: a tie is the base damage; pool successes alone above the attack\'s are a clean miss', () => {
    assert.equal(U80C.cbtSoakLevel('M', { hits: 3, net: 3 }, 3, 0).level, 'M');
    assert.equal(U80C.cbtSoakLevel('M', { hits: 2, net: 2 }, 3, 3).clean, true);
  });
  test('old: the dodge flow', (t) => {
    t.after(combat922());
    assert.equal(U80C.cbtCleanMissRanged(shot, false), false);
  });
  test('Revamp: unchanged, and the v0.92.3 switches are inert under it', (t) => {
    t.after(urrMode({ 'URR_V80.cbtDefense': 'dodge' }));
    assert.equal(U80C.cbtCleanMissRanged(shot, false), false);
    assert.equal(C923.rangedDefenseBook(), false);
  });
});

describe('v0.92.3 combat: full defense (COMBAT_V923.fullDefense, Core p. 102)', () => {
  test('book: no extra dice, no pool on the melee test, no initiative cost', () => {
    assert.equal(U80C.cbtFullDefenseDice(5), 0);
    assert.equal(U80C.cbtMeleeDefensePool(true, 4), 0);
    assert.equal(U80C.cbtMeleeDefensePool(false, 4), 4);
    assert.equal(C923.fullDefenseInitiativeCost(), 0);
  });
  test('book: the hit carries the clean-miss tally, staged apart at the soak', () => {
    assert.deepEqual(C923.fullDefenseTally(3, 2, true), { hits: 3, net: 2, apart: true });
    assert.equal(C923.fullDefenseTally(3, 2, false), null);
    // Pool successes 4 beat 3 attack successes: a clean miss.
    assert.deepEqual(C923.apartSoak('S', 3, 4, 4), { level: null, clean: true });
    // Otherwise 3 resistance successes take S down one level (on its own, not compared).
    assert.deepEqual(C923.apartSoak('S', 3, 3, 1), { level: 'M', clean: false });
    assert.deepEqual(C923.apartSoak('L', 3, 2, 0), { level: null, clean: false });
  });
  test('old: + attribute dice and the initiative cost', (t) => {
    t.after(combat922());
    assert.equal(U80C.cbtFullDefenseDice(5), 5);
    assert.equal(U80C.cbtMeleeDefensePool(true, 4), 4);
    assert.equal(C923.fullDefenseInitiativeCost(), RULES.COMBAT.fullDefense.initiativeCost);
    assert.equal(C923.fullDefenseTally(3, 2, true), null);
  });
});

describe('v0.92.3 combat: the Combat Pool refresh (COMBAT_V923.poolRefresh, Core pp. 78, 84)', () => {
  test('book: per action; each action has its own key', () => {
    assert.equal(C923.poolRefreshPerAction(), true);
    const a = C923.actionKey({ combatId: 'c', round: 1, pass: 0, combatantId: 'x' });
    assert.notEqual(a, C923.actionKey({ combatId: 'c', round: 1, pass: 1, combatantId: 'x' }));
    assert.notEqual(a, C923.actionKey({ combatId: 'c', round: 2, pass: 0, combatantId: 'x' }));
    assert.equal(a, C923.actionKey({ combatId: 'c', round: 1, pass: 0, combatantId: 'x' }));
  });
  test('old: per Combat Turn', (t) => {
    t.after(combat922());
    assert.equal(C923.poolRefreshPerAction(), false);
  });
});

describe('v0.92.3 combat: knockdown (COMBAT_V923.knockdown, Core pp. 92, 102)', () => {
  test('book: TN half the Power (round down), gel the Power, melee the attacker\'s Strength', () => {
    assert.equal(U80C.cbtKnockdownTn({ power: 9, tn: 4, melee: false }), 4);
    assert.equal(U80C.cbtKnockdownTn({ power: 7, tn: 4, melee: false, gel: true }), 7);
    assert.equal(U80C.cbtKnockdownTn({ power: 9, tn: 4, melee: true, strength: 5 }), 5);
    assert.equal(U80C.cbtKnockdownTn({ power: 9, tn: 4, melee: true }), 9);
    assert.equal(U80C.cbtKnockdownTn({ power: 3, tn: 4, melee: false }), 2);
  });
  test('book: every damaging hit; beat half the wound or stagger 1 m; none or Deadly is down', () => {
    assert.equal(U80C.cbtKnockdownDue(false, 'L'), true);
    assert.equal(U80C.cbtKnockdownDue(true, null), false);
    assert.deepEqual(U80C.cbtKnockdownFlag('M'), { level: 'M' });
    assert.deepEqual(U80C.cbtKnockdownResult(3, 'M'), { down: false, staggerMetres: 0 });
    assert.deepEqual(U80C.cbtKnockdownResult(2, 'M'), { down: false, staggerMetres: 1 });
    assert.deepEqual(U80C.cbtKnockdownResult(1, 'M'), { down: false, staggerMetres: 1 });
    assert.deepEqual(U80C.cbtKnockdownResult(0, 'L'), { down: true, staggerMetres: 0 });
    assert.deepEqual(U80C.cbtKnockdownResult(9, 'D'), { down: true, staggerMetres: 0 });
    assert.deepEqual(U80C.cbtKnockdownResult(2, 'L'), { down: false, staggerMetres: 0 });
  });
  test('old: the soak TN when Power beats Body; no successes = down', (t) => {
    t.after(combat922());
    assert.equal(U80C.cbtKnockdownTn({ power: 9, tn: 4, melee: false }), 4);
    assert.equal(U80C.cbtKnockdownTn({ power: 12, tn: 7, melee: false }), 7);
    assert.equal(U80C.cbtKnockdownDue(false, 'L'), false);
    assert.deepEqual(U80C.cbtKnockdownFlag('M'), {});
    assert.deepEqual(U80C.cbtKnockdownResult(1, 'M'), { down: false, staggerMetres: 0 });
  });
  test('Revamp: its own 2/3/4 and staggering per missing success', (t) => {
    t.after(urrMode());
    assert.deepEqual(U80C.cbtKnockdownResult(1, 'M'), { down: false, staggerMetres: 2 });
  });
});

describe('v0.92.3 combat: blasts (COMBAT_V923.blastStaging, Core p. 97)', () => {
  test('book: each target\'s soak compares its successes with the attack\'s (no clean miss)', () => {
    assert.deepEqual(C923.blastTally(3), { hits: 3, net: 3, noClean: true });
    const r = U80C.cbtSoakLevel('S', C923.blastTally(4)!, 1, 3);
    assert.equal(r.level, 'D');                                                  // 4 vs 1: 3 net, up one
    assert.equal(r.clean, false);
    assert.equal(U80C.cbtSoakLevel('S', C923.blastTally(1)!, 5, 0).level, 'L'); // 1 vs 5: down two
  });
  test('old: none (the successes only cut the scatter)', (t) => {
    t.after(combat922());
    assert.equal(C923.blastTally(3), null);
  });
  test('Revamp: its own stage-up, no tally', (t) => {
    t.after(urrMode());
    assert.equal(C923.blastTally(3), null);
  });
});

describe('v0.92.3 combat: scatter (COMBAT_V923.scatter, Core pp. 97, 99)', () => {
  test('book: standard 2 m, aerodynamic and launcher 4 m a success; rockets 2D6, 4 m a success; missiles less their Intelligence', () => {
    assert.equal(U80C.cbtScatterPerSuccess({ scatterType: 'standard' }), 2);
    assert.equal(U80C.cbtScatterPerSuccess({ scatterType: 'aerodynamic' }), 4);
    assert.equal(U80C.cbtScatterPerSuccess({ scatterType: 'launcher' }), 4);
    const rocket = U80C.cbtScatterExtras({ blastKind: 'heRocket', name: 'Rocket launcher' }) as any;
    assert.equal(rocket.rocket80, 'rocket');
    assert.equal(U80C.cbtScatterDice(rocket, 3), 2);
    assert.equal(U80C.cbtScatterPerSuccess(rocket), 4);
    const missile = U80C.cbtScatterExtras({ blastKind: 'heRocket', name: 'Missile', guidance: 3 }) as any;
    assert.equal(U80C.cbtScatterMetres(99, [6, 5], 1, missile), 11 - 4 - 3);
  });
  test('old: 2 m for all, rockets by range band', (t) => {
    t.after(combat922());
    assert.equal(U80C.cbtScatterPerSuccess({ scatterType: 'aerodynamic' }), RULES.COMBAT.scatter.metresPerSuccess);
    assert.deepEqual(U80C.cbtScatterExtras({ blastKind: 'heRocket', name: 'Rocket launcher' }), {});
    assert.equal(U80C.cbtScatterMetres(7, [6, 5], 1, null), 7);
  });
  test('Revamp: its own 1 m a success for rockets', (t) => {
    t.after(urrMode());
    assert.equal(U80C.cbtScatterPerSuccess({ rocket80: 'rocket' }), 1);
  });
});

describe('v0.92.3 combat: shotguns (COMBAT_V923.shotgun, Core p. 95)', () => {
  test('book: a slug unless loaded with shot', () => {
    assert.equal(U80C.cbtShotgunSpreads('standard'), false);
    assert.equal(U80C.cbtShotgunSpreads('shot'), true);
    assert.ok(RULES.COMBAT.ammo.some((a) => a.id === 'shot'));
    assert.ok(RULES.DOCS_V79.rangedFlechette.ammoIds.includes('shot'));
  });
  test('book: choke 2: 1 m to 2 m, 2 m to 4 m, 4 m to 6 m (−2 Power, −2 TN at 6 m); choke 5: −2 at 15 m, −3 at 20 m', () => {
    assert.deepEqual(C923.shotSpreadBook(2, 2, 10), { width: 1, power: 10, loss: 0 });
    assert.deepEqual(C923.shotSpreadBook(4, 2, 10), { width: 2, power: 9, loss: 1 });
    assert.deepEqual(C923.shotSpreadBook(6, 2, 10), { width: 4, power: 8, loss: 2 });
    assert.equal(C923.shotSpreadBook(15, 5, 10).loss, 2);
    assert.equal(C923.shotSpreadBook(20, 5, 10).loss, 3);
    assert.equal(C923.shotSpreadBook(20, 5, 10).width, 6);
    assert.deepEqual(U80C.cbtShotgunSpread({ width: 9, power: 9, loss: 9 }, 6, 2, 10), { width: 4, power: 8, loss: 2 });
    assert.equal(U80C.cbtShotgunTn([], 6, 2)[0]?.value, -2);
    assert.deepEqual(U80C.cbtShotgunTn([{ label: 'x', value: 1 }], 1, 2), []);
    assert.equal(C923.shotgunChoke(1), 2);
    assert.equal(C923.shotgunChoke(12), 10);
  });
  test('old: every shotgun spreads by the old table', (t) => {
    t.after(combat922());
    assert.equal(U80C.cbtShotgunSpreads('standard'), true);
    assert.deepEqual(U80C.cbtShotgunSpread({ width: 9, power: 9, loss: 9 }, 6, 2, 10), { width: 9, power: 9, loss: 9 });
    assert.equal(C923.shotgunChoke(1), 1);
  });
});

describe('v0.92.3 combat: tracers, reloads, heavy armor, initiative ties', () => {
  test('book tracers (Fields of Fire): full auto beyond short range, −1 per 3 rounds, no Power from them', () => {
    assert.deepEqual(U80C.cbtTracer(-2, { ammo: 'tracer', mode: 'FA', rounds: 6, smartgun: false, range: 'medium' }), { tn: -2, powerOff: 2 });
    assert.deepEqual(U80C.cbtTracer(-2, { ammo: 'tracer', mode: 'FA', rounds: 6, smartgun: false, range: 'short' }), { tn: 0, powerOff: 2 });
    assert.deepEqual(U80C.cbtTracer(-2, { ammo: 'tracer', mode: 'BF', rounds: 3, smartgun: false, range: 'long' }), { tn: 0, powerOff: 0 });
    assert.deepEqual(U80C.cbtTracer(-2, { ammo: 'tracer', mode: 'FA', rounds: 6, smartgun: true, range: 'long' }), { tn: 0, powerOff: 2 });
  });
  test('book reloads: a cylinder or internal magazine takes Quickness rounds, a break action 2 (Core p. 95)', () => {
    assert.equal(U80C.cbtReloadAmount(2, 'cylinder', 0, 6, 5), 5);
    assert.equal(U80C.cbtReloadAmount(2, 'internal', 3, 5, 5), 2);
    assert.equal(U80C.cbtReloadAmount(2, 'break', 0, 2, 5), 2);
  });
  test('heavy armor is one rule, GEAR_V923.armorEncumbrance (Dice Pools p. 85): the Revamp\'s any-armor pool rule stays off in the book', () => {
    assert.equal(U80C.cbtArmorPoolPenalty(8, 5), 0);
    assert.ok(!('armorPenalty' in COMBAT_V923));
  });
  test('book ties: adjusted Reaction, then natural Reaction (Core p. 79)', () => {
    assert.deepEqual(U80C.cbtTieKeys(), ['reaction', 'naturalReaction']);
  });
  test('old: all four as before', (t) => {
    t.after(combat922());
    assert.deepEqual(U80C.cbtTracer(-2, { ammo: 'tracer', mode: 'FA', rounds: 6, smartgun: false, range: 'medium' }), { tn: -2, powerOff: 0 });
    assert.equal(U80C.cbtReloadAmount(2, 'cylinder', 0, 6, 5), 2);
    assert.equal(U80C.cbtEncumbrance(3), 3);
    assert.equal(U80C.cbtArmorPoolPenalty(8, 5), 0);
    assert.deepEqual(U80C.cbtTieKeys(), [...RULES.INITIATIVE_TIES]);
  });
  test('Revamp: its break action still reloads whole', (t) => {
    t.after(urrMode());
    assert.equal(U80C.cbtReloadAmount(2, 'break', 0, 2, 5), 2);
    assert.equal(U80C.cbtReloadAmount(2, 'break', 0, 4, 5), 4);
  });
});

describe('v0.92.3 combat: melee extras (Core pp. 102–103)', () => {
  test('book: visibility halves (round down), except full darkness', () => {
    assert.equal(C923.meleeVisibility({ label: 'Minimal light', value: 6 })?.value, 3);
    assert.equal(C923.meleeVisibility({ label: 'Partial light', value: 1 }), null);
    assert.equal(C923.meleeVisibility({ label: 'Full darkness', value: 8 }, true)?.value, 8);
  });
  test('book: subduing +2; several melee targets count', () => {
    assert.deepEqual(C923.subdueMods(true).map((m) => m.value), [2]);
    assert.deepEqual(C923.subdueMods(false), []);
    assert.equal(C923.meleeTargetsBook(), true);
  });
  test('book: friends counted on both sides (more: −1 each, at most −4; fewer: +1 each)', () => {
    assert.deepEqual(C923.friendsNet(3, 1)?.map((m) => m.value), [-2]);
    assert.deepEqual(C923.friendsNet(0, 2)?.map((m) => m.value), [2]);
    assert.deepEqual(C923.friendsNet(9, 0)?.map((m) => m.value), [-4]);
    assert.deepEqual(C923.friendsNet(2, 2), []);
  });
  test('old: full values, no subduing TN, ranged only', (t) => {
    t.after(combat922());
    assert.equal(C923.friendsNet(3, 1), null);
    assert.equal(C923.meleeVisibility({ label: 'Minimal light', value: 6 })?.value, 6);
    assert.deepEqual(C923.subdueMods(true), []);
    assert.equal(C923.meleeTargetsBook(), false);
  });
  test('Revamp: its own subduing TN only', (t) => {
    t.after(urrMode());
    assert.deepEqual(C923.subdueMods(true), []);
    assert.deepEqual(U80C.cbtSubdueMods(true).map((m) => m.value), [2]);
  });
});

describe('v0.92.3 combat: firearms (Core pp. 92–93, 98)', () => {
  test('book: full auto at several targets: +2 per new target; a smartlinked smartgun wastes no rounds', () => {
    assert.deepEqual(C923.spreadTargetModifiers(0), []);
    assert.equal(C923.spreadTargetModifiers(1)[0]?.value, 2);
    assert.equal(C923.spreadTargetModifiers(2)[0]?.value, 4);
    assert.equal(C923.walkingWaste(3, true), 0);
    assert.equal(C923.walkingWaste(3, false), 3);
  });
  test('book: flechette against armor: the higher of double Impact and plain Ballistic (armor jacket 5/3: 6)', () => {
    assert.equal(C923.flechetteArmorBook(5, 3, 2)?.armor, 6);
    assert.equal(C923.flechetteArmorBook(5, 2, 2)?.armor, 5);
  });
  test('book: a barrier above the Power stops the shot; double against flechette and explosive', () => {
    assert.deepEqual(C923.barrierThrough({ rating: 6, power: 9, ammoId: 'standard' }), { armor: 6, stops: false });
    assert.deepEqual(C923.barrierThrough({ rating: 6, power: 9, ammoId: 'explosive' }), { armor: 12, stops: true });
    assert.deepEqual(C923.barrierThrough({ rating: 12, power: 9, ammoId: 'standard' }), { armor: 12, stops: true });
    assert.equal(C923.barrierThrough({ rating: 0, power: 9 }), null);
  });
  test('book: short bursts: 2 rounds +2 Power and no level; 1 round a single shot', () => {
    assert.deepEqual(C923.shortBurst(3, 2), { rounds: 2, power: 2, stages: 0, recoil: 2 });
    assert.deepEqual(C923.shortBurst(3, 1), { rounds: 1, power: 0, stages: 0, recoil: 0 });
    assert.equal(C923.shortBurst(3, 3), null);
    assert.equal(C923.shortBurst(3, 0), null);
  });
  test('book: a second firearm cancels smartlink, goggles and laser; shot takes no goggles or laser, smartlink only −1', () => {
    assert.deepEqual(C923.sightAidsDropped({ melee: false, secondWeapon: true, shot: false }), { drop: ['smartlink', 'smartGoggles', 'laserSight'], why: 'second', smartlinkAdd: 0 });
    assert.deepEqual(C923.sightAidsDropped({ melee: false, secondWeapon: false, shot: true }), { drop: ['smartGoggles', 'laserSight'], why: 'shot', smartlinkAdd: 1 });
    assert.deepEqual(C923.sightAidsDropped({ melee: true, secondWeapon: true, shot: false }).drop, []);
  });
  test('old: none of these', (t) => {
    t.after(combat922());
    assert.deepEqual(C923.sightAidsDropped({ melee: false, secondWeapon: true, shot: true }).drop, []);
    assert.equal(C923.spreadFireBook(), false);
    assert.equal(C923.walkingWaste(3, true), 3);
    assert.equal(C923.flechetteArmorBook(5, 3, 2), null);
    assert.equal(C923.barrierThrough({ rating: 12, power: 9 }), null);
    assert.equal(C923.shortBurst(3, 2), null);
  });
});

describe('v0.92.3 combat: called shots (Core p. 92)', () => {
  test('book: not in full auto; no armor gap', () => {
    assert.equal(C923.calledShotAllowed('damage', false), 'damage');
    assert.equal(C923.calledShotAllowed('damage', true), 'none');
    assert.equal(C923.calledShotAllowed('armor', false), 'none');
    assert.equal(C923.calledShotGap(), false);
  });
  test('old: any mode, and the gap', (t) => {
    t.after(combat922());
    assert.equal(C923.calledShotAllowed('damage', true), 'damage');
    assert.equal(C923.calledShotAllowed('armor', false), 'armor');
    assert.equal(C923.calledShotGap(), true);
  });
});

describe('v0.92.3 combat: Take Aim (Core p. 82)', () => {
  test('book: half the skill, rounded down (skill 1: none)', () => {
    assert.equal(aimCap(1), 0);
    assert.equal(aimCap(5), 2);
  });
  test('old: at least 1', (t) => {
    t.after(combat922());
    assert.equal(aimCap(1), 1);
  });
  test('Revamp (silent on Take Aim): the book\'s cap applies there too', (t) => {
    t.after(urrMode());
    assert.ok(!C923.REVAMP_COMBAT_RULES.has('aim'));
    assert.equal(aimCap(1), 0);
    assert.equal(aimCap(5), 2);
  });
});

describe('v0.92.3 combat: the Revamp source', () => {
  test('a switch for a rule the Revamp changes itself answers the v0.92.2 way there (its own rule decides)', (t) => {
    t.after(urrMode());
    assert.equal(C923.rangedDefenseBook(), false);
    assert.equal(C923.knockdownBook(), false);
    assert.equal(C923.tiesBook(), false);
    assert.equal(C923.scatterBook(), null);
  });
  test('book fixes the Revamp is silent on apply there: melee visibility halved, flechette, called shots', (t) => {
    t.after(urrMode());
    assert.equal(C923.meleeVisibility({ label: 'Partial light', value: 2 })?.value, 1);
    assert.equal(C923.flechetteArmorBook(5, 3, 2)?.armor, 6);
    assert.equal(C923.calledShotGap(), false);
  });
});

describe('v0.92.3 combat: delays and surprise (Core pp. 80, 86)', () => {
  const now = { combatId: 'c', round: 3, pass: 0 };
  test('book: a held delay carries into the next Combat Turn (not further)', () => {
    assert.equal(delayValid({ combatId: 'c', round: 2, pass: 1 }, now, true), true);
    assert.equal(delayValid({ combatId: 'c', round: 1, pass: 1 }, now, true), false);
    assert.equal(delayValid({ combatId: 'c', round: 2, pass: 1 }, now), false);     // actingNow doesn't carry
    assert.equal(delayValid({ combatId: 'c', round: 3, pass: 0 }, { ...now, pass: 1 }, true), true);
  });
  test('book: an ambusher waiting on a delay rolls at −2', () => {
    assert.equal(C923.ambushTn(true), -2);
    assert.equal(C923.ambushTn(false), 0);
  });
  test('old: the delay ends with the pass and the turn; no ambush change', (t) => {
    t.after(combat922());
    assert.equal(delayValid({ combatId: 'c', round: 2, pass: 1 }, now, true), false);
    assert.equal(delayValid({ combatId: 'c', round: 3, pass: 0 }, { ...now, pass: 1 }, true), false);
    assert.equal(C923.ambushTn(true), 0);
  });
  test('DELAY.lostAtPassEnd on: the book delay switch has no effect', (t) => {
    t.after(oldWay({ 'DELAY.lostAtPassEnd': true }));
    assert.equal(C923.delayBook(), false);
  });
});

describe('v0.92.4 the anti-vehicle rocket falloff (Core p. 99; COMBAT_V923.avRocket)', () => {
  test('book: −8 Power per metre; a Power 16 blast is spent at 2 m', () => {
    assert.equal(COMBAT_V923.avRocket, 'book');
    const pm = blastFalloff('avRocket', 1);
    assert.equal(pm, 8);
    assert.deepEqual([0, 1, 2].map((m) => blastPower(16, m, pm)), [16, 8, 0]);
    assert.equal(blastFalloff('apRocket', 1), 2, 'the anti-personnel rocket is untouched');
  });
  test("old: −1 per 4 m, as v0.78.0–v0.92.3", () => {
    const was = RULES.COMBAT_V923.avRocket;
    (RULES.COMBAT_V923 as any).avRocket = 'old';
    try {
      assert.equal(blastFalloff('avRocket', 1), 0.25);
      assert.equal(blastPower(16, 9, blastFalloff('avRocket', 1)), 14);
      assert.equal(blastFalloff('apRocket', 1), 2);
    } finally { (RULES.COMBAT_V923 as any).avRocket = was; }
  });
  test('the Revamp keeps its own value (8) whatever the switch says', () => {
    const was = RULES.COMBAT_V923.avRocket, act = RULES.URR_V80.active;
    (RULES.COMBAT_V923 as any).avRocket = 'old'; (RULES.URR_V80 as any).active = true;
    try { assert.equal(blastFalloff('avRocket', 1), 8); }
    finally { (RULES.COMBAT_V923 as any).avRocket = was; (RULES.URR_V80 as any).active = act; }
  });
  test('the house-rules window lists the switch', () => {
    assert.ok(HOUSE_COMBAT_V923.some((r) => r.path === 'COMBAT_V923.avRocket'));
  });
});
