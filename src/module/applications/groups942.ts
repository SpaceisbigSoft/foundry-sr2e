/**
 * v0.94.2 (improvement plan item 27): grunts in one morale group share a Foundry combatant group in the tracker
 * (Foundry glue; the pure parts are in rules/groups942.ts).
 *
 * - World setting `gruntGroups`: 'auto' (grouped as they are added; the default), 'manual' (only the GM's
 *   "Group grunts" button in the tracker), 'off'.
 * - World setting `gruntGroupInitiative`: 'each' (every grunt keeps their own roll; the default) or 'shared'.
 * - The lead GM's client does every change, under the GM lock. Only the groups the system made (flag `groupKey`) are
 *   changed or removed. Foundry's `CombatantGroup` is checked for first: without it nothing happens.
 * - The name shows the standing count unless a member is hidden; the GM's tracker adds the count and a "broken" badge.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { t as tx } from '../helpers/i18n.ts';
import { escHtml } from '../rules/html.ts';
import { withGmLock } from './gmlock.ts';
import { isLeadGm } from './leader.ts';
import { groupKeyOf, planGroups, baseName, groupStanding, sharedInitiativeUpdates, sharedRollIds, heldGroups, keepTurn, type GroupMember, type KnownGroup } from '../rules/groups942.ts';

const KEY_FLAG = 'groupKey';
const DOWN = ['unconscious', 'dying', 'dead'];

function setting(key: string, fallback: string): string {
  try { return String(game.settings.get(SYSTEM_ID, key) ?? fallback); } catch { return fallback; }
}
export const groupsMode = (): string => setting('gruntGroups', 'auto');
export const sharedInitiative = (): boolean => setting('gruntGroupInitiative', 'each') === 'shared';

/** Whether this Foundry has combatant groups on this combat. */
export function groupsSupported(combat: any): boolean {
  return Boolean((globalThis as any).CONFIG?.CombatantGroup) && Boolean(combat?.groups) && typeof combat?.createEmbeddedDocuments === 'function';
}

const groupIdOf = (c: any): string => { const g = c?.group; return typeof g === 'string' ? g : String(g?.id ?? ''); };

/** The combat's combatants as the planner sees them. */
export function membersOf(combat: any): GroupMember[] {
  return [...(combat?.combatants ?? [])].map((c: any) => {
    const tok = c.token ?? null;
    const flags = tok?.flags?.[SYSTEM_ID] ?? null;
    return {
      id: String(c.id), key: c.actor?.type === 'npc' ? groupKeyOf(flags) : '', group: groupIdOf(c), name: String(c.name ?? ''),
      hidden: Boolean(c.hidden), down: DOWN.includes(String(c.actor?.system?.derived?.status ?? 'ok')) || Boolean(c.isDefeated),
      broken: Boolean(c.actor?.getFlag?.(SYSTEM_ID, 'broken')),
    };
  });
}

export function groupsOf(combat: any): KnownGroup[] {
  return [...(combat?.groups ?? [])].map((g: any) => {
    const key = g.flags?.[SYSTEM_ID]?.[KEY_FLAG];
    return { id: String(g.id), key: typeof key === 'string' ? key : '', ours: typeof key === 'string' && key.length > 0 };
  });
}

/** The name a system group should have now. */
function nameFor(members: GroupMember[]): string {
  const base = baseName(members.map((m) => m.name)) || tx('SR2E.Groups.grunts');
  const s = groupStanding(members);
  return s.countInName ? tx('SR2E.Groups.nameCount', { name: base, standing: s.standing, total: s.total }) : base;
}

/** Inside the GM lock: make the groups match (or ungroup), then refresh the names. Never queues again. */
async function syncNow(combat: any, mode: 'group' | 'ungroup'): Promise<void> {
  if (!groupsSupported(combat)) return;
  const members = membersOf(combat);
  const plan = planGroups(members, groupsOf(combat), mode);
  if (plan.clear.length) await combat.updateEmbeddedDocuments('Combatant', plan.clear.map((id) => ({ _id: id, group: null })));
  if (plan.remove.length) await combat.deleteEmbeddedDocuments('CombatantGroup', plan.remove);
  if (plan.create.length) {
    const made = await combat.createEmbeddedDocuments('CombatantGroup', plan.create.map((c) => ({
      name: nameFor(members.filter((m) => c.memberIds.includes(m.id))), flags: { [SYSTEM_ID]: { [KEY_FLAG]: c.key } },
    })));
    const ups: Array<{ _id: string; group: string }> = [];
    plan.create.forEach((c, i) => { const g = made?.[i]; if (g?.id) for (const id of c.memberIds) ups.push({ _id: id, group: String(g.id) }); });
    if (ups.length) await combat.updateEmbeddedDocuments('Combatant', ups);
  }
  if (plan.assign.length) await combat.updateEmbeddedDocuments('Combatant', plan.assign.map((a) => ({ _id: a.id, group: a.group })));
  await renameNow(combat);
}

/** Inside the GM lock: each system group's name from its members now. */
async function renameNow(combat: any): Promise<void> {
  if (!groupsSupported(combat)) return;
  const members = membersOf(combat);
  const ups: Array<{ _id: string; name: string }> = [];
  for (const g of groupsOf(combat).filter((x) => x.ours)) {
    const list = members.filter((m) => m.group === g.id);
    if (!list.length) continue;
    const name = nameFor(list);
    if (combat.groups.get?.(g.id)?.name !== name) ups.push({ _id: g.id, name });
  }
  if (ups.length) await combat.updateEmbeddedDocuments('CombatantGroup', ups);
}

/** The GM's buttons: group (or ungroup) the grunts of a combat now. */
export async function groupGrunts(combat: any, mode: 'group' | 'ungroup' = 'group'): Promise<void> {
  if (!game.user?.isGM) return;
  if (!groupsSupported(combat)) { ui.notifications?.warn?.(tx('SR2E.Groups.unsupported')); return; }
  await withGmLock(() => syncNow(combat, mode));
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Debounced, on the lead GM only: a sync (or a rename) after combatants or grunts change. */
function schedule(combat: any, what: 'group' | 'rename'): void {
  try { if (!game.user?.isGM || !isLeadGm() || !groupsSupported(combat)) return; } catch { return; }
  const mode = groupsMode();
  if (mode === 'off' || (what === 'group' && mode !== 'auto')) return;
  const key = `${combat.id}:${what}`;
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    void withGmLock(() => (what === 'group' ? syncNow(combat, 'group') : renameNow(combat))).catch((err: unknown) => console.warn('sr2e | grunt groups', err));
  }, 300));
}

/** For SR2Combat.rollInitiative: with shared initiative, roll one grunt per group; `after` gives the rest its score. */
export function sharedRoll942(combat: any, ids: unknown): { ids: unknown; after: () => Promise<void> } {
  const none = { ids, after: async () => {} };
  try {
    if (!sharedInitiative() || !game.user?.isGM || !groupsSupported(combat)) return none;
    const list = (Array.isArray(ids) ? ids : [ids]).map(String);
    const ours = new Set(groupsOf(combat).filter((g) => g.ours).map((g) => g.id));
    const members = membersOf(combat);
    // v0.94.2 review (3): a group already holding a score mid-combat isn't rolled again; its new member takes the score.
    const scores = [...(combat.combatants ?? [])].map((c: any) => ({ id: String(c.id), group: groupIdOf(c), initiative: c.initiative ?? null }));
    const held = heldGroups(scores, list, ours);
    const roll = sharedRollIds(members, list.filter((id) => !held.has(members.find((m) => m.id === id)?.group ?? '')), ours);
    const current: string | null = combat.started ? (combat.combatant?.id ?? null) : null;
    return {
      ids: roll,
      after: async () => {
        const now = [...(combat.combatants ?? [])].map((c: any) => ({ id: String(c.id), group: groupIdOf(c), initiative: c.initiative ?? null }));
        const ups = sharedInitiativeUpdates(now, roll, ours, list);
        if (!ups.length) return;
        await combat.updateEmbeddedDocuments('Combatant', ups);
        // Keep the acting combatant acting after the re-sort (as SR2Combat.alignParties does).
        const turn = keepTurn([...(combat.turns ?? [])].map((t: any) => ({ id: String(t.id) })), current, Number(combat.turn ?? 0));
        if (turn !== null) await combat.update({ turn });
      },
    };
  } catch { return none; }
}

/** The GM's tracker: the buttons and each system group's count and broken badge (players see nothing new). */
function decorateTracker(html: HTMLElement): void {
  const combat: any = game.combat;
  if (!game.user?.isGM || !html?.querySelector || !groupsSupported(combat) || groupsMode() === 'off') return;
  if (!html.querySelector('.sr2e-group-tools')) {
    const bar = document.createElement('div');
    bar.className = 'sr2e-group-tools';
    bar.innerHTML = `<button type="button" data-sr2e-group="group" title="${tx('SR2E.Groups.groupHint')}"><i class="fa-solid fa-people-group"></i> ${tx('SR2E.Groups.group')}</button><button type="button" data-sr2e-group="ungroup"><i class="fa-solid fa-people-arrows"></i> ${tx('SR2E.Groups.ungroup')}</button>`;
    bar.querySelectorAll('button').forEach((b) => b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); void groupGrunts(combat, (b as HTMLElement).dataset['sr2eGroup'] === 'ungroup' ? 'ungroup' : 'group'); }));
    const list = html.querySelector('.combat-tracker, ol, .directory-list');
    if (list) list.before(bar); else html.prepend(bar);
  }
  const members = membersOf(combat);
  for (const g of groupsOf(combat).filter((x) => x.ours)) {
    const el = html.querySelector(`[data-group-id="${CSS.escape(g.id)}"]`) as HTMLElement | null;
    if (!el || el.querySelector('.sr2e-group-badge')) continue;
    const s = groupStanding(members.filter((m) => m.group === g.id));
    const badge = document.createElement('span');
    badge.className = `sr2e-group-badge${s.broken ? ' broken' : ''}`;
    badge.innerHTML = `${escHtml(tx('SR2E.Groups.standing', { standing: s.standing, total: s.total }))}${s.broken ? ` <strong>${tx('SR2E.Groups.broken')}</strong>` : ''}`;
    (el.querySelector('.name, .token-name, h4, strong') ?? el).append(badge);
  }
}

export function registerGruntGroups(): void {
  Hooks.on('createCombatant', (c: any) => schedule(c?.parent, 'group'));
  Hooks.on('deleteCombatant', (c: any) => schedule(c?.parent, 'group'));
  // A grunt going down, rallying or breaking: the names follow (the morale flag and the status live on the actor).
  const touched = (actor: any) => {
    const combat: any = game.combat;
    if (!combat || !actor) return;
    if ([...(combat.combatants ?? [])].some((c: any) => c.actor === actor || c.actor?.uuid === actor.uuid)) schedule(combat, 'rename');
  };
  Hooks.on('updateActor', (a: any) => touched(a));
  Hooks.on('updateToken', (t: any, ch: any) => { if (ch?.flags?.[SYSTEM_ID] && game.combat) schedule(game.combat, 'group'); else touched(t?.actor); });
  Hooks.on('updateCombatant', (c: any, ch: any) => { if ('hidden' in (ch ?? {}) || 'defeated' in (ch ?? {})) schedule(c?.parent, 'rename'); });
  Hooks.on('renderCombatTracker', (_app: any, html: any) => { try { decorateTracker((html?.querySelector ? html : html?.[0]) as HTMLElement); } catch (err) { console.warn('sr2e | grunt groups tracker', err); } });
}
