import { individualAwardRows } from '../rules/core923.ts';
import type { AttackState, DamageState, SpellState, TestSnapshot, PoolKind, BlastContext, Contest } from '../documents/index.ts';
import { opposedMelee, SR2Actor, serialTicks } from '../documents/index.ts';
import { settleClock } from './clock.ts';
import { nextInitiationGrade } from '../rules/sorcery923.ts';
import { sysNow, toSysTime } from '../helpers/clock.ts';
import { allActors } from '../helpers/actors.ts';
import { playCue, decorateItemDrags } from './qol.ts';
import { SYSTEM_ID } from '../config/system.ts';
import { pxPerMetre } from './canvas.ts';
import { retargetGroupsV73, sessionRefreshDue, localDateKey, veh80ResistPoolOn, veh923 } from '../rules/index.ts';
import { scatterDiceV79 } from '../rules/docs79-ranged.ts';
import * as U80C from '../rules/urr80-combat.ts';
import * as C923 from '../rules/combat923.ts';
import { blastThroughWalls, crossingFraction, indirectScatterDice, indirectScatterMetres, barrierSpellRadius } from '../rules/index.ts';
import { tokensNear, scatterPoint, blastBlocked, wallDistances, wallsBetweenPoints, sightBlockedBetweenPoints, wallsNear, scatterStop, tokenOf, drawArea, placeWardRegion } from './canvas.ts';
import { escHtml } from '../rules/html.ts';
import { safeAutoApply, gmApplyShapeOk, describeGmChange, cardTargetUuid, cardSourceUuids, safeInt, safePath, boundPower, boundLevel, safeStr, deepSafeKeys, trustedSource, GM_APPLY_SPECS } from '../rules/trust.ts';
import { authorIsGm, authorOwns, cardAuthor, cardTrust, speakerActorUuid, nameOfUuid, playerMay, gmMay } from './trust.ts';
import { disarmQuickRoll } from './hotkeys.ts';
import { withGmLock } from './gmlock.ts';
import { RULES, autoResists, blastRadius, blastLoss, scatter, damageLabel, scatterDiceFor, scatterMetres, confinedBlast, throwBackScatter, blastScatterDice, fusedScatter, canThrowBack, stopsAtWalls, grenadeKind, toxinOnsetLabel, scatterDirection, bearingDeg, type TargetNumberModifier } from '../rules/index.ts';
import { modKey } from '../rules/dice.ts';
import { isLeadGm, isPromptWindow, leadSettled } from './leader.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

/**
 * v0.81.0 (security review SEC1): every handler below reads the card's flags, which any player can forge (and a forged
 * card can lay an invisible full-screen button under the GM's cursor). So each one binds to `message.author`
 * (applications/trust.ts): player-side buttons need the author to be a GM or to own the acting actor, else the clicker
 * confirms a dialog built from the flags (`playerMay`); GM-side changes need the author to be a GM, to own what
 * changes, or the GM's confirmation of a dialog built from the flags (`gmMay`); numbers from flags are bounded
 * (rules/trust.ts).
 * v0.81.1: a routine test (`ROUTINE_ACTIONS`) goes ahead when the author owns the card's real source (`realSources`:
 * the attacker, the caster, the test's roller; never the speaker); a GM re-running a player's card does it as that
 * player (`asCardAuthor`); the cards of one test are only those of its author or a GM (`testChainMember`).
 */
/**
 * The uuids a card names as its origin, for a confirmation's "it says it comes from" line only: the given ones, the
 * test's roller and the speaker's actor. The card's author chooses all of them (round 2, R2-SEC-7): they never vouch
 * for the card.
 */
function origin(message: any, ...more: unknown[]): unknown[] {
  return [...more, message?.getFlag?.(SYSTEM_ID, 'test')?.actorUuid, speakerActorUuid(message)];
}

/**
 * v0.81.1 (SEC1-3, design 2): a card's real source fields for `playerMay`'s routine rule: the given ones (the attack's
 * `attackerUuid`, the spell's `casterUuid`) and the roller of the card's own test. Never the speaker.
 */
function realSources(message: any, ...more: unknown[]): unknown[] {
  return [...more, message?.getFlag?.(SYSTEM_ID, 'test')?.actorUuid];
}

/**
 * Fall-off per metre a blast from a flag can't go under: the gentlest kind in RULES (0.25, anti-vehicle rockets).
 * v0.81.1 (RB review): read when used (house rules apply after this module loads), 0.25 when the list has none.
 */
function minFallOff(): number {
  const m = Math.min(...RULES.COMBAT.grenades.map((g) => Number(g.perMetre ?? 1)).filter((n) => Number.isFinite(n) && n > 0));
  return Number.isFinite(m) ? m : 0.25;
}

/** v0.81.1 (SEC1-4, design 2): the most Defend / Resist prompts one card raises, and the most targets a player's card may prompt. */
export const MAX_CARD_PROMPTS = 12;

/**
 * v0.81.1 (SEC1-1, D1-1, design 1): run a GM's re-resolution of a card (Change target number, a Karma re-roll, a
 * bought success, Use again, Send ritual, Offer to grimoire, a blast set off) as the card's author when that isn't a
 * GM, so every "write directly or post an Apply (GM) card" choice inside follows what the author owns, not the GM's
 * rights (`SR2Actor.runAsAuthor`). A player's own click, and a GM's card, run as before. Refused (null) when this
 * version can't act as the author.
 */
export async function asCardAuthor<T>(message: any, what: string, fn: () => Promise<T>): Promise<T | null> {
  if (!game.user?.isGM) return fn();
  const cls: any = SR2Actor;
  // v0.81.1 round 3 (FIX3-BRIEF 1, V2 #1): a GM's own card goes through runAsAuthor too, with the GM as author: it waits
  // while a player's re-run holds or awaits the lock, then runs with the GM's rights (never judged as that player).
  if (authorIsGm(message)) return typeof cls.runAsAuthor === 'function' ? cls.runAsAuthor(cardAuthor(message) ?? game.user, fn) as Promise<T> : fn();
  const author = cardAuthor(message);
  if (author && typeof cls.runAsAuthor === 'function') return cls.runAsAuthor(author, fn) as Promise<T>;
  ui.notifications.warn(tx('SR2E.Notify.Chat.thisCardWasPostedByA', { what }));
  return null;
}

/** A note above a GM dialog built from a player's card: who posted it (round 2: the dialog is the confirmation). */
function posterNote(message: any): string {
  if (authorIsGm(message)) return '';
  return `<p>${tx('SR2E.Dialog.Chat.postedBy')} <strong>${escHtml(String(message?.author?.name ?? tx('SR2E.Dialog.Chat.anUnknownUser')))}</strong>${tx('SR2E.Dialog.Chat.notAGmReadFromThe')}</p>`;
}

/** A blast's Power and fall-off from a flag, bounded (a forged card can't ask for a city-block blast). */
export function boundBlast<T extends { power?: any; perMetre?: any; level?: any }>(ctx: T): T {
  const pm = Number(ctx.perMetre);
  // Power up to 200 (a big demolition charge; the same bound documents/index.ts puts on a charge); fall-off at least
  // the gentlest kind's (0 would be an endless blast; R2-SEC-10: 0.1 gave a 2 km radius at Power 200).
  return { ...ctx, power: safeInt(ctx.power, 0, 200, 0), perMetre: Number.isFinite(pm) ? Math.min(200, Math.max(minFallOff(), pm)) : 1, ...(ctx.level !== undefined ? { level: boundLevel(ctx.level) } : {}) };
}

/** A spell entry's Force and level from a flag, bounded. */
function boundSpell<T extends { force?: any; level?: any }>(s: T): T {
  return s && typeof s === 'object' ? { ...s, force: safeInt(s.force, 0, 30, 1), ...(s.level !== undefined ? { level: boundLevel(s.level) } : {}) } : s;
}

/**
 * A damage entry's Power and level from a flag, bounded. `maxPower`: 60 for a hit, 200 on a blast card (A-10: a
 * charge's entries near ground zero go past 60, as `boundBlast` allows).
 */
function boundDamage<T extends { power?: any; level?: any }>(d: T, maxPower = 60): T {
  if (!d || typeof d !== 'object') return d;
  return { ...d, ...(d.power !== undefined ? { power: safeInt(d.power, 0, maxPower, 0) } : {}), ...(d.level !== undefined ? { level: boundLevel(d.level) } : {}) };
}

/** A-10: the Power bound for a card's damage entries (a blast card's are a blast's). */
function damageCap(message: any): number {
  return message?.getFlag?.(SYSTEM_ID, 'blastAt') ? 200 : 60;
}

/** A damage type from a flag: one of the two (anything else is physical). */
function boundType(v: unknown): 'physical' | 'stun' { return v === 'stun' ? 'stun' : 'physical'; }

/** A short text from a flag (names, labels), or undefined when the flag has none. */
function flagText(v: unknown, max = 120): string | undefined { return v === undefined || v === null ? undefined : String(v).slice(0, max); }

/** The ways a disease spreads (rules/afflictions.ts `contagionReach`). */
const CONTAGION = ['', 'airborne', 'contact', 'blood'];

/**
 * v0.81.1 (A-2, D2-2, RB2-1): a toxin, drug or disease from a flag, bounded: Power and level, the damage type, its
 * texts, and a disease's recoveries, interval, incubation and spread (a forged card asked for 1e9 recoveries and an
 * interval of 0, a disease that never ends and posts a card every time step).
 */
export function boundToxin<T>(t: T): T {
  if (!t || typeof t !== 'object') return t;
  const x: any = boundDamage(t as any);
  const out: any = { ...x };
  if (x.damageType !== undefined) out.damageType = boundType(x.damageType);
  for (const k of ['name', 'vector', 'speed', 'effect', 'from', 'kind', 'label']) if (x[k] !== undefined) out[k] = flagText(x[k], k === 'name' || k === 'from' || k === 'label' ? 120 : 40);
  if (x.recoveries !== undefined) out.recoveries = safeInt(x.recoveries, 1, 30, RULES.HEALTH.disease.recoveries);
  if (x.intervalHours !== undefined) out.intervalHours = safeInt(x.intervalHours, 1, 24 * 365, 24);
  if (x.incubationHours !== undefined) out.incubationHours = safeInt(x.incubationHours, 0, 24 * 365, 0);
  if (x.contagious !== undefined) out.contagious = CONTAGION.includes(String(x.contagious)) ? String(x.contagious) : '';
  if (x.onsetAt !== undefined) out.onsetAt = Number.isFinite(Number(x.onsetAt)) ? Number(x.onsetAt) : 0;
  return out as T;
}

/**
 * v0.81.1 (A-2): an attack from a flag, bounded where the defense and the soak card read it: Power, level, successes,
 * TN, damage type, the weapon's name, and the toxin or disease it carries (they reach the card the defender posts).
 */
export function boundAttack<T extends Record<string, any>>(a: T): T {
  if (!a || typeof a !== 'object') return a;
  const x: any = { ...a, power: boundPower(a.power), level: boundLevel(a.level), attackSuccesses: safeInt(a.attackSuccesses, 0, 99, 0), damageType: boundType(a.damageType),
    weaponName: flagText(a.weaponName) ?? 'attack' };
  if (a.targetNumber !== undefined) x.targetNumber = safeInt(a.targetNumber, 2, 99, 4);
  if (a.barrierPower !== undefined) x.barrierPower = boundPower(a.barrierPower);
  if (a.extraArmor !== undefined) x.extraArmor = safeInt(a.extraArmor, 0, 30, 0);
  if (a.reach !== undefined) x.reach = safeInt(a.reach, 0, 10, 0);
  if (a.armorMultiplier !== undefined) { const m = Number(a.armorMultiplier); x.armorMultiplier = Number.isFinite(m) ? Math.min(4, Math.max(0, m)) : 1; }
  if (a.toxinHit !== undefined) x.toxinHit = a.toxinHit && typeof a.toxinHit === 'object' ? boundToxin(a.toxinHit) : undefined;
  if (a.infection !== undefined) x.infection = a.infection && typeof a.infection === 'object' ? boundToxin(a.infection) : undefined;
  return x as T;
}

/** A flag that should be a list: the list, else []. */
function listFlag<T = any>(v: unknown): T[] { return Array.isArray(v) ? v as T[] : []; }

const POOL_LABELS = (): Record<PoolKind, string> => ({ combat: tx('SR2E.App.Chat.combatPool'), spell: tx('SR2E.App.Chat.spellPool'), hacking: tx('SR2E.App.Chat.hackingPool'), control: tx('SR2E.App.Chat.controlPool'), task: tx('SR2E.App.Chat.taskPool') });

/** Ask how many pool dice to spend. Returns null if the dialog was cancelled. */
export async function promptPoolDice(actor: any, title: string, pool: PoolKind = 'combat'): Promise<number | null> {
  const left = (actor.system.derived?.[`${pool}PoolLeft`] as number | undefined) ?? 0;
  if (!(left > 0)) return 0;
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Chat.diceLeft', { poolLabels: escHtml(POOL_LABELS()[pool]), left })}</label>
      <input name="pool" type="number" value="0" min="0" max="${left}" autofocus></div>`,
    ok: { callback: (_e: Event, button: any) => Number(button.form.elements.pool.value) },
    rejectClose: false,
  });
  return typeof result === 'number' && Number.isFinite(result) ? Math.max(0, Math.min(left, Math.floor(result))) : null;
}

/** v0.58.0: take a bug a sweep found off (its owner or the GM). */
async function onRemoveBug(message: any, button: HTMLButtonElement): Promise<void> {
  const uuid = button.dataset['bugUuid'] ?? '';
  if (!uuid) return;
  // v0.81.0 (SEC1-5): the uuid comes from the card's text. At once from a GM's card, or one by the bug's owner or by
  // the owner of whoever it is planted on (read from the bug, not the card: the swept character). Round 2 (R2-SEC-4):
  // the sweeper's card about someone else's bug (an NPC's) is the GM's to confirm, naming the bug and where it is.
  const bug: any = safeStr(uuid, 400) ? await fromUuid(uuid) : null;
  if (!bug) return void ui.notifications.warn(tx('SR2E.Notify.Chat.thatBugIsGone'));
  const on = String(bug.system?.surveillance?.plantedOn ?? '');
  const plantedName = String(bug.system?.surveillance?.plantedName ?? '') || nameOfUuid(on) || 'no one';
  if (!authorIsGm(message) && !authorOwns(message, bug) && !(on && authorOwns(message, on))) {
    if (!game.user?.isGM) return void ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmOrTheBug'));
    if (!(await gmMay(message, { title: tx('SR2E.Dialog.Chat.takeABugOff'), lines: [tx('SR2E.Dialog.Chat.isTakenOff', { bugName: String(bug.name ?? tx('SR2E.Dialog.Chat.aBug')), plantedName })], always: true }))) return;
  }
  // v0.85.0: a GM's removal under the GM lock (after any dialog), like the Apply (GM) buttons; a player's is their own.
  await gmRoll(message, button, async () => {
    if (!(await fromUuid(uuid))) return void ui.notifications.info(tx('SR2E.Notify.Chat.thatBugIsAlreadyGone'));
    button.disabled = true;
    const ok = await (CONFIG.Actor.documentClass as any).removeBug(uuid);
    if (!ok) button.disabled = false;
  });
}

async function onDefend(message: any, button: HTMLButtonElement): Promise<void> {
  const list = listFlag<AttackState>(message.getFlag(SYSTEM_ID, 'attacks'));
  // SEC2b-10: a NaN index from an edited button can't defeat the once-per-target check.
  const index = safeInt(button.dataset['index'], 0, 99, 0);
  const rawAttack = (list[index] ?? message.getFlag(SYSTEM_ID, 'attack')) as AttackState | undefined;
  if (!rawAttack || typeof rawAttack !== 'object' || !safeStr(rawAttack.targetUuid, 400)) return;
  // v0.81.1 (A-2): the defense and the card it posts read the bounded attack, never the flag as written.
  const attack = boundAttack(rawAttack);
  const defender: any = await fromUuid(attack.targetUuid);
  if (!defender) return ui.notifications.warn(tx('SR2E.Notify.Chat.theDefendingActorNoLongerExists'));
  if (!(await playerMay(message, defender, origin(message, attack.attackerUuid), tx('SR2E.Card.Chat.defendsAgainstSAttackSuccesses', { defenderName: defender.name, nameOfUuid: nameOfUuid(String(attack.attackerUuid ?? '')) || tx('SR2E.Card.Chat.anAttacker'), attackWeaponName: attack.weaponName, attackPower: attack.power, attackLevel: attack.level, attackDamageType: attack.damageType, attackAttackSuccesses: attack.attackSuccesses }), { routine: realSources(message, attack.attackerUuid) }))) return;
  // v0.70.0: once per target, remembered on the card (or on the defender for a card the player can't flag).
  if (defendedOn(message, defender).includes(index) && !(await gmDefendAgain())) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatTargetHasAlreadyDefendedAgainst'));
  // Checked again once the dialog closes (a second click, or the hotkey, may have defended meanwhile); a driver
  // who owns neither the card nor the vehicle is remembered on the driver.
  let rememberOn: any = defender;
  const again = (): boolean => !game.user?.isGM && (defendedOn(message, defender).includes(index) || (rememberOn !== defender && defendedOn(message, rememberOn).includes(index)) || defending.has(`${message.id}:${index}`));
  const done = async (): Promise<void> => { await markDefended(message, rememberOn, index); defending.delete(`${message.id}:${index}`); };
  const start = (): boolean => { if (again()) { ui.notifications.warn(tx('SR2E.Notify.Chat.thatTargetHasAlreadyDefendedAgainst')); return false; } defending.add(`${message.id}:${index}`); return true; };
  // v0.57.0: a vehicle's driver at the wheel can evade with it (RULES.VEHICLES_V57.evasion).
  const wheel: any = defender.type === 'vehicle' && defender.system.controlMode === 'manual' && RULES.VEHICLES_V57.evasion.manual !== 'none' ? defender.controller?.() : null;
  if (!defender.isOwner && !wheel?.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm', { defenderName: escHtml(defender.name) }));

  // A vehicle dodges with its jumped-in rigger's Control Pool, or its driver's driving and Combat Pool.
  if (defender.type === 'vehicle') {
    const ctl: any = defender.system.controlMode === 'jumped' ? defender.controller?.() : null;
    const rigger = ctl?.system?.rigging?.jumpedIn ? ctl : null;
    let pool = 0;
    // v0.92.3 (RULES.VEHICLES_V923.vehicleDodge 'none', Rigger 2 p. 53): no dodge test, so no pool dice to ask for.
    const noDodge = veh923('vehicleDodge') === 'none';
    if (wheel) {
      if (!wheel.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm2', { wheelName: escHtml(wheel.name) }));
      if (!defender.isOwner && !message.isOwner) rememberOn = wheel;
      const p = noDodge ? 0 : await promptPoolDice(wheel, tx('SR2E.Dialog.Chat.evasiveDriving', { defenderName: defender.name, wheelName: wheel.name }), 'combat');
      if (p === null) return;
      pool = p;
    } else if (rigger && !noDodge) {
      if (!rigger.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm3', { riggerName: escHtml(rigger.name) }));
      const p = await promptPoolDice(rigger, tx('SR2E.Dialog.Chat.evasiveDriving2', { defenderName: defender.name }), 'control');
      if (p === null) return;
      pool = p;
    }
    if (!start()) return;
    button.disabled = true;
    await gmRoll(message, button, () => defender.defend(attack, pool));
    await done();
    return;
  }
  // Opposed melee: pick the weapon to defend (and counterattack) with, and pool dice.
  if (opposedMelee(attack) && typeof defender.meleeWeapons === 'function') {
    const weapons: any[] = defender.meleeWeapons();
    const left = (defender.system.derived?.combatPoolLeft as number | undefined) ?? 0;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Chat.meleeDefense', { defenderName: defender.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Chat.defendWith')}</label><select name="weapon">
          ${weapons.map((w: any) => `<option value="${escHtml(w.id)}">${escHtml(w.name)} (${damageLabel(w.system)}${w.system.reach ? tx('SR2E.Dialog.Chat.reach', { reach: escHtml(w.system.reach) }) : ''})</option>`).join('')}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Chat.combatPoolDiceLeft', { left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>
        ${fullDefenseRow(defender)}
        ${RULES.COMBAT.melee.counterattack && RULES.FIXES_V71.counterWeaponExtras ? `<label class="sr2e-check"><input type="checkbox" name="subdue"> ${tx('SR2E.Dialog.Chat.counterattackToSubdueDamage', { subdueDamageType: RULES.COMBAT.subdue.damageType })}</label>` : ''}
        <p class="hint">${tx('SR2E.Dialog.Chat.opposedTestWhoeverScoresMoreSuccesses', { part: RULES.COMBAT.melee.counterattack ? tx('SR2E.Dialog.Chat.soWinningLetsYouCounterattack') : '', part2: RULES.URR_V80.cbtDefense === 'cleanMiss' || C923.fullDefenseBook() ? tx('SR2E.Dialog.Chat.onFullDefenseLeaveThePool') : '' })}</p>`,
      ok: { label: tx('SR2E.Dialog.Chat.defend'), callback: (_e: Event, b: any) => ({ weapon: b.form.elements.weapon.value as string, pool: Math.max(0, Math.min(left, Math.floor(Number(b.form.elements.pool.value) || 0))), full: Boolean(b.form.elements.full?.checked), subdue: Boolean(b.form.elements.subdue?.checked) }) },
      rejectClose: false,
    });
    if (!choice) return;
    if (!start()) return;
    button.disabled = true;
    await gmRoll(message, button, () => defender.defend(attack, choice.pool, { weaponId: choice.weapon, fullDefense: choice.full, subdue: choice.subdue }));
    await done();
    return;
  }
  // Physical ranged attacks: pool dice to dodge, and the option of full defense.
  if (!attack.astral && !attack.matrix) {
    const left = (defender.system.derived?.combatPoolLeft as number | undefined) ?? 0;
    // v0.80.0 (URR_V80.cbtDefense 'cleanMiss'): no dodge; the pool dice go to the resistance test.
    const cm80 = U80C.cbtCleanMissRanged(attack, false);
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Chat.defend2', { defenderName: defender.name }) },
      content: `<div class="form-group"><label>${U80C.cbtDefendPoolLabel(left, cm80)}</label><input name="pool" type="number" value="0" min="0" max="${left}" autofocus></div>${cm80 ? `<p class="hint">${tx('SR2E.Dialog.Chat.noDodgePoolSuccessesAboveThe')}</p>` : fullDefenseRow(defender)}`,
      ok: { label: tx('SR2E.Dialog.Chat.defend'), callback: (_e: Event, b: any) => ({ pool: Math.max(0, Math.min(left, Math.floor(Number(b.form.elements.pool.value) || 0))), full: Boolean(b.form.elements.full?.checked) }) },
      rejectClose: false,
    });
    if (!choice) return;
    if (!start()) return;
    button.disabled = true;
    await gmRoll(message, button, () => defender.defend(attack, choice.pool, { fullDefense: choice.full }));
    await done();
    return;
  }
  const pool = await promptPoolDice(defender, tx('SR2E.Dialog.Chat.defend2', { defenderName: defender.name }), defender.poolFor?.(attack) ?? 'combat');
  if (pool === null) return;
  if (!start()) return;
  button.disabled = true;
  await gmRoll(message, button, () => defender.defend(attack, pool));
  await done();
}

/** The full-defense checkbox for Defend dialogs. */
function fullDefenseRow(defender?: any): string {
  const f = RULES.COMBAT.fullDefense;
  const attr = f.attribute.charAt(0).toUpperCase() + f.attribute.slice(1);
  // Already declared (v0.35.0): it applies to every attack until their next action, at no further cost.
  if (defender?.fullDefenseUp?.()) return `<label class="sr2e-check"><input type="checkbox" name="full" checked disabled> ${tx('SR2E.Dialog.Chat.onFullDefense', { cbtFullDefenseText: escHtml(U80C.cbtFullDefenseText(attr, true)) })}</label>`;
  const own = defender?.isActing?.();
  return `<label class="sr2e-check"><input type="checkbox" name="full"> ${tx('SR2E.Dialog.Chat.fullDefense', { cbtFullDefenseText: escHtml(U80C.cbtFullDefenseText(attr, false)), part: own ? tx('SR2E.Dialog.Chat.usesYourAction') : C923.fullDefenseInitiativeCost() ? tx('SR2E.Dialog.Chat.initiative', { initiativeCost: C923.fullDefenseInitiativeCost() }) : tx('SR2E.Card.Combat923.noInitiativeCost') })}</label>`;
}

/** Knockdown test after a heavy hit. */
async function onKnockdown(message: any, button: HTMLButtonElement): Promise<void> {
  const k = message.getFlag(SYSTEM_ID, 'knockdown') as { actorUuid: string; tn: number } | undefined;
  const actor: any = k ? await fromUuid(k.actorUuid) : null;
  if (!actor || !k) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm4', { actorName: escHtml(actor.name) }));
  const kdTn = safeInt(k.tn, 2, 30, 4);
  // R2-SEC-8: the level from the flag is bounded too.
  const kdLevel = (k as any).level === null || (k as any).level === undefined ? null : boundLevel((k as any).level);
  if (!(await playerMay(message, actor, origin(message), tx('SR2E.Card.Chat.rollsAKnockdownTestTn', { actorName: actor.name, kdTn }), { routine: realSources(message) }))) return;
  if (cardDone(message, actor, 'knockdownRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.theKnockdownTestHasAlreadyBeen'));
  button.disabled = true;
  await actor.rollKnockdown(kdTn, kdLevel);
  await markCardDone(message, actor, 'knockdownRolled');
}

/** A missed grenade: roll the scatter, find who is caught where it lands, post the blast. */
async function onBlastScatter(message: any, button: HTMLButtonElement): Promise<void> {
  const raw = message.getFlag(SYSTEM_ID, 'blast') as BlastContext | undefined;
  const actor: any = raw ? await fromUuid(raw.attackerUuid) : null;
  if (!raw || !actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.theAttackerNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm5', { actorName: escHtml(actor.name) }));
  if (!(await playerMay(message, actor))) return;
  const ctx = boundBlast(raw);
  if (cardDone(message, actor, 'scattered')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisHasAlreadyScattered'));
  button.disabled = true;
  // Scatter: Nd6 metres by range band (more for a bounced throw), less a few metres per attack success; 0 = on target.
  // v0.43.0: smart grenades take more off per success; airburst halves what is left.
  // v0.72.0 (O7): indirect fire scatters more; the spotter's successes take metres off (RULES.COMBAT_V72.indirect).
  // v0.79.0 (RULES.DOCS_V79.rangedScatter 'byType'): grenades scatter 1D6 / 2D6 / 3D6 by type; other blasts by range.
  const baseDice = blastScatterDice(U80C.cbtScatterDice(ctx as any, scatterDiceV79(ctx.scatterType, scatterDiceFor(ctx.range))), Boolean(ctx.bounce));
  const n = ctx.indirect ? indirectScatterDice(baseDice) : baseDice;
  const dist = n > 0 ? await new Roll(`${n}d6`).evaluate() : null;
  const dir = await new Roll('1d6').evaluate();
  const rolled: number[] = dist ? dist.dice[0].results.map((r: any) => r.result as number) : [];
  const metres = ctx.indirect
    ? fusedScatter(indirectScatterMetres(rolled.reduce((a, b) => a + b, 0), { attackSuccesses: ctx.successes ?? 0, spotterSuccesses: ctx.indirect.spotterSuccesses }), { fuse: ctx.fuse ?? '', smart: false, successes: 0 })
    : fusedScatter(U80C.cbtScatterMetres(scatterMetres(rolled, ctx.successes ?? 0), rolled, ctx.successes ?? 0, ctx as any), { fuse: ctx.fuse ?? '', smart: Boolean(ctx.smart), successes: ctx.successes ?? 0 });
  // v0.47.0: the direction die reads from the line of the throw (the book's diagram), when the thrower has a token.
  const thrower: any = tokenOf(actor);
  const dx = thrower ? ctx.point.x - thrower.center.x : 0, dy = thrower ? ctx.point.y - thrower.center.y : 0;
  const sd = scatterDirection(dir.dice[0].results[0].result, dx || dy ? bearingDeg(dx, dy) : null);
  const s = { metres, angleDeg: sd.angleDeg };
  let p = metres > 0 ? scatterPoint(ctx.point, s.metres, s.angleDeg) : { x: ctx.point.x, y: ctx.point.y };
  // v0.37.0: a scattering grenade stops at the first wall in its way (not an airburst, v0.43.0).
  let wallNote = '';
  if (metres > 0 && stopsAtWalls(ctx.fuse ?? '')) {
    const st = scatterStop(ctx.point, p);
    if (st.stopped) { p = { x: st.x, y: st.y }; wallNote = ` ${tx('SR2E.App.Chat.itHitsAWallAndDrops')}`; }
  }
  const point = { ...p, elevation: ctx.point.elevation };
  const extras = [ctx.bounce ? tx('SR2E.App.Chat.bounced') : '', ctx.indirect ? (ctx.indirect.spotterSuccesses ? tx('SR2E.App.Chat.indirectSpotter', { scatterMultiplier: RULES.COMBAT_V72.indirect.scatterMultiplier, spotter: ctx.indirect.spotterSuccesses * RULES.COMBAT_V72.indirect.metresPerSpotterSuccess }) : tx('SR2E.App.Chat.indirect', { scatterMultiplier: RULES.COMBAT_V72.indirect.scatterMultiplier })) : '', ctx.smart ? tx('SR2E.App.Chat.smart', { metres: (ctx.successes ?? 0) * RULES.GEAR.grenades.smart.metresPerSuccess }) : '', ctx.fuse === 'airburst' ? tx('SR2E.App.Chat.airburst', { scatterFactor: RULES.GEAR.grenades.airburst.scatterFactor }) : ''].filter(Boolean).join(', ');
  // v0.89.6: the sentence's bracket: the dice, then (self-contained) what the successes took off and the extras.
  const sc = { n, total: rolled.reduce((a, b) => a + b, 0), successes: ctx.successes ? tx('SR2E.App.Chat.mForSuccesses', { metres: ctx.successes * U80C.cbtScatterPerSuccess(ctx as any) }) : '', extras: extras ? `; ${extras}` : '' };
  const where = metres > 0 ? (sd.along ? tx('SR2E.App.Chat.itLandsMAlong', { metres, direction: sd.label, n: sc.n, total: sc.total, successes: sc.successes, extras: sc.extras }) : tx('SR2E.App.Chat.itLandsMOfTheTargetPoint', { metres, direction: sd.label, n: sc.n, total: sc.total, successes: sc.successes, extras: sc.extras })) : tx('SR2E.App.Chat.itLandsOnTarget', { n: sc.n, total: sc.total, successes: sc.successes, extras: sc.extras });
  const note = `${where}${wallNote}${ctx.fuse === 'airburst' ? ` ${tx('SR2E.App.Chat.itBurstsInTheAir')}` : ctx.fuse === 'impact' ? ` ${tx('SR2E.App.Chat.itGoesOffOnImpact')}` : ''}`;
  await markCardDone(message, actor, 'scattered');
  // v0.37.0: anyone right next to it can try to throw it back first (not rockets or charges).
  const tb = RULES.COMBAT.throwBack;
  const thrown = canThrowBack(String(ctx.kind ?? ''), String(ctx.fuse ?? '')) && !ctx.indirect;
  const near = tb.enabled && thrown ? tokensNear(point, tb.metres).filter((c) => ['character', 'npc'].includes(c.token.actor?.type)) : [];
  if (near.length) {
    const rows = near.map((c, i) => `<button type="button" data-sr2e-action="throwBack" data-index="${i}">${tx('SR2E.Card.Chat.throwsItBack', { tokenName: escHtml(c.token.name) })}</button>`).join(' ');
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="sr2e-roll"><h3>${tx('SR2E.Card.Chat.lands', { weaponName: escHtml(ctx.weaponName) })}</h3><p>${escHtml(note)}</p></div><p>${tx('SR2E.Card.Chat.withinM', { tbMetres: tb.metres, near: near.map((c) => escHtml(c.token.name)).join(', ') })}</p><p>${rows} <button type="button" data-sr2e-action="letItBlow">${tx('SR2E.Card.Chat.itGoesOff')}</button></p>`,
      flags: { [SYSTEM_ID]: { pendingBlast: { ctx, point, note, near: near.map((c) => c.token.actor.uuid) } } },
      // v0.81.1 (SEC1-5): a GM scattering a player's grenade posts this card as that player (it stays theirs).
      ...sameAuthorAs(message),
    });
    return;
  }
  await asCardAuthor(message, tx('SR2E.Card.Chat.scatter'), () => detonateAt(actor, ctx, point, escHtml(note)));
}

/**
 * v0.81.1 (SEC1-5): the author for a card a GM's client posts while acting on a player's card: that player (so the
 * new card is still theirs, and every later check reads it as theirs). Nothing for a GM's card or a player's click.
 */
function sameAuthorAs(message: any): { author?: string } {
  if (!game.user?.isGM || authorIsGm(message)) return {};
  const id = cardAuthor(message)?.id;
  return typeof id === 'string' && id ? { author: id } : {};
}

/** A blast goes off at a point: who is caught, walls shielding, confined spaces (v0.21.0; split out in v0.37.0). */
export async function detonateAt(actor: any, ctx: BlastContext, point: { x: number; y: number; elevation?: number }, note: string): Promise<void> {
  // v0.61.0: fired too close to arm: it lands without going off.
  if (ctx.dud) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="sr2e-roll"><h3>${tx('SR2E.Card.Chat.noBlast', { weaponName: escHtml(ctx.weaponName ?? tx('SR2E.Card.Chat.grenade')) })}</h3><p>${note}</p></div><p>${tx('SR2E.Card.Chat.firedInsideItsMinimumArmingRange')}</p>` });
    return;
  }
  // v0.78.0 (RULES.BOOK_V78.flash 'book'): a flash reaches everyone with a clear line to it out to `maxMetres`.
  const flashBook = grenadeKind(ctx.kind).effect === 'blind' && RULES.BOOK_V78.flash.mode === 'book';
  const radius = flashBook ? Math.max(blastRadius(ctx.power, ctx.perMetre), RULES.BOOK_V78.flash.maxMetres) : blastRadius(ctx.power, ctx.perMetre);
  // v0.59.0: the blast drawn on the map until the next Combat Turn.
  // v0.61.0: a smoke grenade draws its own lingering cloud in postBlast instead.
  if (grenadeKind(ctx.kind).effect !== 'smoke') void drawArea(point, radius, `${ctx.weaponName ?? 'Blast'} (${radius} m)`);
  // v0.43.0: vehicles are caught by damaging blasts (not flash or gas).
  const all = tokensNear(point, radius, { vehicles: !grenadeKind(ctx.kind).effect });
  const conf = confinedBlast(ctx.power, ctx.perMetre, wallDistances(point, radius));
  // v0.72.0 (O1): walls take Power off a blast by their barrier rating; a strong one holds (RULES.COMBAT_V72.blastBarriers).
  // 'block' (the old way) keeps the movement-collision test.
  const graded = all.map((c) => {
    if (!RULES.COMBAT.wallsBlock) return { c, r: null as ReturnType<typeof blastThroughWalls> | null };
    // The flash is light: any wall that blocks sight shields it (no barrier ratings).
    if (flashBook) return { c, r: sightBlockedBetweenPoints(point, c.token.center) ? { blocked: true, loss: 0, extraArmor: 0, walls: [], note: '' } as ReturnType<typeof blastThroughWalls> : null };
    if (RULES.COMBAT_V72.blastBarriers.mode === 'block') return { c, r: blastBlocked(point, c.token) ? { blocked: true, loss: 0, extraArmor: 0, walls: [], note: '' } as ReturnType<typeof blastThroughWalls> : null };
    const to = c.token.center;
    const metresTo = Math.hypot(to.x - point.x, to.y - point.y) / pxPerMetre();
    const walls = wallsBetweenPoints(point, to).map((w) => {
      const raw = w.doc?.getFlag?.(SYSTEM_ID, 'barrierRating') ?? w.doc?.flags?.sr2e?.barrierRating;
      const t = crossingFraction(point, to, w.doc?.c ?? []) ?? 0;
      // Review fix: walls saved before v0.72.0 stored 0 for "not set": 0 counts as unrated for blasts.
      return { metres: t * metresTo, rating: raw === null || raw === undefined || raw === '' || !(Number(raw) > 0) ? null : Number(raw) };
    });
    return { c, r: walls.length ? blastThroughWalls({ power: ctx.power + conf.bonus, perMetre: ctx.perMetre, walls }) : null };
  });
  const passed = graded.filter((g) => !g.r?.blocked);
  const shielded = all.length - passed.length;
  // Review fix: list "through walls" only for those the blast still reaches with some Power.
  const through = passed.filter((g) => g.r && (g.r.loss || g.r.extraArmor) && ctx.power + conf.bonus - blastLoss(g.c.metres, ctx.perMetre) - (g.r.loss || 0) > 0).map((g) => `${escHtml(g.c.token.name)} (${escHtml(g.r!.note)})`);
  await actor.postBlast(U80C.cbtBlastStaged(ctx), passed.map(({ c, r }) => ({ targetUuid: c.token.actor.uuid, name: c.token.name, metres: c.metres, ...(r?.loss ? { barrierLoss: r.loss } : {}), ...(r?.extraArmor ? { barrierArmor: r.extraArmor } : {}) })),
    `${note}${shielded ? tx('SR2E.Card.Chat.shielded', { part: shielded === 1 ? tx('SR2E.Card.Chat.n1TargetBehindAWallIs') : tx('SR2E.Card.Chat.targetsBehindWallsAre', { shielded }) }) : ''}${through.length ? tx('SR2E.Card.Chat.throughWalls', { through: through.join(', ') }) : ''}`,
    conf.bonus, point);
}

/** Someone next to a landed grenade grabs it and throws it back (v0.37.0). */
async function onThrowBack(message: any, button: HTMLButtonElement): Promise<void> {
  const rawPb = message.getFlag(SYSTEM_ID, 'pendingBlast') as { ctx: BlastContext; point: any; note: string; near: string[] } | undefined;
  if (!rawPb?.ctx || !Array.isArray(rawPb.near)) return;
  const pb = { ...rawPb, ctx: boundBlast(rawPb.ctx) };
  const note = escHtml(rawPb.note); // the flag holds the plain text; detonateAt takes HTML
  const who: any = await fromUuid(pb.near[safeInt(button.dataset['index'], 0, 99, 0)] ?? '');
  const attacker: any = await fromUuid(pb.ctx.attackerUuid);
  if (!who || !attacker) return ui.notifications.warn(tx('SR2E.Notify.Chat.theyAreNoLongerHere'));
  if (cardDone(message, [attacker, who], 'blasted')) return ui.notifications.warn(tx('SR2E.Notify.Chat.itHasAlreadyGoneOff'));
  if (!who.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm6', { whoName: escHtml(who.name) }));
  if (!(await playerMay(message, who, origin(message, attacker.uuid), tx('SR2E.Card.Chat.triesToThrowSBackPower', { whoName: who.name, attackerName: attacker.name, slice: String(pb.ctx.weaponName ?? 'grenade').slice(0, 120), pbPower: pb.ctx.power })))) return;
  button.disabled = true;
  const r = await who.throwBackTest();
  await markCardDone(message, attacker.isOwner ? attacker : who, 'blasted');
  // v0.81.1 (SEC1-5): the grenade is still the card author's: it goes off as theirs.
  if (r.successes <= 0) return void (await asCardAuthor(message, tx('SR2E.Card.Chat.theBlast'), () => detonateAt(attacker, pb.ctx, pb.point, tx('SR2E.Card.Chat.couldnTThrowItBack', { note, whoName: escHtml(who.name) }))));
  const from: any = tokenOf(attacker);
  if (!from) return void (await asCardAuthor(message, tx('SR2E.Card.Chat.theBlast'), () => detonateAt(attacker, pb.ctx, pb.point, tx('SR2E.Card.Chat.thrownBackButTheThrowerHas', { note }))));
  const d6 = await new Roll(`${RULES.COMBAT.throwBack.scatterDice}d6`).evaluate();
  const rolled = d6.dice[0].results.reduce((n: number, x: any) => n + x.result, 0);
  const metres = throwBackScatter(rolled, r.successes);
  const dir = await new Roll('1d6').evaluate();
  const sc = scatter([metres], dir.dice[0].results[0].result);
  let p = metres > 0 ? scatterPoint(from.center, sc.metres, sc.angleDeg) : { x: from.center.x, y: from.center.y };
  if (RULES.COMBAT.stopAtWalls) { const st = scatterStop(pb.point, p); p = { x: st.x, y: st.y }; }
  await asCardAuthor(message, tx('SR2E.Card.Chat.theBlast'), () => detonateAt(attacker, { ...pb.ctx, weaponName: tx('SR2E.App.Chat.thrownBack', { weaponName: pb.ctx.weaponName }) }, { ...p, elevation: pb.point.elevation ?? 0 }, tx('SR2E.Card.Chat.throwsItBackItLands', { whoName: escHtml(who.name), part: metres ? tx('SR2E.Card.Chat.mFrom', { metres }) : tx('SR2E.Card.Chat.at'), attackerName: escHtml(attacker.name) })));
}

async function onLetItBlow(message: any, button: HTMLButtonElement): Promise<void> {
  const pb = message.getFlag(SYSTEM_ID, 'pendingBlast') as { ctx: BlastContext; point: any; note: string; near?: string[] } | undefined;
  const attacker: any = pb?.ctx ? await fromUuid(pb.ctx.attackerUuid) : null;
  if (!pb || !attacker) return;
  if (!attacker.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm7', { attackerName: escHtml(attacker.name) }));
  if (!(await playerMay(message, attacker))) return;
  // Someone near it may have thrown it back already (recorded on their actor when they can't flag the card).
  const near = listFlag<string>(pb.near).map((u) => fromUuidSync(u)).filter(Boolean);
  if (cardDone(message, [attacker, ...near], 'blasted')) return ui.notifications.warn(tx('SR2E.Notify.Chat.itHasAlreadyGoneOff'));
  button.disabled = true;
  await markCardDone(message, attacker, 'blasted');
  await asCardAuthor(message, tx('SR2E.Card.Chat.itGoesOff'), () => detonateAt(attacker, boundBlast(pb.ctx), pb.point, escHtml(pb.note)));
}

/** A set charge goes off: at the targeted token, else where it was set, else at the setter (v0.37.0; timers v0.43.0). */
async function onDetonateCharge(message: any, button: HTMLButtonElement): Promise<void> {
  const raw = message.getFlag(SYSTEM_ID, 'charge') as { actorUuid: string; name: string; power: number; perMetre: number; shaped: boolean; point?: { x: number; y: number; elevation: number }; chargeId?: string; sceneId?: string } | undefined;
  const actor: any = raw ? await fromUuid(raw.actorUuid) : null;
  if (!raw || !actor) return;
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm8', { actorName: escHtml(actor.name) }));
  // v0.81.0 (SEC1-6, SEC1-12): only the setter's own card (or a GM's); a timed charge's Power comes from the
  // scene's armed-charge record (GM-owned), any other is bounded.
  if (!(await playerMay(message, actor))) return;
  if (cardDone(message, actor, 'blasted')) return ui.notifications.warn(tx('SR2E.Notify.Chat.itHasAlreadyGoneOff'));
  const cls: any = CONFIG.Actor.documentClass;
  const armed: any = raw.chargeId ? cls.storedCharge?.(actor, String(raw.chargeId), String(raw.sceneId ?? '')) ?? null : null;
  // v0.81.1 (SEC1-16, D1-11): a player's card stands only for a charge on record (bounded by its explosive item).
  // Round 3 (FIX3-BRIEF 2, V2 #8, H5): with no record (its explosive gone, or a card from before v0.81.0) a player's click
  // is refused; a GM's click confirms a dialog naming the Power (documents' detonateConfirmText when there is one).
  let confirmed: { power: number; perMetre: number; shaped: boolean } | null = null;
  if (!armed && !authorIsGm(message)) {
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatChargeIsnTOnRecord'));
    const b = boundBlast({ power: raw.power, perMetre: raw.perMetre });
    const doc: any = cls.detonateConfirmText?.(actor, String(raw.chargeId ?? ''), String(raw.sceneId ?? ''), raw) ?? null;
    const text = typeof doc === 'string' ? doc : typeof doc?.text === 'string' ? doc.text : '';
    confirmed = doc && typeof doc === 'object' && Number.isFinite(Number(doc.power))
      ? { power: safeInt(doc.power, 0, 200, 0), perMetre: Number.isFinite(Number(doc.perMetre)) ? boundBlast({ power: 0, perMetre: doc.perMetre }).perMetre : b.perMetre, shaped: Boolean(doc.shaped) }
      : { power: b.power, perMetre: b.perMetre, shaped: Boolean(raw.shaped) };
    const lines = [text || tx('SR2E.Dialog.Chat.goesOffAtPowerPerMetre', { slice: String(raw.name ?? 'A charge').slice(0, 120), confirmedPower: confirmed.power, confirmedPerMetre: confirmed.perMetre, part: confirmed.shaped ? tx('SR2E.Dialog.Chat.shaped') : '' }),
      doc ? tx('SR2E.Dialog.Chat.theSetterSRecordStillHolds') : tx('SR2E.Dialog.Chat.noStoredRecordBacksItThe')];
    if (!(await gmMay(message, { title: tx('SR2E.Dialog.Chat.detonateACharge'), lines, sources: [actor.uuid], always: true }))) return;
  }
  const c = boundBlast({ ...raw, name: String(raw.name ?? 'Charge'), ...(armed ? { power: armed.power, perMetre: armed.perMetre, shaped: armed.shaped, point: armed.point } : confirmed ?? {}) });
  if (c.sceneId && canvas?.scene?.id !== c.sceneId) return ui.notifications.warn(tx('SR2E.Notify.Chat.viewTheSceneTheChargeIs'));
  const picked: any = game.user?.targets?.first?.() ?? null;
  const setter: any = tokenOf(actor);
  const point = picked ? { x: picked.center.x, y: picked.center.y, elevation: Number(picked.document?.elevation) || 0 }
    : c.point ?? (setter ? { x: setter.center.x, y: setter.center.y, elevation: Number(setter.document?.elevation) || 0 } : null);
  if (!point) return ui.notifications.warn(tx('SR2E.Notify.Chat.targetTheTokenTheChargeIs'));
  button.disabled = true;
  await markCardDone(message, actor, 'blasted');
  // A timed charge still waiting: clear its timer (the GM's client; on a player's client the GM's timer
  // checks the setter's own record of this card too: chargeTicks).
  if (c.chargeId && c.sceneId && game.user?.isGM) {
    const scene: any = game.scenes?.get?.(c.sceneId);
    if (scene) await scene.setFlag(SYSTEM_ID, 'charges', cls.armedCharges(scene).filter((x: any) => x.id !== c.chargeId));
  }
  const ctx: BlastContext = {
    attackerUuid: actor.uuid, weaponName: c.name, power: c.power, level: RULES.COMBAT.demolitions.level, damageType: 'physical',
    perMetre: c.shaped ? Math.max(c.perMetre, c.power) : c.perMetre, point,
    dodge: false, kind: 'demolition', ...(c.shaped ? { shaped: true } : {}),
  };
  await asCardAuthor(message, tx('SR2E.Card.Chat.detonate'), () => detonateAt(actor, ctx, ctx.point, (picked ? tx('SR2E.Card.Chat.goesOffAt', { name: escHtml(c.name), pickedName: escHtml(picked.name), part: c.shaped ? tx('SR2E.Card.Chat.shapedTheForceGoesIntoWhat') : '' }) : c.point ? tx('SR2E.Card.Chat.goesOffWhereItWasSet', { name: escHtml(c.name), part: c.shaped ? tx('SR2E.Card.Chat.shapedTheForceGoesIntoWhat') : '' }) : tx('SR2E.Card.Chat.goesOff', { name: escHtml(c.name), part: c.shaped ? tx('SR2E.Card.Chat.shapedTheForceGoesIntoWhat') : '' }))));
}

/**
 * v0.54.0: whether a once-per-card button was used. A player who doesn't own the card (a GM's card)
 * can't flag it, so the use is also kept on the actor they own (`cardRolls`, as `<message id>:<key>`).
 */
function cardDone(message: any, actors: any, key: string): boolean {
  // v0.70.0: once per test, not per card: a Karma re-roll's card (same testId) doesn't bring the button back.
  return sameTestCards(message).some((m: any) => m.getFlag?.(SYSTEM_ID, key)
    || [actors].flat().some((actor: any) => actor && cardRolled(actor, `${m.id}:${key}`)));
}

/** v0.71.0: a snapshot's testId, or a contest's id (contest cards get Karma re-rolls too). */
function cardKey(message: any): string | undefined {
  return (SR2Actor as any).cardKey?.(message);
}

/**
 * v0.70.0: this card and every other card of the same test (a Karma re-roll, a bought success, a GM TN change).
 * v0.81.1 (SEC1-2, design 5): only the cards of its own chain (`testChain`): a card by someone else that reuses the
 * test's id is not one of them.
 */
function sameTestCards(message: any): any[] {
  const others = chainOf(message).filter((m: any) => m !== message && m.id !== message.id);
  return [message, ...others];
}

/** The id of a message's author ('' when unknown). */
function authorIdOf(m: any): string {
  const a = m?.author ?? m?.user;
  const id = typeof a === 'string' ? a : a?.id;
  return typeof id === 'string' ? id : '';
}

/**
 * v0.81.1 (SEC1-2, design 5): whether `m` belongs to the test chain `first` started: its author is a GM, or is
 * `first`'s author, or (a contest, whose sides post their own Karma cards) owns one of the sides `first` lists. Any
 * player can copy a card's test id into a card of their own: such a card neither replaces nor switches off the chain's
 * cards, and its "defended" and "resisted" marks don't count for them.
 */
export function testChainMember(first: any, m: any): boolean {
  if (m === first || (m?.id && m.id === first?.id)) return true;
  if (authorIsGm(m)) return true;
  const id = authorIdOf(m);
  // The same author (two cards with no author at all only in tests: a message always has one in Foundry).
  if (id === authorIdOf(first)) return true;
  const contest = first?.getFlag?.(SYSTEM_ID, 'contest');
  return Boolean(contest && listFlag(contest.sides).some((x: any) => safeStr(x?.uuid, 400) && authorOwns(m, x.uuid)));
}

/** v0.81.1: a message's test chain (oldest first), or just the message when it isn't in one. */
function chainOf(message: any): any[] {
  const id = cardKey(message);
  if (!id) return [message];
  const list = testIndex().byTest.get(id) ?? [];
  return list.some((m: any) => m === message || (m.id && m.id === message?.id)) ? list : [message];
}

/**
 * v0.70.0: the newest card of each test (testId → message id), rebuilt when the chat log changes; v0.81.0 (A-11):
 * and every card of each test (testId → messages), so sameTestCards doesn't scan the log. v0.81.1 (design 5): each
 * test's chain holds only the cards `testChainMember` lets in.
 */
let newestCache: { key: string; map: Map<string, string>; byTest: Map<string, any[]> } | null = null;
function testIndex(): { map: Map<string, string>; byTest: Map<string, any[]> } {
  const msgs: any = (game as any).messages;
  const list: any[] = [...(msgs?.contents ?? [])];
  const key = `${list.length}:${list[list.length - 1]?.id ?? ''}`;
  if (newestCache?.key === key) return newestCache;
  const map = new Map<string, string>();
  const byTest = new Map<string, any[]>();
  for (const m of list) {
    const id = cardKey(m);
    if (!id) continue;
    const l = byTest.get(id);
    if (l && !testChainMember(l[0], m)) continue;
    map.set(id, m.id);
    if (l) l.push(m); else byTest.set(id, [m]);
  }
  newestCache = { key, map, byTest };
  return newestCache;
}

/**
 * v0.70.0: why a card's buttons are dead: 'gm' (the GM changed its TN) or 'newer' (a Karma re-roll or a
 * bought success posted a newer card of the same test). Before, only the GM's change switched them off.
 * v0.81.1 (SEC1-2): only a newer card of its own chain replaces it.
 */
export function cardReplaced(message: any): false | 'gm' | 'newer' {
  if (!message) return false;
  if (message.getFlag?.(SYSTEM_ID, 'supersededBy')) return 'gm';
  const chain = chainOf(message);
  const newest = chain[chain.length - 1];
  return newest && newest !== message && newest.id !== message.id ? 'newer' : false;
}

/** Why a card's buttons are dead, in the reader's language (v0.89.3: was a table of English texts). */
const replacedText = (why: 'gm' | 'newer'): string => (why === 'gm' ? tx('SR2E.Card.Chat.replacedTheGmChangedThe') : tx('SR2E.Card.Chat.replacedAKarmaReRollOr'));

/** v0.70.0: switch a replaced card's buttons off and say why (on a render, or straight away in the DOM). */
function deadenCard(html: Element, why: 'gm' | 'newer'): void {
  html.querySelectorAll<HTMLButtonElement>('button[data-sr2e-action]').forEach((b) => { b.disabled = true; });
  html.querySelector('.sr2e-gm-tools')?.remove();
  const c = html.querySelector('.message-content') ?? html;
  if (!c.querySelector('.sr2e-superseded')) {
    const p = document.createElement('p');
    p.className = 'sr2e-superseded hint';
    p.textContent = replacedText(why);
    c.appendChild(p);
  }
}

/** v0.70.0: a new card of a test switches the older cards of that test off where they are already shown. */
function deadenOlderCards(message: any): void {
  const id = cardKey(message);
  if (!id) return;
  for (const m of sameTestCards(message)) {
    if (m === message || m.id === message.id) continue;
    document.querySelectorAll(`[data-message-id="${m.id}"]`).forEach((el) => deadenCard(el, m.getFlag?.(SYSTEM_ID, 'supersededBy') ? 'gm' : 'newer'));
  }
}

/** v0.70.0: indices on an attack card whose targets have defended (Defend is once per target, like Resist). */
export function defendedOn(message: any, defender?: any): number[] {
  return usedOn(message, 'defended', defender);
}
/** Defenses running right now on this client (`<message id>:<index>`): a second click waits out the first. */
const defending = new Set<string>();
/** v0.70.0: every shown copy of a card's button for this index goes dead (the chat log and the pop-up). */
function deadenCopies(message: any, action: string, index: number): void {
  document.querySelectorAll<HTMLButtonElement>(`[data-message-id="${message.id}"] button[data-sr2e-action="${action}"]`).forEach((b) => {
    if (Number(b.dataset['index'] ?? 0) === index) b.disabled = true;
  });
}
async function markDefended(message: any, defender: any, index: number): Promise<void> {
  deadenCopies(message, 'defend', index);
  if (message.isOwner) await message.setFlag(SYSTEM_ID, 'defended', [...new Set([...defendedOn(message), index])]);
  else if (defender?.isOwner) await markCardRolled(defender, `${message.id}:defended:${index}`);
}
async function gmDefendAgain(): Promise<boolean> {
  if (!game.user?.isGM) return false;
  return Boolean(await foundry.applications.api.DialogV2.confirm({
    window: { title: tx('SR2E.Dialog.Chat.alreadyDefended') }, content: `<p>${tx('SR2E.Dialog.Chat.thisTargetHasAlreadyDefendedAgainst')}</p>`, rejectClose: false,
  }));
}
async function markCardDone(message: any, actor: any, key: string): Promise<void> {
  if (message.isOwner) { await message.setFlag(SYSTEM_ID, key, true); return; }
  if (actor?.isOwner) await markCardRolled(actor, `${message.id}:${key}`);
}

/** A heavy hit's cyberware damage check (v0.43.0): once per card. */
async function onCyberDamage(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'cyberDamage') as { actorUuid: string; location: string; level?: string } | undefined;
  const actor: any = f ? await fromUuid(f.actorUuid) : null;
  if (!f || !actor) return;
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm4', { actorName: escHtml(actor.name) }));
  if (!(await playerMay(message, actor, origin(message), tx('SR2E.Card.Chat.rollsACyberwareDamageCheckInstalled', { actorName: actor.name, slice: String(f.location ?? '').slice(0, 60) })))) return;
  if (cardDone(message, actor, 'cyberDamageRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.theCyberwareCheckHasAlreadyBeen'));
  button.disabled = true;
  // v0.92.3: the wound's level (RULES.GEAR_V923.cyberDamage 'book' counts the systems hit by it).
  await actor.cyberDamageCheck(String(f.location ?? '').slice(0, 60), ['L', 'M', 'S', 'D'].includes(String(f.level ?? '')) ? String(f.level) : '');
  await markCardDone(message, actor, 'cyberDamageRolled');
  if (message.isOwner) {
    // A Karma re-roll of this card must not roll it again.
    const snap = message.getFlag(SYSTEM_ID, 'test') as any;
    if (snap?.soak?.cyberCheck) await message.setFlag(SYSTEM_ID, 'test', { ...snap, soak: { ...snap.soak, cyberCheck: { ...snap.soak.cyberCheck, rolled: true } } });
  }
}

/** A flamethrower hit sets the target alight: they resist being on fire (v0.37.0). */
async function onCatchFire(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'catchFire') as { targetUuid: string } | undefined;
  const t: any = f ? await fromUuid(f.targetUuid) : null;
  if (!t) return;
  if (!t.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm9', { tName: escHtml(t.name) }));
  if (!(await playerMay(message, t, origin(message), (RULES.COMBAT.burning.enabled ? tx('SR2E.Card.Chat.catchesFireKeepsBurning', { name: t.name }) : tx('SR2E.Card.Chat.catchesFireResistsTheFlames', { name: t.name })), { routine: realSources(message, message.getFlag(SYSTEM_ID, 'test')?.defendAgainst?.attackerUuid) }))) return;
  if (cardDone(message, t, 'onFire')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyRolled'));
  button.disabled = true;
  await t.resistHazard?.('fire', RULES.COMBAT.flame.catchFire);
  await markCardDone(message, t, 'onFire');
  // v0.55.0: they keep burning each Combat Turn until the flames are put out.
  if (RULES.COMBAT.burning.enabled) {
    await t.setOnFire?.(true);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: t }), content: `<p><strong>${escHtml(t.name)}</strong> ${tx('SR2E.Card.Chat.isOnFireItBurnsAgain')} <button type="button" data-sr2e-action="putOutFire">${tx('SR2E.Card.Chat.putOutTheFlames')}</button></p>`, flags: { [SYSTEM_ID]: { putOutFire: { actorUuid: t.uuid } } } });
  }
  // v0.45.0: the flames spread to the scene around them.
  await t.spreadFireFromMe?.(`${t.name} set alight`);
}

/** An elemental spell's secondary effect on the target (v0.39.0). */
async function onElementEffect(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'elementEffect') as { targetUuid: string; kind: string; force: number } | undefined;
  const t: any = f ? await fromUuid(f.targetUuid) : null;
  if (!t) return;
  if (!t.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm9', { tName: escHtml(t.name) }));
  // v0.81.1 (A-1, design 2): armour corroded, a fire started: lasting, so not routine; the kind is a short word.
  if (!/^[a-z]{1,20}$/i.test(String(f!.kind ?? ''))) return;
  if (!(await playerMay(message, t, origin(message), tx('SR2E.Card.Chat.suffersAEffectForceItMay', { name: t.name, kind: String(f!.kind), force: safeInt(f!.force, 0, 30, 0) })))) return;
  if (cardDone(message, t, 'elementEffectDone')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyDone'));
  button.disabled = true;
  await t.applyElementEffect?.(String(f!.kind ?? ''), safeInt(f!.force, 0, 30, 0));
  await markCardDone(message, t, 'elementEffectDone');
}

/** Send a prepared ritual (v0.39.0): the leader's owner or the GM. */
async function onSendRitual(message: any, button: HTMLButtonElement): Promise<void> {
  const prep = message.getFlag(SYSTEM_ID, 'ritualPrep') as any;
  if (!prep) return;
  const caster: any = await fromUuid(prep.casterUuid);
  if (cardDone(message, caster, 'ritualSent')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisRitualHasBeenSent'));
  if (!caster?.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheRitualLeaderSOwner'));
  if (!(await playerMay(message, caster)) || !deepSafeKeys(prep)) return;
  button.disabled = true;
  const cls: any = CONFIG.Actor.documentClass;
  // v0.81.1 (SEC1-1, design 1): a GM sending a player's ritual casts it as that player.
  const ok = await asCardAuthor(message, tx('SR2E.Card.Chat.sendRitual'), async () => cls.sendRitual?.(prep, Boolean(game.user?.isGM)));
  if (!ok) { button.disabled = false; return; }
  await markCardDone(message, caster, 'ritualSent');
}

/** GM: damage the walls between attacker and target (shot through), or near a blast (v0.37.0). */
async function onBarrierDamage(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return;
  const cls: any = CONFIG.Actor.documentClass;
  const snap = message.getFlag(SYSTEM_ID, 'test') as TestSnapshot | undefined;
  // v0.81.0 (SEC1-5), round 2 (R2-SEC-7): the dialog below is the GM's confirmation: it lists each wall and its Power
  // and, for a player's card, who posted it (the attacker the card names is the author's choice).
  const rawAt = message.getFlag(SYSTEM_ID, 'blastAt') as { point: any; power: number; perMetre: number; shaped?: boolean; antiVehicle?: boolean } | undefined;
  const at = rawAt?.point ? boundBlast(rawAt) : undefined;
  let rows: Array<{ doc: any; rating: number; power: number; antiVehicle?: boolean; shaped?: boolean; label: string; kind?: 'firearm' | 'melee' | 'blast' }> = [];
  if (at) {
    rows = wallsNear(at.point, Math.max(1, at.shaped ? 1 : blastRadius(at.power, at.perMetre))).map((w) => ({
      doc: w.doc, rating: w.rating, power: Math.max(0, at.power - blastLoss(w.metres, at.shaped ? 0 : at.perMetre)), shaped: at.shaped, antiVehicle: at.antiVehicle, label: tx('SR2E.App.Chat.wallMAway', { metres: w.metres }), kind: 'blast' as const,
    }));
  } else if (snap?.attack) {
    const a: any = await fromUuid(snap.attack.attackerUuid);
    const t: any = await fromUuid(snap.attack.targetUuid);
    const ta = tokenOf(a), tt = tokenOf(t);
    if (ta && tt) rows = wallsBetweenPoints(ta.center, tt.center).map((w, i) => ({ doc: w.doc, rating: w.rating, power: boundPower(RULES.BOOK_V78.barriers.mode === 'book' ? (snap.attack!.barrierPower ?? snap.attack!.power) : snap.attack!.power), antiVehicle: Boolean(snap.attack!.antiVehicle), label: tx('SR2E.App.Chat.wallInTheLineOfFire', { n: i + 1 }), kind: snap.attack!.melee ? 'melee' as const : 'firearm' as const }));
  }
  if (!rows.length) return ui.notifications.info(tx('SR2E.Notify.Chat.noWallsFoundAreBothTokens'));
  const picked = await (foundry as any).applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Chat.damageBarriers') },
    content: posterNote(message) + rows.map((r, i) => {
      // v0.78.0 (RULES.BOOK_V78.barriers 'book'): pre-tick the walls the Power would damage (half the adjusted rating).
      const adj = RULES.BOOK_V78.barriers.mode === 'book' ? r.rating * (RULES.BOOK_V78.barriers.ratingMultiplier[r.kind ?? 'firearm'] ?? 1) : r.rating;
      const hurts = RULES.BOOK_V78.barriers.mode === 'book' ? r.power >= adj / 2 : r.power > r.rating;
      return `<label class="sr2e-check"><input type="checkbox" name="w" value="${i}" ${hurts ? 'checked' : ''}> ${tx('SR2E.Dialog.Chat.ratingPower', { label: escHtml(r.label), rating: r.rating, part: adj !== r.rating ? tx('SR2E.Dialog.Chat.againstIt', { adj }) : '', power: r.power })}</label>`;
    }).join(''),
    ok: { label: tx('SR2E.Dialog.Chat.apply'), callback: (_e: Event, b: any) => [...b.form.querySelectorAll('input[name="w"]:checked')].map((x: any) => Number(x.value)) },
    rejectClose: false,
  });
  if (!picked?.length) return;
  button.disabled = true;
  // v0.85.0: the walls are damaged under the GM lock (after the dialog).
  try {
    await gmLocked(message, button, async () => {
      for (const i of picked) { const r = rows[i]; if (!r) continue; await cls.damageWall(r.doc, r.power, { antiVehicle: r.antiVehicle, shaped: r.shaped, label: r.label, kind: r.kind ?? 'firearm' }); }
    });
  } finally { button.disabled = false; }
}



/** GM: a player's spell cast at a wall (v0.47.0) is applied to the wall. */
async function onSpellWall(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanDamageWalls'));
  const w = message.getFlag(SYSTEM_ID, 'spellWall') as { wallUuid: string; power: number; label: string } | undefined;
  if (!w || !safeStr(w.wallUuid, 400) || message.getFlag(SYSTEM_ID, 'spellWallApplied')) return;
  const doc: any = await fromUuid(w.wallUuid);
  if (!doc) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatWallIsGone'));
  const power = boundPower(w.power);
  const label = String(w.label ?? tx('SR2E.App.Chat.aSpell')).slice(0, 120);
  if (!(await gmMay(message, { title: tx('SR2E.Dialog.Chat.damageAWall'), lines: [tx('SR2E.Dialog.Chat.powerOnTheWall', { label, power })], sources: realSources(message) }))) return;
  await gmLocked(message, button, async () => {
    // v0.85.0: under the GM lock, checked again (a second click while the dialog was open).
    if (message.getFlag(SYSTEM_ID, 'spellWallApplied')) return;
    button.disabled = true;
    await (CONFIG.Actor.documentClass as any).damageWall(doc, power, { label, kind: 'combatSpell' });
    await message.setFlag(SYSTEM_ID, 'spellWallApplied', true);
  });
}

/** Indices on a multi-target card that have already resisted (v0.35.0). */
function resistedOn(message: any, target?: any): number[] {
  return usedOn(message, 'resisted', target);
}

/**
 * v0.70.0: indices used on this card or any card of the same test (a Karma re-roll, a bought success): the card's
 * flag (`flag`, written by its owner) and, for a player who can't flag the card, `<message id>:<flag>:<index>` on
 * their character. Defend, Resist and Resist spell are once per target per test.
 */
function usedOn(message: any, flag: string, actor?: any): number[] {
  const out = new Set<number>();
  const rolls: string[] = actor ? ((actor.getFlag?.(SYSTEM_ID, 'cardRolls') as string[] | undefined) ?? []) : [];
  for (const m of sameTestCards(message)) {
    for (const i of ((m.getFlag?.(SYSTEM_ID, flag) as number[] | undefined) ?? [])) out.add(Number(i));
    for (const k of rolls) if (k.startsWith(`${m.id}:${flag}:`)) out.add(Number(k.split(':')[2]));
  }
  return [...out];
}

async function onResist(message: any, button: HTMLButtonElement): Promise<void> {
  const dlist = listFlag<DamageState>(message.getFlag(SYSTEM_ID, 'damages'));
  const index = safeInt(button.dataset['index'], 0, 99, 0);
  const rawDamage = (dlist[index] ?? message.getFlag(SYSTEM_ID, 'damage')) as DamageState | undefined;
  if (!rawDamage || typeof rawDamage !== 'object') return;
  const damage = boundDamage(rawDamage, damageCap(message));
  if (message.getFlag(SYSTEM_ID, 'combinedInto')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisBlastWasCombinedWithAnother'));
  const target: any = await fromUuid(damage.targetUuid);
  if (!target) return ui.notifications.warn(tx('SR2E.Notify.Chat.theTargetActorNoLongerExists'));
  const resistedBefore = resistedOn(message, target).includes(index);
  if (resistedBefore && !(await gmResistAgain())) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatTargetHasAlreadyResistedThis'));
  if (!target.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm10', { targetName: escHtml(target.name) }));
  if (!(await playerMay(message, target, origin(message), tx('SR2E.Card.Chat.resistsDamage', { targetName: target.name, damagePower: damage.power, damageLevel: damage.level, boundType: boundType(damage.damageType) }), { routine: damageSources(message, damage) }))) return;

  // v0.80.0 (URR_V80.vehCpResist): a vehicle's jumped-in rigger may add Control Pool dice to its damage resistance.
  // v0.92.3 (RULES.VEHICLES_V923.cpResist 'driving', Rigger 2 pp. 50, 53): the book's way too (capped at the rigger's skill).
  const cpCtl: any = target.type === 'vehicle' && veh80ResistPoolOn() && target.system.controlMode === 'jumped' ? target.controller?.() : null;
  // Review #3: only the rigger's owner (or the GM) can spend their Control Pool; anyone else resists with no pool.
  const cpRigger: any = cpCtl?.system?.rigging?.jumpedIn && cpCtl.system.rigging.vehicleUuid === target.uuid && cpCtl.isOwner ? cpCtl : null;
  const pool = cpRigger
    ? await promptPoolDice(cpRigger, tx('SR2E.Dialog.Chat.resistDamage', { targetName: target.name }), 'control')
    : await promptPoolDice(target, tx('SR2E.Dialog.Chat.resistDamage', { targetName: target.name }), target.poolFor?.(damage) ?? 'combat');
  if (pool === null) return;
  if (resistedOn(message, target).includes(index) && !game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatTargetHasAlreadyResistedThis'));
  button.disabled = true;
  const rolled = await gmRoll(message, button, async () => {
    // v0.85.0: checked again inside the lock: the GM's click may have queued behind the NPC's own resistance.
    if (!resistedBefore && game.user?.isGM && resistedOn(message, target).includes(index)) { button.disabled = false; ui.notifications.warn(tx('SR2E.Notify.Chat.thatTargetHasAlreadyResistedThis')); return false; }
    await target.resistFromState(damage, pool);
    return true;
  });
  if (!rolled) return;
  // Remember it (the GM, or whoever posted the card, can write the flag). v0.60.0: single-target cards too.
  deadenCopies(message, 'resist', index);
  if (message.isOwner) await message.setFlag(SYSTEM_ID, 'resisted', [...new Set([...resistedOn(message), index])]);
  else await markCardRolled(target, `${message.id}:resisted:${index}`);
}

async function onResistSpell(message: any, button: HTMLButtonElement): Promise<void> {
  const list = listFlag<SpellState>(message.getFlag(SYSTEM_ID, 'spells'));
  const index = safeInt(button.dataset['index'], 0, 99, 0);
  const rawSpell = (list[index] ?? message.getFlag(SYSTEM_ID, 'spell')) as SpellState | undefined;
  if (!rawSpell || typeof rawSpell !== 'object') return;
  const spell = boundSpell(rawSpell);
  const target: any = await fromUuid(spell.targetUuid);
  if (!target) return ui.notifications.warn(tx('SR2E.Notify.Chat.theTargetActorNoLongerExists'));
  const resistedBefore = spellResistedOn(message, target).includes(index);
  if (resistedBefore && !(await gmResistAgain())) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatTargetHasAlreadyResistedThis'));
  if (!target.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm10', { targetName: escHtml(target.name) }));
  if (!(await playerMay(message, target, origin(message, spell.casterUuid), tx('SR2E.Card.Chat.resistsSForce', { targetName: target.name, nameOfUuid: nameOfUuid(String(spell.casterUuid ?? '')) || tx('SR2E.Card.Chat.someone'), slice: String(spell.spellName ?? 'spell').slice(0, 120), spellForce: spell.force, part: spell.level ? `, ${spell.level}` : '' }), { routine: realSources(message, spell.casterUuid) }))) return;

  const poolType = spell.resistPool ?? 'spell';
  // Someone else holding spell defense dice could be covering the target (spells only). v0.81.1 (D2-1, D3-2): only
  // the target's own side: an actor a player who owns the target also owns, or (an NPC target) one no player owns.
  // FX-DOC wiring 5: the documents' rule (the relay checks the same), else sameSide.
  const coverCls: any = CONFIG.Actor.documentClass;
  const covers = (a: any): boolean => (typeof coverCls?.spellDefenseCoverProblem === 'function' ? coverCls.spellDefenseCoverProblem(a, target, game.user) === '' : sameSide(target, a));
  const protectors = spell.noun === 'power' ? [] : allActors().filter((a: any) => a.uuid !== target.uuid && (a.system?.spellDefense ?? 0) > 0 && covers(a));
  let protectorUuid: string | null = null;
  let pool: number | null = 0;
  if (protectors.length) {
    const left = poolType === 'none' ? 0 : (target.system.derived[`${poolType}PoolLeft`] as number);
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Chat.resist', { spellSpellName: spell.spellName, targetName: target.name }) },
      content: `${poolType === 'none' ? '' : `<div class="form-group"><label>${tx('SR2E.Dialog.Chat.poolDiceLeft', { part: poolType === 'spell' ? tx('SR2E.Dialog.Chat.spell') : tx('SR2E.Dialog.Chat.combat'), left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>`}
        <div class="form-group"><label>${tx('SR2E.Dialog.Chat.spellDefenseFrom')}</label><select name="protector">
          <option value="">${tx('SR2E.Dialog.Chat.sOwn', { targetName: escHtml(target.name), targetSpellDefense: escHtml(target.system.spellDefense ?? 0) })}</option>
          ${protectors.map((p: any) => `<option value="${escHtml(p.uuid)}">${tx('SR2E.Dialog.Chat.dice', { name: escHtml(p.name), spellDefense: escHtml(p.system.spellDefense) })}</option>`).join('')}</select></div>`,
      ok: { callback: (_e: Event, b: any) => ({ pool: Math.max(0, Math.min(left, Math.floor(Number(b.form.elements.pool?.value) || 0))), protector: (b.form.elements.protector.value as string) || null }) },
      rejectClose: false,
    });
    if (!choice) return;
    pool = choice.pool;
    protectorUuid = choice.protector;
  } else if (poolType !== 'none') {
    pool = await promptPoolDice(target, tx('SR2E.Dialog.Chat.resist', { spellSpellName: spell.spellName, targetName: target.name }), poolType);
  }
  if (pool === null) return;
  if (spellResistedOn(message, target).includes(index) && !game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatTargetHasAlreadyResistedThis'));
  button.disabled = true;
  const rolled = await gmRoll(message, button, async () => {
    // v0.85.0: checked again inside the lock (the NPC may have resisted by itself meanwhile).
    if (!resistedBefore && game.user?.isGM && spellResistedOn(message, target).includes(index)) { button.disabled = false; ui.notifications.warn(tx('SR2E.Notify.Chat.thatTargetHasAlreadyResistedThis')); return false; }
    await target.resistSpell(spell, pool, { protectorUuid });
    return true;
  });
  if (!rolled) return;
  if (message.isOwner) await message.setFlag(SYSTEM_ID, 'spellResisted', [...new Set([...((message.getFlag(SYSTEM_ID, 'spellResisted') as number[] | undefined) ?? []), index])]);
  else await markCardRolled(target, `${message.id}:spellResisted:${index}`);
}

/** The players (not GMs) who own an actor. */
function playerOwners(a: any): any[] {
  return [...((game as any).users ?? [])].filter((u: any) => !u.isGM && a?.testUserPermission?.(u, 'OWNER'));
}

/**
 * v0.81.1 (D2-1, D3-2): whether `other` can cover `target` with its spell defense: a player who owns the target owns
 * it too, or neither has a player owner (the GM's side). When both have tokens on the scene, their dispositions match.
 */
export function sameSide(target: any, other: any): boolean {
  const mine = playerOwners(target);
  const ok = mine.length ? mine.some((u: any) => other?.testUserPermission?.(u, 'OWNER')) : !playerOwners(other).length;
  if (!ok) return false;
  try {
    const a: any = tokenOf(target), b: any = tokenOf(other);
    const da = a?.document?.disposition, db = b?.document?.disposition;
    if (typeof da === 'number' && typeof db === 'number' && da !== db) return false;
  } catch { /* no canvas */ }
  return true;
}

/**
 * v0.81.1 (design 2): the real source fields of a damage entry for the routine rule: its attacker or caster, a blast
 * card's attacker (`blastAt.attackerUuid`), and the card's own test's roller.
 */
function damageSources(message: any, d: any): unknown[] {
  return realSources(message, d?.attackerUuid, d?.casterUuid, message?.getFlag?.(SYSTEM_ID, 'blastAt')?.attackerUuid);
}

/** v0.60.0: the GM may resist a card again (after undoing the first soak); players may not. */
async function gmResistAgain(): Promise<boolean> {
  if (!game.user?.isGM) return false;
  return Boolean(await foundry.applications.api.DialogV2.confirm({
    window: { title: tx('SR2E.Dialog.Chat.alreadyResisted') }, content: `<p>${tx('SR2E.Dialog.Chat.thisTargetHasAlreadyResistedThis')}</p>`, rejectClose: false,
  }));
}

/** v0.60.0: indices on a spell card whose targets have resisted. */
function spellResistedOn(message: any, target?: any): number[] {
  return usedOn(message, 'spellResisted', target);
}

/** v0.60.0: whether an active player (not a GM) owns this actor. */
function playerOwned(t: any): boolean {
  return Boolean(t && [...((game as any).users ?? [])].some((u: any) => !u.isGM && u.active && t.testUserPermission?.(u, 'OWNER')));
}

function autoResistOn(): boolean {
  try { return Boolean(game.settings.get(SYSTEM_ID, 'autoResistNpc')); } catch { return false; }
}

/** v0.60.0: whether the active GM's client resists this card entry by itself (setting autoResistNpc). */
export function autoResistPlanned(message: any, kind: 'resist' | 'resistSpell', index: number, target: any): boolean {
  const content = String(message?.content ?? '');
  // A blast waits for the GM (cover, combining blasts): use Resist all… there.
  if (kind === 'resist' && /data-sr2e-action="(combineBlast|takeCover)"/.test(content)) return false;
  return autoResists({
    enabled: autoResistOn(), playerOwned: playerOwned(target),
    resisted: (kind === 'resist' ? resistedOn(message) : spellResistedOn(message)).includes(index),
    retarget: Boolean(message?.getFlag?.(SYSTEM_ID, 'retargetOf')), combined: Boolean(message?.getFlag?.(SYSTEM_ID, 'combinedInto')),
  });
}

const autoResisting = new Set<string>();

/** v0.60.0 (active GM): NPCs on a new card resist damage and spells at once, with no pool dice. */
async function autoResistCard(message: any): Promise<void> {
  if (!isLeadGm() || !autoResistOn() || autoResisting.has(message.id)) return;
  const content = String(message.content ?? '');
  const hasDamage = content.includes('data-sr2e-action="resist"');
  const hasSpell = content.includes('data-sr2e-action="resistSpell"');
  if (!hasDamage && !hasSpell) return;
  // v0.81.0 (SEC1-8): only an entry on a card from a GM or from the target's own owner, or (v0.81.1, SEC1-11, A-6) one
  // whose real source (its caster or attacker, never the speaker) the author owns, as the routine rule lets a click
  // through; the Power is bounded below. Anything else waits for a click on Resist (which asks first).
  autoResisting.add(message.id);
  if (autoResisting.size > 500) autoResisting.delete(autoResisting.values().next().value as string);
  // v0.81.1 (A2): the NPCs' damage is written under the GM lock (no re-run of a player's card is acting meanwhile).
  await withGmLock(() => autoResistEntries(message, hasDamage, hasSpell));
}

async function autoResistEntries(message: any, hasDamage: boolean, hasSpell: boolean): Promise<void> {
  try {
    if (hasDamage) {
      const damages = message.getFlag(SYSTEM_ID, 'damages');
      const list: DamageState[] = Array.isArray(damages) ? damages : [message.getFlag(SYSTEM_ID, 'damage')].filter((x: any) => x && typeof x === 'object');
      for (let i = 0; i < list.length && i < 100; i++) {
        const d = list[i] && typeof list[i] === 'object' ? boundDamage(list[i]!, damageCap(message)) : null;
        const t: any = d ? await fromUuid(d.targetUuid) : null;
        if (!t?.isOwner || !mayResistUnseen(message, t, damageSources(message, d)) || !autoResistPlanned(message, 'resist', i, t)) continue;
        // Marked first, so a click on Resist or Resist all meanwhile finds it done.
        await message.setFlag(SYSTEM_ID, 'resisted', [...new Set([...resistedOn(message), i])]);
        await t.resistFromState(d, 0);
      }
    }
    if (hasSpell) {
      const spells = message.getFlag(SYSTEM_ID, 'spells');
      const list: SpellState[] = Array.isArray(spells) ? spells : [message.getFlag(SYSTEM_ID, 'spell')].filter((x: any) => x && typeof x === 'object');
      for (let i = 0; i < list.length && i < 100; i++) {
        const sp = list[i] && typeof list[i] === 'object' ? boundSpell(list[i]!) : null;
        const t: any = sp ? await fromUuid(sp.targetUuid) : null;
        if (!t?.isOwner || !mayResistUnseen(message, t, realSources(message, sp?.casterUuid)) || !autoResistPlanned(message, 'resistSpell', i, t)) continue;
        await message.setFlag(SYSTEM_ID, 'spellResisted', [...new Set([...spellResistedOn(message), i])]);
        await t.resistSpell(sp, 0, { protectorUuid: null });
      }
    }
  } catch (err) { console.warn('sr2e | auto-resist', err); }
}

/**
 * v0.81.1 (SEC1-11, A-6): whether an entry may be resisted with no one asked (auto-resist, or no prompt for it): the
 * card's author is a GM or owns the target, or owns one of its real sources (the routine rule's test, `playerMay`).
 */
function mayResistUnseen(message: any, target: any, sources: readonly unknown[]): boolean {
  return authorOwns(message, target) || trustedSource(cardTrust(message), sources);
}

/** v0.60.0: a camera's region card: the GM rolls the device's detection test. */
async function onRegionDetect(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmRollsThis'));
  // v0.81.0 (SEC1-5): the active GM's client posts these (applications/regions.ts); a player's card is ignored.
  if (!authorIsGm(message)) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisCardWasnTPostedBy'));
  const r = message.getFlag(SYSTEM_ID, 'regionDetect') as { siteUuid: string; deviceId: string; intruderUuid: string } | undefined;
  const site: any = r ? await fromUuid(r.siteUuid) : null;
  if (!r || !site) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatSiteNoLongerExists'));
  if (message.getFlag(SYSTEM_ID, 'regionDetected')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyRolled'));
  await gmLocked(message, button, async () => {
    // v0.85.0: under the GM lock, checked again (a double click).
    if (message.getFlag(SYSTEM_ID, 'regionDetected')) return;
    button.disabled = true;
    const res = await site.detect(r.deviceId, r.intruderUuid, {});
    if (res) await message.setFlag(SYSTEM_ID, 'regionDetected', true);
    else button.disabled = false;
  });
}

/**
 * v0.70.0: an attack whose target has already defended can't be re-rolled with Karma or have a success bought:
 * the defense (and the damage it led to) was worked out against this result. Karma goes on before the defense.
 */
function defendedAgainst(message: any): boolean {
  const list = (message.getFlag?.(SYSTEM_ID, 'attacks') as AttackState[] | undefined) ?? [message.getFlag?.(SYSTEM_ID, 'attack')].filter(Boolean) as AttackState[];
  return list.some((a, i) => {
    const t: any = a?.targetUuid ? fromUuidSync(a.targetUuid) : null;
    return defendedOn(message, t).includes(i);
  });
}

async function onKarma(message: any, button: HTMLButtonElement, action: 'karmaReroll' | 'avoidDisaster'): Promise<void> {
  const snap = message.getFlag(SYSTEM_ID, 'test') as TestSnapshot | undefined;
  if (!snap || button.disabled) return;
  if (action === 'karmaReroll' && snap.kind === 'attack' && defendedAgainst(message)) return ui.notifications.warn(tx('SR2E.Notify.Chat.theTargetHasAlreadyDefendedAgainst'));
  // v0.56.0: disabled at once, so a double click can't re-roll twice while the actor loads.
  button.disabled = true;
  const actor: any = await fromUuid(snap.actorUuid);
  if (!actor) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.theActorWhoRolledThisNo')); }
  if (!actor.isOwner) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm11', { actorName: escHtml(actor.name) })); }
  // v0.81.0 (SEC1-6): only on the roller's own card (or a GM's): a forged card can't spend someone's Karma Pool.
  if (!(await playerMay(message, actor))) { button.disabled = false; return; }
  const before = actor.system.karma?.poolSpent ?? 0;
  // v0.81.1 (SEC1-1, design 1): a GM's click on a player's card re-resolves it as that player.
  if (action === 'karmaReroll') await asCardAuthor(message, tx('SR2E.Card.Chat.karmaReRoll'), () => actor.karmaReroll(snap));
  else await asCardAuthor(message, tx('SR2E.Card.Chat.avoidDisaster'), () => actor.avoidDisaster(snap));
  // If nothing was spent (not enough Karma, nothing to re-roll), let them try again later.
  if ((actor.system.karma?.poolSpent ?? 0) === before) button.disabled = false;
}

/** Roll the Magic loss test for a deadly-wounded magician. */
async function onMagicLoss(message: any, button: HTMLButtonElement): Promise<void> {
  const uuid = message.getFlag(SYSTEM_ID, 'magicLossFor') as string | undefined;
  const actor: any = uuid ? await fromUuid(uuid) : null;
  if (!actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm4', { actorName: escHtml(actor.name) }));
  // R2-SEC-5: a healer's URR card (`magicLossBy`, rfDOC) about someone else's patient: the patient's owner or the GM
  // confirms it, with the healer named.
  const by = message.getFlag(SYSTEM_ID, 'magicLossBy');
  const byName = safeStr(by, 400) ? nameOfUuid(by) : '';
  if (!(await playerMay(message, actor, origin(message, by), tx('SR2E.Card.Chat.rollsAMagicLossTestMagic', { actorName: actor.name, part: byName ? tx('SR2E.Card.Chat.afterSTreatment', { byName }) : '' })))) return;
  // v0.80.0 (live run): both copies of the button (chat log and pop-up) clicked at once rolled twice; v0.81.0: the
  // click dispatcher's in-flight guard (A-6) covers that for every card button now.
  if (cardDone(message, actor, 'magicLossRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.theMagicLossTestHasAlready'));
  button.disabled = true;
  await actor.rollMagicLoss();
  await markCardDone(message, actor, 'magicLossRolled');
}

/** v0.92.3 (RULES.HEALTH_V923.permanentDamage, Core p. 114): roll the Deadly wound's permanent damage test (owner or GM). */
async function onPermanentDamage923(message: any, button: HTMLButtonElement): Promise<void> {
  const uuid = message.getFlag(SYSTEM_ID, 'permanentDamageFor') as string | undefined;
  const actor: any = uuid ? await fromUuid(uuid) : null;
  if (!actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm4', { actorName: escHtml(actor.name) }));
  if (!(await playerMay(message, actor, origin(message), tx('SR2E.Card.Chat.rollsPermanentDamage923', { actorName: actor.name })))) return;
  if (cardDone(message, actor, 'permanentDamageRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyRolled'));
  button.disabled = true;
  await actor.rollPermanentDamage?.();
  await markCardDone(message, actor, 'permanentDamageRolled');
}

/** Use a repeating power again on the same targets. */
async function onRepeatPower(message: any): Promise<void> {
  const repeat = message.getFlag(SYSTEM_ID, 'repeat') as { powerUuid: string; targetUuids: string[]; modifiers?: any[]; exclude?: string[] } | undefined;
  if (!repeat) return;
  const power: any = await fromUuid(repeat.powerUuid);
  const actor: any = power?.parent;
  if (!power || !actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatPowerNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm12', { actorName: escHtml(actor.name) }));
  // v0.81.0 (SEC1-6): only the power user's own card (or a GM's); the lists are checked for shape.
  if (!(await playerMay(message, actor))) return;
  const uuids = (v: unknown) => listFlag(v).filter((u): u is string => safeStr(u, 400)).slice(0, 50);
  const modifiers = listFlag(repeat.modifiers).filter((m: any) => m && typeof m.label === 'string' && Number.isFinite(Number(m.value)))
    .slice(0, 30).map((m: any) => ({ ...m, label: String(m.label).slice(0, 120), value: safeInt(m.value, -30, 30, 0) }));
  // v0.81.1 (SEC1-1, design 1): a GM using a player's power again does it as that player.
  await asCardAuthor(message, tx('SR2E.Card.Chat.useAgain'), () => actor.usePower(power, { targetUuids: uuids(repeat.targetUuids), modifiers, exclude: uuids(repeat.exclude) }));
}

/** Top-level actor fields a pending spirit or barrier may carry (no ownership, folder, ids, stats or flags). */
const SPIRIT_KEYS = ['name', 'type', 'img', 'system', 'items', 'effects', 'prototypeToken'];
/** Item fields kept on a pending spirit's items (no ownership, ids, folders, stats or flags). */
const SPIRIT_ITEM_KEYS = ['name', 'type', 'img', 'system', 'effects'];
/** Active effect fields kept, and the change keys allowed (the actor's own system data only). */
const SPIRIT_EFFECT_KEYS = ['name', 'img', 'changes', 'disabled', 'duration', 'statuses', 'description', 'transfer'];

/**
 * Round 2 (R2-SEC-1): the only flags of this system a pending spirit or barrier carries, the ones the system's own
 * cards set (documents/index.ts: an ally ritual's marker `allyRitual`, a barrier spell's link `barrierSpell`), each
 * rebuilt field by field. Never `projects`, `requests`, `setCharges`, `cardRolls`, `powerEffects`, `familiar` or
 * anything else that runs later or vouches for something.
 */
function spiritFlags(raw: any): Record<string, any> {
  const f = raw?.flags?.[SYSTEM_ID];
  if (!f || typeof f !== 'object' || Array.isArray(f)) return {};
  const out: Record<string, any> = {};
  if (f.allyRitual === true) out['allyRitual'] = true;
  const bs = f.barrierSpell;
  if (bs && typeof bs === 'object' && !Array.isArray(bs)) {
    const str = (v: unknown) => (safeStr(v, 400) ? String(v) : '');
    out['barrierSpell'] = { casterUuid: str(bs.casterUuid), spellName: str(bs.spellName).slice(0, 120), effectId: str(bs.effectId) };
  }
  return out;
}

/** Active effects a pending spirit (or one of its items) may carry: listed fields, changes to `system.*` only. */
function spiritEffects(list: unknown): any[] {
  return listFlag(list).filter((e: any) => e && typeof e === 'object' && !Array.isArray(e)).slice(0, 30).map((e: any) => {
    const out: any = Object.fromEntries(SPIRIT_EFFECT_KEYS.filter((k) => Object.hasOwn(e, k)).map((k) => [k, structuredClone(e[k])]));
    out.changes = listFlag(e.changes).filter((c: any) => c && typeof c === 'object' && typeof c.key === 'string' && c.key.startsWith('system.') && safePath(c.key))
      .slice(0, 50).map((c: any) => ({ key: String(c.key), mode: safeInt(c.mode, 0, 5, 2), value: String(c.value ?? '').slice(0, 200), ...(c.priority !== undefined ? { priority: safeInt(c.priority, 0, 100, 0) } : {}) }));
    return out;
  });
}

/**
 * v0.81.0 (SEC1-3), exported for the tests: the actor data a pending spirit or barrier card may create. Only a
 * `spirit` or a `barrier`; no `ownership` (the caller sets the summoner's or caster's); items capped and stripped;
 * no key that reaches a prototype. Returns null for anything else, with the summoner and caster the data names.
 */
export function spiritCreateData(raw: any): { data: any; summonerUuid: string; casterUuid: string } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !deepSafeKeys(raw)) return null;
  if (raw.type !== 'spirit' && raw.type !== 'barrier') return null;
  const pick = (o: any, keys: readonly string[]) => Object.fromEntries(keys.filter((k) => Object.hasOwn(o, k)).map((k) => [k, foundry.utils?.deepClone ? foundry.utils.deepClone(o[k]) : structuredClone(o[k])]));
  const data: any = pick(raw, SPIRIT_KEYS);
  data.name = String(raw.name ?? (raw.type === 'spirit' ? 'Spirit' : 'Barrier')).slice(0, 120);
  if (data.system && typeof data.system !== 'object') return null;
  data.system = { ...(data.system ?? {}) };
  data.items = listFlag(raw.items).filter((i: any) => i && typeof i === 'object').slice(0, 60).map((i: any) => {
    const it = pick(i, SPIRIT_ITEM_KEYS);
    if (it.effects !== undefined) it.effects = spiritEffects(it.effects);
    return it;
  });
  data.effects = spiritEffects(raw.effects);
  // Round 2 (R2-SEC-1): only the listed flags (a card's `projects` would run on the GM's timer as "GM-written").
  const fl = spiritFlags(raw);
  data.flags = Object.keys(fl).length ? { [SYSTEM_ID]: fl } : {};
  if (data.prototypeToken && typeof data.prototypeToken === 'object') {
    const { flags: _f, actorId: _a, ...tok } = data.prototypeToken;
    data.prototypeToken = { ...tok, name: data.name };
  } else delete data.prototypeToken;
  if (raw.type === 'barrier') {
    data.items = [];
    for (const k of ['rating', 'baseRating']) if (data.system[k] !== undefined) data.system[k] = safeInt(data.system[k], 0, 30, 1);
  } else {
    if (data.system.force !== undefined) data.system.force = safeInt(data.system.force, 1, 30, 1);
    if (data.system.services !== undefined) data.system.services = safeInt(data.system.services, 0, 30, 0);
  }
  const summonerUuid = raw.type === 'spirit' && safeStr(data.system.summonerUuid, 400) ? String(data.system.summonerUuid) : '';
  const bs = data.flags?.[SYSTEM_ID]?.barrierSpell;
  const casterUuid = raw.type === 'barrier' && safeStr(bs?.casterUuid, 400) ? String(bs.casterUuid) : '';
  return { data, summonerUuid, casterUuid };
}

/** A player without permission to create actors summoned a spirit: the GM creates it from the card. */
async function onCreateSpirit(message: any, button: HTMLButtonElement): Promise<void> {
  const raw = message.getFlag(SYSTEM_ID, 'pendingSpirit');
  if (!raw || typeof raw !== 'object') return;
  if (!(game.user?.isGM || game.user?.can?.('ACTOR_CREATE'))) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanCreateThe'));
  if (message.getFlag(SYSTEM_ID, 'spiritCreated')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatSpiritHasAlreadyBeenCreated'));
  // v0.81.1 (D2-3): a Karma re-roll of the summoning posts a new card: the spirit an earlier card of it created is the one.
  if (sameTestCards(message).some((m: any) => m !== message && m.getFlag?.(SYSTEM_ID, 'spiritCreated'))) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisSummoningSSpiritWasAlready'));
  // v0.81.0 (SEC1-3): the card's data is never handed to Actor.create as it is. Only a spirit or a barrier, owned as
  // its summoner or caster is (never as the card says), from a card whose author owns that summoner or caster.
  const made = spiritCreateData(raw);
  if (!made) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCardDoesnTDescribeA'));
  const from = made.summonerUuid || made.casterUuid;
  const data: any = made.data;
  const summoner: any = made.summonerUuid ? await fromUuid(made.summonerUuid) : null;
  if (made.summonerUuid && !summoner) return ui.notifications.warn(tx('SR2E.Notify.Chat.theSummonerNoLongerExists'));
  // Round 2 (R2-SEC-1/7): it creates an actor, so the GM always confirms a player's card (refused at once when the
  // summoner or caster it names isn't the author's): its name, kind, Force or rating, and who will own it.
  const sys = data.system ?? {};
  const owner = summoner ? tx('SR2E.App.Chat.ownedLike', { name: summoner.name }) : from ? tx('SR2E.App.Chat.ownedLike', { name: nameOfUuid(from) || from }) : tx('SR2E.App.Chat.ownedByTheGmOnly');
  const lines = [data.type === 'barrier' ? tx('SR2E.Dialog.Chat.aRatingIsCreated', { barrierKind: String(sys.barrierKind ?? tx('SR2E.Dialog.Chat.barrier')), name: data.name, rating: safeInt(sys.rating, 0, 30, 1), owner })
    : tx('SR2E.Dialog.Chat.aSpiritForceIsCreated', { name: data.name, force: safeInt(sys.force, 1, 30, 1), part: sys.services !== undefined ? tx('SR2E.Dialog.Chat.services', { services: safeInt(sys.services, 0, 30, 0) }) : '', owner }),
    tx('SR2E.Dialog.Chat.itemSEffectS', { itemsLength: data.items.length, effectsLength: data.effects.length, part: data.flags?.[SYSTEM_ID]?.allyRitual ? tx('SR2E.Dialog.Chat.anAllyCountsForItsCreator') : '' })];
  if (!(await gmMay(message, { title: tx('SR2E.Dialog.Chat.createFromACard'), lines, sources: from ? [from] : [], always: true }))) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    if (summoner) data.ownership = { ...(summoner.ownership ?? {}) };
    button.disabled = true;
    // v0.72.0 (O17, review): a barrier spell's barrier: only while the caster still sustains the spell; the caster's owners
    // own it too, and the GM gets the "Draw it on the map" card.
    const bs = data.type === 'barrier' ? data.flags?.[SYSTEM_ID]?.barrierSpell : null;
    let caster: any = null;
    if (bs) {
      caster = bs.casterUuid ? await fromUuid(bs.casterUuid) : null;
      if (!(caster?.system?.sustaining ?? []).some((e: any) => e.effectId === bs.effectId)) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.theSpellIsNoLongerSustained')); }
      if (SR2Actor.barrierOfSpell(bs.effectId)) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.thatBarrierAlreadyExists')); }
    }
    const cls: any = (Actor as any).implementation ?? Actor;
    const spirit = await cls.create(bs && caster ? { ...data, ownership: { ...(caster.ownership ?? {}) } } : data);
    if (!spirit) { button.disabled = false; return; }
    await message.setFlag(SYSTEM_ID, 'spiritCreated', spirit?.uuid ?? true);
    if (bs && spirit) {
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster }), content: `<p>${tx('SR2E.Card.Chat.standsItFallsWhenTheSpell', { spiritName: escHtml(spirit.name) })} <button type="button" data-sr2e-action="placeWard">${tx('SR2E.Card.Chat.drawItOnTheMap')}</button></p>`,
        flags: { [SYSTEM_ID]: { wardPlace: { barrierUuid: spirit.uuid, name: spirit.name, radius: barrierSpellRadius({ force: Number(spirit.system?.rating ?? 1), magic: Number(caster?.system?.derived?.magic ?? 0) }) } } } });
    }
    // v0.48.0: an ally from a ritual counts for its creator's familiar ordeal.
    // v0.81.0: only on the summoner the card's author owns (checked above), never on another actor the flags name.
    if (data.flags?.[SYSTEM_ID]?.allyRitual && summoner?.setFlag && authorOwns(message, summoner)) {
      await summoner.setFlag(SYSTEM_ID, 'familiar', { allyUuid: spirit?.uuid ?? '', allyName: data.name, usedForGrade: null });
    }
    ui.notifications.info(tx('SR2E.Notify.Chat.created', { name: escHtml(data.name) }));
  });
}

/** Dump shock after a crashed persona. */
async function onDumpShock(message: any, button: HTMLButtonElement): Promise<void> {
  const uuid = message.getFlag(SYSTEM_ID, 'dumpShockFor') as string | undefined;
  const actor: any = safeStr(uuid, 400) ? await fromUuid(uuid) : null;
  if (!actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm4', { actorName: escHtml(actor.name) }));
  if (!(await playerMay(message, actor, origin(message), tx('SR2E.Card.Chat.resistsDumpShock', { actorName: actor.name })))) return;
  if (cardDone(message, actor, 'dumpShockRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.dumpShockHasAlreadyBeenRolled'));
  button.disabled = true;
  const tn = safeInt(message.getFlag(SYSTEM_ID, 'dumpShockTn'), 2, 30, 0);
  const lvl = message.getFlag(SYSTEM_ID, 'dumpShockLevel');
  await actor.rollDumpShock(tn || undefined, typeof lvl === 'string' && lvl ? boundLevel(lvl) : undefined);
  await markCardDone(message, actor, 'dumpShockRolled');
}

/** A failed crash test: post crash damage for the vehicle and everyone aboard. */
async function onVehicleCrash(message: any, button: HTMLButtonElement): Promise<void> {
  const c = message.getFlag(SYSTEM_ID, 'crash') as { vehicleUuid: string; speed: number } | undefined;
  const vehicle: any = c ? await fromUuid(c.vehicleUuid) : null;
  if (!c || !vehicle) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatVehicleNoLongerExists'));
  if (!vehicle.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm13', { vehicleName: escHtml(vehicle.name) }));
  if (!(await playerMay(message, vehicle, origin(message), tx('SR2E.Card.Chat.crashesAtItStopsAndCrash', { vehicleName: vehicle.name, speed: safeInt(c.speed, 0, 2000, 0) })))) return;
  if (cardDone(message, vehicle, 'crashed')) return ui.notifications.warn(tx('SR2E.Notify.Chat.theCrashHasAlreadyBeenPosted'));
  button.disabled = true;
  await vehicle.crash(safeInt(c.speed, 0, 2000, 0));
  await markCardDone(message, vehicle, 'crashed');
}

/** v0.57.0: a crash test called for (heavy damage, tires shot out, a push gone wrong): the driver or autopilot rolls it. */
async function onVehicleCrashTest(message: any, button: HTMLButtonElement): Promise<void> {
  const c = message.getFlag(SYSTEM_ID, 'crashTest') as { vehicleUuid: string; tn: number; why: string } | undefined;
  // Both copies of the card (chat log and pop-up): the click dispatcher's in-flight guard rolls once (A-6).
  if (!c || button.disabled) return;
  button.disabled = true;
  await vehicleCrashTest(message, button, c);
}
async function vehicleCrashTest(message: any, button: HTMLButtonElement, c: { vehicleUuid: string; tn: number; why: string }): Promise<void> {
  const vehicle: any = c ? await fromUuid(c.vehicleUuid) : null;
  if (!vehicle) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.thatVehicleNoLongerExists')); }
  const driver: any = vehicle.controller?.() ?? null;
  if (!vehicle.isOwner && !driver?.isOwner) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySDriverOrTheGm', { vehicleName: escHtml(vehicle.name) })); }
  if (!(await playerMay(message, driver?.isOwner ? driver : vehicle, origin(message, vehicle.uuid), tx('SR2E.Card.Chat.aCrashTestTn', { vehicleName: vehicle.name, tn: safeInt(c.tn, 2, 30, 4) })))) { button.disabled = false; return; }
  if (cardDone(message, driver?.isOwner ? driver : vehicle, 'crashTestRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.theCrashTestHasAlreadyBeen'));
  await vehicle.crashTestFor({ tn: safeInt(c.tn, 2, 30, 4), why: String(c.why ?? '').slice(0, 200) });
  await markCardDone(message, driver?.isOwner ? driver : vehicle, 'crashTestRolled');
}

/** This system's flags on a message (an empty object when none). */
function sr2eFlags(message: any): Record<string, any> {
  const f = message?.flags?.[SYSTEM_ID];
  return f && typeof f === 'object' ? f : {};
}

/**
 * Round 2 (R2-SEC-3): whether a turret card's author may turn that turret. The card is posted only when the gunner's
 * client can't change the weapon, so owning it is not the test: a GM, the weapon's owner, or the owner of someone the
 * vehicle itself lists at its guns (aboard, at the controls, or its security site's rigger: the roles fireMounted
 * accepts). Read from the documents, never from the card.
 */
export function authorMayTurnTurret(message: any, weaponUuid: string, firerUuid: unknown = ''): boolean {
  if (authorIsGm(message) || authorOwns(message, weaponUuid)) return true;
  let weapon: any = null;
  try { weapon = fromUuidSync(weaponUuid); } catch { weapon = null; }
  const vehicle: any = weapon?.parent;
  if (!vehicle || vehicle.type !== 'vehicle' || String(weapon.system?.mount ?? '') !== 'turret') return false;
  let rigger = '';
  try { rigger = String((SR2Actor as any).securitySiteFor?.(vehicle)?.system?.riggerUuid ?? ''); } catch { rigger = ''; }
  const crew = [...listFlag<string>(vehicle.system?.occupants), vehicle.system?.controllerUuid, rigger];
  if (crew.some((u) => safeStr(u, 400) && authorOwns(message, u))) return true;
  // The card's gunner (rfDOC: `firerUuid`), when the author owns them and the vehicle gives them a seat at its guns.
  if (!safeStr(firerUuid, 400) || !authorOwns(message, firerUuid)) return false;
  try { return Boolean((SR2Actor as any).mountedRole?.(fromUuidSync(firerUuid), vehicle)); } catch { return false; }
}

/** A deep copy of flag data (what was checked is what is applied, whatever the card's author edits meanwhile). */
function snapshot<T>(v: T): T {
  try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v ?? null)); }
}

/**
 * v0.81.0 (SEC1-4/5): the Apply (GM) card's flag to apply now, or null. Its flag must have the shape the system posts
 * (per-kind allow-list, bounded numbers). A click needs the author to be a GM or to own what changes, else the GM
 * confirms a dialog built from the flags (`gmMay`).
 * Round 2 (R2-SEC-2): what comes back is a copy of the flags that were checked (and shown), never a fresh read. While
 * the card applies by itself, it is the copy `autoApplyGmCard` vetted once, checked again here: a `message.update` the
 * author makes while an earlier action awaits the server can't reach a later one.
 */
async function gmApplyFlag<T = any>(message: any, action: string): Promise<T | null> {
  const spec = GM_APPLY_SPECS[action];
  if (!spec) return null;
  const auto = applying.get(message?.id);
  if (auto) {
    if (!safeAutoApply(action, auto.flags, cardTrust(message))) return null;
    return snapshot(auto.flags[spec.flag]) as T;
  }
  const flags = snapshot(sr2eFlags(message));
  if (!gmApplyShapeOk(action, flags)) { ui.notifications.warn(tx('SR2E.Notify.Chat.thisCardSDataIsNot')); return null; }
  // v0.81.1 (SEC1-16): the speaker is not a source (it made "the author owns none of them" never refuse).
  const lines = describeGmChange(action, flags, nameOfUuid);
  // v0.81.1 (SEC1-7, RA2-1, FX-DOC wiring): what the surgery does with money, worked out as the Apply will (plain text).
  if (action === 'applySurgery') {
    try { const m = (CONFIG.Actor.documentClass as any).surgeryApplyMoney?.(flags[spec.flag]?.snap); if (typeof m === 'string' && m) lines.push(tx('SR2E.Dialog.Chat.money', { m })); } catch { /* the line stays out */ }
  }
  const ok = await gmMay(message, {
    title: tx('SR2E.Dialog.Chat.applyGm'), lines,
    target: cardTargetUuid(action, flags), sources: cardSourceUuids(action, flags),
  });
  return ok ? (flags[spec.flag] as T) : null;
}

/** GM: apply a change to a site's security that a player's client posted. */
async function onApplySite(message: any, button: HTMLButtonElement): Promise<void> {
  const c = message.getFlag(SYSTEM_ID, 'siteChange') as ({ siteUuid: string } & Record<string, any>) | undefined;
  if (!c) return;
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanChangeA'));
  if (message.getFlag(SYSTEM_ID, 'siteApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisHasAlreadyBeenApplied'));
  const v = await gmApplyFlag<typeof c>(message, 'applySite');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const { siteUuid, sourceUuid: _s, ...change } = v;
    const cls: any = CONFIG.Actor.documentClass;
    const note = await cls.applySiteChange(siteUuid, change);
    if (note === null) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.thatSiteNoLongerExists')); }
    await message.setFlag(SYSTEM_ID, 'siteApplied', true);
    await ChatMessage.create({ speaker: { alias: tx('SR2E.Card.Chat.security') }, content: note, whisper: [game.user.id] });
  });
}

/** v0.57.0: GM applies a sensor lock from a player's re-roll of a GM vehicle's sensor test. */
async function onApplyLocks(message: any, button: HTMLButtonElement): Promise<void> {
  const c = message.getFlag(SYSTEM_ID, 'sensorLocks') as { vehicleUuid: string; targetUuid: string; targetName: string; successes: number } | undefined;
  if (!c) return;
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanApplyThis'));
  if (message.getFlag(SYSTEM_ID, 'locksApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisHasAlreadyBeenApplied'));
  const v = await gmApplyFlag<typeof c>(message, 'applyLocks');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    if (!(await cls.applySensorLock(v))) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.thatVehicleNoLongerExists')); }
    await message.setFlag(SYSTEM_ID, 'locksApplied', true);
  });
}

/** v0.46.0: GM applies a jamming result a player's client posted. */
async function onApplyJam(message: any, button: HTMLButtonElement): Promise<void> {
  const j = message.getFlag(SYSTEM_ID, 'jam') as { droneUuid: string; by: string; rating: number } | undefined;
  if (!j) return;
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanApplyThis'));
  if (message.getFlag(SYSTEM_ID, 'jamApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisHasAlreadyBeenApplied'));
  const v = await gmApplyFlag<typeof j>(message, 'applyJam');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    // From the card: its author must own the jammer (documents/index.ts checks it); the jammer's card may carry the
    // pushed-out rigger's dump shock already.
    const shock = Boolean(message.getFlag(SYSTEM_ID, 'riggerShock') || message.getFlag(SYSTEM_ID, 'dumpShockFor'));
    if (!(await cls.applyJam(v.droneUuid, String(v.by ?? '').slice(0, 120), safeInt(v.rating, 0, 30, 0), { jammerUuid: (v as any).jammerUuid, author: message.author ?? null, shockCard: !shock }))) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.thatJamCanTBeApplied')); }
    await message.setFlag(SYSTEM_ID, 'jamApplied', true);
  });
}

/** v0.73.0 (O28): GM applies a drone-link intercept or spoof a player's client posted. */
async function onApplyDroneLink(message: any, button: HTMLButtonElement): Promise<void> {
  const c = message.getFlag(SYSTEM_ID, 'droneLink') as { droneUuid: string; kind: 'intercept' | 'spoof'; byUuid: string; by: string } | undefined;
  if (!c) return;
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanApplyThis'));
  if (message.getFlag(SYSTEM_ID, 'droneLinkApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisHasAlreadyBeenApplied'));
  const v = await gmApplyFlag<typeof c>(message, 'applyDroneLink');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    if (!(await cls.applyDroneLink({ droneUuid: v.droneUuid, kind: v.kind, byUuid: v.byUuid, by: String(v.by ?? '').slice(0, 120) }))) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.thatDroneNoLongerExists')); }
    await message.setFlag(SYSTEM_ID, 'droneLinkApplied', true);
  });
}

/** A ram that hit: the rammer's own vehicle resists its share. */
async function onRamSelf(message: any, button: HTMLButtonElement): Promise<void> {
  const d = message.getFlag(SYSTEM_ID, 'ramSelf') as DamageState | undefined;
  const vehicle: any = d ? await fromUuid(d.targetUuid) : null;
  if (!d || !vehicle) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatVehicleNoLongerExists'));
  if (!vehicle.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm14', { vehicleName: escHtml(vehicle.name) }));
  if (!(await playerMay(message, vehicle, origin(message), tx('SR2E.Card.Chat.resistsRamDamage', { vehicleName: vehicle.name, boundPower: boundPower(d.power), boundLevel: boundLevel(d.level) })))) return;
  if (cardDone(message, vehicle, 'ramSelfRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisHasAlreadyBeenRolled'));
  button.disabled = true;
  await vehicle.resistFromState(boundDamage(d));
  await markCardDone(message, vehicle, 'ramSelfRolled');
}

/** v0.78.0: a monowhip turned aside by the defender's pool dice: its wielder's check (COMBAT_V61.monowhip 'defended'). */
async function onWhipCheck(message: any, button: HTMLButtonElement): Promise<void> {
  // Both copies (chat log and pop-up) clicked at once: the click dispatcher's in-flight guard rolls one (A-6).
  const w = message.getFlag(SYSTEM_ID, 'whipCheck') as { attackerUuid: string; skill: string; power: number; level: any; damageType: any; weaponName: string } | undefined;
  const wielder: any = w ? await fromUuid(w.attackerUuid) : null;
  if (!w || !wielder) return ui.notifications.warn(tx('SR2E.Notify.Chat.theWielderNoLongerExists'));
  if (!wielder.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm15', { wielderName: escHtml(wielder.name) }));
  // v0.81.1 (A-2): bounded where it is used (the resolver prints these values on the card the wielder's client posts).
  const whip = { skill: String(w.skill ?? 'Armed Combat').slice(0, 60), power: boundPower(w.power), level: boundLevel(w.level), damageType: boundType(w.damageType), weaponName: String(w.weaponName ?? 'monowhip').slice(0, 120) };
  // The card is the defender's: their defend test's roller is its real source.
  if (!(await playerMay(message, wielder, origin(message), tx('SR2E.Card.Chat.checksTheirPower', { wielderName: wielder.name, whipWeaponName: whip.weaponName, whipPower: whip.power }), { routine: realSources(message) }))) return;
  if (cardDone(message, wielder, 'whipChecked')) return ui.notifications.warn(tx('SR2E.Notify.Chat.theWhipCheckHasAlreadyBeen'));
  button.disabled = true;
  await wielder.rollWhipCheck(whip);
  await markCardDone(message, wielder, 'whipChecked');
}

/** A rigger resists feedback or dump shock from their vehicle. */
async function onRiggerShock(message: any, button: HTMLButtonElement): Promise<void> {
  const r = message.getFlag(SYSTEM_ID, 'riggerShock') as { riggerUuid: string; tn: number; level: any; type: any; kind: 'feedback' | 'dump' } | undefined;
  const rigger: any = r ? await fromUuid(r.riggerUuid) : null;
  if (!r || !rigger) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatRiggerNoLongerExists'));
  if (!rigger.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm16', { riggerName: escHtml(rigger.name) }));
  // v0.81.1 (A-2): every field from the card bounded or from its list.
  const shock = { tn: safeInt(r.tn, 2, 30, 4), level: boundLevel(r.level), type: boundType(r.type), kind: r.kind === 'dump' ? 'dump' as const : 'feedback' as const, attribute: (r as any).attribute === 'body' ? 'body' as const : 'willpower' as const };
  if (!(await playerMay(message, rigger, origin(message), tx('SR2E.Card.Chat.resistsTn', { riggerName: rigger.name, part: shock.kind === 'dump' ? tx('SR2E.Card.Chat.dumpShock') : tx('SR2E.Card.Chat.feedback'), shockTn: shock.tn, shockLevel: shock.level })))) return;
  if (cardDone(message, rigger, 'riggerShockRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisHasAlreadyBeenRolled'));
  button.disabled = true;
  await rigger.rollRiggerShock(shock);
  await markCardDone(message, rigger, 'riggerShockRolled');
}

/** Deck damage after a blaster or sparky crash, or a trace and burn: the IC rolls its rating vs the MPCP. */
async function onDeckDamage(message: any, button: HTMLButtonElement): Promise<void> {
  const d = message.getFlag(SYSTEM_ID, 'deckDamage') as { deckerUuid: string; icName: string; rating: number; reason: string; sparky?: boolean } | undefined;
  const decker: any = d ? await fromUuid(d.deckerUuid) : null;
  if (!d || !decker) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatDeckerNoLongerExists'));
  if (!decker.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm17', { deckerName: escHtml(decker.name) }));
  if (!(await playerMay(message, decker, origin(message), tx('SR2E.Card.Chat.sDeckTakesDamageFromRating', { deckerName: decker.name, slice: String(d.icName ?? 'IC').slice(0, 120), rating: safeInt(d.rating, 0, 20, 0) })))) return;
  if (cardDone(message, decker, 'deckDamageRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.deckDamageHasAlreadyBeenRolled'));
  button.disabled = true;
  // v0.92.3: a sparky crash's test has its own TN and is followed by its damage (VR2 p. 44).
  await decker.takeDeckDamage(String(d.icName ?? 'IC').slice(0, 120), safeInt(d.rating, 0, 20, 0), String(d.reason ?? '').slice(0, 200), { sparky: d.sparky === true });
  await markCardDone(message, decker, 'deckDamageRolled');
}

/** Psychotropic IC (v0.40.0): the decker resists the payload, once per card. */
async function onPsychotropic(message: any, button: HTMLButtonElement): Promise<void> {
  const p = message.getFlag(SYSTEM_ID, 'psychotropic') as { deckerUuid: string; icName: string; rating: number; kind: string; hostUuid?: string } | undefined;
  const decker: any = p ? await fromUuid(p.deckerUuid) : null;
  if (!p || !decker) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatDeckerNoLongerExists'));
  if (!decker.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm17', { deckerName: escHtml(decker.name) }));
  // v0.81.1 (A-2, D3-8): lasting conditioning, so not routine; the kind from its list, the texts bounded.
  const kinds = RULES.MATRIX.psychotropic.kinds as readonly string[];
  if (!kinds.includes(String(p.kind))) return;
  const payload = { icName: String(p.icName ?? 'IC').slice(0, 120), rating: safeInt(p.rating, 0, 20, 0), kind: String(p.kind), ...(safeStr(p.hostUuid, 400) ? { hostUuid: String(p.hostUuid) } : {}) };
  if (!(await playerMay(message, decker, origin(message), tx('SR2E.Card.Chat.resistsSPayloadRatingItCan', { deckerName: decker.name, payloadIcName: payload.icName, payloadKind: payload.kind, payloadRating: payload.rating })))) return;
  if (cardDone(message, decker, 'psychotropicRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thePsychotropicTestHasAlreadyBeen'));
  // v0.92.3: no Hacking Pool on this Willpower test (VR2 p. 17; RULES.MATRIX_V923.psychotropic).
  const pool = RULES.MATRIX_V923.psychotropic !== 'v922' ? 0 : await promptPoolDice(decker, tx('SR2E.Dialog.Chat.resistThePayload', { deckerName: decker.name }), 'hacking');
  if (pool === null) return;
  button.disabled = true;
  await decker.resistPsychotropic(payload, pool);
  await markCardDone(message, decker, 'psychotropicRolled');
}

/** A disease is due (v0.42.0): its victim rolls the progress test from the card. */
async function onDiseaseTick(message: any, button: HTMLButtonElement): Promise<void> {
  const d = message.getFlag(SYSTEM_ID, 'diseaseTick') as { actorUuid: string; index: number; name: string } | undefined;
  const actor: any = d ? await fromUuid(d.actorUuid) : null;
  if (!d || !actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm4', { actorName: escHtml(actor.name) }));
  if (!(await playerMay(message, actor, origin(message), tx('SR2E.Card.Chat.rollsSProgressTest', { actorName: actor.name, slice: String(d.name ?? 'a disease').slice(0, 120) })))) return;
  if (cardDone(message, actor, 'diseaseRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatTestHasAlreadyBeenRolled'));
  const list: any[] = actor.system.diseases ?? [];
  const index = list[d.index]?.name === d.name ? d.index : list.findIndex((x: any) => x.name === d.name && x.pending);
  if (index < 0) return ui.notifications.warn(tx('SR2E.Notify.Chat.noLongerHas', { actorName: escHtml(actor.name), name: escHtml(d.name) }));
  button.disabled = true;
  await actor.rollDiseaseTick(index);
  await markCardDone(message, actor, 'diseaseRolled');
}

/** Sparky biofeedback: the decker resists the IC's rating. */
async function onBiofeedback(message: any, button: HTMLButtonElement): Promise<void> {
  const b = message.getFlag(SYSTEM_ID, 'biofeedback') as { deckerUuid: string; tn: number; level?: string } | undefined;
  const decker: any = b ? await fromUuid(b.deckerUuid) : null;
  if (!b || !decker) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatDeckerNoLongerExists'));
  if (!decker.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm17', { deckerName: escHtml(decker.name) }));
  if (!(await playerMay(message, decker, origin(message), tx('SR2E.Card.Chat.resistsBiofeedbackTn', { deckerName: decker.name, tn: safeInt(b.tn, 2, 30, 4) })))) return;
  if (cardDone(message, decker, 'biofeedbackRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.biofeedbackHasAlreadyBeenRolled'));
  button.disabled = true;
  // v0.92.3: the level the Sparky Test staged it to (VR2 p. 44), one of L/M/S/D.
  await decker.rollBiofeedback(safeInt(b.tn, 2, 30, 4), ['L', 'M', 'S', 'D'].includes(String(b.level)) ? String(b.level) : null);
  await markCardDone(message, decker, 'biofeedbackRolled');
}

/**
 * v0.59.0: the Apply (GM) buttons, each with the flag that marks it done. The active GM's client runs
 * them by itself when a player's card arrives (setting `autoApplyGm`); a done one shows as Applied.
 */
export const GM_APPLY_ACTIONS: Record<string, string> = {
  applySite: 'siteApplied', applyLocks: 'locksApplied', applyJam: 'jamApplied', applyDroneLink: 'droneLinkApplied', applyHold: 'holdApplied',
  applyHost: 'hostApplied', applyTally: 'tallyApplied', applyCleanse: 'cleanseApplied', applyPossession: 'possessionApplied',
  applyPowerEffect: 'powerEffectApplied', applyActorUpdate: 'actorUpdateApplied', applySurgery: 'surgeryApplied',
  applyHeal: 'healApplied', applyPatch: 'patchApplied', applyVehicleJob: 'vehicleJobApplied', applyTimedStatus: 'timedStatusApplied',
};

/** Pure: the Apply (GM) actions a card's content carries that are not yet done. */
export function pendingGmApplies(content: string, done: (flag: string) => boolean): string[] {
  return Object.keys(GM_APPLY_ACTIONS).filter((a) => content.includes(`data-sr2e-action="${a}"`) && !done(GM_APPLY_ACTIONS[a]!));
}

/**
 * Pure: whether an Apply (GM) card may be applied without the GM looking at it (rules/trust.ts `safeAutoApply`; kept
 * here for the callers and tests that import it from chat.ts). v0.81.1 (A-12): the rule itself, no wrapper.
 */
export { safeAutoApply };

const autoApplied = new Set<string>();
async function autoApplyGmCard(message: any): Promise<void> {
  try {
    if (!game.user?.isGM || !isLeadGm()) return;
    if (game.settings.get(SYSTEM_ID, 'autoApplyGm') === false) return;
  } catch { return; }
  if (autoApplied.has(message.id) || message.getFlag?.(SYSTEM_ID, 'supersededBy')) return;
  // A-12: only a card with an Apply (GM) button left is copied at all.
  const pending = pendingGmApplies(String(message.content ?? ''), (f) => Boolean(message.getFlag?.(SYSTEM_ID, f)));
  if (!pending.length) return;
  // Round 2 (R2-SEC-2): vetted once, on a copy; every action below applies that copy (gmApplyFlag). v0.81.1 (SEC1-6,
  // design 3): the kind's own source keys only, never the speaker.
  const flags = snapshot(sr2eFlags(message));
  const trust = cardTrust(message);
  const todo = pending.filter((a) => safeAutoApply(a, flags, trust));
  if (!todo.length) return;
  autoApplied.add(message.id);
  // SEC1-23: the session's memory of applied cards stays small.
  if (autoApplied.size > 500) autoApplied.delete(autoApplied.values().next().value as string);
  // v0.81.1 (A2): the whole run under the GM lock (no re-run of a player's card acts meanwhile); each action's own
  // step sees `applying` and runs inline.
  // `applying` is set while it waits, so a GM click on this card meanwhile says it is being applied.
  applying.set(message.id, { flags });
  try { await withGmLock(() => runAutoApply(message, todo)); } finally { applying.delete(message.id); }
}

async function runAutoApply(message: any, todo: string[]): Promise<void> {
  const run: Record<string, (m: any, b: HTMLButtonElement) => Promise<void>> = {
    applySite: onApplySite, applyLocks: onApplyLocks, applyJam: onApplyJam, applyDroneLink: onApplyDroneLink, applyHold: onApplyHold, applyHost: onApplyHost,
    applyTally: onApplyTally, applyCleanse: onApplyCleanse, applyPossession: onApplyPossession, applyPowerEffect: onApplyPowerEffect,
    applyActorUpdate: onApplyActorUpdate, applySurgery: onApplySurgery, applyHeal: onApplyHeal, applyPatch: onApplyPatch,
    applyVehicleJob: onApplyVehicleJob, applyTimedStatus: onApplyTimedStatus,
  };
  for (const a of todo) {
    const b = document.createElement('button');
    autoButtons.add(b);
    try { await run[a]!(message, b); } catch (err) { console.warn('sr2e | auto-apply', a, err); }
  }
  // The GM sees what went through by itself, and from whom.
  const by = message.author?.name ?? tx('SR2E.Card.Chat.aPlayer');
  await ChatMessage.create({ speaker: { alias: tx('SR2E.Card.Chat.sr2e') }, whisper: [...(game.users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id),
    content: `<p class="hint"><em>${tx('SR2E.Card.Chat.gmOnly')}</em> ${tx('SR2E.Card.Chat.appliedByItselfFromSCard', { by: escHtml(by), todo: escHtml(todo.map((a) => a.replace(/^apply/, '')).join(', ')) })}</p>` });
}

/**
 * v0.81.1 (V-SEC 1–2, A2): a GM-side change because of a card runs under the GM lock (applications/gmlock.ts), so no
 * re-run of a player's card is acting meanwhile. Take it after every dialog, never around one. While the card applies
 * by itself, `autoApplyGmCard` already holds the lock: the step runs inline (awaiting the lock again would deadlock).
 */
function gmLocked<T>(_message: any, button: any, fn: () => Promise<T>): Promise<T> {
  // Round 3 (FIX3-BRIEF 7, V2 #7): inline only for the buttons runAutoApply makes inside its locked task (never for a
  // click on the card while its auto-apply is only queued).
  return button && autoButtons.has(button) ? fn() : withGmLock(fn);
}

/**
 * v0.85.0: the GM's own Defend and Resist rolls run under the GM lock (after the pool dialog, which never waits
 * inside it), so a re-run of a player's card can't be acting meanwhile. A player's roll is their own: no lock.
 */
function gmRoll<T>(message: any, button: any, fn: () => Promise<T>): Promise<T> {
  return game.user?.isGM ? gmLocked(message, button, fn) : fn();
}

/** Round 3: the stand-in buttons runAutoApply passes to the Apply handlers while it holds the GM lock. */
const autoButtons = new WeakSet<object>();

/** Cards being applied by themselves right now, with the flags vetted (a GM click on the same card waits). */
const applying = new Map<string, { flags: Record<string, any> }>();

/**
 * v0.35.0: open the dice when the client doesn't fold them, and give the GM override tools on damage
 * cards: undo / adjust a resist card's damage, apply a hit unresisted, resist everyone on a blast card.
 */
function decorateCard(message: any, html: HTMLElement): void {
  // v0.59.0: an Apply (GM) button that has been applied says so and goes dead.
  for (const [a, f] of Object.entries(GM_APPLY_ACTIONS)) {
    if (!message.getFlag?.(SYSTEM_ID, f)) continue;
    html.querySelectorAll<HTMLButtonElement>(`button[data-sr2e-action="${a}"]`).forEach((b) => { b.disabled = true; b.textContent = tx('SR2E.Card.Chat.applied'); });
  }
  try {
    if (game.settings.get(SYSTEM_ID, 'foldDice') === false) html.querySelectorAll<HTMLDetailsElement>('details.sr2e-fold').forEach((d) => { d.open = true; });
  } catch { /* setting not registered */ }
  addPanLinks(message, html);
  // v0.50.0: a card the GM replaced (a changed TN) keeps its record, but its buttons go dead.
  // v0.70.0: a Karma re-roll or a bought success replaces it too.
  const replaced = cardReplaced(message);
  if (replaced) {
    // No GM tools (Undo, ±box, Apply unresisted) on a replaced card either.
    deadenCard(html, replaced);
    return;
  }
  // v0.70.0: players see Defend and Resist go dead for targets who already used them (the hotkeys skip them too).
  if (!game.user?.isGM) {
    const defended = defendedOn(message, game.user?.character);
    const resisted = resistedOn(message, game.user?.character);
    html.querySelectorAll<HTMLButtonElement>('button[data-sr2e-action="defend"]').forEach((b) => { if (defended.includes(Number(b.dataset['index'] ?? 0))) b.disabled = true; });
    html.querySelectorAll<HTMLButtonElement>('button[data-sr2e-action="resist"]').forEach((b) => { if (resisted.includes(Number(b.dataset['index'] ?? 0))) b.disabled = true; });
  }
  if (message.getFlag?.(SYSTEM_ID, 'retargetOf') && !html.querySelector('.sr2e-retargeted')) {
    const c = html.querySelector('.message-content') ?? html;
    const p = document.createElement('p');
    p.className = 'sr2e-retargeted hint';
    p.textContent = tx('SR2E.Card.Chat.reScoredByTheGmCards');
    c.appendChild(p);
  }
  if (!game.user?.isGM) return;
  const content = html.querySelector('.message-content') ?? html;
  if (content.querySelector('.sr2e-gm-tools')) return;
  const snap = message.getFlag(SYSTEM_ID, 'test') as TestSnapshot | undefined;
  const damages = message.getFlag(SYSTEM_ID, 'damages') as DamageState[] | undefined;
  const damage = message.getFlag(SYSTEM_ID, 'damage') as DamageState | undefined;
  // v0.81.0 (SEC2-1): built as elements (no flag text reaches innerHTML), and remembered: a GM tool action runs only
  // from a button made here, never from one written into a card's content.
  const parts: HTMLButtonElement[] = [];
  const tool = (action: string, label: string, title: string, data: Record<string, string> = {}) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset['sr2eAction'] = action;
    for (const [k, v] of Object.entries(data)) b.dataset[k] = v;
    b.title = title;
    b.textContent = label;
    builtTools.add(b);
    parts.push(b);
  };
  if (snap?.kind === 'soak' && snap.soak && !snap.soak.track && snap.soak.mode === 'stage' || (snap?.kind === 'soak' && snap.soak?.mode === 'spell' && !snap.soak.effectOnly && !snap.soak.track)) {
    const t = snap.soak!.type === 'stun' ? 'stun' : 'physical';
    tool('gmUndo', tx('SR2E.Card.Chat.undo'), tx('SR2E.Card.Chat.putTheConditionMonitorBackAs'));
    tool('gmBox', `−1 ${t}`, tx('SR2E.Card.Chat.oneBoxLess', { t }), { track: t, delta: '-1' });
    tool('gmBox', `+1 ${t}`, tx('SR2E.Card.Chat.oneBoxMore', { t }), { track: t, delta: '1' });
  }
  if (Array.isArray(damages) && damages.length > 1) tool('resistAll', tx('SR2E.Card.Chat.resistAll'), tx('SR2E.Card.Chat.rollEveryPickedTargetSResistance'));
  // v0.37.0: damage the walls near a blast, or the barrier an attack was fired through.
  if (message.getFlag(SYSTEM_ID, 'blastAt') || (snap?.kind === 'attack' && snap.attack && ((snap.attack as any).extraArmor ?? 0) > 0)) tool('barrierDamage', tx('SR2E.Card.Chat.barriers'), tx('SR2E.Card.Chat.damageTheWallsBarrierRatings'));
  else if (damage && typeof damage === 'object' && !damage.matrix) tool('gmApply', tx('SR2E.Card.Chat.applyUnresisted'), tx('SR2E.Card.Chat.theFullDamageNoResistanceTest'));
  if (!parts.length) return;
  const div = document.createElement('div');
  div.className = 'sr2e-gm-tools';
  const span = document.createElement('span');
  span.textContent = tx('SR2E.Card.Chat.gm');
  div.appendChild(span);
  for (const b of parts) { div.appendChild(document.createTextNode(' ')); div.appendChild(b); }
  content.appendChild(div);
}

/** v0.81.0: the GM tool buttons decorateCard made (the only ones whose GM tool actions run). */
const builtTools = new WeakSet<HTMLElement>();
/** GM tool actions: only from a button in `builtTools`. */
const GM_TOOL_ACTIONS = new Set(['gmUndo', 'gmBox', 'gmApply', 'resistAll', 'barrierDamage']);

/** v0.36.0: "⌖ Name" links on attack, damage and spell cards that pan the canvas to that target's token. */
function addPanLinks(message: any, html: HTMLElement): void {
  const content = html.querySelector('.message-content') ?? html;
  if (content.querySelector('.sr2e-targets')) return;
  const pick = (k: string) => { const v = message.getFlag(SYSTEM_ID, k); return Array.isArray(v) ? v : v ? [v] : []; };
  const uuids = [...new Set([...pick('attacks'), ...pick('attack'), ...pick('damages'), ...pick('damage'), ...pick('spells'), ...pick('spell')].map((x: any) => x?.targetUuid).filter(Boolean))] as string[];
  if (!uuids.length) return;
  // v0.81.0 (SEC2-1): built as elements: an actor's name (a player can rename theirs) never goes through innerHTML.
  const found = uuids.filter((u) => safeStr(u, 400)).slice(0, 20).map((u) => {
    let a: any = null;
    try { a = fromUuidSync(u); } catch { a = null; }
    return a ? { u, name: String(a.name ?? '') } : null;
  }).filter((x): x is { u: string; name: string } => Boolean(x));
  if (!found.length) return;
  const div = document.createElement('div');
  div.className = 'sr2e-targets';
  div.appendChild(document.createTextNode(`Target${found.length > 1 ? 's' : ''}: `));
  for (const { u, name } of found) {
    const a = document.createElement('a');
    a.className = 'sr2e-pan';
    a.dataset['uuid'] = u;
    a.title = tx('SR2E.Card.Chat.showOnTheScene', { name });
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-location-crosshairs';
    a.appendChild(icon);
    a.appendChild(document.createTextNode(` ${name}`));
    a.addEventListener('click', (ev) => { ev.preventDefault(); panTo(u); });
    div.appendChild(a);
    div.appendChild(document.createTextNode(' '));
  }
  content.appendChild(div);
}

/** Pan to (and ping) the token of an actor or token UUID on the viewed scene. */
export function panTo(uuid: string): boolean {
  const tokens: any[] = (globalThis as any).canvas?.tokens?.placeables ?? [];
  const t = tokens.find((x: any) => x.document?.uuid === uuid || x.actor?.uuid === uuid);
  if (!t) { ui.notifications.info(tx('SR2E.Notify.Chat.thatTargetHasNoTokenOn')); return false; }
  const c = t.center ?? { x: t.x, y: t.y };
  void (globalThis as any).canvas.animatePan?.({ x: c.x, y: c.y, duration: 400 });
  try { (globalThis as any).canvas.ping?.(c); } catch { /* older canvas */ }
  return true;
}

async function onBuySuccess(message: any, button: HTMLButtonElement): Promise<void> {
  const snap = message.getFlag(SYSTEM_ID, 'test') as TestSnapshot | undefined;
  const actor: any = snap ? await fromUuid(snap.actorUuid) : null;
  if (!snap || !actor) return;
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm11', { actorName: escHtml(actor.name) }));
  if (!(await playerMay(message, actor))) return;
  if (snap.kind === 'attack' && defendedAgainst(message)) return ui.notifications.warn(tx('SR2E.Notify.Chat.theTargetHasAlreadyDefendedAgainst'));
  button.disabled = true;
  // v0.81.1 (SEC1-1, design 1): a GM's click on a player's card re-resolves it as that player.
  if (!(await asCardAuthor(message, tx('SR2E.Card.Chat.buyASuccess'), () => actor.buySuccess(snap)))) button.disabled = false;
}

/** v0.71.0 (R1): Karma Pool on one side of a contest or street card (re-roll, avoid disaster, buy a success). */
async function onContestKarma(message: any, button: HTMLButtonElement): Promise<void> {
  if (button.disabled) return;
  const side = safeInt(button.dataset['side'], 0, 9, 0);
  const op = (['reroll', 'avoid', 'buy'].includes(String(button.dataset['op'])) ? button.dataset['op'] : 'reroll') as 'reroll' | 'avoid' | 'buy';
  // v0.81.0 (SEC1-6): a contest card from a GM or from the owner of the side that spends; round 2 (R2-SEC-7): the
  // other side's player confirms first. Two clicks: the dispatcher's in-flight guard (A-6).
  const contest = message.getFlag(SYSTEM_ID, 'contest') as Contest | undefined;
  const sides = listFlag(contest?.sides).map((s: any) => s?.uuid);
  const spender: any = safeStr(sides[side], 400) ? fromUuidSync(sides[side]) : null;
  // v0.81.1 (A-7, SEC1-12, D1): spending on one's own side is the spender's choice. A GM spends an NPC's Karma (no
  // player owns it) without a dialog; a player spends at once on a contest the author started from a side they own.
  const gmNpc = Boolean(game.user?.isGM && spender && !playerOwners(spender).length);
  if (!gmNpc && !(await playerMay(message, spender, sides, tx('SR2E.Card.Chat.spendsKarmaPoolOnThisContest', { spenderName: spender?.name ?? tx('SR2E.Card.Chat.thisSide'), part: op === 'buy' ? tx('SR2E.Card.Chat.buyASuccess2') : op === 'avoid' ? tx('SR2E.Card.Chat.avoidDisaster2') : tx('SR2E.Card.Chat.reRoll') }), { routine: sides.filter((_u, k) => k !== side) }))) return;
  button.disabled = true;
  // v0.81.1 round 2 (FIX2-BRIEF G, V-SEC 7): a GM spending for a side the card's author owns does it as that author,
  // so the new contest card stays theirs (not GM-vouched). An NPC side's Karma (no player owns it) is the GM's own.
  const spend = () => (SR2Actor as any).contestKarma(message, side, op);
  // Round 3 (V2 #1): an NPC side's Karma is spent with the GM's rights, queued like any GM re-run (never during a
  // player's re-run, where its writes would be judged as that player).
  const asGm = () => (game.user?.isGM && typeof (SR2Actor as any).runAsAuthor === 'function' ? (SR2Actor as any).runAsAuthor(game.user, spend) : spend());
  const posted = spender && authorOwns(message, spender) ? await asCardAuthor(message, tx('SR2E.Card.Chat.contestKarma'), spend) : await asGm();
  if (!posted) button.disabled = false;
}

async function onJamWeapon(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanDoThat'));
  const d = message.getFlag(SYSTEM_ID, 'disaster') as { actorUuid: string; weaponId: string } | undefined;
  if (!d?.weaponId || !safeStr(d.actorUuid, 400)) return;
  // v0.81.0 (SEC1-5): the roller's own disaster card (or a GM's); the weapon is looked up on that actor.
  const who: any = fromUuidSync(d.actorUuid);
  const weapon: any = who?.items?.get?.(String(d.weaponId));
  if (!weapon) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatWeaponIsGone'));
  if (!(await gmMay(message, { title: tx('SR2E.Dialog.Chat.jamAWeapon'), lines: [tx('SR2E.Dialog.Chat.sJams', { whoName: who.name, weaponName: weapon.name })], target: d.actorUuid, sources: [d.actorUuid] }))) return;
  // v0.85.0: under the GM lock (after the dialog).
  await gmLocked(message, button, async () => {
    // v0.85.0: checked again inside the lock (already jammed: nothing to do).
    if (weapon.system?.jammed) return void ui.notifications.info(tx('SR2E.Notify.Chat.isAlreadyJammed', { weaponName: escHtml(weapon.name) }));
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    await cls.jamWeapon(d.actorUuid, weapon.id);
  });
}

async function onGmUndo(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return;
  const snap = message.getFlag(SYSTEM_ID, 'test') as TestSnapshot | undefined;
  if (!snap) return;
  if (message.getFlag(SYSTEM_ID, 'undone')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyUndone'));
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    // v0.81.0 (SEC1-5): only for a card whose author is a GM or owns the actor who soaked (gmUndoSoak checks it too).
    if (await cls.gmUndoSoak(snap, { author: message.author ?? null })) await message.setFlag(SYSTEM_ID, 'undone', true);
    else button.disabled = false;
  });
}

async function onGmBox(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return;
  const snap = message.getFlag(SYSTEM_ID, 'test') as TestSnapshot | undefined;
  if (!snap) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    const cls: any = CONFIG.Actor.documentClass;
    // v0.81.0 (SEC1-5, SEC2-8): one box at a time, on a known track, for a card whose author is a GM or owns the actor.
    const track = button.dataset['track'] === 'stun' ? 'stun' : 'physical';
    const delta = Number(button.dataset['delta']) < 0 ? -1 : 1;
    await cls.gmAdjustBoxes(snap.actorUuid, track, delta, { author: message.author ?? null });
  });
}

async function onGmApply(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return;
  const raw = message.getFlag(SYSTEM_ID, 'damage') as DamageState | undefined;
  const target: any = raw && typeof raw === 'object' ? await fromUuid(raw.targetUuid) : null;
  if (!raw || !target) return ui.notifications.warn(tx('SR2E.Notify.Chat.theTargetNoLongerExists'));
  if (message.getFlag(SYSTEM_ID, 'gmApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyApplied'));
  const damage = boundDamage(raw);
  // v0.81.0 (SEC1-5): from a GM's card or the target's owner's at once; another player's card needs the GM's yes.
  if (!(await gmMay(message, { title: tx('SR2E.Dialog.Chat.applyUnresisted'), lines: [tx('SR2E.Dialog.Chat.takesUnresistedNoResistanceTestNo', { targetName: target.name, damageLevel: damage.level, boundType: boundType(damage.damageType) })], target: target.uuid, sources: realSources(message) }))) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    if (await target.applyUnresisted(damage)) await message.setFlag(SYSTEM_ID, 'gmApplied', true);
    else button.disabled = false;
  });
}

async function onResistAll(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return;
  // v0.81.0 (SEC1-5), round 2 (R2-SEC-7): Power bounded; the dialog below is the GM's confirmation (each target and
  // its Power, and who posted a player's card).
  const damages = listFlag<DamageState>(message.getFlag(SYSTEM_ID, 'damages')).slice(0, 100).map((d) => boundDamage(d, damageCap(message)));
  const done = new Set<number>(listFlag<number>(message.getFlag(SYSTEM_ID, 'resisted')));
  const rows = await Promise.all(damages.map(async (d, i) => {
    const t: any = await fromUuid(d.targetUuid);
    const player = Boolean(t?.hasPlayerOwner && [...(game.users ?? [])].some((u: any) => !u.isGM && u.active && t.testUserPermission?.(u, 'OWNER')));
    return { i, name: t?.name ?? tx('SR2E.App.Chat.someone'), ticked: !done.has(i) && !player, note: done.has(i) ? ` ${tx('SR2E.App.Chat.done')}` : player ? ` ${tx('SR2E.App.Chat.theirPlayerCanRoll')}` : '' , power: `${d.power}${d.level}` };
  }));
  const picked = await (foundry as any).applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Chat.resistForEveryone') },
    content: `${posterNote(message)}<p>${tx('SR2E.Dialog.Chat.rollResistanceNowNoPoolDice')}</p>${rows.map((r) => `<label class="sr2e-check"><input type="checkbox" name="i" value="${r.i}" ${r.ticked ? 'checked' : ''}> ${escHtml(r.name)}: ${escHtml(r.power)}${escHtml(r.note)}</label>`).join('')}`,
    ok: { label: tx('SR2E.Dialog.Chat.resist2'), callback: (_e: Event, b: any) => [...b.form.querySelectorAll('input[name="i"]:checked')].map((x: any) => Number(x.value)) },
    rejectClose: false,
  });
  if (!picked?.length) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    const rolled: number[] = await cls.resistAll(damages, picked);
    await message.setFlag(SYSTEM_ID, 'resisted', [...done, ...rolled]);
    button.disabled = false;
  });
}

/** v0.35.0: Delay / Act now / Done buttons on combatants in the tracker. */
function registerDelayButtons(): void {
  Hooks.on('renderCombatTracker', (_app: any, html: HTMLElement) => {
    try {
      const root: HTMLElement = (html as any)?.querySelector ? html : (html as any)?.[0];
      const combat: any = game.combat;
      if (!root || !combat?.started) return;
      for (const li of Array.from(root.querySelectorAll<HTMLElement>('[data-combatant-id]'))) {
        const c: any = combat.combatants.get(li.dataset['combatantId']);
        const a: any = c?.actor;
        if (!a?.isOwner || li.querySelector('.sr2e-delay')) continue;
        let btn: { label: string; title: string; run: () => Promise<unknown> } | null = null;
        if (a.actingNow?.()) btn = { label: tx('SR2E.Card.Chat.done'), title: tx('SR2E.Card.Chat.finishTheDelayedAction'), run: () => a.endDelayedAction() };
        else if (a.isDelaying?.()) btn = { label: tx('SR2E.Card.Chat.actNow'), title: tx('SR2E.Card.Chat.takeTheDelayedActionNow'), run: () => a.actNow() };
        else if (combat.combatant?.id === c.id) btn = { label: tx('SR2E.Card.Chat.delay'), title: tx('SR2E.Card.Chat.holdThisActionUntilLaterIn'), run: () => a.delayAction() };
        // v0.60.0: full defense, declared from the tracker (any time; out of turn it costs initiative).
        if (['character', 'npc', 'spirit'].includes(a.type) && !a.fullDefenseUp?.() && !li.querySelector('.sr2e-fulldef')) {
          const fd = document.createElement('button');
          fd.type = 'button';
          fd.className = 'sr2e-fulldef';
          fd.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';
          fd.title = tx('SR2E.Card.Chat.fullDefense', { name: a.name, part: combat.combatant?.id === c.id ? tx('SR2E.Card.Chat.thisAction') : (C923.fullDefenseInitiativeCost() ? tx('SR2E.Card.Chat.outOfTurnInitiative', { fullDefenseInitiativeCost: C923.fullDefenseInitiativeCost() }) : tx('SR2E.Card.Combat923.noInitiativeCost')) });
          fd.addEventListener('click', async (ev) => { ev.preventDefault(); ev.stopPropagation(); fd.disabled = true; await a.declareFullDefense(); ui.combat?.render?.(); });
          (li.querySelector('.combatant-controls, .token-initiative') ?? li).prepend(fd);
        }
        if (!btn) continue;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sr2e-delay';
        b.textContent = btn.label;
        b.title = btn.title;
        const run = btn.run;
        b.addEventListener('click', async (ev) => { ev.preventDefault(); ev.stopPropagation(); await run(); ui.combat?.render?.(); });
        (li.querySelector('.combatant-controls, .token-initiative') ?? li).prepend(b);
      }
    } catch (err) {
      console.warn('sr2e | Could not add the delay buttons', err);
    }
  });
}

/** v0.35.0: Karma Pools refresh on their own (RULES.KARMA.refresh): per session, or when a combat ends. */
function registerKarmaRefresh(): void {
  const cls = () => CONFIG.Actor.documentClass as any;
  Hooks.once('ready', async () => {
    try {
      // v0.85.0: once the GM windows have heard each other (two restored tabs must not both refresh).
      await leadSettled();
      if (!isLeadGm()) return;
      // v0.81.0: the local date (a UTC date changed at UTC midnight, mid-session), checked by rules/flow.ts.
      const today = localDateKey();
      const last = String(game.settings.get(SYSTEM_ID, 'karmaRefreshDay') ?? '');
      if (!sessionRefreshDue(last, today)) return;
      void game.settings.set(SYSTEM_ID, 'karmaRefreshDay', today);
      void cls().refreshAllKarma(tx('SR2E.Card.Chat.newSession'));
    } catch (err) { console.warn('sr2e | Karma refresh', err); }
  });
  Hooks.on('deleteCombat', (combat: any) => {
    // v0.70.0: vehicles forget Combat Turn stamps from this fight (Acceleration window, maneuver position), so a
    // later combat's turn numbers don't match them.
    if (isLeadGm()) {
      for (const c of [...(combat?.combatants ?? [])] as any[]) {
        const v: any = c.actor;
        if (v?.type !== 'vehicle') continue;
        const upd: Record<string, unknown> = {};
        if (Number(v.system?.speedTurn?.round ?? -1) >= 0) upd['system.speedTurn'] = { round: -1, start: Number(v.system?.currentSpeed ?? 0), extra: 0 };
        if (Number(v.system?.position?.round ?? -1) >= 0) upd['system.position'] = { winnerUuid: '', loserUuid: '', tn: 0, round: -1 };
        if (Object.keys(upd).length) void v.update(upd, { sr2eSpeedOk: true }).catch(() => undefined);
      }
    }
    if (RULES.KARMA.refresh !== 'combat' || !isLeadGm()) return;
    void cls().refreshAllKarma(tx('SR2E.Card.Chat.theCombatEnded'));
  });
}

/** A grunt went down: the group tests its morale. */
async function onMorale(message: any, button: HTMLButtonElement): Promise<void> {
  const m = message.getFlag(SYSTEM_ID, 'morale') as { actorUuid: string } | undefined;
  const actor: any = m ? await fromUuid(m.actorUuid) : null;
  if (!m || !actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatGroupNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm4', { actorName: escHtml(actor.name) }));
  if (!(await playerMay(message, actor, origin(message), tx('SR2E.Card.Chat.testsItsMoraleItMayBreak', { actorName: actor.name })))) return;
  if (cardDone(message, actor, 'moraleRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.moraleHasAlreadyBeenRolled'));
  button.disabled = true;
  await actor.moraleTest();
  await markCardDone(message, actor, 'moraleRolled');
}

/** A toxin, disease or drug overdose: the victim resists. */
async function onResistToxin(message: any, button: HTMLButtonElement): Promise<void> {
  const list = listFlag(message.getFlag(SYSTEM_ID, 'toxins'));
  const index = safeInt(button.dataset['index'], 0, 99, 0);
  const raw = list[index];
  // v0.81.1 (D2-2, RB2-1): every field bounded, a disease's recoveries and interval too.
  const t = raw && typeof raw === 'object' ? boundToxin(raw) : null;
  const actor: any = t ? await fromUuid(t.targetUuid) : null;
  if (!t || !actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm18', { actorName: escHtml(actor.name) }));
  // A toxin or drug from a source the author owns is routine; a disease is lasting, so it always confirms (as onInfection).
  const disease = t.kind === 'disease';
  if (!(await playerMay(message, actor, origin(message), tx('SR2E.Card.Chat.resistsPower', { actorName: actor.name, name: String(t.name ?? tx('SR2E.Card.Chat.aToxin')), power: t.power ?? '?', level: t.level ?? '', part: disease ? tx('SR2E.Card.Chat.aDiseaseWhichLasts') : '' }), disease ? {} : { routine: realSources(message, t.sourceUuid) }))) return;
  // v0.61.0: a slow toxin can't be resisted before it takes effect (the GM may go ahead anyway).
  const nowT = sysNow();
  if (Number(t.onsetAt ?? 0) > nowT) {
    const left = toxinOnsetLabel(Number(t.onsetAt) - nowT, nowT, Number(t.onsetAt));
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.hasnTTakenEffectYet', { tName: escHtml(t.name ?? tx('SR2E.Notify.Chat.it')), left: escHtml(left) }));
    const go = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Chat.notYet') }, content: `<p>${tx('SR2E.Dialog.Chat.hasnTTakenEffectYetResist', { name: escHtml(t.name ?? tx('SR2E.Dialog.Chat.it')), left: escHtml(left) })}</p>`, rejectClose: false });
    if (!go) return;
  }
  // v0.55.0: once per person on a card.
  const key = `toxinResisted${index}`;
  if (cardDone(message, actor, key)) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyResisted'));
  button.disabled = true;
  await markCardDone(message, actor, key);
  await actor.resistToxin(t);
}

/**
 * v0.92.3 (Core p. 186): still in contact with the toxin when its speed period passes: everyone on the card resists
 * again (the GM). A fresh card, with the toxin's onset counted from now.
 */
async function onReexposeToxin923(message: any): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanDoThat'));
  const list = listFlag(message.getFlag(SYSTEM_ID, 'toxins')).filter((t: any) => t && typeof t === 'object').map((t: any) => boundToxin(t));
  const first: any = list[0];
  if (!first || first.kind === 'disease') return;
  const targets = list.map((t: any) => String(t.targetUuid ?? '')).filter(Boolean);
  const by: any = (first.sourceUuid ? await fromUuid(first.sourceUuid) : null) ?? (targets[0] ? await fromUuid(targets[0]) : null);
  if (!by?.exposeToxinState) return;
  const { targetUuid: _t, onsetAt: _o, sourceUuid: _s, ...tox } = first;
  await by.exposeToxinState({ ...tox, kind: tox.kind || 'toxin', speed: tox.speed ?? 'immediate', needsWound: false }, targets, tx('SR2E.Card.Chat.stillExposed923', { name: String(tox.name ?? '') }));
}

/** v0.55.0: put out the flames (the burning actor's owner or the GM). */
async function onPutOutFire(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'putOutFire') as { actorUuid: string } | undefined;
  const a: any = f ? await fromUuid(f.actorUuid) : null;
  if (!a) return;
  if (!a.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm19', { name: escHtml(a.name) }));
  if (!(await playerMay(message, a, origin(message), tx('SR2E.Card.Chat.putsOutTheFlames', { name: a.name }), { routine: realSources(message) }))) return;
  button.disabled = true;
  if (!(await a.putOutFire?.())) button.disabled = false;
}

/** v0.55.0 (GM): pin someone the holder's player couldn't (they don't own the target). */
async function onApplyHold(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanApplyThis'));
  if (!message.getFlag(SYSTEM_ID, 'hold') || message.getFlag(SYSTEM_ID, 'holdApplied')) return;
  const h = await gmApplyFlag<{ targetUuid: string; holderUuid: string }>(message, 'applyHold');
  const t: any = h ? await fromUuid(h.targetUuid) : null;
  if (!h || !t) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    await (CONFIG.Actor.documentClass as any).setHeld(t, h.holderUuid, true);
    await message.setFlag(SYSTEM_ID, 'holdApplied', true);
  });
}

/** v0.55.0: under suppressive fire, dive for cover (go prone). */
async function onTakeCover(message: any, button: HTMLButtonElement): Promise<void> {
  const list = listFlag<string>(message.getFlag(SYSTEM_ID, 'takeCover'));
  const u = list[safeInt(button.dataset['index'], 0, 99, 0)];
  const a: any = safeStr(u, 400) ? await fromUuid(u) : null;
  if (!a) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterIsGone'));
  if (!a.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm19', { name: escHtml(a.name) }));
  // The shooter (`takeCoverFrom`, documents/index.ts suppressive fire) is the card's real source.
  if (!(await playerMay(message, a, origin(message), tx('SR2E.Card.Chat.divesForCoverGoesProne', { name: a.name }), { routine: realSources(message, message.getFlag(SYSTEM_ID, 'takeCoverFrom')) }))) return;
  button.disabled = true;
  try { await a.toggleStatusEffect?.('prone', { active: true }); } catch { /* no token */ }
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: `<p><strong>${escHtml(a.name)}</strong> ${tx('SR2E.Card.Chat.divesForCover')}</p>` });
}

/** v0.55.0: a weapon's toxin on a hit (a dart, capsule round or poisoned blade): the target resists it once. */
async function onToxinHit(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'toxinHit') as { targetUuid: string; toxin: any } | undefined;
  const a: any = f ? await fromUuid(f.targetUuid) : null;
  if (!f || !a || !f.toxin || typeof f.toxin !== 'object') return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterIsGone'));
  if (!a.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm20', { name: escHtml(a.name) }));
  // R2-SEC-8: the toxin's Power and level bounded, as on Resist (onResistToxin); v0.81.1 (A-2): every field.
  const tox: any = boundToxin(f.toxin);
  const toxName = String(tox.name ?? 'a toxin').slice(0, 120), toxFrom = String(tox.from ?? 'a weapon').slice(0, 120);
  // A weapon's toxin is routine (from the soak card's own test); a disease on a toxin card confirms.
  if (!(await playerMay(message, a, origin(message), tx('SR2E.Card.Chat.resistsPowerFrom', { name: a.name, toxName, toxPower: tox.power ?? '?', toxLevel: tox.level ?? '', toxFrom }), tox.kind === 'disease' ? {} : { routine: realSources(message) }))) return;
  if (cardDone(message, a, 'toxinHitRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyRolled'));
  button.disabled = true;
  await markCardDone(message, a, 'toxinHitRolled');
  // v0.61.0: a slow toxin takes effect later: a card with its onset (Resist waits until then).
  const sp = RULES.TOXINS.speeds.find((x) => x.id === tox.speed);
  if (RULES.HEALTH_V61.onset.enabled && sp && Number(sp.seconds) > 0) {
    await a.exposeToxinState({ ...tox, kind: tox.kind || 'toxin' }, [a.uuid], tx('SR2E.Card.Chat.from', { toxName, toxFrom }));
    return;
  }
  await a.resistToxin({ ...tox, kind: tox.kind || 'toxin', from: toxFrom, label: undefined });
}

/** v0.55.0 (GM): combine this blast with the one before it (they went off together at one spot). */
async function onCombineBlast(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCombinesBlasts'));
  if (message.getFlag(SYSTEM_ID, 'combinedInto')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyCombined'));
  const list: any[] = (game as any).messages?.contents ?? [];
  const i = list.findIndex((m: any) => m.id === message.id);
  const earlier = list.slice(0, Math.max(0, i)).reverse().find((m: any) => m.getFlag?.(SYSTEM_ID, 'damages') && m.getFlag?.(SYSTEM_ID, 'blastAt') && !m.getFlag?.(SYSTEM_ID, 'combinedInto'));
  if (!earlier) return ui.notifications.warn(tx('SR2E.Notify.Chat.thereIsNoEarlierBlastCard'));
  if (resistedOn(message).length || resistedOn(earlier).length) return ui.notifications.warn(tx('SR2E.Notify.Chat.someoneHasAlreadyResistedOneOf'));
  // Round 2 (R2-SEC-7): unless both cards are a GM's, the GM confirms, with both blasts' Power from their flags.
  const blastLine = (m: any) => { const b = m.getFlag?.(SYSTEM_ID, 'blastAt') ?? {}; return tx('SR2E.App.Chat.sBlastPowerPerMetre', { name: String(m.author?.name ?? tx('SR2E.App.Chat.someone')), power: safeInt(b.power, 0, 200, 0), perMetre: Number(b.perMetre) || 1, caught: listFlag(m.getFlag?.(SYSTEM_ID, 'damages')).length }); };
  if (!(authorIsGm(message) && authorIsGm(earlier))) {
    // gmMay names the poster of whichever card isn't a GM's.
    const by = authorIsGm(message) ? earlier : message;
    if (!(await gmMay(by, { title: tx('SR2E.Dialog.Chat.combineBlasts'), lines: [blastLine(earlier), blastLine(message), tx('SR2E.Dialog.Chat.theyGoOffTogetherAsOne')], always: true }))) return;
  }
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    if (!(await cls.combineBlastCards(message, earlier))) button.disabled = false;
  });
}

/** A drug's crash as it wears off. */
async function onDrugCrash(message: any, button: HTMLButtonElement): Promise<void> {
  const c = message.getFlag(SYSTEM_ID, 'drugCrash') as { actorUuid: string; name: string; power: number; level: any } | undefined;
  const actor: any = c ? await fromUuid(c.actorUuid) : null;
  if (!c || !actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm4', { actorName: escHtml(actor.name) }));
  const drug = String(c.name ?? 'drug').slice(0, 120);
  if (!(await playerMay(message, actor, origin(message), tx('SR2E.Card.Chat.resistsTheCrashPower', { actorName: actor.name, drug, boundPower: boundPower(c.power), boundLevel: boundLevel(c.level) })))) return;
  if (cardDone(message, actor, 'drugCrashRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.theCrashHasAlreadyBeenRolled'));
  button.disabled = true;
  await actor.resistToxin({ name: drug, vector: 'ingestion', power: boundPower(c.power), level: boundLevel(c.level), damageType: 'stun', label: tx('SR2E.Card.Chat.drugCrash', { drug }) });
  await markCardDone(message, actor, 'drugCrashRolled');
}

/** An adrenal pump's crash: the wearer resists. */
async function onAdrenalCrash(message: any, button: HTMLButtonElement): Promise<void> {
  const c = message.getFlag(SYSTEM_ID, 'adrenalCrash') as { actorUuid: string; itemId?: string; rating: number; turns?: number } | undefined;
  const actor: any = c ? await fromUuid(c.actorUuid) : null;
  if (!c || !actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm4', { actorName: escHtml(actor.name) }));
  if (!(await playerMay(message, actor, origin(message), tx('SR2E.Card.Chat.resistsAnAdrenalPumpCrashRating', { actorName: actor.name, rating: safeInt(c.rating, 0, 10, 0) })))) return;
  if (cardDone(message, actor, 'adrenalRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.theCrashHasAlreadyBeenRolled'));
  // v0.92.3 review fix: the rating and the turns it ran come from the pump itself (the card's numbers are only its text):
  // the card's item, else the wearer's adrenal pump.
  const pumps = Array.from((actor.items ?? []) as Iterable<any>).filter((i: any) => i.type === 'cyberware' && i.system?.bioKind === 'adrenalPump');
  const pump: any = pumps.find((i: any) => i.id === c.itemId) ?? pumps[0];
  if (!pump) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterNoLongerExists'));
  button.disabled = true;
  // v0.92.3 (RULES.GEAR_V923.adrenalCrash 'book'): the turns it ran set the crash's Power.
  const ran = Number(pump.getFlag?.(SYSTEM_ID, 'adrenalTurns'));
  await actor.rollAdrenalCrash(safeInt(pump.system?.rating, 0, 10, 1), Number.isFinite(ran) ? safeInt(ran, 0, 12, 0) : c.turns === undefined ? undefined : 0);
  await markCardDone(message, actor, 'adrenalRolled');
}

/** Simsense overload (hot sim): the decker resists. */
async function onOverload(message: any, button: HTMLButtonElement): Promise<void> {
  const o = message.getFlag(SYSTEM_ID, 'overload') as { deckerUuid: string; tn: number } | undefined;
  const decker: any = o ? await fromUuid(o.deckerUuid) : null;
  if (!o || !decker) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatDeckerNoLongerExists'));
  if (!decker.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm17', { deckerName: escHtml(decker.name) }));
  if (!(await playerMay(message, decker, origin(message), tx('SR2E.Card.Chat.resistsSimsenseOverloadTn', { deckerName: decker.name, tn: safeInt(o.tn, 2, 30, 4) })))) return;
  if (cardDone(message, decker, 'overloadRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.theOverloadTestHasAlreadyBeen'));
  button.disabled = true;
  await decker.rollOverload(safeInt(o.tn, 2, 30, 4));
  await markCardDone(message, decker, 'overloadRolled');
}

/** GM: apply a change to a host's data stores or alert that a player's client posted. */
async function onApplyHost(message: any, button: HTMLButtonElement): Promise<void> {
  const c = message.getFlag(SYSTEM_ID, 'hostChange') as ({ hostUuid: string } & Record<string, any>) | undefined;
  if (!c) return;
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanChangeA2'));
  if (message.getFlag(SYSTEM_ID, 'hostApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisHasAlreadyBeenApplied'));
  const v = await gmApplyFlag<typeof c>(message, 'applyHost');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const { hostUuid, sourceUuid: _s, ...change } = v;
    const cls: any = CONFIG.Actor.documentClass;
    const note = await cls.applyHostChange(hostUuid, change);
    if (note === null) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.thatHostNoLongerExists')); }
    await message.setFlag(SYSTEM_ID, 'hostApplied', true);
    await ChatMessage.create({ speaker: { alias: tx('SR2E.Card.Chat.host') }, content: note, whisper: [game.user.id] });
  });
}

/** GM: apply security tally successes that a player's system test posted. */
async function onApplyTally(message: any, button: HTMLButtonElement): Promise<void> {
  const t = message.getFlag(SYSTEM_ID, 'tally') as { hostUuid: string; successes: number; key?: string; name?: string } | undefined;
  if (!t) return;
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanChangeA3'));
  if (message.getFlag(SYSTEM_ID, 'tallyApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisHasAlreadyBeenApplied'));
  const v = await gmApplyFlag<typeof t>(message, 'applyTally');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    // v0.81.1 (D3-7, FX-DOC wiring): the card's source, so the tally key is checked against its own (and its frames').
    const note = await cls.applyTallyCard(v.hostUuid, safeInt(v.successes, 0, 30, 0), v.key ? { key: String(v.key), name: String(v.name ?? '') } : null, String((v as any).sourceUuid ?? ''));
    if (note === null) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.thatHostNoLongerExists')); }
    await message.setFlag(SYSTEM_ID, 'tallyApplied', true);
    await ChatMessage.create({ speaker: { alias: tx('SR2E.Card.Chat.securityTally') }, content: note, whisper: [game.user.id] });
  });
}

/** Add an SR2 barrier rating field to the wall config (used when shooting through walls). */
function registerWallConfig(): void {
  Hooks.on('renderWallConfig', (app: any, html: HTMLElement) => {
    try {
      const root: HTMLElement = (html as any)?.querySelector ? html : (html as any)?.[0] ?? app.element;
      const form: HTMLFormElement | null = root?.tagName === 'FORM' ? (root as any) : root?.querySelector('form');
      if (!form || form.querySelector('[name="flags.sr2e.barrierRating"]')) return;
      // v0.72.0 (O1): an unset rating stays blank (unrated walls stop blasts; RULES.COMBAT_V72.blastBarriers.unratedWalls).
      const rawRating = app.document?.getFlag?.(SYSTEM_ID, 'barrierRating');
      const value = rawRating === null || rawRating === undefined || rawRating === '' ? '' : (Number(rawRating) || 0);
      const burns = Boolean(app.document?.getFlag?.(SYSTEM_ID, 'burns'));
      const group = document.createElement('div');
      group.className = 'form-group';
      group.innerHTML = `<label>${tx('SR2E.Card.Chat.sr2BarrierRating')}</label><div class="form-fields"><input type="number" name="flags.sr2e.barrierRating" value="${value}" min="0" step="1" placeholder="${tx('SR2E.Card.Chat.notSet', { barriersDefaultWallRating: RULES.COMBAT.barriers.defaultWallRating })}"></div>
        <p class="hint">${tx('SR2E.Card.Chat.addedToATargetSArmor', { barriersDefaultWallRating: RULES.COMBAT.barriers.defaultWallRating, part: RULES.COMBAT_V72.blastBarriers.unratedWalls === 'block' ? tx('SR2E.Card.Chat.aBlastIsStoppedCompletely') : tx('SR2E.Card.Chat.aBlastCountsTheSame') })}</p>`;
      // v0.48.0: a wall that burns (wood, plasterboard) loses rating inside a fire and lets it through once burnt.
      const burnGroup = document.createElement('div');
      burnGroup.className = 'form-group';
      burnGroup.innerHTML = `<label>${tx('SR2E.Card.Chat.sr2Burns')}</label><div class="form-fields"><input type="checkbox" name="flags.sr2e.burns" ${burns ? 'checked' : ''}></div>
        <p class="hint">${tx('SR2E.Card.Chat.aFireBurnsThroughItRating', { wallsDefaultRating: RULES.FIRE.walls.defaultRating })}</p>`;
      // v0.78.0 (RULES.BOOK_V78.barriers 'book'): a security door breaks only at 0 (an ordinary door at half its rating).
      const secDoor = Boolean(app.document?.getFlag?.(SYSTEM_ID, 'securityDoor'));
      const doorGroup = document.createElement('div');
      doorGroup.className = 'form-group';
      doorGroup.innerHTML = `<label>${tx('SR2E.Card.Chat.sr2SecurityDoor')}</label><div class="form-fields"><input type="checkbox" name="flags.sr2e.securityDoor" ${secDoor ? 'checked' : ''}></div>
        <p class="hint">${tx('SR2E.Card.Chat.aDoorBreaksWhenDamageBrings')}</p>`;
      const anchor = form.querySelector('footer, .form-footer, button[type="submit"]');
      const parent = anchor?.parentElement === form ? form : (anchor?.closest('footer')?.parentElement ?? form);
      if (anchor) { parent.insertBefore(group, anchor.closest('footer') ?? anchor); parent.insertBefore(burnGroup, anchor.closest('footer') ?? anchor); parent.insertBefore(doorGroup, anchor.closest('footer') ?? anchor); }
      // v0.82.0 (RV82 D-O9): the security-door field too when the form has no footer.
      else { form.appendChild(group); form.appendChild(burnGroup); form.appendChild(doorGroup); }
      app.setPosition?.({ height: 'auto' });
    } catch (err) {
      console.warn('sr2e | Could not add the barrier rating field', err);
    }
  });
}

/** GM: an Award Karma / nuyen button in the Actors sidebar (v0.33.0). */
function registerActorDirectory(): void {
  Hooks.on('renderActorDirectory', (_app: any, html: HTMLElement) => {
    try {
      if (!game.user?.isGM) return;
      const root: HTMLElement = (html as any)?.querySelector ? html : (html as any)?.[0];
      if (!root || root.querySelector('[data-sr2e-action="award"]')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset['sr2eAction'] = 'award';
      btn.className = 'sr2e-award';
      btn.innerHTML = `<i class="fa-solid fa-award"></i> ${tx('SR2E.Card.Chat.awardKarmaNuyen')}`;
      btn.addEventListener('click', (ev) => { ev.preventDefault(); void openAwardDialog(); });
      const anchor = root.querySelector('.directory-footer, footer') ?? root.querySelector('.directory-header, header');
      (anchor ?? root).appendChild(btn);
    } catch (err) {
      console.warn('sr2e | Could not add the award button', err);
    }
  });
}

/** The GM's award dialog: pick characters (player-owned ticked), Karma, nuyen, a reason, and a Karma Pool refresh. */
export async function openAwardDialog(): Promise<void> {
  const chars = [...(game.actors ?? [])].filter((a: any) => a.type === 'character');
  if (!chars.length) return ui.notifications.warn(tx('SR2E.Notify.Chat.thereAreNoCharactersToAward'));
  const r = await (foundry as any).applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Chat.awardKarmaAndNuyen') },
    content: `<fieldset><legend>${tx('SR2E.Dialog.Chat.who')}</legend>${chars.map((a: any) => `<label class="sr2e-check"><input type="checkbox" name="who" value="${escHtml(a.uuid)}" ${a.hasPlayerOwner ? 'checked' : ''}> ${escHtml(a.name)}</label>`).join('')}</fieldset>
      <div class="form-group"><label>${tx('SR2E.Dialog.Chat.karmaEach')}</label><input name="karma" type="number" value="0" min="0"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Chat.nuyenEach')}</label><input name="nuyen" type="number" value="0"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Chat.whatFor')}</label><input name="reason" type="text" placeholder="${tx('SR2E.Dialog.Chat.eGTheWarehouseRun')}"></div>
      <label class="sr2e-check"><input type="checkbox" name="refresh"> ${tx('SR2E.Dialog.Chat.refreshTheirKarmaPools')}</label>
      <details class="sr2e-award-breakdown"><summary>${tx('SR2E.Dialog.Chat.karmaByTheGmChapterS')}</summary>
        <label class="sr2e-check"><input type="checkbox" name="breakdown"> ${tx('SR2E.Dialog.Chat.useTheBreakdown')}</label>
        <p class="hint">${tx('SR2E.Dialog.Chat.teamAwardsGoToEveryoneTicked')}</p>
        ${RULES.CHARACTERS_V58.karmaAward.team.map((t) => `<div class="form-group"><label>${escHtml(t.label)} (0–${t.max})</label><input name="team-${escHtml(t.id)}" type="number" min="0" max="${t.max}" value="${t.value}"></div>`).join('')}
        <table class="sr2e-award-table"><thead><tr><th></th>${chars.map((a: any) => `<th>${escHtml(a.name)}</th>`).join('')}</tr></thead><tbody>
          ${individualAwardRows().map((row) => `<tr><td>${escHtml(row.label)} (+${row.value})</td>${chars.map((a: any) => `<td><input type="checkbox" name="ind-${escHtml(row.id)}" value="${escHtml(a.uuid)}"></td>`).join('')}</tr>`).join('')}
        </tbody></table>
      </details>`,
    ok: {
      label: tx('SR2E.Dialog.Chat.award'),
      callback: (_e: Event, b: any) => {
        const f = b.form;
        const team = Object.fromEntries(RULES.CHARACTERS_V58.karmaAward.team.map((t) => [t.id, Number(f.elements[`team-${t.id}`]?.value) || 0]));
        const ind: Record<string, Record<string, boolean>> = {};
        for (const row of individualAwardRows()) {
          for (const i of [...f.querySelectorAll(`input[name="ind-${row.id}"]:checked`)] as any[]) (ind[String(i.value)] ??= {})[row.id] = true;
        }
        return {
          who: [...f.querySelectorAll('input[name="who"]:checked')].map((i: any) => String(i.value)),
          karma: Number(f.elements.karma.value) || 0, nuyen: Number(f.elements.nuyen.value) || 0,
          reason: String(f.elements.reason.value), refresh: Boolean(f.elements.refresh.checked),
          breakdown: Boolean(f.elements.breakdown?.checked), team, ind,
        };
      },
    },
    rejectClose: false,
  });
  if (!r || !r.who.length) return;
  const Actor: any = CONFIG.Actor.documentClass;
  // v0.58.0: the GM chapter's breakdown: team rows for everyone ticked, individual rows per character.
  if (r.breakdown) {
    await Actor.awardBreakdown({ team: r.team, individual: Object.fromEntries(r.who.map((u: string) => [u, r.ind[u] ?? {}])), nuyen: r.nuyen, reason: r.reason, refreshPool: r.refresh });
    return;
  }
  await Actor.awardGroup(r.who, { karma: r.karma, nuyen: r.nuyen, reason: r.reason, refreshPool: r.refresh });
}

/**
 * v0.91.0 review (R4): find cards whose Buy or Haggle is running on this client. The shop's purchase is slower than
 * the old one, and a card re-rendered meanwhile would offer a live Buy (or Haggle) again before 'bought' is set.
 */
const dealBusy = new Set<string>();

/** A Buy button on a find card: the buyer pays (once). */
async function onBuyItem(message: any, button: HTMLButtonElement): Promise<void> {
  const id = String(message?.id ?? '');
  if (dealBusy.has(id)) return;
  dealBusy.add(id);
  try { await buyOnce(message, button); } finally { dealBusy.delete(id); }
}

async function buyOnce(message: any, button: HTMLButtonElement): Promise<void> {
  const b = message.getFlag(SYSTEM_ID, 'buy') as { actorUuid: string; itemId?: string; shop?: string; price: number; hours?: number; qty?: number } | undefined;
  const actor: any = b ? await fromUuid(b.actorUuid) : null;
  if (!b || !actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatBuyerNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm21', { actorName: escHtml(actor.name) }));
  // v0.91.0: a shop find's card carries the shop key; the actor reads the entry (and its price) again from its source.
  const shopKey = typeof b.shop === 'string' && b.shop ? b.shop : '';
  if (!(await playerMay(message, actor))) return;
  if (message.getFlag(SYSTEM_ID, 'bought')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyPaidFor'));
  if (message.getFlag(SYSTEM_ID, 'superseded')) return ui.notifications.warn(tx('SR2E.Notify.Chat.thePriceWasHaggledOverUse'));
  if (message.getFlag(SYSTEM_ID, 'requested')) return ui.notifications.warn(tx('SR2E.Notify.Shop.alreadyRequested'));
  button.disabled = true;
  // v0.81.0 (SEC1-6): never a negative price (it paid the buyer); documents/index.ts prices the item itself too.
  const price = b.price === undefined || b.price === null ? undefined : safeInt(b.price, 0, 1_000_000_000, 0);
  // v0.91.0 review (R2): the find time keeps its fraction (12 h ÷ 5 successes is 2.4 h, not 2; under 1 h was 0).
  const hours = Math.max(0, Math.min(100_000, Number.isFinite(Number(b.hours)) ? Number(b.hours) : 0));
  const bought = shopKey ? await actor.buyFromShop(shopKey, price, hours, safeInt(b.qty, 1, 1000, 1))
    : await actor.buyItem(String(b.itemId ?? ''), price, hours, safeInt(b.qty, 1, 1000, 1));
  // v0.91.0: with the approval queue on, the purchase went to the GM: the card's Buy is spent (the GM decides).
  if (bought === 'requested') { if (message.isOwner) await message.setFlag(SYSTEM_ID, 'requested', true); }
  else if (bought) { if (message.isOwner) await message.setFlag(SYSTEM_ID, 'bought', true); }
  else button.disabled = false;
}

/** Haggle over a find card's price once (v0.44.0); the new price comes on a new card. */
async function onHaggle(message: any, button: HTMLButtonElement): Promise<void> {
  const id = String(message?.id ?? '');
  if (dealBusy.has(id)) return;
  dealBusy.add(id);
  try { await haggleOnce(message, button); } finally { dealBusy.delete(id); }
}

async function haggleOnce(message: any, button: HTMLButtonElement): Promise<void> {
  const b = message.getFlag(SYSTEM_ID, 'buy') as { actorUuid: string; itemId?: string; shop?: string; price: number; name: string; qty?: number } | undefined;
  const actor: any = b ? await fromUuid(b.actorUuid) : null;
  if (!b || !actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatBuyerNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm22', { actorName: escHtml(actor.name) }));
  if (!(await playerMay(message, actor))) return;
  if (message.getFlag(SYSTEM_ID, 'bought') || message.getFlag(SYSTEM_ID, 'superseded') || message.getFlag(SYSTEM_ID, 'requested')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyBoughtOrHaggled'));
  // v0.91.6 review (R2): a fixer's find has no Haggle (the fixer deals; haggling would drop their cut).
  if ((message.getFlag(SYSTEM_ID, 'contest') as any)?.deal?.through?.mode === 'fixer') return ui.notifications.warn(tx('SR2E.Notify.Through.noHaggle'));
  button.disabled = true;
  if (message.isOwner) await message.setFlag(SYSTEM_ID, 'superseded', true);
  // v0.81.1 (D1-5): no new card (an exclusive spell blocks the test, or it failed): this card's Buy stays live.
  const price = await actor.haggle(b);
  if (typeof price !== 'number') {
    if (message.isOwner) await message.unsetFlag?.(SYSTEM_ID, 'superseded');
    button.disabled = false;
  }
}

/** Sell an item to a fence from the fence's offer card, once (v0.44.0). */
async function onSellItem(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'sell') as { actorUuid: string; itemId: string; price: number; heat?: number } | undefined;
  const actor: any = f ? await fromUuid(f.actorUuid) : null;
  if (!f || !actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatSellerNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm23', { actorName: escHtml(actor.name) }));
  if (!(await playerMay(message, actor))) return;
  if (message.getFlag(SYSTEM_ID, 'sold')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadySold'));
  button.disabled = true;
  if (await actor.sellItem(String(f.itemId ?? ''), safeInt(f.price, 0, 1_000_000_000, 0), safeInt(f.heat, 0, 100, 0))) { if (message.isOwner) await message.setFlag(SYSTEM_ID, 'sold', true); }
  else button.disabled = false;
}

/** v0.49.0 (GM): move an overdue tenant down a lifestyle, once. */
async function onEvict(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanDoThat'));
  const f = message.getFlag(SYSTEM_ID, 'evict') as { actorUuid: string; from: string } | undefined;
  const actor: any = f ? await fromUuid(f.actorUuid) : null;
  if (!f || !actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterNoLongerExists'));
  if (message.getFlag(SYSTEM_ID, 'evicted')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyDone'));
  if (String(actor.system?.lifestyle?.level ?? '') !== f.from) return ui.notifications.warn(tx('SR2E.Notify.Chat.sLifestyleHasChangedSinceNothing', { actorName: escHtml(actor.name) }));
  // v0.81.0 (SEC1-17): the GM's own timer posts these; another author's card needs the GM's yes (and must be theirs).
  if (!(await gmMay(message, { title: tx('SR2E.Dialog.Chat.eviction'), lines: [tx('SR2E.Dialog.Chat.movesDownFromTheLifestyle', { actorName: actor.name, from: f.from })], sources: [actor.uuid], always: true }))) return;
  await gmLocked(message, button, async () => {
    // v0.85.0: under the GM lock, checked again (a second click while the dialog was open).
    if (message.getFlag(SYSTEM_ID, 'evicted') || String(actor.system?.lifestyle?.level ?? '') !== f.from) return;
    button.disabled = true;
    await actor.moveLifestyleDown(tx('SR2E.Card.Chat.theRentWasOverdue'));
    await message.setFlag(SYSTEM_ID, 'evicted', true);
  });
}

/** GM: a Surprise test button in the combat tracker. */
function registerCombatTracker(): void {
  Hooks.on('renderCombatTracker', (_app: any, html: HTMLElement) => {
    try {
      if (!game.user?.isGM) return;
      const root: HTMLElement = (html as any)?.querySelector ? html : (html as any)?.[0];
      const combat: any = game.combat;
      if (!root || !combat || root.querySelector('[data-sr2e-action="surprise"]')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset['sr2eAction'] = 'surprise';
      btn.className = 'sr2e-surprise';
      btn.innerHTML = `<i class="fa-solid fa-bolt"></i> ${tx('SR2E.Card.Chat.surpriseTest')}`;
      btn.title = RULES.DOCS_V79.rangedSurprise.mode === 'order'
        ? tx('SR2E.Card.Chat.everyCombatantRollsVsTheSurprise', { surpriseAttribute: RULES.SURPRISE.attribute, surpriseTn: RULES.SURPRISE.tn })
        : tx('SR2E.Card.Chat.everyCombatantRollsVsTheLosing', { surpriseAttribute: RULES.SURPRISE.attribute, surpriseTn: RULES.SURPRISE.tn });
      btn.addEventListener('click', (ev) => { ev.preventDefault(); void combat.rollSurprise?.(); });
      const anchor = root.querySelector('.combat-tracker-header, header, .encounter-controls') ?? root.firstElementChild;
      (anchor ?? root).appendChild(btn);
      // v0.60.0: roll initiative for every NPC still without a score (only when Foundry's own header button isn't there).
      if (!root.querySelector('[data-sr2e-action="rollNpcs"], [data-action="rollNPC"]')) {
        const npc = document.createElement('button');
        npc.type = 'button';
        npc.dataset['sr2eAction'] = 'rollNpcs';
        npc.className = 'sr2e-surprise';
        npc.innerHTML = `<i class="fa-solid fa-users"></i> ${tx('SR2E.Card.Chat.rollNpcs')}`;
        npc.title = tx('SR2E.Card.Chat.rollInitiativeForEveryCombatantNo');
        npc.addEventListener('click', (ev) => { ev.preventDefault(); void combat.rollNPC?.(); });
        (anchor ?? root).appendChild(npc);
      }
    } catch (err) {
      console.warn('sr2e | Could not add the surprise button', err);
    }
  });
}

/**
 * Defend and Resist prompts (v0.23.0): when an attack or damage card names a target, the user
 * responsible for it (an active player who owns it, else the active GM) is offered the Defend or
 * Resist dialog straight away, or just notified (client setting `defendPrompt`).
 */
export function promptRecipients(target: any, users: any[], activeGmId: string | null): string[] {
  const players = users.filter((u: any) => u.active && !u.isGM && target?.testUserPermission?.(u, 'OWNER'));
  return players.length ? players.map((u: any) => u.id) : activeGmId ? [activeGmId] : [];
}

const prompted = new Set<string>();

/** A Defend / Resist entry a card may prompt for. */
type PromptEntry = { kind: 'defend' | 'resist' | 'resistSpell'; index: number; uuid: string; what: string };

/**
 * v0.81.1 (SEC1-4, design 2): the Defend / Resist entries a card prompts for: one per target (the first entry naming
 * it), at most MAX_CARD_PROMPTS; on a player's card only entries whose target or real source (attacker, caster, test
 * roller) the author owns. Round 2 (FIX2-BRIEF E, V-SEC 10): past the cap, the first MAX_CARD_PROMPTS are prompted and
 * the rest come back in `more` (one notification: use the card's buttons), on a player's card as on a GM's.
 */
export function promptPlan(message: any): { entries: PromptEntry[]; more: PromptEntry[] } {
  const content = String(message?.content ?? '');
  const raw: Array<{ kind: 'defend' | 'resist' | 'resistSpell'; index: number; uuid: string; what: string; sources: unknown[] }> = [];
  const listOf = (many: string, one: string) => { const v = message.getFlag?.(SYSTEM_ID, many); return (Array.isArray(v) ? v : [message.getFlag?.(SYSTEM_ID, one)]).filter((x: any) => x && typeof x === 'object'); };
  if (content.includes('data-sr2e-action="defend"')) {
    listOf('attacks', 'attack').slice(0, 100).forEach((a: any, index: number) => raw.push({ kind: 'defend', index, uuid: String(a?.targetUuid ?? ''), sources: realSources(message, a?.attackerUuid), what: tx('SR2E.Dialog.Chat.attacksWith', { attacker: nameOfUuid(String(a?.attackerUuid ?? '')) || tx('SR2E.Dialog.Chat.someone'), weaponName: String(a?.weaponName ?? tx('SR2E.Dialog.Chat.aWeapon')).slice(0, 120) }) }));
  }
  if (content.includes('data-sr2e-action="resist"')) {
    listOf('damages', 'damage').slice(0, 100).forEach((d: any, index: number) => raw.push({ kind: 'resist', index, uuid: String(d?.targetUuid ?? ''), sources: damageSources(message, d), what: tx('SR2E.Dialog.Chat.toResist', { power: safeInt(d?.power, 0, damageCap(message), 0), level: boundLevel(d?.level), damageType: boundType(d?.damageType) }) }));
  }
  if (content.includes('data-sr2e-action="resistSpell"')) {
    listOf('spells', 'spell').slice(0, 100).forEach((sp: any, index: number) => raw.push({ kind: 'resistSpell', index, uuid: String(sp?.targetUuid ?? ''), sources: realSources(message, sp?.casterUuid), what: tx('SR2E.Dialog.Chat.castsForce', { caster: nameOfUuid(String(sp?.casterUuid ?? '')) || tx('SR2E.Dialog.Chat.someone'), spellName: String(sp?.spellName ?? tx('SR2E.Dialog.Chat.aSpell')).slice(0, 120), force: safeInt(sp?.force, 0, 30, 0) }) }));
  }
  const gm = authorIsGm(message);
  const seen = new Set<string>();
  const out: PromptEntry[] = [];
  for (const e of raw) {
    if (!safeStr(e.uuid, 400) || seen.has(e.uuid)) continue;
    seen.add(e.uuid);
    if (!gm && !(authorOwns(message, e.uuid) || trustedSource(cardTrust(message), e.sources))) continue;
    out.push({ kind: e.kind, index: e.index, uuid: e.uuid, what: e.what });
  }
  return { entries: out.slice(0, MAX_CARD_PROMPTS), more: out.slice(MAX_CARD_PROMPTS) };
}

/** The entries a card prompts for (`promptPlan`'s first MAX_CARD_PROMPTS). Exported for the tests. */
export function promptEntries(message: any): PromptEntry[] {
  return promptPlan(message).entries;
}

async function promptForCard(message: any): Promise<void> {
  if (prompted.has(message.id)) return;
  prompted.add(message.id);
  if (prompted.size > 500) prompted.delete(prompted.values().next().value as string);
  // v0.50.0: a card the GM re-scored (a changed TN) doesn't ask anyone to defend or resist again.
  if (message.getFlag?.(SYSTEM_ID, 'retargetOf')) return;
  let mode = 'dialog';
  try { mode = String(game.settings.get(SYSTEM_ID, 'defendPrompt') ?? 'dialog'); } catch { /* not registered */ }
  const { entries, more } = promptPlan(message);
  const gm = (game.users as any)?.activeGM?.id ?? null;
  // Round 2 (E): the targets past the cap get one notification on the clients that answer for them.
  // v0.85.0: of several windows of the GM user, only the one used most recently prompts (leader.ts).
  const leadWindow = !game.user?.isGM || isPromptWindow();
  const mine = leadWindow ? more.filter((e) => { try { return promptRecipients(fromUuidSync(e.uuid), [...(game.users ?? [])], gm).includes(game.user?.id); } catch { return false; } }) : [];
  if (mine.length && mode !== 'off') ui.notifications?.info?.(tx('SR2E.Notify.Chat.moreTargetOnThisCardUse', { mineLength: tCount(mine.length, 'SR2E.Count.moreTarget') }));
  let cued = false;
  for (const e of entries) {
    let target: any = null;
    try { target = fromUuidSync(e.uuid); } catch { target = null; }
    if (!target) continue;
    if (e.kind === 'resist' && resistedOn(message).includes(e.index)) continue;
    if (e.kind === 'resistSpell' && spellResistedOn(message).includes(e.index)) continue;
    if (!leadWindow || !promptRecipients(target, [...(game.users ?? [])], gm).includes(game.user?.id)) continue;
    // v0.60.0: the GM's client is about to resist for this NPC by itself (the same test as autoResistCard's).
    if (e.kind !== 'defend' && autoResistPlanned(message, e.kind, e.index, target) && isLeadGm()
      && mayResistUnseen(message, target, e.kind === 'resist' ? damageSources(message, listFlag(message.getFlag(SYSTEM_ID, 'damages'))[e.index] ?? message.getFlag(SYSTEM_ID, 'damage'))
        : realSources(message, (listFlag(message.getFlag(SYSTEM_ID, 'spells'))[e.index] ?? message.getFlag(SYSTEM_ID, 'spell'))?.casterUuid))) continue;
    if (!cued && message.author?.id !== game.user?.id) { cued = true; playCue('attacked'); }
    const verb = e.kind === 'defend' ? tx('SR2E.Dialog.Chat.defend') : e.kind === 'resistSpell' ? tx('SR2E.Dialog.Chat.resistTheSpell') : tx('SR2E.Dialog.Chat.resistDamage2');
    if (mode === 'off') continue;
    if (mode === 'notify') {
      ui.notifications?.info?.(tx('SR2E.Notify.Chat.useOnTheChatCard', { targetName: escHtml(target.name), what: escHtml(e.what), verb }));
      continue;
    }
    // A-17: a Shift-click armed just before this arrived must not answer this prompt's dialogs with their defaults.
    disarmQuickRoll();
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: `${target.name}: ${e.kind === 'resist' ? tx('SR2E.Dialog.Chat.hit') : e.kind === 'resistSpell' ? tx('SR2E.Dialog.Chat.aSpell') : tx('SR2E.Dialog.Chat.attacked')}` },
      // A-3: names and weapon / spell names are escaped (this runs on the target's client: the GM's for an NPC).
      content: `<p><strong>${escHtml(target.name)}</strong>: ${escHtml(e.what)}.</p><p>${tx('SR2E.Dialog.Chat.now', { verb })}</p>`,
      yes: { label: verb }, no: { label: tx('SR2E.Dialog.Chat.laterUseTheCard') },
      rejectClose: false,
    });
    if (!ok) continue;
    if (e.kind === 'resist' && resistedOn(message).includes(e.index)) { ui.notifications?.info?.(tx('SR2E.Notify.Chat.hasAlreadyResistedThis', { targetName: escHtml(target.name) })); continue; }
    disarmQuickRoll();
    const real = document.querySelector<HTMLButtonElement>(`[data-message-id="${message.id}"] button[data-sr2e-action="${e.kind}"][data-index="${e.index}"]`)
      ?? (e.index === 0 ? document.querySelector<HTMLButtonElement>(`[data-message-id="${message.id}"] button[data-sr2e-action="${e.kind}"]`) : null);
    const button: any = real ?? { dataset: { index: String(e.index) }, disabled: false };
    // v0.81.1 (A-5): through the same in-flight guard as a click on the card, so the prompt and a click can't both run.
    await guarded(message, e.kind, button, () => (e.kind === 'defend' ? onDefend(message, button) : e.kind === 'resistSpell' ? onResistSpell(message, button) : onResist(message, button)));
  }
}

// ---------------------------------------------------------------- v0.45.0 magic and critters

/** GM: apply a cleansing to the scene's background count. */
async function onApplyCleanse(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmChangesTheBackground'));
  const c = message.getFlag(SYSTEM_ID, 'cleanse') as { sceneId: string; points: number; align: string[] } | undefined;
  if (!c) return;
  if (message.getFlag(SYSTEM_ID, 'cleanseApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyApplied'));
  const v = await gmApplyFlag<typeof c>(message, 'applyCleanse');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    if (await cls.applyCleansing(v.sceneId, safeInt(v.points, -20, 20, 0), listFlag<string>(v.align).filter((x) => typeof x === 'string'))) await message.setFlag(SYSTEM_ID, 'cleanseApplied', true);
    else button.disabled = false;
  });
}

/** GM: apply (or end) a possession the possessor's client couldn't set. */
async function onApplyPossession(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanApplyThis'));
  const p = message.getFlag(SYSTEM_ID, 'possession') as { targetUuid: string; by: any } | undefined;
  if (!p) return;
  if (message.getFlag(SYSTEM_ID, 'possessionApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyApplied'));
  const v = await gmApplyFlag<typeof p>(message, 'applyPossession');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    if (await cls.setPossession(v.targetUuid, v.by)) await message.setFlag(SYSTEM_ID, 'possessionApplied', true);
  });
}

/** GM: apply a sustained power's effect on a target the user's client couldn't change. */
async function onApplyPowerEffect(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanApplyThis'));
  const p = message.getFlag(SYSTEM_ID, 'powerEffect') as { targetUuid: string; effect: any; removeId: string } | undefined;
  if (!p) return;
  if (message.getFlag(SYSTEM_ID, 'powerEffectApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyApplied'));
  const v = await gmApplyFlag<typeof p>(message, 'applyPowerEffect');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    if (await cls.setPowerEffect(v.targetUuid, v.effect ?? null, String(v.removeId ?? ''))) await message.setFlag(SYSTEM_ID, 'powerEffectApplied', true);
  });
}

/** v0.56.0 (GM): apply a change a player couldn't make (a patient's boxes, a spirit changing hands). */
async function onApplyActorUpdate(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanApplyThis'));
  const c = message.getFlag(SYSTEM_ID, 'actorUpdate') as any;
  if (!c) return;
  if (message.getFlag(SYSTEM_ID, 'actorUpdateApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyApplied'));
  // v0.81.0 (SEC1-1): no free-form `update` (refused by the shape check), only the typed changes.
  const v = await gmApplyFlag(message, 'applyActorUpdate');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    const { sourceUuid: _s, ...change } = v;
    // documents/index.ts binds it too (the author must own `by`, the actor it comes from) and bounds every value.
    if (await cls.applyActorUpdate(change, { author: message.author ?? null })) await message.setFlag(SYSTEM_ID, 'actorUpdateApplied', true);
    else {
      button.disabled = false;
      // A-15: say why nothing happened (the dialog was already confirmed).
      ui.notifications.warn(tx('SR2E.Notify.Chat.notAppliedTheActorIsGone'));
    }
  });
}

/** Patch cards being applied right now (two fast clicks apply once). */
const patching = new Set<string>();
/** v0.70.0 (GM): a slap patch a player put on someone they don't own. */
async function onApplyPatch(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanApplyThis'));
  const f = message.getFlag(SYSTEM_ID, 'patchApply') as { targetUuid: string; kind: string; rating: number; name: string } | undefined;
  if (!f) return;
  if (message.getFlag(SYSTEM_ID, 'patchApplied') || patching.has(message.id)) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyApplied'));
  const v = await gmApplyFlag<typeof f>(message, 'applyPatch');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    // Marked before anything waits, so a second click (or the card's other copy) finds it taken.
    patching.add(message.id);
    button.disabled = true;
    let text = '';
    let target: any = null;
    try {
      target = await fromUuid(v.targetUuid);
      if (!target?.system?.monitor) { button.disabled = false; return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterIsGone')); }
      text = await (SR2Actor as any).patchEffect(target, { ...v, rating: safeInt(v.rating, 0, 20, 0), name: String(v.name ?? 'Patch').slice(0, 120), kind: String(v.kind ?? '') });
      await message.setFlag(SYSTEM_ID, 'patchApplied', true);
    } finally { patching.delete(message.id); }
    await ChatMessage.create({ speaker: message.speaker, content: `<p><strong>${escHtml(v.name)}</strong> ${tx('SR2E.Card.Chat.on', { kind: escHtml(v.kind), rating: safeInt(v.rating, 0, 20, 0), targetName: escHtml(target.name), text })}</p>` });
  });
}

/** v0.81.1 (D1-3, FX-DOC wiring): a mechanic's finished job on someone else's vehicle (the GM's clock carded it); re-checked when applied. */
async function onApplyVehicleJob(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanApplyThis'));
  if (message.getFlag(SYSTEM_ID, 'vehicleJobApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyApplied'));
  const v = await gmApplyFlag<{ actorUuid: string; method: string; args: unknown[] }>(message, 'applyVehicleJob');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    // V-DOC 3: a job that couldn't go in but paid its money back ('refunded') is done too: never refunded twice.
    const r = await cls.applyVehicleJobAsGm(v);
    if (r === 'refunded') { await message.setFlag(SYSTEM_ID, 'vehicleJobApplied', 'refunded'); ui.notifications.warn(tx('SR2E.Notify.Chat.notAppliedTheJobNoLonger')); }
    else if (r) await message.setFlag(SYSTEM_ID, 'vehicleJobApplied', true);
    else button.disabled = false;
  });
}

/** v0.81.1 (D2-5, FX-DOC wiring): a flash's blindness on someone the thrower's player doesn't own. */
async function onApplyTimedStatus(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanApplyThis'));
  if (message.getFlag(SYSTEM_ID, 'timedStatusApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyApplied'));
  const v = await gmApplyFlag<{ targetUuid: string; status: string; seconds: number; flashTn: number }>(message, 'applyTimedStatus');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    if (await cls.applyTimedStatusAsGm(v)) await message.setFlag(SYSTEM_ID, 'timedStatusApplied', true);
    else button.disabled = false;
  });
}

/** v0.54.0 (GM): apply a surgery result for a surgeon's player who doesn't own the patient. */
async function onApplySurgery(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanApplyThis'));
  const p = message.getFlag(SYSTEM_ID, 'surgeryApply') as { surgeonUuid: string; snap: any } | undefined;
  if (!p) return;
  if (message.getFlag(SYSTEM_ID, 'surgeryApplied')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyApplied'));
  const v = await gmApplyFlag<typeof p>(message, 'applySurgery');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    if (await cls.applySurgeryAsGm(v.surgeonUuid, v.snap)) await message.setFlag(SYSTEM_ID, 'surgeryApplied', true);
    else button.disabled = false;
  });
}

/** v0.61.0: draw a ward on the map (a region carrying it); the radius is asked. */
async function onPlaceWard(message: any): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'wardPlace') as { barrierUuid: string; name: string; radius?: number } | undefined;
  if (!f || !safeStr(f.barrierUuid, 400)) return;
  if (!(await playerMay(message, f.barrierUuid))) return;
  const r = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Chat.draw', { slice: String(f.name ?? 'it').slice(0, 120) }) },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Chat.radiusMetres')}</label><input name="r" type="number" value="${Math.max(1, Math.min(100, Number(f.radius) || 5))}" min="1" max="100"></div><p class="hint">${tx('SR2E.Dialog.Chat.clickOnTheMapToDrop')}</p>`,
    ok: { label: tx('SR2E.Dialog.Chat.place'), callback: (_e: Event, b: any) => Number(b.form.elements.r.value) || 0 },
    rejectClose: false,
  });
  if (typeof r === 'number' && r > 0) await placeWardRegion(f.barrierUuid, String(f.name ?? 'Ward').slice(0, 120), Math.min(100, r));
}

/** v0.61.0: the bound one tries to break free (their owner or the GM). */
async function onBreakBinding(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'breakBinding') as { targetUuid: string; effectId: string } | undefined;
  const a: any = f ? await fromUuid(f.targetUuid) : null;
  if (!f || !a) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterIsGone'));
  if (!a.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm24', { name: escHtml(a.name) }));
  if (!(await playerMay(message, a, origin(message), tx('SR2E.Card.Chat.triesToBreakFree', { name: a.name })))) return;
  if (!a.canAct?.('break free')) return;
  button.disabled = true;
  try { await a.breakBinding(f.effectId); } finally { button.disabled = false; }
}

/** v0.61.0 (GM): the DocWagon team arrives (once per card). */
async function onDocwagonArrive(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmSaysWhenDocwagon'));
  const f = message.getFlag(SYSTEM_ID, 'docwagon') as { actorUuid: string } | undefined;
  if (!f) return;
  if (message.getFlag(SYSTEM_ID, 'docwagonArrived')) return ui.notifications.warn(tx('SR2E.Notify.Chat.theyAlreadyArrived'));
  // Anyone can post a card: check it's a contract holder who needs the team (else the GM confirms).
  const who: any = safeStr(f.actorUuid, 400) ? await fromUuid(f.actorUuid) : null;
  if (!who?.system?.docwagon?.tier) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterHasNoDocwagonContract'));
  // v0.81.0 (SEC1-16): only the contract holder's own call (or a GM's card).
  if (!authorIsGm(message) && !authorOwns(message, who)) return ui.notifications.warn(tx('SR2E.Notify.Chat.thisCallWasnTMadeBy'));
  if (!['dying', 'dead'].includes(String(who.system?.derived?.status ?? ''))) {
    const go = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Chat.docwagon') }, content: `<p>${tx('SR2E.Dialog.Chat.isnTDyingSendTheTeam', { whoName: escHtml(who.name) })}</p>`, rejectClose: false });
    if (!go) return;
  }
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    await message.setFlag(SYSTEM_ID, 'docwagonArrived', true);
    const cls: any = CONFIG.Actor.documentClass;
    if (!(await cls.docwagonArrive(f.actorUuid, button.dataset['hostile'] === '1'))) { await message.unsetFlag(SYSTEM_ID, 'docwagonArrived'); button.disabled = false; }
  });
}

/** v0.61.0 (GM): apply healing for a healer's player who doesn't own the patient. */
async function onApplyHeal(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmCanApplyThis'));
  const p = message.getFlag(SYSTEM_ID, 'healApply') as { healerUuid: string; snap: any } | undefined;
  if (!p) return;
  const done = message.getFlag(SYSTEM_ID, 'healApplied');
  if (done) return ui.notifications.warn(done === 'superseded' ? tx('SR2E.Notify.Chat.aKarmaReRollReplacedThis') : tx('SR2E.Notify.Chat.alreadyApplied'));
  const v = await gmApplyFlag<typeof p>(message, 'applyHeal');
  if (!v) return;
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    if (await cls.applyHealAsGm(v.healerUuid, v.snap)) await message.setFlag(SYSTEM_ID, 'healApplied', true);
    else button.disabled = false;
  });
}

/** GM: put a member's offered spell in the group's grimoire. */
async function onGrimoireAdd(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmAddsToA'));
  const g = message.getFlag(SYSTEM_ID, 'grimoire') as { groupId: string; entry: any } | undefined;
  if (!g || !safeStr(g.groupId, 100) || !g.entry || typeof g.entry !== 'object' || !deepSafeKeys(g.entry)) return;
  // A-6: once per card (each click used to post another "is now in the grimoire").
  if (message.getFlag(SYSTEM_ID, 'grimoireAdded')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyAdded'));
  const cls: any = CONFIG.Actor.documentClass;
  const group = (cls.magicGroups?.() ?? []).find((x: any) => x.id === g.groupId);
  if (!group) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatGroupNoLongerExists'));
  const entry = { name: String(g.entry.name ?? '').slice(0, 120), system: g.entry.system && typeof g.entry.system === 'object' ? g.entry.system : {} };
  // v0.81.0 (SEC1-5): a member's offer (the author owns the member who spoke) or a GM's card; the GM confirms it.
  const speaker = speakerActorUuid(message);
  // v0.81.1 (D3): every member learns it, so the confirm shows its numbers (Force, drain and the rest), not only its name.
  const nums = Object.entries(entry.system).filter(([, v]) => typeof v === 'number' || typeof v === 'string' && v.length < 40).slice(0, 10).map(([k, v]) => `${k} ${String(v)}`);
  if (!(await gmMay(message, { title: tx('SR2E.Dialog.Chat.addToAGrimoire'), lines: [tx('SR2E.Dialog.Chat.goesIntoSGrimoireEveryMember', { entryName: entry.name, groupName: group.name }), ...(nums.length ? [tx('SR2E.App.Chat.itsData', { data: nums.join(', ') })] : [])], sources: [speaker], always: true }))) return;
  if (!authorIsGm(message) && !(group.members ?? []).includes(speaker)) return ui.notifications.warn(tx('SR2E.Notify.Chat.whoeverOfferedItIsNotIn'));
  // v0.81.1 (A2): the change is made under the GM lock, after any dialog.
  await gmLocked(message, button, async () => {
    button.disabled = true;
    if (await cls.addGrimoireEntry(g.groupId, entry)) { try { await message.setFlag(SYSTEM_ID, 'grimoireAdded', true); } catch { /* not saved */ } }
    else button.disabled = false;
  });
}

/** Learn a designed spell from its formula card. */
async function onLearnFormula(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'formula') as { actorUuid: string; name: string; system: any } | undefined;
  const a: any = f ? await fromUuid(f.actorUuid) : null;
  if (!f || !a) return;
  if (!a.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm25', { name: escHtml(a.name) }));
  if (!(await playerMay(message, a))) return;
  button.disabled = true;
  if (!(await asCardAuthor(message, tx('SR2E.Card.Chat.learnIt'), () => a.learnFormula(f.name, f.system, 'their own design', { origin: 'design' })))) button.disabled = false;
}

/**
 * v0.91.8: the learning test with a teacher's help (a teacher's card, `snap.teach`): the student's owner rolls it,
 * once per card. The help is read from the card's own test (its successes, capped by the teacher's Sorcery).
 */
async function onLearnTaught(message: any, button: HTMLButtonElement): Promise<void> {
  const t = (message.getFlag(SYSTEM_ID, 'test') as TestSnapshot | undefined)?.teach;
  const a: any = t ? await fromUuid(t.studentUuid) : null;
  if (!t || !a) return;
  if (!a.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm25', { name: escHtml(a.name) }));
  if (message.getFlag(SYSTEM_ID, 'taught')) return ui.notifications.warn(tx('SR2E.Notify.Formula.alreadyTaught'));
  if (!(await playerMay(message, a))) return;
  button.disabled = true;
  // Review (B1): spent once the learning test was rolled or the request filed, whatever its result (the student's
  // learning card has its own Karma re-roll); a study refused before that leaves the card usable.
  const r = await asCardAuthor(message, tx('SR2E.Card.Formula.learnIt'), () => a.learnTaught(message.id));
  if (r === 'used') { try { await message.setFlag(SYSTEM_ID, 'taught', true); } catch { /* not saved */ } }
  else button.disabled = false;
}

/** Offer a designed spell to a group's grimoire. */
async function onFormulaGrimoire(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'formula') as { actorUuid: string; name: string; system: any } | undefined;
  const a: any = f ? await fromUuid(f.actorUuid) : null;
  if (!f || !a) return;
  if (!a.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm26', { name: escHtml(a.name) }));
  if (!(await playerMay(message, a))) return;
  button.disabled = true;
  // v0.81.1 (SEC1-1, design 1): a GM's click offers it as the player (their offer card, then the GM's confirm).
  await asCardAuthor(message, tx('SR2E.Card.Chat.offerToAGrimoire'), () => a.addToGrimoire(String(button.dataset['group'] ?? '').slice(0, 100), { name: f.name, system: f.system }));
}

/** A ritual's target tries to notice it. */
async function onNoticeRitual(message: any, button: HTMLButtonElement): Promise<void> {
  const n = message.getFlag(SYSTEM_ID, 'ritualNotice') as { targetUuid: string; tn: number; spellName: string; force: number; casterName: string } | undefined;
  const t: any = n ? await fromUuid(n.targetUuid) : null;
  if (!n || !t) return;
  if (!t.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm9', { tName: escHtml(t.name) }));
  // v0.81.1 (A-7): no confirm: it is only a perception roll for the clicker's own character, and it can only help them.
  if (message.getFlag(SYSTEM_ID, 'noticeRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyRolled'));
  button.disabled = true;
  await t.noticeRitual(safeInt(n.tn, 2, 30, 4), { spellName: String(n.spellName ?? '').slice(0, 120), force: safeInt(n.force, 0, 30, 0), casterName: String(n.casterName ?? '').slice(0, 120) });
  if (message.isOwner) await message.setFlag(SYSTEM_ID, 'noticeRolled', true);
}

/** GM: start a fire a player's card asked for. */
async function onStartFire(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmStartsFires'));
  const f = message.getFlag(SYSTEM_ID, 'startFire') as { x: number; y: number; source: string; sceneId: string } | undefined;
  if (!f || !Number.isFinite(Number(f.x)) || !Number.isFinite(Number(f.y))) return;
  if (message.getFlag(SYSTEM_ID, 'fireStarted')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyStarted'));
  const scene: any = game.scenes?.get?.(String(f.sceneId ?? ''));
  if (!scene) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatSceneIsGone'));
  const source = String(f.source ?? 'a fire').slice(0, 200);
  // v0.81.0 (SEC1-5): the GM confirms a fire a player's card asks for.
  if (!(await gmMay(message, { title: tx('SR2E.Dialog.Chat.startAFire'), lines: [tx('SR2E.Dialog.Chat.aFireStartsOnAt', { sceneName: scene.name, x: Math.round(Number(f.x)), y: Math.round(Number(f.y)), source })], sources: realSources(message), always: true }))) return;
  await gmLocked(message, button, async () => {
    // v0.85.0: under the GM lock, checked again (a second click while the dialog was open).
    if (message.getFlag(SYSTEM_ID, 'fireStarted')) return;
    button.disabled = true;
    const cls: any = CONFIG.Actor.documentClass;
    await cls.startFire({ x: Number(f.x), y: Number(f.y) }, { source, sceneId: scene.id });
    await message.setFlag(SYSTEM_ID, 'fireStarted', true);
  });
}

/** Someone caught in a spreading fire resists it. */
async function onFireBurn(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'fireBurn') as { intensity: string; uuids: string[] } | undefined;
  const i = safeInt(button.dataset['index'], 0, 99, 0);
  const u = listFlag<string>(f?.uuids)[i];
  const a: any = safeStr(u, 400) ? await fromUuid(u) : null;
  if (!f || !a) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterIsGone'));
  if (!a.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm20', { name: escHtml(a.name) }));
  // v0.81.1 (design 2): a spreading fire is not routine (the GM's timer posts these; another author's card asks).
  if (!(await playerMay(message, a, origin(message), tx('SR2E.Card.Chat.resistsAFire', { name: a.name, slice: String(f.intensity ?? '').slice(0, 40) })))) return;
  const done = (message.getFlag(SYSTEM_ID, 'fireBurned') as number[] | undefined) ?? [];
  const key = `${message.id}:fire:${i}`;
  if (done.includes(i) || cardRolled(a, key)) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyRolled'));
  button.disabled = true;
  await markCardRolled(a, key);
  await a.resistHazard('fire', f.intensity);
  if (message.isOwner) await message.setFlag(SYSTEM_ID, 'fireBurned', [...done, i]);
}

/**
 * v0.48.0: "already rolled" markers kept on the actor who rolled (a player can't write flags on the
 * GM's card), keyed by message id and button; the last 50.
 */
function cardRolled(actor: any, key: string): boolean {
  return ((actor.getFlag?.(SYSTEM_ID, 'cardRolls') as string[] | undefined) ?? []).includes(key);
}
async function markCardRolled(actor: any, key: string): Promise<void> {
  const list = ((actor.getFlag?.(SYSTEM_ID, 'cardRolls') as string[] | undefined) ?? []).filter((k) => k !== key);
  try { await actor.setFlag(SYSTEM_ID, 'cardRolls', [...list, key].slice(-50)); } catch { /* not saved */ }
}

/** v0.48.0: someone in a fire's smoke resists breathing it. */
async function onSmokeInhale(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'smokeInhale') as { power: number; level: any; type: any; source: string; uuids: string[] } | undefined;
  const i = safeInt(button.dataset['index'], 0, 99, 0);
  const u = listFlag<string>(f?.uuids)[i];
  const a: any = safeStr(u, 400) ? await fromUuid(u) : null;
  if (!f || !a) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterIsGone'));
  if (!a.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm20', { name: escHtml(a.name) }));
  if (!(await playerMay(message, a, origin(message), tx('SR2E.Card.Chat.resistsSmokePower', { name: a.name, boundPower: boundPower(f.power), boundLevel: boundLevel(f.level) })))) return;
  const done = (message.getFlag(SYSTEM_ID, 'smokeInhaled') as number[] | undefined) ?? [];
  const key = `${message.id}:smoke:${i}`;
  if (done.includes(i) || cardRolled(a, key)) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyRolled'));
  button.disabled = true;
  await markCardRolled(a, key);
  await a.resistSmoke({ power: boundPower(f.power), level: boundLevel(f.level), type: boundType(f.type), source: String(f.source ?? '').slice(0, 120) });
  if (message.isOwner) await message.setFlag(SYSTEM_ID, 'smokeInhaled', [...done, i]);
}

/** v0.48.0: a carrier passes a contagious disease on from its progress card. */
async function onSpreadDisease(message: any, _button: HTMLButtonElement): Promise<void> {
  const d = message.getFlag(SYSTEM_ID, 'diseaseTick') as { actorUuid: string; index: number; name: string } | undefined;
  const actor: any = d ? await fromUuid(d.actorUuid) : null;
  if (!d || !actor) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterNoLongerExists'));
  if (!actor.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm27', { actorName: escHtml(actor.name) }));
  if (!(await playerMay(message, actor, origin(message), tx('SR2E.Card.Chat.passesOn', { actorName: actor.name, name: String(d.name ?? tx('SR2E.Card.Chat.aDisease')) })))) return;
  const list: any[] = actor.system.diseases ?? [];
  const index = list[d.index]?.name === d.name ? d.index : list.findIndex((x: any) => x.name === d.name);
  if (index < 0) return ui.notifications.warn(tx('SR2E.Notify.Chat.noLongerHas', { actorName: escHtml(actor.name), name: escHtml(d.name) }));
  await actor.spreadDisease(index);
}

/** v0.48.0: a bitten target resists the bite's disease (once per card). */
async function onInfection(message: any, button: HTMLButtonElement): Promise<void> {
  const f = message.getFlag(SYSTEM_ID, 'infection') as { targetUuid: string; toxin: any } | undefined;
  const a: any = f ? await fromUuid(f.targetUuid) : null;
  if (!f || !a || !f.toxin || typeof f.toxin !== 'object') return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterIsGone'));
  if (!a.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm20', { name: escHtml(a.name) }));
  // R2-SEC-8: the disease's Power and level bounded; v0.81.1 (D2-2): its recoveries, interval and spread too.
  const tox: any = boundToxin(f.toxin);
  if (!(await playerMay(message, a, origin(message), tx('SR2E.Card.Chat.resistsPower2', { name: a.name, slice: String(tox.name ?? 'a disease').slice(0, 120), toxPower: tox.power ?? '?', toxLevel: tox.level ?? '' })))) return;
  // v0.70.0: once per test (a re-rolled soak doesn't bring it back); old cards marked `<id>:infection` still count.
  if (cardDone(message, a, 'infectionRolled') || sameTestCards(message).some((m: any) => cardRolled(a, `${m.id}:infection`))) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyRolled'));
  button.disabled = true;
  await markCardDone(message, a, 'infectionRolled');
  await a.resistToxin({ ...tox, kind: 'disease' });
}

/** v0.48.0 (GM): a deed is done: the initiation goes ahead. */
async function onConfirmDeed(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlyTheGmConfirmsADeed'));
  const d = message.getFlag(SYSTEM_ID, 'deed') as { actorUuid: string; grade: number } | undefined;
  const a: any = d ? await fromUuid(d.actorUuid) : null;
  if (!d || !a) return ui.notifications.warn(tx('SR2E.Notify.Chat.thatCharacterIsGone'));
  if (message.getFlag(SYSTEM_ID, 'deedDone')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyConfirmed'));
  const p = a.getFlag?.(SYSTEM_ID, 'pendingInitiation');
  if (!p || p.grade !== nextInitiationGrade(Number(a.system.initiateGrade ?? 0), Boolean(a.getFlag?.('sr2e', 'initiated')))) return ui.notifications.warn(tx('SR2E.Notify.Chat.hasNoInitiationWaitingOnThis', { name: escHtml(a.name) }));
  // v0.81.0 (SEC1-17): only the initiate's own card (or a GM's), and the GM says yes in a dialog naming it.
  if (!(await gmMay(message, { title: tx('SR2E.Dialog.Chat.confirmADeed'), lines: [tx('SR2E.Dialog.Chat.sDeedIsDoneInitiationTo', { name: a.name, grade: p.grade })], sources: [a.uuid], always: true }))) return;
  await gmLocked(message, button, async () => {
    // v0.85.0: under the GM lock, checked again (a second click while the dialog was open).
    if (message.getFlag(SYSTEM_ID, 'deedDone')) return;
    button.disabled = true;
    const ok = await a.advanceInitiation(p.technique ?? null, { ordeal: p.ordeal, groupId: p.groupId, attribute: p.attribute, geas: p.geas, deedDone: true });
    if (ok) await message.setFlag(SYSTEM_ID, 'deedDone', true);
    else button.disabled = false;
  });
}

/** A bioware rejection test from a surgery or a due card. */
async function onRejectionTest(message: any, button: HTMLButtonElement): Promise<void> {
  const r = message.getFlag(SYSTEM_ID, 'rejection') as { actorUuid: string } | undefined;
  const a: any = r ? await fromUuid(r.actorUuid) : null;
  if (!r || !a) return;
  if (!a.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Chat.onlySOwnerOrTheGm20', { name: escHtml(a.name) }));
  if (!(await playerMay(message, a, origin(message), tx('SR2E.Card.Chat.rollsABiowareRejectionTest', { name: a.name })))) return;
  if (cardDone(message, a, 'rejectionRolled')) return ui.notifications.warn(tx('SR2E.Notify.Chat.alreadyRolled'));
  button.disabled = true;
  await a.rejectionTest();
  await markCardDone(message, a, 'rejectionRolled');
}

/**
 * v0.50.0 (GM): change a rolled test's TN afterwards. A checklist of the modifiers it used (ticked),
 * the scene's modifiers on the roller now and the other modifiers that kind of test can take (unticked),
 * a base TN and a GM adjustment; OK scores the same dice again (SR2Actor.retarget).
 */
export async function openRetarget(message: any): Promise<void> {
  if (!game.user?.isGM) return;
  const snap = message?.getFlag?.(SYSTEM_ID, 'test') as TestSnapshot | undefined;
  const contest = message?.getFlag?.(SYSTEM_ID, 'contest') as Contest | undefined;
  type Side = { name: string; base: number; applied: TargetNumberModifier[]; tn: number; kind: string; actor: any; reveal?: string };
  const sides: Side[] = [];
  if (snap) {
    sides.push({ name: fromUuidSync(snap.actorUuid)?.name ?? tx('SR2E.App.Chat.theRoll'), base: snap.baseTargetNumber, applied: [...snap.modifiers], tn: snap.targetNumber, kind: snap.kind, actor: fromUuidSync(snap.actorUuid), reveal: (snap as any).reveal?.kind });
  } else if (contest) {
    for (const x of contest.sides) {
      if (!x.result) continue;
      const actor: any = x.uuid ? fromUuidSync(x.uuid) : null;
      sides.push({ name: x.name, base: x.result.baseTargetNumber, applied: [...x.result.modifiers], tn: x.result.targetNumber, kind: contest.kind, actor });
    }
  }
  if (!sides.length) { ui.notifications.warn(tx('SR2E.Notify.Chat.thatCardHasNoRollWhose')); return; }
  const esc = escHtml;
  const val = (v: number) => `${v >= 0 ? '+' : ''}${v}`;
  // Every row of every side, indexed, so the form only carries indices.
  const rows: Array<{ side: number; label: string; value: number }> = [];
  const box = (side: number, m: TargetNumberModifier, on: boolean) => {
    rows.push({ side, ...(m.id ? { id: m.id } : {}), label: m.label, value: m.value });
    return `<label class="sr2e-check"><input type="checkbox" name="row" value="${rows.length - 1}" ${on ? 'checked' : ''}> ${esc(m.label)} (${val(m.value)})</label>`;
  };
  const sideHtml = sides.map((sd, i) => {
    // v0.89.4: by id as well as label (the card may be in the roller's language, the candidates in the GM's)
    // v0.89.5: by key (`modKey`: `#id`, else the label); a card saved before the rows had ids still matches by label.
    const have = new Set(sd.applied.flatMap((m) => [modKey(m), m.label, ...(m.id ? [m.id] : [])]));
    const known = (m: TargetNumberModifier) => have.has(modKey(m)) || have.has(m.label);
    const scene = (sd.actor?.sceneCandidates?.() ?? []).filter((m: TargetNumberModifier) => m.value && !known(m));
    scene.forEach((m: TargetNumberModifier) => { have.add(modKey(m)); have.add(m.label); if (m.id) have.add(m.id); });
    // v0.73.0 (O40): Notice/Listen as Perception, hearing, superior position and prejudice rows (RULES.CROSSCUT_V73.retarget).
    const groups = retargetGroupsV73(sd.kind, { reveal: sd.reveal, applied: [...have] } as any).map((g) => ({ group: g.group, rows: g.rows.filter((m) => !known(m)) })).filter((g) => g.rows.length);
    return `<div class="sr2e-retarget-side" data-side="${i}" ${i ? 'hidden' : ''}>
      <div class="form-group"><label>${tx('SR2E.Dialog.Chat.baseTn')}</label><input name="base-${i}" type="number" value="${sd.base}" min="0"></div>
      <fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Chat.appliedTn', { sdTn: sd.tn })}</legend>${sd.applied.length ? sd.applied.map((m) => box(i, m, true)).join('') : `<p class="hint">${tx('SR2E.Dialog.Chat.none')}</p>`}</fieldset>
      ${scene.length ? `<fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Chat.theSceneNow')}</legend>${scene.map((m: TargetNumberModifier) => box(i, m, false)).join('')}</fieldset>` : ''}
      ${groups.map((g) => `<details class="sr2e-more"><summary>${esc(g.group)}</summary><fieldset class="sr2e-situational">${g.rows.map((m) => box(i, m, false)).join('')}</fieldset></details>`).join('')}
    </div>`;
  }).join('');
  const sidePick = sides.length > 1 ? `<div class="form-group"><label>${tx('SR2E.Dialog.Chat.changeWhoseTn')}</label><select name="side">${sides.map((sd, i) => `<option value="${i}">${tx('SR2E.Dialog.Chat.tn', { sdName: esc(sd.name), sdTn: sd.tn })}</option>`).join('')}</select></div>` : '';
  const read = (form: any) => {
    const side = Number(form.elements.side?.value ?? 0) || 0;
    const picked = [...form.querySelectorAll('input[name="row"]:checked')].map((i: any) => rows[Number(i.value)]).filter((r): r is { side: number; label: string; value: number; id?: string } => Boolean(r) && r!.side === side);
    const adj = Number(form.elements.adjust?.value) || 0;
    const modifiers = [...picked.map((r) => ({ ...(r.id ? { id: r.id } : {}), label: r.label, value: r.value })), ...(adj ? [{ id: 'gmAdjustment', label: tx('SR2E.Card.Mod.gmAdjustment'), value: adj }] : [])];
    const raw = String(form.elements[`base-${side}`]?.value ?? '').trim();
    const base = raw === '' ? NaN : Number(raw);
    return { side, baseTargetNumber: Number.isFinite(base) ? base : sides[side]!.base, modifiers };
  };
  const preview = (form: any) => {
    const c = read(form);
    const tn = Math.max(RULES.MIN_TARGET_NUMBER, c.baseTargetNumber + c.modifiers.reduce((n, m) => n + m.value, 0));
    const res: any = snap ? { dice: snap.dice, botch: snap.botch } : contest!.sides.filter((x) => x.result)[c.side]?.result ?? { dice: [], botch: false };
    const hits: number = res.botch ? 0 : (res.dice ?? []).filter((d: any) => d.total >= tn).length + (snap?.bought ?? 0);
    return `<strong class="sr2e-tn">${tx('SR2E.Dialog.Chat.newTn', { tn })}</strong> ${tx('SR2E.Dialog.Chat.wasSuccessFromTheSameDice', { tn: sides[c.side]!.tn, hits: tCount(hits, 'SR2E.Count.success'), part: res.botch ? tx('SR2E.Dialog.Chat.stillADisaster') : '' })}`;
  };
  const choice = await foundry.applications.api.DialogV2.prompt({
    // D1-1: the test's kind in the title, and who posted a player's card (it is scored again as theirs).
    window: { title: tx('SR2E.Dialog.Chat.changeTargetNumber', { slice: String(snap?.label ?? contest?.kind ?? 'roll').slice(0, 80), part: snap?.kind ? ` (${String(snap.kind).slice(0, 30)})` : '' }) },
    position: { width: 460 },
    content: `${posterNote(message)}${sidePick}${sideHtml}
      <div class="form-group"><label>${tx('SR2E.Dialog.Chat.gmAdjustment')}</label><input name="adjust" type="number" value="0"></div>
      <div class="sr2e-preview" aria-live="polite"></div>
      <p class="hint">${tx('SR2E.Dialog.Chat.noDiceAreRolledTheDice')}</p>`,
    ok: { label: tx('SR2E.Dialog.Chat.change'), callback: (_e: Event, b: any) => read(b.form) },
    render: (_e: Event, dialog: any) => {
      const form: any = dialog?.element?.querySelector('form');
      if (!form) return;
      const out = form.querySelector('.sr2e-preview');
      const refresh = () => {
        const side = String(form.elements.side?.value ?? 0);
        form.querySelectorAll('.sr2e-retarget-side').forEach((el: HTMLElement) => { el.hidden = el.dataset['side'] !== side; });
        if (out) out.innerHTML = preview(form);
      };
      form.addEventListener('change', refresh);
      form.addEventListener('input', refresh);
      refresh();
    },
    rejectClose: false,
  } as any) as { side: number; baseTargetNumber: number; modifiers: TargetNumberModifier[] } | null;
  if (!choice) return;
  // A contest's side index counts only the sides that rolled.
  const rolled = contest ? contest.sides.map((x, k) => (x.result ? k : -1)).filter((k) => k >= 0) : [0];
  const sideIndex = rolled[choice.side] ?? 0;
  // v0.81.1 (SEC1-1 critical, D1-1, design 1): a player's card is scored again as that player: what they don't own gets
  // an Apply (GM) card, as their own Karma re-roll would post, never a direct write with the GM's rights.
  await asCardAuthor(message, tx('SR2E.Card.Chat.changeTargetNumber'), () => (SR2Actor as any).retarget(message, { baseTargetNumber: Number.isFinite(choice.baseTargetNumber) ? Math.max(0, Math.min(99, Math.trunc(choice.baseTargetNumber))) : 4, modifiers: choice.modifiers, side: sideIndex }));
}

/** v0.50.0: "Change target number…" on a roll's right-click menu (GM only). */
function registerRetargetMenu(): void {
  const icon = '<i class="fa-solid fa-bullseye"></i>';
  const open = (li: any) => { const m = messageOf(li); if (m) void openRetarget(m); };
  // v14 menu entries take label/visible/onClick (the old name/condition/callback still work through
  // a shim); v13 and older take name/condition/callback. One shape only, so it can't open twice.
  const gen = Number((game as any).release?.generation ?? 13);
  // v0.89.5: the label in the user's language (built when the menu opens, when the languages are loaded); our entry is
  // found again by its own mark, not by its text.
  const add = (_app: any, options: any[]) => {
    if (!Array.isArray(options) || options.some((o: any) => o?.sr2eRetarget)) return;
    const label = tx('SR2E.Card.Chat.changeTargetNumberMenu');
    options.push(gen >= 14
      ? { sr2eRetarget: true, label, icon, visible: (li: any) => canRetarget(li), onClick: (_e: any, li: any) => open(li) }
      : { sr2eRetarget: true, name: label, icon, condition: (li: any) => canRetarget(li), callback: (li: any) => open(li) });
  };
  Hooks.on(gen >= 13 ? 'getChatMessageContextOptions' : 'getChatLogEntryContext', add);
}
function messageOf(li: any): any {
  const el: HTMLElement | null = li?.dataset ? li : li?.[0] ?? null;
  const id = el?.dataset?.['messageId'] ?? el?.closest?.('[data-message-id]')?.getAttribute('data-message-id');
  return id ? (game as any).messages?.get(id) : null;
}
function canRetarget(li: any): boolean {
  if (!game.user?.isGM) return false;
  const m = messageOf(li);
  if (!m || (SR2Actor as any).isReplaced(m)) return false;
  return Boolean(m.getFlag(SYSTEM_ID, 'test') || m.getFlag(SYSTEM_ID, 'contest'));
}

export function registerChatHandlers(): void {
  registerRetargetMenu();
  // Timed charges going off by themselves use the same blast code (v0.43.0).
  SR2Actor.detonator = detonateAt;
  registerWallConfig();
  registerCombatTracker();
  registerActorDirectory();
  registerDelayButtons();
  registerKarmaRefresh();
  // Security responses that come due as world time passes (outside combat).
  // v0.59.0: queued one after another (and after a new Combat Turn's own timers), never interleaved.
  // v0.61.0: a fight starts: shamans of a totem that rages in combat (MAGIC_V61.totems 'combat') test against berserking.
  // The hook runs only on the client that started the fight (a GM's, an assistant's, or the GM panel's).
  Hooks.on('combatStart', (combat: any) => {
    if (!game.user?.isGM) return;
    // v0.70.0: everyone starts the fight with fresh pools (RULES.FIXES_V70.poolsAtCombatStart); before, the first
    // Combat Turn ran on dice spent earlier.
    if (RULES.FIXES_V70.poolsAtCombatStart) {
      const seen = new Set<string>();
      for (const c of [...(combat?.combatants ?? [])] as any[]) {
        const a: any = c.actor;
        if (!a?.refreshPools || seen.has(a.uuid)) continue;
        seen.add(a.uuid);
        void a.refreshPools();
      }
    }
    for (const c of [...(combat?.combatants ?? [])] as any[]) {
      const a: any = c.actor;
      if (a?.totemDrawbacks?.().berserk === 'combat') void a.berserkCheck?.(tx('SR2E.Card.Chat.combatBegins'));
    }
  });
  Hooks.on('updateWorldTime', (worldTimeIn: number, dt: number, options: any) => {
    const cls: any = CONFIG.Actor.documentClass;
    void serialTicks(async () => {
      // v0.92.2 (RULES.CLOCK_V922): a big jump is settled first (the GM may say it only changes the date), and the
      // ticks run on the system's clock.
      await settleClock(worldTimeIn, dt, options);
      const worldTime = toSysTime(worldTimeIn);
      await cls.securityResponses?.({ worldTime });
      // Matrix traces that complete as world time passes (outside combat).
      await cls.matrixTraces?.({ worldTime });
      // Drugs wearing off and timed statuses (v0.31.0).
      await cls.timedEffects?.({ worldTime });
      // Elementals' sustaining limit, Essence loss, regeneration (v0.39.0).
      await cls.magicTicks?.({ worldTime });
    });
  });
  // v0.81.0 (SEC1-18): each step runs on its own, per message: a card with flags of an odd shape (anyone can post
  // one) can't stop the rest, or another card, from working.
  const quietly = (what: string, fn: () => unknown) => {
    try {
      const r: any = fn();
      if (r && typeof r.catch === 'function') r.catch((err: unknown) => console.warn(`sr2e | ${what}`, err));
    } catch (err) { console.warn(`sr2e | ${what}`, err); }
  };
  Hooks.on('createChatMessage', (message: any) => {
    // v0.49.0: a turret a player fired turns on the active GM's client.
    // v0.81.0 (SEC1-5): the facing as a number of degrees, from a card whose author may fire it (authorMayTurnTurret).
    quietly('turret', () => {
      const tf = message.getFlag?.(SYSTEM_ID, 'turretFacing') as { weaponUuid: string; facing: number; firerUuid?: string } | undefined;
      if (!tf || !isLeadGm() || !safeStr(tf.weaponUuid, 400) || !Number.isFinite(Number(tf.facing))) return;
      if (!authorMayTurnTurret(message, tf.weaponUuid, tf.firerUuid)) return;
      return (async () => { const w: any = await fromUuid(tf.weaponUuid); await w?.update?.({ 'system.turret.facing': ((Number(tf.facing) % 360) + 360) % 360 }); })();
    });
    // Let the card render first so its buttons can be disabled once used.
    setTimeout(() => quietly('prompt', () => promptForCard(message)), 300);
    // v0.70.0: a re-roll's card switches the older cards of that test off.
    setTimeout(() => quietly('replaced cards', () => deadenOlderCards(message)), 50);
    // v0.59.0: the active GM's client applies a player's Apply (GM) card by itself.
    quietly('auto-apply', () => autoApplyGmCard(message));
    // v0.60.0: and rolls NPCs' resistance by itself (setting autoResistNpc), once the card has rendered.
    setTimeout(() => quietly('auto-resist', () => autoResistCard(message)), 200);
  });
  Hooks.on('renderChatMessageHTML', (message: any, html: HTMLElement) => {
    // v0.81.0: a player's card loses the inline styles that place or hide things (Foundry's cleaner keeps them, so a
    // forged card could lay an invisible full-screen button or link over the screen); a GM's card is untouched.
    quietly('styles', () => stripCardStyles(html, message));
    quietly('decorate', () => decorateCard(message, html));
    quietly('item drag', () => decorateItemDrags(message, html));
    html.querySelectorAll<HTMLButtonElement>('button[data-sr2e-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const action = button.dataset['sr2eAction'];
        if (!action) return;
        if (action in GM_APPLY_ACTIONS && applying.has(message.id)) { ui.notifications.info(tx('SR2E.Notify.Chat.thisIsBeingAppliedByItself')); return; }
        // v0.81.0: GM tools (Undo, ±box, Apply unresisted, Resist all, Barriers) only from the buttons decorateCard made.
        if (GM_TOOL_ACTIONS.has(action) && !builtTools.has(button)) return;
        // v0.70.0: buttons on a card replaced by a newer one of the same test do nothing (even if the DOM missed it).
        const replaced = cardReplaced(message);
        if (replaced) { button.disabled = true; ui.notifications.warn(replacedText(replaced)); return; }
        // v0.81.0 (A-6): one run per card, action and index at a time, whichever copy (chat log or pop-up) was clicked.
        void guarded(message, action, button, () => dispatch(message, button, action));
      });
    });
  });
}

/** v0.81.0 (A-6): card actions running now (`<message id>:<action>:<index>:<side>`). */
const inFlight = new Set<string>();

/**
 * v0.81.0 (A-6): run a card action once per card, action, index and side at a time; a second run meanwhile (the
 * card's other copy, or v0.81.1 (A-5) the Defend / Resist prompt) does nothing. Errors are logged.
 */
async function guarded(message: any, action: string, button: any, fn: () => unknown): Promise<void> {
  const key = `${message?.id}:${action}:${safeInt(button?.dataset?.['index'], 0, 99, 0)}:${safeInt(button?.dataset?.['side'], 0, 9, 0)}`;
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try { await fn(); } catch (err) { console.warn(`sr2e | ${action}`, err); } finally { inFlight.delete(key); }
}

/** v0.81.1 round 2 (FIX2-BRIEF C): the inline style declarations a player's chat message keeps (text and box looks). */
const PLAYER_STYLE = /^(?:color|background|background-color|font-weight|font-style|font-family|font-size|line-height|text-decoration(?:-[a-z]+)*|text-align|text-transform|border(?:-[a-z]+)*|padding(?:-[a-z]+)?|list-style(?:-[a-z]+)*|vertical-align|white-space)$/;

/** Round 3 (FIX3-BRIEF 11): a font size a player may use: at most 2em, 2rem, 32px, 24pt or 200% (or a keyword). */
function smallFontSize(v: string): boolean {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(em|rem|px|pt|%)\s*$/.exec(v);
  if (!m) return /^\s*(?:xx-small|x-small|small|medium|large|x-large|smaller|larger|inherit)\s*$/.test(v);
  const n = Number(m[1]), max: Record<string, number> = { em: 2, rem: 2, px: 32, pt: 24, '%': 200 };
  return n <= (max[m[2]!] ?? 0);
}

/**
 * Pure (round 2, C): a `style` attribute cut down to PLAYER_STYLE declarations, with no `url(`, `expression(`, script
 * URL, `@import` or escape in a value. Everything that places or hides things (position, inset, z-index, transform,
 * opacity, display, visibility, size, margin, pointer-events, filter) goes. '' when nothing is left.
 */
export function playerStyle(style: unknown): string {
  return String(style ?? '').split(';').map((d) => d.trim()).filter((d) => {
    const i = d.indexOf(':');
    if (i <= 0) return false;
    const prop = d.slice(0, i).trim().toLowerCase();
    const val = d.slice(i + 1).toLowerCase();
    if (!PLAYER_STYLE.test(prop) || prop.startsWith('border-image')) return false;
    if (/url\s*\(|image-set\s*\(|gradient\s*\(|image\s*\(|element\s*\(|expression\s*\(|javascript:|@import|\\|\/\*/.test(val)) return false;
    return prop !== 'font-size' || smallFontSize(val);
  }).join('; ');
}

/**
 * Inline styles on chat cards, so a forged card can't cover the screen. v0.81.1 round 2 (FIX2-BRIEF C, V-SEC 5,
 * V-REST 2): a GM's message (the system's, other modules', a GM's handout) is left as it is. In a player's message
 * each `style` keeps only text and box looks (`playerStyle`), and a system button loses its style entirely. Exported
 * for the tests.
 */
export function stripCardStyles(html: HTMLElement, message?: any): void {
  if (!html?.querySelectorAll) return;
  if (message && authorIsGm(message)) return;
  const content: any = html.querySelector?.('.message-content') ?? null;
  const scope: any = content ?? html;
  for (const el of [...(content ? [content] : []), ...(Array.from(scope.querySelectorAll('[style]')) as HTMLElement[])]) {
    const raw = el.getAttribute?.('style');
    if (raw === null || raw === undefined) continue;
    const kept = playerStyle(raw);
    if (kept) el.setAttribute?.('style', kept); else el.removeAttribute?.('style');
  }
  for (const el of Array.from(html.querySelectorAll('[data-sr2e-action]')) as HTMLElement[]) el.removeAttribute?.('style');
}

/** Run a card button's action (the click handler above guards it first). */
function dispatch(message: any, button: HTMLButtonElement, action: string): Promise<unknown> | void {
  if (action === 'defend') return onDefend(message, button);
  else if (action === 'resist') return onResist(message, button);
  else if (action === 'toxinHit') return onToxinHit(message, button);
  else if (action === 'putOutFire') return onPutOutFire(message, button);
  else if (action === 'applyHold') return onApplyHold(message, button);
  else if (action === 'takeCover') return onTakeCover(message, button);
  else if (action === 'combineBlast') return onCombineBlast(message, button);
  else if (action === 'resistSpell') return onResistSpell(message, button);
  else if (action === 'createSpirit') return onCreateSpirit(message, button);
  else if (action === 'repeatPower') return onRepeatPower(message);
  else if (action === 'magicLoss') return onMagicLoss(message, button);
  else if (action === 'permanentDamage923') return onPermanentDamage923(message, button);
  else if (action === 'dumpShock') return onDumpShock(message, button);
  else if (action === 'applyTally') return onApplyTally(message, button);
  else if (action === 'knockdown') return onKnockdown(message, button);
  else if (action === 'blastScatter') return onBlastScatter(message, button);
  else if (action === 'spellWall') return onSpellWall(message, button);
  else if (action === 'vehicleCrash') return onVehicleCrash(message, button);
  else if (action === 'vehicleCrashTest') return onVehicleCrashTest(message, button);
  else if (action === 'riggerShock') return onRiggerShock(message, button);
  else if (action === 'whipCheck') return onWhipCheck(message, button);
  else if (action === 'ramSelf') return onRamSelf(message, button);
  else if (action === 'applySite') return onApplySite(message, button);
  else if (action === 'applyJam') return onApplyJam(message, button);
  else if (action === 'applyDroneLink') return onApplyDroneLink(message, button);
  else if (action === 'applyLocks') return onApplyLocks(message, button);
  else if (action === 'applyHost') return onApplyHost(message, button);
  else if (action === 'deckDamage') return onDeckDamage(message, button);
  else if (action === 'biofeedback') return onBiofeedback(message, button);
  else if (action === 'psychotropic') return onPsychotropic(message, button);
  else if (action === 'diseaseTick') return onDiseaseTick(message, button);
  else if (action === 'overload') return onOverload(message, button);
  else if (action === 'adrenalCrash') return onAdrenalCrash(message, button);
  else if (action === 'resistToxin') return onResistToxin(message, button);
  else if (action === 'reexposeToxin923') return onReexposeToxin923(message);
  else if (action === 'morale') return onMorale(message, button);
  else if (action === 'buyItem') return onBuyItem(message, button);
  else if (action === 'haggle') return onHaggle(message, button);
  else if (action === 'sellItem') return onSellItem(message, button);
  else if (action === 'evict') return onEvict(message, button);
  else if (action === 'drugCrash') return onDrugCrash(message, button);
  else if (action === 'karmaReroll' || action === 'avoidDisaster') return onKarma(message, button, action);
  else if (action === 'buySuccess') return onBuySuccess(message, button);
  else if (action === 'contestKarma') return onContestKarma(message, button);
  else if (action === 'throwBack') return onThrowBack(message, button);
  else if (action === 'letItBlow') return onLetItBlow(message, button);
  else if (action === 'detonateCharge') return onDetonateCharge(message, button);
  else if (action === 'cyberDamage') return onCyberDamage(message, button);
  else if (action === 'catchFire') return onCatchFire(message, button);
  else if (action === 'elementEffect') return onElementEffect(message, button);
  else if (action === 'sendRitual') return onSendRitual(message, button);
  else if (action === 'barrierDamage') return onBarrierDamage(message, button);
  else if (action === 'jamWeapon') return onJamWeapon(message, button);
  else if (action === 'gmUndo') return onGmUndo(message, button);
  else if (action === 'gmBox') return onGmBox(message, button);
  else if (action === 'gmApply') return onGmApply(message, button);
  else if (action === 'resistAll') return onResistAll(message, button);
  else if (action === 'applyCleanse') return onApplyCleanse(message, button);
  else if (action === 'applyPossession') return onApplyPossession(message, button);
  else if (action === 'applyPowerEffect') return onApplyPowerEffect(message, button);
  else if (action === 'applyActorUpdate') return onApplyActorUpdate(message, button);
  else if (action === 'applySurgery') return onApplySurgery(message, button);
  else if (action === 'applyHeal') return onApplyHeal(message, button);
  else if (action === 'applyPatch') return onApplyPatch(message, button);
  else if (action === 'applyVehicleJob') return onApplyVehicleJob(message, button);
  else if (action === 'applyTimedStatus') return onApplyTimedStatus(message, button);
  else if (action === 'docwagonArrive') return onDocwagonArrive(message, button);
  else if (action === 'breakBinding') return onBreakBinding(message, button);
  else if (action === 'placeWard') return onPlaceWard(message);
  else if (action === 'grimoireAdd') return onGrimoireAdd(message, button);
  else if (action === 'learnFormula') return onLearnFormula(message, button);
  else if (action === 'learnTaught') return onLearnTaught(message, button);
  else if (action === 'formulaGrimoire') return onFormulaGrimoire(message, button);
  else if (action === 'noticeRitual') return onNoticeRitual(message, button);
  else if (action === 'startFire') return onStartFire(message, button);
  else if (action === 'fireBurn') return onFireBurn(message, button);
  else if (action === 'rejectionTest') return onRejectionTest(message, button);
  else if (action === 'smokeInhale') return onSmokeInhale(message, button);
  else if (action === 'spreadDisease') return onSpreadDisease(message, button);
  else if (action === 'infection') return onInfection(message, button);
  else if (action === 'confirmDeed') return onConfirmDeed(message, button);
  else if (action === 'removeBug') return onRemoveBug(message, button);
  else if (action === 'regionDetect') return onRegionDetect(message, button);
}
