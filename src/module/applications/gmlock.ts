/**
 * v0.81.1 (V-SEC 1–2): one queue for work the GM's client does with authority over other people's documents.
 *
 * `SR2Actor.runAsAuthor` re-runs a player's card as that player (write routing and the write guard read
 * `actingAuthor`). The acting state is module-wide, so nothing else that decides by the GM's rights may run while a
 * re-run awaits: a second re-run, a player's relay request, a timer tick or an auto-applied card would otherwise be
 * judged as the player (writes cancelled while reporting success), or a re-run's tail would run with GM rights.
 *
 * Every such entry point (runAsAuthor, the socket relay's request handler, the round/world-time ticks, auto-apply)
 * goes through `withGmLock`, which runs one task at a time in arrival order. There is no async context in the browser
 * to tell "called from inside the running task" from "called by something else meanwhile", so the lock never runs a
 * call inline: code running inside a locked task must not await another `withGmLock` (it would wait for itself).
 * Inside a re-run, call the handler directly (requestGm on the GM's own client does) and don't wait for user input
 * while holding the lock: ask first, then take it.
 */
import { t as tx } from '../helpers/i18n.ts';

let tail: Promise<unknown> = Promise.resolve();
let held = 0;
let queued = 0;
let warned = false;

/** Whether a locked task is running on this client (diagnostics and tests). */
export function gmLockHeld(): boolean { return held > 0; }

/** Whether a locked task is running or waiting to run: a GM-rights task started now could overlap a re-run. */
export function gmLockBusy(): boolean { return held > 0 || queued > 0; }

/** How long a task may wait for the lock before the GM is told (a stuck task, or a task that waits for itself). */
export const GM_LOCK_WARN_MS = 15_000;

/** Run `fn` after every locked task queued before it has finished; its result or error is passed back. */
export function withGmLock<T>(fn: () => Promise<T> | T): Promise<T> {
  queued++;
  const timer = setTimeout(() => {
    if (warned) return;
    warned = true;
    console.warn('sr2e | a GM action has waited over 15 s for an earlier one to finish');
    (globalThis as any).ui?.notifications?.warn?.(tx('SR2E.Notify.Gmlock.sr2eAGmActionIsWaiting'));
  }, GM_LOCK_WARN_MS);
  (timer as any)?.unref?.();
  const run = async (): Promise<T> => {
    clearTimeout(timer);
    queued--;
    held++;
    try { return await fn(); } finally { held--; }
  };
  const next = tail.then(run, run);
  tail = next.catch(() => undefined);
  return next;
}
