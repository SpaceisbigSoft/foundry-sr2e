/**
 * v0.89.8: every SR2e tool in one place (the owner asked for "an easily accessible way to access all the tools").
 *  - The SR2e tools window: each tool the user may use, with a line on what it does and its hotkey; opened by Alt+T,
 *    the "SR2e tools" button in the Actors sidebar (every user), the guide window and the toolbar.
 *  - An SR2e group in Foundry's left toolbar (shown while a scene is on the canvas): the window and the most used tools,
 *    all buttons (the active canvas layer stays as it was).
 * The list is rules/tools.ts; the text `SR2E.Tools.*`.
 */

import { SYSTEM } from '../config/system.ts';
import { TOOLS, toolsFor, toolLabelKey, toolHintKey, bindingText, sceneControlSpec, type ToolDef } from '../rules/tools.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { runHotkey, HOTKEYS } from './hotkeys.ts';
import { openHelp } from './help.ts';
import { openBugReport } from './bugreport.ts';
import { startTour } from './tours.ts';
import { SR2GmPanel } from './ui.ts';
import { SR2NpcGenerator } from './npcgen.ts';
import { openSceneBuilder } from './scenebuilder.ts';
import { openAwardDialog } from './chat.ts';
import { SR2NewEntry } from './newentry.ts';
import { openShop } from './adding.ts';
import { SR2Codex } from './codex.ts';
import { SR2Interpretations } from './interpretations.ts';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const isGm = (): boolean => Boolean((game as any).user?.isGM);

/** An open window of a class, brought to the front (a second one with the same id would replace it on screen). */
function bringOpen(cls: any): boolean {
  for (const app of (foundry as any).applications?.instances?.values?.() ?? []) {
    if (app instanceof cls && app.rendered) {
      if (app.minimized) void app.maximize?.();
      app.bringToFront?.();
      return true;
    }
  }
  return false;
}

/** Open one of the system's settings menus (Configure Settings → a menu button) by its key; an open one comes forward. */
function openMenu(key: string): void {
  const menu = (game as any).settings?.menus?.get?.(`${SYSTEM.id}.${key}`);
  if (!menu?.type) return;
  if (menu.restricted && !isGm()) return;
  if (bringOpen(menu.type)) return;
  void new menu.type().render({ force: true });
}

/** The GM panel at one of its tabs. */
function gmPanelAt(tab: string): void {
  if (!isGm()) return;
  SR2GmPanel.tab = tab;
  SR2GmPanel.open();
}

/** What each tool does. A GM tool does nothing for a player (the window and toolbar never show it to one). */
export const TOOL_ACTIONS: Record<string, () => void> = {
  guide: () => { openHelp(); },
  sheet: () => { runHotkey('openSheet'); },
  defend: () => { runHotkey('defendNewest'); },
  resist: () => { runHotkey('resistNewest'); },
  initiative: () => { runHotkey('rollInitiative'); },
  endTurn: () => { runHotkey('endTurn'); },
  newestCard: () => { runHotkey('focusCard'); },
  rollPrivacy: () => { openMenu('rollPrivacyMenu'); },
  settings: () => {
    // Foundry's own Configure Settings window (the one its sidebar button opens), at the system's section.
    const app: any = (game as any).settings?.sheet;
    if (!app) return;
    void Promise.resolve(app.render({ force: true })).then(() => { try { app.changeTab?.('system', 'categories'); } catch { /* no such tab */ } });
  },
  tourSheet: () => { void startTour('character-sheet'); },
  tourAdding: () => { void startTour('add-window'); },
  bugReport: () => { openBugReport(); },
  shop: () => { void openShop(); },
  catalogue: () => { SR2Codex.open(); },
  newEntry: () => { SR2NewEntry.open({ actorUuid: String((game as any).user?.character?.uuid ?? '') }); },
  interpretations: () => { SR2Interpretations.open(); },
  gmPanel: () => { if (isGm()) SR2GmPanel.open(); },
  sceneBuilder: () => { if (isGm()) openSceneBuilder({ sceneId: '' }); },
  npcGenerator: () => { if (isGm()) SR2NpcGenerator.open(); },
  award: () => { if (isGm()) void openAwardDialog(); },
  calculator: () => gmPanelAt('tools'),
  undoLog: () => gmPanelAt('log'),
  requests: () => gmPanelAt('requests'),
  setup: () => gmPanelAt('setup'),
  houseRules: () => { openMenu('houseRulesMenu'); },
  skillWeb: () => { openMenu('skillWebMenu'); },
  macros: () => { if (isGm()) (game as any).packs?.get?.(`${SYSTEM.id}.sr2e-macros`)?.render?.(true); },
  tourGm: () => { if (isGm()) void startTour('gm-panel'); },
};

/** Run a tool by id (false when the id is unknown or the tool is the GM's and the user isn't). */
export function runTool(id: string): boolean {
  const def = TOOLS.find((t) => t.id === id);
  const f = TOOL_ACTIONS[id];
  if (!def || !f || (def.who === 'gm' && !isGm())) return false;
  f();
  return true;
}

/** A hotkey's current binding as text (the user may have changed it in Configure Controls), else its default. */
function hotkeyText(id: string | undefined): string {
  if (!id) return '';
  try {
    const bound = (game as any).keybindings?.get?.(SYSTEM.id, id);
    if (Array.isArray(bound)) return bindingText(bound[0]);
  } catch { /* not registered */ }
  const h = HOTKEYS.find((x) => x.id === id);
  return h ? bindingText({ key: h.key, modifiers: ['Alt'] }) : '';
}

const toolView = (t: ToolDef) => ({ id: t.id, icon: t.icon, hotkey: hotkeyText(t.hotkey), label: tKey(toolLabelKey(t.id)), hint: tKey(toolHintKey(t.id)) });

/** The SR2e tools window. */
export class SR2Tools extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: Record<string, any> = {
    id: 'sr2e-tools',
    classes: ['sr2e', 'sr2e-tools-window'],
    window: { title: 'SR2E.Tools.title', resizable: true, icon: 'fa-solid fa-toolbox' },
    position: { width: 560, height: 640 },
    actions: { runTool: SR2Tools.#onTool },
  };
  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/tools.hbs`, scrollable: ['.sr2e-tools'] } };

  static #instance: SR2Tools | null = null;
  static show(): SR2Tools {
    SR2Tools.#instance ??= new SR2Tools();
    const w: any = SR2Tools.#instance;
    if (w.minimized) void w.maximize?.();
    void w.render({ force: true });
    return SR2Tools.#instance;
  }

  async close(options?: any): Promise<any> {
    SR2Tools.#instance = null;
    return super.close(options);
  }

  async _prepareContext(_options: any): Promise<any> {
    const gm = isGm();
    const sections = [{ id: 'player', label: tx('SR2E.Tools.sectionPlayers'), tools: toolsFor(false).map(toolView) }];
    if (gm) sections.push({ id: 'gm', label: tx('SR2E.Tools.sectionGm'), tools: TOOLS.filter((t) => t.who === 'gm').map(toolView) });
    return { sections };
  }

  static #onTool(this: SR2Tools, _e: Event, target: HTMLElement) {
    runTool(target.dataset['tool'] ?? '');
  }
}

/** Open the SR2e tools window. */
export function openTools(): SR2Tools { return SR2Tools.show(); }

export function registerTools(): void {
  Hooks.on('getSceneControlButtons', (controls: any) => {
    try {
      if (!controls || typeof controls !== 'object' || Array.isArray(controls)) return;
      controls[SYSTEM.id] = sceneControlSpec(isGm(), { id: SYSTEM.id, openTools: () => { openTools(); }, runTool: (id) => { runTool(id); } });
    } catch (err) { console.warn('sr2e | toolbar group', err); }
  });
  // A button in the Actors sidebar for every user (the GM's own buttons sit beside it).
  Hooks.on('renderActorDirectory', (_app: any, html: HTMLElement) => {
    try {
      const root: HTMLElement = (html as any)?.querySelector ? html : (html as any)?.[0];
      if (!root || root.querySelector('[data-sr2e-action="openTools"]')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset['sr2eAction'] = 'openTools';
      btn.className = 'sr2e-award sr2e-tools-button';
      btn.innerHTML = `<i class="fa-solid fa-toolbox" aria-hidden="true"></i> ${tx('SR2E.Tools.title')}`;
      btn.addEventListener('click', (ev) => { ev.preventDefault(); openTools(); });
      const anchor = root.querySelector('.directory-footer, footer') ?? root.querySelector('.directory-header, header');
      (anchor ?? root).prepend(btn);
    } catch (err) { console.warn('sr2e | tools button', err); }
  });
}
