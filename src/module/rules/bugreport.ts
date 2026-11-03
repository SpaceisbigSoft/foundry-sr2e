/**
 * v0.87.0: "Report a bug" (pure part). `applications/bugreport.ts` gathers the facts from Foundry and keeps a short
 * log of the system's recent console errors; this file turns them into plain text ready to paste into a GitHub
 * issue. Nothing is sent anywhere: the text is shown in a window with a Copy button.
 */

export interface BugFacts {
  system: string;
  foundry: string;
  /** The browser (or the desktop app), as its user agent reports it. */
  browser: string;
  /** 'GM' or 'Player' (never a user name). */
  role: string;
  rulesSource: string;
  /** House rules changed from the default: path → value (the GM's world setting). */
  houseRules: Record<string, unknown>;
  modules: Array<{ id: string; version: string }>;
  errors: Array<{ at: string; text: string }>;
  /** Client settings that change how things look or roll (layout, theme…), as short "name: value" lines. */
  settings?: string[];
}

/** How many console entries are kept, and how long each may be. */
export const BUG_LOG_SIZE = 20;
export const BUG_ENTRY_MAX = 600;

/**
 * Pure: whether a console message or error belongs to the system: its log prefix ("sr2e | …"), or a stack line
 * through its files. (v0.87.0 review: objects are never turned into text first, so a module logging a document from
 * an sr2e world, which holds "sr2e" in its flags, isn't kept.)
 */
export function isOurError(text: string): boolean {
  return /(^|[\s:'"(\[])sr2e \||systems\/sr2e\//i.test(String(text ?? ''));
}

/**
 * Pure: one console entry as text, cheaply: strings as they are, errors as their message and first stack lines,
 * anything else only as its kind ("[object]"): never JSON (no deep copies of documents, no getters run).
 */
export function entryText(args: unknown[]): string {
  const part = (a: unknown): string => {
    if (a instanceof Error) {
      const stack = String(a.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim()).join(' | ');
      return `${a.name}: ${a.message}${stack ? ` [${stack}]` : ''}`;
    }
    if (typeof a === 'string') return a;
    if (typeof a === 'number' || typeof a === 'boolean' || a === null || a === undefined) return String(a);
    return Array.isArray(a) ? '[array]' : `[${typeof a}]`;
  };
  const t = args.map(part).join(' ').replace(/\s+/g, ' ').trim();
  return t.length > BUG_ENTRY_MAX ? `${t.slice(0, BUG_ENTRY_MAX - 1)}…` : t;
}

/** Pure: add an entry to the kept log (newest last, at most `max`; the same text again just counts up). */
export function pushEntry(log: Array<{ at: string; text: string }>, text: string, at: string, max = BUG_LOG_SIZE): void {
  if (!text) return;
  const last = log[log.length - 1];
  const m = last ? /^(.*?)(?: \(×(\d+)\))?$/s.exec(last.text) : null;
  if (last && m && m[1] === text) { last.text = `${text} (×${Number(m[2] ?? 1) + 1})`; last.at = at; return; }
  log.push({ at, text });
  while (log.length > max) log.shift();
}

/** Pure: a value from the house rules, short and on one line. */
function shortValue(v: unknown): string {
  let s: string;
  try { s = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v); } catch { s = String(v); }
  s = String(s).replace(/\s+/g, ' ');
  return s.length > 120 ? `${s.slice(0, 119)}…` : s;
}

/** Pure: the report text (Markdown, as GitHub shows it). */
/** The report (v0.89.6: stays English on purpose: it is written for the maintainers, as a GitHub issue). */
export function bugReportText(f: BugFacts): string {
  const rules = Object.keys(f.houseRules ?? {}).sort();
  const lines: string[] = [
    '### What happened',
    '',
    '(Describe the problem: what you did, what you expected, what happened instead.)',
    '',
    '### Steps to reproduce',
    '',
    '1. ',
    '',
    '### System information',
    '',
    `- sr2e: ${f.system || '?'}`,
    `- Foundry VTT: ${f.foundry || '?'}`,
    `- Browser: ${f.browser || '?'}`,
    `- Reporting as: ${f.role || '?'}`,
    `- Rules source: ${f.rulesSource || 'book'}`,
    `- House rules changed: ${rules.length ? rules.length : 'none'}`,
    ...rules.map((k) => `  - \`${k}\` = ${shortValue(f.houseRules[k])}`),
    `- Active modules: ${f.modules.length ? f.modules.length : 'none'}`,
    ...f.modules.map((m) => `  - ${m.id} ${m.version}`),
  ];
  if (f.settings?.length) lines.push('- Settings:', ...f.settings.map((s) => `  - ${s}`));
  lines.push('', '### Recent SR2e console errors', '');
  if (f.errors.length) {
    lines.push('```');
    for (const e of f.errors) lines.push(`[${e.at}] ${e.text.replace(/```/g, "'''")}`);
    lines.push('```');
  } else lines.push('(none since this page was loaded)');
  lines.push('', '_Made by the system\'s "Report a bug" button. Check it before posting: error messages can name things in your world._');
  return lines.join('\n');
}
