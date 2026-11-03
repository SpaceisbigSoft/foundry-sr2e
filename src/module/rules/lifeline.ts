import { RULES } from './config.ts';
import { toxinSpeed } from './hazards.ts';
import { EFFECT_NUMBER_KEYS, emptyBundle, type EffectBundle } from './effects.ts';
import { t as tx, tCount, tNoun, tKey } from '../helpers/i18n.ts';

/**
 * Lifeline rules (v0.61.0): DocWagon contracts, toxin onset timed by Speed, drug effects beyond
 * attributes, immunity to fire damage and drugs, and where a heal on someone else's patient goes.
 * Values in RULES.HEALTH_V61 (VERIFY). Pure rules; no Foundry.
 */

const C = () => RULES.HEALTH_V61;

/** A finite number or 0. */
const num = (n: unknown): number => (Number.isFinite(Number(n)) ? Number(n) : 0);
/** Strip float noise (0.30000000000000004 → 0.3). */
const clean = (n: number): number => Number(n.toFixed(10));
/** A signed number with a real minus sign: +1 / −2. */
const signed = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

// ---------------------------------------------------------------- DocWagon

/** v0.61.0: one DocWagon contract tier (RULES.HEALTH_V61.docwagon.tiers). */
export type DocWagonTier = (typeof RULES.HEALTH_V61.docwagon.tiers)[number];

/** v0.61.0: the DocWagon tier with this id, or null (unknown id, or DocWagon switched off). */
export function docwagonTier(id: string): DocWagonTier | null {
  const d = C().docwagon;
  if (!d.enabled) return null;
  return d.tiers.find((t) => t.id === String(id ?? '')) ?? null;
}

/** v0.61.0: whether a contract is paid up at world time `now` (`paidUntil` in world seconds; 0 = never paid), and a short label. */
export function docwagonStatus(o: { tier: string; paidUntil: number; now: number }): { active: boolean; secondsLeft: number; label: string } {
  if (!C().docwagon.enabled) return { active: false, secondsLeft: 0, label: tx('SR2E.Text.Lifeline.docwagonOff') };
  const t = docwagonTier(o?.tier);
  if (!t) return { active: false, secondsLeft: 0, label: tx('SR2E.Text.Lifeline.noDocwagonContract') };
  const paid = num(o.paidUntil);
  const left = paid > 0 ? Math.max(0, paid - num(o.now)) : 0;
  if (left <= 0) return { active: false, secondsLeft: 0, label: paid > 0 ? tx('SR2E.Text.Lifeline.docwagonLapsed', { tier: t.label }) : tx('SR2E.Text.Lifeline.docwagonNotPaid', { tier: t.label }) };
  const days = Math.ceil(left / 86400);
  return { active: true, secondsLeft: left, label: tCount(days, 'SR2E.Text.Lifeline.docwagonDaysLeft', { tier: t.label }) };
}

/** v0.61.0: pay for whole `years` of a contract: the cost and the new paid-until (extended from the later of `paidUntil` and `now`). Unknown tier or no years: free, unchanged. */
export function docwagonPay(o: { tier: string; years: number; paidUntil: number; now: number }): { cost: number; paidUntil: number } {
  const t = docwagonTier(o?.tier);
  const years = Math.max(0, Math.floor(num(o?.years)));
  const paid = num(o?.paidUntil);
  if (!t || !years) return { cost: 0, paidUntil: paid };
  const from = Math.max(paid, num(o.now));
  return { cost: Math.max(0, num(t.yearlyFee)) * years, paidUntil: from + years * Math.max(0, num(C().docwagon.yearSeconds)) };
}

/**
 * v0.61.0: what happens when DocWagon is called: whether a crew comes (not when the contract is
 * inactive or the tier unknown), how long it takes, whether a High Threat Response team is sent
 * (hostile area and the tier has HTR; otherwise a note that the crew won't go into a firefight),
 * and the fees (HTR when not included; resuscitation when dead and no free one is left this year;
 * `employeesKilled` × employeeDeathFee). Statuses other than 'dying' / 'dead' count as wounded.
 */
export function docwagonCall(o: { tier: string; active: boolean; status: 'wounded' | 'dying' | 'dead' | string; hostile: boolean; resuscitationsUsed: number; employeesKilled?: number }): { responds: boolean; responseSeconds: number; htr: boolean; fees: Array<{ label: string; amount: number }>; total: number; notes: string[] } {
  const none = (note: string) => ({ responds: false, responseSeconds: 0, htr: false, fees: [], total: 0, notes: [note] });
  const t = docwagonTier(o?.tier);
  if (!t) return none(C().docwagon.enabled ? tx('SR2E.Text.Lifeline.noDocwagonContractDot') : tx('SR2E.Text.Lifeline.docwagonIsOff'));
  if (!o.active) return none(tx('SR2E.Text.Lifeline.contractNotPaidUp', { tier: t.label }));
  const fees: Array<{ label: string; amount: number }> = [];
  const notes: string[] = [];
  let htr = false;
  if (o.hostile) {
    if (t.htrAvailable) {
      htr = true;
      if (!t.htrIncluded && num(t.htrFee) > 0) fees.push({ label: tx('SR2E.Text.Lifeline.highThreatResponse'), amount: num(t.htrFee) });
      notes.push(tx('SR2E.Text.Lifeline.htrTeamSent'));
    } else notes.push(tx('SR2E.Text.Lifeline.noHtr', { tier: t.label }));
  }
  if (o.status === 'dead') {
    const used = Math.max(0, Math.floor(num(o.resuscitationsUsed)));
    const free = Math.max(0, Math.floor(num(t.freeResuscitations)));
    if (used < free) notes.push(tx('SR2E.Text.Lifeline.freeResuscitation', { n: used + 1, free }));
    else if (num(t.resuscitationFee) > 0) fees.push({ label: tx('SR2E.Text.Lifeline.resuscitation'), amount: num(t.resuscitationFee) });
  }
  const killed = Math.max(0, Math.floor(num(o.employeesKilled)));
  if (killed) fees.push({ label: killed === 1 ? tx('SR2E.Text.Lifeline.employeeDeath') : tx('SR2E.Text.Lifeline.employeeDeaths', { count: killed }), amount: killed * Math.max(0, num(C().docwagon.employeeDeathFee)) });
  return { responds: true, responseSeconds: Math.max(0, num(t.responseMinutes)) * 60, htr, fees, total: fees.reduce((s, f) => s + f.amount, 0), notes };
}

/** v0.61.0: the world time a crew called at `calledAt` arrives. */
export function docwagonArrivalAt(calledAt: number, responseSeconds: number): number {
  return num(calledAt) + Math.max(0, num(responseSeconds));
}

/** How bad a status is for calling DocWagon (unknown = 0, like 'ok'). */
const SEVERITY: Record<string, number> = { ok: 0, wounded: 0, unconscious: 1, dying: 2, deadlyWound: 2, dead: 3 };

/** v0.61.0: whether a status change calls DocWagon by itself: entering RULES.HEALTH_V61.docwagon.callOn (or worse, e.g. straight to 'dead') from a lesser status. */
export function docwagonShouldCall(prevStatus: string, status: string): boolean {
  if (!C().docwagon.enabled) return false;
  const at = SEVERITY[C().docwagon.callOn] ?? 2;
  const before = SEVERITY[String(prevStatus ?? '')] ?? 0;
  const now = SEVERITY[String(status ?? '')] ?? 0;
  return now >= at && before < at;
}

// ---------------------------------------------------------------- Toxin onset

/** v0.61.0: how long a remaining time reads: "takes effect now" / "takes effect in 2 Combat Turns" / "… in 10 minutes" / hours / days. `seconds` ≤ 0 (immediate) is always "now". */
export function toxinOnsetLabel(seconds: number, worldTimeNow: number, at: number): string {
  const left = num(seconds) <= 0 ? 0 : num(at) - num(worldTimeNow);
  if (left <= 0) return tx('SR2E.Text.Lifeline.takesEffectNow');
  const per = Math.max(1, num(RULES.TOXINS.secondsPerTurn));
  if (left < 60) return tx('SR2E.Text.Lifeline.takesEffectIn', { span: tNoun(Math.ceil(left / per), 'combat turn') });
  if (left < 3600) return tx('SR2E.Text.Lifeline.takesEffectIn', { span: tNoun(Math.ceil(left / 60), 'minute') });
  if (left < 86400) return tx('SR2E.Text.Lifeline.takesEffectIn', { span: tNoun(Math.ceil(left / 3600), 'hour') });
  return tx('SR2E.Text.Lifeline.takesEffectIn', { span: tNoun(Math.ceil(left / 86400), 'day') });
}

/**
 * v0.61.0: when a toxin of this Speed (RULES.TOXINS.speeds) takes effect: the world time `at` and
 * the same delay in Combat Turns. World time is the one clock (it advances
 * RULES.TOXINS.secondsPerTurn per Combat Turn in combat), so `round` is accepted but not needed.
 * Unknown speed = immediate; onset switched off = immediate.
 */
export function toxinOnset(o: { speed: string; worldTime: number; round?: number | null }): { immediate: boolean; seconds: number; at: number; rounds: number; label: string } {
  const now = num(o?.worldTime);
  const seconds = C().onset.enabled ? Math.max(0, num(toxinSpeed(String(o?.speed ?? '')).seconds)) : 0;
  const per = Math.max(1, num(RULES.TOXINS.secondsPerTurn));
  const at = now + seconds;
  return { immediate: seconds <= 0, seconds, at, rounds: seconds > 0 ? Math.ceil(seconds / per) : 0, label: toxinOnsetLabel(seconds, now, at) };
}

/** v0.61.0: whether a pending onset is due at this world time (immediate ones always are). */
export function toxinOnsetDue(o: { at: number; immediate?: boolean }, now: { worldTime: number }): boolean {
  if (!o || o.immediate) return true;
  return num(now?.worldTime) >= num(o.at);
}

// ---------------------------------------------------------------- Drug effects

/** v0.61.0: what a drug carries beyond its attribute bonuses: an EffectBundle plus the drug-only extras. */
export interface DrugBundle extends EffectBundle {
  /** Ignore wound modifiers (like a pain editor). */
  ignoreWounds: boolean;
  /** Stun boxes that don't count for wound modifiers. */
  stunIgnoreBoxes: number;
}

const ATTRIBUTE_KEYS = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'] as const;

/**
 * v0.61.0: a drug's effect bundle from raw item data: only keys listed in
 * RULES.HEALTH_V61.drugs.effectKeys / extras are kept, numbers sanitised (bad = 0; movementFactor
 * bad or ≤ 0 = 1), unknown keys dropped. EffectBundle-compatible (attributes {} and reaction /
 * initiativeDice 0 unless effectKeys lists them, so the drug's own bonuses aren't counted twice).
 */
export function drugEffectBundle(raw: unknown): DrugBundle {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const keys = C().drugs.effectKeys;
  const extras = C().drugs.extras;
  const b: DrugBundle = { ...emptyBundle(), ignoreWounds: false, stunIgnoreBoxes: 0 };
  for (const k of EFFECT_NUMBER_KEYS) if (keys.includes(k)) b[k] = Math.trunc(num(r[k]));
  if (keys.includes('movementFactor')) {
    const m = num(r.movementFactor);
    b.movementFactor = m > 0 ? clean(m) : 1;
  }
  if (keys.includes('attributes') && r.attributes && typeof r.attributes === 'object') {
    const a = r.attributes as Record<string, unknown>;
    for (const k of ATTRIBUTE_KEYS) { const v = Math.trunc(num(a[k])); if (v) b.attributes[k] = v; }
  }
  if (extras.includes('ignoreWounds')) b.ignoreWounds = r.ignoreWounds === true || r.ignoreWounds === 'true';
  if (extras.includes('stunIgnoreBoxes')) b.stunIgnoreBoxes = Math.max(0, Math.floor(num(r.stunIgnoreBoxes)));
  return b;
}

/** Short wording per bundle key. */
const LINE: Record<string, (v: number) => string> = {
  testsTn: (v) => tx('SR2E.Text.Lifeline.tnOnAllTests', { value: signed(v) }),
  perceivedTn: (v) => tx('SR2E.Text.Lifeline.tnToPerceive', { value: signed(v) }),
  attackedTn: (v) => tx('SR2E.Text.Lifeline.tnOnAttacks', { value: signed(v) }),
  ballistic: (v) => tx('SR2E.Text.Lifeline.ballisticArmor', { value: signed(v) }),
  impact: (v) => tx('SR2E.Text.Lifeline.impactArmor', { value: signed(v) }),
  reaction: (v) => tx('SR2E.Text.Lifeline.reaction', { value: signed(v) }),
  initiativeDice: (v) => tx('SR2E.Text.Lifeline.initiativeDice', { value: signed(v) }),
};

/** v0.61.0: a drug's extra effects as short lines ("TN −1 on all tests", "Movement ×2", "Ignores wound modifiers"); none = []. */
export function drugEffectLines(raw: unknown): string[] {
  const b = drugEffectBundle(raw);
  const out: string[] = [];
  for (const k of ATTRIBUTE_KEYS) { const v = b.attributes[k]; if (v) out.push(`${tKey(`SR2E.Attribute.${k}`)} ${signed(v)}`); }
  for (const k of EFFECT_NUMBER_KEYS) if (b[k]) out.push(LINE[k]!(b[k]));
  if (b.movementFactor !== 1) out.push(tx('SR2E.Text.Lifeline.movement', { factor: b.movementFactor }));
  if (b.ignoreWounds) out.push(tx('SR2E.Text.Lifeline.ignoresWoundModifiers'));
  if (b.stunIgnoreBoxes) out.push(tCount(b.stunIgnoreBoxes, 'SR2E.Text.Lifeline.ignoresStunBoxes'));
  return out;
}

/** v0.61.0: several active drugs together: TNs, armor and other numbers add, movement factors multiply, ignoreWounds if any has it, the most stunIgnoreBoxes. */
export function combineDrugEffects(list: unknown[]): { bundle: EffectBundle; ignoreWounds: boolean; stunIgnoreBoxes: number } {
  const bundle = emptyBundle();
  let ignoreWounds = false;
  let stunIgnoreBoxes = 0;
  for (const raw of Array.isArray(list) ? list : []) {
    const b = drugEffectBundle(raw);
    for (const k of EFFECT_NUMBER_KEYS) bundle[k] += b[k];
    bundle.movementFactor = clean(bundle.movementFactor * b.movementFactor);
    for (const k of ATTRIBUTE_KEYS) { const v = b.attributes[k]; if (v) bundle.attributes[k] = (bundle.attributes[k] ?? 0) + v; }
    ignoreWounds ||= b.ignoreWounds;
    stunIgnoreBoxes = Math.max(stunIgnoreBoxes, b.stunIgnoreBoxes);
  }
  return { bundle, ignoreWounds, stunIgnoreBoxes };
}

// ---------------------------------------------------------------- Immunity

/** v0.61.0: whether an immunity (rules/bestiary.ts critterImmunities flags) stops this damage: fire damage (`fire`, or an element in RULES.HEALTH_V61.immunity.fireElements) is stopped by immunity to fire. */
export function damageImmunity(imm: Record<string, boolean>, o: { fire?: boolean; element?: string }): { immune: boolean; reason: string } {
  const i = imm && typeof imm === 'object' ? imm : {};
  const element = String(o?.element ?? '').trim().toLowerCase();
  const fire = o?.fire === true || (!!element && C().immunity.fireElements.includes(element));
  if (fire && i.fire === true) return { immune: true, reason: tx('SR2E.Text.Lifeline.immuneToFire') };

  return { immune: false, reason: '' };
}

/** v0.61.0: whether these immunities stop a drug: immunity to drugs, or to poisons when RULES.HEALTH_V61.immunity.drugsCountAsPoisons. */
export function drugImmunity(imm: Record<string, boolean>): boolean {
  if (!imm || typeof imm !== 'object') return false;
  return imm.drugs === true || (C().immunity.drugsCountAsPoisons && imm.poisons === true);
}

// ---------------------------------------------------------------- Healing someone else's patient

/**
 * v0.61.0: where a heal on a patient goes: the patient's owner or a GM applies it ('apply'); anyone
 * else posts a GM card ('gmCard') whether or not a GM is online, so the card waits for one. 'none'
 * only for missing input.
 */
export function healApplyRoute(o: { isOwner: boolean; isGm: boolean; /** Ignored: the GM card waits for a GM either way. */ gmOnline?: boolean }): 'apply' | 'gmCard' | 'none' {
  if (!o || typeof o !== 'object') return 'none';
  return o.isOwner === true || o.isGm === true ? 'apply' : 'gmCard';
}
