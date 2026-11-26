/**
 * v0.93.3: the GM's roll request (report item 6), the pure part. The GM asks several characters for one skill or
 * attribute test at one TN; one chat card carries a row per character, each player rolls their own row in their
 * normal roll window, and the card keeps a live tally (per row: waiting, N successes or a disaster; in all: how many
 * have rolled, the total successes and the best).
 *
 * The state lives on the request card's flags (`flags.<system>.rollRequest`). Its rows are an array (actor uuids
 * have dots, which Foundry would split as flag paths). Everything read back from flags goes through `parseRequest`,
 * which bounds every value, so a card's flags never reach the HTML or the tally unchecked. The HTML builders escape
 * every value they print. The Foundry glue (who may roll, which test card counts, the GM lock) is in
 * applications/rollrequest.ts.
 */
import { attributeDisplayLabel } from './customlists.ts';
import { escHtml } from './html.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';
import type { AttributeKey } from '../models/index.ts';

/** v0.93.3: the flag key of a request card's state. */
export const REQUEST_FLAG = 'rollRequest';
/** v0.93.3: the most rows one request carries (a card stays readable; a forged flag can't make the GM's client build thousands). */
export const MAX_REQUEST_ROWS = 40;
/** v0.93.3: the TN range a request may set. */
export const REQUEST_TN_MIN = 2;
export const REQUEST_TN_MAX = 30;
/** v0.93.3: the most successes a row records (a forged test card can't print a silly number). */
export const MAX_ROW_SUCCESSES = 99;

/** v0.93.3: the attributes a request can ask for (the actor's rollAttribute keys). */
export const REQUEST_ATTRIBUTES: readonly AttributeKey[] = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'];

export type RequestKind = 'skill' | 'attribute';

/** v0.93.3: one row's result, from the test card the GM's client accepted for it. */
export interface RowResult {
  successes: number;
  botch: boolean;
  /** The test card's message id (the newest accepted card of that test). */
  cardId: string;
  /** The test's id (the same on its Karma re-rolls and GM TN changes, which replace the result). */
  testId: string;
}

export interface RequestRow {
  actorUuid: string;
  name: string;
  /** Whether the character had a player owner when asked (the card's grouping; "Roll the NPCs" checks again live). */
  playerOwned: boolean;
  result: RowResult | null;
}

export interface RollRequest {
  v: 1;
  id: string;
  kind: RequestKind;
  /** The skill's name, or the attribute's key. */
  key: string;
  tn: number;
  /** TN and results hidden from players (they see "rolled"). */
  hidden: boolean;
  rows: RequestRow[];
  createdAt: number;
}

const clampInt = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};
/** A short plain string (control characters removed), or ''. */
const plain = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '');
/** v0.93.3: what a uuid or a message/test id may look like here (letters, digits, dots, dashes, underscores). */
const ID_RE = /^[A-Za-z0-9._-]{1,200}$/;
export const safeId = (v: unknown, max = 200): string => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length <= max && ID_RE.test(s) ? s : '';
};

/** v0.93.3: a test card's link to its request (a message id), bounded, or ''. */
export function requestOfValue(v: unknown): string {
  return safeId(v, 64);
}

function parseResult(raw: unknown): RowResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return { successes: clampInt(r['successes'], 0, MAX_ROW_SUCCESSES, 0), botch: r['botch'] === true, cardId: safeId(r['cardId'], 64), testId: safeId(r['testId'], 64) };
}

/**
 * v0.93.3: a request's state from a card's flags, every value bounded; null when it isn't one. Rows with no actor
 * uuid, or a uuid seen before, are dropped; at most MAX_REQUEST_ROWS are kept.
 */
export function parseRequest(raw: unknown): RollRequest | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const kind: RequestKind | null = r['kind'] === 'skill' ? 'skill' : r['kind'] === 'attribute' ? 'attribute' : null;
  if (!kind) return null;
  const key = kind === 'attribute' ? (REQUEST_ATTRIBUTES.includes(r['key'] as AttributeKey) ? String(r['key']) : '') : plain(r['key'], 80);
  if (!key) return null;
  const seen = new Set<string>();
  const rows: RequestRow[] = [];
  for (const x of Array.isArray(r['rows']) ? r['rows'].slice(0, MAX_REQUEST_ROWS * 2) : []) {
    if (!x || typeof x !== 'object') continue;
    const row = x as Record<string, unknown>;
    const actorUuid = safeId(row['actorUuid']);
    if (!actorUuid || seen.has(actorUuid)) continue;
    seen.add(actorUuid);
    rows.push({ actorUuid, name: plain(row['name'], 80) || '?', playerOwned: row['playerOwned'] === true, result: parseResult(row['result']) });
    if (rows.length >= MAX_REQUEST_ROWS) break;
  }
  return {
    v: 1, id: safeId(r['id'], 64), kind, key, tn: clampInt(r['tn'], REQUEST_TN_MIN, REQUEST_TN_MAX, 4), hidden: r['hidden'] === true, rows,
    createdAt: clampInt(r['createdAt'], 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

/** v0.93.3: a new request from the GM's dialog (bounded as parseRequest bounds it); null when nothing can be asked. */
export function makeRequest(o: { id: string; kind: RequestKind; key: string; tn: number; hidden: boolean; rows: ReadonlyArray<{ actorUuid: string; name: string; playerOwned: boolean }>; now?: number }): RollRequest | null {
  const s = parseRequest({ ...o, rows: o.rows.map((r) => ({ ...r, result: null })), createdAt: o.now ?? Date.now() });
  return s && s.rows.length ? s : null;
}

export type ApplyOutcome = 'added' | 'replaced' | 'noRow' | 'alreadyRolled' | 'same';

/**
 * v0.93.3: a test card's result for a row. A waiting row takes it; a rolled row takes it only from a newer card of
 * the same test (a Karma re-roll, a bought success, the GM's TN change: same `testId`); another test is refused.
 * Returns the new state (the input is not changed) and what happened.
 */
export function applyResult(state: RollRequest, actorUuid: string, r: { successes: unknown; botch: unknown; cardId: unknown; testId: unknown }): { state: RollRequest; outcome: ApplyOutcome } {
  const i = state.rows.findIndex((x) => x.actorUuid === actorUuid);
  if (i < 0) return { state, outcome: 'noRow' };
  const row = state.rows[i]!;
  const next: RowResult = { successes: clampInt(r.successes, 0, MAX_ROW_SUCCESSES, 0), botch: r.botch === true, cardId: safeId(r.cardId, 64), testId: safeId(r.testId, 64) };
  let outcome: ApplyOutcome = 'added';
  if (row.result) {
    if (!next.testId || row.result.testId !== next.testId) return { state, outcome: 'alreadyRolled' };
    if (row.result.cardId === next.cardId && row.result.successes === next.successes && row.result.botch === next.botch) return { state, outcome: 'same' };
    outcome = 'replaced';
  }
  const rows = state.rows.map((x, k) => (k === i ? { ...x, result: next } : x));
  return { state: { ...state, rows }, outcome };
}

export interface RequestTally {
  rows: number;
  rolled: number;
  waiting: number;
  totalSuccesses: number;
  botches: number;
  /** The rows with the most successes (ties all named), when anyone has rolled a success. */
  best: { names: string[]; successes: number } | null;
}

/** v0.93.3: the card's totals. */
export function tallyRequest(state: RollRequest): RequestTally {
  let rolled = 0, total = 0, botches = 0, top = 0;
  for (const r of state.rows) {
    if (!r.result) continue;
    rolled++;
    if (r.result.botch) botches++;
    else { total += r.result.successes; top = Math.max(top, r.result.successes); }
  }
  const names = top > 0 ? state.rows.filter((r) => r.result && !r.result.botch && r.result.successes === top).map((r) => r.name) : [];
  return { rows: state.rows.length, rolled, waiting: state.rows.length - rolled, totalSuccesses: total, botches, best: names.length ? { names, successes: top } : null };
}

/** v0.93.3: what one row shows a viewer: the GM (or anyone on a shown request) sees the numbers; players on a hidden one see "rolled". */
export function rowStatus(row: RequestRow, hidden: boolean, gm: boolean): { kind: 'waiting' | 'rolled' | 'successes' | 'botch'; successes: number } {
  if (!row.result) return { kind: 'waiting', successes: 0 };
  if (hidden && !gm) return { kind: 'rolled', successes: 0 };
  return row.result.botch ? { kind: 'botch', successes: 0 } : { kind: 'successes', successes: row.result.successes };
}

/** v0.93.3: what is asked, in words ("Stealth", "Willpower"), plain text. */
export function requestWhat(state: Pick<RollRequest, 'kind' | 'key'>, attributeLabel: (k: string) => string = (k) => attributeDisplayLabel(k)): string {
  return state.kind === 'attribute' ? attributeLabel(state.key) : state.key;
}

/** v0.93.3: who is looking at a card, for the HTML: a GM, and which rows' actors this user owns and may roll. */
export interface RequestView {
  gm: boolean;
  /** Whether this user owns the row's actor (gets its Roll button). */
  owns: (actorUuid: string) => boolean;
  /** Whether the row's actor has no player owner now ("Roll the NPCs"); defaults to the row's own mark. */
  npc?: (row: RequestRow) => boolean;
  /** Rows this client has rolled and is waiting on the GM's tally for (their button says so). */
  sent?: (index: number) => boolean;
}

/** v0.93.3: the request card's inner HTML for a viewer (every value escaped here). */
export function requestHtml(state: RollRequest, view: RequestView, attributeLabel?: (k: string) => string): string {
  const what = requestWhat(state, attributeLabel);
  const showTn = !state.hidden || view.gm;
  const tally = tallyRequest(state);
  const isNpc = view.npc ?? ((r: RequestRow) => !r.playerOwned);
  const head = showTn ? tx('SR2E.Card.Request.headTn', { what: escHtml(what), tn: state.tn }) : tx('SR2E.Card.Request.headHidden', { what: escHtml(what) });
  const rows = state.rows.map((row, i) => {
    const st = rowStatus(row, state.hidden, view.gm);
    const cell = st.kind === 'waiting' ? `<span class="sr2e-rr-wait">${tx('SR2E.Card.Request.waiting')}</span>`
      : st.kind === 'rolled' ? `<span class="sr2e-rr-done">${tx('SR2E.Card.Request.rolled')}</span>`
      : st.kind === 'botch' ? `<strong class="sr2e-botch">${tx('SR2E.Card.Request.disaster')}</strong>`
      : `<strong>${escHtml(tCount(st.successes, 'SR2E.Count.success'))}</strong>`;
    let btn = '';
    if (!row.result) {
      if (view.owns(row.actorUuid) && !view.gm) {
        btn = view.sent?.(i)
          ? `<button type="button" data-sr2e-rr="roll" data-index="${i}" disabled>${tx('SR2E.Card.Request.sent')}</button>`
          : `<button type="button" data-sr2e-rr="roll" data-index="${i}">${tx('SR2E.Card.Request.roll')}</button>`;
      } else if (view.gm) {
        btn = `<button type="button" data-sr2e-rr="rollFor" data-index="${i}" title="${tx('SR2E.Card.Request.rollForTitle', { name: escHtml(row.name) })}">${tx('SR2E.Card.Request.rollFor')}</button>`;
      }
    }
    const cls = row.result ? (st.kind === 'botch' ? 'sr2e-rr-row sr2e-rr-botch' : 'sr2e-rr-row sr2e-rr-rolled') : 'sr2e-rr-row sr2e-rr-waiting';
    return `<tr class="${cls}"><td>${escHtml(row.name)}${isNpc(row) ? ` <em class="sr2e-rr-npc">${tx('SR2E.Card.Request.npc')}</em>` : ''}</td><td>${cell}</td><td>${btn}</td></tr>`;
  }).join('');
  const sums = showTn
    ? `${tx('SR2E.Card.Request.rolledOf', { rolled: tally.rolled, rows: tally.rows })} · ${tx('SR2E.Card.Request.totalSuccesses', { total: tally.totalSuccesses })}${tally.best ? ` · ${tx('SR2E.Card.Request.best', { names: escHtml(tally.best.names.join(', ')), successes: tally.best.successes })}` : ''}${tally.botches ? ` · ${tx('SR2E.Card.Request.botches', { botches: tally.botches })}` : ''}`
    : tx('SR2E.Card.Request.rolledOf', { rolled: tally.rolled, rows: tally.rows });
  const npcWaiting = view.gm && state.rows.some((r) => !r.result && isNpc(r));
  const foot = view.gm ? `<p class="sr2e-rr-gm">${npcWaiting ? `<button type="button" data-sr2e-rr="rollNpcs">${tx('SR2E.Card.Request.rollNpcs')}</button>` : ''}${state.hidden ? ` <em>${tx('SR2E.Card.Request.hiddenNote')}</em>` : ''}</p>` : '';
  return `<h3>${head}</h3><table class="sr2e-group sr2e-rr-table"><tr><th>${tx('SR2E.Card.Request.who')}</th><th>${tx('SR2E.Card.Request.result')}</th><th></th></tr>${rows}</table><p class="sr2e-rr-sum">${sums}</p>${foot}`;
}

/** v0.93.3: the whole card content as stored (the players' view of it: no GM buttons, nothing hidden shown). */
export function requestCardContent(state: RollRequest, attributeLabel?: (k: string) => string): string {
  return `<div class="sr2e-roll sr2e-rr" data-sr2e-rr-card="1">${requestHtml(state, { gm: false, owns: () => false }, attributeLabel)}</div>`;
}
