/**
 * v0.99.0 rules completeness, cyberware and bioware effects: the Foundry side of rules/ware99.ts (RULES.WARE_V99).
 *
 * - Ware that may not be installed together (SSC p. 87: boosted reflexes with wired reflexes or a control rig;
 *   Shadowtech p. 17: orthoskin with dermal plating): `preUpdateItem` and `preCreateItem` hooks keep a player's item
 *   out (the `installed` change is dropped, a new item is created uninstalled), with a warning; a GM is only warned.
 *   `surgeryClash` lets the surgery button refuse the same way.
 * - Leading with a cyberlimb in melee (Cybertechnology p. 50): `limbLeadModifier`, the attack's TN modifier.
 *
 * The refusals run on the writer's client: the lead GM whispers the GMs when a player's write still leaves a pair in
 * (noticeInstalledPair; no write). Inside a GM's re-run of a player's card the player's rules apply (actingAuthor).
 * This only keeps a player from putting the pair in on their own character: the sheet still counts only the better
 * of orthoskin and plating (rules/ware99.ts orthoPlating) and the better reflexes (the stacking rule) whatever got in.
 * It imports nothing from documents/ or the sheets (they call into this file).
 */
import { escHtml } from '../rules/html.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import * as W from '../rules/ware99.ts';
import { isLeadGm } from './leader.ts';

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

/**
 * The author a GM's re-run of a player's card acts for (SR2Actor.actingAuthor), when that author is not a GM: inside
 * such a run the write is the player's, whoever's client makes it (v0.99.0 fix C7).
 */
function actingPlayer(): any {
  const a: any = g().CONFIG?.Actor?.documentClass?.actingAuthor ?? null;
  return a && !a.isGM ? a : null;
}
const isGm = (userId?: string): boolean => !actingPlayer() && Boolean(g().game?.users?.get?.(userId)?.isGM ?? (userId === undefined && g().game?.user?.isGM));
/** The refusal as a warning, its values escaped where they are passed (as the other v0.9x notifications do). */
const warn = (c: { why: string; other: string }, item: any): void => {
  const n = g().ui?.notifications;
  const name = escHtml(String(item?.name ?? ''));
  const other = escHtml(c.other);
  if (c.why === W.PAIR_KEY('boostedVcr')) n?.warn?.(tx('SR2E.Ware99.Refuse.boostedVcr', { name, other }));
  else if (c.why === W.PAIR_KEY('orthoPlating')) n?.warn?.(tx('SR2E.Ware99.Refuse.orthoPlating', { name, other }));
  else n?.warn?.(tx('SR2E.Ware99.Refuse.boostedWired', { name, other }));
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
  return !isGm();
}

/**
 * The ware a pair on `item`'s actor clashes with once it is in (the install refusals above run on the writer's client
 * only), or null. Reads the item as it is now.
 */
export function installedClash(item: any): { why: string; other: string } | null {
  if (item?.type !== 'cyberware' || !item?.system?.installed) return null;
  return W.installClash({ id: item.id, name: item.name, type: item.type, system: item.system }, othersOf(item));
}

/**
 * updateItem / createItem on the lead GM (v0.99.0 fix S9): a player's write that leaves such a pair installed (their
 * client skipped the refusal) gets a whisper to the GMs. Nothing is written to the item or the actor.
 */
export async function noticeInstalledPair(item: any, change: any, userId: string | undefined, create = false): Promise<boolean> {
  if (!g().game?.user?.isGM || !isLeadGm()) return false;
  if (!create && change?.system?.installed !== true) return false;
  if (Boolean(g().game?.users?.get?.(userId)?.isGM)) return false;
  const c = installedClash(item);
  if (!c) return false;
  const who = g().game?.users?.get?.(userId);
  const gms = [...(g().game?.users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);
  await g().ChatMessage?.create?.({ whisper: gms, content: `<p>${tx('SR2E.Ware99.Gm.pairInstalled', { user: escHtml(String(who?.name ?? '')), actor: escHtml(String(item?.parent?.name ?? '')), name: escHtml(String(item?.name ?? '')), other: escHtml(c.other) })}</p>` });
  return true;
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
  H?.on?.('updateItem', (item: any, change: any, _opts: any, userId: string) => { void noticeInstalledPair(item, change, userId).catch(() => {}); });
  H?.on?.('createItem', (item: any, _opts: any, userId: string) => { void noticeInstalledPair(item, null, userId, true).catch(() => {}); });
}
