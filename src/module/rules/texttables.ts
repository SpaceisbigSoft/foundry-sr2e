/**
 * v0.89.4: the tables outside RULES whose text is shown to people, translated in place once Foundry has its languages
 * (settings.ts localizeRulesTexts; keys `SR2E.Tables.<key>.*`, written into lang/en.json by scripts/i18n-rules.ts).
 * Only labels, help lines and flavour: names (people, gangs, corps), skill names, item names and ids are data and stay
 * as they are (the owner's decision, 25 Oct 2026).
 */
import type { TextTable } from './rulestext.ts';
import { ADD_TYPES, PAYMENT_LABELS, SKILL_KIND_LABELS } from './catalogue.ts';
import { CATALOGUE_COLUMNS, CATALOGUE_SHORTHANDS, VEHICLE_COLUMNS, VEHICLE_SHORTHANDS } from './catalogcsv.ts';
import * as D from './npcdata.ts';
import { ARCHETYPES, GROUP_KINDS, CRITTERS, CORP_SCALE, ORG_SCALE, SECURITY } from './npcgen.ts';
import { WEAPON_LAYOUT_LABELS } from './items.ts';
import { LIMB_LABELS, THROW_LABELS, COMPASS } from './armory.ts';
import { IC_BEHAVIOR_LABELS, PSYCHOTROPIC_LABELS } from './matrix.ts';
import { ELEMENT_EFFECT_LABELS } from './mysticism.ts';
import { LIGHT_LABELS, VISION_LABELS } from './situation.ts';
import { CONCEAL_LABELS } from './outfit.ts';
import { HUD_GROUPS, HUD_LAYOUT } from './hudactions.ts';
import { WIZARD_STEPS } from './advancement.ts';
import { FIGURE_LABELS, ARCHETYPE_LABELS } from './tokenart.ts';
import { SETTING_SECTIONS } from './interface.ts';

/** The NPC generator's flavour lines (descriptions written into new actors and journals, in the GM's language). */
const FLAVOUR = ['GANG_THEMES', 'GANG_COLOURS', 'APPEARANCE', 'CLOTHING', 'DISTINCTIVE', 'MANNERISM', 'MOTIVATION', 'SECRET', 'INDUSTRIES', 'ORG_KINDS', 'ORG_QUIRKS', 'ORG_GOALS', 'ORG_HQS',
  'JOB_TYPES', 'JOB_TARGETS', 'JOB_LOCATIONS', 'JOB_COMPLICATIONS', 'JOB_TWISTS', 'MEETING_PLACES', 'EMPLOYERS', 'SPIRIT_FLAVOUR', 'CRITTER_FLAVOUR'] as const;

export const TEXT_TABLES: readonly TextTable[] = [
  { key: 'addTypes', table: ADD_TYPES, fields: ['label', 'one'], idField: 'type' },
  { key: 'payment', table: PAYMENT_LABELS, all: true },
  { key: 'skillKinds', table: SKILL_KIND_LABELS, all: true },
  { key: 'catalogueColumns', table: CATALOGUE_COLUMNS, fields: ['help'], idField: 'path' },
  { key: 'catalogueShorthands', table: CATALOGUE_SHORTHANDS, fields: ['help'], idField: 'name' },
  // v0.91.4: the new-entry form's vehicle and drone fields.
  { key: 'vehicleColumns', table: VEHICLE_COLUMNS, fields: ['help'], idField: 'path' },
  { key: 'vehicleShorthands', table: VEHICLE_SHORTHANDS, fields: ['help'], idField: 'name' },
  ...FLAVOUR.map((k) => ({ key: `npc.${k}`, table: (D as any)[k], all: true })),
  { key: 'npc.CONTACT_ROLES', table: D.CONTACT_ROLES, fields: ['label'] },
  { key: 'npc.archetypes', table: ARCHETYPES, fields: ['label'] },
  { key: 'npc.groupKinds', table: GROUP_KINDS, fields: ['label'] },
  { key: 'npc.critters', table: CRITTERS, fields: ['label'] },
  { key: 'npc.corpScale', table: CORP_SCALE, all: true },
  { key: 'npc.orgScale', table: ORG_SCALE, all: true },
  { key: 'npc.security', table: SECURITY, all: true },
  // v0.89.6: labels of the rules' own lookup tables (display only; looked up by their ids)
  { key: 'weaponLayouts', table: WEAPON_LAYOUT_LABELS, all: true },
  { key: 'limbs', table: LIMB_LABELS, all: true },
  { key: 'icBehaviors', table: IC_BEHAVIOR_LABELS, all: true },
  { key: 'psychotropic', table: PSYCHOTROPIC_LABELS, all: true },
  { key: 'elementEffects', table: ELEMENT_EFFECT_LABELS, all: true },
  { key: 'light', table: LIGHT_LABELS, all: true },
  { key: 'vision', table: VISION_LABELS, all: true },
  { key: 'concealment', table: CONCEAL_LABELS, all: true },
  { key: 'scatterThrow', table: THROW_LABELS, all: true },
  { key: 'scatterCompass', table: COMPASS, all: true },
  { key: 'hudGroups', table: HUD_GROUPS, fields: ['name'] },
  { key: 'hudLayout', table: HUD_LAYOUT, fields: ['name'] },
  { key: 'wizardSteps', table: WIZARD_STEPS, fields: ['label', 'hint'] },
  { key: 'artFigures', table: FIGURE_LABELS, all: true },
  { key: 'artArchetypes', table: ARCHETYPE_LABELS, all: true },
  { key: 'settingSections', table: SETTING_SECTIONS, fields: ['label'] },
];
