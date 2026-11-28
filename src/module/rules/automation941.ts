/**
 * v0.94.1 (report items 23 and 37): automation, apart from the rules variants. Pure parts (no Foundry), wired in by
 * helpers/automation.ts (the `auto(key, fallback)` getter the call sites read), applications/automation941.ts (the
 * Automation window and the presets) and settings.ts (the `manualTable` setting, the presets row of the house rules).
 *
 * - The master switch `manualTable` (world, off by default) is an EFFECTIVE-value layer: the stored settings and house
 *   rules are never written by it; while it is on, the getter answers the value below instead, and turning it off gives
 *   every stored value back. Rolls, cards and buttons all still work: people press Apply, Resist or Launch themselves.
 * - Presets ("Book rules", "Revamp", "Light automation") are data over the existing switches; nothing changes unless a
 *   GM applies one (after a confirmation listing each change).
 */

/** The Automation window's groups, in order (titles `SR2E.Automation.Group.<id>`). */
export const AUTOMATION_GROUPS = ['dice', 'combat', 'tokens', 'books'] as const;
export type AutomationGroup = typeof AUTOMATION_GROUPS[number];

export interface AutomationSettingDef {
  key: string;
  group: AutomationGroup;
  /** Another part of the system may register it (or not yet): the window shows it only when it is registered. */
  optional?: boolean;
}

/**
 * The settings the Automation window gathers (their names, hints, scopes and choices come from their own registration).
 * `typedDice` and `rerollInPlace` belong to the dice work of the same release and show only once registered.
 */
export const AUTOMATION_SETTINGS: readonly AutomationSettingDef[] = [
  { key: 'rollAtOnce', group: 'dice' },
  { key: 'oneRollWindow', group: 'dice' },
  { key: 'rememberRolls', group: 'dice' },
  { key: 'foldDice', group: 'dice' },
  { key: 'typedDice', group: 'dice', optional: true },
  { key: 'rerollInPlace', group: 'dice', optional: true },
  { key: 'soundCues', group: 'dice' },
  { key: 'defendPrompt', group: 'combat' },
  { key: 'autoApplyGm', group: 'combat' },
  // v0.97.1 (C): players' Matrix maneuver results only.
  { key: 'autoApplyManeuvers97', group: 'combat' },
  { key: 'autoResistNpc', group: 'combat' },
  { key: 'floatingDamage', group: 'combat' },
  { key: 'turnPing', group: 'combat' },
  { key: 'regionDetect', group: 'tokens' },
  { key: 'wardsStopAstral', group: 'tokens' },
  { key: 'hoverCard', group: 'tokens' },
  { key: 'approvalQueue', group: 'books' },
];

/**
 * The shipped defaults of the automation settings a preset writes (as registered in settings.ts; the v0.94.1 test reads
 * the registrations and checks each one). Client settings are the GM's own browser only.
 */
export const AUTOMATION_DEFAULTS: Readonly<Record<string, unknown>> = {
  manualTable: false,
  defendPrompt: 'dialog',
  floatingDamage: true,
  autoApplyGm: false,
  autoApplyManeuvers97: false,
  autoResistNpc: false,
  regionDetect: 'prompt',
  wardsStopAstral: 'block',
};

/** Which settings are the GM's own browser (client scope) rather than the world's. */
export const CLIENT_SETTINGS: ReadonlySet<string> = new Set(['defendPrompt', 'floatingDamage', 'foldDice', 'turnPing', 'hoverCard', 'soundCues', 'oneRollWindow', 'rememberRolls']);

type Lower = (stored: unknown) => unknown;

/**
 * What each setting reads as while Manual table is on. Decisions:
 * - autoApplyGm, autoApplyManeuvers97, autoResistNpc: off (the GM applies and resists from the cards).
 * - floatingDamage: off (no numbers floating over tokens).
 * - defendPrompt: a window ('dialog') becomes a notification ('notify'): no window pops up for anyone; 'off' stays off.
 * - regionDetect: 'auto' (rolls detection by itself) becomes 'prompt' (a GM card with the button); 'off' stays.
 * - wardsStopAstral: 'block' (stops the token) becomes 'warn'; the GM rules on it.
 * Left alone: the dice and window preferences (rollAtOnce, oneRollWindow, rememberRolls, foldDice, typedDice,
 * rerollInPlace, soundCues), turnPing and hoverCard (notices, nothing is done), and approvalQueue (a gate, not automation).
 */
export const MANUAL_SETTINGS: Readonly<Record<string, Lower>> = {
  autoApplyGm: () => false,
  autoApplyManeuvers97: () => false,
  autoResistNpc: () => false,
  floatingDamage: () => false,
  defendPrompt: (v) => (v === 'dialog' ? 'notify' : v),
  regionDetect: (v) => (v === 'auto' ? 'prompt' : v),
  wardsStopAstral: (v) => (v === 'block' ? 'warn' : v),
};

/**
 * The rules-side automation (RULES paths, set in the house rules) and what it reads as while Manual table is on:
 * - KARMA.refresh: 'manual' (the GM refreshes the pools from the GM panel; no refresh at a new session or a fight's end).
 * - GEAR.cyberDamage.mode: 'auto' becomes 'button' (the card offers the cyberware check).
 * - SECURITY_V61.sheafIc.autoLaunch: off (the GM launches a sheaf step's IC by hand).
 * - TN_AUTO.perception.noSight: 'block' (no roll at all) becomes 'hearing' (the roll, at the hearing TN, the roller sees).
 * - TN_AUTO.magic.lineOfSight: 'block' (casting refused) becomes 'warn'.
 * The rest of TN_AUTO stays: those modifiers are listed in the roll window, where the roller sees them and can untick each.
 */
export const MANUAL_RULES: Readonly<Record<string, Lower>> = {
  'KARMA.refresh': () => 'manual',
  'GEAR.cyberDamage.mode': (v) => (v === 'auto' ? 'button' : v),
  'SECURITY_V61.sheafIc.autoLaunch': () => false,
  'TN_AUTO.perception.noSight': (v) => (v === 'block' ? 'hearing' : v),
  'TN_AUTO.magic.lineOfSight': (v) => (v === 'block' ? 'warn' : v),
};

/** Pure: a setting's effective value: the stored one, or what Manual table makes of it. */
export function effectiveSetting(key: string, stored: unknown, manualTable: boolean): unknown {
  if (!manualTable || !Object.hasOwn(MANUAL_SETTINGS, key)) return stored;
  return MANUAL_SETTINGS[key]!(stored);
}

/** Pure: a rule's effective value under the master switch. */
export function effectiveRule(path: string, value: unknown, manualTable: boolean): unknown {
  if (!manualTable || !Object.hasOwn(MANUAL_RULES, path)) return value;
  return MANUAL_RULES[path]!(value);
}

/** Whether Manual table changes what this setting (or rule) reads as, given its stored value. */
export function manualChanges(key: string, stored: unknown): boolean {
  if (Object.hasOwn(MANUAL_SETTINGS, key)) return effectiveSetting(key, stored, true) !== stored;
  if (Object.hasOwn(MANUAL_RULES, key)) return effectiveRule(key, stored, true) !== stored;
  return false;
}

/** Whether the master switch can touch this key at all (the window greys these out while it is on). */
export function manualAffects(key: string): boolean {
  return Object.hasOwn(MANUAL_SETTINGS, key) || Object.hasOwn(MANUAL_RULES, key);
}

// The switch's state for the rules code, which reads RULES and cannot ask Foundry (set from the setting at init and on change).
let manualNow = false;
export function setManualTable(v: unknown): boolean { manualNow = v === true; return manualNow; }
export function manualTableNow(): boolean { return manualNow; }
/** A rule as the code should act on it now: `ruleAuto('KARMA.refresh', RULES.KARMA.refresh)`. */
export function ruleAuto<T>(path: string, value: T): T { return effectiveRule(path, value, manualNow) as T; }

// ---------------------------------------------------------------- Presets (report item 37)

export interface RulesetPreset {
  id: 'book' | 'urr' | 'light';
  /** `SR2E.Automation.Preset.<id>` / `.<id>Hint`. */
  label: string;
  hint: string;
  rulesSource: 'book' | 'urr';
  houseRules: 'clear';
  settings: Readonly<Record<string, unknown>>;
}

/**
 * The presets.
 * - Book rules: the book source, no house-rule overrides, every automation setting back to its default, Manual table off.
 * - Revamp: the SR2E Unified Rules Revamp source, no house-rule overrides (automation left as it is).
 * - Light automation: the book rules, the system only helps: nothing applied or resisted by itself, the defend window
 *   and floating damage on, region detection as a GM card, wards warn instead of stopping tokens; Manual table off.
 */
export const RULESET_PRESETS: readonly RulesetPreset[] = [
  { id: 'book', label: 'SR2E.Automation.Preset.book', hint: 'SR2E.Automation.Preset.bookHint', rulesSource: 'book', houseRules: 'clear', settings: { ...AUTOMATION_DEFAULTS } },
  { id: 'urr', label: 'SR2E.Automation.Preset.urr', hint: 'SR2E.Automation.Preset.urrHint', rulesSource: 'urr', houseRules: 'clear', settings: {} },
  {
    id: 'light', label: 'SR2E.Automation.Preset.light', hint: 'SR2E.Automation.Preset.lightHint', rulesSource: 'book', houseRules: 'clear',
    settings: { manualTable: false, autoApplyGm: false, autoApplyManeuvers97: false, autoResistNpc: false, defendPrompt: 'dialog', floatingDamage: true, regionDetect: 'prompt', wardsStopAstral: 'warn' },
  },
];

export interface PresetState {
  rulesSource: string;
  /** The stored house rules ({ values, advanced }). */
  houseRules: { values?: Record<string, unknown>; advanced?: Record<string, unknown> } | null | undefined;
  /** The current stored values of the settings (keys as in the presets). */
  settings: Readonly<Record<string, unknown>>;
}

export interface PresetChange {
  kind: 'rulesSource' | 'houseRules' | 'setting';
  key: string;
  from: unknown;
  to: unknown;
  /** Settings only: 'client' for the GM's own browser. */
  scope?: 'world' | 'client';
}

/** Pure: how many house-rule overrides are stored. */
export function houseRuleCount(h: PresetState['houseRules']): number {
  const n = (o: unknown) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.keys(o).length : 0);
  return n(h?.values) + n(h?.advanced);
}

/** Pure: what applying a preset would change (empty when the world already matches it). */
export function presetPlan(preset: RulesetPreset, current: PresetState): PresetChange[] {
  const out: PresetChange[] = [];
  if (current.rulesSource !== preset.rulesSource) out.push({ kind: 'rulesSource', key: 'rulesSource', from: current.rulesSource, to: preset.rulesSource });
  const count = houseRuleCount(current.houseRules);
  if (preset.houseRules === 'clear' && count > 0) out.push({ kind: 'houseRules', key: 'houseRules', from: count, to: 0 });
  for (const [key, to] of Object.entries(preset.settings)) {
    const from = current.settings[key];
    if (from !== to) out.push({ kind: 'setting', key, from, to, scope: CLIENT_SETTINGS.has(key) ? 'client' : 'world' });
  }
  return out;
}

/** Pure: the presets the current state already matches (Book rules and Light automation never both). */
export function matchingPresets(current: PresetState): string[] {
  return RULESET_PRESETS.filter((p) => presetPlan(p, current).length === 0).map((p) => p.id);
}

/** Pure: the preset by id (null for anything else, `__proto__` included). */
export function presetById(id: unknown): RulesetPreset | null {
  return RULESET_PRESETS.find((p) => p.id === id) ?? null;
}

/** Every setting key a preset or the window names (for the test: each must be registered). */
export function automationKeys(): string[] {
  return [...new Set(['manualTable', ...AUTOMATION_SETTINGS.map((d) => d.key), ...Object.keys(MANUAL_SETTINGS), ...RULESET_PRESETS.flatMap((p) => Object.keys(p.settings))])];
}
