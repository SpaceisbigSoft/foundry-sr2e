/**
 * v0.99.0 rules completeness, clinics, surgery and ware damage: the Foundry glue for RULES.CLINIC_V99 (pure logic:
 * rules/clinic99.ts). The GM's "Clinics and ware damage" tool (find a shadow clinic through a contact, remove
 * cyberware, set or clear a ware's damage level), the surgeon's fee and the graded care rates in the surgery flow, the
 * ware damage levels the system damage check writes, the feedback penalty on every test, and repair by damage level.
 *
 * Security: a found clinic and the damage record are world settings only a GM client writes. A contact's test and a
 * removal test (the surgeon is often an NPC) roll on the GM's client from the GM's tool. A ware's own damage level (its
 * item flag) is the owner's: the lead GM copies every rise of it into the record, and the level that counts is the
 * worse of the two, so a player lowering their own item's flag changes nothing; only a GM lowers the record (the GM's
 * own repair, the GM's tool, or the GM's confirmed click on a player's repair card). Every value put into HTML is escaped.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES } from '../rules/config.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { allActors } from '../helpers/actors.ts';
import { successTest, type SuccessTestResult, type TargetNumberModifier } from '../rules/dice.ts';
import { wareCost } from '../rules/bioware.ts';
import * as X from '../rules/clinic99.ts';
import { authorOwns, gmMay } from './trust.ts';
import { withGmLock } from './gmlock.ts';
import { leadSettled } from './leader.ts';
import { sysNow } from '../helpers/clock.ts';

const G = (): any => (globalThis as any).game;
const isGm = (): boolean => Boolean(G()?.user?.isGM);
const dialogs = (): any => (globalThis as any).foundry?.applications?.api?.DialogV2;
const warn = (text: string): void => { (globalThis as any).ui?.notifications?.warn?.(text); };
const post = (content: string, extra: Record<string, unknown> = {}): Promise<any> => (globalThis as any).ChatMessage.create({ content, ...extra });
const speaker = (actor: any): any => { try { return (globalThis as any).ChatMessage.getSpeaker({ actor }); } catch { return {}; } };
const name = (a: any): string => escHtml(String(a?.name ?? ''));
const int = (v: unknown, min: number, max: number, d = min): number => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
const uuidOk = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 400;
const sync = (uuid: unknown): any => { try { return uuidOk(uuid) ? (globalThis as any).fromUuidSync?.(uuid) ?? null : null; } catch { return null; } };
const actorClass = (): any => (globalThis as any).CONFIG?.Actor?.documentClass;
const users = (): any[] => [...(G()?.users ?? [])];
const gmIds = (): string[] => users().filter((u: any) => u.isGM).map((u: any) => u.id);
const ownerIds = (a: any): string[] => users().filter((u: any) => !u.isGM && a?.testUserPermission?.(u, 'OWNER')).map((u: any) => u.id);
const total = (a: any, k: string): number => Math.max(0, Math.min(30, Math.floor(Number(a?.system?.attributes?.[k]?.total ?? 0) || 0)));
const SELECTED = ' selected';
const optionHtml = (v: string, l: string, cur: string): string => `<option value="${escHtml(v)}"${v === cur ? SELECTED : ''}>${escHtml(l)}</option>`;
const sel = (opts: Array<[string, string]>, n: string, cur = ''): string => {
  const inner = opts.map(([v, l]) => optionHtml(v, l, cur)).join('');
  return `<select name="${n}">${inner}</select>`;
};
const numIn = (label: string, n: string, v: number, min = 0, max = 99): string =>
  `<div class="form-group"><label>${escHtml(label)}</label><input name="${n}" type="number" value="${escHtml(String(v))}" min="${min}" max="${max}"></div>`;
const row = (label: string, inner: string): string => `<div class="form-group"><label>${escHtml(label)}</label>${inner}</div>`;

function roller(sink: any[]): (count: number) => Promise<number[]> {
  return async (count: number) => {
    const roll = await new (globalThis as any).Roll(`${count}d6`).evaluate();
    sink.push(roll);
    return (roll.dice ?? []).flatMap((term: any) => term.results.map((r: any) => Number(r.result)));
  };
}
const diceText = (r: SuccessTestResult): string => r.dice.map((d) => Number(d.total)).join(', ');
function rollLine(label: string, r: SuccessTestResult): string {
  return `<p>${label}: ${tx('SR2E.Clinic99.roll', { dice: escHtml(diceText(r) || '-'), tn: r.targetNumber, successes: r.successes })}</p>`;
}

/** World settings (GM-written): the clinics found for each character, and the ware damage record. */
export const CLINIC_SETTING = 'clinics99';
export const DAMAGE_SETTING = 'wareDamage99';
/** On a player's repair card: the record the GM is asked to clear; on it once the GM has. */
export const CLEAR_FLAG = 'clinic99Clear';
export const CLEARED_FLAG = 'clinic99Cleared';
/** On a patient: the surgeon's fee each operation (by its id) has paid (their own money only). */
export const FEE_FLAG = 'surgeryFee99';

const levelLabel = (l: string): string => tKey(`SR2E.Clinic99.Level.${l || 'none'}`);

// ================================================================ The GM-written records

function readSetting(key: string): unknown {
  try { return G()?.settings?.get?.(SYSTEM_ID, key); } catch { return {}; }
}
export function damageRecord(): X.DamageRecord { return X.damageRecord(readSetting(DAMAGE_SETTING)); }
export function clinicRecord(): X.ClinicRecord { return X.clinicRecord(readSetting(CLINIC_SETTING)); }

/** A GM write step after its dialogs, under the GM lock (inline inside a card's re-run, which holds it). */
function gmStep<T>(fn: () => Promise<T>): Promise<T> {
  const cls = actorClass();
  return cls?.actingAuthor || cls?.inAuthorRun ? fn() : withGmLock(fn);
}

/** GM only: the record keeps this item at least at `level` (a rise; never lowered here). */
export async function recordRise(item: any, level: unknown): Promise<boolean> {
  if (!isGm() || !item?.uuid) return false;
  const rec = damageRecord();
  const key = X.recordKey(item.uuid);
  const next = X.worse(rec[key], level);
  if (!next || next === rec[key]) return false;
  await G().settings.set(SYSTEM_ID, DAMAGE_SETTING, { ...rec, [key]: next }, { sr2eRelay: true });
  return true;
}

/** GM only: the record forgets this item (a repair, or the GM's own clearing). */
export async function recordClear(item: any): Promise<boolean> {
  if (!isGm() || !item?.uuid) return false;
  const rec = damageRecord();
  const key = X.recordKey(item.uuid);
  if (!rec[key]) return false;
  const next = { ...rec };
  delete next[key];
  await G().settings.set(SYSTEM_ID, DAMAGE_SETTING, next, { sr2eRelay: true });
  return true;
}

// ================================================================ Hooks in shared code

/** The feedback penalty of damaged ware on every test the character makes (Shadowtech: Serious +1, Deadly +2 each). */
export function feedbackMods(actor: any): TargetNumberModifier[] {
  if (!X.on('damageLevels') || !actor || !['character', 'npc'].includes(String(actor.type))) return [];
  const f = X.actorFeedbackTn(actor.items ?? []);
  return f.tn ? [{ id: 'wareFeedback99', label: tx('SR2E.Clinic99.feedback', { names: f.names.join(', ') }), value: f.tn }] : [];
}

/**
 * A system damage hit (the book's system damage check, on the owner's client): the item's level becomes the hit
 * accumulated on what it had (the worse of its own and the record's). The owner writes the item; a GM writes the
 * record too (otherwise the lead GM copies the rise from the item). '' under 'v980'.
 */
export async function recordHit(item: any, hit: string): Promise<X.WareLevel> {
  if (!X.on('damageLevels') || !item || item.system?.bioware) return '';
  const level = X.accumulate(X.wareLevel(item), X.levelOf(hit));
  if (!level) return '';
  try { await item.setFlag(SYSTEM_ID, X.WARE_FLAG, level); } catch { /* not ours to write */ }
  if (X.levelStops(level) && !item.system?.damaged) { try { await item.update({ 'system.damaged': true }); } catch { /* not ours */ } }
  if (isGm()) await recordRise(item, level);
  return level;
}

/** The card label of a level ('' none). */
export function levelText(level: string): string { return level ? levelLabel(level) : ''; }

/** Whether the ware has something to repair (book: any level; the old damaged box always counts). */
export function repairable(item: any): boolean {
  return Boolean(item?.system?.damaged) || Boolean(X.wareLevel(item));
}

/** The sheet's row: the level shown (and a repair button for Light damage). Null when there is none. */
export function rowLevel(item: any): { level: string; label: string } | null {
  const l = X.wareLevel(item);
  return l ? { level: l, label: tx('SR2E.Clinic99.rowLevel', { level: levelLabel(l) }) } : null;
}

/** The ware's base (unmodified) Essence cost: before the book's surgery changed it (its flag), else its own. */
function baseEssence(item: any): number {
  const was = Number(item?.getFlag?.(SYSTEM_ID, 'surgeryEssence'));
  return Number.isFinite(was) ? was : Math.max(0, Number(item?.system?.essenceCost ?? 0) || 0);
}

/** The repair test by damage level (book), or null under 'v980'. A destroyed system gives `why`. */
export function repairSpecFor(item: any): { tn: number; hours: number; level: string; why?: string } | null {
  if (!X.on('repair') || !item || item.system?.bioware) return null;
  const level = X.wareLevel(item) || 'M';
  const s = X.repairSpec(level, String(item.system?.grade ?? 'standard'), baseEssence(item));
  return { ...s, level };
}

/** The repairer's skill (book: the lower of RULES.CYBERWARE.repair's skills they have), or undefined: the old pick. */
export function repairSkill(who: any): any | undefined {
  if (!X.on('repair')) return undefined;
  const found = RULES.CYBERWARE.repair.skills.map((n) => who?.findSkill?.(n)).filter(Boolean).map((s: any) => ({ s, rating: Number(s.system?.rating ?? 0) }));
  return X.lowerSkill(found)?.s ?? null;
}

/** The repair's hours after the successes (book), or null under 'v980' or for destroyed ware. */
export function repairNote(item: any, successes: number): { hours: number } | null {
  const spec = repairSpecFor(item);
  if (!spec || spec.why) return null;
  return { hours: X.repairHours(spec.hours, successes) };
}

/** The repair card's line: the level, its TN and the parts cost (shown, not charged); '' under 'v980'. */
export function repairNoteHtml(item: any): string {
  const spec = repairSpecFor(item);
  if (!spec || spec.why) return '';
  const parts = X.repairParts(spec.level, wareCost(item.system ?? {}, String(item.name ?? '')));
  return ` ${tx('SR2E.Clinic99.repairNote', { level: escHtml(levelLabel(spec.level)), tn: spec.tn, parts: escHtml(parts.toLocaleString()) })}`;
}

/** The change a repair project writes when done (clears the item's own level), or none under 'v980'. */
export function repairChanges(): Array<[string, unknown]> {
  return X.on('damageLevels') ? [[`flags.${SYSTEM_ID}.${X.WARE_FLAG}`, '']] : [];
}

/**
 * A repair succeeded (on the repairer's client): the item's own level is cleared now (unless a project clears it when
 * the work is done), and the record: a GM clears it; a player's card asks the GM (the level keeps counting until then).
 */
export async function repaired(item: any, o: { project?: boolean; repairer?: any } = {}): Promise<string> {
  if (!X.on('damageLevels') || !item) return '';
  const level = X.wareLevel(item);
  if (!o.project) { try { await item.setFlag(SYSTEM_ID, X.WARE_FLAG, ''); } catch { /* not ours */ } }
  const recorded = X.recordedLevel(item.uuid);
  if (!recorded) return '';
  if (isGm()) { await recordClear(item); return ''; }
  const owner = item.parent;
  await post(`<p><em>${tx('SR2E.Clinic99.gmOnly')}</em> ${tx('SR2E.Clinic99.clearAsk', { item: name(item), owner: name(owner), level: escHtml(levelLabel(level || recorded)) })}</p><p><button type="button" data-sr2e-action="clinic99Clear">${tx('SR2E.Clinic99.clearButton')}</button></p>`,
    { speaker: speaker(o.repairer ?? owner), whisper: gmIds(), flags: { [SYSTEM_ID]: { [CLEAR_FLAG]: { itemUuid: String(item.uuid), ownerUuid: String(owner?.uuid ?? '') } } } });
  return ` ${tx('SR2E.Clinic99.clearAsked')}`;
}

/** A GM's TN change undid a repair: the item's level goes back (a rise only; the lead GM records it again). */
export async function unrepaired(item: any, level: unknown): Promise<void> {
  const l = X.levelOf(level);
  if (!X.on('damageLevels') || !item || !l) return;
  try { await item.setFlag(SYSTEM_ID, X.WARE_FLAG, X.worse(X.itemLevel(item), l)); } catch { /* not ours */ }
}

// ---------------------------------------------------------------- Surgery: fees and the clinic

/** The surgeon's fee for this operation and the graded multiplier on its care, with the clinic note. */
export function surgeryCharges(patient: any, item: any, points: number): { fee: number; factor: number; clinic: boolean | null } {
  const bio = Boolean(item?.system?.bioware);
  const grade = String(item?.system?.grade ?? 'standard');
  const graded = !bio && ['alpha', 'beta', 'delta'].includes(grade);
  return {
    fee: X.surgeonFee(points, bio, grade),
    factor: X.feeFactor(grade, bio),
    clinic: X.on('clinicSearch') && graded ? X.hasClinic(clinicRecord(), X.recordKey(patient?.uuid), grade) : null,
  };
}

/** The care's daily cost multiplier for this ware (Cybertechnology p. 44: graded clinics × 50 / × 200). */
export function careFactor99(item: any): number {
  return X.feeFactor(String(item?.system?.grade ?? 'standard'), Boolean(item?.system?.bioware));
}

/**
 * The surgeon's fee, charged to the patient once per operation (its id; the patient's own record of it: their own money
 * only). Returns the card's note ('' when there is no fee and no clinic to note).
 */
export async function chargeSurgeonFee(patient: any, item: any, op: { id?: string; points: number; pay?: boolean; itemName: string }): Promise<string> {
  if (!patient || !item) return '';
  const c = surgeryCharges(patient, item, op.points);
  let note = '';
  if (c.clinic === false) note += ` ${tx('SR2E.Clinic99.noClinic', { grade: escHtml(tKey(`SR2E.Clinic99.Grade.${String(item.system?.grade)}`)) })}`;
  if (c.clinic === true) note += ` ${tx('SR2E.Clinic99.atClinic', { grade: escHtml(tKey(`SR2E.Clinic99.Grade.${String(item.system?.grade)}`)) })}`;
  if (!c.fee || !op.pay || !op.id) return note;
  const paid = (patient.getFlag?.(SYSTEM_ID, FEE_FLAG) as Record<string, number> | undefined) ?? {};
  if (Object.hasOwn(paid, op.id)) return note;
  const ok = await patient.adjustNuyen?.(-c.fee, tx('SR2E.Clinic99.feeReason', { item: String(op.itemName ?? '') }));
  if (!ok) return `${note} <em>${tx('SR2E.Clinic99.feeShort', { patient: name(patient), fee: c.fee.toLocaleString() })}</em>`;
  try { await patient.setFlag(SYSTEM_ID, FEE_FLAG, { [op.id]: c.fee }); } catch { /* not saved */ }
  return `${note} ${tx('SR2E.Clinic99.feePaid', { fee: c.fee.toLocaleString(), factor: c.factor })}`;
}

/** The fee line for the GM's confirm before applying a surgery card (plain text). */
export function feeApplyText(patient: any, item: any, op: { id?: string; points: number; pay?: boolean }): string {
  const c = surgeryCharges(patient, item, op.points);
  const paid = (patient?.getFlag?.(SYSTEM_ID, FEE_FLAG) as Record<string, number> | undefined) ?? {};
  if (!c.fee || !op.pay || (op.id && Object.hasOwn(paid, op.id))) return '';
  return ` ${tx('SR2E.Clinic99.feeConfirm', { fee: c.fee.toLocaleString() })}`;
}

// ================================================================ The GM's tool

function people(): any[] {
  return allActors().filter((a: any) => ['character', 'npc'].includes(String(a?.type)));
}
const choices = (list: any[]): Array<[string, string]> => list.map((a: any) => [String(a.uuid), String(a.name ?? '')]);

/** The contact's Etiquette (Street) rating: the Street concentration's rating when the skill has it. */
function etiquetteOf(a: any): number {
  const s: any = a?.findSkill?.(RULES.UPKEEP.availability.skill);
  if (!s) return 0;
  const c = /street/i.test(String(s.system?.concentration ?? '')) ? Number(s.system?.concentrationRating ?? 0) : 0;
  return int(c > 0 ? c : s.system?.rating, 0, 20, 0);
}

/** The contact's test on the GM's client and the GM-written record of a found clinic (SSC p. 99). */
export async function findClinic(o: { patient: any; contact?: any; grade: string; route: string; mode: string } & X.ContactRatings): Promise<{ found: boolean } | null> {
  if (!isGm() || !o.patient) return null;
  const grade = (X.CLINIC_GRADES as readonly string[]).includes(o.grade) ? (o.grade as X.ClinicGrade) : 'alpha';
  const route = o.route === 'corp' ? 'corp' : 'street';
  const by = String(o.contact?.name ?? '').slice(0, 120);
  const save = (): Promise<unknown> => gmStep(async () => {
    const next = X.withClinic(clinicRecord(), X.recordKey(o.patient.uuid), grade, { at: sysNow(), route, by });
    await G().settings.set(SYSTEM_ID, CLINIC_SETTING, next, { sr2eRelay: true });
  });
  const whisper = [...gmIds(), ...ownerIds(o.patient)];
  const gradeText = escHtml(tKey(`SR2E.Clinic99.Grade.${grade}`));
  if (grade === 'delta') {
    // Cybertechnology p. 44: no test; the corp wants the character there (the GM's decision).
    await save();
    await post(`<p>${tx('SR2E.Clinic99.Search.delta', { patient: name(o.patient), grade: gradeText })}</p>`, { whisper });
    return { found: true };
  }
  const t = X.clinicTest({ grade, route, mode: o.mode, etiquette: o.etiquette, intelligence: o.intelligence, charisma: o.charisma });
  if (t.why) { warn(escHtml(tKey(t.why))); return null; }
  const rolls: any[] = [];
  const r = await successTest({ dice: t.dice, targetNumber: t.tn, roll: roller(rolls) });
  const out = X.clinicOutcome(r.successes, t, o.mode);
  if (out.found) await save();
  const modeText = tKey(o.mode === 'search' ? 'SR2E.Clinic99.Mode.search' : 'SR2E.Clinic99.Mode.knows');
  const verdict = out.found
    ? (o.mode === 'search' ? tx('SR2E.Clinic99.Search.foundIn', { grade: gradeText, days: out.days }) : tx('SR2E.Clinic99.Search.knows', { grade: gradeText }))
    : tx('SR2E.Clinic99.Search.notFound', { grade: gradeText, need: t.need });
  const routeText = escHtml(tKey(`SR2E.Clinic99.Route.${route}`));
  const head = by ? tx('SR2E.Clinic99.Search.head', { contact: escHtml(by), patient: name(o.patient), grade: gradeText, route: routeText })
    : tx('SR2E.Clinic99.Search.headTyped', { patient: name(o.patient), grade: gradeText, route: routeText });
  await post(`<p>${head}</p>${rollLine(escHtml(modeText), r)}<p><strong>${verdict}</strong></p>`,
    { rolls, whisper, speaker: o.contact ? speaker(o.contact) : {} });
  return { found: out.found };
}

async function clinicTool(): Promise<void> {
  const list = people();
  if (!list.length) { warn(tx('SR2E.Clinic99.noPeople')); return; }
  const grades = X.CLINIC_GRADES.map((g) => [g, tKey(`SR2E.Clinic99.Grade.${g}`)] as [string, string]);
  const routes = X.ROUTES.map((g) => [g, tKey(`SR2E.Clinic99.Route.${g}`)] as [string, string]);
  const modes = X.SEARCH_MODES.map((g) => [g, tKey(`SR2E.Clinic99.Mode.${g}`)] as [string, string]);
  const pick = await dialogs()?.prompt?.({
    window: { title: tx('SR2E.Clinic99.Search.title') },
    content: `${row(tx('SR2E.Clinic99.patient'), sel(choices(list), 'patient'))}${row(tx('SR2E.Clinic99.contact'), sel([['', tx('SR2E.Clinic99.typed')], ...choices(list)], 'contact'))}${row(tx('SR2E.Clinic99.grade'), sel(grades, 'grade'))}${row(tx('SR2E.Clinic99.route'), sel(routes, 'route'))}${row(tx('SR2E.Clinic99.mode'), sel(modes, 'mode'))}`,
    ok: { label: tx('SR2E.Clinic99.next'), callback: (_e: Event, b: any) => ({ patient: String(b.form.elements.patient.value), contact: String(b.form.elements.contact.value), grade: String(b.form.elements.grade.value), route: String(b.form.elements.route.value), mode: String(b.form.elements.mode.value) }) },
    rejectClose: false,
  });
  if (!pick) return;
  const patient = sync(pick.patient);
  const contact = pick.contact ? sync(pick.contact) : null;
  if (!patient) return;
  let rt: X.ContactRatings = { etiquette: 0, intelligence: 0, charisma: 0 };
  if (pick.grade !== 'delta') {
    const r = await dialogs()?.prompt?.({
      window: { title: tx('SR2E.Clinic99.Search.title') },
      content: `<p>${tx('SR2E.Clinic99.Search.ratings')}</p>${numIn(tx('SR2E.Clinic99.etiquette'), 'etiquette', etiquetteOf(contact), 0, 20)}${numIn(tx('SR2E.Clinic99.intelligence'), 'intelligence', total(contact, 'intelligence'), 0, 20)}${numIn(tx('SR2E.Clinic99.charisma'), 'charisma', total(contact, 'charisma'), 0, 20)}`,
      ok: { label: tx('SR2E.Clinic99.rollIt'), callback: (_e: Event, b: any) => ({ etiquette: int(b.form.elements.etiquette.value, 0, 20, 0), intelligence: int(b.form.elements.intelligence.value, 0, 20, 0), charisma: int(b.form.elements.charisma.value, 0, 20, 0) }) },
      rejectClose: false,
    });
    if (!r) return;
    rt = r;
  }
  await findClinic({ patient, contact, grade: pick.grade, route: pick.route, mode: pick.mode, ...rt });
}

// ---------------------------------------------------------------- Removal (Shadowtech pp. 36–41)

/** The surgeon's dice for the removal test: the lower of the two skills; with neither, Intelligence at +4 (VERIFY). */
function removalDice(surgeon: any): { dice: number; modifiers: TargetNumberModifier[]; skill: string } {
  const found = RULES.CYBERWARE.repair.skills.map((n) => surgeon?.findSkill?.(n)).filter(Boolean).map((s: any) => ({ s, rating: Number(s.system?.rating ?? 0) }));
  const low = X.lowerSkill(found);
  const wounds: TargetNumberModifier[] = typeof surgeon?.woundModifiers === 'function' ? surgeon.woundModifiers() : [];
  if (low) return { dice: int(low.rating, 0, 20, 0), modifiers: wounds, skill: String(low.s?.name ?? '') };
  return { dice: total(surgeon, 'intelligence'), modifiers: [...wounds, { id: 'removalDefault99', label: tx('SR2E.Clinic99.Remove.default'), value: 4 }], skill: '' };
}

/** The removal test on the GM's client; the ware comes out, and no successes costs the extra Essence. */
export async function removeWare(patient: any, item: any, surgeon: any): Promise<{ successes: number; loss: number } | null> {
  if (!isGm() || !X.on('removal') || !patient || !item || item.type !== 'cyberware' || !item.system?.installed || item.parent?.uuid !== patient.uuid) return null;
  const ess = Number(patient.system?.derived?.essence ?? patient.system?.essence ?? 6);
  const d = removalDice(surgeon);
  const rolls: any[] = [];
  const r = await successTest({ dice: d.dice, targetNumber: X.removalTn(ess), modifiers: d.modifiers, roll: roller(rolls) });
  const cost = (actorClass()?.essenceOf?.(item, patient) as number | undefined) ?? Number(item.system?.essenceCost ?? 0);
  const loss = item.system?.bioware ? 0 : X.removalLoss(cost, r.successes);
  await gmStep(async () => {
    await item.update({ 'system.installed': false });
    if (loss > 0) await patient.update({ 'system.essenceShift': Math.round(((Number(patient.system?.essenceShift) || 0) - loss) * 100) / 100 });
  });
  const verdict = loss > 0 ? tx('SR2E.Clinic99.Remove.loss', { patient: name(patient), loss }) : tx('SR2E.Clinic99.Remove.clean');
  await post(`<p>${tx('SR2E.Clinic99.Remove.head', { surgeon: name(surgeon), item: name(item), patient: name(patient) })}</p>${rollLine(escHtml(d.skill || tx('SR2E.Clinic99.intelligence')), r)}<p><strong>${verdict}</strong></p>`,
    { rolls, whisper: [...gmIds(), ...ownerIds(patient)], speaker: speaker(surgeon) });
  return { successes: r.successes, loss };
}

/** A ware's choice in the tool: its name, and its level when it has one. */
function wareChoice(i: any): string {
  const l = X.wareLevel(i);
  return l ? tx('SR2E.Clinic99.wareWithLevel', { name: String(i.name ?? ''), level: levelLabel(l) }) : String(i.name ?? '');
}

const surgeonRow = (): string => row(tx('SR2E.Clinic99.surgeon'), sel(choices(people()), 'surgeon'));
const levelRow = (): string => row(tx('SR2E.Clinic99.level'), sel([['', levelLabel('')], ...X.WARE_LEVELS.map((l) => [l, levelLabel(l)] as [string, string])], 'level'));

async function pickWare(title: string, filter: (i: any) => boolean, want: 'surgeon' | 'level'): Promise<{ actor: any; item: any; extra: any } | null> {
  const list = people().filter((a: any) => [...(a.items ?? [])].some(filter));
  if (!list.length) { warn(tx('SR2E.Clinic99.noWare')); return null; }
  const a1 = await dialogs()?.prompt?.({
    window: { title },
    content: row(tx('SR2E.Clinic99.patient'), sel(choices(list), 'patient')),
    ok: { label: tx('SR2E.Clinic99.next'), callback: (_e: Event, b: any) => String(b.form.elements.patient.value) },
    rejectClose: false,
  });
  const actor = a1 ? sync(a1) : null;
  if (!actor) return null;
  const ware = [...(actor.items ?? [])].filter(filter);
  const r = await dialogs()?.prompt?.({
    window: { title },
    content: `${row(tx('SR2E.Clinic99.ware'), sel(ware.map((i: any) => [String(i.id), wareChoice(i)] as [string, string]), 'item'))}${want === 'surgeon' ? surgeonRow() : levelRow()}`,
    ok: { label: tx('SR2E.Clinic99.ok'), callback: (_e: Event, b: any) => ({ item: String(b.form.elements.item.value), surgeon: String(b.form.elements.surgeon?.value ?? ''), level: String(b.form.elements.level?.value ?? '') }) },
    rejectClose: false,
  });
  const item = r ? ware.find((i: any) => i.id === r.item) : null;
  return item ? { actor, item, extra: r } : null;
}

async function removalTool(): Promise<void> {
  const p = await pickWare(tx('SR2E.Clinic99.Remove.title'), (i: any) => i.type === 'cyberware' && Boolean(i.system?.installed) && !i.system?.bioware, 'surgeon');
  if (!p) return;
  await removeWare(p.actor, p.item, sync(p.extra.surgeon) ?? p.actor);
}

/** The GM sets (or clears) a ware's damage level by hand: the record and the item together. */
export async function setLevelAsGm(item: any, level: unknown): Promise<boolean> {
  if (!isGm() || !item || item.type !== 'cyberware') return false;
  const l = X.levelOf(level);
  await gmStep(async () => {
    await item.update({ [`flags.${SYSTEM_ID}.${X.WARE_FLAG}`]: l, 'system.damaged': X.levelStops(l) });
    if (l) { await recordClear(item); await recordRise(item, l); } else await recordClear(item);
  });
  await post(`<p><em>${tx('SR2E.Clinic99.gmOnly')}</em> ${tx('SR2E.Clinic99.levelSet', { item: name(item), owner: name(item.parent), level: escHtml(levelLabel(l)) })}</p>`, { whisper: gmIds() });
  return true;
}

async function damageTool(): Promise<void> {
  const p = await pickWare(tx('SR2E.Clinic99.Damage.title'), (i: any) => i.type === 'cyberware' && !i.system?.bioware, 'level');
  if (p) await setLevelAsGm(p.item, p.extra.level);
}

/** The GM's "Clinics and ware damage (book)" tool: the operations whose switches are at the book's way. */
export async function openClinicTool(): Promise<void> {
  if (!isGm()) return;
  const ops: Array<[string, boolean, () => Promise<void>]> = [
    ['search', X.on('clinicSearch'), clinicTool],
    ['remove', X.on('removal'), removalTool],
    ['damage', X.on('damageLevels'), damageTool],
  ];
  const live = ops.filter(([, ok]) => ok);
  if (!live.length) { warn(tx('SR2E.Clinic99.allOff')); return; }
  const pick = await dialogs()?.wait?.({
    window: { title: tx('SR2E.Clinic99.Tool.title') },
    content: `<p>${tx('SR2E.Clinic99.Tool.intro')}</p>`,
    buttons: [...live.map(([id]) => ({ action: id, label: tKey(`SR2E.Clinic99.Tool.${id}`), callback: () => id })), { action: 'cancel', label: tx('SR2E.Clinic99.cancel'), callback: () => null }],
    rejectClose: false,
  }) as string | null;
  const op = live.find(([id]) => id === pick);
  if (op) await op[2]();
}

// ================================================================ Card buttons

const busy = new Set<string>();
async function once(key: string, button: HTMLButtonElement | null, fn: () => Promise<void>): Promise<void> {
  if (busy.has(key)) return;
  busy.add(key);
  if (button) button.disabled = true;
  try { await fn(); } finally {
    busy.delete(key);
    if (button) button.disabled = false;
  }
}

/**
 * The GM's click on a player's "clear the damage record" card: the item and its owner come from the documents (the
 * card only names the item); the author must own the item's actor; the GM confirms with the record's level shown.
 */
export async function applyClear(message: any): Promise<boolean> {
  if (!isGm()) return false;
  const f: any = message?.flags?.[SYSTEM_ID]?.[CLEAR_FLAG];
  const item: any = uuidOk(f?.itemUuid) ? sync(f.itemUuid) : null;
  if (!item || item.type !== 'cyberware') { warn(tx('SR2E.Clinic99.gmCardOnly')); return false; }
  const owner = item.parent;
  if (!authorOwns(message, owner)) { warn(tx('SR2E.Clinic99.notTheirs')); return false; }
  const recorded = X.recordedLevel(item.uuid);
  if (!recorded) { warn(tx('SR2E.Clinic99.nothingRecorded')); return false; }
  const ok = await gmMay(message, { title: tx('SR2E.Clinic99.clearTitle'), lines: [tx('SR2E.Clinic99.clearLine', { item: String(item.name ?? ''), owner: String(owner?.name ?? ''), level: levelLabel(recorded) })], sources: [owner?.uuid], always: true });
  if (!ok) return false;
  await gmStep(async () => {
    await recordClear(item);
    if (X.itemLevel(item)) await item.update({ [`flags.${SYSTEM_ID}.${X.WARE_FLAG}`]: '' });
    try { await message.update({ [`flags.${SYSTEM_ID}.${CLEARED_FLAG}`]: true }, { sr2eRelay: true }); } catch { /* the GM's mark only */ }
  });
  await post(`<p><em>${tx('SR2E.Clinic99.gmOnly')}</em> ${tx('SR2E.Clinic99.cleared', { item: name(item), owner: name(owner) })}</p>`, { whisper: gmIds() });
  return true;
}

export async function onCard(message: any, button: HTMLButtonElement, action: string): Promise<void> {
  if (action === 'clinic99Clear') {
    if (!isGm()) { warn(tx('SR2E.Clinic99.gmOnlyButton')); return; }
    await once(`clear:${String(message?.id ?? '')}`, button, async () => { await applyClear(message); });
  }
}

// ================================================================ Registration

/** Re-prepare the actors whose ware the record names (a record change moves their bonuses and penalties). */
function refreshFor(keys: Set<string>): void {
  if (!keys.size) return;
  for (const a of allActors()) {
    if (![...(a?.items ?? [])].some((i: any) => keys.has(X.recordKey(i?.uuid)))) continue;
    try { a.prepareData?.(); if (a.sheet?.rendered) a.sheet.render(false); } catch { /* not ready */ }
  }
}

/** The lead GM copies rises of the ware's own level into the record (sweeps once at start for any made while away). */
export async function sweepLevels(): Promise<number> {
  if (!isGm() || !X.on('damageLevels')) return 0;
  let n = 0;
  for (const a of allActors()) {
    for (const i of [...(a?.items ?? [])]) {
      if (i?.type !== 'cyberware' || i.system?.bioware) continue;
      const own = X.trustedOwnLevel(i);
      if (own && X.worse(own, X.recordedLevel(i.uuid)) !== X.recordedLevel(i.uuid) && (await recordRise(i, own))) n++;
    }
  }
  return n;
}

export function registerClinic99(isLead: () => boolean): void {
  const s: any = G()?.settings;
  let last: X.DamageRecord = {};
  s?.register?.(SYSTEM_ID, CLINIC_SETTING, { scope: 'world', config: false, type: Object, default: {} });
  s?.register?.(SYSTEM_ID, DAMAGE_SETTING, { scope: 'world', config: false, type: Object, default: {}, onChange: (v: unknown) => {
    const next = X.damageRecord(v);
    const keys = new Set<string>([...Object.keys(last), ...Object.keys(next)].filter((k) => last[k] !== next[k]));
    last = next;
    refreshFor(keys);
  } });
  X.setDamageRecordSource(() => readSetting(DAMAGE_SETTING));
  const H: any = (globalThis as any).Hooks;
  const run = (what: () => Promise<unknown>): void => { void withGmLock(what).catch((err) => console.warn('sr2e | ware damage', err)); };
  H?.on?.('updateItem', (item: any, change: any) => {
    if (!isLead() || !X.on('damageLevels') || item?.type !== 'cyberware') return;
    if (change?.flags?.[SYSTEM_ID]?.[X.WARE_FLAG] === undefined) return;
    const own = X.trustedOwnLevel(item);
    if (own) run(() => recordRise(item, own));
  });
  H?.once?.('ready', () => {
    last = damageRecord();
    void leadSettled().then(() => { if (isLead()) run(() => sweepLevels()); });
  });
}
