/**
 * v0.66.0: support for two popular modules, set up by the system when they are active (world setting
 * `moduleSupport`, on by default):
 * - Item Piles: nuyen as the currency (`system.nuyen`), item prices (`system.cost`, with the street index
 *   and cyberware grade as the Add window prices it), gear quantities, and which items aren't loot.
 * - Health Estimate: a token's health from the worse of its Physical and Stun tracks (vehicles: the
 *   condition track; IC: the Matrix monitor); hosts, sites, safehouses and barriers are left out.
 * - v0.91.7 (the owner, 11 Nov 2026: one theme per window): Monk's Enhanced Journal shows its own light parts next to
 *   Foundry's dark theme. When Foundry is dark, each user's Monk's backgrounds are set once to its own dark choices
 *   (world setting `moduleSupportLook`), only where they are still Monk's default; a user's own choice is kept.
 */
import { SYSTEM } from '../config/system.ts';
import { RULES, entryPrice, healthFraction, itemPilesConfig, NO_HEALTH_TYPES } from '../rules/index.ts';

/** Bump when the Item Piles setup changes (Item Piles re-applies it then, over the GM's own edits). */
export const ITEM_PILES_VERSION = '1.0.0';

function supportOn(): boolean {
  try { return Boolean(game.settings.get(SYSTEM.id, 'moduleSupport')); } catch { return true; }
}

/** Health Estimate's fraction (0 down … 1 unhurt) for a token, or 1 when it has no track. */
export function tokenHealth(token: any): number {
  const a = token?.actor;
  if (!a) return 1;
  const f = healthFraction(a, { people: Number(RULES.TOKENS.monitorBoxes ?? 10), vehicle: Number(RULES.VEHICLES.conditionBoxes ?? 10), matrix: Number(RULES.MATRIX.monitorBoxes ?? 10) });
  return f ?? 1;
}

/** Point Health Estimate's provider at the SR2 tracks (it reads `system.attributes.hp` otherwise). */
function patchHealthEstimate(): boolean {
  const he: any = (game as any).healthEstimate;
  const p: any = he?.provider;
  if (!p) return false;
  p.fraction = (token: any) => tokenHealth(token);
  p.filteredTypes = [...new Set([...(Array.isArray(p.filteredTypes) ? p.filteredTypes : []), ...NO_HEALTH_TYPES])];
  // Zero-max-HP checks read attributes.hp.max: we have no such field, so never break on it.
  p.breakAttribute = () => undefined;
  return true;
}

/** Register the system with Item Piles (called on its ready hook). */
function registerItemPiles(): void {
  const api: any = (game as any).itempiles?.API;
  if (!api?.addSystemIntegration) return;
  const cfg: any = itemPilesConfig({ version: ITEM_PILES_VERSION, nuyenImg: 'icons/svg/coins.svg' });
  // A price per item (Item Piles multiplies by the quantity itself).
  cfg.ITEM_COST_TRANSFORMER = (item: any) => {
    const s = item?.system ?? {};
    const sys = typeof s.toObject === 'function' ? s.toObject() : s;
    return entryPrice(item?.type ?? 'gear', sys, 1);
  };
  try { api.addSystemIntegration(cfg, String((game as any).system?.version ?? 'latest')); }
  catch (err) { console.warn('sr2e | Item Piles integration', err); }
}

/** Hooks for the module integrations (call at init). */
/** Monk's Enhanced Journal's own dark, consistent look (its per-user settings and the choice for each). */
export const MEJ_ID = 'monks-enhanced-journal';
export const MEJ_DARK: Readonly<Record<string, string>> = { 'background-colour': 'black', 'background-image': 'solidBlack', 'sidebar-image': 'solidBlack' };

/**
 * Pure: which of Monk's settings to set: each still at its default ('none') whose dark choice Monk's still offers
 * (`choices` null = the setting isn't there, e.g. a later version renamed it).
 */
export function mejDarkChanges(current: Record<string, unknown>, choices: Record<string, string[] | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, want] of Object.entries(MEJ_DARK)) {
    const list = choices[key];
    if (!list || !list.includes(want)) continue;
    if (String(current[key] ?? 'none') === 'none') out[key] = want;
  }
  return out;
}

/** Whether Foundry shows its windows dark (its colour scheme, or the browser's when it follows that). */
function foundryDark(): boolean {
  let scheme = '';
  try { scheme = String((game as any).settings.get('core', 'uiConfig')?.colorScheme?.applications ?? ''); } catch { /* older Foundry */ }
  if (scheme) return scheme === 'dark';
  // Following the browser: Foundry marks the page with the scheme it resolved.
  return Boolean(globalThis.document?.body?.classList?.contains('theme-dark'));
}

/** Once per user (while Foundry is dark): Monk's Enhanced Journal's own dark backgrounds, where still at its default. */
export async function matchModuleLook(): Promise<Record<string, string>> {
  const g: any = game;
  let on = true;
  try { on = Boolean(g.settings.get(SYSTEM.id, 'moduleSupportLook')); } catch { /* not registered */ }
  if (!on || !g.modules?.get?.(MEJ_ID)?.active || !foundryDark()) return {};
  let done: any = {};
  try { done = g.settings.get(SYSTEM.id, 'moduleLookDone') ?? {}; } catch { /* not registered */ }
  if (done?.[MEJ_ID]) return {};
  const current: Record<string, unknown> = {};
  const choices: Record<string, string[] | null> = {};
  for (const key of Object.keys(MEJ_DARK)) {
    const def: any = g.settings.settings?.get?.(`${MEJ_ID}.${key}`);
    choices[key] = def?.choices ? Object.keys(def.choices) : null;
    try { current[key] = g.settings.get(MEJ_ID, key); } catch { choices[key] = null; }
  }
  const changes = mejDarkChanges(current, choices);
  for (const [key, value] of Object.entries(changes)) {
    try { await g.settings.set(MEJ_ID, key, value); } catch (err) { console.warn('sr2e | module look', key, err); }
  }
  try { await g.settings.set(SYSTEM.id, 'moduleLookDone', { ...(done ?? {}), [MEJ_ID]: true }); } catch { /* not registered */ }
  return changes;
}

export function registerModuleSupport(): void {
  Hooks.once('ready', () => { void matchModuleLook(); });
  Hooks.once('item-piles-ready', () => { if (supportOn()) registerItemPiles(); });
  Hooks.once('ready', () => {
    if (!supportOn()) return;
    if ((game as any).modules?.get?.('healthEstimate')?.active && !patchHealthEstimate()) {
      // Health Estimate makes its provider at setup; try once more after the canvas is up.
      Hooks.once('canvasReady', () => { patchHealthEstimate(); });
    }
  });
}

/** Whether a token's actor is an Item Piles pile (so the GM panel can leave it out of NPC lists). */
export function isItemPile(actor: any): boolean {
  return Boolean(actor?.flags?.['item-piles']?.data?.enabled);
}
