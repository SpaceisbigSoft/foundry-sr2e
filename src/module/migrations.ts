import { SYSTEM } from "./config/system.ts";
import { behaviorFromName, vehicleSkillAttribute } from "./rules/index.ts";
import { allActors } from "./helpers/actors.ts";
import type { HouseRules } from "./settings.ts";
import { escHtml } from "./rules/html.ts";
import { isLeadGm, leadSettled } from "./applications/leader.ts";
import { t as tx, tCount } from './helpers/i18n.ts';

/**
 * World data migrations. The GM's client runs every migration newer than the world's stored
 * version once, in order, storing each version as it succeeds (v0.81.0: a failed run doesn't redo the steps
 * before it), then stores the system version. Add a migration when a field is renamed or reshaped; new fields with
 * defaults need none. A migration that isn't safe to run twice marks what it changed.
 */
interface Migration {
  version: string;
  label: string;
  run: () => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  // v0.22.0: metatype and care fields have defaults; nothing to convert. Kept as the first entry.
  { version: "0.22.0", label: "Metatypes and care (no data changes)", run: async () => {} },
  // v0.27.0: IC gained a behavior (default killer); set it from the IC type name where that names one.
  { version: "0.27.0", label: "IC behaviors from their type names", run: async () => {
    for (const a of [...(game.actors ?? [])].filter((x: any) => x.type === "ic")) {
      const b = icBehaviorUpdate(a.system?.icType, a.system?.behavior);
      if (b) await a.update({ "system.behavior": b });
    }
  } },
  // v0.40.0: psychotropic IC are modeled; IC named for one (still on the default killer) become psychotropic.
  { version: "0.40.0", label: "Psychotropic IC from their type names", run: async () => {
    for (const a of [...(game.actors ?? [])].filter((x: any) => x.type === "ic")) {
      if (icBehaviorUpdate(a.system?.icType, a.system?.behavior) === "psychotropic") await a.update({ "system.behavior": "psychotropic" });
    }
  } },
  // v0.59.0: v0.58.0's data on every copy: bone lacing and filtration typed by name (they came in as
  // 'other'), and vehicle skills still on Quickness linked to Reaction. World actors, the actors of
  // unlinked tokens on every scene, and world items.
  { version: "0.59.0", label: "Bone lacing, filtration and vehicle skills (v0.58.0 data)", run: async () => {
    for (const actor of everyActor()) {
      const ups = ownItems(actor).map((i: any) => ({ _id: i.id, ...(itemMigrationUpdate(i) ?? {}) })).filter((u: any) => Object.keys(u).length > 1);
      if (ups.length) await actor.updateEmbeddedDocuments("Item", ups);
    }
    for (const item of [...(game.items ?? [])] as any[]) {
      const up = itemMigrationUpdate(item);
      if (up) await item.update(up);
    }
  } },
  // v0.77.0: the book check made Killing Hands four levels (L/M/S/D, was M/S/D): saved powers move up
  // one level so they keep their damage (not when the GM has set the level table as a house rule).
  // The GM gets a note on the other changes that touch existing characters.
  { version: "0.77.0", label: "Killing Hands levels (book check)", run: async () => {
    const custom = Boolean((game.settings.get(SYSTEM.id as any, "houseRules" as any) as any)?.values?.["ADEPT.killingHands.levels"]);
    let n = 0;
    if (!custom) {
      // v0.81.0 (A-4): "+1 level" isn't safe to run twice, so each moved power is marked (MIG077) and skipped after.
      for (const actor of everyActor()) {
        const ups = ownItems(actor).map((i: any) => { const up = killingHandsMigrationUpdate(i); return up ? { _id: i.id, ...up, [MIG077]: true } : null; }).filter(Boolean) as any[];
        if (ups.length) { await actor.updateEmbeddedDocuments("Item", ups); n += ups.length; }
      }
      for (const item of [...(game.items ?? [])] as any[]) {
        const up = killingHandsMigrationUpdate(item);
        if (up) { await item.update({ ...up, [MIG077]: true }); n++; }
      }
    }
    const gms = [...((game as any).users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);
    await (globalThis as any).ChatMessage?.create?.({ whisper: gms, content: `<p><strong>${tx('SR2E.Card.Migrations.sr2eV0770RulesValues')}</strong> ${tx('SR2E.Card.Migrations.alsoImprovedReflexesMadeByThe', { part: custom ? tx('SR2E.Card.Migrations.killingHandsLevelsAreAHouse') : tCount(n, 'SR2E.Card.Migrations.killingHandsNowHasFourLevels') })}</p>` });
  } },
  // v0.81.1 (RB2-6): v0.81.0 removed some rules (one merged into another). A world's stored house rules for them were
  // ignored with only a console line: the merged one moves across, the others are dropped, and the GM is told.
  { version: "0.81.1", label: "House rules for removed rules", run: async () => {
    // Loaded here, not at the top: settings.ts builds Foundry windows when it loads.
    const { getPath, RULE_DEFAULTS } = await import("./settings.ts");
    const stored = game.settings.get(SYSTEM.id as any, "houseRules" as any) as HouseRules | null;
    const r = houseRulesCleanup(stored, (path) => getPath(RULE_DEFAULTS, path) !== undefined);
    if (r.moved.length || r.dropped.length) await game.settings.set(SYSTEM.id as any, "houseRules" as any, r.next as any);
    // Round 2 (FIX2-BRIEF I1): the house rules the shape check refuses at load are whispered to the GM by
    // settings.ts reportRefusedHouseRules at every world load whose list is new (round 3, V2 #17), not here.
    const note = houseRulesNote(r, []);
    if (!note) return;
    const gms = [...((game as any).users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);
    await (globalThis as any).ChatMessage?.create?.({ whisper: gms, content: note });
  } },
];

/**
 * Pure (round 2): the GM's note for the 0.81.1 house-rule check: what moved, what was dropped, and what is refused at
 * load (each with its reason). '' when there is nothing to say.
 */
export function houseRulesNote(r: { moved: string[]; dropped: string[] }, refused: readonly string[]): string {
  if (!r.moved.length && !r.dropped.length && !refused.length) return "";
  const list = (xs: readonly string[]) => xs.map((x) => `<code>${escHtml(x)}</code>`).join(", ");
  return `<p><strong>${tx('SR2E.Card.Migrations.sr2eV0811HouseRules')}</strong>${tx('SR2E.Card.Migrations.checkTheHouseRulesWindowIf', { part: r.moved.length ? tx('SR2E.Card.Migrations.movedToTheRuleThatReplaced', { list: list(r.moved) }) : "", part2: r.dropped.length ? tx('SR2E.Card.Migrations.droppedTheRuleIsGoneSo', { list: list(r.dropped) }) : "", part3: refused.length ? tx('SR2E.Card.Migrations.notAppliedTheValueIsnT', { list: list(refused) }) : "" })}</p>`;
}

/** v0.81.1 (RB2-6): rules v0.81.0 merged into another; a world's override of the old path moves to the new one. */
export const RENAMED_RULES: Readonly<Record<string, string>> = { "MAGIC_EXTRA.elementCategories": "MAGIC_EXTRA.elementalCategories" };

/**
 * Pure (v0.81.1, RB2-6): the stored house rules without the paths that are no longer rules (`isRule`), with a renamed
 * rule's value moved to its new path (unless the world set that one too). Returns what moved and what was dropped.
 */
export function houseRulesCleanup(stored: HouseRules | null | undefined, isRule: (path: string) => boolean): { next: HouseRules; moved: string[]; dropped: string[] } {
  const moved: string[] = [], dropped: string[] = [];
  const next: HouseRules = { values: { ...(stored?.values ?? {}) }, advanced: { ...(stored?.advanced ?? {}) } };
  for (const part of ["values", "advanced"] as const) {
    const rec = next[part]!;
    for (const path of Object.keys(rec)) {
      if (isRule(path)) continue;
      const to = Object.hasOwn(RENAMED_RULES, path) ? RENAMED_RULES[path]! : "";
      if (to && isRule(to) && !Object.hasOwn(next.values!, to) && !Object.hasOwn(next.advanced!, to)) { rec[to] = rec[path]; moved.push(`${path} → ${to}`); }
      else dropped.push(path);
      delete rec[path];
    }
  }
  return { next, moved, dropped };
}

/** v0.81.0: the marker on a Killing Hands power migration 0.77.0 moved (it never moves one twice). */
const MIG077 = `flags.${SYSTEM.id}.mig077`;

/** v0.77.0: a Killing Hands adept power saved under the old M/S/D levels moves up one level (max 4); null = none (or already moved). */
export function killingHandsMigrationUpdate(i: { type: string; system?: any; flags?: any }): Record<string, unknown> | null {
  if (i?.type !== "adeptpower" || i.system?.special !== "killingHands") return null;
  if (i.flags?.[SYSTEM.id]?.mig077) return null;
  const level = Number(i.system?.level ?? 0);
  if (!(level >= 1) || level >= 4) return null;
  return { "system.level": Math.min(4, Math.floor(level) + 1) };
}

/** World actors and the synthetic actors of unlinked tokens on every scene (A-14: helpers/actors.ts allActors). */
export function everyActor(): any[] {
  return allActors();
}

/**
 * The items a migration may change on an actor. v0.81.0 (A-4): on an unlinked token's actor only those its delta
 * holds (the rest show the world actor's items, migrated there; updating them would copy them all into the delta,
 * detaching the token from later edits of its actor, or move them a second time).
 */
export function ownItems(actor: any): any[] {
  const items: any[] = [...(actor?.items ?? [])];
  if (!actor?.isToken) return items;
  const delta: any = actor.token?.delta;
  const src: any[] = delta?._source?.items ?? [];
  const ids = new Set(src.map((i: any) => i?._id).filter(Boolean));
  return items.filter((i: any) => ids.has(i.id));
}

/** v0.59.0: the update an item needs for v0.58.0's data (null = none). */
export function itemMigrationUpdate(i: { type: string; name: string; system?: any }): Record<string, unknown> | null {
  const name = String(i.name ?? "");
  const sys = i.system ?? {};
  if (i.type === "skill") return sys.attribute === "quickness" && vehicleSkillAttribute(name) ? { "system.attribute": "reaction" } : null;
  if (i.type !== "cyberware") return null;
  const n = name.toLowerCase();
  if (/bone\s*lac/.test(n) && (sys.kind === "other" || (sys.kind === "boneLacing" && !sys.lacing))) {
    const lacing = /titan/.test(n) ? "titanium" : /alumin/.test(n) ? "aluminum" : /plastic/.test(n) ? "plastic" : "";
    return { "system.kind": "boneLacing", ...(lacing ? { "system.lacing": lacing } : {}) };
  }
  if (/filt/.test(n) && (sys.kind === "other" || (sys.kind === "filtration" && !sys.filterKind))) {
    const filterKind = /blood/.test(n) ? "blood" : /air|lung|breath/.test(n) ? "air" : /ingest|gut|stomach|toxin/.test(n) ? "ingested" : "";
    return { "system.kind": "filtration", ...(filterKind ? { "system.filterKind": filterKind } : {}) };
  }
  return null;
}

/** The behavior an existing IC should get from its type name (null = leave it). */
export function icBehaviorUpdate(icType: string | undefined, current: string | undefined): string | null {
  const b = behaviorFromName(String(icType ?? ""));
  return b && b !== (current ?? "killer") ? b : null;
}

/** Compare two dotted versions: negative if a < b. */
export function compareVersions(a: string, b: string): number {
  const pa = String(a).split(".").map((n) => Number(n) || 0), pb = String(b).split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Which migrations still need to run for a world at `stored`. */
export function pendingMigrations(stored: string, list: readonly { version: string }[] = MIGRATIONS): string[] {
  return list.filter((m) => compareVersions(m.version, stored || "0.0.0") > 0).map((m) => m.version);
}

export function registerMigrationSetting(): void {
  game.settings.register(SYSTEM.id, "migrationVersion", { scope: "world", config: false, type: String, default: "" });
}

export async function runMigrations(): Promise<void> {
  if (!game.user?.isGM) return;
  // v0.59.0: only the active GM migrates (two GMs logging in at once must not both run them). v0.85.0: and only its
  // lead window, once the windows have heard each other.
  await leadSettled();
  if (!isLeadGm()) return;
  const stored = String(game.settings.get(SYSTEM.id, "migrationVersion") ?? "");
  // A-4: the tested pendingMigrations is the filter that runs.
  const pending = new Set(pendingMigrations(stored));
  const todo = MIGRATIONS.filter((m) => pending.has(m.version));
  for (const m of todo) {
    try {
      console.log(`${SYSTEM.LOG.HEAD}Migrating world data to ${m.version}: ${m.label}`);
      await m.run();
      // A-4: each step is stored as it succeeds, so a later failure doesn't run this one again next time.
      await game.settings.set(SYSTEM.id, "migrationVersion", m.version);
    } catch (err) {
      console.error(`${SYSTEM.LOG.HEAD}Migration ${m.version} failed`, err);
      ui.notifications?.error?.(tx('SR2E.Notify.Migrations.sr2eMigrationToFailedSeeThe', { version: escHtml(m.version) }));
      return;
    }
  }
  // Foundry reports the old system version until it restarts, so store whichever is newer.
  const candidates = [String(game.system?.version ?? ""), MIGRATIONS.at(-1)?.version ?? "", stored].filter(Boolean);
  const current = candidates.reduce((a, b) => (compareVersions(a, b) >= 0 ? a : b), "0.0.0");
  if (current !== stored) await game.settings.set(SYSTEM.id, "migrationVersion", current);
}
