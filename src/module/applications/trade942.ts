/**
 * v0.94.2 (improvement plan item 28): give, stash and loot without Item Piles, the Foundry side. The pure core is
 * rules/trade942.ts (routes, checks, the quantity split and the stack merge plan).
 *
 * - Give / stash: "Give to…" on an item row of a sheet the user owns (and "Give nuyen…" beside the nuyen box), an
 *   item dragged onto someone else's sheet, or a non-weapon item dragged onto a token. The "How many?" prompt is the
 *   one item drops use (applications/drops.ts `askHowMany`). Into an actor the user owns (or a safehouse) it is a
 *   stash, to anyone else a give.
 * - Loot: the GM marks an actor lootable (and optionally "free for all") from its token HUD or the Loot window; players
 *   open the Loot window (SR2e tools: Loot) and take from the lootable tokens on the scene they are viewing.
 * - Routes: a user who owns both actors (or the GM) moves it at once; a give or stash to an actor the user doesn't own,
 *   and loot, post a GM-apply card (chat action `applyTransfer`, rules/trust.ts GM_APPLY_SPECS); loot from a "free for
 *   all" actor goes through the GM relay (applications/socket.ts op `trade942`) and is moved by the GM's client at once.
 * - On the GM's client (`applyTransferAsGm`) everything is read again from the documents, bound to the card's author
 *   or the relay's sender: they own the giver (give, stash) or the receiver and the source is lootable (loot), the item
 *   is still there with enough of it, and the receiver can hold it.
 * - A safehouse holds physical items now (its stash, listed on its sheet).
 * - Item nesting: `setTradeNesting({ childrenOf, clearFlags, relink })` wires the parent links (see rules/trade942.ts).
 */
import { SYSTEM_ID } from '../config/system.ts';
import { t as tx, tKey, tCount } from '../helpers/i18n.ts';
import { escHtml } from '../rules/html.ts';
import { userOwns } from '../rules/trust.ts';
import { clearFlag } from '../helpers/flags.ts';
import { descendantsOf, readLink, TRADE_NEST_HOOKS, NEST_FLAG } from '../rules/nesting942.ts';
import {
  lootMarkOf, transferRoute, gmMayTransfer, transferShapeOk, transferProblems, planTransfer, tradeable, tradeableItems, tradeStackSize, countAnswer,
  transferFamily, refusedChildren, itemExtras, transferIsPlain, lootSourceVisible, missingCreates,
  MAX_TRANSFER_NUYEN, type TransferRequest, type TradeActor, type TradeItem, type TransferPlan, type PlanOptions, type TradeProblem, type TransferKind,
} from '../rules/trade942.ts';
import { ITEM_TYPES_FOR, arrivalReset, askHowMany } from './drops.ts';
import { requestGm, onRelay } from './socket.ts';
import { withGmLock } from './gmlock.ts';

const esc = escHtml;
/** The world setting that turns these tools on (off when the table uses Item Piles instead). */
export const TRADE_ON = 'tradeOn';
const LOOT_FLAG = 'loot';
/** The drag data type Foundry reads (sheets935.ts and others write it the same way). */
const MIME_TEXT = ['text', 'plain'].join('/');
/** Actor types that give or receive. */
const TRADE_ACTOR_TYPES = ['character', 'npc', 'spirit', 'vehicle', 'safehouse'];

const isGm = (): boolean => Boolean((game as any).user?.isGM);
export function tradeOn(): boolean {
  try { return (game as any).settings.get(SYSTEM_ID, TRADE_ON) !== false; } catch { return true; }
}
const docSync = (uuid: unknown): any => { try { return typeof uuid === 'string' && uuid ? (globalThis as any).fromUuidSync?.(uuid) ?? null : null; } catch { return null; } };
const gmIds = (): string[] => [...((game as any).users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);

// ---------------------------------------------------------------- item nesting hook point

/**
 * The nesting hooks (rules/trade942.ts PlanOptions), wired to the item nesting (rules/nesting942.ts): the whole family
 * (accessories, programs on a deck, a container's contents, and theirs) moves with a whole item; the moved item leaves
 * its own parent; children whose parent got a new id follow it.
 */
const nesting: Pick<PlanOptions, 'childrenOf' | 'clearFlags' | 'relink'> = { ...TRADE_NEST_HOOKS };

/**
 * Wire item nesting into every transfer: `childrenOf(item, all)` lists an item's children (they move with the whole
 * item), `clearFlags` the `flags.<system>` keys cleared on the moved item (its parent link), `relink` a child's data
 * pointed at its parent's new id. Items here are rules/trade942.ts TradeItem (id, type, name, system, data).
 */
export function setTradeNesting(h: Pick<PlanOptions, 'childrenOf' | 'clearFlags' | 'relink'>): void {
  if (h.childrenOf) nesting.childrenOf = h.childrenOf;
  if (h.clearFlags) nesting.clearFlags = [...h.clearFlags];
  if (h.relink) nesting.relink = h.relink;
}

function planOptions(): PlanOptions {
  return { ...nesting, scope: SYSTEM_ID, arrival: arrivalReset, makeId: () => (foundry.utils as any).randomID?.() ?? Math.random().toString(36).slice(2, 18) };
}

// ---------------------------------------------------------------- documents as the core sees them

/** An actor as rules/trade942.ts reads it (null for anything that isn't an actor). */
export function tradeActorOf(actor: any): TradeActor | null {
  if (!actor || actor.documentName !== 'Actor') return null;
  const items: TradeItem[] = [...(actor.items ?? [])].map((i: any) => ({
    id: String(i.id), type: String(i.type), name: String(i.name ?? ''),
    system: i.system ?? {}, data: typeof i.toObject === 'function' ? i.toObject() : { _id: i.id, name: i.name, type: i.type, system: i.system },
  }));
  const n = actor.system?.nuyen;
  return { uuid: String(actor.uuid), type: String(actor.type), name: String(actor.name ?? ''), items, nuyen: typeof n === 'number' && Number.isFinite(n) ? n : null, loot: lootMarkOf(actor.getFlag?.(SYSTEM_ID, LOOT_FLAG) ?? actor.flags?.[SYSTEM_ID]?.[LOOT_FLAG]) };
}

/** The text for a problem code. */
export function problemText(p: TradeProblem | string): string {
  return tKey(`SR2E.Trade.Problem.${p}`);
}

/**
 * A problem as plain text (escaped where it is shown). A refused child names the children the receiver can't hold
 * (review finding 1: nothing moves, so nothing is lost or split).
 */
function problemNote(p: TradeProblem, r: TransferRequest, fa: TradeActor | null, ta: TradeActor | null): string {
  if (p === 'childRefused') return tx('SR2E.Trade.childRefusedNamed', { to: String(ta?.name ?? ''), names: refusedChildren(r, fa, ta, ITEM_TYPES_FOR, nesting).slice(0, 8).join(', ') });
  return problemText(p);
}

/** A card's or relay's request as the core reads it (an item's count defaults to 1, as the GM side applies it). */
function requestOf(f: TransferRequest): TransferRequest {
  return { kind: f.kind, fromUuid: f.fromUuid, toUuid: f.toUuid, ...(f.itemId !== undefined ? { itemId: f.itemId, qty: f.qty ?? 1 } : { nuyen: f.nuyen! }) };
}

/**
 * v0.94.2 review (finding 2): whether a transfer card moves only plain items now (no tweaks or Active Effects on the item
 * or a child going along), read from the documents. rules/trust.ts `safeAutoApply` asks it (applications/trust.ts cardTrust).
 */
export function transferPlainNow(f: unknown): boolean {
  if (!transferShapeOk(f)) return false;
  if (f.nuyen !== undefined) return true;
  return transferIsPlain(requestOf(f), tradeActorOf(docSync(f.fromUuid)), nesting);
}

/** The tokens a source actor shows on the scenes (a synthetic token's own; a world actor's linked ones). */
function tokensOf(actor: any): any[] {
  if (!actor) return [];
  if (actor.isToken || actor.token) return actor.token ? [actor.token] : [];
  const out: any[] = [];
  for (const sc of ((game as any).scenes ?? [])) for (const t of (sc?.tokens ?? [])) if (t?.actorLink && t.actorId === actor.id) out.push(t);
  return out;
}

/** What a request moves, as text (the item's real name when the source still has it). */
function whatText(r: TransferRequest, from: any): string {
  if (r.nuyen !== undefined) return tx('SR2E.Trade.nuyenAmount', { amount: r.nuyen });
  const item = from?.items?.get?.(r.itemId);
  return tx('SR2E.Trade.itemCount', { name: String(item?.name ?? r.itemId ?? ''), qty: r.qty ?? 1 });
}

/** GM: plain-text lines on what the documents hold now, for the Apply (GM) confirmation (chat.ts gmApplyFlag). */
export function transferLiveLines(f: any): string[] {
  if (!transferShapeOk(f)) return [];
  const from = docSync(f.fromUuid);
  const out: string[] = [];
  if (f.itemId !== undefined) {
    const item = from?.items?.get?.(f.itemId);
    out.push(item ? tx('SR2E.Trade.liveItem', { name: String(item.name), have: tradeStackSize(item.system) }) : problemText('noItem'));
    // v0.94.2 review (finding 2): what arrives besides the name: the children going along, every tweak and Active Effect
    // (targets and values) and the system's own flags, so the GM sees what the receiver gets.
    const r = requestOf(f);
    const fa = tradeActorOf(from);
    const fam = transferFamily(r, fa, nesting);
    if (fam.length > 1) out.push(tx('SR2E.Trade.liveFamily', { names: fam.slice(1, 13).map((i) => i.name).join(', ') }));
    for (const i of fam) {
      const x = itemExtras(i);
      for (const tw of x?.tweaks.slice(0, 12) ?? []) out.push(tx('SR2E.Trade.liveTweak', { item: i.name, text: tw }));
      for (const e of x?.effects ?? []) out.push(tx('SR2E.Trade.liveEffect', { item: i.name, name: e.name, changes: e.changes.join('; ') || tx('SR2E.Trade.liveEffectNone') }));
      const own = i.data?.['flags']?.[SYSTEM_ID];
      const keys = own && typeof own === 'object' ? Object.keys(own).filter((k) => k !== NEST_FLAG && own[k] !== null && own[k] !== undefined) : [];
      if (keys.length) out.push(tx('SR2E.Trade.liveFlags', { item: i.name, keys: keys.slice(0, 10).join(', ') }));
    }
    const refused = refusedChildren(r, fa, tradeActorOf(docSync(f.toUuid)), ITEM_TYPES_FOR, nesting);
    if (refused.length) out.push(problemNote('childRefused', r, fa, tradeActorOf(docSync(f.toUuid))));
  }
  if (f.kind === 'loot') out.push(lootMarkOf(from?.getFlag?.(SYSTEM_ID, LOOT_FLAG)) ? tx('SR2E.Trade.liveLootable') : tx('SR2E.Trade.liveNotLootable'));
  return out;
}

// ---------------------------------------------------------------- carrying out a plan

/**
 * Carry out a checked plan: the receiver's side first, then the giver's; if the giver's side fails the receiver's is
 * undone (the item never ends up in two places, as an item drop does).
 */
export async function executePlan(from: any, to: any, plan: TransferPlan, r: TransferRequest): Promise<void> {
  if (plan.nuyen) {
    const amount = Number(r.nuyen ?? 0);
    await from.update({ 'system.nuyen': plan.nuyen.from });
    try { await to.update({ 'system.nuyen': plan.nuyen.to }); } catch (err) {
      try { await from.update({ 'system.nuyen': plan.nuyen.from + amount }); } catch { /* reported below */ }
      throw err;
    }
    return;
  }
  const before = plan.target.updates.map((u) => ({ _id: u._id, 'system.quantity': tradeStackSize(to.items?.get?.(u._id)?.system) }));
  let made: any[] = [];
  const undoTarget = async () => {
    try {
      if (made.length) await to.deleteEmbeddedDocuments('Item', made.map((d: any) => d.id ?? d._id));
      if (before.length) await to.updateEmbeddedDocuments('Item', before);
    } catch (err2) { console.warn('sr2e | transfer undo', err2); }
  };
  try {
    if (plan.target.create.length) made = (await to.createEmbeddedDocuments('Item', plan.target.create, { keepId: true })) ?? [];
    // v0.94.2 review (finding 1): a create refused on the receiver (its type guard, a module) leaves the giver untouched:
    // nothing on the giver is deleted unless its copy was made.
    if (missingCreates(plan, made.map((d: any) => String(d?.id ?? d?._id ?? ''))).length) throw new Error(tx('SR2E.Trade.failed'));
    if (plan.target.updates.length) await to.updateEmbeddedDocuments('Item', plan.target.updates);
  } catch (err) { await undoTarget(); throw err; }
  try {
    if (plan.source.updates.length) await from.updateEmbeddedDocuments('Item', plan.source.updates);
    if (plan.source.deleteIds.length) await from.deleteEmbeddedDocuments('Item', plan.source.deleteIds);
  } catch (err) { await undoTarget(); throw err; }
}

/** A whispered chat line saying what changed hands (to the GMs, the asking user and the receiver's players). */
async function postLine(r: TransferRequest, from: any, to: any, what: string, user: any): Promise<void> {
  const owners = [...((game as any).users ?? [])].filter((u: any) => !u.isGM && userOwns(u, to)).map((u: any) => u.id);
  const f = esc(from?.name ?? ''), t = esc(to?.name ?? ''), w = esc(what);
  await ChatMessage.create({
    speaker: { alias: String(from?.name ?? '') },
    content: `<p class="sr2e-trade942-line"><i class="fa-solid fa-hand-holding-hand"></i> ${r.kind === 'loot' ? tx('SR2E.Trade.chatLoot', { from: f, to: t, what: w }) : r.kind === 'stash' ? tx('SR2E.Trade.chatStash', { from: f, to: t, what: w }) : tx('SR2E.Trade.chatGive', { from: f, to: t, what: w })}</p>`,
    whisper: [...new Set([...gmIds(), ...(user?.id ? [user.id] : []), ...owners])],
  });
}

/**
 * GM's client: carry out a transfer someone else asked for (a GM-apply card's author, or the relay's sender). Checked
 * again from the documents; never queues on the GM lock itself (the card's step and the relay already hold it).
 */
export async function applyTransferAsGm(raw: unknown, user: any, via: 'card' | 'relay', o: { plainOnly?: boolean } = {}): Promise<{ ok: boolean; note?: string }> {
  // Review finding 10: trading turned off (Item Piles instead) refuses the card and the relay too.
  if (!tradeOn()) return { ok: false, note: tx('SR2E.Trade.off') };
  if (!transferShapeOk(raw)) return { ok: false, note: problemText('badRequest') };
  const r: TransferRequest = requestOf(raw);
  let from: any = null, to: any = null;
  try { from = await fromUuid(r.fromUuid); to = await fromUuid(r.toUuid); } catch { /* checked below */ }
  // Review finding 12: two uuids for one actor (a linked token's path and the world actor's) are the same actor.
  if (from && from === to) return { ok: false, note: problemText('sameActor') };
  const fa = tradeActorOf(from), ta = tradeActorOf(to);
  const who = { isGm: Boolean(user?.isGM), ownsFrom: Boolean(from && userOwns(user, from)), ownsTo: Boolean(to && userOwns(user, to)) };
  // Review finding 15: notes are plain text (escaped where they are shown).
  if (!gmMayTransfer(r.kind, who, fa?.loot ?? null, via)) return { ok: false, note: tx('SR2E.Trade.notAllowed', { who: String(user?.name ?? '?') }) };
  // Review finding 11: a player loots only what a token shows (hidden loot stays hidden).
  if (r.kind === 'loot' && !who.isGm && !lootSourceVisible(tokensOf(from))) return { ok: false, note: problemText('hiddenSource') };
  const probs = transferProblems(r, fa, ta, ITEM_TYPES_FOR, nesting);
  if (probs.length) return { ok: false, note: problemNote(probs[0]!, r, fa, ta) };
  // Review finding 2: applying by itself, an item with tweaks or Active Effects (or such a child) waits for the GM.
  if (o.plainOnly && !transferIsPlain(r, fa, nesting)) return { ok: false, note: tx('SR2E.Trade.notPlain') };
  const what = whatText(r, from);
  try { await executePlan(from, to, planTransfer(r, fa!, ta!, planOptions()), r); } catch (err) {
    console.warn('sr2e | transfer', err);
    return { ok: false, note: tx('SR2E.Trade.failed') };
  }
  await postLine(r, from, to, what, user);
  return { ok: true };
}

/** Post the GM-apply card for a transfer this user can't make. */
async function postTransferCard(r: TransferRequest, from: any, to: any): Promise<void> {
  const item = r.itemId !== undefined ? from?.items?.get?.(r.itemId) : null;
  const what = whatText(r, from);
  const f = esc(from?.name ?? ''), t = esc(to?.name ?? ''), w = esc(what);
  const me = (game as any).user?.id;
  await ChatMessage.create({
    speaker: (ChatMessage as any).getSpeaker?.({ actor: r.kind === 'loot' ? to : from }) ?? {},
    content: `<p class="sr2e-trade942-card"><i class="fa-solid fa-hand-holding-hand"></i> ${r.kind === 'loot' ? tx('SR2E.Trade.cardLoot', { from: f, to: t, what: w }) : tx('SR2E.Trade.cardGive', { from: f, to: t, what: w })}</p>
      <p><button type="button" data-sr2e-action="applyTransfer">${tx('SR2E.Card.Actor.applyGm')}</button></p>`,
    whisper: [...new Set([...gmIds(), ...(me ? [me] : [])])],
    flags: { [SYSTEM_ID]: { transfer: { ...r, ...(item ? { name: String(item.name).slice(0, 190) } : {}), sourceUuid: r.kind === 'loot' ? r.toUuid : r.fromUuid } } },
  });
}

/**
 * Ask for a transfer from this client: made at once when the user may (a GM, or owner of both), else a GM-apply card,
 * or the GM relay for free-for-all loot. True when it was made or sent.
 */
export async function requestTransfer(r: TransferRequest): Promise<boolean> {
  const from = docSync(r.fromUuid), to = docSync(r.toUuid);
  if (from && from === to) { ui.notifications?.warn?.(esc(problemText('sameActor'))); return false; }
  const fa = tradeActorOf(from), ta = tradeActorOf(to);
  const who = { isGm: isGm(), ownsFrom: Boolean(from?.isOwner), ownsTo: Boolean(to?.isOwner) };
  const route = transferRoute(r.kind, who, fa?.loot ?? null);
  if (route === 'refused') { ui.notifications?.warn?.((r.kind === 'loot' ? tx('SR2E.Trade.refusedLoot') : tx('SR2E.Trade.refusedGive'))); return false; }
  const probs = transferProblems(r, fa, ta, ITEM_TYPES_FOR, nesting);
  if (probs.length) { ui.notifications?.warn?.(esc(problemNote(probs[0]!, r, fa, ta))); return false; }
  const what = whatText(r, from);
  if (route === 'direct') {
    // Review finding 6: on the GM's client the move runs under the GM lock (after every prompt), read again inside it,
    // so a relay loot or a re-run can't act between the read and the writes. A player's own move needs no lock.
    const move = async (): Promise<string | null> => {
      const f2 = docSync(r.fromUuid), t2 = docSync(r.toUuid);
      const fa2 = tradeActorOf(f2), ta2 = tradeActorOf(t2);
      const p2 = transferProblems(r, fa2, ta2, ITEM_TYPES_FOR, nesting);
      if (p2.length) return problemNote(p2[0]!, r, fa2, ta2);
      await executePlan(f2, t2, planTransfer(r, fa2!, ta2!, planOptions()), r);
      return null;
    };
    let note: string | null = null;
    try { note = isGm() ? await withGmLock(move) : await move(); } catch (err) {
      console.warn('sr2e | transfer', err);
      ui.notifications?.error?.(tx('SR2E.Trade.failed'));
      return false;
    }
    if (note) { ui.notifications?.warn?.(esc(note)); return false; }
    ui.notifications?.info?.(tx('SR2E.Trade.done', { from: esc(from.name), to: esc(to.name), what: esc(what) }));
    // The GM sees loot taken by a GM's own hand only in the log; a player's own stash needs no line.
    return true;
  }
  if (route === 'relay') {
    const res = await requestGm('trade942', { req: r });
    if (res.ok) ui.notifications?.info?.(tx('SR2E.Trade.done', { from: esc(from.name), to: esc(to.name), what: esc(what) }));
    else ui.notifications?.warn?.(esc(res.note ?? tx('SR2E.Trade.failed')));
    return res.ok;
  }
  await postTransferCard(r, from, to);
  ui.notifications?.info?.(tx('SR2E.Trade.sentToGm', { what: esc(what), to: esc(to.name) }));
  return true;
}

// ---------------------------------------------------------------- give and stash

/** Whether this user would stash into an actor (their own, or a safehouse) rather than give it away. */
function stashKind(to: any): TransferKind {
  return to?.isOwner || to?.type === 'safehouse' ? 'stash' : 'give';
}

/** Actors an item or nuyen can go to from `from`: the user's own, safehouses, player characters and actors on the viewed scene. */
export function giveTargets(from: any, itemType: string | null): any[] {
  const out = new Map<string, any>();
  const add = (a: any) => {
    if (!a || a.uuid === from?.uuid || !TRADE_ACTOR_TYPES.includes(a.type) || out.has(a.uuid)) return;
    if (itemType ? !(ITEM_TYPES_FOR[a.type] ?? []).includes(itemType) : typeof a.system?.nuyen !== 'number') return;
    out.set(a.uuid, a);
  };
  const gm = isGm();
  for (const a of ((game as any).actors ?? [])) if (gm || a.isOwner || a.type === 'safehouse' || a.hasPlayerOwner) add(a);
  for (const t of ((globalThis as any).canvas?.tokens?.placeables ?? [])) if (gm || !t.document?.hidden) add(t.actor);
  return [...out.values()].sort((a, b) => Number(stashKind(b) === 'stash') - Number(stashKind(a) === 'stash') || String(a.name).localeCompare(String(b.name)));
}

/** Ask who gets it (and, for nuyen, how much). Null when cancelled. */
async function askRecipient(from: any, itemType: string | null, title: string, nuyenMax = 0): Promise<{ uuid: string; amount: number } | null> {
  const list = giveTargets(from, itemType);
  if (!list.length) { ui.notifications?.warn?.(tx('SR2E.Trade.noRecipients')); return null; }
  const named = (a: any): string => (a.type === 'safehouse' ? tx('SR2E.Trade.safehouseNamed', { name: esc(a.name) }) : esc(a.name));
  const opt = (a: any) => `<option value="${esc(a.uuid)}">${named(a)}</option>`;
  const stash = list.filter((a) => stashKind(a) === 'stash');
  const give = list.filter((a) => stashKind(a) !== 'stash');
  const group = (label: string, l: any[]): string => (l.length ? `<optgroup label="${esc(label)}">${l.map(opt).join('')}</optgroup>` : '');
  const groups = group(tx('SR2E.Trade.groupStash'), stash) + group(tx('SR2E.Trade.groupGive'), give);
  const D: any = (foundry as any).applications.api.DialogV2;
  const amount = nuyenMax > 0
    ? `<div class="form-group"><label>${tx('SR2E.Trade.nuyenLabel', { have: nuyenMax })}</label><input type="number" name="amount" value="" min="1" max="${Math.min(nuyenMax, MAX_TRANSFER_NUYEN)}" step="1"></div>` : '';
  const r = await D.wait({
    window: { title }, classes: ['sr2e-dialog', 'sr2e-trade942'],
    content: `<div class="form-group"><label>${tx('SR2E.Trade.to')}</label><select name="to">${groups}</select></div>${amount}<p class="hint">${tx('SR2E.Trade.giveHint')}</p>`,
    buttons: [
      { action: 'ok', label: tx('SR2E.Trade.giveButton'), default: true, callback: (_e: any, b: any) => ({ uuid: String(b.form.elements.to.value ?? ''), amount: String(b.form.elements.amount?.value ?? '') }) },
      { action: 'cancel', label: tx('SR2E.Dialog.Drops.howManyCancel') },
    ],
    rejectClose: false,
  });
  if (!r || typeof r !== 'object' || !r.uuid) return null;
  if (nuyenMax > 0) {
    const n = countAnswer(r.amount, Math.min(nuyenMax, MAX_TRANSFER_NUYEN));
    if (n === null) { ui.notifications?.warn?.(tx('SR2E.Notify.Drops.howManyBad', { have: nuyenMax })); return null; }
    return { uuid: r.uuid, amount: n };
  }
  return { uuid: r.uuid, amount: 0 };
}

/** How many of a stack (the item drops' prompt); 1 for an item with no count. Null when cancelled. */
async function howMany(item: any): Promise<number | null> {
  const have = tradeStackSize(item.system);
  return have > 1 ? askHowMany(String(item.name), have) : 1;
}

/** "Give to…": pick who gets an item of this user's (or `toUuid` when it is already known), how many, and send it. */
export async function giveItem(item: any, toUuid = ''): Promise<boolean> {
  const from = item?.parent;
  if (!from || from.documentName !== 'Actor') return false;
  if (!from.isOwner) { ui.notifications?.warn?.(tx('SR2E.Trade.refusedGive')); return false; }
  if (!tradeable(item)) { ui.notifications?.warn?.(esc(problemText('notTradeable'))); return false; }
  let target = toUuid;
  if (!target) {
    const pick = await askRecipient(from, item.type, tx('SR2E.Trade.giveTitle', { name: item.name }));
    if (!pick) return false;
    target = pick.uuid;
  }
  const qty = await howMany(item);
  if (qty === null) return false;
  return requestTransfer({ kind: stashKind(docSync(target)), fromUuid: from.uuid, toUuid: target, itemId: item.id, qty });
}

/** "Give nuyen…" from an actor this user owns. */
export async function giveNuyen(from: any): Promise<boolean> {
  const have = Number(from?.system?.nuyen ?? 0);
  if (!from?.isOwner || !(have > 0)) { ui.notifications?.warn?.(esc(problemText('notEnoughNuyen'))); return false; }
  const pick = await askRecipient(from, null, tx('SR2E.Trade.giveNuyenTitle', { name: from.name }), have);
  if (!pick) return false;
  return requestTransfer({ kind: stashKind(docSync(pick.uuid)), fromUuid: from.uuid, toUuid: pick.uuid, nuyen: pick.amount });
}

/**
 * An item dropped on a sheet the user doesn't own (applications/drops.ts): a gift, when the item is the user's own and
 * changes hands. Always null (nothing is made on this client).
 */
export async function giveByDrop(item: any, to: any): Promise<null> {
  if (!tradeOn() || !item?.parent || item.parent.documentName !== 'Actor' || !item.parent.isOwner || !to?.uuid) return null;
  if (!tradeable(item)) return null;
  await giveItem(item, to.uuid);
  return null;
}

// ---------------------------------------------------------------- loot

/** GM: mark an actor lootable (or not), and whether players take without asking. */
export async function setLootable(actor: any, mark: { on: boolean; free?: boolean }): Promise<void> {
  if (!actor || !actor.isOwner) return;
  if (!mark.on) { await clearFlag(actor, LOOT_FLAG); return; }
  await actor.setFlag(SYSTEM_ID, LOOT_FLAG, { on: true, free: Boolean(mark.free) });
}

/** The lootable tokens on the scene this user is viewing (hidden ones only for the GM). */
export function lootableTokens(): any[] {
  const gm = isGm();
  return [...((globalThis as any).canvas?.tokens?.placeables ?? [])]
    .filter((t: any) => t.actor && (gm || !t.document?.hidden) && lootMarkOf(t.actor.getFlag?.(SYSTEM_ID, LOOT_FLAG)))
    .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
}

/** The actors this user may loot into: their own people and vehicles (their character first). */
function lootReceivers(): any[] {
  const mine: any = (game as any).user?.character;
  const list = [...((game as any).actors ?? [])].filter((a: any) => a.isOwner && ['character', 'npc', 'spirit', 'vehicle', 'safehouse'].includes(a.type) && !lootMarkOf(a.getFlag?.(SYSTEM_ID, LOOT_FLAG)));
  return list.sort((a: any, b: any) => Number(b.id === mine?.id) - Number(a.id === mine?.id) || String(a.name).localeCompare(String(b.name)));
}

/** The Foundry window base, read when this file loads in Foundry (a stand-in where it isn't: the tests import drops.ts). */
const AppV2Base: any = (globalThis as any).foundry?.applications?.api?.ApplicationV2 ?? class {};

/** The Loot window: the lootable tokens on the viewed scene, what each carries, and Take. */
export class SR2Loot942 extends AppV2Base {
  static DEFAULT_OPTIONS = {
    id: 'sr2e-loot942',
    classes: ['sr2e', 'sr2e-loot942'],
    window: { title: 'SR2E.Trade.lootTitle', icon: 'fa-solid fa-sack-dollar', resizable: true },
    position: { width: 440, height: 'auto' as const },
    actions: {
      lootTake: SR2Loot942.#onTake,
      lootTakeNuyen: SR2Loot942.#onTakeNuyen,
      lootMark: SR2Loot942.#onMark,
    },
  };

  /** The token picked (its uuid) and the actor taking. */
  sourceUuid = '';
  intoUuid = '';

  static open(sourceUuid = ''): SR2Loot942 {
    const open: any = (foundry as any).applications?.instances?.get?.('sr2e-loot942');
    const app: SR2Loot942 = open ?? new SR2Loot942();
    if (sourceUuid) app.sourceUuid = sourceUuid;
    void app.render({ force: true });
    app.bringToFront?.();
    return app;
  }

  /** The picked lootable actor (the first on the scene when none is picked). */
  source(): any {
    const tokens = lootableTokens();
    const picked = tokens.find((t: any) => t.actor?.uuid === this.sourceUuid) ?? tokens[0] ?? null;
    if (picked) this.sourceUuid = picked.actor.uuid;
    return picked?.actor ?? null;
  }

  async _renderHTML(): Promise<string> {
    const tokens = lootableTokens();
    if (!tokens.length) return `<p class="hint">${tx('SR2E.Trade.noLoot')}</p>`;
    const src = this.source();
    const into = lootReceivers();
    if (!into.some((a: any) => a.uuid === this.intoUuid)) this.intoUuid = into[0]?.uuid ?? '';
    const mark = lootMarkOf(src?.getFlag?.(SYSTEM_ID, LOOT_FLAG));
    const items = tradeableItems([...(src?.items ?? [])] as any[]);
    const nuyen = Number(src?.system?.nuyen ?? 0);
    const rows = items.map((i: any) => `<li class="sr2e-loot942-row"><span>${esc(i.name)}${tradeStackSize(i.system) > 1 ? ` <span class="hint">×${tradeStackSize(i.system)}</span>` : ''}</span>
      <button type="button" data-action="lootTake" data-item-id="${esc(i.id)}" ${this.intoUuid ? '' : 'disabled'}>${tx('SR2E.Trade.take')}</button></li>`).join('');
    const gm = isGm();
    return `<div class="sr2e-loot942-body">
      <div class="form-group"><label>${tx('SR2E.Trade.lootFrom')}</label><select name="source">${tokens.map((t: any) => `<option value="${esc(t.actor.uuid)}"${t.actor.uuid === this.sourceUuid ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>${tx('SR2E.Trade.lootInto')}</label><select name="into">${into.map((a: any) => `<option value="${esc(a.uuid)}"${a.uuid === this.intoUuid ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
      <p class="hint">${mark?.free ? tx('SR2E.Trade.freeForAllHint') : tx('SR2E.Trade.asksGmHint')}</p>
      ${gm ? `<p class="sr2e-row"><button type="button" data-action="lootMark" data-mark="free">${mark?.free ? tx('SR2E.Trade.markAsk') : tx('SR2E.Trade.markFree')}</button>
        <button type="button" data-action="lootMark" data-mark="off">${tx('SR2E.Trade.markOff')}</button></p>` : ''}
      <ul class="sr2e-loot942-list">${rows || `<li><em>${tx('SR2E.Trade.nothingToTake')}</em></li>`}
      ${nuyen > 0 ? `<li class="sr2e-loot942-row"><span>${tx('SR2E.Trade.nuyenAmount', { amount: nuyen })}</span><button type="button" data-action="lootTakeNuyen" ${this.intoUuid ? '' : 'disabled'}>${tx('SR2E.Trade.take')}</button></li>` : ''}</ul>
    </div>`;
  }

  _replaceHTML(result: string, content: HTMLElement): void {
    content.innerHTML = result;
    content.querySelector('select[name="source"]')?.addEventListener('change', (e) => { this.sourceUuid = String((e.target as HTMLSelectElement).value); void this.render(); });
    content.querySelector('select[name="into"]')?.addEventListener('change', (e) => { this.intoUuid = String((e.target as HTMLSelectElement).value); });
  }

  static async #onTake(this: SR2Loot942, _e: Event, t: HTMLElement): Promise<void> {
    const src = this.source();
    const item = src?.items?.get?.(t.dataset['itemId'] ?? '');
    if (!item || !this.intoUuid) return;
    const qty = await howMany(item);
    if (qty === null) return;
    await requestTransfer({ kind: 'loot', fromUuid: src.uuid, toUuid: this.intoUuid, itemId: item.id, qty });
    void this.render();
  }

  static async #onTakeNuyen(this: SR2Loot942): Promise<void> {
    const src = this.source();
    const have = Number(src?.system?.nuyen ?? 0);
    if (!src || !this.intoUuid || !(have > 0)) return;
    const n = await askHowMany(tx('SR2E.Trade.nuyen'), Math.min(have, MAX_TRANSFER_NUYEN));
    if (n === null) return;
    await requestTransfer({ kind: 'loot', fromUuid: src.uuid, toUuid: this.intoUuid, nuyen: n });
    void this.render();
  }

  static async #onMark(this: SR2Loot942, _e: Event, t: HTMLElement): Promise<void> {
    if (!isGm()) return;
    const src = this.source();
    if (!src) return;
    const mark = lootMarkOf(src.getFlag?.(SYSTEM_ID, LOOT_FLAG));
    if (t.dataset['mark'] === 'off') await setLootable(src, { on: false });
    else await setLootable(src, { on: true, free: !mark?.free });
    void this.render();
  }
}

/** Open the Loot window (the SR2e tools' Loot), at the targeted lootable token when there is one. */
export function openLoot942(): void {
  if (!tradeOn()) { ui.notifications?.info?.(tx('SR2E.Trade.off')); return; }
  const target: any = [...((game as any).user?.targets ?? [])][0];
  SR2Loot942.open(target?.actor && lootMarkOf(target.actor.getFlag?.(SYSTEM_ID, LOOT_FLAG)) ? target.actor.uuid : '');
}

function rerenderLoot(): void {
  const open: any = (foundry as any).applications?.instances?.get?.('sr2e-loot942');
  if (open?.rendered) void open.render();
}

// ---------------------------------------------------------------- sheet, HUD and canvas wiring

/** "Give to…" on each tradeable item row of a sheet this user owns, "Give nuyen…" beside the nuyen box. */
function decorateSheet(app: any, el: HTMLElement): void {
  const actor: any = app?.document;
  if (!actor || actor.documentName !== 'Actor' || !actor.isOwner || !tradeOn()) return;
  el.querySelectorAll('a[data-action="deleteItem"][data-item-id]').forEach((del) => {
    const id = (del as HTMLElement).dataset['itemId'] ?? '';
    const item = actor.items?.get?.(id);
    if (!item || !tradeable(item) || del.parentElement?.querySelector('.sr2e-give942')) return;
    const a = document.createElement('a');
    a.className = 'sr2e-give942';
    a.title = tx('SR2E.Trade.giveControl');
    a.setAttribute('role', 'button');
    a.setAttribute('aria-label', tx('SR2E.Trade.giveControl'));
    a.innerHTML = '<i class="fa-solid fa-hand-holding-hand"></i>';
    a.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); void giveItem(item); });
    del.before(a);
  });
  const nuyen = el.querySelector('input[name="system.nuyen"]') as HTMLInputElement | null;
  if (nuyen && !nuyen.parentElement?.querySelector('.sr2e-givenuyen942')) {
    const b = document.createElement('a');
    b.className = 'sr2e-givenuyen942';
    b.title = tx('SR2E.Trade.giveNuyenControl');
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', tx('SR2E.Trade.giveNuyenControl'));
    b.innerHTML = '<i class="fa-solid fa-hand-holding-dollar"></i>';
    b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); void giveNuyen(actor); });
    nuyen.after(b);
  }
}

/** A safehouse sheet's stash: what it holds, each row draggable, with Give to… (to take it, drag it onto a sheet). */
function decorateSafehouse(app: any, el: HTMLElement): void {
  const actor: any = app?.document;
  if (!actor || actor.type !== 'safehouse' || !tradeOn()) return;
  const host = el.querySelector('.window-content') ?? el;
  host.querySelector('.sr2e-stash942')?.remove();
  // v0.94.2 (lead): only what sits loose in the stash; a bag's contents and a gun's accessories travel with it.
  const all: any[] = [...(actor.items ?? [])];
  const ids = new Set(all.map((i: any) => String(i.id)));
  const inner = (i: any): number => descendantsOf(i.id, all.map((x: any) => ({ id: x.id, type: x.type, system: x.system, flags: x.flags }))).length;
  const items = tradeableItems(all.filter((i: any) => { const l = readLink(i); return !l || !ids.has(l.parent); }));
  const sec = document.createElement('section');
  sec.className = 'sr2e-stash942';
  sec.innerHTML = `<h2>${tx('SR2E.Trade.stashHeading')}</h2><p class="hint">${tx('SR2E.Trade.stashHint')}</p>
    <ul class="sr2e-loot942-list">${items.map((i: any) => `<li class="sr2e-loot942-row" draggable="true" data-item-id="${esc(i.id)}"><span><a class="sr2e-stash942-open" data-item-id="${esc(i.id)}">${esc(i.name)}</a>${tradeStackSize(i.system) > 1 ? ` <span class="hint">×${tradeStackSize(i.system)}</span>` : ''}${inner(i) ? ` <span class="hint">${esc(tCount(inner(i), 'SR2E.Count.itemInside'))}</span>` : ''}</span>
      ${actor.isOwner ? `<a class="sr2e-give942" role="button" data-item-id="${esc(i.id)}" title="${esc(tx('SR2E.Trade.giveControl'))}"><i class="fa-solid fa-hand-holding-hand"></i></a>` : ''}</li>`).join('') || `<li><em>${tx('SR2E.Trade.stashEmpty')}</em></li>`}</ul>`;
  sec.querySelectorAll('li[data-item-id]').forEach((li) => {
    li.addEventListener('dragstart', (ev) => {
      const it = actor.items?.get?.((li as HTMLElement).dataset['itemId'] ?? '');
      if (it) (ev as DragEvent).dataTransfer?.setData(MIME_TEXT, JSON.stringify({ type: 'Item', uuid: it.uuid }));
    });
  });
  sec.querySelectorAll('a.sr2e-stash942-open').forEach((a) => a.addEventListener('click', (ev) => {
    ev.preventDefault();
    actor.items?.get?.((a as HTMLElement).dataset['itemId'] ?? '')?.sheet?.render?.(true);
  }));
  sec.querySelectorAll('a.sr2e-give942').forEach((a) => a.addEventListener('click', (ev) => {
    ev.preventDefault();
    const it = actor.items?.get?.((a as HTMLElement).dataset['itemId'] ?? '');
    if (it) void giveItem(it);
  }));
  host.appendChild(sec);
}

/** GM token HUD: mark the token's actor lootable (and free for all), or open the Loot window at it. */
function decorateHud(hud: any, htmlIn: HTMLElement): void {
  if (!isGm() || !tradeOn()) return;
  const html: HTMLElement = (htmlIn as any)?.querySelector ? htmlIn : (htmlIn as any)?.[0];
  const actor: any = (hud.object ?? hud.token)?.actor;
  if (!html || !actor || !['character', 'npc', 'spirit', 'vehicle'].includes(actor.type) || html.querySelector('.sr2e-loot942-hud')) return;
  const col = html.querySelector('.col.right') ?? html;
  const mark = lootMarkOf(actor.getFlag?.(SYSTEM_ID, LOOT_FLAG));
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `control-icon sr2e-loot942-hud${mark ? ' active' : ''}`;
  const title = mark ? (mark.free ? tx('SR2E.Trade.hudFree') : tx('SR2E.Trade.hudOn')) : tx('SR2E.Trade.hudOff');
  b.dataset['tooltip'] = esc(title);
  b.title = title;
  b.innerHTML = `<i class="fa-solid ${mark?.free ? 'fa-people-carry-box' : 'fa-sack-dollar'}"></i>`;
  // Click: off → lootable (asks the GM) → free for all → off.
  b.addEventListener('click', async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    if (!mark) await setLootable(actor, { on: true, free: false });
    else if (!mark.free) await setLootable(actor, { on: true, free: true });
    else await setLootable(actor, { on: false });
    hud.render?.();
  });
  b.addEventListener('contextmenu', (ev) => { ev.preventDefault(); SR2Loot942.open(actor.uuid); });
  col.appendChild(b);
}

/** A token under a canvas point (the topmost). */
function tokenAt(x: number, y: number): any | null {
  const list = [...((globalThis as any).canvas?.tokens?.placeables ?? [])].filter((t: any) => t.visible !== false && (t.bounds?.contains?.(x, y)
    || (x >= t.x && y >= t.y && x <= t.x + (t.w ?? t.width ?? 0) && y <= t.y + (t.h ?? t.height ?? 0))));
  return list.sort((a: any, b: any) => (b.document?.sort ?? 0) - (a.document?.sort ?? 0))[0] ?? null;
}

/**
 * An item of the user's dragged onto another actor's token: a gift. Weapons, spells and powers keep their own drop
 * (attack, cast: applications/ui.ts), so only the other physical types give this way.
 */
function onDropCanvas(_canvas: any, data: any): boolean | void {
  if (!tradeOn() || data?.type !== 'Item' || !data.uuid) return;
  const item = docSync(data.uuid);
  if (!item?.parent || item.parent.documentName !== 'Actor' || item.type === 'weapon' || !tradeable(item)) return;
  const token = tokenAt(Number(data.x), Number(data.y));
  if (!token?.actor || token.actor.uuid === item.parent.uuid || !item.parent.isOwner) return;
  void giveItem(item, token.actor.uuid);
  return false;
}

/** Settings, the relay op and the hooks (from sr2e-system.ts at init). */
export function registerTrade942(): void {
  (game as any).settings.register(SYSTEM_ID, TRADE_ON, {
    name: 'SR2E.Settings.tradeOn.Name', hint: 'SR2E.Settings.tradeOn.Hint',
    scope: 'world', config: true, type: Boolean, default: true,
  });
  onRelay('trade942', async (data, user) => applyTransferAsGm(data?.['req'], user, 'relay'));
  Hooks.on('renderApplicationV2', (app: any, el: HTMLElement) => {
    try { decorateSheet(app, el); decorateSafehouse(app, el); } catch (err) { console.warn('sr2e | trade', err); }
  });
  Hooks.on('renderTokenHUD', (hud: any, html: HTMLElement) => {
    try { decorateHud(hud, html); } catch (err) { console.warn('sr2e | trade HUD', err); }
  });
  Hooks.on('dropCanvasData', onDropCanvas);
  // The Loot window follows what the scene's lootable actors carry (it only renders while open).
  for (const h of ['updateActor', 'createItem', 'updateItem', 'deleteItem', 'updateToken', 'createToken', 'deleteToken']) Hooks.on(h, rerenderLoot);
  Hooks.on('canvasReady', rerenderLoot);
}

/** For game.sr2e.api (sr2e-system.ts). */
export const TRADE_API = {
  give: giveItem, giveNuyen, requestTransfer, setLootable, openLoot: openLoot942, setNesting: setTradeNesting,
};
