import { SYSTEM } from "../config/system.ts";

/**
 * v0.93.0: what marks a world as another system's. futurekill's Shadowrun 2e system (futurekill/sr2e-foundryvtt) has the same
 * id, `sr2e`, so its worlds open here: its update marker is the world setting `sr2e.systemMigrationVersion` (this system's is
 * `sr2e.migrationVersion`), and these document types exist only there. Running this system's updates over its data rewrites it.
 */
export const FOREIGN_WORLD = {
  setting: "sr2e.systemMigrationVersion",
  actorTypes: ["frame"],
  itemTypes: ["bioware", "adept_power", "contact", "lifestyle", "ammo", "vehicle_mod", "race", "tradition", "quality"],
} as const;

/**
 * Pure (v0.93.0): the signs that a world's stored data (Foundry's `game.data`: settings, actors with their items, items) is
 * another system's: the marker setting, and each foreign type found with how many documents have it. [] = none.
 */
export function foreignWorldSigns(data: { settings?: any[]; actors?: any[]; items?: any[]; scenes?: any[] } | null | undefined): string[] {
  const signs: string[] = [];
  if ((data?.settings ?? []).some((s: any) => s?.key === FOREIGN_WORLD.setting)) signs.push(FOREIGN_WORLD.setting);
  const count = new Map<string, number>();
  const see = (kind: string, type: unknown, list: readonly string[]) => {
    const t = String(type ?? "");
    if (list.includes(t)) count.set(`${kind} ${t}`, (count.get(`${kind} ${t}`) ?? 0) + 1);
  };
  for (const a of data?.actors ?? []) {
    see("Actor", a?.type, FOREIGN_WORLD.actorTypes);
    for (const i of a?.items ?? []) see("Item", i?.type, FOREIGN_WORLD.itemTypes);
  }
  for (const i of data?.items ?? []) see("Item", i?.type, FOREIGN_WORLD.itemTypes);
  // Unlinked tokens keep their own items in the token's delta.
  for (const s of data?.scenes ?? []) for (const tk of s?.tokens ?? []) for (const i of tk?.delta?.items ?? []) see("Item", i?.type, FOREIGN_WORLD.itemTypes);
  for (const [k, n] of count) signs.push(`${k} (${n})`);
  return signs;
}

/**
 * v0.93.0: whether this world is another system's and the GM hasn't chosen to update it anyway. The migrations, the
 * session-start Karma refresh and the timer sweep read it before they write anything on load. Read once, after ready.
 */
let cached: boolean | null = null;
export function isForeignWorld(): boolean {
  if (cached !== null) return cached;
  cached = foreignWorldSigns((globalThis as any).game?.data).length > 0 && !ignoringForeignWorld();
  return cached;
}

/** The GM's override (the hidden world setting `ignoreForeignWorld`, registered with the migration setting). */
export function ignoringForeignWorld(): boolean {
  try { return Boolean((globalThis as any).game?.settings?.get(SYSTEM.id, "ignoreForeignWorld")); } catch { return false; }
}

/** Tests only: forget the cached answer. */
export function resetForeignWorldCache(): void { cached = null; }
