/**
 * v0.91.7: the Scene builder window (the Foundry glue for `rules/scenebuilder.ts`). A GM walks through seven steps
 * (basics, map, time and conditions, magic, who's there, security and the Matrix, finish) and builds a scene with
 * everything in one go: the scene and its settings (the same flags as the GM panel's Scene tab), a built-in
 * backdrop's walls, doors and lamps, a ward, the player characters and NPCs (from the world's actors or made by the
 * NPC generator) in the start zones, a security site and its host, a GM journal, the playlist and the combat
 * tracker. Opened on an existing scene it changes that scene's settings and adds to it; it never deletes anything
 * there. What it makes is flagged `flags.sr2e.sceneBuilder`, and **Remove this scene** deletes exactly that.
 * Also `game.sr2e.api.sceneBuilder()`, `buildScene(spec)` and `removeBuiltScene(sceneId)`.
 */
import { SYSTEM } from '../config/system.ts';
import {
  RULES, BACKDROPS, backdropById, backdropsFor, makeRng, generateOrg, hostActorData, timeOfDayHours,
  SCENE_STEPS, SCENE_KINDS, SB_GEN_KINDS as ROW_KINDS, SB_ATTITUDES, defaultSpec, defaultRow, normalizeSpec, switchKind, withBackdrop, kindDefaults,
  sceneCreateData, sceneFlags, backdropDocuments, rectRegionData, wardArea, zonesFor, spotsInZone, dispositionOf, generatedSiteSystem, geoOf, type SceneGeo,
  specProblems, specSummary, stepTouched, stepMoveTo, sceneDarkness, lightLabel, secondsUntilHour, templateOf, normalizeTemplates, tokenCount,
  type SceneSpec, type SceneStep, type PeopleRow, type SceneKind,
} from '../rules/index.ts';
import { DEFAULT_STATE, planFor, createFromPlan, generatorChoices, type GenState } from './npcgen.ts';
import { palette } from '../rules/look.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tKey, tHtml } from '../helpers/i18n.ts';

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;
const esc = escHtml;

/** The flag on everything the builder makes: `{ sceneId }` (the scene itself carries `{ kind, spec, by, at }`). */
export const SB_FLAG = 'sceneBuilder';
const TEMPLATE = 'scene-builder.hbs';
const isGm = (): boolean => Boolean((game as any).user?.isGM);
const sceneFlag = (scene: any): any => scene?.flags?.[SYSTEM.id]?.[SB_FLAG] ?? null;
/** A document the builder made for a scene (a duplicate or an import keeps the flag: those are left alone). */
const madeFor = (d: any, sceneId: string): boolean => d?.flags?.[SYSTEM.id]?.[SB_FLAG]?.sceneId === sceneId
  && !d?._stats?.duplicateSource && !d?._stats?.compendiumSource;

function settingTemplates(): ReturnType<typeof normalizeTemplates> {
  try { return normalizeTemplates((game as any).settings.get(SYSTEM.id, 'sceneTemplates')); } catch { return []; }
}

/** The world actors a people row or a step may pick, with a short kind label. */
function actorChoices(types: string[]): Array<{ id: string; label: string }> {
  return [...((game as any).actors ?? [])]
    .filter((a: any) => types.includes(a.type))
    .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
    .map((a: any) => ({ id: a.uuid, label: a.name }));
}
const nameOf = (uuid: string): string => {
  try { return String((globalThis as any).fromUuidSync?.(uuid)?.name ?? '') || tx('SR2E.SceneBuilder.unknown'); } catch { return tx('SR2E.SceneBuilder.unknown'); }
};
const known = (uuid: string): boolean => {
  try { return Boolean((globalThis as any).fromUuidSync?.(uuid)); } catch { return false; }
};

/** Where an existing scene's map is: its grid, its size in metres and the padding before it (Foundry pads scenes). */
export function geoOfScene(scene: any): SceneGeo {
  const grid = Number(scene?.grid?.size ?? 100) || 100;
  const dist = Number(scene?.grid?.distance ?? 1) || 1;
  const d = scene?.dimensions ?? {};
  const w = Number(d.sceneWidth ?? scene?.width ?? 0) || 0;
  const h = Number(d.sceneHeight ?? scene?.height ?? 0) || 0;
  return { grid, gridDistance: dist, width: Math.round((w / grid) * dist), height: Math.round((h / grid) * dist), originX: Number(d.sceneX ?? 0) || 0, originY: Number(d.sceneY ?? 0) || 0 };
}

/** A spec for an existing scene (what it has now; people and security start empty: the builder only adds). */
export function specFromScene(scene: any): SceneSpec {
  const f = scene?.flags?.[SYSTEM.id] ?? {};
  const built = sceneFlag(scene);
  const grid = Number(scene?.grid?.size ?? 100) || 100;
  const dist = Number(scene?.grid?.distance ?? 1) || 1;
  const src = String(scene?.background?.src ?? scene?.levels?.contents?.[0]?.background?.src ?? '');
  const prev = built?.spec ? normalizeSpec(built.spec) : null;
  const backdrop = prev?.backdrop && prev.backdrop !== 'custom' && backdropById(prev.backdrop)?.file && src.endsWith(backdropById(prev.backdrop)!.file) ? prev.backdrop : src ? 'custom' : '';
  return normalizeSpec({
    ...(prev ?? {}),
    name: scene?.name ?? '', folderId: scene?.folder?.id ?? '', kind: built?.kind ?? prev?.kind ?? 'real', keepSize: true,
    width: Math.round((Number(scene?.width ?? 0) / grid) * dist), height: Math.round((Number(scene?.height ?? 0) / grid) * dist),
    grid, gridDistance: dist, gridless: Number(scene?.grid?.type ?? 1) === 0,
    backdrop, image: backdrop === 'custom' ? src : '', color: String(scene?.levels?.contents?.[0]?.background?.color ?? scene?.backgroundColor ?? prev?.color ?? '#1c2026'),
    walls: false, tokenVision: Boolean(scene?.tokenVision), fog: Boolean(scene?.fog?.exploration),
    hour: null, moveTime: false, darkness: Number(scene?.environment?.darknessLevel ?? scene?.darkness ?? 0),
    globalLight: Boolean(scene?.environment?.globalLight?.enabled),
    weather: f.weather ?? 'clear', terrain: f.terrain ?? '', background: f.backgroundCount ?? 0, sources: f.backgroundSources ?? '', environment: f.environment ?? '',
    ward: { on: false }, pcs: [], people: [], site: { mode: 'none' }, host: { mode: 'none' }, notes: '', journal: false,
    playlist: scene?.playlist?.id ?? '', combat: 'none', show: 'none',
  });
}

export class SR2SceneBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: Record<string, any> = {
    id: 'sr2e-scene-builder',
    classes: ['sr2e', 'sr2e-wizard-window', 'sr2e-scene-builder'],
    window: { title: 'SR2E.SceneBuilder.title', resizable: true, icon: 'fa-solid fa-map-location-dot' },
    position: { width: 820, height: 760 },
    actions: {
      sbStep: SR2SceneBuilder.#onStep,
      sbNext: SR2SceneBuilder.#onNext,
      sbBack: SR2SceneBuilder.#onBack,
      sbKind: SR2SceneBuilder.#onKind,
      sbBackdrop: SR2SceneBuilder.#onBackdrop,
      sbPickImage: SR2SceneBuilder.#onPickImage,
      sbAddActor: SR2SceneBuilder.#onAddActor,
      sbAddGen: SR2SceneBuilder.#onAddGen,
      sbRemoveRow: SR2SceneBuilder.#onRemoveRow,
      sbReroll: SR2SceneBuilder.#onReroll,
      sbLoadTemplate: SR2SceneBuilder.#onLoadTemplate,
      sbSaveTemplate: SR2SceneBuilder.#onSaveTemplate,
      sbDeleteTemplate: SR2SceneBuilder.#onDeleteTemplate,
      sbBuild: SR2SceneBuilder.#onBuild,
      sbRemoveScene: SR2SceneBuilder.#onRemoveScene,
      sbNew: SR2SceneBuilder.#onNew,
    },
  };
  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/${TEMPLATE}`, scrollable: ['.sr2e-wiz-body'] } };

  spec: SceneSpec = defaultSpec('real');
  step: SceneStep = 'basics';
  /** The scene being changed ('' = a new one). */
  sceneId = '';
  /** The add-a-row pickers' choices (kept between renders). */
  pick = { actor: '', gen: 'group' as PeopleRow['kind'], templateName: '' };
  #busy = false;

  static #instance: SR2SceneBuilder | null = null;
  /** Open the builder: for a new scene, or (`sceneId`) to change an existing one. */
  static open(o: { sceneId?: string } = {}): SR2SceneBuilder | null {
    if (!isGm()) { ui.notifications?.warn?.(tx('SR2E.SceneBuilder.gmOnly')); return null; }
    const w = (SR2SceneBuilder.#instance ??= new SR2SceneBuilder());
    if (o.sceneId !== undefined) w.load(o.sceneId);
    if ((w as any).minimized) void (w as any).maximize?.();
    void w.render({ force: true });
    return w;
  }

  /** Start over: a new scene, or the settings of an existing one. */
  load(sceneId: string): void {
    const scene: any = sceneId ? (game as any).scenes?.get?.(sceneId) : null;
    // Asked for a new scene while one is being drafted: keep the draft.
    if (!scene && !this.sceneId && this.spec.name) return;
    this.sceneId = scene ? scene.id : '';
    this.spec = scene ? specFromScene(scene) : defaultSpec('real');
    this.step = 'basics';
  }

  get editing(): boolean { return Boolean(this.sceneId); }

  async close(options?: any): Promise<any> {
    SR2SceneBuilder.#instance = null;
    return super.close(options);
  }

  async _prepareContext(_options: any): Promise<any> {
    const s = this.spec;
    const scene: any = this.editing ? (game as any).scenes?.get?.(this.sceneId) : null;
    const sel = (list: Array<{ id: string; label: string }>, cur: string) => list.map((o) => ({ ...o, selected: o.id === cur }));
    const darkness = sceneDarkness(s);
    const gen = generatorChoices();
    const here = new Set(scene ? [...(scene.tokens ?? [])].map((t: any) => t.actor?.uuid ?? '').filter(Boolean) : []);
    const pcs = [...((game as any).actors ?? [])].filter((a: any) => a.type === 'character')
      .sort((a: any, b: any) => Number(b.hasPlayerOwner) - Number(a.hasPlayerOwner) || String(a.name).localeCompare(String(b.name)))
      .map((a: any) => ({ uuid: a.uuid, name: a.name, player: Boolean(a.hasPlayerOwner), checked: s.pcs.includes(a.uuid), here: here.has(a.uuid) }));
    const steps = SCENE_STEPS.map((id, i) => ({ id, n: i + 1, label: tKey(`SR2E.SceneBuilder.step.${id}`), hint: tKey(`SR2E.SceneBuilder.stepHint.${id}`), active: id === this.step, state: stepTouched(s, id) ? 'ok' : '' }));
    const problems = specProblems(s, { edit: this.editing, known });
    const hasWalls = scene ? Number(scene.walls?.size ?? scene.walls?.length ?? 0) > 0 : false;
    const b = backdropById(s.backdrop);
    const geo = scene ? geoOfScene(scene) : geoOf(s);
    const rowView = (r: PeopleRow) => ({
      ...r,
      title: r.source === 'actor' ? nameOf(r.uuid) : tKey(`SR2E.SceneBuilder.gen.${r.kind}`),
      isActor: r.source === 'actor', isGen: r.source === 'generate',
      attitudes: SB_ATTITUDES.map((a) => ({ id: a, label: tKey(`SR2E.SceneBuilder.attitude.${a}`), selected: a === r.attitude })),
      threats: sel(gen.threats, String(r.threat)),
      subtypes: r.kind === 'npc' ? sel(gen.archetypes, r.archetype) : r.kind === 'group' ? sel(gen.groupKinds, r.groupKind || 'gang') : r.kind === 'spirit' ? sel(gen.spiritKinds, r.spiritKind || 'random') : sel(gen.critters, r.critter),
      showCount: r.source === 'actor' ? !r.linked : r.kind === 'critter',
    });
    return {
      spec: s, step: this.step, is: { [this.step]: true }, editing: this.editing, sceneName: scene?.name ?? '',
      builtHere: Boolean(scene && sceneFlag(scene)),
      steps, n: SCENE_STEPS.indexOf(this.step) + 1, label: tKey(`SR2E.SceneBuilder.step.${this.step}`), hint: tKey(`SR2E.SceneBuilder.stepHint.${this.step}`),
      first: this.step === SCENE_STEPS[0], last: this.step === SCENE_STEPS[SCENE_STEPS.length - 1],
      kinds: SCENE_KINDS.map((k) => ({ id: k, label: tKey(`SR2E.SceneBuilder.kind.${k}`), hint: tKey(`SR2E.SceneBuilder.kindHint.${k}`), checked: k === s.kind })),
      isReal: s.kind === 'real', isMatrix: s.kind === 'matrix', isAstral: s.kind === 'astral',
      folders: sel([{ id: '', label: tx('SR2E.SceneBuilder.noFolder') }, ...[...((game as any).folders ?? [])].filter((f: any) => f.type === 'Scene').map((f: any) => ({ id: f.id, label: f.name }))], s.folderId),
      templates: settingTemplates().map((t) => ({ id: t.id, label: t.name })),
      backdrops: [
        ...backdropsFor(s.kind).map((x) => ({ id: x.id, label: tKey(x.labelKey), hint: tKey(x.hintKey), src: `${SYSTEM.PATH.ROOT}/${x.file}`, selected: x.id === s.backdrop, size: tx('SR2E.SceneBuilder.sizeShort', { w: x.width, h: x.height }) })),
        ...BACKDROPS.filter((x) => x.kind !== s.kind && x.id === s.backdrop).map((x) => ({ id: x.id, label: tKey(x.labelKey), hint: tKey(x.hintKey), src: `${SYSTEM.PATH.ROOT}/${x.file}`, selected: true, size: tx('SR2E.SceneBuilder.sizeShort', { w: x.width, h: x.height }) })),
      ],
      plain: s.backdrop === '', custom: s.backdrop === 'custom', builtIn: Boolean(b),
      canWalls: Boolean(b) && (b!.walls.length + b!.doors.length + b!.lights.length > 0) && !hasWalls && geo.width === b!.width && geo.height === b!.height,
      hasWalls, sizeLocked: this.editing || Boolean(b), sizeFromBackdrop: !this.editing && Boolean(b),
      templateName: this.pick.templateName || s.name,
      hours: [{ id: '', label: this.editing ? tx('SR2E.SceneBuilder.hourKeep') : tx('SR2E.SceneBuilder.hourNone') }, ...Array.from({ length: 24 }, (_, h) => ({ id: String(h), label: tx('SR2E.SceneBuilder.hourOption', { h: String(h).padStart(2, '0') }) }))].map((o) => ({ ...o, selected: o.id === (s.hour === null ? '' : String(s.hour)) })),
      hourSet: s.hour !== null, darknessAuto: s.darkness === null, darkness: Math.round(darkness * 100) / 100, darknessPct: Math.round(darkness * 100), light: lightLabel(darkness),
      weathers: RULES.HEALTH.weather.map((w: any) => ({ id: w.id, label: String(w.label), selected: w.id === s.weather })),
      terrains: [{ id: '', label: tx('SR2E.SceneBuilder.terrainNone'), selected: !s.terrain }, ...RULES.VEHICLES.terrain.map((t: any) => ({ id: t.id, label: String(t.label), selected: t.id === s.terrain }))],
      wardKinds: ['ward', 'mana barrier', 'astral barrier', 'physical barrier'].map((k) => ({ id: k, label: tKey(`SR2E.SceneBuilder.wardKind.${k.replace(/\s+/g, '')}`), selected: k === s.ward.kind })),
      wardAreas: [{ id: 'scene', label: tx('SR2E.SceneBuilder.wardScene') }, { id: 'npcs', label: tx('SR2E.SceneBuilder.wardNpcs') }].map((o) => ({ ...o, selected: o.id === s.ward.area })),
      pcs, rows: s.people.map(rowView), tokens: tokenCount(s),
      actorPick: sel([{ id: '', label: tx('SR2E.SceneBuilder.pickActor') }, ...actorChoices(['npc', 'character', 'spirit', 'vehicle', 'ic', 'barrier'])], this.pick.actor),
      genKinds: ROW_KINDS.map((k) => ({ id: k, label: tKey(`SR2E.SceneBuilder.gen.${k}`), selected: k === this.pick.gen })),
      sites: sel([{ id: '', label: tx('SR2E.SceneBuilder.pickSite') }, ...actorChoices(['site'])], s.site.uuid),
      hosts: sel([{ id: '', label: tx('SR2E.SceneBuilder.pickHost') }, ...actorChoices(['host'])], s.host.uuid),
      threats: gen.threats,
      siteThreats: sel(gen.threats, String(s.site.threat)), hostThreats: sel(gen.threats, String(s.host.threat)),
      siteMode: { [s.site.mode]: true }, hostMode: { [s.host.mode]: true },
      playlists: sel([{ id: '', label: tx('SR2E.SceneBuilder.noPlaylist') }, ...[...((game as any).playlists ?? [])].map((p: any) => ({ id: p.id, label: p.name }))], s.playlist),
      combats: (['none', 'ready', 'roll'] as const).map((c) => ({ id: c, label: tKey(`SR2E.SceneBuilder.combat.${c}`), selected: c === s.combat })),
      shows: (['none', 'view', 'activate'] as const).map((c) => ({ id: c, label: tKey(`SR2E.SceneBuilder.show.${c}`), selected: c === s.show })),
      summary: specSummary(s, { pc: nameOf, actor: nameOf }),
      problems, ready: problems.length === 0,
      worldHour: Math.floor(timeOfDayHours(Number((game as any).time?.worldTime ?? 0))),
    };
  }

  async _onRender(context: any, options: any): Promise<void> {
    await (super._onRender as any)?.(context, options);
    const root: HTMLElement = (this as any).element;
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-sb]').forEach((el) => el.addEventListener('change', () => {
      this.#set(el);
      void this.render();
    }));
    (root.querySelector('input[name="sbTemplateName"]') as HTMLInputElement | null)?.addEventListener('change', (ev) => { this.pick.templateName = (ev.target as HTMLInputElement).value; });
    root.querySelectorAll<HTMLSelectElement>('[data-sb-pick]').forEach((el) => el.addEventListener('change', () => {
      (this.pick as any)[el.dataset['sbPick'] ?? ''] = el.value;
    }));
    // Actors dragged from the sidebar onto the "Who's there" step.
    const drop = root.querySelector<HTMLElement>('.sr2e-sb-drop');
    if (drop) {
      drop.addEventListener('dragover', (ev) => { ev.preventDefault(); drop.classList.add('sr2e-over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('sr2e-over'));
      drop.addEventListener('drop', (ev) => { ev.preventDefault(); drop.classList.remove('sr2e-over'); void this.#dropped(ev); });
    }
  }

  /** One field of the form into the spec (`data-sb` is the path; `data-row` a people row's id). */
  #set(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
    const path = el.dataset['sb'] ?? '';
    const raw: any = (el as HTMLInputElement).type === 'checkbox' ? (el as HTMLInputElement).checked : el.value;
    const rowId = el.dataset['row'];
    if (path === 'pc') {
      const u = el.dataset['uuid'] ?? '';
      const set = new Set(this.spec.pcs);
      if (raw) set.add(u); else set.delete(u);
      this.spec = normalizeSpec({ ...this.spec, pcs: [...set] });
      return;
    }
    if (rowId) {
      const rows = this.spec.people.map((r) => (r.id === rowId ? { ...r, [path]: raw } : r));
      this.spec = normalizeSpec({ ...this.spec, people: rows });
      return;
    }
    const v = path === 'hour' || path === 'darkness' ? (raw === '' ? null : raw) : raw;
    if (path === 'darknessAuto') { this.spec = normalizeSpec({ ...this.spec, darkness: raw ? null : sceneDarkness(this.spec) }); return; }
    const next: any = foundry.utils.deepClone(this.spec);
    foundry.utils.setProperty(next, path, v);
    this.spec = normalizeSpec(next);
  }

  async #dropped(ev: DragEvent): Promise<void> {
    let data: any = null;
    try { data = (foundry as any).applications?.ux?.TextEditor?.implementation?.getDragEventData?.(ev) ?? JSON.parse(ev.dataTransfer?.getData('text') ?? 'null'); } catch { data = null; }
    if (data?.type !== 'Actor' || !data.uuid) return;
    const a: any = await (globalThis as any).fromUuid(data.uuid);
    if (!a || a.pack) { ui.notifications?.warn?.(tx('SR2E.SceneBuilder.worldActorsOnly')); return; }
    this.#addActor(a);
    void this.render();
  }

  #addActor(a: any): void {
    if (a.type === 'character' && a.hasPlayerOwner) {
      this.spec = normalizeSpec({ ...this.spec, pcs: [...this.spec.pcs, a.uuid] });
      return;
    }
    const row = { ...defaultRow('actor'), uuid: a.uuid, linked: Boolean(a.prototypeToken?.actorLink) && a.type !== 'npc' };
    this.spec = normalizeSpec({ ...this.spec, people: [...this.spec.people, row] });
  }

  // ------------------------------------------------------------ Actions

  static #onStep(this: SR2SceneBuilder, _e: Event, t: HTMLElement) {
    const id = t.dataset['step'] as SceneStep;
    if (SCENE_STEPS.includes(id)) { this.step = id; void this.render(); }
  }
  static #onNext(this: SR2SceneBuilder) { this.step = stepMoveTo(this.step, 1); void this.render(); }
  static #onBack(this: SR2SceneBuilder) { this.step = stepMoveTo(this.step, -1); void this.render(); }
  static #onKind(this: SR2SceneBuilder, _e: Event, t: HTMLElement) {
    const k = t.dataset['kind'] as SceneKind;
    if (!SCENE_KINDS.includes(k)) return;
    // Editing keeps the scene's own picture; a new scene takes the kind's defaults.
    this.spec = this.editing ? normalizeSpec({ ...this.spec, kind: k, globalLight: kindDefaults(k).globalLight ?? this.spec.globalLight }) : switchKind(this.spec, k);
    void this.render();
  }
  static #onBackdrop(this: SR2SceneBuilder, _e: Event, t: HTMLElement) {
    const id = t.dataset['backdrop'] ?? '';
    const next = withBackdrop(this.spec, id);
    // A changed scene keeps its size (its tokens and walls are where they are).
    this.spec = this.editing ? normalizeSpec({ ...next, width: this.spec.width, height: this.spec.height, walls: false }) : next;
    void this.render();
  }
  static #onPickImage(this: SR2SceneBuilder) {
    const FP: any = (foundry as any).applications?.apps?.FilePicker?.implementation ?? (globalThis as any).FilePicker;
    if (!FP) return;
    new FP({ type: 'image', current: this.spec.image, callback: (path: string) => { this.spec = normalizeSpec({ ...this.spec, backdrop: 'custom', image: path }); void this.render(); } }).render(true);
  }
  static #onAddActor(this: SR2SceneBuilder) {
    const a: any = this.pick.actor ? (globalThis as any).fromUuidSync?.(this.pick.actor) : null;
    if (!a) { ui.notifications?.info?.(tx('SR2E.SceneBuilder.pickActorFirst')); return; }
    this.#addActor(a);
    this.pick.actor = '';
    void this.render();
  }
  static #onAddGen(this: SR2SceneBuilder) {
    const kind = ROW_KINDS.includes(this.pick.gen) ? this.pick.gen : 'group';
    const row = { ...defaultRow('generate'), kind, groupKind: kind === 'group' ? 'gang' : '', spiritKind: kind === 'spirit' ? 'random' : '', count: 1 };
    this.spec = normalizeSpec({ ...this.spec, people: [...this.spec.people, row] });
    void this.render();
  }
  static #onRemoveRow(this: SR2SceneBuilder, _e: Event, t: HTMLElement) {
    this.spec = normalizeSpec({ ...this.spec, people: this.spec.people.filter((r) => r.id !== t.dataset['row']) });
    void this.render();
  }
  static #onReroll(this: SR2SceneBuilder, _e: Event, t: HTMLElement) {
    this.spec = normalizeSpec({ ...this.spec, people: this.spec.people.map((r) => (r.id === t.dataset['row'] ? { ...r, seed: Math.floor(Math.random() * 1e9) } : r)) });
    void this.render();
  }
  static #onNew(this: SR2SceneBuilder) { this.sceneId = ''; this.spec = defaultSpec('real'); this.step = 'basics'; this.pick.templateName = ''; void this.render(); }

  static async #onLoadTemplate(this: SR2SceneBuilder) {
    const id = (this as any).element?.querySelector('select[name="sbTemplate"]')?.value ?? '';
    const tpl = settingTemplates().find((x) => x.id === id);
    if (!tpl) return;
    // A template's people and security are its own; the name and folder stay this scene's when they are set.
    this.spec = normalizeSpec({ ...tpl.spec, name: this.spec.name || tpl.spec.name, folderId: this.spec.folderId, ...(this.editing ? { width: this.spec.width, height: this.spec.height, grid: this.spec.grid, gridDistance: this.spec.gridDistance, walls: false, backdrop: this.spec.backdrop, image: this.spec.image, color: this.spec.color } : {}) });
    ui.notifications?.info?.(tx('SR2E.SceneBuilder.templateLoaded', { name: esc(tpl.name) }));
    void this.render();
  }
  static async #onSaveTemplate(this: SR2SceneBuilder) {
    const el: HTMLInputElement | null = (this as any).element?.querySelector('input[name="sbTemplateName"]') ?? null;
    const name = String(el?.value ?? '').trim() || this.spec.name;
    if (!name) { ui.notifications?.warn?.(tx('SR2E.SceneBuilder.templateNeedsName')); return; }
    const list = settingTemplates();
    const same = list.find((x) => x.name === name);
    const tpl = templateOf(same?.id ?? (foundry as any).utils.randomID(), name, this.spec);
    await (game as any).settings.set(SYSTEM.id, 'sceneTemplates', [...list.filter((x) => x.id !== tpl.id), tpl]);
    ui.notifications?.info?.(same ? tx('SR2E.SceneBuilder.templateReplaced', { name: esc(tpl.name) }) : tx('SR2E.SceneBuilder.templateSaved', { name: esc(tpl.name) }));
    void this.render();
  }
  static async #onDeleteTemplate(this: SR2SceneBuilder) {
    const id = (this as any).element?.querySelector('select[name="sbTemplate"]')?.value ?? '';
    const tpl = settingTemplates().find((x) => x.id === id);
    if (!tpl) return;
    const ok = await DialogV2.confirm({ window: { title: tx('SR2E.SceneBuilder.deleteTemplateTitle') }, content: `<p>${tHtml('SR2E.SceneBuilder.deleteTemplateAsk', { name: tpl.name })}</p>`, rejectClose: false });
    if (!ok) return;
    await (game as any).settings.set(SYSTEM.id, 'sceneTemplates', settingTemplates().filter((x) => x.id !== id));
    void this.render();
  }

  static async #onBuild(this: SR2SceneBuilder) {
    if (this.#busy) return;
    const problems = specProblems(this.spec, { edit: this.editing, known });
    if (problems.length) { ui.notifications?.warn?.(esc(problems.join(' '))); return; }
    // Moving world time runs every timer (healing, upkeep, projects, spirits leaving): ask first.
    const now = Number((game as any).time?.worldTime ?? 0);
    const advance = this.spec.moveTime && this.spec.hour !== null ? secondsUntilHour(now, this.spec.hour) : 0;
    if (advance > 0) {
      const ok = await DialogV2.confirm({ window: { title: tx('SR2E.SceneBuilder.moveTimeTitle') }, content: `<p>${tHtml('SR2E.SceneBuilder.moveTimeAsk', { hours: Math.round(advance / 360) / 10, hour: String(this.spec.hour).padStart(2, '0') })}</p>`, rejectClose: false });
      if (!ok) return;
    }
    this.#busy = true;
    try {
      const out = this.editing ? await applyToScene(this.sceneId, this.spec) : await buildScene(this.spec);
      if (advance > 0) await (game as any).time.advance(advance);
      ui.notifications?.info?.(esc(out.message));
      if (out.sceneId) { this.load(out.sceneId); this.step = 'finish'; }
      void this.render();
    } catch (err) {
      console.error('sr2e | scene builder', err);
      ui.notifications?.error?.(tx('SR2E.SceneBuilder.buildFailed', { err: esc((err as Error)?.message ?? err) }));
    } finally { this.#busy = false; }
  }

  static async #onRemoveScene(this: SR2SceneBuilder) {
    if (!this.sceneId) return;
    let msg = '';
    try { msg = await removeBuiltScene(this.sceneId); } catch (err) { ui.notifications?.warn?.(esc((err as Error)?.message ?? err)); return; }
    if (!msg) return;
    ui.notifications?.info?.(esc(msg));
    this.sceneId = '';
    this.spec = defaultSpec('real');
    this.step = 'basics';
    void this.render();
  }
}

// ---------------------------------------------------------------- Building

/** One build or remove at a time on this client (the window and the API). */
let working: Promise<any> | null = null;
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (working) return Promise.reject(new Error(tx('SR2E.SceneBuilder.busy')));
  const p = fn().finally(() => { working = null; });
  working = p;
  return p;
}

interface BuildResult { sceneId: string; message: string }

/** Build a new scene from a spec (GM only). */
export function buildScene(raw: SceneSpec | Record<string, unknown>): Promise<BuildResult> {
  return exclusive(() => build(normalizeSpec(raw), null));
}

/** Change an existing scene's settings and add what the spec adds (GM only; nothing on the scene is deleted). */
export function applyToScene(sceneId: string, raw: SceneSpec | Record<string, unknown>): Promise<BuildResult> {
  return exclusive(async () => {
    const scene: any = (game as any).scenes?.get?.(sceneId);
    if (!scene) throw new Error(tx('SR2E.SceneBuilder.sceneGone'));
    return build(normalizeSpec(raw), scene);
  });
}

async function build(spec: SceneSpec, existing: any): Promise<BuildResult> {
  const g: any = game;
  if (!g.user?.isGM) throw new Error(tx('SR2E.SceneBuilder.gmOnly'));
  const problems = specProblems(spec, { edit: Boolean(existing), known });
  if (problems.length) throw new Error(problems.join(' '));
  const b = backdropById(spec.backdrop);
  let imagePath = b ? `${SYSTEM.PATH.ROOT}/${b.file}` : spec.backdrop === 'custom' ? spec.image : '';
  const A: any = CONFIG.Actor.documentClass;
  const made = { actors: [] as any[], tokens: 0 };

  // The scene.
  let scene: any = existing;
  const sbData = { kind: spec.kind, spec: { ...spec }, by: g.user.id, at: Date.now() };
  if (!scene) {
    const S2: any = (globalThis as any).Scene;
    // The picture is set apart below (Foundry v14 keeps it on the scene's level), so a field v14 refuses can't stop the build.
    const data: any = sceneCreateData(spec, { imagePath: '', flags: { [SYSTEM.id]: { ...sceneFlags(spec), [SB_FLAG]: sbData } } });
    scene = await S2.create(data);
    if (!scene) throw new Error(tx('SR2E.SceneBuilder.sceneNotMade'));
  } else {
    // Only what the GM changed is written (the scene's own values, beyond what the window can show, stay as they are).
    const base = specFromScene(scene);
    const changed = (k: keyof SceneSpec) => JSON.stringify(spec[k]) !== JSON.stringify(base[k]);
    const upd: Record<string, unknown> = {};
    if (changed('name')) upd['name'] = spec.name;
    if (changed('folderId')) upd['folder'] = spec.folderId || null;
    if (changed('color')) upd['backgroundColor'] = spec.color;
    if (changed('tokenVision')) upd['tokenVision'] = spec.tokenVision;
    if (changed('fog')) upd['fog.exploration'] = spec.fog;
    if (changed('darkness') || changed('hour')) upd['environment.darknessLevel'] = sceneDarkness(spec);
    if (changed('globalLight')) upd['environment.globalLight.enabled'] = spec.globalLight;
    const flagMap: Record<string, keyof SceneSpec> = { backgroundCount: 'background', backgroundSources: 'sources', environment: 'environment', weather: 'weather', terrain: 'terrain' };
    const flags = sceneFlags(spec);
    for (const [f, k] of Object.entries(flagMap)) if (changed(k)) upd[`flags.${SYSTEM.id}.${f}`] = flags[f];
    const prev = sceneFlag(scene);
    if (prev) upd[`flags.${SYSTEM.id}.${SB_FLAG}`] = { ...prev, kind: spec.kind, spec: { ...spec } };
    if (Object.keys(upd).length) await scene.update(upd);
    if (!changed('backdrop') && !changed('image')) imagePath = '';
  }
  const geo: SceneGeo = existing ? geoOfScene(scene) : geoOf(spec);
  // Foundry v14 keeps the background on the scene's level (older versions on the scene itself).
  let pictured = false;
  try {
    const level: any = scene.levels?.contents?.[0];
    const colour = !existing || spec.color !== specFromScene(existing).color;
    if (level && (colour || imagePath)) { await scene.updateEmbeddedDocuments('Level', [{ _id: level.id, ...(colour ? { 'background.color': spec.color } : {}), ...(imagePath ? { 'background.src': imagePath } : {}) }]); pictured = true; }
  } catch (err) { console.warn('sr2e | scene builder level', err); }
  if (imagePath && !pictured) { try { await scene.update({ 'background.src': imagePath }); } catch (err) { console.warn('sr2e | scene builder picture', err); } }
  const sceneId = scene.id;
  const tag = { [SYSTEM.id]: { [SB_FLAG]: { sceneId } } };

  // The backdrop's walls, doors and lamps (a new scene, or one with no walls yet).
  const doors: Array<{ wallId: string; name: string }> = [];
  const wallsNow = Number(scene.walls?.size ?? 0);
  // The backdrop's geometry is drawn for its size: only on a scene of that size.
  if (b && spec.walls && !wallsNow && geo.width === b.width && geo.height === b.height) {
    const docs = backdropDocuments(b, geo);
    if (docs.walls.length) await scene.createEmbeddedDocuments('Wall', docs.walls);
    if (docs.doors.length) {
      // Each door carries its index, so a lock goes on the right door even if another module drops one.
      const ds: any[] = (await scene.createEmbeddedDocuments('Wall', docs.doors.map((d, i) => ({ ...d.data, flags: { [SYSTEM.id]: { [SB_FLAG]: { door: i } } } })))) ?? [];
      for (const w of ds) {
        const d = docs.doors[Number(w?.flags?.[SYSTEM.id]?.[SB_FLAG]?.door ?? -1)];
        if (w && d?.secure) doors.push({ wallId: w.id, name: tKey(d.name) });
      }
    }
    if (docs.lights.length) await scene.createEmbeddedDocuments('AmbientLight', docs.lights);
  }

  // An actor folder for what the builder makes (only when it makes something).
  let folderId: string | null | undefined;
  const folder = async (): Promise<string | null> => {
    if (folderId !== undefined) return folderId;
    try { const f = await (globalThis as any).Folder.create({ name: tx('SR2E.SceneBuilder.folderName', { name: spec.name }), type: 'Actor', color: '#3a6ea5', flags: tag }); folderId = f?.id ?? null; } catch { folderId = null; }
    return folderId ?? null;
  };
  const create = async (data: any): Promise<any> => {
    const fid = await folder();
    const a = await A.create({ ...data, ...(fid ? { folder: fid } : {}), flags: { ...(data.flags ?? {}), [SYSTEM.id]: { ...(data.flags?.[SYSTEM.id] ?? {}), ...tag[SYSTEM.id] } } });
    if (a) made.actors.push(a);
    return a;
  };

  // The host and the site.
  let host: any = spec.host.mode === 'existing' ? await (globalThis as any).fromUuid(spec.host.uuid) : null;
  if (spec.host.mode === 'generate') {
    const org = generateOrg({ threat: spec.host.threat, corporation: spec.host.corporation }, makeRng(Math.floor(Math.random() * 1e9)));
    host = await create({ ...hostActorData(org), name: tx('SR2E.SceneBuilder.hostName', { name: spec.name }) });
  }
  let site: any = spec.site.mode === 'existing' ? await (globalThis as any).fromUuid(spec.site.uuid) : null;
  if (spec.site.mode === 'generate') {
    site = await create({ name: tx('SR2E.SceneBuilder.siteName', { name: spec.name }), type: 'site', system: generatedSiteSystem({ threat: spec.site.threat, hostUuid: host?.uuid ?? '', sceneId, doors }) });
  } else if (site && host && !site.system?.hostUuid) {
    try { await site.update({ 'system.hostUuid': host.uuid }); } catch { /* the GM's site */ }
  }

  // A ward over the scene or the NPCs' area.
  let ward: any = null;
  if (spec.ward.on) {
    ward = await create({ name: tx('SR2E.SceneBuilder.wardName', { name: spec.name }), type: 'barrier', system: { barrierKind: spec.ward.kind, rating: spec.ward.rating, baseRating: spec.ward.rating } });
    if (ward) {
      try {
        await scene.createEmbeddedDocuments('Region', [rectRegionData(wardArea(spec, geo), geo, { name: ward.name, color: palette('street', 'cyan').areas.magic.base, flags: { [SYSTEM.id]: { env: { wardUuid: ward.uuid } } } })]);
      } catch (err) { console.warn('sr2e | scene builder ward', err); }
    }
  }

  // Who's there.
  const zones = zonesFor(spec, geo);
  const onScene = new Set([...(scene.tokens ?? [])].map((t: any) => t.actor?.uuid ?? '').filter(Boolean));
  // Only world actors of the kinds that stand on a map (a compendium actor or a site makes a broken token).
  const STANDS = ['character', 'npc', 'spirit', 'vehicle', 'ic', 'barrier'];
  const worldActor = async (u: string): Promise<any> => { const a: any = await (globalThis as any).fromUuid(u); return a && !a.pack && a.documentName === 'Actor' && STANDS.includes(a.type) ? a : null; };
  const pcActors = (await Promise.all(spec.pcs.map(worldActor))).filter((a: any) => a && !onScene.has(a.uuid));
  const groups: Array<{ actors: any[]; row: PeopleRow | null }> = [];
  for (const row of spec.people) {
    if (row.source === 'actor') {
      const a: any = await worldActor(row.uuid);
      if (a) groups.push({ actors: Array.from({ length: row.linked ? 1 : row.count }, () => a), row });
      continue;
    }
    const state: GenState = {
      ...DEFAULT_STATE, kind: row.kind, threat: row.threat, seed: row.seed, archetype: row.archetype,
      groupKind: (row.groupKind || 'gang') as any, spiritKind: (row.spiritKind || 'random') as any, critter: row.critter, critterCount: row.count,
      tokens: false, hidden: row.hidden, moraleGroup: false,
    };
    const list: any[] = [];
    await createFromPlan(planFor(state) as any, state, { made: list, folderId: await folder(), flags: tag[SYSTEM.id] });
    made.actors.push(...list);
    groups.push({ actors: list, row });
  }
  const tokenData = async (a: any, at: { x: number; y: number }, row: PeopleRow | null, gi = -1): Promise<any> => {
    const t = (await a.getTokenDocument({ x: at.x, y: at.y })).toObject();
    // A player character: its own (linked) token, visible and friendly.
    if (!row) return { ...t, actorLink: true, hidden: false, disposition: 1 };
    // The row each token came from (morale groups), on the token itself.
    t.flags = { ...(t.flags ?? {}), [SYSTEM.id]: { ...(t.flags?.[SYSTEM.id] ?? {}), [SB_FLAG]: { row: gi } } };
    // Copies of a world actor are unlinked (their damage stays on the token), unless the row is a unique NPC.
    const linked = row.source === 'actor' ? row.linked : Boolean(t.actorLink);
    return { ...t, actorLink: linked, hidden: row.hidden, disposition: dispositionOf(row.attitude) };
  };
  const hostToken = spec.kind === 'matrix' && host && !onScene.has(host.uuid);
  const pcSpots = spotsInZone(pcActors.length, zones.pcs, geo);
  const npcCount = groups.reduce((n, gr) => n + gr.actors.length, 0) + (hostToken ? 1 : 0);
  const npcSpots = spotsInZone(npcCount, zones.npcs, geo);
  const docs: any[] = [];
  for (const [i, a] of pcActors.entries()) docs.push(await tokenData(a, pcSpots[i]!, null));
  let k = 0;
  for (const [gi, gr] of groups.entries()) for (const a of gr.actors) docs.push(await tokenData(a, npcSpots[k++]!, gr.row, gi));
  // A Matrix scene: the host stands on its own map (IC arrives from its sheaf as the tally climbs).
  if (hostToken) docs.push({ ...(await host.getTokenDocument({ x: npcSpots[k]!.x, y: npcSpots[k]!.y })).toObject(), hidden: false });
  const toks: any[] = docs.length ? ((await scene.createEmbeddedDocuments('Token', docs)) ?? []) : [];
  made.tokens = toks.length;
  // Morale groups: everyone from one row (people only).
  for (const [gi, gr] of groups.entries()) {
    if (!gr.row?.morale) continue;
    // The person being guarded is not part of the guards' morale (as in the NPC generator).
    const people = toks.filter((t: any) => t?.flags?.[SYSTEM.id]?.[SB_FLAG]?.row === gi)
      .filter((t: any) => ['npc', 'character'].includes(t.actor?.type) && !/principal/i.test(String(t.actor?.flags?.[SYSTEM.id]?.generated?.role ?? '')));
    if (people.length > 1) { try { await A.setMoraleGroup?.(people, true); } catch { /* no morale groups */ } }
  }

  // The GM journal: the notes, what was made, links.
  let journal: any = null;
  if (spec.journal) {
    const notes = spec.notes.trim() ? spec.notes.trim().split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') : '';
    const summary = specSummary(spec, { pc: nameOf, actor: nameOf }).map((r) => `<li><strong>${esc(r.label)}:</strong> ${esc(r.value)}</li>`).join('');
    const madeList = made.actors.length ? `<h2>${tHtml('SR2E.SceneBuilder.journalMade')}</h2><ul>${made.actors.map((a) => `<li>@UUID[${esc(a.uuid)}]</li>`).join('')}</ul>` : '';
    const html = `${notes}<h2>${tHtml('SR2E.SceneBuilder.journalSummary')}</h2><ul>${summary}</ul>${madeList}`;
    const J: any = (globalThis as any).JournalEntry;
    journal = await J.create({ name: tx('SR2E.SceneBuilder.journalName', { name: spec.name }), ownership: { default: 0 }, flags: tag, pages: [{ name: spec.name, type: 'text', text: { content: html, format: 1 } }] });
  }
  const sceneLinks: Record<string, unknown> = {};
  if (journal) sceneLinks['journal'] = journal.id;
  if (spec.playlist) sceneLinks['playlist'] = spec.playlist;
  if (Object.keys(sceneLinks).length) { try { await scene.update(sceneLinks); } catch (err) { console.warn('sr2e | scene builder links', err); } }

  // The combat tracker.
  if (spec.combat !== 'none' && toks.length) {
    try {
      const C: any = (globalThis as any).Combat;
      const combat: any = await C.create({ scene: sceneId, active: false, flags: tag });
      await combat?.createEmbeddedDocuments('Combatant', toks.filter((t: any) => t.actor && t.actor.type !== 'host').map((t: any) => ({ tokenId: t.id, sceneId, actorId: t.actorId, hidden: Boolean(t.hidden) })));
      if (spec.combat === 'roll') await combat?.rollNPC?.();
    } catch (err) { console.warn('sr2e | scene builder combat', err); }
  }

  if (spec.show === 'view') await scene.view?.();
  else if (spec.show === 'activate') await scene.activate?.();

  const message = existing
    ? tx('SR2E.SceneBuilder.changed', { name: scene.name, tokens: made.tokens, actors: made.actors.length })
    : tx('SR2E.SceneBuilder.built', { name: scene.name, tokens: made.tokens, actors: made.actors.length });
  return { sceneId, message };
}

// ---------------------------------------------------------------- Removing

/** Everything the builder made for a scene, by kind. */
export function builtDocuments(sceneId: string): { scene: any; actors: any[]; journal: any[]; folders: any[]; combats: any[] } {
  const g: any = game;
  return {
    scene: g.scenes?.get?.(sceneId) ?? null,
    actors: [...(g.actors ?? [])].filter((a: any) => madeFor(a, sceneId)),
    journal: [...(g.journal ?? [])].filter((j: any) => madeFor(j, sceneId)),
    folders: [...(g.folders ?? [])].filter((f: any) => madeFor(f, sceneId)),
    combats: [...(g.combats ?? [])].filter((c: any) => madeFor(c, sceneId)),
  };
}

/** Delete a scene the builder made and everything it made for it (asks first). Returns a summary, '' if cancelled. */
export function removeBuiltScene(sceneId: string, o: { confirm?: boolean } = {}): Promise<string> {
  return exclusive(async () => {
    const g: any = game;
    if (!g.user?.isGM) throw new Error(tx('SR2E.SceneBuilder.gmOnly'));
    const d = builtDocuments(sceneId);
    if (!d.scene || !sceneFlag(d.scene)) { ui.notifications?.warn?.(tx('SR2E.SceneBuilder.notBuilt')); return ''; }
    // Tokens of the builder's actors placed on other scenes go too (they would point at deleted actors).
    const ids = new Set(d.actors.map((a: any) => a.id));
    const elsewhere = [...(g.scenes ?? [])].filter((x: any) => x.id !== sceneId).map((sc: any) => ({ sc, toks: [...(sc.tokens ?? [])].filter((t: any) => ids.has(t.actorId)).map((t: any) => t.id) })).filter((x) => x.toks.length);
    const tokens = elsewhere.reduce((n, x) => n + x.toks.length, 0);
    if (o.confirm !== false) {
      const ok = await DialogV2.confirm({
        window: { title: tx('SR2E.SceneBuilder.removeTitle') }, classes: ['sr2e-dialog'],
        content: `<p>${tHtml('SR2E.SceneBuilder.removeAsk', { name: d.scene.name, actors: d.actors.length, journal: d.journal.length, combats: d.combats.length })}</p>${tokens ? `<p>${tHtml('SR2E.SceneBuilder.removeTokensAsk', { tokens })}</p>` : ''}`,
        rejectClose: false,
      });
      if (!ok) return '';
    }
    const G: any = globalThis;
    const del = async (cls: any, docs: any[]) => { if (docs.length) await cls.deleteDocuments(docs.map((x: any) => x.id)); };
    await del(G.Combat, d.combats);
    for (const x of elsewhere) await x.sc.deleteEmbeddedDocuments('Token', x.toks);
    // A site of the GM's own linked to a host the builder made loses the link (it would point at nothing).
    const gone = new Set(d.actors.map((a: any) => a.uuid));
    for (const site of [...(g.actors ?? [])].filter((a: any) => a.type === 'site' && !gone.has(a.uuid) && gone.has(String(a.system?.hostUuid ?? '')))) {
      try { await site.update({ 'system.hostUuid': '' }); } catch { /* the GM's site */ }
    }
    await del(CONFIG.Actor.documentClass, d.actors);
    await del(G.JournalEntry, d.journal);
    const name = d.scene.name;
    await d.scene.delete();
    await del(G.Folder, builtDocuments(sceneId).folders);
    return tx('SR2E.SceneBuilder.removed', { name, n: d.actors.length + d.journal.length + 1 });
  });
}

// ---------------------------------------------------------------- Opening it

export function openSceneBuilder(o: { sceneId?: string } = {}): SR2SceneBuilder | null { return SR2SceneBuilder.open(o); }

export function registerSceneBuilder(): void {
  try { (game as any).settings.register(SYSTEM.id, 'sceneTemplates', { scope: 'world', config: false, type: Array, default: [] }); } catch (err) { console.warn('sr2e | scene templates setting', err); }
  // The Scenes sidebar: a button for the GM.
  Hooks.on('renderSceneDirectory', (_app: any, html: HTMLElement) => {
    try {
      if (!isGm()) return;
      const root: HTMLElement = (html as any)?.querySelector ? html : (html as any)?.[0];
      if (!root || root.querySelector('[data-sr2e-action="sceneBuilder"]')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset['sr2eAction'] = 'sceneBuilder';
      btn.className = 'sr2e-award sr2e-tools-button';
      btn.innerHTML = `<i class="fa-solid fa-map-location-dot" aria-hidden="true"></i> ${tHtml('SR2E.SceneBuilder.title')}`;
      btn.addEventListener('click', (ev) => { ev.preventDefault(); openSceneBuilder({ sceneId: '' }); });
      const anchor = root.querySelector('.directory-footer, footer') ?? root.querySelector('.directory-header, header');
      (anchor ?? root).prepend(btn);
    } catch (err) { console.warn('sr2e | scene builder button', err); }
  });
  // A scene's context menu: change it with the builder.
  Hooks.on('getSceneContextOptions', (_app: any, options: any[]) => {
    try {
      if (!Array.isArray(options)) return;
      options.push({
        name: 'SR2E.SceneBuilder.contextChange', icon: '<i class="fa-solid fa-map-location-dot"></i>',
        condition: () => isGm(),
        callback: (li: any) => { const el: HTMLElement = li?.dataset ? li : li?.[0]; const id = el?.dataset?.['entryId'] ?? el?.dataset?.['sceneId'] ?? ''; if (id) openSceneBuilder({ sceneId: id }); },
      });
    } catch (err) { console.warn('sr2e | scene builder menu', err); }
  });
}
