/**
 * v0.87.0: the printable character sheet (rules/printsheet.ts, applications/print.ts) and "Report a bug"
 * (rules/bugreport.ts, applications/bugreport.ts).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { printHtml, printTitle, printTrack, safeBase, type PrintSheet } from '../rules/printsheet.ts';
import { bugReportText, entryText, isOurError, pushEntry, BUG_ENTRY_MAX, type BugFacts } from '../rules/bugreport.ts';
import { monitorView } from '../rules/look.ts';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

function sheet(over: Partial<PrintSheet> = {}): PrintSheet {
  const cm = monitorView({ physical: 3, stun: 1 }, 5, { overflow: true });
  return {
    name: 'Jane <b>Doe</b>',
    kind: 'Character · Elf',
    facts: [['Player', 'Pat'], ['Lifestyle', ''], ['Nuyen', '1,000¥']],
    attributes: [{ label: 'Body', total: 5, base: 4 }, { label: 'Quickness', total: 6, base: 6 }],
    derived: [['Essence', '5.8'], ['Magic', ''], ['Initiative', '5 + 1d6']],
    monitor: { physical: printTrack(cm.physical, 'Physical')!, stun: printTrack(cm.stun, 'Stun')!, overflow: printTrack(cm.overflow, 'Overflow'), woundNote: 'Wound modifier: +1 TN' },
    tables: [
      { title: 'Active skills', columns: ['Skill', 'Rating', 'Specialization', 'Attribute'], rows: [['Firearms', '5', 'Pistols (7)', 'Quickness']] },
      { title: 'Spells', columns: ['Spell'], rows: [] },
      { title: 'Weapons', columns: ['Weapon', 'Damage', 'Conceal', 'Mode', 'Ammo', 'Range / reach'], rows: [['"Ares" <Predator>', '9M', '5', 'SA', '15/15', '0-5/20/40/60 m']] },
    ],
    notes: [{ title: 'Biography', html: '<p>Born in the <em>sprawl</em>.</p>' }, { title: 'Notes', html: '<p> </p>' }],
    footer: 'sr2e 0.87.0',
    ...over,
  };
}

describe('v0.87.0 the printable sheet (pure)', () => {
  test('a whole page: escaped values, the notes as cleaned HTML, no script, a no-script policy', () => {
    const html = printHtml(sheet());
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(html.includes('<h1>Jane &lt;b&gt;Doe&lt;/b&gt;</h1>'));
    assert.ok(html.includes('&quot;Ares&quot; &lt;Predator&gt;'));
    assert.ok(!/<script/i.test(html));
    assert.ok(html.includes("Content-Security-Policy\" content=\"default-src 'none'"));
    assert.ok(html.includes('<em>sprawl</em>'), 'the cleaned notes go in as HTML');
    assert.ok(!html.includes('<h2>Notes</h2>'), 'an empty note is left out');
    assert.ok(!html.includes('<h2>Spells</h2>'), 'an empty table is left out');
    assert.ok(!html.includes('Lifestyle:'), 'an empty fact is left out');
    assert.ok(html.includes('5 <small>(4)</small>') && !html.includes('6 <small>'), 'the base only where it differs');
    assert.ok(html.includes('<section class="wide"><h2>Weapons</h2>'), 'a table with many columns spans the page');
    assert.ok(html.includes('<td class="n">5</td>'), 'numbers are right-aligned');
    // An all-blank column is text, not a number column.
    const blankCol = printHtml(sheet({ tables: [{ title: 'Language skills', columns: ['Skill', 'Rating', 'Specialization'], rows: [['English', '4', '']] }] }));
    assert.ok(blankCol.includes('<th>Specialization</th>') && blankCol.includes('<th class="n">Rating</th>'));
  });

  test('the monitor: filled boxes, the wound note; a blank sheet has none', () => {
    const html = printHtml(sheet());
    assert.equal((html.match(/class="box filled/g) ?? []).length, 4, '3 Physical + 1 Stun');
    assert.ok(html.includes('Physical (3 / 10)') && html.includes('Wound modifier: +1 TN'));
    assert.ok(html.includes('Overflow ('));
    const blank = printHtml(sheet(), { blank: true });
    assert.equal((blank.match(/class="box filled/g) ?? []).length, 0);
    assert.ok(blank.includes('Physical (10)') && !blank.includes('Wound modifier'));
  });

  test('options: no notes; the title', () => {
    assert.ok(!printHtml(sheet(), { noNotes: true }).includes('sprawl'));
    assert.ok(printHtml(sheet(), { title: 'X & Y' }).includes('<title>X &amp; Y</title>'));
    assert.equal(printTitle('Jane: "Doe"/Smith'), 'Jane Doe Smith (SR2e)');
    assert.equal(printTitle(''), 'Character (SR2e)');
  });

  test('printTrack reads the sheet\'s track and overflow views', () => {
    const cm = monitorView({ physical: 10, stun: 0 }, 4, { overflow: true });
    const p = printTrack(cm.physical, 'Physical')!;
    assert.equal(p.boxes, 10);
    assert.equal(p.filled, 10);
    assert.ok(p.groups.length >= 3);
    const o = printTrack(cm.overflow, 'Overflow')!;
    assert.equal(o.label, 'Overflow');
    assert.equal(o.groups.length, 1);
    assert.ok(o.boxes >= 4);
    assert.equal(printTrack(null), null);
  });
});

describe('v0.87.0 Report a bug (pure)', () => {
  const facts: BugFacts = {
    system: '0.87.0', foundry: '14.350 (generation 14)', browser: 'TestAgent/1', role: 'GM', rulesSource: 'urr',
    houseRules: { 'COMBAT.recoil': 2, 'MAGIC.drain': { x: 'a'.repeat(300) } },
    modules: [{ id: 'dice-so-nice', version: '5.0' }],
    errors: [{ at: '12:00:00', text: 'sr2e | boom ``` here' }],
    settings: ['When attacked: dialog'],
  };
  test('the report: versions, rules, modules, settings, errors, the warning; no fence breaks', () => {
    const t = bugReportText(facts);
    for (const want of ['- sr2e: 0.87.0', '- Foundry VTT: 14.350 (generation 14)', '- Rules source: urr', '- House rules changed: 2', '`COMBAT.recoil` = 2', '- Active modules: 1', '  - dice-so-nice 5.0', '- Reporting as: GM', '  - When attacked: dialog', '[12:00:00] sr2e | boom \'\'\' here', 'Nothing'.slice(0, 0), 'Check it before posting']) assert.ok(t.includes(want), want);
    assert.equal((t.match(/```/g) ?? []).length, 2, 'only the report\'s own fence');
    assert.ok(t.includes('…'), 'a long house-rule value is shortened');
    const none = bugReportText({ ...facts, houseRules: {}, modules: [], errors: [], settings: [] });
    assert.ok(none.includes('- House rules changed: none') && none.includes('- Active modules: none') && none.includes('(none since this page was loaded)'));
  });
  test('which console entries are ours, and how they are written', () => {
    assert.equal(isOurError('sr2e | Initializing'), true);
    assert.equal(isOurError('at foo (http://localhost:30000/systems/sr2e/index.mjs:1:2)'), true);
    assert.equal(isOurError('Foundry VTT | something'), false);
    assert.equal(isOurError('sr2eX'), false);
    const err = new Error('bad');
    assert.match(entryText(['sr2e | failed', err]), /^sr2e \| failed Error: bad/);
    // Review R5/R6: objects are never stringified (no deep copies, no getters, no world data kept by accident).
    assert.equal(entryText(['a', { b: 1 }, [1], 2, null]), 'a [object] [array] 2 null');
    let touched = false;
    entryText([{ get x() { touched = true; return 1; } }]);
    assert.equal(touched, false);
    assert.equal(isOurError('Some module | logged {"flags":{"sr2e":{}}}'), false);
    assert.equal(isOurError('warning: sr2e | hotkey defendNewest'), true);
    assert.equal(entryText(['x'.repeat(BUG_ENTRY_MAX + 50)]).length, BUG_ENTRY_MAX);
  });
});

describe('v0.87.0 review fixes', () => {
  test('the kept log: repeats count up, at most the cap', () => {
    const log: Array<{ at: string; text: string }> = [];
    pushEntry(log, 'sr2e | a', '1');
    pushEntry(log, 'sr2e | a', '2');
    pushEntry(log, 'sr2e | a', '3');
    assert.deepEqual(log, [{ at: '3', text: 'sr2e | a (×3)' }]);
    for (let i = 0; i < 30; i++) pushEntry(log, `sr2e | e${i}`, 'x', 5);
    assert.equal(log.length, 5);
    assert.equal(log[4]!.text, 'sr2e | e29');
    pushEntry(log, '', 'x');
    assert.equal(log.length, 5);
  });
  test('the page base address: only a plain http(s) address', () => {
    assert.equal(safeBase('http://localhost:30000/'), 'http://localhost:30000/');
    assert.equal(safeBase('https://vtt.example.com/game/'), 'https://vtt.example.com/game/');
    for (const bad of ['javascript:alert(1)//', 'http://x/"><script>', 'http://x', '', 'data:text/html,x/']) assert.equal(safeBase(bad), '', bad);
    assert.ok(printHtml(sheet(), { base: 'http://localhost:30000/' }).includes('<base href="http://localhost:30000/">'));
    assert.ok(!printHtml(sheet(), { base: 'javascript:x/' }).includes('<base'));
  });
  test('the overflow count comes from its boxes', () => {
    const cm = monitorView({ physical: 10, stun: 0 }, 6, { overflow: true });
    const o = printTrack(cm.overflow, 'Overflow')!;
    assert.equal(o.boxes, (cm.overflow as any).boxes.length);
  });
  test('print and report glue: secrets left out, a file to save, the button only for viewers, the log can be turned off', () => {
    const src = read('src', 'module', 'applications', 'print.ts');
    assert.ok(src.includes('rich[k] = opts.secrets ? v : withoutSecrets(v);'));
    assert.ok(src.includes("action: 'file', label: tx('SR2E.Dialog.Print.saveAsAFile')"));
    assert.ok(src.includes("if (!doc.testUserPermission?.((game as any).user, 'OBSERVER')) return false;"));
    assert.ok(src.includes('const plain = gather(false);'), 'the data is gathered before the click');
    const rep = read('src', 'module', 'applications', 'bugreport.ts');
    assert.ok(rep.includes("export const KEEP_ERRORS_KEY = 'keepErrors';") && rep.includes('if (capturing || keepingOff()) return;'));
    assert.ok(rep.includes('if (inKeep || !text || !isOurError(text)) return;'));
  });
});

describe('v0.87.0 wiring', () => {
  test('print: a sandbox without scripts, the cleaned notes, the header button, the API', () => {
    const src = read('src', 'module', 'applications', 'print.ts');
    assert.ok(src.includes("frame.setAttribute('sandbox', 'allow-modals allow-same-origin')"));
    assert.ok(!/allow-scripts/.test(src));
    assert.ok(src.includes('const enriched = await enrichFields(actor);'));
    assert.ok(src.includes("testUserPermission?.((game as any).user, 'OBSERVER')"));
    const sys = read('src', 'module', 'sr2e-system.ts');
    assert.ok(sys.includes('registerPrint();') && sys.includes('registerBugReport();') && sys.includes('printActor, printPage, bugReport, openBugReport,'));
  });
  test('report: kept errors only, nothing sent, reachable from the guide and the settings', () => {
    const src = read('src', 'module', 'applications', 'bugreport.ts');
    assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|socket\.emit/.test(src), 'nothing is sent anywhere');
    assert.ok(src.includes("registerMenu(SYSTEM.id, 'bugReportMenu'") && src.includes('restricted: false'));
    assert.ok(read('public', 'templates', 'help.hbs').includes('data-action="bugReport"'));
    assert.ok(read('src', 'module', 'rules', 'guide.ts').includes("topic('printing', "));
    assert.equal(JSON.parse(read('public', 'lang', 'en.json')).SR2E.Guide.Topic.printing.title, 'Printing a sheet and reporting a bug');
  });
});
