/**
 * v0.89.5: localization, sixth slice: ids instead of English text matching, joined fragments, context keys.
 * - Modifier rows with fixed text carry ids; exclusions, picks and the GM's retarget dedupe go by `modKey` (rules/dice.ts).
 * - The outcome words are `SR2E.Card.Outcome` keys marked with `data-sr2e-outcome` / `data-sr2e-taken` ids, read by the
 *   banner and the look by id.
 * - Template headings carry `data-heading` (English), GM-only controls `data-sr2e-gm`, the edit pencils
 *   `data-sr2e-edit-pencil` (scripts/i18n-headings.mjs).
 * - Fragments that were words of a sentence are joined into whole texts; context keys end in `__<context>`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { modKey, modIn, modifierIs } from '../rules/dice.ts';
import { tNoun, tList } from '../helpers/i18n.ts';
import { headingName } from '../helpers/heading.ts';
import { scatterDirection } from '../rules/armory.ts';
import { checkStep, stepStates } from '../rules/advancement.ts';
import { jackOutTest } from '../rules/datawar.ts';
import { alignRowIds } from './helpers/assert-rows.ts';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src', 'module');
const lang = JSON.parse(readFileSync(join(ROOT, 'public', 'lang', 'en.json'), 'utf8'));
const flat = (o: any, p = ''): Record<string, any> => Object.entries(o).reduce((acc: Record<string, any>, [k, v]) => (v && typeof v === 'object' && !('other' in (v as any)) ? { ...acc, ...flat(v, `${p}${k}.`) } : { ...acc, [`${p}${k}`]: v }), {});
const KEYS = flat(lang);
const files = (d: string, out: string[] = []): string[] => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== '__tests__') files(p, out); } else if (f.endsWith('.ts')) out.push(p);
  }
  return out;
};
const ALL = files(SRC).map((f) => ({ rel: relative(ROOT, f), src: readFileSync(f, 'utf8') }));
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const INDEX = read('src', 'module', 'documents', 'index.ts');
const TPL = join(ROOT, 'public', 'templates');
const TEMPLATES = readdirSync(TPL).filter((f) => f.endsWith('.hbs')).map((f) => readFileSync(join(TPL, f), 'utf8')).join('\n');

describe('v0.89.5 modifier rows by id', () => {
  test('modKey is the id (marked) or the label; modIn matches a key or, for lists saved earlier, a label', () => {
    assert.equal(modKey({ id: 'wounds', label: 'Wunden', value: 1 } as any), '#wounds');
    assert.equal(modKey({ label: 'Smoke (thermo)', value: 2 } as any), 'Smoke (thermo)');
    assert.equal(modKey(null), '');
    const row = { id: 'blinded', label: 'Geblendet', value: 8 };
    assert.ok(modIn(['#blinded'], row), 'a key from another language still matches');
    assert.ok(modIn(new Set(['Geblendet']), row), 'a label saved by an older dialog matches');
    assert.ok(!modIn(['Blinded'], row), 'an English label does not match a German row (a list from before v0.89.5 in another language)');
    assert.ok(!modIn(['#flash'], row));
    assert.ok(!modIn(undefined, row));
    assert.ok(modifierIs(row, 'blinded', 'Blinded'));
  });

  test('every fixed-text modifier row (a Card.Mod text with no values) carries an id', () => {
    const bare: string[] = [];
    for (const { rel, src } of ALL) {
      for (const m of src.matchAll(/label: tx\('SR2E\.Card\.Mod\.([A-Za-z0-9]+)'\)/g)) {
        const before = src.slice(Math.max(0, (m.index ?? 0) - 160), m.index);
        const open = before.lastIndexOf('{');
        // rules/everyday.ts notDoneNoSuccesses: a time label ("not done") that borrows a Card.Mod text, not a modifier row
        if (!/\bid:/.test(before.slice(open)) && m[1] !== 'notDoneNoSuccesses') bare.push(`${rel}: ${m[1]}`);
      }
    }
    assert.deepEqual(bare, []);
  });

  test('the ids keep the meaning the code looks for (sustaining, prejudice, visible armor)', () => {
    const src = ALL.map((x) => x.src).join('\n');
    assert.doesNotMatch(src, /id: 'sustainingASpell'/);
    assert.match(src, /id: 'sustaining', label: tx\('SR2E\.Card\.Mod\.sustainingASpell'\)/);
    assert.doesNotMatch(src, /id: 'prejudiceVs'/);
    assert.doesNotMatch(src, /id: 'visibleArmorInALuxurySetting'/);
  });

  test('the dialogs switch rows off by key and the actor filters by key (no label comparisons left)', () => {
    const sheets = read('src', 'module', 'applications', 'sheets.ts');
    assert.match(sheets, /data-sr2e-auto="\$\{escHtml\(`\$\{key\}\$\{modKey\(m\)\}`\)\}"/);
    assert.match(sheets, /data-sr2e-auto="\$\{escHtml\(modKey\(m\)\)\}"/);
    assert.doesNotMatch(INDEX, /off\.has\(m\.label\)|exclude \?\? \[\]\)\.includes\(m\.label\)|exclude\.has\(m\.label\)|offMine\.has\(m\.label\)/);
    assert.match(INDEX, /return off\.size \? all\.filter\(\(m\) => !modIn\(off, m\)\) : all;/);
  });

  test('the GM\'s retarget dialog dedupes by key, and its menu entry is found by a mark, not by its text', () => {
    const chat = read('src', 'module', 'applications', 'chat.ts');
    assert.match(chat, /const known = \(m: TargetNumberModifier\) => have\.has\(modKey\(m\)\) \|\| have\.has\(m\.label\);/);
    assert.doesNotMatch(chat, /const label = 'Change target number…'/);
    assert.match(chat, /options\.some\(\(o: any\) => o\?\.sr2eRetarget\)/);
    assert.equal(KEYS['SR2E.Card.Chat.changeTargetNumberMenu'], 'Change target number…');
  });

  test('the older rules tests compare rows without an id they don\'t name', () => {
    assert.deepEqual(alignRowIds([{ id: 'x', label: 'A', value: 1 }], [{ label: 'A', value: 1 }]), [{ label: 'A', value: 1 }]);
    assert.deepEqual(alignRowIds([{ id: 'x', label: 'A', value: 1 }], [{ id: 'x', label: 'A', value: 1 }]), [{ id: 'x', label: 'A', value: 1 }]);
    assert.deepEqual(alignRowIds({ id: 'notARow' }, {}), { id: 'notARow' }, 'only modifier rows (label + value) lose an id');
  });
});

describe('v0.89.5 the outcome words', () => {
  test('outcomeBanner reads ids, and every key in the outcome tables exists', () => {
    const body = INDEX.slice(INDEX.indexOf('function outcomeBanner('), INDEX.indexOf('export function withRollMode('));
    assert.doesNotMatch(body, /'<strong>|Takes <strong>|fully resisted|No drain/);
    assert.match(body, /data-sr2e-outcome="\$\{id\}"/);
    assert.match(body, /data-sr2e-taken="\(\[LMSD\]\)" data-sr2e-track="\(physical\|stun\|matrix\|vehicle\)"/);
    for (const m of INDEX.matchAll(/'(SR2E\.Card\.(?:Outcome|Status|DamageType)\.\w+)'/g)) assert.ok(m[1]! in KEYS, m[1]);
    assert.equal(KEYS['SR2E.Card.Outcome.takenVehicle'], 'Takes {level} damage');
  });

  test('a contest\'s verdict line is marked for the look; an old card is still found by its words', () => {
    assert.match(INDEX, /data-sr2e-contest-result="1"/);
    const look = read('src', 'module', 'applications', 'look.ts');
    assert.match(look, /:scope > p\[data-sr2e-contest-result\]/);
  });

  test('the clean-miss lead, the jack-out label and the scatter words are built whole, never rewritten or read back', () => {
    assert.doesNotMatch(INDEX, /\/Clean miss\//);
    assert.doesNotMatch(INDEX, /replace\(\/\^Break free of/);
    assert.equal(jackOutTest({ uuid: 'i', name: 'Killer', rating: 5, black: true, crashed: false, hostUuid: 'h' } as any, 4, 'Killer').label.startsWith('Break free of Killer ('), true);
    assert.match(jackOutTest({ uuid: 'i', name: '', rating: 5, black: true, crashed: false, hostUuid: 'h' } as any, 4).label, /^Break free of Black IC 5 \(/);
    assert.equal(scatterDirection(1, 90).along, true);
    assert.equal(scatterDirection(1, null).along, undefined);
    assert.doesNotMatch(read('src', 'module', 'applications', 'chat.ts'), /sd\.label\.startsWith/);
  });
});

describe('v0.89.5 decisions made from data, not from text', () => {
  test('a build-check row names its step; a bare label (a record saved earlier) is still read', () => {
    assert.equal(checkStep({ label: 'Rasse', step: 'metatype' }), 'metatype');
    assert.equal(checkStep('Race'), 'metatype');
    assert.equal(checkStep({ label: 'Essence', step: 'resources' }), 'resources');
    assert.equal(checkStep({ label: 'Whatever', step: 'nonsense' }), 'review');
    assert.equal(stepStates([{ label: 'Fertigkeiten', ok: false, step: 'skills' }]).skills, 'bad');
  });

  test('learning projects carry what they learn; the safehouse keeps its problems as flags', () => {
    assert.match(INDEX, /subject: spell\.name, label: tx\('SR2E\.Card\.Actor\.learningAtForce'/);
    assert.match(INDEX, /p\.subject === name \|\| \(p\.subject === undefined && p\.label\.startsWith/);
    const sh = read('src', 'module', 'rules', 'safehouse.ts');
    assert.doesNotMatch(sh, /problems\.some\(\(p\) => \/\^Only one/);
    assert.doesNotMatch(read('src', 'module', 'applications', 'safehouse.ts'), /\/\^?Only one/);
  });
});

describe('v0.89.5 the sheets\' ids', () => {
  test('the headings carry their English as data-heading, and the script finds nothing to add', () => {
    const out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'i18n-headings.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
    assert.match(out, /headings: ok/);
    assert.match(TEMPLATES, /<h2 data-heading="Attributes">\{\{sr2eT "SR2E\.UI\.attributes"\}\}<\/h2>/);
    assert.ok((TEMPLATES.match(/data-heading="/g) ?? []).length > 200);
  });

  test('review #1: a heading filled from data (one per group) keeps its shown text, so each folds on its own', () => {
    assert.match(TEMPLATES, /<h3 data-help="magic">\{\{sr2eT "SR2E\.UI\.group3" name=name\}\}/);
    assert.doesNotMatch(TEMPLATES, /data-heading="[^"]*"\s*>\s*\{\{sr2eT "SR2E\.UI\.group3"/);
  });

  test('review #2 and #4: a dart\'s toxin head is built (no label kept from the card); the repaired parts keep one "and"', () => {
    assert.match(read('src', 'module', 'applications', 'chat.ts'), /from: toxFrom, label: undefined \}\);/);
    assert.match(INDEX, /tx\('SR2E\.Card\.Actor\.theParts', \{ parts: plan\.parts\.join\(', '\) \}\)/);
  });

  test('headingName prefers the id; the help, icons, folds and jumps use it', () => {
    const h: any = { dataset: { heading: 'Skills' } };
    assert.equal(headingName(h, () => 'Fertigkeiten'), 'Skills');
    assert.equal(headingName({ dataset: {} } as any, () => 'Fertigkeiten'), 'Fertigkeiten');
    for (const f of ['help.ts', 'interface.ts', 'sheettools.ts', 'adding.ts']) assert.match(read('src', 'module', 'applications', f), /headingName\(/, f);
  });

  test('GM-only controls and the edit pencils are marked, not found by their tooltip text', () => {
    assert.ok((TEMPLATES.match(/ data-sr2e-gm title=/g) ?? []).length >= 15);
    assert.match(read('src', 'module', 'applications', 'interface.ts'), /'\[data-sr2e-gm\], \[title\*="\(GM\)"\]'/);
    const css = read('public', 'style', 'sr2e.css');
    assert.doesNotMatch(css, /\[title="Edit"\]/);
    assert.match(css, /a\[data-action="editItem"\]\[data-sr2e-edit-pencil\]/);
  });
});

// v0.89.5: 20 keys (26 texts) left, each a clause after a bold part or a name (listed in REVIEW-v0.89.5.md); a new one fails here.
// v0.89.6: 10 keys (16 texts) left, each the run of text right after a bold part (the others were joined into whole texts).
const LEFT_FRAGMENTS = 16;
describe('v0.89.5 fragments, counts, lists and context keys', () => {
  test('counted nouns and lists follow the language', () => {
    assert.equal(tNoun(1, 'day'), '1 day');
    assert.equal(tNoun(3, 'box'), '3 boxes');
    assert.equal(tNoun(2, 'net success'), '2 net successes');
    assert.equal(tList(['a', 'b']), 'a and b');
    assert.equal(tList(['a', '', 'b', 'c']), 'a, b, and c');
    assert.doesNotMatch(INDEX, /join\(' and '\)/);
    assert.doesNotMatch(INDEX, /replace\(\/successs\/g/);
  });

  test('no text in the Notify, Dialog or Card groups is a bare word or clause of another sentence', () => {
    const bad: string[] = [];
    for (const [k, v] of Object.entries(KEYS)) {
      if (!/^SR2E\.(Notify|Dialog|Card)\./.test(k) || /^SR2E\.Card\.Mod\./.test(k)) continue;
      const texts = typeof v === 'string' ? [v] : [v.one, v.other].filter(Boolean);
      for (const t of texts as string[]) {
        if (!(t.startsWith(' ') || t.endsWith(' '))) continue;
        const s = t.trim();
        // allowed: a note in brackets, a sentence of its own, a value with a sign, a separator
        if (/^[\(\[].*[\)\]]\.?$/.test(s) || /^[—+·×−]/.test(s) || (/^[A-Z{]/.test(s) && /[.!?:)]$/.test(s))) continue;
        bad.push(`${k}: ${JSON.stringify(t)}`);
      }
    }
    // The few left are clauses that follow a name or a bold part and read on their own; listed so a new one is noticed.
    assert.ok(bad.length <= LEFT_FRAGMENTS, `${bad.length}:\n${bad.join("\n")}`);
  });

  test('context keys repeat an English word on purpose and are used', () => {
    for (const k of ['SR2E.UI.attack__heading', 'SR2E.UI.track__monitor', 'SR2E.Dialog.Sheet.fire__hazard', 'SR2E.Dialog.Sheet.track2__monitor', 'SR2E.Dialog.Sheet.repair__tnBase', 'SR2E.Dialog.Sheet.spell__pool']) {
      assert.ok(k in KEYS, k);
      assert.ok(TEMPLATES.includes(`"${k}"`) || ALL.some((x) => x.src.includes(`'${k}'`)), `${k} is used`);
    }
  });

  test('the translators\' list of pieces is up to date', () => {
    const out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'i18n-context.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
    assert.match(out, /context: ok/);
  });
});
