/**
 * v0.99.0 rules completeness, gear: smartlinks, skillsofts, concealment, searches and the law. Pure functions over
 * RULES.KIT_V99 (rules/config99/kit.ts), from the Core Rulebook, Fields of Fire (FoF, errata v1.1), the Neo-Anarchist's
 * Guide to Real Life (NAGRL) and Shadowtech. Each behaves the book's way at the shipped value of its switch; at the
 * other value ('v980') it returns what keeps the v0.98.0 code (null, the input unchanged, or nothing). No Foundry
 * dependency. A refusal or note is a language key or text made from one, never English in the code.
 */
import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { SKILL_MEMORY_99, SOFT_SCOPES_99, MANUAL_SEARCH_99, SNIFF_99 } from './config99/kit.ts';

const V = () => RULES.KIT_V99;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const whole = (v: unknown) => Math.max(0, Math.floor(num(v)));

export type Kit99Switch = Exclude<keyof typeof RULES.KIT_V99, 'policeTn'>;
/** Whether a switch is at the book's way. */
export const on = (key: Kit99Switch): boolean => (V() as any)[key] === 'book';

/** Modifier ids this file's rows carry. */
export const KIT99_MOD = { called: 'kit99Called', range: 'kit99Range', launcher: 'kit99Launcher' } as const;

// ---------------------------------------------------------------- Smartlink Level II (FoF pp. 84–85; errata v1.1)

/** Is an item name a pair of smart goggles (Core p. 241)? */
export function isSmartGoggles(name: unknown): boolean {
  return /smart\s*-?\s*goggles?/i.test(String(name ?? ''));
}
/** Is an item a Level II one by its name ("… II", "Level 2")? */
export function isLevel2Name(name: unknown): boolean {
  return /(\bII\b|\blevel\s*(2|ii)\b|\bl2\b)/i.test(String(name ?? ''));
}
/** Is an item name a rangefinder (a weapon accessory or the cybereye rangefinder)? */
export function isRangefinder(name: unknown): boolean {
  return /range\s*-?\s*finder/i.test(String(name ?? ''));
}

/** Worn smart goggles among an actor's gear (at hand, not broken): whether any, and whether any is Level II. */
export function smartGogglesWorn(items: ReadonlyArray<{ type?: string; name?: string; atHand?: boolean; damaged?: boolean }>): { worn: boolean; level2: boolean } {
  const g = items.filter((i) => i.type === 'gear' && i.atHand !== false && !i.damaged && isSmartGoggles(i.name));
  return { worn: g.length > 0, level2: g.some((i) => isLevel2Name(i.name)) };
}

/** Should the Attack dialog tick the smart goggles' row by itself (a smartgun, goggles worn, no smartlink implant)? */
export function gogglesTicked(o: { smartgun: boolean; implant: boolean; goggles: boolean }): boolean {
  return on('smartGoggles') && Boolean(o.smartgun) && !o.implant && Boolean(o.goggles);
}

/** The rows a single receptor leaves: with the smartlink and the goggles both ticked, only the smartlink counts. */
export function receptorDrop(situational: readonly string[]): string[] {
  return on('smartGoggles') && situational.includes('smartlink') && situational.includes('smartGoggles') ? ['smartGoggles'] : [];
}

/**
 * Smartlink Level II's rows (FoF pp. 84–85): with a Level II receptor in use (a level 2 smartlink on its row, or
 * Level II smart goggles on theirs) and a Level II smartgun: a called shot at +2 instead of the row's +4 (errata
 * v1.1), a rangefinder's −1 long / −2 extreme, and −1 for a linked launcher (a fired blast weapon with no Intelligence).
 */
export function smartlink2Mods(o: { receptor2: boolean; gun2: boolean; called: boolean; range?: string | null; rangefinder?: boolean; launcher?: boolean }): TargetNumberModifier[] {
  if (!on('smartlink2') || !o.receptor2 || !o.gun2) return [];
  const out: TargetNumberModifier[] = [];
  if (o.called) {
    const row = num(RULES.SITUATIONAL_MODIFIERS.find((m) => m.id === 'calledShot')?.value, 4);
    if (row > 2) out.push({ id: KIT99_MOD.called, label: tx('SR2E.Kit99.Mod.called'), value: 2 - row });
  }
  if (o.rangefinder && (o.range === 'long' || o.range === 'extreme')) out.push({ id: KIT99_MOD.range, label: tx('SR2E.Kit99.Mod.range'), value: o.range === 'long' ? -1 : -2 });
  if (o.launcher) out.push({ id: KIT99_MOD.launcher, label: tx('SR2E.Kit99.Mod.launcher'), value: -1 });
  return out;
}

/** Is a weapon a "linked" launcher for Smartlink II (FoF p. 85): a blast weapon fired, not thrown, with no Intelligence. */
export function linkedLauncher(w: { blast?: unknown; melee?: unknown; strengthRange?: unknown; guidance?: unknown }): boolean {
  return Boolean(w.blast) && !w.melee && !w.strengthRange && whole(w.guidance) === 0;
}

// ---------------------------------------------------------------- Skillsofts (Core pp. 247–249)

/** Magic skills cannot be skillsofts (Core p. 248). */
export const MAGIC_SOFT_SKILLS_99 = ['sorcery', 'conjuring'] as const;

/** Is this skill one no skillsoft can hold (book way only)? */
export function magicSoft(skill: unknown): boolean {
  return on('softReplaces') && (MAGIC_SOFT_SKILLS_99 as readonly string[]).includes(String(skill ?? '').trim().toLowerCase());
}

/**
 * The softs as they run (Core p. 249): the running activesofts share the Skillwire Rating in slot order (a later
 * one gets what is left), and a magic skill gives nothing. 'v980': the list unchanged.
 */
export function capActivesofts<T extends { kind: string; skill?: string; effective: number; reason: string }>(softs: readonly T[], skillwires: number): T[] {
  const total = on('skillwires');
  const magic = on('softReplaces');
  if (!total && !magic) return [...softs];
  let left = whole(skillwires);
  return softs.map((s) => {
    if (magic && magicSoft(s.skill) && s.effective > 0) return { ...s, effective: 0, reason: tx('SR2E.Kit99.Soft.magic') };
    if (!total || s.kind !== 'activesoft' || !(s.effective > 0)) return s;
    const eff = Math.min(whole(s.effective), left);
    left -= eff;
    return eff < s.effective ? { ...s, effective: eff, reason: tx('SR2E.Kit99.Soft.wiresUsed', { skillwires: whole(skillwires) }) } : s;
  });
}

/** Does a running skillsoft replace the character's own skill, even a better one (Core p. 248)? */
export function softReplaces(): boolean {
  return on('softReplaces');
}

/**
 * The headware memory a soft takes (Core p. 248, Skill Memory Table): by its type (a linguasoft is a language; else
 * the chip's skill type, blank = general) and rating (1–10). null at 'v980' (the old rating × mpPerRating).
 */
export function softMemoryMp(chip: { kind?: string; scope?: string; rating?: number }): number | null {
  if (!on('skillMemory')) return null;
  const scope = chip.kind === 'linguasoft' ? 'language' : (SOFT_SCOPES_99 as readonly string[]).includes(String(chip.scope ?? '')) && chip.scope ? String(chip.scope) : 'general';
  const row = SKILL_MEMORY_99[scope] ?? SKILL_MEMORY_99.general!;
  return row[Math.min(10, Math.max(1, whole(chip.rating) || 1)) - 1]!;
}

// ---------------------------------------------------------------- The lined coat (Core p. 242)

/** Is an armor name a lined coat? */
export function isLinedCoat(name: unknown): boolean {
  return /lined\s*-?\s*coat/i.test(String(name ?? ''));
}

/** The carried items as a look or frisk sees them under a worn lined coat: each hideable weapon +2 Concealability. */
export function underCoat<T extends { type: string; name: string; concealability: number; worn?: boolean }>(items: readonly T[], method: string): T[] {
  if (!on('linedCoat') || (method !== 'look' && method !== 'frisk')) return [...items];
  if (!items.some((i) => i.type === 'armor' && i.worn !== false && isLinedCoat(i.name))) return [...items];
  return items.map((i) => (i.type === 'weapon' && whole(i.concealability) > 0 ? { ...i, concealability: whole(i.concealability) + 2 } : i));
}

// ---------------------------------------------------------------- Manual detection (NAGRL p. 93)

export const SEARCH_PRO_99 = Object.keys(MANUAL_SEARCH_99.pro);
export const SEARCH_TIME_99 = Object.keys(MANUAL_SEARCH_99.time);
export const SEARCH_STATE_99 = Object.keys(MANUAL_SEARCH_99.state);

/**
 * The frisk's rows from the Manual Detection Modifiers Table (NAGRL p. 93) and whether it is a strip search (every
 * weapon found). Only a GM may order a strip search (`gm`); a player's choice of it counts as "nearly". Unknown
 * choices count as the table's 0 rows. 'v980': nothing.
 */
export function manualSearchMods(sel: { pro?: string; time?: string; state?: string }, gm: boolean): { mods: TargetNumberModifier[]; strip: boolean } {
  if (!on('manualSearch')) return { mods: [], strip: false };
  const T = MANUAL_SEARCH_99;
  const pro = Object.hasOwn(T.pro, String(sel.pro)) ? String(sel.pro) : 'pr3';
  let time = Object.hasOwn(T.time, String(sel.time)) ? String(sel.time) : 'standard';
  if (time === 'strip' && !gm) time = 'nearStrip';
  const state = Object.hasOwn(T.state, String(sel.state)) ? String(sel.state) : 'normal';
  const mods: TargetNumberModifier[] = [];
  const add = (key: string, v: number | null | undefined) => { if (v) mods.push({ id: 'kit99Search', label: tKey(`SR2E.Kit99.Search.${key}`), value: v }); };
  add(pro, T.pro[pro]);
  if (time !== 'strip') add(time, T.time[time]);
  add(state, T.state[state]);
  return { mods, strip: time === 'strip' };
}

// ---------------------------------------------------------------- The chemical sniffer (NAGRL p. 93)

/** A carried item as the sniffer sees it. */
export interface SniffItem {
  name: string; type: string;
  /** Weapon: loaded rounds, magazine size, ammo type, a blast weapon, its kind, thrown (Strength range), Intelligence. */
  ammo?: number; ammoMax?: number; ammoType?: string; blast?: boolean; blastKind?: string; thrown?: boolean; melee?: boolean;
  /** Gear: a clip's rounds and how many, an explosive's Power, weight (kg). */
  rounds?: number; quantity?: number; explosivePower?: number; weight?: number;
}

const EXPLOSIVE_AMMO = ['explosive', 'exex'];
const BIG_GRENADES = ['offensive', 'defensive', 'concussion', 'custom', 'demolition', 'heRocket', 'apRocket', 'avRocket'];
const SMALL_GRENADES = ['flash', 'smoke', 'gas'];

/** What a carried load adds up to for the sniffer: the counts and the items that count. */
export function sniffLoad(items: readonly SniffItem[]): { counts: Record<keyof typeof SNIFF_99, number>; names: string[] } {
  const c: Record<keyof typeof SNIFF_99, number> = { baseTn: 0, standardRounds: 0, explosiveRounds: 0, fragGrenades: 0, smokeGrenades: 0, miniGrenades: 0, standardGrams: 0, plastiqueGrams: 0 };
  const names: string[] = [];
  const isExp = (t: unknown) => EXPLOSIVE_AMMO.includes(String(t ?? ''));
  for (const i of items) {
    const q = Math.max(1, whole(i.quantity ?? 1));
    let counted = false;
    if (i.type === 'weapon' && !i.melee) {
      if (i.blast) {
        const kind = String(i.blastKind ?? 'custom');
        // A launcher's loaded grenades are mini-grenades; its rockets and missiles count as one grenade each (VERIFY).
        if (!i.thrown && whole(i.ammoMax) > 0) {
          const n = whole(i.ammo);
          if (n) { if (kind.endsWith('Rocket')) c.fragGrenades += n; else c.miniGrenades += n; counted = true; }
        } else if (SMALL_GRENADES.includes(kind)) { c.smokeGrenades += q; counted = true; }
        else if (BIG_GRENADES.includes(kind)) { c.fragGrenades += q; counted = true; }
      } else if (whole(i.ammo) > 0) {
        c[isExp(i.ammoType) ? 'explosiveRounds' : 'standardRounds'] += whole(i.ammo);
        counted = true;
      }
    } else if (i.type === 'gear') {
      if (num(i.explosivePower) > 0) {
        // Grams carried: weight (kg) × 1000 × quantity; no weight set counts as one lot (VERIFY).
        const g = num(i.weight) > 0 ? Math.ceil(num(i.weight) * 1000) * q : 1;
        c[/plasti/i.test(String(i.name ?? '')) ? 'plastiqueGrams' : 'standardGrams'] += g;
        counted = true;
      } else if (String(i.ammoType ?? '')) {
        // A clip with rounds 0 ("fills the weapon") counts as one round per clip (VERIFY).
        c[isExp(i.ammoType) ? 'explosiveRounds' : 'standardRounds'] += Math.max(1, whole(i.rounds)) * q;
        counted = true;
      }
    }
    if (counted) names.push(i.name);
  }
  return { counts: c, names };
}

/** The sniffer's TN for a load (NAGRL p. 93): 10, −1 per lot (or part thereof) of each kind, never below 2. */
export function sniffTn(counts: Partial<Record<keyof typeof SNIFF_99, number>>): { tn: number; mods: TargetNumberModifier[] } {
  const mods: TargetNumberModifier[] = [];
  for (const k of ['standardRounds', 'explosiveRounds', 'fragGrenades', 'smokeGrenades', 'miniGrenades', 'standardGrams', 'plastiqueGrams'] as const) {
    const n = whole(counts[k]);
    if (n) mods.push({ id: 'kit99Sniff', label: tKey(`SR2E.Kit99.Sniff.${k}`, { n }), value: -Math.ceil(n / SNIFF_99[k]) });
  }
  const tn = Math.max(RULES.MIN_TARGET_NUMBER, SNIFF_99.baseTn + mods.reduce((a, m) => a + m.value, 0));
  return { tn, mods };
}

/** Does a sniffer's sweep use the book's single test (an explosive scanner, book way)? */
export function sniffBook(method: string, kind: string): boolean {
  return on('sniffer') && method === 'scanner' && kind === 'explosive';
}

// ---------------------------------------------------------------- The police check (Shadowtech p. 103)

/**
 * The restriction number of an item (Shadowtech p. 103): the number in its Legality code ("6P-CC" → 6), and the
 * category's number (KIT_V99.policeTn) when the category needs a permit, is restricted or forbidden; the stricter
 * (lower) of the two counts. null: legal or not set (nothing to check). A code alone (category not set) counts.
 */
export function restrictionNumber(o: { code?: unknown; category?: unknown }): number | null {
  const m = /^\s*(\d{1,2})/.exec(String(o.code ?? ''));
  const fromCode = m ? Math.max(1, Math.min(12, Number(m[1]))) : null;
  const cat = String(o.category ?? '');
  const fromCat = Object.hasOwn(V().policeTn, cat) ? Math.max(1, Math.min(12, whole(V().policeTn[cat]))) : null;
  if (cat === 'legal' && fromCode === null) return null;
  const all = [fromCode, fromCat].filter((n): n is number => n !== null);
  return all.length ? Math.min(...all) : null;
}

/** The police check's TN (Shadowtech p. 103): the restriction number, ±3 for the area's enforcement, never below 2. */
export function policeTn(restriction: number, enforcement: number): number {
  const e = Math.max(-3, Math.min(3, Math.trunc(num(enforcement))));
  return Math.max(2, whole(restriction) + e);
}

export type PoliceOutcome = 'none' | 'warn' | 'press';
/** What the officer does (Shadowtech p. 103): no success nothing, one a warning, more presses the issue. */
export function policeOutcome(successes: number): PoliceOutcome {
  const s = whole(successes);
  return s <= 0 ? 'none' : s === 1 ? 'warn' : 'press';
}

/** The officer's dice: the better of Security and Police Procedures (skill names matched in any case), at most 20. */
export const POLICE_SKILLS_99 = ['security', 'police procedures'] as const;
export function officerDice(skills: ReadonlyArray<{ name?: string; rating?: number }>): number {
  let best = 0;
  for (const s of skills) if ((POLICE_SKILLS_99 as readonly string[]).includes(String(s.name ?? '').trim().toLowerCase())) best = Math.max(best, whole(s.rating));
  return Math.min(20, best);
}
