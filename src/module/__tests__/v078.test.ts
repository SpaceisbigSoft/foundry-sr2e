/**
 * v0.78.0: the book check's rules changes and the owner's decisions (RULES.BOOK_V78), the Foundry glue side:
 * documents/index.ts and models/index.ts. The pure rules are in rules/__tests__/v078.test.ts. The stubs are a copy
 * of v073.test.ts's (scripted dice, a chat log of message objects with getFlag, warnings). These check OUR wiring,
 * not that Foundry behaves as the stubs do.
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../rules/index.ts';
import { oldWay } from '../rules/__tests__/oldway.ts';

const g = globalThis as any;
const faces: number[] = [];
const chat: any[] = [];
const warnings: string[] = [];
const infos: string[] = [];
const uuidRegistry = new Map<string, any>();
const created: any[] = [];
const hooks = new Map<string, Array<(...a: any[]) => any>>();
let settings: Record<string, unknown> = {};
let mid = 0;

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

let CharacterDataModel: any, SiteDataModel: any, SR2Actor: any;

const GM = () => ({ id: 'gm1', name: 'GM', isGM: true, can: () => true });

/** A chat message as Foundry gives it back: an id and getFlag. */
const asMessage = (d: any) => ({ id: `m${++mid}`, timestamp: mid, ...d, getFlag(s: string, k: string) { return this.flags?.[s]?.[k]; }, async setFlag(s: string, k: string, v: any) { ((this.flags ??= {})[s] ??= {})[k] = v; } });

before(async () => {
  // As in glue.test.ts and v072.test.ts: rules that add steps or prompts are off unless a test turns them on.
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
      setProperty: (o: any, p: string, v: unknown) => { setPath(o, p, v); return true; },
    },
    applications: { api: { DialogV2: { confirm: async () => false, prompt: async () => null, wait: async () => null } } },
  };
  g.Roll = StubRoll;
  g.ChatMessage = { create: async (d: any) => { const m = asMessage(d); chat.push(m); return m; }, getSpeaker: () => ({}) };
  g.Hooks = { on: (h: string, fn: any) => { if (!hooks.has(h)) hooks.set(h, []); hooks.get(h)!.push(fn); }, once: () => {}, callAll: () => {} };
  g.game = {
    i18n: { localize: (k: string) => k }, user: GM(), users: Object.assign([GM()], { activeGM: { id: 'gm1', isSelf: true } }),
    time: { worldTime: 0 }, settings: { get: (_s: string, k: string) => settings[k], set: async () => {}, register: () => {} },
    actors: [], messages: { contents: [] },
  };
  g.fromUuidSync = (u: string) => uuidRegistry.get(u) ?? null;
  g.fromUuid = async (u: string) => uuidRegistry.get(u) ?? null;
  g.ui = { notifications: { warn: (m: string) => { warnings.push(m); }, info: (m: string) => { infos.push(m); }, error: () => {} } };
  g.Actor = class {
    items: any[] = []; system: any; flags: any = {}; isOwner = true; ownership: any = { default: 0 };
    getFlag(scope: string, key: string) { return this.flags[scope]?.[key]; }
    async setFlag(scope: string, key: string, v: any) { (this.flags[scope] ??= {})[key] = v; }
    async unsetFlag(scope: string, key: string) { if (this.flags[scope]) delete this.flags[scope][key]; }
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); this.system.parent ??= this; this.system.prepareDerivedData?.(); }
    async createEmbeddedDocuments(_t: string, docs: any[]) { let n = this.items.length; const made = docs.map((d) => ({ id: `i${n++}`, ...d, system: { ...d.system } })); this.items.push(...made); this.system.prepareDerivedData?.(); return made; }
    async updateEmbeddedDocuments(_t: string, ups: any[]) { for (const u of ups) { const it = this.items.find((i) => i.id === u._id); if (it) Object.assign(it.system, u.system); } this.system.prepareDerivedData?.(); }
  };
  (g.Actor as any).implementation = { create: async (d: any) => { created.push(d); return { uuid: `Actor.made${created.length}`, ...d }; } };
  g.Item = class {};
  g.Combatant = class { actor: any; };
  g.Combat = class { combatants: any[] = []; flags: any = {}; getFlag(_s: string, k: string) { return this.flags[k]; } async setFlag(_s: string, k: string, v: any) { this.flags[k] = v; } };
  ({ CharacterDataModel, SiteDataModel } = await import('../models/index.ts'));
  ({ SR2Actor } = await import('../documents/index.ts'));
  g.CONFIG = { Actor: { documentClass: SR2Actor } };
});

beforeEach(() => {
  faces.length = 0; chat.length = 0; warnings.length = 0; infos.length = 0; created.length = 0; settings = {};
  hooks.clear();
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
  const { name, type, flags, ...rest } = extra;
  Object.assign(sys, {
    essence: 6, magic: 0, reactionBonus: 0, initiativeDiceBonus: 0, karma: { pool: 0, poolSpent: 0, good: 30, career: 30 }, metamagic: {}, initiateGrade: 0,
    nuyen: 0, sustaining: [], drugs: [], geasa: [], ledger: [], recovering: [], diseases: [], care: { stabilised: false, dyingSince: -1 }, contacts: [],
    addictions: [], anchored: [], qualities: [], lifestyle: { level: 'low', paidUntil: -1, outright: false }, training: [], metatype: 'human', racialModifiers: true,
    poolSpent: { combat: 0, spell: 0, hacking: 0, control: 0 }, monitor: { physical: 0, stun: 0 }, rigging: { vehicleUuid: '', jumpedIn: false, subscribed: [] }, ...rest,
  });
  const a = new SR2Actor();
  a.system = sys;
  a.name = name ?? 'Runner'; a.type = type ?? 'character';
  a.uuid = `Actor.v78-${++n}`; a.id = `id${n}`;
  if (flags) a.flags = flags;
  a.items = withGet(items.map((it) => ({ ...it, system: { ...it.system }, parent: a, toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, system: this.system, _id: this.id })); },
    async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); a.system.prepareDerivedData(); } })));
  a.statuses = new Set<string>();
  a.system.parent = a; a.system.prepareDerivedData();
  uuidRegistry.set(a.uuid, a);
  return a;
}
const skill = (id: string, name: string, rating: number, attribute = 'quickness', more: any = {}) => ({ id, type: 'skill', name, system: { rating, attribute, kind: 'active', specialization: '', specializationRating: 0, ...more } });


const bio = (id: string, name: string, bioKind: string, rating: number, bodyIndex = 0.4) => ({ id, type: 'cyberware', name,
  system: { bioware: true, bioKind, rating, bodyIndex, installed: true, essenceCost: 0, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0 } });
/** Token statuses on the stub actor (toggleStatusEffect adds or removes). */
const withStatuses = (a: any) => { a.toggleStatusEffect = async (id: string, o: any) => { if (o?.active === false) a.statuses.delete(id); else a.statuses.add(id); }; return a; };
/** setFlag that re-derives, as a real update does. */
const derivingFlags = (a: any) => { const set = a.setFlag.bind(a); a.setFlag = async (s2: string, k: string, v: any) => { await set(s2, k, v); a.system.prepareDerivedData(); }; return a; };

describe('v0.78.0 legwork (BOOK_V78.legwork)', () => {
  test('a closer contact adds dice; a fixer takes 3 off the TN', async () => {
    const a = who({ name: 'Face', contacts: [{ id: 'c1', name: 'Smiley', level: 3, loyalty: 1, fee: 0, dice: 0, favours: 0, role: 'Fixer' }] }, [skill('et', 'Etiquette', 3, 'charisma')]);
    faces.push(3, 3, 2, 2, 1);                                         // Etiquette 3 + friend for life 2 vs 6 − 3
    const r = await a.legwork('c1', { difficultyTn: 6, fixer: true });
    assert.equal(r.successes, 2);
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /Friend for life \+2/);
  });
});

describe('v0.78.0 flash grenades (BOOK_V78.flash)', () => {
  test('a TN for 5 Combat Turns less the Body test, not blindness; the 5L blast still hits within 1 m', async () => {
    const thrower = who({ name: 'Thrower' });
    const far = withStatuses(who({ name: 'Far' }, [], { ...A, body: 4 }));
    const near = withStatuses(who({ name: 'Near' }, [], { ...A, body: 3 }));
    faces.push(5, 1, 1, 1);                                            // Far: Body 4 vs 5: 1 success → 5 turns
    faces.push(5, 5, 1);                                               // Near: Body 3 vs 5: 2 successes → 4 turns
    await thrower.postBlast({ kind: 'flash', power: 5, perMetre: 5, level: 'L', damageType: 'physical', weaponName: 'Flash-bang', attackerUuid: thrower.uuid } as any,
      [{ targetUuid: far.uuid, name: 'Far', metres: 12 }, { targetUuid: near.uuid, name: 'Near', metres: 0 }], 'It lands.');
    assert.equal(faces.length, 0);
    assert.ok(far.statuses.has('blind'));
    assert.deepEqual(far.blindMods('attack'), [{ id: 'flash', label: 'Flash', value: 4 }]);
    assert.deepEqual(far.blindMods('other'), [{ id: 'flash', label: 'Flash', value: 4 }]);
    assert.deepEqual(near.blindMods('spell'), [{ id: 'flash', label: 'Flash', value: 6 }]);
    const flashCard = chat.find((m) => /\+4 TN<\/strong> for 5 Combat Turns/.test(m.content));
    assert.ok(flashCard);
    assert.match(chat.at(-1).content, /detonation/);
    assert.deepEqual(chat.at(-1).flags.sr2e.damages.map((d: any) => d.targetUuid), [near.uuid]);
  });
  test('the old way: blinded, no Body test', async (t) => {
    t.after(oldWay({ 'BOOK_V78.flash.mode': 'blind' }));
    const thrower = who({ name: 'Thrower' });
    const v = withStatuses(who({ name: 'Victim' }));
    await thrower.postBlast({ kind: 'flash', power: 5, perMetre: 5, level: 'L', damageType: 'physical', weaponName: 'Flash-bang', attackerUuid: thrower.uuid } as any, [{ targetUuid: v.uuid, name: 'Victim', metres: 0 }], 'It lands.');
    assert.equal(faces.length, 0);
    assert.deepEqual(v.blindMods('attack'), [{ id: 'blinded', label: 'Blinded', value: RULES.STATUSES.blind.attackTn }]);
  });
});

describe('v0.78.0 the monofilament whip check', () => {
  test('no successes vs 6: struck by the whip, impact armor halved', async () => {
    const a = who({ name: 'Whipper' }, [skill('wh', 'Whips', 3)]);
    faces.push(5, 2, 1);
    await a.rollWhipCheck({ skill: 'Whips', power: 10, level: 'S', damageType: 'physical', weaponName: 'Monowhip' });
    assert.match(chat.at(-1).content, /Struck by the whip/);
    assert.deepEqual([chat.at(-1).flags.sr2e.damage.targetUuid, chat.at(-1).flags.sr2e.damage.armorKind, chat.at(-1).flags.sr2e.damage.armorMultiplier], [a.uuid, 'impact', 0.5]);
    faces.push(6, 1, 1, 1);
    await a.rollWhipCheck({ skill: 'Whips', power: 10, level: 'S', damageType: 'physical', weaponName: 'Monowhip' });
    assert.match(chat.at(-1).content, /Under control/);
    assert.equal(chat.at(-1).flags.sr2e.damage, undefined);
  });
});

describe('v0.78.0 slap patches (BOOK_V78.patches)', () => {
  test('stim: back in 2D6 minutes; tranq: opposed', async () => {
    const p = who({ name: 'Patient', monitor: { physical: 0, stun: 5 } }, [], { ...A, body: 4 });
    faces.push(3, 4);                                                  // 2D6 = 7 minutes
    const text = await SR2Actor.patchEffect(p, { kind: 'stim', rating: 3, name: 'Stim 3' });
    assert.match(text, /7 minutes/);
    assert.equal(p.system.monitor.stun, 2);
    assert.equal(p.getFlag('sr2e', 'stimDebt')[0].at, 420);
    faces.push(4, 4, 4, 1, 1);                                         // the patch: 5 dice vs Body 4: 3
    faces.push(5, 1, 1, 1);                                            // Body 4 vs 5: 1
    const t2 = await SR2Actor.patchEffect(p, { kind: 'tranq', rating: 5, name: 'Tranq 5' });
    assert.match(t2, /2 Stun boxes/);
    assert.equal(p.system.monitor.stun, 4);
    assert.equal(faces.length, 0);
  });
});

describe('v0.78.0 toxins: bioware Power and critter immunity (BOOK_V78.toxinBioware, critterToxins)', () => {
  test('a toxin extractor lowers an injected toxin’s Power', async () => {
    const a = who({ name: 'Chromed' }, [bio('tx', 'Toxin extractor 4', 'toxinExtractor', 4, 0.6)], { ...A, body: 4 });
    faces.push(4, 4, 1, 1);                                            // Body 4 vs 6 − 2
    await a.resistToxin({ name: 'Narcoject', vector: 'injection', power: 6, level: 'S', damageType: 'stun' });
    assert.match(chat.at(-1).content, /toxin extractor −2 Power/);
    assert.equal(chat.at(-1).flags.sr2e.test.targetNumber, 4);
    assert.equal(chat.at(-1).flags.sr2e.test.successes, 2);
  });
  test('immunity to poisons: + 2 × Essence dice, not a stop', async () => {
    const c = who({ name: 'Ghoul', type: 'npc', essence: 3 }, [{ id: 'im', type: 'power', name: 'Immunity', system: { active: false, special: 'immunity', substance: 'poisons' } }], { ...A, body: 4 });
    faces.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1);                          // Body 4 + 6
    await c.resistToxin({ name: 'Neuro-stun', vector: 'inhalation', power: 6, level: 'M', damageType: 'stun' });
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /immunity to poisons \+6/);
  });
});

describe('v0.78.0 symbiotes shorten natural healing (BOOK_V78.symbiotes)', () => {
  test('time × 0.7 at level 2, no dice', async () => {
    const a = who({ name: 'Patient', monitor: { physical: 0, stun: 3 } }, [bio('sy', 'Symbiotes 2', 'symbiotes', 2, 0.7)]);
    faces.push(5, 5, 1, 1);                                            // Body 4, no symbiote dice
    await a.naturalHeal({ track: 'stun', hours: 100 });
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /symbiotes: time ×0\.7/);
    assert.equal(chat.at(-1).flags.sr2e.test.heal.timeFactor, 0.7);
  });
});

describe('v0.78.0 the encephalon (BOOK_V78.encephalon)', () => {
  test('a Task Pool; the Intelligence bonus when defaulting; the pool is not used up outside combat', async () => {
    const a = who({ name: 'Brain' }, [{ id: 'en', type: 'cyberware', name: 'Encephalon 3', system: { kind: 'encephalon', rating: 3, installed: true, essenceCost: 1.5, grade: 'standard', attributes: {}, reaction: 0, initiativeDice: 0 } },
      skill('chem', 'Chemistry', 0, 'intelligence', { kind: 'knowledge' }), skill('cmp', 'Computer', 3, 'intelligence')]);
    assert.deepEqual([a.system.derived.taskPool, a.system.derived.taskPoolLeft], [2, 2]);
    faces.push(1, 1, 1, 1, 1, 1, 1);                                   // Intelligence 5 + 2 (defaulting)
    await a.rollSkill(a.items.get('chem'), { targetNumber: 4 });
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /encephalon Intelligence \+2/);
    faces.push(1, 1, 1, 1, 1);                                         // Computer 3 + 2 Task Pool dice
    await a.rollSkill(a.items.get('cmp'), { targetNumber: 4, pool: 'task', poolDice: 2 });
    assert.equal(faces.length, 0);
    assert.equal(a.system.poolSpent.task ?? 0, 0);
  });
});

describe('v0.78.0 power foci and Combat Sense in the pools (BOOK_V78.powerFocus, combatSense)', () => {
  test('a power focus raises the Spell Pool and the drain Magic', () => {
    const m = who({ name: 'Mage', magic: 6, tradition: 'hermetic' }, [{ id: 'pf', type: 'focus', name: 'Power focus', system: { focusType: 'power', rating: 2, active: true, bonded: true, category: '', target: '' } }]);
    const plain = who({ name: 'Mage2', magic: 6, tradition: 'hermetic' });
    assert.equal(m.system.derived.spellPool, plain.system.derived.spellPool + 2);
    assert.equal(m.system.derived.drainMagic, m.system.derived.magic + 2);
  });
  test('Combat Sense adds its level to the Combat Pool', () => {
    const ad = who({ name: 'Adept', magic: 6, tradition: 'adept' }, [{ id: 'cs', type: 'adeptpower', name: 'Combat Sense', system: { active: true, level: 2, special: 'combatSense', cost: 3 } }]);
    const plain = who({ name: 'Adept2', magic: 6, tradition: 'adept' });
    assert.equal(ad.system.derived.combatPool, plain.system.derived.combatPool + 2);
  });
});

describe('v0.78.0 Paralyzing Touch drains Quickness (BOOK_V78.paralysis)', () => {
  test('−Essence Quickness for the rolled minutes; paralysed at 0; it wears off', async () => {
    const fx = SR2Actor.fxEntry({ name: 'Paralyzing Touch', attributes: {}, perSuccess: false, kind: 'power', force: 8, essence: 5, special: 'paralysis', minutes: 7 }, 2, 'fx1', 'Actor.ghoul', 'Ghoul');
    assert.deepEqual([fx.attributes.quickness, fx.until.worldTime, fx.status], [-5, 420, undefined]);
    const v = derivingFlags(withStatuses(who({ name: 'Victim' })));
    await SR2Actor.setPowerEffect(v.uuid, fx);
    assert.equal(v.system.attributes.quickness.total, 0);
    assert.ok(v.statuses.has('paralysis'));
    g.game.actors = [v];
    await SR2Actor.timedEffects({ worldTime: 300, anyGm: true });
    assert.equal((v.getFlag('sr2e', 'powerEffects') ?? []).length, 1);  // not yet (7 minutes = 420 s)
    await SR2Actor.timedEffects({ worldTime: 500, anyGm: true });
    assert.equal((v.getFlag('sr2e', 'powerEffects') ?? []).length, 0);
    assert.equal(v.system.attributes.quickness.total, 5);
    assert.ok(!v.statuses.has('paralysis'));
    assert.ok(chat.some((m) => /Paralyzing Touch wears off/.test(m.content)));
  });
});

describe('v0.78.0 allergies add weapon Power (BOOK_V78.allergy)', () => {
  test('a Severe allergy: the weapon’s Power +2', async () => {
    const c = who({ name: 'Wendigo', type: 'npc' }, [{ id: 'al', type: 'power', name: 'Allergy (silver)', system: { active: false, special: 'allergy', substance: 'silver', severity: 'severe' } }]);
    faces.push(1, 1, 1, 1);
    await c.resistFromState({ targetUuid: c.uuid, melee: true, damageType: 'physical', power: 6, level: 'M', material: 'silver' } as any);
    assert.ok(chat.some((m) => /Power \+2 \(now 8\)/.test(m.content)));
  });
});

describe('v0.78.0 barrier damage and doors (BOOK_V78.barriers)', () => {
  test('gunfire against a doubled rating; an ordinary door breaks at half', async () => {
    const wall: any = { door: 1, move: 20, sight: 20, light: 20, sound: 20, flags: { sr2e: { barrierRating: 6 } },
      getFlag(s2: string, k: string) { return this.flags[s2]?.[k]; }, async update(d: any) { for (const [k, v] of Object.entries(d)) setPath(this, k, v); } };
    const r1 = await SR2Actor.damageWall(wall, 7, { label: 'Door' });
    assert.deepEqual(r1, { damage: 1, left: 5, breached: false });
    assert.match(chat.at(-1).content, /12 against gunfire/);
    await SR2Actor.damageWall(wall, 7, { label: 'Door' });
    await SR2Actor.damageWall(wall, 7, { label: 'Door' });
    assert.equal(wall.flags.sr2e.barrierRating, 3);
    assert.ok(wall.flags.sr2e.breached);
    assert.match(chat.at(-1).content, /The door breaks/);
  });
});

describe('v0.78.0 tamper alarms and voice locks at a site (BOOK_V78.tamper, voiceLocks)', () => {
  const site = (devices: any[]) => {
    const s = new SR2Actor();
    const sys = Object.create(SiteDataModel.prototype);
    Object.assign(sys, { devices, tally: 0, alert: 'none', steps: [], response: { round: -1, worldTime: -1, arrived: false, force: '' }, riggerUuid: '', slaved: [], hostUuid: '', guards: [] });
    sys.prepareDerivedData?.();
    Object.assign(s, { type: 'site', name: 'Lab', uuid: `Actor.v78site-${++n}`, system: sys, items: withGet([]) });
    sys.parent = s;
    uuidRegistry.set(s.uuid, s);
    return s;
  };
  const dev = (id: string, extra: any = {}) => ({ id, name: id, kind: 'maglock', rating: 4, tokenUuid: '', sceneId: '', wallId: '', active: true, bypassed: false, scanKind: '', sense: '', tamper: 0, identifies: false, notes: '', casing: 0, casingOpen: false, lockType: '', ...extra });
  test('the anti-tamper rating adds to the casing TN; no successes trips it', async () => {
    const s = site([dev('lock', { casing: 3, tamper: 2 })]);
    const thief = who({ name: 'Thief' }, [skill('el', 'Electronics B/R', 3, 'intelligence', { kind: 'buildRepair' }), skill('e2', 'Electronics', 3, 'intelligence')]);
    faces.push(4, 4, 1);                                               // 3 dice vs casing 3 + tamper 2 = 5: none
    await thief.bypassLock(s, 'lock');
    assert.equal(faces.length, 0);
    assert.equal(chat.find((m) => m.flags?.sr2e?.test)?.flags.sr2e.test.targetNumber, 5);
    assert.ok(chat.some((m) => /anti-tamper alarm trips/i.test(m.content)));
    assert.deepEqual({ tally: s.system.tally, alert: s.system.alert }, { tally: RULES.SECURITY.tamper.tally, alert: 'active' });
  });
  test('a voice lock: no device, no bypass; a recorder against the lock', async () => {
    const s = site([dev('voice', { lockType: 'voice', rating: 4 })]);
    const thief = who({ name: 'Mimic' }, [skill('e2', 'Electronics', 6, 'intelligence')]);
    assert.equal(await thief.bypassLock(s, 'voice'), null);
    assert.ok(warnings.some((w) => /voice-deception device/.test(w)));
    const t2 = who({ name: 'Mimic2' }, [{ id: 'rec', type: 'gear', name: 'Recorder', system: { quantity: 1, bypassTool: { kind: 'voiceDeception', rating: 5 } } }]);
    faces.push(5, 5, 5, 1, 1);                                         // the recorder: 5 dice vs the lock's 4: 3
    faces.push(5, 5, 1, 1);                                            // the lock: 4 dice vs the recorder's 5: 2
    await t2.bypassLock(s, 'voice');
    assert.equal(faces.length, 0);
    assert.equal(s.system.devices[0].bypassed, true);
    assert.ok(chat.some((m) => /accepts the voice/.test(m.content)));
  });
});

describe('v0.78.0 review fixes', () => {
  test('a paralysis drain is not a sustained power (the critter going down does not end it)', async () => {
    const ghoul = who({ name: 'Ghoul', type: 'npc' });
    const v = derivingFlags(withStatuses(who({ name: 'Victim2' })));
    g.game.actors = [ghoul, v];
    const fx = SR2Actor.fxEntry({ name: 'Paralyzing Touch', attributes: {}, perSuccess: false, kind: 'power', force: 3, essence: 3, special: 'paralysis', minutes: 5 }, 1, 'fx2', ghoul.uuid, 'Ghoul');
    await SR2Actor.setPowerEffect(v.uuid, fx);
    assert.deepEqual(SR2Actor.powerEffectsFrom([ghoul.uuid]), []);
  });
  test('immunity to poisons no longer stops a drug dose (the book: dice, not a stop)', async () => {
    // Immunity to poisons alone no longer stops a dose (the book: dice, not a stop).
    const p2 = who({ name: 'Ghoul3', type: 'npc' }, [{ id: 'im', type: 'power', name: 'Immunity', system: { active: false, special: 'immunity', substance: 'poisons' } },
      { id: 'dr', type: 'gear', name: 'Jazz', system: { quantity: 2, toxin: { kind: 'drug', durationMinutes: 10, vector: 'ingestion', power: 0, level: 'L', damageType: 'stun', speed: 'immediate' } } }]);
    await p2.takeDrug('dr');
    assert.ok(!chat.some((m) => /immune, it has no effect/.test(m.content)));
  });
  test('a rejected voice adds the failed-bypass tally', async () => {
    const s2 = new SR2Actor();
    const sys = Object.create(SiteDataModel.prototype);
    Object.assign(sys, { devices: [{ id: 'v', name: 'Voice', kind: 'maglock', rating: 4, lockType: 'voice', tamper: 0, casing: 0, casingOpen: false, active: true, bypassed: false, tokenUuid: '', sceneId: '', wallId: '', sense: '', scanKind: '', notes: '' }], tally: 0, alert: 'none', steps: [], response: { round: -1, worldTime: -1, arrived: false, force: '' }, riggerUuid: '', slaved: [], hostUuid: '', guards: [] });
    sys.prepareDerivedData?.();
    Object.assign(s2, { type: 'site', name: 'Lab2', uuid: `Actor.v78site-x${++n}`, system: sys, items: withGet([]) });
    sys.parent = s2; uuidRegistry.set(s2.uuid, s2);
    const t2 = who({ name: 'Mimic3' }, [{ id: 'rec', type: 'gear', name: 'Recorder', system: { quantity: 1, bypassTool: { kind: 'voiceDeception', rating: 3 } } }]);
    faces.push(5, 1, 1);                                               // the recorder: 1 success
    faces.push(5, 5, 1, 1);                                            // the lock: 2
    await t2.bypassLock(s2, 'v');
    assert.equal(faces.length, 0);
    assert.equal(s2.system.devices[0].bypassed, false);
    assert.equal(s2.system.tally, RULES.SECURITY.bypass.failTally);
  });
  test('immunity to pathogens helps on the disease progress test', async () => {
    const c = who({ name: 'Ghoul2', type: 'npc', essence: 2, diseases: [{ name: 'Rot', power: 6, level: 'M', damageType: 'physical', intervalHours: 24, needed: 3, treated: false }] },
      [{ id: 'im', type: 'power', name: 'Immunity', system: { active: false, special: 'immunity', substance: 'pathogens' } }], { ...A, body: 3 });
    faces.push(1, 1, 1, 1, 1, 1, 1);                                   // Body 3 + 4
    await c.rollDiseaseTick(0);
    assert.equal(faces.length, 0);
    assert.match(chat.at(-1).content, /immunity to pathogens \+4/);
  });
  test('a flash leaves someone already blind as they are', async () => {
    const thrower = who({ name: 'Thrower2' });
    const blind = withStatuses(who({ name: 'Blind' }));
    blind.statuses.add('blind');
    await thrower.postBlast({ kind: 'flash', power: 5, perMetre: 5, level: 'L', damageType: 'physical', weaponName: 'Flash-bang', attackerUuid: thrower.uuid } as any, [{ targetUuid: blind.uuid, name: 'Blind', metres: 3 }], 'It lands.');
    assert.equal(faces.length, 0);
    assert.ok(chat.some((m) => /already blind/.test(m.content)));
    assert.deepEqual(blind.blindMods('attack'), [{ id: 'blinded', label: 'Blinded', value: RULES.STATUSES.blind.attackTn }]);
  });
});
