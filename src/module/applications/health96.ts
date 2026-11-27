/**
 * v0.96.0 rules completeness, damage, health and hazards: the Foundry glue for RULES.HEALTH_V96 (pure logic:
 * rules/health96.ts). The rest in progress and the rest card's lines, the medical fees, slap patches and implants,
 * the stim patch's Magic test, the antidote as professional attention, the addiction leftovers on the world clock,
 * DocWagon's response time and neuro-stun's disorientation. documents/index.ts calls these from its existing paths.
 *
 * Security: a card button reads the card's flags only as bounded numbers and uuids; a player's Pay needs a GM-posted
 * card and pays once per card; a GM's change from a player-posted card goes through gmMay.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES } from '../rules/config.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';
import { clearFlag, replaceFlag, dropFlagKeys } from '../helpers/flags.ts';
import { sysNow } from '../helpers/clock.ts';
import { successTest } from '../rules/dice.ts';
import { careCost } from '../rules/hazards.ts';
import { homeCareLifestyle } from '../rules/remnants.ts';
import { describeSpan } from '../rules/gmtools.ts';
import { doseIntervalHours, magicLossUntreatedTests } from '../rules/health923.ts';
import { recoveringItemIds } from '../rules/implants.ts';
import { authorIsGm, gmMay } from './trust.ts';
import * as H from '../rules/health96.ts';

const G = (): any => game as any;
const isGm = (): boolean => Boolean(G().user?.isGM);
const warn = (text: string): void => { (globalThis as any).ui?.notifications?.warn?.(text); };
const int = (v: unknown, min: number, max: number, d = min): number => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
const gmIds = (): string[] => [...(G().users ?? [])].filter((u: any) => u.isGM).map((u: any) => String(u.id));
const speaker = (actor: any): any => (globalThis as any).ChatMessage?.getSpeaker?.({ actor }) ?? {};
const post = (content: string, extra: Record<string, unknown> = {}): Promise<any> => (globalThis as any).ChatMessage.create({ content, ...extra });
const uuidOk = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 400;

export const STUN_REST_FLAG = 'stunRest96';
export const STIM_FLAG = 'stim96';
const PAID_FLAG = 'paid96';
const DONE_FLAG = 'h96Done';

/** Dice rolled with Foundry (shown by Dice So Nice through the card's rolls). */
function roller(sink: any[]): (count: number) => Promise<number[]> {
  return async (count: number) => {
    const roll = await new (globalThis as any).Roll(`${count}d6`).evaluate();
    sink.push(roll);
    return (roll.dice ?? []).flatMap((term: any) => term.results.map((r: any) => Number(r.result)));
  };
}
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

// ================================================================ Interrupted Stun rest (Core p. 112)

/** The heal context's extra keys for a Stun rest: the kept first roll (a re-test), or the mark of a first roll. */
export function stunRestContext(actor: any): { stunCap96?: number; stunFirst96?: boolean } {
  if (!H.stunRestOn()) return {};
  const kept = H.stunRestKept(actor?.getFlag?.(SYSTEM_ID, STUN_REST_FLAG));
  return kept == null ? { stunFirst96: true } : { stunCap96: kept };
}

/** After a Stun rest card applies: keep the first roll while the track isn't clear, forget it when it is. */
export async function afterStunRest(patient: any, h: { stunFirst96?: boolean; stunCap96?: number }, successes: number, after: number): Promise<void> {
  if (!patient || (!h.stunFirst96 && h.stunCap96 == null)) return;
  const next = H.stunRestNext({ first: Boolean(h.stunFirst96), successes, after });
  if (next.clear) { if (patient.getFlag?.(SYSTEM_ID, STUN_REST_FLAG) != null) await clearFlag(patient, STUN_REST_FLAG); }
  else if (next.set) await patient.setFlag?.(SYSTEM_ID, STUN_REST_FLAG, next.set);
}

// ================================================================ The rest card's lines and costs (Core p. 113)

/** The DocWagon tier whose contract is paid up (for its extended care discount), or null. */
export function docwagonTierOf(actor: any): string | null {
  try { const st = actor?.docwagonState?.(); return st?.active && st.tier ? String(st.tier) : null; } catch { return null; }
}

const lifestyleLabel = (id: string): string => id === 'hospital' ? tx('SR2E.Health96.Rest.hospitalized') : String(RULES.UPKEEP.lifestyles.find((l) => l.id === id)?.label ?? id);

/** Plain text for the rest card's title: the lifestyle short of the minimum (Physical), or the re-test's cap (Stun). */
export function restNote(actor: any, o: { care: string; track: string; before: number; cap?: number }): string {
  const parts: string[] = [];
  if (o.track === 'physical') {
    let days: number | null = null;
    try { days = actor?.lifestyleStatus?.().days ?? null; } catch { days = null; }
    const own = homeCareLifestyle(String(actor?.system?.lifestyle?.level ?? 'low'), days);
    const need = H.lifestyleShort(o.before, o.care, own);
    if (need) parts.push(tx('SR2E.Health96.Rest.lifestyleShort', { need: lifestyleLabel(need), own: lifestyleLabel(H.restLifestyle(o.care, own)) }));
  }
  if (o.track === 'stun' && o.cap != null) parts.push(tx('SR2E.Health96.Rest.interrupted', { cap: int(o.cap, 0, 40) }));
  return parts.length ? ` ${parts.join(' ')}` : '';
}

/** What a rest costs by the Medical Costs Table and DocWagon's extended care; null = the v0.95.1 care cost. */
export function restCost(actor: any, o: { care: string; hours: number; track: string; before: number }): number | null {
  const tier = docwagonTierOf(actor);
  if (o.track === 'physical') {
    const book = H.restCareCost({ care: o.care, hours: o.hours, boxes: o.before, tier });
    if (book != null) return book;
  }
  return H.extendedCareDiscount(tier) > 0 ? H.discounted(careCost(o.care, o.hours), tier) : null;
}

/** A day of this care for the actor's Physical wound, as the Rest dialog shows it (the discount taken off); null = off. */
export function careDay(actor: any, care: string): number | null {
  const d = H.careDayCost(care, Number(actor?.system?.monitor?.physical ?? 0));
  return d == null ? null : H.discounted(d, docwagonTierOf(actor));
}

/** Whether a working implant of this bioware kind is in (as the derived data reads bioware: not still healing in). */
export function bioOn(actor: any, kind: string): boolean {
  let healing: string[] = [];
  try { healing = recoveringItemIds(actor?.system?.recovering ?? [], sysNow()); } catch { healing = []; }
  return H.hasBio(actor?.items ?? [], kind, healing);
}

/** First aid by an NPC (a paramedic) on a player's character: the fee card with a Pay button (Medical Costs Table). */
export async function paramedicFee(healer: any, patient: any, before: number): Promise<void> {
  if (!H.medicalCostsOn() || healer?.type !== 'npc' || !patient?.hasPlayerOwner || healer === patient) return;
  const fee = H.discounted(H.paramedicFee(before), docwagonTierOf(patient));
  if (fee <= 0) return;
  await post(`<p>${tx('SR2E.Health96.Fee.paramedic', { healer: escHtml(String(healer.name ?? '')), patient: escHtml(String(patient.name ?? '')), fee })}</p><p><button type="button" data-sr2e-action="h96PayFee">${tx('SR2E.Health96.Fee.pay', { fee })}</button></p>`,
    { speaker: speaker(healer), flags: { [SYSTEM_ID]: { h96Fee: { actorUuid: String(patient.uuid), fee } } } });
}

// ================================================================ Slap patches (Core pp. 186, 250; Awakenings p. 99)

/** After a patch's effect: the antidote's GM button on a dying patient, the stim patch's Magic test. Returns card text. */
export async function patchAfter(target: any, kind: string, rating: number, sourceUuid = ''): Promise<string> {
  if (kind === 'antidote' && H.antidoteAttentionDue(String(target?.system?.derived?.status ?? ''), Boolean(target?.system?.care?.stabilised))) {
    await post(`<p><em>${tx('SR2E.Health96.gmOnly')}</em> ${tx('SR2E.Health96.Patch.antidoteProfessional', { name: escHtml(String(target.name ?? '')) })}</p><p><button type="button" data-sr2e-action="h96Professional">${tx('SR2E.Health96.Patch.professional')}</button></p>`,
      { whisper: gmIds(), flags: { [SYSTEM_ID]: { h96Antidote: { targetUuid: String(target.uuid), sourceUuid: String(sourceUuid ?? '') } } } });
    return ` ${tx('SR2E.Health96.Patch.antidoteProfessionalNote')}`;
  }
  if (kind !== 'stim' || !(Number(target?.system?.magic ?? 0) > 0) || target?.type === 'spirit') return '';
  const test = H.stimMagicTest(rating, stimHistory(target), sysNow());
  if (!test) return '';
  if (RULES.HEALTH_V96.stimMagic === 'awakenings') await target.setFlag?.(SYSTEM_ID, STIM_FLAG, { list: test.history });
  const rolls: any[] = [];
  const magic = Math.max(0, Math.floor(Number(target.system?.derived?.magic ?? target.system?.magic ?? 0)));
  const r = await successTest({ dice: magic, targetNumber: test.tn, modifiers: [], roll: roller(rolls) });
  const ok = r.successes > 0;
  const lossDue = !ok && Boolean(RULES.MAGIC_LOSS.enabled);
  // As a Deadly wound: twice under RULES.HEALTH_V923.magicLossUntreated 'test' (Core p. 115).
  const lossButton = lossDue ? magicLossButtons() : '';
  await post(`<p><strong>${escHtml(String(target.name ?? ''))}</strong> ${ok ? tx('SR2E.Health96.Patch.stimMagicOk', { magic, tn: Number(r.targetNumber) || test.tn, successes: r.successes }) : tx('SR2E.Health96.Patch.stimMagicFail', { magic, tn: Number(r.targetNumber) || test.tn })}</p>${lossButton}`,
    { speaker: speaker(target), rolls, ...(lossDue ? { flags: { [SYSTEM_ID]: { magicLossFor: String(target.uuid) } } } : {}) });
  return '';
}

/** The Magic loss buttons for a Deadly wound: twice under RULES.HEALTH_V923.magicLossUntreated 'test' (Core p. 115). */
const magicLossButtons = (): string => [...Array(Math.max(1, Math.min(4, magicLossUntreatedTests(true))))].map(() => `<p><button type="button" data-sr2e-action="magicLoss">${tx('SR2E.Health96.Patch.magicLoss')}</button></p>`).join('');

/** The stored stim history (the flag holds `{ list }`). */
export const stimHistory = (actor: any): unknown => (actor?.getFlag?.(SYSTEM_ID, STIM_FLAG) as any)?.list;

// ================================================================ Neuro-stun (Core p. 186)

/** An exposure to neuro-stun: disoriented for an hour (+2 to every TN), resisted or not. */
export async function neuroStun(actor: any, name: string): Promise<boolean> {
  const fx = H.neuroStunEffect(name);
  if (!fx || !actor?.uuid) return false;
  const cls: any = (globalThis as any).CONFIG?.Actor?.documentClass;
  if (typeof cls?.setPowerEffect !== 'function') return false;
  const until = { round: null, worldTime: sysNow() + fx.seconds, combatId: null };
  await cls.setPowerEffect(String(actor.uuid), { id: 'neuroStun96', fromUuid: '', fromName: String(name).slice(0, 120), name: tx('SR2E.Health96.Neuro.name'), attributes: {}, testsTn: fx.tn, until });
  await post(`<p><strong>${escHtml(String(actor.name ?? ''))}</strong> ${tx('SR2E.Health96.Neuro.note', { tn: fx.tn, span: escHtml(describeSpan(fx.seconds)) })}</p>`, { speaker: speaker(actor) });
  return true;
}

// ================================================================ DocWagon (Neo-Anarchist's Guide p. 95)

/** The response: 1D6 for the unit, 3D6 minutes (−2 by air), at least 4. Null when off (the contract's minutes). */
export async function docwagonResponse(htr = false): Promise<{ seconds: number; note: string; rolls: any[] } | null> {
  if (!H.docwagonResponseOn()) return null;
  const rolls: any[] = [];
  const unit = await roller(rolls)(1);
  const air = H.docwagonAir(unit[0] ?? 1, htr);
  const three = sum(await roller(rolls)(3));
  const minutes = H.docwagonMinutes(three, air, 0, htr);
  return { seconds: minutes * 60, rolls, note: air ? tx('SR2E.Health96.DocWagon.air', { unit: unit[0] ?? 1, roll: three, minutes }) : tx('SR2E.Health96.DocWagon.ground', { unit: unit[0] ?? 1, roll: three, minutes }) };
}

// ================================================================ Addiction (Shadowtech pp. 87–88)

/**
 * The addiction tests when a dose wears off (rolled at the dose by the v0.95.1 way): one round per dose the entry
 * merged (RULES.HEALTH_V72.drugs 'refresh' / 'extend' count them), until the character is addicted or immune.
 */
export async function afterWearOff(actor: any, drug: string, doses = 1): Promise<void> {
  if (!H.testsAtWearOff() || !RULES.HEALTH.addiction.auto || typeof actor?.drugAddictionTest !== 'function') return;
  const n = int(doses, 1, 10, 1);
  for (let i = 0; i < n; i++) {
    const a: any = (actor.system?.addictions ?? []).find((x: any) => x.drug === drug);
    if (!a) return;
    if (!a.addicted) await actor.drugAddictionTest(drug, 'dose');
    const b: any = (actor.system?.addictions ?? []).find((x: any) => x.drug === drug) ?? a;
    if (RULES.HEALTH_V923.addiction === 'book' && Number(b.tolerance) > 0 && !b.immune) await actor.drugAddictionTest(drug, 'tolerance');
    const c: any = (actor.system?.addictions ?? []).find((x: any) => x.drug === drug) ?? b;
    if (c.addicted && (c.immune || !(Number(c.tolerance) > 0))) return;
  }
}

/**
 * The world clock for an actor's addictions (the GM's client): forced withdrawal's start (its 24-hour fall), the rest
 * after a recovery and its end, and the weekly attrition card. Changes `ad` in place; true when it changed.
 */
export async function addictionTick(a: any, ad: any[], time: number): Promise<boolean> {
  let changed = false;
  const who = { body: Number(a?.system?.attributes?.body?.total ?? 0), willpower: Number(a?.system?.attributes?.willpower?.total ?? 0) };
  for (const x of ad) {
    // Forced withdrawal's start, for the 24-hour fall (Shadowtech p. 88).
    if (RULES.HEALTH_V96.addictionFall === 'book' && x.addicted && !(Number(x.recovering) >= 0)) {
      const at = Number(x.lastDose ?? 0) + doseIntervalHours(String(x.type ?? 'mental'), who) * 3600;
      if (Number(x.withdrawalAt96) !== at) { x.withdrawalAt96 = at; changed = true; }
    }
    // The rest after a recovery is over: cured.
    if (H.restOver(x, time)) {
      x.restUntil96 = 0; changed = true;
      await post(`<p><strong>${escHtml(String(a.name ?? ''))}</strong> ${tx('SR2E.Health96.Addiction.restDone', { drug: escHtml(String(x.drug ?? '')) })}</p>`, { speaker: speaker(a) });
    }
    // The weekly loss (Shadowtech p. 87).
    const step = H.attritionStep(x, time);
    if (step.next != null && Number(x.attritionAt96) !== step.next) { x.attritionAt96 = step.next; changed = true; }
    if (!step.due) continue;
    const essence = Math.max(0, Number(RULES.HEALTH_V96.addictionAttritionEssence) || 0);
    await post(`<p><em>${tx('SR2E.Health96.gmOnly')}</em> ${tx('SR2E.Health96.Addiction.attrition', { name: escHtml(String(a.name ?? '')), drug: escHtml(String(x.drug ?? '')), essence })}</p><p><button type="button" data-sr2e-action="h96Attrition">${tx('SR2E.Health96.Addiction.apply', { essence })}</button></p>`,
      { whisper: gmIds(), flags: { [SYSTEM_ID]: { h96Attrition: { actorUuid: String(a.uuid), drug: String(x.drug ?? '').slice(0, 120) } } } });
  }
  return changed;
}

/** A recovery that ends now starts the rest (the drug's base rating in days); the note for the cure card. */
export function startRest(x: any, time: number): string {
  const until = H.restUntil(time, Number(x?.rating ?? 0));
  if (until == null || !(until > time)) return '';
  x.restUntil96 = until;
  return ` ${tx('SR2E.Health96.Addiction.rest', { days: Math.round((until - time) / 86400) })}`;
}

// ================================================================ Card buttons

/** Cards being paid on this client (a double click, or the chat log and pop-up copies, must not pay twice). */
const paying = new Set<string>();
/** Paid cards kept per actor (the player can't mark the GM's card; an older card paid again only costs its payer). */
const PAID_KEEP = 200;

async function payOnce(message: any, actor: any, amount: number): Promise<boolean> {
  if (!authorIsGm(message)) { warn(tx('SR2E.Health96.notGmCard')); return false; }
  if (!actor?.isOwner) { warn(tx('SR2E.Health96.notYours')); return false; }
  const id = String(message?.id ?? '');
  const paid: Record<string, unknown> = { ...((actor.getFlag?.(SYSTEM_ID, PAID_FLAG) as Record<string, unknown> | undefined) ?? {}) };
  if (!id || paid[id] || paying.has(id)) { warn(tx('SR2E.Health96.alreadyPaid')); return false; }
  paying.add(id);
  try {
    const n = int(amount, 0, 100_000_000);
    if (n > 0 && !(await actor.adjustNuyen(-n, tx('SR2E.Health96.Fee.ledger')))) return false;
    paid[id] = Date.now();
    const keep = Object.entries(paid).sort((x, y) => Number(y[1]) - Number(x[1])).slice(0, PAID_KEEP);
    await replaceFlag(actor, PAID_FLAG, Object.fromEntries(keep));
    await post(`<p>${tx('SR2E.Health96.Fee.paid', { name: escHtml(String(actor.name ?? '')), n })}</p>`, { speaker: speaker(actor) });
    return true;
  } finally { paying.delete(id); }
}

/** A button on a HEALTH_V96 card. */
export async function onCard(message: any, button: HTMLButtonElement, action: string): Promise<void> {
  const flags: any = message?.flags?.[SYSTEM_ID] ?? {};
  const actorOf = async (uuid: unknown): Promise<any> => (uuidOk(uuid) ? (globalThis as any).fromUuid(uuid) : null);
  if (action === 'h96PayFee') {
    const d = flags.h96Fee;
    const actor = await actorOf(d?.actorUuid);
    if (!actor) return;
    button.disabled = true;
    if (!(await payOnce(message, actor, int(d?.fee, 0, 100_000)))) button.disabled = false;
    return;
  }
  if (!isGm()) { warn(tx('SR2E.Health96.gmButton')); return; }
  if (message?.getFlag?.(SYSTEM_ID, DONE_FLAG)) { warn(tx('SR2E.Health96.alreadyDone')); return; }
  if (action === 'h96Professional') {
    // Core pp. 186, 115: the antidote is professional help: another Biotech test (first aid is open again for the
    // wound), and when it fails the patient's own Body test follows as after any first aid.
    const d = flags.h96Antidote;
    const target = await actorOf(d?.targetUuid);
    if (!target) return;
    if (!(await gmMay(message, { title: tx('SR2E.Health96.Patch.professional'), lines: [tx('SR2E.Health96.Patch.antidoteProfessional', { name: String(target.name ?? '') })], target: String(target.uuid), sources: uuidOk(d?.sourceUuid) ? [d.sourceUuid] : [] }))) return;
    button.disabled = true;
    await message.setFlag?.(SYSTEM_ID, DONE_FLAG, true);
    for (const f of ['firstAidAt', 'firstAidBy']) if ((target.getFlag?.(SYSTEM_ID, f) as any)?.physical != null) await dropFlagKeys(target, f, ['physical']);
    await post(`<p><strong>${escHtml(String(target.name ?? ''))}</strong> ${tx('SR2E.Health96.Patch.professionalOpen')}</p>`, { speaker: speaker(target) });
    return;
  }
  if (action === 'h96Attrition') {
    const d = flags.h96Attrition;
    if (!authorIsGm(message)) return;
    const actor = await actorOf(d?.actorUuid);
    if (!actor) return;
    button.disabled = true;
    await message.setFlag?.(SYSTEM_ID, DONE_FLAG, true);
    const loss = Math.max(0, Math.min(6, Number(RULES.HEALTH_V96.addictionAttritionEssence) || 0));
    await actor.update({ 'system.essenceShift': Math.round(((Number(actor.system?.essenceShift) || 0) - loss) * 100) / 100 });
    await post(`<p><strong>${escHtml(String(actor.name ?? ''))}</strong> ${tx('SR2E.Health96.Addiction.applied', { essence: loss })}</p>`, { speaker: speaker(actor) });
  }
}

/** The span text of a healing spell's time (for a card line). */
export const spanText = (seconds: number): string => describeSpan(Math.max(0, Number(seconds) || 0));
