# v0.81.0 live security run

- Socket: a player request claiming the GM's userId → reply ok:false "The request names another user." PASS
- Forged Apply (GM) card {actorUpdate:{uuid:User.<me>, update:{role:4}}} with a full-screen invisible button: the button's style attribute was stripped on the GM client; the GM's click → "This card's data is not what the system posts: not applied."; role stayed 1. PASS
- Forged nuyen/monitor card on a GM NPC: refused the same way; NPC unchanged. PASS
- Forged projects on a player's own character + GM advances time 1 h: refundModPayer(boss, 500000) became an Apply (GM) card (not paid); finishWard({type:'npc', ownership:{default:3}}) created a Force 1 ward (type barrier), owned by the GM only. CONTAINED (residual: a player can still spawn a Force 1 ward this way; nuisance only).
- buyItem with a negative price from the player's client: refused (false), nuyen unchanged. PASS
- Character named <img src=x onerror=...>: attack card, Defend button, first aid and the GM Apply card all show it as escaped text; no img element, window.__p stayed undefined on the GM client. PASS
- Legit flow: the player's first aid on a GM NPC → Apply (GM) card → GM click → confirm dialog "Posted by ZZ Testplayer (for …). Apply this? Healing by … (4 successes). Read from the card's data…" → Yes → healed 4 → 2. PASS (the summary could name the patient and boxes.)
- Information: Foundry v14 sends every chat message (content and flags, whispered/blind included; 9 GM-only whispers readable) and every actor (a GM-only NPC with permission 0, full system data) to every client. Hidden information is hidden in the interface only. Platform property: documented, not fixable in a system.
- autoApplyGm set to false in the test world (owner's decision).
- Recheck after round 3 (24 Oct 2026): a player's attack on a GM NPC → the GM's Defend and Resist open their usual dialogs with no extra confirm (the routine rule), damage applied. PASS

Console probes used: see docs/REVIEW-v0.81.md.

## v0.81.1 live run (24 Oct 2026, Foundry 14.369, GM AI + ZZ Testplayer)
ZZ documents only: ZZ P1 (player-owned), ZZ P2 (GM-only) and ZZ Enemy (GM-only NPC), all deleted afterwards.

**Rich text: a player's biography holding script.** The payloads were:
- an `@UUID` label with `onerror`;
- an inline-roll flavour with `onerror`;
- a hidden `ownership.default` input;
- a `java&#9;script:` link;
- an `<img onerror>`;
- SVG `animate`;
- a `position:fixed` style.

Results:
- **Viewed by the GM:** nothing ran. The input and link were removed, the style stripped, and the links, rolls and formatting kept. **PASS.**
- **The GM clicking Edit: FAIL in the pre-fix build** (`<img onerror>` ran: ProseMirror loads the raw value). Fixed with `richSource`. **PASS after.**

**GM re-runs of player cards:**
- A GM retarget of a forged player powerEffect card posts an Apply (GM) card, leaves the target unchanged, and the new card is authored by the player. **PASS.**
- A GM retarget of a player's real roll re-scores normally. **PASS.**
- Two overlapping GM retargets: both authored by the player. Afterwards nobody is being acted for, and the GM's own whisper stays the GM's. **PASS.**
- A GM-rights task during a slow player re-run waits, then runs with the GM's rights. **PASS.**
- The write guard refuses a write to the GM's NPC during a player re-run, with a warning naming both. **PASS.**

**Chat styles:**
- A player's `position:fixed` overlay: positioning dropped, colour and bold kept. **PASS.**
- `font-size:1.5em` kept; `80px` and `border-image:url()` dropped. **PASS.**
- A GM message keeps its styles. **PASS.**

**Other checks:**
- **Spell defense:** an enemy's dice refused through the relay; an ally covering by link spends once. **PASS.**
- **Charges:** a record naming no explosive is refused for the player; the GM gets a confirm with Power 200. **PASS.**
- **Schema caps:** nuyen 250,000 accepted; Karma Pool capped at 1000. **PASS.**
- **Socket:** a request naming the GM's id is refused. **PASS.**

**Not run live:**
- Token Action HUD and Item Piles (not installed).
- The Cover targets button (ZZ P1 isn't a magician).
- The deferred blast area during a re-run.

These are unit-tested.
