/**
 * v0.97.0 rules completeness, the decker's life outside a fight: the Foundry glue for RULES.MXLIFE_V97 (pure logic:
 * rules/mxlife97.ts). The world-time upkeep (psychotropic recovery tests falling due, paydata going stale), the GM's
 * recovery card, a deck part's Cook and Installation tasks, the otaku's channels, complex forms and free Armor, and
 * IC getting a token on the GM's viewed Matrix scene. documents/index.ts calls these from its existing paths.
 *
 * Security: the upkeep runs on the lead GM's client only (documents/index.ts timedEffects); the recovery card's button
 * is the GM's, on a GM-posted card, and reads only an actor uuid and a schedule key from it (the IC's rating comes
 * from the actor's own effect, not the card). Every value put into HTML is escaped.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES } from '../rules/config.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';
import { clearFlag } from '../helpers/flags.ts';
import { storedXY } from '../helpers/tokenpos.ts';
import { successTest } from '../rules/dice.ts';
import { PSYCHOTROPIC_LABELS } from '../rules/matrix.ts';
import { skillCost } from '../rules/upkeep.ts';
import { newSkillCost } from '../rules/core923.ts';
import { skillBandAttribute } from '../rules/charfix.ts';
import { authorIsGm } from './trust.ts';
import * as M from '../rules/mxlife97.ts';

const G = (): any => (globalThis as any).game;
const isGm = (): boolean => Boolean(G()?.user?.isGM);
const warn = (text: string): void => { (globalThis as any).ui?.notifications?.warn?.(text); };
const post = (content: string, extra: Record<string, unknown> = {}): Promise<any> => (globalThis as any).ChatMessage.create({ content, ...extra });
const speaker = (actor: any): any => { try { return (globalThis as any).ChatMessage.getSpeaker({ actor }); } catch { return {}; } };
const gmIds = (): string[] => [...(G()?.users ?? [])].filter((u: any) => u.isGM).map((u: any) => String(u.id));
const ownerIds = (a: any): string[] => [...(G()?.users ?? [])].filter((u: any) => u.isGM || a?.testUserPermission?.(u, 'OWNER')).map((u: any) => String(u.id));
const name = (a: any): string => escHtml(String(a?.name ?? ''));
const whole = (v: unknown): number => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
const uuidOk = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 400;

/** Dice rolled with Foundry (shown by Dice So Nice through the card's rolls). */
function roller(sink: any[]): (count: number) => Promise<number[]> {
  return async (count: number) => {
    const roll = await new (globalThis as any).Roll(`${count}d6`).evaluate();
    sink.push(roll);
    return (roll.dice ?? []).flatMap((term: any) => term.results.map((r: any) => Number(r.result)));
  };
}
/** Successes of `dice` against `tn` (the Rule of Six as everywhere: rules/dice.ts). */
async function successes(dice: number, tn: number, sink: any[]): Promise<number> {
  const r = await successTest({ dice: whole(dice), targetNumber: tn, roll: roller(sink) });
  return whole(r.successes);
}
/** A 2D6 total. */
async function twoD6(sink: any[]): Promise<number> {
  const faces = await roller(sink)(2);
  return faces.reduce((a, b) => a + (Number(b) || 0), 0);
}

/** On a decker: when each psychotropic effect's next recovery test falls due ([{ key, next }]). */
export const PSY_FLAG = 'psycheRecovery97';
/** On a decker: when the current day of their unsold paydata stock began. */
export const PAYDATA_FLAG = 'paydataSince97';
const DONE_FLAG = 'mxl97Done';

const labelOf = (kind: string): string => (PSYCHOTROPIC_LABELS as Record<string, string>)[kind] ?? kind;
const recovering = (a: any): any[] => [...(a?.system?.matrix?.psyche ?? [])].filter((e: any) => M.recovers(e));

// ================================================================ Psychotropic recovery (VR2 p. 50)

/**
 * The lead GM's clock for a decker's psychotropic effects: each effect that lasts until recovered gets a test every
 * week (every day for Matrix maniac); when tests fall due the GM gets a card to roll them. True when a card went out.
 */
export async function psycheTick(a: any, time: number): Promise<boolean> {
  if (!M.on('psychRecovery')) return false;
  const effects = recovering(a);
  const raw: unknown = a?.getFlag?.(SYSTEM_ID, PSY_FLAG);
  const had: Array<{ key: string; next: number }> = Array.isArray(raw) ? raw.filter((x: any) => x && typeof x.key === 'string') : [];
  if (!effects.length) { if (raw != null) await clearFlag(a, PSY_FLAG); return false; }
  const out: Array<{ key: string; next: number }> = [];
  let carded = false;
  for (const e of effects) {
    const key = M.psycheKey(e);
    if (out.some((x) => x.key === key)) continue;
    const r = M.recoveryDue(String(e.kind ?? ''), had.find((x) => x.key === key)?.next, time);
    out.push({ key, next: r.next });
    if (r.due <= 0) continue;
    carded = true;
    const k = String(e.kind ?? '');
    const hint = k === 'cyberphobia' ? tx('SR2E.MxLife97.Psyche.hintPhobia') : k === 'judas' ? tx('SR2E.MxLife97.Psyche.hintJudas') : k === 'conditioning' ? tx('SR2E.MxLife97.Psyche.hintConditioning') : tx('SR2E.MxLife97.Psyche.hint');
    await post(`<p><em>${tx('SR2E.MxLife97.gmOnly')}</em> ${tx('SR2E.MxLife97.Psyche.due', { name: name(a), label: escHtml(labelOf(k)), icName: escHtml(String(e.icName ?? '')), rating: whole(e.rating), n: r.due })}</p><p class="hint">${hint}</p><p><button type="button" data-sr2e-action="mxl97Recover">${tx('SR2E.MxLife97.Psyche.roll')}</button></p>`,
      { whisper: gmIds(), speaker: speaker(a), flags: { [SYSTEM_ID]: { mxl97Recover: { actorUuid: String(a.uuid ?? ''), key, tests: r.due } } } });
  }
  const same = out.length === had.length && out.every((x) => had.some((h) => h.key === x.key && Number(h.next) === x.next));
  if (!same) await a.setFlag(SYSTEM_ID, PSY_FLAG, out);
  return carded;
}

/**
 * Roll `tests` recovery tests (VR2 p. 50) for the effect `key` on `actor`, with the treatment the GM gave; the first
 * success takes the effect off. False when it can't begin (cyberphobia untreated, a Judas effect not caught) or the
 * effect is gone.
 */
export async function rollRecovery(actor: any, key: string, tests: number, o: { care: M.Care97; spell?: boolean; caught?: boolean }): Promise<boolean> {
  const e = recovering(actor).find((x: any) => M.psycheKey(x) === key);
  if (!e) { warn(tx('SR2E.MxLife97.Psyche.gone')); return false; }
  const kind = String(e.kind ?? '');
  const care: M.Care97 = (M.CARES_97 as readonly string[]).includes(o.care) ? o.care : 'none';
  const why = M.recoveryBlocked({ kind, care, spell: Boolean(o.spell), caught: Boolean(o.caught) });
  if (why) { warnWhy(why); return false; }
  const tn = M.recoveryTn({ rating: whole(e.rating), kind, care, spell: Boolean(o.spell) });
  const dice = whole(actor?.system?.attributes?.willpower?.total);
  const rolls: any[] = [];
  const n = Math.max(1, Math.min(52, whole(tests)));
  const results: number[] = [];
  let won = false;
  for (let i = 0; i < n && !won; i++) { const s = await successes(dice, tn, rolls); results.push(s); won = s > 0; }
  const label = escHtml(labelOf(kind));
  const icName = escHtml(String(e.icName ?? ''));
  const shown = escHtml(results.join(', '));
  if (won) {
    const left = [...(actor.system?.matrix?.psyche ?? [])].filter((x: any) => !(M.recovers(x) && M.psycheKey(x) === key));
    await actor.update({ 'system.matrix.psyche': left });
    const sched: unknown = actor.getFlag?.(SYSTEM_ID, PSY_FLAG);
    if (Array.isArray(sched)) await actor.setFlag(SYSTEM_ID, PSY_FLAG, sched.filter((x: any) => x?.key !== key));
  }
  const line = won ? tx('SR2E.MxLife97.Psyche.recovers', { name: name(actor), label, icName, dice, tn, results: shown }) : tx('SR2E.MxLife97.Psyche.stays', { name: name(actor), label, icName, dice, tn, results: shown });
  await post(`<p>${line}</p>`, { speaker: speaker(actor), rolls });
  return true;
}

/** The GM's choice of treatment for a recovery test (a dialog). */
async function askCare(kind: string): Promise<{ care: M.Care97; spell: boolean; caught: boolean } | null> {
  const D: any = (globalThis as any).foundry?.applications?.api?.DialogV2;
  if (!D?.prompt) return { care: 'none', spell: false, caught: false };
  const options = `<option value="none">${tx('SR2E.MxLife97.Care.none')}</option><option value="medication">${tx('SR2E.MxLife97.Care.medication')}</option><option value="therapy">${tx('SR2E.MxLife97.Care.therapy')}</option>`;
  const caught = kind === 'judas' ? `<div class="form-group"><label>${tx('SR2E.MxLife97.Psyche.caught')}</label><input type="checkbox" name="caught"></div>` : '';
  const r: any = await D.prompt({
    window: { title: tx('SR2E.MxLife97.Psyche.title') },
    content: `<div class="form-group"><label>${tx('SR2E.MxLife97.Psyche.care')}</label><select name="care">${options}</select></div><div class="form-group"><label>${tx('SR2E.MxLife97.Psyche.spell')}</label><input type="checkbox" name="spell"></div>${caught}`,
    ok: { label: tx('SR2E.MxLife97.Psyche.roll'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { care: String(el.care.value), spell: Boolean(el.spell.checked), caught: el.caught ? Boolean(el.caught.checked) : false }; } },
    rejectClose: false,
  });
  return r ? { care: r.care, spell: r.spell, caught: r.caught } : null;
}

// ================================================================ Paydata going stale (VR2 p. 65)

/**
 * The lead GM's clock for a decker's unsold paydata (VR2 p. 65): one Paydata Point goes stale each full day, the
 * oldest first (its file stays, worth nothing). Returns the points lost.
 */
export async function paydataTick(a: any, time: number): Promise<number> {
  if (!M.on('paydataDecay')) return 0;
  const decks: any[] = [...(a?.items ?? [])].filter((i: any) => i?.type === 'cyberdeck');
  const points: Array<{ deck: any; index: number }> = [];
  for (const d of decks) (d.system?.files ?? []).forEach((f: any, index: number) => { if (M.isPaydataPoint(f)) points.push({ deck: d, index }); });
  const raw: unknown = a?.getFlag?.(SYSTEM_ID, PAYDATA_FLAG);
  const since = raw === null || raw === undefined || raw === '' ? null : Number(raw);
  const r = M.paydataStale(points.length, since, time);
  if (r.lost > 0) {
    const gone = points.slice(0, r.lost);
    const names: string[] = [];
    for (const d of decks) {
      const idx = new Set(gone.filter((p) => p.deck === d).map((p) => p.index));
      if (!idx.size) continue;
      const files = [...(d.system?.files ?? [])].map((f: any, i: number) => {
        if (!idx.has(i)) return f;
        names.push(String(f.name ?? ''));
        return { ...f, value: 0, paydata: false };
      });
      await d.update({ 'system.files': files });
    }
    await post(`<p>${tx('SR2E.MxLife97.Paydata.stale', { name: name(a), n: r.lost, files: escHtml(names.join(', ')), left: points.length - r.lost })}</p>`, { whisper: ownerIds(a), speaker: speaker(a) });
  }
  if (r.since === null) { if (raw != null) await clearFlag(a, PAYDATA_FLAG); }
  else if (since !== r.since) await a.setFlag(SYSTEM_ID, PAYDATA_FLAG, r.since);
  return r.lost;
}

/** Every v0.97.0 life tick for one actor (documents/index.ts timedEffects, the lead GM's client). */
export async function lifeTick97(a: any, time: number): Promise<void> {
  try { await psycheTick(a, time); } catch (err) { console.warn('sr2e | psychotropic recovery', err); }
  try { await paydataTick(a, time); } catch (err) { console.warn('sr2e | paydata', err); }
}

// ================================================================ Cook and Installation tasks (VR2 pp. 77, 82–88)

/** The deck-building test's extra context (buildDeckPart): the builder's B/R dice and the deck's MPCP. */
export function cookCtx(o: { dice: number; mpcp: number }): { cook97?: { dice: number; mpcp: number } } {
  return M.on('cookInstall') ? { cook97: { dice: whole(o.dice), mpcp: whole(o.mpcp) } } : {};
}

/** One task's attempts (rolled until done, at most TASK_TRIES_97): its days and a card line. */
async function runTask(dice: number, t: M.DeckTask97, label: string, sink: any[]): Promise<{ days: number; done: boolean; line: string }> {
  const attempts: number[] = [];
  const wastes: number[] = [];
  while (attempts.length < M.TASK_TRIES_97) {
    const s = await successes(dice, t.tn, sink);
    attempts.push(s);
    if (s > 0) break;
    wastes.push(await twoD6(sink));
  }
  const r = M.taskDays(t.base, attempts, wastes);
  const what = label === 'cook' ? tx('SR2E.MxLife97.Cook.cook') : tx('SR2E.MxLife97.Cook.install');
  const line = r.done ? tx('SR2E.MxLife97.Cook.line', { label: what, tn: t.tn, base: t.base, s: attempts[attempts.length - 1] ?? 0, tries: r.tries, days: r.days }) : tx('SR2E.MxLife97.Cook.failed', { label: what, tn: t.tn, base: t.base, tries: r.tries, days: r.days });
  return { days: r.days, done: r.done, line };
}

/**
 * The Cook and Installation tasks of a deck part whose design just succeeded (#resolveCode): rolled once and kept on
 * the card's code context (a Karma re-roll of the design only changes the design's days). Null under 'v965', for a
 * program, or without the context buildDeckPart adds. `ok` false: the dice could not get it done.
 */
export async function cookInstall(c: any): Promise<{ days: number; ok: boolean; text: string } | null> {
  if (!M.on('cookInstall') || c?.mode !== 'deck' || !c.cook97 || typeof c.cook97 !== 'object') return null;
  const kept = c.cook97.rolled;
  if (kept && typeof kept === 'object') return { days: Math.min(100_000, whole(kept.days)), ok: Boolean(kept.ok), text: String(kept.text ?? '').slice(0, 600) };
  const tasks = M.deckTasks(String(c.part ?? ''), whole(c.rating), whole(c.cook97.mpcp) || whole(c.rating));
  if (!tasks) return null;
  const dice = whole(c.cook97.dice);
  const sink: any[] = [];
  const lines: string[] = [];
  let days = 0;
  let ok = true;
  for (const [label, t] of [['cook', tasks.cook], ['install', tasks.install]] as Array<[string, M.DeckTask97 | null]>) {
    if (!t) continue;
    const r = await runTask(dice, t, label, sink);
    days += r.days;
    lines.push(r.line);
    if (!r.done) { ok = false; break; }
  }
  const text = lines.join(' ');
  c.cook97.rolled = { days, ok, text };
  return { days, ok, text };
}

// ================================================================ Otaku (VR2 pp. 144–145; otaku errata)

/** Karma to raise a channel from `from` to `to` as a Willpower-linked active skill (null under 'v965'). */
export function channelCost(actor: any, from: number, to: number): number | null {
  if (!M.on('otakuChannels')) return null;
  const attr = skillBandAttribute('willpower', (actor?.system?.attributes ?? {}) as any, { caller: 'improve' });
  return newSkillCost(from, to) ?? skillCost({ to, attribute: attr, kind: 'active' });
}

/** The otaku's Computer Skill rating (the skill named by RULES.MATRIX.programming.skill). */
function computerRating(actor: any): number {
  return whole(actor?.findSkill?.(RULES.MATRIX.programming.skill)?.system?.rating);
}

/** A refusal key from rules/mxlife97.ts as a warning (literal keys, so the language checks can follow them). */
export function warnWhy(why: string): void {
  if (why === 'SR2E.MxLife97.Why.phobiaUntreated') warn(tx('SR2E.MxLife97.Why.phobiaUntreated'));
  else if (why === 'SR2E.MxLife97.Why.judasUncaught') warn(tx('SR2E.MxLife97.Why.judasUncaught'));
  else if (why === 'SR2E.MxLife97.Why.formOperational') warn(tx('SR2E.MxLife97.Why.formOperational'));
  else if (why === 'SR2E.MxLife97.Why.formHardening') warn(tx('SR2E.MxLife97.Why.formHardening'));
  else if (why === 'SR2E.MxLife97.Why.formAboveComputer') warn(tx('SR2E.MxLife97.Why.formAboveComputer'));
}

/** Why this complex form can't be made (a language key), '' when it can, null under 'v965'. */
export function complexFormRefusal(actor: any, kind: string, rating: number): string | null {
  return M.complexFormRefusal(kind, rating, computerRating(actor));
}

/**
 * The book's programming task for a complex form (VR2 p. 145), from learnComplexForm once the Karma and the approval
 * are settled: the Computer (rating) Test, its days cut by the otaku task bonus; the form is made at once or when a
 * WAITING project's days have passed. Null under 'v965' (the caller makes it at once); false when the design failed
 * (no Karma is spent); true when the form is made or under way (the caller takes the Karma, without its own card).
 */
export async function complexFormTask(actor: any, o: { name: string; kind: string; rating: number; damageLevel: string }): Promise<boolean | null> {
  if (!M.on('complexForms')) return null;
  const sink: any[] = [];
  const plan = M.complexFormTask({ kind: o.kind, rating: o.rating, bonus: 0, successes: 1 });
  const s = await successes(computerRating(actor), plan.tn, sink);
  const at = actor?.system?.attributes ?? {};
  const bonus = M.otakuTaskBonus(Number(at.intelligence?.total ?? 0), Number(at.charisma?.total ?? 0));
  const task = M.complexFormTask({ kind: o.kind, rating: o.rating, bonus, successes: s, waste2d6: s > 0 ? 7 : await twoD6(sink) });
  const form = escHtml(o.name);
  if (!task.done) { await post(`<p>${tx('SR2E.MxLife97.Form.failed', { name: name(actor), form, tn: task.tn, days: task.days, base: task.base })}</p>`, { speaker: speaker(actor), rolls: sink }); return false; }
  const data = { name: o.name, type: 'program', system: { kind: o.kind, rating: o.rating, size: 0, loaded: true, erased: false, damageLevel: o.damageLevel || 'M', complexForm: true } };
  if (actor.waitsFor?.('matrix')) {
    await actor.startProject({ kind: 'code', area: 'matrix', label: tx('SR2E.MxLife97.Form.project', { form: o.name }), hours: task.days * 24, effect: { creates: [data] } });
    await post(`<p>${tx('SR2E.MxLife97.Form.underWay', { name: name(actor), form, size: task.size, base: task.base, tn: task.tn, s, bonus, days: task.days })}</p>`, { speaker: speaker(actor), rolls: sink });
    return true;
  }
  await actor.createEmbeddedDocuments('Item', [data], { sr2eComplexForm: true });
  await post(`<p>${tx('SR2E.MxLife97.Form.done', { name: name(actor), form, size: task.size, base: task.base, tn: task.tn, s, bonus, days: task.days })}</p>`, { speaker: speaker(actor), rolls: sink });
  return true;
}

/**
 * The persona Armor that soaks a hit (resistMatrixDamage): for a living persona, the free Armor equal to Willpower
 * when no loaded Armor rates higher (VR2 p. 145). It has no program, so it never wears down.
 */
export function livingArmor<T extends { programId: string; name: string; rating: number; kind: 'armor' | 'shield' }>(actor: any, soaked: T | null): T | { programId: string; name: string; rating: number; kind: 'armor' } | null {
  if (actor?.type === 'ic') return soaked;
  const r = M.livingArmor({ living: Boolean(actor?.system?.derived?.matrix?.living), willpower: Number(actor?.system?.attributes?.willpower?.total ?? 0), loaded: soaked?.rating ?? 0 });
  if (!r || !r.free || r.rating <= 0) return soaked;
  return { programId: '', name: tx('SR2E.MxLife97.Otaku.armor'), rating: r.rating, kind: 'armor' };
}

// ================================================================ IC on the Matrix scene (table convenience)

/** The scene the GM is viewing. */
function viewedScene(): any {
  return G()?.scenes?.viewed ?? (globalThis as any).canvas?.scene ?? null;
}

/**
 * A host just launched `ic` (SR2Actor.launchIc, the GM's client): when the host's token stands on the scene the GM is
 * viewing (a Matrix scene), the IC gets a token beside it, hidden until the GM shows it. Null when nothing was placed.
 */
export async function placeIcToken(host: any, ic: any): Promise<any | null> {
  if (!M.icTokenOn() || !isGm() || !host || !ic?.getTokenDocument) return null;
  const scene = viewedScene();
  const coll: any = scene?.tokens;
  const tokens: any[] = coll?.contents ?? (coll && typeof coll[Symbol.iterator] === 'function' ? [...coll] : []);
  const hostTok = tokens.find((t: any) => t?.actor?.uuid === host.uuid || (t?.actorId && t.actorId === host.id && t.actorLink !== false));
  if (!hostTok) return null;
  const already = tokens.filter((t: any) => t?.actor?.type === 'ic' && t.actor?.system?.hostUuid === host.uuid).length;
  const at = storedXY(hostTok);
  const spot = M.icSpot(at.x, at.y, Number(scene?.grid?.size ?? 100), already);
  try {
    const td = (await ic.getTokenDocument({ x: spot.x, y: spot.y })).toObject();
    const [made] = (await scene.createEmbeddedDocuments('Token', [{ ...td, x: spot.x, y: spot.y, hidden: true }])) ?? [];
    return made ?? null;
  } catch (err) { console.warn('sr2e | IC token', err); return null; }
}

// ================================================================ Card buttons

/** A button on a MXLIFE_V97 card (chat.ts routes every `mxl97…` action here). */
export async function onCard(message: any, button: HTMLButtonElement, action: string): Promise<void> {
  if (action !== 'mxl97Recover') return;
  if (!isGm()) { warn(tx('SR2E.MxLife97.gmButton')); return; }
  if (!authorIsGm(message)) return;
  if (message?.getFlag?.(SYSTEM_ID, DONE_FLAG)) { warn(tx('SR2E.MxLife97.alreadyDone')); return; }
  const d: any = message?.flags?.[SYSTEM_ID]?.mxl97Recover;
  if (!d || !uuidOk(d.actorUuid) || typeof d.key !== 'string') return;
  const actor: any = await (globalThis as any).fromUuid(d.actorUuid);
  if (!actor) return;
  const e = recovering(actor).find((x: any) => M.psycheKey(x) === d.key);
  if (!e) { warn(tx('SR2E.MxLife97.Psyche.gone')); return; }
  const choice = await askCare(String(e.kind ?? ''));
  if (!choice) return;
  button.disabled = true;
  if (await rollRecovery(actor, d.key, whole(d.tests) || 1, choice)) await message.setFlag?.(SYSTEM_ID, DONE_FLAG, true);
  else button.disabled = false;
}

// ================================================================ The character sheet's otaku dialogs

/** The highest complex form rating the Learn dialog offers: the Computer Skill (book), null under 'v965' (MPCP). */
export function complexFormCap(actor: any): number | null {
  return M.on('complexForms') ? computerRating(actor) : null;
}

/** The utility kinds the Learn dialog offers: without the operational ones (book). */
export function complexFormKinds<T extends string>(kinds: readonly T[]): T[] {
  return M.on('complexForms') ? kinds.filter((k) => !M.OPERATIONAL_97.includes(k)) : [...kinds];
}
