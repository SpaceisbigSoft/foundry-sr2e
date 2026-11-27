/**
 * v0.96.0 rules completeness, sorcery (RULES.SORCERY_V96): the pure rules (rules/sorcery96.ts), the switches, the
 * importer's drain table, and for each switch that its other choice gives the v0.95.1 answer.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/config.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as S from '../rules/sorcery96.ts';
import { HOUSE_SORCERY_V96 } from '../rules/config96/sorcery.ts';
import { parseStatBlock, statBlockItems } from '../rules/statblock.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

describe('v0.96.0 sorcery: the switches', () => {
  test('every switch has a house-rules row, book first; the rows are in the settings window', () => {
    assert.ok(read('src', 'module', 'settings.ts').includes('...HOUSE_SORCERY_V96'));
    const v: any = RULES.SORCERY_V96;
    for (const r of HOUSE_SORCERY_V96) {
      const key = r.path.split('.')[1]!;
      assert.ok(key in v, r.path);
      if (r.type === 'select') { assert.equal(v[key], r.choices![0], `${r.path} defaults to its first choice`); assert.equal(r.choices![0], 'book'); }
    }
  });
  test('every key the new files use is drafted, and every house-rule row has its label', () => {
    const draft = JSON.parse(read('i18n-drafts', 'sorcery96.json'));
    const src = ['src/module/rules/sorcery96.ts', 'src/module/applications/sorcery96.ts', 'src/module/documents/index.ts', 'public/templates/actor-character-sheet.hbs']
      .map((f) => read(...f.split('/'))).join('\n');
    for (const k of new Set(src.match(/SR2E\.Sorcery96\.[A-Za-z0-9.]+[A-Za-z0-9]/g) ?? [])) {
      if (/\.(From|Why)$/.test(k)) continue;
      assert.ok(k in draft, k);
    }
    for (const r of HOUSE_SORCERY_V96) assert.ok(`SR2E.HouseRules.Rule.${r.path.replace('.', '__')}` in draft, r.path);
    for (const f of ['magicalTheory', 'conjuring', 'enchanting', 'willpower']) assert.ok(`SR2E.Sorcery96.From.${f}` in draft);
    for (const w of ['areaTooMuch', 'areaBelowZero', 'fociLimit', 'quickenKarma', 'centerPerceive']) assert.ok(`SR2E.Sorcery96.Why.${w}` in draft);
  });
});

describe('v0.96.0 sorcery: defaulting a magical skill (Awakenings p. 93)', () => {
  test('the most dice win; +2 a step; the GM web wins over the switch steps', () => {
    assert.deepEqual(S.magicDefault({ ratings: { conjuring: 5, magicalTheory: 3 }, willpower: 4 }), { dice: 5, tn: 4, from: 'conjuring' });
    assert.deepEqual(S.magicDefault({ ratings: { magicalTheory: 4 }, willpower: 4 }), { dice: 4, tn: 2, from: 'magicalTheory' });
    assert.deepEqual(S.magicDefault({ ratings: {}, willpower: 5 }), { dice: 5, tn: 8, from: 'willpower' });
    assert.deepEqual(S.magicDefault({ ratings: { conjuring: 5 }, willpower: 0, steps: { conjuring: 1 } }), { dice: 5, tn: 2, from: 'conjuring' });
    assert.equal(S.magicDefault({ ratings: {}, willpower: 0 }), null);
    assert.equal(S.magicDefaultMod({ dice: 5, tn: 4, from: 'conjuring' }).value, 4);
  });
  test('off: no default (v0.95.1)', (t) => {
    t.after(oldWay({ 'SORCERY_V96.magicDefault': 'off' }));
    assert.equal(S.magicDefault({ ratings: { conjuring: 5 }, willpower: 4 }), null);
  });
});

describe('v0.96.0 sorcery: area spells, stacking and noticing (Core pp. 129–132)', () => {
  test('shaping: 2 dice a metre smaller, 1 a metre larger, at most the Force', () => {
    assert.deepEqual(S.areaShape({ force: 6, radius: 5, metres: -2 }), { withheld: 4, radius: 3 });
    assert.deepEqual(S.areaShape({ force: 6, radius: 5, metres: 3 }), { withheld: 3, radius: 8 });
    assert.deepEqual(S.areaShape({ force: 6, radius: 5, metres: -4 }), { why: 'SR2E.Sorcery96.Why.areaTooMuch' });
    assert.deepEqual(S.areaShape({ force: 6, radius: 1, metres: -2 }), { why: 'SR2E.Sorcery96.Why.areaBelowZero' });
    assert.equal(S.areaShape({ force: 6, radius: 5, metres: 0 }), null);
    assert.deepEqual(S.areaShapeLimits(5, 6), { grow: 5, shrink: 2 });
  });
  test('stacking +2 per other spell; noticing 2 × |Magic − Force|, at least 2', () => {
    assert.equal(S.stackMods(1)[0]!.value, 2);
    assert.equal(S.stackMods(2)[0]!.value, 4);
    assert.deepEqual(S.stackMods(0), []);
    assert.equal(S.noticeTn(6, 4), 4);
    assert.equal(S.noticeTn(6, 2), 8);
    assert.equal(S.noticeTn(6, 6), 2);
  });
  test('off: no shaping, no stacking rows, no noticing line (v0.95.1)', (t) => {
    t.after(oldWay({ 'SORCERY_V96.areaShape': 'off', 'SORCERY_V96.stacking': 'off', 'SORCERY_V96.noticing': 'off' }));
    assert.equal(S.areaShape({ force: 6, radius: 5, metres: -2 }), null);
    assert.deepEqual(S.areaShapeLimits(5, 6), { grow: 0, shrink: 0 });
    assert.deepEqual(S.stackMods(2), []);
    assert.equal(S.noticeTn(6, 4), null);
  });
});

describe('v0.96.0 sorcery: foci, the Armor spell, wards', () => {
  test('foci: at most Intelligence active; warn mode only warns; off none', (t) => {
    assert.equal(S.fociLimit(3, 4), null);
    assert.deepEqual(S.fociLimit(4, 4), { refuse: true, why: 'SR2E.Sorcery96.Why.fociLimit' });
    const back = oldWay({ 'SORCERY_V96.fociLimit': 'warn' });
    assert.equal(S.fociLimit(4, 4)!.refuse, false);
    back();
    t.after(oldWay({ 'SORCERY_V96.fociLimit': 'off' }));
    assert.equal(S.fociLimit(9, 4), null);
  });
  test('Armor counts half its successes; other spells keep the step; off = the step', (t) => {
    assert.equal(S.effectStep('Armor', 1), 2);
    assert.equal(S.effectStep('armour (spell)', 1), 2);
    assert.equal(S.effectStep('Increase Reflexes', 1), 1);
    t.after(oldWay({ 'SORCERY_V96.armorSpell': 'off' }));
    assert.equal(S.effectStep('Armor', 1), 1);
  });
  test('ward days: ends on the clock; book lowers, card only warns, off keeps nothing', (t) => {
    assert.equal(S.wardEndsAt(1000, 3), 1000 + 3 * S.DAY_SECONDS);
    assert.equal(S.wardEndsAt(1000, 0), 0);
    assert.deepEqual(S.wardFalls(5000, 4999), { fall: false, lower: false });
    assert.deepEqual(S.wardFalls(5000, 5000), { fall: true, lower: true });
    const back = oldWay({ 'SORCERY_V96.wardExpiry': 'card' });
    assert.deepEqual(S.wardFalls(5000, 6000), { fall: true, lower: false });
    back();
    t.after(oldWay({ 'SORCERY_V96.wardExpiry': 'off' }));
    assert.equal(S.wardEndsAt(1000, 3), 0);
    assert.deepEqual(S.wardFalls(5000, 6000), { fall: false, lower: false });
  });
});

describe('v0.96.0 sorcery: metamagic (Grimoire pp. 43–47)', () => {
  test('quickening: Karma Force..2×Force; actions dice ÷ successes up, at least 1, none = twice', () => {
    assert.deepEqual(S.quickenKarma(3, 3), { karma: 3 });
    assert.deepEqual(S.quickenKarma(3, 6), { karma: 6 });
    assert.ok('why' in S.quickenKarma(3, 7));
    assert.ok('why' in S.quickenKarma(3, 2));
    assert.equal(S.quickenActions(6, 2), 3); // Grimoire p. 45's example
    assert.equal(S.quickenActions(7, 2), 4);
    assert.equal(S.quickenActions(2, 5), 1);
    assert.equal(S.quickenActions(6, 0), 12);
    assert.equal(S.quickenDice(7, 3), 10);
  });
  test('anchoring: Karma F + links, TN half F + links (at least 2), minutes ÷ successes; off null', (t) => {
    assert.deepEqual(S.anchorPrep(6, 1), { karma: 7, tn: 4, minutes: 7 });
    assert.deepEqual(S.anchorPrep(1, 0), { karma: 1, tn: 2, minutes: 1 });
    assert.equal(S.anchorMinutes(7, 2), 4);
    assert.equal(S.anchorMinutes(7, 0), 7);
    t.after(oldWay({ 'SORCERY_V96.anchoring': 'off' }));
    assert.equal(S.anchorPrep(6, 1), null);
  });
  test('masking: threshold grade difference, at least 1; only initiates; foci up to the grade', (t) => {
    assert.deepEqual(S.maskThreshold({ subjectGrade: 4, viewerGrade: 2, viewerInitiate: true }), { can: true, need: 2 });
    assert.deepEqual(S.maskThreshold({ subjectGrade: 1, viewerGrade: 3, viewerInitiate: true }), { can: true, need: 1 });
    assert.equal(S.maskThreshold({ subjectGrade: 1, viewerGrade: 0, viewerInitiate: false })!.can, false);
    assert.equal(S.maskCoversFoci(4, 4), true);
    assert.equal(S.maskCoversFoci(7, 4), false);
    t.after(oldWay({ 'SORCERY_V96.masking': 'off' }));
    assert.equal(S.maskThreshold({ subjectGrade: 4, viewerGrade: 2, viewerInitiate: true }), null);
  });
  test('centering: 1 success per 2, only on a test with one; off: no use', (t) => {
    assert.equal(S.centeringBonus(5, 1), 2);
    assert.equal(S.centeringBonus(5, 0), 0);
    assert.equal(S.centerUse('cast'), 'cast');
    assert.equal(S.centerUse('other'), null);
    t.after(oldWay({ 'SORCERY_V96.centeringUse': 'off' }));
    assert.equal(S.centerUse('drain'), null);
  });
});

describe('v0.96.0 sorcery: totem dice as Magic Pool dice (Core p. 119)', () => {
  test('a bonus pays for the first pool dice asked; a penalty leaves fewer', () => {
    assert.deepEqual(S.totemPool({ totem: 2, cast: 3, drain: 2, left: 5 }), { castFree: 2, drainFree: 0, castSpend: 1, drainSpend: 2 });
    assert.deepEqual(S.totemPool({ totem: 2, cast: 1, drain: 2, left: 0 }), { castFree: 1, drainFree: 1, castSpend: 0, drainSpend: 0 });
    assert.deepEqual(S.totemPool({ totem: -1, cast: 3, drain: 2, left: 4 }), { castFree: 0, drainFree: 0, castSpend: 3, drainSpend: 0 });
    assert.equal(S.totemPool({ totem: 0, cast: 3, drain: 2, left: 4 }), null);
    assert.equal(S.totemPoolMax(2, 3), 5);
    assert.equal(S.totemPoolMax(-2, 1), 0);
  });
  test('off: null (the totem adds to the casting test, v0.95.1)', (t) => {
    t.after(oldWay({ 'SORCERY_V96.totemPool': 'off' }));
    assert.equal(S.totemPool({ totem: 2, cast: 3, drain: 2, left: 5 }), null);
    assert.equal(S.totemPoolMax(2, 3), 3);
  });
});

describe('v0.96.0 sorcery: drain codes, dispelled effects, Grade 0', () => {
  test('the core table: by name without case or spaces; variable spells left out', () => {
    assert.deepEqual(S.bookDrain('Mana Bolt'), { modifier: 0, level: 'S' });
    assert.deepEqual(S.bookDrain('Fireball'), { modifier: 3, level: 'D' });
    assert.deepEqual(S.bookDrain('Armor'), { modifier: 2, level: 'M' });
    assert.equal(S.bookDrain('Heal'), null);
    assert.equal(S.bookDrain('Unknown Spell'), null);
  });
  test('the importer fills a missing drain code from the table; off warns as before', (t) => {
    const p = parseStatBlock('Sorcery 6\nSpells: Manabolt 5, Heal 4');
    const { items, warnings } = statBlockItems(p);
    const mb = items.find((i) => /manabolt/i.test(i.name))!;
    assert.equal((mb.system as any).drainLevel, 'S');
    assert.ok(warnings.some((w) => /Heal/.test(w)));
    assert.ok(!warnings.some((w) => /Manabolt/i.test(w)));
    t.after(oldWay({ 'SORCERY_V96.drainTable': 'off' }));
    const old = statBlockItems(p);
    assert.equal((old.items.find((i) => /manabolt/i.test(i.name))!.system as any).drainLevel, undefined);
    assert.ok(old.warnings.some((w) => /Manabolt/i.test(w)));
  });
  test('a dispelled spell\'s effect is capped at its new Force; off: nothing', (t) => {
    assert.deepEqual(S.dispelledSpec({ capAt: 6, perSuccess: true }, 4), { capAt: 4, perSuccess: true });
    assert.deepEqual(S.dispelledSpec({ capAt: 4, perSuccess: true }, 6), { capAt: 6, perSuccess: true });
    assert.equal(S.dispelledSpec({ capAt: 0 }, 4), null);
    assert.equal(S.dispelledSpec({ capAt: 4 }, 4), null);
    assert.equal(S.dispelledSpec({ capAt: 4 }, 0), null);
    t.after(oldWay({ 'SORCERY_V96.dispelEffect': 'off' }));
    assert.equal(S.dispelledSpec({ capAt: 6 }, 4), null);
  });
  test('Grade 0 tick at grade 0 under the book initiation; off none', (t) => {
    assert.equal(S.showGradeZero(0), true);
    assert.equal(S.showGradeZero(1), false);
    const back = oldWay({ 'SORCERY_V923.initiation': 'v922' });
    assert.equal(S.showGradeZero(0), false);
    back();
    t.after(oldWay({ 'SORCERY_V96.gradeZero': 'off' }));
    assert.equal(S.showGradeZero(0), false);
  });
});

describe('v0.96.0 sorcery: the hooks in shared files are guarded by the switches', () => {
  test('documents, sheets, statblock and the template call into the new files', () => {
    const doc = read('src', 'module', 'documents', 'index.ts');
    for (const s of ['G96.magicDefaultFor(this)', 'S96.areaShape(', 'S96.stackMods(', 'G96.noticeNote(', 'S96.totemPool(', 'G96.centeringRoll(', 'S96.effectStep(', 'wardDays96', 'this.#quicken96(', 'S96.anchorPrep(', 'G96.maskTest(', 'refitSpellEffect96(']) assert.ok(doc.includes(s), s);
    const sheets = read('src', 'module', 'applications', 'sheets.ts');
    for (const s of ['G96.castRows96(', 'G96.readCast96(', 'G96.askQuicken(', 'S96.showGradeZero(', 'S96.totemPoolMax(']) assert.ok(sheets.includes(s), s);
    assert.ok(read('src', 'module', 'rules', 'statblock.ts').includes('bookDrain(s0.name)'));
    assert.ok(read('public', 'templates', 'actor-character-sheet.hbs').includes('gradeZero96'));
    assert.ok(read('src', 'module', 'sr2e-system.ts').includes('registerSorcery96()'));
  });
});
