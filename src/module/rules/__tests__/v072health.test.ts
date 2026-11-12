import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { HEALTH_V72 } from '../config72/health.ts';
import {
  overdoseTest, doseDrug, drugsForBonuses, bioKindsV72, bioEffectSpecV72, bioVitals, nephriticDice, turnsWithoutAir, bioIndexV72,
  incompatibleReflexes, qualityVitals, overflowBody, painToleranceMonitor, toughnessDice, sensitiveEssence, sensitiveBodyIndex,
  sensitiveRejectionTn, heatTest, heatStoppedByFireImmunity, electricShock, type ActiveDrug,
} from '../vitals.ts';
import { stackAugmentations, type Augmentation } from '../cyberware.ts';
import { monitorStatus, woundModifier } from '../damage.ts';

/** Set a value at a dotted path in HEALTH_V72 for the length of `fn`. */
function withRule(path: string, value: unknown, fn: () => void) {
  const keys = path.split('.');
  let o: any = HEALTH_V72;
  for (const k of keys.slice(0, -1)) o = o[k];
  const last = keys.at(-1)!;
  const old = o[last];
  o[last] = value;
  try { fn(); } finally { o[last] = old; }
}

const dose = (over: Partial<ActiveDrug> = {}): ActiveDrug => ({ name: 'Jazz', attributes: { quickness: 2 }, reaction: 0, initiativeDice: 1, round: -1, worldTime: 600, crashPower: 6, crashLevel: 'M', ...over });
const drug = { power: 5, level: 'M', crashPower: 6, vector: 'inhalation' };

describe('v0.72.0 O8: drug doses refresh instead of stacking, and overlap is an overdose', () => {
  test('a first dose is a new entry with no overdose', () => {
    const r = doseDrug([], dose(), { seconds: 600, now: 0, round: null, drug });
    assert.equal(r.mode, 'new');
    assert.equal(r.list.length, 1);
    assert.equal(r.list[0]!.doses, 1);
    assert.equal(r.overdose, null);
  });
  test('refresh: one entry, the later end, doses counted, an overdose to resist', () => {
    const first = doseDrug([], dose(), { seconds: 600, now: 0, round: null, drug }).list;
    const r = doseDrug(first, dose({ worldTime: 900 }), { seconds: 600, now: 300, round: null, drug });
    assert.equal(r.mode, 'refresh');
    assert.equal(r.list.length, 1);
    assert.equal(r.list[0]!.worldTime, 900);
    assert.equal(r.list[0]!.doses, 2);
    assert.ok(r.overdose);
    assert.equal(r.overdose!.power, 6); // drug Power 5 + 1 per dose already active
    assert.equal(r.overdose!.level, 'M');
    assert.equal(r.overdose!.vector, 'inhalation');
    // A third dose: Power climbs.
    const r3 = doseDrug(r.list, dose({ worldTime: 1000 }), { seconds: 600, now: 400, round: null, drug });
    assert.equal(r3.list[0]!.doses, 3);
    assert.equal(r3.overdose!.power, 7);
  });
  test('extend: a full duration more on top of what is left (world time and Combat Turns)', () => {
    withRule('drugs.doses', 'extend', () => {
      const r = doseDrug([dose({ worldTime: 600, round: 5 })], dose({ worldTime: 900, round: 7 }), { seconds: 30, now: 300, round: 3, drug });
      assert.equal(r.mode, 'extend');
      assert.equal(r.list[0]!.worldTime, 630);
      assert.equal(r.list[0]!.round, 5 + 10);
    });
  });
  test('stack (the old way): another entry whose bonuses all count', () => {
    withRule('drugs.doses', 'stack', () => {
      const r = doseDrug([dose()], dose(), { seconds: 600, now: 0, round: null, drug });
      assert.equal(r.mode, 'stack');
      assert.equal(r.list.length, 2);
      assert.equal(drugsForBonuses(r.list).length, 2);
      withRule('drugs.overdose.enabled', false, () => {
        assert.equal(doseDrug([dose()], dose(), { seconds: 600, now: 0, round: null, drug }).overdose, null);
      });
    });
  });
  test('drugsForBonuses: entries doubled up before v0.72.0 count once', () => {
    const list = [dose({ attributes: { quickness: 2 } }), dose({ name: 'Cram' }), dose({ attributes: { quickness: 1 } })];
    const kept = drugsForBonuses(list);
    assert.equal(kept.length, 2);
    assert.deepEqual(kept.map((d) => d.name), ['Cram', 'Jazz']);
    assert.equal(kept[1]!.attributes!.quickness, 1);
  });
  test('overdoseTest: Power source, level, staging and the switch', () => {
    assert.equal(overdoseTest({ name: 'X', power: 0 }, 1)!.power, HEALTH_V72.drugs.overdose.basePower + 1);
    withRule('drugs.overdose.powerFrom', 'crash', () => assert.equal(overdoseTest({ name: 'X', power: 4, crashPower: 8 }, 1)!.power, 9));
    withRule('drugs.overdose.level', 'S', () => assert.equal(overdoseTest({ name: 'X', power: 4, level: 'L' }, 1)!.level, 'S'));
    withRule('drugs.overdose.stageUpEvery', 1, () => assert.equal(overdoseTest({ name: 'X', power: 4, level: 'L' }, 2)!.level, 'S'));
    assert.equal(overdoseTest({ name: 'X', power: 4 }, 0), null);
    withRule('drugs.overdose.enabled', false, () => assert.equal(overdoseTest({ name: 'X', power: 4 }, 2), null));
  });
});

describe('v0.72.0 O9: symbiotes, nephritic screen, extended volume, suprathyroid', () => {
  test('the kinds are always offered; the effects follow the switch', () => {
    assert.deepEqual(bioKindsV72(), ['symbiotes', 'nephriticScreen', 'extendedVolume', 'suprathyroid']);
    assert.deepEqual(bioEffectSpecV72('suprathyroid')!.attributes, { body: 1, quickness: 1, strength: 1 });
    assert.equal(bioEffectSpecV72('muscleAugmentation'), undefined);
    withRule('bioware.enabled', false, () => assert.equal(bioEffectSpecV72('suprathyroid'), undefined));
  });
  test('bioVitals: healing dice, blood-borne toxin dice, held breath', (t) => {
    t.after(oldWay({"BOOK_V78.symbiotes.mode": "dice"})); // v0.78.0: the old rule (a house rule)
    const v = bioVitals([
      { bioKind: 'symbiotes', rating: 2, installed: true },
      { bioKind: 'nephriticScreen', rating: 1, installed: true },
      { bioKind: 'extendedVolume', rating: 3, installed: true },
      { bioKind: 'symbiotes', rating: 3, installed: false },
      { bioKind: 'extendedVolume', rating: 1, installed: true, damaged: true },
    ]);
    assert.equal(v.healingDice, 2);
    assert.equal(v.bloodToxinDice, 1);
    assert.equal(v.breathTurns, 45); // v0.77.0: 15 turns per level
    assert.equal(nephriticDice(v, 'injection'), 1);
    assert.equal(nephriticDice(v, 'ingestion'), 1);
    assert.equal(nephriticDice(v, 'inhalation'), 0);
    assert.equal(turnsWithoutAir(50, v.breathTurns), 5);
    assert.equal(turnsWithoutAir(10, v.breathTurns), 0);
    // Ratings are capped; rating 0 does nothing, like every other bioware effect (v0.72.0 review fix).
    assert.equal(bioVitals([{ bioKind: 'symbiotes', rating: 9, installed: true }]).healingDice, 3);
    assert.equal(bioVitals([{ bioKind: 'symbiotes', rating: 0, installed: true }]).healingDice, 0);
    assert.equal(bioVitals([{ bioKind: 'suprathyroid', rating: 1, installed: true }]).lifestyleMultiplier, 1.2);
    withRule('bioware.enabled', false, () => assert.equal(bioVitals([{ bioKind: 'symbiotes', rating: 2, installed: true }]).healingDice, 0));
  });
  test('bioIndexV72 by rating', () => {
    assert.equal(bioIndexV72('symbiotes', 2), 0.7);
    assert.equal(bioIndexV72('symbiotes', 5), 1);
    assert.equal(bioIndexV72('extendedVolume', 3), 0.6);
    assert.equal(bioIndexV72('nephriticScreen', 1), 0.4);
    assert.equal(bioIndexV72('orthoskin', 1), null);
  });
});

describe('v0.72.0 O10: reaction enhancers don\'t work with boosted reflexes', () => {
  const aug = (name: string, reflexes: string, reaction: number, initiativeDice: number): Augmentation => ({ essenceCost: 1, grade: 'standard', installed: true, name, reflexes, reaction, initiativeDice });
  test('boosted + enhancer: the enhancer gives nothing', () => {
    const s = stackAugmentations([aug('Boosted Reflexes 2', 'boosted', 2, 2), aug('Reaction Enhancer 3', 'enhancer', 3, 0)], []);
    const r = incompatibleReflexes(s.cyber);
    assert.equal(r.cyber[1]!.reaction, 0);
    assert.equal(r.cyber[0]!.reaction, 2);
    assert.match(r.notes[0]!, /Reaction Enhancer 3 does not work with Boosted Reflexes 2/);
  });
  test('wired + enhancer still stack; an enhancer named but untyped is recognised', () => {
    const r = incompatibleReflexes([aug('Wired Reflexes 1', 'wired', 2, 1), aug('Reaction Enhancer 2', '', 2, 0)]);
    assert.equal(r.cyber[1]!.reaction, 2);
    const b = incompatibleReflexes([aug('Boosted Reflexes 1', '', 1, 1), aug('Reaction Enhancer 2', '', 2, 0)]);
    assert.equal(b.cyber[1]!.reaction, 0);
  });
  test('boosted reflexes stripped by stacking (wired is better) don\'t block the enhancer', () => {
    const s = stackAugmentations([aug('Wired Reflexes 2', 'wired', 4, 2), aug('Boosted Reflexes 1', 'boosted', 1, 1), aug('Reaction Enhancer 1', 'enhancer', 1, 0)], []);
    const r = incompatibleReflexes(s.cyber);
    assert.equal(r.cyber[2]!.reaction, 1);
  });
  test('no pairs: the old way', () => {
    withRule('reflexes.incompatible', [], () => {
      const r = incompatibleReflexes([aug('Boosted Reflexes 2', 'boosted', 2, 2), aug('Reaction Enhancer 3', 'enhancer', 3, 0)]);
      assert.equal(r.cyber[1]!.reaction, 3);
      assert.deepEqual(r.notes, []);
    });
  });
});

describe('v0.72.0 O11: Companion health edges and flaws', () => {
  const list = [
    { name: 'Will to Live', kind: 'edge', points: 2 },
    { name: 'High Pain Tolerance', kind: 'edge', points: 1 },
    { name: 'Toughness', kind: 'edge', points: 3 },
  ];
  test('Will to Live adds Overflow boxes (and the death check uses them)', () => {
    const v = qualityVitals(list);
    assert.equal(v.overflowBoxes, 2);
    const body = overflowBody(4, v);
    assert.equal(body, 6);
    // Physical 10 + 5 overflow: dead with Body 4, still dying with Will to Live 2.
    assert.equal(monitorStatus({ physical: 15, stun: 0 }, 4), 'dead');
    assert.equal(monitorStatus({ physical: 15, stun: 0 }, body), 'dying');
    // Levels are capped.
    assert.equal(qualityVitals([{ name: 'will to live', points: 9 }]).overflowBoxes, 3);
    assert.equal(qualityVitals([{ name: 'Will to Live', points: 0 }]).overflowBoxes, 1);
  });
  test('Pain Tolerance: High ignores boxes, Low counts extra boxes', () => {
    const hi = qualityVitals(list);
    assert.deepEqual(painToleranceMonitor({ physical: 3, stun: 1 }, hi), { physical: 2, stun: 0 });
    const lo = qualityVitals([{ name: 'Low Pain Tolerance', kind: 'flaw', points: 3 }]);
    assert.equal(lo.painIgnoreBoxes, 0);
    assert.equal(lo.painExtraBoxes, 1);
    assert.deepEqual(painToleranceMonitor({ physical: 2, stun: 0 }, lo), { physical: 3, stun: 0 });
    assert.ok(woundModifier(painToleranceMonitor({ physical: 2, stun: 0 }, lo)) >= woundModifier({ physical: 2, stun: 0 }));
  });
  test('Toughness: dice on damage resistance (Stun by switch, toxins off by default)', () => {
    const v = qualityVitals(list);
    assert.equal(toughnessDice(v, 'physical'), 1);
    assert.equal(toughnessDice(v, 'stun'), 1);
    assert.equal(toughnessDice(v, 'toxin'), 0);
    withRule('qualities.toughness.onStun', false, () => assert.equal(toughnessDice(qualityVitals(list), 'stun'), 0));
  });
  test('Sensitive System: cyberware Essence doubled, rejection tests even under the limit', (t) => {
    // v0.92.3 (Companion): Body Index doubled too, and no rejection rule of its own.
    const b = qualityVitals([{ name: 'Sensitive System', kind: 'flaw', points: 2 }]);
    assert.equal(sensitiveBodyIndex(0.4, b), 0.8);
    assert.equal(sensitiveRejectionTn(null, 0.5, b), null);
    // the old way
    t.after(oldWay({ 'HEALTH_V72.qualities.sensitiveSystem.bodyIndexMultiplier': 1, 'HEALTH_V72.qualities.sensitiveSystem.rejectionAlways': true }));
    const v = qualityVitals([{ name: 'Sensitive System', kind: 'flaw', points: 2 }]);
    assert.ok(v.sensitive);
    assert.equal(sensitiveEssence(0.3, v), 0.6);
    assert.equal(sensitiveBodyIndex(0.4, v), 0.4);
    assert.equal(sensitiveRejectionTn(null, 0.5, v), RULES.BIOWARE.rejection.tn);
    assert.equal(sensitiveRejectionTn(7, 2, v), 7);
    assert.equal(sensitiveRejectionTn(null, 0, v), null);
    assert.equal(sensitiveRejectionTn(null, 0.5, qualityVitals([])), null);
  });
  test('switches: off, or the edges and flaws rule off', () => {
    assert.equal(qualityVitals(list, false).overflowBoxes, 0);
    withRule('qualities.needsQualitiesOn', false, () => assert.equal(qualityVitals(list, false).overflowBoxes, 2));
    withRule('qualities.enabled', false, () => {
      const v = qualityVitals(list);
      assert.equal(v.overflowBoxes + v.painIgnoreBoxes + v.toughnessDice, 0);
      assert.equal(v.essenceMultiplier, 1);
    });
  });
});

describe('v0.72.0 O12: heat and electricity hazards', () => {
  test('heat works like cold', () => {
    const h = heatTest('searing')!;
    assert.deepEqual([h.tn, h.level, h.type, h.attribute], [6, 'L', 'stun', 'body']);
    assert.equal(heatTest('nonsense')!.tn, 2);
    assert.ok(heatStoppedByFireImmunity());
    withRule('hazards.heat.enabled', false, () => assert.equal(heatTest('hot'), null));
  });
  test('electricity: Power by source, half impact armor plus insulation, the shock test follows', () => {
    const e = electricShock('fence', { impact: 5, ballistic: 9 })!;
    assert.deepEqual([e.power, e.level, e.type, e.armor, e.shock], [8, 'S', 'stun', 2, true]);
    assert.equal(electricShock('fence', { impact: 5, ballistic: 9 }, { insulation: 3 })!.armor, 5);
    const c = electricShock('', { impact: 0, ballistic: 0 }, { custom: { power: 9, level: 'D', type: 'physical' } })!;
    assert.deepEqual([c.power, c.level, c.type], [9, 'D', 'physical']);
    withRule('hazards.electricity.enabled', false, () => assert.equal(electricShock('fence', { impact: 5, ballistic: 0 }), null));
  });
});
