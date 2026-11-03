/**
 * v0.59.0 quality of life: floating damage numbers over tokens, hotkeys (defend or resist the newest card,
 * end the turn, roll initiative, open the GM panel; v0.86.0: open your sheet, go to the newest chat card, open the
 * guide), and Shift-click quick rolls for every test dialog.
 */
import { SYSTEM_ID } from "../config/system.ts";
import { rememberFocus } from "./a11y.ts";
import { t as tx } from '../helpers/i18n.ts';

// ---------------------------------------------------------------- floating damage numbers

/** Pure: the floating texts for a monitor change (boxes gained are damage, boxes lost are healing). */
export function damageTexts(before: { physical?: number; stun?: number; condition?: number }, after: { physical?: number; stun?: number; condition?: number }): Array<{ text: string; damage: boolean }> {
  const out: Array<{ text: string; damage: boolean }> = [];
  const row = (k: 'physical' | 'stun' | 'condition', label: string) => {
    if (before[k] === undefined || after[k] === undefined) return;
    const d = Number(after[k]) - Number(before[k]);
    if (!d) return;
    out.push(d > 0 ? { text: `−${d} ${label}`, damage: true } : { text: `+${-d} ${label}`, damage: false });
  };
  row('physical', 'Physical'); row('stun', 'Stun'); row('condition', 'Condition');
  return out;
}

function floatOver(actor: any, texts: Array<{ text: string; damage: boolean }>): void {
  try {
    if (game.settings.get(SYSTEM_ID, 'floatingDamage') === false) return;
  } catch { /* not registered */ }
  const ci: any = (canvas as any)?.interface;
  if (!ci?.createScrollingText || !texts.length) return;
  const tokens: any[] = actor?.getActiveTokens?.() ?? [];
  const anchor = (globalThis as any).CONST?.TEXT_ANCHOR_POINTS;
  for (const t of tokens) {
    if (!t?.visible) continue;
    texts.forEach((x, i) => {
      setTimeout(() => {
        try {
          ci.createScrollingText(t.center, x.text, {
            anchor: anchor?.TOP ?? 1, direction: x.damage ? (anchor?.BOTTOM ?? 0) : (anchor?.TOP ?? 1),
            fontSize: 28, fill: x.damage ? '#ff4136' : '#2ecc40', stroke: 0x000000, strokeThickness: 4, jitter: 0.25,
          });
        } catch { /* canvas gone */ }
      }, i * 350);
    });
  }
}

export function registerFloatingDamage(): void {
  Hooks.on('updateActor', (actor: any, _change: any, options: any) => {
    const m = options?.sr2ePrevMonitor;
    if (m && actor?.system?.monitor) floatOver(actor, damageTexts(m, actor.system.monitor));
    if (options?.sr2ePrevCondition !== undefined && actor?.type === 'vehicle') floatOver(actor, damageTexts({ condition: options.sr2ePrevCondition }, { condition: Number(actor.system?.condition ?? 0) }));
  });
}

// ---------------------------------------------------------------- Shift-click quick rolls

let quickUntil = 0;
/** v0.68.0: whether a Shift-click quick roll is armed (remembered roll choices are then left out: the defaults roll). */
export function quickRollArmed(app?: any): boolean { return Boolean(app?._sr2eQuick) || Date.now() <= quickUntil; }
/**
 * v0.81.0 (A-17): drop an armed quick roll. A Defend or Resist prompt for someone else's attack that opens inside the
 * 1.5 s window must not be answered with its defaults (chat.ts promptForCard calls this before its dialogs).
 */
export function disarmQuickRoll(): void { quickUntil = 0; }

/** Buttons that open a test dialog (a Shift-click on anything else arms nothing). */
const QUICK_ACTIONS = /roll|attack|cast|use|test|defend|resist|notice|perceive|drive|sensor|summon|banish|dispel|assense|track|heal|aid|jack|system|operation|power|skill|attribute|repair|bypass|search|social|negotiate|quick|soak|dodge|detect|ram|fire|throw/i;

/** Pure: whether a dialog's form is a test dialog that a quick roll may submit (never a confirmation). */
export function isTestDialog(form: { querySelector: (s: string) => unknown } | null | undefined): boolean {
  if (!form) return false;
  return Boolean(form.querySelector('.sr2e-preview') || form.querySelector('input[name="mod"]') || form.querySelector('input[name="pool"]'));
}

export function registerQuickRolls(): void {
  // A Shift-click on any SR2 sheet, card, HUD or panel button arms a quick roll for a moment.
  document.addEventListener('click', (ev: MouseEvent) => {
    if (!ev.shiftKey) return;
    const el = (ev.target as HTMLElement | null)?.closest?.('[data-action], [data-sr2e-action]') as HTMLElement | null;
    if (!el || !el.closest('.sr2e, .chat-message, #token-hud, .sr2e-gm-panel')) return;
    const act = String(el.dataset['action'] ?? el.dataset['sr2eAction'] ?? '');
    if (/delete|remove|drop|undo|evict|sell|edit|tab/i.test(act) || !QUICK_ACTIONS.test(act)) return;
    quickUntil = Date.now() + 1500;
  }, true);
  Hooks.on('renderDialogV2', (app: any, html: HTMLElement) => {
    if (Date.now() > quickUntil) return;
    const root: HTMLElement | null = (html as any)?.querySelector ? html : app?.element ?? null;
    const form = root?.tagName === 'FORM' ? root : root?.querySelector('form');
    if (!isTestDialog(form as any)) return;
    quickUntil = 0;
    if (app) app._sr2eQuick = true;
    const ok = root?.querySelector<HTMLButtonElement>('button[data-action="ok"], footer button.default, footer button[autofocus]')
      ?? root?.querySelector<HTMLButtonElement>('footer button');
    if (ok) setTimeout(() => ok.click(), 30);
  });
}

// ---------------------------------------------------------------- hotkeys

/** The newest chat card with an unused Defend (or Resist) button for something this user owns. */
function newestButton(action: 'defend' | 'resist'): HTMLButtonElement | null {
  const msgs: any[] = [...((game as any).messages?.contents ?? [])].reverse().slice(0, 40);
  for (const m of msgs) {
    if (!String(m.content ?? '').includes(`data-sr2e-action="${action}"`)) continue;
    const list: any[] = action === 'defend'
      ? ((m.getFlag(SYSTEM_ID, 'attacks') as any[] | undefined) ?? [m.getFlag(SYSTEM_ID, 'attack')].filter(Boolean))
      : ((m.getFlag(SYSTEM_ID, 'damages') as any[] | undefined) ?? [m.getFlag(SYSTEM_ID, 'damage')].filter(Boolean));
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(`#chat [data-message-id="${m.id}"] button[data-sr2e-action="${action}"], .chat-log [data-message-id="${m.id}"] button[data-sr2e-action="${action}"]`));
    for (const b of buttons) {
      if (b.disabled) continue;
      const entry = list[Number(b.dataset['index'] ?? 0)];
      const target: any = entry ? (globalThis as any).fromUuidSync?.(entry.targetUuid) : null;
      if (target?.isOwner) return b;
    }
  }
  return null;
}

/**
 * v0.86.0: the hotkeys' names and hints are localization keys (lang/en.json, SR2E.Keybindings.*): Foundry translates them
 * in Configure Controls. Pure list, so the guide and the tests can check the defaults.
 */
export const HOTKEYS: ReadonlyArray<{ id: string; key: string; label: string; gm?: boolean }> = [
  { id: 'defendNewest', key: 'KeyD', label: 'DefendNewest' },
  { id: 'resistNewest', key: 'KeyR', label: 'ResistNewest' },
  { id: 'endTurn', key: 'KeyE', label: 'EndTurn' },
  { id: 'rollInitiative', key: 'KeyI', label: 'RollInitiative' },
  { id: 'openSheet', key: 'KeyS', label: 'OpenSheet' },
  { id: 'focusCard', key: 'KeyC', label: 'FocusCard' },
  { id: 'openGuide', key: 'KeyH', label: 'OpenGuide' },
  { id: 'gmPanel', key: 'KeyG', label: 'GmPanel', gm: true },
  // v0.89.8: the SR2e tools window (every tool in one place; applications/tools.ts).
  { id: 'openTools', key: 'KeyT', label: 'OpenTools' },
];

/** The newest chat card with a button this user may press, and that button (for Alt+C). */
function newestCardButton(): HTMLElement | null {
  const msgs: any[] = [...((game as any).messages?.contents ?? [])].reverse().slice(0, 40);
  for (const m of msgs) {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(`#chat .chat-log [data-message-id="${m.id}"], .chat-log [data-message-id="${m.id}"], #chat-notifications [data-message-id="${m.id}"]`));
    for (const card of cards) {
      // The card's own buttons first, never the message header's controls (Delete).
      for (const sel of ['.message-content button[data-sr2e-action]:not([disabled])', '.message-content button:not([disabled])', '.message-content [data-sr2e-kb]']) {
        const b = card.querySelector<HTMLElement>(sel);
        if (b && b.offsetParent !== null) return b;
      }
    }
  }
  return null;
}

/** The actor whose sheet Alt+S opens: the one controlled token, else the user's own character. */
function mySheetActor(): any {
  const tokens: any[] = (canvas as any)?.tokens?.controlled ?? [];
  if (tokens.length === 1 && tokens[0]?.actor?.isOwner) return tokens[0].actor;
  return (game as any).user?.character ?? null;
}

/** v0.89.8: what each hotkey does, also run by the SR2e tools window and toolbar (`runHotkey`). */
const HOTKEY_ACTIONS: Record<string, () => void> = {
  defendNewest: () => {
    const b = newestButton('defend');
    if (b) { rememberFocus(b); b.click(); } else ui.notifications?.info?.(tx('SR2E.Notify.Hotkeys.noAttackWaitingForOneOf'));
  },
  resistNewest: () => {
    const b = newestButton('resist');
    if (b) { rememberFocus(b); b.click(); } else ui.notifications?.info?.(tx('SR2E.Notify.Hotkeys.noDamageWaitingForOneOf'));
  },
  endTurn: () => {
    const c: any = (game as any).combat;
    if (!c?.started) return void ui.notifications?.info?.(tx('SR2E.Notify.Hotkeys.noCombatIsRunning'));
    if (!(game as any).user?.isGM && !c.combatant?.actor?.isOwner) return void ui.notifications?.warn?.(tx('SR2E.Notify.Hotkeys.itIsNotYourTurn'));
    void c.nextTurn();
  },
  rollInitiative: () => {
    const c: any = (game as any).combat;
    if (!c) return void ui.notifications?.info?.(tx('SR2E.Notify.Hotkeys.noCombatToRollFor'));
    const tokens: any[] = (canvas as any)?.tokens?.controlled ?? [];
    const mine = [...(c.combatants ?? [])].filter((x: any) => x.isOwner && (x.initiative === null || x.initiative === undefined)
      && (tokens.length ? tokens.some((t: any) => t.id === x.tokenId) : x.actor?.id === (game as any).user?.character?.id || !(game as any).user?.isGM));
    if (!mine.length) return void ui.notifications?.info?.(tx('SR2E.Notify.Hotkeys.nobodyOfYoursIsWaitingFor'));
    void c.rollInitiative(mine.map((x: any) => x.id));
  },
  openSheet: () => {
    const a = mySheetActor();
    if (!a) return void ui.notifications?.info?.(tx('SR2E.Notify.Hotkeys.selectOneOfYourTokensOr'));
    void a.sheet?.render?.({ force: true });
  },
  focusCard: () => {
    // Show the chat log first (the sidebar may be collapsed or on another tab), then look for the card.
    try { (ui as any).sidebar?.expand?.(); (ui as any).chat?.activate?.(); } catch { /* older layout */ }
    setTimeout(() => {
      const b = newestCardButton();
      if (!b) return void ui.notifications?.info?.(tx('SR2E.Notify.Hotkeys.noChatCardWithAButton'));
      b.scrollIntoView?.({ block: 'nearest' });
      b.focus();
    }, 150);
  },
  // Through the API (help.ts needs Foundry's classes when it loads; this file is also loaded by the tests).
  openGuide: () => { void (game as any).sr2e?.api?.openHelp?.(); },
  gmPanel: () => { void (game as any).sr2e?.gmPanel?.(); },
  openTools: () => { void (game as any).sr2e?.api?.openTools?.(); },
};

/** v0.89.8: run a hotkey's action by its id (false for an unknown id). */
export function runHotkey(id: string): boolean {
  const f = HOTKEY_ACTIONS[id];
  if (!f) return false;
  f();
  return true;
}

export function registerHotkeys(): void {
  const kb: any = (game as any).keybindings;
  if (!kb?.register) return;
  const run = HOTKEY_ACTIONS;
  for (const h of HOTKEYS) {
    try {
      kb.register(SYSTEM_ID, h.id, {
        name: `SR2E.Keybindings.${h.label}.Name`,
        hint: `SR2E.Keybindings.${h.label}.Hint`,
        editable: [{ key: h.key, modifiers: ['Alt'] }],
        restricted: Boolean(h.gm),
        onDown: () => { run[h.id]?.(); return true; },
      });
    } catch (err) { console.warn('sr2e | hotkey', h.id, err); }
  }
}
