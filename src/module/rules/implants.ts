/**
 * Cyberware and bioware leftovers (v0.45.0): bioware rejection and recovery after surgery,
 * encephalons, how many chips run at once, and Availability by grade (and cultured bioware).
 * Pure rules; no Foundry. Values in RULES.BIOWARE and RULES.CYBERWARE.
 */
import { RULES } from './config.ts';
import { parseAvailability } from './upkeep.ts';
import type { Monitor } from './damage.ts';
import { t as tx } from '../helpers/i18n.ts';

// ---------------------------------------------------------------- Bioware

/** Wound modifiers with a pain editor: the Stun track does not count. */
export function painEditedMonitor(m: Monitor, ignoreStun: boolean): Monitor {
  return ignoreStun ? { physical: m.physical, stun: 0 } : m;
}

/** A Stun hit after trauma dampers: `off` fewer boxes, never below 1. */
export function dampedStunBoxes(boxes: number, off: number): number {
  if (!(boxes > 0)) return boxes;
  return Math.max(1, boxes - Math.max(0, Math.floor(off)));
}

/** Whether a skill linked to this attribute is a physical skill (enhanced articulation). */
export function physicalSkill(attribute: string): boolean {
  return ['body', 'quickness', 'strength'].includes(String(attribute ?? ''));
}

/** The rejection test's TN (null when Body Index is within the limit or rejection is off). */
export function rejectionTn(bodyIndex: number, limit: number): number | null {
  const r = RULES.BIOWARE.rejection;
  const over = Math.max(0, bodyIndex) - Math.max(0, limit);
  if (!r.enabled || !(over > 0)) return null;
  return Math.max(2, r.tn + Math.ceil(over * r.tnPerPointOver));
}

/** Which bioware a failed rejection test rejects: the newest installed one that can be rejected. */
export function rejectionCandidate<T extends { id: string; installed: boolean; damaged?: boolean; cultured?: boolean; sort?: number }>(items: readonly T[]): T | null {
  const immune = RULES.BIOWARE.rejection.culturedImmune;
  const c = items.filter((i) => i.installed && !i.damaged && !(immune && i.cultured));
  return c.length ? c.reduce((a, b) => ((b.sort ?? 0) >= (a.sort ?? 0) ? b : a)) : null;
}

/** When the next rejection test is due (world time, seconds). */
export function nextRejectionAt(now: number): number {
  return now + Math.max(1, RULES.BIOWARE.rejection.intervalDays) * 86400;
}

export interface Recovery { itemId: string; name: string; until: number }

/** Recoveries still running at this world time. */
export function recovering(list: readonly Recovery[], now: number): Recovery[] {
  return list.filter((r) => r.until > now);
}

/** Items that don't work yet because the patient is still recovering from their surgery. */
export function recoveringItemIds(list: readonly Recovery[], now: number): string[] {
  return RULES.BIOWARE.recovery.inactive ? recovering(list, now).map((r) => r.itemId) : [];
}

/** The TN penalty while recovering from surgery. */
export function recoveryTn(list: readonly Recovery[], now: number): number {
  return recovering(list, now).length ? RULES.BIOWARE.recovery.tn : 0;
}

// ---------------------------------------------------------------- Cyberware

/** Encephalon dice on a test of a skill linked to this attribute (or a knowledge skill). */
export function encephalonDice(rating: number, o: { attribute?: string; kind?: string }): number {
  const e = RULES.CYBERWARE.encephalon;
  const r = Math.max(0, Math.floor(rating));
  if (!r) return 0;
  // v0.78.0 (RULES.BOOK_V78.encephalon 'shadowtech'): an Intelligence bonus and a Task Pool instead of dice.
  if (RULES.BOOK_V78.encephalon.mode === 'shadowtech') return 0;
  const fits = (o.attribute && e.attributes.includes(o.attribute)) || (e.knowledge && (o.kind === 'knowledge' || o.kind === 'language'));
  return fits ? r * e.dicePerRating : 0;
}

/** v0.78.0 (Shadowtech): skills an encephalon helps: Intelligence-linked active skills, knowledge and B/R skills. */
export function encephalonFits(o: { attribute?: string; kind?: string }): boolean {
  if (o.kind === 'knowledge' || o.kind === 'buildRepair') return true;
  if (o.kind === 'language') return false;
  return Boolean(o.attribute && RULES.CYBERWARE.encephalon.attributes.includes(o.attribute));
}
const encephalonStep = (table: readonly number[], rating: number): number => {
  const r = Math.max(0, Math.floor(rating));
  if (!r || RULES.BOOK_V78.encephalon.mode !== 'shadowtech') return 0;
  return Math.max(0, Number(table[Math.min(table.length, r) - 1] ?? 0));
};
/** v0.78.0: the encephalon's Intelligence bonus (levels 1–4: +1/+1/+2/+2) on the skills it fits (0 under the old rule). */
export function encephalonIntelligence(rating: number): number { return encephalonStep(RULES.BOOK_V78.encephalon.intelligence, rating); }
/** v0.78.0: the encephalon's Task Pool dice (levels 1–4: 0/1/2/3; 0 under the old rule). */
export function encephalonTaskPool(rating: number): number { return encephalonStep(RULES.BOOK_V78.encephalon.taskPool, rating); }

export interface ChipSlots { jacks: number; memory: number }

/** How many chips can run through jacks, and headware memory (Mp) for knowsofts beyond that. */
export function chipSlots(o: { chipjacks: number; datajack: boolean; memoryMp: number }): ChipSlots {
  const c = RULES.CYBERWARE.chips;
  return { jacks: Math.max(0, o.chipjacks) * c.perChipjack + (o.datajack ? c.perDatajack : 0), memory: Math.max(0, o.memoryMp) };
}

/**
 * Which slotted chips actually run, in order: jack slots first (activesofts must use them),
 * then knowsofts and linguasofts in headware memory at `mpPerRating` × rating each. The rest get
 * a reason. With enforce 'off' every chip runs.
 */
export function chipsRunning<T extends { kind: string; rating: number; slotted: boolean }>(chips: readonly T[], slots: ChipSlots): Array<{ chip: T; runs: boolean; via: 'jack' | 'memory' | ''; reason: string }> {
  const c = RULES.CYBERWARE.chips;
  let jacks = slots.jacks;
  let memory = slots.memory;
  return chips.map((chip) => {
    if (!chip.slotted) return { chip, runs: false, via: '' as const, reason: tx('SR2E.Text.Implants.notSlotted') };
    if (c.enforce === 'off') return { chip, runs: true, via: 'jack' as const, reason: '' };
    if (jacks > 0) { jacks--; return { chip, runs: true, via: 'jack' as const, reason: '' }; }
    const need = Math.max(1, Math.floor(chip.rating)) * c.mpPerRating;
    if (chip.kind !== 'activesoft' && memory >= need) { memory -= need; return { chip, runs: true, via: 'memory' as const, reason: '' }; }
    return { chip, runs: false, via: '' as const, reason: chip.kind === 'activesoft' ? tx('SR2E.Text.Implants.noFreeJack') : tx('SR2E.Text.Implants.noFreeJackOrMp', { need }) };
  });
}

/** Availability as a rule: the item's text, plus its grade's (or cultured bioware's) TN and time. */
export function gradedAvailability(text: string, o: { grade?: string; cultured?: boolean } = {}): { tn: number; hours: number; label: string } {
  const a = parseAvailability(text ?? '');
  if (!a.tn) return { ...a, label: String(text ?? '') };
  const g = RULES.CYBERWARE.gradeAvailability[o.grade ?? 'standard'] ?? { tn: 0, time: 1 };
  const c = o.cultured ? RULES.BIOWARE.availability.cultured : { tn: 0, time: 1 };
  const tn = a.tn + g.tn + c.tn;
  const hours = a.hours * g.time * c.time;
  const extra = [g.tn || g.time !== 1 ? `${o.grade}` : '', o.cultured ? 'cultured' : ''].filter(Boolean);
  return { tn, hours, label: extra.length ? `${tn}/${Math.round(hours * 10) / 10}h (${extra.join(', ')})` : String(text ?? '') };
}
