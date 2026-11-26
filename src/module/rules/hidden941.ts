/**
 * v0.94.1 (report item 21): hidden-information basics, the pure parts. This is screen hiding for the table's
 * sake, not security: a determined player can still read the message data in the browser.
 *
 * - A world default privacy per kind of test (the GM's table default); a player's own choice may only make a
 *   card more private than it, never less.
 * - A "secret" inline test: its card goes to the GMs only (blind for the roller).
 * - NPC numbers (TN, its breakdown, the dice) shown to the GM only on the cards of tests no player owns.
 * - Floating damage only for the GM and the actor's owners (unless the GM shows it to everyone), and only once
 *   Dice So Nice's dice have stopped.
 */

/** How private each message mode is, as the other players see it: public < GM (the roller sees it too) = self < blind. */
export const PRIVACY_RANK: Readonly<Record<string, number>> = { '': 0, public: 0, ic: 0, gm: 1, self: 1, blind: 2 };

const rank = (m: string): number => PRIVACY_RANK[m] ?? 0;

/**
 * Pure: the mode a card is posted in, given the mode the user's own choice gives (`mode`, already Foundry's chat mode
 * when they chose nothing) and the table default for its kind (`floor`, '' = none). The GM is free; a player's card
 * is never less private than the floor. When the floor wins, its own mode is used ("self" isn't a floor for a "gm"
 * floor's sake: they rank alike, so the player's choice stands).
 */
export function flooredMode(mode: string, floor: string, isGM: boolean): string {
  if (isGM || !floor) return mode;
  return rank(mode) >= rank(floor) ? mode : floor;
}

/** Pure: the table default for a test kind, from the world's {group: mode} map (the group as `privacyGroup` gives it). */
export function worldFloor(group: string, world: Record<string, unknown> | null | undefined): string {
  const m = String(world?.[group] ?? '');
  return Object.hasOwn(PRIVACY_RANK, m) && m !== 'ic' ? m : '';
}

// ------------------------------------------------------------------ secret inline tests

/** How long a secret inline test's arming waits for its card (its roll window may be open a while). */
export const SECRET_TTL_MS = 5 * 60 * 1000;

const armed = new Map<string, number>();

/** Arm the next test card of this actor (its uuid, or '' for an actorless dice roll) as secret. */
export function armSecret(key: string, now = Date.now()): void {
  armed.set(String(key ?? ''), now + SECRET_TTL_MS);
}

/** Disarm without posting (the roll window was closed). */
export function disarmSecret(key: string): void {
  armed.delete(String(key ?? ''));
}

/** Pure-ish: whether this actor's next card is secret; takes the arming (one card only). */
export function takeSecret(key: string, now = Date.now()): boolean {
  const k = String(key ?? '');
  const until = armed.get(k);
  if (until === undefined) return false;
  armed.delete(k);
  return until >= now;
}

// ------------------------------------------------------------------ NPC numbers on cards

/** Pure: whether this viewer's copy of a test card hides its numbers (setting `hideNpcNumbers`). */
export function hidesNumbers(o: { enabled: boolean; viewerIsGM: boolean; playerOwned: boolean; viewerOwns: boolean }): boolean {
  return o.enabled && !o.viewerIsGM && !o.playerOwned && !o.viewerOwns;
}

// ------------------------------------------------------------------ floating damage

export const FLOAT_WHO = ['owners', 'all'] as const;
export type FloatWho = (typeof FLOAT_WHO)[number];

/** Pure: whether this client shows an actor's floating damage (setting `floatingDamageWho`). */
export function floatVisible(o: { who: string; isGM: boolean; isOwner: boolean }): boolean {
  return o.who === 'all' || o.isGM || o.isOwner;
}

/** The longest floating damage waits for Dice So Nice's dice to stop. */
export const DICE_WAIT_MS = 6000;
