/**
 * v0.96.0 rules completeness (sorcery): the Foundry side of rules/sorcery96.ts (RULES.SORCERY_V96).
 *
 * - Defaulting a magical skill (Awakenings p. 93): `magicDefaultFor` (castSpell asks it when there is no Sorcery).
 * - The active foci limit (Core p. 137): a `preUpdateItem` hook refuses (or warns about) switching on one focus more
 *   than the owner's Intelligence (`fociLimitBlocks`, testable).
 * - A ward's days (Grimoire p. 92): a new ward with days gets its end on the world clock (`createActor`, the lead GM);
 *   when the clock passes it, `wardSweep` lowers it to 0 and whispers the GMs a card.
 * - Masking (Grimoire p. 46): `maskTest` (assense asks it), a secret Magic test whispered to the GMs.
 * - Centering for spellcasting or Drain (Grimoire p. 43): `centeringRoll` (castSpell asks it before the cast).
 * - Quickening (Grimoire pp. 44–45): `askQuicken` (the Quicken button's window).
 * - Noticing spellcasting (Core p. 132): `noticeNote` (the cast card's line).
 *
 * It imports nothing from documents/ or the sheets (they call into this file).
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES } from '../rules/config.ts';
import { successTest, type DiceRoller, type TargetNumberModifier } from '../rules/dice.ts';
import { escHtml } from '../rules/html.ts';
import { getSkillWeb, webDistance } from '../rules/skills.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { sysNow } from '../helpers/clock.ts';
import { isLeadGm } from './leader.ts';
import * as S from '../rules/sorcery96.ts';

const g = (): any => globalThis as any;
const num = (x: unknown): number => (Number.isFinite(Number(x)) ? Number(x) : 0);
const gmIds = (): string[] => { try { return (g().ChatMessage?.getWhisperRecipients?.('GM') ?? []).map((u: any) => String(u.id)); } catch { return []; } };
const post = async (data: Record<string, unknown>): Promise<any> => g().ChatMessage?.create?.(data);
const alias = (): { alias: string } => ({ alias: tx('SR2E.Sorcery96.alias') });

/** A system skill name from its id ("magicalTheory" → "Magical Theory"; findSkill ignores case). */
export function skillNameOf(id: string): string {
  return id.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

/** Real Foundry dice for the pure engine (each wave a Roll, kept for the card). */
function roller(sink: any[]): DiceRoller {
  return async (count: number) => {
    const roll = await new (g().Roll)(`${count}d6`).evaluate();
    sink.push(roll);
    return roll.dice[0].results.map((r: any) => r.result as number);
  };
}

/** One line for a test on a card: dice, TN and successes. */
function resultLine(label: string, r: { successes: number; targetNumber: number; totalDice: number }): string {
  return `<p><strong>${escHtml(label)}</strong> ${tx('SR2E.Sorcery96.Card.result', { dice: r.totalDice, tn: r.targetNumber, successes: r.successes })}</p>`;
}

// ---------------------------------------------------------------- Defaulting (Awakenings p. 93)

const DEFAULT_SKILLS = ['magicalTheory', 'conjuring', 'enchanting'] as const;

/** How this actor would default Sorcery to cast (null: the switch is off, or nothing to default to). */
export function magicDefaultFor(actor: any): S.MagicDefault | null {
  if (!S.s96('magicDefault') || !actor || num(actor.system?.derived?.magic) <= 0) return null;
  const ratings: Partial<Record<(typeof DEFAULT_SKILLS)[number], number>> = {};
  const steps: Record<string, number | null> = {};
  const web = getSkillWeb();
  const sorcery = skillNameOf('sorcery');
  for (const k of DEFAULT_SKILLS) {
    ratings[k] = num(actor.findSkill?.(skillNameOf(k))?.system?.rating);
    steps[k] = web.length ? webDistance(web, sorcery, skillNameOf(k)) : null;
  }
  steps.willpower = web.length ? webDistance(web, sorcery, skillNameOf('willpower')) : null;
  return S.magicDefault({ ratings, willpower: num(actor.system?.attributes?.willpower?.total), steps });
}

// ---------------------------------------------------------------- Noticing (Core p. 132)

/** The cast card's noticing note ('' with the switch off). */
export function noticeNote(magic: number, force: number): string {
  const tn = S.noticeTn(magic, force);
  return tn === null ? '' : ` [${tx('SR2E.Sorcery96.Card.notice', { tn })}]`;
}

// ---------------------------------------------------------------- The active foci limit (Core p. 137)

/**
 * Whether switching this focus on breaks the limit: `refuse` (the update is stopped) or a warning only. Null: allowed,
 * not a focus being switched on, or the switch off.
 */
export function fociLimitBlocks(item: any, change: any): { refuse: boolean; why: string } | null {
  if (item?.type !== 'focus' || change?.system?.active !== true || item.system?.active) return null;
  const actor = item.parent;
  if (!actor || actor.documentName !== 'Actor') return null;
  const active = [...(actor.items ?? [])].filter((i: any) => i.type === 'focus' && i.system?.active && i.id !== item.id).length;
  return S.fociLimit(active, num(actor.system?.attributes?.intelligence?.total));
}

// ---------------------------------------------------------------- Wards (Grimoire p. 92)

/** A new ward with days: its end on the world clock (the creating GM's update data, or null). */
export function wardStamp(actor: any, now: number): Record<string, number> | null {
  if (actor?.type !== 'barrier' || num(actor.system?.wardEnds96) > 0) return null;
  const ends = S.wardEndsAt(now, num(actor.system?.wardDays96));
  return ends > 0 ? { 'system.wardEnds96': ends } : null;
}

/** The wards whose days have run out by `now`: each falls (rating 0, by the book) and the GMs get a card. */
export async function wardSweep(actors: readonly any[], now: number): Promise<number> {
  let n = 0;
  for (const a of actors) {
    if (a?.type !== 'barrier') continue;
    const ends = num(a.system?.wardEnds96);
    const f = S.wardFalls(ends, now);
    if (!f.fall) continue;
    n++;
    await a.update({ 'system.wardEnds96': -1, ...(f.lower ? { 'system.rating': 0 } : {}) });
    await post({ speaker: alias(), whisper: gmIds(), content: `<p><strong>${escHtml(a.name)}</strong> ${f.lower ? tx('SR2E.Sorcery96.Card.wardFell') : tx('SR2E.Sorcery96.Card.wardDaysOver')}</p>` });
  }
  return n;
}

// ---------------------------------------------------------------- Masking (Grimoire p. 46)

/**
 * The secret test to see through a masked initiate's aura: the viewer's Magic against the subject's Magic, needing
 * the threshold. Whispered to the GMs. True: seen through (or nothing to see through); false: it reads as mundane.
 * Null with the switch off.
 */
export async function maskTest(viewer: any, subject: any, roll?: DiceRoller): Promise<boolean | null> {
  const sub = subject?.initiate;
  if (!sub || !sub.techniques?.includes?.('masking')) return null;
  const view = viewer?.initiate ?? { grade: 0, techniques: [] };
  const viewerInitiate = num(view.grade) > 0 || Boolean(viewer?.getFlag?.(SYSTEM_ID, 'initiated'));
  const th = S.maskThreshold({ subjectGrade: num(sub.grade), viewerGrade: num(view.grade), viewerInitiate });
  if (!th) return null;
  if (!th.can) return false;
  const rolls: any[] = [];
  const r = await successTest({ dice: num(viewer.system?.derived?.magic), targetNumber: Math.max(RULES.MIN_TARGET_NUMBER, num(subject.system?.derived?.magic)), roll: roll ?? roller(rolls) });
  const seen = r.successes >= th.need;
  await post({ speaker: alias(), whisper: gmIds(), rolls, content: `${resultLine(tx('SR2E.Sorcery96.Card.maskTest', { viewer: viewer.name, subject: subject.name }), r)}<p>${seen ? tx('SR2E.Sorcery96.Card.maskSeen', { need: th.need }) : tx('SR2E.Sorcery96.Card.maskHolds', { need: th.need })}</p>` });
  return seen;
}

/** What a masked subject's aura shows when the masking holds: a mundane's (no Magic, tradition or covered foci). */
export function maskedSubject<T extends { awakened: boolean; magic: number; tradition?: string; foci: string[]; sustained: string[] }>(subject: T, fociRating: number, grade: number): T {
  return { ...subject, awakened: false, magic: 0, tradition: '', sustained: [], foci: S.maskCoversFoci(fociRating, grade) ? [] : subject.foci };
}

// ---------------------------------------------------------------- Centering (Grimoire p. 43)

/**
 * A centering test before the cast: the centering skill's dice against the spell's or the Drain's TN (with its
 * modifiers). Posts its card; returns its successes (0 when it can't be made: the reason is a warning).
 */
export async function centeringRoll(actor: any, o: { use: S.CenterUse; dice: number; targetNumber: number; modifiers: TargetNumberModifier[]; spellName: string }, roll?: DiceRoller): Promise<number> {
  if (o.use === 'cast' && actor?.system?.derived?.astralMode !== 'perceiving') {
    g().ui?.notifications?.warn?.(tx('SR2E.Sorcery96.Why.centerPerceive', { name: escHtml(actor?.name ?? '') }));
    return 0;
  }
  const rolls: any[] = [];
  const r = await successTest({ dice: Math.max(0, num(o.dice)), targetNumber: o.targetNumber, modifiers: o.modifiers, roll: roll ?? roller(rolls) });
  await post({ speaker: g().ChatMessage?.getSpeaker?.({ actor }) ?? alias(), rolls, content: `${resultLine(o.use === 'cast' ? tx('SR2E.Sorcery96.Card.centerCast', { spellName: o.spellName }) : tx('SR2E.Sorcery96.Card.centerDrain', { spellName: o.spellName }), r)}<p>${tx('SR2E.Sorcery96.Card.centerBonus', { bonus: Math.floor(r.successes / 2) })}</p>` });
  return r.successes;
}

// ---------------------------------------------------------------- Quickening (Grimoire pp. 44–45)

/** The Quicken window: the casting test's dice and TN, and the Karma (Force to 2 × Force). Null: cancelled. */
export async function askQuicken(entry: { spellName: string; force: number }): Promise<{ dice: number; tn: number; karma: number } | null> {
  const D = g().foundry?.applications?.api?.DialogV2;
  if (!D) return null;
  const f = Math.max(1, num(entry.force));
  const r: any = await D.prompt({
    window: { title: tx('SR2E.Sorcery96.Dialog.quickenTitle', { spellName: entry.spellName }) },
    content: `<div class="form-group"><label>${tx('SR2E.Sorcery96.Dialog.quickenDice')}</label><input name="dice" type="number" min="1" value="${escHtml(f)}"></div>
      <div class="form-group"><label>${tx('SR2E.Sorcery96.Dialog.quickenTn')}</label><input name="tn" type="number" min="2" value="4"></div>
      <div class="form-group"><label>${tx('SR2E.Sorcery96.Dialog.quickenKarma', { min: f, max: 2 * f })}</label><input name="karma" type="number" min="${escHtml(f)}" max="${escHtml(2 * f)}" value="${escHtml(f)}"></div>
      <p class="hint">${tx('SR2E.Sorcery96.Dialog.quickenHint')}</p>`,
    ok: { label: tx('SR2E.Sorcery96.Dialog.quickenOk'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { dice: num(el.dice.value), tn: num(el.tn.value), karma: num(el.karma.value) }; } },
    rejectClose: false,
  });
  return r ? { dice: Math.max(1, Math.floor(r.dice)), tn: Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(r.tn)), karma: Math.floor(r.karma) } : null;
}

// ---------------------------------------------------------------- The Cast window's rows

/** The Cast window's v0.96.0 rows: shaping an area, stacking, centering ('' for each switch that is off). */
export function castRows96(actor: any, spell: any): string {
  const sp = spell?.system ?? {};
  const out: string[] = [];
  if (sp.area) {
    const lim = S.areaShapeLimits(num(sp.learnedForce), num(actor?.system?.derived?.magic));
    if (lim.grow || lim.shrink) out.push(`<div class="form-group"><label>${tx('SR2E.Sorcery96.Dialog.areaShape', { grow: lim.grow, shrink: lim.shrink })}</label><input name="area96" type="number" value="0" min="${escHtml(-lim.shrink)}" max="${escHtml(lim.grow)}"></div>`);
  }
  if (S.s96('stacking')) out.push(`<div class="form-group"><label>${tx('SR2E.Sorcery96.Dialog.stack', { tn: num(RULES.SORCERY_V96.stackTn) })}</label><input name="stack96" type="number" value="0" min="0" max="10"></div>`);
  if (S.s96('centeringUse') && actor?.system?.metamagic?.centering && String(actor?.system?.centeringSkill ?? '').trim()) {
    out.push(`<div class="form-group"><label>${tx('SR2E.Sorcery96.Dialog.center')}</label><select name="center96"><option value="">${tx('SR2E.Sorcery96.Dialog.centerNone')}</option><option value="cast">${tx('SR2E.Sorcery96.Dialog.centerCast')}</option><option value="drain">${tx('SR2E.Sorcery96.Dialog.centerDrain')}</option></select></div>`);
  }
  return out.join('');
}

/** What the v0.96.0 rows say (each absent when its row isn't there). */
export function readCast96(form: any): { area96?: number; stack96?: number; center96?: 'cast' | 'drain' } {
  const el = form?.elements ?? {};
  const out: { area96?: number; stack96?: number; center96?: 'cast' | 'drain' } = {};
  if (el.area96 && Math.trunc(num(el.area96.value))) out.area96 = Math.trunc(num(el.area96.value));
  if (el.stack96 && Math.trunc(num(el.stack96.value)) > 0) out.stack96 = Math.min(10, Math.trunc(num(el.stack96.value)));
  const c = el.center96 ? String(el.center96.value) : '';
  if (c === 'cast' || c === 'drain') out.center96 = c;
  return out;
}

/** The area radius after the window's shaping (the targets inside it are ticked). */
export function shapedRadius(radius: number, metres: number): number {
  return S.s96('areaShape') ? Math.max(0, num(radius) + Math.trunc(num(metres))) : num(radius);
}

// ---------------------------------------------------------------- Hooks

export function registerSorcery96(): void {
  const H = g().Hooks;
  H?.on?.('preUpdateItem', (item: any, change: any) => {
    const b = fociLimitBlocks(item, change);
    if (!b) return;
    g().ui?.notifications?.warn?.(escHtml(tKey(b.why, { name: item.parent?.name ?? '', intelligence: num(item.parent?.system?.attributes?.intelligence?.total) })));
    return b.refuse ? false : undefined;
  });
  H?.on?.('createActor', (actor: any) => {
    if (!isLeadGm()) return;
    const upd = wardStamp(actor, num(sysNow()));
    if (upd) void Promise.resolve(actor.update(upd)).catch((err: unknown) => console.warn('sr2e | ward days', err));
  });
  H?.on?.('updateWorldTime', () => {
    if (!isLeadGm() || RULES.SORCERY_V96.wardExpiry === 'off') return;
    const list = [...(g().game?.actors ?? [])].filter((a: any) => a.type === 'barrier' && num(a.system?.wardEnds96) > 0);
    if (list.length) void wardSweep(list, num(sysNow())).catch((err) => console.warn('sr2e | ward days', err));
  });
}
