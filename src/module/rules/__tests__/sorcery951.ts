/**
 * v0.96.0: the v0.95.1 sorcery behaviour (every RULES.SORCERY_V96 switch at its old way), for older tests that pin it.
 * The book's way is tested in v096-sorcery.test.ts and v096-sorcery-glue.test.ts.
 * Use as `t.after(oldWay(SORCERY_V951))` or `before(() => { undo = oldWay(SORCERY_V951); })`.
 */
import { SORCERY_V96 } from '../config96/sorcery.ts';

export const SORCERY_V951: Record<string, unknown> = Object.fromEntries(
  Object.entries(SORCERY_V96).filter(([, v]) => v === 'book').map(([k]) => [`SORCERY_V96.${k}`, 'off']),
);
