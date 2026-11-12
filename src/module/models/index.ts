import {
  deriveStats, woundModifier, monitorStatus, RULES,
  currentEssence, effectiveMagic, sumBonuses, totalEssenceLoss,
  spiritAttribute, SPIRIT_KINDS, ASTRAL_MODES, astralForm,
  POWER_DICE_SOURCES, POWER_TN_SOURCES, POWER_RESIST,
  TRADITIONS, FOCUS_TYPES, SPELL_DURATIONS, adeptAugmentations, adeptPowerPoints, type AdeptPower,
  METAMAGIC, initiateMagic, geasaPenalty,
  focusAddiction, MATERIAL_KINDS,
  hackingPool, matrixReaction, matrixInitiativeDice, detectionFactor, loadedUtility, personaWarnings, memoryUse,
  UTILITY_KINDS, IC_CATEGORIES, icInitiativeDice, matrixCrashed, nextSheafStep,
  IC_BEHAVIORS, TRACE_MODES, PERSONA_ATTRIBUTES, effectivePersona, simInitiativeDice, activePsyche,
  bodyIndex, encumbrancePenalty, metatype, racialModifier,
  controlRigRating, riggedStats, controlPool, autopilotStats, vehicleDamageModifier, vehicleDestroyed, vehicleCategory, CONTROL_MODES, rcdCapacity,
  veh80DamagedSpeed,
  stackAugmentations, capInitiativeDice, limbCapacity, softRating,
  bioEffect, culturedWarnings, bioConflicts, bioArmorAfterConflict, compensatedMonitor, bodyIndexToxinPenalty,
  type Attributes, type Status, type Augmentation,
  monitorBars, trackBar, carriedLoad,
  POWER_SPECIALS, ALLERGY_SEVERITIES, ADEPT_SPECIALS, SITE_KINDS, adeptSpecialLevel,
  movementRates, streetCred,
  painEditedMonitor, recoveringItemIds, chipSlots, chipsRunning, possessedAttributes,
  ARC_SIDES, cargoLoad, tortoisePool, otakuPersona,
  CONTAGION_VECTORS,
  safehouseTotals, buildOwed,
  sumBundles, describeBundle, adeptBudget, improvedSenses, movementWithFactor, reflexTypeOf,
  loadingDone, realityFilterEffect, vehicleSystemsEffect,
  essenceWithHole, opticsOf, mergeVision, boneLacingTotals,
  spiritStatus,
  earsDerived, combineDrugEffects, spiritInitiative, spellAttributesAfterCyber,
  qualityVitals, overflowBody, bioVitals, incompatibleReflexes, drugsForBonuses, painToleranceMonitor, sensitiveEssence, sensitiveBodyIndex, bioKindsV72, astralWoundRules, mountUsage, mountCapacity, racialNatural, racialFloorWarnings, attributeLimitsWith,
  encephalonTaskPool,
  powerFocusRating, ADEPT_SENSES,
} from '../rules/index.ts';
// v0.71.0 (R7): MPCP caps on loaded programs.
import { programsOverMpcp, mpcpProgramWarnings, mpcpCapsOn, programRunRating } from '../rules/matrix.ts';
import { personaSpeed, jackpointMods, otakuPersona923 } from '../rules/matrix923.ts';
import { sysNow } from '../helpers/clock.ts';
import { urrMagAstralModeFor, urrMagAdeptFoci } from '../rules/urr80-magic.ts';
import { bleedEveryText } from '../rules/urr80-health-social.ts';
import { deathBody, dwarfDiceAgainst } from '../rules/health923.ts';
import { magicPoolBase, sorceryRating } from '../rules/docs79-drones-magic.ts';
import { poolLayers, narrowLeft, sorcerySkillOf } from '../rules/magicpool.ts';
import { TWEAK_TARGETS, sumTweaks, isCarried } from '../rules/tweaks.ts';
import * as U80C from '../rules/urr80-combat.ts';
import { astralCombatPool } from '../rules/spirits923.ts';
import { dermalArmor, threatBook } from '../rules/core923.ts';
import { armorTotal } from '../rules/gear.ts';
import { FEEDS } from '../rules/tactics.ts';
import { ART_ARCHETYPES } from '../rules/tokenart.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';
import { gearBook, isDermalPlating, dermalRating, limbPairsBody, housedEssenceCost, boneLacingBook, cyberReplacements, awakenedBioEssence, culturedBodyCost, essenceKills, bookLoad, heavyArmorPoolPenalty } from '../rules/gear923.ts';
import { round2 } from '../rules/util.ts';

const f = () => foundry.data.fields;
/** World time now (0 outside Foundry). */
const worldNow = (): number => sysNow();
/** v0.57.0: Matrix timers now: the Combat Turn of a started combat (else null) and the world time. */
const matrixNowM = (): { round: number | null; worldTime: number; combatId: string | null } => {
  const c: any = (globalThis as any).game?.combat;
  return { round: c?.started ? Number(c.round ?? 0) : null, worldTime: worldNow(), combatId: c?.started ? String(c.id ?? '') : null };
};
/** v0.57.0: a utility that has finished loading (RULES.MATRIX_V57.loading). */
export function programIsReady(sys: any): boolean {
  const r = Number(sys?.loading?.round ?? -1), w = Number(sys?.loading?.worldTime ?? -1);
  return (r < 0 && w < 0) || loadingDone({ round: r, worldTime: w, combatId: String(sys?.loading?.combatId ?? '') }, matrixNowM());
}

export const ATTRIBUTE_KEYS = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

/**
 * v0.81.1 (SEC2b-1): a generous ceiling on numbers a player writes on their own actor that the sheets and the GM's
 * panels draw one box or pip per point of (Body's Overflow row, the Karma Pool). Far above any real rating, so no
 * world's legitimate value is touched; it stops a 5,000,000 Body from building millions of boxes on the GM's client.
 * (Foundry's NumberField clamps to `max` when it cleans data.)
 */
const SANE_MAX = 1000;

function attributeField() {
  const fields = f();
  return new fields.SchemaField({
    // `base` is the natural rating; `mod` is cyberware/magic/etc. Total = base + mod.
    base: new fields.NumberField({ required: true, integer: true, min: 0, max: SANE_MAX, initial: 3 }),
    mod: new fields.NumberField({ required: true, integer: true, min: -SANE_MAX, max: SANE_MAX, initial: 0 }),
  });
}

/**
 * v0.56.0: what a sustained spell or a power changes on its target (rules/effects.ts EffectBundle):
 * attributes, Reaction, initiative dice, armor, TN on the bearer's tests / to perceive / to attack
 * the bearer, and a movement factor.
 */
function effectsField() {
  const fields = f();
  const n = () => new fields.NumberField({ required: true, integer: true, initial: 0 });
  return new fields.SchemaField({
    attributes: new fields.SchemaField(Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, n()]))),
    reaction: n(), initiativeDice: n(), ballistic: n(), impact: n(),
    testsTn: n(), perceivedTn: n(), attackedTn: n(),
    movementFactor: new fields.NumberField({ required: true, min: 0, initial: 1 }),
  });
}

/** v0.61.0: dice or a TN change this item gives a named skill (climbing gear, a reflex recorder...). */
function skillModsField() {
  const fields = f();
  return new fields.ArrayField(new fields.SchemaField({
    skill: new fields.StringField({ required: true, initial: '' }),
    dice: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    tn: new fields.NumberField({ required: true, integer: true, initial: 0 }),
  }));
}

/**
 * v0.92.1: custom tweaks (rules/tweaks.ts): free-form, labelled modifiers on any item (an attribute, Reaction, initiative
 * dice, a pool, a skill's dice or TN, damage Power, armor, or a note). Cleaned by normalizeTweaks wherever they are read.
 */
function tweaksField() {
  const fields = f();
  return new fields.ArrayField(new fields.SchemaField({
    id: new fields.StringField({ required: true, initial: '' }),
    label: new fields.StringField({ required: true, initial: '' }),
    target: new fields.StringField({ required: true, initial: 'note', choices: [...TWEAK_TARGETS] }),
    key: new fields.StringField({ required: true, initial: '' }),
    value: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    on: new fields.BooleanField({ required: true, initial: true }),
  }));
}

/** v0.92.1 (RULES.SHEET_V921.carried): carried on the person; what isn't has no weight, isn't searched and can't be used. */
function carriedField() {
  return new (f()).BooleanField({ required: true, initial: true });
}

/** v0.61.0: a drug's effects beyond attributes (armor, TNs, movement, ignoring wounds, ignoring Stun boxes). */
function drugExtraField() {
  const fields = f();
  const n = () => new fields.NumberField({ required: true, integer: true, initial: 0 });
  return new fields.SchemaField({
    ballistic: n(), impact: n(), testsTn: n(), perceivedTn: n(), attackedTn: n(),
    movementFactor: new fields.NumberField({ required: true, min: 0, initial: 1 }),
    ignoreWounds: new fields.BooleanField({ required: true, initial: false }),
    stunIgnoreBoxes: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
  });
}

/** v0.58.0: legality (RULES.GEAR_V58.legality) and whether the owner holds a permit for it. */
function legalFields() {
  const fields = f();
  return {
    legality: new fields.StringField({ required: true, blank: true, initial: '', choices: RULES.GEAR_V58.legality.categories.map((c) => c.id) }),
    permit: new fields.BooleanField({ required: true, initial: false }),
  };
}

/** Points per persona program (and MPCP): deck damage, crippling. */
function personaPoints(withMpcp = false) {
  const fields = f();
  const n = () => new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 });
  return new fields.SchemaField({ ...(withMpcp ? { mpcp: n() } : {}), bod: n(), evasion: n(), masking: n(), sensors: n() });
}

/** Cyberware on an actor as plain rules-engine inputs (embedded items are prepared before derived data runs). */
export function augmentationsOf(actor: any): Augmentation[] {
  const items: any[] = [...(actor?.items ?? [])];
  // v0.45.0: an item still healing in after surgery gives nothing yet (RULES.BIOWARE.recovery).
  const healing = new Set(recoveringItemIds(actor?.system?.recovering ?? [], worldNow()));
  const limbs = new Set(items.filter((i) => i.type === 'cyberware' && i.system.kind === 'cyberlimb' && i.system.installed).map((i) => i.id));
  // v0.72.0 (O11): Sensitive System makes cyberware cost more Essence (RULES.HEALTH_V72.qualities).
  const qv = qualityVitals(actor?.system?.qualities ?? [], RULES.STREET.qualities.enabled);
  // v0.92.3 (RULES.GEAR_V923.awakenedBioware 'essence', Shadowtech p. 5): magicians and adepts pay Essence for bioware.
  const awakened = Number(actor?.system?.magic ?? 0) > 0;
  // v0.92.3 (RULES.GEAR_V923.boneLacing 'book'): cyber replacements weaken bone lacing (Cybertechnology pp. 49–50).
  const replacements = cyberReplacements(items.filter((i) => i.type === 'cyberware' && i.system.installed && !i.system.bioware).map((i) => ({ name: i.name, kind: i.system.kind })));
  return items
    .filter((i) => i.type === 'cyberware')
    .map((i) => {
      // Bioware kinds (v0.30.0) add their effects to the item's own bonuses.
      const e = i.system.bioware ? bioEffect(bioItemOf(i, healing)) : null;
      const attributes = { ...(i.system.attributes ?? {}) };
      if (e) for (const [k, v] of Object.entries(e.attributes)) attributes[k] = (attributes[k] ?? 0) + v;
      // v0.92.3 (RULES.GEAR_V923.dermal 'body', Core p. 248): dermal plating adds its rating to Body (not armor).
      if (gearBook('dermal') && isDermalPlating({ name: i.name, bioware: i.system.bioware, kind: i.system.kind })) attributes['body'] = (attributes['body'] ?? 0) + dermalRating(i.system);
      // v0.92.3 (RULES.GEAR_V923.boneLacing 'book', Shadowtech p. 42): bone lacing adds to Body.
      if (i.system.kind === 'boneLacing') attributes['body'] = (attributes['body'] ?? 0) + boneLacingBook(String(i.system.lacing ?? ''), replacements).body;
      const housed = Boolean(i.system.housedIn && limbs.has(i.system.housedIn));
      // v0.92.3 (RULES.GEAR_V923.limbHoused 'book', Cybertechnology p. 49): only listed ware costs less in a cyberlimb.
      const housedCost = housed ? housedEssenceCost({ name: i.name, essenceCost: i.system.essenceCost }) : null;
      return {
        // Bioware costs Body Index instead of Essence; cyberware housed in a cyberlimb uses its capacity.
        essenceCost: i.system.bioware ? awakenedBioEssence(culturedBodyCost(i.system.bodyIndex ?? 0, Boolean(i.system.cultured), String(i.system.bioKind ?? ''), String(i.name ?? '')), awakened)
          : housed ? (housedCost === null ? 0 : sensitiveEssence(housedCost, qv)) : sensitiveEssence(i.system.essenceCost, qv),
        grade: i.system.bioware ? 'standard' : i.system.grade,
        installed: i.system.installed && !healing.has(i.id),
        // v0.54.0: Essence goes at implant, even while the item heals in (it works only after).
        essenceCounted: Boolean(i.system.installed),
        attributes,
        reaction: (i.system.reaction ?? 0) + (e?.reaction ?? 0),
        initiativeDice: (i.system.initiativeDice ?? 0) + (e?.initiativeDice ?? 0),
        reflexes: i.system.reflexes || e?.reflexes || '',
        name: i.name,
        damaged: Boolean(i.system.damaged),
      };
    });
}

/** v0.92.3 (RULES.GEAR_V923.load 'book', Core p. 185): a heavy load counts as this many Stun boxes for wound modifiers. */
export function loadStunBoxes(load: any): number {
  return Math.max(0, Number(load?.boxes ?? 0) || 0);
}

/** Body Index used by installed bioware. */
function bio_index_used(ware: any[]): number {
  // v0.92.3 (RULES.GEAR_V923.cultured 'book'): cultured bioware's Body Cost × .75.
  return ware.filter((i: any) => i.system.bioware && i.system.installed).reduce((n: number, i: any) => n + culturedBodyCost(Math.max(0, i.system.bodyIndex ?? 0), Boolean(i.system.cultured), String(i.system.bioKind ?? ''), String(i.name ?? '')), 0);
}

/** A bioware item as the rules engine sees it. */
function bioItemOf(i: any, healing?: Set<string>) {
  return { name: i.name, bioKind: i.system.bioKind ?? 'other', rating: i.system.rating ?? 0, installed: Boolean(i.system.installed) && !healing?.has(i.id), damaged: Boolean(i.system.damaged), active: Boolean(i.system.bioActive), cultured: Boolean(i.system.cultured) };
}

/** v0.30.0: what the wearer's bioware adds up to beyond attributes (armor, toxins, platelets, compensators, warnings). */
function bioDerived(ware: any[], dermal: { ballistic: number; impact: number }, healing?: Set<string>) {
  const bio = ware.filter((i: any) => i.system.bioware).map((i: any) => bioItemOf(i, healing));
  const effects = bio.map((b) => bioEffect(b));
  const sum = (k: 'ballistic' | 'impact' | 'toxinDice' | 'inhalantDice' | 'boxesOff' | 'ignoreBoxes' | 'physicalSkillDice' | 'stunBoxesOff' | 'perceptionTn') => effects.reduce((n, e) => n + e[k], 0);
  const cyberNames = ware.filter((i: any) => !i.system.bioware && i.system.installed && !i.system.damaged).map((i: any) => String(i.name ?? ''));
  const conflicts = bioConflicts(bio, cyberNames);
  return {
    // v0.54.0: compared kind by kind (ballistic with ballistic, impact with impact).
    ballistic: bioArmorAfterConflict(sum('ballistic'), dermal.ballistic, conflicts.armorConflict),
    impact: bioArmorAfterConflict(sum('impact'), dermal.impact, conflicts.armorConflict),
    toxinDice: sum('toxinDice'), inhalantDice: sum('inhalantDice'), boxesOff: sum('boxesOff'), ignoreBoxes: sum('ignoreBoxes'),
    // v0.78.0: Power off toxins by vector (RULES.BOOK_V78.toxinBioware 'power').
    toxinPowerOff: effects.reduce((acc: Record<string, number>, e) => { for (const [k, v] of Object.entries(e.powerOff ?? {})) acc[k] = (acc[k] ?? 0) + v; return acc; }, {}),
    // v0.45.0: enhanced articulation, trauma dampers, pain editors.
    physicalSkillDice: sum('physicalSkillDice'), stunBoxesOff: sum('stunBoxesOff'), perceptionTn: sum('perceptionTn'),
    // v0.92.3 (RULES.GEAR_V923.bioware 'book'): enhanced articulation's dice on every Active Skill, a cerebral booster's
    // Task Pool, and an adrenal pump's Quickness that doesn't raise Reaction (Shadowtech pp. 19, 23, 34).
    allActiveDice: effects.reduce((n, e) => n + Number(e.allActiveDice ?? 0), 0),
    taskPool: effects.reduce((n, e) => n + Number(e.taskPool ?? 0), 0),
    quicknessNoReaction: effects.reduce((n, e) => n + Number(e.quicknessNoReaction ?? 0), 0),
    ignoreStunWounds: effects.some((e) => e.ignoreStunWounds),
    warnings: [...culturedWarnings(bio), ...conflicts.warnings],
    adrenalActive: bio.some((b) => b.bioKind === 'adrenalPump' && b.active && b.installed),
    // v0.72.0 (O9): symbiotes, nephritic screens, extended-volume lungs (rules/vitals.ts).
    vitals: bioVitals(bio),
  };
}

/** v0.29.0: what the wearer's cyberware adds up to (smartlink level, vision, jacks, limbs, skillsofts). */
function cyberDerived(actor: any, ware: any[]) {
  // v0.54.0: ware still healing in after surgery does nothing yet, like its attribute bonuses.
  const healing = new Set(recoveringItemIds(actor?.system?.recovering ?? [], worldNow()));
  const live = ware.filter((i: any) => i.system.installed && !i.system.damaged && !healing.has(i.id));
  const max = (f: (i: any) => number) => live.reduce((n: number, i: any) => Math.max(n, f(i) || 0), 0);
  const named = (re: RegExp) => live.some((i: any) => re.test(i.name ?? ''));
  const datajack = live.some((i: any) => i.system.kind === 'datajack') || named(/data\s*-?jack/i);
  const chipjack = live.some((i: any) => i.system.kind === 'chipjack') || named(/chip\s*-?jack/i);
  // v0.45.0: chipjacks and headware memory limit how many chips run; encephalons add dice.
  const chipjacks = live.filter((i: any) => i.system.kind === 'chipjack' || /chip\s*-?jack/i.test(i.name ?? '')).length;
  const memoryMp = live.filter((i: any) => i.system.kind === 'memory').reduce((n: number, i: any) => n + Math.max(0, i.system.rating ?? 0), 0);
  const encephalon = max((i) => (i.system.kind === 'encephalon' ? i.system.rating : 0));
  const skillwires = max((i) => (i.system.kind === 'skillwires' ? i.system.rating : 0));
  const limbs = live.filter((i: any) => i.system.kind === 'cyberlimb').map((i: any) => {
    const housed = ware.filter((h: any) => h.system.housedIn === i.id).map((h: any) => ({ essenceCost: h.system.essenceCost, grade: h.system.grade }));
    return { id: i.id, name: i.name, location: i.system.limb?.location ?? 'other', strength: i.system.limb?.strength ?? 0, quickness: i.system.limb?.quickness ?? 0, capacity: limbCapacity(i.system.limb?.capacity ?? 0, housed),
      // v0.43.0: a limb's armor counts against called shots at it (RULES.GEAR.cyberlimbs).
      ballistic: i.system.armorBallistic ?? 0, impact: i.system.armorImpact ?? 0 };
  });
  const wiring = { skillwires, chipjack, datajack };
  const chipItems = [...(actor?.items ?? [])].filter((i: any) => i.type === 'gear' && i.system.chip?.kind && isCarried(i));
  const running = chipsRunning(chipItems.map((i: any) => ({ kind: i.system.chip.kind, rating: i.system.chip.rating ?? 0, slotted: Boolean(i.system.chip.slotted) })), chipSlots({ chipjacks, datajack, memoryMp }));
  const softs = chipItems.map((i: any, n: number) => {
    const chip = { name: i.name, kind: i.system.chip.kind, skill: i.system.chip.skill, rating: i.system.chip.rating, slotted: Boolean(i.system.chip.slotted) };
    const r = softRating(chip, wiring);
    const run = running[n]!;
    // A chip with no free jack or memory gives nothing (warn keeps it working but notes it).
    const blocked = r.rating > 0 && !run.runs;
    const enforce = RULES.CYBERWARE.chips.enforce;
    return { gearId: i.id, ...chip, effective: blocked && enforce === 'block' ? 0 : r.rating, reason: blocked ? run.reason : r.reason, via: run.via };
  });
  // v0.58.0: worn vision gear (goggles, glasses, binoculars, visors) adds to the eyes.
  const gearOptics = opticsOf([...(actor?.items ?? [])].filter((i: any) => i.type === 'gear' && isCarried(i)).map((i: any) => ({ ...(i.system.optics ?? {}), damaged: Boolean(i.system.damaged) })));
  const eyes = mergeVision({ magnification: max((i) => i.system.magnification), flareComp: live.some((i: any) => i.system.flareComp) }, gearOptics);
  return {
    smartlinkLevel: max((i) => Math.max(i.system.smartlinkLevel ?? 0, i.system.smartlink || /smart\s*-?link/i.test(i.name ?? '') ? 1 : 0)),
    magnification: eyes.magnification,
    flareComp: eyes.flareComp,
    /** v0.58.0: what worn vision gear gives (low-light and thermographic go into derived.vision). */
    optics: gearOptics,
    /** v0.58.0: working filtration systems (kind, rating) and the best bone lacing. */
    filters: live.filter((i: any) => i.system.kind === 'filtration' && i.system.filterKind).map((i: any) => ({ kind: i.system.filterKind, rating: Math.max(0, i.system.rating ?? 0), name: i.name })),
    // v0.92.3 (RULES.GEAR_V923.boneLacing 'book'): lacing adds to Body itself (augmentationsOf), not soak dice.
    lacing: ((l) => (gearBook('boneLacing') ? { ...l, soakDice: 0 } : l))(boneLacingTotals(live.filter((i: any) => i.system.kind === 'boneLacing').map((i: any) => ({ kind: i.system.lacing || '' })))),
    ultrasound: live.some((i: any) => i.system.ultrasound),
    /** v0.92.3 (RULES.GEAR_V923.dermal 'body', limbPairs 'body'): dermal armor's Body (plating and pairs of cyberlimbs). */
    dermal: (gearBook('dermal') ? live.filter((i: any) => isDermalPlating({ name: i.name, bioware: i.system.bioware, kind: i.system.kind })).reduce((n: number, i: any) => n + dermalRating(i.system), 0) : 0)
      + limbPairsBody(live.filter((i: any) => i.system.kind === 'cyberlimb' && !i.system.bioware).map((i: any) => ({ name: i.name, location: i.system.limb?.location ?? 'other' }))),
    pheromones: max((i) => i.system.pheromones),
    datajack, chipjack, skillwires, limbs, softs,
    encephalon, chipjacks, memoryMp,
    // v0.46.0: an ICCM biofeedback filter's rating.
    iccm: max((i) => (i.system.kind === 'iccm' ? Math.max(1, i.system.rating ?? 0) : 0)),
    damaged: ware.filter((i: any) => i.system.installed && i.system.damaged).map((i: any) => ({ id: i.id, name: i.name })),
    /** v0.61.0: working cyberears (amplification, damper, high/low frequency, recorder). */
    ears: earsDerived(live.filter((i: any) => i.system.kind === 'ears' || Number(i.system.hearingAmp ?? 0) > 0 || i.system.dampener).map((i: any) => ({
      hearingAmp: i.system.hearingAmp, dampener: i.system.dampener, highFrequency: i.system.highFrequency, lowFrequency: i.system.lowFrequency, recorder: i.system.recorder,
    }))),
    /** v0.61.0: dice and TN for named skills from working ware and carried, undamaged gear. */
    skillMods: [
      ...live.filter((i: any) => (i.system.skillMods ?? []).length).map((i: any) => ({ name: i.name, mods: i.system.skillMods })),
      ...[...(actor?.items ?? [])].filter((i: any) => i.type === 'gear' && isCarried(i) && !i.system.damaged && Number(i.system.quantity ?? 1) > 0 && (i.system.skillMods ?? []).length).map((i: any) => ({ name: i.name, mods: i.system.skillMods })),
    ],
  };
}

/**
 * Foci an actor can use, as plain rules-engine inputs (with the item id).
 * v0.81.0 (RB-9): the same list as SR2Actor.foci(): under RULES.URR_V80.magAdeptFoci a physical adept's
 * non-weapon foci don't count (focus addiction, power focus).
 */
export function fociOf(actor: any, tradition: string = String(actor?.system?.tradition ?? '')): any[] {
  return urrMagAdeptFoci(tradition, [...(actor?.items ?? [])].filter((i: any) => i.type === 'focus').map((i: any) => ({ id: i.id, ...i.system })));
}

/** Active adept powers on an actor as plain rules-engine inputs. */
export function adeptPowersOf(actor: any): AdeptPower[] {
  // v0.56.0: powers past the power-point budget (derived.adeptOver, when switched off) give nothing.
  const d = actor?.system?.derived;
  const over = new Set<string>(d?.adeptOverOff ? (d.adeptOver ?? []).map((o: any) => o.id) : []);
  return [...(actor?.items ?? [])]
    .filter((i: any) => i.type === 'adeptpower')
    .map((i: any) => ({ ...i.system, ...(over.has(i.id) ? { active: false } : {}) }));
}

/** PCs and NPCs share one data model, as SR2 stat blocks use the same attributes. */
export class CharacterDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    return {
      attributes: new fields.SchemaField(
        Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, attributeField()])),
      ),
      essence: new fields.NumberField({ required: true, min: 0, initial: 6 }),
      /** Essence drained (negative) or gained by draining (positive), and lost over time (v0.39.0). */
      essenceShift: new fields.NumberField({ required: true, initial: 0 }),
      /** Shapeshifters (v0.39.0): the form they are in, and the human form's attribute adjustments. */
      shapeshift: new fields.SchemaField({
        enabled: new fields.BooleanField({ required: true, initial: false }),
        form: new fields.StringField({ required: true, initial: 'animal', choices: ['animal', 'human'] }),
        human: new fields.SchemaField(Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, new fields.NumberField({ required: true, integer: true, initial: 0 })]))),
      }),
      magic: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** Metatype (RULES.METATYPES): racial modifiers, maximums, vision, reach and armor. */
      // v0.73.0 (O36): no fixed choices, so house-rule metatypes validate; an unknown id rules as Human.
      metatype: new fields.StringField({ required: true, initial: 'human' }),
      /** Add the racial modifiers to the base ratings (untick if the base ratings already include them). */
      racialModifiers: new fields.BooleanField({ required: true, initial: true }),
      /** v0.83.0: the default token art: the portrait's figure ('' = from the name) and badge ('' = automatic, 'none'). */
      art: new fields.SchemaField({
        figure: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'masc', 'fem'] }),
        archetype: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'none', ...ART_ARCHETYPES] }),
      }),
      /** Dying: whether the character has been stabilised, and the Combat Turn dying began (-1 = not dying). */
      care: new fields.SchemaField({
        stabilised: new fields.BooleanField({ required: true, initial: false }),
        dyingSince: new fields.NumberField({ required: true, integer: true, min: -1, initial: -1 }),
      }),
      /** v0.61.0: a DocWagon contract (RULES.HEALTH_V61.docwagon): tier ('' = none), paid until (world time), resuscitations used this contract year. */
      docwagon: new fields.SchemaField({
        tier: new fields.StringField({ required: true, blank: true, initial: '' }),
        paidUntil: new fields.NumberField({ required: true, initial: -1 }),
        resuscitationsUsed: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      reactionBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      initiativeDiceBonus: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      karma: new fields.SchemaField({
        good: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        pool: new fields.NumberField({ required: true, integer: true, min: 0, max: SANE_MAX, initial: 1 }),
        /** Karma Pool points used since the last refresh. */
        poolSpent: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        /** Karma earned over the career (v0.33.0): every RULES.UPKEEP.karma.poolEvery (v0.92.3: 11) puts a point in the pool. */
        career: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      /** Upkeep (v0.33.0): lifestyle and when it is paid until (world time; -1 never), contacts, a ledger. */
      lifestyle: new fields.SchemaField({
        // v0.73.0: no fixed choices (house-rule lifestyles validate; an unknown id reads as the lowest).
        level: new fields.StringField({ required: true, initial: 'low' }),
        paidUntil: new fields.NumberField({ required: true, initial: -1 }),
        /** v0.73.0: owned outright (RULES.CHARACTERS_V73.lifestyle): never overdue. */
        outright: new fields.BooleanField({ required: true, initial: false }),
      }),
      contacts: new fields.ArrayField(new fields.SchemaField({
        id: new fields.StringField({ required: true, initial: '' }),
        name: new fields.StringField({ required: true, initial: '' }),
        level: new fields.NumberField({ required: true, integer: true, min: 1, max: 3, initial: 1 }),
        role: new fields.StringField({ required: true, initial: '' }),
        notes: new fields.StringField({ required: true, initial: '' }),
        /** v0.44.0: Loyalty (caps dice bought with payment), what they know, and their fee per legwork. */
        loyalty: new fields.NumberField({ required: true, integer: true, min: 1, max: 6, initial: 1 }),
        skills: new fields.StringField({ required: true, initial: '' }),
        fee: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        /** v0.49.0: the contact's own dice for digging (0 = none), and favours (+ they owe you, − you owe them). */
        dice: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        favours: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        /** v0.91.6: a fixer finds things for the character (their own find, for a fee and more time). */
        fixer: new fields.BooleanField({ required: true, initial: false }),
      })),
      ledger: new fields.ArrayField(new fields.SchemaField({
        t: new fields.NumberField({ required: true, initial: 0 }),
        kind: new fields.StringField({ required: true, initial: 'karma', choices: ['karma', 'nuyen', 'pool'] }),
        amount: new fields.NumberField({ required: true, initial: 0 }),
        reason: new fields.StringField({ required: true, initial: '' }),
      })),
      /** Dice already spent from each pool this Combat Turn. */
      poolSpent: new fields.SchemaField({
        combat: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        spell: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        hacking: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        control: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        // v0.78.0: an encephalon's Task Pool (RULES.BOOK_V78.encephalon).
        task: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        // v0.92.0: the Spell Pool's narrow layers spent (RULES.MAGIC_V920.poolLayers; rules/magicpool.ts).
        spellConc: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        spellSpec: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      /** Rigging: the vehicle this character drives (or is jumped into). The vehicle holds the mode too. */
      rigging: new fields.SchemaField({
        vehicleUuid: new fields.StringField({ required: true, initial: '' }),
        jumpedIn: new fields.BooleanField({ required: true, initial: false }),
        /** Drones subscribed to the rigger's remote control deck (UUIDs). */
        subscribed: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
      }),
      /** Drugs in effect (v0.31.0): their bonuses, when they wear off, and the crash. */
      drugs: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ required: true, initial: '' }),
        attributes: new fields.SchemaField(Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, new fields.NumberField({ required: true, integer: true, initial: 0 })]))),
        reaction: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        initiativeDice: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        /** v0.61.0: effects beyond attributes. */
        extra: drugExtraField(),
        round: new fields.NumberField({ required: true, integer: true, initial: -1 }),
        /** v0.81.0: the combat `round` belongs to ('' = none). */
        combatId: new fields.StringField({ required: true, blank: true, initial: '' }),
        worldTime: new fields.NumberField({ required: true, initial: -1 }),
        crashPower: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        crashLevel: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'L', 'M', 'S', 'D'] }),
        /** v0.72.0: doses taken while this one was active (RULES.HEALTH_V72.drugs). */
        doses: new fields.NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      })),
      /** Matrix state for deckers: jacked in or not, the host they are in, and persona damage. */
      matrix: new fields.SchemaField({
        jackedIn: new fields.BooleanField({ required: true, initial: false }),
        hostUuid: new fields.StringField({ required: true, initial: '' }),
        monitor: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        /** Hot or cold sim, and how the decker connects (v0.28.0). */
        sim: new fields.StringField({ required: true, initial: 'cold', choices: ['cold', 'hot'] }),
        connection: new fields.StringField({ required: true, initial: 'jackpoint', choices: RULES.MATRIX.connections.map((c) => c.id) }),
        /** Persona programs lowered by crippler IC until the decker jacks out (v0.27.0). */
        crippled: personaPoints(),
        /** Barrier IC this decker has decrypted past in the current host (UUIDs). */
        passed: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
        /** A trace IC locked on: when it completes (Combat Turn in combat, else world time) and what it does. */
        trace: new fields.SchemaField({
          active: new fields.BooleanField({ required: true, initial: false }),
          icUuid: new fields.StringField({ required: true, initial: '' }),
          icName: new fields.StringField({ required: true, initial: '' }),
          mode: new fields.StringField({ required: true, initial: 'dump', choices: [...TRACE_MODES] }),
          rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          hostUuid: new fields.StringField({ required: true, initial: '' }),
          round: new fields.NumberField({ required: true, integer: true, initial: -1 }),
          /** v0.81.0: the combat `round` belongs to ('' = none). */
          combatId: new fields.StringField({ required: true, blank: true, initial: '' }),
          worldTime: new fields.NumberField({ required: true, initial: -1 }),
        }),
        /** Psychotropic IC effects (v0.40.0): until a world time, −1 = until jacking out. */
        psyche: new fields.ArrayField(new fields.SchemaField({
          kind: new fields.StringField({ required: true, initial: 'cyberphobia' }),
          icName: new fields.StringField({ required: true, initial: '' }),
          rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          until: new fields.NumberField({ required: true, initial: -1 }),
        })),
        /** Grid travel (v0.40.0): on the way to a node, arriving at a Combat Turn or world time. */
        transit: new fields.SchemaField({
          hostUuid: new fields.StringField({ required: true, initial: '' }),
          hops: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          round: new fields.NumberField({ required: true, integer: true, initial: -1 }),
          worldTime: new fields.NumberField({ required: true, initial: -1 }),
        }),
        /** v0.46.0: km to the relay of a wireless link (0 = not checked), and LTG numbers this decker knows. */
        relayKm: new fields.NumberField({ required: true, min: 0, initial: 0 }),
        numbers: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
        /** v0.73.0 (O24): hosts this character has found (located) or analyzed; players see only these in host lists. */
        knownHosts: new fields.ArrayField(new fields.SchemaField({
          uuid: new fields.StringField({ required: true, initial: '' }),
          analyzed: new fields.BooleanField({ required: true, initial: false }),
        })),
        /** v0.49.0: an otaku's channels, and a jammed wireless link. */
        channels: new fields.SchemaField(Object.fromEntries(RULES.MATRIX.subsystems.map((k) => [k, new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })]))),
        jammed: new fields.SchemaField({
          active: new fields.BooleanField({ required: true, initial: false }),
          by: new fields.StringField({ required: true, initial: '' }),
          rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        }),
        /** v0.57.0: black IC that have engaged this decker (UUIDs), cybercombat maneuvers in force, the reality filter's result in a host, and the decker whose hitcher jack this character rides. */
        engagedBy: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
        maneuvers: new fields.ArrayField(new fields.SchemaField({
          kind: new fields.StringField({ required: true, initial: 'position', choices: ['position', 'parry', 'evade'] }),
          targetUuid: new fields.StringField({ required: true, initial: '' }),
          net: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          round: new fields.NumberField({ required: true, integer: true, initial: -1 }),
          /** v0.81.0: the combat `round` belongs to ('' = none). */
          combatId: new fields.StringField({ required: true, blank: true, initial: '' }),
          worldTime: new fields.NumberField({ required: true, initial: -1 }),
        })),
        filter: new fields.SchemaField({
          hostUuid: new fields.StringField({ required: true, initial: '' }),
          /** -1 not tested, 0 failed, 1 worked. */
          ok: new fields.NumberField({ required: true, integer: true, min: -1, max: 1, initial: -1 }),
        }),
        ridingWith: new fields.StringField({ required: true, initial: '' }),
      }),
      /** v0.42.0: drug addictions and diseases. */
      addictions: new fields.ArrayField(new fields.SchemaField({
        drug: new fields.StringField({ required: true, initial: '' }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        type: new fields.StringField({ required: true, initial: 'mental' }),
        recent: new fields.ArrayField(new fields.NumberField({ required: true, initial: 0 })),
        lastDose: new fields.NumberField({ required: true, initial: 0 }),
        addicted: new fields.BooleanField({ required: true, initial: false }),
        dosesAddicted: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        withdrawalNoted: new fields.BooleanField({ required: true, initial: false }),
        /** v0.92.3 (RULES.HEALTH_V923.addiction 'book', Shadowtech pp. 87–89): the character's rise over the drug's ratings,
         * doses taken, the drug's Strength and Tolerance ratings, immunity, and the recovery under way (−1 = none). */
        rise: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        doses: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        strength: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        tolerance: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        immune: new fields.BooleanField({ required: true, initial: false }),
        recovering: new fields.NumberField({ required: true, initial: -1 }),
        riseAtKick: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      })),
      diseases: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ required: true, initial: '' }),
        power: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        level: new fields.StringField({ required: true, initial: 'M' }),
        damageType: new fields.StringField({ required: true, initial: 'physical' }),
        intervalHours: new fields.NumberField({ required: true, min: 1, initial: 24 }),
        nextAt: new fields.NumberField({ required: true, initial: 0 }),
        recovered: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        needed: new fields.NumberField({ required: true, integer: true, min: 1, initial: 3 }),
        pending: new fields.BooleanField({ required: true, initial: false }),
        treated: new fields.BooleanField({ required: true, initial: false }),
        /** v0.48.0: how it spreads to others (RULES.HEALTH.contagion), when it was caught, its incubation, where from ('radiation'). */
        contagious: new fields.StringField({ required: true, blank: true, initial: '' }),
        infectedAt: new fields.NumberField({ required: true, initial: 0 }),
        incubationHours: new fields.NumberField({ required: true, min: 0, initial: 0 }),
        source: new fields.StringField({ required: true, blank: true, initial: '' }),
      })),
      /** v0.45.0: cyberware and bioware still healing in after surgery (they work from `until`, world time). */
      recovering: new fields.ArrayField(new fields.SchemaField({
        itemId: new fields.StringField({ required: true, initial: '' }),
        name: new fields.StringField({ required: true, initial: '' }),
        until: new fields.NumberField({ required: true, initial: 0 }),
        /** v0.48.0: the patient's care (RULES.BIOWARE.recovery.care) and the factor it gave. */
        care: new fields.StringField({ required: true, blank: true, initial: '' }),
        factor: new fields.NumberField({ required: true, min: 0, initial: 1 }),
        /** v0.48.0: whether paid care (hospital, intensive) was paid for the days it set. */
        paid: new fields.BooleanField({ required: true, initial: false }),
      })),
      /** v0.48.0: radiation dose built up (rating × hours) and when it was last updated (world time). */
      radiation: new fields.SchemaField({
        dose: new fields.NumberField({ required: true, min: 0, initial: 0 }),
        at: new fields.NumberField({ required: true, initial: 0 }),
      }),
      /** Natural or cybernetic vision (cyberware can add these too). */
      vision: new fields.SchemaField({
        lowLight: new fields.BooleanField({ required: true, initial: false }),
        thermographic: new fields.BooleanField({ required: true, initial: false }),
      }),
      /** Boxes of damage marked on each condition-monitor track. */
      monitor: new fields.SchemaField({
        physical: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        stun: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      /** Magical tradition: 'none' applies no restrictions. */
      tradition: new fields.StringField({ required: true, initial: 'none', choices: [...TRADITIONS] }),
      /** Shamanic totem: bonus (or penalty) dice by spell category and for conjuring. */
      totem: new fields.SchemaField({
        name: new fields.StringField({ required: true, initial: '' }),
        combat: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        detection: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        health: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        illusion: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        manipulation: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        conjuring: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        /** Environment tags (e.g. "forest, wilderness") and dice in and away from it. */
        environment: new fields.StringField({ required: true, initial: '' }),
        inEnvironment: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        outEnvironment: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        /** v0.56.0: spirit types or domains its conjuring dice help (tags; empty = every spirit). */
        spirits: new fields.StringField({ required: true, initial: '' }),
        /** v0.61.0: drawbacks by situation: berserk when wounded or in combat, a TN penalty by daylight (0 = none; '' = from the totem's name). */
        berserk: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'none', 'wounded', 'combat'] }),
        daylightTn: new fields.NumberField({ required: true, integer: true, min: -1, initial: -1 }),
      }),
      /** Elementalists: their element. */
      aspectElement: new fields.StringField({ required: true, initial: '' }),
      /** Spells anchored (metamagic) to be released later. */
      anchored: new fields.ArrayField(new fields.SchemaField({
        spellId: new fields.StringField({ required: true, initial: '' }),
        spellName: new fields.StringField({ required: true, initial: '' }),
        force: new fields.NumberField({ required: true, integer: true, min: 1, initial: 1 }),
        trigger: new fields.StringField({ required: true, initial: '' }),
        /** v0.72.0 (O21): the Good Karma it cost to anchor (MAGIC_V72.anchoring). */
        karma: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      })),
      /** Spell Pool dice held back as spell defense this Combat Turn. */
      spellDefense: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** Spells this actor is sustaining. */
      sustaining: new fields.ArrayField(new fields.SchemaField({
        spellName: new fields.StringField({ required: true, initial: '' }),
        force: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
        category: new fields.StringField({ required: true, initial: '' }),
        focusId: new fields.StringField({ required: true, initial: '' }),
        successes: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
        quickened: new fields.BooleanField({ required: true, initial: false }),
        /** An elemental sustaining it for the magician. */
        spiritUuid: new fields.StringField({ required: true, initial: '' }),
        /** World time when the elemental lets it drop (v0.39.0; -1 = no limit). */
        until: new fields.NumberField({ required: true, initial: -1 }),
        /** v0.49.0: who it was cast on (empty: the caster, or not recorded). */
        targetUuids: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
        /** v0.56.0: the effect it put on its targets (their powerEffects flag), '' = none. */
        effectId: new fields.StringField({ required: true, initial: '' }),
        /** v0.56.0: a permanent spell takes at this world time (-1 = not permanent). */
        permanentAt: new fields.NumberField({ required: true, initial: -1 }),
        /** v0.56.0: a permanent healing spell's boxes, put back if it's dropped before it takes. */
        healed: new fields.SchemaField({
          targetUuid: new fields.StringField({ required: true, initial: '' }),
          track: new fields.StringField({ required: true, initial: 'physical' }),
          boxes: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        }),
        /** v0.61.0: an exclusive spell (limits what else the caster may do). */
        exclusive: new fields.BooleanField({ required: true, initial: false }),
      })),
      /** Geasa: conditions that protect Magic; while one is not met, its Magic is lost. */
      geasa: new fields.ArrayField(new fields.SchemaField({
        text: new fields.StringField({ required: true, initial: '' }),
        magic: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
        met: new fields.BooleanField({ required: true, initial: true }),
        checkOnCast: new fields.BooleanField({ required: true, initial: true }),
      })),
      /** Initiate grade and the metamagic techniques learned. */
      initiateGrade: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      metamagic: new fields.SchemaField(Object.fromEntries(METAMAGIC.map((k) => [k, new fields.BooleanField({ required: true, initial: false })]))),
      /** Astral state for magicians: physical, perceiving (dual-natured) or projecting. */
      astral: new fields.StringField({ required: true, initial: 'physical', choices: [...ASTRAL_MODES] }),
      /** v0.56.0: projecting (or an unmaterialized spirit) and manifesting in the physical world. */
      manifesting: new fields.BooleanField({ required: true, initial: false }),
      /** v0.56.0: the skill a centering test rolls (Grimoire), '' = none. */
      centeringSkill: new fields.StringField({ required: true, initial: '' }),
      nuyen: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** NPC morale/competence rating. */
      professionalRating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** v0.44.0: an NPC's Threat Rating (dice added to its Combat Pool; RULES.STREET.threat). */
      threatRating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** v0.44.0: edges and flaws (Shadowrun Companion; RULES.STREET.qualities). */
      qualities: new fields.ArrayField(new fields.SchemaField({
        id: new fields.StringField({ required: true, initial: '' }),
        name: new fields.StringField({ required: true, initial: '' }),
        kind: new fields.StringField({ required: true, initial: 'edge', choices: ['edge', 'flaw'] }),
        points: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
        /** A skill or attribute name its TN modifier applies to ('' = none). */
        target: new fields.StringField({ required: true, initial: '' }),
        tn: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        notes: new fields.StringField({ required: true, initial: '' }),
      })),
      /** v0.44.0: reputation (Shadowrun Companion; RULES.STREET.reputation). */
      reputation: new fields.SchemaField({
        streetCred: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        notoriety: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        publicAwareness: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      /**
       * v0.58.0: Essence lost to removed cyberware (a hole new ware fills first; RULES.GEAR_V58.essenceHoles),
       * and training under way (house rule trainingTime 'timed'): what is raised, to what, and when it is done.
       */
      essenceHole: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      training: new fields.ArrayField(new fields.SchemaField({
        id: new fields.StringField({ required: true, initial: '' }),
        label: new fields.StringField({ required: true, initial: '' }),
        attribute: new fields.StringField({ required: true, initial: '' }),
        skillId: new fields.StringField({ required: true, initial: '' }),
        part: new fields.StringField({ required: true, initial: '' }),
        to: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        cost: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        startedAt: new fields.NumberField({ required: true, initial: 0 }),
        readyAt: new fields.NumberField({ required: true, initial: 0 }),
        days: new fields.NumberField({ required: true, min: 0, initial: 0 }),
        baseDays: new fields.NumberField({ required: true, min: 0, initial: 0 }),
        /** v0.73.0 (O42): who started it (the advancement log's Done line). */
        by: new fields.StringField({ required: true, initial: '' }),
        approvedBy: new fields.StringField({ required: true, initial: '' }),
      })),
      /** A grunt group (v0.32.0): how many identical grunts this sheet is, and how many are down. */
      grunts: new fields.SchemaField({
        size: new fields.NumberField({ required: true, integer: true, min: 1, max: RULES.GRUNTS.maxSize, initial: 1 }),
        down: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      /** Critter powers and weaknesses, free text. */
      powers: new fields.HTMLField({ required: true, initial: '' }),
      weaknesses: new fields.HTMLField({ required: true, initial: '' }),
      biography: new fields.HTMLField({ required: true, initial: '' }),
      notes: new fields.HTMLField({ required: true, initial: '' }),
    };
  }

  /** Whether metatypes apply (characters and NPCs; spirits override). */
  usesMetatype(): boolean {
    // v0.52.0: a generated critter (an animal) has no metatype: no racial modifiers or maximums.
    return !(this as any).parent?.flags?.sr2e?.critter;
  }

  /** The natural rating an attribute total starts from (spirits derive it from Force). */
  attributeBase(key: AttributeKey): number {
    const sys = this as any;
    // A shapeshifter in human form adds that form's adjustments (v0.39.0).
    const ss = sys.shapeshift;
    const shift = ss?.enabled && ss.form === 'human' ? Number(ss.human?.[key] ?? 0) : 0;
    return (sys.attributes[key].base as number) + shift;
  }

  /**
   * The Magic every derived value uses (pools, drain, power points, focus addiction), given the character's
   * Essence-, initiation-, geas- and bioware-adjusted rating. v0.81.0 (RB-1): spirits override it with their Force.
   */
  protected magicRating(computed: number): number {
    return computed;
  }

  /** Derived values: totals, Reaction, pools, wounds. Recomputed whenever data changes. */
  prepareDerivedData(): void {
    const sys = this as any;
    const augs = augmentationsOf((this as any).parent);
    // v0.72.0 (O11): health edges and flaws (Will to Live, Pain Tolerance, Toughness, Sensitive System).
    const qv = qualityVitals(sys.qualities ?? [], RULES.STREET.qualities.enabled);
    const ware: any[] = [...((this as any).parent?.items ?? [])].filter((i: any) => i.type === 'cyberware');
    // v0.58.0: an Essence hole left by removed cyberware stays lost (RULES.GEAR_V58.essenceHoles).
    const essence = RULES.GEAR_V58.essenceHoles.enabled && Number(sys.essenceHole ?? 0) > 0
      ? essenceWithHole(Math.max(0, sys.essence + (sys.essenceShift ?? 0)), totalEssenceLoss(augs), Number(sys.essenceHole))
      : currentEssence(Math.max(0, sys.essence + (sys.essenceShift ?? 0)), augs);
    const bio = bodyIndex(ware.map((i: any) => (i.system.bioware ? { ...i.system, bodyIndex: sensitiveBodyIndex(culturedBodyCost(i.system.bodyIndex ?? 0, Boolean(i.system.cultured), String(i.system.bioKind ?? ''), String(i.name ?? '')), qv) } : i.system)), { body: sys.attributes.body.base, essence });
    // Initiation raises Magic on top of the Essence-capped rating.
    // Unmet geasa take away the Magic they protect; bioware costs Magic by Body Index.
    const magic = this.magicRating(Math.max(0, initiateMagic(effectiveMagic(sys.magic, essence, sys.essence), sys.initiateGrade ?? 0) - geasaPenalty(sys.geasa ?? [])
      // v0.92.3 (RULES.GEAR_V923.awakenedBioware 'essence'): the bioware's Essence lowers Magic instead.
      - (sys.magic > 0 && !gearBook('awakenedBioware') ? bio.magicLoss : 0)
      // v0.92.3 (RULES.SPIRITS_V923.banishBackfire, Core p. 143): Magic lost to a spirit in banishing (back at 1 an hour).
      - Math.max(0, Number((this as any).parent?.flags?.sr2e?.banishMagic?.lost ?? 0) || 0)));
    // v0.56.0: adept powers past the power-point budget stop working when Magic drops (RULES.CRITTERS_V56.adeptBudget).
    const adeptAll = [...((this as any).parent?.items ?? [])].filter((i: any) => i.type === 'adeptpower');
    const budget = adeptBudget(adeptAll.map((i: any) => ({ id: i.id, cost: Number(i.system.cost ?? 0), active: i.system.active !== false })), magic * RULES.MAGIC.adeptPointsPerMagic);
    const overIds = RULES.CRITTERS_V56.adeptBudget === 'off' && sys.tradition === 'adept' ? new Set(budget.over) : new Set<string>();
    const adept = adeptAll.map((i: any) => ({ ...i.system, id: i.id, name: i.name, ...(overIds.has(i.id) ? { active: false } : {}) }));
    // Wired and boosted reflexes (and adept reflexes) don't stack (RULES.CYBERWARE.stacking).
    const stacked = stackAugmentations(augs, adeptAugmentations(adept));
    // v0.72.0 (O10): reflex systems that don't work together (RULES.HEALTH_V72.reflexes: reaction enhancers with boosted reflexes).
    { const incompat = incompatibleReflexes(stacked.cyber); stacked.cyber = incompat.cyber; stacked.notes.push(...incompat.notes); }
    // Drugs in effect add their bonuses too (v0.31.0).
    const drugAugs: Augmentation[] = drugsForBonuses(sys.drugs ?? []).map((d: any) => ({ essenceCost: 0, grade: 'standard', installed: true, attributes: d.attributes, reaction: d.reaction, initiativeDice: d.initiativeDice, name: d.name }));
    // Sustained critter and spirit powers, and (v0.56.0) sustained or permanent spells, changing this actor (actor flag powerEffects).
    const powerFx: any[] = [...(((this as any).parent?.flags?.sr2e?.powerEffects as any[] | undefined) ?? [])];
    // v0.61.0: drugs' effects beyond attributes (armor, TNs, movement, ignoring wounds or Stun boxes).
    const drugFx = combineDrugEffects(drugsForBonuses(sys.drugs ?? []).map((d: any) => d.extra ?? {}));
    const fxSum = sumBundles([...powerFx.map((p: any) => ({ attributes: p.attributes ?? {}, reaction: p.reaction ?? 0, initiativeDice: p.initiativeDice ?? 0, ballistic: p.ballistic ?? 0, impact: p.impact ?? 0, testsTn: p.testsTn ?? 0, perceivedTn: p.perceivedTn ?? 0, attackedTn: p.attackedTn ?? 0, movementFactor: p.movementFactor ?? 1 })), drugFx.bundle]);
    // v0.56.0: reflexes from spells don't stack with wired, boosted or adept reflexes (the better side counts).
    // Only the best spell's dice count; "other" reflexes are working exclusive reflex ware and adept reflexes.
    const reflexFx = powerFx.filter((p: any) => Number(p.initiativeDice ?? 0) > 0);
    const bestFx = reflexFx.reduce((b: any, p: any) => (!b || Number(p.initiativeDice) > Number(b.initiativeDice) ? p : b), null);
    const fxReflexes = bestFx ? Number(bestFx.initiativeDice) : 0;
    const exclusive = RULES.CYBERWARE.stacking.exclusive as readonly string[];
    const isOtherReflex = (a: any, adeptSide: boolean) => a.installed !== false && !a.damaged && (a.initiativeDice ?? 0) > 0 && (adeptSide || exclusive.includes(reflexTypeOf(a)));
    const otherReflexes = Math.max(0, ...stacked.cyber.filter((a) => isOtherReflex(a, false)).map((a) => a.initiativeDice ?? 0))
      + stacked.adept.filter((a) => isOtherReflex(a, true)).reduce((n: number, a: any) => n + (a.initiativeDice ?? 0), 0);
    const reflexNotes: string[] = [];
    let dropFxReflexes = false;
    if (reflexFx.length > 1) reflexNotes.push(tx('SR2E.App.Models.onlyTheBestReflexSpellCounts'));
    // v0.92.3 (RULES.SORCERY_V923.increaseReflexes 'book', Core p. 155): no spell boosts someone with cybernetic
    // initiative dice, whichever is better.
    const cyberReflexes = stacked.cyber.some((a: any) => a.installed !== false && !a.damaged && (a.initiativeDice ?? 0) > 0);
    if (RULES.SORCERY_V923.increaseReflexes === 'book' && fxReflexes > 0 && cyberReflexes) { dropFxReflexes = true; reflexNotes.push(tx('SR2E.App.Models.reflexSpellNoCyber')); }
    else if (RULES.MAGIC_V56.spellEffects.reflexesExclusive && fxReflexes > 0 && otherReflexes > 0) {
      if (otherReflexes >= fxReflexes) { dropFxReflexes = true; reflexNotes.push(tx('SR2E.App.Models.magicalReflexesDoNotStack')); }
      else {
        stacked.cyber = stacked.cyber.map((a) => (isOtherReflex(a, false) ? { ...a, initiativeDice: 0, reaction: 0 } : a));
        stacked.adept = stacked.adept.map((a) => (isOtherReflex(a, true) ? { ...a, initiativeDice: 0, reaction: 0 } : a));
        reflexNotes.push(tx('SR2E.App.Models.otherReflexEnhancementDoesNot'));
      }
    }
    // v0.61.0: Increase [Attribute] spells don't add to an attribute cyber- or bioware raises (MAGIC_V61.attributeSpells, on by default since v0.77.0).
    const cyberAttrs: Record<string, number> = sumBonuses(stacked.cyber.filter((a: any) => a.installed !== false && !a.damaged)).attributes as Record<string, number>;
    const powerAugs: Augmentation[] = powerFx.map((p: any) => {
      const reflex = Number(p.initiativeDice ?? 0) > 0;
      const counts = reflex && !dropFxReflexes && p === bestFx;
      const own = (p.kind ?? 'power') === 'spell' ? spellAttributesAfterCyber({ ...(p.attributes ?? {}) }, cyberAttrs) : { attributes: { ...(p.attributes ?? {}) }, dropped: [] as string[] };
      if (own.dropped.length) reflexNotes.push(tx('SR2E.App.Models.noEffectOnRaisedByCyberware', { name: p.name, dropped: own.dropped.join(', ') }));
      return { essenceCost: 0, grade: 'standard', installed: true, attributes: own.attributes, reaction: reflex && !counts ? 0 : Number(p.reaction ?? 0), initiativeDice: counts ? Number(p.initiativeDice ?? 0) : 0, name: p.name };
    });
    const bonus = sumBonuses([...stacked.cyber, ...stacked.adept, ...drugAugs, ...powerAugs]);
    // v0.92.3 (RULES.GEAR_V923.limbPairs 'body', Core p. 249): each pair of full cyberlimbs is a level of dermal armor (+1 Body).
    const wareLive = ware.filter((i: any) => i.system.installed && !i.system.damaged && !recoveringItemIds(sys.recovering ?? [], worldNow()).includes(i.id));
    bonus.attributes.body += limbPairsBody(wareLive.filter((i: any) => i.system.kind === 'cyberlimb' && !i.system.bioware).map((i: any) => ({ name: i.name, location: i.system.limb?.location ?? 'other' })));
    // Adept pain resistance ignores boxes for wound modifiers (v0.39.0).
    const painIgnore = adeptSpecialLevel(adept as any, 'painResistance') * RULES.ADEPT.painResistance.boxesPerLevel;
    const dualNatured = [...((this as any).parent?.items ?? [])].some((i: any) => i.type === 'power' && i.system?.special === 'dualNatured');
    // Damaged cyberware gives nothing until repaired.
    // Items still recovering from surgery (computed once; v0.81.0 RB-11).
    const healing = new Set(recoveringItemIds(sys.recovering ?? [], worldNow()));
    // v0.92.1 (RULES.SHEET_V921.tweaks): the custom tweaks on the items that count now (rules/tweaks.ts).
    const tw = sumTweaks([...((this as any).parent?.items ?? [])].map((i: any) => ({ id: i.id, name: i.name, type: i.type, system: i.system })), { recovering: healing, adeptOver: overIds });
    const installed = ware.filter((i: any) => i.system.installed && !i.system.damaged && !healing.has(i.id));
    const cyber = cyberDerived((this as any).parent, ware);
    // v0.92.1: skill tweaks count as the gear skill bonuses do (one source per tweak).
    if (tw.skillMods.length) cyber.skillMods = [...cyber.skillMods, ...tw.skillMods];
    const initDice = capInitiativeDice(Math.max(1, RULES.BASE_INITIATIVE_DICE + sys.initiativeDiceBonus + bonus.initiativeDice + tw.initiativeDice));
    const limbOver = cyber.limbs.filter((l: any) => l.capacity.over).map((l: any) => tx('SR2E.App.Models.capacityOfUsed', { name: l.name, used: l.capacity.used, capacity: l.capacity.capacity }));
    // Cyber armor (not bioware) for orthoskin's conflict with dermal plating.
    const cyberOnly = installed.filter((i: any) => !i.system.bioware);
    const bw = bioDerived(ware, {
      ballistic: Math.max(0, ...cyberOnly.map((i: any) => i.system.armorBallistic ?? 0)),
      impact: Math.max(0, ...cyberOnly.map((i: any) => i.system.armorImpact ?? 0)),
    }, healing);
    const dermalBody = gearBook('dermal');
    const lacingArmor = boneLacingBook(String(installed.filter((i: any) => i.system.kind === 'boneLacing').map((i: any) => String(i.system.lacing ?? '')).sort((a: string, b: string) => boneLacingBook(b).impact + boneLacingBook(b).ballistic - boneLacingBook(a).impact - boneLacingBook(a).ballistic)[0] ?? ''), cyberReplacements(installed.filter((i: any) => !i.system.bioware).map((i: any) => ({ name: i.name, kind: i.system.kind }))));
    const cyberWarnings = [...stacked.notes, ...reflexNotes, ...(initDice.capped ? [tx('SR2E.App.Models.initiativeDiceCappedAt', { dice: initDice.dice })] : []), ...limbOver, ...bw.warnings];

    const totals = {} as Attributes;
    const race = metatype(sys.metatype);
    const applyRace = sys.racialModifiers !== false && this.usesMetatype();
    for (const k of ATTRIBUTE_KEYS) {
      const a = sys.attributes[k];
      a.gear = bonus.attributes[k] + (tw.attributes[k] ?? 0);
      a.racial = applyRace ? racialModifier(sys.metatype, k) : 0;
      // v0.73.0 (O34): racial modifiers can't take an attribute below RULES.CHARACTERS_V73.racialFloor.min.
      a.rawNatural = this.attributeBase(k) + a.racial;
      a.natural = applyRace ? racialNatural(this.attributeBase(k), a.racial).natural : a.rawNatural;
      a.total = Math.max(0, a.natural + a.mod + a.gear);
      totals[k] = a.total;
    }
    // Racial maximums: warned on the sheet, or clamped (RULES.METATYPES.enforce).
    const limits = this.usesMetatype()
      // v0.73.0 (O38): Exceptional Attribute raises that racial maximum (RULES.CHARACTERS_V73.qualities).
      ? attributeLimitsWith(sys.metatype, Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, { natural: sys.attributes[k].natural, total: sys.attributes[k].total }])) as any, sys.qualities ?? [])
      : { warnings: [], capped: {} };
    for (const [k, v] of Object.entries(limits.capped)) {
      sys.attributes[k].total = v;
      (totals as any)[k] = v;
    }
    // A possessed body thinks with its possessor's mind (v0.45.0; actor flag possessedBy).
    const possessor = (this as any).parent?.flags?.sr2e?.possessedBy;
    if (possessor?.attributes) {
      const p = possessedAttributes(totals as any, possessor.attributes);
      for (const k of ATTRIBUTE_KEYS) if (p[k] !== totals[k]) { sys.attributes[k].total = p[k]; totals[k] = p[k]; }
    }
    // Armor encumbrance: worn armor heavier than Quickness slows the wearer.
    const worn = [...((this as any).parent?.items ?? [])].filter((i: any) => i.type === 'armor' && i.system.worn && isCarried(i));
    // v0.92.3 (RULES.GEAR_V923.armorEncumbrance 'book', Core p. 84): only heavy armor, and it costs Combat Pool dice (below).
    const heavyBook = gearBook('armorEncumbrance');
    const encumbrance = heavyBook ? 0 : U80C.cbtEncumbrance(encumbrancePenalty(
      worn.reduce((n: number, i: any) => n + (i.system.ballistic ?? 0), 0),
      worn.reduce((n: number, i: any) => n + (i.system.impact ?? 0), 0),
      totals.quickness,
    ));
    // Not on top of the Revamp's own pool rule (URR_V80.cbtArmorPool 'pool').
    const heavyPool = heavyBook && RULES.COMBAT.encumbrance.enabled && RULES.URR_V80.cbtArmorPool !== 'pool' ? heavyArmorPoolPenalty(worn.map((i: any) => ({ name: String(i.name ?? ''), ballistic: Math.max(0, Number(i.system.ballistic ?? 0) - Number(i.system.degraded ?? 0)), adds: Boolean(i.system.adds) })), totals.quickness) : 0;
    // v0.80.0 (URR_V80.cbtArmorPool 'pool', house rule for the Revamp, not in the URR): each point of ballistic armor above Quickness is a Combat Pool die less.
    // (The book's heavy-armor rule is heavyPool above, GEAR_V923.armorEncumbrance; never both.)
    // Review #6: the layered ballistic rating (the same pieces as armorRating), not the raw sum.
    const armorPool80 = U80C.cbtArmorPoolPenalty(RULES.URR_V80.cbtArmorPool === 'pool' ? armorTotal(worn.map((i: any) => ({ ballistic: i.system.ballistic ?? 0, impact: i.system.impact ?? 0, adds: Boolean(i.system.adds), degraded: i.system.degraded ?? 0 })), 'ballistic') : 0, totals.quickness);
    if (encumbrance > 0) {
      sys.attributes.quickness.total = Math.max(0, sys.attributes.quickness.total - encumbrance);
      totals.quickness = sys.attributes.quickness.total;
    }
    // Carried weight (v0.37.0): over Strength × 10 kg slows the carrier (worn armor counts too).
    // v0.92.1 (RULES.SHEET_V921.carried): what is left behind weighs nothing.
    const carried0 = [...((this as any).parent?.items ?? [])].filter((i: any) => isCarried(i)).reduce((n: number, i: any) => n + Math.max(0, Number(i.system?.weight ?? 0)) * Math.max(0, Number(i.system?.quantity ?? 1)), 0);
    // v0.58.0: bone lacing is carried too.
    const carried = carried0 + Number(cyber.lacing.weight ?? 0);
    // v0.92.3 (RULES.GEAR_V923.load 'book', Core p. 185): Strength × 5 kg free, then fatigue as a Stun wound.
    const load = gearBook('load') ? (RULES.COMBAT.load.enabled ? bookLoad(carried, totals.strength) : { ...bookLoad(0, totals.strength), kg: bookLoad(carried, totals.strength).kg }) : carriedLoad(carried, totals.strength);
    if (load.penalty > 0) {
      sys.attributes.quickness.total = Math.max(0, sys.attributes.quickness.total - load.penalty);
      totals.quickness = sys.attributes.quickness.total;
    }

    const senses = improvedSenses(adept as any);
    // v0.54.0: physical adepts get no Spell Pool (RULES.ADEPT.spellPool).
    const poolMagic = sys.tradition === 'adept' && !RULES.ADEPT.spellPool ? 0 : magic;
    // v0.92.3 (RULES.GEAR_V923.bioware 'book', Shadowtech p. 19): an adrenal pump's Quickness doesn't raise Reaction.
    const qNoReact = Math.max(0, Math.min(totals.quickness, Number(bw.quicknessNoReaction ?? 0)));
    const reactOff = qNoReact ? Math.floor((totals.quickness + totals.intelligence) / 2) - Math.floor((totals.quickness - qNoReact + totals.intelligence) / 2) : 0;
    const d0 = deriveStats(totals, { magic: poolMagic, reactionBonus: sys.reactionBonus + bonus.reaction + tw.reaction - reactOff });
    // v0.92.1 review (B3): a negative tweak never takes Reaction below 0.
    if (tw.reaction < 0) d0.reaction = Math.max(0, d0.reaction);
    // v0.79.0 (RULES.DOCS_V79.magicPool.size 'sorcery', SR2 p85): the Spell (Magic) Pool is the Sorcery rating (a power
    // focus still adds below, as v0.78.0); 'attributes': (Int + Wil + Magic) / 3 as before.
    // An adept's Spell Pool exists only as a house rule (RULES.ADEPT.spellPool); adepts rarely have Sorcery, so that
    // house rule keeps the attribute formula.
    const adeptPool = sys.tradition === 'adept' && RULES.ADEPT.spellPool;
    const d = { ...d0, spellPool: adeptPool ? d0.spellPool : magicPoolBase({ sorcery: sorceryRating((this as any).parent?.items), intelligence: totals.intelligence, willpower: totals.willpower, magic: poolMagic }) };
    // An NPC's Threat Rating adds Combat Pool dice (v0.44.0).
    // v0.92.3 (RULES.CORE_V923.threat 'book', Core p. 187): Threat dice go on every test instead, and replace the pools.
    const threatNpc = (this as any).parent?.type === 'npc' && Math.max(0, Math.floor(sys.threatRating ?? 0)) > 0;
    const threat = !threatBook() && (this as any).parent?.type === 'npc' && RULES.STREET.threat.addsToPool ? Math.max(0, Math.floor(sys.threatRating ?? 0)) : 0;
    const noPools = threatBook() && threatNpc;
    // v0.92.3 (RULES.HEALTH_V923.death 'natural', Core p. 111): the natural Body counts for death, not cyber or magic.
    const deathBodyNow = deathBody(totals.body, sys.attributes?.body?.natural);
    const bodyStatus = monitorStatus(sys.monitor, overflowBody(deathBodyNow, qv)) as Status;
    // v0.81.0 (RB-11): shared values, computed once so the paired derived fields stay in step.
    const foci = fociOf((this as any).parent, String(sys.tradition ?? ''));
    // v0.78.0 (RULES.BOOK_V78.powerFocus 'magic'): a power focus adds its rating to the Spell Pool and to the Magic for drain.
    const powerFocus = poolMagic > 0 ? powerFocusRating(foci) : 0;
    // v0.78.0 (RULES.BOOK_V78.combatSense 'pool', Core Rules): an adept's Combat Sense adds its level to the Combat Pool.
    // v0.92.3 (RULES.SPIRITS_V923.astralPool 'book', Core p. 147; Grimoire p. 91): a projecting magician's only pool is the
    // Astral Combat Pool, (Intelligence + Willpower + Charisma) ÷ 2 + grade; it takes the Combat Pool's place while projecting.
    const astralPool923 = magic > 0 && sys.tradition !== 'adept' ? astralCombatPool({ intelligence: totals.intelligence, willpower: totals.willpower, charisma: totals.charisma, grade: Number(sys.initiateGrade ?? 0) }) : 0;
    const projecting923 = RULES.SPIRITS_V923.astralPool === 'book' && astralPool923 > 0 && (sys.astral ?? 'physical') === 'projecting';
    const combatPool = projecting923 ? astralPool923 : noPools ? 0 : Math.max(0, Math.max(0, d.combatPool - armorPool80 - heavyPool) + threat + (RULES.BOOK_V78.combatSense === 'pool' ? adeptSpecialLevel(adept as any, 'combatSense') * RULES.ADEPT.combatSense.dicePerLevel : 0) + (tw.pools.combat ?? 0));
    // v0.92.1 review (N10): a Spell Pool tweak only for someone with a Spell Pool.
    const spellPool = Math.max(0, d.spellPool + powerFocus + (poolMagic > 0 ? (tw.pools.spell ?? 0) : 0));
    sys.derived = {
      // v0.72.0: health edges and flaws, and Shadowtech bioware vitals (rules/vitals.ts).
      vitals: { ...qv, overflowBody: overflowBody(deathBodyNow, qv) },
      reaction: d.reaction,
      initiativeDice: initDice.dice,
      combatPool,
      spellPool,
      drainMagic: magic + powerFocus,
      combatPoolLeft: Math.max(0, combatPool - sys.poolSpent.combat),
      // v0.78.0: an encephalon's Task Pool (Shadowtech; RULES.BOOK_V78.encephalon) for the skills it helps.
      // v0.92.3: a cerebral booster 2's Task Pool die adds (RULES.GEAR_V923.bioware 'book', Shadowtech p. 23).
      taskPool: Math.max(0, encephalonTaskPool(Number(cyber.encephalon ?? 0)) + Number(bw.taskPool ?? 0) + (tw.pools.task ?? 0)),
      taskPoolLeft: Math.max(0, encephalonTaskPool(Number(cyber.encephalon ?? 0)) + Number(bw.taskPool ?? 0) + (tw.pools.task ?? 0) - Number(sys.poolSpent.task ?? 0)),
      // v0.44.0: walking and running rates, and Street Cred.
      // v0.56.0: a Movement power (or spell) multiplies or divides it.
      // v0.92.3 (RULES.GEAR_V923.load 'book', Core p. 185): a heavy load halves or quarters movement and stops running.
      movement: ((m, l: any) => ('move' in l ? { walk: Math.floor(m.walk * l.move), run: l.run ? Math.floor(m.run * l.move) : Math.floor(m.walk * l.move) } : m))(movementWithFactor(movementRates(totals.quickness, this.usesMetatype() ? race.run : RULES.COMBAT.movement.run), fxSum.movementFactor), load),
      // v0.58.0: Notoriety comes off it (RULES.CHARACTERS_V58.notoriety).
      streetCred: streetCred({ career: sys.karma?.career ?? 0, manual: sys.reputation?.streetCred ?? 0, notoriety: sys.reputation?.notoriety ?? 0 }),
      spellPoolLeft: Math.max(0, spellPool - sys.poolSpent.spell - (sys.spellDefense ?? 0)),
      // v0.92.0 (RULES.MAGIC_V920.poolLayers): the Spell Pool's narrow layers (Sorcery's concentration and
      // specialization; rules/magicpool.ts), for a Sorcery-sized pool only.
      spellLayers: (() => {
        const sk: any = poolMagic > 0 && !adeptPool && RULES.DOCS_V79.magicPool.size === 'sorcery' ? sorcerySkillOf((this as any).parent?.items) : null;
        const l = poolLayers(sk?.system ?? null);
        const left = narrowLeft(l, { conc: sys.poolSpent.spellConc, spec: sys.poolSpent.spellSpec });
        return { ...l, concLeft: left.conc, specLeft: left.spec };
      })(),
      karmaPoolLeft: Math.max(0, (sys.karma?.pool ?? 0) - (sys.karma?.poolSpent ?? 0)),
      // Damage compensators ignore the first boxes on each track (v0.30.0).
      // v0.72.0 (O20): 'neither' (MAGIC_V72.astralWounds): a projecting magician's wounds count on nothing (strip, tests, Initiative agree).
      woundModifier: drugFx.ignoreWounds || ((sys.astral ?? 'physical') === 'projecting' && magic > 0 && sys.tradition !== 'adept' && !astralWoundRules().tests) ? 0 : woundModifier(compensatedMonitor(painToleranceMonitor((() => { const m = painEditedMonitor(sys.monitor, bw.ignoreStunWounds); return { ...m, stun: Math.max(loadStunBoxes(load), Math.max(0, m.stun - drugFx.stunIgnoreBoxes)) }; })(), qv), bw.ignoreBoxes + painIgnore)),
      possessedBy: possessor?.name ? String(possessor.name) : '',
      powerEffects: powerFx.map((p: any) => ({ id: p.id, name: p.name, fromName: p.fromName, fromUuid: p.fromUuid, attributes: p.attributes, kind: p.kind ?? 'power', permanent: Boolean(p.permanent), summary: describeBundle(p) })),
      // v0.56.0: armor and TN changes from spells and powers on this actor (EffectBundle sums).
      effectArmor: { ballistic: fxSum.ballistic, impact: fxSum.impact },
      effectMods: { testsTn: fxSum.testsTn, perceivedTn: fxSum.perceivedTn, attackedTn: fxSum.attackedTn, movementFactor: fxSum.movementFactor },
      adeptOver: budget.over.filter((id) => overIds.has(id) || (RULES.CRITTERS_V56.adeptBudget === 'warn' && sys.tradition === 'adept')).map((id) => ({ id, name: adeptAll.find((i: any) => i.id === id)?.name ?? '' })),
      adeptOverOff: overIds.size > 0,
      bio: bw,
      // Essence reaching zero is fatal whatever the condition monitor says.
      // v0.92.3 (RULES.GEAR_V923.essenceZero 'survive', Core p. 246): only Essence below 0 kills.
      status: (essenceKills(round2(Math.max(0, sys.essence + (sys.essenceShift ?? 0)) - totalEssenceLoss(augs) - (RULES.GEAR_V58.essenceHoles.enabled ? Math.max(0, Number(sys.essenceHole ?? 0)) : 0))) ? 'dead' : bodyStatus) as Status,
      // v0.82.0: shown on the sheet (dying line, Karma tooltip) so the text follows the rules in force.
      bleedEvery: bleedEveryText(Number(sys.attributes?.body?.total ?? sys.attributes?.body?.value ?? 1)),
      karmaPoolEvery: Number((RULES.UPKEEP.karma.poolEvery as any)?.[String(sys.metatype ?? 'human') === 'human' ? 'human' : 'metahuman'] ?? 10),
      // v0.82.0 (review V5): the Karma tooltip's rule, also under the Revamp's per-award growth.
      karmaPoolText: (RULES as any).URR_V80?.coreKarmaGrowth === 'perAward'
        ? tCount(Math.max(1, Number((RULES as any).URR_V80?.coreAwardPool) || 1), 'SR2E.App.Models.eachKarmaAwardPutsItsFirst')
        : tx('SR2E.App.Models.everyPutsAPointInThe', { every: Number((RULES.UPKEEP.karma.poolEvery as any)?.[String(sys.metatype ?? 'human') === 'human' ? 'human' : 'metahuman'] ?? 10) }),
      essence,
      essenceLoss: totalEssenceLoss(augs),
      essenceHole: RULES.GEAR_V58.essenceHoles.enabled ? Math.max(0, Number(sys.essenceHole ?? 0)) : 0,
      magic,
      // Astral state only matters for magicians; anyone else stays physical.
      // Dual-natured critters (a Power with Special "dual-natured", v0.39.0) are always perceiving.
      // Adepts perceive only with the astral perception power, and never project (v0.39.0).
      astralMode: dualNatured ? 'perceiving' : magic <= 0 ? 'physical'
        : sys.tradition === 'adept' ? (adeptSpecialLevel(adept as any, 'astralPerception') > 0 && sys.astral !== 'physical' ? 'perceiving' : 'physical')
        // v0.80.0 (RULES.URR_V80.magAspectedNoAstral, URR): aspected sorcerers and conjurers stay physical.
        : urrMagAstralModeFor(String(sys.tradition ?? ''), sys.astral ?? 'physical'),
      dualNatured,
      painIgnore,
      astral: astralForm(totals, magic > 0 && sys.tradition !== 'adept' ? Number(sys.initiateGrade ?? 0) : 0),
      astralPool: astralPool923,
      adeptPoints: adeptPowerPoints(adept, magic),
      geasaPenalty: geasaPenalty(sys.geasa ?? []),
      focusAddiction: focusAddiction(foci, magic),
      bodyIndex: bio,
      encumbrance,
      load,
      metatype: this.usesMetatype() ? race.label : '',
      attributeWarnings: [...limits.warnings, ...racialFloorWarnings(sys.metatype, Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, this.attributeBase(k)])) as any, applyRace)],
      reachBonus: this.usesMetatype() ? race.reach : 0,
      // Dwarves, toxin extractors; Body Index takes some off.
      // v0.92.3 (RULES.HEALTH_V923.dwarfResistance 'disease', Core Racial Modifications Table): the racial dice count
      // against disease only (raceDiseaseDice); 'both' puts them back on toxins.
      toxinDice: (this.usesMetatype() && dwarfDiceAgainst('toxin') ? race.toxinDice : 0) + bw.toxinDice - bodyIndexToxinPenalty(bio_index_used(ware)),
      raceDiseaseDice: this.usesMetatype() && !dwarfDiceAgainst('toxin') ? Math.max(0, Number(race.toxinDice) || 0) : 0,
      // v0.92.3 (RULES.CORE_V923.trollDermal 'body', Core p. 45): dermal armor as extra Body dice for damage resistance.
      racialDermal: this.usesMetatype() ? race.dermal : 0,
      // Token bars (v0.36.0): boxes left on each track.
      // v0.60.0: and the Matrix condition monitor (a persona's boxes left).
      bars: { ...monitorBars(sys.monitor), matrix: trackBar(sys.matrix?.monitor ?? 0, RULES.MATRIX.monitorBoxes) ?? { value: 0, max: 0 } },
      vision: {
        // v0.56.0: an adept's improved senses count too.
        // v0.58.0: and worn vision gear.
        lowLight: Boolean(sys.vision?.lowLight) || installed.some((i: any) => i.system.lowLight) || (this.usesMetatype() && Boolean(race.vision.lowLight)) || senses.lowLight || cyber.optics.lowLight,
        thermographic: Boolean(sys.vision?.thermographic) || installed.some((i: any) => i.system.thermographic) || (this.usesMetatype() && Boolean(race.vision.thermographic)) || senses.thermographic || cyber.optics.thermographic,
        ultrasound: cyber.ultrasound || senses.ultrasound,
        // v0.79.0: natural eyes use the Visibility Table's natural column (RULES.DOCS_V79.visionCyberNatural).
        lowLightNatural: Boolean(sys.vision?.lowLight) || installed.some((i: any) => i.system.bioware && i.system.lowLight) || (this.usesMetatype() && Boolean(race.vision.lowLight)) || senses.lowLight,
        thermographicNatural: Boolean(sys.vision?.thermographic) || installed.some((i: any) => i.system.bioware && i.system.thermographic) || (this.usesMetatype() && Boolean(race.vision.thermographic)) || senses.thermographic,
        ...(senses.hearing ? { hearing: true } : {}),
      },
      smartlink: cyber.smartlinkLevel > 0,
      cyber,
      cyberWarnings,
      // v0.92.1: the custom tweaks (the sheet's list; attack Power per weapon and for every melee or ranged attack).
      tweaks: { list: tw.list, damage: tw.damage, weaponSelf: tw.weaponSelf },
      // Cyberware armor, plus a troll's natural dermal armor.
      cyberArmor: {
        // Cyberlimbs' own armor is added per hit (armorRating, v0.43.0).
        // v0.92.3 (RULES.GEAR_V923.dermal 'body'): dermal plating is Body, not armor; (boneLacing 'book') lacing's armor adds.
        ballistic: installed.filter((i: any) => i.system.kind !== 'cyberlimb' && !(dermalBody && isDermalPlating({ name: i.name, bioware: i.system.bioware, kind: i.system.kind }))).reduce((n: number, i: any) => n + (i.system.armorBallistic ?? 0), 0) + (this.usesMetatype() ? dermalArmor(race.dermal) : 0) + bw.ballistic + tw.armor.ballistic + lacingArmor.ballistic,
        impact: installed.filter((i: any) => i.system.kind !== 'cyberlimb' && !(dermalBody && isDermalPlating({ name: i.name, bioware: i.system.bioware, kind: i.system.kind }))).reduce((n: number, i: any) => n + (i.system.armorImpact ?? 0), 0) + (this.usesMetatype() ? dermalArmor(race.dermal) : 0) + bw.impact + tw.armor.impact + lacingArmor.impact,
      },
    };
    // v0.92.3: the decker's own Reaction (no cyber or magic Reaction boosts) for the persona (VR2 p. 120).
    Object.assign(sys.derived, deckerDerived((this as any).parent, sys, totals.intelligence, totals as unknown as Record<string, number>, tw.pools.hacking ?? 0, d.reaction - bonus.reaction));
    Object.assign(sys.derived, riggerDerived(sys, installed, d.reaction, bonus, [...((this as any).parent?.items ?? [])], tw.pools.control ?? 0));
  }
}

/** Rigger values: control rig, rigged Reaction and initiative, Control Pool, the vehicle driven. */
function riggerDerived(sys: any, installed: any[], reaction: number, bonus: { reaction: number; initiativeDice: number }, items: any[] = [], tweakPool = 0) {
  const vcr = controlRigRating(installed.map((i: any) => i.system));
  const rcd = items.filter((i: any) => i.type === 'gear' && isCarried(i)).reduce((n: number, i: any) => Math.max(n, Math.floor(i.system?.rcdRating ?? 0)), 0);
  const subscribed: string[] = [...(sys.rigging?.subscribed ?? [])];
  const rigged = riggedStats({ reaction, cyberReaction: bonus.reaction, cyberDice: bonus.initiativeDice + (sys.initiativeDiceBonus ?? 0), vcr });
  const vehicleUuid = String(sys.rigging?.vehicleUuid ?? '');
  const jumpedIn = Boolean(sys.rigging?.jumpedIn) && vehicleUuid !== '';
  // v0.92.1: a Control Pool tweak.
  const pool = Math.max(0, controlPool({ reaction, riggedReaction: rigged.reaction, vcr }) + tweakPool);
  const usable = !RULES.RIGGING.controlPool.onlyJumpedIn || jumpedIn;
  return {
    controlPool: pool,
    controlPoolLeft: usable ? Math.max(0, pool - (sys.poolSpent?.control ?? 0)) : 0,
    rigging: vcr > 0 || vehicleUuid || rcd > 0 ? {
      vcr, reaction: rigged.reaction, initiativeDice: rigged.initiativeDice, jumpedIn, vehicleUuid,
      rcd, rcdCapacity: rcdCapacity(rcd), subscribed,
    } : null,
  };
}

/** The cyberdeck an actor is using (the first one marked in use), or null. */
export function activeDeckOf(actor: any): any | null {
  return [...(actor?.items ?? [])].find((i: any) => i.type === 'cyberdeck' && i.system.active) ?? null;
}

/** Decker values: Hacking Pool, Matrix Reaction/initiative, persona and Detection Factor (none without a deck). */
function deckerDerived(actor: any, sys: any, intelligence: number, totals: Record<string, number> = {}, tweakPool = 0, ownReaction: number = sys.derived?.reaction ?? 0) {
  const item = activeDeckOf(actor);
  const spent = sys.poolSpent?.hacking ?? 0;
  if (!item) return { hackingPool: 0, hackingPoolLeft: 0, matrix: null };
  // v0.46.0: an otaku's living persona takes its ratings from their attributes; a tortoise has no ASIST.
  const living = Boolean(item.system.living) && RULES.MATRIX.otaku.enabled;
  const tortoise = Boolean(item.system.tortoise) && !living;
  // v0.92.3: the book's otaku values (VR2 p. 145; RULES.MATRIX_V923.otaku).
  const base = living ? { ...item.system, ...otakuPersona({ intelligence, ...totals }), ...(otakuPersona923({ intelligence, ...totals }) ?? {}) } : item.system;
  // Damage to the deck (blaster, ripper, trace and burn) and crippler IC lower the working persona.
  const d = effectivePersona(base, base.damage ?? {}, sys.matrix?.crippled ?? {});
  const programs = [...(actor?.items ?? [])].filter((i: any) => i.type === 'program').map((i: any) => ({ id: i.id, name: i.name, ...i.system }));
  // v0.57.0: a utility still loading takes memory but does nothing yet.
  const ready = programs.map((p: any) => ({ ...p, loaded: Boolean(p.loaded) && programIsReady(p) }));
  const sleaze = loadedUtility(ready, 'sleaze');
  // v0.57.0: a reality filter's result in the host the decker is in.
  const fl = sys.matrix?.filter;
  const inFilterHost = Boolean(item.system.realityFilter) && Boolean(fl?.hostUuid) && fl.hostUuid === (sys.matrix?.hostUuid ?? '');
  const filter = realityFilterEffect(inFilterHost && Number(fl.ok) >= 0 ? Number(fl.ok) === 1 : null);
  const fullPool = hackingPool(intelligence, d.mpcp) + filter.pool;
  // v0.92.1: a Hacking Pool tweak counts while a deck is in use.
  const pool = Math.max(0, (tortoise ? tortoisePool(fullPool) : fullPool) + tweakPool);
  const sim = tortoise && RULES.MATRIX.tortoise.coldOnly ? 'cold' : (sys.matrix?.sim ?? 'cold');
  const files = [...(base.files ?? [])];
  const storageUsed = files.reduce((s: number, f: any) => s + Math.max(0, f.size ?? 0), 0);
  // v0.71.0 (R7): loaded programs above the working (damaged) MPCP, and persona values the MPCP lowered.
  const overMpcp = programsOverMpcp(programs, d.mpcp);
  const capsOn = mpcpCapsOn();
  // v0.71.0 (R7): a utility's working rating (capped at the working MPCP with mpcpCaps 'cap').
  const run = (rating: number | undefined) => programRunRating(Number(rating ?? 0), d.mpcp).rating;
  const rawPersona = (k: string) => Math.max(0, (base[k] ?? 0) - ((base.damage ?? {})[k] ?? 0) - ((sys.matrix?.crippled ?? {})[k] ?? 0));
  const mpcpWarnings = [
    // With 'warn', only what MPCP damage pushed over (personaWarnings already covers the base deck).
    ...PERSONA_ATTRIBUTES.filter((k) => rawPersona(k) > d.mpcp && (capsOn || d.mpcp < (base.mpcp ?? 0)))
      .map((k) => (capsOn ? tx('SR2E.App.Models.runsAtTheWorkingMpcp', { attribute: k.charAt(0).toUpperCase() + k.slice(1), value: rawPersona(k), mpcp: d.mpcp }) : tx('SR2E.App.Models.isAboveTheWorkingMpcp', { attribute: k.charAt(0).toUpperCase() + k.slice(1), value: rawPersona(k), mpcp: d.mpcp }))),
    ...mpcpProgramWarnings(overMpcp, d.mpcp),
  ];
  // v0.92.3 (RULES.MATRIX_V923.initiative): the book's persona speed; null keeps the v0.92.2 formulas below.
  const speed = personaSpeed({ reaction: ownReaction, responseIncrease: d.responseIncrease, mpcp: d.mpcp, sim, tortoise, otaku: living ? { intelligence, willpower: Number(totals.willpower ?? 0) } : null });
  // A satellite uplink's signal lag: −2 Reaction (VR2 p. 30; RULES.MATRIX_V923.connections).
  const lag = RULES.MATRIX_V923.connections !== 'v922' ? jackpointMods(sys.matrix?.connection ?? 'jackpoint').reaction : 0;
  return {
    hackingPool: pool,
    hackingPoolLeft: Math.max(0, pool - spent),
    matrix: {
      deckId: item.id,
      deckName: item.name,
      // A tortoise works at meat speed: the user's own Reaction and initiative dice.
      reaction: Math.max(0, (speed ? speed.reaction + (tortoise ? 0 : filter.reaction) : tortoise ? (sys.derived?.reaction ?? 0) : matrixReaction(intelligence, d.responseIncrease) + filter.reaction) + lag),
      filterModifiers: filter.modifiers,
      initiativeDice: speed ? speed.dice + (living && RULES.MATRIX_V923.otaku === 'v922' ? RULES.MATRIX.otaku.initiativeDice : 0) : tortoise ? (sys.derived?.initiativeDice ?? 1)
        : matrixInitiativeDice(d.responseIncrease) + simInitiativeDice(sim) + (living ? RULES.MATRIX.otaku.initiativeDice : 0),
      sim,
      tortoise, living, signal: Number(item.system.signal ?? 0),
      connection: sys.matrix?.connection ?? 'jackpoint',
      mpcp: d.mpcp, bod: d.bod, evasion: d.evasion, masking: d.masking, sensors: d.sensors, hardening: d.hardening,
      base: { mpcp: base.mpcp, bod: base.bod, evasion: base.evasion, masking: base.masking, sensors: base.sensors },
      damaged: d.damaged,
      deckDamage: { mpcp: 0, bod: 0, evasion: 0, masking: 0, sensors: 0, ...(base.damage ?? {}) },
      sleaze: run(sleaze?.rating),
      detectionFactor: detectionFactor(d.masking, run(sleaze?.rating)),
      // v0.71.0 (R7): the base deck's limits, plus what the working MPCP caps (or, with 'warn', exceeds).
      warnings: [...personaWarnings(base), ...mpcpWarnings],
      effectiveMpcp: d.mpcp,
      mpcpCaps: capsOn,
      overMpcp,
      cappedPersona: [...(d.capped ?? [])],
      memory: memoryUse(programs, d.activeMemory),
      activeMemory: d.activeMemory,
      ioSpeed: base.ioSpeed ?? 0,
      storage: { used: storageUsed, max: base.storageMemory ?? 0, over: storageUsed > (base.storageMemory ?? 0) },
      crashed: matrixCrashed(sys.matrix?.monitor ?? 0),
      jackedIn: Boolean(sys.matrix?.jackedIn),
      trace: sys.matrix?.trace?.active ? { ...sys.matrix.trace } : null,
      // v0.40.0: defensive utilities loaded, and psychotropic effects in force.
      armor: run(loadedUtility(ready, 'armor')?.rating),
      shield: run(loadedUtility(ready, 'shield')?.rating),
      mirrors: run(loadedUtility(ready, 'mirrors')?.rating),
      loading: programs.filter((p: any) => p.loaded && !programIsReady(p)).map((p: any) => p.id as string),
      psyche: activePsyche(sys.matrix?.psyche ?? [], worldNow()),
    },
  };
}

/**
 * Spirits and elementals: a character whose attributes are its Force plus a per-attribute
 * adjustment (set the adjustments once for a spirit type and every Force works). Tracks the
 * services it owes and who summoned it.
 */
export class SpiritDataModel extends CharacterDataModel {
  static override defineSchema() {
    const fields = f();
    const offset = () => new fields.NumberField({ required: true, integer: true, initial: 0 });
    return {
      ...super.defineSchema(),
      // Spirits have no Karma Pool by default.
      karma: new fields.SchemaField({
        good: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        pool: new fields.NumberField({ required: true, integer: true, min: 0, max: SANE_MAX, initial: 0 }),
        poolSpent: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      force: new fields.NumberField({ required: true, integer: true, min: 0, initial: 4 }),
      spiritKind: new fields.StringField({ required: true, initial: 'nature', choices: [...SPIRIT_KINDS] }),
      /** e.g. "Forest spirit", "Fire elemental". */
      spiritType: new fields.StringField({ required: true, initial: '' }),
      services: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** UUID of the actor who summoned it; empty for a template or a wild spirit. */
      summonerUuid: new fields.StringField({ required: true, initial: '' }),
      immuneNormalWeapons: new fields.BooleanField({ required: true, initial: true }),
      /** Free spirits: spirit energy (adds to banishing resistance) and their true name. */
      spiritEnergy: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** v0.61.0: an insect spirit's host body (actor UUID; '' = true form). */
      hostUuid: new fields.StringField({ required: true, initial: '' }),
      trueName: new fields.StringField({ required: true, initial: '' }),
      /** A materialized spirit has a physical presence; otherwise only astral attacks reach it. */
      materialized: new fields.BooleanField({ required: true, initial: true }),
      /** Elementals: their element (fire, water, air, earth...). Nature spirits: their domain. */
      element: new fields.StringField({ required: true, initial: '' }),
      domain: new fields.StringField({ required: true, initial: '' }),
      /** Attribute = Force + offset. */
      offsets: new fields.SchemaField(Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, offset()]))),
      /** v0.45.0: invoked into a great form (RULES.OCCULT.metamagic.invoking). */
      greatForm: new fields.BooleanField({ required: true, initial: false }),
      /** v0.56.0: a nature spirit leaves at this world time (next sunrise or sunset); -1 = no limit. */
      departsAt: new fields.NumberField({ required: true, initial: -1 }),
    };
  }

  override attributeBase(key: AttributeKey): number {
    const sys = this as any;
    return spiritAttribute(sys.force, sys.offsets?.[key] ?? 0) + (sys.greatForm ? RULES.OCCULT.metamagic.invoking.attributeBonus : 0);
  }

  override usesMetatype(): boolean {
    return false;
  }

  /** v0.81.0 (RB-1): a spirit's Magic is its Force, so its Spell Pool, drain Magic and the rest follow it. */
  protected override magicRating(_computed: number): number {
    return Math.max(0, Number((this as any).force ?? 0) || 0);
  }

  override prepareDerivedData(): void {
    super.prepareDerivedData();
    const sys = this as any;
    // Spirits have no Essence loss or Karma Pool; their Force stands in for Essence and Magic.
    sys.derived.essence = sys.force;
    sys.derived.magic = sys.force;
    sys.derived.essenceLoss = 0;
    // v0.61.0: spirit initiative (MAGIC_V61.spiritInitiative): the kind's bonus unless the spirit's own
    // Adjustments set one (already in Reaction); an unmaterialized spirit acts at astral speed instead.
    // It goes on the initiative only (derived.initiativeBonus), not on Reaction used for surprise or defaulting.
    const own = Number(sys.reactionBonus ?? 0) || 0;
    const si = spiritInitiative({ kind: String(sys.spiritKind ?? ''), reaction: Number(sys.derived.reaction ?? 0) - own, materialized: sys.materialized !== false,
      template: { reactionBonus: own, initiativeDiceBonus: Number(sys.initiativeDiceBonus ?? 0) } });
    const astralBonus = Number(RULES.MAGIC_V61.spiritInitiative.astralBonus ?? 0) || 0;
    const kindBonus = si.astral ? si.reactionBonus - astralBonus : si.reactionBonus;
    // v0.77.0 review fix: astralBonus is added on top of the kind's bonus (manifest +10, astral +20 in all).
    const initBonus = si.astral ? Math.max(0, si.reactionBonus - own) : kindBonus - own;
    const extraD = si.diceBonus - (Number(sys.initiativeDiceBonus ?? 0) || 0);
    if (extraD) sys.derived.initiativeDice = capInitiativeDice(Number(sys.derived.initiativeDice ?? 1) + extraD).dice;
    sys.derived.initiativeBonus = initBonus;
    sys.derived.spiritInitiative = si.astral ? tx('SR2E.App.Models.reactionAstralD6', { reaction: Number(sys.derived.reaction ?? 0), bonus: initBonus ? ` ${initBonus > 0 ? '+' : ''}${initBonus}` : '', dice: sys.derived.initiativeDice }) : tx('SR2E.App.Models.reactionD6', { reaction: Number(sys.derived.reaction ?? 0), bonus: initBonus ? ` ${initBonus > 0 ? '+' : ''}${initBonus}` : '', dice: sys.derived.initiativeDice });
    // Spirits are astral natives: their astral form is their own body.
    const t = sys.attributes;
    sys.derived.astralMode = 'physical';
    sys.derived.astral = {
      body: t.body.total, quickness: t.quickness.total, strength: t.strength.total,
      reaction: sys.derived.reaction, initiativeBase: sys.derived.reaction + (Number(sys.derived.initiativeBonus ?? 0) || 0), initiativeDice: sys.derived.initiativeDice,
    };
    if (sys.force <= 0) sys.derived.status = 'banished';
    // v0.59.0: a spirit is disrupted, not dying or unconscious (RULES.SPIRITS_V59).
    else sys.derived.status = spiritStatus(sys.monitor ?? { physical: 0, stun: 0 }, String(sys.derived.status ?? 'ok'));
  }
}

export class SkillDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    return {
      rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      /** v0.58.0: Reaction too (vehicle skills default to it and take its Karma band). */
      attribute: new fields.StringField({ required: true, initial: 'quickness', choices: [...ATTRIBUTE_KEYS, 'reaction'] }),
      specialization: new fields.StringField({ required: true, initial: '' }),
      /** Rating used instead of the skill's when the specialization applies (0 = none). */
      specializationRating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** Active, knowledge or language (v0.33.0): sets the Karma cost of raising it. */
      kind: new fields.StringField({ required: true, initial: 'active', choices: ['active', 'knowledge', 'language', 'buildRepair'] }),
      /** v0.58.0: a language skill that is the character's native tongue (RULES.CHARACTERS_V58.languages). */
      native: new fields.BooleanField({ required: true, initial: false }),
      /** v0.38.0: a concentration (between the skill and its specialization) and its rating (0 = none). */
      concentration: new fields.StringField({ required: true, initial: '' }),
      concentrationRating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** v0.38.0: a martial art / unarmed style: replaces Unarmed Combat when better, with its own bonuses. */
      martial: new fields.SchemaField({
        enabled: new fields.BooleanField({ required: true, initial: false }),
        power: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        stage: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        reach: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        defense: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      description: new fields.HTMLField({ required: true, initial: '' }),
      /** v0.92.1: custom tweaks (rules/tweaks.ts). */
      tweaks: tweaksField(),
    };
  }
}

export class WeaponDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    return {
      /** v0.66.0: how many (always 1 here; Item Piles reads every lootable item's quantity). */
      quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      melee: new fields.BooleanField({ required: true, initial: false }),
      /** Skill used to attack, matched by name against the actor's skills. */
      skill: new fields.StringField({ required: true, initial: '' }),
      /** Specialization this weapon falls under (e.g. "Pistols"); pre-ticks it in the Attack dialog. */
      specialization: new fields.StringField({ required: true, initial: '' }),
      /** Power, or the bonus added to Strength when `strengthPower` is set (may be negative then). */
      damagePower: new fields.NumberField({ required: true, integer: true, initial: 6 }),
      damageLevel: new fields.StringField({ required: true, initial: 'M', choices: ['L', 'M', 'S', 'D'] }),
      damageType: new fields.StringField({ required: true, initial: 'physical', choices: ['physical', 'stun'] }),
      /** Range band limits in metres: short / medium / long / extreme. */
      range: new fields.SchemaField({
        short: new fields.NumberField({ required: true, integer: true, min: 0, initial: 5 }),
        medium: new fields.NumberField({ required: true, integer: true, min: 0, initial: 20 }),
        long: new fields.NumberField({ required: true, integer: true, min: 0, initial: 40 }),
        extreme: new fields.NumberField({ required: true, integer: true, min: 0, initial: 60 }),
      }),
      reach: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** Power = Strength + damagePower, e.g. "(STR+2)M". */
      strengthPower: new fields.BooleanField({ required: true, initial: false }),
      /** Bows: the highest Strength the weapon can use (0 = no cap). */
      strengthCap: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** Thrown weapons and bows: range limits are multiples of Strength. */
      strengthRange: new fields.BooleanField({ required: true, initial: false }),
      strengthRangeMultipliers: new fields.SchemaField({
        short: new fields.NumberField({ required: true, min: 0, initial: RULES.COMBAT.strengthRange.short }),
        medium: new fields.NumberField({ required: true, min: 0, initial: RULES.COMBAT.strengthRange.medium }),
        long: new fields.NumberField({ required: true, min: 0, initial: RULES.COMBAT.strengthRange.long }),
        extreme: new fields.NumberField({ required: true, min: 0, initial: RULES.COMBAT.strengthRange.extreme }),
      }),
      /** Heavy weapon: recoil multiplied (RULES.COMBAT.heavyRecoilMultiplier). */
      heavy: new fields.BooleanField({ required: true, initial: false }),
      /** Loaded ammunition (RULES.COMBAT.ammo). */
      // v0.72.0 (O6): no fixed choices (RULES.COMBAT.ammo plus RULES.COMBAT_V72.ammo.extra), so house-rule rounds validate.
      ammoType: new fields.StringField({ required: true, initial: 'standard' }),
      /** Grenades and explosives: Power drops per metre from the blast point. */
      blast: new fields.BooleanField({ required: true, initial: false }),
      blastPerMetre: new fields.NumberField({ required: true, min: 0, initial: RULES.COMBAT.blast.powerPerMetre }),
      /** Shotguns: the choke sets how fast the shot spreads. */
      shotgun: new fields.BooleanField({ required: true, initial: false }),
      choke: new fields.NumberField({ required: true, integer: true, min: 1, initial: 5 }),
      /** Grenade kind (RULES.COMBAT.grenades): its falloff, damage type or effect. */
      blastKind: new fields.StringField({ required: true, initial: 'custom', choices: RULES.COMBAT.grenades.map((g) => g.id) }),
      /** Gyro mount rating: cancels recoil, then movement penalties. */
      gyro: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** A stun weapon (taser, stun baton; v0.31.0): Stun damage against half impact armor (RULES.STUN_WEAPONS). */
      stunWeapon: new fields.BooleanField({ required: true, initial: false }),
      /** Jammed by a disaster (v0.35.0): it can't fire until cleared (a Simple action, or a reload). */
      jammed: new fields.BooleanField({ required: true, initial: false }),
      /** v0.37.0: a silencer (SS/SA only) or sound suppressor; a flamethrower; a missile's Intelligence (dice); weight. */
      muzzle: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'silencer', 'suppressor'] }),
      areaKind: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'flame'] }),
      guidance: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      weight: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      /** v0.43.0: Concealability (0 = can't be hidden); accessories; a grenade's fuse and smart guidance. */
      concealability: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      laserSight: new fields.BooleanField({ required: true, initial: false }),
      scope: new fields.NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
      /** v0.47.0: the scope's own vision mode, lent to ranged attacks (RULES.GEAR.accessories.scopeVision). */
      scopeVision: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'lowLight', 'thermographic'] }),
      shockPad: new fields.BooleanField({ required: true, initial: false }),
      support: new fields.StringField({ required: true, initial: 'none', choices: ['none', 'bipod', 'tripod'] }),
      supportSetUp: new fields.BooleanField({ required: true, initial: false }),
      fuse: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'impact', 'airburst'] }),
      smartGrenade: new fields.BooleanField({ required: true, initial: false }),
      /** v0.55.0: how it is loaded (RULES.COMBAT.reloadFeed), which armor stops it ('auto' by kind), whether it is drawn and has a quick-draw holster. */
      feed: new fields.StringField({ required: true, initial: 'clip', choices: [...FEEDS] }),
      armorKind: new fields.StringField({ required: true, initial: 'auto', choices: ['auto', 'ballistic', 'impact'] }),
      ready: new fields.BooleanField({ required: true, initial: true }),
      quickDraw: new fields.BooleanField({ required: true, initial: false }),
      /** v0.55.0: a toxin it delivers (a gear item with a toxin on the same sheet): on a hit (darts, capsule rounds, blades) or to everyone in a gas blast; `toxinNeedsWound`: only when the hit does damage. */
      toxinId: new fields.StringField({ required: true, initial: '' }),
      toxinNeedsWound: new fields.BooleanField({ required: true, initial: false }),
      /** v0.55.0: a cybergun: the cyberware it is built into (it works only while that is installed, working and healed in). */
      implantId: new fields.StringField({ required: true, initial: '' }),
      /** v0.61.0: minimum arming range in metres (grenade launchers; 0 = none), and a weapon that can hit its wielder (monowhip). */
      minRange: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      /** v0.72.0: can fire indirect (mortars; RULES.COMBAT_V72.indirect). Blast weapons fired with Launch Weapons or Gunnery can too. */
      indirect: new fields.BooleanField({ required: true, initial: false }),
      selfHit: new fields.BooleanField({ required: true, initial: false }),
      /** Rounds currently loaded (a stun baton's charges). Only tracked when ammoMax > 0. */
      ammo: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** Magazine capacity; 0 means ammo is not tracked. */
      ammoMax: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** Firing modes, e.g. "SA/BF" or "SA/BF/FA". Empty = single shot. */
      modes: new fields.StringField({ required: true, initial: '' }),
      recoilComp: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** Smartgun-equipped: the Attack dialog pre-ticks the smartlink modifier. */
      smartgun: new fields.BooleanField({ required: true, initial: false }),
      /** A magical weapon: ignores immunity to normal weapons. */
      magical: new fields.BooleanField({ required: true, initial: false }),
      /** What it is made of or loaded with (silver, wood...), for critter vulnerabilities and allergies (v0.39.0). */
      material: new fields.StringField({ required: true, initial: '' }),
      /** An anti-vehicle weapon: full Power and level against vehicles (RULES.VEHICLES.damage). */
      antiVehicle: new fields.BooleanField({ required: true, initial: false }),
      /** On a vehicle: how it is mounted ('none' = carried). Fixed: driver/autopilot; turret: anyone; pintle: a gunner. */
      mount: new fields.StringField({ required: true, initial: 'none', choices: [...RULES.VEHICLES.mounts] }),
      /** v0.46.0: a fixed mount's firing arc ('' = any direction). */
      arc: new fields.StringField({ required: true, blank: true, initial: '', choices: [...ARC_SIDES] }),
      /** v0.73.0 (O28): the mount point it needs on a vehicle ('' = by kind: anti-vehicle, missiles and heavy guns take a hardpoint; RULES.DRONES_V73.mounts). */
      mountPoint: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'firm', 'hard'] }),
      /** v0.49.0: a turret's facing (degrees from the vehicle's front), traverse per shot and limit (0 = RULES.VEHICLES.turrets). */
      turret: new fields.SchemaField({
        facing: new fields.NumberField({ required: true, initial: 0 }),
        traverse: new fields.NumberField({ required: true, min: 0, initial: 0 }),
        limit: new fields.NumberField({ required: true, min: 0, max: 360, initial: 0 }),
      }),
      /** v0.58.0: broken (can't be used until repaired with its Build/Repair skill). */
      damaged: new fields.BooleanField({ required: true, initial: false }),
      /** v0.49.0: Heat (stolen goods: cools from the time it was set) and bulk in Cargo Factor units. */
      heat: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      heatAt: new fields.NumberField({ required: true, initial: -1 }),
      cf: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      /** Buying it (v0.33.0): cost in nuyen, Availability ("6/14 days") and Street Index. */
      cost: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      availability: new fields.StringField({ required: true, initial: '' }),
      streetIndex: new fields.NumberField({ required: true, min: 0, initial: 1 }),
      ...legalFields(),
      description: new fields.HTMLField({ required: true, initial: '' }),
      /** v0.92.1: custom tweaks (rules/tweaks.ts). */
      tweaks: tweaksField(),
      /** v0.92.1: carried on the person (RULES.SHEET_V921.carried). */
      carried: carriedField(),
    };
  }
}

export class ArmorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    return {
      /** v0.66.0: how many (always 1 here; Item Piles reads every lootable item's quantity). */
      quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      ballistic: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      impact: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      worn: new fields.BooleanField({ required: true, initial: true }),
      /** v0.37.0: adds to other armor (helmets, form-fitting armor, shields) instead of only the best counting. */
      adds: new fields.BooleanField({ required: true, initial: false }),
      /** Points lost to damage (the armor-degrading house rule); repaired from the sheet. */
      degraded: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      weight: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      /** v0.43.0: Concealability (0 = can't be hidden), and a shield's Parry rating (melee defense). */
      concealability: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      parry: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** v0.49.0: Heat (stolen goods: cools from the time it was set) and bulk in Cargo Factor units. */
      heat: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      heatAt: new fields.NumberField({ required: true, initial: -1 }),
      cf: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      /** Buying it (v0.33.0): cost in nuyen, Availability ("6/14 days") and Street Index. */
      cost: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      availability: new fields.StringField({ required: true, initial: '' }),
      streetIndex: new fields.NumberField({ required: true, min: 0, initial: 1 }),
      ...legalFields(),
      description: new fields.HTMLField({ required: true, initial: '' }),
      /** v0.92.1: custom tweaks (rules/tweaks.ts). */
      tweaks: tweaksField(),
      /** v0.92.1: carried on the person (RULES.SHEET_V921.carried). */
      carried: carriedField(),
    };
  }
}

export class GearDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    return {
      quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      /** Enchanting materials: raw, refined, radical or fetish ('' = ordinary gear). */
      material: new fields.StringField({ required: true, blank: true, initial: '', choices: [...MATERIAL_KINDS] }),
      /** Ammunition clips: the type of round, and rounds per clip (0 = fills the weapon). */
      // v0.72.0 (O6): no fixed choices (see the weapon's ammoType).
      ammoType: new fields.StringField({ required: true, blank: true, initial: '' }),
      rounds: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** A medkit: its rating adds dice to first aid. */
      medkitRating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** v0.55.0: a slap patch (RULES.PATCHES): stim, tranq, trauma or antidote, and its rating. */
      patch: new fields.SchemaField({
        kind: new fields.StringField({ required: true, blank: true, initial: '', choices: [...RULES.PATCHES.kinds] }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      /** A remote control deck: its rating (0 = not one). Lets a rigger jump into vehicles remotely and hold drones. */
      rcdRating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** v0.46.0: a remote control deck's signal rating (0 = its RCD rating), a jammer's rating, and a stealth suit. */
      signal: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      jammer: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      stealth: new fields.SchemaField({
        kind: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'chameleon', 'thermal'] }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        worn: new fields.BooleanField({ required: true, initial: false }),
      }),
      /** A toxin, drug or disease (v0.31.0): how it gets in, its damage, how fast; a drug's bonuses, duration and crash. */
      toxin: new fields.SchemaField({
        kind: new fields.StringField({ required: true, blank: true, initial: '', choices: [...RULES.TOXINS.kinds] }),
        vector: new fields.StringField({ required: true, initial: 'injection', choices: [...RULES.TOXINS.vectors] }),
        power: new fields.NumberField({ required: true, integer: true, min: 0, initial: 6 }),
        level: new fields.StringField({ required: true, initial: 'M', choices: ['L', 'M', 'S', 'D'] }),
        damageType: new fields.StringField({ required: true, initial: 'physical', choices: ['physical', 'stun'] }),
        speed: new fields.StringField({ required: true, initial: 'immediate', choices: RULES.TOXINS.speeds.map((x) => x.id) }),
        effect: new fields.StringField({ required: true, initial: '' }),
        attributes: new fields.SchemaField(Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, new fields.NumberField({ required: true, integer: true, initial: 0 })]))),
        reaction: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        initiativeDice: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        /** v0.61.0: a drug's effects beyond attributes. */
        extra: drugExtraField(),
        durationMinutes: new fields.NumberField({ required: true, min: 0, initial: 0 }),
        crashPower: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        crashLevel: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'L', 'M', 'S', 'D'] }),
        addiction: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        /** v0.42.0: physical or mental addiction; a disease's incubation, interval between tests and recoveries needed. */
        addictionType: new fields.StringField({ required: true, initial: 'mental', choices: ['physical', 'mental'] }),
        /** v0.92.3 (Shadowtech p. 87): a drug's Tolerance and Strength ratings (0 = none). */
        tolerance: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        strength: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        incubationHours: new fields.NumberField({ required: true, min: 0, initial: 24 }),
        intervalHours: new fields.NumberField({ required: true, min: 1, initial: 24 }),
        recoveries: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        /** v0.48.0: a disease that spreads between people: airborne, by contact or by blood. */
        contagious: new fields.StringField({ required: true, blank: true, initial: '', choices: [...CONTAGION_VECTORS] }),
      }),
      /** v0.42.0: protective gear against toxins (gas mask, respirator, chemsuit) and whether it is worn. */
      protection: new fields.SchemaField({
        kind: new fields.StringField({ required: true, blank: true, initial: '', choices: [...RULES.HEALTH.protection.kinds] }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        worn: new fields.BooleanField({ required: true, initial: false }),
      }),
      /** A hermetic library, circle or shamanic lodge (v0.39.0): kind, rating, and its topic, element or totem. */
      site: new fields.SchemaField({
        kind: new fields.StringField({ required: true, blank: true, initial: '', choices: [...SITE_KINDS] }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        tag: new fields.StringField({ required: true, initial: '' }),
      }),
      /** v0.37.0: weight, and an explosive (Power 0 = not one): Power per charge, Power lost per metre, shaped. */
      weight: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      explosive: new fields.SchemaField({
        power: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        perMetre: new fields.NumberField({ required: true, min: 0, initial: 1 }),
        shaped: new fields.BooleanField({ required: true, initial: false }),
      }),
      /** v0.43.0: Concealability (0 = not looked for), and a scanner (weapon, cyberware or explosive detector) and its rating. */
      concealability: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      scanner: new fields.SchemaField({
        kind: new fields.StringField({ required: true, blank: true, initial: '', choices: [...RULES.GEAR.scannerKinds] }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      /** A skillsoft chip (v0.29.0): activesoft, knowsoft or linguasoft, the skill, its rating, slotted or not. */
      chip: new fields.SchemaField({
        kind: new fields.StringField({ required: true, blank: true, initial: '', choices: [...RULES.CYBERWARE.skillsofts.kinds] }),
        skill: new fields.StringField({ required: true, initial: '' }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        slotted: new fields.BooleanField({ required: true, initial: false }),
      }),
      /** v0.49.0: a programming suite's rating (0 = not one). */
      suite: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** v0.57.0: a lock bypass tool (RULES.SECURITY_V57.tools) and its rating; a BTL or simsense chip; a simrig. */
      bypassTool: new fields.SchemaField({
        kind: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', ...RULES.SECURITY_V57.tools.map((t) => t.id)] }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      simchip: new fields.SchemaField({
        kind: new fields.StringField({ required: true, blank: true, initial: '', choices: [...RULES.MATRIX_V57.chips.kinds] }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        minutes: new fields.NumberField({ required: true, min: 0, initial: 10 }),
      }),
      /**
       * v0.58.0: broken (gives nothing until repaired); Build/Repair tools (a kit, shop or facility, for one
       * B/R skill or any); vision gear worn (goggles, glasses, binoculars, visors); surveillance gear
       * (RULES.GEAR_V58.surveillance) and, for a bug or tap, whom it was planted on.
       */
      damaged: new fields.BooleanField({ required: true, initial: false }),
      tools: new fields.SchemaField({
        level: new fields.StringField({ required: true, initial: 'none', choices: RULES.CHARACTERS_V58.tools.levels.map((l) => l.id) }),
        skill: new fields.StringField({ required: true, initial: '' }),
      }),
      optics: new fields.SchemaField({
        lowLight: new fields.BooleanField({ required: true, initial: false }),
        thermographic: new fields.BooleanField({ required: true, initial: false }),
        flareComp: new fields.BooleanField({ required: true, initial: false }),
        magnification: new fields.NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
        worn: new fields.BooleanField({ required: true, initial: false }),
      }),
      surveillance: new fields.SchemaField({
        kind: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', ...RULES.GEAR_V58.surveillance.kinds.map((k) => k.id)] }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        active: new fields.BooleanField({ required: true, initial: true }),
        plantedOn: new fields.StringField({ required: true, initial: '' }),
        plantedName: new fields.StringField({ required: true, initial: '' }),
      }),
      simrig: new fields.BooleanField({ required: true, initial: false }),
      /** v0.61.0: dice or TN for a named skill while carried; a radio (signal rating, encryption); an ID (SIN or licence, real or fake). */
      skillMods: skillModsField(),
      radio: new fields.SchemaField({
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        encryption: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      identity: new fields.SchemaField({
        kind: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'sin', 'licence'] }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        fake: new fields.BooleanField({ required: true, initial: false }),
        covers: new fields.StringField({ required: true, initial: '' }),
      }),
      /** v0.49.0: Heat (stolen goods: cools from the time it was set) and bulk in Cargo Factor units. */
      heat: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      heatAt: new fields.NumberField({ required: true, initial: -1 }),
      cf: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      /** Buying it (v0.33.0): cost in nuyen, Availability ("6/14 days") and Street Index. */
      cost: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      availability: new fields.StringField({ required: true, initial: '' }),
      streetIndex: new fields.NumberField({ required: true, min: 0, initial: 1 }),
      ...legalFields(),
      /**
       * v0.91.8 (RULES.FORMULA_V918): a spell formula (empty `spell` = ordinary gear): the spell it teaches, its Force
       * (learned at up to this), its tradition, the spell's category and the spell's data (rules/formulas.ts).
       */
      formula: new fields.SchemaField({
        spell: new fields.StringField({ required: true, blank: true, initial: '' }),
        force: new fields.NumberField({ required: true, integer: true, min: 0, max: 12, initial: 0 }),
        tradition: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'hermetic', 'shamanic'] }),
        category: new fields.StringField({ required: true, blank: true, initial: '' }),
        data: new fields.ObjectField({ required: true, initial: {} }),
      }),
      description: new fields.HTMLField({ required: true, initial: '' }),
      /** v0.92.1: custom tweaks (rules/tweaks.ts). */
      tweaks: tweaksField(),
      /** v0.92.1: carried on the person (RULES.SHEET_V921.carried). */
      carried: carriedField(),
    };
  }
}

export class CyberwareDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    const bonus = () => new fields.NumberField({ required: true, integer: true, initial: 0 });
    return {
      /** v0.66.0: how many (always 1 here; Item Piles reads every lootable item's quantity). */
      quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      essenceCost: new fields.NumberField({ required: true, min: 0, initial: 0.5 }),
      grade: new fields.StringField({
        required: true, initial: 'standard', choices: Object.keys(RULES.GRADE_ESSENCE_MULTIPLIER),
      }),
      installed: new fields.BooleanField({ required: true, initial: true }),
      /** Bonuses added to the wearer's attributes while installed. */
      attributes: new fields.SchemaField(Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, bonus()]))),
      reaction: bonus(),
      initiativeDice: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** Armor while installed (e.g. dermal plating). */
      armorBallistic: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      armorImpact: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** A smartlink implant (smartgun bonus), and vision enhancements. */
      smartlink: new fields.BooleanField({ required: true, initial: false }),
      lowLight: new fields.BooleanField({ required: true, initial: false }),
      thermographic: new fields.BooleanField({ required: true, initial: false }),
      /** Bioware: costs Body Index instead of Essence. */
      bioware: new fields.BooleanField({ required: true, initial: false }),
      bodyIndex: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      /** A vehicle control rig: its level (0 = not a control rig). */
      controlRig: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      // ---- v0.29.0 ----
      /** What it is (RULES.CYBERWARE.kinds): a cyberlimb, cyberweapon, datajack, chipjack, skillwires... */
      kind: new fields.StringField({ required: true, initial: 'other', choices: [...RULES.CYBERWARE.kinds] }),
      /** A rating where the item has one (skillwires: the highest activesoft rating it carries). */
      rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** Reflex system: wired and boosted reflexes don't stack ('' = guess from the name). */
      reflexes: new fields.StringField({ required: true, blank: true, initial: '', choices: [...RULES.CYBERWARE.reflexTypes] }),
      smartlinkLevel: new fields.NumberField({ required: true, integer: true, min: 0, max: 2, initial: 0 }),
      magnification: new fields.NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
      flareComp: new fields.BooleanField({ required: true, initial: false }),
      ultrasound: new fields.BooleanField({ required: true, initial: false }),
      /** Tailored pheromones: their rating. */
      pheromones: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** Damaged: it gives nothing until repaired. */
      /** v0.58.0: a filtration system's kind (RULES.GEAR_V58.filtration, at `rating`) and bone lacing's kind. */
      filterKind: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', ...RULES.GEAR_V58.filtration.kinds.map((k) => k.id)] }),
      lacing: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', ...RULES.GEAR_V58.boneLacing.kinds.map((k) => k.id)] }),
      damaged: new fields.BooleanField({ required: true, initial: false }),
      /** Built into a cyberlimb (its item id): uses the limb's capacity instead of Essence. */
      housedIn: new fields.StringField({ required: true, initial: '' }),
      /** A cyberlimb: where, its own Strength and Quickness, and its capacity. */
      limb: new fields.SchemaField({
        location: new fields.StringField({ required: true, initial: 'rightArm', choices: [...RULES.CYBERWARE.limbs.locations] }),
        strength: new fields.NumberField({ required: true, integer: true, min: 0, initial: 4 }),
        quickness: new fields.NumberField({ required: true, integer: true, min: 0, initial: 4 }),
        capacity: new fields.NumberField({ required: true, min: 0, initial: 1 }),
      }),
      /** A cyberweapon: its attack while installed (Power = Strength + damagePower when strengthPower). */
      weapon: new fields.SchemaField({
        skill: new fields.StringField({ required: true, initial: 'Armed Combat' }),
        strengthPower: new fields.BooleanField({ required: true, initial: true }),
        damagePower: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        damageLevel: new fields.StringField({ required: true, initial: 'M', choices: ['L', 'M', 'S', 'D'] }),
        damageType: new fields.StringField({ required: true, initial: 'physical', choices: ['physical', 'stun'] }),
        reach: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      }),
      /** v0.61.0: dice or TN for a named skill; cyberears: hearing amplification (0–3), a damper, high/low frequency, a recorder. */
      skillMods: skillModsField(),
      hearingAmp: new fields.NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
      dampener: new fields.BooleanField({ required: true, initial: false }),
      highFrequency: new fields.BooleanField({ required: true, initial: false }),
      lowFrequency: new fields.BooleanField({ required: true, initial: false }),
      recorder: new fields.BooleanField({ required: true, initial: false }),
      /** Bioware (v0.30.0): its kind (RULES.BIOWARE.effects, at `rating`), cultured, and an adrenal pump switched on. */
      bioKind: new fields.StringField({ required: true, initial: 'other', choices: [...RULES.BIOWARE.kinds, ...bioKindsV72()] }),
      cultured: new fields.BooleanField({ required: true, initial: false }),
      bioActive: new fields.BooleanField({ required: true, initial: false }),
      /** v0.43.0: Concealability to the eye (0 = internal, only scanners find it). */
      concealability: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** v0.49.0: Heat (stolen or second-hand ware). */
      heat: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      heatAt: new fields.NumberField({ required: true, initial: -1 }),
      /** Cost in nuyen (standard grade) and availability, as text. */
      cost: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      availability: new fields.StringField({ required: true, initial: '' }),
      streetIndex: new fields.NumberField({ required: true, min: 0, initial: 1 }),
      ...legalFields(),
      description: new fields.HTMLField({ required: true, initial: '' }),
      /** v0.92.1: custom tweaks (rules/tweaks.ts). */
      tweaks: tweaksField(),
    };
  }
}

export class SpellDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    return {
      /** v0.72.0 (O17): a Mana or Physical Barrier spell raises a barrier while sustained (MAGIC_V72.barrierSpells). */
      barrier: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'mana', 'physical'] }),
      /** v0.72.0 (O18): a critter's innate spell: cast with Magic (else Essence) without Sorcery (MAGIC_V72.innateSpells). */
      innate: new fields.BooleanField({ required: true, initial: false }),
      category: new fields.StringField({
        required: true, initial: 'combat', choices: ['combat', 'detection', 'health', 'illusion', 'manipulation'],
      }),
      spellType: new fields.StringField({ required: true, initial: 'mana', choices: ['mana', 'physical'] }),
      /** Highest Force the caster knows this spell at. */
      learnedForce: new fields.NumberField({ required: true, integer: true, min: 1, initial: 4 }),
      /** Base damage level for combat spells. */
      damageLevel: new fields.StringField({ required: true, initial: 'M', choices: ['L', 'M', 'S', 'D'] }),
      damageType: new fields.StringField({ required: true, initial: 'physical', choices: ['physical', 'stun'] }),
      /** TN for non-combat spells (combat spells use the target's attribute). */
      targetNumber: new fields.NumberField({ required: true, integer: true, min: 2, initial: 4 }),
      /** Sustained spells stay up after casting (and cost +2 TN unless a focus holds them). */
      duration: new fields.StringField({ required: true, initial: 'instant', choices: [...SPELL_DURATIONS] }),
      /** Area spell: can be cast on several targets at once. */
      area: new fields.BooleanField({ required: true, initial: false }),
      /** Non-combat spells: the attribute an unwilling target resists with ('none' = not resisted). */
      resist: new fields.StringField({ required: true, initial: 'none', choices: ['none', ...ATTRIBUTE_KEYS] }),
      /** Health spells that heal damage, and which track. */
      heals: new fields.BooleanField({ required: true, initial: false }),
      healTrack: new fields.StringField({ required: true, initial: 'physical', choices: ['physical', 'stun'] }),
      /** Spell options that lower the drain TN. */
      exclusive: new fields.BooleanField({ required: true, initial: false }),
      fetish: new fields.BooleanField({ required: true, initial: false }),
      /** v0.92.3: the fetish is expendable (used up each cast): Force +2 instead of +1 (Core p. 133). */
      fetishExpendable: new fields.BooleanField({ required: true, initial: false }),
      /** Elemental manipulation (Fireball...): handled like a ranged attack with Power = Force. */
      elemental: new fields.BooleanField({ required: true, initial: false }),
      /** The spell's element, for elemental aid and sustaining and elementalists. */
      element: new fields.StringField({ required: true, initial: '' }),
      /** Drain code: TN = floor(Force / 2) + modifier, at this level. */
      drainModifier: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      drainLevel: new fields.StringField({ required: true, initial: 'M', choices: ['L', 'M', 'S', 'D'] }),
      /** v0.56.0: line of sight or touch (RULES.MAGIC_V56.touch); detection spells: extended range. */
      range: new fields.StringField({ required: true, initial: 'los', choices: ['los', 'touch'] }),
      extendedRange: new fields.BooleanField({ required: true, initial: false }),
      /** v0.56.0: health spells: drain at the wound's level ('wound') or the fixed level; Treat's time limit. */
      healDrain: new fields.StringField({ required: true, initial: 'fixed', choices: ['fixed', 'wound'] }),
      treat: new fields.BooleanField({ required: true, initial: false }),
      /** v0.56.0: what the spell changes on its target while sustained (or once permanent). */
      effects: effectsField(),
      effectPerSuccess: new fields.BooleanField({ required: true, initial: false }),
      description: new fields.HTMLField({ required: true, initial: '' }),
      /** v0.92.1: custom tweaks (rules/tweaks.ts). */
      tweaks: tweaksField(),
    };
  }
}

/**
 * A critter or spirit power. Active powers roll `dice` (Force, a rating, Magic or an attribute)
 * against a fixed TN or a target's attribute; the target may resist with an attribute against the
 * power's potency. The result is staged damage (like a combat spell) or just net successes.
 */
export class PowerDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    return {
      active: new fields.BooleanField({ required: true, initial: true }),
      dice: new fields.StringField({ required: true, initial: 'force', choices: [...POWER_DICE_SOURCES] }),
      rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 4 }),
      tnSource: new fields.StringField({ required: true, initial: 'fixed', choices: [...POWER_TN_SOURCES] }),
      targetNumber: new fields.NumberField({ required: true, integer: true, min: 2, initial: 4 }),
      resist: new fields.StringField({ required: true, initial: 'willpower', choices: [...POWER_RESIST] }),
      effect: new fields.StringField({ required: true, initial: 'effect', choices: ['effect', 'damage'] }),
      /** Area: several targets at once. Repeating: the card offers to use it again (e.g. each turn). */
      area: new fields.BooleanField({ required: true, initial: false }),
      repeating: new fields.BooleanField({ required: true, initial: false }),
      damageLevel: new fields.StringField({ required: true, initial: 'M', choices: ['L', 'M', 'S', 'D'] }),
      damageType: new fields.StringField({ required: true, initial: 'stun', choices: ['physical', 'stun'] }),
      /**
       * A built-in effect (v0.39.0): allergy, vulnerability, Essence loss, Essence drain, regeneration
       * or dual-natured. Allergies and vulnerabilities name a substance; allergies have a severity
       * and can be marked exposed.
       */
      special: new fields.StringField({ required: true, blank: true, initial: '', choices: [...POWER_SPECIALS] }),
      substance: new fields.StringField({ required: true, initial: '' }),
      severity: new fields.StringField({ required: true, initial: 'mild', choices: [...ALLERGY_SEVERITIES] }),
      exposed: new fields.BooleanField({ required: true, initial: false }),
      /**
       * v0.45.0: a sustained power whose effect lasts until dropped, and the attribute changes it
       * makes to its target (or the user, with no target); `perSuccess` multiplies them by the net
       * successes (RULES.OCCULT.powers).
       */
      sustained: new fields.BooleanField({ required: true, initial: false }),
      attributes: new fields.SchemaField(Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, new fields.NumberField({ required: true, integer: true, initial: 0 })]))),
      perSuccess: new fields.BooleanField({ required: true, initial: false }),
      /**
       * v0.56.0: TN and movement changes it puts on its target (Concealment, Confusion, Movement, Fear,
       * Guard fill these from RULES.CRITTERS_V56.powerMods when left at 0 / 1).
       */
      mods: new fields.SchemaField({
        testsTn: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        perceivedTn: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        attackedTn: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        movementFactor: new fields.NumberField({ required: true, min: 0, initial: 1 }),
      }),
      /** Range or area, action type, duration: free text shown on the sheet. */
      notes: new fields.StringField({ required: true, initial: '' }),
      description: new fields.HTMLField({ required: true, initial: '' }),
      /** v0.92.1: custom tweaks (rules/tweaks.ts). */
      tweaks: tweaksField(),
    };
  }
}

/** A magical focus. Only active foci add dice; bonding (Karma cost) is up to the player. */
export class FocusDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    return {
      /** v0.66.0: how many (always 1 here; Item Piles reads every lootable item's quantity). */
      quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      focusType: new fields.StringField({ required: true, initial: 'spell', choices: [...FOCUS_TYPES] }),
      rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      active: new fields.BooleanField({ required: true, initial: true }),
      bonded: new fields.BooleanField({ required: true, initial: true }),
      /** Spell category for spell and sustaining foci; empty = any. */
      category: new fields.StringField({ required: true, initial: '' }),
      /** Specific spell, spirit kind/type or weapon name; empty = any. */
      target: new fields.StringField({ required: true, initial: '' }),
      /** v0.78.0: a weapon focus's size for its bonding Karma (RULES.BOOK_V78.focusKarma: small 4, large 5); '' = small. */
      size: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'small', 'large'] }),
      /** v0.91.1: bought in the shop: cost in nuyen, Availability, Street Index, legality. */
      cost: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      availability: new fields.StringField({ required: true, initial: '' }),
      streetIndex: new fields.NumberField({ required: true, min: 0, initial: 1 }),
      ...legalFields(),
      description: new fields.HTMLField({ required: true, initial: '' }),
      /** v0.92.1: custom tweaks (rules/tweaks.ts). */
      tweaks: tweaksField(),
    };
  }
}

/** An adept power: costs power points, adds bonuses while active. */
export class AdeptPowerDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    const bonus = () => new fields.NumberField({ required: true, integer: true, initial: 0 });
    return {
      cost: new fields.NumberField({ required: true, min: 0, initial: 1 }),
      active: new fields.BooleanField({ required: true, initial: true }),
      level: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      attributes: new fields.SchemaField(Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, bonus()]))),
      reaction: bonus(),
      initiativeDice: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      skill: new fields.StringField({ required: true, initial: '' }),
      skillDice: bonus(),
      ballistic: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      impact: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** A power with an effect the system applies (v0.39.0): killing hands, combat sense, pain resistance... */
      special: new fields.StringField({ required: true, blank: true, initial: '', choices: [...ADEPT_SPECIALS] }),
      /** v0.56.0: improved senses: the sense it gives. */
      sense: new fields.StringField({ required: true, blank: true, initial: '', choices: [...ADEPT_SENSES] }),
      description: new fields.HTMLField({ required: true, initial: '' }),
      /** v0.92.1: custom tweaks (rules/tweaks.ts). */
      tweaks: tweaksField(),
    };
  }
}

/** A ward or astral barrier placed in the world. Forcing through lowers its rating. */
export class BarrierDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    return {
      // v0.72.0 (O17): 'physical barrier' (a Physical Barrier spell) stops bodies and gunfire, not astral forms.
      barrierKind: new fields.StringField({ required: true, initial: 'ward', choices: ['ward', 'mana barrier', 'astral barrier', 'physical barrier'] }),
      /** Current rating (Force); restored to `baseRating` by the Restore button. */
      rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 4 }),
      baseRating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 4 }),
      notes: new fields.HTMLField({ required: true, initial: '' }),
    };
  }

  prepareDerivedData(): void {
    const sys = this as any;
    sys.derived = { status: sys.rating > 0 ? 'standing' : 'breached', astralMode: 'physical' };
  }
}

/** A cyberdeck: MPCP, persona programs and hardware. Only a deck marked "in use" counts. */
export class CyberdeckDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    const rating = (initial: number) => new fields.NumberField({ required: true, integer: true, min: 0, initial });
    return {
      /** v0.66.0: how many (always 1 here; Item Piles reads every lootable item's quantity). */
      quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      active: new fields.BooleanField({ required: true, initial: true }),
      mpcp: rating(4),
      bod: rating(3),
      evasion: rating(3),
      masking: rating(3),
      sensors: rating(3),
      hardening: rating(0),
      responseIncrease: rating(0),
      activeMemory: rating(100),
      storageMemory: rating(500),
      ioSpeed: rating(100),
      /** v0.46.0: a wireless transceiver's signal rating, a tortoise (no ASIST), an otaku's living persona. */
      signal: rating(0),
      tortoise: new fields.BooleanField({ required: true, initial: false }),
      living: new fields.BooleanField({ required: true, initial: false }),
      /** v0.49.0: what it cost (the builder counts it). */
      cost: rating(0),
      /** v0.57.0: Load Speed (Mp per Combat Turn; 0 = its I/O speed), a reality filter, and hitcher jacks. */
      loadSpeed: rating(0),
      realityFilter: new fields.BooleanField({ required: true, initial: false }),
      hitchers: rating(0),
      /** Damage to the deck itself (blaster and sparky crashes, rippers, trace and burn) until repaired. */
      damage: personaPoints(true),
      /** Data downloaded to the deck's storage memory. */
      files: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ required: true, initial: '' }),
        size: rating(0),
        value: rating(0),
        paydata: new fields.BooleanField({ required: true, initial: false }),
        source: new fields.StringField({ required: true, initial: '' }),
      })),
      /** v0.91.1: found in the shop: Availability, Street Index, legality (its cost is above). */
      availability: new fields.StringField({ required: true, initial: '' }),
      streetIndex: new fields.NumberField({ required: true, min: 0, initial: 1 }),
      ...legalFields(),
      description: new fields.HTMLField({ required: true, initial: '' }),
      /** v0.92.1: custom tweaks (rules/tweaks.ts). */
      tweaks: tweaksField(),
    };
  }
}

/** A utility program. Loaded programs sit in active memory and can be used. */
export class ProgramDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    return {
      /** v0.66.0: how many (always 1 here; Item Piles reads every lootable item's quantity). */
      quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      kind: new fields.StringField({ required: true, initial: 'attack', choices: [...UTILITY_KINDS] }),
      rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 4 }),
      /** Memory in Mp; enter it from the book's size table. */
      size: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      loaded: new fields.BooleanField({ required: true, initial: true }),
      /** Erased by a tar pit: it cannot be loaded until restored (untick). */
      erased: new fields.BooleanField({ required: true, initial: false }),
      /** Attack utilities: the damage level they deal (Power = rating). */
      damageLevel: new fields.StringField({ required: true, initial: 'M', choices: ['L', 'M', 'S', 'D'] }),
      /** v0.49.0: an otaku's complex form (no memory, never erased), and program options it was written with. */
      complexForm: new fields.BooleanField({ required: true, initial: false }),
      options: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
      /** v0.57.0: still loading into active memory until this Combat Turn or world time (-1 = ready). */
      loading: new fields.SchemaField({
        round: new fields.NumberField({ required: true, integer: true, initial: -1 }),
        /** v0.81.0: the combat `round` belongs to ('' = none). */
        combatId: new fields.StringField({ required: true, blank: true, initial: '' }),
        worldTime: new fields.NumberField({ required: true, initial: -1 }),
      }),
      /** v0.91.1: bought in the shop: cost in nuyen, Availability, Street Index, legality. */
      cost: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      availability: new fields.StringField({ required: true, initial: '' }),
      streetIndex: new fields.NumberField({ required: true, min: 0, initial: 1 }),
      ...legalFields(),
      description: new fields.HTMLField({ required: true, initial: '' }),
      /** v0.92.1: custom tweaks (rules/tweaks.ts). */
      tweaks: tweaksField(),
    };
  }
}

/** A Matrix host: security code and value, subsystem ratings, security tally, sheaf and alert. */
export class HostDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    const rating = (initial: number) => new fields.NumberField({ required: true, integer: true, min: 0, initial });
    return {
      /** A host, or a grid (LTG, RTG) other nodes hang off (v0.28.0). */
      gridKind: new fields.StringField({ required: true, initial: 'host', choices: [...RULES.MATRIX.grid.kinds] }),
      parentUuid: new fields.StringField({ required: true, initial: '' }),
      /** v0.46.0: the node's LTG number (dial it to log on from anywhere). */
      ltgNumber: new fields.StringField({ required: true, initial: '' }),
      securityCode: new fields.StringField({ required: true, initial: 'orange', choices: [...RULES.MATRIX.securityCodes] }),
      securityValue: rating(6),
      subsystems: new fields.SchemaField(Object.fromEntries(RULES.MATRIX.subsystems.map((k) => [k, rating(10)]))),
      tally: rating(0),
      alert: new fields.StringField({ required: true, initial: 'none', choices: [...RULES.MATRIX.alerts] }),
      sheaf: new fields.ArrayField(new fields.SchemaField({
        step: new fields.NumberField({ required: true, integer: true, min: 0, initial: 4 }),
        event: new fields.StringField({ required: true, initial: '' }),
        alert: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', ...RULES.MATRIX.alerts] }),
        /** v0.61.0: IC this step launches (icType '' = none; rating 0 = the Security Value). */
        ic: new fields.SchemaField({
          icType: new fields.StringField({ required: true, initial: '' }),
          category: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'white', 'gray', 'black'] }),
          rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          behavior: new fields.StringField({ required: true, initial: '' }),
          damageLevel: new fields.StringField({ required: true, initial: 'M', choices: ['L', 'M', 'S', 'D'] }),
          copies: new fields.NumberField({ required: true, integer: true, min: 1, max: 8, initial: 1 }),
        }),
      })),
      /** v0.61.0: sheaf steps whose IC has been launched (cleared when the tally is reset). */
      launchedSteps: new fields.ArrayField(new fields.NumberField({ required: true, integer: true, initial: 0 })),
      /** Data stores: files and paydata, their defenses, and who has located them. */
      /** v0.40.0: security deckers (actor UUIDs), intruders they have spotted, and a smoke cloud. */
      securityDeckers: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
      spotted: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
      smoke: new fields.SchemaField({
        rating: rating(0), tn: rating(0),
        by: new fields.StringField({ required: true, initial: '' }),
        round: new fields.NumberField({ required: true, integer: true, initial: -1 }),
        /** v0.81.0: the combat `round` belongs to ('' = none). */
        combatId: new fields.StringField({ required: true, blank: true, initial: '' }),
        worldTime: new fields.NumberField({ required: true, initial: -1 }),
      }),
      files: new fields.ArrayField(new fields.SchemaField({
        id: new fields.StringField({ required: true, initial: '' }),
        name: new fields.StringField({ required: true, initial: '' }),
        size: rating(0),
        value: rating(0),
        paydata: new fields.BooleanField({ required: true, initial: false }),
        encrypted: rating(0),
        scramble: rating(0),
        foundBy: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
        /** v0.46.0: who edited it and how, and who uploaded it. */
        edited: new fields.StringField({ required: true, initial: '' }),
        uploadedBy: new fields.StringField({ required: true, initial: '' }),
        /** v0.57.0: a data bomb (rating, 0 = none), a Pavlov bomb (re-arms, leaves the file), and who has scanned it. */
        bomb: rating(0),
        pavlov: new fields.BooleanField({ required: true, initial: false }),
        bombFoundBy: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
      })),
      /** v0.57.0: a security tally for each intruder (key = decker, or agent), when the host dumps everyone after a shutdown, deckers with a validated passcode, subsystem data bombs, and comcalls on an LTG. */
      tallies: new fields.ArrayField(new fields.SchemaField({
        key: new fields.StringField({ required: true, initial: '' }),
        name: new fields.StringField({ required: true, initial: '' }),
        tally: rating(0),
      })),
      shutdown: new fields.SchemaField({
        pending: new fields.BooleanField({ required: true, initial: false }),
        round: new fields.NumberField({ required: true, integer: true, initial: -1 }),
        /** v0.81.0: the combat `round` belongs to ('' = none). */
        combatId: new fields.StringField({ required: true, blank: true, initial: '' }),
        worldTime: new fields.NumberField({ required: true, initial: -1 }),
      }),
      validated: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
      bombs: new fields.ArrayField(new fields.SchemaField({
        subsystem: new fields.StringField({ required: true, initial: 'access', choices: [...RULES.MATRIX.subsystems] }),
        rating: rating(0),
        pavlov: new fields.BooleanField({ required: true, initial: false }),
        foundBy: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
      })),
      calls: new fields.ArrayField(new fields.SchemaField({
        id: new fields.StringField({ required: true, initial: '' }),
        from: new fields.StringField({ required: true, initial: '' }),
        to: new fields.StringField({ required: true, initial: '' }),
        by: new fields.StringField({ required: true, initial: '' }),
        tappedBy: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
        rerouted: new fields.StringField({ required: true, initial: '' }),
      })),
      notes: new fields.HTMLField({ required: true, initial: '' }),
    };
  }

  prepareDerivedData(): void {
    const sys = this as any;
    sys.derived = { status: sys.alert, astralMode: 'physical', nextStep: nextSheafStep(sys.tally, sys.sheaf ?? []) };
  }
}

/** Intrusion countermeasures: a rating, what they hit, and a Matrix condition monitor. */
export class IcDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    return {
      rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 6 }),
      category: new fields.StringField({ required: true, initial: 'white', choices: [...IC_CATEGORIES] }),
      /** e.g. Probe, Killer, Blaster, Black IC. */
      icType: new fields.StringField({ required: true, initial: '' }),
      damageLevel: new fields.StringField({ required: true, initial: 'M', choices: ['L', 'M', 'S', 'D'] }),
      /** Black IC: which of the decker's own tracks it damages. */
      damageType: new fields.StringField({ required: true, initial: 'physical', choices: ['physical', 'stun'] }),
      /** 0 = from the host's security code. */
      initiativeDice: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      hostUuid: new fields.StringField({ required: true, initial: '' }),
      /** IC, a decker's frame (v0.28.0) or agent (v0.40.0): its owner, and whether it is a smart frame. */
      kind: new fields.StringField({ required: true, initial: 'ic', choices: ['ic', 'frame', 'agent'] }),
      ownerUuid: new fields.StringField({ required: true, initial: '' }),
      smart: new fields.BooleanField({ required: true, initial: false }),
      /** What it does when it acts (v0.27.0). */
      behavior: new fields.StringField({ required: true, initial: 'killer', choices: [...IC_BEHAVIORS] }),
      /** Barrier IC: the subsystem it guards. */
      guards: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', ...RULES.MATRIX.subsystems] }),
      /** Trace IC: what happens when the trace completes. */
      traceMode: new fields.StringField({ required: true, initial: 'dump', choices: [...TRACE_MODES] }),
      /** Psychotropic IC (v0.40.0): the payload ('' = from the IC's name). */
      payload: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', ...RULES.MATRIX.psychotropic.kinds] }),
      /** Crippler and ripper IC: the persona program they go after. */
      attribute: new fields.StringField({ required: true, initial: 'evasion', choices: [...PERSONA_ATTRIBUTES] }),
      /** v0.46.0: a party of IC (members share this name), and a construct's other behaviors. */
      party: new fields.StringField({ required: true, initial: '' }),
      construct: new fields.ArrayField(new fields.StringField({ required: true, initial: 'killer', choices: [...IC_BEHAVIORS] })),
      matrix: new fields.SchemaField({
        monitor: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      notes: new fields.HTMLField({ required: true, initial: '' }),
    };
  }

  prepareDerivedData(): void {
    const sys = this as any;
    const crashed = matrixCrashed(sys.matrix?.monitor ?? 0);
    sys.derived = {
      status: crashed ? 'derezzed' : 'active',
      astralMode: 'physical',
      reaction: sys.rating,
      // 0 = from the host's security code, worked out when initiative is rolled.
      initiativeDice: sys.initiativeDice > 0 ? sys.initiativeDice : icInitiativeDice(''),
      combatPoolLeft: 0, spellPoolLeft: 0, hackingPoolLeft: 0, karmaPoolLeft: 0, taskPoolLeft: 0,
      woundModifier: 0,
      crashed,
    };
  }
}

/**
 * A vehicle or drone: Handling (on-road / off-road), Speed, Acceleration, Body, Armor, Signature,
 * Autonav, Pilot (drones), Sensor; a damage track; who controls it and how; who is aboard.
 */
export class VehicleDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    const rating = (initial: number) => new fields.NumberField({ required: true, integer: true, min: 0, initial });
    return {
      category: new fields.StringField({ required: true, initial: 'car', choices: RULES.VEHICLES.categories.map((c) => c.id) }),
      /** The skill used to drive it (empty = the category's skill). */
      skill: new fields.StringField({ required: true, initial: '' }),
      drone: new fields.BooleanField({ required: true, initial: false }),
      handling: rating(4),
      /** Off-road Handling (0 = the same as on-road). */
      handlingOffroad: rating(0),
      speed: rating(90),
      accel: rating(10),
      body: rating(3),
      armor: rating(0),
      signature: rating(2),
      autonav: rating(0),
      pilot: rating(0),
      sensor: rating(0),
      /** Electronic warfare: countermeasures, counter-countermeasures, counter-detection. */
      ecm: rating(0),
      eccm: rating(0),
      ecd: rating(0),
      /** v0.43.0: Object Resistance against spells (0 = RULES.GEAR.spellsVsVehicles.objectResistance). */
      objectResistance: rating(0),
      /** Sensor locks this vehicle holds (sensor-enhanced gunnery). */
      locks: new fields.ArrayField(new fields.SchemaField({
        targetUuid: new fields.StringField({ required: true, initial: '' }),
        targetName: new fields.StringField({ required: true, initial: '' }),
        successes: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
        /** v0.73.0 (O27): when the lock was made or last refreshed (Combat Turn, -1 outside combat; world time). */
        round: new fields.NumberField({ required: true, integer: true, initial: -1 }),
        worldTime: new fields.NumberField({ required: true, initial: -1 }),
        /** v0.81.1 (RA2-4 sibling): the combat `round` belongs to ('' = none, or made before v0.81.1). */
        combatId: new fields.StringField({ required: true, blank: true, initial: '' }),
      })),
      /** A chase this vehicle is pursuing: the quarry and the gap in metres. */
      chase: new fields.SchemaField({
        quarryUuid: new fields.StringField({ required: true, initial: '' }),
        metres: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      }),
      seating: new fields.StringField({ required: true, initial: '' }),
      cargo: new fields.StringField({ required: true, initial: '' }),
      /** v0.46.0: Load in kg (0 = not tracked), sensor mode, autosofts, modifications, and a jammed link. */
      load: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      /** v0.49.0: Cargo Factor (volume; 0 = not tracked). */
      cargoFactor: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      sensorMode: new fields.StringField({ required: true, initial: 'active', choices: ['active', 'passive'] }),
      /** v0.50.0: what the vehicle's sensors see with (for a jumped-in rigger and the autopilot: light, smoke, weather). */
      sensorVision: new fields.SchemaField({
        lowLight: new fields.BooleanField({ required: true, initial: false }),
        thermographic: new fields.BooleanField({ required: true, initial: false }),
      }),
      autosofts: new fields.SchemaField(Object.fromEntries(RULES.VEHICLES.autosofts.kinds.map((k) => [k, rating(0)]))),
      mods: new fields.ArrayField(new fields.SchemaField({
        id: new fields.StringField({ required: true, initial: '' }),
        name: new fields.StringField({ required: true, initial: '' }),
        kind: new fields.StringField({ required: true, initial: 'other', choices: RULES.VEHICLES.modifications.map((m) => m.id) }),
        rating: rating(1),
        cost: rating(0),
        installed: new fields.BooleanField({ required: true, initial: false }),
        /** The stat change made when it went in (taken back out on removal). */
        stat: new fields.StringField({ required: true, initial: '' }),
        delta: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      })),
      jammed: new fields.SchemaField({
        active: new fields.BooleanField({ required: true, initial: false }),
        by: new fields.StringField({ required: true, initial: '' }),
        rating: rating(0),
      }),
      /** v0.73.0 (O28): the remote link's encryption, and who has intercepted or spoofed it (RULES.DRONES_V73.link). */
      link: new fields.SchemaField({
        encryption: rating(0),
        intercepted: new fields.SchemaField({
          byUuid: new fields.StringField({ required: true, initial: '' }),
          by: new fields.StringField({ required: true, initial: '' }),
        }),
        spoofed: new fields.SchemaField({
          active: new fields.BooleanField({ required: true, initial: false }),
          byUuid: new fields.StringField({ required: true, initial: '' }),
          by: new fields.StringField({ required: true, initial: '' }),
        }),
      }),
      /** v0.73.0 (O28): weapon mount points (both 0 = not tracked; RULES.DRONES_V73.mounts). */
      firmpoints: rating(0),
      hardpoints: rating(0),
      /** Boxes of damage on the vehicle's condition track. */
      condition: rating(0),
      /** Current speed (crash damage, the over-speed modifier) and whether it is off-road. */
      currentSpeed: rating(0),
      offroad: new fields.BooleanField({ required: true, initial: false }),
      /** Who controls it: a character's UUID and the mode ('' = nobody: autopilot). */
      controllerUuid: new fields.StringField({ required: true, initial: '' }),
      controlMode: new fields.StringField({ required: true, initial: 'autopilot', choices: [...CONTROL_MODES] }),
      /** Everyone aboard (UUIDs): they take crash damage. */
      occupants: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
      /** v0.57.0: systems shot out (called shots) until repaired. */
      systems: new fields.SchemaField({
        tires: new fields.BooleanField({ required: true, initial: false }),
        sensors: new fields.BooleanField({ required: true, initial: false }),
        engine: new fields.BooleanField({ required: true, initial: false }),
      }),
      /** v0.57.0: the speed at the start of this Combat Turn (Acceleration), extra change won by pushing, and the chase position won by maneuver score. */
      speedTurn: new fields.SchemaField({
        round: new fields.NumberField({ required: true, integer: true, initial: -1 }),
        start: new fields.NumberField({ required: true, min: 0, initial: 0 }),
        extra: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      }),
      position: new fields.SchemaField({
        winnerUuid: new fields.StringField({ required: true, initial: '' }),
        loserUuid: new fields.StringField({ required: true, initial: '' }),
        tn: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        round: new fields.NumberField({ required: true, integer: true, initial: -1 }),
        /** v0.81.1 (RA2-4): the combat `round` belongs to ('' = none, or won before v0.81.1). */
        combatId: new fields.StringField({ required: true, blank: true, initial: '' }),
      }),
      /** v0.91.4: bought in the shop: cost in nuyen (0 = no price set: players can't buy it), Availability, Street Index, legality. */
      cost: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      availability: new fields.StringField({ required: true, initial: '' }),
      streetIndex: new fields.NumberField({ required: true, min: 0, initial: 1 }),
      ...legalFields(),
      notes: new fields.HTMLField({ required: true, initial: '' }),
    };
  }

  prepareDerivedData(): void {
    const sys = this as any;
    const autopilotRating = sys.drone ? sys.pilot : sys.autonav;
    const auto = autopilotStats(autopilotRating ?? 0);
    const destroyed = vehicleDestroyed(sys.condition ?? 0);
    // v0.46.0: what it carries (items with a weight, people aboard) against its Load.
    const parentItems: any[] = [...(((this as any).parent?.items) ?? [])];
    const itemsKg = parentItems.filter((i: any) => i.type !== 'weapon' || !i.system?.mount || i.system.mount === 'none')
      .reduce((n: number, i: any) => n + Math.max(0, Number(i.system?.weight ?? 0)) * Math.max(0, Number(i.system?.quantity ?? 1)), 0);
    const itemsCf = parentItems.filter((i: any) => i.type !== 'weapon' || !i.system?.mount || i.system.mount === 'none')
      .reduce((n: number, i: any) => n + Math.max(0, Number(i.system?.cf ?? 0)) * Math.max(0, Number(i.system?.quantity ?? 1)), 0);
    const people = (sys.occupants ?? []).length;
    // v0.57.0: systems shot out (called shots) until repaired.
    const working = vehicleSystemsEffect(sys.systems ?? {}, { handling: Number(sys.handling ?? 0), handlingOffroad: Number(sys.handlingOffroad ?? 0), sensor: Number(sys.sensor ?? 0), speed: Number(sys.speed ?? 0) });
    // v0.80.0 (URR_V80.vehDamageSpeed): damage lowers the Speed under the Unified Rules Revamp.
    const slowed = veh80DamagedSpeed(working.speed, Number(sys.condition ?? 0));
    if (slowed.note) { working.speed = slowed.speed; working.notes.push(slowed.note); }
    sys.derived = {
      working,
      cargo: cargoLoad({ itemsKg, people, load: Number(sys.load ?? 0), itemsCf, cargoFactor: Number(sys.cargoFactor ?? 0) }),
      // v0.73.0 (O28): how the mounted weapons fill the firmpoints and hardpoints.
      mountUsage: mountUsage(
        mountCapacity({ body: Number(sys.body ?? 0), firmpoints: Number(sys.firmpoints ?? 0), hardpoints: Number(sys.hardpoints ?? 0) } as any),
        parentItems.filter((i: any) => i.type === 'weapon').map((i: any) => ({ name: String(i.name ?? ''), mount: String(i.system?.mount ?? 'none'), mountPoint: String(i.system?.mountPoint ?? ''), antiVehicle: Boolean(i.system?.antiVehicle), guidance: Number(i.system?.guidance ?? 0) })) as any,
      ),
      // v0.71.0 (R17): a drone is built for rigging; anything else needs the rigger adaptation modification.
      adaptation: Boolean(sys.drone) || (sys.mods ?? []).some((m: any) => m.installed && m.kind === 'adaptation'),
      status: destroyed ? 'destroyed' : 'ok',
      astralMode: 'physical',
      damageModifier: vehicleDamageModifier(sys.condition ?? 0),
      conditionBoxes: RULES.VEHICLES.conditionBoxes,
      // v0.60.0: a token bar for the condition track (boxes left).
      bars: { condition: trackBar(sys.condition ?? 0, RULES.VEHICLES.conditionBoxes) ?? { value: 0, max: 0 } },
      skill: sys.skill || vehicleCategory(sys.category).skill,
      categoryLabel: vehicleCategory(sys.category).label,
      autopilotRating: autopilotRating ?? 0,
      reaction: auto.reaction,
      initiativeDice: auto.initiativeDice,
      combatPoolLeft: 0, spellPoolLeft: 0, hackingPoolLeft: 0, karmaPoolLeft: 0, taskPoolLeft: 0, controlPoolLeft: 0,
      woundModifier: 0,
      destroyed,
    };
  }
}

/**
 * A site's security network (v0.26.0): devices (cameras, sensors, maglocks, doors, alarms) tied to
 * tokens and door walls, a security tally with steps and an alert level, the response, a security
 * rigger, slaved turrets and drones (vehicle actors), and a linked Matrix host.
 */
export class SiteDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    const str = () => new fields.StringField({ required: true, initial: '' });
    return {
      devices: new fields.ArrayField(new fields.SchemaField({
        id: str(),
        name: str(),
        kind: new fields.StringField({ required: true, initial: 'camera', choices: [...RULES.SECURITY.deviceKinds] }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 4 }),
        /** Where it sees from: a token's UUID on a scene ('' = not placed). */
        tokenUuid: str(),
        /** The door wall it locks: the scene and wall ids ('' = none). */
        sceneId: str(),
        wallId: str(),
        active: new fields.BooleanField({ required: true, initial: true }),
        bypassed: new fields.BooleanField({ required: true, initial: false }),
        /** v0.43.0: a scanner device: what it detects. */
        scanKind: new fields.StringField({ required: true, blank: true, initial: '', choices: [...RULES.GEAR.scannerKinds] }),
        /** v0.46.0: what it senses with ('' = concealment ignored), and a tamper alarm's rating (0 = none). */
        sense: new fields.StringField({ required: true, blank: true, initial: '', choices: [...RULES.SECURITY.senses] }),
        tamper: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        /** v0.49.0: it identifies people (face or ID check): masks work against it. */
        identifies: new fields.BooleanField({ required: true, initial: false }),
        /** v0.57.0: a maglock's kind (RULES.SECURITY_V57.lockTypes), its casing (0 = none) and whether the casing is open. */
        lockType: new fields.StringField({ required: true, blank: true, initial: '', choices: RULES.SECURITY_V57.lockTypes.map((l) => l.id) }),
        casing: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        casingOpen: new fields.BooleanField({ required: true, initial: false }),
        notes: str(),
        /** v0.61.0: a gas device: its toxin (empty name = the default knockout gas) and radius in metres (0 = its linked regions only). */
        toxin: new fields.SchemaField({
          name: str(),
          power: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          level: new fields.StringField({ required: true, initial: 'S', choices: ['L', 'M', 'S', 'D'] }),
          damageType: new fields.StringField({ required: true, initial: 'stun', choices: ['physical', 'stun'] }),
          vector: new fields.StringField({ required: true, initial: 'inhalation', choices: [...RULES.TOXINS.vectors] }),
          speed: new fields.StringField({ required: true, initial: 'turn', choices: RULES.TOXINS.speeds.map((x) => x.id) }),
        }),
        radius: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      })),
      /** v0.49.0: the site's guards (actor UUIDs) who look for intruders. */
      guards: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
      tally: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      alert: new fields.StringField({ required: true, initial: 'none', choices: [...RULES.SECURITY.alerts] }),
      steps: new fields.ArrayField(new fields.SchemaField({
        step: new fields.NumberField({ required: true, integer: true, min: 0, initial: 3 }),
        event: str(),
        alert: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', ...RULES.SECURITY.alerts] }),
      })),
      /** When the response arrives (-1 = not called): a Combat Turn, or a world time in seconds. */
      response: new fields.SchemaField({
        round: new fields.NumberField({ required: true, integer: true, initial: -1 }),
        worldTime: new fields.NumberField({ required: true, initial: -1 }),
        arrived: new fields.BooleanField({ required: true, initial: false }),
        /** What turns up (free text, e.g. "corporate security team, 6 guards"). */
        force: str(),
        /** v0.71.0 (R6): this site's own response time (0 = the world's house rule, RULES.SECURITY.response). */
        turns: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        minutes: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      }),
      riggerUuid: str(),
      /** Turrets and drones the network controls (vehicle UUIDs). */
      slaved: new fields.ArrayField(new fields.StringField({ required: true, initial: '' })),
      hostUuid: str(),
      notes: new fields.HTMLField({ required: true, initial: '' }),
    };
  }

  prepareDerivedData(): void {
    const sys = this as any;
    const devices: any[] = sys.devices ?? [];
    sys.derived = {
      status: sys.alert, astralMode: 'physical',
      combatPoolLeft: 0, spellPoolLeft: 0, hackingPoolLeft: 0, karmaPoolLeft: 0, taskPoolLeft: 0, controlPoolLeft: 0, woundModifier: 0,
      working: devices.filter((d) => d.active && !d.bypassed).length,
      nextStep: [...(sys.steps ?? [])].filter((s: any) => s.step > sys.tally).sort((a: any, b: any) => a.step - b.step)[0] ?? null,
    };
  }
}

/**
 * v0.53.0: a safehouse. A location and a size plus chosen options (RULES.SAFEHOUSE, house rules);
 * the totals are added up by `safehouseTotals` into `derived`. Owners pay to build it and pay its
 * monthly upkeep; residents get its comfort for home care. Links to the security site, ward and host
 * actors it made.
 */
export class SafehouseDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = f();
    const str = () => new fields.StringField({ required: true, initial: '' });
    const uuids = () => new fields.ArrayField(new fields.StringField({ required: true, initial: '' }));
    return {
      location: new fields.StringField({ required: true, initial: 'residential', choices: RULES.SAFEHOUSE.locations.map((l) => l.id) }),
      size: new fields.StringField({ required: true, initial: 'apartment', choices: RULES.SAFEHOUSE.sizes.map((s) => s.id) }),
      options: new fields.ArrayField(new fields.SchemaField({
        id: str(),
        key: new fields.StringField({ required: true, initial: '' }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
        notes: str(),
      })),
      owners: uuids(),
      residents: uuids(),
      /** Nuyen paid towards building it so far. */
      buildPaid: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** Upkeep paid until this world time (-1 = never paid). */
      paidUntil: new fields.NumberField({ required: true, initial: -1 }),
      address: str(),
      notes: new fields.HTMLField({ required: true, initial: '' }),
      siteUuid: str(),
      wardUuid: str(),
      hostUuid: str(),
    };
  }

  prepareDerivedData(): void {
    const sys = this as any;
    sys.derived = safehouseTotals({ location: sys.location, size: sys.size, options: sys.options ?? [] });
    sys.derived.owed = buildOwed(sys.derived.buildCost, sys.buildPaid);
  }
}
