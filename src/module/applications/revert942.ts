/**
 * v0.94.2 (improvement plan item 31): Revert on an advancement-log line (Foundry glue; the pure parts are in
 * rules/revert942.ts).
 *
 * - The GM reverts directly, after a confirmation listing what changes.
 * - A player who owns the character reverts directly only while the rating lock is off for them (`ratingLocked`
 *   false: they could type the same change themselves); otherwise their client posts an Apply (GM) card (flag
 *   `advRevert`, only the actor's uuid and the line's id). The GM's client works the revert out again from the actor
 *   as it is then, never from the card, and confirms it.
 * - A revert lowers ratings: it writes with `sr2eNoAdvance` and goes around the sheet's lock on purpose (the lock in
 *   `refuseLockedRaises` only refuses raises typed into a sheet, and a revert never raises).
 */
import { SYSTEM_ID } from '../config/system.ts';
import { t as tx } from '../helpers/i18n.ts';
import { escHtml } from '../rules/html.ts';
import { advancementOf, ratingLocked, LOG_FLAG } from './advancement.ts';
import { planRevert, revertCheck, revertRoute, revertedLog, type RevertLine, type UndoStep, type RevertCheck, type RevertPlan } from '../rules/revert942.ts';

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
  return tx(`SR2E.Revert.Why.${c.why || 'notRevertable'}`);
}

/** For the sheet's log rows: whether to show Revert, whether it works now, and why not. */
export function revertRow(actor: any, line: RevertLine): { show: boolean; can: boolean; why: string; reverted: boolean } {
  const reverted = Boolean(line.revertedAt);
  const route = revertRoute({ isGM: Boolean(game.user?.isGM), isOwner: Boolean(actor?.isOwner), locked: false });
  // Nothing to revert (a note, an award, a line from before 0.94.2, a refund line): no control at all.
  if (route === 'none' || reverted || !Array.isArray(line.undo) || !line.undo.length) return { show: false, can: false, why: '', reverted };
  const log = logOf(actor);
  const c = revertCheck(log, line.id, currentOf(actor));
  return { show: true, can: c.ok, why: revertWhyText(c, log), reverted };
}

/** The plan's changes as plain lines (for the confirmations). */
export function planLines(plan: RevertPlan): string[] {
  const out = plan.steps.map((s) => tx('SR2E.Revert.stepLine', { label: s.label, from: s.to, to: s.from }));
  if (plan.refund.karma) out.push(tx('SR2E.Revert.refundKarma', { karma: plan.refund.karma }));
  if (plan.refund.nuyen) out.push(tx('SR2E.Revert.refundNuyen', { nuyen: plan.refund.nuyen.toLocaleString() }));
  return out;
}

function planFor(actor: any, lineId: string): RevertPlan {
  return planRevert(logOf(actor), lineId, currentOf(actor), { karma: Number(actor?.system?.karma?.good ?? 0), nuyen: Number(actor?.system?.nuyen ?? 0) });
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
 * Apply a revert on this client (worked out again here, from the actor now). The items first, then the actor with its
 * refund, its ledger line and the marked log in one update. True when done.
 */
export async function applyRevert(actor: any, lineId: string, by: string): Promise<boolean> {
  const plan = planFor(actor, lineId);
  if (!plan.ok) { ui.notifications?.warn?.(escHtml(revertWhyText(plan, logOf(actor)))); return false; }
  const line = logOf(actor).find((l) => l.id === lineId)!;
  for (const [id, changes] of Object.entries(plan.items)) {
    const item = actor.items?.get?.(id);
    if (!item) return false;
    await item.update(changes, { sr2eNoAdvance: true });
  }
  const at = new Date().toISOString(), t = Number((game as any).time?.worldTime ?? 0);
  const reason = tx('SR2E.Revert.ledgerReason', { what: line.what });
  const ledger = [...((actor.system?.ledger ?? []) as any[]).map((l: any) => ({ ...l }))];
  if (plan.refund.karma) ledger.push({ t, kind: 'karma', amount: plan.refund.karma, reason });
  if (plan.refund.nuyen) ledger.push({ t, kind: 'nuyen', amount: plan.refund.nuyen, reason });
  const log = revertedLog(logOf(actor), lineId, { by, at, t, id: foundry.utils.randomID(), what: tx('SR2E.Revert.logLine', { what: line.what }), refund: plan.refund });
  await actor.update({
    ...plan.actor,
    ...(plan.refund.karma || plan.refund.nuyen ? { 'system.ledger': ledger } : {}),
    [`flags.${SYSTEM_ID}.${LOG_FLAG}`]: log,
  }, { sr2eNoAdvance: true });
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
  if (route === 'direct') { await applyRevert(actor, lineId, String(game.user?.name ?? '')); return; }
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
export async function confirmAdvRevertCard(v: { actorUuid?: unknown; lineId?: unknown }, message: any): Promise<{ actorUuid: string; lineId: string } | null> {
  const actorUuid = String(v?.actorUuid ?? ''), lineId = String(v?.lineId ?? '');
  let actor: any = null;
  try { actor = await fromUuid(actorUuid); } catch { actor = null; }
  if (!actor || actor.documentName !== 'Actor') { ui.notifications?.warn?.(tx('SR2E.Revert.Why.missing')); return null; }
  const plan = planFor(actor, lineId);
  if (!plan.ok) { ui.notifications?.warn?.(escHtml(revertWhyText(plan, logOf(actor)))); return null; }
  const what = String(logOf(actor).find((l) => l.id === lineId)?.what ?? '');
  return (await confirmPlan(actor, plan, what, String(message?.author?.name ?? ''))) ? { actorUuid, lineId } : null;
}

/** GM, inside the lock: apply a confirmed card's revert, credited to the card's author (who asked) and the GM. */
export async function applyAdvRevertAsGm(v: { actorUuid: string; lineId: string }, message: any): Promise<boolean> {
  if (!game.user?.isGM) return false;
  const actor: any = await fromUuid(v.actorUuid);
  if (!actor) return false;
  const by = [message?.author?.name, game.user?.name].filter(Boolean).map(String);
  return applyRevert(actor, v.lineId, [...new Set(by)].join(', '));
}
