/**
 * v0.98.0 rules completeness, vehicles: driving, vehicle combat and chases (RULES.VDRIVE_V98): the pure rules
 * (rules/vdrive98.ts), and for each switch that its other value ('v971') gives the v0.97.1 result.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/config.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as X from '../rules/vdrive98.ts';
import { HOUSE_VDRIVE_V98, CHASE98 } from '../rules/config98/vdrive.ts';
import { VDRIVE_V971_WAY } from '../rules/__tests__/vdrive971.ts';
import { drivingModifiers, vcrTnFactor } from '../rules/vehicles.ts';
import { TOOLS, toolLabelKey, toolHintKey } from '../rules/tools.ts';

/** English from public/lang/en.json, with this area's draft while it isn't merged. */
function english(): Record<string, string> {
  const flat: Record<string, string> = {};
  const walk = (o: unknown, p: string): void => { if (typeof o === 'string') { flat[p] = o; return; } if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k); };
  walk(JSON.parse(readFileSync(join('public', 'lang', 'en.json'), 'utf8')), '');
  for (const f of ['vdrive98.json', 'vdrive98-fix.json', 'vdrive98-fix2.json']) {
    const draft = join('i18n-drafts', f);
    if (existsSync(draft)) Object.assign(flat, JSON.parse(readFileSync(draft, 'utf8')));
  }
  return flat;
}
(globalThis as any).__SR2E_EN__ = { ...((globalThis as any).__SR2E_EN__ ?? {}), ...english() };

const one = (k: string, v: string) => oldWay({ [`VDRIVE_V98.${k}`]: v });

describe('v0.98.0 vehicles: the switches', () => {
  test('every switch has a house-rules row, the book first and the default; the old way is v971', () => {
    const v: any = RULES.VDRIVE_V98;
    for (const r of HOUSE_VDRIVE_V98) {
      const key = r.path.split('.')[1]!;
      assert.equal(v[key], r.choices![0], `${r.path} defaults to its first choice`);
      assert.deepEqual(r.choices, ['book', 'v971']);
    }
    for (const k of Object.keys(v)) if (typeof v[k] === 'string') assert.ok(HOUSE_VDRIVE_V98.some((r) => r.path === `VDRIVE_V98.${k}`), k);
    assert.equal(Object.keys(VDRIVE_V971_WAY).length, HOUSE_VDRIVE_V98.length);
  });
  test('every house-rules row, the tool and every key the code uses has English', () => {
    const en = english();
    for (const r of HOUSE_VDRIVE_V98) assert.ok(en[`SR2E.HouseRules.Rule.${r.path.replace('.', '__')}`], r.path);
    assert.ok(TOOLS.some((t) => t.id === 'chase98' && t.who === 'gm'));
    assert.ok(en[toolLabelKey('chase98')] && en[toolHintKey('chase98')]);
    const src = ['src/module/rules/vdrive98.ts', 'src/module/applications/vdrive98.ts', 'src/module/documents/index.ts', 'public/templates/actor-vehicle-sheet.hbs']
      .map((f) => readFileSync(join(...f.split('/')), 'utf8')).join('\n');
    const keys = new Set([...src.matchAll(/SR2E\.VDrive98\.[A-Za-z0-9_.]+[A-Za-z0-9]/g)].map((m) => m[0]));
    keys.delete('SR2E.VDrive98.Type');
    for (const t of X.VEHICLE_TYPES) keys.add(`SR2E.VDrive98.Type.${t}`);
    for (const k of keys) assert.ok(en[k], k);
  });
  test('the Revamp keeps its own chase: chase, passengerPhase and gunneryRows read off under it', (t) => {
    t.after(oldWay({ 'URR_V80.active': true }));
    assert.equal(X.on('chase'), false);
    assert.equal(X.on('passengerPhase'), false);
    assert.equal(X.on('gunneryRows'), false);
    assert.equal(X.on('stress'), true);
  });
});

describe('off-road Speed (Rigger 2 pp. 22, 125)', () => {
  test('half off-road for a ground vehicle without off-road suspension', () => {
    assert.equal(X.offroadSpeed(91, { offroad: true, suspension: false, category: 'car' }), 45);
    assert.equal(X.offroadSpeed(90, { offroad: true, suspension: true, category: 'car' }), 90);
    assert.equal(X.offroadSpeed(90, { offroad: false, suspension: false, category: 'car' }), 90);
    assert.equal(X.offroadSpeed(90, { offroad: true, suspension: false, category: 'rotor' }), 90);
  });
  test('v971: the same off-road', (t) => {
    t.after(one('offRoad', 'v971'));
    assert.equal(X.offroadSpeed(90, { offroad: true, suspension: false, category: 'car' }), 90);
  });
});

describe('exceeding the Speed and Stress (Rigger 2 pp. 22, 25–26, 45)', () => {
  test('at most 1.5 × the Speed; a Stress Point for speeding up past it', () => {
    assert.equal(X.maxSpeed(210), 315);
    assert.deepEqual(X.speedChange({ from: 250, to: 400, speed: 210 }), { to: 315, capped: true, stress: 1 });
    // The book's example: 250 → 286 with a Speed of 210 costs a Stress Point.
    assert.equal(X.speedChange({ from: 250, to: 286, speed: 210 }).stress, 1);
    assert.equal(X.speedChange({ from: 100, to: 200, speed: 210 }).stress, 0);
    assert.equal(X.speedChange({ from: 300, to: 250, speed: 210 }).stress, 0);
  });
  test('the Rule of One, the Stress Test and twice the Body', () => {
    assert.equal(X.ruleOfOne(5, 5), true);
    assert.equal(X.ruleOfOne(4, 5), false);
    assert.equal(X.stressTestFails(4, 6), true);
    assert.equal(X.stressTestFails(4, 2), false);
    assert.equal(X.stressBreaks(6, 3), true);
    assert.equal(X.stressBreaks(5, 3), false);
  });
  test('v971: no cap, no Stress', (t) => {
    t.after(oldWay({ 'VDRIVE_V98.speedCap': 'v971', 'VDRIVE_V98.stress': 'v971' }));
    assert.deepEqual(X.speedChange({ from: 250, to: 400, speed: 210 }), { to: 400, capped: false, stress: 0 });
    assert.equal(X.ruleOfOne(9, 1), false);
    assert.equal(X.stressBreaks(10, 1), false);
  });
});

describe('rigger defaulting (Rigger 2 p. 12) and the datajack (p. 124)', () => {
  test('jumped in, +1 per dot from Reaction or a vehicle skill', () => {
    assert.equal(X.riggerDefault(4, { jumped: true, from: 'reaction' }), 2);
    assert.equal(X.riggerDefault(2, { jumped: true, from: 'vehicleSkill' }), 1);
    assert.equal(X.riggerDefault(4, { jumped: false, from: 'reaction' }), 4);
    assert.equal(X.riggerDefault(4, { jumped: true, from: 'other' }), 4);
    assert.equal(X.isVehicleSkill('Bike'), true);
    assert.equal(X.isVehicleSkill('Pistols'), false);
  });
  test('+1 Reaction driving by hand through a datajack', () => {
    assert.equal(X.datajackReaction({ manual: true, ticked: true, datajack: true }), 1);
    assert.equal(X.datajackReaction({ manual: true, ticked: true, datajack: false }), 0);
    assert.equal(X.datajackReaction({ manual: false, ticked: true, datajack: true }), 0);
  });
  test('v971: the full modifier, no Reaction', (t) => {
    t.after(oldWay({ 'VDRIVE_V98.riggerDefault': 'v971', 'VDRIVE_V98.datajackReaction': 'v971' }));
    assert.equal(X.riggerDefault(4, { jumped: true, from: 'reaction' }), 4);
    assert.equal(X.datajackReaction({ manual: true, ticked: true, datajack: true }), 0);
  });
});

describe('the autonav in combat maneuvers (Rigger 2 pp. 45–49)', () => {
  test('+ rating, ramming + rating + 2, relocating − rating; off: none, and no dice', () => {
    assert.equal(X.autonavManeuver('accel', 3, false)?.value, 3);
    assert.equal(X.autonavManeuver('position', 3, false)?.value, 3);
    assert.equal(X.autonavManeuver('ram', 3, false)?.value, 5);
    assert.equal(X.autonavManeuver('hide', 3, false)?.value, 3);
    assert.equal(X.autonavManeuver('relocate', 3, false)?.value, -3);
    assert.equal(X.autonavManeuver('accel', 3, true), null);
    assert.equal(X.autonavDiceOn(true), false);
    assert.equal(X.autonavDiceOn(false), true);
  });
  test('v971: no row; the autonav always adds its dice', (t) => {
    t.after(one('autonavCombat', 'v971'));
    assert.equal(X.autonavManeuver('ram', 3, false), null);
    assert.equal(X.autonavDiceOn(true), true);
  });
});

describe('the ram\'s range and walls (Rigger 2 pp. 47, 51–52)', () => {
  test('closer than the Acceleration; an unknown distance does not refuse', () => {
    assert.equal(X.ramInRange(10, 14).ok, true);
    assert.equal(X.ramInRange(14, 14).ok, false);
    assert.equal(X.ramInRange(null, 14).ok, true);
  });
  test('Barrier × 20: stop against it, or break through losing that speed (Power the Barrier, level by the loss)', () => {
    // The book's example: 300 m/turn into Barrier 16 (320) stops.
    assert.deepEqual(X.wallCollision(300, 16), { through: false, speedAfter: 0, power: 0, level: null });
    assert.deepEqual(X.wallCollision(300, 6), { through: true, speedAfter: 180, power: 6, level: 'S' });
    assert.deepEqual(X.wallCollision(60, 2), { through: true, speedAfter: 20, power: 2, level: 'M' });
    assert.equal(X.wallHurtsPassengers(true), false);
    assert.equal(X.wallHurtsPassengers(false), true);
  });
  test('v971: no check, no wall rule', (t) => {
    t.after(oldWay({ 'VDRIVE_V98.ramRange': 'v971', 'VDRIVE_V98.walls': 'v971' }));
    assert.equal(X.ramInRange(500, 14).ok, true);
    assert.equal(X.wallCollision(300, 6), null);
    assert.equal(X.wallHurtsPassengers(true), true);
  });
});

describe('the Maneuver Score (Rigger 2 pp. 41–49)', () => {
  test('Vehicle, Terrain and Speed Points: the book\'s Mach 6 (sports car, normal, 250) is 26', () => {
    assert.equal(X.partialScore({ type: 'sportsCar', category: 'car', terrain: 'normal', speed: 250 }), 26);
    assert.equal(X.partialScore({ type: '', category: 'car', terrain: 'normal', speed: 275 }), 25);
    assert.equal(X.vehiclePoints('', 'bike'), 5);
    assert.equal(X.terrainPoints('tight'), -10);
  });
  test('an Open Test keeps the highest die, sixes re-rolled and added', async () => {
    const faces = [6, 6, 4, 3, 1, 6, 4, 2];
    const roll = async (n: number) => faces.splice(0, n);
    const r = await X.openTest(5, roll);
    assert.equal(r.result, 16);
  });
  test('the score rows: ±2 within 10, ±4 beyond; hiding behind +3 / +6', () => {
    assert.equal(X.scoreDiff('accel', 37, 40), 2);
    assert.equal(X.scoreDiff('accel', 46, 35), -4);
    assert.equal(X.scoreDiff('hide', 30, 45), 6);
    assert.equal(X.scoreDiff('hide', 46, 36), -2);
    assert.equal(X.scoreDiff('relocate', 36, 46), 2);
    assert.equal(X.extraOpponents(2), 1);
    assert.equal(X.extraOpponents(1), 0);
  });
  test('the record: scores, positioning carried to Driver Points, a hide and the Escape Bonus, relocating', () => {
    let st = X.withScores(X.NO_CHASE, { combatId: 'c1', round: 2, scores: [{ v: 'A', score: 37, driver: 11, partial: 26 }] });
    assert.equal(X.scoreOf(st, 'A', 'c1', 2)?.score, 37);
    assert.equal(X.scoreOf(st, 'A', 'c1', 3), null);
    assert.equal(X.scoreOf(st, 'A', 'c2', 2), null);
    st = X.withPositioning(st, 'B', 1);
    st = X.withHide(st, 'A', ['B', 'C'], 4, 2);
    assert.equal(X.driverPoints(8, st, 'B'), 9);
    assert.equal(X.driverPoints(11, st, 'A'), 15);
    assert.ok(X.hiddenFrom(st, 'A', 'B'));
    st = X.withRelocated(st, 'A', 'B');
    assert.equal(X.hiddenFrom(st, 'A', 'B'), null);
    assert.ok(X.hiddenFrom(st, 'A', 'C'));
    assert.equal(X.escapeBonus(st, 'A'), 4);
    st = X.withRelocated(st, 'A', 'C');
    assert.equal(X.escapeBonus(st, 'A'), 0);
    // A new turn's scores spend the positioning, keep the hides of the same combat.
    const next = X.withScores(X.withHide(st, 'A', ['B'], 2, 2), { combatId: 'c1', round: 3, scores: [] });
    assert.equal(next.carry.length, 0);
    assert.equal(next.hides.length, 1);
  });
  test('a malformed record is cleaned', () => {
    const st = X.chaseState({ combatId: 5, round: 'x', scores: [{ v: '', score: 3 }, { v: 'A', score: 9e9, driver: -4 }], hides: [{ hider: 'A', from: ['B', 7], successes: 99 }] });
    assert.equal(st.scores.length, 1);
    assert.equal(st.scores[0]!.score, 500);
    assert.equal(st.scores[0]!.driver, 0);
    assert.deepEqual(st.hides[0]!.from, ['B']);
    assert.equal(st.hides[0]!.successes, 60);
  });
  test('passengers act only up to the Driver Points; the gunnery rows', () => {
    assert.equal(X.passengerMayAct(17, 11), false);
    assert.equal(X.passengerMayAct(7, 11), true);
    assert.equal(X.relativeMotion(300, 250), 'toward');
    assert.equal(X.relativeMotion(200, 250), 'away');
    const rows = X.gunneryRows({ mine: 50, theirs: 35, motion: 'away' });
    assert.deepEqual(rows.map((r) => r.value), [1, -1]);
    assert.deepEqual(X.gunneryRows({ mine: 35, theirs: 50, motion: null }).map((r) => r.value), [1]);
    assert.deepEqual(X.gunneryRows({ mine: 40, theirs: 50, motion: null }), []);
  });
  test('relocating: the rows against the Signature (the book\'s +4 for four hiding successes)', () => {
    const m = X.relocateMods({ mine: 36, theirs: 46, overSpeed: false, autonav: 0, autonavOff: false, hideSuccesses: 4, terrain: 'restricted' });
    assert.deepEqual(m.map((r) => r.value), [2, 4]);
    assert.equal(X.hideTerrain('open'), 4);
    assert.equal(X.hideTerrain('tight'), -2);
  });
  test('the Hiding Test drives with its own terrain row and the rig once', () => {
    assert.equal(vcrTnFactor('hide'), 1);
    const mods = drivingModifiers({ terrain: 'open', mode: 'manual', kind: 'hide' });
    assert.equal(mods.find((m) => m.value === 4)?.value, 4);
  });
  test('v971: no record read, no passenger limit, no gunnery rows', (t) => {
    t.after(oldWay({ 'VDRIVE_V98.chase': 'v971', 'VDRIVE_V98.passengerPhase': 'v971', 'VDRIVE_V98.gunneryRows': 'v971' }));
    const st = X.withScores(X.NO_CHASE, { combatId: 'c1', round: 2, scores: [{ v: 'A', score: 37, driver: 11, partial: 26 }] });
    assert.equal(X.scoreOf(st, 'A', 'c1', 2), null);
    assert.equal(X.passengerMayAct(17, 11), true);
    assert.deepEqual(X.gunneryRows({ mine: 50, theirs: 35, motion: 'away' }), []);
  });
});

describe('passengers in a crash (Rigger 2 pp. 50, 53, 128) and called shots (p. 53)', () => {
  test('a seat belt a level lower, APPS half the Power (round up), a crash cage 6 dice, the Crash Test pool', () => {
    // The book's cops: 15S, belts and APPS: 8M.
    assert.deepEqual(X.passengerSafety({ power: 15, level: 'S', belted: true, apps: true, cage: false }), { power: 8, level: 'M', dice: 0 });
    assert.deepEqual(X.passengerSafety({ power: 6, level: 'M', belted: false, apps: false, cage: true, cp: 3 }), { power: 6, level: 'M', dice: CHASE98.crashCageDice + 3 });
    assert.equal(X.passengerSafety({ power: 4, level: 'L', belted: true, apps: false, cage: false }), null);
    assert.equal(X.deadlyPassengerHit('D'), true);
    assert.equal(X.deadlyPassengerHit('S'), false);
  });
  test('a part needs Moderate; sensors Light; a turret Serious', () => {
    assert.equal(X.partKnockedOut('tires', 'L'), false);
    assert.equal(X.partKnockedOut('tires', 'M'), true);
    assert.equal(X.partKnockedOut('sensors', 'L'), true);
    assert.equal(X.partKnockedOut('mount', 'M', true), false);
    assert.equal(X.partKnockedOut('mount', 'S', true), true);
    assert.equal(X.partKnockedOut('mount', 'M', false), true);
  });
  test('v971: no gear, no carry-over, no Light to the vehicle, any damage knocks a part out', (t) => {
    t.after(oldWay({ 'VDRIVE_V98.passengerSafety': 'v971', 'VDRIVE_V98.cpCarry': 'v971', 'VDRIVE_V98.deadlyPassenger': 'v971', 'VDRIVE_V98.calledThreshold': 'v971' }));
    assert.deepEqual(X.passengerSafety({ power: 15, level: 'S', belted: true, apps: true, cage: true, cp: 3 }), { power: 15, level: 'S', dice: 0 });
    assert.equal(X.deadlyPassengerHit('D'), false);
    assert.equal(X.partKnockedOut('tires', 'L'), true);
  });
});

describe('v0.98.0 review fix2 R5 / R7: the positioning record\'s keys, a card\'s dice recounted, the GM\'s unticked pursuers', () => {
  test('the pair key is sorted (either vehicle\'s chase turn is the same); each vehicle has its own key', () => {
    assert.equal(X.posKey(3, 'B', 'A'), X.posKey(3, 'A', 'B'));
    assert.notEqual(X.posKey(3, 'A', 'B'), X.posKey(4, 'A', 'B'));
    assert.notEqual(X.posVehKey(3, 'A'), X.posVehKey(3, 'B'));
    assert.notEqual(X.posVehKey(3, 'A'), X.posKey(3, 'A', 'B'));
  });
  test('replayFaces: the dice against the TN; a wrong count, a leftover die or an impossible face is refused', () => {
    assert.equal(X.replayFaces([[5], [6, 2], [1], [4], [3]], 5, 4), 3);
    assert.equal(X.replayFaces([[5], [6, 2], [1], [4], [3]], 5, 9), 0);
    assert.equal(X.replayFaces([[6, 6, 1]], 1, 13), 1);
    assert.equal(X.replayFaces([[2]], 1, 0), 1, 'a TN below the minimum counts as the minimum');
    assert.equal(X.replayFaces([[5], [5]], 3, 4), null, 'missing a die');
    assert.equal(X.replayFaces([[5], [5], [5]], 2, 4), null, 'a leftover die');
    assert.equal(X.replayFaces([[5, 3]], 1, 4), null, 'only a 6 rolls again');
    assert.equal(X.replayFaces([[7]], 1, 4), null);
    assert.equal(X.replayFaces([[]], 1, 4), null);
    assert.equal(X.replayFaces('x', 0, 4), null);
    assert.equal(X.replayFaces([], 0, 4), 0);
  });
  test('the unticked pursuers stay on the record for the combat, a new combat starts with none', () => {
    const st = X.chaseState({ combatId: 'c1', round: 1, off: ['A', '', 7] });
    assert.deepEqual(st.off, ['A']);
    assert.deepEqual(X.withScores(st, { combatId: 'c1', round: 2, scores: [] }).off, ['A']);
    assert.deepEqual(X.withScores(st, { combatId: 'c1', round: 2, scores: [], off: ['B'] }).off, ['B']);
    assert.deepEqual(X.withScores(st, { combatId: 'c2', round: 1, scores: [] }).off, []);
  });
  test('R6: the bound on a vehicle\'s Speed is the books\' largest (the Federated-Boeing Eagle\'s 1800)', () => {
    assert.equal(CHASE98.speedMax, 1800);
  });
});
