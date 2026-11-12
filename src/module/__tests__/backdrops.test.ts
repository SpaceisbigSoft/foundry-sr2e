/**
 * The built-in scene backdrops: the shipped geometry (rules/backdrops.ts) against the drawings (src/art/backdrops.ts)
 * and the files built from them (public/backdrops/): shape, bounds, zones clear of walls, doors in wall gaps, the
 * files' safety (no text, scripts, outside links or images) and size, and the English for every key.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BACKDROPS, backdropById, backdropsFor, backdropPlan, type BackdropRect, type BackdropSeg } from '../rules/backdrops.ts';
import { allBackdrops, backdropSvg } from '../../art/backdrops.ts';

const root = join(process.cwd(), 'public', 'backdrops');
const EN: Record<string, { label: string; hint: string; door?: Record<string, string> }> = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'backdrops-en.json'), 'utf8'));
const HEX = /^#[0-9a-f]{6}$/i;
const ENV = new Set(['urban', 'industrial', 'wilderness', 'forest', 'water', 'sea', 'river', 'mountain', 'desert', 'plains', 'swamp', 'underground', 'rooftop']);
const TERRAIN = new Set(['', 'open', 'normal', 'restricted', 'tight']);
const half = (v: number) => Number.isFinite(v) && Math.round(v * 2) === v * 2;

/** Whether a segment touches a closed rectangle (Liang–Barsky clipping). */
function segHitsRect([x1, y1, x2, y2]: BackdropSeg, r: BackdropRect): boolean {
  let t0 = 0; let t1 = 1;
  const dx = x2 - x1; const dy = y2 - y1;
  const edges: Array<[number, number]> = [[-dx, x1 - r.x], [dx, r.x + r.w - x1], [-dy, y1 - r.y], [dy, r.y + r.h - y1]];
  for (const [p, q] of edges) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}
const rectsOverlap = (a: BackdropRect, b: BackdropRect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** The length two collinear segments share (0 when they are not collinear or only touch). */
function sharedLength(a: BackdropSeg, b: BackdropSeg): number {
  const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
  const [ax1, ay1, ax2, ay2] = a; const [bx1, by1, bx2, by2] = b;
  const dx = ax2 - ax1; const dy = ay2 - ay1;
  if (Math.abs(cross(dx, dy, bx1 - ax1, by1 - ay1)) > 1e-9 || Math.abs(cross(dx, dy, bx2 - ax1, by2 - ay1)) > 1e-9) return 0;
  const len = Math.hypot(dx, dy);
  const t = (x: number, y: number) => ((x - ax1) * dx + (y - ay1) * dy) / len;
  const [p, q] = [t(bx1, by1), t(bx2, by2)].sort((m, n) => m - n) as [number, number];
  return Math.max(0, Math.min(len, q) - Math.max(0, p));
}

describe('backdrops: the geometry', () => {
  test('shape, unique ids, keys and file names', () => {
    const ids = BACKDROPS.map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const b of BACKDROPS) {
      assert.match(b.id, /^[a-z][a-z0-9-]*$/, b.id);
      assert.equal(b.labelKey, `SR2E.Backdrop.${b.id}.label`);
      assert.equal(b.hintKey, `SR2E.Backdrop.${b.id}.hint`);
      assert.equal(b.file, `backdrops/${b.id}.svg`);
      assert.ok(['real', 'astral', 'matrix'].includes(b.kind), b.id);
      assert.ok(Number.isInteger(b.width) && Number.isInteger(b.height), b.id);
      assert.ok(b.width >= 20 && b.width <= 50 && b.height >= 14 && b.height <= 36, `${b.id} size`);
      assert.match(b.background, HEX, b.id);
      assert.equal(typeof b.indoor, 'boolean');
      for (const t of b.environment ? b.environment.split(', ') : []) assert.ok(ENV.has(t), `${b.id} environment ${t}`);
      assert.ok(TERRAIN.has(b.terrain), `${b.id} terrain`);
      assert.equal(backdropById(b.id), b);
    }
    assert.equal(backdropById('nope'), undefined);
  });
  test('every kind is covered, in list order', () => {
    assert.ok(backdropsFor('real').length >= 8);
    assert.ok(backdropsFor('astral').length >= 2);
    assert.ok(backdropsFor('matrix').length >= 2);
    for (const k of ['real', 'astral', 'matrix'] as const) assert.deepEqual(backdropsFor(k), BACKDROPS.filter((b) => b.kind === k));
    // Real-world maps have walls and doors to build; the astral and Matrix ones have no solid walls.
    for (const b of backdropsFor('real')) assert.ok(b.walls.length > 0 && b.doors.length > 0, b.id);
    for (const b of [...backdropsFor('astral'), ...backdropsFor('matrix')]) assert.equal(b.walls.length, 0, b.id);
  });
  test('every coordinate is inside the map, on whole or half metres', () => {
    for (const b of BACKDROPS) {
      const segs = [...b.walls, ...b.windows, ...b.doors.map((d) => d.c)];
      for (const s of segs) {
        assert.ok(s.every(half), `${b.id} ${s}`);
        assert.ok(s[0] >= 0 && s[2] >= 0 && s[0] <= b.width && s[2] <= b.width && s[1] >= 0 && s[3] >= 0 && s[1] <= b.height && s[3] <= b.height, `${b.id} ${s}`);
        assert.ok(s[0] !== s[2] || s[1] !== s[3], `${b.id} empty segment ${s}`);
      }
      for (const l of b.lights) {
        assert.ok(half(l.x) && half(l.y) && l.x >= 0 && l.y >= 0 && l.x <= b.width && l.y <= b.height, `${b.id} light`);
        assert.ok(l.dim > 0 && l.bright >= 0 && l.bright <= l.dim, `${b.id} light radii`);
        if (l.color !== undefined) assert.match(l.color, HEX, b.id);
      }
      for (const q of backdropPlan(b.id).parts) assert.ok([q.x, q.y, q.w, q.h].every(half) && q.x >= 0 && q.y >= 0 && q.x + q.w <= b.width && q.y + q.h <= b.height, `${b.id} part ${q.kind}`);
    }
  });
  test('zones: inside, big enough, apart, and clear of every wall, window, door and obstacle', () => {
    for (const b of BACKDROPS) {
      const { pcs, npcs } = b.zones;
      for (const z of [pcs, npcs]) {
        assert.ok([z.x, z.y, z.w, z.h].every(half), b.id);
        assert.ok(z.x >= 0 && z.y >= 0 && z.x + z.w <= b.width && z.y + z.h <= b.height, `${b.id} zone in bounds`);
        assert.ok(Math.max(z.w, z.h) >= 4 && Math.min(z.w, z.h) >= 3, `${b.id} zone size`);
        for (const s of [...b.walls, ...b.windows, ...b.doors.map((d) => d.c)]) assert.ok(!segHitsRect(s, z), `${b.id} zone crossed by ${s}`);
        for (const q of backdropPlan(b.id).parts) if (q.edge !== 'flat') assert.ok(!rectsOverlap(q, z), `${b.id} zone holds ${q.kind}`);
      }
      assert.ok(!rectsOverlap(pcs, npcs), `${b.id} zones overlap`);
    }
  });
  test('doors sit in wall gaps (no overlap with a wall or window), with key names and English', () => {
    for (const b of BACKDROPS) {
      for (const d of b.doors) {
        for (const w of [...b.walls, ...b.windows]) assert.equal(sharedLength(d.c, w), 0, `${b.id} ${d.name} overlaps ${w}`);
        const m = d.name.match(/^SR2E\.Backdrop\.([a-z-]+)\.door\.([A-Za-z0-9]+)$/);
        assert.ok(m && m[1] === b.id, `${b.id} door name ${d.name}`);
        assert.ok(EN[b.id]?.door?.[m![2]!], `${b.id} door English ${d.name}`);
      }
      const names = b.doors.map((d) => d.name);
      assert.equal(new Set(names).size, names.length, `${b.id} door names unique`);
      const secure = b.doors.filter((d) => d.secure).length;
      if (b.kind === 'real') assert.ok(secure >= 1 && secure <= 2, `${b.id} secure doors ${secure}`);
    }
  });
  test('the geometry is the plan: walls and windows come from its lines and parts', () => {
    for (const b of BACKDROPS) {
      const plan = backdropPlan(b.id);
      for (const l of plan.lines) assert.ok(l.c[0] === l.c[2] || l.c[1] === l.c[3], `${b.id} line not straight`);
      const solids = plan.parts.filter((q) => q.edge === 'solid').length;
      const lows = plan.parts.filter((q) => q.edge === 'low').length;
      assert.ok(b.walls.length >= solids * 4 && b.windows.length >= lows * 4, b.id);
    }
  });
  test('every label, hint and door has English; no setting names', () => {
    assert.deepEqual(Object.keys(EN).sort(), BACKDROPS.map((b) => b.id).sort());
    for (const b of BACKDROPS) {
      assert.ok(EN[b.id]!.label.length > 2 && EN[b.id]!.hint.length > 10, b.id);
      assert.deepEqual(Object.keys(EN[b.id]!.door ?? {}).sort(), b.doors.map((d) => d.name.split('.').pop()!).sort(), b.id);
    }
  });
});

describe('backdrops: the files', () => {
  const shipped = readdirSync(root).sort();
  test('one file per backdrop, named by its id, and nothing else', () => {
    assert.deepEqual(shipped, BACKDROPS.map((b) => `${b.id}.svg`).sort());
  });
  test('the files are exactly what the drawings build (run npm run backdrops after a change)', () => {
    for (const f of allBackdrops()) assert.equal(readFileSync(join(root, f.file), 'utf8'), f.svg, f.file);
  });
  test('the drawing is deterministic', () => {
    for (const b of BACKDROPS) assert.equal(backdropSvg(b.id), backdropSvg(b.id), b.id);
  });
  test('size, viewBox, title, and nothing unsafe', () => {
    for (const b of BACKDROPS) {
      const s = readFileSync(join(root, `${b.id}.svg`), 'utf8');
      assert.ok(Buffer.byteLength(s) < 250 * 1024, `${b.id} is ${Buffer.byteLength(s)} bytes`);
      assert.match(s, new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${b.width * 100} ${b.height * 100}" width="${b.width * 100}" height="${b.height * 100}">`), b.id);
      assert.ok(s.includes(`<title>${EN[b.id]!.label}</title>`), `${b.id} title`);
      assert.doesNotMatch(s, /<(text|image|script|foreignObject|style|a|iframe|feImage|use)\b/i, b.id);
      assert.doesNotMatch(s, /(xlink:)?href\s*=|https?:\/\/(?!www\.w3\.org\/2000\/svg")/i, b.id);
      assert.doesNotMatch(s, /\bon[a-z]+\s*=/i, b.id);
      assert.doesNotMatch(s, /data:/i, b.id);
    }
  });
});
