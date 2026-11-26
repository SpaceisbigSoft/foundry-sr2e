/**
 * v0.94.2 (improvement plan item 31): reverting an advancement-log line, the pure parts (no Foundry). The glue is
 * applications/revert942.ts; the log itself is rules/advancement.ts and applications/advancement.ts.
 *
 * - From 0.94.2 on, a log line that raised something carries `undo`: the exact field, the document (the actor or one
 *   of its items) and the value it held before. Older lines have none and can't be reverted automatically (the text
 *   of a line is not a safe source for a field and a value).
 * - A revert puts each raised field back, gives back the Karma and nuyen the line spent, and marks the line reverted
 *   (it stays in the log); a new line records the refund.
 * - Only the latest un-reverted line for a field may be reverted, so a later raise that built on it is never broken,
 *   and only while the field still holds the value the line left (an edit by hand since then blocks it).
 */
import { itemRaises, actorRaises, _advancementInternals, type AdvanceLine, type AdvanceEvent } from './advancement.ts';

/** One field a line raised, as a revert puts it back. */
export interface UndoStep {
  /** The actor itself, or one of its items (`itemId`). */
  doc: 'actor' | 'item';
  itemId?: string;
  /** The flattened field, such as `system.attributes.body.base` or `system.rating`. */
  key: string;
  /** The raise as shown (from → to) and the raw value to write back (`back`; an unset specialization rating is 0). */
  from: number;
  to: number;
  back: number;
  label: string;
}

/** A log line as 0.94.2 writes it (the older fields plus the revert bookkeeping). */
export type RevertLine = AdvanceLine & {
  undo?: UndoStep[];
  revertedAt?: string;
  revertedBy?: string;
  /** On the refund line a revert writes: the id of the line it reverted. */
  revertOf?: string;
  refund?: boolean;
};

/** A raise event with what a revert needs (the hooks add `key`, `back` and, for items, `itemId`). */
export type KeyedRaise = Extract<AdvanceEvent, { kind: 'raise' }> & { key?: string; back?: number; itemId?: string };

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** An item update's raises with their field and raw value before (one `itemRaises` call per field, so they match exactly). */
export function keyedItemRaises(type: string, name: string, current: any, changes: Record<string, unknown>): Array<{ label: string; from: number; to: number; key: string; back: number }> {
  const out: Array<{ label: string; from: number; to: number; key: string; back: number }> = [];
  for (const [key, v] of Object.entries(changes ?? {})) {
    if (!key.startsWith('system.')) continue;
    const r = itemRaises(type, name, current, { [key]: v })[0];
    if (r) out.push({ ...r, key, back: num(current?.[key.slice(7)]) });
  }
  return out;
}

/** An actor update's raises with their field (base attributes, Magic, the initiate grade). */
export function keyedActorRaises(current: any, changes: Record<string, unknown>): Array<{ label: string; from: number; to: number; alias?: string; key: string; back: number }> {
  const out: Array<{ label: string; from: number; to: number; alias?: string; key: string; back: number }> = [];
  for (const [key, v] of Object.entries(changes ?? {})) {
    const r = actorRaises(current, { [key]: v })[0];
    if (r) out.push({ ...r, key, back: r.from });
  }
  return out;
}

const said = _advancementInternals.said;

/**
 * Pure: the lines a burst composed, each with the undo steps of the raises it records. A raise goes to its own
 * "label from → to" line, else to the first Karma or nuyen line naming it (as composeAdvancement covers it). Raises
 * without a field (from an older client) add nothing; the lines are copies.
 */
export function attachUndo<L extends AdvanceLine>(lines: ReadonlyArray<L>, events: ReadonlyArray<AdvanceEvent>): Array<L & { undo?: UndoStep[] }> {
  const out: Array<L & { undo?: UndoStep[] }> = lines.map((l) => ({ ...l }));
  for (const e of events as ReadonlyArray<AdvanceEvent & Partial<KeyedRaise>>) {
    if (e.kind !== 'raise' || typeof e.key !== 'string' || !e.key) continue;
    const r = e as KeyedRaise;
    const own = `${r.label} ${r.from} → ${r.to}`;
    const base = r.label.split(' (')[0]!.replace(/ (Force|level|rating)$/, '');
    const line = out.find((l) => l.what === own)
      ?? out.find((l) => (num(l.karma) < 0 || num(l.nuyen) < 0) && (said(l.what, r.label) || said(l.what, base) || (r.alias ? said(l.what, r.alias) : false)));
    if (!line) continue;
    const step: UndoStep = { doc: r.itemId ? 'item' : 'actor', key: r.key!, from: num(r.from), to: num(r.to), back: num(r.back ?? r.from), label: String(r.label) };
    if (r.itemId) step.itemId = String(r.itemId);
    line.undo = [...(line.undo ?? []), step];
  }
  return out;
}

/** The field a step changes, as one string (the same field on the same document). */
export const targetOf = (s: Pick<UndoStep, 'doc' | 'itemId' | 'key'>): string => `${s.doc}:${s.doc === 'item' ? s.itemId ?? '' : ''}:${s.key}`;

/** Why a line can't be reverted ('' = it can). Keys under `SR2E.Revert.Why.`. */
export type RevertWhy = '' | 'missing' | 'reverted' | 'notRevertable' | 'later' | 'changed' | 'itemGone';

export interface RevertCheck {
  ok: boolean;
  why: RevertWhy;
  /** For 'later': the line that must be reverted first; for 'changed': the field and its value now. */
  laterId?: string;
  label?: string;
  now?: number;
  expected?: number;
}

/** A step's well-formedness (a forged or damaged flag never names another kind of field). */
function stepOk(s: any): s is UndoStep {
  return Boolean(s) && (s.doc === 'actor' || (s.doc === 'item' && typeof s.itemId === 'string' && /^[A-Za-z0-9]{1,40}$/.test(s.itemId)))
    && typeof s.key === 'string' && /^system\.[A-Za-z0-9_.]{1,80}$/.test(s.key) && Number.isFinite(Number(s.to)) && Number.isFinite(Number(s.back));
}

/** A line's undo steps, only the well-formed ones (none when any is damaged). */
export function undoSteps(l: Partial<RevertLine> | null | undefined): UndoStep[] {
  const u = l?.undo;
  if (!Array.isArray(u) || !u.length || !u.every(stepOk)) return [];
  return u as UndoStep[];
}

/**
 * Pure: whether a line may be reverted now. `current(step)` is the field's value now (null when its item is gone).
 * Order of reasons: gone, already reverted, nothing to undo, a later raise of the same field, the item gone, the value
 * changed since.
 */
export function revertCheck(log: ReadonlyArray<RevertLine>, lineId: string, current: (s: UndoStep) => number | null): RevertCheck {
  const i = log.findIndex((l) => l?.id === lineId);
  if (i < 0) return { ok: false, why: 'missing' };
  const line = log[i]!;
  if (line.revertedAt) return { ok: false, why: 'reverted' };
  const steps = undoSteps(line);
  if (!steps.length) return { ok: false, why: 'notRevertable' };
  const mine = new Set(steps.map(targetOf));
  for (let j = log.length - 1; j > i; j--) {
    const l = log[j]!;
    if (l.revertedAt) continue;
    if (undoSteps(l).some((s) => mine.has(targetOf(s)))) return { ok: false, why: 'later', laterId: String(l.id) };
  }
  for (const s of steps) {
    const now = current(s);
    if (now === null) return { ok: false, why: 'itemGone', label: s.label };
    if (num(now) !== num(s.to)) return { ok: false, why: 'changed', label: s.label, now: num(now), expected: num(s.to) };
  }
  return { ok: true, why: '' };
}

export interface RevertPlan extends RevertCheck {
  /** Flattened actor changes (fields put back, Karma and nuyen refunded). */
  actor: Record<string, number>;
  /** Per item id, its flattened changes. */
  items: Record<string, Record<string, number>>;
  refund: { karma: number; nuyen: number };
  steps: UndoStep[];
}

/**
 * Pure: everything a revert does. Refunds are what the line spent (negative Karma or nuyen), into Good Karma and
 * nuyen; career Karma doesn't move (spending never took it). `have` is the actor's Good Karma and nuyen now.
 */
export function planRevert(log: ReadonlyArray<RevertLine>, lineId: string, current: (s: UndoStep) => number | null, have: { karma: number; nuyen: number }): RevertPlan {
  const check = revertCheck(log, lineId, current);
  const empty = { actor: {}, items: {}, refund: { karma: 0, nuyen: 0 }, steps: [] as UndoStep[] };
  if (!check.ok) return { ...check, ...empty };
  const line = log.find((l) => l.id === lineId)!;
  const steps = undoSteps(line);
  const refund = { karma: Math.max(0, -Math.trunc(num(line.karma))), nuyen: Math.max(0, -Math.trunc(num(line.nuyen))) };
  const actor: Record<string, number> = {};
  const items: Record<string, Record<string, number>> = {};
  for (const s of steps) {
    if (s.doc === 'actor') actor[s.key] = num(s.back);
    else (items[s.itemId!] ??= {})[s.key] = num(s.back);
  }
  if (refund.karma) actor['system.karma.good'] = num(have.karma) + refund.karma;
  if (refund.nuyen) actor['system.nuyen'] = num(have.nuyen) + refund.nuyen;
  return { ...check, actor, items, refund, steps };
}

/**
 * Pure: the log after a revert: the line marked (kept), and a refund line after it. `ids` makes the new line's id.
 */
export function revertedLog(log: ReadonlyArray<RevertLine>, lineId: string, o: { by: string; at: string; t: number; id: string; what: string; refund: { karma: number; nuyen: number } }): RevertLine[] {
  const out = log.map((l) => (l.id === lineId ? { ...l, revertedAt: o.at, revertedBy: o.by } : l));
  out.push({ id: o.id, at: o.at, t: o.t, by: o.by, approvedBy: '', what: o.what, karma: o.refund.karma, nuyen: o.refund.nuyen, kind: 'gain', revertOf: lineId, ...(o.refund.nuyen > 0 ? { refund: true } : {}) });
  return out;
}

/**
 * Who may revert, and how. The GM directly. A player who owns the actor directly only when the rating lock is off for
 * them (they could type the same change themselves: `ratingLocked` false); otherwise through an Apply (GM) card.
 */
export function revertRoute(o: { isGM: boolean; isOwner: boolean; locked: boolean }): 'direct' | 'card' | 'none' {
  if (o.isGM) return 'direct';
  if (!o.isOwner) return 'none';
  return o.locked ? 'card' : 'direct';
}
