/**
 * v0.64.0: the creation record and the advancement log (Foundry glue; the rules are in rules/advancement.ts).
 *
 * - `recordCreation(actor, …)` freezes the character into `flags.sr2e.creation` (the Creation tab).
 * - Once a character has a record, the client that changes it notes what was gained: new items, raised
 *   ratings, and new ledger lines (Karma in and out, nuyen spent on what was bought). Changes within
 *   `RULES_ADVANCEMENT.burstMs` of each other make one burst, written as dated lines to
 *   `flags.sr2e.advancement` (with `sr2eNoAdvance`, so the write isn't noted itself).
 * - Whoever made the change is "by"; an approved request credits the player and the approving GM.
 */
import { SYSTEM } from '../config/system.ts';
import {
  creationRecordFrom, composeAdvancementV73, appendAdvancement, ledgerAdded, itemRaises, actorRaises, LOGGED_ITEM_TYPES, RULES_ADVANCEMENT,
  ratingLockApplies, lockedRaises, normalizeTweaks, type AdvanceEvent, type AdvanceLine, type CreationRecord, type BuildRow,
} from '../rules/index.ts';
import { creationRecordOf, approvalContext, queueOn, inCreation, RECORD_FLAG, DRAFT_FLAG } from './approvals.ts';
import { RULES } from '../rules/config.ts';
import { urrCoreStartPool } from '../rules/urr80-core.ts';
import { startPoolPatch } from '../rules/core923.ts';
import { madeHere } from './leader.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

export const LOG_FLAG = 'advancement';

/** The character's log (oldest first). */
export function advancementOf(actor: any): AdvanceLine[] {
  const l = actor?.flags?.[SYSTEM.id]?.[LOG_FLAG];
  return Array.isArray(l) ? l.filter((x: any) => x && typeof x.what === 'string') : [];
}

/** A plain view of the actor for the record. */
export function characterView(actor: any): { system: any; items: Array<{ type: string; name: string; system: any }> } {
  const sys = actor.system?.toObject?.() ?? foundry.utils.deepClone(actor.system ?? {});
  // Derived values aren't in the source: take natural ratings and Essence from the prepared data.
  for (const [k, a] of Object.entries((actor.system?.attributes ?? {}) as Record<string, any>)) if (sys.attributes?.[k]) sys.attributes[k].natural = a.natural ?? a.base;
  sys.derived = { essence: actor.system?.derived?.essence ?? sys.essence };
  return { system: sys, items: [...(actor.items ?? [])].map((i: any) => ({ type: i.type, name: i.name, system: i.system?.toObject?.() ?? i.system ?? {} })) };
}

/** Freeze the character now. The draft goes; the log starts (with a first line). */
export async function recordCreation(actor: any, o: { how: 'wizard' | 'asIs'; priorities?: any; checks?: ReadonlyArray<BuildRow> }): Promise<CreationRecord> {
  const rec = creationRecordFrom(characterView(actor), {
    by: String(game.user?.name ?? ''), now: new Date().toISOString(), worldTime: Number((game as any).time?.worldTime ?? 0), how: o.how,
    priorities: o.priorities ?? actor.getFlag?.(SYSTEM.id, 'build') ?? {}, checks: o.checks ?? [],
  });
  const first: AdvanceLine = {
    id: foundry.utils.randomID(), at: rec.finishedAt, t: rec.worldTime, by: rec.by, approvedBy: '', karma: 0, nuyen: 0, kind: 'note',
    what: o.how === 'wizard' ? (rec.failed ? tCount(rec.failed, 'SR2E.App.Advancement.creationFinishedBuildChecks') : tx('SR2E.App.Advancement.creationFinished')) : tx('SR2E.App.Advancement.creationRecordedAsTheCharacter'),
  };
  await actor.update({
    // v0.92.3 (RULES.CORE_V923.startPool 'book', Core p. 47): a metahuman starts with a Karma Pool of 2, a human 1.
    ...(o.how === 'wizard' ? startPoolPatch(actor.system?.metatype, Number(actor.system?.karma?.pool ?? 0)) : {}),
    // v0.80.0 (RULES.URR_V80.coreStartPoolByMeta): {} in the book.
    ...(o.how === 'wizard' ? urrCoreStartPool(actor.system?.metatype, Number(actor.system?.karma?.pool ?? 0)) : {}),
    [`flags.${SYSTEM.id}.${RECORD_FLAG}`]: rec,
    [`flags.${SYSTEM.id}.${DRAFT_FLAG}`]: null,
    [`flags.${SYSTEM.id}.${LOG_FLAG}`]: appendAdvancement(advancementOf(actor), [first]),
  }, { sr2eNoAdvance: true });
  return rec;
}

/** GM: take the record away so creation can be done again (the log stays). */
export async function reopenCreation(actor: any): Promise<void> {
  await actor.update({
    [`flags.${SYSTEM.id}.${RECORD_FLAG}`]: null,
    [`flags.${SYSTEM.id}.${DRAFT_FLAG}`]: { step: 'review', startedAt: new Date().toISOString(), by: String(game.user?.name ?? '') },
    [`flags.${SYSTEM.id}.${LOG_FLAG}`]: appendAdvancement(advancementOf(actor), [{ id: foundry.utils.randomID(), at: new Date().toISOString(), t: Number((game as any).time?.worldTime ?? 0), by: String(game.user?.name ?? ''), approvedBy: '', karma: 0, nuyen: 0, kind: 'note', what: tx('SR2E.App.Advancement.creationReopened') }]),
  }, { sr2eNoAdvance: true });
}

/** A note written by hand into the log (GM). */
export async function addAdvancementNote(actor: any, text: string, karma = 0, nuyen = 0): Promise<void> {
  const what = String(text ?? '').trim();
  if (!what) return;
  const line: AdvanceLine = { id: foundry.utils.randomID(), at: new Date().toISOString(), t: Number((game as any).time?.worldTime ?? 0), by: String(game.user?.name ?? ''), approvedBy: '', karma: Math.trunc(karma), nuyen: Math.trunc(nuyen), kind: 'note', what };
  await actor.update({ [`flags.${SYSTEM.id}.${LOG_FLAG}`]: appendAdvancement(advancementOf(actor), [line]) }, { sr2eNoAdvance: true });
}

/** v0.65.0: a project finished (bought, learned, made or repaired): one line, credited to whoever started it. */
export async function logProjectDone(actor: any, what: string, by: string, early = false, approvedBy = ''): Promise<void> {
  if (actor?.type !== 'character' || !creationRecordOf(actor)) return;
  // v0.73.0 (O42): the GM who approved the request that started it, and the GM who finished it early.
  const approvers = [...new Set([approvedBy, early ? String(game.user?.name ?? '') : ''].filter(Boolean))].join(', ');
  const line: AdvanceLine = { id: foundry.utils.randomID(), at: new Date().toISOString(), t: Number((game as any).time?.worldTime ?? 0), by: String(by ?? ''), approvedBy: approvers, karma: 0, nuyen: 0, kind: 'gain', what: `Done: ${what}${early ? ' (finished early by the GM)' : ''}` };
  await actor.update({ [`flags.${SYSTEM.id}.${LOG_FLAG}`]: appendAdvancement(advancementOf(actor), [line]) }, { sr2eNoAdvance: true });
}

export async function deleteAdvancementLine(actor: any, id: string): Promise<void> {
  await actor.update({ [`flags.${SYSTEM.id}.${LOG_FLAG}`]: advancementOf(actor).filter((l) => l.id !== id) }, { sr2eNoAdvance: true });
}

// ---- The recorder

interface Burst { events: AdvanceEvent[]; timer: ReturnType<typeof setTimeout> | null; by: string; approvedBy: string }
const bursts = new Map<string, Burst>();

/** Is a change to this actor worth noting here? (Characters with a record, changed from this client.) */
function watched(actor: any, options: any, userId: string): boolean {
  return Boolean(actor) && actor.type === 'character' && madeHere(options, userId) && !options?.sr2eNoAdvance && !options?.sr2eUndoing && Boolean(creationRecordOf(actor));
}

function note(actor: any, events: AdvanceEvent[]): void {
  if (!events.length) return;
  const uuid = String(actor.uuid);
  const ctx = approvalContext(uuid);
  const by = ctx?.requester ?? String(game.user?.name ?? ''), approvedBy = ctx?.gm ?? '';
  let b = bursts.get(uuid);
  // A change by someone else (or approved, or not) starts its own burst: each gets the right credit.
  if (b && (b.by !== by || b.approvedBy !== approvedBy)) {
    if (b.timer) clearTimeout(b.timer);
    void flush(actor, uuid);
    b = undefined;
  }
  if (!b) { b = { events: [], timer: null, by, approvedBy }; bursts.set(uuid, b); }
  b.events.push(...events);
  if (b.timer) clearTimeout(b.timer);
  b.timer = setTimeout(() => void flush(actor, uuid), RULES_ADVANCEMENT.burstMs);
}

async function flush(actor: any, uuid: string): Promise<void> {
  const b = bursts.get(uuid);
  bursts.delete(uuid);
  if (!b?.events.length) return;
  // The actor as it is now (an unlinked token's actor may have been replaced).
  const a: any = (fromUuidSync as any)?.(uuid) ?? actor;
  if (!a?.isOwner || !creationRecordOf(a)) return;
  // v0.73.0 (O42): nuyen refunds of logged purchases are logged too (RULES.CROSSCUT_V73.advancement).
  const lines = composeAdvancementV73(b.events, { by: b.by, approvedBy: b.approvedBy, at: new Date().toISOString(), t: Number((game as any).time?.worldTime ?? 0), ids: () => foundry.utils.randomID(), log: advancementOf(a) } as any);
  if (!lines.length) return;
  try { await a.update({ [`flags.${SYSTEM.id}.${LOG_FLAG}`]: appendAdvancement(advancementOf(a), lines) }, { sr2eNoAdvance: true }); } catch (err) { console.warn('sr2e | advancement log', err); }
}

/** Wait for the bursts to be written (tests and the approval flow). */
export async function flushAdvancement(): Promise<void> {
  for (const [uuid, b] of [...bursts]) {
    if (b.timer) clearTimeout(b.timer);
    await flush((fromUuidSync as any)?.(uuid), uuid);
  }
}

const flat = (o: any) => (foundry.utils.flattenObject?.(o ?? {}) ?? {}) as Record<string, unknown>;

export function registerAdvancementHooks(): void {
  Hooks.on('createItem', (item: any, options: any, userId: string) => {
    const actor = item?.parent;
    if (!watched(actor, options, userId) || !LOGGED_ITEM_TYPES.includes(item.type)) return;
    const qty = Number(item.system?.quantity ?? 1);
    note(actor, [{ kind: 'item', type: item.type, name: String(item.name), ...(qty > 1 ? { amount: qty } : {}) }]);
  });
  // The "before" values are only on this client before the change: they travel in the options.
  Hooks.on('preUpdateItem', (item: any, changes: any, options: any, userId: string) => {
    const actor = item?.parent;
    if (!watched(actor, options, userId)) return;
    const raises = itemRaises(item.type, String(item.name), item.system, flat(changes));
    // Keyed by item: one batched update shares its options between all its items.
    if (raises.length) options.sr2eAdvRaises = { ...(options.sr2eAdvRaises ?? {}), [item.id]: raises };
  });
  Hooks.on('updateItem', (item: any, _c: any, options: any, userId: string) => {
    const actor = item?.parent;
    const raises = options?.sr2eAdvRaises?.[item?.id];
    if (!watched(actor, options, userId) || !Array.isArray(raises)) return;
    note(actor, raises.map((r: any) => ({ kind: 'raise', label: String(r.label), from: Number(r.from), to: Number(r.to) })));
  });
  Hooks.on('preUpdateActor', (actor: any, changes: any, options: any, userId: string) => {
    if (!watched(actor, options, userId)) return;
    const f = flat(changes);
    const events: AdvanceEvent[] = actorRaises(actor.system, f).map((r) => ({ kind: 'raise', ...r }));
    const next = changes?.system?.ledger ?? f['system.ledger'];
    if (Array.isArray(next)) for (const entry of ledgerAdded((actor.system?.ledger ?? []) as any[], next)) events.push({ kind: 'ledger', entry });
    if (events.length) options.sr2eAdvEvents = events;
  });
  Hooks.on('updateActor', (actor: any, _c: any, options: any, userId: string) => {
    if (!watched(actor, options, userId) || !Array.isArray(options?.sr2eAdvEvents)) return;
    note(actor, options.sr2eAdvEvents);
  });
}

// ---- Rating edits after creation (players raise ratings through Spend Karma, not by typing)

/** Does the lock apply to this user on this actor? */
export function ratingLocked(actor: any): boolean {
  // v0.92.1 (RULES.SHEET_V921.ratingLock 'queue', the owner's choice: "everything stays editable after creation"): the
  // lock holds only while the GM's approval queue is on; 'always' is the old lock.
  if (RULES.SHEET_V921.ratingLock === 'queue' && !queueOn()) return false;
  // A character made before the wizard (no record, not in the wizard) counts as finished while the approval queue is on.
  const finished = Boolean(creationRecordOf(actor)) || (queueOn() && !inCreation(actor));
  return ratingLockApplies({ isGM: Boolean(game.user?.isGM), actorType: String(actor?.type ?? ''), finished });
}

/**
 * v0.92.1: a player's raise typed in after creation, with the lock off ('queue' and no approval queue): kept, with a
 * notice that it skipped Spend Karma (the advancement log records the change as it does every change).
 */
export function noteUnlockedRaises(doc: any, kind: 'actor' | 'item', changes: Record<string, unknown>): number {
  const actor = kind === 'item' ? doc?.parent : doc;
  if (game.user?.isGM || actor?.type !== 'character' || !creationRecordOf(actor) || ratingLocked(actor)) return 0;
  const hit = lockedRaises(kind, String(doc?.type ?? ''), (k) => foundry.utils.getProperty(doc, k), changes).filter((h) => h.key !== 'system.essence');
  if (hit.length) ui.notifications?.info?.(tx('SR2E.Notify.Advancement.raisedWithoutKarma'));
  return hit.length;
}

/**
 * Drop locked raises from an edit (flattened `changes` is changed in place); says which were refused.
 * `kind` 'item' uses the item's type and values; 'actor' the actor's.
 */
export function refuseLockedRaises(doc: any, kind: 'actor' | 'item', changes: Record<string, unknown>): string[] {
  const actor = kind === 'item' ? doc?.parent : doc;
  if (!ratingLocked(actor)) { noteUnlockedRaises(doc, kind, changes); return []; }
  const hit = lockedRaises(kind, String(doc?.type ?? ''), (k) => foundry.utils.getProperty(doc, k), changes);
  // v0.92.1 review (R7): while the lock holds, a player's new or changed custom tweak (other than a note, or one switched
  // off or removed) is refused too: a tweak would otherwise raise what the lock protects.
  const tweakHit = kind === 'item' && Object.prototype.hasOwnProperty.call(changes, 'system.tweaks') && tweaksRaise(doc?.system?.tweaks, changes['system.tweaks']);
  if (tweakHit) { delete changes['system.tweaks']; ui.notifications?.warn?.(tx('SR2E.Notify.Advancement.tweaksLocked')); }
  // With the approval queue on, typing more nuyen or Karma is refused too (the GM awards them).
  const money = kind === 'actor' && queueOn() ? MONEY_FIELDS.filter((k) => Object.prototype.hasOwnProperty.call(changes, k) && Number(changes[k]) > Number(foundry.utils.getProperty(doc, k) ?? 0)) : [];
  for (const h of hit) delete changes[h.key];
  for (const k of money) delete changes[k];
  if (hit.length) ui.notifications?.warn?.(tx('SR2E.Notify.Advancement.creationIsFinishedRaiseWithSpend', { part: hit.length === 1 ? tx('SR2E.Notify.Advancement.thatRating') : tx('SR2E.Notify.Advancement.thoseRatings') }));
  if (money.length) ui.notifications?.warn?.(tx('SR2E.Notify.Advancement.theApprovalQueueIsOnThe'));
  return [...hit.map((h) => h.key), ...money, ...(tweakHit ? ['system.tweaks'] : [])];
}

/** v0.92.1 review (R7): whether a tweak list adds or strengthens a counting tweak (a note, one switched off or removed is fine). */
export function tweaksRaise(before: unknown, after: unknown): boolean {
  const key = (t: any) => `${t.target}|${t.key}|${t.value}`;
  const had = new Set(normalizeTweaks(before).filter((t) => t.on && t.target !== 'note').map(key));
  return normalizeTweaks(after).some((t) => t.on && t.target !== 'note' && t.value !== 0 && !had.has(key(t)));
}

const MONEY_FIELDS = ['system.nuyen', 'system.karma.good', 'system.karma.career', 'system.karma.pool'];
