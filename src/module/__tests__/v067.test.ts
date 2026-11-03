/**
 * v0.67.0: the look. Glue checks with small stubs (the rendering itself is checked in the live run):
 * our dialogs are found by the calling file, portraits by name, the GM panel's small monitor, the
 * status chip names, and template and stylesheet guards.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const g = globalThis as any;
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
let look: typeof import('../applications/look.ts');
let groups: typeof import('../applications/groups.ts');

let settings: Record<string, unknown> = {};
const notes: string[] = [];
let browsed: Array<[string, string]> = [];
let listing: string[] = [];

before(async () => {
  g.foundry = { applications: { api: { DialogV2: {} }, apps: { FilePicker: { implementation: { browse: async (src: string, folder: string) => { browsed.push([src, folder]); return { files: listing }; } } } }, instances: new Map() } };
  g.game = {
    settings: { get: (_ns: string, k: string) => { if (!(k in settings)) throw new Error(`not registered: ${k}`); return settings[k]; }, register: () => {} },
    user: { id: 'gm1', isGM: true }, users: { activeGM: { id: 'gm1' } }, scenes: [], actors: [],
  };
  g.ui = { notifications: { info: (m: string) => notes.push(m), warn: (m: string) => notes.push(`warn: ${m}`) } };
  g.Hooks = { on: () => {}, once: () => {} };
  look = await import('../applications/look.ts');
  groups = await import('../applications/groups.ts');
});

beforeEach(() => { settings = {}; notes.length = 0; browsed = []; listing = []; });

function actorStub(name: string, img = 'icons/svg/mystery-man.svg', proto = 'icons/svg/mystery-man.svg', flags: any = {}): any {
  const a: any = {
    id: 'a1', name, img, isOwner: true, prototypeToken: { texture: { src: proto } }, flags: { sr2e: { ...flags } }, updates: [] as any[],
    getFlag(ns: string, k: string) { return this.flags?.[ns]?.[k]; },
    async update(u: any, o: any) {
      this.updates.push([u, o]);
      if ('img' in u) this.img = u.img;
      if ('prototypeToken.texture.src' in u) this.prototypeToken.texture.src = u['prototypeToken.texture.src'];
      if (`flags.sr2e.portraitAuto` in u) this.flags.sr2e.portraitAuto = u['flags.sr2e.portraitAuto'];
    },
  };
  return a;
}

describe('our dialogs: tagged when the system opened them', () => {
  test('the calling frame decides (Chrome and Firefox stacks)', () => {
    const chrome = 'Error\n    at Function.sr2eDialogWrap [as prompt] (http://localhost:30000/systems/sr2e/index.mjs:10:5)\n    at SR2Actor.rollSkill (http://localhost:30000/systems/sr2e/index.mjs:900:3)';
    assert.equal(look.calledFromSystem(chrome), true);
    const other = 'Error\n    at Function.sr2eDialogWrap [as prompt] (http://localhost:30000/systems/sr2e/index.mjs:10:5)\n    at Object.open (http://localhost:30000/modules/some-mod/main.js:5:1)';
    assert.equal(look.calledFromSystem(other), false);
    const firefox = 'sr2eDialogWrap@http://localhost:30000/systems/sr2e/index.mjs:10:5\nrollSkill@http://localhost:30000/systems/sr2e/index.mjs:900:3';
    assert.equal(look.calledFromSystem(firefox), true);
    assert.equal(look.calledFromSystem('no frames'), false);
    assert.equal(look.calledFromSystem('Error\n    at sr2eDialogWrap (x)'), false, 'no caller frame');
  });

  test('the class is added once, and other options are kept', () => {
    assert.deepEqual(look.withDialogClass({ window: { title: 'T' } }), { window: { title: 'T' }, classes: ['sr2e-dialog'] });
    assert.deepEqual(look.withDialogClass({ classes: ['x'] }).classes, ['x', 'sr2e-dialog']);
    const once = look.withDialogClass({ classes: ['sr2e-dialog'] });
    assert.deepEqual(once.classes, ['sr2e-dialog']);
    assert.deepEqual(look.withDialogClass(undefined), { classes: ['sr2e-dialog'] });
  });

  test('the wrappers wrap each method once, keep `this`, and leave other callers alone', async () => {
    const calls: any[] = [];
    const D: any = { wait(this: any, cfg: any) { calls.push([this, cfg]); return Promise.resolve('ok'); }, prompt(cfg: any) { return D.wait(cfg); }, confirm: 5 };
    look.markSystemDialogs(D);
    const first = D.wait;
    look.markSystemDialogs(D);
    assert.equal(D.wait, first, 'not wrapped twice');
    assert.equal(D.confirm, 5, 'non-functions are left');
    assert.equal(await D.prompt({ content: 'x' }), 'ok');
    assert.equal(calls[0][0], D);
    // This test file is not under systems/sr2e/, so nothing is added.
    assert.deepEqual(calls[0][1], { content: 'x' });
  });

  test('our windows are found by class, id or options', () => {
    const el = (cls: string[], id = '') => ({ id, classList: { contains: (c: string) => cls.includes(c) } }) as any;
    assert.ok(look.isOurWindow({}, el(['sr2e'])));
    assert.ok(look.isOurWindow({}, el(['sr2e-dialog'])));
    assert.ok(look.isOurWindow({}, el([], 'sr2e-house-rules')));
    assert.ok(look.isOurWindow({ options: { classes: ['sr2e'] } }, el([])));
    assert.ok(!look.isOurWindow({}, el(['dialog'], 'settings-config')));
    assert.ok(!look.isOurWindow({}, null));
  });

  test('the look reads its settings (defaults when not registered)', () => {
    assert.deepEqual(look.readLook(), { theme: 'street', preset: 'cyan', opacity: 100, textScale: 100, reducedMotion: false });
    settings = { lookTheme: 'corp', lookPreset: 'magenta', windowOpacity: 70, textScale: 110, reducedMotion: true };
    assert.deepEqual(look.readLook(), { theme: 'corp', preset: 'magenta', opacity: 70, textScale: 110, reducedMotion: true });
    assert.equal(look.lookScheme(), 'light');
  });
});

describe('portraits found by name', () => {
  test('off without a folder', async () => {
    const a = actorStub('Rook');
    listing = ['avatars/Rook.webp'];
    assert.equal(await look.applyPortrait(a), false);
    settings = { portraitFolder: '' };
    assert.equal(await look.applyPortrait(a), false);
    assert.equal(browsed.length, 0);
  });

  test('a stand-in picture and token take the portrait; the flag remembers it', async () => {
    settings = { portraitFolder: '/avatars/', portraitTokens: true };
    listing = ['avatars/Rook.png', 'avatars/Rook.webp'];
    const a = actorStub('Rook');
    assert.equal(await look.applyPortrait(a, { fresh: true }), true);
    assert.deepEqual(browsed.at(-1), ['data', 'avatars']);
    assert.equal(a.img, 'avatars/Rook.webp');
    assert.equal(a.prototypeToken.texture.src, 'avatars/Rook.webp');
    assert.equal(a.flags.sr2e.portraitAuto, 'avatars/Rook.webp');
    assert.equal(a.updates[0][1].sr2ePortrait, true);
    assert.equal(a.updates[0][1].sr2eNoAdvance, true);
    // Again: nothing to change.
    assert.equal(await look.applyPortrait(a), false);
  });

  test('a picture set by hand is kept; tokens only when the setting says so', async () => {
    settings = { portraitFolder: 'avatars', portraitTokens: false };
    listing = ['avatars/Rook.webp'];
    const a = actorStub('Rook', 'worlds/w/my-rook.png');
    assert.equal(await look.applyPortrait(a, { fresh: true }), false);
    assert.equal(a.img, 'worlds/w/my-rook.png');
    const b = actorStub('Rook');
    assert.equal(await look.applyPortrait(b, { fresh: true }), true);
    assert.equal(b.img, 'avatars/Rook.webp');
    assert.equal(b.prototypeToken.texture.src, 'icons/svg/mystery-man.svg');
    // Live run: Foundry copies a new actor picture onto a token showing the old one, so "off" pins it explicitly.
    assert.equal(b.updates[0][0]['prototypeToken.texture.src'], 'icons/svg/mystery-man.svg');
    assert.equal(b.updates[0][1].diff, false, 'an unchanged value would be dropped by the diff');
  });

  test('a rename swaps a portrait it put there itself', async () => {
    settings = { portraitFolder: 'avatars', portraitTokens: true };
    listing = ['avatars/Rook.webp', 'avatars/Shiv.png'];
    const a = actorStub('Shiv', 'avatars/Rook.webp', 'avatars/Rook.webp', { portraitAuto: 'avatars/Rook.webp' });
    assert.equal(await look.applyPortrait(a, { fresh: true }), true);
    assert.equal(a.img, 'avatars/Shiv.png');
    assert.equal(a.prototypeToken.texture.src, 'avatars/Shiv.png');
  });

  test('no file for the name, or no permission: nothing happens', async () => {
    settings = { portraitFolder: 'avatars', portraitTokens: true };
    listing = ['avatars/Rook.webp'];
    assert.equal(await look.applyPortrait(actorStub('Nobody'), { fresh: true }), false);
    const a = actorStub('Rook'); a.isOwner = false;
    assert.equal(await look.applyPortrait(a, { fresh: true }), false);
  });

  test('find all is for the GM only', async () => {
    settings = { portraitFolder: 'avatars', portraitTokens: true };
    g.game.user.isGM = false;
    try { assert.equal(await look.findAllPortraits(), 0); assert.match(notes.at(-1)!, /Only the GM/); } finally { g.game.user.isGM = true; }
    assert.equal(browsed.length, 0);
  });

  test('a generic icon the GM chose is kept', async () => {
    settings = { portraitFolder: 'avatars', portraitTokens: true };
    listing = ['avatars/Rook.webp'];
    const a = actorStub('Rook', 'icons/svg/skull.svg', 'icons/svg/skull.svg');
    assert.equal(await look.applyPortrait(a, { fresh: true }), false);
    assert.equal(a.img, 'icons/svg/skull.svg');
  });

  test('find all: warns without a folder, counts the changes', async () => {
    assert.equal(await look.findAllPortraits(), 0);
    assert.match(notes.at(-1)!, /^warn: Set a portrait folder/);
    settings = { portraitFolder: 'avatars', portraitTokens: true };
    listing = ['avatars/Rook.webp', 'avatars/Shiv.webp'];
    g.game.actors = [actorStub('Rook'), actorStub('Shiv'), actorStub('Nobody')];
    assert.equal(await look.findAllPortraits(), 2);
    assert.match(notes.at(-1)!, /2 actors/);
    g.game.actors = [];
  });
});

describe('the GM panel rows carry the small monitor', () => {
  test('people get it with overflow; spirits without; vehicles none', () => {
    const p = groups.personRow({ type: 'npc', name: 'ZZ Ganger', system: { monitor: { physical: 11, stun: 0 }, attributes: { body: { total: 4 } }, derived: {} }, items: [] });
    assert.equal(p.cm.physical.filled, 10);
    assert.equal(p.cm.overflow.body, 4);
    assert.equal(p.cm.overflow.filled, 1);
    assert.ok(read('src', 'module', 'applications', 'ui.ts').includes("{ overflow: a.type !== 'spirit' }"), 'party rows too');
    const s = groups.personRow({ type: 'spirit', name: 'ZZ Spirit', system: { monitor: { physical: 3, stun: 0 }, attributes: { body: { total: 5 } }, derived: {} }, items: [] });
    assert.equal(s.cm.overflow, null);
    const v = groups.personRow({ type: 'vehicle', name: 'ZZ Van', system: { condition: 2, derived: {} }, items: [] });
    assert.equal(v.cm, null);
  });
});

describe('templates and the stylesheet', () => {
  test('every monitor on the character, NPC and spirit sheets is the wound-group partial', () => {
    for (const f of ['actor-character-sheet.hbs', 'actor-npc-sheet.hbs', 'actor-spirit-sheet.hbs']) {
      const t = read('public', 'templates', f);
      assert.ok(t.includes('{{> "systems/sr2e/templates/monitor.hbs"}}'), f);
      assert.ok(!t.includes('{{#each monitorTracks}}'), f);
    }
    assert.ok(read('public', 'templates', 'matrix-section.hbs').includes('monitor-track.hbs" t=matrix.track action="setMatrixMonitor"'));
    assert.ok(read('public', 'templates', 'actor-ic-sheet.hbs').includes('monitor-track.hbs" t=track action="setMatrixMonitor"'));
    const gm = read('public', 'templates', 'gm-panel.hbs');
    assert.equal((gm.match(/monitor-mini\.hbs/g) ?? []).length, 2, 'party and people rows');
    // v0.68.0: the small monitor moved from the summary to the always-visible status strip.
    assert.ok(read('public', 'templates', 'status-strip.hbs').includes('monitor-mini.hbs'));
    const sys = read('src', 'module', 'sr2e-system.ts');
    for (const p of ['monitor.hbs', 'monitor-track.hbs', 'monitor-mini.hbs']) assert.ok(sys.includes(`/${p}\``), p);
  });

  test('the monitor partial: Physical, then Overflow beside it, then Stun; boxes keep the setMonitor action', () => {
    const m = read('public', 'templates', 'monitor.hbs');
    const ip = m.indexOf('t=cm.physical'); const io = m.indexOf('sr2e-cm-overflow'); const is = m.indexOf('t=cm.stun');
    assert.ok(ip > 0 && io > ip && is > io);
    assert.match(m, /data-action="setMonitor" data-track="physical" data-value="\{\{value\}\}"/);
    assert.match(m, /\{\{#if cm\.overflow\.idle\}\} idle\{\{\/if\}\}/);
    const t = read('public', 'templates', 'monitor-track.hbs');
    assert.match(t, /data-action="\{\{\.\.\/\.\.\/action\}\}" data-track="\{\{\.\.\/\.\.\/t\.track\}\}"/);
    for (const f of ['monitor.hbs', 'monitor-track.hbs', 'monitor-mini.hbs']) {
      const s = read('public', 'templates', f);
      const opens = (s.match(/\{\{#(if|each|unless)\b/g) ?? []).length;
      const closes = (s.match(/\{\{\/(if|each|unless)\}\}/g) ?? []).length;
      assert.equal(opens, closes, f);
    }
  });

  test('the fonts are bundled (no CDN) with their licences', () => {
    const css = read('public', 'style', 'sr2e.css');
    const urls = [...css.matchAll(/url\("\.\.\/fonts\/([^"]+)"\)/g)].map((m) => m[1]!);
    assert.equal(urls.length, 8);
    for (const u of urls) assert.ok(existsSync(join(process.cwd(), 'public', 'fonts', u)), u);
    for (const l of ['OFL-ChakraPetch.txt', 'OFL-Inter.txt', 'OFL-JetBrainsMono.txt']) assert.match(read('public', 'fonts', l), /SIL Open Font License/);
    assert.ok(!/fonts\.googleapis|fonts\.gstatic|@import url\(/.test(css));
  });

  test('the look is scoped to our windows and cards (not Foundry\'s sidebar, chat log or tracker)', () => {
    const css = read('public', 'style', 'sr2e.css');
    const layer = css.slice(css.indexOf('v0.67.0: the look.'));
    const bare = layer.replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...bare.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map((m) => m[2]!.trim()).filter((s) => s && !s.startsWith('from') && !/^\d/.test(s));
    const ok = /\.sr2e-look|\.sr2e-card|\.sr2e-cm|\.sr2e-hover-card|sr2e-inline-test|^:root$|\.sr2e-gm-panel|^@font-face|\.sr2e-flash|\.sr2e-sheet\.sr2e-play/;
    const topLevel = (sel: string) => { const out: string[] = []; let depth = 0; let cur = '';
      for (const ch of sel) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; }
      out.push(cur); return out.map((x) => x.trim()).filter(Boolean); };
    const stray = selectors.filter((s) => !topLevel(s).every((part) => ok.test(part)));
    assert.deepEqual(stray, []);
    assert.ok(!/#sidebar|#combat|\.combat-tracker|#chat-log(?!.*sr2e-card)/.test(bare));
    // The braces still balance.
    const b = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"]*"/g, '""');
    assert.equal((b.match(/\{/g) ?? []).length, (b.match(/\}/g) ?? []).length);
  });

  test('text is never faded with opacity (muted colours instead); the few opacities left are pips, hovers and the tracker', () => {
    const css = read('public', 'style', 'sr2e.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const fades = [...css.matchAll(/([^{}]+)\{[^}]*opacity:\s*0?\.\d+/g)].map((m) => m[1]!.trim());
    const allowed = /\.sr2e-pip|\.sr2e-tracker-pools|\.sr2e-pass|\.sr2e-cm-overflow\.idle|\.sr2e-cm-bar\.sr2e-cm-overflow\.idle/;
    assert.deepEqual(fades.filter((s) => !allowed.test(s)), []);
  });

  test('review fixes: our rules beat the card colour reset; disabled buttons look disabled; no hard-coded greens', () => {
    const css = read('public', 'style', 'sr2e.css');
    assert.ok(!/li\.chat-message\.sr2e-card \.message-content :is\([^)]*span/.test(css), 'a colour reset that beats the dice and warnings');
    assert.ok(css.includes(':where(li.chat-message.sr2e-card .message-content) :where(p, li, td, th, summary) { color: inherit; }'));
    assert.ok(css.includes('prose-mirror button, :disabled) {'), 'the base button rule skips disabled buttons');
    assert.ok(!css.includes('#3a9a5b'));
    assert.ok(!/--button-hover-text-color:\s*var\(--sr2e-window\)/.test(css), 'window colour on an area colour fails AA on Corp');
    assert.match(css, /li\.chat-message\.sr2e-card\.whisper \{/);
    assert.ok(css.includes('.application.sr2e-look:has(prose-mirror.active) > .window-content { zoom: 1; }'), 'live run: the editor menus are misplaced under zoom');
    assert.match(css, /li\.chat-message\.sr2e-card\.blind \{/);
  });

  test('old colour variables no longer shadow the palette', () => {
    const css = read('public', 'style', 'sr2e.css');
    assert.ok(!/--sr2e-muted:\s*var\(--color-text-subtle/.test(css));
    assert.ok(!/--sr2e-accent:\s*var\(--color-warm-2/.test(css));
    assert.ok(!/--sr2e-danger:\s*#/.test(css), 'danger comes from the palette');
    assert.ok(!/parchment\.jpg/.test(css));
  });

  test('test cards carry the big success count, and the fold line hides its repeat', () => {
    const src = read('src', 'module', 'documents', 'index.ts');
    assert.ok(src.includes('<div class="sr2e-count"><b>${r.successes}</b>'));
    assert.ok(src.includes('<div class="sr2e-count sr2e-count-botch">'));
    assert.ok(src.includes('<span class="sr2e-sum-out"> · ${outcome}</span>'));
    assert.ok(read('public', 'style', 'sr2e.css').includes('.sr2e-count ~ details.sr2e-fold .sr2e-sum-out { display: none; }'));
  });

  test('summary chips show status names, not ids, and skip the wound icons', () => {
    const src = read('src', 'module', 'applications', 'sheets.ts');
    assert.ok(src.includes('String(st).startsWith("sr2eWound")'));
    assert.ok(src.includes('chips.push(statusLabel(String(st)))'));
  });
});
