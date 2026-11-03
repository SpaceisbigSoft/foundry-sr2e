# Re-check after v0.58.0 (20 Oct 2026)

The gap checklist had no build items left after v0.58.0: its unticked rows are book checks and the v0.9 release tasks. Four fresh reviewers looked further. One collected every leftover the project's own docs admit to. Three swept SR2 and the Foundry integration by area. The merged list is in the gap checklist under "Found after v0.58.0". This file keeps the evidence, with file and function pointers. Line numbers will drift.

## 1. Foundry integration and play-breaking bugs (proposed v0.59.0)

| # | Problem | Evidence | Size |
|---|---|---|---|
| 1 | A player can't end their turn when they act last in a pass. | `SR2Combat.nextTurn` (documents/index.ts, near the end) updates every combatant's initiative, then calls `nextRound`, `rollAll` and `alignParties`. A player can't update combatants they don't own. Only `delayAction` catches this. `system.json` has `"socket": false`, so there is no GM relay. | M |
| 2 | Next Round, Previous Turn and Previous Round skip the SR2 logic: no re-roll, the pass flag isn't reset, pools don't refresh, and the dying, security, trace and timed ticks don't run. Going back at turn 0 of pass 2 loses a Combat Turn. | Only `nextTurn` is overridden. The GM panel's back button calls `previousTurn` (applications/ui.ts). | S–M |
| 3 | The world clock runs 6 s per Combat Turn; SR2 uses 3 s. Some timers may tick twice. | Nothing sets `CONFIG.time.roundTime`. Permanent spells read `roundTime`. The `updateWorldTime` hook also calls `timedEffects` after the combat path. | S |
| 4 | Dropped or created items arrive installed, bonded and loaded. Dragging between actors copies the item. Any item type is accepted on any actor. | Schema defaults: cyberware `installed: true`, focus `bonded: true`, program `loaded: true`. There is no `_onDropItem` and no `preCreateItem` reset. | M |
| 5 | An unconscious or dead decker or rigger stays jacked in or jumped in. | The status sync drops sustained spells only. `#defendMatrix` runs anyway. The vehicle combatant rolls the rigger's initiative. | S |
| 6 | Migrations miss v0.58.0 and reach world actors only. Two GMs can run them at once. | Bone lacing and filtration imported as kind `'other'`. Old vehicle skills are still on Quickness. `migrations.ts` loops `game.actors` only, with no `activeGM` check. | S–M |
| 7 | Unlinked tokens are missed by lookups. | `vehicleAboard`, `intruders`, drone subscribers, a site's slaved vehicles, and the sheet pickers for drones, vehicles, hosts and personas all scan `game.actors` only. | M |
| 8 | Stun damage hurts vehicles. | `resistVehicleDamage` / `vehicleIncomingDamage` (rules/vehicles.ts) ignore `damageType`. | S |
| 9 | A hand-driven vehicle rolls autopilot initiative, and a rigger and their vehicle both act. | The vehicle branch of `SR2Combatant.getInitiativeRoll`. | S |
| 10 | A spirit with a full track goes "dying" and can be stabilised. SR2 disrupts it. | `SpiritDataModel` status uses the character path; `dyingSince`, the bleed-out tick and first aid all apply. There are no grep hits for "disrupt". | S |
| 11 | Killing hands doesn't get past immunity to normal weapons. | The unarmed weapon has `magical: false`, and the immunity check excludes unarmed. | S |
| 12 | SR2 states aren't token statuses (full defense, delaying, surprised, on fire, afraid, held, jacked in, jumped in). Core statuses such as stun and deaf do nothing. There is no Effects tab. | `configureTokens` adds the wound icons only. | S–M |
| 13 | Rich-text fields are plain textareas: no `enrichHTML`, no @UUID links, and no "post item to chat". | Sheets and templates. | S |
| 14 | Jacking in or out, jumping in or out, sensor tests and drone commands cost no action. | `RULES.ACTIONS.costs`. | S |

## 2. Rules gaps (proposed v0.60.0; done in v0.61.0)

From memory of SR2 and its sourcebooks. Each row gives how sure the reviewer was.

| # | Gap | Evidence | Confidence | Size |
|---|---|---|---|---|
| 1 | DocWagon contracts (Basic, Gold, Platinum): yearly fee, biomonitor, response team, High Threat Response, resuscitation fees. | No grep hits for "docwagon" or "biomonitor". | High that it exists, medium on numbers | M |
| 2 | Seeing through invisibility. Each observer resists with Intelligence vs Force against the caster's successes. Astral perceivers see auras through mana illusions. | `TN_AUTO.perception.living` makes invisibility an automatic `'blind'`. `livingSenses` has no astral sense. `attackSight` gives blind fire even for a perceiving mage. | Medium | S–M |
| 3 | Smoke grenades. | `COMBAT.grenades` has no smoke kind; only fires make smoke. | — | S–M |
| 4 | Spirits' initiative bonuses. | They are typed by hand as Adjustments. | — | S |
| 5 | Healing a patient the player doesn't own needs an Apply (GM) card. | Applying is owner-only. | — | S |
| 6 | Gear and cyberware that give dice or TN to a named skill (climbing gear, reflex recorder, balance augmenter). | The cyberware and gear models have no skill field. | Medium | S |
| 7 | Superior position in melee (−1 TN for the side holding it, +1 TN against it). | No row in `COMBAT`. | Medium; check the book | S |
| 8 | Security sheaf steps launch their IC. | A step is `{step, event, alert}` only; the GM launches IC by hand. | Medium | M |
| 9 | Totem drawbacks by situation: berserk (Bear, Shark, maybe Wolf), Owl by daylight. | The totem schema holds flat dice only; no grep hits for "berserk". | Medium | S–M |
| 10 | Paralysis, petrification and binding powers hold the target. | No `POWER_SPECIALS` entry; `RULES.STATUSES` has blind and prone only. | High | S |
| 11 | Hearing: cyberears and deafness. | The `'ears'` kind is never read. | — | M |
| 12 | Toxin onset timed by Speed. | `exposeTo` only prints the speed; Resist can be clicked at once. | — | M |
| 13 | Fire immunity against fire attacks and fire spells, and immunity to drugs. | `immunities().fire` is checked for hazards and burning only. | — | S |
| 14 | Increase [Attribute] doesn't stack with cyberware. | Only reflex spells don't stack. | Medium; check the book | S |
| 15 | Following a magical link (sustained spell, bound spirit, active focus) back to the magician. | `track()` takes stored signatures only. | Medium | S |
| 16 | Creation: a magician's starting spell points, SR2's leftover cash, buying a lifestyle outright (100 months). | Not in `creation.ts`, `street.ts` or `upkeep.ts`. | Medium-low | S |
| 17 | Radios, encryption and comm jamming; fake SINs and licences against a checker. | No grep hits for "radio" or "transceiver". `legalCheck` treats a permit as simply held. | Medium | M |
| 18 | Grenade launchers (minimum arming range), stun baton charges, the monofilament whip (it can hit the wielder). | No templates or fields for these. | Medium-low | S each |
| 19 | Security devices that gas a room on lockdown. | Site `deviceKinds` has no gas device. | Medium | M |
| 20 | NPC generator: totems for shamans, vehicles and drones for riggers. | `npcgen.ts`. | — | S–M |

Smaller leftovers (21):
- exclusive spells' other limits;
- repeating powers by Combat Turn;
- wards drawn on the map;
- drug effects beyond attributes;
- the safehouse workshop as a shop for Build/Repair;
- bound spirits freed when their master dies;
- insect spirits' host bodies;
- a starter skill list.

## 3. Check the book (doubts raised by the sweep)

**Combat**
- Dodge TN: 4 plus modifiers, or the attacker's final TN as now?
- Combat Pool dice capped by the skill, or none when defaulting?
- Spell Pool capped by Sorcery?
- Shooting into or out of a melee.
- Explosive rounds blowing up on a Rule of One.
- Flechette against impact armor.
- Shotgun slugs.
- Gel rounds and knockdown.
- A bow's minimum Strength.
- Sprinting.

**Healing and toxins**
- First aid timing.
- A doctor's care shortening healing.
- Treating toxins with Biotech.
- Medkit supplies running out.

**Creation**
- Specialization at creation (+1 / −1).
- Cyberware grade and Availability caps at creation.
- Metatype cost multipliers.

**Magic**
- Spell focus dice for drain.
- Adepts in astral combat (Unarmed and Combat Pool?).
- Watchers' own test and duration.
- Drain damage that magic can't heal.
- The caster picking the damage level of a combat spell.
- Increase [Attribute] TN.

**Matrix, security and rigging**
- Host alert levels raising IC.
- Cancel Alert by an intruder.
- Ward breaches alerting the creator.
- Remote driving without an RCD.

## 4. Left to the GM (listed, not proposed)

- Otaku submerging and fading.
- Program options with combat effects.
- Turret traverse by Combat Phase.
- Cargo shape.
- Guards on patrol routes and tamper alarms on Matrix tampering.
- Heat on characters.
- Long task times run on the clock (rituals, elemental binding, library building, deck repair, downloads, bypass time).
- Satellite range.
- Psychotropic effects outside the Matrix.
- Dodging outside full defense, and buying successes with Good Karma.
- Contacts bought after creation, a contact's mood, haggling over services, Street Cred from deeds.
- The rare magic, health and gear odds and ends in VERIFY's "Not modelled" rows.
- Book tables the user fills in.
- Localisation (a release task).

## 5. Stale VERIFY.md rows (correct in the next step)

These rows still call things missing that were built since:
- Assensing has no table of reveals: built in v0.56.
- Enchanting radicals: built by alchemy (`thaumaturgy.ts`).
- Cargo by volume: built in v0.49.
- Guards' own Perception tests and tamper alarms on anything but bypasses: built in v0.49 (only Matrix tampering is still missing).
- Lifestyle overdue effects "up to the GM": built in v0.49.
- Other lifestyle effects, and contacts' own dice: built in v0.49.
- Delaying across passes: a house rule already exists (`DELAY.lostAtPassEnd`).
- Most of the v0.44.0 "Not modeled" row: built in v0.49.
- Ordeals other than asceticism, geas and quest: built in v0.48.
- The v0.46.0 Matrix and rigging "Not modeled" row: built in v0.49 (only satellite range is still missing).
- The last "Not modelled" row points to handoff lists that no longer exist.
- Dragging a weapon onto a token: sidebar drags work; only hotbar macro drags don't.
