import { RULES } from './config.ts';
import { qualityCheck, type Quality } from './street.ts';
import { contactsCost, lifestyleCost, freeLanguagePoints } from './everyday.ts';
import { racialFloorRow, surplusFlawBonus } from './charfix.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

/** Character creation (v0.38.0): the priority table and a build check. No Foundry dependency. */

export type Priority = 'A' | 'B' | 'C' | 'D' | 'E';
export const PRIORITY_LETTERS: readonly Priority[] = ['A', 'B', 'C', 'D', 'E'];
export type BuildColumn = 'race' | 'magic' | 'attributes' | 'skills' | 'resources';
export const BUILD_COLUMNS: readonly BuildColumn[] = ['race', 'magic', 'attributes', 'skills', 'resources'];

export interface BuildInput {
  /** v0.71.0 review (F8): false for a character whose creation is recorded: no specialization trade is asked of it. */
  inCreation?: boolean;
  priorities: Partial<Record<BuildColumn, Priority>>;
  metatype: string;
  /** 'none', 'full' (a full magician), 'adept' or 'aspected'. */
  magic: 'none' | 'full' | 'adept' | 'aspected';
  /** Base attribute ratings, before racial modifiers. */
  attributes: Record<string, number>;
  intelligence: number;
  /** v0.71.0 (R3): with the narrower ratings, so a specialization's trade can be counted and checked. */
  activeSkills: BuildSkill[];
  knowledgeSkills: BuildSkill[];
  /** Nuyen spent on gear (costs, cyberware at grade) and cash kept. */
  gearCost: number;
  nuyen: number;
  essence: number;
  /** v0.44.0: edges and flaws (checked only when RULES.STREET.qualities.enabled). */
  qualities?: Quality[];
  /** v0.58.0: contacts bought at creation; the first CHARACTERS_V58.creation.freeContacts are free, the rest come from Resources. */
  contacts?: Array<{ level: number }>;
  /** v0.58.0: the lifestyle paid at creation (UPKEEP.lifestyles id) and its months (default RULES.STREET.builder.lifestyleMonths). */
  lifestyle?: string;
  lifestyleMonths?: number;
  /**
   * v0.58.0: the native language, passed separately (NOT in knowledgeSkills). Its points up to the free
   * native rating (Intelligence) cost nothing; any excess counts as knowledge points.
   */
  nativeLanguage?: { name: string; rating: number };
}

/** v0.71.0 (R3): a skill as the build check sees it (the narrower ratings are optional; 0 = none). */
export interface BuildSkill { name: string; rating: number; specialization?: string; specializationRating?: number; concentration?: string; concentrationRating?: number }

/** v0.71.0 (R3): a skill's ratings, for `paidSkillRating`. */
export interface SkillRatings { rating: number; specializationRating?: number; concentrationRating?: number }

/** v0.71.0 (R3): what a skill cost at creation. */
export interface PaidSkill {
  /** The rating paid for in skill points (rounded up when the numbers aren't a legal trade). */
  paid: number;
  /** The general rating, and the narrowest rating above it (0 when there is none). */
  general: number;
  narrow: number;
  /** Which narrower rating `narrow` is ('' when there is none). */
  narrowKind: '' | 'specialization' | 'concentration';
  /** Points the narrower rating rose above the paid rating. */
  steps: number;
  /** Why the numbers aren't a legal trade ('' when they are). */
  invalid: string;
  /** A legal trade near the one asked for (null when there is no narrower rating). */
  suggest: { general: number; narrow: number; paid: number } | null;
}

const wholeOf = (n: unknown): number => (Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : 0);

/**
 * v0.71.0 (R3): the rating a skill was paid for at creation, when a specialization (or concentration)
 * is bought by lowering the general skill: each point the narrower rating rises above the paid rating
 * lowers the general rating by `ratio` points. So paid P, general G = P − ratio × k and narrow N = P + k,
 * which gives k = (N − G) / (1 + ratio) and P = G + ratio × k (for ratio 1: (G + N) / 2). Paid 5 →
 * Firearms 4 (Pistols 6). With both a concentration and a specialization, the narrowest (highest) one
 * sets the trade and the concentration must lie between the skill and the specialization (VERIFY).
 * `invalid` says why the numbers aren't a legal trade: the narrower rating not above the skill, steps
 * that aren't whole, the general rating below 1 (VERIFY) or the paid rating above `skillMax`.
 */
export function paidSkillRating(s: SkillRatings, ratio: number = RULES.FIXES_V71.specialization.ratio, skillMax: number = RULES.CREATION.skillMax): PaidSkill {
  const g = wholeOf(s?.rating);
  const spec = wholeOf(s?.specializationRating);
  const conc = wholeOf(s?.concentrationRating);
  const r = Number.isFinite(Number(ratio)) ? Math.max(0, Number(ratio)) : 1;
  const max = Number.isFinite(Number(skillMax)) ? Number(skillMax) : Infinity;
  if (!spec && !conc) return { paid: g, general: g, narrow: 0, narrowKind: '', steps: 0, invalid: g > max ? tx('SR2E.Text.Creation.paidRatingAbove', { paid: g, max }) : '', suggest: null };
  const narrowKind: PaidSkill['narrowKind'] = spec >= conc ? 'specialization' : 'concentration';
  const n = Math.max(spec, conc);
  const k = (n - g) / (1 + r);
  const exact = g + r * k;
  // A legal trade near this one: the paid rating these numbers come to, at most skillMax, with the skill at least 1.
  const sp = Math.max(1 + Math.ceil(r), Math.min(Number.isFinite(max) ? max : Infinity, Math.max(g, Math.floor(exact))));
  const suggest = { general: sp - r, narrow: sp + 1, paid: sp };
  const out = (paid: number, invalid: string): PaidSkill => ({ paid, general: g, narrow: n, narrowKind, steps: Math.max(0, k), invalid, suggest });
  if (n <= g) return out(g, narrowKind === 'specialization' ? tx('SR2E.Text.Creation.specializationMustBeAbove', { narrow: n, general: g }) : tx('SR2E.Text.Creation.concentrationMustBeAbove', { narrow: n, general: g }));
  if (spec && conc && conc > spec) return out(Math.ceil(exact - 1e-9), tx('SR2E.Text.Creation.concentrationAboveSpecialization', { conc, spec }));
  if (spec && conc && conc <= g) return out(Math.ceil(exact - 1e-9), tx('SR2E.Text.Creation.concentrationMustBeAbove', { narrow: conc, general: g }));
  if (Math.abs(k - Math.round(k)) > 1e-9 || Math.abs(exact - Math.round(exact)) > 1e-9) return out(Math.ceil(exact - 1e-9), tx('SR2E.Text.Creation.notALegalTrade', { general: g, narrow: n }));
  const paid = Math.round(exact);
  if (g < 1) return out(paid, tx('SR2E.Text.Creation.generalBelow1'));
  if (paid > max) return out(paid, tx('SR2E.Text.Creation.paidRatingAbove', { paid, max }));
  return out(paid, '');
}

/** v0.89.5: `step` is the creation wizard step the row belongs to (rules/advancement.ts checkStep), so it isn't read from the label. */
export interface BuildRow { label: string; used: string; allowed: string; ok: boolean; note?: string; step?: string }

const rank = (p: Priority) => PRIORITY_LETTERS.indexOf(p);

/** Check a character against the priority table; one row per check. */
export function buildCheck(b: BuildInput): BuildRow[] {
  const c = RULES.CREATION;
  const rows: BuildRow[] = [];
  const p = b.priorities;
  const letters = BUILD_COLUMNS.map((k) => p[k]).filter(Boolean) as Priority[];
  const dupes = letters.filter((l, i) => letters.indexOf(l) !== i);
  rows.push({ step: 'priorities', label: tx('SR2E.Text.Creation.priorities'), used: BUILD_COLUMNS.map((k) => `${k} ${p[k] ?? '–'}`).join(', '), allowed: tx('SR2E.Text.Creation.eachLetterOnce'), ok: letters.length === 5 && !dupes.length, ...(dupes.length ? { note: tx('SR2E.Text.Creation.usedTwice', { list: [...new Set(dupes)].join(', ') }) } : letters.length < 5 ? { note: tx('SR2E.Text.Creation.pickALetter') } : {}) });
  // Race
  const need = c.race[b.metatype] ?? 'E';
  if (p.race) rows.push({ step: 'metatype', label: tx('SR2E.Text.Creation.race'), used: `${b.metatype} (${p.race})`, allowed: tx('SR2E.Text.Creation.orBetter', { need }), ok: rank(p.race) <= rank(need) });
  // Magic
  if (p.magic) {
    const m = c.priorities[p.magic].magic;
    const ok = b.magic === 'none' || (b.magic === 'full' ? m === 'full' : m === 'full' || m === 'adept');
    rows.push({ step: 'magic', label: tx('SR2E.Text.Creation.magic'), used: b.magic === 'none' ? tx('SR2E.Text.Creation.mundane') : b.magic, allowed: m === 'full' ? tx('SR2E.Text.Creation.fullMagicianOrLess') : m === 'adept' ? tx('SR2E.Text.Creation.adeptOrAspected') : tx('SR2E.Text.Creation.noMagic'), ok });
  }
  // v0.73.0 (O38): surplus flaw points buy extra points or nuyen (house rule RULES.CHARACTERS_V73.qualities.surplusFlaws).
  const fb = surplusFlawBonus(b.qualities ?? []);
  // Attributes
  if (p.attributes) {
    const vals = Object.values(b.attributes);
    const total = vals.reduce((n, v) => n + Math.max(0, v), 0);
    const bad = Object.entries(b.attributes).filter(([, v]) => v < 1 || v > c.attributeMax).map(([k]) => k);
    const attrAllowed = c.priorities[p.attributes].attributes + fb.attributes;
    rows.push({ step: 'attributes', label: tx('SR2E.Text.Creation.attributes'), used: tx('SR2E.Text.Creation.points', { count: total }), allowed: `${attrAllowed}`, ok: total <= attrAllowed && !bad.length, ...(bad.length ? { note: tx('SR2E.Text.Creation.outOfRange', { max: c.attributeMax, list: bad.join(', ') }) } : total < attrAllowed ? { note: tx('SR2E.Text.Creation.unspent', { count: attrAllowed - total }) } : {}) });
  }
  // v0.73.0 (O34): an attribute below the minimum after racial modifiers (RULES.CHARACTERS_V73.racialFloor).
  const floorRow = racialFloorRow(b.metatype, b.attributes as any);
  if (floorRow) rows.push(floorRow);
  // Skills
  if (p.skills) {
    // v0.71.0 (R3): with the trade on, a skill counts (and is capped) at its paid rating.
    const spec = RULES.FIXES_V71.specialization;
    // v0.71.0 review (F8): only while the character is being made (a finished character's later specializations were bought with Karma).
    const trade = Boolean(spec?.tradeAtCreation) && b.inCreation !== false;
    const paidOf = (s: BuildSkill) => (trade ? paidSkillRating(s, spec.ratio, c.skillMax).paid : s.rating);
    const active = b.activeSkills.reduce((n, s) => n + Math.max(0, paidOf(s)), 0);
    const nativeRating = Math.max(0, Math.floor(Number(b.nativeLanguage?.rating) || 0));
    const nativeFree = b.nativeLanguage ? freeLanguagePoints(b.intelligence, nativeRating) : 0;
    const knowledge = b.knowledgeSkills.reduce((n, s) => n + Math.max(0, paidOf(s)), 0) + (nativeRating - nativeFree);
    const free = Math.max(0, b.intelligence) * c.knowledgePerInt;
    const fromPool = active + Math.max(0, knowledge - free);
    const over = [...b.activeSkills, ...b.knowledgeSkills].filter((s) => paidOf(s) > c.skillMax).map((s) => s.name);
    const allowed = c.priorities[p.skills].skills + fb.skills;
    const knowFree = Math.min(knowledge, free);
    const used = free
      ? (nativeFree ? tx('SR2E.Text.Creation.pointsFreeKnowledgeNative', { count: fromPool, knowledge: knowFree, native: nativeFree }) : tx('SR2E.Text.Creation.pointsFreeKnowledge', { count: fromPool, knowledge: knowFree }))
      : (nativeFree ? tx('SR2E.Text.Creation.pointsFreeNative', { count: fromPool, native: nativeFree }) : tx('SR2E.Text.Creation.points', { count: fromPool }));
    const overNote = trade ? tx('SR2E.Text.Creation.abovePaidRating', { max: c.skillMax, list: over.join(', ') }) : tx('SR2E.Text.Creation.aboveMax', { max: c.skillMax, list: over.join(', ') });
    rows.push({ step: 'skills', label: tx('SR2E.Text.Creation.skills'), used, allowed: `${allowed}`, ok: fromPool <= allowed && !over.length, ...(over.length ? { note: overNote } : fromPool < allowed ? { note: tx('SR2E.Text.Creation.unspent', { count: allowed - fromPool }) } : {}) });
    if (trade) {
      const row = specializationRow([...b.activeSkills, ...b.knowledgeSkills], spec.ratio, c.skillMax);
      if (row) rows.push(row);
    }
  }
  // Resources (v0.58.0: also contacts beyond the free ones and lifestyle months)
  const contactCost = b.contacts ? contactsCost(b.contacts) : null;
  if (p.resources) {
    const life = b.lifestyle ? lifestyleCost(b.lifestyle, b.lifestyleMonths ?? RULES.STREET.builder.lifestyleMonths) : 0;
    const contactsNuyen = contactCost?.cost ?? 0;
    const spent = Math.max(0, b.gearCost) + contactsNuyen + life + Math.max(0, b.nuyen);
    const allowed = c.priorities[p.resources].resources + fb.nuyen;
    const parts = [tx('SR2E.Text.Creation.gearNuyen', { amount: Math.round(b.gearCost).toLocaleString() }), contactsNuyen ? tx('SR2E.Text.Creation.contactsNuyen', { amount: contactsNuyen.toLocaleString() }) : '', life ? tx('SR2E.Text.Creation.lifestyleNuyen', { amount: life.toLocaleString() }) : '', tx('SR2E.Text.Creation.cashNuyen', { amount: b.nuyen.toLocaleString() })].filter(Boolean);
    rows.push({ step: 'resources', label: tx('SR2E.Text.Creation.resources'), used: `¥${spent.toLocaleString()} (${parts.join(' + ')})`, allowed: `¥${allowed.toLocaleString()}`, ok: spent <= allowed });
  }
  // Contacts (v0.58.0, only when given)
  if (b.contacts && contactCost) {
    const freeN = RULES.CHARACTERS_V58.creation.freeContacts;
    rows.push({ step: 'contacts', label: tx('SR2E.Text.Creation.contacts'), used: tx('SR2E.Text.Creation.contactsFree', { count: b.contacts.length, free: contactCost.free }), allowed: tx('SR2E.Text.Creation.firstFree', { count: freeN }), ok: true, ...(contactCost.cost ? { note: tx('SR2E.Text.Creation.contactsPaid', { paid: contactCost.paid, cost: contactCost.cost.toLocaleString() }) } : {}) });
  }
  rows.push({ step: 'resources', label: tx('SR2E.Text.Creation.essence'), used: `${Math.round(b.essence * 100) / 100}`, allowed: tx('SR2E.Text.Creation.above0'), ok: b.essence > 0 });
  const q = qualityCheck(b.qualities ?? []);
  if (q && fb.points) q.note = [q.note, fb.attributes
    ? tCount(fb.points, 'SR2E.Text.Creation.surplusFlawAttributes', { amount: fb.attributes })
    : fb.skills ? tCount(fb.points, 'SR2E.Text.Creation.surplusFlawSkills', { amount: fb.skills }) : tCount(fb.points, 'SR2E.Text.Creation.surplusFlawNuyen', { amount: fb.nuyen.toLocaleString() })].filter(Boolean).join('; ');
  if (q) rows.push(q);
  return rows;
}

/**
 * v0.71.0 (R3): the build check's row for specializations and concentrations bought at creation (null
 * when no skill has one). Each is listed with its paid rating; a trade that isn't legal fails the row,
 * with a legal one near it, e.g. "Firearms 6 (Pistols 9): a specialization is paid for by lowering the
 * general skill: 6 → 9 isn't a legal trade (e.g. Firearms 5 → Pistols 7 costs 6 points)".
 */
export function specializationRow(skills: ReadonlyArray<BuildSkill>, ratio: number = RULES.FIXES_V71.specialization.ratio, skillMax: number = RULES.CREATION.skillMax): BuildRow | null {
  const used: string[] = [];
  const bad: string[] = [];
  for (const s of skills ?? []) {
    if (!s) continue;
    const p = paidSkillRating(s, ratio, skillMax);
    if (!p.narrowKind) continue;
    const sub = String((p.narrowKind === 'specialization' ? s.specialization : s.concentration) ?? '').trim() || (p.narrowKind === 'specialization' ? tx('SR2E.Text.Creation.specialization') : tx('SR2E.Text.Creation.concentration'));
    const shown = `${s.name} ${p.general} (${sub} ${p.narrow})`;
    used.push(`${shown}: ${p.paid}`);
    if (p.invalid) {
      const isSpec = p.narrowKind === 'specialization';
      if (p.suggest) {
        const { general, narrow, paid } = p.suggest;
        bad.push(isSpec
          ? tx('SR2E.Text.Creation.specPaidByLoweringEg', { shown, invalid: p.invalid, name: s.name, general, sub, narrow, paid })
          : tx('SR2E.Text.Creation.concPaidByLoweringEg', { shown, invalid: p.invalid, name: s.name, general, sub, narrow, paid }));

      } else bad.push(isSpec ? tx('SR2E.Text.Creation.specPaidByLowering', { shown, invalid: p.invalid }) : tx('SR2E.Text.Creation.concPaidByLowering', { shown, invalid: p.invalid }));

    }
  }
  if (!used.length) return null;
  const r = Number.isFinite(Number(ratio)) ? Math.max(0, Number(ratio)) : 1;
  return { step: 'skills', label: tx('SR2E.Text.Creation.skillsSpecializations'), used: tx('SR2E.Text.Creation.paidList', { list: used.join(', ') }), allowed: tx('SR2E.Text.Creation.generalForEach', { ratio: r, max: skillMax }), ok: !bad.length, ...(bad.length ? { note: bad.join('; ') } : {}) };
}

/**
 * v0.71.0 (R3): a specialization picked at creation, traded from the general skill. `paid` is the rating
 * bought with skill points; the specialization rises `given − paid` points when `given` is above it (else
 * one point) and the skill drops `ratio` points for each: paid 5 → skill 4, specialization 6. The steps
 * are cut so the skill stays at least 1; when even one step can't be afforded the specialization rating
 * is 0 and `note` says why.
 */
export function specializationTrade(paid: number, given = 0, ratio: number = RULES.FIXES_V71.specialization.ratio): { rating: number; specRating: number; note: string } {
  const p = wholeOf(paid);
  const r = Number.isFinite(Number(ratio)) ? Math.max(0, Number(ratio)) : 1;
  const want = wholeOf(given) > p ? wholeOf(given) - p : 1;
  const most = r > 0 ? Math.floor((p - 1) / r) : want;
  const k = Math.max(0, Math.min(want, most));
  if (k < 1) return { rating: p, specRating: 0, note: tx('SR2E.Text.Creation.nothingToTrade', { ratio: r, paid: p }) };
  const rating = p - r * k;
  return { rating, specRating: p + k, note: tx('SR2E.Text.Creation.tradeResult', { paid: p, rating, spec: p + k }) };

}
