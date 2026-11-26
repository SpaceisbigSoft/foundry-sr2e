/**
 * v0.93.3: the GM's roll request (report item 6), the Foundry glue. The pure state, tally and HTML are in
 * rules/rollrequest.ts.
 *
 * - `openRollRequestDialog()` (GM): pick the characters (the player-owned characters on the scene and in the party
 *   are ticked), a skill or an attribute, a TN, and whether TN and results are hidden from players. One card is
 *   posted, with the state on its flags.
 * - The card is drawn from its flags on every render, for the viewer: a player gets a Roll button on the rows of
 *   characters they own (it opens that character's normal roll window, with the TN filled in); the GM gets "Roll for
 *   them" per waiting row and "Roll the NPCs".
 * - The tally: the test card the roll posts carries `requestOf` (the request card's id) on its snapshot. The lead GM's
 *   client checks that the request card is a GM's, that the test card's author (server-set) owns the row's actor or is
 *   a GM, and that the row is waiting (or this is a newer card of the same test: a Karma re-roll, the GM's TN change),
 *   then rewrites the request card, under the GM lock.
 *
 * Trust: only `message.author` (server-set) vouches for anything. A request card that isn't a GM's is ignored (no
 * buttons, no tally). The `requestOf` value, the snapshot's actor and its successes are claims the checks above test
 * and the pure code bounds. Hiding is a courtesy, not a secret: the roller's own client needs the TN to roll, and
 * flags can be read from the console.
 */
import { skillChoices, getCustomLists, attributeDisplayLabel } from '../rules/customlists.ts';
import { SYSTEM_ID } from '../config/system.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';
import { guessSkillAttribute } from '../rules/statblock.ts';
import {
  REQUEST_FLAG, REQUEST_ATTRIBUTES, REQUEST_TN_MIN, REQUEST_TN_MAX, MAX_REQUEST_ROWS, parseRequest, makeRequest, applyResult,
  requestHtml, requestCardContent, requestOfValue, requestWhat, safeId, type RollRequest, type RequestKind, type RequestRow,
} from '../rules/rollrequest.ts';
import { authorIsGm, authorOwns } from './trust.ts';
import { withGmLock } from './gmlock.ts';
import { isLeadGm } from './leader.ts';

/**
 * v0.93.3: opens an actor's normal roll window for a request (the sheets' skill or attribute dialog), with the TN set
 * (and not shown when `hideTn`); `opts` go into the actor's rollSkill / rollAttribute options as they are
 * (`requestOf`, `requestPrivate`). Resolves when the window is closed or the test is rolled.
 */
export type RollWindowOpener = (actor: any, ask: { kind: RequestKind; key: string; skill: any | null; tn: number; hideTn: boolean; opts: Record<string, unknown> }) => Promise<unknown>;

let opener: RollWindowOpener | null = null;
let registered = false;

/** v0.93.3: rows this client has rolled and waits on the tally for (`<message id>:<index>`): their button says "sent". */
const sent = new Set<string>();
/** v0.93.3: card actions running now on this client (`<message id>:<action>:<index>`): a second click waits it out. */
const busy = new Set<string>();

/** v0.93.3: an attribute's label, the GM's own when set (rules/customlists.ts). */
const attrLabel = (k: string): string => {
  try { const s = attributeDisplayLabel(k); if (s && !s.startsWith('SR2E.')) return s; } catch { /* no i18n */ }
  return k.charAt(0).toUpperCase() + k.slice(1);
};

/** v0.93.3: a request card's state, only from a GM's card (null for anything else). */
export function requestOf(message: any): RollRequest | null {
  if (!message || !authorIsGm(message)) return null;
  return parseRequest(message.getFlag?.(SYSTEM_ID, REQUEST_FLAG) ?? message.flags?.[SYSTEM_ID]?.[REQUEST_FLAG]);
}

const actorOf = (uuid: string): any => {
  try { return (globalThis as any).fromUuidSync?.(uuid) ?? null; } catch { return null; }
};

/** v0.93.3: whether a row's actor has no player owner now (live; the row's own mark when it can't be loaded). */
function liveNpc(row: RequestRow): boolean {
  const a = actorOf(row.actorUuid);
  return a ? !a.hasPlayerOwner : !row.playerOwned;
}

/** v0.93.3: the opts a request's test is rolled with (the link to the card; whispered to the GMs when hidden). */
export function requestOpts(messageId: string, state: RollRequest): Record<string, unknown> {
  return { requestOf: messageId, ...(state.hidden ? { requestPrivate: true } : {}) };
}

/** A skill stand-in rated 0, so `rollSkill` defaults to the linked attribute (as inline tests do). */
function defaultingSkill(name: string): any {
  return { id: null, name, type: 'skill', system: { rating: 0, attribute: guessSkillAttribute(name), specialization: '', specializationRating: 0, kind: 'active' } };
}

/** v0.93.3: the actor's skill for a request (its own, a skillsoft, or a defaulting stand-in). */
function skillFor(actor: any, name: string): any {
  return actor?.findSkill?.(name) ?? defaultingSkill(name);
}

/** v0.93.3: roll a request's test for an actor straight away (the GM's "Roll for them" after its prompt, "Roll the NPCs"). */
export async function rollRequestTest(actor: any, state: RollRequest, messageId: string, more: { tn?: number; modifier?: number } = {}): Promise<unknown> {
  const tn = Math.max(REQUEST_TN_MIN, Math.min(REQUEST_TN_MAX, Math.floor(Number(more.tn ?? state.tn)) || state.tn));
  const mod = Math.floor(Number(more.modifier ?? 0)) || 0;
  const opts = { targetNumber: tn, ...(mod ? { modifiers: [{ id: 'modifier', label: tx('SR2E.Card.Mod.modifier'), value: mod }] } : {}), ...requestOpts(messageId, state) };
  if (state.kind === 'attribute') return actor?.rollAttribute?.(state.key, opts);
  return actor?.rollSkill?.(skillFor(actor, state.key), opts);
}

/** v0.93.3: the roll window when the sheets' own isn't wired in: TN (hidden when asked), a TN modifier. */
async function fallbackWindow(actor: any, ask: Parameters<RollWindowOpener>[1], state: RollRequest, messageId: string): Promise<unknown> {
  const r = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Request.rollTitle', { name: String(actor?.name ?? ''), what: requestWhat(state, attrLabel) }) },
    content: `<p>${escHtml(actor?.name ?? '')}: ${escHtml(requestWhat(state, attrLabel))}</p>
      ${ask.hideTn ? `<input name="tn" type="hidden" value="${state.tn}"><p class="hint">${tx('SR2E.Dialog.Request.tnHidden')}</p>` : `<div class="form-group"><label>${tx('SR2E.Dialog.Request.targetNumber')}</label><input name="tn" type="number" value="${state.tn}" min="${REQUEST_TN_MIN}" max="${REQUEST_TN_MAX}" readonly></div>`}
      <div class="form-group"><label>${tx('SR2E.Dialog.Request.tnModifier')}</label><input name="mod" type="number" value="0"></div>`,
    ok: { label: tx('SR2E.Dialog.Request.roll'), callback: (_e: Event, b: any) => ({ mod: Number(b.form.elements.mod.value) || 0 }) },
    rejectClose: false,
  }) as { mod: number } | null;
  if (!r) return null;
  return rollRequestTest(actor, state, messageId, { modifier: r.mod });
}

/** v0.93.3: the row a button names, from the card's checked state. */
function rowAt(state: RollRequest, button: HTMLElement): { row: RequestRow; index: number } | null {
  const index = Math.floor(Number(button?.dataset?.['index']));
  if (!Number.isInteger(index) || index < 0 || index >= state.rows.length) return null;
  return { row: state.rows[index]!, index };
}

/** v0.93.3: a player's Roll on their own row: opens their character's normal roll window. */
export async function rollRequestRoll(message: any, button: HTMLElement): Promise<void> {
  const state = requestOf(message);
  if (!state) return;
  const at = rowAt(state, button);
  if (!at) return;
  if (at.row.result) { ui.notifications?.info?.(tx('SR2E.Notify.Request.alreadyRolled', { name: escHtml(at.row.name) })); return; }
  const actor = actorOf(at.row.actorUuid);
  if (!actor) { ui.notifications?.warn?.(tx('SR2E.Notify.Request.noActor', { name: escHtml(at.row.name) })); return; }
  if (!actor.isOwner) { ui.notifications?.warn?.(tx('SR2E.Notify.Request.notYours', { name: escHtml(actor.name) })); return; }
  const ask = { kind: state.kind, key: state.key, skill: state.kind === 'skill' ? skillFor(actor, state.key) : null, tn: state.tn, hideTn: state.hidden && !(game as any).user?.isGM, opts: requestOpts(String(message.id), state) };
  const out = opener ? await opener(actor, ask) : await fallbackWindow(actor, ask, state, String(message.id));
  if (out) {
    sent.add(`${message.id}:${at.index}`);
    redraw(message);
  }
}

/** v0.93.3: the GM's "Roll for them" on a row: a short prompt (TN, modifier), then the roll under the GM lock. */
export async function rollRequestFor(message: any, button: HTMLElement): Promise<void> {
  if (!(game as any).user?.isGM) return;
  const state = requestOf(message);
  if (!state) return;
  const at = rowAt(state, button);
  if (!at || at.row.result) return;
  const actor = actorOf(at.row.actorUuid);
  if (!actor) { ui.notifications?.warn?.(tx('SR2E.Notify.Request.noActor', { name: escHtml(at.row.name) })); return; }
  // Asked first, then the lock is taken (nothing waits for input while holding it).
  const r = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Request.rollTitle', { name: String(actor.name ?? ''), what: requestWhat(state, attrLabel) }) },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Request.targetNumber')}</label><input name="tn" type="number" value="${state.tn}" min="${REQUEST_TN_MIN}" max="${REQUEST_TN_MAX}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Request.tnModifier')}</label><input name="mod" type="number" value="0"></div>`,
    ok: { label: tx('SR2E.Dialog.Request.roll'), callback: (_e: Event, b: any) => ({ tn: Number(b.form.elements.tn.value) || state.tn, mod: Number(b.form.elements.mod.value) || 0 }) },
    rejectClose: false,
  }) as { tn: number; mod: number } | null;
  if (!r) return;
  await withGmLock(() => rollRequestTest(actor, state, String(message.id), { tn: r.tn, modifier: r.mod }));
}

/** v0.93.3: the GM's "Roll the NPCs": every waiting row whose actor has no player owner, at the request's TN, one by one. */
export async function rollRequestNpcs(message: any): Promise<number> {
  if (!(game as any).user?.isGM) return 0;
  const state = requestOf(message);
  if (!state) return 0;
  const todo = state.rows.filter((r) => !r.result && liveNpc(r)).map((r) => actorOf(r.actorUuid)).filter(Boolean);
  if (!todo.length) { ui.notifications?.info?.(tx('SR2E.Notify.Request.noNpcs')); return 0; }
  return withGmLock(async () => {
    let n = 0;
    for (const a of todo) {
      try { if (await rollRequestTest(a, state, String(message.id))) n++; } catch (err) { console.warn('sr2e | roll request npc', err); }
    }
    return n;
  });
}

/**
 * v0.93.3: the lead GM's tally step for one new test card (run under the GM lock; exported for the tests). Returns
 * what happened ('added', 'replaced', or why the card didn't count).
 */
export async function tallyTestCard(message: any): Promise<string> {
  const snap = message?.getFlag?.(SYSTEM_ID, 'test') ?? message?.flags?.[SYSTEM_ID]?.test;
  if (!snap || typeof snap !== 'object') return 'notTest';
  const reqId = requestOfValue(snap.requestOf);
  if (!reqId) return 'notLinked';
  const reqMsg: any = (game as any).messages?.get?.(reqId);
  // The request card must be a GM's (requestOf checks); a player's card with request flags is nobody's request.
  const state = requestOf(reqMsg);
  if (!state) return 'noRequest';
  const actorUuid = safeId(snap.actorUuid);
  const row = state.rows.find((r) => r.actorUuid === actorUuid);
  if (!row) return 'noRow';
  // The test card's author (server-set) must own that actor (a GM may roll for anyone).
  if (!authorOwns(message, actorUuid)) return 'notOwner';
  // Not a test from before the request (a re-posted old card).
  const made = Number(message.timestamp ?? 0), asked = Number(reqMsg.timestamp ?? 0);
  if (made && asked && made < asked) return 'older';
  const r = applyResult(state, actorUuid, { successes: snap.successes, botch: snap.botch === true && !snap.disasterAvoided, cardId: message.id, testId: snap.testId });
  if (r.outcome !== 'added' && r.outcome !== 'replaced') return r.outcome;
  await reqMsg.update({ content: requestCardContent(r.state, attrLabel), flags: { [SYSTEM_ID]: { [REQUEST_FLAG]: r.state } } });
  return r.outcome;
}

/** v0.93.3: draw a request card for this viewer and wire its buttons (only on a GM's card). */
export function decorateRequestCard(message: any, html: HTMLElement): void {
  const state = requestOf(message);
  if (!state) return;
  const box: any = html?.querySelector?.('.sr2e-rr');
  if (!box) return;
  const gm = Boolean((game as any).user?.isGM);
  box.innerHTML = requestHtml(state, {
    gm,
    owns: (uuid) => Boolean(actorOf(uuid)?.isOwner),
    npc: liveNpc,
    sent: (i) => sent.has(`${message.id}:${i}`),
  }, attrLabel);
  for (const b of Array.from(box.querySelectorAll('button[data-sr2e-rr]')) as HTMLButtonElement[]) {
    b.addEventListener('click', (ev: Event) => {
      ev.preventDefault?.();
      const action = String(b.dataset['sr2eRr'] ?? '');
      const key = `${message.id}:${action}:${b.dataset['index'] ?? ''}`;
      if (busy.has(key)) return;
      busy.add(key);
      b.disabled = true;
      const run = action === 'roll' ? rollRequestRoll(message, b) : action === 'rollFor' ? rollRequestFor(message, b) : action === 'rollNpcs' ? rollRequestNpcs(message) : Promise.resolve();
      void Promise.resolve(run).catch((err) => console.warn(`sr2e | roll request ${action}`, err)).finally(() => { busy.delete(key); b.disabled = false; redraw(message); });
    });
  }
}

/** Draw the card again where it is shown (after this client's own roll). */
function redraw(message: any): void {
  try {
    (globalThis as any).document?.querySelectorAll?.(`[data-message-id="${escHtml(message?.id ?? '')}"]`)?.forEach?.((el: HTMLElement) => decorateRequestCard(message, el));
  } catch { /* no DOM */ }
}

/** v0.93.3: the actors the GM may ask: the viewed scene's people and the party; ticked: the player-owned characters. */
export function requestCandidates(): Array<{ actor: any; ticked: boolean }> {
  const seen = new Set<string>();
  const out: Array<{ actor: any; ticked: boolean }> = [];
  const add = (a: any) => {
    if (!a?.uuid || seen.has(a.uuid) || !['character', 'npc', 'spirit'].includes(a.type)) return;
    seen.add(a.uuid);
    out.push({ actor: a, ticked: a.type === 'character' && Boolean(a.hasPlayerOwner) });
  };
  const controlled = [...((globalThis as any).canvas?.tokens?.controlled ?? [])].map((t: any) => t.actor);
  for (const a of controlled) add(a);
  for (const t of [...((globalThis as any).canvas?.tokens?.placeables ?? [])]) add(t.actor);
  for (const a of [...((game as any).actors ?? [])]) if (a?.type === 'character' && a.hasPlayerOwner) add(a);
  // Selected tokens are ticked too.
  for (const c of out) if (controlled.some((a: any) => a?.uuid === c.actor.uuid)) c.ticked = true;
  return out.slice(0, MAX_REQUEST_ROWS * 2);
}

/** v0.93.3: the GM's request dialog: who, what, TN, hidden; posts the card. Resolves with the card, or null. */
export async function openRollRequestDialog(o: { actors?: any[] } = {}): Promise<any> {
  if (!(game as any).user?.isGM) { ui.notifications?.warn?.(tx('SR2E.Notify.Request.gmOnly')); return null; }
  const people = o.actors?.length ? o.actors.filter(Boolean).map((a) => ({ actor: a, ticked: true })) : requestCandidates();
  if (!people.length) { ui.notifications?.warn?.(tx('SR2E.Notify.Request.nobody')); return null; }
  // v0.93.3: the candidates' own skills, and the GM's custom skills (rules/customlists.ts).
  const skills = skillChoices([...new Set(people.flatMap((p) => [...(p.actor.items ?? [])].filter((i: any) => i.type === 'skill').map((i: any) => String(i.name ?? '').trim()).filter(Boolean)))].sort(), getCustomLists().skills, []).slice(0, 300);
  const r = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Request.title') },
    content: `<div class="sr2e-rr-dialog">
      <div class="form-group"><label>${tx('SR2E.Dialog.Request.kind')}</label><select name="kind"><option value="skill">${tx('SR2E.Dialog.Request.skill')}</option><option value="attribute">${tx('SR2E.Dialog.Request.attribute')}</option></select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Request.skillName')}</label><input name="skill" type="text" list="sr2e-rr-skills" placeholder="${tx('SR2E.Dialog.Request.skillPlaceholder')}"><datalist id="sr2e-rr-skills">${skills.map((s) => `<option value="${escHtml(s)}"></option>`).join('')}</datalist></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Request.attributeName')}</label><select name="attribute">${REQUEST_ATTRIBUTES.map((k) => `<option value="${escHtml(k)}" ${k === 'intelligence' ? 'selected' : ''}>${escHtml(attrLabel(k))}</option>`).join('')}</select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Request.targetNumber')}</label><input name="tn" type="number" value="4" min="${REQUEST_TN_MIN}" max="${REQUEST_TN_MAX}"></div>
      <label class="sr2e-check"><input type="checkbox" name="hidden"> ${tx('SR2E.Dialog.Request.hidden')}</label>
      <fieldset class="sr2e-rr-who"><legend>${tx('SR2E.Dialog.Request.who')}</legend>${people.map((p, i) => `<label class="sr2e-check"><input type="checkbox" name="who" value="${i}" ${p.ticked ? 'checked' : ''}> ${escHtml(p.actor.name)}${p.actor.hasPlayerOwner ? '' : ` <em>${tx('SR2E.Card.Request.npc')}</em>`}</label>`).join('')}</fieldset>
      <p class="hint">${tx('SR2E.Dialog.Request.hint')}</p></div>`,
    ok: {
      label: tx('SR2E.Dialog.Request.post'),
      callback: (_e: Event, b: any) => {
        const el = b.form.elements;
        const picked = Array.from(b.form.querySelectorAll('input[name="who"]:checked')).map((x: any) => Math.floor(Number(x.value)));
        return { kind: String(el.kind.value) === 'attribute' ? 'attribute' : 'skill', skill: String(el.skill.value ?? '').trim(), attribute: String(el.attribute.value), tn: Math.floor(Number(el.tn.value)) || 4, hidden: Boolean(el.hidden.checked), picked };
      },
    },
    rejectClose: false,
  }) as { kind: RequestKind; skill: string; attribute: string; tn: number; hidden: boolean; picked: number[] } | null;
  if (!r) return null;
  const chosen = r.picked.map((i) => people[i]?.actor).filter(Boolean);
  return postRollRequest({ kind: r.kind, key: r.kind === 'attribute' ? r.attribute : r.skill, tn: r.tn, hidden: r.hidden, actors: chosen });
}

/** v0.93.3: post a request card (the dialog's last step; a macro can call it too). Null when nothing can be asked. */
export async function postRollRequest(o: { kind: RequestKind; key: string; tn: number; hidden?: boolean; actors: any[] }): Promise<any> {
  if (!(game as any).user?.isGM) { ui.notifications?.warn?.(tx('SR2E.Notify.Request.gmOnly')); return null; }
  if (o.kind === 'skill' && !String(o.key ?? '').trim()) { ui.notifications?.warn?.(tx('SR2E.Notify.Request.noSkill')); return null; }
  if (!o.actors?.length) { ui.notifications?.warn?.(tx('SR2E.Notify.Request.nobody')); return null; }
  const id = String((globalThis as any).foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2, 12));
  const state = makeRequest({ id, kind: o.kind, key: o.key, tn: o.tn, hidden: Boolean(o.hidden), rows: o.actors.map((a: any) => ({ actorUuid: String(a.uuid ?? ''), name: String(a.name ?? ''), playerOwned: Boolean(a.hasPlayerOwner) })) });
  if (!state) { ui.notifications?.warn?.(tx('SR2E.Notify.Request.nobody')); return null; }
  return ChatMessage.create({
    speaker: { alias: tx('SR2E.Card.Request.speaker') },
    content: requestCardContent(state, attrLabel),
    flags: { [SYSTEM_ID]: { [REQUEST_FLAG]: state } },
  });
}

/**
 * v0.93.3: the hooks (once, at init). `openRollWindow` is the sheets' roll window for a request (without it, a short
 * window of this file's own is used).
 */
export function registerRollRequests(o: { openRollWindow?: RollWindowOpener } = {}): void {
  if (o.openRollWindow) opener = o.openRollWindow;
  if (registered) return;
  registered = true;
  Hooks.on('renderChatMessageHTML', (message: any, html: HTMLElement) => {
    try { decorateRequestCard(message, html); } catch (err) { console.warn('sr2e | roll request card', err); }
  });
  Hooks.on('createChatMessage', (message: any) => {
    try {
      if (!isLeadGm()) return;
      const snap = message?.getFlag?.(SYSTEM_ID, 'test');
      if (!snap || !requestOfValue(snap.requestOf)) return;
      // Queued, never awaited here: a card posted inside a locked task (the GM's "Roll for them") is tallied after it.
      void withGmLock(() => tallyTestCard(message)).catch((err) => console.warn('sr2e | roll request tally', err));
    } catch (err) { console.warn('sr2e | roll request tally', err); }
  });
}

/** v0.93.3: for the tests: forget this client's sent rows and the wired opener. */
export function resetRollRequestsForTests(): void {
  sent.clear(); busy.clear(); opener = null;
}
