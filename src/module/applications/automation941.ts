/**
 * v0.94.1 (report items 23 and 37): the Automation window and the ruleset presets.
 *
 * - The Automation window (settings menu `automationMenu`) gathers the automation settings by group, each with its
 *   value and a one-line hint: world settings editable by GMs only, client and user settings by everyone. The master
 *   switch Manual table sits on top; while it is on, the settings it overrides are greyed with what they read as.
 *   The rules-side automation (house rules) is listed read-only, with where to change it.
 * - `applyRulesetPreset(id)`: a GM applies a preset from the house-rules window, after a confirmation listing each change.
 * Pure parts: rules/automation941.ts.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { escHtml } from '../rules/html.ts';
import { RULES } from '../rules/config.ts';
import { RULES_SOURCES } from '../rules/config80.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { foldDiceChoice, FOLD_DICE_KEY } from '../rules/fixes942.ts';
import {
  AUTOMATION_GROUPS, AUTOMATION_SETTINGS, MANUAL_RULES, RULESET_PRESETS, effectiveRule, effectiveSetting, manualAffects,
  presetById, presetPlan, matchingPresets, type PresetChange, type PresetState,
} from '../rules/automation941.ts';

const esc = escHtml;

/** A setting's registration (null when nothing registered it). */
function reg(key: string): any {
  try { return (game as any).settings?.settings?.get?.(`${SYSTEM_ID}.${key}`) ?? null; } catch { return null; }
}

function stored(key: string, fallback: unknown = null): unknown {
  let v: unknown;
  try { v = (game as any).settings.get(SYSTEM_ID, key) ?? fallback; } catch { return fallback; }
  // v0.94.2 review (5): Fold dice was a Boolean; an old stored value reads as one of its choices.
  return key === FOLD_DICE_KEY ? foldDiceChoice(v) : v;
}

function isGm(): boolean { return Boolean((game as any).user?.isGM); }

/** A value as the reader sees it: a choice's label, on or off, or the value itself. */
export function valueLabel(key: string, v: unknown): string {
  const choices = reg(key)?.choices;
  if (choices && typeof choices === 'object' && Object.hasOwn(choices, String(v))) return tKey(String(choices[String(v)]));
  if (typeof v === 'boolean') return v ? tx('SR2E.Automation.on') : tx('SR2E.Automation.off');
  return String(v ?? '');
}

const optionHtml = (v: string, label: string, selected: boolean): string => `<option value="${esc(v)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
const hintOf = (key: string): string => tKey(`SR2E.Automation.Hint.${key}`);
const scopeOf = (scope: string): string => tKey(`SR2E.Automation.Scope.${scope === 'world' || scope === 'user' ? scope : 'client'}`);
const groupOf = (g: string): string => tKey(`SR2E.Automation.Group.${g}`);
const ruleOf = (path: string): string => tKey(`SR2E.Automation.Rule.${path.replace(/\./g, '__')}`);

/** The input for one registered setting. */
function inputFor(key: string, cfg: any, value: unknown, disabled: boolean): string {
  const dis = disabled ? ' disabled' : '';
  if (cfg.type === Boolean) return `<input type="checkbox" name="${esc(key)}"${value ? ' checked' : ''}${dis}>`;
  if (cfg.choices && typeof cfg.choices === 'object') {
    const options = Object.entries(cfg.choices).map(([v, label]) => optionHtml(v, tKey(String(label)), String(value) === v)).join('');
    return `<select name="${esc(key)}"${dis}>${options}</select>`;
  }
  if (cfg.type === Number) return `<input type="number" name="${esc(key)}" value="${esc(value)}"${dis}>`;
  return `<input type="text" name="${esc(key)}" value="${esc(value)}"${dis}>`;
}

/** The Automation window (registered in settings.ts as the `automationMenu` menu; open to everyone). */
export class AutomationConfig extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'sr2e-automation',
    tag: 'form',
    window: { title: 'SR2E.Automation.title', icon: 'fa-solid fa-robot', resizable: true },
    position: { width: 560, height: 680 },
    form: { handler: AutomationConfig.#onSubmit, closeOnSubmit: true },
  };

  async _renderHTML(): Promise<string> {
    const gm = isGm();
    const manual = stored('manualTable', false) === true;
    const row = (key: string): string => {
      const cfg = reg(key);
      if (!cfg) return '';
      const scope = String(cfg.scope ?? 'client');
      const locked = scope === 'world' && !gm;
      const value = stored(key, cfg.default);
      const affected = manualAffects(key);
      const reads = affected ? valueLabel(key, effectiveSetting(key, value, true)) : '';
      const offNote = affected ? `<p class="hint sr2e-auto-offnote">${tx('SR2E.Automation.offWhileManual', { value: esc(reads) })}</p>` : '';
      const cls = affected ? ' sr2e-auto-affected' : '';
      const long = tKey(String(cfg.hint ?? ''));
      const name = tKey(String(cfg.name ?? key));
      return `<div class="form-group${cls}" data-sr2e-auto="${esc(key)}"><label title="${esc(long)}">${esc(name)} <span class="sr2e-auto-scope">${esc(scopeOf(scope))}</span></label>`
        + `<div class="form-fields">${inputFor(key, cfg, value, locked)}</div><p class="hint">${esc(hintOf(key))}</p>${offNote}</div>`;
    };
    const groups = AUTOMATION_GROUPS.map((g) => {
      const rows = AUTOMATION_SETTINGS.filter((d) => d.group === g).map((d) => row(d.key)).join('');
      return rows ? `<fieldset><legend>${esc(groupOf(g))}</legend>${rows}</fieldset>` : '';
    }).join('');
    const ruleRows = Object.keys(MANUAL_RULES).map((path) => {
      const v = path.split('.').reduce((o: any, k) => (o == null ? undefined : o[k]), RULES as any);
      const eff = effectiveRule(path, v, true);
      const offNote = eff !== v ? `<p class="hint sr2e-auto-offnote">${tx('SR2E.Automation.offWhileManual', { value: esc(String(eff)) })}</p>` : '';
      return `<div class="form-group sr2e-auto-affected sr2e-auto-rule" data-sr2e-auto="${esc(path)}"><label>${esc(ruleOf(path))}</label><div class="form-fields"><code>${esc(String(v))}</code></div>${offNote}</div>`;
    }).join('');
    return `<div class="sr2e-automation standard-form scrollable${manual ? ' sr2e-auto-manual' : ''}">
      <p class="hint">${tx('SR2E.Automation.intro')}</p>
      <div class="form-group sr2e-auto-master"><label>${tx('SR2E.Settings.manualTable.Name')}</label><div class="form-fields"><input type="checkbox" name="manualTable"${manual ? ' checked' : ''}${gm ? '' : ' disabled'}></div><p class="hint">${tx('SR2E.Settings.manualTable.Hint')}</p></div>
      ${groups}
      <fieldset><legend>${tx('SR2E.Automation.Group.rules')}</legend><p class="hint">${tx('SR2E.Automation.rulesHint')}</p>${ruleRows}</fieldset>
      <footer class="form-footer"><button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${tx('SR2E.App.Settings.save')}</button></footer>
    </div>`;
  }

  _replaceHTML(result: string, content: HTMLElement): void {
    content.innerHTML = result;
    // The greying follows the master switch as it is ticked, before Save.
    const root = content.querySelector('.sr2e-automation') as HTMLElement | null;
    const master = content.querySelector('input[name="manualTable"]') as HTMLInputElement | null;
    master?.addEventListener('change', () => root?.classList.toggle('sr2e-auto-manual', master.checked));
  }

  static async #onSubmit(_event: Event, form: HTMLFormElement): Promise<void> {
    const el: any = form.elements;
    const gm = isGm();
    const writes: Array<[string, unknown]> = [];
    if (gm && el.manualTable) {
      const v = Boolean(el.manualTable.checked);
      if (v !== (stored('manualTable', false) === true)) writes.push(['manualTable', v]);
    }
    for (const d of AUTOMATION_SETTINGS) {
      const cfg = reg(d.key);
      const input = el[d.key];
      if (!cfg || !input || input.disabled) continue;
      if (cfg.scope === 'world' && !gm) continue;
      const v = cfg.type === Boolean ? Boolean(input.checked) : cfg.type === Number ? Number(input.value) : String(input.value ?? '');
      if (cfg.type === Number && !Number.isFinite(v)) continue;
      if (cfg.choices && typeof cfg.choices === 'object' && !Object.hasOwn(cfg.choices, String(v))) continue;
      if (v !== stored(d.key, cfg.default)) writes.push([d.key, v]);
    }
    for (const [k, v] of writes) await (game as any).settings.set(SYSTEM_ID, k, v);
    if (writes.length) ui.notifications?.info?.(tx('SR2E.Automation.saved', { count: writes.length }));
  }
}

// ---------------------------------------------------------------- Presets (house-rules window)

/** The world's state as the presets compare it (client settings: this browser's). */
export function currentPresetState(): PresetState {
  const keys = [...new Set(RULESET_PRESETS.flatMap((p) => Object.keys(p.settings)))];
  const settings: Record<string, unknown> = {};
  for (const k of keys) settings[k] = stored(k, reg(k)?.default ?? null);
  return { rulesSource: String(stored('rulesSource', 'book')), houseRules: stored('houseRules', {}) as PresetState['houseRules'], settings };
}

/** One change as a line of the confirmation (escaped). */
function changeLine(c: PresetChange): string {
  if (c.kind === 'rulesSource') {
    const src = (v: unknown) => (Object.hasOwn(RULES_SOURCES, String(v)) ? tKey(RULES_SOURCES[String(v) as keyof typeof RULES_SOURCES]) : String(v));
    return `<li>${tx('SR2E.Automation.Change.rulesSource', { from: esc(src(c.from)), to: esc(src(c.to)) })}</li>`;
  }
  if (c.kind === 'houseRules') return `<li>${tx('SR2E.Automation.Change.houseRules', { count: Number(c.from) || 0 })}</li>`;
  const name = c.key === 'manualTable' ? tx('SR2E.Settings.manualTable.Name') : tKey(String(reg(c.key)?.name ?? c.key));
  const client = c.scope === 'client' ? ` <em>${tx('SR2E.Automation.Change.thisBrowser')}</em>` : '';
  return `<li>${tx('SR2E.Automation.Change.setting', { name: esc(name), from: esc(valueLabel(c.key, c.from)), to: esc(valueLabel(c.key, c.to)) })}${client}</li>`;
}

/** The presets row of the house-rules window (buttons; the one matching the world is marked). */
export function presetsRowHtml(): string {
  const now = new Set(matchingPresets(currentPresetState()));
  const buttons = RULESET_PRESETS.map((p) => {
    const cur = now.has(p.id);
    return `<button type="button" class="sr2e-preset${cur ? ' sr2e-preset-current' : ''}" data-action="applyPreset" data-sr2e-preset="${esc(p.id)}" aria-pressed="${cur ? 'true' : 'false'}" title="${esc(tKey(p.hint))}">${cur ? '<i class="fa-solid fa-check"></i> ' : ''}${esc(tKey(p.label))}</button>`;
  }).join('');
  const which = RULESET_PRESETS.find((p) => now.has(p.id));
  return `<div class="form-group sr2e-hr-presets"><label>${tx('SR2E.Automation.presets')}</label><div class="form-fields">${buttons}</div><p class="hint">${which ? tx('SR2E.Automation.presetMatches', { name: esc(tKey(which.label)) }) : tx('SR2E.Automation.presetNone')}</p></div>`;
}

/** A GM applies a preset: the changes listed, confirmed, then written through the settings (their own onChange applies them). */
export async function applyRulesetPreset(id: unknown): Promise<boolean> {
  if (!isGm()) { ui.notifications?.warn?.(tx('SR2E.Automation.gmOnly')); return false; }
  const preset = presetById(id);
  if (!preset) return false;
  const plan = presetPlan(preset, currentPresetState());
  if (!plan.length) { ui.notifications?.info?.(tx('SR2E.Automation.presetAlready', { name: esc(tKey(preset.label)) })); return false; }
  const ok = await (foundry as any).applications.api.DialogV2.confirm({
    window: { title: tx('SR2E.Automation.presetConfirmTitle', { name: tKey(preset.label) }) },
    content: `<p>${tx('SR2E.Automation.presetConfirm', { name: esc(tKey(preset.label)) })}</p><ul>${plan.map(changeLine).join('')}</ul>`,
  });
  if (!ok) return false;
  for (const c of plan) {
    if (c.kind === 'rulesSource') await (game as any).settings.set(SYSTEM_ID, 'rulesSource', c.to);
    else if (c.kind === 'houseRules') await (game as any).settings.set(SYSTEM_ID, 'houseRules', { values: {}, advanced: {} });
    else if (reg(c.key)) await (game as any).settings.set(SYSTEM_ID, c.key, c.to);
  }
  ui.notifications?.info?.(tx('SR2E.Automation.presetApplied', { name: esc(tKey(preset.label)) }));
  return true;
}
