/**
 * v0.80.0, the "SR2E Unified Rules Revamp" rules source (area: magic). Read through RULES.URR_V80; the GM picks the
 * source in the world setting "Rules source" (settings.ts). Two exports:
 * - URR_V80_MAGIC: this area's new switches and numbers. Their shipped values are the SR2E Book Rules (the mode off),
 *   so nothing changes unless the GM picks the Unified Rules Revamp.
 * - URR80_PATCH_MAGIC: RULES paths → the value the Unified Rules Revamp uses (existing paths, or 'URR_V80.<key>').
 *   Applied under the GM's own house rules, which still win.
 * Source: the Unified Rule Revamp (URR v1.2), cited as "URR" below; a rule marked "house rule for the Revamp"
 * is not in the URR.
 *
 * The rules (Revamp way / book way = shipped / source). Functions in rules/urr80-magic.ts.
 *
 * Sorcery
 * - magCastDice: the spell success test rolls the spell's Force (+ Spell Pool, foci, totem) / the Sorcery skill.
 *   Innate casters (spirits, critters) keep their own dice. URR.
 * - magElementalTn: a ranged manipulation (elemental) spell's TN is this number / 0 = the spell's own TN field. URR (4).
 * - TN_AUTO.magic.environment (patch): visibility (light, smoke, weather) applies to every spell / elemental ones
 *   only. URR (the spellcasting modifiers list the visibility chart).
 * - magRuleOfOneDrain: a disaster (all ones) on the casting test adds this to the drain TN / 0. URR (+2).
 * - magSpellTie: a tie between the caster's and the target's successes on a damaging spell goes to the caster at
 *   Light damage / net 0 = no effect. Spells with no minimum effect still need a net success. URR.
 * - magSustainCap: at most Sorcery-rating spells sustained by the magician themselves (foci, quickened and spirit-held
 *   ones don't count): 'block' / 'off' (no limit). URR.
 * - magExclusiveForce, magFetishForce: an exclusive spell takes effect as if 2 Force higher, a fetish spell 1 higher
 *   (a reusable fetish; consumable fetishes aren't modelled), drain at the normal Force / 0 (the book: a lower drain
 *   TN instead). With them the Revamp sets SPELLCRAFT.exclusiveDrainMod and fetishDrainMod to 0. URR.
 * - magLearning: learning a spell rolls Sorcery + Magical Theory vs 2 × Force ('theory') / Sorcery vs Force. URR.
 *
 * Ritual sorcery
 * - magRitualTeamCap: no more members (leader and spotter included) than the lowest Sorcery rating among them / no
 *   limit. URR.
 * - magRitualNoCombat: combat spells can't be cast by ritual / allowed. URR.
 * - magRitualCircle: a hermetic ritual needs a hermetic circle rated at least the Force / a sorcery library. URR.
 * - magRitualMaterials, magRitualMaterialsPerForce: materials by category ('category': detection and illusion 100¥,
 *   health 500¥, manipulation 1,000¥ × Force) / MAGIC_V39.ritualStages.materialsPerForce × Force. URR.
 * - magSpotterDrain: the spotter (the URR's guide) resists the ritual's drain too / no drain. URR.
 * - magRitualResistTn: the target resists against the higher of the Force and the leader's Sorcery ('leader') /
 *   the Force. URR.
 *
 * Conjuring
 * - CONJURING.drainLevels (patch) and magConjDrain: L below half Charisma, M up to Charisma, S up to twice, D above;
 *   L and M Stun, S and D Physical (Force over Charisma) ('charisma') / L up to half, M up to Charisma, S up to 1.5 ×,
 *   D above, Physical only when Force is over Magic. URR (nature spirit drain table; applied to every summoning,
 *   as the URR's elemental section is empty).
 * - magNatureOneOnly: one nature spirit in service at a time (warned) / one per domain. URR.
 *
 * Astral
 * - magAstralReaction (×) and ASTRAL.initiativeBonus (patch): astral Reaction = 2 × Intelligence, initiative =
 *   astral Reaction + 15 + 1D6 / Intelligence + 20 + 1D6. URR.
 * - MAGIC_EXTRA.projection.hoursPerEssence (patch 0) and magProjFullHours: a projecting magician loses 1 Essence
 *   per full hour projected / none for Essence × 2 hours, then 1 per hour or part over. URR.
 * - magAstralDamage: a magician's unarmed astral attack is Charisma L, with an active weapon focus Charisma + the
 *   focus's rating M ('urr') / Charisma M, the focus adding dice only. Spirits and adepts unchanged. URR.
 * - TRACKING.baseHours (patch 12) and magTrackRating: astral tracking takes 12 h ÷ successes, −2 TN when the
 *   signature's Force is at most the tracker's Sorcery, +2 when higher / 6 h, no rating modifier. URR.
 * - magAstralDrainPhysical: drain from a spell cast while projecting is always Physical / Stun unless Force over
 *   Magic. URR (citing SR3).
 *
 * Wards and sites
 * - MAGIC_V56.ward.skill 'Sorcery', ward.nuyenPerForce 100, ward.drainLevel 'L' (patches) and magWardDrain: drain
 *   TN = Force + the successes, L Stun ('urr') / Conjuring, no materials, Force ÷ 2 M (Physical over Magic). URR.
 * - magWardMaxForce: a ward's Force is at most this × the team's combined Magic (2) / 0 = no limit. URR.
 * - magSiteCost: a library costs rating² × the per-rating price (a digital library: rating² × 100 Mp × 10¥),
 *   a hermetic circle takes hours = its rating ('urr') / price × rating, a day per rating. URR.
 *
 * Traditions
 * - magAspectedNoAstral: aspected sorcerers and conjurers have no astral perception or projection / they do. URR.
 * - magShamanistNoTotem: shamanists get no totem dice (their spells and spirits stay limited to the totem's) / they
 *   do. URR.
 * - magAdeptFoci: physical adepts can use only weapon foci / any focus. URR.
 *
 * Magic loss
 * - magLossLe: the Magic loss test loses a point on 2D6 ≤ Magic / below Magic. URR.
 */
export const URR_V80_MAGIC = {
  magCastDice: 'sorcery' as 'sorcery' | 'force',
  magElementalTn: 0 as number,
  magRuleOfOneDrain: 0 as number,
  magSpellTie: 'book' as 'book' | 'caster',
  magSustainCap: 'off' as 'off' | 'block',
  magExclusiveForce: 0 as number,
  magFetishForce: 0 as number,
  magLearning: 'book' as 'book' | 'theory',
  magRitualTeamCap: false as boolean,
  magRitualNoCombat: false as boolean,
  magRitualCircle: false as boolean,
  magRitualMaterials: 'book' as 'book' | 'category',
  /** Read only when magRitualMaterials is 'category': nuyen per Force by spell category (URR). */
  magRitualMaterialsPerForce: { detection: 100, illusion: 100, health: 500, manipulation: 1000 } as Record<string, number>,
  magSpotterDrain: false as boolean,
  magRitualResistTn: 'force' as 'force' | 'leader',
  magConjDrain: 'book' as 'book' | 'charisma',
  magNatureOneOnly: false as boolean,
  magAstralReaction: 1 as number,
  magProjFullHours: false as boolean,
  magAstralDamage: 'book' as 'book' | 'urr',
  magTrackRating: false as boolean,
  magAstralDrainPhysical: false as boolean,
  magWardDrain: 'book' as 'book' | 'urr',
  magWardMaxForce: 0 as number,
  magSiteCost: 'book' as 'book' | 'urr',
  magAspectedNoAstral: false as boolean,
  magShamanistNoTotem: false as boolean,
  magAdeptFoci: false as boolean,
  magLossLe: false as boolean,
};

export const URR80_PATCH_MAGIC: Record<string, unknown> = {
  'URR_V80.magCastDice': 'force',
  'URR_V80.magElementalTn': 4,
  'TN_AUTO.magic.environment': 'all',
  'URR_V80.magRuleOfOneDrain': 2,
  'URR_V80.magSpellTie': 'caster',
  'URR_V80.magSustainCap': 'block',
  'URR_V80.magExclusiveForce': 2,
  'URR_V80.magFetishForce': 1,
  'SPELLCRAFT.exclusiveDrainMod': 0,
  'SPELLCRAFT.fetishDrainMod': 0,
  'URR_V80.magLearning': 'theory',
  'URR_V80.magRitualTeamCap': true,
  'URR_V80.magRitualNoCombat': true,
  'URR_V80.magRitualCircle': true,
  'URR_V80.magRitualMaterials': 'category',
  'URR_V80.magSpotterDrain': true,
  'URR_V80.magRitualResistTn': 'leader',
  'CONJURING.drainLevels': [[0.5, 'L'], [1, 'M'], [2, 'S']],
  'URR_V80.magConjDrain': 'charisma',
  'URR_V80.magNatureOneOnly': true,
  'URR_V80.magAstralReaction': 2,
  'ASTRAL.initiativeBonus': 15,
  'MAGIC_EXTRA.projection.hoursPerEssence': 0,
  'URR_V80.magProjFullHours': true,
  'URR_V80.magAstralDamage': 'urr',
  'TRACKING.baseHours': 12,
  'URR_V80.magTrackRating': true,
  'URR_V80.magAstralDrainPhysical': true,
  'MAGIC_V56.ward.skill': 'Sorcery',
  'MAGIC_V56.ward.nuyenPerForce': 100,
  'MAGIC_V56.ward.drainLevel': 'L',
  'URR_V80.magWardDrain': 'urr',
  'URR_V80.magWardMaxForce': 2,
  'URR_V80.magSiteCost': 'urr',
  'URR_V80.magAspectedNoAstral': true,
  'URR_V80.magShamanistNoTotem': true,
  'URR_V80.magAdeptFoci': true,
  'URR_V80.magLossLe': true,
};
