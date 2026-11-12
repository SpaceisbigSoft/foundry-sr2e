/**
 * The build check's input from a character as it stands (v0.38.0–v0.63.0; moved here in v0.64.0 so the
 * creation wizard and the sheets share it).
 */
import { SYSTEM } from '../config/system.ts';
import { ATTRIBUTE_KEYS } from '../models/index.ts';
import { buildCheck, wareCost, type BuildColumn, type Priority, type BuildInput } from '../rules/index.ts';
import { inCreation, draftTable } from './approvals.ts';
import { withPriorityTable } from '../rules/core923.ts';

/** v0.63.0: the saved build's checks (none until Build… has saved priorities). */
export function buildRowsFor(actor: any): Array<{ label: string; used: any; allowed: any; ok: boolean; note?: string }> {
  if (actor.type !== "character") return [];
  const saved = (actor.getFlag?.(SYSTEM.id, "build") ?? null) as Partial<Record<BuildColumn, Priority>> | null;
  // v0.75.0: a build whose columns are all null (cleared on an unlinked token, or written empty) counts as none.
  if (!saved || !Object.values(saved).some((v) => v)) return [];
  // v0.92.3 review fix: a draft keeps the priority table it was started with.
  try { return withPriorityTable(draftTable(actor), () => buildCheck({ ...buildInputFor(actor, saved), inCreation: inCreation(actor) })) as any; } catch { return []; }
}

export function buildInputFor(actor: any, priorities: Partial<Record<BuildColumn, Priority>>): BuildInput {
  const sys = actor.system;
  const items: any[] = [...actor.items];
  const tradition = String(sys.tradition ?? "none");
  const magic: BuildInput["magic"] = tradition === "none" && !(Number(sys.magic) > 0) ? "none"
    : ["hermetic", "shamanic"].includes(tradition) ? "full" : tradition === "adept" ? "adept" : tradition === "none" ? "full" : "aspected";
  const skills = items.filter((i) => i.type === "skill");
  const native = skills.find((i) => i.system.kind === "language" && i.system.native) ?? null;
  // v0.71.0 (R3): the narrower ratings go along, so the build check can count a specialization's trade.
  const skillOf = (i: any) => ({ name: i.name, rating: i.system.rating ?? 0,
    specialization: String(i.system.specialization ?? ''), specializationRating: Number(i.system.specializationRating ?? 0) || 0,
    concentration: String(i.system.concentration ?? ''), concentrationRating: Number(i.system.concentrationRating ?? 0) || 0 });
  const cost = (i: any) => {
    const c = Number(i.system?.cost ?? 0);
    if (!c) return 0;
    if (i.type === "cyberware") return wareCost(i.system);
    return c * Math.max(1, Number(i.system?.quantity ?? 1));
  };
  return {
    priorities, metatype: String(sys.metatype ?? "human"), magic,
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, Number(sys.attributes?.[k]?.base ?? 0)])),
    intelligence: Number(sys.attributes?.intelligence?.base ?? 0),
    activeSkills: skills.filter((i) => ["active", "buildRepair"].includes(i.system.kind ?? "active")).map(skillOf),
    // v0.58.0: the native language is counted on its own (free up to Intelligence).
    knowledgeSkills: skills.filter((i) => ["knowledge", "language"].includes(i.system.kind) && !(i.system.kind === "language" && i.system.native && native === i)).map(skillOf),
    ...(native ? { nativeLanguage: { name: native.name, rating: Number(native.system.rating ?? 0) } } : {}),
    gearCost: items.reduce((n, i) => n + cost(i), 0), nuyen: Number(sys.nuyen ?? 0), essence: Number(sys.derived?.essence ?? sys.essence ?? 6),
    qualities: [...(sys.qualities ?? [])],
    // v0.58.0: contacts beyond the free ones and the lifestyle months come from Resources.
    contacts: [...(sys.contacts ?? [])].map((c: any) => ({ level: Number(c.level ?? 1) })),
    lifestyle: String(sys.lifestyle?.level ?? "low"),
  };
}

