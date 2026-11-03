import { SYSTEM } from "./config/system.ts";
// v0.87.0: first, so the system's console errors are kept for "Report a bug" from the start.
import { registerBugReport, bugReport, openBugReport } from "./applications/bugreport.ts";
import { registerPrint, printActor, printPage } from "./applications/print.ts";
import { createDemo, removeDemo } from "./applications/demo.ts";
import { SR2NewEntry } from "./applications/newentry.ts";
import { registerShopButton, openShop } from "./applications/adding.ts";
import { SR2Codex } from "./applications/codex.ts";
import {
  CharacterDataModel, SpiritDataModel, BarrierDataModel, SkillDataModel, WeaponDataModel, ArmorDataModel, GearDataModel, CyberwareDataModel, SpellDataModel, PowerDataModel, FocusDataModel, AdeptPowerDataModel,
  CyberdeckDataModel, ProgramDataModel, HostDataModel, IcDataModel, VehicleDataModel, SiteDataModel, SafehouseDataModel,
} from "./models/index.ts";
import { SR2Actor, SR2Item, SR2Combat, SR2Combatant, registerEssenceHoleHooks, registerCombatRelay } from "./documents/index.ts";
import { registerSocket } from "./applications/socket.ts";
import { registerItemTypeGuard } from "./applications/drops.ts";
import { registerAreaHooks } from "./applications/canvas.ts";
import { registerFloatingDamage, registerQuickRolls, registerHotkeys } from "./applications/hotkeys.ts";
import { registerAccessibility } from "./applications/a11y.ts";
import { registerI18nHelpers } from "./helpers/i18n.ts";
import { RULES } from "./rules/index.ts";
import { SR2SafehouseSheet } from "./applications/safehouse.ts";
import { SR2CharacterSheet, SR2NpcSheet, SR2SpiritSheet, SR2BarrierSheet, SR2HostSheet, SR2IcSheet, SR2VehicleSheet, SR2SiteSheet, SR2ItemSheet, registerGuideButton } from "./applications/sheets.ts";
import { registerChatHandlers } from "./applications/chat.ts";
import { configureTokens, registerTokenHooks, useItem, runSheetAction, syncTokenVision, registerStateStatusHooks, registerMovementRuler, latestAttackOn } from "./applications/tokens.ts";
import { registerMigrationSetting, runMigrations } from "./migrations.ts";
import { registerSettings } from "./settings.ts";
import { registerUiHooks, SR2GmPanel } from "./applications/ui.ts";
import { registerUndoHooks, registerUndoKeybinding, SR2Undo } from "./applications/undo.ts";
import { SR2NpcGenerator } from "./applications/npcgen.ts";
import { withRichText, postItemToChat } from "./applications/richtext.ts";
import { registerRegionHooks, regionsAt, regionsAtToken, wardsBetween } from "./applications/regions.ts";
import { registerQualityOfLife, playCue, exportTemplatesToCompendium, promptImportTemplates } from "./applications/qol.ts";
import { registerTokenActionHud } from "./applications/tah.ts";
import { registerInlineTests, rollInlineSpec } from "./applications/inline.ts";
import { successTest } from "./rules/index.ts";
import { registerAdvancementHooks, flushAdvancement } from "./applications/advancement.ts";
import { registerApprovalHooks, pendingRequests } from "./applications/approvals.ts";
import { SR2CreationWizard } from "./applications/creation.ts";
import { SR2SpendKarma } from "./applications/spendkarma.ts";
import { registerModuleSupport } from "./applications/modules.ts";
import { kits, giveKit, setUpTokens, tokenOptions } from "./applications/setup.ts";
import { registerHelp, openHelp } from "./applications/help.ts";
import { isLeadGm, isPromptWindow, otherWindows } from "./applications/leader.ts";
import { registerTours, startTour } from "./applications/tours.ts";
import { registerTools, openTools, runTool } from "./applications/tools.ts";
import { registerLookSettings, registerLook, applyLook, findAllPortraits, applyPortrait } from "./applications/look.ts";
import { registerDefaultArtSettings, registerDefaultArt, applyDefaultArt, defaultArtForAll, defaultArtOf } from "./applications/tokenart.ts";
import { registerInterfaceSettings, registerInterface } from "./applications/interface.ts";
import { importCharacter, pasteCatalogueRows, sortCatalogueWithNotice } from "./applications/catalogue.ts";

export class SR2System {
  constructor() {
    Hooks.once("init", () => this.onInit());
    Hooks.once("ready", () => {
      void runMigrations();
      // Macros and other modules: game.sr2e.useItem(uuid) opens an item's dialog (v0.36.0).
      (game as any).sr2e = {
        useItem, runSheetAction, syncTokenVision, gmPanel: () => SR2GmPanel.open(), undo: () => SR2Undo.undoLast(), undoLog: SR2Undo, npcGenerator: (kind?: any) => SR2NpcGenerator.open(kind), postItem: postItemToChat,
        // v0.60.0: an API for macros and other modules (see docs/API.md).
        api: {
          version: String((game as any).system?.version ?? ''),
          rules: RULES,
          successTest,
          rollTest: (spec: string, actor: any = null, o: { quick?: boolean; label?: string } = {}) => rollInlineSpec(spec, { actor, quick: o.quick ?? true, label: o.label ?? null }),
          regionsAt, regionsAtToken, wardsBetween,
          playCue,
          defendNewest: (actor: any) => { const a = latestAttackOn(actor); if (!a) return false; a.defend(); return true; },
          exportTemplates: exportTemplatesToCompendium, importTemplates: promptImportTemplates,
          actorClass: SR2Actor, combatClass: SR2Combat,
          // v0.64.0
          creationWizard: (actor: any) => SR2CreationWizard.open(actor), spendKarma: (actor: any) => SR2SpendKarma.show(actor), pendingRequests, flushAdvancement,
          // v0.66.0
          kits, giveKit: (kitId: string, actors: any[], o: { ready?: boolean } = {}) => { const k = kits().find((x) => x.id === kitId || x.name === kitId); return k ? giveKit(k, actors, { ready: o.ready ?? true }) : Promise.resolve(0); },
          setUpTokens: (actors: any[], o: { placed?: boolean; relink?: boolean } = {}) => setUpTokens(actors, tokenOptions(), { placed: o.placed ?? true, relink: o.relink ?? false }),
          importCharacter, pasteCatalogueRows, openHelp, startTour,
          // v0.67.0
          applyLook, findPortraits: findAllPortraits, applyPortrait,
          // v0.83.0: the default token art.
          defaultArtOf, applyDefaultArt: (actor: any) => applyDefaultArt(actor, 'standin'), defaultArtForAll,
          // v0.85.0: which of this user's windows runs the automation and shows the prompts (applications/leader.ts).
          windowRole: () => ({ lead: isLeadGm(), prompts: isPromptWindow(), otherWindows: otherWindows() }),
          // v0.87.0: print a sheet (dialog), the printable page's HTML, the bug report text and window.
          printActor, printPage, bugReport, openBugReport,
          // v0.88.0: the starter demo (GM).
          createDemo, removeDemo,
          // v0.91.1: the new-entry form ({ kind, actorUuid }).
          newEntry: (o: { kind?: string; actorUuid?: string } = {}) => SR2NewEntry.open(o),
          // v0.91.1: the shop for an actor (else your character, or the GM's selected token).
          openShop: (actor?: any) => openShop(actor),
          // v0.91.3: the Catalogue ({ type, key }: a tab and an entry's page).
          openCatalogue: (o: { type?: string; key?: string } = {}) => SR2Codex.open(o),
          // v0.89.8: every tool in one place.
          openTools, runTool,
          // v0.90.2: sort the "Catalogue (SR2e)" actor folder into subfolders (also runs after every catalogue load).
          sortCatalogue: () => sortCatalogueWithNotice(),
        },
      };
      Hooks.callAll("sr2e.ready", (game as any).sr2e.api);
    });
  }

  onInit(): void {
    console.log(`${SYSTEM.LOG.HEAD}Initializing Shadowrun 2nd Edition system`);

    // v0.89.0: the sr2eT template helper (templates read their text from lang/en.json).
    registerI18nHelpers();
    registerChatHandlers();
    registerSocket();
    registerItemTypeGuard();
    registerAreaHooks();
    registerFloatingDamage();
    registerQuickRolls();
    registerHotkeys();
    registerAccessibility();
    registerCombatRelay();
    registerTokenHooks();
    registerStateStatusHooks();
    registerEssenceHoleHooks();
    registerUiHooks();
    registerUndoHooks();
    registerUndoKeybinding();
    registerMigrationSetting();
    registerSettings();
    registerBugReport();
    // v0.60.0
    registerRegionHooks();
    registerQualityOfLife();
    registerTokenActionHud();
    registerInlineTests();
    // v0.64.0
    registerAdvancementHooks();
    registerApprovalHooks();
    // v0.66.0
    registerModuleSupport();
    registerHelp();
    registerTools();
    // v0.82.0: the Guide button in every SR2e sheet's title bar.
    registerGuideButton();
    // v0.87.0: the Print button on character, NPC and spirit sheets; Report a bug (Configure Settings and the guide).
    registerPrint();
    registerShopButton();
    registerTours();
    // v0.67.0: the look (themes, presets, fonts, chat cards) and portraits found by name.
    registerLookSettings();
    registerLook();
    // v0.83.0: the default token art (the system's own, AI-drawn pictures).
    registerDefaultArtSettings();
    registerDefaultArt();
    // v0.68.0: layouts, the status strip, roll dialogs, steppers, grouped notifications, window memory, settings sections.
    registerInterfaceSettings();
    registerInterface();

    CONFIG.Actor.documentClass = SR2Actor;
    CONFIG.Item.documentClass = SR2Item;
    CONFIG.Combat.documentClass = SR2Combat;
    CONFIG.Combatant.documentClass = SR2Combatant;
    // v0.59.0: a Combat Turn moves the world clock by SR2's 3 seconds (RULES.COMBAT_TURN_SECONDS).
    (CONFIG as any).time.roundTime = RULES.COMBAT_TURN_SECONDS;
    configureTokens();
    registerMovementRuler();

    CONFIG.Actor.dataModels = { character: CharacterDataModel, npc: CharacterDataModel, spirit: SpiritDataModel, barrier: BarrierDataModel, host: HostDataModel, ic: IcDataModel, vehicle: VehicleDataModel, site: SiteDataModel, safehouse: SafehouseDataModel };
    CONFIG.Item.dataModels = {
      skill: SkillDataModel, weapon: WeaponDataModel, armor: ArmorDataModel, gear: GearDataModel,
      cyberware: CyberwareDataModel,
      spell: SpellDataModel,
      power: PowerDataModel,
      focus: FocusDataModel,
      adeptpower: AdeptPowerDataModel,
      cyberdeck: CyberdeckDataModel,
      program: ProgramDataModel,
    };

    const { DocumentSheetConfig } = foundry.applications.apps;
    DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);
    DocumentSheetConfig.unregisterSheet(Item, "core", foundry.appv1.sheets.ItemSheet);
    DocumentSheetConfig.registerSheet(Actor, SYSTEM.id, SR2CharacterSheet, {
      types: ["character", "npc"], makeDefault: true, label: "SR2E.Sheet.Character",
    });
    DocumentSheetConfig.registerSheet(Actor, SYSTEM.id, SR2NpcSheet, {
      types: ["npc"], makeDefault: true, label: "SR2E.Sheet.Npc",
    });
    DocumentSheetConfig.registerSheet(Actor, SYSTEM.id, SR2SpiritSheet, {
      types: ["spirit"], makeDefault: true, label: "SR2E.Sheet.Spirit",
    });
    DocumentSheetConfig.registerSheet(Actor, SYSTEM.id, SR2BarrierSheet, {
      types: ["barrier"], makeDefault: true, label: "SR2E.Sheet.Barrier",
    });
    DocumentSheetConfig.registerSheet(Actor, SYSTEM.id, SR2HostSheet, {
      types: ["host"], makeDefault: true, label: "SR2E.Sheet.Host",
    });
    DocumentSheetConfig.registerSheet(Actor, SYSTEM.id, SR2IcSheet, {
      types: ["ic"], makeDefault: true, label: "SR2E.Sheet.Ic",
    });
    DocumentSheetConfig.registerSheet(Actor, SYSTEM.id, SR2VehicleSheet, {
      types: ["vehicle"], makeDefault: true, label: "SR2E.Sheet.Vehicle",
    });
    DocumentSheetConfig.registerSheet(Actor, SYSTEM.id, SR2SiteSheet, {
      types: ["site"], makeDefault: true, label: "SR2E.Sheet.Site",
    });
    DocumentSheetConfig.registerSheet(Actor, SYSTEM.id, SR2SafehouseSheet, {
      types: ["safehouse"], makeDefault: true, label: "SR2E.Sheet.Safehouse",
    });
    DocumentSheetConfig.registerSheet(Item, SYSTEM.id, SR2ItemSheet, {
      makeDefault: true, label: "SR2E.Sheet.Item",
    });

    // v0.59.0: rich text (enriched HTML fields) on every base sheet; NPC and spirit sheets inherit it.
    for (const cls of [SR2CharacterSheet, SR2BarrierSheet, SR2HostSheet, SR2IcSheet, SR2VehicleSheet, SR2SiteSheet, SR2SafehouseSheet, SR2ItemSheet]) withRichText(cls);

    foundry.applications.handlebars.loadTemplates([
      `${SYSTEM.PATH.TEMPLATES}/actor-character-sheet.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/item-sheet.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/actor-npc-sheet.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/actor-spirit-sheet.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/actor-barrier-sheet.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/actor-host-sheet.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/actor-ic-sheet.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/matrix-section.hbs`,
      // v0.67.0: the condition monitor partials.
      `${SYSTEM.PATH.TEMPLATES}/monitor.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/monitor-track.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/monitor-mini.hbs`,
      // v0.68.0: the status strip and the Combat column layout's column.
      `${SYSTEM.PATH.TEMPLATES}/status-strip.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/combat-column.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/occult-section.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/power-effects.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/effects-section.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/sheet-summary.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/actor-vehicle-sheet.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/rigging-section.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/actor-site-sheet.hbs`,
      `${SYSTEM.PATH.TEMPLATES}/actor-safehouse-sheet.hbs`,
    ]);
  }
}
