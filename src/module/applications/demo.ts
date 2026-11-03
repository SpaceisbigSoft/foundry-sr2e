/**
 * v0.88.0: the starter demo (the Foundry glue for `rules/demo.ts`). GM panel, Setup tab: **Create the demo** builds
 * the runners, the gang, the host, the secured building, the safehouse, the rigger's car and drone, the scene (walls,
 * a maglocked door, lamps, tokens) and the "Try this" journal, all in folders named "Demo (SR2e)" and flagged
 * `flags.sr2e.demo`. **Remove the demo** deletes exactly what carries that flag (and the combats on its scene).
 * Also `game.sr2e.api.createDemo()` / `removeDemo()`.
 */
import { SYSTEM } from '../config/system.ts';
import { vehicleActorData, hostActorData } from '../rules/npcgen.ts';
import { demoPlan, demoPages, runnerActorData, gangerActorData, demoSiteSystem, DEMO_DOOR_LOCKED, DEMO_FLAG, DEMO_FOLDER, DEMO_SCENE, DEMO_SPOTS, DEMO_WALLS, DEMO_DOOR, DEMO_LIGHTS, DEMO_DRAWINGS } from '../rules/demo.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

const esc = escHtml;
const FLAG = { [SYSTEM.id]: { [DEMO_FLAG]: true } };
/**
 * A document the demo made: it carries the demo's flag and isn't a copy (a duplicated or imported document keeps the
 * flag; v0.88.0 review: Remove leaves those alone).
 */
export const isDemo = (d: any): boolean => Boolean(d?.flags?.[SYSTEM.id]?.[DEMO_FLAG] ?? d?.getFlag?.(SYSTEM.id, DEMO_FLAG))
  && !d?._stats?.duplicateSource && !d?._stats?.compendiumSource;
/** One create or remove at a time on this client (the API and the button). */
let busy: Promise<string> | null = null;
const exclusive = (fn: () => Promise<string>): Promise<string> => {
  if (busy) return Promise.resolve(tx('SR2E.App.Demo.theDemoIsBeingChangedAlready'));
  busy = fn().finally(() => { busy = null; });
  return busy;
};

/** Everything the demo made in this world, by kind. */
export function demoDocuments(): { actors: any[]; scenes: any[]; journal: any[]; folders: any[]; combats: any[] } {
  const g: any = game;
  const scenes = [...(g.scenes ?? [])].filter(isDemo);
  const sceneIds = new Set(scenes.map((s: any) => s.id));
  return {
    actors: [...(g.actors ?? [])].filter(isDemo),
    scenes,
    journal: [...(g.journal ?? [])].filter(isDemo),
    folders: [...(g.folders ?? [])].filter(isDemo),
    combats: [...(g.combats ?? [])].filter((c: any) => sceneIds.has(c.scene?.id ?? c.scene)),
  };
}

export function demoExists(): boolean {
  const d = demoDocuments();
  return d.actors.length + d.scenes.length + d.journal.length > 0;
}

async function folderFor(type: string): Promise<string> {
  const F: any = (globalThis as any).Folder;
  const f = await F.create({ name: DEMO_FOLDER, type, color: '#3a6ea5', flags: FLAG });
  return f?.id ?? '';
}

/** Build the demo. Returns a one-line summary (or why it didn't). */
export function createDemo(): Promise<string> { return exclusive(buildDemo); }

async function buildDemo(): Promise<string> {
  const g: any = game;
  if (!g.user?.isGM) return tx('SR2E.App.Demo.onlyTheGmCanCreateThe');
  if (demoExists()) return tx('SR2E.App.Demo.theDemoIsAlreadyInThis');
  const plan = demoPlan();
  const A: any = CONFIG.Actor.documentClass;
  const actorFolder = await folderFor('Actor');
  const withFolder = (x: any) => ({ ...x, folder: actorFolder, flags: { ...(x.flags ?? {}), [SYSTEM.id]: { ...(x.flags?.[SYSTEM.id] ?? {}), [DEMO_FLAG]: true } } });

  // The runners: full characters (linked tokens); the gang: the leader and three of the rank and file (unlinked NPCs).
  const runnerData = plan.runners.map(({ plan: p, label }) => withFolder(runnerActorData(p, label)));
  const gangData = [plan.gang.leader, ...plan.gang.grunts.slice(0, 3)].map((p, i) => withFolder(gangerActorData(p, plan.gang.name, i === 0)));
  const people: any[] = (await A.createDocuments([...runnerData, ...gangData])) ?? [];
  const byName = (n: string) => people.find((a: any) => a.name === n);
  const runners = runnerData.map((d) => byName(d.name)).filter(Boolean);
  const gang = gangData.map((d) => byName(d.name)).filter(Boolean);
  const rigger = runners[3];

  // The rigger's car and drone (owned like the rigger, linked tokens), the drone subscribed.
  const rides: any[] = (await A.createDocuments([plan.car, plan.drone].map((v) => {
    const d = vehicleActorData(v);
    return withFolder({ ...d, name: `${d.name} (${plan.runners[3]!.plan.streetName || 'the rigger'}'s)`, prototypeToken: { actorLink: true, disposition: 1 } });
  }))) ?? [];
  const [car, drone] = rides;
  if (rigger && drone) {
    try { await rigger.update({ 'system.rigging.subscribed': [drone.uuid] }); } catch (err) { console.warn('sr2e | demo drone', err); }
  }

  // The corporation's host (with its generated security sheaf).
  const host: any = await A.create(withFolder({ ...hostActorData(plan.org), name: `${plan.org.name} host` }));

  // The scene: the lot, the building, the door, lamps.
  const S: any = (globalThis as any).Scene;
  const sceneFolder = await folderFor('Scene');
  const scene: any = await S.create({
    name: DEMO_SCENE.name, folder: sceneFolder, flags: FLAG, navigation: true,
    // No padding: the coordinates in rules/demo.ts are the scene's own.
    width: DEMO_SCENE.width, height: DEMO_SCENE.height, padding: 0, backgroundColor: DEMO_SCENE.background,
    grid: { type: 1, size: DEMO_SCENE.grid, distance: 1, units: 'm' },
    tokenVision: true, fog: { exploration: false },
    environment: { darknessLevel: DEMO_SCENE.darkness, globalLight: { enabled: false } },
  });
  // Foundry v14 keeps the background colour on the scene's level.
  try {
    const level: any = scene.levels?.contents?.[0];
    if (level) await scene.updateEmbeddedDocuments('Level', [{ _id: level.id, 'background.color': DEMO_SCENE.background }]);
  } catch (err) { console.warn('sr2e | demo scene colour', err); }
  await scene.createEmbeddedDocuments('Drawing', DEMO_DRAWINGS.map((d, i) => ({
    x: d.x, y: d.y, shape: { type: 'r', width: d.w, height: d.h }, fillType: 1, fillColor: d.fill, fillAlpha: 1,
    strokeWidth: d.stroke ? 6 : 0, strokeColor: d.stroke ?? d.fill, text: d.text, fontSize: d.size, textColor: '#a8b2c0', textAlpha: 0.8, sort: i,
  })));
  const walls = DEMO_WALLS.map((c) => ({ c }));
  const made: any[] = (await scene.createEmbeddedDocuments('Wall', [...walls, { c: DEMO_DOOR, door: 1, ds: DEMO_DOOR_LOCKED }])) ?? [];
  const door = made.find((w: any) => Number(w.door) === 1);
  await scene.createEmbeddedDocuments('AmbientLight', DEMO_LIGHTS.map((l) => ({ x: l.x, y: l.y, config: { dim: l.dim, bright: l.bright, color: '#ffd9a0', alpha: 0.25 } })));

  // The secured building: a maglock on the door, a camera and an alarm; its host is the corporation's.
  const site: any = await A.create(withFolder({ name: `${plan.org.name} branch office`, type: 'site', system: demoSiteSystem({ hostUuid: host?.uuid ?? '', sceneId: scene.id, wallId: door?.id ?? '' }) }));

  // The runners' safehouse.
  const safehouse: any = await A.create(withFolder({ name: 'The runners\' flat', type: 'safehouse', system: {
    location: 'lowRent', size: 'apartment', owners: runners.map((a: any) => a.uuid), residents: runners.map((a: any) => a.uuid),
    notes: '<p>A cramped flat above a noodle shop. Made by the demo.</p>',
  } }));

  // Tokens on the scene.
  const tokenAt = async (a: any, at: { x: number; y: number }) => ({ ...(await a.getTokenDocument({ x: at.x, y: at.y })).toObject() });
  const tokens: any[] = [];
  for (const [i, a] of runners.entries()) tokens.push(await tokenAt(a, DEMO_SPOTS.runners[i]!));
  for (const [i, a] of gang.entries()) tokens.push(await tokenAt(a, DEMO_SPOTS.gang[i] ?? DEMO_SPOTS.gang[0]!));
  if (car) tokens.push(await tokenAt(car, DEMO_SPOTS.car));
  if (drone) tokens.push(await tokenAt(drone, DEMO_SPOTS.drone));
  await scene.createEmbeddedDocuments('Token', tokens);

  // The journal.
  const J: any = (globalThis as any).JournalEntry;
  const journalFolder = await folderFor('JournalEntry');
  const pages = demoPages({
    runners: runners.map((a: any) => a.name), gang: plan.gang.name, leader: gang[0]?.name ?? '', host: host?.name ?? '', site: site?.name ?? '',
    safehouse: safehouse?.name ?? '', car: car?.name ?? '', drone: drone?.name ?? '', scene: scene.name,
  });
  const entry: any = await J.create({ name: 'SR2e demo: try this', folder: journalFolder, flags: FLAG, ownership: { default: 2 },
    pages: pages.map((p, i) => ({ name: p.name, type: 'text', sort: (i + 1) * 100, text: { content: p.html, format: 1 } })) });
  try { entry?.sheet?.render?.({ force: true }); } catch { /* no sheet */ }
  return tx('SR2E.App.Demo.createdTheDemoRunnersGangers', { runners: runners.length, gangers: gang.length, scene: scene.name, journal: entry?.name ?? '' });
}

/** Remove everything the demo made (asks first). Returns a one-line summary. */
export function removeDemo(opts: { confirm?: boolean } = {}): Promise<string> { return exclusive(() => takeOut(opts)); }

async function takeOut(opts: { confirm?: boolean }): Promise<string> {
  const g: any = game;
  if (!g.user?.isGM) return tx('SR2E.App.Demo.onlyTheGmCanRemoveThe');
  const d = demoDocuments();
  const n = d.actors.length + d.scenes.length + d.journal.length;
  if (!n && !d.folders.length) return tx('SR2E.App.Demo.thereIsNoDemoInThis');
  if (opts.confirm !== false) {
    const ok = await (foundry as any).applications.api.DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Demo.removeTheDemo') }, classes: ['sr2e-dialog'],
      content: `<p>${d.combats.length ? tx('SR2E.Dialog.Demo.deleteEverythingTheDemoMadeActorsAndCombats', { actorsLength: esc(d.actors.length), scenesLength: tCount(Number(d.scenes.length), 'SR2E.Count.scene'), journalLength: tCount(Number(d.journal.length), 'SR2E.Count.journalEntry'), combatsLength: tCount(Number(d.combats.length), 'SR2E.Count.combat') }) : tx('SR2E.Dialog.Demo.deleteEverythingTheDemoMadeActors', { actorsLength: esc(d.actors.length), scenesLength: tCount(Number(d.scenes.length), 'SR2E.Count.scene'), journalLength: tCount(Number(d.journal.length), 'SR2E.Count.journalEntry') })}</p>`,
    });
    if (!ok) return '';
  }
  const del = async (cls: any, docs: any[]) => { if (docs.length) await cls.deleteDocuments(docs.map((x: any) => x.id)); };
  const G: any = globalThis;
  await del(G.Combat, d.combats);
  // Demo actors' tokens dropped on other scenes go too (they would point at deleted actors).
  const ids = new Set(d.actors.map((a: any) => a.id));
  for (const sc of [...(g.scenes ?? [])].filter((x: any) => !isDemo(x))) {
    const toks = [...(sc.tokens ?? [])].filter((t: any) => ids.has(t.actorId)).map((t: any) => t.id);
    if (toks.length) await sc.deleteEmbeddedDocuments('Token', toks);
  }
  await del(CONFIG.Actor.documentClass, d.actors);
  await del(G.Scene, d.scenes);
  await del(G.JournalEntry, d.journal);
  await del(G.Folder, demoDocuments().folders);
  return tx('SR2E.App.Demo.removedTheDemoDocuments', { n });
}
