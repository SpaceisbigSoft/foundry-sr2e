/**
 * v0.99.0 rules completeness, gear (RULES.KIT_V99): the Foundry glue (applications/kit99.ts) and its hooks in
 * documents/index.ts (the attack's receptor and Smartlink II rows, findSkill, the search's lined coat, chemical
 * sniffer and strip search) and models/index.ts (the activesofts sharing the skillwires), with the stubs of
 * glue.test.ts (scripted dice, a chat log). And for each switch that 'v980' gives the v0.98.0 behaviour at the read
 * site. These check OUR wiring, not Foundry.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';
import { KIT_V980_WAY } from '../rules/__tests__/kit980.ts';

const g = globalThis as any;
const faces: number[] = [];
const chat: any[] = [];
const warnings: string[] = [];
const uuidRegistry = new Map<string, any>();

class StubRoll {
  formula: string;
  dice: any[] = [];
  total = 0;
  constructor(formula: string) { this.formula = formula; }
  async evaluate() {
    const m = /^(\d+)d6(?:\s*\+\s*(\d+))?$/.exec(this.formula);
    if (!m) throw new Error(`unexpected formula ${this.formula}`);
    const results = Array.from({ length: Number(m[1]) }, () => { const f = faces.shift(); if (f === undefined) throw new Error('out of scripted faces'); return { result: f }; });
    this.dice = [{ results }];
    this.total = results.reduce((a, r) => a + r.result, 0);
    return this;
  }
}
function setPath(obj: any, path: string, value: unknown) {
  const parts = path.split('.');
  let o = obj;
  for (const p of parts.slice(0, -1)) o = (o[p] ??= {});
  o[parts[parts.length - 1]!] = value;
}

let CharacterDataModel: any, SR2Actor: any, KG: any;
const GM = { id: 'gm1', name: 'GM', isGM: true };
const P1 = { id: 'p1', name: 'Player', isGM: false };

before(async () => {
  const draft = join('i18n-drafts', 'kit99.json');
  if (existsSync(draft)) g.__SR2E_EN__ = { ...(g.__SR2E_EN__ ?? {}), ...JSON.parse(readFileSync(draft, 'utf8')) };
  (RULES.DISASTERS as any).prompt = false;
  (RULES.WAITING as any).enabled = false;
  g.foundry = { abstract: { TypeDataModel: class {} }, data: { fields: new Proxy({}, { get: () => class { constructor(..._a: any[]) {} } }) } };
  g.Roll = StubRoll;
  g.ChatMessage = { create: async (d: any) => { chat.push(d); return d; }, getSpeaker: () => ({}) };
  g.game = { i18n: { localize: (k: string) => k }, user: GM, users: [GM, P1] };
  g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
  g.fromUuid = async (u: string) => uuidRegistry.get(u) ?? null;
  g.ui = { notifications: { warn: (m: string) => { warnings.push(m); }, info: () => {} } };
  g.Actor = class {
    items: any[] = []; system: any; flags: any = {}; isOwner = true; ownership: any = { default: 0 };
    getFlag(scope: string, key: string) { return this.flags[scope]?.[key]; }
    async setFlag(scope: string, key: string, v: any) { (this.flags[scope] ??= {})[key] = v; }
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); this.system.prepareDerivedData?.(); }
    testUserPermission(u: any) { return u.isGM; }
  };
  g.Item = class {};
  g.Combatant = class { actor: any; };
  g.Combat = class {};
  ({ CharacterDataModel } = await import('../models/index.ts'));
  ({ SR2Actor } = await import('../documents/index.ts'));
  KG = await import('../applications/kit99.ts');
});

beforeEach(() => { chat.length = 0; warnings.length = 0; faces.length = 0; g.game.user = GM; });

let n = 0;
const P = { body: 4, quickness: 5, strength: 3, charisma: 3, intelligence: 4, willpower: 4 };
const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
function person(items: any[] = [], name = 'Runner') {
  const sys = Object.create(CharacterDataModel.prototype);
  sys.attributes = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, { base: v, mod: 0 }]));
  Object.assign(sys, { essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, monitor: { physical: 0, stun: 0 }, karma: { good: 0, pool: 0, poolSpent: 0, career: 0 }, drugs: [] });
  const a = new SR2Actor();
  a.system = sys;
  a.uuid = `Actor.k${++n}`; a.name = name; a.type = 'character'; (a as any).id = `id${n}`;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  (a as any).statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const ware = (id: string, name: string, extra: any = {}) => ({ id, type: 'cyberware', name, system: { installed: true, essenceCost: 0.5, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0, kind: 'other', damaged: false, housedIn: '', bioware: false, ...extra } });
const gun = (extra: any = {}) => ({ id: 'g', type: 'weapon', name: 'Predator', system: { melee: false, skill: 'Firearms', damagePower: 9, damageLevel: 'M', damageType: 'physical', modes: 'SA', ammo: 10, ammoMax: 10, recoilComp: 0, smartgun: true, ...extra } });
const firearms = { id: 'f', type: 'skill', name: 'Firearms', system: { rating: 4, attribute: 'quickness' } };
const ids = (mods: any[]) => mods.map((m: any) => m.id).filter(Boolean);

describe('the attack: Smartlink II and one receptor (KIT_V99.smartlink2, smartGoggles)', () => {
  test('a level 2 smartlink and a Level II smartgun: the called shot at +2, a rangefinder at long range', (t) => {
    const a = person([firearms, ware('sl', 'Smartlink II', { smartlink: true, smartlinkLevel: 2 }), { id: 'rf', type: 'gear', name: 'Rangefinder', system: { quantity: 1 } }]);
    const w = { ...gun({ smartgun2: true }), name: 'Predator II' };
    const mods = a.previewAttack(w, { range: 'long', situational: ['smartlink'], calledShot: 'damage' }).modifiers;
    assert.ok(ids(mods).includes('kit99Called') && ids(mods).includes('kit99Range'), JSON.stringify(mods));
    assert.equal(mods.find((m: any) => m.id === 'kit99Called').value, -2);
    // Only a Level I gun: nothing.
    assert.ok(!ids(a.previewAttack(gun(), { range: 'long', situational: ['smartlink'], calledShot: 'damage' }).modifiers).some((i: string) => i.startsWith('kit99')));
    t.after(oldWay(KIT_V980_WAY));
    assert.ok(!ids(a.previewAttack(w, { range: 'long', situational: ['smartlink'], calledShot: 'damage' }).modifiers).some((i: string) => i.startsWith('kit99')));
  });
  test('smart goggles beside the smartlink: only the smartlink counts; the dialog ticks worn goggles without an implant', (t) => {
    const a = person([firearms, ware('sl', 'Smartlink', { smartlink: true, smartlinkLevel: 1 })]);
    const goggleRow = (m: any) => m.value === (RULES.SITUATIONAL_MODIFIERS.find((r) => r.id === 'smartGoggles')!.value) && /goggle/i.test(m.label);
    assert.ok(!a.previewAttack(gun(), { range: 'short', situational: ['smartlink', 'smartGoggles'] }).modifiers.some(goggleRow));
    const b = person([firearms, { id: 'sg', type: 'gear', name: 'Smart goggles', system: { quantity: 1 } }]);
    assert.ok(KG.gogglesTick(b, gun().system));
    assert.ok(!KG.gogglesTick(a, gun().system), 'an implant: the smartlink row is ticked instead');
    t.after(oldWay(KIT_V980_WAY));
    assert.ok(a.previewAttack(gun(), { range: 'short', situational: ['smartlink', 'smartGoggles'] }).modifiers.some(goggleRow), 'v980: both rows add');
    assert.ok(!KG.gogglesTick(b, gun().system));
  });
});

describe('skillsofts on the character (KIT_V99.skillwires, softReplaces)', () => {
  const kit = () => [
    ware('wires', 'Skillwires 4', { kind: 'skillwires', rating: 4 }), ware('cj', 'Chipjack', { kind: 'chipjack' }), ware('dj', 'Datajack', { kind: 'datajack' }),
    { id: 'fa', type: 'skill', name: 'Firearms', system: { rating: 6, attribute: 'quickness' } },
    { id: 'c1', type: 'gear', name: 'Pistols chip', system: { quantity: 1, chip: { kind: 'activesoft', skill: 'Firearms', rating: 3, slotted: true } } },
    { id: 'c2', type: 'gear', name: 'Stealth chip', system: { quantity: 1, chip: { kind: 'activesoft', skill: 'Stealth', rating: 3, slotted: true } } },
  ];
  test('the two activesofts share skillwires 4; the soft replaces the better own skill', () => {
    const a = person(kit());
    assert.deepEqual(a.system.derived.cyber.softs.map((s: any) => s.effective), [3, 1]);
    const fa = a.findSkill('Firearms');
    assert.deepEqual({ soft: fa.soft, r: fa.system.rating }, { soft: true, r: 3 });
  });
  test("'v980': each capped alone, the better skill", (t) => {
    t.after(oldWay(KIT_V980_WAY));
    const a = person(kit());
    assert.deepEqual(a.system.derived.cyber.softs.map((s: any) => s.effective), [3, 3]);
    assert.equal(a.findSkill('Firearms').system.rating, 6);
  });
});

describe('searches: the lined coat, the chemical sniffer, the strip search', () => {
  const runnerItems = () => [
    { id: 'coat', type: 'armor', name: 'Lined coat', system: { ballistic: 4, impact: 2, worn: true, concealability: 8 } },
    { id: 'h', type: 'weapon', name: 'Hold-out', system: { melee: false, concealability: 6, ammo: 6, ammoMax: 6, ammoType: 'standard' } },
    { id: 'gr', type: 'weapon', name: 'Frag grenade', system: { blast: true, blastKind: 'defensive', strengthRange: true, concealability: 6, quantity: 2 } },
  ];
  test('a frisk under a worn lined coat: the hold-out at 6 + 2 − 2', async () => {
    const guard = person([], 'Guard');
    const runner = person(runnerItems());
    faces.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
    await guard.searchFor(runner.uuid, { method: 'frisk' });
    const gmCard = chat.at(-1).content;
    assert.match(gmCard, /Hold-out \(<span[^>]*>TN 6<\/span>\)/);
  });
  test('the chemical sniffer: one test, 6 rounds and 2 grenades: TN 10 − 1 − 2 = 7, every load item found', async () => {
    const guard = person([{ id: 'sn', type: 'gear', name: 'Chem sniffer', system: { quantity: 1, scanner: { kind: 'explosive', rating: 2 } } }], 'Door');
    const runner = person(runnerItems());
    faces.push(6, 1, 2);
    const r = await guard.searchFor(runner.uuid, { method: 'scanner', scannerId: 'sn' });
    assert.deepEqual(r, { found: ['Hold-out', 'Frag grenade'], missed: [] });
    assert.equal(faces.length, 0, 'one test only');
    assert.match(chat.at(-1).content, /chemical sniffer, TN 7/);
  });
  test('a GM\'s strip search finds every weapon; a player\'s request is not one', async () => {
    const guard = person([], 'Guard');
    const runner = person(runnerItems());
    faces.push(...Array(20).fill(1));
    const strip = await guard.searchFor(runner.uuid, { method: 'frisk', strip99: true });
    assert.deepEqual(strip.found.sort(), ['Frag grenade', 'Hold-out'], 'the weapons; the coat itself is still a test');
    g.game.user = P1;
    const r = await guard.searchFor(runner.uuid, { method: 'frisk', strip99: true });
    assert.ok(!r.found.includes('Hold-out'));
  });
  test("'v980': no coat bonus, the sniffer tests each explosive item", async (t) => {
    t.after(oldWay(KIT_V980_WAY));
    const guard = person([{ id: 'sn', type: 'gear', name: 'Chem sniffer', system: { quantity: 1, scanner: { kind: 'explosive', rating: 2 } } }], 'Door');
    const runner = person(runnerItems());
    faces.push(1, 1);
    const r = await guard.searchFor(runner.uuid, { method: 'scanner', scannerId: 'sn' });
    assert.deepEqual(r, { found: [], missed: ['Frag grenade'] });
    faces.push(...Array(12).fill(1));
    await person([], 'G2').searchFor(runner.uuid, { method: 'frisk' });
    assert.match(chat.at(-1).content, /Hold-out \(<span[^>]*>TN 4<\/span>\)/);
  });
  test('the frisk dialog\'s rows: a player can\'t pick the strip search', () => {
    assert.match(KG.manualSearchFields(), /kit99time[\s\S]*value="strip"/);
    g.game.user = P1;
    assert.doesNotMatch(KG.manualSearchFields(), /value="strip"/);
    assert.deepEqual(KG.manualSearchFrom({ kit99time: 'strip' }, 'frisk').strip99, false);
    g.game.user = GM;
    assert.deepEqual(KG.manualSearchFrom({ kit99time: 'strip' }, 'frisk').strip99, true);
    assert.deepEqual(KG.manualSearchFrom({ kit99time: 'strip' }, 'look'), { mods: [], strip99: false });
    assert.equal(KG.stripSearch('frisk', true), true);
    g.CONFIG = { Actor: { documentClass: { actingAuthor: P1 } } };
    try { assert.equal(KG.stripSearch('frisk', true), false, 'a player\'s action re-run on the GM\'s client'); } finally { delete g.CONFIG; }
  });
});

describe('the police check (KIT_V99.policeCheck, Shadowtech p. 103)', () => {
  const carrier = () => person([
    { id: 'p', type: 'weapon', name: 'Heavy pistol', system: { melee: false, concealability: 0, legality: 'permit', legalCode: '5P-E' } },
    { id: 'h', type: 'weapon', name: 'Hold-out', system: { melee: false, concealability: 8, legality: 'permit', legalCode: '' } },
    { id: 'k', type: 'weapon', name: 'Knife', system: { melee: true, concealability: 8, legality: 'legal' } },
  ], 'Suspect');
  test('on the GM\'s client: what is in plain sight, each vs its TN; whispered to the GMs', async () => {
    const s = carrier();
    faces.push(5, 5, 1, 1);
    const r = await KG.policeCheck(s, { dice: 4, enforcement: 0, all: false });
    assert.deepEqual(r, [{ name: 'Heavy pistol', tn: 5, successes: 2, outcome: 'press' }]);
    assert.deepEqual(chat.at(-1).whisper, ['gm1']);
    faces.push(6, 1, 1, 1, 1, 1, 1, 1, 1); // TN 6: the 6 re-rolled (7) one success; TN 7: none
    const all = await KG.policeCheck(s, { dice: 4, enforcement: 1, all: true });
    assert.deepEqual(all.map((x: any) => [x.name, x.tn, x.outcome]), [['Heavy pistol', 6, 'warn'], ['Hold-out', 7, 'none']]);
  });
  test('not from a player; nothing at \'v980\'', async (t) => {
    const s = carrier();
    g.game.user = P1;
    assert.equal(await KG.policeCheck(s, { dice: 4, enforcement: 0, all: true }), null);
    g.game.user = GM;
    t.after(oldWay(KIT_V980_WAY));
    assert.equal(await KG.policeCheck(s, { dice: 4, enforcement: 0, all: true }), null);
    assert.equal(chat.length, 0);
  });
  test('the dice are bounded on the GM\'s client', async () => {
    faces.push(...Array(20).fill(1));
    await KG.policeCheck(carrier(), { dice: 999, enforcement: 0, all: false });
    assert.equal(faces.length, 0, '20 dice at most');
  });
});
