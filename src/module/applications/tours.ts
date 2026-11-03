/**
 * v0.66.0: guided tours (Foundry's Tours, listed under Settings → Tours): the character sheet for
 * players, the GM panel for the GM, and the Add window. Each step can open a window or switch a tab
 * first; its target is looked for inside that window.
 */
import { SR2GmPanel } from './ui.ts';
import { SR2AddWindow } from './adding.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';

interface SR2Step {
  id: string;
  /** v0.89.6: the title and content are made when the tour is (at ready), in the user's language. */
  title: () => string;
  /** v0.89.6: the step's HTML, built from lang texts when the tour is made. */
  body: () => string;
  /** CSS inside the window the tour is about ('' = the whole window). */
  target?: string;
  /** Switch the sheet to this tab first. */
  tab?: string;
  /** Switch the GM panel to this tab first. */
  gmTab?: string;
  tooltipDirection?: string;
}

interface SR2TourDef { id: string; title: () => string; description: () => string; gm: boolean; window: 'sheet' | 'gm' | 'add'; steps: SR2Step[] }

const SHEET_STEPS: SR2Step[] = [
  { id: 'header', title: () => tx('SR2E.App.Tours.yourCharacterSheet'), body: () => `<p>${tx('SR2E.App.Tours.thisIsYourCharacter')}</p>`, target: '.sr2e-header' },
  { id: 'summary', title: () => tx('SR2E.App.Tours.atAGlance'), body: () => `<p>${tx('SR2E.App.Tours.theStripAtTheTop')} <strong>${tx('SR2E.App.Tours.yourTurn')}</strong> ${tx('SR2E.App.Tours.withTheActionsYouHaveLeft')}</p>`, target: '.sr2e-strip' },
  { id: 'tools', title: () => tx('SR2E.App.Tours.searchEditAndPlay'), body: () => `<p>${tx('SR2E.App.Tours.searchFindsAnyRow')} <strong>${tx('SR2E.App.Tours.play')}</strong> ${tx('SR2E.App.Tours.modeHidesTheAdd')} <strong>${tx('SR2E.App.Tours.edit')}</strong> ${tx('SR2E.App.Tours.bringsThemBack')}</p>`, target: '.sr2e-sheet-tools' },
  { id: 'tabs', title: () => tx('SR2E.App.Tours.theTabs'), body: () => `<p>${tx('SR2E.App.Tours.inTheCompactLayout')} <strong>${tx('SR2E.App.Tours.main')}</strong> ${tx('SR2E.App.Tours.hasYourAttributesAndSkills')} <strong>${tx('SR2E.App.Tours.current')}</strong> ${tx('SR2E.App.Tours.isAReadOnlySummary')}</p>`, target: '.sr2e-tabs' },
  { id: 'add', title: () => tx('SR2E.App.Tours.addingThings'), body: () => `<p>${tx('SR2E.App.Tours.the')} <strong>+</strong> ${tx('SR2E.App.Tours.onAListHeading')} <strong>?</strong> ${tx('SR2E.App.Tours.afterAHeadingOpens')}</p>`, target: 'a.sr2e-add', tab: 'main' },
  { id: 'current', title: () => tx('SR2E.App.Tours.current'), body: () => `<p>${tx('SR2E.App.Tours.everyAttributeFromItsBase')}</p>`, target: '.sr2e-tabs [data-tab="current"]', tab: 'current' },
  { id: 'upkeep', title: () => tx('SR2E.App.Tours.thingsThatTakeTime'), body: () => `<p>${tx('SR2E.App.Tours.trainingLearningASpell')} <strong>${tx('SR2E.App.Tours.underWay')}</strong> ${tx('SR2E.App.Tours.onTheUpkeepTab')}</p>`, target: '.sr2e-tabs [data-tab="upkeep"]', tab: 'upkeep' },
  { id: 'rolls', title: () => tx('SR2E.App.Tours.rolling'), body: () => `<p>${tx('SR2E.App.Tours.clickASkillOrAttribute')} <kbd>Shift</kbd> ${tx('SR2E.App.Tours.toRollAtOnce')}</p>`, target: '.sr2e-tabs [data-tab="main"]', tab: 'main' },
];

const GM_STEPS: SR2Step[] = [
  { id: 'tabs', title: () => tx('SR2E.App.Tours.theGmPanel'), body: () => `<p>${tx('SR2E.App.Tours.everythingForRunningTheGame')}</p>`, target: '.sr2e-gm-tabs' },
  { id: 'undo', title: () => tx('SR2E.App.Tours.undo'), body: () => `<p>${tx('SR2E.App.Tours.theSystemLogsItsOwn')}<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>${tx('SR2E.App.Tours.theLogTabSays')}</p>`, target: '.sr2e-gm-undobar' },
  { id: 'scene', title: () => tx('SR2E.App.Tours.scene'), body: () => `<p>${tx('SR2E.App.Tours.backgroundCountWeatherTerrain')}</p>`, gmTab: 'scene', target: '.sr2e-gm-tabs [data-tab="scene"]' },
  { id: 'party', title: () => tx('SR2E.App.Tours.party'), body: () => `<p>${tx('SR2E.App.Tours.everyonesMonitorsAndPools')}</p>`, gmTab: 'party', target: '.sr2e-gm-tabs [data-tab="party"]' },
  { id: 'checklist', title: () => tx('SR2E.App.Tours.setupTheSessionChecklist'), body: () => `<p>${tx('SR2E.App.Tours.whatToDoAtTheStart')}</p>`, gmTab: 'setup', target: '.sr2e-checklist' },
  { id: 'players', title: () => tx('SR2E.App.Tours.playersAndTokens'), body: () => `<p>${tx('SR2E.App.Tours.giveEachPlayerTheirCharacter')}</p>`, gmTab: 'setup', target: '.sr2e-assign' },
  { id: 'kits', title: () => tx('SR2E.App.Tours.starterKits'), body: () => `<p>${tx('SR2E.App.Tours.bundlesOfItems')}</p>`, gmTab: 'setup', target: '.sr2e-kits' },
  { id: 'catalogue', title: () => tx('SR2E.App.Tours.theItemCatalogue'), body: () => `<p>${tx('SR2E.App.Tours.pasteRowsFromASpreadsheet')}</p>`, gmTab: 'setup', target: '.sr2e-catalogue' },
];

const ADD_STEPS: SR2Step[] = [
  { id: 'types', title: () => tx('SR2E.App.Tours.theAddWindow'), body: () => `<p>${tx('SR2E.App.Tours.aTabForEachKind')}</p>`, target: 'nav' },
  { id: 'search', title: () => tx('SR2E.App.Tours.findAndTick'), body: () => `<p>${tx('SR2E.App.Tours.searchTickWhatYouWant')}</p>`, target: '.sr2e-add-search' },
  { id: 'pay', title: () => tx('SR2E.App.Tours.howToPay'), body: () => `<p>${tx('SR2E.App.Tours.freeCharacterCreation')}</p>`, target: '.sr2e-add-payment' },
];

const TOURS: SR2TourDef[] = [
  { id: 'character-sheet', title: () => tx('SR2E.App.Tours.sr2eYourCharacterSheet'), description: () => tx('SR2E.App.Tours.theCharacterSheetTheSummary'), gm: false, window: 'sheet', steps: SHEET_STEPS },
  { id: 'add-window', title: () => tx('SR2E.App.Tours.sr2eAddingThings'), description: () => tx('SR2E.App.Tours.theAddWindowFinding'), gm: false, window: 'add', steps: ADD_STEPS },
  { id: 'gm-panel', title: () => tx('SR2E.App.Tours.sr2eTheGmPanel'), description: () => tx('SR2E.App.Tours.theGmPanelTheSession'), gm: true, window: 'gm', steps: GM_STEPS },
];

/** The character a tour shows: the user's own, else the first character they own. */
function tourActor(): any | null {
  const u: any = (game as any).user;
  if (u?.character) return u.character;
  return [...((game as any).actors ?? [])].find((a: any) => a.type === 'character' && a.isOwner) ?? null;
}

async function waitFor(fn: () => Element | null, ms = 2000): Promise<Element | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const el = fn();
    if (el) return el;
    await new Promise((r) => setTimeout(r, 50));
  }
  return fn();
}

/** Make the tour class (Foundry's Tour, found at run time). */
function tourClass(): any {
  const Base: any = (foundry as any).nue?.Tour ?? (globalThis as any).Tour;
  if (!Base) return null;
  return class SR2Tour extends Base {
    sr2e: SR2TourDef;
    constructor(def: SR2TourDef) {
      super({ title: def.title(), description: def.description(), canBeResumed: false, display: true, restricted: def.gm,
        steps: def.steps.map((s) => ({ id: s.id, title: s.title(), content: s.body(), selector: 'body', tooltipDirection: s.tooltipDirection ?? 'UP' })) }, { id: def.id, namespace: 'sr2e' });
      this.sr2e = def;
    }

    async start(): Promise<void> {
      if (this.sr2e.window !== 'gm' && !tourActor()) { ui.notifications.warn(tx('SR2E.Notify.Tours.thisTourShowsYourCharacterSheet')); return; }
      if (this.sr2e.gm && !(game as any).user?.isGM) { ui.notifications.warn(tx('SR2E.Notify.Tours.thatTourIsForTheGm')); return; }
      return super.start();
    }

    /** Open the window (and tab) the step is about, then aim the step at its target inside it. */
    async _preStep(): Promise<void> {
      await super._preStep?.();
      const step: any = this.currentStep;
      const def = this.sr2e.steps.find((s) => s.id === step?.id);
      if (!step || !def) return;
      let root: HTMLElement | null = null;
      if (this.sr2e.window === 'gm') {
        if (def.gmTab) SR2GmPanel.tab = def.gmTab;
        const p: any = SR2GmPanel.open();
        await p?.render?.({ force: true });
        root = (await waitFor(() => document.getElementById('sr2e-gm-panel'))) as HTMLElement | null;
      } else {
        const actor = tourActor();
        if (!actor) return;
        const sheet: any = actor.sheet;
        if (!sheet.rendered) await sheet.render({ force: true });
        if (this.sr2e.window === 'add') {
          const w: any = SR2AddWindow.show(actor, 'gear');
          root = (await waitFor(() => w?.element ?? null)) as HTMLElement | null;
        } else {
          if (def.tab) { try { sheet.changeTab?.(def.tab, 'primary', { force: true }); } catch { /* older sheets */ } }
          sheet.bringToFront?.();
          root = (await waitFor(() => sheet.element ?? null)) as HTMLElement | null;
        }
      }
      if (!root?.id) { step.selector = 'body'; return; }
      const inner = def.target ? root.querySelector(def.target) : root;
      step.selector = inner ? (def.target ? `#${CSS.escape(root.id)} ${def.target}` : `#${CSS.escape(root.id)}`) : `#${CSS.escape(root.id)}`;
    }
  };
}

const made = new Map<string, any>();

/** Register the tours (Settings → Tours). */
export function registerTours(): void {
  Hooks.once('ready', () => {
    const Cls = tourClass();
    const tours: any = (game as any).tours;
    if (!Cls || !tours?.register) return;
    for (const def of TOURS) {
      try { const t = new Cls(def); tours.register('sr2e', def.id, t); made.set(def.id, t); }
      catch (err) { console.warn(`sr2e | tour ${def.id}`, err); }
    }
  });
}

/** Start a tour by id (character-sheet, add-window, gm-panel). */
export async function startTour(id: string): Promise<boolean> {
  const t = made.get(id) ?? (game as any).tours?.get?.(`sr2e.${id}`);
  if (!t) { ui.notifications.warn(tx('SR2E.Notify.Tours.noTour', { id: escHtml(id) })); return false; }
  try { await t.reset?.(); } catch { /* fresh */ }
  await t.start();
  return true;
}
