/**
 * v0.95.0 rules completeness (melee, actions, Dice Pools): the Foundry side of rules/melee95.ts (RULES.MELEE_V95).
 *
 * - No actions (Core pp. 86, 112): `noActionsKey` (why an actor in the fight can't act), used by `SR2Actor.canAct`, the
 *   sheet's action bar (rules/actions935.ts `noActions`), `greyNoActions` (the other sheet buttons), the tracker
 *   (`takesNoTurn`, `trackerNotes`).
 * - Quick draw (Core p. 82): `quickDraw` (the Reaction test when an attack draws a holstered pistol).
 * - Surprise (Core p. 86): `totallySurprisedIn`, `surpriseOpponents`, `surpriseNote`.
 * - Subduing (Core p. 103): `subdueBoxAttr` (the Attack window's tick), `subdueHold` (control and the maintenance test
 *   from the Hold button), the wearing off with game time, the Let go button (chat action `release95`); a user who
 *   can't write the held actor asks the GM's client (relay op `melee95`, judged by its sender).
 * - Knocked back into a wall (Core p. 102): `staggered` (after a knockdown test's stagger), `wallMods` (the TN
 *   modifier), cleared when the token moves.
 * - Interception (Core p. 83): the lead GM's client watches moves in a fight and whispers an offer (chat action
 *   `intercept95`); the button works only on a GM's card, for a user who owns the interceptor.
 * - The other pools (Core p. 84): `refreshActionPools` at the start of a character's action.
 *
 * It imports nothing from documents/ or the sheets (they call into this file).
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES } from '../rules/config.ts';
import { successTest, type TargetNumberModifier, type DiceRoller } from '../rules/dice.ts';
import { incapacitated } from '../rules/core.ts';
import { buttonCost, affordable } from '../rules/interface.ts';
import { parseFiringModes } from '../rules/firing.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';
import { clearFlag } from '../helpers/flags.ts';
import { initiativeFormula } from '../helpers/initiative.ts';
import { sysNow } from '../helpers/clock.ts';
import { isLeadGm } from './leader.ts';
import { activeGm, onRelay, requestGm } from './socket.ts';
import { withGmLock } from './gmlock.ts';
import { authorIsGm } from './trust.ts';
import { pxPerMetre, pointsBlocked, sceneMetres, measureTokens } from './canvas.ts';
import * as M from '../rules/melee95.ts';

const PEOPLE = ['character', 'npc', 'spirit'];
const FLAG_SUBDUED = 'subdued95';
const g = (): any => globalThis as any;
const gameNow = (): any => g().game;
const num = (x: unknown): number => (Number.isFinite(Number(x)) ? Number(x) : 0);
const worldNow = (): number => num(sysNow());
const fromUuidQuiet = (u: unknown): any => { try { return typeof u === 'string' && u ? g().fromUuidSync?.(u) ?? null : null; } catch { return null; } };
const gmIds = (): string[] => { try { return (g().ChatMessage?.getWhisperRecipients?.('GM') ?? []).map((u: any) => String(u.id)); } catch { return []; } };
const ownerIds = (actor: any): string[] => { try { return [...(gameNow()?.users ?? [])].filter((u: any) => !u.isGM && actor?.testUserPermission?.(u, 'OWNER')).map((u: any) => String(u.id)); } catch { return []; } };
const alias = (): { alias: string } => ({ alias: tx('SR2E.Melee95.alias') });
const post = async (data: Record<string, unknown>): Promise<any> => g().ChatMessage?.create?.(data);

/** Real Foundry dice for the pure engine (each wave a Roll, kept for the card). */
function roller(sink: any[]): DiceRoller {
  return async (count: number) => {
    const roll = await new (g().Roll)(`${count}d6`).evaluate();
    sink.push(roll);
    return roll.dice[0].results.map((r: any) => r.result as number);
  };
}

// ---------------------------------------------------------------- no actions (Core pp. 86, 112)

function combatantOf(combat: any, actor: any): any {
  try { return [...(combat?.combatants ?? [])].find((c: any) => c.actor && (c.actor === actor || c.actor.uuid === actor?.uuid)) ?? null; } catch { return null; }
}

/** Whether wounds have taken this actor's Reaction to 0 or less (people only). */
export function takesNoTurn(actor: any): boolean {
  if (!actor || !PEOPLE.includes(String(actor.type))) return false;
  try {
    const f = initiativeFormula(actor);
    // The plain case rolls Reaction plus an initiative-only bonus: the rule is about Reaction itself.
    return M.reactionOut({ base: f.label ? f.base : num(actor.system?.derived?.reaction), minus: f.minus });
  } catch { return false; }
}

/** Why this actor takes no actions now (a rules/melee95.ts NO_ACTIONS key), '' when it may act or isn't in the fight. */
export function noActionsKey(actor: any): string {
  const combat: any = gameNow()?.combat;
  if (!combat?.started || !actor || !PEOPLE.includes(String(actor.type))) return '';
  const mine = combatantOf(combat, actor);
  if (!mine) return '';
  let surprised = false;
  try { surprised = (combat.surprisedNow?.() ?? []).includes(mine.id); } catch { surprised = false; }
  return M.noActionsWhy({ inFight: true, reactionOut: takesNoTurn(actor), surprised });
}

/** A NO_ACTIONS key in the user's language ('' for none). */
export function noActionsText(key: string): string {
  if (key === M.NO_ACTIONS.reaction) return tx('SR2E.Melee95.whyReaction');
  if (key === M.NO_ACTIONS.surprised) return tx('SR2E.Melee95.whySurprised');
  return '';
}

/**
 * `SR2Actor.canAct`: the refusal's text when this actor takes no actions now ('' = go on). A plain attribute test
 * (`physical test`: a test the GM calls for) is never refused here.
 */
export function noActionsRefusal(actor: any, what: string): string {
  if (what === 'physical test') return '';
  const why = noActionsText(noActionsKey(actor));
  return why ? tx('SR2E.Melee95.cantAct', { name: String(actor?.name ?? ''), why }) : '';
}

/** The sheet's other buttons that are actions in a fight: greyed with the reason (blocked for players), like the bar. */
export function greyNoActions(actor: any, body: HTMLElement): void {
  const why = noActionsText(noActionsKey(actor));
  if (!why) return;
  const block = !gameNow()?.user?.isGM;
  for (const el of Array.from(body.querySelectorAll<HTMLElement>('[data-action]'))) {
    const action = el.dataset['action'] ?? '';
    if (action === 'rollInit' || !buttonCost(action, { melee: true })) continue;
    el.classList.add('sr2e-cant');
    el.setAttribute('aria-disabled', 'true');
    if (!el.title.includes(why)) el.title = `${el.title ? `${el.title} · ` : ''}${why}`;
    if (block && el instanceof HTMLButtonElement) el.disabled = true;
  }
}

/** The tracker banner's notes: who takes no actions and why (a hidden combatant only for the GM). */
export function trackerNotes(combat: any): string[] {
  if (!combat?.started) return [];
  const out: string[] = [];
  const gm = Boolean(gameNow()?.user?.isGM);
  for (const c of [...(combat.combatants ?? [])] as any[]) {
    if (!c?.actor || (c.hidden && !gm) || c.isDefeated) continue;
    const why = noActionsText(noActionsKey(c.actor));
    if (why) out.push(tx('SR2E.Melee95.trackerOut', { name: String(c.name ?? c.actor.name ?? ''), why }));
  }
  return out;
}

// ---------------------------------------------------------------- surprise (Core p. 86)

const sideOfCombatant = (c: any): string => M.sideOf({ playerOwned: Boolean(c?.actor?.hasPlayerOwner), disposition: c?.token?.disposition ?? c?.actor?.prototypeToken?.disposition ?? 0 });

/** The completely surprised among a surprise test's entries (combatant ids). */
export function totallySurprisedIn(combat: any, entries: ReadonlyArray<{ id: string; successes: number }>): string[] {
  const byId = new Map<string, any>([...(combat?.combatants ?? [])].map((c: any) => [String(c.id), c]));
  return M.totallySurprised(entries.map((e) => ({ id: e.id, successes: e.successes, side: sideOfCombatant(byId.get(String(e.id))) })));
}

/** The surprise turn's blocked targets, without the attacker's own side (actors). */
export function surpriseOpponents(combat: any, attacker: any, blocked: any[]): any[] {
  const all = [...(combat?.combatants ?? [])] as any[];
  const of = (a: any): string => sideOfCombatant(all.find((c: any) => c.actor?.uuid === a?.uuid) ?? { actor: a });
  return M.blockedOpponents(of(attacker), blocked.map((a) => ({ id: String(a?.uuid ?? ''), a })), (x) => of(x.a), all.map(sideOfCombatant)).map((x) => x.a);
}

/** The surprise card's line naming the completely surprised (escaped HTML; '' for none). */
export function surpriseNote(combat: any, ids: readonly string[]): string {
  if (!ids.length) return '';
  const names = ids.map((id) => String(combat?.combatants?.get?.(id)?.name ?? '')).filter(Boolean);
  return `<p><strong>${tx('SR2E.Melee95.totalSurprise')}</strong> ${tx('SR2E.Melee95.totalSurpriseNames', { names: escHtml(names.join(', ')) })}</p>`;
}

// ---------------------------------------------------------------- quick draw (Core p. 82)

/**
 * An attack with a weapon that isn't drawn (COMBAT.ready.rule 'action'), in the attacker's own action:
 * - 'draw': draw first, the Simple Action (the caller spends it); also every case the quick draw doesn't apply to.
 * - 'quick': the quick-draw test succeeded: drawn and fired in the attack's own action.
 * - 'failed': the test failed: the action is spent, nothing fires this phase (the weapon stays holstered).
 * - 'cancel': the window was closed.
 * `opts.quickDraw95` (true / false) answers the question without the window (macros, tests).
 */
export async function quickDraw(actor: any, weapon: any, opts: any = {}): Promise<'draw' | 'quick' | 'failed' | 'cancel'> {
  if (!M.quickDrawTest() || !gameNow()?.combat?.started || !actor?.isActing?.()) return 'draw';
  const w = weapon?.system ?? {};
  const modes = parseFiringModes(String(w.modes ?? '')) as string[];
  const mode = opts.mode && modes.includes(opts.mode) ? String(opts.mode) : String(modes[0] ?? '');
  if (!M.quickDrawEligible({ melee: w.melee, blast: w.blast, thrown: w.thrown, concealability: w.concealability, mode })) return 'draw';
  const plan = M.quickDrawPlan({ holster: Boolean(w.quickDraw), second: ((opts.situational ?? []) as string[]).includes('secondWeapon') });
  const attrLabel = plan.attribute === 'reaction' ? tx('SR2E.Melee95.reaction') : tx('SR2E.Melee95.quickness');
  let want: boolean | null = typeof opts.quickDraw95 === 'boolean' ? opts.quickDraw95 : null;
  if (want === null) {
    const dlg: any = g().foundry?.applications?.api?.DialogV2;
    if (!dlg?.wait) return 'draw';
    const pick = await dlg.wait({
      window: { title: tx('SR2E.Melee95.quickDrawTitle') },
      content: `<p>${tx('SR2E.Melee95.quickDrawAsk', { name: escHtml(weapon?.name ?? ''), attribute: escHtml(attrLabel), tn: plan.tn })}</p>`,
      buttons: [
        { action: 'quick', label: tx('SR2E.Melee95.quickDrawYes', { attribute: attrLabel, tn: plan.tn }), default: true },
        { action: 'draw', label: tx('SR2E.Melee95.quickDrawNo') },
      ],
      rejectClose: false,
    }).catch(() => null);
    if (pick !== 'quick' && pick !== 'draw') return 'cancel';
    want = pick === 'quick';
  }
  if (!want) return 'draw';
  const dice = plan.attribute === 'reaction' ? num(actor.system?.derived?.reaction) : num(actor.system?.attributes?.quickness?.total);
  const labels: Record<string, string> = { noHolster: tx('SR2E.Melee95.modNoHolster'), secondWeapon: tx('SR2E.Melee95.modSecondWeapon') };
  const given: TargetNumberModifier[] = plan.modifiers.map((m) => ({ id: `quickDraw95-${m.id}`, label: labels[m.id] ?? m.id, value: m.value }));
  let modifiers: TargetNumberModifier[] = given;
  try { modifiers = actor.previewModifiers?.({ modifiers: given }) ?? given; } catch { modifiers = given; }
  const rolls: any[] = [];
  const base = plan.tn - plan.modifiers.reduce((n, m) => n + m.value, 0);
  const r = await successTest({ dice, targetNumber: base, modifiers, roll: roller(rolls) });
  const ok = M.quickDrawCleared(r.successes);
  await post({
    speaker: g().ChatMessage?.getSpeaker?.({ actor }), rolls,
    content: `<div class="sr2e-roll"><h3>${tx('SR2E.Melee95.quickDrawCard', { name: escHtml(weapon?.name ?? '') })}</h3><p>${tCount(r.successes, 'SR2E.Melee95.testLine', { attribute: escHtml(attrLabel), dice: r.totalDice, tn: r.targetNumber })}</p><p><strong>${ok ? tx('SR2E.Melee95.quickDrawOk') : tx('SR2E.Melee95.quickDrawFail')}</strong></p></div>`,
  });
  if (ok) return 'quick';
  // The quick-draw action is spent; nothing fires this phase.
  try { await actor.useAction?.('draw', tx('SR2E.Melee95.quickDrawTitle')); } catch { /* the action tracker is off */ }
  return 'failed';
}

/** The quick draw's card note in place of "drawn (a Simple Action)". */
export function quickDrawNote(note: string | undefined): string {
  return M.swapNote(note, tx('SR2E.Card.Actor.drawnASimpleAction'), tx('SR2E.Card.Actor.quickDrawn'));
}

// ---------------------------------------------------------------- subduing (Core p. 103)

/** The Attack window's Subdue tick: disabled, with the reason, for a weapon that can't subdue (escaped attributes). */
export function subdueBoxAttr(weaponSystem: any): string {
  return M.subdueAllowed(weaponSystem) ? '' : ` disabled title="${escHtml(tx('SR2E.Melee95.subdueStunOnly'))}"`;
}

const ratings = (a: any): M.ThreeRatings => ({
  unarmed: num(a?.findSkill?.('Unarmed Combat')?.system?.rating),
  strength: num(a?.system?.attributes?.strength?.total),
  quickness: num(a?.system?.attributes?.quickness?.total),
});
const kindLabel = (k: M.RatingKind): string => (k === 'unarmed' ? tx('SR2E.Melee95.unarmed') : k === 'strength' ? tx('SR2E.Melee95.strength') : tx('SR2E.Melee95.quickness'));
const maxBoxes = (): number => Math.floor(num(RULES.MONITOR_BOXES)) || 10;
const stunOf = (a: any): number => Math.max(0, Math.floor(num(a?.system?.monitor?.stun)));
const subduedState = (a: any): M.Subdued | null => M.subduedOf(a?.flags?.[SYSTEM_ID]?.[FLAG_SUBDUED] ?? a?.getFlag?.(SYSTEM_ID, FLAG_SUBDUED));
const totalOf = (a: any): number => Math.max(0, Math.floor(num(a?.flags?.[SYSTEM_ID]?.[FLAG_SUBDUED]?.total)));
const releaseButton = (): string => `<button type="button" data-sr2e-action="release95">${tx('SR2E.Melee95.letGo')}</button>`;
const subdueFlags = (holder: any, target: any): Record<string, unknown> => ({ [SYSTEM_ID]: { subdue95: { holderUuid: String(holder.uuid), targetUuid: String(target.uuid) } } });

type SubdueOp = 'take' | 'maintain' | 'release';
const FLAG_DONE = 'subdueDone95';

/** Whether `user` may ask for this on behalf of `holder` (the relay judges its sender with it). */
function mayHold(holder: any, user: any): boolean {
  return Boolean(user?.isGM) || Boolean(holder?.testUserPermission?.(user, 'OWNER'));
}

/**
 * Subduing Stun put on `target` by `byUuid`'s blow (`SR2Actor`'s soak, where the monitor is written): kept on the
 * target (flag `subdueDone95`), so taking control and letting go only ever count that damage (Core p. 103).
 */
export async function recordSubdue(target: any, byUuid: unknown, delta: number): Promise<void> {
  if (!target || typeof byUuid !== 'string' || !byUuid || !Number.isFinite(Number(delta)) || Number(delta) === 0) return;
  const now = M.addSubdueDone(target.getFlag?.(SYSTEM_ID, FLAG_DONE), byUuid, Number(delta));
  try {
    if (now.length) await target.setFlag(SYSTEM_ID, FLAG_DONE, now);
    else await clearFlag(target, FLAG_DONE);
  } catch (err) { console.warn('sr2e | subduing damage', err); }
}

const tokenOfActor = (actor: any): any => { try { return actor?.token?.object ?? actor?.getActiveTokens?.()[0] ?? null; } catch { return null; } };

/** Metres between two actors' tokens (null when either has none on the viewed scene). */
function metresBetween(a: any, b: any): number | null {
  const ta = tokenOfActor(a), tb = tokenOfActor(b);
  if (!ta || !tb) return null;
  try { return measureTokens(ta, tb)?.metres ?? null; } catch { return null; }
}

/**
 * Whether the holder may take control now: close enough on the map; with no tokens to measure, both in the running fight
 * (or, with no fight running, as the GM tells it).
 */
function nearEnough(holder: any, target: any): boolean {
  const m = metresBetween(holder, target);
  if (m !== null) return M.closeEnough(m, num(RULES.MELEE_V95.subdueReachMetres));
  const combat: any = gameNow()?.combat;
  if (!combat?.started) return true;
  return Boolean(combatantOf(combat, holder) && combatantOf(combat, target));
}

/**
 * The maintenance test's action (a Simple Action, the Hold's), paid where the test is made: refused out of the holder's
 * own action in a fight, and when the phase has no room under the action rules' 'block'.
 */
async function payMaintain(holder: any, targetName: string): Promise<boolean> {
  const combat: any = gameNow()?.combat;
  if (!combat?.started || RULES.ACTIONS.enforce === 'off') return true;
  if (!holder?.isActing?.()) return false;
  if (RULES.ACTIONS.enforce === 'block' && !affordable(buttonCost('holdTarget'), num(holder.actionsUsed?.()))) return false;
  return Boolean(await holder.useAction?.('hold', tx('SR2E.Melee95.maintainAction', { name: targetName })));
}

/** One step at a time per held actor on this client (a double click, or two requests at once). */
const subdueQueue = new Map<string, Promise<unknown>>();
function oneAtATime<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = subdueQueue.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const settled = run.catch(() => undefined);
  subdueQueue.set(key, settled);
  void settled.then(() => { if (subdueQueue.get(key) === settled) subdueQueue.delete(key); });
  return run;
}

/** Run a subdue step where the held actor can be written: here, or on the GM's client. */
async function subdueStep(op: SubdueOp, holder: any, target: any): Promise<{ ok: boolean; note?: string }> {
  if (target?.isOwner) return applySubdue(op, holder, target, gameNow()?.user);
  return requestGm('melee95', { op, holderUuid: String(holder?.uuid ?? ''), targetUuid: String(target?.uuid ?? '') });
}

/**
 * One subdue step, on a client that may write the held actor. Everything is read from the documents (again, inside the
 * per-actor queue), never from the request; the maintenance test's action is paid here.
 */
export function applySubdue(op: SubdueOp, holder: any, target: any, user: any): Promise<{ ok: boolean; note?: string }> {
  return oneAtATime(String(target?.uuid ?? ''), () => applySubdueNow(op, holder, target, user));
}

async function applySubdueNow(op: SubdueOp, holder: any, target: any, user: any): Promise<{ ok: boolean; note?: string }> {
  if (!M.subdueControlOn() || !holder || !target || !PEOPLE.includes(String(target.type)) || !mayHold(holder, user)) return { ok: false, note: tx('SR2E.Melee95.notAllowed') };
  const state = subduedState(target);
  const cls: any = g().CONFIG?.Actor?.documentClass;
  if (op === 'take') {
    if (state) return { ok: false, note: tx('SR2E.Melee95.alreadySubdued', { name: String(target.name) }) };
    if (stunOf(target) < maxBoxes()) return { ok: false, note: tx('SR2E.Melee95.notSubduable', { name: String(target.name) }) };
    // Only the subduing Stun this holder did counts (Core p. 103), and only from close by.
    const done = target.getFlag?.(SYSTEM_ID, FLAG_DONE);
    const boxes = M.subdueBoxesBy(done, String(holder.uuid), stunOf(target));
    if (boxes <= 0) return { ok: false, note: tx('SR2E.Melee95.notYourSubduing', { name: String(target.name) }) };
    if (!nearEnough(holder, target)) return { ok: false, note: tx('SR2E.Melee95.tooFar', { name: String(target.name) }) };
    await target.setFlag(SYSTEM_ID, FLAG_SUBDUED, { by: String(holder.uuid), boxes, total: boxes, at: worldNow() });
    const rest = M.subdueDoneOf(done).filter((e) => e.by !== String(holder.uuid));
    if (rest.length) await target.setFlag(SYSTEM_ID, FLAG_DONE, rest); else await clearFlag(target, FLAG_DONE);
    subduedIndex.add(String(target.uuid));
    try { await cls?.setHeld?.(target, String(holder.uuid), true); } catch (err) { console.warn('sr2e | subdue hold', err); }
    await post({ speaker: g().ChatMessage?.getSpeaker?.({ actor: holder }), flags: subdueFlags(holder, target),
      content: `<p><strong>${escHtml(target.name)}</strong> ${tx('SR2E.Melee95.subduedBy', { name: escHtml(holder.name) })}</p><p class="hint">${tx('SR2E.Melee95.subduedHint', { seconds: Math.max(1, num(RULES.MELEE_V95.subdueReleaseSeconds)) })}</p><p>${releaseButton()}</p>` });
    return { ok: true };
  }
  if (!state || state.by !== String(holder.uuid)) return { ok: false, note: tx('SR2E.Melee95.notYourCaptive', { name: String(target.name) }) };
  if (op === 'release') {
    await target.update({ 'system.monitor.stun': Math.max(0, stunOf(target) - state.boxes) });
    await clearFlag(target, FLAG_SUBDUED);
    subduedIndex.delete(String(target.uuid));
    try { await cls?.setHeld?.(target, '', false); } catch (err) { console.warn('sr2e | subdue release', err); }
    await post({ speaker: g().ChatMessage?.getSpeaker?.({ actor: holder }), content: `<p><strong>${escHtml(holder.name)}</strong> ${tx('SR2E.Melee95.letsGo', { name: escHtml(target.name) })} ${tCount(state.boxes, 'SR2E.Melee95.stunOff')}</p>` });
    return { ok: true };
  }
  if (!(await payMaintain(holder, String(target.name)))) return { ok: false, note: tx('SR2E.Melee95.noActionLeft', { name: String(holder.name) }) };
  // The maintenance test: both sides rolled here.
  const plan = M.maintainPlan(ratings(holder), ratings(target));
  const rolls: any[] = [];
  const mine = await successTest({ dice: plan.holder.dice, targetNumber: plan.holder.tn, roll: roller(rolls) });
  let wounds: TargetNumberModifier[] = [];
  try { wounds = target.woundModifiers?.() ?? []; } catch { wounds = []; }
  const theirs = await successTest({ dice: plan.held.dice, targetNumber: plan.held.tn, modifiers: [...wounds, ...(plan.held.plus ? [{ id: 'subdued95', label: tx('SR2E.Melee95.modSubdued'), value: plan.held.plus }] : [])], roll: roller(rolls) });
  const out = M.maintainOutcome({ holder: mine.successes, held: theirs.successes, state, total: totalOf(target) || state.boxes, now: worldNow(), stun: stunOf(target) });
  if (out.restored > 0) await target.update({ 'system.monitor.stun': Math.min(maxBoxes(), stunOf(target) + out.restored) });
  await target.setFlag(SYSTEM_ID, FLAG_SUBDUED, { ...out.state, total: Math.max(totalOf(target), out.state.boxes) });
  await post({ speaker: g().ChatMessage?.getSpeaker?.({ actor: holder }), rolls, flags: subdueFlags(holder, target),
    content: `<div class="sr2e-roll"><h3>${tx('SR2E.Melee95.maintainCard', { name: escHtml(target.name) })}</h3>`
      + `<p>${escHtml(holder.name)}: ${tCount(mine.successes, 'SR2E.Melee95.testLine', { attribute: escHtml(kindLabel(plan.holder.kind)), dice: mine.totalDice, tn: mine.targetNumber })}</p>`
      + `<p>${escHtml(target.name)}: ${tCount(theirs.successes, 'SR2E.Melee95.testLine', { attribute: escHtml(kindLabel(plan.held.kind)), dice: theirs.totalDice, tn: theirs.targetNumber })}</p>`
      + `<p><strong>${out.net > 0 ? tCount(out.restored, 'SR2E.Melee95.maintainKept') : tx('SR2E.Melee95.maintainLost')}</strong></p><p>${releaseButton()}</p></div>` });
  return { ok: true };
}

/** The relay op `melee95` on the GM's client: the sender (never the payload) is judged; the steps queue per actor. */
export async function relayMelee95(data: Record<string, any>, user: any): Promise<{ ok: boolean; note?: string }> {
  const op = String(data?.['op'] ?? '');
  if (op !== 'take' && op !== 'maintain' && op !== 'release') return { ok: false, note: tx('SR2E.Melee95.notAllowed') };
  return applySubdue(op, fromUuidQuiet(data?.['holderUuid']), fromUuidQuiet(data?.['targetUuid']), user);
}

/**
 * The Hold button by the book (`SR2Actor.holdTarget` calls it first): control of someone whose Stun track is full by
 * this actor's subduing blows, or the maintenance test on someone this actor already controls. `undefined`: not this
 * rule's case (the Strength vs Body hold goes on as before).
 */
export async function subdueHold(holder: any, target: any): Promise<'held' | 'free' | null | undefined> {
  if (!M.subdueControlOn() || !holder || !target || !PEOPLE.includes(String(target.type))) return undefined;
  const state = subduedState(target);
  let op: SubdueOp;
  if (state && state.by === String(holder.uuid)) op = 'maintain';
  else if (!state && stunOf(target) >= maxBoxes() && M.subdueBoxesBy(target.getFlag?.(SYSTEM_ID, FLAG_DONE), String(holder.uuid), stunOf(target)) > 0) op = 'take';
  else return undefined;
  const r = await subdueStep(op, holder, target);
  if (!r.ok) { g().ui?.notifications?.warn?.(escHtml(r.note ?? tx('SR2E.Melee95.notAllowed'))); return null; }
  return 'held';
}

/** Chat action `release95` (the Let go button): for a user who owns the holder the held actor's own state names. */
export async function onRelease95(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message?.getFlag?.(SYSTEM_ID, 'subdue95') as { holderUuid?: unknown; targetUuid?: unknown } | undefined;
  const target = fromUuidQuiet(f?.targetUuid);
  const state = subduedState(target);
  // The card only points at the held actor; who holds it is read from that actor's own state.
  const holder = state ? fromUuidQuiet(state.by) : null;
  const warn = (text: string): void => { g().ui?.notifications?.warn?.(escHtml(text)); };
  if (!target || !state || !holder) return warn(tx('SR2E.Melee95.notHeldNow'));
  if (!holder.isOwner) return warn(tx('SR2E.Melee95.onlyHolder', { name: String(holder.name) }));
  button.disabled = true;
  const r = await subdueStep('release', holder, target);
  if (!r.ok) { button.disabled = false; warn(r.note ?? tx('SR2E.Melee95.notAllowed')); }
}

/**
 * The actors under someone's control (the lead GM's client): filled by one scan at ready, kept up by the flag's
 * changes (updateActor), so the clock's tick looks only at them.
 */
const subduedIndex = new Set<string>();
/** The index (tests). */
export function _subduedIndex(): Set<string> { return subduedIndex; }

function scanSubdued(): void {
  subduedIndex.clear();
  const actors: any[] = [...(gameNow()?.actors ?? [])];
  for (const sc of [...(gameNow()?.scenes ?? [])] as any[]) for (const t of [...(sc?.tokens ?? [])] as any[]) if (t?.actor && !t.actorLink) actors.push(t.actor);
  for (const a of actors) if (a?.uuid && subduedState(a)) subduedIndex.add(String(a.uuid));
}

/** Subduing Stun wears off with game time (the lead GM's client), for the indexed actors only. */
export async function subdueTick(): Promise<void> {
  if (!M.subdueControlOn() || !subduedIndex.size) return;
  const now = worldNow();
  for (const uuid of [...subduedIndex]) {
    const a = fromUuidQuiet(uuid);
    const state = subduedState(a);
    if (!a || !state) { subduedIndex.delete(uuid); continue; }
    // A clock set back starts the wait again.
    if (now < state.at) { await a.setFlag(SYSTEM_ID, FLAG_SUBDUED, { ...state, total: totalOf(a) || state.boxes, at: now }); continue; }
    const w = M.subdueWearOff(state, now, stunOf(a));
    if (w.left === state) continue;
    if (w.off > 0) await a.update({ 'system.monitor.stun': Math.max(0, stunOf(a) - w.off) });
    if (w.left) await a.setFlag(SYSTEM_ID, FLAG_SUBDUED, { ...w.left, total: totalOf(a) || state.boxes });
    else {
      await clearFlag(a, FLAG_SUBDUED);
      subduedIndex.delete(uuid);
      // Nobody controls them any more: the hold ends too.
      try { await g().CONFIG?.Actor?.documentClass?.setHeld?.(a, '', false); } catch (err) { console.warn('sr2e | subdue over', err); }
      await post({ speaker: g().ChatMessage?.getSpeaker?.({ actor: a }), whisper: [...new Set([...gmIds(), ...ownerIds(a), ...ownerIds(fromUuidQuiet(state.by))])], content: `<p>${tx('SR2E.Melee95.subdueOver', { name: escHtml(a.name) })}</p>` });
    }
  }
}

/** The Defend window's option for a weapon that can't subdue (its counterattack-to-subdue tick is disabled then). */
export function subdueOptionAttr(weaponSystem: any): string {
  return M.subdueStunOnly() && !M.subdueAllowed(weaponSystem) ? ' data-sr2e-nosubdue="1"' : '';
}

/** Wire the Defend window: the tick is disabled, with the reason, while a weapon that can't subdue is picked. */
export function bindSubdueBox(root: any): void {
  const el: any = root?.querySelector ? root : root?.element;
  const select = el?.querySelector?.('select[name="weapon"]');
  const box = el?.querySelector?.('input[name="subdue"]');
  if (!select || !box) return;
  const why = tx('SR2E.Melee95.subdueStunOnly');
  const sync = (): void => {
    const opt = select.options?.[select.selectedIndex] ?? null;
    const no = Boolean(opt?.getAttribute?.('data-sr2e-nosubdue'));
    box.disabled = no;
    if (no) { box.checked = false; box.title = why; } else box.title = '';
  };
  select.addEventListener?.('change', sync);
  sync();
}

// ---------------------------------------------------------------- knocked back into a wall (Core p. 102)


/** Who hit this actor last: the other side of the newest attack card naming it (only used to find a direction). */
function lastAttackerOf(actor: any): any {
  const msgs = [...(gameNow()?.messages?.contents ?? [])].slice(-40).reverse();
  for (const m of msgs) {
    const list: any[] = (m.getFlag?.(SYSTEM_ID, 'attacks') as any[] | undefined) ?? [m.getFlag?.(SYSTEM_ID, 'attack')].filter(Boolean);
    for (const a of list) {
      if (a?.targetUuid === actor.uuid && a.attackerUuid) return fromUuidQuiet(a.attackerUuid);
      // A melee counterattack: the attacker is the one hurt.
      if (a?.attackerUuid === actor.uuid && a.melee && a.targetUuid) return fromUuidQuiet(a.targetUuid);
    }
  }
  return null;
}

/**
 * After a knockdown test's stagger (`SR2Actor.rollKnockdown`): with a wall within reach straight behind the
 * character (away from whoever hit them), they are against the wall (the status; + TN until they move).
 */
export async function staggered(actor: any, staggerMetres: number): Promise<boolean> {
  if (!M.wallOn() || !actor || actor.statuses?.has?.(M.WALL_STATUS)) return false;
  try {
    const me = tokenOfActor(actor);
    const by = tokenOfActor(lastAttackerOf(actor));
    if (!me?.center || !by?.center || me === by) return false;
    const back = M.backPoint(by.center, me.center, M.wallReach(staggerMetres), pxPerMetre());
    if (!back || !pointsBlocked(me.center, back)) return false;
    await actor.toggleStatusEffect?.(M.WALL_STATUS, { active: true });
  } catch { return false; }
  await post({ speaker: g().ChatMessage?.getSpeaker?.({ actor }), content: `<p><strong>${escHtml(actor.name)}</strong> ${tx('SR2E.Melee95.intoWall', { tn: Math.floor(num(RULES.MELEE_V95.wallTn)) })}</p>` });
  return true;
}

/** The TN modifier of an actor against a wall (`SR2Actor.#allTestModifiers`). */
export function wallMods(actor: any): TargetNumberModifier[] {
  return M.wallModifiers(Boolean(actor?.statuses?.has?.(M.WALL_STATUS)), tx('SR2E.Melee95.againstWall'));
}

// ---------------------------------------------------------------- interception (Core p. 83)

const offered = new Set<string>();
const lastSpot = new Map<string, { x: number; y: number }>();
/** Forget the offers made and the spots seen (tests). */
export function _resetOffers(): void { offered.clear(); lastSpot.clear(); }

function centreOf(doc: any, at: { x: number; y: number }, size: number): { x: number; y: number } {
  return { x: num(at.x) + (num(doc?.width) || 1) * size / 2, y: num(at.y) + (num(doc?.height) || 1) * size / 2 };
}

function canMelee(actor: any): boolean {
  if (!actor || !PEOPLE.includes(String(actor.type))) return false;
  if (incapacitated(actor.system?.derived?.status)) return false;
  try { if (actor.helplessStatus?.() || actor.astralOnly?.()) return false; } catch { /* older actor */ }
  return !noActionsKey(actor);
}

/** A token moved in a fight (the lead GM's client): offer the interception to each opponent it passed. */
export async function watchMove(doc: any, change: any, options: any): Promise<number> {
  const combat: any = gameNow()?.combat;
  if (!M.interceptionOn() || !combat?.started || (change?.x === undefined && change?.y === undefined)) return 0;
  // Where the move started: the mover's client says (the options), else Foundry's own record, else what this client saw last.
  const key = String(doc?.uuid ?? doc?.id ?? '');
  const from = options?.sr2eFrom95 ?? doc?.movement?.origin ?? lastSpot.get(key);
  lastSpot.set(key, { x: num(doc?.x), y: num(doc?.y) });
  if (lastSpot.size > 2000) lastSpot.clear();
  if (!from || !Number.isFinite(Number(from.x)) || !Number.isFinite(Number(from.y))) return 0;
  const scene = doc?.parent;
  if (!scene || (combat.scene && combat.scene !== scene) || doc.hidden) return 0;
  const all = [...(combat.combatants ?? [])].filter((c: any) => c.token && c.actor && c.token.parent === scene) as any[];
  const mover = all.find((c: any) => c.token === doc || c.token.id === doc.id);
  if (!mover || !PEOPLE.includes(String(mover.actor.type))) return 0;
  try { if (mover.actor.astralOnly?.()) return 0; } catch { /* older actor */ }
  const size = num(scene.grid?.size ?? g().canvas?.grid?.size) || 100;
  const ppm = pxPerMetre();
  const squareMetres = (num(scene.grid?.distance ?? g().canvas?.grid?.distance) || 1) * sceneMetres();
  const others = all.filter((c: any) => c !== mover && !c.isDefeated);
  // The path of this move: Foundry's own waypoints when they end where the token now is, else a straight line.
  const end = { x: num(doc.x), y: num(doc.y) };
  let path: Array<{ x: number; y: number }> = [{ x: num(from.x), y: num(from.y) }, end];
  try {
    const wp: any[] = doc.movement?.passed?.waypoints ?? [];
    const last = wp[wp.length - 1];
    if (wp.length > 1 && last && Math.abs(num(last.x) - end.x) < 1 && Math.abs(num(last.y) - end.y) < 1) path = [path[0]!, ...wp.map((w: any) => ({ x: num(w.x), y: num(w.y) }))];
  } catch { /* a straight line */ }
  const pts = path.map((p) => centreOf(doc, p, size));
  const final = pts[pts.length - 1]!;
  const told = M.sidesTold(all.map((c) => ({ side: sideOfCombatant(c) })));
  const bystanders: M.Bystander[] = others.map((c) => {
    const centre = centreOf(c.token, { x: num(c.token.x), y: num(c.token.y) }, size);
    return { id: String(c.id), x: centre.x, y: centre.y, side: sideOfCombatant(c), canMelee: canMelee(c.actor), bodyMetres: ((num(doc.width) || 1) + (num(c.token.width) || 1)) / 2 * squareMetres };
  });
  const ids = new Set<string>();
  for (let i = 0; i + 1 < pts.length; i++) {
    for (const id of M.interceptors({ from: pts[i]!, to: pts[i + 1]!, end: final, moverSide: sideOfCombatant(mover), pxPerMetre: ppm, sidesTold: told, others: bystanders })) ids.add(id);
  }
  let n = 0;
  for (const id of ids) {
    const c = others.find((x) => String(x.id) === id);
    if (!c) continue;
    const key = M.offerKey({ moverId: String(mover.id), interceptorId: id, round: num(combat.round), pass: num(combat.pass) });
    if (offered.has(`${combat.id}|${key}`)) continue;
    offered.add(`${combat.id}|${key}`);
    if (offered.size > 500) offered.clear();
    await post({
      speaker: alias(), whisper: [...new Set([...gmIds(), ...(c.hidden || c.token.hidden ? [] : ownerIds(c.actor))])],
      content: `<p><strong>${escHtml(mover.name)}</strong> ${tx('SR2E.Melee95.passes', { name: escHtml(c.name), metres: num(RULES.MELEE_V95.interceptMetres) })}</p><p class="hint">${tx('SR2E.Melee95.passesHint')}</p><p><button type="button" data-sr2e-action="intercept95">${tx('SR2E.Melee95.intercept')}</button></p>`,
      flags: { [SYSTEM_ID]: { intercept95: { interceptorUuid: String(c.actor.uuid), moverUuid: String(mover.actor.uuid), tokenId: String(doc.id), sceneId: String(scene.id) } } },
    });
    n++;
  }
  return n;
}

/**
 * Whether `attacker` has an interception on `moverUuid` to make: a GM's offer card names the pair, and no interception
 * attack by them on the mover came after it (one attack per offer). The offer is the GM client's; a player's card
 * never counts.
 */
export function interceptVouched(attacker: any, moverUuid: unknown): boolean {
  if (!M.interceptionOn() || !attacker?.uuid || typeof moverUuid !== 'string' || !moverUuid) return false;
  const msgs = [...(gameNow()?.messages?.contents ?? [])].slice(-60).reverse();
  for (const m of msgs) {
    const list: any[] = (m.getFlag?.(SYSTEM_ID, 'attacks') as any[] | undefined) ?? [m.getFlag?.(SYSTEM_ID, 'attack')].filter(Boolean);
    if (list.some((x: any) => x?.intercept95 && x.attackerUuid === attacker.uuid && x.targetUuid === moverUuid)) return false;
    const o = m.getFlag?.(SYSTEM_ID, 'intercept95') as { interceptorUuid?: unknown; moverUuid?: unknown } | undefined;
    if (o && authorIsGm(m) && o.interceptorUuid === attacker.uuid && o.moverUuid === moverUuid) return true;
  }
  return false;
}

/** The defender's side: an attack marked as an interception counts only when a GM's offer names the pair. */
export function interceptVouchedFor(attackerUuid: unknown, moverUuid: unknown): boolean {
  if (!M.interceptionOn() || typeof attackerUuid !== 'string' || typeof moverUuid !== 'string') return false;
  return [...(gameNow()?.messages?.contents ?? [])].slice(-60).some((m: any) => {
    const o = m.getFlag?.(SYSTEM_ID, 'intercept95') as { interceptorUuid?: unknown; moverUuid?: unknown } | undefined;
    return Boolean(o && authorIsGm(m) && o.interceptorUuid === attackerUuid && o.moverUuid === moverUuid);
  });
}

/** The interceptor's weapon: a readied, working melee weapon, else the unarmed attack. */
function interceptWeapon(actor: any): any {
  const ready = [...(actor.items ?? [])].find((i: any) => i.type === 'weapon' && i.system?.melee && i.system?.ready !== false && !i.system?.damaged);
  if (ready) return ready;
  return actor.weaponById?.('unarmed') ?? g().CONFIG?.Actor?.documentClass?.unarmed?.() ?? null;
}

/**
 * Chat action `intercept95`: the free melee attack on the mover (Core p. 83). Only a GM's card counts (the offer is
 * made by the GM's client), only for a user who owns the interceptor; the card's data only picks the target. A small
 * window asks for Combat Pool dice (and subduing, with a Stun weapon); the attack is TN 4 with only reach, movement
 * and the attacker's condition (`AttackOptions.intercept95`), and the mover defends as on full defense.
 */
export async function onIntercept95(message: any, button: HTMLButtonElement): Promise<void> {
  const warn = (text: string): void => { g().ui?.notifications?.warn?.(escHtml(text)); };
  if (!authorIsGm(message)) return warn(tx('SR2E.Melee95.notAllowed'));
  const f = message?.getFlag?.(SYSTEM_ID, 'intercept95') as { interceptorUuid?: unknown; moverUuid?: unknown; tokenId?: unknown; sceneId?: unknown } | undefined;
  const actor = fromUuidQuiet(f?.interceptorUuid);
  if (!actor) return warn(tx('SR2E.Melee95.interceptGone'));
  if (!actor.isOwner) return warn(tx('SR2E.Melee95.onlyHolder', { name: String(actor.name) }));
  if (!canMelee(actor)) return warn(tx('SR2E.Melee95.cantIntercept', { name: String(actor.name) }));
  const mover = fromUuidQuiet(f?.moverUuid);
  if (!mover) return warn(tx('SR2E.Melee95.interceptGone'));
  if (!interceptVouched(actor, mover.uuid)) return warn(tx('SR2E.Melee95.interceptUsed'));
  const weapon = interceptWeapon(actor);
  if (!weapon) return warn(tx('SR2E.Melee95.cantIntercept', { name: String(actor.name) }));
  const left = Math.max(0, Math.floor(num(actor.system?.derived?.combatPoolLeft)));
  const canSubdue = M.subdueAllowed(weapon.system);
  const dlg: any = g().foundry?.applications?.api?.DialogV2;
  if (!dlg?.prompt) return;
  const choice = await dlg.prompt({
    window: { title: tx('SR2E.Melee95.intercept') },
    content: `<p>${tx('SR2E.Melee95.interceptAsk', { name: escHtml(actor.name), weapon: escHtml(weapon.name), mover: escHtml(mover.name) })}</p>`
      + `<div class="form-group"><label>${tx('SR2E.Melee95.poolDice', { left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>`
      + `<label class="sr2e-check"><input type="checkbox" name="subdue"${canSubdue ? '' : ` disabled title="${escHtml(tx('SR2E.Melee95.subdueStunOnly'))}"`}> ${tx('SR2E.Melee95.interceptSubdue')}</label>`,
    ok: { label: tx('SR2E.Melee95.intercept'), callback: (_e: Event, b: any) => ({ pool: Math.max(0, Math.min(left, Math.floor(Number(b.form.elements.pool.value) || 0))), subdue: canSubdue && Boolean(b.form.elements.subdue?.checked) }) },
    rejectClose: false,
  }).catch(() => null);
  if (!choice) return;
  button.disabled = true;
  const targetReach = Math.max(0, ...[...(mover.items ?? [])].filter((i: any) => i.type === 'weapon' && i.system?.melee).map((i: any) => num(i.system.reach))) + num(mover.reachBonus);
  await actor.attackWith?.(weapon, { targetUuid: String(mover.uuid), poolDice: choice.pool, subdue: choice.subdue, targetReach, intercept95: true });
}

// ---------------------------------------------------------------- the other Dice Pools (Core p. 84)

/**
 * The start of a character's action (`SR2Combat.refreshActingPool`, the GM's client): the Spell, Hacking and Task
 * Pools refresh; spell defense dice go back to the Spell Pool, and the owners and the GM are told.
 */
export async function refreshActionPools(actor: any): Promise<void> {
  const r = M.actionRefreshUpdate(actor?.system);
  if (!r) return;
  await actor.update(r.update);
  if (r.defenseBack > 0) {
    await post({ speaker: g().ChatMessage?.getSpeaker?.({ actor }), whisper: [...new Set([...gmIds(), ...ownerIds(actor)])],
      content: `<p>${tCount(r.defenseBack, 'SR2E.Melee95.defenseBack', { name: escHtml(actor.name) })}</p>` });
  }
}

// ---------------------------------------------------------------- hooks

let registered = false;

/** The status, the relay op and the hooks (once, at init). */
export function registerMelee95(): void {
  if (registered) return;
  registered = true;
  try {
    const se: any[] = g().CONFIG?.statusEffects ?? [];
    if (!se.some((x: any) => x?.id === M.WALL_STATUS)) se.push({ id: M.WALL_STATUS, name: 'SR2E.Melee95.againstWall', img: 'icons/svg/downgrade.svg' });
  } catch (err) { console.warn('sr2e | melee95 status', err); }
  onRelay('melee95', relayMelee95);
  const H: any = g().Hooks;
  // Where the token stood before the move (the mover's client knows; the GM's client reads it from the options).
  H?.on?.('preUpdateToken', (doc: any, change: any, options: any) => {
    if ((change?.x === undefined && change?.y === undefined) || !gameNow()?.combat?.started || !M.interceptionOn() || !options) return;
    options.sr2eFrom95 = { x: num(doc.x), y: num(doc.y) };
  });
  H?.on?.('updateToken', (doc: any, change: any, options: any, userId: string) => {
    if (change?.x === undefined && change?.y === undefined) return;
    // Moving away from the wall ends "against a wall" (the GM's client; with no GM on, the mover's own).
    const actor: any = doc?.actor;
    if (actor?.statuses?.has?.(M.WALL_STATUS) && (isLeadGm() || (!activeGm() && userId === gameNow()?.user?.id && actor.isOwner))) {
      void Promise.resolve(actor.toggleStatusEffect?.(M.WALL_STATUS, { active: false })).catch(() => undefined);
    }
    if (!isLeadGm() || !gameNow()?.combat?.started) return;
    void watchMove(doc, change, options).catch((err) => console.warn('sr2e | interception', err));
  });
  H?.on?.('updateWorldTime', () => {
    if (!isLeadGm() || !M.subdueControlOn() || !subduedIndex.size) return;
    void withGmLock(() => subdueTick()).catch((err) => console.warn('sr2e | subdue', err));
  });
  H?.on?.('deleteCombat', () => { offered.clear(); });
  // The subdued index (the lead GM's): one scan at ready, then the flag's changes.
  H?.once?.('ready', () => { try { scanSubdued(); } catch (err) { console.warn('sr2e | subdued index', err); } });
  H?.on?.('updateActor', (actor: any, change: any) => {
    const f = change?.flags?.[SYSTEM_ID];
    if (!f || !(FLAG_SUBDUED in f || `-=${FLAG_SUBDUED}` in f) || !actor?.uuid) return;
    if (subduedState(actor)) subduedIndex.add(String(actor.uuid)); else subduedIndex.delete(String(actor.uuid));
  });
}
