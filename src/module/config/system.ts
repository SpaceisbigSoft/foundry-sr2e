export const SYSTEM_ID = "sr2e";

export const SYSTEM = {
  id: SYSTEM_ID,
  LOG: { HEAD: `${SYSTEM_ID} | ` },
  PATH: {
    ROOT: `systems/${SYSTEM_ID}`,
    TEMPLATES: `systems/${SYSTEM_ID}/templates`,
  },
} as const;
