/**
 * v0.94.2 (plan item 29, the small-fixes bundle): pure parts.
 * - Fold dice: a GM world default, with each user's own choice kept as an override (UI-11.5).
 * - Actors in combat without tokens: which actors the "Add to combat" window offers, and which it ticks (8.1).
 * - "Clear my targets at the end of my turn": whose turn counts as this user's (UI-9.4).
 */

/**
 * Whether test cards fold their dice for this user: the user's own client choice when they have stored one,
 * else the GM's world default. `stored` is the raw client-storage value (null or undefined when never set).
 */
export function foldDiceFolded(stored: unknown, worldDefault: boolean, mine: boolean): boolean {
  if (stored === null || stored === undefined || stored === '') return worldDefault;
  return mine;
}

/** The actor kinds that can go into combat without a token. */
export const ADD_TO_COMBAT_TYPES: readonly string[] = ['character', 'npc', 'spirit', 'vehicle'];

/** One row of the "Add to combat" window. */
export interface AddToCombatRow { id: string; name: string; type: string; checked: boolean }

/**
 * The rows the "Add to combat" window offers: world actors of a fighting kind not already in the combat, player
 * characters first and ticked (the party), then everyone else unticked, each group by name.
 */
export function addToCombatRows(actors: ReadonlyArray<{ id: string; name: string; type: string; hasPlayerOwner?: boolean }>, inCombat: ReadonlySet<string>): AddToCombatRow[] {
  const rows = actors
    .filter((a) => a && ADD_TO_COMBAT_TYPES.includes(String(a.type)) && !inCombat.has(String(a.id)))
    .map((a) => ({ id: String(a.id), name: String(a.name ?? ''), type: String(a.type), checked: a.type === 'character' && Boolean(a.hasPlayerOwner) }));
  return rows.sort((a, b) => (a.checked === b.checked ? a.name.localeCompare(b.name) : a.checked ? -1 : 1));
}

/**
 * Whether the combatant whose turn just ended was this user's: for a player, one whose actor they own; for a GM,
 * one no player owns (the GM's NPCs). Unknown combatants count for nobody.
 */
export function turnWasMine(prior: { isOwner?: boolean; hasPlayerOwner?: boolean } | null | undefined, isGM: boolean): boolean {
  if (!prior) return false;
  return isGM ? !prior.hasPlayerOwner : Boolean(prior.isOwner);
}
