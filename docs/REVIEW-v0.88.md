# v0.88.0 review: the starter demo

24 Oct 2026. The owner chose a **"Create the demo" button** over an Adventure compendium, so no Foundry restart is needed. An independent reviewer (a fresh agent that didn't write the code) read the diff against v0.87.0. It found 3 bugs, 5 risks and 4 nits. All were fixed or settled, and the fixes were checked live.

## What changed

- **`rules/demo.ts`** (pure) holds the demo from the generators with a fixed seed (`DEMO_SEED`), so every world gets the same one:
  - four runners as full characters: street samurai (ork), mage (elf), decker (human), rigger (dwarf), at Threat Level 3;
  - a gang (the leader and three of its members);
  - a corporation with its host;
  - the rigger's vehicle and drone;
  - the scene layout: 32 × 20 m, walls, a door, lamps, painted areas;
  - the builders `runnerActorData`, `gangerActorData` and `demoSiteSystem`;
  - the "Try this" journal (`demoPages`).
- **`applications/demo.ts`** builds it all in the world:
  - Everything goes in folders named "Demo (SR2e)" and is flagged `flags.sr2e.demo`.
  - The scene's background colour is set on its v14 Level; the scene has no padding.
  - The door starts locked and is linked to the site's keypad maglock. The site also has a camera, a door alarm, tally steps (3 passive, 6 active, 9 lockdown) and a response.
  - The safehouse is owned by the runners, and the drone is already subscribed.
  - **Remove the demo** asks first. It deletes the flagged documents (not copies), the combats on the demo scene, and demo tokens placed on other scenes.
- **GM panel, Setup tab:** a "Starter demo" section with Create and Remove, plus `game.sr2e.api.createDemo()` and `removeDemo()`.
- **Guide:** the GM setup topic describes it.

## Findings

| # | Kind | Finding | Outcome |
|---|---|---|---|
| 1 | Bug | The "maglocked" door was created unlocked. | Fixed: the door starts locked (`DEMO_DOOR_LOCKED`), and a successful bypass unlocks it. Checked live: the door state is 2. |
| 2 | Bug | The runners had a Karma Pool of 0 (from the NPC data), plus NPC-only ratings (a Morale button, Professional Rating 3). | Fixed: `runnerActorData` gives a Karma Pool of at least 3, Professional and Threat Rating 0, and a group size of 1. Checked live. |
| 3 | Bug | The site had no tally steps, so the journal's alert and response couldn't happen. | Fixed: steps at 3, 6 and 9, and a response force. A test confirms they raise the alert. |
| 4 | Risk | A player given the rigger can't control the vehicles, which aren't theirs. | Documented in the journal and the guide (*Configure Ownership*). The drone is subscribed. |
| 5 | Risk | A failure partway through said nothing. | `demoStep`: an error notice that points to Remove; the tab always refreshes. |
| 6 | Risk | Remove deleted copies of demo documents. | `isDemo` skips documents with `_stats.duplicateSource` or `compendiumSource`. Checked live: a duplicated runner survived Remove. The guide says so. |
| 7 | Risk | Two creates at once made two demos. | `exclusive`: one create or remove at a time on a client. Checked live: the second call is refused. |
| 8 | Risk | Demo tokens on other scenes were orphaned. | Remove deletes them too, and the dialog says so. |
| 9 | Nit | The maglock's lock type was "(not set)". | Now `keypad`. |
| 10 | Nit | Dead code around the remote control deck. | Removed. |
| 11 | Nit | Journal wording: Bypass suggested the samurai (no Electronics); the "car" is a van; "Toggle Combat State"; the camera has no token. | Bypass now names the decker or rigger; the text says "vehicle"; the combat step points to the HUD's combat button; the camera isn't described as watching. |
| 12 | Nit | The journal is readable by players. | Kept: nothing in it is secret, and players can follow it. |

Tests: `__tests__/v088.test.ts` covers the plan, the builders, the site steps through `siteTally`, `isDemo`, escaping, the scene bounds and the wiring.

## Checked live (GM AI, 24 Oct 2026)

- **Creating:** from the Setup tab's button, in about 0.8 s:
  - 13 actors: 4 characters, 4 gangers, a vehicle and a drone, a host, a site and a safehouse;
  - a scene with 8 walls (one a door), 3 lamps, 4 painted areas and 10 tokens;
  - a 7-page journal.
- **The parts:**
  - The decker has a deck and programs. The rigger has a control rig, a remote control deck and a subscribed drone.
  - The mage has 4 spells on the Magic tab. The Matrix and Rigging tabs show for the decker and the rigger.
  - The Bypass quick action lists the maglock.
- **A fight:** the samurai attacked a ganger with an assault rifle (range and light found by themselves), and the ganger's Defend prompt came up.
- **Removing:** the world went back to 22 actors, 1 scene, 0 journal entries and 3 folders. The test messages were deleted.
