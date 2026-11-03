/**
 * v0.79.0 verified fixes: rules where the system differed from the official SR2 rules (each cites its book: SRII,
 * SR2 core, Rigger 2); they are the default now, and
 * each behaviour change has a house-rule switch back to the old way (first choice: the book's way). Read
 * through RULES.DOCS_V79; each area's switches and their notes are in rules/config79-<area>.ts.
 */
import { DOCS_V79_RANGED } from './config79-ranged.ts';
import { DOCS_V79_MELEE_VISION } from './config79-melee-vision.ts';
import { DOCS_V79_HEALTH } from './config79-health.ts';
import { DOCS_V79_SOCIAL_CORE } from './config79-social-core.ts';
import { DOCS_V79_VEHICLES } from './config79-vehicles.ts';
import { DOCS_V79_DRONES_MAGIC } from './config79-drones-magic.ts';

export const DOCS_V79 = {
  ...DOCS_V79_RANGED,
  ...DOCS_V79_MELEE_VISION,
  ...DOCS_V79_HEALTH,
  ...DOCS_V79_SOCIAL_CORE,
  ...DOCS_V79_VEHICLES,
  ...DOCS_V79_DRONES_MAGIC,
};
