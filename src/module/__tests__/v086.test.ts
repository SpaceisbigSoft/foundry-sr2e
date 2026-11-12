/**
 * v0.86.0: keyboard shortcuts and accessibility, and the fan-content wording the owner approved (W1–W5).
 * - applications/a11y.ts: every SR2e control reachable with Tab and pressed with Enter or Space, icon buttons named for
 *   screen readers, monitor tracks, pools and tab rows as one Tab stop moved with the arrow keys, the focus kept across
 *   re-renders and handed back when a dialog closes.
 * - applications/hotkeys.ts: the hotkeys' names come from lang/en.json; new: open your sheet, go to the newest chat
 *   card, open the guide.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  needsKeyboard, accessibleName, labelFor, plainText, focusKey, rovingStop, rovingMove, isTyping, isOurWindow, cardTakesFocus, KB_SELECTOR,
} from '../applications/a11y.ts';
import { HOTKEYS } from '../applications/hotkeys.ts';
import { readEnglish } from './helpers/english.ts';

const ROOT = process.cwd();
// v0.89.0: templates are read back in English (their text is in lang/en.json).
const read = (...p: string[]) => readEnglish(join(ROOT, ...p));

/** A minimal element for the pure helpers. */
function el(tagName: string, attrs: Record<string, string> = {}, text = '', hasControls = false): any {
  return {
    tagName,
    textContent: text,
    getAttribute: (n: string) => (n in attrs ? attrs[n] : null),
    hasAttribute: (n: string) => n in attrs,
    querySelector: () => (hasControls ? {} : null),
  };
}

function files(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { if (!/node_modules|__tests__|^art$/.test(f)) walk(p); } else if (ext.test(f)) out.push(p);
    }
  };
  walk(join(ROOT, dir));
  return out;
}

describe('v0.86.0 accessibility helpers (pure)', () => {
  test('which controls need the keyboard shim', () => {
    assert.equal(needsKeyboard(el('A', { 'data-action': 'roll' })), true);
    assert.equal(needsKeyboard(el('A', { 'data-action': 'roll', href: '#x' })), false);
    assert.equal(needsKeyboard(el('BUTTON', { 'data-action': 'roll' })), false);
    assert.equal(needsKeyboard(el('INPUT', { 'data-action': 'x' })), false);
    assert.equal(needsKeyboard(el('SELECT', {})), false);
    assert.equal(needsKeyboard(el('SPAN', { 'data-action': 'x' })), true);
    assert.equal(needsKeyboard(el('FORM', { 'data-action': 'x' })), false);
    assert.equal(needsKeyboard(el('SECTION', { 'data-action': 'x' })), false);
    // A container that holds controls of its own would nest buttons.
    assert.equal(needsKeyboard(el('LI', { 'data-action': 'x' }, 'row', true)), false);
    assert.equal(needsKeyboard(el('DIV', { contenteditable: 'true' })), false);
    // Review R2: headings stay headings; a container holding a ? help link (no address) is not a button around it.
    assert.equal(needsKeyboard(el('H2', { 'data-action': 'x' })), false);
    const withHelp: any = { ...el('DIV', { 'data-action': 'x' }), querySelector: (sel: string) => (sel.includes('[data-sr2e-help]') ? {} : null) };
    assert.equal(needsKeyboard(withHelp), false);
  });

  test('names: own text or label first, then the tooltip or title', () => {
    assert.equal(accessibleName(el('A', {}, '  Reload  now ')), 'Reload now');
    assert.equal(accessibleName(el('A', { 'aria-label': 'Delete' }, '')), 'Delete');
    assert.equal(accessibleName(el('A', { 'aria-labelledby': 'h' }, '')), '(labelled)');
    assert.equal(accessibleName(el('IMG', { alt: 'Portrait' })), 'Portrait');
    assert.equal(labelFor(el('A', { title: 'Reload' }, '')), 'Reload');
    assert.equal(labelFor(el('A', { 'data-tooltip': '<strong>Take Aim</strong> &amp; fire' }, '')), 'Take Aim & fire');
    assert.equal(labelFor(el('A', { title: 'Reload' }, 'Reload')), null);
    assert.equal(labelFor(el('A', {}, '')), null);
    assert.equal(plainText('a&nbsp;<b>b</b>&lt;c&gt; &quot;d&quot; &#39;e&#39;'), 'a b <c> "d" \'e\'');
  });

  test('focus keys find the same control after a re-render', () => {
    assert.equal(focusKey(el('A', { 'data-action': 'setMonitor', 'data-track': 'physical', 'data-value': '3' })), 'a[data-action="setMonitor"][data-track="physical"][data-value="3"]');
    assert.equal(focusKey(el('BUTTON', { 'data-sr2e-action': 'defend', 'data-index': '0' })), 'button[data-sr2e-action="defend"][data-index="0"]');
    assert.equal(focusKey(el('A', { 'data-action': 'x', 'data-item-id': 'a"b' })), 'a[data-action="x"][data-item-id="a\\"b"]');
    assert.equal(focusKey(el('A', { title: 'nothing to find it by' })), null);
    // Review nit: a newline in a player-written value can't break the selector.
    assert.equal(focusKey(el('A', { 'data-spec': 'a\nb' })), 'a[data-spec="a\\a b"]');
  });

  test('roving tab stops: the last filled item holds the stop; the arrow keys move', () => {
    assert.equal(rovingStop([true, true, false, false]), 1);
    assert.equal(rovingStop([false, false]), 0);
    assert.equal(rovingStop([]), -1);
    assert.equal(rovingMove('ArrowRight', 2, 5), 3);
    assert.equal(rovingMove('ArrowRight', 4, 5), 4);
    assert.equal(rovingMove('ArrowLeft', 0, 5), 0);
    assert.equal(rovingMove('ArrowUp', 3, 5), 2);
    assert.equal(rovingMove('Home', 3, 5), 0);
    assert.equal(rovingMove('End', 1, 5), 4);
    assert.equal(rovingMove('Enter', 1, 5), null);
    assert.equal(rovingMove('ArrowRight', 0, 0), null);
  });

  test('typing keeps every key; buttons and boxes do not', () => {
    assert.equal(isTyping(el('INPUT', { type: 'text' })), true);
    assert.equal(isTyping(el('INPUT', {})), true);
    assert.equal(isTyping(el('INPUT', { type: 'number' })), true);
    assert.equal(isTyping(el('INPUT', { type: 'checkbox' })), false);
    assert.equal(isTyping(el('TEXTAREA')), true);
    assert.equal(isTyping({ tagName: 'DIV', isContentEditable: true }), true);
    assert.equal(isTyping(el('A')), false);
    assert.equal(isTyping(null), false);
  });

  test('our windows: SR2e classes, or a dialog showing our content', () => {
    const cls = (...c: string[]) => ({ contains: (x: string) => c.includes(x) });
    assert.equal(isOurWindow({ classList: cls('application', 'sr2e') }), true);
    assert.equal(isOurWindow({ classList: cls('sr2e-gm-panel') }), true);
    assert.equal(isOurWindow({ classList: cls('dialog'), querySelector: () => ({}) }), true);
    assert.equal(isOurWindow({ classList: cls('dialog'), querySelector: () => null }), false);
    assert.equal(isOurWindow(null), false);
    for (const s of ['[data-action]', '[data-sr2e-action]', 'a.sr2e-inline-test', 'a.sr2e-pan']) assert.ok(KB_SELECTOR.includes(s), s);
    // Review R2: a foldable heading is never a button (its caret is).
    assert.ok(!KB_SELECTOR.includes('.sr2e-foldable'));
  });
});

describe('v0.86.0 review fixes', () => {
  test('R4: only the pressed card, or a card this user posted after the press, takes the focus back', () => {
    const p = { messageId: 'm1', at: 10_000, until: 14_000 };
    assert.equal(cardTakesFocus(p, { id: 'm1' }, 12_000), true);
    assert.equal(cardTakesFocus(p, { id: 'm2', isAuthor: true, timestamp: 11_000 }, 12_000), true);
    assert.equal(cardTakesFocus(p, { id: 'm2', isAuthor: false, timestamp: 11_000 }, 12_000), false, 'someone else\'s card');
    assert.equal(cardTakesFocus(p, { id: 'm3', isAuthor: true, timestamp: 5_000 }, 12_000), false, 'an older card of mine');
    assert.equal(cardTakesFocus(p, { id: 'm1' }, 15_000), false, 'too late');
    assert.equal(cardTakesFocus({ messageId: null, at: 0, until: 99_999 }, { id: 'm1' }, 1), false, 'pressed outside the chat');
    assert.equal(cardTakesFocus(null, { id: 'm1' }, 1), false);
  });
  test('R3/R5: mouse users are left alone; tab rows and core windows', () => {
    const src = read('src', 'module', 'applications', 'a11y.ts');
    assert.ok(src.includes("document.addEventListener('pointerdown', () => { pending = null; }, true);"));
    assert.ok(src.includes("safeMatches(target, ':focus-visible')") && src.includes("safeMatches(a, ':focus-visible')"));
    assert.ok(src.includes("group: '[role=\"tablist\"][data-sr2e-tabs]'"));
    assert.ok(src.includes('else enhanceParts(root);'));
    const hk = read('src', 'module', 'applications', 'hotkeys.ts');
    assert.ok(hk.includes("'.message-content button[data-sr2e-action]:not([disabled])'"), 'Alt+C never lands on Delete');
  });
});

describe('v0.86.0 hotkeys', () => {
  test('ids and default keys are unique, all on Alt, and only the GM panel is GM-only', () => {
    assert.equal(new Set(HOTKEYS.map((h) => h.id)).size, HOTKEYS.length);
    assert.equal(new Set(HOTKEYS.map((h) => h.key)).size, HOTKEYS.length);
    assert.deepEqual(HOTKEYS.filter((h) => h.gm).map((h) => h.id), ['gmPanel']);
    for (const id of ['defendNewest', 'resistNewest', 'endTurn', 'rollInitiative', 'gmPanel', 'openGuide', 'openSheet', 'focusCard']) {
      assert.ok(HOTKEYS.some((h) => h.id === id), id);
    }
  });

  test('every hotkey has a name and hint in lang/en.json and is in the guide', () => {
    const lang = JSON.parse(read('public', 'lang', 'en.json'));
    const guide = JSON.stringify(JSON.parse(read('public', 'lang', 'en.json')).SR2E.Guide); // v0.89.7: the guide's text
    for (const h of HOTKEYS) {
      const t = lang.SR2E.Keybindings[h.label];
      assert.ok(t?.Name && t?.Hint, h.label);
      assert.ok(guide.includes(`<kbd>Alt</kbd>+<kbd>${h.key.replace('Key', '')}</kbd>`), `guide lists Alt+${h.key}`);
    }
  });

  test('registers each hotkey with localized text and Alt', async () => {
    const g = globalThis as any;
    const seen: any[] = [];
    const prev = g.game;
    g.game = { keybindings: { register: (ns: string, id: string, o: any) => seen.push({ ns, id, o }) } };
    try {
      const { registerHotkeys } = await import('../applications/hotkeys.ts');
      registerHotkeys();
    } finally { g.game = prev; }
    assert.equal(seen.length, HOTKEYS.length);
    for (const s of seen) {
      assert.equal(s.ns, 'sr2e');
      assert.match(s.o.name, /^SR2E\.Keybindings\.\w+\.Name$/);
      assert.deepEqual(s.o.editable[0].modifiers, ['Alt']);
      assert.equal(typeof s.o.onDown, 'function');
    }
    assert.equal(seen.find((s) => s.id === 'gmPanel').o.restricted, true);
    assert.equal(seen.find((s) => s.id === 'openGuide').o.restricted, false);
  });
});

describe('v0.86.0 template and source scans', () => {
  test('no icon-only control without a name or tooltip', () => {
    const bad: string[] = [];
    const re = /<(button|a)\b([^<>]*)>\s*(<i\b[^<>]*><\/i>\s*)+<\/\1>/g;
    for (const f of [...files('src', /\.ts$/), ...files('public/templates', /\.hbs$/)]) {
      const s = readFileSync(f, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = re.exec(s))) if (!/aria-label|title=|data-tooltip/.test(m[2] ?? '')) bad.push(`${relative(ROOT, f)}: ${m[0].slice(0, 80)}`);
    }
    assert.deepEqual(bad, []);
  });

  test('every form field in the templates has a label', () => {
    const bad: string[] = [];
    for (const f of files('public/templates', /\.hbs$/)) {
      const s = readFileSync(f, 'utf8');
      const re = /<(input|select|textarea)\b([^<>]*)>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s))) {
        if (/type="hidden"|aria-label|title=|placeholder=|\bid=/.test(m[2] ?? '')) continue;
        const before = s.slice(0, m.index);
        if (before.lastIndexOf('<label') > before.lastIndexOf('</label>')) continue;
        bad.push(`${relative(ROOT, f)}:${before.split('\n').length}`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test('the condition monitor and status strip carry their screen-reader text', () => {
    const track = read('public', 'templates', 'monitor-track.hbs');
    assert.ok(track.includes('aria-label="{{../../t.label}} box {{value}}"'));
    const mini = read('public', 'templates', 'monitor-mini.hbs');
    assert.equal((mini.match(/role="img"/g) ?? []).length, 2);
    const strip = read('public', 'templates', 'status-strip.hbs');
    assert.ok(!strip.includes('role="status"'), 'the strip is not a live region');
    assert.ok(strip.includes('role="group" aria-label="{{label}} Pool'));
  });

  test('the box key handler lives in a11y.ts only (no double press)', () => {
    const ui = read('src', 'module', 'applications', 'interface.ts');
    assert.ok(!/box\.addEventListener\('keydown'/.test(ui));
    const css = read('public', 'style', 'sr2e.css');
    assert.ok(css.includes('[data-sr2e-kb]') && css.includes(':focus-visible') && css.includes('forced-colors'));
    assert.ok(read('src', 'module', 'sr2e-system.ts').includes('registerAccessibility();'));
  });
});

describe('v0.86.0 fan-content wording (W1–W5)', () => {
  const license = read('LICENSE.md');
  test('W1: the Matrix trademark notice in LICENSE.md and the guide', () => {
    const notice = 'Shadowrun and Matrix are registered trademarks and/or trademarks of The Topps Company, Inc.';
    assert.ok(license.includes(notice));
    assert.ok(JSON.stringify(JSON.parse(read('public', 'lang', 'en.json')).SR2E.Guide).includes(notice)); // v0.89.7: the guide's text
    assert.ok(read('docs', 'PLAYER-GUIDE.md').includes(notice));
  });
  test('W2: the licence covers only the contributors\' own work', () => {
    assert.ok(license.includes("The licence covers only the sr2e contributors' own work. It grants no rights in the Shadowrun name, trademarks or game, which belong to The Topps Company, Inc.; an adaptation, commercial or not, needs its own permission for those."));
  });
  test('W3: the system.json description names all three companies', () => {
    const sys = JSON.parse(read('public', 'system.json'));
    assert.ok(sys.description.includes('not affiliated with or endorsed by The Topps Company, Catalyst Game Labs or Black Book Editions'));
  });
  test('W4: the Source line has no version number', () => {
    const source = license.split('\n').find((l) => l.startsWith('Source:')) ?? '';
    assert.ok(source.includes('https://github.com/SpaceisbigSoft/foundry-sr2e'));
    assert.ok(!/v0\.\d/.test(source));
  });
  test('W5: README status shows the current version (update it every version); the two LICENSE copies match', () => {
    const version = JSON.parse(read('package.json')).version;
    assert.equal(JSON.parse(read('public', 'system.json')).version, version);
    assert.ok(read('README.md').includes(`## Status: v${version}`), 'README status line'); // v0.92.5: the status line may name the version's title
    assert.equal(read('public', 'LICENSE.md'), license);
  });
});
