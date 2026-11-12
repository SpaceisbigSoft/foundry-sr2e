### Combat

Every switch is in `RULES.COMBAT_V923` (`src/module/rules/config923/combat.ts`; logic in `rules/combat923.ts`); its first
choice is the book's way, the second puts v0.92.2 back. Under the Unified Rules Revamp (`URR_V80.active`) a switch for
a rule the Revamp changes itself (`REVAMP_COMBAT_RULES`: rangedDefense, fullDefense, knockdown, blastStaging, scatter,
shotgun, tracers, reload, initiativeTies, subdueTn, spreadFire, delay, rangedRows) answers the v0.92.2 way, so the
Revamp's own rule decides as before; the other switches are book corrections the Revamp is silent on and act under
either source. Where the Revamp already had the book's procedure (`urr80-combat.ts`), the Book Rules go through the
same code.

| Rule | Was | Now (book) | Source | Switch |
|---|---|---|---|---|
| Attacker's staging | 'afterFirst': (net − 1) ÷ 2 | every 2 net successes one level (ranged, melee, combat spells) | Core pp. 91, 101, 110 | `ATTACK_STAGING` 'afterFirst' → 'all' |
| Ranged defense | a Combat Pool dodge vs the attack's TN, then the soak on its own | no dodge; pool dice in the resistance test (Body + pool vs Power − armor); attack vs resistance successes, 2 net either way = 1 level, tie = base; clean miss when the pool's successes alone beat the attack's | Core pp. 87, 91; Dice Pools p. 84; Ka-Ge 7 Q4 | `COMBAT_V923.rangedDefense` 'book' / 'dodge' |
| Melee tie | nobody hurt | the attacker, base damage | Core pp. 100–101 | `COMBAT.melee.tie` 'none' → 'attacker' |
| Full defense | + Quickness dice, pool on the melee test, −10 initiative out of turn | no extra dice, no pool on the melee test, pool to the resistance test, clean miss on the pool's successes alone; no initiative cost | Core p. 102 | `COMBAT_V923.fullDefense` 'book' / 'dice' |
| Combat Pool refresh | each Combat Turn | at the start of each of the character's actions; leftovers last until the first action of the next Combat Turn (other pools: still each Combat Turn) | Core pp. 78, 84 | `COMBAT_V923.poolRefresh` 'action' / 'turn' |
| Knockdown | Power > Body; Body vs the soak TN; 0 = prone | every damaging hit; Body vs ½ Power (gel: Power; melee: the attacker's Strength); more than L 1 / M 2 / S 3 stays up, some successes stagger 1 m, none or Deadly = down | Core pp. 92, 102 | `COMBAT_V923.knockdown` 'book' / 'old' |
| Blast staging | successes only cut the scatter | each target's resistance successes vs the attack's, 2 net either way = 1 level | Core p. 97 | `COMBAT_V923.blastStaging` 'book' / 'off' |
| Scatter per success | 2 m for all; rockets by range band | standard 2 m, aerodynamic and launcher 4 m; rockets and missiles 2D6, as a launcher (4 m), missiles also − Intelligence m | Core pp. 97, 99 | `COMBAT_V923.scatter` 'book' / 'old' |
| AP rocket falloff | −0.5 per m | −1 per ½ m | Core p. 99 | `COMBAT.grenades` apRocket perMetre 0.5 → 2 |
| Shotguns | every shotgun spreads; width distance ÷ choke, −1 Power per metre | slug unless loaded with shot ('shot' ammo, flechette rules); 1 m, then 2, 4, 6… m every choke metres, −1 Power and −1 TN per widening; choke 2–10; shot: smartlink −1, no goggles or laser | Core p. 95 | `COMBAT_V923.shotgun` 'book' / 'old' |
| Tracers | −1 per earlier burst, to −3 | full auto only, −1 per 3 rounds beyond short range, none for a smartgun user, no Power from them | Fields of Fire | `COMBAT_V923.tracers` 'book' / 'old' |
| Cylinder / internal magazine reload | 2 rounds per action | Quickness rounds per Complex Action (break action 2) | Core p. 95 | `COMBAT_V923.reload` 'book' / 'old' |
| Initiative ties | Reaction, then Quickness | adjusted Reaction, then natural Reaction | Core p. 79 | `COMBAT_V923.initiativeTies` 'book' / 'quickness' |
| Wounds and initiative | also a mid-turn drop | at the roll only | Core p. 112 | `INITIATIVE_WOUNDS.midTurn` true → false |
| Delayed action | lost at the end of the pass | lasts through the Combat Turn and into the next; pool dice used while delaying break it | Core pp. 80, 84 | `DELAY.lostAtPassEnd` true → false; `COMBAT_V923.delay` 'book' / 'turn' |
| Surprise | — | an ambusher waiting on a delayed action rolls at TN − 2 | Core p. 86 | `COMBAT_V923.ambush` 'book' / 'off' |
| Ranged modifiers | not in the Book list | target running +2, stationary −1, attacker in melee +2 per opponent, walking / running on difficult ground +2 / +6, smart goggles −1 | Core p. 89 | `SITUATIONAL_MODIFIERS` rows; `COMBAT_V923.rangedRows` |
| Melee visibility | full ranged values | half, rounded down, except full darkness | Core p. 102 | `COMBAT_V923.meleeVisibility` 'half' / 'full' |
| Subduing | no TN change | +2 TN | Core p. 103 | `COMBAT_V923.subdueTn` 0 → 2 |
| Several melee targets | ranged only | +2 per other target this phase | Core p. 102 | `COMBAT_V923.meleeTargets` 'book' / 'off' |
| Friends in melee | attacker's friends −1 each | both sides counted: more −1 per friend more (max −4), fewer +1 per friend fewer (max +4) | Core p. 102 | `COMBAT_V923.friends` 'book' / 'old' |
| Full auto at several targets | extra-target TN 0; rounds wasted with any gun | +2 per new target (2nd +2, 3rd +4); a smartlinked smartgun wastes no rounds | Core p. 93 | `COMBAT_V923.spreadFire` 'book' / 'old' |
| Flechette vs armor | higher of B and I, doubled | higher of 2 × Impact and Ballistic | Core p. 93 | `COMBAT_V923.flechette` 'book' / 'double' |
| Firing through a barrier | rating adds to armor | also: double vs flechette and explosive; rated above the Power stops the shot | Core pp. 93, 98 | `COMBAT_V923.barriers` 'book' / 'old' |
| Short bursts | too few rounds can't fire | 2 rounds: +2 Power, no level (2 rounds' recoil); 1 round: a single shot | Core p. 92 | `COMBAT_V923.shortBurst` 'book' / 'off' |
| Second firearm | smartlink, goggles, laser still count | they don't | Core p. 90 | `COMBAT_V923.secondFirearm` 'book' / 'off' |
| Called shots | any mode; armor-gap option | SS/SA/BF only; +1 level or a vehicle part | Core p. 92 | `COMBAT_V923.calledShot` 'book' / 'old' |
| Take Aim cap | half the skill, at least 1 | half the skill, rounded down | Core p. 82 | `COMBAT_V923.aim` 'book' / 'old' |
| Demolitions | Demolitions vs 4 | vs 2 | Core p. 98 | `COMBAT.demolitions.tn` 4 → 2 |
| Readying a weapon | always ready | a Simple Action first | Core p. 82 | `COMBAT.ready.rule` 'off' → 'action' |
| Heavy weapon templates | LMG heavy, shotgun not | shotgun heavy, LMG not (MMG, HMG, shotguns) | Core p. 89 | weapon templates `heavy` |

Kept (the owner's decisions):
- Anti-vehicle rocket falloff −1 per 4 m (`COMBAT.grenades` avRocket perMetre 0.25); the book's table says −8 per metre (Core p. 99).

Not built:
- Interception (Core p. 83): a free melee attack on anyone passing within 1 m; needs movement tracking.
- Stray shots (Core p. 93, optional).
- Suppressive fire as in Fields of Fire (rounds per metre for 10 phases, rounds-fired dice vs 4 + cover).
- Laser sight cancelled by mist, smoke, fog or rain (Core p. 90); the Attack dialog's tick can be cleared.
- A second firearm's shared recoil (Core p. 90); a multi-phase aim lost to pool dice (Core p. 82).
- Explosive-round misfire on all ones (Core p. 93).
- Shotgun shot: +1 resistance die per other target in front (Core p. 95).
- Subduing: Stun weapons only, the maintenance test (Core p. 103).
- Knockback into a wall (+2 TN until free, Core p. 102).
- Blast in a confined space: the rebounding wave's Power in full per target (Core p. 98); the nearest-wall approximation stays.
- Quick draw as a Reaction (4) test (Core p. 82); surprise: no actions at all for 10 phases when out-rolled by everyone (Core p. 86).
- Reaction 0 or less from wounds means no actions (Core p. 112).
