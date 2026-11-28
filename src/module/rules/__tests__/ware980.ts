/**
 * v0.99.0: the v0.98.0 values of every switch the cyberware and bioware rules completeness added (RULES.WARE_V99).
 * Older test files that pin the v0.98.0 behaviour lay this patch with oldWay().
 */
import { HOUSE_WARE_V99 } from '../config99/ware.ts';

export const WARE_V980_WAY: Record<string, unknown> = Object.fromEntries(
  HOUSE_WARE_V99.filter((r) => r.type === 'select' && r.choices?.includes('v980')).map((r) => [r.path, 'v980']),
);
