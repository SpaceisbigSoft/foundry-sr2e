# v0.92.4 review: the anti-vehicle rocket

- **Changed (the owner's decision, 12 Nov 2026):** the anti-vehicle rocket's blast falloff is the book's −8 Power per metre (Core p. 99; `COMBAT.grenades` avRocket perMetre 8). The v0.78.0–v0.92.3 stand-in (−1 per 4 m) is the house rule `COMBAT_V923.avRocket` 'old' (`avRocketOldPerMetre` 0.25), read by `blastFalloff` through `avRocketOldFalloff` (`rules/combat923.ts`). Under the Unified Rules Revamp the Revamp's own value (8) decides (`REVAMP_COMBAT_RULES`).
- **Confirmed (the owner, 12 Nov 2026):** the passkey keeps the Core price, ¥10,000 × Rating (the Corporate Security Handbook's × Rating² is not used).
- **Tests:** `rules/__tests__/v0923-combat.test.ts` (book, old, the Revamp, the house-rules row); `v078.test.ts` keeps the old value's check.
