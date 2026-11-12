/**
 * v0.89.8: every SR2e tool in one list, for the SR2e tools window and the SR2e group in Foundry's left toolbar
 * (applications/tools.ts). Pure: the ids, icons, who sees each tool and its hotkey; what a tool does is in
 * applications/tools.ts (`TOOL_ACTIONS`), its text in lang/en.json (`SR2E.Tools.<id>.label` / `.hint`).
 */

export interface ToolDef {
  id: string;
  /** Font Awesome classes. */
  icon: string;
  /** 'player': everyone sees it; 'gm': the GM only. */
  who: 'player' | 'gm';
  /** Also a button in the left toolbar's SR2e group (the most used ones; the window lists them all). */
  toolbar: boolean;
  /** The hotkey's id (applications/hotkeys.ts HOTKEYS); the window shows its current binding. */
  hotkey?: string;
}

export const TOOLS: readonly ToolDef[] = [
  // Everyone
  { id: 'guide', icon: 'fa-solid fa-book-open', who: 'player', toolbar: true, hotkey: 'openGuide' },
  { id: 'sheet', icon: 'fa-solid fa-id-card', who: 'player', toolbar: true, hotkey: 'openSheet' },
  // v0.91.1: the shop (the Add window, set to buy) for your character (the GM: the selected token).
  { id: 'shop', icon: 'fa-solid fa-store', who: 'player', toolbar: true },
  // v0.91.3: the Catalogue: browse everything you can get, a page per entry.
  { id: 'catalogue', icon: 'fa-solid fa-book-atlas', who: 'player', toolbar: true },
  { id: 'defend', icon: 'fa-solid fa-shield-halved', who: 'player', toolbar: true, hotkey: 'defendNewest' },
  { id: 'resist', icon: 'fa-solid fa-heart-pulse', who: 'player', toolbar: true, hotkey: 'resistNewest' },
  { id: 'initiative', icon: 'fa-solid fa-dice-d6', who: 'player', toolbar: true, hotkey: 'rollInitiative' },
  { id: 'endTurn', icon: 'fa-solid fa-forward-step', who: 'player', toolbar: true, hotkey: 'endTurn' },
  { id: 'newestCard', icon: 'fa-solid fa-message', who: 'player', toolbar: false, hotkey: 'focusCard' },
  { id: 'rollPrivacy', icon: 'fa-solid fa-eye-slash', who: 'player', toolbar: false },
  { id: 'settings', icon: 'fa-solid fa-palette', who: 'player', toolbar: false },
  { id: 'tourSheet', icon: 'fa-solid fa-person-chalkboard', who: 'player', toolbar: false },
  { id: 'tourAdding', icon: 'fa-solid fa-person-chalkboard', who: 'player', toolbar: false },
  { id: 'bugReport', icon: 'fa-solid fa-bug', who: 'player', toolbar: true },
  // v0.91.1: make a new entry (a player's goes to the GM).
  { id: 'newEntry', icon: 'fa-solid fa-file-circle-plus', who: 'player', toolbar: false },
  // v0.92.0: the rules interpretations (every † in one list).
  { id: 'interpretations', icon: 'fa-solid fa-scale-unbalanced', who: 'player', toolbar: false },
  // GM
  { id: 'gmPanel', icon: 'fa-solid fa-sliders', who: 'gm', toolbar: true, hotkey: 'gmPanel' },
  { id: 'sceneBuilder', icon: 'fa-solid fa-map-location-dot', who: 'gm', toolbar: true },
  { id: 'npcGenerator', icon: 'fa-solid fa-user-plus', who: 'gm', toolbar: true },
  { id: 'award', icon: 'fa-solid fa-award', who: 'gm', toolbar: true },
  { id: 'calculator', icon: 'fa-solid fa-calculator', who: 'gm', toolbar: false },
  { id: 'undoLog', icon: 'fa-solid fa-clock-rotate-left', who: 'gm', toolbar: false },
  { id: 'requests', icon: 'fa-solid fa-user-check', who: 'gm', toolbar: false },
  { id: 'setup', icon: 'fa-solid fa-screwdriver-wrench', who: 'gm', toolbar: false },
  { id: 'houseRules', icon: 'fa-solid fa-scale-balanced', who: 'gm', toolbar: true },
  { id: 'skillWeb', icon: 'fa-solid fa-diagram-project', who: 'gm', toolbar: false },
  { id: 'macros', icon: 'fa-solid fa-scroll', who: 'gm', toolbar: false },
  { id: 'tourGm', icon: 'fa-solid fa-person-chalkboard', who: 'gm', toolbar: false },
];

/** The tools a user sees: everyone's, then the GM's for a GM. */
export function toolsFor(gm: boolean): ToolDef[] {
  return TOOLS.filter((t) => gm || t.who === 'player');
}

export const toolLabelKey = (id: string): string => `SR2E.Tools.${id}.label`;
export const toolHintKey = (id: string): string => `SR2E.Tools.${id}.hint`;

/** A key binding as text ("Alt+H"): its modifiers, then the key without Foundry's "Key"/"Digit" prefix. */
export function bindingText(b: { key?: string; modifiers?: string[] } | null | undefined): string {
  if (!b?.key) return '';
  const key = String(b.key).replace(/^Key|^Digit/, '');
  return [...(b.modifiers ?? []), key].join('+');
}

/**
 * The SR2e group for Foundry's left toolbar (v14 `getSceneControlButtons`: controls and tools are records). Every tool
 * is a button. It has no canvas layer of its own: the layer that was active stays active (usually the tokens), so the
 * map works as before while the group is open. (A group that activated the token layer would be sent straight back to
 * the Token controls: activating a layer selects its own control.)
 */
export function sceneControlSpec(gm: boolean, o: { id: string; openTools: () => void; runTool: (id: string) => void }): Record<string, any> {
  const tools: Record<string, any> = {
    allTools: { name: 'allTools', order: 0, title: 'SR2E.Tools.allTools', icon: 'fa-solid fa-toolbox', button: true, onChange: () => o.openTools() },
  };
  let order = 1;
  for (const t of toolsFor(gm).filter((x) => x.toolbar)) {
    tools[t.id] = { name: t.id, order: order++, title: toolLabelKey(t.id), icon: t.icon, button: true, onChange: () => o.runTool(t.id) };
  }
  return { name: o.id, order: 20, title: 'SR2E.Tools.title', icon: 'fa-solid fa-toolbox', tools };
}
