# Translating the SR2e system

All the text people see comes from one file, `public/lang/en.json` (since v0.89.0–v0.89.7, the in-game guide
included). A translation is a copy of that file in another language, registered in `system.json`
(`languages`), for example `lang/de.json`. A key your file lacks falls back to the English one, so you can translate
a little at a time.

## The groups

| Group | What it holds |
|---|---|
| `SR2E.UI` | the sheets and windows (templates) |
| `SR2E.Settings`, `SR2E.Keybindings` | Configure Settings and the hotkeys |
| `SR2E.Notify` | pop-up notifications |
| `SR2E.Dialog`, `SR2E.Window` | dialogs and window titles |
| `SR2E.Card` | chat cards; `SR2E.Card.Mod` the target-number modifier rows, `SR2E.Card.Outcome` the outcome words ("Hit!", "Takes M …") |
| `SR2E.Count` | counted nouns ("3 days") |
| `SR2E.HouseRules`, `SR2E.Rules`, `SR2E.RulesUrr`, `SR2E.Tables` | the house rules window and the rules tables' labels |
| `SR2E.Tooltip`, `SR2E.App`, `SR2E.Privacy` | sheet tooltips, the text the windows build in code, roll privacy |
| `SR2E.Text` | text the rules put together while you play (import reports, NPC generator descriptions, catalogue checks) |
| `SR2E.Guide` | the in-game guide: `Category` labels, and per topic (`Topic.<topicId>`) a `title` and its blocks in order: `b1`, `b2` … a paragraph each, or a list whose items are `i1`, `i2` …; `gmOnly` is the note a player sees on a GM topic |

## Rules for a translation

- **Placeholders** (`{name}`, `{part}`, `{count}`) are filled by the system. Keep every one, in the place your
  language needs; leave out none and add none.
- **Counted texts** are objects with one entry per plural category of your language (`one`, `few`, `many`, `other` …,
  as [Intl.PluralRules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules)
  names them). `other` is required; a category you leave out uses `other`.
- **HTML**: some texts hold entities (`&nbsp;`, `&ndash;`) because the English does; write plain text otherwise. Tags
  (`<strong>`) are never part of a text: they are put around it, or into a placeholder, by the code. **The guide is
  the exception**: its texts hold the inline tags `<strong>`, `<em>`, `<kbd>`, `<code>` and links to other topics
  (`<a href="#topic-id">`). Keep them, around the words of your language they belong to; keep each link's `#topic-id`
  as it is. A topic's number of paragraphs and list items is fixed by the code (a block you leave out falls back to
  the English). Guide texts have no placeholders: braces in them (a roll link's `{label}`) are shown as written.
- **Context keys**: a key ending in `__<context>` (for example `SR2E.UI.attack__heading` beside `SR2E.UI.attack`)
  repeats an English word on purpose where your language may need two words (a heading's noun and a button's verb).
- **Pieces that go into other texts**: `{part}` and similar placeholders are filled with another text from the file
  (a note in brackets, a second sentence). `docs/TRANSLATING-PARTS.md` lists every one with the texts that go into it.
  Since v0.89.5 no piece is a bare word of a sentence; if you find one that can't be translated well where it goes,
  please report it.
- **Lists** ("a, b and c") are joined the way your language joins them (`Intl.ListFormat`); nothing to translate.

## What stays as it is

Names are data, not text: skill, item, spell, actor and NPC names, the starter templates and the owner's catalogue
stay in the language they were written in. Chat cards keep the language they were posted in. A few texts stay
English because the system reads them back (purchase lines in the ledger, "… on order" projects), and the bug
report stays English for the maintainers. `docs/PLAYER-GUIDE.md` is the English guide for GitHub.

## Checking your file

`npm test` checks the English file: every key the code names exists, and each call passes exactly the placeholders
its text uses. A translation isn't tested yet; check that each of your texts keeps the English text's placeholders,
and that each counted text has an `other` entry.
