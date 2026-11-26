/**
 * v0.93.4 ("readability", report item 15): sizes and the 1024×768 fit. The pure parts (rules/fit0934.ts) and the
 * wiring in the templates, the tracker, the wizard and the stylesheet.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  wizardStepMarks, STEP_NEEDS, priorityChecklist, contactsSentence, trackerPoolParts, trackerWoundChip, woundLetterOf,
  fitWindowSize, FIT_HEIGHT_CAP,
} from '../rules/fit0934.ts';
import { WIZARD_STEPS } from '../rules/advancement.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const tpl = (f: string) => read('public', 'templates', f);
// v0.93.4: the fit section of sr2e.css (and the tracker part it adds before the look section).
const css = () => {
  const all = read('public', 'style', 'sr2e.css');
  const i = all.indexOf('sizes and the 1024×768 fit'), j = all.indexOf('v0.93.4: Play/Edit finished', i);
  const t = all.indexOf("the tracker's pool words, wound chip and 24 px buttons"), u = all.indexOf('/* v0.', t + 10);
  return all.slice(i, j) + '\n' + all.slice(t, u);
};
/** The new strings, before they are merged into lang/en.json (then that file has them and this adds nothing). */
const NEW_LANG = '/home/claude/work/agent-fit-lang.json';
const newLang = (): Record<string, string> => (existsSync(NEW_LANG) ? JSON.parse(readFileSync(NEW_LANG, 'utf8')) : {});
const balanced = (s: string) => {
  const opens = (s.match(/\{\{#(if|each|unless)\b/g) ?? []).length;
  const closes = (s.match(/\{\{\/(if|each|unless)\}\}/g) ?? []).length;
  return opens === closes;
};

describe('v0.93.4 the creation wizard', () => {
  test('step marks: every step but the first waits for the priorities, even where its own rows pass', () => {
    const states = { priorities: 'bad', resources: 'ok', contacts: 'ok', metatype: '' } as const;
    const m = wizardStepMarks(states, { priorities: false });
    assert.equal(m.priorities, 'bad');
    for (const s of ['metatype', 'attributes', 'magic', 'skills', 'resources', 'contacts', 'review'] as const) assert.equal(m[s], 'wait', s);
    const done = wizardStepMarks({ priorities: 'ok', resources: 'ok', contacts: 'ok', skills: 'bad' }, { priorities: true });
    assert.deepEqual([done.priorities, done.resources, done.contacts, done.skills, done.metatype], ['ok', 'ok', 'ok', 'bad', '']);
    // Without the override the priorities' own state decides.
    assert.equal(wizardStepMarks({ priorities: 'ok', contacts: 'ok' }).contacts, 'ok');
    assert.equal(wizardStepMarks({ contacts: 'ok' }).contacts, 'wait');
    assert.deepEqual(Object.keys(STEP_NEEDS).sort(), WIZARD_STEPS.map((s) => s.id).sort());
  });

  test('the priorities checklist and the contacts sentence', () => {
    const rows = priorityChecklist({ race: 'B', magic: null, attributes: 'x' as any }, (k) => k.toUpperCase());
    assert.deepEqual(rows.map((r) => [r.key, r.label, r.letter, r.set]), [
      ['race', 'RACE', 'B', true], ['magic', 'MAGIC', '', false], ['attributes', 'ATTRIBUTES', '', false], ['skills', 'SKILLS', '', false], ['resources', 'RESOURCES', '', false],
    ]);
    const lang = newLang();
    const en = (globalThis as any).__SR2E_EN__ as Record<string, string>;
    const had = { ...en };
    Object.assign(en, lang);
    try {
      assert.equal(contactsSentence(0, 2), 'Contacts: 0 chosen; the first 2 are free.');
      assert.equal(contactsSentence(3, 1), 'Contacts: 3 chosen; the first one is free.');
      assert.equal(contactsSentence(1, 0), 'Contacts: 1 chosen; each one costs nuyen.');
      assert.equal(en['SR2E.Tables.wizardSteps.priorities.hint'], WIZARD_STEPS[0]!.hint);
      assert.equal(WIZARD_STEPS[0]!.hint, 'Pick one letter for each row; use each letter A–E once.');
    } finally { for (const k of Object.keys(lang)) { if (k in had) en[k] = had[k]!; else delete en[k]; } }
  });

  test('the template: three step states, one priority grid with the letter in every cell, the totals checklist', () => {
    const w = tpl('creation-wizard.hbs');
    assert.ok(balanced(w));
    assert.match(w, /sr2e-wiz-\{\{state\}\}/);
    assert.match(w, /\(eq state "wait"\)/);
    assert.ok(!w.includes('<table class="sr2e-wiz-priorities">'), 'the old table is gone');
    assert.ok(w.includes('class="sr2e-wiz-prow" role="radiogroup"'));
    assert.match(w, /<input type="radio" name="wiz-\{\{\.\.\/key\}\}" value="\{\{letter\}\}" data-wiz="priority" data-column="\{\{\.\.\/key\}\}" \{\{checked checked\}\}> <b class="sr2e-wiz-pletter">\{\{letter\}\}<\/b>/);
    assert.ok(w.includes('{{#each @root.prioList}}') && w.includes('{{@root.contactsLine}}'));
    assert.ok(!/>[A-Za-z][a-z]+ [a-z]+</.test(w.replace(/\{\{[^}]*\}\}/g, '')), 'no bare English between tags');
    const src = read('src', 'module', 'applications', 'creation.ts');
    assert.ok(src.includes('wizardStepMarks(stepStates(chk.rows), { priorities: prioritiesComplete(pr) })'));
    assert.ok(src.includes('prioList: priorityChecklist(') && src.includes('contactsLine: contactsSentence('));
    assert.ok(src.includes('fitWindowSize('));
  });
});

describe('v0.93.4 the combat tracker', () => {
  test('the pools in short words, only those the combatant has', () => {
    const en = (globalThis as any).__SR2E_EN__ as Record<string, string>;
    const lang = newLang();
    const had = { ...en };
    Object.assign(en, lang);
    try {
      assert.deepEqual(trackerPoolParts({ combatPool: 7, combatPoolLeft: 7, controlPool: 7, controlPoolLeft: 0, karmaPoolLeft: 3 }, 3), ['Combat 7/7', 'Control 0/7', 'Karma 3/3']);
      assert.deepEqual(trackerPoolParts({ hackingPool: 4, hackingPoolLeft: 4 }, 0), ['Hacking 4/4']);
      assert.deepEqual(trackerPoolParts(null, undefined), []);
      // The wound chip
      assert.deepEqual(trackerWoundChip('L', 1), { level: 'L', text: 'Light +1', title: 'Light wound: +1 to every target number' });
      assert.deepEqual(trackerWoundChip('d', 0), { level: 'D', text: 'Deadly', title: 'Deadly wound' });
      assert.equal(trackerWoundChip('X', 1), null);
      assert.equal(trackerWoundChip(null), null);
    } finally { for (const k of Object.keys(lang)) { if (k in had) en[k] = had[k]!; else delete en[k]; } }
    assert.equal(woundLetterOf('systems/shadowrun2e_unified/icons/wound-l.svg'), 'L');
    assert.equal(woundLetterOf('/systems/x/icons/wound-S.svg?v=2'), 'S');
    assert.equal(woundLetterOf('icons/svg/skull.svg'), null);
    assert.equal(woundLetterOf(undefined), null);
  });

  test('the tracker uses them: no letter codes left, the chip text set as text and its tooltip escaped', () => {
    const src = read('src', 'module', 'applications', 'tokens.ts');
    assert.ok(!/`C \$\{d\.combatPoolLeft\}|`Ct \$\{/.test(src), 'no "C 7/7" or "Ct 0/7" codes');
    assert.ok(src.includes('trackerPoolParts(d, a.system?.karma?.pool)'));
    const fn = src.slice(src.indexOf('function woundChipFor'), src.indexOf('function arrangeTracker'));
    assert.ok(fn.includes('el.textContent = chip.text') && fn.includes("el.dataset['tooltip'] = escHtml(chip.title)") && fn.includes("img.dataset['tooltip'] = escHtml(chip.title)"));
    assert.ok(!fn.includes('innerHTML'));
  });
});

describe('v0.93.4 window sizes', () => {
  test('a window starts at most 80% of the screen tall (and under the cap), and fits its width', () => {
    assert.deepEqual(fitWindowSize({ width: 680, height: 760 }, { width: 1024, height: 768 }), { width: 680, height: 614 });
    assert.deepEqual(fitWindowSize({ width: 760, height: 720 }, { width: 1775, height: 1258 }), { width: 760, height: 720 });
    assert.equal(fitWindowSize({ height: 1400 }, { height: 2160 }).height, FIT_HEIGHT_CAP);
    assert.deepEqual(fitWindowSize({ width: 1200, height: 'auto' }, { width: 1024, height: 768 }), { width: 984, height: 'auto' });
    assert.deepEqual(fitWindowSize({ width: 600 }, {}), { width: 600 });
    assert.equal(fitWindowSize({ height: 700 }, { height: 300 }).height, 320, 'never below 320 px');
  });
});

describe('v0.93.4 the strip, the GM panel and the stylesheet', () => {
  test('the strip shows the monitor as text; the boxes stay on the Main tab', () => {
    const s = tpl('status-strip.hbs');
    assert.ok(balanced(s));
    assert.ok(!s.includes('templates/monitor-mini.hbs"}}'));
    assert.match(s, /\{\{#each cm\.tracks\}\}<span class="sr2e-strip-item sr2e-strip-track sr2e-strip-\{\{track\}\}/);
    assert.ok(s.includes('<b>{{filled}}</b><i>/{{boxes}}</i>{{#if reached}} <em>({{reached}})</em>{{/if}}'));
    assert.ok(s.includes('{{#unless cm.overflow.idle}}'));
    assert.ok(read('public', 'templates', 'actor-character-sheet.hbs').includes('{{> "systems/shadowrun2e_unified/templates/monitor.hbs"}}'));
  });

  test('the GM panel: − / + as 24 px buttons with the same actions', () => {
    const g = tpl('gm-panel.hbs');
    assert.ok(balanced(g));
    assert.equal((g.match(/<a class="sr2e-gm-step" data-action="box" data-uuid="\{\{uuid\}\}" data-track="(physical|stun)" data-delta="-?1"/g) ?? []).length, 8);
    assert.equal((g.match(/class="sr2e-gm-track"/g) ?? []).length, 2);
    const c = css();
    assert.match(c, /a\.sr2e-gm-step[^{]*\{[^}]*min-width: 1\.5rem; height: 1\.5rem/);
    assert.match(c, /\.sr2e-cm-seg s \{ min-width: 0\.55rem; height: 0\.6rem; \}/);
    assert.match(c, /sr2e-cm-overflow\.idle \{ filter: none; opacity: 1; \}/);
  });

  test('targets of at least 24 px, small text at least about 12 px, sticky dialog footers, the compact top', () => {
    const c = css();
    assert.match(c, /button\.sr2e-step \{ width: 1\.5rem; min-height: 1\.5rem; \}/);
    assert.match(c, /\.sr2e-cm-steps > a \{ width: 1\.5rem; height: 1\.5rem; \}/);
    assert.match(c, /:has\(> i:only-child\) \{\s*display: inline-block; min-width: 1\.5rem; min-height: 1\.5rem;/);
    // Every font size in the file is at least 0.7rem (11.2 px); none in px.
    for (const m of c.matchAll(/font-size: ([\d.]+)rem/g)) assert.ok(Number(m[1]) >= 0.7, m[0]);
    assert.ok(!/font-size: [\d.]+px/.test(c));
    assert.match(c, /\.sr2e-tracker-pools \{ font-size: 0\.8rem;/);
    // Dialogs: the content scrolls, the footer doesn't.
    assert.match(c, /> \.dialog-content \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/);
    assert.match(c, /> \.form-footer \{ flex: 0 0 auto;/);
    assert.match(c, /\.window-content:has\(\.form-footer\) \{[^}]*max-height: calc\(100vh - 5rem\); overflow: hidden; \}/);
    // The compact top: the tab bar scrolls sideways, the find bar keeps Edit on its line.
    assert.match(c, /@media \(max-width: 1100px\), \(max-height: 820px\)/);
    assert.match(c, /\.sr2e-tabs \{ flex-wrap: nowrap; overflow-x: auto;/);
    assert.match(c, /\.sr2e-sheet-tools \{ flex-wrap: nowrap; \}/);
    assert.match(c, /@container sr2ewiz \(max-width: 40rem\)/);
    // Braces balance.
    assert.equal((c.match(/\{/g) ?? []).length, (c.match(/\}/g) ?? []).length);
  });
});
