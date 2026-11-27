/**
 * v0.94.2 (improvement plan item 31): Revert on an advancement-log line (Foundry glue; the pure parts are in
 * rules/revert942.ts).
 *
 * - The GM reverts directly, after a confirmation listing what changes.
 * - A player who owns the character reverts directly only while the rating lock is off for them (`ratingLocked`
 *   false: they could type the same change themselves); otherwise their client posts an Apply (GM) card (flag
 *   `advRevert`, only the actor's uuid and the line's id). The GM's client works the revert out again from the actor
 *   as it is then, never from the card, and confirms it.
 * - v0.94.2 review (1): the log is player data, so the GM's client (card or sheet) applies its own checks: each step a
 *   strict lowering of an allowed raise field, the Karma refund at most what the rules charge for it, no nuyen refund,
 *   and "already reverted" from its own hidden world record (`revertDone`) as well as the line's mark. The plan the GM
 *   confirmed must still be the plan inside the lock.
 * - A revert lowers ratings: it writes with `sr2eNoAdvance` and goes around the sheet's lock on purpose (the lock in
 *   `refuseLockedRaises` only refuses raises typed into a sheet, and a revert never raises).
 */
import { SYSTEM_ID } from '../config/system.ts';
import { t as tx } from '../helpers/i18n.ts';
import { escHtml } from '../rules/html.ts';
import { advancementOf, advancementTime, ratingLocked, LOG_FLAG } from './advancement.ts';
import { withGmLock } from './gmlock.ts';
import { attributeMaximumsWith, skillBandAttribute } from '../rules/charfix.ts';
import {
  planRevert, revertCheck, revertRoute, revertedLog, planSignature, withRevertDone, revertDoneFor, isInitiationLine,
  type RevertLine, type UndoStep, type RevertCheck, type RevertPlan, type GmRevertContext, type StepCostInfo,
} from '../rules/revert942.ts';

/** v0.94.2 review (1): the GM-written record of reverted lines (world, hidden: actor uuid → line ids). */
export const REVERT_DONE_SETTING = 'revertDone';

function revertDoneAll(): unknown {
  try { return game.settings.get(SYSTEM_ID, REVERT_DONE_SETTING); } catch { return {}; }
}

/** A step's price inputs, read from the actor and item now (never from the log). */
function costInfoOf(actor: any): (s: UndoStep) => StepCostInfo {
  return (s) => {
    if (s.doc === 'actor') {
      const m = /^system\.attributes\.(\w+)\.base$/.exec(s.key);
      const a = m ? actor?.system?.attributes?.[m[1]!] : null;
      if (!a) return null;
      const metatype = actor?.usesMetatypeSafe?.() !== false;
      const mx = metatype ? attributeMaximumsWith(actor.system?.metatype, m![1] as any, actor.system?.qualities ?? []) : { natural: 99, augmented: 99 };
      return { kind: 'attribute', natural: Number(a.natural ?? a.base ?? 0), max: mx.natural, augmented: mx.augmented };
    }
    const item = actor?.items?.get?.(s.itemId);
    if (!item) return null;
    if (item.type === 'spell') return { kind: 'spell' };
    if (item.type !== 'skill') return null;
    const kind = (item.system?.kind ?? 'active') as 'active' | 'knowledge' | 'language' | 'buildRepair';
    const attrKey = kind === 'active' || kind === 'buildRepair' ? String(item.system?.attribute ?? '') : 'intelligence';
    const attribute = skillBandAttribute(attrKey, actor.system?.attributes ?? {}, { derivedReaction: Number(actor.system?.derived?.reaction ?? 1), caller: 'improve' });
    return { kind: 'skill', skillKind: kind, attribute };
  };
}

/** The GM's checks for a revert (item types, prices and the record of reverted lines, none from the log). */
function gmContextOf(actor: any): GmRevertContext {
  return {
    itemType: (id) => { const i = actor?.items?.get?.(id); return i ? String(i.type) : null; },
    skillRating: (id) => Number(actor?.items?.get?.(id)?.system?.rating ?? 0),
    costInfo: costInfoOf(actor),
    done: revertDoneFor(revertDoneAll(), String(actor?.uuid ?? '')),
  };
}

/** A step's field on the actor now (null when its item is gone). */
function currentOf(actor: any): (s: UndoStep) => number | null {
  return (s) => {
    const doc = s.doc === 'item' ? actor?.items?.get?.(s.itemId) : actor;
    if (!doc) return null;
    const v = Number(foundry.utils.getProperty(doc, s.key) ?? 0);
    // An unset specialization or concentration rating counts as the skill's rating (as the log saw it).
    if (s.doc === 'item' && /Rating$/.test(s.key) && s.key !== 'system.rating' && !v) return Number(doc.system?.rating ?? 0);
    return Number.isFinite(v) ? v : 0;
  };
}

const logOf = (actor: any): RevertLine[] => advancementOf(actor) as RevertLine[];

/** The reason a check failed, as one line for the greyed control's tooltip. */
export function revertWhyText(c: RevertCheck, log: ReadonlyArray<RevertLine> = []): string {
  if (c.ok) return tx('SR2E.Revert.title');
  if (c.why === 'later') return tx('SR2E.Revert.Why.later', { what: String(log.find((l) => l.id === c.laterId)?.what ?? '') });
  if (c.why === 'changed') return tx('SR2E.Revert.Why.changed', { label: String(c.label ?? ''), now: Number(c.now ?? 0), expected: Number(c.expected ?? 0) });
  if (c.why === 'itemGone') return tx('SR2E.Revert.Why.itemGone', { label: String(c.label ?? '') });
  if (c.why === 'missing') return tx('SR2E.Revert.Why.missing');
  if (c.why === 'reverted') return tx('SR2E.Revert.Why.reverted');
  if (c.why === 'initiation') return tx('SR2E.Revert.Why.initiation');
  if (c.why === 'forged') return tx('SR2E.Revert.Why.forged');
  return tx('SR2E.Revert.Why.notRevertable');
}

/** For the sheet's log rows: whether to show Revert, whether it works now, and why not. */
export function revertRow(actor: any, line: RevertLine): { show: boolean; can: boolean; why: string; reverted: boolean } {
  const reverted = Boolean(line.revertedAt);
  const route = revertRoute({ isGM: Boolean(game.user?.isGM), isOwner: Boolean(actor?.isOwner), locked: false });
  // Nothing to revert (a note, an award, a line from before 0.94.2, a refund line): no control at all.
  // v0.94.2 review (4): an initiation shows the control greyed, with the reason.
  if (route === 'none' || reverted || ((!Array.isArray(line.undo) || !line.undo.length) && !isInitiationLine(line))) return { show: false, can: false, why: '', reverted };
  const log = logOf(actor);
  const c = revertCheck(log, line.id, currentOf(actor), game.user?.isGM ? gmContextOf(actor) : undefined);
  return { show: true, can: c.ok, why: revertWhyText(c, log), reverted };
}

/** The plan's changes as plain lines (for the confirmations). */
export function planLines(plan: RevertPlan): string[] {
  const out = plan.steps.map((s) => tx('SR2E.Revert.stepLine', { label: s.label, from: s.to, to: s.from }));
  if (plan.refund.karma) out.push(tx('SR2E.Revert.refundKarma', { karma: plan.refund.karma }));
  if (plan.refund.nuyen) out.push(tx('SR2E.Revert.refundNuyen', { nuyen: plan.refund.nuyen.toLocaleString() }));
  // v0.94.2 review (1): the GM sees why a refund is smaller than the line says.
  const claimed = plan.claimed;
  if (plan.costUnknown) out.push(tx('SR2E.Revert.noCost', { karma: claimed?.karma ?? 0 }));
  else if (claimed && claimed.karma > plan.refund.karma) out.push(tx('SR2E.Revert.capped', { claimed: claimed.karma, karma: plan.refund.karma }));
  if (plan.nuyenRefused) out.push(tx('SR2E.Revert.noNuyen', { nuyen: (claimed?.nuyen ?? 0).toLocaleString() }));
  return out;
}

/** The plan, from the actor now; on the GM's client with the GM's own checks (the log is player data). */
function planFor(actor: any, lineId: string, gm = Boolean(game.user?.isGM)): RevertPlan {
  return planRevert(logOf(actor), lineId, currentOf(actor), { karma: Number(actor?.system?.karma?.good ?? 0), nuyen: Number(actor?.system?.nuyen ?? 0) }, gm ? gmContextOf(actor) : undefined);
}

const li = (l: string): string => `<li>${escHtml(l)}</li>`;

async function confirmPlan(actor: any, plan: RevertPlan, what: string, who = ''): Promise<boolean> {
  const dlg: any = foundry.applications.api.DialogV2;
  return Boolean(await dlg.confirm({
    window: { title: tx('SR2E.Revert.confirmTitle', { name: actor.name }) },
    content: [
      who ? `<p>${tx('SR2E.Revert.askedBy', { who: escHtml(who) })}</p>` : '',
      `<p><strong>${escHtml(what)}</strong></p>`,
      `<ul>${planLines(plan).map(li).join('')}</ul>`,
      `<p class="hint">${tx('SR2E.Revert.confirmHint')}</p>`,
    ].join(''),
    rejectClose: false,
  }));
}

/**
 * Apply a revert on this client (worked out again here, from the actor now). With `expect` (the confirmed plan's
 * signature) a plan that differs is refused with a notice. The actor first (fields, refund, ledger line and marked log
 * in one update), then the GM's record, then the items; an item that fails puts everything back. True when done.
 */
export async function applyRevert(actor: any, lineId: string, by: string, o: { expect?: string } = {}): Promise<boolean> {
  const gm = Boolean(game.user?.isGM);
  const plan = planFor(actor, lineId, gm);
  if (!plan.ok) { ui.notifications?.warn?.(escHtml(revertWhyText(plan, logOf(actor)))); return false; }
  if (o.expect !== undefined && planSignature(plan) !== o.expect) { ui.notifications?.warn?.(tx('SR2E.Revert.planChanged')); return false; }
  const before = logOf(actor);
  const line = before.find((l) => l.id === lineId)!;
  const items = Object.entries(plan.items).map(([id, changes]) => ({ item: actor.items?.get?.(id), changes }));
  if (items.some((x) => !x.item)) return false;
  // What a rollback writes back: the actor's own fields as they are now.
  const get = (doc: any, k: string) => foundry.utils.getProperty(doc, k);
  const undoActor: Record<string, unknown> = { [`flags.${SYSTEM_ID}.${LOG_FLAG}`]: before, 'system.ledger': ((actor.system?.ledger ?? []) as any[]).map((l: any) => ({ ...l })) };
  for (const k of Object.keys(plan.actor)) undoActor[k] = get(actor, k);
  const at = new Date().toISOString(), t = advancementTime();
  const reason = tx('SR2E.Revert.ledgerReason', { what: line.what });
  const ledger = [...((actor.system?.ledger ?? []) as any[]).map((l: any) => ({ ...l }))];
  if (plan.refund.karma) ledger.push({ t, kind: 'karma', amount: plan.refund.karma, reason });
  if (plan.refund.nuyen) ledger.push({ t, kind: 'nuyen', amount: plan.refund.nuyen, reason });
  const log = revertedLog(before, lineId, { by, at, t, id: foundry.utils.randomID(), what: tx('SR2E.Revert.logLine', { what: line.what }), refund: plan.refund });
  await actor.update({
    ...plan.actor,
    ...(plan.refund.karma || plan.refund.nuyen ? { 'system.ledger': ledger } : {}),
    [`flags.${SYSTEM_ID}.${LOG_FLAG}`]: log,
  }, { sr2eNoAdvance: true });
  const doneBefore = revertDoneAll();
  if (gm) await game.settings.set(SYSTEM_ID, REVERT_DONE_SETTING, withRevertDone(doneBefore, String(actor.uuid), String(lineId)));
  const done: Array<{ item: any; back: Record<string, unknown> }> = [];
  try {
    for (const { item, changes } of items) {
      const back: Record<string, unknown> = {};
      for (const k of Object.keys(changes)) back[k] = get(item, k);
      await item.update(changes, { sr2eNoAdvance: true });
      done.push({ item, back });
    }
  } catch (err) {
    // v0.94.2 review (12): put back what went through, so the line can be tried again.
    console.error(err);
    for (const d of done.reverse()) { try { await d.item.update(d.back, { sr2eNoAdvance: true }); } catch (e) { console.error(e); } }
    try { await actor.update(undoActor, { sr2eNoAdvance: true }); } catch (e) { console.error(e); }
    if (gm) { try { await game.settings.set(SYSTEM_ID, REVERT_DONE_SETTING, doneBefore); } catch (e) { console.error(e); } }
    ui.notifications?.error?.(tx('SR2E.Revert.failed'));
    return false;
  }
  return true;
}

/** The sheet's Revert control (data-id = the line's id). */
export async function revertFromSheet(actor: any, lineId: string): Promise<void> {
  if (!actor || !lineId) return;
  const route = revertRoute({ isGM: Boolean(game.user?.isGM), isOwner: Boolean(actor.isOwner), locked: ratingLocked(actor) });
  if (route === 'none') return;
  const plan = planFor(actor, lineId);
  if (!plan.ok) { ui.notifications?.warn?.(escHtml(revertWhyText(plan, logOf(actor)))); return; }
  const what = String(logOf(actor).find((l) => l.id === lineId)?.what ?? '');
  if (!(await confirmPlan(actor, plan, what))) return;
  const expect = planSignature(plan);
  // The GM's own revert runs under the GM lock too (it writes the GM's record of reverted lines).
  if (route === 'direct') { const go = () => applyRevert(actor, lineId, String(game.user?.name ?? ''), { expect }); await (game.user?.isGM ? withGmLock(go) : go()); return; }
  // A player under the lock: an Apply (GM) card. Its text is for reading; the GM's client re-plans from the actor.
  const gms = [...((game as any).users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }), whisper: [...new Set([...gms, game.user?.id].filter(Boolean))],
    content: `<p>${tx('SR2E.Revert.cardAsk', { name: escHtml(actor.name), what: escHtml(what) })}</p><ul>${planLines(plan).map(li).join('')}</ul><p><button type="button" data-sr2e-action="applyAdvRevert">${tx('SR2E.Revert.applyGm')}</button></p>`,
    flags: { [SYSTEM_ID]: { advRevert: { actorUuid: String(actor.uuid), lineId: String(lineId) } } },
  });
  ui.notifications?.info?.(tx('SR2E.Revert.sentToGm'));
}

/** GM, before the lock: the revert a card asks for, worked out from the actor now, confirmed. Null = nothing to do. */
export async function confirmAdvRevertCard(v: { actorUuid?: unknown; lineId?: unknown }, message: any): Promise<{ actorUuid: string; lineId: string; expect: string } | null> {
  const actorUuid = String(v?.actorUuid ?? ''), lineId = String(v?.lineId ?? '');
  let actor: any = null;
  try { actor = await fromUuid(actorUuid); } catch { actor = null; }
  if (!actor || actor.documentName !== 'Actor') { ui.notifications?.warn?.(tx('SR2E.Revert.Why.missing')); return null; }
  const plan = planFor(actor, lineId);
  if (!plan.ok) { ui.notifications?.warn?.(escHtml(revertWhyText(plan, logOf(actor)))); return null; }
  const what = String(logOf(actor).find((l) => l.id === lineId)?.what ?? '');
  return (await confirmPlan(actor, plan, what, String(message?.author?.name ?? ''))) ? { actorUuid, lineId, expect: planSignature(plan) } : null;
}

/**
 * GM, inside the lock: apply a confirmed card's revert, credited to the card's author (who asked) and the GM. Planned
 * again here with the GM's checks; refused when that plan is not the one the GM confirmed (`expect`).
 */
export async function applyAdvRevertAsGm(v: { actorUuid: string; lineId: string; expect: string }, message: any): Promise<boolean> {
  if (!game.user?.isGM) return false;
  const actor: any = await fromUuid(v.actorUuid);
  if (!actor) return false;
  const by = [message?.author?.name, game.user?.name].filter(Boolean).map(String);
  return applyRevert(actor, v.lineId, [...new Set(by)].join(', '), { expect: v.expect });
}
