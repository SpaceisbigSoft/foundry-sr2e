/**
 * v0.93.5 (plan item 47, UI-16.2): the party view, for players (and the GM). A small read-only window listing the party
 * (the GM panel's Party tab's party: player characters, groups.ts groupActors('party')) with only what this user may
 * see: their own characters in full (the monitor as text, the wound modifier, pools, initiative and status), the
 * others' name and portrait, and a coarse wound state ("unhurt / hurt / badly hurt / down") when the world setting
 * "Players see party members' wounds" allows it. Nobody the user can't see (below Limited) is listed. A name opens
 * the sheet when the user may observe it (Foundry checks again). Opened from the Actors sidebar, Alt+P and
 * `game.sr2e.partyView()`. The rule is rules/gm935.ts (partyAccess, partyRow); nothing here changes a document.
 */
import { SYSTEM } from '../config/system.ts';
import { monitorView } from '../rules/look.ts';
import { partyAccess, partyRow, monitorTextOf, OWNERSHIP, type PartyRow, type CoarseWound } from '../rules/gm935.ts';
import { groupActors, overflowBody, poolsLine } from './groups.ts';
import { t as tx } from '../helpers/i18n.ts';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** The world setting: players see the coarse wound state of party members they don't own. */
export const PARTY_WOUNDS_SETTING = 'partyWounds';

function woundsSetting(): boolean {
  try { return game.settings.get(SYSTEM.id, PARTY_WOUNDS_SETTING) !== false; } catch { return true; }
}

/** This user's ownership level on an actor (Foundry's getUserLevel, else testUserPermission from the top). */
export function userLevel(actor: any, user: any): number {
  if (!actor || !user) return OWNERSHIP.NONE;
  try { const n = actor.getUserLevel?.(user); if (Number.isFinite(Number(n)) && n !== null && n !== undefined) return Number(n); } catch { /* older API */ }
  for (const [name, n] of [['OWNER', 3], ['OBSERVER', 2], ['LIMITED', 1]] as const) { try { if (actor.testUserPermission?.(user, name)) return n; } catch { /* no permission API */ } }
  return OWNERSHIP.NONE;
}

/** The coarse wound state in words (literal keys, so the unused-key check finds them). */
function woundLabel(w: CoarseWound): string {
  switch (w) {
    case 'down': return tx('SR2E.App.Party.woundDown');
    case 'badly': return tx('SR2E.App.Party.woundBadly');
    case 'hurt': return tx('SR2E.App.Party.woundHurt');
    default: return tx('SR2E.App.Party.woundUnhurt');
  }
}

/** One party member's row for this user (null: not listed). Only the fields partyRow returns reach the template. */
function rowFor(a: any, user: any, combat: any): PartyRow | null {
  const isGM = Boolean(user?.isGM);
  const level = userLevel(a, user);
  const access = partyAccess({ isGM, level, woundsSetting: woundsSetting() });
  if (!access.listed) return null;
  const d = a.system?.derived ?? {};
  const users = [...((game as any).users ?? [])];
  const player = users.find((u: any) => !u.isGM && u.character?.id === a.id) ?? users.find((u: any) => !u.isGM && a.testUserPermission?.(u, 'OWNER'));
  const cb = combat?.started ? [...(combat.combatants ?? [])].find((c: any) => c.actor?.uuid === a.uuid || c.actorId === a.id) : null;
  const status = String(d.status ?? 'ok');
  // The full-vitals facts are read only for a full row (an owner or the GM).
  const full = access.full;
  const cm = full ? monitorView(a.system?.monitor, overflowBody(a.system), { overflow: a.type !== 'spirit' }) : null;
  return partyRow({
    uuid: a.uuid, name: a.name, img: a.img, player: player?.name ?? '',
    physical: Number(a.system?.monitor?.physical ?? 0), stun: Number(a.system?.monitor?.stun ?? 0), status,
    monitorText: cm ? monitorTextOf(cm, tx('SR2E.UI.of2')) : '',
    wound: full ? Number(d.woundModifier ?? 0) : 0,
    pools: full ? poolsLine(a) : '',
    initiative: full && cb ? cb.initiative ?? null : null,
    acting: Boolean(full && cb && combat?.combatant?.id === cb.id),
    statusText: full && status !== 'ok' ? status.charAt(0).toUpperCase() + status.slice(1) : '',
  }, access, { canOpen: isGM || level >= OWNERSHIP.OBSERVER });
}

/** The template's view of a row (flags for Handlebars, the coarse wound's words). */
function rowView(r: PartyRow): Record<string, unknown> {
  if (r.kind === 'full') return { ...r, full: true, hasInit: r.initiative !== null };
  if (r.kind === 'coarse') return { ...r, coarse: true, woundText: woundLabel(r.wound) };
  return { ...r };
}

export class SR2PartyView extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: Record<string, any> = {
    id: 'sr2e-party-view',
    classes: ['sr2e', 'sr2e-party-view'],
    window: { title: 'SR2E.Window.Party.title', resizable: true, icon: 'fa-solid fa-users-viewfinder' },
    position: { width: 380, height: 'auto' },
    actions: { pvOpen: SR2PartyView.#onOpen },
  };
  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/party-view.hbs`, scrollable: [''] } };

  static #instance: SR2PartyView | null = null;
  static #timer: ReturnType<typeof setTimeout> | null = null;

  /** Open the party view (any user), or bring it forward. */
  static open(): SR2PartyView {
    SR2PartyView.#instance ??= new SR2PartyView();
    const w: any = SR2PartyView.#instance;
    if (w.minimized) void w.maximize?.();
    void w.render({ force: true });
    return SR2PartyView.#instance;
  }

  /** Re-render the open view soon (several changes at once render once). */
  static refresh(): void {
    const w: any = SR2PartyView.#instance;
    if (!w?.rendered) return;
    if (SR2PartyView.#timer) clearTimeout(SR2PartyView.#timer);
    SR2PartyView.#timer = setTimeout(() => { SR2PartyView.#timer = null; void w.render(); }, 250);
  }

  async close(options?: any): Promise<any> {
    SR2PartyView.#instance = null;
    return super.close(options);
  }

  async _prepareContext(_o: any): Promise<any> {
    const user: any = (game as any).user;
    const combat: any = (game as any).combat;
    const rows = groupActors('party').map((a: any) => rowFor(a, user, combat)).filter((r): r is PartyRow => Boolean(r))
      .sort((x, y) => Number(y.kind === 'full') - Number(x.kind === 'full') || x.name.localeCompare(y.name));
    return { rows: rows.map(rowView), isGM: Boolean(user?.isGM), wounds: woundsSetting() };
  }

  /** A name: the actor's sheet, when this user may observe it (checked again now; Foundry checks too). */
  static #onOpen(this: SR2PartyView, _e: Event, t: HTMLElement) {
    const a: any = fromUuidSync(t.dataset['uuid'] ?? '');
    const user: any = (game as any).user;
    if (!a || !(user?.isGM || userLevel(a, user) >= OWNERSHIP.OBSERVER)) return;
    void a.sheet?.render?.(true);
  }
}

/** v0.93.5: the party view's refresh hooks, the Actors sidebar button (every user) and Alt+P. Call at init. */
export function registerPartyView(): void {
  for (const h of ['updateActor', 'createActor', 'deleteActor', 'updateUser', 'createCombat', 'updateCombat', 'deleteCombat', 'createCombatant', 'updateCombatant', 'deleteCombatant']) {
    Hooks.on(h, () => SR2PartyView.refresh());
  }
  Hooks.on('updateSetting', (s: any) => { if (s?.key === `${SYSTEM.id}.${PARTY_WOUNDS_SETTING}`) SR2PartyView.refresh(); });
  Hooks.on('renderActorDirectory', (_app: any, html: HTMLElement) => {
    try {
      const root: HTMLElement = (html as any)?.querySelector ? html : (html as any)?.[0];
      if (!root || root.querySelector('[data-sr2e-action="partyView"]')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset['sr2eAction'] = 'partyView';
      btn.className = 'sr2e-award';
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-users-viewfinder';
      icon.setAttribute('aria-hidden', 'true');
      btn.append(icon, ` ${tx('SR2E.App.Party.button')}`);
      btn.addEventListener('click', (ev) => { ev.preventDefault(); SR2PartyView.open(); });
      const anchor = root.querySelector('.directory-footer, footer') ?? root.querySelector('.directory-header, header');
      (anchor ?? root).appendChild(btn);
    } catch (err) { console.warn('sr2e | Could not add the party view button', err); }
  });
  try {
    (game as any).keybindings?.register?.(SYSTEM.id, 'partyView', {
      name: 'SR2E.Keybindings.PartyView.Name', hint: 'SR2E.Keybindings.PartyView.Hint',
      editable: [{ key: 'KeyP', modifiers: ['Alt'] }],
      onDown: () => { SR2PartyView.open(); return true; },
    });
  } catch (err) { console.warn('sr2e | party view hotkey', err); }
}
