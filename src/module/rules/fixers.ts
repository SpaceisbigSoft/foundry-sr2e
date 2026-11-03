/**
 * v0.91.6: finding things through contacts and fixers (the owner's decisions, 2 Nov 2026). Pure rules over
 * RULES.SHOP_V916 (rules/config91.ts): who can help, how a contact's help works on the character's own find (as
 * legwork does: closer contacts add dice, paid dice up to Loyalty, favours, the contact's own dice), what happens to
 * the "found openly" legality row, and what a fixer's own find costs and takes. The Foundry glue is the find test
 * `SR2Actor.#findCore` (documents/index.ts) and the "Find through…" dialog (applications/through.ts). All numbers
 * VERIFY.
 */
import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { legalFindMods, legalFindTimeFactor, legalityId, LEGAL_FIND_MOD } from './legalbuy.ts';
import { legalityOf } from './outfit.ts';
import { legworkLevelDice } from './upkeep.ts';
import { paidDice } from './street.ts';
import { callFavour, contactDigSuccesses } from './remnants.ts';
import { t as tx } from '../helpers/i18n.ts';

const S = () => RULES.SHOP_V916;

/** v0.91.6 review (R3): a contact's or fixer's own dice are capped (the contact form is the player's to edit). */
export const MAX_CONTACT_DICE = 30;

/** How a find goes: the character alone, helped by a contact, or a fixer's own find. */
export type ThroughMode = 'self' | 'help' | 'fixer';

/** A "Find through…" choice as the dialog gives it (checked again by `throughPlan`). */
export interface FindThrough {
  contactId: string;
  mode: 'help' | 'fixer';
  /** Nuyen paid for extra dice (one per RULES.STREET.contacts.nuyenPerDie, at most their Loyalty). */
  pay?: number;
  /** Call in a favour (extra dice; may waive the contact's fee). */
  favour?: boolean;
  /** A helping contact with dice of their own rolls too (default yes). */
  digs?: boolean;
}

/** The contact fields this reads (system.contacts rows). */
export interface ContactRow {
  id: string;
  name: string;
  level?: number;
  loyalty?: number;
  fee?: number;
  dice?: number;
  favours?: number;
  fixer?: boolean;
}

/** Is finding through contacts on (RULES.SHOP_V916.through)? */
export function throughOn(): boolean {
  return S().through === 'on';
}

/** Is this contact marked as a fixer (their own find is offered)? */
export function isFixer(c: Pick<ContactRow, 'fixer'> | null | undefined): boolean {
  return Boolean(c?.fixer);
}

/** A contact's level, 1–3. */
function level(c: Pick<ContactRow, 'level'>): number {
  return Math.min(3, Math.max(1, Math.floor(Number(c.level) || 1)));
}

/** The legality row for a find made this way: the openly found row, scaled (rounded down), or none. */
export function throughLegalMods(legality: unknown, mode: ThroughMode): TargetNumberModifier[] {
  const base = legalFindMods(legality);
  if (mode === 'self' || !base.length) return base;
  const share = Math.max(0, Number(mode === 'fixer' ? S().fixerLegalShare : S().contactLegalShare) || 0);
  const v = Math.floor(base[0]!.value * share);
  if (!v) return [];
  // The category's own label ("Restricted"), not the openly-found row's ("Restricted (found openly)").
  const cat = legalityOf(legalityId(legality)).label;
  const label = mode === 'fixer' ? tx('SR2E.Card.Mod.legalityFixer', { label: cat }) : tx('SR2E.Card.Mod.legalityContact', { label: cat });
  return [{ ...base[0]!, id: LEGAL_FIND_MOD, value: v, label }];
}

/**
 * How many times the Availability time this find takes: the legality's factor (dropped for a fixer whose legal share
 * is 0), and for a fixer RULES.SHOP_V916.fixerTime on top.
 */
export function throughTimeFactor(legality: unknown, mode: ThroughMode): number {
  if (mode !== 'fixer') return legalFindTimeFactor(legality);
  const legal = (Number(S().fixerLegalShare) || 0) > 0 ? legalFindTimeFactor(legality) : 1;
  const f = Number(S().fixerTime);
  return legal * (Number.isFinite(f) && f > 0 ? f : 1);
}

/** The fixer's cut on a price (rounded). */
export function fixerFeeOf(price: number): number {
  return Math.max(0, Math.round(Math.max(0, Number(price) || 0) * Math.max(0, Number(S().fixerFee) || 0)));
}

/** The dice a fixer rolls on their own find: their own dice, or their level × RULES.SHOP_V916.fixerDicePerLevel. */
export function fixerDice(c: Pick<ContactRow, 'dice' | 'level'>): number {
  const own = Math.max(0, Math.floor(Number(c.dice) || 0));
  return Math.min(MAX_CONTACT_DICE, own > 0 ? own : level(c) * Math.max(0, Math.floor(Number(S().fixerDicePerLevel) || 0)));
}

/**
 * Under the old legwork rule (RULES.BOOK_V78.legwork.mode not 'book') a closer contact lowers the TN instead of adding
 * dice: −RULES.UPKEEP.contacts.tnPerLevel for each level above 1.
 */
export function contactLevelTnMods(c: Pick<ContactRow, 'level'>): TargetNumberModifier[] {
  if (RULES.BOOK_V78.legwork.mode === 'book') return [];
  const v = -(level(c) - 1) * Math.max(0, Number(RULES.UPKEEP.contacts.tnPerLevel) || 0);
  return v ? [{ id: 'contactLevel', label: tx('SR2E.Card.Mod.contactLevel'), value: v }] : [];
}

/** What going through a contact brings, worked out from the contact row (never from the dialog's numbers). */
export interface ThroughPlan {
  mode: 'help' | 'fixer';
  contact: ContactRow;
  /** Extra dice on the roll: closer contact, paid and favour dice. For a fixer, their dice plus paid and favour dice. */
  dice: number;
  /** The parts of `dice`, for the card. */
  closer: number; bought: number; favourDice: number;
  /** The contact's own dice when they dig too (help only; 0 = none). */
  theirDice: number;
  /** Nuyen paid now: the contact's fee (unless a favour waives it) and the pay for dice. */
  payNow: number; fee: number; pay: number;
  /** A fixer's cut on the price is waived (a favour called in, with RULES.STREET.contacts.favourWaivesFee). */
  waiveCut: boolean;
  /** The favour called in (null = none); `after` is the contact's favour count afterwards. */
  favour: { after: number; debt: boolean } | null;
  /** Why it can't be done ('' = it can). */
  refused: '' | 'noContact' | 'notFixer' | 'tooManyFavours';
}

/** Work out a "Find through…" choice against the character's contacts (a stale or forged choice is refused). */
export function throughPlan(contacts: ReadonlyArray<ContactRow> | null | undefined, choice: FindThrough): ThroughPlan {
  const c = (contacts ?? []).find((x) => x && x.id === choice.contactId);
  const empty = { dice: 0, closer: 0, bought: 0, favourDice: 0, theirDice: 0, payNow: 0, fee: 0, pay: 0, waiveCut: false, favour: null };
  if (!c) return { mode: choice.mode, contact: { id: '', name: '' }, ...empty, refused: 'noContact' };
  if (choice.mode === 'fixer' && !isFixer(c)) return { mode: choice.mode, contact: c, ...empty, refused: 'notFixer' };
  const fav = choice.favour ? callFavour(Number(c.favours) || 0) : null;
  if (fav?.refused) return { mode: choice.mode, contact: c, ...empty, refused: 'tooManyFavours' };
  const pay = Math.max(0, Math.floor(Number(choice.pay) || 0));
  const bought = paidDice(pay, Number(c.loyalty) || 1);
  // Only what buys dice is paid (paying past the Loyalty cap buys nothing).
  const payUsed = bought * Math.max(1, RULES.STREET.contacts.nuyenPerDie);
  const favourDice = fav?.dice ?? 0;
  // The contact's own fee is for a helping contact (as legwork); a fixer's cut is on the price (fixerFeeOf).
  const fee = choice.mode === 'help' && !fav?.waiveFee ? Math.max(0, Math.floor(Number(c.fee) || 0)) : 0;
  const closer = choice.mode === 'help' ? legworkLevelDice(level(c)) : 0;
  const base = choice.mode === 'fixer' ? fixerDice(c) : 0;
  const own = Math.min(MAX_CONTACT_DICE, Math.max(0, Math.floor(Number(c.dice) || 0)));
  const theirDice = choice.mode === 'help' && own > 0 && choice.digs !== false && RULES.STREET.contacts.ownDice !== 'off' ? own : 0;
  return {
    mode: choice.mode, contact: c, dice: base + closer + bought + favourDice, closer, bought, favourDice, theirDice,
    payNow: fee + payUsed, fee, pay: payUsed, waiveCut: choice.mode === 'fixer' && Boolean(fav?.waiveFee), favour: fav ? { after: fav.after, debt: fav.debt } : null, refused: '',
  };
}

/** A find card's successes: the character's, or (helped by a contact who digs) as legwork combines them. */
export function throughSuccesses(mode: ThroughMode, mine: number, theirs: number | null): number {
  if (mode !== 'help') return Math.max(0, mine);
  return contactDigSuccesses(mine, theirs).successes;
}

/** The extra dice a contact or fixer brings, for the card label (" (closer +1, paid +2, favour +2)", or ''). */
export function throughSuffix(p: Pick<ThroughPlan, 'closer' | 'bought' | 'favourDice'>): string {
  const parts: string[] = [];
  if (p.closer) parts.push(tx('SR2E.Card.Through.closerDice', { n: p.closer }));
  if (p.bought) parts.push(tx('SR2E.Card.Through.paidDice', { n: p.bought }));
  if (p.favourDice) parts.push(tx('SR2E.Card.Through.favourDice', { n: p.favourDice }));
  return parts.length ? ` (${parts.join(', ')})` : '';
}
