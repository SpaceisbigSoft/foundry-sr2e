# v0.84.1 review: the token art colour pass

## What changed

- **One colour per area, everywhere.** A token's rim is the area colour the sheets and chat cards use:
  - combat red, magic violet, Matrix green, rigging orange, street gold, health teal;
  - security blue (the security badge and secured sites);
  - neutral steel for plain portraits (no longer the interface's cyan accent);
  - tan grey for critters.
  - Every spirit gets the magic rim, and IC and hosts the Matrix rim. Vehicles and drones are rigging, the barrier magic and the safehouse street.
  - Subjects keep their own colours: an elemental's element, toxic and insect spirits, white, gray and black IC.
  - `src/art/frame.ts` takes `RIM` from `palette('street', 'cyan')` in `rules/look.ts`, so the art and the sheets can't drift apart.
- **Colour-blind-safe area colours** in all three themes and the Phosphor green Matrix swap. `rules/colourblind.ts` is new: Machado 2009 simulation of protanopia, deuteranopia and tritanopia, and the CIEDE2000 distance.
  - Every pair of area colours, and every pair of token rims, is now at least 11.5 apart with each kind of vision. v0.83.0 had pairs at 0.2 to 5.
  - The rare High contrast + Phosphor green Matrix cyan is at least 8.5, and the heading colours at least 6.
  - The card-strip tints follow their base's hue. Every WCAG minimum still holds (the contrast test).
- **The barrier's ward region** on the map uses the magic colour (it was a fixed violet).
- **A legend in the guide** ("Pictures and tokens": What the rim colour means). The chat-card colours line now notes Corp's sandy street colour.
- Rules values are unchanged.

## Independent review (fresh agent, diff against v0.84.0)

No bugs. What it raised, and what was done:

- **Fixed:**
  - Two comments pointed at a test file that doesn't exist.
  - `colourblind.ts` read anything that isn't hex as black. It now throws.
  - More published CIEDE2000 pairs were added to the tests (hue wrap-around, near-zero chroma).
  - The badge-disc test could skip every file silently. It now counts 150.
  - The barrier region colour.
  - The guide wording on critters and on theme shades.
  - Corp's street strip tint, which clashed in hue with its new base.
  - High contrast street and health headings had become nearly white. Headings are now one small step lighter than their base, and a test keeps them apart (6 or more).
- **Known, not changed:**
  - **Matrix vs the accent:** the Matrix green and the default cyan accent are close for colour-blind players (2.9, and 5.3 before). The accent is the system's identity colour. A card without an area uses the accent, so a Matrix card and an area-less card look alike to them. The words and icons on the card tell them apart.
  - **Water elemental:** its blue subject is 6.8 from the magic rim with colour blindness. The rim and the subject are never compared to tell categories apart.
  - **The fitted colours:** the Corp palette has less room on a light background, so its street colour is a sandy brown rather than gold.

## Tested

- 3162 tests pass (4 skipped), typecheck clean, the build is done, `npm run tokens` matches the drawings.
- Deployed `index.mjs`, `system.json` and the 202 token files. Sizes match, and the SVGs are larger on the device because the transfer adds a C2PA block.
- Live, as ZZ Testplayer (GM AI was shown as logged in elsewhere):
  - the area variables inside SR2e windows match for Street/cyan, Corp/cyan, High contrast/green and Street/green, and the settings were restored;
  - the served token files have the new rims (car, fire elemental, black IC, site, plain portrait, street doc);
  - the guide topic shows the legend.
- After the user's restart, as GM AI: Foundry reports 0.84.1. New ZZ actors (vehicle, spirit, character) got the default art. A spirit changed to elemental fire took `elemental-fire.svg`, served with the magic rim. The ZZ actors were deleted afterwards, and the user's 22 actors are unchanged.
