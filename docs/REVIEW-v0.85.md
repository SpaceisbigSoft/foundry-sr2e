# v0.85.0 review: open bugs and security leftovers

## What changed

### One GM window runs the automation (`applications/leader.ts`)

Foundry picks the active GM by user. So two windows logged in as the same GM (a second tab, the desktop app beside a browser) both acted: the status cards, timers, relay answers, prompts and the follow-ups of a change all happened twice.

- **The lead window.** GM windows greet each other on the system socket. A greeting only counts when the server says it came from this same user. The oldest live window leads.
  - `isLeadGm()` replaced every `activeGM.isSelf` / `activeGM.id === user.id` check.
  - `isRelayGm()` uses it, so player requests are answered once.
- **Made in this window.** Every window stamps the changes it makes in the pre-hooks (`options.sr2eWin`).
  - After-change hooks that asked "did my user make this?" now ask `madeHere(options, userId)`: Essence holes, the advancement log, the mid-turn wound drop, the module hooks (`sr2e.damageTaken`…), token vision, camera regions and the actor's own follow-ups.
  - A change with no stamp is answered by the lead window.
- **Prompts.** The automatic Defend/Resist prompts open in the GM window used most recently (`isPromptWindow()`), so they never open in a forgotten background tab.
- **Liveness.** Windows probe each other: at start, on hearing a new window, on coming back into view, and at every 20 s beat. A window that doesn't answer within 3 s is dropped, so a closed or crashed window is replaced within a beat. Other details:
  - goodbyes on `pagehide` and `beforeunload`;
  - the id and start time survive a reload (sessionStorage);
  - a duplicated tab takes a new id;
  - dead entries are pruned.
- **Start-up.** Once-per-session jobs wait for `leadSettled()` (1.5 s) so two restored tabs don't both run them: migrations, the new-session Karma refresh, the house-rules report and the first area sweep.
- **Round timers.** A second GM window hands the round's timers to the lead window (falling back after 5 s), so they never interleave with the world-time timers.
- **Records kept everywhere.** Every GM window keeps the camera-region and down-status records; only the lead acts on them. A window that takes over therefore has them.
- **The socket listener** takes exactly `(message, senderId)`.
- **API:** `game.sr2e.api.windowRole()` gives `{lead, prompts, otherWindows}`.

### The GM queue

- These buttons now make their change under `gmLocked`, after their dialog, and check their done-flag again inside the lock: Barriers, Spell wall, Start fire, Jam weapon, Evict, Confirm deed, Region detect and Remove bug. For a player, Remove bug runs without the lock.
- The GM's own Defend, Resist and Resist-the-spell rolls go through `gmRoll`: the lock for a GM, none for a player, always after the pool dialog. Inside the lock, a resistance that happened meanwhile (the NPC resisting by itself) stops the GM's roll.

### Notifications

- Every value in a `ui.notifications` call is escaped (730 values on 538 lines, done by a codemod driven by the HTML scanner). Where a value was the left side of `?? fallback` or `|| fallback`, the whole expression is wrapped.
- Foundry v14 runs a notification through `cleanHTML`, which strips scripts but still renders tags. A typed name could therefore style or link a toast; now it shows as typed.
- The ratchet is 0. Tests that read notification text compare what the player sees (`helpers/shown.ts`).

## Independent review (a fresh agent, the diff against v0.84.1)

| | Finding | Fix |
|---|---|---|
| B1 | After-change hooks checked only the user id, so both windows ran them (Essence holes, advancement log, wound drop, module hooks) | The window stamp and `madeHere` |
| R1 | Once-at-ready jobs could run in two restored tabs | `leadSettled()` |
| R2 | Lead-only records went stale in other windows | Recorded in every GM window |
| R3 | Round timers from a second window could interleave with the lead's world-time timers | Handed to the lead window |
| R4 | Could a player forge the sender id by adding an argument? | Checked live: the server drops extra arguments and passes the real sender, so it can't be forged. The listener refuses anything but two arguments anyway |
| R5, R6 | A lost goodbye or a woken tab could leave nobody leading for 150 s, or two windows leading | Probes, pagehide, sessionStorage id, duplicate-id detection, greeting a peer back after a long silence |
| R7 | Prompts in a background tab | Prompts follow the window used most recently |
| Nits | Re-checks inside the lock (Jam weapon, Remove bug, Resist), the start time from the server clock, pruning, the guide wording | Fixed |

The codemod review found no wrong wraps: no double escaping, no intended markup lost, and the fallbacks were kept.

## Known limits

- **The undo log.** Each GM window keeps the undo log in this browser (localStorage). Two windows in one browser both log the same step.
- **Settling delay.** A window that has just opened leads until it hears an older one, at most 1.5 s, and the once-per-session jobs wait out that time.
- **Background tabs.** Their timers are slowed, so a closed background window can take about a minute to drop.
- **Lock tests.** The lock wraps are tested by source checks, not by running the handlers. The leader is tested by running it.

## Tested

- 3196 tests pass (4 skipped), typecheck clean, build done.
- Live, with two windows logged in as GM AI and a third as ZZ Testplayer:
  - the first window led and the second, used last, showed the prompts;
  - the window stamp reached the other window for create, update and delete;
  - deleting installed cyberware in the second window opened the Essence hole once;
  - a player's relay request got exactly one reply;
  - a forged greeting with a GM's id as an extra argument arrived with the player's own id and was ignored;
  - an escaped name with an apostrophe and a bold tag showed as typed, with no bold;
  - a window closed from outside was dropped within one beat, and the prompts moved back.
- The ZZ actor was deleted and the user's 22 actors are unchanged.
