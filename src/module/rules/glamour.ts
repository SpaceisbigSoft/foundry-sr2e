import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { timeOfDayHours } from './arcanum.ts';
import { t as tx } from '../helpers/i18n.ts';

/**
 * v0.61.0 magic gaps (pure rules; values in RULES.MAGIC_V61, all VERIFY): seeing through invisibility,
 * spirit initiative, totem drawbacks (berserk, daylight), hold powers (paralysis, petrification,
 * binding), Increase [Attribute] spells vs cyberware, following magical links, exclusive-spell limits,
 * repeating powers, bound spirits on their master's death and insect spirit host bodies. No Foundry.
 */

const C = () => RULES.MAGIC_V61;

/** A finite number or 0. */
const num = (n: unknown): number => (Number.isFinite(Number(n)) ? Number(n) : 0);
/** A whole, non-negative number. */
const whole = (n: unknown): number => Math.max(0, Math.floor(num(n)));
const str = (s: unknown): string => (typeof s === 'string' ? s : s == null ? '' : String(s));

// ---------------------------------------------------------------- Invisibility

/** v0.61.0: an observer's test to see through Invisibility: invisibility.attribute dice vs TN = spell Force. */
export function invisibilityResistTest(o: { intelligence: number; force: number }): { dice: number; tn: number } {
  return { dice: whole(o?.intelligence), tn: Math.max(2, whole(o?.force)) };
}

/** v0.78.0 (RULES.BOOK_V78.invisibility 'perception', Core Rules): a Perception Test against TN = 2 × the caster's successes. */
export function invisibilityPerceptionTest(o: { dice: number; casterSuccesses: number }): { dice: number; tn: number } {
  return { dice: whole(o?.dice), tn: Math.max(2, RULES.BOOK_V78.invisibility.tnPerSuccess * whole(o?.casterSuccesses)) };
}

/** v0.61.0: does the observer see through? Successes must beat the caster's (ties per invisibility.beat); false when resisting is off. */
export function seesThrough(observerSuccesses: number, casterSuccesses: number): boolean {
  const i = C().invisibility;
  if (!i.resist) return false;
  const o = whole(observerSuccesses), c = whole(casterSuccesses);
  if (o <= 0) return false;
  // v0.78.0 (BOOK_V78.invisibility 'perception'): one success on the Perception Test is enough.
  if (RULES.BOOK_V78.invisibility.mode === 'perception') return true;
  return i.beat === 'greaterOrEqual' ? o >= c : o > c;
}

/** v0.61.0: the concealment an invisibility effect still gives this observer (0 when seen through or the astral rule applies; other kinds pass through). */
export function effectiveConcealment(o: { kind: string; rating: number; observerAstral: boolean; seenThrough: boolean; observerThermographic?: boolean }): number {
  const rating = Math.max(0, num(o?.rating));
  const kind = str(o?.kind);
  const i = C().invisibility;
  if (kind !== 'invisibility' && kind !== 'improvedInvisibility') return rating;
  if (o.seenThrough) return 0;
  // v0.78.0 (BOOK_V78.invisibility.thermographicSeesMana, Core Rules): thermographic sight still sees the body's heat.
  if (kind === 'invisibility' && o.observerThermographic && RULES.BOOK_V78.invisibility.thermographicSeesMana) return 0;
  if (o.observerAstral && (kind === 'invisibility' ? i.astralSeesMana : i.astralSeesPhysical)) return 0;
  return rating;
}

// ---------------------------------------------------------------- Spirit initiative

/** v0.61.0: a spirit's initiative bonuses: kind default (spiritInitiative.byKind, unknown → other), replaced by a template's non-zero values; astral (+astralBonus) when unmaterialized. */
export function spiritInitiative(o: {
  kind: string; reaction: number; materialized: boolean;
  template?: { reactionBonus?: number; initiativeDiceBonus?: number } | null;
}): { reactionBonus: number; diceBonus: number; astral: boolean; label: string } {
  const s = C().spiritInitiative;
  const kind = str(o?.kind);
  const row = s.byKind?.[kind] ?? s.byKind?.other ?? { reaction: 0, dice: 0 };
  const tr = num(o?.template?.reactionBonus), td = num(o?.template?.initiativeDiceBonus);
  let reactionBonus = tr ? tr : num(row.reaction);
  const diceBonus = td ? td : num(row.dice);
  const astral = !!s.astralWhenUnmaterialized && o?.materialized === false;
  if (astral) reactionBonus += num(s.astralBonus);
  const total = whole(o?.reaction) + reactionBonus;
  const parts = [`Reaction ${whole(o?.reaction)}`];
  if (reactionBonus) parts.push(`${reactionBonus > 0 ? '+' : ''}${reactionBonus}`);
  const label = `${parts.join(' ')} = ${total}${diceBonus ? `, +${diceBonus}D6` : ''}${astral ? ' (astral)' : ''}`;
  return { reactionBonus, diceBonus, astral, label };
}

// ---------------------------------------------------------------- Totem drawbacks

export type TotemDrawback = { berserk: '' | 'wounded' | 'combat'; daylightTn: number };
const berserkOf = (v: unknown): '' | 'wounded' | 'combat' | null => (v === 'wounded' || v === 'combat' || v === '' ? v : null);

/** v0.61.0: a totem's situational drawbacks: its own fields win (a set berserk or non-zero daylightTn), else the preset by name (case-insensitive). */
export function totemDrawback(totem: { name?: string; berserk?: string; daylightTn?: number }): TotemDrawback {
  const name = str(totem?.name).trim().toLowerCase();
  const preset = name ? C().totems.presets.find((p) => str(p.name).toLowerCase() === name) : undefined;
  const own = berserkOf(totem?.berserk);
  const berserk = own ? own : (berserkOf(preset?.berserk) ?? '');
  const ownDay = Math.max(0, num(totem?.daylightTn));
  const daylightTn = ownDay ? ownDay : Math.max(0, num(preset?.daylightTn));
  return { berserk, daylightTn };
}

/** v0.61.0: the test to resist going berserk: totems.berserk.attribute dice vs totems.berserk.tn. */
export function berserkTest(o: { willpower: number }): { dice: number; tn: number } {
  return { dice: whole(o?.willpower), tn: Math.max(2, num(C().totems.berserk.tn)) };
}

/** v0.61.0: Combat Turns of berserk rage: turnsBase − successes, at least 0. */
export function berserkTurns(successes: number): number {
  return Math.max(0, whole(C().totems.berserk.turnsBase) - whole(successes));
}

/** v0.61.0: does this situation trigger the totem's berserk drawback? ('wounded' on damage, 'combat' in combat or on damage.) */
export function berserkTriggered(d: Partial<TotemDrawback> | null | undefined, o: { damaged: boolean; inCombat: boolean }): boolean {
  if (d?.berserk === 'wounded') return !!o?.damaged;
  if (d?.berserk === 'combat') return !!o?.inCombat || !!o?.damaged;
  return false;
}

/** v0.61.0: is it daylight at this world time? (totems.daylight: arcanum sunrise/sunset or explicit hours.) */
export function isDaylight(worldTime: number): boolean {
  const d = C().totems.daylight;
  const ns = RULES.MAGIC_V56.natureSpirits;
  const from = d.source === 'hours' ? num(d.fromHour) : num(ns.sunrise ?? 6);
  const to = d.source === 'hours' ? num(d.toHour) : num(ns.sunset ?? 18);
  const h = timeOfDayHours(num(worldTime));
  return from <= to ? h >= from && h < to : h >= from || h < to;
}

/** v0.61.0: the totem's daylight TN modifier at this world time, or null (none, or night). */
export function daylightModifier(d: Partial<TotemDrawback> | null | undefined, worldTime: number): TargetNumberModifier | null {
  const v = Math.max(0, num(d?.daylightTn));
  if (!v || !isDaylight(worldTime)) return null;
  return { id: 'totemDaylight', label: tx('SR2E.Card.Mod.totemDaylight'), value: v };
}

// ---------------------------------------------------------------- Hold powers

/** v0.61.0: critter powers that hold their target. */
export const HOLD_SPECIALS: readonly string[] = ['paralysis', 'petrification', 'binding'];

/** v0.61.0: what a hold power does (holdPowers): status, turns (0 = until dropped), blocks, armor, break test; null for other specials. */
export function holdEffect(special: string, o: { force: number; successes: number }): {
  status: string; turns: number; blocksActions: boolean; armorBonus: number; breakTest: { attribute: string; tn: number } | null;
} | null {
  const h = C().holdPowers;
  const force = whole(o?.force), successes = whole(o?.successes);
  switch (str(special)) {
    case 'paralysis': {
      const p = h.paralysis;
      const turns = Math.max(1, p.turnsPer === 'force' ? force : successes);
      return { status: str(p.status), turns, blocksActions: !!p.blocksActions, armorBonus: num(p.armorBonus), breakTest: null };
    }
    case 'petrification': {
      const p = h.petrification;
      return { status: str(p.status), turns: 0, blocksActions: !!p.blocksActions, armorBonus: num(p.armorBonus), breakTest: null };
    }
    case 'binding': {
      const b = h.binding;
      return { status: str(b.status), turns: 0, blocksActions: !!b.blocksActions, armorBonus: num(b.armorBonus), breakTest: { attribute: str(b.breakAttribute), tn: Math.max(2, force) } };
    }
    default:
      return null;
  }
}

/** v0.61.0: breaking free of a binding: holdPowers.binding.breakAttribute dice vs TN = Force. */
export function breakFreeTest(o: { attribute: number; force: number }): { dice: number; tn: number } {
  return { dice: whole(o?.attribute), tn: Math.max(2, whole(o?.force)) };
}

// ---------------------------------------------------------------- Increase [Attribute] vs cyberware

/** v0.61.0: Increase [Attribute] spell bonuses after cyberware (attributeSpells.exclusiveWithCyber, house rule): attributes cyber/bioware raises get 0. */
export function spellAttributesAfterCyber(spell: Record<string, number>, cyber: Record<string, number>): { attributes: Record<string, number>; dropped: string[] } {
  const attributes: Record<string, number> = {};
  const dropped: string[] = [];
  const on = !!C().attributeSpells.exclusiveWithCyber;
  for (const [k, v] of Object.entries(spell ?? {})) {
    const n = num(v);
    if (on && n && num((cyber ?? {})[k]) > 0) { attributes[k] = 0; dropped.push(k); } else attributes[k] = n;
  }
  return { attributes, dropped };
}

// ---------------------------------------------------------------- Magical links

/** v0.61.0: following a magical link back to its magician: dice vs links.tn (+ forceModifier × Force); unknown kinds read 'Magical link'. */
export function linkTrackTest(o: { dice: number; kind: string; force: number }): { dice: number; tn: number; modifiers: TargetNumberModifier[]; label: string } {
  const l = C().links;
  const kind = (l.kinds as ReadonlyArray<{ id: string; label: string }>).find((k) => k.id === str(o?.kind));
  const label = kind ? kind.label : tx('SR2E.Text.Glamour.magicalLink');
  const fm = num(l.forceModifier) * whole(o?.force);
  const modifiers = fm ? [{ label: tx('SR2E.Card.Mod.linkForce', { whole: whole(o?.force) }), value: fm }] : [];
  return { dice: whole(o?.dice), tn: Math.max(2, num(l.tn)), modifiers, label: tx('SR2E.Text.Glamour.followLink', { label }) };
}

// ---------------------------------------------------------------- Exclusive spells

/** v0.61.0: why sustained exclusive spells block this action (exclusive.*), or null when allowed. */
export function exclusiveBlock(o: { sustaining: Array<{ spellName: string; exclusive?: boolean }>; action: 'cast' | 'test'; newSpellExclusive?: boolean }): string | null {
  const e = C().exclusive;
  const list = Array.isArray(o?.sustaining) ? o.sustaining.filter((s) => s && typeof s === 'object') : [];
  const ex = list.find((s) => s.exclusive);
  const name = (s: { spellName: string }) => str(s.spellName) || tx('SR2E.Text.Glamour.aSpell');
  if (o?.action === 'cast') {
    if (ex && e.blocksCasting) return tx('SR2E.Text.Glamour.sustainingExclusiveSpellCantCast', { name: name(ex) });
    if (o.newSpellExclusive && list.length && e.blocksSustainingOthers) return tx('SR2E.Text.Glamour.exclusiveSpellDropFirst', { list: list.map(name).join(', ') });
    return null;
  }
  if (ex && e.blocksAllTests) return tx('SR2E.Text.Glamour.sustainingExclusiveSpellNoOther', { name: name(ex) });
  return null;
}

// ---------------------------------------------------------------- Repeating powers

/** v0.61.0: is a repeating power due again? (no last use, another combat, or a later round; false when repeating.autoPrompt is off.) */
export function repeatDue(last: { combatId?: string; round?: number } | null, now: { combatId: string; round: number }): boolean {
  if (!C().repeating.autoPrompt) return false;
  if (!last) return true;
  if (str(last.combatId) !== str(now?.combatId)) return true;
  return num(now?.round) > num(last.round);
}

// ---------------------------------------------------------------- Bound spirits on master's death

/** v0.61.0: what a bound spirit does when its summoner dies (masterDies, or `mode`); free spirits are unaffected. */
export function spiritOnMasterDeath(kind: string, mode?: string): { action: 'free' | 'depart' | 'none'; update: Record<string, unknown>; note: string } {
  const m = str(mode ?? C().masterDies);
  const action: 'free' | 'depart' | 'none' = m === 'free' || m === 'depart' ? m : 'none';
  if (str(kind) === 'free' || action === 'none') return { action: 'none', update: {}, note: str(kind) === 'free' ? tx('SR2E.Text.Glamour.freeSpiritUnaffected') : tx('SR2E.Text.Glamour.spiritUnaffected') };
  if (action === 'depart') return { action, update: { 'system.summonerUuid': '', 'system.services': 0 }, note: tx('SR2E.Text.Glamour.masterDeadTheSpiritDeparts') };
  return { action, update: { 'system.summonerUuid': '', 'system.spiritKind': 'free', 'system.services': 0 }, note: tx('SR2E.Text.Glamour.masterDeadTheSpiritGoes') };
}

// ---------------------------------------------------------------- Insect spirits

/** v0.61.0: the flesh-form bonus to physical attributes (insect.fleshAttributeBonus). */
export function fleshBonus(force: number): number {
  const b = C().insect.fleshAttributeBonus;
  const f = whole(force);
  return b === 'force' ? f : b === 'halfForce' ? Math.floor(f / 2) : 0;
}

/** v0.61.0: a flesh-form insect spirit's Body, Quickness and Strength: the host's + fleshBonus(Force). */
export function fleshFormAttributes(host: { body: number; quickness: number; strength: number }, force: number, role?: string): { body: number; quickness: number; strength: number } {
  // v0.78.0 (RULES.BOOK_V78.insectFlesh 'byRole', Grimoire / Bug City): soldiers host + Force, workers host − 1.
  const F = RULES.BOOK_V78.insectFlesh;
  if (F.mode === 'byRole') {
    const r = role === 'worker' || role === 'soldier' ? role : F.defaultRole;
    const b = r === 'worker' ? F.workerOffset : whole(force);
    const at = (v: unknown) => Math.max(1, whole(v) + b);
    return { body: at(host?.body), quickness: at(host?.quickness), strength: at(host?.strength) };
  }
  const b = fleshBonus(force);
  return { body: whole(host?.body) + b, quickness: whole(host?.quickness) + b, strength: whole(host?.strength) + b };
}

/** v0.78.0: an insect spirit's role from its type's name: 'worker', 'soldier' or '' (unknown: BOOK_V78.insectFlesh.defaultRole). */
export function insectRole(spiritType: string): 'worker' | 'soldier' | '' {
  const t = str(spiritType).toLowerCase();
  return /\bworker/.test(t) ? 'worker' : /\bsoldier/.test(t) ? 'soldier' : '';
}

/** v0.61.0: an insect spirit's form: 'flesh' with a host body, else 'true' (insect.needsHost tells the glue to ask for a host). */
export function insectForm(o: { hostUuid: string }): 'flesh' | 'true' {
  return str(o?.hostUuid).trim() ? 'flesh' : 'true';
}
