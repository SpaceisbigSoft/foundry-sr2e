import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../config.ts';
import { MAGIC_V72 } from '../config72/magic.ts';
import {
  masterDeathMode, boundSpiritOnMasterDeath, astralCombatProfile, astralPoolKind, metamagicAllowed, metamagicChoices,
  dispelDrainPoolDice, barrierSpellKind, barrierSpellRating, barrierSpellRadius, barrierSpellActorData, barrierBlocks,
  innateSpellDice, innateDrains, wardPresence, barrierStopsMover, astralWoundRules, projectingInitiativeMinus,
  anchoringKarma, allySpellKarma, allyAbility, senseLinkSource,
} from '../sorcery.ts';

const M = MAGIC_V72 as any;
/** Set a dotted path on MAGIC_V72 for the length of fn. */
const withRule = (path: string, value: unknown, fn: () => void) => {
  const keys = path.split('.');
  const last = keys.pop()!;
  const o = keys.reduce((x, k) => x[k], M);
  const old = o[last];
  o[last] = value;
  try { fn(); } finally { o[last] = old; }
};

describe('v0.72.0 O13: bound spirits when the master dies, by kind', () => {
  test('nature spirits, watchers and toxic spirits depart; allies and elementals go free', () => {
    assert.equal(masterDeathMode('nature', 'free'), 'depart');
    assert.equal(masterDeathMode('watcher', 'free'), 'depart');
    assert.equal(masterDeathMode('toxic', 'free'), 'depart');
    assert.equal(masterDeathMode('ally', 'none'), 'free');
    assert.equal(masterDeathMode('elemental', 'none'), 'free');
    assert.equal(masterDeathMode('insect', 'free'), 'none');
  });
  test('legacy kinds and unknown kinds use the old mode', () => {
    assert.equal(masterDeathMode('other', 'depart'), 'depart');
    assert.equal(masterDeathMode('weird', 'free'), 'free');
  });
  test('byKind off: the old one-mode-for-all', () => {
    withRule('masterDies.byKind', false, () => {
      assert.equal(masterDeathMode('nature', 'free'), 'free');
      assert.equal(masterDeathMode('ally', 'none'), 'none');
    });
  });
  test('the update: a departing nature spirit loses its master but stays a nature spirit', () => {
    const r = boundSpiritOnMasterDeath('nature', 'free');
    assert.equal(r.action, 'depart');
    assert.equal(r.update['system.spiritKind'], undefined);
    const a = boundSpiritOnMasterDeath('ally', 'free');
    assert.equal(a.update['system.spiritKind'], 'free');
    assert.equal(boundSpiritOnMasterDeath('free', 'free').action, 'none');
  });
});

describe('v0.72.0 O14: adepts in astral combat', () => {
  // v0.77.0: the Unarmed Combat rule is a house rule now (off by default: SR2 adepts fight as magicians); these test it switched on.
  before(() => { (RULES as any).MAGIC_V72.adeptAstral.enabled = true; });
  after(() => { (RULES as any).MAGIC_V72.adeptAstral.enabled = false; });
  const base = { skill: 'Sorcery', pool: 'spell' as const, level: 'M' as const };
  test('a magician keeps Sorcery and the Spell Pool', () => {
    const p = astralCombatProfile({ type: 'character', tradition: 'hermetic', base });
    assert.deepEqual([p.mode, p.skill, p.fallback, p.pool, p.damageLevel], ['magician', 'Sorcery', 'willpower', 'spell', 'M']);
  });
  test('a spirit uses its Force and the Combat Pool', () => {
    const p = astralCombatProfile({ type: 'spirit', tradition: 'none', base });
    assert.deepEqual([p.mode, p.skill, p.pool], ['spirit', '', 'combat']);
  });
  test('an adept uses Unarmed Combat, the Combat Pool and killing hands', () => {
    const p = astralCombatProfile({ type: 'character', tradition: 'adept', base, killingHandsLevel: 3, unarmedRating: 4 });
    assert.deepEqual([p.mode, p.skill, p.fallback, p.pool, p.damageLevel], ['adept', 'Unarmed Combat', 'quickness', 'combat', 'S']); // v0.77.0: level 3 = S (L/M/S/D)
    assert.match(p.note, /killing hands S/);
    const q = astralCombatProfile({ type: 'character', tradition: 'adept', base, killingHandsLevel: 0 });
    assert.equal(q.damageLevel, 'M');
  });
  test('a better martial art stands in for Unarmed Combat', () => {
    const p = astralCombatProfile({ type: 'npc', tradition: 'adept', base, unarmedRating: 3, martial: { name: 'Wildcat', rating: 5 } });
    assert.equal(p.skill, 'Wildcat');
    const q = astralCombatProfile({ type: 'npc', tradition: 'adept', base, unarmedRating: 6, martial: { name: 'Wildcat', rating: 5 } });
    assert.equal(q.skill, 'Unarmed Combat');
  });
  test('switch off: an adept fights as a magician (the old way)', () => {
    withRule('adeptAstral.enabled', false, () => {
      const p = astralCombatProfile({ type: 'character', tradition: 'adept', base, killingHandsLevel: 3 });
      assert.deepEqual([p.mode, p.skill, p.pool, p.damageLevel], ['magician', 'Sorcery', 'spell', 'M']);
      assert.equal(astralPoolKind({ type: 'character', tradition: 'adept', base: 'spell' }), 'spell');
    });
  });
  test('astralPoolKind', () => {
    assert.equal(astralPoolKind({ type: 'spirit', tradition: '', base: 'spell' }), 'combat');
    assert.equal(astralPoolKind({ type: 'character', tradition: 'adept', base: 'spell' }), 'combat');
    assert.equal(astralPoolKind({ type: 'character', tradition: 'shamanic', base: 'spell' }), 'spell');
    withRule('adeptAstral.pool', 'none', () => assert.equal(astralPoolKind({ type: 'character', tradition: 'adept', base: 'spell' }), null));
  });
});

describe('v0.72.0 O15: metamagic limits', () => {
  const all = ['centering', 'shielding', 'quickening', 'dispelling', 'masking', 'anchoring', 'cleansing', 'divining', 'invoking', 'possessing', 'reflecting'];
  test('an adept learns only centering and masking', () => {
    assert.deepEqual(metamagicChoices('adept', all), ['centering', 'masking']);
    const r = metamagicAllowed('adept', 'shielding');
    assert.equal(r.ok, false);
    assert.equal(r.block, true);
    assert.match(r.reason!, /Physical adepts/);
  });
  test('aspected magicians lose the techniques of the art they lack', () => {
    assert.equal(metamagicAllowed('sorcerer', 'invoking').block, true);
    assert.equal(metamagicAllowed('sorcerer', 'quickening').ok, true);
    assert.equal(metamagicAllowed('conjurer', 'quickening').block, true);
    assert.equal(metamagicAllowed('conjurer', 'possessing').ok, true);
    assert.equal(metamagicChoices('hermetic', all).length, all.length);
    assert.equal(metamagicChoices('elementalist', all).length, all.length);
  });
  test('warn lets it through with a reason; off says nothing', () => {
    withRule('metamagicLimits.mode', 'warn', () => {
      const r = metamagicAllowed('adept', 'shielding');
      assert.deepEqual([r.ok, r.block], [false, false]);
      assert.ok(r.reason);
      assert.equal(metamagicChoices('adept', all).length, all.length);
    });
    withRule('metamagicLimits.mode', 'off', () => assert.deepEqual(metamagicAllowed('adept', 'shielding'), { ok: true, block: false, reason: null }));
  });
});

describe('v0.72.0 O16: Spell Pool dice for dispelling drain', () => {
  test('up to what is left; none with the switch off', () => {
    assert.equal(dispelDrainPoolDice(3, 5), 3);
    assert.equal(dispelDrainPoolDice(6, 2), 2);
    assert.equal(dispelDrainPoolDice(-1, 2), 0);
    withRule('dispelDrainPool', false, () => assert.equal(dispelDrainPoolDice(3, 5), 0));
  });
});

describe('v0.72.0 O17: barrier spells', () => {
  test('found by the field, else by name', () => {
    assert.equal(barrierSpellKind({ name: 'Wall', system: { barrier: 'physical' } }), 'physical');
    assert.equal(barrierSpellKind({ name: 'Mana Barrier', system: {} }), 'mana');
    assert.equal(barrierSpellKind({ name: 'Physical barrier', system: { barrier: '' } }), 'physical');
    assert.equal(barrierSpellKind({ name: 'Manabolt', system: {} }), null);
    withRule('barrierSpells.matchByName', false, () => assert.equal(barrierSpellKind({ name: 'Mana Barrier', system: {} }), null));
    withRule('barrierSpells.enabled', false, () => assert.equal(barrierSpellKind({ name: 'X', system: { barrier: 'mana' } }), null));
  });
  test('rating and size', () => {
    assert.equal(barrierSpellRating(5, 2), 5);
    withRule('barrierSpells.rating', 'successes', () => { assert.equal(barrierSpellRating(5, 2), 2); assert.equal(barrierSpellRating(5, 0), 1); });
    assert.equal(barrierSpellRadius({ force: 4, magic: 6 }), 6);
    withRule('barrierSpells.radius', 'force', () => assert.equal(barrierSpellRadius({ force: 4, magic: 6 }), 4));
    withRule('barrierSpells.radius', 'fixed', () => assert.equal(barrierSpellRadius({ force: 4, magic: 6 }), 5));
    assert.equal(barrierSpellRadius({ force: 0, magic: 0 }), 1);
  });
  test('the barrier actor', () => {
    const d = barrierSpellActorData({ kind: 'physical', force: 4, successes: 2, spellName: 'Physical Barrier', casterUuid: 'Actor.a', casterName: 'Mage', effectId: 'e1' });
    assert.equal(d.type, 'barrier');
    assert.deepEqual(d.system, { barrierKind: 'physical barrier', rating: 4, baseRating: 4 });
    assert.deepEqual((d.flags as any).sr2e.barrierSpell, { casterUuid: 'Actor.a', spellName: 'Physical Barrier', effectId: 'e1' });
    assert.match(d.name, /\(Mage\)$/); // the rating is shown by the notes, not the name (live run)
    assert.equal(barrierSpellActorData({ kind: 'mana', force: 3, successes: 1, spellName: '', casterUuid: '', casterName: 'M' }).system.barrierKind, 'mana barrier');
  });
  test('what each kind blocks', () => {
    assert.equal(barrierBlocks('ward', 'astral'), true);
    assert.equal(barrierBlocks('ward', 'physical'), false);
    assert.equal(barrierBlocks('mana barrier', 'spell'), true);
    assert.equal(barrierBlocks('physical barrier', 'physical'), true);
    assert.equal(barrierBlocks('physical barrier', 'gunfire'), true);
    assert.equal(barrierBlocks('physical barrier', 'astral'), false);
    assert.equal(barrierBlocks('physical barrier', 'spell'), false);
    assert.equal(barrierBlocks('', 'astral'), true);
  });
});

describe('v0.72.0 O18: innate spells', () => {
  test('a Sorcery skill is used as before', () => {
    assert.deepEqual(innateSpellDice({ actorType: 'spirit', sorceryRating: 3, force: 6 }), { dice: 3, label: 'Sorcery', innate: false });
  });
  test('a spirit casts with its Force', () => {
    assert.deepEqual(innateSpellDice({ actorType: 'spirit', sorceryRating: 0, force: 5 }), { dice: 5, label: 'Force', innate: true });
    withRule('ally.castDice', 'intelligence', () => assert.equal(innateSpellDice({ actorType: 'spirit', spiritKind: 'ally', sorceryRating: 0, force: 5, intelligence: 4 })!.dice, 4));
  });
  test('a critter casts an innate spell with Magic, else Essence', () => {
    assert.deepEqual(innateSpellDice({ actorType: 'npc', sorceryRating: 0, spellInnate: true, magic: 4, essence: 6 }), { dice: 4, label: 'Magic', innate: true });
    assert.deepEqual(innateSpellDice({ actorType: 'npc', sorceryRating: 0, spellInnate: true, magic: 0, essence: 6 }), { dice: 6, label: 'Essence', innate: true });
    assert.equal(innateSpellDice({ actorType: 'npc', sorceryRating: 0, spellInnate: false, magic: 4 }), null);
    withRule('innateSpells.critterDice', 'essence', () => assert.equal(innateSpellDice({ actorType: 'npc', sorceryRating: 0, spellInnate: true, magic: 4, essence: 6 })!.dice, 6));
  });
  test('switch off: Sorcery needed (the old way)', () => {
    withRule('innateSpells.enabled', false, () => assert.equal(innateSpellDice({ actorType: 'spirit', sorceryRating: 0, force: 5 }), null));
  });
  test('drain', () => {
    assert.equal(innateDrains(), true);
    withRule('innateSpells.drain', 'none', () => assert.equal(innateDrains(), false));
  });
});

describe('v0.72.0 O19: what a ward stops on the map', () => {
  test('presence by kind', () => {
    assert.deepEqual(wardPresence({ type: 'character', astralMode: 'projecting' }), { astral: true, physical: false });
    assert.deepEqual(wardPresence({ type: 'spirit', materialized: false }), { astral: true, physical: false });
    assert.deepEqual(wardPresence({ type: 'spirit', materialized: true }), { astral: true, physical: true });
    assert.deepEqual(wardPresence({ type: 'npc', astralMode: 'perceiving', dualNatured: true }), { astral: true, physical: true });
    assert.deepEqual(wardPresence({ type: 'character', astralMode: 'perceiving' }), { astral: false, physical: true });
    assert.deepEqual(wardPresence({ type: 'character', astralMode: 'physical' }), { astral: false, physical: true });
    withRule('wardPresence.perceiving', true, () => assert.equal(wardPresence({ type: 'character', astralMode: 'perceiving' }).astral, true));
  });
  test('switch off: only projecting forms and unmaterialized spirits (the old way)', () => {
    withRule('wardPresence.enabled', false, () => {
      assert.equal(wardPresence({ type: 'spirit', materialized: true }).astral, false);
      assert.equal(wardPresence({ type: 'npc', dualNatured: true }).astral, false);
      assert.equal(wardPresence({ type: 'spirit', materialized: false }).astral, true);
    });
  });
  test('who is stopped by which barrier', () => {
    const dual = wardPresence({ type: 'npc', dualNatured: true });
    const mundane = wardPresence({ type: 'character' });
    const astral = wardPresence({ type: 'character', astralMode: 'projecting' });
    assert.equal(barrierStopsMover(dual, 'ward'), true);
    assert.equal(barrierStopsMover(mundane, 'ward'), false);
    assert.equal(barrierStopsMover(mundane, 'physical barrier'), true);
    assert.equal(barrierStopsMover(astral, 'physical barrier'), false);
    assert.equal(barrierStopsMover(astral, 'mana barrier'), true);
  });
});

describe('v0.72.0 O20: a projecting magician\'s wounds', () => {
  test('both, neither, legacy', () => {
    assert.deepEqual(astralWoundRules(), { tests: true, initiative: true });
    assert.deepEqual(astralWoundRules('neither'), { tests: false, initiative: false });
    assert.deepEqual(astralWoundRules('legacy'), { tests: true, initiative: false });
    assert.equal(projectingInitiativeMinus(2), 2);
    assert.equal(projectingInitiativeMinus(2, 'legacy'), 0);
    withRule('astralWounds', 'neither', () => assert.equal(projectingInitiativeMinus(3), 0));
  });
});

describe('v0.72.0 O21: anchoring Karma and ally abilities', () => {
  test('anchoring costs Karma by Force', () => {
    assert.equal(anchoringKarma(4), 4);
    withRule('anchoring.karmaPerForce', 2, () => assert.equal(anchoringKarma(3), 6));
    withRule('anchoring.enabled', false, () => assert.equal(anchoringKarma(4), 0));
  });
  test('ally spells and abilities', () => {
    assert.equal(allySpellKarma(5), 5);
    assert.equal(allyAbility('senseLink')!.karma, 1);
    assert.equal(allyAbility('nope'), null);
    withRule('ally.enabled', false, () => { assert.equal(allySpellKarma(5), 0); assert.equal(allyAbility('senseLink'), null); });
  });
  test('the sense link', () => {
    assert.equal(senseLinkSource({ linkOn: true, allyUuid: 'Actor.al', allyAbilities: { senseLink: true } }), 'Actor.al');
    assert.equal(senseLinkSource({ linkOn: false, allyUuid: 'Actor.al', allyAbilities: { senseLink: true } }), null);
    assert.equal(senseLinkSource({ linkOn: true, allyUuid: 'Actor.al', allyAbilities: {} }), null);
  });
});
