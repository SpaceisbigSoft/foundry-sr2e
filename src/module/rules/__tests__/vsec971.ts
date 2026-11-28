/**
 * v0.98.0: the v0.97.1 values of every switch the building security and vehicle upkeep rules completeness added
 * (RULES.VSEC_V98). Older test files that pin the v0.97.1 behaviour lay this patch with oldWay().
 */
import { HOUSE_VSEC_V98 } from '../config98/vsec.ts';

export const VSEC_V971_WAY: Record<string, unknown> = Object.fromEntries(
  HOUSE_VSEC_V98.filter((r) => r.type === 'select' && r.choices?.includes('v971')).map((r) => [r.path, 'v971']),
);
