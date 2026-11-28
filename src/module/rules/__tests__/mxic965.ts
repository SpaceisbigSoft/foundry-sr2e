/**
 * v0.97.0: the v0.96.5 values of every switch the Matrix IC and cybercombat rules completeness added (RULES.MXIC_V97).
 * Older test files that pin the v0.96.5 behaviour lay this patch with oldWay().
 */
import { HOUSE_MXIC_V97 } from '../config97/mxic.ts';

export const MXIC_V965_WAY: Record<string, unknown> = Object.fromEntries(
  HOUSE_MXIC_V97.filter((r) => r.type === 'select').map((r) => [r.path, 'v965']),
);
