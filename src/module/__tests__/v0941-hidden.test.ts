/**
 * v0.94.1 (report item 21): hidden-information basics (rules/hidden941.ts, applications/hidden941.ts and their wiring),
 * plus the three import fixes from the 0.94.0 live check.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PRIVACY_RANK, flooredMode, worldFloor, armSecret, disarmSecret, takeSecret, SECRET_TTL_MS, hidesNumbers, floatVisible,
} from '../rules/hidden941.ts';
import { parseInlineTest, inlineTestSummary } from '../rules/inlinetest.ts';
import { personOrder, nullsheenToWriteUp } from '../rules/nullsheen.ts';
import { importInput } from '../rules/imports094.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const fixture = (name: string) => read('src', 'module', '__tests__', 'fixtures', name);

describe('v0.94.1 table privacy default (item 21)', () => {
  test('a player only goes more private than the table default', () => {
    assert.equal(flooredMode('public', 'gm', false), 'gm');
    assert.equal(flooredMode('blind', 'gm', false), 'blind');
    assert.equal(flooredMode('self', 'gm', false), 'self', 'self ranks with gm: the player\'s choice stands');
    assert.equal(flooredMode('gm', 'blind', false), 'blind');
    assert.equal(flooredMode('ic', 'gm', false), 'gm');
  });
  test('the GM is free, and no floor changes nothing', () => {
    assert.equal(flooredMode('public', 'blind', true), 'public');
    for (const m of Object.keys(PRIVACY_RANK)) assert.equal(flooredMode(m, '', false), m);
  });
  test('the world map: only known modes count, ic never is a floor', () => {
    assert.equal(worldFloor('magic', { magic: 'blind' }), 'blind');
    assert.equal(worldFloor('magic', { magic: 'ic' }), '');
    assert.equal(worldFloor('magic', { magic: 'nonsense' }), '');
    assert.equal(worldFloor('magic', null), '');
    assert.equal(worldFloor('toString', {}), '', 'no inherited names');
  });
  test('withRollMode floors the user\'s mode; a kind-less card takes no floor', () => {
    const idx = read('src', 'module', 'documents', 'index.ts');
    const body = idx.slice(idx.indexOf('export function withRollMode('), idx.indexOf("export type PoolKind"));
    assert.ok(body.includes("if (kind) try { floor = worldFloor(privacyGroup(kind), (game.settings.get(SYSTEM_ID, 'rollPrivacyWorld')"));
    assert.ok(body.includes('mode = flooredMode(privacyFor(kind, prefs, mode), floor, isGM);'));
    assert.ok(body.indexOf('takeSecret(') < body.indexOf('data-sr2e-action="(defend'), 'a secret card is GM-only before anything else');
  });
  test('the privacy window: the GM sets the table default; a player\'s options below it are disabled', () => {
    const s = read('src', 'module', 'settings.ts');
    assert.ok(s.includes('game.settings.register(SYSTEM.id, "rollPrivacyWorld", { scope: "world", config: false, type: Object, default: {} });'));
    assert.ok(s.includes('if (v === "gm" || v === "blind") world[g.id] = v;'));
    assert.ok(s.includes('if ((game as any).user?.isGM) {'), 'only the GM writes the world default');
    assert.ok(s.includes('const below = !gm && floor && m.id !== "" && flooredMode(m.id, floor, false) !== m.id;'));
  });
});

describe('v0.94.1 secret inline tests (item 21)', () => {
  test('`secret` after the subject; not a skill word before it', () => {
    const t = parseInlineTest('perception tn 5 secret');
    assert.ok(typeof t !== 'string');
    assert.equal(t.secret, true);
    assert.equal((parseInlineTest('perception tn 5') as any).secret, undefined, 'absent when not given');
    assert.deepEqual([(parseInlineTest('secret') as any).skill, (parseInlineTest('secret') as any).secret], ['secret', undefined], 'alone it is a skill\'s name');
    assert.match(inlineTestSummary(t), /secret/);
    const lab = parseInlineTest('Stealth secret label Sneak past') as any;
    assert.equal(lab.secret, true); assert.equal(lab.label, 'Sneak past');
  });
  test('arming: one card only, and it runs out', () => {
    armSecret('Actor.a', 1000);
    assert.equal(takeSecret('Actor.b', 1000), false);
    assert.equal(takeSecret('Actor.a', 1001), true);
    assert.equal(takeSecret('Actor.a', 1002), false, 'taken');
    armSecret('Actor.a', 1000);
    assert.equal(takeSecret('Actor.a', 1000 + SECRET_TTL_MS + 1), false, 'stale');
    armSecret('', 5); disarmSecret('');
    assert.equal(takeSecret('', 6), false);
  });
  test('the roll arms and always disarms', () => {
    const s = read('src', 'module', 'applications', 'inline.ts');
    assert.ok(s.includes('  armSecret(key);\n  try { return await rollInlineTestNow(test, o); } finally { disarmSecret(key); }'));
  });
});

describe('v0.94.1 NPC numbers and floating damage (item 21)', () => {
  test('who has the numbers hidden', () => {
    const base = { enabled: true, viewerIsGM: false, playerOwned: false, viewerOwns: false };
    assert.equal(hidesNumbers(base), true);
    assert.equal(hidesNumbers({ ...base, enabled: false }), false);
    assert.equal(hidesNumbers({ ...base, viewerIsGM: true }), false);
    assert.equal(hidesNumbers({ ...base, playerOwned: true }), false);
    assert.equal(hidesNumbers({ ...base, viewerOwns: true }), false);
  });
  test('the card marks the TN; the hook hides it, its breakdown and hover text', () => {
    const idx = read('src', 'module', 'documents', 'index.ts');
    assert.ok(idx.includes("${tx('SR2E.Card.Actor.diceVsTn', { totalDice: r.totalDice })} <strong>${r.targetNumber}</strong></summary>"), 'the TN is the summary\'s own last <strong>');
    const h = read('src', 'module', 'applications', 'hidden941.ts');
    assert.ok(h.includes("summary.removeAttribute('title');"));
    assert.ok(h.includes("summary.querySelectorAll(':scope > strong')"));
    assert.ok(h.includes("tn.textContent = '?';"), 'set as text');
    assert.ok(h.includes("roll.querySelectorAll('.sr2e-breakdown')"));
    assert.ok(read('src', 'module', 'sr2e-system.ts').includes('    registerHiddenNumbers();\n'));
  });
  test('floating damage: the GM and owners, or everyone', () => {
    assert.equal(floatVisible({ who: 'owners', isGM: false, isOwner: false }), false);
    assert.equal(floatVisible({ who: 'owners', isGM: true, isOwner: false }), true);
    assert.equal(floatVisible({ who: 'owners', isGM: false, isOwner: true }), true);
    assert.equal(floatVisible({ who: 'all', isGM: false, isOwner: false }), true);
    const k = read('src', 'module', 'applications', 'hotkeys.ts');
    assert.ok(k.includes("Hooks.on('diceSoNiceRollStart'"));
    assert.ok(k.includes('void diceStopped().then(() => floatNow(actor, texts));'));
  });
});

describe('v0.94.1 import fixes from the 0.94.0 live check', () => {
  test('"Surname, Given" becomes "Given Surname"; other names stay', () => {
    assert.equal(personOrder('Doe, Jane'), 'Jane Doe');
    assert.equal(personOrder('Sample Fixer'), 'Sample Fixer');
    assert.equal(personOrder('Smith, Jr.'), 'Smith, Jr.');
    assert.equal(personOrder('A, B, C'), 'A, B, C');
    assert.equal(personOrder('Doe, 42'), 'Doe, 42');
  });
  test('the Nullsheen fixture\'s contact keeps its name', () => {
    const w = nullsheenToWriteUp(JSON.parse(fixture('nullsheen-sr2-samurai.json')));
    assert.match(w.text, /Jane Doe \(Street Doc/);
    assert.doesNotMatch(w.text, /Doe\/Jane/);
  });
  test('the futurekill fixture\'s contact keeps its name', () => {
    const inp = importInput(fixture('futurekill-full.json'));
    assert.match(inp.text, /Jane Doe \(Talismonger/);
  });
  test('a refused file stops before an actor is made, and its preview says only why', () => {
    const c = read('src', 'module', 'applications', 'catalogue.ts');
    const fn = c.slice(c.indexOf('async function newCharacterFromBlock('), c.indexOf('// ---------------------------------------------------------------- the actions'));
    assert.ok(fn.indexOf('if (!input.text.trim() && input.warnings.length) {') < fn.indexOf('ActorCls.create('));
    assert.ok(c.includes("const from = input.source !== 'writeup' && input.text.trim() ? `<p>"));
  });
});

describe('v0.94.1 review fixes', () => {
  const idx = () => read('src', 'module', 'documents', 'index.ts');
  const chat = () => read('src', 'module', 'applications', 'chat.ts');
  test('1: a secret plain inline test (dice, Reaction) finds its arming through the card\'s own actor flag', () => {
    assert.ok(read('src', 'module', 'applications', 'inline.ts').includes("flags: { [SYSTEM_ID]: { privacyKind: 'plain', actorUuid: String(actor?.uuid ?? '') } },"));
    assert.ok(idx().includes("takeSecret(String(data?.flags?.[SYSTEM_ID]?.test?.actorUuid ?? data?.flags?.[SYSTEM_ID]?.actorUuid ?? ''))"));
    assert.ok(read('src', 'module', 'applications', 'hidden941.ts').includes('?? message?.flags?.[SYSTEM_ID]?.actorUuid;'), 'an NPC\'s plain card hides its numbers too');
  });
  test('1: a secret test\'s complementary card is GM-only too, and doesn\'t take the arming', async () => {
    const { secretArmed } = await import('../rules/hidden941.ts');
    armSecret('Actor.c', 100);
    assert.equal(secretArmed('Actor.c', 101), true);
    assert.equal(secretArmed('Actor.c', 102), true, 'not taken');
    assert.equal(takeSecret('Actor.c', 103), true);
    assert.equal(secretArmed('Actor.c', 104), false);
    assert.ok(idx().includes("await ChatMessage.create(blindIfSecret(String(this.uuid ?? ''), { speaker: ChatMessage.getSpeaker({ actor: this }), rolls, content: `${describeResult(tx('SR2E.Card.Actor.complementary',"));
  });
  test('2–3: a re-roll in place prompts, applies and resists again, only on the author\'s or a GM\'s update', () => {
    const c = chat();
    const hook = c.slice(c.indexOf("Hooks.on('updateChatMessage', (message: any, _change: any, options: any, userId: string) => {"), c.indexOf('// v0.93.3 (visual review 0.93.2, finding 5)'));
    assert.ok(hook.includes("if (!by || (!by.isGM && message.author?.id !== userId)) return;"));
    assert.ok(hook.includes('autoApplied.delete(message.id);') && hook.includes('autoResisting.delete(message.id);'));
    assert.ok(hook.includes("quietly('auto-apply', () => autoApplyGmCard(message));") && hook.includes("quietly('auto-resist', () => autoResistCard(message))"));
    assert.ok(c.includes("if (e.kind === 'defend' && defendedOn(message, target).includes(e.index)) continue;"), 'a target that defended isn\'t asked again');
  });
  test('3–4: no Karma on a card already defended (Avoid disaster too) or resisted', () => {
    const c = chat();
    const onKarma = c.slice(c.indexOf('async function onKarma('), c.indexOf('async function onKarma(') + 900);
    assert.ok(onKarma.includes("if (snap.kind === 'attack' && defendedAgainst(message)) return"), 'not only for karmaReroll');
    assert.ok(onKarma.includes("if (resistedAgainst(message)) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyResistedKarma'));"));
    assert.equal((c.match(/if \(resistedAgainst\(message\)\) return/g) ?? []).length, 2, 'Buy a success too');
  });
  test('6: the Defend against a typed attack is marked typed', () => {
    assert.ok(chat().includes("if (action === 'defend') return typedCard(message) ? postingTyped(() => onDefend(message, button)) : onDefend(message, button);"));
    assert.ok(idx().includes('export async function postingTyped<T>(fn: () => Promise<T>): Promise<T> {'));
  });
  test('7: the GM\'s chat-box mode wins over the table default', () => {
    assert.ok(idx().includes("(coreNow === '' || coreNow === 'public' || coreNow === 'publicroll' || coreNow === 'ic')"));
  });
  test('8–9: an unused typed result is dropped with a word; replaced dice stay on their own card', () => {
    const t = read('src', 'module', 'applications', 'typed941.ts');
    assert.equal((t.match(/finally \{ dropPending\(\); \}/g) ?? []).length, 2);
    assert.ok(idx().includes('if (!inPlace && snapIn?.replacedDice) { snapIn = { ...snapIn }; delete snapIn.replacedDice; }'));
  });
});
