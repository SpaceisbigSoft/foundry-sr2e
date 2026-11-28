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
import { essenceLoss } from '../rules/cyberware.ts';
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
/** On a "clear the damage record" card: the item, its owner and the repair test the GM is asked to clear for. */
export const CLEAR_FLAG = 'clinic99Clear';
/** On a patient: the surgeon's fee each operation (by its id) has paid, on their own client (their own money only). */
export const FEE_FLAG = 'surgeryFee99';
/** World settings (GM-written): the damage record's notes (cleared stamps, used repair tests and cards, deleted ware), and the fees the GM's client charged. */
export const META_SETTING = 'wareDamage99Meta';
export const FEE_SETTING = 'surgeryFees99';
/** On a ware item: the repair test (its id) whose project just finished (the project's effect writes it; the lead GM checks it). */
export const FIX_FLAG = 'ware99Fix';
/** The update option of the GM's removal (the Installed refusal lets it through). */
const REMOVAL_OPT = 'sr2eRemoval99';

const levelLabel = (l: string): string => tKey(`SR2E.Clinic99.Level.${l || 'none'}`);

// ================================================================ The GM-written records

function readSetting(key: string): unknown {
  try { return G()?.settings?.get?.(SYSTEM_ID, key); } catch { return {}; }
}
export function damageRecord(): X.DamageRecord { return X.damageRecord(readSetting(DAMAGE_SETTING)); }
export function clinicRecord(): X.ClinicRecord { return X.clinicRecord(readSetting(CLINIC_SETTING)); }
export function damageMeta(): X.DamageMeta { return X.damageMeta(readSetting(META_SETTING)); }
export function feeRecord(): X.FeeRecord { return X.feeRecord(readSetting(FEE_SETTING)); }

/** The GM acting for themselves (not re-running a player's card as that player). */
const gmSelf = (): boolean => isGm() && !actorClass()?.actingAuthor;
/** The player a GM's re-run acts for (null: nobody, or a GM). */
const actingPlayer = (): any => { const a = actorClass()?.actingAuthor; return a && !a.isGM ? a : null; };

/**
 * A GM write step after its dialogs, under the GM lock: inline only inside a card's re-run (which holds it: awaiting
 * it again would deadlock), or when the caller says it runs inside its own locked task (`inLock`, M4). Any other
 * locked task on this client holding the lock is no reason to run inline: the step queues behind it.
 */
function gmStep<T>(fn: () => Promise<T>, inLock = false): Promise<T> {
  const cls = actorClass();
  return inLock || cls?.actingAuthor || cls?.inAuthorRun ? fn() : withGmLock(fn);
}

async function writeRecord(rec: X.DamageRecord): Promise<void> {
  await G().settings.set(SYSTEM_ID, DAMAGE_SETTING, rec, { sr2eRelay: true });
  X.resetRecordCache();
}
async function writeMeta(m: X.DamageMeta): Promise<void> {
  await G().settings.set(SYSTEM_ID, META_SETTING, m, { sr2eRelay: true });
}

/** The server's clock (ms): a rise is compared with a card's creation time and an item's modified time (the server's). */
const nowMs = (): number => { const t = Number(G()?.time?.serverTime); return Number.isFinite(t) && t > 0 ? t : Date.now(); };
/** When a chat card was made (the server's stamp; its author can't change it), ms. */
const cardTime = (card: any): number => Number(card?._stats?.createdTime ?? card?.timestamp ?? 0) || 0;
const timeText = (ms: number): string => (ms > 0 ? new Date(ms).toLocaleString() : tx('SR2E.Clinic99.timeUnknown'));

/** Every item there is by its record key (world items, actors' and unlinked tokens' items). */
function itemIndex(): Map<string, any> {
  const out = new Map<string, any>();
  for (const i of [...((G()?.items ?? []) as any[])]) out.set(X.recordKey(i?.uuid), i);
  for (const a of allActors()) for (const i of [...(a?.items ?? [])]) out.set(X.recordKey(i?.uuid), i);
  return out;
}

/** The GM is told of every entry that left the record to make room (fix2 M2, L2), naming the ware. */
async function tellEvicted(gone: any, key: string, info: X.RiseInfo | undefined, by: any): Promise<void> {
  const what = escHtml(String(gone?.name ?? info?.name ?? key));
  const owner = gone?.parent ? name(gone.parent) : escHtml(X.actorKeyOf(key));
  await post(`<p><em>${tx('SR2E.Clinic99.gmOnly')}</em> ${tx('SR2E.Clinic99.recordEvicted', { item: what, owner, by: name(by), byOwner: name(by?.parent) })}</p>`, { whisper: gmIds() });
}

/**
 * GM only: the record keeps this item at least at `level` (a rise; never lowered here), and notes the rise's time
 * and the ware's name and kind (fix2 M1, M3). Ware not installed isn't recorded (fix2 M2; `force`: the GM's own
 * setting, or a deleted ware's note applied); a rise for installed ware is never refused: an older entry makes room.
 */
export async function recordRise(item: any, level: unknown, o: { force?: boolean } = {}): Promise<boolean> {
  if (!isGm() || !item?.uuid) return false;
  if (!o.force && !item.system?.installed) return false;
  const rec = damageRecord();
  const key = X.recordKey(item.uuid);
  const next = X.worse(rec[key], level);
  if (!next || next === rec[key]) return false;
  const idx = itemIndex();
  const w = X.recordWith(rec, key, next, (k) => Boolean(idx.get(k)?.system?.installed));
  if (w.refused) {
    // Lead fix (final re-review 1): the character's share is full of damage at least this bad: the GM is told.
    await post(`<p><em>${tx('SR2E.Clinic99.gmOnly')}</em> ${tx('SR2E.Clinic99.recordFull', { owner: name(item.parent), max: X.RECORD_PER_ACTOR })}</p>`, { whisper: gmIds() });
    return false;
  }
  await writeRecord(w.rec);
  const was = damageMeta();
  await writeMeta(X.metaInfoWithout(X.metaRose(was, key, nowMs(), item.name, item.system?.kind), w.evicted));
  for (const k of w.evicted) await tellEvicted(idx.get(k), k, was.info[k], item);
  return true;
}

/** GM only: the record forgets this item (a repair, or the GM's own clearing), stamped as cleared now; `used`: the ids that cleared it (marked used even with nothing recorded). */
export async function recordClear(item: any, used: readonly unknown[] = []): Promise<boolean> {
  if (!isGm() || !item?.uuid) return false;
  const rec = damageRecord();
  const key = X.recordKey(item.uuid);
  let m = X.metaInfoWithout(X.metaCleared(damageMeta(), key, nowMs()), [key]);
  if (used.length) m = X.metaUse(m, used);
  await writeMeta(m);
  if (!rec[key]) return false;
  await writeRecord(X.recordWithout(rec, [key]));
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

/**
 * The changes a repair project writes when done: the item's own level cleared, and the repair test's id (the lead GM
 * then clears the record or asks the GM: Shadowtech pp. 36–41, the ware is repaired when the work is done). None under 'v980'.
 */
export function repairChanges(testId?: unknown): Array<[string, unknown]> {
  if (!X.on('damageLevels')) return [];
  const id = String(testId ?? '').slice(0, 80);
  return [[`flags.${SYSTEM_ID}.${X.WARE_FLAG}`, ''], ...(id ? [[`flags.${SYSTEM_ID}.${FIX_FLAG}`, id] as [string, unknown]] : [])];
}

/** The newest card of a repair test (by its id), or null. */
function repairCard(testId: unknown): any {
  const id = String(testId ?? '');
  if (!id) return null;
  const list: any[] = [...((G()?.messages?.contents ?? []) as any[])];
  for (let i = list.length - 1; i >= 0; i--) {
    const snap = list[i]?.flags?.[SYSTEM_ID]?.test;
    if (snap?.kind === 'cyberRepair' && String(snap.testId ?? '') === id) return list[i];
  }
  return null;
}

/** The TN a repair at the recorded level must have beaten (book: by level and grade; else the repair table's). */
function proofTn(item: any, level: string): number {
  const spec = X.on('repair') && !item?.system?.bioware ? X.repairSpec(level || 'M', String(item?.system?.grade ?? 'standard'), baseEssence(item)) : null;
  return spec && !spec.why ? spec.tn : Number(RULES.CYBERWARE.repair.tn) || 0;
}

/**
 * The GM's check of a repair test behind a clear (S4): its card (by the test's id) is a cyberRepair of this item, its
 * author owns the ware's character and the repairer, it has successes at the recorded level's TN (counted again from
 * its dice), it was made after the damage last rose (fix2 M1), and neither it nor the clear card has cleared a record before. `author`: the clear card's author must be
 * the repair card's (a card the GM's client posted: none). Null when it doesn't check out.
 */
export function repairProofFor(item: any, testId: unknown, o: { author?: any; clearId?: string } = {}): { card: any; successes: number; tn: number; roller: string; cardAt: number; roseAt: number } | null {
  const card = repairCard(testId);
  const owner = item?.parent;
  if (!card || !owner) return null;
  const snap = card.flags[SYSTEM_ID].test;
  const meta = damageMeta();
  if (X.metaUsed(meta, [`test:${String(testId)}`, o.clearId ? `card:${o.clearId}` : ''])) return null;
  // fix2 M1: the repair card must be newer than the damage's last rise (an old test proves nothing about new damage).
  const key = X.recordKey(item.uuid);
  const cardAt = cardTime(card);
  if (!X.newerThanRise(meta, key, cardAt)) return null;
  if (o.author && String(card.author?.id ?? card.author) !== String(o.author?.id ?? o.author)) return null;
  if (!authorOwns(card, owner)) return null;
  const roller = sync(snap.actorUuid);
  if (!roller || !authorOwns(card, roller)) return null;
  const tn = proofTn(item, X.recordedLevel(item.uuid) || X.levelOf(snap.cyberRepair?.level99));
  const successes = X.repairProof(snap, { itemId: String(item.id ?? ''), ownerUuid: String(owner.uuid ?? ''), tn });
  return successes > 0 ? { card, successes, tn, roller: String(roller.name ?? ''), cardAt, roseAt: meta.info[key]?.at ?? 0 } : null;
}

/** The "clear the damage record" card for the GM: whispered, naming the item and the repair test (S4). */
async function askClear(item: any, level: string, testId: unknown, o: { repairer?: any; author?: any } = {}): Promise<void> {
  const owner = item.parent;
  await post(`<p><em>${tx('SR2E.Clinic99.gmOnly')}</em> ${tx('SR2E.Clinic99.clearAsk', { item: name(item), owner: name(owner), level: escHtml(levelLabel(level)) })}</p><p><button type="button" data-sr2e-action="clinic99Clear">${tx('SR2E.Clinic99.clearButton')}</button></p>`,
    { speaker: speaker(o.repairer ?? owner), whisper: gmIds(), ...(o.author ? { author: String(o.author.id) } : {}),
      flags: { [SYSTEM_ID]: { [CLEAR_FLAG]: { itemUuid: String(item.uuid), ownerUuid: String(owner?.uuid ?? ''), testId: String(testId ?? '').slice(0, 80) } } } });
}

/**
 * A repair succeeded (on the repairer's client, or the GM's re-run of their card). A project repair does nothing
 * now: the project's effect, when the work is done, clears the item's level and the lead GM clears the record or
 * asks (S5). Otherwise the item's own level is cleared now, and the record: the GM acting for themselves clears it;
 * anyone else (a GM's re-run of a player's card included, S1) posts the card asking the GM. Refused when the player
 * a re-run acts for doesn't own the ware's character.
 */
export async function repaired(item: any, o: { project?: boolean; repairer?: any; testId?: string } = {}): Promise<string> {
  if (!X.on('damageLevels') || !item) return '';
  if (o.project) return '';
  const owner = item.parent;
  const acting = actingPlayer();
  if (acting && !owner?.testUserPermission?.(acting, 'OWNER')) return '';
  const level = X.wareLevel(item);
  try { await item.setFlag(SYSTEM_ID, X.WARE_FLAG, ''); } catch { /* not ours */ }
  const recorded = X.recordedLevel(item.uuid);
  // fix2 M1: the GM's own repair marks its test used even with nothing recorded.
  if (gmSelf()) { if (recorded || o.testId) await gmStep(() => recordClear(item, o.testId ? [`test:${o.testId}`] : [])); return ''; }
  if (!recorded) return '';
  await askClear(item, level || recorded, o.testId, { repairer: o.repairer, author: acting });
  return ` ${tx('SR2E.Clinic99.clearAsked')}`;
}

/**
 * The lead GM, when a repair project's effect has written its test's id on the ware (S5): the record is cleared
 * directly only when both the repair test and the item update that wrote the id are a GM's (fix2 M1: `userId`, the
 * writer); else the GM is asked (only for a test that checks out). The test is marked used even with nothing recorded.
 */
export async function completedRepair(item: any, testId: unknown, userId?: string): Promise<boolean> {
  if (!isGm() || !X.on('damageLevels') || !item || item.type !== 'cyberware') return false;
  const id = String(testId ?? '').slice(0, 80);
  if (!id) return false;
  const recorded = X.recordedLevel(item.uuid);
  if (!recorded) { const m = damageMeta(); if (!X.metaUsed(m, [`test:${id}`])) await writeMeta(X.metaUse(m, [`test:${id}`])); return false; }
  const proof = repairProofFor(item, id);
  if (!proof) return false;
  const author = G()?.users?.get?.(String(proof.card.author?.id ?? proof.card.author));
  const writer = G()?.users?.get?.(String(userId ?? ''));
  if (author?.isGM && writer?.isGM) { await recordClear(item, [`test:${id}`]); return true; }
  await askClear(item, recorded, id);
  return true;
}

/** A GM's TN change undid a repair: the item's level goes back (a rise only; the lead GM records it again). */
export async function unrepaired(item: any, level: unknown): Promise<void> {
  const l = X.levelOf(level);
  if (!X.on('damageLevels') || !item || !l) return;
  try { await item.setFlag(SYSTEM_ID, X.WARE_FLAG, X.worse(X.itemLevel(item), l)); } catch { /* not ours */ }
}

/** Whether a repair undone by a GM's TN change marks the ware damaged again (C7: not for Light damage). */
export function redamages(level: unknown): boolean { return X.redamages(level); }

// ---------------------------------------------------------------- Surgery: fees and the clinic

/** The grade an operation is charged at: frozen on its card when rolled (S6), else the item's. */
const gradeFor = (item: any, frozen?: unknown): string => X.gradeOf(frozen) || String(item?.system?.grade ?? 'standard');

/** The card's frozen grade for a surgery about to be rolled (S6), or nothing under 'v980' of both fee switches. */
export function frozenGrade(item: any): { grade99?: string } {
  return X.on('surgeonFee') || X.on('gradedFees') ? { grade99: gradeFor(item) } : {};
}

/**
 * The operation's size for the fee (C3): cyberware by the Essence it actually costs (its grade applied, as it stands:
 * after the book's surgery changed it), bioware by its Body Index.
 */
function feePoints(item: any, points: number, grade: string): number {
  if (item?.system?.bioware) return points;
  return essenceLoss({ essenceCost: Math.max(0, Number(item?.system?.essenceCost ?? points) || 0), grade: grade as any });
}

/** The surgeon's fee for this operation and the graded multiplier on its care, with the clinic note. */
export function surgeryCharges(patient: any, item: any, points: number, frozen?: unknown): { fee: number; factor: number; clinic: boolean | null } {
  const bio = Boolean(item?.system?.bioware);
  const grade = gradeFor(item, frozen);
  const graded = !bio && ['alpha', 'beta', 'delta'].includes(grade);
  return {
    fee: X.surgeonFee(feePoints(item, points, grade), bio),
    factor: X.feeFactor(grade, bio),
    clinic: X.on('clinicSearch') && graded ? X.hasClinic(clinicRecord(), X.recordKey(patient?.uuid), grade) : null,
  };
}

/** The care's daily cost multiplier for this ware (Cybertechnology p. 44: graded clinics × 50 / × 200), at the card's frozen grade. */
export function careFactor99(item: any, frozen?: unknown): number {
  return X.feeFactor(gradeFor(item, frozen), Boolean(item?.system?.bioware));
}

/**
 * The refund for the care days left when the patient's care changes (C7): what they would cost at today's rate, but
 * never more than was paid for the recovery (its `paidAmount`; a recovery from before has none: the old way).
 */
export function careRefund(r: any, atToday: number): number {
  const paid = Number(r?.paidAmount);
  if (!X.on('gradedFees') || !(paid > 0)) return atToday;
  return Math.min(atToday, paid);
}

/** Whether this operation's fee was paid: the GM's client asks the GM-written record, a player's client their own flag. */
function feeIsPaid(patient: any, keys: readonly string[]): boolean {
  if (isGm()) return X.feePaid(feeRecord()[X.recordKey(patient?.uuid)], keys);
  return X.feePaid(patient?.getFlag?.(SYSTEM_ID, FEE_FLAG) as Record<string, unknown> | undefined, keys);
}

/**
 * The surgeon's fee, charged to the patient once per operation (its id) and once per item put in (P4). On the GM's
 * client the paid marker is the GM-written record (S6); on a player's client (their own surgery, their own money) it is
 * the patient's flag. `inLock`: the caller runs inside its own locked task (the GM's Apply of a surgery card, M4).
 * Returns the card's note ('' when there is no fee and no clinic to note).
 */
export async function chargeSurgeonFee(patient: any, item: any, op: { id?: string; points: number; pay?: boolean; itemName: string; grade?: unknown; inLock?: boolean }): Promise<string> {
  if (!patient || !item) return '';
  const c = surgeryCharges(patient, item, op.points, op.grade);
  const gradeText = escHtml(tKey(`SR2E.Clinic99.Grade.${gradeFor(item, op.grade)}`));
  let note = '';
  if (c.clinic === false) note += ` ${tx('SR2E.Clinic99.noClinic', { grade: gradeText })}`;
  if (c.clinic === true) note += ` ${tx('SR2E.Clinic99.atClinic', { grade: gradeText })}`;
  if (!c.fee || !op.pay || !op.id) return note;
  const keys = X.feeKeys(op.id, item.id);
  if (feeIsPaid(patient, keys)) return note;
  const ok = await patient.adjustNuyen?.(-c.fee, tx('SR2E.Clinic99.feeReason', { item: String(op.itemName ?? '') }));
  if (!ok) return `${note} <em>${tx('SR2E.Clinic99.feeShort', { patient: name(patient), fee: c.fee.toLocaleString() })}</em>`;
  const marks = Object.fromEntries(keys.map((k) => [k, c.fee]));
  if (isGm()) {
    const pk = X.recordKey(patient.uuid);
    try { await gmStep(() => G().settings.set(SYSTEM_ID, FEE_SETTING, X.feeWith(feeRecord(), pk, keys, c.fee), { sr2eRelay: true }), Boolean(op.inLock)); } catch { /* not saved */ }
  } else { try { await patient.setFlag(SYSTEM_ID, FEE_FLAG, marks); } catch { /* not saved */ } }
  return `${note} ${tx('SR2E.Clinic99.feePaid', { fee: c.fee.toLocaleString() })}`;
}

/** The fee line for the GM's confirm before applying a surgery card (plain text). */
export function feeApplyText(patient: any, item: any, op: { id?: string; points: number; pay?: boolean; grade?: unknown }): string {
  const c = surgeryCharges(patient, item, op.points, op.grade);
  if (!c.fee || !op.pay || (op.id && feeIsPaid(patient, X.feeKeys(op.id, item?.id)))) return '';
  return ` ${tx('SR2E.Clinic99.feeConfirm', { fee: c.fee.toLocaleString() })}`;
}

/** The ware came out (the GM's removal): a new operation putting it in pays the surgeon again. */
async function feeForget(patient: any, item: any): Promise<void> {
  const pk = X.recordKey(patient?.uuid);
  const rec = feeRecord();
  const next = X.feeWithout(rec, pk, String(item?.id ?? ''));
  if (next !== rec) await G().settings.set(SYSTEM_ID, FEE_SETTING, next, { sr2eRelay: true });
  const own = patient?.getFlag?.(SYSTEM_ID, FEE_FLAG);
  const k = `${String(item?.id ?? '')}-install`;
  if (own && typeof own === 'object' && Object.hasOwn(own, k)) { try { await patient.update({ [`flags.${SYSTEM_ID}.${FEE_FLAG}.${k}`]: null }); } catch { /* not saved */ } }
}

/** Surgery refused (P4): ware already in (the book's flow: remove it first); a player is warned. */
export function surgeryRefused(item: any): boolean {
  if (!X.on('surgeonFee') || !item?.system?.installed) return false;
  warn(tx('SR2E.Clinic99.alreadyIn', { name: escHtml(String(item.name ?? '')) }));
  return true;
}

/** The sheet's Surgery button: one operation at a time per item on this client (a double click opens one dialog, P4). */
const surgeryBusy = new Set<string>();
export async function oneSurgery(key: string, fn: () => Promise<unknown>): Promise<void> {
  if (surgeryBusy.has(key)) return;
  surgeryBusy.add(key);
  try { await fn(); } finally { surgeryBusy.delete(key); }
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
  // S8: still in when the step runs (another removal, or the owner's change, may have come between).
  const done = await gmStep(async () => {
    if (!item.system?.installed || item.parent?.uuid !== patient.uuid) return false;
    await item.update({ 'system.installed': false }, { [REMOVAL_OPT]: true });
    if (loss > 0) await patient.update({ 'system.essenceShift': Math.round(((Number(patient.system?.essenceShift) || 0) - loss) * 100) / 100 });
    await feeForget(patient, item);
    return true;
  });
  if (!done) { warn(tx('SR2E.Clinic99.notInNow', { name: name(item) })); return null; }
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
    if (l) { await recordClear(item); await recordRise(item, l, { force: true }); } else await recordClear(item);
  });
  await post(`<p><em>${tx('SR2E.Clinic99.gmOnly')}</em> ${tx('SR2E.Clinic99.levelSet', { item: name(item), owner: name(item.parent), level: escHtml(levelLabel(l)) })}</p>`, { whisper: gmIds() });
  return true;
}

async function damageTool(): Promise<void> {
  const p = await pickWare(tx('SR2E.Clinic99.Damage.title'), (i: any) => i.type === 'cyberware' && !i.system?.bioware, 'level');
  if (p) await setLevelAsGm(p.item, p.extra.level);
}

/** The GM's "Clinics and ware damage (book)" tool: the operations whose switches are at the book's way. One at a time (S8, P6). */
let toolOpen = false;
export async function openClinicTool(): Promise<void> {
  if (!isGm() || toolOpen) return;
  toolOpen = true;
  try { await clinicToolMenu(); } finally { toolOpen = false; }
}
async function clinicToolMenu(): Promise<void> {
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
 * The GM's click on a "clear the damage record" card: the item and its owner come from the documents (the card only
 * names the item); the author must own the item's actor; the repair test it names must check out (S4: its card, same
 * author, a cyberRepair of this item with successes at the level's TN, the repairer the author's); a card or test that
 * cleared a record once is refused (P1, kept GM-side); the GM confirms with the record's level and the repair shown.
 */
export async function applyClear(message: any): Promise<boolean> {
  if (!isGm()) return false;
  const f: any = message?.flags?.[SYSTEM_ID]?.[CLEAR_FLAG];
  const item: any = uuidOk(f?.itemUuid) ? sync(f.itemUuid) : null;
  if (!item || item.type !== 'cyberware') { warn(tx('SR2E.Clinic99.gmCardOnly')); return false; }
  const owner = item.parent;
  if (!authorOwns(message, owner)) { warn(tx('SR2E.Clinic99.notTheirs')); return false; }
  const clearId = String(message?.id ?? '');
  if (X.metaUsed(damageMeta(), [`card:${clearId}`])) { warn(tx('SR2E.Clinic99.clearUsed')); return false; }
  const recorded = X.recordedLevel(item.uuid);
  if (!recorded) { warn(tx('SR2E.Clinic99.nothingRecorded')); return false; }
  const byGm = Boolean(message?.author?.isGM);
  const proof = repairProofFor(item, f?.testId, { clearId, ...(byGm ? {} : { author: message?.author }) });
  if (!proof) { warn(tx('SR2E.Clinic99.noRepairProof')); return false; }
  const ok = await gmMay(message, { title: tx('SR2E.Clinic99.clearTitle'), lines: [tx('SR2E.Clinic99.clearLine', { item: String(item.name ?? ''), owner: String(owner?.name ?? ''), level: levelLabel(recorded) }), tx('SR2E.Clinic99.clearProof', { roller: proof.roller, successes: proof.successes, tn: proof.tn }), tx('SR2E.Clinic99.clearTimes', { card: timeText(proof.cardAt), rose: timeText(proof.roseAt) })], sources: [owner?.uuid], always: true });
  if (!ok) return false;
  const done = await gmStep(async () => {
    // Checked again inside the step (two GMs, or a double click past the guard).
    if (X.metaUsed(damageMeta(), [`card:${clearId}`, `test:${String(f?.testId ?? '')}`])) return false;
    await recordClear(item, [`card:${clearId}`, `test:${String(f?.testId ?? '')}`]);
    if (X.itemLevel(item)) await item.update({ [`flags.${SYSTEM_ID}.${X.WARE_FLAG}`]: '' });
    return true;
  });
  if (!done) { warn(tx('SR2E.Clinic99.clearUsed')); return false; }
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

/**
 * The lead GM copies rises of the ware's own level into the record (sweeps once at start for any made while away),
 * skipping a level the GM cleared since the item last changed (P2), and drops keys whose item is gone (S2).
 */
export async function sweepLevels(): Promise<number> {
  if (!isGm() || !X.on('damageLevels')) return 0;
  let n = 0;
  const meta = damageMeta();
  for (const a of allActors()) {
    for (const i of [...(a?.items ?? [])]) {
      if (i?.type !== 'cyberware' || i.system?.bioware) continue;
      const own = X.trustedOwnLevel(i);
      if (!own || X.clearedSince(meta, X.recordKey(i.uuid), i._stats?.modifiedTime)) continue;
      if (X.worse(own, X.recordedLevel(i.uuid)) !== X.recordedLevel(i.uuid) && (await recordRise(i, own))) n++;
    }
  }
  const rec = damageRecord();
  const live = itemIndex();
  const dead = Object.keys(rec).filter((k) => !live.has(k));
  if (dead.length) await writeRecord(X.recordWithout(rec, dead));
  const m = damageMeta();
  const stale = Object.keys(m.info).filter((k) => !damageRecord()[k]);
  if (stale.length) await writeMeta(X.metaInfoWithout(m, stale));
  return n;
}

/** A ware's name and kind as a note matches them. */
const sameWare = (i: any, nm: string, kind: string): boolean => String(i?.name ?? '').slice(0, 200) === nm && String(i?.system?.kind ?? '').slice(0, 60) === kind;

/**
 * The lead GM, when a recorded ware is deleted: its key leaves the record (S2). Deleted by a player (fix2 M3): by the
 * name and kind it had when its level was first recorded, every character that player owns (and the ware's own) gets
 * the level: an installed copy already there now, else a note for a copy made later (or moved back); the GM is told.
 */
export async function wareDeleted(item: any, userId: string): Promise<void> {
  if (!isGm() || !X.on('damageLevels') || item?.type !== 'cyberware') return;
  const key = X.recordKey(item.uuid);
  const rec = damageRecord();
  const meta = damageMeta();
  const info = meta.info[key];
  const level = X.worse(rec[key], item.system?.installed ? X.trustedOwnLevel(item) : '');
  if (rec[key]) await writeRecord(X.recordWithout(rec, [key]));
  let m = info ? X.metaInfoWithout(meta, [key]) : meta;
  const user = G()?.users?.get?.(userId);
  if (!level || user?.isGM || !item.parent || item.system?.bioware) { if (m !== meta) await writeMeta(m); return; }
  const nm = info?.name || String(item.name ?? '').slice(0, 200);
  const kind = info ? info.kind : String(item.system?.kind ?? '').slice(0, 60);
  const actors = [item.parent, ...(user ? people().filter((a: any) => a?.testUserPermission?.(user, 'OWNER')) : [])]
    .filter((a: any, n: number, all: any[]) => a?.uuid && all.findIndex((b: any) => b?.uuid === a.uuid) === n);
  const copies: any[] = [];
  const evicted: X.GoneEntry[] = [];
  for (const a of actors) {
    // Lead fix (final re-review 2): an uninstalled copy counts too (it gets the level now, recorded by force).
    const here = [...(a.items ?? [])].filter((i: any) => i.id !== item.id && i.type === 'cyberware' && !i.system?.bioware && sameWare(i, nm, kind));
    if (here.length) { copies.push(...here); continue; }
    const r = X.metaGone(m, { actor: X.recordKey(a.uuid), name: nm, kind, level, at: nowMs() });
    m = r.meta;
    evicted.push(...r.evicted);
  }
  await writeMeta(m);
  for (const e of evicted) await post(`<p><em>${tx('SR2E.Clinic99.gmOnly')}</em> ${tx('SR2E.Clinic99.goneEvicted', { item: escHtml(e.name), level: escHtml(levelLabel(e.level)) })}</p>`, { whisper: gmIds() });
  for (const c of copies) {
    await recordRise(c, level, { force: true });
    await post(`<p><em>${tx('SR2E.Clinic99.gmOnly')}</em> ${tx('SR2E.Clinic99.copyGotLevel', { item: name(c), owner: name(c.parent), level: escHtml(levelLabel(level)) })}</p>`, { whisper: gmIds() });
  }
}

/** The lead GM, when cyberware is made on a character that deleted recorded ware of that name and kind: it keeps the level (S3). */
export async function wareCreated(item: any): Promise<boolean> {
  if (!isGm() || !X.on('damageLevels') || item?.type !== 'cyberware' || item.system?.bioware || !item.parent) return false;
  const t = X.metaTake(damageMeta(), X.recordKey(item.parent.uuid), String(item.name ?? ''), String(item.system?.kind ?? ''));
  if (!t.entry) return false;
  await writeMeta(t.meta);
  await recordRise(item, t.entry.level, { force: true });
  await post(`<p><em>${tx('SR2E.Clinic99.gmOnly')}</em> ${tx('SR2E.Clinic99.cameBack', { item: name(item), owner: name(item.parent), level: escHtml(levelLabel(t.entry.level)) })}</p>`, { whisper: gmIds() });
  return true;
}

/**
 * preUpdateItem (C6): under the book's removal, a player's unticking of Installed on cyberware is refused (the GM's
 * tool removes it, with the removal test); inside a GM's re-run of a player's card it is refused too; a GM acting for
 * themselves is only warned. False: nothing left of the change.
 */
export function preUntick(item: any, change: any, userId?: string, options: any = {}): false | void {
  if (options?.[REMOVAL_OPT] && isGm()) return;
  if (!X.on('removal') || item?.type !== 'cyberware' || item.system?.bioware || !item.system?.installed) return;
  if (change?.system?.installed !== false && change?.['system.installed'] !== false) return;
  const user = G()?.users?.get?.(userId) ?? (userId === undefined ? G()?.user : null);
  const asGm = Boolean(user?.isGM) && !actingPlayer();
  if (asGm) { warn(tx('SR2E.Clinic99.untickGm', { name: escHtml(String(item.name ?? '')) })); return; }
  warn(tx('SR2E.Clinic99.untickRefused', { name: escHtml(String(item.name ?? '')) }));
  if (change.system) { delete change.system.installed; if (!Object.keys(change.system).length) delete change.system; }
  delete change['system.installed'];
  if (!Object.keys(change).filter((k) => k !== '_id').length) return false;
}

const installedNow = (change: any): boolean => change?.system?.installed === true || change?.['system.installed'] === true;

/** C6/S9 gap (fix2): a player's cyberware went from installed to not installed under the book's removal (past the refusal). */
export function untickedByPlayer(item: any, change: any, userId: string): boolean {
  if (!X.on('removal') || item?.type !== 'cyberware' || item.system?.bioware || item.system?.installed) return false;
  if (change?.system?.installed !== false && change?.['system.installed'] !== false) return false;
  return !G()?.users?.get?.(userId)?.isGM;
}
/** The lead GM's whisper for it (after the fact: nothing is written back). */
export async function tellUnticked(item: any, userId: string): Promise<void> {
  const who = escHtml(String(G()?.users?.get?.(userId)?.name ?? ''));
  await post(`<p><em>${tx('SR2E.Clinic99.gmOnly')}</em> ${tx('SR2E.Clinic99.untickedAfter', { name: name(item), owner: name(item.parent), user: who })}</p>`, { whisper: gmIds() });
}

export function registerClinic99(isLead: () => boolean): void {
  const s: any = G()?.settings;
  let last: X.DamageRecord = {};
  s?.register?.(SYSTEM_ID, CLINIC_SETTING, { scope: 'world', config: false, type: Object, default: {} });
  s?.register?.(SYSTEM_ID, META_SETTING, { scope: 'world', config: false, type: Object, default: {} });
  s?.register?.(SYSTEM_ID, FEE_SETTING, { scope: 'world', config: false, type: Object, default: {} });
  s?.register?.(SYSTEM_ID, DAMAGE_SETTING, { scope: 'world', config: false, type: Object, default: {}, onChange: (v: unknown) => {
    X.resetRecordCache();
    const next = X.damageRecord(v);
    const keys = new Set<string>([...Object.keys(last), ...Object.keys(next)].filter((k) => last[k] !== next[k]));
    last = next;
    refreshFor(keys);
  } });
  X.setDamageRecordSource(() => readSetting(DAMAGE_SETTING));
  const H: any = (globalThis as any).Hooks;
  const run = (what: () => Promise<unknown>): void => { void withGmLock(what).catch((err) => console.warn('sr2e | ware damage', err)); };
  H?.on?.('preUpdateItem', (item: any, change: any, o: any, userId: string) => preUntick(item, change, userId, o));
  H?.on?.('updateItem', (item: any, change: any, _o: any, userId: string) => {
    if (!isLead() || item?.type !== 'cyberware') return;
    if (untickedByPlayer(item, change, userId)) run(() => tellUnticked(item, userId));
    if (!X.on('damageLevels')) return;
    const fix = change?.flags?.[SYSTEM_ID]?.[FIX_FLAG];
    if (typeof fix === 'string' && fix) run(() => completedRepair(item, fix, userId));
    // fix2 M2: a level is recorded from the item when it changes, or when the ware goes in.
    // Lead fix (final re-review 2): ware going in takes a deleted ware's note for its character, name and kind.
    if (installedNow(change)) run(() => wareCreated(item));
    if (change?.flags?.[SYSTEM_ID]?.[X.WARE_FLAG] === undefined && !installedNow(change)) return;
    const own = X.trustedOwnLevel(item);
    if (own) run(() => recordRise(item, own));
  });
  H?.on?.('deleteItem', (item: any, _o: any, userId: string) => {
    if (isLead() && item?.type === 'cyberware') run(() => wareDeleted(item, userId));
  });
  H?.on?.('createItem', (item: any) => {
    if (isLead() && item?.type === 'cyberware') run(() => wareCreated(item));
  });
  H?.once?.('ready', () => {
    last = damageRecord();
    void leadSettled().then(() => { if (isLead()) run(() => sweepLevels()); });
  });
}
