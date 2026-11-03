/**
 * v0.60.0: the rest of the Foundry quality of life: turn pings, hover cards with pools, sound cues,
 * dragging items to chat and off purchase cards, compendium export and import of item templates, and
 * the hooks and API other modules use.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES, SOUND_EVENTS, hoverLines, turnChanged, turnRecipients, itemDragData, trackBar, type ItemTemplate } from '../rules/index.ts';
import { postItemToChat } from './richtext.ts';
import { escHtml } from '../rules/html.ts';
import { madeHere } from './leader.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;

function setting<T>(key: string, fallback: T): T {
  try { const v = (game as any).settings.get(SYSTEM_ID, key); return (v ?? fallback) as T; } catch { return fallback; }
}

// ---------------------------------------------------------------- sound cues

/** Play an event's sound on this client, if the player turned sound cues on (setting `soundCues`). */
export function playCue(id: string): void {
  if (!setting('soundCues', false)) return;
  const ev = SOUND_EVENTS.find((e) => e.id === id);
  if (!ev) return;
  const src = String(setting(`sound.${id}`, ev.src) ?? '').trim();
  if (!src) return;
  const volume = Math.max(0, Math.min(1, Number(setting('soundVolume', 0.6))));
  try {
    const AH: any = (foundry as any).audio?.AudioHelper ?? (globalThis as any).AudioHelper;
    void AH?.play?.({ src, volume, autoplay: true, loop: false }, false);
  } catch (err) { console.warn('sr2e | sound', err); }
}

// ---------------------------------------------------------------- turn pings

function onTurn(combat: any, change: any): void {
  if (!combat?.started || !turnChanged(change, SYSTEM_ID)) return;
  if (combat.id !== (game as any).combat?.id) return;
  // Let the turn list settle (a new pass re-sorts it).
  setTimeout(() => {
    const c: any = combat.combatant;
    const actor: any = c?.actor;
    if (!c || !actor) return;
    const users: any[] = [...((game as any).users ?? [])];
    const me: any = (game as any).user;
    const mine = turnRecipients(users.map((u: any) => ({ id: u.id, active: Boolean(u.active), isGM: Boolean(u.isGM), owns: Boolean(actor.testUserPermission?.(u, 'OWNER')) }))).includes(me?.id);
    const token: any = c.token?.object ?? null;
    if (setting('turnPing', true) && token?.visible && (globalThis as any).canvas?.ping && token.document?.parent?.id === (globalThis as any).canvas?.scene?.id) {
      try { void (globalThis as any).canvas.ping(token.center, { color: me?.color?.css ?? me?.color, duration: 900 }); } catch { /* no canvas */ }
    }
    if (mine && setting('turnPing', true)) {
      ui.notifications?.info?.(tx('SR2E.Notify.Qol.yourTurn', { name: escHtml(c.name) }));
      playCue('turn');
    }
  }, 150);
}

// ---------------------------------------------------------------- hover cards

let hoverEl: HTMLElement | null = null;

function hideHover(): void { if (hoverEl) { hoverEl.remove(); hoverEl = null; } }

/** The lines a token's hover card shows (owners and the GM). */
export function tokenHoverLines(token: any): string[] {
  const actor: any = token?.actor;
  if (!actor || !(actor.isOwner || (game as any).user?.isGM)) return [];
  const sys = actor.system ?? {};
  const combat: any = (game as any).combat;
  const c: any = combat?.started ? [...(combat.combatants ?? [])].find((x: any) => x.tokenId === token.id || x.token?.id === token.document?.id) : null;
  const people = ['character', 'npc', 'spirit'].includes(actor.type);
  return hoverLines({
    name: actor.name,
    derived: sys.derived ?? {},
    karmaPool: Number(sys.karma?.pool ?? 0),
    initiative: c ? c.initiative ?? null : null,
    pass: c ? Number(combat.pass ?? 0) : null,
    fullDefense: Boolean(actor.fullDefenseUp?.()),
    delaying: Boolean(actor.isDelaying?.()),
    monitor: people ? { physical: Number(sys.monitor?.physical ?? 0), stun: Number(sys.monitor?.stun ?? 0), physicalMax: RULES.TOKENS.monitorBoxes, stunMax: RULES.TOKENS.monitorBoxes } : undefined,
    condition: actor.type === 'vehicle' ? { value: Number(sys.condition ?? 0), max: RULES.VEHICLES.conditionBoxes } : null,
    matrix: people && sys.matrix ? { value: Number(sys.matrix.monitor ?? 0), max: RULES.MATRIX.monitorBoxes } : null,
  });
}

function showHover(token: any): void {
  hideHover();
  if (!setting('hoverCard', true)) return;
  const lines = tokenHoverLines(token);
  if (!lines.length) return;
  const cv: any = (globalThis as any).canvas;
  let pos: { x: number; y: number } | null = null;
  try { pos = cv?.clientCoordinatesFromCanvas?.({ x: token.x + token.w, y: token.y }) ?? null; } catch { pos = null; }
  if (!pos) return;
  const el = document.createElement('div');
  el.id = 'sr2e-hover-card';
  el.className = 'sr2e-hover-card';
  el.innerHTML = `<strong>${esc(token.name)}</strong>${lines.map((l) => `<div>${esc(l)}</div>`).join('')}`;
  el.style.left = `${Math.round(pos.x + 8)}px`;
  el.style.top = `${Math.round(pos.y)}px`;
  document.body.appendChild(el);
  hoverEl = el;
}

// ---------------------------------------------------------------- dragging items to chat and off cards

/** A dropped item (from a sheet, a compendium or a chat card) goes to chat as an item card. */
async function onChatDrop(ev: DragEvent): Promise<void> {
  let data: any = null;
  try { data = JSON.parse(ev.dataTransfer?.getData('text/plain') ?? ''); } catch { return; }
  if (data?.type !== 'Item' || !data.uuid) return;
  ev.preventDefault();
  const item: any = await (globalThis as any).fromUuid?.(data.uuid);
  if (!item) return void ui.notifications?.warn?.(tx('SR2E.Notify.Qol.thatItemNoLongerExists'));
  if (item.parent && !item.parent.testUserPermission?.((game as any).user, 'OBSERVER') && !(game as any).user?.isGM) return void ui.notifications?.warn?.(tx('SR2E.Notify.Qol.youCanTSeeSThings', { itemName: escHtml(item.parent.name) }));
  await postItemToChat(item);
}

function attachChatDrop(root: HTMLElement | null): void {
  if (!root || (root as any).sr2eDrop) return;
  (root as any).sr2eDrop = true;
  root.addEventListener('dragover', (ev) => { if (ev.dataTransfer?.types?.includes('text/plain')) ev.preventDefault(); });
  root.addEventListener('drop', (ev) => {
    // The message box has its own drop (a link in the text): leave that to Foundry.
    const t = ev.target as HTMLElement | null;
    if (ev.defaultPrevented || t?.closest?.('textarea, input, prose-mirror, .chat-form, #chat-form, [contenteditable]')) return;
    void onChatDrop(ev);
  });
}

/** Make the item on a purchase card (and any SR2 item chip) draggable onto a sheet. */
export function decorateItemDrags(message: any, html: HTMLElement): void {
  const buy = message?.getFlag?.(SYSTEM_ID, 'buy') as { actorUuid: string; itemId: string; name: string } | undefined;
  if (!buy || html.querySelector('.sr2e-drag-item')) return;
  // Only the buyer's owners and the GM can hand it over.
  let buyer: any = null;
  try { buyer = (globalThis as any).fromUuidSync?.(buy.actorUuid); } catch { buyer = null; }
  if (!buyer?.isOwner && !(game as any).user?.isGM) return;
  const data = itemDragData(buy.actorUuid, buy.itemId);
  if (!data) return;
  let exists = false;
  try { exists = Boolean((globalThis as any).fromUuidSync?.(data.uuid)); } catch { exists = false; }
  if (!exists) return;
  const content = html.querySelector('.message-content') ?? html;
  const a = document.createElement('a');
  a.className = 'sr2e-drag-item content-link';
  a.draggable = true;
  a.dataset['uuid'] = data.uuid;
  a.dataset['type'] = 'Item';
  a.title = tx('SR2E.App.Qol.dragOntoASheetToHand');
  a.innerHTML = `<i class="fa-solid fa-hand-holding"></i> ${esc(buy.name)}`;
  a.addEventListener('dragstart', (ev) => {
    ev.stopPropagation();
    ev.dataTransfer?.setData('text/plain', JSON.stringify(data));
  });
  const p = document.createElement('p');
  p.className = 'sr2e-drag-row hint';
  p.append('Item: ', a);
  content.appendChild(p);
}

// ---------------------------------------------------------------- compendiums (item templates)

const TEMPLATE_PACK = 'sr2e-item-templates';

/** GM: write the world's item templates into a world compendium (made if missing). Returns how many. */
export async function exportTemplatesToCompendium(): Promise<number> {
  if (!(game as any).user?.isGM) { ui.notifications?.warn?.(tx('SR2E.Notify.Qol.onlyTheGmCanExportTemplates')); return 0; }
  let list: ItemTemplate[] = [];
  try { list = ((game as any).settings.get(SYSTEM_ID, 'itemTemplates') as ItemTemplate[]) ?? []; } catch { list = []; }
  if (!list.length) { ui.notifications?.info?.(tx('SR2E.Notify.Qol.noWorldItemTemplatesToExport')); return 0; }
  const packs: any = (game as any).packs;
  let pack: any = packs?.get?.(`world.${TEMPLATE_PACK}`);
  if (!pack) {
    const CC: any = (foundry as any).documents?.collections?.CompendiumCollection ?? (globalThis as any).CompendiumCollection;
    pack = await CC?.createCompendium?.({ type: 'Item', label: 'SR2e item templates', name: TEMPLATE_PACK, package: 'world' });
  }
  if (!pack) { ui.notifications?.error?.(tx('SR2E.Notify.Qol.couldNotMakeTheCompendium')); return 0; }
  const wasLocked = Boolean(pack.locked);
  if (wasLocked) await pack.configure?.({ locked: false });
  const index: any[] = [...((await pack.getIndex?.()) ?? [])];
  const ItemCls: any = (CONFIG as any).Item.documentClass;
  const make: any[] = [];
  const update: any[] = [];
  const unique = [...new Map(list.map((t) => [`${t.type}|${t.name}`, t])).values()];
  for (const t of unique) {
    const existing = index.find((e: any) => e.name === t.name && e.type === t.type);
    const data = { name: t.name, type: t.type, system: foundry.utils.deepClone(t.system), flags: { [SYSTEM_ID]: { templateId: t.id } } };
    if (existing) update.push({ _id: existing._id, ...data });
    else make.push(data);
  }
  if (make.length) await ItemCls.createDocuments(make, { pack: pack.collection });
  if (update.length) await ItemCls.updateDocuments(update, { pack: pack.collection });
  if (wasLocked) await pack.configure?.({ locked: true });
  ui.notifications?.info?.(tx('SR2E.Notify.Qol.exportedTemplateToTheCompendium', { uniqueLength: tCount(unique.length, 'SR2E.Count.template'), metadataLabel: escHtml(pack.metadata?.label ?? TEMPLATE_PACK) }));
  return unique.length;
}

/** GM: take the items of an Item compendium in as world item templates (same type and name: replaced). Returns how many. */
export async function importTemplatesFromCompendium(collection: string): Promise<number> {
  if (!(game as any).user?.isGM) return 0;
  const pack: any = (game as any).packs?.get?.(collection);
  if (!pack || pack.documentName !== 'Item') { ui.notifications?.warn?.(tx('SR2E.Notify.Qol.pickAnItemCompendium')); return 0; }
  const docs: any[] = await pack.getDocuments();
  const types = Object.keys((CONFIG as any).Item?.dataModels ?? {});
  let list: ItemTemplate[] = [];
  try { list = [...(((game as any).settings.get(SYSTEM_ID, 'itemTemplates') as ItemTemplate[]) ?? [])]; } catch { list = []; }
  let n = 0;
  for (const d of docs) {
    if (types.length && !types.includes(d.type)) continue;
    const system = foundry.utils.deepClone(d.system?.toObject ? d.system.toObject() : d.system ?? {});
    for (const k of ['description', 'notes', 'installed', 'worn', 'active', 'bonded', 'loaded', 'erased', 'jammed', 'damaged', 'degraded']) delete (system as any)[k];
    // v0.91.0 review (R8): a template taken in again keeps its id and its "in the shop" mark.
    const old = list.find((t) => t.type === d.type && t.name === d.name);
    list = list.filter((t) => !(t.type === d.type && t.name === d.name));
    list.push({ id: old?.id ?? `w-${foundry.utils.randomID()}`, type: d.type, name: d.name, system, ...(old?.shop ? { shop: true } : {}) });
    n++;
  }
  await (game as any).settings.set(SYSTEM_ID, 'itemTemplates', list);
  ui.notifications?.info?.(tx('SR2E.Notify.Qol.tookInItemTemplateFrom', { n: tCount(n, 'SR2E.Count.itemTemplate'), metadataLabel: escHtml(pack.metadata?.label ?? collection) }));
  return n;
}

/** GM: pick an Item compendium and import it as templates. */
export async function promptImportTemplates(): Promise<number> {
  const packs: any[] = [...((game as any).packs ?? [])].filter((p: any) => p.documentName === 'Item');
  if (!packs.length) { ui.notifications?.info?.(tx('SR2E.Notify.Qol.thereAreNoItemCompendiums')); return 0; }
  const pick = await (foundry as any).applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Qol.itemTemplatesFromACompendium') },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Qol.compendium')}</label><select name="pack">${packs.map((p: any) => `<option value="${esc(p.collection)}">${esc(p.metadata?.label ?? p.collection)} (${esc(p.collection)})</option>`).join('')}</select></div><p class="hint">${tx('SR2E.Dialog.Qol.eachItemBecomesAWorldTemplate')}</p>`,
    ok: { label: tx('SR2E.Dialog.Qol.import'), callback: (_e: Event, b: any) => String(b.form.elements.pack.value ?? '') },
    rejectClose: false,
  });
  return pick ? importTemplatesFromCompendium(pick) : 0;
}

// ---------------------------------------------------------------- hooks for other modules

/**
 * Hooks other modules can listen to (all called with Hooks.callAll):
 * - `sr2e.testPosted` (actor, snapshot, message): an SR2 test card was posted.
 * - `sr2e.damageTaken` (actor, {before, after}): an actor's condition monitor changed.
 * - `sr2e.newPass` (combat, pass) and `sr2e.newCombatTurn` (combat, round): combat flow.
 * - `sr2e.alert` (site, {from, to}): a site's security alert changed.
 * - `sr2e.ready` (api): the system's API (also game.sr2e) is ready.
 * And one that can stop something (Hooks.call; a listener returning false cancels):
 * - `sr2e.preDamage` (actor, {before, after}): an actor's condition monitor is about to change.
 */
/** `sr2e.preDamage`: false when a listener stops the monitor change. */
function preDamage(actor: any, change: any): boolean {
  if (change?.system?.monitor === undefined) return true;
  const before = { physical: Number(actor.system?.monitor?.physical ?? 0), stun: Number(actor.system?.monitor?.stun ?? 0) };
  const after = { physical: Number(change.system.monitor.physical ?? before.physical), stun: Number(change.system.monitor.stun ?? before.stun) };
  if (before.physical === after.physical && before.stun === after.stun) return true;
  return Hooks.call('sr2e.preDamage', actor, { before, after }) !== false;
}

export function registerModuleHooks(): void {
  Hooks.on('preUpdateActor', (actor: any, change: any) => (preDamage(actor, change) ? undefined : false));
  Hooks.on('updateActor', (actor: any, change: any, options: any, userId: string) => {
    if (!madeHere(options, userId)) return;
    if (options?.sr2ePrevMonitor && change?.system?.monitor !== undefined) Hooks.callAll('sr2e.damageTaken', actor, { before: options.sr2ePrevMonitor, after: { ...(actor.system?.monitor ?? {}) } });
  });
  Hooks.on('preUpdateActor', (actor: any, change: any, options: any) => {
    if (actor?.type === 'site' && change?.system?.alert !== undefined) options.sr2ePrevAlert = String(actor.system?.alert ?? '');
  });
  Hooks.on('updateActor', (actor: any, change: any, options: any, userId: string) => {
    if (actor?.type !== 'site' || change?.system?.alert === undefined) return;
    const from = String(options?.sr2ePrevAlert ?? ''), to = String(actor.system?.alert ?? '');
    if (madeHere(options, userId) && from !== to) Hooks.callAll('sr2e.alert', actor, { from, to });
    const order: readonly string[] = RULES.SECURITY.alerts;
    if ((game as any).user?.isGM && order.indexOf(to) > order.indexOf(from)) playCue('alarm');
  });
  Hooks.on('updateCombat', (combat: any, change: any, _o: any, userId: string) => {
    if (!madeHere(_o, userId)) return;
    if (change?.round !== undefined) Hooks.callAll('sr2e.newCombatTurn', combat, Number(combat.round ?? 0));
    else if (change?.flags?.[SYSTEM_ID]?.pass !== undefined) Hooks.callAll('sr2e.newPass', combat, Number(change.flags[SYSTEM_ID].pass));
  });
  Hooks.on('createChatMessage', (message: any, _o: any, userId: string) => {
    if (!madeHere(_o, userId)) return;
    const snap = message.getFlag?.(SYSTEM_ID, 'test');
    if (!snap) return;
    let actor: any = null;
    try { actor = (globalThis as any).fromUuidSync?.(snap.actorUuid) ?? null; } catch { actor = null; }
    Hooks.callAll('sr2e.testPosted', actor, snap, message);
  });
}

// ---------------------------------------------------------------- registration

export function registerQualityOfLife(): void {
  Hooks.on('updateCombat', (combat: any, change: any) => onTurn(combat, change));
  Hooks.on('hoverToken', (token: any, hovered: boolean) => { if (hovered) showHover(token); else hideHover(); });
  Hooks.on('canvasPan', () => hideHover());
  Hooks.on('deleteToken', () => hideHover());
  Hooks.on('renderChatLog', (_app: any, html: HTMLElement) => {
    const root: HTMLElement | null = (html as any)?.querySelector ? html : (html as any)?.[0] ?? null;
    attachChatDrop(root);
  });
  Hooks.once('ready', () => {
    attachChatDrop(document.querySelector<HTMLElement>('#chat'));
    attachChatDrop(document.querySelector<HTMLElement>('#chat-popout, .chat-popout'));
    // v14: with the sidebar collapsed, the cards float in the notification area.
    attachChatDrop(document.querySelector<HTMLElement>('#chat-notifications'));
  });
  // A disaster card: its roller and the GM hear it.
  Hooks.on('createChatMessage', (message: any) => {
    const me: any = (game as any).user;
    if (message.getFlag?.(SYSTEM_ID, 'disaster') && me?.isGM) playCue('disaster');
    const snap = message.getFlag?.(SYSTEM_ID, 'test');
    if (snap?.botch && !snap.disasterAvoided && !me?.isGM && (message.author?.id ?? message.user?.id) === me?.id) playCue('disaster');
  });
  registerModuleHooks();
}

/** v0.60.0: bar values the hover and other modules can read (Foundry's {value, max}), re-exported for macros. */
export { trackBar };
