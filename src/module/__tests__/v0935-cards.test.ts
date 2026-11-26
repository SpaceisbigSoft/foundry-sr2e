/**
 * v0.93.5 ("interface polish", agent A): cards and roll dialogs. The pure parts (rules/cards935.ts), the dialog
 * helpers (applications/dialogs935.ts) and their wiring in the cards (documents/index.ts, applications/chat.ts).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  nextStepKeys, stepKey, doneLabelKey, attackWaitState, attackWaitKey, fireRowShown, senseGroupOf, groupSenseRows,
  stripSenseLead, STEP_ACTIONS, type StepRow,
} from '../rules/cards935.ts';
import { senseChecksHtml, FIRE_MODES_ATTR } from '../applications/dialogs935.ts';
import { RULES } from '../rules/index.ts';
import { CORE_V923 } from '../rules/config923/core.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
/** The new strings, before they are merged into lang/en.json (then that file has them). */
const DRAFT = '/home/claude/work/strings-A.json';
const draft = (): Record<string, string> => (existsSync(DRAFT) ? JSON.parse(readFileSync(DRAFT, 'utf8')) : {});
const flat = (o: any, pre = ''): Record<string, string> => Object.entries(o).reduce((acc: Record<string, string>, [k, v]) => (
  typeof v === 'object' && v && !Array.isArray(v) && !('one' in (v as any) && 'other' in (v as any)) ? { ...acc, ...flat(v, `${pre}${k}.`) } : { ...acc, [`${pre}${k}`]: v as string }), {});
const KEYS = (): Record<string, string> => ({ ...flat(JSON.parse(read('public', 'lang', 'en.json'))), ...draft() });

const row = (action: StepRow['action'], index: number, o: Partial<StepRow> = {}): StepRow => ({ action, index, done: false, mine: false, playerOwned: false, ...o });

describe('v0.93.5 the next step on a card (plan item 45)', () => {
  test('a player: their own target\'s rows not yet done, nobody else\'s', () => {
    const rows = [row('defend', 0, { mine: true, playerOwned: true }), row('defend', 1, { playerOwned: false }), row('defend', 2, { mine: true, playerOwned: true, done: true })];
    assert.deepEqual([...nextStepKeys(rows, { isGM: false })], ['defend:0']);
  });
  test('a player never gets the Apply (GM) step', () => {
    assert.deepEqual([...nextStepKeys([], { isGM: false, gmApplies: ['applyHeal'] })], []);
  });
  test('the GM: an NPC\'s rows and the pending applies; a player\'s row is the player\'s', () => {
    // A GM owns every actor (mine true), but a player-owned target is that player's to roll.
    const rows = [row('defend', 0, { mine: true, playerOwned: true }), row('resist', 1, { mine: true }), row('resistSpell', 0, { mine: true, done: true })];
    assert.deepEqual([...nextStepKeys(rows, { isGM: true, gmApplies: ['applySite'] })].sort(), ['applySite', 'resist:1']);
  });
  test('a gone target (no actor) is the GM\'s to settle', () => {
    assert.deepEqual([...nextStepKeys([row('resist', 0)], { isGM: true })], ['resist:0']);
    assert.deepEqual([...nextStepKeys([row('resist', 0)], { isGM: false })], []);
  });
  test('keys and the done line\'s strings', () => {
    assert.equal(stepKey('defend', 3), 'defend:3');
    assert.equal(stepKey('applyHeal'), 'applyHeal');
    assert.deepEqual([...STEP_ACTIONS], ['defend', 'resist', 'resistSpell']);
    assert.equal(doneLabelKey('defend'), 'SR2E.Card.Next.defended');
    assert.equal(doneLabelKey('resist'), 'SR2E.Card.Next.resisted');
    assert.equal(doneLabelKey('resistSpell'), 'SR2E.Card.Next.resisted');
    const k = KEYS();
    for (const key of ['SR2E.Card.Next.defended', 'SR2E.Card.Next.resisted']) assert.match(String(k[key]), /\{name\}/, key);
  });
});

describe('v0.93.5 the attack card\'s banner (visual review theme 5)', () => {
  test('its state from the Defend rows', () => {
    assert.equal(attackWaitState(1, 0), 'awaiting');
    assert.equal(attackWaitState(3, 1), 'partial');
    assert.equal(attackWaitState(3, 3), 'defended');
    assert.equal(attackWaitState(2, 9), 'defended', 'clamped');
    assert.equal(attackWaitState(0, 0), 'awaiting');
    assert.equal(attackWaitState(NaN, -1), 'awaiting');
  });
  test('its words, with and without successes; every key has its placeholders', () => {
    assert.equal(attackWaitKey('awaiting', 4), 'SR2E.Card.Outcome.hitAwaiting');
    assert.equal(attackWaitKey('awaiting', 0), 'SR2E.Card.Outcome.zeroAwaiting');
    assert.equal(attackWaitKey('partial', 2), 'SR2E.Card.Outcome.hitPartial');
    assert.equal(attackWaitKey('defended', 0), 'SR2E.Card.Outcome.zeroDefended');
    const k = KEYS();
    for (const s of ['awaiting', 'partial', 'defended'] as const) for (const n of [0, 3]) {
      const key = attackWaitKey(s, n);
      assert.ok(typeof k[key] === 'string', key);
      if (n > 0) assert.match(k[key]!, /\{successes\}/, key);
      if (s === 'partial') assert.match(k[key]!, /\{done\}.*\{total\}/, key);
    }
  });
  test('the card builds it filled with words while the Defend waits; the viewing client updates it', () => {
    const idx = read('src', 'module', 'documents', 'index.ts');
    const body = idx.slice(idx.indexOf('function outcomeBanner('), idx.indexOf('export function withRollMode('));
    assert.match(body, /html\.includes\('data-sr2e-action="defend"'\)/);
    assert.match(body, /sr2e-banner sr2e-banner-awaiting" data-sr2e-wait="awaiting"/);
    const chat = read('src', 'module', 'applications', 'chat.ts');
    assert.ok(chat.includes("const banner = html.querySelector<HTMLElement>('.sr2e-banner.sr2e-banner-awaiting');"));
    assert.ok(chat.includes('banner.textContent = tKey(attackWaitKey(state, successes)'), 'set as text, never HTML');
  });
  test('the Defend rows and the next step are marked on every render and on a target\'s cardRolls', () => {
    const chat = read('src', 'module', 'applications', 'chat.ts');
    assert.ok(chat.includes('export function markNextSteps(message: any, html: ParentNode): void'));
    assert.ok(chat.includes('  markNextSteps(message, html);\n}'), 'markUsedButtons ends with it');
    assert.ok(chat.includes('/:(defended|resisted|spellResisted):\\d+$/'));
    // Trusted facts only: the row's target actor's ownership, never the button's text.
    const fn = chat.slice(chat.indexOf('export function markNextSteps('), chat.indexOf('\n}\n', chat.indexOf('export function markNextSteps(')));
    assert.match(fn, /mine: Boolean\(target\?\.isOwner\), playerOwned: Boolean\(target\?\.hasPlayerOwner\)/);
    assert.doesNotMatch(fn, /textContent\?*\.(includes|startsWith|match)/);
  });
});

describe('v0.93.5 the verdict once (banner, then one comparison line)', () => {
  test('the fold\'s line leads with the count; the big count stays for contests', () => {
    const idx = read('src', 'module', 'documents', 'index.ts');
    assert.ok(idx.includes('<span class="sr2e-sum-out">${outcome} · </span>${tx(\'SR2E.Card.Actor.diceVsTn\''));
    assert.ok(idx.includes('<div class="sr2e-count"><b>${r.successes}</b>'));
    const css = read('public', 'style', 'sr2e.css');
    assert.ok(css.includes('li.chat-message.sr2e-card .sr2e-banner ~ .sr2e-roll > .sr2e-count { display: none; }'));
    assert.ok(css.includes('.sr2e-banner ~ .sr2e-roll details.sr2e-fold .sr2e-sum-out { display: inline; }'));
  });
  test('the next step\'s pulse stops for reduced motion', () => {
    const css = read('public', 'style', 'sr2e.css');
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ :where\(li\.chat-message\.sr2e-card\) button\.sr2e-next \{ animation: none; \} \}/);
  });
});

describe('v0.93.5 firing-mode-only rows (the attack window)', () => {
  test('FA rows on FA only; unmarked rows always', () => {
    assert.equal(fireRowShown('FA', 'FA'), true);
    assert.equal(fireRowShown('FA', 'SA'), false);
    assert.equal(fireRowShown('FA', 'BF'), false);
    assert.equal(fireRowShown('BF', 'BF'), true);
    assert.equal(fireRowShown('SA SS', 'ss'), true);
    assert.equal(fireRowShown('SA,BF', 'BF'), true);
    assert.equal(fireRowShown('', 'SA'), true);
    assert.equal(fireRowShown(null, null), true);
    assert.equal(fireRowShown('FA', null), false);
  });
  test('the attribute the dialogs mark rows with', () => {
    assert.equal(FIRE_MODES_ATTR, 'data-sr2e-fire-modes');
  });
});

describe('v0.93.5 the Perception modifiers by sense (Sneak, Perceive)', () => {
  const rows = [...RULES.STREET.perception, ...CORE_V923.senseRows];
  test('every book row has its sense, by id', () => {
    for (const r of rows) assert.notEqual(senseGroupOf(r.id), 'other', r.id);
    assert.equal(senseGroupOf('distracted'), 'observer');
    assert.equal(senseGroupOf('grenade'), 'sound');
    assert.equal(senseGroupOf('otherOdors'), 'smell');
    assert.equal(senseGroupOf('gloves'), 'touch');
    assert.equal(senseGroupOf('hasCold'), 'taste');
    assert.equal(senseGroupOf('constructor'), 'other');
    // The labels agree with the ids' groups (the book's rows lead with their sense).
    for (const r of CORE_V923.senseRows) if (/^(Sound|Smell|Touch|Taste):/.test(r.label)) assert.equal(senseGroupOf(r.id), r.label.split(':')[0]!.toLowerCase(), r.id);
  });
  test('groups in order, observer open, the rare ones folded unless ticked', () => {
    const g = groupSenseRows(rows);
    assert.deepEqual(g.map((x) => x.group), ['observer', 'sound', 'smell', 'touch', 'taste']);
    assert.equal(g.reduce((n, x) => n + x.rows.length, 0), rows.length, 'no row lost');
    assert.deepEqual(g.map((x) => x.open), [true, false, false, false, false]);
    const t = groupSenseRows(rows, new Set(['gloves']));
    assert.equal(t.find((x) => x.group === 'touch')!.open, true);
    assert.equal(t.find((x) => x.group === 'sound')!.open, false);
    assert.deepEqual(groupSenseRows(RULES.STREET.perception).map((x) => x.group), ['observer'], 'the old way: one group');
  });
  test('a label loses only its group\'s lead word', () => {
    assert.equal(stripSenseLead('Sound: burst fire'), 'burst fire');
    assert.equal(stripSenseLead('Sound is rooms away'), 'Sound is rooms away');
    assert.equal(stripSenseLead('Observer distracted'), 'Observer distracted');
  });
  test('the boxes keep tableChecks\'s names (checkedIds reads them), escaped, values signed', () => {
    const html = senseChecksHtml(rows, 'per', new Set(['crowd']));
    for (const r of rows) assert.ok(html.includes(`name="per-${r.id}"`), r.id);
    assert.ok(html.includes('name="per-crowd" checked'));
    assert.ok(html.includes('burst fire (-4)'));
    assert.ok(html.includes('Observer distracted (+2)'));
    assert.equal((html.match(/<details /g) ?? []).length, 4);
    assert.ok(!html.includes('<details class="sr2e-sense-group" data-sense="observer"'));
    const evil = senseChecksHtml([{ id: 'x"><img src=x>', label: '<b>bad</b>', value: 1 }], 'per');
    assert.ok(!evil.includes('<img') && !evil.includes('<b>bad'));
  });
});
