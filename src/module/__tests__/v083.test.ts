/**
 * v0.83.0: the default token art. The lookup (rules/tokenart.ts) against the drawings (src/art/) and the files
 * built from them (public/tokens/), the files' safety (no text, scripts, outside links or images), and the glue
 * (applications/tokenart.ts) with small stubs: what an actor gets, what is never replaced, the sheet controls.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  defaultArtFor, allArtPaths, isDefaultArt, figureFromName, archetypeFor, inferArchetype, ART_ROOT, ART_METAS, ART_ARCHETYPES,
  ART_VEHICLES, ART_SPIRITS, isDefaultPortrait, portraitReplaceable,
} from '../rules/index.ts';
import { RULES } from '../rules/config.ts';
import { allArt } from '../../art/index.ts';
import { BADGE_IDS } from '../../art/badges.ts';
import { METAS } from '../../art/people.ts';
import { artInfo, applyDefaultArt, artSheetContext, defaultArtOf, registerDefaultArt, standInCount } from '../applications/tokenart.ts';

const g = globalThis as any;
const root = join(process.cwd(), 'public', 'tokens');
const walk = (d: string): string[] => readdirSync(d).flatMap((x) => { const p = join(d, x); return statSync(p).isDirectory() ? walk(p) : [p]; });
const shipped = walk(root).map((p) => relative(root, p).split('\\').join('/')).sort();
const at = (f: string) => `${ART_ROOT}${f}.svg`;

describe('v0.83.0 the art files', () => {
  test('every file the lookup can return is shipped, and nothing else is', () => {
    const want = allArtPaths().map((p) => p.slice(ART_ROOT.length)).sort();
    assert.deepEqual(shipped, want);
  });
  test('the shipped files are exactly what the drawings build (run npm run tokens after changing a drawing)', () => {
    const built = new Map(allArt().map((f) => [f.file, f.svg]));
    assert.deepEqual([...built.keys()].sort(), shipped);
    for (const f of shipped) assert.equal(readFileSync(join(root, f), 'utf8'), built.get(f), f);
  });
  test('the lookup lists match the drawings', () => {
    assert.deepEqual([...ART_ARCHETYPES], [...BADGE_IDS]);
    assert.deepEqual([...ART_METAS], [...METAS]);
    // Every metatype the rules know has its own portrait (house-rule metatypes fall back to the human one).
    for (const m of Object.keys(RULES.METATYPES.types)) assert.ok((ART_METAS as readonly string[]).includes(m), m);
    // Every vehicle category has its own picture.
    assert.deepEqual(RULES.VEHICLES.categories.map((c) => c.id).sort(), [...ART_VEHICLES].sort());
  });
  test('every file is a small, self-contained SVG: no text, scripts, images, outside links or event handlers', () => {
    for (const f of shipped) {
      const s = readFileSync(join(root, f), 'utf8');
      assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 256 256"/, f);
      assert.match(s, /<title>[^<]+\(default token\)<\/title>/, f);
      assert.ok(s.endsWith('</svg>'), f);
      assert.ok(s.length < 8000, `${f} is ${s.length} bytes`);
      assert.doesNotMatch(s, /<(text|image|script|foreignObject|style|a|iframe|feImage)\b/i, f);
      assert.doesNotMatch(s, /\son[a-z]+\s*=/i, f);
      // The only outside reference is the SVG namespace; every href and url() points inside the file.
      assert.equal(s.split('http://').length - 1, 1, f);
      for (const m of s.matchAll(/(?:href="([^"]*)"|url\(([^)]*)\))/g)) assert.match(m[1] ?? m[2] ?? '', /^#[A-Za-z0-9_-]+$/, `${f}: ${m[0]}`);
      // Tags balance (a cheap well-formedness check).
      const stack: string[] = [];
      for (const t of s.matchAll(/<(\/?)([A-Za-z][\w:-]*)[^>]*?(\/?)>/g)) {
        if (t[1]) assert.equal(stack.pop(), t[2], `${f}: </${t[2]}>`);
        else if (!t[3]) stack.push(t[2]!);
      }
      assert.deepEqual(stack, [], f);
      // Ids are unique in the file, and every reference names one.
      const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
      assert.equal(new Set(ids).size, ids.length, `${f}: duplicate ids`);
      for (const m of s.matchAll(/(?:href="#|url\(#)([^")]+)/g)) assert.ok(ids.includes(m[1]), `${f}: #${m[1]} is not defined`);
    }
  });
});

describe('v0.83.0 the lookup', () => {
  test('people: metatype × figure, with the badge', () => {
    assert.equal(defaultArtFor({ type: 'character', metatype: 'elf', figure: 'fem' }), at('people/elf-fem'));
    assert.equal(defaultArtFor({ type: 'npc', metatype: 'troll', figure: 'masc', archetype: 'merc' }), at('people/troll-masc-merc'));
    assert.equal(defaultArtFor({ type: 'character', metatype: 'ork', figure: 'fem', archetype: 'none', tradition: 'hermetic' }), at('people/ork-fem'));
    // An unknown (house-rule) metatype or figure falls back to the human portrait and the name's figure.
    assert.equal(defaultArtFor({ type: 'character', metatype: 'gnome', figure: 'masc' }), at('people/human-masc'));
    assert.equal(defaultArtFor({ type: 'character', metatype: 'human', figure: 'x', name: 'Rook' }), at(`people/human-${figureFromName('Rook')}`));
  });
  test('the figure from a name is stable and both are reachable', () => {
    assert.equal(figureFromName('Rook'), figureFromName('Rook'));
    const seen = new Set(['Ann', 'Bob', 'Cy', 'Dee', 'Eve', 'Fox', 'Gil', 'Hal'].map(figureFromName));
    assert.deepEqual([...seen].sort(), ['fem', 'masc']);
    assert.ok(['masc', 'fem'].includes(figureFromName(undefined)));
  });
  test('the automatic archetype', () => {
    assert.equal(inferArchetype({ type: 'character', tradition: 'shamanic' }), 'shaman');
    assert.equal(inferArchetype({ type: 'character', tradition: 'toxic' }), 'shaman');
    assert.equal(inferArchetype({ type: 'character', tradition: 'hermetic' }), 'mage');
    assert.equal(inferArchetype({ type: 'character', tradition: 'adept' }), 'adept');
    assert.equal(inferArchetype({ type: 'character', hasControlRig: true, hasDeck: true }), 'rigger');
    assert.equal(inferArchetype({ type: 'character', hasDeck: true, combatWare: true }), 'decker');
    assert.equal(inferArchetype({ type: 'character', combatWare: true }), 'samurai');
    assert.equal(inferArchetype({ type: 'character', attributes: { charisma: 6, body: 3, quickness: 4, strength: 2, intelligence: 5, willpower: 4 } }), 'face');
    // Charisma must be the highest and at least 4.
    assert.equal(inferArchetype({ type: 'character', attributes: { charisma: 5, body: 5 } }), '');
    assert.equal(inferArchetype({ type: 'character', attributes: { charisma: 3 } }), '');
    assert.equal(inferArchetype({ type: 'character' }), '');
    // The sheet's choice wins, then the generator's role.
    assert.equal(archetypeFor({ type: 'npc', archetype: 'suit', generated: 'guard', tradition: 'hermetic' }), 'suit');
    assert.equal(archetypeFor({ type: 'npc', generated: 'guard', tradition: 'hermetic' }), 'security');
    assert.equal(archetypeFor({ type: 'npc', generated: 'doc' }), 'medic');
    assert.equal(archetypeFor({ type: 'npc', generated: 'talismonger' }), 'talisman');
    assert.equal(archetypeFor({ type: 'npc', archetype: 'none', generated: 'guard' }), '');
    assert.equal(archetypeFor({ type: 'npc', generated: 'unknownRole', hasDeck: true }), 'decker');
  });
  test('every NPC-generator archetype has a badge', async () => {
    const { ARCHETYPES } = await import('../rules/npcgen.ts');
    for (const a of ARCHETYPES) assert.ok(archetypeFor({ type: 'npc', generated: a.id }), a.id);
  });
  test('critters', () => {
    assert.equal(defaultArtFor({ type: 'npc', generated: 'critter:wolf', critter: true }), at('critters/wolf'));
    assert.equal(defaultArtFor({ type: 'npc', generated: 'critter:awakenedWolf' }), at('critters/awakenedWolf'));
    assert.equal(defaultArtFor({ type: 'npc', critter: true }), at('critters/critter'));
    assert.equal(defaultArtFor({ type: 'npc', generated: 'critter:basilisk' }), at('critters/critter'));
  });
  test('spirits: elementals by element, nature spirits by domain, the other kinds', async () => {
    for (const e of ['fire', 'water', 'air', 'earth']) {
      assert.equal(defaultArtFor({ type: 'spirit', spiritKind: 'elemental', element: e }), at(`spirits/elemental-${e}`));
      assert.equal(defaultArtFor({ type: 'spirit', spiritKind: 'elemental', spiritType: `${e[0]!.toUpperCase()}${e.slice(1)} elemental` }), at(`spirits/elemental-${e}`));
    }
    const domain: Record<string, string> = {
      'hearth spirit': 'man', 'city spirit': 'man', 'field spirit': 'land', 'forest spirit': 'land', 'mountain spirit': 'land', 'desert spirit': 'land',
      'river spirit': 'water', 'lake spirit': 'water', 'sea spirit': 'water', 'swamp spirit': 'water', 'storm spirit': 'sky', 'wind spirit': 'sky', 'mist spirit': 'sky',
    };
    for (const [t, d] of Object.entries(domain)) assert.equal(defaultArtFor({ type: 'spirit', spiritKind: 'nature', spiritType: t }), at(`spirits/nature-${d}`), t);
    for (const k of ['watcher', 'ally', 'free', 'toxic', 'insect']) assert.equal(defaultArtFor({ type: 'spirit', spiritKind: k }), at(`spirits/${k}`));
    assert.equal(defaultArtFor({ type: 'spirit', spiritKind: 'other' }), at('spirits/spirit'));
    assert.equal(defaultArtFor({ type: 'spirit', spiritKind: 'elemental' }), at('spirits/spirit'));
    assert.ok((ART_SPIRITS as readonly string[]).includes('spirit'));
  });
  test('vehicles and drones', () => {
    for (const c of ART_VEHICLES) assert.equal(defaultArtFor({ type: 'vehicle', category: c }), at(`vehicles/${c}`));
    assert.equal(defaultArtFor({ type: 'vehicle', category: 'hoverbike' }), at('vehicles/other'));
    assert.equal(defaultArtFor({ type: 'vehicle', category: 'rotor', drone: true }), at('vehicles/drone-rotor'));
    assert.equal(defaultArtFor({ type: 'vehicle', category: 'car', drone: true }), at('vehicles/drone-ground'));
    assert.equal(defaultArtFor({ type: 'vehicle', category: 'lta', drone: true }), at('vehicles/drone-wing'));
    assert.equal(defaultArtFor({ type: 'vehicle', category: 'boat', drone: true }), at('vehicles/drone-water'));
  });
  test('the Matrix and the rest', () => {
    for (const c of ['white', 'gray', 'black']) assert.equal(defaultArtFor({ type: 'ic', icCategory: c }), at(`matrix/ic-${c}`));
    assert.equal(defaultArtFor({ type: 'ic', icCategory: '' }), at('matrix/ic-white'));
    assert.equal(defaultArtFor({ type: 'host' }), at('matrix/host'));
    assert.equal(defaultArtFor({ type: 'barrier' }), at('misc/barrier'));
    assert.equal(defaultArtFor({ type: 'site' }), at('misc/site'));
    assert.equal(defaultArtFor({ type: 'safehouse' }), at('misc/safehouse'));
    assert.equal(defaultArtFor({ type: 'base' }), null);
  });
  test('the default art counts as a stand-in for portraits by name; a hand-set picture does not', () => {
    assert.ok(isDefaultArt(at('people/elf-fem')));
    assert.ok(isDefaultArt('/' + at('people/elf-fem')));
    assert.ok(!isDefaultArt('worlds/x/rook.webp'));
    assert.ok(!isDefaultArt('systems/sr2e/icons/wound-l.svg'));
    // Re-review: only the exact files, not anything under the folder.
    assert.ok(!isDefaultArt('systems/sr2e/tokens/../../worlds/x.png'));
    assert.ok(!isDefaultArt('systems/sr2e/tokens/people/nobody.svg'));
    assert.ok(isDefaultPortrait(at('vehicles/car')));
    assert.ok(portraitReplaceable(at('people/human-masc'), null));
    assert.ok(!isDefaultPortrait('icons/svg/sword.svg'));
  });
});

// ---------------------------------------------------------------- The glue, with stubs

function stubGame(o: { gm?: boolean; scenes?: any[] } = {}) {
  g.game = {
    settings: { get: (_m: string, k: string) => (k === 'defaultArt' ? true : undefined) },
    user: { id: 'u1', isGM: o.gm ?? false },
    scenes: o.scenes ?? [],
    actors: Object.assign([], { get: (id: string) => (g.__actors ?? {})[id] }),
  };
  g.CONFIG = { Actor: { documentClass: { DEFAULT_ICON: 'icons/svg/mystery-man.svg' } } };
  g.CONST = { DEFAULT_TOKEN: 'icons/svg/mystery-man.svg' };
}

function fakeActor(d: any): any {
  const a: any = {
    id: 'a1', isOwner: true, type: 'character', name: 'Rook', img: 'icons/svg/mystery-man.svg',
    prototypeToken: { texture: { src: 'icons/svg/mystery-man.svg' } }, flags: {}, items: [],
    system: { metatype: 'human', art: { figure: '', archetype: '' }, tradition: 'none', attributes: {} },
    updates: [] as any[],
    async update(u: any, opts: any) { a.updates.push({ u, opts }); return a; },
    ...d,
  };
  (g.__actors ??= {})[a.id] = a; // the world's actor list (the follow-up checks the actor still exists)
  return a;
}

describe('v0.83.0 the glue', () => {
  test('artInfo reads the actor: items, attributes, flags', () => {
    stubGame();
    const a = fakeActor({
      items: [
        { type: 'cyberware', system: { installed: true, controlRig: 2 } },
        { type: 'cyberware', system: { installed: false, reflexes: 'wired' } },
        { type: 'cyberdeck', system: {} },
      ],
      system: { metatype: 'dwarf', art: { figure: 'fem', archetype: '' }, tradition: 'none', attributes: { charisma: { base: 4, mod: 1 } } },
      flags: { sr2e: { generated: { archetype: 'tech' } } },
    });
    const i = artInfo(a);
    assert.equal(i.hasControlRig, true);
    assert.equal(i.combatWare, false, 'uninstalled ware does not count');
    assert.equal(i.hasDeck, true);
    assert.equal(i.attributes?.['charisma'], 5);
    assert.equal(i.generated, 'tech');
    assert.equal(defaultArtOf(a), at('people/dwarf-fem-tech'));
  });
  test('applyDefaultArt replaces stand-ins, stores the figure with the art, and never a hand-set picture', async () => {
    stubGame();
    const a = fakeActor({});
    assert.equal(await applyDefaultArt(a, 'standin'), true);
    const u = a.updates[0].u;
    const fig = figureFromName('Rook');
    assert.equal(u['system.art.figure'], fig);
    assert.equal(u['img'], at(`people/human-${fig}`));
    assert.equal(u['prototypeToken.texture.src'], at(`people/human-${fig}`));
    assert.equal(u['flags.sr2e.artAuto'], at(`people/human-${fig}`));
    assert.equal(a.updates[0].opts.sr2eArt, true);
    // 'auto' (the follow-up hooks) leaves stand-ins alone.
    const b = fakeActor({ system: { metatype: 'elf', art: { figure: 'masc', archetype: '' }, attributes: {} } });
    assert.equal(await applyDefaultArt(b, 'auto'), false);
    assert.equal(b.updates.length, 0);
    // Review fix 2: an actor with pictures of its own gets no write at all (not even the figure) from the bulk button.
    const c = fakeActor({ img: 'worlds/w/rook.webp', prototypeToken: { texture: { src: 'worlds/w/rook-token.webp' } } });
    assert.equal(await applyDefaultArt(c, 'standin'), false);
    assert.equal(c.updates.length, 0);
    // A custom token is pinned so Foundry doesn't copy the new picture onto it.
    const d = fakeActor({ img: at('people/human-masc'), flags: { sr2e: { artAuto: at('people/human-masc') } }, prototypeToken: { texture: { src: 'worlds/w/tok.webp' } }, system: { metatype: 'troll', art: { figure: 'masc', archetype: '' }, attributes: {} } });
    assert.equal(await applyDefaultArt(d, 'auto'), true);
    assert.equal(d.updates[0].u['img'], at('people/troll-masc'));
    assert.equal(d.updates[0].u['prototypeToken.texture.src'], 'worlds/w/tok.webp');
    assert.equal(d.updates[0].opts.diff, false);
    // Review risk 4: a system art file picked by hand (not the one the system set) is kept.
    const h = fakeActor({ img: at('critters/wolf'), prototypeToken: { texture: { src: at('critters/wolf') } }, flags: { sr2e: { artAuto: at('people/human-masc') } }, system: { metatype: 'ork', art: { figure: 'masc', archetype: '' }, attributes: {} } });
    assert.equal(await applyDefaultArt(h, 'auto'), false);
    assert.equal(await applyDefaultArt(h, 'standin'), false);
    // Not the owner, or an unlinked token's actor: nothing.
    assert.equal(await applyDefaultArt(fakeActor({ isOwner: false }), 'force'), false);
    assert.equal(await applyDefaultArt(fakeActor({ isToken: true }), 'force'), false);
  });
  test('the GM also updates linked tokens showing the old default or the stand-in, not unlinked or hand-set ones', async () => {
    const calls: any[] = [];
    const scene = {
      tokens: [
        { id: 't1', actorId: 'a1', actorLink: true, texture: { src: at('people/human-masc') } },
        { id: 't2', actorId: 'a1', actorLink: false, texture: { src: at('people/human-masc') } },
        { id: 't3', actorId: 'a1', actorLink: true, texture: { src: 'worlds/w/custom.webp' } },
        { id: 't4', actorId: 'zz', actorLink: true, texture: { src: at('people/human-masc') } },
        { id: 't5', actorId: 'a1', actorLink: true, texture: { src: 'icons/svg/mystery-man.svg' } },
      ],
      async updateEmbeddedDocuments(_t: string, u: any[]) { calls.push(u); },
    };
    stubGame({ gm: true, scenes: [scene] });
    const a = fakeActor({ img: at('people/human-masc'), flags: { sr2e: { artAuto: at('people/human-masc') } }, prototypeToken: { texture: { src: at('people/human-masc') } }, system: { metatype: 'ork', art: { figure: 'masc', archetype: '' }, attributes: {} } });
    assert.equal(await applyDefaultArt(a, 'auto'), true);
    assert.deepEqual(calls, [[{ _id: 't1', 'texture.src': at('people/ork-masc') }, { _id: 't5', 'texture.src': at('people/ork-masc') }]]);
    // Review risk 8: the sheet button ('force') also takes the linked tokens that showed the actor's old token picture.
    calls.length = 0;
    const b = fakeActor({ img: 'worlds/w/custom.webp', prototypeToken: { texture: { src: 'worlds/w/custom.webp' } }, system: { metatype: 'elf', art: { figure: 'fem', archetype: '' }, attributes: {} } });
    assert.equal(await applyDefaultArt(b, 'force'), true);
    assert.deepEqual(calls[0]!.map((x: any) => x._id), ['t3', 't5']);
  });
  test('review fix 1: the GM panel counts only actors still showing Foundry\'s stand-in', () => {
    stubGame();
    g.game.actors = [
      fakeActor({}),
      fakeActor({ img: at('people/human-masc'), prototypeToken: { texture: { src: at('people/human-masc') } } }),
      fakeActor({ img: 'worlds/w/x.webp', prototypeToken: { texture: { src: 'worlds/w/x.webp' } } }),
      fakeActor({ img: 'worlds/w/y.webp', prototypeToken: { texture: { src: 'icons/svg/mystery-man.svg' } } }),
    ];
    assert.equal(standInCount(), 2);
  });
  test('the sheet controls: people only, not critters', () => {
    stubGame();
    const a = fakeActor({ system: { metatype: 'human', art: { figure: '', archetype: '' }, tradition: 'hermetic', attributes: {} } });
    const c = artSheetContext(a)!;
    assert.equal(c.figures[0]!.id, '');
    assert.match(c.figures[0]!.label, /From the name/);
    assert.equal(c.archetypes[0]!.label, 'Automatic (Mage)');
    assert.ok(c.archetypes.some((x) => x.id === 'none'));
    assert.equal(c.isDefault, false);
    assert.equal(c.standIn, true);
    const stored = artSheetContext(fakeActor({ img: at('people/human-fem'), flags: { sr2e: { artAuto: at('people/human-fem') } }, system: { metatype: 'human', art: { figure: 'fem', archetype: 'face' }, attributes: {} } }))!;
    assert.deepEqual(stored.figures.map((f) => f.id), ['masc', 'fem']);
    assert.equal(stored.figures.find((f) => f.selected)?.id, 'fem');
    assert.equal(stored.archetypes.find((f) => f.selected)?.id, 'face');
    assert.equal(stored.isDefault, true);
    assert.equal(stored.standIn, false);
    assert.equal(artSheetContext(fakeActor({ flags: { sr2e: { critter: true } } })), null);
    assert.equal(artSheetContext(fakeActor({ type: 'vehicle' })), null);
  });
  test('review risk 9: wired reflexes left to "guess from the name" count as combat ware', () => {
    stubGame();
    const a = fakeActor({ items: [{ type: 'cyberware', name: 'Wired Reflexes 2', system: { installed: true, reflexes: '', kind: 'other' } }] });
    assert.equal(artInfo(a).combatWare, true);
  });
  test('the templates carry the controls and the GM panel the button', () => {
    const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
    for (const t of ['actor-character-sheet.hbs', 'actor-npc-sheet.hbs']) {
      const s = read('public', 'templates', t);
      assert.match(s, /name="system\.art\.figure"/, t);
      assert.match(s, /name="system\.art\.archetype"/, t);
      assert.match(s, /data-action="useDefaultArt"/, t);
    }
    assert.match(read('public', 'templates', 'gm-panel.hbs'), /data-action="defaultArtAll"/);
    assert.match(read('src', 'module', 'applications', 'setup.ts'), /defaultArtAll:/);
    assert.match(read('src', 'module', 'applications', 'sheets.ts'), /useDefaultArt: function/);
  });
  test('the hooks: a new actor gets its art in preCreate; later changes follow only while the system\'s art is on it', async () => {
    stubGame();
    const hooks: Record<string, Function> = {};
    g.Hooks = { on: (k: string, f: Function) => { hooks[k] = f; } };
    registerDefaultArt();
    const wait = () => new Promise((r) => setTimeout(r, 150));
    const fig = figureFromName('Rook');
    // A new character with the stand-in: the figure, both pictures and the flag.
    const src: any[] = [];
    const a = fakeActor({ updateSource: (u: any) => src.push(u) });
    hooks['preCreateActor']!(a, { name: 'Rook' });
    assert.deepEqual(src[0], { 'system.art.figure': fig, img: at(`people/human-${fig}`), 'prototypeToken.texture.src': at(`people/human-${fig}`), 'flags.sr2e.artAuto': at(`people/human-${fig}`) });
    // A new actor with pictures of its own: nothing at all.
    const own: any[] = [];
    const b = fakeActor({ img: 'worlds/w/b.webp', prototypeToken: { texture: { src: 'worlds/w/b.webp' } }, updateSource: (u: any) => own.push(u) });
    hooks['preCreateActor']!(b, { img: 'worlds/w/b.webp' });
    assert.deepEqual(own, []);
    // Review risk 5: the pending actor's token (custom) wins over stand-in creation data.
    const tk: any[] = [];
    const t = fakeActor({ prototypeToken: { texture: { src: 'worlds/w/t.webp' } }, updateSource: (u: any) => tk.push(u) });
    hooks['preCreateActor']!(t, { prototypeToken: { texture: { src: 'icons/svg/mystery-man.svg' } } });
    assert.equal(tk[0]['prototypeToken.texture.src'], undefined);
    // A generated critter: no figure, the critter's picture.
    const cr: any[] = [];
    const c = fakeActor({ type: 'npc', flags: { sr2e: { critter: true, generated: { archetype: 'critter:bear' } } }, updateSource: (u: any) => cr.push(u) });
    hooks['preCreateActor']!(c, {});
    assert.deepEqual(cr[0], { img: at('critters/bear'), 'prototypeToken.texture.src': at('critters/bear'), 'flags.sr2e.artAuto': at('critters/bear') });
    // Updates: one client (no active GM here: the changing user), relevant paths only, only while the system's art is on.
    const art = { img: at('people/human-masc'), flags: { sr2e: { artAuto: at('people/human-masc') } }, prototypeToken: { texture: { src: at('people/human-masc') } } };
    const d = fakeActor({ ...art, system: { metatype: 'elf', art: { figure: 'masc', archetype: '' }, attributes: {} } });
    hooks['updateActor']!(d, { system: { metatype: 'elf' } }, {}, 'someone-else');
    hooks['updateActor']!(d, { system: { karma: { good: 1 } } }, {}, 'u1');
    hooks['updateActor']!(d, { system: { metatype: 'elf' } }, { sr2eArt: true }, 'u1');
    await wait();
    assert.equal(d.updates.length, 0);
    hooks['updateActor']!(d, { system: { metatype: 'elf' } }, {}, 'u1');
    await wait();
    assert.equal(d.updates[0].u['img'], at('people/elf-masc'));
    // Review fix 3: with an active GM, the GM's client follows a player's change (and not the player's).
    // v0.85.0: like Foundry's, the stub's active GM says whether it is this client's user (isSelf).
    g.game.users = { activeGM: { id: 'gm1', get isSelf() { return g.game.user?.id === 'gm1'; } } };
    const p = fakeActor({ ...art, system: { metatype: 'dwarf', art: { figure: 'masc', archetype: '' }, attributes: {} } });
    hooks['updateActor']!(p, { system: { metatype: 'dwarf' } }, {}, 'u1');
    await wait();
    assert.equal(p.updates.length, 0, 'the player client leaves it to the GM');
    g.game.user.id = 'gm1';
    hooks['updateActor']!(p, { system: { metatype: 'dwarf' } }, {}, 'u1');
    await wait();
    assert.equal(p.updates[0].u['img'], at('people/dwarf-masc'));
    g.game.user.id = 'u1'; delete g.game.users;
    const e = fakeActor({ system: { metatype: 'elf', art: { figure: 'masc', archetype: '' }, attributes: {} } });
    hooks['updateActor']!(e, { system: { metatype: 'elf' } }, {}, 'u1');
    await wait();
    assert.equal(e.updates.length, 0, 'a stand-in is left for the GM button or the sheet button');
    // Review risk 6: a burst of item adds gives one update.
    const f = fakeActor({ ...art, system: { metatype: 'human', art: { figure: 'masc', archetype: '' }, attributes: {} } });
    f.documentName = 'Actor';
    f.items = [{ type: 'cyberware', system: { installed: true, controlRig: 1 } }];
    for (let i = 0; i < 3; i++) hooks['createItem']!({ type: 'cyberware', parent: f }, {}, 'u1');
    await wait();
    assert.equal(f.updates.length, 1);
    assert.equal(f.updates[0].u['img'], at('people/human-masc-rigger'));
    delete g.Hooks;
  });
  test('re-review: a player\'s own art change reaches their linked tokens through the active GM; renames and deleted actors', async () => {
    const calls: any[] = [];
    const scene = {
      tokens: [
        { id: 't1', actorId: 'a1', actorLink: true, texture: { src: 'worlds/w/old.webp' } },
        { id: 't2', actorId: 'a1', actorLink: true, texture: { src: 'worlds/w/other.webp' } },
      ],
      async updateEmbeddedDocuments(_t: string, u: any[]) { calls.push(u); },
    };
    stubGame({ gm: true, scenes: [scene] });
    g.game.users = { activeGM: { id: 'u1', isSelf: true } };
    const hooks: Record<string, Function> = {};
    g.Hooks = { on: (k: string, f: Function) => { hooks[k] = f; } };
    registerDefaultArt();
    const path = at('people/elf-fem');
    const a = fakeActor({ img: path, prototypeToken: { texture: { src: path } }, flags: { sr2e: { artAuto: path } }, system: { metatype: 'elf', art: { figure: 'fem', archetype: '' }, attributes: {} } });
    // The player pressed the button (their update carries sr2eArt and the old pictures).
    hooks['updateActor']!(a, { img: path, prototypeToken: { texture: { src: path } } }, { sr2eArt: true, sr2eArtWas: ['worlds/w/old.webp'] }, 'player');
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(calls, [[{ _id: 't1', 'texture.src': path }]]);
    // Not when the token isn't the actor's default art now (a forged option can't point tokens anywhere else).
    calls.length = 0;
    const b = fakeActor({ img: 'worlds/w/x.webp', prototypeToken: { texture: { src: 'worlds/w/x.webp' } }, system: { metatype: 'elf', art: { figure: 'fem', archetype: '' }, attributes: {} } });
    hooks['updateActor']!(b, { prototypeToken: { texture: { src: 'worlds/w/x.webp' } } }, { sr2eArt: true, sr2eArtWas: ['worlds/w/old.webp'] }, 'player');
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(calls, []);
    // A renamed cyberware item is looked at again (ware counted by its name).
    const art = { img: at('people/human-masc'), flags: { sr2e: { artAuto: at('people/human-masc') } }, prototypeToken: { texture: { src: at('people/human-masc') } } };
    const c = fakeActor({ ...art, system: { metatype: 'human', art: { figure: 'masc', archetype: '' }, attributes: {} } });
    c.documentName = 'Actor';
    c.items = [{ type: 'cyberware', name: 'Wired Reflexes 1', system: { installed: true } }];
    g.game.actors = { get: (id: string) => (id === c.id ? c : undefined) };
    hooks['updateItem']!({ type: 'cyberware', parent: c }, { name: 'Wired Reflexes 1' }, {}, 'u1');
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(c.updates[0]?.u['img'], at('people/human-masc-samurai'));
    // An actor deleted before the follow-up fires is left alone.
    const d = fakeActor({ ...art, id: 'gone', system: { metatype: 'troll', art: { figure: 'masc', archetype: '' }, attributes: {} } });
    hooks['updateActor']!(d, { system: { metatype: 'troll' } }, {}, 'u1');
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(d.updates.length, 0);
    delete g.Hooks;
  });
});
