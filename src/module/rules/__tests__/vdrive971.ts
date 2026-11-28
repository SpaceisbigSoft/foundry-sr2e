/**
 * v0.98.0: the v0.97.1 values of every switch the vehicles rules completeness added (RULES.VDRIVE_V98). Older test files
 * that pin the v0.97.1 behaviour lay this patch with oldWay().
 */
import { HOUSE_VDRIVE_V98 } from '../config98/vdrive.ts';

export const VDRIVE_V971_WAY: Record<string, unknown> = Object.fromEntries(
  HOUSE_VDRIVE_V98.filter((r) => r.type === 'select').map((r) => [r.path, 'v971']),
);
