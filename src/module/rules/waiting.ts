/**
 * v0.65.0: things that take time to get. Learning a spell, designing one, an initiation ordeal, enchanting,
 * summoning an elemental, an ally ritual, a ward, building a lodge or library, cleansing, writing a program,
 * building a deck part, repairs, vehicle mods, and buying gear (its Availability time) all wait: what was paid
 * is held, and the result arrives when world time has passed. Training raises ratings the same way
 * (RULES.CHARACTERS_V58.training, now 'timed' by default).
 *
 * Only player characters wait (not NPCs, and not while in the creation wizard); the GM can finish any of it at
 * once, and cancelling gives back what was paid. No Foundry dependency.
 */
import { RULES } from './config.ts';
import { parseAvailability, findTime } from './upkeep.ts';
import { gradedAvailability } from './implants.ts';
import { legalFindTimeFactor } from './legalbuy.ts';
import { t as tx } from '../helpers/i18n.ts';

export type WaitArea = 'magic' | 'gear' | 'repairs' | 'matrix' | 'vehicles';

/**
 * What a finished project does: items made, items changed (by id), the actor changed, or an actor method run.
 * Changes are [path, value] pairs: a flag can't hold dotted keys (Foundry would expand them).
 */
export type PathValues = Array<[string, unknown]>;
export interface ProjectEffect {
  creates?: any[];
  updates?: Array<{ itemId: string; changes: PathValues }>;
  actor?: PathValues;
  call?: { method: string; args: unknown[] };
}

const UNSAFE_PATH_KEYS: ReadonlySet<string> = new Set(['__proto__', 'prototype', 'constructor']);

/** Pairs ([["system.rating", 4]]) back into an update object ({"system.rating": 4}). */
export function fromPairs(p: PathValues | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // v0.81.0: project pairs come from flags; a path through __proto__, prototype or constructor is dropped.
  for (const e of p ?? []) if (Array.isArray(e) && typeof e[0] === 'string' && !e[0].split('.').some((k) => UNSAFE_PATH_KEYS.has(k))) out[e[0]] = e[1];
  return out;
}

export interface Project {
  /** v0.73.0: the GM who approved the request that started it ('' = none). */
  approvedBy?: string;
  id: string;
  kind: string;
  area: WaitArea;
  label: string;
  /** v0.89.5: what a learning project learns (a spell's name), found by this, not by the label's words. */
  subject?: string;
  /** World time (seconds) started and ready. */
  startedAt: number;
  readyAt: number;
  hours: number;
  /** What was paid at the start (given back on cancel). */
  paid: { karma: number; nuyen: number };
  by: string;
  /** The chat message the test was on (a re-roll changes the time of the same project). */
  source?: string;
  effect: ProjectEffect;
  /** What cancelling makes again (an item taken off to be bought, say). */
  onCancel?: ProjectEffect;
  /** Shown on the done card. */
  done?: string;
}

const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

export function W(): typeof RULES.WAITING { return RULES.WAITING; }

/** Does this actor wait for this kind of thing? Player characters out of creation, with the area switched on. */
export function waits(o: { area: WaitArea; actorType: string; inCreation: boolean }): boolean {
  const w = W();
  return Boolean(w.enabled) && Boolean((w.areas as Record<string, boolean>)[o.area]) && o.actorType === 'character' && !o.inCreation;
}

/** A project's hours: never below the minimum (so nothing that waits is instant). */
export function projectHours(hours: number): number {
  return Math.max(num(W().minimumHours, 0), Math.round(num(hours) * 100) / 100);
}

export function readyAt(startSeconds: number, hours: number): number {
  return Math.round(num(startSeconds) + Math.max(0, num(hours)) * 3600);
}

/** "3 d 4 h", "45 min", "now". */
export function timeLabel(hours: number): string {
  const h = Math.max(0, num(hours));
  if (h <= 0) return tx('SR2E.Text.Waiting.now');
  if (h < 1) return tx('SR2E.Text.Waiting.minutes', { m: Math.max(1, Math.round(h * 60)) });
  const d = Math.floor(h / 24), r = Math.round(h - d * 24);
  if (!d) return tx('SR2E.Text.Waiting.hours', { h: r });
  return r ? tx('SR2E.Text.Waiting.daysHours', { d, h: r }) : tx('SR2E.Text.Waiting.days', { d });
}

/** Hours left (0 when due). */
export function hoursLeft(p: Pick<Project, 'readyAt'>, now: number): number {
  return Math.max(0, (num(p.readyAt) - num(now)) / 3600);
}

/** Projects that are done at this world time. */
export function dueProjects(list: ReadonlyArray<Project>, now: number): Project[] {
  return (list ?? []).filter((p) => p && num(now) >= num(p.readyAt));
}

/** The list as a map's values, oldest first (flags keep projects by id). */
export function projectList(flag: unknown): Project[] {
  const vals: any[] = Array.isArray(flag) ? flag : flag && typeof flag === 'object' ? Object.values(flag) : [];
  return vals.filter((p: any) => p && typeof p.id === 'string' && p.effect && typeof p.effect === 'object').sort((a: any, b: any) => num(a.readyAt) - num(b.readyAt));
}

/** A new project. */
export function makeProject(o: Omit<Project, 'readyAt' | 'hours' | 'paid'> & { hours: number; paid?: Partial<Project['paid']> }): Project {
  const hours = projectHours(o.hours);
  return { ...o, hours, readyAt: readyAt(o.startedAt, hours), paid: { karma: Math.max(0, Math.floor(num(o.paid?.karma))), nuyen: Math.max(0, Math.floor(num(o.paid?.nuyen))) } };
}

/** A re-roll changed the successes: the same project with its new time (from when it started). */
export function retimed(p: Project, hours: number): Project {
  const h = projectHours(hours);
  return { ...p, hours: h, readyAt: readyAt(p.startedAt, h) };
}

/**
 * Hours to get hold of something by its Availability ("6/48 hrs", "4/7 days", or a bare TN): the base time
 * ÷ successes when a test was rolled (`successes` > 0), else the base time × `RULES.WAITING.orderFactor`
 * (an order through the usual channels, with no test). 0 when the item has no Availability.
 */
export function acquireHours(availability: unknown, successes = 0): number {
  const text = String(availability ?? '').trim();
  if (!text) return 0;
  const av = parseAvailability(text);
  if (!av.tn) return 0;
  if (num(successes) > 0) return Math.max(0, num(findTime(av.hours, num(successes))));
  return Math.max(0, num(av.hours) * num(W().orderFactor, 1));
}

/** A project in one line for a sheet. */
export function describeProject(p: Project, now: number): { label: string; left: string; paid: string; due: boolean } {
  const left = hoursLeft(p, now);
  const paid = [p.paid.karma ? tx('SR2E.Text.Waiting.karma', { karma: p.paid.karma }) : '', p.paid.nuyen ? `¥${p.paid.nuyen.toLocaleString()}` : ''].filter(Boolean).join(' + ');
  return { label: p.label, left: left > 0 ? timeLabel(left) : tx('SR2E.Text.Waiting.doneAtTheNextTime'), paid, due: left <= 0 };
}

/** Actor methods a project may call when it is done (the rest of the effect is plain data). v0.81.1 (D1-13): 'finishInitiation' (no such method) removed. */
export const PROJECT_CALLS = ['finishWard', 'finishElemental', 'finishAlly', 'finishEnchant', 'finishDesign', 'finishCleanse', 'finishDeckPart', 'finishDeckRepair', 'finishVehicleRepair', 'finishModInstall', 'giveUpElemental', 'refundModPayer', 'deliverVehicle', 'finishPermit'] as const;

/** Hours to get an item by its own Availability (cyberware by its grade, cultured bioware slower). */
export function itemAcquireHours(type: string, system: any, successes = 0): number {
  // v0.91.5 (RULES.SHOP_V915.findTime): a restricted or forbidden thing takes longer, however it is bought.
  return baseAcquireHours(type, system, successes) * legalFindTimeFactor((system ?? {}).legality);
}

function baseAcquireHours(type: string, system: any, successes = 0): number {
  const s = system ?? {};
  const text = String(s.availability ?? '').trim();
  if (!text) return 0;
  if (type === 'cyberware') {
    const g = gradedAvailability(text, { grade: s.grade, cultured: Boolean(s.bioware && s.cultured) });
    if (!g.tn) return 0;
    if (num(successes) > 0) return Math.max(0, num(findTime(g.hours, num(successes))));
    return Math.max(0, g.hours * num(W().orderFactor, 1));
  }
  return acquireHours(text, successes);
}
