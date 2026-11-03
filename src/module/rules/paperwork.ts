import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { legalCheck, legalityOf } from './outfit.ts';
import { lifestyleOf } from './upkeep.ts';
import { focusKarmaCost } from './spellcraft.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

/**
 * v0.61.0 paperwork and street kit: radios, encryption and jamming; fake SINs and licences against a
 * checker; creation extras (spell points, leftover cash, lifestyle bought outright); a starter skill
 * list; the safehouse workshop as Build/Repair tools. Values in RULES.STREET_V61 (VERIFY).
 * Pure rules; no Foundry.
 */

const C = () => RULES.STREET_V61;

/** A finite number or 0. */
const num = (n: unknown): number => (Number.isFinite(Number(n)) ? Number(n) : 0);
/** A whole number at least 0. */
const whole = (n: unknown): number => Math.max(0, Math.floor(num(n)));
const lower = (s: unknown): string => String(s ?? '').trim().toLowerCase();

// ---------------------------------------------------------------- Radios, encryption, jamming

/** v0.61.0: a radio as commsStatus sees it. */
export interface PaperworkRadio { name: string; signal: number; encryption: number }

/** v0.61.0: whether a jammer of rating `jammer` blocks a radio of `signal` (radio.jamBeats; a jammer of 0 or less never jams). */
export function radioJammed(o: { signal: number; jammer: number }): boolean {
  const j = num(o?.jammer);
  const s = num(o?.signal);
  if (j <= 0) return false;
  return C().radio.jamBeats === 'greater' ? j > s : j >= s;
}

/**
 * v0.61.0: the comms picture: the best radio (highest signal, ties to the higher encryption) and
 * whether the strongest jammer (rating > 0) blocks it. `ok` false with no radio or when jammed.
 */
export function commsStatus(o: { radios: ReadonlyArray<PaperworkRadio>; jammers: ReadonlyArray<{ name: string; rating: number }> }): { ok: boolean; best: PaperworkRadio | null; jammedBy: string | null; note: string } {
  let best: PaperworkRadio | null = null;
  for (const r of o?.radios ?? []) {
    if (!r) continue;
    const c = { name: String(r.name ?? ''), signal: whole(r.signal), encryption: whole(r.encryption) };
    if (!best || c.signal > best.signal || (c.signal === best.signal && c.encryption > best.encryption)) best = c;
  }
  if (!best) return { ok: false, best: null, jammedBy: null, note: tx('SR2E.Text.Paperwork.noRadio') };
  let jam: { name: string; rating: number } | null = null;
  for (const j of o?.jammers ?? []) {
    const rating = num(j?.rating);
    if (rating > 0 && (!jam || rating > jam.rating)) jam = { name: String(j.name ?? ''), rating };
  }
  if (jam && radioJammed({ signal: best.signal, jammer: jam.rating })) {
    return { ok: false, best, jammedBy: jam.name, note: tx('SR2E.Text.Paperwork.radioJammed', { name: best.name, signal: best.signal, jammer: jam.name, rating: jam.rating }) };
  }
  const note = best.encryption
    ? (jam ? tx('SR2E.Text.Paperwork.radioEncryptedTooWeak', { name: best.name, signal: best.signal, encryption: best.encryption, jammer: jam.name, rating: jam.rating }) : tx('SR2E.Text.Paperwork.radioEncrypted', { name: best.name, signal: best.signal, encryption: best.encryption }))

    : (jam ? tx('SR2E.Text.Paperwork.radioUnencryptedTooWeak', { name: best.name, signal: best.signal, jammer: jam.name, rating: jam.rating }) : tx('SR2E.Text.Paperwork.radioUnencrypted', { name: best.name, signal: best.signal }));
  return { ok: true, best, jammedBy: null, note };
}

/**
 * v0.61.0: listening in on radio traffic: `dice` (the interceptor's radio.interceptSkill) against a TN
 * that breaks the encryption. 'encryption': TN = the encryption rating, at least baseInterceptTn;
 * 'base+encryption': baseInterceptTn + encryption. `tn` is final (never below RULES.MIN_TARGET_NUMBER);
 * `modifiers` explain what the encryption added over baseInterceptTn.
 */
export function interceptTest(o: { dice: number; encryption: number }): { dice: number; tn: number; skill: string; modifiers: TargetNumberModifier[] } {
  const r = C().radio;
  const base = num(r.baseInterceptTn);
  const enc = whole(o?.encryption);
  const add = r.decryptTnFrom === 'base+encryption' ? enc : Math.max(0, enc - base);
  const modifiers: TargetNumberModifier[] = add ? [{ label: tx('SR2E.Card.Mod.encryption', { enc }), value: add }] : [];
  return { dice: whole(o?.dice), tn: Math.max(RULES.MIN_TARGET_NUMBER, base + add), skill: r.interceptSkill, modifiers };
}

// ---------------------------------------------------------------- Fake SINs and licences

/**
 * v0.61.0: checking an ID: the checker's rating in dice against the fake's rating (identity.tnFrom
 * 'fixed' = identity.fixedTn), never below RULES.MIN_TARGET_NUMBER. A real ID gets auto 'pass' (no roll)
 * when identity.realAlwaysPasses.
 */
export function idCheckTest(o: { checkerRating: number; rating: number; fake: boolean }): { dice: number; tn: number; auto: 'pass' | null } {
  const i = C().identity;
  const tn = Math.max(RULES.MIN_TARGET_NUMBER, Math.floor(num(i.tnFrom === 'fixed' ? i.fixedTn : o?.rating)));
  return { dice: whole(o?.checkerRating), tn, auto: !o?.fake && i.realAlwaysPasses ? 'pass' : null };
}

/**
 * v0.61.0: what the checker's successes mean. 'anySuccess': one success spots the fake; 'netSuccess':
 * the checker's successes must beat `forgerSuccesses` (default 0, e.g. the fake's rating rolled back).
 */
export function idCheckOutcome(successes: number, forgerSuccesses = 0): { spotted: boolean; note: string } {
  const s = whole(successes);
  const net = C().identity.spottedOn === 'netSuccess';
  const spotted = net ? s > whole(forgerSuccesses) : s >= 1;
  if (spotted) return { spotted, note: net ? tx('SR2E.Text.Paperwork.spottedAgainst', { successes: s, forger: whole(forgerSuccesses) }) : tCount(s, 'SR2E.Text.Paperwork.spotted') };
  return { spotted, note: net ? tx('SR2E.Text.Paperwork.passesAgainst', { successes: s, forger: whole(forgerSuccesses) }) : tx('SR2E.Text.Paperwork.passesNoSuccesses') };
}

/** Index of a legality category among GEAR_V58.legality.categories (-1 when unknown). */
const categoryIndex = (id: string): number => RULES.GEAR_V58.legality.categories.findIndex((c) => c.id === id);

/**
 * v0.61.0: whether a licence covers an item. A SIN (`kind` 'sin') covers nothing. `covers` is a
 * comma-separated list: '*' or 'all' covers any permit item; a legality category id covers items of
 * that category (and milder permit categories when identity.categoryCoversLower); any other word
 * covers items whose name contains it (case-insensitive).
 */
export function licenceCovers(licence: { covers: string; kind?: string }, item: { name: string; legality: string }): boolean {
  if (lower(licence?.kind) === 'sin') return false;
  const tokens = String(licence?.covers ?? '').split(',').map(lower).filter(Boolean);
  const name = lower(item?.name);
  const cat = String(item?.legality ?? '');
  for (const t of tokens) {
    if (t === '*' || t === 'all') return true;
    const ti = RULES.GEAR_V58.legality.categories.findIndex((c) => c.id !== '' && c.id.toLowerCase() === t);
    if (ti >= 0) {
      const tId = RULES.GEAR_V58.legality.categories[ti]!.id;
      if (tId === cat) return true;
      const ii = categoryIndex(cat);
      if (C().identity.categoryCoversLower && ii >= 0 && legalityOf(cat).permit && ii < ti) return true;
      continue;
    }
    if (name && name.includes(t)) return true;
  }
  return false;
}

/**
 * v0.61.0: carried items against permits and licences (outfit.ts legalCheck). Items that are legal, or
 * covered by a ticked permit, are left out. A permit item a licence covers is listed with
 * `problem` '' and `coveredBy` (a real licence is preferred, else the best-rated fake) and whether it is
 * `fake`, so a checker can test it. Anything else illegal is listed with its problem and coveredBy null.
 */
export function legalWithLicences(
  items: ReadonlyArray<{ name: string; legality: string; permit: boolean; rating?: number }>,
  licences: ReadonlyArray<{ name: string; covers: string; fake: boolean; rating: number; kind?: string }>,
): Array<{ name: string; problem: string; coveredBy: string | null; fake: boolean }> {
  const out: Array<{ name: string; problem: string; coveredBy: string | null; fake: boolean }> = [];
  for (const i of items ?? []) {
    if (!i) continue;
    const check = legalCheck({ category: i.legality, permit: Boolean(i.permit), rating: num(i.rating) });
    if (check.ok) continue;
    const row = legalityOf(i.legality);
    if (row.permit) {
      let pick: { name: string; fake: boolean; rating: number } | null = null;
      for (const l of licences ?? []) {
        if (!l || !licenceCovers(l, { name: i.name, legality: i.legality })) continue;
        const c = { name: String(l.name ?? ''), fake: Boolean(l.fake), rating: num(l.rating) };
        if (!pick || (pick.fake && !c.fake) || (pick.fake === c.fake && c.rating > pick.rating)) pick = c;
      }
      if (pick) { out.push({ name: i.name, problem: '', coveredBy: pick.name, fake: pick.fake }); continue; }
    }
    out.push({ name: i.name, problem: check.fine ? tx('SR2E.Text.Paperwork.problemFine', { label: check.label, note: check.note, fine: check.fine.toLocaleString() }) : `${check.label}: ${check.note}`, coveredBy: null, fake: false });
  }
  return out;
}

// ---------------------------------------------------------------- Creation extras

/**
 * v0.61.0: spell points at creation for the Magic column's priority letter (A–E, case-insensitive;
 * unknown → 0); adepts get none when creation.adeptGetsNone. `tradition` 'none' / 'mundane' gets 0.
 */
export function spellPointAllowance(o: { priority: string; tradition?: string; adept?: boolean }): number {
  const c = C().creation;
  if (o?.adept && c.adeptGetsNone) return 0;
  if (['none', 'mundane'].includes(lower(o?.tradition))) return 0;
  return whole(c.spellPointsByPriority[String(o?.priority ?? '').trim().toUpperCase()]);
}

/** v0.61.0: spell points spent: each spell's learnedForce when present, else its force (whole, ≥ 0). */
export function spellPointsUsed(spells: ReadonlyArray<{ force?: number; learnedForce?: number }>): number {
  let n = 0;
  for (const s of spells ?? []) if (s) n += whole(s.learnedForce ?? s.force);
  return n;
}

/** v0.71.0 (R21): a focus as the spell-point check sees it. */
export interface CreationFocus { name?: string; focusType?: string; rating?: number; bonded?: boolean; target?: string; category?: string; size?: string }

/**
 * v0.71.0 (R21): spell points spent bonding foci at creation: each bonded focus's bonding Karma
 * (`focusKarmaCost`, one spell point per Karma; VERIFY) when RULES.FIXES_V71.creationFoci is
 * 'spellPoints'; 0 when 'free' (the old way). Unbonded foci cost nothing here.
 */
export function focusSpellPoints(foci: ReadonlyArray<CreationFocus> | null | undefined): number {
  if (RULES.FIXES_V71?.creationFoci !== 'spellPoints') return 0;
  let n = 0;
  for (const f of foci ?? []) if (f?.bonded) n += whole(focusKarmaCost(String(f.focusType ?? ''), whole(f.rating), { target: String(f.target ?? ''), category: String(f.category ?? ''), size: String(f.size ?? '') }));
  return n;
}

/**
 * v0.61.0: spell points against the allowance. Over it is not ok, unless creation.nuyenPerSpellPoint
 * > 0, when the extra points are bought (`extraNuyen`, from Resources).
 * v0.71.0 (R21): `foci` (bonded at creation) add their bonding Karma to `used` (`focusSpellPoints`);
 * `foci` in the result is that part (left out when 0, so the old shape is kept).
 */
export function spellPointCheck(o: { allowance: number; spells: ReadonlyArray<{ force?: number; learnedForce?: number }>; foci?: ReadonlyArray<CreationFocus> }): { used: number; allowance: number; ok: boolean; extraNuyen: number; note: string; foci?: number } {
  const foci = focusSpellPoints(o?.foci);
  const used = spellPointsUsed(o?.spells ?? []) + foci;
  const allowance = whole(o?.allowance);
  const over = Math.max(0, used - allowance);
  const part = foci ? tx('SR2E.Text.Paperwork.spellsPlusFoci', { spells: used - foci, foci }) : '';
  const withPart = (note: string) => [part, note].filter(Boolean).join('; ');
  const extra = foci ? { foci } : {};
  if (!over) return { used, allowance, ok: true, extraNuyen: 0, note: withPart(used < allowance ? tx('SR2E.Text.Paperwork.unspent', { count: allowance - used }) : ''), ...extra };
  const per = whole(C().creation.nuyenPerSpellPoint);
  if (per > 0) return { used, allowance, ok: true, extraNuyen: over * per, note: withPart(tx('SR2E.Text.Paperwork.extraBought', { count: over, cost: (over * per).toLocaleString() })), ...extra };
  return { used, allowance, ok: false, extraNuyen: 0, note: withPart(tx('SR2E.Text.Paperwork.overAllowance', { count: over })), ...extra };
}

/** v0.61.0: cash left after creation: kept in full ('keep'), up to the cap ('cap'), or lost ('lose'). */
export function leftoverCash(nuyen: number): { kept: number; lost: number; note: string } {
  const l = C().creation.leftoverCash;
  const n = whole(nuyen);
  const kept = l.mode === 'lose' ? 0 : l.mode === 'cap' ? Math.min(n, whole(l.cap)) : n;
  const lost = n - kept;
  return { kept, lost, note: lost ? (l.mode === 'cap' ? tx('SR2E.Text.Paperwork.unspentLostCap', { lost: lost.toLocaleString(), cap: whole(l.cap).toLocaleString() }) : tx('SR2E.Text.Paperwork.unspentLost', { lost: lost.toLocaleString() })) : '' };

}

/** v0.61.0: buying a lifestyle for good at creation: creation.lifestyleOutright.months × its monthly cost (UPKEEP.lifestyles). */
export function lifestyleOutright(o: { lifestyle: string }): { months: number; cost: number; permanent: true } {
  const months = whole(C().creation.lifestyleOutright.months);
  return { months, cost: months * Math.max(0, num(lifestyleOf(String(o?.lifestyle ?? '')).cost)), permanent: true };
}

// ---------------------------------------------------------------- Starter skills

/** v0.61.0: a starter-list skill. */
export interface StarterSkill { name: string; attribute: string; kind: 'active' | 'buildRepair' }

/** v0.61.0: the starterSkills the character doesn't have yet (names compared case-insensitively, trimmed). */
export function starterSkillsMissing(existing: ReadonlyArray<string>): StarterSkill[] {
  const have = new Set((existing ?? []).map(lower));
  return C().starterSkills.filter((s) => !have.has(lower(s.name))).map((s) => ({ name: s.name, attribute: s.attribute, kind: s.kind }));
}

// ---------------------------------------------------------------- Workshop as tools

/** v0.61.0: the tools level a safehouse workshop counts as (its rating or negative TN modifier; '' when none). */
export function workshopToolsLevel(workshop: number): string {
  const r = Math.floor(Math.abs(num(workshop)));
  let best: { min: number; level: string } | null = null;
  for (const row of C().workshop.levelAt) if (r > 0 && r >= num(row.min) && (!best || num(row.min) > best.min)) best = { min: num(row.min), level: row.level };
  return best ? best.level : '';
}

