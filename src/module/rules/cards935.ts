/**
 * v0.93.5 ("interface polish", agent A): the Foundry-free parts of the card and roll-dialog polish.
 *
 * - The next step on a card for the viewing user (plan item 45, UI-13.5): which Defend, Resist or Apply (GM) button
 *   is theirs to press now. Decided from trusted facts only (the row's target actor's ownership, the user being a
 *   GM, a GM-apply flag), never from a button's data.
 * - The attack card's banner state while it waits for the targets' Defend (visual review theme 5).
 * - Which firing-mode-only rows of the attack window show for the chosen mode (FA-only rows only on FA).
 * - The Perception modifier rows grouped by sense (Observer, Sound, Smell, Touch, Taste) for the Sneak and
 *   Perceive windows, a rarely used group folded unless a box in it is ticked.
 */

// ---------------------------------------------------------------- The next step on a card

/** The per-target buttons a card waits on. */
export type StepAction = 'defend' | 'resist' | 'resistSpell';
export const STEP_ACTIONS: readonly StepAction[] = ['defend', 'resist', 'resistSpell'];

/** One per-target button on a card, as the viewing client sees it. */
export interface StepRow {
  action: StepAction;
  index: number;
  /** The row's target has already used it (the card's flag, or the target's own cardRolls). */
  done: boolean;
  /** The viewing user owns the row's target (Foundry's `actor.isOwner`; a GM owns every actor). */
  mine: boolean;
  /** The row's target has a player owner (Foundry's `actor.hasPlayerOwner`): their player rolls it, not the GM. */
  playerOwned: boolean;
}

/** The key a button is known by in `nextStepKeys`: `<action>:<index>` for a row, the bare action for an Apply (GM). */
export const stepKey = (action: string, index?: number): string => (index == null ? action : `${action}:${index}`);

/**
 * v0.93.5: the buttons that are the next step for the viewing user. A player: the rows not yet done whose target
 * they own. A GM: the Apply (GM) buttons not yet applied, and the rows not yet done whose target no player owns (an
 * NPC's Defend or Resist, or a gone target's); a player's own row is theirs, not the GM's.
 */
export function nextStepKeys(rows: readonly StepRow[], o: { isGM: boolean; gmApplies?: readonly string[] }): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    if (r.done) continue;
    if (o.isGM ? !r.playerOwned : r.mine) out.add(stepKey(r.action, r.index));
  }
  if (o.isGM) for (const a of o.gmApplies ?? []) out.add(stepKey(a));
  return out;
}

/** v0.93.5: the "done" line's key for a used row's button ("✓ {name} defended"). */
export function doneLabelKey(action: StepAction): string {
  return action === 'defend' ? 'SR2E.Card.Next.defended' : 'SR2E.Card.Next.resisted';
}

// ---------------------------------------------------------------- The attack card's banner

/** The attack card's banner while it has Defend buttons: none defended yet, some, or all. */
export type AttackWait = 'awaiting' | 'partial' | 'defended';

/** v0.93.5: the attack banner's state from its Defend rows (total) and how many are done. */
export function attackWaitState(total: number, done: number): AttackWait {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const d = Math.max(0, Math.min(t, Math.floor(Number(done) || 0)));
  if (t > 0 && d >= t) return 'defended';
  return d > 0 ? 'partial' : 'awaiting';
}

/** v0.93.5: the banner's string key for a state, with or without successes (a melee defender may roll at 0). */
export function attackWaitKey(state: AttackWait, successes: number): string {
  const s = Number(successes) > 0;
  if (state === 'defended') return s ? 'SR2E.Card.Outcome.hitDefended' : 'SR2E.Card.Outcome.zeroDefended';
  if (state === 'partial') return s ? 'SR2E.Card.Outcome.hitPartial' : 'SR2E.Card.Outcome.zeroPartial';
  return s ? 'SR2E.Card.Outcome.hitAwaiting' : 'SR2E.Card.Outcome.zeroAwaiting';
}

// ---------------------------------------------------------------- Firing-mode-only rows

/**
 * v0.93.5: whether a row marked for some firing modes (`data-sr2e-fire-modes="FA"`, space- or comma-separated)
 * shows for the chosen mode. An unmarked row always shows; with no mode chosen yet, only unmarked rows.
 */
export function fireRowShown(modes: string | null | undefined, mode: string | null | undefined): boolean {
  const list = String(modes ?? '').split(/[\s,]+/).map((m) => m.trim().toUpperCase()).filter(Boolean);
  if (!list.length) return true;
  return list.includes(String(mode ?? '').trim().toUpperCase());
}

// ---------------------------------------------------------------- Perception modifiers by sense

export type SenseGroup = 'observer' | 'sound' | 'smell' | 'touch' | 'taste' | 'other';
export const SENSE_GROUPS: readonly SenseGroup[] = ['observer', 'sound', 'smell', 'touch', 'taste', 'other'];

/** The rows' groups by their ids (RULES.STREET.perception and CORE_V923.senseRows, Core p. 185). */
const SENSE_OF: Readonly<Record<string, SenseGroup>> = {
  distracted: 'observer', noisy: 'observer', crowd: 'observer', searching: 'observer',
  gunshot: 'sound', gunshotSilenced: 'sound', burst: 'sound', burstSilenced: 'sound', auto: 'sound', autoSilenced: 'sound',
  grenade: 'sound', yelling: 'sound', roomsAway: 'sound', sameFloor: 'sound', floorsAway: 'sound',
  odorObvious: 'smell', otherOdors: 'smell',
  temperature: 'touch', gloves: 'touch',
  tasteObvious: 'taste', hasCold: 'taste',
};

/** v0.93.5: a Perception modifier row's sense, by its id (an unknown id, e.g. a custom list's, is 'other'). */
export function senseGroupOf(id: string): SenseGroup {
  return Object.prototype.hasOwnProperty.call(SENSE_OF, id) ? SENSE_OF[id]! : 'other';
}

/** Groups shown open always (the common ones); the rest fold unless a box in them is ticked. */
const ALWAYS_OPEN: ReadonlySet<SenseGroup> = new Set<SenseGroup>(['observer', 'other']);

/** v0.93.5: a row's label without its group's lead word ("Sound: burst fire" under Sound reads "burst fire"). */
export function stripSenseLead(label: string): string {
  const m = /^(Sound|Smell|Touch|Taste):\s+(.+)$/.exec(String(label ?? ''));
  return m ? m[2]! : String(label ?? '');
}

export interface SenseGroupRows<R> { group: SenseGroup; open: boolean; collapsible: boolean; rows: R[] }

/**
 * v0.93.5: the rows in sense groups, in the groups' order (rows keep theirs within a group); empty groups left out.
 * A collapsible group is open when a row in it is ticked.
 */
export function groupSenseRows<R extends { id: string }>(rows: readonly R[], ticked: ReadonlySet<string> = new Set()): SenseGroupRows<R>[] {
  const by = new Map<SenseGroup, R[]>();
  for (const r of rows) {
    const g = senseGroupOf(r.id);
    if (!by.has(g)) by.set(g, []);
    by.get(g)!.push(r);
  }
  return SENSE_GROUPS.filter((g) => by.has(g)).map((g) => {
    const list = by.get(g)!;
    const collapsible = !ALWAYS_OPEN.has(g);
    return { group: g, collapsible, open: !collapsible || list.some((r) => ticked.has(r.id)), rows: list };
  });
}
