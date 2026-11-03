/**
 * v0.80.0: the "SR2E Unified Rules Revamp" rules source, a GM-selected layer under the house rules
 * (settings.ts applyHouseRules: shipped RULES → this patch → the house-rule values). The default rules
 * ("SR2E Book Rules") never change because of it: every URR_V80 switch ships at the book's way, and only
 * URR_V80_PATCH (applied when the world's "Rules source" is the Unified Rules Revamp) turns them on.
 * Each area's switches, numbers and notes are in rules/config80-<area>.ts.
 */
import { URR_V80_CORE, URR80_PATCH_CORE } from './config80-core.ts';
import { URR_V80_HEALTH_SOCIAL, URR80_PATCH_HEALTH_SOCIAL } from './config80-health-social.ts';
import { URR_V80_COMBAT, URR80_PATCH_COMBAT } from './config80-combat.ts';
import { URR_V80_VEHICLES, URR80_PATCH_VEHICLES } from './config80-vehicles.ts';
import { URR_V80_DRONES_SECURITY, URR80_PATCH_DRONES_SECURITY } from './config80-drones-security.ts';
import { URR_V80_MAGIC, URR80_PATCH_MAGIC } from './config80-magic.ts';

export const URR_V80 = {
  /** True only under the Unified Rules Revamp (set by the patch); for labels, not for rules decisions. */
  active: false as boolean,
  ...URR_V80_CORE,
  ...URR_V80_HEALTH_SOCIAL,
  ...URR_V80_COMBAT,
  ...URR_V80_VEHICLES,
  ...URR_V80_DRONES_SECURITY,
  ...URR_V80_MAGIC,
};

/** Each area's patch, kept apart so a test can check that no two areas set the same path. */
export const URR80_PATCHES: Record<string, Record<string, unknown>> = {
  core: URR80_PATCH_CORE,
  'health-social': URR80_PATCH_HEALTH_SOCIAL,
  combat: URR80_PATCH_COMBAT,
  vehicles: URR80_PATCH_VEHICLES,
  'drones-security': URR80_PATCH_DRONES_SECURITY,
  magic: URR80_PATCH_MAGIC,
};

/** The whole Unified Rules Revamp patch: RULES path → value. */
export const URR_V80_PATCH: Record<string, unknown> = Object.assign(
  { 'URR_V80.active': true },
  ...Object.values(URR80_PATCHES),
);

/** The world setting's choices (names chosen by the owner). v0.89.4: keys (lang/en.json); show them with t(). */
export const RULES_SOURCES = {
  book: 'SR2E.Settings.rulesSource.Choices.book',
  urr: 'SR2E.Settings.rulesSource.Choices.urr',
} as const;
export type RulesSource = keyof typeof RULES_SOURCES;
