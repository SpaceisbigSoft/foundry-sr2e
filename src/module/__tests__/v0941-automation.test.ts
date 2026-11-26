/**
 * v0.94.1 (report items 23 and 37): the Automation window's settings, the master switch Manual table (an effective-value
 * layer: stored values untouched, every effective value equal to the stored one while it is off) and the ruleset
 * presets (pure data over real settings and real RULES paths; nothing changes unless a GM applies one).
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  AUTOMATION_GROUPS, AUTOMATION_SETTINGS, AUTOMATION_DEFAULTS, MANUAL_SETTINGS, MANUAL_RULES, RULESET_PRESETS, CLIENT_SETTINGS,
  effectiveSetting, effectiveRule, manualChanges, manualAffects, setManualTable, manualTableNow, ruleAuto,
  presetPlan, matchingPresets, presetById, houseRuleCount, automationKeys, type PresetState,
} from '../rules/automation941.ts';
import { RULES } from '../rules/config.ts';
import { RULES_SOURCES } from '../rules/config80.ts';
import { perceptionSightModifiers } from '../rules/situation.ts';
import { sessionRefreshDue } from '../rules/flow.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const mod = (...p: string[]) => read('src', 'module', ...p);
const DRAFT = join(ROOT, 'i18n-drafts', 'automation-presets.json');
const draft = (): Record<string, string> => (existsSync(DRAFT) ? JSON.parse(readFileSync(DRAFT, 'utf8')) : {});
const getPath = (o: any, p: string): unknown => p.split('.').reduce((a: any, k) => (a == null ? undefined : a[k]), o);

/** Every .ts file under src/module (not the tests), with its text; paths with forward slashes (Windows too). */
function sources(): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  const walk = (dir: string): void => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); continue; }
      if (f.endsWith('.ts')) out.push({ file: relative(ROOT, p).split(sep).join('/'), text: readFileSync(p, 'utf8') });
    }
  };
  walk(join(ROOT, 'src', 'module'));
  return out;
}

/** The `default:` of a registration in the sources, as JSON-ish text (null when not registered). */
function registeredDefault(all: Array<{ text: string }>, key: string): string | null {
  for (const { text } of all) {
    const re = new RegExp(`register\\([^,]+,\\s*['"]${key}['"],\\s*\\{([\\s\\S]*?)\\}\\);`);
    const m = re.exec(text);
    if (m) return /default:\s*([^,\n}]+)/.exec(m[1]!)?.[1]?.trim() ?? null;
  }
  return null;
}

before(() => {
  const en = (globalThis as any).__SR2E_EN__ ?? ((globalThis as any).__SR2E_EN__ = {});
  for (const [k, v] of Object.entries(draft())) if (!(k in en)) en[k] = v;
});
after(() => { setManualTable(false); });

const SAMPLES: unknown[] = [true, false, 'dialog', 'notify', 'off', 'auto', 'prompt', 'block', 'warn', 'hearing', 'ignore', 'session', 'combat', 'manual', 'button', 0, 3, '', null, undefined];

describe('v0.94.1 Manual table: an effective-value layer', () => {
  test('off: every effective value is the stored one (settings and rules, any value)', () => {
    for (const key of [...automationKeys(), ...Object.keys(MANUAL_SETTINGS), 'somethingElse']) {
      for (const v of SAMPLES) assert.equal(effectiveSetting(key, v, false), v, `${key} = ${String(v)}`);
    }
    for (const path of [...Object.keys(MANUAL_RULES), 'COMBAT.prone.targetMelee']) {
      for (const v of SAMPLES) assert.equal(effectiveRule(path, v, false), v, `${path} = ${String(v)}`);
    }
  });

  test('on: nothing applied or resisted by itself, no windows for others, no floating damage', () => {
    assert.equal(effectiveSetting('autoApplyGm', true, true), false);
    assert.equal(effectiveSetting('autoResistNpc', true, true), false);
    assert.equal(effectiveSetting('floatingDamage', true, true), false);
    assert.equal(effectiveSetting('defendPrompt', 'dialog', true), 'notify');
    assert.equal(effectiveSetting('defendPrompt', 'off', true), 'off');
    assert.equal(effectiveSetting('regionDetect', 'auto', true), 'prompt');
    assert.equal(effectiveSetting('regionDetect', 'off', true), 'off');
    assert.equal(effectiveSetting('wardsStopAstral', 'block', true), 'warn');
    // Preferences and notices stay as stored.
    for (const k of ['rollAtOnce', 'oneRollWindow', 'rememberRolls', 'foldDice', 'turnPing', 'hoverCard', 'approvalQueue', 'soundCues', 'typedDice', 'rerollInPlace']) {
      assert.equal(effectiveSetting(k, true, true), true, k);
      assert.equal(manualAffects(k), false, k);
    }
    assert.equal(manualChanges('defendPrompt', 'notify'), false);
    assert.equal(manualChanges('autoApplyGm', true), true);
  });

  test('on: the rules-side automation (refusals become warnings; visible TN modifiers stay)', () => {
    assert.equal(effectiveRule('KARMA.refresh', 'combat', true), 'manual');
    assert.equal(effectiveRule('GEAR.cyberDamage.mode', 'auto', true), 'button');
    assert.equal(effectiveRule('GEAR.cyberDamage.mode', 'off', true), 'off');
    assert.equal(effectiveRule('SECURITY_V61.sheafIc.autoLaunch', true, true), false);
    assert.equal(effectiveRule('TN_AUTO.perception.noSight', 'block', true), 'hearing');
    assert.equal(effectiveRule('TN_AUTO.magic.lineOfSight', 'block', true), 'warn');
    assert.equal(effectiveRule('TN_AUTO.perception.light', true, true), true, 'a modifier the roller sees stays');
  });

  test('the rules code reads the switch (ruleAuto), and the stored RULES are never written', () => {
    const p = RULES.TN_AUTO.perception as any;
    const before = p.noSight;
    const refresh = (RULES.KARMA as any).refresh;
    try {
      p.noSight = 'block';
      (RULES.KARMA as any).refresh = 'session';
      setManualTable(false);
      assert.equal(perceptionSightModifiers({ blind: true }).blocked, true);
      assert.equal(sessionRefreshDue('2026-11-25', '2026-11-26'), true);
      setManualTable(true);
      assert.equal(manualTableNow(), true);
      assert.equal(perceptionSightModifiers({ blind: true }).blocked, false, 'heard instead of not noticed');
      assert.equal(sessionRefreshDue('2026-11-25', '2026-11-26'), false, 'the GM refreshes by hand');
      assert.equal(ruleAuto('TN_AUTO.magic.lineOfSight', 'block'), 'warn');
      assert.equal(p.noSight, 'block', 'stored value untouched');
      setManualTable(false);
      assert.equal(perceptionSightModifiers({ blind: true }).blocked, true, 'turning it off gives everything back');
      assert.equal(setManualTable('yes'), false, 'only true turns it on');
    } finally { p.noSight = before; (RULES.KARMA as any).refresh = refresh; setManualTable(false); }
  });

  test('every rules path is a real RULES path, its manual value one of its own choices', () => {
    const settings = mod('settings.ts');
    for (const path of Object.keys(MANUAL_RULES)) {
      const v = getPath(RULES, path);
      assert.notEqual(v, undefined, path);
      const def = new RegExp(`path: "${path.replace(/\./g, '\\.')}", type: "select", choices: \\[([^\\]]*)\\]`).exec(settings);
      if (def) for (const s of SAMPLES) {
        const e = effectiveRule(path, s, true);
        if (e !== s) assert.ok(def[1]!.includes(`"${String(e)}"`), `${path} → ${String(e)}`);
      }
    }
  });
});

describe('v0.94.1 the Automation window\'s settings', () => {
  const all = sources();

  test('every key named is registered (bar the dice work\'s optional ones); groups are known', () => {
    const optional = new Set(AUTOMATION_SETTINGS.filter((d) => d.optional).map((d) => d.key));
    assert.deepEqual([...optional].sort(), ['rerollInPlace', 'typedDice']);
    for (const key of automationKeys()) {
      if (optional.has(key)) continue;
      assert.ok(registeredDefault(all, key) !== null, `${key} is registered with a default`);
    }
    for (const d of AUTOMATION_SETTINGS) assert.ok((AUTOMATION_GROUPS as readonly string[]).includes(d.group), d.key);
    for (const g of AUTOMATION_GROUPS) assert.ok(AUTOMATION_SETTINGS.some((d) => d.group === g), g);
  });

  test('the defaults a preset restores are the registered defaults; client keys are client settings', () => {
    for (const [key, v] of Object.entries(AUTOMATION_DEFAULTS)) {
      const d = registeredDefault(all, key);
      assert.equal(d?.replace(/^["']|["']$/g, ''), String(v), key);
    }
    const settings = mod('settings.ts');
    for (const key of CLIENT_SETTINGS) {
      const m = new RegExp(`register\\(SYSTEM\\.id, "${key}", \\{([\\s\\S]*?)\\}\\);`).exec(settings) ?? new RegExp(`register\\(ID, '${key}', \\{([\\s\\S]*?)\\}\\);`).exec(mod('applications', 'interface.ts'));
      assert.ok(m && /scope: ['"]client['"]/.test(m[1]!), `${key} is a client setting`);
    }
  });

  test('manualTable: a world setting, off by default; the menu is open to everyone; in the GM settings section', () => {
    const settings = mod('settings.ts');
    assert.match(settings, /register\(SYSTEM\.id, "manualTable", \{[\s\S]*?scope: "world", config: false, type: Boolean, default: false,/);
    assert.match(settings, /registerMenu\(SYSTEM\.id, "automationMenu", \{[\s\S]*?type: AutomationConfig, restricted: false,/);
    assert.match(mod('rules', 'interface.ts'), /manualTable\|automation\|/);
  });

  test('the call sites read the getter: no direct read of an overridden setting is left (bar hotkeys.ts, the lead\'s)', () => {
    for (const { file, text } of all) {
      if (file.endsWith('applications/hotkeys.ts') || file.endsWith('helpers/automation.ts')) continue;
      for (const key of Object.keys(MANUAL_SETTINGS)) {
        assert.ok(!new RegExp(`settings\\.get\\([^)]*['"]${key}['"]`).test(text), `${file} reads ${key} directly`);
        assert.ok(!new RegExp(`\\bsetting\\(['"]${key}['"]`).test(text), `${file} reads ${key} directly`);
      }
    }
    assert.match(mod('applications', 'chat.ts'), /auto\('autoApplyGm', false\)/);
    assert.match(mod('applications', 'chat.ts'), /auto\('autoResistNpc', false\)/);
    assert.match(mod('applications', 'chat.ts'), /auto\('defendPrompt', 'dialog'\)/);
    assert.match(mod('applications', 'regions.ts'), /auto\('regionDetect', 'prompt'\)/);
    assert.match(mod('applications', 'regions.ts'), /auto\('wardsStopAstral', 'block'\)/);
  });

  test('the rules sites act on ruleAuto, never the bare value', () => {
    const idx = mod('documents', 'index.ts');
    assert.ok(!/RULES\.TN_AUTO\.magic\.lineOfSight === ['"]block['"]/.test(idx + mod('applications', 'sheets.ts')));
    assert.ok(!/RULES\.GEAR\.cyberDamage\.mode === 'auto'/.test(idx));
    assert.ok(!/RULES\.KARMA\.refresh [!=]==/.test(mod('applications', 'chat.ts') + mod('rules', 'flow.ts')));
    assert.match(mod('rules', 'lockdown.ts'), /ruleAuto\('SECURITY_V61\.sheafIc\.autoLaunch'/);
    assert.match(mod('rules', 'situation.ts'), /ruleAuto\('TN_AUTO\.perception\.noSight'/);
  });

  test('the new files: strings from the language file, values escaped, no querySelector<T>', () => {
    const files = [mod('applications', 'automation941.ts'), mod('rules', 'automation941.ts'), mod('helpers', 'automation.ts')];
    const keys = draft();
    for (const text of files) {
      assert.ok(!/querySelector(All)?</.test(text));
      for (const m of text.matchAll(/\btx\('(SR2E\.[\w.]+)'/g)) assert.ok(m[1]! in keys || m[1]!.startsWith('SR2E.Settings.manualTable') || m[1] === 'SR2E.App.Settings.save', String(m[1]));
    }
    const dyn = [
      ...AUTOMATION_SETTINGS.map((d) => `SR2E.Automation.Hint.${d.key}`),
      ...AUTOMATION_GROUPS.map((g) => `SR2E.Automation.Group.${g}`), 'SR2E.Automation.Group.rules',
      ...Object.keys(MANUAL_RULES).map((p) => `SR2E.Automation.Rule.${p.replace(/\./g, '__')}`),
      ...['world', 'client', 'user'].map((s) => `SR2E.Automation.Scope.${s}`),
      ...RULESET_PRESETS.flatMap((p) => [p.label, p.hint]),
      'SR2E.Settings.manualTable.Name', 'SR2E.Settings.manualTable.Hint',
      'SR2E.Settings.automationMenu.Name', 'SR2E.Settings.automationMenu.Label', 'SR2E.Settings.automationMenu.Hint',
    ];
    for (const k of dyn) assert.ok(k in keys, k);
    for (const [k, v] of Object.entries(keys)) assert.ok(k.startsWith('SR2E.') && typeof v === 'string' && v.trim(), k);
  });

  test('the stylesheet ends with the window\'s block', () => {
    const css = read('public', 'style', 'sr2e.css');
    assert.ok(css.includes('.sr2e-automation.sr2e-auto-manual .sr2e-auto-affected'));
    assert.ok(css.includes('.sr2e-hr-presets'));
  });
});

describe('v0.94.1 ruleset presets', () => {
  const bookState = (): PresetState => ({ rulesSource: 'book', houseRules: { values: {}, advanced: {} }, settings: { ...AUTOMATION_DEFAULTS } });

  test('pure data over real settings and real rules sources; every preset clears the house rules', () => {
    assert.deepEqual(RULESET_PRESETS.map((p) => p.id), ['book', 'urr', 'light']);
    const keys = new Set(automationKeys());
    for (const p of RULESET_PRESETS) {
      assert.ok(Object.hasOwn(RULES_SOURCES, p.rulesSource), p.id);
      assert.equal(p.houseRules, 'clear');
      for (const k of Object.keys(p.settings)) assert.ok(keys.has(k) && (k === 'manualTable' || k in AUTOMATION_DEFAULTS), `${p.id}: ${k}`);
    }
    const book = presetById('book')!;
    assert.deepEqual(book.settings, AUTOMATION_DEFAULTS, 'Book rules: every automation setting at its default');
    assert.equal(book.settings['manualTable'], false);
    assert.equal(presetById('urr')!.rulesSource, 'urr');
    const light = presetById('light')!;
    assert.equal(light.rulesSource, 'book');
    assert.equal(light.settings['autoResistNpc'], false);
    assert.equal(light.settings['autoApplyGm'], false);
    assert.equal(light.settings['defendPrompt'], 'dialog');
    assert.equal(light.settings['floatingDamage'], true);
    assert.equal(presetById('__proto__'), null);
    assert.equal(presetById('toString'), null);
  });

  test('presetPlan lists what changes; nothing when the world matches', () => {
    assert.deepEqual(presetPlan(presetById('book')!, bookState()), []);
    assert.deepEqual(matchingPresets(bookState()), ['book']);
    const s: PresetState = { rulesSource: 'urr', houseRules: { values: { 'KARMA.refresh': 'manual' }, advanced: { 'COMBAT.prone.targetMelee': -1 } }, settings: { ...AUTOMATION_DEFAULTS, autoApplyGm: true, floatingDamage: false } };
    const plan = presetPlan(presetById('book')!, s);
    assert.deepEqual(plan.map((c) => [c.kind, c.key, c.from, c.to, c.scope]), [
      ['rulesSource', 'rulesSource', 'urr', 'book', undefined],
      ['houseRules', 'houseRules', 2, 0, undefined],
      ['setting', 'floatingDamage', false, true, 'client'],
      ['setting', 'autoApplyGm', true, false, 'world'],
    ]);
    assert.deepEqual(matchingPresets(s), []);
    // The Revamp leaves automation alone.
    assert.deepEqual(presetPlan(presetById('urr')!, s).map((c) => c.kind), ['houseRules']);
    assert.deepEqual(matchingPresets({ ...s, houseRules: null }), ['urr']);
  });

  test('Book rules and Light automation never both match; Light differs from the book', () => {
    const light = presetById('light')!;
    const lightState: PresetState = { rulesSource: 'book', houseRules: {}, settings: { ...AUTOMATION_DEFAULTS, ...light.settings } };
    assert.deepEqual(matchingPresets(lightState), ['light']);
    assert.ok(presetPlan(presetById('book')!, lightState).length > 0);
    assert.equal(houseRuleCount({ values: [] as any, advanced: undefined }), 0);
  });

  test('the house-rules window: a presets row, applied only by a GM after a confirmation', () => {
    const settings = mod('settings.ts');
    assert.match(settings, /\$\{presetsRowHtml\(\)\}/);
    assert.match(settings, /applyPreset: HouseRulesConfig\.#onPreset/);
    const app = mod('applications', 'automation941.ts');
    assert.match(app, /if \(!isGm\(\)\) \{[^}]*return false; \}/);
    assert.match(app, /DialogV2\.confirm\(/);
    const i = app.indexOf('DialogV2.confirm(');
    assert.ok(app.indexOf("settings.set(SYSTEM_ID, 'rulesSource'") > i, 'nothing is written before the confirmation');
  });
});
