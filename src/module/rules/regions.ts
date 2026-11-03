/**
 * v0.60.0: scene regions that set the environment where a token stands (pure; no Foundry globals).
 *
 * A Foundry Region carries `flags.sr2e.env` (set in the region's config window, SR2e environment):
 * - backgroundCount (+ aspect tags, toxic): a background count source while a token is inside;
 * - environment: environment tags added to the scene's (forest, urban…) for totems and domains;
 * - weather: the weather inside, instead of the scene's ('' = the scene's; 'clear' = sheltered/indoors);
 * - light: the light level inside, instead of the scene's darkness ('' = the scene's); light sources still brighten it;
 * - smoke: smoke filling the region ('smoke' or 'thermal'); a line of sight through it is smoky;
 * - wardUuid: a barrier actor (ward, mana or astral barrier) whose edge the region is;
 * - siteUuid + deviceId: a site's camera or sensor that watches the region.
 */
import type { LightLevel } from './weapons.ts';
import type { BackgroundSource } from './mysticism.ts';

export type RegionSmoke = '' | 'smoke' | 'thermal';

export interface RegionEnv {
  backgroundCount: number;
  backgroundAspect: string;
  backgroundToxic: boolean;
  environment: string;
  weather: string;
  light: '' | LightLevel;
  smoke: RegionSmoke;
  wardUuid: string;
  siteUuid: string;
  deviceId: string;
}

/** A region a point is in, as the rules see it. `area` (px², optional) puts the innermost first. */
export interface RegionHit { id: string; name: string; env: RegionEnv; area?: number }

const LIGHTS: readonly string[] = ['normal', 'partial', 'minimal', 'darkness'];
const SMOKES: readonly string[] = ['smoke', 'thermal'];

/** Pure: a region's SR2 environment from its flags (anything missing or malformed is "nothing"). */
export function readRegionEnv(raw: any): RegionEnv {
  const r = raw && typeof raw === 'object' ? raw : {};
  const bc = Math.floor(Number(r.backgroundCount ?? 0));
  const light = String(r.light ?? '');
  const smoke = String(r.smoke ?? '');
  return {
    backgroundCount: Number.isFinite(bc) ? Math.max(0, Math.min(20, bc)) : 0,
    backgroundAspect: String(r.backgroundAspect ?? '').trim(),
    backgroundToxic: Boolean(r.backgroundToxic),
    environment: String(r.environment ?? '').trim(),
    weather: String(r.weather ?? '').trim(),
    light: (LIGHTS.includes(light) ? light : '') as RegionEnv['light'],
    smoke: (SMOKES.includes(smoke) ? smoke : '') as RegionSmoke,
    wardUuid: String(r.wardUuid ?? '').trim(),
    siteUuid: String(r.siteUuid ?? '').trim(),
    deviceId: String(r.deviceId ?? '').trim(),
  };
}

/** Pure: whether a region's environment changes anything. */
export function hasRegionEnv(env: RegionEnv): boolean {
  return env.backgroundCount > 0 || Boolean(env.environment || env.weather || env.light || env.smoke || env.wardUuid || (env.siteUuid && env.deviceId));
}

function splitTags(text: string): string[] {
  return String(text ?? '').split(/[,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
}

/** Pure: innermost (smallest) first, then in the order given. */
export function innermostFirst(hits: readonly RegionHit[]): RegionHit[] {
  return hits.map((h, i) => ({ h, i })).sort((a, b) => {
    const x = a.h.area, y = b.h.area;
    if (x !== undefined && y !== undefined && x !== y) return x - y;
    return a.i - b.i;
  }).map((e) => e.h);
}

/** Pure: the background count sources of the regions a token is in. */
export function regionBackgroundSources(hits: readonly RegionHit[]): BackgroundSource[] {
  return hits.filter((h) => h.env.backgroundCount > 0).map((h) => ({
    name: h.name || 'Region', rating: h.env.backgroundCount, aspect: splitTags(h.env.backgroundAspect).filter((t) => t !== 'toxic'),
    toxic: h.env.backgroundToxic || splitTags(h.env.backgroundAspect).includes('toxic'),
  }));
}

/** Pure: the scene's environment tags plus the regions' (no repeats). */
export function regionEnvironmentTags(sceneTags: readonly string[], hits: readonly RegionHit[]): string[] {
  const out = [...sceneTags.map((t) => String(t).toLowerCase())];
  for (const h of hits) for (const t of splitTags(h.env.environment)) if (!out.includes(t)) out.push(t);
  return out;
}

/** Pure: the weather inside the innermost region that sets one, else the scene's. */
export function regionWeather(sceneWeather: string, hits: readonly RegionHit[]): string {
  const h = innermostFirst(hits).find((x) => x.env.weather);
  return h ? h.env.weather : sceneWeather;
}

/** Pure: the light level the innermost region that sets one gives, or null (the scene's darkness). */
export function regionLight(hits: readonly RegionHit[]): LightLevel | null {
  const h = innermostFirst(hits).find((x) => x.env.light);
  return h ? (h.env.light as LightLevel) : null;
}

/**
 * Pure: the darkness level after Foundry's own "Adjust Darkness Level" region behaviours (v12+):
 * mode 0 overrides it, 1 brightens it (darkness × (1 − modifier)), 2 darkens it (towards 1 by the modifier).
 * Behaviours apply in the order given; disabled ones are left out by the caller.
 */
export function darknessWithBehaviors(base: number, behaviors: ReadonlyArray<{ mode: number; modifier: number }>): number {
  let d = Math.max(0, Math.min(1, Number(base) || 0));
  for (const b of behaviors) {
    const m = Math.max(0, Math.min(1, Number(b.modifier) || 0));
    if (Number(b.mode) === 0) d = m;
    else if (Number(b.mode) === 1) d = d * (1 - m);
    else if (Number(b.mode) === 2) d = d + (1 - d) * m;
  }
  return Math.max(0, Math.min(1, d));
}

type Pt = { x: number; y: number };

/** Pure: points along a line (both ends included), at most `step` apart; at most `max` points. */
export function segmentSamples(a: Pt, b: Pt, step: number, max = 200): Pt[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.min(max - 1, Math.max(1, Math.ceil(len / Math.max(1, step))));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
  return out;
}

const SMOKE_RANK: Record<string, number> = { none: 0, '': 0, smoke: 1, thermal: 2 };

/** Pure: the worse of two smokes. */
export function worseSmoke<T extends { kind: string }>(a: T, b: T): T {
  return (SMOKE_RANK[b.kind] ?? 0) > (SMOKE_RANK[a.kind] ?? 0) ? b : a;
}

/** Pure: the worst smoke of the regions a line passes through (each hit: the regions one sample point is in). */
export function smokeAlong(samples: ReadonlyArray<readonly RegionHit[]>): { kind: 'none' | 'smoke' | 'thermal'; source: string } {
  let best: { kind: 'none' | 'smoke' | 'thermal'; source: string } = { kind: 'none', source: '' };
  for (const hits of samples) for (const h of hits) {
    if (!h.env.smoke) continue;
    if ((SMOKE_RANK[h.env.smoke] ?? 0) > (SMOKE_RANK[best.kind] ?? 0)) best = { kind: h.env.smoke, source: h.name || 'Smoke' };
  }
  return best;
}

/** Pure: the region ids one point is in and the other isn't (a line between them crosses their edge). */
export function crossedRegions(insideA: readonly string[], insideB: readonly string[]): string[] {
  const a = new Set(insideA), b = new Set(insideB);
  return [...new Set([...insideA.filter((x) => !b.has(x)), ...insideB.filter((x) => !a.has(x))])];
}

/** Pure: the region ids a token went into (in `after`, not in `before`). */
export function enteredRegions(before: readonly string[], after: readonly string[]): string[] {
  const b = new Set(before);
  return after.filter((x) => !b.has(x));
}

/**
 * Pure: whether a move across a ward's edge is stopped. Wards (and mana and astral barriers) stop astral forms
 * (projecting magicians, unmaterialized spirits) while their rating is above 0; physical bodies pass.
 * `mode`: 'block' stops the move, 'warn' lets it through with a warning, 'off' does nothing.
 */
export function wardStops(o: { astral: boolean; rating: number; mode: string; gm: boolean }): 'stop' | 'warn' | 'pass' {
  if (!o.astral || !(o.rating > 0) || o.mode === 'off') return 'pass';
  if (o.mode === 'warn' || o.gm) return 'warn';
  return 'stop';
}

/** Pure: whether a camera's region should notice someone who walked in. */
export function deviceWatches(o: { active: boolean; bypassed: boolean; guard: boolean; hidden: boolean; astral: boolean; sense?: string }): boolean {
  if (!o.active || o.bypassed || o.guard || o.hidden) return false;
  // Ordinary cameras and sensors don't see astral forms.
  if (o.astral && !/astral/i.test(String(o.sense ?? ''))) return false;
  return true;
}

/** A region shape as Foundry stores it (v12+): rectangle, circle, ellipse or polygon; `hole` cuts it out. */
export interface RegionShape { type: string; x?: number; y?: number; width?: number; height?: number; radius?: number; radiusX?: number; radiusY?: number; rotation?: number; points?: number[]; hole?: boolean }

function polygonContains(points: readonly number[], p: Pt): boolean {
  let inside = false;
  for (let i = 0, j = points.length / 2 - 1; i < points.length / 2; j = i++) {
    const xi = points[2 * i]!, yi = points[2 * i + 1]!, xj = points[2 * j]!, yj = points[2 * j + 1]!;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

function rotatedInto(s: RegionShape, p: Pt, cx: number, cy: number): Pt {
  const r = (-(Number(s.rotation ?? 0)) * Math.PI) / 180;
  if (!r) return p;
  const dx = p.x - cx, dy = p.y - cy;
  return { x: cx + dx * Math.cos(r) - dy * Math.sin(r), y: cy + dx * Math.sin(r) + dy * Math.cos(r) };
}

/** Pure: whether one shape (holes aside) contains a point. Unknown shapes contain nothing. */
export function shapeContains(s: RegionShape, p: Pt): boolean {
  const x = Number(s.x ?? 0), y = Number(s.y ?? 0);
  switch (s.type) {
    case 'rectangle': {
      const w = Number(s.width ?? 0), h = Number(s.height ?? 0);
      const q = rotatedInto(s, p, x + w / 2, y + h / 2);
      return q.x >= x && q.x <= x + w && q.y >= y && q.y <= y + h;
    }
    case 'circle': return Math.hypot(p.x - x, p.y - y) <= Number(s.radius ?? 0);
    case 'ellipse': {
      const rx = Number(s.radiusX ?? 0), ry = Number(s.radiusY ?? 0);
      if (!(rx > 0 && ry > 0)) return false;
      const q = rotatedInto(s, p, x, y);
      return ((q.x - x) / rx) ** 2 + ((q.y - y) / ry) ** 2 <= 1;
    }
    case 'polygon': return Array.isArray(s.points) && s.points.length >= 6 && polygonContains(s.points, p);
    default: return false;
  }
}

/** Pure: whether a region's shapes contain a point (in a solid shape and not in a hole), and within its elevation range. */
export function shapesContain(shapes: readonly RegionShape[], p: Pt & { elevation?: number }, elevation?: { bottom?: number | null; top?: number | null }): boolean {
  const e = Number(p.elevation ?? 0);
  const bottom = elevation?.bottom, top = elevation?.top;
  if (bottom !== null && bottom !== undefined && Number.isFinite(Number(bottom)) && e < Number(bottom)) return false;
  if (top !== null && top !== undefined && Number.isFinite(Number(top)) && e > Number(top)) return false;
  let solid = false;
  for (const s of shapes) if (!s.hole && shapeContains(s, p)) { solid = true; break; }
  if (!solid) return false;
  return !shapes.some((s) => s.hole && shapeContains(s, p));
}

/** Pure: a region's area in px² (holes taken off; used to find the innermost region). */
export function shapesArea(shapes: readonly RegionShape[]): number {
  let a = 0;
  for (const s of shapes) {
    let x = 0;
    if (s.type === 'rectangle') x = Number(s.width ?? 0) * Number(s.height ?? 0);
    else if (s.type === 'circle') x = Math.PI * Number(s.radius ?? 0) ** 2;
    else if (s.type === 'ellipse') x = Math.PI * Number(s.radiusX ?? 0) * Number(s.radiusY ?? 0);
    else if (s.type === 'polygon' && Array.isArray(s.points)) {
      const pts = s.points; let sum = 0;
      for (let i = 0, j = pts.length / 2 - 1; i < pts.length / 2; j = i++) sum += (pts[2 * j]! + pts[2 * i]!) * (pts[2 * j + 1]! - pts[2 * i + 1]!);
      x = Math.abs(sum) / 2;
    }
    a += s.hole ? -x : x;
  }
  return Math.max(0, a);
}
