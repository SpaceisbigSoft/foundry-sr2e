/**
 * v0.88.0: the starter demo (pure: no Foundry). `applications/demo.ts` builds it in the world from the GM panel's
 * Setup tab ("Create the demo"), and takes it out again ("Remove the demo").
 *
 * Everything comes from the system's own generators with a fixed seed, so every world gets the same demo:
 * four runners to try the rules with (a street samurai, a mage, a decker and a rigger), a gang to fight, a
 * corporation's host with a security sheaf, a secured building with a maglocked door and a camera, a safehouse, the
 * rigger's car and drone, a small night scene, and a "Try this" journal. No book content, no setting proper nouns
 * (the generators' name tables are generic and tested for that).
 */
import { escHtml } from './html.ts';
import { t as tx } from '../helpers/i18n.ts';
import { makeRng, generateNpc, generateGroup, generateOrg, npcActorData, type NpcPlan, type GroupPlan, type OrgPlan, type PlanVehicle } from './npcgen.ts';

const esc = escHtml;

/** The demo's seed: the same demo in every world. */
export const DEMO_SEED = 20261024;
/** The flag every demo document carries (`flags.sr2e.demo`), so "Remove the demo" finds them all. */
export const DEMO_FLAG = 'demo';
/** The folders' name. */
export const DEMO_FOLDER = 'Demo (SR2e)';

/** The scene: 32 × 20 m at 100 px a metre. */
export const DEMO_SCENE = { name: 'Demo: the back lot', width: 3200, height: 2000, grid: 100, darkness: 0.55, background: '#1c2026' };

/** Where things stand on the scene (px, top-left of the token). */
export const DEMO_SPOTS = {
  runners: [{ x: 300, y: 700 }, { x: 300, y: 900 }, { x: 450, y: 800 }, { x: 450, y: 1000 }],
  car: { x: 500, y: 1500 },
  drone: { x: 650, y: 1250 },
  gang: [{ x: 1300, y: 650 }, { x: 1450, y: 850 }, { x: 1350, y: 1050 }, { x: 1500, y: 1200 }],
};

/** The building on the right: its walls (x1, y1, x2, y2), the door in its west wall, a low wall for cover, and lamps. */
export const DEMO_WALLS: Array<[number, number, number, number]> = [
  [2000, 300, 3000, 300], [3000, 300, 3000, 1500], [3000, 1500, 2000, 1500],
  [2000, 1500, 2000, 1000], [2000, 800, 2000, 300],
  // A low wall in the lot (cover), and a dumpster.
  [900, 500, 1100, 500], [1150, 1300, 1150, 1450],
];
export const DEMO_DOOR: [number, number, number, number] = [2000, 800, 2000, 1000];
export const DEMO_LIGHTS = [{ x: 1000, y: 300, dim: 6, bright: 2 }, { x: 2050, y: 900, dim: 5, bright: 2 }, { x: 600, y: 1700, dim: 6, bright: 2 }];
/** Painted areas (Foundry drawings): the street, the building's floor, the low wall. */
export const DEMO_DRAWINGS: Array<{ x: number; y: number; w: number; h: number; fill: string; stroke?: string; text: string; size: number }> = [
  { x: 0, y: 1600, w: 3200, h: 400, fill: '#2b2f36', text: 'Street', size: 48 },
  { x: 2000, y: 300, w: 1000, h: 1200, fill: '#343a44', stroke: '#5a6472', text: 'Branch office', size: 48 },
  { x: 850, y: 450, w: 300, h: 100, fill: '#4a4f57', text: 'Low wall', size: 24 },
  { x: 1100, y: 1300, w: 100, h: 150, fill: '#3d4a3a', text: 'Bins', size: 20 },
];

export interface DemoPlan {
  runners: Array<{ plan: NpcPlan; label: string }>;
  gang: GroupPlan;
  org: OrgPlan;
  car: PlanVehicle;
  drone: PlanVehicle;
}

/** A car and a drone for the rigger when the generator gave none (generic, mid-range numbers). */
const FALLBACK_CAR: PlanVehicle = { name: 'Compact sedan', category: 'car', drone: false, handling: 4, speed: 120, accel: 8, body: 3, armor: 0, signature: 2, autonav: 1, pilot: 0, sensor: 1 };
const FALLBACK_DRONE: PlanVehicle = { name: 'Rotor drone', category: 'rotor', drone: true, handling: 3, speed: 100, accel: 10, body: 1, armor: 0, signature: 4, autonav: 2, pilot: 2, sensor: 2 };

/** Pure: the whole demo, the same every time. */
export function demoPlan(seed = DEMO_SEED): DemoPlan {
  const r = makeRng(seed);
  const runner = (archetype: string, metatype: string, label: string) => ({ plan: generateNpc({ threat: 3, archetype, metatype, magic: 'auto', role: label }, r), label });
  const runners = [
    runner('merc', 'ork', 'Street samurai'),
    runner('mage', 'elf', 'Mage'),
    runner('decker', 'human', 'Decker'),
    runner('rigger', 'dwarf', 'Rigger'),
  ];
  const gang = generateGroup({ threat: 2, groupKind: 'gang', oneSheet: false }, r);
  const org = generateOrg({ threat: 2, corporation: true }, r);
  const rides = runners[3]!.plan.vehicles ?? [];
  const car = rides.find((v) => !v.drone) ?? FALLBACK_CAR;
  const drone = rides.find((v) => v.drone) ?? FALLBACK_DRONE;
  return { runners, gang, org, car, drone };
}

/** Pure: a runner's display name ("Rook (Street samurai)"). */
export function runnerName(p: NpcPlan, label: string): string {
  const n = String(p.streetName || p.name || label).trim();
  return `${n} (${label})`;
}

/** The door's state when made: locked (Foundry's WALL_DOOR_STATES.LOCKED), so the maglock has to be bypassed. */
export const DEMO_DOOR_LOCKED = 2;

/**
 * Pure: a runner's actor data: the generator's NPC data as a full character, with a Karma Pool to spend and none of
 * the NPC-only ratings (no Morale button, no Professional or Threat Rating).
 */
export function runnerActorData(p: NpcPlan, label: string): { name: string; type: 'character'; system: Record<string, any>; items: any[]; prototypeToken: Record<string, unknown>; flags: Record<string, any> } {
  const d = npcActorData(p);
  const system: Record<string, any> = { ...d.actor.system };
  system['karma'] = { ...(system['karma'] ?? {}), pool: Math.max(3, Number(system['karma']?.pool ?? 0)), poolSpent: 0 };
  system['professionalRating'] = 0;
  system['threatRating'] = 0;
  system['grunts'] = { size: 1, down: 0 };
  return { name: runnerName(p, label), type: 'character', system, items: d.items, prototypeToken: { ...(d.actor.prototypeToken ?? {}), actorLink: true, disposition: 1 }, flags: d.actor.flags ?? {} };
}

/** Pure: a ganger's actor data (an NPC; the leader is marked in the name). */
export function gangerActorData(p: NpcPlan, gang: string, leader: boolean): { name: string; type: string; system: Record<string, any>; items: any[]; prototypeToken: Record<string, unknown>; flags: Record<string, any> } {
  const d = npcActorData(p);
  return { ...d.actor, name: `${p.name} (${gang}${leader ? ', leader' : ''})`, items: d.items, prototypeToken: { ...(d.actor.prototypeToken ?? {}), actorLink: false, disposition: -1 } };
}

/** Pure: the secured building's data: a keypad maglock on the door, a camera, a door alarm, tally steps and a response. */
export function demoSiteSystem(o: { hostUuid: string; sceneId: string; wallId: string }): Record<string, unknown> {
  return {
    hostUuid: o.hostUuid,
    devices: [
      { id: 'demoMaglock0001', name: 'West door maglock', kind: 'maglock', rating: 4, sceneId: o.sceneId, wallId: o.wallId, lockType: 'keypad' },
      { id: 'demoCamera00001', name: 'Lot camera', kind: 'camera', rating: 3, sense: 'visual' },
      { id: 'demoAlarm000001', name: 'Door alarm', kind: 'alarm', rating: 3 },
    ],
    steps: [
      { step: 3, event: tx('SR2E.Text.Demo.aGuardChecksTheCameras'), alert: 'passive' },
      { step: 6, event: tx('SR2E.Text.Demo.theAlarmGoesOffSecurity'), alert: 'active' },
      { step: 9, event: tx('SR2E.Text.Demo.lockdown'), alert: 'lockdown' },
    ],
    response: { round: -1, worldTime: -1, arrived: false, force: tx('SR2E.Text.Demo.twoCorporateSecurityGuardsIn'), turns: 0, minutes: 0 },
  };
}

/** Pure: the "Try this" journal's pages (title + HTML); every name in them is escaped. */
export function demoPages(d: { runners: string[]; gang: string; leader: string; host: string; site: string; safehouse: string; car: string; drone: string; scene: string }): Array<{ name: string; html: string }> {
  const [sam = '', mage = '', decker = '', rigger = ''] = d.runners;
  const p = (s: string) => `<p>${s}</p>`;
  const strong = (s: string) => `<strong>${s}</strong>`;
  const em = (s: string) => `<em>${s}</em>`;
  const keys = (k: string) => `<kbd>Alt</kbd>+<kbd>${k}</kbd>`;
  const setup = strong(tx('SR2E.Text.Demo.setup'));
  return [
    { name: tx('SR2E.Text.Demo.startHere'), html: [
      p(tx('SR2E.Text.Demo.thisDemoShowsTheSr2e', { sam: strong(esc(sam)), mage: strong(esc(mage)), decker: strong(esc(decker)), rigger: strong(esc(rigger)), gang: strong(esc(d.gang)), host: strong(esc(d.host)), site: strong(esc(d.site)), safehouse: strong(esc(d.safehouse)), scene: strong(esc(d.scene)) })),
      p(tx('SR2E.Text.Demo.openTheSceneFromThe', { view: em(tx('SR2E.Text.Demo.view')), activate: em(tx('SR2E.Text.Demo.activate')) })),
      p(tx('SR2E.Text.Demo.toLetPlayersTryIt', { keys: keys('G'), setup, players: em(tx('SR2E.Text.Demo.playersAndCharacters')) })),
      p(tx('SR2E.Text.Demo.thePagesOfThisJournal', { keys: keys('H') })),
      p(tx('SR2E.Text.Demo.whenYouAreDoneGm', { setup, remove: strong(tx('SR2E.Text.Demo.removeTheDemo')) })),
    ].join('') },
    { name: tx('SR2E.Text.Demo.aFight'), html: [
      p(tx('SR2E.Text.Demo.theGangWaitsInThe', { sam: esc(sam), key: '<kbd>T</kbd>' })),
      p(tx('SR2E.Text.Demo.startACombatSelectThe', { begin: em(tx('SR2E.Text.Demo.beginCombat')), keys: keys('I') })),
      p(tx('SR2E.Text.Demo.onSSheetPress', { sam: esc(sam), attack: strong(tx('SR2E.Text.Demo.attack')), defend: strong(tx('SR2E.Text.Demo.defend')), resist: strong(tx('SR2E.Text.Demo.resist')) })),
      p(tx('SR2E.Text.Demo.tryTheCombatPoolA')),
    ].join('') },
    { name: tx('SR2E.Text.Demo.aSpell'), html: [
      p(tx('SR2E.Text.Demo.knowsAFewSpells', { mage: esc(mage), drain: strong(tx('SR2E.Text.Demo.drain')) })),
      p(tx('SR2E.Text.Demo.sustainASpellToSee')),
    ].join('') },
    { name: tx('SR2E.Text.Demo.theMatrix'), html: [
      p(tx('SR2E.Text.Demo.hasACyberdeck', { decker: esc(decker), jackIn: strong(tx('SR2E.Text.Demo.jackIn')), host: strong(esc(d.host)) })),
      p(tx('SR2E.Text.Demo.eachSystemOperationIsA')),
    ].join('') },
    { name: tx('SR2E.Text.Demo.riggingAndAChase'), html: [
      p(tx('SR2E.Text.Demo.hasAControlRig', { rigger: esc(rigger), car: strong(esc(d.car)), drone: strong(esc(d.drone)), configure: em(tx('SR2E.Text.Demo.configureOwnership')) })),
      p(tx('SR2E.Text.Demo.onTheSheetSRigging', { takeControls: strong(tx('SR2E.Text.Demo.takeTheControls')), subscribe: strong(tx('SR2E.Text.Demo.subscribeADrone')) })),
      p(tx('SR2E.Text.Demo.jumpedInTheRiggerUses', { giveChase: strong(tx('SR2E.Text.Demo.giveChase')) })),
    ].join('') },
    { name: tx('SR2E.Text.Demo.securityAndTheSafehouse'), html: [
      p(tx('SR2E.Text.Demo.theBuildingOnTheRight', { site: strong(esc(d.site)) })),
      p(tx('SR2E.Text.Demo.toGetInUseThe', { bypass: strong(tx('SR2E.Text.Demo.bypass')), decker: esc(decker), rigger: esc(rigger) })),
      p(tx('SR2E.Text.Demo.theRunnersSafehouseIs', { safehouse: strong(esc(d.safehouse)) })),
    ].join('') },
    { name: tx('SR2E.Text.Demo.printingAndReporting'), html: [
      p(tx('SR2E.Text.Demo.everyCharacterSheetHasA', { print: strong(tx('SR2E.Text.Demo.print')) })),
      p(tx('SR2E.Text.Demo.foundABugTheGuide', { report: strong(tx('SR2E.Text.Demo.reportABug')) })),
    ].join('') },
  ];
}
