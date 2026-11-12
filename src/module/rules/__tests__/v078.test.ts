/**
 * v0.78.0: the book check's rules changes (docs/VERIFY.md, "Book check", "Next") and the owner's decisions, the pure
 * rules side. Each switch in RULES.BOOK_V78 defaults to the book's way; the old way is checked through oldWay().
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import { legworkTarget, legworkDifficulties, legworkLevelDice, legworkModifiers } from '../upkeep.ts';
import { flashTn, flashDuration, toxinPower } from '../hazards.ts';
import { blastLoss, blastPower } from '../weapons.ts';
import { poolSuccesses, whipBacklash, selfHitCheck } from '../kit.ts';
import { stimEffect, tranqOpposed } from '../tactics.ts';
import { bioEffect } from '../bioware.ts';
import { bioVitals } from '../vitals.ts';
import { naturalHealing } from '../core.ts';
import { encephalonDice, encephalonFits, encephalonIntelligence, encephalonTaskPool } from '../implants.ts';
import { sensoryEssence } from '../cyberware.ts';
import { statBlockItems, parseStatBlock } from '../statblock.ts';
import { barrierSpellEffect } from '../thaumaturgy.ts';
import { barrierSpellRating } from '../sorcery.ts';
import { invisibilityPerceptionTest, seesThrough, effectiveConcealment, fleshFormAttributes, insectRole } from '../glamour.ts';
import { focusKarmaCost } from '../spellcraft.ts';
import { powerFocusRating, sorceryFocusDice } from '../arcana.ts';
import { allergyRow, allergyTn, allergyContact, allergyWeaponPower, ALLERGY_SEVERITIES } from '../critters.ts';
import { bypassPlan, voiceOutcome } from '../roadwork.ts';
import { barrierDamage } from '../gear.ts';
import { modificationEffect, modPrerequisite } from '../netrig.ts';
import { successTest, rerollFailures } from '../dice.ts';

const T = (id: string): any => (RULES.ITEM_TEMPLATES as any[]).find((t) => t.id === id)?.system;
const scripted = (faces: number[]) => (n: number) => faces.splice(0, n);

describe('v0.78.0 legwork (BOOK_V78.legwork)', () => {
  test('the book: TNs 2–14, a closer contact adds dice, the TN modifiers', () => {
    assert.deepEqual(legworkDifficulties().map((d) => d.tn), [2, 4, 6, 8, 12, 14]);
    assert.equal(legworkTarget({ difficultyTn: 6, contactLevel: 3 }), 6);
    assert.deepEqual([1, 2, 3].map(legworkLevelDice), [0, 1, 2]);
    assert.deepEqual(legworkModifiers({ specialty: true, fixer: true, friendOfFriend: true }).map((m) => m.value), [-2, -3, 2]);
    assert.equal(legworkTarget({ difficultyTn: 2, contactLevel: 1 }), 2);
  });
  test('the old way: −1 TN per level, no dice, no book modifiers', (t) => {
    t.after(oldWay({ 'BOOK_V78.legwork.mode': 'tn' }));
    assert.deepEqual(legworkDifficulties().map((d) => d.tn), [3, 4, 6, 8]);
    assert.equal(legworkTarget({ difficultyTn: 6, contactLevel: 3 }), 4);
    assert.equal(legworkLevelDice(3), 0);
    assert.deepEqual(legworkModifiers({ fixer: true }), []);
  });
});

describe('v0.78.0 flash grenades (BOOK_V78.flash)', () => {
  test('+6 TN, −1 per 5 m, nothing beyond 30 m, halved by flare compensation', () => {
    assert.deepEqual([0, 4, 5, 12, 29, 30, 31].map((m) => flashTn({ metres: m })), [6, 6, 5, 4, 1, 0, 0]);
    assert.equal(flashTn({ metres: 0, flareComp: true }), 3);
    assert.equal(flashTn({ metres: 7, flareComp: true }), 2);
  });
  test('5 Combat Turns, −1 per 2 Body successes', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 10].map(flashDuration), [5, 5, 4, 4, 3, 0]);
  });
});

describe('v0.78.0 blast falloff in whole points (anti-vehicle rocket −1 per 4 m)', () => {
  test('blastLoss rounds down; the old avRocket falloff was 0.25 (v0.92.4: the book 8, COMBAT_V923.avRocket)', () => {
    assert.equal(RULES.COMBAT_V923.avRocketOldPerMetre, 0.25);
    assert.deepEqual([0, 3, 4, 7, 8].map((m) => blastLoss(m, 0.25)), [0, 0, 1, 1, 2]);
    assert.equal(blastPower(16, 9, 0.25), 14);
    assert.equal(blastLoss(5, 0.5), 2);
    assert.equal(blastLoss(3.9, 2), 6);
  });
});

describe('v0.78.0 the monofilament whip (COMBAT_V61.monowhip.on defended)', () => {
  test('pool dice are tagged and stay tagged through a Karma re-roll', async () => {
    const r = await successTest({ dice: 2, poolDice: 2, targetNumber: 4, roll: scripted([5, 1, 5, 1]) });
    assert.deepEqual(r.dice.map((d) => Boolean(d.pool)), [false, false, true, true]);
    assert.equal(poolSuccesses(r.dice), 1);
    const rr = await rerollFailures(r, scripted([5, 5]));
    assert.equal(poolSuccesses(rr.dice), 2);
  });
  test('backlash only when the pool successes alone turned the attack', () => {
    assert.equal(whipBacklash({ attackerSuccesses: 2, defenderSuccesses: 3, defenderPoolSuccesses: 2 }), true);
    assert.equal(whipBacklash({ attackerSuccesses: 2, defenderSuccesses: 4, defenderPoolSuccesses: 1 }), false);
    assert.equal(whipBacklash({ attackerSuccesses: 3, defenderSuccesses: 1, defenderPoolSuccesses: 1 }), false);
    assert.equal(selfHitCheck({ selfHit: true, botch: true, missed: true }), false);
  });
  test('the old way: a botch hits the wielder; no backlash check', (t) => {
    t.after(oldWay({ 'COMBAT_V61.monowhip.on': 'botch' }));
    assert.equal(selfHitCheck({ selfHit: true, botch: true, missed: true }), true);
    assert.equal(whipBacklash({ attackerSuccesses: 2, defenderSuccesses: 3, defenderPoolSuccesses: 2 }), false);
  });
});

describe('v0.78.0 slap patches (BOOK_V78.patches)', () => {
  test('stim: wears off in the rolled minutes', () => {
    assert.deepEqual(stimEffect(5, 3, 7), { off: 3, backHours: 7 / 60, backSeconds: 420, back: 4 });
  });
  test('tranq: net patch successes', () => {
    assert.equal(tranqOpposed(4, 1), 3);
    assert.equal(tranqOpposed(1, 3), 0);
  });
});

describe('v0.78.0 toxin bioware (BOOK_V78.toxinBioware)', () => {
  const item = (bioKind: string, rating: number) => ({ bioKind, rating, installed: true, bioware: true } as any);
  test('the book: Power off by vector, no dice', () => {
    const ex = bioEffect(item('toxinExtractor', 5));
    assert.deepEqual([ex.toxinDice, ex.powerOff], [0, { injection: 2 }]);
    const tf = bioEffect(item('trachealFilter', 3));
    assert.deepEqual([tf.inhalantDice, tf.powerOff], [0, { inhalation: 1 }]);
    assert.equal(toxinPower(6, { injection: 2 }, 'injection'), 4);
    assert.equal(toxinPower(6, { injection: 2 }, 'ingestion'), 6);
    assert.equal(toxinPower(1, { inhalation: 3 }, 'inhalation'), 0);
  });
  test('the old way: dice', (t) => {
    t.after(oldWay({ 'BOOK_V78.toxinBioware': 'dice' }));
    assert.deepEqual([bioEffect(item('toxinExtractor', 3)).toxinDice, bioEffect(item('toxinExtractor', 3)).powerOff], [3, {}]);
  });
});

describe('v0.78.0 symbiotes (BOOK_V78.symbiotes)', () => {
  const on = () => oldWay({ 'HEALTH_V72.bioware.enabled': true });
  test('the book: healing time × 90 / 70 / 50 %, no dice', (t) => {
    t.after(on());
    const v = (r: number) => bioVitals([{ bioKind: 'symbiotes', rating: r, installed: true }]);
    assert.deepEqual([1, 2, 3, 4].map((r) => v(r).healingTimeFactor), [0.9, 0.7, 0.5, 0.5]);
    assert.equal(v(2).healingDice, 0);
    assert.equal(naturalHealing({ track: 'stun', boxes: 3, successes: 2, hours: 100, timeFactor: 0.5 }).hoursPerBox, RULES.HEALING.natural.periodHours.stun * 0.5 / 2);
  });
  test('the old way: dice', (t) => {
    t.after(on());
    t.after(oldWay({ 'BOOK_V78.symbiotes.mode': 'dice' }));
    const v = bioVitals([{ bioKind: 'symbiotes', rating: 2, installed: true }]);
    assert.deepEqual([v.healingDice, v.healingTimeFactor], [2, 1]);
  });
});

describe('v0.78.0 the encephalon (BOOK_V78.encephalon)', () => {
  test('Shadowtech: an Intelligence bonus and a Task Pool, no dice', () => {
    assert.deepEqual([1, 2, 3, 4].map(encephalonIntelligence), [1, 1, 2, 2]);
    assert.deepEqual([1, 2, 3, 4].map(encephalonTaskPool), [0, 1, 2, 3]);
    assert.equal(encephalonDice(3, { attribute: 'intelligence', kind: 'active' }), 0);
    assert.deepEqual([encephalonFits({ attribute: 'intelligence', kind: 'active' }), encephalonFits({ kind: 'knowledge' }), encephalonFits({ kind: 'buildRepair' }), encephalonFits({ kind: 'language' }), encephalonFits({ attribute: 'quickness', kind: 'active' })],
      [true, true, true, false, false]);
  });
  test('the old way: rating dice, no bonus or pool', (t) => {
    t.after(oldWay({ 'BOOK_V78.encephalon.mode': 'dice' }));
    assert.equal(encephalonDice(2, { attribute: 'intelligence' }), 2);
    assert.deepEqual([encephalonIntelligence(4), encephalonTaskPool(4)], [0, 0]);
  });
});

describe('v0.78.0 cybereyes and cyberears (BOOK_V78.senseAllowance)', () => {
  test('eyes: options free up to 0.5; ears: one feature of 0.2 or less free', () => {
    assert.equal(sensoryEssence('eyes', { base: 0.2, host: true, options: [0.2, 0.2, 0.1] }), 0.2);
    assert.equal(sensoryEssence('eyes', { base: 0.2, host: true, options: [0.2, 0.2, 0.4] }), 0.5);
    assert.equal(sensoryEssence('eyes', { base: 0, host: false, options: [0.2] }), 0.2);
    assert.equal(sensoryEssence('ears', { base: 0.3, host: true, options: [0.2, 0.1] }), 0.4);
    assert.equal(sensoryEssence('ears', { base: 0.3, host: true, options: [0.3] }), 0.6);
  });
  test('the templates', () => {
    assert.deepEqual([T('cybereyes').essenceCost, T('cybereyes').cost], [0.2, 8000]);
    assert.deepEqual([T('cyberears').essenceCost, T('cyberears').cost], [0.4, 11000]);
  });
  test('the importer: amplification and damper inside cyberears', () => {
    const items = statBlockItems(parseStatBlock('Name: Ears\nBody: 3\nCyberware: Cyberears (hearing amplification, dampener)')).items;
    const ears = items.find((i: any) => i.system?.kind === 'ears') as any;
    assert.deepEqual([ears.system.essenceCost, ears.system.hearingAmp, ears.system.dampener], [0.4, 1, true]);
  });
  test('the old way: every option costs', (t) => {
    t.after(oldWay({ 'BOOK_V78.senseAllowance.enabled': false }));
    assert.equal(sensoryEssence('eyes', { base: 0.2, host: true, options: [0.2, 0.2, 0.1] }), 0.7);
  });
});

describe('v0.78.0 the importer’s Hibernate (owner: the spell page)', () => {
  test('manipulation, physical, touch, TN 4, sustained, (F/2)S, not resisted', () => {
    const items = statBlockItems(parseStatBlock('Name: Mage\nBody: 3\nMagic: 6\nSpells: Hibernate 4')).items;
    const h = items.find((i: any) => i.name === 'Hibernate') as any;
    assert.deepEqual([h.system.category, h.system.spellType, h.system.range, h.system.targetNumber, h.system.duration, h.system.resist, h.system.drainModifier, h.system.drainLevel],
      ['manipulation', 'physical', 'touch', 4, 'sustained', 'none', 0, 'S']);
  });
});

describe('v0.78.0 mana barriers (BOOK_V78.manaBarrier)', () => {
  test('across a mana barrier: the caster’s TN; a ward: resistance dice', () => {
    assert.deepEqual(barrierSpellEffect(3, 'mana barrier'), { dice: 0, tn: 3 });
    assert.deepEqual(barrierSpellEffect(3, 'ward'), { dice: 3, tn: 0 });
    assert.equal(barrierSpellRating(5, 3, 'mana'), 2);
    assert.equal(barrierSpellRating(1, 3, 'mana'), 1);
    assert.equal(barrierSpellRating(5, 3, 'physical'), 5);
  });
  test('the old way', (t) => {
    t.after(oldWay({ 'BOOK_V78.manaBarrier.spells': 'resistDice', 'BOOK_V78.manaBarrier.rating': 'force' }));
    assert.deepEqual(barrierSpellEffect(3, 'mana barrier'), { dice: 3, tn: 0 });
    assert.equal(barrierSpellRating(5, 3, 'mana'), 5);
  });
});

describe('v0.78.0 invisibility (BOOK_V78.invisibility)', () => {
  test('Perception vs 2 × the caster’s successes; one success sees through; thermographic sees mana Invisibility', () => {
    assert.deepEqual(invisibilityPerceptionTest({ dice: 5, casterSuccesses: 3 }), { dice: 5, tn: 6 });
    assert.deepEqual(invisibilityPerceptionTest({ dice: 5, casterSuccesses: 0 }).tn, 2);
    assert.equal(seesThrough(1, 4), true);
    assert.equal(seesThrough(0, 1), false);
    assert.equal(effectiveConcealment({ kind: 'invisibility', rating: 3, observerAstral: false, seenThrough: false, observerThermographic: true }), 0);
    assert.equal(effectiveConcealment({ kind: 'improvedInvisibility', rating: 3, observerAstral: false, seenThrough: false, observerThermographic: true }), 3);
  });
  test('the old way', (t) => {
    t.after(oldWay({ 'BOOK_V78.invisibility.mode': 'resist', 'BOOK_V78.invisibility.thermographicSeesMana': false }));
    assert.equal(seesThrough(1, 4), false);
    assert.equal(effectiveConcealment({ kind: 'invisibility', rating: 3, observerAstral: false, seenThrough: false, observerThermographic: true }), 3);
  });
});

describe('v0.78.0 focus bonding Karma (BOOK_V78.focusKarma)', () => {
  test('the book’s table', (t) => {
    // v0.92.3: the v0.92.2 rule (RULES.SORCERY_V923).
    t.after(oldWay({ 'SORCERY_V923.weaponFocusKarma': 0 }));
    assert.equal(focusKarmaCost('spell', 3, { target: 'Mana Bolt' }), 3);
    assert.equal(focusKarmaCost('spell', 3, { category: 'combat' }), 9);
    assert.equal(focusKarmaCost('sustaining', 4), 1);
    assert.equal(focusKarmaCost('spirit', 3), 6);
    assert.equal(focusKarmaCost('power', 2), 10);
    assert.equal(focusKarmaCost('weapon', 2), 8);
    assert.equal(focusKarmaCost('weapon', 2, { size: 'large' }), 10);
  });
  test('the old way', (t) => {
    t.after(oldWay({ 'BOOK_V78.focusKarma.mode': 'flat' }));
    assert.deepEqual([focusKarmaCost('spell', 3), focusKarmaCost('sustaining', 4), focusKarmaCost('weapon', 2)], [3, 4, 6]);
  });
});

describe('v0.78.0 power foci (BOOK_V78.powerFocus)', () => {
  const foci = [{ focusType: 'power', rating: 3, active: true, bonded: true, category: '', target: '' }, { focusType: 'spell', rating: 2, active: true, bonded: true, category: 'combat', target: '' }] as any[];
  test('the book: a rating for Magic and the Spell Pool, no Sorcery dice', () => {
    assert.equal(powerFocusRating(foci), 3);
    assert.equal(sorceryFocusDice(foci, { category: 'combat', name: 'Mana Bolt' } as any).dice, 2);
  });
  test('the old way: dice', (t) => {
    t.after(oldWay({ 'BOOK_V78.powerFocus': 'dice' }));
    assert.equal(powerFocusRating(foci), 0);
    assert.equal(sorceryFocusDice(foci, { category: 'combat', name: 'Mana Bolt' } as any).dice, 5);
  });
});

describe('v0.78.0 insect flesh forms (BOOK_V78.insectFlesh)', () => {
  const host = { body: 4, quickness: 3, strength: 1 };
  test('soldiers host + Force, workers host − 1 (at least 1)', () => {
    assert.deepEqual(fleshFormAttributes(host, 5, 'soldier'), { body: 9, quickness: 8, strength: 6 });
    assert.deepEqual(fleshFormAttributes(host, 5, 'worker'), { body: 3, quickness: 2, strength: 1 });
    assert.deepEqual(fleshFormAttributes(host, 5), { body: 9, quickness: 8, strength: 6 });
    assert.deepEqual([insectRole('Ant worker'), insectRole('Wasp Soldier'), insectRole('Queen')], ['worker', 'soldier', '']);
  });
});

describe('v0.78.0 allergies (BOOK_V78.allergy; owner: moderate counts as mild)', () => {
  const traits = (severity: string) => [{ special: 'allergy', substance: 'silver', severity, exposed: true }];
  test('the book’s four levels', () => {
    assert.ok((ALLERGY_SEVERITIES as readonly string[]).includes('extreme'));
    assert.deepEqual(['nuisance', 'mild', 'moderate', 'severe', 'extreme'].map((s) => allergyTn(traits(s)).value), [0, 1, 1, 0, 0]);
    assert.deepEqual(['mild', 'severe', 'extreme'].map((s) => allergyWeaponPower(traits(s), 'silver')), [0, 2, 2]);
    assert.deepEqual(['severe', 'extreme'].map(allergyContact), [null, 'L']);
    assert.equal(allergyWeaponPower(traits('severe'), 'iron'), 0);
  });
  test('the old way', (t) => {
    t.after(oldWay({ 'BOOK_V78.allergy.mode': 'legacy' }));
    assert.deepEqual([allergyRow('moderate').tn, allergyContact('severe'), allergyWeaponPower(traits('severe'), 'silver'), allergyRow('extreme').tn], [2, 'M', 0, 2]);
  });
});

describe('v0.78.0 tamper alarms and voice locks (BOOK_V78.tamper, voiceLocks)', () => {
  const base = { rating: 5, lockType: 'keypad', casing: 3, casingOpen: false, skillDice: 4, tools: [], light: null, vision: {} };
  test('the anti-tamper rating rides on the casing (or the circuit with no casing)', () => {
    const c = bypassPlan({ ...base, tamper: 2 });
    assert.deepEqual([c.step, c.tamperOnStep, c.modifiers.find((m) => /tamper/.test(m.label))?.value], ['casing', true, 2]);
    const open = bypassPlan({ ...base, casingOpen: true, tamper: 2 });
    assert.deepEqual([open.step, open.tamperOnStep], ['circuit', false]);
    const bare = bypassPlan({ ...base, casing: 0, tamper: 2 });
    assert.deepEqual([bare.step, bare.tamperOnStep, bare.modifiers.some((m) => /tamper/.test(m.label))], ['circuit', true, true]);
  });
  test('a voice lock needs a deception device; ties repeat', () => {
    const none = bypassPlan({ ...base, lockType: 'voice', tools: [{ kind: 'maglockKit', rating: 3, name: 'Kit' }] });
    assert.deepEqual([none.step, none.tool, none.dice], ['voice', null, 0]);
    const rec = bypassPlan({ ...base, lockType: 'voice', tools: [{ kind: 'voiceDeception', rating: 4, name: 'Recorder' }, { kind: 'voiceDeception', rating: 6, name: 'Synth' }] });
    assert.deepEqual([rec.step, rec.dice, rec.tn, rec.tool?.name], ['voice', 6, 5, 'Synth']);
    assert.deepEqual([voiceOutcome(3, 2), voiceOutcome(2, 2), voiceOutcome(1, 2)], ['open', 'tie', 'hold']);
  });
  test('the old ways', (t) => {
    t.after(oldWay({ 'BOOK_V78.tamper.mode': 'opposed', 'BOOK_V78.voiceLocks': 'electronics' }));
    assert.equal(bypassPlan({ ...base, tamper: 2 }).tamperOnStep, false);
    assert.equal(bypassPlan({ ...base, lockType: 'voice', casingOpen: true, tools: [] }).step, 'circuit');
  });
});

describe('v0.78.0 barrier damage (BOOK_V78.barriers)', () => {
  test('doubled against gunfire, melee and combat spells; steps; holes', () => {
    assert.deepEqual(barrierDamage({ rating: 6, power: 5 }), { damage: 0, left: 6, breached: false, holes: 0, adjusted: 12 });
    assert.deepEqual(barrierDamage({ rating: 6, power: 6 }), { damage: 1, left: 5, breached: false, holes: 0, adjusted: 12 });
    assert.deepEqual(barrierDamage({ rating: 6, power: 19 }), { damage: 1, left: 5, breached: false, holes: 1, adjusted: 12 });
    assert.deepEqual(barrierDamage({ rating: 6, power: 6, kind: 'blast' }).holes, 0);
    assert.equal(barrierDamage({ rating: 6, power: 2, kind: 'blast' }).damage, 0);
    assert.equal(barrierDamage({ rating: 6, power: 4, kind: 'blast' }).damage, 1);
    assert.equal(barrierDamage({ rating: 1, power: 3 }).breached, true);
  });
  test('an ordinary door breaks at half its rating, a security door at 0', () => {
    assert.equal(barrierDamage({ rating: 5, power: 10, door: 'ordinary', full: 8 }).breached, true);
    assert.equal(barrierDamage({ rating: 6, power: 10, door: 'ordinary', full: 8 }).breached, false);
    assert.equal(barrierDamage({ rating: 5, power: 10, door: 'security', full: 8 }).breached, false);
  });
});

describe('v0.78.0 vehicle adaptations (BOOK_V78.adaptation)', () => {
  test('remote 2,500 × Body; rigger 2,800 and needs the remote one', () => {
    assert.equal(modificationEffect('remote', 1, 4).cost, 10000);
    assert.equal(modificationEffect('adaptation', 1, 4).cost, 2800);
    assert.equal(modPrerequisite('adaptation', []), 'Remote adaptation');
    assert.equal(modPrerequisite('adaptation', ['remote']), null);
    assert.equal(modPrerequisite('armor', []), null);
  });
  test('the old way: one rigger adaptation at 2,500 × Body', (t) => {
    t.after(oldWay({ 'BOOK_V78.adaptation': 'single' }));
    assert.equal(modificationEffect('adaptation', 1, 4).cost, 10000);
    assert.equal(modPrerequisite('adaptation', []), null);
  });
});

describe('v0.78.0 owner’s template decisions', () => {
  test('riot shield no parry; club reach 1; passkey 10,000¥ × rating', () => {
    assert.equal(T('riotShield').parry, 0);
    assert.equal(T('club').reach, 1);
    assert.deepEqual([T('passkey').cost, T('passkey').bypassTool], [40000, { kind: 'passkey', rating: 4 }]);
  });
});
