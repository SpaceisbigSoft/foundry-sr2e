/**
 * v0.68.0: the GM side of the second interface pass. Glue checks with small stubs: the party cards and the
 * mook stat cards in the GM panel's template, every panel action registered, the NPC row's stat line, and
 * the combat tracker's banner, acting row, delayed group and full-defense badges (on a tiny fake DOM).
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { join } from 'node:path';
import { readEnglish } from './helpers/english.ts';

const g = globalThis as any;
// v0.89.0: templates are read back in English (their text is in lang/en.json).
const read = (...p: string[]) => readEnglish(join(process.cwd(), ...p));
const tpl = read('public', 'templates', 'gm-panel.hbs');
const ui = read('src', 'module', 'applications', 'ui.ts');

// ---------------------------------------------------------------- A tiny DOM (only the selectors the tracker code uses)

class FakeClassList {
  constructor(private el: FakeEl) {}
  private get list(): string[] { return this.el.className.split(/\s+/).filter(Boolean); }
  contains(c: string) { return this.list.includes(c); }
  add(...cs: string[]) { const l = this.list; for (const c of cs) if (!l.includes(c)) l.push(c); this.el.className = l.join(' '); }
  remove(...cs: string[]) { this.el.className = this.list.filter((x) => !cs.includes(x)).join(' '); }
  toggle(c: string, on?: boolean) { const want = on ?? !this.contains(c); if (want) this.add(c); else this.remove(c); return want; }
}

class FakeEl {
  tagName: string; className = ''; children: FakeEl[] = []; parentElement: FakeEl | null = null; dataset: Record<string, string> = {};
  attrs: Record<string, string> = {}; title = ''; private _text = ''; innerHTML = '';
  classList = new FakeClassList(this);
  constructor(tag: string) { this.tagName = tag.toUpperCase(); }
  get textContent(): string { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v: string) { this._text = v; this.children = []; }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  appendChild(c: FakeEl) { c.remove(); c.parentElement = this; this.children.push(c); return c; }
  prepend(c: FakeEl) { c.remove(); c.parentElement = this; this.children.unshift(c); }
  insertBefore(c: FakeEl, ref: FakeEl | null) { c.remove(); c.parentElement = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  remove() { if (this.parentElement) { const p = this.parentElement; p.children = p.children.filter((x) => x !== this); this.parentElement = null; } }
  replaceChildren() { for (const c of [...this.children]) c.remove(); this._text = ''; }
  addEventListener() {}
  get firstElementChild(): FakeEl | null { return this.children[0] ?? null; }
  private all(): FakeEl[] { return this.children.flatMap((c) => [c, ...c.all()]); }
  private static matches(el: FakeEl, sel: string): boolean {
    const m = /^([a-z0-9]*)((?:\.[\w-]+)*)((?:\[[\w-]+\])*)$/i.exec(sel.trim());
    if (!m) throw new Error(`fake DOM: unsupported selector ${sel}`);
    const [, tag, classes, attrs] = m;
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    for (const c of (classes ?? '').split('.').filter(Boolean)) if (!el.classList.contains(c)) return false;
    for (const a of [...(attrs ?? '').matchAll(/\[([\w-]+)\]/g)].map((x) => x[1]!)) {
      if (a === 'data-combatant-id') { if (!el.dataset['combatantId']) return false; } else if (!(a in el.attrs)) return false;
    }
    return true;
  }
  querySelectorAll(selector: string): FakeEl[] {
    const parts = selector.split(',').map((s) => s.trim());
    const out: FakeEl[] = [];
    for (const el of this.all()) {
      if (parts.some((p) => (p.startsWith(':scope >') ? el.parentElement === this && FakeEl.matches(el, p.slice(8)) : FakeEl.matches(el, p)))) out.push(el);
    }
    return Object.assign(out, { forEach: Array.prototype.forEach }) as any;
  }
  querySelector(selector: string): FakeEl | null { return this.querySelectorAll(selector)[0] ?? null; }
}

const el = (tag: string, cls = '', data: Record<string, string> = {}): FakeEl => { const e = new FakeEl(tag); e.className = cls; Object.assign(e.dataset, data); return e; };

let hooks: Record<string, Array<(...a: any[]) => unknown>> = {};
let groups: typeof import('../applications/groups.ts');

before(async () => {
  g.foundry ??= { applications: { api: {} } };
  g.game = { user: { id: 'gm', isGM: true }, i18n: { localize: (k: string) => (k === 'EFFECT.StatusBlind' ? 'Blind' : k) }, settings: { get: () => undefined } };
  g.ui = { notifications: { info: () => {}, warn: () => {} } };
  g.Hooks = { on: (h: string, fn: any) => { (hooks[h] ??= []).push(fn); }, once: () => {} };
  g.document = { createElement: (t: string) => new FakeEl(t), body: null };
  g.fromUuidSync = () => null;
  g.CONFIG = { statusEffects: [{ id: 'blind', name: 'EFFECT.StatusBlind' }] };
  groups = await import('../applications/groups.ts');
  const tokens = await import('../applications/tokens.ts');
  hooks = {};
  tokens.registerTokenHooks();
});

// ---------------------------------------------------------------- The GM panel

describe('GM panel: party cards and mook stat cards', () => {
  test('the Party tab shows cards with the portrait, sheet link, monitor, ± boxes, pools, money and quick buttons', () => {
    const party = tpl.slice(tpl.indexOf('<h2>Party</h2>'), tpl.indexOf('<h2>Money and Karma</h2>'));
    assert.ok(party.includes('<div class="sr2e-party-cards">'));
    assert.match(party, /<article class="sr2e-party-card/);
    assert.match(party, /<img class="sr2e-pc-portrait" src="\{\{img\}\}"/);
    assert.match(party, /data-action="openActor" data-uuid="\{\{uuid\}\}"[^>]*>\{\{name\}\}<\/a>/);
    assert.ok(party.includes('{{> "systems/sr2e/templates/monitor-mini.hbs"}}'));
    for (const t of ['physical', 'stun']) for (const d of ['-1', '1']) assert.ok(party.includes(`data-action="box" data-uuid="{{uuid}}" data-track="${t}" data-delta="${d}"`), `${t} ${d}`);
    assert.ok(party.includes('{{#each poolChips}}'));
    assert.ok(party.includes('{{woundText}}'));
    assert.ok(party.includes('{{nuyenText}}'));
    assert.ok(party.includes('data-act="sheet"'));
    assert.match(party, /\{\{#if inCombat\}\}<a data-action="quick" data-act="init"/);
    // The rest of the tab stays as it was.
    for (const a of ['refreshPools', 'refreshKarma', 'award', 'healSeveral', 'projectTimeGm', 'projectFinishGm']) assert.ok(tpl.includes(`data-action="${a}"`), a);
    assert.ok(tpl.includes('<table class="sr2e-group sr2e-gm-money">'));
  });

  test('NPC rows: the stat card line under the name, the toggle in both headings, every quick action kept', () => {
    const row = tpl.slice(0, tpl.indexOf('{{/inline}}'));
    assert.ok(row.includes('{{#if @root.mookCards}}{{#if stat}}'));
    assert.ok(row.includes('<div class="sr2e-mook-stats"'));
    assert.ok(row.indexOf('sr2e-mook-stats') > row.indexOf('<strong>{{name}}</strong>'), 'under the name line');
    for (const a of ['quickAttack', 'quickCast', 'defend', 'perceive', 'morale', 'init', 'sheet']) assert.ok(row.includes(`data-act="${a}"`), a);
    assert.ok(row.includes('data-action="panToken"') && row.includes('data-action="box"'));
    assert.equal((tpl.match(/data-action="toggleMookCards"/g) ?? []).length, 2);
    assert.match(ui, /toggleMookCards:\s*SR2GmPanel\.#onToggleMookCards/);
    assert.match(ui, /mookCards: SR2GmPanel\.mookCards\(\)/);
  });

  test('every data-action in the GM panel has a handler (the panel\'s own, Setup\'s or the catalogue\'s)', () => {
    const src = ui + read('src', 'module', 'applications', 'setup.ts') + read('src', 'module', 'applications', 'catalogue.ts');
    const missing = [...new Set([...tpl.matchAll(/data-action="([^"{]+)"/g)].map((m) => m[1]!))]
      .filter((a) => !new RegExp(`(?<![\\w.])${a}\\s*:`).test(src));
    assert.deepEqual(missing, []);
  });

  test('personRow: a stat line for NPCs, none for player characters or vehicles', () => {
    const npc: any = {
      uuid: 'Actor.n', name: 'Guard', type: 'npc', hasPlayerOwner: false,
      system: { attributes: { body: { total: 5 }, quickness: { total: 4 }, strength: { total: 4 }, charisma: { total: 2 }, intelligence: { total: 3 }, willpower: { total: 3 } },
        derived: { reaction: 3, initiativeDice: 1, status: 'ok' }, monitor: { physical: 0, stun: 0 }, professionalRating: 2, grunts: { size: 4, down: 1 } },
      items: [{ type: 'weapon', name: 'Colt Manhunter', sort: 1, system: { damagePower: 9, damageLevel: 'M' } }, { type: 'spell', name: 'Stunbolt' }],
      armorRating: (k: string) => (k === 'ballistic' ? 4 : 2),
      fullDefenseUp: () => true,
    };
    const r = groups.personRow(npc);
    assert.equal(r.stat.text, 'B 5 Q 4 S 4 C 2 I 3 W 3 R 3 · Armor 4/2 · Init 3 + 1D6 · PR 2 · 3/4 grunts · Colt Manhunter 9M');
    assert.ok(r.chips.includes('full defense'));
    assert.equal(groups.personRow({ ...npc, hasPlayerOwner: true }).stat, null);
    assert.equal(groups.personRow({ ...npc, type: 'vehicle' }).stat, null);
    // A throwing armor lookup doesn't break the row.
    assert.equal(groups.personRow({ ...npc, armorRating: () => { throw new Error('x'); } }).stat.armor, '0/0');
  });

  test('status names for the party cards come from Foundry\'s list, localized', () => {
    assert.deepEqual(groups.statusNames({ statuses: new Set(['blind', 'odd']) }), ['Blind', 'odd']);
    assert.deepEqual(groups.statusNames({}), []);
    assert.deepEqual(groups.combatChips({ isDelaying: () => true, actingNow: () => { throw new Error('no combat'); } }), ['delaying']);
  });

  test('the GM panel CSS: panel rules use only the palette, tracker rules only Foundry\'s variables', () => {
    // The two v0.68.0 GM parts of sr2e.css: the tracker (before the look section) and the GM panel.
    const all = read('public', 'style', 'sr2e.css');
    const cut = (from: string, to: string) => { const i = all.indexOf(from); const j = all.indexOf(to, i + 1); assert.ok(i > 0 && j > i, from); return all.slice(i, j); };
    const css = (cut('v0.68.0: the combat tracker', '(end of the v0.68.0 tracker part)') + '\n' + cut('v0.68.0: the second interface pass, GM side', 'v0.68.0: the second interface pass (our windows only)'))
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^{}]*\*\//, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ sel: m[1]!.trim(), body: m[2]! }));
    const panel = rules.filter((r) => r.sel.includes('.sr2e-gm-panel'));
    const tracker = rules.filter((r) => !r.sel.includes('.sr2e-gm-panel'));
    assert.ok(panel.length > 10 && tracker.length > 5);
    for (const r of panel) {
      assert.ok(r.sel.split(',').every((s) => s.trim().startsWith('.sr2e.sr2e-gm-panel')), r.sel);
      assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsl/i.test(r.body), `hard-coded colour in ${r.sel}`);
      assert.ok(!/opacity/.test(r.body), `faded text in ${r.sel}`);
    }
    for (const r of tracker) {
      assert.ok(!r.body.includes('--sr2e-'), `palette variable in the tracker: ${r.sel}`);
      for (const m of r.body.matchAll(/(?:color|background|border(?:-left)?):\s*([^;]+)/g)) assert.ok(/var\(--color-|^(none|0)$/.test(m[1]!.trim()) || m[1]!.includes('var(--color-'), `${r.sel}: ${m[0]}`);
    }
    assert.match(css, /grid-template-columns: repeat\(auto-fill, minmax\(min\(15rem, 100%\), 1fr\)\)/);
  });
});

// ---------------------------------------------------------------- The combat tracker

describe('combat tracker: banner, acting row, delayed group, full defense', () => {
  function setup() {
    const actors: Record<string, any> = {
      a: { name: 'Rook', isOwner: false },
      b: { name: 'Guard 1', isOwner: false, isDelaying: () => true },
      c: { name: 'Guard 2', isOwner: false, fullDefenseUp: () => true },
      d: { name: 'Mage', isOwner: false, actingNow: () => true },
      e: { name: 'Pell', isOwner: false },
    };
    const combatants = new Map(Object.entries(actors).map(([id, actor]) => [id, { id, name: actor.name, actor }]));
    const combat: any = { started: true, round: 2, pass: 0, combatants, turns: [...combatants.values()], combatant: combatants.get('e') };
    g.game.combat = combat;
    const root = el('section', 'combat-sidebar');
    const header = root.appendChild(el('header', 'combat-tracker-header'));
    const list = root.appendChild(el('ol', 'combat-tracker plain'));
    for (const id of Object.keys(actors)) {
      const li = list.appendChild(el('li', 'combatant', { combatantId: id }));
      const name = li.appendChild(el('div', 'token-name'));
      name.appendChild(el('strong', 'name'));
    }
    void header;
    return { root, list, combat, actors };
  }
  const render = (root: FakeEl) => { for (const fn of hooks['renderCombatTracker'] ?? []) fn({}, root); };
  const order = (list: FakeEl) => list.children.map((c) => c.dataset['combatantId'] ?? `[${c.textContent}]`);

  test('the banner, the acting row, delayers last under a header, full defense badged and counted', () => {
    const { root, list } = setup();
    render(root);
    assert.deepEqual(order(list), ['a', 'c', 'e', '[Delaying]', 'b', 'd']);
    const banner = root.querySelector('.sr2e-pass-banner')!;
    assert.ok(banner, 'a banner');
    assert.equal(root.children.indexOf(banner), root.children.indexOf(list) - 1, 'right above the list');
    assert.equal(banner.querySelector('.sr2e-pass-title')!.textContent, 'Combat Turn 2 · Pass 1');
    assert.equal(banner.querySelector('.sr2e-pass-acting')!.textContent, 'Acting: Pell');
    assert.deepEqual(banner.querySelectorAll('.sr2e-pass-note').map((n) => n.textContent), ['Full defense: 1', 'Delaying: 2']);
    const li = (id: string) => list.children.find((c) => c.dataset['combatantId'] === id)!;
    assert.ok(li('e').classList.contains('sr2e-acting'));
    assert.ok(!li('a').classList.contains('sr2e-acting'));
    assert.ok(li('b').classList.contains('sr2e-delayed') && li('d').classList.contains('sr2e-delayed'));
    assert.ok(li('c').querySelector('.sr2e-badge-fd'));
    assert.equal(list.querySelector('li.sr2e-tracker-group')!.dataset['combatantId'], undefined, 'the header is no combatant');
  });

  test('idempotent: rendering again adds nothing twice, and follows changes', () => {
    const { root, list, combat, actors } = setup();
    render(root); render(root); render(root);
    assert.equal(root.querySelectorAll('.sr2e-pass-banner').length, 1);
    assert.equal(list.querySelectorAll('li.sr2e-tracker-group').length, 1);
    assert.equal(root.querySelectorAll('.sr2e-badge-fd').length, 1);
    assert.deepEqual(order(list), ['a', 'c', 'e', '[Delaying]', 'b', 'd']);
    // Nobody delays any more, full defense ends, the next pass: back in turn order, no header, no badge.
    actors['b'].isDelaying = () => false; actors['d'].actingNow = () => false; actors['c'].fullDefenseUp = () => false;
    combat.pass = 1; combat.combatant = combat.combatants.get('a');
    render(root);
    assert.deepEqual(order(list), ['a', 'b', 'c', 'd', 'e']);
    assert.equal(root.querySelectorAll('.sr2e-badge-fd').length, 0);
    assert.equal(root.querySelector('.sr2e-pass-title')!.textContent, 'Combat Turn 2 · Pass 2');
    assert.equal(root.querySelectorAll('.sr2e-acting').length, 1);
    // Before the start: no banner.
    combat.started = false;
    render(root);
    assert.equal(root.querySelector('.sr2e-pass-banner'), null);
    assert.equal(root.querySelectorAll('.sr2e-acting').length, 0);
  });
});
