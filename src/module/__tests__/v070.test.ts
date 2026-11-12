/**
 * v0.70.0: the 22 fixes from the v0.69.0 review (docs/REVIEW-v0.69.md, section 1). Pure helpers, plus the
 * actor glue with a small copy of glue.test.ts's Foundry stubs (scripted dice, a chat log, warnings).
 * These check OUR wiring, not that Foundry behaves as the stubs do.
 */
import { test, describe, before, beforeEach, after } from 'node:test';
import { oldWay } from '../rules/__tests__/oldway.ts';
import assert from 'node:assert/strict';
import { RULES, addStun, applyDamageToMonitor, hostAlertFor, siteAlertForHost, ASTRAL_BLOCKED_ACTIONS } from '../rules/index.ts';
import { combat922 } from '../rules/__tests__/combat922.ts';

// v0.92.3: these tests pin the v0.92.2 combat flow (COMBAT_V923 at its old choices, the moved defaults put back);
// the book alignment is tested in v0923-combat.test.ts.
let undo922: () => void = () => {};
before(() => { undo922 = combat922(); });
after(() => undo922());

const g = globalThis as any;
const faces: number[] = [];
const chat: any[] = [];
const warnings: string[] = [];
const uuidRegistry = new Map<string, any>();
const hooks = new Map<string, Array<(...a: any[]) => any>>();
let settings: Record<string, unknown> = {};

class StubRoll {
  formula: string;
  dice: any[] = [];
  total = 0;
  constructor(formula: string) { this.formula = formula; }
  async evaluate() {
    const m = /^(\d+)d6(?:\s*\+\s*(\d+))?$/.exec(this.formula);
    if (!m) throw new Error(`unexpected formula ${this.formula}`);
    const n = Number(m[1]);
    const results = Array.from({ length: n }, () => {
      const f = faces.shift();
      if (f === undefined) throw new Error('out of scripted faces');
      return { result: f };
    });
    this.dice = [{ results }];
    this.total = results.reduce((a, r) => a + r.result, 0) + Number(m[2] ?? 0);
    return this;
  }
}

function setPath(obj: any, path: string, value: unknown) {
  const parts = path.split('.');
  let o = obj;
  for (const p of parts.slice(0, -1)) o = (o[p] ??= {});
  const last = parts[parts.length - 1] as string;
  if (last.startsWith('-=')) delete o[last.slice(2)]; else o[last] = value;
}
function flatten(o: any, pre = '', out: Record<string, unknown> = {}) {
  for (const [k, v] of Object.entries(o ?? {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) flatten(v, `${pre}${k}.`, out); else out[`${pre}${k}`] = v;
  }
  return out;
}

let CharacterDataModel: any, SpiritDataModel: any, SiteDataModel: any, HostDataModel: any, SR2Actor: any;
let chatMod: typeof import('../applications/chat.ts');
let canvasMod: typeof import('../applications/canvas.ts');
let approvals: typeof import('../applications/approvals.ts');
let inline: typeof import('../applications/inline.ts');

const GM = () => ({ id: 'gm1', name: 'GM', isGM: true, can: () => true });
const PLAYER = () => ({ id: 'p1', name: 'Corvo', isGM: false, can: () => false });

before(async () => {
  // As in glue.test.ts: rules that add steps or prompts are off unless a test turns them on.
  (RULES.DISASTERS as any).prompt = false;
  (RULES.MAGIC_V39.ritualStages as any).enabled = false;
  (RULES.MAGIC_V39.sites as any).enforce = 'off';
  (RULES.MAGIC_V39.domains as any).enforce = 'off';
  (RULES.MAGIC_V56.learning as any).enabled = false;
  (RULES.WAITING as any).enabled = false;
  g.foundry = {
    abstract: { TypeDataModel: class {} },
    data: { fields: new Proxy({}, { get: () => class { constructor(..._a: any[]) {} } }) },
    utils: {
      randomID: () => Math.random().toString(36).slice(2, 12), deepClone: (o: any) => JSON.parse(JSON.stringify(o)), flattenObject: flatten,
      getProperty: (o: any, p: string) => p.split('.').reduce((x: any, k: string) => x?.[k], o),
    },
    applications: { api: { DialogV2: { confirm: async () => false, prompt: async () => null, wait: async () => null } } },
  };
  g.Roll = StubRoll;
  g.ChatMessage = { create: async (d: any) => { chat.push(d); return d; }, getSpeaker: () => ({}) };
  g.Hooks = { on: (h: string, fn: any) => { if (!hooks.has(h)) hooks.set(h, []); hooks.get(h)!.push(fn); }, once: () => {}, callAll: () => {} };
  g.game = {
    i18n: { localize: (k: string) => k }, user: GM(), users: Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } }),
    time: { worldTime: 0 }, settings: { get: (_s: string, k: string) => settings[k], set: async () => {}, register: () => {} },
    actors: [], messages: { contents: [] },
  };
  g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
  g.fromUuid = async (u: string) => uuidRegistry.get(u) ?? null;
  g.ui = { notifications: { warn: (m: string) => { warnings.push(m); }, info: () => {}, error: () => {} } };
  g.Actor = class {
    items: any[] = []; system: any; flags: any = {}; isOwner = true; ownership: any = { default: 0 };
    getFlag(scope: string, key: string) { return this.flags[scope]?.[key]; }
    async setFlag(scope: string, key: string, v: any) { (this.flags[scope] ??= {})[key] = v; }
    async unsetFlag(scope: string, key: string) { if (this.flags[scope]) delete this.flags[scope][key]; }
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); this.system.parent ??= this; this.system.prepareDerivedData?.(); }
    async createEmbeddedDocuments(_t: string, docs: any[]) { let n = this.items.length; const made = docs.map((d) => ({ id: `i${n++}`, ...d, system: { ...d.system } })); this.items.push(...made); this.system.prepareDerivedData?.(); return made; }
    async updateEmbeddedDocuments(_t: string, ups: any[]) { for (const u of ups) { const it = this.items.find((i) => i.id === u._id); if (it) Object.assign(it.system, u.system); } this.system.prepareDerivedData?.(); }
  };
  g.Item = class {};
  g.Combatant = class { actor: any; };
  g.Combat = class { combatants: any[] = []; flags: any = {}; getFlag(_s: string, k: string) { return this.flags[k]; } async setFlag(_s: string, k: string, v: any) { this.flags[k] = v; } };
  ({ CharacterDataModel, SpiritDataModel, SiteDataModel, HostDataModel } = await import('../models/index.ts'));
  ({ SR2Actor } = await import('../documents/index.ts'));
  g.CONFIG = { Actor: { documentClass: SR2Actor } };
  chatMod = await import('../applications/chat.ts');
  canvasMod = await import('../applications/canvas.ts');
  approvals = await import('../applications/approvals.ts');
  inline = await import('../applications/inline.ts');
});

beforeEach(() => {
  faces.length = 0; chat.length = 0; warnings.length = 0; settings = {};
  g.game.user = GM();
  g.game.users = Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } });
  g.game.time = { worldTime: 0 };
  g.game.actors = [];
  g.game.messages = { contents: [] };
  delete g.game.combat;
  delete g.game.combats;
  delete g.game.scenes;
});

const A = { body: 4, quickness: 5, strength: 4, charisma: 4, intelligence: 5, willpower: 5 };
const withGet = (list: any[]) => Object.assign(list, { get(id: string) { return list.find((i: any) => i.id === id); } });
let n = 0;

/** A character (or NPC) on the real data model, registered for fromUuid. */
function who(extra: any = {}, items: any[] = [], attrs: Record<string, number> = A): any {
  const sys = Object.create(CharacterDataModel.prototype);
  sys.attributes = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, { base: v, mod: 0 }]));
  const { name, type, ...rest } = extra;
  Object.assign(sys, {
    essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 30, career: 30 }, metamagic: {}, initiateGrade: 0,
    nuyen: 0, sustaining: [], drugs: [], geasa: [], ledger: [], recovering: [], diseases: [], care: { stabilised: false, dyingSince: -1 },
    poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, monitor: { physical: 0, stun: 0 }, ...rest,
  });
  const a = new SR2Actor();
  a.system = sys;
  a.name = name ?? 'Runner'; a.type = type ?? 'character';
  a.uuid = `Actor.v70-${++n}`; a.id = `id${n}`;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness') => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active' } });

/** A spirit on the real data model (from glue.test.ts's power tests). */
function spirit(materialized: boolean, name = 'Storm spirit'): any {
  const sys = Object.create(SpiritDataModel.prototype);
  sys.attributes = Object.fromEntries(Object.keys(A).map((k) => [k, { base: 0, mod: 0 }]));
  Object.assign(sys, {
    essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 0 },
    poolSpent: { combat: 0, spell: 0 }, monitor: { physical: 0, stun: 0 }, astral: 'physical', materialized,
    force: 4, spiritKind: 'nature', spiritType: '', services: 1, summonerUuid: '', immuneNormalWeapons: true,
    offsets: Object.fromEntries(Object.keys(A).map((k) => [k, 0])),
  });
  sys.prepareDerivedData();
  const s = new SR2Actor();
  Object.assign(s, { system: sys, type: 'spirit', name, uuid: `Actor.v70spirit-${++n}`, statuses: new Set<string>() });
  s.items = withGet([]);
  uuidRegistry.set(s.uuid, s);
  return s;
}

const shot = (def: any, over: any = {}) => ({ attackerUuid: 'Actor.atk', targetUuid: def.uuid, weaponName: 'Predator', melee: false,
  damageType: 'physical', power: 9, level: 'M', attackSuccesses: 2, targetNumber: 5, ...over });

// ---------------------------------------------------------------------------------------------------------------

describe('B1/B3 a replaced card goes dead (chat.ts cardReplaced)', () => {
  const msg = (id: string, flags: any = {}) => ({ id, flags: { sr2e: flags }, getFlag(_s: string, k: string) { return this.flags.sr2e[k]; } });

  test("an older card of the same test is 'newer'-replaced; the newest is live; the GM's change is 'gm'", () => {
    const first = msg('m1', { test: { testId: 't1' } });
    const other = msg('m2', { test: { testId: 't2' } });
    const reroll = msg('m3', { test: { testId: 't1' } });
    g.game.messages = { contents: [first, other, reroll] };
    assert.equal(chatMod.cardReplaced(first), 'newer');
    assert.equal(chatMod.cardReplaced(reroll), false);
    assert.equal(chatMod.cardReplaced(other), false);
    const retargeted = msg('m4', { test: { testId: 't9' }, supersededBy: 'm5' });
    g.game.messages = { contents: [first, other, reroll, retargeted] };
    assert.equal(chatMod.cardReplaced(retargeted), 'gm');
    assert.equal(chatMod.cardReplaced(msg('m6')), false, 'a card with no test is never replaced');
    assert.equal(chatMod.cardReplaced(null), false);
  });

  test('a new card in the log is seen (the newest-per-test cache rebuilds when the log changes)', () => {
    const a = msg('n1', { test: { testId: 'tx' } });
    g.game.messages = { contents: [a] };
    assert.equal(chatMod.cardReplaced(a), false);
    g.game.messages.contents.push(msg('n2', { test: { testId: 'tx' } }));
    assert.equal(chatMod.cardReplaced(a), 'newer');
  });

  test.skip('cardDone is once per test (Detonate, knockdown, toxin, infection buttons) — cardDone and its handlers are not exported; needs the rendered-card click path', () => {});
});

describe('B2 Defend is remembered once per target (chat.ts defendedOn)', () => {
  test('from the card flag and from the defender\'s cardRolls keys', () => {
    const m = { id: 'mA', flags: { sr2e: { defended: [0] } }, getFlag(_s: string, k: string) { return (this.flags.sr2e as any)[k]; } };
    const d = { flags: { sr2e: { cardRolls: ['mA:defended:2', 'mB:defended:1', 'mA:resisted:3', 'mA:defended:2'] } }, getFlag(_s: string, k: string) { return (this.flags.sr2e as any)[k]; } };
    assert.deepEqual(chatMod.defendedOn(m).sort(), [0]);
    assert.deepEqual(chatMod.defendedOn(m, d).sort(), [0, 2]);
    const fresh = { id: 'mC', flags: { sr2e: {} }, getFlag(_s: string, k: string) { return (this.flags.sr2e as any)[k]; } };
    assert.deepEqual(chatMod.defendedOn(fresh, d), []);
  });
});

describe('B4 tests take the same wound modifier as the strip', () => {
  test('a drug that ignores wounds: no Wounds modifier on tests', () => {
    const a = who({ monitor: { physical: 3, stun: 3 }, drugs: [{ name: 'Painkiller', extra: { ignoreWounds: true } }] });
    assert.equal(a.system.derived.woundModifier, 0);
    assert.deepEqual(a.woundModifiers(), []);
    assert.ok(!a.previewModifiers({}).some((m: any) => m.label === 'Wounds'));
  });

  test('a drug that ignores Stun boxes', () => {
    const a = who({ monitor: { physical: 0, stun: 3 }, drugs: [{ name: 'Stim', extra: { stunIgnoreBoxes: 2 } }] });
    assert.equal(a.system.derived.woundModifier, 1);                       // 1 Stun box counts: Light
    assert.deepEqual(a.woundModifiers(), [{ id: 'wounds', label: 'Wounds', value: 1 }]);
    const b = who({ monitor: { physical: 0, stun: 6 }, drugs: [{ name: 'Stim', extra: { stunIgnoreBoxes: 3 } }] });
    assert.equal(b.woundModifiers()[0]?.value, b.system.derived.woundModifier);
    const none = who({ monitor: { physical: 0, stun: 6 } });
    assert.equal(none.woundModifiers()[0]?.value, none.system.derived.woundModifier);
    assert.ok(none.system.derived.woundModifier > b.system.derived.woundModifier);
  });

  test('a pain editor (derived.bio.ignoreStunWounds) drops Stun wounds from tests', () => {
    const a = who({ monitor: { physical: 1, stun: 6 } });
    const before = a.woundModifiers()[0]?.value ?? 0;
    a.system.derived.bio = { ...(a.system.derived.bio ?? {}), ignoreStunWounds: true };
    assert.deepEqual(a.woundModifiers(), [{ id: 'wounds', label: 'Wounds', value: 1 }]);  // only the Physical box (Light)
    assert.ok(before > 1);
  });
});

describe('B5 a drug\'s TN on own tests reaches the roll', () => {
  test('previewModifiers and a rolled test carry it', async () => {
    const a = who({ drugs: [{ name: 'Zen', extra: { testsTn: 1 } }] });
    assert.deepEqual(a.previewModifiers({}).filter((m: any) => m.label === 'Zen'), [{ label: 'Zen', value: 1 }]);
    assert.ok(!a.previewModifiers({ noPenalties: true }).some((m: any) => m.label === 'Zen'));
    faces.push(1, 1, 1, 1);
    const r = await a.rollAttribute('body', { targetNumber: 4 });
    assert.equal(r.targetNumber, 5);
  });
});

describe('B6 helpless and held defenders', () => {
  test('paralysed: a ranged attack meets no dodge and no pool dice', async () => {
    const def = who();
    def.statuses.add('paralysis');
    await def.defend(shot(def), 3);
    const card = chat.at(-1);
    assert.match(card.content, /Defenseless \(paralysed\)/);
    assert.match(card.content, /data-sr2e-action="resist"/);
    assert.equal(def.system.poolSpent.combat, 0);
    assert.equal(faces.length, 0);
  });

  test('asleep or petrified: no opposed melee either', async () => {
    const def = who({}, [skill('u', 'Unarmed Combat', 4, 'strength')]);
    def.statuses.add('sleep');
    await def.defend(shot(def, { melee: true, weaponName: 'Katana', reach: 1, targetNumber: 4 }), 0);
    assert.match(chat.at(-1).content, /Defenseless \(asleep\)/);
    const stone = who();
    stone.statuses.add('sr2ePetrified');
    await stone.defend(shot(stone), 0);
    assert.match(chat.at(-1).content, /Defenseless \(turned to stone\)/);
  });

  test('restrained: no dodge against ranged, but melee is still opposed', async () => {
    const def = who({}, [skill('u', 'Unarmed Combat', 3, 'strength')]);
    def.statuses.add('restrain');
    await def.defend(shot(def), 2);
    assert.match(chat.at(-1).content, /Defenseless \(held: cannot dodge\)/);
    assert.equal(def.system.poolSpent.combat, 0);
    faces.push(2, 2, 2);
    await def.defend(shot(def, { melee: true, weaponName: 'Katana', reach: 0, attackSuccesses: 1, targetNumber: 4 }), 0);
    assert.match(chat.at(-1).content, /Melee defense/);
  });

  test('switched off: the old behaviour (a dodge)', async () => {
    const prev = RULES.FIXES_V70.helplessStatuses;
    RULES.FIXES_V70.helplessStatuses = [];
    try {
      const def = who();
      def.statuses.add('paralysis');
      faces.push(1, 1);
      await def.defend(shot(def), 2);
      assert.doesNotMatch(chat.at(-1).content, /Defenseless/);
    } finally { RULES.FIXES_V70.helplessStatuses = prev; }
  });
});

describe('B7 astral forms take no physical actions', () => {
  const projecting = () => who({ name: 'Mage', magic: 6, tradition: 'hermetic', astral: 'projecting' }, [skill('pis', 'Pistols', 4), skill('sorc', 'Sorcery', 4, 'willpower')]);

  test('a projecting magician: no attack, drive or first aid; astral actions still go', () => {
    const m = projecting();
    assert.equal(m.system.derived.astralMode, 'projecting');
    assert.match(m.astralOnly(), /is projecting/);
    assert.equal(m.canAct('attack'), false);
    assert.match(warnings.at(-1) ?? '', /Mage is projecting.*no attacks in the physical world/);
    assert.equal(m.canAct('drive'), false);
    assert.equal(m.canAct('give first aid'), false);
    assert.equal(m.canAct('astralAttack'), true);
    assert.equal(m.canAct('castSpell'), true);
    assert.equal(m.canAct('assense'), true);
    const body = who({ name: 'Mundane' });
    assert.equal(body.astralOnly(), '');
    assert.equal(body.canAct('attack'), true);
  });

  test('an unmaterialized spirit can\'t attack physically; a materialized one can', () => {
    const s = spirit(false, 'Ghost');
    assert.equal(s.astralOnly(), 'is not materialized');
    assert.equal(s.canAct('attack'), false);
    assert.equal(s.canAct('astralAttack'), true);
    assert.equal(spirit(true).canAct('attack'), true);
  });

  test('rollSkill: a Quickness skill is refused while projecting; a Willpower skill is not', async () => {
    const m = projecting();
    assert.equal(await m.rollSkill(m.items.get('pis'), { targetNumber: 4 }), null);
    assert.match(warnings.at(-1) ?? '', /no physical tests in the physical world/);
    faces.push(1, 1, 1, 1);
    const r = await m.rollSkill(m.items.get('sorc'), { targetNumber: 4 });
    assert.ok(r && typeof r.successes === 'number');
  });

  test('the sheet greys physical buttons, not magical ones', () => {
    for (const a of ['attackWeapon', 'firstAid', 'jackIn', 'driveVehicle', 'sneak']) assert.ok(ASTRAL_BLOCKED_ACTIONS.has(a), a);
    for (const a of ['castSpell', 'assense', 'astralAttack']) assert.ok(!ASTRAL_BLOCKED_ACTIONS.has(a), a);
  });

  test('switched off: projecting doesn\'t block', () => {
    RULES.FIXES_V70.astralBlocksPhysical = false;
    try { assert.equal(projecting().canAct('attack'), true); } finally { RULES.FIXES_V70.astralBlocksPhysical = true; }
  });
});

describe('B9 powers don\'t cross the astral/physical divide', () => {
  const power = { name: 'Engulf', system: { active: true, dice: 'force', rating: 0, tnSource: 'willpower', targetNumber: 4, resist: 'body', effect: 'damage', damageLevel: 'M', damageType: 'physical' } };

  test('an unmaterialized spirit can\'t use a power on a mundane', async () => {
    const s = spirit(false, 'Ghost');
    const v = who({ name: 'Victim' });
    assert.equal(await s.usePower(power, { targetUuid: v.uuid }), null);
    assert.match(warnings.at(-1) ?? '', /Ghost is not materialized: its powers can't reach Victim/);
  });

  test('a mundane critter can\'t reach an unmaterialized spirit', async () => {
    const critter = who({ name: 'Hellhound', type: 'npc' });
    const s = spirit(false, 'Ghost');
    assert.equal(await critter.usePower(power, { targetUuid: s.uuid }), null);
    assert.match(warnings.at(-1) ?? '', /Ghost is not materialized: only something on the astral plane can reach it/);
  });
});

describe('B12 per-decker sheaf launches', () => {
  test('each decker\'s step launches its own IC, once; kept as key|step on the host', async () => {
    const made: any[] = [];
    const prevImpl = g.Actor.implementation;
    g.Actor.implementation = { create: async (d: any) => { made.push(d); return { uuid: `Actor.ic${made.length}`, id: `ic${made.length}` }; } };
    const prevPer = RULES.MATRIX_V57.tally.perDecker;
    (RULES.MATRIX_V57.tally as any).perDecker = true;
    try {
      const h = new SR2Actor();
      const sys = Object.create(HostDataModel.prototype);
      Object.assign(sys, { securityCode: 'orange', securityValue: 5, subsystems: { access: 5, control: 5, index: 5, files: 5, slave: 5 }, tally: 0, alert: 'none', tallies: [], launchedSteps: [],
        sheaf: [{ step: 3, event: 'Blaster', alert: '', ic: { icType: 'Blaster', category: '', rating: 0, behavior: '', damageLevel: 'S', copies: 1 } }] });
      sys.prepareDerivedData();
      Object.assign(h, { type: 'host', name: 'Test host', uuid: 'Actor.v70host', system: sys, isOwner: true });
      uuidRegistry.set(h.uuid, h);
      // v0.81.1 (D3-7): a tally key must name a real decker (its name is read from it).
      for (const [u, name] of [['Actor.d1', 'Deck One'], ['Actor.d2', 'Deck Two']] as const) uuidRegistry.set(u, { uuid: u, name, documentName: 'Actor' });
      await SR2Actor.applyTallyCard(h.uuid, 4, { key: 'Actor.d1', name: 'Deck One' });
      assert.equal(made.length, 1);
      assert.deepEqual(h.getFlag('sr2e', 'sheafLaunched'), ['Actor.d1|3']);
      assert.deepEqual([...h.system.launchedSteps], [], 'the host-wide list is not used per decker');
      await SR2Actor.applyTallyCard(h.uuid, 4, { key: 'Actor.d2', name: 'Deck Two' });
      assert.equal(made.length, 2, 'a second decker reaching the step launches its own');
      assert.deepEqual(h.getFlag('sr2e', 'sheafLaunched'), ['Actor.d1|3', 'Actor.d2|3']);
      await SR2Actor.applyTallyCard(h.uuid, 2, { key: 'Actor.d1', name: 'Deck One' });
      assert.equal(made.length, 2, 'the first decker going further doesn\'t launch step 3 again');
    } finally { g.Actor.implementation = prevImpl; (RULES.MATRIX_V57.tally as any).perDecker = prevPer; }
  });
});

describe('B13 security responses set in a combat', () => {
  const site = () => {
    const s = new SR2Actor();
    const sys = Object.create(SiteDataModel.prototype);
    Object.assign(sys, { devices: [], tally: 0, alert: 'none', steps: [{ step: 2, event: 'Alarm', alert: 'active' }],
      response: { round: -1, worldTime: -1, arrived: false, force: 'Guard squad' }, riggerUuid: '', slaved: [], hostUuid: '' });
    sys.prepareDerivedData();
    Object.assign(s, { type: 'site', name: 'Ares lab', uuid: `Actor.v70site-${++n}`, system: sys, items: withGet([]) });
    uuidRegistry.set(s.uuid, s);
    return s;
  };

  test('a world-time deadline and the combat it was set in', async () => {
    g.game.time.worldTime = 1000;
    g.game.combat = { id: 'c1', started: true, round: 2 };
    const s = site();
    const note = await SR2Actor.applySiteChange(s.uuid, { add: 2 });
    assert.match(String(note), /the response arrives in Combat Turn 5/);
    assert.equal(s.system.response.round, 5);
    assert.equal(s.system.response.worldTime, 1000 + RULES.SECURITY.response.turns * RULES.COMBAT_TURN_SECONDS);
    assert.equal(s.getFlag('sr2e', 'responseCombat'), 'c1');
  });

  test('another combat reaching that Combat Turn doesn\'t bring it; its own combat does; world time does', async () => {
    g.game.time.worldTime = 1000;
    g.game.combat = { id: 'c1', started: true, round: 2 };
    const s = site();
    await SR2Actor.applySiteChange(s.uuid, { add: 2 });
    g.game.actors = [s];
    await SR2Actor.securityResponses({ round: 9, combatId: 'c2', anyGm: true, worldTime: 1000 });
    assert.equal(s.system.response.arrived, false);
    await SR2Actor.securityResponses({ round: 5, combatId: 'c1', anyGm: true, worldTime: 1000 });
    assert.equal(s.system.response.arrived, true);
    assert.match(chat.at(-1).content, /security response arrives at Ares lab/);
    // The fight ended first: the response still comes when world time passes the deadline.
    g.game.time.worldTime = 2000;
    g.game.combat = { id: 'c3', started: true, round: 1 };
    const t = site();
    await SR2Actor.applySiteChange(t.uuid, { add: 2 });
    delete g.game.combat;
    g.game.actors = [t];
    await SR2Actor.securityResponses({ worldTime: 2008 });
    assert.equal(t.system.response.arrived, false);
    await SR2Actor.securityResponses({ worldTime: 2009 });
    assert.equal(t.system.response.arrived, true);
  });

  test('outside combat: minutes of world time, no combat flag', async () => {
    g.game.time.worldTime = 50;
    const s = site();
    await SR2Actor.applySiteChange(s.uuid, { add: 2 });
    assert.equal(s.system.response.round, -1);
    assert.equal(s.system.response.worldTime, 50 + RULES.SECURITY.response.minutes * 60);
    assert.equal(s.getFlag('sr2e', 'responseCombat'), '');
  });

  test('a vehicle forgets its Combat Turn stamps when the combat is deleted', async () => {
    hooks.clear();
    chatMod.registerChatHandlers();
    const ups: any[] = [];
    const car: any = { type: 'vehicle', system: { speedTurn: { round: 3, start: 10, extra: 5 }, position: { round: 2, winnerUuid: 'x', loserUuid: 'y', tn: 4 }, currentSpeed: 40 },
      update: async (u: any) => { ups.push(u); } };
    const parked: any = { type: 'vehicle', system: { speedTurn: { round: -1 }, position: { round: -1 } }, update: async (u: any) => { ups.push(u); } };
    for (const fn of hooks.get('deleteCombat') ?? []) fn({ combatants: [{ actor: car }, { actor: parked }, { actor: who() }] });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(ups.length, 1);
    assert.deepEqual(ups[0]['system.speedTurn'], { round: -1, start: 40, extra: 0 });
    assert.deepEqual(ups[0]['system.position'], { winnerUuid: '', loserUuid: '', tn: 0, round: -1 });
  });
});

describe('B14 a lockdown and a host shutdown no longer set each other off', () => {
  test('the alert mapping', () => {
    assert.equal(hostAlertFor('lockdown'), 'active');
    assert.equal(siteAlertForHost('shutdown'), 'none');
    assert.equal(siteAlertForHost('active'), 'active');
    assert.equal(hostAlertFor('passive'), 'passive');
  });
});

describe('B15 dying on world time', () => {
  const dying = (extra: any = {}) => {
    const a = who({ name: 'Downed', monitor: { physical: 10, stun: 0 }, ...extra });
    g.game.actors.push(a);
    return a;
  };

  test('a box every Body × 3 seconds; the flag counts boxes, so the same time never adds twice', async (t) => {
    t.after(oldWay({ 'HEALTH_V923.bleed': 'bodyTurns' })); // v0.92.3: the old rate (the book's 10 minutes: v0923-health tests)
    const a = dying();
    assert.equal(a.system.derived.status, 'dying');
    a.flags.sr2e = { dyingAt: { t: 0, boxes: 0 } };
    const per = A.body * RULES.COMBAT_TURN_SECONDS;                        // Body 4: 12 s
    await SR2Actor.timedEffects({ worldTime: per - 1, anyGm: true });
    assert.equal(a.system.monitor.physical, 10);
    await SR2Actor.timedEffects({ worldTime: per, anyGm: true });
    assert.equal(a.system.monitor.physical, 11);
    await SR2Actor.timedEffects({ worldTime: per, anyGm: true });
    assert.equal(a.system.monitor.physical, 11, 'no double tick at the same time');
    assert.deepEqual(a.getFlag('sr2e', 'dyingAt'), { t: 0, boxes: 1 });
    await SR2Actor.timedEffects({ worldTime: 3 * per + 1, anyGm: true });
    assert.equal(a.system.monitor.physical, 13);
    assert.match(chat.at(-1).content, /Downed is dying and takes 2 more Physical boxes \(now 13\)/);
  });

  test('without a dyingAt flag the clock starts now', async () => {
    const a = dying();
    await SR2Actor.timedEffects({ worldTime: 500, anyGm: true });
    assert.deepEqual(a.getFlag('sr2e', 'dyingAt'), { t: 500, boxes: 0 });
    assert.equal(a.system.monitor.physical, 10);
  });

  test('a stabilised patient takes no boxes', async () => {
    const a = dying({ care: { stabilised: true, dyingSince: 0 } });
    a.flags.sr2e = { dyingAt: { t: 0, boxes: 0 } };
    await SR2Actor.timedEffects({ worldTime: 1000, anyGm: true });
    assert.equal(a.system.monitor.physical, 10);
  });

  test('natural healing is refused while dying and not stabilised', async () => {
    const a = dying();
    assert.equal(await a.naturalHeal({ track: 'physical', hours: 24 }), null);
    assert.match(warnings.at(-1) ?? '', /Downed is dying: stabilise them/);
  });

  test('new Physical damage on a stabilised dying patient clears stabilised and restarts the clock', async () => {
    g.game.time.worldTime = 77;
    const a = dying({ monitor: { physical: 11, stun: 0 }, care: { stabilised: true, dyingSince: 0 } });
    a.flags.sr2e = { dyingAt: { t: 0, boxes: 1 } };
    await a.syncCondition('dying', { physical: true, stun: false });
    assert.equal(a.system.care.stabilised, false);
    assert.deepEqual(a.getFlag('sr2e', 'dyingAt'), { t: 77, boxes: 0 });
    assert.match(chat.at(-1).content, /hurt again while dying: no longer stabilised/);
    // Stun only: still stabilised.
    const b = dying({ monitor: { physical: 11, stun: 2 }, care: { stabilised: true, dyingSince: 0 } });
    await b.syncCondition('dying', { physical: false, stun: true });
    assert.equal(b.system.care.stabilised, true);
  });
});

describe('B16 Stun past a full track carries its odd box', () => {
  test('addStun: 10 + 1 shows 11; the next Light Stun makes a Physical box', (t) => {
    // v0.92.3: by the book (Core p. 111) every box past the track is a Physical box; the carry is for the old 2:1.
    assert.deepEqual(addStun({ physical: 0, stun: 10 }, 1), { physical: 1, stun: 10 });
    t.after(oldWay({ STUN_OVERFLOW_PER_PHYSICAL_BOX: 2 }));
    assert.deepEqual(addStun({ physical: 0, stun: 10 }, 1), { physical: 0, stun: 11 });
    assert.deepEqual(addStun({ physical: 0, stun: 11 }, 1), { physical: 1, stun: 10 });
    assert.deepEqual(addStun({ physical: 2, stun: 9 }, 4), { physical: 3, stun: 11 });
    assert.deepEqual(addStun({ physical: 0, stun: 3 }, 2), { physical: 0, stun: 5 });
  });

  test('two Light Stun hits on a full track give one Physical box (applyDamageToMonitor)', (t) => {
    t.after(oldWay({ STUN_OVERFLOW_PER_PHYSICAL_BOX: 2 }));
    const one = applyDamageToMonitor({ physical: 0, stun: 10 }, 'stun', 'L', 4).monitor;
    const two = applyDamageToMonitor(one, 'stun', 'L', 4).monitor;
    assert.deepEqual(two, { physical: 1, stun: 10 });
  });

  test('switched off: the old floor (the odd box is lost)', (t) => {
    t.after(oldWay({ STUN_OVERFLOW_PER_PHYSICAL_BOX: 2 }));
    RULES.FIXES_V70.stunOverflowCarry = false;
    try {
      assert.deepEqual(addStun({ physical: 0, stun: 10 }, 1), { physical: 0, stun: 10 });
      assert.deepEqual(addStun({ physical: 0, stun: 10 }, 3), { physical: 1, stun: 10 });
    } finally { RULES.FIXES_V70.stunOverflowCarry = true; }
  });
});

describe('B17 lingering areas on world time', () => {
  test('a world-time end, in or out of combat', () => {
    const rounds = new Map<string, number>();
    assert.equal(canvasMod.areaExpired({ round: null, combatId: null, world: 100 }, { rounds, ms: 0, world: 99 }), false);
    assert.equal(canvasMod.areaExpired({ round: null, combatId: null, world: 100 }, { rounds, ms: 0, world: 100 }), true);
    assert.equal(canvasMod.areaExpired({ round: null, combatId: null, world: 100 }, { rounds, ms: 0, world: 250 }), true);
    // The combat it was drawn in being gone (or another one running) doesn't matter.
    assert.equal(canvasMod.areaExpired({ round: 3, combatId: 'c', world: 100 }, { rounds: new Map([['other', 9]]), ms: 9e12, world: 99 }), false);
    // No world time given: not yet.
    assert.equal(canvasMod.areaExpired({ round: null, combatId: null, world: 100 }, { rounds, ms: 9e12 }), false);
    // Old areas keep the old rules.
    assert.equal(canvasMod.areaExpired({ round: null, combatId: null, at: 5000 }, { rounds, ms: 6000, world: 0 }), true);
  });
});

describe('B18 Karma spends through the approval queue', () => {
  const mage = () => who({ name: 'Mage', magic: 6, tradition: 'hermetic', karma: { pool: 0, poolSpent: 0, good: 10, career: 10 }, metamagic: { quickening: true },
    sustaining: [{ spellName: 'Armor', force: 4, category: '', focusId: '', successes: 2, quickened: false }] }, [skill('sorc', 'Sorcery', 4, 'willpower')]);

  test('quicken files a request (with its Karma) instead of spending', async () => {
    settings['approvalQueue'] = true;
    g.game.user = PLAYER();
    const a = mage();
    assert.equal(await a.quicken(0), false);
    assert.equal(a.system.sustaining[0].quickened, false);
    assert.equal(a.system.karma.good, 10);
    const reqs = approvals.requestsOf(a);
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0]!.karma, 4);
    assert.deepEqual(reqs[0]!.data, { method: 'quicken', args: [0, 'Armor'] });
  });

  test('quicken spends with a ledger line; an approved request finds the spell by name', async () => {
    const a = mage();
    a.system.sustaining.unshift({ spellName: 'Light', force: 1, category: '', focusId: '', successes: 1, quickened: false });
    assert.equal(await a.quicken(0, 'Armor'), true);
    assert.equal(a.system.sustaining[1].quickened, true);
    assert.equal(a.system.sustaining[0].quickened, false);
    assert.equal(a.system.karma.good, 6);
    const line = a.system.ledger.at(-1);
    assert.equal(line.kind, 'karma');
    assert.equal(line.amount, -4);
    assert.match(line.reason, /Quickened Armor/);
  });

  const run = (extra: any = {}) => ({ jackedIn: false, hostUuid: '', monitor: 0, sim: 'cold', connection: 'jackpoint', crippled: { bod: 0, evasion: 0, masking: 0, sensors: 0 }, passed: [],
    trace: { active: false, icUuid: '', icName: '', mode: 'dump', rating: 0, hostUuid: '', round: -1, worldTime: -1 }, psyche: [],
    transit: { hostUuid: '', hops: 0, round: -1, worldTime: -1 }, relayKm: 0, numbers: [], channels: { access: 0, control: 0, index: 0, files: 0, slave: 0 }, jammed: { active: false, by: '', rating: 0 }, ...extra });
  const deck = { id: 'deck', type: 'cyberdeck', name: 'Deck', system: { active: true, mpcp: 6, bod: 4, evasion: 5, masking: 5, sensors: 4, hardening: 2, responseIncrease: 1, activeMemory: 900, storageMemory: 500, ioSpeed: 100, signal: 0, tortoise: false, living: true, damage: { mpcp: 0, bod: 0, evasion: 0, masking: 0, sensors: 0 }, files: [] } };
  const otaku = () => who({ name: 'Otaku', karma: { good: 20, pool: 0, poolSpent: 0, career: 20 }, matrix: run(), rigging: { vehicleUuid: '', jumpedIn: false, subscribed: [] } },
    [skill('sk', 'Computer', 5, 'intelligence'), deck], { body: 4, quickness: 5, strength: 3, charisma: 4, intelligence: 6, willpower: 5 });

  test('otaku channels and complex forms file requests', async () => {
    const old = RULES.MATRIX.otaku.enabled;
    (RULES.MATRIX.otaku as any).enabled = true;
    try {
      settings['approvalQueue'] = true;
      g.game.user = PLAYER();
      const a = otaku();
      assert.ok(a.system.derived.matrix?.living, 'a living persona');
      assert.equal(await a.raiseChannel('access'), false);
      assert.equal(a.system.matrix.channels.access, 0);
      assert.equal(await a.learnComplexForm({ kind: 'sleaze', rating: 3 }), null);
      assert.equal(a.items.length, 2);
      assert.equal(a.system.karma.good, 20);
      const reqs = approvals.requestsOf(a);
      assert.deepEqual(reqs.map((r) => (r.data as any).method).sort(), ['learnComplexForm', 'raiseChannel']);
      assert.ok(reqs.every((r) => r.karma > 0));
      // The GM (or the queue off): spent at once.
      g.game.user = GM();
      assert.equal(await a.raiseChannel('access'), true);
      assert.equal(a.system.matrix.channels.access, 1);
    } finally { (RULES.MATRIX.otaku as any).enabled = old; }
  });
});

describe('B19 fresh pools when a combat starts', () => {
  test('combatStart refreshes each combatant\'s pools once', async () => {
    hooks.clear();
    chatMod.registerChatHandlers();
    const calls: string[] = [];
    const a1 = { uuid: 'Actor.x', refreshPools: async () => { calls.push('x'); } };
    const a2 = { uuid: 'Actor.y', refreshPools: async () => { calls.push('y'); } };
    const start = hooks.get('combatStart') ?? [];
    assert.ok(start.length > 0);
    for (const fn of start) fn({ combatants: [{ actor: a1 }, { actor: a2 }, { actor: a1 }, { actor: null }] });
    assert.deepEqual(calls.sort(), ['x', 'y']);
    // A player's client doesn't.
    calls.length = 0;
    g.game.user = PLAYER();
    for (const fn of start) fn({ combatants: [{ actor: a1 }] });
    assert.deepEqual(calls, []);
    // Switched off.
    g.game.user = GM();
    RULES.FIXES_V70.poolsAtCombatStart = false;
    try { for (const fn of start) fn({ combatants: [{ actor: a1 }] }); } finally { RULES.FIXES_V70.poolsAtCombatStart = true; }
    assert.deepEqual(calls, []);
  });

  test.skip('the GM panel\'s Refresh Pools covers NPCs in the combat — SR2GmPanel.#onRefreshPools is private (ApplicationV2); live run', () => {});
});

describe('B20 slap patches on someone the player doesn\'t own', () => {
  const patcher = (kind: string, rating: number) => {
    const a = who({ name: 'Medic' });
    const it: any = { id: 'p1', type: 'gear', name: 'Tranq patch', system: { quantity: 2, patch: { kind, rating } } };
    it.update = async (d: any) => { for (const [k, v] of Object.entries(d)) setPath(it, k, v); };
    a.items = withGet([it]);
    return { a, it };
  };

  test('the patch is used and an Apply (GM) card carries it', async () => {
    g.game.user = PLAYER();
    g.game.users = Object.assign([GM(), PLAYER()], { activeGM: { id: 'gm1', isSelf: false } });
    const { a, it } = patcher('tranq', 6);
    const guard = who({ name: 'Guard', type: 'npc' });
    guard.isOwner = false;
    assert.equal(await a.applyPatch('p1', guard.uuid), true);
    assert.equal(it.system.quantity, 1);
    const card = chat.at(-1);
    assert.match(card.content, /data-sr2e-action="applyPatch"/);
    // v0.81.0: the patcher rides along (sourceUuid), so the GM's Apply is bound to the card's author.
    assert.deepEqual(card.flags.sr2e.patchApply, { targetUuid: guard.uuid, kind: 'tranq', rating: 6, name: 'Tranq patch', byName: 'Medic', sourceUuid: a.uuid });
    assert.deepEqual([...card.whisper].sort(), ['gm1', 'p1']);
    assert.equal(guard.system.monitor.stun, 0, 'nothing happens until the GM applies it');
    assert.ok(chatMod.GM_APPLY_ACTIONS['applyPatch'] === 'patchApplied');
    assert.deepEqual(chatMod.pendingGmApplies(card.content, () => false), ['applyPatch']);
  });

  test('patchEffect: tranq Stun spills past the track through addStun', async (tc) => {
    tc.after(oldWay({"BOOK_V78.patches.tranq": "body"})); // v0.78.0: the old rule (a house rule)
    tc.after(oldWay({ STUN_OVERFLOW_PER_PHYSICAL_BOX: 2 })); // v0.92.3: the old 2:1 (the book: box for box)
    const t = who({ name: 'Guard', monitor: { physical: 0, stun: 9 } });
    faces.push(1, 1, 1, 1);                                                // Body 4 vs 6: no successes, 6 boxes
    const text = await SR2Actor.patchEffect(t, { kind: 'tranq', rating: 6, name: 'Tranq patch' });
    assert.match(text, /6 Stun boxes/);
    assert.deepEqual({ ...t.system.monitor }, { physical: 2, stun: 11 });  // 15: 5 over → 2 Physical, 1 carried
  });

  test('patchEffect: a trauma patch on someone not dying does nothing', async () => {
    const t = who({ name: 'Fine' });
    assert.match(await SR2Actor.patchEffect(t, { kind: 'trauma', rating: 3, name: 'Trauma patch' }), /isn't dying/);
    assert.equal(t.system.care.stabilised, false);
  });
});

describe('B21 inline bare dice: "pool N" is ordinary dice', () => {
  test('6 pool 2 rolls 8 dice with no pool dice on the card', async () => {
    faces.push(5, 5, 1, 1, 1, 1, 1, 6, 2);
    const r = await inline.rollInlineSpec('6 pool 2', { actor: null, quick: true });
    assert.ok(r);
    assert.equal(r!.totalDice, 8);
    assert.equal(r!.successes, 3);
    assert.equal(faces.length, 0);
  });
});

describe('B22 the program sheet\'s Loaded box', () => {
  test.skip('loading through the item sheet goes through Swap Memory — SR2ItemSheet._processFormData needs ApplicationV2; live run', () => {});
});

// ---------------------------------------------------------------------------------------------------------------
// Fixes after the independent review of v0.70.0 (scratchpad review-v070.md) and the test plan's notes.

describe('review fixes: once per target per test, not per card', () => {
  const msg = (id: string, flags: any = {}) => ({ id, flags: { sr2e: flags }, getFlag(_s: string, k: string) { return this.flags.sr2e[k]; } });
  test('a defense on the first card counts on the Karma re-roll\'s card (and from the defender\'s keys)', () => {
    const first = msg('r1', { test: { testId: 'tz' }, defended: [1] });
    const reroll = msg('r2', { test: { testId: 'tz' } });
    g.game.messages = { contents: [first, reroll] };
    assert.deepEqual(chatMod.defendedOn(reroll), [1]);
    const d = { getFlag(_s: string, k: string) { return k === 'cardRolls' ? ['r1:defended:0'] : undefined; } };
    assert.deepEqual(chatMod.defendedOn(reroll, d).sort(), [0, 1]);
  });
});

describe('review fixes: astral forms and helpless defenders', () => {
  test('a projecting magician makes no Quickness attribute test; Willpower still rolls', async () => {
    const m = who({ name: 'Mage', magic: 6, tradition: 'hermetic', astral: 'projecting' });
    assert.equal(await m.rollAttribute('quickness', { targetNumber: 4 }), null);
    faces.push(1, 1, 1, 1, 1);
    const r = await m.rollAttribute('willpower', { targetNumber: 4 });
    assert.ok(r && typeof r.successes === 'number');
  });

  test('the older manifest switch still lets a manifested form act', () => {
    const m = who({ name: 'Mage', magic: 6, tradition: 'hermetic', astral: 'projecting', manifesting: true });
    const was = RULES.MAGIC_V56.manifest.blocksPhysical;
    const on = RULES.MAGIC_V56.manifest.enabled;
    (RULES.MAGIC_V56.manifest as any).enabled = true;
    (RULES.MAGIC_V56.manifest as any).blocksPhysical = false;
    try { assert.equal(m.canAct('attack'), true); } finally { (RULES.MAGIC_V56.manifest as any).blocksPhysical = was; (RULES.MAGIC_V56.manifest as any).enabled = on; }
  });

  test('a paralysed defender is helpless only while paralysis blocks actions; astral attacks are not affected', async () => {
    const def = who();
    def.statuses.add('paralysis');
    assert.equal(def.helplessStatus(), 'paralysed');
    const was = RULES.STATUSES.paralysis.blocksActions;
    (RULES.STATUSES.paralysis as any).blocksActions = false;
    try { assert.equal(def.helplessStatus(), ''); } finally { (RULES.STATUSES.paralysis as any).blocksActions = was; }
  });

  test('an astral user\'s power reaches a dual-natured critter', async () => {
    const s = spirit(false, 'Ghost');
    const critter = who({ name: 'Ghoul', type: 'npc' });
    critter.system.derived.dualNatured = true;
    critter.isAstral = () => false;
    const before = warnings.length;
    faces.push(1, 1, 1, 1);
    await s.usePower({ name: 'Fear', system: { active: true, dice: 'force', rating: 0, tnSource: 'willpower', targetNumber: 4, resist: 'willpower', effect: 'damage', damageLevel: 'M', damageType: 'stun' } }, { targetUuid: critter.uuid });
    assert.ok(!warnings.slice(before).some((w) => /can't reach/.test(w)), warnings.slice(before).join(' | '));
  });

  test('guards still spot an intruder who is down (sneakPast no longer refuses)', async () => {
    // v0.81.0 (D1-7): someone down can't choose to sneak, but watchers (guardsWatch: `watched`) still look; the
    // intruder rolls no Stealth, so a guard with a success spots them.
    const intruder = who({ name: 'Down', monitor: { physical: 0, stun: 10 } }, [skill('st', 'Stealth', 3)]);
    const guard = who({ name: 'Guard', type: 'npc' });
    faces.push(5, 5, 5, 5, 5, 5, 5, 5, 5, 5);
    const res = await intruder.sneakPast([guard.uuid], { watched: true });
    assert.equal(res.length, 1);
    assert.equal(res[0].noticed, true);
  });
});

describe('review fixes: lingering areas have a real-time backstop', () => {
  test('a world-time cloud also goes when its real-time backstop passes', () => {
    const rounds = new Map<string, number>();
    assert.equal(canvasMod.areaExpired({ round: null, combatId: null, world: 100, at: 5000 }, { rounds, ms: 4000, world: 0 }), false);
    assert.equal(canvasMod.areaExpired({ round: null, combatId: null, world: 100, at: 5000 }, { rounds, ms: 6000, world: 0 }), true);
  });
});
