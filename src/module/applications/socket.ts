/**
 * v0.59.0: the GM relay. A player's client can't change what it doesn't own (the other combatants'
 * initiative, the combat's pass flag, a GM's host or site), so it asks the active GM's client to do it
 * over the system socket (`system.json` "socket": true). Every request names an operation from a fixed
 * list; the GM's client checks the request still makes sense (the same round, turn and pass; the
 * player owns the acting combatant) before doing anything.
 *
 * v0.81.0 (A-1, SEC1-7): who asked comes from the transport, never the payload. Foundry hands the listener the
 * sender's user id as its second argument (set by the server; checked live on v14.369: a player who wrote a GM's id
 * into `userId` arrived with their own id). A request whose `userId` doesn't match the sender is refused. Everything
 * in `data` is untrusted input: each handler checks its own values.
 */
import { SYSTEM_ID } from "../config/system.ts";
import { t as tx } from "../helpers/i18n.ts";
import { withGmLock } from "./gmlock.ts";
import { isLeadGm, handlePeer, startPeers, registerWindowStamp, type PeerMessage } from "./leader.ts";

export const SOCKET = `system.${SYSTEM_ID}`;

export type RelayOp = 'nextTurn' | 'roundTicks' | 'drawArea' | 'spendSpellDefense' | 'dismissSpirit' | 'vehicleShop';

export interface RelayRequest { type: 'request'; id: string; op: RelayOp; userId: string; data: Record<string, any> }
export interface RelayReply { type: 'reply'; id: string; to: string; ok: boolean; note?: string }

const waiting = new Map<string, (r: RelayReply) => void>();
const handlers = new Map<RelayOp, (data: Record<string, any>, user: any) => Promise<{ ok: boolean; note?: string }>>();

/** The active GM, or null when no GM is logged in. */
export function activeGm(): any {
  return (game as any).users?.activeGM ?? null;
}

/** Whether this client is the one that answers relay requests (v0.85.0: the active GM's lead window, see leader.ts). */
export function isRelayGm(): boolean {
  return isLeadGm();
}

/** A combat's state as the relay checks it (stale requests are refused). */
export function combatState(c: any): { round: number; turn: number | null; pass: number } {
  return { round: Number(c?.round ?? 0), turn: c?.turn ?? null, pass: Number(c?.pass ?? c?.getFlag?.(SYSTEM_ID, 'pass') ?? 0) };
}

/** Pure: whether a request's remembered combat state still matches the combat. */
export function sameCombatState(a: { round: number; turn: number | null; pass: number }, b: { round: number; turn: number | null; pass: number }): boolean {
  return a.round === b.round && (a.turn ?? null) === (b.turn ?? null) && a.pass === b.pass;
}

/** Pure: who may end the current turn: a GM, or a player who owns the acting combatant's actor. */
export function mayEndTurn(user: any, combatant: any): boolean {
  if (!user) return false;
  if (user.isGM) return true;
  const actor = combatant?.actor;
  return Boolean(actor?.testUserPermission?.(user, 'OWNER'));
}

/** Register an operation the active GM's client runs for others. */
export function onRelay(op: RelayOp, fn: (data: Record<string, any>, user: any) => Promise<{ ok: boolean; note?: string }>): void {
  handlers.set(op, fn);
}

/**
 * v0.81.1 round 3 (FIX3-BRIEF 5, V2 #5): how long a client waits for the GM's answer, and how long after a request
 * arrives the GM's client still runs it. Requests queue behind the GM lock (a re-run, auto-resist, the timers), so the
 * GM gives up first: a request that only gets its turn after RELAY_EXPIRE_MS is answered "timed out" and never run, so
 * nothing is spent or moved for a requester who has stopped waiting.
 */
export const RELAY_TIMEOUT_MS = 20_000;
// Lead, after V3 #3: a 10 s margin, so a handler that starts just before the expiry (a spend's update round trip)
// still answers well before its requester gives up.
export const RELAY_EXPIRE_MS = 10_000;
/** v0.85.0: how long a second GM window waits for the lead window to run the round's timers before running them itself. */
export const ROUND_TICKS_HANDOFF_MS = 5_000;
/** Ops that always run, however late (V3 #4): the round's timers must not be skipped, nor run again by another GM. */
const NEVER_EXPIRE: ReadonlySet<string> = new Set(['roundTicks', 'nextTurn']);

/**
 * Ask the active GM's client to run `op`. Resolves with its reply, or `{ok: false}` with a note when no
 * GM is logged in or nobody answered within `timeoutMs`. On the active GM's own client it runs at once.
 * v0.81.1 (S2-6): a reply that never came is marked `timedOut`: the GM may still have done it (a slow delete across
 * scenes), so the caller checks the document before saying it failed.
 */
export async function requestGm(op: RelayOp, data: Record<string, any>, timeoutMs = RELAY_TIMEOUT_MS): Promise<{ ok: boolean; note?: string; timedOut?: boolean }> {
  const gm = activeGm();
  const me: any = (game as any).user;
  if (!gm) return { ok: false, note: tx('SR2E.App.Socket.noGmIsLoggedInTo') };
  if (gm.isSelf) {
    // v0.85.0 (review R3): the round's timers run in one window, so a second GM window hands them to the lead window
    // (the world-time timers run there too: they must not interleave). If the lead doesn't answer soon, it runs here.
    if (op === 'roundTicks' && !isLeadGm()) {
      const r = await requestOtherWindow(op, data, ROUND_TICKS_HANDOFF_MS);
      if (!r.timedOut) return r;
    }
    // The GM's own click runs in the window it was made in (v0.85.0: even a second window of the GM user, so a crashed
    // lead window never blocks the GM). Only other users' requests go to the lead window (isRelayGm).
    const fn = handlers.get(op);
    if (!fn) return { ok: false, note: tx('SR2E.App.Socket.unknownRequest', { op }) };
    // v0.81.1 (A3): inside a re-run of a player's card (SR2Actor.runAsAuthor) the request is judged as that player, and
    // it runs inline: the re-run already holds the GM lock (awaiting it again would wait for itself).
    const acting: any = (globalThis as any).CONFIG?.Actor?.documentClass?.actingAuthor ?? null;
    // A-10: the same failure handling as a request from another client (no unhandled rejection here).
    try { return await fn(data, acting ?? me); } catch (err) { console.warn('sr2e | relay', op, err); return { ok: false, note: String((err as any)?.message ?? err) }; }
  }
  return requestOtherWindow(op, data, timeoutMs);
}

/** Send a relay request over the socket and wait for the lead GM window's answer. */
function requestOtherWindow(op: RelayOp, data: Record<string, any>, timeoutMs: number): Promise<{ ok: boolean; note?: string; timedOut?: boolean }> {
  const me: any = (game as any).user;
  const id = foundry.utils.randomID();
  const req: RelayRequest = { type: 'request', id, op, userId: me?.id ?? '', data };
  return new Promise((resolve) => {
    const timer = setTimeout(() => { waiting.delete(id); resolve({ ok: false, note: tx('SR2E.App.Socket.theGmsClientDidNotAnswer'), timedOut: true }); }, timeoutMs);
    waiting.set(id, (r) => { clearTimeout(timer); waiting.delete(id); resolve({ ok: r.ok, ...(r.note ? { note: r.note } : {}) }); });
    (game as any).socket?.emit?.(SOCKET, req);
  });
}

/**
 * Handle one socket message (exported for the tests). `senderId` is the listener's second argument: the server-set
 * id of the user who sent it. A request is run as that user, never as the `userId` it names.
 */
export async function handleSocket(msg: RelayRequest | RelayReply | PeerMessage, senderId?: string, expireMs = RELAY_EXPIRE_MS): Promise<void> {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'peer') { handlePeer(msg, senderId); return; }
  if (msg.type === 'reply') {
    if (msg.to !== (game as any).user?.id) return;
    // Only an answer from the active GM's client.
    const gm = activeGm();
    if (senderId !== undefined && gm && senderId !== gm.id) return;
    waiting.get(msg.id)?.(msg);
    return;
  }
  if (msg.type !== 'request' || !isRelayGm()) return;
  if (typeof senderId !== 'string' || !senderId) return;
  const fn = handlers.get(msg.op);
  const user: any = (game as any).users?.get?.(senderId);
  // v0.89.6: the notes are shown on the asking client, in the GM's language (the reply carries text).
  let out: { ok: boolean; note?: string } = { ok: false, note: tx('SR2E.App.Socket.unknownRequest', { op: String(msg.op) }) };
  if (!user) out = { ok: false, note: tx('SR2E.App.Socket.unknownUser') };
  else if (msg.userId !== undefined && msg.userId !== senderId) out = { ok: false, note: tx('SR2E.App.Socket.theRequestNamesAnotherUser') };
  else if (fn) {
    const data = msg.data && typeof msg.data === 'object' && !Array.isArray(msg.data) ? msg.data : {};
    // v0.81.1 (A2): another client's request runs under the GM lock, never while a re-run of a card is acting as a
    // player (its writes would be judged as that player). Round 3 (5): not at all once its requester has given up.
    const arrived = Date.now();
    try {
      out = await withGmLock(async () => (!NEVER_EXPIRE.has(String(msg.op)) && Date.now() - arrived > expireMs ? { ok: false, note: tx('SR2E.App.Socket.timedOutWaitingForThe') } : fn(data, user)));
    } catch (err) { console.warn('sr2e | relay', msg.op, err); out = { ok: false, note: String((err as any)?.message ?? err) }; }
  }
  const reply: RelayReply = { type: 'reply', id: String(msg.id ?? ''), to: senderId, ok: out.ok, ...(out.note ? { note: out.note } : {}) };
  (game as any).socket?.emit?.(SOCKET, reply);
}

export function registerSocket(): void {
  registerWindowStamp();
  Hooks.once('ready', () => {
    // v0.85.0: exactly (message, senderId). The server adds the sender's id after what was emitted, so a client that
    // emits extra arguments (to put a forged id in second place) arrives with more than two: refused.
    (game as any).socket?.on?.(SOCKET, (...args: any[]) => { if (args.length === 2) void handleSocket(args[0], args[1]); });
    startPeers((m) => (game as any).socket?.emit?.(SOCKET, m));
  });
}
