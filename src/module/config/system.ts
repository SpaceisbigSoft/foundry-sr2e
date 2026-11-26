/**
 * v0.93.1: the system id (it was `sr2e` up to v0.93.0; another Shadowrun 2e system uses that one). The scripting names stay
 * as they were (`game.sr2e`, the `sr2e.*` hooks), and so do the CSS classes, the text keys and the console prefix.
 */
export const SYSTEM_ID = "shadowrun2e_unified";

export const SYSTEM = {
  id: SYSTEM_ID,
  // The console prefix stays `sr2e | ` (bug reports and console filters look for it).
  LOG: { HEAD: `sr2e | ` },
  PATH: {
    ROOT: `systems/${SYSTEM_ID}`,
    TEMPLATES: `systems/${SYSTEM_ID}/templates`,
  },
} as const;
