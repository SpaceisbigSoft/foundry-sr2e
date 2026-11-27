/**
 * v0.95.0 rules completeness (area: ranged combat): the canvas, dialog and chat-card side of RULES.FIRE_V95, called
 * from small hooks in applications/sheets.ts (the Attack dialog, the Suppress button) and applications/chat.ts
 * (detonateAt, the card-button dispatch). The rules are in rules/fire95.ts; the actor's side in documents/fire95.ts.
 *
 * Security: both card buttons here are the GM's. The flags they read were written by whoever posted the card (a
 * player's client for their own attack), so every number is bounded, and a card not posted by a GM is confirmed by
 * the GM first (`gmMay`, refused when the author doesn't own the shooter). The rolls run under the GM lock.
 */
import { RULES } from '../rules/config.ts';
import { successTest } from '../rules/dice.ts';
import { attackBaseTargetNumber, rangeBandForDistance } from '../rules/combat.ts';
import { weaponRange, weaponPower, blastRadius } from '../rules/weapons.ts';
import { parseFiringModes } from '../rules/firing.ts';
import { crossingFraction } from '../rules/fieldsfire.ts';
import { safeInt, boundLevel } from '../rules/trust.ts';
import { escHtml } from '../rules/html.ts';
import * as R95 from '../rules/fire95.ts';
import { laserAir } from '../documents/fire95.ts';
import { attackerToken, measureTokens, sightCover, pxPerMetre, wallsBetweenPoints } from './canvas.ts';
import { gmMay } from './trust.ts';
import { withGmLock } from './gmlock.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';
import { SYSTEM_ID } from '../config/system.ts';

declare const game: any, canvas: any, ui: any, ChatMessage: any, Roll: any, foundry: any, fromUuid: any;

const gmIds = (): string[] => [...(game.users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);
const roller = (sink: any[]) => async (count: number): Promise<number[]> => {
  const roll = await new Roll(`${count}d6`).evaluate();
  sink.push(roll);
  return roll.dice[0].results.map((r: any) => r.result as number);
};

/** What a hit's damage carries besides its code (how armor counts), read back bounded from a card's flags. */
function boundExtra(x: any): Record<string, unknown> {
  if (!x || typeof x !== 'object') return {};
  const m = Number(x.armorMultiplier);
  return {
    ...(x.armorKind === 'impact' || x.armorKind === 'ballistic' ? { armorKind: x.armorKind } : {}),
    ...(Number.isFinite(m) && m >= 0 && m <= 4 && m !== 1 ? { armorMultiplier: m } : {}),
    ...(x.flechette === true ? { flechette: true } : {}),
    ...(x.gel === true ? { gel: true } : {}),
  };
}

/** One round's damage with this weapon and ammunition (no burst or full-auto bonus), for the cards here. */
function roundDamage(actor: any, weapon: any, opts: Record<string, unknown>): { power: number; level: string; damageType: string; extra: Record<string, unknown> } {
  try {
    const { targetUuid: _t, hits: _h, ...rest } = opts as any;
    const plan = actor.planAttack(weapon, { ...rest, mode: 'FA', rounds: 1, wastedRounds: 0, sight: {}, spreadExtraTargets: 0, poolDice: 0 });
    return { power: Number(plan.extras?.barrierPower ?? plan.power) || 0, level: String(plan.level), damageType: String(plan.damageType), extra: boundExtra(plan.extras) };
  } catch {
    const w = weapon?.system ?? {};
    return { power: weaponPower(w, Number(actor.system?.attributes?.strength?.total ?? 0)), level: String(w.damageLevel ?? 'L'), damageType: String(w.damageType ?? 'physical'), extra: {} };
  }
}

// ---------------------------------------------------------------- laser sights (Core p. 90)

/** The Attack dialog: whether the air cancels the laser sight (weather where the shooter is, or smoke on the line). */
export function laserAir95(actor: any, smokeKind?: string | null): boolean {
  return Boolean(laserAir(actor, null, { smoke: Boolean(smokeKind) && smokeKind !== 'none' }));
}

// ---------------------------------------------------------------- shotgun shot (Core p. 95)

/**
 * The Attack dialog's shot spread: give each hit its extra resistance dice (`screen95`), one per other target in
 * the spread closer to the gun. `spread`: everyone in the spread with their distance along the line of fire.
 */
export function screenHits95<T extends { targetUuid: string }>(hits: T[], spread: ReadonlyArray<{ uuid?: string | null; metres: number | null | undefined }>): Array<T & { screen95?: number }> {
  const known = spread.filter((s): s is { uuid: string; metres: number } => typeof s.uuid === 'string' && Number.isFinite(Number(s.metres)));
  const dice = R95.shotScreens(known.map((s) => ({ id: s.uuid, metres: Number(s.metres) })));
  return hits.map((h) => (dice[h.targetUuid] ? { ...h, screen95: dice[h.targetUuid]! } : h));
}

// ---------------------------------------------------------------- blast in a confined space (Core p. 98)

/** The first wall on the way from `a` to `b` (pixels): metres from `a`, its barrier rating (null: not set). */
function firstWall(a: { x: number; y: number }, b: { x: number; y: number }): { metres: number; rating: number | null } | null {
  const len = Math.hypot(b.x - a.x, b.y - a.y) / pxPerMetre();
  let best: { metres: number; rating: number | null } | null = null;
  for (const w of wallsBetweenPoints(a, b)) {
    const t = crossingFraction(a, b, w.doc?.c ?? []);
    if (t == null) continue;
    const raw = w.doc?.getFlag?.(SYSTEM_ID, 'barrierRating') ?? w.doc?.flags?.[SYSTEM_ID]?.barrierRating;
    const rating = raw === null || raw === undefined || raw === '' || !(Number(raw) > 0) ? null : Number(raw);
    if (!best || t * len < best.metres) best = { metres: t * len, rating };
  }
  return best;
}

/**
 * detonateAt: the rebounding wave's Power for one token caught in a blast at `point` (nothing when a wall stands
 * between them, or the rule is off): the walls on the line through the blast and the token, past the token and on
 * the far side of the blast, within the blast's reach.
 */
export function rebound95(point: { x: number; y: number }, token: any, ctx: { power: number; perMetre: number }, shielded: boolean): { rebound95?: number } {
  if (shielded || !R95.reboundBook()) return {};
  try {
    const ppm = pxPerMetre();
    const c = token?.center;
    if (!c) return {};
    const dx = c.x - point.x, dy = c.y - point.y;
    const len = Math.hypot(dx, dy);
    const ux = len > 0 ? dx / len : 1, uy = len > 0 ? dy / len : 0;
    const reach = Math.min(200, blastRadius(ctx.power, ctx.perMetre)) * ppm;
    if (!(reach > len)) return {};
    const d = len / ppm;
    const past = firstWall(c, { x: point.x + ux * reach, y: point.y + uy * reach });
    const far = firstWall(point, { x: point.x - ux * reach, y: point.y - uy * reach });
    const r = R95.reboundPower({ power: ctx.power, perMetre: ctx.perMetre, metres: d, ahead: past ? { metres: d + past.metres, rating: past.rating } : null, behind: far });
    return r && r.extra > 0 ? { rebound95: r.extra } : {};
  } catch { return {}; }
}

// ---------------------------------------------------------------- stray shots (Core p. 93, optional)

/**
 * The Attack dialog, after full auto was walked over several targets: a card for the GM with everyone standing in
 * the arcs the fire was walked through (in sight, in range, in random order), each with the test and a Roll button.
 * `targets`: the tokens fired at, in order. Nothing when the rule is off, no rounds strayed or nobody is there.
 */
export async function strayCard95(actor: any, weapon: any, o: { from: any; targets: readonly any[]; wasted: number; smartlinked: boolean; opts?: Record<string, unknown> }): Promise<void> {
  const rounds = R95.strayRounds(o.wasted, o.smartlinked);
  const from = o.from;
  if (!rounds || !from?.center || o.targets.length < 2) return;
  const bearing = (t: any): number => Math.atan2(t.center.y - from.center.y, t.center.x - from.center.x);
  const limits = weaponRange(weapon.system, Number(actor.system?.attributes?.strength?.total ?? 0), weapon.name);
  const near = Math.max(0, Number(RULES.FIRE_V95.strayMetres) || 0);
  const rows: Array<{ uuid: string; name: string; metres: number; tn: number }> = [];
  let placeables: any[] = [];
  try { placeables = canvas?.tokens?.placeables ?? []; } catch { /* no canvas */ }
  for (const t of placeables) {
    if (t === from || o.targets.includes(t) || !t.actor?.uuid || !t.center) continue;
    const m = measureTokens(from, t)?.metres;
    if (m == null) continue;
    const band = rangeBandForDistance(m, limits);
    if (!band) continue;
    const margin = Math.atan2(near, Math.max(0.5, m));
    if (!o.targets.slice(1).some((b, i) => o.targets[i]?.center && b?.center && R95.inSweep(bearing(o.targets[i]), bearing(b), bearing(t), margin))) continue;
    if (sightCover(from, t)?.cover === 'blind') continue;
    rows.push({ uuid: t.actor.uuid as string, name: String(t.name ?? t.actor.name ?? ''), metres: Math.round(m * 10) / 10, tn: attackBaseTargetNumber({ melee: false, range: band }).value });
  }
  if (!rows.length) return;
  const list = R95.strayOrder(rows).slice(0, 20);
  const dmg = roundDamage(actor, weapon, o.opts ?? {});
  const dice = safeInt(RULES.FIRE_V95.strayDice, 1, 20, 2);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }), whisper: gmIds(),
    content: `<div class="sr2e-roll"><h3>${tx('SR2E.Fire95.strayTitle', { weapon: escHtml(weapon.name) })}</h3><p>${tCount(rounds, 'SR2E.Fire95.strayText', { name: escHtml(actor.name), dice, code: `${escHtml(dmg.power)}${escHtml(dmg.level)}` })}</p></div>`
      + `<ul class="sr2e-blast">${list.map((r, i) => `<li>${escHtml(r.name)} (${escHtml(r.metres)} m): ${tx('SR2E.Fire95.strayRow', { dice, tn: escHtml(r.tn) })} <button type="button" data-sr2e-action="stray95" data-index="${i}">${tx('SR2E.Fire95.strayRoll')}</button></li>`).join('')}</ul>`,
    flags: { [SYSTEM_ID]: { stray95: { attackerUuid: actor.uuid, weaponName: String(weapon.name ?? '').slice(0, 120), rounds, power: dmg.power, level: dmg.level, damageType: dmg.damageType, extra: dmg.extra, rows: list.map((r) => ({ uuid: r.uuid, name: r.name.slice(0, 120), tn: r.tn })) } } },
  });
}

/** The stray-shot card's Roll button (GM): the test against one bystander; a hit posts its damage with a Resist button. */
export async function onStray95(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications?.warn?.(tx('SR2E.Fire95.gmOnly'));
  const f = message.getFlag(SYSTEM_ID, 'stray95') as any;
  if (!f || typeof f !== 'object' || !Array.isArray(f.rows)) return;
  const i = safeInt(button.dataset['index'], 0, 19, 0);
  const row = f.rows[i];
  if (!row || typeof row.uuid !== 'string' || row.uuid.length > 400) return;
  const usedNow = (): number[] => { const u = message.getFlag(SYSTEM_ID, 'stray95Used'); return Array.isArray(u) ? u.map((n: unknown) => safeInt(n, 0, 19, 0)) : []; };
  const rounds = safeInt(f.rounds, 0, 99, 0);
  const spent = (): boolean => {
    if (usedNow().includes(i)) { ui.notifications?.warn?.(tx('SR2E.Fire95.strayDone')); return true; }
    if (usedNow().length >= rounds) { ui.notifications?.warn?.(tx('SR2E.Fire95.strayNoneLeft')); return true; }
    return false;
  };
  if (spent()) return;
  const target: any = await fromUuid(row.uuid);
  if (!target) return ui.notifications?.warn?.(tx('SR2E.Notify.Chat.theTargetActorNoLongerExists'));
  const tn = safeInt(row.tn, RULES.MIN_TARGET_NUMBER, 30, 4), dice = safeInt(RULES.FIRE_V95.strayDice, 1, 20, 2);
  const power = safeInt(f.power, 0, 60, 0), level = boundLevel(f.level), damageType = f.damageType === 'stun' ? 'stun' : 'physical';
  const weaponName = String(f.weaponName ?? '').slice(0, 120);
  if (!(await gmMay(message, { title: tx('SR2E.Fire95.strayDialog'), lines: [tx('SR2E.Fire95.strayLine', { name: target.name, dice, tn, code: `${power}${level}`, type: damageType })], sources: [f.attackerUuid], always: true }))) return;
  button.disabled = true;
  await withGmLock(async () => {
    if (spent()) return;
    const rolls: any[] = [];
    const test = await successTest({ dice, targetNumber: tn, modifiers: [], roll: roller(rolls) });
    let die = 0;
    if (test.successes > 0) { const r = await new Roll('1d6').evaluate(); rolls.push(r); die = Number(r.total); }
    const hit = R95.strayHit(test.successes, die || 1);
    const damage = { targetUuid: target.uuid as string, melee: false, damageType, power, level, ...boundExtra(f.extra), cleanMiss80: { hits: hit.successes, net: hit.successes } };
    await ChatMessage.create({
      speaker: { alias: weaponName }, rolls,
      content: `<div class="sr2e-roll"><h3>${tx('SR2E.Fire95.strayTitle', { weapon: escHtml(weaponName) })}</h3><p>${tCount(test.successes, 'SR2E.Fire95.strayResult', { name: escHtml(target.name), dice, tn })} `
        + (hit.hit
          ? `<strong>${tx('SR2E.Fire95.strayHits', { successes: hit.successes })}</strong></p></div><ul class="sr2e-blast"><li>${escHtml(target.name)}: <strong>${escHtml(power)}${escHtml(level)}</strong> <button type="button" data-sr2e-action="resist" data-index="0">${tx('SR2E.Card.Actor.resist')}</button></li></ul>`
          : `<strong>${tx('SR2E.Fire95.strayMisses')}</strong></p></div>`),
      ...(hit.hit ? { flags: { [SYSTEM_ID]: { damages: [damage], damage } } } : {}),
    });
    await message.setFlag(SYSTEM_ID, 'stray95Used', [...new Set([...usedNow(), i])]);
  });
}

// ---------------------------------------------------------------- suppressive fire (Fields of Fire p. 78, optional)

/**
 * The sheet's Suppress button the Fields of Fire way: ask the rounds and the width of the area, spend the action and
 * the rounds, and post the card with its GM button. Returns false when it isn't this rule's turn (the house way runs).
 */
export async function suppressFof95(actor: any, weaponId: string): Promise<boolean> {
  if (!R95.suppressionFof()) return false;
  const weapon: any = actor.weaponById?.(weaponId);
  const w = weapon?.system;
  if (!RULES.COMBAT.suppressive.enabled) { ui.notifications?.warn?.(tx('SR2E.Notify.Actor.suppressiveFireIsSwitchedOffIn')); return true; }
  if (!w || w.melee || !parseFiringModes(w.modes ?? '').includes('FA')) { ui.notifications?.warn?.(tx('SR2E.Notify.Actor.suppressiveFireNeedsAFullAuto')); return true; }
  if (w.jammed) { ui.notifications?.warn?.(tx('SR2E.Notify.Actor.isJammed', { weaponName: escHtml(weapon.name) })); return true; }
  if (w.damaged) { ui.notifications?.warn?.(tx('SR2E.Notify.Actor.isBrokenRepairItFirst', { weaponName: escHtml(weapon.name) })); return true; }
  const most = Math.min(safeInt(RULES.FIRING.fullAutoMax, 1, 999, 10), Number(w.ammoMax) > 0 ? Math.max(0, Math.floor(Number(w.ammo) || 0)) : 999);
  if (most < 1) { ui.notifications?.warn?.(tx('SR2E.Fire95.fofNoRounds', { weapon: escHtml(weapon.name) })); return true; }
  const asked = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Fire95.fofTitle') },
    content: `<p>${tx('SR2E.Fire95.fofHint', { phases: safeInt(RULES.FIRE_V95.fofPhases, 0, 99, 10) })}</p>
      <div class="form-group"><label>${tx('SR2E.Fire95.fofRounds', { most })}</label><input name="rounds" type="number" value="${most}" min="1" max="${most}" autofocus></div>
      <div class="form-group"><label>${tx('SR2E.Fire95.fofMetres')}</label><input name="metres" type="number" value="${Math.max(1, Math.floor(most / 2))}" min="1" max="${most}"></div>`,
    ok: { callback: (_e: Event, b: any) => ({ rounds: Number(b.form.elements.rounds.value), metres: Number(b.form.elements.metres.value) }) },
    rejectClose: false,
  });
  if (!asked || typeof asked !== 'object') return true;
  const area = R95.fofArea(Math.min(most, Math.max(1, Math.floor(Number(asked.rounds) || 0))), Number(asked.metres) || 1);
  if (!area.rounds) return true;
  if (!(await actor.useAction('suppress', tx('SR2E.Card.Actor.suppressiveFireWith', { weaponName: weapon.name })))) return true;
  if (Number(w.ammoMax) > 0 && typeof weapon.update === 'function') await weapon.update({ 'system.ammo': Math.max(0, Number(w.ammo) - area.rounds) });
  const dmg = roundDamage(actor, weapon, {});
  const test = R95.fofTest({ perMetre: area.perMetre });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="sr2e-roll"><h3>${tx('SR2E.Fire95.fofCardTitle', { weapon: escHtml(weapon.name) })}</h3><p>${tx('SR2E.Fire95.fofCardText', { name: escHtml(actor.name), rounds: area.rounds, metres: area.metres, perMetre: area.perMetre, phases: area.phases, tn: test.tn, perHit: safeInt(RULES.FIRE_V95.fofPerHit, 1, 99, 2), code: `${escHtml(dmg.power)}${escHtml(dmg.level)}` })}</p></div>`
      + `<p><button type="button" data-sr2e-action="suppress95">${tx('SR2E.Fire95.fofButton')}</button></p>`,
    flags: { [SYSTEM_ID]: { suppress95: { attackerUuid: actor.uuid, weaponName: String(weapon.name ?? '').slice(0, 120), rounds: area.rounds, metres: area.metres, perMetre: area.perMetre, power: dmg.power, level: dmg.level, damageType: dmg.damageType, extra: dmg.extra } } },
  });
  return true;
}

/**
 * The suppression card's button (GM): everyone the GM has targeted has shown themselves in the covered area. Each is
 * attacked with the rounds on their metre (cover found on the canvas, the GM may change it); every hit is one round's
 * damage with its own Resist button.
 */
export async function onSuppress95(message: any, button: HTMLButtonElement): Promise<void> {
  if (!game.user?.isGM) return ui.notifications?.warn?.(tx('SR2E.Fire95.gmOnly'));
  const f = message.getFlag(SYSTEM_ID, 'suppress95') as any;
  if (!f || typeof f !== 'object') return;
  const tokens = [...(game.user?.targets ?? [])].filter((t: any) => t?.actor?.uuid).slice(0, 10);
  if (!tokens.length) return ui.notifications?.warn?.(tx('SR2E.Fire95.fofTargetFirst'));
  const attacker: any = typeof f.attackerUuid === 'string' && f.attackerUuid.length <= 400 ? await fromUuid(f.attackerUuid) : null;
  const perMetre = safeInt(f.perMetre, 0, safeInt(RULES.FIRING.fullAutoMax, 1, 999, 10), 0);
  if (!perMetre) return;
  const power = safeInt(f.power, 0, 60, 0), level = boundLevel(f.level), damageType = f.damageType === 'stun' ? 'stun' : 'physical';
  const weaponName = String(f.weaponName ?? '').slice(0, 120);
  const wounds = Math.max(0, safeInt(attacker?.system?.derived?.woundModifier, 0, 20, 0));
  const from = attacker ? attackerToken(attacker) : null;
  const partial = Number(RULES.SITUATIONAL_MODIFIERS.find((m) => m.id === 'partialCover')?.value ?? 4);
  if (!(await gmMay(message, { title: tx('SR2E.Fire95.fofTitle'), lines: [tx('SR2E.Fire95.fofLine', { names: tokens.map((t: any) => t.name).join(', '), dice: perMetre, code: `${power}${level}`, type: damageType })], sources: [f.attackerUuid], always: true }))) return;
  for (const t of tokens) {
    const seen = from ? sightCover(from, t)?.cover ?? 'none' : 'none';
    if (seen === 'blind') { ui.notifications?.warn?.(tx('SR2E.Fire95.fofUnseen', { name: escHtml(t.name) })); continue; }
    const cover = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Fire95.fofTitle') },
      content: `<div class="form-group"><label>${tx('SR2E.Fire95.fofCover', { name: escHtml(t.name) })}</label><input name="cover" type="number" value="${seen === 'partial' ? partial : 0}" min="0" max="12" autofocus></div>`,
      ok: { callback: (_e: Event, b: any) => Number(b.form.elements.cover.value) },
      rejectClose: false,
    });
    if (typeof cover !== 'number' || !Number.isFinite(cover)) continue;
    const test = R95.fofTest({ perMetre, cover: safeInt(cover, 0, 12, 0), wounds });
    await withGmLock(async () => {
      const rolls: any[] = [];
      const res = await successTest({ dice: test.dice, targetNumber: test.tn, modifiers: [], roll: roller(rolls) });
      const hits = R95.fofHits(res.successes, perMetre);
      const damages = Array.from({ length: hits }, () => ({ targetUuid: t.actor.uuid as string, melee: false, damageType, power, level, ...boundExtra(f.extra) }));
      await ChatMessage.create({
        speaker: { alias: weaponName }, rolls,
        content: `<div class="sr2e-roll"><h3>${tx('SR2E.Fire95.fofCardTitle', { weapon: escHtml(weaponName) })}</h3><p>${tCount(res.successes, 'SR2E.Fire95.fofResult', { name: escHtml(t.name), dice: test.dice, tn: test.tn })} <strong>${tCount(hits, 'SR2E.Fire95.fofHits')}</strong></p></div>`
          + (hits ? `<ul class="sr2e-blast">${damages.map((d, i) => `<li>${escHtml(t.name)}: <strong>${escHtml(d.power)}${escHtml(d.level)}</strong> <button type="button" data-sr2e-action="resist" data-index="${i}">${tx('SR2E.Card.Actor.resist')}</button></li>`).join('')}</ul>` : ''),
        ...(hits ? { flags: { [SYSTEM_ID]: { damages, damage: damages[0] } } } : {}),
      });
    });
  }
  void button;
}
