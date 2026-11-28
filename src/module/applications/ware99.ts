/**
 * v0.99.0 rules completeness, cyberware and bioware effects: the Foundry side of rules/ware99.ts (RULES.WARE_V99).
 *
 * - Ware that may not be installed together (SSC p. 87: boosted reflexes with wired reflexes or a control rig;
 *   Shadowtech p. 17: orthoskin with dermal plating): `preUpdateItem` and `preCreateItem` hooks keep a player's item
 *   out (the `installed` change is dropped, a new item is created uninstalled), with a warning; a GM is only warned.
 *   `surgeryClash` lets the surgery button refuse the same way.
 * - Leading with a cyberlimb in melee (Cybertechnology p. 50): `limbLeadModifier`, the attack's TN modifier.
 *
 * This only keeps a player from putting the pair in on their own character: the sheet still counts only the better
 * of orthoskin and plating (rules/ware99.ts orthoPlating) and the better reflexes (the stacking rule) whatever got in.
 * It imports nothing from documents/ or the sheets (they call into this file).
 */
import { escHtml } from '../rules/html.ts';
import { tKey } from '../helpers/i18n.ts';
import * as W from '../rules/ware99.ts';

const g = (): any => globalThis as any;
const num = (x: unknown): number => (Number.isFinite(Number(x)) ? Number(x) : 0);

/** The other cyberware and bioware on the item's actor. */
function othersOf(item: any): W.Ware99[] {
  const actor = item?.parent;
  if (!actor || actor.documentName === 'Item' || !actor.items) return [];
  return [...actor.items].filter((i: any) => i?.type === 'cyberware' && i.id !== item.id);
}

/** The item as it would be after `change` (only the fields the rules read). */
function merged(item: any, change: any): W.Ware99 {
  const sys = { ...(item?.system ?? {}), ...(change?.system ?? {}) };
  return { id: item?.id, name: String(change?.name ?? item?.name ?? ''), type: item?.type, system: sys };
}

/** The refusal for installing `item` (with `change` applied) on its actor, or null. */
export function wareClash(item: any, change: any, create = false): { why: string; other: string } | null {
  if (item?.type !== 'cyberware') return null;
  const goingIn = create ? Boolean(change?.system?.installed ?? item?.system?.installed) : change?.system?.installed === true && !item?.system?.installed;
  if (!goingIn) return null;
  return W.installClash(merged(item, change), othersOf(item));
}

const isGm = (userId?: string): boolean => Boolean(g().game?.users?.get?.(userId)?.isGM ?? (userId === undefined && g().game?.user?.isGM));
const warn = (c: { why: string; other: string }, item: any): void => {
  g().ui?.notifications?.warn?.(escHtml(tKey(c.why, { name: String(item?.name ?? ''), other: c.other })));
};

/** preUpdateItem: a player's ware that may not go in beside what is there stays out; a GM is only warned. False: nothing left. */
export function preUpdateWare(item: any, change: any, userId?: string): false | void {
  const c = wareClash(item, change);
  if (!c) return;
  warn(c, item);
  if (isGm(userId)) return;
  delete change.system.installed;
  if (!Object.keys(change.system).length) delete change.system;
  if (!Object.keys(change).filter((k) => k !== '_id').length) return false;
}

/** preCreateItem: such ware created installed on a player's actor is created uninstalled; a GM is only warned. */
export function preCreateWare(item: any, data: any, userId?: string): void {
  const c = wareClash(item, data ?? {}, true);
  if (!c) return;
  warn(c, item);
  if (isGm(userId)) return;
  item.updateSource?.({ 'system.installed': false });
}

/**
 * Surgery on ware that may not go in beside what the patient has: true when refused (a player; warned). A GM is only
 * warned and may go on.
 */
export function surgeryClash(item: any): boolean {
  const c = item?.system?.installed ? null : W.installClash({ id: item?.id, name: item?.name, type: item?.type, system: { ...(item?.system ?? {}), installed: true } }, othersOf(item));
  if (!c) return false;
  warn(c, item);
  return !g().game?.user?.isGM;
}

/**
 * The TN modifier for a melee attack led with a cyberlimb (Cybertechnology p. 50): the limb's Strength over the four
 * limbs' average (natural limbs at the character's Strength). Null when it adds nothing.
 */
export function limbLeadModifier(actor: any, limbName: string, limbStrength: number): { id: string; label: string; value: number } | null {
  if (!limbName || !W.w99('limbLead')) return null;
  const limbs = [...(actor?.system?.derived?.cyber?.limbs ?? [])];
  const average = W.fourLimbAverage(limbs, num(actor?.system?.attributes?.strength?.total), 'strength');
  const value = W.limbLeadTn(limbStrength, average);
  return value > 0 ? { id: 'limbLead99', label: tKey('SR2E.Ware99.Mod.limbLead', { limb: limbName, average }), value } : null;
}

export function registerWare99(): void {
  const H = g().Hooks;
  H?.on?.('preUpdateItem', (item: any, change: any, _opts: any, userId: string) => preUpdateWare(item, change, userId));
  H?.on?.('preCreateItem', (item: any, data: any, _opts: any, userId: string) => preCreateWare(item, data, userId));
}
