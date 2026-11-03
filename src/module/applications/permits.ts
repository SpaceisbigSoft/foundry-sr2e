/**
 * v0.91.5: permits on the sheets (RULES.SHOP_V915.permits). With 'buy', a player gets a permit through "Get a permit…"
 * (`SR2Actor.getPermit`: a cost and a wait) and the Permit box is the GM's: ticking it on from a player's sheet is
 * refused here (unticking is fine). Like the other sheet locks this is a table rule the GM can see being kept (the
 * player owns the item), not a security boundary.
 */
import { SYSTEM } from '../config/system.ts';
import { permitTickLocked, permitCategory, permitPlan, permitsBought, legalWarning, legalityId, permitSource } from '../rules/legalbuy.ts';
import { timeLabel } from '../rules/waiting.ts';
import { wareCost } from '../rules/index.ts';
import { t as tx } from '../helpers/i18n.ts';
import { requestsOf } from './approvals.ts';

/**
 * Drop a player's "Permit on" from a sheet edit (flattened changes, changed in place); true when the edit was changed.
 * v0.91.5 review (R1): a player changing a permitted thing's legality loses the permit (it was for the old legality).
 */
export function refusePermitTick(doc: any, changes: Record<string, unknown>): boolean {
  if (!permitTickLocked({ isGM: Boolean(game.user?.isGM) })) return false;
  const has = (k: string) => Object.prototype.hasOwnProperty.call(changes, k);
  if (has('system.legality') && String(changes['system.legality'] ?? '') !== String(doc?.system?.legality ?? '') && doc?.system?.permit && changes['system.permit'] !== false) {
    changes['system.permit'] = false;
    ui.notifications?.warn?.(tx('SR2E.Notify.Legal.legalityChanged'));
    return true;
  }
  if (!has('system.permit')) return false;
  if (!changes['system.permit'] || doc?.system?.permit) return false;
  delete changes['system.permit'];
  ui.notifications?.warn?.(tx('SR2E.Notify.Legal.tickLocked'));
  return true;
}

/** The cost an item's or vehicle's permit is worked out from (its own cost; cyberware by its grade). */
export function permitBaseCost(doc: any): number {
  if (doc?.type === 'cyberware') return wareCost(doc.system ?? {});
  return Math.max(0, Number(doc?.system?.cost ?? 0) || 0);
}

/**
 * The sheet's permit row: whether the Permit box is shown and editable, the Get a permit… button (with its cost and
 * time), and the warning for holding it without one. `canGet`: the sheet may offer the button (an item on a character
 * or NPC; a vehicle with a payer).
 */
export function permitSheetContext(doc: any, o: { canGet: boolean; underWay?: boolean; requested?: boolean; licence?: { by: string; fake: boolean } | null }): { show: boolean; tickable: boolean; button: boolean; buttonTitle: string; warning: string; underWay: boolean; requested: boolean; licence: string } {
  const sy = doc?.system ?? {};
  const legality = legalityId(sy.legality);
  const show = permitCategory(legality);
  const isGM = Boolean(game.user?.isGM);
  const plan = show ? permitPlan({ legality, cost: permitBaseCost(doc) }) : null;
  const realLicence = o.licence && !o.licence.fake ? o.licence.by : '';
  const button = Boolean(show && plan && !sy.permit && !realLicence && o.canGet && !o.underWay && !o.requested && (permitsBought() || isGM) && doc?.isOwner);
  return {
    show,
    // The box: the GM's with 'buy' (a player may still untick it); anyone's with 'tick'.
    tickable: !permitTickLocked({ isGM }) || Boolean(sy.permit),
    button,
    buttonTitle: plan ? tx('SR2E.App.Legal.getPermitTitle', { cost: plan.cost.toLocaleString(), time: timeLabel(plan.hours) }) : '',
    warning: legalWarning({ legality, permit: Boolean(sy.permit), rating: sy.rating, licence: o.licence?.by ?? '' }),
    underWay: Boolean(o.underWay),
    requested: Boolean(o.requested) && !o.underWay,
    licence: o.licence ? (o.licence.fake ? tx('SR2E.App.Legal.coveredFake', { by: o.licence.by }) : tx('SR2E.App.Legal.covered', { by: o.licence.by })) : '',
  };
}

/** Is a permit for this reference under way on the actor (a permit project)? */
export function permitUnderWay(actor: any, ref: string): boolean {
  const src = ref.startsWith('item:') ? permitSource('item', ref.slice(5)) : ref.startsWith('vehicle:') ? permitSource('vehicle', ref.slice(8)) : '';
  const projects = actor?.flags?.[SYSTEM.id]?.projects;
  if (!src || !projects || typeof projects !== 'object') return false;
  return Object.values(projects).some((p: any) => p && p.kind === 'permit' && p.source === src);
}

/** Who pays for a vehicle's permit from its sheet: the character who bought it (if this user owns them), else this user's character. */
export function vehiclePermitPayer(vehicle: any): any | null {
  const by = vehicle?.flags?.[SYSTEM.id]?.boughtBy;
  const buyer: any = by ? (globalThis as any).fromUuidSync?.(String(by)) : null;
  if (buyer?.isOwner && (buyer.type === 'character' || buyer.type === 'npc')) return buyer;
  const mine: any = game.user?.character;
  return mine?.isOwner && (mine.type === 'character' || mine.type === 'npc') ? mine : null;
}

/** v0.91.5 review (N7): is a permit request for this reference waiting in the approval queue? */
export function permitRequested(actor: any, ref: string): boolean {
  return requestsOf(actor).some((r: any) => r?.data?.method === 'getPermit' && Array.isArray(r.data.args) && r.data.args[0] === ref);
}

/** The sheet's permit row for an item on an actor, or a vehicle paid for by `payer`. */
export function permitRowFor(doc: any, payer: any, ref: string): ReturnType<typeof permitSheetContext> {
  const ok = Boolean(payer && (payer.type === 'character' || payer.type === 'npc'));
  return permitSheetContext(doc, {
    canGet: ok,
    underWay: ok ? permitUnderWay(payer, ref) : false,
    requested: ok ? permitRequested(payer, ref) : false,
    licence: ok ? payer.licenceCover?.(String(doc?.name ?? ''), legalityId(doc?.system?.legality)) ?? null : null,
  });
}
