/**
 * v0.66.0: support for two popular modules, set up by the system when they are active (world setting
 * `moduleSupport`, on by default):
 * - Item Piles: nuyen as the currency (`system.nuyen`), item prices (`system.cost`, with the street index
 *   and cyberware grade as the Add window prices it), gear quantities, and which items aren't loot.
 * - Health Estimate: a token's health from the worse of its Physical and Stun tracks (vehicles: the
 *   condition track; IC: the Matrix monitor); hosts, sites, safehouses and barriers are left out.
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
export function registerModuleSupport(): void {
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
