/**
 * v0.84.1: the colour pass. Colours mean one thing everywhere: the sheets' area colours and the token rims
 * stay apart with normal vision and with each kind of colour blindness, and every default token's rim is the
 * colour of its category.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THEMES, PRESETS, AREAS, palette, contrastProblems } from '../rules/look.ts';
import { CVD_MIN, CVD_MIN_SWAP, CVD_TEXT_MIN, cvdClashes, cvdDistance, deltaE2000, distanceFor, simulate } from '../rules/colourblind.ts';
import { RIM } from '../../art/frame.ts';
import { BADGES, BADGE_IDS } from '../../art/badges.ts';
import { allArt } from '../../art/index.ts';

const show = (c: Array<{ a: string; b: string; distance: number; kind: string }>) =>
  c.map((x) => `${x.a}/${x.b} ${x.distance.toFixed(1)} (${x.kind})`).join(', ');

describe('colour-blindness maths', () => {
  test('CIEDE2000 matches the published test pairs (Sharma, Wu and Dalal 2005)', () => {
    assert.equal(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]).toFixed(4), '2.0425');
    assert.equal(deltaE2000([50, -1.3802, -84.2814], [50, 0, -82.7485]).toFixed(4), '1.0000');
    assert.equal(deltaE2000([50, 2.5, 0], [73, 25, -18]).toFixed(4), '27.1492');
    assert.equal(deltaE2000([60, 10, 10], [60, 10, 10]), 0);
    // Hue wrap-around and near-zero chroma (more pairs from the published set).
    assert.equal(deltaE2000([50, 0, 0], [50, -1, 2]).toFixed(4), '2.3669');
    assert.equal(deltaE2000([50, -0.001, 2.49], [50, 0.0011, -2.49]).toFixed(4), '4.7461');
    assert.equal(deltaE2000([50, 2.49, -0.001], [50, -2.49, 0.0011]).toFixed(4), '7.2195');
  });

  test('the simulations behave: red and green collapse for red-green blindness, not for normal vision', () => {
    assert.ok(distanceFor('#d03030', '#30a030', 'normal') > 40);
    assert.ok(distanceFor('#c8582c', '#6c8a2c', 'deutan') < distanceFor('#c8582c', '#6c8a2c', 'normal') / 3);
    assert.deepEqual(simulate('#ffffff', 'protan').map((v) => Math.round(v * 100) / 100), [1, 1, 1]);
    assert.equal(cvdDistance('#123456', '#123456').distance, 0);
    assert.equal(cvdDistance('#abc', '#aabbcc').distance, 0);
    assert.throws(() => cvdDistance('red', '#000000'));
    assert.throws(() => cvdDistance('#12345', '#000000'));
  });
});

describe('the sheets\' area colours stay apart (every theme and preset)', () => {
  for (const theme of THEMES) for (const preset of PRESETS) {
    test(`${theme} / ${preset}`, () => {
      const p = palette(theme, preset);
      const colours = Object.fromEntries(AREAS.map((a) => [a, p.areas[a].base]));
      // The Phosphor green preset swaps the Matrix area for a cyan; on High contrast that swap has less room.
      const swapped = preset === 'green' && theme === 'contrast';
      const min = swapped ? CVD_MIN_SWAP : CVD_MIN;
      assert.deepEqual(show(cvdClashes(colours, min)), '');
      if (swapped) {
        const rest = Object.fromEntries(Object.entries(colours).filter(([a]) => a !== 'matrix'));
        assert.deepEqual(show(cvdClashes(rest, CVD_MIN)), '');
      }
      // Area headings: a lower floor, since a heading sits under its own tab and is never matched against another by colour alone.
      const texts = Object.fromEntries(AREAS.map((a) => [a, p.areas[a].text]));
      assert.deepEqual(show(cvdClashes(texts, CVD_TEXT_MIN)), '');
      // The tuning kept every WCAG minimum.
      assert.deepEqual(contrastProblems(p).map((x) => x.what), []);
    });
  }
});

describe('the token rims', () => {
  test('the six area rims are the Street theme\'s area colours', () => {
    const areas = palette('street', 'cyan').areas;
    for (const a of AREAS) assert.equal(RIM[a], areas[a].base, a);
  });

  test('every pair of rims stays apart', () => {
    assert.deepEqual(show(cvdClashes({ ...RIM }, CVD_MIN)), '');
  });

  test('the plain portraits no longer use the interface accent', () => {
    assert.notEqual(RIM.plain.toLowerCase(), palette('street', 'cyan').accent.toLowerCase());
    // A neutral: hardly any colour, so it can't be mistaken for an area.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(RIM.plain.slice(i, i + 2), 16));
    assert.ok(Math.max(r!, g!, b!) - Math.min(r!, g!, b!) < 30);
  });

  /** The rim colour each file must have (the middle stop of its rim gradient). */
  function expected(file: string): string {
    const [folder, name] = file.replace(/\.svg$/, '').split('/') as [string, string];
    if (folder === 'vehicles') return RIM.rigging;
    if (folder === 'spirits') return RIM.magic;
    if (folder === 'matrix') return RIM.matrix;
    if (folder === 'critters') return RIM.critter;
    if (folder === 'misc') return ({ barrier: RIM.magic, site: RIM.security, safehouse: RIM.street } as Record<string, string>)[name]!;
    const badge = BADGE_IDS.find((b) => name.endsWith('-' + b));
    return badge ? BADGES[badge].rim : RIM.plain;
  }

  test('every one of the 202 files has its category\'s rim', () => {
    const files = allArt();
    assert.equal(files.length, 202);
    const wrong: string[] = [];
    for (const f of files) {
      const m = /-rim" [^>]*>(?:<stop [^>]*>)<stop offset="\.5" stop-color="(#[0-9a-f]{6})"/.exec(f.svg);
      if (!m || m[1] !== expected(f.file)) wrong.push(`${f.file}: ${m?.[1]} (want ${expected(f.file)})`);
    }
    assert.deepEqual(wrong, []);
  });

  test('a badge\'s disc and the rim round its portrait are the same colour', () => {
    let badged = 0;
    for (const f of allArt().filter((x) => x.file.startsWith('people/'))) {
      const disc = /stroke="(#[0-9a-f]{6})" stroke-width="4"\/><g transform="translate\(170 170\)/.exec(f.svg);
      const hasBadge = BADGE_IDS.some((b) => f.file.endsWith(`-${b}.svg`));
      assert.equal(!!disc, hasBadge, f.file);
      if (!disc) continue;
      badged++;
      assert.equal(disc[1], expected(f.file), f.file);
    }
    assert.equal(badged, 150); // 5 metatypes × 2 figures × 15 badges
  });

  test('archetype badges by area: combat red, magic purple, Matrix green, rigging orange, street gold, health teal, security blue', () => {
    const by = (rim: string) => BADGE_IDS.filter((b) => BADGES[b].rim === rim).sort();
    assert.deepEqual(by(RIM.combat), ['ganger', 'merc', 'samurai']);
    assert.deepEqual(by(RIM.magic), ['adept', 'mage', 'shaman', 'talisman']);
    assert.deepEqual(by(RIM.matrix), ['decker']);
    assert.deepEqual(by(RIM.rigging), ['rigger', 'tech']);
    assert.deepEqual(by(RIM.street), ['face', 'fixer', 'suit']);
    assert.deepEqual(by(RIM.health), ['medic']);
    assert.deepEqual(by(RIM.security), ['security']);
  });

  test('the built files match the drawings (run npm run tokens after a change)', () => {
    for (const f of allArt()) assert.equal(readFileSync(join(process.cwd(), 'public', 'tokens', f.file), 'utf8'), f.svg, f.file);
  });
});
