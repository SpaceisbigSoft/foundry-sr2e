/**
 * v0.79.0 (health): the book's healing rules (RULES.DOCS_V79, rules/config79-health.ts), pure. Physical
 * healing in stages (SRII Healing Table), the self-recovery gate (Wound Table), the Doctoring Table and the
 * First Aid Table modifiers. Each reads its switch; the old way stays in core.ts (naturalHealing, careModifiers,
 * firstAidBoxes) and the callers pick by the switch.
 */
import { RULES, type DamageLevel } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { woundLevel } from './core.ts';
import { deadlyNeedsIntensive } from './urr80-health-social.ts';
import { own } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';

const H = () => RULES.DOCS_V79;
const NEXT_DOWN: Record<DamageLevel, DamageLevel | null> = { D: 'S', S: 'M', M: 'L', L: null };

/** Whether Physical damage heals in stages (the book) rather than per box (old). Stun always heals per box. */
export function healsInStages(track: 'physical' | 'stun'): boolean {
  return track === 'physical' && H().healing === 'stages';
}

/** The step modifier for a natural attribute rating (1-3 / 4-6 / 7-9 / 10+ = 0 / −1 / −2 / −3). */
export function healingAttributeStep(rating: number, steps: ReadonlyArray<readonly [number, number]>): number {
  const r = Math.floor(Number(rating) || 0);
  // v0.81.0 (RB-18): highest minimum first, whatever order an override lists the steps in.
  for (const [min, mod] of [...steps].sort((a, b) => b[0] - a[0])) if (r >= min) return mod;
  return 0;
}

/**
 * One healing stage (Healing Table): the TN for the current wound level, the time the stage takes (base ÷
 * successes, at least the minimum; × a symbiote time factor), and where the damage ends: the lowest box of the
 * next level down (0 after Light). No successes: the stage makes no progress (hours null).
 */
export function healingStage(opts: { boxes: number; successes: number; timeFactor?: number }): { level: DamageLevel | null; tn: number; hours: number | null; toBoxes: number } {
  const s = H().healingStages;
  const boxes = Math.max(0, Math.floor(Number(opts.boxes) || 0));
  const level = woundLevel(boxes);
  if (!level) return { level, tn: s.tnByLevel.L, hours: null, toBoxes: 0 };
  const tn = s.tnByLevel[level];
  const next = NEXT_DOWN[level];
  const toBoxes = next ? Math.min(boxes, RULES.BOXES_PER_LEVEL[next]) : 0;
  if (!(opts.successes > 0)) return { level, tn, hours: null, toBoxes: boxes };
  const factor = Math.min(1, Math.max(0.1, Number(opts.timeFactor ?? 1) || 1));
  const hours = Math.max(s.minHours[level], s.baseHours[level] * factor / opts.successes);
  return { level, tn, hours: Math.round(hours * 100) / 100, toBoxes };
}

/**
 * A rest of `hours` against a stage test: the stage finishes (damage drops to `toBoxes`) when the rest is at least
 * the stage's time; otherwise nothing heals yet. One stage per test.
 */
export function stageRest(opts: { boxes: number; successes: number; hours: number; timeFactor?: number }): { tn: number; stageHours: number | null; done: boolean; boxes: number; level: DamageLevel | null } {
  const st = healingStage(opts);
  const done = st.hours != null && Math.max(0, Number(opts.hours) || 0) + 1e-9 >= st.hours;
  const boxes = Math.max(0, Math.floor(Number(opts.boxes) || 0));
  return { tn: st.tn, stageHours: st.hours, done, boxes: done ? boxes - st.toBoxes : 0, level: st.level };
}

/**
 * The self-recovery test (Wound Table): natural Body vs the TN, no modifiers. `tn` null when no test applies:
 * the gate is off (healingGate 'none', or healing 'boxes'), or a Deadly wound (no row: always needs a doctor).
 */
export function selfRecoveryTest(boxes: number): { level: DamageLevel | null; tn: number | null; needsDoctor: boolean } {
  const level = woundLevel(Math.max(0, Math.floor(Number(boxes) || 0)));
  if (!level || H().healing !== 'stages' || H().healingGate !== 'selfTest') return { level, tn: null, needsDoctor: false };
  if (level === 'D') return { level, tn: null, needsDoctor: true };
  return { level, tn: H().healingGateTn[level], needsDoctor: false };
}

/**
 * Whether a healing stage can be rolled: with the gate on, a failed self-recovery test (or a Deadly wound) needs
 * medical attention (any care but 'none'). `gate`: the test's result for this wound ('untested' = not rolled yet).
 */
export function canRollStage(opts: { boxes: number; care: string; gate: 'passed' | 'failed' | 'untested' }): { ok: boolean; reason: string } {
  const t = selfRecoveryTest(opts.boxes);
  if (t.tn == null && !t.needsDoctor) return { ok: true, reason: '' };
  const doctor = (opts.care || 'none') !== 'none';
  // v0.80.0 (RULES.URR_V80.hsDeadlyIntensive, the URR): a Deadly wound's stage needs intensive care.
  const urrIntensive = deadlyNeedsIntensive(opts.boxes, opts.care);
  if (urrIntensive) return { ok: false, reason: urrIntensive };
  if (t.needsDoctor && !doctor) return { ok: false, reason: t.level === 'L' ? tx('SR2E.Text.Docs79Health.aLightWoundNeeds') : t.level === 'M' ? tx('SR2E.Text.Docs79Health.aModerateWoundNeeds') : t.level === 'S' ? tx('SR2E.Text.Docs79Health.aSeriousWoundNeeds') : tx('SR2E.Text.Docs79Health.aDeadlyWoundNeeds') };
  if (t.tn != null && opts.gate === 'untested') return { ok: false, reason: tx('SR2E.Text.Docs79Health.rollTheSelfRecoveryTest', { tn: t.tn }) };
  if (opts.gate === 'failed' && !doctor) return { ok: false, reason: tx('SR2E.Text.Docs79Health.theSelfRecoveryTestFailed') };
  return { ok: true, reason: '' };
}

/** The rest dialog's care choices under the Doctoring Table (doctoring 'table'); null = use RULES.HEALING.natural.care (old). */
export function doctoringCareOptions(): Array<{ id: string; label: string; tn: number }> | null {
  if (H().doctoring !== 'table') return null;
  const d = H().doctoringTable;
  const c = d.conditions;
  return [
    { id: 'none', label: tx('SR2E.Text.Docs79Health.restingOnYourOwn'), tn: 0 },
    { id: 'medkit', label: tx('SR2E.Text.Docs79Health.doctorNotInHospital'), tn: c['medkit'] ?? 2 },
    { id: 'home', label: tx('SR2E.Text.Docs79Health.doctorAtHome'), tn: c['home'] ?? 2 },
    { id: 'hospital', label: tx('SR2E.Text.Docs79Health.hospitalOrClinic'), tn: c['hospital'] ?? 0 },
    { id: 'intensive', label: tx('SR2E.Text.Docs79Health.intensiveCareHospital'), tn: (c['intensive'] ?? 0) + d.intensive },
    { id: 'poor', label: tx('SR2E.Text.Docs79Health.doctorBadConditions'), tn: c['poor'] ?? 3 },
    { id: 'terrible', label: tx('SR2E.Text.Docs79Health.doctorTerribleConditions'), tn: c['terrible'] ?? 4 },
  ];
}

/**
 * Doctoring Table modifiers for a healing stage (doctoring 'table'); null under 'care' (use the old care rows).
 * Only when a doctor is involved (care other than 'none'). `applyMagician` false = the doctor skips the
 * magician's +2 (the patient risks Magic loss: left for v0.80.0).
 */
export function doctoringModifiers(opts: { care: string; magicalCare?: boolean; magician?: boolean; applyMagician?: boolean; naturalBody: number; naturalWillpower: number }): TargetNumberModifier[] | null {
  if (H().doctoring !== 'table') return null;
  const care = opts.care || 'none';
  if (care === 'none') return [];
  const d = H().doctoringTable;
  const out: TargetNumberModifier[] = [];
  if (care === 'intensive') out.push({ id: 'intensiveCare', label: tx('SR2E.Card.Mod.intensiveCare'), value: d.intensive });
  if (opts.magicalCare) out.push({ id: 'longTermMagicalCare', label: tx('SR2E.Card.Mod.longTermMagicalCare'), value: d.magicalCare });
  const cond = own(d.conditions, care) ?? d.conditions['medkit'] ?? 0;
  if (cond) out.push({ label: care === 'poor' ? tx('SR2E.Card.Mod.badConditions') : care === 'terrible' ? tx('SR2E.Card.Mod.terribleConditions') : tx('SR2E.Card.Mod.notInHospitalOrClinic'), value: cond });
  if (opts.magician && opts.applyMagician !== false) out.push({ id: 'patientIsAMagician', label: tx('SR2E.Card.Mod.patientIsAMagician'), value: d.magician });
  const b = healingAttributeStep(opts.naturalBody, d.attributeSteps);
  if (b) out.push({ label: tx('SR2E.Card.Mod.naturalBody', { naturalBody: opts.naturalBody }), value: b });
  const w = healingAttributeStep(opts.naturalWillpower, d.attributeSteps);
  if (w) out.push({ label: tx('SR2E.Card.Mod.naturalWillpower', { naturalWillpower: opts.naturalWillpower }), value: w });
  return out;
}

/** Dice a medkit adds to first aid: none under the First Aid Table (firstAidMods 'table'); its rating under the old way. */
export function firstAidKitDice(rating: number): number {
  if (H().firstAidMods === 'table') return 0;
  return RULES.HEALING.firstAid.medkitAddsDice ? Math.max(0, Math.floor(Number(rating) || 0)) : 0;
}

/**
 * First Aid Table modifiers (firstAidMods 'table'; [] under the old way): no medkit +4, bad +1 / terrible +3
 * conditions, patient is a magician +2 (unless the healer skips it), the patient's natural Body steps.
 */
export function firstAidModifiers(opts: { medkit: boolean; conditions?: 'normal' | 'bad' | 'terrible' | string; magician?: boolean; applyMagician?: boolean; naturalBody: number }): TargetNumberModifier[] {
  if (H().firstAidMods !== 'table') return [];
  const f = H().firstAidTable;
  const out: TargetNumberModifier[] = [];
  if (!opts.medkit) out.push({ id: 'noMedkit', label: tx('SR2E.Card.Mod.noMedkit'), value: f.noMedkit });
  const c = f.conditions[opts.conditions ?? 'normal'] ?? 0;
  if (c) out.push({ label: opts.conditions === 'terrible' ? tx('SR2E.Card.Mod.terribleConditions') : tx('SR2E.Card.Mod.badConditions'), value: c });
  if (opts.magician && opts.applyMagician !== false) out.push({ id: 'patientIsAMagician', label: tx('SR2E.Card.Mod.patientIsAMagician'), value: f.magician });
  const b = healingAttributeStep(opts.naturalBody, f.bodySteps);
  if (b) out.push({ label: tx('SR2E.Card.Mod.naturalBody', { naturalBody: opts.naturalBody }), value: b });
  return out;
}
