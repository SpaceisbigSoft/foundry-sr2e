/**
 * v0.96.0: the v0.95.1 values of every switch the spirits and astral rules completeness added (RULES.SPIRITS_V96).
 * Older test files that pin the v0.95.1 behaviour lay this patch with oldWay().
 */
import { HOUSE_SPIRITS_V96 } from '../config96/spirits.ts';

export const SPIRITS_V951_WAY: Record<string, unknown> = Object.fromEntries(
  HOUSE_SPIRITS_V96.filter((r) => r.type === 'select').map((r) => [r.path, 'v951']),
);
