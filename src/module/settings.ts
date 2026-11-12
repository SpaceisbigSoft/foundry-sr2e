import { HOUSE_CORE_V923 } from "./rules/config923/core.ts";
import { HOUSE_COMBAT_V923 } from "./rules/config923/combat.ts";
import { HOUSE_HEALTH_V923 } from "./rules/config923/health.ts";
import { HOUSE_SORCERY_V923 } from "./rules/config923/sorcery.ts";
import { HOUSE_SPIRITS_V923 } from "./rules/config923/spirits.ts";
import { HOUSE_MATRIX_V923 } from "./rules/config923/matrix.ts";
import { HOUSE_VEHICLES_V923 } from "./rules/config923/vehicles.ts";
import { HOUSE_GEAR_V923 } from "./rules/config923/gear.ts";
import { SYSTEM } from "./config/system.ts";
import { RULES, parseSkillWeb, setSkillWeb, PRIVACY_GROUPS, PRIVACY_MODES, SOUND_EVENTS, settingMatches, URR_V80_PATCH, RULES_SOURCES, SHOP_LIST_MODES } from "./rules/index.ts";
import type { RulesSource } from "./rules/index.ts";
import { applyDiceColours } from "./helpers/dicecolours.ts";
import { escHtml } from "./rules/html.ts";
import { safeKey } from "./rules/trust.ts";
import { isLeadGm, leadSettled } from "./applications/leader.ts";
import { t as tx, tKey, tCount } from './helpers/i18n.ts';
import { localizeRules, localizePatch, localizeTable } from "./rules/rulestext.ts";
import { TEXT_TABLES } from "./rules/texttables.ts";

/**
 * House rules (v0.23.0): selected rule values exposed in Foundry's game settings, plus an
 * "advanced" box for any other value in RULES by its path. Stored as one world setting
 * (`houseRules`: { values: {path: value}, advanced: {path: value} }) and applied to RULES at
 * load and whenever it changes. RULE_DEFAULTS keeps the shipped values for display and reset.
 */
export const RULE_DEFAULTS: any = structuredClone(RULES);

/** v0.91.0: open Add windows (shops) re-read their lists when the GM changes what players see. */
function refreshShops(): void {
  try {
    for (const app of ((foundry as any).applications?.instances?.values?.() ?? [])) if ((app as any)?.options?.classes?.includes?.("sr2e-add") || (app as any)?.options?.classes?.includes?.("sr2e-codex")) { (app as any).clearCache?.(); void (app as any).render?.(); }
  } catch { /* no windows */ }
}

export interface HouseRuleDef {
  path: string;
  /** v0.89.4: an id; its title is `SR2E.HouseRules.Section.<id>` (houseRuleSection). The label's key comes from the path. */
  section: string;
  type: "number" | "boolean" | "select";
  choices?: string[];
  step?: number;
}

/** v0.89.4: a house rule's label key: `SR2E.HouseRules.Rule.<path, dots as __>` (scripts/i18n-houserules.mjs). */
export const houseRuleKey = (path: string): string => `SR2E.HouseRules.Rule.${path.replace(/\./g, "__")}`;
/** A house rule's label, in the reader's language. */
export const houseRuleLabel = (d: { path: string }): string => tKey(houseRuleKey(d.path));
/** A house-rules section's title, in the reader's language. */
export const houseRuleSection = (id: string): string => tKey(`SR2E.HouseRules.Section.${id}`);

export const HOUSE_RULES: HouseRuleDef[] = [
  // Tests and dice
  { section: "testsAndDice", path: "MIN_TARGET_NUMBER", type: "number" },
  { section: "testsAndDice", path: "ATTRIBUTE_DEFAULT_TN_MOD", type: "number" },
  { section: "testsAndDice", path: "SKILL_DEFAULT_TN_MOD", type: "number" },
  { section: "testsAndDice", path: "WOUNDS_CUMULATIVE", type: "boolean" },
  { section: "testsAndDice", path: "KARMA.escalating", type: "boolean" },
  { section: "testsAndDice", path: "KARMA.firstRerollCost", type: "number" },
  // Characters
  { section: "characters", path: "METATYPES.enforce", type: "select", choices: ["warn", "clamp"] },
  { section: "characters", path: "METATYPES.augmentedMultiplier", type: "number", step: 0.1 },
  { section: "characters", path: "MAGIC_CAPPED_BY_ESSENCE", type: "boolean" },
  { section: "characters", path: "MAGIC_ESSENCE_MODE", type: "select", choices: ["cap", "reduce"] },
  { section: "characters", path: "CYBERWARE.stacking.maxInitiativeDice", type: "number" },
  { section: "characters", path: "CYBERWARE.stacking.adeptExclusive", type: "boolean" },
  { section: "characters", path: "CYBERWARE.smartlink.2", type: "number" },
  { section: "characters", path: "CYBERWARE.datajack.decking", type: "select", choices: ["off", "warn", "block"] },
  { section: "characters", path: "CYBERWARE.datajack.rigging", type: "select", choices: ["off", "warn", "block"] },
  { section: "characters", path: "CYBERWARE.flareCompensation.blocksFlash", type: "boolean" },
  { section: "characters", path: "BIOWARE.bodyIndex.healingTnPerPoint", type: "number", step: 0.25 },
  { section: "characters", path: "BIOWARE.surgery.daysPerPoint", type: "number" },
  { section: "characters", path: "BIOWARE.adrenalCrash.tn", type: "number" },
  { section: "characters", path: "BIOWARE.cultured.costMultiplier", type: "number" },
  { section: "characters", path: "STATUSES.blind.attackTn", type: "number" },
  { section: "characters", path: "STATUSES.blind.otherTn", type: "number" },
  { section: "characters", path: "STATUSES.blind.flashTurns", type: "number" },
  { section: "characters", path: "HAZARDS.falling.powerPerMetre", type: "number", step: 0.5 },
  { section: "characters", path: "TOXINS.resistAttribute", type: "select", choices: ["body", "willpower"] },
  { section: "rangedCombat", path: "STUN_WEAPONS.armorMultiplier", type: "number", step: 0.1 },
  { section: "characters", path: "COMBAT.encumbrance.enabled", type: "boolean" },
  { section: "characters", path: "CONDITIONS.blockActions", type: "boolean" },
  { section: "characters", path: "CONDITIONS.skipInCombat", type: "boolean" },
  { section: "characters", path: "CONDITIONS.dropSustained", type: "boolean" },
  { section: "characters", path: "STATUSES.deaf.hearingTn", type: "number" },
  { section: "characters", path: "STATUSES.paralysis.blocksActions", type: "boolean" },
  { section: "characters", path: "TOKENS.statusList", type: "select", choices: ["sr2", "all"] },
  { section: "characters", path: "TOKENS.stateIcons", type: "boolean" },
  { section: "characters", path: "CONDITIONS.dumpWhenDown", type: "boolean" },
  { section: "characters", path: "SPIRITS_V59.disruptOn", type: "select", choices: ["physical", "either"] },
  { section: "characters", path: "HEALING.firstAid.windowHours", type: "number", step: 0.5 },
  { section: "characters", path: "HEALING.firstAid.maxFraction", type: "number", step: 0.1 },
  { section: "characters", path: "HEALTH.addiction.auto", type: "boolean" },
  { section: "characters", path: "HEALTH.addiction.withdrawalHours", type: "number" },
  { section: "characters", path: "HEALTH.addiction.withdrawalTn", type: "number" },
  { section: "characters", path: "HEALTH.addiction.kickDays", type: "number" },
  { section: "characters", path: "HEALTH.addiction.dosesPerPoint", type: "number" },
  { section: "characters", path: "HEALTH.disease.recoveries", type: "number" },
  { section: "characters", path: "HEALTH.disease.treatmentDice", type: "number" },
  { section: "characters", path: "HEALTH.careCosts.hospital", type: "number" },
  { section: "characters", path: "HEALTH.careCosts.intensive", type: "number" },
  { section: "characters", path: "HEALTH.suffocation.tn", type: "number" },
  // Gear (v0.43.0)
  { section: "gear", path: "GEAR.concealment.friskTn", type: "number" },
  { section: "gear", path: "GEAR.concealment.defaultTn", type: "number" },
  { section: "gear", path: "GEAR.concealment.weaponFindsCyberweapons", type: "boolean" },
  { section: "gear", path: "GEAR.accessories.laserNotWithSmartlink", type: "boolean" },
  { section: "gear", path: "GEAR.accessories.scopeStacks", type: "boolean" },
  { section: "gear", path: "GEAR.accessories.support.bipod", type: "number" },
  { section: "gear", path: "GEAR.accessories.support.tripod", type: "number" },
  { section: "gear", path: "GEAR.accessories.shockPad", type: "number" },
  { section: "gear", path: "GEAR.accessories.proneIsSetUp", type: "boolean" },
  { section: "gear", path: "GEAR.shields.parryAs", type: "select", choices: ["dice", "tn"] },
  { section: "gear", path: "GEAR.grenades.airburst.scatterFactor", type: "number", step: 0.1 },
  { section: "gear", path: "GEAR.grenades.smart.metresPerSuccess", type: "number" },
  { section: "gear", path: "GEAR.grenades.bounce.tn", type: "number" },
  { section: "gear", path: "GEAR.grenades.bounce.extraDice", type: "number" },
  { section: "gear", path: "GEAR.cyberDamage.mode", type: "select", choices: ["button", "auto", "off"] },
  // v0.47.0
  { section: "gear", path: "GEAR.cyberDamage.nonAttack", type: "boolean" },
  { section: "gear", path: "GEAR.concealment.groupTnPerPerson", type: "number" },
  { section: "gear", path: "GEAR.accessories.laserRangeMetres", type: "number" },
  { section: "gear", path: "GEAR.accessories.scopeVision", type: "boolean" },
  { section: "gear", path: "GEAR.shields.ranged", type: "select", choices: ["dice", "off"] },
  { section: "gear", path: "GEAR.spellsVsObjects.tns.natural", type: "number" },
  { section: "gear", path: "GEAR.spellsVsObjects.tns.lowTech", type: "number" },
  { section: "gear", path: "GEAR.spellsVsObjects.tns.highTech", type: "number" },
  { section: "gear", path: "GEAR.spellsVsObjects.tns.processed", type: "number" },
  { section: "gear", path: "GEAR.spellsVsObjects.powerPerSuccess", type: "number" },
  { section: "gear", path: "GEAR.disarm.baseTn", type: "number" },
  { section: "gear", path: "GEAR.disarm.tnPerSetterSuccess", type: "number" },
  { section: "gear", path: "GEAR.disarm.disasterBlows", type: "boolean" },
  { section: "gear", path: "GEAR.cyberDamage.atLevel", type: "select", choices: ["L", "M", "S", "D"] },
  { section: "gear", path: "GEAR.cyberDamage.chance", type: "number" },
  { section: "gear", path: "GEAR.cyberDamage.calledChance", type: "number" },
  { section: "gear", path: "GEAR.cyberlimbs.quickness", type: "boolean" },
  { section: "gear", path: "GEAR.cyberlimbs.armorCalledOnly", type: "boolean" },
  { section: "magicAndTheMatrix", path: "GEAR.spellsVsVehicles.manaAffects", type: "boolean" },
  { section: "magicAndTheMatrix", path: "GEAR.spellsVsVehicles.objectResistance", type: "number" },
  { section: "magicAndTheMatrix", path: "GEAR.spellsVsVehicles.combatArmor", type: "boolean" },
  { section: "magicAndTheMatrix", path: "GEAR.spellsVsVehicles.antiVehicle", type: "boolean" },
  // Characters and the street (v0.44.0)
  { section: "street", path: "STREET.builder.magicRating", type: "number" },
  { section: "street", path: "STREET.builder.lifestyleMonths", type: "number" },
  { section: "street", path: "STREET.builder.contacts.count", type: "number" },
  { section: "street", path: "STREET.builder.contacts.level", type: "number" },
  { section: "street", path: "STREET.qualities.enabled", type: "boolean" },
  { section: "street", path: "STREET.qualities.maxEdges", type: "number" },
  { section: "street", path: "STREET.qualities.maxFlaws", type: "number" },
  { section: "street", path: "STREET.qualities.balance", type: "boolean" },
  { section: "street", path: "STREET.reputation.enabled", type: "boolean" },
  { section: "street", path: "STREET.reputation.autoCred", type: "boolean" },
  { section: "street", path: "STREET.reputation.credPerKarma", type: "number" },
  { section: "street", path: "STREET.reputation.socialTnPerCred", type: "number", step: 0.25 },
  { section: "street", path: "STREET.threat.addsToPool", type: "boolean" },
  { section: "street", path: "STREET.tests.complementary.successesPerDie", type: "number" },
  { section: "street", path: "STREET.tests.teamwork.cap", type: "select", choices: ["rating", "none"] },
  { section: "street", path: "STREET.athletics.metresPerSuccess", type: "number" },
  { section: "street", path: "STREET.athletics.jump.metresPerSuccess", type: "number", step: 0.5 },
  { section: "street", path: "STREET.rally.tn", type: "number" },
  { section: "street", path: "STREET.rally.tnPerCasualty", type: "number" },
  { section: "street", path: "STREET.contacts.nuyenPerDie", type: "number" },
  { section: "street", path: "STREET.haggle.sellerDice", type: "number" },
  { section: "street", path: "STREET.haggle.percentPerNet", type: "number" },
  { section: "street", path: "STREET.haggle.maxPercent", type: "number" },
  { section: "street", path: "STREET.fence.basePercent", type: "number" },
  { section: "street", path: "STREET.fence.percentPerNet", type: "number" },
  { section: "street", path: "STREET.fence.maxPercent", type: "number" },
  // v0.45.0: magic, critters, implants, fire
  { section: "magicAndCritters", path: "OCCULT.metamagic.cleansing.tnPerPoint", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.metamagic.cleansing.successesPerPoint", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.metamagic.cleansing.signaturesNeedTechnique", type: "boolean" },
  { section: "magicAndCritters", path: "OCCULT.metamagic.divining.tnPerWeek", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.metamagic.invoking.attributeBonus", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.metamagic.invoking.powerBonus", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.metamagic.invoking.drainForceBonus", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.metamagic.reflecting.needsSpellDefense", type: "boolean" },
  { section: "magicAndCritters", path: "OCCULT.initiation.multipliers.self", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.initiation.multipliers.group", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.initiation.ordealReduction", type: "number", step: 0.5 },
  { section: "magicAndCritters", path: "OCCULT.initiation.site", type: "select", choices: ["off", "warn", "block"] },
  { section: "magicAndCritters", path: "OCCULT.design.daysPerForce", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.groups.shareSites", type: "boolean" },
  { section: "magicAndCritters", path: "OCCULT.groups.grimoire", type: "boolean" },
  { section: "magicAndCritters", path: "OCCULT.traditions.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "OCCULT.ritualNotice.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "OCCULT.ritualNotice.tn", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.powers.maxPerSuccess", type: "number" },
  { section: "magicAndCritters", path: "CRITTERS.diet.hungerDays", type: "number" },
  { section: "magicAndCritters", path: "CRITTERS.diet.hungerTn", type: "number" },
  { section: "magicAndCritters", path: "FIRE.fromHits", type: "boolean" },
  { section: "magicAndCritters", path: "FIRE.maxRadius", type: "number" },
  { section: "magicAndCritters", path: "FIRE.turns", type: "number" },
  // v0.48.0: health, magic and critters leftovers
  { section: "magicAndCritters", path: "OCCULT.metamagic.reflecting.powers", type: "boolean" },
  { section: "magicAndCritters", path: "OCCULT.metamagic.possessing.skills", type: "select", choices: ["possessor", "body", "best", "split"] },
  { section: "magicAndCritters", path: "OCCULT.initiation.deed.gmConfirms", type: "boolean" },
  { section: "magicAndCritters", path: "OCCULT.initiation.familiar.needsAlly", type: "select", choices: ["off", "warn", "block"] },
  { section: "magicAndCritters", path: "OCCULT.initiation.meditation.tn", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.initiation.oath.needsGroup", type: "boolean" },
  { section: "magicAndCritters", path: "OCCULT.initiation.thesis.tn", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.ally.minGrade", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.ally.maxForce", type: "select", choices: ["magic", "grade"] },
  { section: "magicAndCritters", path: "OCCULT.ally.karmaPerForce", type: "number" },
  { section: "magicAndCritters", path: "OCCULT.ally.nuyenPerForce", type: "number" },
  { section: "magicAndCritters", path: "CRITTERS.infection.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "CRITTERS.infection.incubationHours", type: "number" },
  { section: "magicAndCritters", path: "FIRE.walls.block", type: "boolean" },
  { section: "magicAndCritters", path: "FIRE.fuel.spreads", type: "boolean" },
  { section: "magicAndCritters", path: "FIRE.smoke.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "FIRE.smoke.extraMetres", type: "number" },
  { section: "magicAndCritters", path: "FIRE.smoke.lingerTurns", type: "number" },
  { section: "magicAndCritters", path: "FIRE.smoke.inhalation.enabled", type: "boolean" },
  { section: "characters", path: "HEALTH.contagion.enabled", type: "boolean" },
  { section: "characters", path: "HEALTH.contagion.radiusMetres", type: "number" },
  { section: "characters", path: "HEALTH.contagion.duringIncubation", type: "boolean" },
  { section: "characters", path: "HEALTH.radiationSickness.enabled", type: "boolean" },
  { section: "characters", path: "HEALTH.radiationSickness.decayPerDay", type: "number" },
  { section: "characters", path: "HEALTH.weatherOn.driving", type: "boolean" },
  { section: "characters", path: "HEALTH.weatherOn.movement", type: "boolean" },
  { section: "characters", path: "BIOWARE.recovery.care.none", type: "number", step: 0.25 },
  { section: "characters", path: "BIOWARE.recovery.care.hospital", type: "number", step: 0.25 },
  { section: "characters", path: "BIOWARE.recovery.care.intensive", type: "number", step: 0.25 },
  { section: "characters", path: "BIOWARE.recovery.homePerTn", type: "number", step: 0.05 },
  { section: "characters", path: "BIOWARE.recovery.inactive", type: "boolean" },
  { section: "characters", path: "BIOWARE.recovery.tn", type: "number" },
  { section: "characters", path: "BIOWARE.rejection.enabled", type: "boolean" },
  { section: "characters", path: "BIOWARE.rejection.intervalDays", type: "number" },
  { section: "characters", path: "CYBERWARE.chips.enforce", type: "select", choices: ["off", "warn", "block"] },
  { section: "characters", path: "CYBERWARE.encephalon.dicePerRating", type: "number" },
  // Initiative and actions
  { section: "initiativeAndActions", path: "ACTIONS.enforce", type: "select", choices: ["off", "warn", "block"] },
  { section: "initiativeAndActions", path: "INITIATIVE_PASS_DECREMENT", type: "number" },
  { section: "initiativeAndActions", path: "SURPRISE.tn", type: "number" },
  { section: "initiativeAndActions", path: "SURPRISE.losesPasses", type: "number" },
  { section: "initiativeAndActions", path: "COMBAT.fullDefense.initiativeCost", type: "number" },
  // Ranged combat
  { section: "rangedCombat", path: "RANGE_TN.short", type: "number" },
  { section: "rangedCombat", path: "RANGE_TN.medium", type: "number" },
  { section: "rangedCombat", path: "RANGE_TN.long", type: "number" },
  { section: "rangedCombat", path: "RANGE_TN.extreme", type: "number" },
  { section: "rangedCombat", path: "DISTANCE.beyondExtreme", type: "select", choices: ["block", "warn"] },
  { section: "rangedCombat", path: "DISTANCE.useElevation", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT.heavyRecoilMultiplier", type: "number" },
  { section: "rangedCombat", path: "FIRING.burst.power", type: "number" },
  { section: "rangedCombat", path: "FIRING.fullAuto.powerPerRound", type: "number" },
  { section: "rangedCombat", path: "COMBAT.spreadFire.wastedRoundsPerMetre", type: "number" },
  { section: "rangedCombat", path: "COMBAT.cover.autoDetect", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT.light.useLightSources", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT.blast.dodge", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT.scatter.metresPerSuccess", type: "number" },
  { section: "rangedCombat", path: "COMBAT.scatter.diagram", type: "select", choices: ["throw", "compass"] },
  { section: "rangedCombat", path: "COMBAT.cover.from", type: "select", choices: ["token", "centre"] },
  { section: "rangedCombat", path: "COMBAT.confined.enabled", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT.confined.mode", type: "select", choices: ["nearest", "average"] },
  { section: "rangedCombat", path: "COMBAT.confined.bonus", type: "number", step: 0.1 },
  { section: "rangedCombat", path: "COMBAT.confined.rays", type: "number" },
  { section: "rangedCombat", path: "COMBAT.wallsBlock", type: "boolean" },
  // Melee
  { section: "melee", path: "MELEE_BASE_TN", type: "number" },
  { section: "melee", path: "COMBAT.melee.opposed", type: "boolean" },
  { section: "melee", path: "COMBAT.melee.defaultAttribute", type: "select", choices: ["linked", "quickness", "strength"] },
  { section: "melee", path: "COMBAT.melee.counterattack", type: "boolean" },
  { section: "melee", path: "COMBAT.melee.tie", type: "select", choices: ["none", "attacker", "defender"] },
  { section: "melee", path: "COMBAT.melee.reachTnPerPoint", type: "number" },
  { section: "melee", path: "COMBAT.reach.appliesTo", type: "select", choices: ["longer", "defender"] },
  { section: "melee", path: "DISTANCE.outOfReach", type: "select", choices: ["block", "warn"] },
  { section: "melee", path: "COMBAT.knockdown.enabled", type: "boolean" },
  { section: "melee", path: "COMBAT.knockdown.trigger", type: "select", choices: ["powerOverBody", "serious"] },
  // Magic and the Matrix
  { section: "magicAndTheMatrix", path: "MAGIC.sustainedTnMod", type: "number" },
  { section: "magicAndTheMatrix", path: "SPELLCRAFT.backgroundCount.affectsDrain", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MAGIC_LOSS.enabled", type: "boolean" },
  // v0.39.0: the rest of magic.
  { section: "magicAndTheMatrix", path: "MAGIC_V39.sustainLimit.hoursPerForce", type: "number" },
  { section: "magicAndTheMatrix", path: "MAGIC_V39.shock.initiativeLoss", type: "number" },
  { section: "magicAndTheMatrix", path: "MAGIC_V39.domains.enforce", type: "select", choices: ["off", "warn", "block"] },
  { section: "magicAndTheMatrix", path: "MAGIC_V39.addiction.tnFrom", type: "select", choices: ["total", "excess"] },
  { section: "magicAndTheMatrix", path: "MAGIC_V39.addiction.withdrawalTn", type: "number" },
  { section: "magicAndTheMatrix", path: "MAGIC_V39.sites.enforce", type: "select", choices: ["off", "warn", "block"] },
  { section: "magicAndTheMatrix", path: "MAGIC_V39.ritualStages.enabled", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MAGIC_V39.ritualStages.materialsPerForce", type: "number" },
  { section: "magicAndTheMatrix", path: "MAGIC_V39.ritualStages.waitForPrep", type: "select", choices: ["off", "warn", "block"] },
  { section: "magicAndTheMatrix", path: "MAGIC_V39.cleaning.hoursPerSuccess", type: "number" },
  { section: "magicAndTheMatrix", path: "MAGIC_V39.perceiving.allTests", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MAGIC_V39.background.aspected", type: "select", choices: ["bonus", "ignore", "penalty"] },
  { section: "magicAndTheMatrix", path: "MAGIC_V39.background.toxicAffectsDrain", type: "boolean" },
  { section: "magicAndTheMatrix", path: "CRITTERS.vulnerability.stageUp", type: "number" },
  { section: "magicAndTheMatrix", path: "CRITTERS.essenceLoss.days", type: "number" },
  { section: "magicAndTheMatrix", path: "CRITTERS.essenceDrain.maxEssence", type: "number" },
  { section: "magicAndTheMatrix", path: "CRITTERS.regeneration.boxesPerTurn", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.hackingPoolDivisor", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.dumpShockTn", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.defense.persona", type: "select", choices: ["pool", "none"] },
  { section: "magicAndTheMatrix", path: "MATRIX.defense.ic", type: "select", choices: ["none", "rating"] },
  { section: "magicAndTheMatrix", path: "MATRIX.trace.baseTurns", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.attributeDamage.successesPerPoint", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.mpcpDamage.successesPerPoint", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.tar.tarBabyDerezzes", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.medic.degrades", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.trace.burnMpcp", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.grid.enforcePath", type: "select", choices: ["warn", "block"] },
  { section: "magicAndTheMatrix", path: "MATRIX.sim.hot.initiativeDice", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.sim.hot.dumpShockType", type: "select", choices: ["physical", "stun"] },
  { section: "magicAndTheMatrix", path: "MATRIX.sim.cold.coldBlackIcStun", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.frames.smartPoolPerRating", type: "number", step: 0.1 },
  { section: "magicAndTheMatrix", path: "MATRIX.movingVehicle", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.psychotropic.cyberphobiaTn", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.psychotropic.daysPerRating", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.psychotropic.shieldDice", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.utilities.armor.degradesPerHit", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.utilities.shield.degradesPerHit", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.utilities.mirrors.tnPerRating", type: "number", step: 0.25 },
  { section: "magicAndTheMatrix", path: "MATRIX.utilities.smoke.tnPerRating", type: "number", step: 0.25 },
  { section: "magicAndTheMatrix", path: "MATRIX.utilities.smoke.turnsPerRating", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.carry.carryPerRating", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.carry.ownerUtilities", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.agents.poolPerRating", type: "number", step: 0.1 },
  { section: "magicAndTheMatrix", path: "MATRIX.agents.ownDetection", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.travel.turnsPerHop", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.travel.blockInTransit", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.security.noDetection", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.security.spotAlert", type: "select", choices: ["none", "passive", "active"] },
  { section: "magicAndTheMatrix", path: "MATRIX.security.traceMode", type: "select", choices: ["report", "dump", "burn"] },
  { section: "magicAndTheMatrix", path: "MATRIX.security.legitTn", type: "number" },
  // v0.46.0
  { section: "magicAndTheMatrix", path: "MATRIX.party.sharedInitiative", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.construct.maxComponents", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.numbers.dialAnywhere", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.agentSearch.stopOnFind", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.agentSearch.maxHosts", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.programming.daysPerMp", type: "number", step: 0.1 },
  { section: "magicAndTheMatrix", path: "MATRIX.programming.tnMod", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.tortoise.hackingPool", type: "number", step: 0.25 },
  { section: "magicAndTheMatrix", path: "MATRIX.tortoise.immuneToBlackIc", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.tortoise.dumpShock", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.tortoise.tn", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.iccm.blackIcStun", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.iccm.dicePerRating", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.otaku.enabled", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.otaku.initiativeDice", type: "number" },
  { section: "magicAndTheMatrix", path: "SIGNAL.farTn", type: "number" },
  { section: "magicAndTheMatrix", path: "SIGNAL.outOfRange", type: "select", choices: ["warn", "block"] },
  // Vehicles and rigging
  { section: "vehiclesAndRigging", path: "VEHICLES.damageTnMods", type: "boolean" },
  { section: "vehiclesAndRigging", path: "VEHICLES.defaultAttribute", type: "select", choices: ["reaction", "quickness", "intelligence"] },
  { section: "vehiclesAndRigging", path: "VEHICLES.damage.armorStops", type: "boolean" },
  { section: "vehiclesAndRigging", path: "VEHICLES.damage.normalWeapons.powerMultiplier", type: "number", step: 0.1 },
  { section: "vehiclesAndRigging", path: "VEHICLES.damage.normalWeapons.levelDrop", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.crash.speedPerPower", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.autopilot.reactionPerRating", type: "number" },
  { section: "vehiclesAndRigging", path: "RIGGING.vcr.reactionPerLevel", type: "number" },
  { section: "vehiclesAndRigging", path: "RIGGING.vcr.initiativeDicePerLevel", type: "number" },
  { section: "vehiclesAndRigging", path: "RIGGING.vcr.tnPerLevel", type: "number" },
  { section: "vehiclesAndRigging", path: "RIGGING.cyberReflexesWhileRigging", type: "boolean" },
  { section: "vehiclesAndRigging", path: "RIGGING.controlPool.from", type: "select", choices: ["rigReaction", "reaction"] },
  { section: "vehiclesAndRigging", path: "RIGGING.feedback.enabled", type: "boolean" },
  { section: "vehiclesAndRigging", path: "RIGGING.dumpShock.tn", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.mountedIgnoreRecoil", type: "boolean" },
  { section: "vehiclesAndRigging", path: "VEHICLES.firing.moving", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.firing.fast", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.firing.targetMoving", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.sensorLock.tn", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.passengers.enabled", type: "boolean" },
  { section: "vehiclesAndRigging", path: "VEHICLES.chase.metresPerNet", type: "number" },
  { section: "vehiclesAndRigging", path: "RIGGING.remote.needsRcd", type: "boolean" },
  { section: "vehiclesAndRigging", path: "RIGGING.remote.dronesPerRating", type: "number" },
  // v0.46.0
  { section: "vehiclesAndRigging", path: "VEHICLES.chase.moveTokens", type: "boolean" },
  { section: "vehiclesAndRigging", path: "VEHICLES.sensorModes.passiveTn", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.sensorModes.passiveHidden", type: "boolean" },
  { section: "vehiclesAndRigging", path: "VEHICLES.arcs.degrees", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.arcs.facingOffset", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.arcs.enforce", type: "select", choices: ["off", "warn", "block"] },
  { section: "vehiclesAndRigging", path: "VEHICLES.cargo.personKg", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.cargo.overloadTn", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.autosofts.capAtPilot", type: "boolean" },
  { section: "vehiclesAndRigging", path: "RIGGING.jamming.eccmAddsTn", type: "boolean" },
  { section: "vehiclesAndRigging", path: "RIGGING.jamming.dumpShock", type: "boolean" },
  { section: "vehiclesAndRigging", path: "RIGGING.needsAdaptation", type: "boolean" },
  // Building security
  { section: "buildingSecurity", path: "SECURITY.detection.tallyPerNet", type: "number" },
  // v0.46.0
  { section: "buildingSecurity", path: "SECURITY.tamper.tnFrom", type: "select", choices: ["skill", "fixed"] },
  { section: "buildingSecurity", path: "SECURITY.tamper.fixedTn", type: "number" },
  { section: "buildingSecurity", path: "SECURITY.tamper.tally", type: "number" },
  { section: "buildingSecurity", path: "SECURITY.tamper.alert", type: "select", choices: ["", "passive", "active", "lockdown"] },
  { section: "buildingSecurity", path: "SECURITY.bypassTime.secondsPerTurn", type: "number" },
  { section: "buildingSecurity", path: "SECURITY.detection.detectedAlert", type: "select", choices: ["", "passive", "active", "lockdown"] },
  { section: "buildingSecurity", path: "SECURITY.bypass.failTally", type: "number" },
  { section: "buildingSecurity", path: "SECURITY.bypass.disasterAlert", type: "select", choices: ["", "passive", "active", "lockdown"] },
  { section: "buildingSecurity", path: "SECURITY.bypass.unlocksDoor", type: "boolean" },
  { section: "buildingSecurity", path: "SECURITY.response.turns", type: "number" },
  { section: "buildingSecurity", path: "SECURITY.response.minutes", type: "number" },
  { section: "buildingSecurity", path: "SECURITY.lockdownLocksDoors", type: "boolean" },
  { section: "buildingSecurity", path: "SECURITY.riggerNeedsVcr", type: "boolean" },
  // v0.49.0: street, Matrix, rigging and security leftovers
  { section: "street", path: "STREET.qualities.karma.edgePerPoint", type: "number" },
  { section: "street", path: "STREET.qualities.karma.flawPerPoint", type: "number" },
  { section: "street", path: "STREET.contacts.ownDice", type: "select", choices: ["best", "add", "instead", "off"] },
  { section: "street", path: "STREET.contacts.favourDice", type: "number" },
  { section: "street", path: "STREET.contacts.favourWaivesFee", type: "boolean" },
  { section: "street", path: "STREET.contacts.maxFavours", type: "number" },
  { section: "street", path: "STREET.heat.enabled", type: "boolean" },
  { section: "street", path: "STREET.heat.coolDays", type: "number" },
  { section: "street", path: "STREET.heat.percentPerPoint", type: "number" },
  { section: "street", path: "STREET.heat.refuseAbove", type: "number" },
  { section: "street", path: "STREET.heat.traceRoll", type: "boolean" },
  { section: "street", path: "STREET.heat.traceTn", type: "number" },
  { section: "characters", path: "MORALE.mixed", type: "select", choices: ["highest", "average", "lowest", "leader"] },
  { section: "upkeep", path: "UPKEEP.effects.overdue", type: "select", choices: ["prompt", "auto", "off"] },
  { section: "upkeep", path: "UPKEEP.effects.graceDays", type: "number" },
  { section: "upkeep", path: "UPKEEP.effects.availabilityTn.street", type: "number" },
  { section: "upkeep", path: "UPKEEP.effects.availabilityTn.squatter", type: "number" },
  { section: "upkeep", path: "UPKEEP.effects.availabilityTn.high", type: "number" },
  { section: "upkeep", path: "UPKEEP.effects.availabilityTn.luxury", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.otaku.channels.mode", type: "select", choices: ["utility", "dice"] },
  { section: "magicAndTheMatrix", path: "MATRIX.otaku.channels.karmaPerRating", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.otaku.complexForms.karmaPerRating", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX.otaku.complexForms.noMemory", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.programming.suites.mode", type: "select", choices: ["dice", "tn"] },
  { section: "magicAndTheMatrix", path: "MATRIX.programming.suites.capAtSkill", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.programming.suites.deckBuilding", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX.deckBuilding.daysPerMp", type: "number", step: 0.25 },
  { section: "magicAndTheMatrix", path: "RIGGING.jamming.onDecker", type: "select", choices: ["dump", "block"] },
  { section: "vehiclesAndRigging", path: "VEHICLES.turrets.traverse", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.turrets.overTraverse", type: "select", choices: ["tn", "block", "off"] },
  { section: "vehiclesAndRigging", path: "VEHICLES.turrets.tnPerStep", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.turrets.enforceLimit", type: "select", choices: ["off", "warn", "block"] },
  { section: "vehiclesAndRigging", path: "VEHICLES.install.tn", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.install.tnPerRating", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.install.hoursPerRating", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES.install.required", type: "boolean" },
  { section: "vehiclesAndRigging", path: "VEHICLES.cargo.personCf", type: "number", step: 0.5 },
  { section: "buildingSecurity", path: "SECURITY.guards.tallyPerGuard", type: "number" },
  { section: "buildingSecurity", path: "SECURITY.guards.alert", type: "select", choices: ["", "passive", "active", "lockdown"] },
  { section: "buildingSecurity", path: "SECURITY.tamper.onBreach", type: "boolean" },
  { section: "buildingSecurity", path: "SECURITY.tamper.onForce", type: "boolean" },
  { section: "buildingSecurity", path: "SECURITY.tamper.deadTally", type: "number" },
  { section: "buildingSecurity", path: "SECURITY.identity.physicalMask", type: "number" },
  { section: "characters", path: "PERCEPTION.noStealthTn", type: "number" },
  { section: "characters", path: "MORALE.tn", type: "number" },
  { section: "characters", path: "MORALE.tnPerCasualty", type: "number" },
  { section: "characters", path: "MORALE.onCasualty", type: "boolean" },
  { section: "upkeep", path: "UPKEEP.karma.poolEvery.human", type: "number" },
  { section: "upkeep", path: "UPKEEP.karma.poolEvery.metahuman", type: "number" },
  { section: "upkeep", path: "UPKEEP.karma.diverts", type: "boolean" },
  { section: "upkeep", path: "UPKEEP.karma.attributeMultiplier", type: "number", step: 0.5 },
  { section: "upkeep", path: "UPKEEP.karma.specializationFraction", type: "number", step: 0.25 },
  { section: "upkeep", path: "UPKEEP.contacts.tnPerLevel", type: "number" },
  { section: "upkeep", path: "UPKEEP.monthDays", type: "number" },
  { section: "testsAndDice", path: "KARMA.refresh", type: "select", choices: ["manual", "session", "combat"] },
  { section: "testsAndDice", path: "KARMA.buyCost", type: "number" },
  { section: "testsAndDice", path: "KARMA.buyPermanent", type: "boolean" },
  { section: "testsAndDice", path: "KARMA.buyNeedsSuccess", type: "boolean" },
  { section: "testsAndDice", path: "DISASTERS.prompt", type: "boolean" },
  { section: "initiativeAndActions", path: "DELAY.lostAtPassEnd", type: "boolean" },
  { section: "tokens", path: "TOKENS.autoVision", type: "boolean" },
  { section: "tokens", path: "TOKENS.vision.lowLight.mode", type: "select", choices: ["lightAmplification", "basic", "darkvision", "monochromatic"] },
  { section: "tokens", path: "TOKENS.vision.thermographic.mode", type: "select", choices: ["darkvision", "lightAmplification", "monochromatic", "basic"] },
  { section: "tokens", path: "TOKENS.vision.thermographic.range", type: "number" },
  { section: "tokens", path: "TOKENS.vision.ultrasound.range", type: "number" },
  { section: "tokens", path: "TOKENS.bars", type: "boolean" },
  { section: "tokens", path: "TOKENS.woundIcons", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT.armorLayering", type: "select", choices: ["highest", "sum", "highestPlusHalf"] },
  { section: "rangedCombat", path: "COMBAT.armorDegrade.enabled", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT.armorDegrade.atLevel", type: "select", choices: ["L", "M", "S", "D"] },
  { section: "characters", path: "COMBAT.load.enabled", type: "boolean" },
  { section: "characters", path: "COMBAT.load.kgPerStrength", type: "number" },
  { section: "rangedCombat", path: "COMBAT.silencer.perceptionTn", type: "number" },
  { section: "rangedCombat", path: "COMBAT.tracer.tnPerBurst", type: "number" },
  { section: "rangedCombat", path: "COMBAT.throwBack.enabled", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT.throwBack.tn", type: "number" },
  { section: "rangedCombat", path: "COMBAT.stopAtWalls", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT.demolitions.tn", type: "number" },
  { section: "rangedCombat", path: "COMBAT.barriers.avMultiplier", type: "number" },
  { section: "characters", path: "SKILLS.concentrationFraction", type: "number", step: 0.25 },
  { section: "characters", path: "SKILLS.web.perStep", type: "number" },
  { section: "characters", path: "SKILLS.web.maxSteps", type: "number" },
  { section: "characters", path: "SKILLS.web.unlinked", type: "select", choices: ["flat", "attribute"] },
  { section: "melee", path: "SKILLS.parry", type: "boolean" },
  { section: "vehiclesAndRigging", path: "SKILLS.vehicleRepair.tn", type: "number" },
  { section: "characters", path: "CREATION.attributeMax", type: "number" },
  { section: "characters", path: "CREATION.skillMax", type: "number" },
  { section: "characters", path: "CREATION.knowledgePerInt", type: "number" },
  // GM tools (v0.51.0)
  { section: "gmTools", path: "GM_TOOLS.monthDays", type: "number" },
  { section: "gmTools", path: "GM_TOOLS.yearDays", type: "number" },
  { section: "gmTools", path: "GM_TOOLS.confirmFrom", type: "number" },
  { section: "gmTools", path: "GM_TOOLS.undo.windowMs", type: "number" },
  { section: "gmTools", path: "GM_TOOLS.undo.maxSteps", type: "number" },
  { section: "gmTools", path: "GM_TOOLS.undo.skipTokenMoves", type: "boolean" },
  { section: "gmTools", path: "GM_TOOLS.recentRolls", type: "number" },
  // NPC generator (v0.52.0)
  { section: "npcGenerator", path: "NPCGEN.spread", type: "number" },
  { section: "npcGenerator", path: "NPCGEN.maxAttribute", type: "number" },
  { section: "npcGenerator", path: "NPCGEN.maxSkill", type: "number" },
  // v0.54.0 review fixes
  { section: "testsAndDice", path: "ATTACK_STAGING", type: "select", choices: ["afterFirst", "all"] },
  { section: "initiativeAndActions", path: "INITIATIVE_WOUNDS.enabled", type: "boolean" },
  { section: "initiativeAndActions", path: "INITIATIVE_WOUNDS.midTurn", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_EXTRA.elementalMatch", type: "select", choices: ["category", "element", "any"] },
  { section: "magicAndCritters", path: "ADEPT.spellPool", type: "boolean" },
  { section: "magicAndCritters", path: "ADEPT.killingHands.magical", type: "boolean" },
  // v0.56.0
  { section: "magicAndCritters", path: "MAGIC_V56.spellEffects.reflexesExclusive", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V56.spellEffects.capAtForce", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V56.healing.treatHours", type: "number", step: 0.5 },
  { section: "magicAndCritters", path: "MAGIC_V56.healing.treatBlock", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V56.touch.opposed", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V56.touch.distance", type: "select", choices: ["warn", "block", "off"] },
  { section: "magicAndCritters", path: "MAGIC_V56.learning.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V56.learning.site", type: "select", choices: ["warn", "block", "off"] },
  { section: "magicAndCritters", path: "MAGIC_V56.permanent.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V56.permanent.turnsPerForce", type: "number" },
  { section: "magicAndCritters", path: "MAGIC_V56.ward.hoursPerForce", type: "number" },
  { section: "magicAndCritters", path: "MAGIC_V56.ward.nuyenPerForce", type: "number" },
  { section: "magicAndCritters", path: "MAGIC_V56.manifest.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V56.detectionRange.enforce", type: "select", choices: ["warn", "block", "off"] },
  { section: "magicAndCritters", path: "MAGIC_V56.detectionRange.factor", type: "number" },
  { section: "magicAndCritters", path: "MAGIC_V56.centering.mode", type: "select", choices: ["auto", "test", "testIfSkill"] },
  { section: "magicAndCritters", path: "MAGIC_V56.natureSpirits.departs", type: "select", choices: ["dawnDusk", "off"] },
  { section: "magicAndCritters", path: "MAGIC_V56.natureSpirits.sunrise", type: "number" },
  { section: "magicAndCritters", path: "MAGIC_V56.natureSpirits.sunset", type: "number" },
  { section: "magicAndCritters", path: "MAGIC_V56.natureSpirits.dayStartHour", type: "number" },
  { section: "magicAndCritters", path: "MAGIC_V56.control.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V56.control.summonerHelps", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V56.trueName.karmaPerForce", type: "number" },
  { section: "magicAndCritters", path: "CRITTERS_V56.adeptBudget", type: "select", choices: ["off", "warn"] },
  { section: "magicAndCritters", path: "CRITTERS_V56.immunity.armorPerEssence", type: "number" },
  // v0.55.0 combat and health
  { section: "rangedCombat", path: "COMBAT.aim.tnPerAction", type: "number" },
  { section: "rangedCombat", path: "COMBAT.aim.maxFromSkill", type: "number" },
  { section: "rangedCombat", path: "COMBAT.multipleTargets.tnPerTarget", type: "number" },
  { section: "rangedCombat", path: "COMBAT.unaware.autoFromSurprise", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT.ready.rule", type: "select", choices: ["off", "warn", "action"] },
  { section: "rangedCombat", path: "COMBAT.armorFor.thrown", type: "select", choices: ["impact", "ballistic"] },
  { section: "rangedCombat", path: "COMBAT.armorFor.bow", type: "select", choices: ["ballistic", "impact"] },
  { section: "rangedCombat", path: "COMBAT.shotgunTnPerMetre", type: "number" },
  { section: "rangedCombat", path: "COMBAT.blastCombine.fraction", type: "number" },
  { section: "rangedCombat", path: "COMBAT.suppressive.enabled", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT.suppressive.rounds", type: "number" },
  { section: "rangedCombat", path: "COMBAT.suppressive.coverIsSafe", type: "boolean" },
  { section: "melee", path: "COMBAT.burning.enabled", type: "boolean" },
  { section: "melee", path: "COMBAT.hold.status", type: "select", choices: ["restrain", "prone"] },
  { section: "characters", path: "HEALING.firstAid.afterMagic", type: "boolean" },
  { section: "characters", path: "PATCHES.stim.hoursPerRating", type: "number" },
  { section: "characters", path: "PATCHES.stim.backlash", type: "number" },
  { section: "characters", path: "PATCHES.antidote.hoursPerRating", type: "number" },
  { section: "characters", path: "BIOWARE.surgery.trauma.enabled", type: "boolean" },
  // v0.57.0 Matrix, vehicles and security
  { section: "magicAndTheMatrix", path: "MATRIX_V57.tally.perDecker", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.tally.agentTally", type: "select", choices: ["own", "owner"] },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.loading.enabled", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.loading.action", type: "select", choices: ["free", "simple", "complex"] },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.wounds.enabled", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.wounds.ic", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.blackIcHold.enabled", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.blackIcHold.attribute", type: "select", choices: ["willpower", "intelligence"] },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.shutdown.enabled", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.shutdown.turns", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.dumpShock.levelBy", type: "select", choices: ["fixed", "code"] },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.icInitiative.from", type: "select", choices: ["rating", "securityValue"] },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.icAttackDice", type: "select", choices: ["rating", "securityValue"] },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.perception.dice", type: "select", choices: ["sensors", "computer"] },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.maneuvers.enabled", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.maneuvers.maxTn", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.utilities.slow.initiativePerNet", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.utilities.restore.deckDamage", type: "boolean" },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.utilities.validate.dfBonus", type: "number" },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.bombs.level", type: "select", choices: ["L", "M", "S", "D"] },
  { section: "magicAndTheMatrix", path: "MATRIX_V57.hitchers.blackIc", type: "boolean" },
  { section: "vehiclesAndRigging", path: "VEHICLES_V57.accel.enabled", type: "boolean" },
  { section: "vehiclesAndRigging", path: "VEHICLES_V57.accel.outsideCombat", type: "select", choices: ["free", "limited"] },
  { section: "vehiclesAndRigging", path: "VEHICLES_V57.accel.brakeMultiplier", type: "number", step: 0.5 },
  { section: "vehiclesAndRigging", path: "VEHICLES_V57.accel.pushTn", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES_V57.crashAfterDamage.enabled", type: "boolean" },
  { section: "vehiclesAndRigging", path: "VEHICLES_V57.crashAfterDamage.at", type: "select", choices: ["L", "M", "S", "D"] },
  { section: "vehiclesAndRigging", path: "VEHICLES_V57.calledShots.tn", type: "number" },
  { section: "vehiclesAndRigging", path: "VEHICLES_V57.maneuver.mode", type: "select", choices: ["gap", "score"] },
  { section: "vehiclesAndRigging", path: "VEHICLES_V57.evasion.manual", type: "select", choices: ["driving", "pool", "none"] },
  { section: "vehiclesAndRigging", path: "VEHICLES_V57.sensorGunnery", type: "select", choices: ["rigger2", "flat", "signature"] },
  { section: "buildingSecurity", path: "SECURITY_V57.noToolsTn", type: "number" },
  { section: "buildingSecurity", path: "SECURITY_V57.maxTnOff", type: "number" },
  { section: "buildingSecurity", path: "SECURITY_V57.light.enabled", type: "boolean" },
  { section: "buildingSecurity", path: "SECURITY_V57.light.factor", type: "number", step: 0.25 },
  // v0.58.0 characters, gear and integration
  { section: "characters", path: "CHARACTERS_V58.notice.baseTn", type: "number" },
  { section: "characters", path: "CHARACTERS_V58.tools.perStepTn", type: "number" },
  { section: "characters", path: "CHARACTERS_V58.tools.none", type: "select", choices: ["tn", "block"] },
  { section: "characters", path: "CHARACTERS_V58.tools.noneTn", type: "number" },
  { section: "characters", path: "CHARACTERS_V58.creation.freeContacts", type: "number" },
  { section: "characters", path: "CHARACTERS_V58.creation.lifestyleMonthsPaid", type: "boolean" },
  { section: "characters", path: "CHARACTERS_V58.languages.nativeAtIntelligence", type: "boolean" },
  { section: "characters", path: "CHARACTERS_V58.languages.readWrite", type: "select", choices: ["half", "same"] },
  { section: "characters", path: "CHARACTERS_V58.training.mode", type: "select", choices: ["timed", "instant"] },
  // v0.65.0: things that take time wait for it (on by default; the GM can change the time or finish it at once).
  { section: "timeToGetThings", path: "WAITING.enabled", type: "boolean" },
  // v0.91.0: the shop (RULES.SHOP_V91); the first choice is the new way, the other the old one.
  { section: "timeToGetThings", path: "SHOP_V91.buying", type: "select", choices: ["find", "now"] },
  { section: "timeToGetThings", path: "SHOP_V91.retry", type: "select", choices: ["wait", "any"] },
  // v0.91.5: legality in the shop and permits (RULES.SHOP_V915); the first choice is the new way, the other the old one.
  { section: "timeToGetThings", path: "SHOP_V915.findByLegality", type: "select", choices: ["graded", "off"] },
  { section: "timeToGetThings", path: "SHOP_V915.findTn.permit", type: "number" },
  { section: "timeToGetThings", path: "SHOP_V915.findTn.restricted", type: "number" },
  { section: "timeToGetThings", path: "SHOP_V915.findTn.forbidden", type: "number" },
  { section: "timeToGetThings", path: "SHOP_V915.findTime.permit", type: "number", step: 0.25 },
  { section: "timeToGetThings", path: "SHOP_V915.findTime.restricted", type: "number", step: 0.25 },
  { section: "timeToGetThings", path: "SHOP_V915.findTime.forbidden", type: "number", step: 0.25 },
  { section: "timeToGetThings", path: "SHOP_V915.permits", type: "select", choices: ["buy", "tick"] },
  { section: "timeToGetThings", path: "SHOP_V915.permitCost.permit.share", type: "number", step: 0.05 },
  { section: "timeToGetThings", path: "SHOP_V915.permitCost.permit.minimum", type: "number" },
  { section: "timeToGetThings", path: "SHOP_V915.permitCost.restricted.share", type: "number", step: 0.05 },
  { section: "timeToGetThings", path: "SHOP_V915.permitCost.restricted.minimum", type: "number" },
  { section: "timeToGetThings", path: "SHOP_V915.permitDays.permit", type: "number" },
  { section: "timeToGetThings", path: "SHOP_V915.permitDays.restricted", type: "number" },
  // v0.91.6: finding through contacts and fixers (RULES.SHOP_V916); the first choice is the new way, the other the old one.
  { section: "timeToGetThings", path: "SHOP_V916.through", type: "select", choices: ["on", "off"] },
  { section: "timeToGetThings", path: "SHOP_V916.contactLegalShare", type: "number", step: 0.25 },
  { section: "timeToGetThings", path: "SHOP_V916.fixerLegalShare", type: "number", step: 0.25 },
  { section: "timeToGetThings", path: "SHOP_V916.fixerFee", type: "number", step: 0.05 },
  { section: "timeToGetThings", path: "SHOP_V916.fixerTime", type: "number", step: 0.25 },
  { section: "timeToGetThings", path: "SHOP_V916.fixerDicePerLevel", type: "number" },
  // v0.91.8: spell formulas (RULES.FORMULA_V918); the first choice is the new way, the other the old one.
  { section: "magicAndCritters", path: "FORMULA_V918.required", type: "select", choices: ["on", "off"] },
  { section: "magicAndCritters", path: "FORMULA_V918.raise", type: "select", choices: ["on", "off"] },
  { section: "magicAndCritters", path: "FORMULA_V918.nuyenPerForce", type: "number" },
  { section: "magicAndCritters", path: "FORMULA_V918.combatFactor", type: "number", step: 0.25 },
  { section: "magicAndCritters", path: "FORMULA_V918.tnPerForce", type: "number", step: 0.5 },
  { section: "magicAndCritters", path: "FORMULA_V918.availDays", type: "number" },
  { section: "magicAndCritters", path: "FORMULA_V918.streetIndex", type: "number", step: 0.25 },
  { section: "magicAndCritters", path: "FORMULA_V918.foreign", type: "select", choices: ["harder", "same"] },
  { section: "magicAndCritters", path: "FORMULA_V918.foreignTn", type: "number" },
  { section: "magicAndCritters", path: "FORMULA_V918.foreignTime", type: "number", step: 0.25 },
  { section: "magicAndCritters", path: "FORMULA_V918.teacher", type: "select", choices: ["on", "off"] },
  { section: "magicAndCritters", path: "FORMULA_V918.feePerForce", type: "number" },
  // v0.92.0: the layered Magic Pool (RULES.MAGIC_V920); the first choice is the new way, the other the old one.
  { section: "magicAndCritters", path: "MAGIC_V920.poolLayers", type: "select", choices: ["layered", "flat"] },
  { section: "magicAndCritters", path: "MAGIC_V920.castNarrow", type: "select", choices: ["on", "off"] },
  { section: "magicAndCritters", path: "MAGIC_V920.drainNarrow", type: "select", choices: ["on", "off"] },
  // v0.92.1: the flexible record sheet (RULES.SHEET_V921); the first choice is the new way, the other the old one.
  { section: "characters", path: "SHEET_V921.tweaks", type: "select", choices: ["on", "off"] },
  { section: "characters", path: "SHEET_V921.carried", type: "select", choices: ["on", "off"] },
  { section: "characters", path: "SHEET_V921.accessories", type: "select", choices: ["auto", "off"] },
  { section: "characters", path: "SHEET_V921.wizard", type: "select", choices: ["advise", "block"] },
  { section: "characters", path: "SHEET_V921.ratingLock", type: "select", choices: ["queue", "always"] },
  // v0.92.2: a big jump of world time (RULES.CLOCK_V922).
  { section: "gmTools", path: "CLOCK_V922.bigJump", type: "select", choices: ["ask", "count"] },
  { section: "gmTools", path: "CLOCK_V922.bigJumpDays", type: "number", step: 1 },
  { section: "timeToGetThings", path: "WAITING.areas.magic", type: "boolean" },
  { section: "timeToGetThings", path: "WAITING.areas.gear", type: "boolean" },
  { section: "timeToGetThings", path: "WAITING.areas.repairs", type: "boolean" },
  { section: "timeToGetThings", path: "WAITING.areas.matrix", type: "boolean" },
  { section: "timeToGetThings", path: "WAITING.areas.vehicles", type: "boolean" },
  { section: "timeToGetThings", path: "WAITING.orderFactor", type: "number", step: 0.25 },
  { section: "timeToGetThings", path: "WAITING.minimumHours", type: "number", step: 0.5 },
  { section: "characters", path: "CHARACTERS_V58.negotiation.perNet", type: "number", step: 0.05 },
  { section: "characters", path: "CHARACTERS_V58.negotiation.cap", type: "number", step: 0.05 },
  { section: "characters", path: "CHARACTERS_V58.notoriety.offCred", type: "boolean" },
  { section: "characters", path: "CHARACTERS_V58.recognition.baseTn", type: "number" },
  { section: "gear", path: "GEAR_V58.essenceHoles.enabled", type: "boolean" },
  { section: "gear", path: "GEAR_V58.surveillance.listenTn", type: "number" },
  { section: "gear", path: "GEAR_V58.surveillance.jamBeats", type: "select", choices: ["greaterOrEqual", "greater"] },
  { section: "gear", path: "GEAR_V58.legality.fineTimesRating", type: "boolean" },
  { section: "tokens", path: "GEAR_V58.visibility.enabled", type: "boolean" },
  { section: "tokens", path: "GEAR_V58.visibility.projecting", type: "boolean" },
  // Safehouses (v0.53.0)
  { section: "safehouses", path: "SAFEHOUSE.graceDays", type: "number" },
  { section: "safehouses", path: "SAFEHOUSE.overdueComfort", type: "select", choices: ["street", "squatter", "low", "middle", "high", "luxury"] },
  { section: "safehouses", path: "SAFEHOUSE.caps.security", type: "number" },
  { section: "safehouses", path: "SAFEHOUSE.caps.concealment", type: "number" },
  { section: "safehouses", path: "SAFEHOUSE.homeCare", type: "boolean" },
  { section: "safehouses", path: "SAFEHOUSE.search.baseTn", type: "number" },
  { section: "safehouses", path: "SAFEHOUSE.search.successes", type: "number" },
  { section: "safehouses", path: "SAFEHOUSE.search.days", type: "number" },
  // v0.61.0 rules gaps (VERIFY).
  { section: "melee", path: "COMBAT_V61.superiorPosition.enabled", type: "boolean" },
  { section: "melee", path: "COMBAT_V61.superiorPosition.against", type: "number" },
  // v0.79.0 (melee_vision): the book's way first (SR2 Core Rules tables), the old way second (RULES.DOCS_V79; rules/config79-melee-vision.ts).
  { section: "melee", path: "DOCS_V79.meleeReachShorter", type: "select", choices: ["both", "longer"] },
  { section: "rangedCombat", path: "DOCS_V79.visionCyberNatural", type: "select", choices: ["split", "single"] },
  { section: "rangedCombat", path: "DOCS_V79.visionSmokeRows", type: "select", choices: ["book", "old"] },
  { section: "characters", path: "DOCS_V79.visionWeatherFold", type: "select", choices: ["smoke", "own"] },
  { section: "characters", path: "DOCS_V79.perceptionSightBook", type: "select", choices: ["book", "scale"] },
  { section: "melee", path: "COMBAT_V61.monowhip.on", type: "select", choices: ["defended", "botch", "miss"] },
  { section: "melee", path: "COMBAT_V61.stunBaton.emptyAs", type: "select", choices: ["club", "block"] },
  { section: "rangedCombat", path: "COMBAT_V61.launcher.dud", type: "select", choices: ["noBlast", "block"] },
  { section: "rangedCombat", path: "COMBAT_V61.smoke.radiusMetres", type: "number" },
  { section: "rangedCombat", path: "COMBAT_V61.smoke.lingerTurns", type: "number" },
  { section: "gear", path: "COMBAT_V61.skillGear.stack", type: "select", choices: ["best", "sum"] },
  { section: "gear", path: "COMBAT_V61.hearing.ampPerRating", type: "number" },
  { section: "magicAndCritters", path: "MAGIC_V61.invisibility.resist", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V61.invisibility.astralSeesPhysical", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V61.attributeSpells.exclusiveWithCyber", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V61.exclusive.blocksAllTests", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V61.repeating.autoPrompt", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V61.masterDies", type: "select", choices: ["free", "depart", "none"] },
  { section: "magicAndCritters", path: "MAGIC_V61.insect.needsHost", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V61.totems.berserk.tn", type: "number" },
  { section: "magicAndCritters", path: "MAGIC_V61.links.tn", type: "number" },
  { section: "upkeep", path: "HEALTH_V61.docwagon.enabled", type: "boolean" },
  { section: "characters", path: "HEALTH_V61.onset.enabled", type: "boolean" },
  { section: "characters", path: "STREET_V61.creation.leftoverCash.mode", type: "select", choices: ["keep", "cap", "lose"] },
  { section: "characters", path: "STREET_V61.creation.leftoverCash.cap", type: "number" },
  { section: "street", path: "STREET_V61.identity.spottedOn", type: "select", choices: ["anySuccess", "netSuccess"] },
  { section: "buildingSecurity", path: "SECURITY_V61.sheafIc.autoLaunch", type: "boolean" },
  { section: "buildingSecurity", path: "SECURITY_V61.gas.onLockdown", type: "boolean" },
  // v0.70.0: the v0.69.0 review's fixes (RULES.FIXES_V70); switch one off for the old behaviour. The helpless and
  // no-dodge status lists are edited in the Advanced JSON (FIXES_V70.helplessStatuses, noDodgeStatuses).
  { section: "buildingSecurity", path: "SECURITY.hostAlert.lockdown", type: "select", choices: ["active", "shutdown"] },
  { section: "characters", path: "FIXES_V70.dyingOutOfCombat", type: "boolean" },
  { section: "characters", path: "FIXES_V70.unstabilisedRest", type: "select", choices: ["block", "allow"] },
  { section: "characters", path: "FIXES_V70.newDamageUnstabilises", type: "boolean" },
  { section: "characters", path: "FIXES_V70.stunOverflowCarry", type: "boolean" },
  { section: "magicAndCritters", path: "FIXES_V70.astralBlocksPhysical", type: "boolean" },
  { section: "rangedCombat", path: "FIXES_V70.areasWorldTime", type: "boolean" },
  { section: "initiativeAndActions", path: "FIXES_V70.poolsAtCombatStart", type: "boolean" },
  { section: "magicAndTheMatrix", path: "FIXES_V70.matrixMoveGmOnly", type: "boolean" },
  // v0.71.0: the v0.69.0 review's common rules holes (RULES.FIXES_V71); switch one off for the old behaviour.
  { section: "testsAndDice", path: "FIXES_V71.contestKarma", type: "boolean" },
  { section: "street", path: "FIXES_V71.contestSkillDice", type: "boolean" },
  { section: "characters", path: "FIXES_V71.specialization.tradeAtCreation", type: "boolean" },
  { section: "characters", path: "FIXES_V71.specialization.ratio", type: "number" },
  { section: "characters", path: "FIXES_V71.creationFoci", type: "select", choices: ["spellPoints", "free"] },
  { section: "vehiclesAndRigging", path: "FIXES_V71.riggerDodge", type: "select", choices: ["skill", "pool"] },
  { section: "magicAndTheMatrix", path: "FIXES_V71.mpcpCaps", type: "select", choices: ["cap", "warn"] },
  { section: "magicAndTheMatrix", path: "FIXES_V71.activeMemory", type: "select", choices: ["block", "warn"] },
  { section: "magicAndTheMatrix", path: "FIXES_V71.sheafOnGenerated", type: "boolean" },
  { section: "melee", path: "FIXES_V71.counterWeaponExtras", type: "boolean" },
  { section: "magicAndCritters", path: "FIXES_V71.dispelShrinks", type: "boolean" },
  { section: "magicAndCritters", path: "FIXES_V71.invisibilityEverywhere", type: "boolean" },
  { section: "melee", path: "FIXES_V71.holds", type: "boolean" },
  { section: "rangedCombat", path: "FIXES_V71.fireTwice", type: "select", choices: ["SA", "SA+SS"] },
  { section: "initiativeAndActions", path: "FIXES_V71.astralSwitchCost", type: "boolean" },
  { section: "magicAndCritters", path: "FIXES_V71.conjureDrainAtEnd", type: "boolean" },
  { section: "vehiclesAndRigging", path: "FIXES_V71.vehicleRepair.enabled", type: "boolean" },
  { section: "vehiclesAndRigging", path: "FIXES_V71.vehicleRepair.destroyed", type: "select", choices: ["rebuild", "boxes"] },
  // v0.72.0: health, cyberware and bioware (RULES.HEALTH_V72); switch one off for the old behaviour.
  { section: "characters", path: "HEALTH_V72.drugs.doses", type: "select", choices: ["refresh", "extend", "stack"] },
  { section: "characters", path: "HEALTH_V72.drugs.overdose.enabled", type: "boolean" },
  { section: "characters", path: "HEALTH_V72.drugs.overdose.powerFrom", type: "select", choices: ["drug", "crash", "fixed"] },
  { section: "characters", path: "HEALTH_V72.drugs.overdose.basePower", type: "number" },
  { section: "characters", path: "HEALTH_V72.drugs.overdose.powerPerExtraDose", type: "number" },
  { section: "gear", path: "HEALTH_V72.bioware.enabled", type: "boolean" },
  { section: "gear", path: "HEALTH_V72.bioware.vitals.symbiotes.healingDice", type: "number" },
  { section: "gear", path: "HEALTH_V72.bioware.vitals.nephriticScreen.toxinDice", type: "number" },
  { section: "gear", path: "HEALTH_V72.bioware.vitals.extendedVolume.breathTurns", type: "number" },
  { section: "characters", path: "HEALTH_V72.qualities.enabled", type: "boolean" },
  { section: "characters", path: "HEALTH_V72.qualities.willToLive.boxesPerLevel", type: "number" },
  { section: "characters", path: "HEALTH_V72.qualities.highPainTolerance.boxesPerLevel", type: "number" },
  { section: "characters", path: "HEALTH_V72.qualities.lowPainTolerance.extraBoxes", type: "number" },
  { section: "characters", path: "HEALTH_V72.qualities.toughness.dice", type: "number" },
  { section: "characters", path: "HEALTH_V72.qualities.toughness.onStun", type: "boolean" },
  { section: "characters", path: "HEALTH_V72.qualities.sensitiveSystem.essenceMultiplier", type: "number", step: 0.25 },
  { section: "characters", path: "HEALTH_V72.qualities.sensitiveSystem.rejectionAlways", type: "boolean" },
  { section: "characters", path: "HEALTH_V72.hazards.heat.enabled", type: "boolean" },
  { section: "characters", path: "HEALTH_V72.hazards.heat.fireImmune", type: "boolean" },
  { section: "characters", path: "HEALTH_V72.hazards.electricity.enabled", type: "boolean" },
  { section: "characters", path: "HEALTH_V72.hazards.electricity.armorFraction", type: "number", step: 0.25 },
  { section: "characters", path: "HEALTH_V72.hazards.electricity.shockEffect", type: "boolean" },
  // v0.72.0: combat and gear (RULES.COMBAT_V72); switch one off for the old behaviour. The ammunition rows (COMBAT_V72.ammo.extra) and the gap-shot list (calledShotGap.bypasses) are edited in the Advanced JSON.
  { section: "rangedCombat", path: "COMBAT_V72.blastBarriers.mode", type: "select", choices: ["rating", "armor", "block"] },
  { section: "rangedCombat", path: "COMBAT_V72.blastBarriers.unratedWalls", type: "select", choices: ["block", "default"] },
  { section: "rangedCombat", path: "COMBAT_V72.blastBarriers.holdMultiplier", type: "number" },
  { section: "rangedCombat", path: "COMBAT_V72.blastBarriers.reduceMultiplier", type: "number" },
  { section: "rangedCombat", path: "COMBAT_V72.aim.keepAcrossTurns", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT_V72.aim.capBy", type: "select", choices: ["rolled", "base"] },
  { section: "magicAndCritters", path: "COMBAT_V72.immunity.stopsWeak", type: "boolean" },
  { section: "magicAndCritters", path: "COMBAT_V72.immunity.compare", type: "select", choices: ["immunity", "allArmor"] },
  { section: "magicAndCritters", path: "COMBAT_V72.immunity.ammoCounts", type: "boolean" },
  { section: "melee", path: "COMBAT_V72.meleeSmoke", type: "boolean" },
  { section: "gear", path: "COMBAT_V72.ammo.dataDriven", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT_V72.indirect.enabled", type: "boolean" },
  { section: "rangedCombat", path: "COMBAT_V72.indirect.noSpotter", type: "select", choices: ["blind", "block"] },
  { section: "rangedCombat", path: "COMBAT_V72.indirect.extraScatterDice", type: "number" },
  { section: "rangedCombat", path: "COMBAT_V72.indirect.scatterMultiplier", type: "number" },
  { section: "rangedCombat", path: "COMBAT_V72.indirect.metresPerSpotterSuccess", type: "number" },
  { section: "rangedCombat", path: "COMBAT_V72.indirect.maxSpotterSuccesses", type: "number" },
  { section: "rangedCombat", path: "COMBAT_V72.indirect.adjustTnPerShot", type: "number" },
  // v0.72.0: magic and critters (RULES.MAGIC_V72); switch one off for the old behaviour.
  { section: "magicAndCritters", path: "MAGIC_V72.masterDies.byKind", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V72.masterDies.kinds.elemental", type: "select", choices: ["free", "depart", "none", "legacy"] },
  { section: "magicAndCritters", path: "MAGIC_V72.masterDies.kinds.ally", type: "select", choices: ["free", "depart", "none", "legacy"] },
  { section: "magicAndCritters", path: "MAGIC_V72.adeptAstral.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V72.adeptAstral.pool", type: "select", choices: ["combat", "spell", "none"] },
  { section: "magicAndCritters", path: "MAGIC_V72.metamagicLimits.mode", type: "select", choices: ["block", "warn", "off"] },
  { section: "magicAndCritters", path: "MAGIC_V72.dispelDrainPool", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V72.barrierSpells.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V72.barrierSpells.rating", type: "select", choices: ["force", "successes"] },
  { section: "magicAndCritters", path: "MAGIC_V72.barrierSpells.radius", type: "select", choices: ["magic", "force", "fixed"] },
  { section: "magicAndCritters", path: "MAGIC_V72.innateSpells.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V72.innateSpells.drain", type: "select", choices: ["normal", "none"] },
  { section: "magicAndCritters", path: "MAGIC_V72.wardPresence.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V72.wardPresence.perceiving", type: "boolean" },
  { section: "initiativeAndActions", path: "MAGIC_V72.astralWounds", type: "select", choices: ["both", "neither", "legacy"] },
  { section: "magicAndCritters", path: "MAGIC_V72.anchoring.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V72.anchoring.karmaPerForce", type: "number" },
  { section: "magicAndCritters", path: "MAGIC_V72.ally.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "MAGIC_V72.ally.spellKarmaPerForce", type: "number" },
  { section: "magicAndCritters", path: "MAGIC_V72.ally.castDice", type: "select", choices: ["force", "intelligence"] },
  // v0.73.0: cross-cutting bookkeeping (RULES.CROSSCUT_V73); switch one off for the old behaviour.
  { section: "gmTools", path: "CROSSCUT_V73.undo.regions", type: "boolean" },
  { section: "gmTools", path: "CROSSCUT_V73.undo.skipTimedOut", type: "boolean" },
  { section: "gmTools", path: "CROSSCUT_V73.retarget.noticeAsPerception", type: "boolean" },
  { section: "gmTools", path: "CROSSCUT_V73.retarget.hearingRows", type: "boolean" },
  { section: "gmTools", path: "CROSSCUT_V73.retarget.superiorPosition", type: "select", choices: ["whenOn", "always", "never"] },
  { section: "gmTools", path: "CROSSCUT_V73.retarget.prejudiceRows", type: "boolean" },
  { section: "characters", path: "CROSSCUT_V73.statuses.brokenEndsWithCombat", type: "boolean" },
  { section: "magicAndCritters", path: "CROSSCUT_V73.statuses.timedHoldEnds", type: "boolean" },
  { section: "characters", path: "CROSSCUT_V73.advancement.nuyenRefunds", type: "select", choices: ["matched", "all", "off"] },
  { section: "characters", path: "CROSSCUT_V73.advancement.trainingDone", type: "select", choices: ["doneLine", "quiet", "old"] },
  { section: "characters", path: "CROSSCUT_V73.advancement.creditRequester", type: "boolean" },
  { section: "vehiclesAndRigging", path: "CROSSCUT_V73.modInstall.payUpFront", type: "boolean" },
  // v0.73.0: Matrix and rigging (RULES.NETRIG_V73); switch one off for the old behaviour.
  { section: "magicAndTheMatrix", path: "NETRIG_V73.logoffHold.enabled", type: "boolean" },
  { section: "magicAndTheMatrix", path: "NETRIG_V73.logoffHold.gmOverride", type: "boolean" },
  { section: "magicAndTheMatrix", path: "NETRIG_V73.personaInitiative.enabled", type: "boolean" },
  { section: "magicAndTheMatrix", path: "NETRIG_V73.personaInitiative.combine", type: "select", choices: ["add", "max"] },
  { section: "magicAndTheMatrix", path: "NETRIG_V73.knownHosts.enabled", type: "boolean" },
  { section: "magicAndTheMatrix", path: "NETRIG_V73.knownHosts.grids", type: "select", choices: ["located", "analyzed", "hidden"] },
  { section: "magicAndTheMatrix", path: "NETRIG_V73.knownHosts.onEntry", type: "select", choices: ["located", "analyzed"] },
  { section: "magicAndTheMatrix", path: "NETRIG_V73.knownHosts.gmSeesAll", type: "boolean" },
  { section: "vehiclesAndRigging", path: "NETRIG_V73.ram.afterDefense", type: "boolean" },
  { section: "vehiclesAndRigging", path: "NETRIG_V73.ram.passengers", type: "boolean" },
  { section: "vehiclesAndRigging", path: "NETRIG_V73.controlRig.gunnery", type: "boolean" },
  { section: "vehiclesAndRigging", path: "NETRIG_V73.controlRig.evasion", type: "boolean" },
  { section: "vehiclesAndRigging", path: "NETRIG_V73.sensorLocks.enabled", type: "boolean" },
  { section: "vehiclesAndRigging", path: "NETRIG_V73.sensorLocks.turns", type: "number" },
  { section: "vehiclesAndRigging", path: "NETRIG_V73.sensorLocks.maxMetresPerRating", type: "number" },
  { section: "vehiclesAndRigging", path: "NETRIG_V73.sensorLocks.sensorsOut", type: "boolean" },
  // v0.73.0: drone links, mount points, missiles (RULES.DRONES_V73); switch one off for the old behaviour.
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.enabled", type: "boolean" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.skill", type: "select", choices: ["Electronics", "Electronic Warfare", "Computer"] },
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.intercept.tnFrom", type: "select", choices: ["encryption", "signal"] },
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.intercept.eccmAddsTn", type: "boolean" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.intercept.gear", type: "select", choices: ["rcdOrRadio", "rcd", "none"] },
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.spoof.needsIntercept", type: "boolean" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.spoof.tnFrom", type: "select", choices: ["rcd", "pilot"] },
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.spoof.tnMod", type: "number" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.spoof.eccmAddsTn", type: "boolean" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.spoof.jumpedIn", type: "select", choices: ["immune", "harder", "normal"] },
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.spoof.jumpedInTn", type: "number" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.spoof.effect", type: "select", choices: ["command", "takeover"] },
  { section: "vehiclesAndRigging", path: "DRONES_V73.link.spoof.gear", type: "select", choices: ["rcd", "rcdOrRadio", "none"] },
  { section: "vehiclesAndRigging", path: "DRONES_V73.mounts.mode", type: "select", choices: ["warn", "block", "off"] },
  { section: "vehiclesAndRigging", path: "DRONES_V73.mounts.capacityFrom", type: "select", choices: ["sheet", "body"] },
  { section: "vehiclesAndRigging", path: "DRONES_V73.mounts.firmPerBody", type: "number" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.mounts.hardPerBody", type: "number" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.mounts.hardTakesFirm", type: "boolean" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.mounts.turretNeedsHard", type: "boolean" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.mounts.antiVehicleHard", type: "boolean" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.mounts.guidedHard", type: "boolean" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.missiles.signature", type: "boolean" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.missiles.vsPeople", type: "select", choices: ["range", "signature"] },
  { section: "vehiclesAndRigging", path: "DRONES_V73.missiles.ecm", type: "boolean" },
  { section: "vehiclesAndRigging", path: "DRONES_V73.missiles.needsLock", type: "boolean" },
  // v0.73.0: characters, skills and the street (RULES.CHARACTERS_V73); switch one off for the old behaviour.
  { section: "characters", path: "CHARACTERS_V73.rollMemory.rememberComplementary", type: "boolean" },
  { section: "street", path: "CHARACTERS_V73.negotiation.useOpposedAttribute", type: "boolean" },
  { section: "street", path: "CHARACTERS_V73.lifestyle.outrightPermanent", type: "boolean" },
  { section: "street", path: "CHARACTERS_V73.lifestyle.buyLater", type: "boolean" },
  { section: "street", path: "CHARACTERS_V73.lifestyle.creditPaidMonths", type: "boolean" },
  { section: "street", path: "CHARACTERS_V73.lifestyle.keepOnLevelChange", type: "boolean" },
  { section: "characters", path: "CHARACTERS_V73.training.keepSpecialization", type: "boolean" },
  { section: "characters", path: "CHARACTERS_V73.skillCost.agree", type: "boolean" },
  { section: "characters", path: "CHARACTERS_V73.skillCost.basis", type: "select", choices: ["natural", "augmented"] },
  { section: "characters", path: "CHARACTERS_V73.racialFloor.mode", type: "select", choices: ["floor", "warn", "off"] },
  { section: "characters", path: "CHARACTERS_V73.racialFloor.min", type: "number" },
  { section: "street", path: "CHARACTERS_V73.npcs.threatRating", type: "boolean" },
  { section: "street", path: "CHARACTERS_V73.npcs.professionalFromTable", type: "boolean" },
  { section: "street", path: "CHARACTERS_V73.npcs.karmaPool", type: "select", choices: ["none", "singles", "all"] },
  { section: "street", path: "CHARACTERS_V73.npcs.handMadeKarmaPool", type: "number" },
  { section: "characters", path: "CHARACTERS_V73.metatypes.open", type: "boolean" },
  { section: "characters", path: "CHARACTERS_V73.skillNames.canonical", type: "boolean" },
  { section: "characters", path: "CHARACTERS_V73.qualities.exceptionalAttribute.enabled", type: "boolean" },
  { section: "characters", path: "CHARACTERS_V73.qualities.surplusFlaws.use", type: "select", choices: ["none", "attributes", "skills", "nuyen"] },
  { section: "characters", path: "CHARACTERS_V73.qualities.surplusFlaws.perPoint", type: "number" },
  { section: "characters", path: "CHARACTERS_V73.qualities.surplusFlaws.nuyenPerPoint", type: "number" },
  { section: "characters", path: "CHARACTERS_V73.qualities.surplusFlaws.maxPoints", type: "number" },
  { section: "characters", path: "CHARACTERS_V73.qualities.karmaAboveRacial.enabled", type: "boolean" },
  { section: "characters", path: "CHARACTERS_V73.qualities.karmaAboveRacial.multiplier", type: "number" },
  // v0.78.0: the book check's rules changes (RULES.BOOK_V78); the first choice is the book's, the other the old way.
  { section: "street", path: "BOOK_V78.legwork.mode", type: "select", choices: ["book", "tn"] },
  { section: "rangedCombat", path: "BOOK_V78.flash.mode", type: "select", choices: ["book", "blind"] },
  { section: "rangedCombat", path: "BOOK_V78.flash.maxMetres", type: "number" },
  { section: "gear", path: "BOOK_V78.patches.stim", type: "select", choices: ["book", "hours"] },
  { section: "gear", path: "BOOK_V78.patches.tranq", type: "select", choices: ["opposed", "body"] },
  { section: "gear", path: "BOOK_V78.toxinBioware", type: "select", choices: ["power", "dice"] },
  { section: "gear", path: "BOOK_V78.symbiotes.mode", type: "select", choices: ["time", "dice"] },
  { section: "gear", path: "BOOK_V78.encephalon.mode", type: "select", choices: ["shadowtech", "dice"] },
  { section: "gear", path: "BOOK_V78.senseAllowance.enabled", type: "boolean" },
  { section: "magicAndCritters", path: "BOOK_V78.manaBarrier.spells", type: "select", choices: ["casterTn", "resistDice"] },
  { section: "magicAndCritters", path: "BOOK_V78.manaBarrier.rating", type: "select", choices: ["halfForce", "force"] },
  { section: "magicAndCritters", path: "BOOK_V78.invisibility.mode", type: "select", choices: ["perception", "resist"] },
  { section: "magicAndCritters", path: "BOOK_V78.invisibility.thermographicSeesMana", type: "boolean" },
  { section: "magicAndCritters", path: "BOOK_V78.focusKarma.mode", type: "select", choices: ["book", "flat"] },
  { section: "magicAndCritters", path: "BOOK_V78.powerFocus", type: "select", choices: ["magic", "dice"] },
  { section: "magicAndCritters", path: "BOOK_V78.insectFlesh.mode", type: "select", choices: ["byRole", "halfForce"] },
  { section: "magicAndCritters", path: "BOOK_V78.critterToxins.mode", type: "select", choices: ["dice", "stop"] },
  { section: "magicAndCritters", path: "BOOK_V78.paralysis.mode", type: "select", choices: ["drain", "noActions"] },
  { section: "magicAndCritters", path: "BOOK_V78.combatSense", type: "select", choices: ["pool", "dice"] },
  { section: "magicAndCritters", path: "BOOK_V78.spellResistanceVsPowers", type: "boolean" },
  { section: "magicAndCritters", path: "BOOK_V78.allergy.mode", type: "select", choices: ["book", "legacy"] },
  { section: "buildingSecurity", path: "BOOK_V78.tamper.mode", type: "select", choices: ["tn", "opposed"] },
  { section: "buildingSecurity", path: "BOOK_V78.voiceLocks", type: "select", choices: ["deception", "electronics"] },
  { section: "rangedCombat", path: "BOOK_V78.barriers.mode", type: "select", choices: ["book", "subtract"] },
  { section: "vehiclesAndRigging", path: "BOOK_V78.adaptation", type: "select", choices: ["text", "single"] },
  { section: "melee", path: "COMBAT_V61.monowhip.tn", type: "number" },
  { section: "magicAndCritters", path: "BOOK_V78.manaBarrier.wards", type: "select", choices: ["resistDice", "casterTn"] },
  { section: "vehiclesAndRigging", path: "BOOK_V78.riggerAdaptationCost", type: "number" },
  // v0.79.0 (social_core): the official SR2 rules (SRII Social Skill Table, pp. 180–182; the Karma cost table); the first choice is the book's, the other the old way.
  { section: "street", path: "DOCS_V79.socialDesired.mode", type: "select", choices: ["docs", "old"] },
  { section: "street", path: "DOCS_V79.socialInfluence.mode", type: "select", choices: ["oneSided", "opposed"] },
  { section: "characters", path: "DOCS_V79.skillKarma.mode", type: "select", choices: ["flat", "bands"] },
  // v0.79.0 (ranged): the fixes from SRII (RULES.DOCS_V79, rules/config79-ranged.ts); the first choice is the book's, the other the old way.
  { section: "initiativeAndActions", path: "DOCS_V79.rangedReload", type: "select", choices: ["actions", "oneSimple"] },
  { section: "rangedCombat", path: "DOCS_V79.rangedPoolCap", type: "select", choices: ["skill", "none"] },
  { section: "rangedCombat", path: "DOCS_V79.rangedStrengthRange", type: "select", choices: ["book", "item"] },
  { section: "rangedCombat", path: "DOCS_V79.rangedRecoil", type: "select", choices: ["book", "freeFirst"] },
  { section: "rangedCombat", path: "DOCS_V79.rangedFlechette.mode", type: "select", choices: ["armor", "always"] },
  { section: "rangedCombat", path: "DOCS_V79.rangedScatter.mode", type: "select", choices: ["byType", "byRange"] },
  { section: "initiativeAndActions", path: "DOCS_V79.rangedSurprise.mode", type: "select", choices: ["order", "losePass"] },
  // v0.79.0 (drones and magic): the verified fixes (RULES.DOCS_V79; Rigger 2, SR2 core); the first choice is the book's, the other the old way.
  { section: "vehiclesAndRigging", path: "DOCS_V79.riggerDumpShock.mode", type: "select", choices: ["rcd", "willpower"] },
  { section: "vehiclesAndRigging", path: "DOCS_V79.signalFlux.base", type: "select", choices: ["table", "rating"] },
  { section: "magicAndCritters", path: "DOCS_V79.magicPool.size", type: "select", choices: ["sorcery", "attributes"] },
  { section: "magicAndCritters", path: "DOCS_V79.magicPool.castingCap", type: "select", choices: ["magic", "none"] },
  { section: "magicAndCritters", path: "MAGIC.spellDefenseSpentOnUse", type: "boolean" },
  // v0.79.0 (vehicles): the book's way first (Rigger 2), the old way second (RULES.DOCS_V79; rules/config79-vehicles.ts).
  { section: "vehiclesAndRigging", path: "DOCS_V79.vehCrashLevel", type: "select", choices: ["speed", "fixed"] },
  { section: "vehiclesAndRigging", path: "DOCS_V79.vehRamLevel", type: "select", choices: ["speed", "half"] },
  { section: "vehiclesAndRigging", path: "DOCS_V79.vehMountRecoil.mode", type: "select", choices: ["rigger2", "old"] },
  { section: "vehiclesAndRigging", path: "DOCS_V79.vehSensorTable.mode", type: "select", choices: ["rigger2", "off"] },
  { section: "vehiclesAndRigging", path: "DOCS_V79.vehRepair.mode", type: "select", choices: ["rigger2", "perSuccess"] },
  { section: "vehiclesAndRigging", path: "DOCS_V79.vehRepair.hoursPerBox", type: "number" },
  // v0.79.0: the verified fixes (RULES.DOCS_V79, rules/config79*.ts; SRII healing tables); the first choice is the book's way, the other the old way.
  // v0.79.0 (health)
  { section: "characters", path: "DOCS_V79.healing", type: "select", choices: ["stages", "boxes"] },
  { section: "characters", path: "DOCS_V79.healingGate", type: "select", choices: ["selfTest", "none"] },
  { section: "characters", path: "DOCS_V79.doctoring", type: "select", choices: ["table", "care"] },
  { section: "characters", path: "DOCS_V79.firstAidMods", type: "select", choices: ["table", "medkitDice"] },
  // v0.79.0 (end of the verified fixes)
  // v0.80.0: the "SR2E Unified Rules Revamp" switches (RULES.URR_V80; source: Unified Rule Revamp (URR v1.2), plus a few house rules for the Revamp; the book way listed first and shipped).
  // v0.80.0 core rows
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreCriticals", type: "boolean" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreTnPresets", type: "boolean" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreKnowledgeTest", type: "boolean" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreTies", type: "select", choices: ["none", "actor"] },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreKarmaDice", type: "boolean" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreStartPoolByMeta", type: "boolean" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreStartPoolMeta", type: "number" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreKarmaGrowth", type: "select", choices: ["career", "perAward"] },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreAwardPool", type: "number" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreAwardGood", type: "number" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreMetaMax", type: "boolean" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreEssenceFloor", type: "boolean" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreWebArrows", type: "boolean" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreWebAttributes", type: "boolean" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreSubSkillDefault", type: "boolean" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreConcDefaultTn", type: "number" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreSpecDefaultTn", type: "number" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreNativeBonus", type: "number" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreLanguageKarma", type: "number", step: 0.5 },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreTraining", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreTrainHoursPerKarma", type: "number" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreTrainDailyHours", type: "number" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreInstructorMargin", type: "number" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreFindTn", type: "number" },
  { section: "unifiedRulesRevampCore", path: "URR_V80.coreHaggleTn", type: "select", choices: ["fixed", "intelligence"] },
  // v0.80.0 health-social rows
  { section: "unifiedRulesRevampHealthAndSocial", path: "STUN_OVERFLOW_PER_PHYSICAL_BOX", type: "number" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsDeathPastOverflow", type: "boolean" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsBleedMinutes", type: "number" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsSelfStabilise", type: "boolean" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsSelfStabiliseTn", type: "number" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsTraumaPatch", type: "select", choices: ["stabilise", "bodyTest"] },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsTraumaPatchTn", type: "number" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsStunRecovery", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsStunRecoveryTn", type: "number" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsFirstAid", type: "select", choices: ["boxes", "level"] },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsFirstAidTime", type: "boolean" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsFirstAidRetry", type: "boolean" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsMagicLossUntreated", type: "boolean" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsDeadlyIntensive", type: "boolean" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsOverdose", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampHealthAndSocial", path: "METATYPES.types.troll.run", type: "number" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsBreathHold", type: "boolean" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsBreathSecondsPerBody", type: "number" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsAthletics", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsFalling", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsVisibleArmor", type: "boolean" },
  { section: "unifiedRulesRevampHealthAndSocial", path: "URR_V80.hsVisibleArmorTn", type: "number" },
  // v0.80.0 combat rows
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtTies", type: "select", choices: ["book", "natural"] },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtDefense", type: "select", choices: ["dodge", "cleanMiss"] },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtKnockdown", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtReload", type: "select", choices: ["book", "quickness"] },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtStrengthRecoil", type: "boolean" },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtTracers", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtShotgun", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtScatter", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtBlastStaging", type: "boolean" },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtSubdueTn", type: "number" },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtChargePower", type: "number" },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtArmorPool", type: "select", choices: ["quickness", "pool"] },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtArmorLayers", type: "boolean" },
  { section: "unifiedRulesRevampCombat", path: "URR_V80.cbtGradedCover", type: "boolean" },
  // v0.80.0 vehicles rows
  { section: "unifiedRulesRevampVehicles", path: "URR_V80.vehCpCap", type: "select", choices: ["none", "skill"] },
  { section: "unifiedRulesRevampVehicles", path: "URR_V80.vehCpGunnery", type: "select", choices: ["control", "combat"] },
  { section: "unifiedRulesRevampVehicles", path: "URR_V80.vehCpResist", type: "boolean" },
  { section: "unifiedRulesRevampVehicles", path: "URR_V80.vehFeedback.mode", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampVehicles", path: "URR_V80.vehDamage.mode", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampVehicles", path: "URR_V80.vehPassengers", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampVehicles", path: "URR_V80.vehOccupantArmor", type: "select", choices: ["book", "higher"] },
  { section: "unifiedRulesRevampVehicles", path: "URR_V80.vehImpact", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampVehicles", path: "URR_V80.vehDamageSpeed.mode", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampVehicles", path: "URR_V80.vehGunnery.mode", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampVehicles", path: "URR_V80.vehMountHeavy", type: "select", choices: ["book", "ignore"] },
  { section: "unifiedRulesRevampVehicles", path: "URR_V80.vehRepairTn.mode", type: "select", choices: ["book", "stage"] },
  // v0.80.0 drones-security rows
  { section: "unifiedRulesRevampDronesSecurityAndEw", path: "URR_V80.dsLinkIntercept", type: "select", choices: ["book", "rcd"] },
  { section: "unifiedRulesRevampDronesSecurityAndEw", path: "URR_V80.dsInterceptTnPlus", type: "number" },
  { section: "unifiedRulesRevampDronesSecurityAndEw", path: "URR_V80.dsDecryptTnPlus", type: "number" },
  { section: "unifiedRulesRevampDronesSecurityAndEw", path: "URR_V80.dsRadioDecrypt", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampDronesSecurityAndEw", path: "URR_V80.dsLockCasing", type: "select", choices: ["book", "byType"] },
  { section: "unifiedRulesRevampDronesSecurityAndEw", path: "URR_V80.dsPasskey", type: "select", choices: ["book", "rating"] },
  { section: "unifiedRulesRevampDronesSecurityAndEw", path: "URR_V80.dsSequencer", type: "select", choices: ["book", "opposed"] },
  { section: "unifiedRulesRevampDronesSecurityAndEw", path: "URR_V80.dsMadScan", type: "select", choices: ["book", "highestDie"] },
  { section: "unifiedRulesRevampDronesSecurityAndEw", path: "URR_V80.dsDumpDisorient", type: "boolean" },
  { section: "unifiedRulesRevampDronesSecurityAndEw", path: "URR_V80.dsCommsEccm", type: "number" },
  // v0.80.0 magic rows
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magCastDice", type: "select", choices: ["sorcery", "force"] },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magElementalTn", type: "number" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magRuleOfOneDrain", type: "number" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magSpellTie", type: "select", choices: ["book", "caster"] },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magSustainCap", type: "select", choices: ["off", "block"] },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magExclusiveForce", type: "number" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magFetishForce", type: "number" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magLearning", type: "select", choices: ["book", "theory"] },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magRitualTeamCap", type: "boolean" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magRitualNoCombat", type: "boolean" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magRitualCircle", type: "boolean" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magRitualMaterials", type: "select", choices: ["book", "category"] },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magSpotterDrain", type: "boolean" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magRitualResistTn", type: "select", choices: ["force", "leader"] },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magConjDrain", type: "select", choices: ["book", "charisma"] },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magNatureOneOnly", type: "boolean" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magAstralReaction", type: "number" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magProjFullHours", type: "boolean" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magAstralDamage", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magTrackRating", type: "boolean" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magAstralDrainPhysical", type: "boolean" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magWardDrain", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magWardMaxForce", type: "number" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magSiteCost", type: "select", choices: ["book", "urr"] },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magAspectedNoAstral", type: "boolean" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magShamanistNoTotem", type: "boolean" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magAdeptFoci", type: "boolean" },
  { section: "unifiedRulesRevampMagic", path: "URR_V80.magLossLe", type: "boolean" },
  // v0.92.3: book alignment (rules/config923/*.ts).
  ...HOUSE_CORE_V923,
  ...HOUSE_COMBAT_V923,
  ...HOUSE_HEALTH_V923,
  ...HOUSE_SORCERY_V923,
  ...HOUSE_SPIRITS_V923,
  ...HOUSE_MATRIX_V923,
  ...HOUSE_VEHICLES_V923,
  ...HOUSE_GEAR_V923,
];

/**
 * v0.81.0 (SEC2-9): both walk own keys only and refuse `__proto__`, `prototype` and `constructor`: the house rules'
 * advanced JSON could otherwise swap the prototype of RULES or a section on every client (and survive Reset).
 */
export function getPath(obj: any, path: string): unknown {
  return String(path).split(".").reduce((o: any, k) => (o == null || typeof o !== "object" || !safeKey(k) || !Object.hasOwn(o, k) ? undefined : o[k]), obj);
}

export function setPath(obj: any, path: string, value: unknown): boolean {
  const keys = String(path).split(".");
  if (!keys.every(safeKey)) return false;
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (o == null || typeof o !== "object" || !Object.hasOwn(o, k)) return false;
    o = o[k];
  }
  const last = keys.at(-1)!;
  if (o == null || typeof o !== "object" || !Object.hasOwn(o, last)) return false;
  o[last] = value;
  return true;
}

/** Copy every default value back into RULES (arrays and objects replaced whole, in place). */
function restoreDefaults(target: any, src: any): void {
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object" && !Array.isArray(target[k])) restoreDefaults(target[k], v);
    else target[k] = structuredClone(v);
  }
}

/**
 * v0.81.1 (SEC2b-8): whether a house-rule value has the shape of the rule's default: numbers finite, strings,
 * booleans, a list whose entries each look like the default's entries, an object whose known keys keep their kind
 * (a table of like values: new keys of that kind too), and a `match` pattern that compiles. `null` for an object table,
 * `[null]` rows or `{match: '('}` broke every combat path, or every ranged lookup, on every client.
 */
export function ruleShapeOk(def: unknown, value: unknown, key = "", depth = 0, table?: { strings: ReadonlySet<string>; kinds: ReadonlySet<string> }): boolean {
  if (depth > 12) return true;
  if (def === null || def === undefined) return true;
  // v0.81.1 round 2 (FIX2-BRIEF I1, V-REST 1): a table cell may hold another scalar kind its table uses
  // (COMBAT.reloadFeed 'all' | number, SECURITY.concealment 'blind' | number). Round 3 (FIX3-BRIEF 8, V2 #9): a string
  // only when that exact string appears in the default table ('all', 'blind'; never "lots"), and a number or boolean
  // only when the cell's own enclosing table uses that kind (never carried down from a whole section).
  // A word in a mixed column (reloadFeed: 'all' or a number) is one of the column's own words.
  if (table && typeof def === "string" && typeof value === "string" && table.kinds.has("number") && key !== "match") return table.strings.has(value);
  if (table && isScalar(def) && isScalar(value) && typeof value !== typeof def) {
    if (typeof value === "string") return table.strings.has(value);
    return table.kinds.has(typeof value) && !(typeof value === "number" && Number.isNaN(value));
  }
  // A number may come back null: JSON stores Infinity (an open-ended band) as null.
  if (typeof def === "number") return (typeof value === "number" && !Number.isNaN(value)) || (value === null && !Number.isFinite(def));
  if (typeof def === "boolean") return typeof value === "boolean";
  if (typeof def === "string") {
    if (typeof value !== "string") return false;
    if (key === "match") { try { new RegExp(value); } catch { return false; } }
    return true;
  }
  if (typeof def === "function") return true;
  if (Array.isArray(def)) {
    if (!Array.isArray(value)) return false;
    if (!def.length) return true;
    const kinds = new Set(def.map(shapeKind));
    // A tuple ([ratio, 'L']): entry by entry. A list of like rows: each against the rows merged (optional keys).
    if (kinds.size > 1) return value.every((v, i) => ruleShapeOk(def[Math.min(i, def.length - 1)], v, key, depth + 1, table));
    const proto = def.slice(1).reduce((a, b) => mergeShape(a, b), def[0]);
    return value.every((v) => ruleShapeOk(proto, v, key, depth + 1, table));
  }
  if (typeof def === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const d = def as Record<string, unknown>;
    const kinds = new Set(Object.values(d).map(shapeKind));
    const like = kinds.size === 1 ? Object.values(d).reduce((a, b) => mergeShape(a, b)) : undefined;
    // v0.81.1 (lead, after V3 #2): only a table that mixes kinds by design lets a cell take another kind, and then only
    // a kind and a word that table uses (MIXED_TABLES); everywhere else each cell keeps its default's kind, as in round 1
    // (no `reachTnPerPoint: "none"`, no `tie: 7`, no `clip: "lots"`).
    const cells = table ?? (MIXED_TABLES.has(key) ? columnOf(scalarsIn(d)) : undefined);
    return Object.entries(value as Record<string, unknown>).every(([k, v]) => {
      if (!safeKey(k)) return false;
      if (Object.hasOwn(d, k)) return ruleShapeOk(d[k], v, k, depth + 1, cells);
      return like === undefined || ruleShapeOk(like, v, k, depth + 1, cells);
    });
  }
  return typeof value === typeof def;
}

/**
 * The rule tables whose cells mix a number with a word by design: `COMBAT.reloadFeed` ('all' or rounds) and
 * `SECURITY…concealment` (a modifier or 'blind'). Keyed by the table's own key.
 */
const MIXED_TABLES: ReadonlySet<string> = new Set(["reloadFeed", "concealment"]);

/** Every scalar in a default table (depth-capped). */
function scalarsIn(o: unknown, depth = 0, out: unknown[] = []): unknown[] {
  if (depth > 6) return out;
  if (isScalar(o)) out.push(o);
  else if (o && typeof o === "object") for (const v of Object.values(o as Record<string, unknown>)) scalarsIn(v, depth + 1, out);
  return out;
}

/** The words and scalar kinds a list of default cells uses (non-scalars skipped). */
function columnOf(cells: unknown[]): { strings: ReadonlySet<string>; kinds: ReadonlySet<string> } {
  const strings = new Set<string>(); const kinds = new Set<string>();
  for (const c of cells) { if (!isScalar(c)) continue; kinds.add(typeof c); if (typeof c === "string") strings.add(c); }
  return { strings, kinds };
}

/** A number, string or boolean. */
function isScalar(v: unknown): boolean { return typeof v === "number" || typeof v === "string" || typeof v === "boolean"; }

/** A default value's kind for the shape check. */
function shapeKind(x: unknown): string {
  return Array.isArray(x) ? "array" : x === null ? "null" : typeof x;
}

/** Two default rows merged into one shape (each key's first kind; nested objects merged too). */
function mergeShape(a: any, b: any): any {
  // An open-ended number (Infinity) in any row lets every row's value be null (as JSON stores it).
  if (typeof a === "number" && typeof b === "number") return Number.isFinite(a) ? b : a;
  if (!a || typeof a !== "object" || Array.isArray(a) || !b || typeof b !== "object" || Array.isArray(b)) return a ?? b;
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Object.hasOwn(out, k) ? mergeShape(out[k], v) : v;
  return out;
}

/** Coerce a value to the type of the rule's default (numbers, booleans, strings; objects and lists of its shape). */
export function coerceRule(path: string, value: unknown): { ok: boolean; value: unknown } {
  const def = getPath(RULE_DEFAULTS, path);
  if (def === undefined) return { ok: false, value };
  if (typeof def === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, value };
  }
  if (typeof def === "boolean") return { ok: true, value: value === true || value === "true" || value === "on" || value === 1 };
  if (typeof def === "string") return { ok: typeof value === "string", value };
  return { ok: typeof value === typeof def && ruleShapeOk(def, value, String(path).split(".").at(-1) ?? ""), value };
}

export interface HouseRules { values?: Record<string, unknown>; advanced?: Record<string, unknown> }

/**
 * v0.80.0: the world's rules source ("SR2E Book Rules" or "SR2E Unified Rules Revamp"). The Revamp is a layer
 * between the shipped RULES and the house rules: shipped values → URR_V80_PATCH → the GM's house-rule values.
 */
let rulesSourceNow: RulesSource = "book";
export function currentRulesSource(): RulesSource { return rulesSourceNow; }
export function isRulesSource(v: unknown): v is RulesSource { return typeof v === "string" && Object.hasOwn(RULES_SOURCES, v); }
/** Set the source (the house rules must be applied again afterwards: registerSettings does both). */
export function setRulesSource(v: unknown): RulesSource {
  rulesSourceNow = isRulesSource(v) ? v : "book";
  return rulesSourceNow;
}

/** The patch a rules source lays over the shipped values (empty for the book). */
export function sourcePatch(source: RulesSource = rulesSourceNow): Record<string, unknown> {
  return source === "urr" ? URR_V80_PATCH : {};
}

/** A rule's value before the house rules: the shipped value, or the rules source's when it changes it. */
export function baseRule(path: string, source: RulesSource = rulesSourceNow): unknown {
  const patch = sourcePatch(source);
  return path in patch ? patch[path] : getPath(RULE_DEFAULTS, path);
}

/** The curated house-rule rows the rules source changes (for the settings window). */
export function sourceChangedRules(source: RulesSource = rulesSourceNow): string[] {
  const patch = sourcePatch(source);
  return HOUSE_RULES.filter((d) => d.path in patch && patch[d.path] !== getPath(RULE_DEFAULTS, d.path)).map((d) => d.path);
}

/**
 * Reset RULES to the shipped values, lay the rules source's patch over them, then apply the house rules.
 * Returns problems (unknown paths, wrong types).
 */
export function applyHouseRules(stored: HouseRules | null | undefined, source: RulesSource = rulesSourceNow): string[] {
  restoreDefaults(RULES, RULE_DEFAULTS);
  const problems: string[] = [];
  for (const [path, raw] of Object.entries(sourcePatch(source))) {
    const c = coerceRule(path, raw);
    if (!c.ok || !setPath(RULES, path, structuredClone(c.value))) problems.push(`${path}: ${tKey(RULES_SOURCES[source])} sets an unknown rule or the wrong kind of value`);
  }
  const all = { ...(stored?.advanced ?? {}), ...(stored?.values ?? {}) };
  for (const [path, raw] of Object.entries(all)) {
    const c = coerceRule(path, raw);
    if (!c.ok || !setPath(RULES, path, c.value)) problems.push(`${path}: not a rule, or the wrong kind of value`);
  }
  return problems;
}

/**
 * v0.80.0 (review #1): whether the house-rules window keeps a row's value on Save. A row the GM didn't touch keeps the
 * value stored for it (even when it equals this source's base: it may be an override of the other source); otherwise
 * only values that differ from the base are stored.
 */
export function keepHouseValue(path: string, value: unknown, stored: Record<string, unknown> | undefined, source: RulesSource = rulesSourceNow): boolean {
  if (stored && Object.hasOwn(stored, path) && stored[path] === value) return true;
  return value !== baseRule(path, source);
}

/**
 * v0.80.0 (review #2): after the rules change (house rules or the rules source), prepare every actor again (world
 * actors and unlinked token actors), so derived values (pools, maximums, astral, Speed) follow the new rules, then
 * re-render the open sheets, the house-rules window and the GM panel.
 */
export function refreshAfterRulesChange(opts: { houseWindow?: boolean } = {}): void {
  const g: any = globalThis as any;
  const prep = (a: any) => { try { a?.reset?.(); a?.prepareData?.(); } catch (err) { console.warn("SR2e: could not prepare", a?.name, err); } };
  for (const a of [...(g.game?.actors ?? [])]) prep(a);
  for (const sc of [...(g.game?.scenes ?? [])]) for (const t of [...(sc.tokens ?? [])]) if (!t.actorLink && t.actor) prep(t.actor);
  const inst: any = g.foundry?.applications?.instances;
  for (const app of (inst?.values ? [...inst.values()] : Object.values(inst ?? {}))) {
    const a: any = app;
    if (!a?.rendered) continue;
    if (a.document || a.id === "sr2e-gm-panel" || (opts.houseWindow && a.id === "sr2e-house-rules")) a.render?.();
  }
}

/** Which curated rules differ from their base (the shipped value, or the rules source's) (for the settings window). */
export function changedRules(): string[] {
  return HOUSE_RULES.filter((d) => getPath(RULES, d.path) !== baseRule(d.path)).map((d) => d.path);
}

const esc = escHtml;

/** The Skill Web editor (v0.38.0): a textarea of links, "Firearms - Gunnery: 1". */
export class SkillWebConfig extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "sr2e-skill-web",
    tag: "form",
    window: { title: 'SR2E.Window.Settings.sr2eSkillWeb', icon: "fa-solid fa-diagram-project", resizable: true },
    position: { width: 480, height: 560 },
    form: { handler: SkillWebConfig.#onSubmit, closeOnSubmit: true },
  };

  async _renderHTML(): Promise<string> {
    const text = String(game.settings.get(SYSTEM.id, "skillWeb") ?? "");
    const n = parseSkillWeb(text).length;
    const w = RULES.SKILLS.web;
    return `<div class="standard-form">
      <p class="hint">${tx('SR2E.App.Settings.oneLinkPerLine')} <code>Firearms - Gunnery: 1</code> ${tCount(n, 'SR2E.App.Settings.theNumberIsTheStepsBetween', { perStep: w.perStep, maxSteps: w.maxSteps, part: w.unlinked === "flat" ? tx('SR2E.App.Settings.defaultAt', { skillDefaultTnMod: RULES.SKILL_DEFAULT_TN_MOD }) : tx('SR2E.App.Settings.canOnlyDefaultToTheAttribute'), skillDefaultTnMod: RULES.SKILL_DEFAULT_TN_MOD })}</p>
      <textarea name="web" rows="18" spellcheck="false" style="font-family: monospace">${esc(text)}</textarea>
      <footer class="form-footer"><button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${tx('SR2E.App.Settings.save')}</button></footer>
    </div>`;
  }

  _replaceHTML(result: string, content: HTMLElement): void {
    content.innerHTML = result;
  }

  static async #onSubmit(_event: Event, form: HTMLFormElement): Promise<void> {
    await game.settings.set(SYSTEM.id, "skillWeb", String((form.elements as any).web?.value ?? ""));
  }
}

/** v0.60.0: default privacy per kind of test (client setting `rollPrivacy`: {group: mode}). */
export class RollPrivacyConfig extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "sr2e-roll-privacy",
    tag: "form",
    window: { title: 'SR2E.Window.Settings.sr2eRollPrivacy', icon: "fa-solid fa-eye-slash", resizable: true },
    position: { width: 460, height: "auto" as const },
    form: { handler: RollPrivacyConfig.#onSubmit, closeOnSubmit: true },
  };

  async _renderHTML(): Promise<string> {
    const prefs = (game.settings.get(SYSTEM.id, "rollPrivacy") ?? {}) as Record<string, string>;
    const rows = PRIVACY_GROUPS.map((g) => `<div class="form-group"><label>${esc(tKey(g.label))}</label><div class="form-fields"><select name="${esc(g.id)}">${PRIVACY_MODES.map((m) => `<option value="${esc(m.id)}"${String(prefs[g.id] ?? "") === m.id ? " selected" : ""}>${esc(tKey(m.label))}</option>`).join("")}</select></div></div>`).join("");
    return `<div class="standard-form">
      <p class="hint">${tx('SR2E.App.Settings.whoSeesEachKindOfTest')}</p>
      ${rows}
      <footer class="form-footer"><button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${tx('SR2E.App.Settings.save')}</button></footer>
    </div>`;
  }

  _replaceHTML(result: string, content: HTMLElement): void {
    content.innerHTML = result;
  }

  static async #onSubmit(_event: Event, form: HTMLFormElement): Promise<void> {
    const out: Record<string, string> = {};
    for (const g of PRIVACY_GROUPS) {
      const v = String((form.elements as any)[g.id]?.value ?? "");
      if (v) out[g.id] = v;
    }
    await game.settings.set(SYSTEM.id, "rollPrivacy", out);
  }
}

/** The settings window: the curated rules by section, the advanced overrides, Save and Reset. */
export class HouseRulesConfig extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "sr2e-house-rules",
    tag: "form",
    window: { title: 'SR2E.Window.Settings.sr2eHouseRules', icon: "fa-solid fa-scale-balanced", resizable: true },
    position: { width: 560, height: 680 },
    form: { handler: HouseRulesConfig.#onSubmit, closeOnSubmit: true },
    actions: { resetRules: HouseRulesConfig.#onReset },
  };

  async _renderHTML(): Promise<string> {
    const stored = (game.settings.get(SYSTEM.id, "houseRules") ?? {}) as HouseRules;
    const values = stored.values ?? {};
    const sections = [...new Set(HOUSE_RULES.map((d) => d.section))];
    // v0.80.0: under the Unified Rules Revamp the default shown is the Revamp's value, and the rows it changes are marked.
    const source = currentRulesSource();
    const bySource = new Set(sourceChangedRules(source));
    const field = (d: HouseRuleDef, i: number) => {
      const def = baseRule(d.path, source);
      const book = getPath(RULE_DEFAULTS, d.path);
      const cur = d.path in values ? values[d.path] : def;
      const changed = d.path in values && values[d.path] !== def;
      const urr = bySource.has(d.path);
      const name = `rule-${i}`;
      const input = d.type === "boolean"
        ? `<input type="checkbox" name="${name}" ${cur ? "checked" : ""}>`
        : d.type === "select"
        ? `<select name="${name}">${(d.choices ?? []).map((c) => `<option value="${esc(c)}" ${c === cur ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>`
        : `<input type="number" name="${name}" value="${esc(cur)}" ${d.step ? `step="${d.step}"` : ""}>`;
      const srcNote = urr ? ` · <span class="sr2e-hr-urr">${tx('SR2E.App.Settings.book', { rulesSourcesUrr: esc(tKey(RULES_SOURCES.urr)), book: esc(book) })}</span>` : "";
      return `<div class="form-group${changed ? " sr2e-changed" : ""}${urr ? " sr2e-urr" : ""}" data-sr2e-find="${esc(`${houseRuleLabel(d)} ${d.path} ${houseRuleSection(d.section)}${urr ? " revamp urr" : ""}`)}"><label>${esc(houseRuleLabel(d))}</label><div class="form-fields">${input}</div><p class="hint">${tx('SR2E.App.Settings.default', { def: esc(def), srcNote, part: changed ? tx('SR2E.App.Settings.changed') : "" })}</p></div>`;
    };
    // v0.68.0: each section can fold (click its title); the bar on top finds a rule and jumps to a section.
    const body = sections.map((sec, n) => `<fieldset id="sr2e-hr-sec-${n}"><legend title="${tx('SR2E.App.Settings.clickToFold')}">${esc(houseRuleSection(sec))}</legend>${HOUSE_RULES.map((d, i) => (d.section === sec ? field(d, i) : "")).join("")}</fieldset>`).join("");
    const tools = `<div class="sr2e-hr-tools"><input type="search" class="sr2e-hr-find" placeholder="${tx('SR2E.App.Settings.findARule')}" aria-label="${tx('SR2E.App.Settings.findARule2')}">
      <nav aria-label="${tx('SR2E.App.Settings.sections')}">${sections.map((sec, n) => `<a data-sr2e-jump="sr2e-hr-sec-${n}">${esc(houseRuleSection(sec))}</a>`).join("")}<a data-sr2e-jump="sr2e-hr-advanced">${tx('SR2E.App.Settings.advanced')}</a></nav>
      <p class="sr2e-hr-none hint" hidden>${tx('SR2E.App.Settings.noRuleMatches')}</p></div>`;
    const advanced = JSON.stringify(stored.advanced ?? {}, null, 2);
    return `<div class="sr2e-house-rules standard-form scrollable">
      <p class="hint">${tx('SR2E.App.Settings.changesApplyForEveryoneStraightAway')} <code>RULES</code> ${tx('SR2E.App.Settings.in')} <code>src/module/rules/config.ts</code>. ${((n) => tCount(n, 'SR2E.App.Settings.ofTheRulesBelowDifferFrom'))(changedRules().length)}</p>
      <p class="hint sr2e-hr-source">${source === "urr" ? tx('SR2E.App.Settings.rulesSourceRevamp', { source: `<strong>${esc(tKey(RULES_SOURCES[source]))}</strong>`, value: Object.keys(sourcePatch(source)).length - 1, bySourceSize: bySource.size }) : tx('SR2E.App.Settings.rulesSourceConfigure', { source: `<strong>${esc(tKey(RULES_SOURCES[source]))}</strong>` })}</p>
      ${tools}
      ${body}
      <fieldset id="sr2e-hr-advanced"><legend>${tx('SR2E.App.Settings.advanced')}</legend>
        <p class="hint">${tx('SR2E.App.Settings.anyOtherRuleByItsPath')} <code>{"COMBAT.prone.targetMelee": -1, "HEALING.natural.periodHours.physical": 12}</code>${tx('SR2E.App.Settings.theFieldsAboveWinOverThe')}</p>
        <textarea name="advanced" rows="6" spellcheck="false">${esc(advanced)}</textarea>
      </fieldset>
      <footer class="form-footer">
        <button type="button" data-action="resetRules"><i class="fa-solid fa-rotate-left"></i> ${tx('SR2E.App.Settings.resetAllToDefaults')}</button>
        <button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${tx('SR2E.App.Settings.save')}</button>
      </footer>
    </div>`;
  }

  _replaceHTML(result: string, content: HTMLElement): void {
    content.innerHTML = result;
    // v0.68.0: search, section links and folding.
    const root = content.querySelector<HTMLElement>(".sr2e-house-rules");
    if (!root) return;
    const find = root.querySelector<HTMLInputElement>(".sr2e-hr-find");
    const none = root.querySelector<HTMLElement>(".sr2e-hr-none");
    const filter = () => {
      const q = find?.value ?? "";
      let shown = 0;
      for (const fs of Array.from(root.querySelectorAll<HTMLFieldSetElement>("fieldset[id^='sr2e-hr-sec-']"))) {
        let any = false;
        for (const g of Array.from(fs.querySelectorAll<HTMLElement>(".form-group[data-sr2e-find]"))) {
          const ok = settingMatches([g.dataset["sr2eFind"], g.querySelector(".hint")?.textContent], q);
          g.classList.toggle("sr2e-hr-hidden", !ok);
          if (ok) { any = true; shown++; }
        }
        fs.classList.toggle("sr2e-hr-hidden", !any);
        if (q.trim() && any) fs.classList.remove("sr2e-folded");
      }
      if (none) none.hidden = !(q.trim() && !shown);
    };
    find?.addEventListener("input", filter);
    find?.addEventListener("keydown", (ev) => { if (ev.key === "Enter") ev.preventDefault(); });
    find?.addEventListener("change", (ev) => ev.stopPropagation());
    for (const a of Array.from(root.querySelectorAll<HTMLElement>("[data-sr2e-jump]"))) {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const fs = root.querySelector<HTMLElement>(`#${a.dataset["sr2eJump"]}`);
        fs?.classList.remove("sr2e-folded", "sr2e-hr-hidden");
        fs?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }
    for (const lg of Array.from(root.querySelectorAll<HTMLElement>("fieldset > legend"))) {
      // v0.86.0: a folding legend is a button for the keyboard (applications/a11y.ts presses it on Enter or Space).
      lg.classList.add("sr2e-hr-fold");
      lg.addEventListener("click", () => {
        const folded = lg.parentElement?.classList.toggle("sr2e-folded");
        lg.setAttribute("aria-expanded", String(!folded));
      });
    }
  }

  static async #onSubmit(_event: Event, form: HTMLFormElement): Promise<void> {
    const el: any = form.elements;
    const values: Record<string, unknown> = {};
    const prior = ((game.settings.get(SYSTEM.id, "houseRules") ?? {}) as HouseRules).values ?? {};
    HOUSE_RULES.forEach((d, i) => {
      const input = el[`rule-${i}`];
      if (!input) return;
      const raw = d.type === "boolean" ? Boolean(input.checked) : input.value;
      const c = coerceRule(d.path, raw);
      if (c.ok && keepHouseValue(d.path, c.value, prior)) values[d.path] = c.value;
    });
    let advanced: Record<string, unknown> = {};
    const text = String(el.advanced?.value ?? "").trim();
    if (text) {
      try {
        advanced = JSON.parse(text);
        if (!advanced || typeof advanced !== "object" || Array.isArray(advanced)) throw new Error("not an object");
      } catch (err) {
        ui.notifications?.error?.(tx('SR2E.Notify.Settings.sr2eHouseRulesTheAdvancedBox', { errMessage: escHtml((err as Error).message) }));
        // v0.81.0 (A-7): thrown, not returned, so the window stays open with the GM's edits (AppV2 closes after a
        // form handler that returns).
        throw new Error(tx('SR2E.App.Settings.sr2eHouseRulesTheAdvancedBox'));
      }
    }
    await game.settings.set(SYSTEM.id, "houseRules", { values, advanced });
    const problems = applyHouseRules({ values, advanced });
    if (problems.length) ui.notifications?.warn?.(tx('SR2E.Notify.Settings.sr2eHouseRulesIgnored', { problems: escHtml(problems.join("; ")) }));
    else ui.notifications?.info?.(tx('SR2E.Notify.Settings.sr2eHouseRulesSavedChanged', { value: Object.keys(values).length + Object.keys(advanced).length }));
  }

  static async #onReset(this: HouseRulesConfig): Promise<void> {
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Settings.resetHouseRules') }, content: `<p>${tx('SR2E.Dialog.Settings.putEveryRuleBackToThe')} <strong>${esc(tKey(RULES_SOURCES[currentRulesSource()]))}</strong>${tx('SR2E.Dialog.Settings.yourHouseRulesForBothRules')}</p>` });
    if (!ok) return;
    // A-19: the setting's onChange applies the (empty) house rules on every client, this one included.
    await game.settings.set(SYSTEM.id, "houseRules", { values: {}, advanced: {} });
    this.render();
  }
}

/** Register the settings (call in init). House rules apply straight away. */
/**
 * v0.89.4: the rules tables' labels and notes in the user's language: RULES, the defaults it is restored from and the
 * Revamp's patch, translated in place (keys `SR2E.Rules.*` / `SR2E.RulesUrr.*`, rules/rulestext.ts). Run once the
 * languages are loaded (i18nInit); the house rules are restored from the translated copies afterwards.
 */
export function localizeRulesTexts(): number {
  const i18n: any = (globalThis as any).game?.i18n;
  if (!i18n?.has || !i18n?.localize) return 0;
  const lookup = (k: string): string | null => (i18n.has(k) ? String(i18n.localize(k)) : null);
  return localizeRules(RULES, "SR2E.Rules", lookup) + localizeRules(RULE_DEFAULTS, "SR2E.Rules", lookup) + localizePatch(URR_V80_PATCH as Record<string, unknown>, "SR2E.RulesUrr", lookup)
    + TEXT_TABLES.reduce((n, t) => n + localizeTable(t, lookup), 0);
}

export function registerSettings(): void {
  // The house rules refused at load, reported to the GM at ready (set at init, and again at i18nInit).
  let problemsNow: string[] = [];
  Hooks.once("i18nInit", () => {
    try { localizeRulesTexts(); } catch (err) { console.warn("SR2e | rules texts not translated", err); }
    // v0.89.4 review: the rules source and the house rules were applied at init; translating rewrote the tables'
    // texts from the shipped ones, so they are applied again over the translated copies (the Revamp's own labels).
    try { problemsNow = applyHouseRules(game.settings.get(SYSTEM.id, "houseRules") as HouseRules); } catch (err) { console.warn("SR2e | house rules not applied again", err); }
  });
  game.settings.register(SYSTEM.id, "houseRules", {
    scope: "world", config: false, type: Object, default: { values: {}, advanced: {} },
    onChange: (v: HouseRules) => {
      applyHouseRules(v);
      // v0.68.0: v14 keeps the open windows in a Map; v0.80.0: actors are prepared again too.
      refreshAfterRulesChange();
    },
  });
  // v0.80.0: the rules source, a layer under the house rules (applied straight away, no reload).
  game.settings.register(SYSTEM.id, "rulesSource", {
    name: "SR2E.Settings.rulesSource.Name",
    hint: "SR2E.Settings.rulesSource.Hint",
    scope: "world", config: true, type: String, default: "book",
    choices: { ...RULES_SOURCES },
    onChange: (v: string) => {
      setRulesSource(v);
      applyHouseRules(game.settings.get(SYSTEM.id, "houseRules") as HouseRules);
      refreshAfterRulesChange({ houseWindow: true });
    },
  });
  game.settings.registerMenu(SYSTEM.id, "houseRulesMenu", {
    name: "SR2E.Settings.houseRulesMenu.Name", label: "SR2E.Settings.houseRulesMenu.Label", hint: "SR2E.Settings.houseRulesMenu.Hint",
    icon: "fa-solid fa-scale-balanced", type: HouseRulesConfig, restricted: true,
  });
  game.settings.register(SYSTEM.id, "defendPrompt", {
    name: "SR2E.Settings.defendPrompt.Name", hint: "SR2E.Settings.defendPrompt.Hint",
    scope: "client", config: true, type: String, default: "dialog",
    choices: { dialog: "SR2E.Settings.defendPrompt.Choices.dialog", notify: "SR2E.Settings.defendPrompt.Choices.notify", off: "SR2E.Settings.defendPrompt.Choices.off" },
  });
  game.settings.register(SYSTEM.id, "foldDice", {
    name: "SR2E.Settings.foldDice.Name", hint: "SR2E.Settings.foldDice.Hint",
    scope: "client", config: true, type: Boolean, default: true,
  });
  game.settings.register(SYSTEM.id, "floatingDamage", {
    name: "SR2E.Settings.floatingDamage.Name", hint: "SR2E.Settings.floatingDamage.Hint",
    scope: "client", config: true, type: Boolean, default: true,
  });
  // v0.59.0: Apply (GM) cards a player's client posts are applied by the active GM's client at once.
  game.settings.register(SYSTEM.id, "autoApplyGm", {
    name: "SR2E.Settings.autoApplyGm.Name", hint: "SR2E.Settings.autoApplyGm.Hint",
    // v0.81.0 (owner, 24 Oct 2026): off by default, as the security audit recommends (SEC1-4).
    scope: "world", config: true, type: Boolean, default: false,
  });
  game.settings.register(SYSTEM.id, "karmaRefreshDay", { scope: "world", config: false, type: String, default: "" });
  // v0.60.0: scene regions, NPCs resisting by themselves, roll privacy per kind, turn pings, hover cards, sounds.
  game.settings.register(SYSTEM.id, "wardsStopAstral", {
    name: "SR2E.Settings.wardsStopAstral.Name", hint: "SR2E.Settings.wardsStopAstral.Hint",
    scope: "world", config: true, type: String, default: "block",
    choices: { block: "SR2E.Settings.wardsStopAstral.Choices.block", warn: "SR2E.Settings.wardsStopAstral.Choices.warn", off: "SR2E.Settings.wardsStopAstral.Choices.off" },
  });
  game.settings.register(SYSTEM.id, "regionDetect", {
    name: "SR2E.Settings.regionDetect.Name", hint: "SR2E.Settings.regionDetect.Hint",
    scope: "world", config: true, type: String, default: "prompt",
    choices: { prompt: "SR2E.Settings.regionDetect.Choices.prompt", auto: "SR2E.Settings.regionDetect.Choices.auto", off: "SR2E.Settings.regionDetect.Choices.off" },
  });
  game.settings.register(SYSTEM.id, "autoResistNpc", {
    name: "SR2E.Settings.autoResistNpc.Name", hint: "SR2E.Settings.autoResistNpc.Hint",
    scope: "world", config: true, type: Boolean, default: false,
  });
  // v0.91.0: what players see in the shop (the Add window), and whether forbidden things are among it.
  game.settings.register(SYSTEM.id, "shopList", {
    name: "SR2E.Settings.shopList.Name",
    hint: "SR2E.Settings.shopList.Hint",
    scope: "world", config: true, type: String, default: "all",
    choices: { ...SHOP_LIST_MODES },
    onChange: () => refreshShops(),
  });
  game.settings.register(SYSTEM.id, "shopForbidden", {
    name: "SR2E.Settings.shopForbidden.Name",
    hint: "SR2E.Settings.shopForbidden.Hint",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: () => refreshShops(),
  });
  // v0.64.0: the approval queue.
  game.settings.register(SYSTEM.id, "approvalQueue", {
    name: "SR2E.Settings.approvalQueue.Name",
    hint: "SR2E.Settings.approvalQueue.Hint",
    scope: "world", config: true, type: Boolean, default: false,
  });
  game.settings.register(SYSTEM.id, "rollPrivacy", { scope: "client", config: false, type: Object, default: {} });
  game.settings.registerMenu(SYSTEM.id, "rollPrivacyMenu", {
    name: "SR2E.Settings.rollPrivacyMenu.Name", label: "SR2E.Settings.rollPrivacyMenu.Label", hint: "SR2E.Settings.rollPrivacyMenu.Hint",
    icon: "fa-solid fa-eye-slash", type: RollPrivacyConfig, restricted: false,
  });
  game.settings.register(SYSTEM.id, "turnPing", {
    name: "SR2E.Settings.turnPing.Name", hint: "SR2E.Settings.turnPing.Hint",
    scope: "client", config: true, type: Boolean, default: true,
  });
  game.settings.register(SYSTEM.id, "hoverCard", {
    name: "SR2E.Settings.hoverCard.Name", hint: "SR2E.Settings.hoverCard.Hint",
    scope: "client", config: true, type: Boolean, default: true,
  });
  game.settings.register(SYSTEM.id, "soundCues", {
    name: "SR2E.Settings.soundCues.Name", hint: "SR2E.Settings.soundCues.Hint",
    scope: "client", config: true, type: Boolean, default: false,
  });
  game.settings.register(SYSTEM.id, "soundVolume", {
    name: "SR2E.Settings.soundVolume.Name", scope: "client", config: true, type: Number, default: 0.6, range: { min: 0, max: 1, step: 0.05 },
  });
  for (const ev of SOUND_EVENTS) {
    game.settings.register(SYSTEM.id, `sound.${ev.id}`, {
      name: ev.label, hint: "SR2E.Settings.sound.Hint", scope: "client", config: true, type: String, default: ev.src, filePicker: "audio",
    } as any);
  }
  // v0.41.0: world item templates, dice colours, Dice So Nice colours.
  game.settings.register(SYSTEM.id, "itemTemplates", { scope: "world", config: false, type: Array, default: [], onChange: () => refreshShops() });
  // v0.91.4 review (B1): vehicle orders as the GM recorded them (id → buyer, key, purchaser, what was paid); only the GM writes it.
  game.settings.register(SYSTEM.id, "vehicleOrders", { scope: "world", config: false, type: Object, default: {} });
  // v0.66.0: starter kits and the session checklist (GM panel, Setup tab).
  game.settings.register(SYSTEM.id, "starterKits", { scope: "world", config: false, type: Array, default: [] });
  game.settings.register(SYSTEM.id, "sessionChecklist", { scope: "world", config: false, type: Object, default: {} });
  game.settings.register(SYSTEM.id, "tokenSetup", { scope: "world", config: false, type: Object, default: {} });
  // v0.66.0: Item Piles and Health Estimate support (on by default when those modules are active).
  game.settings.register(SYSTEM.id, "moduleSupport", {
    name: "SR2E.Settings.moduleSupport.Name",
    hint: "SR2E.Settings.moduleSupport.Hint",
    scope: "world", config: true, type: Boolean, default: true, requiresReload: true,
  });
  // v0.91.7: other modules' windows in one theme (Monk's Enhanced Journal's own dark backgrounds when Foundry is dark).
  game.settings.register(SYSTEM.id, "moduleSupportLook", {
    name: "SR2E.Settings.moduleSupportLook.Name",
    hint: "SR2E.Settings.moduleSupportLook.Hint",
    scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(SYSTEM.id, "moduleLookDone", { scope: "client", config: false, type: Object, default: {} });
  // v0.45.0: magical groups (members, strictures, shared sites, grimoire, breaches).
  game.settings.register(SYSTEM.id, "magicGroups", { scope: "world", config: false, type: Array, default: [] });
  // v0.51.0: GM panel scene presets and per-scene encounter notes.
  game.settings.register(SYSTEM.id, "scenePresets", { scope: "world", config: false, type: Array, default: [] });
  game.settings.register(SYSTEM.id, "encounterNotes", { scope: "world", config: false, type: Object, default: {} });
  game.settings.register(SYSTEM.id, "diceColours", {
    name: "SR2E.Settings.diceColours.Name", hint: "SR2E.Settings.diceColours.Hint",
    scope: "client", config: true, type: String, default: "default",
    choices: { default: "SR2E.Settings.diceColours.Choices.default", colourblind: "SR2E.Settings.diceColours.Choices.colourblind", contrast: "SR2E.Settings.diceColours.Choices.contrast" },
    onChange: (v: string) => applyDiceColours(v),
  });
  game.settings.register(SYSTEM.id, "dsnColours", {
    name: "SR2E.Settings.dsnColours.Name", hint: "SR2E.Settings.dsnColours.Hint",
    scope: "client", config: true, type: Boolean, default: true,
  });
  // The Skill Web (v0.38.0): the GM's links between skills, one per line.
  game.settings.register(SYSTEM.id, "skillWeb", {
    scope: "world", config: false, type: String, default: "",
    onChange: (v: string) => setSkillWeb(parseSkillWeb(v)),
  });
  game.settings.registerMenu(SYSTEM.id, "skillWebMenu", {
    name: "SR2E.Settings.skillWebMenu.Name", label: "SR2E.Settings.skillWebMenu.Label", hint: "SR2E.Settings.skillWebMenu.Hint",
    icon: "fa-solid fa-diagram-project", type: SkillWebConfig, restricted: true,
  });
  setSkillWeb(parseSkillWeb(String(game.settings.get(SYSTEM.id, "skillWeb") ?? "")));
  setRulesSource(game.settings.get(SYSTEM.id, "rulesSource"));
  const problems = applyHouseRules(game.settings.get(SYSTEM.id, "houseRules") as HouseRules);
  problemsNow = problems;
  if (problems.length) console.warn(`${SYSTEM.LOG.HEAD}House rules ignored: ${problems.join("; ")}`);
  // v0.81.1 round 3 (V2 #17): the GM is told too, once per new list (worlds that ran the 0.81.1 migration before its
  // note listed refused rules get it here).
  game.settings.register(SYSTEM.id, "houseRulesReported", { scope: "world", config: false, type: String, default: "" });
  Hooks.once("ready", () => { void reportRefusedHouseRules(problemsNow); });
}

/** v0.81.1 round 3: whisper the active GM the house rules refused at load, once for each new list. */
export async function reportRefusedHouseRules(problems: readonly string[]): Promise<boolean> {
  try {
    if (!(game as any).user?.isGM) return false;
    await leadSettled();
    if (!isLeadGm()) return false;
    const key = problems.join("\n");
    if (key === String(game.settings.get(SYSTEM.id, "houseRulesReported") ?? "")) return false;
    await game.settings.set(SYSTEM.id, "houseRulesReported", key);
    if (!problems.length) return false;
    const gms = [...((game as any).users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);
    await (globalThis as any).ChatMessage?.create?.({ whisper: gms, content: `<p><strong>${tx('SR2E.App.Settings.sr2eHouseRulesNotApplied')}</strong> ${tx('SR2E.App.Settings.eachLineSaysWhyCheckThe', { problems: problems.map((x) => `<code>${escHtml(x)}</code>`).join(", ") })}</p>` });
    return true;
  } catch { return false; }
}
