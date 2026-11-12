import { test, describe } from 'node:test';
import { oldWay } from './oldway.ts';
import assert from 'node:assert/strict';
import {
  reflexTypeOf, stackAugmentations, capInitiativeDice, smartlinkModifier, magnifiedRange, pheromoneDice, datajackCheck,
  limbCapacity, cyberCost, softRating, effectiveMagic, sumBonuses, type Augmentation, type Skillsoft,
} from '../cyberware.ts';
import { visibilityModifier, smokeModifier } from '../weapons.ts';
import { RULES } from '../config.ts';

const ware = (name: string, extra: Partial<Augmentation> = {}): Augmentation => ({ name, essenceCost: 1, grade: 'standard', installed: true, ...extra });

describe('cyberware depth (v0.29.0)', () => {
  test('reflex systems are read from the field or guessed from the name', () => {
    assert.equal(reflexTypeOf({ name: 'Wired Reflexes 2' }), 'wired');
    assert.equal(reflexTypeOf({ name: 'boosted reflexes (3)' }), 'boosted');
    assert.equal(reflexTypeOf({ name: 'Reaction Enhancers 2' }), 'enhancer');
    assert.equal(reflexTypeOf({ name: 'Wired Reflexes', reflexes: 'enhancer' }), 'enhancer');
    assert.equal(reflexTypeOf({ name: 'Cybereyes' }), '');
  });

  test('wired and boosted reflexes do not stack: the best one counts; enhancers and other bonuses still do', () => {
    const wired = ware('Wired Reflexes 2', { reaction: 4, initiativeDice: 2 });
    const boosted = ware('Boosted Reflexes 1', { reaction: 2, initiativeDice: 1, attributes: { quickness: 1 } });
    const enh = ware('Reaction Enhancers 2', { reaction: 2 });
    const r = stackAugmentations([wired, boosted, enh], []);
    const b = sumBonuses(r.cyber);
    assert.deepEqual({ re: b.reaction, d: b.initiativeDice, q: b.attributes.quickness }, { re: 6, d: 2, q: 1 });
    assert.match(r.notes[0]!, /Boosted Reflexes 1 does not stack with Wired Reflexes 2/);
    // A damaged or uninstalled system does not compete.
    const r2 = stackAugmentations([{ ...wired, damaged: true }, boosted], []);
    assert.equal(sumBonuses(r2.cyber).initiativeDice, 1);
  });

  test('adept reflexes compete with cyber reflexes; the initiative dice cap', () => {
    const wired = ware('Wired Reflexes 1', { reaction: 2, initiativeDice: 1 });
    const adept = { essenceCost: 0, grade: 'standard' as const, installed: true, reaction: 4, initiativeDice: 2, name: 'Improved Reflexes 2' };
    const r = stackAugmentations([wired], [adept]);
    assert.equal(sumBonuses([...r.cyber, ...r.adept]).initiativeDice, 2);
    assert.match(r.notes[0]!, /do not stack with adept reflexes/);
    assert.deepEqual(capInitiativeDice(6), { dice: 5, capped: true });
    assert.deepEqual(capInitiativeDice(4), { dice: 4, capped: false });
  });

  test('smartlink levels, vision magnification and ultrasound', () => {
    assert.equal(smartlinkModifier(0), 0);
    assert.equal(smartlinkModifier(1), -2);
    assert.equal(smartlinkModifier(2), -2); // v0.79.0 docs check: SRII table, smartlink I or II −2 (was −3)
    assert.equal(magnifiedRange('long', 1), 'medium');
    assert.equal(magnifiedRange('extreme', 3), 'short');
    assert.equal(magnifiedRange('medium', 5), 'short');
    assert.equal(magnifiedRange('short', 0), 'short');
    assert.deepEqual(visibilityModifier('darkness', { ultrasound: true }), { value: 2, using: 'ultrasound' });
    assert.deepEqual(visibilityModifier('darkness', { thermographic: true, ultrasound: true }), { value: 2, using: 'ultrasound' });
    assert.equal(visibilityModifier('normal', { ultrasound: true }).using, 'normal');
    assert.deepEqual(smokeModifier('smoke', { ultrasound: true }), { value: 1, using: 'ultrasound' });
    assert.deepEqual(smokeModifier('smoke', { thermographic: true, ultrasound: true }), { value: 0, using: 'thermographic' });
  });

  test('pheromones help social skills; datajack checks; limb capacity; grade cost', () => {
    assert.equal(pheromoneDice('Negotiation', 2), 2);
    assert.equal(pheromoneDice('Etiquette (Street)', 1), 1);
    assert.equal(pheromoneDice('Firearms', 2), 0);
    assert.equal(datajackCheck('decking', true), 'ok');
    assert.equal(datajackCheck('decking', false), 'warn');
    assert.equal(datajackCheck('rigging', false), 'ok');
    assert.deepEqual(limbCapacity(1, [{ essenceCost: 0.5, grade: 'standard' }, { essenceCost: 1, grade: 'delta' }]), { used: 1, capacity: 1, over: false });
    assert.equal(limbCapacity(0.5, [{ essenceCost: 0.6, grade: 'standard' }]).over, true);
    assert.equal(cyberCost(10000, 'beta'), 40000);
    assert.equal(cyberCost(10000, 'nonsense'), 10000);
  });

  test('skillsofts: activesofts need skillwires (which cap them) and a jack; knowsofts need a jack', () => {
    const pistols: Skillsoft = { name: 'Pistols 5 chip', kind: 'activesoft', skill: 'Firearms', rating: 5, slotted: true };
    const japanese: Skillsoft = { name: 'Japanese', kind: 'linguasoft', skill: 'Japanese', rating: 4, slotted: true };
    assert.deepEqual(softRating(pistols, { skillwires: 3, chipjack: true, datajack: false }), { rating: 3, reason: 'capped at skillwires 3' });
    assert.equal(softRating(pistols, { skillwires: 0, chipjack: true, datajack: false }).reason, 'no skillwires');
    assert.equal(softRating(japanese, { skillwires: 0, chipjack: false, datajack: false }).reason, 'no chipjack or datajack');
    assert.equal(softRating(japanese, { skillwires: 0, chipjack: false, datajack: true }).rating, 4);
    assert.equal(softRating({ ...japanese, slotted: false }, { skillwires: 0, chipjack: true, datajack: true }).rating, 0);
  });

  test('Magic and Essence: capped (default) or reduced by every point of Essence lost', (t) => {
    // v0.92.3: the v0.92.2 rule (RULES.SORCERY_V923).
    t.after(oldWay({ 'SORCERY_V923.magicFromEssence': 'v922' }));
    assert.equal(effectiveMagic(6, 5.5), 6);
    assert.equal(effectiveMagic(4, 5.5), 4);
    (RULES as any).MAGIC_ESSENCE_MODE = 'reduce';
    try {
      assert.equal(effectiveMagic(6, 5.5, 6), 5);
      assert.equal(effectiveMagic(4, 5.5, 6), 3);
      assert.equal(effectiveMagic(4, 4, 6), 2);
      assert.equal(effectiveMagic(4, 6, 6), 4);
    } finally { (RULES as any).MAGIC_ESSENCE_MODE = 'cap'; }
  });
});
