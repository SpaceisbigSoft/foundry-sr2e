# SR2e system API and hooks (v0.82.0)

For macros and other modules. Everything here is available once the world is ready (`Hooks.once('sr2e.ready', api => …)`, or `game.sr2e.api` afterwards). The system is unofficial and ships no rulebook data.

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

A Region's SR2 environment is `flags.sr2e.env`: `backgroundCount` (0–20), `backgroundAspect` (tags, `toxic` counts as toxic), `backgroundToxic`, `environment` (tags), `weather` (an id from `RULES.HEALTH.weather`, `''` for the scene's), `light` (`normal`, `partial`, `minimal`, `darkness`, or `''`), `smoke` (`smoke`, `thermal` or `''`), `wardUuid` (a barrier actor), `siteUuid` and `deviceId` (a site's camera or sensor).

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
