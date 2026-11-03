/**
 * v0.89.4: localization, fifth slice: rule and item labels. The house rules' labels and sections are keys from their
 * paths (SR2E.HouseRules.*); the setting choices and label maps hold keys; the rules tables (RULES, the Revamp's
 * patch, the tables in rules/texttables.ts) keep their English and are translated in place once Foundry has its
 * languages (SR2E.Rules.*, SR2E.RulesUrr.*, SR2E.Tables.*); runtime modifier rows translate their labels, and the rows
 * the code looks for carry ids (modifierIs); the sheet tooltips are keys (SR2E.Tooltip.*).
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src', 'module');
const lang = JSON.parse(readFileSync(join(ROOT, 'public', 'lang', 'en.json'), 'utf8'));
const flat = (o: any, p = ''): Record<string, string> => Object.entries(o).reduce((acc: Record<string, string>, [k, v]) => (typeof v === 'object' && v ? { ...acc, ...flat(v, `${p}${k}.`) } : { ...acc, [`${p}${k}`]: String(v) }), {});
const KEYS = flat(lang);
const files = (d: string, out: string[] = []): string[] => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== '__tests__') files(p, out); } else if (f.endsWith('.ts')) out.push(p);
  }
  return out;
};
const ALL = files(SRC).map((f) => ({ f, rel: relative(ROOT, f), src: readFileSync(f, 'utf8') }));
// settings.ts defines Foundry windows: a stub base class is enough to import it (as settings.test.ts does)
(globalThis as any).foundry ??= { applications: { api: { ApplicationV2: class {} } } };
const run = (script: string, ...args: string[]) => execFileSync(script.endsWith('.ts') ? join(ROOT, 'node_modules', '.bin', 'tsx') : process.execPath, [join(ROOT, 'scripts', script), ...args], { cwd: ROOT, encoding: 'utf8' });

describe('v0.89.4 the house rules', () => {
  let S: any;
  before(async () => { S = await import('../settings.ts'); });

  test('every house rule has a label and a section in lang/en.json, and none keeps English in the code', () => {
    const missing: string[] = [];
    for (const d of S.HOUSE_RULES) {
      if (!KEYS[S.houseRuleKey(d.path)]) missing.push(`label ${d.path}`);
      if (!KEYS[`SR2E.HouseRules.Section.${d.section}`]) missing.push(`section ${d.section}`);
      assert.equal((d as any).label, undefined, d.path);
    }
    assert.deepEqual(missing, []);
    assert.ok(S.HOUSE_RULES.length > 900);
    assert.equal(S.houseRuleLabel({ path: 'MIN_TARGET_NUMBER' }), 'Minimum target number');
  });

  test('the converters find nothing left: house rules, rules texts, tooltips', () => {
    assert.match(run('i18n-houserules.mjs', '--check'), /would convert 0 house rules/);
    assert.match(run('i18n-tooltips.mjs', '--check'), /would convert 0 tooltips; 0 not plain text/);
    assert.match(run('i18n-rules.ts', '--check'), /up to date/);
  });
});

describe('v0.89.4 setting choices and label maps hold keys', () => {
  test('every value of the maps is a key in lang/en.json', async () => {
    const R = await import('../rules/index.ts');
    const look = await import('../rules/look.ts');
    const iface = await import('../rules/interface.ts');
    const qol = await import('../rules/qol.ts');
    const values = [
      ...Object.values(R.RULES_SOURCES), ...Object.values(look.THEME_LABELS), ...Object.values(look.PRESET_LABELS), ...Object.values(iface.LAYOUT_LABELS),
      ...qol.SOUND_EVENTS.map((e) => e.label), ...qol.PRIVACY_GROUPS.map((g) => g.label), ...qol.PRIVACY_MODES.map((m) => m.label),
    ];
    const bad = values.filter((v) => !/^SR2E\./.test(String(v)) || !KEYS[String(v)]);
    assert.deepEqual(bad, []);
    assert.equal(KEYS['SR2E.Settings.rulesSource.Choices.book'], 'SR2E Book Rules');
  });

  test('no setting is registered with an English name or hint', () => {
    const bad: string[] = [];
    for (const x of ALL) {
      if (!/\.register\(/.test(x.src)) continue;
      const sf = ts.createSourceFile(x.f, x.src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const v = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && /settings\.register$|^s\.register$/.test(n.expression.getText().replace(/\s/g, '')) && n.arguments[2] && ts.isObjectLiteralExpression(n.arguments[2])) {
          for (const p of n.arguments[2].properties) {
            if (!ts.isPropertyAssignment(p) || !/^(name|hint)$/.test(p.name.getText())) continue;
            const e = p.initializer;
            if ((ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) && !/^SR2E\./.test(e.text)) bad.push(`${x.rel}: ${e.text.slice(0, 50)}`);
            if (ts.isTemplateExpression(e)) bad.push(`${x.rel}: ${e.getText().slice(0, 50)}`);
          }
        }
        ts.forEachChild(n, v);
      };
      v(sf);
    }
    assert.deepEqual(bad, []);
  });

  test('the sheet tooltips are keys that exist', async () => {
    const { FIELD_TOOLTIPS } = await import('../config/tooltips.ts');
    const bad = Object.entries(FIELD_TOOLTIPS).filter(([, k]) => !/^SR2E\.Tooltip\./.test(k) || !KEYS[k]).map(([f]) => f);
    assert.deepEqual(bad, []);
    assert.ok(Object.keys(FIELD_TOOLTIPS).length > 200);
  });
});

describe('v0.89.4 modifier rows the code looks for carry ids', () => {
  test('modifierIs: the id when there is one, the English label for rows saved before v0.89.4', async () => {
    const { modifierIs } = await import('../rules/dice.ts');
    assert.equal(modifierIs({ id: 'blinded', label: 'Aveuglé' }, 'blinded', 'Blinded'), true);
    assert.equal(modifierIs({ id: 'flash', label: 'Blinded' }, 'blinded', 'Blinded'), false);
    assert.equal(modifierIs({ label: 'Blinded' }, 'blinded', 'Blinded'), true);
    assert.equal(modifierIs({ label: 'Wounds (physical)' }, 'wounds', /^Wounds/), true);
    assert.equal(modifierIs(null, 'wounds', /^Wounds/), false);
  });

  test('the producers give the ids, and no code compares those labels any more', async () => {
    const { perceivingModifiers } = await import('../rules/astral.ts');
    const { proneModifiers } = await import('../rules/weapons.ts');
    const { woundTnModifiers } = await import('../rules/modifiers.ts');
    assert.equal(perceivingModifiers('perceiving' as any)[0]?.id, 'astralPerception');
    assert.deepEqual(proneModifiers({ melee: true, targetProne: true, attackerProne: true } as any).map((m) => m.id), ['targetProne', 'attackerProne']);
    assert.equal(woundTnModifiers({ physical: 3, stun: 0 } as any)[0]?.id, 'wounds');
    const bad: string[] = [];
    for (const x of ALL) for (const m of x.src.matchAll(/\.label\s*(===|!==)\s*'(Astral perception|Blinded|Flash|Target prone|Attacker prone|Defender prone|Wounds|Sustaining[^']*)'|\/\^Wounds\|\^Sustaining\/\.test/g)) bad.push(`${x.rel}: ${m[0]}`);
    assert.deepEqual(bad, []);
  });
});

describe('v0.89.4 the rules tables are translated in place once the languages load', () => {
  test('RULES, its defaults, the Revamp patch and the listed tables take the language file\'s text; nothing else changes', async () => {
    const { RULES, URR_V80_PATCH } = await import('../rules/index.ts');
    const S = await import('../settings.ts');
    const { ADD_TYPES } = await import('../rules/catalogue.ts');
    const D = await import('../rules/npcdata.ts');
    const before = JSON.stringify(RULES);
    const g = globalThis as any;
    const saved = g.game;
    const seen: string[] = [];
    g.game = { ...(saved ?? {}), i18n: { has: (k: string) => k in KEYS, localize: (k: string) => { seen.push(k); return `«${KEYS[k]}»`; } } };
    try {
      const n = S.localizeRulesTexts();
      assert.ok(n > 1500, `${n} texts translated`);
      assert.equal(RULES.SITUATIONAL_MODIFIERS.find((m: any) => m.id === 'attackerWalking')?.label, '«Attacker walking»');
      assert.equal(S.RULE_DEFAULTS.SITUATIONAL_MODIFIERS.find((m: any) => m.id === 'attackerWalking')?.label, '«Attacker walking»');
      assert.match(String((URR_V80_PATCH as any)['STREET.perception']?.[0]?.label ?? ''), /^«.*»$/);
      assert.equal(ADD_TYPES.find((t) => t.type === 'adeptpower')?.one, '«adept power»');
      assert.match(D.CLOTHING[0]!, /^«.*»$/);
      // names, skills and ids are data: untouched
      assert.equal(RULES.MATRIX.skill, 'Computer');
      assert.ok(D.FIRST_NAMES.every((x) => !x.startsWith('«')));
      // v0.89.6: the HUD's group and layout names are labels (their ids are separate fields)
      assert.ok(!seen.some((k) => /\.(name|skill|id)$/.test(k) && !/^SR2E\.Tables\.(hudGroups|hudLayout)\./.test(k)), 'no name, skill or id is looked up');
      // v0.89.4 review: every key looked up is a text field (or an item of a flavour list / label map)
      const textKey = /\.(label|note|text|skillHint|spiritLabel|help|one)$|^SR2E\.Rules(Urr)?\..*DISASTERS\.suggestions\.\w+$|^SR2E\.Tables\.(payment|skillKinds|npc\.[A-Za-z_]+|weaponLayouts|limbs|icBehaviors|psychotropic|elementEffects|light|vision|concealment|scatterThrow|scatterCompass|artFigures|artArchetypes)\.[\w-]+$|^SR2E\.Tables\.(hudGroups|hudLayout)\.[\w-]+\.name$|^SR2E\.Tables\.wizardSteps\.\w+\.hint$/; // v0.89.6: the label maps added then
      assert.deepEqual(seen.filter((k) => !textKey.test(k)), []);
      // only text fields changed: the rest of RULES is as it was
      const strip = (s: string) => s.replace(/«[^»]*»/g, 'X');
      const after = JSON.parse(JSON.stringify(RULES));
      const orig = JSON.parse(before);
      const diff: string[] = [];
      const cmp = (a: any, b: any, p: string) => {
        if (typeof a === 'string' && typeof b === 'string') { if (a !== b && strip(b) !== 'X') diff.push(p); return; }
        if (a && b && typeof a === 'object') for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) cmp(a[k], b[k], `${p}.${k}`);
        else if (a !== b) diff.push(p);
      };
      cmp(orig, after, 'RULES');
      assert.deepEqual(diff, []);
    } finally {
      // put the English back (translating again with the English file restores every text), then the book rules
      g.game = { ...(saved ?? {}), i18n: { has: (k: string) => k in KEYS, localize: (k: string) => KEYS[k] } };
      S.localizeRulesTexts();
      g.game = saved;
      S.applyHouseRules({ values: {}, advanced: {} }, 'book');
    }
  });
});

describe('v0.89.4 review fixes', () => {
  test('under the Revamp, its own labels come back after the tables are translated (the hook applies the rules again)', async () => {
    const { RULES } = await import('../rules/index.ts');
    const S = await import('../settings.ts');
    const g = globalThis as any;
    const saved = g.game;
    try {
      S.applyHouseRules({ values: {}, advanced: {} }, 'urr');
      const urr = RULES.SITUATIONAL_MODIFIERS.find((m: any) => m.id === 'partialCover')?.label;
      const book = KEYS['SR2E.Rules.SITUATIONAL_MODIFIERS.partialCover.label'];
      assert.ok(urr && book && urr !== book, 'the Revamp labels partial cover its own way');
      g.game = { ...(saved ?? {}), i18n: { has: (k: string) => k in KEYS, localize: (k: string) => KEYS[k] } };
      S.localizeRulesTexts();
      assert.equal(RULES.SITUATIONAL_MODIFIERS.find((m: any) => m.id === 'partialCover')?.label, book, 'translating writes the shipped text');
      S.applyHouseRules({ values: {}, advanced: {} }, 'urr');
      assert.equal(RULES.SITUATIONAL_MODIFIERS.find((m: any) => m.id === 'partialCover')?.label, urr, 'applying again restores the Revamp text');
    } finally { g.game = saved; S.applyHouseRules({ values: {}, advanced: {} }, 'book'); }
    const src = readFileSync(join(SRC, 'settings.ts'), 'utf8');
    assert.match(src, /Hooks\.once\("i18nInit", \(\) => \{\n\s+try \{ localizeRulesTexts\(\); \}[^\n]*\n(\s*\/\/[^\n]*\n)*\s+try \{ problemsNow = applyHouseRules\(/);
    assert.match(src, /Hooks\.once\("ready", \(\) => \{ void reportRefusedHouseRules\(problemsNow\); \}\);/);
    assert.doesNotMatch(src, /esc\(RULES_SOURCES\[/);
  });
});

describe('v0.89.4 review fixes: no meaning read from translated text', () => {
  test('the defaulting group stays last by its id; the prejudice and attitude rows carry ids', async () => {
    const { tnCandidates } = await import('../rules/situation.ts');
    const { retargetGroupsV73 } = await import('../rules/bookkeeping.ts');
    const skill = tnCandidates('plain').find((g: any) => g.id === 'skill');
    assert.ok(skill, 'the Skill group has its id');
    const groups = retargetGroupsV73('perceive');
    assert.equal((groups[groups.length - 1] as any).id, 'skill');
    const social = tnCandidates('social').flatMap((g: any) => g.rows);
    assert.ok(social.some((m: any) => m.id === 'attitude:prejudiced'));
    const src = readFileSync(join(SRC, 'documents', 'index.ts'), 'utf8');
    assert.match(src, /given\.some\(\(m\) => modifierIs\(m, 'attitude:prejudiced', \/\^Attitude: Prejudiced\/i\)\)/);
    const { metatypePrejudice } = await import('../rules/situation.ts');
    const p = metatypePrejudice('ork', 'elf') ?? metatypePrejudice('elf', 'ork') ?? metatypePrejudice('troll', 'human');
    if (p) assert.equal((p as any).id, 'prejudice');
    assert.equal(retargetGroupsV73('social', { applied: ['prejudice'] }).some((g: any) => g.rows.some((m: any) => m.id === 'prejudice')), false);
  });

  test('the NPC job generator classifies by the English words even when its lists are translated', async () => {
    const D: any = await import('../rules/npcdata.ts');
    const N = await import('../rules/npcgen.ts');
    const saveT = [...D.JOB_TYPES], saveG = [...D.JOB_TARGETS];
    const plan0 = N.generateJob({ threat: 2 }, (() => { let x = 7; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); })());
    try {
      D.JOB_TYPES.forEach((s: string, i: number) => { D.JOB_TYPES[i] = `«${s}»`; });
      D.JOB_TARGETS.forEach((s: string, i: number) => { D.JOB_TARGETS[i] = `«${s}»`; });
      const plan = N.generateJob({ threat: 2 }, (() => { let x = 7; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); })());
      assert.equal(plan.jobType, `«${plan0.jobType}»`);
      assert.equal(plan.target, plan0.target ? `«${plan0.target}»` : '');
    } finally {
      saveT.forEach((s, i) => { D.JOB_TYPES[i] = s; });
      saveG.forEach((s, i) => { D.JOB_TARGETS[i] = s; });
    }
  });

  test('modifier row labels share one key group, and the attack dialog builds its automatic rows from the same keys', () => {
    const mod = lang.SR2E.Card.Mod as Record<string, string>;
    const canon = (x: string) => x.replace(/\{\w+\}/g, '{}');
    const byCanon = new Map<string, string[]>();
    for (const [k, v] of Object.entries(mod)) byCanon.set(canon(v), [...(byCanon.get(canon(v)) ?? []), k]);
    assert.deepEqual([...byCanon.entries()].filter(([, ks]) => ks.length > 1), [], 'one key per row label');
    const sheets = readFileSync(join(SRC, 'applications', 'sheets.ts'), 'utf8');
    for (const k of ['targetProne', 'attackerProne', 'charging', 'friendsInMelee', 'canTSeeTheTarget']) assert.match(sheets, new RegExp(`set\\.add\\(tx\\('SR2E\\.Card\\.Mod\\.${k}'`), k);
    assert.doesNotMatch(sheets, /set\.add\("(Target prone|Attacker prone|Charging)"\)/);
  });
});
