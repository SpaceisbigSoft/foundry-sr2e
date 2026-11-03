# v0.90.0 review: release polish

## What changed

- **Author:** Spaceisbig (https://github.com/SpaceisbigSoft), the owner's choice on 25 Oct 2026, in `system.json`.
  - `LICENSE.md` now reads "© 2026 Spaceisbig and the sr2e contributors"; the copy in `public/` matches.
  - The AI statement names the owner. Claude is not listed as an author: the AI statement covers it. The SRA2 team stays credited.
- **Cover picture:** an original painting of a runner team (an ork street samurai, an elf mage and a decker) in a rain-wet neon alley.
  - How it was made: the owner made it with ChatGPT's image generation from Claude's brief, which kept to the era's look and asked for no logos, lettering, existing characters or artist names. Claude added the title in the bundled Chakra Petch font (`src/art/cover.ts`, `npm run cover`).
  - Files: `docs/media/cover.jpg` (1920×1080, the README) and `docs/media/social.jpg` (1280×640, GitHub's link preview). `public/media/cover.jpg` ships as `system.json`'s cover `media` and as the `background` of new worlds.
  - Credited in `LICENSE.md` (new section "Cover picture"), the README and the guide's Credits topic.
- **`CHANGELOG.md`:** player-facing, all 100 versions, written from the handoff's Changelog without internal detail (test counts, test users, file paths, the owner's private data). The README links to it.
- **Smaller download:** `npm run build` now ends with `scripts/minify.mjs`. It is an esbuild pass, because Vite's library build keeps the whitespace in ES output.
  - `index.mjs` went from 3.9 MB to 2.6 MB, and the source map still points at the TypeScript sources.
  - `keepNames` keeps class names, which Foundry uses to key registered sheets (`sr2e.SR2CharacterSheet`).
  - `esbuild` is now a declared dev dependency.
- **The wrappers found by name in the stack** (`sr2eDialogWrap` gives the system's dialogs their look; `sr2eNoteWrap` groups repeated notifications) are now object methods. A minifier never renames a property key, and every browser names the stack frame after it. With only `keepNames`, Firefox's stacks would show the minified name, and the look and grouping would have stopped silently.
- **GitHub:**
  - Issue forms: a bug report that asks for the "Report a bug" text, and a rules question that asks for the book and page in the reporter's own words.
  - A release workflow, run on a `v*` tag:
    - checks the tag against `system.json`, then `npm ci`, typecheck, tests and build;
    - writes `url`, `bugs`, `changelog`, `readme`, `manifest` (`releases/latest/download/system.json`) and `download` (the tag's `sr2e.zip`) into `system.json`;
    - zips the system with its source map and publishes `system.json` and `sr2e.zip`.
- **The GM panel's Undo heading** built an English plural in its template. It is now one counted text (`SR2E.App.Ui.stepsKept`).

## Checking the output

3,343 tests (3,339 pass, 4 skipped) and tsc is clean. The new `v0900.test.ts` checks:
- the author, the cover files and their credits;
- the changelog: every version newest first, nothing internal;
- the build script and the declared esbuild;
- the wrappers as methods, and the built bundle keeping the wrapper and sheet class names;
- the issue forms and the workflow's steps and addresses;
- the Undo text.

## The independent review

| # | Kind | Finding | Outcome |
|---|---|---|---|
| 1 | Bug | Minified, the two stack-named wrappers would lose their names in Firefox (the dialog look and the notification grouping stop silently) | Fixed: object methods; a test checks the built bundle; checked live (dialog look on a system dialog, none on another's, "(×3)" grouping) |
| 2 | Risk | `scripts/minify.mjs` imports esbuild without declaring it | Fixed: devDependency `~0.28.2`, lock file updated |
| 3 | Nit | Workflow links to the `main` branch | Fixed: the tag |
| 4 | Nit | The zip left out the source map the bundle points to | Fixed: the map ships in the zip |
| 5 | Nit | The changelog said "your world's background" | Fixed: the default background for new worlds |
| 6 | Nit | The guide's credits didn't mention the cover | Fixed (and `docs/PLAYER-GUIDE.md` regenerated) |
| 7 | Nit | `npm run cover` didn't refresh `public/media/cover.jpg`; Playwright not declared | Fixed: it copies the cover; Playwright noted as a developer tool |
| 8 | Nit | Pinned action tags, not commit hashes; the cover `media` URL is Foundry-relative | Kept: common practice for a small project; the URL is right for an installed system |

## Checked live (25 Oct 2026, GM AI)

- The minified build loaded. The character sheet is registered as `sr2e.SR2CharacterSheet`.
- A system dialog (Award) got the look; another dialog didn't. A repeated notification was grouped "(×3)".
- The new Undo text showed.
- **Screenshots:** the starter demo was created for them, then removed (13 actors, 1 scene, 1 journal, its folders; nothing left).
  - The browser pane Claude works in only captures at half resolution (about 800 px wide), too small for the GitHub page.
  - The screenshots move to the owner, who can take them at full size (see the handoff's plan).
- Your Safehouse scene is back on view, and no chat messages were left.

## Known limits

- No screenshots yet (above).
- The repository address, and with it the `manifest`/`download` fields, comes with the release step. The workflow fills them in from the repository it runs in.

## v0.90.1: the screenshots (25 Oct 2026)

- The owner took the screenshots in their own Foundry from the starter demo. Claude cropped them so only the system shows: no scene list, player names, hotbar or older chat.
  - `docs/media/screenshot-play.png`: Sparrow's sheet beside her attack, Soot's Defend and Resist, the outcome banners and the GM's row.
  - `docs/media/screenshot-tools.png`: the SR2e tools window, both sections, stitched from two pictures.
- Copies ship in `public/media/` as `system.json` `media` entries of type `screenshot`, with captions. The README has a Screenshots section.
- No code change. Tests: 3,343 (3,339 pass, 4 skipped), and the v0.90.0 test now also checks the screenshot entries, files and README links.
- No separate review or live run: media and text only. The deployed files are pixel-identical to the local ones; the bridge re-encodes images, so their byte sizes differ by a few KB.
