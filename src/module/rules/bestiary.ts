/**
 * v0.56.0: spirits, adepts and critters (pure rules; numbers in RULES.MAGIC_V56 and
 * RULES.CRITTERS_V56, all VERIFY): which spirits a totem helps summon, controlling and true-naming
 * spirits, the adept power point budget, adept specials (rapid healing, spell resistance, distance
 * strike, improved senses), critter immunities and the TN-changing critter powers.
 */
import { RULES } from './config.ts';
import type { EffectBundle } from './effects.ts';
import { totemDice, type Totem, type Tradition } from './arcana.ts';
import { tags } from './thaumaturgy.ts';
import { escRegExp } from './html.ts'; // v0.81.1 (RB2-7): the shared regex escaper

const M = () => RULES.MAGIC_V56;
const K = () => RULES.CRITTERS_V56;

type SpiritRef = { kind?: string; type?: string; domain?: string } | null;

/** Whether `tag` appears in `text` at the start of a word (case-insensitive); a plural tag also matches its singular. */
function tagIn(tag: string, text: string | undefined): boolean {
  const t = String(text ?? '').toLowerCase();
  if (!t || !tag) return false;
  const forms = [tag];
  if (tag.length > 1 && tag.endsWith('s')) forms.push(tag.slice(0, -1));
  return forms.some((f) => new RegExp(`(^|[^a-z0-9])${escRegExp(f)}`).test(t));
}

// ---------------------------------------------------------------- Totems and spirits

/** Whether a totem's favoured spirits (tags) include this spirit; no tags = helps every summoning. */
export function totemHelpsSpirit(totemSpirits: string | null | undefined, spirit: SpiritRef): boolean {
  const list = tags(totemSpirits ?? '');
  if (!list.length || !spirit) return true;
  return list.some((tag) => tagIn(tag, spirit.type) || tagIn(tag, spirit.domain) || tagIn(tag, spirit.kind));
}

/** Totem conjuring dice for summoning this spirit (0 when the totem does not favour it). */
export function totemConjuringDice(tradition: Tradition | string, totem: (Partial<Totem> & { spirits?: string }) | undefined, spirit: SpiritRef): number {
  return totemHelpsSpirit(totem?.spirits, spirit) ? totemDice(tradition as Tradition, totem, 'conjuring') : 0;
}

// ---------------------------------------------------------------- Controlling and banishing

/** Services a spirit owes its new master after a successful control contest. */
export function controlServices(net: number, owed: number): number {
  if (!(net > 0)) return 0;
  return M().control.services === 'keep' ? Math.max(1, owed) : net;
}

/** Successes a bound spirit's summoner adds to its side when someone banishes it. */
export function banishHelp(helperSuccesses: number): number {
  return M().control.summonerHelps ? Math.max(0, helperSuccesses) : 0;
}

/** Binding a free spirit by its true name: net successes are services; Force × karmaPerForce Good Karma on success. */
export function trueNameOutcome(binderSuccesses: number, spiritSuccesses: number, force: number): { net: number; bound: boolean; services: number; karma: number } {
  const net = Math.max(0, binderSuccesses - spiritSuccesses);
  const bound = net > 0;
  // v0.92.3 (RULES.SPIRITS_V923.trueName 'book', Grimoire p. 79): binding by the true name costs no Karma.
  return { net, bound, services: net, karma: bound && RULES.SPIRITS_V923.trueName !== 'book' ? force * M().trueName.karmaPerForce : 0 };
}

// ---------------------------------------------------------------- Adepts

const EPS = 0.001;

/** Power points spent by active powers, and the powers (last on the sheet first) that no longer fit the budget. */
export function adeptBudget(powers: ReadonlyArray<{ id: string; cost: number; active?: boolean }>, available: number): { spent: number; available: number; over: string[] } {
  const active = powers.filter((p) => p.active !== false);
  const cost = (p: { cost: number }) => Number(p.cost) || 0;
  const spent = Math.round(active.reduce((n, p) => n + cost(p), 0) * 100) / 100;
  const off = new Set<string>();
  let left = spent;
  for (let i = active.length - 1; i >= 0 && left > available + EPS; i--) {
    const p = active[i]!;
    // A power that costs nothing never puts the adept over budget.
    if (!(cost(p) > 0)) continue;
    off.add(p.id);
    left -= cost(p);
  }
  return { spent, available, over: active.filter((p) => off.has(p.id)).map((p) => p.id) };
}

/** Extra natural healing dice from Rapid Healing. */
export function rapidHealingDice(level: number): number {
  return Math.max(0, level) * K().rapidHealing.dicePerLevel;
}

/** Extra dice to resist spells and powers from Spell Resistance. */
export function spellResistanceDice(level: number): number {
  return Math.max(0, level) * K().spellResistance.dicePerLevel;
}

/** How far a distance strike reaches (metres): Magic × metresPerMagic. */
export function distanceStrikeMetres(level: number, magic: number): number {
  if (!(level > 0)) return 0;
  return Math.max(0, magic) * K().distanceStrike.metresPerMagic;
}

/** Senses an Improved Senses adept power can give ('' = none): the adept power item's `sense` choices. */
export const ADEPT_SENSES = ['', 'lowLight', 'thermographic', 'ultrasound', 'hearing'] as const;

/** Senses given by active Improved Senses powers. */
export function improvedSenses(powers: ReadonlyArray<{ special?: string; sense?: string; active?: boolean }>): { lowLight: boolean; thermographic: boolean; ultrasound: boolean; hearing: boolean } {
  const out = { lowLight: false, thermographic: false, ultrasound: false, hearing: false };
  for (const p of powers) {
    if (p.active === false || p.special !== 'improvedSenses') continue;
    const s = String(p.sense ?? '').trim().toLowerCase();
    const key = (Object.keys(out) as (keyof typeof out)[]).find((k) => k.toLowerCase() === s);
    if (key) out[key] = true;
  }
  return out;
}

// ---------------------------------------------------------------- Critter immunities

const IMMUNITY_SYNONYMS: Record<'normalWeapons' | 'fire' | 'poisons' | 'pathogens' | 'age', readonly string[]> = {
  normalWeapons: ['normal weapons', 'normal weapon', 'weapons', 'mundane weapons'],
  fire: ['fire', 'flame', 'heat'],
  poisons: ['poison', 'poisons', 'toxins', 'toxin', 'drugs'],
  pathogens: ['pathogens', 'pathogen', 'disease', 'diseases'],
  age: ['age', 'aging', 'ageing'],
};

/** Immunities from traits with Special "immunity" (substance tags; none named = normal weapons). */
export function critterImmunities(traits: ReadonlyArray<{ special?: string; substance?: string }>): { normalWeapons: boolean; fire: boolean; poisons: boolean; pathogens: boolean; age: boolean } {
  const out = { normalWeapons: false, fire: false, poisons: false, pathogens: false, age: false };
  for (const t of traits) {
    if (t.special !== 'immunity') continue;
    const list = tags(t.substance ?? '');
    if (!list.length) { out.normalWeapons = true; continue; }
    for (const tag of list) {
      for (const k of Object.keys(IMMUNITY_SYNONYMS) as (keyof typeof out)[]) {
        if (IMMUNITY_SYNONYMS[k].includes(tag)) out[k] = true;
      }
    }
  }
  return out;
}

/** Armor (ballistic and impact) against non-magical attacks from immunity to normal weapons. */
export function immunityArmorFromEssence(essence: number): number {
  return Math.floor(Math.max(0, essence) * K().immunity.armorPerEssence);
}

// ---------------------------------------------------------------- TN-changing powers

export const TN_POWER_SPECIALS = ['concealment', 'confusion', 'movement', 'fear', 'guard'] as const;

type ModKey = 'testsTn' | 'perceivedTn' | 'attackedTn' | 'movementFactor';

/** What a TN-changing power puts on its target (only the keys the power sets). */
export function powerModifierBundle(special: string, o: { force: number; successes: number }): Partial<EffectBundle> {
  const mods = (K().powerMods as Record<string, Partial<Record<ModKey, number | 'force' | 'successes'>>>)[special];
  if (!mods) return {};
  const out: Partial<EffectBundle> = {};
  for (const [k, v] of Object.entries(mods) as [ModKey, number | 'force' | 'successes'][]) {
    let n = v === 'force' ? Math.floor(o.force) : v === 'successes' ? Math.max(0, o.successes) : Number(v);
    if (!Number.isFinite(n)) n = 0;
    if (k === 'movementFactor' && n === 0) n = 1;
    out[k] = n;
  }
  return out;
}

/** Movement rates multiplied by a factor, to the nearest whole metre (unchanged for a bad factor). */
export function movementWithFactor(rates: { walk: number; run: number }, factor: number): { walk: number; run: number } {
  if (!Number.isFinite(factor) || factor <= 0) return { walk: rates.walk, run: rates.run };
  return { walk: Math.max(0, Math.round(rates.walk * factor)), run: Math.max(0, Math.round(rates.run * factor)) };
}

const POWER_LABELS: Record<string, string> = {
  concealment: 'Concealment', confusion: 'Confusion', movement: 'Movement', fear: 'Fear', guard: 'Guard',
};

/** A display name for a power Special. */
export function powerModifierLabel(special: string): string {
  const s = String(special ?? '');
  return POWER_LABELS[s] ?? (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
}
