/**
 * v0.93.4 (readability, report item 16): the themes. Visible unticked checkboxes from one palette colour per theme,
 * High contrast held to 7:1, Corp's light title bar, the Overflow box not greyed, and "Follow Foundry" as the default.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  THEMES, PRESETS, palette, contrast, contrastPairs, contrastProblems, paletteVars, paletteCss, normalizeLook,
  THEME_CHOICES, THEME_CHOICE_LABELS, THEME_LABELS, DEFAULT_THEME_CHOICE, normalizeThemeChoice, foundrySchemeFrom, resolveTheme, windowTheme,
  WINDOW_THEME_PREFIX, LOOK_DEFAULTS,
} from '../rules/look.ts';

const g = globalThis as any;
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
// v0.93.4: the themes section of sr2e.css.
const CSS = (() => { const all = read('public', 'style', 'sr2e.css'); const i = all.indexOf('(readability, report item 16): the themes'); return all.slice(i, all.indexOf('sizes and the 1024×768 fit', i)); })();

describe('unticked checkboxes and radios are visible in every theme', () => {
  for (const t of THEMES) for (const pr of PRESETS) {
    test(`${t} / ${pr}`, () => {
      const p = palette(t, pr);
      for (const bg of ['sunk', 'window', 'raised', 'chip'] as const) assert.ok(contrast(p.controlEdge, p[bg]) >= 3, `edge on ${bg}`);
      assert.ok(contrast(p.accent, p.sunk) >= 3, 'ticked against unticked');
      assert.ok(contrast(p.controlMark, p.accent) >= 4.5, 'the tick');
      const what = contrastPairs(p).map((x) => x.what).join('\n');
      assert.match(what, /controlEdge on sunk/);
      assert.match(what, /controlMark on accent/);
      assert.deepEqual(contrastProblems(p).map((x) => x.what), []);
      assert.equal(paletteVars(p)['--sr2e-control-edge'], p.controlEdge);
    });
  }

  test('High contrast: white edges, a 2 px edge and a thicker focus ring', () => {
    for (const pr of PRESETS) {
      const p = palette('contrast', pr);
      assert.equal(p.controlEdge, '#ffffff');
      assert.equal(paletteVars(p)['--sr2e-control-edge-width'], '2px');
    }
    assert.equal(paletteVars(palette('street', 'cyan'))['--sr2e-control-edge-width'], '2px'); // v0.93.4 live run: 1.5px rounded down to 1px on a 1x screen
    assert.match(CSS, /body\.sr2e-theme-contrast[^{]*:focus-visible \{\s*outline: 3px/);
  });

  test('the stylesheet draws them only in our windows and cards, from the one palette colour, at 16 px', () => {
    const rules = CSS.split('}').filter((r) => /input:is\(\[type="checkbox"\], \[type="radio"\]\) \{/.test(r));
    assert.equal(rules.length, 1);
    const r = rules[0]!;
    assert.match(r, /^\s*(\/\*[\s\S]*?\*\/\s*)*:is\(\.sr2e-look, \.sr2e-card, \.sr2e-hover-card\)/m);
    assert.match(r, /border: var\(--sr2e-control-edge-width, 2px\) solid var\(--sr2e-control-edge/);
    assert.match(r, /width: 16px; height: 16px/);
    // Every checkbox or radio selector is scoped to our windows and cards.
    for (const sel of CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('{').map((x) => x.split('}').pop()!.trim()).filter((x) => /checkbox|radio/.test(x))) {
      assert.match(sel, /\.sr2e-look/, sel);
    }
  });
});

describe('High contrast is really higher', () => {
  test('every text pair is held to 7:1 (labels, hints, tick labels, area headings, card strips)', () => {
    for (const pr of PRESETS) {
      const p = palette('contrast', pr);
      const text = contrastPairs(p).filter((x) => x.min >= 4.5);
      assert.ok(text.length > 20);
      for (const x of text) assert.ok(x.min >= 7 && contrast(x.fg, x.bg) >= 7, `${pr}: ${x.what} ${contrast(x.fg, x.bg).toFixed(2)}`);
      assert.ok(contrast(p.muted, p.window) >= 7 && contrast(p.muted, p.sunk) >= 7);
    }
  });

  test('the selected tab is inverted, fields and sections take 2 px edges', () => {
    assert.match(CSS, /body\.sr2e-theme-contrast \.application\.sr2e-look :is\(\.sr2e-tabs \.item\.active[^{]*\{\s*background: var\(--sr2e-ink\); color: var\(--sr2e-window\)/);
    assert.match(CSS, /body\.sr2e-theme-contrast \.application\.sr2e-look :is\(input:not[^{]*\{ border-width: 2px/);
    assert.match(CSS, /body\.sr2e-theme-contrast \.application\.sr2e-look :is\(fieldset[^{]*\{ border-width: 2px/);
    for (const pr of PRESETS) assert.ok(contrast(palette('contrast', pr).window, palette('contrast', pr).text) >= 7);
  });
});

describe('Corp', () => {
  test('secondary text at 4.5:1 or more on every surface', () => {
    for (const pr of PRESETS) {
      const p = palette('corp', pr);
      for (const bg of ['window', 'raised', 'chip', 'sunk'] as const) assert.ok(contrast(p.muted, p[bg]) >= 4.5, `${pr} muted on ${bg}`);
    }
  });

  test('a light title bar: the body\'s dark text and its accent line (one theme per window)', () => {
    for (const pr of PRESETS) {
      const p = palette('corp', pr);
      assert.equal(p.headerText, p.text);
      assert.equal(p.headerAccent, p.accent);
      assert.ok(contrast(p.header, '#ffffff') < contrast(p.header, '#000000'), 'the bar is light');
      assert.ok(contrast(p.headerText, p.header) >= 4.5 && contrast(p.headerAccent, p.header) >= 3);
    }
  });
});

describe('the Overflow box is not greyed as if disabled', () => {
  test('no grayscale filter or opacity; marked by a dashed edge and a hatch; normal text', () => {
    const idle = CSS.match(/\.sr2e-cm-track\.sr2e-cm-overflow\.idle \{([^}]*)\}/)?.[1] ?? '';
    assert.match(idle, /filter: none; opacity: 1/);
    assert.match(idle, /border-style: dashed/);
    assert.match(idle, /repeating-linear-gradient/);
    assert.match(CSS, /\.sr2e-cm-overflow\.idle \.sr2e-cm-group > i[^{]*\{ color: var\(--sr2e-ink\)/);
    assert.match(CSS, /\.sr2e-cm-bar\.sr2e-cm-overflow\.idle \{ filter: none; opacity: 1; \}/);
  });
});

describe('Follow Foundry', () => {
  test('a new choice, the default; the themes keep their labels', () => {
    assert.deepEqual([...THEME_CHOICES], ['follow', 'street', 'corp', 'contrast']);
    assert.equal(DEFAULT_THEME_CHOICE, 'follow');
    assert.equal(THEME_CHOICE_LABELS.follow, 'SR2E.Settings.lookTheme.Choices.follow');
    for (const t of THEMES) assert.equal(THEME_CHOICE_LABELS[t], THEME_LABELS[t]);
    // The new key goes into lang/en.json when merged; until then the draft beside the repo has it.
    const DRAFT = '/home/claude/work/agent-look-lang.json';
    const draft = (existsSync(DRAFT) ? JSON.parse(readFileSync(DRAFT, 'utf8')) : {}) as Record<string, string>;
    for (const k of Object.values(THEME_CHOICE_LABELS)) assert.ok(draft[k] || g.__SR2E_EN__?.[k], k);
  });

  test('stored values are cleaned: a choice is kept, old dark/light map, anything else follows', () => {
    for (const c of THEME_CHOICES) assert.equal(normalizeThemeChoice(c), c);
    assert.equal(normalizeThemeChoice('dark'), 'street');
    assert.equal(normalizeThemeChoice('light'), 'corp');
    assert.equal(normalizeThemeChoice('Corp'), 'corp');
    for (const v of [undefined, null, '', 'neon', 5, {}]) assert.equal(normalizeThemeChoice(v), 'follow');
    // normalizeLook still takes only a resolved theme, unknown values falling back.
    assert.equal(normalizeLook({ theme: 'follow' }).theme, LOOK_DEFAULTS.theme);
    assert.equal(normalizeLook({ theme: 'neon' }).theme, 'street');
  });

  test("Foundry's scheme: its setting, else the browser's, else dark", () => {
    assert.equal(foundrySchemeFrom('light', true), 'light');
    assert.equal(foundrySchemeFrom('dark', false), 'dark');
    assert.equal(foundrySchemeFrom('', false), 'light');
    assert.equal(foundrySchemeFrom('', true), 'dark');
    assert.equal(foundrySchemeFrom(undefined, null), 'dark');
    assert.equal(foundrySchemeFrom('weird', undefined), 'dark');
  });

  test('resolves to Corp on light and Street on dark; a chosen theme stays', () => {
    assert.equal(resolveTheme('follow', 'light'), 'corp');
    assert.equal(resolveTheme('follow', 'dark'), 'street');
    assert.equal(resolveTheme('follow', null), 'street');
    assert.equal(resolveTheme('contrast', 'light'), 'contrast');
    assert.equal(resolveTheme('street', 'light'), 'street');
    assert.equal(resolveTheme('bogus', 'light'), 'corp');
  });

  test("a sheet's own Foundry theme counts only while following", () => {
    assert.equal(windowTheme('follow', 'dark', 'light'), 'corp');
    assert.equal(windowTheme('follow', 'light', 'dark'), 'street');
    assert.equal(windowTheme('follow', 'light', null), 'corp');
    assert.equal(windowTheme('street', 'light', 'light'), 'street');
    assert.equal(windowTheme('contrast', 'dark', 'light'), 'contrast');
  });

  test('the palette has per-window blocks after the body ones', () => {
    const css = paletteCss();
    const body = css.indexOf('body.sr2e-theme-corp.sr2e-preset-cyan');
    const win = css.indexOf(`body.sr2e-preset-cyan .sr2e-look.${WINDOW_THEME_PREFIX}corp {`);
    assert.ok(body > 0 && win > body);
  });
});

describe('Follow Foundry: the Foundry side', () => {
  let look: typeof import('../applications/look.ts');
  let settings: Record<string, unknown> = {};
  let core: unknown;
  let dark: boolean | undefined;
  const hooks: Record<string, Array<(...a: any[]) => void>> = {};

  before(async () => {
    g.foundry = { applications: { api: { DialogV2: {} }, apps: {}, instances: new Map() } };
    g.game = {
      settings: {
        get: (ns: string, k: string) => {
          if (ns === 'core' && k === 'uiConfig') { if (core === undefined) throw new Error('none'); return core; }
          if (!(k in settings)) throw new Error(`not registered: ${k}`);
          return settings[k];
        },
        register: (_ns: string, k: string, cfg: any) => { registered[k] = cfg; },
      },
      user: { id: 'u1', isGM: false }, users: {}, scenes: [], actors: [],
    };
    g.Hooks = { on: (n: string, f: any) => { (hooks[n] ??= []).push(f); }, once: () => {} };
    g.matchMedia = (q: string) => ({ matches: q.includes('dark') ? dark === true : false, addEventListener: () => {} });
    look = await import('../applications/look.ts');
  });
  const registered: Record<string, any> = {};
  beforeEach(() => { settings = {}; core = undefined; dark = undefined; });

  test('the setting: Follow Foundry is the default and a choice', () => {
    look.registerLookSettings();
    assert.equal(registered['lookTheme'].default, 'follow');
    assert.deepEqual(Object.keys(registered['lookTheme'].choices), ['follow', 'street', 'corp', 'contrast']);
  });

  test("the default follows Foundry's setting, then the browser", () => {
    core = { colorScheme: { applications: 'light' } };
    assert.equal(look.readLook().theme, 'corp');
    core = { colorScheme: { applications: 'dark' } };
    assert.equal(look.readLook().theme, 'street');
    core = { colorScheme: { applications: '' } };
    dark = false;
    assert.equal(look.readLook().theme, 'corp');
    dark = true;
    assert.equal(look.readLook().theme, 'street');
    core = undefined;
    const mm = g.matchMedia;
    g.matchMedia = undefined;
    try { assert.equal(look.readLook().theme, 'street', 'nothing known: Street'); } finally { g.matchMedia = mm; }
    g.matchMedia = () => { throw new Error('no'); };
    try { assert.equal(look.readLook().theme, 'street', 'a failing query: Street'); } finally { g.matchMedia = mm; }
  });

  test('a player who chose keeps it', () => {
    core = { colorScheme: { applications: 'light' } };
    settings = { lookTheme: 'street' };
    assert.equal(look.readLook().theme, 'street');
    settings = { lookTheme: 'contrast' };
    assert.equal(look.readLook().theme, 'contrast');
  });

  test("a sheet's own light or dark theme is read from Foundry's sheet config or the app's classes", () => {
    assert.equal(look.sheetScheme({ options: { classes: ['sr2e', 'theme-light'] } }), 'light');
    assert.equal(look.sheetScheme({ options: { classes: ['sr2e'] } }), null);
    g.foundry.applications.apps.DocumentSheetConfig = { getSheetThemeForDocument: () => 'dark' };
    assert.equal(look.sheetScheme({ document: {}, options: { classes: ['theme-light'] } }), 'dark');
    g.foundry.applications.apps.DocumentSheetConfig = { getSheetThemeForDocument: () => { throw new Error('x'); } };
    assert.equal(look.sheetScheme({ document: {}, options: { classes: ['theme-light'] } }), 'light');
    delete g.foundry.applications.apps.DocumentSheetConfig;
    assert.equal(look.sheetScheme(null), null);
  });

  test('a window gets its theme class and scheme; a sheet with its own theme follows it while following', () => {
    const el = () => {
      const set = new Set<string>(['theme-dark']);
      return { set, classList: { add: (...c: string[]) => c.forEach((x) => set.add(x)), remove: (...c: string[]) => c.forEach((x) => set.delete(x)), contains: (c: string) => set.has(c) } } as any;
    };
    core = { colorScheme: { applications: 'dark' } };
    const a = el();
    look.themeApp({ options: { classes: ['sr2e', 'theme-light'] } }, a);
    assert.ok(a.set.has(`${WINDOW_THEME_PREFIX}corp`) && a.set.has('theme-light') && !a.set.has('theme-dark') && a.set.has('sr2e-look'));
    const b = el();
    look.themeApp({ options: { classes: ['sr2e'] } }, b);
    assert.ok(b.set.has(`${WINDOW_THEME_PREFIX}street`) && b.set.has('theme-dark'));
    settings = { lookTheme: 'contrast' };
    look.themeApp({ options: { classes: ['sr2e', 'theme-light'] } }, a);
    assert.ok(a.set.has(`${WINDOW_THEME_PREFIX}contrast`) && !a.set.has(`${WINDOW_THEME_PREFIX}corp`) && a.set.has('theme-dark'));
  });

  test("it re-applies when Foundry's colour scheme changes", () => {
    look.registerLook();
    assert.ok((hooks['clientSettingChanged'] ?? []).length >= 1);
    assert.ok((hooks['updateSetting'] ?? []).length >= 1);
    // Called with another key, or with no document body, nothing throws.
    for (const f of hooks['clientSettingChanged']!) { f('core.other'); f('core.uiConfig'); }
    for (const f of hooks['updateSetting']!) { f({ key: 'core.uiConfig' }); f(null); }
  });
});
