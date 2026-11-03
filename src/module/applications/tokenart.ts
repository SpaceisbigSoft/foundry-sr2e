/**
 * v0.83.0: the default token art, Foundry side. New actors that still have Foundry's stand-in picture get the
 * system's own picture and token (rules/tokenart.ts picks the file); later changes (metatype, figure, archetype,
 * a control rig or cyberdeck added, a vehicle's category, a spirit's kind) swap it while the picture or token is
 * still the exact file the system put there (flags.sr2e.artAuto). A picture set by hand or found by name
 * ("Portraits by name", which wins) is never touched. Follow-ups run on the active GM's client, which also updates
 * the actor's linked tokens on the map (a player's own change with no GM online updates the actor only). Existing actors keep what they have until someone presses "Use the default art" on the sheet or the
 * GM's Setup button.
 */
import { SYSTEM } from '../config/system.ts';
import { defaultArtFor, isDefaultArt, isDefaultPortrait, figureFromName, isArtFigure, archetypeFor, ARCHETYPE_LABELS, ART_ARCHETYPES, FIGURE_LABELS, ART_FIGURES } from '../rules/index.ts';
import type { ArtInfo } from '../rules/index.ts';
import { isLeadGm } from './leader.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

const ID = SYSTEM.id;
const PEOPLE = ['character', 'npc'];

function on(): boolean {
  try { return game.settings.get(ID, 'defaultArt') !== false; } catch { return true; }
}

/** Foundry's own stand-in pictures (and the system's default icon, if it sets one). */
function standIns(): string[] {
  return [String((globalThis as any).CONFIG?.Actor?.documentClass?.DEFAULT_ICON ?? ''), String((globalThis as any).CONST?.DEFAULT_TOKEN ?? '')].filter(Boolean);
}

/**
 * Whether a picture may be replaced: 'auto' only the default art the system put there itself (flags.sr2e.artAuto:
 * a system art file someone picked by hand is theirs); 'standin' also Foundry's stand-ins; 'force' anything.
 */
function replaceable(src: unknown, mode: 'auto' | 'standin' | 'force', auto: string): boolean {
  if (mode === 'force') return true;
  const s = String(src ?? '');
  if (s && auto && s === auto && isDefaultArt(s)) return true;
  return mode === 'standin' && isOnlyStandIn(s);
}

/** Foundry's stand-in itself (not the system's art, which isDefaultPortrait also counts for Portraits by name). */
function isOnlyStandIn(src: unknown): boolean {
  const s = String(src ?? '');
  return isDefaultPortrait(s, standIns()) && !isDefaultArt(s);
}

/** The default art this system last set on an actor ('' = none). */
function autoOf(actor: any): string { return String(actor?.flags?.[ID]?.artAuto ?? ''); }

const REFLEX = ['wired', 'boosted', 'synaptic'];

/** What the art depends on, read off an actor (or a pending one, in preCreate). */
export function artInfo(actor: any): ArtInfo {
  const sys = actor?.system ?? {};
  const items: any[] = [...(actor?.items ?? [])];
  const ware = items.filter((i) => i.type === 'cyberware' && i.system?.installed !== false);
  const attrs: Record<string, number> = {};
  for (const [k, v] of Object.entries(sys.attributes ?? {})) attrs[k] = Number((v as any)?.base ?? 0) + Number((v as any)?.mod ?? 0);
  const fl = actor?.flags?.[ID] ?? {};
  return {
    type: String(actor?.type ?? ''), name: String(actor?.name ?? ''), metatype: sys.metatype,
    figure: sys.art?.figure ?? '', archetype: sys.art?.archetype ?? '',
    generated: String(fl.generated?.archetype ?? ''), critter: Boolean(fl.critter),
    tradition: sys.tradition,
    hasDeck: items.some((i) => i.type === 'cyberdeck'),
    hasControlRig: ware.some((i) => Number(i.system?.controlRig ?? 0) > 0),
    combatWare: ware.some((i) => REFLEX.includes(String(i.system?.reflexes ?? '')) || i.system?.kind === 'cyberweapon' || i.system?.kind === 'reflexes'
      // Reflexes left as "guess from the name" (imported ware), and muscle replacement.
      || /wired reflex|boosted reflex|reflex enhancer|muscle replacement/i.test(String(i.name ?? ''))),
    attributes: attrs,
    spiritKind: sys.spiritKind, spiritType: sys.spiritType, element: sys.element,
    category: sys.category, drone: Boolean(sys.drone), icCategory: sys.category,
  };
}

/** The default picture for an actor as it stands (null for a type with none). */
export function defaultArtOf(actor: any): string | null {
  return defaultArtFor(artInfo(actor));
}

/**
 * Gives an actor its default art where its picture and token are replaceable (see `replaceable`), and the
 * linked tokens on the map (GM only). Returns true when something changed.
 */
export async function applyDefaultArt(actor: any, mode: 'auto' | 'standin' | 'force' = 'auto'): Promise<boolean> {
  // Unlinked token actors keep their own picture (the token's), like the tokens placed before.
  if (!actor?.isOwner || actor.isToken) return false;
  const info = artInfo(actor);
  const auto = autoOf(actor);
  const upd: Record<string, unknown> = {};
  const person = PEOPLE.includes(actor.type) && !info.critter && !String(info.generated).startsWith('critter:');
  // A person without a stored figure gets the one the name picks; it is stored along with the art (so a rename won't flip it).
  if (person && !isArtFigure(info.figure)) info.figure = figureFromName(actor.name);
  const path = defaultArtFor(info);
  if (!path) return false;
  const old = { img: String(actor.img ?? ''), token: String(actor.prototypeToken?.texture?.src ?? '') };
  if (old.img !== path && replaceable(old.img, mode, auto)) upd['img'] = path;
  if (old.token !== path && replaceable(old.token, mode, auto)) upd['prototypeToken.texture.src'] = path;
  // Nothing to show: an actor with pictures of its own is left alone (no figure written either).
  if (!('img' in upd) && !('prototypeToken.texture.src' in upd)) return false;
  if (person && !isArtFigure(actor.system?.art?.figure)) upd['system.art.figure'] = info.figure;
  upd[`flags.${ID}.artAuto`] = path;
  // Foundry copies a new actor picture onto a prototype token still showing the old one: keep a custom token as it is.
  const pin = 'img' in upd && !('prototypeToken.texture.src' in upd) && !!old.token;
  if (pin) upd['prototypeToken.texture.src'] = old.token;
  // Linked tokens on the map that showed the stand-in or the old default art ('force': also the old pictures).
  const was = [auto, ...(mode === 'force' ? [old.token, old.img] : [])].filter(Boolean);
  await actor.update(upd, { sr2eNoAdvance: true, sr2eArt: true, sr2eArtWas: was, ...(pin ? { diff: false } : {}) });
  // The GM updates them at once; a player's update is picked up by the active GM's updateActor hook.
  if ((game as any).user?.isGM && 'prototypeToken.texture.src' in upd && !pin) await syncPlaced(actor, path, was);
  return true;
}

/**
 * GM: points the actor's linked tokens on the map at its default art, where they show Foundry's stand-in or one of
 * the pictures in `was`. Only ever writes `path`, the actor's own default art (checked by the caller).
 */
async function syncPlaced(actor: any, path: string, was: unknown[]): Promise<void> {
  const old = new Set(was.map((x) => String(x ?? '')).filter(Boolean));
  for (const scene of (game as any).scenes ?? []) {
    const mine = [...(scene.tokens ?? [])].filter((t: any) => t.actorId === actor.id && t.actorLink && t.texture?.src !== path
      && (isOnlyStandIn(t.texture?.src) || old.has(String(t.texture?.src ?? ''))));
    if (mine.length) await scene.updateEmbeddedDocuments('Token', mine.map((t: any) => ({ _id: t.id, 'texture.src': path })));
  }
}

/** GM: gives the default art to every actor still showing a stand-in (and refreshes default art the system set). Returns how many changed. */
export async function defaultArtForAll(): Promise<number> {
  if (!(game as any).user?.isGM) { ui.notifications?.warn(tx('SR2E.Notify.Tokenart.onlyTheGmCanDoThis')); return 0; }
  let n = 0;
  for (const a of (game as any).actors ?? []) { if (await applyDefaultArt(a, 'standin')) n++; }
  ui.notifications?.info(n ? tx('SR2E.Notify.Tokenart.defaultArtGivenToActor', { n: tCount(n, 'SR2E.Count.actor') }) : tx('SR2E.Notify.Tokenart.everyActorAlreadyHasItsOwn'));
  return n;
}

/** How many actors still show a stand-in picture or token (for the GM panel). */
export function standInCount(): number {
  return [...((game as any).actors ?? [])].filter((a: any) => defaultArtOf(a) && (isOnlyStandIn(a.img) || isOnlyStandIn(a.prototypeToken?.texture?.src))).length;
}

/** The sheet's "Picture and token" controls for a character or NPC. */
export function artSheetContext(actor: any): {
  show: boolean; src: string; isDefault: boolean; standIn: boolean; figures: Array<{ id: string; label: string; selected: boolean }>;
  archetypes: Array<{ id: string; label: string; selected: boolean }>;
} | null {
  if (!PEOPLE.includes(actor?.type)) return null;
  const info = artInfo(actor);
  if (info.critter || String(info.generated).startsWith('critter:')) return null;
  const fig = String(info.figure ?? '');
  const arch = String(info.archetype ?? '');
  const auto = archetypeFor({ ...info, archetype: '' });
  const autoLabel = auto ? ARCHETYPE_LABELS[auto] : tx('SR2E.App.Tokenart.none');
  return {
    show: true, src: defaultArtFor(info) ?? '',
    standIn: isOnlyStandIn(actor.img),
    isDefault: !!autoOf(actor) && (actor.img === autoOf(actor) || actor.prototypeToken?.texture?.src === autoOf(actor)),
    figures: [
      ...(isArtFigure(fig) ? [] : [{ id: '', label: tx('SR2E.App.Tokenart.fromTheName', { figure: FIGURE_LABELS[figureFromName(actor.name)] }), selected: true }]),
      ...ART_FIGURES.map((f) => ({ id: f, label: FIGURE_LABELS[f], selected: fig === f })),
    ],
    archetypes: [
      { id: '', label: tx('SR2E.App.Tokenart.automatic', { auto: autoLabel }), selected: !arch },
      { id: 'none', label: 'None', selected: arch === 'none' },
      ...ART_ARCHETYPES.map((a) => ({ id: a, label: ARCHETYPE_LABELS[a], selected: arch === a })),
    ],
  };
}

/** The sheet button: the default art for this actor, asking first when it has a picture of its own. */
const busy = new Set<string>();
export async function useDefaultArt(actor: any): Promise<void> {
  if (!actor?.isOwner) return;
  // A double click opens one confirm, not two.
  const key = String(actor.uuid ?? actor.id);
  if (busy.has(key)) return;
  busy.add(key);
  try { await useDefaultArtNow(actor); } finally { busy.delete(key); }
}

async function useDefaultArtNow(actor: any): Promise<void> {
  if (actor.isToken) { ui.notifications?.info(tx('SR2E.Notify.Tokenart.anUnlinkedTokenKeepsItsOwn')); return; }
  const path = defaultArtOf(actor);
  if (!path) return;
  const auto = autoOf(actor);
  const custom = !replaceable(actor.img, 'standin', auto) || !replaceable(actor.prototypeToken?.texture?.src, 'standin', auto);
  if (custom) {
    const ok = await (foundry as any).applications.api.DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Tokenart.useTheDefaultArt') }, classes: ['sr2e-dialog'],
      content: `<p>${tx('SR2E.Dialog.Tokenart.thisReplacesThePictureAndToken')}</p>`,
    });
    if (!ok) return;
  }
  await applyDefaultArt(actor, 'force');
}

/** Paths in an update that can change the art. */
function touchesArt(change: any): boolean {
  const s = change?.system ?? {};
  return 'metatype' in s || 'art' in s || 'tradition' in s || 'attributes' in s || 'spiritKind' in s || 'spiritType' in s || 'element' in s
    || 'category' in s || 'drone' in s || change?.flags?.[ID]?.critter !== undefined || change?.flags?.[ID]?.generated !== undefined;
}

export function registerDefaultArtSettings(): void {
  game.settings.register(ID, 'defaultArt', {
    name: "SR2E.Settings.defaultArt.Name",
    hint: "SR2E.Settings.defaultArt.Hint",
    scope: 'world', config: true, type: Boolean, default: true, restricted: true,
  } as any);
}

/** The client that follows a change: the active GM (who can also update the tokens on the map), else the changing user. */
function handles(userId: string): boolean {
  const gm = (game as any).users?.activeGM;
  return gm ? isLeadGm() : userId === (game as any).user?.id;
}

/** Follow-ups are batched per actor (a kit or an import adds many items at once): one update after the burst. */
const pending = new Map<string, ReturnType<typeof setTimeout>>();
function followUp(actor: any): void {
  const key = String(actor?.uuid ?? actor?.id ?? '');
  if (!key) return;
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => {
    pending.delete(key);
    // Checked again now: a deleted actor, or a portrait found by name (or a hand-set picture) in the meantime, wins.
    if ((game as any).actors?.get?.(actor.id) !== actor || !showsAuto(actor)) return;
    applyDefaultArt(actor, 'auto').catch((err) => console.warn('sr2e | default art:', err));
  }, 100));
}

/** Whether the system's art is still on the actor's picture or token. */
function showsAuto(actor: any): boolean {
  const auto = autoOf(actor);
  return !!auto && (actor.img === auto || actor.prototypeToken?.texture?.src === auto);
}

export function registerDefaultArt(): void {
  Hooks.on('preCreateActor', (actor: any, data: any) => {
    if (!on()) return;
    const info = artInfo(actor);
    const set: Record<string, unknown> = {};
    const person = PEOPLE.includes(actor.type) && !info.critter && !String(info.generated).startsWith('critter:');
    if (person && !isArtFigure(info.figure)) info.figure = figureFromName(actor.name);
    const path = defaultArtFor(info);
    if (!path) return;
    // The pending actor's own source (after Foundry's own preparation), then the creation data.
    const img = actor.img ?? data?.img;
    const tok = actor.prototypeToken?.texture?.src ?? data?.prototypeToken?.texture?.src;
    if (!img || isOnlyStandIn(img)) set['img'] = path;
    if (!tok || isOnlyStandIn(tok)) set['prototypeToken.texture.src'] = path;
    if (!Object.keys(set).length) return;
    if (person && !isArtFigure(actor.system?.art?.figure)) set['system.art.figure'] = info.figure;
    set[`flags.${ID}.artAuto`] = path;
    actor.updateSource(set);
  });
  Hooks.on('updateActor', (actor: any, change: any, o: any, userId: string) => {
    // A player's own art change (their sheet button, or a follow-up with no GM): the active GM updates the linked tokens.
    if (o?.sr2eArt && userId !== (game as any).user?.id && isLeadGm() && change?.prototypeToken?.texture?.src && !actor?.isToken) {
      const path = defaultArtOf(actor);
      if (path && actor.prototypeToken?.texture?.src === path) void syncPlaced(actor, path, Array.isArray(o.sr2eArtWas) ? o.sr2eArtWas : []);
      return;
    }
    if (o?.sr2eArt || o?.sr2ePortrait || actor?.isToken || !handles(userId) || !on() || !touchesArt(change) || !showsAuto(actor)) return;
    followUp(actor);
  });
  // A control rig, cyberdeck or wired reflexes added or taken out changes the automatic archetype.
  const itemHook = (item: any, userId: string) => {
    const actor = item?.parent;
    if (!actor || actor.documentName !== 'Actor' || actor.isToken || !handles(userId) || !on()) return;
    if (!['cyberware', 'cyberdeck'].includes(item.type) || !PEOPLE.includes(actor.type)) return;
    if (String(actor.system?.art?.archetype ?? '') !== '' || !showsAuto(actor)) return;
    followUp(actor);
  };
  Hooks.on('createItem', (item: any, _o: any, userId: string) => itemHook(item, userId));
  Hooks.on('deleteItem', (item: any, _o: any, userId: string) => itemHook(item, userId));
  Hooks.on('updateItem', (item: any, change: any, _o: any, userId: string) => {
    const s = change?.system ?? {};
    if ('installed' in s || 'controlRig' in s || 'reflexes' in s || 'kind' in s || 'name' in (change ?? {})) itemHook(item, userId);
  });
}
