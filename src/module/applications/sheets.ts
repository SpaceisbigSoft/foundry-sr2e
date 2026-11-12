import { importIntoCharacter } from './catalogue.ts';
import { sysNow } from '../helpers/clock.ts';
import { nextInitiationGrade } from '../rules/spirits923.ts';
import { askFindThrough } from './through.ts';
import { learnFromFormulaDialog, learnFromTeacherDialog } from './formulas.ts';
import { teachersOn } from '../rules/formulas.ts';
import { interpMark } from '../rules/interpretations.ts';
import { castingPoolMax } from '../rules/docs79-drones-magic.ts';
import { metamagicAllowed } from "../rules/sorcery.ts";
import { ATTRIBUTE_KEYS, type AttributeKey } from "../models/index.ts";
import { dropItemOnActor } from "./drops.ts";
import { allActors, actorLabel } from "../helpers/actors.ts";
import { clearFlag, replaceFlag, replaceFlagUpdate } from "../helpers/flags.ts";
import { effectsContext } from "./effects.ts";
import { postItemToChat } from "./richtext.ts";
import { SYSTEM } from "../config/system.ts";
import { SR2Actor } from "../documents/index.ts";
import { tokenOf, tokenDistance, attackerToken, attackTargetOptions, measureTokens, lineOfSight, sightCover, movedThisTurn, tokensNear, targetLight, barriersBetween, tokensInCone, friendsInMelee, isProne, scatterPoint, wallsBetweenPoints, smokeBetweenTokens, placeArea } from "./canvas.ts";
import { wardsBetween } from "./regions.ts";
import {
  RANGE_BANDS, checkWeaponDistance, type RangeCheck,
  weaponRange, effectiveStrength, visibilityModifier, movementState, shotgunSpread, splitRounds, damageLabel,
  meleeReachMetres, reloadAmount, shotgunTnModifier, barrierArmor, smokeModifier, actionsLeftLabel, woundLevel, proneModifiers, friendsModifiers, chargeModifiers, wastedRounds, grenadeKind, scatterDiceFor,
  type CalledShotEffect, parseStatBlock, parseFiringModes, specializationMatches, RULES,
  maxBoundElementals, SPIRIT_KINDS, UTILITY_KINDS, IC_CATEGORIES, IC_BEHAVIORS, IC_BEHAVIOR_LABELS, TRACE_MODES, PERSONA_ATTRIBUTES, icActionKind, programSize, behaviorFromName, smartlinkModifier, cyberCost, wareCost, bioEffect, ASTRAL_MODES, TRADITIONS, METAMAGIC, questStatus, FOCUS_TYPES, availableSustainingFocus, sorceryFocusDice, totemDice, POWER_DICE_SOURCES, POWER_TN_SOURCES, POWER_RESIST,
  personaWarnings, areaRadius, bindingCost, spellKarmaCost, MATERIAL_KINDS, blastRadius, blastFalloff,
  handlingFor, overSpeed, crashDamage, vehicleCategory, canFireMount, rcdCapacity, ramDamage,
  type RangeBand, type FiringMode,
  itemPrice, getSkillWeb, relatedDefaultTn, buildCheck, BUILD_COLUMNS, PRIORITY_LETTERS, type BuildColumn, type Priority, type BuildInput,
  siteRaiseCost, gradedAvailability, optionalTraditionOn, isShamanic, initiationCost, designDrain,
  PSYCHOTROPIC_LABELS, mirrorsTn, carryLimit, icInitiativeDice,
  weaponLayout, weaponSections, weaponLayoutFlags, itemWarnings, templatesFor, WEAPON_LAYOUT_LABELS, type WeaponLayout, type ItemTemplate,
  withdrawalState,
  attackMagnification, aimOffMetres, BEARINGS, LIMB_LABELS,
  tableModifiers, qualityPoints,
  ARC_SIDES, constructBehaviors, wirelessConnection, deckPartPlan, DECK_PARTS, modificationEffect, modificationDef,
  withScopeVision, laserInRange,
  parseSkillList, parseGearList, qualityKarmaCost, programPlan, suiteBonus, otakuCap, channelRaiseCost, complexFormCost, currentHeat, lifestyleOverdue, lifestyleAvailabilityMods, modInstallPlan,
  weatherDriving, allyCosts, allyProblem, meditationTn, thesisTn, ordealWeeks, familiarReady, contagionProblem, contagionReach, sicknessStage, careFactor, isRadiationSickness,
  livingConcealment,
  attitudeFor,
  describeSpan, describeBundle, centeringMode, wardPlan,
  activeManeuvers, designVehicle, lockTypeOf, icInitiative,
} from "../rules/index.ts";
import { legworkDifficulties, legworkLevelDice, encephalonFits } from "../rules/index.ts";
import { doctoringCareOptions } from "../rules/index.ts";
import { buysByFinding } from "../rules/index.ts";
import { REFERENCE_DRAG_TYPE } from "../rules/index.ts";
import { dropReferenceEntry } from "./reference.ts";
import { isCarried, tweakKeyChoices, normalizeTweaks, tweakText, TWEAK_TARGETS, TWEAK_TARGET_KEYS, ACCESSORY_FIELD_KEYS, TWEAK_KEYS, TWEAK_VALUE_MAX, TWEAK_MAX, essenceLoss as wareEssenceLoss, type TweakTarget } from "../rules/index.ts";
import { toolsModifier, gearRepairPlan, surveillanceKind, recognitionTn, readWriteRating, streetCred } from "../rules/index.ts";
import { bioKindsV72, bioVitals, smokeCounts, ammoChoices, findAmmo, isKnownAmmo, canFireIndirect, metamagicChoices, BARRIER_KINDS, allySpellKarma, barrierBlocks, hostChoices, droneLinkOf, mountPointFor, skillRollMemoryFields, negotiationAttribute, outrightPurchase, lifestyleStatusText, metatypeOptions } from "../rules/index.ts";
import { sheafFor } from "../rules/sheafgen.ts";
import * as U80C from "../rules/urr80-combat.ts";
import { urrCoreTnPresetRow, urrCoreKarmaDiceRow, urrCoreInstructorRule } from "../rules/urr80-core.ts";
import { sensorTableRows, sensorTableModifiers, segRows, segConditionModifiers } from "../rules/docs79-vehicles.ts";
import { modKey, modIn, type TargetNumberModifier } from "../rules/dice.ts";
import { quickRollArmed } from "./hotkeys.ts";
import { visibilityV79, perceptionSightRows, perceptionSightModifiers } from "../rules/docs79-melee-vision.ts";
import { superiorPositionModifiers, parseSkillMods, skillModsText, spellPointCheck, spellPointAllowance, lifestyleOutright, leftoverCash, starterSkillsMissing, buildPlan, icFromStep } from "../rules/index.ts";
import { monitorView, trackView } from "../rules/index.ts";
import { socialDesiredPick, socialDesiredRows, socialDesiredModifiers, socialOneSided } from "../rules/index.ts";
import { socialExtraRows, deathBoxExtra } from "../rules/index.ts";
import { promptPoolDice } from "./chat.ts";
import { SHEET_TOOL_ACTIONS } from "./adding.ts";
import { sheetToolsContext, decorateSheet } from "./sheettools.ts";
// v0.68.0: layouts, the status strip, your turn, steppers, roll memory.
import { stripContext, decorateInterface, currentLayout, rememberMarker } from "./interface.ts";
import { tabIcon, FEEDS } from "../rules/index.ts";
import { reloadActionKind, reloadActionLabel, grenadeScatterType, scatterDiceV79 } from "../rules/docs79-ranged.ts";
import { buildRowsFor, buildInputFor } from "./buildinput.ts";
import { SR2CreationWizard } from "./creation.ts";
import { SR2SpendKarma } from "./spendkarma.ts";
import { currentContext, creationContext } from "./charinfo.ts";
import { underwayRows, PROJECT_SHEET_ACTIONS } from "./projects.ts";
import { recordCreation, reopenCreation, addAdvancementNote, deleteAdvancementLine, refuseLockedRaises } from "./advancement.ts";
import { refusePermitTick, permitRowFor, vehiclePermitPayer } from "./permits.ts";
import { timeLabel } from "../rules/waiting.ts";
import { dropRequest, approvalNeeded, inCreation as inCreationNow, creationRecordOf } from "./approvals.ts";
import { escHtml } from "../rules/html.ts";
import { requestGm, onRelay, type RelayOp } from "./socket.ts";
import { openHelp } from "./help.ts";
import { artSheetContext, useDefaultArt } from "./tokenart.ts";
import { t as tx, tCount, tList, tKey } from '../helpers/i18n.ts';

/** v0.73.0 (O24): the known-hosts context for this decker and the viewing user. */
function knowledgeCtx(actor: any): any {
  const cur: any = actor.currentHost?.() ?? null;
  return { known: actor.system.matrix?.knownHosts ?? [], numbers: actor.system.matrix?.numbers ?? [], currentUuid: cur?.uuid ?? "", currentParentUuid: cur?.system?.parentUuid ?? "", isGM: Boolean(game.user?.isGM) };
}
const hostNode = (h: any) => ({ uuid: h.uuid, name: h.name, gridKind: h.system.gridKind, parentUuid: h.system.parentUuid, ltgNumber: h.system.ltgNumber, securityCode: h.system.securityCode, securityValue: h.system.securityValue });


const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets;

/**
 * v0.82.0 (RV82 A-G2): a Guide button in the title bar of every SR2e actor and item sheet (the safehouse's too), for
 * every user. It opens the whole guide at its first topic; the "?" beside a heading still opens one topic.
 */
export function addGuideButton(app: any, el: unknown): boolean {
  const root: HTMLElement | null = el instanceof HTMLElement ? el : app?.element ?? null;
  const doc: any = app?.document;
  if (!root?.classList?.contains("sr2e") || !doc || !["Actor", "Item"].includes(String(doc.documentName ?? ""))) return false;
  const header = root.querySelector<HTMLElement>(":scope > .window-header");
  if (!header || header.querySelector(".sr2e-guide-button")) return false;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "header-control icon fa-solid fa-book-open sr2e-guide-button";
  button.dataset["tooltip"] = tx('SR2E.App.Sheets.guide');
  button.setAttribute("aria-label", tx('SR2E.App.Sheets.guideOpenTheSr2eGuide'));
  button.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); openHelp(); });
  const before = header.querySelector('[data-action="toggleControls"], [data-action="close"]');
  if (before?.parentElement) before.parentElement.insertBefore(button, before);
  else header.appendChild(button);
  return true;
}

export function registerGuideButton(): void {
  Hooks.on("renderApplicationV2", (app: any, el: unknown) => {
    try { addGuideButton(app, el); } catch (err) { console.warn("sr2e | guide button", err); }
  });
}

/** Full character sheet (also selectable for NPCs). */
export class SR2CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** v0.59.0: dropped items arrive uninstalled / unbonded / unloaded, move between actors, and only fitting types (applications/drops.ts). */
  /** v0.92.1: a Catalogue entry dragged from the reference pane opens the shop with it ticked (applications/reference.ts). */
  async _onDrop(event: any): Promise<any> {
    const TE: any = (foundry as any).applications?.ux?.TextEditor?.implementation;
    let data: any = null;
    try { data = TE?.getDragEventData?.(event) ?? null; } catch { data = null; }
    if (data?.type === REFERENCE_DRAG_TYPE) return dropReferenceEntry(this.document, data);
    return (super._onDrop as any)(event);
  }

  async _onDropItem(event: any, item: any): Promise<any> {
    return dropItemOnActor(this, event, item, () => (super._onDropItem as any)(event, item));
  }

  // Foundry merges DEFAULT_OPTIONS down the class chain, so subclasses list only what they add.
  static DEFAULT_OPTIONS: Record<string, any> = {
    classes: ["sr2e", "sheet", "actor"],
    position: { width: 680, height: 760 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      // v0.63.0: Add window, skill picker, duplicate, pins, Edit/Play, setup jump links (applications/adding.ts).
      ...SHEET_TOOL_ACTIONS,
      ...PROJECT_SHEET_ACTIONS,
      removeStatus: SR2CharacterSheet.#onRemoveStatus,
      coverSpellDefense: SR2CharacterSheet.#onCoverSpellDefense,
      placeArea: SR2CharacterSheet.#onPlaceArea,
      rollAttribute: SR2CharacterSheet.#onRollAttribute,
      rollSkill: SR2CharacterSheet.#onRollSkill,
      resistDamage: SR2CharacterSheet.#onResistDamage,
      attackWeapon: SR2CharacterSheet.#onAttackWeapon,
      firstAid: SR2CharacterSheet.#onFirstAid,
      naturalHeal: SR2CharacterSheet.#onNaturalHeal,
      tab: SR2CharacterSheet.#onTab,
      setPool: SR2CharacterSheet.#onSetPool,
      quickAttack: SR2CharacterSheet.#onQuickAttack,
      quickCast: SR2CharacterSheet.#onQuickCast,
      quickReload: SR2CharacterSheet.#onQuickReload,
      rollInit: SR2CharacterSheet.#onRollInit,
      toggleInstalled: SR2CharacterSheet.#onToggleInstalled,
      setMonitor: SR2CharacterSheet.#onSetMonitor,
      // v0.68.0: − / + on the monitor tracks.
      stepMonitor: SR2CharacterSheet.#onStepMonitor,
      castSpell: SR2CharacterSheet.#onCastSpell,
      castAtObject: SR2CharacterSheet.#onCastAtObject,
      reloadWeapon: SR2CharacterSheet.#onReloadWeapon,
      refreshKarma: SR2CharacterSheet.#onRefreshKarma,
      editItem: SR2CharacterSheet.#onEditItem,
      deleteItem: SR2CharacterSheet.#onDeleteItem,
      summonSpirit: SR2CharacterSheet.#onSummonSpirit,
      banishSpirit: SR2CharacterSheet.#onBanishSpirit,
      openActor: SR2CharacterSheet.#onOpenActor,
      astralAttack: SR2CharacterSheet.#onAstralAttack,
      usePower: SR2CharacterSheet.#onUsePower,
      dropSustained: SR2CharacterSheet.#onDropSustained,
      toggleActive: SR2CharacterSheet.#onToggleActive,
      assense: SR2CharacterSheet.#onAssense,
      quicken: SR2CharacterSheet.#onQuicken,
      dispel: SR2CharacterSheet.#onDispel,
      breachBarrier: SR2CharacterSheet.#onBreachBarrier,
      showSignatures: SR2CharacterSheet.#onShowSignatures,
      trackTrail: SR2CharacterSheet.#onTrack,
      addGeas: SR2CharacterSheet.#onAddGeas,
      editGeas: SR2CharacterSheet.#onEditGeas,
      toggleGeas: SR2CharacterSheet.#onToggleGeas,
      deleteGeas: SR2CharacterSheet.#onDeleteGeas,
      setBackground: SR2CharacterSheet.#onSetBackground,
      enchant: SR2CharacterSheet.#onEnchant,
      startQuest: SR2CharacterSheet.#onStartQuest,
      questStage: SR2CharacterSheet.#onQuestStage,
      endQuest: SR2CharacterSheet.#onEndQuest,
      advanceInitiation: SR2CharacterSheet.#onAdvanceInitiation,
      cleanse: SR2CharacterSheet.#onCleanse,
      divine: SR2CharacterSheet.#onDivine,
      invoke: SR2CharacterSheet.#onInvoke,
      possess: SR2CharacterSheet.#onPossess,
      endPossession: SR2CharacterSheet.#onEndPossession,
      designSpell: SR2CharacterSheet.#onDesignSpell,
      learnGrimoire: SR2CharacterSheet.#onLearnGrimoire,
      // v0.91.8 (RULES.FORMULA_V918.teacher): learn a spell from a teacher.
      learnFromTeacher: SR2CharacterSheet.#onLearnFromTeacher,
      addGrimoire: SR2CharacterSheet.#onAddGrimoire,
      feed: SR2CharacterSheet.#onFeed,
      dropPowerEffect: SR2CharacterSheet.#onDropPowerEffect,
      rejectionTest: SR2CharacterSheet.#onRejectionTest,
      clearRecovery: SR2CharacterSheet.#onClearRecovery,
      setEnvironment: SR2CharacterSheet.#onSetEnvironment,
      sustainElemental: SR2CharacterSheet.#onSustainElemental,
      bondFocus: SR2CharacterSheet.#onBondFocus,
      toggleExposed: SR2CharacterSheet.#onToggleExposed,
      allergenContact: SR2CharacterSheet.#onAllergenContact,
      focusAddictionTest: SR2CharacterSheet.#onFocusAddictionTest,
      clearFocusAddiction: SR2CharacterSheet.#onClearFocusAddiction,
      shapeshift: SR2CharacterSheet.#onShapeshift,
      regenerate: SR2CharacterSheet.#onRegenerate,
      raiseSpell: SR2CharacterSheet.#onRaiseSpell,
      releaseAnchored: SR2CharacterSheet.#onReleaseAnchored,
      dropAnchored: SR2CharacterSheet.#onDropAnchored,
      jackIn: SR2CharacterSheet.#onJackIn,
      jackOut: SR2CharacterSheet.#onJackOut,
      // v0.57.0
      matrixPerceive: SR2CharacterSheet.#onMatrixPerceive,
      matrixManeuver: SR2CharacterSheet.#onMatrixManeuver,
      useUtility: SR2CharacterSheet.#onUseUtility,
      hitchRide: SR2CharacterSheet.#onHitchRide,
      playChip: SR2CharacterSheet.#onPlayChip,
      systemTest: SR2CharacterSheet.#onSystemTest,
      matrixAttack: SR2CharacterSheet.#onMatrixAttack,
      toggleLoaded: SR2CharacterSheet.#onToggleLoaded,
      setMatrixMonitor: SR2CharacterSheet.#onSetMatrixMonitor,
      runMedic: SR2CharacterSheet.#onRunMedic,
      writeProgram: SR2CharacterSheet.#onWriteProgram,
      buildDeck: SR2CharacterSheet.#onBuildDeck,
      agentSearch: SR2CharacterSheet.#onAgentSearch,
      forgetNumber: SR2CharacterSheet.#onForgetNumber,
      jamLink: SR2CharacterSheet.#onJamLink,
      droneLink: SR2CharacterSheet.#onDroneLink,
      toggleDamaged: SR2CharacterSheet.#onToggleDamaged,
      toggleAdrenal: SR2CharacterSheet.#onToggleAdrenal,
      standUp: SR2CharacterSheet.#onStandUp,
      perceive: SR2CharacterSheet.#onPerceive,
      // v0.58.0
      notice: SR2CharacterSheet.#onNotice,
      negotiatePay: SR2CharacterSheet.#onNegotiatePay,
      recognition: SR2CharacterSheet.#onRecognition,
      repairGear: SR2CharacterSheet.#onRepairGear,
      plantBug: SR2CharacterSheet.#onPlantBug,
      listenIn: SR2CharacterSheet.#onListenIn,
      sweepBugs: SR2CharacterSheet.#onSweepBugs,
      radioCheck: SR2CharacterSheet.#onRadioCheck,
      interceptComms: SR2CharacterSheet.#onInterceptComms,
      checkId: SR2CharacterSheet.#onCheckId,
      trainWith: SR2CharacterSheet.#onTrainWith,
      fullDefense: SR2CharacterSheet.#onFullDefense,
      repairArmor: SR2CharacterSheet.#onRepairArmor,
      setCharge: SR2CharacterSheet.#onSetCharge,
      setUpWeapon: SR2CharacterSheet.#onSetUpWeapon,
      searchPerson: SR2CharacterSheet.#onSearchPerson,
      sneak: SR2CharacterSheet.#onSneak,
      rally: SR2CharacterSheet.#onRally,
      athletics: SR2CharacterSheet.#onAthletics,
      splitGrunts: SR2CharacterSheet.#onSplitGrunts,
      addQuality: SR2CharacterSheet.#onAddQuality,
      editQuality: SR2CharacterSheet.#onEditQuality,
      deleteQuality: SR2CharacterSheet.#onDeleteQuality,
      buildCheck: SR2CharacterSheet.#onBuildCheck,
      // v0.64.0: creation, the record, advancement, Spend Karma.
      openWizard: SR2CharacterSheet.#onOpenWizard,
      // v0.83.0
      useDefaultArt: function (this: any) { return useDefaultArt(this.document); },
      // v0.66.0: paste a character sheet into this character (applications/catalogue.ts).
      importCharacter: function (this: any) { return importIntoCharacter(this.document); },
      recordAsIs: SR2CharacterSheet.#onRecordAsIs,
      reopenCreation: SR2CharacterSheet.#onReopenCreation,
      // Open the Spend Karma window for this character.
      spendKarma: function (this: any) { SR2SpendKarma.show(this.document); },
      advNote: SR2CharacterSheet.#onAdvNote,
      advDelete: SR2CharacterSheet.#onAdvDelete,
      // Withdraw one of this character's pending approval requests (data-id).
      cancelRequest: async function (this: any, _e: Event, t: HTMLElement) { const id = t.dataset["id"]; if (id) await dropRequest(this.document, id); },
      delayAction: SR2CharacterSheet.#onDelayAction,
      actNow: SR2CharacterSheet.#onActNow,
      endDelayed: SR2CharacterSheet.#onEndDelayed,
      clearJam: SR2CharacterSheet.#onClearJam,
      socialTest: SR2CharacterSheet.#onSocialTest,
      moraleTest: SR2CharacterSheet.#onMoraleTest,
      takeDrug: SR2CharacterSheet.#onTakeDrug,
      endDrug: SR2CharacterSheet.#onEndDrug,
      kickHabit: SR2CharacterSheet.#onKickHabit,
      clearAddiction: SR2CharacterSheet.#onClearAddiction,
      diseaseTick: SR2CharacterSheet.#onDiseaseTick,
      clearDisease: SR2CharacterSheet.#onClearDisease,
      toggleTreated: SR2CharacterSheet.#onToggleTreated,
      expose: SR2CharacterSheet.#onExpose,
      // v0.55.0
      takeAim: SR2CharacterSheet.#onTakeAim,
      suppressFire: SR2CharacterSheet.#onSuppressFire,
      drawWeapon: SR2CharacterSheet.#onDrawWeapon,
      // v0.92.1 (RULES.SHEET_V921.carried): carry it, or leave it behind.
      toggleCarried: SR2CharacterSheet.#onToggleCarried,
      applyPatch: SR2CharacterSheet.#onApplyPatch,
      putOutFire: SR2CharacterSheet.#onPutOutFire,
      holdTarget: SR2CharacterSheet.#onHoldTarget,
      breakFree: SR2CharacterSheet.#onBreakFree,
      hazard: SR2CharacterSheet.#onHazard,
      surgery: SR2CharacterSheet.#onSurgery,
      recoveryCare: SR2CharacterSheet.#onRecoveryCare,
      spreadDisease: SR2CharacterSheet.#onSpreadDisease,
      clearRadiation: SR2CharacterSheet.#onClearRadiation,
      createAlly: SR2CharacterSheet.#onCreateAlly,
      cancelDeed: SR2CharacterSheet.#onCancelDeed,
      repairCyber: SR2CharacterSheet.#onRepairCyber,
      toggleSlotted: SR2CharacterSheet.#onToggleSlotted,
      repairDeck: SR2CharacterSheet.#onRepairDeck,
      deleteDeckFile: SR2CharacterSheet.#onDeleteDeckFile,
      clearCrippled: SR2CharacterSheet.#onClearCrippled,
      launchFrame: SR2CharacterSheet.#onLaunchFrame,
      recallFrame: SR2CharacterSheet.#onRecallFrame,
      frameAttack: SR2CharacterSheet.#onFrameAttack,
      releaseSmoke: SR2CharacterSheet.#onReleaseSmoke,
      clearPsyche: SR2CharacterSheet.#onClearPsyche,
      securityAction: SR2CharacterSheet.#onSecurityAction,
      dropTrace: SR2CharacterSheet.#onDropTrace,
      takeControl: SR2CharacterSheet.#onTakeControl,
      releaseVehicle: SR2CharacterSheet.#onReleaseVehicle,
      toggleJump: SR2CharacterSheet.#onToggleJump,
      driveVehicle: SR2CharacterSheet.#onDriveVehicle,
      subscribeDrone: SR2CharacterSheet.#onSubscribeDrone,
      unsubscribeDrone: SR2CharacterSheet.#onUnsubscribeDrone,
      groupDrive: SR2CharacterSheet.#onGroupDrive,
      groupAttack: SR2CharacterSheet.#onGroupAttack,
      quickBypass: SR2CharacterSheet.#onQuickBypass,
      improve: SR2CharacterSheet.#onImprove,
      payLifestyle: SR2CharacterSheet.#onPayLifestyle,
      payDocwagon: SR2CharacterSheet.#onPayDocwagon,
      callDocwagon: SR2CharacterSheet.#onCallDocwagon,
      nuyen: SR2CharacterSheet.#onNuyen,
      addContact: SR2CharacterSheet.#onAddContact,
      editContact: SR2CharacterSheet.#onEditContact,
      deleteContact: SR2CharacterSheet.#onDeleteContact,
      legwork: SR2CharacterSheet.#onLegwork,
      findItem: SR2CharacterSheet.#onFindItem,
      gainEdge: SR2CharacterSheet.#onGainEdge,
      buyOffFlaw: SR2CharacterSheet.#onBuyOffFlaw,
      favour: SR2CharacterSheet.#onFavour,
      raiseChannel: SR2CharacterSheet.#onRaiseChannel,
      learnComplexForm: SR2CharacterSheet.#onLearnComplexForm,
      unjamLink: SR2CharacterSheet.#onUnjamLink,
      // v0.56.0
      manifest: SR2CharacterSheet.#onManifest,
      raiseWard: SR2CharacterSheet.#onRaiseWard,
      centeringTest: SR2CharacterSheet.#onCenteringTest,
      bindTrueName: SR2CharacterSheet.#onBindTrueName,
    },
  };

  static PARTS: Record<string, any> = {
    main: { template: `${SYSTEM.PATH.TEMPLATES}/actor-character-sheet.hbs`, scrollable: [""] },
  };

  /**
   * v0.59.0: drop an area spell's (radius by Force and Magic) or a blast weapon's area on the map; the
   * tokens inside become the targets for the cast or the throw.
   */
  static async #onPlaceArea(this: SR2CharacterSheet, _e: Event, t: HTMLElement) {
    const actor: any = this.document;
    const item: any = actor.items.get(t.dataset["itemId"]);
    if (!item) return;
    let radius = 0;
    if (item.type === "spell") radius = areaRadius(Number(item.system.learnedForce ?? 0), Number(actor.system.derived?.magic ?? 0));
    else if (item.type === "weapon" && item.system.blast) radius = blastRadius(Number(item.system.damagePower ?? 0), blastFalloff(item.system.blastKind, Number(item.system.blastPerMetre ?? RULES.COMBAT.blast.powerPerMetre)));
    if (!(radius > 0)) return ui.notifications.warn(tx('SR2E.Notify.Sheet.hasNoArea', { itemName: escHtml(item.name) }));
    const placed = await placeArea(radius, `${item.name} area`);
    if (placed) ui.notifications.info(tx('SR2E.Notify.Sheet.tokenInsideSAreaNowTargeted', { placedCount: tCount(placed.count, 'SR2E.Count.token'), itemName: escHtml(item.name), plural2: placed.count === 1 ? tx('SR2E.Notify.Sheet.is') : tx('SR2E.Notify.Sheet.are') }));
  }

  /** v0.59.0 (Effects view): take a token status off (and its timer). */
  static async #onRemoveStatus(this: SR2CharacterSheet, _e: Event, t: HTMLElement) {
    const actor: any = this.document;
    const id = t.dataset["statusId"];
    if (!id) return;
    try { await actor.toggleStatusEffect?.(id, { active: false }); } catch { /* no status */ }
    const until = (actor.getFlag?.(SYSTEM.id, "statusUntil") as Record<string, unknown> | undefined) ?? {};
    if (until[id]) await actor.setFlag(SYSTEM.id, "statusUntil", { ...until, [id]: null }); // v0.73.0 live fix: setFlag merges, so null (not delete)
  }

  /** v0.36.0: item rows can be dragged (to the hotbar for a macro, or to another sheet). */
  async _onRender(context: any, options: any): Promise<void> {
    await (super._onRender as any)?.(context, options);
    const actor: any = this.document;
    const root: HTMLElement | null = (this as any).element ?? null;
    if (!root) return;
    for (const li of Array.from(root.querySelectorAll<HTMLElement>('li'))) {
      const el = li.querySelector<HTMLElement>('[data-item-id]');
      const id = el?.dataset['itemId'];
      const item = id ? actor.items.get(id) : null;
      if (!item || li.draggable) continue;
      li.draggable = true;
      li.addEventListener('dragstart', (ev: DragEvent) => {
        ev.dataTransfer?.setData('text/plain', JSON.stringify(item.toDragData?.() ?? { type: 'Item', uuid: item.uuid }));
      });
    }
    // v0.63.0: search, Edit/Play, folding sections, row edits, the setup banner.
    decorateSheet(this);
    // v0.68.0: the layout, section icons, your turn, the monitor's keyboard, steppers.
    decorateInterface(this);
  }

  /** v0.64.0: after creation, a player raises ratings with Spend Karma, not by typing them. */
  _processFormData(event: any, form: any, formData: any): any {
    const data: any = (super._processFormData as any)(event, form, formData);
    if (!data || typeof data !== "object") return data;
    const flat: Record<string, unknown> = foundry.utils.flattenObject(data);
    if (!refuseLockedRaises(this.document, "actor", flat).length) return data;
    setTimeout(() => void this.render(), 0);
    return foundry.utils.expandObject(flat);
  }

  async _prepareContext(options: any): Promise<any> {
    const context = await super._prepareContext(options);
    const actor: any = this.document;
    const items: any[] = [...actor.items];
    const summary = summaryContext(actor);
    return {
      ...context,
      actor,
      system: actor.system,
      // v0.68.0: the player's layout, the always-visible status strip, the combat column's state.
      layout: currentLayout(actor.type),
      strip: stripContext(actor, summary.pools),
      inCombat: Boolean(game.combat?.started),
      fullDefense: Boolean(actor.fullDefenseUp?.()),
      // v0.59.0: the Effects view.
      effects: effectsContext(actor),
      attributes: ATTRIBUTE_KEYS.map((key) => ({
        key,
        label: game.i18n.localize(`SR2E.Attribute.${key}`),
        base: actor.system.attributes[key].base,
        mod: actor.system.attributes[key].mod,
        gear: actor.system.attributes[key].gear,
        total: actor.system.attributes[key].total,
        abbr: key.charAt(0).toUpperCase(),
        racial: actor.system.attributes[key].racial ?? 0,
        augmented: actor.system.attributes[key].total !== actor.system.attributes[key].base,
        improve: actor.type === "character" ? actor.improveCost?.({ attribute: key }) : null,
      })),
      upkeep: actor.type === "character" ? upkeepContext(actor) : null,
      // v0.64.0: the Current and Creation tabs.
      current: actor.type === "character" ? currentContext(actor) : null,
      creation: actor.type === "character" ? creationContext(actor) : null,
      // v0.63.0: pins, the setup warnings (with the saved build's failed checks), Edit/Play.
      tools: sheetToolsContext(actor, { build: buildRowsFor(actor) }),
      // v0.44.0
      // v0.58.0: Essence holes, training, unlicensed gear, the listening TN.
      essenceHoles: RULES.GEAR_V58.essenceHoles.enabled && actor.type !== "spirit",
      training: actor.trainingList?.() ?? [],
      // v0.65.0: projects and training under way.
      underway: actor.type === "character" ? underwayRows(actor) : [],
      trainingTimed: RULES.CHARACTERS_V58.training.mode === "timed",
      legal: actor.legalProblems?.() ?? { problems: [], totalFine: 0 },
      listenTn: RULES.GEAR_V58.surveillance.listenTn,
      street: {
        notorietyOff: RULES.CHARACTERS_V58.notoriety.offCred && Number(actor.system.reputation?.notoriety ?? 0) > 0,
        recognitionTn: recognitionTn(Number(actor.system.reputation?.publicAwareness ?? 0)),
        qualitiesOn: RULES.STREET.qualities.enabled, reputationOn: RULES.STREET.reputation.enabled, autoCred: RULES.STREET.reputation.autoCred,
        qualities: (actor.system.qualities ?? []).map((q: any) => ({ ...q, tnLabel: q.target && q.tn ? tx('SR2E.App.Sheets.tnOnTarget', { sign: q.tn > 0 ? "+" : "", tn: q.tn, target: q.target }) : "", buyOff: q.kind === "flaw" && actor.type === "character" ? qualityKarmaCost("flaw", q.points) : 0 })),
        edgeRate: RULES.STREET.qualities.karma.edgePerPoint,
        qualityTotals: qualityPoints(actor.system.qualities ?? []),
        movement: actor.movementNow?.() ?? actor.system.derived?.movement ?? null,
        // v0.58.0: Street Cred before Notoriety (the Reputation line shows it after).
        streetCred: streetCred({ career: actor.system.karma?.career ?? 0, manual: actor.system.reputation?.streetCred ?? 0 }),
        broken: Boolean(actor.isBroken?.()),
        group: (() => { const g = actor.moraleGroup?.() ?? actor.gruntGroup?.(); return g ? { size: g.actors.length, standing: g.standing.length, mixed: Boolean(g.mixed) } : null; })(),
        canSplit: actor.type === "npc" && (actor.system.grunts?.size ?? 1) - (actor.system.grunts?.down ?? 0) > 1 && Boolean(game.user?.isGM),
      },
      armorRating: {
        ballistic: actor.armorRating?.("ballistic") ?? 0,
        impact: actor.armorRating?.("impact") ?? 0,
      },
      armorLayeringNote: (({ highest: () => tx('SR2E.App.Sheets.onlyTheBestPieceCounts'), sum: () => tx('SR2E.App.Sheets.allWornArmorAddsUp'), highestPlusHalf: () => tx('SR2E.App.Sheets.theBestPiecePlusHalf') } as Record<string, () => string>)[RULES.COMBAT.armorLayering] ?? (() => ""))(),
      skills: items.filter((i) => i.type === "skill").map((i) => skillRow(actor, i)),
      // v0.38.0: active, knowledge, language and Build/Repair skills in their own lists.
      // v0.89.6: `heading` is the group's English name, the heading's id for the guide's "?" link, its icon and its fold key
      skillGroups: [["active", tx('SR2E.App.Sheets.activeSkills'), "Active skills"], ["knowledge", tx('SR2E.App.Sheets.knowledgeSkills'), "Knowledge skills"], ["language", tx('SR2E.App.Sheets.languageSkills'), "Language skills"], ["buildRepair", tx('SR2E.App.Sheets.buildRepairSkills'), "Build/Repair skills"]]
        .map(([k, label, heading]) => ({ kind: k, label, heading, skills: items.filter((i) => i.type === "skill" && (i.system.kind ?? "active") === k).map((i) => skillRow(actor, i)) }))
        .filter((g, i) => i === 0 || g.skills.length),
      weapons: items.filter((i) => i.type === "weapon").map((i) => weaponRow(actor, i)),
      ...sheetLayout(actor, this.tabGroups?.primary),
      summary,
      quickActions: quickActions(actor, items),
      unarmed: { damageLabel: damageLabel(SR2Actor.unarmed().system), damageType: SR2Actor.unarmed().system.damageType },
      metatypeChoices: metatypeOptions(actor.system.metatype),
      // v0.83.0: the default token art (figure, archetype badge, the Use the default art button).
      art: artSheetContext(actor),
      // v0.92.1: rows carry whether they are left behind (RULES.SHEET_V921.carried), and the Carried toggle shows when it counts.
      armor: items.filter((i) => i.type === "armor").map((i) => ({ id: i.id, name: i.name, type: i.type, system: i.system, leftBehind: !isCarried(i) })),
      carriedOn: RULES.SHEET_V921.carried === "on",
      // v0.92.1: the ware that makes up the Essence line (its tooltip).
      essenceWare: essenceWareLine(items),
      gear: items.filter((i) => i.type === "gear").map((i) => {
        const c = (actor.system.derived?.cyber?.softs ?? []).find((x: any) => x.gearId === i.id);
        const tox = i.system.toxin?.kind ? i.system.toxin : null;
        return { id: i.id, name: i.name, type: i.type, system: i.system, leftBehind: !isCarried(i), toxinKind: tox?.kind ?? "",
          toxinNote: tox ? `${tox.kind} ${tox.power}${tox.level} ${tox.damageType}, ${tox.vector}` : "",
          chipNote: c ? (c.slotted ? (c.effective ? tx('SR2E.App.Sheets.chipGives', { kind: c.kind, skill: c.skill, rating: c.rating, effective: c.effective }) : `${c.kind} ${c.skill} ${c.rating} (${c.reason})`) : tx('SR2E.App.Sheets.chipNotSlotted', { kind: c.kind, skill: c.skill, rating: c.rating })) : "",
          // v0.58.0: tools, vision gear, surveillance gear, legality.
          ...gearExtras(i) };
      }),
      cyberware: items.filter((i) => i.type === "cyberware").map((i) => cyberRow(actor, i)),
      cyberWeapons: (actor.cyberWeapons?.() ?? []).map((w: any) => weaponRow(actor, w)),
      softSkills: actor.softSkills?.() ?? [],
      addictions: (actor.system.addictions ?? []).map((a: any, index: number) => {
        const st = withdrawalState(a, sysNow());
        return { ...a, index, withdrawal: a.addicted && st.withdrawal, daysClean: st.daysClean, canKick: a.addicted && st.canKick, recentCount: (a.recent ?? []).length };
      }),
      diseases: (actor.system.diseases ?? []).map((d: any, index: number) => ({ ...d, index,
        due: d.pending ? tx('SR2E.App.Sheets.dueNow') : tx('SR2E.App.Sheets.nextInHours', { hours: Math.max(0, Math.round((d.nextAt - sysNow()) / 3600)) }),
        // v0.48.0: contagion and radiation sickness.
        contagiousLabel: contagionReach(d.contagious ?? "") ? tx('SR2E.App.Sheets.contagious', { reach: d.contagious }) : "", canSpread: !contagionProblem(d, sysNow()),
        radiation: isRadiationSickness(d), from: d.source && d.source !== "radiation" ? d.source : "" })),
      radiation: (() => {
        const dose = Number(actor.system.radiation?.dose ?? 0);
        if (!(dose > 0)) return null;
        const stages = RULES.HEALTH.radiationSickness.stages;
        const st = sicknessStage(dose);
        const next = stages[st + 1];
        return { dose, stage: st >= 0 ? stages[st]!.name : "", next: next ? tx('SR2E.App.Sheets.stageAtDose', { name: next.name, dose: next.dose }) : "" };
      })(),
      drugsActive: (actor.system.drugs ?? []).map((d: any, index: number) => ({ ...d, index,
        until: d.round >= 0 && game.combat?.started ? tx('SR2E.App.Sheets.untilCombatTurn', { round: d.round }) : d.worldTime >= 0 ? tx('SR2E.App.Sheets.minLeft', { minutes: Math.max(0, Math.round((d.worldTime - sysNow()) / 60)) }) : "" })),
      spells: items.filter((i) => i.type === "spell"),
      powers: items.filter((i) => i.type === "power").map((i) => ({ id: i.id, name: i.name, system: i.system, summary: powerSummary(i.system),
        // v0.39.0: weaknesses and built-in effects show their own controls.
        isAllergy: i.system.special === "allergy", canUse: i.system.active && !["allergy", "vulnerability", "essenceLoss", "regeneration", "dualNatured", "infection"].includes(i.system.special),
        canFeed: i.system.special === "essenceLoss",
        hasContact: i.system.special === "allergy" && Boolean((RULES.CRITTERS.allergy as any)[i.system.severity]?.contact) })),
      critter: {
        dualNatured: Boolean(actor.system.derived?.dualNatured),
        regenerates: Boolean(actor.hasCritterPower?.("regeneration")),
        essenceShift: Number(actor.system.essenceShift ?? 0),
        noRegen: Number(actor.getFlag?.("sr2e", "noRegen") ?? 0) || 0,
        outOfDomain: Boolean(actor.outOfDomain?.()),
      },
      focusAddict: Boolean(actor.getFlag?.("sr2e", "focusAddict")),
      shapeshiftForms: [{ key: "animal", label: tx('SR2E.App.Sheets.animal') }, { key: "human", label: tx('SR2E.App.Sheets.human') }],
      shapeshiftFields: ATTRIBUTE_KEYS.map((k) => ({ key: k, label: cap(k), value: actor.system.shapeshift?.human?.[k] ?? 0 })),
      backgroundSources: SR2Actor.backgroundSources(),
      backgroundMine: actor.backgroundInfo?.() ?? null,
      // v0.67.0: the monitor in wound groups, with the Overflow row (one box per point of the Body the death check uses).
      cm: conditionMonitor(actor),
      conjuring: conjuringContext(actor),
      foci: items.filter((i) => i.type === "focus"),
      // v0.56.0: powers past the power-point budget are marked (and stop working, RULES.CRITTERS_V56.adeptBudget).
      adeptPowers: items.filter((i) => i.type === "adeptpower").map((i: any) => ({ id: i.id, name: i.name, system: i.system,
        over: (actor.system.derived?.adeptOver ?? []).some((o: any) => o.id === i.id) })),
      adeptOverNote: (actor.system.derived?.adeptOver ?? []).length
        ? (actor.system.derived.adeptOverOff
          ? tCount((actor.system.derived.adeptOver as any[]).length, 'SR2E.App.Sheets.overThePowerPointBudgetStops', { names: (actor.system.derived.adeptOver as any[]).map((o) => o.name).join(", ") })
          : tx('SR2E.App.Sheets.overThePowerPointBudgetWarn', { names: (actor.system.derived.adeptOver as any[]).map((o) => o.name).join(", ") })) : "",
      canManifest: RULES.MAGIC_V56.manifest.enabled && actor.system.derived?.astralMode === "projecting",
      manifesting: Boolean(actor.isManifesting?.()),
      knowsCentering: Boolean(actor.system.metamagic?.centering),
      centeringTests: Boolean(actor.system.metamagic?.centering) && centeringMode(actor.system.centeringSkill) === "test",
      centeredNow: Number(actor.centeredSuccesses?.() ?? 0),
      traditions: TRADITIONS.filter((k) => optionalTraditionOn(k) || actor.system.tradition === k).map((k) => ({ key: k, label: TRADITION_LABELS[k] ? tKey(TRADITION_LABELS[k]!) : cap(k) })),
      occult: occultContext(actor),
      recoveryTn: RULES.BIOWARE.recovery.tn,
      // v0.82.1 (owner): adepts see their initiation too; each tradition sees the techniques it may learn (and any it knows).
      metamagicList: METAMAGIC.filter((k) => Boolean(actor.system.metamagic?.[k]) || !metamagicAllowed(String(actor.system.tradition ?? ''), k).block).map((k) => ({ key: k, label: cap(k), known: Boolean(actor.system.metamagic?.[k]) })),
      geasaList: (actor.system.geasa ?? []).map((g: any, index: number) => ({ ...g, index })),
      isGM: Boolean(game.user?.isGM),
      // v0.91.8: the Spells heading's "Learn from a teacher…".
      teachersOn: teachersOn() && String(actor.system.tradition ?? 'none') !== 'none' && String(actor.system.tradition ?? '') !== 'adept',
      canEnchant: Boolean(actor.findSkill?.("Enchanting")),
      questInfo: (() => { const q = actor.quest?.(); return q ? { ...q, status: questStatus(q) } : null; })(),
      knowsDispelling: Boolean(actor.system.metamagic?.dispelling),
      isShaman: isShamanic(actor.system.tradition),
      isElementalist: actor.system.tradition === "elementalist",
      elementChoices: elementChoices(),
      sceneEnvironment: SR2Actor.sceneEnvironment().join(", "),
      projection: actor.projectionStatus?.() ?? null,
      anchoredList: (actor.system.anchored ?? []).map((x: any, index: number) => ({ ...x, index })),
      isAdept: actor.system.tradition === "adept",
      showAdeptList: actor.system.tradition === "adept" || items.some((i) => i.type === "adeptpower"),
      sustainedList: (actor.system.sustaining ?? []).map((x: any, index: number) => ({
        canQuicken: Boolean(actor.system.metamagic?.quickening) && !x.quickened,
        canHandToElemental: !x.focusId && !x.quickened && !x.spiritUuid && (actor.summonedSpirits?.() ?? []).some((sp: any) => sp.system.spiritKind === "elemental" && sp.system.services > 0),
        ...x, index, focusName: x.focusId ? actor.items.get(x.focusId)?.name ?? tx('SR2E.App.Sheets.focus') : "",
        spiritName: x.spiritUuid ? fromUuidSync(x.spiritUuid)?.name ?? tx('SR2E.App.Sheets.anElemental') : "",
        // v0.39.0: how long an elemental keeps it up.
        untilLabel: x.spiritUuid && typeof x.until === "number" && x.until >= 0 ? tx('SR2E.App.Sheets.hLeft', { hours: Math.max(0, Math.round((x.until - sysNow()) / 360) / 10) }) : "",
        // v0.56.0: a permanent spell's time to take, and the effect a spell puts on its targets.
        permanentLabel: typeof x.permanentAt === "number" && x.permanentAt >= 0 ? tx('SR2E.App.Sheets.permanentIn', { span: describeSpan(Math.max(0, x.permanentAt - sysNow())) }) : "",
        effectLabel: (() => {
          if (!x.effectId) return "";
          for (const u of (x.targetUuids?.length ? x.targetUuids : [actor.uuid])) {
            const t: any = fromUuidSync(u);
            const fx = ((t?.getFlag?.("sr2e", "powerEffects") as any[] | undefined) ?? []).find((e: any) => e.id === x.effectId);
            if (fx) return `${t.uuid === actor.uuid ? "" : `${t.name}: `}${describeBundle(fx)}`;
          }
          return "";
        })(),
      })),
      sustainPenalty: (actor.system.sustaining ?? []).filter((x: any) => !x.focusId && !x.quickened && !x.spiritUuid).length * RULES.MAGIC.sustainedTnMod,
      totemFields: ["combat", "detection", "health", "illusion", "manipulation", "conjuring"].map((k) => ({ key: k, label: cap(k), value: actor.system.totem?.[k] ?? 0 })),
      // v0.61.0: totem drawbacks by situation.
      totemBerserk: [{ key: "", label: tx('SR2E.App.Sheets.fromTheName') }, { key: "none", label: tx('SR2E.App.Sheets.never') }, { key: "wounded", label: tx('SR2E.App.Sheets.whenWounded') }, { key: "combat", label: tx('SR2E.App.Sheets.inCombat') }],
      astralModes: ASTRAL_MODES.map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) })),
      isAstral: actor.isAstral?.() ?? false,
      astralPerceivingMod: RULES.ASTRAL.perceivingTnMod,
      matrix: matrixContext(actor),
      rigging: riggingContext(actor),
    };
  }

  static async #onTakeControl(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const vehicles = allActors().filter((a: any) => a.type === "vehicle" && a.isOwner && !a.system.derived?.destroyed);
    if (!vehicles.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereIsNoVehicleYouCan'));
    const canJump = (actor.system.derived?.rigging?.vcr ?? 0) > 0 || !RULES.RIGGING.jumpInNeedsVcr;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.takeTheControls', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.vehicle')}</label><select name="vehicle">${vehicles.map((v: any) => `<option value="${escHtml(v.uuid)}">${escHtml(actorLabel(v))} (${escHtml(v.system.derived?.categoryLabel ?? "")}${v.system.drone ? tx('SR2E.Dialog.Sheet.drone') : ""})</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.how')}</label><select name="mode"><option value="manual">${tx('SR2E.Dialog.Sheet.driveItByHand')}</option>${canJump ? `<option value="jumped" selected>${tx('SR2E.Dialog.Sheet.jumpInControlRig')}</option>` : ""}</select></div>`,
      ok: { label: tx('SR2E.Dialog.Sheet.takeControl'), callback: (_e: Event, b: any) => ({ vehicle: String(b.form.elements.vehicle.value), mode: String(b.form.elements.mode.value) }) },
      rejectClose: false,
    });
    if (!choice) return;
    const vehicle: any = fromUuidSync(choice.vehicle);
    if (vehicle) await actor.takeControl(vehicle, choice.mode);
  }

  static async #onSubscribeDrone(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const have = new Set(actor.system.rigging?.subscribed ?? []);
    const drones = allActors().filter((a: any) => a.type === "vehicle" && !have.has(a.uuid) && !a.system.derived?.destroyed);
    if (!drones.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.noOtherVehicleToSubscribe'));
    const uuid = await pickOne(tx('SR2E.Dialog.Sheet.subscribeToSRemoteControlDeck', { actorName: actor.name }), drones.map((d: any) => ({ value: d.uuid, label: `${actorLabel(d)}${d.system.drone ? tx('SR2E.Card.Sheet.pilot', { pilot: d.system.pilot }) : ""}` })));
    const drone: any = uuid ? fromUuidSync(uuid) : null;
    if (drone) await actor.subscribeDrone(drone);
  }

  static async #onUnsubscribeDrone(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const uuid = target.dataset["uuid"];
    if (uuid) await (this.document as any).unsubscribeDrone(uuid);
  }

  static async #onGroupDrive(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.groupCommandSDrones', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.terrain')}</label><select name="terrain">${RULES.VEHICLES.terrain.map((t) => `<option value="${escHtml(t.id)}" ${t.id === ((SR2Actor as any).sceneTerrain?.() ?? "normal") ? "selected" : ""}>${escHtml(t.label)} (${t.value >= 0 ? "+" : ""}${t.value})</option>`).join("")}</select></div>
        ${RULES.VEHICLES.drivingModifiers.map((m) => `<label class="sr2e-check"><input type="checkbox" name="sit" value="${escHtml(m.id)}"> ${escHtml(m.label)} (${m.value >= 0 ? "+" : ""}${m.value})</label>`).join("")}
        <label class="sr2e-check"><input type="checkbox" name="crash"> ${tx('SR2E.Dialog.Sheet.crashTest')}</label>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.label')}</label><input name="label" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGCloseInOnThe')}"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.eachSubscribedDroneRollsItsOwn')}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.command'), callback: (_e: Event, b: any) => {
        const f = b.form as HTMLFormElement; const el: any = f.elements;
        return { terrain: String(el.terrain.value), situational: Array.from(f.querySelectorAll<HTMLInputElement>('input[name="sit"]:checked')).map((x) => x.value), crashTest: Boolean(el.crash.checked), label: String(el.label.value ?? "").trim() };
      } },
      rejectClose: false,
    });
    if (choice) await actor.groupDrive(choice);
  }

  static async #onGroupAttack(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const { options } = attackTargetOptions(actor, attackerToken(actor), game.user.targets?.first?.() ?? null);
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.groupAttackSDrones', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.target')}</label><select name="target">${options}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.range')}</label><select name="range">${RANGE_BANDS.map((b) => `<option value="${b}">${tx('SR2E.Dialog.Sheet.tn', { b: escHtml(cap(b)), rangeTn: RULES.RANGE_TN[b] })}</option>`).join("")}</select></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.eachSubscribedDroneFiresItsFirst')}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.fire'), callback: (_e: Event, b: any) => ({ target: String(b.form.elements.target.value ?? ""), range: String(b.form.elements.range.value) }) },
      rejectClose: false,
    });
    if (!choice) return;
    if (!choice.target) return ui.notifications.warn(tx('SR2E.Notify.Sheet.pickATarget'));
    await actor.groupAttack(choice.target, { range: choice.range as RangeBand });
  }

  /** Bypass a lock of any site this user can see. */
  static async #onQuickBypass(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const locks: Array<{ value: string; label: string }> = [];
    for (const site of allActors().filter((a: any) => a.type === "site")) {
      for (const d of site.system.devices ?? []) if (DEVICE_LOCKS.includes(d.kind) && !d.bypassed) locks.push({ value: `${site.uuid}|${d.id}`, label: `${site.name}: ${d.name} (${d.rating})` });
    }
    if (!locks.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.noLockYouCanSeeThe'));
    const pick = await pickOne(tx('SR2E.Dialog.Sheet.bypassALock', { actorName: actor.name }), locks);
    if (!pick) return;
    const [uuid, id] = pick.split("|");
    const site: any = fromUuidSync(uuid as string);
    if (site) await bypassDialog(site, id as string, actor);
  }

  static async #onReleaseVehicle(this: SR2CharacterSheet) {
    await (this.document as any).releaseVehicle();
  }

  static async #onToggleJump(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const v: any = actor.riggedVehicle?.();
    if (!v) return;
    await v.setController(actor, actor.system.rigging?.jumpedIn ? "manual" : "jumped");
  }

  static async #onDriveVehicle(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const vehicle: any = actor.riggedVehicle?.();
    if (!vehicle || vehicle.system.controllerUuid !== actor.uuid) return ui.notifications.warn(tx('SR2E.Notify.Sheet.isNotAtTheControlsOf', { actorName: escHtml(actor.name) }));
    const opts = await driveDialog(actor, vehicle);
    if (!opts) return;
    if (!(await actor.useAction("drive", tx('SR2E.Card.Sheet.aDrivingTest')))) return;
    await actor.driveTest({ ...opts, vehicle });
  }


  static async #onAdvanceInitiation(this: SR2CharacterSheet) {
    const actor: any = this.document;
    // v0.92.3 (RULES.SPIRITS_V923.gradeZero 'book', Grimoire p. 38): the first initiation is to Grade 0.
    const grade = nextInitiationGrade(Number(actor.system.initiateGrade ?? 0), Boolean(actor.getFlag?.("sr2e", "initiated")));
    // v0.72.0 (O15): adepts and aspected magicians see only the techniques they can learn (MAGIC_V72.metamagicLimits).
    const unknown = metamagicChoices(String(actor.tradition ?? actor.system.tradition ?? ""), METAMAGIC.filter((k) => !actor.system.metamagic?.[k]));
    const groups = (actor.myGroups?.() ?? []) as any[];
    const ordeals = RULES.OCCULT.initiation.ordeals;
    const costOf = (group: boolean, ordeal: boolean) => initiationCost(grade, { group, ordeal });
    const content = `<p>${tx('SR2E.Dialog.Sheet.grade', { grade: escHtml(grade) })} <strong data-cost>${costOf(false, false).cost}</strong> ${tx('SR2E.Dialog.Sheet.goodKarmaAvailable', { karmaGood: escHtml(actor.system.karma.good) })}</p>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.learnMetamagic')}</label><select name="tech"><option value="">${tx('SR2E.Dialog.Sheet.none')}</option>${unknown.map((k) => `<option value="${escHtml(k)}">${escHtml(cap(k))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.ordeal')}</label><select name="ordeal"><option value="">${tx('SR2E.Dialog.Sheet.none')}</option>${ordeals.map((o) => `<option value="${escHtml(o.id)}">${escHtml(o.label)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.asceticismLower')}</label><select name="attr">${ATTRIBUTE_KEYS.filter((k) => RULES.SPIRITS_V923.asceticism !== "physical" || ["body", "quickness", "strength"].includes(k)).map((k) => `<option value="${k}">${escHtml(cap(k))} (${escHtml(actor.system.attributes[k].base)})</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.geasOrOathTheWords')}</label><input name="geas" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGMustSpeakOnlyTruth')}"></div>
        <p class="hint" data-ordeal></p>
        ${groups.length ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.withAGroup')}</label><select name="group"><option value="">${tx('SR2E.Dialog.Sheet.alone')}</option>${groups.map((g) => `<option value="${escHtml(g.id)}">${escHtml(g.name)}</option>`).join("")}</select></div>` : ""}
        <p class="hint">${tx('SR2E.Dialog.Sheet.anOrdealLowersTheKarmaMultiplier', { initiationOrdealReduction: RULES.OCCULT.initiation.ordealReduction, multipliersGroup: RULES.OCCULT.initiation.multipliers.group, multipliersSelf: RULES.OCCULT.initiation.multipliers.self })}</p>`;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.initiate2', { actorName: actor.name }) },
      content,
      render: (_e: Event, dialog: any) => {
        const form: HTMLFormElement | null = dialog.element?.querySelector?.("form") ?? null;
        const upd = () => {
          const el: any = form?.elements;
          const out = form?.querySelector("[data-cost]");
          if (el && out) out.textContent = String(costOf(Boolean(el.group?.value), Boolean(el.ordeal?.value)).cost);
          const hint = form?.querySelector("[data-ordeal]");
          if (el && hint) hint.textContent = ordealHint(actor, String(el.ordeal?.value ?? ""), grade);
        };
        form?.addEventListener("change", upd);
        upd();
      },
      ok: { label: tx('SR2E.Dialog.Sheet.initiate'), callback: (_e: Event, b: any) => {
        const el: any = b.form.elements;
        return { tech: String(el.tech.value ?? ""), ordeal: String(el.ordeal.value ?? ""), attr: String(el.attr.value ?? ""), geas: String(el.geas.value ?? ""), group: String(el.group?.value ?? "") };
      } },
      rejectClose: false,
    });
    if (!choice) return;
    await actor.advanceInitiation(choice.tech || null, { ordeal: choice.ordeal || null, groupId: choice.group || null, attribute: choice.attr, geas: choice.geas });
  }

  static async #onCleanse(this: SR2CharacterSheet) {
    await (this.document as any).cleanse?.();
  }

  static async #onDivine(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const d = RULES.OCCULT.metamagic.divining;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.divine2', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.theQuestion')}</label><input name="text" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGWhoSoldUsOut')}" autofocus></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.kindOfQuestion')}</label><select name="q">${d.tns.map((t) => `<option value="${escHtml(t.id)}">${tx('SR2E.Dialog.Sheet.tn2', { label: escHtml(t.label), tn: t.tn })}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.weeksAhead')}</label><input name="weeks" type="number" value="0" min="0"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.tnPerWeekAheadTheCard', { tnPerWeek: d.tnPerWeek, actorName: escHtml(actor.name) })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.divine'), callback: (_e: Event, b: any) => ({ text: String(b.form.elements.text.value ?? ""), q: String(b.form.elements.q.value), weeks: Math.max(0, Math.floor(Number(b.form.elements.weeks.value) || 0)) }) },
      rejectClose: false,
    });
    if (choice) await actor.divine({ question: choice.q, weeksAhead: choice.weeks, text: choice.text });
  }

  static async #onInvoke(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const list = (actor.summonedSpirits?.() ?? []).filter((s: any) => ["nature", "elemental"].includes(s.system.spiritKind) && !s.system.greatForm);
    if (!list.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.hasNoNatureSpiritOrElemental', { actorName: escHtml(actor.name) }));
    const uuid = await pickOne(tx('SR2E.Dialog.Sheet.invokeAGreatForm', { actorName: actor.name }), list.map((s: any) => ({ value: s.uuid, label: tx('SR2E.Card.Mod.forceServices', { name: s.name, force: s.system.force, services: s.system.services }) })));
    if (uuid) await actor.invoke(uuid);
  }

  static async #onPossess(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const target: any = game.user?.targets?.first?.()?.actor ?? null;
    const opts = [...(canvas as any)?.tokens?.placeables ?? []].filter((t: any) => t.actor && t.actor.system?.attributes && t.actor.type !== "vehicle" && t.actor.uuid !== actor.uuid)
      .map((t: any) => ({ value: t.actor.uuid, label: `${t.name}${target && t.actor.uuid === target.uuid ? tx('SR2E.Card.Sheet.targeted') : ""}` }));
    if (!opts.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.noBodyOnTheSceneTo'));
    if (target) opts.sort((a: any) => (a.value === target.uuid ? -1 : 1));
    const uuid = await pickOne(tx('SR2E.Dialog.Sheet.possessABody', { actorName: actor.name }), opts);
    if (uuid) await actor.possess(uuid);
  }

  static async #onEndPossession(this: SR2CharacterSheet) {
    await (this.document as any).endPossession?.();
  }

  static async #onDesignSpell(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const cats = ["combat", "detection", "health", "illusion", "manipulation"];
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.designASpell', { actorName: actor.name }) },
      position: { width: 480 },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.name')}</label><input name="name" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGThunderclap')}" autofocus></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.force')}</label><input name="force" type="number" value="4" min="1"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.category')}</label><select name="category">${cats.map((c) => `<option value="${escHtml(c)}">${escHtml(cap(c))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.type')}</label><select name="spellType"><option value="mana">${tx('SR2E.Dialog.Sheet.mana')}</option><option value="physical">${tx('SR2E.Dialog.Sheet.physical')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.combatDamage')}</label><select name="damageLevel">${["L", "M", "S", "D"].map((l) => `<option value="${escHtml(l)}" ${l === "M" ? "selected" : ""}>${escHtml(l)}</option>`).join("")}</select> <select name="damageType"><option value="physical">${tx('SR2E.Dialog.Sheet.physical')}</option><option value="stun">${tx('SR2E.Dialog.Sheet.stun')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.duration')}</label><select name="duration"><option value="instant">${tx('SR2E.Dialog.Sheet.instant')}</option><option value="sustained">${tx('SR2E.Dialog.Sheet.sustained')}</option><option value="permanent">${tx('SR2E.Dialog.Sheet.permanent')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherSpellsTnResistedBy')}</label><input name="tn" type="number" value="4" min="2"> <select name="resist"><option value="none">${tx('SR2E.Dialog.Sheet.notResisted')}</option>${ATTRIBUTE_KEYS.map((k) => `<option value="${k}">${escHtml(cap(k))}</option>`).join("")}</select></div>
        <label class="sr2e-check"><input type="checkbox" name="area"> ${tx('SR2E.Dialog.Sheet.area')}</label>
        <label class="sr2e-check"><input type="checkbox" name="touch"> ${tx('SR2E.Dialog.Sheet.touchRange')}</label>
        <label class="sr2e-check"><input type="checkbox" name="elemental"> ${tx('SR2E.Dialog.Sheet.elementalManipulation')} <select name="element"><option value="">${tx('SR2E.Dialog.Sheet.element')}</option>${RULES.MAGIC_EXTRA.elements.map((e) => `<option value="${escHtml(e)}">${escHtml(cap(e))}</option>`).join("")}</select></label>
        <label class="sr2e-check"><input type="checkbox" name="heals"> ${tx('SR2E.Dialog.Sheet.healsHealth')}</label>
        <label class="sr2e-check"><input type="checkbox" name="restricted"> ${tx('SR2E.Dialog.Sheet.veryRestrictedTargetOneMetatypeOne')}</label>
        <label class="sr2e-check"><input type="checkbox" name="extendedRange"> ${tx('SR2E.Dialog.Sheet.detectionExtendedRange')}</label>
        <label class="sr2e-check"><input type="checkbox" name="singleSense"> ${tx('SR2E.Dialog.Sheet.illusionOneSenseOnly')}</label>
        <label class="sr2e-check"><input type="checkbox" name="exclusive"> ${tx('SR2E.Dialog.Sheet.exclusiveDrainWhenCast', { spellcraftExclusiveDrainMod: RULES.SPELLCRAFT.exclusiveDrainMod })}</label>
        <label class="sr2e-check"><input type="checkbox" name="fetish"> ${tx('SR2E.Dialog.Sheet.fetishLimitedDrainWhenCast', { spellcraftFetishDrainMod: RULES.SPELLCRAFT.fetishDrainMod })}</label>
        <p class="hint" data-drain></p>
        <p class="hint">${tx('SR2E.Dialog.Sheet.vsForceALibraryHermeticOr', { designSkill: RULES.OCCULT.design.skill })}</p>`,
      render: (_e: Event, dialog: any) => {
        const form: HTMLFormElement | null = dialog.element?.querySelector?.("form") ?? null;
        const upd = () => {
          const el: any = form?.elements;
          const out = form?.querySelector("[data-drain]");
          if (!el || !out) return;
          const d = designDrain({ category: el.category.value, spellType: el.spellType.value, area: el.area.checked, duration: el.duration.value, elemental: el.elemental.checked, touch: el.touch.checked, damageType: el.damageType.value, damageLevel: el.damageLevel.value, resisted: el.resist.value !== "none",
            restricted: el.restricted.checked, extendedRange: el.extendedRange.checked, singleSense: el.singleSense.checked, exclusive: el.exclusive.checked, fetish: el.fetish.checked });
          out.textContent = tx('SR2E.Dialog.Sheet.drainF2', { part: d.drainModifier ? `${d.drainModifier > 0 ? "+" : ""}${d.drainModifier}` : "", drainLevel: d.drainLevel, part2: d.notes.length ? ` (${d.notes.join(", ")})` : "" });
        };
        form?.addEventListener("change", upd);
        upd();
      },
      ok: { label: tx('SR2E.Dialog.Sheet.design'), callback: (_e: Event, b: any) => {
        const el: any = b.form.elements;
        return { name: String(el.name.value ?? "").trim() || "New spell", force: Math.max(1, Math.floor(Number(el.force.value) || 1)), category: String(el.category.value), spellType: String(el.spellType.value),
          damageLevel: String(el.damageLevel.value), damageType: String(el.damageType.value), duration: String(el.duration.value), targetNumber: Math.max(2, Math.floor(Number(el.tn.value) || 4)), resist: String(el.resist.value),
          area: Boolean(el.area.checked), touch: Boolean(el.touch.checked), elemental: Boolean(el.elemental.checked), element: String(el.element.value ?? ""), heals: Boolean(el.heals.checked),
          restricted: Boolean(el.restricted.checked), extendedRange: Boolean(el.extendedRange.checked), singleSense: Boolean(el.singleSense.checked), exclusive: Boolean(el.exclusive.checked), fetish: Boolean(el.fetish.checked) };
      } },
      rejectClose: false,
    });
    if (choice) await actor.designSpell(choice);
  }

  /** v0.91.8: learn a spell from a teacher (who, which spell, the Force). */
  static async #onLearnFromTeacher(this: SR2CharacterSheet) {
    await learnFromTeacherDialog(this.document);
  }

  static async #onLearnGrimoire(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).learnFromGrimoire?.(target.dataset["group"] ?? "", target.dataset["name"] ?? "");
  }

  static async #onAddGrimoire(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const spell = actor.items.get(target.dataset["itemId"]);
    const groups = (actor.myGroups?.() ?? []) as any[];
    if (!spell || !groups.length) return;
    const id = groups.length === 1 ? groups[0].id : await pickOne(tx('SR2E.Dialog.Sheet.addToAGrimoire', { spellName: spell.name }), groups.map((g: any) => ({ value: g.id, label: g.name })));
    if (id) await actor.addToGrimoire(id, spell);
  }

  static async #onFeed(this: SR2CharacterSheet) {
    await (this.document as any).feed?.();
  }

  static async #onDropPowerEffect(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const uuid = target.dataset["uuid"] ?? "";
    const id = target.dataset["id"] ?? "";
    // v0.81.1 (S2-1): only an effect this sheet lists: one on this actor, or one this actor put on someone (its
    // Sustaining list). A forged button in rich text can't drop another actor's effect from the GM's client.
    if (!powerEffectOfSheet(this.document, uuid, id)) return;
    const cls: any = CONFIG.Actor.documentClass;
    await cls.setPowerEffect(uuid, null, id);
    this.render();
  }

  static async #onRejectionTest(this: SR2CharacterSheet) {
    await (this.document as any).rejectionTest?.();
  }

  static async #onClearRecovery(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyTheGmEndsARecovery'));
    const actor: any = this.document;
    await actor.update({ "system.recovering": (actor.system.recovering ?? []).filter((r: any) => r.itemId !== target.dataset["itemId"]) });
  }

  static async #onSetEnvironment(this: SR2CharacterSheet) {
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyTheGmSetsTheScene'));
    const value = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.sceneEnvironment') },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.environmentTags')}</label><input name="env" type="text" value="${escHtml(SR2Actor.sceneEnvironment().join(", "))}" placeholder="${tx('SR2E.Dialog.Sheet.eGUrbanForestMountains')}" autofocus></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.commaSeparatedAShamanSTotem')}</p>`,
      ok: { callback: (_e: Event, b: any) => String(b.form.elements.env.value ?? "") },
      rejectClose: false,
    });
    if (typeof value === "string") {
      await SR2Actor.setSceneEnvironment(value);
      this.render();
    }
  }

  static async #onSustainElemental(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const els = (actor.summonedSpirits?.() ?? []).filter((sp: any) => sp.system.spiritKind === "elemental" && sp.system.services > 0);
    if (!els.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.hasNoElementalWithServicesLeft', { actorName: escHtml(actor.name) }));
    const uuid = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.sustainWithAnElemental') },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.elemental')}</label><select name="el">${els.map((e: any) => `<option value="${escHtml(e.uuid)}">${tx('SR2E.Dialog.Sheet.services', { name: escHtml(e.name), services: escHtml(e.system.services) })}</option>`).join("")}</select></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.costsOneServiceTheSpellNo', { magicSustainedTnMod: RULES.MAGIC.sustainedTnMod })}</p>`,
      ok: { callback: (_e: Event, b: any) => String(b.form.elements.el.value) },
      rejectClose: false,
    });
    if (uuid) await actor.sustainWithElemental(Number(target.dataset["index"]), uuid);
  }

  static async #onBondFocus(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const focus = actor.items.get(target.dataset["itemId"]);
    if (focus) await actor.bondFocus(focus);
  }

  static async #onToggleExposed(this: SR2CharacterSheet, event: Event, target: HTMLElement) {
    const actor: any = this.document;
    await actor.setExposed?.(target.dataset["itemId"], Boolean((event.target as HTMLInputElement)?.checked ?? (target as HTMLInputElement).checked));
  }

  static async #onAllergenContact(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).allergenContact?.(target.dataset["itemId"]);
  }

  static async #onFocusAddictionTest(this: SR2CharacterSheet) {
    await (this.document as any).focusAddictionTest?.();
  }

  static async #onClearFocusAddiction(this: SR2CharacterSheet) {
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyTheGmClearsAFocus'));
    await (this.document as any).clearFocusAddiction?.();
    this.render();
  }

  static async #onShapeshift(this: SR2CharacterSheet) {
    await (this.document as any).shapeshift?.();
  }

  static async #onRegenerate(this: SR2CharacterSheet) {
    const healed = await (this.document as any).regenerateTick?.();
    if (!healed) ui.notifications.info(tx('SR2E.Notify.Sheet.nothingToRegenerate'));
  }

  static async #onRaiseSpell(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const spell = actor.items.get(target.dataset["itemId"]);
    if (!spell) return;
    const next = spell.system.learnedForce + 1;
    const force = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.learnAtAHigherForce', { spellName: spell.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.newForceNow', { spellLearnedForce: escHtml(spell.system.learnedForce) })}</label><input name="force" type="number" value="${escHtml(next)}" min="${escHtml(next)}" autofocus></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.costsGoodKarmaTheNewForce', { karmaCostsSpellPerForce: RULES.MAGIC_EXTRA.karmaCosts.spellPerForce, next: escHtml(next), spellKarmaCost: spellKarmaCost(next), actorName: escHtml(actor.name), karmaGood: escHtml(actor.system.karma.good) })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.learn'), callback: (_e: Event, b: any) => Number(b.form.elements.force.value) || next },
      rejectClose: false,
    });
    if (typeof force === "number") await actor.raiseSpellForce(spell, force);
  }

  static async #onReleaseAnchored(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const index = Number(target.dataset["index"]);
    const others = allActors().filter((a: any) => a.uuid !== actor.uuid && ["character", "npc", "spirit"].includes(a.type));
    const targeted: any = game.user.targets?.first?.()?.actor ?? null;
    const uuid = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.release2', { spellName: actor.system.anchored?.[index]?.spellName ?? tx('SR2E.Dialog.Sheet.anchoredSpell') }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.target')}</label><select name="target"><option value="">${tx('SR2E.Dialog.Sheet.noTarget')}</option>
          ${others.map((o: any) => `<option value="${escHtml(o.uuid)}" ${o.uuid === targeted?.uuid ? "selected" : ""}>${escHtml(o.name)}</option>`).join("")}</select></div>`,
      ok: { label: tx('SR2E.Dialog.Sheet.release'), callback: (_e: Event, b: any) => String(b.form.elements.target.value ?? "") },
      rejectClose: false,
    });
    if (uuid === null || uuid === undefined) return;
    await actor.releaseAnchored(index, uuid ? { targetUuid: uuid } : {});
  }

  static async #onDropAnchored(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const list = [...(actor.system.anchored ?? [])];
    if (!spliceRow(list, target)) return;
    await actor.update({ "system.anchored": list });
  }

  static async #onJackIn(this: SR2CharacterSheet) {
    const actor: any = this.document;
    // v0.70.0: once jacked in, moving straight to a host is the GM's shortcut (RULES.FIXES_V70.matrixMoveGmOnly).
    if (actor.isJackedIn?.() && !game.user?.isGM && RULES.FIXES_V70.matrixMoveGmOnly) return void ui.notifications.warn(tx('SR2E.Notify.Sheet.moveIsTheGmSShortcut'));
    // v0.73.0 (O24): players see only the hosts their character knows (the GM sees all).
    const hosts = hostChoices(allActors().filter((a: any) => a.type === "host").map((h: any) => ({ ...hostNode(h), name: actorLabel(h) })), knowledgeCtx(actor));
    const current = actor.system.matrix?.hostUuid ?? "";
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: `${actor.isJackedIn() ? tx('SR2E.Dialog.Sheet.move') : tx('SR2E.Dialog.Sheet.jackIn')}: ${actor.name}` },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.where')}</label><select name="host"><option value="">${tx('SR2E.Dialog.Sheet.theGridNoHost')}</option>
          ${hosts.map((c: any) => `<option value="${escHtml(c.host.uuid)}" ${c.host.uuid === current ? "selected" : ""}>${escHtml(c.label)}</option>`).join("")}</select></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.thisGoesStraightThereWithNo')}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.go'), callback: (_e: Event, b: any) => String(b.form.elements.host.value ?? "") },
      rejectClose: false,
    });
    if (choice === null || choice === undefined) return;
    await actor.jackIn(choice || null);
  }

  static async #onJackOut(this: SR2CharacterSheet) {
    const actor: any = this.document;
    // v0.57.0: black IC holding the decker: breaking free is a test (Hacking Pool may help).
    const held: any = actor.blackIcHold?.();
    if (held) {
      const pool = RULES.MATRIX_V57.blackIcHold.pool ? await promptPoolDice(actor, tx('SR2E.Dialog.Sheet.breakFreeOf', { heldName: held.name, actorName: actor.name }), "hacking") : 0;
      if (pool === null) return;
      return void (await actor.jackOut({ poolDice: pool }));
    }
    await actor.jackOut();
  }

  static async #onToggleDamaged(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const item = (this.document as any).items.get(target.dataset["itemId"]);
    if (item) await item.update({ "system.damaged": !item.system.damaged });
  }

  /**
   * Someone to test against: the targeted token, else a pick from the scene's tokens (each by its own
   * actor, so an unlinked NPC is itself) and the world's people. v0.50.0: a live preview of what the
   * test adds by itself (`preview`), and a warning when nobody is picked.
   */
  static async #pickPerson(actor: any, title: string, extraHtml = "", preview?: (who: any, form: HTMLFormElement, excluded: ReadonlySet<string>) => string): Promise<{ uuid: string; form: any; exclude: string[]; excludeTheirs: string[] } | null> {
    const targetToken: any = game.user.targets?.first?.() ?? null;
    const { options } = attackTargetOptions(actor, attackerToken(actor), targetToken, ["character", "npc", "spirit"]);
    const many = (game.user.targets?.size ?? 0) > 1 ? `<p class="hint">${tx('SR2E.Dialog.Sheet.severalTokensAreTargetedThisTest')}</p>` : "";
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.who')}</label><select name="who">${options}</select></div>${many}${extraHtml}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        ${preview ? `<div class="sr2e-preview" aria-live="polite"></div>` : ""}`,
      ok: { label: tx('SR2E.Dialog.Sheet.roll'), callback: (_e: Event, b: any) => ({ uuid: String(b.form.elements.who.value), form: Object.fromEntries([...b.form.elements].filter((e: any) => e.name).map((e: any) => [e.name, e.type === "checkbox" ? e.checked : e.value])),
        exclude: excludedOf(b.form), excludeTheirs: excludedOf(b.form, "theirs§") }) },
      render: (_e: Event, dialog: any) => { if (preview) livePreview(dialog, (form, excluded) => preview(fromUuidSync((form.elements as any).who?.value || "") ?? null, form, excluded)); },
      rejectClose: false,
    } as any);
    if (r && !r.uuid) ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.pickSomeoneFirstOrTargetTheir'));
    return r && r.uuid ? r : null;
  }

  // ---------------------------------------------------------------- v0.58.0 characters, gear and integration

  /** v0.58.0: a plain Perception test (nobody sneaking): Intelligence vs 4 with how obvious it is. */
  static async #onNotice(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const n = RULES.CHARACTERS_V58.notice;
    const targeted: any = game.user.targets?.first?.() ?? null;
    const units = RULES.CHARACTERS_V58.time.units;
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.notice', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.whatOptional')}</label><input name="what" type="text" placeholder="${tx('SR2E.Dialog.Sheet.aTripwireAVoiceBehindThe')}"></div>
        ${RULES.DOCS_V79.perceptionSightBook === "book" ? `<fieldset><legend>${tx('SR2E.Dialog.Sheet.sightSr2PerceptionTestModifiers')}</legend>${perceptionSightRows().filter((o) => o.value).map((o) => `<label class="sr2e-check"><input type="checkbox" name="obv-${escHtml(o.id)}"> ${escHtml(o.label)} (${o.value > 0 ? "+" : ""}${o.value})</label>`).join("")}</fieldset>`
          : `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.howObvious')}</label><select name="obv">${n.obviousness.map((o) => `<option value="${escHtml(o.id)}" ${o.id === "normal" ? "selected" : ""}>${escHtml(o.label)}${o.value ? ` (${o.value > 0 ? "+" : ""}${o.value})` : ""}</option>`).join("")}</select></div>`}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.by')}</label><select name="sense"><option value="sight">${tx('SR2E.Dialog.Sheet.sightLightSmokeAndWeatherCount')}</option><option value="hearing">${tx('SR2E.Dialog.Sheet.hearingTheyDonT')}</option></select></div>
        ${targeted?.actor ? `<label class="sr2e-check"><input type="checkbox" name="at" checked> ${tx('SR2E.Dialog.Sheet.atItsLightWallsAndDistance', { targetedName: escHtml(targeted.name) })}</label>` : ""}
        ${tableChecks(RULES.STREET.perception, "per")}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.searchingTakesOptional')}</label><input name="time" type="number" min="0" step="0.5" value="0"> <select name="unit">${units.map((u) => `<option value="${escHtml(u.id)}" ${u.id === "minutes" ? "selected" : ""}>${escHtml(u.label)}</option>`).join("")}</select></div>
        <label class="sr2e-check"><input type="checkbox" name="whisper" ${game.user?.isGM ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.whisperTheResultToTheGm')}</label>
        <p class="hint">${tx('SR2E.Dialog.Sheet.vsTheSuccessesSayHowMuch', { perceptionAttribute: escHtml(cap(RULES.PERCEPTION.attribute)), baseTn: n.baseTn })}</p>
        <div class="sr2e-preview" aria-live="polite"></div>`,
      render: (_e: Event, dialog: any) => livePreview(dialog, (form, excluded) => {
        const el: any = form.elements;
        const obv = n.obviousness.find((o) => o.id === el.obv?.value);
        // v0.79.0: the book's sight rows stack (RULES.DOCS_V79.perceptionSightBook).
        const sightRows = perceptionSightModifiers(perceptionSightRows().filter((o) => el[`obv-${o.id}`]?.checked).map((o) => o.id));
        const manual = [...(sightRows ?? (obv?.value ? [{ label: tx('SR2E.Card.Mod.obviousness', { obvLabel: obv.label }), value: obv.value }] : [])), ...tableModifiers(RULES.STREET.perception, checkedIds(form, "per")), ...(Number(el.mod?.value) ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: Number(el.mod.value) }] : [])];
        const auto = [...actor.noticeModifiers({ sense: el.sense?.value === "hearing" ? "hearing" : "sight", targetUuid: el.at?.checked ? targeted?.actor?.uuid ?? null : null }), ...actor.previewModifiers({ sightHandled: true })];
        return tnPreviewHtml({ base: n.baseTn, baseLabel: tx('SR2E.Dialog.Sheet.perception'), auto, manual, excluded });
      }),
      ok: { label: tx('SR2E.Dialog.Sheet.roll'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { what: String(el.what.value ?? "").trim(), obv: el.obv ? String(el.obv.value) : perceptionSightRows().filter((o) => el[`obv-${o.id}`]?.checked).map((o) => o.id), sense: el.sense.value === "hearing" ? "hearing" : "sight", at: Boolean(el.at?.checked), mod: Number(el.mod.value) || 0, per: checkedIds(b.form, "per"), time: Number(el.time.value) || 0, unit: String(el.unit.value), whisper: Boolean(el.whisper.checked), exclude: excludedOf(b.form) }; } },
      rejectClose: false,
    }) as any;
    if (!r) return;
    if (!(await actor.useAction("perceive", tx('SR2E.Card.Sheet.aPerceptionTest')))) return;
    await actor.notice({ obviousness: r.obv, sense: r.sense, what: r.what, targetUuid: r.at ? targeted?.actor?.uuid ?? null : null, whisper: r.whisper, exclude: r.exclude,
      modifiers: [...tableModifiers(RULES.STREET.perception, r.per), ...(r.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: r.mod }] : [])], ...(r.time > 0 ? { baseTime: { value: r.time, unit: r.unit } } : {}) });
  }

  /** v0.58.0: negotiate a job's pay with Mr. Johnson (an opposed Negotiation test moves the fee). */
  static async #onNegotiatePay(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const g = RULES.CHARACTERS_V58.negotiation;
    const r = await SR2CharacterSheet.#pickPerson(actor, tx('SR2E.Dialog.Sheet.negotiatePay', { actorName: actor.name }), `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.mrJohnsonSOffer')}</label><input name="fee" type="number" min="0" step="100" value="10000"></div>
      <p class="hint">${tx('SR2E.Dialog.Sheet.againstMrJohnsonSEachNet', { skill: g.skill, value: Math.round(g.perNet * 100), value2: Math.round(g.cap * 100) })}</p>`,
      (who, form, excluded) => {
        if (!who) return "";
        // v0.73.0 (O30): the opposed attribute of the negotiation house rule.
        const pv = actor.socialPreview(who, g.skill, [], negotiationAttribute());
        const mod = Number((form.elements as any).mod?.value) || 0;
        return tnPreviewHtml({ title: actor.name, base: pv.tnMine, baseLabel: tx('SR2E.App.Sheets.namesAttribute', { name: who.name }), auto: pv.mine, manual: mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [], excluded })
          + tnPreviewHtml({ title: who.name, base: pv.tnTheirs, baseLabel: `${actor.name}'s attribute`, auto: pv.theirs, excluded, key: "theirs§" });
      });
    if (!r) return;
    const fee = Math.max(0, Math.floor(Number(r.form.fee) || 0));
    if (!fee) return ui.notifications.warn(tx('SR2E.Notify.Sheet.enterTheFeeOnOffer'));
    const mod = Number(r.form.mod) || 0;
    await actor.negotiatePay(fee, r.uuid, { exclude: r.exclude, excludeTheirs: r.excludeTheirs, modifiers: mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [] });
  }

  /** v0.58.0 (GM): does anyone recognise this character? The targeted tokens, or everyone on the scene picked. */
  static async #onRecognition(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const targeted = [...(game.user.targets ?? [])].map((t: any) => t.actor?.uuid).filter(Boolean) as string[];
    const near = [...(canvas?.tokens?.placeables ?? [])].filter((t: any) => t.actor && t.actor.uuid !== actor.uuid && t.actor.id !== actor.id && ["character", "npc"].includes(t.actor.type));
    if (!near.length && !targeted.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.noOneOnTheSceneTo'));
    const picked = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.recognised', { actorName: actor.name }) },
      content: `<fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Sheet.whoMightRecogniseThem')}</legend>${near.map((t: any) => `<label class="sr2e-check"><input type="checkbox" name="who" value="${escHtml(t.actor.uuid)}" ${!targeted.length || targeted.includes(t.actor.uuid) ? "checked" : ""}> ${escHtml(t.name)}</label>`).join("")}</fieldset>
        <p class="hint">${tx('SR2E.Dialog.Sheet.vsPublicAwarenessWhisperedToThe', { recognitionAttribute: escHtml(cap(RULES.CHARACTERS_V58.recognition.attribute)), recognitionTn: recognitionTn(Number(actor.system.reputation?.publicAwareness ?? 0)), recognitionBaseTn: RULES.CHARACTERS_V58.recognition.baseTn })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.roll'), callback: (_e: Event, b: any) => Array.from(b.form.querySelectorAll('input[name="who"]:checked')).map((i: any) => i.value as string) },
      rejectClose: false,
    }) as string[] | null;
    if (picked?.length) await actor.recognitionCheck(picked);
  }

  /** v0.58.0: repair a broken weapon or piece of gear (its B/R skill, tools as needed). */
  static async #onRepairGear(this: SR2CharacterSheet, _e: Event, target: HTMLElement) {
    const actor: any = this.document;
    const item: any = actor.items.get(target.dataset["itemId"] ?? "");
    if (!item) return;
    const plan = gearRepairPlan({ kind: item.type === "weapon" ? "weapon" : "gear", weaponSkill: item.type === "weapon" ? String(item.system.skill ?? "") : "" });
    const best = actor.toolsFor(plan.skill);
    const levels = RULES.CHARACTERS_V58.tools.levels;
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.repair2', { itemName: item.name }) },
      content: `<p>${tx('SR2E.Dialog.Sheet.vsTnItNeedsA', { planSkill: escHtml(plan.skill), planTn: plan.tn, label: escHtml(levels.find((l) => l.id === plan.needs)?.label.toLowerCase() ?? plan.needs) })}</p>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.toolsAtHand')}</label><select name="have">${levels.map((l) => `<option value="${escHtml(l.id)}" ${l.id === best ? "selected" : ""}>${escHtml(l.label)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.baseTimeHours')}</label><input name="hours" type="number" min="0" step="0.5" value="${plan.baseHours}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <div class="sr2e-preview" aria-live="polite"></div>`,
      render: (_e: Event, dialog: any) => livePreview(dialog, (form, excluded) => {
        const el: any = form.elements;
        const t = toolsModifier(plan.needs, String(el.have?.value ?? "none"));
        return tnPreviewHtml({ base: plan.tn, baseLabel: tx('SR2E.Dialog.Sheet.repair__tnBase'), auto: actor.previewModifiers(), manual: [...(t.modifier ? [t.modifier] : []), ...(Number(el.mod?.value) ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: Number(el.mod.value) }] : [])], excluded, ...(t.blocked ? { warn: tx('SR2E.Dialog.Sheet.canTDoItWithoutTools') } : {}) });
      }),
      ok: { label: tx('SR2E.Dialog.Sheet.roll'), callback: (_e: Event, b: any) => ({ have: String(b.form.elements.have.value), hours: Number(b.form.elements.hours.value) || 0, mod: Number(b.form.elements.mod.value) || 0, exclude: excludedOf(b.form) }) },
      rejectClose: false,
    }) as { have: string; hours: number; mod: number; exclude: string[] } | null;
    if (!r) return;
    await actor.repairGear(item.id, { have: r.have, baseHours: r.hours, exclude: r.exclude, modifiers: r.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: r.mod }] : [] });
  }

  /** v0.58.0: plant a bug or tap on the targeted token (or someone picked). */
  static async #onPlantBug(this: SR2CharacterSheet, _e: Event, target: HTMLElement) {
    const actor: any = this.document;
    const r = await SR2CharacterSheet.#pickPerson(actor, tx('SR2E.Dialog.Sheet.plant', { name: actor.items.get(target.dataset["itemId"] ?? "")?.name ?? tx('SR2E.Dialog.Sheet.bug') }), `<p class="hint">${tx('SR2E.Dialog.Sheet.itStaysOnThemUntilA')}</p>`);
    if (!r) return;
    await actor.plantBug(target.dataset["itemId"] ?? "", r.uuid);
  }

  /** v0.58.0: listen through a bug, tap or microphone (a microphone listens at the targeted token). */
  static async #onListenIn(this: SR2CharacterSheet, _e: Event, target: HTMLElement) {
    const actor: any = this.document;
    const item: any = actor.items.get(target.dataset["itemId"] ?? "");
    if (!item) return;
    const k = surveillanceKind(String(item.system.surveillance?.kind ?? ""));
    const tgt: any = game.user.targets?.first?.()?.actor ?? null;
    if (k && !k.transmits && !tgt) return ui.notifications.warn(tx('SR2E.Notify.Sheet.targetTheTokenOrPlaceYou'));
    await actor.listenIn(item.id, { targetUuid: k?.transmits ? null : tgt?.uuid ?? null });
  }

  /** v0.61.0: can the radio get through the jammers in the scene? */
  static async #onRadioCheck(this: SR2CharacterSheet) {
    await (this.document as any).radioCheck();
  }

  /** v0.61.0: listen in on the targeted token's radio. */
  static async #onInterceptComms(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const tgt: any = game.user.targets?.first?.()?.actor ?? null;
    if (!tgt || tgt.uuid === actor.uuid) return ui.notifications.warn(tx('SR2E.Notify.Sheet.targetTheTokenWhoseRadioYou'));
    await actor.interceptComms(tgt.uuid);
  }

  /** v0.61.0: an ID against a checker (the checker's rating is asked). */
  static async #onCheckId(this: SR2CharacterSheet, _e: Event, target: HTMLElement) {
    const actor: any = this.document;
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.idCheck') },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.checkerSRating')}</label><input name="r" type="number" value="4" min="1"></div><p class="hint">${tx('SR2E.Dialog.Sheet.theCheckerRollsItsRatingAgainst')}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.check'), callback: (_e2: Event, b: any) => Math.floor(Number(b.form.elements.r.value) || 0) },
      rejectClose: false,
    });
    if (typeof r === "number" && r > 0) await actor.checkId(target.dataset["itemId"] ?? "", r);
  }

  /** v0.58.0: sweep someone (or yourself) for bugs. */
  static async #onSweepBugs(this: SR2CharacterSheet, _e: Event, target: HTMLElement) {
    const actor: any = this.document;
    const tgt: any = game.user.targets?.first?.()?.actor ?? null;
    const who = tgt && tgt.uuid !== actor.uuid ? tgt : actor;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Sheet.sweepForBugs') }, content: `<p>${tx('SR2E.Dialog.Sheet.sweep')} <strong>${escHtml(who.name)}</strong>${who === actor ? tx('SR2E.Dialog.Sheet.targetATokenToSweepSomeone') : ""}?</p>`, rejectClose: false } as any);
    if (ok) await actor.sweepForBugs(target.dataset["itemId"] ?? "", who.uuid);
  }

  /** v0.58.0: an instructor's test for training under way. */
  static async #onTrainWith(this: SR2CharacterSheet, _e: Event, target: HTMLElement) {
    const actor: any = this.document;
    const id = target.dataset["trainingId"] ?? "";
    const r = await SR2CharacterSheet.#pickPerson(actor, tx('SR2E.Dialog.Sheet.instructorFor', { actorName: actor.name }), `<p class="hint">${tx('SR2E.Dialog.Sheet.theInstructorSVs', { trainingInstructionSkill: RULES.CHARACTERS_V58.training.instructionSkill, trainingInstructionTn: RULES.CHARACTERS_V58.training.instructionTn, urrCoreInstructorRule: urrCoreInstructorRule() })}</p>`);
    if (!r) return;
    await actor.trainWith(id, r.uuid, { modifiers: Number(r.form.mod) ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: Number(r.form.mod) }] : [] });
  }

  static async #onPerceive(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const r = await SR2CharacterSheet.#pickPerson(actor, tx('SR2E.Dialog.Sheet.perceive', { actorName: actor.name }), `<label class="sr2e-check"><input type="checkbox" name="whisper" ${game.user?.isGM ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.whisperTheResultToTheGm')}</label>
      ${tableChecks(RULES.STREET.perception, "per")}
      <p class="hint">${tx('SR2E.Dialog.Sheet.sOrVsTheirStealthTheir', { actorName: escHtml(actor.name), perceptionSkill: escHtml(cap(RULES.PERCEPTION.skill)), perceptionAttribute: escHtml(cap(RULES.PERCEPTION.attribute)) })}</p>`,
      (who, form, excluded) => {
        const pv = actor.perceptionPreview(who);
        const mod = Number((form.elements as any).mod?.value) || 0;
        const manual = [...tableModifiers(RULES.STREET.perception, checkedIds(form, "per")), ...(mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [])];
        return tnPreviewHtml({ title: actor.name, auto: pv.observer, manual, excluded, ...(pv.blocked ? { warn: tx('SR2E.App.Sheets.cantNoticeThem', { why: pv.why }) } : {}) })
          + (who ? tnPreviewHtml({ title: who.name, auto: pv.sneaker, excluded, key: "theirs§" }) : "");
      });
    if (!r) return;
    if (!(await actor.useAction("perceive", tx('SR2E.Card.Sheet.aPerceptionTest')))) return;
    const mod = Number(r.form.mod) || 0;
    await actor.perceive(r.uuid, { exclude: r.exclude, excludeTheirs: r.excludeTheirs, whisper: Boolean(r.form.whisper), modifiers: [...tableModifiers(RULES.STREET.perception, checkedIds(r.form, "per")), ...(mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [])] });
  }

  /** v0.50.0: the social skill a plain skill roll handed over to the social test. */
  static #socialSkill: string | null = null;

  static async #onSocialTest(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const skills = Object.keys(RULES.SOCIAL.skills);
    const handed = SR2CharacterSheet.#socialSkill;
    SR2CharacterSheet.#socialSkill = null;
    const known = (handed && skills.includes(handed) ? handed : null) ?? skills.find((k) => actor.findSkill(k)) ?? skills[0];
    const att = RULES.STREET.social.attitudes;
    const r = await SR2CharacterSheet.#pickPerson(actor, tx('SR2E.Dialog.Sheet.socialTest', { actorName: actor.name }), `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.skill')}</label><select name="skill">${skills.map((k) => `<option value="${escHtml(k)}" ${k === known ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.vs', { k: escHtml(k), socialSkills: escHtml(cap(RULES.SOCIAL.skills[k]!)), part: actor.findSkill(k) ? ` · ${escHtml(actor.findSkill(k).system.rating)}` : "" })}</option>`).join("")}</select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.theirAttitude')}</label><select name="attitude">${att.map((a) => `<option value="${escHtml(a.id)}" ${a.id === "neutral" ? "selected" : ""}>${escHtml(a.label)}${a.value ? ` (${a.value > 0 ? "+" : ""}${a.value})` : ""}</option>`).join("")}</select></div>
      ${socialDesiredPick() ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.whatYouWantIs')}</label><select name="desired">${socialDesiredRows().map((d) => `<option value="${escHtml(d.id)}" ${d.id === "none" ? "selected" : ""}>${escHtml(d.label)}${d.value ? ` (${d.value > 0 ? "+" : ""}${d.value})` : ""}</option>`).join("")}</select></div>` : tableChecks(RULES.STREET.social.situations, "sit")}${socialExtraRows().length ? tableChecks(socialExtraRows(), "urs") : ""}
      <p class="hint">${tx('SR2E.Dialog.Sheet.pheromonesStreetCredMetatypePrejudiceAnd', { part: RULES.DOCS_V79.socialInfluence.mode === "oneSided" ? tx('SR2E.Dialog.Sheet.etiquetteLeadershipAndNegotiationYourSki', { attributeDefaultTnMod: RULES.ATTRIBUTE_DEFAULT_TN_MOD }) : tx('SR2E.Dialog.Sheet.opposedEachSideRollsTheSkill', { attributeDefaultTnMod: RULES.ATTRIBUTE_DEFAULT_TN_MOD }) })}</p>`,
      (who, form, excluded) => {
        const el: any = form.elements;
        // v0.50.0: the attitude follows the person picked (their token's disposition) until it is changed by hand.
        if (el.attitude && !el.attitude.dataset.touched && el.who?.value !== el.attitude.dataset.for) {
          const tok = who ? (SR2Actor as any).tokenFor?.(who) : null;
          el.attitude.value = attitudeFor(null, tok?.document?.disposition ?? null);
          el.attitude.dataset.for = el.who?.value ?? "";
          if (!el.attitude.dataset.wired) { el.attitude.dataset.wired = "1"; el.attitude.addEventListener("change", () => { el.attitude.dataset.touched = "1"; }); }
        }
        const mod = Number(el.mod?.value) || 0;
        const manual = [...tableModifiers(att, [String(el.attitude?.value ?? "neutral")]).map((m) => ({ ...m, id: `attitude:${String(el.attitude?.value ?? "neutral")}`, label: tx('SR2E.Card.Mod.attitude', { label: m.label }), value: m.value })),
          ...socialDesiredModifiers(socialDesiredPick() ? [String(el.desired?.value ?? "none")] : checkedIds(form, "sit")), ...tableModifiers(socialExtraRows(), checkedIds(form, "urs")), ...(mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [])];
        const pv = actor.socialPreview(who, String(el.skill?.value ?? known), manual);
        // v0.79.0 (RULES.DOCS_V79.socialInfluence): a one-sided test shows only the speaker's TN.
        return tnPreviewHtml({ title: actor.name, base: pv.tnMine, baseLabel: who?.name ? tx('SR2E.App.Sheets.nameAttribute', { name: who.name }) : tx('SR2E.App.Sheets.theirAttribute'), auto: pv.mine, manual, excluded })
          + (who && !socialOneSided(String(el.skill?.value ?? known)) ? tnPreviewHtml({ title: who.name, base: pv.tnTheirs, baseLabel: `${actor.name}'s attribute`, auto: pv.theirs, excluded, key: "theirs§" }) : "");
      });
    if (!r) return;
    if (!(await actor.useAction("social", tx('SR2E.Card.Sheet.aSocialTest')))) return;
    const mod = Number(r.form.mod) || 0;
    const attMods = tableModifiers(att, [String(r.form.attitude ?? "neutral")]).map((m) => ({ ...m, id: `attitude:${String(r.form.attitude ?? "neutral")}`, label: tx('SR2E.Card.Mod.attitude', { label: m.label }), value: m.value }));
    const desired = socialDesiredModifiers(socialDesiredPick() ? [String(r.form.desired ?? "none")] : checkedIds(r.form, "sit"));
    await actor.socialTest(String(r.form.skill), r.uuid, { exclude: r.exclude, excludeTheirs: r.excludeTheirs, modifiers: [...attMods, ...desired, ...tableModifiers(socialExtraRows(), checkedIds(r.form, "urs")), ...(mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [])] });
  }

  /** One sneaker past several observers (v0.44.0). */
  static async #onSneak(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const targeted = new Set([...(game.user.targets ?? [])].map((t: any) => t.actor?.uuid).filter(Boolean));
    const near = [...(canvas?.tokens?.placeables ?? [])].filter((t: any) => t.actor && t.actor.uuid !== actor.uuid && t.actor.id !== actor.id && ["character", "npc", "spirit"].includes(t.actor.type));
    if (!near.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.noOneOnTheSceneTo2'));
    // v0.71.0 (R2): the Stealth specialization, when it fits (the shared skill path uses it).
    const st: any = actor.findSkill?.(RULES.PERCEPTION.stealthSkill);
    const spec = RULES.FIXES_V71.contestSkillDice && st?.system?.specialization && Number(st.system.specializationRating ?? 0) > 0 ? `<label class="sr2e-check"><input type="checkbox" name="spec"> ${tx('SR2E.Dialog.Sheet.useTheSpecialization', { stSpecialization: escHtml(st.system.specialization), stSpecializationRating: escHtml(st.system.specializationRating) })}</label>` : "";
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.sneak2', { actorName: actor.name }) },
      content: `<fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Sheet.pastWhom')}</legend>${near.map((t: any) => `<label class="sr2e-check"><input type="checkbox" name="who" value="${escHtml(t.actor.uuid)}" ${targeted.has(t.actor.uuid) || !targeted.size ? "checked" : ""}> ${escHtml(t.name)}</label>`).join("")}</fieldset>
        ${tableChecks(RULES.STREET.perception, "per")}${spec}
        <label class="sr2e-check"><input type="checkbox" name="whisper" ${game.user?.isGM ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.whisperTheResultToTheGm')}</label>
        <p class="hint">${tx('SR2E.Dialog.Sheet.onceAgainstTheSharpestEachObserver', { perceptionStealthSkill: RULES.PERCEPTION.stealthSkill, perceptionAttribute: escHtml(cap(RULES.PERCEPTION.attribute)), perceptionSkill: escHtml(cap(RULES.PERCEPTION.skill)) })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.sneak'), callback: (_e: Event, b: any) => ({ who: Array.from(b.form.querySelectorAll('input[name="who"]:checked')).map((i: any) => i.value as string), per: checkedIds(b.form, "per"), whisper: Boolean(b.form.elements.whisper.checked), spec: Boolean(b.form.elements.spec?.checked) }) },
      rejectClose: false,
    }) as { who: string[]; per: string[]; whisper: boolean; spec: boolean } | null;
    if (!r?.who.length) return;
    // v0.70.0: a projecting magician or unmaterialized spirit doesn't sneak in the physical world (and the down can't).
    if (!actor.canAct?.("sneak")) return;
    if (!(await actor.useAction("perceive", tx('SR2E.Card.Sheet.sneaking')))) return;
    // v0.50.0: the observers' conditions go on each observer's own TN (as in Perceive).
    const mods = tableModifiers(RULES.STREET.perception, r.per).map((m) => ({ label: tx('SR2E.Card.Mod.observers', { label: m.label }), value: m.value }));
    await actor.sneakPast(r.who, { observerModifiers: mods, whisper: r.whisper, useSpecialization: r.spec });
  }

  /** Rally a broken group with Leadership (v0.44.0). */
  static async #onRally(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const broken = [...(canvas?.tokens?.placeables ?? [])].map((t: any) => t.actor).filter((a: any) => a?.isBroken?.());
    const seen = new Set<string>();
    const list = broken.filter((a: any) => { const k = a.gruntGroup?.()?.id ?? a.uuid; if (seen.has(k)) return false; seen.add(k); return true; });
    if (!list.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.noBrokenGroupOnTheScene'));
    const uuid = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.rally2', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.rally')}</label><select name="who">${list.map((a: any) => `<option value="${escHtml(a.uuid)}">${escHtml(a.name)}</option>`).join("")}</select></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.vsPerGruntDown', { rallySkill: RULES.STREET.rally.skill, rallyTn: RULES.STREET.rally.tn, rallyTnPerCasualty: RULES.STREET.rally.tnPerCasualty })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.rally'), callback: (_e: Event, b: any) => String(b.form.elements.who.value) },
      rejectClose: false,
    });
    if (uuid) await actor.rally(uuid);
  }

  /** Climb, swim or jump (v0.44.0). */
  static async #onAthletics(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const a = RULES.STREET.athletics;
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.athletics', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.what')}</label><select name="kind"><option value="climb">${tx('SR2E.Dialog.Sheet.climb')}</option><option value="swim">${tx('SR2E.Dialog.Sheet.swim')}</option><option value="jump">${tx('SR2E.Dialog.Sheet.jump')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.climbing')}</label><select name="climb">${a.climb.map((c) => `<option value="${escHtml(c.id)}" ${c.id === "rough" ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.tn2', { label: escHtml(c.label), tn: c.tn })}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.swimming')}</label><select name="swim">${a.swim.map((c) => `<option value="${escHtml(c.id)}" ${c.id === "choppy" ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.tn2', { label: escHtml(c.label), tn: c.tn })}</option>`).join("")}</select></div>
        <label class="sr2e-check"><input type="checkbox" name="running"> ${tx('SR2E.Dialog.Sheet.aRunningJump', { jumpRunningMultiplier: a.jump.runningMultiplier })}</label>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.orMPerSuccessClimbingOr', { skill: a.skill, attribute: escHtml(cap(a.attribute)), attributeDefaultTnMod: RULES.ATTRIBUTE_DEFAULT_TN_MOD, metresPerSuccess: a.metresPerSuccess, jumpMetresPerSuccess: a.jump.metresPerSuccess, walk: escHtml(actor.movementNow?.()?.walk ?? actor.system.derived?.movement?.walk ?? "?"), run: escHtml(actor.movementNow?.()?.run ?? actor.system.derived?.movement?.run ?? "?"), part: (actor.movementNow?.()?.factor ?? 1) !== 1 ? tx('SR2E.Dialog.Sheet.weatherDistancesToo', { factor: escHtml(actor.movementNow().factor) }) : "" })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.roll'), callback: (_e: Event, b: any) => { const e = b.form.elements; const kind = String(e.kind.value); return { kind, condition: kind === "climb" ? String(e.climb.value) : kind === "swim" ? String(e.swim.value) : "", running: Boolean(e.running.checked), mod: Number(e.mod.value) || 0 }; } },
      rejectClose: false,
    }) as { kind: string; condition: string; running: boolean; mod: number } | null;
    if (!r) return;
    await actor.athleticsTest(r.kind, { condition: r.condition, running: r.running, modifiers: r.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: r.mod }] : [] });
  }

  static async #onMoraleTest(this: SR2CharacterSheet) {
    await (this.document as any).moraleTest();
  }

  /** v0.64.0: the creation wizard. */
  static async #onOpenWizard(this: SR2CharacterSheet) {
    await SR2CreationWizard.open(this.document);
  }

  /** v0.64.0: freeze a character made before the wizard, as it stands. */
  static async #onRecordAsIs(this: SR2CharacterSheet) {
    const actor: any = this.document;
    if (creationRecordOf(actor)) return;
    if (!game.user?.isGM && !inCreationNow(actor) && Number(actor.system.karma?.career ?? 0) > 0 && approvalNeeded(actor)) return ui.notifications.warn(tx('SR2E.Notify.Sheet.askTheGmToRecordThe'));
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Sheet.recordCreation', { actorName: actor.name }) },
      content: `<p>${tx('SR2E.Dialog.Sheet.freeze')} <strong>${escHtml(actor.name)}</strong> ${tx('SR2E.Dialog.Sheet.asTheCreationRecordNowAttributes')}</p>`,
      rejectClose: false,
    });
    if (!ok) return;
    const saved = (actor.getFlag(SYSTEM.id, "build") ?? null) as Partial<Record<BuildColumn, Priority>> | null;
    await recordCreation(actor, { how: "asIs", priorities: saved ?? {}, checks: saved && Object.values(saved).some((v) => v) ? buildCheck(buildInputFor(actor, saved)) : [] });
  }

  /** v0.64.0 (GM): take the record away so creation can be done again. */
  static async #onReopenCreation(this: SR2CharacterSheet) {
    const actor: any = this.document;
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyAGmCanReopenCreation'));
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Sheet.reopenCreation', { actorName: actor.name }) },
      content: `<p>${tx('SR2E.Dialog.Sheet.throwAway')} <strong>${escHtml(actor.name)}</strong>${tx('SR2E.Dialog.Sheet.sCreationRecordAndOpenThe')}</p>`,
      rejectClose: false,
    });
    if (!ok) return;
    await reopenCreation(actor);
    await SR2CreationWizard.open(actor);
  }

  /** v0.64.0 (GM): a line written into the advancement log by hand. */
  static async #onAdvNote(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.advancementNote', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.what')}</label><input name="what" type="text" autofocus placeholder="${tx('SR2E.Dialog.Sheet.eGLearnedJapaneseFromA')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.karmaInSpent')}</label><input name="karma" type="number" value="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.nuyenInSpent')}</label><input name="nuyen" type="number" value="0"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.onlyTheLogChangesThisDoesn')}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.add'), callback: (_e: Event, b: any) => ({ what: String(b.form.elements.what.value ?? ""), karma: Number(b.form.elements.karma.value) || 0, nuyen: Number(b.form.elements.nuyen.value) || 0 }) },
      rejectClose: false,
    }) as any;
    if (r?.what) await addAdvancementNote(actor, r.what, r.karma, r.nuyen);
  }

  static async #onAdvDelete(this: SR2CharacterSheet, _e: Event, target: HTMLElement) {
    const id = target.dataset["id"];
    if (!id || !game.user?.isGM) return;
    await deleteAdvancementLine(this.document, id);
  }

  /** The priority-table build check (v0.38.0): pick A–E per column; the table updates live. */
  static async #onBuildCheck(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const saved = (actor.getFlag(SYSTEM.id, "build") ?? {}) as Partial<Record<BuildColumn, Priority>>;
    const base = buildInputFor(actor, saved);
    // v0.44.0: the builder's own choices (metatype, magic, base attributes) feed the check and "Fill the sheet".
    // v0.49.0: skills and gear typed as lists; templates (world first) give gear its type, fields and price.
    const templates = [...templatesFor("weapon", worldTemplates()), ...templatesFor("armor", worldTemplates()), ...templatesFor("gear", worldTemplates()), ...templatesFor("cyberware", worldTemplates()), ...templatesFor("cyberdeck", worldTemplates())];
    const lists = (el: any) => {
      const active = parseSkillList(String(el.skillsActive?.value ?? ""), "active");
      const know = parseSkillList(String(el.skillsKnowledge?.value ?? ""), "knowledge");
      const lang = parseSkillList(String(el.skillsLanguage?.value ?? ""), "language");
      const gear = parseGearList(String(el.gearList?.value ?? ""), templates);
      return { skills: [...active.skills, ...know.skills, ...lang.skills], gear, warnings: [...active.warnings, ...know.warnings, ...lang.warnings, ...gear.warnings] };
    };
    const read = (form: HTMLFormElement) => {
      const el = form.elements as any;
      const priorities = Object.fromEntries(BUILD_COLUMNS.map((k) => [k, el[k]?.value || undefined]).filter(([, v]) => v)) as Partial<Record<BuildColumn, Priority>>;
      const attributes = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, Math.max(0, Math.floor(Number(el[`attr-${k}`]?.value) || 0))]));
      return { priorities, metatype: String(el.metatype?.value || base.metatype), magic: String(el.magicKind?.value || base.magic) as BuildInput["magic"], attributes, outright: Boolean(el.outright?.checked), ...lists(el) };
    };
    const render = (c: { priorities: Partial<Record<BuildColumn, Priority>>; metatype: string; magic: BuildInput["magic"]; attributes: Record<string, number>; skills?: any[]; gear?: { items: any[]; total: number }; warnings?: string[]; outright?: boolean }) => {
      const input = { ...buildInputFor(actor, c.priorities), metatype: c.metatype, magic: c.magic, attributes: c.attributes, intelligence: c.attributes["intelligence"] ?? base.intelligence };
      // The lists replace sheet skills of the same name, and add their gear's price.
      const listed = (c.skills ?? []);
      const named = new Set(listed.map((s: any) => String(s.name).toLowerCase()));
      input.activeSkills = [...input.activeSkills.filter((s) => !named.has(s.name.toLowerCase())), ...listed.filter((s: any) => s.kind === "active" || s.kind === "buildRepair").map((s: any) => ({ name: s.name, rating: s.rating }))];
      input.knowledgeSkills = [...input.knowledgeSkills.filter((s) => !named.has(s.name.toLowerCase())), ...listed.filter((s: any) => s.kind === "knowledge" || s.kind === "language").map((s: any) => ({ name: s.name, rating: s.rating }))];
      input.gearCost += c.gear?.total ?? 0;
      const rows = buildCheck(input).map((r) => `<tr class="${r.ok ? "" : "sr2e-warning"}"><td>${r.ok ? "✓" : "✗"} ${escHtml(r.label)}</td><td>${escHtml(r.used)}</td><td>${escHtml(r.allowed)}</td><td>${escHtml(r.note ?? "")}</td></tr>`);
      // v0.61.0: a magician's starting spell points, the lifestyle bought outright, and what happens to leftover cash.
      if (c.magic !== "none") {
        const spells = [...(actor.items ?? [])].filter((i: any) => i.type === "spell").map((i: any) => ({ learnedForce: Number(i.system?.learnedForce ?? 0), force: Number(i.system?.force ?? 0) }));
        // v0.71.0 (R21): bonded foci take their bonding Karma from the spell points (RULES.FIXES_V71.creationFoci).
        const foci = [...(actor.items ?? [])].filter((i: any) => i.type === "focus").map((i: any) => ({ name: i.name, focusType: String(i.system?.focusType ?? ""), rating: Number(i.system?.rating ?? 0), bonded: Boolean(i.system?.bonded), target: String(i.system?.target ?? ""), category: String(i.system?.category ?? ""), size: String(i.system?.size ?? "") }));
        const sp = spellPointCheck({ allowance: spellPointAllowance({ priority: String(c.priorities.magic ?? ""), adept: c.magic === "adept" }), spells, ...(c.magic === "adept" ? {} : { foci }) });
        if (sp.allowance > 0 || sp.used > 0) rows.push(`<tr class="${sp.ok ? "" : "sr2e-warning"}"><td>${tx('SR2E.Dialog.Sheet.spellPoints', { mark: sp.ok ? "✓" : "✗" })}</td><td>${sp.used}</td><td>${sp.allowance}</td><td>${escHtml(sp.note)}</td></tr>`);
      }
      const plan = buildPlan({ resources: c.priorities.resources, magic: c.magic, gearCost: input.gearCost });
      const want = c.outright ? lifestyleOutright({ lifestyle: plan.lifestyle }) : null;
      const extra = want ? Math.max(0, want.cost - (plan.lifestyleCost ?? 0)) : 0;
      const out = want && extra <= plan.nuyen ? want : null;
      const cashLeft = Math.max(0, plan.nuyen - (out ? extra : 0));
      if (want) rows.push(`<tr class="${out ? "" : "sr2e-warning"}"><td>${tx('SR2E.Dialog.Sheet.lifestyleBoughtOutright', { mark: out ? "✓" : "✗" })}</td><td>¥${want.cost.toLocaleString()}</td><td>¥${(plan.nuyen + (plan.lifestyleCost ?? 0)).toLocaleString()}</td><td>${tx('SR2E.Dialog.Sheet.months', { wantMonths: want.months, part: out ? "" : tx('SR2E.Dialog.Sheet.notEnoughCashPaidByThe') })}</td></tr>`);
      const lc = leftoverCash(cashLeft);
      rows.push(`<tr><td>${tx('SR2E.Dialog.Sheet.cashLeft')}</td><td>¥${lc.kept.toLocaleString()}</td><td></td><td>${escHtml(lc.note)}</td></tr>`);
      if (c.gear?.items.length) rows.push(`<tr><td>${tx('SR2E.Dialog.Sheet.gearToAdd')}</td><td colspan="3">${c.gear.items.map((g: any) => `${escHtml(g.name)}${g.qty > 1 ? ` ×${escHtml(g.qty)}` : ""} (¥${(g.cost * g.qty).toLocaleString()})`).join(", ")}: ¥${c.gear.total.toLocaleString()}</td></tr>`);
      if (c.warnings?.length) rows.push(`<tr class="sr2e-warning"><td>${tx('SR2E.Dialog.Sheet.lists')}</td><td colspan="3">${escHtml(c.warnings.join(" "))}</td></tr>`);
      return rows.join("");
    };
    const selects = BUILD_COLUMNS.map((k) => `<label>${escHtml(cap(k))} <select name="${k}"><option value="">–</option>${PRIORITY_LETTERS.map((l) => `<option value="${l}" ${saved[k] === l ? "selected" : ""}>${l}</option>`).join("")}</select></label>`).join(" ");
    const metas = Object.entries(RULES.METATYPES.types).map(([k, v]) => `<option value="${escHtml(k)}" ${k === base.metatype ? "selected" : ""}>${escHtml(v.label)}</option>`).join("");
    const magics = [["none", tx('SR2E.App.Sheets.mundane')], ["full", tx('SR2E.App.Sheets.fullMagician')], ["adept", tx('SR2E.App.Sheets.physicalAdept')], ["aspected", tx('SR2E.App.Sheets.aspectedMagician')]].map(([k, l]) => `<option value="${escHtml(k)}" ${k === base.magic ? "selected" : ""}>${escHtml(l)}</option>`).join("");
    const attrs = ATTRIBUTE_KEYS.map((k) => `<label>${escHtml(cap(k))} <input name="attr-${k}" type="number" value="${base.attributes[k] ?? 1}" min="1" max="${RULES.CREATION.attributeMax}" style="width:3.5em"></label>`).join(" ");
    const first = { priorities: saved, metatype: base.metatype, magic: base.magic, attributes: base.attributes };
    const b = RULES.STREET.builder;
    const tplNames = templates.filter((t) => Number((t.system as any)?.cost ?? 0) > 0).map((t) => t.name);
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: tx('SR2E.Dialog.Sheet.build', { actorName: actor.name }), resizable: true },
      position: { width: 680 },
      content: `<div class="sr2e-row">${selects}</div>
        <div class="sr2e-row"><label>${tx('SR2E.Dialog.Sheet.metatype')} <select name="metatype">${metas}</select></label> <label>${tx('SR2E.Dialog.Sheet.magic')} <select name="magicKind">${magics}</select></label>
          <label class="sr2e-check" title="${tx('SR2E.Dialog.Sheet.payMonthsOfTheLifestyleAt', { lifestyleOutrightMonths: RULES.STREET_V61.creation.lifestyleOutright.months })}"><input type="checkbox" name="outright"> ${tx('SR2E.Dialog.Sheet.buyTheLifestyleOutright')}</label></div>
        <div class="sr2e-row">${attrs}</div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.activeSkillsToAddOrRe')}</label><textarea name="skillsActive" rows="2" placeholder="${tx('SR2E.Dialog.Sheet.firearms5Stealth3Urban5')}"></textarea></div>
        <div class="sr2e-row"><label class="sr2e-wide">${tx('SR2E.Dialog.Sheet.knowledgeSkills')} <textarea name="skillsKnowledge" rows="1" placeholder="${tx('SR2E.Dialog.Sheet.localGangs3CorporatePolitics2')}"></textarea></label>
          <label class="sr2e-wide">${tx('SR2E.Dialog.Sheet.languages')} <textarea name="skillsLanguage" rows="1" placeholder="${tx('SR2E.Dialog.Sheet.japanese3Elvish2')}"></textarea></label></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.gearToBuyATemplateS')}</label><textarea name="gearList" rows="2" placeholder="${tx('SR2E.Dialog.Sheet.heavyPistolArmorJacketMedkit2')}"></textarea></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.pricedTemplates', { tplNames: escHtml(tplNames.join(", ")) })}</p>
        <p class="hint">${tx('SR2E.Dialog.Sheet.commonSkillsNotOnTheSheet', { starterSkillsMissing: starterSkillsMissing([...(actor.items ?? [])].filter((i: any) => i.type === "skill").map((i: any) => String(i.name))).map((k) => `${escHtml(k.name)}${k.kind === "buildRepair" ? "" : ` (${escHtml(cap(k.attribute))})`}`).join(", ") || tx('SR2E.Dialog.Sheet.none2') })}</p>
        <table class="sr2e-build"><thead><tr><th>${tx('SR2E.Dialog.Sheet.check')}</th><th>${tx('SR2E.Dialog.Sheet.used')}</th><th>${tx('SR2E.Dialog.Sheet.allowed')}</th><th></th></tr></thead><tbody>${render(first)}</tbody></table>
        <p class="hint">${tx('SR2E.Dialog.Sheet.theSr2PriorityTableFromMemory', { magicRating: b.magicRating, lifestyleMonths: tCount(b.lifestyleMonths, 'SR2E.Count.month'), contactsCount: b.contacts.count })}</p>`,
      buttons: [
        { action: "save", label: tx('SR2E.Dialog.Sheet.savePriorities'), default: true, callback: (_e: Event, btn: any) => ({ mode: "save", ...read(btn.form) }) },
        { action: "fill", label: tx('SR2E.Dialog.Sheet.fillTheSheet'), callback: (_e: Event, btn: any) => ({ mode: "fill", ...read(btn.form) }) },
      ],
      render: (_e: Event, dialog: any) => {
        const form: HTMLFormElement | null = dialog.element?.querySelector("form") ?? null;
        form?.addEventListener("change", () => { const tb = form.querySelector("table.sr2e-build tbody"); if (tb) tb.innerHTML = render(read(form)); });
      },
      rejectClose: false,
    } as any) as any;
    if (!result || typeof result !== "object") return;
    if (result.mode === "fill") {
      await actor.applyBuild({ priorities: result.priorities, metatype: result.metatype, magic: result.magic, attributes: result.attributes, gearCost: base.gearCost + (result.gear?.total ?? 0), skills: result.skills ?? [], gear: result.gear?.items ?? [], outright: Boolean(result.outright) });
    } else await replaceFlag(actor, "build", { ...(result.priorities ?? {}) }); // v0.75.0: whole (setFlag merges)
  }

  static async #onRepairArmor(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const id = target.dataset.itemId;
    if (id) await (this.document as any).repairArmor(id);
  }

  /** Set a charge (v0.43.0: where, and an optional timer). */
  static async #onSetCharge(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const id = target.dataset.itemId;
    if (!id) return;
    const picked: any = game.user?.targets?.first?.() ?? null;
    const own: any = tokenOf(actor);
    const turn = RULES.TOXINS.secondsPerTurn;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.setACharge', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.on')}</label><select name="where">${picked ? `<option value="target">${tx('SR2E.Dialog.Sheet.targeted', { pickedName: escHtml(picked.name) })}</option>` : ""}${own ? `<option value="self">${tx('SR2E.Dialog.Sheet.whereStands', { actorName: escHtml(actor.name) })}</option>` : ""}<option value="later">${tx('SR2E.Dialog.Sheet.decideWhenItGoesOffDetonate')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.timerSeconds0SetOffBy', { turn })}</label><input name="timer" type="number" value="0" min="0"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.aTimedChargeGoesOffBy')}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.set'), callback: (_e: Event, b: any) => ({ where: String(b.form.elements.where.value), timer: Math.max(0, Math.floor(Number(b.form.elements.timer.value) || 0)) }) },
      rejectClose: false,
    }) as { where: string; timer: number } | null;
    if (!choice) return;
    const tok: any = choice.where === "target" ? picked : choice.where === "self" ? own : null;
    const point = tok ? { x: tok.center.x, y: tok.center.y, elevation: Number(tok.document?.elevation) || 0 } : null;
    if (choice.timer > 0 && !point) ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.aTimerNeedsAPlaceTarget'));
    await actor.setCharge(id, { ...(point ? { point, placeName: tok.name, sceneId: canvas?.scene?.id } : {}), timerSeconds: point ? choice.timer : 0 });
  }

  /** Split a grunt group into one token per grunt (v0.44.0). */
  static async #onSplitGrunts(this: SR2CharacterSheet) {
    await (this.document as any).splitGrunts();
  }

  static #qualityForm(q: any = {}): string {
    return `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.name')}</label><input name="name" type="text" value="${escHtml(q.name ?? "")}" autofocus></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.kind')}</label><select name="kind"><option value="edge" ${q.kind !== "flaw" ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.edge')}</option><option value="flaw" ${q.kind === "flaw" ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.flaw')}</option></select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.points')}</label><input name="points" type="number" value="${escHtml(q.points ?? 1)}" min="0"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.tnModifierOnASkillOr')}</label><input name="target" type="text" value="${escHtml(q.target ?? "")}" placeholder="${tx('SR2E.Dialog.Sheet.eGStealthWillpower')}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.tnModifier')}</label><input name="tn" type="number" value="${escHtml(q.tn ?? 0)}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.notes')}</label><input name="notes" type="text" value="${escHtml(q.notes ?? "")}"></div>`;
  }
  static #readQuality(b: any) {
    const e = b.form.elements;
    return { name: String(e.name.value || "Unnamed"), kind: String(e.kind.value) === "flaw" ? "flaw" : "edge", points: Math.max(0, Math.floor(Number(e.points.value) || 0)), target: String(e.target.value ?? "").trim(), tn: Math.floor(Number(e.tn.value) || 0), notes: String(e.notes.value ?? "") };
  }
  static async #onAddQuality(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const q = await foundry.applications.api.DialogV2.prompt({ window: { title: tx('SR2E.Dialog.Sheet.edgeOrFlaw') }, content: SR2CharacterSheet.#qualityForm(), ok: { label: tx('SR2E.Dialog.Sheet.add'), callback: (_e: Event, b: any) => SR2CharacterSheet.#readQuality(b) }, rejectClose: false });
    if (q) await actor.addQuality(q);
  }
  static async #onEditQuality(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const list = [...(actor.system.qualities ?? [])].map((x: any) => ({ ...x }));
    const i = list.findIndex((x: any) => x.id === target.dataset.qualityId);
    if (i < 0) return;
    const q = await foundry.applications.api.DialogV2.prompt({ window: { title: tx('SR2E.Dialog.Sheet.edit', { name: list[i].name }) }, content: SR2CharacterSheet.#qualityForm(list[i]), ok: { label: tx('SR2E.Dialog.Sheet.save'), callback: (_e: Event, b: any) => SR2CharacterSheet.#readQuality(b) }, rejectClose: false });
    if (!q) return;
    await actor.editQuality(list[i].id, q);
  }
  /** v0.49.0: gain an edge after creation, for Good Karma. */
  static async #onGainEdge(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const rate = RULES.STREET.qualities.karma.edgePerPoint;
    const q = await foundry.applications.api.DialogV2.prompt({ window: { title: tx('SR2E.Dialog.Sheet.gainAnEdge', { actorName: actor.name }) }, content: `${SR2CharacterSheet.#qualityForm({ kind: "edge" })}<p class="hint">${tx('SR2E.Dialog.Sheet.costsGoodKarmaPerPointOn', { rate, karmaGood: escHtml(actor.system.karma?.good ?? 0) })}</p>`, ok: { label: tx('SR2E.Dialog.Sheet.gain'), callback: (_e: Event, b: any) => SR2CharacterSheet.#readQuality(b) }, rejectClose: false });
    if (q) await actor.gainEdge(q);
  }

  /** v0.49.0: buy off a flaw, for Good Karma. */
  static async #onBuyOffFlaw(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const q = (actor.system.qualities ?? []).find((x: any) => x.id === target.dataset.qualityId);
    if (!q) return;
    const cost = qualityKarmaCost("flaw", q.points);
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Sheet.buyOff2', { name: q.name }) }, content: `<p>${tx('SR2E.Dialog.Sheet.buyOff')} <strong>${escHtml(q.name)}</strong> ${tx('SR2E.Dialog.Sheet.pointsFor', { points: escHtml(q.points) })} <strong>${cost}</strong> ${tx('SR2E.Dialog.Sheet.goodKarmaHas', { actorName: escHtml(actor.name), karmaGood: escHtml(actor.system.karma?.good ?? 0) })}</p>`, rejectClose: false });
    if (ok) await actor.buyOffFlaw(q.id);
  }

  static async #onDeleteQuality(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    await actor.removeQuality(String(target.dataset.qualityId ?? ""));
  }

  static async #onSetUpWeapon(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const w: any = actor.items.get(target.dataset.itemId);
    if (!w) return;
    await actor.setUpWeapon(w.id, !w.system.supportSetUp);
  }

  /** Search someone (v0.43.0): look them over, frisk them, or sweep them with a scanner. */
  static async #onSearchPerson(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const scanners = [...actor.items].filter((i: any) => i.type === "gear" && i.system.scanner?.kind && i.system.scanner.rating > 0 && isCarried(i));
    const labels: Record<string, string> = { weapon: tx('SR2E.App.Sheets.weapons'), cyber: tx('SR2E.App.Sheets.cyberware'), explosive: tx('SR2E.App.Sheets.explosives') };
    const group: string[] = [...(game.user.targets ?? [])].map((t: any) => t.actor?.uuid).filter((u: any) => u && u !== actor.uuid);
    const r = await SR2CharacterSheet.#pickPerson(actor, tx('SR2E.Dialog.Sheet.search', { actorName: actor.name }), `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.how')}</label><select name="method">
        <option value="look">${tx('SR2E.Dialog.Sheet.lookThemOverPerceptionVsConcealability')}</option><option value="frisk">${tx('SR2E.Dialog.Sheet.friskThemTn', { concealmentFriskTn: RULES.GEAR.concealment.friskTn })}</option>
        ${scanners.map((sc: any) => `<option value="scan:${escHtml(sc.id)}">${tx('SR2E.Dialog.Sheet.rating', { scName: escHtml(sc.name), labels: escHtml(labels[sc.system.scanner.kind] ?? sc.system.scanner.kind), scannerRating: escHtml(sc.system.scanner.rating) })}</option>`).join("")}</select></div>
      ${group.length > 1 ? `<label class="sr2e-check"><input type="checkbox" name="group" checked> ${tx('SR2E.Dialog.Sheet.everyoneTargetedAtOnceTnPer', { groupLength: group.length, concealmentGroupTnPerPerson: RULES.GEAR.concealment.groupTnPerPerson })}</label>` : ""}
      <p class="hint">${tx('SR2E.Dialog.Sheet.theResultIsWhisperedToThe', { actorName: escHtml(actor.name) })}</p>`);
    if (!r) return;
    const m = String(r.form.method ?? "look");
    const mod = Number(r.form.mod) || 0;
    const opts = { method: m.startsWith("scan:") ? "scanner" : (m as any), ...(m.startsWith("scan:") ? { scannerId: m.slice(5) } : {}), modifiers: mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [] };
    if (r.form.group && group.length > 1 && opts.method !== "frisk") await actor.searchGroup(group, opts);
    else await actor.searchFor(r.uuid, opts);
  }

  static async #onFullDefense(this: SR2CharacterSheet) {
    await (this.document as any).declareFullDefense();
    this.render();
  }

  static async #onDelayAction(this: SR2CharacterSheet) {
    await (this.document as any).delayAction();
    ui.combat?.render?.();
    this.render();
  }

  static async #onActNow(this: SR2CharacterSheet) {
    await (this.document as any).actNow();
    ui.combat?.render?.();
    this.render();
  }

  static async #onEndDelayed(this: SR2CharacterSheet) {
    await (this.document as any).endDelayedAction();
    ui.combat?.render?.();
    this.render();
  }

  static async #onClearJam(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const id = target.dataset.itemId ?? [...this.document.items].find((i: any) => i.type === "weapon" && i.system.jammed)?.id;
    if (id) await (this.document as any).clearJam(id);
  }

  static async #onImprove(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const t = target.dataset.attribute ? { attribute: target.dataset.attribute } : { skillId: target.dataset.itemId, specialization: target.dataset.spec === "1", concentration: target.dataset.conc === "1" };
    const c = actor.improveCost(t);
    if (!c.ok) return ui.notifications.warn(tx('SR2E.Notify.Sheet.canTRaise', { label: escHtml(c.label), reason: escHtml(c.reason) }));
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Sheet.raise2', { label: c.label }) },
      content: `<p>${tx('SR2E.Dialog.Sheet.raise')} <strong>${escHtml(c.label)}</strong> ${tx('SR2E.Dialog.Sheet.fromToFor', { from: escHtml(c.from), to: escHtml(c.to) })} <strong>${tx('SR2E.Dialog.Sheet.karma', { cost: escHtml(c.cost) })}</strong>${tx('SR2E.Dialog.Sheet.hasGoodKarma', { actorName: escHtml(actor.name), karmaGood: escHtml(actor.system.karma?.good ?? 0) })}</p>${RULES.CHARACTERS_V58.training.mode === "timed" ? `<p class="hint">${tx('SR2E.Dialog.Sheet.trainingTimeIsOnTheKarma')}</p>` : ""}${approvalNeeded(actor) ? `<p class="hint">${tx('SR2E.Dialog.Sheet.theApprovalQueueIsOnThis')}</p>` : ""}`,
      rejectClose: false,
    });
    if (ok) await actor.improve(t);
  }

  static async #onPayLifestyle(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const st = actor.lifestyleStatus();
    // v0.73.0 (O31): owned outright, or buy it outright (RULES.CHARACTERS_V73.lifestyle).
    if (st.permanent) return void ui.notifications?.info?.(tx('SR2E.Notify.Sheet.sLifestyleIsOwnedOutright', { actorName: escHtml(actor.name), stLabel: escHtml(st.label) }));
    const buy: any = RULES.CHARACTERS_V73.lifestyle.buyLater && RULES.CHARACTERS_V73.lifestyle.outrightPermanent
      ? outrightPurchase({ lifestyle: actor.system.lifestyle?.level ?? "low", outright: false, paidUntil: Number(actor.system.lifestyle?.paidUntil ?? -1), now: sysNow(), nuyen: Number(actor.system.nuyen ?? 0) } as any) : null;
    const choice: any = await foundry.applications.api.DialogV2.wait({
      window: { title: tx('SR2E.Dialog.Sheet.payLifestyle', { actorName: actor.name }) },
      content: `<p>${tx('SR2E.Dialog.Sheet.lifestyleAMonthHas', { stLabel: escHtml(st.label), stCost: st.cost.toLocaleString(), actorName: escHtml(actor.name), actorNuyen: (actor.system.nuyen ?? 0).toLocaleString() })}</p>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.months2')}</label><input name="months" type="number" value="1" min="1"></div>
        ${buy ? `<p class="hint">${tx('SR2E.Dialog.Sheet.orBuyItOutrightForOwned', { buyCost: Number(buy.cost ?? 0).toLocaleString() })}</p>` : ""}`,
      buttons: [
        { action: "pay", label: tx('SR2E.Dialog.Sheet.pay'), default: true, callback: (_e: Event, b: any) => ({ months: Number(b.form.elements.months.value) || 0 }) },
        ...(buy ? [{ action: "outright", label: tx('SR2E.Dialog.Sheet.buyOutright'), callback: () => ({ outright: true }) }] : []),
        { action: "cancel", label: tx('SR2E.Dialog.Sheet.cancel') },
      ],
      rejectClose: false,
    } as any);
    if (choice?.outright) await actor.buyLifestyleOutright();
    else if (choice?.months) await actor.payLifestyle(choice.months);
  }

  /** v0.61.0: pay the DocWagon contract for some years. */
  static async #onPayDocwagon(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const t = RULES.HEALTH_V61.docwagon.tiers.find((x) => x.id === actor.system.docwagon?.tier);
    if (!t) return ui.notifications.warn(tx('SR2E.Notify.Sheet.pickADocwagonContractFirst'));
    const years = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.payDocwagon', { actorName: actor.name }) },
      content: `<p>${tx('SR2E.Dialog.Sheet.docwagonAYearHas', { label: escHtml(t.label), yearlyFee: t.yearlyFee.toLocaleString(), actorName: escHtml(actor.name), actorNuyen: (actor.system.nuyen ?? 0).toLocaleString() })}</p>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.years')}</label><input name="years" type="number" value="1" min="1"></div>`,
      ok: { label: tx('SR2E.Dialog.Sheet.pay'), callback: (_e: Event, b: any) => Math.floor(Number(b.form.elements.years.value) || 0) },
      rejectClose: false,
    });
    if (years) await actor.payDocwagon(years);
  }

  /** v0.61.0: call DocWagon by hand (the biomonitor calls by itself when dying). */
  static async #onCallDocwagon(this: SR2CharacterSheet) {
    await (this.document as any).callDocwagon({ auto: false });
  }

  static async #onNuyen(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.nuyen', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.amountToSpend')}</label><input name="amount" type="number" value="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.whatFor')}</label><input name="reason" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGRunPaymentBribe')}"></div>`,
      ok: { label: tx('SR2E.Dialog.Sheet.record'), callback: (_e: Event, b: any) => ({ amount: Number(b.form.elements.amount.value) || 0, reason: String(b.form.elements.reason.value) }) },
      rejectClose: false,
    });
    if (!r?.amount) return;
    // v0.64.0: with the approval queue on, the GM records income (players record spending only).
    if (r.amount > 0 && approvalNeeded(actor)) return ui.notifications.warn(tx('SR2E.Notify.Sheet.theApprovalQueueIsOnThe'));
    await actor.adjustNuyen(r.amount, r.reason);
  }

  static #contactForm(c: any = {}): string {
    const levels = RULES.UPKEEP.contacts.levels;
    return `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.name')}</label><input name="name" type="text" value="${escHtml(c.name)}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.level')}</label><select name="level">${levels.map((l) => `<option value="${l.level}" ${l.level === (c.level ?? 1) ? "selected" : ""}>${escHtml(l.label)}</option>`).join("")}</select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.whoTheyAre')}</label><input name="role" type="text" value="${escHtml(c.role ?? "")}" placeholder="${tx('SR2E.Dialog.Sheet.eGFixerBartender')}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.loyalty1CapsTheDicePayment', { contactsMaxLoyalty: RULES.STREET.contacts.maxLoyalty })}</label><input name="loyalty" type="number" value="${escHtml(c.loyalty ?? 1)}" min="1" max="${RULES.STREET.contacts.maxLoyalty}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.whatTheyKnowSkills')}</label><input name="skills" type="text" value="${escHtml(c.skills ?? "")}" placeholder="${tx('SR2E.Dialog.Sheet.eGStreetGangs4City')}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.feePerLegwork')}</label><input name="fee" type="number" value="${escHtml(c.fee ?? 0)}" min="0"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.theirOwnDiceForDigging0')}</label><input name="dice" type="number" value="${escHtml(c.dice ?? 0)}" min="0" max="100"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.favoursTheyOweYouYouOwe')}</label><input name="favours" type="number" value="${escHtml(c.favours ?? 0)}" min="-${RULES.STREET.contacts.maxFavours}" max="${RULES.STREET.contacts.maxFavours}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.notes')}</label><input name="notes" type="text" value="${escHtml(c.notes ?? "")}"></div>
      <label class="sr2e-check"><input type="checkbox" name="fixer" ${c.fixer ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.isAFixerFinds')}</label>`;
  }

  static #readContact(b: any) {
    const e = b.form.elements;
    return { name: String(e.name.value), level: Number(e.level.value) || 1, role: String(e.role.value), notes: String(e.notes.value),
      loyalty: Math.max(1, Math.min(RULES.STREET.contacts.maxLoyalty, Math.floor(Number(e.loyalty?.value) || 1))), skills: String(e.skills?.value ?? ""), fee: Math.max(0, Math.floor(Number(e.fee?.value) || 0)),
      dice: Math.max(0, Math.min(100, Math.floor(Number(e.dice?.value) || 0))), favours: Math.max(-RULES.STREET.contacts.maxFavours, Math.min(RULES.STREET.contacts.maxFavours, Math.floor(Number(e.favours?.value) || 0))),
      fixer: Boolean(e.fixer?.checked) };
  }

  static async #onAddContact(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const c = await foundry.applications.api.DialogV2.prompt({ window: { title: tx('SR2E.Dialog.Sheet.newContact') }, content: SR2CharacterSheet.#contactForm(), ok: { label: tx('SR2E.Dialog.Sheet.add'), callback: (_e: Event, b: any) => SR2CharacterSheet.#readContact(b) }, rejectClose: false });
    if (c) await actor.addContact(c);
  }

  static async #onEditContact(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const list = [...(actor.system.contacts ?? [])].map((x: any) => ({ ...x }));
    const i = list.findIndex((x: any) => x.id === target.dataset.contactId);
    if (i < 0) return;
    const c = await foundry.applications.api.DialogV2.prompt({ window: { title: tx('SR2E.Dialog.Sheet.contact', { name: list[i].name }) }, content: SR2CharacterSheet.#contactForm(list[i]), ok: { label: tx('SR2E.Dialog.Sheet.save'), callback: (_e: Event, b: any) => SR2CharacterSheet.#readContact(b) }, rejectClose: false });
    if (!c) return;
    list[i] = { ...list[i], ...c };
    await actor.update({ "system.contacts": list });
  }

  static async #onDeleteContact(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    await actor.update({ "system.contacts": (actor.system.contacts ?? []).filter((x: any) => x.id !== target.dataset.contactId) });
  }

  static async #onLegwork(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const c = (actor.system.contacts ?? []).find((x: any) => x.id === target.dataset.contactId);
    if (!c) return;
    const d = legworkDifficulties();
    // v0.78.0 (RULES.BOOK_V78.legwork 'book'): the book's TN modifiers; a closer contact adds dice.
    const book = RULES.BOOK_V78.legwork.mode === "book";
    const L = RULES.BOOK_V78.legwork;
    const fixerGuess = Boolean(c.fixer) || /fixer|johnson/i.test(String(c.role ?? ""));
    const closer = legworkLevelDice(c.level ?? 1);
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.legworkAsk', { name: c.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.about')}</label><input name="question" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGTheJohnson')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.howHardToFindOut')}</label><select name="tn">${d.map((x, i) => `<option value="${x.tn}" ${i === 1 ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.tn2', { label: escHtml(x.label), tn: x.tn })}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.skill')}</label><input name="skill" type="text" value="${RULES.UPKEEP.contacts.skill}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.payExtraADieAtMost', { contactsNuyenPerDie: RULES.STREET.contacts.nuyenPerDie, loyalty: escHtml(c.loyalty ?? 1) })}</label><input name="pay" type="number" value="0" min="0" step="${RULES.STREET.contacts.nuyenPerDie}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        ${(c.dice ?? 0) > 0 && RULES.STREET.contacts.ownDice !== "off" ? `<label class="sr2e-check"><input type="checkbox" name="digs" checked> ${tx('SR2E.Dialog.Sheet.digsTooDice', { name: escHtml(c.name), dice: escHtml(c.dice), part: RULES.STREET.contacts.ownDice === "best" ? tx('SR2E.Dialog.Sheet.theBetterResultCounts') : RULES.STREET.contacts.ownDice === "add" ? tx('SR2E.Dialog.Sheet.theirSuccessesAddToYours') : tx('SR2E.Dialog.Sheet.onlyTheirsCounts') })}</label>` : ""}
        <label class="sr2e-check"><input type="checkbox" name="favour"> ${tx('SR2E.Dialog.Sheet.callInAFavourDice', { contactsFavourDice: RULES.STREET.contacts.favourDice, part: RULES.STREET.contacts.favourWaivesFee && c.fee ? tx('SR2E.Dialog.Sheet.noFee') : "", part2: (c.favours ?? 0) > 0 ? tx('SR2E.Dialog.Sheet.owes', { name: escHtml(c.name), favours: escHtml(c.favours) }) : tx('SR2E.Dialog.Sheet.owesNoneYouLlOweThem', { name: escHtml(c.name) }) })}</label>
        ${book ? `<label class="sr2e-check"><input type="checkbox" name="specialty"> ${tx('SR2E.Dialog.Sheet.itSSSpecialtyTn', { name: escHtml(c.name), specialtyTn: L.specialtyTn })}</label>
        <label class="sr2e-check"><input type="checkbox" name="fixer" ${fixerGuess ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.isAFixerOrMrJohnson', { name: escHtml(c.name), fixerTn: L.fixerTn })}</label>
        <label class="sr2e-check"><input type="checkbox" name="fof"> ${tx('SR2E.Dialog.Sheet.throughAFriendOfAFriend', { friendOfFriendTn: L.friendOfFriendTn })}</label>` : ""}
        <p class="hint">${book ? tx('SR2E.Dialog.Sheet.aCloserContactAddsDice', { part: closer ? tx('SR2E.Dialog.Sheet.for', { closer, name: escHtml(c.name) }) : tx('SR2E.Dialog.Sheet.aBuddy1AFriendFor') }) : tx('SR2E.Dialog.Sheet.aCloserContactMakesItEasier', { contactsTnPerLevel: RULES.UPKEEP.contacts.tnPerLevel })}${c.fee ? tx('SR2E.Dialog.Sheet.sFee', { name: escHtml(c.name), fee: escHtml(c.fee) }) : ""}${c.skills ? tx('SR2E.Dialog.Sheet.knows', { skills: escHtml(c.skills) }) : ""}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.ask'), callback: (_e: Event, b: any) => { const e = b.form.elements; return { question: String(e.question.value), tn: Number(e.tn.value), skill: String(e.skill.value), mod: Number(e.mod.value) || 0, pay: Math.max(0, Math.floor(Number(e.pay.value) || 0)), digs: e.digs ? Boolean(e.digs.checked) : false, favour: Boolean(e.favour.checked), specialty: e.specialty ? Boolean(e.specialty.checked) : false, fixer: e.fixer ? Boolean(e.fixer.checked) : false, fof: e.fof ? Boolean(e.fof.checked) : false }; } },
      rejectClose: false,
    });
    if (!r) return;
    await actor.legwork(c.id, { difficultyTn: r.tn, skillName: r.skill, question: r.question, pay: r.pay, contactDigs: r.digs, favour: r.favour, specialty: r.specialty, fixer: r.fixer, friendOfFriend: r.fof, modifiers: r.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: r.mod }] : [] });
  }

  /** v0.49.0: one more favour owed (data-delta 1) or one fewer (−1). */
  static async #onFavour(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).adjustFavours(target.dataset.contactId, Number(target.dataset.delta) || 0);
  }

  /** v0.49.0: raise an otaku channel by one for Karma. */
  static async #onRaiseChannel(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const sub = String(target.dataset.channel ?? "");
    const to = Number(actor.system.matrix?.channels?.[sub] ?? 0) + 1;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Sheet.channel', { sub: cap(sub) }) }, content: `<p>${tx('SR2E.Dialog.Sheet.raiseTheChannelToFor', { sub: escHtml(cap(sub)), to })} <strong>${channelRaiseCost(to)}</strong> ${tx('SR2E.Dialog.Sheet.goodKarmaOnHand', { karmaGood: escHtml(actor.system.karma?.good ?? 0) })}</p>`, rejectClose: false });
    if (ok) await actor.raiseChannel(sub);
  }

  /** v0.49.0: learn a complex form (an otaku's program) for Karma. */
  static async #onLearnComplexForm(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const cap0 = otakuCap(actor.system.derived?.matrix?.mpcp ?? 0);
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.learnAComplexForm', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.kind')}</label><select name="kind" autofocus>${UTILITY_KINDS.filter((k) => !["other", "frame", "smart-frame", "agent"].includes(k)).map((k) => `<option value="${k}">${escHtml(cap(k))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.ratingAtMost', { cap0 })}</label><input name="rating" type="number" value="${Math.min(4, Math.max(1, cap0))}" min="1" max="${Math.max(1, cap0)}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.attackDamageLevel')}</label><select name="level">${["L", "M", "S", "D"].map((k) => `<option value="${escHtml(k)}" ${k === "M" ? "selected" : ""}>${escHtml(k)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.name')}</label><input name="name" type="text" placeholder="${tx('SR2E.Dialog.Sheet.kindAndRating')}"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.goodKarmaPerPointOfRating', { complexFormsKarmaPerRating: RULES.MATRIX.otaku.complexForms.karmaPerRating, karmaGood: escHtml(actor.system.karma?.good ?? 0) })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.learn'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { kind: String(el.kind.value), rating: Math.max(1, Math.floor(Number(el.rating.value) || 1)), damageLevel: String(el.level.value), name: String(el.name.value ?? "").trim() }; } },
      rejectClose: false,
    });
    if (!choice) return;
    const cost = complexFormCost(choice.rating);
    if (cost > Number(actor.system.karma?.good ?? 0)) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thatCostsKarmaHas', { cost, actorName: escHtml(actor.name), karmaGood: escHtml(actor.system.karma?.good ?? 0) }));
    await actor.learnComplexForm({ ...choice, ...(choice.name ? {} : { name: undefined }) });
  }

  /** v0.49.0: clear a jammed wireless Matrix link. */
  static async #onUnjamLink(this: SR2CharacterSheet) {
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Sheet.theGmClearsAJamOr'));
    await (this.document as any).unjamLink();
  }

  static async #onFindItem(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const id = target.dataset.itemId;
    if (!id) return;
    // v0.91.6: on their own, through a contact or a fixer (closing the dialog finds nothing).
    const through = await askFindThrough(this.document);
    if (through !== false) await (this.document as any).findItem(id, { through });
  }

  static async #onStandUp(this: SR2CharacterSheet) {
    await (this.document as any).standUp();
  }

  static async #onTakeDrug(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).takeDrug(target.dataset["itemId"]);
  }

  static async #onEndDrug(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).endDrug(Number(target.dataset["index"]));
  }

  // ---------------------------------------------------------------- v0.55.0

  /** The first targeted token's actor (uuid), or ''. */
  static #firstTarget(): string {
    return (game.user?.targets?.first?.() as any)?.actor?.uuid ?? "";
  }

  /** Take Aim with a weapon at the targeted token. */
  static async #onTakeAim(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const t = SR2CharacterSheet.#firstTarget();
    if (!t) return ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.targetATokenToAimAt'));
    await (this.document as any).takeAim(target.dataset["itemId"] ?? "", t);
  }

  /** Suppressive fire at every targeted token. */
  static async #onSuppressFire(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const uuids = [...(game.user?.targets ?? [])].map((t: any) => t.actor?.uuid).filter(Boolean) as string[];
    if (!uuids.length) return ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.targetThePeopleInTheArea'));
    const sf = RULES.COMBAT.suppressive;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Sheet.suppressiveFire') }, content: `<p>${tx('SR2E.Dialog.Sheet.useRoundsToSuppressTargetA', { sfRounds: sf.rounds, uuidsLength: tCount(uuids.length, 'SR2E.Count.target'), part: sf.coverIsSafe ? tx('SR2E.Dialog.Sheet.thenTheFirePassesOverThem') : "" })}</p>`, rejectClose: false } as any);
    if (!ok) return;
    await (this.document as any).suppressiveFire(target.dataset["itemId"] ?? "", uuids);
  }

  /** Draw (or holster) a weapon: drawing is a Simple Action (RULES.COMBAT.ready), free with a quick-draw holster. */
  /** v0.92.1 (RULES.SHEET_V921.carried): carry a weapon, armor or gear, or leave it behind (armor comes off, a weapon is holstered). */
  static async #onToggleCarried(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const item = actor.items.get(target.dataset["itemId"]);
    if (!item || !["weapon", "armor", "gear"].includes(item.type) || !actor.isOwner) return;
    await item.update({ "system.carried": item.system.carried === false });
  }

  static async #onDrawWeapon(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const w = actor.items.get(target.dataset["itemId"]);
    if (!w) return;
    if (w.system.ready) return w.update({ "system.ready": false });
    if (RULES.COMBAT.ready.rule === "action" && !w.system.quickDraw && !(await actor.useAction("draw", tx('SR2E.Card.Sheet.drawing', { name: w.name })))) return;
    await w.update({ "system.ready": true });
  }

  /** A slap patch on yourself or the targeted token. */
  static async #onApplyPatch(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).applyPatch(target.dataset["itemId"] ?? "", SR2CharacterSheet.#firstTarget());
  }

  static async #onPutOutFire(this: SR2CharacterSheet) {
    await (this.document as any).putOutFire();
  }

  /** Hold (pin) the targeted token. */
  static async #onHoldTarget(this: SR2CharacterSheet) {
    const t = SR2CharacterSheet.#firstTarget();
    if (!t) return ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.targetSomeoneToHoldFirst'));
    await (this.document as any).holdTarget(t);
  }

  static async #onBreakFree(this: SR2CharacterSheet) {
    await (this.document as any).breakFree();
  }

  /** Expose people to a toxin: the targeted tokens, or a pick from the scene's tokens and world actors. */
  static async #onExpose(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const item = actor.items.get(target.dataset["itemId"]);
    if (!item) return;
    const targeted = [...(game.user.targets ?? [])].map((t: any) => t.actor?.uuid).filter(Boolean);
    const people = allActors().filter((a: any) => ["character", "npc", "spirit"].includes(a.type));
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.exposeTo', { itemName: item.name }) },
      content: `<fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Sheet.whoIsExposed')}</legend>${people.map((a: any) => `<label class="sr2e-check"><input type="checkbox" name="who" value="${escHtml(a.uuid)}" ${targeted.includes(a.uuid) ? "checked" : ""}> ${escHtml(a.name)}</label>`).join("")}</fieldset>`,
      ok: { label: tx('SR2E.Dialog.Sheet.expose'), callback: (_e: Event, b: any) => Array.from(b.form.querySelectorAll('input[name="who"]:checked')).map((i: any) => i.value as string) },
      rejectClose: false,
    });
    if (!choice?.length) return;
    await actor.exposeTo(item, choice);
  }

  /** Addictions and diseases (v0.42.0). */
  static async #onKickHabit(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const a = (actor.system.addictions ?? [])[Number(target.dataset["index"])];
    if (a) await actor.drugAddictionTest(a.drug, "kick");
  }
  static async #onClearAddiction(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const list = [...(actor.system.addictions ?? [])];
    if (!spliceRow(list, target)) return;
    await actor.update({ "system.addictions": list });
  }
  static async #onDiseaseTick(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).rollDiseaseTick(Number(target.dataset["index"]));
  }
  static async #onClearDisease(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const list = [...(actor.system.diseases ?? [])];
    if (!spliceRow(list, target)) return;
    await actor.update({ "system.diseases": list });
  }
  static async #onToggleTreated(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const list = [...(actor.system.diseases ?? [])].map((x: any) => ({ ...x }));
    const d = list[Number(target.dataset["index"])];
    if (!d) return;
    d.treated = !d.treated;
    await actor.update({ "system.diseases": list });
  }

  /** Falling, fire, drowning, cold, fatigue. */
  static async #onHazard(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const H = RULES.HAZARDS;
    // v0.72.0 (O12): heat and electricity (RULES.HEALTH_V72.hazards).
    const H72: any = RULES.HEALTH_V72.hazards;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.hazard2', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.hazard')}</label><select name="kind"><option value="falling">${tx('SR2E.Dialog.Sheet.falling')}</option><option value="fire">${tx('SR2E.Dialog.Sheet.fire__hazard')}</option><option value="drowning">${tx('SR2E.Dialog.Sheet.drowning')}</option><option value="cold">${tx('SR2E.Dialog.Sheet.coldExposure')}</option><option value="fatigue">${tx('SR2E.Dialog.Sheet.fatigue')}</option><option value="radiation">${tx('SR2E.Dialog.Sheet.radiation')}</option><option value="suffocation">${tx('SR2E.Dialog.Sheet.suffocation')}</option>${H72.heat.enabled ? `<option value="heat">${tx('SR2E.Dialog.Sheet.heatExposure')}</option>` : ""}${H72.electricity.enabled ? `<option value="electricity">${tx('SR2E.Dialog.Sheet.electricShock')}</option>` : ""}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.fallingMetres')}</label><input name="metres" type="number" value="5" min="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.fire')}</label><select name="fire">${H.fire.intensities.map((x) => `<option value="${escHtml(x.id)}">${escHtml(x.label)} (${x.power}${x.level})</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.drowningCombatTurnsUnder')}</label><input name="turns" type="number" value="1" min="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.cold')}</label><select name="cold">${H.cold.severities.map((x) => `<option value="${escHtml(x.id)}">${tx('SR2E.Dialog.Sheet.tn2', { label: escHtml(x.label), tn: x.tn })}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.fatigueRadiationHours')}</label><input name="hours" type="number" value="1" min="1"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.radiationRating')}</label><input name="rad" type="number" value="4" min="1"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.suffocationCombatTurnsWithoutAir')}</label><input name="air" type="number" value="1" min="0"></div>
        ${H72.heat.enabled ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.heat')}</label><select name="heat">${H72.heat.severities.map((x: any) => `<option value="${escHtml(x.id)}">${tx('SR2E.Dialog.Sheet.tn2', { label: escHtml(x.label), tn: escHtml(x.tn) })}</option>`).join("")}</select></div>` : ""}
        ${H72.electricity.enabled ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.electricity')}</label><select name="shock">${H72.electricity.sources.map((x: any) => `<option value="${escHtml(x.id)}">${escHtml(x.label)} (${escHtml(x.power)}${escHtml(x.level)} ${escHtml(x.type)})</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.electricityInsulationRating')}</label><input name="insulation" type="number" value="0" min="0"></div>` : ""}
        <p class="hint">${tx('SR2E.Dialog.Sheet.fallingPowerPerMetreHalfImpact', { fallingPowerPerMetre: H.falling.powerPerMetre, fallingLevel: H.falling.level, drowningLevel: H.drowning.level, coldLevel: H.cold.level, fatigueLevel: H.fatigue.level, radiationLevel: RULES.HEALTH.radiation.level, suffocationTn: RULES.HEALTH.suffocation.tn, suffocationTnPerTurn: RULES.HEALTH.suffocation.tnPerTurn, suffocationLevel: RULES.HEALTH.suffocation.level, part: H72.heat.enabled ? tx('SR2E.Dialog.Sheet.heatBodyVsATnLike') : "", part2: H72.electricity.enabled ? tx('SR2E.Dialog.Sheet.electricityPartOfImpactArmorInsulation') : "" })}</p>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.roll'),
        callback: (_e: Event, b: any) => {
          const el = b.form.elements;
          const kind = String(el.kind.value);
          const amount = kind === "heat" ? String(el.heat?.value ?? "") : kind === "electricity" ? String(el.shock?.value ?? "") : kind === "falling" ? Number(el.metres.value) || 0 : kind === "fire" ? String(el.fire.value) : kind === "drowning" ? Number(el.turns.value) || 0 : kind === "cold" ? String(el.cold.value)
            : kind === "radiation" ? Number(el.rad.value) || 1 : kind === "suffocation" ? Number(el.air.value) || 0 : Number(el.hours.value) || 1;
          return { kind, amount, hours: Number(el.hours.value) || 1, insulation: Number(el.insulation?.value) || 0 };
        },
      },
      rejectClose: false,
    });
    if (!choice) return;
    await actor.resistHazard(choice.kind, choice.amount, { hours: choice.hours, insulation: choice.insulation });
  }

  static async #onToggleAdrenal(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const item = actor.items.get(target.dataset["itemId"]);
    if (item) await actor.setAdrenalPump(item.id, !item.system.bioActive);
  }

  static async #onSurgery(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const surgeons = allActors().filter((a: any) => a.isOwner && ["character", "npc"].includes(a.type));
    // v0.48.0: who operates, and the care the patient recovers under (and whether to pay for it).
    const lifestyle = String(actor.system.lifestyle?.level ?? "");
    const cares = RULES.HEALING.natural.care.map((c) => ({ ...c, factor: careFactor(c.id, lifestyle), cost: RULES.HEALTH.careCosts[c.id] ?? 0 }));
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.surgeryOn', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.whoOperates')}</label><select name="surgeon" autofocus>${surgeons.map((a: any) => `<option value="${escHtml(a.uuid)}">${escHtml(a.name)}${a.findSkill?.(RULES.BIOWARE.surgery.skill) ? ` (${RULES.BIOWARE.surgery.skill} ${escHtml(a.findSkill(RULES.BIOWARE.surgery.skill).system.rating)})` : ""}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.careWhileRecovering')}</label><select name="care">${cares.map((c) => `<option value="${escHtml(c.id)}" ${c.id === RULES.BIOWARE.recovery.defaultCare ? "selected" : ""}>${escHtml(c.label)} (×${c.factor}${c.cost ? tx('SR2E.Dialog.Sheet.day', { cost: c.cost }) : ""})</option>`).join("")}</select></div>
        <label class="sr2e-check"><input type="checkbox" name="pay" checked> ${tx('SR2E.Dialog.Sheet.payForHospitalOrIntensiveCare', { actorName: escHtml(actor.name) })}</label>`,
      ok: { label: tx('SR2E.Dialog.Sheet.operate'), callback: (_e: Event, b: any) => ({ surgeon: String(b.form.elements.surgeon.value ?? ""), care: String(b.form.elements.care.value ?? ""), pay: Boolean(b.form.elements.pay.checked) }) },
      rejectClose: false,
    });
    if (!choice?.surgeon) return;
    await actor.surgery(target.dataset["itemId"], { surgeon: fromUuidSync(choice.surgeon), care: choice.care, pay: choice.pay });
  }

  /** v0.48.0: change the care a patient recovers from surgery under. */
  static async #onRecoveryCare(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const lifestyle = String(actor.system.lifestyle?.level ?? "");
    const pick = await pickOne(tx('SR2E.Dialog.Sheet.careFor', { actorName: actor.name }), RULES.HEALING.natural.care.map((c) => ({ value: c.id, label: `${c.label} (×${careFactor(c.id, lifestyle)})` })));
    if (pick) await actor.setRecoveryCare(target.dataset["itemId"] ?? "", pick);
  }

  /** v0.48.0: pass a contagious disease on. */
  static async #onSpreadDisease(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).spreadDisease(Number(target.dataset["index"] ?? -1));
  }

  /** v0.48.0 (GM): clear the radiation dose. */
  static async #onClearRadiation(this: SR2CharacterSheet) {
    if (!game.user?.isGM) return;
    await (this.document as any).update({ "system.radiation": { dose: 0, at: sysNow() } });
  }

  /** v0.48.0: give up a deed ordeal waiting for the GM. */
  static async #onCancelDeed(this: SR2CharacterSheet) {
    await clearFlag(this.document, "pendingInitiation");
  }

  /** v0.48.0: an ally spirit by ritual. */
  static async #onCreateAlly(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const magic = Number(actor.system.derived?.magic ?? 0);
    const grade = Number(actor.system.initiateGrade ?? 0);
    const max = RULES.OCCULT.ally.maxForce === "grade" ? grade : magic;
    const templates = allActors().filter((a: any) => a.type === "spirit" && a.isOwner);
    const left = Number(actor.system.derived?.spellPoolLeft ?? 0);
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.createAnAlly', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.forceAtMost', { max })}</label><input name="force" type="number" value="${Math.max(1, Math.min(max, 3))}" min="1" max="${max}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.formOrType')}</label><input name="type" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGRavenAllyFamiliar')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.copyFrom')}</label><select name="template"><option value="">${tx('SR2E.Dialog.Sheet.aBlankSpirit')}</option>${templates.map((t: any) => `<option value="${escHtml(t.uuid)}">${escHtml(t.name)}</option>`).join("")}</select></div>
        <label class="sr2e-check"><input type="checkbox" name="pay" checked> ${tx('SR2E.Dialog.Sheet.payForTheRitualMaterials')}</label>
        ${RULES.SPIRITS_V923.allyCost === "book" ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.allyDesignKarma')}</label><input name="design" type="number" value="0" min="0"></div>
        <label class="sr2e-check"><input type="checkbox" name="familiar"> ${tx('SR2E.Dialog.Sheet.allyForFamiliarOrdeal')}</label>` : ""}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spellPoolDiceForDrainLeft', { left })}</label><input name="drainPool" type="number" value="0" min="0" max="${left}"></div>
        <p class="hint" data-ally></p>`,
      render: (_e: Event, dialog: any) => {
        const form: HTMLFormElement | null = dialog.element?.querySelector?.("form") ?? null;
        const upd = () => {
          const el: any = form?.elements;
          const out = form?.querySelector("[data-ally]");
          if (!el || !out) return;
          const f = Math.max(1, Math.floor(Number(el.force.value) || 1));
          const c = allyCosts(f, { designKarma: Math.max(0, Math.floor(Number(el.design?.value) || 0)), familiar: Boolean(el.familiar?.checked) });
          const p = allyProblem({ grade, magic, force: f });
          // v0.92.3 (RULES.SPIRITS_V923.allyCost 'book', Grimoire pp. 70–71): days ÷ successes, a Magic point, daily fatigue.
          out.textContent = p || (RULES.SPIRITS_V923.allyCost === "book"
            ? tx('SR2E.Dialog.Sheet.allyBookPlan', { tn: c.tn, days: c.days, nuyen: c.nuyen, karma: c.karma, magic: c.magic })
            : tx('SR2E.Dialog.Sheet.conjuringVsTnDaySMaterials', { tn: c.tn, days: c.days, nuyen: c.nuyen, karma: c.karma }));
        };
        form?.addEventListener("input", upd);
        upd();
      },
      ok: { label: tx('SR2E.Dialog.Sheet.beginTheRitual'), callback: (_e: Event, b: any) => {
        const el: any = b.form.elements;
        return { force: Math.max(1, Math.floor(Number(el.force.value) || 1)), spiritType: String(el.type.value ?? "").trim(), templateUuid: (el.template.value as string) || null,
          payMaterials: Boolean(el.pay.checked), drainPoolDice: Math.max(0, Math.min(left, Math.floor(Number(el.drainPool.value) || 0))),
          ...(el.design ? { designKarma: Math.max(0, Math.floor(Number(el.design.value) || 0)) } : {}), ...(el.familiar?.checked ? { familiar: true } : {}) };
      } },
      rejectClose: false,
    });
    if (choice) await actor.createAlly(choice);
  }

  static async #onRepairCyber(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).repairCyberware(target.dataset["itemId"]);
  }

  static async #onToggleSlotted(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const item = (this.document as any).items.get(target.dataset["itemId"]);
    if (item) await item.update({ "system.chip.slotted": !item.system.chip?.slotted });
  }

  static async #onToggleLoaded(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const item = actor.items.get(target.dataset["itemId"]);
    // v0.57.0: jacked in, loading takes time and an action (Swap Memory).
    if (item) { if (!(await actor.swapProgram(item.id, !item.system.loaded))) this.render(); }
  }

  /** v0.57.0: Locate Decker, Locate IC or Analyze Icon. */
  static async #onMatrixPerceive(this: SR2CharacterSheet) {
    const actor: any = this.document;
    if (!actor.isJackedIn()) return ui.notifications.warn(tx('SR2E.Notify.Sheet.isNotJackedIn', { actorName: escHtml(actor.name) }));
    const targets = matrixTargets(actor, actor.system.matrix.hostUuid);
    if (!targets.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereIsNothingElseInS', { actorName: escHtml(actor.name) }));
    const left = RULES.MATRIX_V57.perception.pool ? actor.system.derived.hackingPoolLeft as number : 0;
    const targeted: any = game.user.targets?.first?.()?.actor ?? null;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.matrixPerception', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.test')}</label><select name="kind"><option value="locateDecker">${tx('SR2E.Dialog.Sheet.locateDecker')}</option><option value="locateIc">${tx('SR2E.Dialog.Sheet.locateIc')}</option><option value="analyzeIcon">${tx('SR2E.Dialog.Sheet.analyzeIcon')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.icon')}</label><select name="target">${targets.map((t: any) => `<option value="${escHtml(t.uuid)}" ${t.uuid === targeted?.uuid ? "selected" : ""}>${escHtml(t.name)}${t.type === "ic" ? ` (${escHtml(t.system.kind === "ic" ? tx('SR2E.Dialog.Sheet.ic') : t.system.kind)})` : tx('SR2E.Dialog.Sheet.persona')}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        ${left > 0 ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.hackingPoolDiceLeft', { left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>` : ""}
        <p class="hint">${tx('SR2E.Dialog.Sheet.vsAPersonaSDetectionFactor', { part: RULES.MATRIX_V57.perception.dice === "sensors" ? tx('SR2E.Dialog.Sheet.yourPersonaSSensors') : RULES.MATRIX.skill })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.roll'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { kind: String(el.kind.value), target: String(el.target.value), mod: Number(el.mod.value) || 0, pool: Math.max(0, Math.min(left, Math.floor(Number(el.pool?.value) || 0))) }; } },
      rejectClose: false,
    } as any) as any;
    if (!choice) return;
    if (!(await actor.useAction("matrix:simple", tx('SR2E.Card.Sheet.aMatrixPerceptionTest')))) return;
    await actor.matrixPerception(choice.kind, choice.target, { poolDice: choice.pool, modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [] });
  }

  /** v0.57.0: a cybercombat maneuver: position, parry or evade. */
  static async #onMatrixManeuver(this: SR2CharacterSheet) {
    const actor: any = this.document;
    if (!actor.isJackedIn()) return ui.notifications.warn(tx('SR2E.Notify.Sheet.isNotJackedIn', { actorName: escHtml(actor.name) }));
    const targets = matrixTargets(actor, actor.system.matrix.hostUuid);
    if (!targets.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereIsNobodyToManeuverAgainst', { actorName: escHtml(actor.name) }));
    const left = RULES.MATRIX_V57.maneuvers.pool ? actor.system.derived.hackingPoolLeft as number : 0;
    const held: any = actor.blackIcHold?.();
    const targeted: any = game.user.targets?.first?.()?.actor ?? null;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.cybercombatManeuver', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.maneuver')}</label><select name="kind"><option value="position">${tx('SR2E.Dialog.Sheet.positionTnOnYourNextAttack')}</option><option value="parry">${tx('SR2E.Dialog.Sheet.parryTnOnTheirAttacksOn')}</option><option value="evade" ${held ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.evadeBreakContact', { part: held ? tx('SR2E.Dialog.Sheet.freesYouFrom', { heldName: escHtml(held.name) }) : "" })}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.opponent')}</label><select name="target">${targets.map((t: any) => `<option value="${escHtml(t.uuid)}" ${(t.uuid === targeted?.uuid || t.uuid === held?.uuid) ? "selected" : ""}>${escHtml(t.name)}${t.type === "ic" ? tx('SR2E.Dialog.Sheet.rating3', { rating: escHtml(t.system.rating) }) : tx('SR2E.Dialog.Sheet.persona')}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        ${left > 0 ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.hackingPoolDiceLeft', { left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>` : ""}
        <p class="hint">${tx('SR2E.Dialog.Sheet.opposedYourEvasionCloakLowersThe', { maneuversMaxTn: RULES.MATRIX_V57.maneuvers.maxTn })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.roll'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { kind: String(el.kind.value), target: String(el.target.value), mod: Number(el.mod.value) || 0, pool: Math.max(0, Math.min(left, Math.floor(Number(el.pool?.value) || 0))) }; } },
      rejectClose: false,
    } as any) as any;
    if (!choice) return;
    if (!(await actor.useAction("matrix:complex", tx('SR2E.Card.Sheet.aCybercombatManeuver')))) return;
    await actor.matrixManeuver(choice.kind, choice.target, { poolDice: choice.pool, modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [] });
  }

  /** v0.57.0: run a Slow (on an IC) or Restore (on your persona) utility. */
  static async #onUseUtility(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const p = actor.items.get(target.dataset["itemId"]);
    if (!p) return;
    const left = actor.system.derived.hackingPoolLeft as number;
    const slow = p.system.kind === "slow";
    const ics = slow ? matrixTargets(actor, actor.system.matrix?.hostUuid ?? "").filter((t: any) => t.type === "ic" && t.system.kind === "ic") : [];
    if (slow && !ics.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereIsNoIcToSlow', { actorName: escHtml(actor.name) }));
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: `${p.name}: ${actor.name}` },
      content: `${slow ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.ic')}</label><select name="target">${ics.map((t: any) => `<option value="${escHtml(t.uuid)}">${tx('SR2E.Dialog.Sheet.rating4', { name: escHtml(t.name), rating: escHtml(t.system.rating) })}</option>`).join("")}</select></div>` : ""}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.hackingPoolDiceLeft', { left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>
        <p class="hint">${slow ? tx('SR2E.Dialog.Sheet.vsTheIcSRatingEach', { matrixSkill: RULES.MATRIX.skill, slowInitiativePerNet: RULES.MATRIX_V57.utilities.slow.initiativePerNet }) : tx('SR2E.Dialog.Sheet.restoreRatingVsEachSuccessRestores', { restoreTn: RULES.MATRIX_V57.utilities.restore.tn, part: RULES.MATRIX_V57.utilities.restore.deckDamage ? tx('SR2E.Dialog.Sheet.thenDeckDamage') : "" })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.run'), callback: (_e: Event, b: any) => ({ target: b.form.elements.target?.value ?? null, pool: Math.max(0, Math.min(left, Math.floor(Number(b.form.elements.pool?.value) || 0))) }) },
      rejectClose: false,
    } as any) as any;
    if (!choice) return;
    if (!(await actor.useAction("matrix:complex", tx('SR2E.Card.Sheet.running', { name: p.name })))) return;
    await actor.useUtility(p.id, { targetUuid: choice.target, poolDice: choice.pool });
  }

  /** v0.57.0: plug into (or out of) a decker's hitcher jack. */
  static async #onHitchRide(this: SR2CharacterSheet) {
    const actor: any = this.document;
    if (actor.system.matrix?.ridingWith) return void (await actor.rideWith(null));
    const deckers = allActors().filter((a: any) => a !== actor && (a.activeDeck?.()?.system?.hitchers ?? 0) > 0);
    if (!deckers.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.nobodyHasADeckWithHitcher'));
    const uuid = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.rideAHitcherJack', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.decker')}</label><select name="d">${deckers.map((a: any) => `<option value="${escHtml(a.uuid)}">${tx('SR2E.Dialog.Sheet.jack', { name: escHtml(a.name), name2: escHtml(a.activeDeck().name), hitchers: tCount(Number(a.activeDeck().system.hitchers), 'SR2E.Count.jack') })}</option>`).join("")}</select></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.youSeeTheRunWithThem', { part: RULES.MATRIX_V57.hitchers.blackIc ? tx('SR2E.Dialog.Sheet.blackIcThatHitThemHit') : "", part2: RULES.MATRIX_V57.hitchers.dumpShock ? tx('SR2E.Dialog.Sheet.andYouShareTheirDumpShock') : "" })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.plugIn'), callback: (_e: Event, b: any) => String(b.form.elements.d.value) },
      rejectClose: false,
    });
    if (uuid) await actor.rideWith(uuid);
  }

  /** v0.57.0: play a BTL or simsense chip. */
  static async #onPlayChip(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).playChip(target.dataset["itemId"]);
  }

  static async #onSetMatrixMonitor(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const value = Number(target.dataset["value"]);
    if (!Number.isFinite(value)) return;
    const actor: any = this.document;
    const current = actor.system.matrix?.monitor ?? 0;
    await actor.update({ "system.matrix.monitor": current === value ? value - 1 : value });
  }

  static async #onSystemTest(this: SR2CharacterSheet, _event?: Event, button?: HTMLElement) {
    const actor: any = this.document;
    const frameUuid = button?.dataset?.["frameUuid"] || null;
    const frame: any = frameUuid ? fromUuidSync(frameUuid) : null;
    const agent = frame?.system?.kind === "agent";
    if (!agent && !actor.isJackedIn()) return ui.notifications.warn(tx('SR2E.Notify.Sheet.mustBeJackedIn', { actorName: escHtml(actor.name) }));
    const hostUuid = frame ? frame.system.hostUuid : actor.system.matrix?.hostUuid;
    const host: any = hostUuid ? fromUuidSync(hostUuid) : null;
    // On the grid with no host: only logging on is possible.
    // v0.73.0 (O24): only the hosts the character knows (codes once analyzed); dialling a number still reaches others.
    const nodes = hostChoices(allActors().filter((a: any) => a.type === "host" && a.uuid !== hostUuid).map(hostNode), knowledgeCtx(actor));
    const nodeOptions = nodes.length ? `<optgroup label="${tx('SR2E.App.Sheets.hostsAndGridsLogOn')}">${nodes.map((c: any) => `<option value="node:${escHtml(c.host.uuid)}">${escHtml(c.label)}</option>`).join("")}</optgroup>` : "";
    // A frame or agent uses the utilities it carries (v0.40.0), else its owner's.
    const loadedUtils = (a: any) => (a?.programs?.() ?? []).filter((p: any) => p.system.loaded && !p.system.erased && p.system.kind !== "attack");
    const carried = frame ? loadedUtils(frame) : [];
    const utilities = carried.length || (frame && !RULES.MATRIX.carry.ownerUtilities) ? carried : loadedUtils(actor);
    const left = frame ? 0 : actor.system.derived.hackingPoolLeft as number;
    const cls: any = SR2Actor;
    const files: any[] = host ? cls.foundFiles(host, actor.uuid) : [];
    const ics: any[] = host ? cls.hostIc(host).filter((i: any) => !i.system.derived?.crashed && i.uuid !== frameUuid) : [];
    const devices: any[] = host ? cls.slaveDevices(host) : [];
    const ops = host ? RULES.MATRIX.operations : RULES.MATRIX.operations.filter((o) => o.effect === "logon");
    const subRating = (k: string) => host?.system?.subsystems?.[k] ?? "?";
    const deckFiles = frame ? [] : actor.items.filter((i: any) => i.type === "cyberdeck").flatMap((d: any) => (d.system.files ?? []).map((f: any, index: number) => ({ deck: d, f, index })));
    const known: string[] = actor.system.matrix?.numbers ?? [];
    const targetOptions = [
      deckFiles.length && host ? `<optgroup label="${tx('SR2E.App.Sheets.yourDecksFilesUpload')}">${deckFiles.map((x: any) => `<option value="up:${escHtml(x.deck.id)}|${escHtml(x.index)}">${tx('SR2E.Dialog.Sheet.mp', { name: escHtml(x.f.name), size: escHtml(x.f.size), deckName: escHtml(x.deck.name) })}</option>`).join("")}</optgroup>` : "",
      files.length ? `<optgroup label="${tx('SR2E.App.Sheets.filesYouHaveLocated')}">${files.map((f: any) => `<option value="file:${escHtml(f.id)}">${tx('SR2E.Dialog.Sheet.mp2', { name: escHtml(f.name), size: escHtml(f.size), part: f.scramble ? tx('SR2E.Dialog.Sheet.scramble', { scramble: escHtml(f.scramble) }) : f.encrypted ? tx('SR2E.Dialog.Sheet.encrypted', { encrypted: escHtml(f.encrypted) }) : "" })}</option>`).join("")}</optgroup>` : "",
      ics.length ? `<optgroup label="${tx('SR2E.App.Sheets.icInThisHost')}">${ics.map((i: any) => `<option value="ic:${escHtml(i.uuid)}" ${[...(game.user.targets ?? [])].some((t: any) => t.actor?.uuid === i.uuid || (t.actor?.id === i.id && !t.actor?.isToken)) ? "selected" : ""}>${escHtml(i.name)}${i.system.guards ? tx('SR2E.Dialog.Sheet.guards', { guards: escHtml(cap(i.system.guards)) }) : ""}</option>`).join("")}</optgroup>` : "",
      devices.length ? `<optgroup label="${tx('SR2E.App.Sheets.slavedDevices')}">${devices.map((x: any) => `<option value="dev:${escHtml(x.site.uuid)}|${escHtml(x.device.id)}">${escHtml(x.device.name)} (${escHtml(x.site.name)})</option>`).join("")}</optgroup>` : "",
      // v0.57.0: subsystem bombs you know of (Defuse), comcalls on an LTG (Tap, Reroute), valid passcodes (Invalidate).
      host ? (() => { const bs = (host.system.bombs ?? []).filter((b: any) => b.rating > 0 && (b.foundBy ?? []).includes(actor.uuid)); return bs.length ? `<optgroup label="${tx('SR2E.App.Sheets.dataBombsYouKnowOf')}">${bs.map((b: any) => `<option value="bomb:${escHtml(b.subsystem)}">${tx('SR2E.Dialog.Sheet.bomb', { subsystem: escHtml(cap(b.subsystem)), rating: escHtml(b.rating) })}</option>`).join("")}</optgroup>` : ""; })() : "",
      host && (host.system.calls ?? []).length ? `<optgroup label="${tx('SR2E.App.Sheets.comcalls')}">${host.system.calls.map((c: any) => `<option value="call:${escHtml(c.id)}">${escHtml(c.from)} → ${escHtml(c.rerouted || c.to)}</option>`).join("")}</optgroup>` : "",
      host && (host.system.validated ?? []).length ? `<optgroup label="${tx('SR2E.App.Sheets.validPasscodes')}">${host.system.validated.map((u: string) => `<option value="pc:${escHtml(u)}">${escHtml(fromUuidSync(u)?.name ?? "?")}</option>`).join("")}</optgroup>` : "",
      nodeOptions,
    ].join("");
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.systemOperation', { part: frame ? `${frame.name}: ` : "", part2: host ? `: ${host.name}` : "" }) },
      position: { width: 460 },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.operation')}</label><select name="opId" autofocus>
          ${ops.map((o) => `<option value="${escHtml(o.id)}">${escHtml(o.label)} (${escHtml(cap(o.subsystem))} ${escHtml(subRating(o.subsystem))}${o.utility ? `, ${escHtml(o.utility)}` : ""}, ${o.action})</option>`).join("")}
          <option value="">${tx('SR2E.Dialog.Sheet.otherNameItAndPickThe')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.target')}</label><select name="target"><option value="">${tx('SR2E.Dialog.Sheet.none')}</option>${targetOptions}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.numberLogOnMakeOrReroute')}</label><input name="number" type="text" list="sr2e-numbers" placeholder="${tx('SR2E.Dialog.Sheet.logOnInsteadOfATarget')}"><datalist id="sr2e-numbers">${known.map((n) => `<option value="${escHtml(n)}">`).join("")}</datalist></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.editFileHow')}</label><select name="editMode"><option value="alter">${tx('SR2E.Dialog.Sheet.alterIt')}</option><option value="erase">${tx('SR2E.Dialog.Sheet.eraseIt')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.editFileWhatChanges')}</label><input name="editNote" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGAddsAPassFor')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherName')}</label><input name="op" type="text" placeholder="${tx('SR2E.Dialog.Sheet.onlyForOther')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherSubsystem')}</label><select name="sub">${RULES.MATRIX.subsystems.map((k) => `<option value="${k}">${escHtml(cap(k))} ${escHtml(subRating(k))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.utility')}</label><select name="prog"><option value="auto">${tx('SR2E.Dialog.Sheet.theBestLoadedOneForThe')}</option><option value="">${tx('SR2E.Dialog.Sheet.none')}</option>
          ${utilities.map((p: any) => `<option value="${escHtml(p.id)}">${escHtml(p.name)} (${escHtml(p.system.kind)} ${escHtml(p.system.rating)})</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        ${frame ? "" : `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.hackingPoolDiceLeft', { left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>`}
        <div class="sr2e-preview" aria-live="polite"></div>
        ${game.user?.isGM ? `<label class="sr2e-check"><input type="checkbox" name="force"> ${tx('SR2E.Dialog.Sheet.gmIgnoreBarrierIcFileProtection')}</label>` : ""}
        <p class="hint">${tx('SR2E.Dialog.Sheet.vsTheSubsystemRatingDecryptingThe', { part: frame ? (carried.length ? tx('SR2E.Dialog.Sheet.rollsItsRatingWithUtilities', { frameName: escHtml(frame.name), frameRating: escHtml(frame.system.rating), part: frame.system.smart ? tx('SR2E.Dialog.Sheet.pool3', { part: agent ? tx('SR2E.Dialog.Sheet.agent') : tx('SR2E.Dialog.Sheet.smartFrame') }) : "" }) : tx('SR2E.Dialog.Sheet.rollsItsRating', { frameName: escHtml(frame.name), frameRating: escHtml(frame.system.rating), part: frame.system.smart ? tx('SR2E.Dialog.Sheet.pool3', { part: agent ? tx('SR2E.Dialog.Sheet.agent') : tx('SR2E.Dialog.Sheet.smartFrame') }) : "" })) : RULES.MATRIX.skill, part2: RULES.MATRIX.utilityLowersTn ? tx('SR2E.Dialog.Sheet.minusTheUtilitySRating') : "", part3: (SR2Actor as any).isSecurityDecker(host, actor) && !frame && RULES.MATRIX.security.noDetection ? tx('SR2E.Dialog.Sheet.youAreASecurityDeckerHere') : tx('SR2E.Dialog.Sheet.theHostFirstRollsItsSecurity', { part: agent && RULES.MATRIX.agents.ownDetection ? tx('SR2E.Dialog.Sheet.sOwn', { frameName: escHtml(frame.name) }) : tx('SR2E.Dialog.Sheet.your'), part2: !agent && actor.system.derived.matrix ? ` ${escHtml(actor.system.derived.matrix.detectionFactor)}` : "" }) })}</p>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.roll'),
        callback: (_e: Event, b: any) => {
          const el = b.form.elements;
          const prog = String(el.prog.value);
          return { opId: String(el.opId.value), target: String(el.target.value ?? ""), sub: String(el.sub.value), op: String(el.op.value ?? "").trim(),
            number: String(el.number?.value ?? "").trim(), editMode: String(el.editMode?.value ?? "alter") as "alter" | "erase", editNote: String(el.editNote?.value ?? "").trim(),
            prog: prog === "auto" ? undefined : prog || null, mod: Number(el.mod.value) || 0, force: Boolean(el.force?.checked),
            pool: Math.max(0, Math.min(left, Math.floor(Number(el.pool?.value) || 0))), exclude: excludedOf(b.form) };
        },
      },
      // v0.50.0: what the operation finds by itself (link, signal, smoke, psyche, the decker's penalties); the utility comes off the TN too.
      render: (_e: Event, dialog: any) => livePreview(dialog, (f, excluded) => {
        const mod = Number((f.elements as any).mod?.value) || 0;
        return tnPreviewHtml({ auto: actor.systemTestPreview?.(host, frame) ?? [], manual: mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [], excluded, note: tx('SR2E.Dialog.Sheet.plusTheSubsystemSRatingLess') });
      }),
      rejectClose: false,
    } as any) as any;
    if (!choice) return;
    const op = choice.opId ? RULES.MATRIX.operations.find((o) => o.id === choice.opId) : null;
    if (!frame && !(await actor.useAction(`matrix:${op?.action ?? "complex"}`, op?.label ?? (choice.op || tx('SR2E.Card.Sheet.aSystemOperation'))))) return;
    const [kind, ref] = [choice.target.split(":")[0], choice.target.slice(choice.target.indexOf(":") + 1)];
    const [siteUuid, deviceId] = kind === "dev" ? ref.split("|") : [null, null];
    const [upDeck, upIndex] = kind === "up" ? ref.split("|") : [null, null];
    await actor.systemTest(choice.sub, {
      programId: choice.prog, poolDice: choice.pool, operation: op ? undefined : choice.op, operationId: op?.id,
      targetUuid: kind === "ic" || kind === "node" || kind === "pc" ? ref : null, fileId: kind === "file" ? ref : null, siteUuid, deviceId, force: choice.force, frameUuid,
      ...(op?.effect === "logon" && choice.number && kind !== "node" ? { number: choice.number } : {}),
      ...(["makeCall", "rerouteCall"].includes(op?.effect ?? "") ? { number: choice.number } : {}),
      ...(kind === "call" ? { callId: ref } : {}),
      ...(kind === "bomb" ? { bombSubsystem: ref } : {}),
      ...(upDeck ? { upload: { deckId: upDeck, index: Number(upIndex) } } : {}),
      ...(op?.effect === "editFile" ? { editMode: choice.editMode, editNote: choice.editNote } : {}),
      modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [],
      ...(choice.exclude?.length ? { exclude: choice.exclude } : {}),
    });
  }

  static async #onMatrixAttack(this: SR2CharacterSheet) {
    const actor: any = this.document;
    if (!actor.isJackedIn()) return ui.notifications.warn(tx('SR2E.Notify.Sheet.isNotJackedIn', { actorName: escHtml(actor.name) }));
    const attacks = actor.programs().filter((p: any) => p.system.loaded && !p.system.erased && p.system.kind === "attack");
    if (!attacks.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.hasNoAttackUtilityLoaded', { actorName: escHtml(actor.name) }));
    const hostUuid = actor.system.matrix.hostUuid;
    const targets = matrixTargets(actor, hostUuid);
    const left = actor.system.derived.hackingPoolLeft as number;
    const targeted: any = game.user.targets?.first?.()?.actor ?? null;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.cybercombat', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.target')}</label><select name="target"><option value="">${tx('SR2E.Dialog.Sheet.noTarget')}</option>
          ${targets.map((t: any) => `<option value="${escHtml(t.uuid)}" ${t.uuid === targeted?.uuid ? "selected" : ""}>${escHtml(t.name)}${t.type === "ic" ? tx('SR2E.Dialog.Sheet.ic2', { rating: escHtml(t.system.rating) }) : tx('SR2E.Dialog.Sheet.persona')}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.attackUtility')}</label><select name="prog">${attacks.map((p: any) => `<option value="${escHtml(p.id)}">${escHtml(p.name)} (${escHtml(p.system.rating)}${escHtml(p.system.damageLevel)})</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.hackingPoolDiceLeft', { left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>
        ${rememberMarker(`cyber|${actor.uuid}`, ["prog", "pool"])}
        ${targeted && !targets.some((t: any) => t.uuid === targeted.uuid) ? `<p class="sr2e-warn">${tx('SR2E.Dialog.Sheet.targetedIsNotInSHost', { targetedName: escHtml(targeted.name), actorName: escHtml(actor.name) })}</p>` : ""}
        <div class="sr2e-preview" aria-live="polite"></div>
        <p class="hint">${RULES.MATRIX.defense.ic === "rating" ? tx('SR2E.Dialog.Sheet.vsTheIcSRatingIcDefend', { matrixSkill: RULES.MATRIX.skill, part: RULES.MATRIX.defense.persona === "pool" ? tx('SR2E.Dialog.Sheet.personasDefendWithHackingPoolDice') : tx('SR2E.Dialog.Sheet.personasDoNotDefend') }) : tx('SR2E.Dialog.Sheet.vsTheIcSRatingIcNoDefend', { matrixSkill: RULES.MATRIX.skill, part: RULES.MATRIX.defense.persona === "pool" ? tx('SR2E.Dialog.Sheet.personasDefendWithHackingPoolDice') : tx('SR2E.Dialog.Sheet.personasDoNotDefend') })}</p>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.attack'),
        callback: (_e: Event, b: any) => {
          const el = b.form.elements;
          return { target: (el.target.value as string) || null, prog: String(el.prog.value), mod: Number(el.mod.value) || 0,
            pool: Math.max(0, Math.min(left, Math.floor(Number(el.pool.value) || 0))), exclude: excludedOf(b.form) };
        },
      },
      render: (_e: Event, dialog: any) => livePreview(dialog, (f, excluded) => {
        const el: any = f.elements;
        const pv = actor.matrixAttackPreview(el.target?.value || null);
        if (!pv) return "";
        const mod = Number(el.mod?.value) || 0;
        return tnPreviewHtml({ base: pv.base, baseLabel: pv.label, auto: pv.modifiers, manual: mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [], excluded });
      }),
      rejectClose: false,
    } as any) as { target: string | null; prog: string; mod: number; pool: number; exclude: string[] } | null;
    if (!choice) return;
    if (!(await actor.useAction("matrixAttack", tx('SR2E.Card.Sheet.aCybercombatAttack')))) return;
    await actor.matrixAttack({ targetUuid: choice.target, programId: choice.prog, poolDice: choice.pool, exclude: choice.exclude,
      modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [] });
  }

  static async #onRunMedic(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const medics = actor.programs().filter((p: any) => p.system.kind === "medic" && p.system.loaded && !p.system.erased && p.system.rating > 0);
    if (!medics.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.hasNoMedicUtilityLoaded', { actorName: escHtml(actor.name) }));
    const monitor = actor.system.matrix?.monitor ?? 0;
    if (monitor <= 0) return ui.notifications.warn(tx('SR2E.Notify.Sheet.sPersonaIsNotDamaged', { actorName: escHtml(actor.name) }));
    const left = RULES.MATRIX.medic.pool ? actor.system.derived.hackingPoolLeft as number : 0;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.medic', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.medicUtility')}</label><select name="prog">${medics.map((p: any) => `<option value="${escHtml(p.id)}">${tx('SR2E.Dialog.Sheet.rating4', { name: escHtml(p.name), rating: escHtml(p.system.rating) })}</option>`).join("")}</select></div>
        ${left > 0 ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.hackingPoolDiceLeft', { left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>` : ""}
        <p class="hint">${tx('SR2E.Dialog.Sheet.medicRatingVsATnBy', { medicBoxesPerSuccess: RULES.MATRIX.medic.boxesPerSuccess, part: RULES.MATRIX.medic.degrades ? tx('SR2E.Dialog.Sheet.theUtilityLoses1RatingEach') : "" })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.roll'), callback: (_e: Event, b: any) => ({ prog: String(b.form.elements.prog.value), pool: Math.max(0, Math.min(left, Math.floor(Number(b.form.elements.pool?.value) || 0))) }) },
      rejectClose: false,
    });
    if (!choice) return;
    if (!(await actor.useAction("medic", tx('SR2E.Card.Sheet.aMedicTest')))) return;
    await actor.runMedic(choice.prog, { poolDice: choice.pool });
  }

  /** v0.46.0: write a program (Computer, Programming concentration). */
  static async #onWriteProgram(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const p = RULES.MATRIX.programming;
    // v0.49.0: a programming suite on the sheet helps.
    const suite = suiteBonus(actor.programmingSuite?.() ?? 0, Number(actor.findSkill?.(p.skill)?.system?.rating ?? 0));
    const suiteNote = suite.note ? `<p class="hint">${tx('SR2E.Dialog.Sheet.programmingSuite', { part: p.suites.mode === "tn" ? tx('SR2E.Dialog.Sheet.tn7', { value: -suite.modifiers[0]!.value }) : tx('SR2E.Dialog.Sheet.dice2', { suiteDice: suite.dice }), part2: p.suites.capAtSkill ? tx('SR2E.Dialog.Sheet.cappedAtComputer') : "" })}</p>` : "";
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.writeAProgram', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.kind')}</label><select name="kind" autofocus>${UTILITY_KINDS.filter((k) => k !== "other").map((k) => `<option value="${k}">${escHtml(cap(k))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.rating2')}</label><input name="rating" type="number" value="4" min="1"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.attackDamageLevel')}</label><select name="level">${["L", "M", "S", "D"].map((k) => `<option value="${escHtml(k)}" ${k === "M" ? "selected" : ""}>${escHtml(k)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.name')}</label><input name="name" type="text" placeholder="${tx('SR2E.Dialog.Sheet.kindAndRating')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Sheet.programOptions')}</legend>${p.options.map((o) => `<label class="sr2e-check"><input type="checkbox" name="opt-${escHtml(o.id)}"> ${tx('SR2E.Dialog.Sheet.sizeTnTime', { label: escHtml(o.label), size: o.size, sign: o.tn >= 0 ? "+" : "", tn: o.tn, days: o.days })}</label>`).join("")}</fieldset>
        ${suiteNote}
        <p class="hint sr2e-plan"></p>
        <p class="hint">${tx('SR2E.Dialog.Sheet.vsTheRatingTimeSizeDay', { skill: p.skill, part: p.concentration ? tx('SR2E.Dialog.Sheet.counts', { concentration: escHtml(p.concentration) }) : "", part2: p.tnMod ? ` + ${escHtml(p.tnMod)}` : "", daysPerMp: p.daysPerMp })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.write'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { kind: String(el.kind.value), rating: Math.max(1, Math.floor(Number(el.rating.value) || 1)), damageLevel: String(el.level.value), name: String(el.name.value ?? "").trim(), mod: Number(el.mod.value) || 0, options: p.options.filter((o) => el[`opt-${o.id}`]?.checked).map((o) => o.id) }; } },
      render: (_e: Event, dialog: any) => {
        const form = dialog?.element?.querySelector("form");
        const show = () => { const el = form?.elements; if (!el) return; const plan = programPlan({ kind: String(el.kind.value), rating: Number(el.rating.value) || 1, damageLevel: String(el.level.value), options: p.options.filter((o) => el[`opt-${o.id}`]?.checked).map((o) => o.id) }); const t = form.querySelector(".sr2e-plan"); if (t) t.textContent = tx('SR2E.Dialog.Sheet.mpTnDaySAt1', { planSize: plan.size, planTn: plan.tn, planBaseDays: plan.baseDays }); };
        form?.addEventListener("change", show); form?.addEventListener("input", show); show();
      },
      rejectClose: false,
    });
    if (!choice) return;
    await actor.writeProgram({ ...choice, ...(choice.name ? {} : { name: undefined }), modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [] });
  }

  /** v0.46.0: build a new deck, or upgrade a part of one (B/R skill). */
  static async #onBuildDeck(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const decks = actor.items.filter((i: any) => i.type === "cyberdeck");
    const parts = RULES.MATRIX.deckBuilding.parts;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.buildOrUpgradeADeck', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.deck')}</label><select name="deck" autofocus><option value="">${tx('SR2E.Dialog.Sheet.aNewDeckItsMpcp')}</option>${decks.map((d: any) => `<option value="${escHtml(d.id)}">${tx('SR2E.Dialog.Sheet.mpcp', { name: escHtml(d.name), mpcp: escHtml(d.system.mpcp) })}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.newDeckName')}</label><input name="name" type="text" placeholder="${tx('SR2E.Dialog.Sheet.homeBuiltDeck')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.part')}</label><select name="part">${DECK_PARTS.map((k) => `<option value="${k}">${escHtml(parts[k]?.label ?? k)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.newRatingMemoryPartsTheMp')}</label><input name="rating" type="number" value="4" min="1"></div>
        <label class="sr2e-check"><input type="checkbox" name="pay" checked> ${tx('SR2E.Dialog.Sheet.payForTheMaterialsOnHand', { actorNuyen: Number(actor.system.nuyen ?? 0).toLocaleString() })}</label>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <p class="hint sr2e-plan"></p>
        <p class="hint">${tx('SR2E.Dialog.Sheet.theFirstYouHaveElseIntelligence', { deckBuildingSkills: escHtml(RULES.MATRIX.deckBuilding.skills.join(", ")), attributeDefaultTnMod: RULES.ATTRIBUTE_DEFAULT_TN_MOD, deckBuildingDaysPerMp: RULES.MATRIX.deckBuilding.daysPerMp, part: RULES.MATRIX.programming.suites.deckBuilding && (actor.programmingSuite?.() ?? 0) > 0 ? tx('SR2E.Dialog.Sheet.aProgrammingSuiteHelps') : "" })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.build2'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { deck: String(el.deck.value || ""), name: String(el.name.value ?? "").trim(), part: String(el.part.value), rating: Math.max(1, Math.floor(Number(el.rating.value) || 1)), pay: Boolean(el.pay.checked), mod: Number(el.mod.value) || 0 }; } },
      render: (_e: Event, dialog: any) => {
        const form = dialog?.element?.querySelector("form");
        const show = () => {
          const el = form?.elements; if (!el) return;
          const d = actor.items.get(String(el.deck.value || ""));
          const plan = deckPartPlan(String(el.part.value), Number(el.rating.value) || 1, d ? Number(d.system.mpcp ?? 0) : Number(el.rating.value) || 1);
          const t = form.querySelector(".sr2e-plan");
          if (t && plan) t.textContent = tx('SR2E.Dialog.Sheet.tnDesignMpDaySAt', { planTn: plan.tn, planSize: plan.size, planBaseDays: plan.baseDays, planCost: plan.cost.toLocaleString(), part: plan.memory ? tx('SR2E.Dialog.Sheet.theRatingIsTheMpAdded') : "", part2: plan.warnings.length ? ` · ${plan.warnings.join("; ")}` : "" });
        };
        form?.addEventListener("change", show); form?.addEventListener("input", show); show();
      },
      rejectClose: false,
    });
    if (!choice) return;
    await actor.buildDeckPart({ deckId: choice.deck || null, part: choice.part, rating: choice.rating, name: choice.name || undefined, pay: choice.pay, modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [] });
  }

  /** v0.46.0: send an agent to search several hosts by itself. */
  static async #onAgentSearch(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const agentUuid = target.dataset["frameUuid"] ?? "";
    const agent: any = fromUuidSync(agentUuid);
    if (!agent) return;
    // v0.73.0 (O24): only hosts the decker knows.
    const hosts = hostChoices(allActors().filter((a: any) => a.type === "host" && (a.system.gridKind ?? "host") === "host").map(hostNode), knowledgeCtx(actor));
    if (!hosts.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereAreNoHostsToSearch'));
    const as = RULES.MATRIX.agentSearch;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.searchHosts', { agentName: agent.name }) },
      position: { width: 440 },
      content: `<p>${tx('SR2E.Dialog.Sheet.hostsToSearchInOrderAt', { asMaxHosts: as.maxHosts })}</p>${hosts.map((c: any) => `<label class="sr2e-check"><input type="checkbox" name="host" value="${escHtml(c.host.uuid)}" ${c.host.uuid === agent.system.hostUuid ? "checked" : ""}> ${escHtml(c.label)}</label>`).join("")}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.lookFor')}</label><select name="op"><option value="locateFile">${tx('SR2E.Dialog.Sheet.filesLocateFile')}</option><option value="locatePaydata">${tx('SR2E.Dialog.Sheet.paydataLocatePaydata')}</option></select></div>
        <label class="sr2e-check"><input type="checkbox" name="stop" ${as.stopOnFind ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.stopAtTheFirstHostWhere')}</label>
        <p class="hint">${tx('SR2E.Dialog.Sheet.theAgentLogsOnToEach')}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.send'), callback: (_e: Event, b: any) => ({ hosts: [...b.form.querySelectorAll('input[name="host"]:checked')].map((i: any) => String(i.value)), op: String(b.form.elements.op.value), stop: Boolean(b.form.elements.stop.checked) }) },
      rejectClose: false,
    });
    if (!choice) return;
    if (!choice.hosts.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.tickAtLeastOneHost'));
    await actor.agentSearch(agentUuid, { hostUuids: choice.hosts, operationId: choice.op as "locateFile" | "locatePaydata", stopOnFind: choice.stop });
    this.render();
  }

  static async #onJamLink(this: SR2CharacterSheet) {
    await jamDialog(this.document);
  }

  /** v0.73.0 (O28): intercept or spoof a drone's link. */
  static async #onDroneLink(this: SR2CharacterSheet) {
    await droneLinkDialog(this.document);
  }

  static async #onForgetNumber(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const list = [...(actor.system.matrix?.numbers ?? [])];
    if (!spliceRow(list, target)) return;
    await actor.update({ "system.matrix.numbers": list });
  }

  static async #onRepairDeck(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).repairDeckTest({ deckId: target.dataset["itemId"] ?? null });
  }

  static async #onDeleteDeckFile(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const deck: any = actor.items.get(target.dataset["itemId"]);
    if (!deck) return;
    const list = [...(deck.system.files ?? [])];
    if (!spliceRow(list, target)) return;
    await deck.update({ "system.files": list });
  }

  static async #onLaunchFrame(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const prog: any = actor.items.get(target.dataset["itemId"]);
    if (!prog) return;
    const utils = actor.programs().filter((p: any) => p.id !== prog.id && p.system.loaded && !p.system.erased && !["frame", "smart-frame", "agent"].includes(p.system.kind));
    const limit = carryLimit(prog.system.rating);
    let carry: string[] = [];
    if (utils.length && limit > 0) {
      const r = await foundry.applications.api.DialogV2.prompt({
        window: { title: tx('SR2E.Dialog.Sheet.launch2', { progName: prog.name }) },
        content: `<p>${tx('SR2E.Dialog.Sheet.utilitiesItCarriesAtMost', { limit })}</p>${utils.map((p: any) => `<label class="sr2e-check"><input type="checkbox" name="carry" value="${escHtml(p.id)}"> ${escHtml(p.name)} (${escHtml(p.system.kind)} ${escHtml(p.system.rating)})</label>`).join("")}
          <p class="hint">${tx('SR2E.Dialog.Sheet.withoutUtilitiesOfItsOwnIt', { part: prog.system.kind === "agent" ? tx('SR2E.Dialog.Sheet.anAgentActsOnItsOwn') : tx('SR2E.Dialog.Sheet.aFrameActsWhileYouStay'), part2: RULES.MATRIX.carry.ownerUtilities ? tx('SR2E.Dialog.Sheet.usesYours') : tx('SR2E.Dialog.Sheet.hasNone') })}</p>`,
        ok: { label: tx('SR2E.Dialog.Sheet.launch'), callback: (_e: Event, b: any) => [...b.form.querySelectorAll('input[name="carry"]:checked')].map((i: any) => String(i.value)) },
        rejectClose: false,
      });
      if (r === null || r === undefined) return;
      carry = r as string[];
    }
    await actor.launchFrame(prog.id, { carry });
    this.render();
  }

  static async #onRecallFrame(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const frame: any = fromUuidSync(target.dataset["frameUuid"] ?? "");
    if (!frame) return;
    if (!frame.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyTheFrameSOwnerOr'));
    await frame.delete();
    this.render();
  }

  static async #onFrameAttack(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const frame: any = fromUuidSync(target.dataset["frameUuid"] ?? "");
    if (frame) await frameAttackDialog(frame);
  }

  static async #onReleaseSmoke(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    if (!(await actor.useAction("matrix:simple", tx('SR2E.Card.Sheet.releasingSmoke')))) return;
    await actor.releaseSmoke(target.dataset["itemId"]);
    this.render();
  }

  static async #onClearPsyche(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyTheGmCanClearA'));
    const actor: any = this.document;
    const list = [...(actor.system.matrix?.psyche ?? [])].map((e: any) => ({ ...e }));
    if (!spliceRow(list, target)) return;
    await actor.update({ "system.matrix.psyche": list });
  }

  /** A security decker's actions in their own host (v0.40.0). */
  static async #onSecurityAction(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const cls: any = SR2Actor;
    const host: any = actor.currentHost?.();
    if (!host || !cls.isSecurityDecker(host, actor)) return ui.notifications.warn(tx('SR2E.Notify.Sheet.isNotASecurityDeckerOf', { actorName: escHtml(actor.name) }));
    const intruders: any[] = cls.intruders(host);
    const spotted: string[] = host.system.spotted ?? [];
    const devices: any[] = cls.slaveDevices(host).filter((x: any) => x.device.bypassed);
    const left = actor.system.derived.hackingPoolLeft as number;
    const sec = RULES.MATRIX.security;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.security', { hostName: host.name }) },
      position: { width: 460 },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.action')}</label><select name="op" autofocus>
          <option value="spotIntruder">${tx('SR2E.Dialog.Sheet.spotAnIntruderTnTheirDetection')}</option>
          <option value="traceIntruder">${tx('SR2E.Dialog.Sheet.traceAnIntruderTnTheirEvasion', { part: actor.bestUtility("track") ? tx('SR2E.Dialog.Sheet.track', { utilityRating: escHtml(actor.utilityRating?.(actor.bestUtility("track")) ?? actor.bestUtility("track").system.rating) }) : "" })}</option>
          <option value="rearmDevice">${tx('SR2E.Dialog.Sheet.reArmABypassedDeviceTn', { secLegitTn: sec.legitTn })}</option>
          <option value="cancelAlert">${tx('SR2E.Dialog.Sheet.cancelTheAlertNowTn', { hostAlert: escHtml(host.system.alert), secLegitTn: sec.legitTn })}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.intruder')}</label><select name="target"><option value="">${tx('SR2E.Dialog.Sheet.none')}</option>${intruders.map((a: any) => `<option value="${escHtml(a.uuid)}">${escHtml(a.name)}${spotted.includes(a.uuid) ? tx('SR2E.Dialog.Sheet.spotted') : ""}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.device')}</label><select name="device"><option value="">${tx('SR2E.Dialog.Sheet.none')}</option>${devices.map((x: any) => `<option value="${escHtml(x.site.uuid)}|${escHtml(x.device.id)}">${escHtml(x.device.name)} (${escHtml(x.site.name)})</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.hackingPoolDiceLeft', { left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.hackingPoolYouAreALegitimate', { matrixSkill: RULES.MATRIX.skill, secSpotAlert: sec.spotAlert, part: sec.traceMode === "report" ? tx('SR2E.Dialog.Sheet.reportsTheirLocation') : sec.traceMode === "burn" ? tx('SR2E.Dialog.Sheet.dumpsThemAndBurnsTheirDeck') : tx('SR2E.Dialog.Sheet.dumpsThem') })}</p>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.roll'),
        callback: (_e: Event, b: any) => {
          const el = b.form.elements;
          return { op: String(el.op.value), target: String(el.target.value || "") || null, device: String(el.device.value || ""), mod: Number(el.mod.value) || 0,
            pool: Math.max(0, Math.min(left, Math.floor(Number(el.pool.value) || 0))) };
        },
      },
      rejectClose: false,
    });
    if (!choice) return;
    if (!(await actor.useAction("matrix:complex", tx('SR2E.Card.Sheet.aSecurityAction')))) return;
    const [siteUuid, deviceId] = choice.device ? choice.device.split("|") : [null, null];
    await actor.securityAction(choice.op, { targetUuid: choice.target, siteUuid, deviceId, poolDice: choice.pool, modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [] });
  }

  static async #onClearCrippled(this: SR2CharacterSheet) {
    // v0.70.0: the GM's correction only (a crippler lasts until the decker jacks out; Restore repairs it).
    if (!game.user?.isGM) return void ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyTheGmCanClearA2'));
    await (this.document as any).update({ "system.matrix.crippled": { bod: 0, evasion: 0, masking: 0, sensors: 0 } });
  }

  static async #onDropTrace(this: SR2CharacterSheet) {
    // v0.70.0: the GM's correction only (jack out, derez the trace IC or redirect the datatrail instead).
    if (!game.user?.isGM) return void ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyTheGmCanDropA'));
    const actor: any = this.document;
    await actor.update({ "system.matrix.trace": { ...(actor.system.matrix?.trace ?? {}), active: false } });
  }

  static async #onDropSustained(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).dropSustained(Number(target.dataset["index"]));
  }

  static async #onToggleActive(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const item = (this.document as any).items.get(target.dataset["itemId"]);
    if (item) await item.update({ "system.active": !item.system.active });
  }

  /**
   * v0.81.1 round 2 (FIX2-BRIEF, optional cover control): this character's held spell defense covers the actors of the
   * user's targeted tokens (`setSpellDefenseCovers`), so the GM's relay lets their resists use it. No targets: clears it.
   */
  static async #onCoverSpellDefense(this: SR2CharacterSheet) {
    const actor: any = this.document;
    if (typeof actor.setSpellDefenseCovers !== "function") return;
    const targets = [...((game as any).user?.targets ?? [])].map((t: any) => t.actor).filter((a: any) => a && a.uuid !== actor.uuid);
    await actor.setSpellDefenseCovers(targets.map((a: any) => String(a.uuid)));
    ui.notifications?.info?.(targets.length ? tx('SR2E.Notify.Sheet.sSpellDefenseCovers', { actorName: escHtml(actor.name), map: escHtml(targets.map((a: any) => a.name).join(", ")) }) : tx('SR2E.Notify.Sheet.sSpellDefenseCoversOnlyThemself', { actorName: escHtml(actor.name) }));
  }

  static async #onAssense(this: SR2CharacterSheet) {
    const actor: any = this.document;
    // v0.50.0: tokens by their own actor (an unlinked NPC is itself), the targeted one picked.
    const { options } = attackTargetOptions(actor, attackerToken(actor), game.user.targets?.first?.() ?? null, ["character", "npc", "spirit"], tx('SR2E.Dialog.Sheet.aPlaceOrThing'));
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.assense', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.whomOrWhat')}</label><select name="target">${options}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.targetNumber')}</label><input name="tn" type="number" value="${RULES.MAGIC.assensingTn}" min="2"></div>
        <div class="sr2e-preview" aria-live="polite"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.aMaskedInitiateAddsToThe')}</p>`,
      ok: { callback: (_e: Event, b: any) => ({ target: (b.form.elements.target.value as string) || null, tn: Number(b.form.elements.tn.value) || RULES.MAGIC.assensingTn, exclude: excludedOf(b.form) }) },
      render: (_e: Event, dialog: any) => livePreview(dialog, (f, excluded) => tnPreviewHtml({ base: Number((f.elements as any).tn?.value) || RULES.MAGIC.assensingTn, baseLabel: tx('SR2E.Dialog.Sheet.targetNumber'), auto: actor.previewModifiers({ background: true }), excluded })),
      rejectClose: false,
    } as any) as any;
    if (choice && (await actor.useAction("assense", tx('SR2E.Card.Sheet.assensing')))) await actor.assense({ targetNumber: choice.tn, targetUuid: choice.target, ...(choice.exclude?.length ? { exclude: choice.exclude } : {}) });
  }

  static async #onUsePower(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const power = actor.items.get(target.dataset["itemId"]);
    if (!power) return;
    const p = power.system;
    // v0.50.0: tokens on the scene by their own actor (unlinked NPCs are themselves).
    const others = scenePeople(actor, ["character", "npc", "spirit"]);
    const usePool = RULES.POWERS.usePool;
    const left = usePool === "none" ? 0 : (actor.system.derived[`${usePool}PoolLeft`] as number);
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.use2', { powerName: power.name }) },
      content: `${p.area ? areaTargetRows(others, game.user.targets) : `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.target')}</label><select name="target">${attackTargetOptions(actor, attackerToken(actor), game.user.targets?.first?.() ?? null, ["character", "npc", "spirit"]).options}</select></div>`}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        ${usePool === "none" ? "" : `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.poolDiceLeft', { left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>`}
        <div class="sr2e-preview" aria-live="polite"></div>
        <p class="hint">${escHtml(powerSummary(p))}${p.notes ? ` · ${escHtml(p.notes)}` : ""}</p>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.use'),
        callback: (_e: Event, button: any) => {
          const el = button.form.elements;
          return { targetUuid: (el.target?.value as string) || null, targetUuids: checkedTargets(button.form), mod: Number(el.mod.value) || 0, pool: Math.max(0, Math.floor(Number(el.pool?.value) || 0)), exclude: excludedOf(button.form) };
        },
      },
      // v0.50.0: the user's own penalties and the background count, found by themselves.
      render: (_e: Event, dialog: any) => livePreview(dialog, (f, excluded) => {
        const mod = Number((f.elements as any).mod?.value) || 0;
        return tnPreviewHtml({ auto: actor.previewModifiers(RULES.TN_AUTO.magic.powersBackground ? { background: true } : {}), manual: mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [], excluded, note: tx('SR2E.Dialog.Sheet.plusThePowerSTnOr') });
      }),
      rejectClose: false,
    } as any) as any;
    if (!choice) return;
    if (!(await actor.useAction("power", power.name))) return;
    await actor.usePower(power, {
      targetUuid: choice.targetUuid, targetUuids: choice.targetUuids, poolDice: choice.pool, ...(choice.exclude?.length ? { exclude: choice.exclude } : {}),
      modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [],
    });
  }

  static async #onShowSignatures(this: SR2CharacterSheet) {
    const sceneId = SR2Actor.currentSceneId();
    if (!sceneId) return ui.notifications.warn(tx('SR2E.Notify.Sheet.openASceneFirstSignaturesAre'));
    const sigs = SR2Actor.signaturesAt(sceneId);
    const gm = Boolean(game.user?.isGM);
    const rows = sigs.map((s) => `<tr><td>${escHtml(s.label)}</td><td>${escHtml(s.kind)}</td><td>${s.force}</td><td>${Math.round(s.ageHours * 10) / 10} h</td><td>${Math.round(s.hoursLeft * 10) / 10} h</td>${gm ? `<td>${escHtml(s.actorName)}</td>` : ""}</tr>`).join("");
    const content = sigs.length
      ? `<table class="sr2e-signatures"><thead><tr><th>${tx('SR2E.Dialog.Sheet.what')}</th><th>${tx('SR2E.Dialog.Sheet.kind')}</th><th>${tx('SR2E.Dialog.Sheet.force')}</th><th>${tx('SR2E.Dialog.Sheet.age')}</th><th>${tx('SR2E.Dialog.Sheet.fadesIn')}</th>${gm ? `<th>${tx('SR2E.Dialog.Sheet.byGm')}</th>` : ""}</tr></thead><tbody>${rows}</tbody></table>
         <p class="hint">${tx('SR2E.Dialog.Sheet.agesUseTheWorldClock', { part: gm ? tx('SR2E.Dialog.Sheet.onlyYouSeeWhoLeftEach') : "" })}</p>`
      : `<p>${tx('SR2E.Dialog.Sheet.noAstralSignaturesLingerHere')}</p>`;
    const clear = await foundry.applications.api.DialogV2.wait({
      window: { title: tx('SR2E.Dialog.Sheet.astralSignaturesHere') },
      position: { width: 560 },
      content,
      buttons: [
        { action: "close", label: tx('SR2E.Dialog.Sheet.close'), default: true },
        ...(sigs.length ? [{ action: "clean", label: tx('SR2E.Dialog.Sheet.cleanOne') }] : []),
        ...(gm && sigs.length ? [{ action: "clear", label: tx('SR2E.Dialog.Sheet.clearAllHere') }] : []),
      ],
      rejectClose: false,
    });
    // v0.81.0 (S-3): every actor signaturesAt reads (unlinked token actors too), and only those with a signature here.
    if (clear === "clear") for (const a of allActors()) if (((a.getFlag?.(SYSTEM.id, "signatures") as any[] | undefined) ?? []).some((s: any) => s?.sceneId === sceneId)) await a.clearSignatures?.(sceneId);
    if (clear === "clean") {
      // Cleaning a signature (v0.39.0): the sheet's actor rolls to erase it.
      const actor: any = this.document;
      const pick = await foundry.applications.api.DialogV2.prompt({
        window: { title: tx('SR2E.Dialog.Sheet.cleanASignature', { actorName: actor.name }) },
        content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.signature')}</label><select name="sig">${sigs.map((s, i) => `<option value="${i}">${tx('SR2E.Dialog.Sheet.forceFadesInH', { label: escHtml(s.label), force: s.force, value: Math.round(s.hoursLeft * 10) / 10 })}</option>`).join("")}</select></div>
          <p class="hint">${tx('SR2E.Dialog.Sheet.orMagicVsTheSignatureS', { cleaningSkill: RULES.MAGIC_V39.cleaning.skill, cleaningHoursPerSuccess: RULES.MAGIC_V39.cleaning.hoursPerSuccess, part: RULES.MAGIC_V39.cleaning.needsAstral ? tx('SR2E.Dialog.Sheet.needsAstralPerceptionOrProjection') : "" })}</p>`,
        ok: { label: tx('SR2E.Dialog.Sheet.clean'), callback: (_e: Event, b: any) => Number(b.form.elements.sig.value) },
        rejectClose: false,
      });
      if (typeof pick === "number" && sigs[pick]) await actor.cleanSignature?.(sigs[pick]);
    }
  }

  static async #onTrack(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const sceneId = SR2Actor.currentSceneId();
    const sigs: any[] = sceneId ? SR2Actor.signaturesAt(sceneId) : [];
    // Objects carry their maker's signature (v0.39.0): your own items and the targeted token's.
    const objectHolders = [actor, ...[...(game.user?.targets ?? [])].map((t: any) => t.actor).filter(Boolean)];
    for (const h of objectHolders) {
      for (const it of h.items ?? []) {
        const sg = it.getFlag?.("sr2e", "signature");
        if (sg) sigs.push({ ...sg, label: `${it.name} (${h.name}'s): ${sg.label}`, ageHours: 0, hoursLeft: Infinity });
      }
    }
    // v0.61.0: magical links on the targeted tokens (a sustained spell, a bound spirit, an active focus).
    for (const h of objectHolders.slice(1)) sigs.push(...SR2Actor.magicalLinksOn(h));
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.astralTracking', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.trail')}</label><select name="sig"><option value="">${tx('SR2E.Dialog.Sheet.anotherTrailTheGmDescribes')}</option>
          ${sigs.map((s, i) => `<option value="${i}">${tx('SR2E.Dialog.Sheet.forceHOld', { label: escHtml(s.label), force: escHtml(s.force), value: Math.round(s.ageHours * 10) / 10 })}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.targetNumber2')}</label><input name="tn" type="number" value="${RULES.TRACKING.trackingTn}" min="2"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.hoursAt1Success')}</label><input name="hours" type="number" value="${RULES.TRACKING.baseHours}" min="0" step="0.5"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.vsTheTnPlusAModifier', { trackingTrackingAttribute: escHtml(cap(RULES.TRACKING.trackingAttribute)) })}</p>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.track2'),
        callback: (_e: Event, button: any) => {
          const el = button.form.elements;
          const i = el.sig.value === "" ? null : Number(el.sig.value);
          // v0.61.0: a magical link has its own TN and time (unless the GM typed others).
          const lk = i !== null ? sigs[i]?.link : "";
          const tn = Number(el.tn.value) || RULES.TRACKING.trackingTn;
          const hours = Number(el.hours.value) || RULES.TRACKING.baseHours;
          return { sig: i, tn: lk && tn === RULES.TRACKING.trackingTn ? RULES.MAGIC_V61.links.tn : tn, hours: lk && hours === RULES.TRACKING.baseHours ? RULES.MAGIC_V61.links.baseHours : hours };
        },
      },
      rejectClose: false,
    });
    if (!choice) return;
    await actor.track({ signature: choice.sig === null ? null : sigs[choice.sig], targetNumber: choice.tn, baseHours: choice.hours });
  }

  /** Add or edit a geas in a small dialog. */
  static async #geasDialog(actor: any, index: number | null) {
    const list = actor.geasa();
    const g = index === null ? { text: "", magic: 1, met: true, checkOnCast: true } : list[index];
    if (!g) return;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.geas', { part: index === null ? tx('SR2E.Dialog.Sheet.add') : tx('SR2E.Dialog.Sheet.edit2'), actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.condition')}</label><input name="text" type="text" value="${escHtml(g.text)}" placeholder="${tx('SR2E.Dialog.Sheet.eGMustChantAloud')}" autofocus></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.magicItProtects')}</label><input name="magic" type="number" value="${escHtml(g.magic)}" min="0"></div>
        <label class="sr2e-check"><input type="checkbox" name="met" ${g.met ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.currentlyMet')}</label>
        <label class="sr2e-check"><input type="checkbox" name="check" ${g.checkOnCast ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.warnWhenCastingOrSummoningWhile')}</label>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.save'),
        callback: (_e: Event, button: any) => {
          const el = button.form.elements;
          return { text: String(el.text.value).trim(), magic: Math.max(0, Math.floor(Number(el.magic.value) || 0)), met: Boolean(el.met.checked), checkOnCast: Boolean(el.check.checked) };
        },
      },
      rejectClose: false,
    });
    if (!result) return;
    if (index === null) list.push(result);
    else list[index] = result;
    await actor.setGeasa(list);
  }

  static async #onAddGeas(this: SR2CharacterSheet) {
    await SR2CharacterSheet.#geasDialog(this.document, null);
  }

  static async #onEditGeas(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await SR2CharacterSheet.#geasDialog(this.document, Number(target.dataset["index"]));
  }

  static async #onToggleGeas(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const list = actor.geasa();
    const i = Number(target.dataset["index"]);
    if (!list[i]) return;
    list[i] = { ...list[i], met: !list[i].met };
    await actor.setGeasa(list);
  }

  static async #onDeleteGeas(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const list = actor.geasa();
    if (!spliceRow(list, target)) return;
    await actor.setGeasa(list);
  }

  static async #onQuicken(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).quicken(Number(target.dataset["index"]));
  }

  static async #onDispel(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const options: string[] = [];
    // v0.50.0: unlinked casters on the scene too; the targeted caster's spells first.
    const casters = scenePeople(null, ["character", "npc", "spirit"]).map((p) => p.actor);
    const targetedUuid = game.user.targets?.first?.()?.actor?.uuid ?? "";
    casters.sort((a: any, b: any) => (b.uuid === targetedUuid ? 1 : 0) - (a.uuid === targetedUuid ? 1 : 0));
    for (const a of casters) {
      (a.system?.sustaining ?? []).forEach((e: any, i: number) => {
        options.push(`<option value="${escHtml(a.uuid)}|${i}">${tx('SR2E.Dialog.Sheet.forceSuccess', { name: escHtml(a.name), spellName: escHtml(e.spellName), force: escHtml(e.force), successes: tCount(Number(e.successes ?? 1), 'SR2E.Count.success'), part: e.quickened ? tx('SR2E.Dialog.Sheet.quickened') : "" })}</option>`);
      });
    }
    if (!options.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.nobodyIsSustainingASpell'));
    const spellLeft = Math.max(0, Number(actor.spellPoolFor?.(actor.sorceryUseFor?.("dispel")) ?? actor.system.derived?.spellPoolLeft ?? 0));
    const choice: any = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.dispel2', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spell')}</label><select name="spell">${options.join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spellPoolDiceLeft', { spellLeft })}</label><input name="pool" type="number" value="0" min="0" max="${spellLeft}"></div>
        ${RULES.MAGIC_V72.dispelDrainPool ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spellPoolDiceForDrain')}</label><input name="drainPool" type="number" value="0" min="0" max="${spellLeft}"></div>` : ""}
        <p class="hint">${RULES.SPIRITS_V923.dispelling === "book" ? tx('SR2E.Dialog.Sheet.dispelBookHint') : tx('SR2E.Dialog.Sheet.sorceryVsTnTheSpellS', { magicDispelDrainLevel: RULES.MAGIC.dispelDrainLevel })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.dispel'), callback: (_e: Event, button: any) => ({ spell: String(button.form.elements.spell.value), pool: Number(button.form.elements.pool?.value) || 0, drainPool: Number(button.form.elements.drainPool?.value) || 0 }) },
      rejectClose: false,
    });
    if (!choice) return;
    const [uuid, index] = choice.spell.split("|");
    const target = await fromUuid(uuid as string);
    // v0.72.0 (O16): Spell Pool dice for the test and for the drain.
    const pool = Math.max(0, Math.min(spellLeft, Math.floor(choice.pool)));
    const drainPool = Math.max(0, Math.min(spellLeft - pool, Math.floor(choice.drainPool)));
    if (target && (await actor.useAction("dispel", tx('SR2E.Card.Sheet.dispelling')))) await actor.dispel(target, Number(index), { poolDice: pool, drainPoolDice: drainPool });
  }

  static async #onBreachBarrier(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const barriers = allActors().filter((a: any) => a.type === "barrier" && a.system.rating > 0);
    if (!barriers.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereAreNoStandingBarriersCreate'));
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.forceThroughABarrier', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.barrier')}</label><select name="barrier">
          ${barriers.map((b: any) => `<option value="${escHtml(b.uuid)}">${tx('SR2E.Dialog.Sheet.rating5', { name: escHtml(b.name), barrierKind: escHtml(b.system.barrierKind), rating: escHtml(b.system.rating) })}</option>`).join("")}</select></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.astralAttackDiceVsTnThe', { part: actor.type === "spirit" ? tx('SR2E.Dialog.Sheet.force') : tx('SR2E.Dialog.Sheet.magic') })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.forceThrough'), callback: (_e: Event, button: any) => String(button.form.elements.barrier.value) },
      rejectClose: false,
    });
    if (!choice) return;
    const barrier = await fromUuid(choice);
    if (barrier) await actor.breachBarrier(barrier);
  }

  static async #onAstralAttack(this: SR2CharacterSheet) {
    const actor: any = this.document;
    if (!actor.isAstral()) return ui.notifications.warn(tx('SR2E.Notify.Sheet.isNotOnTheAstralPlane', { actorName: escHtml(actor.name) }));
    const poolType = actor.poolFor({ astral: true }) as "combat" | "spell";
    const left = actor.system.derived[`${poolType}PoolLeft`] as number;
    const targeted: any = game.user.targets?.first?.()?.actor ?? null;
    // v0.50.0: astral beings on the scene by their own actor (unlinked spirits too), then the world's.
    const others = scenePeople(actor, ["character", "npc", "spirit"]).map((p) => p.actor).filter((a: any) => a.isAstral?.());
    if (targeted && targeted.uuid !== actor.uuid && !others.some((o: any) => o.uuid === targeted.uuid)) others.unshift(targeted);
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.astralAttack', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.target')}</label><select name="target"><option value="">${tx('SR2E.Dialog.Sheet.noTarget')}</option>
          ${others.map((o: any) => `<option value="${escHtml(o.uuid)}" ${o.uuid === targeted?.uuid ? "selected" : ""}>${escHtml(o.name)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.damage')}</label><select name="type"><option value="physical">${tx('SR2E.Dialog.Sheet.physical')}</option><option value="stun">${tx('SR2E.Dialog.Sheet.stun')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.poolDiceLeft2', { part: poolType === "spell" ? tx('SR2E.Dialog.Sheet.spell__pool') : tx('SR2E.Dialog.Sheet.combat'), left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.onlyActorsOnTheAstralPlane', { astralAttackBaseTn: RULES.ASTRAL.attackBaseTn })}</p>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.attack'),
        callback: (_e: Event, button: any) => {
          const el = button.form.elements;
          return {
            targetUuid: (el.target.value as string) || null,
            damageType: el.type.value as "physical" | "stun",
            mod: Number(el.mod.value) || 0,
            pool: Math.max(0, Math.min(left, Math.floor(Number(el.pool.value) || 0))),
          };
        },
      },
      rejectClose: false,
    });
    if (!choice) return;
    if (!(await actor.useAction("astral", tx('SR2E.Card.Sheet.anAstralAttack')))) return;
    await actor.astralAttack({
      targetUuid: choice.targetUuid, damageType: choice.damageType, poolDice: choice.pool,
      modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [],
    });
  }

  static #onOpenActor(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const uuid = target.dataset["uuid"];
    if (uuid) fromUuidSync(uuid)?.sheet?.render(true);
  }

  static async #onSummonSpirit(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const cha = actor.system.attributes.charisma.total as number;
    const magic = actor.system.derived.magic as number;
    const templates = (game.actors ?? []).filter((a: any) => a.type === "spirit" && !a.system.summonerUuid);
    const poolRows = RULES.CONJURING.spellPoolAllowed
      ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spellPoolDiceToSummonLeft', { derivedSpellPoolLeft: escHtml(actor.system.derived.spellPoolLeft) })}</label><input name="pool" type="number" value="0" min="0" max="${escHtml(actor.system.derived.spellPoolLeft)}"></div>
         <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spellPoolDiceForDrain')}</label><input name="drainPool" type="number" value="0" min="0" max="${escHtml(actor.system.derived.spellPoolLeft)}"></div>`
      : "";
    const levels = RULES.CONJURING.drainLevels.map(([ratio, level]) => tx('SR2E.App.Sheets.levelUpToForce', { level, force: Math.floor(ratio * cha) })).join(", ");
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.summon2', { actorName: actor.name }) },
      position: { width: 440 },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.kind')}</label><select name="kind">${SPIRIT_KINDS.filter((k) => k !== "ally" && k !== "free").map((k) => `<option value="${k}">${escHtml(SPIRIT_KIND_LABELS[k] ? tKey(SPIRIT_KIND_LABELS[k]!) : k)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spiritType')}</label><input name="type" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGForestSpiritFireElemental')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.elementElementals')}</label><select name="element">${elementChoices().map((e) => `<option value="${escHtml(e.key)}">${escHtml(e.label)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.domainNatureSpirits')}</label><input name="domain" type="text" value="${escHtml(SR2Actor.sceneEnvironment(actor.sceneHere?.() ?? null)[0] ?? game.scenes?.viewed?.name ?? "")}"></div>
        <label class="sr2e-check"><input type="checkbox" name="materials" checked> ${tx('SR2E.Dialog.Sheet.elementalsPayForConjuringMaterialsPer', { nuyen: bindingCost(1).nuyen, actorNuyen: escHtml(actor.system.nuyen ?? 0), hours: bindingCost(1).hours })}</label>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.forceMagic', { magic })}</label><input name="force" type="number" value="${Math.max(1, magic)}" min="1" autofocus></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.copyFrom')}</label><select name="template"><option value="">${tx('SR2E.Dialog.Sheet.blankSpirit')}</option>
          ${templates.map((t: any) => `<option value="${escHtml(t.uuid)}">${escHtml(t.name)}</option>`).join("")}</select></div>
        ${poolRows}
        ${rememberMarker(`summon|${actor.uuid}`, ["kind", "type", "element", "force", "pool", "drainPool", "materials"])}
        <div class="sr2e-preview" aria-live="polite"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.conjuringVsTnForceEachSuccess', { conjuringDrainAttribute: RULES.CONJURING.drainAttribute, cha, levels: escHtml(levels) })}</p>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.summon'),
        callback: (_e: Event, button: any) => {
          const el = button.form.elements;
          return {
            spiritKind: el.kind.value,
            spiritType: String(el.type.value ?? "").trim(),
            force: Math.max(1, Math.floor(Number(el.force.value) || 1)),
            templateUuid: (el.template.value as string) || null,
            element: String(el.element.value ?? ""),
            domain: String(el.domain.value ?? "").trim(),
            useMaterials: Boolean(el.materials.checked),
            poolDice: Math.max(0, Math.floor(Number(el.pool?.value) || 0)),
            drainPoolDice: Math.max(0, Math.floor(Number(el.drainPool?.value) || 0)),
            exclude: excludedOf(button.form),
          };
        },
      },
      // v0.50.0: the conjurer's penalties and the background count, found by themselves.
      render: (_e: Event, dialog: any) => livePreview(dialog, (f, excluded) => tnPreviewHtml({ base: Math.max(1, Math.floor(Number((f.elements as any).force?.value) || 1)), baseLabel: tx('SR2E.Dialog.Sheet.force'), auto: actor.previewModifiers({ magical: true }), excluded })),
      rejectClose: false,
    } as any) as any;
    if (!choice) return;
    if (!(await actor.useAction("summon", tx('SR2E.Card.Sheet.summoning')))) return;
    await actor.conjure(choice);
  }

  static async #onBanishSpirit(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const targeted: any = game.user.targets?.first?.()?.actor ?? null;
    // v0.50.0: spirits on the scene by their own actor (unlinked ones too), then the world's.
    const spirits = scenePeople(actor, ["spirit"]).map((p) => p.actor).filter((a: any) => a.system.force > 0);
    if (targeted?.type === "spirit" && !spirits.some((s: any) => s.uuid === targeted.uuid)) spirits.unshift(targeted);
    if (!spirits.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereAreNoSpiritsToBanish'));
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.banish2', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spirit')}</label><select name="spirit">
          ${spirits.map((s: any) => `<option value="${escHtml(s.uuid)}" ${s.uuid === targeted?.uuid ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.force2', { name: escHtml(s.name), force: escHtml(s.system.force) })}</option>`).join("")}</select></div>
        ${RULES.MAGIC_V56.control.enabled ? `<label class="sr2e-check" title="${tx('SR2E.Dialog.Sheet.theSameContestWithNetSuccesses')}"><input type="checkbox" name="control"> ${tx('SR2E.Dialog.Sheet.takeControlOfItInstead')}</label>` : ""}
        <div class="sr2e-preview" aria-live="polite"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.conjuringVsTnTheSpiritS', { derivedMagic: escHtml(actor.system.derived.magic) })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.banish'), callback: (_e: Event, button: any) => ({ uuid: String(button.form.elements.spirit.value), control: Boolean(button.form.elements.control?.checked), exclude: excludedOf(button.form) }) },
      render: (_e: Event, dialog: any) => livePreview(dialog, (f, excluded) => {
        const sp: any = fromUuidSync(String((f.elements as any).spirit?.value ?? ""));
        return tnPreviewHtml({ base: Number(sp?.system?.force ?? 0) || null, baseLabel: tx('SR2E.Dialog.Sheet.theSpiritSForce'), auto: actor.previewModifiers({ magical: true }), excluded });
      }),
      rejectClose: false,
    } as any) as any;
    if (!choice) return;
    const spirit: any = await fromUuid(choice.uuid);
    if (choice.control && spirit && actor.selfUuids?.().includes(String(spirit.system?.summonerUuid ?? ""))) return ui.notifications.warn(tx('SR2E.Notify.Sheet.isAlreadyS', { spiritName: escHtml(spirit.name), actorName: escHtml(actor.name) }));
    if (spirit && (await actor.useAction("banish", tx('SR2E.Card.Sheet.banishing')))) await actor.banish(spirit, { ...(choice.exclude?.length ? { exclude: choice.exclude } : {}), ...(choice.control ? { control: true } : {}) });
  }

  /** v0.56.0: manifest in the physical world while projecting (or stop). */
  static async #onManifest(this: SR2CharacterSheet) {
    const actor: any = this.document;
    await actor.setManifesting?.(!actor.isManifesting?.());
  }

  /** v0.56.0: raise a ward by ritual (RULES.MAGIC_V56.ward). */
  static async #onRaiseWard(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const W = RULES.MAGIC_V56.ward;
    const team = scenePeople(actor, ["character", "npc"]).map((p) => p.actor).filter((a: any) => a.uuid !== actor.uuid && Number(a.system?.derived?.magic ?? 0) > 0 && a.findSkill?.(W.skill));
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.raiseAWard', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.name')}</label><input type="text" name="name" placeholder="${tx('SR2E.Dialog.Sheet.wardForce')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.force')}</label><input type="number" name="force" value="4" min="1"></div>
        ${team.length ? `<fieldset><legend>${tx('SR2E.Dialog.Sheet.ritualTeam')}</legend>${team.map((m: any) => `<label class="sr2e-check"><input type="checkbox" name="team" value="${escHtml(m.uuid)}"> ${escHtml(m.name)}</label>`).join("")}</fieldset>` : ""}
        ${W.nuyenPerForce > 0 ? `<label class="sr2e-check"><input type="checkbox" name="pay" checked> ${tx('SR2E.Dialog.Sheet.payForTheMaterialsForce', { wNuyenPerForce: W.nuyenPerForce })}</label>` : ""}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spellPoolDice')}</label><input type="number" name="pool" value="0" min="0" max="${escHtml(actor.system.derived?.spellPoolLeft ?? 0)}"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.theTeamSDiceVsThe', { wSkill: escHtml(W.skill), wHoursPerForce: W.hoursPerForce, part: W.drainModifier ? ` ${W.drainModifier > 0 ? "+" : "−"} ${Math.abs(W.drainModifier)}` : "", wDrainLevel: W.drainLevel })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.raise'), callback: (_e: Event, button: any) => {
        const f = button.form.elements;
        return { name: String(f.name.value ?? ""), force: Number(f.force.value) || 1, pool: Number(f.pool.value) || 0, pay: f.pay ? Boolean(f.pay.checked) : true,
          team: [...button.form.querySelectorAll('input[name="team"]:checked')].map((x: any) => String(x.value)) };
      } },
      rejectClose: false,
    } as any) as any;
    if (!choice) return;
    const plan = wardPlan(choice.force, 0);
    if (plan.nuyen > 0 && choice.pay && Number(actor.system.nuyen ?? 0) < plan.nuyen) return ui.notifications.warn(tx('SR2E.Notify.Sheet.materialsCostHas', { planNuyen: plan.nuyen, actorName: escHtml(actor.name), actorNuyen: escHtml(actor.system.nuyen ?? 0) }));
    await actor.raiseWardRitual({ force: choice.force, name: choice.name, teamUuids: choice.team, poolDice: choice.pool, payMaterials: choice.pay });
  }

  /** v0.56.0: a centering test before a magical test (Grimoire). */
  static async #onCenteringTest(this: SR2CharacterSheet) {
    const actor: any = this.document;
    await actor.centeringTest?.();
  }

  /** v0.56.0: bind a free spirit by its true name (RULES.MAGIC_V56.trueName). */
  static async #onBindTrueName(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const targeted: any = game.user.targets?.first?.()?.actor ?? null;
    // Players choose from the scene (and their target); the GM from the whole world.
    const spirits = [...new Map([...(targeted?.type === "spirit" ? [targeted] : []), ...scenePeople(actor, ["spirit"]).map((p) => p.actor), ...(game.user?.isGM ? allActors().filter((a: any) => a.type === "spirit") : [])]
      .filter((a: any) => a.system?.spiritKind === "free" && Number(a.system?.force ?? 0) > 0).map((a: any) => [a.uuid, a])).values()];
    if (!spirits.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereAreNoFreeSpiritsTo'));
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.bindByTrueName', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.freeSpirit')}</label><select name="spirit">${spirits.map((s: any) => `<option value="${escHtml(s.uuid)}">${tx('SR2E.Dialog.Sheet.force2', { name: escHtml(s.name), force: escHtml(s.system.force) })}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.itsTrueName')}</label><input type="text" name="trueName" autocomplete="off"></div>
        <p class="hint">${(RULES.SPIRITS_V923.trueName === "book" ? tx('SR2E.Dialog.Sheet.trueNameBookHint') : tx('SR2E.Dialog.Sheet.conjuringVsItsForceOpposedBy', { trueNameKarmaPerForce: RULES.MAGIC_V56.trueName.karmaPerForce }))}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.bind'), callback: (_e: Event, button: any) => ({ uuid: String(button.form.elements.spirit.value), name: String(button.form.elements.trueName.value ?? "") }) },
      rejectClose: false,
    } as any) as any;
    if (!choice) return;
    const spirit = await fromUuid(choice.uuid);
    if (spirit) await actor.bindByTrueName(spirit, choice.name);
  }

  /** Click a box to fill the track up to it; click the last filled box to clear it. */
  static async #onSetMonitor(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const track = target.dataset["track"] as "physical" | "stun";
    const value = Number(target.dataset["value"]);
    if (!["physical", "stun"].includes(track) || !Number.isFinite(value)) return;
    const actor: any = this.document;
    const current = actor.system.monitor[track] as number;
    const before = actor.system.monitor.physical as number;
    await actor.update({ [`system.monitor.${track}`]: current === value ? value - 1 : value });
    if (track === "physical") await actor.checkMagicLoss?.(before);
  }

  /** v0.68.0: − / + on a monitor track (Physical runs on into the Overflow row; spirits have none). */
  static async #onStepMonitor(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const track = target.dataset["track"] as "physical" | "stun";
    const delta = Math.sign(Number(target.dataset["delta"]) || 0);
    if (!["physical", "stun"].includes(track) || !delta) return;
    const actor: any = this.document;
    const current = Number(actor.system.monitor?.[track] ?? 0);
    // v0.80.0 (RULES.URR_V80.hsDeathPastOverflow): one box more, the death box.
    const cap = track === "physical" && actor.type !== "spirit" ? RULES.MONITOR_BOXES + Math.max(0, Number(actor.system.derived?.vitals?.overflowBody ?? actor.system.attributes?.body?.total ?? 0)) + deathBoxExtra() : RULES.MONITOR_BOXES;
    const next = Math.max(0, delta > 0 ? Math.min(current + 1, Math.max(cap, current)) : current - 1);
    if (next === current) return;
    const before = Number(actor.system.monitor?.physical ?? 0);
    await actor.update({ [`system.monitor.${track}`]: next });
    if (track === "physical") await actor.checkMagicLoss?.(before);
  }

  static async #onRollAttribute(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const key = target.dataset["attribute"] as AttributeKey;
    const actor: any = this.document;
    // Quickness with a cyberlimb (v0.43.0): which limb the test is made with.
    const limbs = key === "quickness" && RULES.GEAR.cyberlimbs.quickness ? [...(actor.system.derived?.cyber?.limbs ?? [])] : [];
    if (limbs.length) {
      const c = await foundry.applications.api.DialogV2.prompt({
        window: { title: tx('SR2E.Dialog.Sheet.rollQuickness') },
        content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.targetNumber')}</label><input name="tn" type="number" value="4" min="2" autofocus></div>
          <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.with')}</label><select name="limb"><option value="">${tx('SR2E.Dialog.Sheet.naturalQuickness', { quicknessTotal: escHtml(actor.system.attributes?.quickness?.total ?? 0) })}</option>${limbs.map((l: any) => `<option value="${escHtml(l.id)}">${tx('SR2E.Dialog.Sheet.quickness', { name: escHtml(l.name), quickness: escHtml(l.quickness) })}</option>`).join("")}</select></div>`,
        ok: { callback: (_e: Event, b: any) => ({ tn: Number(b.form.elements.tn.value) || 4, limb: String(b.form.elements.limb.value || "") }) },
        rejectClose: false,
      }) as { tn: number; limb: string } | null;
      if (c) await actor.rollAttribute(key, { targetNumber: c.tn, limbId: c.limb || null });
      return;
    }
    const c2 = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.roll2', { key: cap(key) }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.targetNumber')}</label><input name="tn" type="number" value="4" min="2" autofocus></div>
        ${urrCoreTnPresetRow()}${urrCoreKarmaDiceRow(Number(actor.system?.derived?.karmaPoolLeft ?? 0))}
        <label class="sr2e-check"><input type="checkbox" name="open"> ${tx('SR2E.Dialog.Sheet.openTestNoTnTheHighest')}</label>
        <div class="sr2e-preview" aria-live="polite"></div>`,
      render: (_e: Event, dialog: any) => {
        // v0.80.0 (RULES.URR_V80.coreTnPresets): a preset sets the TN (no such field in the book).
        const f: any = dialog.element?.querySelector?.("form") ?? dialog.form;
        f?.elements?.tnPreset?.addEventListener?.("change", () => { const v = f.elements.tnPreset.value; if (v) { f.elements.tn.value = v; f.elements.tn.dispatchEvent(new Event("input", { bubbles: true })); } });
        livePreview(dialog, (form, excluded) => tnPreviewHtml({ base: Number((form.elements as any).tn?.value) || 4, baseLabel: tx('SR2E.Dialog.Sheet.targetNumber'), auto: actor.previewModifiers(), excluded }));
      },
      ok: { callback: (_e: Event, b: any) => ({ tn: Number(b.form.elements.tn.value) || 4, open: Boolean(b.form.elements.open.checked), exclude: excludedOf(b.form),
        karmaDice: b.form.elements.karmaDice ? Math.max(0, Math.floor(Number(b.form.elements.karmaDice.value) || 0)) : 0 }) },
      rejectClose: false,
    }) as { tn: number; open: boolean; exclude: string[]; karmaDice: number } | null;
    if (!c2) return;
    if (c2.open) await actor.openAttributeTest(key);
    else await actor.rollAttribute(key, { targetNumber: c2.tn, exclude: c2.exclude, ...(c2.karmaDice > 0 ? { karmaDice: c2.karmaDice } : {}) });
  }

  static async #onRollSkill(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const id = target.dataset["itemId"] ?? "";
    // A skillsoft row: the stand-in skill from the slotted chip.
    const item = id.startsWith("soft-") ? (this.document as any).softSkill(target.dataset["skillName"] ?? "") : (this.document as any).items.get(id);
    if (!item) return;
    const actor: any = this.document;
    // v0.50.0: a contested skill with a token targeted becomes that contest, so the scene's modifiers count
    // (Alt-click for a plain roll against a TN instead: spotting a trap, etiquette at a party).
    const targeted: any = game.user.targets?.first?.()?.actor ?? null;
    if (targeted && targeted.uuid !== actor.uuid && !(_event as MouseEvent | undefined)?.altKey) {
      const n = String(item.name ?? "").trim().toLowerCase();
      if (n === RULES.PERCEPTION.skill.toLowerCase()) return SR2CharacterSheet.#onPerceive.call(this);
      if (n === RULES.PERCEPTION.stealthSkill.toLowerCase()) return SR2CharacterSheet.#onSneak.call(this);
      const social = Object.keys(RULES.SOCIAL.skills).find((k) => k.toLowerCase() === n);
      if (social) { SR2CharacterSheet.#socialSkill = social; return SR2CharacterSheet.#onSocialTest.call(this); }
    }
    // v0.44.0: open tests, a complementary skill, helpers (teamwork).
    const others = [...actor.items].filter((i: any) => i.type === "skill" && i.id !== item.id && (i.system.rating ?? 0) > 0);
    // Not this character's own tokens (an unlinked token is a copy with the same id).
    const helpers = [...(canvas?.tokens?.placeables ?? [])].map((t: any) => t.actor).filter((a: any) => a && a.uuid !== actor.uuid && a.id !== actor.id && ["character", "npc"].includes(a.type));
    // v0.58.0: Build/Repair tools, a language's complexity and Read/Write, and the task's base time.
    const c58 = RULES.CHARACTERS_V58;
    const isBR = item.system?.kind === "buildRepair" || /\bB\/R$/i.test(String(item.name ?? ""));
    const isLang = item.system?.kind === "language";
    const toolsBest = isBR ? actor.toolsFor?.(item.name) ?? "none" : "none";
    const levelOpts = (sel: string) => c58.tools.levels.map((l) => `<option value="${escHtml(l.id)}" ${l.id === sel ? "selected" : ""}>${escHtml(l.label)}</option>`).join("");
    const extra58 = `${isBR ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.theJobNeeds')}</label><select name="toolsNeed">${levelOpts("kit")}</select></div><div class="form-group"><label>${tx('SR2E.Dialog.Sheet.toolsAtHand')}</label><select name="toolsHave">${levelOpts(toolsBest)}</select></div>` : ""}
        ${isLang ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.language')}</label><select name="langMode"><option value="speak">${tx('SR2E.Dialog.Sheet.speakingListening')}</option><option value="rw">${tx('SR2E.Dialog.Sheet.readingWritingRating', { readWriteRating: readWriteRating(Number(item.system?.rating ?? 0)) })}</option></select></div><div class="form-group"><label>${tx('SR2E.Dialog.Sheet.howComplex')}</label><select name="langCx">${c58.languages.complexity.map((x) => `<option value="${escHtml(x.id)}" data-tn="${x.tn}" ${x.id === "everyday" ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.tn2', { label: escHtml(x.label), tn: x.tn })}</option>`).join("")}</select></div>` : ""}
        <div class="form-group"><label title="${tx('SR2E.Dialog.Sheet.timeSuccessesIsShownOnThe')}">${tx('SR2E.Dialog.Sheet.baseTimeOptional')}</label><input name="baseTime" type="number" min="0" step="0.5" value="0"> <select name="baseUnit">${c58.time.units.map((u) => `<option value="${escHtml(u.id)}" ${u.id === "hours" ? "selected" : ""}>${escHtml(u.label)}</option>`).join("")}</select></div>`;
    // v0.78.0 (RULES.BOOK_V78.encephalon 'shadowtech'): an encephalon's Task Pool on the skills it helps.
    const taskLeft = encephalonFits({ attribute: String(item.system?.attribute ?? ""), kind: String(item.system?.kind ?? "active") }) ? Number(actor.system?.derived?.taskPoolLeft ?? 0) : 0;
    const taskRow = taskLeft > 0 ? `<div class="form-group"><label title="${tx('SR2E.Dialog.Sheet.refreshesEachCombatTurnNotUsed')}">${tx('SR2E.Dialog.Sheet.taskPoolDiceEncephalonLeft', { taskLeft })}</label><input name="taskPool" type="number" min="0" max="${taskLeft}" value="0"></div>` : "";
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.roll3', { itemName: item.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.targetNumber')}</label><input name="tn" type="number" value="${isLang ? (c58.languages.complexity.find((x) => x.id === "everyday")?.tn ?? 4) : 4}" min="2" autofocus></div>
        ${urrCoreTnPresetRow(String(item.system?.kind ?? ""))}${extra58}${taskRow}${urrCoreKarmaDiceRow(Number(actor.system?.derived?.karmaPoolLeft ?? 0), Number(item.system?.rating ?? 0) > 0)}
        ${skillChoiceRows(this.document, item, false)}
        <label class="sr2e-check"><input type="checkbox" name="open"> ${tx('SR2E.Dialog.Sheet.openTestNoTnTheHighest')}</label>
        ${others.length ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.complementarySkill1DiePerSuccesses', { complementarySuccessesPerDie: RULES.STREET.tests.complementary.successesPerDie })}</label><select name="comp"><option value="">${tx('SR2E.Dialog.Sheet.none')}</option>${others.map((o: any) => `<option value="${escHtml(o.id)}">${escHtml(o.name)} ${escHtml(o.system.rating)}</option>`).join("")}</select></div>` : ""}
        ${rememberMarker(`skill|${actor.uuid}|${item.id ?? item.name}`, skillRollMemoryFields())}
        ${helpers.length ? `<fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Sheet.helpersTeamworkTheirSuccessesAddDice', { part: RULES.STREET.tests.teamwork.cap === "rating" ? tx('SR2E.Dialog.Sheet.atMost', { itemRating: escHtml(item.system?.rating ?? 0) }) : "" })}</legend>${helpers.map((h: any) => `<label class="sr2e-check"><input type="checkbox" name="helper" value="${escHtml(h.uuid)}"> ${escHtml(h.name)}</label>`).join("")}</fieldset>` : ""}
        <div class="sr2e-preview" aria-live="polite"></div>`,
      render: (_e: Event, dialog: any) => {
        // v0.58.0: a language's complexity sets the TN.
        const f: any = dialog.element?.querySelector?.("form") ?? dialog.form;
        f?.elements?.langCx?.addEventListener?.("change", () => { const o = f.elements.langCx.selectedOptions?.[0]; if (o?.dataset?.tn) { f.elements.tn.value = o.dataset.tn; f.elements.tn.dispatchEvent(new Event("input", { bubbles: true })); } });
        // v0.80.0 (RULES.URR_V80.coreTnPresets / coreKnowledgeTest): a preset sets the TN (no such field in the book).
        f?.elements?.tnPreset?.addEventListener?.("change", () => { const v = f.elements.tnPreset.value; if (v) { f.elements.tn.value = v; f.elements.tn.dispatchEvent(new Event("input", { bubbles: true })); } });
        livePreview(dialog, (form, excluded) => {
          const el: any = form.elements;
          const t = el.toolsNeed ? toolsModifier(String(el.toolsNeed.value), String(el.toolsHave?.value ?? "none")) : null;
          return tnPreviewHtml({ base: Number(el.tn?.value) || 4, baseLabel: tx('SR2E.Dialog.Sheet.targetNumber'), auto: actor.previewModifiers(), manual: t?.modifier ? [t.modifier] : [], excluded, note: tx('SR2E.Dialog.Sheet.edgesFlawsAndDefaultingAreAdded'), ...(t?.blocked ? { warn: tx('SR2E.Dialog.Sheet.canTDoItWithoutTools') } : {}) });
        });
      },
      ok: {
        callback: (_e: Event, button: any) => {
          const el = button.form.elements;
          return { tn: Number(el.tn.value) || 4, useSpec: Boolean(el.useSpec?.checked), useConc: Boolean(el.useConc?.checked), related: (el.related?.value as string) || null,
            open: Boolean(el.open?.checked), comp: (el.comp?.value as string) || null, helpers: Array.from(button.form.querySelectorAll('input[name="helper"]:checked')).map((i: any) => i.value as string), exclude: excludedOf(button.form),
            baseTime: Number(el.baseTime?.value) || 0, baseUnit: String(el.baseUnit?.value ?? "hours"), toolsNeed: el.toolsNeed ? String(el.toolsNeed.value) : null, toolsHave: el.toolsHave ? String(el.toolsHave.value) : null,
            lang: el.langMode ? { readWrite: el.langMode.value === "rw", complexity: String(el.langCx?.value ?? "everyday") } : null,
            taskPool: el.taskPool ? Math.max(0, Math.floor(Number(el.taskPool.value) || 0)) : 0,
            karmaDice: el.karmaDice ? Math.max(0, Math.floor(Number(el.karmaDice.value) || 0)) : 0 };
        },
      },
      rejectClose: false,
    }) as any;
    if (!choice) return;
    if (choice.toolsNeed && toolsModifier(choice.toolsNeed, choice.toolsHave ?? "none").blocked) return ui.notifications.warn(tx('SR2E.Notify.Sheet.canTDoThisWithoutTools', { actorName: escHtml(actor.name) }));
    await actor.rollSkill(item, { exclude: choice.exclude, targetNumber: choice.tn, useSpecialization: choice.useSpec, useConcentration: choice.useConc, relatedSkillId: choice.related, open: choice.open, complementarySkillId: choice.comp, helperUuids: choice.helpers,
      ...(choice.baseTime > 0 ? { baseTime: { value: choice.baseTime, unit: choice.baseUnit } } : {}),
      ...(choice.toolsNeed ? { tools: { need: choice.toolsNeed, have: choice.toolsHave ?? "none" } } : {}),
      ...(choice.lang ? { language: choice.lang } : {}),
      ...(choice.taskPool > 0 ? { pool: "task", poolDice: choice.taskPool } : {}),
      ...(choice.karmaDice > 0 ? { karmaDice: choice.karmaDice } : {}) });
  }

  static async #onResistDamage(this: SR2CharacterSheet) {
    const code = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("SR2E.ResistDamage") },
      content: `<div class="form-group"><label>${game.i18n.localize("SR2E.DamageCode")}</label><input name="code" type="text" value="6M" autofocus></div>
        <div class="form-group"><label>${game.i18n.localize("SR2E.Armor")}</label><input name="armor" type="number" value="0"></div>
        <div class="form-group"><label>${game.i18n.localize("SR2E.Stun")}</label><input name="stun" type="checkbox"></div>`,
      ok: {
        callback: (_e: Event, button: any) => ({
          code: button.form.elements.code.value as string,
          armor: Number(button.form.elements.armor.value),
          stun: button.form.elements.stun.checked as boolean,
        }),
      },
      rejectClose: false,
    });
    if (!code) return;
    await (this.document as any).resistDamageCode(code.code, {
      armor: code.armor,
      type: code.stun ? "stun" : "physical",
    });
  }

  static async #onAttackWeapon(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const id = target.dataset["itemId"];
    const weapon = actor.weaponById ? actor.weaponById(id) : id === "unarmed" ? SR2Actor.unarmed() : actor.items.get(id);
    if (!weapon) return;
    const w = weapon.system;
    const melee = Boolean(w.melee);
    const blast = !melee && Boolean(w.blast);
    // v0.71.0 (R16): the firing modes that may fire twice in one phase.
    const twiceModes: string[] = RULES.FIXES_V71.fireTwice === "SA+SS" ? ["SA", "SS"] : ["SA"];
    const shotgun = !melee && !blast && Boolean(w.shotgun);
    const strength = (actor.system.attributes?.strength?.total as number | undefined) ?? 0;
    const limits = weaponRange(w, strength, weapon.name);
    const derived = actor.system.derived ?? {};
    const sit = (sid: string) => RULES.SITUATIONAL_MODIFIERS.find((m) => m.id === sid);

    // Target: the user's current token target, tokens on the viewed scene, then other world actors.
    const targetToken: any = game.user.targets?.first?.() ?? null;
    const fromToken = attackerToken(actor);
    const { options: targetOptions, tokens: targetTokens } = attackTargetOptions(actor, fromToken, targetToken);

    // Distance: measured on the canvas between the attacker's token and the chosen target's token.
    const check = (uuid: string | null): RangeCheck & { metres: number | null; stepMetres: number } => {
      const to = uuid ? targetTokens.get(uuid) ?? null : null;
      const m = fromToken && to ? measureTokens(fromToken, to) : null;
      if (uuid && !m) {
        const note = !fromToken ? tx('SR2E.App.Sheets.notMeasuredNoToken', { name: actor.name }) : tx('SR2E.App.Sheets.notMeasuredTargetNoToken');
        return { status: "unmeasured", blocks: false, note, metres: null, stepMetres: 0 };
      }
      const r = checkWeaponDistance({
        metres: m?.metres ?? null, melee, limits, reach: (w.reach ?? 0) + (actor.reachBonus ?? 0),
        stepMetres: m?.stepMetres ?? 0, ...(m?.unitsNote ? { unitsNote: m.unitsNote } : {}),
      });
      // v0.56.0: an adept's distance strike reaches past arm's length with an unarmed blow.
      const ds = melee && weapon.id === "unarmed" ? Number(actor.distanceStrikeReach?.() ?? 0) : 0;
      if (r.status === "out" && ds > 0 && m && m.metres <= ds) {
        return { ...r, status: "ok", blocks: false, note: tx('SR2E.App.Sheets.distanceStrikeReaches', { metres: Math.round(m.metres * 10) / 10, reach: ds }), metres: m.metres, stepMetres: m.stepMetres, distanceStrike: true } as any;
      }
      return { ...r, metres: m?.metres ?? null, stepMetres: m?.stepMetres ?? 0 };
    };

    // Everything that depends on the target: cover, light, prone, allies in melee, barriers, reach.
    // v0.47.0: a scope with its own vision mode (low-light, thermographic) lends it to ranged attacks.
    const vision = withScopeVision({ lowLight: Boolean(derived.vision?.lowLight), thermographic: Boolean(derived.vision?.thermographic), ultrasound: Boolean(derived.vision?.ultrasound), lowLightNatural: Boolean(derived.vision?.lowLightNatural), thermographicNatural: Boolean(derived.vision?.thermographicNatural) }, melee ? "" : String((w as any).scopeVision ?? ""));
    const lightLabels: Record<string, string> = { normal: tx('SR2E.App.Sheets.normalLight'), partial: tx('SR2E.App.Sheets.partialLight'), minimal: tx('SR2E.App.Sheets.minimalLight'), darkness: tx('SR2E.App.Sheets.totalDarkness') };
    const situationFor = (uuid: string | null) => {
      const to = uuid ? targetTokens.get(uuid) ?? null : null;
      const targetActor: any = to?.actor ?? null;
      const cover = !melee && RULES.COMBAT.cover.autoDetect && fromToken && to ? sightCover(fromToken, to) : null;
      const light = targetLight(to);
      const barriers = !melee && fromToken && to ? barriersBetween(fromToken, to) : [];
      const c = check(uuid);
      const reachM = meleeReachMetres((w.reach ?? 0) + (actor.reachBonus ?? 0), c.stepMetres);
      // v0.48.0: smoke from fires on the line of fire.
      // v0.72.0 (O5): smoke counts in melee too (RULES.COMBAT_V72.meleeSmoke).
      const smoke = smokeCounts(melee) && fromToken && to ? smokeBetweenTokens(fromToken, to, (SR2Actor as any).sceneFires?.(canvas?.scene) ?? []) : { kind: "none" as const, source: "", flames: false };
      // v0.50.0: the target's chameleon suit or invisibility against the attacker's eyes.
      const conceal = RULES.TN_AUTO.attack.concealment && targetActor?.concealmentOf ? livingConcealment(vision, targetActor.concealmentFor?.(actor) ?? targetActor.concealmentOf()) : null;
      return {
        cover, light, barrierArmor: barrierArmor(barriers), barrierCount: barriers.length, smoke, conceal,
        targetProne: isProne(targetActor), attackerProne: isProne(actor),
        friends: melee && fromToken && to ? friendsInMelee(fromToken, to, reachM) : 0,
        targetReach: Math.max(0, ...[...(targetActor?.items ?? [])].filter((i: any) => i.type === "weapon" && i.system.melee).map((i: any) => i.system.reach ?? 0)) + (targetActor?.reachBonus ?? 0),
      };
    };
    const firstUuid = targetToken?.actor?.uuid ?? null;
    let latest = check(firstUuid);
    let here = situationFor(firstUuid);
    const suggested: RangeBand = latest.band ?? "short";

    const visOptions = (["normal", "partial", "minimal", "darkness"] as const).map((l) => {
      const v = visibilityModifier(l, vision);
      return { id: l as string, label: lightLabels[l]!, value: v.value, using: v.using === "lowLight" ? tx('SR2E.App.Sheets.lowLightVision') : v.using === "thermographic" ? tx('SR2E.App.Sheets.thermographicVision') : "" };
    });
    // v0.79.0: glare and mist, the SR2 Visibility Table's other rows (RULES.DOCS_V79.visionTable).
    for (const [id, label] of [["glare", tx('SR2E.App.Sheets.glare')], ["mist", tx('SR2E.App.Sheets.mist')]] as const) {
      const v = visibilityV79(id, vision)!;
      visOptions.push({ id, label, value: v.value, using: v.using === "lowLight" ? tx('SR2E.App.Sheets.lowLightVision') : v.using === "thermographic" ? tx('SR2E.App.Sheets.thermographicVision') : "" });
    }
    visOptions.push({ id: "blind", label: tx('SR2E.Card.Mod.blindFireNoLineOfSight'), value: RULES.COMBAT.cover.blindFireTn, using: "" });
    const visFor = (h: typeof here) => (h.cover?.cover === "blind" || h.conceal?.blind ? "blind" : (h.light?.light ?? "normal"));
    // v0.79.0: heavy smoke (RULES.DOCS_V79.visionSmokeRows 'book').
    const smokeKinds = RULES.DOCS_V79.visionSmokeRows === "book" ? (["none", "smoke", "heavySmoke", "thermal", "heavyThermal"] as const) : (["none", "smoke", "thermal"] as const);
    const smokeNames: Record<string, string> = { none: tx('SR2E.Card.Sheet.noSmoke'), smoke: tx('SR2E.Card.Sheet.smoke'), heavySmoke: tx('SR2E.Card.Sheet.heavySmoke'), thermal: tx('SR2E.Card.Sheet.thermalSmoke'), heavyThermal: tx('SR2E.Card.Sheet.heavyThermalSmoke') };
    const smokeOptions = smokeKinds.map((k) => {
      const v = smokeModifier(k, vision);
      return { id: k as string, label: smokeNames[k]!, value: v.value, using: v.using === "normal" ? "" : v.using === "lowLight" ? tx('SR2E.App.Sheets.lowLightVision') : tx('SR2E.App.Sheets.thermographicVision') };
    });

    // Movement this Combat Turn, from the token's movement history.
    const inCombat = Boolean(game.combat?.started);
    const moved = fromToken && inCombat ? movedThisTurn(fromToken) : null;
    const movement = moved == null ? "none" : movementState(moved, actor.system.attributes?.quickness?.total ?? 0);

    const left = derived.combatPoolLeft as number;
    const rangeRow = melee
      ? ""
      : `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.range2', { part: w.strengthRange ? tx('SR2E.Dialog.Sheet.strength', { effectiveStrength: effectiveStrength(strength, w.strengthCap) }) : "" })}</label>
          <select name="range">${RANGE_BANDS.map((b) => `<option value="${b}" ${b === suggested ? "selected" : ""}>${b} (${limits[b]} m)</option>`).join("")}</select></div>`;
    const coverNote = (h: typeof here) => {
      const parts: string[] = [];
      if (h.cover?.cover === "blind") parts.push(tx('SR2E.App.Sheets.wallsBlockEveryLineOfSight'));
      else if (h.cover?.cover === "partial") parts.push(tx('SR2E.App.Sheets.wallsHidePartOfTheTarget', { blocked: h.cover.blocked, total: h.cover.total }));
      if (h.barrierCount) parts.push(h.barrierArmor ? tCount(h.barrierCount, 'SR2E.App.Sheets.wallsInTheLineOfFireRated', { armor: h.barrierArmor }) : tCount(h.barrierCount, 'SR2E.App.Sheets.wallsInTheLineOfFireUnrated'));
      if (h.light?.source) parts.push(tx('SR2E.App.Sheets.theTargetIsLit', { light: lightLabels[h.light.light]?.toLowerCase() }));
      if (h.smoke?.kind && h.smoke.kind !== "none") parts.push(melee
        ? (h.smoke.flames ? tx('SR2E.App.Sheets.theFightIsInTheFlames', { source: h.smoke.source }) : tx('SR2E.App.Sheets.theFightIsInSmoke', { source: h.smoke.source }))
        : (h.smoke.flames ? tx('SR2E.App.Sheets.theLineOfFirePassesThroughFlames', { source: h.smoke.source }) : tx('SR2E.App.Sheets.theLineOfFirePassesThroughSmoke', { source: h.smoke.source })));
      if (h.conceal?.blind) parts.push(tx('SR2E.App.Sheets.theTargetCantBeSeen', { label: h.conceal.label }));
      else if (h.conceal?.modifier) parts.push(tx('SR2E.App.Sheets.theTargetIsHardToSee', { label: h.conceal.label }));
      return parts.join(" ");
    };
    const distanceRow = `<div class="sr2e-distance" data-status="${latest.status}">
        <p class="hint sr2e-range-note">${escHtml(latest.note)}</p>
        <p class="hint sr2e-cover-note">${escHtml(coverNote(here))}</p>
        <label class="sr2e-check sr2e-anyway" ${latest.status === "out" && latest.blocks ? "" : "hidden"}><input type="checkbox" name="anyway"> ${tx('SR2E.Dialog.Sheet.attackAnywayGmSCall')}</label>
      </div>`;

    const modes = melee ? [] : parseFiringModes(w.modes);
    const tracked = { phase: actor.currentPhaseKey(), rounds: actor.trackedRecoilRounds() };
    const ammoNote = !melee && w.ammoMax > 0 ? tx('SR2E.App.Sheets.ammoRounds', { ammo: w.ammo, ammoMax: w.ammoMax }) : "";
    const ammoRow = melee || blast ? "" : `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.ammunition')}</label><select name="ammoType">${ammoChoices(w.ammoType ?? "standard").map((a) => `<option value="${escHtml(a.id)}" ${a.selected ? "selected" : ""}>${escHtml(a.label)}</option>`).join("")}</select></div>`;
    // Full auto can spread over extra targets on this scene.
    const extraTargets = modes.includes("FA")
      // v0.50.0: the other targeted tokens are pre-ticked.
      ? [...targetTokens.entries()].map(([uuid, t]) => `<label class="sr2e-check"><input type="checkbox" name="spreadTarget" value="${escHtml(uuid)}" ${uuid !== firstUuid && [...(game.user.targets ?? [])].some((x: any) => x.actor?.uuid === uuid) ? "checked" : ""}> ${escHtml(t.name)}</label>`).join("")
      : "";
    const fireRows = melee
      ? ""
      : `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.firingMode')}</label>
          <select name="mode">${modes.map((m) => `<option value="${m}">${m}</option>`).join("")}</select></div>
        ${modes.includes("FA") ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.fullAutoRounds', { firingFullAutoMin: RULES.FIRING.fullAutoMin, firingFullAutoMax: RULES.FIRING.fullAutoMax })}</label><input name="faRounds" type="number" value="${RULES.FIRING.fullAutoMin}" min="${RULES.FIRING.fullAutoMin}" max="${RULES.FIRING.fullAutoMax}"></div>` : ""}
        ${extraTargets ? `<fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Sheet.fullAutoAlsoSprayRoundsSplit', { spreadFireWastedRoundsPerMetre: RULES.COMBAT.spreadFire.wastedRoundsPerMetre })}</legend>${extraTargets}</fieldset>` : ""}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.roundsAlreadyFiredThisPhaseRecoil', { part: w.heavy ? tx('SR2E.Dialog.Sheet.heavy', { combatHeavyRecoilMultiplier: RULES.COMBAT.heavyRecoilMultiplier }) : "", part2: w.gyro ? tx('SR2E.Dialog.Sheet.gyro', { gyro: escHtml(w.gyro) }) : "", part3: tracked.phase ? tx('SR2E.Dialog.Sheet.tracked') : "" })}</label><input name="earlier" type="number" value="${escHtml(tracked.rounds)}" min="0"></div>
        ${ammoRow}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.barrierArmorWallsShotThrough')}</label><input name="barrier" type="number" value="${here.barrierArmor}" min="0"></div>
        ${modes.some((m) => twiceModes.includes(m)) && !blast ? `<label class="sr2e-check"><input type="checkbox" name="twice"> ${tx('SR2E.Dialog.Sheet.fireTwiceTwoSimpleActionsOnly', { twiceModes: escHtml(twiceModes.join("/")) })}</label>` : ""}`;
    const smartReady = Boolean(w.smartgun) && Boolean(derived.smartlink);
    // A laser sight is pre-ticked unless the smartlink is (they don't add together, v0.43.0).
    // v0.47.0: and only within the laser's range (RULES.GEAR.accessories.laserRangeMetres); re-checked on a target change.
    const laserFits = Boolean(w.laserSight) && !melee && !(smartReady && RULES.GEAR.accessories.laserNotWithSmartlink);
    const laserReadyFor = (c: { metres: number | null }) => laserFits && laserInRange(c.metres);
    const laserReady = laserReadyFor(latest);
    // v0.50.0: walking/running are ticked by themselves for ranged attacks (and melee if RULES.TN_AUTO.attack.movementInMelee).
    const moveTicks = !melee || RULES.TN_AUTO.attack.movementInMelee;
    const situationalRows = RULES.SITUATIONAL_MODIFIERS.filter((m) => m.id !== "calledShot").map((m) => {
      const checked = (m.id === "smartlink" && smartReady) || (m.id === "partialCover" && here.cover?.cover === "partial")
        || (m.id === "laserSight" && laserReady)
        || (moveTicks && m.id === "attackerWalking" && movement === "walking") || (moveTicks && m.id === "attackerRunning" && movement === "running");
      return `<label class="sr2e-check"><input type="checkbox" name="sit-${escHtml(m.id)}" ${checked ? "checked" : ""}> ${escHtml(m.label)} (${m.value > 0 ? "+" : ""}${m.value})</label>`;
    }).join("");
    const p = RULES.COMBAT.prone;
    const tp = melee ? p.targetMelee : p.targetRanged, ap = melee ? p.attackerMelee : p.attackerRanged;
    // v0.55.0: a target who doesn't know it's coming (found by itself when the attacker surprised them).
    const unawareRow = `<label class="sr2e-check" title="${tx('SR2E.Dialog.Sheet.theyCanTDodgeCounterOr')}"><input type="checkbox" name="unaware"> ${tx('SR2E.Dialog.Sheet.targetUnawareOfTheAttack')}</label>`;
    const meleeRows = melee ? `
        <label class="sr2e-check"><input type="checkbox" name="charging" ${movement === "running" ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.charging', { cbtChargeLabel: U80C.cbtChargeLabel() })}</label>
        <label class="sr2e-check"><input type="checkbox" name="subdue"> ${tx('SR2E.Dialog.Sheet.subdueDamage', { subdueDamageType: RULES.COMBAT.subdue.damageType })}</label>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.friendsInMeleeWithTheTarget', { friendsInMeleeTnPerFriend: RULES.COMBAT.friendsInMelee.tnPerFriend })}</label><input name="friends" type="number" value="${here.friends}" min="0"></div>${RULES.COMBAT_V61.superiorPosition.enabled ? `
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.superiorPositionHigherGroundABetter')}</label><select name="superior"><option value="">${tx('SR2E.Dialog.Sheet.neither')}</option><option value="attacker">${tx('SR2E.Dialog.Sheet.holdsIt', { actorName: escHtml(actor.name), superiorPositionHolder: RULES.COMBAT_V61.superiorPosition.holder })}</option><option value="defender">${tx('SR2E.Dialog.Sheet.theTargetHoldsIt', { part: RULES.COMBAT_V61.superiorPosition.against ? ` (+${escHtml(RULES.COMBAT_V61.superiorPosition.against)})` : "" })}</option></select></div>` : ""}` : "";
    // Cyberarms (their own Strength) and vision magnification (v0.29.0).
    // v0.43.0: any weapon can be used with a cyberarm (its Quickness when defaulting; its Strength for Strength-based attacks).
    const arms = (derived.cyber?.limbs ?? []).filter((l: any) => /arm/i.test(l.location));
    const strengthBased = Boolean(w.strengthPower || w.strengthRange);
    const limbRow = arms.length ? `<div class="form-group"><label>${strengthBased ? tx('SR2E.Dialog.Sheet.strikeOrThrowWith') : tx('SR2E.Dialog.Sheet.useWithQuicknessIfDefaulting')}</label><select name="limb"><option value="">${tx('SR2E.Dialog.Sheet.naturalStrengthQuickness', { strengthTotal: escHtml(actor.system.attributes?.strength?.total ?? 0), quicknessTotal: escHtml(actor.system.attributes?.quickness?.total ?? 0) })}</option>
        ${arms.map((l: any) => `<option value="${escHtml(l.id)}" ${l.id === weapon.limbId ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.strengthQuickness', { name: escHtml(l.name), strength: escHtml(l.strength), quickness: escHtml(l.quickness) })}</option>`).join("")}</select></div>` : "";
    // Cyber-eye magnification and an imaging scope (the better counts).
    const eyeMag = Number(derived.cyber?.magnification ?? 0);
    const scopeMag = Number(w.scope ?? 0);
    const magLevel = attackMagnification(scopeMag, eyeMag);
    const magRow = !melee && magLevel > 0 ? `<label class="sr2e-check"><input type="checkbox" name="magnify" checked> ${tx('SR2E.Dialog.Sheet.magnificationRangeBandCloser', { magLevel, part: scopeMag ? tx('SR2E.Dialog.Sheet.scope', { scopeMag, part: eyeMag ? tx('SR2E.Dialog.Sheet.eyes', { eyeMag }) : "" }) : "" })}</label>` : "";
    const standingGrunts = (actor.system.grunts?.size ?? 1) - (actor.system.grunts?.down ?? 0);
    // v0.44.0: grunts on their own tokens attack together too (each from its token).
    const tokenGroup = actor.gruntGroup?.() ?? null;
    const groupRow = standingGrunts > 1 ? `<label class="sr2e-check"><input type="checkbox" name="groupAll" checked> ${tx('SR2E.Dialog.Sheet.theWholeGroupAttacksGruntsOne', { standingGrunts })}</label>`
      : tokenGroup && tokenGroup.standing.length > 1 ? `<label class="sr2e-check"><input type="checkbox" name="groupAll" checked> ${tx('SR2E.Dialog.Sheet.theWholeGroupAttacksTokensOne', { standingLength: escHtml(tokenGroup.standing.length) })}</label>` : "";
    const positionRows = `
        <label class="sr2e-check"><input type="checkbox" name="targetProne" ${here.targetProne ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.targetProne', { sign: tp > 0 ? "+" : "", tp })}</label>
        <label class="sr2e-check"><input type="checkbox" name="attackerProne" ${here.attackerProne ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.attackerProne', { sign: ap > 0 ? "+" : "", ap })}</label>${limbRow}${magRow}`;
    const hints = [
      w.smartgun && !derived.smartlink ? tx('SR2E.Dialog.Sheet.smartgunButNoSmartlinkImplantThe') : "",
      w.smartgun && (derived.cyber?.smartlinkLevel ?? 0) > 1 ? tx('SR2E.Dialog.Sheet.smartlinkInAll', { cyberSmartlinkLevel: derived.cyber.smartlinkLevel, smartlinkModifier: smartlinkModifier(derived.cyber.smartlinkLevel) }) : "",
      !inCombat && fromToken ? tx('SR2E.Dialog.Sheet.noCombatStartedWalkingRunningIs') : "",
      (game.user.targets?.size ?? 0) > 1 && !shotgun && !blast && w.areaKind !== "flame" ? tx('SR2E.Dialog.Sheet.severalTokensAreTargetedThisAttack', { part: modes.includes("FA") ? tx('SR2E.Dialog.Sheet.inFullAutoTheOthersAre') : "" }) : "",
      moved != null && moved > 0 ? tx('SR2E.Dialog.Sheet.movedMThisCombatTurnQuickness', { value: Math.round(moved * 10) / 10, quicknessTotal: actor.system.attributes?.quickness?.total ?? 0, movement }) : "",
      here.light ? tx('SR2E.Dialog.Sheet.lightAtTheTarget', { lightLabels: lightLabels[here.light.light]?.toLowerCase() }) : "",
      melee && here.targetReach ? tx('SR2E.Dialog.Sheet.targetSLongestReach', { hereTargetReach: here.targetReach }) : "",
      shotgun ? tx('SR2E.Dialog.Sheet.shotgunChokeEveryoneInTheOut', { choke: w.choke, shotgunShape: RULES.COMBAT.shotgun.shape }) : "",
      blast ? (() => {
        // v0.79.0 (RULES.DOCS_V79.rangedScatter 'byType', SRII Grenade Range Table): grenades scatter by type, other blasts by range.
        const st = grenadeScatterType({ blastKind: w.blastKind, skill: w.skill, name: weapon.name, thrown: Boolean(w.thrown) });
        const byType = Boolean(st) && RULES.DOCS_V79.rangedScatter.mode === "byType";
        const kind = grenadeKind(w.blastKind).label, dice = scatterDiceV79(st, scatterDiceFor(suggested)), metres = RULES.COMBAT.scatter.metresPerSuccess;
        return byType ? tx('SR2E.App.Sheets.blastScattersByType', { kind, dice, type: st, metres }) : tx('SR2E.App.Sheets.blastScattersAtThisRange', { kind, dice, metres });
      })() : "",
      derived.encumbrance ? tx('SR2E.Dialog.Sheet.armorEncumbranceQuickness', { derivedEncumbrance: derived.encumbrance }) : "",
      actor.isActing?.() && RULES.ACTIONS.enforce !== "off" ? tx('SR2E.Dialog.Sheet.actionsLeftThisPhase', { actionsLeftLabel: actionsLeftLabel(actor.actionsUsed?.() ?? 0) }) : "",
    ].filter(Boolean).map((h) => `<p class="hint">${escHtml(h)}</p>`).join("");
    const visibilityRow = `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.visibility')}</label><select name="visibility">${visOptions.map((v) =>
      `<option value="${escHtml(v.id)}" ${v.id === visFor(here) ? "selected" : ""}>${escHtml(v.label)}${v.value ? ` (+${v.value}${v.using ? `, ${escHtml(v.using)}` : ""})` : v.using ? ` (${escHtml(v.using)})` : ""}</option>`).join("")}</select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.smoke')}</label><select name="smoke">${smokeOptions.map((v) => `<option value="${escHtml(v.id)}" ${v.id === (here.smoke?.kind ?? "none") ? "selected" : ""}>${escHtml(v.label)}${v.value ? ` (+${v.value})` : v.using && v.id !== "none" ? ` (${escHtml(v.using)}: +0)` : ""}</option>`).join("")}</select></div>`;
    const calledRow = `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.calledShot', { value: sit("calledShot")?.value ?? 4 })}</label><select name="calledShot">
        <option value="none">${tx('SR2E.Dialog.Sheet.no')}</option><option value="damage">${tx('SR2E.Dialog.Sheet.forDamage1Level')}</option><option value="armor">${tx('SR2E.Dialog.Sheet.atAGapNoArmor')}</option></select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.calledShotAt')}</label><select name="calledAt"><option value="">${tx('SR2E.Dialog.Sheet.theBody')}</option>${RULES.CYBERWARE.limbs.locations.filter((k) => k !== "other").map((k) => `<option value="${escHtml(k)}">${escHtml(LIMB_LABELS[k] ?? k)}</option>`).join("")}</select></div>
      ${vehiclePartRow()}`;
    // Grenades (v0.43.0): a bounced throw needs no line of sight; a throw can land off the target in a chosen direction.
    const bounceRows = blast ? `<label class="sr2e-check"><input type="checkbox" name="bounce"> ${tx('SR2E.Dialog.Sheet.bounceItOffAWallOr', { bounceTn: RULES.GEAR.grenades.bounce.tn, bounceExtraDice: RULES.GEAR.grenades.bounce.extraDice })}</label>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.landItOffTheTargetUp', { grenadesAimOffMetres: RULES.GEAR.grenades.aimOffMetres })}</label><input name="aimOff" type="number" value="0" min="0" max="${RULES.GEAR.grenades.aimOffMetres}"> ${tx('SR2E.Dialog.Sheet.mToThe')} <select name="aimBearing">${BEARINGS.map((b) => `<option value="${b.deg}">${escHtml(b.label)}</option>`).join("")}</select></div>
        ${w.fuse ? `<p class="hint">${w.fuse === "airburst" ? tx('SR2E.Dialog.Sheet.airburstScatterCanTBeThrown', { airburstScatterFactor: RULES.GEAR.grenades.airburst.scatterFactor }) : tx('SR2E.Dialog.Sheet.impactFuseGoesOffWhereIt')}</p>` : ""}
        ${w.smartGrenade ? `<p class="hint">${RULES.GEAR.grenades.smart.needsSmartlink ? tx('SR2E.Dialog.Sheet.smartGrenadeWithSmartlinkTicked', { smartMetresPerSuccess: RULES.GEAR.grenades.smart.metresPerSuccess }) : tx('SR2E.Dialog.Sheet.smartGrenadeMMoreScatterPer', { smartMetresPerSuccess: RULES.GEAR.grenades.smart.metresPerSuccess })}</p>` : ""}` : "";
    // v0.72.0 (O7): indirect fire for mortars and lobbing launchers (RULES.COMBAT_V72.indirect).
    const IND = RULES.COMBAT_V72.indirect;
    const indirectRows = blast && canFireIndirect({ blast: Boolean(blast), indirect: Boolean((w as any).indirect), skill: w.skill, melee }) ? `
        <label class="sr2e-check"><input type="checkbox" name="indirect"> ${tx('SR2E.Dialog.Sheet.indirectFireNoLineOfSight')}</label>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spotter')}</label><select name="spotterLink">
          <option value="none">${tx('SR2E.Dialog.Sheet.noneBlind', { part: IND.noSpotter === "block" ? tx('SR2E.Dialog.Sheet.notAllowed') : `, +${RULES.COMBAT.cover.blindFireTn}` })}</option>
          <option value="voice">${tx('SR2E.Dialog.Sheet.byVoiceOrRadio', { linkTnVoice: IND.linkTn.voice })}</option>
          <option value="datalink">${tx('SR2E.Dialog.Sheet.byDatalink', { linkTnDatalink: IND.linkTn.datalink })}</option>
          <option value="designator">${tx('SR2E.Dialog.Sheet.laserDesignator', { linkTnDesignator: IND.linkTn.designator })}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spotterSPerceptionSuccesses')}</label><input name="spotterSuccesses" type="number" value="0" min="0"></div>` : "";

    const showCheck = (form: HTMLFormElement | null, c: RangeCheck, h: typeof here) => {
      if (!form) return;
      const box = form.querySelector<HTMLElement>(".sr2e-distance");
      if (box) box.dataset["status"] = c.status;
      const note = form.querySelector<HTMLElement>(".sr2e-range-note");
      if (note) note.textContent = c.note;
      const cn = form.querySelector<HTMLElement>(".sr2e-cover-note");
      if (cn) cn.textContent = coverNote(h);
      const anyway = form.querySelector<HTMLElement>(".sr2e-anyway");
      if (anyway) anyway.hidden = !(c.status === "out" && c.blocks);
      const el = form.elements as any;
      if (el.range && c.band) el.range.value = c.band;
      if (el["sit-partialCover"]) el["sit-partialCover"].checked = h.cover?.cover === "partial";
      if (el.visibility) el.visibility.value = visFor(h);
      if (el.smoke) el.smoke.value = h.smoke?.kind ?? "none";
      if (el.barrier) el.barrier.value = h.barrierArmor;
      if (el.targetProne) el.targetProne.checked = h.targetProne;
      if (el.friends) el.friends.value = h.friends;
    };

    // Reading the form (the dialog's OK, the live preview and Shift-click all use this).
    const readChoice = (form: HTMLFormElement) => {
      const el: any = form.elements;
      return {
        targetUuid: (el.target?.value as string) || null,
        range: (el.range?.value as RangeBand | undefined) ?? undefined,
        mode: (el.mode?.value as FiringMode | undefined) ?? undefined,
        faRounds: Number(el.faRounds?.value) || RULES.FIRING.fullAutoMin,
        earlier: Math.max(0, Math.floor(Number(el.earlier?.value) || 0)),
        situational: RULES.SITUATIONAL_MODIFIERS.filter((m) => el[`sit-${m.id}`]?.checked).map((m) => m.id),
        visibility: (el.visibility?.value as string) || "normal",
        smoke: ((el.smoke?.value as string) || "none") as "none" | "smoke" | "thermal" | "heavySmoke" | "heavyThermal",
        calledShot: ((el.calledShot?.value as string) || "none") as CalledShotEffect,
        ammoType: (el.ammoType?.value as string | undefined) ?? undefined,
        spread: Array.from(form.querySelectorAll('input[name="spreadTarget"]:checked')).map((i: any) => i.value as string),
        barrier: Math.max(0, Math.floor(Number(el.barrier?.value) || 0)),
        targetProne: Boolean(el.targetProne?.checked), attackerProne: Boolean(el.attackerProne?.checked),
        charging: Boolean(el.charging?.checked), subdue: Boolean(el.subdue?.checked), unaware: Boolean(el.unaware?.checked),
        friends: Math.max(0, Math.floor(Number(el.friends?.value) || 0)),
        superior: ((el.superior?.value as string) || "") as "" | "attacker" | "defender",
        mod: Number(el.mod?.value) || 0,
        pool: Math.max(0, Math.min(left, Math.floor(Number(el.pool?.value) || 0))),
        useSpec: Boolean(el.useSpec?.checked),
        useConc: Boolean(el.useConc?.checked),
        related: (el.related?.value as string) || null,
        anyway: Boolean(el.anyway?.checked),
        twice: Boolean(el.twice?.checked),
        limb: (el.limb?.value as string | undefined) ?? (weapon.limbId || ""),
        groupAll: Boolean(el.groupAll?.checked),
        magnify: Boolean(el.magnify?.checked),
        calledAt: (el.calledAt?.value as string) || "",
        vehiclePart: (el.vehiclePart?.value as string) || "",
        bounce: Boolean(el.bounce?.checked),
        indirect: Boolean(el.indirect?.checked), spotterLink: String(el.spotterLink?.value || "none"), spotterSuccesses: Math.max(0, Number(el.spotterSuccesses?.value) || 0),
        aimOff: aimOffMetres(Number(el.aimOff?.value) || 0),
        aimBearing: Number(el.aimBearing?.value) || 0,
        exclude: excludedOf(form),
      };
    };
    type Choice = ReturnType<typeof readChoice>;

    // Modifiers the dialog works out: visibility (light and vision), smoke, prone, allies, charging.
    const visMod = (v: string) => {
      const o = visOptions.find((x) => x.id === v);
      return o && o.value ? [{ label: `${o.label}${o.using ? ` (${o.using})` : ""}`, value: o.value }] : [];
    };
    // v0.50.0: the visibility group goes to planAttack as `sight`, so Blinded, blind fire and weather count once.
    const smokeMod = (id: string) => {
      const sm = smokeOptions.find((x) => x.id === id);
      return sm && sm.value ? { label: `${sm.label}${sm.using ? ` (${sm.using})` : ""}`, value: sm.value } : null;
    };
    const sightFor = (visId: string, smokeId: string, h: typeof here) => ({
      light: visId === "blind" ? null : visMod(visId)[0] ?? null,
      blindFire: visId === "blind" ? (h.conceal?.blind && h.cover?.cover !== "blind" ? { label: tx('SR2E.Card.Mod.canTSeeTheTarget', { label: h.conceal.label }), value: RULES.COMBAT.cover.blindFireTn } : visMod("blind")[0] ?? null) : null,
      smoke: smokeMod(smokeId),
      concealment: h.conceal?.modifier ?? null,
    });
    const buildOpts = (c: Choice) => {
      const positionMods = (targetProne: boolean) => [
        ...proneModifiers({ melee, targetProne, attackerProne: c.attackerProne }),
        ...(melee ? [...friendsModifiers(c.friends), ...chargeModifiers(c.charging), ...superiorPositionModifiers(c.superior, "attacker"), ...U80C.cbtSubdueMods(c.subdue)] : []),
      ];
      const tail = [...(c.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: c.mod }] : [])];
      // A bounced throw replaces blind fire (it needs no line of sight).
      const vis = (c.bounce || c.indirect) && c.visibility === "blind" ? (here.light?.light ?? "normal") : c.visibility;
      const common = {
        useSpecialization: c.useSpec,
        useConcentration: c.useConc,
        relatedSkillId: c.related,
        ...(c.range ? { range: c.range } : {}),
        ...(c.mode ? { mode: c.mode } : {}),
        fullAutoRounds: c.faRounds,
        situational: c.situational,
        visibility: "normal",
        sight: sightFor(vis, c.smoke, here),
        calledShot: c.calledShot,
        ...(c.ammoType ? { ammoType: c.ammoType } : {}),
        poolDice: c.pool,
        ...(melee ? { targetReach: here.targetReach, subdue: c.subdue, ...(c.superior ? { superior: c.superior } : {}) } : {}),
        ...(melee && U80C.cbtChargePower(c.charging) ? { chargePower80: U80C.cbtChargePower(c.charging) } : {}),
        ...(c.unaware ? { unaware: true } : {}),
        limbId: c.limb || null,
        magnify: c.magnify,
        ...(c.calledAt ? { calledLocation: c.calledAt } : {}),
        ...vehiclePartOpts(c.vehiclePart),
        ...(blast && c.bounce ? { bounce: true } : {}),
        ...(blast && c.indirect ? { indirect: { link: c.spotterLink as any, spotterSuccesses: c.spotterSuccesses } } : {}),
        ...(c.exclude.length ? { exclude: c.exclude } : {}),
      };
      return { common, tail, positionMods, otherMods: [...positionMods(c.targetProne), ...tail] };
    };

    // Remembered choices for this weapon (mode, full-auto rounds, pool dice, specialization, fire twice, subdue).
    const prefsAll = (actor.getFlag(SYSTEM.id, "attackPrefs") ?? {}) as Record<string, any>;
    // A firing-mode button on the weapon row picks the mode (v0.37.0).
    const prefs = { ...(prefsAll[weapon.id] ?? {}), ...(target.dataset["mode"] ? { mode: target.dataset["mode"] } : {}) };
    const applyPrefs = (form: HTMLFormElement) => {
      const el: any = form.elements;
      if (prefs.mode && el.mode && [...el.mode.options].some((o: any) => o.value === prefs.mode)) el.mode.value = prefs.mode;
      if (prefs.faRounds && el.faRounds) el.faRounds.value = prefs.faRounds;
      if (prefs.pool && el.pool) el.pool.value = Math.min(left, prefs.pool);
      if (prefs.useSpec !== undefined && el.useSpec) el.useSpec.checked = Boolean(prefs.useSpec);
      // v0.71.0 (R16): a remembered "fire twice" isn't used by a Shift-click quick attack (it would spend two actions unasked).
      if (el.twice) el.twice.checked = Boolean(prefs.twice) && !quickRollArmed();
      if (el.subdue) el.subdue.checked = Boolean(prefs.subdue);
    };

    // Live preview: the final TN with every modifier, the dice, the damage; auto-detected modifiers marked.
    // v0.89.5: the rows found by themselves, by their keys (`modKey`: the id, else the label) and their labels.
    const autoLabels = () => {
      const set = new Set<string>();
      const row = (m: any) => { if (m) { set.add(modKey(m)); if (m.label) set.add(String(m.label)); } };
      if (here.cover?.cover === "partial") row(sit("partialCover"));
      if (smartReady) row(sit("smartlink"));
      if (laserReadyFor(latest)) row(sit("laserSight"));
      if (moveTicks && movement === "walking") row(sit("attackerWalking"));
      if (moveTicks && movement === "running") row(sit("attackerRunning"));
      // v0.50.0: weather, concealment, blindness and the attacker's own penalties are found by themselves too.
      for (const m of actor.weatherMods?.(vision) ?? []) row(m);
      if (here.conceal?.modifier) row(here.conceal.modifier);
      if (here.conceal?.blind) set.add(tx('SR2E.Card.Mod.canTSeeTheTarget', { label: here.conceal.label }));
      for (const m of actor.previewModifiers?.() ?? []) row(m);
      for (const m of actor.blindMods?.("attack") ?? []) row(m);
      const v = visOptions.find((x) => x.id === visFor(here));
      if (v) set.add(`${v.label}${v.using ? ` (${v.using})` : ""}`);
      const sm = here.smoke?.kind && here.smoke.kind !== "none" ? smokeOptions.find((x) => x.id === here.smoke.kind) : null;
      if (sm) set.add(`${sm.label}${sm.using ? ` (${sm.using})` : ""}`);
      if (here.targetProne) { set.add("#targetProne"); set.add(tx('SR2E.Card.Mod.targetProne')); }
      if (here.attackerProne) { set.add("#attackerProne"); set.add(tx('SR2E.Card.Mod.attackerProne')); }
      if (here.friends) set.add(tx('SR2E.Card.Mod.friendsInMelee', { n: Math.min(RULES.COMBAT.friendsInMelee.max, here.friends) }));
      if (movement === "running" && melee) { set.add("#charging"); set.add(tx('SR2E.Card.Mod.charging')); }
      return set;
    };
    const updatePreview = (form: HTMLFormElement | null) => {
      const box = form?.querySelector<HTMLElement>(".sr2e-preview");
      if (!form || !box) return;
      try {
        const c = readChoice(form);
        const o = buildOpts(c);
        const pv = actor.previewAttack(weapon, { ...o.common, targetUuid: c.targetUuid, earlierRoundsThisPhase: c.earlier, modifiers: o.otherMods, ...(melee ? {} : { barrierArmor: c.barrier }) });
        const auto = autoLabels();
        // v0.50.0: found-by-themselves modifiers can be switched off for this attack.
        const excluded: Set<string> = (form as any).sr2eExcluded ?? new Set<string>();
        const rows = pv.modifiers.map((m: any) => {
          const v = `${m.value >= 0 ? "+" : ""}${m.value}`;
          if (!auto.has(modKey(m)) && !auto.has(m.label)) return `<li>${escHtml(m.label)} ${escHtml(v)}</li>`;
          const off = modIn(excluded, m);
          return `<li class="auto${off ? " off" : ""}"><label class="sr2e-auto-mod"><input type="checkbox" data-sr2e-auto="${escHtml(modKey(m))}" ${off ? "" : "checked"}> ${escHtml(m.label)} ${escHtml(v)}</label></li>`;
        }).join("");
        const tn = excluded.size ? Math.max(RULES.MIN_TARGET_NUMBER, pv.base + pv.modifiers.filter((m: any) => !modIn(excluded, m)).reduce((n: number, m: any) => n + m.value, 0)) : pv.tn;
        const dice = escHtml(pv.dice), pool = escHtml(pv.pool), power = escHtml(pv.power), level = escHtml(pv.level), damageType = escHtml(pv.damageType);
        const pvLine = pv.pool
          ? (c.twice ? tx('SR2E.App.Sheets.previewDicePoolTwice', { dice, pool, power, level, damageType }) : tx('SR2E.App.Sheets.previewDicePool', { dice, pool, power, level, damageType }))
          : (c.twice ? tx('SR2E.App.Sheets.previewDiceTwice', { dice, power, level, damageType }) : tx('SR2E.App.Sheets.previewDice', { dice, power, level, damageType }));
        box.innerHTML = `<strong class="sr2e-tn">${tx('SR2E.App.Sheets.tnValue', { tn: escHtml(tn) })}</strong>${pvLine}
          <ul><li>${escHtml(pv.baseLabel)} ${escHtml(pv.base)}</li>${rows}</ul>${pv.ammoShort ? `<p class="sr2e-warn">${escHtml(pv.ammoShort)}</p>` : ""}`;
      } catch (err) {
        box.textContent = "";
        console.warn(`${SYSTEM.LOG.HEAD}Attack preview failed`, err);
      }
    };

    const content = `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.target')}</label><select name="target">${targetOptions}</select></div>
        ${rangeRow}
        ${distanceRow}
        ${fireRows}
        ${groupRow}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.combatPoolDiceLeft', { left })}</label><input name="pool" type="number" value="0" min="0" max="${left}"></div>
        <div class="sr2e-preview" aria-live="polite"></div>
        <details class="sr2e-more"><summary>${tx('SR2E.Dialog.Sheet.moreOptions')}</summary>
          ${visibilityRow}
          ${calledRow}
          ${skillChoiceRows(actor, actor.findSkill(w.skill), specializationMatches(actor.findSkill(w.skill)?.system.specialization ?? "", w.specialization ?? ""), specializationMatches(actor.findSkill(w.skill)?.system.concentration ?? "", w.specialization ?? ""))}
          <fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Sheet.situational')}</legend>${situationalRows}${positionRows}${meleeRows}${unawareRow}${bounceRows}${indirectRows}</fieldset>
          <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        </details>
        ${hints}`;

    // Shift-click: attack straight away with the dialog's defaults (and remembered choices).
    const quick = Boolean((_event as MouseEvent | undefined)?.shiftKey);
    let choice: Choice | null = null;
    if (quick) {
      // v0.81.0 (SEC2-2): parse inside a <template>, whose content is inert (an <img onerror> in a name never
      // loads or runs there); the form is only read for its defaults, never shown.
      const tpl = document.createElement("template");
      tpl.innerHTML = `<form>${content}</form>`;
      const form = tpl.content.querySelector("form") as HTMLFormElement;
      applyPrefs(form);
      choice = readChoice(form);
    } else {
      choice = await foundry.applications.api.DialogV2.prompt({
        window: { title: tx('SR2E.Dialog.Sheet.attack2', { weaponName: weapon.name, ammoNote }) },
        position: { width: 480 },
        content,
        ok: { label: tx('SR2E.Dialog.Sheet.attack'), callback: (_e: Event, button: any) => readChoice(button.form) },
        // Re-measure (distance, cover, light, barriers, prone, allies) whenever another target is picked; keep the preview live.
        render: (_e: Event, dialog: any) => {
          const root: HTMLElement | null = dialog?.element ?? null;
          const form = root?.querySelector("form") ?? null;
          if (!form) return;
          applyPrefs(form);
          const select = form.querySelector<HTMLSelectElement>('select[name="target"]');
          select?.addEventListener("change", () => {
            latest = check(select.value || null);
            here = situationFor(select.value || null);
            const laser = form.querySelector<HTMLInputElement>('input[name="sit-laserSight"]');
            if (laser && laserFits && !laser.dataset["touched"]) laser.checked = laserReadyFor(latest);
            showCheck(form, latest, here);
            updatePreview(form);
          });
          form.querySelector<HTMLInputElement>('input[name="sit-laserSight"]')?.addEventListener("change", (ev) => { (ev.target as HTMLElement).dataset["touched"] = "1"; });
          (form as any).sr2eExcluded = new Set<string>();
          form.addEventListener("input", (ev) => { if (!(ev.target as HTMLElement)?.dataset?.["sr2eAuto"]) updatePreview(form); });
          form.addEventListener("change", (ev) => {
            const t = ev.target as HTMLInputElement | null;
            const k = t?.dataset?.["sr2eAuto"];
            if (k != null) { if (t!.checked) (form as any).sr2eExcluded.delete(k); else (form as any).sr2eExcluded.add(k); }
            updatePreview(form);
          });
          updatePreview(form);
        },
        rejectClose: false,
      } as any);
    }
    if (!choice) return;
    // Remember this weapon's choices for next time.
    // v0.68.0: and which weapon was used last (the status strip shows it as the readied weapon).
    await actor.update({ [`flags.${SYSTEM.id}.attackPrefs`]: { ...prefsAll, [weapon.id]: { mode: choice.mode, faRounds: choice.faRounds, pool: choice.pool, useSpec: choice.useSpec, twice: choice.twice, subdue: choice.subdue } },
      ...(weapon.id && actor.items.get?.(weapon.id) ? { [`flags.${SYSTEM.id}.lastWeapon`]: weapon.id } : {}) }, { sr2eNoAdvance: true });
    // The dialog may have closed before a change event fired: check the final target again.
    latest = check(choice.targetUuid);
    here = situationFor(choice.targetUuid);
    if (latest.status === "out" && latest.blocks && !choice.anyway) {
      ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.tickAttackAnywayToAttackRegardless', { weaponName: escHtml(weapon.name), latestNote: escHtml(latest.note) }));
      return;
    }
    // The action this attack takes (RULES.ACTIONS.costs).
    const mode0 = choice.mode ?? modes[0] ?? "SS";
    const actKind = melee ? "melee" : blast || w.strengthRange ? "throw" : `fire:${mode0}`;
    if (!(await actor.useAction(actKind, tx('SR2E.Card.Sheet.attackingWith', { weaponName: weapon.name })))) return;
    // v0.61.0: an invisible target: the attacker resists the spell first (once per spell). v0.81.0 (S-5, R2-REST 4):
    // only once the attack goes ahead (not when the dialog is cancelled), and for the final target, whether it was
    // targeted before the dialog opened or picked in it. v0.81.1 (S2-4): and only after the range check and the action
    // are past, so a refused attack makes no roll. The preview showed the target unseen; if the roll sees through and
    // the visibility was left at what was detected, it follows the new sight.
    if (choice.targetUuid && typeof actor.seeThroughInvisibility === "function") {
      const picked: any = fromUuidSync(choice.targetUuid);
      if (picked) {
        const shown = situationFor(choice.targetUuid);
        await actor.seeThroughInvisibility(picked);
        const now = situationFor(choice.targetUuid);
        if (shown.conceal?.blind && !now.conceal?.blind && choice.visibility === visFor(shown)) choice.visibility = visFor(now);
        here = now;
      }
    }
    // v0.71.0 (R16): only semi-automatic weapons fire twice in a phase (RULES.FIXES_V71.fireTwice; 'SA+SS' the old way).
    const twice = choice.twice && !melee && !blast && twiceModes.includes(mode0);

    const { common, tail, positionMods, otherMods } = buildOpts(choice);
    const distance = { ...(latest.metres != null ? { measuredMetres: latest.metres } : {}), ...(latest.status === "out" ? { outOfRange: true } : {}), ...((latest as any).distanceStrike ? { distanceStrike: true } : {}) };

    // Blast weapons: thrown or fired at the target's token; the Detonate button on the card scatters it.
    if (blast) {
      const to = choice.targetUuid ? targetTokens.get(choice.targetUuid) : null;
      if (!to) {
        ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.targetATokenOnThisScene', { weaponName: escHtml(weapon.name) }));
        return;
      }
      // Aimed off the target (v0.43.0): that many metres toward the chosen direction.
      const off = choice.aimOff > 0 ? scatterPoint(to.center, choice.aimOff, choice.aimBearing) : to.center;
      const point = { x: off.x, y: off.y, elevation: Number(to.document?.elevation) || 0 };
      const bearing = BEARINGS.find((b) => b.deg === choice!.aimBearing)?.label ?? "";
      await actor.attackWith(weapon, { ...common, ...distance, earlierRoundsThisPhase: choice.earlier, modifiers: otherMods, blastPoint: point,
        ...(choice.aimOff > 0 ? { note: tx('SR2E.App.Sheets.aimedMOf', { metres: choice.aimOff, bearing, name: to.name }) } : {}) });
      return;
    }

    // Flamethrowers (v0.37.0): everyone in a narrow cone out to the target, at full Power.
    if (w.areaKind === "flame" && choice.targetUuid) {
      const to = targetTokens.get(choice.targetUuid);
      const inCone = to && fromToken ? tokensInCone(fromToken, to, RULES.COMBAT.flame.choke) : [];
      const hits = [{ targetUuid: choice.targetUuid }, ...inCone.filter((c) => c.token.actor?.uuid && c.token.actor.uuid !== choice.targetUuid).map((c) => ({ targetUuid: c.token.actor.uuid as string }))];
      await actor.attackWith(weapon, {
        ...common, ...distance, earlierRoundsThisPhase: choice.earlier, modifiers: otherMods, hits,
        ...(hits.length > 1 ? { note: tCount(hits.length, 'SR2E.App.Sheets.caughtInTheFlames') } : {}),
      });
      return;
    }

    // Shotguns: everyone in the cone (or circle) out to the target, Power reduced by the spread at their distance.
    if (shotgun && U80C.cbtShotgunSpreads(choice.ammoType ?? w.ammoType) && choice.targetUuid && latest.metres != null) {
      const to = targetTokens.get(choice.targetUuid);
      const choke = w.choke ?? 1;
      const atTarget = U80C.cbtShotgunSpread(shotgunSpread(latest.metres, choke, 0), latest.metres, choke, 0);
      const inSpread = !to ? [] : RULES.COMBAT.shotgun.shape === "cone" && fromToken
        ? tokensInCone(fromToken, to, choke, RULES.URR_V80.cbtShotgun === "urr" ? (m: number) => U80C.cbtShotgunSpread(shotgunSpread(m, choke, 0), m, choke, 0).width : undefined)
        : tokensNear(to.center, atTarget.width / 2).filter((c) => c.token !== fromToken).map((c) => ({ token: c.token, metres: latest.metres as number }));
      const hits = [{ targetUuid: choice.targetUuid, powerDelta: -atTarget.loss },
        ...inSpread.filter((c) => c.token.actor?.uuid !== choice.targetUuid).map((c) => ({ targetUuid: c.token.actor.uuid as string, powerDelta: -U80C.cbtShotgunSpread(shotgunSpread(c.metres, choke, 0), c.metres, choke, 0).loss }))];
      await actor.attackWith(weapon, {
        ...common, ...distance, earlierRoundsThisPhase: choice.earlier, barrierArmor: choice.barrier,
        note: atTarget.loss
          ? (hits.length > 1 ? tCount(hits.length, 'SR2E.App.Sheets.spreadMPowerTargets', { width: atTarget.width, loss: atTarget.loss }) : tx('SR2E.App.Sheets.spreadMPower', { width: atTarget.width, loss: atTarget.loss }))
          : (hits.length > 1 ? tCount(hits.length, 'SR2E.App.Sheets.spreadMTargets', { width: atTarget.width }) : tx('SR2E.App.Sheets.spreadM', { width: atTarget.width })),
        // v0.55.0: a wider spread can make the shot easier as well (RULES.COMBAT.shotgunTnPerMetre; 0 by default).
        modifiers: [...otherMods, ...U80C.cbtShotgunTn(shotgunTnModifier(atTarget.width), latest.metres, choke)], hits,
      });
      return;
    }

    // Full auto spread over several targets: rounds wasted walking between them, the rest split; recoil builds up.
    const spread = choice.mode === "FA" ? choice.spread.filter((u: string) => u !== choice.targetUuid) : [];
    if (spread.length && choice.targetUuid) {
      const all = [choice.targetUuid, ...spread];
      const rounds = Math.min(RULES.FIRING.fullAutoMax, Math.max(RULES.FIRING.fullAutoMin, choice.faRounds));
      if (w.ammoMax > 0 && w.ammo < rounds) {
        ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.roundsLeftNeededReload', { weaponName: escHtml(weapon.name), wAmmo: escHtml(w.ammo), rounds }));
        return;
      }
      const gaps = all.slice(1).map((u, i) => {
        const a = targetTokens.get(all[i]!), b = targetTokens.get(u);
        return a && b ? measureTokens(a, b)?.metres ?? 0 : 0;
      });
      const waste = wastedRounds(gaps);
      if (rounds - waste < all.length) {
        ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.walkingFireBetweenThoseTargetsWastes', { weaponName: escHtml(weapon.name), waste, rounds }));
        return;
      }
      const split = splitRounds(rounds - waste, all.length);
      let earlier = choice.earlier;
      for (let i = 0; i < all.length; i++) {
        const c = check(all[i]!);
        const h = i === 0 ? here : situationFor(all[i]!);
        // The other targets get their own range band, cover, light, smoke, laser, prone and barrier checks (v0.50.0: range, smoke and laser too).
        let situational = choice.situational as string[];
        let sight = common.sight;
        if (i > 0) {
          situational = situational.filter((sid) => sid !== "partialCover" && sid !== "laserSight")
            .concat(h.cover?.cover === "partial" ? ["partialCover"] : [], choice.situational.includes("laserSight") && laserReadyFor(c) ? ["laserSight"] : []);
          sight = sightFor(visFor(h), h.smoke?.kind ?? "none", h);
        }
        await actor.attackWith(weapon, {
          ...common, sight, ...(i > 0 && c.band ? { range: c.band } : {}), situational, targetUuid: all[i], rounds: split[i], spreadExtraTargets: all.length - 1, earlierRoundsThisPhase: earlier,
          barrierArmor: i === 0 ? choice.barrier : h.barrierArmor,
          ...(c.metres != null ? { measuredMetres: c.metres } : {}),
          // Rounds wasted walking the fire to the next target: ammo and recoil, no damage.
          ...(i > 0 ? { wastedRounds: wastedRounds([gaps[i - 1] ?? 0]) } : {}),
          modifiers: [...positionMods(i === 0 ? choice.targetProne : h.targetProne), ...tail],
        });
        earlier += split[i]! + (i > 0 ? wastedRounds([gaps[i - 1] ?? 0]) : 0);
      }
      return;
    }

    const single = {
      ...common, ...distance, targetUuid: choice.targetUuid, earlierRoundsThisPhase: choice.earlier, modifiers: otherMods,
      ...(melee ? {} : { barrierArmor: choice.barrier }),
    };
    // A grunt group: every standing grunt makes the attack (v0.32.0).
    if (choice.groupAll && standingGrunts > 1 && typeof actor.gruntAttack === "function") await actor.gruntAttack(weapon, single);
    else if (choice.groupAll && tokenGroup && tokenGroup.standing.length > 1) await actor.groupTokenAttack(weapon.name, single);
    else await actor.attackWith(weapon, single);
    // A second semi-automatic shot: another simple action; the first round counts for recoil.
    if (twice && (await actor.useAction(actKind, tx('SR2E.Card.Sheet.aSecondShotWith', { weaponName: weapon.name })))) {
      await actor.attackWith(actor.items.get(weapon.id) ?? weapon, {
        ...common, ...distance, targetUuid: choice.targetUuid, earlierRoundsThisPhase: choice.earlier + 1, modifiers: otherMods,
        barrierArmor: choice.barrier, note: tx('SR2E.App.Sheets.secondShot'),
      });
    }
  }

  /** First aid: this character treats a patient (themselves, the targeted token, or anyone on the scene). */
  static async #onFirstAid(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const targeted: any = game.user.targets?.first?.()?.actor ?? null;
    const others: any[] = [];
    try { for (const t of canvas?.tokens?.placeables ?? []) if (t.actor && t.actor !== actor && ["character", "npc"].includes(t.actor.type) && !others.includes(t.actor)) others.push(t.actor); } catch { /* no canvas */ }
    const patients = [actor, ...(targeted && !others.includes(targeted) && targeted !== actor ? [targeted] : []), ...others];
    const kits = [...actor.items].filter((i: any) => i.type === "gear" && (i.system.medkitRating ?? 0) > 0 && isCarried(i));
    const row = (p: any) => {
      const m = p.system.monitor;
      return `<option value="${escHtml(p.uuid)}" ${p === (targeted ?? actor) ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.physicalStun', { part: p === actor ? tx('SR2E.Dialog.Sheet.self', { name: escHtml(p.name) }) : escHtml(p.name), physical: escHtml(m.physical), stun: escHtml(m.stun), part2: p.system.derived?.status !== "ok" ? `, ${escHtml(p.system.derived.status)}` : "" })}</option>`;
    };
    const f = RULES.HEALING.firstAid;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.firstAidBy', { actorName: actor.name }) },
      position: { width: 440 },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.patient')}</label><select name="patient">${patients.map(row).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.track2__monitor')}</label><select name="track"><option value="physical">${tx('SR2E.Dialog.Sheet.physical')}</option><option value="stun">${tx('SR2E.Dialog.Sheet.stun')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.medkit')}</label><select name="kit"><option value="">${tx('SR2E.Dialog.Sheet.none3')}</option>${kits.map((k: any) => `<option value="${escHtml(k.id)}">${tx('SR2E.Dialog.Sheet.rating6', { name: escHtml(k.name), medkitRating: escHtml(k.system.medkitRating) })}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.combatPoolDiceLeft2', { derivedCombatPoolLeft: escHtml(actor.system.derived.combatPoolLeft) })}</label><input name="pool" type="number" value="0" min="0"></div>
        ${RULES.DOCS_V79.firstAidMods === "table" ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.conditions')}</label><select name="conditions"><option value="normal">${tx('SR2E.Dialog.Sheet.normal')}</option><option value="bad">${tx('SR2E.Dialog.Sheet.bad1')}</option><option value="terrible">${tx('SR2E.Dialog.Sheet.terrible3')}</option></select></div>
        <label class="sr2e-check"><input type="checkbox" name="magician" checked> ${tx('SR2E.Dialog.Sheet.allow2IfThePatientIs')}</label>` : ""}
        <label class="sr2e-check"><input type="checkbox" name="late"> ${tx('SR2E.Dialog.Sheet.moreThanHAfterTheInjury', { windowHours: f.windowHours })}</label>
        <p class="hint">${tx('SR2E.Dialog.Sheet.orAt4VsTnBy', { skill: f.skill, fallbackAttribute: f.fallbackAttribute, tnByLevel: f.tnByLevel.L, tnByLevelM: f.tnByLevel.M, tnByLevelS: f.tnByLevel.S, tnByLevelD: f.tnByLevel.D, part: RULES.DOCS_V79.firstAidMods === "table" ? tx('SR2E.Dialog.Sheet.noMedkit4PatientIsA') : tx('SR2E.Dialog.Sheet.theMedkitSRatingAsDice') })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.treat'), callback: (_e: Event, b: any) => ({ patient: b.form.elements.patient.value as string, track: b.form.elements.track.value as "physical" | "stun", kit: (b.form.elements.kit.value as string) || null, pool: Math.max(0, Math.floor(Number(b.form.elements.pool.value) || 0)), late: Boolean(b.form.elements.late.checked), conditions: (b.form.elements.conditions?.value ?? "normal") as "normal" | "bad" | "terrible", applyMagician: b.form.elements.magician ? Boolean(b.form.elements.magician.checked) : true }) },
      rejectClose: false,
    });
    if (!choice) return;
    const patient: any = await fromUuid(choice.patient);
    if (!patient) return;
    if (!(await actor.useAction("firstAid", tx('SR2E.Card.Sheet.firstAid')))) return;
    await actor.firstAid(patient, { track: choice.track, medkitId: choice.kit, poolDice: choice.pool, ignoreWindow: choice.late, conditions: choice.conditions, applyMagician: choice.applyMagician });
  }

  /** Natural healing after rest. */
  static async #onNaturalHeal(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const n = RULES.HEALING.natural;
    const m = actor.system.monitor;
    const lvl = (b: number) => woundLevel(b) ?? "none";
    const homes: any[] = actor.homeSafehouses?.() ?? [];
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.restAndHeal', { actorName: actor.name }) },
      position: { width: 420 },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.track2__monitor')}</label><select name="track">
          <option value="stun" ${m.stun > 0 ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.stunBoxes', { stun: escHtml(m.stun), lvl: lvl(m.stun) })}</option>
          <option value="physical" ${m.stun <= 0 && m.physical > 0 ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.physicalBoxes', { physical: escHtml(m.physical), lvl: lvl(m.physical) })}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.hoursOfRest')}</label><input name="hours" type="number" value="${m.stun > 0 ? 1 : 24}" min="0" step="0.5"></div>
        ${(() => {
          // v0.79.0 (RULES.DOCS_V79.doctoring 'table'): Physical healing takes the Doctoring Table, Stun keeps the care rows;
          // with both, the dialog shows a select for each and uses the one for the chosen track.
          const opts = (list: Array<{ id: string; label: string; tn: number }>) => list.map((c) => `<option value="${escHtml(c.id)}">${escHtml(c.label)}${c.tn ? ` (${c.tn > 0 ? "+" : ""}${c.tn})` : ""}${(RULES.HEALTH.careCosts as Record<string, number>)[c.id] ? tx('SR2E.Dialog.Sheet.day2', { healthCareCosts: (RULES.HEALTH.careCosts as Record<string, number>)[c.id] }) : ""}</option>`).join("");
          const doc = doctoringCareOptions();
          return doc
            ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.careStun')}</label><select name="care">${opts(n.care as any)}</select></div>
               <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.carePhysicalDoctoringTable')}</label><select name="carePhysical">${opts(doc)}</select></div>`
            : `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.care')}</label><select name="care">${opts(n.care as any)}</select></div>`;
        })()}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.payForHospitalCare')}</label><input name="pay" type="checkbox" checked></div>
        ${homes.length ? `<p class="hint">${tx('SR2E.Dialog.Sheet.restingAtHomeCountsWhenIt', { homes: homes.map((h: any) => `${escHtml(h.name)} (${escHtml(h.comfort)}${h.medical ? `, medical ${escHtml(h.medical)}` : ""})`).join(", "), lifestyleLevel: escHtml(actor.system.lifestyle?.level ?? tx('SR2E.Dialog.Sheet.low')) })}</p>` : ""}
        <p class="hint">${RULES.DOCS_V79.healing === "stages"
          ? tx('SR2E.Dialog.Sheet.stunVsTnByTheWound', { attribute: escHtml(cap(n.attribute)), tnByLevel: n.tnByLevel.L, tnByLevelD: n.tnByLevel.D, periodHoursStun: n.periodHours.stun, healingStagesTnByLevel: RULES.DOCS_V79.healingStages.tnByLevel.L, tnByLevelM: RULES.DOCS_V79.healingStages.tnByLevel.M, tnByLevelS: RULES.DOCS_V79.healingStages.tnByLevel.S, tnByLevelD2: RULES.DOCS_V79.healingStages.tnByLevel.D, part: RULES.DOCS_V79.doctoring === "table" ? tx('SR2E.Dialog.Sheet.theDoctoringTableWithADoctor') : "" })
          : tx('SR2E.Dialog.Sheet.vsTnByTheWoundLight', { attribute: escHtml(cap(n.attribute)), tnByLevel: n.tnByLevel.L, tnByLevelD: n.tnByLevel.D, periodHoursStun: n.periodHours.stun, periodHoursPhysical: n.periodHours.physical })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.rest'), callback: (_e: Event, b: any) => ({ track: b.form.elements.track.value as "physical" | "stun", hours: Math.max(0, Number(b.form.elements.hours.value) || 0), care: (b.form.elements.track.value === "physical" && b.form.elements.carePhysical ? b.form.elements.carePhysical.value : b.form.elements.care.value) as string, pay: Boolean(b.form.elements.pay.checked) }) },
      rejectClose: false,
    });
    if (!choice) return;
    await actor.naturalHeal(choice);
  }

  /** Switch tabs (and remember the tab across re-renders). */
  static #onTab(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const tab = target.dataset["tab"] ?? "main", group = target.dataset["group"] ?? "primary";
    (this as any).tabGroups = { ...((this as any).tabGroups ?? {}), [group]: tab };
    if (typeof (this as any).changeTab === "function") {
      try { (this as any).changeTab(tab, group, { force: true }); return; } catch { /* fall back */ }
    }
    const root: HTMLElement = (this as any).element;
    root.querySelectorAll<HTMLElement>(`[data-group="${group}"][data-tab]`).forEach((el) => el.classList.toggle("active", el.dataset["tab"] === tab));
  }

  /** Click a pool pip: that many dice left (clicking the last filled pip empties it). */
  static async #onSetPool(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const pool = target.dataset["pool"] ?? "combat";
    const value = Number(target.dataset["value"]) || 0;
    const p = poolsOf(actor).find((x: any) => x.key === pool);
    if (!p) return;
    const left = value === p.left ? value - 1 : value;
    const spent = Math.max(0, p.total - Math.max(0, left));
    if (pool === "karma") await actor.update({ "system.karma.poolSpent": spent });
    else if (pool === "spell") await actor.update({ "system.poolSpent.spell": Math.max(0, spent - (actor.system.spellDefense ?? 0)) });
    else await actor.update({ [`system.poolSpent.${pool}`]: spent });
  }

  /** Quick attack: pick a weapon (or unarmed), then the Attack dialog (Shift: attack with its defaults). */
  static async #onQuickAttack(this: SR2CharacterSheet, event: Event) {
    const actor: any = this.document;
    const weapons = [...actor.items].filter((i: any) => i.type === "weapon");
    const cyber = actor.cyberWeapons?.() ?? [];
    const id = await pickOne(tx('SR2E.Dialog.Sheet.attack3', { actorName: actor.name }), [...weapons.map((w: any) => ({ value: w.id, label: `${w.name} (${damageLabel(w.system)})` })),
      ...cyber.map((w: any) => ({ value: w.id, label: tx('SR2E.Card.Mod.cyberweapon', { name: w.name, damageLabel: damageLabel(w.system) }) })), { value: "unarmed", label: tx('SR2E.Card.Mod.unarmed', { damageLabel: damageLabel(SR2Actor.unarmed().system) }) }]);
    if (!id) return;
    await SR2CharacterSheet.#onAttackWeapon.call(this, event, { dataset: { itemId: id } } as any);
  }

  static async #onQuickCast(this: SR2CharacterSheet, event: Event) {
    const actor: any = this.document;
    const spells = [...actor.items].filter((i: any) => i.type === "spell");
    if (!spells.length) return ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.knowsNoSpells', { actorName: escHtml(actor.name) }));
    const id = await pickOne(tx('SR2E.Dialog.Sheet.cast3', { actorName: actor.name }), spells.map((sp: any) => ({ value: sp.id, label: tx('SR2E.Card.Mod.force', { spName: sp.name, spLearnedForce: sp.system.learnedForce }) })));
    if (id) await SR2CharacterSheet.#onCastSpell.call(this, event, { dataset: { itemId: id } } as any);
  }

  static async #onQuickReload(this: SR2CharacterSheet, event: Event) {
    const actor: any = this.document;
    const guns = [...actor.items].filter((i: any) => i.type === "weapon" && i.system.ammoMax > 0);
    if (!guns.length) return ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.hasNoWeaponThatTakesAmmunition', { actorName: escHtml(actor.name) }));
    const id = guns.length === 1 ? guns[0].id : await pickOne(tx('SR2E.Dialog.Sheet.reload3', { actorName: actor.name }), guns.map((g: any) => ({ value: g.id, label: `${g.name} (${g.system.ammo}/${g.system.ammoMax})` })));
    if (id) await SR2CharacterSheet.#onReloadWeapon.call(this, event, { dataset: { itemId: id } } as any);
  }

  /** Roll initiative into the current combat (adding the token if needed). */
  static async #onRollInit(this: SR2CharacterSheet) {
    const actor: any = this.document;
    if (!game.combat) return ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.thereIsNoCombatEncounterTo'));
    await actor.rollInitiative?.({ createCombatants: true });
  }

  static async #onRefreshKarma(this: SR2CharacterSheet) {
    await (this.document as any).refreshKarmaPool();
  }

  /** Reload: from an ammunition clip (gear with an ammo type) if the actor carries any, else refill. */
  static async #onReloadWeapon(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const weapon = actor.items.get(target.dataset["itemId"]);
    if (!weapon || !(weapon.system.ammoMax > 0)) return;
    // v0.79.0 (RULES.DOCS_V79.rangedReload 'actions', SRII pp. 81–83): a clip is Remove + Insert (two Simple Actions; a smartgun
    // with a smartlink ejects it as a Free Action), any other feed a Complex Action. 'oneSimple': one Simple Action (old).
    const reloadKind = reloadActionKind(String(weapon.system.feed ?? "clip"), { smartgun: Boolean(weapon.system.smartgun && actor.system.derived?.smartlink) });
    // v0.81.0 (S-4): the action (and the jam clear) is spent only once the reload really happens: not on a full
    // cylinder or magazine, and not when the clip picker is cancelled.
    const spend = async (): Promise<boolean> => {
      if (!(await actor.useAction(reloadKind, tx('SR2E.Card.Sheet.reloading', { weaponName: weapon.name, reloadActionLabel: reloadActionLabel(reloadKind) })))) return false;
      if (weapon.system.jammed) await weapon.update({ "system.jammed": false });
      return true;
    };
    // v0.55.0: a cylinder, internal magazine or break-action takes a few rounds per action (RULES.COMBAT.reloadFeed).
    const feed = String(weapon.system.feed ?? "clip");
    if (feed !== "clip" && feed !== "belt") {
      const n = U80C.cbtReloadAmount(reloadAmount(feed, weapon.system.ammo ?? 0, weapon.system.ammoMax), feed, weapon.system.ammo ?? 0, weapon.system.ammoMax, Number(actor.system.attributes?.quickness?.total ?? 0));
      if (n <= 0) return ui.notifications?.info?.(tx('SR2E.Notify.Sheet.isFull', { weaponName: escHtml(weapon.name) }));
      if (!(await spend())) return;
      await weapon.update({ "system.ammo": (weapon.system.ammo ?? 0) + n });
      const left = weapon.system.ammoMax - weapon.system.ammo;
      return ui.notifications?.info?.(tx('SR2E.Notify.Sheet.roundLoaded', { weaponName: escHtml(weapon.name), n: tCount(n, 'SR2E.Count.round'), feed: escHtml(feed), part: left > 0 ? tx('SR2E.Notify.Sheet.moreToGo', { left }) : "" }));
    }
    const clips = [...actor.items].filter((i: any) => i.type === "gear" && i.system.ammoType && (i.system.quantity ?? 0) > 0 && isCarried(i));
    if (!clips.length) {
      if (!(await spend())) return;
      await weapon.update({ "system.ammo": weapon.system.ammoMax });
      return;
    }
    const label = (id: string) => (isKnownAmmo(id) ? findAmmo(id).label : id);
    const pick = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.reload2', { weaponName: weapon.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.load')}</label><select name="clip">
          ${clips.map((c: any) => `<option value="${escHtml(c.id)}">${tx('SR2E.Dialog.Sheet.left', { name: escHtml(c.name), label: escHtml(label(c.system.ammoType)), part: c.system.rounds ? tx('SR2E.Dialog.Sheet.rounds', { rounds: escHtml(c.system.rounds) }) : "", quantity: escHtml(c.system.quantity) })}</option>`).join("")}
          <option value="">${tx('SR2E.Dialog.Sheet.refillWithoutUsingAClip')}</option></select></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.loadedNowUnspentRoundsAreDropped', { weaponAmmo: escHtml(weapon.system.ammo), weaponAmmoMax: escHtml(weapon.system.ammoMax), label: escHtml(label(weapon.system.ammoType ?? "standard")) })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.reload'), callback: (_e: Event, b: any) => b.form.elements.clip.value as string },
      rejectClose: false,
    });
    if (pick === null || pick === undefined) return;
    const clip = pick ? actor.items.get(pick) : null;
    if (pick && !clip) return;
    if (!(await spend())) return;
    if (!clip) {
      await weapon.update({ "system.ammo": weapon.system.ammoMax });
      return;
    }
    const rounds = clip.system.rounds > 0 ? Math.min(weapon.system.ammoMax, clip.system.rounds) : weapon.system.ammoMax;
    await weapon.update({ "system.ammo": rounds, "system.ammoType": clip.system.ammoType });
    await clip.update({ "system.quantity": Math.max(0, clip.system.quantity - 1) });
  }

  static async #onCastSpell(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const spell = actor.items.get(target.dataset["itemId"]);
    if (!spell) return;
    const sp = spell.system;
    const combat = sp.category === "combat";
    const heals = sp.category === "health" && sp.heals;
    // Spells that need a target: combat spells, spells an unwilling target resists, and healing.
    // v0.50.0: elemental manipulations (they hit like ranged attacks) need targets too.
    const targeted = combat || heals || Boolean(sp.elemental) || (sp.resist && sp.resist !== "none");
    // v0.92.0: the Spell Pool's narrow layers this spell falls inside count too (RULES.MAGIC_V920).
    const castUse = actor.sorceryUseFor?.("cast", { category: sp.category, spellName: spell.name });
    const left = Number(actor.spellPoolFor?.(castUse) ?? actor.system.derived.spellPoolLeft);
    // v0.92.0 review (R5): Drain may take the narrow dice only with RULES.MAGIC_V920.drainNarrow.
    const drainLeft = Math.min(left, Number(actor.drainPoolFor?.(castUse) ?? left));

    const targetToken: any = game.user.targets?.first?.() ?? null;
    // Vehicles too (v0.43.0), for physical spells (mana spells only affect the living).
    const vehiclesOk = !heals && (sp.spellType !== "mana" || RULES.GEAR.spellsVsVehicles.manaAffects);
    const types = ["character", "npc", "spirit", ...(vehiclesOk ? ["vehicle"] : [])];
    // v0.50.0: tokens on the scene by their own actor (unlinked NPCs are themselves), then the world's people.
    const others = scenePeople(actor, types);
    const tokenFor = (uuid: string) => others.find((o) => o.uuid === uuid)?.token ?? null;
    // Area spells: pre-tick everyone within the radius of the targeted token (or the caster); v0.50.0: by the Force picked.
    const casterToken = attackerToken(actor);
    const centre = targetToken ?? casterToken;
    const nearFor = (force: number) => {
      const r = areaRadius(force, actor.system.derived.magic);
      return centre ? others.filter((o) => { const d = o.token ? tokenDistance(centre, o.token) : null; return d !== null && d <= r; }).map((o) => o.uuid) : [];
    };
    const radius = areaRadius(sp.learnedForce, actor.system.derived.magic);
    const near0 = sp.area ? nearFor(sp.learnedForce) : [];
    const areaTicked: Set<string> | undefined = near0.length ? new Set(near0) : undefined;
    // Line of sight from the caster's token (a warning, or a refusal by RULES.TN_AUTO.magic.lineOfSight).
    const unseenOf = (uuids: string[]) => casterToken ? uuids.filter((u) => { const t = tokenFor(u); return t && lineOfSight(casterToken, t) === false; }).map((u) => others.find((o) => o.uuid === u)?.name ?? "?") : [];
    const blind = unseenOf(others.map((o) => o.uuid));
    const targetRow = targeted && sp.area && !heals
      ? areaTargetRows(others, game.user.targets, areaTicked)
      : targeted
      ? `<div class="form-group"><label>${heals ? tx('SR2E.Dialog.Sheet.patient') : tx('SR2E.Dialog.Sheet.target')}</label><select name="target">
          ${attackTargetOptions(actor, casterToken, targetToken, types, heals ? tx('SR2E.Dialog.Sheet.self2', { actorName: escHtml(actor.name) }) : undefined).options}
        </select></div>`
      : "";

    const sustained = sp.duration === "sustained";
    const freeFocus = sustained ? availableSustainingFocus(actor.foci(), actor.sustained(), { force: sp.learnedForce, category: sp.category }) : null;
    const sustainRow = sustained
      ? (freeFocus
        ? `<label class="sr2e-check"><input type="checkbox" name="useFocus" checked> ${tx('SR2E.Dialog.Sheet.sustainWithNoTnPenalty', { part: escHtml(freeFocus.id ? actor.items.get(freeFocus.id)?.name ?? tx('SR2E.Dialog.Sheet.aFocus') : tx('SR2E.Dialog.Sheet.aFocus')) })}</label>`
        : `<p class="hint">${tx('SR2E.Dialog.Sheet.sustainedWillTakeTnOnAll', { actorName: escHtml(actor.name), magicSustainedTnMod: RULES.MAGIC.sustainedTnMod })}</p>`)
      : "";
    const fd = sorceryFocusDice(actor.foci(), { name: spell.name, category: sp.category });
    const td = totemDice(actor.system.tradition ?? "none", actor.system.totem, sp.category);
    const sorcerers = allActors().filter((a: any) => a.uuid !== actor.uuid && (a.findSkill?.("Sorcery")?.system.rating ?? 0) > 0);
    const ritualRows = sorcerers.length
      ? `<details class="sr2e-ritual"><summary>${tx('SR2E.Dialog.Sheet.ritualSorcery')}</summary>
          <label class="sr2e-check"><input type="checkbox" name="ritual"> ${tx('SR2E.Dialog.Sheet.castAsARitualHPer', { ritualHoursPerForce: RULES.RITUAL.hoursPerForce })}</label>
          <fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Sheet.team')}</legend>${sorcerers.map((a: any) =>
            `<label class="sr2e-check"><input type="checkbox" name="teamMember" value="${escHtml(a.uuid)}"> ${escHtml(a.name)}</label>`).join("")}</fieldset>
          <label class="sr2e-check"><input type="checkbox" name="materialLink" ${targetToken && casterToken && lineOfSight(casterToken, targetToken) ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.targetInSightOrMaterialLink', { part: targetToken && casterToken && lineOfSight(casterToken, targetToken) ? tx('SR2E.Dialog.Sheet.inSight') : "" })}</label>
          <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spotterAstral')}</label><select name="spotter"><option value="">${tx('SR2E.Dialog.Sheet.none')}</option>${allActors().filter((a: any) => a.uuid !== actor.uuid && a.isAstral?.()).map((a: any) => `<option value="${escHtml(a.uuid)}">${escHtml(a.name)}</option>`).join("")}</select></div>
        </details>`
      : "";
    const hasFetish = (actor.materialStock?.().fetish ?? 0) > 0;
    const fetishRow = sp.fetish ? `<label class="sr2e-check"><input type="checkbox" name="fetish" ${hasFetish ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.fetishInHandFetishLimitedSpell', { part: hasFetish ? "" : tx('SR2E.Dialog.Sheet.noFetishItemCarried') })}</label>` : "";
    const elementals = (actor.summonedSpirits?.() ?? []).filter((e: any) => e.system.spiritKind === "elemental" && e.system.services > 0
      && sp.element && String(e.system.element ?? "").toLowerCase() === String(sp.element).toLowerCase());
    const aidRow = elementals.length
      ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.aidedByCostsAService')}</label><select name="aid"><option value="">${tx('SR2E.Dialog.Sheet.none')}</option>${elementals.map((e: any) => `<option value="${escHtml(e.uuid)}">${tx('SR2E.Dialog.Sheet.dice3', { name: escHtml(e.name), force: escHtml(e.system.force) })}</option>`).join("")}</select></div>` : "";
    const barriers = allActors().filter((b: any) => b.type === "barrier" && b.system.rating > 0);
    // v0.60.0: a ward region between the caster and the target is picked by itself.
    let crossed: any = null;
    // v0.72.0 (O17): a physical barrier doesn't stop spells.
    try { crossed = casterToken && targetToken ? wardsBetween(casterToken, targetToken).find((b: any) => barrierBlocks(String(b.system?.barrierKind ?? "ward"), "spell")) ?? null : null; } catch { crossed = null; }
    const barrierRow = targeted && !sp.elemental && barriers.length
      ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.castThroughAWard', { part: crossed ? tx('SR2E.Dialog.Sheet.onTheMap') : "" })}</label><select name="barrier"><option value="">${tx('SR2E.Dialog.Sheet.none')}</option>${barriers.map((b: any) => `<option value="${escHtml(b.uuid)}"${crossed?.uuid === b.uuid ? " selected" : ""}>${escHtml(b.name)} (${escHtml(b.system.rating)})</option>`).join("")}</select></div>` : "";
    const anchorRow = actor.system.metamagic?.anchoring
      ? `<label class="sr2e-check"><input type="checkbox" name="anchor"> ${tx('SR2E.Dialog.Sheet.anchorItInsteadReleaseLater')}</label>
         <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.trigger')}</label><input name="trigger" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGWhenTheDoorOpens')}"></div>` : "";
    const areaHint = sp.area ? `<p class="hint">${centre ? tx('SR2E.Dialog.Sheet.areaRadiusMAround', { radius, name: escHtml(targetToken ? targetToken.name : actor.name), part: areaTicked ? tx('SR2E.Dialog.Sheet.targetsWithinItAreTicked') : "" }) : tx('SR2E.Dialog.Sheet.areaRadiusM', { radius, part: areaTicked ? tx('SR2E.Dialog.Sheet.targetsWithinItAreTicked') : "" })}</p>` : "";
    const losHint = blind.length && targeted ? `<p class="hint sr2e-warn">${tx('SR2E.Dialog.Sheet.noLineOfSightTo', { blind: escHtml(blind.join(", ")), part: RULES.TN_AUTO.magic.lineOfSight === "block" ? tx('SR2E.Dialog.Sheet.theSpellCanTReachThem') : "" })}</p>` : "";
    const elementalHint = sp.elemental ? `<p class="hint">${RULES.MAGIC_EXTRA.elemental.dodge ? tx('SR2E.Dialog.Sheet.elementalSpellTargetsMayDodge', { spTargetNumber: escHtml(sp.targetNumber), spLearnedForce: escHtml(sp.learnedForce), elementalArmorKind: RULES.MAGIC_EXTRA.elemental.armorKind }) : tx('SR2E.Dialog.Sheet.elementalSpellTnResistPowerWith', { spTargetNumber: escHtml(sp.targetNumber), spLearnedForce: escHtml(sp.learnedForce), elementalArmorKind: RULES.MAGIC_EXTRA.elemental.armorKind })}</p>` : "";
    const bonusHint = fd.dice || td ? `<p class="hint">${tx('SR2E.Dialog.Sheet.extraSorceryDice', { value: escHtml([...fd.notes, ...(td ? [`totem ${td > 0 ? "+" : ""}${td}`] : [])].join(", ")) })}</p>` : "";
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.cast2', { spellName: spell.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.forceMaxMagic', { spLearnedForce: escHtml(sp.learnedForce), derivedMagic: escHtml(actor.system.derived.magic) })}</label>
          <input name="force" type="number" value="${escHtml(sp.learnedForce)}" min="1" max="${escHtml(sp.learnedForce)}" autofocus></div>
        ${targetRow}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spellPoolDiceToCastLeft', { left, part: castingPoolMax(left, actor.system.derived.magic) < left ? tx('SR2E.Dialog.Sheet.atMostMagic', { castingPoolMax: castingPoolMax(left, actor.system.derived.magic) }) : "" })}</label><input name="pool" type="number" value="0" min="0" max="${castingPoolMax(left, actor.system.derived.magic)}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spellPoolDiceForDrain')}</label><input name="drainPool" type="number" value="0" min="0" max="${drainLeft}"></div>
        ${sustainRow}
        ${fetishRow}
        ${aidRow}
        ${barrierRow}
        ${anchorRow}
        ${ritualRows}
        ${areaHint}
        ${losHint}
        ${elementalHint}
        ${bonusHint}
        <div class="sr2e-preview" aria-live="polite"></div>
        ${rememberMarker(`cast|${actor.uuid}|${spell.id}`, ["force", "pool", "drainPool", "useFocus"])}
        <p class="hint">${tx('SR2E.Dialog.Sheet.drainWillpowerVsFloorForce2', { part: sp.drainModifier ? ` ${sp.drainModifier > 0 ? "+" : "−"} ${Math.abs(sp.drainModifier)}` : "", spDrainLevel: escHtml(sp.drainLevel) })}</p>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.cast'),
        callback: (_e: Event, button: any) => {
          const el = button.form.elements;
          const pool = Math.max(0, Math.floor(Number(el.pool.value) || 0));
          const drainPool = Math.max(0, Math.floor(Number(el.drainPool.value) || 0));
          return {
            force: Number(el.force.value) || sp.learnedForce,
            targetUuid: (el.target?.value as string) || null,
            targetUuids: checkedTargets(button.form),
            pool: Math.min(pool, left),
            drainPool: Math.min(drainPool, drainLeft, Math.max(0, left - Math.min(pool, left))),
            useFocus: Boolean(el.useFocus?.checked),
            fetish: el.fetish ? Boolean(el.fetish.checked) : true,
            ritual: el.ritual?.checked
              ? { teamUuids: Array.from(button.form.querySelectorAll('input[name="teamMember"]:checked')).map((i: any) => i.value as string), materialLink: Boolean(el.materialLink?.checked), spotterUuid: (el.spotter?.value as string) || null }
              : null,
            aid: (el.aid?.value as string) || null,
            barrier: (el.barrier?.value as string) || null,
            anchor: el.anchor?.checked ? { trigger: String(el.trigger?.value ?? "").trim() } : null,
            exclude: excludedOf(button.form),
          };
        },
      },
      render: (_e: Event, dialog: any) => {
        const form: any = dialog?.element?.querySelector("form");
        if (!form) return;
        // v0.50.0: the area follows the Force picked (until a target box is changed by hand).
        if (sp.area && centre) {
          let touched = false;
          form.querySelectorAll('input[name="areaTarget"]').forEach((i: HTMLInputElement) => i.addEventListener("change", () => { touched = true; }));
          form.elements.force?.addEventListener("input", () => {
            if (touched) return;
            const near = new Set(nearFor(Number(form.elements.force.value) || sp.learnedForce));
            form.querySelectorAll('input[name="areaTarget"]').forEach((i: HTMLInputElement) => { i.checked = near.has(i.value); });
          });
        }
        livePreview(dialog, (f, excluded) => {
          const el: any = f.elements;
          const chosen = sp.area ? checkedTargets(f) : el.target?.value ? [String(el.target.value)] : [];
          const pv = actor.spellPreview(spell, { targetUuids: chosen });
          return tnPreviewHtml({ base: pv.base, baseLabel: pv.baseLabel, auto: pv.modifiers, excluded,
            ...(pv.unseen.length ? { warn: tx('SR2E.Dialog.Sheet.noLineOfSightTo2', { pvUnseen: pv.unseen.join(", ") }) } : {}) });
        });
      },
      rejectClose: false,
    } as any) as any;
    if (!choice) return;
    if (!(await actor.useAction("cast", tx('SR2E.Card.Sheet.casting', { spellName: spell.name })))) return;
    await actor.castSpell(spell, {
      force: choice.force,
      targetUuid: choice.targetUuid,
      targetUuids: choice.targetUuids,
      poolDice: choice.pool,
      drainPoolDice: choice.drainPool,
      useSustainingFocus: choice.useFocus,
      fetishInHand: choice.fetish,
      ritual: choice.ritual,
      aidUuid: choice.aid,
      barrierUuid: choice.barrier,
      anchor: choice.anchor,
      ...(choice.exclude?.length ? { exclude: choice.exclude } : {}),
    });
  }

  /** Cast a physical spell at an object or a wall (v0.47.0): the selected walls, or those between the caster and the target. */
  static async #onCastAtObject(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const spell = actor.items.get(target.dataset["itemId"]);
    if (!spell) return;
    const sp = spell.system;
    const castUse = actor.sorceryUseFor?.("cast", { category: sp.category, spellName: spell.name });
    const left = Number(actor.spellPoolFor?.(castUse) ?? actor.system.derived.spellPoolLeft);
    // v0.92.0 review (R5): Drain may take the narrow dice only with RULES.MAGIC_V920.drainNarrow.
    const drainLeft = Math.min(left, Number(actor.drainPoolFor?.(castUse) ?? left));
    const t = RULES.GEAR.spellsVsObjects.tns as Record<string, number>;
    const kinds: Record<string, string> = { natural: tx('SR2E.App.Sheets.naturalTreesEarth'), lowTech: tx('SR2E.App.Sheets.lowTechWoodBrick'), highTech: tx('SR2E.App.Sheets.highTechPlasticsAlloys'), processed: tx('SR2E.App.Sheets.highlyProcessedElectronics') };
    const from: any = tokenOf(actor);
    const to: any = game.user.targets?.first?.() ?? null;
    const controlled: any[] = [...(canvas?.walls?.controlled ?? [])].map((w: any) => w.document);
    const between: any[] = from && to ? wallsBetweenPoints(from.center, to.center).map((w) => w.doc) : [];
    const walls = [...new Map([...controlled, ...between].map((d: any) => [d.id, d])).values()];
    const wallRows = sp.category === "combat" && walls.length
      ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.wall')}</label><select name="wall"><option value="">${tx('SR2E.Dialog.Sheet.notAWall')}</option>${walls.map((d: any, i: number) => `<option value="${escHtml(d.id)}" ${i === 0 ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.wallRating', { value: i + 1, flag: Number(d.getFlag?.(SYSTEM.id, "barrierRating") ?? RULES.COMBAT.barriers.defaultWallRating), part: controlled.includes(d) ? tx('SR2E.Dialog.Sheet.selected') : "" })}</option>`).join("")}</select></div>` : "";
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.castAtAnObject', { spellName: spell.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.forceMax', { spLearnedForce: escHtml(sp.learnedForce) })}</label><input name="force" type="number" value="${escHtml(sp.learnedForce)}" min="1" max="${escHtml(sp.learnedForce)}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.object')}</label><select name="kind">${Object.entries(kinds).map(([k, l]) => `<option value="${escHtml(k)}" ${k === RULES.GEAR.spellsVsObjects.wallKind ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.tn8', { l: escHtml(l), t: t[k] })}</option>`).join("")}</select></div>
        ${wallRows}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spellPoolDiceToCastLeft', { left, part: castingPoolMax(left, actor.system.derived.magic) < left ? tx('SR2E.Dialog.Sheet.atMostMagic', { castingPoolMax: castingPoolMax(left, actor.system.derived.magic) }) : "" })}</label><input name="pool" type="number" value="0" min="0" max="${castingPoolMax(left, actor.system.derived.magic)}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spellPoolDiceForDrain')}</label><input name="drainPool" type="number" value="0" min="0" max="${drainLeft}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.drainAsUsual', { part: sp.category === "combat" ? tx('SR2E.Dialog.Sheet.aWallTakesPowerForcePer', { spellsVsObjectsPowerPerSuccess: RULES.GEAR.spellsVsObjects.powerPerSuccess }) : tx('SR2E.Dialog.Sheet.theObjectResistsWithItsTn') })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.cast'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { force: Number(el.force.value) || sp.learnedForce, kind: String(el.kind.value), wall: String(el.wall?.value ?? ""), pool: Math.max(0, Number(el.pool.value) || 0), drainPool: Math.max(0, Number(el.drainPool.value) || 0), mod: Number(el.mod.value) || 0 }; } },
      rejectClose: false,
    });
    if (!r) return;
    const wall = r.wall ? walls.find((d: any) => d.id === r.wall) ?? null : null;
    await actor.castAtObject(spell, { spendAction: true, fetishInHand: !sp.fetish || (actor.materialStock?.().fetish ?? 0) > 0, force: r.force, objectKind: r.kind, wall, poolDice: Math.min(r.pool, left), drainPoolDice: Math.min(r.drainPool, drainLeft, Math.max(0, left - Math.min(r.pool, left))), modifiers: r.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: r.mod }] : [] });
  }

  static async #onSetBackground(this: SR2CharacterSheet) {
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyTheGmSetsTheBackground'));
    const scene: any = game.scenes?.viewed ?? game.scenes?.current;
    const text = String(scene?.getFlag?.("sr2e", "backgroundSources") ?? "");
    const value = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.backgroundCount') },
      position: { width: 520 },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.backgroundCountForThisScene')}</label><input name="bgc" type="number" value="${SR2Actor.backgroundCount()}" autofocus></div>
        <div class="form-group stacked"><label>${tx('SR2E.Dialog.Sheet.sourcesOnePerLine')}</label><textarea name="sources" rows="4" placeholder="${tx('SR2E.Dialog.Sheet.oldChurch3AspectedToChristian')}">${escHtml(text)}</textarea></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.addedToTheTnOfMagical')}</p>`,
      ok: { callback: (_e: Event, b: any) => ({ bgc: Number(b.form.elements.bgc.value) || 0, sources: String(b.form.elements.sources.value ?? "") }) },
      rejectClose: false,
    });
    if (value && typeof value === "object") {
      await SR2Actor.setBackgroundCount(value.bgc);
      await SR2Actor.setBackgroundSources(value.sources);
      this.render();
    }
  }

  static async #onEnchant(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const tasks = Object.entries(RULES.ENCHANTING.tasks);
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.enchanting', { actorName: actor.name }) },
      position: { width: 460 },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.task')}</label><select name="task">${tasks.map(([k, t]) => `<option value="${escHtml(k)}">${tx('SR2E.Dialog.Sheet.tnDays', { label: escHtml(t.label), tn: t.tn, days: t.days })}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.tnBlankTheTaskS')}</label><input name="tn" type="number" min="2"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.daysAt1SuccessBlankThe')}</label><input name="days" type="number" min="0" step="0.5"></div>
        <fieldset><legend>${tx('SR2E.Dialog.Sheet.makingAFocus')}</legend>
          <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.name')}</label><input name="fname" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGSilverRing')}"></div>
          <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.type')}</label><select name="ftype">${FOCUS_TYPES.map((k) => {
            // v0.78.0 (RULES.BOOK_V78.focusKarma): the book's bonding costs.
            const B = RULES.BOOK_V78.focusKarma;
            const cost = B.mode !== "book" ? tx('SR2E.Dialog.Sheet.karmaPerRating', { karma: RULES.ENCHANTING.focusKarma[k] ?? 1 })
              : k === "spell" ? tx('SR2E.Dialog.Sheet.spellFocusCost', { specificSpell: B.specificSpell, spellCategory: B.spellCategory }) : k === "sustaining" ? tx('SR2E.Dialog.Sheet.karmaFlat', { karma: B.spellLockFlat }) : k === "weapon" ? tx('SR2E.Dialog.Sheet.weaponFocusCost', { weaponSmall: B.weaponSmall, weaponLarge: B.weaponLarge }) : tx('SR2E.Dialog.Sheet.karmaPerRating', { karma: escHtml((B as any)[k] ?? 1) });
            return `<option value="${k}">${escHtml(cap(k))} (${cost})</option>`;
          }).join("")}</select></div>
          <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.weaponFocusSize')}</label><select name="fsize"><option value="small">${tx('SR2E.Dialog.Sheet.smallNoReach')}</option><option value="large">${tx('SR2E.Dialog.Sheet.largeReach')}</option></select></div>
          <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.rating2')}</label><input name="frating" type="number" value="1" min="1"></div>
          <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.categoryTiedTo')}</label><input name="ftarget" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGCombatFireElementalSword')}"></div>
        </fieldset>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.fetishForSpellName')}</label><input name="fetishFor" type="text" placeholder="${tx('SR2E.Dialog.Sheet.makeAFetishOnly')}"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.enchantingSkillOrIntelligenceAtVs', { attributeDefaultTnMod: RULES.ATTRIBUTE_DEFAULT_TN_MOD, part: (() => { const m = actor.materialStock(); return tx('SR2E.Dialog.Sheet.materialStock', { raw: escHtml(m.raw), refined: escHtml(m.refined), radical: escHtml(m.radical), fetish: escHtml(m.fetish) }); })(), materialsFetishUses: RULES.MAGIC_EXTRA.materials.fetishUses, materialsFocusUnitsPerRating: RULES.MAGIC_EXTRA.materials.focusUnitsPerRating, materialsFocusMaterial: RULES.MAGIC_EXTRA.materials.focusMaterial })}</p>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.work'),
        callback: (_e: Event, b: any) => {
          const el = b.form.elements;
          const ft = String(el.ftarget.value ?? "").trim();
          const isCategory = ["combat", "detection", "health", "illusion", "manipulation"].includes(ft.toLowerCase());
          return {
            task: el.task.value as string,
            targetNumber: el.tn.value ? Number(el.tn.value) : undefined,
            baseDays: el.days.value ? Number(el.days.value) : undefined,
            focus: { name: String(el.fname.value ?? "").trim(), focusType: el.ftype.value as string, rating: Number(el.frating.value) || 1,
              category: isCategory ? ft.toLowerCase() : "", target: isCategory ? "" : ft, ...(el.ftype.value === "weapon" ? { size: String(el.fsize?.value ?? "small") } : {}) },
            fetishFor: String(el.fetishFor.value ?? "").trim(),
          };
        },
      },
      rejectClose: false,
    });
    if (!choice) return;
    await actor.enchant({
      task: choice.task,
      ...(choice.targetNumber ? { targetNumber: choice.targetNumber } : {}),
      ...(choice.baseDays ? { baseDays: choice.baseDays } : {}),
      focus: choice.task === "focus" ? choice.focus : null,
      ...(choice.task === "fetish" && choice.fetishFor ? { fetishFor: choice.fetishFor } : {}),
    });
  }

  static async #onStartQuest(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const q = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.astralQuest', { actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.quest')}</label><input name="name" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGDwellerOnTheThreshold')}" autofocus></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.stages')}</label><input name="stages" type="number" value="3" min="1"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.targetNumber2')}</label><input name="tn" type="number" value="6" min="2"></div>`,
      ok: { label: tx('SR2E.Dialog.Sheet.begin'), callback: (_e: Event, b: any) => ({ name: String(b.form.elements.name.value ?? ""), stages: Number(b.form.elements.stages.value) || 1, targetNumber: Number(b.form.elements.tn.value) || 6 }) },
      rejectClose: false,
    });
    if (q) await actor.startQuest(q);
  }

  static async #onQuestStage(this: SR2CharacterSheet) {
    const actor: any = this.document;
    const attr = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.questStage') },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.test')}</label><select name="attr">${ATTRIBUTE_KEYS.map((k) => `<option value="${k}" ${k === "willpower" ? "selected" : ""}>${escHtml(game.i18n.localize(`SR2E.Attribute.${k}`))}</option>`).join("")}</select></div>`,
      ok: { callback: (_e: Event, b: any) => String(b.form.elements.attr.value) },
      rejectClose: false,
    });
    if (attr) await actor.questStage(attr);
  }

  static async #onEndQuest(this: SR2CharacterSheet) {
    await (this.document as any).endQuest();
  }

  static async #onToggleInstalled(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    const item = (this.document as any).items.get(target.dataset["itemId"]);
    if (item) await item.update({ "system.installed": !item.system.installed });
  }

  static #onEditItem(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    (this.document as any).items.get(target.dataset["itemId"])?.sheet.render(true);
  }

  static async #onDeleteItem(this: SR2CharacterSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).items.get(target.dataset["itemId"])?.delete();
  }
}

/**
 * Dialog rows for how a skill is used: a "use specialization" box if the skill has one, or, if the
 * character lacks the skill, a choice of related skill to default to (+2) instead of the attribute (+4).
 */
function skillChoiceRows(actor: any, skill: any | undefined, specChecked: boolean, concChecked = false): string {
  if (skill && skill.system.rating > 0) {
    const rows: string[] = [];
    // v0.38.0: a concentration between the skill and its specialization.
    if (skill.system.concentrationRating > 0) rows.push(`<label class="sr2e-check"><input type="checkbox" name="useConc" ${concChecked ? "checked" : ""}>
      ${tx('SR2E.Dialog.Sheet.useConcentrationInsteadOf', { skillConcentration: escHtml(skill.system.concentration || tx('SR2E.Dialog.Sheet.concentration')), skillConcentrationRating: escHtml(skill.system.concentrationRating), skillName: escHtml(skill.name), skillRating: escHtml(skill.system.rating) })}</label>`);
    if (skill.system.specializationRating > 0) rows.push(`<label class="sr2e-check"><input type="checkbox" name="useSpec" ${specChecked ? "checked" : ""}>
      ${tx('SR2E.Dialog.Sheet.useSpecializationInsteadOf', { skillSpecialization: escHtml(skill.system.specialization || tx('SR2E.Dialog.Sheet.specialization')), skillSpecializationRating: escHtml(skill.system.specializationRating), skillName: escHtml(skill.name), skillRating: escHtml(skill.system.rating) })}</label>`);
    return rows.join("");
  }
  // Defaulting: the Skill Web sets the TN for each related skill (v0.38.0); unreachable ones are left out.
  const web = getSkillWeb();
  const others = [...actor.items].filter((i: any) => i.type === "skill" && i.system.rating > 0 && i.id !== skill?.id)
    .map((o: any) => ({ o, tn: relatedDefaultTn(web, skill?.name ?? "", o.name) }))
    .filter((x) => x.tn !== null)
    .sort((a, b) => (a.tn as number) - (b.tn as number) || b.o.system.rating - a.o.system.rating);
  const attr = (skill?.system.attribute ?? "quickness") as string;
  const best = others.find((x) => web.length && (x.tn as number) <= RULES.SKILL_DEFAULT_TN_MOD + 2);
  return `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.noDefaultTo', { skillName: escHtml(skill?.name ?? tx('SR2E.Dialog.Sheet.skill2')) })}</label><select name="related">
      <option value="">${tx('SR2E.Dialog.Sheet.tn3', { value: escHtml(attr.charAt(0).toUpperCase() + attr.slice(1)), attributeDefaultTnMod: RULES.ATTRIBUTE_DEFAULT_TN_MOD })}</option>
      ${others.map((x) => `<option value="${escHtml(x.o.id)}" ${best && best.o.id === x.o.id && (x.tn as number) < RULES.ATTRIBUTE_DEFAULT_TN_MOD ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.tn4', { name: escHtml(x.o.name), rating: escHtml(x.o.system.rating), tn: x.tn })}</option>`).join("")}
    </select></div>`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** v0.89.6: label tables hold lang keys (read with tKey when shown). */
const SPIRIT_KIND_LABELS: Record<string, string> = {
  nature: "SR2E.App.Sheets.spiritKindNature", elemental: "SR2E.App.Sheets.spiritKindElemental", watcher: "SR2E.App.Sheets.spiritKindWatcher", ally: "SR2E.App.Sheets.spiritKindAlly", free: "SR2E.App.Sheets.spiritKindFree", other: "SR2E.App.Sheets.spiritKindOther",
  toxic: "SR2E.App.Sheets.spiritKindToxic", insect: "SR2E.App.Sheets.spiritKindInsect",
};

export const TRADITION_LABELS: Record<string, string> = {
  none: "SR2E.App.Sheets.traditionNone", hermetic: "SR2E.App.Sheets.traditionHermetic", shamanic: "SR2E.App.Sheets.traditionShamanic", adept: "SR2E.App.Sheets.traditionAdept",
  sorcerer: "SR2E.App.Sheets.traditionSorcerer", conjurer: "SR2E.App.Sheets.traditionConjurer", elementalist: "SR2E.App.Sheets.traditionElementalist", shamanist: "SR2E.App.Sheets.traditionShamanist",
  toxic: "SR2E.App.Sheets.traditionToxic", insect: "SR2E.App.Sheets.traditionInsect",
};

const elementChoices = () => [{ key: "", label: tx('SR2E.App.Sheets.elementNone') }, ...RULES.MAGIC_EXTRA.elements.map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) }))];

/**
 * v0.50.0: people a test can be aimed at: the user's targets and the tokens on the scene, each by its own
 * actor (an unlinked NPC is itself, not its template), then world actors with no token here.
 */
function scenePeople(self: any, types: readonly string[]): Array<{ uuid: string; name: string; actor: any; token: any | null }> {
  const out: Array<{ uuid: string; name: string; actor: any; token: any | null }> = [];
  const seen = new Set<string>();
  const add = (a: any, token: any | null) => {
    if (!a || !types.includes(a.type) || a.uuid === self?.uuid || seen.has(a.uuid)) return;
    seen.add(a.uuid);
    out.push({ uuid: a.uuid, name: token?.name ?? a.name, actor: a, token });
  };
  for (const t of [...(game.user?.targets ?? [])]) add((t as any).actor, t);
  let placeables: any[] = [];
  try { placeables = canvas?.tokens?.placeables ?? []; } catch { placeables = []; }
  for (const t of placeables) add(t.actor, t);
  const onScene = new Set(placeables.map((t: any) => t.document?.actorId).filter(Boolean));
  for (const a of game.actors ?? []) if (a.id !== self?.id && !onScene.has(a.id)) add(a, null);
  return out;
}

/** Checkbox list of targets for area spells and powers; the user's current targets are pre-ticked. */
function areaTargetRows(actors: any[], userTargets: any, preTicked?: Set<string>): string {
  const ticked = preTicked ?? new Set([...(userTargets ?? [])].map((t: any) => t.actor?.uuid).filter(Boolean));
  return `<fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Sheet.targetsArea')}</legend>${actors.map((a: any) =>
    `<label class="sr2e-check"><input type="checkbox" name="areaTarget" value="${escHtml(a.uuid)}" ${ticked.has(a.uuid) ? "checked" : ""}> ${escHtml(a.name)}</label>`).join("")}</fieldset>`;
}

/** The ticked area targets in a dialog form. */
function checkedTargets(form: HTMLFormElement): string[] {
  return Array.from(form.querySelectorAll<HTMLInputElement>('input[name="areaTarget"]:checked')).map((i) => i.value);
}

/** One line describing how a power rolls, e.g. "Force vs Willpower; resisted by Body; M physical". */
function powerSummary(p: any): string {
  // Built-in critter effects (v0.39.0).
  switch (p.special) {
    case "allergy": return p.exposed ? tx('SR2E.App.Sheets.allergyExposed', { substance: p.substance || "?", severity: p.severity }) : tx('SR2E.App.Sheets.allergy', { substance: p.substance || "?", severity: p.severity });
    case "vulnerability": return tx('SR2E.App.Sheets.vulnerableTo', { substance: p.substance || "?" });
    case "essenceLoss": return tx('SR2E.App.Sheets.losesEssenceEveryDays', { points: RULES.CRITTERS.essenceLoss.points, days: RULES.CRITTERS.essenceLoss.days });
    case "regeneration": return tx('SR2E.App.Sheets.regenerates');
    case "dualNatured": return tx('SR2E.App.Sheets.dualNaturedAlwaysAstrallyActive');
    case "infection": return tx('SR2E.App.Sheets.infectionOnADamagingBlow', { substance: p.substance || RULES.CRITTERS.infection.name, rating: p.rating, damageLevel: p.damageLevel });
    case "essenceDrain": return p.tnSource === "fixed"
      ? tx('SR2E.App.Sheets.essenceDrainVsTn', { dice: cap(p.dice), tn: p.targetNumber, resist: cap(p.resist === "none" ? "willpower" : p.resist) })
      : tx('SR2E.App.Sheets.essenceDrainVsTargets', { dice: cap(p.dice), attribute: cap(p.tnSource), resist: cap(p.resist === "none" ? "willpower" : p.resist) });
    default: break;
  }
  if (!p.active) return tx('SR2E.App.Sheets.passive');
  const dice = p.dice === "rating" ? tx('SR2E.App.Sheets.ratingValue', { rating: p.rating }) : cap(p.dice);
  const tn = p.tnSource === "fixed" ? tx('SR2E.App.Sheets.tnValue', { tn: p.targetNumber }) : tx('SR2E.App.Sheets.vsTargets', { attribute: cap(p.tnSource) });
  const resist = p.resist === "none" ? tx('SR2E.App.Sheets.notResisted') : tx('SR2E.App.Sheets.resistedBy', { attribute: cap(p.resist) });
  const effect = p.effect === "damage" ? `${p.damageLevel} ${p.damageType}` : tx('SR2E.App.Sheets.effect');
  const changes = p.sustained ? Object.entries(p.attributes ?? {}).filter(([, v]) => v).map(([k, v]) => `${Number(v) > 0 ? "+" : ""}${v} ${cap(k)}`).join(", ") : "";
  if (!p.sustained) return tx('SR2E.App.Sheets.powerLine', { dice, tn, resist, effect });
  if (!changes) return tx('SR2E.App.Sheets.powerLineSustained', { dice, tn, resist, effect });
  return p.perSuccess ? tx('SR2E.App.Sheets.powerLineSustainedChangesPerNet', { dice, tn, resist, effect, changes }) : tx('SR2E.App.Sheets.powerLineSustainedChanges', { dice, tn, resist, effect, changes });
}

/** v0.45.0: metamagic actions, possession, magical groups, sustained powers, hunger, surgery recovery. */
function occultContext(actor: any) {
  const mm = actor.system.metamagic ?? {};
  const cls: any = CONFIG.Actor.documentClass;
  const me: string[] = actor.selfUuids?.() ?? [actor.uuid];
  const now = sysNow();
  const groups = (actor.myGroups?.() ?? []).map((g: any) => {
    const breach = g.breaches.some((b: any) => me.includes(b.uuid));
    return {
      id: g.id, name: g.name, breach,
      strictures: g.strictures.map((s: any) => s.text).filter(Boolean).join("; "),
      sites: g.sites.map((s: any) => `${s.name} (${s.kind} ${s.rating})`).join(", "),
      grimoire: RULES.OCCULT.groups.grimoire ? g.grimoire.map((s: any) => ({ name: s.name, force: s.system?.learnedForce ?? 1, known: [...actor.items].some((i: any) => i.type === "spell" && i.name === s.name), groupId: g.id })) : [],
    };
  });
  const possessing = actor.getFlag?.("sr2e", "possessing") ?? null;
  const hungerInfo = actor.hungerInfo?.() ?? null;
  const lastFed = Number(actor.getFlag?.("sr2e", "lastFed") ?? NaN);
  const bi = actor.system.derived?.bodyIndex;
  return {
    knows: { cleansing: Boolean(mm.cleansing), divining: Boolean(mm.divining), invoking: Boolean(mm.invoking), possessing: Boolean(mm.possessing) },
    any: Boolean(mm.cleansing || mm.divining || mm.invoking || mm.possessing),
    canPossess: Boolean(mm.possessing) && actor.system.derived?.astralMode === "projecting" && !possessing,
    possessing, possessedBy: actor.system.derived?.possessedBy ?? "",
    canDesign: (actor.findSkill?.(RULES.OCCULT.design.skill)?.system?.rating ?? 0) > 0,
    groups, inGroup: groups.length > 0,
    sustainingPowers: (cls.powerEffectsFrom?.(me) ?? []).map((e: any) => ({ ...e, changes: e.summary ?? cls.describeChanges?.(e.attributes) ?? "" })),
    // v0.56.0: spells too; a spell is dropped from its caster's Sustaining list, and a permanent one stays.
    underPowers: (actor.system.derived?.powerEffects ?? []).map((e: any) => ({ ...e, changes: e.summary ?? cls.describeChanges?.(e.attributes) ?? "", targetUuid: actor.uuid, canDrop: e.kind !== "spell" && !e.permanent })),
    hunger: hungerInfo ? { ...hungerInfo, fed: Number.isFinite(lastFed) } : null,
    recovering: (actor.system.recovering ?? []).filter((r: any) => r.until > now).map((r: any) => ({ ...r, days: Math.max(0, Math.ceil((r.until - now) / 86400)),
      careLabel: r.care ? (RULES.HEALING.natural.care.find((c) => c.id === r.care)?.label ?? r.care).toLowerCase() : "" })),
    // v0.48.0: allies by ritual and the familiar ordeal; a possessed body's skills.
    canAlly: Number(actor.system.initiateGrade ?? 0) >= RULES.OCCULT.ally.minGrade && (actor.findSkill?.("Conjuring")?.system?.rating ?? 0) > 0 && actor.tradition !== "adept",
    familiar: (() => { const f = actor.getFlag?.("sr2e", "familiar"); return f?.allyUuid ? { name: f.allyName ?? tx('SR2E.App.Sheets.anAlly'), ready: familiarReady(f) } : null; })(),
    possessedSkills: actor.getFlag?.("sr2e", "possessedBy")?.skills ? RULES.OCCULT.metamagic.possessing.skills : "",
    pendingDeed: actor.getFlag?.("sr2e", "pendingInitiation")?.grade ?? 0,
    rejectionDue: Boolean(bi?.over) && RULES.BIOWARE.rejection.enabled,
  };
}

/** The Conjuring section: shown to anyone with the Conjuring skill, listing their summoned spirits. */
function conjuringContext(actor: any) {
  const skill = actor.findSkill?.("Conjuring");
  if (!skill || actor.type === "spirit") return null;
  const spirits = (actor.summonedSpirits?.() ?? []).map((s: any) => ({
    uuid: s.uuid, name: s.name, force: s.system.force, services: s.system.services, kind: s.system.spiritKind,
  }));
  const cha = actor.system.attributes.charisma.total as number;
  const elementals = spirits.filter((s: any) => s.kind === "elemental" && s.services > 0).length;
  const max = maxBoundElementals(cha);
  return { rating: skill.system.rating, spirits, elementals, maxElementals: Number.isFinite(max) ? max : null };
}

/** v0.50.0: whether an actor is one of the user's targets (a token's own actor, or a linked token's actor). */
function isTargeted(a: any): boolean {
  return [...(game.user?.targets ?? [])].some((t: any) => t.actor && (t.actor.uuid === a?.uuid || (t.actor.id === a?.id && !t.actor.isToken && !a?.isToken)));
}

/** A frame or agent attacks (v0.40.0): pick a target in its host and a carried attack utility. */
export async function frameAttackDialog(frame: any): Promise<void> {
  if (!frame?.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyOwnerOrTheGmCan', { frameName: escHtml(frame?.name ?? tx('SR2E.Notify.Sheet.its')) }));
  const hostUuid = frame.system.hostUuid;
  if (!hostUuid) return ui.notifications.warn(tx('SR2E.Notify.Sheet.isNotInAHost', { frameName: escHtml(frame.name) }));
  const owner: any = frame.system.ownerUuid ? fromUuidSync(frame.system.ownerUuid) : null;
  const own = (frame.programs?.() ?? []).filter((p: any) => p.system.kind === "attack" && p.system.loaded && !p.system.erased);
  const attacks = own.length || !RULES.MATRIX.carry.ownerUtilities ? own : (owner?.programs?.() ?? []).filter((p: any) => p.system.kind === "attack" && p.system.loaded && !p.system.erased);
  if (!attacks.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.carriesNoAttackUtility', { frameName: escHtml(frame.name) }));
  const targets = allActors().filter((a: any) => a.id !== frame.id && a.uuid !== frame.system.ownerUuid && (
    (a.type === "ic" && !a.system.derived?.crashed && a.system.hostUuid === hostUuid && a.system.ownerUuid !== frame.system.ownerUuid)
    || (a.isJackedIn?.() && a.system.matrix?.hostUuid === hostUuid)));
  if (!targets.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.nothingInSHostToAttack', { frameName: escHtml(frame.name) }));
  const fd = frame.system.kind === "agent" ? tx('SR2E.App.Sheets.ratingAgentPool', { rating: frame.system.rating }) : frame.system.smart ? tx('SR2E.App.Sheets.ratingSmartFramePool', { rating: frame.system.rating }) : tx('SR2E.App.Sheets.ratingLower', { rating: frame.system.rating });
  const choice = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Sheet.attacks', { frameName: frame.name }) },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.target')}</label><select name="target">${targets.map((t: any) => `<option value="${escHtml(t.uuid)}" ${isTargeted(t) ? "selected" : ""}>${escHtml(t.name)}${t.type === "ic" ? ` (${escHtml(t.system.kind === "ic" ? tx('SR2E.Dialog.Sheet.ic') : t.system.kind)} ${escHtml(t.system.rating)})` : tx('SR2E.Dialog.Sheet.persona')}</option>`).join("")}</select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.attackUtility')}</label><select name="prog">${attacks.map((p: any) => `<option value="${escHtml(p.id)}">${escHtml(p.name)} (${escHtml(p.system.rating)}${escHtml(p.system.damageLevel)})</option>`).join("")}</select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
      <p class="hint">${tx('SR2E.Dialog.Sheet.rollsItsVsTheTargetS', { frameName: escHtml(frame.name), fd: escHtml(fd) })}</p>`,
    ok: { label: tx('SR2E.Dialog.Sheet.attack'), callback: (_e: Event, b: any) => ({ target: String(b.form.elements.target.value), prog: String(b.form.elements.prog.value), mod: Number(b.form.elements.mod.value) || 0 }) },
    rejectClose: false,
  });
  if (!choice) return;
  await frame.matrixAttack({ targetUuid: choice.target, programId: choice.prog, modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [] });
}

/** Actors that can be attacked in the Matrix from a host: its live IC, and other jacked-in personas there. */
function matrixTargets(self: any, hostUuid: string): any[] {
  const ok = (a: any) => {
    if (!a || a.uuid === self.uuid || (a.id === self.id && !a.isToken)) return false;
    if (a.type === "ic") return !a.system.derived?.crashed && (!hostUuid || a.system.hostUuid === hostUuid) && a.system.ownerUuid !== self.uuid;
    return a.isJackedIn?.() && (a.system.matrix?.hostUuid ?? "") === (hostUuid ?? "");
  };
  // v0.50.0: tokens on the scene by their own actor (an unlinked IC token is itself), then the world's.
  const out: any[] = [];
  const seen = new Set<string>();
  const push = (a: any) => { if (a && !seen.has(a.uuid) && ok(a)) { seen.add(a.uuid); out.push(a); } };
  for (const t of [...(game.user.targets ?? [])]) push((t as any).actor);
  try { for (const t of canvas?.tokens?.placeables ?? []) push(t.actor); } catch { /* no canvas */ }
  for (const a of game.actors ?? []) push(a);
  return out;
}

/** The Matrix section: shown to anyone with a cyberdeck or programs. */
function matrixContext(actor: any) {
  const items: any[] = [...actor.items];
  const decks = items.filter((i) => i.type === "cyberdeck");
  const programs = items.filter((i) => i.type === "program");
  if (!decks.length && !programs.length) return null;
  const host = actor.currentHost?.() ?? null;
  return {
    decks,
    programs: programs.map((p) => {
      const size = programSize(p.system);
      return { id: p.id, name: p.name, system: p.system,
        summary: `${p.system.kind} ${p.system.rating}${p.system.kind === "attack" ? ` (${p.system.rating}${p.system.damageLevel})` : ""}${p.system.complexForm ? tx('SR2E.App.Sheets.complexFormNoMemory') : size ? (p.system.size ? tx('SR2E.App.Sheets.sizeMp', { size }) : tx('SR2E.App.Sheets.sizeMpBook', { size })) : ""}${(p.system.options ?? []).length ? ` · ${(p.system.options as string[]).map((id) => RULES.MATRIX.programming.options.find((o) => o.id === id)?.label.replace(/\s*\(.*\)$/, "") ?? id).join(", ")}` : ""}${p.system.erased ? tx('SR2E.App.Sheets.erasedNote') : ""}`,
        isFrame: ["frame", "smart-frame", "agent"].includes(p.system.kind) && p.system.loaded && !p.system.erased,
        canLaunch: (p.system.kind === "agent" ? actor.isJackedIn?.() : Boolean(host)) && p.system.loaded && !p.system.erased,
        isSmoke: p.system.kind === "smoke" && p.system.loaded && !p.system.erased && p.system.rating > 0 && Boolean(host),
        // v0.57.0: loading into memory, and Slow / Restore utilities to run.
        loading: (() => { const l = (SR2Actor as any).loadingLeft?.(p); return l ? (l.turns != null ? tCount(l.turns, 'SR2E.App.Sheets.loadingCombatTurnsLeft') : tx('SR2E.App.Sheets.loadingSecondsLeft', { seconds: l.seconds })) : ""; })(),
        isRunnable: ["slow", "restore"].includes(p.system.kind) && p.system.loaded && !p.system.erased && (actor.isJackedIn?.() ?? false) };
    }),
    held: actor.blackIcHold?.()?.name ?? "",
    maneuvers: (() => {
      const now = (SR2Actor as any).matrixNow();
      const list: any[] = activeManeuvers(actor.system.matrix?.maneuvers ?? [], now);
      return list.map((m) => {
        const name = fromUuidSync(m.targetUuid)?.name ?? "?", net = Math.min(m.net, RULES.MATRIX_V57.maneuvers.maxTn);
        if (m.kind === "position") return tx('SR2E.App.Sheets.positionOn', { name, net });
        if (m.kind === "parry") return tx('SR2E.App.Sheets.parrying', { name, net });
        return m.kind !== "evade" ? tx('SR2E.App.Sheets.brokeContactWithNet', { name, net }) : tx('SR2E.App.Sheets.brokeContactWith', { name });
      }).join(" · ");
    })(),
    filter: (() => {
      const f = actor.system.matrix?.filter;
      if (!f?.hostUuid || f.hostUuid !== (actor.system.matrix?.hostUuid ?? "") || f.ok < 0) return "";
      const r = RULES.MATRIX_V57.realityFilter;
      return f.ok ? tx('SR2E.App.Sheets.realityFilterHoldsHere', { reaction: r.reaction, pool: r.pool }) : tx('SR2E.App.Sheets.realityFilterFightsThisHost', { tn: r.failTn });
    })(),
    riders: (actor.hitchers?.() ?? []).map((h: any) => h.name).join(", "),
    hitcherRoom: (() => { const d = actor.activeDeck?.(); return d ? tx('SR2E.App.Sheets.hitcherJacks', { used: (actor.hitchers?.() ?? []).length, total: d.system.hitchers ?? 0 }) : ""; })(),
    perDecker: RULES.MATRIX_V57.tally.perDecker,
    hasMedic: programs.some((p) => p.system.kind === "medic" && p.system.loaded && !p.system.erased),
    deckFiles: decks.flatMap((d) => (d.system.files ?? []).map((f: any, index: number) => ({ ...f, index, deckId: d.id, deckName: d.name }))),
    damagedDecks: decks.filter((d) => Object.values(d.system.damage ?? {}).some((v: any) => v > 0)).map((d) => ({ id: d.id, name: d.name,
      text: Object.entries(d.system.damage ?? {}).filter(([, v]: any) => v > 0).map(([k, v]) => `${k === "mpcp" ? "MPCP" : cap(k)} −${v}`).join(", ") })),
    crippled: Object.entries(actor.system.matrix?.crippled ?? {}).filter(([, v]: any) => v > 0).map(([k, v]) => `${cap(k)} −${v}`).join(", "),
    trace: (() => {
      const t = actor.traceStatus?.();
      if (!t) return null;
      return { ...t, when: t.turnsLeft != null ? tCount(t.turnsLeft, 'SR2E.App.Sheets.combatTurnsLeft') : t.secondsLeft != null ? tx('SR2E.App.Sheets.secondsLeft', { seconds: t.secondsLeft }) : "" };
    })(),
    passed: (actor.system.matrix?.passed ?? []).map((u: string) => fromUuidSync(u)?.name ?? tx('SR2E.App.Sheets.ic')).join(", "),
    simChoices: [{ key: "cold", label: tx('SR2E.App.Sheets.coldSim') }, { key: "hot", label: tx('SR2E.App.Sheets.hotSim') }],
    connectionChoices: RULES.MATRIX.connections.map((c) => ({ key: c.id, label: `${c.label}${c.tn ? ` (+${c.tn})` : ""}` })),
    frames: (actor.frames?.() ?? []).map((f: any) => {
      const carried = (f.programs?.() ?? []).filter((p: any) => p.system.loaded && !p.system.erased);
      const agent = f.system.kind === "agent";
      const canAct = !f.system.derived?.crashed && (agent || (actor.isJackedIn?.() ?? false));
      return { uuid: f.uuid, name: f.name, rating: f.system.rating, smart: f.system.smart, crashed: f.system.derived?.crashed, agent,
        host: f.system.hostUuid ? fromUuidSync(f.system.hostUuid)?.name ?? "?" : tx('SR2E.App.Sheets.theGrid'), hasHost: Boolean(f.system.hostUuid), monitor: f.system.matrix?.monitor ?? 0,
        carried: carried.map((p: any) => `${p.name} ${p.system.rating}`).join(", "), canAct,
        canAttack: canAct && Boolean(f.system.hostUuid) && (carried.some((p: any) => p.system.kind === "attack") || (RULES.MATRIX.carry.ownerUtilities && !carried.length && programs.some((p) => p.system.kind === "attack" && p.system.loaded && !p.system.erased))) };
    }),
    defenses: (() => {
      const m = actor.system.derived.matrix;
      if (!m) return "";
      return [m.armor ? tx('SR2E.App.Sheets.armorValue', { armor: m.armor }) : "", m.shield ? tx('SR2E.App.Sheets.shieldValue', { shield: m.shield }) : "", m.mirrors ? tx('SR2E.App.Sheets.mirrorsTnToAttacksOnYou', { mirrors: m.mirrors, tn: mirrorsTn(m.mirrors) }) : ""].filter(Boolean).join(" · ");
    })(),
    psyche: (actor.system.matrix?.psyche ?? []).map((e: any, index: number) => ({ index, label: (PSYCHOTROPIC_LABELS as any)[e.kind] ?? e.kind, icName: e.icName,
      active: e.until < 0 || e.until > sysNow(),
      when: e.until < 0 ? tx('SR2E.App.Sheets.untilYouJackOut') : tCount(Math.max(0, Math.ceil((e.until - sysNow()) / 86400)), 'SR2E.App.Sheets.daysLeft') })),
    transit: (() => {
      const t = actor.transitLeft?.();
      return t ? (t.turns != null ? tCount(t.turns, 'SR2E.App.Sheets.onTheWayToCombatTurnsLeft', { host: t.hostName }) : tx('SR2E.App.Sheets.onTheWayToSecondsLeft', { host: t.hostName, seconds: t.seconds })) : "";
    })(),
    smoke: host && (SR2Actor as any).smokeMods(host).length ? tx('SR2E.App.Sheets.smokeInHost', { rating: host.system.smoke.rating, host: host.name, tn: host.system.smoke.tn }) : "",
    security: Boolean(host && actor.isJackedIn?.() && (SR2Actor as any).isSecurityDecker(host, actor)),
    path: (() => {
      const out: string[] = [];
      let cur: any = host;
      while (cur && out.length < 6) { out.push(`${cur.name}${cur.system?.gridKind && cur.system.gridKind !== "host" ? ` (${cur.system.gridKind.toUpperCase()})` : ""}`); cur = cur.system?.parentUuid ? fromUuidSync(cur.system.parentUuid) : null; }
      return out.join(" ← ");
    })(),
    // v0.46.0: wireless links, known LTG numbers, tortoises and otaku.
    wireless: wirelessConnection(actor.system.matrix?.connection ?? "jackpoint"),
    link: (() => {
      const c = actor.matrixLink?.();
      if (!c) return null;
      if (!c.checked) return { note: c.rangeKm ? tx('SR2E.App.Sheets.reachesKmEnterRelay', { km: c.rangeKm }) : tx('SR2E.App.Sheets.noSignalRatingEnterRelay'), bad: !c.rangeKm };
      return { note: c.note, bad: !c.inRange || c.far };
    })(),
    numbers: (actor.system.matrix?.numbers ?? []).map((n: string, index: number) => ({ index, number: n,
      name: allActors().find((a: any) => a.type === "host" && String(a.system.ltgNumber ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "") === n.toUpperCase().replace(/[^A-Z0-9]/g, ""))?.name ?? "" })),
    kindNote: actor.system.derived.matrix?.tortoise ? tx('SR2E.App.Sheets.aTortoiseMeatSpeed', { pct: Math.round(RULES.MATRIX.tortoise.hackingPool * 100), extras: `${RULES.MATRIX.tortoise.coldOnly ? tx('SR2E.App.Sheets.tortoiseColdSimOnly') : ""}${RULES.MATRIX.tortoise.immuneToBlackIc ? tx('SR2E.App.Sheets.tortoiseBlackIcCantReach') : ""}${RULES.MATRIX.tortoise.dumpShock ? "" : tx('SR2E.App.Sheets.tortoiseNoDumpShock')}` })
      : actor.system.derived.matrix?.living ? tx('SR2E.App.Sheets.livingPersonaOtaku') : "",
    // v0.49.0: an otaku's channels, a jammed link, a programming suite.
    channels: actor.system.derived.matrix?.living ? RULES.MATRIX.subsystems.map((k) => ({ key: k, label: cap(k), value: actor.otakuChannel?.(k) ?? 0,
      raw: Number(actor.system.matrix?.channels?.[k] ?? 0), cost: channelRaiseCost(Number(actor.system.matrix?.channels?.[k] ?? 0) + 1) })) : null,
    otakuCap: otakuCap(actor.system.derived.matrix?.mpcp ?? 0),
    jammed: actor.system.matrix?.jammed?.active ? (actor.system.matrix.jammed.by ? tx('SR2E.App.Sheets.wirelessLinkJammedBy', { by: actor.system.matrix.jammed.by, rating: actor.system.matrix.jammed.rating }) : tx('SR2E.App.Sheets.wirelessLinkJammed', { rating: actor.system.matrix.jammed.rating })) : "",
    suite: actor.programmingSuite?.() ?? 0,
    m: actor.system.derived.matrix,
    // v0.73.0 (O24): the code shows once the character has analyzed the host (the GM always).
    host: host ? { uuid: host.uuid, name: host.name, code: host.system.securityCode, value: host.system.securityValue, known: actor.hostKnowledgeOf ? actor.hostKnowledgeOf(host) === "analyzed" : true } : null,
    jackedIn: actor.isJackedIn?.() ?? false,
    // v0.70.0: Move (straight to a host, no test) is the GM's shortcut once jacked in; players log on through Operation.
    canMove: !(actor.isJackedIn?.() ?? false) || Boolean(game.user?.isGM) || !RULES.FIXES_V70.matrixMoveGmOnly,
    isGM: Boolean(game.user?.isGM),
    // v0.67.0: the persona's track in wound groups.
    track: trackView("matrix", actor.system.matrix?.monitor ?? 0, { boxes: RULES.MATRIX.monitorBoxes, label: tx('SR2E.App.Sheets.persona') }),
  };
}

/**
 * v0.67.0: the condition monitor for the sheets, the summary and the GM panel. The Overflow row counts the
 * Body the death check uses (`monitorStatus(m, attributes.body.total)` in models and documents); spirits
 * have no overflow (they are disrupted).
 */
export function conditionMonitor(actor: any) {
  // v0.72.0 (O11): Will to Live adds Overflow boxes (derived.vitals.overflowBody).
  return monitorView(actor?.system?.monitor, Number(actor?.system?.derived?.vitals?.overflowBody ?? actor?.system?.attributes?.body?.total ?? 0), { overflow: actor?.type !== "spirit" });
}


/** Compact stat-block sheet for NPCs and critters, with a stat-block importer. */
export class SR2NpcSheet extends SR2CharacterSheet {
  static override DEFAULT_OPTIONS: Record<string, any> = {
    classes: ["npc"],
    position: { width: 560, height: 680 },
    actions: {
      importStatBlock: SR2NpcSheet.#onImportStatBlock,
    },
  };

  static override PARTS: Record<string, any> = {
    main: { template: `${SYSTEM.PATH.TEMPLATES}/actor-npc-sheet.hbs`, scrollable: [""] },
  };

  static async #onImportStatBlock(this: SR2NpcSheet) {
    const text = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.importStatBlock', { documentName: (this.document as any).name }) },
      position: { width: 520 },
      content: `<p class="hint">${tx('SR2E.Dialog.Sheet.pasteAnSr2StyleStatBlock')}</p>
        <textarea name="block" rows="12" style="width:100%;font-family:monospace" autofocus></textarea>`,
      ok: { label: tx('SR2E.Dialog.Sheet.import'), callback: (_e: Event, button: any) => String(button.form.elements.block.value ?? "") },
      rejectClose: false,
    });
    if (!text || !text.trim()) return;

    const parsed = parseStatBlock(text);
    const { created, updated, warnings } = await (this.document as any).applyStatBlock(parsed);
    ui.notifications.info(tx('SR2E.Notify.Sheet.statBlockImported', {
      attributes: Object.keys(parsed.attributes).length, skills: parsed.skills.length, weapons: parsed.weapons.length,
      cyberware: parsed.cyberware.length, spells: parsed.spells.length, powers: parsed.powers.length,
      created: escHtml(created), updated: escHtml(updated),
    }));
    for (const w of [...parsed.warnings, ...(warnings ?? [])]) ui.notifications.warn(tx('SR2E.Notify.Sheet.statBlock', { w: escHtml(w) }));
  }
}

/** Spirits and elementals: Force-driven statline, services, summoner, dismiss. */
export class SR2SpiritSheet extends SR2CharacterSheet {
  static override DEFAULT_OPTIONS: Record<string, any> = {
    classes: ["npc", "spirit"],
    position: { width: 560, height: 680 },
    actions: {
      useService: SR2SpiritSheet.#onUseService,
      dismissSpirit: SR2SpiritSheet.#onDismiss,
      teachAlly: SR2SpiritSheet.#onTeachAlly,
      buyAllyAbility: SR2SpiritSheet.#onBuyAllyAbility,
      senseLink: SR2SpiritSheet.#onSenseLink,
    },
  };

  static override PARTS: Record<string, any> = {
    main: { template: `${SYSTEM.PATH.TEMPLATES}/actor-spirit-sheet.hbs`, scrollable: [""] },
  };

  override async _prepareContext(options: any): Promise<any> {
    const context = await super._prepareContext(options);
    const sys = (this.document as any).system;
    const summoner = sys.summonerUuid ? fromUuidSync(sys.summonerUuid) : null;
    return {
      ...context,
      summoner: summoner ? { uuid: summoner.uuid, name: summoner.name } : null,
      spiritKinds: SPIRIT_KINDS.map((k) => ({ key: k, label: SPIRIT_KIND_LABELS[k] ? tKey(SPIRIT_KIND_LABELS[k]!) : cap(k) })),
      isFreeOrAlly: ["free", "ally"].includes(sys.spiritKind),
      elementChoices: elementChoices(),
      offsetRows: ATTRIBUTE_KEYS.map((k) => ({ key: k, label: game.i18n.localize(`SR2E.Attribute.${k}`), value: sys.offsets[k] })),
      immunityArmor: sys.immuneNormalWeapons ? sys.force * RULES.CONJURING.immunityArmorPerForce : 0,
      greatForm: { attributes: RULES.OCCULT.metamagic.invoking.attributeBonus, powers: RULES.OCCULT.metamagic.invoking.powerBonus },
      // v0.56.0: a nature spirit's departure, and manifesting while unmaterialized.
      departsLabel: sys.spiritKind === "nature" && Number(sys.departsAt ?? -1) >= 0 ? tx('SR2E.App.Sheets.leavesInSunriseOrSunset', { span: describeSpan(Math.max(0, Number(sys.departsAt) - sysNow())) }) : "",
      canManifestSpirit: RULES.MAGIC_V56.manifest.enabled && (sys.materialized === false || Boolean(sys.manifesting)),
      manifesting: Boolean((this.document as any).isManifesting?.()),
      // v0.72.0 (O21): an ally's spells taught by its master, its abilities and the sense link (MAGIC_V72.ally).
      allyPanel: sys.spiritKind === "ally" && RULES.MAGIC_V72.ally.enabled && summoner ? (() => {
        const have = ((this.document as any).getFlag?.(SYSTEM.id, "allyAbilities") ?? {}) as Record<string, boolean>;
        const link = (summoner as any).getFlag?.(SYSTEM.id, "senseLink") as { allyUuid: string; on: boolean } | undefined;
        return {
          abilities: RULES.MAGIC_V72.ally.abilities.map((a: any) => ({ ...a, has: Boolean(have[a.id]) })),
          spellKarmaPerForce: RULES.MAGIC_V72.ally.spellKarmaPerForce,
          senseLinkOn: Boolean(link?.on && link.allyUuid === (this.document as any).uuid),
          canLink: Boolean(have["senseLink"]),
        };
      })() : null,
    };
  }

  /** v0.72.0 (O21): the master teaches the ally one of their spells. */
  static async #onTeachAlly(this: SR2SpiritSheet) {
    const ally: any = this.document;
    const master: any = ally.system.summonerUuid ? fromUuidSync(ally.system.summonerUuid) : null;
    if (!master) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thisAllyHasNoMaster'));
    const spells = [...master.items].filter((i: any) => i.type === "spell" && ![...ally.items].some((x: any) => x.type === "spell" && x.name === i.name));
    if (!spells.length) return ui.notifications.info(tx('SR2E.Notify.Sheet.knowsNoSpellDoesnT', { masterName: escHtml(master.name), allyName: escHtml(ally.name) }));
    const id = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.teachASpell', { allyName: ally.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.spell')}</label><select name="spell">${spells.map((s: any) => `<option value="${escHtml(s.id)}">${tx('SR2E.Dialog.Sheet.forceGoodKarma', { name: escHtml(s.name), learnedForce: escHtml(s.system.learnedForce), allySpellKarma: allySpellKarma(Number(s.system.learnedForce ?? 1)) })}</option>`).join("")}</select></div>`,
      ok: { label: tx('SR2E.Dialog.Sheet.teach'), callback: (_e: Event, b: any) => String(b.form.elements.spell.value) },
      rejectClose: false,
    });
    if (id) await master.teachAlly(ally.uuid, id);
  }

  /** v0.72.0 (O21): the master buys the ally an ability. */
  static async #onBuyAllyAbility(this: SR2SpiritSheet, _e: Event, target: HTMLElement) {
    const ally: any = this.document;
    const master: any = ally.system.summonerUuid ? fromUuidSync(ally.system.summonerUuid) : null;
    if (!master) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thisAllyHasNoMaster'));
    await master.buyAllyAbility(ally.uuid, String(target.dataset["ability"] ?? ""));
  }

  /** v0.72.0 (O21): the master switches the sense link on or off. */
  static async #onSenseLink(this: SR2SpiritSheet) {
    const ally: any = this.document;
    const master: any = ally.system.summonerUuid ? fromUuidSync(ally.system.summonerUuid) : null;
    if (!master?.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyTheMasterSOwnerOr'));
    const link = master.getFlag?.(SYSTEM.id, "senseLink") as { allyUuid: string; on: boolean } | undefined;
    await master.setSenseLink(ally.uuid, !(link?.on && link.allyUuid === ally.uuid));
  }

  static async #onUseService(this: SR2SpiritSheet) {
    await (this.document as any).useService();
  }

  static async #onDismiss(this: SR2SpiritSheet) {
    const actor: any = this.document;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Sheet.dismiss2', { actorName: actor.name }) },
      content: `<p>${tx('SR2E.Dialog.Sheet.dismiss')} <strong>${escHtml(actor.name)}</strong>${tx('SR2E.Dialog.Sheet.itsActorAndAnyTokensOf')}</p>`,
      rejectClose: false,
    });
    if (!ok) return;
    // v0.81.0 (S-7, R2-REST 5): all or nothing. This client dismisses the spirit itself only when it may delete the
    // actor and every token of it; otherwise the whole dismissal goes to the active GM (who checks the sender owns
    // the spirit). Nothing is deleted here first, so a missing GM leaves the spirit as it was.
    const user: any = game.user;
    if (user?.isGM || mayDismissHere(actor, user)) {
      const r = await dismissSpiritNow(actor);
      if (!r.ok) ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.askTheGmToDismissIt', { note: escHtml(r.note ?? tx('SR2E.Notify.Sheet.wasNotDismissed', { actorName: actor.name })) }));
      return;
    }
    const r = await requestGm(DISMISS_SPIRIT_OP, { actorUuid: String(actor.uuid ?? "") });
    // v0.81.1 (S2-6): a slow GM client may answer after the timeout although the spirit is gone: look before warning.
    if (!r.ok && fromUuidSync(String(actor.uuid ?? ""))) ui.notifications?.warn?.(tx('SR2E.Notify.Sheet.wasNotDismissed2', { actorName: escHtml(actor.name), note: escHtml(r.note ?? tx('SR2E.Notify.Sheet.theGmSClientRefused')) }));
  }
}

/**
 * v0.81.0 (S-15, R2-REST 10): most copies of a party the GM's Launch IC dialog makes at once. A UI limit only, not
 * a rule: it is not RULES.SECURITY_V61.sheafIc.maxCopies (4, the copies one sheaf step launches by itself).
 */
const LAUNCH_IC_MAX_COPIES = 8;

/** v0.81.0 (S-7): the relay operation that dismisses a spirit for a player who owns it (see `onRelay` below). */
const DISMISS_SPIRIT_OP: RelayOp = "dismissSpirit";

/**
 * v0.81.0 (S-7): a spirit's tokens on every scene, grouped by scene. v0.81.1 (S2-3, SEC1-9): an unlinked token's
 * spirit (a synthetic actor, whose `id` is its base actor's) is that one token only, not every copy of the base actor.
 */
function spiritTokenGroups(actor: any): Array<{ scene: any; tokens: any[] }> {
  if (actor?.isToken) {
    const tok: any = actor.token;
    return tok?.parent ? [{ scene: tok.parent, tokens: [tok] }] : [];
  }
  const out: Array<{ scene: any; tokens: any[] }> = [];
  for (const scene of game.scenes ?? []) {
    const tokens = [...(scene.tokens ?? [])].filter((t: any) => t.actorId === actor.id);
    if (tokens.length) out.push({ scene, tokens });
  }
  return out;
}

/** v0.81.0 (S-7): whether `user` may delete the spirit's actor and every token of it (Foundry's own checks). */
function mayDismissHere(actor: any, user: any): boolean {
  // v0.81.1 (S2-3): an unlinked token's spirit goes with its token.
  if (actor?.isToken) return Boolean(actor.token?.canUserModify?.(user, "delete"));
  if (!actor?.canUserModify?.(user, "delete")) return false;
  return spiritTokenGroups(actor).every((g) => g.tokens.every((t: any) => Boolean(t.canUserModify?.(user, "delete"))));
}

/**
 * v0.81.0 (S-7): dismiss a spirit on this client: its tokens, then (only once they're really gone: Foundry may
 * warn rather than reject on a refused delete) the actor, then the card.
 */
async function dismissSpiritNow(actor: any): Promise<{ ok: boolean; note?: string }> {
  const name = String(actor.name ?? "");
  const groups = spiritTokenGroups(actor);
  for (const g of groups) {
    try {
      await g.scene.deleteEmbeddedDocuments("Token", g.tokens.map((t: any) => t.id));
    } catch (err) {
      console.warn(`${SYSTEM.LOG.HEAD}Could not remove ${name}'s tokens from ${g.scene.name}`, err);
    }
  }
  const left = groups.filter((g) => g.tokens.some((t: any) => g.scene.tokens?.get?.(t.id)));
  if (left.length) return { ok: false, note: tx('SR2E.App.Sheets.tokensCouldNotBeRemoved', { name, scenes: left.map((g) => String(g.scene.name ?? g.scene.id)).join(", ") }) };
  const speaker = ChatMessage.getSpeaker({ actor });
  // v0.81.1 (S2-3): an unlinked token's spirit went with its token; only a world actor is deleted.
  if (!actor.isToken) await actor.delete();
  await ChatMessage.create({ speaker, content: `<p><strong>${escHtml(name)}</strong> ${tx('SR2E.Card.Sheet.isDismissed')}</p>` });
  return { ok: true };
}

// v0.81.0 (S-7): the active GM dismisses a spirit for the player who asked, if that player (the server-set sender)
// owns it. The actor comes from the uuid in the request and must be a spirit; nothing else in the request is used.
onRelay(DISMISS_SPIRIT_OP, async (d, user) => {
  const actor: any = typeof d["actorUuid"] === "string" ? fromUuidSync(d["actorUuid"]) : null;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "spirit") return { ok: false, note: tx('SR2E.App.Sheets.noSuchSpirit') };
  if (!user?.isGM && !actor.testUserPermission?.(user, "OWNER")) return { ok: false, note: tx('SR2E.App.Sheets.userDoesntOwn', { user: user?.name ?? tx('SR2E.App.Sheets.thatUser'), name: actor.name }) };
  return dismissSpiritNow(actor);
});

/** Wards and astral barriers: rating, kind, restore. */
export class SR2BarrierSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** v0.59.0: dropped items arrive uninstalled / unbonded / unloaded, move between actors, and only fitting types (applications/drops.ts). */
  async _onDropItem(event: any, item: any): Promise<any> {
    return dropItemOnActor(this, event, item, () => (super._onDropItem as any)(event, item));
  }

  static DEFAULT_OPTIONS: Record<string, any> = {
    classes: ["sr2e", "sheet", "actor", "barrier"],
    position: { width: 420, height: 360 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: { restoreBarrier: SR2BarrierSheet.#onRestore },
  };

  static PARTS: Record<string, any> = {
    main: { template: `${SYSTEM.PATH.TEMPLATES}/actor-barrier-sheet.hbs`, scrollable: [""] },
  };

  async _prepareContext(options: any): Promise<any> {
    const context = await super._prepareContext(options);
    const actor: any = this.document;
    return {
      ...context, actor, system: actor.system,
      kinds: BARRIER_KINDS.map((k) => ({ key: k, label: cap(k) })),
    };
  }

  static async #onRestore(this: SR2BarrierSheet) {
    const actor: any = this.document;
    await actor.update({ "system.rating": actor.system.baseRating });
  }
}

/** A Matrix host: security code/value, subsystems, security tally, sheaf and its IC. */
export class SR2HostSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** v0.59.0: dropped items arrive uninstalled / unbonded / unloaded, move between actors, and only fitting types (applications/drops.ts). */
  async _onDropItem(event: any, item: any): Promise<any> {
    return dropItemOnActor(this, event, item, () => (super._onDropItem as any)(event, item));
  }

  static DEFAULT_OPTIONS: Record<string, any> = {
    classes: ["sr2e", "sheet", "actor", "host"],
    position: { width: 560, height: 620 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      resetTally: SR2HostSheet.#onResetTally,
      addStep: SR2HostSheet.#onAddStep,
      editStep: SR2HostSheet.#onEditStep,
      deleteStep: SR2HostSheet.#onDeleteStep,
      launchIc: SR2HostSheet.#onLaunchIc,
      openActor: SR2HostSheet.#onOpenActor,
      addSecurity: SR2HostSheet.#onAddSecurity,
      removeSecurity: SR2HostSheet.#onRemoveSecurity,
      clearSmoke: SR2HostSheet.#onClearSmoke,
      unspot: SR2HostSheet.#onUnspot,
      addFile: SR2HostSheet.#onAddFile,
      editFile: SR2HostSheet.#onEditFile,
      deleteFile: SR2HostSheet.#onDeleteFile,
      generatePaydata: SR2HostSheet.#onGeneratePaydata,
      generateSheaf: SR2HostSheet.#onGenerateSheaf,
      resetFound: SR2HostSheet.#onResetFound,
      // v0.57.0
      shutdownNow: SR2HostSheet.#onShutdownNow,
      cancelShutdown: SR2HostSheet.#onCancelShutdown,
      invalidate: SR2HostSheet.#onInvalidate,
      addBomb: SR2HostSheet.#onAddBomb,
      deleteBomb: SR2HostSheet.#onDeleteBomb,
      endCall: SR2HostSheet.#onEndCall,
    },
  };

  static PARTS: Record<string, any> = {
    main: { template: `${SYSTEM.PATH.TEMPLATES}/actor-host-sheet.hbs`, scrollable: [""] },
  };

  async _prepareContext(options: any): Promise<any> {
    const context = await super._prepareContext(options);
    const actor: any = this.document;
    const sheaf = (actor.system.sheaf ?? []).map((st: any, index: number) => ({ ...st, index, reached: actor.system.tally >= st.step,
      // v0.61.0: the IC the step launches, and whether it has.
      icLabel: (() => { const ic = icFromStep(st, { securityValue: Number(actor.system.securityValue ?? 0), name: String(actor.name) }); return ic ? `${ic.icType}-${ic.rating}${ic.copies > 1 ? ` ×${ic.copies}` : ""}` : ""; })(),
      launched: (actor.system.launchedSteps ?? []).includes(st.step) }))
      .sort((a: any, b: any) => a.step - b.step);
    return {
      ...context, actor, system: actor.system,
      codes: RULES.MATRIX.securityCodes.map((k) => ({ key: k, label: cap(k) })),
      alerts: RULES.MATRIX.alerts.map((k) => ({ key: k, label: cap(k) })),
      subsystems: RULES.MATRIX.subsystems.map((k) => ({ key: k, label: cap(k), value: actor.system.subsystems[k] })),
      sheaf,
      ic: allActors().filter((a: any) => a.type === "ic" && a.system.hostUuid === actor.uuid)
        .map((a: any) => ({ uuid: a.uuid, name: a.name, rating: a.system.rating, category: a.system.category, status: a.system.derived?.status,
          behavior: IC_BEHAVIOR_LABELS[a.system.behavior as keyof typeof IC_BEHAVIOR_LABELS] ?? a.system.behavior, guards: a.system.guards ? cap(a.system.guards) : "",
          party: a.system.party ?? "", construct: (a.system.construct ?? []).map((b: string) => IC_BEHAVIOR_LABELS[b as keyof typeof IC_BEHAVIOR_LABELS] ?? b).join(", ") })),
      files: (actor.system.files ?? []).map((f: any, index: number) => ({ ...f, index,
        defense: f.scramble ? tx('SR2E.App.Sheets.scrambleValue', { rating: f.scramble }) : f.encrypted ? tx('SR2E.App.Sheets.encryptedValue', { rating: f.encrypted }) : "",
        found: (f.foundBy ?? []).map((u: string) => fromUuidSync(u)?.name ?? "?").join(", ") })),
      deckers: allActors().filter((a: any) => a.isJackedIn?.() && a.system.matrix.hostUuid === actor.uuid).map((a: any) => ({ uuid: a.uuid, name: a.name,
        security: (actor.system.securityDeckers ?? []).includes(a.uuid), spotted: (actor.system.spotted ?? []).includes(a.uuid) })),
      securityDeckers: (actor.system.securityDeckers ?? []).map((u: string, index: number) => {
        const a: any = fromUuidSync(u);
        return { index, uuid: u, name: a?.name ?? tx('SR2E.App.Sheets.gone'), here: Boolean(a?.isJackedIn?.() && a.system.matrix?.hostUuid === actor.uuid) };
      }),
      smoke: (SR2Actor as any).smokeMods(actor).length ? (actor.system.smoke.round >= 0
        ? tx('SR2E.App.Sheets.smokeByUntilCombatTurn', { rating: actor.system.smoke.rating, by: actor.system.smoke.by, tn: actor.system.smoke.tn, round: actor.system.smoke.round })
        : tx('SR2E.App.Sheets.smokeBy', { rating: actor.system.smoke.rating, by: actor.system.smoke.by, tn: actor.system.smoke.tn })) : "",
      gridKinds: RULES.MATRIX.grid.kinds.map((k) => ({ key: k, label: k === "host" ? tx('SR2E.App.Sheets.host') : k.toUpperCase() })),
      parents: [{ key: "", label: tx('SR2E.App.Sheets.none') }, ...allActors().filter((a: any) => a.type === "host" && a.uuid !== actor.uuid && a.system.gridKind !== "host").map((a: any) => ({ key: a.uuid, label: `${a.name} (${a.system.gridKind.toUpperCase()})` }))],
      children: allActors().filter((a: any) => a.type === "host" && a.system.parentUuid === actor.uuid).map((a: any) => ({ uuid: a.uuid, name: a.name, kind: (a.system.gridKind ?? "host").toUpperCase() })),
      // v0.57.0: each intruder's tally, a shutdown under way, valid passcodes, data bombs, comcalls.
      tallies: [...(actor.system.tallies ?? [])].sort((a: any, b: any) => b.tally - a.tally),
      shutdown: (() => {
        const sd = actor.system.shutdown;
        if (!sd?.pending) return "";
        const combat: any = game.combat;
        const left = sd.round >= 0 && combat?.started ? tCount(Math.max(0, sd.round - Number(combat.round ?? 0)), 'SR2E.App.Sheets.combatTurnsSLeft') : sd.worldTime >= 0 ? tx('SR2E.App.Sheets.secondsLeft', { seconds: Math.max(0, Math.round(sd.worldTime - sysNow())) }) : "";
        return left ? tx('SR2E.App.Sheets.shuttingDownLeft', { left }) : tx('SR2E.App.Sheets.shuttingDown');
      })(),
      validated: (actor.system.validated ?? []).map((u: string) => ({ uuid: u, name: fromUuidSync(u)?.name ?? tx('SR2E.App.Sheets.gone') })),
      bombs: (actor.system.bombs ?? []).map((b: any, index: number) => ({ ...b, index, subsystem: cap(b.subsystem), found: (b.foundBy ?? []).map((u: string) => fromUuidSync(u)?.name ?? "?").join(", ") })),
      isLtg: actor.system.gridKind === "ltg",
      calls: (actor.system.calls ?? []).map((c: any) => ({ ...c, tapped: (c.tappedBy ?? []).join(", ") })),
    };
  }

  static async #onResetTally(this: SR2HostSheet) {
    // v0.70.0: each decker's launched sheaf steps too.
    await (this.document as any).update({ "system.tally": 0, "system.tallies": [], "system.alert": "none", "system.launchedSteps": [], "flags.sr2e.sheafLaunched": [] });
  }

  static async #onShutdownNow(this: SR2HostSheet) {
    await (SR2Actor as any).dumpHost(this.document);
  }

  static async #onCancelShutdown(this: SR2HostSheet) {
    await (this.document as any).update({ "system.shutdown": { pending: false, round: -1, worldTime: -1 } });
  }

  static async #onInvalidate(this: SR2HostSheet, _event: Event, target: HTMLElement) {
    const host: any = this.document;
    await host.update({ "system.validated": (host.system.validated ?? []).filter((u: string) => u !== target.dataset["uuid"]) });
  }

  static async #onAddBomb(this: SR2HostSheet) {
    const host: any = this.document;
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.addADataBomb', { hostName: host.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.subsystem')}</label><select name="sub">${RULES.MATRIX.subsystems.map((k) => `<option value="${k}">${escHtml(cap(k))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.rating2')}</label><input name="rating" type="number" value="${escHtml(host.system.securityValue)}" min="1"></div>
        <label class="sr2e-check"><input type="checkbox" name="pavlov"> ${tx('SR2E.Dialog.Sheet.pavlovReArmsAfterGoingOff')}</label>`,
      ok: { label: tx('SR2E.Dialog.Sheet.add'), callback: (_e: Event, b: any) => ({ subsystem: String(b.form.elements.sub.value), rating: Math.max(1, Math.floor(Number(b.form.elements.rating.value) || 1)), pavlov: Boolean(b.form.elements.pavlov.checked), foundBy: [] }) },
      rejectClose: false,
    });
    if (!r) return;
    await host.update({ "system.bombs": [...(host.system.bombs ?? []).map((b: any) => ({ ...b })), r] });
  }

  static async #onDeleteBomb(this: SR2HostSheet, _event: Event, target: HTMLElement) {
    const host: any = this.document;
    const list = [...(host.system.bombs ?? [])].map((b: any) => ({ ...b }));
    if (!spliceRow(list, target)) return;
    await host.update({ "system.bombs": list });
  }

  static async #onEndCall(this: SR2HostSheet, _event: Event, target: HTMLElement) {
    const host: any = this.document;
    await host.update({ "system.calls": (host.system.calls ?? []).filter((c: any) => c.id !== target.dataset["id"]) });
  }

  static async #stepDialog(actor: any, index: number | null) {
    const list = [...(actor.system.sheaf ?? [])].map((x: any) => ({ step: x.step, event: x.event, alert: x.alert, ic: { ...(x.ic ?? {}) } }));
    const st: any = index === null ? { step: (list.at(-1)?.step ?? 0) + 4, event: "", alert: "", ic: {} } : list[index];
    if (!st) return;
    // v0.61.0: the IC this step launches (blank type: read from the event text, e.g. "Killer-6 IC").
    const ic = { icType: "", category: "", rating: 0, behavior: "", damageLevel: "M", copies: 1, ...(st.ic ?? {}) };
    const opt = (list: string[], cur: string) => list.map((k) => `<option value="${escHtml(k)}" ${cur === k ? "selected" : ""}>${escHtml(k || tx('SR2E.Dialog.Sheet.fromTheType'))}</option>`).join("");
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.sheafStep', { part: index === null ? tx('SR2E.Dialog.Sheet.add') : tx('SR2E.Dialog.Sheet.edit2'), actorName: actor.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.triggerStepTally')}</label><input name="step" type="number" value="${escHtml(st.step)}" min="0" autofocus></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.event')}</label><input name="event" type="text" value="${escHtml(st.event)}" placeholder="${tx('SR2E.Dialog.Sheet.eGKiller6Ic')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.raiseAlertTo')}</label><select name="alert"><option value="">${tx('SR2E.Dialog.Sheet.noChange')}</option>
          ${RULES.MATRIX.alerts.filter((k) => k !== "none").map((k) => `<option value="${k}" ${st.alert === k ? "selected" : ""}>${escHtml(cap(k))}</option>`).join("")}</select></div>
        <fieldset><legend>${tx('SR2E.Dialog.Sheet.icItLaunches')}</legend>
          <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.icType')}</label><input name="icType" type="text" value="${escHtml(ic.icType)}" placeholder="${tx('SR2E.Dialog.Sheet.blankReadFromTheEventE')}"></div>
          <div class="sr2e-row"><label>${tx('SR2E.Dialog.Sheet.category')} <select name="icCategory">${opt(["", "white", "gray", "black"], ic.category)}</select></label>
            <label title="${tx('SR2E.Dialog.Sheet.n0TheHostSSecurityValue')}">${tx('SR2E.Dialog.Sheet.rating2')} <input name="icRating" type="number" value="${escHtml(ic.rating)}" min="0" style="width:4em"></label>
            <label>${tx('SR2E.Dialog.Sheet.damage')} <select name="icLevel">${opt(["L", "M", "S", "D"], ic.damageLevel)}</select></label>
            <label>${tx('SR2E.Dialog.Sheet.copies')} <input name="icCopies" type="number" value="${escHtml(ic.copies)}" min="1" max="${RULES.SECURITY_V61.sheafIc.maxCopies}" style="width:4em"></label></div>
          <p class="hint">${RULES.SECURITY_V61.sheafIc.autoLaunch ? tx('SR2E.Dialog.Sheet.reachingTheStepLaunchesItOnce') : tx('SR2E.Dialog.Sheet.launchingByItselfIsSwitchedOff')}</p>
        </fieldset>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.save'),
        callback: (_e: Event, b: any) => {
          const el = b.form.elements;
          return { step: Math.max(0, Math.floor(Number(el.step.value) || 0)), event: String(el.event.value ?? "").trim(), alert: String(el.alert.value ?? ""),
            ic: { icType: String(el.icType.value ?? "").trim(), category: String(el.icCategory.value ?? ""), rating: Math.max(0, Math.floor(Number(el.icRating.value) || 0)), behavior: String(ic.behavior ?? ""), damageLevel: String(el.icLevel.value || "M"), copies: Math.max(1, Math.min(RULES.SECURITY_V61.sheafIc.maxCopies, Math.floor(Number(el.icCopies.value) || 1))) } };
        },
      },
      rejectClose: false,
    });
    if (!result) return;
    if (index === null) list.push(result);
    else list[index] = result;
    await actor.update({ "system.sheaf": list });
  }

  static async #onAddStep(this: SR2HostSheet) {
    await SR2HostSheet.#stepDialog(this.document, null);
  }

  static async #onEditStep(this: SR2HostSheet, _event: Event, target: HTMLElement) {
    await SR2HostSheet.#stepDialog(this.document, Number(target.dataset["index"]));
  }

  static async #onDeleteStep(this: SR2HostSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const list = [...(actor.system.sheaf ?? [])].map((x: any) => ({ step: x.step, event: x.event, alert: x.alert, ic: { ...(x.ic ?? {}) } }));
    if (!spliceRow(list, target)) return;
    await actor.update({ "system.sheaf": list });
  }

  static async #onLaunchIc(this: SR2HostSheet) {
    const host: any = this.document;
    if (!(game.user?.isGM || game.user?.can?.("ACTOR_CREATE"))) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyTheGmCanLaunchIc'));
    const data = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.launchIc', { hostName: host.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.ic')}</label><input name="icType" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGKillerProbeBlasterBlack')}" autofocus></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.category')}</label><select name="category">${IC_CATEGORIES.map((k) => `<option value="${k}">${escHtml(cap(k))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.rating2')}</label><input name="rating" type="number" value="${escHtml(host.system.securityValue)}" min="1"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.damageLevel')}</label><select name="level">${["L", "M", "S", "D"].map((k) => `<option value="${escHtml(k)}" ${k === "M" ? "selected" : ""}>${escHtml(k)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.blackIcDamages')}</label><select name="dtype"><option value="physical">${tx('SR2E.Dialog.Sheet.physical')}</option><option value="stun">${tx('SR2E.Dialog.Sheet.stun')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.behavior')}</label><select name="behavior"><option value="">${tx('SR2E.Dialog.Sheet.fromTheIcNameElseKiller')}</option>${IC_BEHAVIORS.map((k) => `<option value="${k}">${escHtml(IC_BEHAVIOR_LABELS[k])}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.barrierGuards')}</label><select name="guards"><option value="">${tx('SR2E.Dialog.Sheet.nothing')}</option>${RULES.MATRIX.subsystems.map((k) => `<option value="${k}">${escHtml(cap(k))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.traceThen')}</label><select name="traceMode">${TRACE_MODES.map((k) => `<option value="${k}">${escHtml(cap(k))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.cripplerRipperGoesAfter')}</label><select name="attribute">${PERSONA_ATTRIBUTES.map((k) => `<option value="${k}" ${k === "evasion" ? "selected" : ""}>${escHtml(cap(k))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.psychotropicPayload')}</label><select name="payload"><option value="">${tx('SR2E.Dialog.Sheet.fromTheIcName')}</option>${RULES.MATRIX.psychotropic.kinds.map((k) => `<option value="${k}">${escHtml((PSYCHOTROPIC_LABELS as any)[k] ?? k)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.partyIcWithTheSameName')}</label><input name="party" type="text" placeholder="${tx('SR2E.Dialog.Sheet.none')}" list="sr2e-parties"><datalist id="sr2e-parties">${[...new Set(allActors().filter((a: any) => a.type === "ic" && a.system.hostUuid === host.uuid && a.system.party).map((a: any) => a.system.party))].map((p: any) => `<option value="${escHtml(p)}">`).join("")}</datalist></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.partyHowManyCopies')}</label><input name="copies" type="number" value="1" min="1" max="${LAUNCH_IC_MAX_COPIES}"></div>
        <p>${tx('SR2E.Dialog.Sheet.constructAlsoActsAs')}</p>${IC_BEHAVIORS.filter((k) => k !== "other").map((k) => `<label class="sr2e-check"><input type="checkbox" name="construct" value="${k}"> ${escHtml(IC_BEHAVIOR_LABELS[k])}</label>`).join("")}`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.launch'),
        callback: (_e: Event, b: any) => {
          const el = b.form.elements;
          const icType = String(el.icType.value ?? "").trim();
          const rating = Math.max(1, Math.floor(Number(el.rating.value) || 1));
          const behavior = String(el.behavior.value || "") || behaviorFromName(icType) || "killer";
          // A psychotropic IC is black IC.
          if (behavior === "psychotropic" && el.category.value !== "black") el.category.value = "black";
          const construct = [...b.form.querySelectorAll('input[name="construct"]:checked')].map((i: any) => String(i.value)).filter((k: string) => k !== behavior).slice(0, Math.max(0, RULES.MATRIX.construct.maxComponents - 1));
          return { name: `${icType || IC_BEHAVIOR_LABELS[behavior as keyof typeof IC_BEHAVIOR_LABELS] || "IC"}-${rating} (${host.name})`, icType, category: String(el.category.value), rating, damageLevel: String(el.level.value), damageType: String(el.dtype.value),
            behavior, guards: String(el.guards.value || ""), traceMode: String(el.traceMode.value), attribute: String(el.attribute.value), payload: String(el.payload.value || ""),
            party: String(el.party.value ?? "").trim(), construct, copies: Math.max(1, Math.min(LAUNCH_IC_MAX_COPIES, Math.floor(Number(el.copies.value) || 1))) };
        },
      },
      rejectClose: false,
    });
    if (!data) return;
    // A party of several copies gets numbered names.
    const n = data.party ? data.copies : 1;
    for (let i = 1; i <= n; i++) await (SR2Actor as any).launchIc(host, n > 1 ? { ...data, name: `${data.name} #${i}` } : data);
    this.render();
  }

  /** GM: make a character with a cyberdeck one of this host's security deckers (v0.40.0). */
  static async #onAddSecurity(this: SR2HostSheet) {
    const host: any = this.document;
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyTheGmCanNameSecurity'));
    const have: string[] = host.system.securityDeckers ?? [];
    const options = allActors().filter((a: any) => ["character", "npc"].includes(a.type) && [...a.items].some((i: any) => i.type === "cyberdeck") && !have.includes(a.uuid));
    if (!options.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.noOtherCharacterOrNpcHas'));
    const pick = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.securityDecker', { hostName: host.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.decker')}</label><select name="who" autofocus>${options.map((a: any) => `<option value="${escHtml(a.uuid)}">${escHtml(a.name)}</option>`).join("")}</select></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.aSecurityDeckerJackedInHere')}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.add'), callback: (_e: Event, b: any) => String(b.form.elements.who.value) },
      rejectClose: false,
    });
    if (!pick) return;
    await host.update({ "system.securityDeckers": [...have, pick] });
  }

  static async #onRemoveSecurity(this: SR2HostSheet, _event: Event, target: HTMLElement) {
    const host: any = this.document;
    const list = [...(host.system.securityDeckers ?? [])];
    if (!spliceRow(list, target)) return;
    await host.update({ "system.securityDeckers": list });
  }

  static async #onClearSmoke(this: SR2HostSheet) {
    await (this.document as any).update({ "system.smoke": { rating: 0, tn: 0, by: "", round: -1, worldTime: -1 } });
  }

  static async #onUnspot(this: SR2HostSheet, _event: Event, target: HTMLElement) {
    const host: any = this.document;
    await host.update({ "system.spotted": (host.system.spotted ?? []).filter((u: string) => u !== target.dataset["uuid"]) });
  }

  static #onOpenActor(this: SR2HostSheet, _event: Event, target: HTMLElement) {
    const uuid = target.dataset["uuid"];
    if (uuid) fromUuidSync(uuid)?.sheet?.render(true);
  }

  /** Add or edit a file in the host's data stores. */
  static async #fileDialog(host: any, index: number | null) {
    const list = [...(host.system.files ?? [])].map((f: any) => ({ ...f, foundBy: [...(f.foundBy ?? [])] }));
    const f = index === null ? { id: foundry.utils.randomID(), name: "", size: 10, value: 0, paydata: false, encrypted: 0, scramble: 0, foundBy: [] } : list[index];
    if (!f) return;
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.file', { part: index === null ? tx('SR2E.Dialog.Sheet.add') : tx('SR2E.Dialog.Sheet.edit2'), hostName: host.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.name')}</label><input name="name" type="text" value="${escHtml(f.name)}" autofocus></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.sizeMp')}</label><input name="size" type="number" value="${escHtml(f.size)}" min="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.paydata')}</label><input name="paydata" type="checkbox" ${f.paydata ? "checked" : ""}></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.value')}</label><input name="value" type="number" value="${escHtml(f.value)}" min="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.encryptionRating0None')}</label><input name="encrypted" type="number" value="${escHtml(f.encrypted)}" min="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.scrambleIcRating0None')}</label><input name="scramble" type="number" value="${escHtml(f.scramble)}" min="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.dataBombRating0None')}</label><input name="bomb" type="number" value="${escHtml(f.bomb ?? 0)}" min="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.pavlovBombReArmsLeavesThe')}</label><input name="pavlov" type="checkbox" ${f.pavlov ? "checked" : ""}></div>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.save'),
        callback: (_e: Event, b: any) => {
          const el = b.form.elements;
          const n = (x: any) => Math.max(0, Math.floor(Number(x.value) || 0));
          return { name: String(el.name.value ?? "").trim() || "File", size: n(el.size), value: n(el.value), paydata: Boolean(el.paydata.checked), encrypted: n(el.encrypted), scramble: n(el.scramble),
            bomb: n(el.bomb), pavlov: Boolean(el.pavlov.checked) };
        },
      },
      rejectClose: false,
    });
    if (!r) return;
    const file = { ...f, ...r };
    if (index === null) list.push(file);
    else list[index] = file;
    await host.update({ "system.files": list });
  }

  static async #onAddFile(this: SR2HostSheet) {
    await SR2HostSheet.#fileDialog(this.document, null);
  }

  static async #onEditFile(this: SR2HostSheet, _event: Event, target: HTMLElement) {
    await SR2HostSheet.#fileDialog(this.document, Number(target.dataset["index"]));
  }

  static async #onDeleteFile(this: SR2HostSheet, _event: Event, target: HTMLElement) {
    const host: any = this.document;
    const list = [...(host.system.files ?? [])];
    if (!spliceRow(list, target)) return;
    await host.update({ "system.files": list });
  }

  static async #onGeneratePaydata(this: SR2HostSheet) {
    await (SR2Actor as any).generatePaydata(this.document);
  }

  /** v0.71.0 (R9): roll a VR2-style security sheaf from the code and value (asks before replacing steps). */
  static async #onGenerateSheaf(this: SR2HostSheet) {
    const host: any = this.document;
    if ((host.system.sheaf ?? []).length) {
      const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Sheet.generateSheaf', { hostName: host.name }) }, content: `<p>${tx('SR2E.Dialog.Sheet.replaceTheSheafStepWithA', { sheafLength: tCount(Number(host.system.sheaf.length), 'SR2E.Count.sheafStep'), hostSecurityCode: escHtml(host.system.securityCode), hostSecurityValue: escHtml(host.system.securityValue) })}</p>`, rejectClose: false });
      if (!ok) return;
    }
    const steps = sheafFor(host.system, `${host.id}|${Date.now()}`);
    await host.update({ "system.sheaf": steps, "system.launchedSteps": [] });
    ui.notifications.info(tx('SR2E.Notify.Sheet.sheafStepGenerated', { hostName: escHtml(host.name), stepsLength: tCount(steps.length, 'SR2E.Count.sheafStep') }));
  }

  static async #onResetFound(this: SR2HostSheet) {
    const host: any = this.document;
    await host.update({ "system.files": [...(host.system.files ?? [])].map((f: any) => ({ ...f, foundBy: [] })) });
  }
}

/** A line explaining what an IC does when it acts. */
function icBehaviorHint(sys: any): string {
  const b = sys.behavior ?? "killer";
  const r = sys.rating;
  const defend = RULES.MATRIX.defense.persona === "pool" ? tx('SR2E.App.Sheets.icPersonaMayDefend') : "";
  switch (icActionKind(b)) {
    case "damage": {
      if (b === "psychotropic") return tx('SR2E.App.Sheets.icPsychotropic', { payload: (PSYCHOTROPIC_LABELS as any)[sys.payload] ?? tx('SR2E.App.Sheets.fromItsName'), rating: r, track: sys.damageType, resist: cap(RULES.MATRIX.psychotropic.resist), defend });
      const resist = sys.category === "black" ? tx('SR2E.App.Sheets.icBlackResists', { attribute: cap(RULES.MATRIX.blackIcResist), track: sys.damageType }) : tx('SR2E.App.Sheets.icPersonaResists');
      const crash = b === "blaster" ? tx('SR2E.App.Sheets.icCrashDamagesMpcp') : b === "sparky" ? tx('SR2E.App.Sheets.icCrashDamagesMpcpBiofeedback') : "";
      return tx('SR2E.App.Sheets.icDamage', { rating: r, resist, crash, defend });
    }
    case "tally": return tx('SR2E.App.Sheets.icTally', { rating: r });
    case "attribute": return b === "ripper"
      ? tx('SR2E.App.Sheets.icAttributeDeck', { rating: r, successes: RULES.MATRIX.attributeDamage.successesPerPoint, defend })
      : tx('SR2E.App.Sheets.icAttributePersona', { rating: r, successes: RULES.MATRIX.attributeDamage.successesPerPoint, defend });
    case "utility": return b === "tarPit" ? tx('SR2E.App.Sheets.icUtilityTarPit', { rating: r, defend })
      : RULES.MATRIX.tar.tarBabyDerezzes ? tx('SR2E.App.Sheets.icUtilityTarBaby', { rating: r, defend }) : tx('SR2E.App.Sheets.icUtility', { rating: r, defend });
    case "trace": return tx('SR2E.App.Sheets.icTrace', { rating: r, turns: RULES.MATRIX.trace.baseTurns, mode: sys.traceMode, defend });
    case "passive": return b === "barrier" ? tx('SR2E.App.Sheets.icGuardsSubsystem', { subsystem: sys.guards ? cap(sys.guards) : tx('SR2E.App.Sheets.pickOne'), rating: r }) : tx('SR2E.App.Sheets.icGuardsFile');
    default: return tx('SR2E.App.Sheets.icDefault', { rating: r, defend });
  }
}

/** IC: rating, category, damage, host, Matrix condition monitor, attack. */
export class SR2IcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** v0.59.0: dropped items arrive uninstalled / unbonded / unloaded, move between actors, and only fitting types (applications/drops.ts). */
  async _onDropItem(event: any, item: any): Promise<any> {
    return dropItemOnActor(this, event, item, () => (super._onDropItem as any)(event, item));
  }

  static DEFAULT_OPTIONS: Record<string, any> = {
    classes: ["sr2e", "sheet", "actor", "ic"],
    position: { width: 480, height: 540 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      icAttack: SR2IcSheet.#onAttack,
      partyAttack: SR2IcSheet.#onPartyAttack,
      toggleConstruct: SR2IcSheet.#onToggleConstruct,
      frameAttack: SR2IcSheet.#onFrameAttack,
      setMatrixMonitor: SR2IcSheet.#onSetMonitor,
      restoreIc: SR2IcSheet.#onRestore,
      icLocate: SR2IcSheet.#onLocate,
    },
  };

  static PARTS: Record<string, any> = {
    main: { template: `${SYSTEM.PATH.TEMPLATES}/actor-ic-sheet.hbs`, scrollable: [""] },
  };

  async _prepareContext(options: any): Promise<any> {
    const context = await super._prepareContext(options);
    const actor: any = this.document;
    const host: any = actor.system.hostUuid ? fromUuidSync(actor.system.hostUuid) : null;
    return {
      ...context, actor, system: actor.system,
      categories: IC_CATEGORIES.map((k) => ({ key: k, label: cap(k) })),
      damageLevels: ["L", "M", "S", "D"].map((k) => ({ key: k, label: k })),
      damageTypes: [{ key: "physical", label: tx('SR2E.App.Sheets.physical') }, { key: "stun", label: tx('SR2E.App.Sheets.stun') }],
      hosts: [{ key: "", label: tx('SR2E.App.Sheets.none') }, ...allActors().filter((a: any) => a.type === "host").map((a: any) => ({ key: a.uuid, label: a.name }))],
      hostCode: host?.system?.securityCode ?? "",
      track: trackView("matrix", actor.system.matrix?.monitor ?? 0, { boxes: RULES.MATRIX.monitorBoxes, label: tx('SR2E.App.Sheets.matrix') }),
      isBlack: actor.system.category === "black",
      behaviors: IC_BEHAVIORS.map((k) => ({ key: k, label: IC_BEHAVIOR_LABELS[k] })),
      guardChoices: [{ key: "", label: tx('SR2E.App.Sheets.nothing') }, ...RULES.MATRIX.subsystems.map((k) => ({ key: k, label: cap(k) }))],
      traceModes: TRACE_MODES.map((k) => ({ key: k, label: cap(k) })),
      personaAttributes: PERSONA_ATTRIBUTES.map((k) => ({ key: k, label: cap(k) })),
      actionKind: icActionKind(actor.system.behavior ?? "killer"),
      behaviorHint: icBehaviorHint(actor.system),
      isFrame: ["frame", "agent"].includes(actor.system.kind),
      isAgent: actor.system.kind === "agent",
      initDice: actor.system.initiativeDice > 0 ? actor.system.initiativeDice : icInitiativeDice(host?.system?.securityCode ?? ""),
      // v0.57.0: the initiative it rolls (its rating, or the host's Security Value by house rule).
      initNote: ["frame", "agent"].includes(actor.system.kind) ? "" : icInitiative({ rating: Number(actor.system.rating ?? 0), securityValue: Number(host?.system?.securityValue ?? 0), code: String(host?.system?.securityCode ?? ""), ownDice: Number(actor.system.initiativeDice ?? 0) }).note,
      carried: (actor.programs?.() ?? []).filter((p: any) => p.system.loaded && !p.system.erased).map((p: any) => `${p.name} ${p.system.rating}`).join(", "),
      ownerUtilities: RULES.MATRIX.carry.ownerUtilities,
      ownerName: actor.system.ownerUuid ? fromUuidSync(actor.system.ownerUuid)?.name ?? "?" : "",
      kinds: [{ key: "ic", label: tx('SR2E.App.Sheets.ic') }, { key: "frame", label: tx('SR2E.App.Sheets.frame') }, { key: "agent", label: tx('SR2E.App.Sheets.agent') }],
      payloads: [{ key: "", label: tx('SR2E.App.Sheets.fromTheIcsName') }, ...RULES.MATRIX.psychotropic.kinds.map((k) => ({ key: k, label: (PSYCHOTROPIC_LABELS as any)[k] ?? k }))],
      // v0.46.0: party and construct IC.
      partyMembers: (actor.partyMembers?.() ?? []).filter((a: any) => a.uuid !== actor.uuid).map((a: any) => a.name).join(", "),
      constructChoices: IC_BEHAVIORS.filter((k) => k !== actor.system.behavior && k !== "other").map((k) => ({ key: k, label: IC_BEHAVIOR_LABELS[k], on: (actor.system.construct ?? []).includes(k) })),
      canAct: constructBehaviors(actor.system.behavior ?? "killer", actor.system.construct ?? []).some((b) => icActionKind(b) !== "passive"),
    };
  }

  static async #onToggleConstruct(this: SR2IcSheet, _event: Event, target: HTMLElement) {
    const actor: any = this.document;
    const b = String(target.dataset["behavior"] ?? "");
    const list: string[] = [...(actor.system.construct ?? [])];
    const adding = !list.includes(b);
    const next = adding ? [...list, b] : list.filter((x) => x !== b);
    if (adding && next.length + 1 > RULES.MATRIX.construct.maxComponents) return ui.notifications.warn(tx('SR2E.Notify.Sheet.aConstructHoldsAtMostBehaviors', { constructMaxComponents: RULES.MATRIX.construct.maxComponents }));
    await actor.update({ "system.construct": next });
  }

  /** v0.57.0: find a decker who broke contact with this IC (an evade maneuver). */
  static async #onLocate(this: SR2IcSheet) {
    const actor: any = this.document;
    const now = (SR2Actor as any).matrixNow();
    const lost = allActors().filter((a: any) => a.isJackedIn?.() && a.system.matrix.hostUuid === actor.system.hostUuid
      && activeManeuvers(a.system.matrix?.maneuvers ?? [], now).some((m: any) => m.kind === "evade" && m.targetUuid === actor.uuid));
    if (!lost.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.nobodyInThisHostHasBroken', { actorName: escHtml(actor.name) }));
    const uuid = lost.length === 1 ? lost[0].uuid : await pickOne(tx('SR2E.Dialog.Sheet.lookFor2', { actorName: actor.name }), lost.map((p: any) => ({ value: p.uuid, label: p.name })));
    if (uuid) await actor.icLocate(uuid);
  }

  static async #onPartyAttack(this: SR2IcSheet) {
    const actor: any = this.document;
    const personas = allActors().filter((a: any) => a.isJackedIn?.() && (!actor.system.hostUuid || a.system.matrix.hostUuid === actor.system.hostUuid));
    if (!personas.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.noDeckerIsJackedInTo'));
    const members = actor.partyMembers();
    const uuid = await pickOne(tx('SR2E.Dialog.Sheet.partyAttack', { members: members.map((m: any) => m.name).join(", ") }), personas.map((p: any) => ({ value: p.uuid, label: p.name })));
    if (uuid) await actor.partyAttack(uuid);
  }

  static async #onAttack(this: SR2IcSheet) {
    const actor: any = this.document;
    // v0.46.0: a construct picks which of its behaviors acts.
    const can = constructBehaviors(actor.system.behavior ?? "killer", actor.system.construct ?? []).filter((b) => icActionKind(b) !== "passive");
    let behavior: string = actor.system.behavior ?? "killer";
    if (can.length > 1) {
      const pick = await pickOne(tx('SR2E.Dialog.Sheet.actAs', { actorName: actor.name }), can.map((b) => ({ value: b, label: IC_BEHAVIOR_LABELS[b] })));
      if (!pick) return;
      behavior = pick;
    } else if (can.length === 1) behavior = can[0]!;
    const kind = icActionKind(behavior);
    if (kind === "passive") return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyGuardsItDoesNotAttack', { actorName: escHtml(actor.name), iC_BEHAVIOR_LABELS: escHtml(IC_BEHAVIOR_LABELS[actor.system.behavior as keyof typeof IC_BEHAVIOR_LABELS]) }));
    const personas = allActors().filter((a: any) => a.isJackedIn?.() && (!actor.system.hostUuid || a.system.matrix.hostUuid === actor.system.hostUuid));
    // Damaging IC can also go after deckers' frames and agents in the host (v0.40.0).
    const programs = kind === "damage" || kind === "report"
      ? allActors().filter((a: any) => a.type === "ic" && ["frame", "agent"].includes(a.system.kind) && !a.system.derived?.crashed && actor.system.hostUuid && a.system.hostUuid === actor.system.hostUuid)
      : [];
    const targets = [...personas, ...programs];
    if (!targets.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.noDeckerIsJackedInTo'));
    const utilityRows = kind === "utility" ? targets.flatMap((t: any) => t.programs().filter((p: any) => p.system.loaded && !p.system.erased).map((p: any) => `<option value="${escHtml(t.uuid)}|${escHtml(p.id)}">${escHtml(t.name)}: ${escHtml(p.name)} (${escHtml(p.system.kind)} ${escHtml(p.system.rating)})</option>`)) : [];
    if (kind === "utility" && !utilityRows.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.noDeckerHereHasALoaded'));
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.acts', { actorName: actor.name }) },
      content: (kind === "utility"
        ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.utility')}</label><select name="util">${utilityRows.join("")}</select></div>`
        : `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.target')}</label><select name="target">${targets.map((t: any) => `<option value="${escHtml(t.uuid)}" ${isTargeted(t) ? "selected" : ""}>${escHtml(t.name)} (${t.type === "ic" ? tx('SR2E.Dialog.Sheet.rating7', { kind: escHtml(t.system.kind), rating: escHtml(t.system.rating) }) : tx('SR2E.Dialog.Sheet.evasionDf', { matrixEvasion: escHtml(t.system.derived.matrix.evasion), part: t.system.derived.matrix.mirrors ? tx('SR2E.Dialog.Sheet.mirrors') : "", matrixDetectionFactor: escHtml(t.system.derived.matrix.detectionFactor) })})</option>`).join("")}</select></div>`)
        + (kind === "attribute" ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.goesAfter')}</label><select name="attribute">${PERSONA_ATTRIBUTES.map((k) => `<option value="${k}" ${k === actor.system.attribute ? "selected" : ""}>${escHtml(cap(k))}</option>`).join("")}</select></div>` : "")
        + `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <p class="hint">${escHtml(icBehaviorHint({ ...actor.system, behavior }))}</p>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.roll'),
        callback: (_e: Event, b: any) => {
          const el = b.form.elements;
          const [utilTarget, programId] = el.util ? String(el.util.value).split("|") : [null, null];
          return { target: utilTarget ?? String(el.target.value), programId, attribute: el.attribute ? String(el.attribute.value) : undefined, mod: Number(el.mod.value) || 0 };
        },
      },
      rejectClose: false,
    });
    if (!choice) return;
    await actor.icAttack({ targetUuid: choice.target, programId: choice.programId, attribute: choice.attribute, modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [], ...(behavior !== actor.system.behavior ? { behavior } : {}) });
  }

  static async #onFrameAttack(this: SR2IcSheet) {
    await frameAttackDialog(this.document);
  }

  static async #onSetMonitor(this: SR2IcSheet, _event: Event, target: HTMLElement) {
    const value = Number(target.dataset["value"]);
    if (!Number.isFinite(value)) return;
    const actor: any = this.document;
    const current = actor.system.matrix?.monitor ?? 0;
    await actor.update({ "system.matrix.monitor": current === value ? value - 1 : value });
  }

  static async #onRestore(this: SR2IcSheet) {
    await (this.document as any).update({ "system.matrix.monitor": 0 });
  }
}

/** One generic item sheet; the template shows the fields for the item type. */
export class SR2ItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["sr2e", "sheet", "item"],
    position: { width: 520, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      findItem: SR2ItemSheet.#onFindItem,
      fenceItem: SR2ItemSheet.#onFenceItem,
      buyItem: SR2ItemSheet.#onBuyItem,
      raiseSite: SR2ItemSheet.#onRaiseSite,
      applyTemplate: SR2ItemSheet.#onApplyTemplate,
      saveTemplate: SR2ItemSheet.#onSaveTemplate,
      deleteTemplate: SR2ItemSheet.#onDeleteTemplate,
      toggleAllFields: SR2ItemSheet.#onToggleAllFields,
      postItem: SR2ItemSheet.#onPostItem,
      getPermit: SR2ItemSheet.#onGetPermit,
      // v0.91.8: learn the spell of this formula.
      learnFormulaItem: SR2ItemSheet.#onLearnFormulaItem,
      // v0.92.1: custom tweaks and the accessories read from the description.
      addTweak: SR2ItemSheet.#onAddTweak,
      deleteTweak: SR2ItemSheet.#onDeleteTweak,
      undoDescription: SR2ItemSheet.#onUndoDescription,
    },
  };

  /** v0.92.1: a new custom tweak row (a note until its kind is picked). */
  static async #onAddTweak(this: SR2ItemSheet) {
    const item: any = this.document;
    if (!item.isOwner) return;
    const list = normalizeTweaks(item.system.tweaks);
    if (list.length >= TWEAK_MAX) return ui.notifications.warn(tx('SR2E.Notify.Sheet.tweaksFull', { max: TWEAK_MAX }));
    await item.update({ "system.tweaks": [...list, { id: foundry.utils.randomID(), label: "", target: "note", key: "", value: 0, on: true }] });
  }

  /** v0.92.1: remove a custom tweak row. */
  static async #onDeleteTweak(this: SR2ItemSheet, _e: Event, t: HTMLElement) {
    const item: any = this.document;
    if (!item.isOwner) return;
    const list = normalizeTweaks(item.system.tweaks);
    if (!spliceRow(list, t)) return;
    await item.update({ "system.tweaks": list });
  }

  /**
   * v0.92.1: undo what the description filled in: each field still holding the value it got goes back to what it was,
   * the notes it added go, and those accessories aren't read again from this description.
   */
  static async #onUndoDescription(this: SR2ItemSheet) {
    const item: any = this.document;
    const rec = item.flags?.sr2e?.fromDescription;
    if (!item.isOwner || !rec) return;
    const up: Record<string, unknown> = {};
    const dismissed = new Set<string>(Array.isArray(rec.dismissed) ? rec.dismissed.map(String) : []);
    for (const [k, f] of Object.entries((rec.fields ?? {}) as Record<string, any>)) {
      if (f?.id) dismissed.add(String(f.id));
      if (f && item.system[k] === f.value) up[`system.${k}`] = f.before;
    }
    const noted: string[] = Array.isArray(rec.noted) ? rec.noted.map(String) : [];
    for (const n of noted) dismissed.add(n);
    const ids = new Set(noted.map((n) => `acc${n}`));
    const tweaks = normalizeTweaks(item.system.tweaks);
    if (tweaks.some((t) => ids.has(t.id))) up["system.tweaks"] = tweaks.filter((t) => !ids.has(t.id));
    Object.assign(up, replaceFlagUpdate(item, "fromDescription", { fields: {}, dismissed: [...dismissed], noted }));
    // The undo is not itself a new description to read.
    await item.update(up);
  }

  /** v0.91.8 (RULES.FORMULA_V918): learn this formula's spell (the Force asked first). */
  static async #onLearnFormulaItem(this: SR2ItemSheet) {
    const item: any = this.document;
    if (!item.parent?.learnFromFormula) return ui.notifications.warn(tx('SR2E.Notify.Sheet.putTheItemOnACharacter'));
    await learnFromFormulaDialog(item.parent, item);
  }

  /** v0.91.5: get a permit for this item (its cost and time; RULES.SHOP_V915). */
  static async #onGetPermit(this: SR2ItemSheet) {
    const item: any = this.document;
    const owner: any = item.parent;
    if (!owner?.getPermit) return ui.notifications.warn(tx('SR2E.Notify.Sheet.putTheItemOnACharacter'));
    if (!(await confirmPermit(owner, `item:${item.id}`))) return;
    if (await owner.getPermit(`item:${item.id}`)) this.render();
  }

  /** v0.59.0: post the item (name, picture, enriched description) to chat. */
  static async #onPostItem(this: SR2ItemSheet) {
    await postItemToChat(this.document);
  }

  /** v0.61.0: the "Helps skills" line becomes the item's skillMods rows. */
  _processFormData(event: any, form: any, formData: any): any {
    let data: any = (super._processFormData as any)(event, form, formData);
    if (data && Object.prototype.hasOwnProperty.call(data, "skillModsText")) {
      data.system = { ...(data.system ?? {}), skillMods: parseSkillMods(data.skillModsText) };
      delete data.skillModsText;
    }
    // v0.92.1: the custom tweak rows become the item's tweaks (every row is in the form, so the list is rebuilt whole).
    if (data && Object.prototype.hasOwnProperty.call(data, "tweak")) {
      data.system = { ...(data.system ?? {}), tweaks: tweaksFromForm(data.tweak, (this.document as any).system?.tweaks) };
      delete data.tweak;
    }
    // v0.70.0: loading or unloading a program on an actor goes through Swap Memory (its time and action), as the Matrix tab does.
    const doc: any = this.document;
    if (data && doc.type === "program" && doc.parent?.swapProgram) {
      const flatL: Record<string, unknown> = foundry.utils.flattenObject(data);
      if ("system.loaded" in flatL && Boolean(flatL["system.loaded"]) !== Boolean(doc.system.loaded)) {
        const want = Boolean(flatL["system.loaded"]);
        delete flatL["system.loaded"];
        data = foundry.utils.expandObject(flatL);
        setTimeout(() => { void doc.parent.swapProgram(doc.id, want).then(() => this.render()); }, 0);
      }
    }
    // v0.91.5 (RULES.SHOP_V915.permits 'buy'): a player gets a permit with Get a permit…, not by ticking the box.
    if (data && typeof data === "object") {
      const flatP: Record<string, unknown> = foundry.utils.flattenObject(data);
      if (refusePermitTick(this.document, flatP)) { data = foundry.utils.expandObject(flatP); setTimeout(() => void this.render(), 0); }
    }
    // v0.64.0: after the owner's creation, a player raises ratings with Spend Karma, not here.
    if (data && typeof data === "object" && (this.document as any).parent) {
      const flat: Record<string, unknown> = foundry.utils.flattenObject(data);
      if (refuseLockedRaises(this.document, "item", flat).length) { data = foundry.utils.expandObject(flat); setTimeout(() => void this.render(), 0); }
    }
    return data;
  }

  /** "Show every field" on a weapon (v0.41.0); per open sheet. */
  #showAll = false;

  /** Build or raise a library, circle or lodge for nuyen (v0.45.0). */
  static async #onRaiseSite(this: SR2ItemSheet) {
    const item: any = this.document;
    const actor: any = item.parent;
    if (!actor?.raiseSite) return;
    const from = Number(item.system.site?.rating ?? 0);
    const kind = String(item.system.site?.kind ?? "");
    const to = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.raise3', { itemName: item.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.newRating')}</label><input name="to" type="number" value="${from + 1}" min="${from + 1}"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.eachPointCostsAndDayS', { sitesNuyenPerRating: (RULES.OCCULT.sites.nuyenPerRating[kind] ?? 0).toLocaleString(), sitesDaysPerRating: RULES.OCCULT.sites.daysPerRating, actorName: escHtml(actor.name), actorNuyen: Number(actor.system.nuyen ?? 0).toLocaleString() })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.raise'), callback: (_e: Event, b: any) => Math.floor(Number(b.form.elements.to.value) || 0) },
      rejectClose: false,
    });
    if (typeof to === "number" && to > from) await actor.raiseSite(item.id, to);
  }

  static #picked(sheet: SR2ItemSheet): ItemTemplate | null {
    const id = (sheet.element?.querySelector?.("select[data-template-select]") as HTMLSelectElement | null)?.value ?? "";
    return id ? templatesFor(sheet.document.type, worldTemplates()).find((t) => t.id === id) ?? null : null;
  }

  /** Fill the item in from the picked template (v0.41.0). */
  static async #onApplyTemplate(this: SR2ItemSheet) {
    const item: any = this.document;
    const t = SR2ItemSheet.#picked(this);
    if (!t) return ui.notifications.warn(tx('SR2E.Notify.Sheet.pickATemplateFirst'));
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Sheet.fillIn2', { itemName: item.name }) },
      content: `<p>${tx('SR2E.Dialog.Sheet.fillIn')} <strong>${escHtml(item.name)}</strong> ${tx('SR2E.Dialog.Sheet.from')} <strong>${escHtml(t.name)}</strong>${tx('SR2E.Dialog.Sheet.itsSettingsReplaceTheOnesHere', { part: /^New /i.test(item.name) ? tx('SR2E.Dialog.Sheet.andItTakesTheTemplateS') : "" })}</p>`,
      rejectClose: false,
    });
    if (!ok) return;
    await item.update({ system: foundry.utils.deepClone(t.system), ...(/^New /i.test(item.name) || !item.name ? { name: t.name } : {}) });
  }

  /** GM: save this item's settings as a world template. */
  static async #onSaveTemplate(this: SR2ItemSheet) {
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyTheGmCanSaveTemplates'));
    const item: any = this.document;
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.saveAsTemplate') },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.templateName')}</label><input name="name" type="text" value="${escHtml(item.name)}" autofocus></div>`,
      ok: { label: tx('SR2E.Dialog.Sheet.save'), callback: (_e: Event, b: any) => String(b.form.elements.name.value ?? "").trim() },
      rejectClose: false,
    });
    if (!name) return;
    const system = foundry.utils.deepClone(item.system.toObject ? item.system.toObject() : item.system);
    for (const k of ["description", "notes", "installed", "worn", "active", "bonded", "loaded", "erased", "jammed", "damaged", "degraded"]) delete (system as any)[k];
    // v0.91.0 review (R8): saving over a template keeps its id and its "in the shop" mark (open cards and requests name it).
    const old = worldTemplates().find((t) => t.type === item.type && t.name === name);
    const list = worldTemplates().filter((t) => !(t.type === item.type && t.name === name));
    list.push({ id: old?.id ?? `w-${foundry.utils.randomID()}`, type: item.type, name, system, ...(old?.shop ? { shop: true } : {}) });
    await game.settings.set(SYSTEM.id, "itemTemplates", list);
    ui.notifications.info(tx('SR2E.Notify.Sheet.savedTheTemplate', { name: escHtml(name) }));
    this.render();
  }

  static async #onDeleteTemplate(this: SR2ItemSheet) {
    if (!game.user?.isGM) return;
    const t = SR2ItemSheet.#picked(this);
    if (!t?.world) return ui.notifications.warn(tx('SR2E.Notify.Sheet.pickAWorldTemplateToDelete'));
    await game.settings.set(SYSTEM.id, "itemTemplates", worldTemplates().filter((x) => x.id !== t.id));
    this.render();
  }

  static #onToggleAllFields(this: SR2ItemSheet) {
    this.#showAll = !this.#showAll;
    this.render();
  }

  /** The weapon Kind select sets the flags behind it (v0.41.0). */
  _onRender(context: any, options: any): void {
    (super._onRender as any)?.call(this, context, options);
    const sel = this.element?.querySelector?.("select[data-weapon-layout]") as HTMLSelectElement | null;
    sel?.addEventListener("change", () => {
      const item: any = this.document;
      void item.update(weaponLayoutFlags(sel.value as WeaponLayout, item.system));
    });
  }

  /** Look for it (an Availability test on the owner); the card has a Buy button. */
  static async #onFindItem(this: SR2ItemSheet) {
    const item: any = this.document;
    if (!item.parent?.findItem) return ui.notifications.warn(tx('SR2E.Notify.Sheet.putTheItemOnACharacter'));
    const through = await askFindThrough(item.parent);
    if (through !== false) await item.parent.findItem(item.id, { through });
  }

  /** Sell it to a fence (v0.44.0). */
  static async #onFenceItem(this: SR2ItemSheet) {
    const item: any = this.document;
    if (!item.parent?.fence) return ui.notifications.warn(tx('SR2E.Notify.Sheet.putTheItemOnACharacter'));
    await item.parent.fence(item.id);
  }

  /** Pay for it straight away. */
  static async #onBuyItem(this: SR2ItemSheet) {
    const item: any = this.document;
    if (!item.parent?.buyItem) return ui.notifications.warn(tx('SR2E.Notify.Sheet.putTheItemOnACharacter'));
    // v0.91.0 (RULES.SHOP_V91.buying 'find'): a player character out of creation finds it first (the card's Buy pays).
    if (buysByFinding({ isGM: Boolean(game.user?.isGM), actorType: String(item.parent.type ?? ''), inCreation: inCreationNow(item.parent) })) {
      ui.notifications.info(tx('SR2E.Notify.Shop.findFirst', { name: escHtml(item.name) }));
      const through = await askFindThrough(item.parent);
      if (through !== false) await item.parent.findItem(item.id, { through });
      return;
    }
    await item.parent.buyItem(item.id);
  }

  static PARTS = {
    main: { template: `${SYSTEM.PATH.TEMPLATES}/item-sheet.hbs`, scrollable: [""] },
  };

  async _prepareContext(options: any): Promise<any> {
    const context = await super._prepareContext(options);
    const item: any = this.document;
    const layout = item.type === "weapon" ? weaponLayout(item.system) : null;
    const sec = layout ? weaponSections(layout) : {};
    if (layout && this.#showAll) for (const k of Object.keys(sec)) sec[k] = true;
    return {
      ...context,
      item,
      system: item.system,
      type: item.type,
      // v0.41.0: templates, warnings, the weapon's layout.
      templates: templatesFor(item.type, worldTemplates()),
      isGM: Boolean(game.user?.isGM),
      itemWarnings: itemWarnings(item.type, item.system),
      layout, showAll: this.#showAll,
      sec: { ...sec, all: this.#showAll, vehicle: this.#showAll || item.parent?.type === "vehicle" || (item.system.mount && item.system.mount !== "none") },
      layoutChoices: Object.entries(WEAPON_LAYOUT_LABELS).map(([key, label]) => ({ key, label })),
      // v0.58.0: skills can link to Reaction (vehicle skills).
      attributeChoices: [...ATTRIBUTE_KEYS.map((k) => ({ key: k, label: game.i18n.localize(`SR2E.Attribute.${k}`) })), ...(item.type === "skill" ? [{ key: "reaction", label: tx('SR2E.App.Sheets.reaction') }] : [])],
      damageLevels: [
        { key: "L", label: tx('SR2E.App.Sheets.light') },
        { key: "M", label: tx('SR2E.App.Sheets.moderate') },
        { key: "S", label: tx('SR2E.App.Sheets.serious') },
        { key: "D", label: tx('SR2E.App.Sheets.deadly') },
      ],
      spellCategories: ["combat", "detection", "health", "illusion", "manipulation"].map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) })),
      spellTypes: [{ key: "mana", label: tx('SR2E.App.Sheets.mana') }, { key: "physical", label: tx('SR2E.App.Sheets.physical') }],
      // v0.91.8: a spell formula's tradition.
      formulaTraditions: [{ key: "", label: tx('SR2E.Text.Formula.either') }, { key: "hermetic", label: tx('SR2E.Text.Formula.hermetic') }, { key: "shamanic", label: tx('SR2E.Text.Formula.shamanic') }],
      formulaTraditionLabel: item.system?.formula?.tradition === "shamanic" ? tx('SR2E.Text.Formula.shamanic') : item.system?.formula?.tradition === "hermetic" ? tx('SR2E.Text.Formula.hermetic') : tx('SR2E.Text.Formula.either'),
      gradeChoices: [
        { key: "standard", label: tx('SR2E.App.Sheets.standard') }, { key: "alpha", label: tx('SR2E.App.Sheets.alphaware') },
        { key: "beta", label: tx('SR2E.App.Sheets.betaware') }, { key: "delta", label: tx('SR2E.App.Sheets.deltaware') },
      ],
      damageTypes: [
        { key: "physical", label: tx('SR2E.App.Sheets.physical') },
        { key: "stun", label: tx('SR2E.App.Sheets.stun') },
      ],
      // v0.72.0 (O6): the core rounds plus the house-rule rows; an id no longer listed is kept.
      ammoChoices: ammoChoices((this.document as any).system?.ammoType ?? "standard").map((a) => ({ key: a.id, label: a.label })),
      clipChoices: ammoChoices((this.document as any).system?.ammoType ?? "", undefined, true).map((a) => ({ key: a.id, label: a.label })),
      grenadeChoices: RULES.COMBAT.grenades.map((g) => ({ key: g.id, label: g.label })),
      powerDice: POWER_DICE_SOURCES.map((k) => ({ key: k, label: k === "rating" ? tx('SR2E.App.Sheets.ratingBelow') : cap(k) })),
      powerTn: POWER_TN_SOURCES.map((k) => ({ key: k, label: k === "fixed" ? tx('SR2E.App.Sheets.fixedTNBelow') : tx('SR2E.App.Sheets.targetsAttribute', { attribute: cap(k) }) })),
      powerResist: POWER_RESIST.map((k) => ({ key: k, label: k === "none" ? tx('SR2E.App.Sheets.notResistedCap') : cap(k) })),
      powerEffects: [{ key: "effect", label: tx('SR2E.App.Sheets.netSuccessesOnly') }, { key: "damage", label: tx('SR2E.App.Sheets.damageStaged') }],
      // v0.39.0: critter, adept and site choices.
      powerSpecials: [["", tx('SR2E.App.Sheets.noneCap')], ["allergy", tx('SR2E.App.Sheets.allergyWeakness')], ["vulnerability", tx('SR2E.App.Sheets.vulnerabilityWeakness')], ["essenceLoss", tx('SR2E.App.Sheets.essenceLossWeakness')],
        ["essenceDrain", tx('SR2E.App.Sheets.essenceDrain')], ["regeneration", tx('SR2E.App.Sheets.regeneration')], ["dualNatured", tx('SR2E.App.Sheets.dualNatured')], ["infection", tx('SR2E.App.Sheets.infectionABitePassesOn')],
        // v0.56.0
        ["immunity", tx('SR2E.App.Sheets.immunityNormalWeaponsFirePoisons')], ["concealment", tx('SR2E.App.Sheets.concealmentTnToNotice')], ["confusion", tx('SR2E.App.Sheets.confusionTnToTheTargets')],
        ["movement", tx('SR2E.App.Sheets.movementTheTargetsSpeed')], ["fear", tx('SR2E.App.Sheets.fearTnTheTargetIsAfraid')], ["guard", tx('SR2E.App.Sheets.guardPreventsAccidents')],
        // v0.61.0
        ["paralysis", tx('SR2E.App.Sheets.paralysisTheTargetCantAct')], ["petrification", tx('SR2E.App.Sheets.petrificationTurnedToStoneWhile')], ["binding", tx('SR2E.App.Sheets.bindingHeldStrengthVsForce')]].map(([key, label]) => ({ key, label })),
      tnSpecial: ["concealment", "confusion", "movement", "fear", "guard"].includes(String(item.system?.special ?? "")),
      immunityArmorPerEssence: RULES.CRITTERS_V56.immunity.armorPerEssence,
      spellHasEffects: item.type === "spell" && Boolean(item.system?.effects) && (Object.values(item.system.effects.attributes ?? {}).some((v: any) => Number(v)) || ["reaction", "initiativeDice", "ballistic", "impact", "testsTn", "perceivedTn", "attackedTn"].some((k) => Number(item.system.effects[k] ?? 0)) || Number(item.system.effects.movementFactor ?? 1) !== 1),
      powerModDefaults: (() => {
        const m = (RULES.CRITTERS_V56.powerMods as any)[String(item.system?.special ?? "")] ?? {};
        const say = (v: any) => (v === "force" ? tx('SR2E.App.Sheets.theRating') : v === "successes" ? tx('SR2E.App.Sheets.netSuccesses') : String(v));
        const names: Record<string, string> = { testsTn: tx('SR2E.App.Sheets.tnOnItsTests'), perceivedTn: tx('SR2E.App.Sheets.tnToNoticeIt'), attackedTn: tx('SR2E.App.Sheets.tnToAttackIt'), movementFactor: tx('SR2E.App.Sheets.movement') };
        return Object.entries(m).map(([k, v]) => `${names[k] ?? k} = ${say(v)}`).join(", ");
      })(),
      spellRanges: [{ key: "los", label: tx('SR2E.App.Sheets.lineOfSight') }, { key: "touch", label: tx('SR2E.App.Sheets.touch') }],
      healDrains: [{ key: "fixed", label: tx('SR2E.App.Sheets.theLevelBelow') }, { key: "wound", label: tx('SR2E.App.Sheets.theWoundsLevel') }],
      effectAttributeFields: item.type === "spell" ? ATTRIBUTE_KEYS.map((k) => ({ key: k, label: cap(k), value: item.system.effects?.attributes?.[k] ?? 0 })) : [],
      adeptSenses: [["", tx('SR2E.App.Sheets.noneCap')], ["lowLight", tx('SR2E.App.Sheets.lowLightVisionSense')], ["thermographic", tx('SR2E.App.Sheets.thermographicVisionSense')], ["ultrasound", tx('SR2E.App.Sheets.ultrasound')], ["hearing", tx('SR2E.App.Sheets.improvedHearing')]].map(([key, label]) => ({ key, label })),
      // v0.48.0
      infectionDefault: RULES.CRITTERS.infection.name,
      contagionVectors: [["", tx('SR2E.App.Sheets.notContagious')], ["airborne", tx('SR2E.App.Sheets.airborneEveryoneCloseBy')], ["contact", tx('SR2E.App.Sheets.byContact')], ["blood", tx('SR2E.App.Sheets.byBlood')]].map(([key, label]) => ({ key, label })),
      // v0.78.0: the book's four levels (RULES.BOOK_V78.allergy); "moderate" stays for saved data (counts as Mild).
      allergySeverities: ["nuisance", "mild", "moderate", "severe", "extreme"].map((k) => ({ key: k, label: k === "moderate" && RULES.BOOK_V78.allergy.mode === "book" ? tx('SR2E.App.Sheets.moderateAsMild') : cap(k) })),
      adeptSpecials: [["", tx('SR2E.App.Sheets.noneCap')], ["killingHands", tx('SR2E.App.Sheets.killingHands')], ["combatSense", tx('SR2E.App.Sheets.combatSense')], ["painResistance", tx('SR2E.App.Sheets.painResistance')],
        ["enhancedPerception", tx('SR2E.App.Sheets.enhancedPerception')], ["astralPerception", tx('SR2E.App.Sheets.astralPerception')],
        // v0.56.0
        ["rapidHealing", tx('SR2E.App.Sheets.rapidHealing')], ["distanceStrike", tx('SR2E.App.Sheets.distanceStrike')], ["spellResistance", tx('SR2E.App.Sheets.spellResistance')], ["improvedSenses", tx('SR2E.App.Sheets.improvedSenses')]].map(([key, label]) => ({ key, label })),
      siteKinds: [["", tx('SR2E.App.Sheets.noneCap')], ["library", tx('SR2E.App.Sheets.hermeticLibrary')], ["circle", tx('SR2E.App.Sheets.hermeticCircle')], ["lodge", tx('SR2E.App.Sheets.shamanicLodge')]].map(([key, label]) => ({ key, label })),
      siteCost: siteRaiseCost(String(this.document?.system?.site?.kind ?? ""), 0, Number(this.document?.system?.site?.rating ?? 0)),
      spellResist: [{ key: "none", label: tx('SR2E.App.Sheets.notResistedCap') }, ...ATTRIBUTE_KEYS.map((k) => ({ key: k, label: cap(k) }))],
      focusTypes: FOCUS_TYPES.map((k) => ({ key: k, label: cap(k) })),
      focusCategories: [{ key: "", label: tx('SR2E.App.Sheets.any') }, ...["combat", "detection", "health", "illusion", "manipulation"].map((k) => ({ key: k, label: cap(k) }))],
      durations: [{ key: "instant", label: tx('SR2E.App.Sheets.instant') }, { key: "sustained", label: tx('SR2E.App.Sheets.sustained') }, { key: "permanent", label: tx('SR2E.App.Sheets.permanent') }],
      utilityKinds: UTILITY_KINDS.map((k) => ({ key: k, label: cap(k) })),
      elementChoices: elementChoices(),
      materialChoices: MATERIAL_KINDS.map((k) => ({ key: k, label: k ? cap(k) : tx('SR2E.App.Sheets.notAMaterial') })),
      deckWarnings: item.type === "cyberdeck" ? personaWarnings(item.system) : [],
      bookSize: item.type === "program" ? programSize({ ...item.system, size: 0 }) : 0,
      deckStorage: item.type === "cyberdeck" ? (item.system.files ?? []).reduce((t: number, f: any) => t + (f.size ?? 0), 0) : 0,
      mountChoices: RULES.VEHICLES.mounts.map((k) => ({ key: k, label: k === "none" ? tx('SR2E.App.Sheets.notMounted') : cap(k) })),
      mountPointChoices: [{ key: "", label: tx('SR2E.App.Sheets.byKind') }, { key: "firm", label: tx('SR2E.App.Sheets.firmpoint') }, { key: "hard", label: tx('SR2E.App.Sheets.hardpoint') }],
      // v0.55.0: feeds, armor kind, a toxin carried (gear with a toxin on the same sheet), the cyberware a cybergun is built into, patches.
      feedChoices: FEEDS.map((key) => ({ key, label: ({ clip: () => tx('SR2E.App.Sheets.clipMagazine'), belt: () => tx('SR2E.App.Sheets.belt'), cylinder: () => tx('SR2E.App.Sheets.cylinderRevolver'), internal: () => tx('SR2E.App.Sheets.internalMagazineTube'), break: () => tx('SR2E.App.Sheets.breakAction') } as Record<string, () => string>)[key]?.() ?? key })),
      armorKindChoices: [["auto", tx('SR2E.App.Sheets.autoMeleeImpactThrownAnd')], ["ballistic", tx('SR2E.App.Sheets.ballistic')], ["impact", tx('SR2E.App.Sheets.impact')]].map(([key, label]) => ({ key, label })),
      toxinChoices: [{ key: "", label: tx('SR2E.App.Sheets.none') }, ...[...((item.parent?.items ?? []) as any[])].filter((i: any) => i.type === "gear" && i.system?.toxin?.kind).map((i: any) => ({ key: i.id, label: `${i.name} (${i.system.toxin.kind})` }))],
      implantChoices: [{ key: "", label: tx('SR2E.App.Sheets.notACybergun') }, ...[...((item.parent?.items ?? []) as any[])].filter((i: any) => i.type === "cyberware" && !i.system?.bioware).map((i: any) => ({ key: i.id, label: i.name }))],
      patchChoices: RULES.PATCHES.kinds.map((k) => ({ key: k, label: k ? cap(k) : tx('SR2E.App.Sheets.notAPatch') })),
      // v0.46.0
      arcChoices: ARC_SIDES.map((k) => ({ key: k, label: k ? cap(k) : tx('SR2E.App.Sheets.anyDirection') })),
      stealthKinds: [{ key: "", label: tx('SR2E.App.Sheets.none') }, { key: "chameleon", label: tx('SR2E.App.Sheets.chameleonSuit') }, { key: "thermal", label: tx('SR2E.App.Sheets.thermalMasking') }],
      otakuState: RULES.MATRIX.otaku.enabled ? tx('SR2E.App.Sheets.on') : tx('SR2E.App.Sheets.offTheDecksOwnRatings'),
      rcdPerRating: RULES.RIGGING.remote.dronesPerRating,
      cyberKinds: RULES.CYBERWARE.kinds.map((k) => ({ key: k, label: k === "other" ? tx('SR2E.App.Sheets.other') : k === "memory" ? tx('SR2E.App.Sheets.headwareMemory') : k === "iccm" ? tx('SR2E.App.Sheets.iccmBiofeedbackFilter') : cap(k) })),
      memoryPerRating: RULES.CYBERWARE.chips.mpPerRating,
      reflexChoices: RULES.CYBERWARE.reflexTypes.map((k) => ({ key: k, label: k ? cap(k) : tx('SR2E.App.Sheets.noneFromName') })),
      limbLocations: RULES.CYBERWARE.limbs.locations.map((k) => ({ key: k, label: k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })),
      limbChoices: item.type === "cyberware" && item.parent ? (() => {
        const l = [...item.parent.items].filter((x: any) => x.type === "cyberware" && x.system.kind === "cyberlimb" && x.id !== item.id);
        return l.length ? [{ key: "", label: tx('SR2E.App.Sheets.notHoused') }, ...l.map((x: any) => ({ key: x.id, label: x.name }))] : [];
      })() : [],
      gradedCost: item.type === "cyberware" ? cyberCost(item.system.cost ?? 0, item.system.grade) : 0,
      // v0.45.0: Availability by grade (and cultured bioware).
      gradedAvailability: item.type === "cyberware" && item.system.availability ? gradedAvailability(item.system.availability, { grade: item.system.grade, cultured: Boolean(item.system.bioware && item.system.cultured) }).label : "",
      powerAttributeFields: item.type === "power" ? ATTRIBUTE_KEYS.map((k) => ({ key: k, label: cap(k), value: item.system.attributes?.[k] ?? 0 })) : [],
      bioKinds: [...RULES.BIOWARE.kinds, ...bioKindsV72()].map((k) => ({ key: k, label: k === "other" ? tx('SR2E.App.Sheets.otherBonusesBelow') : k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })),
      bioCostLabel: item.type === "cyberware" ? wareCost({ ...item.system, bioware: true }) : 0,
      bioHint: item.type === "cyberware" ? bioHint(item.system) : "",
      toxinKinds: RULES.TOXINS.kinds.map((k) => ({ key: k, label: k ? cap(k) : tx('SR2E.App.Sheets.notAToxinOrDrug') })),
      toxinVectors: RULES.TOXINS.vectors.map((k) => ({ key: k, label: cap(k) })),
      toxinSpeeds: RULES.TOXINS.speeds.map((x) => ({ key: x.id, label: x.label })),
      addictionTypes: [{ key: "mental", label: tx('SR2E.App.Sheets.mentalWillpower') }, { key: "physical", label: tx('SR2E.App.Sheets.physicalBody') }],
      protectionKinds: RULES.HEALTH.protection.kinds.map((k) => ({ key: k, label: ({ "": () => tx('SR2E.App.Sheets.none'), gasMask: () => tx('SR2E.App.Sheets.gasMask'), respirator: () => tx('SR2E.App.Sheets.respirator'), chemsuit: () => tx('SR2E.App.Sheets.chemsuit') } as Record<string, () => string>)[k]?.() ?? k })),
      crashLevels: [{ key: "", label: tx('SR2E.App.Sheets.noCrash') }, ...["L", "M", "S", "D"].map((k) => ({ key: k, label: k }))],
      chipKinds: RULES.CYBERWARE.skillsofts.kinds.map((k) => ({ key: k, label: k ? cap(k) : tx('SR2E.App.Sheets.notAChip') })),
      // v0.57.0
      simchipKinds: RULES.MATRIX_V57.chips.kinds.map((k) => ({ key: k, label: k ? (k === "btl" ? "BTL" : cap(k)) : tx('SR2E.App.Sheets.notASimChip') })),
      bypassToolKinds: [{ key: "", label: tx('SR2E.App.Sheets.notATool') }, ...RULES.SECURITY_V57.tools.map((t) => ({ key: t.id, label: t.label }))],
      scopeVisionChoices: [{ key: "", label: tx('SR2E.App.Sheets.none') }, { key: "lowLight", label: tx('SR2E.App.Sheets.lowLight') }, { key: "thermographic", label: tx('SR2E.App.Sheets.thermographic') }],
      muzzleChoices: [{ key: "", label: tx('SR2E.App.Sheets.none') }, { key: "silencer", label: tx('SR2E.App.Sheets.silencerSsSa') }, { key: "suppressor", label: tx('SR2E.App.Sheets.soundSuppressor') }],
      areaChoices: [{ key: "", label: tx('SR2E.App.Sheets.none') }, { key: "flame", label: tx('SR2E.App.Sheets.flamethrower') }],
      // v0.43.0
      supportChoices: [{ key: "none", label: tx('SR2E.App.Sheets.none') }, { key: "bipod", label: tx('SR2E.App.Sheets.bipodOnceSetUp', { value: RULES.GEAR.accessories.support["bipod"] ?? 0 }) }, { key: "tripod", label: tx('SR2E.App.Sheets.tripodOnceSetUp', { value: RULES.GEAR.accessories.support["tripod"] ?? 0 }) }],
      fuseChoices: [{ key: "", label: tx('SR2E.App.Sheets.timedStandard') }, { key: "impact", label: tx('SR2E.App.Sheets.impactGoesOffWhereIt') }, { key: "airburst", label: tx('SR2E.App.Sheets.airburstScatter', { factor: RULES.GEAR.grenades.airburst.scatterFactor }) }],
      scannerKinds: RULES.GEAR.scannerKinds.map((k) => ({ key: k, label: ({ "": () => tx('SR2E.App.Sheets.notAScanner'), weapon: () => tx('SR2E.App.Sheets.weaponDetector'), cyber: () => tx('SR2E.App.Sheets.cyberwareScanner'), explosive: () => tx('SR2E.App.Sheets.explosiveSniffer') } as Record<string, () => string>)[k]?.() ?? k })),
      skillKinds: [{ key: "active", label: tx('SR2E.App.Sheets.active') }, { key: "knowledge", label: tx('SR2E.App.Sheets.knowledge') }, { key: "language", label: tx('SR2E.App.Sheets.language') }, { key: "buildRepair", label: tx('SR2E.App.Sheets.buildRepair') }],
      // v0.91.1: foci, programs and decks are bought in the shop too.
      buyable: ["weapon", "armor", "gear", "cyberware", "focus", "program", "cyberdeck"].includes(item.type),
      // v0.58.0: legality, broken weapons and gear, tools, surveillance gear, filtration and bone lacing.
      legalityChoices: RULES.GEAR_V58.legality.categories.map((c) => ({ key: c.id, label: c.label })),
      // v0.91.5: the Permit box (the GM's with bought permits), Get a permit… and the warning.
      permit: permitRowFor(item, item.parent, `item:${item.id}`),
      canBreak: ["weapon", "gear"].includes(item.type),
      toolLevels: RULES.CHARACTERS_V58.tools.levels.map((l) => ({ key: l.id, label: l.id === "none" ? tx('SR2E.App.Sheets.notTools') : l.label })),
      surveillanceKinds: [{ key: "", label: tx('SR2E.App.Sheets.none') }, ...RULES.GEAR_V58.surveillance.kinds.map((k) => ({ key: k.id, label: k.label }))],
      // v0.61.0: skill help as a line of text, and IDs.
      skillModsText: skillModsText(item.system?.skillMods),
      identityKinds: [{ key: "", label: tx('SR2E.App.Sheets.none') }, { key: "sin", label: tx('SR2E.App.Sheets.sin') }, { key: "licence", label: tx('SR2E.App.Sheets.licencePermit') }],
      filterKinds: [{ key: "", label: tx('SR2E.App.Sheets.pickOne') }, ...RULES.GEAR_V58.filtration.kinds.map((k) => ({ key: k.id, label: k.label }))],
      lacingKinds: [{ key: "", label: tx('SR2E.App.Sheets.pickOne') }, ...RULES.GEAR_V58.boneLacing.kinds.map((k) => ({ key: k.id, label: tx('SR2E.App.Sheets.lacingBodyToResist', { label: k.label, soak: k.soakDice, power: k.unarmedPower, weight: k.weight }) }))],
      // v0.49.0: Heat now (it cools with world time), and the program options written in.
      heatNow: (() => {
        if (!["weapon", "armor", "gear", "cyberware"].includes(item.type) || !(Number(item.system.heat ?? 0) > 0)) return "";
        const now = currentHeat(item.system.heat, item.system.heatAt ?? -1, sysNow());
        return now !== Number(item.system.heat) ? tx('SR2E.App.Sheets.cooledTo', { heat: now }) : "";
      })(),
      heatOn: RULES.STREET.heat.enabled,
      programOptions: item.type === "program" ? (item.system.options ?? []).map((id: string) => RULES.MATRIX.programming.options.find((o) => o.id === id)?.label ?? id).join(", ") : "",
      turretDefaults: { traverse: RULES.VEHICLES.turrets.traverse, limit: RULES.VEHICLES.turrets.limit },
      ownedByActor: Boolean(item.parent),
      // v0.92.1 (RULES.SHEET_V921): custom tweaks, Carried, a ware's Essence at its grade, what the description filled in.
      ...itemSheetV921(item),
      priceLabel: ["weapon", "armor", "gear", "cyberware", "focus", "program", "cyberdeck"].includes(item.type) ? itemPrice({ cost: item.type === "cyberware" ? wareCost(item.system) : (item.system.cost ?? 0), streetIndex: item.system.streetIndex ?? 1, quantity: 1 }).toLocaleString() : "",
    };
  }
}

/**
 * v0.92.1 (RULES.SHEET_V921): the item sheet's flexible-record parts: the custom tweak rows (rules/tweaks.ts), the
 * Carried box, a ware's Essence and price at its grade, and the "From the description" line (rules/accessories.ts).
 */
function itemSheetV921(item: any): Record<string, unknown> {
  const sys = item?.system ?? {};
  const type = String(item?.type ?? "");
  const rows = normalizeTweaks(sys.tweaks).map((t, index) => {
    const keys = TWEAK_KEYS[t.target];
    return { ...t, index, keyChoices: tweakKeyChoices(t.target, type), keyText: keys === "text", isNote: t.target === "note", text: tweakText(t, type) };
  });
  const live = item?.parent ? tweakLiveNote(item) : "";
  const rec = item?.flags?.sr2e?.fromDescription;
  const filled = rec && typeof rec.fields === "object" ? Object.entries(rec.fields as Record<string, any>).filter(([k, f]) => f && sys[k] === f.value) : [];
  const ware = type === "cyberware" && !sys.bioware && sys.grade && sys.grade !== "standard";
  return {
    tweakRows: rows,
    tweakTargets: TWEAK_TARGETS.map((k) => ({ key: k, label: tKey(TWEAK_TARGET_KEYS[k]) })),
    tweakValueMax: TWEAK_VALUE_MAX,
    tweakFull: rows.length >= TWEAK_MAX,
    tweaksOff: RULES.SHEET_V921.tweaks !== "on",
    tweakLive: live,
    carriedOn: RULES.SHEET_V921.carried === "on" && ["weapon", "armor", "gear"].includes(type),
    leftBehind: !isCarried(item),
    gradeEssence: ware ? { essence: wareEssenceLoss({ essenceCost: Number(sys.essenceCost ?? 0), grade: sys.grade } as any), price: cyberCost(sys.cost ?? 0, sys.grade).toLocaleString() } : null,
    fromDescription: filled.length ? tx('SR2E.App.Sheets.fromDescription', { list: filled.map(([k, f]) => `${f.text} → ${tKey(ACCESSORY_FIELD_KEYS[k] ?? '')} ${typeof f.value === "boolean" ? "" : String(f.value)}`.trim()).join(", ") }) : "",
  };
}

/** v0.92.1: when an item's tweaks count (shown under its tweak rows), or that they don't right now. */
function tweakLiveNote(item: any): string {
  const s = item?.system ?? {};
  switch (String(item?.type ?? "")) {
    case "cyberware": return s.installed && !s.damaged ? "" : tx('SR2E.App.Sheets.tweaksWhenInstalled');
    case "armor": return s.worn && isCarried(item) ? "" : tx('SR2E.App.Sheets.tweaksWhenWorn');
    case "weapon": case "gear": return isCarried(item) && !s.damaged ? "" : tx('SR2E.App.Sheets.tweaksWhenCarried');
    case "focus": return s.bonded && s.active !== false ? "" : tx('SR2E.App.Sheets.tweaksWhenBonded');
    case "adeptpower": case "power": return s.active !== false ? "" : tx('SR2E.App.Sheets.tweaksWhenActive');
    case "program": return s.loaded ? "" : tx('SR2E.App.Sheets.tweaksWhenLoaded');
    case "cyberdeck": return s.active ? "" : tx('SR2E.App.Sheets.tweaksWhenInUse');
    default: return "";
  }
}

/** v0.92.1: the item sheet's tweak rows (form fields `tweak.<n>.<field>`) back into the item's tweaks. */
export function tweaksFromForm(rows: unknown, previous: unknown = []): unknown[] {
  if (!rows || typeof rows !== "object") return [];
  const list = Array.isArray(rows) ? rows : Object.keys(rows as Record<string, unknown>).sort((a, b) => Number(a) - Number(b)).map((k) => (rows as any)[k]);
  // Review (B2): a row whose kind changed starts with an empty key (not the old kind's key read as a skill's name).
  const before = new Map(normalizeTweaks(previous).map((t) => [t.id, t.target]));
  return normalizeTweaks(list.map((r: any) => {
    const target = String(r?.target ?? "") as TweakTarget;
    const was = before.get(String(r?.id ?? ""));
    return { ...r, target, ...(was && was !== target ? { key: "" } : {}) };
  }));
}

/* ---- v0.23.0: sheet layout, summary and quick actions ---- */

/** v0.48.0: what an ordeal asks for, shown in the Initiate dialog. */
function ordealHint(actor: any, ordealId: string, grade: number): string {
  const o = RULES.OCCULT.initiation.ordeals.find((x) => x.id === ordealId);
  const i = RULES.OCCULT.initiation;
  switch (o?.effect) {
    case "attribute": return tx('SR2E.App.Sheets.ordealAsceticism');
    case "geas": return tx('SR2E.App.Sheets.ordealGeas');
    case "quest": return tx('SR2E.App.Sheets.ordealQuest');
    case "deed": return i.deed.gmConfirms ? tx('SR2E.App.Sheets.ordealDeedGmConfirms') : tx('SR2E.App.Sheets.ordealDeedGmSets');
    case "familiar": {
      const f = actor.getFlag?.("sr2e", "familiar");
      return familiarReady(f) ? tx('SR2E.App.Sheets.ordealFamiliarReady', { ally: f.allyName ?? tx('SR2E.App.Sheets.yourAlly') }) : tx('SR2E.App.Sheets.ordealFamiliarNeeds');
    }
    case "meditation": return tx('SR2E.App.Sheets.ordealMeditation', { attribute: cap(i.meditation.attribute), tn: meditationTn(grade), weeks: ordealWeeks("meditation", grade) });
    case "oath": {
      const group = i.oath.needsGroup;
      if (i.oath.geasMagic) return group ? tx('SR2E.App.Sheets.ordealOathGroupMagic', { magic: i.oath.geasMagic }) : tx('SR2E.App.Sheets.ordealOathMagic', { magic: i.oath.geasMagic });
      return group ? tx('SR2E.App.Sheets.ordealOathGroup') : tx('SR2E.App.Sheets.ordealOath');
    }
    case "thesis": return i.thesis.siteDice
      ? tx('SR2E.App.Sheets.ordealThesisSite', { skill: i.thesis.skill, fallback: cap(i.thesis.fallback), mod: RULES.ATTRIBUTE_DEFAULT_TN_MOD, tn: thesisTn(grade), weeks: ordealWeeks("thesis", grade) })
      : tx('SR2E.App.Sheets.ordealThesis', { skill: i.thesis.skill, fallback: cap(i.thesis.fallback), mod: RULES.ATTRIBUTE_DEFAULT_TN_MOD, tn: thesisTn(grade), weeks: ordealWeeks("thesis", grade) });
    default: return "";
  }
}

/**
 * v0.81.1 (S2-1): whether the power effect `id` on the actor `uuid` is one `doc`'s sheet lists: an effect on `doc`
 * itself, or one `doc` (any of its selves) put on another actor. A sheet button names its effect in `data-*`, which
 * rich text on a sheet can forge.
 */
function powerEffectOfSheet(doc: any, uuid: string, id: string): boolean {
  if (!uuid || !id) return false;
  const t: any = fromUuidSync(uuid);
  const fx = ((t?.getFlag?.("sr2e", "powerEffects") as any[] | undefined) ?? []).find((e: any) => e?.id === id);
  if (!t || !fx) return false;
  if (t.uuid === doc?.uuid) return true;
  const me: string[] = doc?.selfUuids?.() ?? [doc?.uuid];
  return typeof fx.fromUuid === "string" && me.includes(fx.fromUuid);
}

/**
 * v0.81.0 (S-6): remove the row a button's `data-index` names; false (nothing removed) when the index is missing,
 * not a whole number or past the end (`Number(undefined)` is NaN, and `splice(NaN, 1)` removes the first row).
 * v0.81.1 (S2-5): once per element: a second click before the re-render would read the new list and remove the next
 * row, so the element is marked and a marked one removes nothing.
 */
function spliceRow(list: unknown[], el: HTMLElement): boolean {
  if (el?.dataset?.["deleting"]) return false;
  const raw = el?.dataset?.["index"];
  const i = raw == null || raw === "" ? NaN : Number(raw);
  if (!Number.isInteger(i) || i < 0 || i >= list.length) return false;
  list.splice(i, 1);
  el.dataset["deleting"] = "1";
  return true;
}

/** Pick one option from a list (null if cancelled). Labels and values are escaped here (v0.81.0, S-1). */
async function pickOne(title: string, options: Array<{ value: string; label: string }>): Promise<string | null> {
  const r = await foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.choose')}</label><select name="pick" autofocus>${options.map((o) => `<option value="${escHtml(o.value)}">${escHtml(o.label)}</option>`).join("")}</select></div>`,
    ok: { callback: (_e: Event, b: any) => b.form.elements.pick.value as string },
    rejectClose: false,
  });
  return typeof r === "string" && r ? r : null;
}

/** Checkboxes for a modifier table (v0.44.0); read back with checkedIds. */
function tableChecks(table: ReadonlyArray<{ id: string; label: string; value: number }>, prefix: string): string {
  return `<fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Sheet.modifiers')}</legend>${table.map((m) => `<label class="sr2e-check"><input type="checkbox" name="${escHtml(prefix)}-${escHtml(m.id)}"> ${escHtml(m.label)} (${m.value > 0 ? "+" : ""}${m.value})</label>`).join("")}</fieldset>`;
}
function checkedIds(form: any, prefix: string): string[] {
  const obj = form?.elements ? Object.fromEntries([...form.elements].filter((e: any) => e.name).map((e: any) => [e.name, e.type === "checkbox" ? e.checked : e.value])) : form;
  return Object.entries(obj ?? {}).filter(([k, v]) => k.startsWith(`${prefix}-`) && v === true).map(([k]) => k.slice(prefix.length + 1));
}

/**
 * v0.50.0: a TN preview for a dialog: the base TN, the modifiers found by themselves (marked auto, each
 * with a box to switch it off for this roll) and the ones picked in the dialog, and the TN they make.
 * `base` null: only the modifiers and their sum. `key` tells two sides' boxes apart (the other side: "theirs§").
 */
export function tnPreviewHtml(o: { base?: number | null; baseLabel?: string; auto?: ReadonlyArray<{ id?: string; label: string; value: number }>; manual?: ReadonlyArray<{ id?: string; label: string; value: number }>; title?: string; note?: string; warn?: string; excluded?: ReadonlySet<string>; key?: string; fixed?: boolean }): string {
  const key = o.key ?? "";
  // v0.89.5: a row is switched off by its key (`modKey`: its id, else its label), the same in every language.
  const off = (m: { id?: string; label: string }) => Boolean(o.excluded?.has(`${key}${modKey(m)}`) || o.excluded?.has(`${key}${m.label}`));
  const auto = (o.auto ?? []).filter((m) => m.value);
  const manual = (o.manual ?? []).filter((m) => m.value);
  const sum = [...auto.filter((m) => !off(m)), ...manual].reduce((n, m) => n + (Number(m.value) || 0), 0);
  const val = (m: { value: number }) => `${m.value >= 0 ? "+" : ""}${m.value}`;
  const autoRow = (m: { id?: string; label: string; value: number }) => o.fixed
    ? `<li class="auto">${escHtml(m.label)} ${escHtml(val(m))}</li>`
    : `<li class="auto${off(m) ? " off" : ""}"><label class="sr2e-auto-mod"><input type="checkbox" data-sr2e-auto="${escHtml(`${key}${modKey(m)}`)}" ${off(m) ? "" : "checked"}> ${escHtml(m.label)} ${escHtml(val(m))}</label></li>`;
  const head = o.base != null
    ? `<strong class="sr2e-tn">${tx('SR2E.Dialog.Sheet.tn5', { part: o.title ? `${escHtml(o.title)}: ` : "", minTargetNumber: Math.max(RULES.MIN_TARGET_NUMBER, o.base + sum) })}</strong>`
    : `<strong class="sr2e-tn">${tx('SR2E.Dialog.Sheet.tn6', { part: o.title ? `${escHtml(o.title)}: ` : "", sign: sum >= 0 ? "+" : "", sum })}</strong>`;
  const rows = `${o.base != null ? `<li>${escHtml(o.baseLabel ?? tx('SR2E.Dialog.Sheet.base'))} ${o.base}</li>` : ""}${auto.map(autoRow).join("")}${manual.map((m) => `<li>${escHtml(m.label)} ${escHtml(val(m))}</li>`).join("")}`;
  return `${head}${rows ? `<ul>${rows}</ul>` : ""}${o.note ? `<p class="hint">${escHtml(o.note)}</p>` : ""}${o.warn ? `<p class="sr2e-warn">${escHtml(o.warn)}</p>` : ""}`;
}

/** v0.50.0: the found-by-themselves modifiers switched off in a dialog's preview (for one side: `key`). */
export function excludedOf(form: any, key = ""): string[] {
  const set: Set<string> | undefined = form?.sr2eExcluded;
  return set ? [...set].filter((k) => k.startsWith(key) && (key || !k.startsWith("theirs§"))).map((k) => k.slice(key.length)) : [];
}

/**
 * v0.50.0: keep a dialog's preview box live (on render, input and change). Unticking a found-by-itself
 * modifier in it switches that modifier off for this roll (read back with `excludedOf(form)`).
 */
export function livePreview(dialog: any, fill: (form: HTMLFormElement, excluded: ReadonlySet<string>) => string, selector = ".sr2e-preview"): void {
  const root: HTMLElement | null = dialog?.element ?? null;
  const form: any = root?.querySelector("form") ?? null;
  const box = form?.querySelector(selector) as HTMLElement | null;
  if (!form || !box) return;
  const excluded: Set<string> = form.sr2eExcluded ?? new Set<string>();
  form.sr2eExcluded = excluded;
  const refresh = () => {
    try { box.innerHTML = fill(form, excluded); } catch (err) { box.textContent = ""; console.warn(`${SYSTEM.LOG.HEAD}Preview failed`, err); }
  };
  // Typing waits a moment (line of sight and light are re-measured); a change refreshes once, straight away.
  let timer: ReturnType<typeof setTimeout> | null = null;
  const onChange = (ev: Event) => {
    if (timer) { clearTimeout(timer); timer = null; }
    const t = ev.target as HTMLInputElement | null;
    const k = t?.dataset?.["sr2eAuto"];
    if (k != null) { if (t!.checked) excluded.delete(k); else excluded.add(k); }
    refresh();
  };
  form.addEventListener("input", (ev: Event) => {
    const t = ev.target as HTMLInputElement | null;
    if (t?.dataset?.["sr2eAuto"] != null || t?.type === "checkbox" || t?.tagName === "SELECT") return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; refresh(); }, 150);
  });
  form.addEventListener("change", onChange);
  refresh();
}

/** The Upkeep tab (v0.33.0): lifestyle, nuyen and Karma, contacts, the ledger. */
function upkeepContext(actor: any): any {
  const st = actor.lifestyleStatus?.() ?? { label: "", cost: 0, days: null };
  const now = sysNow();
  const levels = RULES.UPKEEP.contacts.levels;
  // v0.49.0: what the lifestyle does beyond the bill.
  const level = String(actor.system.lifestyle?.level ?? "low");
  const od = lifestyleOverdue(st.days, level);
  const g = RULES.UPKEEP.effects.graceDays;
  const avail = lifestyleAvailabilityMods(level)[0]?.value ?? 0;
  const effects = [
    avail ? tx('SR2E.App.Sheets.tnFindingGear', { sign: avail > 0 ? "+" : "", tn: avail }) : "",
    od.overdue && RULES.UPKEEP.effects.overdueHomeCare ? tx('SR2E.App.Sheets.restingAtHomeCountsAs', { care: RULES.UPKEEP.lifestyles.find((l) => l.id === RULES.UPKEEP.effects.overdueHomeCare)?.label ?? RULES.UPKEEP.effects.overdueHomeCare }) : "",
    od.overdue && RULES.UPKEEP.effects.overdue !== "off" ? (od.evict ? tx('SR2E.App.Sheets.pastTheGraceDays') : tCount(Math.max(0, g - od.daysLate), 'SR2E.App.Sheets.graceDaysLeft')) : "",
  ].filter(Boolean).join(" · ");
  // v0.61.0: the DocWagon contract.
  const dw = actor.docwagonState?.() ?? { tier: "", status: tx('SR2E.App.Sheets.noContract'), active: false };
  return {
    effects,
    docwagonTiers: [{ key: "", label: tx('SR2E.App.Sheets.none') }, ...RULES.HEALTH_V61.docwagon.tiers.map((t) => ({ key: t.id, label: tx('SR2E.App.Sheets.aYear', { label: t.label, fee: t.yearlyFee.toLocaleString() }) }))],
    docwagonStatus: dw.tier ? dw.status : "",
    docwagonLapsed: Boolean(dw.tier) && !dw.active,
    docwagonOn: RULES.HEALTH_V61.docwagon.enabled,
    lifestyles: RULES.UPKEEP.lifestyles.map((l) => ({ key: l.id, label: tx('SR2E.App.Sheets.aMonth', { label: l.label, cost: l.cost.toLocaleString() }) })),
    // v0.73.0 (O31): a lifestyle owned outright.
    status: lifestyleStatusText(st),
    overdue: !st.permanent && st.days != null && st.days < 0,
    cost: st.cost.toLocaleString(),
    contacts: (actor.system.contacts ?? []).map((c: any) => ({ ...c, levelLabel: levels.find((l) => l.level === c.level)?.label ?? c.level,
      favourLabel: (c.favours ?? 0) > 0 ? tx('SR2E.App.Sheets.owesYou', { favours: c.favours }) : (c.favours ?? 0) < 0 ? tx('SR2E.App.Sheets.youOwe', { favours: -c.favours }) : "" })),
    ledger: [...(actor.system.ledger ?? [])].reverse().slice(0, 15).map((e: any) => ({
      ...e,
      when: e.t > now - 60 ? tx('SR2E.App.Sheets.now') : tx('SR2E.App.Sheets.daysAgo', { days: Math.floor((now - e.t) / 86400) }),
      amountLabel: e.kind === "nuyen" ? `${e.amount > 0 ? "+" : "−"}¥${Math.abs(e.amount).toLocaleString()}` : e.kind === "pool" ? tx('SR2E.App.Sheets.amountKarmaPool', { sign: e.amount > 0 ? "+" : "−", amount: Math.abs(e.amount) }) : tx('SR2E.App.Sheets.amountKarma', { sign: e.amount > 0 ? "+" : "−", amount: Math.abs(e.amount) }),
      negative: e.amount < 0,
    })),
  };
}

/** v0.49.0: the GM's saved item templates (world setting). */
function worldTemplates(): ItemTemplate[] {
  try { return (game.settings.get(SYSTEM.id, "itemTemplates") as ItemTemplate[]) ?? []; } catch { return []; }
}

/** Tabs: which exist for this actor, and which is open. */
function sheetLayout(actor: any, current?: string): { sheetTabs: Array<{ id: string; label: string; icon: string; active: boolean }>; activeTab: string; showMagicTab: boolean } {
  const items: any[] = [...actor.items];
  const showMagicTab = (actor.system.derived?.magic ?? 0) > 0 || (actor.system.tradition && actor.system.tradition !== "none")
    || items.some((i) => ["spell", "power", "focus", "adeptpower"].includes(i.type));
  const hasMatrix = items.some((i) => i.type === "cyberdeck" || i.type === "program");
  const hasRigging = Boolean(actor.system.derived?.rigging) || (actor.type === "character" && ownedVehicles(actor).length > 0);
  const tabs = [
    // v0.64.0: Current (a read-only reference) sits beside Main; Creation (the record and the log) after Upkeep.
    { id: "main", label: tx('SR2E.App.Sheets.main') }, ...(actor.type === "character" ? [{ id: "current", label: tx('SR2E.App.Sheets.current') }] : []), { id: "combat", label: tx('SR2E.App.Sheets.armory') }, { id: "effects", label: tx('SR2E.App.Sheets.effects') },
    ...(showMagicTab ? [{ id: "magic", label: tx('SR2E.App.Sheets.magic') }] : []),
    ...(hasMatrix ? [{ id: "matrix", label: tx('SR2E.App.Sheets.matrix') }] : []),
    ...(hasRigging ? [{ id: "rigging", label: tx('SR2E.App.Sheets.rigging') }] : []),
    { id: "gear", label: tx('SR2E.App.Sheets.gear') },
    ...(actor.type === "character" ? [{ id: "upkeep", label: tx('SR2E.App.Sheets.upkeep') }, { id: "creation", label: tx('SR2E.App.Sheets.creation') }] : []),
    { id: "bio", label: tx('SR2E.App.Sheets.bio') },
  ];
  const activeTab = tabs.some((t) => t.id === current) ? (current as string) : "main";
  // v0.68.0: each tab has its icon (the same on every sheet).
  return { sheetTabs: tabs.map((t) => ({ ...t, icon: tabIcon(t.id), active: t.id === activeTab })), activeTab, showMagicTab };
}

/** A token status's name for the summary (its label from CONFIG.statusEffects, else the id). */
export function statusLabel(id: string): string {
  const list: any[] = [...(((globalThis as any).CONFIG?.statusEffects ?? []) as any[])];
  const e = list.find((x: any) => x?.id === id);
  const raw = e?.name ?? e?.label ?? id;
  try { return String((globalThis as any).game?.i18n?.localize?.(raw) ?? raw); } catch { return String(raw); }
}

/** v0.81.1 (SEC2b-1): the most pips one pool draws. */
const MAX_POOL_PIPS = 50;

/** The dice pools as pips (the status strip shows them; Set pool reads one). */
function poolsOf(actor: any): any[] {
  const sys = actor.system, d = sys.derived ?? {};
  // v0.81.1 (SEC2b-1): at most MAX_POOL_PIPS pips, so a huge pool (a player writes their own Karma Pool) can't build
  // millions of elements on the GM's view of the sheet. The numbers beside them stay exact.
  const pips = (left: number, total: number) => Array.from({ length: Math.min(MAX_POOL_PIPS, Math.max(0, Math.floor(Number(total) || 0))) }, (_, i) => ({ value: i + 1, filled: i < left }));
  const pools: any[] = [{ key: "combat", label: tx('SR2E.App.Sheets.combat'), left: d.combatPoolLeft ?? 0, total: d.combatPool ?? 0 }];
  if ((d.spellPool ?? 0) > 0) {
    // v0.92.0 (RULES.MAGIC_V920.poolLayers): the narrow layers' dice left, beside the general pool.
    const l = d.spellLayers ?? {};
    const parts: string[] = [];
    if (Number(l.conc ?? 0) > 0) parts.push(tx('SR2E.App.MagicPool.layer', { name: String(l.concName ?? ''), left: Number(l.concLeft ?? 0), total: Number(l.conc ?? 0) }));
    if (Number(l.spec ?? 0) > 0) parts.push(tx('SR2E.App.MagicPool.layer', { name: String(l.specName ?? ''), left: Number(l.specLeft ?? 0), total: Number(l.spec ?? 0) }));
    pools.push({ key: "spell", label: tx('SR2E.App.Sheets.spell'), left: d.spellPoolLeft ?? 0, total: d.spellPool,
      ...(parts.length ? { narrow: `+${Number(l.concLeft ?? 0) + Number(l.specLeft ?? 0)}`, narrowMark: interpMark('magicPoolLayers'), narrowTitle: tx('SR2E.App.MagicPool.layersTitle', { layers: parts.join('; ') }) } : {}) });
  }
  if ((d.hackingPool ?? 0) > 0) pools.push({ key: "hacking", label: tx('SR2E.App.Sheets.hacking'), left: d.hackingPoolLeft ?? 0, total: d.hackingPool });
  if (d.rigging?.jumpedIn && (d.controlPool ?? 0) > 0) pools.push({ key: "control", label: tx('SR2E.App.Sheets.control'), left: d.controlPoolLeft ?? 0, total: d.controlPool });
  if ((sys.karma?.pool ?? 0) > 0) pools.push({ key: "karma", label: tx('SR2E.App.Sheets.karma'), left: d.karmaPoolLeft ?? 0, total: sys.karma.pool });
  for (const p of pools) p.pips = pips(p.left, p.total);
  return pools;
}

/**
 * The sheet header's summary: the pools (for the status strip) and the status chips. v0.81.0 (S-9): the condition,
 * initiative and actions it also built are shown by the status strip since v0.68 and were never read.
 */
function summaryContext(actor: any): any {
  const sys = actor.system, d = sys.derived ?? {};
  const pools = poolsOf(actor);
  const chips: string[] = [];
  if (d.metatype && d.metatype !== "Human") chips.push(d.metatype);
  if (d.astralMode && d.astralMode !== "physical") chips.push(d.astralMode);
  if (d.matrix?.jackedIn) chips.push(tx('SR2E.App.Sheets.jackedIn'));
  if (actor.isBroken?.()) chips.push(tx('SR2E.App.Sheets.broken'));
  // v0.45.0
  if (d.possessedBy) chips.push(tx('SR2E.App.Sheets.possessedBy', { name: d.possessedBy }));
  // v0.56.0: afraid (a Fear power), confused, concealed, guarded; manifesting.
  for (const e of (actor.getFlag?.("sr2e", "powerEffects") as any[] | undefined) ?? []) {
    const word = ({ fear: () => tx('SR2E.App.Sheets.afraid'), confusion: () => tx('SR2E.App.Sheets.confused'), concealment: () => tx('SR2E.App.Sheets.concealed'), guard: () => tx('SR2E.App.Sheets.guarded') } as Record<string, () => string>)[String(e.special ?? "")]?.();
    if (word && !chips.includes(word)) chips.push(word);
  }
  if (actor.isManifesting?.()) chips.push(tx('SR2E.App.Sheets.manifesting'));
  const possessing = actor.getFlag?.("sr2e", "possessing");
  if (possessing?.name) chips.push(tx('SR2E.App.Sheets.possessing', { name: possessing.name }));
  if (actor.system?.greatForm) chips.push(tx('SR2E.App.Sheets.greatForm'));
  if (actor.hungerInfo?.()?.hungry) chips.push(tx('SR2E.App.Sheets.hungry'));
  if ((actor.system?.recovering ?? []).some((r: any) => r.until > sysNow())) chips.push(tx('SR2E.App.Sheets.recovering'));
  if (d.matrix?.trace) chips.push(tx('SR2E.App.Sheets.tracedBy', { name: d.matrix.trace.icName }));
  for (const e of d.matrix?.psyche ?? []) chips.push((PSYCHOTROPIC_LABELS as any)[e.kind]?.toLowerCase?.() ?? e.kind);
  if (actor.transitLeft?.()) chips.push(tx('SR2E.App.Sheets.inTransit'));
  if (d.rigging?.vehicleUuid) {
    const v: any = fromUuidSync(d.rigging.vehicleUuid);
    if (v) chips.push(d.rigging.jumpedIn ? tx('SR2E.App.Sheets.jumpedInto', { name: v.name }) : tx('SR2E.App.Sheets.drivingVehicle', { name: v.name }));
  }
  const sustained = (sys.sustaining ?? []).filter((x: any) => !x.focusId && !x.quickened && !x.spiritUuid).length;
  if (sustained) chips.push(tx('SR2E.App.Sheets.sustaining', { count: sustained }));
  if (d.encumbrance) chips.push(tx('SR2E.App.Sheets.encumbered', { value: d.encumbrance }));
  if (actor.fullDefenseUp?.()) chips.push(tx('SR2E.App.Sheets.fullDefense2'));
  if (actor.isDelaying?.()) chips.push(tx('SR2E.App.Sheets.delaying'));
  if (actor.actingNow?.()) chips.push(tx('SR2E.App.Sheets.actingDelayed'));
  for (const w of [...actor.items].filter((i: any) => i.type === "weapon" && i.system.jammed)) chips.push(tx('SR2E.App.Sheets.weaponJammed', { name: w.name }));
  // v0.67.0: statuses by their name, not their id; the wound icons are left out (the monitor shows the wound).
  for (const st of [...(actor.statuses ?? [])]) {
    if (["unconscious", "bleeding", "dead"].includes(st) || String(st).startsWith("sr2eWound")) continue;
    chips.push(statusLabel(String(st)));
  }
  return { pools, chips };
}

/** The quick-action bar: the actions that apply to this character. */
function quickActions(actor: any, items: any[]): Array<{ action: string; label: string; icon: string; title: string; itemId?: string }> {
  const d = actor.system.derived ?? {};
  const out: Array<{ action: string; label: string; icon: string; title: string; itemId?: string }> = [{ action: "quickAttack", label: tx('SR2E.App.Sheets.attack'), icon: "fa-solid fa-crosshairs", title: tx('SR2E.App.Sheets.pickAWeaponAndAttack') }];
  if (items.some((i) => i.type === "spell")) out.push({ action: "quickCast", label: tx('SR2E.App.Sheets.cast'), icon: "fa-solid fa-wand-sparkles", title: tx('SR2E.App.Sheets.pickASpellAndCast') });
  if (actor.findSkill?.("Conjuring")) out.push({ action: "summonSpirit", label: tx('SR2E.App.Sheets.summon'), icon: "fa-solid fa-ghost", title: tx('SR2E.App.Sheets.summonASpirit') });
  if (actor.isAstral?.()) out.push({ action: "assense", label: tx('SR2E.App.Sheets.assense'), icon: "fa-solid fa-eye", title: tx('SR2E.App.Sheets.assense') }, { action: "astralAttack", label: tx('SR2E.App.Sheets.astralAttack'), icon: "fa-solid fa-hand-sparkles", title: tx('SR2E.App.Sheets.astralAttack') });
  if (items.some((i) => i.type === "weapon" && i.system.ammoMax > 0)) out.push({ action: "quickReload", label: tx('SR2E.App.Sheets.reload'), icon: "fa-solid fa-rotate", title: tx('SR2E.App.Sheets.reloadAWeapon') });
  out.push({ action: "firstAid", label: tx('SR2E.App.Sheets.firstAid'), icon: "fa-solid fa-kit-medical", title: tx('SR2E.App.Sheets.firstAidOnYourselfOr') });
  out.push({ action: "naturalHeal", label: tx('SR2E.App.Sheets.rest'), icon: "fa-solid fa-bed", title: tx('SR2E.App.Sheets.restAndHeal') });
  if (game.combat?.started) out.push(actor.fullDefenseUp?.() ? { action: "fullDefense", label: tx('SR2E.App.Sheets.onFullDefense'), icon: "fa-solid fa-shield-halved", title: tx('SR2E.App.Sheets.alreadyOnFullDefenseUntil') }
    : { action: "fullDefense", label: tx('SR2E.App.Sheets.fullDefense'), icon: "fa-solid fa-shield-halved", title: tx('SR2E.App.Sheets.declareFullDefense', { attribute: RULES.COMBAT.fullDefense.attribute, cost: RULES.COMBAT.fullDefense.initiativeCost }) });
  if (actor.isDelaying?.()) out.push({ action: "actNow", label: tx('SR2E.App.Sheets.actNow'), icon: "fa-solid fa-forward", title: tx('SR2E.App.Sheets.takeYourDelayedActionNow') });
  else if (actor.actingNow?.()) out.push({ action: "endDelayed", label: tx('SR2E.App.Sheets.done'), icon: "fa-solid fa-check", title: tx('SR2E.App.Sheets.finishYourDelayedAction') });
  else if (actor.isActing?.() && game.combat?.started) out.push({ action: "delayAction", label: tx('SR2E.App.Sheets.delay'), icon: "fa-solid fa-hourglass-half", title: tx('SR2E.App.Sheets.holdYourActionUntilLater') });
  for (const w of items.filter((i: any) => i.type === "weapon" && i.system.jammed)) out.push({ action: "clearJam", label: tx('SR2E.App.Sheets.clearJam'), icon: "fa-solid fa-wrench", title: tx('SR2E.App.Sheets.clearTheJamIn', { name: w.name }), itemId: w.id });
  out.push({ action: "perceive", label: tx('SR2E.App.Sheets.perceive'), icon: "fa-solid fa-magnifying-glass", title: tx('SR2E.App.Sheets.opposedPerceptionAgainstSomeoneSneaking') });
  // v0.58.0: a plain Perception test, and negotiating pay.
  out.push({ action: "notice", label: tx('SR2E.App.Sheets.notice'), icon: "fa-solid fa-eye", title: tx('SR2E.App.Sheets.aPlainPerceptionTestNotice') });
  if (actor.type === "character") out.push({ action: "negotiatePay", label: tx('SR2E.App.Sheets.pay'), icon: "fa-solid fa-handshake", title: tx('SR2E.App.Sheets.negotiateAJobsPayWith') });
  out.push({ action: "sneak", label: tx('SR2E.App.Sheets.sneak'), icon: "fa-solid fa-user-secret", title: tx('SR2E.App.Sheets.sneakPastOneOrMore') });
  out.push({ action: "athletics", label: tx('SR2E.App.Sheets.athletics'), icon: "fa-solid fa-person-swimming", title: tx('SR2E.App.Sheets.climbSwimOrJump') });
  if (actor.findSkill?.(RULES.STREET.rally.skill)) out.push({ action: "rally", label: tx('SR2E.App.Sheets.rally'), icon: "fa-solid fa-bullhorn", title: tx('SR2E.App.Sheets.rallyABrokenGroupLeadership') });
  out.push({ action: "searchPerson", label: tx('SR2E.App.Sheets.search'), icon: "fa-solid fa-hand", title: tx('SR2E.App.Sheets.lookSomeoneOverFriskThem') });
  out.push({ action: "socialTest", label: tx('SR2E.App.Sheets.social'), icon: "fa-solid fa-comments", title: tx('SR2E.App.Sheets.aSocialTestNegotiationEtiquette') });
  if ((actor.system.grunts?.size ?? 1) > 1 || (actor.system.professionalRating ?? 0) > 0) out.push({ action: "moraleTest", label: tx('SR2E.App.Sheets.morale'), icon: "fa-solid fa-flag", title: tx('SR2E.App.Sheets.moraleTestProfessionalRating') });
  // v0.55.0: burning, held, holding.
  if (actor.getFlag?.(SYSTEM.id, "onFire")) out.push({ action: "putOutFire", label: tx('SR2E.App.Sheets.putOutFire'), icon: "fa-solid fa-fire-extinguisher", title: tx('SR2E.App.Sheets.putOutTheFlames', { action: RULES.COMBAT.burning.putOut }) });
  if (actor.getFlag?.(SYSTEM.id, "heldBy")) out.push({ action: "breakFree", label: tx('SR2E.App.Sheets.breakFree'), icon: "fa-solid fa-person-running", title: tx('SR2E.App.Sheets.breakFreeOfTheHold') });
  if (game.combat?.started) out.push({ action: "holdTarget", label: tx('SR2E.App.Sheets.hold'), icon: "fa-solid fa-hand-fist", title: tx('SR2E.App.Sheets.grabAndPinTheTargeted') });
  if (actor.hasStatus?.("prone")) out.push({ action: "standUp", label: tx('SR2E.App.Sheets.standUp'), icon: "fa-solid fa-person-arrow-up-from-line", title: tx('SR2E.App.Sheets.standUpAction', { action: RULES.STATUSES.prone.standAction }) });
  if (allActors().some((a: any) => a.type === "site" && (a.system.devices ?? []).some((d: any) => DEVICE_LOCKS.includes(d.kind) && !d.bypassed))) out.push({ action: "quickBypass", label: tx('SR2E.App.Sheets.bypass'), icon: "fa-solid fa-lock-open", title: tx('SR2E.App.Sheets.bypassAMaglockOrDoor') });
  if (game.combat) out.push({ action: "rollInit", label: tx('SR2E.App.Sheets.initiative'), icon: "fa-solid fa-dice", title: tx('SR2E.App.Sheets.rollInitiativeIntoTheCurrent') });
  if (d.rigging?.vehicleUuid) out.push({ action: "driveVehicle", label: tx('SR2E.App.Sheets.drive'), icon: "fa-solid fa-car", title: tx('SR2E.App.Sheets.drivingTestWithTheVehicle') });
  if ((actor.jammerRating?.() ?? 0) > 0) out.push({ action: "jamLink", label: tx('SR2E.App.Sheets.jam'), icon: "fa-solid fa-tower-broadcast", title: tx('SR2E.App.Sheets.jamADronesRemoteLink') });
  // v0.73.0 (O28): intercept or spoof a drone's link.
  if (RULES.DRONES_V73.link.enabled && (actor.type === "character" || actor.type === "npc") && allActors().some((a: any) => a.type === "vehicle")) out.push({ action: "droneLink", label: tx('SR2E.App.Sheets.droneLink'), icon: "fa-solid fa-satellite-dish", title: tx('SR2E.App.Sheets.interceptADronesRemoteLink') });
  if (d.matrix) out.push(d.matrix.jackedIn ? { action: "jackOut", label: tx('SR2E.App.Sheets.jackOut'), icon: "fa-solid fa-plug-circle-xmark", title: tx('SR2E.App.Sheets.jackOut') } : { action: "jackIn", label: tx('SR2E.App.Sheets.jackIn'), icon: "fa-solid fa-plug", title: tx('SR2E.App.Sheets.jackIn') });
  // v0.57.0: riding a decker's hitcher jack.
  if (actor.system.matrix?.ridingWith) out.push({ action: "hitchRide", label: tx('SR2E.App.Sheets.unhitch'), icon: "fa-solid fa-link-slash", title: tx('SR2E.App.Sheets.unplugFromHitcherJack', { name: fromUuidSync(actor.system.matrix.ridingWith)?.name ?? tx('SR2E.App.Sheets.theDecker') }) });
  else if (!d.matrix && allActors().some((a: any) => a !== actor && (a.activeDeck?.()?.system?.hitchers ?? 0) > 0)) out.push({ action: "hitchRide", label: tx('SR2E.App.Sheets.hitch'), icon: "fa-solid fa-link", title: tx('SR2E.App.Sheets.rideAlongOnADeckers') });
  return out;
}

/** v0.58.0: a gear row's extras: tools, vision gear, surveillance gear and legality, and which buttons it gets. */
function gearExtras(i: any): { gearNote: string; canPlant: boolean; canListen: boolean; canSweep: boolean; canRadio: boolean; isId: boolean } {
  const sy = i.system ?? {};
  const parts: string[] = [];
  if (sy.tools?.level && sy.tools.level !== "none") { const label = RULES.CHARACTERS_V58.tools.levels.find((l) => l.id === sy.tools.level)?.label ?? sy.tools.level; parts.push(sy.tools.skill ? `${label} (${sy.tools.skill})` : tx('SR2E.App.Sheets.toolsAnyBr', { label })); }
  const o = sy.optics ?? {};
  const eyes = [o.lowLight ? tx('SR2E.App.Sheets.lowLightVision') : "", o.thermographic ? tx('SR2E.App.Sheets.thermographicVision') : "", o.flareComp ? tx('SR2E.App.Sheets.flareComp') : "", o.magnification ? tx('SR2E.App.Sheets.magValue', { value: o.magnification }) : ""].filter(Boolean);
  if (eyes.length) parts.push(o.worn ? tx('SR2E.App.Sheets.eyesWorn', { eyes: eyes.join(", ") }) : tx('SR2E.App.Sheets.eyesNotWorn', { eyes: eyes.join(", ") }));
  const k = surveillanceKind(String(sy.surveillance?.kind ?? ""));
  if (k) parts.push(`${k.label} ${sy.surveillance.rating}${sy.surveillance.plantedName ? tx('SR2E.App.Sheets.plantedOn', { name: sy.surveillance.plantedName }) : ""}${!k.listens && !k.transmits && k.id !== "bugScanner" ? (sy.surveillance.active !== false ? tx('SR2E.App.Sheets.switchedOn') : tx('SR2E.App.Sheets.switchedOff')) : ""}`);
  if (sy.legality) { const label = RULES.GEAR_V58.legality.categories.find((c) => c.id === sy.legality)?.label ?? sy.legality; parts.push(sy.permit ? tx('SR2E.App.Sheets.legalityPermit', { label }) : label); }
  // v0.61.0: radios, IDs and skill help.
  if (Number(sy.radio?.rating ?? 0) > 0) parts.push(sy.radio.encryption ? tx('SR2E.App.Sheets.radioEncryption', { rating: sy.radio.rating, encryption: sy.radio.encryption }) : tx('SR2E.App.Sheets.radioRating', { rating: sy.radio.rating }));
  if (sy.identity?.kind) {
    const kind = sy.identity.kind === "sin" ? tx('SR2E.App.Sheets.sin') : tx('SR2E.App.Sheets.licence');
    const id = sy.identity.fake ? tx('SR2E.App.Sheets.fakeId', { kind, rating: sy.identity.rating }) : kind;
    parts.push(sy.identity.kind === "licence" && sy.identity.covers ? tx('SR2E.App.Sheets.idCovers', { id, covers: sy.identity.covers }) : id);
  }
  if ((sy.skillMods ?? []).length) parts.push(skillModsText(sy.skillMods));
  return { gearNote: parts.join(" · "), canPlant: Boolean(k?.transmits) && !sy.surveillance?.plantedOn, canListen: Boolean(k?.listens) && (!k?.transmits || Boolean(sy.surveillance?.plantedOn)), canSweep: k?.id === "bugScanner",
    canRadio: Number(sy.radio?.rating ?? 0) > 0, isId: Boolean(sy.identity?.kind) };
}

/** A skill row: what it rolls (the rating, the specialization, or the attribute when defaulting). */
export function skillRow(actor: any, i: any): any {
  const r = i.system.rating ?? 0;
  // v0.58.0: a Reaction-linked skill (vehicles) defaults to Reaction.
  const attr = i.system.attribute === "reaction" ? Number(actor.system.derived?.reaction ?? 0) : actor.system.attributes?.[i.system.attribute]?.total ?? 0;
  const diceLabel = r > 0 ? (i.system.specializationRating ? tx('SR2E.App.Sheets.diceSpecialized', { dice: r, specialized: i.system.specializationRating }) : tx('SR2E.App.Sheets.diceCount', { dice: r })) : tx('SR2E.App.Sheets.diceDefaulting', { dice: attr, attribute: i.system.attribute, mod: RULES.ATTRIBUTE_DEFAULT_TN_MOD });
  const improve = actor.type === "character" ? actor.improveCost?.({ skillId: i.id }) : null;
  const improveConc = actor.type === "character" && i.system.concentration ? actor.improveCost?.({ skillId: i.id, concentration: true }) : null;
  return { id: i.id, name: i.name, system: i.system, diceLabel, improve, improveConc };
}

/** What a bioware kind does at its rating, in words. */
function bioHint(sy: any): string {
  const e = bioEffect({ name: "", bioKind: sy.bioKind ?? "other", rating: sy.rating ?? 0, installed: true, active: true });
  const parts: string[] = [];
  for (const [k, v] of Object.entries(e.attributes)) if (v) parts.push(`${cap(k)} +${v}`);
  if (e.initiativeDice) parts.push(tx('SR2E.App.Sheets.bioInitiative', { dice: e.initiativeDice }));
  if (e.ballistic || e.impact) parts.push(tx('SR2E.App.Sheets.bioArmor', { ballistic: e.ballistic, impact: e.impact }));
  if (e.toxinDice) parts.push(tx('SR2E.App.Sheets.bioToxinDice', { dice: e.toxinDice }));
  if (e.inhalantDice) parts.push(tx('SR2E.App.Sheets.bioInhalantDice', { dice: e.inhalantDice }));
  // v0.78.0 (RULES.BOOK_V78.toxinBioware 'power'): the toxin extractor and tracheal filter lower the Power.
  for (const [vec, off] of Object.entries(e.powerOff ?? {})) if (off) parts.push(vec === "injection" ? tx('SR2E.App.Sheets.bioPowerInjected', { off }) : vec === "inhalation" ? tx('SR2E.App.Sheets.bioPowerInhaled', { off }) : tx('SR2E.App.Sheets.bioPowerVector', { off, vector: vec }));
  if (e.boxesOff) parts.push(tx('SR2E.App.Sheets.bioBoxesOff', { boxes: e.boxesOff }));
  if (e.ignoreBoxes) parts.push(tx('SR2E.App.Sheets.bioIgnoreBoxes', { boxes: e.ignoreBoxes }));
  if (sy.bioKind === "adrenalPump") parts.push(tx('SR2E.App.Sheets.bioAdrenalPump'));
  // v0.72.0 (O9): Shadowtech health bioware (rules/vitals.ts).
  const v = bioVitals([{ bioKind: sy.bioKind ?? "other", rating: sy.rating ?? 0, installed: true }]);
  if (v.healingDice) parts.push(tx('SR2E.App.Sheets.bioHealingDice', { dice: v.healingDice }));
  if (v.healingTimeFactor < 1) parts.push(tx('SR2E.App.Sheets.bioHealingTime', { pct: Math.round(v.healingTimeFactor * 100) }));
  if (v.bloodToxinDice) parts.push(tx('SR2E.App.Sheets.bioBloodToxinDice', { dice: v.bloodToxinDice, vectors: tList(v.toxinVectors) }));
  if (v.breathTurns) parts.push(tx('SR2E.App.Sheets.bioBreath', { turns: v.breathTurns }));
  if (v.lifestyleMultiplier !== 1) parts.push(tx('SR2E.App.Sheets.bioLifestyle', { factor: v.lifestyleMultiplier }));
  return parts.length ? tx('SR2E.App.Sheets.bioAtRating', { rating: sy.rating ?? 0, parts: parts.join("; ") }) : tx('SR2E.App.Sheets.otherBioware');
}

/** A cyberware row: what it is, its cost in Essence (or a limb's capacity), and its state. */
export function cyberRow(actor: any, i: any): any {
  const sy = i.system;
  const limbs = actor.system.derived?.cyber?.limbs ?? [];
  const host = sy.housedIn ? [...actor.items].find((x: any) => x.id === sy.housedIn) : null;
  const parts: string[] = [];
  parts.push(sy.bioware ? tx('SR2E.App.Sheets.biBioware', { bi: sy.bodyIndex }) : host ? tx('SR2E.App.Sheets.inHostCapacity', { host: host.name, capacity: sy.essenceCost }) : tx('SR2E.App.Sheets.essGrade', { essence: sy.essenceCost, grade: sy.grade }));
  if (sy.kind && sy.kind !== "other") parts.push(sy.kind);
  if (sy.bioware && sy.bioKind && sy.bioKind !== "other") parts.push(`${sy.bioKind} ${sy.rating}${sy.cultured ? tx('SR2E.App.Sheets.culturedNote') : ""}${sy.bioKind === "adrenalPump" ? (sy.bioActive ? tx('SR2E.App.Sheets.activeNote') : tx('SR2E.App.Sheets.offNote')) : ""}`);
  if (sy.kind === "cyberlimb") {
    const l = limbs.find((x: any) => x.id === i.id);
    parts.push(l ? tx('SR2E.App.Sheets.limbStatsCapacity', { strength: sy.limb?.strength, quickness: sy.limb?.quickness, used: l.capacity.used, capacity: l.capacity.capacity }) : tx('SR2E.App.Sheets.limbStats', { strength: sy.limb?.strength, quickness: sy.limb?.quickness }));
  }
  if (sy.kind === "skillwires") parts.push(tx('SR2E.App.Sheets.ratingLower', { rating: sy.rating }));
  if (sy.reflexes || /reflex|enhancer/i.test(i.name)) parts.push(tx('SR2E.App.Sheets.reflexesLine', { reflexes: sy.reflexes || tx('SR2E.App.Sheets.reflexes'), reaction: sy.reaction, dice: sy.initiativeDice }));
  if (sy.cost) parts.push(`${wareCost(sy)}¥`);
  if (!sy.installed) parts.push(tx('SR2E.App.Sheets.notInstalled'));
  if (sy.damaged) parts.push(tx('SR2E.App.Sheets.damagedCaps'));
  return { id: i.id, name: i.name, system: sy, summary: parts.join(" · ") };
}

/**
 * v0.92.1 (the owner's feedback): the Essence line's tooltip: the installed ware that takes Essence, each at its grade
 * ("Wired reflexes 2 (alpha): 2.4"), biggest first. Bioware (Body Index) and ware housed in a limb take none.
 */
/** v0.92.1 review (N11): a ware grade's name, translated. */
function wareGradeLabel(g: string): string {
  return g === "alpha" ? tx('SR2E.App.Sheets.alphaware') : g === "beta" ? tx('SR2E.App.Sheets.betaware') : g === "delta" ? tx('SR2E.App.Sheets.deltaware') : g === "standard" ? tx('SR2E.App.Sheets.standard') : g;
}

export function essenceWareLine(items: any[]): string {
  const rows = items.filter((i: any) => i.type === "cyberware" && i.system?.installed && !i.system?.bioware && !i.system?.housedIn)
    .map((i: any) => ({ name: String(i.name), grade: String(i.system.grade ?? "standard"), e: wareEssenceLoss({ essenceCost: Number(i.system.essenceCost ?? 0), grade: i.system.grade ?? "standard" } as any) }))
    .filter((r) => r.e > 0).sort((a, b) => b.e - a.e);
  if (!rows.length) return "";
  return rows.map((r) => (r.grade === "standard" ? tx('SR2E.App.Sheets.essenceWareRow', { name: r.name, essence: r.e }) : tx('SR2E.App.Sheets.essenceWareRowGrade', { name: r.name, grade: wareGradeLabel(r.grade), essence: r.e }))).join("\n");
}

/** A weapon row: damage, ranges in metres for this wielder, ammunition. */
export function weaponRow(actor: any, i: any): any {
  const w = i.system;
  const str = actor.system.attributes?.strength?.total ?? 0;
  const r = w.melee ? null : weaponRange(w, str, i.name);
  const ammo = isKnownAmmo(w.ammoType ?? "standard") ? findAmmo(w.ammoType ?? "standard") : { id: String(w.ammoType), label: tx('SR2E.App.Sheets.notInTheAmmunitionList', { ammo: w.ammoType }) };
  return {
    id: i.id, name: i.name, system: w, damageLabel: damageLabel(w),
    // v0.92.1 (RULES.SHEET_V921.carried): left behind (shown dimmed; not in the combat column).
    leftBehind: !isCarried(i),
    rangeLabel: r ? `${r.short}/${r.medium}/${r.long}/${r.extreme} m` : "",
    ammoLabel: !w.melee && w.ammoMax > 0 && ammo && ammo.id !== "standard" ? ammo.label : "",
    // v0.37.0: ammo as pips (up to 40 rounds), and a button per firing mode.
    pips: !w.melee && w.ammoMax > 0 && w.ammoMax <= 40 ? Array.from({ length: w.ammoMax }, (_x, k) => k < (w.ammo ?? 0)) : null,
    modeButtons: w.melee ? [] : parseFiringModes(w.modes ?? ""),
    // v0.43.0: accessories, and a bipod or tripod to set up.
    accessoryLabel: w.melee ? "" : [w.laserSight ? tx('SR2E.App.Sheets.laser') : "", (w.scope ?? 0) > 0 ? tx('SR2E.App.Sheets.scopeValue', { scope: w.scope }) : "", w.shockPad ? tx('SR2E.App.Sheets.shockPad') : "", w.fuse ? tx('SR2E.App.Sheets.fuseValue', { fuse: w.fuse }) : "", w.smartGrenade ? tx('SR2E.App.Sheets.smart') : ""].filter(Boolean).join(", "),
    support: !w.melee && ["bipod", "tripod"].includes(w.support) ? w.support : "",
  };
}


/* ---- v0.24.0: vehicles and rigging ---- */

/** v0.89.6: a vehicle's control mode in words (was the MODE_LABELS table). */
function modeLabel(mode: string): string | undefined {
  switch (mode) {
    case "autopilot": return tx('SR2E.App.Sheets.autopilot');
    case "manual": return tx('SR2E.App.Sheets.driving');
    case "jumped": return tx('SR2E.App.Sheets.jumpedIn');
    default: return undefined;
  }
}

// v0.91.4 review (R6): a vehicle bought, given, renamed or removed: its buyer's open sheet shows it (the Rigging tab).
if (typeof Hooks !== "undefined") {
  const buyerSheet = (a: any, ch?: any) => {
    const by = a?.flags?.[SYSTEM.id]?.boughtBy;
    if (a?.type !== "vehicle" || typeof by !== "string" || (ch && typeof ch === "object" && !("name" in ch) && !("ownership" in ch))) return;
    const buyer: any = fromUuidSync(by);
    if (buyer?.sheet?.rendered) void buyer.sheet.render();
  };
  Hooks.on("createActor", (a: any) => buyerSheet(a)); Hooks.on("deleteActor", (a: any) => buyerSheet(a)); Hooks.on("updateActor", (a: any, ch: any) => buyerSheet(a, ch));
}

/** v0.91.5: "Get a permit for X: ¥cost, time. Paid by Y?" (false when declined or there is no permit to get). */
async function confirmPermit(payer: any, ref: string): Promise<boolean> {
  const q: any = await payer?.permitQuote?.(ref);
  if (!q) { ui.notifications.warn(tx('SR2E.Notify.Legal.gone')); return false; }
  const name = `<strong>${escHtml(q.name)}</strong>`;
  const who = `<strong>${escHtml(payer.name)}</strong>`;
  const cost = escHtml(q.cost.toLocaleString());
  const have = escHtml(Number(payer.system?.nuyen ?? 0).toLocaleString());
  const time = escHtml(timeLabel(q.hours));
  const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Legal.title', { name: q.name }) }, content: `<p>${tx('SR2E.Dialog.Legal.content', { name, cost, time, payer: who, have })}</p>`, rejectClose: false } as any);
  return Boolean(ok);
}

/** v0.91.4: the vehicles and drones a character bought or was given from the shop (that this user may see). */
function ownedVehicles(actor: any): any[] {
  return allActors().filter((a: any) => a.type === "vehicle" && a.flags?.[SYSTEM.id]?.boughtBy === actor.uuid && a.testUserPermission?.(game.user, "LIMITED"));
}

/** The Rigging section: control rig, Control Pool, the vehicle being driven, the vehicles owned. Null for non-riggers not driving (and owning none). */
function riggingContext(actor: any) {
  const owned = actor.type === "character" ? ownedVehicles(actor) : [];
  // v0.91.4: a character with vehicles of their own has the tab too (to take the controls of them by hand).
  const r = actor.system.derived?.rigging ?? (owned.length ? { vcr: 0, reaction: 0, initiativeDice: 0, jumpedIn: false, rcd: 0 } : null);
  if (!r) return null;
  const v: any = actor.riggedVehicle?.() ?? null;
  const at = v && v.system.controllerUuid === actor.uuid;
  const vs = v?.system;
  return {
    vcr: r.vcr, reaction: r.reaction, initiativeDice: r.initiativeDice, jumpedIn: r.jumpedIn,
    pool: actor.system.derived.controlPool ?? 0, poolLeft: actor.system.derived.controlPoolLeft ?? 0,
    canJump: r.vcr > 0 || !RULES.RIGGING.jumpInNeedsVcr,
    rcd: r.rcd ?? 0, rcdCapacity: rcdCapacity(r.rcd ?? 0),
    // v0.91.4: the vehicles and drones this character bought or was given from the shop.
    owned: owned.map((a: any) => ({ uuid: a.uuid, name: a.name, drone: Boolean(a.system?.drone) })),
    // v0.46.0: the deck's signal, and each drone's link (range, jammed).
    signal: actor.rcdSignal?.() ?? 0,
    rangeKm: (actor.remoteLink?.(actor)?.check?.rangeKm) ?? 0,
    drones: (actor.subscribedDrones?.() ?? []).map((d: any) => {
      const l = actor.remoteLink?.(d);
      const link = d.system.jammed?.active ? tx('SR2E.App.Sheets.jammed') : l?.check?.checked ? l.check.note : "";
      return { uuid: d.uuid, name: d.name, status: d.system.derived?.status ?? "ok", pilot: d.system.derived?.autopilotRating ?? 0,
        ctl: d.system.controllerUuid === actor.uuid ? modeLabel(d.system.controlMode) : "", link, linkBad: Boolean(d.system.jammed?.active || (l?.check?.checked && (!l.check.inRange || l.check.far))) };
    }),
    site: v?.type === "site" && v.system.riggerUuid === actor.uuid ? { uuid: v.uuid, name: v.name, alert: v.system.alert, tally: v.system.tally, devices: (v.system.devices ?? []).length } : null,
    vehicle: at ? {
      uuid: v.uuid, name: v.name, modeLabel: modeLabel(vs.controlMode) ?? vs.controlMode,
      handling: vs.handling, handlingOffroad: vs.handlingOffroad, speed: vs.speed, currentSpeed: vs.currentSpeed, body: vs.body, armor: vs.armor,
      condition: vs.condition, max: RULES.VEHICLES.conditionBoxes, damageMod: vs.derived?.damageModifier ?? 0, skill: vs.derived?.skill ?? "",
      remote: vs.controlMode === "jumped" && !v.isAboard?.(actor),
    } : null,
  };
}

/**
 * The Driving test dialog. `driver` null = the vehicle's autopilot. Returns the driveTest options,
 * or null if cancelled.
 */
async function driveDialog(driver: any | null, vehicle: any): Promise<any | null> {
  const v = vehicle.system;
  const mode = driver ? (v.controlMode === "jumped" && driver.system.rigging?.jumpedIn ? "jumped" : "manual") : "autopilot";
  const left = mode === "jumped" ? (driver.system.derived?.controlPoolLeft ?? 0) : 0;
  const skillName = String(v.derived?.skill ?? "");
  const skill = driver && skillName ? driver.findSkill(skillName) : null;
  const over = overSpeed(Number(v.currentSpeed ?? 0), Number(v.speed ?? 0));
  const def = RULES.VEHICLES.defaultAttribute;
  let skillRows = "";
  if (driver && skill && skill.system.rating > 0 && skill.system.specializationRating > 0) {
    skillRows = `<label class="sr2e-check"><input type="checkbox" name="useSpec"> ${tx('SR2E.Dialog.Sheet.useSpecialization', { skillSpecialization: escHtml(skill.system.specialization || tx('SR2E.Dialog.Sheet.specialization')), skillSpecializationRating: escHtml(skill.system.specializationRating) })}</label>`;
  } else if (driver && !(skill?.system.rating > 0)) {
    const others = [...driver.items].filter((i: any) => i.type === "skill" && i.system.rating > 0);
    skillRows = `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.noSkillDefaultTo', { skillName: escHtml(skillName || tx('SR2E.Dialog.Sheet.vehicle2')) })}</label><select name="related">
      <option value="">${tx('SR2E.Dialog.Sheet.tn9', { def: escHtml(cap(def)), attributeDefaultTnMod: RULES.ATTRIBUTE_DEFAULT_TN_MOD })}</option>
      ${others.map((o: any) => `<option value="${escHtml(o.id)}">${tx('SR2E.Dialog.Sheet.tn10', { name: escHtml(o.name), rating: escHtml(o.system.rating), skillDefaultTnMod: RULES.SKILL_DEFAULT_TN_MOD })}</option>`).join("")}</select></div>`;
  }
  const who = mode === "autopilot" ? (v.drone ? tx('SR2E.App.Sheets.pilotRating', { rating: v.derived?.autopilotRating ?? 0 }) : tx('SR2E.App.Sheets.autonavRating', { rating: v.derived?.autopilotRating ?? 0 })) : `${driver.name} (${modeLabel(mode)})`;
  // v0.48.0: the scene's weather (untick for a covered place).
  const wd = weatherDriving((SR2Actor as any).sceneWeather?.(vehicle.sceneHere?.() ?? null) ?? "clear");
  const weatherRow = wd ? `<label class="sr2e-check"><input type="checkbox" name="weather" checked> ${tx('SR2E.Dialog.Sheet.weather', { wdLabel: escHtml(wd.label), wdValue: wd.value })}</label>` : "";
  // v0.50.0: the scene's terrain, set in the GM panel.
  const sceneTerrain = (SR2Actor as any).sceneTerrain?.(vehicle.sceneHere?.() ?? null) ?? "normal";
  const readDrive = (f: HTMLFormElement) => {
    const el: any = f.elements;
    const sit = Array.from(f.querySelectorAll<HTMLInputElement>('input[name="sit"]:checked')).map((x) => x.value);
    const mod = Number(el.mod.value) || 0;
    return {
      terrain: String(el.terrain.value), situational: sit, offroad: el.offroad ? Boolean(el.offroad.checked) : false,
      crashTest: Boolean(el.crash.checked), label: String(el.label.value ?? "").trim(),
      poolDice: el.pool ? Math.max(0, Math.min(left, Math.floor(Number(el.pool.value) || 0))) : 0,
      useSpecialization: Boolean(el.useSpec?.checked), relatedSkillId: (el.related?.value as string) || null,
      modifiers: mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [],
      ...(el.weather ? { weather: Boolean(el.weather.checked) } : {}),
      exclude: excludedOf(f),
    };
  };
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Sheet.drivingTest', { vehicleName: vehicle.name }) },
    position: { width: 440 },
    content: `<p class="hint">${tx('SR2E.Dialog.Sheet.vsHandling', { who: escHtml(who), handling: escHtml(v.handling), part: v.handlingOffroad > 0 ? tx('SR2E.Dialog.Sheet.offRoad', { handlingOffroad: escHtml(v.handlingOffroad) }) : "", part2: v.derived?.damageModifier ? tx('SR2E.Dialog.Sheet.vehicleDamage', { derivedDamageModifier: escHtml(v.derived.damageModifier) }) : "" })}</p>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.terrain')}</label><select name="terrain">${RULES.VEHICLES.terrain.map((t) => `<option value="${escHtml(t.id)}" ${t.id === sceneTerrain ? "selected" : ""}>${escHtml(t.label)} (${t.value >= 0 ? "+" : ""}${t.value})</option>`).join("")}</select></div>
      ${v.handlingOffroad > 0 ? `<label class="sr2e-check"><input type="checkbox" name="offroad" ${v.offroad ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.offRoadHandling', { handlingOffroad: escHtml(v.handlingOffroad) })}</label>` : ""}
      ${RULES.VEHICLES.drivingModifiers.map((m) => `<label class="sr2e-check"><input type="checkbox" name="sit" value="${escHtml(m.id)}" ${m.id === "overSpeed" && over ? "checked" : ""}> ${escHtml(m.label)} (${m.value >= 0 ? "+" : ""}${m.value})${m.id === "overSpeed" && over ? ` <em>${tx('SR2E.Dialog.Sheet.auto')}</em>` : ""}</label>`).join("")}
      <label class="sr2e-check"><input type="checkbox" name="crash"> ${tx('SR2E.Dialog.Sheet.crashTestNoSuccessesMeansA', { currentSpeed: escHtml(v.currentSpeed), power: crashDamage(Number(v.currentSpeed ?? 0)).power })}</label>
      ${weatherRow}
      ${skillRows}
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
      ${mode === "jumped" ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.controlPoolDiceLeft', { left: escHtml(left) })}</label><input name="pool" type="number" value="0" min="0" max="${escHtml(left)}"></div>` : ""}
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.label')}</label><input name="label" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGSwervePastTheRoadblock')}"></div>
      <div class="sr2e-preview" aria-live="polite"></div>
      <p class="hint">${tx('SR2E.Dialog.Sheet.overItsSpeedPoorVisibilityLight')}</p>`,
    ok: { label: tx('SR2E.Dialog.Sheet.roll'), callback: (_e: Event, b: any) => readDrive(b.form as HTMLFormElement) },
    // v0.50.0: the TN with everything found by itself (switchable).
    render: (_e: Event, dialog: any) => livePreview(dialog, (f, excluded) => {
      const c = readDrive(f);
      const pv = (driver ?? vehicle).previewDrive?.({ ...c, vehicle });
      if (!pv) return "";
      const picked = new Set<string>([...c.situational.map((id: string) => RULES.VEHICLES.drivingModifiers.find((d) => d.id === id)?.label ?? ""), ...RULES.VEHICLES.terrain.map((t) => t.label)]);
      const manual = pv.modifiers.filter((m: any) => picked.has(m.label) || c.modifiers.some((x: any) => x === m || x.label === m.label));
      return tnPreviewHtml({ base: pv.base, baseLabel: tx('SR2E.Dialog.Sheet.handling'), auto: pv.modifiers.filter((m: any) => !manual.includes(m)), manual: [...manual, ...c.modifiers], excluded });
    }),
    rejectClose: false,
  });
  return result ?? null;
}

/** Vehicles and drones: stats, damage track, driver and mode, people aboard, driving and crash. */
export class SR2VehicleSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** v0.59.0: dropped items arrive uninstalled / unbonded / unloaded, move between actors, and only fitting types (applications/drops.ts). */
  async _onDropItem(event: any, item: any): Promise<any> {
    return dropItemOnActor(this, event, item, () => (super._onDropItem as any)(event, item));
  }

  /** v0.91.5 (RULES.SHOP_V915.permits 'buy'): a player gets the vehicle's permit with Get a permit…, not by ticking the box. */
  _processFormData(event: any, form: any, formData: any): any {
    const data: any = (super._processFormData as any)(event, form, formData);
    if (!data || typeof data !== "object") return data;
    const flat: Record<string, unknown> = foundry.utils.flattenObject(data);
    if (!refusePermitTick(this.document, flat)) return data;
    setTimeout(() => void this.render(), 0);
    return foundry.utils.expandObject(flat);
  }

  /** v0.91.5: get a permit for this vehicle or drone, paid by the character who bought it (or this user's own). */
  static async #onGetPermit(this: SR2VehicleSheet) {
    const v: any = this.document;
    const payer: any = vehiclePermitPayer(v);
    if (!payer?.getPermit) return ui.notifications.warn(tx('SR2E.Notify.Legal.noPayer'));
    if (!(await confirmPermit(payer, `vehicle:${v.uuid}`))) return;
    if (await payer.getPermit(`vehicle:${v.uuid}`)) this.render();
  }

  static DEFAULT_OPTIONS: Record<string, any> = {
    classes: ["sr2e", "sheet", "actor", "vehicle"],
    position: { width: 600, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      ...SHEET_TOOL_ACTIONS,
      getPermit: SR2VehicleSheet.#onGetPermit,
      setCondition: SR2VehicleSheet.#onSetCondition,
      setDriver: SR2VehicleSheet.#onSetDriver,
      autopilot: SR2VehicleSheet.#onAutopilot,
      driveVehicle: SR2VehicleSheet.#onDrive,
      crashVehicle: SR2VehicleSheet.#onCrash,
      repairVehicle: SR2VehicleSheet.#onRepair,
      repairTest: SR2VehicleSheet.#onRepairTest,
      addOccupant: SR2VehicleSheet.#onAddOccupant,
      removeOccupant: SR2VehicleSheet.#onRemoveOccupant,
      openActor: SR2VehicleSheet.#onOpenActor,
      editItem: SR2VehicleSheet.#onEditItem,
      deleteItem: SR2VehicleSheet.#onDeleteItem,
      fireMounted: SR2VehicleSheet.#onFire,
      ramVehicle: SR2VehicleSheet.#onRam,
      sensorTest: SR2VehicleSheet.#onSensor,
      clearLock: SR2VehicleSheet.#onClearLock,
      startChase: SR2VehicleSheet.#onStartChase,
      chaseTurn: SR2VehicleSheet.#onChaseTurn,
      endChase: SR2VehicleSheet.#onEndChase,
      // v0.46.0
      addMod: SR2VehicleSheet.#onAddMod,
      editMod: SR2VehicleSheet.#onEditMod,
      deleteMod: SR2VehicleSheet.#onDeleteMod,
      installMod: SR2VehicleSheet.#onInstallMod,
      removeMod: SR2VehicleSheet.#onRemoveMod,
      jamLink: SR2VehicleSheet.#onJam,
      unjam: SR2VehicleSheet.#onUnjam,
      clearDroneLink: SR2VehicleSheet.#onClearDroneLink,
      // v0.57.0
      pushSpeed: SR2VehicleSheet.#onPushSpeed,
      crashTest: SR2VehicleSheet.#onCrashTest,
      designVehicle: SR2VehicleSheet.#onDesign,
    },
  };

  static PARTS: Record<string, any> = {
    main: { template: `${SYSTEM.PATH.TEMPLATES}/actor-vehicle-sheet.hbs`, scrollable: [""] },
  };

  /** v0.63.0: search, Edit/Play, folding sections; v0.68.0: section icons, steppers (vehicles keep one page). */
  async _onRender(context: any, options: any): Promise<void> {
    await (super._onRender as any)?.(context, options);
    decorateSheet(this);
    decorateInterface(this);
  }

  async _prepareContext(options: any): Promise<any> {
    const context = await super._prepareContext(options);
    const actor: any = this.document;
    const sys = actor.system;
    const ctl: any = actor.controller?.() ?? null;
    return {
      ...context, actor, system: sys,
      categories: RULES.VEHICLES.categories.map((c) => ({ key: c.id, label: c.label })),
      categorySkill: vehicleCategory(sys.category).skill,
      // v0.91.4: bought in the shop (cost, Availability, Street Index, legality).
      legalityChoices: RULES.GEAR_V58.legality.categories.map((c) => ({ key: c.id, label: c.label })),
      // v0.91.5: the Permit box, Get a permit… (paid by the character who bought it, or this user's own) and the warning.
      permit: permitRowFor(actor, vehiclePermitPayer(actor), `vehicle:${actor.uuid}`),
      priceLabel: Number(sys.cost ?? 0) > 0 ? itemPrice({ cost: Number(sys.cost ?? 0), streetIndex: Number(sys.streetIndex ?? 1) || 1, quantity: 1 }).toLocaleString() : "",
      boxes: Array.from({ length: RULES.VEHICLES.conditionBoxes }, (_, i) => ({ value: i + 1, filled: (sys.condition ?? 0) >= i + 1 })),
      controller: ctl ? { uuid: ctl.uuid, name: ctl.name } : null,
      modeLabel: modeLabel(sys.controlMode) ?? sys.controlMode,
      autopilotLabel: sys.drone ? tx('SR2E.App.Sheets.pilotRating', { rating: sys.derived?.autopilotRating ?? 0 }) : tx('SR2E.App.Sheets.autonavRating', { rating: sys.derived?.autopilotRating ?? 0 }),
      initiative: ctl && sys.controlMode === "jumped" && ctl.system.derived?.rigging?.jumpedIn
        ? `${ctl.system.derived.rigging.reaction} + ${ctl.system.derived.rigging.initiativeDice}d6 (${ctl.name})`
        : tx('SR2E.App.Sheets.initiativeAutopilot', { reaction: sys.derived?.reaction ?? 0, dice: sys.derived?.initiativeDice ?? 1 }),
      occupants: (sys.occupants ?? []).map((uuid: string, index: number) => ({ uuid, index, name: fromUuidSync(uuid)?.name ?? tx('SR2E.App.Sheets.gone') })),
      crashPower: crashDamage(Number(sys.currentSpeed ?? 0)).power,
      // v0.57.0: shot-out systems, the speed window this Combat Turn, a chase position.
      handlingNow: handlingFor(sys.derived?.working ?? sys, Boolean(sys.offroad)),
      systemsNotes: sys.derived?.working?.notes ?? [],
      speedWindow: actor.speedWindow?.() ?? { limited: false },
      pushTn: RULES.VEHICLES_V57.accel.pushTn,
      position: (() => {
        const p = sys.position;
        if (!p?.winnerUuid || !(p.tn > 0)) return "";
        const combat: any = game.combat;
        if (!combat?.started || Number(combat.round ?? 0) !== p.round) return "";
        const other = fromUuidSync(p.winnerUuid === actor.uuid ? p.loserUuid : p.winnerUuid)?.name ?? "?";
        return p.winnerUuid === actor.uuid ? tx('SR2E.App.Sheets.maneuverPositionOn', { other, tn: p.tn }) : tx('SR2E.App.Sheets.outManeuveredBy', { other, tn: p.tn });
      })(),
      weapons: [...actor.items].filter((i: any) => i.type === "weapon").map((i: any) => ({
        id: i.id, name: i.name, damageLabel: damageLabel(i.system), mount: i.system.mount ?? "none",
        mountLabel: i.system.mount && i.system.mount !== "none" ? tx('SR2E.App.Sheets.mountLabel', { mount: cap(i.system.mount) }) : tx('SR2E.App.Sheets.notMountedLower'),
        ammo: i.system.ammoMax > 0 ? `${i.system.ammo}/${i.system.ammoMax}` : "", av: Boolean(i.system.antiVehicle),
        // v0.73.0 (O28): the mount point it takes.
        point: (() => { const p = mountPointFor({ name: i.name, mount: i.system.mount ?? "none", mountPoint: i.system.mountPoint, antiVehicle: i.system.antiVehicle, guidance: i.system.guidance } as any); return p === "none" ? "" : p === "hard" ? tx('SR2E.App.Sheets.hardpointLower') : tx('SR2E.App.Sheets.firmpointLower'); })(),
      })),
      locks: (sys.locks ?? []).map((l: any) => ({ ...l })),
      // v0.73.0 (O28): link encryption, interception and spoofing; mount points.
      linkEnabled: RULES.DRONES_V73.link.enabled,
      droneLink: (() => { const l = droneLinkOf(sys); return { encryption: l.encryption, intercepted: l.intercepted.by, spoofed: l.spoofed.active ? l.spoofed.by || tx('SR2E.App.Sheets.someone') : "" }; })(),
      mountsTracked: RULES.DRONES_V73.mounts.mode !== "off",
      mountUsage: sys.derived?.mountUsage ?? null,
      ramLabel: (() => { const r = ramDamage({ body: sys.body ?? 0, currentSpeed: Number(sys.currentSpeed ?? 0), speed: Number(sys.speed ?? 0) }); return `${r.power}${r.level}`; })(),
      chase: sys.chase?.quarryUuid ? { quarryUuid: sys.chase.quarryUuid, quarryName: fromUuidSync(sys.chase.quarryUuid)?.name ?? tx('SR2E.App.Sheets.gone'), metres: sys.chase.metres } : null,
      pursuers: allActors().filter((a: any) => a.type === "vehicle" && a.system.chase?.quarryUuid === actor.uuid).map((a: any) => ({ uuid: a.uuid, name: a.name, metres: a.system.chase.metres })),
      // v0.46.0
      cargo: sys.derived?.cargo ?? { tracked: false },
      personKg: RULES.VEHICLES.cargo.personKg, overloadTn: RULES.VEHICLES.cargo.overloadTn,
      cargoItems: [...actor.items].filter((i: any) => i.type !== "weapon" || !i.system.mount || i.system.mount === "none").map((i: any) => ({ id: i.id, name: i.name, weight: Number(i.system.weight ?? 0), quantity: i.system.quantity ?? 0, cf: Number(i.system.cf ?? 0) })),
      personCf: RULES.VEHICLES.cargo.personCf,
      autosofts: RULES.VEHICLES.autosofts.kinds.map((k) => ({ key: k, label: cap(k), value: sys.autosofts?.[k] ?? 0 })),
      capAtPilot: RULES.VEHICLES.autosofts.capAtPilot,
      sensorModes: [{ key: "active", label: tx('SR2E.App.Sheets.active') }, { key: "passive", label: tx('SR2E.App.Sheets.passive') }],
      passiveTn: RULES.VEHICLES.sensorModes.passiveTn,
      mods: (sys.mods ?? []).map((m: any, index: number) => {
        const fx = modificationEffect(m.kind, m.rating, Number(sys.body ?? 0));
        const delta = m.installed ? m.delta : fx.delta;
        return { ...m, index, name: m.name || fx.label, label: modificationDef(m.kind)?.label ?? m.kind, costLabel: (m.cost > 0 ? m.cost : fx.cost).toLocaleString(),
          effect: (m.installed ? m.stat : fx.stat) ? `${cap(m.installed ? m.stat : fx.stat)} ${delta >= 0 ? "+" : ""}${delta}` : "" };
      }),
      remoteLink: (() => {
        if (!ctl || sys.controlMode !== "jumped" || actor.isAboard?.(ctl)) return null;
        const l = ctl.remoteLink?.(actor);
        if (!l) return null;
        return { rigger: ctl.name, note: l.check.checked ? l.check.note : tx('SR2E.App.Sheets.signalReachesKm', { signal: l.signal, km: l.check.rangeKm }), bad: l.check.checked && (!l.check.inRange || l.check.far) };
      })(),
    };
  }

  /** v0.57.0: push the vehicle past its Acceleration (a driving test). */
  static async #onPushSpeed(this: SR2VehicleSheet) {
    const v: any = this.document;
    // v0.81.1 (S2-7): the test spends the driver's action, so only the driver's owner (or the GM) may push, as for Ram.
    const ctl: any = v.controller?.() ?? null;
    if (ctl && !ctl.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlySOwnerOrTheGm', { ctlName: escHtml(ctl.name) }));
    const win = v.speedWindow();
    const to = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.push2', { name: v.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.speedWanted')}</label><input name="to" type="number" value="${escHtml(win.max + Number(v.system.accel ?? 0))}" min="0" autofocus></div>
        ${game.user?.isGM ? `<label class="sr2e-check"><input type="checkbox" name="outright"> ${tx('SR2E.Dialog.Sheet.gmSetItOutrightNoTest')}</label>` : ""}
        <p class="hint">${tx('SR2E.Dialog.Sheet.thisCombatTurnItMayGo', { winMin: escHtml(win.min), winMax: escHtml(win.max), accelPushTn: RULES.VEHICLES_V57.accel.pushTn, value: Number(v.system.accel ?? 0) * RULES.VEHICLES_V57.accel.perSuccess })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.push'), callback: (_e: Event, b: any) => ({ to: Math.max(0, Math.floor(Number(b.form.elements.to.value) || 0)), outright: Boolean(b.form.elements.outright?.checked) }) },
      rejectClose: false,
    }) as any;
    if (!to) return;
    if (to.outright) return void (await v.update({ "system.currentSpeed": to.to }, { sr2eSpeedOk: true }));
    // v0.71.0 (R14): pushing the speed is a driving test: it takes the driver's action like any other.
    if (ctl && !(await ctl.useAction("drive", tx('SR2E.Card.Sheet.pushingTheSpeed')))) return;
    await v.pushSpeed(Number(to.to));
  }

  static async #onCrashTest(this: SR2VehicleSheet) {
    await (this.document as any).crashTestFor({ why: tx('SR2E.App.Sheets.crashTest') });
  }

  /** v0.57.0: design the vehicle from a chassis, a powerplant and design points. */
  static async #onDesign(this: SR2VehicleSheet) {
    const v: any = this.document;
    const d = RULES.VEHICLES_V57.design;
    const costs = Object.entries(d.pointCosts);
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.design2', { name: v.name }) },
      position: { width: 480 },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.chassis')}</label><select name="chassis">${d.chassis.map((c) => `<option value="${escHtml(c.id)}">${tx('SR2E.Dialog.Sheet.points2', { label: escHtml(c.label), points: c.points, cost: c.cost.toLocaleString() })}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.powerplant')}</label><select name="powerplant">${d.powerplants.map((p) => `<option value="${escHtml(p.id)}">${tx('SR2E.Dialog.Sheet.speedAccel', { label: escHtml(p.label), speed: p.speed, accel: p.accel, cost: p.cost.toLocaleString() })}</option>`).join("")}</select></div>
        <p>${tx('SR2E.Dialog.Sheet.designPointsBought')}</p>
        ${costs.map(([k, c]) => `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.forPt', { part: escHtml(k === "cf" ? tx('SR2E.Dialog.Sheet.cargoFactor') : cap(k)), sign: c.step > 0 ? "+" : "", step: c.step, points: c.points, nuyen: c.nuyen.toLocaleString() })}</label><input name="sp_${escHtml(k)}" type="number" value="0" min="0"></div>`).join("")}
        <div class="sr2e-preview" aria-live="polite"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.theRowsAreExamplesNotBook')}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.apply'), callback: (_e: Event, b: any) => {
        const el = b.form.elements;
        return { chassis: String(el.chassis.value), powerplant: String(el.powerplant.value), spend: Object.fromEntries(costs.map(([k]) => [k, Math.max(0, Math.floor(Number(el[`sp_${k}`]?.value) || 0))])) };
      } },
      render: (_e: Event, dialog: any) => livePreview(dialog, (f) => {
        const el: any = f.elements;
        const x = designVehicle({ chassis: String(el.chassis.value), powerplant: String(el.powerplant.value), spend: Object.fromEntries(costs.map(([k]) => [k, Math.max(0, Math.floor(Number(el[`sp_${k}`]?.value) || 0))])) });
        if (!x) return "";
        const st = x.stats;
        return `<p>${tx('SR2E.Dialog.Sheet.bodyHandlingSpeedAccelArmorSignature', { stBody: st.body, stHandling: st.handling, stSpeed: st.speed, stAccel: st.accel, stArmor: st.armor, stSignature: st.signature, stCf: st.cf, part: st.mounts ? tx('SR2E.Dialog.Sheet.mountS', { stMounts: st.mounts }) : "" })}</p><p>${tx('SR2E.Dialog.Sheet.points3', { pointsSpent: x.points.spent, pointsTotal: x.points.total })} <strong>${x.cost.toLocaleString()}¥</strong>${x.warnings.length ? ` <span class="sr2e-warn">${x.warnings.map(escHtml).join("; ")}</span>` : ""}</p>`;
      }),
      rejectClose: false,
    } as any) as any;
    if (!r) return;
    await v.applyDesign(r);
  }

  static async #modDialog(vehicle: any, index: number | null) {
    const list = [...(vehicle.system.mods ?? [])].map((m: any) => ({ ...m }));
    const m = index === null ? { id: foundry.utils.randomID(), name: "", kind: "armor", rating: 1, cost: 0, installed: false, stat: "", delta: 0 } : list[index];
    if (!m) return;
    if (m.installed) return ui.notifications.warn(tx('SR2E.Notify.Sheet.takeItOutBeforeChangingIt'));
    const body = Number(vehicle.system.body ?? 0);
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.modification', { part: index === null ? tx('SR2E.Dialog.Sheet.add') : tx('SR2E.Dialog.Sheet.edit2'), vehicleName: vehicle.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.kind')}</label><select name="kind" autofocus>${RULES.VEHICLES.modifications.map((d) => `<option value="${escHtml(d.id)}" ${d.id === m.kind ? "selected" : ""}>${escHtml(d.label)}${d.stat ? tx('SR2E.Dialog.Sheet.rating8', { stat: escHtml(cap(d.stat)), sign: d.perRating >= 0 ? "+" : "", perRating: d.perRating }) : ""}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.name')}</label><input name="name" type="text" value="${escHtml(m.name ?? "")}" placeholder="${tx('SR2E.Dialog.Sheet.theKind')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.rating2')}</label><input name="rating" type="number" value="${escHtml(m.rating)}" min="1"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.cost0TheTableS')}</label><input name="cost" type="number" value="${escHtml(m.cost)}" min="0"></div>
        <p class="hint sr2e-plan"></p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.save'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { kind: String(el.kind.value), name: String(el.name.value ?? "").trim(), rating: Math.max(1, Math.floor(Number(el.rating.value) || 1)), cost: Math.max(0, Math.floor(Number(el.cost.value) || 0)) }; } },
      render: (_e: Event, dialog: any) => {
        const form = dialog?.element?.querySelector("form");
        const show = () => { const el = form?.elements; if (!el) return; const fx = modificationEffect(String(el.kind.value), Number(el.rating.value) || 1, body); const t = form.querySelector(".sr2e-plan"); if (t) t.textContent = tx('SR2E.Dialog.Sheet.tableCost', { part: fx.stat ? `${cap(fx.stat)} ${fx.delta >= 0 ? "+" : ""}${fx.delta}` : tx('SR2E.Dialog.Sheet.noStatChange'), fxCost: fx.cost.toLocaleString() }); };
        form?.addEventListener("change", show); form?.addEventListener("input", show); show();
      },
      rejectClose: false,
    });
    if (!r) return;
    Object.assign(m, r);
    if (index === null) list.push(m);
    await vehicle.update({ "system.mods": list });
  }

  static async #onAddMod(this: SR2VehicleSheet) { await SR2VehicleSheet.#modDialog(this.document, null); }
  static async #onEditMod(this: SR2VehicleSheet, _e: Event, t: HTMLElement) { await SR2VehicleSheet.#modDialog(this.document, Number(t.dataset["index"])); }
  static async #onDeleteMod(this: SR2VehicleSheet, _e: Event, t: HTMLElement) {
    const vehicle: any = this.document;
    const list = [...(vehicle.system.mods ?? [])];
    const m = list[Number(t.dataset["index"])];
    if (m?.installed) return ui.notifications.warn(tx('SR2E.Notify.Sheet.takeItOutFirst'));
    if (!spliceRow(list, t)) return;
    await vehicle.update({ "system.mods": list });
  }
  /** Install a modification: a mechanic's test (v0.49.0), or straight in (GM, or when the test isn't required). */
  static async #onInstallMod(this: SR2VehicleSheet, _e: Event, t: HTMLElement) {
    const vehicle: any = this.document;
    const index = Number(t.dataset["index"]);
    const mod = (vehicle.system.mods ?? [])[index];
    if (!mod) return;
    const people = allActors().filter((a: any) => a.isOwner && ["character", "npc"].includes(a.type));
    const plan = modInstallPlan(mod.rating);
    const vr = RULES.SKILLS.vehicleRepair;
    const skillOf = (a: any) => vr.skills.map((n) => a.findSkill?.(n)).find((x: any) => x && (x.system?.rating ?? 0) > 0);
    const direct = !RULES.VEHICLES.install.required || game.user?.isGM;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.install2', { modName: mod.name || modificationDef(mod.kind)?.label, vehicleName: vehicle.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.mechanic')}</label><select name="mechanic" autofocus>${people.map((a: any) => { const s = skillOf(a); return `<option value="${escHtml(a.uuid)}">${escHtml(a.name)} (${s ? `${escHtml(s.name)} ${escHtml(s.system.rating)}` : tx('SR2E.Dialog.Sheet.noBRSkill')})</option>`; }).join("")}${direct ? `<option value="none">${tx('SR2E.Dialog.Sheet.noTestPutItStraightIn')}</option>` : ""}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.whoPays')}</label><select name="payer">${people.map((a: any) => `<option value="${escHtml(a.uuid)}">${escHtml(a.name)} (${Number(a.system.nuyen ?? 0).toLocaleString()}¥)</option>`).join("")}<option value="none">${tx('SR2E.Dialog.Sheet.nobodyFree')}</option></select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.elseIntelligenceVsTnHoursSuccesses', { vrSkills: escHtml(vr.skills.join(", ")), attributeDefaultTnMod: RULES.ATTRIBUTE_DEFAULT_TN_MOD, planTn: plan.tn, planBaseHours: plan.baseHours })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.install'), callback: (_e2: Event, b: any) => ({ mechanic: String(b.form.elements.mechanic.value), payer: String(b.form.elements.payer.value), mod: Number(b.form.elements.mod.value) || 0 }) },
      rejectClose: false,
    }) as { mechanic: string; payer: string; mod: number } | null;
    if (!choice) return;
    const payer = choice.payer !== "none" ? fromUuidSync(choice.payer) : null;
    if (choice.mechanic === "none") return void (await vehicle.installMod(index, { payer }));
    const mech: any = fromUuidSync(choice.mechanic);
    await mech?.installModTest(vehicle, index, { payer, modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [] });
  }
  static async #onRemoveMod(this: SR2VehicleSheet, _e: Event, t: HTMLElement) {
    await (this.document as any).installMod(Number(t.dataset["index"]), { remove: true });
  }
  static async #onJam(this: SR2VehicleSheet) {
    await jamDialog(this.document);
  }
  static async #onUnjam(this: SR2VehicleSheet) {
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Sheet.theGmClearsAJam'));
    await (this.document as any).unjam();
  }

  /** v0.73.0 (O28): the rigger has the link back (GM). */
  static async #onClearDroneLink(this: SR2VehicleSheet) {
    if (!game.user?.isGM) return ui.notifications.warn(tx('SR2E.Notify.Sheet.theGmClearsAnInterceptedOr'));
    await (this.document as any).clearDroneLink();
  }

  static #onEditItem(this: SR2VehicleSheet, _event: Event, target: HTMLElement) {
    (this.document as any).items.get(target.dataset["itemId"])?.sheet.render(true);
  }

  static async #onDeleteItem(this: SR2VehicleSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).items.get(target.dataset["itemId"])?.delete();
  }

  static async #onFire(this: SR2VehicleSheet, _event: Event, el: HTMLElement) {
    const vehicle: any = this.document;
    const weapon: any = vehicle.items.get(el.dataset["itemId"]);
    if (weapon) await mountedFireDialog(vehicle, weapon);
  }

  static async #onRam(this: SR2VehicleSheet) {
    const vehicle: any = this.document;
    const ctl: any = vehicle.controller?.() ?? null;
    if (ctl && !ctl.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlySOwnerOrTheGm', { ctlName: escHtml(ctl.name) }));
    const { options } = attackTargetOptions(vehicle, attackerToken(vehicle), game.user.targets?.first?.() ?? null);
    const jumped = ctl && vehicle.system.controlMode === "jumped";
    const left = jumped ? ctl.system.derived?.controlPoolLeft ?? 0 : 0;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.ram2', { vehicleName: vehicle.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.target')}</label><select name="target">${options}</select></div>
        ${jumped ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.controlPoolDiceLeft', { left: escHtml(left) })}</label><input name="pool" type="number" value="0" min="0" max="${escHtml(left)}"></div>` : ""}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.aDrivingTestVsHandlingOn', { vehicleName: escHtml(vehicle.name), ramSpeedPerPower: RULES.VEHICLES.ram.speedPerPower })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.ram'), callback: (_e: Event, b: any) => ({ target: String(b.form.elements.target.value ?? ""), pool: Math.max(0, Math.min(left, Math.floor(Number(b.form.elements.pool?.value) || 0))), mod: Number(b.form.elements.mod.value) || 0 }) },
      rejectClose: false,
    });
    if (!choice) return;
    if (!choice.target) return ui.notifications.warn(tx('SR2E.Notify.Sheet.pickSomethingToRam'));
    if (ctl && !(await ctl.useAction("drive", tx('SR2E.Card.Sheet.ramming')))) return;
    await vehicle.ram(choice.target, { poolDice: choice.pool, modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [] });
  }

  static async #onSensor(this: SR2VehicleSheet) {
    const vehicle: any = this.document;
    const ctl: any = vehicle.controller?.() ?? null;
    const jumped = ctl && vehicle.system.controlMode === "jumped" && RULES.VEHICLES.sensors.controlPool;
    const left = jumped ? ctl.system.derived?.controlPoolLeft ?? 0 : 0;
    const { options } = attackTargetOptions(vehicle, attackerToken(vehicle), game.user.targets?.first?.() ?? null);
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.sensorTest', { vehicleName: vehicle.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.target')}</label><select name="target">${options}</select></div>
        ${jumped ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.controlPoolDiceLeft', { left: escHtml(left) })}</label><input name="pool" type="number" value="0" min="0" max="${escHtml(left)}"></div>` : ""}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        ${sensorTableRows().map((r) => `<label class="sr2e-check"><input type="checkbox" name="sensorRow" value="${escHtml(r.id)}"> ${escHtml(r.label)} (${r.value >= 0 ? "+" : ""}${r.value})</label>`).join("")}
        ${sensorTableRows().length ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.concealedByASpiritItsForce')}</label><input name="spiritForce" type="number" value="0" min="0"></div>` : ""}
        <div class="sr2e-preview" aria-live="polite"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.sensorVsTheTargetSSignature', { vehicleSensor: escHtml(vehicle.system.sensor), sensorsPersonSignature: RULES.VEHICLES.sensors.personSignature, vehicleEccm: escHtml(vehicle.system.eccm) })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.scan'), callback: (_e: Event, b: any) => ({ target: String(b.form.elements.target.value ?? ""), pool: Math.max(0, Math.min(left, Math.floor(Number(b.form.elements.pool?.value) || 0))), mod: Number(b.form.elements.mod.value) || 0, exclude: excludedOf(b.form), table: sensorRowsOf(b.form) }) },
      render: (_e: Event, dialog: any) => livePreview(dialog, (f, excluded) => {
        const who: any = (f.elements as any).target?.value ? fromUuidSync((f.elements as any).target.value) : null;
        if (!who) return "";
        const sit = vehicle.sensorSituation(who);
        const mod = Number((f.elements as any).mod?.value) || 0;
        return tnPreviewHtml({ auto: sit.modifiers, manual: [...(mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : []), ...sensorRowsOf(f)], excluded, ...(sit.blind ? { warn: tx('SR2E.Dialog.Sheet.theSensorsCanTPickThem', { sitWhy: sit.why }) } : {}) });
      }),
      rejectClose: false,
    } as any) as { target: string; pool: number; mod: number; exclude: string[]; table: TargetNumberModifier[] } | null;
    if (!choice) return;
    if (!choice.target) return ui.notifications.warn(tx('SR2E.Notify.Sheet.pickATargetToScan'));
    await vehicle.sensorTest(choice.target, { poolDice: choice.pool, exclude: choice.exclude, modifiers: [...(choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : []), ...choice.table] });
  }

  static async #onClearLock(this: SR2VehicleSheet, _event: Event, target: HTMLElement) {
    await (this.document as any).clearLocks(target.dataset["uuid"] || null);
  }

  static async #onStartChase(this: SR2VehicleSheet) {
    const vehicle: any = this.document;
    const others = allActors().filter((a: any) => a.type === "vehicle" && a.uuid !== vehicle.uuid);
    // v0.50.0: the targeted vehicle first (an unlinked token's own actor too).
    const tv: any = game.user.targets?.first?.()?.actor ?? null;
    if (tv?.type === "vehicle" && tv.uuid !== vehicle.uuid) { const i = others.findIndex((o: any) => o.uuid === tv.uuid); if (i >= 0) others.splice(i, 1); others.unshift(tv); }
    if (!others.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereIsNoOtherVehicleTo'));
    const me = tokenOf(vehicle);
    const gapFor = (a: any) => { const t = tokenOf(a); const m = me && t ? measureTokens(me, t) : null; return m ? Math.round(m.metres) : 50; };
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.giveChase', { vehicleName: vehicle.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.quarry')}</label><select name="quarry">${others.map((o: any) => `<option value="${escHtml(o.uuid)}" data-gap="${gapFor(o)}">${escHtml(o.name)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.gapM')}</label><input name="gap" type="number" value="${gapFor(others[0])}" min="0"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.measuredBetweenTheTwoTokensWhen')}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.chase'), callback: (_e: Event, b: any) => ({ quarry: String(b.form.elements.quarry.value), gap: Math.max(0, Number(b.form.elements.gap.value) || 0) }) },
      render: (_e: Event, dialog: any) => {
        const form = dialog?.element?.querySelector("form");
        const sel = form?.querySelector('select[name="quarry"]');
        sel?.addEventListener("change", () => { form.querySelector('input[name="gap"]').value = sel.selectedOptions[0]?.dataset?.gap ?? "50"; });
      },
      rejectClose: false,
    });
    const quarry: any = choice ? fromUuidSync(choice.quarry) : null;
    if (quarry) await vehicle.startChase(quarry, choice.gap);
  }

  static async #onChaseTurn(this: SR2VehicleSheet) {
    const vehicle: any = this.document;
    const quarry: any = vehicle.system.chase?.quarryUuid ? fromUuidSync(vehicle.system.chase.quarryUuid) : null;
    if (quarry && !quarry.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Sheet.theGmRunsChaseTurnsYou', { quarryName: escHtml(quarry.name) }));
    await vehicle.chaseTurn();
  }

  static async #onEndChase(this: SR2VehicleSheet) {
    await (this.document as any).endChase();
  }

  static async #onSetCondition(this: SR2VehicleSheet, _event: Event, target: HTMLElement) {
    const value = Number(target.dataset["value"]);
    if (!Number.isFinite(value)) return;
    const actor: any = this.document;
    const current = actor.system.condition ?? 0;
    await actor.update({ "system.condition": current === value ? value - 1 : value });
  }

  static async #onSetDriver(this: SR2VehicleSheet) {
    const vehicle: any = this.document;
    const people = allActors().filter((a: any) => ["character", "npc"].includes(a.type) && a.isOwner);
    if (!people.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereIsNoCharacterYouCan'));
    const current = vehicle.system.controllerUuid;
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.driver2', { vehicleName: vehicle.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.driver')}</label><select name="driver">${people.map((p: any) => `<option value="${escHtml(p.uuid)}" ${p.uuid === current ? "selected" : ""}>${escHtml(p.name)}${(p.system.derived?.rigging?.vcr ?? 0) > 0 ? tx('SR2E.Dialog.Sheet.controlRig', { riggingVcr: escHtml(p.system.derived.rigging.vcr) }) : ""}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.how')}</label><select name="mode"><option value="manual">${tx('SR2E.Dialog.Sheet.byHand')}</option><option value="jumped" ${vehicle.system.controlMode === "jumped" ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.jumpedInControlRig')}</option></select></div>`,
      ok: { label: tx('SR2E.Dialog.Sheet.set'), callback: (_e: Event, b: any) => ({ driver: String(b.form.elements.driver.value), mode: String(b.form.elements.mode.value) }) },
      rejectClose: false,
    });
    if (!choice) return;
    const driver: any = fromUuidSync(choice.driver);
    if (driver) await vehicle.setController(driver, choice.mode);
  }

  static async #onAutopilot(this: SR2VehicleSheet) {
    await (this.document as any).setController(null);
  }

  static async #onDrive(this: SR2VehicleSheet) {
    const vehicle: any = this.document;
    const ctl: any = vehicle.controller?.() ?? null;
    if (ctl && !ctl.isOwner) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlySOwnerOrTheGm2', { ctlName: escHtml(ctl.name) }));
    const opts = await driveDialog(ctl, vehicle);
    if (!opts) return;
    if (ctl && !(await ctl.useAction("drive", tx('SR2E.Card.Sheet.aDrivingTest')))) return;
    await vehicle.driveTest(opts);
  }

  static async #onCrash(this: SR2VehicleSheet) {
    const vehicle: any = this.document;
    const speed = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.crash2', { vehicleName: vehicle.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.speedAtImpact')}</label><input name="speed" type="number" value="${escHtml(vehicle.system.currentSpeed)}" min="0" autofocus></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.powerSpeedAtLeastTheVehicle', { crashSpeedPerPower: RULES.VEHICLES.crash.speedPerPower, crashMinPower: RULES.VEHICLES.crash.minPower, crashVehicleLevel: RULES.VEHICLES.crash.vehicleLevel, crashPassengerLevel: RULES.VEHICLES.crash.passengerLevel })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.crash'), callback: (_e: Event, b: any) => Math.max(0, Number(b.form.elements.speed.value) || 0) },
      rejectClose: false,
    });
    if (typeof speed === "number") await vehicle.crash(speed);
  }

  static async #onRepair(this: SR2VehicleSheet) {
    await (this.document as any).repairVehicle();
  }

  /** A Build/Repair test by a character the user owns (v0.38.0). */
  static async #onRepairTest(this: SR2VehicleSheet) {
    const vehicle: any = this.document;
    const people = allActors().filter((a: any) => a.isOwner && ["character", "npc"].includes(a.type));
    if (!people.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.youOwnNoCharacterToDo'));
    // v0.71.0 review (F9): the tools at hand (a garage borrowed for the job), else the mechanic's own.
    const fx = RULES.FIXES_V71.vehicleRepair;
    const levels = RULES.CHARACTERS_V58.tools.levels;
    const toolRow = fx.enabled ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.toolsAtHand')}</label><select name="tools"><option value="">${tx('SR2E.Dialog.Sheet.theMechanicSOwn')}</option>${levels.map((l: any) => `<option value="${escHtml(l.id)}">${escHtml(l.label)}</option>`).join("")}</select></div>` : "";
    const got = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.repair3', { vehicleName: vehicle.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.mechanic')}</label><select name="who">${people.map((a: any) => `<option value="${escHtml(a.uuid)}">${escHtml(a.name)}</option>`).join("")}</select></div>${toolRow}
        <p class="hint">${tx('SR2E.Dialog.Sheet.theFirstTheyHaveElseIntelligence', { vehicleRepairSkills: escHtml(RULES.SKILLS.vehicleRepair.skills.join(", ")), attributeDefaultTnMod: RULES.ATTRIBUTE_DEFAULT_TN_MOD, vehicleRepairTn: RULES.SKILLS.vehicleRepair.tn, part: fx.enabled ? (fx.partsFirst ? tx('SR2E.Dialog.Sheet.needsALessPartsFirst', { fxNeeds: escHtml(fx.needs), vehicleRepairBoxesPerSuccess: RULES.SKILLS.vehicleRepair.boxesPerSuccess, part: fx.destroyed === "rebuild" ? tx('SR2E.Dialog.Sheet.aDestroyedVehicleIsRebuiltWhole') : "" }) : tx('SR2E.Dialog.Sheet.needsALessAddsToThe', { fxNeeds: escHtml(fx.needs), vehicleRepairBoxesPerSuccess: RULES.SKILLS.vehicleRepair.boxesPerSuccess, part: fx.destroyed === "rebuild" ? tx('SR2E.Dialog.Sheet.aDestroyedVehicleIsRebuiltWhole') : "" })) : tx('SR2E.Dialog.Sheet.eachSuccessRepairsBox', { vehicleRepairBoxesPerSuccess: RULES.SKILLS.vehicleRepair.boxesPerSuccess }) })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.repair'), callback: (_e: Event, b: any) => ({ who: String(b.form.elements.who.value), tools: String(b.form.elements.tools?.value ?? "") }) },
      rejectClose: false,
    }) as { who: string; tools: string } | null;
    const who: any = got?.who ? await fromUuid(got.who) : null;
    if (who) await who.repairVehicleTest(vehicle, got?.tools ? { tools: got.tools } : {});
  }

  static async #onAddOccupant(this: SR2VehicleSheet) {
    const vehicle: any = this.document;
    const aboard = new Set(vehicle.system.occupants ?? []);
    const people = allActors().filter((a: any) => ["character", "npc", "spirit"].includes(a.type) && !aboard.has(a.uuid));
    if (!people.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.nobodyElseToPutAboard'));
    const uuid = await pickOne(tx('SR2E.Dialog.Sheet.aboard', { vehicleName: vehicle.name }), people.map((p: any) => ({ value: p.uuid, label: p.name })));
    if (uuid) await vehicle.update({ "system.occupants": [...(vehicle.system.occupants ?? []), uuid] });
  }

  static async #onRemoveOccupant(this: SR2VehicleSheet, _event: Event, target: HTMLElement) {
    const vehicle: any = this.document;
    const list = [...(vehicle.system.occupants ?? [])];
    if (!spliceRow(list, target)) return;
    await vehicle.update({ "system.occupants": list });
  }

  static #onOpenActor(this: SR2VehicleSheet, _event: Event, target: HTMLElement) {
    const uuid = target.dataset["uuid"];
    if (uuid) fromUuidSync(uuid)?.sheet?.render(true);
  }
}

/** v0.73.0 (O28): intercept a drone's link, or spoof it a command (RULES.DRONES_V73.link). */
export async function droneLinkDialog(actor: any): Promise<void> {
  const L = RULES.DRONES_V73.link;
  if (!L.enabled) return ui.notifications.warn(tx('SR2E.Notify.Sheet.interceptingAndSpoofingDroneLinksIs'));
  const drones = allActors().filter((a: any) => a.type === "vehicle" && a.uuid !== actor.uuid);
  if (!drones.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereIsNoDroneOrVehicle'));
  const targeted = game.user.targets?.first?.()?.actor?.uuid ?? "";
  const state = (d: any) => {
    const l = droneLinkOf(d.system);
    return l.spoofed.active ? tx('SR2E.App.Sheets.spoofedNote') : l.intercepted.byUuid === actor.uuid ? tx('SR2E.App.Sheets.interceptedNote') : "";
  };
  const choice = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Sheet.droneLink', { actorName: actor.name }) },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.drone2')}</label><select name="target" autofocus>${drones.map((d: any) => `<option value="${escHtml(d.uuid)}" ${d.uuid === targeted ? "selected" : ""}>${escHtml(d.name)}${state(d)}</option>`).join("")}</select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.do')}</label><select name="kind"><option value="intercept">${tx('SR2E.Dialog.Sheet.interceptTheLink')}</option><option value="spoof">${tx('SR2E.Dialog.Sheet.spoofACommand')}</option></select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.commandSpoof')}</label><input name="command" type="text" placeholder="${tx('SR2E.Dialog.Sheet.eGLandTurnBackHold')}"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
      <p class="hint">${L.intercept.tnFrom === "signal" ? tx('SR2E.Dialog.Sheet.orAt4InterceptAgainstTheSignal', { skill: escHtml(L.skill), attribute: escHtml(L.attribute), part2: L.spoof.needsIntercept ? tx('SR2E.Dialog.Sheet.anInterceptedLinkOnly') : "", part3: L.spoof.eccmAddsTn ? tx('SR2E.Dialog.Sheet.eccm') : "", part4: L.spoof.effect === "takeover" ? tx('SR2E.Dialog.Sheet.itIsTakenOverUntilThe') : tx('SR2E.Dialog.Sheet.itCarriesOutTheOneCommand'), part5: L.spoof.jumpedIn === "immune" ? tx('SR2E.Dialog.Sheet.aDroneWhoseRiggerIsJumped') : "" }) : tx('SR2E.Dialog.Sheet.orAt4InterceptAgainstThe', { skill: escHtml(L.skill), attribute: escHtml(L.attribute), part2: L.spoof.needsIntercept ? tx('SR2E.Dialog.Sheet.anInterceptedLinkOnly') : "", part3: L.spoof.eccmAddsTn ? tx('SR2E.Dialog.Sheet.eccm') : "", part4: L.spoof.effect === "takeover" ? tx('SR2E.Dialog.Sheet.itIsTakenOverUntilThe') : tx('SR2E.Dialog.Sheet.itCarriesOutTheOneCommand'), part5: L.spoof.jumpedIn === "immune" ? tx('SR2E.Dialog.Sheet.aDroneWhoseRiggerIsJumped') : "" })}</p>`,
    ok: { label: tx('SR2E.Dialog.Sheet.roll'), callback: (_e: Event, b: any) => ({ target: String(b.form.elements.target.value), kind: String(b.form.elements.kind.value), command: String(b.form.elements.command.value ?? ""), mod: Number(b.form.elements.mod.value) || 0 }) },
    rejectClose: false,
  });
  if (!choice) return;
  const modifiers = choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [];
  if (choice.kind === "spoof") await actor.spoofDroneLink(choice.target, { command: choice.command, modifiers });
  else await actor.interceptDroneLink(choice.target, { modifiers });
}

/** v0.46.0: jam a drone's remote link with a jammer (a vehicle's ECM, or a character's jammer gear). */
export async function jamDialog(jammer: any): Promise<void> {
  const rating = Number(jammer.jammerRating?.() ?? 0);
  if (!(rating > 0)) return ui.notifications.warn(tx('SR2E.Notify.Sheet.hasNoJammer', { jammerName: escHtml(jammer.name) }));
  const drones = allActors().filter((a: any) => a.type === "vehicle" && a.uuid !== jammer.uuid);
  // v0.49.0: deckers on a wireless connection (scene tokens first, then world actors).
  const seen = new Set<string>();
  const deckers = [...[...(canvas?.tokens?.placeables ?? [])].map((t: any) => t.actor), ...allActors()]
    .filter((a: any) => a && ["character", "npc"].includes(a.type) && a.uuid !== jammer.uuid && a.activeDeck?.() && wirelessConnection(a.system.matrix?.connection ?? "jackpoint"))
    .filter((a: any) => (seen.has(a.uuid) ? false : (seen.add(a.uuid), true)));
  if (!drones.length && !deckers.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereIsNoVehicleDroneOr'));
  const targeted = game.user.targets?.first?.()?.actor?.uuid ?? "";
  const choice = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Sheet.jamRating', { jammerName: jammer.name, rating }) },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.jam')}</label><select name="target" autofocus>${drones.length ? `<optgroup label="${tx('SR2E.App.Sheets.dronesAndVehicles')}">${drones.map((d: any) => `<option value="${escHtml(d.uuid)}" ${d.uuid === targeted ? "selected" : ""}>${escHtml(d.name)}${d.system.jammed?.active ? tx('SR2E.Dialog.Sheet.jammed') : ""}</option>`).join("")}</optgroup>` : ""}${deckers.length ? `<optgroup label="${tx('SR2E.App.Sheets.deckersOnAWirelessLink')}">${deckers.map((d: any) => `<option value="${escHtml(d.uuid)}" ${d.uuid === targeted ? "selected" : ""}>${escHtml(d.name)} (${escHtml(d.system.matrix?.connection)})${d.system.matrix?.jammed?.active ? tx('SR2E.Dialog.Sheet.jammed') : ""}</option>`).join("")}</optgroup>` : ""}</select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
      <p class="hint">${tx('SR2E.Dialog.Sheet.jammerVsTheLinkSSignal', { rating, part: RULES.RIGGING.jamming.eccmAddsTn ? tx('SR2E.Dialog.Sheet.aDroneSEccm') : "", part2: RULES.RIGGING.jamming.onDecker === "dump" ? tx('SR2E.Dialog.Sheet.dumpedFromTheMatrix') : tx('SR2E.Dialog.Sheet.heldUnableToActInThe') })}</p>`,
    ok: { label: tx('SR2E.Dialog.Sheet.jam'), callback: (_e: Event, b: any) => ({ target: String(b.form.elements.target.value), mod: Number(b.form.elements.mod.value) || 0 }) },
    rejectClose: false,
  });
  if (!choice) return;
  await jammer.jamTest(choice.target, { modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [] });
}

/** Fire a mounted weapon: pick who fires (driver, gunner aboard, security rigger, autopilot), the target and range. */
async function mountedFireDialog(vehicle: any, weapon: any): Promise<void> {
    const w = weapon.system;
    const mount = String(w.mount ?? "none");
    if (mount === "none") return ui.notifications.warn(tx('SR2E.Notify.Sheet.isNotMountedSetItsMount', { weaponName: escHtml(weapon.name) }));
    const firers: Array<{ uuid: string; label: string; pool: string; left: number }> = [];
    const ctl: any = vehicle.controller?.() ?? null;
    if (ctl && ctl.isOwner && canFireMount(mount, "driver")) {
      const jumped = vehicle.system.controlMode === "jumped";
      firers.push({ uuid: ctl.uuid, label: jumped ? tx('SR2E.App.Sheets.firerDriverJumpedIn', { name: ctl.name }) : tx('SR2E.App.Sheets.firerDriver', { name: ctl.name }), pool: jumped ? tx('SR2E.App.Sheets.control') : tx('SR2E.App.Sheets.combat'), left: jumped ? ctl.system.derived?.controlPoolLeft ?? 0 : ctl.system.derived?.combatPoolLeft ?? 0 });
    }
    if (canFireMount(mount, "gunner")) {
      for (const u of vehicle.system.occupants ?? []) {
        const g: any = fromUuidSync(u);
        if (g && g.uuid !== ctl?.uuid && g.isOwner) firers.push({ uuid: g.uuid, label: tx('SR2E.App.Sheets.firerGunner', { name: g.name }), pool: tx('SR2E.App.Sheets.combat'), left: g.system.derived?.combatPoolLeft ?? 0 });
      }
    }
    const secSite: any = SR2Actor.securitySiteFor(vehicle);
    const secRigger: any = secSite?.securityRigger?.() ?? null;
    if (secRigger && secRigger.isOwner && canFireMount(mount, "security")) firers.push({ uuid: secRigger.uuid, label: tx('SR2E.App.Sheets.firerSecurityRigger', { name: secRigger.name, site: secSite.name }), pool: tx('SR2E.App.Sheets.control'), left: secRigger.system.derived?.controlPoolLeft ?? 0 });
    if (canFireMount(mount, "autopilot") && (vehicle.system.derived?.autopilotRating ?? 0) > 0) firers.push({ uuid: vehicle.uuid, label: vehicle.system.drone ? tx('SR2E.App.Sheets.firerAutopilotPilot', { rating: vehicle.system.derived.autopilotRating }) : tx('SR2E.App.Sheets.firerAutopilotAutonav', { rating: vehicle.system.derived.autopilotRating }), pool: "", left: 0 });
    if (!firers.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.nobodyCanFireMount', { weaponName: escHtml(weapon.name), mount: escHtml(mount), part: mount === "pintle" || mount === "ring" ? tx('SR2E.Notify.Sheet.putAGunnerAboard') : tx('SR2E.Notify.Sheet.putADriverAtTheControls') }));
    const fromToken = attackerToken(vehicle);
    const targeted: any = game.user.targets?.first?.() ?? null;
    const { options, tokens } = attackTargetOptions(vehicle, fromToken, targeted);
    const limits = weaponRange(w, 0);
    const bandFor = (uuid: string): { band: string; note: string; metres: number | null } => {
      const to = uuid ? tokens.get(uuid) ?? null : null;
      const m = fromToken && to ? measureTokens(fromToken, to) : null;
      const gap = m ? null : SR2Actor.chaseGap(vehicle, fromUuidSync(uuid));
      const metres = m?.metres ?? gap;
      if (metres == null) return { band: "short", note: uuid ? tx('SR2E.App.Sheets.notMeasuredPickTheRange') : "", metres: null };
      const c = checkWeaponDistance({ metres, melee: false, limits });
      return { band: (c as any).band ?? "extreme", note: gap != null ? tx('SR2E.App.Sheets.noteChaseGap', { note: c.note }) : c.note, metres };
    };
    const modes = parseFiringModes(w.modes);
    // v0.46.0: a fixed mount's arc, from the vehicle token's rotation.
    const arcNote = (uuid: string): string => {
      if (!w.arc || mount !== "fixed") return "";
      const c = (SR2Actor as any).arcCheck(vehicle, weapon, uuid || null);
      if (!c) return tx('SR2E.App.Sheets.firesArcOnly', { arc: w.arc });
      return c.inside ? tx('SR2E.App.Sheets.inTheArc', { arc: w.arc }) : tx('SR2E.App.Sheets.outsideTheArc', { arc: w.arc, offBy: c.offBy });
    };
    // v0.49.0: a turret's facing, traverse and limit.
    const turretNote = (uuid: string): string => {
      if (mount !== "turret") return "";
      const c = (SR2Actor as any).turretAim(vehicle, weapon, uuid || null);
      if (!c) return tx('SR2E.App.Sheets.turretFacing', { facing: Math.round(Number(w.turret?.facing ?? 0)) });
      return c.modifiers.length ? tx('SR2E.App.Sheets.turretNoteTn', { note: c.note, tn: c.modifiers[0].value }) : tx('SR2E.App.Sheets.turretNote', { note: c.note });
    };
    const first = bandFor(targeted?.actor?.uuid ?? "");
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.fire2', { weaponName: weapon.name, vehicleName: vehicle.name }) },
      position: { width: 460 },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.firedBy')}</label><select name="firer">${firers.map((f) => `<option value="${escHtml(f.uuid)}">${escHtml(f.label)}${f.pool ? tx('SR2E.Dialog.Sheet.pool', { pool: escHtml(f.pool), left: f.left }) : ""}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.target')}</label><select name="target">${options}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.range')}</label><select name="range">${RANGE_BANDS.map((b) => `<option value="${b}" ${b === first.band ? "selected" : ""}>${tx('SR2E.Dialog.Sheet.mTn', { b: escHtml(cap(b)), limits: limits[b], rangeTn: RULES.RANGE_TN[b] })}</option>`).join("")}</select></div>
        <p class="hint sr2e-range-note">${escHtml(first.note)}</p>
        ${modes.length > 1 ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.mode')}</label><select name="mode">${modes.map((m) => `<option value="${m}">${m}</option>`).join("")}</select></div>` : ""}
        ${modes.includes("FA" as FiringMode) ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.fullAutoRounds2')}</label><input name="fa" type="number" value="${RULES.FIRING.fullAutoMin}" min="${RULES.FIRING.fullAutoMin}" max="${RULES.FIRING.fullAutoMax}"></div>` : ""}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.poolDice')}</label><input name="pool" type="number" value="0" min="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        ${vehiclePartRow(vehicle.uuid)}
        ${segRows().length ? `<p class="hint">${tx('SR2E.Dialog.Sheet.withASensorLockSensorEnhanced')}</p>${segRows().filter((r) => r.value).map((r) => `<label class="sr2e-check"><input type="checkbox" name="segRow" value="${escHtml(r.id)}"> ${escHtml(r.label)} (${r.value >= 0 ? "+" : ""}${r.value})</label>`).join("")}` : ""}
        <div class="sr2e-preview" aria-live="polite"></div>
        ${w.arc && mount === "fixed" ? `<p class="hint sr2e-arc-note">${escHtml(arcNote(targeted?.actor?.uuid ?? ""))}</p><label class="sr2e-check"><input type="checkbox" name="ignoreArc"> ${tx('SR2E.Dialog.Sheet.fireOutsideTheArcAnyway', { arc: escHtml(w.arc) })}</label>` : ""}
        ${mount === "turret" ? `<p class="hint sr2e-turret-note">${escHtml(turretNote(targeted?.actor?.uuid ?? ""))}</p><label class="sr2e-check"><input type="checkbox" name="ignoreTurret"> ${tx('SR2E.Dialog.Sheet.firePastTheTurretSLimit')}</label>` : ""}
        <p class="hint">${tx('SR2E.Dialog.Sheet.theAutopilotItsRatingMovingVehicles', { skill: escHtml(w.skill || RULES.VEHICLES.gunnerySkill), part: RULES.DOCS_V79.vehMountRecoil.mode === "rigger2" ? (mount === "fixed" || mount === "turret" ? tx('SR2E.Dialog.Sheet.theMountHalvesRecoil') : mount === "pintle" || mount === "ring" ? tx('SR2E.Dialog.Sheet.theMountCompensatesRecoil', { part: mount === "ring" ? RULES.DOCS_V79.vehMountRecoil.ringComp : RULES.DOCS_V79.vehMountRecoil.pintleComp }) : "") : RULES.VEHICLES.mountedIgnoreRecoil && (mount === "fixed" || mount === "turret") ? tx('SR2E.Dialog.Sheet.theMountAbsorbsRecoil') : "" })}</p>`,
      ok: {
        label: tx('SR2E.Dialog.Sheet.fire'),
        callback: (_e: Event, b: any) => {
          const el2: any = b.form.elements;
          return { firer: String(el2.firer.value), target: String(el2.target.value ?? ""), range: String(el2.range.value), mode: el2.mode ? String(el2.mode.value) : modes[0] ?? "SS",
            fa: el2.fa ? Number(el2.fa.value) || RULES.FIRING.fullAutoMin : undefined, pool: Math.max(0, Math.floor(Number(el2.pool.value) || 0)), mod: Number(el2.mod.value) || 0, ignoreArc: Boolean(el2.ignoreArc?.checked), ignoreTurret: Boolean(el2.ignoreTurret?.checked), exclude: excludedOf(b.form), part: String(el2.vehiclePart?.value ?? ""), seg: segRowsOf(b.form) };
        },
      },
      render: (_e: Event, dialog: any) => {
        const form = dialog?.element?.querySelector("form");
        const sel = form?.querySelector('select[name="target"]');
        sel?.addEventListener("change", () => {
          const r = bandFor(sel.value || "");
          form.querySelector('select[name="range"]').value = r.band;
          const note = form.querySelector(".sr2e-range-note");
          if (note) note.textContent = r.note;
          const arcP = form.querySelector(".sr2e-arc-note");
          if (arcP) arcP.textContent = arcNote(sel.value || "");
          const turP = form.querySelector(".sr2e-turret-note");
          if (turP) turP.textContent = turretNote(sel.value || "");
        });
        // v0.50.0: the TN with everything found by itself (switchable), as the Attack dialog shows it.
        livePreview(dialog, (f, excluded) => {
          const el2: any = f.elements;
          const firer: any = fromUuidSync(String(el2.firer?.value ?? ""));
          const pv = firer?.previewMounted?.(vehicle, weapon, { targetUuid: el2.target?.value || null, range: el2.range?.value as RangeBand, mode: (el2.mode?.value ?? modes[0] ?? "SS") as FiringMode,
            ...(el2.fa ? { fullAutoRounds: Number(el2.fa.value) || RULES.FIRING.fullAutoMin } : {}), poolDice: Number(el2.pool?.value) || 0, modifiers: Number(el2.mod?.value) ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: Number(el2.mod.value) }] : [],
            ...vehiclePartOpts(String(el2.vehiclePart?.value ?? "")) });
          if (!pv) return "";
          const auto = new Set<string>(pv.auto ?? []);
          return tnPreviewHtml({ base: pv.base, baseLabel: pv.baseLabel, auto: pv.modifiers.filter((m: any) => auto.has(modKey(m))), manual: pv.modifiers.filter((m: any) => !auto.has(modKey(m))), excluded })
            + `<p class="hint">${tx('SR2E.Dialog.Sheet.dice', { pvDice: escHtml(pv.dice), part: pv.pool ? tx('SR2E.Dialog.Sheet.pool2', { pvPool: escHtml(pv.pool) }) : "", pvPower: escHtml(pv.power), pvLevel: escHtml(pv.level), pvDamageType: escHtml(pv.damageType) })}</p>`;
        });
      },
      rejectClose: false,
    });
    if (!choice) return;
    const firer: any = fromUuidSync(choice.firer);
    if (!firer) return;
    if (firer.type !== "vehicle" && !(await firer.useAction(`fire:${choice.mode}`, tx('SR2E.Card.Sheet.firing', { weaponName: weapon.name })))) return;
    const measured = choice.target ? bandFor(choice.target).metres : null;
    await firer.fireMounted(vehicle, weapon, {
      targetUuid: choice.target || null, range: choice.range as RangeBand, mode: choice.mode as FiringMode,
      ...(choice.fa ? { fullAutoRounds: choice.fa } : {}), poolDice: choice.pool,
      // v0.79.0: the Sensor-Enhanced Targeting rows count only with a sensor lock on the target.
      modifiers: [...(choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : []), ...((vehicle.system.locks ?? []).some((l: any) => l.targetUuid === choice.target) ? choice.seg : [])],
      ...(measured != null ? { measuredMetres: measured } : {}),
      ...(choice.ignoreArc ? { ignoreArc: true } : {}),
      ...(choice.ignoreTurret ? { ignoreTurret: true } : {}),
      ...(choice.exclude.length ? { exclude: choice.exclude } : {}),
      ...vehiclePartOpts(choice.part ?? ""),
    });
  }

/** v0.79.0 (RULES.DOCS_V79.vehSensorTable, Rigger 2 Sensor Test Modifiers table): the ticked rows and a spirit's Force. */
function sensorRowsOf(form: any): TargetNumberModifier[] {
  const ids = [...(form?.querySelectorAll?.('input[name="sensorRow"]:checked') ?? [])].map((e: any) => String(e.value));
  return sensorTableModifiers({ ids, spiritForce: Number(form?.elements?.spiritForce?.value) || 0 });
}

/** v0.79.0 (VEHICLES_V57.sensorGunnery 'rigger2', Rigger 2 Sensor-Enhanced Targeting table): the ticked rows. */
function segRowsOf(form: any): TargetNumberModifier[] {
  return segConditionModifiers([...(form?.querySelectorAll?.('input[name="segRow"]:checked') ?? [])].map((e: any) => String(e.value)));
}

/* ---- v0.57.0: called shots at a vehicle ---- */

/** The Attack and Fire dialogs' "at a vehicle" row: a part, or someone aboard (applies when the target is that vehicle). */
function vehiclePartRow(exclude = ""): string {
  const parts = RULES.VEHICLES_V57.calledShots.parts.filter((p) => p.id !== "occupant");
  const occ = RULES.VEHICLES_V57.calledShots.parts.find((p) => p.id === "occupant");
  const vehicles = allActors().filter((a: any) => a.type === "vehicle" && a.uuid !== exclude);
  const aboard = occ ? vehicles.flatMap((v: any) => [...new Set([...(v.system.occupants ?? []), ...(v.system.controlMode === "manual" && v.system.controllerUuid ? [v.system.controllerUuid] : [])])]
    .map((u: string) => ({ u, v, a: fromUuidSync(u) })).filter((x: any) => x.a)) : [];
  const tn = (p: any) => RULES.VEHICLES_V57.calledShots.tn + (p?.tn ?? 0);
  return `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.atAVehicleCalledShot')}</label><select name="vehiclePart"><option value="">${tx('SR2E.Dialog.Sheet.no2')}</option>
    ${parts.map((p) => `<option value="${escHtml(p.id)}">${escHtml(p.label)} (+${escHtml(tn(p))})</option>`).join("")}
    ${aboard.map((x: any) => `<option value="occupant:${escHtml(x.u)}">${tx('SR2E.Dialog.Sheet.inside', { name: escHtml(x.a.name), name2: escHtml(x.v.name), tn: escHtml(tn(occ)) })}</option>`).join("")}</select></div>`;
}

/** Attack options for the vehicle part picked. */
function vehiclePartOpts(v: string): { vehiclePart?: string; occupantUuid?: string } {
  if (!v) return {};
  if (v.startsWith("occupant:")) return { vehiclePart: "occupant", occupantUuid: v.slice(9) };
  return { vehiclePart: v };
}

/* ---- v0.26.0: building security ---- */

const SENSE_LABELS: Record<string, string> = { "": "SR2E.App.Sheets.senseNone", visual: "SR2E.App.Sheets.senseVisual", lowLight: "SR2E.App.Sheets.senseLowLight", thermal: "SR2E.App.Sheets.senseThermal", ultrasound: "SR2E.App.Sheets.senseUltrasound", motion: "SR2E.App.Sheets.senseMotion", pressure: "SR2E.App.Sheets.sensePressure", acoustic: "SR2E.App.Sheets.senseAcoustic" };
const CONCEAL_LABELS: Record<string, string> = { "": "SR2E.App.Sheets.concealNone", invisibility: "SR2E.App.Sheets.concealInvisibility", improvedInvisibility: "SR2E.App.Sheets.concealImprovedInvisibility", chameleon: "SR2E.App.Sheets.concealChameleon", thermal: "SR2E.App.Sheets.concealThermal", silence: "SR2E.App.Sheets.concealSilence", mask: "SR2E.App.Sheets.concealMask", physicalMask: "SR2E.App.Sheets.concealPhysicalMask" };

const DEVICE_LOCKS = ["maglock", "door"];

/** Bypass a lock: pick who tries (or use `actor`), then Electronics vs the lock's rating. */
async function bypassDialog(site: any, deviceId: string, actor: any | null = null): Promise<void> {
  const d = site.device?.(deviceId);
  if (!d) return;
  const people = actor ? [actor] : allActors().filter((a: any) => ["character", "npc"].includes(a.type) && a.isOwner);
  if (!people.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.thereIsNoCharacterToMake'));
  const choice = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Sheet.bypass', { name: d.name }) },
    content: `${actor ? "" : `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.who')}</label><select name="who">${people.map((p: any) => `<option value="${escHtml(p.uuid)}">${escHtml(p.name)}</option>`).join("")}</select></div>`}
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.combatPoolDice')}</label><input name="pool" type="number" value="0" min="0"></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
      <div class="sr2e-preview" aria-live="polite"></div>
      <p class="hint">${tx('SR2E.Dialog.Sheet.orAtVsYourBestBypass', { part: d.casing && !d.casingOpen ? tx('SR2E.Dialog.Sheet.firstTheCasingVsThenThe', { securityV57CasingSkill: RULES.SECURITY_V57.casingSkill, casing: escHtml(d.casing) }) : "", bypassSkill: RULES.SECURITY.bypass.skill, bypassAttribute: escHtml(cap(RULES.SECURITY.bypass.attribute)), attributeDefaultTnMod: RULES.ATTRIBUTE_DEFAULT_TN_MOD, rating: escHtml(d.rating), part2: d.lockType ? ` (${escHtml(lockTypeOf(d.lockType).label)})` : "", securityV57NoToolsTn: RULES.SECURITY_V57.noToolsTn, bypassFailTally: RULES.SECURITY.bypass.failTally, bypassTimeBaseTurns: RULES.SECURITY.bypassTime.baseTurns[d.kind] ?? RULES.SECURITY.bypassTime.baseTurns["other"], part3: d.tamper ? (RULES.BOOK_V78.tamper.mode === "tn" ? (d.casing && d.casingOpen ? tx('SR2E.Dialog.Sheet.theCasingIsOpenItsAnti', { tamper: escHtml(d.tamper) }) : tx('SR2E.Dialog.Sheet.anAntiTamperAlarmAddsTo', { tamper: escHtml(d.tamper), part: d.casing ? tx('SR2E.Dialog.Sheet.casing') : tx('SR2E.Dialog.Sheet.circuit') })) : tx('SR2E.Dialog.Sheet.aTamperAlarmChecksTheWork', { tamper: escHtml(d.tamper) })) : "", part4: d.lockType === "voice" && RULES.BOOK_V78.voiceLocks === "deception" ? tx('SR2E.Dialog.Sheet.aVoiceLockCanTBe') : "" })}</p>`,
    ok: { label: tx('SR2E.Dialog.Sheet.try'), callback: (_e: Event, b: any) => ({ who: actor ? actor.uuid : String(b.form.elements.who.value), pool: Math.max(0, Math.floor(Number(b.form.elements.pool.value) || 0)), mod: Number(b.form.elements.mod.value) || 0, exclude: excludedOf(b.form) }) },
    // v0.57.0: what the bypass finds by itself (the lock type, tools, light); the casing first when it has one.
    render: (_e: Event, dialog: any) => livePreview(dialog, (f, excluded) => {
      const el: any = f.elements;
      const who: any = fromUuidSync(actor ? actor.uuid : String(el.who?.value ?? ""));
      const pv = who?.bypassPreview?.(site, deviceId);
      if (!pv) return "";
      const mod = Number(el.mod?.value) || 0;
      return tnPreviewHtml({ base: pv.tn, baseLabel: pv.step === "casing" ? tx('SR2E.Dialog.Sheet.casing2', { casing: d.casing }) : pv.step === "voice" ? tx('SR2E.Dialog.Sheet.voiceLock', { rating: d.rating }) : tx('SR2E.Dialog.Sheet.lock', { rating: d.rating }), auto: pv.modifiers, manual: mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: mod }] : [], excluded, note: pv.step === "voice" ? (pv.tool ? tx('SR2E.Dialog.Sheet.diceNoPoolDiceTheLock', { pvDice: pv.dice, pvTool: pv.tool }) : tx('SR2E.Dialog.Sheet.noVoiceDeceptionDevice')) : tx('SR2E.Dialog.Sheet.dice4', { pvDice: pv.dice, part: pv.tool ? ` (${pv.tool})` : "" }) });
    }),
    rejectClose: false,
  } as any) as any;
  if (!choice) return;
  const who: any = fromUuidSync(choice.who);
  if (!who) return;
  // v0.78.0 review fix: a voice lock with no voice-deception device: say so before the action is spent.
  const pre = who.bypassPreview?.(site, deviceId);
  if (pre?.step === "voice" && !pre.tool) return ui.notifications.warn(tx('SR2E.Notify.Sheet.onlyOpensToAnApprovedVoice', { name: escHtml(d.name), whoName: escHtml(who.name) }));
  if (!(await who.useAction("skill", tx('SR2E.Card.Sheet.bypassingALock')))) return;
  await who.bypassLock(site, deviceId, { poolDice: choice.pool, modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [], ...(choice.exclude?.length ? { exclude: choice.exclude } : {}) });
}

/** A site's security network: devices, tally and alert, response, security rigger, turrets, linked host. */
export class SR2SiteSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** v0.59.0: dropped items arrive uninstalled / unbonded / unloaded, move between actors, and only fitting types (applications/drops.ts). */
  async _onDropItem(event: any, item: any): Promise<any> {
    return dropItemOnActor(this, event, item, () => (super._onDropItem as any)(event, item));
  }

  static DEFAULT_OPTIONS: Record<string, any> = {
    classes: ["sr2e", "sheet", "actor", "site"],
    position: { width: 640, height: 720 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      addDevice: SR2SiteSheet.#onAddDevice,
      editDevice: SR2SiteSheet.#onEditDevice,
      deleteDevice: SR2SiteSheet.#onDeleteDevice,
      toggleDevice: SR2SiteSheet.#onToggleDevice,
      toggleBypassed: SR2SiteSheet.#onToggleBypassed,
      linkToken: SR2SiteSheet.#onLinkToken,
      linkDoor: SR2SiteSheet.#onLinkDoor,
      detect: SR2SiteSheet.#onDetect,
      scanDevice: SR2SiteSheet.#onScanDevice,
      bypass: SR2SiteSheet.#onBypass,
      addStep: SR2SiteSheet.#onAddStep,
      editStep: SR2SiteSheet.#onEditStep,
      deleteStep: SR2SiteSheet.#onDeleteStep,
      resetSite: SR2SiteSheet.#onReset,
      setRigger: SR2SiteSheet.#onSetRigger,
      dropRigger: SR2SiteSheet.#onDropRigger,
      addSlaved: SR2SiteSheet.#onAddSlaved,
      removeSlaved: SR2SiteSheet.#onRemoveSlaved,
      fireSlaved: SR2SiteSheet.#onFireSlaved,
      openActor: SR2SiteSheet.#onOpenActor,
      addGuards: SR2SiteSheet.#onAddGuards,
      removeGuard: SR2SiteSheet.#onRemoveGuard,
      guardsWatch: SR2SiteSheet.#onGuardsWatch,
      forceDevice: SR2SiteSheet.#onForceDevice,
    },
  };

  static PARTS: Record<string, any> = {
    main: { template: `${SYSTEM.PATH.TEMPLATES}/actor-site-sheet.hbs`, scrollable: [""] },
  };

  async _prepareContext(options: any): Promise<any> {
    const context = await super._prepareContext(options);
    const actor: any = this.document;
    const sys = actor.system;
    const rigger: any = actor.securityRigger?.() ?? null;
    const r = sys.response ?? {};
    const responseLabel = r.arrived ? tx('SR2E.App.Sheets.arrived') : r.round >= 0 ? tx('SR2E.App.Sheets.dueInCombatTurn', { round: r.round }) : r.worldTime >= 0 ? tx('SR2E.App.Sheets.dueInMin', { minutes: Math.max(0, Math.ceil((r.worldTime - sysNow()) / 60)) }) : tx('SR2E.App.Sheets.notCalled');
    return {
      ...context, actor, system: sys,
      alerts: RULES.SECURITY.alerts.map((k) => ({ key: k, label: cap(k) })),
      kinds: RULES.SECURITY.deviceKinds,
      devices: (sys.devices ?? []).map((d: any) => ({
        ...d, isLock: DEVICE_LOCKS.includes(d.kind), isScanner: d.kind === "scanner", status: d.bypassed ? tx('SR2E.App.Sheets.bypassed') : d.active ? tx('SR2E.App.Sheets.on') : tx('SR2E.App.Sheets.off'), senseLabel: SENSE_LABELS[d.sense ?? ""] ? tKey(SENSE_LABELS[d.sense ?? ""]!) : d.sense,
        tokenName: d.tokenUuid ? fromUuidSync(d.tokenUuid)?.name ?? tx('SR2E.App.Sheets.tokenGone') : "", hasDoor: Boolean(d.wallId),
        lockLabel: d.lockType ? lockTypeOf(d.lockType).label : "",
      })),
      steps: (sys.steps ?? []).map((st: any, index: number) => ({ ...st, index, reached: sys.tally >= st.step })).sort((a: any, b: any) => a.step - b.step),
      responseLabel,
      rigger: rigger ? { uuid: rigger.uuid, name: rigger.name, pool: rigger.system.derived?.controlPoolLeft ?? 0 } : null,
      slaved: (sys.slaved ?? []).map((u: string) => fromUuidSync(u)).filter(Boolean).map((v: any) => ({
        uuid: v.uuid, name: v.name, status: v.system.derived?.status ?? "ok",
        weapons: [...v.items].filter((i: any) => i.type === "weapon" && i.system.mount && i.system.mount !== "none").map((i: any) => ({ id: i.id, name: i.name, label: damageLabel(i.system) })),
      })),
      hosts: [{ key: "", label: tx('SR2E.App.Sheets.none') }, ...allActors().filter((a: any) => a.type === "host").map((a: any) => ({ key: a.uuid, label: a.name }))],
      deckers: sys.hostUuid ? allActors().filter((a: any) => a.isJackedIn?.() && a.system.matrix?.hostUuid === sys.hostUuid).map((a: any) => ({ uuid: a.uuid, name: a.name })) : [],
      isGM: Boolean(game.user?.isGM),
      // v0.49.0: the site's guards.
      guards: (sys.guards ?? []).map((u: string) => { const g: any = fromUuidSync(u); return { uuid: u, name: g?.name ?? tx('SR2E.App.Sheets.gone'), status: g?.system?.derived?.status ?? "", down: ["unconscious", "dying", "dead"].includes(g?.system?.derived?.status ?? "ok") }; }),
      guardTally: RULES.SECURITY.guards.tallyPerGuard,
    };
  }

  static async #deviceDialog(site: any, index: number | null) {
    const list = [...(site.system.devices ?? [])].map((d: any) => ({ ...d }));
    const d = index === null ? { id: foundry.utils.randomID(), name: "", kind: "camera", rating: 4, tokenUuid: "", sceneId: "", wallId: "", active: true, bypassed: false, scanKind: "", sense: "visual", tamper: 0, notes: "" } : list[index];
    const scanLabels: Record<string, string> = { "": tx('SR2E.App.Sheets.notAScanner'), weapon: tx('SR2E.App.Sheets.weapons2'), cyber: tx('SR2E.App.Sheets.cyberware2'), explosive: tx('SR2E.App.Sheets.explosives2') };
    if (!d) return;
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.device2', { part: index === null ? tx('SR2E.Dialog.Sheet.add') : tx('SR2E.Dialog.Sheet.edit2'), siteName: site.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.name')}</label><input name="name" type="text" value="${escHtml(d.name)}" placeholder="${tx('SR2E.Dialog.Sheet.eGLobbyCamera')}" autofocus></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.kind')}</label><select name="kind">${RULES.SECURITY.deviceKinds.map((k) => `<option value="${escHtml(k)}" ${k === d.kind ? "selected" : ""}>${escHtml(cap(k))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.rating2')}</label><input name="rating" type="number" value="${escHtml(d.rating)}" min="0"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.aScannerDetects')}</label><select name="scanKind">${RULES.GEAR.scannerKinds.map((k) => `<option value="${escHtml(k)}" ${k === (d.scanKind ?? "") ? "selected" : ""}>${escHtml(scanLabels[k] ?? k)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.sensesWith')}</label><select name="sense">${RULES.SECURITY.senses.map((k) => `<option value="${escHtml(k)}" ${k === (d.sense ?? "") ? "selected" : ""}>${escHtml(SENSE_LABELS[k] ? tKey(SENSE_LABELS[k]!) : k)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.tamperAlarmRating0None')}</label><input name="tamper" type="number" value="${escHtml(d.tamper ?? 0)}" min="0"></div>
        <label class="sr2e-check"><input type="checkbox" name="identifies" ${d.identifies ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.identifiesPeopleFaceOrIdCheck')}</label>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.maglockType')}</label><select name="lockType">${RULES.SECURITY_V57.lockTypes.map((l) => `<option value="${escHtml(l.id)}" ${l.id === (d.lockType ?? "") ? "selected" : ""}>${escHtml(l.label)}${l.tn ? ` (+${l.tn})` : ""}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.casingRating0NoneOpenedFirst')}</label><input name="casing" type="number" value="${escHtml(d.casing ?? 0)}" min="0"></div>
        <label class="sr2e-check"><input type="checkbox" name="casingOpen" ${d.casingOpen ? "checked" : ""}> ${tx('SR2E.Dialog.Sheet.casingOpen')}</label>
        <fieldset><legend>${tx('SR2E.Dialog.Sheet.aGasDeviceKindGasReleased')}</legend>
          <div class="sr2e-row"><label>${tx('SR2E.Dialog.Sheet.toxin')} <input name="gasName" type="text" value="${escHtml(d.toxin?.name ?? "")}" placeholder="${escHtml(RULES.SECURITY_V61.gas.defaultToxin.name)}"></label>
            <label title="${tx('SR2E.Dialog.Sheet.n0TheDeviceSRatingElse')}">${tx('SR2E.Dialog.Sheet.power')} <input name="gasPower" type="number" value="${escHtml(d.toxin?.power ?? 0)}" min="0" style="width:4em"></label>
            <label>${tx('SR2E.Dialog.Sheet.level')} <select name="gasLevel">${["L", "M", "S", "D"].map((k) => `<option ${k === (d.toxin?.level ?? "S") ? "selected" : ""}>${escHtml(k)}</option>`).join("")}</select></label>
            <label>${tx('SR2E.Dialog.Sheet.type')} <select name="gasType">${["stun", "physical"].map((k) => `<option ${k === (d.toxin?.damageType ?? "stun") ? "selected" : ""}>${escHtml(k)}</option>`).join("")}</select></label>
            <label>${tx('SR2E.Dialog.Sheet.speed')} <select name="gasSpeed">${RULES.TOXINS.speeds.map((x) => `<option value="${escHtml(x.id)}" ${x.id === (d.toxin?.speed ?? "turn") ? "selected" : ""}>${escHtml(x.label)}</option>`).join("")}</select></label>
            <label title="${tx('SR2E.Dialog.Sheet.aroundItsLinkedToken0Only')}">${tx('SR2E.Dialog.Sheet.radiusM')} <input name="gasRadius" type="number" value="${escHtml(d.radius ?? 0)}" min="0" style="width:4em"></label></div>
        </fieldset>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.notes')}</label><input name="notes" type="text" value="${escHtml(d.notes)}"></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.whatItSensesWithDecidesWhat', { part: RULES.BOOK_V78.tamper.mode === "tn" ? tx('SR2E.Dialog.Sheet.anAntiTamperAlarmAddsIts') : tx('SR2E.Dialog.Sheet.aTamperAlarmChecksEveryBypass') })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.save'), callback: (_e: Event, b: any) => { const el = b.form.elements; const kind = String(el.kind.value); return { name: String(el.name.value ?? "").trim() || cap(kind), kind, rating: Math.max(0, Math.floor(Number(el.rating.value) || 0)), scanKind: kind === "scanner" ? String(el.scanKind.value || "weapon") : "", sense: String(el.sense.value ?? ""), tamper: Math.max(0, Math.floor(Number(el.tamper.value) || 0)), identifies: Boolean(el.identifies.checked), notes: String(el.notes.value ?? ""),
        lockType: String(el.lockType.value ?? ""), casing: Math.max(0, Math.floor(Number(el.casing.value) || 0)), casingOpen: Boolean(el.casingOpen.checked),
        toxin: { name: String(el.gasName.value ?? "").trim(), power: Math.max(0, Math.floor(Number(el.gasPower.value) || 0)), level: String(el.gasLevel.value || "S"), damageType: String(el.gasType.value || "stun"), vector: "inhalation", speed: String(el.gasSpeed.value || "turn") },
        radius: Math.max(0, Number(el.gasRadius.value) || 0) }; } },
      rejectClose: false,
    });
    if (!r) return;
    Object.assign(d, r);
    if (index === null) list.push(d);
    await site.update({ "system.devices": list });
  }

  static #index(target: HTMLElement): number {
    return Number(target.closest<HTMLElement>("[data-index]")?.dataset["index"]);
  }

  static async #patchDevice(site: any, index: number, patch: Record<string, unknown>) {
    const list = [...(site.system.devices ?? [])].map((d: any) => ({ ...d }));
    if (!list[index]) return;
    Object.assign(list[index], patch);
    await site.update({ "system.devices": list });
  }

  static async #onAddDevice(this: SR2SiteSheet) { await SR2SiteSheet.#deviceDialog(this.document, null); }
  static async #onEditDevice(this: SR2SiteSheet, _e: Event, t: HTMLElement) { await SR2SiteSheet.#deviceDialog(this.document, SR2SiteSheet.#index(t)); }
  static async #onDeleteDevice(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    // v0.81.1 (S2-5): the row's id when it has one, else a checked index (spliceRow), and once per row: a second click
    // before the re-render would otherwise remove the next row.
    const row = t.closest<HTMLElement>("[data-index]");
    if (!row || row.dataset["deleting"]) return;
    const list = [...((this.document as any).system.devices ?? [])];
    const id = row.dataset["id"];
    const at = id ? list.findIndex((d: any) => d?.id === id) : -1;
    if (at >= 0) { list.splice(at, 1); row.dataset["deleting"] = "1"; }
    else if (!spliceRow(list, row)) return;
    await (this.document as any).update({ "system.devices": list });
  }
  static async #onToggleDevice(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    const i = SR2SiteSheet.#index(t);
    await SR2SiteSheet.#patchDevice(this.document, i, { active: !(this.document as any).system.devices[i]?.active });
  }
  static async #onToggleBypassed(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    const site: any = this.document;
    const d = site.system.devices[SR2SiteSheet.#index(t)];
    if (d) await SR2Actor.applySiteChange(site.uuid, { deviceId: d.id, bypassed: !d.bypassed });
  }

  /** Tie a device to the token selected on the canvas (where it sees from). */
  static async #onLinkToken(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    const token: any = canvas?.tokens?.controlled?.[0] ?? null;
    if (!token) return ui.notifications.warn(tx('SR2E.Notify.Sheet.selectTheDeviceSTokenOn'));
    await SR2SiteSheet.#patchDevice(this.document, SR2SiteSheet.#index(t), { tokenUuid: token.document.uuid });
    ui.notifications.info(tx('SR2E.Notify.Sheet.linkedTo', { tokenName: escHtml(token.name) }));
  }

  /** Tie a device to the door wall selected on the canvas (the Walls layer). */
  static async #onLinkDoor(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    const wall: any = canvas?.walls?.controlled?.[0] ?? null;
    if (!wall || !(wall.document?.door > 0)) return ui.notifications.warn(tx('SR2E.Notify.Sheet.selectADoorOnTheWalls'));
    await SR2SiteSheet.#patchDevice(this.document, SR2SiteSheet.#index(t), { sceneId: canvas.scene.id, wallId: wall.document.id });
    ui.notifications.info(tx('SR2E.Notify.Sheet.doorLinked'));
  }

  static async #onDetect(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    const site: any = this.document;
    const d = site.system.devices[SR2SiteSheet.#index(t)];
    if (!d) return;
    const from: any = d.tokenUuid ? fromUuidSync(d.tokenUuid)?.object ?? null : null;
    const { options, tokens } = attackTargetOptions(site, from, game.user.targets?.first?.() ?? null);
    const rigger: any = site.securityRigger?.() ?? null;
    const left = rigger?.system.derived?.controlPoolLeft ?? 0;
    const sightOf = (uuid: string): boolean | null => { const to = uuid ? tokens.get(uuid) ?? null : null; return from && to ? lineOfSight(from, to) : null; };
    const choice = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.detect', { name: d.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.intruder')}</label><select name="target">${options}</select></div>
        <p class="hint sr2e-sight">${from ? tx('SR2E.Dialog.Sheet.lineOfSightIsCheckedFrom') : tx('SR2E.Dialog.Sheet.theDeviceHasNoTokenLine')}</p>
        ${rigger ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.sControlPoolLeft', { riggerName: escHtml(rigger.name), left: escHtml(left) })}</label><input name="pool" type="number" value="0" min="0" max="${escHtml(left)}"></div>` : ""}
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.otherTnModifier')}</label><input name="mod" type="number" value="0"></div>
        <div class="sr2e-preview" aria-live="polite"></div>
        ${d.sense ? `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.intruderSConcealment')}</label><select name="conceal"><option value="auto">${tx('SR2E.Dialog.Sheet.fromTheirSuitAndSpells')}</option>${RULES.SECURITY.concealmentKinds.map((k) => `<option value="${escHtml(k)}">${escHtml(CONCEAL_LABELS[k] ? tKey(CONCEAL_LABELS[k]!) : k)}</option>`).join("")}</select></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.concealmentRatingSpellSuccessesSuitRatin')}</label><input name="concealRating" type="number" value="0" min="0"></div>
        <p class="hint sr2e-conceal"></p>` : ""}
        <label class="sr2e-check"><input type="checkbox" name="force"> ${d.sense ? tx('SR2E.Dialog.Sheet.ignoreLineOfSightAndConcealment') : tx('SR2E.Dialog.Sheet.ignoreLineOfSight')}</label>
        <p class="hint">${tx('SR2E.Dialog.Sheet.rollsVsTheIntruderSThe', { name: escHtml(d.name), part: d.sense ? ` (${escHtml(SENSE_LABELS[d.sense] ? tKey(SENSE_LABELS[d.sense]!) : d.sense)})` : "", rating: escHtml(d.rating), detectionSkill: RULES.SECURITY.detection.skill })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.roll'), callback: (_e2: Event, b: any) => { const el = b.form.elements; const c = el.conceal ? String(el.conceal.value) : "auto"; return { exclude: excludedOf(b.form), target: String(el.target.value ?? ""), pool: Math.max(0, Math.min(left, Math.floor(Number(el.pool?.value) || 0))), mod: Number(el.mod.value) || 0, force: Boolean(el.force.checked),
        concealment: c === "auto" ? undefined : { kind: c, rating: Math.max(0, Math.floor(Number(el.concealRating?.value) || 0)) } }; } },
      render: (_e2: Event, dialog: any) => {
        const form = dialog?.element?.querySelector("form");
        const sel = form?.querySelector('select[name="target"]');
        const show = () => {
          const s = sightOf(sel?.value ?? ""); const p = form?.querySelector(".sr2e-sight"); if (p && s !== null) p.textContent = s ? tx('SR2E.Dialog.Sheet.lineOfSightClear') : tx('SR2E.Dialog.Sheet.lineOfSightBlockedByA');
          const cp = form?.querySelector(".sr2e-conceal");
          const who: any = sel?.value ? fromUuidSync(sel.value) : null;
          if (cp) { const list = who?.concealmentOf?.() ?? []; cp.textContent = list.length ? tx('SR2E.Dialog.Sheet.known', { list: list.map((c: any) => `${c.source} (${CONCEAL_LABELS[c.kind] ? tKey(CONCEAL_LABELS[c.kind]!) : c.kind} ${c.rating})`).join(", ") }) : tx('SR2E.Dialog.Sheet.noSuitOrInvisibilitySpellOn'); }
        };
        sel?.addEventListener("change", show); show();
        // v0.50.0: light, smoke and weather by the device's sense, found by themselves (and switchable).
        livePreview(dialog, (f, ex) => {
          const who: any = (f.elements as any).target?.value ? fromUuidSync((f.elements as any).target.value) : null;
          return who ? tnPreviewHtml({ title: d.name, auto: site.deviceSight(d, who), excluded: ex, note: d.sense ? "" : tx('SR2E.Dialog.Sheet.setWhatTheDeviceSensesWith') }) : "";
        });
      },
      rejectClose: false,
    });
    if (!choice) return;
    if (!choice.target) return ui.notifications.warn(tx('SR2E.Notify.Sheet.pickAnIntruder'));
    await site.detect(d.id, choice.target, { exclude: choice.exclude, poolDice: choice.pool, modifiers: choice.mod ? [{ id: 'other', label: tx('SR2E.Card.Mod.other'), value: choice.mod }] : [], sight: sightOf(choice.target), force: choice.force, ...(choice.concealment ? { concealment: choice.concealment } : {}) });
  }

  /** v0.49.0: the selected (else targeted) tokens' actors become guards. */
  static async #onAddGuards(this: SR2SiteSheet) {
    const site: any = this.document;
    const picked = [...(canvas?.tokens?.controlled ?? []), ...(game.user.targets ?? [])].map((t: any) => t.actor).filter((a: any) => a && ["character", "npc", "spirit"].includes(a.type));
    if (!picked.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.selectOrTargetTheGuardsTokens'));
    await site.setGuards([...new Set(picked.map((a: any) => a.uuid as string))]);
  }
  static async #onRemoveGuard(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    await (this.document as any).setGuards([], [String(t.dataset["uuid"] ?? "")]);
  }

  /** v0.49.0: the guards look for intruders (each intruder sneaks past them all at once). */
  static async #onGuardsWatch(this: SR2SiteSheet) {
    const site: any = this.document;
    const guards = new Set<string>(site.system.guards ?? []);
    const targeted = new Set([...(game.user.targets ?? [])].map((t: any) => t.actor?.uuid).filter(Boolean));
    const seen = new Set<string>();
    const near = [...(canvas?.tokens?.placeables ?? [])].filter((t: any) => t.actor && ["character", "npc", "spirit"].includes(t.actor.type) && !guards.has(t.actor.uuid))
      .filter((t: any) => (seen.has(t.actor.uuid) ? false : (seen.add(t.actor.uuid), true)));
    if (!near.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.noOneOnTheSceneFor'));
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.guardsLook', { siteName: site.name }) },
      content: `<fieldset class="sr2e-situational"><legend>${tx('SR2E.Dialog.Sheet.whoMightTheySee')}</legend>${near.map((t: any) => `<label class="sr2e-check"><input type="checkbox" name="who" value="${escHtml(t.actor.uuid)}" ${targeted.has(t.actor.uuid) || (!targeted.size && t.actor.hasPlayerOwner) ? "checked" : ""}> ${escHtml(t.name)}</label>`).join("")}</fieldset>
        ${tableChecks(RULES.STREET.perception, "per")}
        <p class="hint">${RULES.SECURITY.guards.alert ? tx('SR2E.Dialog.Sheet.eachIntruderSOnceAgainstEveryAlert', { perceptionStealthSkill: RULES.PERCEPTION.stealthSkill, perceptionSkill: RULES.PERCEPTION.skill, guardsTallyPerGuard: RULES.SECURITY.guards.tallyPerGuard, guardsAlert: RULES.SECURITY.guards.alert }) : tx('SR2E.Dialog.Sheet.eachIntruderSOnceAgainstEvery', { perceptionStealthSkill: RULES.PERCEPTION.stealthSkill, perceptionSkill: RULES.PERCEPTION.skill, guardsTallyPerGuard: RULES.SECURITY.guards.tallyPerGuard })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.look'), callback: (_e2: Event, b: any) => ({ who: Array.from(b.form.querySelectorAll('input[name="who"]:checked')).map((i: any) => i.value as string), per: checkedIds(b.form, "per") }) },
      rejectClose: false,
    }) as { who: string[]; per: string[] } | null;
    if (!r?.who.length) return;
    // v0.50.0: the guards' conditions go on the guards' own TN (as in Perceive).
    const mods = tableModifiers(RULES.STREET.perception, r.per).map((m) => ({ label: tx('SR2E.Card.Mod.guards', { label: m.label }), value: m.value }));
    await site.guardsWatch(r.who, { observerModifiers: mods });
  }

  /** v0.49.0: a device is smashed or cut out (its tamper alarm trips; else it goes dead on the board). */
  static async #onForceDevice(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    const site: any = this.document;
    const d = site.system.devices[SR2SiteSheet.#index(t)];
    if (!d) return;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Sheet.smash', { name: d.name }) }, content: `<p>${tx('SR2E.Dialog.Sheet.smashOrCutOut')} <strong>${escHtml(d.name)}</strong>${tx('SR2E.Dialog.Sheet.itStopsWorking', { part: d.tamper ? tx('SR2E.Dialog.Sheet.andItsTamperAlarmTrips', { tamper: escHtml(d.tamper) }) : RULES.SECURITY.tamper.deadTally ? tx('SR2E.Dialog.Sheet.goingDeadAddsToTheTally', { tamperDeadTally: RULES.SECURITY.tamper.deadTally }) : "" })}</p>`, rejectClose: false });
    if (ok) await site.forceDevice(d.id, "force");
  }

  /** A scanner device sweeps an intruder (v0.43.0). */
  static async #onScanDevice(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    const site: any = this.document;
    const d = site.system.devices[SR2SiteSheet.#index(t)];
    if (!d) return;
    const { options } = attackTargetOptions(site, null, game.user.targets?.first?.() ?? null);
    const uuid = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.scan2', { name: d.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.whoPassesIt')}</label><select name="target">${options}</select></div>
        <p class="hint">${tx('SR2E.Dialog.Sheet.rollsVsEachItemSConcealability', { name: escHtml(d.name), rating: escHtml(d.rating), concealmentDefaultTn: RULES.GEAR.concealment.defaultTn, concealmentTallyOnFind: RULES.GEAR.concealment.tallyOnFind })}</p>`,
      ok: { label: tx('SR2E.Dialog.Sheet.scan'), callback: (_e2: Event, b: any) => String(b.form.elements.target.value ?? "") },
      rejectClose: false,
    });
    if (!uuid) return;
    await site.scanWithDevice(d.id, uuid);
  }

  static async #onBypass(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    const site: any = this.document;
    const d = site.system.devices[SR2SiteSheet.#index(t)];
    if (d) await bypassDialog(site, d.id);
  }

  static async #stepDialog(site: any, index: number | null) {
    const list = [...(site.system.steps ?? [])].map((x: any) => ({ step: x.step, event: x.event, alert: x.alert }));
    const st = index === null ? { step: (list.at(-1)?.step ?? 0) + 3, event: "", alert: "" } : list[index];
    if (!st) return;
    const r = await foundry.applications.api.DialogV2.prompt({
      window: { title: tx('SR2E.Dialog.Sheet.securityStep', { part: index === null ? tx('SR2E.Dialog.Sheet.add') : tx('SR2E.Dialog.Sheet.edit2'), siteName: site.name }) },
      content: `<div class="form-group"><label>${tx('SR2E.Dialog.Sheet.atTally')}</label><input name="step" type="number" value="${escHtml(st.step)}" min="0" autofocus></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.event')}</label><input name="event" type="text" value="${escHtml(st.event)}" placeholder="${tx('SR2E.Dialog.Sheet.eGGuardChecksTheCameras')}"></div>
        <div class="form-group"><label>${tx('SR2E.Dialog.Sheet.raiseAlertTo')}</label><select name="alert"><option value="">${tx('SR2E.Dialog.Sheet.noChange')}</option>${RULES.SECURITY.alerts.filter((k) => k !== "none").map((k) => `<option value="${k}" ${st.alert === k ? "selected" : ""}>${escHtml(cap(k))}</option>`).join("")}</select></div>`,
      ok: { label: tx('SR2E.Dialog.Sheet.save'), callback: (_e: Event, b: any) => ({ step: Math.max(0, Math.floor(Number(b.form.elements.step.value) || 0)), event: String(b.form.elements.event.value ?? "").trim(), alert: String(b.form.elements.alert.value ?? "") }) },
      rejectClose: false,
    });
    if (!r) return;
    if (index === null) list.push(r); else list[index] = r;
    await site.update({ "system.steps": list });
  }
  static async #onAddStep(this: SR2SiteSheet) { await SR2SiteSheet.#stepDialog(this.document, null); }
  static async #onEditStep(this: SR2SiteSheet, _e: Event, t: HTMLElement) { await SR2SiteSheet.#stepDialog(this.document, SR2SiteSheet.#index(t)); }
  static async #onDeleteStep(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    // v0.81.1 (S2-5): a checked index, once per row (spliceRow).
    const row = t.closest<HTMLElement>("[data-index]");
    if (!row || row.dataset["deleting"]) return;
    const list = [...((this.document as any).system.steps ?? [])].map((x: any) => ({ step: x.step, event: x.event, alert: x.alert }));
    if (!spliceRow(list, row)) return;
    await (this.document as any).update({ "system.steps": list });
  }

  static async #onReset(this: SR2SiteSheet) {
    const restore = await foundry.applications.api.DialogV2.confirm({ window: { title: tx('SR2E.Dialog.Sheet.resetSecurity') }, content: `<p>${tx('SR2E.Dialog.Sheet.resetTheTallyAlertAndResponse')}</p>`, yes: { label: tx('SR2E.Dialog.Sheet.restoreDevicesToo') }, no: { label: tx('SR2E.Dialog.Sheet.keepThemBypassed') }, rejectClose: false });
    if (restore === null || restore === undefined) return;
    await (this.document as any).resetSite(Boolean(restore));
  }

  static async #onSetRigger(this: SR2SiteSheet) {
    const site: any = this.document;
    const riggers = allActors().filter((a: any) => ["character", "npc"].includes(a.type) && a.isOwner && (a.system.derived?.rigging?.vcr ?? 0) > 0);
    if (!riggers.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.nobodyYouOwnHasAControl'));
    const uuid = await pickOne(tx('SR2E.Dialog.Sheet.securityRigger', { siteName: site.name }), riggers.map((r: any) => ({ value: r.uuid, label: tx('SR2E.Card.Mod.controlRig2', { name: r.name, riggingVcr: r.system.derived.rigging.vcr }) })));
    const r: any = uuid ? fromUuidSync(uuid) : null;
    if (r) await site.setRigger(r);
  }
  static async #onDropRigger(this: SR2SiteSheet) { await (this.document as any).setRigger(null); }

  static async #onAddSlaved(this: SR2SiteSheet) {
    const site: any = this.document;
    const have = new Set(site.system.slaved ?? []);
    const vehicles = allActors().filter((a: any) => a.type === "vehicle" && !have.has(a.uuid));
    if (!vehicles.length) return ui.notifications.warn(tx('SR2E.Notify.Sheet.makeTheTurretOrDroneAs'));
    const uuid = await pickOne(tx('SR2E.Dialog.Sheet.slaveTo', { siteName: site.name }), vehicles.map((v: any) => ({ value: v.uuid, label: actorLabel(v) })));
    if (uuid) await site.update({ "system.slaved": [...(site.system.slaved ?? []), uuid] });
  }
  static async #onRemoveSlaved(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    const site: any = this.document;
    await site.update({ "system.slaved": [...(site.system.slaved ?? [])].filter((u: string) => u !== t.dataset["uuid"]) });
  }
  static async #onFireSlaved(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    const v: any = fromUuidSync(t.dataset["uuid"] ?? "");
    const w: any = v?.items?.get(t.dataset["itemId"]);
    if (v && w) await mountedFireDialog(v, w);
  }
  static #onOpenActor(this: SR2SiteSheet, _e: Event, t: HTMLElement) {
    const uuid = t.dataset["uuid"];
    if (uuid) fromUuidSync(uuid)?.sheet?.render(true);
  }
}
