/**
 * v0.81.0 review fixes, slice RB (magic rules, config, docs79 / urr80 pure files, models/index.ts).
 * Each test failed before its fix.
 */
import { test, describe, before } from 'node:test';
import assert from '../../__tests__/helpers/assert-rows.ts';
import { RULES } from '../config.ts';
import { oldWay } from './oldway.ts';
import { pruneSignatures, freshnessModifier, type Signature } from '../tracking.ts';
import { weatherV79 } from '../docs79-melee-vision.ts';
import { aspectRestriction } from '../thaumaturgy.ts';
import { centeringModifiers, sustainingModifiers } from '../arcana.ts';
import { woundTnModifiers } from '../modifiers.ts';
import { urrCoreTnPresetRow, urrCoreKnowledgeText } from '../urr80-core.ts';
import { cbtStrengthRecoil } from '../urr80-combat.ts';
import { healingAttributeStep } from '../docs79-health.ts';
import { impactLevel } from '../docs79-vehicles.ts';

// ---------------------------------------------------------------- a minimal Foundry for the data models

class Field { constructor(public opts: any = {}, public kind = '') {} }
function mk(kind: string) {
  return class extends Field {
    constructor(a?: any, b?: any) {
      if (kind === 'SchemaField') { super(b ?? {}, kind); (this as any).fields = a; }
      else if (kind === 'ArrayField') { super(b ?? {}, kind); (this as any).element = a; }
      else super(a ?? {}, kind);
    }
  };
}
function init(f: any): any {
  if (f.kind === 'SchemaField') return Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [k, init(v)]));
  if (f.kind === 'ArrayField') return [];
  return typeof f.opts.initial === 'function' ? f.opts.initial() : f.opts.initial;
}
let M: any;
before(async () => {
  const S = 'StringField';
  (globalThis as any).foundry ??= {
    data: { fields: { NumberField: mk('NumberField'), StringField: mk(S), BooleanField: mk('BooleanField'), SchemaField: mk('SchemaField'), ArrayField: mk('ArrayField'), HTMLField: mk(S), ObjectField: mk('ObjectField'), TypedObjectField: mk('ObjectField'), DocumentUUIDField: mk(S), FilePathField: mk(S), ColorField: mk(S), EmbeddedDataField: mk('ObjectField'), JSONField: mk('ObjectField'), SetField: mk('ArrayField'), AnyField: mk('ObjectField') } },
    abstract: { TypeDataModel: class {} },
  };
  M = await import('../../models/index.ts');
});
/** A data model instance with its schema's initial values, prepared. */
function model(cls: any, patch: Record<string, unknown>, parent: any): any {
  const o: any = Object.create(cls.prototype);
  for (const [k, v] of Object.entries(cls.defineSchema())) o[k] = init(v);
  Object.assign(o, patch);
  o.parent = { flags: {}, ...parent, system: o };
  o.prepareDerivedData();
  return o.derived;
}

describe('v0.81.0 RB fixes', () => {
  test('RB-1: a spirit\'s Magic is its Force for drain, the Spell Pool and the rest', () => {
    const d = model(M.SpiritDataModel, { force: 5 }, { type: 'spirit', items: [{ type: 'skill', name: 'Sorcery', system: { rating: 5 } }] });
    assert.equal(d.magic, 5);
    assert.equal(d.drainMagic, 5, 'drain Magic is the Force (was 0: every spell drained Physical)');
    assert.ok(d.spellPool > 0, `Spell Pool from Force (got ${d.spellPool})`);
    assert.equal(d.adeptPoints.available, 5 * RULES.MAGIC.adeptPointsPerMagic);
  });

  test('RB-11: the paired derived values agree (Spell Pool and what is left of it)', () => {
    const d = model(M.CharacterDataModel, { magic: 6, essence: 6, tradition: 'hermetic' }, { type: 'character', items: [
      { type: 'skill', name: 'Sorcery', system: { rating: 4 } },
      { id: 'pf', type: 'focus', system: { focusType: 'power', rating: 2, active: true, bonded: true } },
    ] });
    assert.equal(d.spellPoolLeft, d.spellPool);
    assert.equal(d.combatPoolLeft, d.combatPool);
    assert.equal(d.powerFocus, undefined, 'RB-10: the unread derived.powerFocus is gone');
    assert.equal(d.monitorBoxes, undefined, 'RB-10: the unread derived.monitorBoxes is gone');
  });

  test('RB-9: under URR magAdeptFoci an adept\'s non-weapon foci count for nothing (focus addiction)', (t) => {
    t.after(oldWay({ 'URR_V80.magAdeptFoci': true }));
    const items = [
      { id: 'a', type: 'focus', system: { focusType: 'power', rating: 4, active: true, bonded: true } },
      { id: 'b', type: 'focus', system: { focusType: 'weapon', rating: 2, active: true, bonded: true } },
    ];
    assert.deepEqual(M.fociOf({ items, system: { tradition: 'adept' } }).map((f: any) => f.id), ['b']);
    assert.deepEqual(M.fociOf({ items, system: { tradition: 'hermetic' } }).map((f: any) => f.id), ['a', 'b']);
    const d = model(M.CharacterDataModel, { magic: 3, essence: 6, tradition: 'adept' }, { type: 'character', items });
    assert.equal(d.focusAddiction.total, 2, 'only the weapon focus counts');
  });

  test('RB-2: under visionCyberNatural "single" rain and fog do not change with visionSmokeRows', (t) => {
    t.after(oldWay({ 'DOCS_V79.visionCyberNatural': 'single', 'DOCS_V79.visionWeatherFold': 'smoke' }));
    for (const v of [{}, { lowLight: true }, { thermographic: true }, { lowLight: true, thermographic: true }]) {
      for (const id of ['heavyRain', 'heavyFog', 'fog', 'lightRain']) {
        const restore = oldWay({ 'DOCS_V79.visionSmokeRows': 'book' });
        const a = weatherV79(id, v);
        restore();
        const restore2 = oldWay({ 'DOCS_V79.visionSmokeRows': 'old' });
        const b = weatherV79(id, v);
        restore2();
        assert.deepEqual(b, a, `${id} ${JSON.stringify(v)}`);
      }
    }
  });

  test('RB-3: pruneSignatures keeps none at 0 and sorts newest last', () => {
    const sig = (id: string, worldTime: number): Signature => ({ id, sceneId: 's', kind: 'k', label: 'l', force: 6, worldTime });
    const list = [sig('b', 200), sig('a', 100), sig('c', 300)];
    assert.deepEqual(pruneSignatures(list, 400, 0), []);
    assert.deepEqual(pruneSignatures(list, 400, 2).map((s) => s.id), ['b', 'c']);
    assert.deepEqual(pruneSignatures(list, 400).map((s) => s.id), ['a', 'b', 'c']);
  });

  test('RB-6: elementalists cast by the same table elementals serve by', (t) => {
    t.after(oldWay({ 'MAGIC_EXTRA.elementalCategories': { ...RULES.MAGIC_EXTRA.elementalCategories, water: 'manipulation' } }));
    assert.equal(aspectRestriction('elementalist', 'cast', { aspectElement: 'water', category: 'manipulation' }), null);
    assert.match(aspectRestriction('elementalist', 'cast', { aspectElement: 'water', category: 'illusion' }) ?? '', /manipulation/);
  });

  test('RB-5: the dead config keys are gone', () => {
    const X: any = RULES.MAGIC_EXTRA;
    assert.equal(X.elementCategories, undefined);
    assert.equal(X.focusAddiction, undefined);
    assert.equal(X.barrierSpells, undefined);
    assert.equal('diceFrom' in X.elementalAid, false);
    assert.equal('checkLineOfSight' in X.area, false);
    assert.equal('initiationMultiplier' in X.karmaCosts, false);
    assert.equal('daysPerRating' in (RULES.MAGIC_V39.sites as any), false);
    assert.equal('kinds' in (RULES.CRITTERS_V56.immunity as any), false);
  });

  test('RB-15: centering finds the penalties the wound and sustaining modifiers make', () => {
    const pen = [...woundTnModifiers({ physical: 3, stun: 0 } as any), ...sustainingModifiers([{ spellName: 'Armor', force: 3, category: 'manipulation', focusId: '' }])];
    const total = pen.reduce((n, m) => n + m.value, 0);
    assert.ok(total > 0);
    assert.deepEqual(centeringModifiers(99, ['centering'], pen), [{ label: 'Centering', value: -total }]);
  });

  test('RB-16: the TN preset row escapes config labels', (t) => {
    t.after(oldWay({ 'URR_V80.coreTnPresets': true, 'URR_V80.coreDifficulty': [{ id: 'x', label: '<b>Hard</b> & "odd"', tn: 6 }] }));
    const row = urrCoreTnPresetRow();
    assert.ok(row.includes('&lt;b&gt;Hard&lt;/b&gt; &amp; &quot;odd&quot; (TN 6)'), row);
    assert.ok(!row.includes('<b>'));
  });

  test('RB-18: ordered tables work in either order', (t) => {
    const fresh = freshnessModifier(5);
    const steps = [[10, -3], [7, -2], [4, -1]] as const;
    const impact = impactLevel(50);
    t.after(oldWay({
      'TRACKING.freshness': [...RULES.TRACKING.freshness].reverse(),
      'DOCS_V79.vehImpact': { ...RULES.DOCS_V79.vehImpact, table: [...RULES.DOCS_V79.vehImpact.table].reverse() },
      'URR_V80.cbtStrengthRecoil': true,
      'URR_V80.cbtStrengthRecoilRows': [[5, 1], [7, 2], [9, 3], [11, 4]],
      'URR_V80.coreKnowledgeReveals': [...RULES.URR_V80.coreKnowledgeReveals].reverse(),
    }));
    assert.deepEqual(freshnessModifier(5), fresh);
    assert.equal(healingAttributeStep(8, [...steps].reverse()), healingAttributeStep(8, steps));
    assert.equal(healingAttributeStep(8, steps), -2);
    assert.equal(impactLevel(50), impact);
    assert.equal(cbtStrengthRecoil(6, 12, true), 2, 'Strength 12 takes 4 off');
    const top = Math.max(...RULES.URR_V80.coreKnowledgeReveals.map((r) => r.successes));
    const best = RULES.URR_V80.coreKnowledgeReveals.find((r) => r.successes === top)!.text;
    assert.equal(urrCoreKnowledgeText(top + 3), best);
  });
});
