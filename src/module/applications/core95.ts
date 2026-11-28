/**
 * v0.95.0 rules completeness, core mechanics and characters: the Foundry glue for RULES.CORE_V95 (pure logic:
 * rules/core95.ts). The Team Karma Pool (a world store written only by the GM's client, through the 'teamKarma'
 * relay), an NPC's racism and the secret Charisma test, the training self-test, jumping and the water tests, missed
 * lifestyle payments and selling a lifestyle, a contact's fee, meet and upkeep, and the GM's group tests.
 *
 * Security: a relay request is judged by the user the socket names (`user`), never by its data; a card button reads a
 * card's flags only as bounded numbers and escaped text, changes for a player need a GM-posted card, and a GM's change
 * from a player-posted card is confirmed in a dialog first.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES } from '../rules/config.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { replaceFlag } from '../helpers/flags.ts';
import { sysNow } from '../helpers/clock.ts';
import { successTest, type TargetNumberModifier, type SuccessTestResult } from '../rules/dice.ts';
import { requestGm, activeGm, onRelay } from './socket.ts';
import { withGmLock } from './gmlock.ts';
import * as CO923 from '../rules/core923.ts';
import { authorIsGm, cardAuthor } from './trust.ts';
import * as C from '../rules/core95.ts';

const G = (): any => game as any;
const isGm = (): boolean => Boolean(G().user?.isGM);
const dialogs = (): any => (globalThis as any).foundry?.applications?.api?.DialogV2;
const warn = (text: string): void => { (globalThis as any).ui?.notifications?.warn?.(text); };
const int = (v: unknown, min: number, max: number, d = min): number => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
const gmIds = (): string[] => [...(G().users ?? [])].filter((u: any) => u.isGM).map((u: any) => String(u.id));
const now = (): number => sysNow();
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const metatypeLabel = (id: string): string => String((RULES.METATYPES.types as any)[id]?.label ?? cap(id));
const post = (content: string, extra: Record<string, unknown> = {}): Promise<any> => (globalThis as any).ChatMessage.create({ content, ...extra });

/** Dice rolled with Foundry (shown by Dice So Nice through the card's rolls). */
function roller(sink: any[]): (count: number) => Promise<number[]> {
  return async (count: number) => {
    const roll = await new (globalThis as any).Roll(`${count}d6`).evaluate();
    sink.push(roll);
    return (roll.dice ?? []).flatMap((term: any) => term.results.map((r: any) => Number(r.result)));
  };
}
async function d6(count: number, sink: any[]): Promise<number[]> { return roller(sink)(count); }
const diceText = (r: SuccessTestResult): string => r.dice.map((d) => Number(d.total)).join(', ');

// ================================================================ The Team Karma Pool

export const TEAM_POOL = 'teamPool95';

export function teamNow(): C.TeamPool {
  try { return C.teamPoolOf(G().settings.get(SYSTEM_ID, TEAM_POOL)); } catch { return C.teamPoolOf(null); }
}

/** The id a character is listed under: the world actor's (an unlinked token is its base actor). */
export function memberId(actor: any): string {
  if (!actor) return '';
  return String(actor.isToken ? actor.token?.actorId ?? '' : actor.id ?? '');
}
export const isMember = (actor: any): boolean => C.teamBook() && teamNow().members.includes(memberId(actor));

/** Team Karma a character may draw on right now (0 off the list, or with the tracker). */
export function teamKarmaLeft(actor: any): number {
  return isMember(actor) ? C.teamLeft(teamNow()) : 0;
}

/** Whether the Karma buttons show for an actor with no Karma Pool of their own (a member, the pool not empty). */
export const teamKarmaFor = (actor: any): boolean => teamKarmaLeft(actor) > 0;

/**
 * Run a GM-side operation: on the GM's own client under the GM lock (inline when a re-run already holds it, judged as
 * that re-run's author), otherwise through the relay (judged by the socket's sender there).
 */
export async function gmRun(op: 'teamKarma' | 'core95', data: Record<string, any>): Promise<{ ok: boolean; note?: string }> {
  const gm: any = activeGm();
  if (gm?.isSelf) {
    const fn = op === 'teamKarma' ? teamRelay : core95Relay;
    const cls: any = (globalThis as any).CONFIG?.Actor?.documentClass;
    const acting: any = cls?.actingAuthor ?? null;
    // Inside a card's re-run (runAsAuthor holds the GM lock; a GM's own card has no acting author): inline, or the
    // step would wait for the lock its own caller holds.
    const inRun = Boolean(acting) || Boolean(cls?.inAuthorRun);
    try { return inRun ? await fn(data, acting ?? G().user) : await withGmLock(() => fn(data, G().user)); } catch (err) { console.warn('sr2e | core95', err); return { ok: false }; }
  }
  return requestGm(op, data);
}

/**
 * Draw `n` points for `actor` through the GM's client. `cardId`: the chat card a success is bought on (for good):
 * the GM's client checks it is the player's own card for this character before taking points for good.
 */
export async function spendTeam(actor: any, n: number, permanent = false, cardId = ''): Promise<boolean> {
  const res = await gmRun('teamKarma', { op: 'spend', actorId: memberId(actor), n: int(n, 1, 99), ...(permanent ? { permanent: true, cardId: String(cardId ?? '').slice(0, 64) } : {}) });
  if (!res.ok) warn(res.note ? escHtml(res.note) : tx('SR2E.Core95.Team.Why.teamShort'));
  return Boolean(res.ok);
}

/**
 * A Karma spend of `points` for `actor`: from the team pool (true: paid there; false: refused or cancelled) or from
 * the character's own pool (null: the caller spends it as before). With both possible the user picks; a GM acting for
 * a card's author is not asked (own pool first). `cardId`: the card a success is bought on (`permanent`).
 */
export async function karmaFromTeam(actor: any, points: number, permanent = false, cardId = ''): Promise<boolean | null> {
  if (!C.teamBook()) return null;
  const ownLeft = Number(actor?.system?.derived?.karmaPoolLeft ?? 0);
  const team = teamNow();
  const src = C.karmaSources({ points, ownLeft, team, member: team.members.includes(memberId(actor)) });
  if (src === 'own' || src === 'none') return null;
  const acting = Boolean((globalThis as any).CONFIG?.Actor?.documentClass?.actingAuthor);
  if (src === 'ask' && acting) return null;
  const p = int(points, 1, 99);
  const dlg = dialogs();
  if (!acting && dlg?.wait) {
    const pick = await dlg.wait({
      window: { title: tx('SR2E.Core95.Team.sourceTitle') },
      content: `<p>${tx('SR2E.Core95.Team.sourceAsk', { name: escHtml(String(actor?.name ?? '')), points: p, own: Math.max(0, Math.floor(ownLeft)), team: C.teamLeft(team) })}</p><p class="hint">${tx('SR2E.Core95.Team.agree')}</p>`,
      buttons: [
        ...(src === 'ask' ? [{ action: 'own', label: tx('SR2E.Core95.Team.fromOwn'), default: true }] : []),
        { action: 'team', label: tx('SR2E.Core95.Team.fromTeam'), default: src !== 'ask' },
        { action: 'cancel', label: tx('SR2E.Core95.cancel') },
      ],
      rejectClose: false,
    });
    if (pick === 'own') return null;
    if (pick !== 'team') return false;
  }
  return spendTeam(actor, p, permanent, cardId);
}

/**
 * A roll dialog's Karma dice row: the book's own row, or for a team member while the team pool has points, a row
 * capped at their own and the team's points together (and the test's own dice in the book), with the "from the Team
 * Karma Pool" tick (ticked when their own pool is empty).
 */
export function karmaDiceRow(actor: any, left: number, rated = true, baseDice = 0): string {
  const team = teamKarmaLeft(actor);
  if (team <= 0 || !rated) return CO923.karmaDiceRow(left, rated, baseDice);
  const own = Math.max(0, Math.floor(Number(left) || 0));
  const room = own + team;
  const max = RULES.URR_V80.coreKarmaDice ? room : Math.min(room, CO923.karmaDiceCap(baseDice));
  if (max <= 0) return '';
  return `<div class="form-group"><label>${tx('SR2E.Core95.Team.diceRow', { own, team })}</label><input name="karmaDice" type="number" min="0" max="${max}" value="0"></div>
    <label class="sr2e-check"><input type="checkbox" name="teamKarma95" ${own <= 0 ? 'checked' : ''}> ${tx('SR2E.Core95.Team.diceTick', { left: team })}</label>`;
}

// The tick is read when its own dialog's button is pressed: the roll that button starts takes it (once, soon after).
let teamDice: { at: number } | null = null;
const TEAM_DICE_MS = 60_000;
/** A dialog's buttons that close it without rolling. */
const NOT_A_ROLL = new Set(['cancel', 'close', 'no']);

/** A dialog was shown: its buttons record whether its own tick was on when one of them is pressed. */
export function watchDialog(root: any): void {
  const buttons = root?.querySelectorAll?.('button') ?? [];
  for (const b of buttons) {
    b.addEventListener?.('click', () => {
      // Only the button that rolls arms it: Cancel, close and "no" leave nothing for a later roll to take.
      const action = String(b.dataset?.action ?? b.getAttribute?.('data-action') ?? '');
      if (NOT_A_ROLL.has(action)) { teamDice = null; return; }
      const box = (root && typeof root.querySelector === 'function' ? root.querySelector('input[name="teamKarma95"]') : null) as HTMLInputElement | null;
      teamDice = box?.checked ? { at: Date.now() } : null;
    }, { capture: true });
  }
}

/** Whether the roll now starting takes Karma dice from the team pool (the tick of the dialog just pressed; once). */
export function takeTeamDice(actor: any): boolean {
  const t = teamDice;
  teamDice = null;
  return Boolean(t) && Date.now() - t!.at < TEAM_DICE_MS && teamKarmaLeft(actor) > 0;
}

/** Test aid: what the next roll's dialog said. */
export function setTeamDiceForTest(on: boolean): void { teamDice = on ? { at: Date.now() } : null; }

/** Whether `cardId` is `user`'s own card of a test by `actor` (a success bought there may take team points for good). */
function ownCardFor(cardId: unknown, user: any, actorId: string): boolean {
  const msg: any = typeof cardId === 'string' && cardId ? G().messages?.get?.(cardId) : null;
  if (!msg || cardAuthor(msg)?.id !== user?.id) return false;
  const f: any = msg.flags?.[SYSTEM_ID] ?? {};
  const uuids: string[] = [f.test?.actorUuid, ...((f.contest?.sides ?? []) as any[]).map((x: any) => x?.uuid)].filter((u: unknown): u is string => typeof u === 'string' && u.length > 0 && u.length < 400);
  return uuids.some((u) => memberId((globalThis as any).fromUuidSync?.(u)) === actorId);
}

/**
 * Write the team pool and post its line. v0.96.5: the write is the relay's own (`sr2eRelay`: the request was judged
 * above as the user who sent it), so a GM re-running a player's card stores it too; and it is read back: false when it
 * did not land (then nothing counts as paid).
 */
async function store(next: C.TeamPool, line: string): Promise<boolean> {
  await G().settings.set(SYSTEM_ID, TEAM_POOL, next, { sr2eRelay: true });
  if (JSON.stringify(teamNow()) !== JSON.stringify(C.teamPoolOf(next))) return false;
  await post(`<div class="sr2e-team-karma-note"><p>${line}</p></div>`);
  return true;
}
const notStored = (): { ok: boolean; note: string } => why('SR2E.Core95.Team.Why.notStored');

const why = (key: string | undefined): { ok: boolean; note: string } => ({ ok: false, note: tKey(String(key ?? 'SR2E.Core95.Team.Why.badNumber')) });

/**
 * The 'teamKarma' relay with the book's pool: runs on the GM's client as `user` (the socket's sender). A player may
 * draw or give for a character they own; everything else is the GM's.
 */
export async function teamRelay(data: Record<string, any>, user: any): Promise<{ ok: boolean; note?: string }> {
  if (!C.teamBook()) return { ok: false };
  const op = String(data?.op ?? '');
  const gm = Boolean(user?.isGM);
  const team = teamNow();
  const actorId = typeof data?.actorId === 'string' ? data.actorId.slice(0, 64) : '';
  const actor: any = actorId ? G().actors?.get?.(actorId) : null;
  const owns = Boolean(actor) && (gm || Boolean(actor.testUserPermission?.(user, 'OWNER')));
  const name = escHtml(String(actor?.name ?? ''));
  const who = escHtml(String(user?.name ?? ''));
  const ownLeft = Math.max(0, Math.floor(Number(actor?.system?.karma?.pool ?? 0) - Number(actor?.system?.karma?.poolSpent ?? 0)));
  if (op === 'spend') {
    if (!owns) return why('SR2E.Core95.Team.Why.notYours');
    // For good only on a bought success: the player's own card of this character's test (checked here, not trusted).
    const permanent = Boolean(data?.permanent) && (gm || ownCardFor(data?.cardId, user, actorId));
    if (Boolean(data?.permanent) && !permanent) return why('SR2E.Core95.Team.Why.notCard');
    const n = int(data?.n, 1, permanent ? 3 : 99);
    const r = C.teamSpend(team, actorId, n, permanent);
    if (!r.ok) return why(r.why);
    if (!(await store(r.team, (permanent ? tx('SR2E.Core95.Team.spentForGood', { who, name, n, left: C.teamLeft(r.team) }) : tx('SR2E.Core95.Team.spent', { who, name, n, left: C.teamLeft(r.team) }))))) return notStored();
    return { ok: true };
  }
  if (op === 'give') {
    if (!owns) return why('SR2E.Core95.Team.Why.notYours');
    const n = int(data?.n, 1, 99);
    const r = C.teamGive(team, actorId, n, ownLeft);
    if (!r.ok) return why(r.why);
    // v0.96.5: the team pool first, so a write that doesn't land takes nothing from the character.
    if (!(await store(r.team, tx('SR2E.Core95.Team.gave', { name, n, pool: r.team.pool })))) return notStored();
    await actor.update({ 'system.karma.pool': Math.max(0, Math.floor(Number(actor.system?.karma?.pool ?? 0)) - n) });
    return { ok: true };
  }
  if (!gm) return why('SR2E.Core95.Team.Why.gmOnly');
  if (op === 'join') {
    if (!actor) return why('SR2E.Core95.Team.Why.noActor');
    const r = C.teamJoin(team, actorId, ownLeft);
    if (!r.ok) return why(r.why);
    const cost = Number(r.own ?? 0);
    if (!(await store(r.team, tx('SR2E.Core95.Team.joined', { name, n: cost, pool: r.team.pool })))) return notStored();
    if (cost > 0) await actor.update({ 'system.karma.pool': Math.max(0, Math.floor(Number(actor.system?.karma?.pool ?? 0)) - cost) });
    return { ok: true };
  }
  if (op === 'leave') {
    const mode: C.TeamLeaveMode = data?.mode === 'died' ? 'died' : data?.mode === 'share' && RULES.CORE_V95.teamKarmaGoodTerms ? 'share' : 'half';
    const r = C.teamLeave(team, actorId, mode);
    if (!r.ok) return why(r.why);
    if (!(await store(r.team, tx('SR2E.Core95.Team.left', { name: name || escHtml(actorId), lost: Number(r.lost ?? 0), pool: r.team.pool })))) return notStored();
    return { ok: true };
  }
  if (op === 'refresh') {
    if (team.spent > 0 && !(await store(C.teamRefresh(team), tx('SR2E.Core95.Team.refreshed', { pool: team.pool })))) return notStored();
    return { ok: true };
  }
  if (op === 'adjust') {
    const r = C.teamAdjust(team, int(data?.delta, -99, 99, 0));
    if (!r.ok) return why(r.why);
    if (!(await store(r.team, tx('SR2E.Core95.Team.set', { who, pool: r.team.pool })))) return notStored();
    return { ok: true };
  }
  return { ok: false };
}

/** The Karma Pools were refreshed for everyone (the GM): the team pool too. */
export async function teamRefreshAll(): Promise<void> {
  if (!C.teamBook() || !isGm() || teamNow().spent <= 0) return;
  await gmRun('teamKarma', { op: 'refresh' });
}

/** The characters a user may act for in the Team Karma window: the members they own (a GM: all). */
function myMembers(team: C.TeamPool): any[] {
  return team.members.map((id) => G().actors?.get?.(id)).filter((a: any) => a && (isGm() || a.isOwner));
}

/** The Team Karma window's body with the book's pool. */
export function teamWindowHtml(): string {
  const team = teamNow();
  const gm = isGm();
  const left = C.teamLeft(team);
  const leaveButton = (id: string): string => (gm ? ` <button type="button" data-action="tk95" data-op="leave" data-actor-id="${escHtml(id)}">${tx('SR2E.Core95.Team.leaves')}</button>` : '');
  const row = (id: string): string => `<li>${escHtml(String(G().actors?.get?.(id)?.name ?? id))}${leaveButton(id)}</li>`;
  const rows = team.members.map(row).join('');
  const mine = myMembers(team);
  const outsiders = gm ? [...(G().actors ?? [])].filter((a: any) => a.type === 'character' && a.hasPlayerOwner && !team.members.includes(String(a.id))) : [];
  const option = (a: any): string => `<option value="${escHtml(String(a.id))}">${escHtml(String(a.name))}</option>`;
  const options = (list: any[]): string => list.map(option).join('');
  const list = rows ? `<ul class="sr2e-team-karma-members">${rows}</ul>` : `<p class="hint">${tx('SR2E.Core95.Team.noMembers')}</p>`;
  const giving = `<div class="form-group"><label>${tx('SR2E.Core95.Team.as')}</label><select name="tk95-actor">${options(mine)}</select></div>
    <div class="sr2e-team-karma-buttons">
      <button type="button" data-action="tk95" data-op="give" title="${escHtml(tx('SR2E.Core95.Team.giveHint'))}">${tx('SR2E.Core95.Team.give')}</button>
    </div>`;
  const joinOff = outsiders.length ? '' : 'disabled';
  const refreshOff = team.spent > 0 ? '' : 'disabled';
  const minusOff = team.pool > 0 ? '' : 'disabled';
  const gmPart = `<hr><div class="form-group"><label>${tx('SR2E.Core95.Team.add')}</label><select name="tk95-join">${options(outsiders)}</select></div>
    <div class="sr2e-team-karma-buttons">
      <button type="button" data-action="tk95" data-op="join" ${joinOff} title="${escHtml(tx('SR2E.Core95.Team.joinHint', { n: Number(RULES.CORE_V95.teamKarmaJoin) || 0, start: Number(RULES.CORE_V95.teamKarmaStart) || 0 }))}">${tx('SR2E.Core95.Team.join')}</button>
      <button type="button" data-action="tk95" data-op="refresh" ${refreshOff}>${tx('SR2E.Core95.Team.refresh')}</button>
      <button type="button" data-action="tk95" data-op="minus" aria-label="${escHtml(tx('SR2E.App.TeamKarma.minus'))}" ${minusOff}>−</button>
      <button type="button" data-action="tk95" data-op="plus" aria-label="${escHtml(tx('SR2E.App.TeamKarma.plus'))}">+</button>
    </div>`;
  return `<div class="sr2e-team-karma-body">
    <div class="sr2e-team-karma-count" aria-live="polite"><b>${left}</b><span>${tx('SR2E.Core95.Team.count', { pool: team.pool })}</span></div>
    ${list}${mine.length ? giving : ''}${gm ? gmPart : ''}
    <p class="hint">${tx('SR2E.Core95.Team.agree')}</p>
  </div>`;
}

let teamBusy = false;

/** A button in the Team Karma window (book pool). */
export async function teamWindowAction(target: HTMLElement, root: HTMLElement | null): Promise<void> {
  if (teamBusy) return;
  teamBusy = true;
  try {
    const op = String(target?.dataset?.['op'] ?? '');
    const picked = (name: string): string => String(((root ? root.querySelector(`select[name="${name}"]`) : null) as HTMLSelectElement | null)?.value ?? '');
    let data: Record<string, unknown> | null = null;
    if (op === 'give') {
      const a: any = G().actors?.get?.(picked('tk95-actor'));
      const ok = a && await dialogs()?.confirm?.({ window: { title: tx('SR2E.Core95.Team.give') }, content: `<p>${tx('SR2E.Core95.Team.giveAsk', { name: escHtml(String(a.name)), own: Math.max(0, Math.floor(Number(a.system?.derived?.karmaPoolLeft ?? 0))) })}</p>`, rejectClose: false });
      if (ok) data = { op, actorId: String(a.id), n: 1 };
    } else if (op === 'join') data = { op, actorId: picked('tk95-join') };
    else if (op === 'refresh') data = { op };
    else if (op === 'minus' || op === 'plus') data = { op: 'adjust', delta: op === 'plus' ? 1 : -1 };
    else if (op === 'leave') {
      const id = String(target.dataset['actorId'] ?? '');
      const name = escHtml(String(G().actors?.get?.(id)?.name ?? id));
      const team = teamNow();
      const half = Number(C.teamLeave(team, id, 'half').lost ?? 0), share = Number(C.teamLeave(team, id, 'share').lost ?? 0);
      const mode = await dialogs()?.wait?.({
        window: { title: tx('SR2E.Core95.Team.leaveTitle') },
        content: `<p>${tx('SR2E.Core95.Team.leaveAsk', { name })}</p>`,
        buttons: [
          { action: 'half', label: tx('SR2E.Core95.Team.leaveHalf', { lost: half }), default: true },
          ...(RULES.CORE_V95.teamKarmaGoodTerms ? [{ action: 'share', label: tx('SR2E.Core95.Team.leaveShare', { lost: share }) }] : []),
          { action: 'died', label: tx('SR2E.Core95.Team.leaveDied') },
          { action: 'cancel', label: tx('SR2E.Core95.cancel') },
        ],
        rejectClose: false,
      });
      if (mode === 'half' || mode === 'share' || mode === 'died') data = { op, actorId: id, mode };
    }
    if (!data) return;
    const res = await gmRun('teamKarma', data);
    if (!res.ok && res.note) warn(escHtml(res.note));
  } finally { teamBusy = false; }
}

// ================================================================ Racism and Charisma

export const RACISM_FLAG = 'racism95';

export const racismOfActor = (npc: any): C.Racism | null => C.racismOf(npc?.getFlag?.(SYSTEM_ID, RACISM_FLAG) ?? npc?.flags?.[SYSTEM_ID]?.[RACISM_FLAG]);

/** The GM rolls an NPC's racism (2D6 − 6, then the Racism Table) and keeps it on the NPC; a whispered card says what. */
export async function rollRacism(npc: any): Promise<C.Racism | null> {
  if (!isGm() || !npc || !C.racismBook()) return null;
  const rolls: any[] = [];
  const two = await d6(2, rolls);
  const points = C.racismPoints(two.reduce((a, b) => a + b, 0));
  const own = String(npc.system?.metatype ?? 'human').toLowerCase();
  let bias = { all: false, against: [] as string[], used: 0, done: points <= 0 };
  const seen: number[] = [];
  for (let i = 0; i < 40 && !bias.done; i++) { seen.push(...(await d6(1, rolls))); bias = C.racismBias(seen, own); }
  const racism: C.Racism = { points, all: bias.all, against: bias.against, own, at: Date.now() };
  await replaceFlag(npc, RACISM_FLAG, racism as unknown as Record<string, unknown>);
  await post(`<p><em>${tx('SR2E.Core95.gmOnly')}</em> · <strong>${escHtml(String(npc.name))}</strong>: ${racismText(racism)}</p>`, { whisper: gmIds(), rolls });
  return racism;
}

/** "Racism (Orks, Trolls) +3", or "no racism". */
export function racismText(r: C.Racism | null): string {
  if (!r || !r.points) return tx('SR2E.Core95.Racism.none');
  const whom = r.all ? tx('SR2E.Core95.Racism.all') : r.against.map((m) => escHtml(metatypeLabel(m))).join(', ');
  return tx('SR2E.Core95.Racism.line', { whom, points: r.points });
}

/** The GM clears an NPC's racism (the metatype table stands in again). */
export async function clearRacism(npc: any): Promise<void> {
  if (!isGm() || !npc) return;
  await replaceFlag(npc, RACISM_FLAG, { points: 0, all: false, against: [], own: String(npc.system?.metatype ?? 'human').toLowerCase(), at: 0 });
}

/** Where the GM keeps the Charisma tests' results: on the NPC (players can't write it), by the speaker's id. */
const OFFSETS_FLAG = 'racismOffsets95';
const speakerKey = (speaker: any): string => String(memberId(speaker) || speaker?.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
const offsetOf = (speaker: any, npc: any, r: C.Racism): number | null => {
  const o: any = (npc?.getFlag?.(SYSTEM_ID, OFFSETS_FLAG) ?? npc?.flags?.[SYSTEM_ID]?.[OFFSETS_FLAG])?.[speakerKey(speaker)];
  return o && Number(o.at) === r.at ? Math.max(0, Math.floor(Number(o.n) || 0)) : null;
};

/**
 * The social test's racism row for `speaker` talking to `npc`: null when the book's rule does not apply here (the
 * metatype table stands in), else the modifier (or none: `{ mod: null }`). `preview`: a player's dialog preview,
 * which never shows it (the points are known only to the GM, Core p. 182); the GM's preview does.
 */
/** The racism row's modifier id (Core p. 182: the target number is known only to the GM). */
export const RACISM_MOD_ID = 'racism95';

export function racismFor(speaker: any, npc: any, preview = false): { mod: TargetNumberModifier | null } | null {
  if (!C.racismBook()) return null;
  const r = racismOfActor(npc);
  if (!r || !r.at) return null;
  if (preview && !isGm()) return { mod: null };
  const points = C.racismVs(r, speaker?.system?.metatype);
  const left = C.racismAfter(points, offsetOf(speaker, npc, r) ?? 0);
  // Its own id (RACISM_MOD_ID): a player's card that carries it hides its numbers (applications/hidden941.ts).
  return { mod: left > 0 ? { id: RACISM_MOD_ID, label: tx('SR2E.Core95.Racism.mod', { name: String(npc?.name ?? '') }), value: left } : null };
}

/**
 * Before a social test: the speaker's secret Charisma test against twice the NPC's racism, once per NPC (each success
 * takes a point off). Rolled on the GM's client (the relay), the result kept on the NPC, the card to the GM only. Not
 * rolled when the speaker has no rating in the social skill (they default to Charisma).
 */
export async function racismCharisma(speaker: any, npc: any, skillName: string): Promise<void> {
  if (!C.racismBook() || !speaker || !npc) return;
  const r = racismOfActor(npc);
  if (!r || !r.at || C.racismVs(r, speaker.system?.metatype) <= 0 || offsetOf(speaker, npc, r) !== null) return;
  await gmRun('core95', { op: 'racism', speakerUuid: String(speaker.uuid ?? ''), npcUuid: String(npc.uuid ?? ''), skillName: String(skillName ?? '').slice(0, 80) });
}

/** The GM's side of the Charisma test (as `user`, the socket's sender). */
async function racismCharismaGm(data: Record<string, any>, user: any): Promise<{ ok: boolean; note?: string }> {
  const find = (u: unknown): any => (typeof u === 'string' && u.length < 400 ? (globalThis as any).fromUuidSync?.(u) : null);
  const speaker = find(data?.speakerUuid), npc = find(data?.npcUuid);
  if (!speaker || !npc || !C.racismBook()) return { ok: false };
  if (!user?.isGM && !speaker.testUserPermission?.(user, 'OWNER')) return why('SR2E.Core95.Team.Why.notYours');
  const r = racismOfActor(npc);
  if (!r || !r.at) return { ok: true };
  const points = C.racismVs(r, speaker.system?.metatype);
  if (points <= 0 || offsetOf(speaker, npc, r) !== null) return { ok: true };
  const skill: any = typeof speaker.findSkill === 'function' ? speaker.findSkill(String(data?.skillName ?? '')) : null;
  if (!(Number(skill?.system?.rating ?? 0) > 0)) return { ok: true };
  const rolls: any[] = [];
  const dice = Math.max(0, Math.floor(Number(speaker.system?.attributes?.charisma?.total ?? 0)));
  const tn = C.racismCharismaTn(points);
  const res = await successTest({ dice, targetNumber: tn, modifiers: [], roll: roller(rolls) });
  const n = Math.min(points, Math.max(0, Number(res.successes) || 0));
  await npc.update({ [`flags.${SYSTEM_ID}.${OFFSETS_FLAG}.${speakerKey(speaker)}`]: { n, at: r.at } });
  await post(`<p><em>${tx('SR2E.Core95.gmOnly')}</em> · ${tx('SR2E.Core95.Racism.charisma', { speaker: escHtml(String(speaker.name)), npc: escHtml(String(npc.name)), dice, tn, rolled: escHtml(diceText(res)), n, left: C.racismAfter(points, n) })}</p>`,
    { whisper: gmIds(), rolls });
  return { ok: true };
}

/** The 'core95' relay: the Charisma test against racism, and the GM's card after legwork. */
export async function core95Relay(data: Record<string, any>, user: any): Promise<{ ok: boolean; note?: string }> {
  const op = String(data?.op ?? '');
  if (op === 'racism') return racismCharismaGm(data, user);
  if (op === 'legwork') return afterLegworkGm(data, user);
  return { ok: false };
}

// ================================================================ Training

const MARK_FLAG = 'training95';
export const trainingMark = (actor: any, id: string): { self: number | null; help: number } => C.trainingMarkOf(actor?.getFlag?.(SYSTEM_ID, MARK_FLAG)?.[id]);

/**
 * The "Instructor" button with the book's training tests: the student's own test first (once), then the instructor.
 * True when this handled the click (the self-test was rolled or the dialog closed); false: go on to the instructor.
 */
export async function trainingChoice(actor: any, trainingId: string): Promise<boolean> {
  if (!C.trainingBook()) return false;
  const t: any = [...(actor?.system?.training ?? [])].find((x: any) => x.id === trainingId);
  if (!t) return false;
  const mark = trainingMark(actor, trainingId);
  const tn = C.trainingSelfTn({ attribute: Boolean(t.attribute), to: Number(t.to) });
  const pick = await dialogs()?.wait?.({
    window: { title: tx('SR2E.Core95.Training.title') },
    content: `<p>${tx('SR2E.Core95.Training.ask', { label: escHtml(String(t.label)), tn })}</p>${mark.self !== null ? `<p class="hint">${tx('SR2E.Core95.Training.rolled', { self: mark.self, help: mark.help })}</p>` : ''}`,
    buttons: [
      ...(mark.self === null ? [{ action: 'self', label: tx('SR2E.Core95.Training.self'), default: true }] : []),
      { action: 'teacher', label: tx('SR2E.Core95.Training.teacher'), default: mark.self !== null },
      { action: 'cancel', label: tx('SR2E.Core95.cancel') },
    ],
    rejectClose: false,
  });
  if (pick === 'teacher') return false;
  if (pick === 'self') await trainingSelfTest(actor, trainingId);
  return true;
}

/** The student's own training test (Companion p. 50): its successes divide the base time. */
export async function trainingSelfTest(actor: any, trainingId: string): Promise<SuccessTestResult | null> {
  const t: any = [...(actor?.system?.training ?? [])].find((x: any) => x.id === trainingId);
  if (!t || !C.trainingBook() || typeof actor.core95Test !== 'function') return null;
  const tn = C.trainingSelfTn({ attribute: Boolean(t.attribute), to: Number(t.to) });
  const skill: any = t.skillId ? actor.items?.get?.(t.skillId) : null;
  const sd = t.attribute ? { dice: Math.max(0, Math.floor(Number(actor.system?.attributes?.[t.attribute]?.total ?? 0))), modifiers: [] as TargetNumberModifier[], suffix: '' } : actor.core95Dice(String(skill?.name ?? ''), 'intelligence');
  const label = tx('SR2E.Core95.Training.testLabel', { label: String(t.label), suffix: String(sd.suffix ?? '') });
  return actor.core95Test(label, sd.dice, { targetNumber: tn, modifiers: [...sd.modifiers] }, { kind: 'trainSelf', trainingId, baseDays: Number(t.baseDays || t.days || 0), startedAt: Number(t.startedAt ?? 0) });
}

/** What the days of a training come to with its stored tests, and the update that writes them. */
async function retime(student: any, trainingId: string, mark: { self: number | null; help: number }): Promise<number | null> {
  const list: any[] = [...(student?.system?.training ?? [])].map((x: any) => ({ ...x }));
  const e = list.find((x: any) => x.id === trainingId);
  if (!e) return null;
  const days = C.trainingDays95({ baseDays: Number(e.baseDays || e.days || 0), self: mark.self, help: mark.help });
  e.days = days;
  e.readyAt = Number(e.startedAt ?? 0) + days * 86400;
  await student.update({ 'system.training': list, [`flags.${SYSTEM_ID}.${MARK_FLAG}.${trainingId}`]: { self: mark.self, help: mark.help } });
  return days;
}

/** A CORE_V95 test's follow-up on its card (run again after a Karma re-roll): the training self-test. */
export async function testExtras(actor: any, c95: any, successes: number, canWrite: boolean): Promise<string> {
  if (c95?.kind !== 'trainSelf' || !C.trainingBook()) return '';
  const id = String(c95.trainingId ?? '').slice(0, 64);
  if (!canWrite) return `<p><em>${tx('SR2E.Core95.Training.notYours')}</em></p>`;
  const s = int(successes, 0, 99);
  const days = await retime(actor, id, { self: s, help: trainingMark(actor, id).help });
  if (days === null) return `<p><em>${tx('SR2E.Core95.Training.gone')}</em></p>`;
  return `<p>${(s > 0 ? tx('SR2E.Core95.Training.selfDone', { days }) : tx('SR2E.Core95.Training.selfFailed', { days }))}</p>`;
}

/**
 * An instructor's test with the book's rule: one success more for the student per two of the instructor's. Null when
 * the rule is off (the caller's own result stands), else the card's line; the student's training is re-timed here.
 */
export async function instruction(student: any, ins: { trainingId: string; instructorName: string; instructorRating: number; newRating: number; attribute?: boolean; readyAt?: number }, successes: number, canWrite: boolean, instruction?: number): Promise<{ html: string; days: number; readyAt?: number } | null> {
  if (!C.trainingBook()) return null;
  const id = String(ins.trainingId ?? '').slice(0, 64);
  const usable = Boolean(ins.attribute) || Number(ins.instructorRating) >= Number(ins.newRating);
  const who = escHtml(String(ins.instructorName ?? ''));
  const e: any = [...(student?.system?.training ?? [])].find((x: any) => x.id === id);
  if (!student || !e) return { html: `<p><em>${tx('SR2E.Core95.Training.gone')}</em></p>`, days: 0 };
  if (!usable) return { html: `<p><em>${tx('SR2E.Core95.Training.unqualified', { who, rating: int(ins.instructorRating, 0, 99), need: int(ins.newRating, 0, 99) })}</em></p>`, days: Number(e.days) || 0 };
  if (!canWrite) return { html: `<p><em>${tx('SR2E.Core95.Training.notYours')}</em></p>`, days: Number(e.days) || 0 };
  const help = C.instructorHelp(int(successes, 0, 99));
  // As v0.94.2: this card's earlier result (readyAt) must still be the training's, or something newer changed it.
  const mark = trainingMark(student, id);
  const want = Number(e.startedAt ?? 0) + C.trainingDays95({ baseDays: Number(e.baseDays || e.days || 0), self: mark.self, help }) * 86400;
  if (ins.readyAt !== undefined && Number(e.readyAt) !== Number(ins.readyAt) && Number(e.readyAt) !== want) {
    return { html: `<p><em>${tx('SR2E.Card.Actor.theTrainingChangedSinceThisWas')}</em></p>`, days: Number(e.days) || 0, readyAt: Number(ins.readyAt) };
  }
  const days = (await retime(student, id, { self: mark.self, help })) ?? 0;
  const fee = instruction ? tx('SR2E.Core95.Training.fee', { fee: C.instructorFee(int(instruction, 0, 99)) }) : '';
  return { html: `<p>${(help > 0 ? tx('SR2E.Core95.Training.helped', { who, help, days }) : tx('SR2E.Core95.Training.noHelp', { who, help, days }))}${fee}</p>`, days, readyAt: want };
}

// ================================================================ Jumping and the water tests

/** The Athletics dialog's extra rows (jumping the book's way; treading water and floating). */
export function athleticsRows(actor: any): string {
  const jump = C.jumpBook(), swim = C.swimBook();
  if (!jump && !swim) return '';
  const a = actor?.system?.attributes ?? {};
  const base = (running: boolean): number => C.jumpBase({ strength: Number(a.strength?.total ?? 0), bodyNatural: Number(a.body?.natural ?? a.body?.base ?? a.body?.total ?? 0), quickness: Number(a.quickness?.total ?? 0), running });
  const rows = RULES.CORE_V95.treadModifiers.map((r) => `<label class="sr2e-check"><input type="checkbox" name="tread95" value="${escHtml(r.id)}"> ${escHtml(C.treadLabel(r.id))} (${r.value > 0 ? '+' : ''}${r.value})</label>`).join('');
  return `${jump ? `<fieldset><legend>${tx('SR2E.Core95.Athletics.jumpLegend')}</legend>
      <div class="form-group"><label>${tx('SR2E.Core95.Athletics.clear')}</label><input name="jump95" type="number" min="0" step="0.5" value="0"></div>
      <label class="sr2e-check"><input type="checkbox" name="vertical95"> ${tx('SR2E.Core95.Athletics.vertical')}</label>
      <p class="hint">${tx('SR2E.Core95.Athletics.jumpHint', { standing: base(false), running: base(true) })}</p></fieldset>` : ''}
    ${swim ? `<fieldset><legend>${tx('SR2E.Core95.Athletics.waterLegend')}</legend>
      <div class="form-group"><label>${tx('SR2E.Core95.Athletics.water')}</label><select name="water95"><option value="swim">${tx('SR2E.Core95.Athletics.swim', { tn: Number(RULES.CORE_V95.swimTn) })}</option><option value="tread">${tx('SR2E.Core95.Athletics.tread', { tn: Number(RULES.CORE_V95.treadTn) })}</option><option value="float">${tx('SR2E.Core95.Athletics.float', { tn: Number(RULES.CORE_V95.floatTn) })}</option></select></div>
      ${rows}<p class="hint">${tx('SR2E.Core95.Athletics.waterHint')}</p></fieldset>` : ''}`;
}

export interface Athletics95 { metres: number; vertical: boolean; water: C.SwimMode; tread: string[] }

/** What the Athletics dialog's extra rows hold. */
export function readAthletics(form: any): Athletics95 {
  const e = form?.elements ?? {};
  const water = String(e.water95?.value ?? 'swim');
  return {
    metres: Math.max(0, Math.min(1000, Number(e.jump95?.value) || 0)), vertical: Boolean(e.vertical95?.checked),
    water: water === 'tread' || water === 'float' ? water : 'swim',
    tread: [...(form && typeof form.querySelectorAll === 'function' ? form.querySelectorAll('input[name="tread95"]:checked') : [])].map((x: any) => String(x.value)),
  };
}

const waterMods = (list: TargetNumberModifier[]): TargetNumberModifier[] => list;

/**
 * The plan of an Athletics test the book's way: null when the old test stands (climbing, or the switches off), else
 * the target number, the label and modifiers. Floating is not an Athletics test (`float`): see `floatTest`.
 */
export function athleticsPlan(actor: any, kind: string, running: boolean, c95: Athletics95 | null | undefined): { tn: number; label: string; modifiers: TargetNumberModifier[]; base?: number; want?: number; mode: 'jump' | C.SwimMode } | null {
  const a = actor?.system?.attributes ?? {};
  if (kind === 'jump' && C.jumpBook()) {
    const strength = Number(a.strength?.total ?? 0), body = Number(a.body?.total ?? 0);
    const base = C.jumpBase({ strength, bodyNatural: Number(a.body?.natural ?? a.body?.base ?? body), quickness: Number(a.quickness?.total ?? 0), running, vertical: Boolean(c95?.vertical) });
    const want = Math.max(base, Number(c95?.metres) || 0);
    return { mode: 'jump', tn: C.jumpTn(want, strength, body), label: tx('SR2E.Core95.Athletics.jumpLabel', { want }), modifiers: [], base, want };
  }
  if (kind === 'swim' && C.swimBook()) {
    const mode = c95?.water ?? 'swim';
    const w = C.waterTest(mode, actor?.system?.metatype, c95?.tread ?? []);
    return { mode, tn: w.tn, label: mode === 'tread' ? tx('SR2E.Core95.Athletics.treadLabel') : mode === 'float' ? tx('SR2E.Core95.Athletics.floatLabel') : tx('SR2E.Core95.Athletics.swimLabel'), modifiers: waterMods(w.modifiers) };
  }
  return null;
}

/** The card line after a book jump or a treading-water test ('' for a plain swim: the old distance line follows). */
export function athleticsOutcome(actor: any, plan: { mode: string; base?: number; want?: number }, successes: number): string | null {
  const name = escHtml(String(actor?.name ?? ''));
  const s = int(successes, 0, 99);
  if (plan.mode === 'jump') {
    const metres = C.jumpDistance(Number(plan.base) || 0, s), want = Number(plan.want) || 0;
    return `<p>${name}: ${(metres + 1e-9 >= want ? tx('SR2E.Core95.Athletics.jumped', { metres, want }) : tx('SR2E.Core95.Athletics.short', { metres, want }))}</p>`;
  }
  if (plan.mode === 'tread') return `<p>${name}: ${(s > 0 ? tx('SR2E.Core95.Athletics.treads') : tx('SR2E.Core95.Athletics.sinks'))}</p>`;
  return null;
}

/** Floating (Cyberpirates p. 156): Body against 4 with the treading-water table; Body × successes Combat Turns. */
export async function floatTest(actor: any, c95: Athletics95, extra: TargetNumberModifier[] = []): Promise<void> {
  const w = C.waterTest('float', actor?.system?.metatype, c95.tread);
  const r = await actor.rollAttribute('body', { targetNumber: w.tn, modifiers: [...waterMods(w.modifiers), ...extra] });
  if (!r) return;
  const turns = C.floatTurns(Number(actor.system?.attributes?.body?.total ?? 0), Number(r.successes) || 0);
  await post(`<p>${escHtml(String(actor.name))}: ${(turns > 0 ? tx('SR2E.Core95.Athletics.floats', { turns }) : tx('SR2E.Core95.Athletics.sinks'))}</p>`, { speaker: (globalThis as any).ChatMessage.getSpeaker({ actor }) });
}

// ================================================================ Lifestyle

const MISSED_FLAG = 'lifestyle95';
const DEBT_FLAG = 'lifestyleDebt95';

/**
 * The GM's tick with the book's missed payments: true when this handled the actor (the old grace-days rule is
 * skipped). Each month missed in a row: 1D6; above the months it is absorbed, else the lifestyle drops (as
 * RULES.UPKEEP.effects.overdue says: by itself, or a GM card) and a month of the old lifestyle is owed.
 */
export async function lifestyleTick(a: any): Promise<boolean> {
  if (!C.missedBook()) return false;
  if (RULES.UPKEEP.effects.overdue === 'off') return true;
  const st = a.lifestyleStatus?.();
  const level = String(a.system?.lifestyle?.level ?? '');
  const order = RULES.UPKEEP.lifestyles.map((l) => l.id);
  if (!st || st.permanent || st.days == null || st.days >= 0 || level === order[0]) return true;
  const key = Number(a.system?.lifestyle?.paidUntil ?? -1);
  const mark = C.missedMarkOf(a.getFlag?.(SYSTEM_ID, MISSED_FLAG), key, level);
  const here = C.monthsMissed(-Number(st.days), Number(RULES.UPKEEP.monthDays));
  if (here <= mark.rolled) return true;
  // Claimed first (one roll per month, however many GM windows tick), then one 1D6 for each month not rolled yet.
  try { await a.setFlag(SYSTEM_ID, MISSED_FLAG, { key, level, rolled: here, carried: mark.carried }); } catch { return true; }
  const name = escHtml(String(a.name));
  const speaker = (globalThis as any).ChatMessage.getSpeaker({ actor: a });
  for (let m = mark.rolled + 1; m <= here; m++) {
    const months = mark.carried + m;
    const rolls: any[] = [];
    const die = (await d6(1, rolls))[0] ?? 1;
    if (C.missedAbsorbed(die, months)) {
      await post(`<p>${tx('SR2E.Core95.Lifestyle.absorbed', { name, label: escHtml(String(st.label)), months, die })}</p>`, { speaker, rolls });
      continue;
    }
    // Dropped: the months so far are kept for the lower level (missedMarkOf carries them on there).
    await a.setFlag(SYSTEM_ID, MISSED_FLAG, { key, level, rolled: m, carried: mark.carried });
    const debt = Math.max(0, Math.floor(Number(st.cost) || 0));
    const owed = Math.max(0, Math.floor(Number(a.getFlag?.(SYSTEM_ID, DEBT_FLAG) ?? 0))) + debt;
    await a.setFlag(SYSTEM_ID, DEBT_FLAG, owed);
    const text = `<p>${tx('SR2E.Core95.Lifestyle.dropped', { name, label: escHtml(String(st.label)), months, die, debt })}</p><p><button type="button" data-sr2e-action="c95PayDebt">${tx('SR2E.Core95.Lifestyle.payDebt', { debt })}</button></p>`;
    if (RULES.UPKEEP.effects.overdue === 'auto') {
      await post(text, { speaker, rolls, flags: { [SYSTEM_ID]: { c95Debt: { actorUuid: a.uuid, amount: debt } } } });
      await a.moveLifestyleDown(tx('SR2E.Core95.Lifestyle.reason', { months }));
    } else {
      const down = order[Math.max(0, order.indexOf(level) - 1)] ?? level;
      const label = escHtml(String(RULES.UPKEEP.lifestyles.find((l) => l.id === down)?.label ?? down));
      await post(`${text}<p><em>${tx('SR2E.Core95.gmOnly')}</em> <button type="button" data-sr2e-action="evict">${tx('SR2E.Core95.Lifestyle.moveDown', { label })}</button></p>`,
        { speaker, rolls, whisper: [...new Set([...gmIds(), ...[...(G().users ?? [])].filter((u: any) => !u.isGM && a.testUserPermission?.(u, 'OWNER')).map((u: any) => String(u.id))])], flags: { [SYSTEM_ID]: { evict: { actorUuid: a.uuid, from: level }, c95Debt: { actorUuid: a.uuid, amount: debt } } } });
    }
    break;
  }
  return true;
}

let selling = false;

/**
 * Selling a lifestyle owned outright (Core p. 190). True when this handled the Pay button (sold, or the dialog was
 * closed); false when it can't be sold here (the caller says "owned outright" as before). The character moves to a
 * lower lifestyle the player picks (Street by default), from now. One sale at a time, checked again after the dialog.
 */
export async function sellLifestyle(actor: any): Promise<boolean> {
  const level = String(actor?.system?.lifestyle?.level ?? '');
  const order = RULES.UPKEEP.lifestyles.map((l) => l.id);
  if (!actor?.system?.lifestyle?.outright || !C.canSellLifestyle(level, order)) return false;
  if (selling) return true;
  selling = true;
  try {
    const life: any = RULES.UPKEEP.lifestyles.find((l) => l.id === level);
    const price = Math.max(0, Number(life?.cost) || 0) * Math.max(0, Number(RULES.STREET_V61.creation.lifestyleOutright.months) || 0);
    const label = escHtml(String(life?.label ?? level));
    const lower = RULES.UPKEEP.lifestyles.slice(0, Math.max(0, order.indexOf(level)));
    const options = lower.map((l, i) => `<option value="${escHtml(l.id)}" ${i === 0 ? 'selected' : ''}>${escHtml(l.label)}</option>`).join('');
    const pick = await dialogs()?.wait?.({
      window: { title: tx('SR2E.Core95.Lifestyle.sellTitle') },
      content: `<p>${tx('SR2E.Core95.Lifestyle.sellAsk', { name: escHtml(String(actor.name)), label, price: escHtml(price.toLocaleString()) })}</p><p class="hint">${tx('SR2E.Core95.Lifestyle.sellHint')}</p>
        <div class="form-group"><label>${tx('SR2E.Core95.Lifestyle.moveTo')}</label><select name="to">${options}</select></div>`,
      buttons: [
        { action: 'two', label: tx('SR2E.Core95.Lifestyle.sellTwo'), callback: (_e: Event, b: any) => ({ dice: 2, to: String(b.form?.elements?.to?.value ?? '') }) },
        { action: 'one', label: tx('SR2E.Core95.Lifestyle.sellOne'), callback: (_e: Event, b: any) => ({ dice: 1, to: String(b.form?.elements?.to?.value ?? '') }) },
        { action: 'cancel', label: tx('SR2E.Core95.cancel'), default: true, callback: () => null },
      ],
      rejectClose: false,
    }) as { dice: number; to: string } | null;
    if (!pick || (pick.dice !== 1 && pick.dice !== 2)) return true;
    // Checked again: still owned outright at the same level (another window may have sold it meanwhile).
    if (!actor.system?.lifestyle?.outright || String(actor.system?.lifestyle?.level ?? '') !== level) return true;
    const to = lower.some((l) => l.id === pick.to) ? pick.to : (lower[0]?.id ?? level);
    const rolls: any[] = [];
    const dice = await d6(pick.dice, rolls);
    const total = dice.reduce((x, y) => x + y, 0);
    const paid = C.lifestyleSale(price, total);
    await actor.update({ 'system.lifestyle.outright': false, 'system.lifestyle.level': to, 'system.lifestyle.paidUntil': now() });
    if (paid > 0) await actor.adjustNuyen(paid, tx('SR2E.Core95.Lifestyle.soldLedger', { label: String(life?.label ?? level) }));
    const toLabel = escHtml(String(RULES.UPKEEP.lifestyles.find((l) => l.id === to)?.label ?? to));
    await post(`<p>${tx('SR2E.Core95.Lifestyle.sold', { name: escHtml(String(actor.name)), label, total, percent: total * 10, paid: escHtml(paid.toLocaleString()), to: toLabel })}</p>`, { speaker: (globalThis as any).ChatMessage.getSpeaker({ actor }), rolls });
    return true;
  } finally { selling = false; }
}

// ================================================================ Contacts

const UPKEEP_FLAG = 'contactUpkeep95';
const PAID_FLAG = 'paid95';
const PAID_KEEP = 50;
const DONE_FLAG = 'c95Done';

/**
 * After legwork (Core p. 200): a card for the GM alone, with buttons to set the meet (its secret base time is rolled
 * then) and to work out the contact's fee. Posted by the GM's client (the relay), so the asking player never sees it.
 */
export async function afterLegwork(actor: any, contact: any, successes: number): Promise<void> {
  if ((!C.meetBook() && !C.feeBook()) || !actor || !contact) return;
  await gmRun('core95', { op: 'legwork', actorUuid: String(actor.uuid ?? ''), contactId: String(contact.id ?? '').slice(0, 64), successes: int(successes, 0, 99) });
}

/** The GM's side of the legwork card (as `user`, the socket's sender: they must own the character). */
async function afterLegworkGm(data: Record<string, any>, user: any): Promise<{ ok: boolean; note?: string }> {
  const meet = C.meetBook(), fee = C.feeBook();
  const actor: any = typeof data?.actorUuid === 'string' && data.actorUuid.length < 400 ? (globalThis as any).fromUuidSync?.(data.actorUuid) : null;
  if ((!meet && !fee) || !actor) return { ok: false };
  if (!user?.isGM && !actor.testUserPermission?.(user, 'OWNER')) return why('SR2E.Core95.Team.Why.notYours');
  const contact: any = [...(actor.system?.contacts ?? [])].find((c: any) => c.id === String(data?.contactId ?? ''));
  if (!contact) return { ok: false };
  const s = int(data?.successes, 0, 99);
  const name = escHtml(String(contact.name ?? ''));
  const buttons = [
    meet ? `<button type="button" data-sr2e-action="c95Meet">${tx('SR2E.Core95.Contact.meetButton')}</button>` : '',
    fee && s > 0 ? `<button type="button" data-sr2e-action="c95Fee">${tx('SR2E.Core95.Contact.feeButton')}</button>` : '',
  ].join(' ');
  await post(`<p><em>${tx('SR2E.Core95.gmOnly')}</em> · ${tx('SR2E.Core95.Contact.after', { actor: escHtml(String(actor.name)), name, s })}</p><p>${buttons}</p>`,
    { whisper: gmIds(), flags: { [SYSTEM_ID]: { c95Contact: { actorUuid: String(actor.uuid), contactId: String(contact.id ?? ''), name: String(contact.name ?? '').slice(0, 120), successes: s } } } });
  return { ok: true };
}

/** The GM's tick with contact upkeep on (Companion p. 62): a card for each contact whose year is up. */
export async function contactUpkeepTick(a: any): Promise<void> {
  if (!C.upkeepBook() || a?.type !== 'character' || !a.hasPlayerOwner || a.isToken) return;
  const contacts: any[] = [...(a.system?.contacts ?? [])];
  const marks = a.getFlag?.(SYSTEM_ID, UPKEEP_FLAG) as Record<string, unknown> | undefined;
  const r = C.upkeepDue(contacts, marks, now());
  if (!r.due.length && !r.changed) return;
  const next: Record<string, number> = { ...r.marks };
  for (const id of r.due) next[id] = now() + C.YEAR_SECONDS;
  await replaceFlag(a, UPKEEP_FLAG, next);
  for (const id of r.due) {
    const c = contacts.find((x: any) => x.id === id);
    const cost = C.contactUpkeepCost(Number(c?.level ?? 1));
    await post(`<p>${tx('SR2E.Core95.Contact.upkeepDue', { actor: escHtml(String(a.name)), name: escHtml(String(c?.name ?? '')), level: int(c?.level, 1, 3, 1), cost })}</p>
      <p><button type="button" data-sr2e-action="c95PayUpkeep">${tx('SR2E.Core95.Contact.payUpkeep', { cost })}</button> <button type="button" data-sr2e-action="c95LowerContact">${tx('SR2E.Core95.Contact.lower')}</button></p>`,
      { speaker: (globalThis as any).ChatMessage.getSpeaker({ actor: a }), flags: { [SYSTEM_ID]: { c95Upkeep: { actorUuid: String(a.uuid), contactId: String(id), cost } } } });
  }
}

/** Pay an amount named by a GM-posted card, once per card (the actor's `paid95` map remembers the card). */
async function payOnce(message: any, actor: any, amount: number, reason: string): Promise<boolean> {
  if (!authorIsGm(message)) { warn(tx('SR2E.Core95.notGmCard')); return false; }
  if (!actor?.isOwner) { warn(tx('SR2E.Core95.notYours')); return false; }
  const id = String(message?.id ?? '');
  if (!id || actor.getFlag?.(SYSTEM_ID, PAID_FLAG)?.[id]) { warn(tx('SR2E.Core95.alreadyPaid')); return false; }
  const n = int(amount, 0, 100_000_000);
  if (n > 0 && !(await actor.adjustNuyen(-n, reason))) return false;
  // Kept per card, the newest PAID_KEEP only (an older card paid again only costs its payer).
  const paid: Record<string, unknown> = { ...(actor.getFlag?.(SYSTEM_ID, PAID_FLAG) ?? {}), [id]: Date.now() };
  await replaceFlag(actor, PAID_FLAG, C.keepNewest(paid, PAID_KEEP));
  await post(`<p>${tx('SR2E.Core95.paid', { name: escHtml(String(actor.name)), n, reason: escHtml(reason) })}</p>`, { speaker: (globalThis as any).ChatMessage.getSpeaker({ actor }) });
  return true;
}

const numField = (label: string, name: string, value: number, max: number): string => `<div class="form-group"><label>${escHtml(label)}</label><input name="${name}" type="number" min="0" max="${max}" value="${value}"></div>`;
const postedBy = (message: any): string => authorIsGm(message) ? '' : `<p class="hint">${tx('SR2E.Core95.postedBy', { who: escHtml(String(cardAuthor(message)?.name ?? '')) })}</p>`;

/** A button on a CORE_V95 chat card. */
export async function onCard(message: any, button: HTMLButtonElement, action: string): Promise<void> {
  const flags: any = message?.flags?.[SYSTEM_ID] ?? {};
  const actorOf = async (uuid: unknown): Promise<any> => (typeof uuid === 'string' && uuid.length < 400 ? (globalThis as any).fromUuid(uuid) : null);
  if (action === 'c95PayDebt') {
    const d = flags.c95Debt;
    const actor = await actorOf(d?.actorUuid);
    if (!actor) return;
    button.disabled = true;
    const amount = int(d?.amount, 0, 100_000_000);
    if (await payOnce(message, actor, amount, tx('SR2E.Core95.Lifestyle.debtLedger'))) await actor.setFlag(SYSTEM_ID, DEBT_FLAG, Math.max(0, Math.floor(Number(actor.getFlag(SYSTEM_ID, DEBT_FLAG) ?? 0)) - amount));
    else button.disabled = false;
    return;
  }
  if (action === 'c95PayUpkeep' || action === 'c95PayFee') {
    const d = action === 'c95PayFee' ? flags.c95Fee : flags.c95Upkeep;
    const actor = await actorOf(d?.actorUuid);
    if (!actor) return;
    button.disabled = true;
    if (!(await payOnce(message, actor, int(action === 'c95PayFee' ? d?.fee : d?.cost, 0, 100_000_000), (action === 'c95PayFee' ? tx('SR2E.Core95.Contact.feeLedger') : tx('SR2E.Core95.Contact.upkeepLedger'))))) button.disabled = false;
    return;
  }
  // The rest is the GM's.
  if (!isGm()) { warn(tx('SR2E.Core95.gmButton')); return; }
  if (action === 'c95LowerContact') {
    const d = flags.c95Upkeep;
    if (!authorIsGm(message)) return;
    if (message.getFlag?.(SYSTEM_ID, DONE_FLAG)) { warn(tx('SR2E.Core95.alreadyDone')); return; }
    const actor = await actorOf(d?.actorUuid);
    const list: any[] = [...(actor?.system?.contacts ?? [])].map((x: any) => ({ ...x }));
    const c = list.find((x: any) => x.id === String(d?.contactId ?? ''));
    if (!actor || !c) return;
    button.disabled = true;
    await message.setFlag?.(SYSTEM_ID, DONE_FLAG, true);
    const lowered = Number(c.level) > 1;
    if (lowered) c.level = Number(c.level) - 1;
    await actor.update({ 'system.contacts': lowered ? list : list.filter((x: any) => x !== c) });
    await post(`<p>${(lowered ? tx('SR2E.Core95.Contact.lowered', { actor: escHtml(String(actor.name)), name: escHtml(String(c.name ?? '')), level: int(c.level, 1, 3, 1) }) : tx('SR2E.Core95.Contact.lost', { actor: escHtml(String(actor.name)), name: escHtml(String(c.name ?? '')) }))}</p>`);
    return;
  }
  const d = flags.c95Contact;
  if (!d) return;
  const actor = await actorOf(d.actorUuid);
  const name = escHtml(String(d.name ?? '').slice(0, 120));
  const s = int(d.successes, 0, 99);
  if (action === 'c95Meet') {
    // The secret base time (2D6 × 30 minutes) is rolled here, on the GM's client, when the GM sets the meet.
    const rolls: any[] = [];
    const base = C.meetBaseMinutes((await d6(2, rolls)).reduce((a, b) => a + b, 0));
    const r = await dialogs()?.prompt?.({
      window: { title: tx('SR2E.Core95.Contact.meetTitle') },
      content: `${postedBy(message)}<p>${tx('SR2E.Core95.Contact.meetAsk', { name, base, s })}</p>${numField(tx('SR2E.Core95.Contact.traded'), 'traded', 0, s)}`,
      ok: { label: tx('SR2E.Core95.Contact.meetOk'), callback: (_e: Event, b: any) => ({ traded: Number(b.form.elements.traded.value) || 0 }) },
      rejectClose: false,
    });
    if (!r) return;
    const traded = int(r.traded, 0, s);
    await post(`<p><em>${tx('SR2E.Core95.gmOnly')}</em> · ${tx('SR2E.Core95.Contact.meetSet', { actor: escHtml(String(actor?.name ?? '')), name, minutes: C.meetMinutes(base, traded), kept: s - traded })}</p>`, { whisper: gmIds(), rolls });
    return;
  }
  if (action === 'c95Fee') {
    const r = await dialogs()?.prompt?.({
      window: { title: tx('SR2E.Core95.Contact.feeTitle') },
      content: `${postedBy(message)}<p>${tx('SR2E.Core95.Contact.feeAsk', { name })}</p>${numField(tx('SR2E.Core95.Contact.etiquette'), 'etiquette', 3, 20)}${numField(tx('SR2E.Core95.Contact.successes'), 'successes', s, 99)}${numField(tx('SR2E.Core95.Contact.charisma'), 'charisma', 3, 20)}${numField(tx('SR2E.Core95.Contact.intelligence'), 'intelligence', 3, 20)}`,
      ok: { label: tx('SR2E.Core95.Contact.feeOk'), callback: (_e: Event, b: any) => { const e = b.form.elements; return { etiquette: Number(e.etiquette.value) || 0, successes: Number(e.successes.value) || 0, charisma: Number(e.charisma.value) || 0, intelligence: Number(e.intelligence.value) || 0 }; } },
      rejectClose: false,
    });
    if (!r || !actor) return;
    const fee = C.contactFee({ etiquette: int(r.etiquette, 0, 20), successes: int(r.successes, 0, 99), charisma: int(r.charisma, 0, 20), intelligence: int(r.intelligence, 0, 20) });
    await post(`<p>${tx('SR2E.Core95.Contact.feeIs', { actor: escHtml(String(actor.name)), name, fee })}</p><p><button type="button" data-sr2e-action="c95PayFee">${tx('SR2E.Core95.Contact.payFee', { fee })}</button></p>`,
      { flags: { [SYSTEM_ID]: { c95Fee: { actorUuid: String(actor.uuid), fee } } } });
  }
}

// ================================================================ The GM's "Book rules" tool: racism, group tests

const controlled = (): any[] => {
  const seen = new Set<string>();
  return [...((globalThis as any).canvas?.tokens?.controlled ?? [])].map((t: any) => t.actor).filter((a: any) => a && !seen.has(a.uuid) && (seen.add(a.uuid), true));
};

/** A group Perception test (Core p. 185): the average Intelligence plus a die per member, against 4 and a modifier. */
export async function groupPerception(actors: any[], modifier = 0): Promise<SuccessTestResult | null> {
  if (!C.groupPerceptionOn() || !actors.length) return null;
  const ints = actors.map((a: any) => Math.max(0, Math.floor(Number(a.system?.attributes?.intelligence?.total ?? 0))));
  const dice = C.groupPerceptionDice(ints);
  const rolls: any[] = [];
  const mod = int(modifier, -20, 20, 0);
  const res = await successTest({ dice, targetNumber: 4, modifiers: mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [], roll: roller(rolls) });
  await post(`<p><strong>${tx('SR2E.Core95.Group.perception')}</strong> ${tx('SR2E.Core95.Group.perceptionLine', { names: escHtml(actors.map((a: any) => String(a.name)).join(', ')), average: C.average(ints), members: ints.length, dice, tn: Number(res.targetNumber) || 0 })}</p>
    <p>${tx('SR2E.Core95.Group.result', { rolled: escHtml(diceText(res)), successes: Number(res.successes) || 0 })}</p>`, { rolls, ...(isGm() ? { whisper: gmIds() } : {}) });
  return res;
}

/** A leaderless group's averaged ratings (Core p. 180), whispered to the GM: the social target numbers against them. */
export async function groupAverages(actors: any[]): Promise<Record<string, number> | null> {
  if (!C.groupAverageOn() || !actors.length) return null;
  const of = (k: string): number => C.average(actors.map((a: any) => Number(a.system?.attributes?.[k]?.total ?? 0)));
  const out = { charisma: of('charisma'), intelligence: of('intelligence'), willpower: of('willpower') };
  await post(`<p><em>${tx('SR2E.Core95.gmOnly')}</em> · <strong>${tx('SR2E.Core95.Group.average')}</strong> ${tx('SR2E.Core95.Group.averageLine', { names: escHtml(actors.map((a: any) => String(a.name)).join(', ')), charisma: out.charisma, intelligence: out.intelligence, willpower: out.willpower })}</p>`, { whisper: gmIds() });
  return out;
}

/** The GM's "Book rules" tool: racism for the selected NPCs, a group Perception test, a group's averaged ratings. */
export async function openBookTool(): Promise<void> {
  if (!isGm()) return;
  const picked = controlled();
  const names = escHtml(picked.map((a: any) => String(a.name)).join(', '));
  const npcs = picked.filter((a: any) => a.type === 'npc');
  const racism = npcs.map((a: any) => `<li>${escHtml(String(a.name))}: ${racismText(racismOfActor(a))}</li>`).join('');
  const pick = await dialogs()?.wait?.({
    window: { title: tx('SR2E.Core95.Tool.title') },
    content: `<p>${picked.length ? tx('SR2E.Core95.Tool.selected', { names }) : tx('SR2E.Core95.Tool.none')}</p>${racism ? `<ul>${racism}</ul>` : ''}
      <div class="form-group"><label>${tx('SR2E.Core95.Tool.modifier')}</label><input name="mod" type="number" value="0"></div>`,
    buttons: [
      ...(C.racismBook() ? [{ action: 'racism', label: tx('SR2E.Core95.Tool.racism'), callback: () => ({ op: 'racism' }) }, { action: 'noRacism', label: tx('SR2E.Core95.Tool.clearRacism'), callback: () => ({ op: 'noRacism' }) }] : []),
      ...(C.groupPerceptionOn() ? [{ action: 'perception', label: tx('SR2E.Core95.Tool.perception'), callback: (_e: Event, b: any) => ({ op: 'perception', mod: Number(b.form?.elements?.mod?.value) || 0 }) }] : []),
      ...(C.groupAverageOn() ? [{ action: 'average', label: tx('SR2E.Core95.Tool.average'), callback: () => ({ op: 'average' }) }] : []),
      { action: 'cancel', label: tx('SR2E.Core95.cancel'), callback: () => null },
    ],
    rejectClose: false,
  }) as { op: string; mod?: number } | null;
  if (!pick || !picked.length) return;
  if (pick.op === 'racism') for (const a of npcs) await rollRacism(a);
  else if (pick.op === 'noRacism') for (const a of npcs) await clearRacism(a);
  else if (pick.op === 'perception') await groupPerception(picked, Number(pick.mod) || 0);
  else if (pick.op === 'average') await groupAverages(picked);
}

// ================================================================ Registration

export function registerCore95(): void {
  const s: any = G().settings;
  const rerender = (): void => { const open = (globalThis as any).foundry?.applications?.instances?.get?.('sr2e-team-karma'); if (open?.rendered) void open.render(); };
  s.register(SYSTEM_ID, TEAM_POOL, { scope: 'world', config: false, type: Object, default: { members: [], pool: 0, spent: 0 }, onChange: rerender });
  (globalThis as any).Hooks?.on?.('renderDialogV2', (app: any, el: any) => { try { watchDialog(el ?? app?.element); } catch { /* not a dialog we know */ } });
  onRelay('core95', core95Relay);
}
