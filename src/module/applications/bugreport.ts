/**
 * v0.87.0: "Report a bug" (the Foundry glue for `rules/bugreport.ts`).
 *
 * From the moment the system loads, the last few console errors and warnings that mention the system (its log
 * prefix, or a stack through `systems/sr2e/`) are kept in memory, in this browser only. The **Report a bug** window
 * (the guide's button, Configure Settings, or `game.sr2e.api.bugReport()`) shows a ready-to-paste text with the
 * versions, the active modules, the rules source, the changed house rules and those errors, with a Copy button.
 * Nothing is sent anywhere by itself.
 */
import { SYSTEM } from '../config/system.ts';
import { bugReportText, entryText, isOurError, pushEntry, type BugFacts } from '../rules/bugreport.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';

const esc = escHtml;
const log: Array<{ at: string; text: string }> = [];
let capturing = false;

let inKeep = false;

/** Keep one entry, if it is the system's (guarded: nothing it calls can log into itself). */
function keep(text: string): void {
  if (inKeep || !text || !isOurError(text)) return;
  inKeep = true;
  try { pushEntry(log, text, new Date().toISOString().slice(11, 19)); } finally { inKeep = false; }
}

/** The client setting that turns the log off (read straight from storage: the log starts before settings exist). */
export const KEEP_ERRORS_KEY = 'keepErrors';
function keepingOff(): boolean {
  try { return globalThis.localStorage?.getItem(`${SYSTEM.id}.${KEEP_ERRORS_KEY}`) === 'false'; } catch { return false; }
}

/**
 * Start keeping the system's console errors (once, as early as possible: at module load).
 * Wrapping console.error/warn makes the browser's console show this file as the source line of every warning; a
 * player or module author who minds can turn it off (Configure Settings: "Keep recent errors for bug reports").
 */
export function startErrorLog(): void {
  if (capturing || keepingOff()) return;
  capturing = true;
  const c: any = console;
  for (const level of ['error', 'warn'] as const) {
    const original = c[level]?.bind(console);
    if (typeof original !== 'function') continue;
    c[level] = (...args: unknown[]) => {
      if (!inKeep) { try { keep(`${level === 'warn' ? 'warning: ' : ''}${entryText(args)}`); } catch { /* never break logging */ } }
      return original(...args);
    };
  }
  try {
    window.addEventListener('error', (ev: ErrorEvent) => {
      const where = `${ev.filename ?? ''}:${ev.lineno ?? ''}`;
      if (isOurError(where) || isOurError(String(ev.error?.stack ?? ''))) keep(`sr2e | ${entryText([ev.error ?? ev.message, `(${where})`])}`);
    });
    window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
      const r: any = ev.reason;
      const t = entryText([r]);
      if (isOurError(t) || isOurError(String(r?.stack ?? ''))) keep(`sr2e | unhandled: ${t}`);
    });
  } catch { /* no window (tests) */ }
}

/** The kept entries (a copy). */
export function errorLog(): Array<{ at: string; text: string }> { return log.map((e) => ({ ...e })); }

/** Gather the facts for a report from this client. */
export function bugFacts(): BugFacts {
  const g: any = game;
  let houseRules: Record<string, unknown> = {};
  try {
    const hr: any = g.settings.get(SYSTEM.id, 'houseRules') ?? {};
    houseRules = { ...(hr.advanced ?? {}), ...(hr.values ?? {}) };
  } catch { /* not registered */ }
  let rulesSource = 'book';
  try { rulesSource = String(g.settings.get(SYSTEM.id, 'rulesSource') ?? 'book'); } catch { /* not registered */ }
  const settings: string[] = [];
  for (const [key, label] of [['defendPrompt', 'When attacked'], ['autoApplyGm', 'Apply GM-only changes by themselves'], ['approvalQueue', 'Approval queue'], ['moduleSupport', 'Module support'], ['foldDice', 'Fold dice']] as const) {
    try { const v = g.settings.get(SYSTEM.id, key); if (v !== undefined && v !== null && v !== '') settings.push(`${label}: ${typeof v === 'string' ? v : JSON.stringify(v)}`); } catch { /* not registered */ }
  }
  const modules = [...(g.modules?.values?.() ?? [])].filter((m: any) => m?.active)
    .map((m: any) => ({ id: String(m.id ?? ''), version: String(m.version ?? '') })).sort((a, b) => a.id.localeCompare(b.id));
  return {
    system: String(g.system?.version ?? ''),
    foundry: `${String(g.version ?? g.release?.version ?? '')}${g.release?.generation ? ` (generation ${g.release.generation})` : ''}`,
    browser: String(globalThis.navigator?.userAgent ?? ''),
    role: g.user?.isGM ? 'GM' : 'Player',
    rulesSource,
    houseRules,
    modules,
    errors: errorLog(),
    settings,
  };
}

/** The report text (the API). */
export function bugReport(): string { return bugReportText(bugFacts()); }

/** The window: the text, Copy and Close. */
export class SR2BugReport extends (foundry as any).applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'sr2e-bug-report',
    classes: ['sr2e', 'sr2e-bug-report'],
    window: { title: 'SR2E.Window.Bugreport.sr2eReportABug', icon: 'fa-solid fa-bug', resizable: true },
    position: { width: 600, height: 620 },
    actions: { copyReport: SR2BugReport.#onCopy, refreshReport: SR2BugReport.#onRefresh },
  };

  static open(): SR2BugReport {
    const existing = (foundry as any).applications.instances.get('sr2e-bug-report');
    const w = existing ?? new SR2BugReport();
    void w.render({ force: true });
    return w;
  }

  async _renderHTML(): Promise<string> {
    const text = bugReport();
    const bugs = String((game as any).system?.bugs ?? '');
    // The address as text (copy it into the browser), not a link: system.json is the system's own, but a link out of
    // Foundry isn't needed for this.
    const where = /^https:\/\//.test(bugs)
      ? `${tx('SR2E.App.Bugreport.copyThisTextPasteItAt')} <code>${esc(bugs)}</code> ${tx('SR2E.App.Bugreport.andFillInWhatHappened')}`
      : tx('SR2E.App.Bugreport.copyThisTextPasteItGithub');
    return `<div class="sr2e-bug-body">
      <p class="hint">${where} <strong>${tx('SR2E.App.Bugreport.nothingIsSentAnywhereByItself')}</strong> ${tx('SR2E.App.Bugreport.readItBeforePosting')}</p>
      <textarea class="sr2e-bug-text" readonly aria-label="${tx('SR2E.App.Bugreport.bugReportText')}" spellcheck="false">${esc(text)}</textarea>
      <footer class="form-footer">
        <button type="button" data-action="refreshReport"><i class="fa-solid fa-rotate" aria-hidden="true"></i> ${tx('SR2E.App.Bugreport.refresh')}</button>
        <button type="button" data-action="copyReport" class="default"><i class="fa-solid fa-copy" aria-hidden="true"></i> ${tx('SR2E.App.Bugreport.copy')}</button>
      </footer>
    </div>`;
  }

  _replaceHTML(result: string, content: HTMLElement): void {
    content.innerHTML = result;
  }

  static async #onCopy(this: any): Promise<void> {
    const area: HTMLTextAreaElement | null = this.element?.querySelector('.sr2e-bug-text') ?? null;
    const text = area?.value ?? bugReport();
    try {
      await navigator.clipboard.writeText(text);
      ui.notifications?.info?.(tx('SR2E.Notify.Bugreport.bugReportCopiedPasteItInto'));
    } catch {
      // No clipboard permission (an insecure origin, for example): select it for Ctrl+C.
      area?.focus();
      area?.select();
      ui.notifications?.info?.(tx('SR2E.Notify.Bugreport.pressCtrlCOrCmdC'));
    }
  }

  static #onRefresh(this: any): void { void this.render(); }
}

export function openBugReport(): SR2BugReport { return SR2BugReport.open(); }

export function registerBugReport(): void {
  (game as any).settings.register(SYSTEM.id, KEEP_ERRORS_KEY, {
    name: "SR2E.Settings.keepErrors.Name",
    hint: "SR2E.Settings.keepErrors.Hint",
    scope: 'client', config: true, type: Boolean, default: true, requiresReload: true,
  });
  (game as any).settings.registerMenu(SYSTEM.id, 'bugReportMenu', {
    name: "SR2E.Settings.bugReportMenu.Name", label: "SR2E.Settings.bugReportMenu.Label", hint: "SR2E.Settings.bugReportMenu.Hint",
    icon: 'fa-solid fa-bug', type: SR2BugReport, restricted: false,
  });
}

startErrorLog();
