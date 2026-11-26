# SR2e system API and hooks (v0.93.2)

For macros and other modules. **v0.93.1:** the system id is `shadowrun2e_unified` (it was `sr2e`): flags, settings, the socket (`system.shadowrun2e_unified`) and file paths follow it, but the names below stay as they were (`game.sr2e`, the `sr2e.*` hooks), so macros keep working. Everything here is available once the world is ready (`Hooks.once('sr2e.ready', api => …)`, or `game.sr2e.api` afterwards). The system is unofficial and ships no rulebook data.

## Stability (v0.93.2)

Everything named on this page is SR2e's **public scripting interface**: the calls on `game.sr2e` and `game.sr2e.api`, the hooks, and the flags documented here. From v0.93.2 it is kept stable like this:

- **A fix release** (the last number, 0.93.1 → 0.93.2) never removes or renames anything here, and never changes what a call takes or returns, except to fix a bug.
- **A feature release** (the middle number, 0.93 → 0.94) may change or remove something only after it has been **deprecated** for at least one feature release: it keeps working, says so once per session in the console (`sr2e | … is deprecated, use …`), and is marked *deprecated* here.
- **Every change** to this page's interface (added, deprecated, changed, removed) is listed under **"API changes"** in that version's `CHANGELOG.md` entry, and in "API changes" at the end of this page.
- **Not covered:** anything not on this page (the classes' other methods, `game.sr2e.api.rules`' inner layout, `CONFIG` entries, CSS classes, templates, the chat cards' HTML and their flags, and the internal hook `shadowrun2e_unified.undoChanged`, which refreshes the GM panel). Those can change in any release. `rules` is safe to read; its keys follow `src/module/rules/config.ts`.
- **After 1.0** the same rules hold with the major number (1.x → 2.0) in place of the middle one.

A test (`src/module/__tests__/v0932.test.ts`) checks that every call the system registers is listed here and every call listed here still exists, so nothing is added or dropped without this page and the changelog saying so.

## `game.sr2e`

| Name | What it does |
|---|---|
| `useItem(uuid)` | Opens an item's dialog on its owner's sheet (attack with a weapon, cast a spell, roll a skill, use a power). |
| `runSheetAction(actor, action, dataset)` | Runs one of an actor sheet's buttons as if clicked (e.g. `quickAttack`, `quickCast`, `perceive`, `rollAttribute` with `{attribute: 'body'}`). |
| `gmPanel()`, `npcGenerator(kind?)` | Open the GM panel or the NPC generator. |
| `undo()`, `undoLog` | Undo the system's newest change (GM); the undo log. |
| `postItem(item)` | Post an item to chat. |
| `syncTokenVision(actor)` | Bring an actor's tokens' senses in line with its eyes. |

## `game.sr2e.api`

| Name | What it does |
|---|---|
| `version` | The system's version. |
| `rules` | The rule values (`RULES`, after house rules). Read only: change them with the House rules settings. |
| `successTest({dice, targetNumber, modifiers, roll})` | The engine's SR2 success test (Rule of Six, Rule of One). |
| `rollTest(spec, actor?, {quick, label})` | Roll a test from an inline-test spec, as `@SR2Test[...]` and `/sr2` do: `body tn 5`, `Firearms tn 4 mod -1 pool 2`, `perception`, `6 tn 5`. `quick` (default true) skips the dialog. |
| `defendNewest(actor)` | Click Defend on the newest attack aimed at this actor (false when there is none). |
| `regionsAt(scene, {x, y, elevation})`, `regionsAtToken(token)` | The SR2 environment regions at a point or under a token: `{id, name, env, area}`. |
| `wardsBetween(tokenA, tokenB)` | The ward or barrier actors whose region edge lies between two tokens. |
| `playCue(id)` | Play a sound cue (`turn`, `attacked`, `disaster`, `alarm`) if the player has sound cues on. |
| `exportTemplates()`, `importTemplates()` | GM: item templates to a world compendium, or from one. |
| `actorClass`, `combatClass` | `SR2Actor` and `SR2Combat` (static helpers such as `SR2Actor.backgroundCount()`). |

## Hooks

Called with `Hooks.callAll` (listen with `Hooks.on`):

| Hook | Arguments | When |
|---|---|---|
| `sr2e.ready` | `api` | The API is ready. |
| `sr2e.testPosted` | `actor, snapshot, message` | An SR2 test card was posted (on the poster's client). `snapshot.kind` is the kind of test (`attack`, `spell`, `plain`, `soak`…). |
| `sr2e.damageTaken` | `actor, {before, after}` | An actor's Physical or Stun boxes changed (on the client that changed them). |
| `sr2e.newPass` | `combat, pass` | A new initiative pass began (on the client that moved the combat on; 0 is the first). |
| `sr2e.newCombatTurn` | `combat, round` | A new Combat Turn began (on the client that moved the combat on). |
| `sr2e.alert` | `site, {from, to}` | A site's security alert changed (on the client that changed it). |

Called with `Hooks.call` (a listener returning `false` stops it):

| Hook | Arguments | When |
|---|---|---|
| `sr2e.preDamage` | `actor, {before, after}` | An actor's Physical or Stun boxes are about to change. Stopping it leaves the monitor as it was (the card still shows the roll). |

## Region environment flags

A Region's SR2 environment is `flags.shadowrun2e_unified.env` (`flags.sr2e.env` before v0.93.1): `backgroundCount` (0–20), `backgroundAspect` (tags, `toxic` counts as toxic), `backgroundToxic`, `environment` (tags), `weather` (an id from `RULES.HEALTH.weather`, `''` for the scene's), `light` (`normal`, `partial`, `minimal`, `darkness`, or `''`), `smoke` (`smoke`, `thermal` or `''`), `wardUuid` (a barrier actor), `siteUuid` and `deviceId` (a site's camera or sensor).

## Token Action HUD

The system registers itself with Token Action HUD Core 2.x (`tokenActionHudSystemReady`): no separate system module is needed. Token Action HUD Core needs the socketlib module.

## v0.64.0 additions (`game.sr2e.api`)

| Call | What it does |
|---|---|
| `creationWizard(actor)` | Open the creation wizard for a character. |
| `spendKarma(actor)` | Open the Spend Karma window (characters only, for their owner). |
| `pendingRequests()` | The approval requests waiting on the characters this client can see, oldest first: `{actorUuid, actorName, id, text, cost, short, ago, kind, at}`. `text` says who filed it and what will run; `short` is true when the character can't pay now. |
| `flushAdvancement()` | Wait until pending advancement-log lines are written. |

## v0.66.0 additions (`game.sr2e.api`)

| Call | What it does |
|---|---|
| `kits()` | The world's starter kits (`{id, name, notes, lines: [{type, name, system, amount}]}`). |
| `giveKit(kitIdOrName, actors, {ready = true})` | GM only: give a kit to actors (lines an actor can't hold are skipped). Returns how many got something. |
| `setUpTokens(actors, {placed = true, relink = false})` | Set up prototype (and placed) tokens with the Setup tab's saved options. |
| `importCharacter(actor, text)` | Fill a character from a pasted write-up. Players: only an unfinished character, and not past the approval queue. |
| `pasteCatalogueRows(text, defaultType)` | GM: CSV / tab-separated rows (header first) → world item templates. |
| `openHelp(topicId)` | Open the player guide (topic ids are in `rules/guide.ts`). |
| `startTour(id)` | `character-sheet`, `add-window` or `gm-panel`. |
| `applyLook()` | v0.67.0: re-reads this player's look settings (theme, colour preset, opacity, text size, reduced motion) and re-themes the open SR2e windows. |
| `findPortraits()` | v0.67.0, GM: looks up a portrait by name in the world's *Portrait folder* for every actor; returns how many changed. |
| `applyPortrait(actor)` | v0.67.0: the same for one actor (only replaces Foundry's stand-in pictures or a picture it set itself). |
| `defaultArtOf(actor)` | v0.83.0: the path of the system's default token art for this actor (null for a type with none). |
| `applyDefaultArt(actor)` | v0.83.0: gives the actor its default art where its picture or token is Foundry's stand-in or older default art (a picture set by hand is kept); returns true when something changed. |
| `defaultArtForAll()` | v0.83.0, GM: the same for every actor; returns how many changed. |
| `windowRole()` | v0.85.0: `{lead, prompts, otherWindows}` for this window: whether it runs the automation (the active GM's lead window), whether it shows the automatic prompts (the window used most recently), and how many other windows of this user it hears. |

## v0.87.0–v0.92.1 additions (`game.sr2e.api`; listed in v0.93.2)

| Call | What it does |
|---|---|
| `printActor(actor)` | v0.87.0: open the print dialog for an actor's sheet. |
| `printPage(actor, options)` | v0.87.0: the printable page's HTML (a string); `options.secrets` includes the notes' secret sections (the caller decides; no ownership check). |
| `bugReport()`, `openBugReport()` | v0.87.0: the bug report text (versions, modules, settings), or the window that shows it. Nothing is sent anywhere. |
| `createDemo()`, `removeDemo({confirm})` | v0.88.0, GM: make the starter demo (runners, a scene, a journal), or remove it. Both resolve to a short report. |
| `openTools()`, `runTool(id)` | v0.89.8: the SR2e tools window, or run one of its tools by id (false when there is no such tool or you may not use it). |
| `sortCatalogue()` | v0.90.2, GM: sort the "Catalogue (SR2e)" actor folder into subfolders; resolves to how many moved. |
| `openShop(actor?)` | v0.91.1: the shop for an actor (else your character, or the GM's selected token). |
| `newEntry({kind, actorUuid})` | v0.91.1: the new-entry form. |
| `openCatalogue({type, key})` | v0.91.3: the Catalogue window, at a tab and an entry. |
| `sceneBuilder({sceneId})` | v0.91.7, GM: the Scene builder (with `sceneId`, to change a scene it built). |
| `buildScene(spec)`, `applyToScene(sceneId, spec)`, `removeBuiltScene(sceneId, {confirm})` | v0.91.7, GM: build a scene from a spec, change one, or remove one it built. |
| `interpretations(id?)` | v0.92.0: the rules interpretations window, at an entry. |
| `reference(actor)` | v0.92.1: the reference pane beside an actor's sheet. |

## API changes

The interface's history from v0.93.2, newest first. Each version's `CHANGELOG.md` entry repeats its line.

- **v0.93.2:** the stability rules above. Nothing changed; the calls added in v0.87.0–v0.92.1 are listed here for the first time. Since v0.93.1 (the system id change) the flags and settings live under `shadowrun2e_unified`; the names `game.sr2e` and the `sr2e.*` hooks stayed.
