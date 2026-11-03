/**
 * v0.72.0: magic and critters fixes from the v0.69.0 review (O13–O21). Pure, Foundry-free functions; the rule
 * values and switches are RULES.MAGIC_V72 (rules/config72/magic.ts). Every function reads the switches through RULES
 * at call time, and most take an explicit override for tests and callers.
 */
import { MAGIC_V72 } from './config72/magic.ts';
import { BOOK_V78 } from './config78.ts';
import { spiritOnMasterDeath } from './glamour.ts';
import { RULES } from './config.ts';
import { t as tx, tList } from '../helpers/i18n.ts';

type Level = 'L' | 'M' | 'S' | 'D';
// v0.81.0 (RC-17): read through RULES at call time, as the sibling files do (the direct import is the fallback).
const C = (): typeof MAGIC_V72 => (RULES as any).MAGIC_V72 ?? MAGIC_V72;
const B = (): typeof BOOK_V78 => (RULES as any).BOOK_V78 ?? BOOK_V78;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const whole = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

// ---------------------------------------------------------------- O13: bound spirits when the master dies

/**
 * O13: the master-death mode for a spirit kind: MAGIC_V72.masterDies.kinds (unknown kinds use `other`);
 * 'legacy', or `byKind` off, gives `legacyMode` (MAGIC_V61.masterDies, the old one-mode-for-all).
 */
export function masterDeathMode(kind: string, legacyMode: string): 'free' | 'depart' | 'none' {
  const m = C().masterDies;
  const norm = (x: string): 'free' | 'depart' | 'none' => (x === 'free' || x === 'depart' ? x : 'none');
  if (!m.byKind) return norm(str(legacyMode));
  const k = str(kind);
  const mode = m.kinds[k] ?? m.kinds.other ?? 'legacy';
  return mode === 'legacy' ? norm(str(legacyMode)) : norm(mode);
}

/** O13: what a bound spirit does when its summoner dies, by its kind (same shape as glamour.spiritOnMasterDeath). */
export function boundSpiritOnMasterDeath(kind: string, legacyMode: string): ReturnType<typeof spiritOnMasterDeath> {
  return spiritOnMasterDeath(kind, masterDeathMode(kind, legacyMode));
}

// ---------------------------------------------------------------- O14: adepts in astral combat

export interface AstralCombatProfile {
  /** 'spirit' (Force dice), 'magician' (the astral attack skill) or 'adept' (MAGIC_V72.adeptAstral). */
  mode: 'spirit' | 'magician' | 'adept';
  /** The skill to roll ('' for a spirit: its Force). */
  skill: string;
  /** The attribute to default to without the skill. */
  fallback: 'willpower' | 'quickness' | 'strength';
  /** The pool for astral attack, defense and soak; null = none. */
  pool: 'spell' | 'combat' | null;
  damageLevel: Level;
  note: string;
}

/**
 * O14: how an actor fights on the astral plane. Spirits: Force + Combat Pool. Magicians: `base.skill`
 * (RULES.ASTRAL.attackSkill, defaulting to Willpower) with `base.pool`. Physical adepts
 * (MAGIC_V72.adeptAstral.enabled): Unarmed Combat (or a better martial art) defaulting to Quickness, the
 * Combat Pool, and killing hands' damage level. With the switch off an adept fights as a magician (the old way).
 */
export function astralCombatProfile(o: {
  type: string; tradition: string;
  base: { skill: string; pool: 'spell' | 'combat'; level: Level };
  /** Active killing hands level (1–4), 0 = none. */
  killingHandsLevel?: number;
  /** RULES.ADEPT.killingHands.levels (by level, from 1). */
  killingHandsLevels?: ReadonlyArray<Level>;
  unarmedRating?: number;
  /** The best martial art the adept knows (its skill name and rating), if any. */
  martial?: { name: string; rating: number } | null;
}): AstralCombatProfile {
  if (str(o?.type) === 'spirit') return { mode: 'spirit', skill: '', fallback: 'willpower', pool: 'combat', damageLevel: o.base.level, note: '' };
  const a = C().adeptAstral;
  if (str(o?.tradition) !== 'adept' || !a.enabled) {
    return { mode: 'magician', skill: o.base.skill, fallback: 'willpower', pool: o.base.pool, damageLevel: o.base.level, note: '' };
  }
  const m = o.martial && a.martialArts && whole(o.martial.rating) > 0 && whole(o.martial.rating) >= whole(o.unarmedRating) ? o.martial : null;
  const kh = whole(o.killingHandsLevel);
  const levels = o.killingHandsLevels ?? ['L', 'M', 'S', 'D'];
  const khLevel = a.killingHands && kh > 0 ? (levels[Math.min(kh, levels.length) - 1] ?? o.base.level) : null;
  return {
    mode: 'adept',
    skill: m ? m.name : a.skill,
    fallback: a.fallback,
    pool: a.pool === 'none' ? null : a.pool,
    damageLevel: khLevel ?? o.base.level,
    note: khLevel ? ` [killing hands ${khLevel}]` : '',
  };
}

/**
 * O14: the pool an actor spends in astral combat (attack, defense, soak, forcing a barrier): `poolFor`'s astral
 * branch. Spirits: Combat Pool; adepts: MAGIC_V72.adeptAstral.pool (null = none); magicians: `base`.
 */
export function astralPoolKind(o: { type: string; tradition: string; base: 'spell' | 'combat' }): 'spell' | 'combat' | null {
  if (str(o?.type) === 'spirit') return 'combat';
  const a = C().adeptAstral;
  if (str(o?.tradition) === 'adept' && a.enabled) return a.pool === 'none' ? null : a.pool;
  return o.base;
}

// ---------------------------------------------------------------- O15: metamagic limits

/**
 * O15: whether this tradition may learn a metamagic technique. A physical adept only the techniques in
 * MAGIC_V72.metamagicLimits.adept; an aspected sorcerer none of `conjuringTechniques`; an aspected conjurer
 * none of `sorceryTechniques`. `block` false with mode 'warn' (allowed with a warning); 'off' always allows.
 */
export function metamagicAllowed(tradition: string, technique: string): { ok: boolean; block: boolean; reason: string | null } {
  const L = C().metamagicLimits;
  const t = str(technique);
  const tr = str(tradition);
  let reason: string | null = null;
  if (L.mode !== 'off' && t) {
    if (tr === 'adept' && !L.adept.includes(t)) reason = tx('SR2E.Text.Sorcery.physicalAdeptsCanLearnOnly', { list: tList(L.adept) || tx('SR2E.Text.Sorcery.noTechniques') });
    else if (tr === 'sorcerer' && L.conjuringTechniques.includes(t)) reason = tx('SR2E.Text.Sorcery.needsConjuringWhichAn', { name: cap(t) });
    else if (tr === 'conjurer' && L.sorceryTechniques.includes(t)) reason = tx('SR2E.Text.Sorcery.needsSorceryWhichAn', { name: cap(t) });
  }
  return { ok: !reason, block: Boolean(reason) && L.mode === 'block', reason };
}

/** O15: the techniques the initiation dialog offers (with mode 'block', the ones this tradition can't learn are left out). */
export function metamagicChoices(tradition: string, techniques: readonly string[]): string[] {
  return techniques.filter((t) => !metamagicAllowed(tradition, t).block);
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ---------------------------------------------------------------- O16: dispelling drain

/** O16: Spell Pool dice for dispelling drain: what was asked for, up to what's left (0 with the switch off). */
export function dispelDrainPoolDice(requested: number, spellPoolLeft: number): number {
  if (!C().dispelDrainPool) return 0;
  return Math.min(whole(requested), whole(spellPoolLeft));
}

// ---------------------------------------------------------------- O17: barrier spells

export const BARRIER_KINDS = ['ward', 'mana barrier', 'astral barrier', 'physical barrier'] as const;
export type BarrierKind = (typeof BARRIER_KINDS)[number];

/**
 * O17: whether a spell raises a barrier, and which: its `system.barrier` field ('mana' | 'physical'), else (with
 * `matchByName`) its name. null when it doesn't or the switch is off.
 */
export function barrierSpellKind(spell: { name?: string; system?: { barrier?: string } } | null | undefined): 'mana' | 'physical' | null {
  const b = C().barrierSpells;
  if (!b.enabled || !spell) return null;
  const f = str(spell.system?.barrier);
  if (f === 'mana' || f === 'physical') return f;
  if (!b.matchByName) return null;
  const n = str(spell.name).toLowerCase();
  if (/\bmana\s+barrier\b/.test(n)) return 'mana';
  if (/\bphysical\s+barrier\b/.test(n)) return 'physical';
  return null;
}

/** O17: a barrier spell's rating: the Force or the successes (MAGIC_V72.barrierSpells.rating), at least 1. */
export function barrierSpellRating(force: number, successes: number, kind?: 'mana' | 'physical'): number {
  if (C().barrierSpells.rating === 'successes') return Math.max(1, whole(successes));
  // v0.78.0 (RULES.BOOK_V78.manaBarrier.rating 'halfForce', Core Rules): a Mana Barrier's rating is half its Force.
  if (kind === 'mana' && B().manaBarrier.rating === 'halfForce') return Math.max(1, Math.floor(whole(force) / 2));
  return Math.max(1, whole(force));
}

/** O17: how big the barrier is drawn (metres; 1–100): the caster's Magic, the Force, or a fixed size. */
export function barrierSpellRadius(o: { force: number; magic: number }): number {
  const b = C().barrierSpells;
  const r = b.radius === 'force' ? whole(o.force) : b.radius === 'magic' ? whole(o.magic) : whole(b.fixedMetres);
  return Math.min(100, Math.max(1, r));
}

/**
 * O17: the barrier actor a barrier spell raises (Actor.create data). It carries flags.sr2e.barrierSpell so it
 * can be found and taken down when the spell ends.
 */
export function barrierSpellActorData(o: {
  kind: 'mana' | 'physical'; force: number; successes: number; spellName: string; casterUuid: string; casterName: string; effectId?: string; systemId?: string;
}): { name: string; type: 'barrier'; system: { barrierKind: BarrierKind; rating: number; baseRating: number }; flags: Record<string, unknown> } {
  const rating = barrierSpellRating(o.force, o.successes, o.kind);
  const barrierKind: BarrierKind = o.kind === 'physical' ? 'physical barrier' : 'mana barrier';
  return {
    name: `${str(o.spellName) || (o.kind === 'physical' ? 'Physical Barrier' : 'Mana Barrier')} (${str(o.casterName)})`,
    type: 'barrier',
    system: { barrierKind, rating, baseRating: rating },
    flags: { [o.systemId ?? 'sr2e']: { barrierSpell: { casterUuid: str(o.casterUuid), spellName: str(o.spellName), effectId: str(o.effectId) } } },
  };
}

/**
 * O17/O19: whether a barrier of this kind stops something. Wards, mana barriers and astral barriers stop astral
 * presences and spells crossing them; a physical barrier stops physical bodies and gunfire (not spells or
 * astral forms). VERIFY (whether a physical barrier blocks spells)
 */
export function barrierBlocks(barrierKind: string, what: 'astral' | 'physical' | 'spell' | 'gunfire'): boolean {
  const k = str(barrierKind) || 'ward';
  if (k === 'physical barrier') return what === 'physical' || what === 'gunfire';
  return what === 'astral' || what === 'spell';
}

// ---------------------------------------------------------------- O18: innate spells

/**
 * O18: the dice a caster rolls in place of Sorcery. With a Sorcery skill: that skill (unchanged). Without one
 * (MAGIC_V72.innateSpells.enabled): a spirit casts with its Force (allies: MAGIC_V72.ally.castDice), and a
 * critter casts a spell marked innate with its Magic (else Essence). null = can't cast (no Sorcery, not innate).
 */
export function innateSpellDice(o: {
  actorType: string; sorceryRating: number; spellInnate?: boolean; spiritKind?: string;
  force?: number; magic?: number; essence?: number; intelligence?: number;
}): { dice: number; label: string; innate: boolean } | null {
  const s = whole(o?.sorceryRating);
  if (s > 0) return { dice: s, label: tx('SR2E.Text.Sorcery.sorcery'), innate: false };
  const I = C().innateSpells;
  if (!I.enabled) return null;
  if (str(o.actorType) === 'spirit') {
    if (str(o.spiritKind) === 'ally' && C().ally.enabled && C().ally.castDice === 'intelligence') return { dice: whole(o.intelligence), label: tx('SR2E.Text.Sorcery.intelligenceAlly'), innate: true };
    const d = I.spiritDice === 'magic' ? whole(o.magic) || whole(o.force) : whole(o.force);
    return d > 0 ? { dice: d, label: I.spiritDice === 'magic' ? tx('SR2E.Text.Sorcery.magic') : tx('SR2E.Text.Sorcery.force'), innate: true } : null;
  }
  if (!o.spellInnate) return null;
  // Review fix: only NPCs (critters) cast innate spells; a player character with the box ticked can't.
  if (str(o.actorType) !== 'npc') return null;
  const magic = whole(o.magic), essence = whole(o.essence);
  const d = I.critterDice === 'essence' ? essence : magic || essence;
  const label = I.critterDice === 'essence' || !magic ? tx('SR2E.Text.Sorcery.essence') : tx('SR2E.Text.Sorcery.magic');
  return d > 0 ? { dice: d, label, innate: true } : null;
}

/** O18: whether an innate casting takes drain (MAGIC_V72.innateSpells.drain). */
export function innateDrains(): boolean {
  return C().innateSpells.drain !== 'none';
}

// ---------------------------------------------------------------- O19: what a ward stops on the map

/**
 * O19: the planes an actor is present on, for wards and barriers on the map. Projecting magicians and
 * unmaterialized spirits: astral only. Materialized spirits and dual-natured critters: both (when the switches
 * are on). An astrally perceiving magician: both only with `perceiving`. Everyone else: physical only. With
 * `enabled` off: the old reading (only projecting forms and unmaterialized spirits are astral).
 */
export function wardPresence(a: { type?: string; materialized?: boolean; astralMode?: string; dualNatured?: boolean } | null | undefined): { astral: boolean; physical: boolean } {
  if (!a) return { astral: false, physical: false };
  const W = C().wardPresence;
  const spirit = str(a.type) === 'spirit';
  const mode = str(a.astralMode);
  if (spirit && a.materialized === false) return { astral: true, physical: false };
  if (!spirit && mode === 'projecting') return { astral: true, physical: false };
  if (!W.enabled) return { astral: false, physical: true };
  if (spirit) return { astral: Boolean(W.materializedSpirits), physical: true };
  if (a.dualNatured) return { astral: Boolean(W.dualNatured), physical: true };
  if (mode === 'perceiving') return { astral: Boolean(W.perceiving), physical: true };
  return { astral: false, physical: true };
}

/** O19: whether a barrier of this kind stops a mover with this presence (either plane it blocks). */
export function barrierStopsMover(presence: { astral: boolean; physical: boolean }, barrierKind: string): boolean {
  return (presence.astral && barrierBlocks(barrierKind, 'astral')) || (presence.physical && barrierBlocks(barrierKind, 'physical'));
}

// ---------------------------------------------------------------- O20: a projecting magician's wounds

/** O20: whether a projecting magician's wounds count on tests and on Initiative (MAGIC_V72.astralWounds, or `mode`). */
export function astralWoundRules(mode?: string): { tests: boolean; initiative: boolean } {
  const m = str(mode ?? C().astralWounds);
  if (m === 'neither') return { tests: false, initiative: false };
  if (m === 'legacy') return { tests: true, initiative: false };
  return { tests: true, initiative: true };
}

/** O20: the wound penalty taken off a projecting magician's Initiative (`penalty` = initiativeWoundPenalty(...)). */
export function projectingInitiativeMinus(penalty: number, mode?: string): number {
  return astralWoundRules(mode).initiative ? whole(penalty) : 0;
}

// ---------------------------------------------------------------- O21: anchoring and allies

/** O21: Good Karma to anchor a spell of this Force (0 with the switch off). VERIFY */
export function anchoringKarma(force: number): number {
  const a = C().anchoring;
  return a.enabled ? Math.ceil(Math.max(1, whole(force)) * Math.max(0, Number(a.karmaPerForce) || 0)) : 0;
}

/** O21: Good Karma to teach an ally a spell of this Force. VERIFY */
export function allySpellKarma(spellForce: number): number {
  const a = C().ally;
  return a.enabled ? Math.ceil(Math.max(1, whole(spellForce)) * Math.max(0, Number(a.spellKarmaPerForce) || 0)) : 0;
}

/** O21: an ally ability by id (sense link, astral gateway), with its Karma; null if unknown or the switch is off. */
export function allyAbility(id: string): { id: string; label: string; karma: number } | null {
  const a = C().ally;
  if (!a.enabled) return null;
  return a.abilities.find((x) => x.id === str(id)) ?? null;
}

/**
 * O21: whose senses a magician's perception uses: the ally's (its uuid) when the magician has switched on the
 * sense link and the ally has the ability, else the magician's own (null).
 */
export function senseLinkSource(o: { linkOn: boolean; allyUuid: string; allyAbilities: Record<string, boolean> | null | undefined }): string | null {
  if (!C().ally.enabled || !o?.linkOn || !str(o.allyUuid)) return null;
  return o.allyAbilities?.senseLink ? str(o.allyUuid) : null;
}
