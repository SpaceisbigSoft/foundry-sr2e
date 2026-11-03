/**
 * v0.65.0: things under way (projects and training) on the sheet and in the GM panel: what is left, what was
 * paid, Give up (the owner: what was paid comes back), and for the GM, Change time… and Finish now.
 */
import { describeProject, timeLabel, hoursLeft } from '../rules/index.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';

const { DialogV2 } = foundry.applications.api;
/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;

export interface UnderwayRow { id: string; label: string; left: string; paid: string; training: boolean; due: boolean; leftHours: number; kind?: string }

/** Everything under way on an actor, soonest first. */
export function underwayRows(actor: any): UnderwayRow[] {
  const now = Number((game as any).time?.worldTime ?? 0);
  const rows: UnderwayRow[] = [];
  for (const p of (actor?.projects?.() ?? [])) {
    const d = describeProject(p, now);
    rows.push({ id: p.id, label: d.label, left: d.left, paid: d.paid, training: false, due: d.due, leftHours: hoursLeft(p, now), kind: String(p.kind ?? '') });
  }
  for (const t of ((actor?.system?.training as any[] | undefined) ?? [])) {
    const h = hoursLeft({ readyAt: Number(t.readyAt ?? 0) }, now);
    rows.push({ id: t.id, label: tx('SR2E.App.Projects.training', { label: t.label }), left: h > 0 ? timeLabel(h) : tx('SR2E.App.Projects.doneAtTheNextTimeStep'), paid: Number(t.cost ?? 0) ? tx('SR2E.App.Projects.karma', { cost: t.cost }) : '', training: true, due: h <= 0, leftHours: h });
  }
  return rows.sort((a, b) => a.leftHours - b.leftHours);
}

/** Ask the GM for the time left: a number and a unit (0 = done at the next time step). */
export async function promptTimeLeft(actor: any, id: string): Promise<void> {
  const row = underwayRows(actor).find((r) => r.id === id);
  if (!row) return;
  const r: any = await DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Projects.changeTime', { rowLabel: row.label }) },
    content: `<p>${esc(row.label)}: <strong>${esc(row.left)}</strong> ${tx('SR2E.Dialog.Projects.leftNow')}</p>
      <div class="form-group"><label>${tx('SR2E.Dialog.Projects.timeLeft')}</label><input name="amount" type="number" min="0" step="0.5" value="${Math.round(row.leftHours * 10) / 10}" autofocus>
      <select name="unit"><option value="1" selected>${tx('SR2E.Dialog.Projects.hours')}</option><option value="24">${tx('SR2E.Dialog.Projects.days')}</option><option value="168">${tx('SR2E.Dialog.Projects.weeks')}</option></select></div>
      <p class="hint">${tx('SR2E.Dialog.Projects.fromNowInGameTime0')}</p>`,
    ok: { label: tx('SR2E.Dialog.Projects.set'), callback: (_e: Event, b: any) => ({ hours: Math.max(0, Number(b.form.elements.amount.value) || 0) * Number(b.form.elements.unit.value || 1) }) },
    rejectClose: false,
  });
  if (r && typeof r.hours === 'number') await actor.setProjectTimeLeft(id, r.hours);
}

/** Give up (the owner) or the GM's controls, by the row's dataset (data-project-id, data-training). */
export async function projectAction(actor: any, act: string, id: string, training: boolean): Promise<void> {
  if (!actor || !id) return;
  if (act === 'cancel') {
    if (!actor.isOwner) { ui.notifications?.warn?.(tx('SR2E.Notify.Projects.onlySOwnerCanGiveIt', { actorName: escHtml(actor.name) })); return; }
    const ok = await DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Projects.giveItUp') }, content: `<p>${tx('SR2E.Dialog.Projects.giveThisUpWhatWasPaid')}</p>`, rejectClose: false } as any);
    if (!ok) return;
    if (training) await actor.cancelTraining(id); else await actor.cancelProject(id);
  } else if (act === 'finish') {
    if (!game.user?.isGM) return;
    await actor.finishProject(id);
  } else if (act === 'time') {
    if (!game.user?.isGM) return;
    await promptTimeLeft(actor, id);
  }
}

/** Sheet actions (registered on the character sheet; `this` is the sheet). */
export const PROJECT_SHEET_ACTIONS: Record<string, (this: any, e: Event, t: HTMLElement) => any> = {
  projectCancel: function (this: any, _e: Event, t: HTMLElement) { return projectAction(this.document, 'cancel', t.dataset['projectId'] ?? '', t.dataset['training'] === '1'); },
  projectFinish: function (this: any, _e: Event, t: HTMLElement) { return projectAction(this.document, 'finish', t.dataset['projectId'] ?? '', t.dataset['training'] === '1'); },
  projectTime: function (this: any, _e: Event, t: HTMLElement) { return projectAction(this.document, 'time', t.dataset['projectId'] ?? '', t.dataset['training'] === '1'); },
};
