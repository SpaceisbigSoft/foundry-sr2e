/**
 * v0.67.0: the look's pure parts. The contrast test runs every text/background pair the stylesheet uses
 * over every theme × colour preset (WCAG AA: 4.5:1 for text, 3:1 for the parts of controls).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  THEMES, PRESETS, AREAS, palette, contrast, contrastPairs, contrastProblems, paletteVars, paletteCss, normalizeLook, lookBody, LOOK_DEFAULTS,
  woundGroupRanges, trackView, overflowView, monitorView, cardArea, cardKindLabel, portraitFor, portraitKey, isDefaultPortrait,
  portraitReplaceable, cleanFolder, hexToRgb,
} from '../look.ts';
import { RULES, monitorStatus } from '../index.ts';
import { oldWay } from './oldway.ts';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

describe('palettes and contrast (WCAG AA)', () => {
  test('the contrast maths matches known ratios', () => {
    assert.equal(Number(contrast('#000000', '#ffffff').toFixed(2)), 21);
    assert.equal(Number(contrast('#777777', '#ffffff').toFixed(2)), 4.48);
    assert.equal(contrast('#1b1f25', '#1b1f25'), 1);
    assert.deepEqual(hexToRgb('#4fd1d9'), [79, 209, 217]);
    assert.deepEqual(hexToRgb('#fff'), [255, 255, 255]);
  });

  for (const t of THEMES) for (const p of PRESETS) {
    test(`${t} / ${p}: every pair meets its minimum`, () => {
      const bad = contrastProblems(palette(t, p));
      assert.deepEqual(bad.map((x) => `${x.what}: ${x.ratio.toFixed(2)} < ${x.min}`), []);
    });
  }

  test('the pairs cover text, muted text, accent, buttons, dice, warnings and every area', () => {
    const whats = contrastPairs(palette('street', 'cyan')).map((x) => x.what);
    for (const w of ['body text', 'labels and hints', 'links and the active tab', 'accent buttons', 'dice that hit', 'dice that rolled a 1', 'warnings', 'empty monitor boxes'])
      assert.ok(whats.some((x) => x.startsWith(w)), w);
    for (const a of AREAS) {
      assert.ok(whats.includes(`${a} card header strip`), a);
      assert.ok(whats.includes(`${a} headings`), a);
    }
  });

  test('the mock-up A colours are the Street / Gunmetal cyan palette', () => {
    const p = palette('street', 'cyan');
    assert.equal(p.page, '#0f1215'); assert.equal(p.window, '#1b1f25'); assert.equal(p.header, '#232931');
    assert.equal(p.text, '#e6e9ed'); assert.equal(p.muted, '#a3adb9'); assert.equal(p.accent, '#4fd1d9');
    // v0.84.1: the area colours were tuned to be told apart with colour blindness (colourblind.ts).
    assert.equal(p.areas.combat.base, '#ce5642'); assert.equal(p.areas.magic.base, '#9576d1'); assert.equal(p.areas.matrix.base, '#39daad');
    assert.equal(p.areas.rigging.base, '#e0892c'); assert.equal(p.areas.street.base, '#ebca6e'); assert.equal(p.areas.health.base, '#21aa9c');
  });

  test('presets change the accent; Phosphor green turns the Matrix area cyan', () => {
    assert.equal(palette('street', 'green').accent, '#5fd68f');
    assert.equal(palette('street', 'magenta').accent, '#ec6fc5');
    assert.equal(palette('street', 'amber').accent, '#f0b35a');
    assert.equal(palette('street', 'green').areas.matrix.base, '#50d6de');
    assert.notEqual(palette('street', 'cyan').areas.matrix.base, '#50d6de');
    assert.notEqual(palette('corp', 'green').areas.matrix.base, palette('corp', 'cyan').areas.matrix.base);
  });

  test('Corp is shaded, never flat white, and keeps a dark title bar', () => {
    for (const p of PRESETS) {
      const c = palette('corp', p);
      for (const k of ['page', 'window', 'raised', 'chip', 'sunk'] as const) assert.notEqual(c[k].toLowerCase(), '#ffffff', `${p} ${k}`);
      assert.ok(contrast(c.window, '#ffffff') > 1.2, `${p} window is shaded`);
      assert.equal(c.scheme, 'light');
      assert.ok(contrast(c.header, '#000000') < 2, 'the title bar is dark');
    }
    assert.equal(palette('corp', 'cyan').window, '#d6dbe1');
    assert.equal(palette('street', 'cyan').scheme, 'dark');
    assert.equal(palette('contrast', 'cyan').scheme, 'dark');
  });

  test('unknown values fall back to Street / Gunmetal cyan', () => {
    assert.deepEqual(palette('nope', 'nope'), palette('street', 'cyan'));
  });

  test('the CSS variables: one block per theme × preset, in the system layer, every token present', () => {
    const css = paletteCss();
    assert.match(css, /^@layer system \{/);
    for (const t of THEMES) for (const p of PRESETS) assert.ok(css.includes(`body.sr2e-theme-${t}.sr2e-preset-${p} :is(.sr2e-look, .sr2e-card, .sr2e-hover-card) {`), `${t} ${p}`);
    // Outside our windows and cards the variables follow Foundry's own scheme (review fix: no light-on-light in Foundry's chat).
    assert.ok(css.includes(':root, body.theme-dark {'));
    assert.ok(css.includes('body.theme-light {'));
    const light = css.slice(css.indexOf('body.theme-light {'), css.indexOf('}', css.indexOf('body.theme-light {')));
    assert.ok(light.includes(`--sr2e-danger: ${palette('corp', 'cyan').danger};`));
    const vars = paletteVars(palette('street', 'cyan'));
    for (const a of AREAS) for (const s of ['', '-text', '-tint', '-ink']) assert.ok(`--sr2e-${a}${s}` in vars, `${a}${s}`);
    assert.equal(vars['--sr2e-edge'], 'rgba(79, 209, 217, 0.45)');
    // Every variable the stylesheet reads is defined by the palette (or by the stylesheet itself).
    const sheet = read('public', 'style', 'sr2e.css');
    const own = new Set([...sheet.matchAll(/(--sr2e-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const used = new Set([...sheet.matchAll(/var\((--sr2e-[a-z0-9-]+)/g)].map((m) => m[1]!));
    const missing = [...used].filter((v) => !(v in vars) && !own.has(v));
    assert.deepEqual(missing, []);
  });

  test('player settings are cleaned and become body classes and variables', () => {
    assert.deepEqual(normalizeLook(null), LOOK_DEFAULTS);
    assert.deepEqual(normalizeLook({ theme: 'corp', preset: 'amber', opacity: 33, textScale: 141, reducedMotion: 1 }),
      { theme: 'corp', preset: 'amber', opacity: 50, textScale: 130, reducedMotion: true });
    assert.equal(normalizeLook({ opacity: 87 }).opacity, 85);
    assert.equal(normalizeLook({ textScale: 'x' }).textScale, 100);
    const b = lookBody(normalizeLook({ theme: 'contrast', preset: 'green', opacity: 80, textScale: 120, reducedMotion: true }));
    assert.deepEqual(b.classes, ['sr2e-theme-contrast', 'sr2e-preset-green', 'sr2e-reduced-motion', 'sr2e-see-through']);
    assert.deepEqual(b.style, { '--sr2e-window-alpha': '0.8', '--sr2e-text-scale': '1.2' });
    assert.deepEqual(lookBody(LOOK_DEFAULTS).classes, ['sr2e-theme-street', 'sr2e-preset-cyan']);
  });
});

describe('the condition monitor: wound groups and overflow', () => {
  test('groups from the healing table: 1–2 +1, 3–5 +2, 6–9 +3, 10 D / KO / Crash', () => {
    const g = woundGroupRanges('physical');
    assert.deepEqual(g.map((x) => [x.from, x.to, x.label]), [[1, 2, '+1'], [3, 5, '+2'], [6, 9, '+3'], [10, 10, 'D']]);
    assert.equal(woundGroupRanges('stun').at(-1)!.label, 'KO');
    assert.equal(woundGroupRanges('matrix').at(-1)!.label, 'Crash');
  });

  test('the groups follow the rules tables (a house rule moves the dividers and labels)', () => {
    const g = woundGroupRanges('physical', 10, [[1, 'L'], [4, 'M'], [7, 'S'], [10, 'D']]);
    assert.deepEqual(g.map((x) => [x.from, x.to]), [[1, 3], [4, 6], [7, 9], [10, 10]]);
    const saved = RULES.WOUND_MODIFIERS;
    (RULES as any).WOUND_MODIFIERS = [[6, 4], [3, 2], [1, 1]];
    try { assert.equal(woundGroupRanges('physical').find((x) => x.from === 6)!.label, '+4'); } finally { (RULES as any).WOUND_MODIFIERS = saved; }
    // A table that doesn't start at box 1 gets an unlabelled first group.
    assert.deepEqual(woundGroupRanges('stun', 10, [[3, 'M'], [10, 'D']]).map((x) => [x.from, x.to, x.label]), [[1, 2, ''], [3, 9, '+2'], [10, 10, 'KO']]);
  });

  test('a track view: filled boxes, the reached group marked once', () => {
    const t = trackView('physical', 4);
    assert.equal(t.groups.reduce((n, g) => n + g.size, 0), 10);
    assert.deepEqual(t.groups.flatMap((g) => g.boxes.filter((b) => b.filled).map((b) => b.value)), [1, 2, 3, 4]);
    assert.deepEqual(t.groups.map((g) => g.now), [false, true, false, false]);
    assert.equal(t.reached, '+2');
    assert.equal(trackView('stun', 0).reached, '');
    assert.ok(trackView('stun', 0).groups.every((g) => !g.now));
    assert.equal(trackView('physical', 14).filled, 10, 'the track shows 10 when overflowing');
    assert.equal(trackView('matrix', 3, { boxes: 10, label: 'Persona' }).label, 'Persona');
  });

  test('overflow: one box per point of Body, idle until the track is full, the last box is death', (t) => {
    // v0.92.3: the old way (the book's extra death box past Body: v0923-health.test.ts).
    t.after(oldWay({ 'HEALTH_V923.death': 'total' }));
    const idle = overflowView(9, 6);
    assert.equal(idle.idle, true); assert.equal(idle.filled, 0); assert.equal(idle.boxes.length, 6);
    assert.deepEqual(idle.boxes.map((b) => b.value), [11, 12, 13, 14, 15, 16]);
    assert.deepEqual(idle.boxes.map((b) => !!b.dead), [false, false, false, false, false, true]);
    assert.equal(overflowView(10, 6).idle, false, 'a full track lights the overflow row');
    assert.equal(overflowView(13, 6).filled, 3);
    assert.equal(overflowView(30, 4).filled, 4);
    assert.equal(overflowView(5, 0).boxes.length, 0);
  });

  test('the overflow death box matches monitorStatus with the same Body', (t) => {
    t.after(oldWay({ 'HEALTH_V923.death': 'total' }));
    for (const body of [1, 3, 6, 9]) {
      const dead = RULES.MONITOR_BOXES + body;
      assert.equal(monitorStatus({ physical: dead, stun: 0 }, body), 'dead');
      assert.notEqual(monitorStatus({ physical: dead - 1, stun: 0 }, body), 'dead');
      const v = overflowView(dead, body);
      assert.equal(v.boxes.at(-1)!.value, dead);
      assert.ok(v.boxes.at(-1)!.filled && v.boxes.at(-1)!.dead);
    }
  });

  test('monitorView: both tracks, overflow unless switched off (spirits)', () => {
    const v = monitorView({ physical: 11, stun: 3 }, 5);
    assert.equal(v.physical.filled, 10); assert.equal(v.stun.filled, 3);
    assert.equal(v.overflow!.filled, 1); assert.equal(v.overflow!.body, 5);
    assert.deepEqual(v.tracks.map((t) => t.short), ['P', 'S']);
    assert.equal(monitorView({ physical: 2, stun: 0 }, 5, { overflow: false }).overflow, null);
    assert.equal(monitorView(null, 0).physical.filled, 0);
    assert.equal(monitorView({ physical: 0, stun: 14 }, 3).extraStun, 4);
  });
});

describe('chat cards: the area colour', () => {
  test('kinds of test map to areas', () => {
    assert.equal(cardArea({ kind: 'attack' }), 'combat');
    assert.equal(cardArea({ kind: 'defend' }), 'combat');
    assert.equal(cardArea({ kind: 'spell' }), 'magic');
    assert.equal(cardArea({ kind: 'conjure' }), 'magic');
    assert.equal(cardArea({ kind: 'system' }), 'matrix');
    assert.equal(cardArea({ kind: 'drive' }), 'rigging');
    assert.equal(cardArea({ kind: 'bypass' }), 'street');
    assert.equal(cardArea({ kind: 'heal' }), 'health');
    assert.equal(cardArea({ kind: 'soak', soak: { noun: 'damage' } }), 'health');
    assert.equal(cardArea({ kind: 'soak', soak: { noun: 'drain' } }), 'magic');
    assert.equal(cardArea({ kind: 'soak', soak: { track: 'vehicle' } }), 'rigging');
    assert.equal(cardArea({ kind: 'plain' }), 'neutral');
    assert.equal(cardArea(null), 'neutral');
    assert.equal(cardArea({ kind: 'mystery' }), 'neutral');
  });

  test('every test kind of the snapshot type has a known area or is neutral on purpose', () => {
    const src = read('src', 'module', 'documents', 'index.ts');
    const block = src.slice(src.indexOf('export interface TestSnapshot'), src.indexOf('baseTargetNumber: number;', src.indexOf('export interface TestSnapshot')));
    const kinds = [...block.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]!);
    assert.ok(kinds.length > 30);
    const neutral = kinds.filter((k) => cardArea({ kind: k }) === 'neutral');
    assert.deepEqual(neutral, ['plain']);
  });

  test('the kind word over the card title', () => {
    assert.equal(cardKindLabel('attack'), 'Attack');
    assert.equal(cardKindLabel('soak'), 'Resist');
    assert.equal(cardKindLabel('zzz'), '');
  });
});

describe('portraits found by name', () => {
  const files = ['avatars/Rook.png', 'avatars/Rook.webp', 'avatars/rook.jpg', 'avatars/mr_johnson.png', 'avatars/notes.txt', 'avatars/Zoë%20Kane.jpg', 'avatars/Big.Mike.png'];
  test('an exact (case-blind) name wins, webp before png before jpg', () => {
    assert.equal(portraitFor('Rook', files), 'avatars/Rook.webp');
    assert.equal(portraitFor('ROOK', files), 'avatars/Rook.webp');
    assert.equal(portraitFor('Rook', ['a/rook.jpg', 'a/Rook.png']), 'a/Rook.png');
  });
  test('a loose match: punctuation, spaces, accents and encoded names', () => {
    assert.equal(portraitFor('Mr. Johnson', files), 'avatars/mr_johnson.png');
    assert.equal(portraitFor('Zoë Kane', files), 'avatars/Zoë%20Kane.jpg');
    assert.equal(portraitFor('Zoe Kane', files), 'avatars/Zoë%20Kane.jpg');
    assert.equal(portraitFor('Big.Mike', files), 'avatars/Big.Mike.png');
    assert.equal(portraitKey('  Mr. O’Neil '), 'mroneil');
  });
  test('no match, no name, not a picture', () => {
    assert.equal(portraitFor('Shiv', files), null);
    assert.equal(portraitFor('', files), null);
    assert.equal(portraitFor('notes', files), null);
    assert.equal(portraitFor('!!!', files), null);
  });
  test('only stand-ins (or the picture it set itself) are replaced', () => {
    assert.ok(isDefaultPortrait('icons/svg/mystery-man.svg'));
    assert.ok(!isDefaultPortrait('icons/svg/skull.svg'), 'a generic icon the GM picked is kept');
    assert.ok(isDefaultPortrait('systems/x/default.png', ['systems/x/default.png']));
    assert.ok(isDefaultPortrait(''));
    assert.ok(isDefaultPortrait(null));
    assert.ok(!isDefaultPortrait('worlds/x/rook-by-hand.png'));
    assert.ok(portraitReplaceable('avatars/Rook.webp', 'avatars/Rook.webp'));
    assert.ok(!portraitReplaceable('worlds/x/mine.png', 'avatars/Rook.webp'));
    assert.ok(!portraitReplaceable('worlds/x/mine.png', null));
  });
  test('the folder setting is cleaned', () => {
    assert.equal(cleanFolder(' /avatars/ '), 'avatars');
    assert.equal(cleanFolder('worlds\\w\\faces'), 'worlds/w/faces');
    assert.equal(cleanFolder('../secret'), '');
    assert.equal(cleanFolder(''), '');
  });
});
