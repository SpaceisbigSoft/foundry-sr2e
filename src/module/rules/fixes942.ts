/**
 * v0.94.2 (plan item 29, the small-fixes bundle): pure parts.
 * - Fold dice: a GM world default, with each user's own choice (follow it, on, off) as an override (UI-11.5).
 * - Actors in combat without tokens: which actors the "Add to combat" window offers, and which it ticks (8.1).
 * - "Clear my targets at the end of my turn": whose turn counts as this user's (UI-9.4).
 */

/** This user's Fold dice choice: follow the table's default, or always fold, or never. */
export type FoldDiceChoice = 'default' | 'on' | 'off';
export const FOLD_DICE_CHOICES: readonly FoldDiceChoice[] = ['default', 'on', 'off'];
/** The client setting's key. */
export const FOLD_DICE_KEY = 'foldDice';

/**
 * The stored client setting as a choice. v0.94.2 review (5): it used to be a Boolean, and Foundry may hand back the old
 * stored value (true, false, or their strings): true reads as 'on', false as 'off'; anything unknown as 'default'.
 */
export function foldDiceChoice(raw: unknown): FoldDiceChoice {
  if (raw === true || raw === 'true' || raw === 'on') return 'on';
  if (raw === false || raw === 'false' || raw === 'off') return 'off';
  return 'default';
}

/** Whether test cards fold their dice for this user: their own choice, or the GM's world default when they follow it. */
export function foldDiceFolded(choice: unknown, worldDefault: boolean): boolean {
  const c = foldDiceChoice(choice);
  return c === 'default' ? Boolean(worldDefault) : c === 'on';
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
 * The world actors already in a combat (for "Add to combat"): combatants with no token, or with a linked token. An
 * unlinked token's combatant carries its base actor's id, but the base actor itself is not in the fight.
 */
export function addedActorIds(combatants: ReadonlyArray<{ actorId?: unknown; tokenId?: unknown; linked?: unknown }>): string[] {
  return combatants.filter((c) => c && c.actorId && (!c.tokenId || c.linked === true)).map((c) => String(c.actorId));
}

/**
 * Whether the combatant whose turn just ended was this user's: for a player, one whose actor they own; for a GM,
 * one no player owns (the GM's NPCs). Unknown combatants count for nobody.
 */
export function turnWasMine(prior: { isOwner?: boolean; hasPlayerOwner?: boolean } | null | undefined, isGM: boolean): boolean {
  if (!prior) return false;
  return isGM ? !prior.hasPlayerOwner : Boolean(prior.isOwner);
}
