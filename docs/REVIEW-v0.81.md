# v0.81.0: the whole-codebase review and security audit (24 Oct 2026)

The owner asked for "a thorough code review for holes / dead code / bugs / bad practices / missing comments" before moving on, then for an in-depth security scan. The rules values did not change. The only RULES differences from v0.80.0 are eight dead config keys removed.

## How it was done
1. **Eight independent reviewers, one slice each:** documents/index.ts in three thirds, sheets.ts and the templates, the other application files, and three slices of the rules engine. About 140 findings.
2. **Two security auditors.** The threat model: players are untrusted, because a player fully controls their own browser.
   - SEC1 covered authority and trust: 4 critical, 8 high, 7 medium, 4 low.
   - SEC2 covered injection and data: 3 critical, 1 high, 4 medium, 4 low, plus an inventory of every place HTML is built from data (3,736 sites).
3. **Live facts checked in Foundry 14.369** before designing the fixes:
   - ChatMessage content, dialogs, notifications and tooltips are cleaned of scripts and event handlers.
   - The system's own `innerHTML` writes are not cleaned.
   - The cleaner keeps `data-*` attributes and inline style, so a forged message could lay an invisible full-screen system button over the GM's screen.
   - The socket listener's second argument is the real sender id.
   - `ChatMessage.author` is enforced by the server.
   - Every chat message and actor, whispered or GM-only ones included, is sent to every client.
4. **Fixes, in three rounds:**
   - Round 1: bugs and security logic.
   - Round 2: an escaping sweep of about 1,300 interpolations.
   - Round 3: three independent reviewers checked the fixes, and their findings were fixed.
   - Each fixer worked on files no one else was editing, and each fix has a test.
5. **A live run of the exploits** as a player against the GM (`TESTPLAN` notes below), before and after round 3.

## The security model now (`rules/trust.ts`, `applications/trust.ts`)
- **Identity.** Only `message.author` and the socket's `senderId` are trusted. Flags, card text, button `data-*` and socket data are input.
- **Apply (GM) cards.** Each kind has an allow-list of keys with bounded values (`GM_APPLY_SPECS`).
  - The card applies at once when a GM posted it, or when its author owns the document it changes.
  - When it names a source actor the author doesn't own, it is refused.
  - Otherwise the GM sees a confirm built from the card's data (who posted it, the target, the amounts).
- **Auto-apply ("Apply players' GM-only changes by themselves").** Now **off by default** (the owner's decision). Only small changes from something the author owns ever apply by themselves. Alerts, passcodes, doors, damage, nuyen, healing, holds and jams always wait for the GM. The flags are snapshotted once and checked before each action.
- **Player-side buttons.**
  - A button goes ahead at once when the author is a GM or owns the acting character.
  - Routine tests (defend, resist, knockdown, toxin, crash and the like) also go ahead when the author owns the character the card comes from. That is ordinary play, and the values are bounded.
  - Costly or permanent changes (Magic loss, Karma, money, bindings, disease) confirm with the clicker.
- **No free-form writes.**
  - Cards can't carry a document update.
  - Create spirit builds a spirit or barrier field by field, owned by the summoner.
  - Projects run by the GM's clock have their calls and arguments checked.
  - Prices and charge Power are re-derived from the documents.
- **Socket relay.** Requests run as the server-set sender, and a request naming another user is refused.
- **Undo and approvals.** Undo keeps only the fields the server changed, never ownership. Approvals are re-checked on approve.
- **Escaping.**
  - One helper, `escHtml` (`rules/html.ts`), is used everywhere; it escapes `& < > " '`.
  - A ratchet test, `__tests__/v081-html-scan.test.ts`, fails on any new unescaped HTML site. There is an explicit allow-list, and `documents/index.ts` is held to its reviewed count of 37 deliberate HTML fragments.
  - Forged buttons in cards lose their inline style.
- **Robustness.** The chat hooks are isolated per message, and flag shapes are checked. The stat-block importer's regexes no longer backtrack, and input size is capped.

## Known limits (security)
- **What players can see.** Foundry sends every chat message and every actor to every client, so whispers, blind rolls and unshared NPC sheets are hidden in the interface only. This is a platform property, documented in the GM guide.
- **Forged projects.** A player can still make the GM's clock create a harmless Force 1 ward from a forged project. Its refunds go to an Apply (GM) card, and its other calls are checked.
- **Charges.** An untimed charge's Power is bounded by its explosive item and the setter's Demolitions, not fully re-derived: both are player-writable.
- **Unbindable cards.** `handSpirit`, a refund and a healed-box giveback can't be checked against a test. They are bounded and confirmed.
- **Draft flag.** The approval queue can be skipped through the draft flag; client-side checks can't stop this.
- **One extra click.** Clicking Apply (GM) on a card whose author doesn't own the target is one more click than before: the confirm.

## Behaviour changes worth knowing (bug fixes, not rules changes)
- **Combat and gear:**
  - Skill gear in 'best' mode keeps penalties.
  - Tracers need whole earlier bursts.
  - Reload spends the action only when it reloads.
  - Gear and Item Piles stacking compare more fields.
  - Round timers know which combat they belong to.
  - A generated sheaf's Shutdown step comes one trigger step earlier.
- **Magic and spirits:**
  - Spirits use their Force as Magic (drain, Spell Pool).
  - Rain and fog no longer depend on the smoke-row switch.
  - `pruneSignatures(0)` keeps none.
- **Actions:**
  - An exclusive spell blocks sheet skill and attribute rolls.
  - A character who can't act can't sneak; guards still spot a downed intruder.
  - Morale no longer un-breaks a group.
  - Surgery after a TN change no longer applies complications to a success.
- **Importers:**
  - The character import no longer reads list entries as values.
  - Edges and flaws are one per line.
  - "4/30 min" Availability is minutes.
- **Smaller fixes:** many other fixes, listed in the reviewers' reports (D1–D3, S, A, RA, RB, RC) and in the private work zip.

## Refactors suggested (not done; the owner decides)
- **Split the biggest functions:**
  - `documents/index.ts`: `planAttack`, `castSpell`, `#post`, `syncCondition`, `systemTest`, `#resolveSystem`.
  - `sheets.ts`: `#onAttackWeapon`, about 585 lines.
  - `models/index.ts`: `prepareDerivedData`.
  - Resolvers should return an outcome instead of the banner being read from card HTML.
- **Chat and per-render costs:**
  - `chat.ts`: a lookup table for the ~70-branch click dispatcher; split the file by topic.
  - Cache `tickActors` per tick, and keep one actor snapshot per sheet render.
- **Move data into RULES:**
  - `SHEAF_GEN` into `RULES.MATRIX.sheafGen`, so house rules can change it.
  - Schema `choices` lists read from RULES at validation time, about 25 fields. Today house-rule additions to those lists are refused.
- **Shared helpers:**
  - one `woundLevelForBoxes`;
  - one `clamp`/`num` (partly done in `rules/util.ts`);
  - a `kind` on TN modifiers, instead of matching labels.
- **Smaller wiring:**
  - Tie Defend/Resist cards to the attack card's test id, rather than to the author owning the source.
  - A "Resist ritual drain" chat button.
  - A noise choice for the Listen dialog, and the high/low-frequency cyberear check (`canHear`), which is still unwired.
