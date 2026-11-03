# v0.89.4 review: localization, fifth slice (rule and item labels)

## What changed

- **House rules** (settings.ts, the owner's choice to include them, 25 Oct 2026): the 903 rules lost their English: `section` is an id (`SR2E.HouseRules.Section.<id>`, 23 sections), the label's key comes from the path (`SR2E.HouseRules.Rule.<path, dots as __>`; `houseRuleKey` / `houseRuleLabel` / `houseRuleSection`), written by `scripts/i18n-houserules.mjs`. The House rules, Skill Web and Roll privacy windows' own text and the GM's "house rules not applied" card are `SR2E.App.Settings.*` (the card converter, text inside `<code>` kept as it is).
- **Label maps and setting choices hold keys** (English in lang/en.json): `RULES_SOURCES`, `THEME_LABELS`, `PRESET_LABELS`, `LAYOUT_LABELS` (Foundry translates setting choices), `SOUND_EVENTS` (per-sound setting names), `PRIVACY_GROUPS` / `PRIVACY_MODES`, and the five interface settings' names and hints (missed in v0.89.0). `tKey(key)` (helpers/i18n.ts) translates a key that comes from a data table.
- **The rules tables are translated in place** (rules/rulestext.ts): RULES (fields label, note, text, skillHint, spiritLabel, the disaster suggestions; key `SR2E.Rules.<path>`, array items by a unique `id`, else by index), the Revamp patch (`SR2E.RulesUrr.*`) and the tables in rules/texttables.ts (`SR2E.Tables.*`: the Add window's types, payment and skill-kind labels, the catalogue CSV columns' and shorthands' help, the NPC generator's flavour lists, contact-role, archetype, critter and group labels; names, skills, item names and ids stay data, the owner's choice). They keep their English in the code; `localizeRulesTexts` (settings.ts) translates RULES, `RULE_DEFAULTS`, the patch and the tables on Foundry's `i18nInit` hook, then applies the rules source and house rules again. `scripts/i18n-rules.ts` writes the English (460 rules texts, 104 Revamp texts, 1,086 table texts).
- **Modifier rows:** the card converter now treats the `label` of a `{ label, value }` row built in a function as shown (330 strings in 48 files), in one shared group `SR2E.Card.Mod` (the same English is the same key in every file; texts that differ only in their placeholders' names share a key). The rows the code looks for carry ids (`wounds`, `sustaining`, `astralPerception`, `blinded`, `flash`, `targetProne`, `attackerProne`, `defenderProne`, `attitude:<id>`, `prejudice`) and are found with `modifierIs(m, id, legacyEnglish)` (rules/dice.ts), the English kept for rows saved on cards before v0.89.4. The defaulting group has the id `skill`.
- **Tooltips:** `FIELD_TOOLTIPS` holds keys (`SR2E.Tooltip.<type|any>.<field, dots as __>`, `scripts/i18n-tooltips.mjs`, 215).
- **Tools:** the card converter runs over every file and has the `SR2E.App` store; `scripts/i18n-equiv.mjs` pairs statements by name when a file gains or loses some (and unnamed ones by position); the ratchet scanner no longer counts CONSTANT_CASE names and rule paths. The ratchet: 7,137 → 4,382 (config.ts, npcdata.ts and the other in-place tables keep their English by design).

## Checking the output

The AST comparison with v0.89.3 finds 53 statements different, all hand edits (the registry and its helpers, the label maps and their readers, the modifier ids and `modifierIs`, the rules-text glue, the tooltip lookup, the NPC generator's English copies, the review fixes). 3,296 tests pass (4 skipped); tsc is clean.

## The independent review (three reviewers: settings and house rules; the rules tables and modifier ids; the converter and its new strings)

| # | Kind | Finding | Outcome |
|---|---|---|---|
| 1 | Bug (all languages) | The rules source and house rules were applied at `init`, then the i18nInit translation wrote the shipped text over the Revamp's labels (9 labels went back to the book's, in English too) and over the GM's advanced overrides | Fixed: the hook applies the house rules again after translating; the "not applied" report uses that list. Test |
| 2 | Bug | The Reset dialog showed the rules source as a raw key | Fixed (`tKey`) |
| 3 | Bug (other languages) | "Attitude: Prejudiced" found by a regex on the translated label (prejudice counted twice) | Fixed: attitude rows carry `attitude:<id>`; `modifierIs`. Test |
| 4 | Bug (other languages) | The NPC job generator classifies jobs and targets by English words over its (translated) lists | Fixed: English copies taken at load, looked up by position. Test |
| 5 | Bug (other languages) | The attack dialog's automatic rows were English literals matched against translated preview labels (no switch-off box) | Fixed: built from the same `SR2E.Card.Mod` keys; one key per row label. Test |
| 6 | Bug (other languages) | The "Skill" group found by its translated name | Fixed: group ids (`skill`), kept through `tnCandidates` and `retargetGroupsV73`. Test |
| 7 | Risk | Same English under two keys in different files (blind fire, "Can't see the target") | Fixed by the shared Mod group |
| 8 | Risk | The GM's Change target number dedupes by label across clients | Partly fixed: ids kept through the dialog and matched by id or label; a mixed-language table can still show a row twice where the rows have no id (v0.89.5) |
| 9 | Risk | "Use again" exclusions and roll-dialog exclusions are labels (a GM re-running a player's card in another language) | v0.89.5 (match modifiers by id) |
| 10 | Risk | Translations inside attributes unescaped | As in v0.89.2: the test that no attribute text holds `"` covers these (escaping would double-escape values) |
| 11 | Risk | The converter prunes `SR2E.App` keys it can't see in .ts files | Accepted: the group is the converter's own |
| 12 | Nit | Fragments around `<code>`, `{part}` | v0.89.5 |
| 13 | Nit | Equivalence checker skipped unnamed statements when pairing by name | Fixed |
| 14 | Nit | The in-place test was weak (circular, no restore, no Revamp case) | Fixed: every looked-up key is a text field, English restored, the Revamp case added |

## Checked live (25 Oct 2026, ZZ Testplayer; GM AI was still held by a stale session)

- All 5,295 keys in the new and changed groups resolve (`game.i18n.has`); the built code names only keys that exist.
- Configure Settings: the theme, preset and layout choices and the interface and sound settings' names read as text, no key shown.
- The House rules window (opened read-only): 903 rows, 23 sections and Advanced, labels and sections as before, "Find a rule…", "Rules source: SR2E Book Rules".
- A test card from an unsaved ZZ actor with wounds: "Base 4; Wounds +2", its modifier row stored with `id: "wounds"`.
- No system errors in the console. The test message deleted.
- Not checked live (needs the GM): the Revamp source switch, the attack dialog's automatic rows, the GM's Change target number, a sheet's tooltips (covered by the tests).

## Known limits

- Matching modifiers by label between a dialog's preview and the roll, roll-dialog and "Use again" exclusions, and the GM's retarget dedupe: fine in English and in one language; mixed languages or two code paths that build the same label differently (smoke, for one) can disagree. v0.89.5 moves these to ids.
- Text built at run time inside `rules/` functions and shown through the sheets (catalogue checks, the wound strip's titles, the NPC generator's description templates, everyday tool labels) is in no slice yet, like the sheets' own code-built text.
- The house-rule select options show their raw values ("book", "warn"), as before.
- Translations of index-keyed table items depend on the item's position (lists without ids).
