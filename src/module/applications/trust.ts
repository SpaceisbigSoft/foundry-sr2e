/**
 * v0.81.0: the trusted-card rule, the Foundry side (the pure part and the reasons are in `rules/trust.ts`).
 *
 * - `cardAuthor(message)`: the User who posted it (`message.author`, set by the server).
 * - `authorIsGm(message)`, `authorOwns(message, docOrUuid)`: what that author may vouch for.
 * - `gmMay(...)`: a GM-side change because of a card (a GM's click): allowed straight away when the author is a GM
 *   or owns what changes; refused when the card names where the change comes from and the author owns none of it;
 *   otherwise the GM confirms a dialog built from the flags (not the card's content).
 * - `playerMay(...)`: a player-side action on a card (spending, rolling, resisting) goes ahead when the author is a GM
 *   or owns the acting actor; a consequence card from anyone else asks the clicker first (round 2: the sources a card
 *   names are the author's choice, so they never vouch for it), except a routine test (`ROUTINE_ACTIONS`) whose real
 *   source field (the attacker, the caster, the test's roller: never the speaker) the author owns (v0.81.1).
 */
import { escHtml } from '../rules/html.ts';
import { userOwns, trustedSource, uuidsOf, type CardTrust, type TrustUser } from '../rules/trust.ts';
import { t as tx } from '../helpers/i18n.ts';

/** The User who posted a message (server-set), or null. */
export function cardAuthor(message: any): any | null {
  const a = message?.author;
  if (a && typeof a === 'object') return a;
  // Older shapes: an id under `author` or `user`.
  const id = typeof a === 'string' ? a : typeof message?.user === 'string' ? message.user : message?.user?.id;
  return id ? ((game as any)?.users?.get?.(id) ?? null) : (message?.user && typeof message.user === 'object' ? message.user : null);
}

/** Whether a message's author is a GM. */
export function authorIsGm(message: any): boolean {
  return Boolean(cardAuthor(message)?.isGM);
}

/** A document, or the one a uuid names (synchronously; null when it isn't loaded or doesn't exist). */
function docOf(docOrUuid: any): any {
  if (!docOrUuid) return null;
  if (typeof docOrUuid !== 'string') return docOrUuid;
  try { return (globalThis as any).fromUuidSync?.(docOrUuid) ?? null; } catch { return null; }
}

/** Whether a message's author is a GM or has OWNER permission on the document (or the one the uuid names). */
export function authorOwns(message: any, docOrUuid: any): boolean {
  const user: TrustUser | null = cardAuthor(message);
  if (!user) return false;
  if (user.isGM) return true;
  return userOwns(user, docOf(docOrUuid));
}

/** The card's trust for the pure checks (`safeAutoApply`, `trustedSource`). */
export function cardTrust(message: any): CardTrust {
  return { authorIsGm: authorIsGm(message), owns: (uuid: string) => authorOwns(message, uuid) };
}

/** The uuid of the actor a message speaks for (its speaker), or ''. */
export function speakerActorUuid(message: any): string {
  const sp = message?.speaker ?? {};
  try {
    const cm: any = (globalThis as any).ChatMessage;
    const a = cm?.getSpeakerActor?.(sp) ?? (sp.actor ? (game as any)?.actors?.get?.(sp.actor) : null);
    return a?.uuid ? String(a.uuid) : '';
  } catch { return ''; }
}

/** A name for a uuid (for the confirmation), or ''. */
export function nameOfUuid(uuid: string): string {
  const d = docOf(uuid);
  return d?.name ? String(d.name) : '';
}

/**
 * v0.81.1 (SEC1-3, A-1, D1-8, D3-8, RB2-1, design 2): the card actions whose test may go ahead at once on someone
 * else's client when the card's real source is the author's (`playerMay`'s `routine`). These are the tests one
 * player's attack forces on another's character in ordinary play, all bounded by their handlers. Lasting or
 * self-only effects (cyberware, deck or armour damage, psychotropics, disease, overload, drug or adrenal crashes, a
 * vehicle crash, fire spreading, rigger or dump shock, morale) are not here: they confirm. `contestKarma` is here too:
 * the clicker spends their own Karma on their own side of a contest the author started from another side (A-7). A
 * source-scan test keeps chat.ts to this list.
 */
export const ROUTINE_ACTIONS: readonly string[] = ['defend', 'resist', 'resistSpell', 'knockdown', 'toxinHit', 'resistToxin', 'catchFire', 'takeCover', 'putOutFire', 'whipCheck', 'contestKarma'];

/**
 * Whether the user clicking a player-side card button may act on it (v0.81.0 round 2, R2-SEC-7).
 * - At once when the card's author is a GM, or owns the acting actor (the author could have done it themselves).
 * - When `sources` is empty (the card is about the author's own actor: their Karma, their power), refused otherwise.
 * - Otherwise the clicker confirms a dialog naming the poster and what the card asks (`what`, built from the flags).
 *   `sources` (the attacker, the caster, the speaker) only name where the card says it comes from in that dialog.
 * - `routine` (v0.81.1, design 2): for a routine test (`ROUTINE_ACTIONS`), the card's source fields (the attack's
 *   `attackerUuid`, the spell's `casterUuid`, the test's roller): when the author owns one, it goes ahead at once.
 *   Round 2 (V-SEC 13): these fields are written by the card's author as much as the speaker was, so owning one is
 *   no proof. What closes SEC1-3 is the short list (only tests one player's attack forces on another in ordinary play;
 *   everything lasting or self-only confirms) and the handlers' bounds on every value. Never add a costly or lasting
 *   action to ROUTINE_ACTIONS on the strength of its source field.
 */
export async function playerMay(message: any, acting: any, sources: readonly unknown[] = [], what: string | readonly string[] = [], opts: { routine?: readonly unknown[] } = {}): Promise<boolean> {
  if (authorIsGm(message)) return true;
  if (acting && authorOwns(message, acting)) return true;
  const who = String(cardAuthor(message)?.name ?? 'someone');
  const srcs = uuidsOf(sources);
  // A routine test from a source the author owns: ordinary play (a player attacking with their own character). The
  // values are bounded by the callers. Costly or permanent things never pass here (they aren't routine).
  const real = uuidsOf(opts.routine ?? []);
  if (real.length && trustedSource(cardTrust(message), real)) return true;
  if (!srcs.length) {
    (globalThis as any).ui?.notifications?.warn?.(tx('SR2E.Notify.Trust.thisCardWasPostedByWho', { who: escHtml(who) }));
    return false;
  }
  const actingName = typeof acting === 'string' ? nameOfUuid(acting) : String(acting?.name ?? '');
  const lines = (typeof what === 'string' ? [what] : [...what]).filter(Boolean);
  if (!lines.length) lines.push(tx('SR2E.Dialog.Trust.actsOnThisCard', { actingName: actingName || tx('SR2E.Dialog.Trust.aCharacter') }));
  const from = srcs.map((u) => nameOfUuid(u) || u).join(', ');
  const dlg: any = (globalThis as any).foundry?.applications?.api?.DialogV2;
  if (!dlg?.confirm) return false;
  const ok = await dlg.confirm({
    window: { title: tx('SR2E.Dialog.Trust.aCardFromAnotherPlayer') },
    content: `<p>${tx('SR2E.Dialog.Trust.postedBy')} <strong>${escHtml(who)}</strong>${tx('SR2E.Dialog.Trust.whoIsNotAGmAnd', { actingName: escHtml(actingName || tx('SR2E.Dialog.Trust.thisCharacter')), from: escHtml(from) })}</p>
      <ul>${lines.map((l) => `<li>${escHtml(l)}</li>`).join('')}</ul>
      <p class="hint">${tx('SR2E.Dialog.Trust.readFromTheCardSData')}</p>`,
    rejectClose: false,
  });
  return Boolean(ok);
}

/**
 * A GM-side change because of a card. Allowed at once when the author is a GM, or (unless `always`) owns `target`
 * (they could have made the change themselves). Refused when `sources` name actors and the author owns none of them.
 * Otherwise the GM confirms a dialog listing `lines` (plain text, escaped here), built by the caller from the flags.
 */
export async function gmMay(message: any, o: { title: string; lines: readonly string[]; target?: string | null; sources?: readonly unknown[]; always?: boolean }): Promise<boolean> {
  if (authorIsGm(message)) return true;
  if (!o.always && o.target && authorOwns(message, o.target)) return true;
  const author = cardAuthor(message);
  const who = String(author?.name ?? 'an unknown user');
  const srcs = uuidsOf(o.sources ?? []);
  if (srcs.length && !trustedSource(cardTrust(message), srcs)) {
    (globalThis as any).ui?.notifications?.warn?.(tx('SR2E.Notify.Trust.thisCardWasPostedByWho2', { who: escHtml(who) }));
    return false;
  }
  const from = srcs.length ? srcs.map((u) => nameOfUuid(u) || u).join(', ') : '';
  const dlg: any = (globalThis as any).foundry?.applications?.api?.DialogV2;
  if (!dlg?.confirm) return false;
  const ok = await dlg.confirm({
    window: { title: o.title },
    content: `<p>${tx('SR2E.Dialog.Trust.postedBy')} <strong>${escHtml(who)}</strong>${tx('SR2E.Dialog.Trust.applyThis', { part: from ? tx('SR2E.Dialog.Trust.for', { from: escHtml(from) }) : tx('SR2E.Dialog.Trust.theCardNamesNoCharacterIt') })}</p>
      <ul>${o.lines.map((l) => `<li>${escHtml(l)}</li>`).join('')}</ul>
      <p class="hint">${tx('SR2E.Dialog.Trust.readFromTheCardSData2')}</p>`,
    rejectClose: false,
  });
  return Boolean(ok);
}
