/**
 * v0.60.0: Token Action HUD support: the pure layout and action-list builder (rules/hudactions.ts), and
 * that the glue only registers a hook (safe without TAH installed).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hudActions, hudMultiActions, hudDefaults, hudWeaponInfo, hudDamageLabel, encodeHudAction, decodeHudValue, findHudAction,
  HUD_GROUPS, HUD_LAYOUT, type HudActorSummary, type HudAction,
} from '../rules/hudactions.ts';

const attrs = { body: { total: 5 }, quickness: { total: 6 }, strength: { total: 4 }, charisma: { total: 3 }, intelligence: { total: 5 }, willpower: { total: 4 } };

function runner(over: Partial<HudActorSummary> = {}): HudActorSummary {
  return {
    type: 'character',
    name: 'Spike',
    attributes: attrs,
    derived: { reaction: 5, initiativeDice: 1, magic: 0, essence: 5.8, astralMode: 'physical' },
    items: [
      { id: 'sk1', type: 'skill', name: 'Firearms', system: { rating: 5, kind: 'active', specialization: 'Pistols', specializationRating: 7 } },
      { id: 'sk2', type: 'skill', name: 'Etiquette', system: { rating: 3, kind: 'active' } },
      { id: 'sk3', type: 'skill', name: 'Seattle Gangs', system: { rating: 4, kind: 'knowledge' } },
      { id: 'sk4', type: 'skill', name: 'Japanese', system: { rating: 2, kind: 'language' } },
      { id: 'w1', type: 'weapon', name: 'Ares Predator', img: 'pred.png', system: { ammo: 8, ammoMax: 15, modes: 'SA', damagePower: 9, damageLevel: 'M', damageType: 'physical' } },
      { id: 'w2', type: 'weapon', name: 'Katana', system: { melee: true, damagePower: 3, damageLevel: 'M', strengthPower: true } },
      { id: 'g1', type: 'gear', name: 'Medkit', system: {} },
    ],
    flags: {},
    ...over,
  };
}

const ids = (list: HudAction[]) => list.map((a) => a.id);
const inGroup = (list: HudAction[], g: string) => list.filter((a) => a.groupId === g);
const byId = (list: HudAction[], id: string) => list.find((a) => a.id === id);

describe('v0.60.0 Token Action HUD layout', () => {
  test('every layout group exists, nestIds are tab_group, group ids never equal a tab id', () => {
    const d = hudDefaults();
    assert.equal(d.layout.length, HUD_LAYOUT.length);
    const tabIds = new Set(HUD_LAYOUT.map((t) => t.id));
    for (const tab of d.layout) {
      assert.equal(tab.nestId, tab.id);
      for (const g of tab.groups) {
        assert.equal(g.nestId, `${tab.id}_${g.id}`);
        assert.equal(g.type, 'system');
        assert.ok(!tabIds.has(g.id), `${g.id} clashes with a tab`);
      }
    }
    assert.deepEqual(d.groups.map((g) => g.id).sort(), Object.keys(HUD_GROUPS).sort());
    const used = d.layout.flatMap((t) => t.groups.map((g: any) => g.id));
    assert.equal(new Set(used).size, used.length, 'a group sits in one tab only');
    assert.ok(d.layout.some((t) => t.id === 'combat' && t.groups.some((g: any) => g.nestId === 'combat_weapons')));
  });
  test('names are plain English', () => {
    for (const g of hudDefaults().groups) assert.match(g.name, /^[A-Z][a-z ]+$/);
  });
});

describe('v0.60.0 Token Action HUD actions', () => {
  test('a plain runner: attributes with totals, Reaction and Essence as values, no Magic', () => {
    const list = hudActions(runner());
    const stats = inGroup(list, 'stats');
    assert.deepEqual(stats.slice(0, 6).map((a) => a.name), ['Body', 'Quickness', 'Strength', 'Charisma', 'Intelligence', 'Willpower']);
    const body = byId(list, 'attribute-body')!;
    assert.equal(body.info, '5');
    assert.equal(body.kind, 'sheet');
    assert.deepEqual(body.payload, { action: 'rollAttribute', dataset: { attribute: 'body' } });
    assert.equal(byId(list, 'stat-reaction')!.kind, 'info');
    assert.match(byId(list, 'stat-reaction')!.payload['text'], /5 \+ 1d6/);
    assert.equal(byId(list, 'stat-essence')!.info, '5.8');
    assert.equal(byId(list, 'stat-magic'), undefined);
  });
  test('skills split into active, knowledge and languages, sorted, with rating and specialization', () => {
    const list = hudActions(runner());
    assert.deepEqual(inGroup(list, 'activeSkills').map((a) => a.name), ['Etiquette', 'Firearms']);
    assert.deepEqual(ids(inGroup(list, 'knowledgeSkills')), ['item-sk3']);
    assert.deepEqual(ids(inGroup(list, 'languageSkills')), ['item-sk4']);
    const fa = byId(list, 'item-sk1')!;
    assert.equal(fa.info, '5 (Pistols 7)');
    assert.deepEqual(fa.payload, { action: 'rollSkill', dataset: { itemId: 'sk1' }, itemId: 'sk1' });
  });
  test('weapons: attack each, ammo and modes as info, unarmed last; no gear on the HUD', () => {
    const list = hudActions(runner({ cyberWeapons: [{ id: 'cy1', name: 'Spurs', system: { damagePower: 2, damageLevel: 'M', strengthPower: true } }] }));
    const w = inGroup(list, 'weapons');
    assert.deepEqual(ids(w), ['item-w1', 'item-w2', 'cyberweapon-cy1', 'weapon-unarmed']);
    assert.equal(w[0]!.info, '8/15 · SA');
    assert.equal(w[0]!.img, 'pred.png');
    assert.equal(w[0]!.payload['action'], 'attackWeapon');
    assert.equal(w[1]!.info, undefined);
    assert.equal(w[2]!.info, '(STR+2)M');
    assert.deepEqual(byId(list, 'weapon-unarmed')!.payload['dataset'], { itemId: 'unarmed' });
    assert.ok(!list.some((a) => a.id === 'item-g1'));
  });
  test('weapon info and damage labels', () => {
    assert.equal(hudWeaponInfo({ ammo: 0, ammoMax: 30, modes: 'SA/BF/FA', jammed: true }), '0/30 · SA/BF/FA · jammed');
    assert.equal(hudWeaponInfo({ melee: true, modes: 'SA' }), '');
    assert.equal(hudWeaponInfo(undefined), '');
    assert.equal(hudDamageLabel({ damagePower: 10, damageLevel: 'S', damageType: 'stun' }), '10S Stun');
    assert.equal(hudDamageLabel({ damagePower: -1, damageLevel: 'L', strengthPower: true }), '(STR-1)L');
    assert.equal(hudDamageLabel({ damagePower: 0, damageLevel: 'M', strengthPower: true }), '(STR)M');
  });
  test('combat actions out of combat: attack, reload, full defense; no delay, cast or defend', () => {
    const c = ids(inGroup(hudActions(runner()), 'combatActions'));
    assert.deepEqual(c, ['combat-attack', 'combat-reload', 'combat-fulldefense']);
  });
  test('combat actions in combat: delay on your turn, act now while delaying, done when acting', () => {
    const turn = ids(inGroup(hudActions(runner({ flags: { inCombat: true, myTurn: true } })), 'combatActions'));
    assert.ok(turn.includes('combat-delay'));
    const del = hudActions(runner({ flags: { inCombat: true, delaying: true } }));
    assert.ok(ids(del).includes('combat-actnow') && !ids(del).includes('combat-delay'));
    assert.equal(byId(del, 'combat-actnow')!.payload['action'], 'actNow');
    const acting = ids(hudActions(runner({ flags: { inCombat: true, actingNow: true, delaying: true } })));
    assert.ok(acting.includes('combat-enddelay') && !acting.includes('combat-actnow'));
    const notTurn = ids(hudActions(runner({ flags: { inCombat: true } })));
    assert.ok(!notTurn.includes('combat-delay'));
  });
  test('full defense shows on; defend the newest attack; stand up when prone; clear a jam', () => {
    const base = runner();
    base.items.push({ id: 'w3', type: 'weapon', name: 'Uzi III', system: { jammed: true, ammoMax: 24, ammo: 3 } });
    const list = hudActions({ ...base, flags: { fullDefense: true, pendingAttack: 'Ares Predator', prone: true } });
    assert.equal(byId(list, 'combat-fulldefense')!.info, 'on');
    assert.equal(byId(list, 'combat-fulldefense')!.payload['action'], 'fullDefense');
    assert.equal(byId(list, 'combat-defend')!.kind, 'defend');
    assert.equal(byId(list, 'combat-defend')!.name, 'Defend: Ares Predator');
    assert.equal(byId(list, 'combat-standup')!.payload['action'], 'standUp');
    assert.deepEqual(byId(list, 'combat-clearjam')!.payload, { action: 'clearJam', dataset: { itemId: 'w3' } });
  });
  test('tests group: perception, notice, sneak, athletics, social, soak', () => {
    const t = inGroup(hudActions(runner()), 'tests').map((a) => a.payload['action']);
    assert.deepEqual(t, ['perceive', 'notice', 'sneak', 'athletics', 'socialTest', 'resistDamage']);
  });
  test('a magician: Magic value, spells with Force, cast, perception and projection toggles', () => {
    const mage = runner({
      derived: { reaction: 4, magic: 6, essence: 6, astralMode: 'physical' },
      items: [{ id: 's1', type: 'spell', name: 'Manabolt', system: { learnedForce: 5, category: 'combat', spellType: 'mana' } }],
      flags: { canPerceive: true, canProject: true },
    });
    const list = hudActions(mage);
    assert.equal(byId(list, 'stat-magic')!.info, '6');
    const sp = byId(list, 'item-s1')!;
    assert.equal(sp.groupId, 'spells');
    assert.equal(sp.info, 'F5');
    assert.equal(sp.payload['action'], 'castSpell');
    assert.ok(ids(list).includes('combat-cast'));
    assert.deepEqual(byId(list, 'astral-perceive')!.payload, { mode: 'perceiving' });
    assert.deepEqual(byId(list, 'astral-project')!.payload, { mode: 'projecting' });
    assert.ok(!ids(list).includes('astral-assense'));
  });
  test('perceiving: the toggle turns it off, assense and astral attack appear; projecting: return to body', () => {
    const perc = hudActions(runner({ derived: { magic: 6, astralMode: 'perceiving' }, flags: { canPerceive: true, canProject: true, isAstral: true } }));
    assert.equal(byId(perc, 'astral-perceive')!.info, 'on');
    assert.deepEqual(byId(perc, 'astral-perceive')!.payload, { mode: 'physical' });
    assert.ok(ids(perc).includes('astral-assense') && ids(perc).includes('astral-attack'));
    const proj = hudActions(runner({ derived: { magic: 6, astralMode: 'projecting' }, flags: { canPerceive: true, canProject: true, isAstral: true } }));
    assert.ok(!ids(proj).includes('astral-perceive'));
    assert.equal(byId(proj, 'astral-project')!.name, 'Return to body');
    assert.deepEqual(byId(proj, 'astral-project')!.payload, { mode: 'physical' });
  });
  test('adept powers toggle on and off; usable critter powers only', () => {
    const list = hudActions(runner({
      items: [
        { id: 'a1', type: 'adeptpower', name: 'Improved Reflexes', system: { active: true, level: 2 } },
        { id: 'a2', type: 'adeptpower', name: 'Killing Hands', system: { active: false, level: 1 } },
        { id: 'p1', type: 'power', name: 'Fear', system: { active: true, special: '' } },
        { id: 'p2', type: 'power', name: 'Allergy (Silver)', system: { active: true, special: 'allergy' } },
        { id: 'p3', type: 'power', name: 'Engulf', system: { active: false } },
      ],
    }));
    assert.equal(byId(list, 'item-a1')!.info, '2 · on');
    assert.equal(byId(list, 'item-a2')!.info, 'off');
    assert.equal(byId(list, 'item-a1')!.payload['action'], 'toggleActive');
    assert.deepEqual(ids(inGroup(list, 'critterPowers')), ['item-p1']);
    assert.equal(byId(list, 'item-p1')!.payload['action'], 'usePower');
  });
  test('matrix: nothing without a deck; jack in; jacked in adds the rest, cybercombat with an attack utility', () => {
    assert.equal(inGroup(hudActions(runner()), 'matrixActions').length, 0);
    assert.deepEqual(ids(inGroup(hudActions(runner({ flags: { hasDeck: true } })), 'matrixActions')), ['matrix-jackin']);
    const jacked = inGroup(hudActions(runner({ flags: { hasDeck: true, jackedIn: true } })), 'matrixActions').map((a) => a.payload['action']);
    assert.deepEqual(jacked, ['jackIn', 'jackOut', 'systemTest', 'matrixPerceive', 'matrixManeuver']);
    assert.ok(ids(hudActions(runner({ flags: { hasDeck: true, jackedIn: true, hasAttackUtility: true } }))).includes('matrix-attack'));
  });
  test('rigging: drive when at the controls, jump in or out, the vehicle\'s sensors and mounted weapons', () => {
    const list = hudActions(runner({ flags: { vehicle: { name: 'Roto-drone', controlling: true, jumpedIn: true, owned: true, weapons: [{ id: 'vw1', name: 'MG', info: '50/50' }] } } }));
    const rig = inGroup(list, 'riggingActions');
    assert.deepEqual(ids(rig), ['rig-drive', 'rig-jump', 'rig-release', 'rig-sensors', 'rig-open']);
    assert.equal(byId(list, 'rig-drive')!.name, 'Drive Roto-drone');
    assert.equal(byId(list, 'rig-jump')!.name, 'Jump out');
    assert.equal(byId(list, 'rig-sensors')!.kind, 'vehicle');
    const mg = byId(list, 'mounted-vw1')!;
    assert.equal(mg.kind, 'vehicle');
    assert.deepEqual(mg.payload, { action: 'fireMounted', dataset: { itemId: 'vw1' } });
    // A vehicle the user doesn't own: only the rigger's own actions.
    const theirs = hudActions(runner({ flags: { vehicle: { name: 'Van', owned: false, weapons: [{ id: 'x', name: 'Gun' }] } } }));
    assert.deepEqual(ids(inGroup(theirs, 'riggingActions')), ['rig-jump', 'rig-release']);
    assert.equal(inGroup(theirs, 'mountedWeapons').length, 0);
  });
  test('utility: initiative only with a combat; sheet and Effects', () => {
    assert.deepEqual(ids(inGroup(hudActions(runner()), 'utilityActions')), ['util-sheet', 'util-effects']);
    const u = inGroup(hudActions(runner({ flags: { hasCombat: true } })), 'utilityActions');
    assert.deepEqual(ids(u), ['util-initiative', 'util-sheet', 'util-effects']);
    assert.equal(u[0]!.kind, 'initiative');
    assert.deepEqual(u[2]!.payload, { target: 'actor', tab: 'effects' });
  });
  test('a spirit: no Magic/Essence values or astral toggles, a service, assense when astral', () => {
    const list = hudActions(runner({ type: 'spirit', derived: { reaction: 6, magic: 5, essence: 5, astralMode: 'physical' }, items: [], flags: { isAstral: true, canPerceive: true, canProject: true } }));
    assert.ok(!ids(list).includes('stat-magic') && !ids(list).includes('stat-essence'));
    assert.ok(!ids(list).includes('astral-perceive') && !ids(list).includes('astral-project'));
    assert.ok(ids(list).includes('astral-assense'));
    assert.equal(byId(list, 'util-service')!.payload['action'], 'useService');
    assert.ok(!ids(hudActions(runner())).includes('util-service'), 'only spirits have services');
  });
  test('an npc gets the same lists as a character', () => {
    assert.deepEqual(ids(hudActions(runner({ type: 'npc' }))), ids(hudActions(runner())));
  });
  test('a vehicle actor: drive, sensors, ram and its weapons; no attributes', () => {
    const list = hudActions({ type: 'vehicle', items: [{ id: 'vw', type: 'weapon', name: 'Vindicator', system: { ammo: 100, ammoMax: 100, modes: 'FA' } }], flags: { hasCombat: true } });
    assert.deepEqual(inGroup(list, 'riggingActions').map((a) => a.payload['action']), ['driveVehicle', 'sensorTest', 'ramVehicle']);
    const w = byId(list, 'item-vw')!;
    assert.equal(w.groupId, 'mountedWeapons');
    assert.equal(w.payload['action'], 'fireMounted');
    assert.equal(w.info, '100/100 · FA');
    assert.equal(inGroup(list, 'stats').length, 0);
    assert.ok(ids(list).includes('util-initiative'));
    assert.ok(!ids(list).includes('util-effects'));
  });
  test('IC: act and locate; a frame or agent runs an operation through its owner', () => {
    assert.deepEqual(hudActions({ type: 'ic', items: [], flags: {} }).filter((a) => a.groupId === 'matrixActions').map((a) => a.payload['action']), ['icAttack', 'icLocate']);
    const frame = hudActions({ type: 'ic', items: [], flags: { icProgram: true } });
    assert.deepEqual(byId(frame, 'ic-act')!.payload, { action: 'systemTest', dataset: {}, onProgramOwner: true });
    assert.ok(!ids(frame).includes('ic-locate'));
  });
  test('other actor types get nothing', () => {
    for (const type of ['host', 'barrier', 'site', 'safehouse', '']) assert.deepEqual(hudActions({ type, items: [], flags: {} }), []);
    assert.deepEqual(hudActions(undefined as any), []);
  });
  test('ids are unique, never hold the delimiter, and every group is a known one', () => {
    const big = runner({
      derived: { reaction: 4, magic: 6, essence: 6, astralMode: 'perceiving' },
      flags: { hasCombat: true, inCombat: true, myTurn: true, pendingAttack: 'Fists', prone: true, hasDeck: true, jackedIn: true, hasAttackUtility: true, isAstral: true, canPerceive: true, canProject: true, vehicle: { name: 'Bike', controlling: true, owned: true, weapons: [{ id: 'm', name: 'MG' }] } },
    });
    big.items.push({ id: 's1', type: 'spell', name: 'Heal', system: { learnedForce: 3 } }, { id: 'a1', type: 'adeptpower', name: 'Mystic Armor', system: { active: true } });
    const list = hudActions(big);
    assert.equal(new Set(ids(list)).size, list.length);
    for (const a of list) {
      assert.ok(!a.id.includes('|'), a.id);
      assert.ok(a.groupId in HUD_GROUPS, a.groupId);
      assert.ok(a.name.length > 0);
    }
  });
});

describe('v0.60.0 Token Action HUD: several tokens, encoded values', () => {
  test('several tokens: the six attributes, and initiative with a combat', () => {
    assert.deepEqual(ids(hudMultiActions()), ['attribute-body', 'attribute-quickness', 'attribute-strength', 'attribute-charisma', 'attribute-intelligence', 'attribute-willpower']);
    const withCombat = hudMultiActions({ hasCombat: true });
    assert.equal(withCombat.at(-1)!.kind, 'initiative');
    assert.ok(withCombat.every((a) => a.groupId === 'stats' || a.groupId === 'utilityActions'));
  });
  test('encode, decode and find round-trip', () => {
    const list = hudActions(runner({ flags: { hasCombat: true } }));
    for (const a of list) assert.equal(findHudAction(list, encodeHudAction(a)), a);
    assert.equal(encodeHudAction({ kind: 'sheet', id: 'attribute-body' }), 'sheet|attribute-body');
    assert.deepEqual(decodeHudValue('initiative|util-initiative'), { kind: 'initiative', id: 'util-initiative' });
    assert.deepEqual(decodeHudValue('sheet::item-x', '::'), { kind: 'sheet', id: 'item-x' });
  });
  test('values that are not ours decode to null', () => {
    for (const v of [null, undefined, '', 'sheet', '|x', 'item|w1', 'sheet|', 42]) assert.equal(decodeHudValue(v), null);
    assert.equal(findHudAction(hudActions(runner()), 'sheet|nope'), null);
    assert.equal(findHudAction(hudActions(runner()), 'info|attribute-body'), null, 'kind must match too');
  });
});

describe('v0.60.0 Token Action HUD glue', () => {
  test('registerTokenActionHud only registers a once-hook for TAH Core; the system id is sr2e', async () => {
    const g = globalThis as any;
    const prev = g.Hooks;
    const once: Array<[string, Function]> = [];
    const called: Array<[string, any]> = [];
    g.Hooks = { on: () => {}, once: (n: string, fn: Function) => once.push([n, fn]), call: (n: string, d: any) => { called.push([n, d]); return true; }, callAll: () => {} };
    try {
      const tah = await import('../applications/tah.ts');
      assert.equal(tah.TAH_SYSTEM_ID, 'sr2e');
      tah.registerTokenActionHud();
      assert.deepEqual(once.map(([n]) => n), ['tokenActionHudCoreApiReady']);
      assert.equal(called.length, 0, 'nothing happens until TAH Core fires');
      // TAH Core fires with its API: we hand back a SystemManager class.
      class SM { constructor(public coreModuleId = 'token-action-hud-core') {} }
      class AH { actor: any = null; actors: any[] = []; delimiter = '|'; added: any[] = []; addActions(a: any[], g: any) { this.added.push([g.id, a]); } }
      class RH { delimiter = '|'; }
      once[0]![1]({ id: 'token-action-hud-core', api: { SystemManager: SM, ActionHandler: AH, RollHandler: RH, Utils: { i18n: (s: string) => s } } });
      assert.equal(called.length, 1);
      const [hook, data] = called[0]!;
      assert.equal(hook, 'tokenActionHudSystemReady');
      assert.equal(data.id, 'sr2e');
      assert.equal(data.api.requiredCoreModuleVersion, '2');
      const sm = new data.api.SystemManager();
      assert.deepEqual(sm.getAvailableRollHandlers(), { core: 'SR2e' });
      assert.ok(sm.getRollHandler('core') instanceof RH, 'a RollHandler instance, not false');
      assert.ok(sm.getActionHandler() instanceof AH);
      const defaults = await sm.registerDefaults();
      assert.ok(defaults.layout.length > 0 && defaults.groups.length > 0);
    } finally {
      g.Hooks = prev;
    }
  });
});
