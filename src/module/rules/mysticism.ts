/** The rest of magic (v0.39.0): elemental effects, sustain limits, domains, focus addiction, sites, rituals, signatures, background count. */
import { elementalSustainSeconds } from './spirits923.ts';
import { RULES } from './config.ts';
import { tags } from './thaumaturgy.ts';
import { ritualMaterials, ritualNeedsCircle } from './sorcery923.ts';
import { isShamanic, isHermetic } from './arcana.ts';
import { t as tx } from '../helpers/i18n.ts';

export type ElementEffect = 'fire' | 'shock' | 'corrode' | 'knockdown' | 'none';

/** The secondary effect a hit from an elemental manipulation of this element can have. */
export function elementEffect(element: string): ElementEffect {
  const e = (element ?? '').trim().toLowerCase();
  return (RULES.MAGIC_V39.elementEffects as Record<string, ElementEffect>)[e] ?? 'none';
}

/** Words for the effect buttons and cards. */
export const ELEMENT_EFFECT_LABELS: Record<ElementEffect, string> = {
  fire: 'Catches fire', shock: 'Shock (Body test)', corrode: 'Acid eats armor', knockdown: 'Knockdown test', none: '',
};

/** Electric shock: no successes on the Body test means the target is stunned. */
export function shockOutcome(successes: number): { stunned: boolean; initiativeLoss: number } {
  const stunned = successes <= 0;
  return { stunned, initiativeLoss: stunned ? RULES.MAGIC_V39.shock.initiativeLoss : 0 };
}

/** When an elemental sustaining a spell lets it drop (world time, seconds), or -1 for never. */
export function elementalSustainUntil(now: number, force: number): number {
  // v0.92.3 (RULES.SPIRITS_V923.elementalSustain 'book', Core p. 142): one Combat Turn (3 s) per point of Force.
  if (RULES.SPIRITS_V923.elementalSustain === 'book') return now + elementalSustainSeconds(Math.max(1, force));
  const h = RULES.MAGIC_V39.sustainLimit.hoursPerForce;
  return h > 0 ? now + Math.max(1, force) * h * 3600 : -1;
}

/** A nature spirit is outside its domain when the scene has environment tags and none is its domain. */
export function outsideDomain(domain: string, sceneTags: readonly string[]): boolean {
  const d = tags(domain);
  if (!d.length || !sceneTags.length) return false;
  const scene = sceneTags.map((t) => t.toLowerCase());
  return !d.some((x) => scene.includes(x));
}

/** The focus addiction test's TN, or null when there is no risk (total within Magic). */
export function addictionTn(total: number, magic: number): number | null {
  if (total <= magic) return null;
  const tn = RULES.MAGIC_V39.addiction.tnFrom === 'excess' ? total - magic : total;
  return Math.max(2, tn);
}

export type SiteKind = '' | 'library' | 'circle' | 'lodge';
export const SITE_KINDS: readonly SiteKind[] = ['', 'library', 'circle', 'lodge'];
export interface MagicSite { name: string; kind: SiteKind; rating: number; tag: string }

/** The best site of a kind whose tag fits (an empty tag fits anything), or null. */
export function bestSite(sites: readonly MagicSite[], kind: SiteKind, tag = ''): MagicSite | null {
  const want = tag.trim().toLowerCase();
  const fits = sites.filter((s) => s.kind === kind && (!want || !s.tag.trim() || tags(s.tag).includes(want)));
  return [...fits].sort((a, b) => b.rating - a.rating)[0] ?? null;
}

/**
 * What sites a magician lacks for a task (empty = all there). 'elemental': hermetics need a
 * conjuring library and a circle of the element; 'ritual': a sorcery library (hermetic) or a lodge
 * of the totem (shamanic). Each rated at least `force`.
 */
export function missingSites(task: 'elemental' | 'ritual', tradition: string, sites: readonly MagicSite[], o: { force: number; element?: string; totem?: string }): string[] {
  const c = RULES.MAGIC_V39.sites;
  const out: string[] = [];
  const need = (kind: SiteKind, tag: string, what: string) => {
    const s = bestSite(sites, kind, tag);
    if (!s) out.push(what);
    else if (s.rating < o.force) out.push(tx('SR2E.Text.Mysticism.siteOfRatingOrMore', { what, force: o.force, name: s.name, rating: s.rating }));
  };
  const hermetic = isHermetic(tradition);
  const shamanic = isShamanic(tradition);
  if (task === 'elemental' && hermetic) {
    if (c.elementalLibrary) need('library', 'conjuring', tx('SR2E.Text.Mysticism.aConjuringLibrary'));
    if (c.elementalCircle) need('circle', o.element ?? '', o.element ? tx('SR2E.Text.Mysticism.aHermeticCircleElement', { element: o.element }) : tx('SR2E.Text.Mysticism.aHermeticCircle'));
  }
  if (task === 'ritual' && c.ritualSite) {
    // v0.80.0 (RULES.URR_V80.magRitualCircle, URR): a hermetic ritual needs a hermetic circle.
    // v0.92.3 (RULES.SORCERY_V923.ritualTeam 'book', Core p. 135): the book's rule too.
    if (hermetic) { if (ritualNeedsCircle()) need('circle', '', tx('SR2E.Text.Mysticism.aHermeticCircle')); else need('library', 'sorcery', tx('SR2E.Text.Mysticism.aSorceryLibrary')); }
    if (shamanic) need('lodge', o.totem ?? '', o.totem ? tx('SR2E.Text.Mysticism.aLodgeTotem', { totem: o.totem }) : tx('SR2E.Text.Mysticism.aLodge'));
  }
  return out;
}

/** Ritual materials for a ritual of this Force (nuyen). */
export function ritualMaterialsCost(force: number, category = ''): number {
  // v0.80.0 (RULES.URR_V80.magRitualMaterials 'category', URR): by spell category.
  // v0.92.3 (RULES.SORCERY_V923.ritualMaterials 'book', Core p. 135): the same costs.
  const urr = ritualMaterials(force, category);
  if (urr !== null) return urr;
  return Math.max(0, force) * RULES.MAGIC_V39.ritualStages.materialsPerForce;
}

/** Hours of preparation left before a ritual can be sent. */
export function ritualPrepLeft(startedAt: number, now: number, hours: number): number {
  return Math.max(0, Math.ceil((startedAt + hours * 3600 - now) / 3600));
}

/** Seconds a cleaning takes off a signature's remaining life. */
export function cleaningSeconds(successes: number): number {
  return Math.max(0, successes) * RULES.MAGIC_V39.cleaning.hoursPerSuccess * 3600;
}

/** A background count source on a scene. */
export interface BackgroundSource { name: string; rating: number; aspect: string[]; toxic: boolean }

/**
 * Parse background count sources, one per line: `Name: rating`, optionally followed by
 * `aspected to bear, forest` and/or `toxic` (in any order, separated by commas or semicolons).
 */
export function parseBackgroundSources(text: string): BackgroundSource[] {
  const out: BackgroundSource[] = [];
  for (const raw of (text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(.+?):\s*(-?\d+)\s*(.*)$/.exec(line);
    if (!m) continue;
    const rest = m[3] ?? '';
    const toxic = /\btoxic\b/i.test(rest);
    const am = /aspect(?:ed)?(?:\s+to)?\s*:?\s*(.+)$/i.exec(rest);
    const aspect = am ? tags(am[1]!.replace(/\btoxic\b/ig, '')) : [];
    out.push({ name: m[1]!.trim(), rating: Math.max(0, Number(m[2]) || 0), aspect, toxic });
  }
  return out;
}

/** Background count sources written back as text (one per line). */
export function formatBackgroundSources(list: readonly BackgroundSource[]): string {
  return list.map((s) => `${s.name}: ${s.rating}${s.aspect.length ? ` aspected to ${s.aspect.join(', ')}` : ''}${s.toxic ? `${s.aspect.length ? ';' : ''} toxic` : ''}`).join('\n');
}

/**
 * What the background count does to one magician: the TN penalty (the highest unaligned source or
 * the scene's plain count), bonus dice from an aligned aspected source, whether a toxic source
 * applies, and a note. `align` are the magician's tags (tradition, totem, element).
 */
export function backgroundFor(sources: readonly BackgroundSource[], plainCount: number, align: readonly string[]): { penalty: number; bonusDice: number; toxic: boolean; note: string } {
  const mine = align.map((a) => a.toLowerCase()).filter(Boolean);
  const mode = RULES.MAGIC_V39.background.aspected;
  let penalty = Math.max(0, Math.floor(plainCount || 0));
  let bonusDice = 0;
  let toxic = false;
  const notes: string[] = [];
  for (const s of sources) {
    // Toxic shamans (v0.45.0) line up with toxic sources.
    const aligned = (s.aspect.length > 0 && s.aspect.some((a) => mine.includes(a))) || (s.toxic && mine.includes('toxic'));
    if (aligned && mode === 'bonus') {
      if (s.rating > bonusDice) bonusDice = s.rating;
      notes.push(tx('SR2E.Text.Mysticism.alignedDice', { name: s.name, rating: s.rating }));
      continue;
    }
    if (aligned && mode === 'ignore') {
      notes.push(tx('SR2E.Text.Mysticism.alignedNoPenalty', { name: s.name }));
      continue;
    }
    if (s.rating > penalty) penalty = s.rating;
    if (s.toxic && s.rating > 0) toxic = true;
  }
  return { penalty, bonusDice, toxic, note: notes.join(', ') };
}
