/**
 * v0.95.0 rules completeness (area: ranged combat): the actor's side of RULES.FIRE_V95, called from small hooks in
 * documents/index.ts (planAttack, #attackWith, takeAim, #spendPool, postBlast, resistFromState). The rules are in
 * rules/fire95.ts; the canvas, dialogs and card buttons in applications/fire95.ts.
 */
import { RULES, type DamageLevel } from '../rules/config.ts';
import type { TargetNumberModifier } from '../rules/dice.ts';
import { weaponPower } from '../rules/weapons.ts';
import { escHtml } from '../rules/html.ts';
import * as R95 from '../rules/fire95.ts';
import { smokeBetweenTokens } from '../applications/canvas.ts';
import { clearFlag } from '../helpers/flags.ts';
import { t as tx } from '../helpers/i18n.ts';
import { SYSTEM_ID } from '../config/system.ts';

declare const game: any, canvas: any, ChatMessage: any, Roll: any, fromUuidSync: any;

// ---------------------------------------------------------------- laser sights (Core p. 90)

/**
 * Why the actor's laser sight gives nothing against this target right now: the weather where the actor stands, or
 * smoke on the line of fire (read from the tokens, or the dialog's own smoke row in `sight`). '' when it works.
 */
export function laserAir(actor: any, target: any, sight?: { smoke?: unknown } | null): '' | 'weather' | 'smoke' {
  if (RULES.FIRE_V95.laser !== 'book') return '';
  let weather = '';
  try { weather = String(actor?.weatherHere?.() ?? ''); } catch { /* no scene */ }
  let smoke = Boolean(sight?.smoke);
  if (!smoke && target) {
    try {
      const cls: any = actor?.constructor;
      const from = cls?.tokenFor?.(actor), to = cls?.tokenFor?.(target);
      if (from && to) smoke = smokeBetweenTokens(from, to, cls?.sceneFires?.(canvas?.scene) ?? []).kind !== 'none';
    } catch { /* no canvas */ }
  }
  return R95.laserCancelled({ weather, smoke });
}

/** planAttack: drop the laser sight's row when the air cancels it, with a note on the card. */
export function laserInAir(actor: any, situational: string[], notes: string[], opts: { targetUuid?: string | null; hits?: ReadonlyArray<{ targetUuid: string }>; sight?: { smoke?: unknown } | null }): void {
  const i = situational.indexOf('laserSight');
  if (i < 0) return;
  const uuid = opts.targetUuid ?? opts.hits?.[0]?.targetUuid ?? '';
  let target: any = null;
  try { target = uuid ? fromUuidSync(uuid) : null; } catch { /* unknown */ }
  const why = laserAir(actor, target, opts.sight ?? null);
  if (!why) return;
  situational.splice(i, 1);
  notes.push(why === 'smoke' ? tx('SR2E.Fire95.laserSmoke') : tx('SR2E.Fire95.laserWeather'));
}

// ---------------------------------------------------------------- two firearms (Core p. 90)

type Share = ReturnType<typeof R95.twoGunShare>;
/** What a plan worked out for the gun's recoil, read again when the shot is recorded (keyed by the plan's `extras`). */
const PLANNED = new WeakMap<object, { recoil: number; ownEarlier: number | null }>();

/** planAttack: firing as one of two guns (the tick is on): the other guns' rounds and recoil this phase; else null. */
export function twoGuns(actor: any, weapon: any, opts: { situational?: readonly string[]; suppressive?: boolean }): Share | null {
  if (opts.suppressive || !R95.sharedRecoilOn(opts.situational)) return null;
  return R95.twoGunShare(actor.getFlag?.(SYSTEM_ID, 'recoil95') as R95.TwoGunState | undefined, actor.currentPhaseKey?.() ?? null, String(weapon?.id ?? ''));
}

/**
 * planAttack: remember this gun's own recoil for the record, and give the other gun's uncompensated recoil as a
 * modifier (`earlier`: the rounds the attack counted as already fired, the other guns' included).
 */
export function sharedRecoil(two: Share | null, extras: object, recoil: number, earlier: number): TargetNumberModifier[] {
  PLANNED.set(extras, { recoil: Math.max(0, Number(recoil) || 0), ownEarlier: two ? Math.max(0, earlier - two.otherRounds) : null });
  return two && two.shared > 0 ? [{ id: 'sharedRecoil95', label: tx('SR2E.Fire95.sharedRecoil'), value: two.shared }] : [];
}

/** #attackWith: after a ranged shot, remember what this gun fired this phase and the recoil it was left with. */
export async function recordGun(actor: any, weapon: any, plan: { extras: object; rounds: number; earlier: number; wasted: number; firstShotSingle?: boolean | undefined }, phase: string | null): Promise<void> {
  if (!phase || RULES.FIRE_V95.sharedRecoil !== 'book' || !weapon?.id) return;
  const p = PLANNED.get(plan.extras);
  const state = actor.getFlag?.(SYSTEM_ID, 'recoil95') as R95.TwoGunState | undefined;
  const own = R95.twoGunShare(state, phase, String(weapon.id)).ownRounds;
  await actor.setFlag(SYSTEM_ID, 'recoil95', R95.twoGunRecord(state, phase, String(weapon.id), {
    // The plan's `earlier` already holds the rounds wasted walking the fire (planAttack): counted once, as recordRounds does.
    ownEarlier: p?.ownEarlier ?? own + plan.wasted, rounds: plan.rounds, recoil: p?.recoil ?? 0,
    ...(typeof plan.firstShotSingle === 'boolean' ? { firstSingle: plan.firstShotSingle } : {}),
  }));
}

// ---------------------------------------------------------------- Take Aim and pool dice (Core p. 82)

/** takeAim: the aim flag with the Combat Phase the aim began in. */
export function stampAim<T extends { actions: number }>(actor: any, next: T, prev: unknown): T & { phase95: string } {
  return { ...next, phase95: R95.aimStartPhase(prev as any, next.actions, actor.currentPhaseKey?.() ?? null) };
}

/** planAttack: the aim's modifiers, or none (with a note) when the shot's own pool dice lose an aim held over phases. */
export function aimKept(actor: any, mods: TargetNumberModifier[], poolDice: number | undefined, notes: string[]): TargetNumberModifier[] {
  if (!mods.length || !R95.aimLostToPool(actor.getFlag?.(SYSTEM_ID, 'aim'), actor.currentPhaseKey?.() ?? null, Number(poolDice ?? 0))) return mods;
  notes.push(tx('SR2E.Fire95.aimLostShot'));
  return [];
}

/** #spendPool: pool dice used while an aim is held over several Combat Phases lose the aim. */
export async function aimPoolSpent(actor: any, dice: number): Promise<void> {
  if (!R95.aimLostToPool(actor.getFlag?.(SYSTEM_ID, 'aim'), actor.currentPhaseKey?.() ?? null, dice)) return;
  await clearFlag(actor, 'aim');
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p><strong>${escHtml(actor.name)}</strong> ${tx('SR2E.Fire95.aimLost')}</p>` });
}

// ---------------------------------------------------------------- explosive rounds (Core p. 93)

/**
 * #attackWith, after the roll: explosive rounds and every die a 1: the round goes off in the gun. Posts a card with
 * the weapon's normal round against the shooter (1D6 attack successes, no Combat Pool) and its Resist button.
 */
export async function afterAttack(actor: any, weapon: any, plan: { melee: boolean; blast: boolean; w: any }, opts: { ammoType?: string | null; limbId?: string | null }, result: { botch?: boolean } | null): Promise<void> {
  if (!result || !R95.misfires({ ammoId: String(opts.ammoType ?? plan.w?.ammoType ?? ''), botch: Boolean(result.botch), melee: plan.melee, blast: Boolean(plan.blast) })) return;
  const roll = await new Roll('1d6').evaluate();
  const strength = actor.type === 'vehicle' ? 0 : Number(actor.attackStrength?.(opts.limbId ?? weapon?.limbId ?? null)?.strength ?? 0);
  const hit = R95.misfireHit({ power: weaponPower(plan.w, strength), level: plan.w.damageLevel as DamageLevel, die: Number(roll.total) });
  const type = plan.w.damageType === 'stun' ? 'stun' : 'physical';
  const damage = { targetUuid: actor.uuid as string, melee: false, damageType: type, power: hit.power, level: hit.level, noPool: true, cleanMiss80: { hits: hit.successes, net: hit.successes, noClean: true } };
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }), rolls: [roll],
    content: `<div class="sr2e-roll"><h3>${tx('SR2E.Fire95.misfireTitle', { weapon: escHtml(weapon?.name ?? '') })}</h3><p>${tx('SR2E.Fire95.misfireText', { name: escHtml(actor.name), successes: hit.successes })}</p><p class="hint">${tx('SR2E.Fire95.misfireUndo')}</p></div>`
      + `<ul class="sr2e-blast"><li>${escHtml(actor.name)}: <strong>${escHtml(hit.power)}${escHtml(hit.level)}</strong> <button type="button" data-sr2e-action="resist" data-index="0">${tx('SR2E.Card.Actor.resist')}</button></li></ul>`,
    flags: { [SYSTEM_ID]: { damages: [damage], damage } },
  });
}

// ---------------------------------------------------------------- shotgun shot (Core p. 95)

/** armorExtras: the extra resistance dice an attack on this target carries to its damage. */
export function screenExtras(a: { screen95?: unknown }): { screen95?: number } {
  const n = R95.shotScreenDice(a?.screen95);
  return n > 0 ? { screen95: n } : {};
}

/** resistFromState: the extra dice for the resistance test. */
export function screenDice(damage: { screen95?: unknown } | null | undefined): { extraDice95?: number } {
  const n = R95.shotScreenDice(damage?.screen95);
  return n > 0 ? { extraDice95: n } : {};
}

/** resistDamage: the note for the soak card's title. */
export function screenNote(n: number | undefined): string {
  return n && n > 0 ? tx('SR2E.Fire95.screenNote', { n }) : '';
}

// ---------------------------------------------------------------- blast in a confined space (Core p. 98)

/** postBlast: the Power the rebounding wave adds for a target (bounded: it comes from the caller's canvas work). */
export function reboundOf(h: { rebound95?: unknown }): number {
  const n = Math.floor(Number(h?.rebound95) || 0);
  return R95.reboundBook() && n > 0 ? Math.min(n, 200) : 0;
}

/** postBlast: the words after a target's damage code on the blast card. */
export function reboundNote(h: { rebound95?: unknown } | undefined): string {
  const n = h ? reboundOf(h) : 0;
  return n > 0 ? ` ${tx('SR2E.Fire95.reboundRow', { n })}` : '';
}
