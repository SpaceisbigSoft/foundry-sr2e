# v0.89.0 review: localization, first slice

24 Oct 2026. The owner chose to do the localization **in slices** (0.89.0, 0.89.1, …): all the text is more than one version's work (about 1,000 notifications, every chat card and dialog, the rule labels, 27 templates and the 130 KB guide). An independent reviewer (a fresh agent that didn't write the code) read the change. It found no bug that changes what anyone sees, plus 4 risks and 5 nits. All were fixed or carried into the plan.

## What changed

- **Templates:** every piece of text in all 27 templates comes from `lang/en.json` (`SR2E.UI.*`, 1,977 strings) through `{{sr2eT "SR2E.UI.key" name=value}}`.
  - `scripts/i18n-templates.mjs` made the change. It turns each run of text between tags (with its simple `{{values}}`) and each static title, placeholder, aria-label, data-tooltip and alt into one string. Block helpers, triple-stash values, comments and tags stay as they were. The same English gets the same key.
  - A round trip (each string put back as English) gave the original text for every template.
- **Settings:** every setting's and menu's name, hint, label and choice labels are `SR2E.Settings.<key>.*` (Foundry translates those fields itself).
- **Hotkeys:** the two undo hotkeys joined the others under `SR2E.Keybindings.*`.
- **`helpers/i18n.ts`:**
  - `t(key, data)` for code, and `tHtml` for HTML (it escapes the values);
  - `formatText`: Foundry's translation with `{name}` filled in, empty for a missing value (Foundry's own `format` prints "undefined"), and a function value called rather than printed;
  - the `sr2eT` helper, registered at init.
- **The ratchet:** `__tests__/helpers/i18n-scan.ts` counts the English still written in the code, per file. It scans whole files, so a template literal over several lines counts once, and comments and selectors don't count. The counts are in `helpers/i18n-baseline.json` (9,248 in total) and may only go down.
- **Tests:** `__tests__/v089.test.ts`. Tests that look for English in a template read it through `helpers/english.ts`, which puts the English back.

## Findings

| # | Kind | Finding | Outcome |
|---|---|---|---|
| — | Check | The reviewer rendered every template from v0.88.0 and v0.89.0 with real Handlebars: full data (every branch) and empty data (every else), with partials and hostile values. | The output is the same apart from whitespace and equivalent HTML escaping. Tooltips held no HTML, so nothing changes there. |
| 1 | Risk | A value that is a function would print its source code. | `formatText` calls it, as `{{x}}` would. Tested. |
| 2 | Risk | The ratchet scanned line by line: it missed multi-line template literals (dialog and card HTML) and skipped whole lines holding a selector. | It now scans whole files, without comments, and skips only literals that are code arguments (a selector, a log, an import). Rebaselined. Single words aren't counted (noted). |
| 3 | Risk | Code finds things by their English text: the "(GM)" title marker, the guide's "?" links matched by heading text (only 48 of 222 headings have `data-help`), the add window's heading words, section icons, fold keys, and the chat-card outcome words. | Works in English. **Carried into the plan:** a slice gives these elements `data-*` ids before any translation ships. |
| 4 | Risk | Translators get fragments split by block helpers (357 strings start lowercase or with punctuation), and one key per English text loses context ("Off" everywhere). | Carried into the plan: a later slice joins the fragments and adds context keys where needed. |
| 5 | Nit | The converter would lose a non-breaking space on a later run. | It collapses only ordinary whitespace now. |
| 6 | Nit | Still English: setting choices given as spread constants (theme, preset, rules source), the per-sound settings, and the undo hotkeys. | The undo hotkeys are done; the rest go into the next slice. `KEEP_ERRORS_KEY` is used again. |
| 7 | Nit | `t()` had a dead branch and doesn't escape. | Simplified, and `tHtml` added for HTML. |
| 8 | Nit | The test helper's entity mapping. | Removed. |
| 9 | Nit | Only one template was rendered in the tests. | Every template now renders with empty data and partials, and the test checks that no key, placeholder or "undefined" shows. |

## Checked live (GM AI, 24 Oct 2026)

With the demo and a spirit, a barrier and an IC:
- Every actor sheet and every one of its tabs, item sheets of nine types, all nine GM panel tabs, the NPC generator, the creation wizard, Spend Karma and the guide showed no key, placeholder or "undefined".
- The Magic tab looked as before.
- Configure Settings and Configure Controls show every SR2e name and hint in English. One live fix: the default-art hint had become its key, because the script ran twice. The test now fails if any value in the language file is itself a key.
- The demo and the test actors were removed afterwards; the world is back to 22 actors, 1 scene, 0 journal entries and 3 folders.
