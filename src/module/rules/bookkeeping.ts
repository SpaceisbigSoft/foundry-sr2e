/**
 * v0.73.0: cross-cutting bookkeeping, O39–O43 from the v0.69.0 review (pure rules, no Foundry). Values and
 * switches in RULES.CROSSCUT_V73 (rules/config73/crosscut.ts): Region documents in the undo log (O39), the GM's
 * "Change target number…" rows (O40), statuses that outlive their reason (O41), the advancement log against
 * projects (O42), and vehicle mod installs paid up front (O43). Each function honours its switch, so with the
 * switch off the caller gets the old behaviour back.
 */
import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { tnCandidates, metatypePrejudice } from './situation.ts';
import { composeAdvancement, advancementTotals, type AdvanceEvent, type AdvanceLine } from './advancement.ts';
import { CROSSCUT_V73 } from './config73/crosscut.ts';
import { undoLimitRows } from './gmtools.ts';
import { t as tx } from '../helpers/i18n.ts';

type Cfg = typeof CROSSCUT_V73;
/** The live block: RULES.CROSSCUT_V73 once wired into RULES (the same object), else the module's own. */
const C = (): Cfg => ((RULES as any).CROSSCUT_V73 ?? CROSSCUT_V73) as Cfg;
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ---------------------------------------------------------------- O39: Region documents in the undo log

/** The document kinds the undo log follows: `base` (applications/undo.ts LOGGED_DOCS) plus Region when it is on. */
export function undoDocsV73(base: ReadonlyArray<string>): string[] {
  const list = [...base];
  if (C().undo.regions && !list.includes('Region')) list.push('Region');
  if (!C().undo.regions) return list.filter((d) => d !== 'Region');
  return list;
}

/** Why the area sweep took an area off: the world clock, a new Combat Turn, the combat ending, or the real-time backstop. */
export type AreaSweepCause = 'clock' | 'round' | 'combatEnd' | 'timer';

/**
 * Should the undo log leave this change out? Only a Region deletion by the area sweep's real-time backstop
 * (`options.sr2eAreaSweep === 'timer'`) is left out, and only with `undo.skipTimedOut`. A sweep set off by the
 * clock or a Combat Turn is logged, so it joins that step and undoing the step brings the cloud back.
 */
export function undoSkipsChange(docName: string, op: 'create' | 'update' | 'delete', options: { sr2eAreaSweep?: string } | null | undefined): boolean {
  if (docName !== 'Region' || op !== 'delete') return false;
  return Boolean(C().undo.skipTimedOut) && options?.sr2eAreaSweep === 'timer';
}

const REGION_LIMIT_ON = 'Map regions (blast areas, environment regions, smoke and gas clouds, wards and barrier-spell regions) are logged; one that runs out by itself on the real-time timer isn’t a step, and region behaviours (Foundry’s Region Behaviours) aren’t logged.';
const REGION_LIMIT_OFF = 'Map regions (blast areas, environment regions, smoke and gas clouds, wards and barrier-spell regions) are not logged: undoing a smoke grenade or a ward leaves its region on the map (delete it by hand).';

/** The panel's "what undo can't put back" list (`base` = rules/gmtools.ts `undoLimits()`) with the line about regions. */
export function undoLimitsV73(base: ReadonlyArray<string>): string[] {
  const list = base.filter((l) => l !== REGION_LIMIT_ON && l !== REGION_LIMIT_OFF);
  // Next to the list of things not logged at all.
  // v0.89.6: by the row's id (gmtools undoLimitRows), not by its words; an English list from elsewhere still matches.
  const notLogged = undoLimitRows().find((r) => r.id === 'notLogged')?.text;
  let at = list.findIndex((l) => l === notLogged);
  if (at < 0) at = list.findIndex((l) => /not logged/i.test(l));
  const line = C().undo.regions ? REGION_LIMIT_ON : REGION_LIMIT_OFF;
  if (at < 0) list.push(line); else list.splice(at + 1, 0, line);
  return list;
}

// ---------------------------------------------------------------- O40: the GM's "Change target number…" rows

type Group = { group: string; rows: TargetNumberModifier[]; id?: string };

const rowsOf = (rows: ReadonlyArray<{ label: string; value: number; id?: string }>): TargetNumberModifier[] =>
  rows.filter((m) => m && num(m.value)).map((m) => ({ ...(m.id ? { id: m.id } : {}), label: String(m.label), value: num(m.value) }));

/** A plain Perception card (Notice or Listen) by its snapshot's reveal kind. */
const perceptionReveal = (kind: string, reveal: string | undefined): boolean => kind === 'plain' && (reveal === 'notice' || reveal === 'listen');

/** The Hearing rows: Deaf, cyberear amplification 1…max, adept Improved Hearing and background noise (labels as rules/kit.ts makes them). */
export function hearingRowsV73(): TargetNumberModifier[] {
  const h: any = (RULES as any).COMBAT_V61?.hearing ?? {};
  const out: Array<{ id?: string; label: string; value: number }> = [{ id: 'deaf', label: tx('SR2E.Card.Mod.deaf'), value: num((RULES as any).STATUSES?.deaf?.hearingTn) }];
  const max = Math.max(0, Math.floor(num(h.ampMax)));
  for (let n = 1; n <= max; n++) out.push({ label: tx('SR2E.Card.Mod.hearingAmplification', { n }), value: n * num(h.ampPerRating) });
  out.push({ id: 'improvedHearingAdept', label: tx('SR2E.Card.Mod.improvedHearingAdept'), value: num(h.adeptHearingTn) });
  for (const [id, v] of Object.entries((h.noiseTn ?? {}) as Record<string, number>)) out.push({ label: tx('SR2E.Card.Mod.noise', { id }), value: num(v) });
  return rowsOf(out);
}

/** Melee superior position rows (labels as rules/kit.ts superiorPositionModifiers makes them); empty by the switch. */
export function superiorRowsV73(): TargetNumberModifier[] {
  const mode = C().retarget.superiorPosition;
  const s: any = (RULES as any).COMBAT_V61?.superiorPosition ?? {};
  if (mode === 'never' || (mode === 'whenOn' && !s.enabled)) return [];
  return rowsOf([{ id: 'superiorPosition', label: tx('SR2E.Card.Mod.superiorPosition'), value: num(s.holder) }, { id: 'opponentHasSuperiorPosition', label: tx('SR2E.Card.Mod.opponentHasSuperiorPosition'), value: num(s.against) }]);
}

/** Metatype prejudice rows (labels as rules/situation.ts metatypePrejudice makes them). */
export function prejudiceRowsV73(): TargetNumberModifier[] {
  const list: ReadonlyArray<{ a: string; b: string; value: number }> = (RULES as any).TN_AUTO?.social?.prejudice ?? [];
  const out: TargetNumberModifier[] = [];
  for (const r of list) {
    const m = metatypePrejudice(r.a, r.b);
    if (m && !out.some((x) => x.label === m.label)) out.push(m);
  }
  return out;
}

/** Put `g` before the trailing "Skill" group (the defaulting row stays last). */
function insertGroup(groups: Group[], g: Group): void {
  if (!g.rows.length) return;
  const at = groups.findIndex((x) => x.id === 'skill');
  if (at < 0) groups.push(g); else groups.splice(at, 0, g);
}

/**
 * v0.73.0 (O40): the GM's checklist for a card: `tnCandidates` with a plain Perception card (`reveal` 'notice' or
 * 'listen') given the Perception groups, Hearing and "The observer" rows on Perception and Sneak cards, superior
 * position on attack and defend, and metatype prejudice on social cards. `applied`: labels already on the card
 * (any "Prejudice (…)" there, or since v0.89.4 its id `prejudice`, drops the whole prejudice group; the dialog drops other repeats itself).
 * Every switch off = exactly `tnCandidates(kind)`.
 */
export function retargetGroupsV73(kind: string, o: { reveal?: string; applied?: ReadonlyArray<string> } = {}): Group[] {
  const r = C().retarget;
  const asPerception = r.noticeAsPerception && perceptionReveal(kind, o.reveal);
  const groups: Group[] = tnCandidates(asPerception ? 'perceive' : kind).map((g) => ({ ...(g.id ? { id: g.id } : {}), group: g.group, rows: [...g.rows] }));
  const perceptionCard = kind === 'perceive' || kind === 'sneak' || asPerception;
  if (r.hearingRows && perceptionCard) {
    insertGroup(groups, { group: tx('SR2E.Card.Bookkeeping.hearing'), rows: hearingRowsV73() });
    const blind: any = (RULES as any).STATUSES?.blind ?? {};
    insertGroup(groups, { group: tx('SR2E.Card.Bookkeeping.theObserver'), rows: rowsOf([
      { id: 'blinded', label: tx('SR2E.Card.Mod.blinded'), value: Math.max(num(blind.attackTn), num(blind.otherTn)) },
      { id: 'sustaining', label: tx('SR2E.Card.Mod.sustainingASpell'), value: num((RULES as any).MAGIC?.sustainedTnMod) },
    ]) });
  }
  if (kind === 'attack' || kind === 'defend') insertGroup(groups, { group: tx('SR2E.Card.Bookkeeping.superiorPositionMelee'), rows: superiorRowsV73() });
  if (kind === 'social' && r.prejudiceRows && !(o.applied ?? []).some((l) => String(l) === 'prejudice' || /^Prejudice \(/.test(String(l)))) {
    insertGroup(groups, { group: tx('SR2E.Card.Bookkeeping.prejudice'), rows: prejudiceRowsV73() });
  }
  return groups;
}

// ---------------------------------------------------------------- O41: statuses that outlive their reason

/** The actor flags to take off when the combat it was in ends (morale "broken", by `statuses.brokenEndsWithCombat`). */
export function combatEndUnsets(flags: { broken?: unknown } | null | undefined): string[] {
  return C().statuses.brokenEndsWithCombat && flags?.broken ? ['broken'] : [];
}

/**
 * The power-effect entries to take off when timed statuses ran out (`due`: the status ids that just ended):
 * entries that set one of those statuses for a number of Combat Turns (`holdTurns` > 0). An untimed entry with the
 * same status (a sustained hold) stays. Empty with `statuses.timedHoldEnds` off.
 */
export function timedOutHoldIds(entries: ReadonlyArray<{ id?: string; status?: string; holdTurns?: number }> | null | undefined, due: ReadonlyArray<string>): string[] {
  if (!C().statuses.timedHoldEnds || !due?.length) return [];
  const ended = new Set(due.map(String));
  return (entries ?? []).filter((e) => e && e.id && e.status && ended.has(String(e.status)) && num(e.holdTurns) > 0).map((e) => String(e.id));
}

// ---------------------------------------------------------------- O42: the advancement log and projects

/** A log line, possibly a refund (v0.73.0: nuyen given back when a project is given up). */
export type RefundAware = AdvanceLine & { refund?: boolean };

const REFUND = /^Given up \(refund\):\s*/i;

/** What a "Given up (refund): …" reason gave back, as a name to look for in the log ('' when it isn't one). */
export function refundedName(reason: string): string {
  const s = String(reason ?? '');
  if (!REFUND.test(s)) return '';
  return s.replace(REFUND, '').replace(/\s+on order$/i, '').replace(/\s+×\d+$/, '').trim();
}

/**
 * Should a nuyen refund go into the log? 'all': yes. 'matched': only when an earlier line spent nuyen on it (its
 * text names what was given back), so a refund of a spend that was never logged (deck materials, a site, a mod)
 * doesn't take nuyen off the total. 'off': never (the old way).
 */
export function refundLogged(reason: string, log: ReadonlyArray<AdvanceLine> | null | undefined): boolean {
  const mode = C().advancement.nuyenRefunds;
  const name = refundedName(reason);
  if (mode === 'off' || !name) return false;
  if (mode === 'all') return true;
  const n = name.toLowerCase();
  return (log ?? []).some((l) => l && num(l.nuyen) < 0 && String(l.what ?? '').toLowerCase().includes(n));
}

/**
 * v0.73.0 (O42): composeAdvancement plus refund lines: a nuyen ledger line "Given up (refund): …" becomes a line
 * with +nuyen and `refund: true` (by `refundLogged`; `ctx.log` = the log so far). Off = composeAdvancement.
 */
export function composeAdvancementV73(events: ReadonlyArray<AdvanceEvent>, ctx: { by: string; approvedBy?: string; at: string; t: number; ids?: () => string; log?: ReadonlyArray<AdvanceLine> }): RefundAware[] {
  const lines: RefundAware[] = composeAdvancement(events, ctx);
  const id = ctx.ids ?? (() => Math.random().toString(36).slice(2, 12));
  for (const e of events) {
    if (e.kind !== 'ledger' || e.entry.kind !== 'nuyen') continue;
    const amount = Math.round(num(e.entry.amount));
    if (amount <= 0 || !refundLogged(e.entry.reason, [...(ctx.log ?? []), ...lines])) continue;
    lines.push({ at: ctx.at, t: ctx.t, by: String(ctx.by ?? ''), approvedBy: String(ctx.approvedBy ?? ''), id: id(), what: String(e.entry.reason), karma: 0, nuyen: amount, kind: 'gain', refund: true });
  }
  return lines;
}

/** Is this line a nuyen refund? (Flagged, or an older line whose text says so.) */
const isRefund = (l: RefundAware): boolean => num(l.nuyen) > 0 && (l.refund === true || REFUND.test(String(l.what ?? '')));

/** advancementTotals with nuyen refunds taken off "nuyen spent" (never below 0). Off ('off') = advancementTotals. */
export function advancementTotalsV73(log: ReadonlyArray<RefundAware>): ReturnType<typeof advancementTotals> {
  const t = advancementTotals(log);
  if (C().advancement.nuyenRefunds === 'off') return t;
  const back = (log ?? []).filter((l) => l && isRefund(l)).reduce((n, l) => n + num(l.nuyen), 0);
  return { ...t, nuyenSpent: Math.max(0, t.nuyenSpent - back) };
}

/**
 * Who a project (or training) is credited to: the player whose request the GM approved (and the GM as approver),
 * else whoever started it. `creditRequester` off = the user who clicked (the old way: the GM on an approval).
 */
export function projectCredit(o: { user: string; requester?: string | null; gm?: string | null }): { by: string; approvedBy: string } {
  if (C().advancement.creditRequester && o.requester) return { by: String(o.requester), approvedBy: String(o.gm ?? '') };
  return { by: String(o.user ?? ''), approvedBy: '' };
}

/** How finished training shows in the log: a "Done:" line, nothing, or the old raise line (credited to the GM's client). */
export function trainingDoneMode(): 'doneLine' | 'quiet' | 'old' {
  const m = C().advancement.trainingDone;
  return m === 'quiet' || m === 'old' ? m : 'doneLine';
}

// ---------------------------------------------------------------- O43: vehicle mod installs paid up front

export interface ModInstallPayment {
  /** What the mod costs (its own cost, else the table's). */
  cost: number;
  /** Paid now, when the work starts (else when it goes in, the old way). */
  upFront: boolean;
  /**
   * How Give up gives it back: 'project' (the installer paid: the project's own `paid.nuyen`), 'payer' (someone
   * else paid: an onCancel call refunds them), 'none' (not paid up front, or nothing to pay).
   */
  refund: 'project' | 'payer' | 'none';
}

/**
 * v0.73.0 (O43): how a mod install over time is paid. `waits`: the installer waits for vehicle work (a project);
 * without a project the mod goes in at once and is paid then, as before.
 */
export function modInstallPayment(o: { modCost: number; tableCost: number; payerUuid?: string | null; installerUuid: string; waits: boolean }): ModInstallPayment {
  const cost = Math.max(0, Math.round(num(o.modCost) > 0 ? num(o.modCost) : num(o.tableCost)));
  const upFront = Boolean(C().modInstall.payUpFront && o.waits && o.payerUuid && cost > 0);
  if (!upFront) return { cost, upFront: false, refund: 'none' };
  return { cost, upFront: true, refund: o.payerUuid === o.installerUuid ? 'project' : 'payer' };
}
