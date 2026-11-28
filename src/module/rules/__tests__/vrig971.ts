/**
 * v0.98.0: the v0.97.1 values of every switch the rigging, drones, sensors and electronic warfare rules completeness
 * added (RULES.VRIG_V98): each select at 'v971', the optional electronic deception rule 'off'. Older test files that pin
 * the v0.97.1 behaviour lay this patch with oldWay().
 */
import { HOUSE_VRIG_V98 } from '../config98/vrig.ts';

export const VRIG_V971_WAY: Record<string, unknown> = Object.fromEntries(
  HOUSE_VRIG_V98.filter((r) => r.type === 'select').map((r) => [r.path, r.choices?.includes('v971') ? 'v971' : 'off']),
);
