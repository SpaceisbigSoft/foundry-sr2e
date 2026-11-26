/**
 * v0.94.2 (improvement plan item 27): Foundry combatant groups for grunts, linked to the morale groups. The pure
 * parts (no Foundry); the glue is applications/groups942.ts.
 *
 * - A grunt's group key is its token's morale group (flag `moraleGroup`, the GM's or the scene builder's), else its
 *   split grunt group (flag `gruntGroup`); none for anyone else. Grunts with one key, two or more in the combat, make
 *   one Foundry combatant group (a `CombatantGroup` carrying the key in its flag `groupKey`).
 * - Only the groups the system made are touched: a group the GM made by hand, and its members, are left alone.
 * - The group's name shows how many still stand (`3/5`) unless a member is hidden (that would count hidden tokens
 *   for the players); the GM's tracker also shows the count and whether the group has broken.
 * - Initiative: each grunt keeps their own by default (no book rule rolls one initiative for a group; SR2 Core rolls
 *   each character's). The world setting `gruntGroupInitiative` 'shared' has the group's first grunt rolled and the
 *   rest given the same score. The group document's own `initiative` is never set (the passes lower the members').
 */

export interface GroupMember {
  /** The combatant's id, its group key ('' = no grunt group), and its Foundry group now ('' = none). */
  id: string;
  key: string;
  group: string;
  name: string;
  hidden: boolean;
  down: boolean;
  broken: boolean;
}

export interface KnownGroup { id: string; key: string; ours: boolean }

export interface GroupPlan {
  create: Array<{ key: string; memberIds: string[] }>;
  assign: Array<{ id: string; group: string }>;
  clear: string[];
  remove: string[];
}

/** Pure: a token's group key from its system flags (null on an unlinked token = not set). */
export function groupKeyOf(flags: Record<string, unknown> | null | undefined): string {
  const m = flags?.['moraleGroup'], g = flags?.['gruntGroup'];
  if (typeof m === 'string' && m) return `m:${m}`;
  if (typeof g === 'string' && g) return `g:${g}`;
  return '';
}

/**
 * Pure: what to do to the combat's groups. 'group' makes the groups match the keys (the GM's button, or a combatant
 * added or removed); 'ungroup' takes every member out of the system's groups and removes them.
 */
export function planGroups(members: ReadonlyArray<GroupMember>, groups: ReadonlyArray<KnownGroup>, mode: 'group' | 'ungroup'): GroupPlan {
  const ours = new Map(groups.filter((g) => g.ours).map((g) => [g.id, g]));
  const foreign = new Set(groups.filter((g) => !g.ours).map((g) => g.id));
  const plan: GroupPlan = { create: [], assign: [], clear: [], remove: [] };
  if (mode === 'ungroup') {
    plan.clear = members.filter((m) => m.group && ours.has(m.group)).map((m) => m.id);
    plan.remove = [...ours.keys()];
    return plan;
  }
  // Members in a group the GM made stay there.
  const free = members.filter((m) => !(m.group && foreign.has(m.group)));
  const byKey = new Map<string, GroupMember[]>();
  for (const m of free) if (m.key) byKey.set(m.key, [...(byKey.get(m.key) ?? []), m]);
  const keep = new Set<string>();
  const used = new Set<string>();
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    const g = [...ours.values()].find((x) => x.key === key && !used.has(x.id));
    if (g) {
      used.add(g.id); keep.add(g.id);
      for (const m of list) if (m.group !== g.id) plan.assign.push({ id: m.id, group: g.id });
    } else plan.create.push({ key, memberIds: list.map((m) => m.id) });
  }
  const placed = new Set([...plan.assign.map((a) => a.id), ...plan.create.flatMap((c) => c.memberIds)]);
  for (const m of free) {
    if (!m.group || !ours.has(m.group) || placed.has(m.id)) continue;
    if (!keep.has(m.group) || ours.get(m.group)!.key !== m.key) plan.clear.push(m.id);
  }
  plan.remove = [...ours.keys()].filter((id) => !keep.has(id));
  return plan;
}

/** Pure: a group's base name from its members' names ("Goon 1", "Goon 2" → "Goon"). */
export function baseName(names: ReadonlyArray<string>): string {
  const list = names.map((n) => String(n ?? '').trim()).filter(Boolean);
  if (!list.length) return '';
  let p = list[0]!;
  for (const n of list.slice(1)) { let i = 0; while (i < p.length && i < n.length && p[i] === n[i]) i++; p = p.slice(0, i); }
  p = p.replace(/[\s\d#.,:(-]+$/u, '').trim();
  return p.length >= 2 ? p : list[0]!;
}

/** Pure: a group's standing count, and whether a count may go in its name (no hidden member). */
export function groupStanding(members: ReadonlyArray<Pick<GroupMember, 'down' | 'hidden' | 'broken'>>): { standing: number; total: number; countInName: boolean; broken: boolean } {
  return {
    standing: members.filter((m) => !m.down).length,
    total: members.length,
    countInName: members.length > 0 && !members.some((m) => m.hidden),
    broken: members.length > 0 && members.filter((m) => !m.down).every((m) => m.broken) && members.some((m) => m.broken),
  };
}

/**
 * Pure: the shared-initiative updates after a roll: in each of the system's groups, the first member rolled sets the
 * score for the others. `rolled` is the combatant ids rolled now.
 */
export function sharedInitiativeUpdates(members: ReadonlyArray<{ id: string; group: string; initiative: number | null }>, rolled: ReadonlyArray<string>, ourGroups: ReadonlySet<string>): Array<{ _id: string; initiative: number }> {
  const out: Array<{ _id: string; initiative: number }> = [];
  const done = new Set<string>();
  for (const id of rolled) {
    const lead = members.find((m) => m.id === id);
    if (!lead || !lead.group || !ourGroups.has(lead.group) || done.has(lead.group) || lead.initiative === null) continue;
    done.add(lead.group);
    for (const m of members) if (m.group === lead.group && m.id !== lead.id && m.initiative !== lead.initiative) out.push({ _id: m.id, initiative: lead.initiative });
  }
  return out;
}

/** Pure: which of the ids to roll when sharing: one per system group (the first), plus everyone not in one. */
export function sharedRollIds(members: ReadonlyArray<{ id: string; group: string }>, ids: ReadonlyArray<string>, ourGroups: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const g = members.find((m) => m.id === id)?.group ?? '';
    if (!g || !ourGroups.has(g)) return true;
    if (seen.has(g)) return false;
    seen.add(g);
    return true;
  });
}
