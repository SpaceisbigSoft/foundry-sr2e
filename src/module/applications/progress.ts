/**
 * v0.93.5 (UI-13.6): progress on long jobs (loading a catalogue file, building a scene). Foundry's own progress
 * notification (v13+: `ui.notifications.info(text, { progress: true })` gives back a notification with
 * `update({ message, pct })`), and, where the job runs from a window, a bar in that window (`<progress>` with
 * aria-valuenow and "n of N" text). Updates are throttled (at most one every ~100 ms) so the bar doesn't slow the job.
 * The pure parts are rules/gm935.ts (progressState, progressThrottle).
 */
import { progressState, progressThrottle } from '../rules/gm935.ts';
import { t as tx } from '../helpers/i18n.ts';
import { escHtml } from '../rules/html.ts';

export interface Progress {
  /** Steps done so far (drawn at most every ~100 ms; the last step always). */
  set(done: number, label?: string): void;
  /** One more step done (or `k` more). */
  tick(label?: string, k?: number): void;
  /** Change the number of steps (a job that learns how big it is as it goes). */
  setTotal(total: number): void;
  /** The job ended (the notification goes, the window's bar hides). */
  done(): void;
}

/** The "n of N" text: "Loading the catalogue: 12 of 40". */
export function progressText(label: string, done: number, total: number): string {
  const s = progressState(done, total);
  return tx('SR2E.App.Progress.nOfTotal', { label, done: s.done, total: s.total });
}

/** Draw a bar: a `<progress>` (or any element with role="progressbar") and its text. */
export function drawBar(root: HTMLElement | null | undefined, label: string, done: number, total: number): void {
  const box = root?.querySelector?.<HTMLElement>('[data-sr2e-progress]');
  if (!box) return;
  const s = progressState(done, total);
  box.hidden = false;
  const bar = box.querySelector<HTMLElement>('progress, [role="progressbar"]');
  if (bar) {
    if (bar.tagName === 'PROGRESS') { (bar as HTMLProgressElement).max = s.total; (bar as HTMLProgressElement).value = s.done; }
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(s.total));
    bar.setAttribute('aria-valuenow', String(s.done));
    bar.setAttribute('aria-valuetext', progressText(label, s.done, s.total));
  }
  const text = box.querySelector<HTMLElement>('[data-sr2e-progress-text]');
  if (text) text.textContent = progressText(label, s.done, s.total);
}

/**
 * Start a progress display for a job of `total` steps: Foundry's progress notification, and the window's bar when
 * `root` (a rendered window's element with a `[data-sr2e-progress]` box) is given.
 */
export function startProgress(label: string, total: number, o: { root?: () => HTMLElement | null | undefined; minMs?: number } = {}): Progress {
  let n = 0;
  let max = Math.max(1, Math.floor(Number(total) || 0));
  let text = label;
  const gate = progressThrottle(o.minMs ?? 100);
  let note: any = null;
  try { note = (globalThis as any).ui?.notifications?.info?.(escHtml(progressText(text, 0, max)), { progress: true }) ?? null; } catch { note = null; }
  const draw = (force = false) => {
    const now = (globalThis as any).performance?.now?.() ?? Date.now();
    if (!force && !gate.due(now, n, max)) return;
    const s = progressState(n, max);
    try { note?.update?.({ message: escHtml(progressText(text, s.done, s.total)), pct: s.pct }); } catch { /* an older Foundry: no progress notifications */ }
    try { drawBar(o.root?.(), text, s.done, s.total); } catch { /* the window closed */ }
  };
  return {
    set(done: number, l?: string) { n = Math.max(0, Math.floor(Number(done) || 0)); if (l) text = l; draw(); },
    tick(l?: string, k = 1) { n += Math.max(0, Math.floor(Number(k) || 0)); if (l) text = l; draw(); },
    setTotal(t: number) { max = Math.max(1, Math.floor(Number(t) || 0)); draw(); },
    done() {
      n = max;
      draw(true);
      try {
        const box = o.root?.()?.querySelector?.<HTMLElement>('[data-sr2e-progress]');
        if (box) box.hidden = true;
      } catch { /* closed */ }
      // A finished progress notification goes by itself in Foundry v13+; remove it in case it stays.
      try { if (note && note.active !== false) (globalThis as any).ui?.notifications?.remove?.(note); } catch { /* gone */ }
    },
  };
}
