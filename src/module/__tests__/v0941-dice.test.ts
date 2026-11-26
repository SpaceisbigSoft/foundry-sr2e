/**
 * v0.94.1: a Karma re-roll updates its own card (report item 24) and typed physical-dice results (report item 30).
 * The pure parts (rules/dice941.ts), the roll-window glue (applications/typed941.ts) and their wiring in the cards,
 * the chat handlers, the roll windows and the settings. The card flow itself runs in glue.test.ts ("v0.94.1 …").
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  cleanDie, cleanDice, withReplaced, rerollInPlace, staleFlagKeys, typedDiceMode, mayTypeDice, clampTyped, typedResult, typedFor, readTyped,
  MAX_REPLACED_DICE, TYPED_WAIT_MS, type InPlaceFacts,
} from '../rules/dice941.ts';
import type { DieResult } from '../rules/dice.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const src = (...p: string[]) => read('src', 'module', ...p);
/** The new strings, until the lead merges them into lang/en.json (then that file has them and this adds nothing). */
const DRAFT = join(ROOT, 'i18n-drafts', 'reroll-typed.json');
const draft = (): Record<string, string> => (existsSync(DRAFT) ? JSON.parse(readFileSync(DRAFT, 'utf8')) : {});

before(() => {
  const en = (globalThis as any).__SR2E_EN__ ?? ((globalThis as any).__SR2E_EN__ = {});
  for (const [k, v] of Object.entries(draft())) if (!(k in en)) en[k] = v;
});

const die = (f: number[], success: boolean, o: Partial<DieResult> = {}): DieResult => ({ faces: f, total: f.reduce((a, b) => a + b, 0), success, ...o });
const facts = (o: Partial<InPlaceFacts> = {}): InPlaceFacts => ({ setting: true, hasMessage: true, sameTest: true, newFormat: true, superseded: false, canWrite: true, ...o });

describe('v0.94.1 re-roll in place: the pure rules (report item 24)', () => {
  test('a die from a card\'s flags: numbers and marks only, faces 0..6, the total summed again', () => {
    assert.deepEqual(cleanDie({ faces: ['6', 3], total: 99, success: 1, pool: true, poolKind: 'spell', karma: true }), { faces: [6, 3], total: 9, success: true, pool: true, poolKind: 'spell', karma: true });
    assert.deepEqual(cleanDie({ faces: [9, -2], total: 0, success: false }), { faces: [6, 0], total: 6, success: false });
    assert.equal(cleanDie({ faces: [] }), null);
    assert.equal(cleanDie('<b>'), null);
    assert.equal(cleanDie({ faces: [2], poolKind: '<img onerror>' })!.poolKind, undefined);
  });

  test('a list is cleaned and capped, the newest kept', () => {
    const many = Array.from({ length: MAX_REPLACED_DICE + 5 }, (_v, i) => die([1 + (i % 6)], false));
    const out = cleanDice(many);
    assert.equal(out.length, MAX_REPLACED_DICE);
    assert.deepEqual(out.at(-1), cleanDie(many.at(-1)));
    assert.deepEqual(cleanDice('nope'), []);
  });

  test('a re-roll replaces the failed dice, added to those replaced before, with their colours', () => {
    const now = [die([5], true), die([2], false, { pool: true, poolKind: 'combat' }), die([1], false, { karma: true })];
    const r = withReplaced([die([3], false)], now);
    assert.deepEqual(r.map((d) => d.faces[0]), [3, 2, 1]);
    assert.equal(r[1]!.poolKind, 'combat');
    assert.equal(r[2]!.karma, true);
    assert.deepEqual(withReplaced(undefined, [die([6, 2], true)]), []);
  });

  test('in place only when every fact allows it', () => {
    assert.equal(rerollInPlace(facts()), true);
    for (const k of ['setting', 'hasMessage', 'sameTest', 'newFormat', 'canWrite'] as const) assert.equal(rerollInPlace(facts({ [k]: false })), false, k);
    assert.equal(rerollInPlace(facts({ superseded: true })), false);
  });

  test('stale keys: the old resolution\'s keys the new one lacks, never the kept ones, never a use mark', () => {
    assert.deepEqual(staleFlagKeys(['attack', 'damage', 'test', 'resolvedKeys'], ['damage']), ['attack']);
    // A use mark set later isn't in the card's list, so it is never removed.
    assert.deepEqual(staleFlagKeys(['attack'], ['attack']), []);
    assert.deepEqual(staleFlagKeys(['supersededBy', 'retargetOf', 'typedDice', '__proto__', 'a.b', 5], []), []);
    assert.deepEqual(staleFlagKeys('attack', []), []);
    assert.deepEqual(staleFlagKeys(['x', 'x'], []), ['x']);
  });
});

describe('v0.94.1 typed physical-dice results: the pure rules (report item 30)', () => {
  test('the setting: off, GM only, everyone (the default for anything unknown)', () => {
    assert.equal(typedDiceMode('off'), 'off');
    assert.equal(typedDiceMode('gm'), 'gm');
    assert.equal(typedDiceMode(undefined), 'all');
    assert.equal(typedDiceMode('<x>'), 'all');
  });

  test('who may type: as for rolling, the roller\'s owner, and only as the setting allows', () => {
    assert.equal(mayTypeDice('all', { isGM: false, ownsRoller: true }), true);
    assert.equal(mayTypeDice('all', { isGM: false, ownsRoller: false }), false);
    assert.equal(mayTypeDice('gm', { isGM: false, ownsRoller: true }), false);
    assert.equal(mayTypeDice('gm', { isGM: true, ownsRoller: true }), true);
    assert.equal(mayTypeDice('off', { isGM: true, ownsRoller: true }), false);
  });

  test('the typed count is a whole number from 0 to the pool', () => {
    assert.equal(clampTyped(3, 5), 3);
    assert.equal(clampTyped(9, 5), 5);
    assert.equal(clampTyped(-2, 5), 0);
    assert.equal(clampTyped('2.9', 5), 2);
    assert.equal(clampTyped('x', 5), 0);
    assert.equal(clampTyped(3, 0), 0);
  });

  test('the result: no faces, the TN as a roll\'s, Rule of One when every die came up 1', () => {
    const r = typedResult({ successes: 7, allOnes: false, pool: 5, baseTargetNumber: 4, modifiers: [{ label: 'Wound', value: 2 }] });
    assert.deepEqual(r.dice, []);
    assert.equal(r.totalDice, 5);
    assert.equal(r.successes, 5);
    assert.equal(r.targetNumber, 6);
    assert.equal(r.botch, false);
    const b = typedResult({ successes: 3, allOnes: true, pool: 4, baseTargetNumber: 4, modifiers: [] });
    assert.equal(b.botch, true);
    assert.equal(b.successes, 0);
    assert.equal(typedResult({ successes: 0, allOnes: true, pool: 0, baseTargetNumber: 4, modifiers: [] }).botch, false);
  });

  test('a waiting result goes to the same actor\'s next test, not to a resistance test, and goes stale', () => {
    const p = { successes: 2, allOnes: false, actorUuid: 'Actor.a', at: 1000 };
    assert.equal(typedFor(null, { actorUuid: 'Actor.a', kind: 'plain', now: 1000 }), 'keep');
    assert.equal(typedFor(p, { actorUuid: 'Actor.a', kind: 'attack', now: 1500 }), 'use');
    assert.equal(typedFor(p, { actorUuid: 'Actor.b', kind: 'attack', now: 1500 }), 'keep');
    assert.equal(typedFor(p, { actorUuid: 'Actor.a', kind: 'soak', now: 1500 }), 'keep');
    assert.equal(typedFor(p, { actorUuid: 'Actor.a', kind: 'plain', now: 1000 + TYPED_WAIT_MS + 1 }), 'drop');
    assert.equal(typedFor(p, { actorUuid: 'Actor.a', kind: 'plain', now: 999 }), 'drop');
  });

  test('the window\'s fields: nothing unless the box is ticked', () => {
    assert.equal(readTyped(false, 3, false), null);
    assert.deepEqual(readTyped(true, '3', 'on'), { successes: 3, allOnes: true });
    assert.deepEqual(readTyped(true, -1, false), { successes: 0, allOnes: false });
  });
});

describe('v0.94.1 typed dice: the roll window glue (applications/typed941.ts)', () => {
  const g = globalThis as any;
  let saved: any;
  before(() => { saved = g.game; });
  after(() => { g.game = saved; });
  const as = (isGM: boolean, mode: unknown) => { g.game = { user: { isGM }, settings: { get: (_s: string, k: string) => (k === 'typedDice' ? mode : undefined) }, i18n: { localize: (k: string) => k } }; };

  test('the row shows for the actor\'s owner as the setting allows, in English, folded', async () => {
    const { typedDiceRow } = await import('../applications/typed941.ts');
    as(false, 'all');
    const row = typedDiceRow({ isOwner: true });
    assert.match(row, /<details class="sr2e-typed-dice"><summary>I rolled the dice myself<\/summary>/);
    assert.match(row, /name="typedOn"/);
    assert.match(row, /name="typedSuccesses" type="number" min="0" step="1"/);
    assert.match(row, /name="typedOnes"/);
    assert.equal(typedDiceRow({ isOwner: false }), '');
    as(false, 'gm');
    assert.equal(typedDiceRow({ isOwner: true }), '');
    as(true, 'gm');
    assert.notEqual(typedDiceRow({ isOwner: true }), '');
    as(true, 'off');
    assert.equal(typedDiceRow({ isOwner: true }), '');
  });

  test('reading the form', async () => {
    const { readTypedDice } = await import('../applications/typed941.ts');
    const form = (on: boolean, n: string, ones: boolean) => ({ elements: { typedOn: { checked: on }, typedSuccesses: { value: n }, typedOnes: { checked: ones } } });
    assert.equal(readTypedDice(form(false, '3', false)), null);
    assert.deepEqual(readTypedDice(form(true, '3', false)), { successes: 3, allOnes: false });
    assert.equal(readTypedDice({ elements: {} }), null);
    assert.equal(readTypedDice(null), null);
  });

  test('a waiting result: taken once by its actor\'s test; dropped when its window\'s action ends', async () => {
    const { armTypedDice, takeTypedPending, withTypedDice, typedScoped } = await import('../applications/typed941.ts');
    armTypedDice({ uuid: 'Actor.a' }, { successes: 4, allOnes: false });
    assert.equal(takeTypedPending('Actor.a', 'soak'), null);
    assert.deepEqual(takeTypedPending('Actor.a', 'plain'), { successes: 4, allOnes: false });
    assert.equal(takeTypedPending('Actor.a', 'plain'), null);
    // withTypedDice: an unused one doesn't wait for a later test.
    await withTypedDice({ uuid: 'Actor.a' }, { successes: 1, allOnes: false }, async () => 0);
    assert.equal(takeTypedPending('Actor.a', 'plain'), null);
    // typedScoped: armed inside the action (the attack window's OK), gone after it, whatever it returned.
    const action = typedScoped(async function (this: any) { armTypedDice({ uuid: 'Actor.a' }, { successes: 2, allOnes: false }); return 'done'; });
    assert.equal(await action.call({}), 'done');
    assert.equal(takeTypedPending('Actor.a', 'plain'), null);
  });
});

describe('v0.94.1 wiring', () => {
  const docs = src('documents', 'index.ts');
  const chat = src('applications', 'chat.ts');
  const sheets = src('applications', 'sheets.ts');
  const settings = src('settings.ts');

  test('the re-roll buttons hand the card along; Karma, Avoid and Buy may update it in place', () => {
    assert.match(chat, /actor\.karmaReroll\(snap, message\)/);
    assert.match(chat, /actor\.avoidDisaster\(snap, message\)/);
    assert.match(chat, /actor\.buySuccess\(snap, message\)/);
    assert.match(docs, /async karmaReroll\(snapIn: TestSnapshot, message: any = null\)/);
    assert.match(docs, /async avoidDisaster\(snap: TestSnapshot, message: any = null\)/);
    assert.match(docs, /async buySuccess\(snap: TestSnapshot, message: any = null\)/);
    // In place only through canWriteNow: the author, or a GM acting as the author (runAsAuthor).
    assert.match(docs, /canWrite: canWriteNow\(message\)/);
    // Every test card lists its resolution's keys (a re-roll in place removes the stale ones).
    assert.match(docs, /resolvedKeys: Object\.keys\(flags\) \} \}/);
    // The targets are asked again on every client, as a new card would ask them.
    assert.match(docs, /await message\.update\(upd, \{ sr2eReroll: true \}\)/);
    assert.match(chat, /Hooks\.on\('updateChatMessage', \(message: any, _change: any, options: any\) => \{\n\s*if \(!options\?\.sr2eReroll\) return;\n\s*prompted\.delete\(message\.id\);/);
  });

  test('typed results: refused for Karma re-rolls and GM TN changes; never auto-applied or auto-resisted', () => {
    assert.match(docs, /if \(snapIn\.typed\) \{ ui\.notifications\?\.warn\?\.\(tx\('SR2E\.Notify\.Dice941\.typedNoReroll'\)\); return; \}/);
    assert.match(docs, /if \(snap\.typed\) \{ ui\.notifications\?\.warn\?\.\(tx\('SR2E\.Notify\.Dice941\.typedNoRetarget'\)\); return null; \}/);
    assert.match(chat, /if \(typedCard\(message\)\) return;\n/);
    assert.match(chat, /if \(typedCard\(message\)\) return false;/);
  });

  test('the main roll windows carry the typed row and hand it to their test', () => {
    assert.equal((sheets.match(/\$\{typedDiceRow\(actor\)\}/g) ?? []).length, 4);
    assert.match(sheets, /return withTypedDice\(actor, c2\.typed, \(\) => actor\.rollAttribute\(/);
    assert.match(sheets, /return withTypedDice\(actor, choice\.typed, \(\) => actor\.rollSkill\(/);
    assert.match(sheets, /await withTypedDice\(actor, choice\.typed, \(\) => actor\.castSpell\(/);
    assert.match(sheets, /armTypedDice\(actor, readTypedDice\(button\.form\)\); return readChoice\(button\.form\);/);
    assert.match(sheets, /attackWeapon: typedScoped\(SR2CharacterSheet\.#onAttackWeapon\)/);
    assert.match(sheets, /quickAttack: typedScoped\(SR2CharacterSheet\.#onQuickAttack\)/);
  });

  test('the two world settings', () => {
    assert.match(settings, /register\(SYSTEM\.id, "rerollInPlace", \{[\s\S]{0,200}scope: "world", config: true, type: Boolean, default: true/);
    assert.match(settings, /register\(SYSTEM\.id, "typedDice", \{[\s\S]{0,200}type: String, default: "all",\s*choices: \{ off: [^}]*gm: [^}]*all: /);
  });

  test('the stylesheet ends with the replaced-die and typed-mark looks', () => {
    const css = read('public', 'style', 'sr2e.css');
    const tail = css.slice(css.lastIndexOf('v0.94.1 (report item 24)'));
    assert.match(tail, /\.sr2e-die\.sr2e-die-replaced \{[^}]*text-decoration: line-through/);
    assert.match(tail, /\.sr2e-typed-mark \{/);
  });

  test('every new key has its English in the draft', () => {
    const d = draft();
    const used = new Set([...`${docs}\n${chat}\n${sheets}\n${settings}\n${src('applications', 'typed941.ts')}`.matchAll(/SR2E\.(?:[A-Za-z]+\.Dice941\.[A-Za-z]+|Settings\.(?:rerollInPlace|typedDice)[A-Za-z.]*)/g)].map((m) => m[0]));
    for (const k of used) {
      const forms = k === 'SR2E.Card.Dice941.typedMark' ? [`${k}.one`, `${k}.other`] : [k];
      for (const f of forms) assert.ok(typeof d[f] === 'string' && d[f]!.length > 0, f);
    }
  });
});
