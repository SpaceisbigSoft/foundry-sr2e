/**
 * GM tools (v0.51.0): the pure parts of the GM panel. The undo log (what a change was before, how
 * to put it back, whether anything has changed it since, how changes group into steps), the dice
 * and TN calculator's odds, world-time steps and labels, scene presets and the party summary.
 * No Foundry here; `applications/undo.ts` and `applications/ui.ts` do the glue.
 */
import { RULES } from './config.ts';
import { t as tx, tCount, tNoun } from '../helpers/i18n.ts';

// ---------------------------------------------------------------- Paths and values

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};

/** A deep copy that survives JSON (documents' source data always does). */
export function copyValue<T>(v: T): T {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

export function getAt(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let o: any = obj;
  for (const k of path.split('.')) {
    if (o === null || o === undefined || typeof o !== 'object') return undefined;
    o = o[k];
  }
  return o;
}

export function hasAt(obj: unknown, path: string): boolean {
  if (!path) return obj !== undefined;
  const keys = path.split('.');
  let o: any = obj;
  for (const k of keys) {
    if (o === null || o === undefined || typeof o !== 'object' || !Object.prototype.hasOwnProperty.call(o, k)) return false;
    o = o[k];
  }
  return true;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// ---------------------------------------------------------------- What a change was before

/** One changed field: its path, whether it existed and its value before, and (once known) after. */
export interface FieldChange {
  path: string;
  had: boolean;
  before: unknown;
  hadAfter?: boolean;
  after?: unknown;
}

/**
 * The fields an update touches, with their values before it. Walks the update the way Foundry
 * merges it: into plain objects that already exist, stopping at anything else (values, arrays,
 * Foundry's replace / delete operators, and `-=` / `==` keys), which is recorded whole.
 * With `recursive: false` each top-level key is replaced whole, so it is recorded whole.
 */
export function beforeValues(source: unknown, changes: unknown, opts: { recursive?: boolean } = {}): FieldChange[] {
  const out: FieldChange[] = [];
  const seen = new Set<string>();
  const recursive = opts.recursive !== false;
  const record = (p: string) => {
    if (!p || seen.has(p)) return;
    // A field inside one already recorded whole is covered by it.
    for (const s of seen) if (p.startsWith(`${s}.`)) return;
    seen.add(p);
    out.push({ path: p, had: hasAt(source, p), before: copyValue(getAt(source, p)) });
  };
  const walk = (obj: Record<string, unknown>, prefix: string, depth: number) => {
    for (const [rawKey, v] of Object.entries(obj)) {
      if (!prefix && (rawKey === '_id' || rawKey === '_stats')) continue;
      const segs = rawKey.split('.');
      let last = segs.pop() ?? '';
      let op = '';
      if (last.startsWith('-=') || last.startsWith('==')) { op = last.slice(0, 2); last = last.slice(2); }
      const base = [prefix, ...segs].filter(Boolean).join('.');
      const p = base ? `${base}.${last}` : last;
      if (op || (!recursive && depth === 0)) { record(p); continue; }
      const old = getAt(source, p);
      if (isPlain(v) && isPlain(old) && depth < 16) walk(v, p, depth + 1);
      else record(p);
    }
  };
  if (isPlain(changes)) walk(changes, '', 0);
  return out;
}

/** The same fields after the change (for the "changed since" check). */
export function afterValues(source: unknown, fields: readonly FieldChange[]): FieldChange[] {
  return fields.map((f) => ({ ...f, hadAfter: hasAt(source, f.path), after: copyValue(getAt(source, f.path)) }));
}

/**
 * The update that puts the fields back: old values set again, objects replaced whole (`==`), and
 * fields that didn't exist before removed (`-=`).
 */
export function inverseUpdate(fields: readonly FieldChange[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const i = f.path.lastIndexOf('.');
    const parent = i < 0 ? '' : f.path.slice(0, i);
    const last = f.path.slice(i + 1);
    const key = (op: string) => (parent ? `${parent}.${op}${last}` : `${op}${last}`);
    if (!f.had) out[key('-=')] = null;
    else if (isPlain(f.before)) out[key('==')] = copyValue(f.before);
    else out[f.path] = copyValue(f.before);
  }
  return out;
}

/** Fields something else has changed since this change (their value now isn't what it left). */
export function changedSince(current: unknown, fields: readonly FieldChange[]): FieldChange[] {
  return fields.filter((f) => f.hadAfter !== undefined
    && (hasAt(current, f.path) !== f.hadAfter || (f.hadAfter && !same(getAt(current, f.path), f.after))));
}

// ---------------------------------------------------------------- Steps

export type UndoOp = 'update' | 'create' | 'delete';

/** One change to one document. */
export interface UndoEntry {
  op: UndoOp;
  /** Foundry's document name (Actor, Item, ChatMessage, Setting...). */
  docName: string;
  uuid: string;
  /** What to show: the document's name (a card's title). */
  name: string;
  /** For a deleted embedded document: where to create it again. */
  parentUuid?: string | null;
  /** For updates. */
  fields?: FieldChange[];
  /** For deletions: the whole document as it was. */
  data?: unknown;
  /** A world setting's key ('sr2e.magicGroups', 'core.time'). */
  settingKey?: string;
  /** A chat message with no system flags or dice (typed chat). */
  plainChat?: boolean;
}

/** One user's burst of changes: what one Undo puts back. */
export interface UndoStep {
  id: string;
  userId: string;
  userName: string;
  started: number;
  last: number;
  label: string;
  entries: UndoEntry[];
  /** More changes came than the step keeps: those can't be undone. */
  partial?: boolean;
}

/** How long a step that moved world time stays open for what the time change sets off. */
export const TIME_STEP_WINDOW_MS = 5000;

export interface UndoOptions { windowMs: number; maxSteps: number; maxEntries: number; skipPlainChat: boolean }

const undoOptions = (): UndoOptions => ({
  windowMs: RULES.GM_TOOLS.undo.windowMs, maxSteps: RULES.GM_TOOLS.undo.maxSteps,
  maxEntries: RULES.GM_TOOLS.undo.maxEntries, skipPlainChat: RULES.GM_TOOLS.undo.skipPlainChat,
});

/** Two field paths overlap when one is the other or inside it. */
export const pathsOverlap = (a: string, b: string): boolean => a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);

/**
 * What to check before undoing a step, change by change. Only the newest change in the step to a
 * field can have been "changed since" (older ones are put back after it, so they are compared
 * with what the newer one leaves); a document deleted later in the step comes back before its
 * older changes are undone, so it isn't "gone"; nor is a parent deleted later in the step.
 */
export function stepChecks(step: UndoStep): Array<{ entry: UndoEntry; fields: FieldChange[]; checkGone: boolean; checkParent: boolean }> {
  const seen = new Map<string, string[]>();
  const deleted = new Set<string>();
  const out: Array<{ entry: UndoEntry; fields: FieldChange[]; checkGone: boolean; checkParent: boolean }> = [];
  for (const e of [...step.entries].reverse()) {
    if (e.op === 'update') {
      const later = seen.get(e.uuid) ?? [];
      const recreated = deleted.has(e.uuid);
      const fields = recreated ? [] : (e.fields ?? []).filter((f) => !later.some((p) => pathsOverlap(p, f.path)));
      out.push({ entry: e, fields, checkGone: !recreated, checkParent: false });
      seen.set(e.uuid, [...later, ...(e.fields ?? []).map((f) => f.path)]);
    } else if (e.op === 'delete') {
      out.push({ entry: e, fields: [], checkGone: false, checkParent: Boolean(e.parentUuid) && !deleted.has(String(e.parentUuid)) });
      deleted.add(e.uuid);
    } else {
      out.push({ entry: e, fields: [], checkGone: false, checkParent: false });
    }
  }
  return out;
}

/** The step changed most recently (what Undo takes back first). */
export function newestStep(log: readonly UndoStep[]): UndoStep | null {
  let best: UndoStep | null = null;
  for (const s of log) if (!best || s.last >= best.last) best = s;
  return best;
}

/**
 * Add a change to the log: to the user's own open step when it came within the window, else a new
 * step. A plain chat line that would start a step is skipped (typed chat isn't a game change). The
 * oldest steps drop off past the limit. Returns the step it went into (null when skipped).
 */
export function logChange(log: UndoStep[], entry: UndoEntry, who: { userId: string; userName: string }, now: number,
  makeId: () => string, o: UndoOptions = undoOptions()): UndoStep | null {
  let open: UndoStep | null = null;
  for (const s of log) if (s.userId === who.userId && (!open || s.last > open.last)) open = s;
  // A world-time step stays open longer: timed effects (drugs, rent, diseases…) land a moment after it.
  const win = open?.entries.some((e) => e.settingKey === 'core.time') ? Math.max(o.windowMs, TIME_STEP_WINDOW_MS) : o.windowMs;
  if (open && now - open.last <= win) {
    open.last = now;
    if (open.entries.length >= o.maxEntries) { open.partial = true; return open; }
    open.entries.push(entry);
    open.label = stepLabel(open);
    return open;
  }
  if (entry.plainChat && o.skipPlainChat) return null;
  const step: UndoStep = { id: makeId(), userId: who.userId, userName: who.userName, started: now, last: now, label: '', entries: [entry] };
  step.label = stepLabel(step);
  log.push(step);
  while (log.length > Math.max(1, o.maxSteps)) {
    let oldest = 0;
    for (let i = 1; i < log.length; i++) if (log[i]!.last < log[oldest]!.last) oldest = i;
    log.splice(oldest, 1);
  }
  return step;
}

/** Names Foundry gives its documents, in words. */
const DOC_WORDS: Record<string, string> = {
  Actor: 'actor', Item: 'item', ChatMessage: 'card', ActiveEffect: 'status', Token: 'token', Scene: 'scene', Wall: 'wall',
  Drawing: 'drawing', Combat: 'combat', Combatant: 'combatant', Setting: 'setting', MeasuredTemplate: 'template', AmbientLight: 'light',
};
export const docWord = (docName: string): string => DOC_WORDS[docName] ?? docName.toLowerCase();

/** Friendly names for the fields people change most. */
const FIELD_WORDS: Array<[RegExp, string]> = [
  [/^system\.monitor\.physical$/, 'Physical'], [/^system\.monitor\.stun$/, 'Stun'],
  [/^system\.matrix\.monitor$/, 'Matrix monitor'], [/^system\.condition$/, 'damage'],
  [/^system\.nuyen$/, 'nuyen'], [/^system\.karma\.good$/, 'Good Karma'], [/^system\.karma\.pool$/, 'Karma Pool'],
  [/^system\.karma\.poolSpent$/, 'Karma Pool spent'], [/^system\.karma\.career$/, 'career Karma'],
  [/^system\.poolSpent\.(\w+)$/, '$1 Pool spent'], [/^system\.ammo$/, 'ammo'], [/^system\.quantity$/, 'quantity'],
  [/^system\.tally$/, 'tally'], [/^system\.alert$/, 'alert'], [/^system\.essenceShift$/, 'Essence'],
  [/^system\.attributes\.(\w+)\.base$/, '$1'], [/^system\.rating$/, 'rating'], [/^system\.ledger$/, 'ledger'],
  [/^system\.sustaining$/, 'sustained spells'], [/^system\.drugs$/, 'drugs'], [/^system\.diseases$/, 'diseases'],
  [/^system\.lifestyle\.paidUntil$/, 'lifestyle paid until'], [/^value$/, 'value'], [/^initiative$/, 'initiative'],
  [/^round$/, 'Combat Turn'], [/^turn$/, 'turn'], [/^statuses$/, 'statuses'], [/^darkness$|^environment\.darknessLevel$/, 'darkness'],
];

/** A field's path in words: "Physical", "combat Pool spent", "flag cardRolls". */
export function fieldLabel(path: string): string {
  for (const [re, word] of FIELD_WORDS) if (re.test(path)) return path.replace(re, word);
  const parts = path.split('.');
  if (parts[0] === 'flags') return tx('SR2E.Text.Gmtools.flag', { name: parts.slice(2).join('.') || parts[1] || '' }).trim();
  if (parts[0] === 'system') parts.shift();
  return parts.slice(-2).join(' ');
}

/** A value in a few characters. */
export function shortValue(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? tx('SR2E.Text.Gmtools.yes') : tx('SR2E.Text.Gmtools.no');
  if (typeof v === 'number') return String(Math.round(v * 100) / 100);
  if (typeof v === 'string') return v.length > 24 ? `${v.slice(0, 23)}…` : v;
  if (Array.isArray(v)) return tCount(v.length, 'SR2E.Text.Gmtools.items');
  return '{…}';
}

/** One change in words. */
export function describeEntry(e: UndoEntry): string {
  const what = e.name ? tx('SR2E.Text.Gmtools.docNamed', { doc: docWord(e.docName), name: e.name }).trim() : docWord(e.docName).trim();
  if (e.op === 'create' && e.settingKey === 'core.time') return tx('SR2E.Text.Gmtools.worldTimeStarted');
  if (e.op === 'create' && e.settingKey) return tx('SR2E.Text.Gmtools.settingFirstSaved', { name: e.name });
  if (e.op === 'create') return tx('SR2E.Text.Gmtools.created', { what });
  if (e.op === 'delete') return tx('SR2E.Text.Gmtools.deleted', { what });
  if (e.settingKey === 'core.time') {
    const f = e.fields?.find((x) => x.path === 'value');
    return tx('SR2E.Text.Gmtools.worldTimeChange', { before: shortTime(f?.before), after: shortTime(f?.after) });
  }
  const fields = (e.fields ?? []).filter((f) => !/^flags\.core\b|^_stats/.test(f.path));
  if (!fields.length) return tx('SR2E.Text.Gmtools.updated', { what });
  const shown = fields.slice(0, 4).map((f) => `${fieldLabel(f.path)} ${shortValue(f.before)} → ${f.hadAfter === undefined ? '?' : shortValue(f.after)}`);
  const who = e.name || docWord(e.docName);
  return fields.length > 4
    ? tx('SR2E.Text.Gmtools.fieldsChangedMore', { who, list: shown.join(', '), count: fields.length - 4 })
    : `${who}: ${shown.join(', ')}`;
}

const shortTime = (v: unknown) => {
  let n = NaN;
  try { n = Number(typeof v === 'string' ? JSON.parse(v || '0') : v); } catch { /* not a number */ }
  return Number.isFinite(n) ? formatWorldTime(n) : '?';
};

/** A step's name: its first card's title, else who and what changed. */
export function stepLabel(step: UndoStep): string {
  const card = step.entries.find((e) => e.op === 'create' && e.docName === 'ChatMessage' && e.name);
  if (card) return card.name;
  const time = step.entries.find((e) => e.settingKey === 'core.time' && e.op === 'update');
  if (time) return describeEntry(time);
  const names = [...new Set(step.entries.map((e) => e.name || docWord(e.docName)))];
  const first = step.entries[0];
  const head = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
  if (step.entries.length === 1 && first) return describeEntry(first);
  return tCount(step.entries.length, 'SR2E.Text.Gmtools.stepChanges', { head });
}

/** A card's title from its HTML: the first heading, else the first words. */
export function cardTitle(html: string, flavor = ''): string {
  const strip = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  const f = strip(flavor);
  if (f) return f.length > 70 ? `${f.slice(0, 69)}…` : f;
  const h = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(html);
  const t = strip(h ? h[1]! : html);
  return t.length > 70 ? `${t.slice(0, 69)}…` : t;
}

/** Keep a stored log sane (bad entries dropped). */
export function sanitizeLog(raw: unknown): UndoStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s: any) => s && typeof s.id === 'string' && Array.isArray(s.entries) && typeof s.last === 'number')
    .map((s: any) => ({ ...s, entries: s.entries.filter((e: any) => e && ['update', 'create', 'delete'].includes(e.op) && typeof e.uuid === 'string') }));
}

/** Milliseconds as words for the undo panel: "1.5 seconds", "1 second". */
const secs = (ms: number): string => {
  const n = Math.round(ms / 100) / 10;
  return tCount(n, 'SR2E.Text.Gmtools.seconds');
};

/**
 * What undo can't put back, in words for the panel. v0.81.0 (RC-12): built from the undo rules (`undo.maxSteps`,
 * `undo.windowMs`) each time, so a house rule changes the text too.
 */
export function undoLimits(o: UndoOptions = undoOptions()): string[] {
  return undoLimitRows(o).map((r) => r.text);
}

/** The ids of the undo limits rows (`notLogged`: the row of things never logged, which bookkeeping.ts anchors on). */
export type UndoLimitId = 'dice' | 'notOpen' | 'tokenMoves' | 'notDocuments' | 'notLogged' | 'partly' | 'changedSince' | 'oneStep' | 'twoGms' | 'tooBig';

/**
 * v0.89.6: the same list with an id per row, so code that looks for one row (bookkeeping.ts `undoLimitsV73`) finds it
 * by id, not by its English words.
 */
export function undoLimitRows(o: UndoOptions = undoOptions()): Array<{ id: UndoLimitId; text: string }> {
  return [
    { id: 'dice', text: tx('SR2E.Text.Gmtools.limitDice') },
    { id: 'notOpen', text: tx('SR2E.Text.Gmtools.limitNotOpen', { steps: o.maxSteps }) },
    { id: 'tokenMoves', text: tx('SR2E.Text.Gmtools.limitTokenMoves') },
    { id: 'notDocuments', text: tx('SR2E.Text.Gmtools.limitNotDocuments') },
    { id: 'notLogged', text: tx('SR2E.Text.Gmtools.limitNotLogged') },
    { id: 'partly', text: tx('SR2E.Text.Gmtools.limitPartly') },
    { id: 'changedSince', text: tx('SR2E.Text.Gmtools.limitChangedSince') },
    { id: 'oneStep', text: tx('SR2E.Text.Gmtools.limitOneStep', { within: secs(o.windowMs), open: secs(Math.max(o.windowMs, TIME_STEP_WINDOW_MS)) }) },
    { id: 'twoGms', text: tx('SR2E.Text.Gmtools.limitTwoGms') },
    { id: 'tooBig', text: tx('SR2E.Text.Gmtools.limitTooBig') },
  ];
}


// ---------------------------------------------------------------- Ctrl+Z: the canvas and the log (v0.51.0)

/**
 * Which undo Ctrl+Z takes: the newest SR2e step or the active canvas layer's newest history entry,
 * whichever came last (`slackMs`: a step logged at the same moment as a canvas entry counts as
 * newer, since it may hold more than that one canvas change). Null = nothing to undo.
 */
export function pickUndo(stepLast: number | null, canvasAt: number | null, slackMs = 250): 'sr2e' | 'canvas' | null {
  if (stepLast === null && canvasAt === null) return null;
  if (canvasAt === null) return 'sr2e';
  if (stepLast === null) return 'canvas';
  return stepLast >= canvasAt - slackMs ? 'sr2e' : 'canvas';
}

/** A canvas layer's history without the entries for these document ids (an entry left empty goes). */
export function purgeHistory<T extends { data?: Array<{ _id?: string }> }>(history: readonly T[], ids: ReadonlySet<string>): T[] {
  const out: T[] = [];
  for (const e of history) {
    const data = Array.isArray(e.data) ? e.data.filter((d) => !ids.has(String(d?._id ?? ''))) : e.data;
    if (Array.isArray(data) && !data.length) continue;
    if (Array.isArray(data) && data.length !== e.data!.length) (e as any).data = data;
    out.push(e);
  }
  return out;
}

/** The top-level paths a change touches (for matching Foundry's own undo against the log). */
export function changePaths(changed: unknown): string[] {
  if (!isPlain(changed)) return [];
  return Object.keys(changed).filter((k) => k !== '_id' && k !== '_stats').map((k) => k.replace(/^(-=|==)/, '').split('.')[0]!);
}

/**
 * Foundry's canvas undo put back a change the log also holds: drop the log's newest matching entry
 * (an update's overlapping fields; the creation it deleted; the deletion it brought back) so Undo
 * doesn't take it back a second time. Steps left empty go. Returns whether anything was dropped.
 */
export function forgetMatch(log: UndoStep[], op: UndoOp, uuid: string, paths: readonly string[] = []): boolean {
  for (const step of [...log].sort((a, b) => b.last - a.last)) {
    for (let i = step.entries.length - 1; i >= 0; i--) {
      const e = step.entries[i]!;
      if (e.op !== op || e.uuid !== uuid) continue;
      if (op === 'update') {
        const keep = (e.fields ?? []).filter((f) => !paths.some((p) => pathsOverlap(p, f.path)));
        if (keep.length === (e.fields ?? []).length) continue;
        if (keep.length) e.fields = keep; else step.entries.splice(i, 1);
      } else step.entries.splice(i, 1);
      if (!step.entries.length) log.splice(log.indexOf(step), 1);
      else step.label = stepLabel(step);
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- Odds

/** The chance one die reaches the TN with the Rule of Six (6s re-rolled and added). */
export function dieChance(tn: number, waves: number = RULES.MAX_EXPLOSION_WAVES): number {
  const t = Math.floor(tn);
  if (t <= 1) return 1;
  if (t <= 6) return (7 - t) / 6;
  if (waves <= 0) return 0;
  return (1 / 6) * dieChance(t - 6, waves - 1);
}

/** Odds of a success test: P(at least k successes) for k = 0..dice, the expected successes, and a Rule of One disaster. */
export function successOdds(dice: number, tn: number): { perDie: number; atLeast: number[]; expected: number; disaster: number } {
  const n = Math.max(0, Math.floor(dice));
  const p = dieChance(Math.max(RULES.MIN_TARGET_NUMBER, tn));
  // pmf of a binomial(n, p) by the usual recurrence.
  let pmf = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(pmf.length + 1).fill(0);
    pmf.forEach((q, k) => { next[k] += q * (1 - p); next[k + 1] += q * p; });
    pmf = next;
  }
  const atLeast = pmf.map((_, k) => pmf.slice(k).reduce((a, b) => a + b, 0));
  return { perDie: p, atLeast, expected: n * p, disaster: n > 0 ? Math.pow(1 / 6, n) : 0 };
}

/** "Label +2" / "Label: -1" lines into modifiers (bad lines skipped). */
export function parseModifierLines(text: string): Array<{ label: string; value: number }> {
  const out: Array<{ label: string; value: number }> = [];
  // v0.81.0 (SEC2-7): read from the end by hand; the old `^(.*?)[\s:]*([+-]?\s*\d+)\s*$` was cubic on a long blank run.
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    let i = line.length;
    while (i > 0 && line[i - 1]! >= '0' && line[i - 1]! <= '9') i--;
    if (i === line.length) continue;
    const digits = line.slice(i);
    let k = i;
    if (k > 0 && line[k - 1] === ' ') k--;
    let sign = '';
    if (k > 0 && '+-−'.includes(line[k - 1]!)) {
      sign = line[k - 1] === '+' ? '' : '-';
      k--;
    } else k = i;
    let end = k;
    while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === ':')) end--;
    const value = Number(`${sign}${digits}`);
    if (!Number.isFinite(value)) continue;
    out.push({ label: line.slice(0, end).trim() || tx('SR2E.Card.Mod.modifier'), value });
  }
  return out;
}

/** A percentage for the calculator. */
export const percent = (p: number): string => (p >= 0.995 && p < 1 ? '>99%' : p > 0 && p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`);

// ---------------------------------------------------------------- Time

/** The world-time buttons. */
export function timeSteps(): Array<{ label: string; seconds: number; title: string }> {
  const day = 86400;
  return [
    { label: tx('SR2E.Text.Gmtools.step3s'), seconds: 3, title: tx('SR2E.Text.Gmtools.oneCombatTurn') },
    { label: tx('SR2E.Text.Gmtools.step1min'), seconds: 60, title: tx('SR2E.Text.Gmtools.aMinute') },
    { label: tx('SR2E.Text.Gmtools.step10min'), seconds: 600, title: tx('SR2E.Text.Gmtools.tenMinutes') },
    { label: tx('SR2E.Text.Gmtools.step1h'), seconds: 3600, title: tx('SR2E.Text.Gmtools.anHour') },
    { label: tx('SR2E.Text.Gmtools.step1day'), seconds: day, title: tx('SR2E.Text.Gmtools.aDay') },
    { label: tx('SR2E.Text.Gmtools.step1week'), seconds: 7 * day, title: tx('SR2E.Text.Gmtools.aWeek') },
    { label: tx('SR2E.Text.Gmtools.step1month'), seconds: RULES.GM_TOOLS.monthDays * day, title: tx('SR2E.Text.Gmtools.aMonthDays', { days: RULES.GM_TOOLS.monthDays }) },
    { label: tx('SR2E.Text.Gmtools.step1year'), seconds: RULES.GM_TOOLS.yearDays * day, title: tx('SR2E.Text.Gmtools.aYearDays', { days: RULES.GM_TOOLS.yearDays }) },
  ];
}

/** World time as "year 2, day 45, 08:00:00" (years only once there is one). */
export function formatWorldTime(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const yearDays = Math.max(1, RULES.GM_TOOLS.yearDays);
  let days = Math.floor(s / 86400);
  const y = Math.floor(days / yearDays);
  days -= y * yearDays;
  const h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const clock = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  if (y) return tx('SR2E.Text.Gmtools.yearDayClock', { year: y + 1, day: days + 1, clock });
  return days ? tx('SR2E.Text.Gmtools.dayClock', { day: days + 1, clock }) : clock;
}

/** A span in words: "1 week", "30 days", "2 h 5 min". */
export function describeSpan(seconds: number): string {
  const s = Math.abs(Math.floor(seconds));
  const day = 86400;
  if (s >= RULES.GM_TOOLS.yearDays * day && s % (RULES.GM_TOOLS.yearDays * day) === 0) { const n = s / (RULES.GM_TOOLS.yearDays * day); return tCount(n, 'SR2E.Text.Gmtools.years'); }
  if (s >= RULES.GM_TOOLS.monthDays * day && s % (RULES.GM_TOOLS.monthDays * day) === 0) { const n = s / (RULES.GM_TOOLS.monthDays * day); return tCount(n, 'SR2E.Text.Gmtools.months'); }
  if (s >= 7 * day && s % (7 * day) === 0) { const n = s / (7 * day); return tNoun(n, 'week'); }
  if (s >= day && s % day === 0) { const n = s / day; return tNoun(n, 'day'); }
  const parts: string[] = [];
  const d = Math.floor(s / day), h = Math.floor((s % day) / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (d) parts.push(tx('SR2E.Text.Gmtools.spanDays', { count: d }));
  if (h) parts.push(tx('SR2E.Text.Gmtools.spanHours', { count: h }));
  if (m) parts.push(tx('SR2E.Text.Gmtools.spanMinutes', { count: m }));
  if (r || !parts.length) parts.push(tx('SR2E.Text.Gmtools.spanSeconds', { count: r }));
  return parts.join(' ');
}

// ---------------------------------------------------------------- Scene presets

/** A saved set of scene conditions. `darkness` null leaves the scene's darkness alone. */
export interface ScenePreset {
  id: string;
  name: string;
  background: number;
  sources: string;
  environment: string;
  weather: string;
  terrain: string;
  darkness: number | null;
}

export function normalizePreset(raw: any): ScenePreset {
  const d = raw?.darkness;
  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? '').trim() || 'Preset',
    background: Math.max(0, Math.floor(Number(raw?.background) || 0)),
    sources: String(raw?.sources ?? ''),
    environment: String(raw?.environment ?? ''),
    weather: String(raw?.weather ?? 'clear') || 'clear',
    terrain: String(raw?.terrain ?? ''),
    darkness: d === null || d === undefined || d === '' || !Number.isFinite(Number(d)) ? null : Math.max(0, Math.min(1, Number(d))),
  };
}

/** A preset in a few words. */
export function describePreset(p: ScenePreset): string {
  const parts = [tx('SR2E.Text.Gmtools.background', { value: p.background }), p.weather];
  if (p.terrain) parts.push(p.terrain);
  if (p.darkness !== null) parts.push(tx('SR2E.Text.Gmtools.darkness', { value: p.darkness }));

  if (p.environment) parts.push(p.environment);
  return parts.join(' · ');
}

// ---------------------------------------------------------------- Party summary

export interface PartyMoney { name: string; nuyen: number; karma: number; pool: number; career: number; lifestyleDays: number | null }

/** Totals for the party summary; who is behind on rent (fewer than `warnDays` days paid). */
export function partyTotals(rows: readonly PartyMoney[], warnDays = 7): { nuyen: number; karma: number; pool: number; career: number; behind: string[] } {
  return {
    nuyen: rows.reduce((a, r) => a + (Number(r.nuyen) || 0), 0),
    karma: rows.reduce((a, r) => a + (Number(r.karma) || 0), 0),
    pool: rows.reduce((a, r) => a + (Number(r.pool) || 0), 0),
    career: rows.reduce((a, r) => a + (Number(r.career) || 0), 0),
    behind: rows.filter((r) => r.lifestyleDays !== null && r.lifestyleDays < warnDays).map((r) => r.name),
  };
}
