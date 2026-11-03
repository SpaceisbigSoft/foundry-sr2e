# v0.83.0 review: the default token art

Two independent reviews (fresh agents that did not write the code) over the diff against v0.82.1, plus the live-test plan writer's reading of the code (D1–D5). Rules values are unchanged.

## First review: 3 bugs, 6 risks, nits

| # | Finding | Fix |
|---|---|---|
| 1 | The GM panel counted actors already showing the default art as "stand-ins"; the count never dropped. | `standInCount` counts only Foundry's stand-in (`isOnlyStandIn`). |
| 2 | The bulk button wrote `system.art.figure` onto actors with pictures of their own. | Nothing is written unless the picture or token changes. |
| 3 | A player's change didn't reach their linked tokens on the map. | Follow-ups run on the active GM's client (like Portraits by name). |
| 4 | A system art file picked by hand could be overwritten. | The system records what it set (`flags.sr2e.artAuto`); follow-ups replace only that exact path. |
| 5 | preCreate read the creation data before the pending actor's token. | The pending source first. |
| 6 | Bursts of item adds sent one update each. | Follow-ups batched per actor (100 ms) and re-checked before writing. |
| 7 | Unlinked token actors got a picture their token never shows. | Skipped. |
| 8 | The sheet button left linked tokens with the old picture. | 'force' also updates linked tokens that showed the old pictures. |
| 9 | Wired reflexes left to "guess from the name" weren't counted. | Matched by name too. |
| nits | Dead export, test file names in comments, a no-op line, guide wording on the setting, `isDefault` hint, package-lock version. | Fixed. |

Test plan finds D3 (no double-click guard on the button) and D4 (stand-in hint) fixed too.

## Second review (of the fixes): 3 bugs, 5 risks

| # | Finding | Fix |
|---|---|---|
| B1 | A player's own sheet button (or a follow-up with no GM) didn't reach the linked tokens: the GM's hook skipped updates marked `sr2eArt`. | The active GM's `updateActor` hook syncs the linked tokens when another user's art update changed the prototype token to the actor's own default art (only ever writing that path). |
| B2 | Renaming a cyberware item didn't re-check the automatic archetype. | `updateItem` also reacts to `name`. |
| B3 | A follow-up timer could fire on a deleted actor. | The timer checks the actor is still in the world. |
| hardening | `isDefaultArt` matched anything under the folder (`tokens/../`). | Exact files only (a set of every path). |
| R3 | The button did nothing silently on an unlinked token's sheet. | A notice says to use the token settings or the actor in the sidebar. |

## Known limits (not fixed)

- **R1:** if items are added right after an actor is created and a Portraits-by-name lookup is in flight, the default art could land after the found portrait (low probability; a rename puts the portrait back).
- With no GM online, a player's own change updates the actor and prototype token but not tokens already on the map (nothing catches up later).
- **R2:** the bulk button's "given to N" can be higher than the panel count (it also refreshes default art the system set earlier).
- **R5:** a synaptic accelerator with no `reflexes` field doesn't count as combat ware.
- Tokens are drawn at 256 px; very large tokens at high zoom may look soft.
