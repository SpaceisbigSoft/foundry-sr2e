import { RULES } from './config.ts';
import { woundLevel } from './core.ts';

/** Tokens (v0.36.0): vision from the character's eyes, bars, wound icons. No Foundry dependency. */

export interface TokenVision {
  visionMode: string;
  range: number;
  detection: { id: string; range: number } | null;
  /** v0.58.0: the see-invisibility detection mode for astral perceivers (present only when `astral` was passed). */
  seeInvisible?: { id: string; range: number } | null;
}

/** v0.58.0: the range given to astral see-invisibility (effectively unlimited). */
export const ASTRAL_DETECTION_RANGE = 10000;

/**
 * The token vision for a character's eyes: thermographic beats low-light beats normal; ultrasound adds a sense.
 * v0.58.0: `astral` (perceiving or projecting) adds `seeInvisible` when GEAR_V58.visibility is enabled.
 */
export function tokenVision(v: { lowLight?: boolean; thermographic?: boolean; ultrasound?: boolean; astral?: boolean } | null | undefined): TokenVision {
  const t = RULES.TOKENS.vision;
  const base = v?.thermographic ? t.thermographic : v?.lowLight ? t.lowLight : t.normal;
  const out: TokenVision = { visionMode: base.mode, range: base.range, detection: v?.ultrasound ? { id: t.ultrasound.detection, range: t.ultrasound.range } : null };
  if (v && 'astral' in v) {
    const vis = RULES.GEAR_V58.visibility;
    out.seeInvisible = v.astral && vis.enabled ? { id: vis.astralDetection, range: ASTRAL_DETECTION_RANGE } : null;
  }
  return out;
}

/** Whether a token's current sight already matches. */
export function visionMatches(sight: { visionMode?: string; range?: number; enabled?: boolean } | null | undefined, want: TokenVision): boolean {
  return Boolean(sight?.enabled) && sight?.visionMode === want.visionMode && Number(sight?.range ?? 0) === want.range;
}

/** Token bars: boxes left on each track. */
export function monitorBars(m: { physical: number; stun: number } | null | undefined): { physical: { value: number; max: number }; stun: { value: number; max: number } } {
  const max = RULES.TOKENS.monitorBoxes;
  const left = (n: number) => Math.max(0, Math.min(max, max - Math.max(0, n || 0)));
  return { physical: { value: left(m?.physical ?? 0), max }, stun: { value: left(m?.stun ?? 0), max } };
}

export const WOUND_STATUS_IDS = { L: 'sr2eWoundL', M: 'sr2eWoundM', S: 'sr2eWoundS', D: 'sr2eWoundD' } as const;

/** The wound icon to show: the worst level on either track (null when unhurt). */
export function woundStatus(m: { physical: number; stun: number } | null | undefined): string | null {
  const order = ['L', 'M', 'S', 'D'] as const;
  const p = woundLevel(Math.min(m?.physical ?? 0, RULES.TOKENS.monitorBoxes));
  const s = woundLevel(Math.min(m?.stun ?? 0, RULES.TOKENS.monitorBoxes));
  const worst = [p, s].filter(Boolean).sort((a, b) => order.indexOf(b as any) - order.indexOf(a as any))[0] as keyof typeof WOUND_STATUS_IDS | undefined;
  return worst ? WOUND_STATUS_IDS[worst] : null;
}

// ---------------------------------------------------------------- v0.59.0 token statuses

/** Foundry's statuses the system gives meaning to (kept when RULES.TOKENS.statusList is 'sr2'). */
export const SR2_CORE_STATUSES = ['dead', 'unconscious', 'bleeding', 'stun', 'prone', 'restrain', 'paralysis', 'sleep', 'blind', 'deaf', 'fear', 'burning', 'invisible', 'poison', 'disease', 'fly'] as const;

/** v0.59.0: SR2 states shown as token statuses (id, label, icon). v0.89.6: `name` is a lang key (Foundry localizes status names). */
export const STATE_STATUSES = [
  { id: 'sr2eFullDefense', name: 'SR2E.Text.Tokens.fullDefense', img: 'icons/svg/shield.svg', state: 'fullDefense' },
  { id: 'sr2eDelaying', name: 'SR2E.Text.Tokens.delaying', img: 'icons/svg/clockwork.svg', state: 'delaying' },
  { id: 'sr2eSurprised', name: 'SR2E.Text.Tokens.surprised', img: 'icons/svg/hazard.svg', state: 'surprised' },
  { id: 'sr2eJackedIn', name: 'SR2E.Text.Tokens.jackedIn', img: 'systems/sr2e/icons/jacked-in.svg', state: 'jackedIn' },
  { id: 'sr2eJumpedIn', name: 'SR2E.Text.Tokens.jumpedIn', img: 'systems/sr2e/icons/jumped-in.svg', state: 'jumpedIn' },
  { id: 'burning', name: 'SR2E.Text.Tokens.onFire', img: 'icons/svg/fire.svg', state: 'onFire' },
  { id: 'fear', name: 'SR2E.Text.Tokens.moraleBroken', img: 'icons/svg/terror.svg', state: 'broken' },
] as const;

/** v0.61.0: statuses for petrification and a totem's berserk rage (shown on the token HUD). */
export const V61_STATUSES = [
  { id: 'sr2ePetrified', name: 'SR2E.Text.Tokens.petrified', img: 'icons/svg/frozen.svg' },
  { id: 'sr2eBerserk', name: 'SR2E.Text.Tokens.berserk', img: 'icons/svg/sword.svg' },
] as const;

export type StateFlags = Partial<Record<(typeof STATE_STATUSES)[number]['state'], boolean>>;

/**
 * Pure: which state statuses to switch on and off. Our own (sr2e…) follow the state both ways; Foundry's
 * own (burning, fear) are switched off only if we switched them on (`ours`), so a GM's own Fear stays.
 */
export function stateStatusChanges(state: StateFlags, has: ReadonlySet<string>, ours: readonly string[]): { on: string[]; off: string[]; ours: string[] } {
  const on: string[] = [], off: string[] = [];
  const mine = new Set(ours);
  for (const s of STATE_STATUSES) {
    const want = Boolean(state[s.state]);
    const own = s.id.startsWith('sr2e');
    if (want && !has.has(s.id)) { on.push(s.id); mine.add(s.id); }
    else if (want && has.has(s.id) && !own && !mine.has(s.id)) { /* already on by someone else: leave it theirs */ }
    else if (!want && has.has(s.id) && (own || mine.has(s.id))) { off.push(s.id); mine.delete(s.id); }
    else if (!want) mine.delete(s.id);
  }
  return { on, off, ours: [...mine] };
}

/** Pure: Foundry's status list cut down to the ones the system uses (plus anything a module added). */
export function prunedStatusEffects<T extends { id: string }>(list: T[], coreIds: readonly string[]): T[] {
  const core = new Set(['dead', 'unconscious', 'sleep', 'stun', 'prone', 'restrain', 'paralysis', 'fly', 'blind', 'deaf', 'silence', 'fear', 'burning', 'frozen', 'shock', 'corrode', 'bleeding', 'disease', 'poison', 'curse', 'regen', 'degen', 'hover', 'burrow', 'upgrade', 'downgrade', 'invisible', 'target', 'eye', 'bless', 'fireShield', 'coldShield', 'magicShield', 'holyShield']);
  const keep = new Set(coreIds);
  return list.filter((s) => !core.has(s.id) || keep.has(s.id));
}

/** v0.59.0: how far a move goes against the walking and running rates (metres in a Combat Turn). */
export function movementBand(metres: number, rates: { walk: number; run: number } | null | undefined): 'walk' | 'run' | 'over' | null {
  if (!rates || !(rates.run > 0)) return null;
  if (metres <= rates.walk + 1e-6) return 'walk';
  if (metres <= rates.run + 1e-6) return 'run';
  return 'over';
}

/** v0.59.0: ruler colours for walking, running and too far (RULES.TOKENS.ruler). */
export function movementColour(band: 'walk' | 'run' | 'over' | null): number | null {
  const r = RULES.TOKENS.ruler;
  if (!r.enabled || !band) return null;
  return band === 'walk' ? r.walk : band === 'run' ? r.run : r.over;
}
