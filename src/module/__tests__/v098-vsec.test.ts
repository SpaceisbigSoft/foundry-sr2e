/**
 * v0.98.0 rules completeness, building security and vehicle upkeep (RULES.VSEC_V98): the pure rules (rules/vsec98.ts)
 * and the hooks into rules/netrig.ts (modificationEffect) and rules/remnants.ts (modInstallPlan), and for each switch
 * that its other value ('v971') gives the v0.97.1 result.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/config.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as X from '../rules/vsec98.ts';
import { HOUSE_VSEC_V98, VSEC_CHASSIS_98 } from '../rules/config98/vsec.ts';
import { VSEC_V971_WAY } from '../rules/__tests__/vsec971.ts';
import { modificationEffect } from '../rules/netrig.ts';
import { modInstallPlan } from '../rules/remnants.ts';

/** English from public/lang/en.json, with this area's draft while it isn't merged. */
function english(): Record<string, string> {
  const flat: Record<string, string> = {};
  const walk = (o: unknown, p: string): void => { if (typeof o === 'string') { flat[p] = o; return; } if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k); };
  walk(JSON.parse(readFileSync(join('public', 'lang', 'en.json'), 'utf8')), '');
  const draft = join('i18n-drafts', 'vsec98.json');
  if (existsSync(draft)) Object.assign(flat, JSON.parse(readFileSync(draft, 'utf8')));
  return flat;
}
(globalThis as any).__SR2E_EN__ = { ...((globalThis as any).__SR2E_EN__ ?? {}), ...english() };

describe('v0.98.0 security and vehicle upkeep: the switches', () => {
  test('every switch has a house-rules row, the book first and the default', () => {
    const v: any = RULES.VSEC_V98;
    for (const r of HOUSE_VSEC_V98) {
      const key = r.path.split('.')[1]!;
      assert.ok(key in v, r.path);
      if (r.type === 'select') assert.equal(v[key], r.choices![0], `${r.path} defaults to its first choice`);
    }
    for (const k of Object.keys(v)) assert.ok(HOUSE_VSEC_V98.some((r) => r.path === `VSEC_V98.${k}`), k);
    assert.equal(Object.keys(VSEC_V971_WAY).length, Object.keys(v).length - 2);
    assert.equal(v.repairPartsPercent, 5);
  });
  test('every house-rules row, tool and key the code uses has English', () => {
    const en = english();
    for (const r of HOUSE_VSEC_V98) assert.ok(en[`SR2E.HouseRules.Rule.${r.path.replace('.', '__')}`], r.path);
    assert.ok(en['SR2E.Tools.vsec98.label'] && en['SR2E.Tools.vsec98.hint']);
    const src = ['src/module/rules/vsec98.ts', 'src/module/applications/vsec98.ts', 'src/module/documents/index.ts', 'src/module/applications/sheets.ts']
      .map((f) => readFileSync(join(...f.split('/')), 'utf8')).join('\n');
    const keys = new Set([...src.matchAll(/SR2E\.VSec98\.[A-Za-z0-9_.]+[A-Za-z0-9]/g)].map((m) => m[0]));
    for (const dyn of ['Why', 'Chassis', 'Level', 'Trigger', 'Step', 'Vigilance', 'Special', 'Attr', 'Tool']) keys.delete(`SR2E.VSec98.${dyn}`);
    for (const c of VSEC_CHASSIS_98) keys.add(`SR2E.VSec98.Chassis.${c.id}`);
    for (const k of X.LEVEL_KEYS) keys.add(`SR2E.VSec98.Level.${k}`);
    for (const k of X.PERCEPTION_TRIGGERS) keys.add(`SR2E.VSec98.Trigger.${k}`);
    for (const k of X.ACCESS_STEPS) keys.add(`SR2E.VSec98.Step.${k}`);
    for (const k of Object.keys(X.VIGILANCE)) keys.add(`SR2E.VSec98.Vigilance.${k}`);
    for (const k of Object.keys(X.SPECIAL_98)) keys.add(`SR2E.VSec98.Special.${k}`);
    for (const k of ['body', 'willpower']) keys.add(`SR2E.VSec98.Attr.${k}`);
    for (const k of ['site', 'perception', 'access', 'combat', 'design']) keys.add(`SR2E.VSec98.Tool.${k}`);
    for (const k of ['off', 'trigger', 'step', 'overMax']) keys.add(`SR2E.VSec98.Why.${k}`);
    for (const k of keys) assert.ok(en[k], k);
  });
  test('the vibration sense is a device choice', () => {
    assert.ok(RULES.SECURITY.senses.includes('vibration'));
  });
});

describe('CCSS limits and the rigger\'s pools (CSH p. 102; Rigger 2 pp. 77–78)', () => {
  test('Intelligence devices, RC deck rating drones', () => {
    assert.deepEqual(X.ccssLimits({ intelligence: 5, rcDeck: 3 }), { devices: 5, drones: 3 });
  });
  test('no Control Pool on detection while assuming the body', () => {
    assert.equal(X.riggerPoolOnDetection(), false);
  });
  test('v971: no limits; the pool may add', (t) => {
    t.after(oldWay({ 'VSEC_V98.ccss': 'v971', 'VSEC_V98.ccssPools': 'v971' }));
    assert.equal(X.ccssLimits({ intelligence: 5, rcDeck: 3 }), null);
    assert.equal(X.riggerPoolOnDetection(), true);
  });
});

describe('the Rigger Perception Tests Table (Rigger 2 p. 77)', () => {
  test('the table, −2 on alert, an alarm needs no test', () => {
    assert.equal(X.riggerPerceptionTn('door').tn, 5);
    assert.equal(X.riggerPerceptionTn('tamperTry').tn, 3);
    assert.equal(X.riggerPerceptionTn('tamperOk', { tamperSuccesses: 3 }).tn, 9);
    assert.equal(X.riggerPerceptionTn('destroyed').tn, 4);
    assert.equal(X.riggerPerceptionTn('deactivated').tn, 6);
    assert.equal(X.riggerPerceptionTn('deactivated', { onAlert: true }).tn, 4);
    assert.equal(X.riggerPerceptionTn('tamperTry', { onAlert: true }).tn, 2, 'never below 2');
    assert.deepEqual(X.riggerPerceptionTn('alarm'), { tn: null });
    assert.equal(X.riggerPerceptionTn('nonsense').why, 'SR2E.VSec98.Why.trigger');
    assert.equal(X.siteOnAlert('none'), false);
    assert.equal(X.siteOnAlert('passive'), true);
  });
  test('v971: no test', (t) => {
    t.after(oldWay({ 'VSEC_V98.perception': 'v971' }));
    assert.equal(X.riggerPerceptionTn('door').why, 'SR2E.VSec98.Why.off');
  });
});

describe('accessing a rigged system (Rigger 2 p. 79)', () => {
  const o = { device: 4, electronics: 5, intelligence: 6, technical: 6, vigilance: 'amber' };
  test('the dice, TN (Technical Rating) and successes (Vigilance Code)', () => {
    assert.deepEqual(X.accessTest('tap', o), { dice: 9, tn: 6, need: 3, alertOnFail: false });
    assert.deepEqual(X.accessTest('decrypt', o), { dice: 10, tn: 6, need: 3, alertOnFail: true });
    assert.equal(X.accessTest('protocols', { ...o, vigilance: 'red' }).need, 4);
    assert.equal(X.accessTest('protocols', { ...o, vigilance: 'pink' }).need, 1, 'an unknown code reads as Blue');
    assert.equal(X.accessTest('jump', o).why, 'SR2E.VSec98.Why.step');
  });
  test('a failed decryption or protocol test puts the system on alert; a failed tap does not', () => {
    assert.deepEqual(X.accessOutcome(3, { need: 3, alertOnFail: true }), { done: true, alert: '' });
    assert.deepEqual(X.accessOutcome(2, { need: 3, alertOnFail: true }), { done: false, alert: 'active' });
    assert.deepEqual(X.accessOutcome(0, { need: 1, alertOnFail: false }), { done: false, alert: '' });
  });
  test('the site record is bounded and its keys hold no dots', () => {
    const v = X.siteCcss({ technical: 99, vigilance: 'red', levels: { alarms: 9, magic: 2 }, oslMod: 20, access: { 'Actor.x': 2, 'Actor_y': 9 } });
    assert.equal(v.technical, 10);
    assert.equal(v.levels.alarms, 4);
    assert.equal(v.oslMod, 5);
    assert.deepEqual(v.access, { Actor_y: 3 });
    assert.equal(X.siteCcss(null).technical, 1);
  });
  test('v971: not built', (t) => {
    t.after(oldWay({ 'VSEC_V98.access': 'v971' }));
    assert.equal(X.accessTest('tap', o).why, 'SR2E.VSec98.Why.off');
  });
});

describe('rigger combat and decking a rigged system (Rigger 2 pp. 79–80)', () => {
  const rig = { willpower: 5, body: 4, pool: 8 };
  const sec = { willpower: 4, body: 6, pool: 6 };
  test('the opposed Willpower Test: Control Pool up to Willpower; TN the other\'s Willpower', () => {
    const t = X.combatTests(rig, sec, 9);
    assert.deepEqual(t.attacker, { dice: 10, tn: 4 });
    assert.deepEqual(t.defender, { dice: 4, tn: 5 });
  });
  test('(winner\'s Willpower)L Stun, +1 level per 2 net successes; a tie does nothing', () => {
    assert.deepEqual(X.combatOutcome(4, 1, rig, sec), { winner: 'attacker', net: 3, power: 5, level: 'M' });
    assert.deepEqual(X.combatOutcome(1, 2, rig, sec), { winner: 'defender', net: 1, power: 4, level: 'L' });
    assert.equal(X.combatOutcome(9, 0, rig, sec).level, 'D');
    assert.equal(X.combatOutcome(2, 2, rig, sec).winner, null);
  });
  test('the loser resists with Body, Control Pool up to Body', () => {
    assert.deepEqual(X.combatResistance(sec, 5), { attribute: 'body', tn: 5, poolCap: 6 });
    assert.equal(X.combatResistance({ ...sec, body: 3 }, 5).poolCap, 3);
  });
  test('a decker: +2 TN, half the emulation as Control Pool, damage as non-lethal black IC (Willpower)', () => {
    const decker = { willpower: 6, body: 3, pool: 0, decker: true, emulation: 5 };
    const t = X.combatTests(decker, sec, 9);
    assert.deepEqual(t.attacker, { dice: 9, tn: 6 }, '6 + ⌈5 ÷ 2⌉ = 3 dice; TN 4 + 2');
    assert.deepEqual(X.combatResistance(decker, 4), { attribute: 'willpower', tn: 6, poolCap: 0 });
    assert.equal(X.DECKER_INIT_98, -2);
  });
});

describe('the rigger\'s decking penalty (Rigger 2 p. 16)', () => {
  test('+1 TN and Hacking Pool − VCR level; none with two datajacks or no VCR', () => {
    assert.deepEqual(X.riggerDeckingPenalty({ vcr: 2, datajacks: 1 }), { tn: 1, pool: 2 });
    assert.deepEqual(X.riggerDeckingPenalty({ vcr: 2, datajacks: 2 }), { tn: 0, pool: 0 });
    assert.deepEqual(X.riggerDeckingPenalty({ vcr: 0, datajacks: 0 }), { tn: 0, pool: 0 });
    assert.equal(X.datajackCount(['Datajack', 'Control rig', 'Rigger datajack']), 2);
  });
  test('v971: no penalty', (t) => {
    t.after(oldWay({ 'VSEC_V98.riggerDecking': 'v971' }));
    assert.deepEqual(X.riggerDeckingPenalty({ vcr: 3, datajacks: 0 }), { tn: 0, pool: 0 });
  });
});

describe('motion and vibration sensors (CSH pp. 99–100)', () => {
  test('motion: the rating, +1 per quarter metre over 1 m', () => {
    assert.equal(X.sensorTestKind('motion'), 'motion');
    assert.deepEqual(X.sensorTest('motion', 5, 0.5), { tn: 5, move: 0, auto: false });
    assert.deepEqual(X.sensorTest('motion', 5, 1), { tn: 5, move: 0, auto: false });
    assert.deepEqual(X.sensorTest('motion', 5, 1.5), { tn: 7, move: 2, auto: false });
    assert.deepEqual(X.sensorTest('motion', 5, 1.1), { tn: 6, move: 1, auto: false });
    assert.deepEqual(X.sensorTest('motion', 5, null), { tn: 5, move: 0, auto: false });
  });
  test('vibration: half a metre the rating, 1 m +3, faster sets it off', () => {
    assert.equal(X.sensorTestKind('vibration'), 'vibration');
    assert.deepEqual(X.sensorTest('vibration', 7, 0.5), { tn: 7, move: 0, auto: false });
    assert.deepEqual(X.sensorTest('vibration', 7, 1), { tn: 10, move: 3, auto: false });
    assert.equal(X.sensorTest('vibration', 7, 2).auto, true);
    assert.equal(X.sensorPassed(1, false), true);
    assert.equal(X.sensorPassed(0, false), false);
    assert.equal(X.sensorPassed(5, true), false);
    assert.equal(X.sensorTestKind('visual'), null);
  });
  test('v971: the opposed detection test', (t) => {
    t.after(oldWay({ 'VSEC_V98.motion': 'v971' }));
    assert.equal(X.sensorTestKind('motion'), null);
  });
});

describe('the security ratings (CSH pp. 94–100)', () => {
  const levels = { barriers: 2, lighting: 2, guards: 3, animals: 1, alarms: 3, surveillance: 3, magic: 2, matrix: 2, personnel: 1 };
  test('the Overall Security Level: the levels ÷ 6 round down, 0–5', () => {
    assert.equal(X.overallSecurityLevel(levels), 3);
    assert.equal(X.overallSecurityLevel(levels, 1), 4);
    assert.equal(X.overallSecurityLevel({}, -2), 0);
    assert.equal(X.overallSecurityLevel({ barriers: 4, lighting: 4, guards: 4, animals: 4, alarms: 4, surveillance: 4, magic: 4, matrix: 4, personnel: 4 }, 5), 5);
  });
  test('device ratings by the table; biometric maglocks +2', () => {
    assert.equal(X.deviceRating98({ kind: 'camera' }, levels), 4);
    assert.equal(X.deviceRating98({ kind: 'camera' }, levels, { exterior: true, high: true }), 7);
    assert.equal(X.deviceRating98({ kind: 'maglock', lockType: 'keypad' }, levels), 6);
    assert.equal(X.deviceRating98({ kind: 'maglock', lockType: 'retina' }, levels), 8);
    assert.equal(X.deviceRating98({ kind: 'sensor' }, levels, { exterior: true }), 2);
    assert.equal(X.deviceRating98({ kind: 'sensor' }, { alarms: 1 }), null, 'none at that level');
    assert.equal(X.deviceRating98({ kind: 'gas' }, levels), null);
    assert.equal(X.ccssRating98(levels), 3);
    assert.equal(X.ccssRating98({ surveillance: 2 }), 0);
    assert.equal(X.lowerLevelRating(3, 1), 6);
    assert.equal(X.lowerLevelRating(3, 3), 3);
  });
  test('v971: not built', (t) => {
    t.after(oldWay({ 'VSEC_V98.ratings': 'v971' }));
    assert.equal(X.overallSecurityLevel(levels), null);
    assert.equal(X.deviceRating98({ kind: 'camera' }, levels), null);
  });
});

describe('repair parts (Rigger 2 p. 26)', () => {
  test('5% of the total cost (installed mods included) per box', () => {
    const sys = { cost: 20000, mods: [{ installed: true, cost: 5000 }, { installed: false, cost: 9000 }] };
    assert.equal(X.vehicleTotalCost(sys), 25000);
    assert.equal(X.repairPartsCost(1, 25000), 1250);
    assert.equal(X.repairPartsCost(4, 25000), 5000);
    assert.equal(X.repairPartsCost(0, 25000), null);
    assert.equal(X.repairPartsCost(3, 0), null);
  });
  test('v971: not shown', (t) => {
    t.after(oldWay({ 'VSEC_V98.repairParts': 'v971' }));
    assert.equal(X.repairPartsCost(4, 25000), null);
  });
});

describe('modification prices and Installation Tests (Rigger 2 pp. 120–140)', () => {
  const car = { body: 3, handling: 4, armor: 2, sensor: 1, ecm: 0, eccm: 0, ecd: 0, autonav: 1, pilot: 1, category: 'car', cost: 30000 };
  test('armour: 1,250¥ a point, TN the armour reached ÷ 3, 8 hours a point', () => {
    assert.deepEqual(X.modSpec98('armor', 4, car), { cost: 5000, tn: 2, hours: 32, skill: 'vehicle' });
    assert.equal(X.modSpec98('armor', 7, car)!.tn, 3);
  });
  test('the electronics tables price the level reached; 16 hours a level, TN 4, Electronics B/R', () => {
    assert.deepEqual(X.modSpec98('sensor', 1, car), { cost: 15000, tn: 4, hours: 32, skill: 'electronics', max: 10 });
    assert.equal(X.modSpec98('ecm', 2, car)!.cost, 75000);
    assert.equal(X.modSpec98('eccm', 1, car)!.cost, 10000);
    assert.equal(X.modSpec98('ecd', 3, car)!.cost, 200000);
    assert.equal(X.modSpec98('ecd', 9, car)!.why, 'SR2E.VSec98.Why.overMax');
    assert.deepEqual(X.modSkillNames('ecm', car), [RULES.SECURITY_V57.casingSkill]);
  });
  test('autonav and pilot: by rating, TN 8 − Handling', () => {
    assert.deepEqual(X.modSpec98('autonav', 1, car), { cost: 1000, tn: 4, hours: 32, skill: 'vehicle', max: 4 });
    assert.equal(X.modSpec98('autonav', 2, car)!.hours, 96);
    assert.deepEqual(X.modSpec98('pilot', 2, { ...car, handling: 3 }), { cost: 25000, tn: 5, hours: 64, skill: 'computer', max: 5 });
    assert.deepEqual(X.modSkillNames('pilot', car), [RULES.MATRIX.repair.skills[0]]);
  });
  test('engine TN by vehicle kind; thermal baffles by kind × Body; suspension 10% a level; remote 2,500¥ × Body', () => {
    assert.equal(X.modSpec98('engine', 2, car)!.tn, 5);
    assert.equal(X.modSpec98('engine', 2, { ...car, category: 'rotor' })!.tn, 7);
    assert.equal(X.modSpec98('engine', 2, { ...car, drone: true })!.tn, 6);
    assert.equal(X.modSpec98('engine', 2, car)!.cost, null);
    assert.equal(X.modSpec98('signature', 2, car)!.cost, 30000);
    assert.equal(X.modSpec98('signature', 1, { ...car, category: 'rotor' })!.cost, 30000);
    assert.equal(X.modSpec98('handling', 1, car)!.cost, 3000);
    assert.equal(X.modSpec98('remote', 1, car)!.cost, 7500);
    assert.equal(X.modSpec98('other', 1, car), null);
  });
  test('the hooks: modificationEffect and modInstallPlan read the book for a vehicle', () => {
    assert.equal(modificationEffect('sensor', 1, 3, car).cost, 15000);
    assert.equal(modificationEffect('sensor', 1, 3).cost, 2500, 'without a vehicle: the old table');
    assert.equal(modificationEffect('adaptation', 1, 3, car).cost, modificationEffect('adaptation', 1, 3).cost, 'the owner\'s price stays');
    assert.deepEqual(modInstallPlan(2, 'armor', car), { tn: 2, baseHours: 16 });
  });
  test('v971: the old cost × rating and TN 4 + rating', (t) => {
    t.after(oldWay({ 'VSEC_V98.modSpecs': 'v971' }));
    assert.equal(X.modSpec98('sensor', 1, car), null);
    assert.equal(modificationEffect('sensor', 1, 3, car).cost, 2500);
    assert.deepEqual(modInstallPlan(2, 'armor', car), { tn: RULES.VEHICLES.install.tn + 2 * RULES.VEHICLES.install.tnPerRating, baseHours: 2 * RULES.VEHICLES.install.hoursPerRating });
    assert.deepEqual(X.modSkillNames('ecm', car), []);
  });
});

describe('vehicle design (Rigger 2 pp. 108–114, 170–171)', () => {
  test('the chassis table and the price: DPV × Mark-Up × 100¥, special designs multiplied in turn', () => {
    assert.equal(VSEC_CHASSIS_98.length, 61);
    const s = X.chassis98('sandBuggy')!;
    assert.deepEqual([s.h, s.ho, s.body, s.cf, s.cfMax, s.dp, s.cat], [4, 4, 3, 4, 15, 20, 'car']);
    assert.deepEqual(X.designPrice({ dpv: 154, category: 'car', specials: [{ id: 'security' }] }), { factor: 2, price: 30800 });
    assert.deepEqual(X.designPrice({ dpv: 100, category: 'fixedWing', specials: [{ id: 'military', value: 3 }, { id: 'drone' }] }), { factor: 0.75, price: 7500 });
    assert.equal(X.designPrice({ dpv: 100, category: 'bike', modifiers: 0.5 })!.factor, 1);
  });
  test('v971: no calculator', (t) => {
    t.after(oldWay({ 'VSEC_V98.design': 'v971' }));
    assert.equal(X.designPrice({ dpv: 154, category: 'car' }), null);
  });
});
