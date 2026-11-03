import { RULES, metresPerUnit, withElevation, nearest, coverFromSightLines, lightFromDarkness, lightFromSource, brighter, inShotgunCone, smokeOnLine, worseSmoke, type LightLevel, type AreaSweepCause } from "../rules/index.ts";
import { SYSTEM } from "../config/system.ts";
import { requestGm, onRelay } from "./socket.ts";
import { withGmLock } from "./gmlock.ts";
import { escHtml } from "../rules/html.ts";
import { palette } from "../rules/look.ts";
import { regionLightAt, regionSmokeBetween } from "./regions.ts";
import { isLeadGm, madeHere, leadSettled } from "./leader.ts";
import { t as tx } from '../helpers/i18n.ts';

/** Canvas glue shared by the sheets and chat cards: tokens, distances, sight lines, light. */

/** The first active token of an actor on the canvas, or null. */
export function tokenOf(actor: any): any | null {
  try { return actor?.getActiveTokens?.()[0] ?? null; } catch { return null; }
}

/** Distance in metres between two tokens, or null if it cannot be measured. */
export function tokenDistance(a: any, b: any): number | null {
  return measureTokens(a, b)?.metres ?? null;
}

/** The token an actor attacks from: a controlled token of it, its own (unlinked) token, or its first active token. */
export function attackerToken(actor: any): any | null {
  try {
    const mine = (t: any) => t?.actor && (t.actor === actor || t.actor.uuid === actor.uuid);
    return canvas?.tokens?.controlled?.find(mine) ?? (actor.token?.object && mine(actor.token.object) ? actor.token.object : null) ?? tokenOf(actor);
  } catch { return null; }
}

/**
 * Target options for an attack: the user's target first, then the other tokens on the viewed
 * scene (by their own actor, so unlinked tokens are hit, not the world actor), then world actors
 * without a token here. Also returns the token behind each option, for measuring.
 */
/** `emptyLabel` (HTML, its values already escaped) names the blank first option; "(no target)" when left out. */
export function attackTargetOptions(actor: any, fromToken: any, targetToken: any, types: readonly string[] = ["character", "npc", "spirit", "vehicle"], emptyLabel?: string): { options: string; tokens: Map<string, any> } {
  const tokens = new Map<string, any>();
  const rows: string[] = [`<option value="">${emptyLabel ?? tx('SR2E.Dialog.Canvas.noTarget')}</option>`];
  const esc = escHtml;
  if (targetToken?.actor && types.includes(targetToken.actor.type) && targetToken.actor.uuid !== actor?.uuid) {
    tokens.set(targetToken.actor.uuid, targetToken);
    rows.push(`<option value="${esc(targetToken.actor.uuid)}" selected>${tx('SR2E.Dialog.Canvas.targeted', { name: esc(targetToken.name) })}</option>`);
  }
  let placeables: any[] = [];
  try { placeables = canvas?.tokens?.placeables ?? []; } catch { placeables = []; }
  const sceneRows: string[] = [];
  for (const t of placeables) {
    const a = t.actor;
    if (!a || t === fromToken || a.uuid === actor.uuid || !types.includes(a.type) || tokens.has(a.uuid)) continue;
    tokens.set(a.uuid, t);
    sceneRows.push(`<option value="${esc(a.uuid)}">${esc(t.name)}</option>`);
  }
  if (sceneRows.length) rows.push(`<optgroup label="On this scene">${sceneRows.join("")}</optgroup>`);
  const onScene = new Set(placeables.map((t: any) => t.document?.actorId).filter(Boolean));
  const worldRows = game.actors
    .filter((a: any) => a.id !== actor.id && types.includes(a.type) && !tokens.has(a.uuid) && !onScene.has(a.id))
    .map((a: any) => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`);
  if (worldRows.length) rows.push(sceneRows.length ? `<optgroup label="Not on this scene">${worldRows.join("")}</optgroup>` : worldRows.join(""));
  return { options: rows.join(""), tokens };
}

/** Centre points of the grid spaces a token covers (just its centre if they cannot be listed). */
export function tokenPoints(t: any): Array<{ x: number; y: number }> {
  if (RULES.DISTANCE.nearestSpace) {
    try {
      const offsets: any[] = t.document?.getOccupiedGridSpaceOffsets?.() ?? [];
      if (offsets.length > 1 && canvas.grid.getCenterPoint) return offsets.map((o: any) => canvas.grid.getCenterPoint(o));
    } catch { /* fall back to the centre */ }
  }
  return [t.center];
}

/**
 * Measure between two tokens with the scene's grid rules: nearest occupied spaces, elevation
 * difference, converted to metres from the scene's distance units. Also gives one diagonal grid
 * step in metres (for melee adjacency). Null if it cannot be measured.
 */
export function measureTokens(a: any, b: any): { metres: number; stepMetres: number; unitsNote: string } | null {
  try {
    if (!a || !b || !canvas?.grid) return null;
    if (a.scene && b.scene && a.scene !== b.scene) return null;
    const grid: any = canvas.grid;
    const pa = tokenPoints(a), pb = tokenPoints(b);
    const pairs = pa.flatMap((p) => pb.map((q) => [p, q] as const));
    // Tokens measured from a single centre point (gridless scenes): take off how far a large
    // token reaches beyond one grid space, so big critters are measured from their edge.
    const extent = (t: any, pts: unknown[]) => {
      if (!RULES.DISTANCE.nearestSpace || pts.length > 1) return 0;
      const size = Math.min(Number(t.document?.width) || 1, Number(t.document?.height) || 1);
      return Math.max(0, (size - 1) / 2) * (Number(grid.distance) || 1);
    };
    const edge = extent(a, pa) + extent(b, pb);
    const flat0 = nearest(pairs.map(([p, q]) => grid.measurePath([p, q]).distance as number));
    if (flat0 == null) return null;
    const flat = Math.max(0, flat0 - edge);
    const ea = Number(a.document?.elevation) || 0, eb = Number(b.document?.elevation) || 0;
    let d3: number | null = null;
    if (ea !== eb) {
      try {
        const m = nearest(pairs.map(([p, q]) => grid.measurePath([{ ...p, elevation: ea }, { ...q, elevation: eb }]).distance as number));
        d3 = m == null ? null : Math.max(0, m - edge);
      } catch { d3 = null; }
    }
    const units: string = canvas.scene?.grid?.units ?? grid.units ?? "";
    const per = metresPerUnit(units);
    const k = per ?? 1;
    const unitsNote = per == null ? tx('SR2E.App.Canvas.sceneUnitsReadAsMetres', { units }) : k !== 1 ? tx('SR2E.App.Canvas.sceneMeasuredIn', { units }) : "";
    let step = 0;
    if (!grid.isGridless) {
      step = grid.isSquare
        ? (grid.measurePath([{ x: 0, y: 0 }, { x: grid.size, y: grid.size }]).distance as number)
        : (grid.distance as number);
    }
    return { metres: withElevation(flat, eb - ea, d3) * k, stepMetres: step * k, unitsNote };
  } catch (err) {
    console.warn(`${SYSTEM.LOG.HEAD}Could not measure distance`, err);
    return null;
  }
}

/** Whether walls block sight between two tokens: true/false, or null if it cannot be checked. */
export function lineOfSight(a: any, b: any): boolean | null {
  try {
    const backend = (CONFIG as any).Canvas?.polygonBackends?.sight;
    if (!a || !b || !backend?.testCollision) return null;
    return !backend.testCollision(a.center, b.center, { type: "sight", mode: "any" });
  } catch { return null; }
}


/** Sight lines from the attacker's centre to the target's centre and four inset corners; how many walls block. */
export function sightCover(a: any, b: any): { cover: "none" | "partial" | "blind"; blocked: number; total: number } | null {
  try {
    const backend = (CONFIG as any).Canvas?.polygonBackends?.sight;
    if (!a || !b || !backend?.testCollision) return null;
    const w = Number(b.w ?? b.width ?? 0), h = Number(b.h ?? b.height ?? 0);
    const x = Number(b.x ?? b.document?.x ?? 0), y = Number(b.y ?? b.document?.y ?? 0);
    const inset = 0.2;
    const points = [b.center, ...(w && h ? [
      { x: x + w * inset, y: y + h * inset }, { x: x + w * (1 - inset), y: y + h * inset },
      { x: x + w * inset, y: y + h * (1 - inset) }, { x: x + w * (1 - inset), y: y + h * (1 - inset) },
    ] : [])];
    // v0.47.0: from every point of the attacker's token (leaning out of cover), keeping the best.
    const aw = Number(a.w ?? a.width ?? 0), ah = Number(a.h ?? a.height ?? 0);
    const ax = Number(a.x ?? a.document?.x ?? 0), ay = Number(a.y ?? a.document?.y ?? 0);
    const from = RULES.COMBAT.cover.from === "token" && aw && ah ? [a.center,
      { x: ax + aw * inset, y: ay + ah * inset }, { x: ax + aw * (1 - inset), y: ay + ah * inset },
      { x: ax + aw * inset, y: ay + ah * (1 - inset) }, { x: ax + aw * (1 - inset), y: ay + ah * (1 - inset) }] : [a.center];
    const blocked = Math.min(...from.map((f: any) => points.filter((p: any) => backend.testCollision(f, p, { type: "sight", mode: "any" })).length));
    return { cover: coverFromSightLines(blocked, points.length), blocked, total: points.length };
  } catch { return null; }
}

/** Metres per scene unit for the viewed scene (1 if unknown). */
export function sceneMetres(): number {
  try { return metresPerUnit(canvas?.scene?.grid?.units ?? canvas?.grid?.units ?? "") ?? 1; } catch { return 1; }
}

/** Distance in metres from a point (pixels, with elevation in scene units) to a token's nearest space. */
export function distanceFromPoint(point: { x: number; y: number; elevation?: number }, t: any): number | null {
  try {
    const grid: any = canvas.grid;
    const pts = tokenPoints(t);
    const flat0 = nearest(pts.map((q) => grid.measurePath([{ x: point.x, y: point.y }, q]).distance as number));
    if (flat0 == null) return null;
    const size = Math.min(Number(t.document?.width) || 1, Number(t.document?.height) || 1);
    const edge = pts.length > 1 ? 0 : Math.max(0, (size - 1) / 2) * (Number(grid.distance) || 1);
    const flat = Math.max(0, flat0 - edge);
    const dz = (Number(t.document?.elevation) || 0) - (point.elevation ?? 0);
    return withElevation(flat, dz) * sceneMetres();
  } catch { return null; }
}

/** Character, NPC and spirit tokens on the viewed scene, with their distance (metres) from a point, nearest first. */
export function tokensNear(point: { x: number; y: number; elevation?: number }, radiusMetres: number, opts: { vehicles?: boolean } = {}): Array<{ token: any; metres: number }> {
  let placeables: any[] = [];
  try { placeables = canvas?.tokens?.placeables ?? []; } catch { return []; }
  const types = ["character", "npc", "spirit", ...(opts.vehicles ? ["vehicle"] : [])];
  return placeables
    .filter((t: any) => t.actor && types.includes(t.actor.type))
    .map((t: any) => ({ token: t, metres: distanceFromPoint(point, t) }))
    .filter((e): e is { token: any; metres: number } => e.metres != null && e.metres <= radiusMetres + 1e-6)
    .sort((a, b) => a.metres - b.metres);
}

/** Light level on the viewed scene from its darkness level. */
export function sceneLight(): { light: LightLevel; darkness: number } | null {
  try {
    const sc: any = canvas?.scene;
    if (!sc) return null;
    const d = Number(sc.environment?.darknessLevel ?? sc.darkness ?? 0) || 0;
    return { light: lightFromDarkness(d), darkness: d };
  } catch { return null; }
}

/** Metres a token has moved this Combat Turn, from Foundry's movement history; null if unknown. */
export function movedThisTurn(t: any): number | null {
  try {
    const hist: any[] = t?.document?.movementHistory ?? [];
    if (!game.combat?.started || hist.length < 1) return hist.length ? null : 0;
    const pts = hist.map((w: any) => ({ x: w.x + (t.w ?? 0) / 2, y: w.y + (t.h ?? 0) / 2, elevation: w.elevation ?? 0 }));
    pts.push({ x: t.center.x, y: t.center.y, elevation: Number(t.document?.elevation) || 0 });
    return (canvas.grid.measurePath(pts).distance as number) * sceneMetres();
  } catch { return null; }
}

/** Point a blast lands at after scattering (metres in a direction, 0° = north, clockwise). */
export function scatterPoint(from: { x: number; y: number }, metres: number, angleDeg: number): { x: number; y: number } {
  const g: any = canvas?.grid;
  const pxPerMetre = (Number(g?.size) || 100) / ((Number(g?.distance) || 1) * sceneMetres());
  const rad = (angleDeg * Math.PI) / 180;
  return { x: from.x + Math.sin(rad) * metres * pxPerMetre, y: from.y - Math.cos(rad) * metres * pxPerMetre };
}


/* ---- v0.21.0 ---- */

/** Pixels per metre on the viewed scene. */
export function pxPerMetre(): number {
  const g: any = canvas?.grid;
  return (Number(g?.size) || 100) / ((Number(g?.distance) || 1) * sceneMetres());
}

/** Whether a wall that blocks movement stands between a blast point and a token. */
export function blastBlocked(point: { x: number; y: number }, t: any): boolean {
  try {
    const backend = (CONFIG as any).Canvas?.polygonBackends?.move;
    return Boolean(backend?.testCollision?.(point, t.center, { type: "move", mode: "any" }));
  } catch { return false; }
}

/** Metres to the first wall along 8 rays from a point (Infinity if none within `maxMetres`). */
export function wallDistances(point: { x: number; y: number }, maxMetres: number): number[] {
  const ppm = pxPerMetre();
  const out: number[] = [];
  try {
    const backend = (CONFIG as any).Canvas?.polygonBackends?.move;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const end = { x: point.x + Math.cos(a) * maxMetres * ppm, y: point.y + Math.sin(a) * maxMetres * ppm };
      const hit = backend?.testCollision?.(point, end, { type: "move", mode: "closest" });
      out.push(hit ? Math.hypot(hit.x - point.x, hit.y - point.y) / ppm : Infinity);
    }
  } catch { /* no walls */ }
  while (out.length < 8) out.push(Infinity);
  return out;
}

function segmentsCross(p1: any, p2: any, p3: any, p4: any): boolean {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t > 0 && t < 1 && u >= 0 && u <= 1;
}

/** Barrier ratings of the solid walls (blocking movement) between two tokens. */
export function barriersBetween(a: any, b: any): number[] {
  // v0.81.0 (A-8, A-14): the same wall filter and rating reader as everything else (wallsBetweenPoints, wallRating).
  if (!a?.center || !b?.center) return [];
  return wallsBetweenPoints(a.center, b.center).map((w) => w.rating);
}

/** Light on a token from the scene's light sources (bright = normal, dim = partial), or null. */
export function lightSourceLevel(t: any): LightLevel | null {
  if (!RULES.COMBAT.light.useLightSources) return null;
  try {
    const sources: any[] = [...(canvas?.effects?.lightSources ?? [])];
    let best: LightLevel | null = null;
    const p = t.center;
    for (const src of sources) {
      if (!src?.active || src.constructor?.name === "GlobalLightSource" || src.isGlobal) continue;
      const d = Math.hypot(p.x - src.x, p.y - src.y);
      const inShape = src.shape?.contains ? src.shape.contains(p.x, p.y) : true;
      if (!inShape) continue;
      const lvl = lightFromSource(d <= Number(src.data?.bright ?? 0), d <= Number(src.data?.dim ?? 0));
      if (lvl) best = best ? brighter(best, lvl) : lvl;
    }
    return best;
  } catch { return null; }
}

/** Light on a target: the scene's darkness level, brightened by light sources on it. */
export function targetLight(t: any | null): { light: LightLevel; source: boolean; region?: string } | null {
  const scene = sceneLight();
  if (!scene) return null;
  // v0.60.0: a region's light inside it (or Foundry's own darkness behaviours) instead of the scene's darkness.
  let base: LightLevel = scene.light;
  let region = '';
  if (t) {
    try {
      const r = regionLightAt(t, scene.darkness);
      if (r.light) { base = r.light; region = r.from; }
      else if (r.darkness !== scene.darkness) { base = lightFromDarkness(r.darkness); region = r.from; }
    } catch { /* the scene's */ }
  }
  const src = t ? lightSourceLevel(t) : null;
  const out = src ? { light: brighter(base, src), source: brighter(base, src) !== base } : { light: base, source: false };
  return region ? { ...out, region } : out;
}

/** Tokens inside a shotgun's cone from the shooter towards the target (out to the target), with metres along the line. */
export function tokensInCone(from: any, to: any, choke: number, widthAt?: (metres: number) => number): Array<{ token: any; metres: number }> {
  try {
    const ppm = pxPerMetre();
    const ax = from.center.x, ay = from.center.y;
    const dx = to.center.x - ax, dy = to.center.y - ay;
    const len = Math.hypot(dx, dy);
    if (!len) return [];
    const ux = dx / len, uy = dy / len;
    const targetM = len / ppm;
    const placeables: any[] = canvas?.tokens?.placeables ?? [];
    return placeables
      .filter((t: any) => t !== from && t.actor && ["character", "npc", "spirit"].includes(t.actor.type))
      .map((t: any) => {
        const vx = t.center.x - ax, vy = t.center.y - ay;
        const along = (vx * ux + vy * uy) / ppm;
        const halfSize = (Math.min(Number(t.w) || 0, Number(t.h) || 0) / 2) / ppm;
        const perp = Math.max(0, Math.abs(vx * uy - vy * ux) / ppm - halfSize);
        return { token: t, metres: along, perp };
      })
      // v0.80.0 (review #8): the Revamp's cone width when given (out to the target only).
      .filter((e) => e.token === to || (widthAt ? e.metres > 0 && e.metres <= targetM && e.perp <= widthAt(e.metres) / 2 : inShotgunCone({ along: e.metres, perpendicular: e.perp, targetDistance: targetM, choke })))
      .map(({ token, metres }) => ({ token, metres }));
  } catch { return []; }
}

/** Other tokens on the attacker's side (same disposition) in melee with the target (within `metres`). */
export function friendsInMelee(attacker: any, target: any, metres: number): number {
  try {
    const disp = attacker?.document?.disposition;
    const placeables: any[] = canvas?.tokens?.placeables ?? [];
    return placeables.filter((t: any) => t !== attacker && t !== target && t.actor && t.document?.disposition === disp
      && (measureTokens(t, target)?.metres ?? Infinity) <= metres + 1e-6).length;
  } catch { return 0; }
}

/** Whether an actor has the prone status. */
export function isProne(actor: any): boolean {
  try { return Boolean(actor?.statuses?.has?.("prone")); } catch { return false; }
}


/* ---- v0.37.0: walls as barriers, grenades stopping at walls ---- */

/**
 * A wall's barrier rating (its flag, else the default). v0.81.0 (A-8): blank or 0 counts the default, as the wall
 * config's hint says (walls saved before v0.72.0 store 0 for "not set"); gunfire used to get 0 extra armor from them.
 */
export function wallRating(doc: any): number {
  const def = RULES.COMBAT.barriers.defaultWallRating;
  const raw = doc?.getFlag?.(SYSTEM.id, "barrierRating") ?? doc?.flags?.sr2e?.barrierRating;
  // A wall damaged down to 0 (it has a `barrierFull`, the rating before damage) really is 0.
  const damaged = (doc?.getFlag?.(SYSTEM.id, "barrierFull") ?? doc?.flags?.sr2e?.barrierFull) != null;
  if (raw === null || raw === undefined || raw === "") return def;
  return Number(raw) > 0 ? Number(raw) : damaged ? 0 : def;
}

/** Solid walls (movement-blocking, not open doors) between two points, with their ratings. */
export function wallsBetweenPoints(a: { x: number; y: number }, b: { x: number; y: number }): Array<{ doc: any; rating: number }> {
  try {
    const walls: any[] = canvas?.walls?.placeables ?? [];
    return walls.filter((w: any) => {
      const d = w.document;
      if (!d || d.move === 0 || (d.door && d.ds === 1)) return false;
      const [x1, y1, x2, y2] = d.c;
      return segmentsCross(a, b, { x: x1, y: y1 }, { x: x2, y: y2 });
    }).map((w: any) => ({ doc: w.document, rating: wallRating(w.document) }));
  } catch { return []; }
}

/** v0.78.0: is there a wall that blocks sight between two points (a flash grenade's light)? Open doors don't count. */
export function sightBlockedBetweenPoints(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  try {
    const walls: any[] = canvas?.walls?.placeables ?? [];
    return walls.some((w: any) => {
      const d = w.document;
      if (!d || d.sight === 0 || (d.door && d.ds === 1)) return false;
      const [x1, y1, x2, y2] = d.c;
      return segmentsCross(a, b, { x: x1, y: y1 }, { x: x2, y: y2 });
    });
  } catch { return false; }
}

/** Solid walls within `maxMetres` of a point, with the distance to their nearest point. */
export function wallsNear(point: { x: number; y: number }, maxMetres: number): Array<{ doc: any; rating: number; metres: number }> {
  const ppm = pxPerMetre();
  try {
    const walls: any[] = canvas?.walls?.placeables ?? [];
    return walls.map((w: any) => {
      const d = w.document;
      if (!d || d.move === 0) return null;
      const [x1, y1, x2, y2] = d.c;
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((point.x - x1) * dx + (point.y - y1) * dy) / len2));
      const metres = Math.hypot(point.x - (x1 + t * dx), point.y - (y1 + t * dy)) / ppm;
      return metres <= maxMetres ? { doc: d, rating: wallRating(d), metres: Math.round(metres * 10) / 10 } : null;
    }).filter(Boolean) as Array<{ doc: any; rating: number; metres: number }>;
  } catch { return []; }
}

/** A scattering grenade from `from` to `to`: where it stops (just short of the first solid wall), and whether it hit one. */
export function scatterStop(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number; stopped: boolean } {
  try {
    const backend = (CONFIG as any).Canvas?.polygonBackends?.move;
    const hit = backend?.testCollision?.(from, to, { type: "move", mode: "closest" });
    if (!hit) return { ...to, stopped: false };
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const back = Math.min(len, pxPerMetre() * 0.25);
    return { x: hit.x - ((to.x - from.x) / len) * back, y: hit.y - ((to.y - from.y) / len) * back, stopped: true };
  } catch { return { ...to, stopped: false }; }
}

/* ---- v0.48.0 ---- */

/** Whether a wall that blocks movement stands between two points. */
export function pointsBlocked(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  try {
    const backend = (CONFIG as any).Canvas?.polygonBackends?.move;
    return Boolean(backend?.testCollision?.(a, b, { type: "move", mode: "any" }));
  } catch { return false; }
}

/** The worst fire smoke on the line between two tokens on the viewed scene (fires from the scene flag). */
export function smokeBetweenTokens(a: any, b: any, fires: readonly any[]): { kind: "none" | "smoke" | "thermal"; source: string; flames: boolean } {
  let best: { kind: "none" | "smoke" | "thermal"; source: string; flames: boolean } = { kind: "none", source: "", flames: false };
  try {
    if (!a?.center || !b?.center) return best;
    if (fires?.length) best = smokeOnLine(a.center, b.center, fires as any, pxPerMetre());
    // v0.60.0: smoke regions the line passes through.
    const r = regionSmokeBetween(a, b);
    if (r.kind !== "none") best = worseSmoke(best, { kind: r.kind, source: r.source, flames: false });
  } catch { /* none */ }
  return best;
}

// ---------------------------------------------------------------- v0.59.0 area templates (Regions)

/** Pure: the centre of a token document in pixels. */
export function tokenCentre(doc: { x: number; y: number; width?: number; height?: number }, gridSize: number): { x: number; y: number } {
  return { x: Number(doc.x) + (Number(doc.width ?? 1) * gridSize) / 2, y: Number(doc.y) + (Number(doc.height ?? 1) * gridSize) / 2 };
}

/** Tokens on the region's scene whose centre is inside it (Foundry's own test, by shape). */
export function tokensInRegion(region: any): any[] {
  try {
    const placeables: any[] = canvas?.tokens?.placeables ?? [];
    const size = Number(canvas?.grid?.size) || 100;
    return placeables.filter((t: any) => {
      const c = t.center ?? tokenCentre(t.document ?? t, size);
      return Boolean(region?.testPoint?.({ x: c.x, y: c.y, elevation: Number(t.document?.elevation ?? 0) }));
    });
  } catch { return []; }
}

/** Make the tokens inside a region this user's targets (others released). */
export function targetInside(region: any): number {
  const inside = tokensInRegion(region);
  try {
    const ids = inside.map((t: any) => t.id);
    const u: any = (game as any).user;
    if (typeof u?.updateTokenTargets === 'function') u.updateTokenTargets(ids);
    else { for (const t of canvas?.tokens?.placeables ?? []) (t as any).setTarget?.(ids.includes((t as any).id), { releaseOthers: false, groupSelection: true }); }
  } catch (err) { console.warn('sr2e | targets', err); }
  return inside.length;
}

/** The data for a circular area of `radiusMetres` at `point`, as a Region. */
export function areaRegionData(point: { x: number; y: number }, radiusMetres: number, o: { name: string; color?: string; flags?: Record<string, unknown> }): Record<string, unknown> {
  const CONSTS: any = (globalThis as any).CONST ?? {};
  return {
    name: o.name,
    color: o.color ?? '#ff7a1a',
    shapes: [{ type: 'circle', x: Math.round(point.x), y: Math.round(point.y), radius: Math.max(1, radiusMetres * pxPerMetre()) }],
    visibility: CONSTS.REGION_VISIBILITY?.ALWAYS ?? 2,
    displayMeasurements: true,
    flags: { [SYSTEM.id]: { area: true, ...(o.flags ?? {}) } },
  };
}

/**
 * A blast or area on the map: drawn at once where it happened, and taken off again at the next Combat Turn
 * (or after `seconds` out of combat). Nothing happens if the user may not create regions.
 */
export async function drawArea(point: { x: number; y: number }, radiusMetres: number, name: string, seconds = 20, sceneId?: string, more: { turns?: number; smoke?: '' | 'smoke' | 'thermal' } = {}): Promise<any | null> {
  try {
    const scene: any = sceneId ? (game as any).scenes?.get?.(sceneId) : canvas?.scene;
    // v0.81.1 round 2 (A6, V-SEC 3): a GM re-running a player's card draws as that player would: through the relay.
    const acting = actingAuthor();
    const user: any = acting ?? (game as any).user;
    if (!scene) return null;
    // A player who may not create regions asks the GM's client to draw it (applications/socket.ts). Round 3
    // (FIX3-BRIEF 6, V2 #6): inside a re-run always that way, whatever the acting player's region permission (the
    // player's write guard would cancel a region made inside the re-run; the relay queues it for afterwards).
    if (acting || !(user?.isGM || user?.hasPermission?.('REGION_CREATE'))) {
      void requestGm('drawArea', { sceneId: scene.id, x: point.x, y: point.y, radius: radiusMetres, name: String(name).slice(0, 60), ...(more.turns ? { turns: more.turns } : {}), ...(more.smoke ? { smoke: more.smoke } : {}) });
      return null;
    }
    return await drawAreaNow(scene, point, radiusMetres, name, seconds, more);
  } catch (err) { console.warn('sr2e | draw area', err); return null; }
}

/** v0.81.1 round 2: the author a re-run of a player's card is acting for (SR2Actor.actingAuthor), or null. */
function actingAuthor(): any {
  const a: any = (globalThis as any).CONFIG?.Actor?.documentClass?.actingAuthor ?? null;
  return a && !a.isGM ? a : null;
}

/** The area region itself, on `scene` (no permission check: the callers make it). */
async function drawAreaNow(scene: any, point: { x: number; y: number }, radiusMetres: number, name: string, seconds = 20, more: { turns?: number; smoke?: '' | 'smoke' | 'thermal' } = {}): Promise<any | null> {
  try {
    const combat: any = (game as any).combat;
    const round = combat?.started ? Number(combat.round ?? 0) : null;
    // v0.61.0: an area that lingers `turns` Combat Turns (a smoke cloud) and fills with smoke (a region environment).
    const turns = Math.max(0, Math.floor(Number(more.turns ?? 0)));
    // v0.70.0: a lingering cloud lasts its Combat Turns in world time (3 s each), in or out of combat, and outlives the
    // combat (RULES.FIXES_V70.areasWorldTime); before, it went after real seconds outside combat or when the combat ended.
    const worldNow = Number((game as any).time?.worldTime ?? 0);
    const expires = turns && RULES.FIXES_V70.areasWorldTime
      // A real-time backstop (10× its game time, at least 10 minutes) in case the GM never moves the clock.
      ? { round: null, combatId: null, world: worldNow + turns * Number(RULES.COMBAT_TURN_SECONDS || 3), at: Date.now() + Math.max(600, turns * Number(RULES.COMBAT_TURN_SECONDS || 3) * 10) * 1000 }
      : { round: round === null ? null : round + Math.max(0, turns - 1), combatId: round === null ? null : combat.id, at: Date.now() + (turns ? Math.max(seconds, turns * 3) : seconds) * 1000 };
    const env = more.smoke ? { env: { smoke: more.smoke } } : {};
    const [r] = await scene.createEmbeddedDocuments('Region', [areaRegionData(point, radiusMetres, { name, ...(more.smoke ? { color: '#888888' } : {}), flags: { expires, ...env } })], { sr2eArea: true });
    return r ?? null;
  } catch (err) { console.warn('sr2e | draw area', err); return null; }
}

/** Let the user place a circle of `radiusMetres` on the map; the tokens inside become their targets. */
export async function placeArea(radiusMetres: number, name: string): Promise<{ region: any; count: number } | null> {
  try {
    if (!canvas?.ready || !canvas?.regions?.placeRegion) { ui.notifications?.warn?.(tx('SR2E.Notify.Canvas.noSceneToPlaceItOn')); return null; }
    const user: any = (game as any).user;
    if (!(user?.isGM || user?.hasPermission?.('REGION_CREATE'))) { ui.notifications?.warn?.(tx('SR2E.Notify.Canvas.youMayNotPlaceAreasOn')); return null; }
    ui.notifications?.info?.(tx('SR2E.Notify.Canvas.placeTheMClickToDrop', { name: escHtml(name), radiusMetres }));
    const combat: any = (game as any).combat;
    const started = Boolean(combat?.started);
    const data = areaRegionData({ x: 0, y: 0 }, radiusMetres, { name, color: '#3aa0ff', flags: { placed: true, expires: { round: started ? Number(combat.round ?? 0) : null, combatId: started ? combat.id : null, at: Date.now() + 120000 } } });
    const region = await canvas.regions.placeRegion(data, { create: true, allowRotation: false });
    if (!region) return null;
    return { region, count: targetInside(region) };
  } catch (err) { console.warn('sr2e | place area', err); return null; }
}

/**
 * v0.61.0: draw a ward on the map: the user places a circle of `radiusMetres` that stays (no expiry) and carries
 * the ward (flags.sr2e.env.wardUuid), so astral movement and spells across it are checked (applications/regions.ts).
 */
export async function placeWardRegion(barrierUuid: string, name: string, radiusMetres: number): Promise<any | null> {
  try {
    if (!canvas?.ready || !canvas?.regions?.placeRegion) { ui.notifications?.warn?.(tx('SR2E.Notify.Canvas.noSceneToPlaceItOn')); return null; }
    const user: any = (game as any).user;
    if (!(user?.isGM || user?.hasPermission?.('REGION_CREATE'))) { ui.notifications?.warn?.(tx('SR2E.Notify.Canvas.youMayNotPlaceRegionsOn')); return null; }
    ui.notifications?.info?.(tx('SR2E.Notify.Canvas.placeMClickToDropIt', { name: escHtml(name), radiusMetres }));
    const data: any = areaRegionData({ x: 0, y: 0 }, radiusMetres, { name, color: palette('street', 'cyan').areas.magic.base, flags: { env: { wardUuid: barrierUuid } } });
    delete data.flags[SYSTEM.id].area;
    return (await canvas.regions.placeRegion(data, { create: true, allowRotation: false })) ?? null;
  } catch (err) { console.warn('sr2e | place ward', err); return null; }
}

/**
 * Pure: whether an area is due to come off. Drawn in a combat: when that combat has moved to a later Combat
 * Turn or is gone. Drawn outside combat: when its time (real time, `at`) is up.
 */
export function areaExpired(expires: { round: number | null; combatId: string | null; at?: number; world?: number } | undefined, now: { rounds: ReadonlyMap<string, number>; ms: number; world?: number }): boolean {
  if (!expires) return false;
  // v0.70.0: a lingering cloud's world-time end (in or out of combat).
  if (typeof expires.world === 'number' && Number.isFinite(expires.world)) return Number(now.world ?? -Infinity) >= expires.world || Number(expires.at ?? Infinity) <= now.ms;
  if (expires.combatId) {
    const r = now.rounds.get(expires.combatId);
    return r === undefined || r > Number(expires.round ?? 0);
  }
  return Number(expires.at ?? Infinity) <= now.ms;
}

/**
 * Hooks: a template (an area region) a player drops, or one of ours, targets the tokens inside it for
 * whoever placed it; the active GM takes old blast areas off as Combat Turns go by.
 */
export function registerAreaHooks(): void {
  onRelay('drawArea', async (d, user) => {
    const r = Number(d.radius);
    if (!(r > 0 && r <= 100) || !Number.isFinite(Number(d.x)) || !Number.isFinite(Number(d.y))) return { ok: false, note: tx('SR2E.App.Canvas.badArea') };
    // v0.81.0 (SEC1-21): only on a scene the asking user can be on (the one they view, or the active one).
    const scene: any = (game as any).scenes?.get?.(String(d.sceneId ?? ''));
    if (!scene) return { ok: false, note: tx('SR2E.App.Canvas.noSuchScene') };
    // v0.81.1 round 2 (A6): on the GM's own client inside a re-run (requestGm runs this inline, as the player), the
    // area comes from the system's resolver, not a socket: no viewed-scene check, and it is drawn once the re-run is
    // over (queued on the GM lock: inside the re-run the player's write guard would cancel it).
    const inRerun = Boolean(actingAuthor());
    if (!inRerun && !user?.isGM && user?.viewedScene !== scene.id && !scene.active) return { ok: false, note: tx('SR2E.App.Canvas.notASceneYouAreOn') };
    const turns = Math.min(200, Math.max(0, Math.floor(Number(d.turns ?? 0)) || 0));
    const smoke = d.smoke === 'smoke' || d.smoke === 'thermal' ? d.smoke : '';
    const draw = () => drawAreaNow(scene, { x: Number(d.x), y: Number(d.y) }, r, String(d.name ?? 'Area').slice(0, 60), 20, { turns, smoke });
    if (inRerun) { void withGmLock(draw); return { ok: true }; }
    const made = await draw();
    return { ok: Boolean(made) };
  });
  Hooks.on('createRegion', (region: any, options: any, userId: string) => {
    if (!madeHere(options, userId) || options?.sr2eArea) return;
    const ours = region?.getFlag?.(SYSTEM.id, 'area');
    if (!ours && (game as any).user?.isGM) return;
    if (ours && region.getFlag?.(SYSTEM.id, 'placed')) return; // placeArea targets it itself
    setTimeout(() => { targetInside(region); }, 50);
  });
  // v0.73.0 (O39): the undo log reads why (a timer sweep isn't a step; a clock or Combat Turn one joins that step).
  const sweep = (cause: AreaSweepCause = 'timer') => {
    if (!isLeadGm()) return;
    const rounds = new Map<string, number>([...((game as any).combats ?? [])].filter((c: any) => c.started).map((c: any) => [c.id, Number(c.round ?? 0)]));
    const now = { rounds, ms: Date.now(), world: Number((game as any).time?.worldTime ?? 0) };
    for (const sc of [...((game as any).scenes ?? [])] as any[]) {
      const ids = [...(sc.regions ?? [])].filter((r: any) => r.getFlag?.(SYSTEM.id, 'area') && areaExpired(r.getFlag(SYSTEM.id, 'expires'), now)).map((r: any) => r.id);
      if (ids.length) void sc.deleteEmbeddedDocuments('Region', ids, { sr2eAreaSweep: cause } as any).catch?.(() => {});
    }
  };
  Hooks.on('updateCombat', (_c: any, change: any) => { if (change?.round !== undefined) setTimeout(() => sweep('round'), 100); });
  Hooks.on('deleteCombat', () => setTimeout(() => sweep('combatEnd'), 100));
  Hooks.on('updateWorldTime', () => setTimeout(() => sweep('clock'), 100));
  // Areas drawn outside combat (and any left over from before a reload) go when their time is up.
  // v0.85.0: the first sweep waits until the GM windows have heard each other.
  Hooks.once('ready', () => { void leadSettled().then(() => sweep('timer')); setInterval(() => sweep('timer'), 10000); });
}
