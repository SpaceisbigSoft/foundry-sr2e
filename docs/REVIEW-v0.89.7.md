# v0.89.7 review: localization, last slice (the in-game guide)

## What changed

- **The guide's text is in `lang/en.json`** (`SR2E.Guide`): 55 topics, each a `title` and its blocks in order (`b1`, `b2` … a paragraph each, or a list of items `i1`, `i2` …): 240 blocks, 444 texts in all; the 10 category labels (`SR2E.Guide.Category.*`) and the note a player sees on a GM topic (`SR2E.Guide.gmOnly`). A one-off script split each body and checked that the blocks put back together give the old body exactly.
- **rules/guide.ts** keeps each topic's id, audience, heading aliases (English: they are matched against the templates' `data-heading` ids) and its block list (`'p'` or a list's item count). Titles, bodies and category labels are getters, read when the guide is shown (never at load). `guideTopicKeys(topic)` lists a topic's keys. Guide texts keep their inline tags (strong, em, kbd, code, topic links) and are read with the new `tRaw` (no placeholders are filled, so a roll-link example's `{label}` stays).
- **The help window**: the "?" link's label is `SR2E.App.Help.helpFor` ("Help: {title}").
- **Headings in other languages**: eight headings the guide explains had no English id and showed no "?" in another language. The combat column's Defense, Weapons, Spells and Actions now carry `data-heading`. "Conjuring {rating}" on the character and NPC sheets, "Remote control deck {rcd}", "Group: {name}" and "Session checklist {session}" carry `data-help` with their topic. Their now-dead aliases ("Conjuring", "Remote control deck", "Group", "Session") are gone.
- **The English is unchanged**: `docs/PLAYER-GUIDE.md` is generated from the same texts and compared byte for byte (only its "generated from" comment now names the language file).
- **The ratchet**: 2,453 → 2,344 (guide.ts 184 → 75: the heading aliases).
- `docs/TRANSLATING.md`: the `SR2E.Text` and `SR2E.Guide` groups, and the guide's rules (inline tags kept, link targets unchanged, block counts fixed by the code, braces shown as written).

## Checking the output

3,333 tests (3,329 pass, 4 skipped), tsc clean, every converter's `--check` finds nothing. The new `v0897.test.ts`:
- every topic key exists and every guide text belongs to a topic, a category or the GM note;
- only the inline tags appear in guide texts, balanced, and every link goes to a real topic;
- no key shows in a title, body or label, and no English body is left in the code;
- a translation is read when the guide is shown, and braces stay;
- the English Markdown is unchanged;
- every template heading the guide explains carries an id.

The bundle is 115 KB smaller (the text moved to the language file).

## The independent review (one fresh reviewer over the diff and the language file)

It compared every topic's title and text, every category and the GM note, old and new: identical. It found no load-time read, no copy that loses the getters, and no escaping gap (titles escaped; the bodies are the allow-listed HTML from the language file).

| # | Kind | Finding | Outcome |
|---|---|---|---|
| 1 | Risk | A translator's `{word}` in a guide text would be emptied by the placeholder filler (the English `{Shoot the lock}` survived only because of its spaces) | Fixed: guide texts are read with `tRaw`. Test; checked live with a German `{Schloss}` |
| 2 | Risk (older) | Eight guide headings had no English id, so no "?" in another language (combat column, Conjuring, Remote control deck, Group) | Fixed: `data-heading` / `data-help` (and "Session checklist", found by the new test). Test; checked live |
| 3 | Nit | PLAYER-GUIDE.md's comment and help.ts's file comment named the old place of the text | Fixed |
| 4 | Nit | TRANSLATING.md didn't name `gmOnly` | Fixed |
| 5 | Nit | The rewritten v0.85/v0.86 checks searched the whole language file | Narrowed to `SR2E.Guide` |
| 6 | Nit | Loose "no English left" check; nothing guarded help.ts against a load-time read; braces untested | Tests added |
| 7 | Nit | The help search also matches the English heading aliases in any language | Kept (harmless: it only adds matches) |

## Checked live (25 Oct 2026, GM AI)

- The guide window (Alt+H): 55 topics in 10 categories; the first topic's text; the search ("smartlink" → Rules updated in v0.79.0); a topic link (to Credits and licence, with the trademark notice); no raw key anywhere.
- With German texts put into the loaded translations: the topic title ("Erste Schritte"), the category ("Hier anfangen") and a roll-link example with `{Schloss}` showed as written. A ZZ character's sheet showed the "?" on "Waffen" (weapons) and "Beschwören 4" (conjuring). In the combat-column layout, "Verteidigung" had the "?" (layouts) and "Waffen" too. The layout setting and translations were put back; the ZZ actor was deleted.

## Known limits

- `docs/PLAYER-GUIDE.md` is the English guide for GitHub; a translation has no Markdown export (the generator follows the loaded language, so one could be made the same way).
- A translation can't add or drop paragraphs in a topic: the block list is in the code (a block left out falls back to the English).
- Guide texts are HTML from the language file (trusted: the system's or a translation module's own file).
