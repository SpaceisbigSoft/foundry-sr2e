/**
 * v0.93.3 (report item 38): a shared Team Karma tracker the whole table can see. An optional table aid (world setting
 * `teamKarmaOn`, off by default): SR2's own Karma Pool stays per character and is untouched. The GM sets the count
 * (− / +); a player spends one through the GM's client (the relay: players never write world settings), and every
 * change posts a short chat line, so the table sees who used it.
 */
import { SYSTEM } from '../config/system.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';
import { onRelay, requestGm } from './socket.ts';
import { teamKarmaNext } from '../rules/teamkarma.ts';

const { ApplicationV2 } = foundry.applications.api;

export const TEAM_KARMA_ON = 'teamKarmaOn';
export const TEAM_KARMA = 'teamKarma';

function setting<T>(key: string, fallback: T): T {
  try { return ((game as any).settings.get(SYSTEM.id, key) ?? fallback) as T; } catch { return fallback; }
}

export function teamKarmaOn(): boolean { return Boolean(setting(TEAM_KARMA_ON, false)); }
export function teamKarmaNow(): number { return Math.max(0, Math.floor(Number(setting(TEAM_KARMA, 0)) || 0)); }

/** Store a new count (the GM's client) and say so in chat. */
async function store(next: number, who: string, change: number): Promise<void> {
  await (game as any).settings.set(SYSTEM.id, TEAM_KARMA, next);
  const line = change < 0 ? tx('SR2E.App.TeamKarma.spentNote', { who: escHtml(who), n: Number(next) || 0 }) : tx('SR2E.App.TeamKarma.setNote', { who: escHtml(who), n: Number(next) || 0 });
  await ChatMessage.create({ content: `<div class="sr2e-team-karma-note"><p>${line}</p></div>` });
}

/** The GM's − / + (a GM only). */
export async function adjustTeamKarma(delta: number): Promise<void> {
  if (!(game as any).user?.isGM) return;
  const r = teamKarmaNext(teamKarmaNow(), delta, true);
  if (!r.ok) return;
  await store(r.value, String((game as any).user?.name ?? tx('SR2E.Card.Teamkarma.gm')), delta);
}

/** A player spends one (asks the GM's client); a GM spends one directly. */
export async function spendTeamKarma(): Promise<void> {
  if (!teamKarmaOn()) return;
  if ((game as any).user?.isGM) {
    const r = teamKarmaNext(teamKarmaNow(), -1, true);
    if (!r.ok) { ui.notifications.warn(tx('SR2E.App.TeamKarma.none')); return; }
    await store(r.value, String((game as any).user?.name ?? tx('SR2E.Card.Teamkarma.gm')), -1);
    return;
  }
  const res = await requestGm('teamKarma', { delta: -1 });
  if (!res.ok) ui.notifications.warn(res.note ? escHtml(res.note) : tx('SR2E.App.TeamKarma.none'));
}

/** The small window: the count, the GM's − / +, everyone's "Spend one". */
export class SR2TeamKarma extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'sr2e-team-karma',
    classes: ['sr2e', 'sr2e-team-karma'],
    window: { title: 'SR2E.App.TeamKarma.title', icon: 'fa-solid fa-people-group', resizable: false },
    position: { width: 240, height: 'auto' as const },
    actions: {
      tkMinus: () => { void adjustTeamKarma(-1); },
      tkPlus: () => { void adjustTeamKarma(1); },
      tkSpend: () => { void spendTeamKarma(); },
    },
  };

  static open(): SR2TeamKarma {
    const open = (foundry as any).applications?.instances?.get?.('sr2e-team-karma');
    if (open) { open.bringToFront?.(); return open; }
    const app = new SR2TeamKarma();
    void app.render({ force: true });
    return app;
  }

  async _renderHTML(): Promise<string> {
    if (!teamKarmaOn()) return `<p class="hint">${tx('SR2E.App.TeamKarma.off')}</p>`;
    const gm = Boolean((game as any).user?.isGM);
    const n = teamKarmaNow();
    return `<div class="sr2e-team-karma-body">
      <div class="sr2e-team-karma-count" aria-live="polite"><b>${n}</b><span>${tx('SR2E.App.TeamKarma.label')}</span></div>
      <div class="sr2e-team-karma-buttons">
        ${gm ? `<button type="button" data-action="tkMinus" aria-label="${escHtml(tx('SR2E.App.TeamKarma.minus'))}" ${n > 0 ? '' : 'disabled'}>−</button>` : ''}
        <button type="button" data-action="tkSpend" ${n > 0 ? '' : 'disabled'}>${tx('SR2E.App.TeamKarma.spend')}</button>
        ${gm ? `<button type="button" data-action="tkPlus" aria-label="${escHtml(tx('SR2E.App.TeamKarma.plus'))}">+</button>` : ''}
      </div>
    </div>`;
  }

  _replaceHTML(result: string, content: HTMLElement): void {
    content.innerHTML = result;
  }
}

function rerender(): void {
  const open = (foundry as any).applications?.instances?.get?.('sr2e-team-karma');
  if (open?.rendered) void open.render();
}

export function registerTeamKarma(): void {
  const s: any = (game as any).settings;
  s.register(SYSTEM.id, TEAM_KARMA_ON, {
    name: 'SR2E.Settings.teamKarmaOn.Name', hint: 'SR2E.Settings.teamKarmaOn.Hint',
    scope: 'world', config: true, type: Boolean, default: false, onChange: () => rerender(),
  });
  s.register(SYSTEM.id, TEAM_KARMA, { scope: 'world', config: false, type: Number, default: 0, onChange: () => rerender() });
  // A player's "Spend one": run on the active GM's client, as that player (the server-set sender).
  onRelay('teamKarma', async (data, user) => {
    if (!teamKarmaOn()) return { ok: false, note: tx('SR2E.App.TeamKarma.off') };
    if (Number(data?.delta) !== -1) return { ok: false };
    const r = teamKarmaNext(teamKarmaNow(), -1, Boolean(user?.isGM));
    if (!r.ok) return { ok: false, note: tx('SR2E.App.TeamKarma.none') };
    await store(r.value, String(user?.name ?? '?'), -1);
    return { ok: true };
  });
}
