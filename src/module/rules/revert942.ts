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
import { itemRaises, actorRaises, RAISE_FIELDS, type AdvanceLine, type AdvanceEvent } from './advancement.ts';
import { attributeKarmaCost } from './charfix.ts';
import { skillCost } from './upkeep.ts';
import { newSkillCost } from './core923.ts';
import { spellKarmaCost } from './thaumaturgy.ts';

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
  /** v0.94.2 review (4): why this line can never be reverted (an initiation: its metamagic, geasa and sacrifices stay). */
  noRevert?: 'initiation';
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

/** v0.94.2 review (13): `name` as a whole word (or words) of `text`, case ignored ("Body" is not in "Bodyguard"). */
export function saidWord(text: string, name: string): boolean {
  const n = String(name ?? '').trim();
  if (!n) return false;
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, 'iu').test(String(text ?? ''));
}

/** v0.94.2 review (4): the initiate grade is never undone (initiation also writes metamagic, geasa and sacrifices). */
export const INITIATION_KEY = 'system.initiateGrade';

/**
 * Pure: the lines a burst composed, each with the undo steps of the raises it records. A raise goes to its own
 * "label from → to" line, else to the first Karma line naming it as a whole word (never a nuyen line: a purchase is
 * not undone by lowering a rating). An initiation gets no step; its line is marked `noRevert`. Raises without a field
 * (from an older client) add nothing; the lines are copies.
 */
export function attachUndo<L extends AdvanceLine>(lines: ReadonlyArray<L>, events: ReadonlyArray<AdvanceEvent>): Array<L & { undo?: UndoStep[] }> {
  const out: Array<L & { undo?: UndoStep[] }> = lines.map((l) => ({ ...l }));
  for (const e of events as ReadonlyArray<AdvanceEvent & Partial<KeyedRaise>>) {
    if (e.kind !== 'raise' || typeof e.key !== 'string' || !e.key) continue;
    const r = e as KeyedRaise;
    const own = `${r.label} ${r.from} → ${r.to}`;
    const base = r.label.split(' (')[0]!.replace(/ (Force|level|rating)$/, '');
    const line = out.find((l) => l.what === own)
      ?? out.find((l) => num(l.karma) < 0 && (saidWord(l.what, r.label) || saidWord(l.what, base) || (r.alias ? saidWord(l.what, r.alias) : false)));
    if (!line) continue;
    if (r.key === INITIATION_KEY) { (line as RevertLine).noRevert = 'initiation'; continue; }
    const step: UndoStep = { doc: r.itemId ? 'item' : 'actor', key: r.key!, from: num(r.from), to: num(r.to), back: num(r.back ?? r.from), label: String(r.label) };
    if (r.itemId) step.itemId = String(r.itemId);
    line.undo = [...(line.undo ?? []), step];
  }
  return out;
}

/** The field a step changes, as one string (the same field on the same document). */
export const targetOf = (s: Pick<UndoStep, 'doc' | 'itemId' | 'key'>): string => `${s.doc}:${s.doc === 'item' ? s.itemId ?? '' : ''}:${s.key}`;

/** Why a line can't be reverted ('' = it can). Keys under `SR2E.Revert.Why.`. */
export type RevertWhy = '' | 'missing' | 'reverted' | 'notRevertable' | 'later' | 'changed' | 'itemGone' | 'initiation' | 'forged';

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

/** v0.94.2 review (4): an initiation line (marked, or an older line with a grade step), never revertable. */
export function isInitiationLine(l: Partial<RevertLine> | null | undefined): boolean {
  return l?.noRevert === 'initiation' || (Array.isArray(l?.undo) && l!.undo!.some((s: any) => s?.key === INITIATION_KEY));
}

// ---------------------------------------------------------------- The GM's own checks (review finding 1)

/**
 * The fields a revert may lower, by document (what the advancement recorder records, less the initiate grade): base
 * attributes and Magic on the actor; per item type, its RAISE_FIELDS (skill ratings, a spell's learned Force, an adept
 * power's level, a focus's rating).
 */
const RAISE_ACTOR_KEY = /^system\.(attributes\.(body|quickness|strength|charisma|intelligence|willpower)\.base|magic)$/;
export function raiseKeyAllowed(doc: 'actor' | 'item', key: string, itemType: string | null | undefined): boolean {
  if (doc === 'actor') return RAISE_ACTOR_KEY.test(String(key));
  const f = RAISE_FIELDS[String(itemType ?? '')];
  return Boolean(f) && String(key).startsWith('system.') && Object.prototype.hasOwnProperty.call(f, String(key).slice(7));
}

/** What the rules need to price a step (the glue reads it from the actor and item now); null = no Karma price. */
export type StepCostInfo =
  | { kind: 'attribute'; natural: number; max: number; augmented: number }
  | { kind: 'skill'; skillKind: 'active' | 'knowledge' | 'language' | 'buildRepair'; attribute: number }
  | { kind: 'spell' }
  | null;

/**
 * What the GM's client knows that the player can't write: each item's type and skill rating, how to price a step,
 * and the GM-written record of lines already reverted.
 */
export interface GmRevertContext {
  itemType(itemId: string): string | null;
  skillRating(itemId: string): number;
  costInfo(step: UndoStep): StepCostInfo;
  done: ReadonlySet<string>;
}

const whole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/**
 * Every step a strict lowering of an allowed field: whole numbers, from < to, the value written back is `from` (or 0
 * for an unset specialization or concentration whose shown `from` is the skill's rating), one step per field.
 */
export function gmStepsOk(steps: ReadonlyArray<UndoStep>, gm: Pick<GmRevertContext, 'itemType' | 'skillRating'>): boolean {
  const seen = new Set<string>();
  for (const s of steps) {
    if (!whole(s.from) || !whole(s.to) || !whole(s.back) || s.from < 0 || s.from >= s.to) return false;
    const type = s.doc === 'item' ? gm.itemType(String(s.itemId)) : null;
    // A gone item is refused later ('itemGone'); its key can't be checked against a type.
    if (s.doc === 'item' && type === null) { if (!/^system\.[A-Za-z]+$/.test(s.key)) return false; }
    else if (!raiseKeyAllowed(s.doc, s.key, type)) return false;
    const unsetSub = s.doc === 'item' && type === 'skill' && /^system\.(specialization|concentration)Rating$/.test(s.key) && s.back === 0 && s.from === gm.skillRating(String(s.itemId));
    if (s.back !== s.from && !unsetSub) return false;
    const t = targetOf(s);
    if (seen.has(t)) return false;
    seen.add(t);
  }
  return true;
}

/**
 * Pure: the Karma the rules charge for a step's raise (from → to), or null when no Karma price applies (Magic, an adept
 * power's level, a focus's rating, an unknown field). Attributes per point at the natural ratings it passed
 * (attributeKarmaCost); skills per point (newSkillCost / skillCost); a spell's Force at the new Force (spellKarmaCost).
 */
export function stepRulesKarma(s: UndoStep, info: StepCostInfo): number | null {
  if (!info) return null;
  const from = Math.trunc(num(s.from)), to = Math.trunc(num(s.to));
  if (to <= from) return null;
  let total = 0;
  if (info.kind === 'attribute') {
    if (!/\.base$/.test(s.key)) return null;
    const top = Math.trunc(num(info.natural)), first = top - (to - from) + 1;
    if (first < 1) return null;
    for (let v = first; v <= top; v++) {
      const c = attributeKarmaCost({ to: v, max: num(info.max), augmented: num(info.augmented) });
      if (!c.ok) return null;
      total += c.cost;
    }
    return total;
  }
  if (info.kind === 'skill') {
    const sub = s.key === 'system.specializationRating' ? { specialization: true } : s.key === 'system.concentrationRating' ? { concentration: true } : s.key === 'system.rating' ? {} : null;
    if (!sub) return null;
    for (let v = from + 1; v <= to; v++) total += (!('specialization' in sub || 'concentration' in sub) ? newSkillCost(v - 1, v) : null) ?? skillCost({ to: v, attribute: num(info.attribute), kind: info.skillKind, ...sub });
    return total;
  }
  if (info.kind === 'spell') return s.key === 'system.learnedForce' ? spellKarmaCost(to) : null;
  return null;
}

/**
 * Pure: whether a line may be reverted now. `current(step)` is the field's value now (null when its item is gone).
 * Order of reasons: gone, already reverted, nothing to undo, a later raise of the same field, the item gone, the value
 * changed since.
 */
export function revertCheck(log: ReadonlyArray<RevertLine>, lineId: string, current: (s: UndoStep) => number | null, gm?: GmRevertContext): RevertCheck {
  const i = log.findIndex((l) => l?.id === lineId);
  if (i < 0) return { ok: false, why: 'missing' };
  const line = log[i]!;
  if (line.revertedAt || gm?.done.has(String(lineId))) return { ok: false, why: 'reverted' };
  if (isInitiationLine(line)) return { ok: false, why: 'initiation' };
  const steps = undoSteps(line);
  if (!steps.length) return { ok: false, why: 'notRevertable' };
  if (gm && !gmStepsOk(steps, gm)) return { ok: false, why: 'forged' };
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
  /** v0.94.2 review (1), the GM's plan: what the line claims, and why the refund is smaller. */
  claimed?: { karma: number; nuyen: number };
  costUnknown?: boolean;
  nuyenRefused?: boolean;
}

/**
 * Pure: everything a revert does. Refunds are what the line spent (negative Karma or nuyen), into Good Karma and
 * nuyen; career Karma doesn't move (spending never took it). `have` is the actor's Good Karma and nuyen now.
 */
export function planRevert(log: ReadonlyArray<RevertLine>, lineId: string, current: (s: UndoStep) => number | null, have: { karma: number; nuyen: number }, gm?: GmRevertContext): RevertPlan {
  const check = revertCheck(log, lineId, current, gm);
  const empty = { actor: {}, items: {}, refund: { karma: 0, nuyen: 0 }, steps: [] as UndoStep[] };
  if (!check.ok) return { ...check, ...empty };
  const line = log.find((l) => l.id === lineId)!;
  const steps = undoSteps(line);
  const claimed = { karma: Math.max(0, -Math.trunc(num(line.karma))), nuyen: Math.max(0, -Math.trunc(num(line.nuyen))) };
  const refund = { ...claimed };
  let costUnknown = false, nuyenRefused = false;
  if (gm) {
    // v0.94.2 review (1): the GM's client never trusts the line's own figures. Karma: at most what the rules charge for
    // these raises (0 when they can't be priced). Nuyen: an undo step is never a purchase the rules can price, so none.
    const costs = steps.map((s) => stepRulesKarma(s, gm.costInfo(s)));
    costUnknown = claimed.karma > 0 && costs.some((c) => c === null);
    refund.karma = costUnknown ? 0 : Math.min(claimed.karma, costs.reduce<number>((a, c) => a + (c ?? 0), 0));
    nuyenRefused = claimed.nuyen > 0;
    refund.nuyen = 0;
  }
  const actor: Record<string, number> = {};
  const items: Record<string, Record<string, number>> = {};
  for (const s of steps) {
    if (s.doc === 'actor') actor[s.key] = num(s.back);
    else (items[s.itemId!] ??= {})[s.key] = num(s.back);
  }
  if (refund.karma) actor['system.karma.good'] = num(have.karma) + refund.karma;
  if (refund.nuyen) actor['system.nuyen'] = num(have.nuyen) + refund.nuyen;
  return { ...check, actor, items, refund, steps, ...(gm ? { claimed, costUnknown, nuyenRefused } : {}) };
}

/**
 * Pure: a plan as one string, to tell whether the plan the GM confirmed is still the plan inside the lock (the fields,
 * the values written back, the refund; not the running Karma and nuyen totals, which only add the refund).
 */
export function planSignature(p: RevertPlan): string {
  const actor = Object.entries(p.actor).filter(([k]) => k !== 'system.karma.good' && k !== 'system.nuyen').sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const items = Object.keys(p.items).sort().map((id) => [id, Object.entries(p.items[id]!).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))]);
  return JSON.stringify({ ok: p.ok, steps: p.steps.map((s) => [targetOf(s), s.from, s.to, s.back]), actor, items, refund: p.refund });
}

/** Pure: the GM's record of reverted lines with one more (per actor uuid, at most `max` ids each, newest kept). */
export function withRevertDone(done: unknown, actorUuid: string, lineId: string, max = 500): Record<string, string[]> {
  const src = done && typeof done === 'object' && !Array.isArray(done) ? (done as Record<string, unknown>) : {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(src)) if (Array.isArray(v)) out[k] = v.map(String);
  out[actorUuid] = [...(out[actorUuid] ?? []).filter((x) => x !== lineId), lineId].slice(-Math.max(1, max));
  return out;
}

/** Pure: the line ids the GM's record holds for an actor. */
export function revertDoneFor(done: unknown, actorUuid: string): Set<string> {
  const v = done && typeof done === 'object' ? (done as Record<string, unknown>)[actorUuid] : null;
  return new Set(Array.isArray(v) ? v.map(String) : []);
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
