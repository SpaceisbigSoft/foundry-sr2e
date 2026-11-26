/**
 * v0.93.3 (report item 38): the Team Karma tracker's count. Pure. A player may only spend one at a time (−1, never
 * below 0); the GM may also add, up to a cap that stops a typo from filling the tracker.
 */
export const TEAM_KARMA_MAX = 99;

export function teamKarmaNext(now: number, delta: number, gm: boolean): { ok: boolean; value: number } {
  const cur = Math.max(0, Math.min(TEAM_KARMA_MAX, Math.floor(Number(now) || 0)));
  const d = Math.trunc(Number(delta) || 0);
  if (!d) return { ok: false, value: cur };
  if (!gm && d !== -1) return { ok: false, value: cur };
  const value = cur + d;
  if (value < 0 || value > TEAM_KARMA_MAX) return { ok: false, value: cur };
  return { ok: true, value };
}

/**
 * v0.93.3 review: one Team Karma change at a time on a client (a double click spent two, or wrote the same count
 * twice); a click while one runs is dropped.
 */
let busy = false;
export async function oneAtATime(fn: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  try { await fn(); } finally { busy = false; }
}
