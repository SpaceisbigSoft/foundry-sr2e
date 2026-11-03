/**
 * v0.85.0: one GM window runs the automation. Foundry picks the active GM by *user*, so two windows logged in as the
 * same GM user (a second tab, a forgotten browser, the desktop app beside a browser) both thought they were it: each
 * posted the "is dying", "is free" and dump-shock cards, ticked the timers, answered relay requests and showed the
 * automatic prompts, so everything happened twice (seen in the v0.61.0, v0.75.0 and v0.79.0 live runs).
 *
 * The windows of the GM user now greet each other over the system socket. Each says when it started, and the oldest
 * window still answering leads:
 * - `isLeadGm()` is what every "only the active GM does this" check asks: the active GM user, and its lead window.
 * - `madeHere(options, userId)` is what an after-change hook asks instead of "did my user make this change?": each
 *   window stamps the changes it makes (`options.sr2eWin`), and both windows of a user share that user's id.
 * - `isPromptWindow()` picks the window for the automatic Defend/Resist prompts: the GM window used most recently,
 *   so they don't open in a forgotten background tab.
 *
 * Trust: a greeting counts only when the server says it came from this same user (the socket's sender id), so a
 * player can't silence the GM's automation by claiming to be an older GM window.
 *
 * Timing:
 * - Greetings repeat every PEER_BEAT_MS. A window that hasn't been heard from for PEER_TTL_MS no longer counts;
 *   browsers slow a background tab's timers to about once a minute, so the time-to-live is long.
 * - A window that closes says goodbye, so another takes over at once.
 * - A window can also ask the others to answer straight away (a probe): socket messages arrive at once even in a
 *   background tab. A window that doesn't answer within PROBE_WAIT_MS is dropped. Windows probe when they start, when
 *   they hear a new window, when they come back into view, and at every beat. So a crashed or closed window is
 *   dropped within a beat (seconds, or about a minute for a background tab), not after the time-to-live.
 * - A reloaded window keeps its id and start time (sessionStorage), so it keeps its place. A duplicated tab, which
 *   copies sessionStorage, notices its own id answering from elsewhere and takes a new one.
 * - Once-per-session jobs at start-up wait for `leadSettled()`, so two windows restored at the same moment don't
 *   both run them.
 */

export const PEER_BEAT_MS = 20_000;
export const PEER_TTL_MS = 150_000;
export const PROBE_WAIT_MS = 3_000;
export const SETTLE_MS = 1_500;

export interface Peer { clientId: string; since: number; seen: number; focusedAt: number }
export interface PeerMessage { type: 'peer'; clientId: string; since: number; focusedAt?: number; bye?: boolean; probe?: boolean }

/** Pure: whether `self` leads: no other live window of the same user started earlier (ties broken by id). */
export function leadsAmong(self: { clientId: string; since: number }, peers: Iterable<Peer | Omit<Peer, 'focusedAt'>>, now: number, ttl = PEER_TTL_MS): boolean {
  for (const p of peers) {
    if (p.clientId === self.clientId || now - p.seen > ttl) continue;
    if (p.since < self.since || (p.since === self.since && p.clientId < self.clientId)) return false;
  }
  return true;
}

/** Pure: whether `self` was used most recently of the live windows (ties go to the lead order). */
export function promptsAmong(self: { clientId: string; since: number; focusedAt: number }, peers: Iterable<Peer>, now: number, ttl = PEER_TTL_MS): boolean {
  for (const p of peers) {
    if (p.clientId === self.clientId || now - p.seen > ttl) continue;
    if (p.focusedAt > self.focusedAt) return false;
    if (p.focusedAt === self.focusedAt && (p.since < self.since || (p.since === self.since && p.clientId < self.clientId))) return false;
  }
  return true;
}

/** Pure: whether a peer message is well formed (it is still only believed when its sender is this user). */
export function isPeerMessage(m: unknown): m is PeerMessage {
  const x = m as PeerMessage;
  return !!x && typeof x === 'object' && x.type === 'peer' && typeof x.clientId === 'string' && /^[A-Za-z0-9]{1,32}$/.test(x.clientId)
    && Number.isFinite(x.since) && (x.focusedAt === undefined || Number.isFinite(x.focusedAt))
    && (x.bye === undefined || typeof x.bye === 'boolean') && (x.probe === undefined || typeof x.probe === 'boolean');
}

const STORE_KEY = 'sr2e.window';
const SELF = { clientId: '', since: 0, focusedAt: 0 };
const peers = new Map<string, Peer>();
let send: ((m: PeerMessage) => void) | null = null;
// Resolved SETTLE_MS after the greeting starts (at once for a player): see leadSettled.
let settle: () => void = () => {};
let settled: Promise<void> = new Promise((r) => { settle = r; });

function randomId(): string {
  const f = (globalThis as any).foundry?.utils?.randomID;
  if (typeof f === 'function') return String(f(16));
  return (Math.random().toString(36).slice(2, 12) + Date.now().toString(36)).replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
}

function now(): number { return Date.now(); }

function freshSelf(): void {
  SELF.clientId = randomId();
  const server = Number((globalThis as any).game?.time?.serverTime);
  SELF.since = Number.isFinite(server) && server > 0 ? server : now();
  SELF.focusedAt = 0;
  try { globalThis.sessionStorage?.setItem(STORE_KEY, JSON.stringify({ clientId: SELF.clientId, since: SELF.since })); } catch { /* no storage */ }
}

/** This window's id and start time: kept across a reload of the same tab. */
function loadSelf(): void {
  try {
    const raw = JSON.parse(globalThis.sessionStorage?.getItem(STORE_KEY) ?? 'null');
    if (raw && typeof raw.clientId === 'string' && /^[A-Za-z0-9]{1,32}$/.test(raw.clientId) && Number.isFinite(raw.since)) {
      SELF.clientId = raw.clientId; SELF.since = Number(raw.since); return;
    }
  } catch { /* no storage */ }
  freshSelf();
}
loadSelf();

const greeting = (extra: Partial<PeerMessage> = {}): PeerMessage => ({ type: 'peer', clientId: SELF.clientId, since: SELF.since, focusedAt: SELF.focusedAt, ...extra });

function prune(): void {
  const t = now();
  for (const [id, p] of peers) if (t - p.seen > 2 * PEER_TTL_MS) peers.delete(id);
}

/** Whether this window leads among the windows of its own user. */
export function isLeadClient(): boolean {
  return leadsAmong(SELF, peers.values(), now());
}

/** The one window that runs "only the active GM does this": the active GM user, and its lead window. */
export function isLeadGm(): boolean {
  return Boolean((game as any).users?.activeGM?.isSelf) && isLeadClient();
}

/** The window that shows this user's automatic prompts: the one used most recently. */
export function isPromptWindow(): boolean {
  return promptsAmong(SELF, peers.values(), now());
}

/**
 * Whether a change an after-change hook sees was made in this window (not only by this user: two windows of one
 * user share its id). The window that made it stamped `options.sr2eWin`. When a change carries no stamp (a document
 * type nothing stamps, or options that didn't travel), the lead window answers for the user, so it still happens
 * once.
 */
export function madeHere(options: any, userId: string | undefined): boolean {
  if (!userId || userId !== (game as any).user?.id) return false;
  const win = options?.sr2eWin;
  return typeof win === 'string' ? win === SELF.clientId : isLeadClient();
}

/** How many other live windows of this user are known (for the tests). */
export function otherWindows(): number {
  const t = now();
  return [...peers.values()].filter((p) => p.clientId !== SELF.clientId && t - p.seen <= PEER_TTL_MS).length;
}

/**
 * Resolves once a window that just opened has heard the others (once-per-session jobs wait for it). If the greeting
 * never starts (no socket), it resolves after SETTLE_MS anyway.
 */
let fallback = false;
export function leadSettled(): Promise<void> {
  if (!fallback) { fallback = true; setTimeout(() => settle(), SETTLE_MS); }
  return settled;
}

/** Ask every window of this user to answer now; drop those that don't. */
function probe(): void {
  if (!send) return;
  const asked = now();
  send(greeting({ probe: true }));
  const t = setTimeout(() => { for (const [id, p] of peers) if (p.seen <= asked) peers.delete(id); }, PROBE_WAIT_MS);
  (t as any)?.unref?.();
}

/**
 * Handle a peer message (called from the system socket listener). `senderId` is the server-set user id of the
 * sender: only this user's own windows count.
 */
export function handlePeer(msg: unknown, senderId: string | undefined): void {
  if (!isPeerMessage(msg)) return;
  if (!senderId || senderId !== (game as any).user?.id) return;
  if (msg.clientId === SELF.clientId) {
    // Another window has this window's id: a duplicated tab (it copied sessionStorage). The one that hears it takes a
    // new id and start time, and greets.
    if (msg.bye) return;
    freshSelf();
    send?.(greeting());
    return;
  }
  if (msg.bye) { peers.delete(msg.clientId); return; }
  const prev = peers.get(msg.clientId);
  const t = now();
  const isNew = !prev || t - prev.seen > PEER_TTL_MS;
  peers.set(msg.clientId, { clientId: msg.clientId, since: Number(msg.since), seen: t, focusedAt: Number(msg.focusedAt ?? 0) });
  prune();
  // A window that asks, or one heard for the first time (or again after a long silence), is answered at once; a new
  // window also makes this one check that every other window it knows is still there (a reload's lost goodbye).
  if (msg.probe || isNew) send?.(greeting());
  if (isNew) probe();
}

/** Start greeting (GM users only: only their windows run automation). `emit` sends on the system socket. */
export function startPeers(emit: (m: PeerMessage) => void): void {
  if (!(game as any).user?.isGM) { settle(); return; }
  send = emit;
  probe();
  const st = setTimeout(() => settle(), SETTLE_MS);
  (st as any)?.unref?.();
  // Each beat is a probe (a greeting that asks for an answer), so a window that went away without a goodbye (a tab
  // closed from outside, a crash) is dropped within a beat, whether it led or showed the prompts.
  const beat = setInterval(() => probe(), PEER_BEAT_MS);
  (beat as any)?.unref?.();
  const bye = () => { try { emit(greeting({ bye: true })); } catch { /* closing */ } };
  globalThis.addEventListener?.('pagehide', bye);
  globalThis.addEventListener?.('beforeunload', bye);
  // Back in view: say so (this window is now the one in use) and check the others are still there.
  const seen = () => {
    if ((globalThis as any).document?.visibilityState === 'hidden') return;
    SELF.focusedAt = now();
    probe();
  };
  globalThis.addEventListener?.('focus', seen);
  (globalThis as any).document?.addEventListener?.('visibilitychange', seen);
  if ((globalThis as any).document?.hasFocus?.()) SELF.focusedAt = now();
}

/**
 * Every window stamps the changes it makes, so after-change hooks can tell "made in this window" from "made by my
 * user in another window" (`madeHere`). Pre-hooks run only in the window that makes the change.
 */
export function registerWindowStamp(): void {
  const stamp = (options: any, userId: string) => { if (options && typeof options === 'object' && userId === (game as any).user?.id) options.sr2eWin = SELF.clientId; };
  for (const type of ['Actor', 'ActorDelta', 'Item', 'ActiveEffect', 'Combat', 'Combatant', 'ChatMessage', 'Token', 'Region', 'Scene', 'Wall', 'JournalEntry']) {
    Hooks.on(`preCreate${type}`, (_d: any, _data: any, options: any, userId: string) => stamp(options, userId));
    Hooks.on(`preUpdate${type}`, (_d: any, _c: any, options: any, userId: string) => stamp(options, userId));
    Hooks.on(`preDelete${type}`, (_d: any, options: any, userId: string) => stamp(options, userId));
  }
}

/** Tests only: reset the known windows and this window. */
export function _resetPeers(since = now(), clientId = SELF.clientId, focusedAt = 0): void {
  peers.clear(); SELF.since = since; SELF.clientId = clientId; SELF.focusedAt = focusedAt; send = null; settled = Promise.resolve(); settle = () => {};
}

/** Tests only: this window's id. */
export function _selfId(): string { return SELF.clientId; }
