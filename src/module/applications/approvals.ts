/**
 * v0.64.0: the approval queue (a world setting, off by default). With it on, a player's purchases and
 * Karma spending on a character in play don't happen at once: they become a request on the character
 * (`flags.sr2e.requests`), listed in the GM panel's Requests tab. The GM approves (the action then runs
 * on the GM's client, as if the player had done it) or declines (with a reason, whispered back).
 *
 * This file imports no documents or sheets: actors call `approvalNeeded` / `fileRequest`, the Add window
 * registers its own runners, and the GM panel reads `pendingRequests`.
 */
import { SYSTEM } from '../config/system.ts';
import { allActors } from '../helpers/actors.ts';
import { dropFlagKeys, dropFlagKeysUpdate } from '../helpers/flags.ts';
import { needsApproval, makeRequest, withRequest, describeRequest, ENTRY_KIND_KEYS, isEntryKind, type ApprovalRequest, type RequestKind } from '../rules/index.ts';
import { escHtml as esc, escHtml } from '../rules/html.ts';
import { deepSafeKeys, methodRequestProblems } from '../rules/trust.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';

export const REQUESTS_FLAG = 'requests';
export const RECORD_FLAG = 'creation';
export const DRAFT_FLAG = 'creationDraft';

/** Is the queue on? */
export function queueOn(): boolean {
  try { return Boolean(game.settings.get(SYSTEM.id, 'approvalQueue')); } catch { return false; }
}

/** The character's frozen creation record (or null). */
export function creationRecordOf(actor: any): any | null {
  const r = actor?.flags?.[SYSTEM.id]?.[RECORD_FLAG] ?? null;
  return r && typeof r === 'object' && r.v === 1 ? r : null;
}

/**
 * Is the character in the creation wizard (a draft and no record)? Note (v0.81.0, SEC1-10): the draft flag is on the
 * player's own actor, so a player can set it from the console and skip the queue; every check here runs on the
 * client, so the queue is a table rule the GM can see being kept, not a security boundary.
 */
export function inCreation(actor: any): boolean {
  return actor?.type === 'character' && !creationRecordOf(actor) && Boolean(actor?.flags?.[SYSTEM.id]?.[DRAFT_FLAG]);
}

/**
 * v0.92.3 review fix: the priority table (RULES.CORE_V923.priorities) a character's creation draft was started with:
 * the draft's own `table`, or 'old' for a draft saved before v0.92.3 (it was begun under the v0.92.2 table); null when
 * there is no draft (the switch as set applies). Pass it to rules/core923.ts withPriorityTable.
 */
export function draftTable(actor: any): 'book' | 'old' | null {
  if (!inCreation(actor)) return null;
  const t = actor?.flags?.[SYSTEM.id]?.[DRAFT_FLAG]?.table;
  return t === 'book' || t === 'old' ? t : 'old';
}

// ---- The approval context: while the GM runs an approved request, the action passes the gate and the
// advancement log credits the player (and the GM who approved).

let active: { actorUuid: string; requester: string; requesterId?: string; gm: string } | null = null;

export function approvalContext(actorUuid: string): { requester: string; requesterId?: string; gm: string } | null {
  return active && active.actorUuid === actorUuid ? { requester: active.requester, ...(active.requesterId ? { requesterId: active.requesterId } : {}), gm: active.gm } : null;
}

/** Must this spend wait for the GM? */
export function approvalNeeded(actor: any): boolean {
  if (approvalContext(String(actor?.uuid ?? ''))) return false;
  return needsApproval({ queueOn: queueOn(), isGM: Boolean(game.user?.isGM), actorType: String(actor?.type ?? ''), inCreation: inCreation(actor) });
}

/** The requests waiting on a character. */
export function requestsOf(actor: any): ApprovalRequest[] {
  const l = actor?.flags?.[SYSTEM.id]?.[REQUESTS_FLAG];
  // Kept as a map by id (so two writers never overwrite each other's requests); oldest first.
  const list: any[] = Array.isArray(l) ? l : l && typeof l === 'object' ? Object.values(l) : [];
  return list.filter((r: any) => r && typeof r.id === 'string').sort((a: any, b: any) => Number(a.at ?? 0) - Number(b.at ?? 0));
}

/** File a request on the character (the player owns it). Returns true when it was filed. */
export async function fileRequest(actor: any, o: { kind: RequestKind; label: string; karma?: number; nuyen?: number; data: Record<string, unknown>; keepOthers?: boolean }): Promise<boolean> {
  if (!actor?.isOwner) { ui.notifications?.warn?.(tx('SR2E.Notify.Approvals.onlySOwnerCanAskFor', { actorName: escHtml(actor?.name ?? tx('SR2E.Notify.Approvals.theCharacter')) })); return false; }
  const r = makeRequest({ id: foundry.utils.randomID(), kind: o.kind, label: o.label, karma: o.karma ?? 0, nuyen: o.nuyen ?? 0, userId: String(game.user?.id ?? ''), userName: String(game.user?.name ?? ''), at: Date.now(), data: o.data });
  // A repeat of the same request (same user, kind and label) replaces the older one.
  const old = requestsOf(actor);
  // v0.91.0 review (B2): two shop purchases of the same thing are two requests (`keepOthers`); otherwise a repeat replaces.
  const keep = new Set((o.keepOthers ? [...old, r].slice(-Math.max(1, old.length + 1)) : withRequest(old, r)).map((x) => x.id));
  const up: Record<string, unknown> = { [`flags.${SYSTEM.id}.${REQUESTS_FLAG}.${r.id}`]: r };
  Object.assign(up, dropFlagKeysUpdate(actor, REQUESTS_FLAG, old.filter((x) => !keep.has(x.id)).map((x) => x.id)));
  // An old list-shaped flag (never shipped, but be safe) becomes a map.
  if (Array.isArray(actor?.flags?.[SYSTEM.id]?.[REQUESTS_FLAG])) await actor.update({ [`flags.${SYSTEM.id}.${REQUESTS_FLAG}`]: null });
  await actor.update(up);
  ui.notifications?.info?.(tx('SR2E.Notify.Approvals.sentToTheGmForApproval', { label: escHtml(o.label) }));
  return true;
}

/** Take a request off (the player cancelling, or after the GM's decision). */
export async function dropRequest(actor: any, id: string): Promise<void> {
  if (!requestsOf(actor).some((r) => r.id === id)) return;
  await dropFlagKeys(actor, REQUESTS_FLAG, [id]);
}

// ---- Runners: what an approved request does. 'method' calls an actor method by name; the Add window
// registers 'add' and 'skill'.

type Runner = (actor: any, data: Record<string, unknown>) => Promise<boolean>;
const runners = new Map<string, Runner>();
/** v0.81.0 (SEC1-10): per runner kind, what is wrong with a request's data now (the player can edit it after filing). */
type Check = (actor: any, r: ApprovalRequest) => string[];
const checks = new Map<string, Check>();

/** Actor methods a request may call. */
const METHODS = new Set(['improve', 'raiseSpellForce', 'gainEdge', 'buyOffFlaw', 'learnFormula', 'advanceInitiation', 'bondFocus', 'buyItem',
  // v0.91.0: a purchase from the shop (a find card's Buy).
  'buyFromShop',
  // v0.91.5: a permit for an item or an owned vehicle.
  'getPermit',
  // v0.70.0: Karma spends that skipped the queue.
  'quicken', 'raiseChannel', 'learnComplexForm', 'createAlly', 'bindByTrueName', 'enchant',
  // v0.72.0 (O21): anchoring costs Karma; teaching an ally a spell or an ability.
  'anchorSpell', 'teachAlly', 'buyAllyAbility',
  // v0.73.0 (O31): buying a lifestyle outright.
  'buyLifestyleOutright',
  // v0.82.1 (owner): edges and flaws added, changed or deleted by hand after creation.
  'addQuality', 'editQuality', 'removeQuality']);

runners.set('method', async (actor, data) => {
  const method = String(data['method'] ?? '');
  if (!METHODS.has(method) || typeof actor?.[method] !== 'function') return false;
  const args = Array.isArray(data['args']) ? [...(data['args'] as unknown[])] : [];
  // A spell or focus travels by id (these methods take the item).
  if (method === 'raiseSpellForce' || method === 'bondFocus') {
    const it = actor.items.get(String(args[0] ?? ''));
    if (!it) { ui.notifications?.warn?.(tx('SR2E.Notify.Approvals.noLongerHasThat', { actorName: escHtml(actor.name), part: method === 'bondFocus' ? tx('SR2E.Notify.Approvals.focus') : tx('SR2E.Notify.Approvals.spell') })); return false; }
    args[0] = it;
  }
  // v0.70.0: a spirit travels by UUID.
  if (method === 'bindByTrueName') {
    const sp: any = fromUuidSync(String(args[0] ?? ''));
    if (!sp) { ui.notifications?.warn?.(tx('SR2E.Notify.Approvals.thatSpiritIsGone')); return false; }
    args[0] = sp;
  }
  return Boolean(await actor[method](...args));
});

export function registerRequestRunner(kind: string, fn: Runner, check?: Check): void {
  runners.set(kind, fn);
  if (check) checks.set(kind, check);
}

/** Which runner kind a request uses. */
function runnerKind(r: ApprovalRequest): string {
  if (typeof (r.data as any)?.method === 'string') return 'method';
  return r.kind === 'add' || r.kind === 'skill' || r.kind === 'entry' ? r.kind : 'method';
}
function runnerFor(r: ApprovalRequest): Runner | undefined { return runners.get(runnerKind(r)); }

checks.set('method', (_actor, r) => {
  const d: any = r.data ?? {};
  if (!METHODS.has(String(d.method ?? ''))) return [tx('SR2E.App.Approvals.isNotSomethingARequestMay', { method: String(d.method ?? '') })];
  return methodRequestProblems(d, { karma: r.karma, nuyen: r.nuyen });
});

/**
 * v0.81.0 (SEC1-10): what is wrong with a request as it stands (its data, re-checked on the GM's client: the player
 * can edit it after filing). Empty when it may run.
 */
export function requestProblems(actor: any, r: ApprovalRequest): string[] {
  const data: any = r?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data) || !deepSafeKeys(data)) return [tx('SR2E.App.Approvals.itsDataIsNotAPlain')];
  const check = checks.get(runnerKind(r));
  return check ? check(actor, r) : [];
}

/** v0.81.0 (A-9): what an approval runs, read from its data (not the label the player's client wrote). */
export function describeRequestData(r: ApprovalRequest): string {
  const d: any = r?.data ?? {};
  if (typeof d.method === 'string') {
    const args = Array.isArray(d.args) ? d.args : [];
    const shown = args.map((a: unknown) => { const s = typeof a === 'string' ? a : JSON.stringify(a) ?? ''; return s.length > 60 ? `${s.slice(0, 57)}…` : s; });
    return `${d.method}(${shown.join(', ')})`;
  }
  if (r.kind === 'add') {
    const lines = Array.isArray(d.lines) ? d.lines : [];
    // v0.89.6: the same texts the Add window files its label with (the queue compares the two).
    const named = lines.map((l: any) => `${String(l?.data?.name ?? l?.name ?? '?')}${Number(l?.amount) > 1 ? ` ×${Number(l.amount)}` : ''}`).join(', ');
    return d.payment === 'buy' ? tx('SR2E.App.Adding.buy', { named }) : d.payment === 'karma' ? tx('SR2E.App.Adding.learn', { named }) : tx('SR2E.App.Adding.addFree', { named });
  }
  if (r.kind === 'entry') {
    // v0.91.1: a new entry: what it is, read from the data (the GM checks it in the review window).
    const k = String(d.kind ?? '');
    return tx('SR2E.App.NewEntry.requestText', { name: String(d.name ?? '?').slice(0, 80), kind: tKey(ENTRY_KIND_KEYS[isEntryKind(k) ? k : 'gear']) });
  }
  if (r.kind === 'skill') {
    const named = `${String(d.name ?? '?')} ${Number(d.rating) || 0}${d.spec ? ` (${String(d.spec)})` : ''}`;
    return d.pay === 'karma' ? tx('SR2E.App.Approvals.learnKarma', { karma: Number(d.karma) || 0, named }) : tx('SR2E.App.Adding.addFree', { named });
  }
  return String(r.label ?? '');
}

const busy = new Set<string>();

/** GM: run the request as approved; it comes off the list when the action went through. */
export async function approveRequest(actor: any, id: string): Promise<boolean> {
  if (!game.user?.isGM) { ui.notifications?.warn?.(tx('SR2E.Notify.Approvals.onlyAGmCanApproveRequests')); return false; }
  // v0.81.1 (SEC1-14): a copy, so what was checked is what runs: the request inside the actor's flags is a live object
  // the player's own update can change while the request is dropped below.
  const found = requestsOf(actor).find((x) => x.id === id);
  if (!found || busy.has(id)) return false;
  let r: ApprovalRequest;
  try { r = structuredClone(found); } catch { return false; }
  // v0.81.1 (A-9): who filed it, from the server-set sender this GM client saw, when it saw it.
  const by = filerOf(r);
  if (by) r = { ...r, userId: by.id, userName: by.name };
  const run = runnerFor(r);
  if (!run) { ui.notifications?.warn?.(tx('SR2E.Notify.Approvals.nothingKnowsHowToDo', { label: escHtml(r.label) })); return false; }
  // v0.81.0 (SEC1-10): the data is checked again here (the cost worked out again from it must be what was filed).
  const problems = requestProblems(actor, r);
  if (problems.length) { ui.notifications?.warn?.(tx('SR2E.Notify.Approvals.notRunDeclineIt', { label: escHtml(r.label), problems: escHtml(problems.join('; ')) })); return false; }
  busy.add(id);
  // v0.91.0: who filed it (the verified filer when this client saw it arrive), for the shop's list check.
  active = { actorUuid: String(actor.uuid), requester: r.userName, ...(by ? { requesterId: by.id } : {}), gm: String(game.user?.name ?? 'GM') };
  let ok = false;
  // The request comes off first: a slow or failing action can't be approved (and paid) twice.
  await dropRequest(actor, id);
  try { ok = await run(actor, r.data ?? {}); } catch (err) { console.error('sr2e | approval', err); ok = false; } finally { active = null; busy.delete(id); }
  if (!ok) {
    ui.notifications?.warn?.(tx('SR2E.Notify.Approvals.didnTGoThroughTheRequest', { label: escHtml(r.label) }));
    await tell(r, `<p><strong>${esc(r.label)}</strong> ${tx('SR2E.Card.Approvals.forWasApprovedButDidnT', { actorName: esc(actor.name) })}</p>`);
    return false;
  }
  await tell(r, `<p>${tx('SR2E.Card.Approvals.theGmApproved')} <strong>${esc(r.label)}</strong> ${tx('SR2E.Card.Approvals.for', { actorName: esc(actor.name) })}</p>`);
  return true;
}

/**
 * v0.91.1: GM: a request approved another way (a new entry checked in its review window and saved): it comes off and
 * the player is told, as an approval tells them.
 */
export async function finishRequest(actor: any, id: string): Promise<boolean> {
  if (!game.user?.isGM) return false;
  const r = requestsOf(actor).find((x) => x.id === id);
  if (!r) return false;
  await dropRequest(actor, id);
  await tell(r, `<p>${tx('SR2E.Card.Approvals.theGmApproved')} <strong>${esc(r.label)}</strong> ${tx('SR2E.Card.Approvals.for', { actorName: esc(actor.name) })}</p>`);
  return true;
}

/** GM: decline with an optional reason (whispered to the player). */
export async function declineRequest(actor: any, id: string, reason = ''): Promise<boolean> {
  if (!game.user?.isGM) return false;
  const r = requestsOf(actor).find((x) => x.id === id);
  if (!r) return false;
  await dropRequest(actor, id);
  await tell(r, `<p>${tx('SR2E.Card.Approvals.theGmDeclined')} <strong>${esc(r.label)}</strong> ${tx('SR2E.Card.Approvals.for2', { actorName: esc(actor.name), part: reason ? `: ${esc(reason)}` : '.' })}</p>`);
  return true;
}

async function tell(r: ApprovalRequest, content: string): Promise<void> {
  const to = [r.userId, ...((game as any).users?.filter?.((u: any) => u.isGM)?.map?.((u: any) => u.id) ?? [])].filter(Boolean);
  try { await ChatMessage.create({ whisper: [...new Set(to)], content }); } catch (err) { console.warn('sr2e | approval message', err); }
}

/** Every waiting request in the world (world actors), for the GM panel. */
export function pendingRequests(): Array<{ actorUuid: string; actorName: string; id: string; text: string; cost: string; short: boolean; ago: string; kind: string }> {
  const out: any[] = [];
  const ago = (t: number) => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };
  for (const a of allActors()) {
    if (a.type !== 'character') continue;
    for (const r of requestsOf(a)) {
      const d = describeRequest(r, { karma: Number(a.system?.karma?.good ?? 0), nuyen: Number(a.system?.nuyen ?? 0) });
      // v0.81.0 (A-9): the text says what will run (from the data), not only the label the player's client wrote.
      const what = describeRequestData(r);
      const problems = requestProblems(a, r);
      // A-9: the filer this client saw arrive, else (filed before this session) the name the request carries, marked.
      const who = filerLabel(r);
      out.push({ actorUuid: a.uuid, actorName: a.name, id: r.id, text: `${who}: ${what}${what === r.label ? '' : ` ${tx('SR2E.App.Approvals.askedAs', { label: r.label })}`}${problems.length ? ` ⚠ ${problems.join('; ')}` : ''}`,
        cost: d.cost, short: d.short, ago: ago(r.at), kind: r.kind, at: r.at, entry: r.kind === 'entry' });
    }
  }
  return out.sort((x, y) => x.at - y.at);
}

/** GM clients: a note when a player files a request (the ids noted lately; A-19: kept small). */
const seen = new Set<string>();

/**
 * v0.81.1 (A-9): who really filed each request this GM client saw arrive (the update's server-set user), by request id.
 * The request's own `userId`/`userName` are written by the filing client.
 */
const filedBy = new Map<string, string>();

/**
 * v0.81.1 round 2 (FIX2-BRIEF F, V-SEC 11): who filed a request, for the queue and the approve dialog: the user this
 * GM client saw file it, else the name the request carries with "(filer not verified)".
 */
export function filerLabel(r: { id?: unknown; userName?: unknown } | null | undefined): string {
  const f = filerOf(r);
  return f ? f.name : tx('SR2E.App.Approvals.filerNotVerified', { name: String(r?.userName ?? tx('SR2E.App.Approvals.aPlayer')) });
}

/** The user who filed a request, when this client saw it arrive and that user exists; else null. */
export function filerOf(r: { id?: unknown } | null | undefined): { id: string; name: string } | null {
  const uid = r?.id !== undefined ? filedBy.get(String(r.id)) : undefined;
  const u: any = uid ? (game as any).users?.get?.(uid) : null;
  return u ? { id: String(u.id), name: String(u.name ?? 'a player') } : null;
}

export function registerApprovalHooks(): void {
  Hooks.on('updateActor', (actor: any, changes: any, _o: any, userId: string) => {
    const next = changes?.flags?.[SYSTEM.id]?.[REQUESTS_FLAG];
    if (!next || typeof next !== 'object' || !game.user?.isGM) return;
    const added = (Array.isArray(next) ? next : Object.entries(next).filter(([k]) => !k.startsWith('-=')).map(([, v]) => v)).filter((r: any) => r && typeof r === 'object' && r.id);
    for (const r of added as any[]) {
      const fresh = !seen.has(String(r.id)) && Date.now() - Number(r.at ?? 0) < 60_000;
      seen.add(String(r.id));
      if (seen.size > 200) seen.delete(seen.values().next().value as string);
      // A-9: the first update that brought this id in names who filed it.
      if (typeof userId === 'string' && userId && !filedBy.has(String(r.id))) {
        filedBy.set(String(r.id), userId);
        if (filedBy.size > 500) filedBy.delete(filedBy.keys().next().value as string);
      }
      const who = filerOf(r)?.name ?? String(r.userName ?? tx('SR2E.Card.Approvals.aPlayer'));
      if (fresh && userId !== game.user?.id) ui.notifications?.info?.(tx('SR2E.Notify.Approvals.asksForGmPanelRequests', { who: esc(who), actorName: esc(actor.name), label: esc(r.label) }));
    }
  });
}
