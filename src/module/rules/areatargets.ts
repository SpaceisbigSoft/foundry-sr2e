/**
 * v0.93.3 (visual review 0.93.2, finding 4): the area-target list of the spell and power windows. It used to list every
 * actor in the world (about 40 rows, the Cast button off screen). Now the scene's tokens come first, those inside the
 * area (pre-ticked) at the top, and actors with no token on this scene go behind a fold. Pure, so it can be tested.
 */
export interface AreaPerson { uuid: string; name: string; onScene: boolean; distance?: number | null }

export interface AreaOrder<T extends AreaPerson> {
  /** Shown at once: the scene's tokens, ticked ones first, then by distance (nearest first), else in the given order. */
  shown: T[];
  /** Behind "Not on this scene": world actors with no token here (empty when nothing is on the scene). */
  folded: T[];
}

export function orderAreaTargets<T extends AreaPerson>(people: readonly T[], ticked: ReadonlySet<string>): AreaOrder<T> {
  const onScene = people.filter((p) => p.onScene);
  // No tokens at all (no canvas, an empty scene): keep the old full list, so a target can still be picked.
  if (!onScene.length) return { shown: [...people], folded: [] };
  const rank = (p: T) => (ticked.has(p.uuid) ? 0 : 1);
  const dist = (p: T) => (typeof p.distance === 'number' && Number.isFinite(p.distance) ? p.distance : Number.POSITIVE_INFINITY);
  const shown = onScene.map((p, i) => ({ p, i }))
    .sort((x, y) => rank(x.p) - rank(y.p) || dist(x.p) - dist(y.p) || x.i - y.i)
    .map((x) => x.p);
  // A ticked actor off the scene (a user target, a hand-ticked one) stays visible.
  const extra = people.filter((p) => !p.onScene && ticked.has(p.uuid));
  return { shown: [...shown, ...extra], folded: people.filter((p) => !p.onScene && !ticked.has(p.uuid)) };
}
