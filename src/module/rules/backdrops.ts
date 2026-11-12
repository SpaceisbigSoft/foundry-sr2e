/**
 * The built-in scene backdrops (pure data: no Foundry). The Scene builder lets a GM pick one as a new scene's
 * background, and makes the scene's walls, doors, lights and token start zones from the same geometry, so the
 * picture (`public/backdrops/<id>.svg`, drawn by `src/art/backdrops.ts` from this data, built by
 * `npm run backdrops`) and the walls always agree.
 *
 * Units are metres; scene coordinates are metres × 100 px (grid 100 px = 1 m), origin top-left, no padding.
 * Each map is written as a plan: straight wall lines (with their doors, glass panes and open gaps) and parts
 * (crates, cars, pillars, counters...), each part solid (walls round it), low (windows round it: blocks movement
 * only) or flat (no walls). The `walls`, `windows` and `doors` arrays are made from the plan.
 */

/** Metres. Scene coordinates are metres × 100 px (grid 100 px = 1 m), origin top-left, no padding. */
export interface BackdropRect { x: number; y: number; w: number; h: number }
export type BackdropSeg = [number, number, number, number]; // x1, y1, x2, y2 in metres
export interface BackdropDoor { c: BackdropSeg; name: string; /** a door the builder may put a maglock on */ secure?: boolean }
export interface BackdropLight { x: number; y: number; dim: number; bright: number; color?: string } // metres; dim/bright radii in metres
export interface Backdrop {
  id: string;
  kind: 'real' | 'astral' | 'matrix';
  labelKey: string;
  hintKey: string;
  file: string;
  width: number; height: number;
  background: string;
  indoor: boolean;
  walls: BackdropSeg[];
  windows: BackdropSeg[];
  doors: BackdropDoor[];
  lights: BackdropLight[];
  zones: { pcs: BackdropRect; npcs: BackdropRect };
  environment: string;
  terrain: string;
}

// ---------------------------------------------------------------- Plans

/** How a door looks (the drawing): a hinged door, a pair, a roll-up shutter, glass, elevator doors. */
export type BackdropDoorLook = 'swing' | 'double' | 'roll' | 'glass' | 'elevator';
/** `name` is the door's short id; the backdrop's door name is the key `SR2E.Backdrop.<id>.door.<name>`. */
export interface BackdropPlanDoor { at: [number, number]; name: string; secure?: boolean; look?: BackdropDoorLook }
/**
 * One straight (horizontal or vertical) line of the plan. `kind: 'wall'` is solid; `'window'` blocks movement
 * only (railings, parapets, fences, glass walls, low edges). Openings are spans along the line (x for a
 * horizontal line, y for a vertical one): doors, glass panes in a solid wall (windows), and open gaps.
 */
export interface BackdropLine {
  c: BackdropSeg;
  kind: 'wall' | 'window';
  /** How it is drawn: 'concrete', 'brick', 'facade', 'timber', 'glass', 'parapet', 'fence', 'partition', 'stage', 'curb', 'edge'. */
  look: string;
  doors?: BackdropPlanDoor[];
  panes?: Array<[number, number]>;
  gaps?: Array<[number, number]>;
}
/** A thing on the map: `solid` gets walls round it, `low` windows round it, `flat` none. */
export interface BackdropPart extends BackdropRect { kind: string; edge: 'solid' | 'low' | 'flat' }
export interface BackdropPlan { lines: BackdropLine[]; parts: BackdropPart[] }

/** The pieces of one plan line: its solid or low runs, its panes (windows) and its doors. */
export function linePieces(l: BackdropLine): { runs: BackdropSeg[]; panes: BackdropSeg[]; doors: BackdropDoor[] } {
  const [x1, y1, x2, y2] = l.c;
  const horiz = y1 === y2;
  const lo = horiz ? Math.min(x1, x2) : Math.min(y1, y2);
  const hi = horiz ? Math.max(x1, x2) : Math.max(y1, y2);
  const at = (a: number, b: number): BackdropSeg => (horiz ? [a, y1, b, y1] : [x1, a, x1, b]);
  const cuts: Array<{ a: number; b: number; what: 'door' | 'pane' | 'gap'; door?: BackdropPlanDoor }> = [
    ...(l.doors ?? []).map((d) => ({ a: d.at[0], b: d.at[1], what: 'door' as const, door: d })),
    ...(l.panes ?? []).map(([a, b]) => ({ a, b, what: 'pane' as const })),
    ...(l.gaps ?? []).map(([a, b]) => ({ a, b, what: 'gap' as const })),
  ].sort((p, q) => p.a - q.a);
  const runs: BackdropSeg[] = []; const panes: BackdropSeg[] = []; const doors: BackdropDoor[] = [];
  let pos = lo;
  for (const c of cuts) {
    if (c.a > pos) runs.push(at(pos, c.a));
    if (c.what === 'pane') panes.push(at(c.a, c.b));
    if (c.what === 'door' && c.door) doors.push({ c: at(c.a, c.b), name: c.door.name, ...(c.door.secure ? { secure: true } : {}) });
    pos = Math.max(pos, c.b);
  }
  if (hi > pos) runs.push(at(pos, hi));
  return { runs, panes, doors };
}

/** A rectangle's four sides. */
export function rectSides(r: BackdropRect): BackdropSeg[] {
  const { x, y, w, h } = r;
  return [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]];
}

type Openings = Pick<BackdropLine, 'doors' | 'panes' | 'gaps'>;
const H = (y: number, x1: number, x2: number, look = 'concrete', o: Openings = {}): BackdropLine => ({ c: [x1, y, x2, y], kind: 'wall', look, ...o });
const V = (x: number, y1: number, y2: number, look = 'concrete', o: Openings = {}): BackdropLine => ({ c: [x, y1, x, y2], kind: 'wall', look, ...o });
const lowH = (y: number, x1: number, x2: number, look: string, o: Openings = {}): BackdropLine => ({ ...H(y, x1, x2, look, o), kind: 'window' });
const lowV = (x: number, y1: number, y2: number, look: string, o: Openings = {}): BackdropLine => ({ ...V(x, y1, y2, look, o), kind: 'window' });
const lowBox = (x: number, y: number, w: number, h: number, look: string): BackdropLine[] =>
  [lowH(y, x, x + w, look), lowH(y + h, x, x + w, look), lowV(x, y, y + h, look), lowV(x + w, y, y + h, look)];
const P = (kind: string, x: number, y: number, w: number, h: number, edge: BackdropPart['edge']): BackdropPart => ({ kind, x, y, w, h, edge });
const door = (a: number, b: number, name: string, more: Partial<BackdropPlanDoor> = {}): BackdropPlanDoor => ({ at: [a, b], name, ...more });

/** The forest's trees (trunks, 1 m): placed once by hand-checked seeded scatter, kept here as plain data. */
const TREES: Array<[number, number]> = [
  [2, 2], [6, 1], [10, 3], [14, 1], [19, 2], [23, 1], [33, 1], [37, 3], [3, 7], [8, 7], [12, 6], [17, 5], [21, 6],
  [34, 6], [38, 8], [2, 21], [5, 25], [9, 27], [13, 24], [17, 27], [21, 24], [25, 27], [29, 25], [33, 28], [37, 25],
  [38, 13], [35, 10], [4, 18], [27, 22], [36, 21], [14, 8], [1, 9], [33, 11], [24, 21], [10, 23],
];

const PLANS: Record<string, BackdropPlan> = {
  street: {
    lines: [
      H(6, 0, 30, 'facade', { doors: [door(7, 8.5, 'shopFront')], panes: [[11, 19]] }),
      V(30, 0, 6, 'facade'), V(33, 0, 6, 'facade'),
      H(6, 33, 40, 'facade', { doors: [door(36, 37.5, 'side', { secure: true })] }),
      H(22, 0, 40, 'facade', { doors: [door(13, 14.5, 'apartment', { secure: true }), door(28.5, 30, 'bar')], panes: [[20, 28]] }),
    ],
    parts: [P('car', 3.5, 10.5, 4.5, 2, 'low'), P('car', 24, 15.5, 4.5, 2, 'low'), P('car', 15, 10.5, 4.5, 2, 'low')],
  },
  alley: {
    lines: [
      V(8, 0, 32, 'brick', { doors: [door(6, 7.5, 'kitchen', { secure: true }), door(20, 21.5, 'back')] }),
      V(16, 0, 24, 'brick', { doors: [door(12, 13.5, 'staff', { secure: true })] }),
      H(24, 16, 19, 'brick'), V(19, 24, 28, 'brick', { doors: [door(25, 27, 'loading', { look: 'roll' })] }), H(28, 16, 19, 'brick'),
      V(16, 28, 32, 'brick'),
      lowH(3, 8, 16, 'fence', { gaps: [[12.5, 14]] }),
    ],
    parts: [P('dumpster', 8.5, 9, 1.5, 2.5, 'low'), P('dumpster', 14, 16.5, 1.5, 2.5, 'low'), P('bins', 8.5, 22.5, 1, 1, 'low'), P('pallets', 16.5, 28.5, 1.5, 1.5, 'low')],
  },
  rooftop: {
    lines: [
      ...lowBox(1.5, 1.5, 23.5, 25, 'parapet'),
      ...lowBox(26.5, 5, 8.5, 19, 'parapet'),
      H(4, 4, 8), V(4, 4, 8), V(8, 4, 8), H(8, 4, 8, 'concrete', { doors: [door(5.5, 7, 'roofAccess', { secure: true })] }),
    ],
    parts: [
      P('ac', 13, 4, 3, 2, 'low'), P('ac', 17.5, 4, 3, 2, 'low'), P('ac', 29, 8, 3, 2, 'low'),
      P('vent', 11, 15, 1, 1, 'low'), P('vent', 20, 20, 1, 1, 'low'), P('vent', 4, 16, 1, 1, 'low'),
      P('skylight', 10, 19, 4, 3, 'low'), P('hatch', 31, 19, 1.5, 1.5, 'low'), P('mast', 22, 3, 1, 1, 'low'),
    ],
  },
  warehouse: {
    lines: [
      H(0.5, 0.5, 39.5), V(0.5, 0.5, 27.5),
      V(39.5, 0.5, 27.5, 'concrete', { doors: [door(20, 21.5, 'side', { secure: true })] }),
      H(27.5, 0.5, 39.5, 'concrete', { doors: [door(5, 10, 'loadingBay', { look: 'roll' })] }),
      V(30, 0.5, 8, 'concrete', { panes: [[2, 5.5]] }),
      H(8, 30, 39.5, 'concrete', { doors: [door(33, 34.5, 'office', { secure: true })] }),
    ],
    parts: [
      P('crates', 2.5, 3, 3, 3, 'solid'), P('crates', 7, 3, 2, 2, 'solid'), P('crates', 2.5, 8, 2, 2, 'solid'),
      P('shelf', 12, 9.5, 14, 1, 'solid'), P('shelf', 12, 13.5, 14, 1, 'solid'), P('shelf', 12, 17.5, 14, 1, 'solid'),
      P('crates', 35, 17, 2.5, 2.5, 'solid'), P('pallets', 14, 22, 2, 1.5, 'low'), P('pallets', 17, 22, 1.5, 1.5, 'low'),
      P('forklift', 24, 21, 1.5, 3, 'low'), P('desk', 32, 2, 3, 1.5, 'low'), P('cabinet', 37.5, 1, 1.5, 1, 'low'),
    ],
  },
  office: {
    lines: [
      H(0.5, 0.5, 39.5, 'concrete', { panes: [[2, 27.5], [29, 33], [34.5, 38.5]] }),
      V(0.5, 0.5, 29.5), V(39.5, 0.5, 29.5),
      H(29.5, 0.5, 39.5, 'concrete', { doors: [door(5, 7.5, 'entrance', { look: 'glass' })], panes: [[1.5, 4.5], [8, 13.5]] }),
      // Elevators (two cabs off the west wall).
      H(10, 0.5, 3), H(13.5, 0.5, 3), H(17, 0.5, 3),
      V(3, 10, 17, 'concrete', { doors: [door(10.5, 12.5, 'elevatorA', { look: 'elevator' }), door(14.5, 16.5, 'elevatorB', { look: 'elevator' })] }),
      // Lobby.
      H(18, 0.5, 14, 'concrete', { doors: [door(6, 8, 'security', { look: 'glass' })], panes: [[9, 13]] }),
      V(14, 18, 29.5),
      // Meeting room (glass walls).
      lowH(22, 14, 24, 'glass', { doors: [door(17, 18.5, 'meeting', { look: 'glass' })] }),
      lowV(24, 22, 29.5, 'glass'),
      // Server room.
      V(30, 22, 29.5, 'concrete', { doors: [door(25, 26.5, 'server', { secure: true })] }),
      H(22, 30, 39.5),
      // Two private offices.
      V(28, 0.5, 7), V(33.5, 0.5, 7),
      H(7, 28, 39.5, 'concrete', { doors: [door(29, 30.5, 'office'), door(35, 36.5, 'executive', { secure: true })] }),
      // Cubicle partitions (a plus per cluster of four desks).
      ...[[8, 5.5], [15, 5.5], [22, 5.5], [8, 12.5], [15, 12.5], [22, 12.5]].flatMap(([cx, cy]) => [
        lowH(cy!, cx! - 2.5, cx! + 2.5, 'partition'), lowV(cx!, cy! - 2.5, cy! + 2.5, 'partition'),
      ]),
    ],
    parts: [
      P('counter', 6, 21, 4, 1, 'low'), P('table', 16, 24.5, 6, 2.5, 'low'),
      P('rack', 32, 23.5, 6, 1, 'solid'), P('rack', 32, 26, 6, 1, 'solid'), P('rack', 32, 28, 6, 0.5, 'solid'),
      P('desk', 30, 2, 2.5, 1, 'low'), P('desk', 35.5, 2, 3, 1, 'low'), P('sofa', 10, 26, 3, 1, 'low'), P('counter', 25, 28, 4, 1, 'low'),
    ],
  },
  club: {
    lines: [
      H(0.5, 0.5, 35.5, 'concrete', { doors: [door(1.5, 3, 'staff', { secure: true })] }),
      V(0.5, 0.5, 27.5), V(35.5, 0.5, 27.5),
      H(27.5, 0.5, 35.5, 'concrete', { doors: [door(16, 20, 'front', { look: 'double' })] }),
      lowH(5, 11, 25, 'stage', { gaps: [[22.5, 25]] }), lowV(11, 0.5, 5, 'stage'), lowV(25, 0.5, 5, 'stage'),
      V(28, 0.5, 6.5), H(6.5, 28, 35.5, 'concrete', { doors: [door(30, 31.5, 'backRoom', { secure: true })] }),
      H(21, 0.5, 7, 'concrete', { doors: [door(3, 4.5, 'restroom')] }), V(7, 21, 27.5),
    ],
    parts: [
      P('bar', 4, 5, 1, 12, 'low'), P('booth', 32, 9, 3, 2.5, 'low'), P('booth', 32, 13, 3, 2.5, 'low'), P('booth', 32, 17, 3, 2.5, 'low'),
      P('table', 30, 2, 3, 2, 'low'), P('sofa', 34, 1.5, 1, 3.5, 'low'), P('dj', 16, 1.5, 4, 1.5, 'low'),
      P('stool', 9, 19, 1, 1, 'low'), P('stool', 11, 23, 1, 1, 'low'), P('stool', 25, 22, 1, 1, 'low'), P('stool', 27, 19, 1, 1, 'low'),
    ],
  },
  sewer: {
    lines: [
      H(9, 0, 18, 'brick'), H(9, 26, 40, 'brick'), H(19, 0, 18, 'brick'),
      H(19, 26, 40, 'brick', { doors: [door(32, 33.5, 'maintenance', { secure: true })] }),
      V(18, 0, 9, 'brick'), V(26, 0, 9, 'brick'), V(18, 19, 28, 'brick'), V(26, 19, 28, 'brick'),
      V(30, 19, 26), H(26, 30, 38), V(38, 19, 26),
    ],
    parts: [P('bench', 34, 24.5, 3, 1, 'low'), P('cabinet', 36.5, 20, 1, 1.5, 'low'), P('debris', 12, 16.5, 1.5, 1.5, 'low')],
  },
  garage: {
    lines: [
      H(0.5, 0.5, 34), V(0.5, 0.5, 31.5), V(39.5, 0.5, 31.5), H(31.5, 0.5, 39.5),
      lowV(34, 0.5, 18, 'curb'),
      H(24.5, 0.5, 5, 'concrete', { doors: [door(2, 3.5, 'stairwell')] }), V(5, 24.5, 31.5),
      V(35, 26, 31.5, 'concrete', { doors: [door(27.5, 29, 'utility', { secure: true })] }), H(26, 35, 39.5),
    ],
    parts: [
      ...[9.5, 19.5, 29.5].flatMap((x) => [P('pillar', x, 2.5, 1, 1, 'solid'), P('pillar', x, 16, 1, 1, 'solid'), P('pillar', x, 28.5, 1, 1, 'solid')]),
      P('car', 4, 1, 2, 4.5, 'low'), P('car', 14, 1, 2, 4.5, 'low'), P('car', 24, 1, 2, 4.5, 'low'),
      P('car', 11, 11.5, 2, 4.5, 'low'), P('car', 21, 11.5, 2, 4.5, 'low'), P('car', 27, 11.5, 2, 4.5, 'low'),
      P('car', 4, 17, 2, 4.5, 'low'), P('car', 17, 17, 2, 4.5, 'low'), P('car', 31, 17, 2, 4.5, 'low'),
      P('car', 14, 26.5, 2, 4.5, 'low'), P('car', 24, 26.5, 2, 4.5, 'low'),
    ],
  },
  docks: {
    lines: [
      H(27, 26, 44, 'concrete', { doors: [door(31, 35, 'roll', { look: 'roll' }), door(38, 39.5, 'side', { secure: true })] }),
      V(26, 27, 32),
    ],
    parts: [
      P('containers', 3, 15, 12, 5, 'solid'), P('containers', 19, 18, 2.5, 12, 'solid'), P('containers', 35, 15, 6, 2.5, 'solid'),
      P('crane', 23, 13, 1, 1, 'solid'), P('crane', 30, 13, 1, 1, 'solid'), P('crane', 23, 20, 1, 1, 'solid'), P('crane', 30, 20, 1, 1, 'solid'),
      ...[[6, 12.5], [14, 12.5], [36, 12.5], [41, 12.5], [26.5, 10], [31, 10], [26.5, 2.5], [31, 2.5]].map(([x, y]) => P('bollard', x!, y!, 0.5, 0.5, 'low')),
      P('crates', 12, 23, 2, 2, 'low'), P('drums', 10, 25, 1.5, 1, 'low'),
    ],
  },
  forest: {
    lines: [
      H(4, 25, 31, 'timber', { gaps: [[27, 29]] }), V(25, 4, 10, 'timber'), V(31, 4, 10, 'timber', { gaps: [[6, 7.5]] }),
      H(10, 25, 31, 'timber', { doors: [door(27, 28.5, 'shack', { secure: true })] }),
    ],
    parts: [
      ...TREES.map(([x, y]) => P('tree', x, y, 1, 1, 'solid')),
      P('log', 9, 20, 5, 1, 'low'), P('rock', 33, 23, 2, 1.5, 'low'), P('rock', 6, 4, 1.5, 1.5, 'low'), P('rock', 22, 19.5, 1.5, 1, 'low'),
    ],
  },
  astral: { lines: [], parts: [] },
  'astral-city': { lines: [], parts: [] },
  'matrix-host': {
    lines: [
      // I/O port (west), CPU core (centre), datastore (north-east), slave node (south-east); gaps where light-paths join.
      lowH(12, 2, 8, 'edge'), lowH(18, 2, 8, 'edge'), lowV(2, 12, 18, 'edge'), lowV(8, 12, 18, 'edge', { gaps: [[14, 16]] }),
      lowH(11, 16, 24, 'edge', { gaps: [[19, 21]] }), lowH(19, 16, 24, 'edge', { gaps: [[19, 21]] }),
      lowV(16, 11, 19, 'edge', { gaps: [[14, 16]] }), lowV(24, 11, 19, 'edge'),
      lowH(2, 30, 38, 'edge'), lowH(9, 30, 38, 'edge'), lowV(30, 2, 9, 'edge', { gaps: [[4.5, 6.5]] }), lowV(38, 2, 9, 'edge'),
      lowH(21, 30, 37, 'edge'), lowH(28, 30, 37, 'edge'), lowV(30, 21, 28, 'edge', { gaps: [[23.5, 25.5]] }), lowV(37, 21, 28, 'edge'),
    ],
    parts: [
      P('node-io', 2, 12, 6, 6, 'flat'), P('node-cpu', 16, 11, 8, 8, 'flat'), P('node-data', 30, 2, 8, 7, 'flat'), P('node-slave', 30, 21, 7, 7, 'flat'),
    ],
  },
  'matrix-grid': { lines: [], parts: [] },
};

interface Meta {
  id: string; kind: Backdrop['kind']; width: number; height: number; background: string; indoor: boolean;
  lights: BackdropLight[]; zones: Backdrop['zones']; environment: string; terrain: string;
}
const L = (x: number, y: number, dim: number, bright: number, color?: string): BackdropLight => ({ x, y, dim, bright, ...(color ? { color } : {}) });
/** Environment tags (one word each), as the comma-separated list the Scene builder takes. */
const env = (...tags: string[]): string => tags.join(', ');
const Z = (x: number, y: number, w: number, h: number): BackdropRect => ({ x, y, w, h });

const LAMP = '#ffc98a'; const WARM = '#ffd59a'; const TUBE = '#dfe9ff'; const AMBER = '#ffb347';
const CYAN = '#50d6de'; const MAGENTA = '#e04fb0'; const GREEN = '#39daad'; const VIOLET = '#9576d1';

const METAS: Meta[] = [
  { id: 'street', kind: 'real', width: 40, height: 28, background: '#1c2026', indoor: false,
    lights: [L(6, 9.5, 8, 3, LAMP), L(22, 18.5, 8, 3, LAMP), L(36, 9.5, 8, 3, LAMP), L(24, 21, 4, 1, MAGENTA), L(15, 6.5, 3, 1, CYAN)],
    zones: { pcs: Z(1, 13, 5, 4), npcs: Z(33, 11, 5, 4) }, environment: env('urban'), terrain: 'normal' },
  { id: 'alley', kind: 'real', width: 24, height: 32, background: '#1a1d22', indoor: false,
    lights: [L(8.5, 6.5, 5, 1.5, LAMP), L(15.5, 12.5, 5, 1.5, AMBER), L(8.5, 20.5, 4, 1.5, LAMP), L(18.5, 26, 4, 1, CYAN), L(12, 31, 6, 2, WARM)],
    zones: { pcs: Z(9, 28, 6, 3), npcs: Z(9, 4, 6, 3.5) }, environment: env('urban'), terrain: 'tight' },
  { id: 'rooftop', kind: 'real', width: 36, height: 28, background: '#14171b', indoor: false,
    lights: [L(6, 8.5, 5, 1.5, LAMP), L(22, 24, 7, 2, WARM), L(31, 12, 5, 1.5, CYAN), L(22.5, 3.5, 3, 0.5, '#ff5a4a')],
    zones: { pcs: Z(3, 20, 5, 4), npcs: Z(18, 10, 5, 4) }, environment: env('urban', 'rooftop'), terrain: 'tight' },
  { id: 'warehouse', kind: 'real', width: 40, height: 28, background: '#1d2126', indoor: true,
    lights: [L(8, 6, 8, 3, TUBE), L(19, 12, 7, 2.5, TUBE), L(19, 16, 7, 2.5, TUBE), L(8, 20, 8, 3, TUBE), L(34.5, 4, 5, 2, WARM), L(7.5, 26.5, 5, 1.5, AMBER), L(30, 20, 7, 2.5, TUBE)],
    zones: { pcs: Z(3, 21, 6, 4), npcs: Z(30.5, 11, 5, 4) }, environment: env('urban', 'industrial'), terrain: '' },
  { id: 'office', kind: 'real', width: 40, height: 30, background: '#1e2228', indoor: true,
    lights: [L(7, 25.5, 6, 2.5, WARM), L(11.5, 9, 7, 3, TUBE), L(19, 9, 7, 3, TUBE), L(30.5, 4, 4, 1.5, WARM), L(36.5, 4, 4, 1.5, WARM), L(19, 26, 5, 2, TUBE), L(35, 25, 4, 1.5, GREEN), L(5, 13.5, 4, 1, TUBE)],
    zones: { pcs: Z(1.5, 23, 4, 5), npcs: Z(30, 10, 6, 4) }, environment: env('urban'), terrain: '' },
  { id: 'club', kind: 'real', width: 36, height: 28, background: '#1a1720', indoor: true,
    lights: [L(18, 13, 8, 3, MAGENTA), L(18, 3, 6, 2, CYAN), L(2.5, 11, 6, 2, AMBER), L(33.5, 13, 5, 1.5, WARM), L(31.5, 3.5, 4, 1.5, WARM), L(18, 25.5, 4, 1.5, WARM), L(26, 14, 4, 1, VIOLET)],
    zones: { pcs: Z(15, 22, 6, 4), npcs: Z(13, 6.5, 6, 3.5) }, environment: env('urban'), terrain: '' },
  { id: 'sewer', kind: 'real', width: 40, height: 28, background: '#16191c', indoor: true,
    lights: [L(5, 10, 6, 2, AMBER), L(22, 2, 5, 2, TUBE), L(34, 22.5, 4, 1.5, WARM), L(36, 17.5, 5, 1.5, GREEN), L(22, 25, 4, 1, AMBER)],
    zones: { pcs: Z(1, 15.5, 6, 3), npcs: Z(33, 9.5, 6, 3) }, environment: env('urban', 'underground', 'water'), terrain: '' },
  { id: 'garage', kind: 'real', width: 40, height: 32, background: '#1c2025', indoor: true,
    lights: [L(5, 8.5, 7, 3, TUBE), L(15, 8.5, 7, 3, TUBE), L(25, 8.5, 7, 3, TUBE), L(5, 24, 7, 3, TUBE), L(15, 24, 7, 3, TUBE), L(25, 24, 7, 3, TUBE), L(37, 22, 6, 2, AMBER)],
    zones: { pcs: Z(4, 6.5, 5, 4), npcs: Z(26, 22, 6, 4) }, environment: env('urban', 'underground'), terrain: 'restricted' },
  { id: 'docks', kind: 'real', width: 44, height: 32, background: '#151a20', indoor: false,
    lights: [L(13, 13.5, 9, 3, LAMP), L(26.5, 16.5, 7, 2.5, WARM), L(40, 22, 7, 2.5, LAMP), L(29, 2.5, 5, 1.5, TUBE), L(37, 26.5, 5, 1.5, AMBER)],
    zones: { pcs: Z(3, 24, 6, 4), npcs: Z(27, 4, 4, 5) }, environment: env('urban', 'industrial', 'water'), terrain: 'normal' },
  { id: 'forest', kind: 'real', width: 40, height: 30, background: '#161c17', indoor: false,
    lights: [L(15, 12, 6, 2, '#ff9a4a'), L(29.5, 10.5, 4, 1, AMBER)],
    zones: { pcs: Z(1, 12, 5, 4), npcs: Z(20, 11, 5, 3.5) }, environment: env('wilderness', 'forest'), terrain: 'restricted' },
  { id: 'astral', kind: 'astral', width: 36, height: 28, background: '#120f1c', indoor: true,
    lights: [L(10, 9, 6, 1, VIOLET), L(26, 18, 7, 1, '#b49cf0'), L(17, 24, 5, 1, '#7f9cf0')],
    zones: { pcs: Z(3, 11, 5, 4), npcs: Z(28, 11, 5, 4) }, environment: '', terrain: '' },
  { id: 'astral-city', kind: 'astral', width: 40, height: 30, background: '#110e1a', indoor: true,
    lights: [L(20, 15, 7, 1, VIOLET), L(33, 24, 6, 1, '#8fd9b0'), L(8, 6, 5, 1, '#b49cf0')],
    zones: { pcs: Z(1, 13, 5, 4), npcs: Z(34, 13, 5, 4) }, environment: env('urban'), terrain: '' },
  { id: 'matrix-host', kind: 'matrix', width: 40, height: 30, background: '#07100c', indoor: true,
    lights: [L(5, 15, 5, 1.5, GREEN), L(20, 15, 7, 2.5, GREEN), L(34, 5.5, 5, 1.5, CYAN), L(33.5, 24.5, 5, 1.5, GREEN)],
    zones: { pcs: Z(2.5, 13, 5, 4), npcs: Z(17, 12, 6, 3) }, environment: '', terrain: '' },
  { id: 'matrix-grid', kind: 'matrix', width: 40, height: 30, background: '#060d0a', indoor: true,
    lights: [L(14, 6, 5, 1, GREEN), L(27, 22, 6, 1, CYAN), L(33, 6, 4, 1, GREEN), L(9, 24, 4, 1, GREEN)],
    zones: { pcs: Z(3, 12, 5, 4), npcs: Z(31, 12, 5, 4) }, environment: '', terrain: '' },
];

function make(m: Meta): Backdrop {
  const plan = PLANS[m.id] ?? { lines: [], parts: [] };
  const walls: BackdropSeg[] = []; const windows: BackdropSeg[] = []; const doors: BackdropDoor[] = [];
  for (const l of plan.lines) {
    const p = linePieces(l);
    (l.kind === 'wall' ? walls : windows).push(...p.runs);
    windows.push(...p.panes);
    doors.push(...p.doors.map((d) => ({ ...d, name: `SR2E.Backdrop.${m.id}.door.${d.name}` })));
  }
  for (const part of plan.parts) {
    if (part.edge === 'solid') walls.push(...rectSides(part));
    else if (part.edge === 'low') windows.push(...rectSides(part));
  }
  return {
    id: m.id, kind: m.kind, labelKey: `SR2E.Backdrop.${m.id}.label`, hintKey: `SR2E.Backdrop.${m.id}.hint`, file: 'backdrops/' + m.id + '.svg',
    width: m.width, height: m.height, background: m.background, indoor: m.indoor, walls, windows, doors,
    lights: m.lights, zones: m.zones, environment: m.environment, terrain: m.terrain,
  };
}

export const BACKDROPS: readonly Backdrop[] = METAS.map(make);

/** The plan a backdrop was made from (its lines and parts with how each is drawn), for the drawing and the tests. */
export function backdropPlan(id: string): BackdropPlan {
  return PLANS[id] ?? { lines: [], parts: [] };
}
export function backdropById(id: string): Backdrop | undefined {
  return BACKDROPS.find((b) => b.id === id);
}
export function backdropsFor(kind: 'real' | 'astral' | 'matrix'): Backdrop[] {
  return BACKDROPS.filter((b) => b.kind === kind);
}
