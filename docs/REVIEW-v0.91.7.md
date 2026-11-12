# v0.91.7 review and live run: the Scene builder

## Independent review (fixed)

1. Changing an existing scene placed tokens, walls and the ward without the scene's padding (Foundry pads scenes by default): positions now start at the scene's `dimensions.sceneX/sceneY` (`geoOfScene`, `SceneGeo`).
2. A built-in backdrop's walls didn't follow a changed size: a new scene on a built-in backdrop has the backdrop's size (`keepSize` for a scene being changed), and walls are added only to a scene of that size.
3. A Matrix scene couldn't be changed without adding another host, and its host could get a second token: the host check is skipped when changing, and a host already on the scene gets no token.
4. The GM panel's **New scene…** could reopen the last built scene in edit mode: every "new" entry passes `{ sceneId: '' }` (a new scene's draft is kept).
5. Remove deleted every combat on the scene and tokens on other scenes without saying so: it deletes the combat it made (flagged), and the dialog counts the tokens elsewhere.
6. Applying a change rewrote every setting with clamped values: only what the GM changed is written.
7. Doors and morale groups were matched by creation order: each door and token carries a tag.
8. Switching kinds kept the old backdrop's environment; critters were counted as several tokens; a crowd could spill out of its zone; `@UUID` link labels broke on `}`; the template-name box reset on re-render; Remove didn't catch a busy builder; compendium actors and non-map actor types could become tokens. All fixed.

The test plan's risks (the picture field on a changed scene, the colour on the scene's level, a template or backdrop replacing a changed scene's picture, the world hour with `dayStartHour`, a site left linked to a removed host) are fixed too.

## Live run (11 Nov 2026, GM AI and ZZ Testplayer)

- Every way of opening it; every step without raw keys or errors; the gallery's 10 real-world thumbnails load.
- A street scene by the API (noon, light rain, background count, a ward over the NPCs, a site and host, a player character, three world NPCs, a gang, a spirit and dogs, a journal, a combat with NPC initiative): scale, picture (on the scene and its level), walls/windows/doors/lamps matching the data, closed doors, maglocks on the secure doors, the site linked to its host, the ward region, tokens in the zones (hidden, disposition, linked as asked), morale groups by row, the journal GM-only with working links and the notes' HTML shown as text.
- A Matrix scene through the window (GM panel's New scene…, typed name, kind, people, double-clicked Build: one scene), the host token; then changing it (weather, one more NPC, no second host, the scene's other flags kept, size locked).
- Templates saved, replaced by name, loaded (keeping the current name), deleted with a confirm.
- Remove: Cancel changes nothing; Yes deletes the scene, its actors, journal, folder, combat and a stray token on another scene, clears a GM site's link to the removed host. A copy made with `clone()` in code (no duplicate mark) is removed; the sidebar's Duplicate marks copies, which are kept.
- Show to players activates the scene. The NPC generator works as before. A player gets no window, tool or button, and the API refuses.
- A padded scene not made by the builder, changed: tokens and the ward on the map, no Remove button.
- Fixed during the run: a short API spec lost the backdrop's terrain and the kind's hour (defaults now fill what is left out); player characters' tokens are friendly; the remove dialog's counts read naturally.

## Known limits

- IC isn't placed on a Matrix scene: it arrives from the host's sheaf as the tally climbs (as before).
- Deleting a scene in Foundry deletes its combats, so a GM's own combat on a removed scene goes with it.
- The backdrops are drawn at their own size; another size uses a plain colour or the GM's own picture.
