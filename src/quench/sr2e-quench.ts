/**
 * v0.92.2: in-Foundry test batches for the Quench module (https://github.com/Ethaks/FVTT-Quench).
 * Registered only when Quench is active (its `quenchReady` hook); nothing here runs otherwise.
 * Run them from Quench's window (the flask button in the scene controls), or from the console:
 *   await quench.runBatches('sr2e.**')
 * Every batch makes its own `ZZ Quench …` documents and removes them afterwards, with the chat cards,
 * windows and combats it made; world time is put back. Run them as a GM, in a test world.
 * This is developer-only test code: its English text is the test names, never shown to players.
 */
import { SYSTEM } from '../module/config/system.ts';
import { pendingMigrations } from '../module/migrations.ts';

type Ctx = any;

const PREFIX = 'ZZ Quench';
const ACTOR_TYPES = ['character', 'npc', 'spirit', 'barrier', 'host', 'ic', 'vehicle', 'site', 'safehouse'] as const;
const ITEM_TYPES = ['skill', 'weapon', 'armor', 'gear', 'cyberware', 'spell', 'power', 'focus', 'adeptpower', 'cyberdeck', 'program'] as const;
/** A language key left untranslated in rendered text or attributes (SR2E.Some.key). */
const RAW_KEY = /\bSR2E\.[A-Z][A-Za-z0-9]*\.[A-Za-z0-9.]+/;

/** Everything one batch made, removed in its `after`. */
class Made {
  actors: any[] = [];
  messages = new Set<string>();
  combats: any[] = [];
  scenes: any[] = [];
  worldTime = 0;
  started = false;
  #hook = 0;
  #before = new Set<any>();
  #roundTime: number | undefined = undefined;

  /** Starts only for a GM (a player's run makes and removes nothing). */
  start(): boolean {
    if (!game.user?.isGM) return false;
    this.started = true;
    this.worldTime = Number(game.time?.worldTime ?? 0);
    // Review (v0.92.2): only this run's own cards: posted by this user, about a test actor (a speaker or the text).
    this.#hook = Hooks.on('createChatMessage', (m: any) => {
      if (String(m.author?.id ?? m.user?.id ?? '') !== String(game.user?.id)) return;
      const ids = new Set(this.actors.map((a) => String(a.id)));
      if (ids.has(String(m.speaker?.actor ?? '')) || String(m.content ?? '').includes(PREFIX) || String(m.speaker?.alias ?? '').includes(PREFIX)) this.messages.add(String(m.id));
    });
    this.#before = new Set(openApps());
    // Review: a Combat Turn must not move world time (every actor's timers would tick); put back afterwards.
    this.#roundTime = (CONFIG as any).time?.roundTime;
    if ((CONFIG as any).time) (CONFIG as any).time.roundTime = 0;
    return true;
  }

  async actor(data: Record<string, unknown>): Promise<any> {
    const a = await Actor.create({ ...data, name: `${PREFIX} ${String(data['name'] ?? data['type'])}` }, { renderSheet: false });
    if (a) this.actors.push(a);
    return a;
  }

  /** Removes what this run made; each step on its own, so one failure doesn't leave the rest. */
  async cleanup(prevScene: any = null): Promise<void> {
    if (!this.started) return;
    const step = async (fn: () => Promise<unknown> | unknown) => { try { await fn(); } catch (err) { console.warn('sr2e | Quench cleanup', err); } };
    Hooks.off('createChatMessage', this.#hook);
    for (const app of openApps()) if (!this.#before.has(app)) await step(() => app.close({ animate: false }));
    for (const c of this.combats) await step(() => (game.combats?.get(c.id) ? c.delete() : null));
    await step(() => { const ids = [...this.messages].filter((id) => game.messages?.get(id)); return ids.length ? ChatMessage.deleteDocuments(ids) : null; });
    await step(() => { const ids = this.actors.map((a) => a.id).filter((id) => game.actors?.get(id)); return ids.length ? Actor.deleteDocuments(ids) : null; });
    for (const sc of this.scenes) {
      await step(async () => {
        if (!game.scenes?.get(sc.id)) return;
        if (game.scenes.viewed?.id === sc.id && prevScene && game.scenes.get(prevScene.id)) await prevScene.view();
        await sc.delete();
      });
    }
    await step(() => { const dt = this.worldTime - Number(game.time?.worldTime ?? 0); return dt ? game.time.advance(dt, { sr2eTime: 'count' }) : null; });
    if ((CONFIG as any).time) (CONFIG as any).time.roundTime = this.#roundTime;
    this.started = false;
  }
}

function openApps(): any[] {
  const inst: any = (foundry as any).applications?.instances;
  const v2 = inst ? [...inst.values()] : [];
  const v1 = Object.values((ui as any).windows ?? {});
  return [...v2, ...v1];
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** NaN anywhere in a prepared system object (the path of the first one), else ''. */
export function findNaN(obj: unknown, path = 'system', seen = new Set<unknown>()): string {
  if (typeof obj === 'number') return Number.isNaN(obj) ? path : '';
  if (!obj || typeof obj !== 'object' || seen.has(obj)) return '';
  seen.add(obj);
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const hit = findNaN(v, `${path}.${k}`, seen);
    if (hit) return hit;
  }
  return '';
}

/** Untranslated keys in an element's text and its user-facing attributes. */
export function rawKeysIn(el: Element | null): string[] {
  if (!el) return [];
  const out = new Set<string>();
  // Every tab's text, not only the visible one's (innerText leaves hidden tabs out).
  const text = el.textContent ?? '';
  for (const m of text.matchAll(new RegExp(RAW_KEY, 'g'))) out.add(m[0]);
  for (const node of [el, ...Array.from(el.querySelectorAll("*"))]) {
    for (const attr of ['title', 'placeholder', 'aria-label', 'data-tooltip', 'alt']) {
      const v = node.getAttribute(attr);
      const m = v ? v.match(RAW_KEY) : null;
      if (m) out.add(m[0]);
    }
  }
  return [...out];
}

/** Console errors (and uncaught errors) while `fn` runs. */
async function errorsDuring(fn: () => Promise<unknown>): Promise<string[]> {
  const errs: string[] = [];
  const orig = console.error;
  const onErr = (e: ErrorEvent) => errs.push(String(e.message));
  console.error = (...args: unknown[]) => { errs.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')); orig.apply(console, args as []); };
  window.addEventListener('error', onErr);
  try { await fn(); } finally { console.error = orig; window.removeEventListener('error', onErr); }
  return errs;
}

async function renderSheet(doc: any): Promise<{ el: Element | null; errors: string[] }> {
  let el: Element | null = null;
  const errors = await errorsDuring(async () => {
    const sheet = doc.sheet;
    await sheet.render({ force: true });
    await wait(150);
    el = sheet.element ?? null;
    await sheet.close({ animate: false });
  });
  return { el, errors };
}

function newestCard(made: Made, since: number): any {
  return [...made.messages].map((id) => game.messages.get(id)).filter((m: any) => m && Number(m.timestamp ?? 0) >= since)
    .sort((a: any, b: any) => Number(b.timestamp) - Number(a.timestamp))
    .find((m: any) => m.flags?.[SYSTEM.id]?.test);
}


/** A runner with skills and items, used by several batches. */
async function runner(made: Made, extra: Record<string, unknown> = {}): Promise<any> {
  return made.actor({
    type: 'character', name: 'Runner',
    system: { attributes: { body: { base: 4 }, quickness: { base: 5 }, strength: { base: 4 }, charisma: { base: 3 }, intelligence: { base: 5 }, willpower: { base: 4 } } },
    items: [
      { name: 'Firearms', type: 'skill', system: { rating: 5, attribute: 'quickness' } },
      { name: 'Armed Combat', type: 'skill', system: { rating: 4, attribute: 'strength' } },
      { name: 'Etiquette', type: 'skill', system: { rating: 3, attribute: 'charisma' } },
      { name: 'Knife', type: 'weapon', system: { melee: true, skill: 'Armed Combat', damagePower: 3, damageLevel: 'L', weight: 0.5 } },
    ],
    ...extra,
  });
}

function batchDocuments(ctx: Ctx): void {
  const { describe, it, before, after, assert } = ctx;
  describe('Every document type', function (this: any) {
    this.timeout(20000);
    const made = new Made();
    before(function (this: any) { if (!made.start()) this.skip(); });
    after(async () => { await made.cleanup(); });

    for (const type of ACTOR_TYPES) {
      it(`creates and prepares a ${type}`, async () => {
        const a = await made.actor({ type, name: type });
        assert.ok(a, 'created');
        assert.equal(a.type, type);
        assert.equal(findNaN(a.system), '', 'no NaN in the prepared data');
      });
    }

    it('embeds one item of every type in a character', async () => {
      const a = await made.actor({ type: 'character', name: 'Items' });
      const items = await a.createEmbeddedDocuments('Item', ITEM_TYPES.map((t) => ({ name: `${PREFIX} ${t}`, type: t })));
      assert.equal(items.length, ITEM_TYPES.length);
      for (const i of a.items) assert.equal(findNaN(i.system), '', `no NaN in ${i.type}`);
      assert.equal(findNaN(a.system), '', 'the character still prepares');
    });

    it('opens every actor sheet without errors or untranslated keys', async function (this: any) {
      this.timeout(120000);
      for (const a of made.actors) {
        const { el, errors } = await renderSheet(a);
        assert.ok(el, `${a.type} sheet rendered`);
        assert.deepEqual(errors, [], `${a.type} sheet: console errors`);
        assert.deepEqual(rawKeysIn(el), [], `${a.type} sheet: untranslated keys`);
      }
    });

    it('opens every item sheet without errors or untranslated keys', async function (this: any) {
      this.timeout(120000);
      const a = made.actors.find((x) => x.name === `${PREFIX} Items`);
      for (const i of a.items) {
        const { el, errors } = await renderSheet(i);
        assert.ok(el, `${i.type} sheet rendered`);
        assert.deepEqual(errors, [], `${i.type} sheet: console errors`);
        assert.deepEqual(rawKeysIn(el), [], `${i.type} sheet: untranslated keys`);
      }
    });
  });
}

function batchRolls(ctx: Ctx): void {
  const { describe, it, before, after, assert } = ctx;
  describe('Tests, cards and combat', function (this: any) {
    this.timeout(20000);
    const made = new Made();
    let pc: any; let foe: any;
    before(async function (this: any) {
      if (!made.start()) this.skip();
      pc = await runner(made);
      foe = await made.actor({ type: 'npc', name: 'Foe', items: [{ name: 'Armed Combat', type: 'skill', system: { rating: 3, attribute: 'strength' } }] });
    });
    after(async () => { await made.cleanup(); });

    it('an attribute test posts a card with its snapshot', async () => {
      const t0 = Date.now();
      const r = await pc.rollAttribute('body');
      assert.ok(r, 'rolled');
      await wait(200);
      const card = newestCard(made, t0);
      assert.ok(card, 'card posted');
      assert.equal(card.flags[SYSTEM.id].test.kind, 'plain');
      assert.deepEqual(rawKeysIn(document.querySelector(`[data-message-id="${card.id}"]`)), []);
    });

    it('a skill test rolls the skill rating', async () => {
      const t0 = Date.now();
      const skill = pc.items.find((i: any) => i.name === 'Etiquette');
      const r = await pc.rollSkill(skill);
      assert.ok(r);
      assert.equal(Number(r.totalDice), 3, 'Etiquette 3');
      await wait(200);
      assert.ok(newestCard(made, t0), 'card posted');
    });

    it('a melee attack on a target posts an attack card with a Defend button', async () => {
      const t0 = Date.now();
      const knife = pc.items.find((i: any) => i.name === 'Knife');
      const r = await pc.attackWith(knife, { targetUuid: foe.uuid });
      assert.ok(r, 'attacked');
      await wait(300);
      const card = newestCard(made, t0);
      assert.ok(card);
      const snap = card.flags[SYSTEM.id].test;
      assert.equal(snap.kind, 'attack');
      assert.equal(String(snap.attack?.targetUuid ?? snap.attackTargets?.[0]?.targetUuid), foe.uuid);
      const el = document.querySelector(`[data-message-id="${card.id}"]`);
      if (Number(r.successes ?? 0) > 0) assert.ok(el?.querySelector('[data-sr2e-action="defend"]'), 'Defend button');
    });

    it('a damage code is resisted with a soak card', async () => {
      const t0 = Date.now();
      await foe.resistDamageCode('6M');
      await wait(300);
      const card = newestCard(made, t0);
      assert.ok(card, 'soak card');
      assert.equal(card.flags[SYSTEM.id].test.kind, 'soak');
    });

    it('a combat rolls initiative and moves through its turns', async function (this: any) {
      this.timeout(30000);
      const c = await Combat.create({ scene: null, active: false });
      made.combats.push(c);
      await c.createEmbeddedDocuments('Combatant', [{ actorId: pc.id, name: pc.name }, { actorId: foe.id, name: foe.name }]);
      await c.rollAll();
      for (const cb of c.combatants) assert.ok(Number.isFinite(Number(cb.initiative)), `${cb.name} has initiative`);
      await c.startCombat();
      const turns0 = c.turns.length;
      assert.equal(turns0, 2);
      await c.nextTurn();
      await c.nextTurn();
      assert.ok(Number(c.round) >= 1);
    });
  });
}

function batchSheet921(ctx: Ctx): void {
  const { describe, it, before, after, assert } = ctx;
  describe('v0.92.1 the flexible record sheet', function (this: any) {
    this.timeout(20000);
    const made = new Made();
    const R = () => (game.sr2e?.api?.rules?.SHEET_V921 ?? {}) as Record<string, string>;
    before(function (this: any) { if (!made.start()) this.skip(); });
    // Review: these test the new way; a world with the house rule set back skips them.
    const needs = (ctx: any, key: string, on: string) => { if (R()[key] !== on) ctx.skip(); };
    after(async () => { await made.cleanup(); });

    it('a tweak on carried gear raises an attribute; leaving it behind takes it off', async function (this: any) {
      needs(this, 'tweaks', 'on'); needs(this, 'carried', 'on');
      const a = await runner(made);
      const base = Number(a.system.attributes.strength.total);
      const [g] = await a.createEmbeddedDocuments('Item', [{ name: `${PREFIX} belt`, type: 'gear', system: { weight: 3, tweaks: [{ id: 'q1', label: 'test', target: 'attribute', key: 'strength', value: 1 }] } }]);
      assert.equal(Number(a.system.attributes.strength.total), base + 1, 'tweak counts');
      const kg = Number(a.system.derived.load.kg);
      await g.update({ 'system.carried': false });
      assert.equal(Number(a.system.attributes.strength.total), base, 'left behind: no tweak');
      assert.equal(Number(a.system.derived.load.kg), kg - 3, 'left behind: no weight');
    });

    it('a damage tweak on a weapon raises its Power', async function (this: any) {
      needs(this, 'tweaks', 'on');
      const a = await runner(made, { name: 'Power' });
      const knife = a.items.find((i: any) => i.name === 'Knife');
      const p0 = Number(a.planAttack(knife, {}).power);
      await knife.update({ 'system.tweaks': [{ id: 'q2', label: 'edge', target: 'damage', key: 'self', value: 2 }] });
      assert.equal(Number(a.planAttack(knife, {}).power), p0 + 2);
    });

    it('a weapon left behind can\'t attack', async function (this: any) {
      needs(this, 'carried', 'on');
      const a = await runner(made, { name: 'Unarmed' });
      const knife = a.items.find((i: any) => i.name === 'Knife');
      await knife.update({ 'system.carried': false });
      const r = await a.attackWith(knife, {});
      assert.equal(r, null);
    });

    it('accessories in a new weapon\'s description fill fields at their default, with an undo record', async function (this: any) {
      needs(this, 'accessories', 'auto');
      const a = await runner(made, { name: 'Reader' });
      const [w] = await a.createEmbeddedDocuments('Item', [{ name: `${PREFIX} rifle`, type: 'weapon', system: { skill: 'Firearms', description: '<p>Comes with a laser sight and gas vents (2), and a scope (low-light, magnification 2).</p>' } }]);
      assert.equal(w.system.laserSight, true, 'laser sight');
      assert.equal(Number(w.system.recoilComp), 2, 'gas vents');
      assert.equal(Number(w.system.scope), 2, 'magnification 2');
      assert.equal(String(w.system.scopeVision), 'lowLight', 'low-light scope');
      assert.ok(w.flags?.[SYSTEM.id]?.fromDescription?.fields?.laserSight, 'undo record');
    });

    it('"no silencer" is not read as a silencer', async function (this: any) {
      needs(this, 'accessories', 'auto');
      const a = await runner(made, { name: 'Negation' });
      const [w] = await a.createEmbeddedDocuments('Item', [{ name: `${PREFIX} pistol`, type: 'weapon', system: { skill: 'Firearms', description: '<p>No silencer; a smartgun link is sold separately.</p>' } }]);
      assert.equal(String(w.system.muzzle ?? ''), '');
      assert.equal(w.system.smartgun, false);
    });
  });
}

function batchTranslation(ctx: Ctx): void {
  const { describe, it, assert } = ctx;
  describe('Translation', () => {
    it('the language file is loaded', () => {
      assert.ok(game.i18n.translations?.SR2E, 'SR2E keys present');
      assert.ok(game.i18n.has('SR2E.Attribute.body'));
    });

    it('every setting has a translated name and hint', () => {
      const bad: string[] = [];
      for (const s of game.settings.settings.values()) {
        if (s.namespace !== SYSTEM.id || !s.config) continue;
        for (const f of ['name', 'hint'] as const) {
          const v = String(s[f] ?? '');
          if (RAW_KEY.test(v) && !game.i18n.has(v)) bad.push(`${s.key}.${f}`);
        }
      }
      assert.deepEqual(bad, []);
    });

    it('every actor and item type has a translated label', () => {
      const bad: string[] = [];
      for (const [doc, types] of [['Actor', ACTOR_TYPES], ['Item', ITEM_TYPES]] as const) {
        for (const t of types) {
          const key = (CONFIG as any)[doc].typeLabels?.[t];
          if (!key || !game.i18n.has(key)) bad.push(`${doc}.${t}`);
        }
      }
      assert.deepEqual(bad, []);
    });

    it('no translation is empty', () => {
      const empty: string[] = [];
      const walk = (o: any, p: string) => { for (const [k, v] of Object.entries(o ?? {})) { if (typeof v === 'string') { if (!v.trim()) empty.push(`${p}.${k}`); } else walk(v, `${p}.${k}`); } };
      walk(game.i18n.translations.SR2E, 'SR2E');
      assert.deepEqual(empty, []);
    });
  });
}

function batchMigrations(ctx: Ctx): void {
  const { describe, it, assert } = ctx;
  describe('Migrations', () => {
    it('the world is migrated to this version', async () => {
      // runMigrations runs at ready; give it a moment in a freshly opened world.
      for (let i = 0; i < 20 && pendingMigrations(String(game.settings.get(SYSTEM.id, 'migrationVersion') ?? '')).length; i++) await wait(500);
      const stored = String(game.settings.get(SYSTEM.id, 'migrationVersion') ?? '');
      assert.deepEqual(pendingMigrations(stored), [], `stored ${stored}`);
    });

    it('every actor and item in the world prepares without NaN', () => {
      const bad: string[] = [];
      for (const a of game.actors) {
        const hit = findNaN(a.system);
        if (hit) bad.push(`${a.name}: ${hit}`);
        for (const i of a.items) { const h = findNaN(i.system); if (h) bad.push(`${a.name} / ${i.name}: ${h}`); }
      }
      for (const i of game.items) { const h = findNaN(i.system); if (h) bad.push(`${i.name}: ${h}`); }
      assert.deepEqual(bad, []);
    });

    it('every world document passes its schema', () => {
      const bad: string[] = [];
      const check = (d: any, label: string) => { try { d.validate({ strict: true }); } catch (e: any) { bad.push(`${label}: ${String(e?.message ?? e).split('\n')[0]}`); } };
      for (const a of game.actors) { check(a, a.name); for (const i of a.items) check(i, `${a.name} / ${i.name}`); }
      for (const i of game.items) check(i, i.name);
      assert.deepEqual(bad, []);
    });
  });
}

function batchApi(ctx: Ctx): void {
  const { describe, it, assert } = ctx;
  describe('System and API', () => {
    it('the API matches the system version', () => {
      const api = game.sr2e?.api;
      assert.ok(api, 'game.sr2e.api');
      assert.equal(api.version, game.system.version);
      for (const fn of ['rollTest', 'successTest', 'openTools', 'openShop', 'openCatalogue', 'reference', 'interpretations', 'sceneBuilder', 'creationWizard']) assert.equal(typeof api[fn], 'function', fn);
    });

    it('the success test counts successes', async () => {
      const res = await game.sr2e.api.successTest({ dice: 6, targetNumber: 4, roll: (n: number) => Array.from({ length: n }, () => 5) });
      assert.equal(Number(res?.successes), 6);
    });
  });
}

/** Timings from the last performance run (also logged to the console as a table). */
export const perfResults: Record<string, number> = {};

async function timed<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
  const t0 = performance.now();
  const out = await fn();
  perfResults[key] = Math.round(performance.now() - t0);
  return out;
}

/**
 * Wait until the table has settled: Dice So Nice's queued 3D dice have finished (a batch posts cards far faster than
 * people do, so its animations queue up for minutes) and the floating numbers are gone. At most `maxMs`.
 */
async function settle(maxMs = 90000): Promise<void> {
  const end = performance.now() + maxMs;
  const size = (x: any): number => (x == null ? 0 : typeof x.length === 'number' ? x.length : typeof x.size === 'number' ? x.size : typeof x === 'object' ? Object.keys(x).length : 0);
  const busy = () => { const d: any = (game as any).dice3d; return Boolean(d?.box?.rolling || size(d?.queue) > 0 || size(d?.pendingThrows) > 0); };
  while (performance.now() < end && busy()) await wait(500);
  await wait(3000);
}

/** Frames drawn per second over `ms` (requestAnimationFrame), once the table has settled. */
async function fps(ms = 2000): Promise<number> {
  await settle();
  let frames = 0;
  const end = performance.now() + ms;
  await new Promise<void>((resolve) => { const step = () => { frames++; if (performance.now() < end) requestAnimationFrame(step); else resolve(); }; requestAnimationFrame(step); });
  return Math.round((frames * 1000) / ms);
}

/**
 * The busy table (opt-in: not ticked in Quench's list). Budgets are for an ordinary computer at full speed, with
 * about four times headroom, so a slower computer (or the browser's 4× CPU throttling) still stays usable.
 */
function batchPerformance(ctx: Ctx): void {
  const { describe, it, before, after, assert } = ctx;
  describe('A busy table', function (this: any) {
    this.timeout(600000);
    const made = new Made();
    let scene: any = null; let prevScene: any = null; let combat: any = null; let pc: any = null;
    const N = 50; const CARDS = 300;
    before(async function (this: any) {
      prevScene = game.scenes?.viewed ?? null;
      if (!made.start()) this.skip();
    });
    after(async () => {
      await made.cleanup(prevScene);
      if (Object.keys(perfResults).length) console.table(perfResults);
    });

    it(`builds a scene with ${N} tokens`, async () => {
      await timed('actors', async () => {
        const data = Array.from({ length: N }, (_, i) => ({ type: i % 5 === 0 ? 'character' : 'npc', name: `${PREFIX} crowd ${i + 1}`,
          items: [{ name: 'Armed Combat', type: 'skill', system: { rating: 3, attribute: 'strength' } }, { name: 'Knife', type: 'weapon', system: { melee: true, skill: 'Armed Combat', damagePower: 3, damageLevel: 'L' } }] }));
        const actors = await Actor.createDocuments(data);
        made.actors.push(...actors);
      });
      scene = await (globalThis as any).Scene.create({ name: `${PREFIX} busy scene`, width: 4000, height: 3000, grid: { size: 100 }, padding: 0 });
      made.scenes.push(scene);
      await timed('view', () => scene.view());
      await wait(500);
      await timed('tokens', async () => {
        const toks = [];
        for (let i = 0; i < N; i++) toks.push((await made.actors[i].getTokenDocument({ x: 200 + (i % 10) * 350, y: 200 + Math.floor(i / 10) * 500 })).toObject());
        await scene.createEmbeddedDocuments('Token', toks);
      });
      await wait(800);
      assert.equal(canvas.tokens.placeables.length, N);
      perfResults['fps (idle)'] = await fps();
      assert.isAtMost(perfResults['tokens']!, 15000, 'placing tokens');
    });

    it(`runs a combat of ${N} through two rounds`, async () => {
      combat = await Combat.create({ scene: scene.id, active: true });
      made.combats.push(combat);
      await timed('combatants', () => combat.createEmbeddedDocuments('Combatant', scene.tokens.contents.map((t: any) => ({ tokenId: t.id, sceneId: scene.id, actorId: t.actorId }))));
      await timed('initiative', () => combat.rollAll());
      await combat.startCombat();
      const steps = combat.turns.length * 2;
      const t0 = performance.now();
      for (let i = 0; i < steps; i++) await combat.nextTurn();
      perfResults['next turn (avg)'] = Math.round((performance.now() - t0) / steps);
      assert.isAtMost(perfResults['next turn (avg)']!, 400, 'a turn change');
    });

    it(`posts ${CARDS} test cards and keeps the chat responsive`, async () => {
      const crowd = made.actors.slice(0, N);
      await timed('cards', async () => {
        for (let i = 0; i < CARDS; i++) {
          const a = crowd[i % N];
          if (i % 3 === 0) { const w = a.items.find((x: any) => x.type === 'weapon'); await a.attackWith(w, { targetUuid: crowd[(i + 1) % N].uuid }); }
          else await a.rollAttribute(i % 2 ? 'body' : 'quickness');
        }
      });
      perfResults['card (avg)'] = Math.round(perfResults['cards']! / CARDS);
      await timed('chat render', () => ui.chat.render({ force: true }));
      perfResults['fps (after cards)'] = await fps();
      assert.isAtMost(perfResults['card (avg)']!, 400, 'posting a card');
      assert.isAtMost(perfResults['chat render']!, 4000, 'drawing the chat log');
    });

    it('opens a character sheet quickly on the busy table', async () => {
      pc = made.actors.find((a: any) => a.type === 'character');
      await timed('sheet open', async () => { await pc.sheet.render({ force: true }); });
      await wait(200);
      await timed('sheet re-render', () => pc.update({ 'system.monitor.stun': 2 }));
      await wait(200);
      await pc.sheet.close({ animate: false });
      assert.isAtMost(perfResults['sheet open']!, 3000, 'opening a sheet');
    });

    it('damage on many tokens at once', async () => {
      await timed('damage x50', () => Promise.all(made.actors.slice(0, N).map((a: any) => a.update({ 'system.monitor.physical': 3 }))));
      await wait(500);
      perfResults['fps (hurt)'] = await fps();
      assert.isAtMost(perfResults['damage x50']!, 15000);
      assert.isAtLeast(perfResults['fps (hurt)']!, 30, 'the canvas draws smoothly once the damage has shown');
    });
  });
}

/** Register the batches (call at init; they appear once Quench is ready). */
export function registerQuenchBatches(): void {
  Hooks.once('quenchReady', (quench: any) => {
    const reg = (key: string, name: string, fn: (ctx: Ctx) => void, preSelected = true) => quench.registerBatch(`${SYSTEM.id}.${key}`, fn, { displayName: `SR2e: ${name}`, preSelected });
    reg('api', 'system and API', batchApi);
    reg('documents', 'every document type and sheet', batchDocuments);
    reg('rolls', 'tests, cards and combat', batchRolls);
    reg('sheet921', 'v0.92.1 record sheet', batchSheet921);
    reg('translation', 'translation', batchTranslation);
    reg('migrations', 'migrations and world data', batchMigrations);
    // Opt-in: builds a temporary busy scene (50 tokens, a long combat, 300 cards) and removes it.
    reg('performance', 'performance on a busy table', batchPerformance, false);
  });
}
