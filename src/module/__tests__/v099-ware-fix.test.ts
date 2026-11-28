/**
 * v0.99.0 review fixes, cyberware and bioware (RULES.WARE_V99): the pure side. C1 (existing cyberlimbs priced their
 * enhancements into essenceCost: the limb99Paid stamp, the migration's update, the statblock importer), C5 (orthoskin
 * against plating counts only working ware, Light plating at half). For each, 'v980' keeps the v0.98.0 result.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { oldWay } from '../rules/__tests__/oldway.ts';
import * as X from '../rules/ware99.ts';
import { WARE_V980_WAY } from '../rules/__tests__/ware980.ts';
import { SYSTEM_ID } from '../config/system.ts';
import { parseStatBlock, statBlockItems } from '../rules/statblock.ts';

/** English from public/lang/en.json, with this area's drafts while they aren't merged. */
function english(): Record<string, string> {
  const flat: Record<string, string> = {};
  const walk = (o: unknown, p: string): void => { if (typeof o === 'string') { flat[p] = o; return; } if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k); };
  walk(JSON.parse(readFileSync(join('public', 'lang', 'en.json'), 'utf8')), '');
  for (const f of ['ware99.json', 'ware99-fix.json']) {
    const draft = join('i18n-drafts', f);
    if (existsSync(draft)) Object.assign(flat, JSON.parse(readFileSync(draft, 'utf8')));
  }
  return flat;
}
(globalThis as any).__SR2E_EN__ = { ...((globalThis as any).__SR2E_EN__ ?? {}), ...english() };

const cw = (id: string, name: string, system: Record<string, any> = {}, flags: Record<string, any> = {}) => ({ id, type: 'cyberware', name, flags, system: { installed: true, bioware: false, kind: 'other', ...system } });
const arm = (strength: number, quickness: number, essenceCost = 1, stamp?: { strength: number; quickness: number }) =>
  cw('arm', 'Cyberarm', { kind: 'cyberlimb', essenceCost, limb: { location: 'rightArm', strength, quickness, capacity: 1 } }, stamp ? { [SYSTEM_ID]: { [X.LIMB_PAID_FLAG]: stamp } } : {});
const ortho = (rating: number) => cw('os', `Orthoskin ${rating}`, { bioware: true, bioKind: 'orthoskin', rating });
const plating = (rating: number) => cw('dp', `Dermal plating ${rating}`, { rating });

describe('v0.99.0 fix C1: cyberlimbs from before v0.99.0 do not pay their enhancements twice', () => {
  test('a stamped Strength 8 arm at 1.8 still costs 1.8; raised to 9 it costs .4 more', () => {
    const stamp = { strength: 8, quickness: 3 };
    assert.equal(X.limbEssenceCost(1.8, arm(8, 3, 1.8, stamp), 'human'), 1.8);
    assert.equal(X.limbEssenceCost(1.8, arm(9, 3, 1.8, stamp), 'human'), 2.2);
    assert.equal(X.limbEssenceCost(1.8, arm(8, 3, 1.8), 'human'), 2.6, 'unstamped (a new limb): 2 points past the free 6');
    assert.equal(X.limbStats(arm(8, 7, 1, { strength: 8, quickness: 3 }), 'human').essence, 0.3, 'Quickness past max(6, 3)');
  });
  test('a stamp below the free points changes nothing; a bad stamp counts as none', () => {
    assert.equal(X.limbStats(arm(7, 3, 1, { strength: 2, quickness: 2 }), 'human').essence, 0.4);
    const bad = cw('arm', 'Cyberarm', { kind: 'cyberlimb', limb: { strength: 7, quickness: 3 } }, { [SYSTEM_ID]: { [X.LIMB_PAID_FLAG]: 'lots' } });
    assert.equal(X.limbStats(bad, 'human').essence, 0.4);
    assert.deepEqual(X.limbPaid(cw('arm', 'Cyberarm', {}, { [SYSTEM_ID]: { [X.LIMB_PAID_FLAG]: { strength: 999, quickness: -4 } } })), { strength: 40, quickness: 0 });
  });
  test('the migration stamps cyberlimbs once (their fields as entered); not other ware, bioware or a stamped limb', async () => {
    assert.deepEqual(X.limbStamp(arm(8, 5)), { strength: 8, quickness: 5 });
    assert.equal(X.limbStamp(arm(8, 5, 1, { strength: 8, quickness: 5 })), null);
    assert.equal(X.limbStamp(cw('dj', 'Datajack', { kind: 'datajack' })), null);
    assert.equal(X.limbStamp(cw('b', 'Cyberarm', { kind: 'cyberlimb', bioware: true })), null);
    const { limbStampUpdate } = await import('../migrations.ts');
    assert.deepEqual(limbStampUpdate(arm(8, 5)), { [`flags.${SYSTEM_ID}.${X.LIMB_PAID_FLAG}`]: { strength: 8, quickness: 5 } });
    assert.equal(limbStampUpdate(arm(8, 5, 1, { strength: 8, quickness: 5 })), null);
  });
  test('the migration step stamps world actors\' limbs, an unlinked token\'s own limbs and world items, and is safe twice', async () => {
    const { stampLimbs99 } = await import('../migrations.ts');
    const g = globalThis as any;
    const saved = g.game;
    const ups: any[] = [];
    const actor = (uuid: string, items: any[], token?: any) => ({ uuid, items, isToken: Boolean(token), token,
      async updateEmbeddedDocuments(_t: string, list: any[]) { for (const u of list) { ups.push([uuid, u]); const it = items.find((i) => i.id === u._id); const k = Object.keys(u).find((x) => x.startsWith('flags.'))!; it.flags = { [SYSTEM_ID]: { [X.LIMB_PAID_FLAG]: u[k] } }; } } });
    const own = { ...arm(8, 4), id: 'own' };
    const shown = { ...arm(9, 4), id: 'shown' };
    const tokenActor = actor('Scene.s.Token.t.Actor.a', [own, shown], { delta: { _source: { items: [{ _id: 'own' }] } } });
    const worldItem: any = { ...arm(7, 3), id: 'wi', async update(u: any) { ups.push(['item', u]); const k = Object.keys(u)[0]!; this.flags = { [SYSTEM_ID]: { [X.LIMB_PAID_FLAG]: u[k] } }; } };
    g.game = { actors: [actor('Actor.a', [{ ...arm(10, 5), id: 'a1' }, cw('dj', 'Datajack', { kind: 'datajack' })])], scenes: [{ tokens: [{ actorLink: false, actor: tokenActor }] }], items: [worldItem] };
    try {
      assert.equal(await stampLimbs99(), 3, 'the world actor\'s arm, the token\'s own arm, the world item');
      assert.deepEqual(ups.map(([w, u]) => [w, u._id ?? 'wi']), [['Actor.a', 'a1'], ['Scene.s.Token.t.Actor.a', 'own'], ['item', 'wi']]);
      assert.equal(await stampLimbs99(), 0, 'a second run changes nothing');
    } finally { g.game = saved; }
  });
  test('the statblock importer stamps a cyberlimb whose Essence the block states (not one it guesses)', () => {
    const stated = statBlockItems(parseStatBlock('Cyberware: Cyberarm (Strength 8, 1.8 Essence)')).items.find((i) => i.name === 'Cyberarm')!;
    assert.equal(stated.system['essenceCost'], 1.8);
    assert.deepEqual(stated.flags?.[SYSTEM_ID]?.[X.LIMB_PAID_FLAG], { strength: 8, quickness: 0 });
    assert.equal(X.limbEssenceCost(1.8, { ...stated, flags: stated.flags } as any, 'human'), 1.8);
    const guessed = statBlockItems(parseStatBlock('Cyberware: Cyberarm (Strength 8)')).items.find((i) => i.name === 'Cyberarm')!;
    assert.equal(guessed.flags, undefined);
  });
  test('v980: the stamp changes nothing (no enhancement Essence at all)', (t) => {
    t.after(oldWay(WARE_V980_WAY));
    assert.equal(X.limbEssenceCost(1.8, arm(9, 3, 1.8, { strength: 8, quickness: 3 }), 'human'), 1.8);
    assert.equal(X.limbEssenceCost(1.8, arm(9, 3, 1.8), 'human'), 1.8);
  });
});

describe('v0.99.0 fix C5: orthoskin against plating counts only working ware', () => {
  test('plating its damage level stops is not working: orthoskin counts alone', () => {
    assert.ok(X.orthoPlating([ortho(2), plating(1)]), 'both working: one of them is dropped');
    assert.equal(X.orthoPlating([ortho(2), plating(1)], new Set(), { working: (i) => i.id !== 'dp' }), null);
    assert.equal(X.wareNotes([ortho(2), plating(1)], new Set(), { working: (i) => i.id !== 'dp' }).length, 0);
  });
  test('Light plating compares at half its Body: plating 2 (Light: 1, so 2) loses to orthoskin 3', () => {
    assert.equal(X.orthoPlating([ortho(3), plating(2)])!.better, 'Dermal plating 2', 'undamaged: 4 against 3');
    const light = X.orthoPlating([ortho(3), plating(2)], new Set(), { light: (i) => i.id === 'dp' })!;
    assert.equal(light.better, 'Orthoskin 3');
    assert.deepEqual([...light.drop], ['dp']);
  });
  test('v980: no comparison either way', (t) => {
    t.after(oldWay(WARE_V980_WAY));
    assert.equal(X.orthoPlating([ortho(3), plating(2)], new Set(), { light: () => true }), null);
  });
});
