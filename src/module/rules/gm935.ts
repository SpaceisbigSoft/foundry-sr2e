/**
 * v0.93.5 ("interface polish"), the GM windows: pure parts (no Foundry), wired in by applications/ui.ts (the GM panel's
 * tabs), applications/party.ts (the party view), applications/spendkarma.ts (the Spend Karma rows) and
 * applications/progress.ts (progress bars on long jobs).
 */
import { RULES } from './config.ts';

// ---------------------------------------------------------------- The GM panel's tabs and views

/** v0.93.5: the panel's six tabs, in order (Tools, Log and Setup left the tab row). */
export const GM_PANEL_TABS = ['scene', 'combat', 'party', 'npcs', 'world', 'requests'] as const;
/** v0.93.5: views opened from the panel's top row (not tabs): the undo history and the setup. */
export const GM_PANEL_VIEWS = ['log', 'setup'] as const;
export type GmView = typeof GM_PANEL_TABS[number] | typeof GM_PANEL_VIEWS[number];

/**
 * v0.93.5: old and other names for a place in the panel, mapped to where it lives now, so `gmPanel('tools')`, the tools
 * window, the tours and the session checklist keep working. The Tools tab's calculator and NPC generator moved to the
 * NPCs tab (the rest of that tab was the SR2e tools window's list).
 */
export const GM_VIEW_ALIASES: Readonly<Record<string, GmView>> = {
  tools: 'npcs', calculator: 'npcs', npcGenerator: 'npcs',
  history: 'log', undo: 'log', undoLog: 'log', rolls: 'log',
  settings: 'setup', checklist: 'setup',
  approvals: 'requests', orders: 'requests',
};

/** v0.93.5: the view a name opens: a tab or view as it is, an old name mapped, anything else the Scene tab. */
export function gmViewFor(id: unknown): GmView {
  const s = String(id ?? '').trim();
  if ((GM_PANEL_TABS as readonly string[]).includes(s) || (GM_PANEL_VIEWS as readonly string[]).includes(s)) return s as GmView;
  return Object.prototype.hasOwnProperty.call(GM_VIEW_ALIASES, s) ? GM_VIEW_ALIASES[s]! : 'scene';
}

/** v0.93.5: the section a mapped name should scroll to in its view ('' for none): the calculator for the old Tools tab. */
export function gmFocusFor(id: unknown): string {
  const s = String(id ?? '').trim();
  return s === 'tools' || s === 'calculator' ? 'calc' : s === 'npcGenerator' ? 'npcgen' : s === 'orders' ? 'orders' : '';
}

// ---------------------------------------------------------------- The party view: what a user may see

/** Foundry's ownership levels (CONST.DOCUMENT_OWNERSHIP_LEVELS). */
export const OWNERSHIP = { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } as const;

export type CoarseWound = 'unhurt' | 'hurt' | 'badly' | 'down';

/** v0.93.5: a coarse wound state from the boxes (Serious = 6 boxes, a full track or unconscious/dying/dead = down). */
export function coarseWound(physical: unknown, stun: unknown, status: unknown = 'ok'): CoarseWound {
  const p = Math.max(0, Math.floor(Number(physical) || 0));
  const s = Math.max(0, Math.floor(Number(stun) || 0));
  const n = RULES.MONITOR_BOXES;
  if (['unconscious', 'dying', 'dead', 'down'].includes(String(status ?? 'ok')) || p >= n || s >= n) return 'down';
  const worst = Math.max(p, s);
  if (worst >= 6) return 'badly';
  if (worst >= 1) return 'hurt';
  return 'unhurt';
}

/** What the party view may show of one actor to one user. */
export interface PartyAccess {
  /** Listed at all (Limited or more, or the GM). */
  listed: boolean;
  /** Full vitals: the user owns the actor, or is the GM. */
  full: boolean;
  /** Only the coarse wound state (a member the user doesn't own, when the world setting allows it). */
  coarse: boolean;
}

/** v0.93.5: the party view's rule: the GM sees everyone in full; an owner in full; Limited or Observer the name and picture, and the coarse wound state when the world allows it; anyone else nothing. */
export function partyAccess(o: { isGM: boolean; level: number; woundsSetting: boolean }): PartyAccess {
  const level = Math.floor(Number(o.level) || 0);
  if (o.isGM || level >= OWNERSHIP.OWNER) return { listed: true, full: true, coarse: false };
  if (level >= OWNERSHIP.LIMITED) return { listed: true, full: false, coarse: Boolean(o.woundsSetting) };
  return { listed: false, full: false, coarse: false };
}

/** The raw facts about one party member (the glue reads them from the actor; only what partyRow returns is shown). */
export interface PartyFacts {
  uuid: string; name: string; img: string;
  physical: number; stun: number; status: string;
  /** "P 3/10 (M) · S 0/10" and the like, built from the same monitor view as the 0.93.4 status strip. */
  monitorText: string;
  wound: number;
  pools: string;
  initiative: number | null;
  acting: boolean;
  statusText: string;
  player: string;
}

/** One row of the party view: a full row, a coarse one, or a name-only one (no field the user may not see is present). */
export type PartyRow =
  | { kind: 'full'; uuid: string; name: string; img: string; player: string; monitorText: string; woundText: string; pools: string; initiative: number | null; acting: boolean; statusText: string; hurt: boolean; canOpen: boolean }
  | { kind: 'coarse'; uuid: string; name: string; img: string; player: string; wound: CoarseWound; canOpen: boolean }
  | { kind: 'name'; uuid: string; name: string; img: string; player: string; canOpen: boolean };

/** v0.93.5: the party view's row for one actor and user, or null when the user may not see the actor at all. */
export function partyRow(f: PartyFacts, a: PartyAccess, o: { canOpen: boolean }): PartyRow | null {
  if (!a.listed) return null;
  const base = { uuid: String(f.uuid ?? ''), name: String(f.name ?? ''), img: String(f.img ?? ''), player: String(f.player ?? ''), canOpen: Boolean(o.canOpen) };
  if (a.full) {
    const w = Math.floor(Number(f.wound) || 0);
    return {
      ...base, kind: 'full', monitorText: String(f.monitorText ?? ''), woundText: w ? `+${w} TN` : '', pools: String(f.pools ?? ''),
      initiative: f.initiative === null || f.initiative === undefined || !Number.isFinite(Number(f.initiative)) ? null : Number(f.initiative),
      acting: Boolean(f.acting), statusText: String(f.statusText ?? ''), hurt: coarseWound(f.physical, f.stun, f.status) !== 'unhurt',
    };
  }
  if (a.coarse) return { ...base, kind: 'coarse', wound: coarseWound(f.physical, f.stun, f.status) };
  return { ...base, kind: 'name' };
}

/** v0.93.5: the monitor as text ("P 3/10 (M) · S 0/10 · O 1/5"), from monitorView's tracks (as the status strip shows it). */
export function monitorTextOf(cm: { tracks: ReadonlyArray<{ short: string; filled: number; boxes: number; reached?: string }>; overflow?: { filled: number; body: number; idle?: boolean } | null }, overflowShort = 'O'): string {
  const parts = cm.tracks.map((t) => `${t.short} ${t.filled}/${t.boxes}${t.reached ? ` (${t.reached})` : ''}`);
  if (cm.overflow && !cm.overflow.idle) parts.push(`${overflowShort} ${cm.overflow.filled}/${cm.overflow.body}`);
  return parts.join(' · ');
}

// ---------------------------------------------------------------- Spend Karma rows

/** v0.93.5: one Spend Karma row: whether it can be bought, its disabled reason (a tooltip), and the hint shown in the row. */
export function spendRow(c: { ok: boolean; cost: number; reason?: string }, good: number, needsText: (cost: number, good: number) => string): { afford: boolean; why: string; hint: string } {
  const cost = Number(c.cost) || 0;
  const g = Number(good) || 0;
  const afford = Boolean(c.ok) && cost <= g;
  const why = !c.ok ? String(c.reason ?? '') : cost > g ? needsText(cost, g) : '';
  // With no Good Karma at all, one banner says so: the rows don't each repeat "needs N, has 0". Other reasons stay.
  const hint = afford ? '' : !c.ok ? why : g <= 0 ? '' : why;
  return { afford, why, hint };
}

// ---------------------------------------------------------------- Progress on long jobs

/** v0.93.5: a progress fraction 0..1 and its "n of N" numbers (N at least 1; n within 0..N). */
export function progressState(done: number, total: number): { done: number; total: number; pct: number } {
  const t = Math.max(1, Math.floor(Number(total) || 0));
  const d = Math.max(0, Math.min(t, Math.floor(Number(done) || 0)));
  return { done: d, total: t, pct: d / t };
}

/**
 * v0.93.5: a throttle for progress updates (at most one every `minMs`, ~100 ms by default), so a long job isn't slowed
 * down by its own bar. `due(now)` says whether to draw now; the last step (done = total) is always drawn.
 */
export function progressThrottle(minMs = 100): { due: (now: number, done: number, total: number) => boolean } {
  let last = -Infinity;
  return {
    due(now: number, done: number, total: number): boolean {
      if (done >= total || now - last >= minMs) { last = now; return true; }
      return false;
    },
  };
}
