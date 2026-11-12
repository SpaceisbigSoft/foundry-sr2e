/**
 * v0.91.7: the Scene builder (the owner's request, 11 Nov 2026: "a GM sheet that is a guided walkthrough for creating
 * a scene, with all the options needed in one place"). Pure: the builder's state (a `SceneSpec`, also the format of a
 * saved template), the defaults each kind of scene brings (Real world, Astral, Matrix host: the owner chose defaults
 * and links only, 11 Nov 2026), time of day → Foundry darkness, token placement in a backdrop's start zones, the
 * Foundry document data for the scene, its walls, doors, lamps and ward region, a generated security site, the
 * summary on the last step and what still stops a build. The window and the Foundry glue are
 * `applications/scenebuilder.ts`; the built-in backdrops are `rules/backdrops.ts`.
 *
 * Nothing here is a rules number: darkness by hour, device ratings by Threat and the sizes are the builder's
 * defaults, and the GM changes every one of them in the window or on the documents afterwards.
 */
import { RULES } from './config.ts';
import { backdropById, type Backdrop, type BackdropRect } from './backdrops.ts';
import { timeOfDayHours } from './arcanum.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';

export type SceneKind = 'real' | 'astral' | 'matrix';
export const SCENE_KINDS: readonly SceneKind[] = ['real', 'astral', 'matrix'];
export const SCENE_STEPS = ['basics', 'map', 'conditions', 'magic', 'people', 'security', 'finish'] as const;
export type SceneStep = typeof SCENE_STEPS[number];

/** Sizes the window accepts (metres; grid squares in px). */
export const SCENE_LIMITS = { minMetres: 5, maxMetres: 400, minGrid: 50, maxGrid: 300, maxPeople: 60, maxRows: 30, maxCount: 20, maxThreat: 5 } as const;

/** What a generated people row makes (the NPC generator's kinds that stand on a map). */
export type SbGenKind = 'npc' | 'group' | 'spirit' | 'critter';
export const SB_GEN_KINDS: readonly SbGenKind[] = ['npc', 'group', 'spirit', 'critter'];
export type SbAttitude = 'hostile' | 'neutral' | 'friendly';
export const SB_ATTITUDES: readonly SbAttitude[] = ['hostile', 'neutral', 'friendly'];

/** A people row: an actor already in the world (a catalogue NPC, a named NPC…) or one the NPC generator makes. */
export interface PeopleRow {
  id: string;
  source: 'actor' | 'generate';
  /** source 'actor': the actor. */
  uuid: string;
  /** source 'actor': how many tokens (unlinked copies on the map; a linked actor gets one). */
  count: number;
  /** source 'actor': a linked token (a unique NPC whose sheet is the token's). */
  linked: boolean;
  /** source 'generate'. */
  kind: SbGenKind;
  threat: number;
  archetype: string;
  groupKind: string;
  spiritKind: string;
  critter: string;
  seed: number;
  hidden: boolean;
  attitude: SbAttitude;
  /** Everyone from this row is one morale group. */
  morale: boolean;
}

export interface SceneSpec {
  v: 1;
  name: string;
  folderId: string;
  kind: SceneKind;
  /** Metres. */
  width: number;
  height: number;
  /** Pixels per grid square; each square is `gridDistance` metres. */
  grid: number;
  gridDistance: number;
  gridless: boolean;
  /** A scene being changed keeps its own size (a new one on a built-in backdrop has the backdrop's). */
  keepSize: boolean;
  /** '' a plain colour, a built-in backdrop's id, or 'custom' (the GM's own picture, `image`). */
  backdrop: string;
  image: string;
  color: string;
  /** Make the backdrop's walls, doors and lamps (built-in backdrops only). */
  walls: boolean;
  tokenVision: boolean;
  fog: boolean;
  /** Hour of the day (0–23), or null to leave the darkness as `darkness` says. */
  hour: number | null;
  /** Move world time forward to that hour (timers, healing, upkeep… all run). */
  moveTime: boolean;
  /** Foundry darkness 0–1; null = from the hour (or the kind). */
  darkness: number | null;
  globalLight: boolean;
  weather: string;
  terrain: string;
  background: number;
  sources: string;
  environment: string;
  ward: { on: boolean; rating: number; kind: string; area: 'scene' | 'npcs' };
  pcs: string[];
  people: PeopleRow[];
  site: { mode: 'none' | 'existing' | 'generate'; uuid: string; threat: number };
  host: { mode: 'none' | 'existing' | 'generate'; uuid: string; threat: number; corporation: boolean };
  notes: string;
  journal: boolean;
  playlist: string;
  combat: 'none' | 'ready' | 'roll';
  show: 'none' | 'view' | 'activate';
}

const clamp = (v: unknown, lo: number, hi: number, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const int = (v: unknown, lo: number, hi: number, d: number): number => Math.round(clamp(v, lo, hi, d));
const str = (v: unknown, max = 200): string => String(v ?? '').slice(0, max);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(String(v) as T) ? (String(v) as T) : d);
const colour = (v: unknown, d: string): string => (/^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? String(v).toLowerCase() : d);
const BARRIER_KINDS = ['ward', 'mana barrier', 'astral barrier', 'physical barrier'] as const;

/** What each kind starts with (and what switching to it changes, where the GM hasn't changed the old kind's value). */
export function kindDefaults(kind: SceneKind): Partial<SceneSpec> {
  if (kind === 'matrix') return { backdrop: 'matrix-host', color: '#050d0a', walls: false, tokenVision: false, fog: false, hour: null, darkness: 0, globalLight: true, weather: 'clear', terrain: '', environment: '', background: 0 };
  if (kind === 'astral') return { backdrop: 'astral', color: '#0d0a18', walls: false, tokenVision: false, fog: false, hour: null, darkness: 0, globalLight: true, weather: 'clear', terrain: '' };
  return { backdrop: 'street', color: '#1c2026', walls: true, tokenVision: true, fog: false, hour: 22, darkness: null, globalLight: false, weather: 'clear', terrain: 'normal' };
}

export function newRowId(r: () => number = Math.random): string {
  const abc = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 16; i++) s += abc[Math.floor(r() * abc.length) % abc.length];
  return s;
}

export function defaultRow(source: 'actor' | 'generate', id = newRowId()): PeopleRow {
  return { id, source, uuid: '', count: 1, linked: false, kind: 'group', threat: 2, archetype: '', groupKind: '', spiritKind: '', critter: '', seed: Math.floor(Math.random() * 1e9), hidden: true, attitude: 'hostile', morale: true };
}

/** A new scene's starting state. */
export function defaultSpec(kind: SceneKind = 'real'): SceneSpec {
  const base: SceneSpec = {
    v: 1, name: '', folderId: '', kind, width: 40, height: 30, grid: 100, gridDistance: 1, gridless: false, keepSize: false,
    backdrop: '', image: '', color: '#1c2026', walls: true, tokenVision: true, fog: false,
    hour: null, moveTime: false, darkness: null, globalLight: false, weather: 'clear', terrain: '',
    background: 0, sources: '', environment: '', ward: { on: false, rating: 4, kind: 'ward', area: 'scene' },
    pcs: [], people: [], site: { mode: 'none', uuid: '', threat: 2 }, host: { mode: kind === 'matrix' ? 'generate' : 'none', uuid: '', threat: 2, corporation: true },
    notes: '', journal: true, playlist: '', combat: 'none', show: 'view',
  };
  const spec = { ...base, ...kindDefaults(kind) };
  const b = backdropById(spec.backdrop);
  return b ? withBackdrop(spec, b.id) : spec;
}

/** Switch the kind: the old kind's defaults the GM left alone become the new kind's (their own choices stay). */
export function switchKind(spec: SceneSpec, kind: SceneKind): SceneSpec {
  if (kind === spec.kind) return spec;
  const was = kindDefaults(spec.kind);
  const now = kindDefaults(kind);
  const out: any = { ...spec, kind };
  for (const [k, v] of Object.entries(now)) {
    const cur = (spec as any)[k];
    const old = (was as any)[k];
    // Left at the old kind's default (or never set: an empty text): take the new one.
    if (cur === old || cur === '' || cur === null && old === undefined) out[k] = v;
  }
  if (kind === 'matrix' && spec.host.mode === 'none') out.host = { ...spec.host, mode: 'generate' };
  if (spec.kind === 'matrix' && kind !== 'matrix' && spec.host.mode === 'generate' && spec.site.mode === 'none') out.host = { ...spec.host, mode: 'none' };
  const b = backdropById(out.backdrop);
  // Compared with the backdrop it had, so the old backdrop's environment and terrain give way to the new one's.
  return b && b.id !== spec.backdrop ? withBackdrop({ ...out, backdrop: spec.backdrop }, b.id) : out;
}

/** Pick a backdrop: its size, colour, environment and terrain come with it (the environment only if none is set). */
export function withBackdrop(spec: SceneSpec, id: string): SceneSpec {
  if (id === '' || id === 'custom') return { ...spec, backdrop: id, walls: false };
  const b = backdropById(id);
  if (!b) return spec;
  const prev = backdropById(spec.backdrop);
  const envFromPrev = prev && spec.environment === prev.environment;
  return {
    ...spec, backdrop: b.id, width: b.width, height: b.height, color: b.background,
    walls: b.walls.length + b.windows.length + b.doors.length + b.lights.length > 0,
    environment: !spec.environment || envFromPrev ? b.environment : spec.environment,
    terrain: !spec.terrain || (prev && spec.terrain === prev.terrain) ? b.terrain : spec.terrain,
  };
}

/** A spec from anything (a saved template, the window's form): every field checked and clamped. */
export function normalizeSpec(raw: any): SceneSpec {
  const r = raw && typeof raw === 'object' ? raw : {};
  const kind = oneOf(r.kind, SCENE_KINDS, 'real');
  const d = defaultSpec(kind);
  const L = SCENE_LIMITS;
  // A field left out (an API caller's short spec) takes the kind's and the backdrop's default; one set to null or '' is cleared.
  const hour = r.hour === undefined ? d.hour : r.hour === null || r.hour === '' ? null : int(r.hour, 0, 23, 0);
  const dark = r.darkness === undefined ? d.darkness : r.darkness === null || r.darkness === '' ? null : clamp(r.darkness, 0, 1, 0);
  const weathers = RULES.HEALTH.weather.map((w: any) => w.id);
  const terrains = ['', ...RULES.VEHICLES.terrain.map((t: any) => t.id)];
  const rows: PeopleRow[] = (Array.isArray(r.people) ? r.people : []).slice(0, L.maxRows).map((x: any) => normalizeRow(x)).filter((x: PeopleRow | null): x is PeopleRow => Boolean(x));
  const backdrop = String(r.backdrop ?? d.backdrop);
  const bd = backdropById(backdrop);
  const fromBd = bd ? withBackdrop({ ...d, environment: '', terrain: '' }, bd.id) : d;
  // A built-in backdrop's picture and walls are drawn for its size: a new scene on one has that size (`keepSize`: a
  // scene being changed keeps its own).
  const fixed = bd && !r.keepSize ? { width: bd.width, height: bd.height } : null;
  return {
    v: 1,
    name: str(r.name, 120).trim(),
    folderId: str(r.folderId, 40),
    kind,
    width: fixed ? fixed.width : int(r.width, L.minMetres, L.maxMetres, d.width),
    height: fixed ? fixed.height : int(r.height, L.minMetres, L.maxMetres, d.height),
    grid: int(r.grid, L.minGrid, L.maxGrid, 100),
    gridDistance: clamp(r.gridDistance, 0.5, 10, 1),
    gridless: Boolean(r.gridless),
    keepSize: Boolean(r.keepSize),
    backdrop: backdrop === '' || backdrop === 'custom' || backdropById(backdrop) ? backdrop : '',
    image: str(r.image, 500).trim(),
    color: colour(r.color, fromBd.color),
    walls: Boolean(r.walls ?? fromBd.walls),
    tokenVision: Boolean(r.tokenVision ?? d.tokenVision),
    fog: Boolean(r.fog),
    hour,
    moveTime: Boolean(r.moveTime),
    darkness: dark,
    globalLight: Boolean(r.globalLight ?? d.globalLight),
    weather: oneOf(r.weather, weathers, 'clear'),
    terrain: oneOf(r.terrain ?? fromBd.terrain, terrains, ''),
    background: int(r.background, 0, 20, 0),
    sources: str(r.sources, 500),
    environment: str(r.environment ?? fromBd.environment, 200),
    ward: {
      on: Boolean(r.ward?.on), rating: int(r.ward?.rating, 1, 20, 4),
      kind: oneOf(r.ward?.kind, BARRIER_KINDS, 'ward'), area: oneOf(r.ward?.area, ['scene', 'npcs'] as const, 'scene'),
    },
    pcs: [...new Set((Array.isArray(r.pcs) ? r.pcs : []).map((u: any) => str(u, 120)).filter(Boolean))].slice(0, L.maxPeople) as string[],
    people: rows,
    site: { mode: oneOf(r.site?.mode, ['none', 'existing', 'generate'] as const, 'none'), uuid: str(r.site?.uuid, 120), threat: int(r.site?.threat, 0, L.maxThreat, 2) },
    host: {
      mode: oneOf(r.host?.mode, ['none', 'existing', 'generate'] as const, d.host.mode), uuid: str(r.host?.uuid, 120),
      threat: int(r.host?.threat, 0, L.maxThreat, 2), corporation: r.host?.corporation === undefined ? true : Boolean(r.host.corporation),
    },
    notes: str(r.notes, 5000),
    journal: r.journal === undefined ? true : Boolean(r.journal),
    playlist: str(r.playlist, 40),
    combat: oneOf(r.combat, ['none', 'ready', 'roll'] as const, 'none'),
    show: oneOf(r.show, ['none', 'view', 'activate'] as const, 'view'),
  };
}

export function normalizeRow(x: any): PeopleRow | null {
  if (!x || typeof x !== 'object') return null;
  const source = oneOf(x.source, ['actor', 'generate'] as const, 'actor');
  const L = SCENE_LIMITS;
  return {
    id: /^[A-Za-z0-9]{1,32}$/.test(String(x.id ?? '')) ? String(x.id) : newRowId(),
    source,
    uuid: str(x.uuid, 120),
    count: int(x.count, 1, L.maxCount, 1),
    linked: Boolean(x.linked),
    kind: oneOf(x.kind, SB_GEN_KINDS, 'group'),
    threat: int(x.threat, 0, L.maxThreat, 2),
    archetype: str(x.archetype, 40),
    groupKind: str(x.groupKind, 40),
    spiritKind: str(x.spiritKind, 40),
    critter: str(x.critter, 40),
    seed: int(x.seed, 0, 2 ** 31 - 1, 1),
    hidden: x.hidden === undefined ? true : Boolean(x.hidden),
    attitude: oneOf(x.attitude, SB_ATTITUDES, 'hostile'),
    morale: x.morale === undefined ? true : Boolean(x.morale),
  };
}

/** A saved template: the spec without the things that belong to one scene (its name stays as a suggestion). */
export interface SceneTemplate { id: string; name: string; spec: SceneSpec }
export function templateOf(id: string, name: string, spec: SceneSpec): SceneTemplate {
  return { id, name: str(name, 80).trim() || spec.name || tx('SR2E.SceneBuilder.template'), spec: normalizeSpec({ ...spec, folderId: '', keepSize: false }) };
}
export function normalizeTemplates(raw: unknown): SceneTemplate[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 100).filter((t: any) => t && typeof t === 'object' && t.id)
    .map((t: any) => ({ id: str(t.id, 40), name: str(t.name, 80).trim() || tx('SR2E.SceneBuilder.template'), spec: normalizeSpec(t.spec) }));
}

// ---------------------------------------------------------------- Time of day and darkness

/** Foundry darkness for a time of day: day, dawn and dusk, night (darker away from the city's lights); indoors its lamps light it. */
export const DARKNESS = { day: 0.1, twilight: 0.45, night: 0.7, wildNight: 0.9, indoor: 0.45 } as const;

export function darknessForHour(hour: number, o: { indoor?: boolean; wild?: boolean } = {}): number {
  if (o.indoor) return DARKNESS.indoor;
  const n = RULES.MAGIC_V56.natureSpirits;
  const rise = Number(n.sunrise) || 6;
  const set = Number(n.sunset) || 18;
  const h = ((Number(hour) % 24) + 24) % 24;
  if (Math.abs(h - rise) < 1 || Math.abs(h - set) < 1) return DARKNESS.twilight;
  const day = rise < set ? h > rise && h < set : h > rise || h < set;
  return day ? DARKNESS.day : o.wild ? DARKNESS.wildNight : DARKNESS.night;
}

/** Whether a scene with these environment tags is away from the city's lights. */
export function isWild(environment: string): boolean {
  return /\b(wilderness|forest|mountain|desert|plains|swamp|sea)\b/i.test(environment);
}

/** The darkness the scene gets: the GM's own number, else from the hour, else the kind's. */
export function sceneDarkness(spec: SceneSpec): number {
  if (spec.darkness !== null) return spec.darkness;
  if (spec.kind !== 'real') return 0;
  if (spec.hour === null) return DARKNESS.night;
  const b = backdropById(spec.backdrop);
  return darknessForHour(spec.hour, { indoor: Boolean(b?.indoor), wild: isWild(spec.environment) });
}

/** Seconds to move world time forward so it is `hour` o'clock (0 when it already is that hour). Never backwards. */
export function secondsUntilHour(now: number, hour: number): number {
  const h = timeOfDayHours(Number(now) || 0);
  if (Math.floor(h) === hour) return 0;
  const ahead = ((hour - h) % 24 + 24) % 24;
  return Math.round(ahead * 3600);
}

// ---------------------------------------------------------------- Placing tokens

export interface SbSpot { x: number; y: number }

/** The start zones: the backdrop's, else the left and right thirds of the map. Metres. */
export function zonesFor(spec: Pick<SceneSpec, 'backdrop' | 'width' | 'height'>, size: { width: number; height: number } = spec): { pcs: BackdropRect; npcs: BackdropRect } {
  const b = spec.backdrop && spec.backdrop !== 'custom' ? backdropById(spec.backdrop) : undefined;
  if (b && b.width === size.width && b.height === size.height) return b.zones;
  const w = size.width;
  const h = size.height;
  const third = Math.max(1, Math.floor(w / 3));
  return { pcs: { x: 1, y: 1, w: Math.max(1, third - 2), h: Math.max(1, h - 2) }, npcs: { x: w - third + 1, y: 1, w: Math.max(1, third - 2), h: Math.max(1, h - 2) } };
}

/**
 * The scene the tokens, walls and regions go on: its grid, its size (metres) and where its map starts (px; Foundry pads
 * scenes, the builder's own have no padding). A new scene's is the spec's; an existing scene's is read from it.
 */
export interface SceneGeo { grid: number; gridDistance: number; width: number; height: number; originX: number; originY: number }
export const geoOf = (spec: Pick<SceneSpec, 'grid' | 'gridDistance' | 'width' | 'height'>): SceneGeo => ({ grid: spec.grid, gridDistance: spec.gridDistance, width: spec.width, height: spec.height, originX: 0, originY: 0 });

/**
 * Top-left token positions (px) for `n` one-square tokens in a zone (metres), filled row by row one square apart;
 * when the zone is full the squares in between, then (a crowd) on top of the first ones, never outside the zone.
 */
export function spotsInZone(n: number, zone: BackdropRect, g: Pick<SceneGeo, 'grid' | 'gridDistance' | 'width' | 'height'> & Partial<Pick<SceneGeo, 'originX' | 'originY'>>): SbSpot[] {
  const px = g.grid / g.gridDistance;
  const sq = g.grid;
  const ox = g.originX ?? 0;
  const oy = g.originY ?? 0;
  const maxX = Math.max(0, g.width * px - sq);
  const maxY = Math.max(0, g.height * px - sq);
  const clampX = (x: number) => Math.max(0, Math.min(maxX, x));
  const clampY = (y: number) => Math.max(0, Math.min(maxY, y));
  const x0 = clampX(Math.ceil((zone.x * px) / sq) * sq);
  const y0 = clampY(Math.ceil((zone.y * px) / sq) * sq);
  const x1 = Math.max(x0, clampX(Math.floor(((zone.x + zone.w) * px) / sq) * sq - sq));
  const y1 = Math.max(y0, clampY(Math.floor(((zone.y + zone.h) * px) / sq) * sq - sq));
  const out: SbSpot[] = [];
  const seen = new Set<string>();
  // Every other square first (one square apart), then the squares in between.
  for (const step of [2, 1]) {
    for (let y = y0; y <= y1 && out.length < n; y += sq * step) {
      for (let x = x0; x <= x1 && out.length < n; x += sq * step) {
        const k = `${x},${y}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ x, y });
      }
    }
  }
  const room = out.length || 1;
  if (!out.length) out.push({ x: x0, y: y0 });
  for (let i = 0; out.length < n; i++) out.push({ ...out[i % room]! });
  return out.slice(0, n).map((p) => ({ x: p.x + ox, y: p.y + oy }));
}

// ---------------------------------------------------------------- Foundry document data

/** The scene's own data (Scene.create). Flags are the system's scene settings. */
export function sceneCreateData(spec: SceneSpec, o: { imagePath: string; flags: Record<string, unknown> }): Record<string, unknown> {
  const px = spec.grid / spec.gridDistance;
  return {
    name: spec.name,
    ...(spec.folderId ? { folder: spec.folderId } : {}),
    navigation: true,
    width: Math.round(spec.width * px), height: Math.round(spec.height * px), padding: 0,
    backgroundColor: spec.color,
    ...(o.imagePath ? { background: { src: o.imagePath } } : {}),
    grid: { type: spec.gridless ? 0 : 1, size: spec.grid, distance: spec.gridDistance, units: 'm' },
    tokenVision: spec.tokenVision,
    fog: { exploration: spec.fog },
    environment: { darknessLevel: sceneDarkness(spec), globalLight: { enabled: spec.globalLight } },
    flags: o.flags,
  };
}

/** The system's scene flags the builder sets (the same ones the GM panel's Scene tab sets). */
export function sceneFlags(spec: SceneSpec): Record<string, unknown> {
  return { backgroundCount: spec.background, backgroundSources: spec.sources, environment: spec.environment, weather: spec.weather, terrain: spec.terrain };
}

/** Foundry wall restriction values (CONST.WALL_SENSE_TYPES / WALL_MOVEMENT_TYPES). */
const NONE = 0;
const NORMAL = 20;

/** A backdrop's walls, windows (block movement only), doors (closed) and lamps, in px on a scene with the spec's scale. */
export function backdropDocuments(b: Backdrop, spec: Pick<SceneSpec, 'grid' | 'gridDistance'> & Partial<Pick<SceneGeo, 'originX' | 'originY'>>): { walls: any[]; doors: Array<{ data: any; name: string; secure: boolean }>; lights: any[] } {
  const px = spec.grid / spec.gridDistance;
  const ox = spec.originX ?? 0;
  const oy = spec.originY ?? 0;
  const P = (v: number) => Math.round(v * px);
  const seg = (s: readonly number[]) => s.map((v, i) => P(v) + (i % 2 ? oy : ox));
  return {
    walls: [
      ...b.walls.map((c) => ({ c: seg(c) })),
      ...b.windows.map((c) => ({ c: seg(c), move: NORMAL, sight: NONE, light: NONE, sound: NONE })),
    ],
    doors: b.doors.map((d) => ({ data: { c: seg(d.c), door: 1, ds: 0 }, name: d.name, secure: Boolean(d.secure) })),
    // Light radii are in the scene's units (metres).
    lights: b.lights.map((l) => ({ x: P(l.x) + ox, y: P(l.y) + oy, config: { dim: l.dim, bright: l.bright, color: l.color ?? '#ffd9a0', alpha: 0.3 } })),
  };
}

/** A rectangular region over an area (metres), e.g. a ward's edge (flags.sr2e.env.wardUuid). */
export function rectRegionData(area: BackdropRect, spec: Pick<SceneSpec, 'grid' | 'gridDistance'> & Partial<Pick<SceneGeo, 'originX' | 'originY'>>, o: { name: string; color: string; flags: Record<string, unknown> }): Record<string, unknown> {
  const px = spec.grid / spec.gridDistance;
  const ox = spec.originX ?? 0;
  const oy = spec.originY ?? 0;
  return {
    name: o.name, color: o.color,
    shapes: [{ type: 'rectangle', x: Math.round(area.x * px) + ox, y: Math.round(area.y * px) + oy, width: Math.round(area.w * px), height: Math.round(area.h * px) }],
    flags: o.flags,
  };
}

/** The area a ward covers: the whole scene, or the NPCs' start zone. */
export function wardArea(spec: SceneSpec, size: { width: number; height: number } = spec): BackdropRect {
  return spec.ward.area === 'npcs' ? zonesFor(spec, size).npcs : { x: 0, y: 0, w: size.width, h: size.height };
}

/** Token disposition (CONST.TOKEN_DISPOSITIONS) for an attitude. */
export const dispositionOf = (a: SbAttitude): number => (a === 'friendly' ? 1 : a === 'neutral' ? 0 : -1);

/**
 * A generated security site's data: a maglock on each secure door, cameras and an alarm, rated by Threat (0–5), the
 * tally steps and the response. The builder's defaults, not book numbers; the site sheet changes them.
 */
export function generatedSiteSystem(o: { threat: number; hostUuid: string; sceneId: string; doors: Array<{ wallId: string; name: string }> }): Record<string, unknown> {
  const t = int(o.threat, 0, SCENE_LIMITS.maxThreat, 2);
  const rating = 2 + t;
  const lockType = t >= 4 ? 'print' : t >= 2 ? 'card' : 'keypad';
  const id = (k: string, i: number) => `sb${k}${String(i).padStart(4, '0')}`.padEnd(16, '0').slice(0, 16);
  const locks = o.doors.slice(0, 6).map((d, i) => ({ id: id('Lock', i), name: tx('SR2E.SceneBuilder.deviceLock', { door: d.name }), kind: 'maglock', rating, sceneId: o.sceneId, wallId: d.wallId, lockType }));
  const cameras = Array.from({ length: t >= 3 ? 2 : 1 }, (_, i) => ({ id: id('Cam', i), name: tx('SR2E.SceneBuilder.deviceCamera', { n: i + 1 }), kind: 'camera', rating, sense: t >= 4 ? 'thermal' : 'visual' }));
  const alarm = { id: id('Alarm', 0), name: tx('SR2E.SceneBuilder.deviceAlarm'), kind: 'alarm', rating };
  return {
    hostUuid: o.hostUuid,
    devices: [...locks, ...cameras, alarm],
    steps: [
      { step: 3, event: tx('SR2E.SceneBuilder.stepCameras'), alert: 'passive' },
      { step: 6, event: tx('SR2E.SceneBuilder.stepAlarm'), alert: 'active' },
      { step: 9, event: tx('SR2E.SceneBuilder.stepLockdown'), alert: 'lockdown' },
    ],
    response: { round: -1, worldTime: -1, arrived: false, force: tKey(`SR2E.SceneBuilder.response${Math.min(5, t)}`), turns: Math.max(2, 8 - t), minutes: 0 },
  };
}

// ---------------------------------------------------------------- Checks and the summary

/** What stops a build (translated sentences; empty = ready). `edit` is a change to an existing scene. */
export function specProblems(spec: SceneSpec, o: { edit?: boolean; known?: (uuid: string) => boolean } = {}): string[] {
  const out: string[] = [];
  const known = o.known ?? (() => true);
  if (!spec.name.trim()) out.push(tx('SR2E.SceneBuilder.problemName'));
  if (!o.edit && spec.backdrop === 'custom' && !spec.image.trim()) out.push(tx('SR2E.SceneBuilder.problemImage'));
  if (spec.site.mode === 'existing' && !spec.site.uuid) out.push(tx('SR2E.SceneBuilder.problemSite'));
  if (spec.host.mode === 'existing' && !spec.host.uuid) out.push(tx('SR2E.SceneBuilder.problemHost'));
  // A Matrix scene being changed already has its host (the builder only adds).
  if (spec.kind === 'matrix' && spec.host.mode === 'none' && !o.edit) out.push(tx('SR2E.SceneBuilder.problemMatrixHost'));
  for (const u of spec.pcs) if (!known(u)) { out.push(tx('SR2E.SceneBuilder.problemGone')); break; }
  for (const r of spec.people) if (r.source === 'actor' && (!r.uuid || !known(r.uuid))) { out.push(tx('SR2E.SceneBuilder.problemRow')); break; }
  if (tokenCount(spec) > SCENE_LIMITS.maxPeople) out.push(tx('SR2E.SceneBuilder.problemTooMany', { max: SCENE_LIMITS.maxPeople }));
  return out;
}

/** How many tokens the spec puts on the map (generated groups count as their size estimate: see `genEstimate`). */
export function tokenCount(spec: SceneSpec): number {
  return spec.pcs.length + spec.people.reduce((n, r) => n + (r.source === 'actor' ? (r.linked ? 1 : r.count) : genEstimate(r)), 0);
}
/** About how many a generated row makes (a group is a leader and a few; the generator decides exactly). */
export function genEstimate(r: PeopleRow): number {
  // Critters are one grunt group (one token, `count` of them on its sheet).
  return r.kind === 'group' ? 4 + Math.min(4, r.threat) : 1;
}

/** Whether a step has something set that differs from a new scene's defaults (the step list's tick). */
export function stepTouched(spec: SceneSpec, step: SceneStep): boolean {
  switch (step) {
    case 'basics': return Boolean(spec.name);
    case 'map': return spec.backdrop !== '' || Boolean(spec.image);
    case 'conditions': return spec.hour !== null || spec.darkness !== null || spec.weather !== 'clear';
    case 'magic': return spec.background > 0 || Boolean(spec.sources || spec.environment) || spec.ward.on;
    case 'people': return spec.pcs.length + spec.people.length > 0;
    case 'security': return spec.site.mode !== 'none' || spec.host.mode !== 'none';
    case 'finish': return Boolean(spec.notes) || spec.combat !== 'none';
  }
}

export function stepMoveTo(step: SceneStep, by: number): SceneStep {
  const i = SCENE_STEPS.indexOf(step);
  return SCENE_STEPS[Math.max(0, Math.min(SCENE_STEPS.length - 1, i + by))]!;
}

/** The light level the darkness gives (RULES.COMBAT.light thresholds), for the summary. */
export function lightLabel(darkness: number): string {
  const l = RULES.COMBAT.light;
  const k = darkness <= l.normal ? 'normal' : darkness <= l.partial ? 'partial' : darkness <= l.minimal ? 'minimal' : 'darkness';
  return tKey(`SR2E.SceneBuilder.light.${k}`);
}

/** The last step's summary: label and value pairs (values plain text; the template escapes them). */
export function specSummary(spec: SceneSpec, names: { pc: (u: string) => string; actor: (u: string) => string; folder?: string; playlist?: string }): Array<{ label: string; value: string }> {
    const b = backdropById(spec.backdrop);
  const dark = sceneDarkness(spec);
  const people = spec.people.map((r) => r.source === 'actor'
    ? `${names.actor(r.uuid)}${!r.linked && r.count > 1 ? ` ×${r.count}` : ''}${r.hidden ? ` (${tx('SR2E.SceneBuilder.hiddenShort')})` : ''}`
    : `${tKey(`SR2E.SceneBuilder.gen.${r.kind}`)} T${r.threat}${r.hidden ? ` (${tx('SR2E.SceneBuilder.hiddenShort')})` : ''}`);
  const rows: Array<{ label: string; value: string }> = [
    { label: tx('SR2E.SceneBuilder.sumKind'), value: tKey(`SR2E.SceneBuilder.kind.${spec.kind}`) },
    { label: tx('SR2E.SceneBuilder.sumSize'), value: tx('SR2E.SceneBuilder.sizeValue', { w: spec.width, h: spec.height, grid: spec.gridless ? tx('SR2E.SceneBuilder.gridless') : tx('SR2E.SceneBuilder.gridValue', { d: spec.gridDistance }) }) },
    { label: tx('SR2E.SceneBuilder.sumMap'), value: b ? tKey(b.labelKey) : spec.backdrop === 'custom' ? (spec.image || tx('SR2E.SceneBuilder.none')) : tx('SR2E.SceneBuilder.plainColour') },
    { label: tx('SR2E.SceneBuilder.sumLight'), value: [spec.hour === null ? '' : tx('SR2E.SceneBuilder.hourValue', { h: String(spec.hour).padStart(2, '0') }), lightLabel(dark), spec.globalLight ? tx('SR2E.SceneBuilder.globalLightShort') : ''].filter(Boolean).join(', ') },
    { label: tx('SR2E.SceneBuilder.sumWeather'), value: String(RULES.HEALTH.weather.find((w: any) => w.id === spec.weather)?.label ?? spec.weather) },
  ];
  if (spec.background || spec.environment || spec.ward.on) {
    rows.push({ label: tx('SR2E.SceneBuilder.sumMagic'), value: [spec.background ? tx('SR2E.SceneBuilder.bgValue', { n: spec.background }) : '', spec.environment, spec.ward.on ? tx('SR2E.SceneBuilder.wardValue', { rating: spec.ward.rating }) : ''].filter(Boolean).join('; ') });
  }
  rows.push({ label: tx('SR2E.SceneBuilder.sumPcs'), value: spec.pcs.map(names.pc).join(', ') || tx('SR2E.SceneBuilder.none') });
  rows.push({ label: tx('SR2E.SceneBuilder.sumPeople'), value: people.join(', ') || tx('SR2E.SceneBuilder.none') });
  if (spec.site.mode !== 'none' || spec.host.mode !== 'none') {
    rows.push({ label: tx('SR2E.SceneBuilder.sumSecurity'), value: [spec.site.mode === 'generate' ? tx('SR2E.SceneBuilder.siteNew', { t: spec.site.threat }) : spec.site.mode === 'existing' ? names.actor(spec.site.uuid) : '',
      spec.host.mode === 'generate' ? tx('SR2E.SceneBuilder.hostNew', { t: spec.host.threat }) : spec.host.mode === 'existing' ? names.actor(spec.host.uuid) : ''].filter(Boolean).join('; ') });
  }
  rows.push({ label: tx('SR2E.SceneBuilder.sumFinish'), value: [spec.journal ? tx('SR2E.SceneBuilder.journalShort') : '', spec.combat !== 'none' ? tKey(`SR2E.SceneBuilder.combat.${spec.combat}`) : '', tKey(`SR2E.SceneBuilder.show.${spec.show}`)].filter(Boolean).join('; ') });
  return rows;
}
