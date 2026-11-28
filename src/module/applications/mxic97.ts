/**
 * v0.97.0 rules completeness, the Matrix: IC and cybercombat. The Foundry glue for RULES.MXIC_V97 (pure logic:
 * rules/mxic97.ts): suppressing IC and data bombs (the choice card, the Detection Factor, releasing), black IC's last
 * shot at the MPCP and the data wipe, improvised attacks, the book's parry, position and evade, the Ripper and Tar Pit
 * Tests, the tar baby's opposed test, scramble's Poison Test, a data bomb going off on a botched defuse, and the reality
 * filter's card line.
 *
 * Security: a card button reads its flags only as bounded numbers and uuids. The choice card's Suppress is the decker's
 * (an owner or a GM) and checks the IC is really crashed; anything that adds to a host's tally goes through the GM (the
 * applyTally card and its own checks, or a GM's click with gmMay). A player's client writes only the decker's own
 * flags; IC write their own (the GM's client runs IC). Every value put into HTML is escaped.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES, type DamageLevel } from '../rules/config.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';
import { clearFlagUpdate } from '../helpers/flags.ts';
import { successTest, type SuccessTestResult, type TargetNumberModifier } from '../rules/dice.ts';
import { deckerTallyOf, parryPenalty, positionBonus, activeManeuvers, type Maneuver } from '../rules/datawar.ts';
import { combatStamp } from '../rules/util.ts';
import * as X from '../rules/mxic97.ts';
import * as M923 from '../rules/matrix923.ts';
import { authorIsGm, authorOwns } from './trust.ts';
import { allActors } from '../helpers/actors.ts';
import type { SR2Actor as SR2ActorType } from '../documents/index.ts';

const G = (): any => (globalThis as any).game;
const isGm = (): boolean => Boolean(G()?.user?.isGM);
const warn = (text: string): void => { (globalThis as any).ui?.notifications?.warn?.(text); };
const post = (content: string, extra: Record<string, unknown> = {}): Promise<any> => (globalThis as any).ChatMessage.create({ content, ...extra });
const speaker = (actor: any): any => { try { return (globalThis as any).ChatMessage.getSpeaker({ actor }); } catch { return {}; } };
const name = (a: any): string => escHtml(String(a?.name ?? ''));
const int = (v: unknown, min: number, max: number, d = min): number => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
const uuidOk = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 400;
const sync = (uuid: unknown): any => { try { return uuidOk(uuid) ? (globalThis as any).fromUuidSync?.(uuid) ?? null : null; } catch { return null; } };
const actorClass = (): any => (globalThis as any).CONFIG?.Actor?.documentClass;
const users = (): any[] => [...(G()?.users ?? [])];
const gmIds = (): string[] => users().filter((u: any) => u.isGM).map((u: any) => u.id);
const ownerIds = (a: any): string[] => users().filter((u: any) => !u.isGM && a?.testUserPermission?.(u, 'OWNER')).map((u: any) => u.id);
const flag = (a: any, k: string): unknown => (typeof a?.getFlag === 'function' ? a.getFlag(SYSTEM_ID, k) : a?.flags?.[SYSTEM_ID]?.[k]);
const newId = (): string => (globalThis as any).foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2, 12);
const now = (): { round: number | null; worldTime: number; combatId: string | null } => actorClass()?.matrixNow?.() ?? { round: null, worldTime: 0, combatId: null };

/** The flags this file keeps on a decker. */
export const MX_FLAG = 'mx97';
export const USED_FLAG = 'mxUsed97';
export const IMPROVISED_FLAG = 'improvised97';
export const RUN_FLAG = 'runFiles97';
/**
 * The decker's visit stamp: a new one on jacking in and (v0.97.1) on each host entered, so what the host recorded for
 * them (suppressed IC, maneuvers) counts only while they stay in that host (VR2 p. 40). The decker can write it, but a
 * changed stamp only ends their own entries early; a kept one is undone by the GM side dropping a leaver's entries.
 */
export const RUN_STAMP = 'run97';
const runOf = (decker: any): string => String(flag(decker, RUN_STAMP) ?? '');
/** Whether the decker is jacked in to this host now. */
const isIn = (decker: any, hostUuid: string): boolean => Boolean(decker?.system?.matrix?.jackedIn) && Boolean(hostUuid) && String(decker?.system?.matrix?.hostUuid ?? '') === hostUuid;
/** The program id of an improvised attack (a one-shot program that is not an item). */
export const IMPROVISED_ID = 'improvised97';

/** Dice rolled with Foundry (shown by Dice So Nice through the card's rolls). */
function roller(sink: any[]): (count: number) => Promise<number[]> {
  return async (count: number) => {
    const roll = await new (globalThis as any).Roll(`${count}d6`).evaluate();
    sink.push(roll);
    return (roll.dice ?? []).flatMap((term: any) => term.results.map((r: any) => Number(r.result)));
  };
}
const diceText = (r: SuccessTestResult): string => r.dice.map((d) => Number(d.total)).join(', ');

/** A test rolled here. */
async function rollTest(dice: number, tn: number): Promise<{ r: SuccessTestResult; rolls: any[] }> {
  const rolls: any[] = [];
  const r = await successTest({ dice: Math.max(0, dice), targetNumber: tn, roll: roller(rolls) });
  return { r, rolls };
}
/** A rolled test's card line ("label: dice (n successes)"); `label` is the caller's translated, escaped text. */
function rollHtml(label: string, r: SuccessTestResult): string {
  return `<p>${label}: ${tx('SR2E.MxIc97.roll', { dice: escHtml(diceText(r) || '-'), successes: r.successes })}</p>`;
}

// ================================================================ The GM side's host record (VR2 pp. 40–41, 121–122)

/** The host's own record of parries, evades and suppressed IC (rules/mxic97.ts hostMx): GM-owned, written only by applyMx97. */
export const HOST_FLAG = 'mxic97';
const hostRec = (host: any): X.HostMx => X.hostMx(flag(host, HOST_FLAG));
const cls = (): typeof SR2ActorType | undefined => actorClass() as typeof SR2ActorType | undefined;
const inHost = (uuid: string, host: any): boolean => { const a = sync(uuid); return Boolean(a?.system?.matrix?.jackedIn) && String(a?.system?.matrix?.hostUuid ?? '') === String(host?.uuid ?? ''); };
/** Write the host's record; entries of deckers no longer in this host go (suppression lasts while they stay in the system). */
async function saveRec(host: any, r: X.HostMx): Promise<void> {
  const keep = <T extends { decker: string }>(l: T[]) => l.filter((e) => inHost(e.decker, host)).slice(-X.LIST_CAP * 4);
  await host.update({ [`flags.${SYSTEM_ID}.${HOST_FLAG}`]: { parry: keep(r.parry), evade: keep(r.evade), suppressed: keep(r.suppressed), exposed: keep(r.exposed), pos: keep(r.pos), improvised: keep(r.improvised), offered: r.offered.slice(-X.LIST_CAP * 4), seen: r.seen } });
}

/** Ask the GM side to record something (a host change: at once on a GM's client, else the GM's Apply card). */
async function request(host: any, decker: any, m: X.Mx97Change, label: string): Promise<void> {
  await cls()?.changeHost(host, { mx97: m } as any, label, String(decker?.uuid ?? ''));
}

/** The decker's Detection Factor with the IC they suppress in this host taken off (VR2 p. 40), from the host's record. */
export function liveDf(decker: any, df: number): number {
  // v0.97.1: only while jacked in to that host, and only this visit's (runOf: a new stamp on each host entered).
  if (!decker?.system?.matrix?.jackedIn) return df;
  return X.suppressedDf(df, flag(sync(decker?.system?.matrix?.hostUuid), HOST_FLAG), String(decker?.uuid ?? ''), runOf(decker));
}

/** The card line of a tally change: a crash or bomb counted, or a suppressed IC released (`name`). */
function tallyLabel(name0: string, decker: any, points: number): string {
  return name0 ? tx('SR2E.MxIc97.Suppress.releasedLine', { decker: name(decker), name: escHtml(name0), points }) : tx('SR2E.MxIc97.Suppress.countLine', { decker: name(decker), points });
}

/** GM side: put `points` on the decker's tally in `host` now (the tally's own card follows). */
async function tallyNowGm(host: any, decker: any, points: number, label: string): Promise<void> {
  const pts = int(points, 0, 30, 0);
  const c = cls();
  if (!host || !decker || pts <= 0 || !c) return;
  const who = decker.tallyFor?.() ?? { key: String(decker.uuid), name: String(decker.name ?? '') };
  const html = await c.applyTallyCard(host.uuid, pts, who, String(decker.uuid));
  await post(`<p><em>${tx('SR2E.MxIc97.gmOnly')}</em> ${tallyLabel(label, decker, pts)}</p>${html ?? ''}`, { speaker: { alias: String(host.name ?? '') }, whisper: gmIds() });
}

/** GM side: the choice card (VR2 pp. 40–41): its points on the tally, or suppress it. Whispered to the GMs and the decker's owners. */
async function choiceCardGm(host: any, decker: any, id: string, label: string, points: number, bomb: boolean, where = ''): Promise<void> {
  const c = { id: String(id).slice(0, 400), name: String(label ?? '').slice(0, 120), points: int(points, 0, 30, 0), ...(bomb ? { where: String(where ?? '').slice(0, 120) } : {}) };
  await post(choiceHtml(decker, c, false), {
    speaker: { alias: String(host?.name ?? '') }, whisper: [...new Set([...gmIds(), ...ownerIds(decker)])],
    flags: { [SYSTEM_ID]: { mxic97Choice: { deckerUuid: String(decker.uuid), hostUuid: String(host.uuid), ...c } } },
  });
}

/** The choice card's HTML (v0.97.1: its buttons disabled once answered; a bomb's line names where it went off). */
function choiceHtml(decker: any, c: { id?: unknown; name?: unknown; points?: unknown; where?: unknown }, done: boolean): string {
  const pts = int(c.points, 0, 30, 0);
  const label = String(c.name ?? '').slice(0, 120);
  const line = String(c.id ?? '').startsWith('bomb:')
    ? tx('SR2E.MxIc97.Bomb.choice', { where: escHtml(String(c.where ?? '').slice(0, 120) || label), decker: name(decker), points: pts })
    : tx('SR2E.MxIc97.Suppress.crashed', { ic: escHtml(label), decker: name(decker), points: pts });
  const off = done ? ' disabled' : '';
  return `<p>${line}</p><p><button type="button" data-sr2e-action="mxic97Count"${off}>${tx('SR2E.MxIc97.Suppress.count', { points: pts })}</button> <button type="button" data-sr2e-action="mxic97Suppress"${off}>${tx('SR2E.MxIc97.Suppress.suppress')}</button></p>`;
}

/**
 * IC crashed by a decker (VR2 p. 40), from documents/index.ts's crash tally: under 'book' the GM side posts the choice
 * card in place of the tally (true); a frame's or agent's crash keeps the tally (false).
 */
export async function crashChoice(host: any, decker: any, ic: any, _points: number, frame: any): Promise<boolean> {
  // Only the GM side offers it (the IC's own resistance test, on the GM's client): never a request from a card.
  if (!X.on('suppress') || frame || !decker || host?.type !== 'host' || !isGm()) return false;
  // Refused (offered before: a relaunched IC crashing again): the plain tally, as 'v965'.
  return offerCrash(host, decker, ic);
}

/** GM side: the crash choice for an IC that really crashed in this host, once per IC (the host notes it). */
export async function offerCrash(host: any, decker: any, ic: any): Promise<boolean> {
  if (!isGm() || !(ic?.type === 'ic' && ic.system?.derived?.crashed && ic.system?.hostUuid === host?.uuid)) return false;
  const rec = hostRec(host);
  if (rec.offered.includes(String(ic.uuid))) return false;
  const points = M923.crashTallyPoints(Number(ic.system?.rating ?? 0)) + (decker.tracedIn?.(host) ? 1 : 0);
  await saveRec(host, { ...rec, offered: [...rec.offered, String(ic.uuid)] });
  if (points > 0) await choiceCardGm(host, decker, String(ic.uuid), String(ic.name ?? ''), points, false);
  return true;
}

/** A data bomb going off on a decker (VR2 p. 41): the request #bombCheck adds to its host change (null under 'v965'). */
export function bombRequest(decker: any, where: { fileId?: string; subsystem?: string }): X.Mx97Change | null {
  if (!X.on('dataBomb') || !decker) return null;
  const id = where.fileId ? `f:${where.fileId}` : `s:${String(where.subsystem ?? '')}`;
  return { op: 'bomb', deckerUuid: String(decker.uuid), id };
}

/**
 * GM side, before a host change applies: what it reads from the host before the change alters it (a bomb's rating). A
 * bomb request counts only beside the `bombOff` of the same change (the blast itself), never on its own.
 */
export function preMx97(host: any, raw: unknown, bombOff?: { fileId?: string; subsystem?: string } | null): { rating: number; where: string } {
  const m = X.cleanMx97(raw);
  if (m?.op !== 'bomb' || !m.id || !X.bombMatches(m.id, bombOff)) return { rating: 0, where: '' };
  if (m.id.startsWith('f:')) {
    const f: any = (host?.system?.files ?? []).find((x: any) => x?.id === m.id!.slice(2));
    return { rating: int(f?.bomb, 0, 30, 0), where: String(f?.name ?? '') };
  }
  const sub = m.id.slice(2);
  const b: any = (host?.system?.bombs ?? []).find((x: any) => x?.subsystem === sub && Number(x?.rating) > 0);
  return { rating: int(b?.rating, 0, 30, 0), where: sub };
}

/** v0.97.1: the choice card answered: its flag, and its buttons drawn disabled (the GM side posted it, so it may edit it). */
async function choiceDone(card: any, decker: any, choice: any): Promise<void> {
  if (typeof card?.update === 'function') await card.update({ content: choiceHtml(decker, choice, true), [`flags.${SYSTEM_ID}.mxic97Done`]: true });
  else await card.setFlag(SYSTEM_ID, 'mxic97Done', true);
}

/** The dice faces a card's rolls show, in the order they were rolled. */
const cardFaces = (card: any): number[] => (Array.isArray(card?.rolls) ? card.rolls : [])
  .flatMap((r: any) => (r?.dice ?? []).flatMap((term: any) => (term?.results ?? []).map((x: any) => int(x?.result, 1, 6, 1)))).slice(0, 400);

/**
 * GM side (v0.97.1, VR2 p. 123): an improvised attack from its test's card. Only the decker's owner's (or a GM's) card
 * of this decker, once; the points must be there to give and the Power at most the MPCP; the Damage Level is the GM
 * side's own count of the card's dice (the Computer Test vs the Power). The GM side takes the points off the persona and
 * records what it took (only that is ever given back), so nothing the decker writes on their own actor makes an attack.
 */
async function improviseGm(host: any, decker: any, rec0: X.HostMx, card: any, run: string): Promise<string[]> {
  if (!X.on('improvised') || !card || !isIn(decker, String(host.uuid))) return [];
  if (!(authorIsGm(card) || authorOwns(card, decker))) return [];
  const f: any = card.flags?.[SYSTEM_ID]?.mxic97Improvise;
  const id = String(card.id ?? '').slice(0, 60);
  if (!f || f.deckerUuid !== decker.uuid || !id || rec0.seen.some((x) => x.k === `improvise|${id}`)) return [];
  // An earlier one not used yet gives its points back first.
  const old = rec0.improvised.find((x) => x.decker === decker.uuid);
  if (old) await unimproviseGm(host, decker, rec0, old.id);
  const rec = hostRec(host);
  const mm = decker.system?.derived?.matrix ?? {};
  const e = int(f.evasion, 0, 30, 0), b = int(f.bod, 0, 30, 0);
  const plan = X.improvisedPlan({ evasion: Number(mm.evasion ?? 0), bod: Number(mm.bod ?? 0), fromEvasion: e, fromBod: b, mpcp: Number(mm.mpcp ?? 0) });
  if (plan.why) return [];
  const computer = Number(decker.findSkill?.(RULES.MATRIX.skill)?.system?.rating ?? 0);
  const faces = cardFaces(card);
  let at = 0;
  let successes = 0;
  try {
    const r = await successTest({ dice: Math.max(0, computer), targetNumber: plan.tn, roll: async (count: number) => { const out = faces.slice(at, at + count); at += count; if (out.length < count) throw new Error('short'); return out; } });
    successes = r.successes;
  } catch { return []; }
  const level = X.improvisedLevel(successes) ?? '';
  const c = { bod: 0, evasion: 0, masking: 0, sensors: 0, ...(decker.system?.matrix?.crippled ?? {}) };
  await decker.update({ 'system.matrix.crippled': { ...c, evasion: Number(c.evasion ?? 0) + e, bod: Number(c.bod ?? 0) + b } });
  await saveRec(host, {
    ...rec, improvised: [...rec.improvised.filter((x) => x.decker !== decker.uuid), { decker: String(decker.uuid), id, power: plan.power, level, evasion: e, bod: b, run }],
    seen: [...rec.seen, { k: `improvise|${id}`, seq: 0 }].slice(-X.LIST_CAP * 4),
  });
  return [level ? tx('SR2E.MxIc97.Gm.improvised', { decker: String(decker.name ?? ''), power: plan.power, level }) : tx('SR2E.MxIc97.Gm.improviseFailed', { decker: String(decker.name ?? '') })];
}

/** GM side (v0.97.1): an improvised attack used or given up: the points it took come back (only those, VR2 p. 123). */
async function unimproviseGm(host: any, decker: any, rec: X.HostMx, id: string): Promise<string[]> {
  const e = rec.improvised.find((x) => x.decker === decker.uuid && x.id === id);
  if (!e) return [];
  await decker.update({ 'system.matrix.crippled': X.giveBackRecorded(decker.system?.matrix?.crippled ?? {}, e) });
  await saveRec(host, { ...hostRec(host), improvised: hostRec(host).improvised.filter((x) => !(x.decker === e.decker && x.id === e.id)) });
  return [tx('SR2E.MxIc97.Gm.unimprovised', { decker: String(decker.name ?? '') })];
}

/**
 * GM side (documents/index.ts applyHostChange, after a GM's click or on the GM's own client): record what a decker's
 * request names, every value read from GM-owned documents (the host, the IC, the GM-posted choice card), never from the
 * request or the decker's flags beyond who and which. Returns the host card's plain-text notes.
 */
export async function applyMx97(host: any, raw: unknown, pre: { rating: number; where: string } = { rating: 0, where: '' }): Promise<string[]> {
  const m = X.cleanMx97(raw);
  const decker: any = m ? sync(m.deckerUuid) : null;
  if (!m || !decker || host?.type !== 'host') return [];
  let rec = hostRec(host);
  const me = String(decker.uuid);
  // Maneuver requests in order (a re-roll's arriving first must win over the first roll's): older ones are ignored.
  const kind = m.op === 'parry' || m.op === 'unparry' ? 'parry' : m.op === 'evade' || m.op === 'unevade' ? 'evade' : m.op === 'exposed' || m.op === 'unexposed' ? 'exposed' : m.op === 'pos' || m.op === 'unpos' ? 'pos' : '';
  if (kind) {
    const next = X.takeSeq(rec, kind, me, String(m.vs ?? ''), m.seq);
    if (!next) return [];
    rec = next;
  }
  const dice = Number(decker.system?.derived?.matrix?.evasion ?? 0) + (RULES.MATRIX_V57.maneuvers.pool ? Number(decker.system?.derived?.hackingPool ?? 0) : 0);
  const card: any = m.cardId ? G()?.messages?.get?.(m.cardId) : null;
  const choice: any = card && authorIsGm(card) ? card.flags?.[SYSTEM_ID]?.mxic97Choice : null;
  const choiceOk = choice && choice.deckerUuid === me && choice.hostUuid === host.uuid && !card.getFlag?.(SYSTEM_ID, 'mxic97Done');
  // v0.97.1: the decker's visit stamp now (each entry counts only in the visit it was recorded in, VR2 p. 40).
  const run = runOf(decker);
  switch (m.op) {
    case 'parry': {
      if (!m.vs || !m.id) return [];
      const net = X.maneuverCap(m.net ?? 0, dice);
      await saveRec(host, { ...rec, parry: [...rec.parry.filter((e) => !(e.decker === me && e.vs === m.vs)), ...(net > 0 ? [{ decker: me, vs: m.vs, net, id: m.id, run }] : [])] });
      return [tx('SR2E.MxIc97.Gm.parried', { decker: String(decker.name ?? ''), net })];
    }
    case 'unparry':
      await saveRec(host, { ...rec, parry: rec.parry.filter((e) => !(e.decker === me && e.id === m.id)) });
      return [];
    case 'evade': {
      if (!m.vs) return [];
      const net = X.maneuverCap(m.net ?? 0, dice);
      const t = now();
      const end = X.evadeEnd({ round: t.round, worldTime: t.worldTime, net, gain: 0, secondsPerTurn: RULES.MATRIX_V57.maneuvers.secondsPerTurn });
      await saveRec(host, {
        ...rec, parry: rec.parry.filter((e) => !(e.decker === me && e.vs === m.vs)),
        evade: [...rec.evade.filter((e) => !(e.decker === me && e.vs === m.vs)), { decker: me, vs: m.vs, net, tallyAt: tallyNow(decker, host.uuid), round: end.round, worldTime: end.worldTime, combatId: String(t.combatId ?? ''), run }],
      });
      return [tx('SR2E.MxIc97.Gm.evaded', { decker: String(decker.name ?? ''), net })];
    }
    case 'unevade':
      await saveRec(host, { ...rec, evade: rec.evade.filter((e) => !(e.decker === me && e.vs === m.vs)) });
      return [];
    case 'exposed': {
      // A position the opponent won on the decker: at most the opponent's dice (IC: the host's Security Value).
      const opp = sync(m.vs);
      if (!m.vs || !m.id || !opp) return [];
      const oppDice = opp.type === 'ic' ? Number(host.system?.securityValue ?? opp.system?.rating ?? 0) : Number(opp.system?.derived?.matrix?.sensors ?? 0) + Number(opp.system?.derived?.hackingPool ?? 0);
      const net = X.maneuverCap(m.net ?? 0, oppDice);
      await saveRec(host, { ...rec, exposed: [...rec.exposed.filter((e) => !(e.decker === me && e.vs === m.vs)), ...(net > 0 ? [{ decker: me, vs: m.vs, net, id: m.id, run }] : [])] });
      return [tx('SR2E.MxIc97.Gm.exposed', { decker: String(decker.name ?? ''), vs: String(opp.name ?? ''), net })];
    }
    case 'unexposed':
      await saveRec(host, { ...rec, exposed: rec.exposed.filter((e) => !(e.decker === me && e.id === m.id)) });
      return [];
    case 'pos': {
      // v0.97.1 (VR2 p. 122): a position the decker won, at most what the maneuver could give (their dice, and 30).
      if (!m.vs || !m.id || !isIn(decker, String(host.uuid))) return [];
      const net = X.maneuverCap(m.net ?? 0, dice);
      await saveRec(host, { ...rec, pos: [...rec.pos.filter((e) => !(e.decker === me && e.vs === m.vs)), ...(net > 0 ? [{ decker: me, vs: m.vs, net, id: m.id, run }] : [])] });
      return [tx('SR2E.MxIc97.Gm.posed', { decker: String(decker.name ?? ''), vs: String(sync(m.vs)?.name ?? ''), net })];
    }
    case 'unpos':
      await saveRec(host, { ...rec, pos: rec.pos.filter((e) => !(e.decker === me && e.id === m.id)) });
      return [];
    case 'improvise': return improviseGm(host, decker, rec, card, run);
    case 'unimprovise': return unimproviseGm(host, decker, rec, m.id ?? '');
    case 'bomb': {
      if (pre.rating <= 0) return [];
      // MXIC_V97.suppress 'v965': nothing to suppress with: the bomb's rating goes on the tally (MXIC_V97.dataBomb).
      if (!X.on('suppress')) { await tallyNowGm(host, decker, pre.rating, ''); return []; }
      await choiceCardGm(host, decker, `bomb:${host.uuid}|${m.id}`, tx('SR2E.MxIc97.Bomb.name', { where: pre.where }), pre.rating, true, pre.where);
      return [];
    }
    case 'count': {
      if (!choiceOk) return [];
      await choiceDone(card, decker, choice);
      await tallyNowGm(host, decker, int(choice.points, 0, 30, 0), '');
      return [];
    }
    case 'suppress': {
      if (!choiceOk) return [];
      const id = String(choice.id);
      const ic = id.startsWith('bomb:') ? null : sync(id);
      if (ic && !(ic.type === 'ic' && ic.system?.derived?.crashed)) return [];
      if (rec.suppressed.some((s) => s.decker === me && s.id === id)) return [];
      // v0.97.1: only while the decker is in this host (VR2 p. 40).
      if (!isIn(decker, String(host.uuid))) return [];
      await choiceDone(card, decker, choice);
      await saveRec(host, { ...rec, suppressed: [...rec.suppressed, { decker: me, id, name: String(ic?.name ?? choice.name ?? ''), points: int(choice.points, 0, 30, 0), run: runOf(decker) }] });
      const df = Number(decker.liveDetectionFactor?.() ?? 0);
      await post(`<p>${tx('SR2E.MxIc97.Suppress.done', { decker: name(decker), name: escHtml(String(ic?.name ?? choice.name ?? '')), df })}</p><p><button type="button" data-sr2e-action="mxic97Release">${tx('SR2E.MxIc97.Suppress.release')}</button></p>`, {
        speaker: speaker(decker), whisper: [...new Set([...gmIds(), ...ownerIds(decker)])], flags: { [SYSTEM_ID]: { mxic97Release: { deckerUuid: me, hostUuid: String(host.uuid), id } } },
      });
      return [];
    }
    case 'release': {
      // v0.97.1: an entry of an earlier visit ended when the decker left (no tally: VR2 p. 40); a leftover one is dropped.
      const e = rec.suppressed.find((s) => s.decker === me && s.id === m.id);
      if (!e) return [];
      if (e.run !== runOf(decker) || !isIn(decker, String(host.uuid))) { await saveRec(host, { ...rec, suppressed: rec.suppressed.filter((s) => s !== e) }); return []; }
      await saveRec(host, { ...rec, suppressed: rec.suppressed.filter((s) => s !== e) });
      await post(`<p>${tx('SR2E.MxIc97.Suppress.released', { decker: name(decker), name: escHtml(e.name), points: e.points })}</p>`, { speaker: speaker(decker) });
      await tallyNowGm(host, decker, e.points, e.name || '-');
      return [];
    }
    default: return [];
  }
}

/** A button on a MXIC_V97 card (applications/chat.ts dispatches `mxic97…` here). */
export async function onCard(message: any, button: HTMLButtonElement, action: string): Promise<void> {
  const flags: any = message?.flags?.[SYSTEM_ID] ?? {};
  if (action === 'mxic97Count' || action === 'mxic97Suppress' || action === 'mxic97Release') {
    // Only the GM side's own cards (a player's card can't claim a crash, a bomb or what was suppressed).
    if (!authorIsGm(message)) { warn(tx('SR2E.MxIc97.gmCardOnly')); return; }
    const c = action === 'mxic97Release' ? flags.mxic97Release : flags.mxic97Choice;
    const decker: any = uuidOk(c?.deckerUuid) ? await (globalThis as any).fromUuid(c.deckerUuid) : null;
    const host: any = uuidOk(c?.hostUuid) ? await (globalThis as any).fromUuid(c.hostUuid) : null;
    if (!decker || host?.type !== 'host') return;
    if (!isGm() && !decker.isOwner) { warn(tx('SR2E.MxIc97.ownerOnly', { name: name(decker) })); return; }
    if (action !== 'mxic97Release' && message?.getFlag?.(SYSTEM_ID, 'mxic97Done')) { warn(tx('SR2E.MxIc97.alreadyDone')); return; }
    button.disabled = true;
    const op: X.Mx97Change['op'] = action === 'mxic97Count' ? 'count' : action === 'mxic97Suppress' ? 'suppress' : 'release';
    const label = op === 'count' ? tx('SR2E.MxIc97.Gm.count', { decker: String(decker.name ?? '') }) : op === 'suppress' ? tx('SR2E.MxIc97.Gm.suppress', { decker: String(decker.name ?? '') }) : tx('SR2E.MxIc97.Gm.release', { decker: String(decker.name ?? '') });
    await request(host, decker, { op, deckerUuid: String(decker.uuid), ...(op === 'release' ? { id: String(c.id ?? '') } : { cardId: String(message.id ?? '') }) }, label);
    return;
  }
  if (action === 'mxic97Restore') {
    const c = flags.mxic97Restore;
    const decker: any = uuidOk(c?.deckerUuid) ? await (globalThis as any).fromUuid(c.deckerUuid) : null;
    if (!decker) return;
    if (!isGm() && !decker.isOwner) { warn(tx('SR2E.MxIc97.ownerOnly', { name: name(decker) })); return; }
    button.disabled = true;
    if (!(await spendImprovised(decker))) { warn(tx('SR2E.MxIc97.alreadyDone')); return; }
    await post(`<p>${tx('SR2E.MxIc97.Improvise.restored', { decker: name(decker) })}</p>`, { speaker: speaker(decker) });
  }
}

// ================================================================ Black IC's last shot (VR2 p. 48)

/**
 * After a black IC resistance test (documents/index.ts #resolveSoak, the first application): a decker it killed
 * (lethal) or knocked out (non-lethal) gets the deck damage card for its shot at the MPCP, double its rating, with the
 * data wipe if the MPCP is destroyed. True when the card went out.
 */
export async function blackIcFinalShot(decker: any, ic: { icName?: string; rating?: number }, type: string, before: string, after: string): Promise<boolean> {
  const shot = X.blackIcFinalShot({ lethal: type !== 'stun', before, after, rating: int(ic?.rating, 0, 30, 0) });
  if (!shot) return false;
  const icName = String(ic?.icName ?? '').slice(0, 120);
  await post(`<p><strong>${escHtml(icName)}</strong> ${tx('SR2E.MxIc97.BlackIc.lastShot', { decker: name(decker), rating: shot.rating })}</p><p><button type="button" data-sr2e-action="deckDamage">${tx('SR2E.MxIc97.BlackIc.button', { rating: shot.rating })}</button></p>`, {
    speaker: { alias: icName },
    flags: { [SYSTEM_ID]: { deckDamage: { deckerUuid: String(decker.uuid), icName, rating: shot.rating, reason: tx('SR2E.MxIc97.BlackIc.reason'), wipe97: true } } },
  });
  return true;
}

/** Jacking in (documents/index.ts jackIn, not already in): the deck's file count, so the wipe knows what came this run. */
export function runStartUpdate(decker: any): Record<string, unknown> {
  // A fresh visit stamp: suppression counts for this visit only (VR2 p. 40: while the decker stays in that host).
  const stamp = visitUpdate();
  if (!X.on('blackIcKill')) return stamp;
  const deck: any = decker?.activeDeck?.();
  if (!deck) return stamp;
  return { ...stamp, [`flags.${SYSTEM_ID}.${RUN_FLAG}`]: { deckId: String(deck.id ?? ''), count: Array.isArray(deck.system?.files) ? deck.system.files.length : 0 } };
}

/**
 * v0.97.1 (documents/index.ts jackIn, moving to another host while jacked in): a new visit stamp, so the host's entries
 * for the decker (suppressed IC, parries, evades, positions, an improvised attack) end with the visit (VR2 p. 40).
 * Nothing when every one of those switches is at 'v965'.
 */
export function visitUpdate(): Record<string, unknown> {
  const any = X.on('suppress') || X.on('parry') || X.on('position') || X.on('evade') || X.on('improvised');
  return any ? { [`flags.${SYSTEM_ID}.${RUN_STAMP}`]: newId() } : {};
}

/**
 * v0.97.1, from applications/mxops97.ts onActorUpdate97 (every client's updateActor hook):
 * - on every client, a host's record changed: the deckers in that host are prepared again and their open sheets drawn
 *   again (their Detection Factor follows a suppression at once; a local refresh, no writes);
 * - on the lead GM's, a decker moved or jacked out: the hosts they left drop their entries (VR2 p. 40: suppression lasts
 *   "while they stay in that host"; no tally for it), the maneuvers on and by them, and an improvised attack not used
 *   (its points come back).
 */
export async function onActorUpdateMx97(actor: any, change: any, leadGm: boolean): Promise<void> {
  if (!actor || !change) return;
  if (actor.type === 'host' && change.flags?.[SYSTEM_ID]?.[HOST_FLAG] !== undefined) refreshDeckers(String(actor.uuid ?? ''));
  const mm = change.system?.matrix;
  if (!leadGm || actor.type === 'host' || !mm || typeof mm !== 'object' || !('hostUuid' in mm || 'jackedIn' in mm)) return;
  const here = actor.system?.matrix?.jackedIn ? String(actor.system?.matrix?.hostUuid ?? '') : '';
  const uuid = String(actor.uuid ?? '');
  for (const h of allActors().filter((a: any) => a?.type === 'host' && a.uuid !== here)) {
    const next = X.withoutDecker(flag(h, HOST_FLAG), uuid);
    if (!next) continue;
    try {
      // An improvised attack not used is lost with the visit: the points it took come back (only those, VR2 p. 123).
      for (const e of hostRec(h).improvised.filter((x) => x.decker === uuid)) await actor.update({ 'system.matrix.crippled': X.giveBackRecorded(actor.system?.matrix?.crippled ?? {}, e) });
      await saveRec(h, next);
    } catch (err) { console.warn('sr2e | leaving a host (IC record)', err); }
  }
}

/** The deckers jacked in to this host, prepared again (the derived Detection Factor), their open sheets redrawn. */
function refreshDeckers(hostUuid: string): void {
  if (!hostUuid) return;
  for (const a of allActors().filter((x: any) => x?.type !== 'host' && x?.type !== 'ic' && isIn(x, hostUuid))) {
    try { a.prepareData?.(); if (a.sheet?.rendered) a.sheet.render(false); } catch (err) { console.warn('sr2e | redraw a decker', err); }
  }
}

/**
 * The blast's MPCP damage is in (documents/index.ts takeDeckDamage with `wipe97`): if it destroyed the MPCP (VR2
 * p. 48), the MPCP goes to 0 and the run's downloads are deleted. Returns the card line ('' when nothing more).
 */
export async function wipeAfterBlast(decker: any, deck: any, mpcpDamage: number): Promise<string> {
  if (!X.on('blackIcKill') || !deck) return '';
  const rating = Number(deck.system?.mpcp ?? 0);
  if (!X.mpcpDestroyed(rating, mpcpDamage)) return '';
  const run: any = flag(decker, RUN_FLAG);
  const start = run && typeof run === 'object' && run.deckId === deck.id && Number.isFinite(Number(run.count)) ? Number(run.count) : null;
  const files: any[] = Array.isArray(deck.system?.files) ? deck.system.files : [];
  const kept = X.wipeRunFiles(files, start);
  const dmg = { mpcp: 0, bod: 0, evasion: 0, masking: 0, sensors: 0, ...(deck.system?.damage ?? {}) };
  await deck.update({ 'system.damage': { ...dmg, mpcp: Math.max(dmg.mpcp, rating) }, 'system.files': kept });
  return `<p><strong>${tx('SR2E.MxIc97.BlackIc.wiped', { deck: name(deck), files: files.length - kept.length })}</strong></p>`;
}

// ================================================================ Improvised attacks (VR2 pp. 120, 123)

/** An improvised attack's refusal, by its key (rules/mxic97.ts improvisedPlan). */
function whyText(why: string, mpcp: number): string {
  if (why.endsWith('improviseMpcp')) return tx('SR2E.MxIc97.Why.improviseMpcp', { mpcp });
  if (why.endsWith('improviseMore')) return tx('SR2E.MxIc97.Why.improviseMore');
  if (why.endsWith('improviseNone')) return tx('SR2E.MxIc97.Why.improviseNone');
  return tx('SR2E.MxIc97.Why.improviseOff');
}

/** The improvised attack waiting on this decker, as a program for matrixAttack (null when none ready here). */
export function improvisedProgram(decker: any): any | null {
  if (!X.on('improvised')) return null;
  // v0.97.1: only the host's record (the GM side's, from the test's card), never the decker's own flags.
  const host = hostOf(decker);
  if (!isIn(decker, host)) return null;
  const imp = X.hostImprovised(flag(sync(host), HOST_FLAG), String(decker.uuid), used(decker), runOf(decker));
  if (!imp || !imp.level || imp.power <= 0) return null;
  return { id: IMPROVISED_ID, name: tx('SR2E.MxIc97.Improvise.name'), system: { kind: 'attack', rating: imp.power, damageLevel: imp.level, loaded: true, erased: false } };
}

/**
 * The improvised attack is used (or its test failed and the decker acts again): the GM side gives Evasion and Bod back
 * what it took (v0.97.1: the host's record, a request like any other; marked used here meanwhile). False when none.
 */
export async function spendImprovised(decker: any): Promise<boolean> {
  const hostDoc: any = sync(hostOf(decker));
  const imp = hostDoc?.type === 'host' ? X.hostImprovised(flag(hostDoc, HOST_FLAG), String(decker?.uuid ?? ''), used(decker)) : null;
  // A v0.97.0 flag is only cleared (it gives nothing back: its numbers are the decker's own).
  const up: Record<string, unknown> = flag(decker, IMPROVISED_FLAG) != null ? clearFlagUpdate(decker, IMPROVISED_FLAG) : {};
  if (imp) up[`flags.${SYSTEM_ID}.${USED_FLAG}`] = X.usedAfter(flag(decker, USED_FLAG), [imp.id]);
  if (Object.keys(up).length) await decker.update(up);
  if (!imp) return false;
  await request(hostDoc, decker, { op: 'unimprovise', deckerUuid: String(decker.uuid), id: imp.id }, tx('SR2E.MxIc97.Gm.unimprovise', { decker: String(decker.name ?? '') }));
  return true;
}

/**
 * Write an improvised attack (VR2 p. 123): points from Evasion and Bod (Power at most the MPCP), then a Computer Test
 * against the Power: its successes give the Damage Level. v0.97.1: the test's card goes to the GM side (a host change),
 * which takes the points off and records the attack; they stay off until the attack (or, after a failure, the decker's
 * next action: the card's Restore button). The caller spends the Simple Action.
 */
export async function improvise(decker: any, o: { fromEvasion: number; fromBod: number }): Promise<boolean> {
  const m = decker?.system?.derived?.matrix;
  const hostDoc: any = sync(hostOf(decker));
  if (!m || !decker.isJackedIn?.() || hostDoc?.type !== 'host') { warn(tx('SR2E.MxIc97.Why.improviseOff')); return false; }
  // An earlier one not used yet: the GM side gives its points back first, so they count as there to give.
  const old = X.hostImprovised(flag(hostDoc, HOST_FLAG), String(decker.uuid), used(decker));
  const plan = X.improvisedPlan({ evasion: Number(m.evasion ?? 0) + (old?.evasion ?? 0), bod: Number(m.bod ?? 0) + (old?.bod ?? 0), fromEvasion: o.fromEvasion, fromBod: o.fromBod, mpcp: Number(m.mpcp ?? 0) });
  if (plan.why) { warn(whyText(plan.why, Number(m.mpcp ?? 0))); return false; }
  const computer = Number(decker.findSkill?.(RULES.MATRIX.skill)?.system?.rating ?? 0);
  const t = await rollTest(computer, plan.tn);
  const level = X.improvisedLevel(t.r.successes);
  const e = Math.floor(Number(o.fromEvasion) || 0), b = Math.floor(Number(o.fromBod) || 0);
  const body = level
    ? `<p><strong>${tx('SR2E.MxIc97.Improvise.ready', { power: plan.power, level })}</strong> ${tx('SR2E.MxIc97.Improvise.readyNote', { evasion: e, bod: b })}</p>`
    : `<p><strong>${tx('SR2E.MxIc97.Improvise.failed')}</strong> ${tx('SR2E.MxIc97.Improvise.failedNote', { evasion: e, bod: b })}</p><p><button type="button" data-sr2e-action="mxic97Restore">${tx('SR2E.MxIc97.Improvise.restore')}</button></p>`;
  const card = await post(rollHtml(tx('SR2E.MxIc97.Improvise.test', { decker: name(decker), computer, tn: plan.tn }), t.r) + body, {
    speaker: speaker(decker), rolls: t.rolls,
    flags: { [SYSTEM_ID]: { mxic97Improvise: { deckerUuid: String(decker.uuid), evasion: e, bod: b }, ...(level ? {} : { mxic97Restore: { deckerUuid: String(decker.uuid) } }) } },
  });
  await request(hostDoc, decker, { op: 'improvise', deckerUuid: String(decker.uuid), cardId: String(card?.id ?? ''), net: plan.power }, tx('SR2E.MxIc97.Gm.improvise', { decker: String(decker.name ?? ''), power: plan.power }));
  return Boolean(level);
}

// ================================================================ Combat maneuvers (VR2 pp. 121–122)

const used = (a: any): string[] => { const u = flag(a, USED_FLAG); return Array.isArray(u) ? u.filter((x) => typeof x === 'string') : []; };
const hostOf = (a: any): string => String(a?.type === 'ic' ? a?.system?.hostUuid ?? '' : a?.system?.matrix?.hostUuid ?? '');
const tallyNow = (decker: any, hostUuid: string): number => {
  const host: any = sync(hostUuid);
  const key = decker?.tallyFor?.()?.key ?? String(decker?.uuid ?? '');
  return host?.type === 'host' ? deckerTallyOf(host.system?.tallies ?? [], key) : 0;
};

/** A request's order: the resolving client's clock (ms × 1000 + a counter), each later resolution higher. */
let seqCount = 0;
const nextSeq = (): number => Date.now() * 1000 + (seqCount++ % 1000);

/** Whether a maneuver of this kind runs the book's way. */
export const bookManeuver = (kind: string): boolean => (kind === 'parry' || kind === 'position' || kind === 'evade') && X.on(kind);

/**
 * A maneuver's outcome the book's way (documents/index.ts #resolveManeuver): the decker's own state (parry and
 * position entries, a position won against them, the evade's tally mark), the old list's evade entry for net Combat
 * Turns, a black IC hold freed. A Karma re-roll replaces the entry the card left. Null when the kind runs the old way.
 */
export async function resolveManeuver(decker: any, snap: any): Promise<{ html: string; snap: any } | null> {
  const mv = snap?.maneuver;
  if (!mv || !bookManeuver(mv.kind)) return null;
  const host = hostOf(decker);
  const id = String(mv.entry97 ?? '') || newId();
  const out = X.maneuverAfter(flag(decker, MX_FLAG), { kind: mv.kind, vs: String(mv.targetUuid), hostUuid: host, mine: snap.successes, theirs: mv.opp, id, replaces: mv.entry97 ?? null, tally: tallyNow(decker, host) });
  // Parries and evades are the GM side's to record (on the host, below): the decker's own flag keeps positions only.
  // v0.97.1: positions too (the host's `pos`): the decker's own flag keeps nothing that counts.
  const up: Record<string, unknown> = { [`flags.${SYSTEM_ID}.${MX_FLAG}`]: { ...out.state, parry: [], evade: [], exposed: [], pos: [] } };
  const t = now();
  const sameEntry = (e: Maneuver) => e.kind === 'evade' && e.targetUuid === mv.targetUuid;
  let list: Maneuver[] = activeManeuvers(decker.system?.matrix?.maneuvers ?? [], t).filter((e) => !sameEntry(e));
  const engaged: string[] = [...(decker.system?.matrix?.engagedBy ?? [])];
  let freed = Boolean(mv.freed);
  if (mv.kind === 'evade' && out.who === 'me') {
    const end = X.evadeEnd({ round: t.round, worldTime: t.worldTime, net: out.net, gain: 0, secondsPerTurn: RULES.MATRIX_V57.maneuvers.secondsPerTurn });
    list = [...list, { kind: 'evade', targetUuid: String(mv.targetUuid), net: out.net, round: end.round, worldTime: end.worldTime, ...combatStamp(t) }];
    if (engaged.includes(mv.targetUuid)) { up['system.matrix.engagedBy'] = engaged.filter((u) => u !== mv.targetUuid); freed = true; }
  } else if (mv.kind === 'evade' && freed && !engaged.includes(mv.targetUuid)) {
    up['system.matrix.engagedBy'] = [...engaged, mv.targetUuid];
    freed = false;
  }
  if (mv.kind === 'evade') up['system.matrix.maneuvers'] = list;
  await decker.update(up);
  // The GM side records a won parry or evade on the host (a re-roll that loses takes it back).
  const hostDoc: any = sync(host);
  const won = out.who === 'me';
  // A position lost (it backfires): the opponent's bonus, recorded on the host too.
  const lost = mv.kind === 'position' && out.who === 'them';
  if (hostDoc?.type === 'host' && mv.kind === 'position' && (lost || mv.lost97)) {
    await request(hostDoc, decker, { op: lost ? 'exposed' : 'unexposed', deckerUuid: String(decker.uuid), vs: String(mv.targetUuid), id, seq: nextSeq(), ...(lost ? { net: out.net } : {}) },
      tx('SR2E.MxIc97.Gm.exposedReq', { decker: String(decker.name ?? ''), vs: String(mv.targetName ?? ''), net: lost ? out.net : 0 }));
  }
  // v0.97.1: a position won is the GM side's to record too (VR2 p. 122), capped there at the decker's dice.
  if (hostDoc?.type === 'host' && mv.kind === 'position' && (won || mv.won97)) {
    await request(hostDoc, decker, { op: won ? 'pos' : 'unpos', deckerUuid: String(decker.uuid), vs: String(mv.targetUuid), id, seq: nextSeq(), ...(won ? { net: out.net } : {}) },
      tx('SR2E.MxIc97.Gm.posReq', { decker: String(decker.name ?? ''), vs: String(mv.targetName ?? ''), net: won ? out.net : 0 }));
  }
  if (hostDoc?.type === 'host' && (mv.kind === 'parry' || mv.kind === 'evade') && (won || mv.won97)) {
    const op: X.Mx97Change['op'] = mv.kind === 'parry' ? (won ? 'parry' : 'unparry') : (won ? 'evade' : 'unevade');
    await request(hostDoc, decker, { op, deckerUuid: String(decker.uuid), vs: String(mv.targetUuid), id, seq: nextSeq(), ...(won ? { net: out.net } : {}) },
      mv.kind === 'parry' ? tx('SR2E.MxIc97.Gm.parry', { decker: String(decker.name ?? ''), net: won ? out.net : 0 }) : tx('SR2E.MxIc97.Gm.evade', { decker: String(decker.name ?? ''), net: won ? out.net : 0 }));
  }
  const who = escHtml(String(mv.targetName ?? ''));
  const mine = Math.max(0, Number(snap.successes) || 0), theirs = Math.max(0, Number(mv.opp) || 0);
  return { html: `<p>${out.who === null ? tx('SR2E.MxIc97.Maneuver.fails', { mine, theirs })
    : mv.kind === 'position' && out.who === 'me' ? tx('SR2E.MxIc97.Maneuver.position', { name: name(decker), target: who, net: out.net, mine, theirs })
    : mv.kind === 'position' ? tx('SR2E.MxIc97.Maneuver.backfires', { name: name(decker), target: who, net: out.net, mine, theirs })
    : out.who === 'them' ? tx('SR2E.MxIc97.Maneuver.fails', { mine, theirs })
    : mv.kind === 'parry' ? tx('SR2E.MxIc97.Maneuver.parry', { name: name(decker), target: who, net: out.net, mine, theirs })
    : tx('SR2E.MxIc97.Maneuver.evade', { name: name(decker), target: who, net: out.net, mine, theirs })}</p>`, snap: { ...snap, maneuver: { ...mv, entry97: out.entryId ?? id, freed, won97: out.who === 'me', lost97: mv.kind === 'position' && out.who === 'them' } } };
}

/**
 * A cybercombat attack's maneuver modifiers (VR2 p. 122): the attacker's position on the target and a position the
 * target lost to it (−TN, or +Power when `as` is 'power'), and the target's parry against it (+TN). Each switch at
 * 'v965' gives the old list's modifier. `consume`: what this attack uses up (see afterAttack).
 */
export function attackMods(attacker: any, target: any, as: string = 'tn'): { mods: TargetNumberModifier[]; power: number; ownPos: string[]; used: string[] } {
  const out = { mods: [] as TargetNumberModifier[], power: 0, ownPos: [] as string[], used: [] as string[] };
  if (!target) return out;
  const t = now();
  const host = hostOf(attacker);
  const me = String(attacker.uuid);
  if (X.on('position')) {
    // v0.97.1: the attacker's won position from the host's record only (the GM side's), this visit's, not used up.
    const hostRaw = flag(sync(host), HOST_FLAG);
    const own = attacker.type === 'ic' || !isIn(attacker, host) ? null : X.hostPos(hostRaw, me, String(target.uuid), used(attacker), runOf(attacker));
    const exp = target.type === 'ic' ? null : X.hostExposed(hostRaw, String(target.uuid), me, used(attacker), runOf(target));
    const net = (own?.net ?? 0) + (exp?.net ?? 0);
    if (net > 0) {
      const u = X.positionUse(net, as);
      if (u.tn) out.mods.push({ id: 'positionManeuver', label: tx('SR2E.MxIc97.Maneuver.positionMod'), value: u.tn });
      out.power += u.power;
    }
    if (own) out.ownPos.push(own.id);
    if (exp) out.used.push(exp.id);
  } else {
    const pos = positionBonus(attacker.system?.matrix?.maneuvers ?? [], String(target.uuid), t);
    if (pos) out.mods.push(pos);
  }
  if (target.type !== 'ic') {
    const p = parryMod(target, me, t);
    if (p.mod) out.mods.push(p.mod);
    if (p.id) out.used.push(p.id);
  }
  return out;
}

/** The target's parry against this attacker: the book's (its id, used up by the attack) or the old list's. */
export function parryMod(target: any, attackerUuid: string, t: { round: number | null; worldTime: number; combatId: string | null } = now()): { mod: TargetNumberModifier | null; id: string | null } {
  if (!target) return { mod: null, id: null };
  if (!X.on('parry')) return { mod: parryPenalty(target.system?.matrix?.maneuvers ?? [], attackerUuid, String(target.name ?? ''), t), id: null };
  // The host's record (the GM side's), never the parrying decker's own flags.
  const attacker = sync(attackerUuid);
  const e = X.hostParry(flag(sync(hostOf(target)), HOST_FLAG), String(target.uuid), attackerUuid, used(attacker), runOf(target));
  return e ? { mod: { id: 'parry97', label: tx('SR2E.MxIc97.Maneuver.parryMod', { name: String(target.name ?? '') }), value: e.net }, id: e.id } : { mod: null, id: null };
}

/**
 * An IC's (or a frame's) attack on a decker (VR2 p. 122): the decker's parry against it (+TN) and a position the decker
 * lost to it (−TN). Each switch at 'v965': the old parry only.
 */
export function icMods(ic: any, target: any): { mods: TargetNumberModifier[]; used: string[]; parryId?: string; exposedId?: string } {
  const out = { mods: [] as TargetNumberModifier[], used: [] as string[], parryId: undefined as string | undefined, exposedId: undefined as string | undefined };
  if (!target || target.type === 'ic') return out;
  const p = parryMod(target, String(ic.uuid));
  if (p.mod) out.mods.push(p.mod);
  // IC are the GM's: its attack takes the parry off the host's record itself (afterAttack).
  if (p.id) out.parryId = p.id;
  if (X.on('position')) {
    // The host's record (the GM side's), never the decker's own flags: the IC's attack takes it off (afterAttack).
    const exp = X.hostExposed(flag(sync(hostOf(target)), HOST_FLAG), String(target.uuid), String(ic.uuid), [], runOf(target));
    if (exp) { out.mods.push({ id: 'positionManeuver', label: tx('SR2E.MxIc97.Maneuver.exposedMod', { name: String(target.name ?? '') }), value: -exp.net }); out.exposedId = exp.id; }
  }
  return out;
}

/** After the attack: the attacker's own positions on the target are used, and the target's entries it used are noted on the attacker. */
export async function afterAttack(attacker: any, m: { ownPos: string[]; used: string[]; parryId?: string; exposedId?: string }): Promise<void> {
  if ((m.parryId || m.exposedId) && attacker?.type === 'ic') {
    const host: any = sync(hostOf(attacker));
    const rec = hostRec(host);
    if (host?.type === 'host') { try { await saveRec(host, { ...rec, parry: rec.parry.filter((e) => e.id !== m.parryId), exposed: rec.exposed.filter((e) => e.id !== m.exposedId) }); } catch (err) { console.warn('sr2e | parry used up (the GM\'s client runs IC)', err); } }
  }
  if (!attacker || (!m.ownPos.length && !m.used.length)) return;
  // v0.97.1: the attacker's own won positions are noted used here too, until the GM side takes them off the host.
  const up: Record<string, unknown> = { [`flags.${SYSTEM_ID}.${USED_FLAG}`]: X.usedAfter(flag(attacker, USED_FLAG), [...m.used, ...m.ownPos]) };
  try { await attacker.update(up); } catch (err) { console.warn('sr2e | maneuvers used up (not the attacker\'s owner)', err); }
  const host: any = m.ownPos.length ? sync(hostOf(attacker)) : null;
  if (host?.type !== 'host') return;
  // The won positions this attack used come off the host's record (VR2 p. 122: the next attack), as a request.
  for (const id of m.ownPos) await request(host, attacker, { op: 'unpos', deckerUuid: String(attacker.uuid), id }, tx('SR2E.MxIc97.Gm.unpos', { decker: String(attacker.name ?? '') }));
}

/**
 * Whether the decker's evade still hides them from this IC (VR2 p. 121): the old list's entry (net turns long), 1 turn
 * shorter per point the decker's tally rose since. Null under 'v965' (the caller's evadedBy decides).
 */
export function evaded(decker: any, icUuid: string): boolean | null {
  if (!X.on('evade') || !RULES.MATRIX_V57.maneuvers.evadeBlocks) return null;
  // Only the host's record (the GM side's): its end and the tally then; the decker's own list never decides.
  const host = hostOf(decker);
  const r = X.hostEvade(flag(sync(host), HOST_FLAG), String(decker?.uuid ?? ''), icUuid, runOf(decker));
  if (!r) return false;
  return X.evadeHolds({ round: r.round, worldTime: r.worldTime, net: r.net, combatId: r.combatId }, now(), Math.max(0, tallyNow(decker, host) - r.tallyAt));
}

/** The jack-out's update entries for this file's flags that are set (none under 'v965': they are never set). */
export function endRunClear(decker: any): Record<string, null> {
  const keys = [MX_FLAG, USED_FLAG, IMPROVISED_FLAG].filter((k) => flag(decker, k) != null);
  return keys.length ? clearFlagUpdate(decker, ...keys) : {};
}

// ================================================================ Ripper, tar pit, scramble (VR2 pp. 42–43)

/** The Ripper Test's outcome line. */
function ripperLine(deck: any, attr: string, loss: number): string {
  return loss > 0 ? tx('SR2E.MxIc97.Ripper.loss', { deck: name(deck), attr: escHtml(attr), loss }) : tx('SR2E.MxIc97.Ripper.holds', { deck: name(deck) });
}

/**
 * A ripper that damaged the icon (VR2 p. 43): the Ripper Test (its rating) against the MPCP + Hardening takes 1 point
 * per success off the deck's persona chip for good. Posts its card; returns the line for the attack's card.
 */
export async function ripperChip(decker: any, ic: { icName?: string; rating?: number }, attr: string): Promise<string> {
  const deck: any = decker?.activeDeck?.();
  const m = decker?.system?.derived?.matrix;
  if (!deck || !m || !['bod', 'evasion', 'masking', 'sensors'].includes(attr)) return '';
  const tn = X.ripperTn(Number(m.mpcp ?? 0), Number(m.hardening ?? 0));
  const rating = int(ic?.rating, 0, 20, 0);
  const t = await rollTest(rating, tn);
  const dmg = { mpcp: 0, bod: 0, evasion: 0, masking: 0, sensors: 0, ...(deck.system?.damage ?? {}) };
  const left = Math.max(0, Number(deck.system?.[attr] ?? 0) - Number((dmg as any)[attr] ?? 0));
  const loss = X.ripperChipLoss(t.r.successes, left);
  if (loss > 0) await deck.update({ 'system.damage': { ...dmg, [attr]: Number((dmg as any)[attr] ?? 0) + loss } });
  await post(`${rollHtml(tx('SR2E.MxIc97.Ripper.test', { ic: escHtml(String(ic?.icName ?? '')), rating, tn }), t.r)}<p>${ripperLine(deck, attr, loss)}</p>`, { speaker: { alias: String(ic?.icName ?? '') }, rolls: t.rolls });
  return ` ${ripperLine(deck, attr, loss)}`;
}

/**
 * A tar pit that trashed a utility (VR2 p. 43): the Tar Pit Test (its rating) against the MPCP + Hardening; any success
 * corrupts every copy in the deck. Posts its card; returns whether the program is lost.
 */
export async function tarPitTest(decker: any, ic: { icName?: string; rating?: number }): Promise<boolean> {
  const m = decker?.system?.derived?.matrix;
  const tn = X.ripperTn(Number(m?.mpcp ?? 0), Number(m?.hardening ?? 0));
  const rating = int(ic?.rating, 0, 20, 0);
  const t = await rollTest(rating, tn);
  const lost = X.tarPitCorrupts(t.r.successes);
  await post(`${rollHtml(tx('SR2E.MxIc97.Tar.pitTest', { ic: escHtml(String(ic?.icName ?? '')), rating, tn }), t.r)}<p>${lost ? tx('SR2E.MxIc97.Tar.corrupts') : tx('SR2E.MxIc97.Tar.defeated')}</p>`, { speaker: { alias: String(ic?.icName ?? '') }, rolls: t.rolls });
  return lost;
}

/** The utility's side of a tar's opposed test (VR2 p. 42): its rating against the tar's; null under 'v965'. */
export function tarDefense(decker: any, attack: any): { dice: number; tn: number; label: string } | null {
  if (!X.on('tar') || !attack?.ic || !['tarBaby', 'tarPit'].includes(String(attack.ic.behavior))) return null;
  const prog: any = attack.ic.programId ? decker?.items?.get?.(attack.ic.programId) : null;
  const d = X.tarDefense(prog ? Number(decker.utilityRating?.(prog) ?? prog.system?.rating ?? 0) : 0, Number(attack.ic.rating ?? 0));
  return { ...d, label: tx('SR2E.MxIc97.Tar.defense', { program: escHtml(String(prog?.name ?? '')), dice: d.dice, tn: d.tn }) };
}

/**
 * A poison scramble's Poison Test after a failed decryption (VR2 p. 42): its rating against the decker's Computer.
 * Posts its card; true when the data is destroyed.
 */
export async function poisonTest(decker: any, file: { name?: string; scramble?: number }): Promise<boolean> {
  const computer = Number(decker?.findSkill?.(RULES.MATRIX.skill)?.system?.rating ?? 0);
  const p = X.poisonTest(Number(file?.scramble ?? 0), computer);
  const t = await rollTest(p.dice, p.tn);
  const gone = t.r.successes > 0;
  await post(`${rollHtml(tx('SR2E.MxIc97.Scramble.test', { file: escHtml(String(file?.name ?? '')), rating: p.dice, tn: p.tn }), t.r)}<p>${gone ? tx('SR2E.MxIc97.Scramble.destroys', { file: escHtml(String(file?.name ?? '')) }) : tx('SR2E.MxIc97.Scramble.suppressed')}</p>`, { speaker: speaker(decker), rolls: t.rolls });
  return gone;
}

// ================================================================ Reality filter (VR2 p. 84; Mapping Matrices p. 69)

/** The reality filter card's result line the book's way ('' under 'v965'). */
export function filterLine(ok: boolean, hostName: string): string {
  if (!X.on('realityFilter')) return '';
  return ok ? tx('SR2E.MxIc97.Filter.holds', { host: escHtml(hostName) }) : tx('SR2E.MxIc97.Filter.fails', { host: escHtml(hostName) });
}

/** Re-exported for the documents hooks. */
export type { DamageLevel };
