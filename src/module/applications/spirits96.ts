/**
 * v0.96.0 rules completeness, conjuring, spirits, astral space and critter powers: the Foundry glue for
 * RULES.SPIRITS_V96 (pure logic: rules/spirits96.ts). The world-time upkeep (an elemental's day of waiting, a disrupted
 * spirit's return, a watcher dissolving), a disrupted spirit's return date, a free spirit's true name before banishing,
 * an elemental's aid in spell defense, the watcher row of the Summon dialog, the critter-power lines on a resisted
 * power's card, and the GM's "Spirits (book rules)" tool (spirit against spirit).
 *
 * Security: the upkeep runs on the lead GM's client only (documents/index.ts magicTicks); the tool is the GM's; a
 * player's own client writes only documents it owns (an elemental's aid, through `canWrite`). Every value put into HTML
 * is escaped.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES } from '../rules/config.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';
import { clearFlag, replaceFlag } from '../helpers/flags.ts';
import { sysNow } from '../helpers/clock.ts';
import { allActors } from '../helpers/actors.ts';
import { successTest, type SuccessTestResult } from '../rules/dice.ts';
import { elementalServes } from '../rules/thaumaturgy.ts';
import * as S from '../rules/spirits96.ts';
import { isLeadGm } from './leader.ts';

const G = (): any => (globalThis as any).game;
const isGm = (): boolean => Boolean(G()?.user?.isGM);
const dialogs = (): any => (globalThis as any).foundry?.applications?.api?.DialogV2;
const warn = (text: string): void => { (globalThis as any).ui?.notifications?.warn?.(text); };
const int = (v: unknown, min: number, max: number, d = min): number => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
const post = (content: string, extra: Record<string, unknown> = {}): Promise<any> => (globalThis as any).ChatMessage.create({ content, ...extra });
const speaker = (actor: any): any => { try { return (globalThis as any).ChatMessage.getSpeaker({ actor }); } catch { return {}; } };
const name = (a: any): string => escHtml(String(a?.name ?? ''));
const DAY = 86400;

/** Dice rolled with Foundry (shown by Dice So Nice through the card's rolls). */
function roller(sink: any[]): (count: number) => Promise<number[]> {
  return async (count: number) => {
    const roll = await new (globalThis as any).Roll(`${count}d6`).evaluate();
    sink.push(roll);
    return (roll.dice ?? []).flatMap((term: any) => term.results.map((r: any) => Number(r.result)));
  };
}
const diceText = (r: SuccessTestResult): string => r.dice.map((d) => Number(d.total)).join(', ');

/** The flags this file keeps (on spirit actors): when an elemental was called, a disrupted spirit's return. */
export const WAIT_FLAG = 'waitSince96';
export const DISRUPTED_FLAG = 'disruptedUntil96';
/** On a magician: the aura readings tried this scene (rules/spirits96.ts assenseTriesOf). */
export const ASSENSE_FLAG = 'assenseTries96';

// ================================================================ World-time upkeep (the lead GM's magicTicks)

/** Whether an actor has a token on any scene (a called elemental hangs around where its token is). */
export function onAScene(a: any): boolean {
  const all: any = G()?.scenes;
  const scenes: any[] = all?.contents ?? (all && typeof all[Symbol.iterator] === 'function' ? [...all] : []);
  for (const sc of scenes) {
    const coll: any = sc?.tokens;
    const tokens: any[] = coll?.contents ?? (coll && typeof coll[Symbol.iterator] === 'function' ? [...coll] : []);
    if (tokens.some((t: any) => t?.actor === a || (t?.actorId && t.actorId === a?.id && t.actorLink !== false))) return true;
  }
  return false;
}

/**
 * An elemental's day of waiting (Core p. 141): a bound elemental with a token on a scene uses up a service every 24
 * hours of world time; with none left it departs. Taken off the scene, the count starts again when it is next called.
 */
export async function elementalWaitTick(a: any, time: number): Promise<boolean> {
  if (!S.on('elementalWaiting') || a?.type !== 'spirit' || a.system?.spiritKind !== 'elemental' || !a.system?.summonerUuid) return false;
  const since = Number(a.getFlag?.(SYSTEM_ID, WAIT_FLAG));
  const services = Math.max(0, Math.floor(Number(a.system?.services ?? 0)));
  if (!onAScene(a) || services <= 0) {
    if (Number.isFinite(since)) await clearFlag(a, WAIT_FLAG);
    return false;
  }
  // Not started yet (no token was placed while the GM watched), or a time in the future (the flag is the owner's to
  // write): the clock starts now.
  if (!Number.isFinite(since) || since > time) { await a.setFlag(SYSTEM_ID, WAIT_FLAG, time); return false; }
  const used = Math.min(services, S.waitingServices(since, time));
  if (used <= 0) return false;
  const left = services - used;
  await a.update({ 'system.services': left });
  if (left > 0) await a.setFlag(SYSTEM_ID, WAIT_FLAG, since + used * DAY);
  else await clearFlag(a, WAIT_FLAG);
  await post(`<p>${left > 0 ? tx('SR2E.Spirits96.Wait.used', { name: name(a), used, left }) : tx('SR2E.Spirits96.Wait.departs', { name: name(a) })}</p>`, { speaker: speaker(a) });
  return true;
}

/**
 * A spirit just disrupted (Grimoire p. 64): its return date goes on the spirit (a watcher is destroyed instead, as the
 * book says). Returns the card line ('' under 'v951').
 */
export async function disrupted(a: any): Promise<string> {
  if (!S.on('disruption') || a?.type !== 'spirit') return '';
  if (a.system?.spiritKind === 'watcher') return tx('SR2E.Spirits96.Disrupt.watcher', { name: name(a) });
  const force = Math.max(0, Math.floor(Number(a.system?.force ?? 0)));
  const at = sysNow();
  const until = S.disruptedUntil(at, force);
  if (until === null) return '';
  try { await a.setFlag(SYSTEM_ID, DISRUPTED_FLAG, { at, until }); } catch { /* not ours to write: the GM's card says it anyway */ }
  return tx('SR2E.Spirits96.Disrupt.until', { name: name(a), days: S.disruptionDays(force), day: Math.floor(until / DAY) + 1 });
}

/** A disrupted spirit's time is up: it may appear again (its damage gone). */
export async function disruptionTick(a: any, time: number): Promise<boolean> {
  if (a?.type !== 'spirit') return false;
  const raw: any = a.getFlag?.(SYSTEM_ID, DISRUPTED_FLAG);
  if (raw === undefined || raw === null) return false;
  const at = Number(raw?.at), until = Number(raw?.until);
  // The flag is the spirit owner's to write: it heals only a spirit that is disrupted, after exactly its 28 − Force
  // days from a disruption that isn't in the future; anything else just drops the flag.
  const sound = Number.isFinite(at) && Number.isFinite(until) && at <= time && until === at + S.disruptionDays(Number(a.system?.force ?? 0)) * DAY;
  if (sound && time < until) return false;
  await clearFlag(a, DISRUPTED_FLAG);
  if (!S.on('disruption') || !sound || String(a.system?.derived?.status ?? '') !== 'disrupted') return false;
  await a.update({ 'system.monitor.physical': 0, 'system.monitor.stun': 0 });
  await post(`<p>${tx('SR2E.Spirits96.Disrupt.back', { name: name(a) })}</p>`, { speaker: speaker(a) });
  return true;
}

/** A watcher whose hours are up dissolves (Grimoire p. 73). */
export async function watcherTick(a: any, time: number): Promise<boolean> {
  if (!S.on('watchers') || a?.type !== 'spirit' || a.system?.spiritKind !== 'watcher') return false;
  const at = Number(a.system?.departsAt ?? -1);
  if (!(at >= 0) || time < at) return false;
  await a.update({ 'system.departsAt': -1, 'system.services': 0 });
  await post(`<p>${tx('SR2E.Spirits96.Watcher.dissolves', { name: name(a) })}</p>`, { speaker: speaker(a) });
  return true;
}

/** Every v0.96.0 tick for one actor (documents/index.ts magicTicks, the lead GM's client). */
export async function magicTick96(a: any, time: number): Promise<void> {
  await elementalWaitTick(a, time);
  await disruptionTick(a, time);
  await watcherTick(a, time);
}

// ================================================================ The astral attack skill (Core p. 147)

/** An actor's skill item by name pattern (the best rating), or null. */
function skillLike(actor: any, re: RegExp): any | null {
  const list = [...(actor?.items ?? [])].filter((i: any) => i?.type === 'skill' && re.test(String(i.name ?? '')));
  return list.sort((x: any, y: any) => Number(y.system?.rating ?? 0) - Number(x.system?.rating ?? 0))[0] ?? null;
}

/**
 * The skill item a magician attacks with in astral combat (Core p. 147): Unarmed Combat (Armed Combat with an active
 * weapon focus) or Sorcery, the better. Null under 'v951' (the caller keeps ASTRAL.attackSkill) or with neither.
 */
export function astralSkillFor(actor: any, focus: boolean): any | null {
  if (!S.on('astralSkill')) return null;
  const sorcery = skillLike(actor, /^sorcery$/i);
  const melee = skillLike(actor, focus ? /^armed combat$/i : /^unarmed combat$/i);
  const pick = S.astralAttackSkill({ sorcery: Number(sorcery?.system?.rating ?? 0), unarmed: focus ? 0 : Number(melee?.system?.rating ?? 0), armed: focus ? Number(melee?.system?.rating ?? 0) : 0, focus });
  return (pick === 'sorcery' ? sorcery : melee) ?? sorcery ?? melee ?? null;
}

// ================================================================ Reading an aura again (Grimoire p. 90)

/**
 * Before reading `target`'s aura: the attempts so far this scene (kept on the reader). Returns the +2-per-attempt
 * modifier to add, `false` (warned) when no further attempt is allowed, or null under 'v951'.
 */
export async function assenseAgain(reader: any, target: any, baseTn: number): Promise<Array<{ id: string; label: string; value: number }> | false | null> {
  if (!S.on('assenseRepeat') || !target?.uuid) return null;
  const scenes: any = G()?.scenes;
  const sceneId = String(scenes?.viewed?.id ?? scenes?.current?.id ?? '');
  const raw = reader.getFlag?.(SYSTEM_ID, ASSENSE_FLAG);
  const subject = String(target.uuid).replace(/\./g, '_');
  const tries = S.assenseTriesOf(raw, sceneId, subject);
  const at = S.assenseAttempt({ tries, baseTn, magic: Number(reader.system?.derived?.magic ?? 0) });
  if (at.why) { warn(tx('SR2E.Spirits96.Why.assenseAgain', { name: name(reader), target: name(target), tn: at.tn })); return false; }
  try { await replaceFlag(reader, ASSENSE_FLAG, S.assenseTriesAfter(raw, sceneId, subject)); } catch { /* not ours: the attempt still counts on the card */ }
  return at.extra > 0 ? [{ id: 'assenseAgain', label: tx('SR2E.Spirits96.Assense.again', { tries }), value: at.extra }] : [];
}

// ================================================================ Technological melee enhancements (Awakenings p. 101)

/** The Power a melee weapon's own tweaks add that doesn't count against the targeted manifest spirit (0 otherwise). */
export function techPowerLost(weapon: any, tweaks: any, targetUuid: string | null): number {
  if (!S.on('techVsSpirits') || !targetUuid || RULES.SHEET_V921.tweaks !== 'on') return 0;
  const t: any = (globalThis as any).fromUuidSync?.(targetUuid) ?? null;
  const own = Number(tweaks?.weaponSelf?.[String(weapon?.id ?? '')] ?? 0);
  return S.techPowerLost({ melee: true, targetType: String(t?.type ?? ''), materialized: t?.system?.materialized, weaponTweakPower: own });
}

// ================================================================ Reflecting (Awakenings p. 99)

/**
 * A reflecting initiate's rebound the book's way (Awakenings p. 99): the shielding dice's successes (`shield`, counted
 * from the tagged dice at the test's current TN) against the caster's; more, and the spell comes back at a Force of the
 * difference (at most its own), the defender rolling that Force against the caster's resisting attribute as the new
 * casting test; a Force 1 spell reflected again dissipates. That test is rolled once and kept on the card
 * (`reflect.rebound96`): resolving the card again (a re-roll, a TN change) reuses its dice, rolling only dice a higher
 * Force adds. Returns the card line, its Resist button's flags and the reflect context to keep.
 */
export async function reflectRebound(actor: any, r: any, casterSuccesses: number, shield: number): Promise<{ html: string; flags: Record<string, unknown>; reflect: any }> {
  const o = S.reflectBook({ shieldSuccesses: shield, casterSuccesses, force: Number(r?.force ?? 0), reflected: Boolean(r?.reflected96) });
  if (!o) return { html: '', flags: {}, reflect: r };
  if ('dissipates' in o) return { html: `<p><strong>${tx('SR2E.Spirits96.Reflect.dissipates', { spell: escHtml(String(r.spellName ?? '')) })}</strong></p>`, flags: {}, reflect: r };
  const caster: any = (globalThis as any).fromUuidSync?.(String(r.casterUuid ?? '')) ?? null;
  const attr = String(r.resistAttribute ?? 'willpower');
  const kept: any = r?.rebound96 && typeof r.rebound96 === 'object' ? r.rebound96 : null;
  const tn = kept ? int(kept.tn, 2, 30, 4) : Math.max(2, Math.floor(Number(caster?.system?.attributes?.[attr]?.total ?? 4)) || 4);
  const had: number[] = Array.isArray(kept?.dice) ? kept.dice.slice(0, 30).map((d: unknown) => int(d, 1, 200, 1)) : [];
  if (had.length < o.force) {
    const more = await successTest({ dice: o.force - had.length, targetNumber: tn, roll: roller([]) });
    had.push(...more.dice.map((d) => Number(d.total)));
  }
  const used = had.slice(0, o.force);
  const successes = used.filter((d) => d >= tn).length;
  const spell = {
    casterUuid: String(actor.uuid), targetUuid: String(r.casterUuid), spellName: tx('SR2E.Spirits96.Reflect.name', { spell: String(r.spellName ?? '') }), force: o.force,
    resistAttribute: attr, level: r.level, damageType: r.damageType, casterSuccesses: successes,
    noun: 'spell', resistPool: 'spell', reflected: true,
    ...(r.effectOnly ? { effectOnly: true } : {}),
  };
  const html = `<p><strong>${tx('SR2E.Spirits96.Reflect.rebounds', { name: name(actor), spell: escHtml(String(r.spellName ?? '')), force: o.force })}</strong> ${tx('SR2E.Spirits96.Reflect.test', { dice: o.force, tn, rolled: escHtml(used.join(', ')), successes })}`
    + (successes > 0 ? ` <button type="button" data-sr2e-action="resistSpell" data-index="0">${tx('SR2E.Spirits96.Reflect.resist', { caster: escHtml(String(caster?.name ?? '')) })}</button>` : '') + '</p>';
  return { html, flags: successes > 0 ? { spell, spells: [spell] } : {}, reflect: { ...r, rebound96: { dice: had, tn } } };
}

// ================================================================ Registration

/** A bound elemental's token placed on a scene starts its day of waiting (the lead GM's client). */
export async function tokenPlaced(token: any): Promise<void> {
  const a: any = token?.actor;
  if (!S.on('elementalWaiting') || a?.type !== 'spirit' || a.system?.spiritKind !== 'elemental' || !a.system?.summonerUuid || !(Number(a.system?.services ?? 0) > 0)) return;
  if (!isLeadGm() || Number.isFinite(Number(a.getFlag?.(SYSTEM_ID, WAIT_FLAG)))) return;
  await a.setFlag(SYSTEM_ID, WAIT_FLAG, sysNow());
}

export function registerSpirits96(): void {
  (globalThis as any).Hooks?.on?.('createToken', (token: any) => { void tokenPlaced(token).catch((err) => console.warn('sr2e | elemental waiting', err)); });
}

// ================================================================ A free spirit's true name (Grimoire p. 77)

/**
 * Whether the banisher may banish this spirit (Grimoire p. 77): any spirit but a free one; a free one only with its
 * true name: its binder knows it, anyone else is asked for it. Warns and returns false when refused.
 */
export async function mayBanish(banisher: any, spirit: any): Promise<boolean> {
  const kind = String(spirit?.system?.spiritKind ?? '');
  if (!S.on('freeSpiritBanish') || kind !== 'free') return true;
  const mine: string[] = typeof banisher?.selfUuids === 'function' ? banisher.selfUuids() : [String(banisher?.uuid ?? '')];
  let knows = Boolean(spirit.system?.summonerUuid) && mine.includes(String(spirit.system.summonerUuid));
  if (!knows && String(spirit.system?.trueName ?? '').trim()) {
    const typed = await dialogs()?.prompt?.({
      window: { title: tx('SR2E.Spirits96.TrueName.title', { name: String(spirit.name ?? '') }) },
      content: `<div class="form-group"><label>${tx('SR2E.Spirits96.TrueName.label')}</label><input name="trueName" type="text" autofocus></div>`,
      ok: { label: tx('SR2E.Spirits96.TrueName.ok'), callback: (_e: Event, b: any) => String(b.form?.elements?.trueName?.value ?? '').slice(0, 200) },
      rejectClose: false,
    });
    knows = typeof typed === 'string' && S.trueNameMatches(String(spirit.system.trueName), typed);
  }
  const why = S.freeSpiritBanishRefusal({ spiritKind: kind, knowsName: knows });
  if (why) { warn(tx('SR2E.Spirits96.Why.trueName', { name: name(spirit) })); return false; }
  return true;
}

// ================================================================ Aid Sorcery in spell defense (Core p. 141)

/** The dice still left in an elemental's aid: its own count, never more than its Force (the flag is the owner's to write). */
export function aidLeftOf(aid: any): number {
  return Math.max(0, Math.min(Math.floor(Number(aid?.system?.force ?? 0)) || 0, Math.floor(Number(aid?.getFlag?.(SYSTEM_ID, 'aidLeft') ?? 0)) || 0));
}

/** Whether an elemental aid may join spell defense at all (this switch and SORCERY_V923.elementalAid, both book). */
const aidDefenseOn = (): boolean => S.on('aidDefense') && RULES.SORCERY_V923.elementalAid === 'book';

/** The defender's elemental whose started aid serves this spell (the first found), or null. */
function aidFor(defender: any, spell: { category?: string; element?: string }, may: (doc: any) => boolean): any | null {
  if (!aidDefenseOn() || !defender?.uuid) return null;
  const mine: string[] = typeof defender.selfUuids === 'function' ? defender.selfUuids() : [String(defender.uuid)];
  return allActors().find((a: any) => a?.type === 'spirit' && a.system?.spiritKind === 'elemental' && mine.includes(String(a.system?.summonerUuid ?? ''))
    && aidLeftOf(a) > 0 && elementalServes(String(a.system?.element ?? ''), { element: spell.element ?? '', category: spell.category ?? '' }) && may(a)) ?? null;
}

/**
 * Asked before the resistance roll (the chat card's Resist click, never under the GM lock or when resisting by
 * itself): how many of an own elemental's aid dice to add (Core p. 141: allocated like Magic Pool dice). Only the
 * user who owns that elemental is asked. 0 when there is none; null when the dialog was cancelled.
 */
export async function askAidDefense(defender: any, spell: { category?: string; element?: string }): Promise<number | null> {
  // A GM isn't asked to spend a player's elemental's dice.
  const aid = aidFor(defender, spell, (a: any) => Boolean(a?.isOwner) && !(isGm() && a?.hasPlayerOwner));
  if (!aid) return 0;
  const left = aidLeftOf(aid);
  const asked = await dialogs()?.prompt?.({
    window: { title: tx('SR2E.Spirits96.Aid.title', { name: String(aid.name ?? '') }) },
    content: `<div class="form-group"><label>${tx('SR2E.Spirits96.Aid.label', { name: name(aid), left })}</label><input name="aid" type="number" value="0" min="0" max="${left}" autofocus></div>`,
    ok: { label: tx('SR2E.Spirits96.Aid.ok'), callback: (_e: Event, b: any) => Number(b.form?.elements?.aid?.value) || 0 },
    rejectClose: false,
  });
  return asked === null || asked === undefined ? null : int(asked, 0, left, 0);
}

/**
 * The aid dice a magician adds to resisting a spell (Core p. 141): `asked` (from askAidDefense) of an aid already
 * started by one of their own elementals that serves the spell, written only when this resolution may write it. Never
 * asks anything (resistSpell may run under the GM lock). The dice used are gone from the aid.
 */
export async function aidDefense(defender: any, spell: { category?: string; element?: string }, canWrite: (doc: any) => boolean, asked = 0): Promise<{ dice: number; note: string }> {
  if (!(Number(asked) > 0)) return { dice: 0, note: '' };
  const aid = aidFor(defender, spell, canWrite);
  if (!aid) return { dice: 0, note: '' };
  const left = aidLeftOf(aid);
  const use = S.aidDefenseDice(left, int(asked, 0, left, 0));
  if (use.dice <= 0) return { dice: 0, note: '' };
  await aid.setFlag(SYSTEM_ID, 'aidLeft', use.left);
  const note = tx('SR2E.Spirits96.Aid.note', { name: String(aid.name ?? ''), dice: use.dice, left: use.left });
  return { dice: use.dice, note: ` [${note}]` };
}

// ================================================================ Watchers (Grimoire p. 73): the Summon dialog's row

/** The Summon dialog's hours row (shown for every kind; it counts only for a watcher). '' under 'v951'. */
export function watcherHoursRow(): string {
  if (!S.on('watchers')) return '';
  return `<div class="form-group"><label>${tx('SR2E.Spirits96.Watcher.hours')}</label><input name="watcherHours96" type="number" value="${S.watcherHours(null)}" min="1" max="999"></div>`;
}

/** The hours the dialog asks for (undefined when the row isn't there). */
export function readWatcherHours(elements: any): number | undefined {
  const v = elements?.watcherHours96?.value;
  return v === undefined ? undefined : int(v, 1, 999, 1);
}

// ================================================================ Critter powers (Predator and Prey pp. 89–92)

/** The extra line on a resisted power's card: Fear's severity, Engulf's entry and escape (nothing under 'v951'). */
export function powerOutcomeLine(special: string, powerName: string, net: number, hit: boolean): string {
  const kind = S.opposedPower(special, powerName);
  if (!kind || !hit) return '';
  if (kind === 'fear') {
    const sev = S.fearSeverity(net);
    const n = Math.max(0, Math.floor(Number(net) || 0));
    return sev === 'phobia' ? `<p>${tx('SR2E.Spirits96.Fear.phobia', { net: n })}</p>` : sev === 'sweats' ? `<p>${tx('SR2E.Spirits96.Fear.sweats', { net: n })}</p>`
      : sev === 'stays' ? `<p>${tx('SR2E.Spirits96.Fear.stays', { net: n })}</p>` : sev === 'runs' ? `<p>${tx('SR2E.Spirits96.Fear.runs', { net: n })}</p>` : '';
  }
  if (kind === 'engulf') {
    const e = S.engulfEntry(net);
    return e === 'run' ? `<p>${tx('SR2E.Spirits96.Engulf.run')} ${tx('SR2E.Spirits96.Engulf.escape')}</p>` : e === 'walk' ? `<p>${tx('SR2E.Spirits96.Engulf.walk')} ${tx('SR2E.Spirits96.Engulf.escape')}</p>` : '';
  }
  return `<p>${tx('SR2E.Spirits96.Confusion.tn', { tn: S.confusionTn(net) })}</p>`;
}

// ================================================================ The GM's "Spirits (book rules)" tool

const controlled = (): any[] => {
  const seen = new Set<string>();
  return [...((globalThis as any).canvas?.tokens?.controlled ?? [])].map((t: any) => t.actor).filter((a: any) => a && !seen.has(a.uuid) && (seen.add(a.uuid), true));
};

/**
 * Spirit against spirit (Core p. 143): each rolls its Force against the other's Force; the one with more successes
 * takes the difference off the other's Force (the GM's client writes it); at 0 the loser is destroyed for good.
 */
export async function spiritDuel(a: any, b: any): Promise<ReturnType<typeof S.spiritDuel> | undefined> {
  if (!S.on('spiritDuel') || !isGm() || a?.type !== 'spirit' || b?.type !== 'spirit' || a === b) return undefined;
  const fa = Math.max(0, Math.floor(Number(a.system?.force ?? 0)));
  const fb = Math.max(0, Math.floor(Number(b.system?.force ?? 0)));
  const tns = S.duelTns(fa, fb);
  const rolls: any[] = [];
  const ra = await successTest({ dice: fa, targetNumber: tns.a, roll: roller(rolls) });
  const rb = await successTest({ dice: fb, targetNumber: tns.b, roll: roller(rolls) });
  const out = S.spiritDuel({ aForce: fa, bForce: fb, aSuccesses: ra.successes, bSuccesses: rb.successes });
  const line = (x: any, f: number, tn: number, r: SuccessTestResult) => tx('SR2E.Spirits96.Duel.roll', { name: name(x), force: f, tn, rolled: escHtml(diceText(r)), successes: r.successes });
  const loser = out ? (out.loser === 'a' ? a : b) : null;
  if (out && loser) await loser.update({ 'system.force': out.force, ...(out.destroyed ? { 'system.services': 0 } : {}) });
  await post(`<p><strong>${tx('SR2E.Spirits96.Duel.title')}</strong></p><p>${line(a, fa, tns.a, ra)}<br>${line(b, fb, tns.b, rb)}</p><p>${!out || !loser ? tx('SR2E.Spirits96.Duel.tie')
    : out.destroyed ? tx('SR2E.Spirits96.Duel.destroyed', { name: name(loser), loss: out.loss }) : tx('SR2E.Spirits96.Duel.loses', { name: name(loser), loss: out.loss, force: out.force })}</p>`, { rolls });
  return out;
}

/** The GM's tool: Force against Force for the two selected spirits. */
export async function openSpiritsTool(): Promise<void> {
  if (!isGm()) return;
  const spirits = controlled().filter((a: any) => a.type === 'spirit');
  const names = escHtml(spirits.map((a: any) => String(a.name)).join(', '));
  const pick = await dialogs()?.wait?.({
    window: { title: tx('SR2E.Spirits96.Tool.title') },
    content: `<p>${spirits.length ? tx('SR2E.Spirits96.Tool.selected', { names }) : tx('SR2E.Spirits96.Tool.none')}</p><p class="hint">${tx('SR2E.Spirits96.Tool.hint')}</p>`,
    buttons: [
      ...(S.on('spiritDuel') ? [{ action: 'duel', label: tx('SR2E.Spirits96.Tool.duel'), callback: () => 'duel' }] : []),
      { action: 'cancel', label: tx('SR2E.Spirits96.Tool.cancel'), callback: () => null },
    ],
    rejectClose: false,
  });
  if (pick !== 'duel') return;
  if (spirits.length !== 2) { warn(tx('SR2E.Spirits96.Tool.needTwo')); return; }
  await spiritDuel(spirits[0], spirits[1]);
}
