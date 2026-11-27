/**
 * v0.94.1 (report item 21): on the cards of tests no player owns, a player's copy hides the target number, its
 * breakdown and the hover text with it (world setting `hideNpcNumbers`). Screen hiding, not security: the numbers
 * are still in the message's data.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { t as tx } from '../helpers/i18n.ts';
import { hidesNumbers } from '../rules/hidden941.ts';

/** The actor of a test card, from its snapshot's uuid (null when it isn't a test card or the actor is gone). */
function testActor(message: any): any {
  // A test card's snapshot, or (v0.94.1 review) a plain inline test's own flag.
  const uuid = message?.flags?.[SYSTEM_ID]?.test?.actorUuid ?? message?.flags?.[SYSTEM_ID]?.actorUuid;
  if (typeof uuid !== 'string' || !uuid) return null;
  try { return (globalThis as any).fromUuidSync?.(uuid) ?? null; } catch { return null; }
}

/** Whether a test card's modifiers include an NPC's racism (RACISM_MOD_ID in applications/core95.ts). */
export function carriesRacism(message: any): boolean {
  const mods = message?.flags?.[SYSTEM_ID]?.test?.modifiers;
  return Array.isArray(mods) && mods.some((m: any) => m?.id === 'racism95');
}

/** Hide the numbers in one rendered card (exported for the glue tests). */
export function hideNumbersIn(html: HTMLElement): void {
  for (const roll of Array.from(html.querySelectorAll('.sr2e-roll'))) {
    const summary = roll.querySelector('details.sr2e-fold > summary') as HTMLElement | null;
    if (summary) {
      summary.removeAttribute('title');
      // The TN is the summary's own last <strong> (the outcome's <strong> sits inside a span).
      const tn = (Array.from(summary.querySelectorAll(':scope > strong')).pop() ?? null) as HTMLElement | null;
      if (tn) { tn.textContent = '?'; tn.setAttribute('title', tx('SR2E.Card.Hidden.tnForTheGm')); }
    }
    for (const el of Array.from(roll.querySelectorAll('.sr2e-breakdown'))) el.remove();
  }
  html.classList.add('sr2e-numbers-hidden');
}

export function registerHiddenNumbers(): void {
  Hooks.on('renderChatMessageHTML', (message: any, html: HTMLElement) => {
    try {
      let enabled = true;
      try { enabled = game.settings.get(SYSTEM_ID, 'hideNpcNumbers') !== false; } catch { /* not registered */ }
      if ((game as any).user?.isGM) return;
      // v0.95.0 (RULES.CORE_V95.racism, Core p. 182): a social test against an NPC's racism hides its numbers from
      // every player, the speaker too (the target number is known only to the GM), whatever hideNpcNumbers says.
      if (carriesRacism(message)) { hideNumbersIn(html); return; }
      if (!enabled) return;
      const actor = testActor(message);
      if (!actor) return;
      if (!hidesNumbers({ enabled, viewerIsGM: false, playerOwned: Boolean(actor.hasPlayerOwner), viewerOwns: Boolean(actor.isOwner) })) return;
      hideNumbersIn(html);
    } catch (err) { console.warn('sr2e | hiding NPC numbers', err); }
  });
}
