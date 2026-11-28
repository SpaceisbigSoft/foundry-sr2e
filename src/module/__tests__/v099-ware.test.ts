/**
 * v0.99.0 rules completeness, cyberware and bioware effects (RULES.WARE_V99): the pure rules (rules/ware99.ts), and for
 * each switch that its other value ('v980') gives the v0.98.0 result.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/config.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as X from '../rules/ware99.ts';
import { HOUSE_WARE_V99 } from '../rules/config99/ware.ts';
import { WARE_V980_WAY } from '../rules/__tests__/ware980.ts';

/** English from public/lang/en.json, with this area's draft while it isn't merged. */
function english(): Record<string, string> {
  const flat: Record<string, string> = {};
  const walk = (o: unknown, p: string): void => { if (typeof o === 'string') { flat[p] = o; return; } if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k); };
  walk(JSON.parse(readFileSync(join('public', 'lang', 'en.json'), 'utf8')), '');
  const draft = join('i18n-drafts', 'ware99.json');
  if (existsSync(draft)) Object.assign(flat, JSON.parse(readFileSync(draft, 'utf8')));
  return flat;
}
(globalThis as any).__SR2E_EN__ = { ...((globalThis as any).__SR2E_EN__ ?? {}), ...english() };

const cw = (id: string, name: string, system: Record<string, any> = {}) => ({ id, type: 'cyberware', name, system: { installed: true, bioware: false, kind: 'other', ...system } });
const ortho = (rating: number, more: Record<string, any> = {}) => cw('os', `Orthoskin ${rating}`, { bioware: true, bioKind: 'orthoskin', rating, ...more });
const plating = (rating: number, more: Record<string, any> = {}) => cw('dp', `Dermal plating ${rating}`, { rating, ...more });
const arm = (strength: number, quickness: number, name = 'Cyberarm', location = 'rightArm') => cw('arm', name, { kind: 'cyberlimb', essenceCost: 1, limb: { location, strength, quickness, capacity: 1 } });

describe('v0.99.0 cyberware and bioware: the switches', () => {
  test('every switch has a house-rules row, the book first and the default', () => {
    const v: any = RULES.WARE_V99;
    for (const r of HOUSE_WARE_V99) {
      const key = r.path.split('.')[1]!;
      assert.ok(key in v, r.path);
      if (r.type === 'select') assert.equal(v[key], r.choices![0], `${r.path} defaults to its first choice`);
    }
    for (const k of Object.keys(v)) assert.ok(HOUSE_WARE_V99.some((r) => r.path === `WARE_V99.${k}`), k);
    assert.equal(Object.keys(WARE_V980_WAY).length, 6);
    assert.deepEqual([v.limbStrength, v.limbStrengthTroll, v.limbFreePoints, v.limbStrengthEssence, v.limbQuicknessEssence, v.bioRecoveryFactor, v.bioRecoveryCultured], [3, 8, 3, 0.4, 0.3, 3, 2]);
  });
  test('every house-rules row and every key the code uses has English', () => {
    const en = english();
    for (const r of HOUSE_WARE_V99) assert.ok(en[`SR2E.HouseRules.Rule.${r.path.replace('.', '__')}`], r.path);
    const src = ['src/module/rules/ware99.ts', 'src/module/applications/ware99.ts', 'src/module/applications/sheets.ts', 'src/module/documents/index.ts', 'src/module/models/index.ts']
      .map((f) => readFileSync(join(...f.split('/')), 'utf8')).join('\n');
    const keys = new Set([...src.matchAll(/SR2E\.Ware99\.[A-Za-z0-9_.]+[A-Za-z0-9]/g)].map((m) => m[0]));
    for (const k of ['boostedWired', 'boostedVcr', 'orthoPlating']) { keys.add(`SR2E.Ware99.Refuse.${k}`); keys.add(`SR2E.Ware99.Note.${k}`); }
    for (const k of ['limbStrengthCap', 'limbQuicknessCap']) keys.add(`SR2E.Ware99.Note.${k}`);
    for (const dyn of ['SR2E.Ware99.Refuse', 'SR2E.Ware99.Note']) keys.delete(dyn);
    for (const k of keys) assert.ok(en[k], k);
    const draftPath = join('i18n-drafts', 'ware99.json');
    const draft = existsSync(draftPath) ? JSON.parse(readFileSync(draftPath, 'utf8')) : {};
    for (const k of Object.keys(draft)) assert.ok(k.startsWith('SR2E.Ware99.') || k.startsWith('SR2E.HouseRules.Rule.WARE_V99__'), k);
  });
});

describe('v0.99.0 boosted reflexes, wired reflexes and a control rig (SSC p. 87)', () => {
  const boosted = cw('br', 'Boosted reflexes 2', { reaction: 1, initiativeDice: 1 });
  const wired = cw('wr', 'Wired reflexes 1', { reaction: 2, initiativeDice: 1 });
  const vcr = cw('vcr', 'Vehicle control rig 1', { controlRig: 1 });
  test('what an item is: by its reflexes field, its control rig level or its name', () => {
    assert.equal(X.wareClass(boosted), 'boosted');
    assert.equal(X.wareClass(cw('x', 'Speedware', { reflexes: 'wired' })), 'wired');
    assert.equal(X.wareClass(vcr), 'vcr');
    assert.equal(X.wareClass(cw('x', 'VCR (level 2)')), 'vcr');
    assert.equal(X.wareClass(ortho(1)), 'orthoskin');
    assert.equal(X.wareClass(plating(2)), 'plating');
    assert.equal(X.wareClass(cw('x', 'Datajack')), '');
    assert.equal(X.wareClass({ type: 'gear', name: 'Wired reflexes', system: {} }), '');
  });
  test('installing one beside the other is refused, either way round; an uninstalled other is fine', () => {
    assert.deepEqual(X.installClash(wired, [boosted]), { why: 'SR2E.Ware99.Refuse.boostedWired', other: 'Boosted reflexes 2' });
    assert.deepEqual(X.installClash(boosted, [vcr]), { why: 'SR2E.Ware99.Refuse.boostedVcr', other: 'Vehicle control rig 1' });
    assert.equal(X.installClash(vcr, [{ ...boosted, system: { ...boosted.system, installed: false } }]), null);
    assert.equal(X.installClash(wired, [vcr]), null, 'wired reflexes and a control rig go together');
    assert.equal(X.installClash(boosted, [boosted]), null, 'not against itself');
  });
  test('a character who has both: a note per pair', () => {
    const notes = X.pairNotes([boosted, wired, vcr]);
    assert.deepEqual(notes.map((n) => n.key), ['SR2E.Ware99.Note.boostedWired', 'SR2E.Ware99.Note.boostedVcr']);
    assert.equal(X.wareNotes([boosted, wired]).length, 1);
    assert.match(X.wareNotes([boosted, wired])[0]!, /Boosted reflexes 2.*Wired reflexes 1.*only the better/);
  });
  test('v980: no refusal, no note', (t) => {
    t.after(oldWay(WARE_V980_WAY));
    assert.equal(X.installClash(wired, [boosted]), null);
    assert.deepEqual(X.pairNotes([boosted, wired, vcr]), []);
  });
});

describe('v0.99.0 orthoskin and dermal plating (Shadowtech p. 17)', () => {
  test('refused together', () => {
    assert.deepEqual(X.installClash(ortho(2), [plating(1)]), { why: 'SR2E.Ware99.Refuse.orthoPlating', other: 'Dermal plating 1' });
    assert.deepEqual(X.installClash(plating(1), [ortho(2)]), { why: 'SR2E.Ware99.Refuse.orthoPlating', other: 'Orthoskin 2' });
  });
  test('both in: the better counts (plating 2 × rating against orthoskin impact + ballistic; the plating wins a tie)', () => {
    assert.equal(X.orthoskinArmor(ortho(1)), 1);
    assert.equal(X.orthoskinArmor(ortho(2)), 2);
    assert.equal(X.orthoskinArmor(ortho(3)), 3);
    const tie = X.orthoPlating([ortho(2), plating(1)])!;
    assert.deepEqual([...tie.drop], ['os']);
    assert.equal(tie.better, 'Dermal plating 1');
    const ow = X.orthoPlating([ortho(3), plating(1)])!;
    assert.deepEqual([...ow.drop], ['dp']);
    assert.equal(X.droppedBy(ow, plating(1)), true);
    assert.equal(X.droppedBy(ow, ortho(3)), false);
    assert.match(X.wareNotes([ortho(3), plating(1)])[0]!, /only Orthoskin 3 counts, Dermal plating 1 gives nothing/);
  });
  test('damaged, healing in or one alone: nothing to decide', () => {
    assert.equal(X.orthoPlating([ortho(3)]), null);
    assert.equal(X.orthoPlating([ortho(3, { damaged: true }), plating(1)]), null);
    assert.equal(X.orthoPlating([ortho(3), plating(1)], new Set(['os'])), null);
  });
  test('plating as armor (GEAR_V923.dermal armor) keeps the old conflict rule; v980: both count', (t) => {
    const undo = oldWay({ 'GEAR_V923.dermal': 'armor' });
    assert.equal(X.orthoPlating([ortho(3), plating(1)]), null);
    undo();
    t.after(oldWay(WARE_V980_WAY));
    assert.equal(X.orthoPlating([ortho(3), plating(1)]), null);
    assert.equal(X.installClash(ortho(2), [plating(1)]), null);
  });
});

describe('v0.99.0 cyberlimbs (Cybertechnology pp. 49–51)', () => {
  test('built-in Strength 3 (troll 8) and Quickness 3: a weaker field reads as the base', () => {
    assert.deepEqual(X.limbStats(arm(2, 1), 'human'), { strength: 3, quickness: 3, essence: 0 });
    assert.deepEqual(X.limbStats(arm(4, 4), 'troll'), { strength: 8, quickness: 4, essence: 0 });
    assert.deepEqual(X.limbBase('elf'), { strength: 3, quickness: 3 });
  });
  test('enhancement past 3 points costs .4 Essence a point of Strength, .3 of Quickness; a troll\'s Strength past 8 at once', () => {
    assert.equal(X.limbStats(arm(6, 6), 'human').essence, 0);
    assert.equal(X.limbStats(arm(7, 6), 'human').essence, 0.4);
    assert.equal(X.limbStats(arm(8, 8), 'human').essence, 1.4, '2 × .4 + 2 × .3');
    assert.equal(X.limbStats(arm(10, 3), 'troll').essence, 0.8);
    assert.equal(X.limbEssenceCost(1, arm(8, 8), 'human'), 2.4);
    assert.equal(X.limbEssenceCost(0.5, cw('dj', 'Datajack', { essenceCost: 0.5 }), 'human'), 0.5);
  });
  test('partial limbs (hands, feet, forearms) never cost Essence for enhancement (p. 51)', () => {
    assert.equal(X.limbStats(arm(9, 3, 'Cyberhand', 'rightArm'), 'human').essence, 0);
    assert.equal(X.isPartialLimb('Cyber forearm'), true);
    assert.equal(X.isPartialLimb('Cyberarm'), false);
  });
  test('the four limbs\' average (natural limbs at the character\'s rating) and leading with a stronger limb (p. 50)', () => {
    const limbs = [{ name: 'Left arm', location: 'leftArm', strength: 5 }, { name: 'Right leg', location: 'rightLeg', strength: 7 }];
    // The book's example: arms 3 and 5, legs 4 and 7 → average 4; leading with the 5 arm: +1.
    assert.equal(X.fourLimbAverage([...limbs, { name: 'Arm', location: 'rightArm', strength: 3 }, { name: 'Leg', location: 'leftLeg', strength: 4 }], 0, 'strength'), 4);
    assert.equal(X.fourLimbAverage(limbs, 3, 'strength'), 4, '5 + 7 + 3 + 3 = 18 → 4');
    assert.equal(X.limbLeadTn(5, 4), 1);
    assert.equal(X.limbLeadTn(3, 4), 0, 'a weaker limb adds nothing');
    assert.equal(X.fourLimbAverage([{ name: 'Cyberhand', location: 'rightArm', strength: 9 }], 3, 'strength'), 3, 'a hand is not a limb here');
  });
  test('the average caps: Strength twice Body or Body + 4, Quickness twice Quickness or + 4', () => {
    const limbs = [{ name: 'L', location: 'leftArm', strength: 12, quickness: 3 }, { name: 'R', location: 'rightArm', strength: 12, quickness: 3 }];
    const notes = X.limbCapNotes(limbs, { strength: 4, quickness: 3, body: 3, naturalQuickness: 3 });
    assert.deepEqual(notes, [{ key: 'SR2E.Ware99.Note.limbStrengthCap', average: 8, cap: 6 }]);
    assert.match(X.limbCapText(limbs, { strength: 4, quickness: 3, body: 3, naturalQuickness: 3 })[0]!, /average Strength 8 is over the cap of 6/);
    assert.deepEqual(X.limbCapNotes(limbs, { strength: 4, quickness: 3, body: 9, naturalQuickness: 3 }), []);
    assert.deepEqual(X.limbCapNotes([], { strength: 9, quickness: 9, body: 1, naturalQuickness: 1 }), [], 'no cyberlimb, no cap');
  });
  test('v980: the fields as entered, no Essence, no cap, no lead TN', (t) => {
    t.after(oldWay(WARE_V980_WAY));
    assert.deepEqual(X.limbStats(arm(2, 1), 'troll'), { strength: 2, quickness: 1, essence: 0 });
    assert.equal(X.limbEssenceCost(1, arm(8, 8), 'human'), 1);
    assert.equal(X.limbLeadTn(5, 4), 0);
    assert.deepEqual(X.limbCapNotes([{ name: 'L', location: 'leftArm', strength: 12 }], { strength: 4, quickness: 3, body: 3, naturalQuickness: 3 }), []);
  });
});

describe('v0.99.0 bioware recovery (Shadowtech p. 6) and the trauma damper on Stun (Shadowtech p. 29)', () => {
  test('bioware × 3, cultured × 2, neural (always cultured) × 2; cyberware and complications as before', () => {
    assert.equal(X.bioRecoveryDays(4, { bioware: true, bioKind: 'orthoskin' }), 12);
    assert.equal(X.bioRecoveryDays(4, { bioware: true, cultured: true, bioKind: 'orthoskin' }), 8);
    assert.equal(X.bioRecoveryDays(4, { bioware: true, bioKind: 'cerebralBooster' }), 8);
    assert.equal(X.bioRecoveryDays(4, { bioware: false }), 4);
    assert.equal(X.bioRecoveryDays(null, { bioware: true }), null);
  });
  test('the damper: one box whatever its rating; none with a pain editor or a compensator that still copes', () => {
    const after = { physical: 0, stun: 4 };
    assert.equal(X.damperStunCut(3, { damper: true, painEditor: false, after }), 1);
    assert.equal(X.damperStunCut(1, { damper: true, painEditor: true, after }), 0);
    assert.equal(X.damperStunCut(1, { damper: true, painEditor: false, compensatorBoxes: 4, after }), 0);
    assert.equal(X.damperStunCut(1, { damper: true, painEditor: false, compensatorBoxes: 4, after: { physical: 5, stun: 6 } }), 1);
    assert.equal(X.damperStunCut(1, { damper: false, painEditor: false, after }), 0);
  });
  test('v980: the same recovery as cyberware; the rating-scaled boxes', (t) => {
    t.after(oldWay(WARE_V980_WAY));
    assert.equal(X.bioRecoveryDays(4, { bioware: true }), 4);
    assert.equal(X.damperStunCut(3, { damper: true, painEditor: true, after: { physical: 0, stun: 4 } }), 3);
  });
});
