import { t as tx } from './i18n.ts';

/**
 * v0.59.0: every actor a lookup should see: the world's actors plus the synthetic actors of unlinked
 * tokens on every scene (an unlinked drone, guard or IC token is its own actor, with its own uuid, and
 * is not in `game.actors`).
 */
export function allActors(): any[] {
  const out: any[] = [...(((globalThis as any).game?.actors) ?? [])];
  const seen = new Set(out.map((a: any) => a?.uuid));
  const all: any = (globalThis as any).game?.scenes;
  const scenes: any[] = all?.contents ?? (all && typeof all[Symbol.iterator] === 'function' ? [...all] : []);
  for (const sc of scenes) {
    const coll: any = sc?.tokens;
    const tokens: any[] = coll?.contents ?? (coll && typeof coll[Symbol.iterator] === 'function' ? [...coll] : []);
    for (const t of tokens) {
      const a = t?.actorLink ? null : t?.actor;
      if (a && !seen.has(a.uuid)) { seen.add(a.uuid); out.push(a); }
    }
  }
  return out;
}

/** A picker label that tells an unlinked token's actor from the world actor it was made from. */
export function actorLabel(a: any): string {
  const name = String(a?.name ?? '');
  if (!a?.isToken) return name;
  // Scene names only for the GM (a player's picker shouldn't name scenes they haven't seen).
  const scene = (globalThis as any).game?.user?.isGM ? a.token?.parent?.name : '';
  return scene ? tx('SR2E.App.Actors.tokenOn', { name, scene }) : tx('SR2E.App.Actors.token', { name });
}
