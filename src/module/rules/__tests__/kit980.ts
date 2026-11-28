/**
 * v0.99.0: the v0.98.0 values of every switch the gear rules completeness added (RULES.KIT_V99). Older test files that
 * pin the v0.98.0 behaviour lay this patch with oldWay().
 */
import { HOUSE_KIT_V99 } from '../config99/kit.ts';

export const KIT_V980_WAY: Record<string, unknown> = Object.fromEntries(
  HOUSE_KIT_V99.filter((r) => r.type === 'select' && r.choices?.includes('v980')).map((r) => [r.path, 'v980']),
);
