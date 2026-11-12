/**
 * v0.91.0: the shop (the owner's decisions, 25 Oct 2026). Read through RULES.SHOP_V91. Every row is a house-rule
 * switch: the first choice is the new way (the default), the other puts the old behaviour back.
 *
 * - buying: 'find' — out of creation, a player character buys from the Add window (the shop) by finding the item
 *   first: the Availability test (Etiquette, else Charisma; lifestyle, Street Cred and the Karma Pool as on any
 *   find card), then Buy or Haggle on the card; the item arrives after the Availability time ÷ successes (the GM's
 *   waiting rules, RULES.WAITING.areas.gear). 'now': the old Buy now (pays at once, no test; with waiting on it
 *   arrives after the base time × RULES.WAITING.orderFactor). The GM, NPCs and characters in the creation wizard
 *   always have Buy now.
 * - retry: 'wait' — a character who fails to find an item may try again only once its base Availability time has
 *   passed (in world time; the GM is never held back). Core Rules (Availability). VERIFY. 'any': try again at once
 *   (the old way).
 */
export const SHOP_V91 = {
  buying: 'find' as 'find' | 'now',
  retry: 'wait' as 'wait' | 'any',
};

/**
 * v0.91.0: what players see in the shop (the world setting `sr2e.shopList`): every entry, only the GM's own
 * catalogue (world templates, world items and kits), or only the entries the GM marked "in the shop" (and kits).
 */
export const SHOP_LIST_MODES = {
  all: 'SR2E.Settings.shopList.Choices.all',
  catalogue: 'SR2E.Settings.shopList.Choices.catalogue',
  marked: 'SR2E.Settings.shopList.Choices.marked',
} as const;
export type ShopListMode = keyof typeof SHOP_LIST_MODES;

/**
 * v0.91.5: legality and permits in the shop (the owner's decisions, 26 Oct 2026: a restricted item can be found
 * openly, only harder; contacts and fixers follow in v0.91.6). Read through RULES.SHOP_V915. Every switch's first
 * choice is the new way (the default), the other puts the old behaviour back. All numbers VERIFY against the books.
 *
 * - findByLegality: 'graded' — an item's legality (RULES.GEAR_V58.legality) makes finding it openly harder: its
 *   Availability TN goes up by `findTn` and its time is multiplied by `findTime` (forbidden items are only on sale
 *   when the GM allows them: the `shopForbidden` setting). 'off': legality doesn't change the find (the old way).
 * - permits: 'buy' — a permit is got with "Get a permit…" on the item (or an owned vehicle): it costs `permitCost`
 *   (a share of the item's cost, at least the minimum) and arrives after `permitDays` (the GM's waiting rules,
 *   RULES.WAITING.areas.gear; the approval queue holds it for the GM). The Permit box is then the GM's to tick.
 *   'tick': anyone who owns the item ticks the Permit box (the old way, free and at once).
 * Only categories whose legality row has `permit: true` (Needs a permit, Restricted) can have a permit.
 */
export const SHOP_V915 = {
  findByLegality: 'graded' as 'graded' | 'off',
  findTn: { permit: 0, restricted: 2, forbidden: 4 } as Record<string, number>,
  findTime: { permit: 1, restricted: 1, forbidden: 2 } as Record<string, number>,
  permits: 'buy' as 'buy' | 'tick',
  permitCost: {
    permit: { share: 0.1, minimum: 100 },
    restricted: { share: 0.25, minimum: 500 },
  } as Record<string, { share: number; minimum: number }>,
  permitDays: { permit: 7, restricted: 30 } as Record<string, number>,
};

/**
 * v0.91.6: finding through contacts and fixers (the owner's decisions, 2 Nov 2026). Read through RULES.SHOP_V916.
 * The first choice of each switch is the new way (the default), the other puts the old behaviour back. All numbers
 * VERIFY against the books.
 *
 * - through: 'on' — a character's find (the shop's Find & buy, Find… on an item) can go through a contact: either
 *   the contact helps the character's own Availability test the way legwork does (a closer contact adds dice
 *   (RULES.BOOK_V78.legwork.levelDice; under the old legwork rule a lower TN instead), paid dice up to their Loyalty,
 *   a favour adds dice and may waive their fee, a contact with dice of their own rolls too
 *   (RULES.STREET.contacts.ownDice)), or a contact marked as a fixer finds it for them (the fixer's own roll, for a
 *   fee and more time). 'off': every find is the character's own (the old way).
 * - contactLegalShare: going through an ordinary contact, the "found openly" legality TN row
 *   (RULES.SHOP_V915.findTn) is multiplied by this (rounded down); its time stays.
 * - fixerLegalShare: the same for a fixer's own find (0: the row and its extra time go).
 * - fixerFee: the fixer's cut, a share of the price, added to it on the card's Buy.
 * - fixerTime: the fixer's find takes this many times as long (the Availability time ÷ their successes × this).
 * - fixerDicePerLevel: a fixer with no dice of their own set rolls their level × this.
 */
export const SHOP_V916 = {
  through: 'on' as 'on' | 'off',
  contactLegalShare: 0.5,
  fixerLegalShare: 0,
  fixerFee: 0.1,
  fixerTime: 1.5,
  fixerDicePerLevel: 2,
};

/**
 * v0.91.8: spell formulas (the owner's decisions, 11 Nov 2026). Read through RULES.FORMULA_V918. The first choice of
 * each switch is the new way (the default), the other puts the old behaviour back. All numbers VERIFY against the books.
 *
 * - required: 'on' — a character learns a spell only from a spell formula they hold (a gear item marked as one, found
 *   and bought in the shop like gear), a teacher who knows it, their group's grimoire or their own design. 'off': the
 *   shop's Learn with Good Karma needs nothing more (the old way).
 * - raise: 'on' — raising a known spell's Force needs a formula (or a teacher) of at least the new Force. 'off': not.
 * - nuyenPerForce: a formula's price per point of Force; combatFactor multiplies it for combat spells.
 * - availDays: a formula's Availability time in days (its TN is its Force × tnPerForce).
 * - streetIndex: a formula's Street Index.
 * - foreign: 'harder' — a formula (or teacher) of the other tradition (hermetic or shamanic) can be learned from,
 *   with the learning TN + foreignTn and the time × foreignTime. 'same': no difference.
 * - teacher: 'on' — a character or contact who knows the spell at the Force (or more) can teach it: their Instruction
 *   test (RULES.CHARACTERS_V58.training's skill and TN) gives its successes, up to their Sorcery, as extra dice to the
 *   student's learning test; one no player owns charges feePerForce × the Force. 'off': no teachers.
 */
export const FORMULA_V918 = {
  required: 'on' as 'on' | 'off',
  raise: 'on' as 'on' | 'off',
  nuyenPerForce: 500,
  combatFactor: 2,
  tnPerForce: 1,
  availDays: 7,
  streetIndex: 1,
  foreign: 'harder' as 'harder' | 'same',
  foreignTn: 2,
  foreignTime: 2,
  teacher: 'on' as 'on' | 'off',
  feePerForce: 100,
};
