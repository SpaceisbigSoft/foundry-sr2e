/**
 * v0.68.0: the second interface pass, Foundry-free parts. Sheet layouts (Tabs, Combat column, Compact),
 * the always-visible status strip, the "your turn" helper (what an action button costs and whether it
 * still fits this phase), remembered roll-dialog choices, number steppers, grouped notifications,
 * window size and position memory, section icons, and the settings window's sections and search.
 */
import { RULES } from './config.ts';
import { actionCost, actionUnits, type ActionCost } from './core.ts';
import { matchesSearch } from './catalogue.ts';
import { t as tx } from '../helpers/i18n.ts';

// ---------------------------------------------------------------- Layouts

export const LAYOUTS = ['tabs', 'combat', 'compact'] as const;
export type SheetLayout = typeof LAYOUTS[number];
/** v0.89.4: keys (lang/en.json); the setting's choices are translated by Foundry. */
export const LAYOUT_LABELS: Record<SheetLayout, string> = {
  tabs: 'SR2E.Settings.sheetLayout.Choices.tabs',
  combat: 'SR2E.Settings.sheetLayout.Choices.combat',
  compact: 'SR2E.Settings.sheetLayout.Choices.compact',
};

export function normalizeLayout(v: unknown): SheetLayout {
  return (LAYOUTS as readonly string[]).includes(String(v)) ? (v as SheetLayout) : 'tabs';
}

/** The actor types whose sheets take the layouts (the others keep their own single page). */
export const LAYOUT_TYPES = ['character', 'npc', 'spirit'] as const;
export function layoutFor(actorType: string, chosen: unknown): SheetLayout {
  return (LAYOUT_TYPES as readonly string[]).includes(actorType) ? normalizeLayout(chosen) : 'tabs';
}

/** Compact layout: the tab sections open by default (the others start folded). */
export const COMPACT_OPEN = ['main', 'combat'];
export function compactFoldKey(actorType: string, tab: string): string { return `${actorType}:${tab}`; }
/** Whether a tab section is folded in the Compact layout: the player's choice, else the default. */
export function compactFolded(tab: string, key: string, stored: Record<string, boolean> | null | undefined): boolean {
  if (stored && typeof stored[key] === 'boolean') return stored[key] as boolean;
  return !COMPACT_OPEN.includes(tab);
}

// ---------------------------------------------------------------- Section and tab icons

const SECTION_ICONS: Array<[RegExp, string]> = [
  [/^(attributes|stats|stat line|statline)\b/i, 'fa-solid fa-user'],
  [/^derived\b/i, 'fa-solid fa-calculator'],
  [/^condition|^monitor|^damage\b/i, 'fa-solid fa-heart-pulse'],
  [/skills?\b/i, 'fa-solid fa-graduation-cap'],
  [/^(weapons|attacks)\b/i, 'fa-solid fa-gun'],
  [/^armor\b/i, 'fa-solid fa-shield-halved'],
  [/^spells\b/i, 'fa-solid fa-wand-sparkles'],
  [/^adept powers\b/i, 'fa-solid fa-hand-fist'],
  [/^powers\b/i, 'fa-solid fa-bolt'],
  [/^magic\b/i, 'fa-solid fa-hat-wizard'],
  [/^conjuring\b/i, 'fa-solid fa-ghost'],
  [/^foci\b/i, 'fa-solid fa-gem'],
  [/^(geasa|sustaining|anchored)\b/i, 'fa-solid fa-link'],
  [/^cyberware|^bioware/i, 'fa-solid fa-microchip'],
  [/^(other )?gear\b|^cargo\b/i, 'fa-solid fa-toolbox'],
  [/^(cyberdeck|matrix|programs|persona)\b/i, 'fa-solid fa-network-wired'],
  [/^(rigging|control|vehicle|drones|chase|aboard)\b/i, 'fa-solid fa-car-side'],
  [/^sensors\b/i, 'fa-solid fa-satellite-dish'],
  [/^modifications\b/i, 'fa-solid fa-screwdriver-wrench'],
  [/^contacts\b/i, 'fa-solid fa-address-book'],
  [/^(money|karma|lifestyle|ledger|upkeep)\b/i, 'fa-solid fa-coins'],
  [/^(in effect|effects|statuses|addictions|diseases)\b/i, 'fa-solid fa-flask'],
  [/^(edges|reputation)\b/i, 'fa-solid fa-star'],
  [/^(biography|notes|bio)\b/i, 'fa-solid fa-book'],
  [/^(under way|training)\b/i, 'fa-solid fa-hourglass-half'],
  [/^(creation|advancement|character creation|waiting for)\b/i, 'fa-solid fa-clipboard-list'],
  [/^services\b/i, 'fa-solid fa-handshake'],
];

/** The icon for a sheet section heading (the same word gets the same icon on every sheet), or ''. */
export function sectionIcon(heading: string): string {
  const t = String(heading ?? '').trim();
  for (const [re, icon] of SECTION_ICONS) if (re.test(t)) return icon;
  return '';
}

export const TAB_ICONS: Record<string, string> = {
  main: 'fa-solid fa-user', current: 'fa-solid fa-gauge', combat: 'fa-solid fa-crosshairs', effects: 'fa-solid fa-flask',
  magic: 'fa-solid fa-hat-wizard', matrix: 'fa-solid fa-network-wired', rigging: 'fa-solid fa-car-side', gear: 'fa-solid fa-toolbox',
  upkeep: 'fa-solid fa-coins', creation: 'fa-solid fa-clipboard-list', bio: 'fa-solid fa-book',
};
export function tabIcon(id: string): string { return TAB_ICONS[id] ?? 'fa-solid fa-circle'; }

// ---------------------------------------------------------------- The status strip

export interface StripPool { key: string; label: string; left: number; total: number }
export interface StripWeapon { id: string; name: string; melee: boolean; ammo: number; ammoMax: number; mode: string; jammed: boolean; ready: boolean }
export interface StripInput {
  wound: number;
  status: string;
  stabilised?: boolean;
  initiative: number | null;
  reaction: number;
  initiativeDice: number;
  pools: StripPool[];
  karmaPool: { left: number; total: number } | null;
  weapon: StripWeapon | null;
  acting: boolean;
  actionsUsed: number;
  enforce: string;
}

const POOL_SHORT: Record<string, string> = { combat: 'C', spell: 'Sp', hacking: 'H', control: 'Ct', karma: 'KP', astral: 'A' };

/** A condition status in words ("Dying (stabilised)"); an unknown status id capitalised. */
function statusWord(status: string, stabilised: boolean): string {
  if (status === 'dying') return stabilised ? tx('SR2E.Text.Interface.dyingStabilised') : tx('SR2E.Text.Interface.dying');
  if (status === 'wounded') return tx('SR2E.Text.Interface.wounded');
  if (status === 'unconscious') return tx('SR2E.Text.Interface.unconscious');
  if (status === 'dead') return tx('SR2E.Text.Interface.dead');
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

/** What the always-visible strip shows: condition, wounds, initiative, pools left, Karma Pool, the readied weapon, your turn. */
export function statusStrip(s: StripInput) {
  const perPhase = Number(RULES.ACTIONS.perPhase) || 2;
  const left = Math.max(0, perPhase - (Number(s.actionsUsed) || 0));
  const turn = s.acting && s.enforce !== 'off'
    ? { left, label: left >= 2 ? tx('SR2E.Text.Interface.complexOrSimple') : left === 1 ? tx('SR2E.Text.Interface.oneSimple') : tx('SR2E.Text.Interface.freeActionsOnly'), pips: Array.from({ length: perPhase }, (_, i) => ({ on: i < left })) }
    : s.acting ? { left, label: tx('SR2E.Text.Interface.yourAction'), pips: [] } : null;
  const w = s.weapon;
  return {
    wound: s.wound > 0 ? `+${s.wound}` : '',
    status: s.status && s.status !== 'ok' ? statusWord(s.status, Boolean(s.stabilised)) : '',
    danger: ['unconscious', 'dying', 'dead'].includes(s.status),
    init: s.initiative != null ? String(s.initiative) : `${s.reaction} + ${s.initiativeDice}d6`,
    initNow: s.initiative != null,
    pools: s.pools.filter((p) => p.total > 0).map((p) => ({ ...p, short: POOL_SHORT[p.key] ?? p.label.slice(0, 2), empty: p.left <= 0 })),
    karma: s.karmaPool && s.karmaPool.total > 0 ? { ...s.karmaPool, empty: s.karmaPool.left <= 0 } : null,
    weapon: w ? {
      id: w.id, name: w.name, mode: w.melee ? tx('SR2E.Text.Interface.melee') : w.mode,
      ammo: w.ammoMax > 0 ? `${w.ammo}/${w.ammoMax}` : '', low: w.ammoMax > 0 && w.ammo <= Math.max(0, Math.floor(w.ammoMax / 5)),
      out: w.ammoMax > 0 && w.ammo <= 0, jammed: w.jammed, holstered: !w.ready,
    } : null,
    turn,
  };
}

/**
 * The weapon the strip shows: the one last attacked with (if it's still there), else the first pinned
 * weapon, else the first ready ranged weapon with ammunition, else the first ready weapon, else the first.
 */
export function readiedWeapon<T extends { id: string; ready: boolean; melee: boolean; ammoMax: number }>(weapons: T[], o: { last?: string | null; pins?: string[] } = {}): T | null {
  if (!weapons.length) return null;
  const by = (id: string | null | undefined) => (id ? weapons.find((w) => w.id === id) : undefined);
  return by(o.last) ?? (o.pins ?? []).map((id) => by(id)).find(Boolean)
    ?? weapons.find((w) => w.ready && !w.melee && w.ammoMax > 0) ?? weapons.find((w) => w.ready) ?? weapons[0]!;
}

// ---------------------------------------------------------------- Your turn: what a button costs

/** Sheet button actions and the action they take (RULES.ACTIONS.costs keys). Attacks depend on the weapon. */
export const BUTTON_ACTION_KINDS: Record<string, string> = {
  castSpell: 'cast', quickCast: 'cast', castAtObject: 'cast', summonSpirit: 'summon', banishSpirit: 'banish',
  usePower: 'power', astralAttack: 'astral', assense: 'assense', dispel: 'dispel', firstAid: 'firstAid',
  reloadWeapon: 'reload', quickReload: 'reload', takeAim: 'aim', drawWeapon: 'draw',
  standUp: 'stand', perceive: 'perceive', socialTest: 'social', clearJam: 'clearJam', fullDefense: 'fullDefense',
  jackIn: 'jackIn', jackOut: 'jackOut', driveVehicle: 'drive', suppressFire: 'suppress', applyPatch: 'patch',
  takeDrug: 'drug', athletics: 'athletics', rally: 'rally',
  // A search with a scanner is a simple action (scan), by hand complex: the cheaper one, so the button isn't greyed wrongly.
  searchPerson: 'scan', setUpWeapon: 'setUpWeapon',
  holdTarget: 'hold', breakFree: 'breakFree', putOutFire: 'putOutFire', matrixAttack: 'matrixAttack', runMedic: 'medic',
  shapeshift: 'shapeshift', takeControl: 'takeControls', toggleJump: 'jumpIn', groupDrive: 'droneCommand', groupAttack: 'droneCommand',
  // v0.71.0 (R14): the Matrix tab, Sneak, and the vehicle sheet's own buttons. A system operation varies by the
  // operation picked in its dialog: the cheaper (simple) one here, so the button isn't greyed wrongly.
  matrixPerceive: 'matrix:simple', matrixManeuver: 'matrixManeuver', useUtility: 'matrix:complex', systemTest: 'matrix:simple',
  releaseSmoke: 'matrix:simple', securityAction: 'matrix:complex', sneak: 'perceive',
  sensorTest: 'sensor', ramVehicle: 'drive', pushSpeed: 'drive', fireMounted: 'fire:SS',
};

/**
 * v0.70.0: sheet buttons that are physical actions, greyed while the character is projecting or a spirit is
 * unmaterialized (the actor refuses them too: `SR2Actor.canAct`, RULES.FIXES_V70.astralBlocksPhysical).
 */
export const ASTRAL_BLOCKED_ACTIONS = new Set([
  'attackWeapon', 'quickAttack', 'firstAid', 'reloadWeapon', 'quickReload', 'takeAim', 'drawWeapon', 'standUp', 'clearJam',
  'jackIn', 'driveVehicle', 'suppressFire', 'applyPatch', 'takeDrug', 'athletics', 'searchPerson', 'setUpWeapon', 'holdTarget',
  'breakFree', 'putOutFire', 'takeControl', 'toggleJump', 'groupDrive', 'groupAttack', 'sneak',
]);

/** What a weapon attack costs (the same kinds `attackWeapon` spends). */
export function attackKind(w: { melee?: boolean; blast?: boolean; strengthRange?: boolean; mode?: string | null; modes?: string[] }): string {
  if (w.melee) return 'melee';
  if (w.blast || w.strengthRange) return 'throw';
  return `fire:${w.mode || w.modes?.[0] || 'SS'}`;
}

/**
 * The action a button takes, or null when it isn't an action in combat (editing, opening a sheet…).
 * An Attack button without a firing mode of its own costs its cheapest mode (the mode is picked in the dialog).
 */
export function buttonCost(action: string, weapon?: (Parameters<typeof attackKind>[0] & { explicit?: boolean }) | null): ActionCost | null {
  if (action === 'attackWeapon' || action === 'quickAttack') {
    if (!weapon) return action === 'quickAttack' ? 'simple' : null;
    if (!weapon.explicit && !weapon.melee && !weapon.blast && !weapon.strengthRange && (weapon.modes?.length ?? 0) > 1) {
      const costs = weapon.modes!.map((m) => actionCost(attackKind({ mode: m })));
      return costs.reduce((a, b) => (actionUnits(b) < actionUnits(a) ? b : a));
    }
    return actionCost(attackKind(weapon));
  }
  const kind = BUTTON_ACTION_KINDS[action];
  return kind ? actionCost(kind) : null;
}

/** Whether an action of this cost still fits the phase (free actions always do). */
export function affordable(cost: ActionCost | null, used: number): boolean {
  if (!cost) return true;
  return (Number(used) || 0) + actionUnits(cost) <= (Number(RULES.ACTIONS.perPhase) || 2);
}

// ---------------------------------------------------------------- Remembered roll choices

export interface RollMemory { [key: string]: { t: number; v: Record<string, string | boolean> } }
export const ROLL_MEMORY_MAX = 200;

/** Which fields a dialog remembers ("force,pool,useFocus"): only plain names. */
export function memoryFields(spec: string | null | undefined): string[] {
  return String(spec ?? '').split(',').map((s) => s.trim()).filter((s) => /^[A-Za-z][\w-]{0,40}$/.test(s));
}

/** Store a dialog's choices (the newest first; the oldest go past ROLL_MEMORY_MAX). */
export function rememberRoll(mem: RollMemory | null | undefined, key: string, values: Record<string, string | boolean>, now = Date.now()): RollMemory {
  const out: RollMemory = { ...(mem && typeof mem === 'object' ? mem : {}) };
  if (!key) return out;
  out[key] = { t: now, v: { ...values } };
  const keys = Object.keys(out).sort((a, b) => (out[b]!.t ?? 0) - (out[a]!.t ?? 0));
  for (const k of keys.slice(ROLL_MEMORY_MAX)) delete out[k];
  return out;
}

/** A remembered number put back into a field: kept inside the field's min and max. */
export function restoredNumber(saved: unknown, o: { min?: number | null; max?: number | null } = {}): string | null {
  const n = Number(saved);
  if (saved === '' || saved === null || saved === undefined || !Number.isFinite(n)) return null;
  let v = n;
  if (o.max != null && Number.isFinite(o.max)) v = Math.min(v, o.max);
  if (o.min != null && Number.isFinite(o.min)) v = Math.max(v, o.min);
  return String(v);
}

// ---------------------------------------------------------------- Steppers and the scroll wheel

/** One step of a number field: by its step, inside min and max, with the step's decimals. */
export function stepValue(value: unknown, dir: number, o: { step?: number | null; min?: number | null; max?: number | null } = {}): number {
  const step = Number(o.step) > 0 ? Number(o.step) : 1;
  const base = Number.isFinite(Number(value)) && String(value ?? '') !== '' ? Number(value) : (o.min != null && Number.isFinite(o.min) ? Number(o.min) : 0);
  const decimals = (String(step).split('.')[1] ?? '').length;
  let v = Number((base + Math.sign(dir) * step).toFixed(decimals));
  if (o.max != null && Number.isFinite(o.max)) v = Math.min(v, Number(o.max));
  if (o.min != null && Number.isFinite(o.min)) v = Math.max(v, Number(o.min));
  return v;
}

// ---------------------------------------------------------------- Grouped notifications

export interface NoteIn { type: string; message: string }
export interface NoteOut { type: string; message: string; count: number }
export const NOTE_GROUP = { windowMs: 300, repeatMs: 4000, maxLines: 3 };

/**
 * A burst of notifications into a few: the same text once with ×N, and several of one kind
 * (info, warning, error) in a burst as one line each up to `maxLines`, then "…and N more".
 */
export function groupNotes(notes: NoteIn[]): NoteOut[] {
  const byType = new Map<string, Array<{ message: string; count: number }>>();
  for (const n of notes) {
    const list = byType.get(n.type) ?? [];
    const same = list.find((x) => x.message === n.message);
    if (same) same.count++;
    else list.push({ message: n.message, count: 1 });
    byType.set(n.type, list);
  }
  const out: NoteOut[] = [];
  for (const [type, list] of byType) {
    const line = (x: { message: string; count: number }) => (x.count > 1 ? `${x.message} (×${x.count})` : x.message);
    if (list.length === 1) { out.push({ type, message: line(list[0]!), count: list[0]!.count }); continue; }
    const shown = list.slice(0, NOTE_GROUP.maxLines).map(line);
    const more = list.length - shown.length;
    out.push({ type, message: more > 0 ? tx('SR2E.Text.Interface.andMore', { list: shown.join(' · '), count: more }) : shown.join(' · '), count:
 list.reduce((s, x) => s + x.count, 0) });
  }
  return out;
}

/** "msg (×N)": the text a repeated notification is changed to. */
export function repeatedText(message: string, count: number): string {
  return count > 1 ? `${message} (×${count})` : message;
}

// ---------------------------------------------------------------- Window size and position

export interface WinPos { left?: number; top?: number; width?: number; height?: number; t?: number }
export interface WinMemory { ids: Record<string, WinPos>; kinds: Record<string, WinPos> }
export const WINDOW_MEMORY_MAX = 150;

export function emptyWinMemory(): WinMemory { return { ids: {}, kinds: {} }; }

function cleanPos(p: any): WinPos | null {
  if (!p || typeof p !== 'object') return null;
  const out: WinPos = {};
  for (const k of ['left', 'top', 'width', 'height'] as const) {
    const v = Number(p[k]);
    if (Number.isFinite(v)) out[k] = Math.round(v);
  }
  return Object.keys(out).length ? out : null;
}

/** Keep a window's place: by its id (this sheet), and its size by its kind (any sheet of that class). */
export function rememberWindow(mem: WinMemory | null | undefined, id: string, kind: string, pos: any, now = Date.now()): WinMemory {
  const m: WinMemory = { ids: { ...(mem?.ids ?? {}) }, kinds: { ...(mem?.kinds ?? {}) } };
  const p = cleanPos(pos);
  if (!p || !id) return m;
  m.ids[id] = { ...p, t: now };
  if (kind && p.width && p.height) m.kinds[kind] = { width: p.width, height: p.height, t: now };
  const ids = Object.keys(m.ids).sort((a, b) => (m.ids[b]!.t ?? 0) - (m.ids[a]!.t ?? 0));
  for (const k of ids.slice(WINDOW_MEMORY_MAX)) delete m.ids[k];
  return m;
}

/** Where a window opens: its own remembered place, else its kind's size; always kept on screen. */
export function placeWindow(mem: WinMemory | null | undefined, id: string, kind: string, viewport: { width: number; height: number }): WinPos | null {
  const own = cleanPos(mem?.ids?.[id]);
  const size = cleanPos(mem?.kinds?.[kind]);
  const p: WinPos | null = own ?? (size ? { width: size.width, height: size.height } : null);
  if (!p) return null;
  const vw = Math.max(200, Number(viewport.width) || 0), vh = Math.max(200, Number(viewport.height) || 0);
  const out: WinPos = {};
  if (p.width) out.width = Math.max(240, Math.min(p.width, vw));
  if (p.height) out.height = Math.max(160, Math.min(p.height, vh));
  if (p.left != null) out.left = Math.max(0, Math.min(p.left, vw - Math.min(out.width ?? 240, vw)));
  if (p.top != null) out.top = Math.max(0, Math.min(p.top, vh - 60));
  return out;
}

// ---------------------------------------------------------------- Settings: sections and search

/** The section each of the system's own settings sits in (in Foundry's settings window). */
export const SETTING_SECTIONS: Array<{ id: string; label: string; match: RegExp }> = [
  { id: 'look', label: 'Look and layout', match: /^(look|preset|windowOpacity|textScale|reducedMotion|sheetLayout|portrait|groupNotes|rememberWindows|numberSteppers)/i },
  { id: 'rolls', label: 'Rolls, dice and chat', match: /^(rollPrivacy|foldDice|dice|defendPrompt|autoResist|soundCues|soundVolume|sound\.|rememberRolls|showTn)/i },
  { id: 'tokens', label: 'Tokens and the map', match: /^(token|hoverCard|turnPing|wards|regionDetect|movement|floating|vision)/i },
  { id: 'gm', label: 'GM and world', match: /^(houseRules|approvalQueue|moduleSupport|starterKits|sessionChecklist|itemTemplates|migration|skillWeb)/i },
];

export function settingSection(key: string): string {
  const k = String(key ?? '').replace(/^sr2e\./, '');
  return SETTING_SECTIONS.find((s) => s.match.test(k))?.id ?? 'other';
}

/** Whether a setting or house-rule row matches the search box (every word, anywhere in its texts). */
export function settingMatches(texts: Array<string | null | undefined>, query: string): boolean {
  // v0.81.0 (RC-14): the same word match as the sheet search.
  return matchesSearch(texts.map((t) => String(t ?? '')).join(' '), query);
}
