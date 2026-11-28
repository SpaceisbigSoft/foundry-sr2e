/**
 * v0.99.0 rules completeness, gear (RULES.KIT_V99): the pure rules (rules/kit99.ts) and the hooks into
 * rules/implants.ts (chipsRunning) and rules/armory.ts's search list (underCoat), and for each switch that its other
 * value ('v980') gives the v0.98.0 result.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/config.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as K from '../rules/kit99.ts';
import { HOUSE_KIT_V99, SKILL_MEMORY_99, MANUAL_SEARCH_99 } from '../rules/config99/kit.ts';
import { KIT_V980_WAY } from '../rules/__tests__/kit980.ts';
import { chipsRunning } from '../rules/implants.ts';
import { searchTargets } from '../rules/armory.ts';

/** English from public/lang/en.json, with this area's draft while it isn't merged. */
function english(): Record<string, string> {
  const flat: Record<string, string> = {};
  const walk = (o: unknown, p: string): void => { if (typeof o === 'string') { flat[p] = o; return; } if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k); };
  walk(JSON.parse(readFileSync(join('public', 'lang', 'en.json'), 'utf8')), '');
  // The drafts while they aren't merged: the first build's, the review fixes' new keys and their changed ones.
  for (const f of ['kit99.json', 'kit99-fix.json', 'kit99-fix-replace.json']) {
    const draft = join('i18n-drafts', f);
    if (existsSync(draft)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(draft, 'utf8')) as Record<string, string>)) flat[k.replace(/^REPLACE:/, '')] = v;
  }
  return flat;
}
(globalThis as any).__SR2E_EN__ = { ...((globalThis as any).__SR2E_EN__ ?? {}), ...english() };

describe('v0.99.0 gear: the switches', () => {
  test('every switch has a house-rules row, the book first and the default', () => {
    const v: any = RULES.KIT_V99;
    for (const r of HOUSE_KIT_V99) {
      const keys = r.path.split('.').slice(1);
      let o: any = v;
      for (const k of keys.slice(0, -1)) o = o[k];
      assert.ok(keys[keys.length - 1]! in o, r.path);
      if (r.type === 'select') assert.equal(o[keys[keys.length - 1]!], r.choices![0], `${r.path} defaults to its first choice`);
    }
    for (const k of Object.keys(v).filter((k) => k !== 'policeTn')) assert.ok(HOUSE_KIT_V99.some((r) => r.path === `KIT_V99.${k}`), k);
    assert.equal(Object.keys(KIT_V980_WAY).length, Object.keys(v).length - 1);
    assert.deepEqual(v.policeTn, { permit: 6, restricted: 4, forbidden: 2 });
  });
  test('every house-rules row, tool and key the code uses has English', () => {
    const en = english();
    for (const r of HOUSE_KIT_V99) assert.ok(en[`SR2E.HouseRules.Rule.${r.path.replace(/\./g, '__')}`], r.path);
    assert.ok(en['SR2E.Tools.kit99.label'] && en['SR2E.Tools.kit99.hint']);
    const src = ['src/module/rules/kit99.ts', 'src/module/applications/kit99.ts', 'src/module/applications/sheets.ts', 'public/templates/item-sheet.hbs']
      .map((f) => readFileSync(join(...f.split('/')), 'utf8')).join('\n');
    const keys = new Set([...src.matchAll(/SR2E\.Kit99\.[A-Za-z0-9_.]+[A-Za-z0-9]/g)].map((m) => m[0]));
    for (const dyn of ['Search', 'Sniff', 'Police', 'Scope']) keys.delete(`SR2E.Kit99.${dyn}`);
    for (const k of [...K.SEARCH_PRO_99, ...K.SEARCH_TIME_99, ...K.SEARCH_STATE_99]) keys.add(`SR2E.Kit99.Search.${k}`);
    for (const k of ['standardRounds', 'explosiveRounds', 'fragGrenades', 'smokeGrenades', 'miniGrenades', 'standardGrams', 'plastiqueGrams']) keys.add(`SR2E.Kit99.Sniff.${k}`);
    for (const k of ['none', 'warn', 'press']) keys.add(`SR2E.Kit99.Police.${k}`);
    for (const k of ['none', 'general', 'concentration', 'specialization']) keys.add(`SR2E.Kit99.Scope.${k}`);
    for (const k of keys) assert.ok(en[k], k);
  });
});

describe('Smartlink Level II and smart goggles (FoF pp. 84–85, errata v1.1; Core pp. 90, 241)', () => {
  test('called shot +2 instead of +4, the rangefinder by range, a linked launcher', () => {
    const all = K.smartlink2Mods({ receptor2: true, gun2: true, called: true, range: 'extreme', rangefinder: true, launcher: true });
    assert.deepEqual(all.map((m) => [m.id, m.value]), [[K.KIT99_MOD.called, -2], [K.KIT99_MOD.range, -2], [K.KIT99_MOD.launcher, -1]]);
    assert.equal(K.smartlink2Mods({ receptor2: true, gun2: true, called: false, range: 'long', rangefinder: true })[0]!.value, -1);
    assert.deepEqual(K.smartlink2Mods({ receptor2: true, gun2: true, called: false, range: 'medium', rangefinder: true }), []);
    assert.deepEqual(K.smartlink2Mods({ receptor2: true, gun2: true, called: false, range: 'long', rangefinder: false }), []);
    // Both must be Level II.
    assert.deepEqual(K.smartlink2Mods({ receptor2: false, gun2: true, called: true }), []);
    assert.deepEqual(K.smartlink2Mods({ receptor2: true, gun2: false, called: true }), []);
  });
  test('a linked launcher: fired blast weapons with no Intelligence of their own', () => {
    assert.ok(K.linkedLauncher({ blast: true }));
    assert.ok(!K.linkedLauncher({ blast: true, strengthRange: true }), 'a thrown grenade');
    assert.ok(!K.linkedLauncher({ blast: true, guidance: 3 }), 'a missile');
    assert.ok(!K.linkedLauncher({ blast: false }));
  });
  test('smart goggles: worn ones (at hand, working), Level II by name; the dialog tick and one receptor', () => {
    assert.deepEqual(K.smartGogglesWorn([{ type: 'gear', name: 'Smart Goggles II', atHand: true }]), { worn: true, level2: true });
    assert.deepEqual(K.smartGogglesWorn([{ type: 'gear', name: 'Smartgoggles', atHand: true }]), { worn: true, level2: false });
    assert.deepEqual(K.smartGogglesWorn([{ type: 'gear', name: 'Smart goggles', atHand: false }, { type: 'gear', name: 'Smart goggles', damaged: true }]), { worn: false, level2: false });
    assert.ok(K.gogglesTicked({ smartgun: true, implant: false, goggles: true }));
    assert.ok(!K.gogglesTicked({ smartgun: true, implant: true, goggles: true }), 'the implant is ticked instead');
    assert.ok(!K.gogglesTicked({ smartgun: false, implant: false, goggles: true }));
    assert.deepEqual(K.receptorDrop(['smartlink', 'smartGoggles']), ['smartGoggles']);
    assert.deepEqual(K.receptorDrop(['smartGoggles']), []);
  });
  test("'v980': none of it", (t) => {
    t.after(oldWay(KIT_V980_WAY));
    assert.deepEqual(K.smartlink2Mods({ receptor2: true, gun2: true, called: true, range: 'extreme', rangefinder: true, launcher: true }), []);
    assert.ok(!K.gogglesTicked({ smartgun: true, implant: false, goggles: true }));
    assert.deepEqual(K.receptorDrop(['smartlink', 'smartGoggles']), []);
  });
});

describe('skillsofts: skillwires, replacing the skill, the Skill Memory Table (Core pp. 247–249)', () => {
  const soft = (skill: string, effective: number, kind = 'activesoft') => ({ kind, skill, effective, reason: '' });
  test('the running activesofts share the Skillwire Rating in slot order; knowsofts are not counted', () => {
    const out = K.capActivesofts([soft('Firearms', 3), soft('Know', 4, 'knowsoft'), soft('Athletics', 2), soft('Stealth', 1)], 4);
    assert.deepEqual(out.map((s) => s.effective), [3, 4, 1, 0]);
    assert.match(out[2]!.reason, /share skillwires 4/);
  });
  test('no magic skills on softs; a running soft replaces the skill', () => {
    const out = K.capActivesofts([soft('Sorcery', 3), soft('conjuring', 2, 'knowsoft')], 6);
    assert.deepEqual(out.map((s) => s.effective), [0, 0]);
    assert.match(out[0]!.reason, /magic skills/);
    assert.ok(K.softReplaces());
  });
  test('the Skill Memory Table by type and rating; a linguasoft is a language', () => {
    assert.equal(K.softMemoryMp({ kind: 'knowsoft', scope: '', rating: 4 }), 200);
    assert.equal(K.softMemoryMp({ kind: 'knowsoft', scope: 'concentration', rating: 3 }), 18);
    assert.equal(K.softMemoryMp({ kind: 'knowsoft', scope: 'specialization', rating: 10 }), 800);
    assert.equal(K.softMemoryMp({ kind: 'linguasoft', scope: 'general', rating: 6 }), 36);
    assert.equal(K.softMemoryMp({ kind: 'knowsoft', scope: 'bogus', rating: 12 }), 2000, 'unknown type general, rating at most 10');
    assert.equal(SKILL_MEMORY_99.language!.length, 10);
  });
  test('chipsRunning: a knowsoft runs from memory only when the table\'s Mp fit', () => {
    const chips = [{ kind: 'knowsoft', rating: 3, slotted: true, scope: '' }, { kind: 'knowsoft', rating: 4, slotted: true, scope: '' }, { kind: 'linguasoft', rating: 4, slotted: true }];
    const run = chipsRunning(chips, { jacks: 0, memory: 60 });
    assert.deepEqual(run.map((r) => r.runs), [true, false, true]); // 30 + (200 doesn't fit) + 24
  });
  test("'v980': each activesoft capped alone, any skill, rating × Mp per rating", (t) => {
    t.after(oldWay(KIT_V980_WAY));
    const out = K.capActivesofts([soft('Firearms', 3), soft('Sorcery', 2)], 3);
    assert.deepEqual(out.map((s) => s.effective), [3, 2]);
    assert.ok(!K.softReplaces());
    assert.equal(K.softMemoryMp({ kind: 'knowsoft', rating: 4 }), null);
    const run = chipsRunning([{ kind: 'knowsoft', rating: 4, slotted: true }], { jacks: 0, memory: 12 });
    assert.equal(run[0]!.runs, true, 'rating 4 × 3 Mp');
  });
});

describe('the lined coat (Core p. 242)', () => {
  const items = [
    { id: 'c', type: 'armor', name: 'Lined Coat', concealability: 8, worn: true },
    { id: 'p', type: 'weapon', name: 'Pistol', concealability: 5 },
    { id: 'r', type: 'weapon', name: 'Rifle', concealability: 0 },
    { id: 'g', type: 'gear', name: 'Lockpick', concealability: 6 },
  ];
  test('worn: +2 for each hideable weapon against looks and frisks, not scanners', () => {
    const look = searchTargets(K.underCoat(items, 'look'), 'look');
    assert.equal(look.find((t) => t.id === 'p')!.tn, 7);
    assert.equal(look.find((t) => t.id === 'r')!.tn, null, 'a weapon that can\'t be hidden stays in plain sight');
    assert.equal(look.find((t) => t.id === 'g')!.tn, 6);
    assert.equal(K.underCoat(items, 'scanner').find((i) => i.id === 'p')!.concealability, 5);
    assert.equal(K.underCoat(items.map((i) => (i.id === 'c' ? { ...i, worn: false } : i)), 'frisk').find((i) => i.id === 'p')!.concealability, 5);
  });
  test('review C7: only a coat that is worn counts (no worn field: carried, not worn)', () => {
    const carried = items.map((i) => (i.id === 'c' ? { id: 'c', type: 'armor', name: 'Lined Coat', concealability: 8 } : i));
    assert.equal(K.underCoat(carried, 'look').find((i) => i.id === 'p')!.concealability, 5);
  });
  test("'v980': no change", (t) => {
    t.after(oldWay(KIT_V980_WAY));
    assert.equal(K.underCoat(items, 'look').find((i) => i.id === 'p')!.concealability, 5);
  });
});

describe('manual detection (NAGRL p. 93)', () => {
  test('the table\'s rows; the strip search is a GM\'s only', () => {
    const r = K.manualSearchMods({ pro: 'pr1', time: 'cursory', state: 'control' }, false);
    assert.deepEqual(r.mods.map((m) => m.value), [2, 2, -2]);
    assert.equal(r.strip, false);
    assert.deepEqual(K.manualSearchMods({ pro: 'pr3', time: 'strip', state: 'normal' }, true), { mods: [], strip: true });
    const p = K.manualSearchMods({ time: 'strip' }, false);
    assert.equal(p.strip, false);
    assert.deepEqual(p.mods.map((m) => m.value), [MANUAL_SEARCH_99.time.nearStrip]);
    assert.deepEqual(K.manualSearchMods({ pro: 'x', time: 'y', state: 'z' }, true).mods, [], 'unknown: the 0 rows');
  });
  test("'v980': none", (t) => {
    t.after(oldWay(KIT_V980_WAY));
    assert.deepEqual(K.manualSearchMods({ pro: 'pr1', time: 'strip' }, true), { mods: [], strip: false });
  });
});

describe('the chemical sniffer (NAGRL p. 93)', () => {
  test('the book\'s example: 20 standard rounds and two frag grenades, TN 5', () => {
    const load = K.sniffLoad([
      { name: 'Ares Predator', type: 'weapon', ammo: 10, ammoMax: 10, ammoType: 'standard' },
      { name: 'Spare clip', type: 'gear', ammoType: 'standard', rounds: 10, quantity: 1 },
      { name: 'Frag grenade', type: 'weapon', blast: true, blastKind: 'defensive', thrown: true, quantity: 2 },
      { name: 'Knife', type: 'weapon', melee: true },
    ]);
    assert.deepEqual(load.names, ['Ares Predator', 'Spare clip', 'Frag grenade']);
    assert.equal(K.sniffTn(load.counts).tn, 5);
  });
  test('explosive rounds, smoke, mini-grenades, explosives by weight; never below 2', () => {
    const load = K.sniffLoad([
      { name: 'SMG', type: 'weapon', ammo: 7, ammoMax: 30, ammoType: 'explosive' },
      { name: 'Smoke', type: 'weapon', blast: true, blastKind: 'smoke', thrown: true, quantity: 3 },
      { name: 'MGL', type: 'weapon', blast: true, blastKind: 'offensive', ammo: 4, ammoMax: 6 },
      { name: 'Plastique', type: 'gear', explosivePower: 12, weight: 0.25 },
      { name: 'Dynamite', type: 'gear', explosivePower: 8, weight: 0.05 },
    ]);
    assert.deepEqual({ ex: load.counts.explosiveRounds, smoke: load.counts.smokeGrenades, mini: load.counts.miniGrenades, pl: load.counts.plastiqueGrams, st: load.counts.standardGrams }, { ex: 7, smoke: 3, mini: 4, pl: 250, st: 50 });
    // 10 − 2 (7 explosive) − 2 (3 smoke) − 2 (4 mini) − 3 (250 g plastique) − 2 (50 g) = −1 → 2
    assert.equal(K.sniffTn(load.counts).tn, 2);
    assert.equal(K.sniffTn({}).tn, 10);
  });
  test('only an explosive scanner, the book way', (t) => {
    assert.ok(K.sniffBook('scanner', 'explosive'));
    assert.ok(!K.sniffBook('scanner', 'weapon'));
    assert.ok(!K.sniffBook('frisk', 'explosive'));
    t.after(oldWay(KIT_V980_WAY));
    assert.ok(!K.sniffBook('scanner', 'explosive'));
  });
});

describe('the police check (Shadowtech p. 103)', () => {
  test('the restriction number: the code\'s, the category\'s, the stricter; legal or unset: none', () => {
    assert.equal(K.restrictionNumber({ code: '6P-CC', category: 'permit' }), 6);
    assert.equal(K.restrictionNumber({ code: '8P-CA', category: 'restricted' }), 4, 'the category is stricter');
    assert.equal(K.restrictionNumber({ code: '3-G', category: '' }), 3);
    assert.equal(K.restrictionNumber({ code: '', category: 'forbidden' }), 2);
    assert.equal(K.restrictionNumber({ code: '', category: 'legal' }), null);
    assert.equal(K.restrictionNumber({ code: 'Legal', category: '' }), null);
    assert.equal(K.restrictionNumber({ code: '99X', category: '' }), 12, 'bounded');
  });
  test('the TN: ±3 enforcement, never below 2; the outcomes', () => {
    assert.equal(K.policeTn(6, 3), 9);
    assert.equal(K.policeTn(6, 9), 9, 'at most +3');
    assert.equal(K.policeTn(3, -3), 2);
    assert.deepEqual([0, 1, 2, 5].map(K.policeOutcome), ['none', 'warn', 'press', 'press']);
  });
  test('review S7: the GM\'s catalogue entry of the same name counts too, the stricter wins', () => {
    assert.deepEqual(K.policeRestriction({ code: '', category: '' }, { code: '5P-E', category: 'permit' }), { restriction: 5, catalogue: 5 }, 'blanked by the player');
    assert.deepEqual(K.policeRestriction({ code: '', category: 'legal' }, { code: '', category: 'forbidden' }), { restriction: 2, catalogue: 2 });
    assert.deepEqual(K.policeRestriction({ code: '3P', category: 'permit' }, { code: '5P', category: 'permit' }), { restriction: 3, catalogue: null }, 'the item\'s own is stricter');
    assert.deepEqual(K.policeRestriction({ code: '6P', category: '' }, null), { restriction: 6, catalogue: null });
    assert.equal(K.policeRestriction({ code: '', category: '' }, { code: '', category: 'legal' }), null);
  });
  test('review P5: every item type with legality fields is checked', () => {
    const src = readFileSync(join('src', 'module', 'models', 'index.ts'), 'utf8');
    const types = new Set<string>();
    let cls = '';
    for (const line of src.split('\n')) {
      const m = /^export class (\w+)DataModel\b/.exec(line);
      if (m) cls = m[1]!.toLowerCase();
      if (/\.\.\.legalFields\(\)/.test(line)) types.add(cls);
    }
    assert.deepEqual([...K.POLICE_TYPES_99].sort(), [...types].sort());
  });
  test('the officer: the better of Security and Police Procedures, at most 20', () => {
    assert.equal(K.officerDice([{ name: 'Security', rating: 3 }, { name: 'Police Procedures', rating: 5 }, { name: 'Firearms', rating: 9 }]), 5);
    assert.equal(K.officerDice([{ name: 'security', rating: 99 }]), 20);
    assert.equal(K.officerDice([]), 0);
  });
});

describe('review C8: the item sheet\'s new inputs are hidden at \'v980\'', () => {
  test('sheetUi follows the switches; the template guards each input', (t) => {
    assert.deepEqual(K.sheetUi(), { smartlink2: true, scope: true, legalCode: true });
    const hbs = readFileSync(join('public', 'templates', 'item-sheet.hbs'), 'utf8');
    for (const [flag, input] of [['smartlink2', 'system.smartgun2'], ['scope', 'system.chip.scope'], ['legalCode', 'system.legalCode']] as const) {
      const at = hbs.indexOf(`name="${input}"`);
      const open = hbs.lastIndexOf(`{{#if kit99Ui.${flag}}}`, at);
      assert.ok(at > 0 && open >= 0 && hbs.indexOf('{{/if}}', open) > at && hbs.lastIndexOf('\n', at) < open, input);
    }
    t.after(oldWay(KIT_V980_WAY));
    assert.deepEqual(K.sheetUi(), { smartlink2: false, scope: false, legalCode: false });
  });
});

describe('review P7: counts read the same for one', () => {
  test('no "{n} successes" or "{n} rounds" in the kit\'s texts', () => {
    const en = english();
    for (const [k, v] of Object.entries(en)) if (k.startsWith('SR2E.Kit99.')) assert.doesNotMatch(v, /\{\w+\} (successes|dice|standard|explosive|fragmentation|smoke|mini)/, k);
  });
});
