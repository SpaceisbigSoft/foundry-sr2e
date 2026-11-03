/**
 * v0.81.1 fix round, FX-REST: regression tests for the second-pass findings in the rules files, sheets.ts, the
 * models, the templates and the stylesheet (RV/rv811 RC.md, RA.md, RB.md, S.md, SEC2.md). Each failed before its fix.
 * The inputs are the reviewers' probes (rv811/try-RC/probe, try-RA ra2-probe P3/P5/P7, try-SEC2 probe).
 * sheets.ts can't be imported in node, so its checks read the source and compile small helpers.
 */
import { test, describe, before } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { RULES } from '../config.ts';
import { parseStatBlock } from '../statblock.ts';
import * as catalogcsv from '../catalogcsv.ts';
import { parseCatalogueDamage, rowsToTemplates, templatesToCsv, parseCatalogueJson, MAX_CSV_CHARS, CATALOGUE_FORMAT } from '../catalogcsv.ts';
import { parseCharacterSheet, parseContactEntry } from '../charimport.ts';
import { gearStackKey, GEAR_STACK_FIELDS, GEAR_STACK_IGNORED, GEAR_STACK_DEFAULTS } from '../catalogue.ts';
import { itemPilesConfig } from '../setup.ts';
import { parseInlineTest, inlineTestLabel, inlineTestSummary } from '../inlinetest.ts';
import { cardArea, cardKindLabel, monitorView, MAX_OVERFLOW_BOXES } from '../look.ts';
import { parseAvailability } from '../upkeep.ts';
import * as gmtools from '../gmtools.ts';
import * as remnants from '../remnants.ts';
import { own } from '../util.ts';
import { careFactor, recoveryCareCost } from '../afflictions.ts';
import { actionCost, metatype } from '../core.ts';
import { inArc } from '../netrig.ts';
import { doseDrug, type ActiveDrug } from '../vitals.ts';
import { sensorLockLapse, sensorLockStamp } from '../gridwork.ts';
import { positionModifier } from '../roadwork.ts';
import { woundLevelForBoxes } from '../arcanum.ts';
import { totemHelpsSpirit } from '../bestiary.ts';
import { bookStrengthRow } from '../docs79-ranged.ts';
import { cbtSoakLevel } from '../urr80-combat.ts';
import { PROJECT_CALLS } from '../waiting.ts';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
const makeId = () => 'id';
const R = RULES as any;
const timed = (f: () => unknown): number => { const s = performance.now(); f(); return performance.now() - s; };
const SP = ' '.repeat(10_000);

// ---------------------------------------------------------------- sheets.ts by source (as v081-sheet.test.ts)
const SHEETS = read('src', 'module', 'applications', 'sheets.ts');
const sf = ts.createSourceFile('sheets.ts', SHEETS, ts.ScriptTarget.Latest, true);
function walk(n: ts.Node, f: (n: ts.Node) => void): void { f(n); ts.forEachChild(n, (c) => walk(c, f)); }
function fnSource(name: string): string {
  let out = '';
  walk(sf, (n) => {
    if (out) return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) out = n.getText();
    if (ts.isMethodDeclaration(n) && n.name.getText() === name) out = n.getText();
  });
  assert.ok(out, `found ${name}`);
  return out;
}
function compile(name: string, scope: Record<string, unknown>): any {
  const js = ts.transpileModule(fnSource(name), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const keys = Object.keys(scope);
  return new Function(...keys, `${js}\nreturn ${name};`)(...keys.map((k) => scope[k]));
}

// ---------------------------------------------------------------- A Foundry field stub, to walk the models' schemas
const mk = (kind: string) => class {
  kind = kind; opts: any; fields: any; element: any;
  constructor(a?: any, b?: any) {
    if (kind === 'SchemaField') { this.opts = b ?? {}; this.fields = a; }
    else if (kind === 'ArrayField') { this.opts = b ?? {}; this.element = a; }
    else this.opts = a ?? {};
  }
};
let M: any;
before(async () => {
  const S = 'StringField';
  (globalThis as any).foundry ??= {
    data: { fields: { NumberField: mk('NumberField'), StringField: mk(S), BooleanField: mk('BooleanField'), SchemaField: mk('SchemaField'), ArrayField: mk('ArrayField'), HTMLField: mk(S), ObjectField: mk('ObjectField'), TypedObjectField: mk('ObjectField'), DocumentUUIDField: mk(S), FilePathField: mk(S), ColorField: mk(S), EmbeddedDataField: mk('ObjectField'), JSONField: mk('ObjectField'), SetField: mk('ArrayField'), AnyField: mk('ObjectField') } },
    abstract: { TypeDataModel: class {} },
  };
  M = await import('../../models/index.ts');
});
/** Every leaf of a schema: [dotted path, field]. */
function leaves(fields: Record<string, any>, pre = ''): Array<[string, any]> {
  return Object.entries(fields).flatMap(([k, f]) => (f.kind === 'SchemaField' ? leaves(f.fields, `${pre}${k}.`) : [[`${pre}${k}`, f] as [string, any]]));
}
/** A schema's initial values as a nested object (a saved item with its defaults). */
function initial(fields: Record<string, any>): any {
  return Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.kind === 'SchemaField' ? initial(f.fields) : f.kind === 'ArrayField' ? [] : (typeof f.opts.initial === 'function' ? f.opts.initial() : f.opts.initial)]));
}

describe('RC2-1 / SEC2b-3: the importers collapse blank runs first (no cubic backtracking)', () => {
  test('stat block: a Strength damage code with 10,000 spaces', () => {
    assert.ok(timed(() => parseStatBlock(`Gear: Knife (STR${SP})`)) < 200);
    assert.ok(timed(() => parseStatBlock(`Gear: Knife (Str${SP}x)`)) < 200);
    for (const w of ['init', 'karma pool', 'professional rating', 'Skills: a']) assert.ok(timed(() => parseStatBlock(`${w}${SP}x`)) < 200, w);
  });
  test('stat block: blank runs inside a line still read as one space', () => {
    const p = parseStatBlock('Gear: Knife   (STR  +  2   M)');
    assert.equal(p.weapons[0]?.power, 2);
    assert.equal(p.weapons[0]?.level, 'M');
  });
  test('catalogue CSV: a damage cell with 10,000 spaces, alone and through rowsToTemplates', () => {
    assert.ok(timed(() => parseCatalogueDamage(`STR${SP}z`)) < 200);
    assert.ok(timed(() => parseCatalogueDamage(`(${SP}z`)) < 200);
    assert.ok(timed(() => rowsToTemplates(`Name,Type,Damage\nKnife,weapon,STR${SP}+`, { makeId })) < 200);
    assert.deepEqual(parseCatalogueDamage('( STR   + 2 )  M'), { power: 2, level: 'M', stun: null, strength: true });
  });
  test('character import: the attribute header row then a Gear line with 10,000 spaces', () => {
    assert.ok(timed(() => parseCharacterSheet(`B Q S C I W\nGear: Knife (STR${SP})`)) < 200);
  });
});

describe('RC2-2: gear stacks on every field but an ignore list', () => {
  test('the gear schema: every field is listed or ignored, and nothing listed is missing from it', () => {
    const all = leaves(M.GearDataModel.defineSchema());
    const paths = all.map(([p]) => p);
    const unlisted = paths.filter((p) => !GEAR_STACK_FIELDS.includes(p) && !GEAR_STACK_IGNORED.includes(p));
    assert.deepEqual(unlisted, [], 'a new gear field must go in GEAR_STACK_FIELDS or GEAR_STACK_IGNORED (catalogue.ts)');
    assert.deepEqual([...GEAR_STACK_FIELDS, ...GEAR_STACK_IGNORED].filter((p) => !paths.includes(p)), []);
    assert.equal(new Set(GEAR_STACK_FIELDS).size, GEAR_STACK_FIELDS.length);
  });
  test('the defaults table matches the schema (a saved item at its defaults stacks with a bare template)', () => {
    const all = leaves(M.GearDataModel.defineSchema());
    for (const [p, f] of all) {
      if (GEAR_STACK_IGNORED.includes(p)) continue;
      const v = f.opts.initial;
      const empty = v === 0 || v === '' || v === false || v == null || f.kind === 'ArrayField';
      if (empty) assert.ok(!(p in GEAR_STACK_DEFAULTS), `${p} has an empty default`);
      else assert.equal(GEAR_STACK_DEFAULTS[p], v, `${p}'s default`);
    }
    const saved = initial(M.GearDataModel.defineSchema());
    assert.equal(gearStackKey('Medkit', { ...saved, medkitRating: 3, quantity: 4 }), gearStackKey('Medkit', { medkitRating: 3 }));
  });
  test('the reviewer\'s pairs no longer stack', () => {
    const apart = (n: string, a: any, b: any) => assert.notEqual(gearStackKey(n, a), gearStackKey(n, b), n);
    apart('Jammer', { jammer: 2 }, { jammer: 6 });
    apart('Maglock passkey', { bypassTool: { kind: 'passkey', rating: 4 } }, { bypassTool: { kind: 'passkey', rating: 8 } });
    apart('Chameleon suit', { stealth: { kind: 'chameleon', rating: 3 } }, { stealth: { kind: 'chameleon', rating: 6 } });
    apart('Medkit', { medkitRating: 3, damaged: true }, { medkitRating: 3, damaged: false });
    apart('SIN', { identity: { kind: 'sin', rating: 4, fake: true } }, { identity: { kind: 'sin', rating: 4, fake: false } });
    apart('Clip', { ammoType: 'standard', rounds: 10 }, { ammoType: 'standard', rounds: 30 });
    apart('Simsense chip', { simchip: { kind: 'btl', rating: 2 } }, { simchip: { kind: 'btl', rating: 6 } });
    apart('RCD', { rcdRating: 2, signal: 2 }, { rcdRating: 2, signal: 6 });
    apart('Toolkit', { tools: { level: 'kit' } }, { tools: { level: 'shop' } });
    apart('Goggles', { optics: { lowLight: true } }, { optics: { thermographic: true } });
    apart('Library', { site: { kind: 'library', rating: 2 } }, { site: { kind: 'library', rating: 6 } });
    apart('Drug', { toxin: { kind: 'drug', power: 6, level: 'M', addiction: 2 } }, { toxin: { kind: 'drug', power: 6, level: 'M', addiction: 8 } });
    apart('Bug', { surveillance: { kind: 'bug', rating: 2, plantedOn: 'Actor.x' } }, { surveillance: { kind: 'bug', rating: 2 } });
  });
  test('a part not in use still ignores its leftovers; Item Piles gets every scalar field', () => {
    assert.equal(gearStackKey('Dart', { toxin: { kind: '', power: 9, addiction: 3 } }), gearStackKey('Dart', {}));
    assert.equal(gearStackKey('Kit', { tools: { level: 'none', skill: 'x' } }), gearStackKey('Kit', {}));
    const c = itemPilesConfig({ version: '1', nuyenImg: '' } as any) as any;
    for (const f of ['jammer', 'signal', 'rounds', 'damaged', 'stealth.rating', 'bypassTool.rating', 'identity.fake', 'surveillance.plantedOn']) assert.ok(c.ITEM_SIMILARITIES.includes(`system.${f}`), f);
    assert.ok(!c.ITEM_SIMILARITIES.includes('system.skillMods'), 'an array never compares equal');
    assert.ok(!c.ITEM_SIMILARITIES.includes('system.quantity'));
  });
});

describe('RC2-3: a strong colonless value ends a one-per-line list', () => {
  test('Gear, then Nuyen, Karma and Lifestyle with no blank line', () => {
    const p = parseCharacterSheet('Gear:\nAres Predator [9M]\nArmor Jacket 5/3\nNuyen 5,000\nKarma 3\nLifestyle Middle');
    assert.equal(p.nuyen, 5000);
    assert.equal(p.karma.good, 3);
    assert.equal(p.lifestyle?.level, 'middle');
    assert.deepEqual(p.gear.map((g) => g.name), ['Armor Jacket']);
    assert.deepEqual(p.weapons.map((w) => w.name), ['Ares Predator']);
  });
  test('Contacts then Karma Pool; Spells then Karma with a total', () => {
    const c = parseCharacterSheet('Contacts:\nBob (Fixer)\nKarma Pool 2');
    assert.deepEqual(c.contacts.map((x) => x.name), ['Bob']);
    assert.equal(c.karma.pool, 2);
    const s = parseCharacterSheet('Spells:\nManabolt 4\nKarma 5 (total 23)');
    assert.equal(s.karma.good, 5);
    assert.deepEqual(s.spells.map((x) => x.name), ['Manabolt']);
  });
  test('gear-like words stay entries (R2-REST 1 kept)', () => {
    const p = parseCharacterSheet('Nuyen: 12,000\nGear:\n  Ares Predator [9M]\n  Credstick 1500\n  Medkit 3\n  Grade 2 rations x10');
    assert.ok(p.gear.some((g) => /credstick/i.test(g.name)));
    assert.equal(p.nuyen, 12000);
  });
});

describe('RC2-4: a contact\'s role token is a whole role; notes are kept', () => {
  test('the reviewer\'s three entries', () => {
    assert.deepEqual(parseContactEntry('Bob - Fixer (met him through a gang war)'), { name: 'Bob', role: 'Fixer', level: 1, notes: 'met him through a gang war' });
    const b = parseContactEntry('Bob: bartender (Level 2, knows the yakuza)')!;
    assert.equal(b.role, 'bartender');
    assert.equal(b.notes, 'knows the yakuza');
    const j = parseContactEntry('Jane (owes me from the Renraku guard job, Loyalty 2)')!;
    assert.equal(j.role, '');
    assert.equal(j.notes, 'owes me from the Renraku guard job');
  });
  test('RC-10 kept: "Bob (Fixer)" and "the bartender"', () => {
    assert.equal(parseContactEntry('Bob (Fixer)')!.role, 'Fixer');
    assert.equal(parseContactEntry('Ann (the bartender, Level 2)')!.role, 'the bartender');
    assert.equal(parseContactEntry('Max - fixer (street doc)')!.notes, 'street doc');
  });
});

describe('RC2-5 / RA2-5: record lookups by a key from data are own-key lookups', () => {
  test('own()', () => {
    const t = { a: 1 };
    assert.equal(own(t, 'a'), 1);
    for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) assert.equal(own(t, k), undefined, k);
    assert.equal(own(t, 3), undefined);
    assert.equal(own(null, 'a'), undefined);
  });
  test('@SR2Test[constructor] is not an attribute, and labelling it does not throw', () => {
    for (const spec of ['constructor', '__proto__', 'toString']) {
      const t = parseInlineTest(spec);
      if (typeof t === 'string') continue;
      assert.notEqual(t.kind, 'attribute', spec);
      assert.doesNotThrow(() => { inlineTestLabel(t); inlineTestSummary(t); });
    }
  });
  test('stat block "Spells: Constructor 4" is an unknown spell with a category', () => {
    const p = parseStatBlock('Spells: Constructor 4');
    assert.equal(typeof p.spells[0]?.category, 'string');
  });
  test('a card kind "constructor" is neutral and has no label; catalogue type words', () => {
    assert.equal(cardArea({ kind: 'constructor' }), 'neutral');
    assert.equal(cardKindLabel('constructor'), '');
    assert.equal(rowsToTemplates('Name,Type\nX,constructor', { makeId }).templates.length, 0);
  });
  test('RA2-5 (P5): care, actions, arcs and metatypes', () => {
    assert.equal(careFactor('constructor'), 1);
    assert.ok(Number.isFinite(careFactor('home', 'constructor')));
    assert.equal(recoveryCareCost('constructor', 2), 0);
    assert.equal(actionCost('constructor'), 'simple');
    assert.deepEqual(inArc('constructor', 0, 90), { inside: true, offBy: 0 });
    assert.ok((metatype('__proto__') as any).mods, 'falls back to human');
  });
});

describe('RC2-6: Availability units', () => {
  test('years, seconds, ranges and unknown units', () => {
    const yr = 24 * R.GM_TOOLS.yearDays;
    assert.deepEqual(parseAvailability('8/1 year'), { tn: 8, hours: yr });
    assert.deepEqual(parseAvailability('12/1 yr'), { tn: 12, hours: yr });
    assert.deepEqual(parseAvailability('4/1-2 weeks'), { tn: 4, hours: 336 });
    assert.deepEqual(parseAvailability('4/30 sec'), { tn: 4, hours: 30 / 3600 });
    assert.deepEqual(parseAvailability('6/1.5.2 days'), { tn: 6, hours: R.UPKEEP.availability.defaultHours, unknownUnit: true });
    assert.deepEqual(parseAvailability('4/30 fortnights'), { tn: 4, hours: R.UPKEEP.availability.defaultHours, unknownUnit: true });
  });
  test('the old forms read as before', () => {
    assert.deepEqual(parseAvailability('6/14 days'), { tn: 6, hours: 336 });
    assert.deepEqual(parseAvailability('4/48 hrs'), { tn: 4, hours: 48 });
    assert.deepEqual(parseAvailability('4/48'), { tn: 4, hours: 48 });
    assert.deepEqual(parseAvailability('4/30 min'), { tn: 4, hours: 0.5 });
    assert.deepEqual(parseAvailability('6/2 mos'), { tn: 6, hours: 2 * 24 * R.UPKEEP.monthDays });
    assert.deepEqual(parseAvailability('6/14 days (legal)'), { tn: 6, hours: 336 });
    assert.deepEqual(parseAvailability('6'), { tn: 6, hours: R.UPKEEP.availability.defaultHours });
    assert.deepEqual(parseAvailability('Always'), { tn: 0, hours: 0 });
  });
});

describe('RC2-7 / RC2-9 / SEC2b-9: catalogue CSV and JSON', () => {
  test('RC2-7: the CSV text is capped', () => {
    const r = rowsToTemplates(`Name\n${'x\n'.repeat(MAX_CSV_CHARS / 2 + 10)}`, { defaultType: 'gear', makeId });
    assert.ok(r.warnings.some((w) => /only the first/.test(w)));
  });
  test('RC2-9: a cell a spreadsheet would run as a formula is exported as text and read back the same', () => {
    const name = '=HYPERLINK("http://x.example","Ares")';
    const csv = templatesToCsv([{ id: 'a', type: 'gear', name, system: { cost: 5, description: '@cmd', availability: '-2+3' } }]);
    assert.ok(!/(^|,)"?[=+\-@]/m.test(csv.split('\r\n')[1]!), csv);
    const back = rowsToTemplates(csv, { makeId }).templates[0]!;
    assert.equal(back.name, name);
    assert.equal(back.system.description, '@cmd');
    assert.equal(back.system.availability, '-2+3');
    const neg = templatesToCsv([{ id: 'b', type: 'weapon', name: 'Bow', system: { damagePower: -1 } }]);
    assert.match(neg, /,-1(\r\n|$)/, 'a plain negative number stays a number');
  });
  test('SEC2b-9: __proto__ keys from catalogue JSON and JSON cells are dropped', () => {
    const json = JSON.stringify({ format: CATALOGUE_FORMAT, version: (catalogcsv as any).CATALOGUE_VERSION, templates: [] }).replace('"templates":[]', '"templates":[{"type":"gear","name":"X","system":{"a":{"__proto__":{"x":1}},"constructor":{"y":2}}}]');
    const t = parseCatalogueJson(json).templates[0]!;
    assert.ok(!Object.hasOwn(t.system.a as object, '__proto__'));
    assert.ok(!Object.hasOwn(t.system, 'constructor'));
    const r = rowsToTemplates('Name,system.extra\nX,"{""__proto__"":{""x"":1},""ok"":2}"', { defaultType: 'gear', makeId });
    const extra = r.templates[0]!.system.extra as any;
    assert.equal(extra.ok, 2);
    assert.ok(!Object.hasOwn(extra, '__proto__'));
  });
});

describe('RC2-8 / RA2-6 / D1-13: dead code gone', () => {
  test('UNDO_LIMITS, parseDelimited and angleBetween are not exported; finishInitiation is not a project call', () => {
    assert.ok(!('UNDO_LIMITS' in gmtools));
    assert.ok(!('parseDelimited' in catalogcsv));
    assert.ok(!('angleBetween' in remnants));
    assert.ok(!(PROJECT_CALLS as readonly string[]).includes('finishInitiation'));
  });
  test('the stale comments and the orphaned JSDoc', () => {
    assert.ok(!/UNDO_LIMITS/.test(read('src', 'module', 'rules', 'bookkeeping.ts')));
    assert.ok(!/A finite number or 0\. \*\/\n\/\*\*/.test(read('src', 'module', 'rules', 'lockdown.ts')));
    for (const f of ['cyberware.ts', 'outfit.ts', 'roadwork.ts']) assert.ok(!/\n\n\n/.test(read('src', 'module', 'rules', f)), f);
    assert.ok(!/const escape = /.test(read('src', 'module', 'rules', 'bestiary.ts')), 'RB2-7: bestiary uses escRegExp');
  });
});

describe('RC2-10: "20L" with nothing weapon-like is litres', () => {
  test('Jerrycan of fuel 20L is gear, with a warning; weapons keep their bare codes', () => {
    const p = parseCharacterSheet('Gear: Jerrycan of fuel 20L, Light pistol 6L, Ares Predator 9M, Stun baton [6s Stun]');
    assert.deepEqual(p.weapons.map((w) => w.name).sort(), ['Ares Predator', 'Light pistol']);
    assert.ok(p.gear.some((g) => /jerrycan/i.test(g.name)));
    assert.ok(p.warnings.some((w) => /litres/.test(w)));
    assert.ok(p.warnings.some((w) => /Stun baton.*lower case/.test(w)), 'a dropped lower-case code is reported');
  });
});

describe('RA2-9: a refreshed dose never ends before the active one', () => {
  test('P7: active dose from combat A running to world time 2000; refresh in combat B round 3', () => {
    const H = R.HEALTH_V72.drugs;
    const old = H.doses;
    H.doses = 'refresh';
    try {
      const a: ActiveDrug = { name: 'Jazz', round: 40, worldTime: 2000, combatId: 'A' } as ActiveDrug;
      const r = doseDrug([a], { name: 'Jazz', round: 13, worldTime: 1030, combatId: 'B' } as ActiveDrug, { seconds: 30, now: 1000, round: 3, combatId: 'B' });
      const e = r.list[0]!;
      const perTurn = Math.max(1, R.TOXINS.secondsPerTurn);
      assert.equal(e.worldTime, 2000);
      assert.equal(e.round, 3 + Math.ceil(1000 / perTurn), 'the round follows the time the active dose still has');
      // Same combat: the later round wins.
      const same = doseDrug([{ name: 'Jazz', round: 40, worldTime: 2000, combatId: 'B' } as ActiveDrug], { name: 'Jazz', round: 13, worldTime: 1030, combatId: 'B' } as ActiveDrug, { seconds: 30, now: 1000, round: 3, combatId: 'B' });
      assert.equal(same.list[0]!.round, 40);
    } finally { H.doses = old; }
  });
});

describe('RA-4 siblings: sensor locks and vehicle positions know their combat', () => {
  test('a lock made in combat A round 1 doesn\'t lapse by combat B\'s round 5', () => {
    const stamp = sensorLockStamp({ round: 1, worldTime: 1000, combatId: 'A' });
    assert.equal(stamp.combatId, 'A');
    const o = { now: { round: 5, worldTime: 1001, combatId: 'B' }, sensorRating: 3 };
    assert.equal(sensorLockLapse(stamp, o).lapsed, false);
    assert.equal(sensorLockLapse(stamp, { ...o, now: { ...o.now, combatId: 'A' } }).lapsed, true, 'in its own combat the rounds count');
    assert.equal(sensorLockLapse({ round: 1, worldTime: 1000 }, { now: { round: 5, worldTime: 1001 }, sensorRating: 3 }).lapsed, true, 'no combat ids: as before');
  });
  test('RA2-4 (P3): a position won in combat A round 2 doesn\'t apply in combat B round 2', () => {
    const old = R.VEHICLES_V57.maneuver.mode;
    R.VEHICLES_V57.maneuver.mode = 'score';
    try {
      const pos = { winnerUuid: 'w', loserUuid: 'l', tn: 2, round: 2, combatId: 'A' };
      assert.equal(positionModifier(pos, 'w', 'l', 2, 'B'), null);
      assert.deepEqual(positionModifier(pos, 'w', 'l', 2, 'A'), { label: 'Maneuver position', value: -2 });
      assert.deepEqual(positionModifier(pos, 'w', 'l', 2), { label: 'Maneuver position', value: -2 }, 'no combat given: as before');
    } finally { R.VEHICLES_V57.maneuver.mode = old; }
  });
  test('the models carry the combat id', () => {
    const veh = M.VehicleDataModel.defineSchema();
    assert.ok(veh.locks.element.fields.combatId);
    assert.ok(veh.position.fields.combatId);
  });
});

describe('RB2-9 / RB2-7: wound levels and the regex escaper', () => {
  test('woundLevelForBoxes with a table listed high-first', () => {
    const h = R.MAGIC_V56.healing;
    const old = h.woundLevels;
    try {
      const asc = [...old].sort((a: any, b: any) => a[0] - b[0]);
      const expect = [1, 3, 6, 10].map((n) => woundLevelForBoxes(n));
      h.woundLevels = [...asc].reverse();
      assert.deepEqual([1, 3, 6, 10].map((n) => woundLevelForBoxes(n)), expect);
    } finally { h.woundLevels = old; }
  });
  test('a totem tag with regex characters still matches literally', () => {
    assert.equal(totemHelpsSpirit('c++', { kind: 'c++ spirit' }), true);
    assert.equal(totemHelpsSpirit('a.b', { kind: 'axb spirit' }), false);
  });
});

describe('SEC2b-8: a broken house-rule Strength-range row is skipped', () => {
  test('a pattern that doesn\'t compile, and a null row', () => {
    const D = R.DOCS_V79;
    const old = D.rangedStrengthRows;
    try {
      D.rangedStrengthRows = [{ match: '(' }, null, { match: 'bow', short: 1, medium: 2, long: 3, extreme: 4 }];
      assert.deepEqual(bookStrengthRow('Long bow'), { short: 1, medium: 2, long: 3, extreme: 4 });
      assert.equal(bookStrengthRow('Knife'), null);
    } finally { D.rangedStrengthRows = old; }
  });
});

describe('SEC2b-2: the clean-miss lead takes only numbers from the snapshot', () => {
  test('a planted button in cm.hits / cm.net never reaches the HTML', () => {
    const bad = '<button data-sr2e-action="x">Apply</button>' as any;
    for (const pool of [0, 9]) {
      const r = cbtSoakLevel('M', { hits: bad, net: bad }, 1, pool);
      assert.ok(!/<button/.test(r.lead), r.lead);
    }
  });
});

describe('SEC2b-1: player-sized numbers can\'t size the GM\'s arrays', () => {
  test('the Overflow row is capped and 2^32 doesn\'t throw', () => {
    assert.ok(monitorView({ physical: 0, stun: 0 }, 1e9).overflow!.boxes.length <= MAX_OVERFLOW_BOXES);
    assert.doesNotThrow(() => monitorView({ physical: 0, stun: 0 }, 2 ** 32));
    assert.equal(monitorView({}, 5).overflow!.boxes.length, 5 + (monitorView({}, 0).overflow!.boxes.length), 'ordinary Body unchanged');
  });
  test('pool pips are capped (poolsOf)', () => {
    const poolsOf = compile('poolsOf', { MAX_POOL_PIPS: 50, tx: (k: string) => k });
    const pools = poolsOf({ system: { karma: { pool: 1e9 }, derived: { combatPool: 2 ** 32, combatPoolLeft: 3, karmaPoolLeft: 1e9 } } });
    for (const p of pools) assert.ok(p.pips.length <= 50, p.key);
    assert.ok(/const MAX_POOL_PIPS = 50;/.test(SHEETS));
  });
  test('the schema caps attribute bases, mods and Karma Pools generously', () => {
    const ch = M.CharacterDataModel.defineSchema();
    assert.equal(ch.attributes.fields.body.fields.base.opts.max, 1000);
    assert.equal(ch.attributes.fields.body.fields.mod.opts.max, 1000);
    assert.equal(ch.karma.fields.pool.opts.max, 1000);
    assert.equal(M.SpiritDataModel.defineSchema().karma.fields.pool.opts.max, 1000);
  });
});

describe('S2: sheet fixes', () => {
  test('S2-1: dropPowerEffect acts only on an effect this sheet lists', () => {
    const actors: Record<string, any> = {
      'Actor.me': { uuid: 'Actor.me', getFlag: () => [{ id: 'own', fromUuid: 'Actor.npc' }] },
      'Actor.npc': { uuid: 'Actor.npc', getFlag: () => [{ id: 'barrier', fromUuid: 'Actor.npc' }, { id: 'mine', fromUuid: 'Actor.me' }] },
    };
    const ok = compile('powerEffectOfSheet', { fromUuidSync: (u: string) => actors[u] ?? null });
    const me = { uuid: 'Actor.me', selfUuids: () => ['Actor.me', 'Scene.s.Token.t.Actor.me'] };
    assert.equal(ok(me, 'Actor.me', 'own'), true, 'an effect on this actor');
    assert.equal(ok(me, 'Actor.npc', 'mine'), true, 'one this actor sustains on another');
    assert.equal(ok(me, 'Actor.npc', 'barrier'), false, 'another caster\'s effect on another actor');
    assert.equal(ok(me, 'Actor.npc', 'nope'), false);
    assert.equal(ok(me, '', 'own'), false);
    assert.match(fnSource('#onDropPowerEffect'), /if \(!powerEffectOfSheet\(this\.document, uuid, id\)\) return;[\s\S]*setPowerEffect/);
  });
  test('S2-3: an unlinked token\'s spirit is its one token, and its synthetic actor isn\'t deleted', () => {
    const tok: any = { id: 't1' };
    const scene = { tokens: [tok, { id: 't2', actorId: 'base' }] };
    tok.parent = scene;
    const groups = compile('spiritTokenGroups', { game: { scenes: [scene] } });
    assert.deepEqual(groups({ isToken: true, id: 'base', token: tok }), [{ scene, tokens: [tok] }]);
    assert.equal(groups({ isToken: false, id: 'base' })[0].tokens.length, 1);
    assert.match(fnSource('dismissSpiritNow'), /if \(!actor\.isToken\) await actor\.delete\(\);/);
    assert.match(fnSource('mayDismissHere'), /if \(actor\?\.isToken\) return Boolean\(actor\.token\?\.canUserModify\?\.\(user, "delete"\)\);/);
  });
  test('S2-4: the invisibility roll comes after the range check and useAction', () => {
    const src = fnSource('#onAttackWeapon');
    const roll = src.indexOf('await actor.seeThroughInvisibility(picked)');
    assert.ok(roll > 0);
    assert.ok(src.indexOf('await actor.useAction(actKind') < roll);
    assert.ok(src.indexOf('Tick "Attack anyway"') < roll);
    assert.ok(roll < src.indexOf('buildOpts(choice)'), 'before the attack options are built');
  });
  test('S2-5: the site sheet deletes through spliceRow or the row\'s id, once per row', () => {
    assert.ok(!/list\.splice\(SR2SiteSheet\.#index/.test(SHEETS));
    const s = fnSource('#onDeleteDevice');
    assert.match(s, /spliceRow\(list, row\)/);
    assert.match(s, /if \(!row \|\| row\.dataset\["deleting"\]\) return;/);
    assert.match(SHEETS, /static async #onDeleteStep\(this: SR2SiteSheet[\s\S]{0,400}spliceRow\(list, row\)/);
    // spliceRow removes once per element (a double click before the re-render).
    const spliceRow = compile('spliceRow', {});
    const el: any = { dataset: { index: '0' } };
    const list = ['a', 'b', 'c'];
    assert.equal(spliceRow(list, el), true);
    assert.equal(spliceRow(list, el), false);
    assert.deepEqual(list, ['b', 'c']);
    assert.match(read('public', 'templates', 'actor-site-sheet.hbs'), /<tr data-index="\{\{@index\}\}" data-id="\{\{id\}\}">/);
  });
  test('S2-7: Push speed checks the driver\'s owner before anything, as Ram does', () => {
    const s = fnSource('#onPushSpeed');
    const guard = s.indexOf('if (ctl && !ctl.isOwner) return');
    assert.ok(guard > 0 && guard < s.indexOf('DialogV2.prompt'));
  });
});
