# Licence and notices

**Shadowrun 2nd Edition (Unofficial) for Foundry VTT** (system id `sr2e`)
Copyright © 2026 Spaceisbig and the sr2e contributors.
Source: <https://github.com/SpaceisbigSoft/foundry-sr2e>

This work is licensed under the **Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0)**. To view a copy of the licence, visit <https://creativecommons.org/licenses/by-sa/4.0/>.

In short (the licence text is what counts): you may share and adapt this work, also commercially, if you give appropriate credit, link to the licence, say what you changed, and release your adaptation under the same licence. The work is offered as-is, with no warranties (section 5 of the licence).

The licence covers only the sr2e contributors' own work. It grants no rights in the Shadowrun name, trademarks or game, which belong to The Topps Company, Inc.; an adaptation, commercial or not, needs its own permission for those.

## Based on SRA2

sr2e started from the project setup of **SRA2**, the community Shadowrun Anarchy 2 system for Foundry VTT, <https://github.com/VincentVk9373/sra2>, by the Anarchy development team: Half, Vincent VK, Los Brutos, Cefyl, Dirt, Romano, Carmody and Asimov. SRA2 © 2020–2021 the Anarchy development team, released under a Creative Commons licence (its README names CC BY-SA 4.0, its licence badge CC BY 4.0; both allow this reuse under CC BY-SA 4.0).

- **Re-used from SRA2:** only the project setup: the build configuration (the Vite and TypeScript settings that turn the source code into the file Foundry loads) and the folder layout.
- **Made for sr2e:** everything else: all of the game code (the rules engine, data models, sheets and chat cards), the templates, styles, icons, token art, cover picture, language file and documentation.
- **Not included:** no SRA2 game content, rules, art or text.

## Made with AI

This system's code, tests, documentation and default token art were written by an AI model (Anthropic's Claude) under the direction of the project's human owner, Spaceisbig. The cover painting was made with another AI (OpenAI's ChatGPT image generation; see "Cover picture"). Its game numbers were recalled by the AI from memory and have not all been checked against the books (see "No rulebook content").

## Unofficial; trademarks

This is an unofficial fan project. It is not affiliated with, endorsed by or sponsored by The Topps Company, Inc., Catalyst Game Labs or Black Book Editions.

Shadowrun and Matrix are registered trademarks and/or trademarks of The Topps Company, Inc. in the United States and/or other countries. Catalyst Game Labs is a trademark of InMediaRes Productions, LLC. Other names of the game's products, rules and organisations used in this system (for example DocWagon) refer to the game it plays and belong to their owners. Foundry Virtual Tabletop is a product of Foundry Gaming, LLC.

## No rulebook content

sr2e contains no text or art from the Shadowrun rulebooks or sourcebooks and no compendium of book items, spells or critters. You need your own copy of the Shadowrun Second Edition rulebook to play. To run the mechanics the code holds game numbers (rule constants, about fifty starter item templates with stats and prices, a totem modifier table), written from memory and listed for checking in `docs/VERIFY.md` in the project's source (not in the installed system folder).

## Default token art

The pictures in `tokens/` (portraits by metatype with archetype badges, critters, spirits, vehicles and drones, IC, hosts, barriers, sites and safehouses) are the system's own original art, drawn by the AI (Anthropic's Claude) for sr2e as vector art written in code (`src/art/` in the project's source). They are part of this work and under the same CC BY-SA 4.0 licence. They contain no art from the Shadowrun books, no Shadowrun logo, no brand marks and no existing characters.

## Cover picture

The cover picture (`media/cover.jpg`; in the project's source `docs/media/`) is original AI-generated art: the painting was made by the project's owner with OpenAI's ChatGPT image generation from a brief written by Claude, and Claude added the title lettering in the bundled Chakra Petch font. It is part of this work and under the same CC BY-SA 4.0 licence. It contains no art from the Shadowrun books, no Shadowrun logo or lettering and no existing characters.

## Bundled fonts

The fonts in `fonts/` are not covered by the licence above. Chakra Petch (Copyright 2018 The Chakra Petch Project Authors), JetBrains Mono (Copyright 2020 The JetBrains Mono Project Authors) and Inter (Copyright 2016 The Inter Project Authors) are each licensed under the SIL Open Font License, Version 1.1; the full licences are in `fonts/OFL-ChakraPetch.txt`, `fonts/OFL-JetBrainsMono.txt` and `fonts/OFL-Inter.txt`.
