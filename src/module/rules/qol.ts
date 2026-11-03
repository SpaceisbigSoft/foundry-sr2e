import { t as tx } from '../helpers/i18n.ts';
/**
 * v0.60.0: Foundry quality of life, the pure parts: who sees which kind of test by default, which NPCs
 * resist by themselves, who hears it's their turn, what a token's hover card shows, which sound goes
 * with what, and the data a dragged chat-card item carries.
 */

/** Groups of test kinds a player (or the GM) can give their own default privacy. */
export const PRIVACY_GROUPS: ReadonlyArray<{ id: string; label: string; kinds: readonly string[] }> = [
  { id: 'combat', label: 'SR2E.Privacy.group.combat', kinds: ['attack', 'defend', 'soak', 'drive', 'sensor'] },
  { id: 'magic', label: 'SR2E.Privacy.group.magic', kinds: ['spell', 'conjure', 'banish', 'dispel', 'barrier', 'track', 'enchant', 'quest', 'cleanse', 'divine', 'invoke', 'design', 'learn', 'ward', 'bindName', 'centering', 'assense'] },
  { id: 'matrix', label: 'SR2E.Privacy.group.matrix', kinds: ['system', 'code', 'install', 'jackOut', 'mperceive', 'maneuver', 'mutility'] },
  { id: 'health', label: 'SR2E.Privacy.group.health', kinds: ['heal', 'medic', 'surgery', 'psyche', 'addiction', 'disease', 'rejection'] },
  { id: 'gear', label: 'SR2E.Privacy.group.gear', kinds: ['repair', 'cyberRepair', 'bypass'] },
  { id: 'perception', label: 'SR2E.Privacy.group.perception', kinds: ['notice'] },
  { id: 'other', label: 'SR2E.Privacy.group.other', kinds: ['plain'] },
];

/** The modes a group can take: Foundry's chat mode as the user set it, or one of its own. */
export const PRIVACY_MODES: ReadonlyArray<{ id: string; label: string }> = [
  { id: '', label: 'SR2E.Privacy.mode.chat' },
  { id: 'public', label: 'SR2E.Privacy.mode.public' },
  { id: 'gm', label: 'SR2E.Privacy.mode.gm' },
  { id: 'blind', label: 'SR2E.Privacy.mode.blind' },
  { id: 'self', label: 'SR2E.Privacy.mode.self' },
];

/** Pure: the privacy group of a test kind ('other' when it isn't listed). */
export function privacyGroup(kind: string): string {
  return PRIVACY_GROUPS.find((g) => g.kinds.includes(kind))?.id ?? 'other';
}

/** Pure: the mode a card of this kind is posted in: the mode set for its group if the user set one, else Foundry's. */
export function privacyFor(kind: string | null | undefined, prefs: Record<string, string> | null | undefined, coreMode: string): string {
  if (!kind) return coreMode;
  const m = String(prefs?.[privacyGroup(kind)] ?? '');
  return PRIVACY_MODES.some((x) => x.id === m && m) ? m : coreMode;
}

/** Pure: the v12 roll-mode name for a v13+ message mode (for Foundry versions with only applyRollMode). */
export function legacyRollMode(mode: string): string {
  return ({ public: 'publicroll', gm: 'gmroll', blind: 'blindroll', self: 'selfroll', ic: 'publicroll' } as Record<string, string>)[mode] ?? mode;
}

/**
 * Pure: whether the GM's client resists this damage by itself (setting `autoResistNpc`): only for a
 * target no active player owns, not yet resisted, on a card that isn't a re-scored copy.
 */
export function autoResists(o: { enabled: boolean; playerOwned: boolean; resisted: boolean; retarget: boolean; combined: boolean }): boolean {
  return o.enabled && !o.playerOwned && !o.resisted && !o.retarget && !o.combined;
}

/** Pure: whether a combat update starts a new turn for someone (turn, round or pass changed). */
export function turnChanged(change: Record<string, any> | null | undefined, systemId: string): boolean {
  if (!change) return false;
  return change.turn !== undefined || change.round !== undefined || change.flags?.[systemId]?.pass !== undefined;
}

/** Pure: the users told it's their turn: active non-GM owners of the acting actor (the GM sees the ping). */
export function turnRecipients(users: ReadonlyArray<{ id: string; active: boolean; isGM: boolean; owns: boolean }>): string[] {
  return users.filter((u) => u.active && !u.isGM && u.owns).map((u) => u.id);
}

/** What a token's hover card shows (owners and the GM): pools, initiative, wounds, state. */
export interface HoverInfo {
  name: string;
  derived: Record<string, any>;
  karmaPool?: number;
  initiative?: number | null;
  pass?: number | null;
  fullDefense?: boolean;
  delaying?: boolean;
  monitor?: { physical?: number; stun?: number; physicalMax?: number; stunMax?: number };
  condition?: { value: number; max: number } | null;
  matrix?: { value: number; max: number } | null;
}

/** Pure: the hover card's lines (empty: nothing worth showing). */
export function hoverLines(h: HoverInfo): string[] {
  const d = h.derived ?? {};
  const out: string[] = [];
  const pools: string[] = [];
  const pool = (label: string, left: unknown, max: unknown) => { if (Number(max) > 0) pools.push(`${label} ${Number(left ?? max)}/${Number(max)}`); };
  pool(tx('SR2E.Text.Qol.combat'), d.combatPoolLeft, d.combatPool);
  pool(tx('SR2E.Text.Qol.spell'), d.spellPoolLeft, d.spellPool);
  pool(tx('SR2E.Text.Qol.hacking'), d.hackingPoolLeft, d.hackingPool);
  pool(tx('SR2E.Text.Qol.control'), d.controlPoolLeft, d.controlPool);
  pool(tx('SR2E.Text.Qol.astral'), d.astralPoolLeft, d.astralPool);
  pool(tx('SR2E.Text.Qol.karma'), d.karmaPoolLeft, h.karmaPool);
  if (pools.length) out.push(pools.join(' · '));
  if (h.monitor && (h.monitor.physicalMax || h.monitor.stunMax)) out.push(tx('SR2E.Text.Qol.physicalStun', { physical: h.monitor.physical ?? 0, physicalMax: h.monitor.physicalMax ?? 10, stun: h.monitor.stun ?? 0, stunMax: h.monitor.stunMax ?? 10 }));
  if (h.condition) out.push(tx('SR2E.Text.Qol.condition', { value: h.condition.value, max: h.condition.max }));
  if (h.matrix && h.matrix.value > 0) out.push(tx('SR2E.Text.Qol.matrix', { value: h.matrix.value, max: h.matrix.max }));
  const tn = Number(d.woundModifier ?? 0);
  const state: string[] = [];
  if (tn) state.push(tx('SR2E.Text.Qol.woundsTn', { tn }));
  if (h.initiative !== null && h.initiative !== undefined) state.push(h.pass !== null && h.pass !== undefined ? tx('SR2E.Text.Qol.initiativePass', { initiative: h.initiative, pass: h.pass + 1 }) : tx('SR2E.Text.Qol.initiative', { initiative: h.initiative }));
  if (h.fullDefense) state.push(tx('SR2E.Text.Qol.fullDefense'));
  if (h.delaying) state.push(tx('SR2E.Text.Qol.delaying'));
  if (state.length) out.push(state.join(' · '));
  return out;
}

/** The events a sound can mark (setting per event; the system only plays Foundry's own sounds by default). v0.89.4: `label` is the setting's name key. */
export const SOUND_EVENTS: ReadonlyArray<{ id: string; label: string; src: string }> = [
  { id: 'turn', label: 'SR2E.Settings.sound.turn.Name', src: 'sounds/notify.wav' },
  { id: 'attacked', label: 'SR2E.Settings.sound.attacked.Name', src: 'sounds/lock.wav' },
  { id: 'disaster', label: 'SR2E.Settings.sound.disaster.Name', src: 'sounds/drums.wav' },
  { id: 'alarm', label: 'SR2E.Settings.sound.alarm.Name', src: 'sounds/notify.wav' },
];

/** Pure: the drag data for an item named on a chat card (Foundry's own shape: type and UUID). */
export function itemDragData(actorUuid: string, itemId: string): { type: 'Item'; uuid: string } | null {
  if (!actorUuid || !itemId) return null;
  return { type: 'Item', uuid: `${actorUuid}.Item.${itemId}` };
}

/** Pure: a monitor's bar value for a token (Foundry's {value, max}); null when there's no track. */
export function trackBar(value: unknown, max: unknown): { value: number; max: number } | null {
  const m = Math.floor(Number(max));
  if (!(m > 0)) return null;
  const v = Math.max(0, Math.min(m, Math.floor(Number(value) || 0)));
  return { value: m - v, max: m };
}
