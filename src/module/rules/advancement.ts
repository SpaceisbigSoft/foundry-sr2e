/**
 * v0.64.0: character creation, the creation record, advancement and the approval queue. No Foundry
 * dependency: the glue (`applications/advancement.ts`, `applications/creation.ts`) passes plain data in.
 *
 * - The creation wizard's steps, what each priority letter allows, and which build-check rows belong to
 *   which step.
 * - The creation record: a frozen copy of the character when creation is finished (attributes, skills,
 *   spells, gear, cyberware, contacts, starting nuyen and Karma).
 * - The advancement log: what a burst of changes added (new ledger lines, new items, raised ratings)
 *   turned into dated lines ("Firearms 3 → 4, 8 Karma, by Corvo, approved by the GM").
 * - "Since creation": what changed on each row of the Current tab.
 * - Rating edits after creation: a player raising a rating by typing it is refused (Spend Karma does it).
 * - Approval requests: what a player asked for and what it costs, for the GM panel.
 */
import { RULES } from './config.ts';
import { BUILD_COLUMNS, PRIORITY_LETTERS, type BuildColumn, type Priority, type BuildRow } from './creation.ts';
import { priorityRow, raceNeed, magicTier, bookPriorities } from './core923.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';

// ---------------------------------------------------------------- The wizard

export type WizardStep = 'priorities' | 'metatype' | 'attributes' | 'magic' | 'skills' | 'resources' | 'contacts' | 'review';

export const WIZARD_STEPS: ReadonlyArray<{ id: WizardStep; label: string; hint: string }> = [
  { id: 'priorities', label: 'Priorities', hint: 'Give each column one letter, A to E.' },
  { id: 'metatype', label: 'Metatype', hint: 'Metahumans need a Race priority high enough for them.' },
  { id: 'attributes', label: 'Attributes', hint: 'Base ratings before racial modifiers, each 1 to the maximum.' },
  { id: 'magic', label: 'Magic', hint: 'Mundane, a full magician, an adept or an aspected magician, as the Magic priority allows.' },
  { id: 'skills', label: 'Skills', hint: 'Active, knowledge and language skills from the skill points.' },
  { id: 'resources', label: 'Resources', hint: 'Gear, cyberware and the lifestyle from the Resources nuyen.' },
  { id: 'contacts', label: 'Contacts', hint: 'The first contacts are free; more come out of Resources.' },
  { id: 'review', label: 'Finish', hint: 'Check the totals, then freeze the creation record.' },
];

export function stepIndex(step: string): number {
  const i = WIZARD_STEPS.findIndex((s) => s.id === step);
  return i < 0 ? 0 : i;
}

/** The step after (+1) or before (−1), clamped to the list. */
export function stepMove(step: string, by: number): WizardStep {
  const i = Math.max(0, Math.min(WIZARD_STEPS.length - 1, stepIndex(step) + Math.trunc(by)));
  return WIZARD_STEPS[i]!.id;
}

/**
 * Which step a build-check row belongs to (the review shows them all). v0.89.5: a row's own `step` (pass the row);
 * a bare label (a record saved earlier) is read by its English words.
 */
export function checkStep(row: string | { label?: string; step?: string }): WizardStep {
  if (row && typeof row === 'object' && row.step && WIZARD_STEPS.some((s) => s.id === row.step)) return row.step as WizardStep;
  const l = String((typeof row === 'string' ? row : row?.label) ?? '').toLowerCase();
  if (l.startsWith('priorit')) return 'priorities';
  if (l.startsWith('race')) return 'metatype';
  if (l.startsWith('attribute')) return 'attributes';
  if (l.startsWith('magic') || l.startsWith('spell') || l.startsWith('force')) return 'magic';
  if (l.startsWith('skill')) return 'skills';
  if (l.startsWith('contact')) return 'contacts';
  if (l.startsWith('resource') || l.startsWith('essence') || l.startsWith('cash') || l.startsWith('lifestyle')) return 'resources';
  return 'review';
}

/** Per step: 'ok', 'bad' (a failed check) or '' (nothing checked there yet). */
export function stepStates(rows: ReadonlyArray<Pick<BuildRow, 'label' | 'ok' | 'step'>>): Record<WizardStep, '' | 'ok' | 'bad'> {
  const out = Object.fromEntries(WIZARD_STEPS.map((s) => [s.id, ''])) as Record<WizardStep, '' | 'ok' | 'bad'>;
  for (const r of rows ?? []) {
    const s = checkStep(r);
    if (!r.ok) out[s] = 'bad';
    else if (out[s] !== 'bad') out[s] = 'ok';
  }
  return out;
}

/** What a priority letter gives in each column (for the priorities step's table). */
export function priorityTable(): Array<{ letter: Priority; race: string; magic: string; attributes: number; skills: number; resources: number }> {
  const c = RULES.CREATION;
  // v0.92.3 (RULES.CORE_V923.priorities 'book', Core p. 47): a metahuman needs A (C with More Metahumans).
  const kinds = bookPriorities() ? Object.keys(RULES.METATYPES.types) : Object.keys(c.race);
  const races = (l: Priority) => kinds.filter((k) => PRIORITY_LETTERS.indexOf(raceNeed(k)) >= PRIORITY_LETTERS.indexOf(l)).map((k) => k);
  return PRIORITY_LETTERS.map((l) => {
    const p = priorityRow(l);
    const h = magicTier(l, 'human');
    const m = magicTier(l, 'elf');
    const one = (x: string) => (x === 'full' ? tx('SR2E.Text.Advancement.fullMagician') : x === 'adept' ? tx('SR2E.Text.Advancement.adeptOrAspected') : '—');
    const split = [h === 'full' ? tx('SR2E.Text.Core923.humanMagician') : h === 'adept' ? tx('SR2E.Text.Core923.humanAdept') : '',
      m === 'full' ? tx('SR2E.Text.Core923.metahumanMagician') : m === 'adept' ? tx('SR2E.Text.Core923.metahumanAdept') : ''].filter(Boolean).join(' / ');
    return {
      letter: l,
      race: races(l).map((k) => cap(k)).join(', ') || tx('SR2E.Text.Advancement.human'),
      magic: h === m ? one(h) : split,
      attributes: p.attributes, skills: p.skills, resources: p.resources,
    };
  });
}

/** The metatypes a Race priority allows (with the letter each needs). */
export function metatypeChoices(race: Priority | undefined, metatypes: Record<string, { label: string }>): Array<{ key: string; label: string; need: Priority; allowed: boolean }> {
  return Object.entries(metatypes).map(([key, v]) => {
    const need = raceNeed(key) as Priority;
    return { key, label: v.label, need, allowed: !race || PRIORITY_LETTERS.indexOf(race) <= PRIORITY_LETTERS.indexOf(need) };
  });
}

export type BuildMagicKind = 'none' | 'full' | 'adept' | 'aspected';

/** The kinds of magic a Magic priority allows. */
export function magicChoices(magicPriority: Priority | undefined, metatype = 'human'): Array<{ key: BuildMagicKind; label: string; allowed: boolean }> {
  // v0.92.3 (RULES.CORE_V923.priorities 'book', Core p. 45): a metahuman magician needs B, a metahuman adept C.
  const m = magicPriority ? magicTier(magicPriority, metatype) : 'none';
  return [
    { key: 'none', label: tx('SR2E.Text.Advancement.mundane'), allowed: true },
    { key: 'full', label: tx('SR2E.Text.Advancement.fullMagician'), allowed: m === 'full' },
    { key: 'adept', label: tx('SR2E.Text.Advancement.physicalAdept'), allowed: m === 'full' || m === 'adept' },
    { key: 'aspected', label: tx('SR2E.Text.Advancement.aspectedMagician'), allowed: m === 'full' || m === 'adept' },
  ];
}

/** Traditions for each kind of magic (the first is the default). */
export const KIND_TRADITIONS: Record<BuildMagicKind, readonly string[]> = {
  none: ['none'],
  full: ['hermetic', 'shamanic'],
  adept: ['adept'],
  aspected: ['sorcerer', 'conjurer', 'elementalist', 'shamanist'],
};

/** The kind of magic a tradition (and a Magic rating) means. */
export function magicKindOf(tradition: string, magic: number): BuildMagicKind {
  const t = String(tradition ?? 'none');
  if (t === 'none') return Number(magic) > 0 ? 'full' : 'none';
  if (KIND_TRADITIONS.full.includes(t) || t === 'toxic' || t === 'insect') return 'full';
  if (t === 'adept') return 'adept';
  return 'aspected';
}

/** Attribute points spent (base ratings, before racial modifiers) and what the letter allows. */
export function attributePoints(attrs: Record<string, number>, letter: Priority | undefined): { used: number; allowed: number; left: number } {
  const used = Object.values(attrs ?? {}).reduce((n, v) => n + Math.max(0, Math.floor(Number(v) || 0)), 0);
  const allowed = letter ? priorityRow(letter).attributes : 0;
  return { used, allowed, left: allowed - used };
}

/** Did the player pick each letter once? (For the wizard's Next button on the first step.) */
export function prioritiesComplete(p: Partial<Record<BuildColumn, Priority>>): boolean {
  const letters = BUILD_COLUMNS.map((k) => p?.[k]).filter(Boolean);
  return letters.length === BUILD_COLUMNS.length && new Set(letters).size === letters.length;
}

/**
 * Picking a letter in one column: a column already holding that letter swaps to the old letter of the
 * column being changed (so the table stays one of each). Returns the new priorities.
 */
export function swapPriority(p: Partial<Record<BuildColumn, Priority>>, column: BuildColumn, letter: Priority | ''): Partial<Record<BuildColumn, Priority>> {
  const next: Partial<Record<BuildColumn, Priority>> = { ...(p ?? {}) };
  const old = next[column];
  if (!letter) { delete next[column]; return next; }
  for (const k of BUILD_COLUMNS) {
    if (k !== column && next[k] === letter) {
      if (old) next[k] = old; else delete next[k];
    }
  }
  next[column] = letter;
  return next;
}

// ---------------------------------------------------------------- The creation record

export interface RecordSkill { name: string; kind: string; rating: number; specialization?: string; specializationRating?: number; concentration?: string; concentrationRating?: number }
export interface CreationRecord {
  v: 1;
  /** Real date (ISO) and world time when creation was finished. */
  finishedAt: string;
  worldTime: number;
  by: string;
  /** 'wizard': finished in the wizard; 'asIs': the character as it stood (made before the wizard). */
  how: 'wizard' | 'asIs';
  priorities: Partial<Record<BuildColumn, Priority>>;
  metatype: string;
  tradition: string;
  magicKind: BuildMagicKind;
  magic: number;
  attributes: Record<string, { base: number; natural: number }>;
  essence: number;
  skills: RecordSkill[];
  spells: Array<{ name: string; force: number }>;
  adeptPowers: Array<{ name: string; level: number }>;
  gear: Array<{ name: string; type: string; quantity: number; rating?: number }>;
  cyberware: Array<{ name: string; rating: number; grade: string; essence: number; bioware: boolean }>;
  contacts: Array<{ name: string; level: number; role: string }>;
  qualities: Array<{ name: string; kind: string; points: number }>;
  nuyen: number;
  karma: { good: number; pool: number; career: number };
  lifestyle: { level: string; paidUntil: number };
  checks: Array<{ label: string; used: string; allowed: string; ok: boolean; note?: string }>;
  failed: number;
}

/** A plain view of a character (the glue builds it from the actor). */
export interface CharacterView {
  system: any;
  items: ReadonlyArray<{ type: string; name: string; system: any }>;
}

const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const cap = (s: string) => String(s ?? '').charAt(0).toUpperCase() + String(s ?? '').slice(1);
/** An attribute's name in the user's language (its key, capitalised, when lang/en.json has no name for it). */
const attributeLabel = (k: string): string => {
  const key = `SR2E.Attribute.${k}`;
  const label = tKey(key);
  return label === key ? cap(k) : label;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const GEAR_TYPES = ['weapon', 'armor', 'gear', 'focus', 'cyberdeck', 'program'];

/** Freeze a character into a creation record. */
export function creationRecordFrom(c: CharacterView, o: { by: string; now: string; worldTime: number; how: 'wizard' | 'asIs'; priorities?: Partial<Record<BuildColumn, Priority>>; checks?: ReadonlyArray<BuildRow> }): CreationRecord {
  const s = c.system ?? {};
  const items = [...(c.items ?? [])];
  const of = (t: string) => items.filter((i) => i.type === t);
  const attrs: Record<string, { base: number; natural: number }> = {};
  for (const [k, a] of Object.entries((s.attributes ?? {}) as Record<string, any>)) attrs[k] = { base: num(a?.base), natural: num(a?.natural ?? a?.base) };
  const checks = [...(o.checks ?? [])].map((r) => ({ label: String(r.label), used: String(r.used ?? ''), allowed: String(r.allowed ?? ''), ok: Boolean(r.ok), ...(r.note ? { note: String(r.note) } : {}) }));
  return {
    v: 1,
    finishedAt: o.now, worldTime: num(o.worldTime), by: String(o.by ?? ''), how: o.how,
    priorities: { ...(o.priorities ?? {}) },
    metatype: String(s.metatype ?? 'human'),
    tradition: String(s.tradition ?? 'none'),
    magicKind: magicKindOf(String(s.tradition ?? 'none'), num(s.magic)),
    magic: num(s.magic),
    attributes: attrs,
    essence: round2(num(s.derived?.essence ?? s.essence, 6)),
    skills: of('skill').map((i) => ({
      name: i.name, kind: String(i.system?.kind ?? 'active'), rating: num(i.system?.rating),
      ...(i.system?.specialization ? { specialization: String(i.system.specialization), specializationRating: num(i.system.specializationRating) } : {}),
      ...(i.system?.concentration ? { concentration: String(i.system.concentration), concentrationRating: num(i.system.concentrationRating) } : {}),
    })).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)),
    spells: of('spell').map((i) => ({ name: i.name, force: num(i.system?.learnedForce ?? i.system?.force) })),
    adeptPowers: of('adeptpower').map((i) => ({ name: i.name, level: num(i.system?.level) })),
    gear: items.filter((i) => GEAR_TYPES.includes(i.type)).map((i) => ({ name: i.name, type: i.type, quantity: Math.max(1, num(i.system?.quantity, 1)),
      ...(num(i.system?.rating) > 0 ? { rating: num(i.system.rating) } : {}) })),
    cyberware: of('cyberware').map((i) => ({ name: i.name, rating: num(i.system?.rating), grade: String(i.system?.grade ?? 'standard'), essence: round2(num(i.system?.essenceCost)), bioware: Boolean(i.system?.bioware) })),
    contacts: [...(s.contacts ?? [])].map((x: any) => ({ name: String(x.name ?? ''), level: num(x.level, 1), role: String(x.role ?? '') })),
    qualities: [...(s.qualities ?? [])].map((q: any) => ({ name: String(q.name ?? ''), kind: String(q.kind ?? 'edge'), points: num(q.points) })),
    nuyen: num(s.nuyen),
    karma: { good: num(s.karma?.good), pool: num(s.karma?.pool), career: num(s.karma?.career) },
    lifestyle: { level: String(s.lifestyle?.level ?? 'low'), paidUntil: num(s.lifestyle?.paidUntil, -1) },
    checks,
    failed: checks.filter((r) => !r.ok).length,
  };
}

/** Is this a usable record (a flag can hold anything)? */
export function isCreationRecord(r: unknown): r is CreationRecord {
  return Boolean(r && typeof r === 'object' && (r as any).v === 1 && typeof (r as any).finishedAt === 'string' && (r as any).attributes && typeof (r as any).attributes === 'object');
}

// ---------------------------------------------------------------- The advancement log

export interface LedgerEntry { t?: number; kind: 'karma' | 'nuyen' | 'pool'; amount: number; reason: string }

/** The ledger lines `next` added to `old` (the ledger only grows at the end; old lines may fall off the front). */
export function ledgerAdded(old: ReadonlyArray<LedgerEntry>, next: ReadonlyArray<LedgerEntry>): LedgerEntry[] {
  const a = [...(old ?? [])], b = [...(next ?? [])];
  const same = (x: LedgerEntry, y: LedgerEntry) => x.kind === y.kind && x.amount === y.amount && x.reason === y.reason && (x.t ?? 0) === (y.t ?? 0);
  // The longest end of `old` that `next` starts with.
  for (let k = Math.min(a.length, b.length); k > 0; k--) {
    let ok = true;
    for (let i = 0; i < k; i++) if (!same(a[a.length - k + i]!, b[i]!)) { ok = false; break; }
    if (ok) return b.slice(k);
  }
  // Nothing in common: everything new is new (or the ledger was rewritten; then nothing is).
  return a.length ? [] : b;
}

export type AdvanceEvent =
  | { kind: 'ledger'; entry: LedgerEntry }
  | { kind: 'item'; type: string; name: string; amount?: number }
  | { kind: 'raise'; label: string; from: number; to: number; alias?: string };

export interface AdvanceLine {
  id: string;
  /** Real date (ISO) and world time. */
  at: string;
  t: number;
  what: string;
  karma: number;
  nuyen: number;
  by: string;
  approvedBy: string;
  /** 'gain' (bought, learned, raised), 'award' (Karma in), 'note' (written by the GM). */
  kind: 'gain' | 'award' | 'note';
}

/** Item types worth a line when they arrive after creation. */
export const LOGGED_ITEM_TYPES = ['skill', 'weapon', 'armor', 'gear', 'cyberware', 'spell', 'power', 'focus', 'adeptpower', 'cyberdeck', 'program'];

/** Rating fields worth a line when they go up: per item type, field → label. */
export const RAISE_FIELDS: Record<string, Record<string, string>> = {
  skill: { rating: '', specializationRating: 'specialization', concentrationRating: 'concentration' },
  spell: { learnedForce: 'Force' },
  adeptpower: { level: 'level' },
  focus: { rating: 'rating' },
};

/** The raises in an item update: the item's current system and the update's (flattened) changes. */
export function itemRaises(type: string, name: string, current: any, changes: Record<string, unknown>): Array<{ label: string; from: number; to: number }> {
  const fields = RAISE_FIELDS[type];
  if (!fields) return [];
  const out: Array<{ label: string; from: number; to: number }> = [];
  for (const [f, word] of Object.entries(fields)) {
    const key = `system.${f}`;
    if (!Object.prototype.hasOwnProperty.call(changes, key)) continue;
    const to = num(changes[key]);
    // An unset specialization rating means the skill's rating.
    const from = f === 'specializationRating' || f === 'concentrationRating' ? num(current?.[f]) || num(current?.rating) : num(current?.[f]);
    if (to <= from) continue;
    const sub = f === 'specializationRating' ? current?.specialization : f === 'concentrationRating' ? current?.concentration : '';
    out.push({ label: sub ? `${name} (${sub})` : word ? `${name} ${word}` : name, from, to });
  }
  return out;
}

/** The raises in an actor update: base attributes, Magic and the initiate grade. */
export function actorRaises(current: any, changes: Record<string, unknown>): Array<{ label: string; from: number; to: number; alias?: string }> {
  // v0.89.6 review: `alias` is the English name, so a ledger line written in English ("Body 4 → 5") still covers the raise
  const out: Array<{ label: string; from: number; to: number; alias?: string }> = [];
  for (const [key, v] of Object.entries(changes ?? {})) {
    const m = /^system\.attributes\.(\w+)\.base$/.exec(key);
    if (m) {
      const from = num(current?.attributes?.[m[1]!]?.base);
      if (num(v) > from) out.push({ label: attributeLabel(m[1]!), from, to: num(v), alias: m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1) });
    } else if (key === 'system.magic' && num(v) > num(current?.magic)) out.push({ label: tx('SR2E.Text.Advancement.magic'), from: num(current?.magic), to: num(v), alias: 'Magic' });
    else if (key === 'system.initiateGrade' && num(v) > num(current?.initiateGrade)) out.push({ label: tx('SR2E.Text.Advancement.initiation'), from: num(current?.initiateGrade), to: num(v), alias: 'Initiation' });
  }
  return out;
}

const said = (text: string, name: string) => {
  const t = String(text ?? '').toLowerCase(), n = String(name ?? '').trim().toLowerCase();
  return n.length > 0 && t.includes(n);
};

/**
 * One burst of changes (a purchase, a Karma spend, an award) as log lines. Ledger lines carry the cost
 * and usually name what was bought or raised; items and raises they name are not listed again.
 */
export function composeAdvancement(events: ReadonlyArray<AdvanceEvent>, ctx: { by: string; approvedBy?: string; at: string; t: number; ids?: () => string }): AdvanceLine[] {
  const id = ctx.ids ?? (() => Math.random().toString(36).slice(2, 12));
  const items = events.filter((e): e is Extract<AdvanceEvent, { kind: 'item' }> => e.kind === 'item');
  const raises = events.filter((e): e is Extract<AdvanceEvent, { kind: 'raise' }> => e.kind === 'raise');
  const covered = new Set<AdvanceEvent>();
  const lines: AdvanceLine[] = [];
  const base = { at: ctx.at, t: ctx.t, by: String(ctx.by ?? ''), approvedBy: String(ctx.approvedBy ?? '') };
  const cover = (reason: string) => {
    for (const e of items) if (said(reason, e.name)) covered.add(e);
    for (const e of raises) if (said(reason, e.label) || said(reason, e.label.split(' (')[0]!.replace(/ (Force|level|rating)$/, '')) || (e.alias && said(reason, e.alias))) covered.add(e);
  };
  for (const e of events) {
    if (e.kind !== 'ledger') continue;
    const l = e.entry;
    const amount = Math.round(num(l.amount));
    if (!amount) continue;
    if (l.kind === 'karma') {
      // Karma coming back (training given up or refunded, a binding undone) is not an award.
      const back = amount > 0 && /refund|given up|undone|comes back/i.test(String(l.reason ?? ''));
      lines.push({ ...base, id: id(), what: l.reason || (amount > 0 ? tx('SR2E.Text.Advancement.karmaAward') : tx('SR2E.Text.Advancement.karmaSpent')), karma: amount, nuyen: 0, kind: amount > 0 && !back ? 'award' : 'gain' });
      cover(l.reason);
    } else if (l.kind === 'pool') {
      lines.push({ ...base, id: id(), what: l.reason || tx('SR2E.Text.Advancement.karmaPool', { amount: `${amount > 0 ? '+' : ''}${amount}` }), karma: 0, nuyen: 0, kind: 'award' });
    } else if (l.kind === 'nuyen' && amount < 0) {
      // Spending counts only when it bought something in this burst (lifestyle, fees and fines don't).
      const buys = items.filter((x) => said(l.reason, x.name));
      if (!buys.length && !/^bought\b/i.test(String(l.reason ?? ''))) continue;
      lines.push({ ...base, id: id(), what: l.reason || tx('SR2E.Text.Advancement.bought'), karma: 0, nuyen: amount, kind: 'gain' });
      cover(l.reason);
    }
  }
  for (const r of raises) if (!covered.has(r)) lines.push({ ...base, id: id(), what: `${r.label} ${r.from} → ${r.to}`, karma: 0, nuyen: 0, kind: 'gain' });
  const free = items.filter((x) => !covered.has(x));
  if (free.length) {
    const named = free.map((x) => `${x.name}${num(x.amount) > 1 ? ` ×${num(x.amount)}` : ''}`);
    lines.push({ ...base, id: id(), what: tx('SR2E.Text.Advancement.gained', { list: named.join(', ') }), karma: 0, nuyen: 0, kind: 'gain' });
  }
  return lines;
}

/** The log with new lines (oldest first, at most `max`). */
export function appendAdvancement(log: ReadonlyArray<AdvanceLine> | null | undefined, lines: ReadonlyArray<AdvanceLine>, max = RULES_ADVANCEMENT.logMax): AdvanceLine[] {
  const list = [...(Array.isArray(log) ? log : []), ...lines];
  return list.slice(-Math.max(1, max));
}

/** A log line as one short sentence. */
export function describeLine(l: AdvanceLine): string {
  const cost = [l.karma ? tx('SR2E.Text.Advancement.karmaAmount', { amount: `${l.karma > 0 ? '+' : ''}${l.karma}` }) : '', l.nuyen ? `¥${Math.abs(l.nuyen).toLocaleString()}` : ''].filter(Boolean).join(', ');
  const who = l.by
    ? (l.approvedBy ? tx('SR2E.Text.Advancement.byApprovedBy', { by: l.by, approvedBy: l.approvedBy }) : tx('SR2E.Text.Advancement.by', { by: l.by }))
    : (l.approvedBy ? tx('SR2E.Text.Advancement.approvedBy', { approvedBy: l.approvedBy }) : '');
  return `${l.what}${cost ? ` (${cost})` : ''}${who ? `, ${who}` : ''}`;
}

/** Karma and nuyen in all over the log (spent is negative). */
export function advancementTotals(log: ReadonlyArray<AdvanceLine>): { karmaIn: number; karmaSpent: number; nuyenSpent: number; lines: number } {
  let karmaIn = 0, karmaSpent = 0, nuyenSpent = 0;
  for (const l of log ?? []) {
    // Awards count in; Karma coming back (a refund) takes off what was spent.
    if (l.karma > 0 && l.kind === 'award') karmaIn += l.karma; else karmaSpent -= l.karma;
    if (l.nuyen < 0) nuyenSpent += -l.nuyen;
  }
  return { karmaIn, karmaSpent: Math.max(0, karmaSpent), nuyenSpent, lines: (log ?? []).length };
}

export const RULES_ADVANCEMENT = {
  /** Log lines kept per character. */
  logMax: 500,
  /** Changes within this many milliseconds make one burst (a purchase's items and its payment). */
  burstMs: 700,
  /** Requests kept per character. */
  requestMax: 50,
};

// ---------------------------------------------------------------- Since creation

/** "+1", "−2", "new" or "" for a number now against the record's. */
export function delta(now: number, then: number | undefined | null): string {
  if (then === undefined || then === null) return tx('SR2E.Text.Advancement.new');
  const d = round2(num(now) - num(then));
  return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '';
}

/** Per row of the Current tab, what changed since creation. */
export function sinceCreation(rec: CreationRecord | null | undefined, now: { attributes: Record<string, number>; skills: Array<{ name: string; rating: number }>; magic: number; essence: number; career: number; nuyen: number; good: number }): {
  attributes: Record<string, string>; skills: Record<string, string>; magic: string; essence: string; karmaEarned: number; nuyen: string; good: string; newSkills: string[];
} {
  if (!isCreationRecord(rec)) return { attributes: {}, skills: {}, magic: '', essence: '', karmaEarned: 0, nuyen: '', good: '', newSkills: [] };
  const attributes: Record<string, string> = {};
  for (const [k, v] of Object.entries(now.attributes ?? {})) attributes[k] = rec.attributes[k] ? delta(v, rec.attributes[k]!.natural) : '';
  const skills: Record<string, string> = {};
  const recSkills = new Map(rec.skills.map((s) => [s.name.toLowerCase(), s.rating]));
  const newSkills: string[] = [];
  for (const s of now.skills ?? []) {
    const then = recSkills.get(s.name.toLowerCase());
    skills[s.name] = delta(s.rating, then);
    if (then === undefined) newSkills.push(s.name);
  }
  return {
    attributes, skills, newSkills,
    magic: delta(now.magic, rec.magic),
    essence: delta(now.essence, rec.essence),
    karmaEarned: Math.max(0, num(now.career) - num(rec.karma.career)),
    nuyen: delta(now.nuyen, rec.nuyen),
    good: delta(now.good, rec.karma.good),
  };
}

/** An attribute's hover text: where the total comes from. */
export function attributeSources(a: { base: number; racial: number; mod: number; gear: number; total: number }, named: ReadonlyArray<{ name: string; value: number }> = [], notes: ReadonlyArray<string> = []): string {
  const sign = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);
  const lines = [tx('SR2E.Text.Advancement.base', { value: num(a.base) })];
  if (num(a.racial)) lines.push(tx('SR2E.Text.Advancement.racial', { value: sign(num(a.racial)) }));
  if (num(a.mod)) lines.push(tx('SR2E.Text.Advancement.modifier', { value: sign(num(a.mod)) }));
  const shown = named.filter((n) => num(n.value));
  if (shown.length) for (const n of shown) lines.push(`${n.name} ${sign(num(n.value))}`);
  else if (num(a.gear)) lines.push(tx('SR2E.Text.Advancement.augmentations', { value: sign(num(a.gear)) }));
  const sum = num(a.base) + num(a.racial) + num(a.mod) + num(a.gear);
  if (sum !== num(a.total)) lines.push(tx('SR2E.Text.Advancement.limitsAndLoad', { value: sign(num(a.total) - sum) }));
  for (const n of notes) if (n) lines.push(n);
  lines.push(`= ${num(a.total)}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------- Rating edits after creation

/** Fields a player may not raise by typing once creation is finished (actor and per item type). */
export const LOCKED_ACTOR_FIELDS = /^system\.(attributes\.\w+\.base|magic|initiateGrade|essence)$/;
export const LOCKED_ITEM_FIELDS: Record<string, readonly string[]> = {
  skill: ['system.rating', 'system.specializationRating', 'system.concentrationRating'],
  spell: ['system.learnedForce'],
  adeptpower: ['system.level'],
  focus: ['system.rating'],
  cyberware: ['system.rating'],
};

/** Does the lock apply? Only to players (not GMs), on characters whose creation is finished. */
export function ratingLockApplies(o: { isGM: boolean; actorType: string; finished: boolean }): boolean {
  return !o.isGM && o.actorType === 'character' && Boolean(o.finished);
}

/**
 * The raised fields an edit would change (flattened keys → [from, to]); the caller drops them and says why.
 * Lowering is allowed (it gains nothing); Essence is locked both ways (it only moves with ware and magic).
 */
export function lockedRaises(kind: 'actor' | 'item', itemType: string, current: (key: string) => unknown, changes: Record<string, unknown>): Array<{ key: string; from: number; to: number }> {
  const out: Array<{ key: string; from: number; to: number }> = [];
  for (const [key, v] of Object.entries(changes ?? {})) {
    const locked = kind === 'actor' ? LOCKED_ACTOR_FIELDS.test(key) : (LOCKED_ITEM_FIELDS[itemType] ?? []).includes(key);
    if (!locked) continue;
    const from = num(current(key));
    const to = num(v);
    if (to > from || (key === 'system.essence' && to !== from)) out.push({ key, from, to });
  }
  return out;
}

// ---------------------------------------------------------------- The approval queue

/** v0.91.1: 'entry' = a player's new catalogue entry for the GM to check. */
export type RequestKind = 'improve' | 'add' | 'skill' | 'spellForce' | 'edge' | 'buyOff' | 'quality' | 'entry';

export interface ApprovalRequest {
  id: string;
  kind: RequestKind;
  /** One line: "Raise Firearms 3 → 4", "Buy Heavy pistol ×2". */
  label: string;
  karma: number;
  nuyen: number;
  userId: string;
  userName: string;
  /** Real time (ms) asked. */
  at: number;
  /** What to do on approval (kind-specific, plain data). */
  data: Record<string, unknown>;
}

/** Does a player's spend wait for the GM? (The world setting is off by default; GMs never wait; creation doesn't.) */
export function needsApproval(o: { queueOn: boolean; isGM: boolean; actorType: string; inCreation: boolean }): boolean {
  return Boolean(o.queueOn) && !o.isGM && o.actorType === 'character' && !o.inCreation;
}

/** A new request (the caller gives the id and time). */
export function makeRequest(o: Omit<ApprovalRequest, 'karma' | 'nuyen'> & { karma?: number; nuyen?: number }): ApprovalRequest {
  return { ...o, karma: Math.max(0, Math.floor(num(o.karma))), nuyen: Math.max(0, Math.floor(num(o.nuyen))), label: String(o.label ?? '').slice(0, 200) };
}

/** The request list with one more (a same-label request from the same user replaces the old one). */
export function withRequest(list: ReadonlyArray<ApprovalRequest> | null | undefined, r: ApprovalRequest, max = RULES_ADVANCEMENT.requestMax): ApprovalRequest[] {
  const keep = [...(Array.isArray(list) ? list : [])].filter((x) => !(x.userId === r.userId && x.kind === r.kind && x.label === r.label));
  return [...keep, r].slice(-Math.max(1, max));
}

/** A request as the GM panel shows it. */
export function describeRequest(r: ApprovalRequest, have: { karma: number; nuyen: number }): { text: string; cost: string; short: boolean } {
  const cost = [r.karma ? tx('SR2E.Text.Advancement.karmaAmount', { amount: r.karma }) : '', r.nuyen ? `¥${r.nuyen.toLocaleString()}` : ''].filter(Boolean).join(' + ') || tx('SR2E.Text.Advancement.free');

  const short = r.karma > num(have.karma) || r.nuyen > num(have.nuyen);
  return { text: `${r.userName}: ${r.label}`, cost, short };
}

export const _advancementInternals = { said };
