/**
 * v0.97.0 rules completeness, the Matrix's system operations: the Foundry glue for RULES.MXOPS_V97 (pure logic:
 * rules/mxops97.ts). documents/index.ts calls in from the system test (the new operations' targets and TN modifiers)
 * and its resolution (what the new operations do, Analyze Host an item per success, a passcode's days, "not here"),
 * from the slow and restore utilities, from an IC's attack (a decoy may draw it) and from a host's alert (an active
 * alert deletes the passcodes of the deckers on it); applications/sheets.ts adds the operation dialog's rows.
 *
 * Security: everything runs on the client of the actor that rolled (the decker, who owns themselves) or, for an IC's
 * attack and a host's alert, on the GM's; host changes go through the system test's `fu.hostChange` (applied by the
 * GM, judged by rules/trust.ts). Values a card or a dialog carries are cleaned (`cleanMx97`). Every value put into HTML
 * is escaped.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES } from '../rules/config.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { allActors } from '../helpers/actors.ts';
import { sysNow } from '../helpers/clock.ts';
import { successTest, type SuccessTestResult, type TargetNumberModifier } from '../rules/dice.ts';
import * as M from '../rules/mxops97.ts';
import { restorePlan } from '../rules/datawar.ts';
import { NO_DECK_DAMAGE, type DeckDamage } from '../rules/matrix.ts';

const G = (): any => (globalThis as any).game;
const warn = (text: string): void => { (globalThis as any).ui?.notifications?.warn?.(text); };
const name = (a: any): string => escHtml(String(a?.name ?? ''));
const cap = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const now = (): number => sysNow();
const P = (html: string): string => `<p>${html}</p>`;

/**
 * The flags this file keeps on a decker: the logs opened and the program that crippled them (conveniences only: a
 * player who edits them gains nothing but a second log file or a lower Restore TN than the IC's, which the card
 * shows). The decoys, passcodes and located icons are kept on the host (rules/mxops97.ts HOST_*).
 */
export const LOG_FLAG = 'logs97';
export const CRIPPLE_FLAG = 'crippledBy97';

/** Dice rolled with Foundry. */
function roller(sink: any[]): (count: number) => Promise<number[]> {
  return async (count: number) => {
    const roll = await new (globalThis as any).Roll(`${count}d6`).evaluate();
    sink.push(roll);
    return (roll.dice ?? []).flatMap((term: any) => term.results.map((r: any) => Number(r.result)));
  };
}
/** The sum of n six-sided dice. */
async function rollD6(n: number): Promise<number> {
  return (await roller([])(n)).reduce((a, b) => a + b, 0);
}
/** A host's records (its flags; the GM's document). */
const hostDecoys = (h: any) => M.decoysOf(flagOf(h, M.HOST_DECOYS));
const hostPasscodes = (h: any) => M.passcodesOf(flagOf(h, M.HOST_PASSCODES));
const hostLocated = (h: any) => M.locatedOf(flagOf(h, M.HOST_LOCATED));
const flagOf = (a: any, key: string): unknown => (typeof a?.getFlag === 'function' ? a.getFlag(SYSTEM_ID, key) : a?.flags?.[SYSTEM_ID]?.[key]);

// ================================================================ The operation dialog (applications/sheets.ts)

/** The labels of an item to learn, a passcode's level and a question (plain text). */
const itemLabel = (i: string): string => tKey(`SR2E.MxOps97.Item.${i}`);
const levelLabel = (l: string): string => tKey(`SR2E.MxOps97.Level.${l}`, { tn: M.passcodeLevelTn(l) });
const queryLabel = (k: string): string => tKey(`SR2E.MxOps97.Query.${k}`, { tn: Number((RULES.MXOPS_V97.queryTn as Record<string, number>)[k] ?? 0) });

export interface Mx97Choice { first?: string; level?: string; query?: string }

/** A choice from a dialog or a card, cleaned: only known values. */
export function cleanMx97(raw: any): Mx97Choice | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Mx97Choice = {};
  const items = [...M.analyzeHostItems(), ...M.SCAN_ITEMS];
  if (typeof raw.first === 'string' && items.includes(raw.first)) out.first = raw.first;
  if (typeof raw.level === 'string' && M.PASSCODE_LEVELS.includes(raw.level)) out.level = raw.level;
  if (typeof raw.query === 'string' && Object.hasOwn(RULES.MXOPS_V97.queryTn, raw.query)) out.query = raw.query;
  return Object.keys(out).length ? out : undefined;
}

/** The dialog's rows for the book's operations: what to learn first, the passcode's level, how a question is put. */
export function dialogRowsHtml(): string {
  if (!M.on('operations') && !M.on('analyzeHost') && !M.on('validatePasscode') && !M.on('interrogation')) return '';
  const opt = (v: string, label: string, sel = false) => `<option value="${escHtml(v)}"${sel ? ' selected' : ''}>${escHtml(label)}</option>`;
  const items = [...M.analyzeHostItems(), ...M.SCAN_ITEMS];
  const rows: string[] = [];
  if (M.on('analyzeHost') || M.on('operations')) {
    const firstOpts = opt('', tx('SR2E.MxOps97.Dialog.firstAny')) + items.map((i) => opt(i, itemLabel(i))).join('');
    rows.push(`<div class="form-group"><label>${tx('SR2E.MxOps97.Dialog.first')}</label><select name="mx97first">${firstOpts}</select></div>`);
  }
  if (M.on('validatePasscode')) {
    const levelOpts = M.PASSCODE_LEVELS.map((l) => opt(l, levelLabel(l))).join('');
    rows.push(`<div class="form-group"><label>${tx('SR2E.MxOps97.Dialog.level')}</label><select name="mx97level">${levelOpts}</select></div>`);
  }
  if (M.on('interrogation')) {
    const q = Object.keys(RULES.MXOPS_V97.queryTn);
    const queryOpts = q.map((k) => opt(k, queryLabel(k), k === 'plain')).join('');
    rows.push(`<div class="form-group"><label>${tx('SR2E.MxOps97.Dialog.query')}</label><select name="mx97query">${queryOpts}</select></div>`);
  }
  return rows.join('');
}

/** The dialog's choice (form elements), cleaned; undefined when the rows are not shown. */
export function readDialog(el: any): Mx97Choice | undefined {
  if (!el) return undefined;
  return cleanMx97({ first: el.mx97first?.value || undefined, level: el.mx97level?.value || undefined, query: el.mx97query?.value || undefined });
}

/** The TN modifiers the choice brings to an operation: the passcode's level (VR2 p. 118), the question (VR2 p. 110). */
export function extraMods(effect: string, c: Mx97Choice | undefined): TargetNumberModifier[] {
  const out: TargetNumberModifier[] = [];
  if (effect === 'validate' && c?.level) {
    const v = M.passcodeLevelTn(c.level);
    if (v) out.push({ id: 'passcodeLevel97', label: tx('SR2E.MxOps97.Mod.level', { level: levelLabel(c.level) }), value: v });
  }
  if (c?.query) {
    const v = M.queryTn(effect, c.query);
    if (v) out.push({ id: 'query97', label: tx('SR2E.MxOps97.Mod.query'), value: v });
  }
  return out;
}

/** The icons in a host a decker may scan or locate: other jacked-in deckers there, and its frames and agents. */
export function hostIcons(host: any, self: any, hostIc: readonly any[]): { deckers: any[]; frames: any[] } {
  if (!host) return { deckers: [], frames: [] };
  const deckers = allActors().filter((a: any) => a !== self && a?.uuid !== self?.uuid && a?.isJackedIn?.() && a.system?.matrix?.hostUuid === host.uuid);
  const frames = hostIc.filter((i: any) => ['frame', 'agent'].includes(i.system?.kind) && !i.system?.derived?.crashed);
  return { deckers, frames };
}

/**
 * The icons in the host the decker has located (VR2 p. 117: Scan Icon works on a decker, frame or SK "he has
 * located"; Locate Decker and Locate Frame, pp. 114–115, locate them), still there: from the host's record.
 */
export function locatedIcons(host: any, self: any, hostIc: readonly any[]): any[] {
  const { deckers, frames } = hostIcons(host, self, hostIc);
  const mine = M.locatedBy(hostLocated(host), String(self?.uuid ?? ''));
  return [...deckers, ...frames].filter((a: any) => mine.includes(a.uuid));
}

/** The dialog's target rows for Scan Icon: the icons the decker has located in the host (as targets, `ic:` like the IC rows). */
export function iconOptionsHtml(host: any, self: any, hostIc: readonly any[]): string {
  if (!M.on('operations') || !host) return '';
  const list = locatedIcons(host, self, hostIc);
  if (!list.length) return '';
  return `<optgroup label="${escHtml(tx('SR2E.MxOps97.Dialog.icons'))}">${list.map((a: any) => `<option value="ic:${escHtml(a.uuid)}">${name(a)}</option>`).join('')}</optgroup>`;
}

// ================================================================ The system test (documents/index.ts systemTest)

/**
 * Scan Icon's target and TN (VR2 p. 117): a decker, frame or agent in the host that the decker has located; TN = its Masking (a frame's or
 * agent's: its rating), + its loaded sleaze (the decker's scanner comes off as the operation's utility). Null (and a
 * warning) when the target is not one.
 */
export function scanTarget(host: any, self: any, hostIc: readonly any[], uuid: string | null | undefined): { uuid: string; tn: number; note: string; mods: TargetNumberModifier[] } | null {
  const t: any = locatedIcons(host, self, hostIc).find((a: any) => a.uuid === uuid);
  if (!t) { warn(tx('SR2E.MxOps97.Why.scanTarget')); return null; }
  const frame = t.type === 'ic';
  const masking = frame ? Number(t.system?.rating ?? 0) : Number(t.system?.derived?.matrix?.masking ?? 0);
  const sleaze = M.scanIconSleazeMod(Number(t.utilityRating?.(t.bestUtility?.('sleaze')) ?? t.bestUtility?.('sleaze')?.system?.rating ?? 0));
  return {
    uuid: t.uuid, tn: Math.max(RULES.MIN_TARGET_NUMBER, masking), note: tx('SR2E.MxOps97.Scan.tn', { name: String(t.name ?? ''), masking }),
    mods: sleaze ? [{ id: 'sleaze97', label: tx('SR2E.MxOps97.Mod.sleaze', { rating: sleaze }), value: sleaze }] : [],
  };
}

// ================================================================ The system test's outcome (documents/index.ts #resolveSystem)

/** Analyze Host (VR2 p. 111): the items one per net success; the host's code is known once its Security Rating is told. */
export async function analyzeHostBody(actor: any, host: any, items: readonly string[]): Promise<string> {
  if (!host) return '';
  if (items.includes('security')) await actor.learnHostKnowledge?.(host.uuid, 'analyzed');
  if (!items.length) return P(tx('SR2E.MxOps97.AnalyzeHost.nothing'));
  const parts = items.map((i) => i === 'security'
    ? `${tx('SR2E.MxOps97.Item.security')} <strong>${escHtml(cap(String(host.system?.securityCode ?? '')))}-${escHtml(host.system?.securityValue ?? '?')}</strong>`
    // VR2 p. 111's third item: whether the host is a virtual machine (no field: the GM answers).
    : i === 'vm' ? `${tx('SR2E.MxOps97.Item.vm')} <em>${tx('SR2E.MxOps97.AnalyzeHost.vmGm')}</em>`
    : `${escHtml(cap(i))} <strong>${escHtml(host.system?.subsystems?.[i] ?? '?')}</strong>`);
  const all = items.length >= M.analyzeHostItems().length;
  return P(`${name(host)}: ${parts.join(', ')}.${all ? '' : ` <em>${tx('SR2E.MxOps97.AnalyzeHost.more')}</em>`}`);
}

/**
 * Validate Passcode (VR2 p. 118): the passcode lasts 1D6 × net successes days. The record rides in the same host
 * change as the validated passcode (`fu.hostChange`, applied by the GM), so the two cannot part. Returns the card's
 * line ('' under 'v965').
 */
export async function passcodeDuration(actor: any, host: any, net: number, level: string | undefined, fu: any): Promise<string> {
  if (!M.on('validatePasscode') || !host) return '';
  const d6 = await rollD6(1);
  const days = M.passcodeDays(d6, net) ?? 0;
  const lv = level && M.PASSCODE_LEVELS.includes(level) ? level : 'user';
  if (fu?.hostChange?.change) fu.hostChange.change.passcode97 = { deckerUuid: String(actor.uuid), days, level: lv };
  return P(tx('SR2E.MxOps97.Passcode.days', { d6, net, days, level: levelLabel(lv) }));
}

/** Whether a decker's validated passcode on a host still works (VR2 p. 118), from the host's record. */
export function passcodeLiveFor(actor: any, host: any): boolean {
  return M.passcodeLive(hostPasscodes(host), String(actor?.uuid ?? ''), now());
}

/**
 * A host reaching an active alert deletes the passcodes of the deckers on it (VR2 p. 118): the host's validated list
 * loses them (the GM's client, which raises alerts). Returns the names taken off.
 */
export async function alertPasscodes(host: any, alert: string): Promise<string[]> {
  if (!M.alertKillsPasscodes(alert) || !host?.system) return [];
  const v: string[] = [...(host.system.validated ?? [])];
  const onIt = (u: string) => { const a: any = (globalThis as any).fromUuidSync?.(u); return a && a.system?.matrix?.jackedIn && a.system?.matrix?.hostUuid === host.uuid ? a : null; };
  const gone = v.filter((u) => onIt(u));
  if (!gone.length) return [];
  await host.update({ 'system.validated': v.filter((u) => !gone.includes(u)), [`flags.${SYSTEM_ID}.${M.HOST_PASSCODES}`]: hostPasscodes(host).filter((p) => !gone.includes(p.deckerUuid)) });
  const names = gone.map((u) => String(onIt(u)?.name ?? ''));
  await (globalThis as any).ChatMessage?.create?.({ content: P(tx('SR2E.MxOps97.Passcode.alert', { host: name(host), names: escHtml(names.join(', ')) })), whisper: [...(G()?.users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id) });
  return names;
}

/** "Not here" for Locate File (VR2 p. 110): the line, or ''. */
export function notThereLine(total: number, leftToFind: number): string {
  return M.notThere(total, leftToFind) ? P(`<strong>${tx('SR2E.MxOps97.NotThere.line', { total })}</strong>`) : '';
}

export interface Resolve97 { effect: string; host: any; net: number; by: string; sy: any; fu: any; hostIc: readonly any[] }

/** What the book's new operations do (VR2 pp. 111–117); '' for any other effect (the old `default`). */
export async function resolveOp97(actor: any, o: Resolve97): Promise<string> {
  const { host, net, by, sy, fu } = o;
  if (!o.effect.endsWith('97') || !host) return '';
  const sub = String(sy?.subsystem ?? '').toLowerCase();
  switch (o.effect) {
    case 'analyzeSubsystem97': {
      // Its defenses (VR2 p. 111): the IC that guard it, its data bombs (now found by the decker).
      const guards = o.hostIc.filter((i: any) => i.system?.guards === sub && !i.system?.derived?.crashed && !['frame', 'agent'].includes(i.system?.kind));
      const bombs = (host.system?.bombs ?? []).filter((b: any) => b.subsystem === sub && Number(b.rating) > 0);
      if (bombs.length) fu.hostChange = { host, change: { bombFound: { deckerUuid: actor.uuid as string, subsystem: sub } }, label: tx('SR2E.MxOps97.Subsystem.bombLabel', { by, sub: cap(sub) }) };
      const found = [
        ...guards.map((i: any) => `<strong>${name(i)}</strong> (${escHtml(i.system?.rating ?? '?')})`),
        ...bombs.map((b: any) => `<strong>${tx('SR2E.MxOps97.Subsystem.bomb', { rating: Number(b.rating) })}</strong>${b.pavlov ? ` ${tx('SR2E.MxOps97.Subsystem.pavlov')}` : ''}`),
      ];
      return P(found.length ? tx('SR2E.MxOps97.Subsystem.found', { sub: escHtml(cap(sub)), list: found.join(', ') }) : tx('SR2E.MxOps97.Subsystem.clean', { sub: escHtml(cap(sub)) }));
    }
    case 'crashApplication97':
      return P(tx('SR2E.MxOps97.CrashApp.done', { by: escHtml(by), sub: escHtml(cap(sub)) }));
    case 'disinfect97':
      return P(tx('SR2E.MxOps97.Disinfect.done', { by: escHtml(by), sub: escHtml(cap(sub)) }));
    case 'retrain97':
      return P(tx('SR2E.MxOps97.Retrain.done', { by: escHtml(by) }));
    case 'decoy97': {
      // The decoy (VR2 p. 112): its successes, an empty monitor; on the decker (a frame's decoy is the GM's to run).
      // On the host (the GM's): through the host change, judged and applied by the GM.
      if (sy?.frameUuid) return P(tx('SR2E.MxOps97.Decoy.frame'));
      fu.hostChange = { host, change: { decoy97: { deckerUuid: String(actor.uuid), successes: Math.min(M.DECOY_MAX, Math.max(0, Math.floor(net))) } }, label: tx('SR2E.MxOps97.Decoy.label', { by }) };
      return P(tx('SR2E.MxOps97.Decoy.made', { name: name(actor), n: Math.max(0, Math.floor(net)) }));
    }
    case 'dumpLog97': {
      // The access log (VR2 p. 113): the GM answers the decker's questions; the 24-hour log is a file they may download.
      const seen: string[] = Array.isArray(flagOf(actor, LOG_FLAG)) ? (flagOf(actor, LOG_FLAG) as string[]).filter((x) => typeof x === 'string') : [];
      let file = '';
      if (!seen.includes(host.uuid)) {
        const size = M.logSize(Number(host.system?.securityValue ?? 0), await rollD6(2));
        fu.hostChange = { host, change: { addFile: { name: tx('SR2E.MxOps97.DumpLog.fileName'), size: Math.min(100_000, size), value: 0, paydata: false, uploadedBy: '', foundBy: [actor.uuid as string] } }, label: tx('SR2E.MxOps97.DumpLog.label', { by }) };
        await actor.setFlag?.(SYSTEM_ID, LOG_FLAG, [...seen, host.uuid].slice(-50));
        file = ` ${tx('SR2E.MxOps97.DumpLog.file', { size: Math.min(100_000, size) })}`;
      }
      return P(`${tx('SR2E.MxOps97.DumpLog.open', { name: name(actor), host: name(host) })}${file}`);
    }
    case 'locateFrame97': {
      const frames = o.hostIc.filter((i: any) => ((i.system?.kind === 'frame' && i.system?.smart) || i.system?.kind === 'agent') && !i.system?.derived?.crashed);
      if (frames.length) fu.hostChange = { host, change: { located97: { deckerUuid: String(actor.uuid), uuids: frames.map((f: any) => String(f.uuid)) } }, label: tx('SR2E.MxOps97.Locate.label', { by }) };
      return P(frames.length ? tx('SR2E.MxOps97.Locate.frames', { list: frames.map((f: any) => `<strong>${name(f)}</strong>`).join(', ') }) : tx('SR2E.MxOps97.Locate.noFrames'));
    }
    case 'locateIc97': {
      const ics = o.hostIc.filter((i: any) => !['frame', 'agent'].includes(i.system?.kind) && !i.system?.derived?.crashed);
      return P(ics.length ? tx('SR2E.MxOps97.Locate.ic', { list: ics.map((i: any) => `<strong>${name(i)}</strong>`).join(', ') }) : tx('SR2E.MxOps97.Locate.noIc'));
    }
    case 'locateDecker97': {
      // Then a Sensor Test (VR2 p. 114): the deckers whose Masking + sleaze is at most its successes.
      const sensors = Math.max(0, Math.floor(Number(actor.system?.derived?.matrix?.sensors ?? 0)));
      const r: SuccessTestResult = await successTest({ dice: sensors, targetNumber: Math.max(RULES.MIN_TARGET_NUMBER, Number(RULES.MXOPS_V97.locateDeckerTn) || 4), modifiers: [], roll: roller([]) });
      const { deckers } = hostIcons(host, actor, o.hostIc);
      const found = deckers.filter((d: any) => M.deckerLocated(r.successes, Number(d.system?.derived?.matrix?.masking ?? 0), Number(d.utilityRating?.(d.bestUtility?.('sleaze')) ?? 0)));
      if (found.length) fu.hostChange = { host, change: { located97: { deckerUuid: String(actor.uuid), uuids: found.map((x: any) => String(x.uuid)) } }, label: tx('SR2E.MxOps97.Locate.label', { by }) };
      const head = tx('SR2E.MxOps97.Locate.sensor', { dice: sensors, tn: r.targetNumber, successes: r.successes });
      return P(`${head} ${found.length ? tx('SR2E.MxOps97.Locate.deckers', { list: found.map((d: any) => `<strong>${name(d)}</strong>`).join(', ') }) : tx('SR2E.MxOps97.Locate.noDeckers')}`);
    }
    case 'scanIcon97': {
      // Re-checked now (VR2 p. 117): still in the host and located by the decker, not only when it was rolled.
      const t: any = locatedIcons(host, actor, o.hostIc).find((a: any) => a.uuid === sy?.targetUuid) ?? null;
      if (!t) return P(tx('SR2E.MxOps97.Scan.gone'));
      const items = M.scanIconReveal(net, sy?.mx97?.first);
      const frame = t.type === 'ic';
      const m = t.system?.derived?.matrix ?? {};
      const val = (i: string) => (frame ? (i === 'responseIncrease' ? 0 : t.system?.rating) : i === 'responseIncrease' ? (m.responseIncrease ?? t.activeDeck?.()?.system?.responseIncrease ?? 0) : m[i]);
      const parts = items.map((i) => `${escHtml(itemLabel(i))} <strong>${escHtml(val(i) ?? '?')}</strong>`);
      return P(parts.length ? `${name(t)}: ${parts.join(', ')}.` : tx('SR2E.MxOps97.Scan.nothing'));
    }
    default:
      return '';
  }
}

// ================================================================ A decoy draws an IC's attack (documents/index.ts icAttack)

/**
 * Before a proactive IC attacks a decker (not trace IC): 1D6 against the decoy's successes (VR2 p. 112); on a draw the
 * attack goes to the decoy at full damage (no resistance), and the decoy is gone once its monitor is full. Returns
 * true when the decoy took it (the attack on the decker does not happen).
 */
export async function decoyIntercept(ic: any, target: any, host: any, level: string): Promise<boolean> {
  if (!M.on('operations') || !host?.uuid || !target?.uuid) return false;
  // From the host's record only (never the decker's own actor), and only while the decker is on that host.
  if (!target.system?.matrix?.jackedIn || target.system?.matrix?.hostUuid !== host.uuid) return false;
  const list = hostDecoys(host);
  const d = M.decoyFor(list, String(target.uuid));
  if (!d) return false;
  const d6 = await rollD6(1);
  if (!M.decoyDraws(d6, d.successes)) {
    await (globalThis as any).ChatMessage?.create?.({ content: P(tx('SR2E.MxOps97.Decoy.missed', { ic: name(ic), name: name(target), d6, n: d.successes })) });
    return false;
  }
  const hit = M.decoyHit(d, level);
  const next = list.filter((x) => x.deckerUuid !== d.deckerUuid).concat(hit.gone ? [] : [hit.decoy]);
  try { await host.update({ [`flags.${SYSTEM_ID}.${M.HOST_DECOYS}`]: next }); } catch (err) { console.warn('sr2e | decoy', err); }
  await (globalThis as any).ChatMessage?.create?.({ content: P(`${tx('SR2E.MxOps97.Decoy.drawn', { ic: name(ic), name: name(target), d6, n: d.successes, level: escHtml(level), boxes: hit.decoy.boxes, max: Number(RULES.MXOPS_V97.decoyBoxes) || 10 })}${hit.gone ? ` <strong>${tx('SR2E.MxOps97.Decoy.gone')}</strong>` : ''}`) });
  return true;
}

// ================================================================ The host change (documents/index.ts #cleanHostChange, applyHostChange)

const str400 = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 400) : '');
const int = (v: unknown, lo: number, hi: number): number => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };

/** The book's keys of a host change, cleaned (the rest of the change is cleaned by documents/index.ts). */
export function cleanHostChange97(c: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (c?.decoy97 && typeof c.decoy97 === 'object' && str400(c.decoy97.deckerUuid)) out['decoy97'] = { deckerUuid: str400(c.decoy97.deckerUuid), successes: int(c.decoy97.successes, 0, M.DECOY_MAX) };
  if (c?.passcode97 && typeof c.passcode97 === 'object' && str400(c.passcode97.deckerUuid)) {
    out['passcode97'] = { deckerUuid: str400(c.passcode97.deckerUuid), days: int(c.passcode97.days, 0, M.PASSCODE_MAX_DAYS), level: M.PASSCODE_LEVELS.includes(c.passcode97.level) ? c.passcode97.level : 'user' };
  }
  if (c?.located97 && typeof c.located97 === 'object' && str400(c.located97.deckerUuid) && Array.isArray(c.located97.uuids)) {
    out['located97'] = { deckerUuid: str400(c.located97.deckerUuid), uuids: c.located97.uuids.map(str400).filter(Boolean).slice(0, 50) };
  }
  return out;
}

/**
 * Apply the book's keys of a host change into the host's one update (`extra`), on the GM's client: a decoy, a passcode
 * record (only with a validated passcode in the same change, from the GM's clock), located icons. Notes for the card.
 */
export function applyHostChange97(host: any, c: any, extra: Record<string, unknown>, notes: string[]): void {
  if (c.decoy97) {
    extra[`flags.${SYSTEM_ID}.${M.HOST_DECOYS}`] = M.withDecoy(hostDecoys(host), c.decoy97.deckerUuid, c.decoy97.successes);
    notes.push(tx('SR2E.MxOps97.Decoy.note', { n: c.decoy97.successes }));
  }
  if (c.passcode97 && c.validate === c.passcode97.deckerUuid) {
    extra[`flags.${SYSTEM_ID}.${M.HOST_PASSCODES}`] = M.withPasscode(hostPasscodes(host), c.passcode97.deckerUuid, c.passcode97.days, c.passcode97.level, now());
    notes.push(tx('SR2E.MxOps97.Passcode.note', { days: c.passcode97.days }));
  }
  if (c.located97) {
    extra[`flags.${SYSTEM_ID}.${M.HOST_LOCATED}`] = M.withLocated(hostLocated(host), c.located97.deckerUuid, c.located97.uuids);
    notes.push(tx('SR2E.MxOps97.Locate.note', { n: c.located97.uuids.length }));
  }
}

// ================================================================ Every client's actor updates (registerMxOps97; the lead GM acts)

/**
 * The lead GM's upkeep after any actor change: a host that has gone to an active alert (by any path: a test, a site,
 * the GM's hand) deletes the passcodes of the deckers on it (VR2 p. 118); a decker who jacks out or leaves a host
 * loses their decoy there and their located icons, and nobody keeps them located (VR2 pp. 112, 114).
 */
export async function onActorUpdate97(actor: any, change: any, leadGm: boolean): Promise<void> {
  if (!leadGm || !actor || !change) return;
  const alert = change.system?.alert;
  if (actor.type === 'host' && typeof alert === 'string') await alertPasscodes(actor, alert);
  const mx = change.system?.matrix;
  if (!mx || typeof mx !== 'object' || !('hostUuid' in mx || 'jackedIn' in mx)) return;
  const here = actor.system?.matrix?.jackedIn ? String(actor.system?.matrix?.hostUuid ?? '') : '';
  const uuid = String(actor.uuid ?? '');
  for (const h of allActors().filter((a: any) => a?.type === 'host' && a.uuid !== here)) {
    const decoys = hostDecoys(h);
    const located = hostLocated(h);
    const up: Record<string, unknown> = {};
    if (decoys.some((d) => d.deckerUuid === uuid)) up[`flags.${SYSTEM_ID}.${M.HOST_DECOYS}`] = decoys.filter((d) => d.deckerUuid !== uuid);
    if (located.some((l) => l.deckerUuid === uuid || l.uuids.includes(uuid))) up[`flags.${SYSTEM_ID}.${M.HOST_LOCATED}`] = M.locatedWithout(located, uuid);
    if (Object.keys(up).length) { try { await h.update(up); } catch (err) { console.warn('sr2e | leaving a host', err); } }
  }
}

/** Registers the upkeep (sr2e-system.ts). */
export function registerMxOps97(isLead: () => boolean): void {
  (globalThis as any).Hooks?.on?.('updateActor', (actor: any, change: any) => { void onActorUpdate97(actor, change, isLead()).catch((err) => console.warn('sr2e | system operations upkeep', err)); });
}

// ================================================================ Slow and restore (documents/index.ts useUtility)

/**
 * Slow (VR2 p. 99): whether it can hit this IC (a language key), and the IC's Resistance Test (the host's Security
 * Value vs the Slow rating), rolled now. Null under 'v965'.
 */
export async function slowResistance(ic: any, decker: any, rating: number): Promise<{ why: string } | { resistance: number; dice: number; tn: number } | null> {
  if (!M.on('slow')) return null;
  const trace = decker?.system?.matrix?.trace;
  const why = M.slowRefusal({ behavior: String(ic?.system?.behavior ?? ''), traceLocked: Boolean(trace?.active && trace.icUuid === ic?.uuid) });
  if (why) return { why };
  const host: any = ic?.system?.hostUuid ? (globalThis as any).fromUuidSync?.(ic.system.hostUuid) : null;
  const sv = Number(host?.system?.securityValue ?? 0) > 0 ? Number(host.system.securityValue) : Number(ic?.system?.rating ?? 0);
  const tn = Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(rating));
  const r = await successTest({ dice: Math.max(0, Math.floor(sv)), targetNumber: tn, modifiers: [], roll: roller([]) });
  return { resistance: r.successes, dice: Math.max(0, Math.floor(sv)), tn };
}

/** The line a slowed IC's card adds (VR2 p. 99): actions lost; it hangs once its Initiative is gone. */
export function slowLine(e: { net: number; actions: number; initiative: number }, resistance: number, initiativeAfter: number | null): string {
  if (!e.actions) return tx('SR2E.MxOps97.Slow.none', { net: e.net, resistance });
  return `${tx('SR2E.MxOps97.Slow.actions', { actions: e.actions, initiative: e.initiative, net: e.net, resistance })}${initiativeAfter != null && initiativeAfter <= 0 ? ` <strong>${tx('SR2E.MxOps97.Slow.hangs')}</strong>` : ''}`;
}

/** A slowed IC's card (VR2 p. 99): `note` is HTML already (a GM's by-hand note); `done` the Initiative taken before. */
export function slowCard(e: { net: number; actions: number; initiative: number }, resistance: number, initiativeAfter: number | null, o: { note: string; done: number; target: string }): string {
  const who = o.target ? escHtml(o.target) : tx('SR2E.Card.Actor.theIc');
  const head = e.actions ? '<strong>' + tx('SR2E.Card.Actor.isSlowed', { targetName: who }) + '</strong> ' : '';
  const back = !e.actions && o.done ? ' <em>' + tx('SR2E.Card.Actor.theEarlierIsTakenBack', { done: o.done }) + '</em>' : '';
  return P(head + slowLine(e, resistance, initiativeAfter) + o.note + back);
}

/** Remember the highest-rated crippler that damaged a decker's icon (for Restore's TN, VR2 p. 100). */
export async function noteCrippler(target: any, before: Record<string, number> | null | undefined, rating: number): Promise<void> {
  if (!M.on('restore') || !target?.setFlag) return;
  const prev = Number(flagOf(target, CRIPPLE_FLAG) ?? 0) || 0;
  try { await target.setFlag(SYSTEM_ID, CRIPPLE_FLAG, M.crippledBy(before, prev, rating)); } catch (err) { console.warn('sr2e | crippler rating', err); }
}

/** Restore's TN for a decker (VR2 p. 100): the crippler remembered, else the host's best crippler, else the old TN. */
export function restoreTnFor(actor: any, hostIc: readonly any[]): number {
  const known = Number(flagOf(actor, CRIPPLE_FLAG) ?? 0) || 0;
  const ratings = known > 0 ? [known] : hostIc.filter((i: any) => i.system?.behavior === 'crippler').map((i: any) => Number(i.system?.rating ?? 0));
  return M.restoreTn(ratings, RULES.MATRIX_V57.utilities.restore.tn);
}

/**
 * Restore's plan (VR2 p. 100): a point per 2 successes on the icon's crippled ratings, never the deck's damage (the
 * permanent damage of gray and black IC), whatever RULES.MATRIX_V57.utilities.restore.deckDamage says.
 */
export function restoreBookPlan(crippled: DeckDamage, deck: DeckDamage, successes: number): { crippled: DeckDamage; deckDamage: DeckDamage; restored: number } {
  const p = restorePlan(crippled, { ...NO_DECK_DAMAGE }, M.restorePoints(successes));
  return { crippled: p.crippled, deckDamage: { ...NO_DECK_DAMAGE, ...deck }, restored: p.restored };
}

/** The utility dialog's hint under the book (null: the old hint). */
export function utilityHint(kind: string): string | null {
  if (kind === 'slow' && M.on('slow')) return tx('SR2E.MxOps97.Slow.hint', { per: Number(RULES.MXOPS_V97.slowPerAction) || 10 });
  if (kind === 'restore' && M.on('restore')) return tx('SR2E.MxOps97.Restore.hint');
  return null;
}
