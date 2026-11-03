# SR2e v0.83.0 live-test plan: default token art

World **SR2E AI Test** on Foundry v14. Tab G is the GM (**GM AI**). Tab P is the player (**ZZ Testplayer**). You run every check by hand in the browser's JavaScript console.

## Ground rules

- **Never touch the user's 22 actors or the 24 Safehouse tokens.** Every test document is named `ZZ …`. All of them are deleted at the end (section 17).
- **Never call `game.sr2e.api.defaultArtForAll()`.** Never confirm the GM panel's "Give them the default art…" dialog. Always cancel it.
- The temporary scene `ZZ Art Map` is only *viewed* on tab G (`scene.view()`). Never activate it.
- The world stays paused. Nothing here moves a token.
- Keep each console call short (each one finishes well under 40 s). Wait for the hooks with `await zzW(…)`. The art hooks run without being awaited (`void applyDefaultArt`).
- Paths below are relative to `systems/sr2e/tokens/`. "Expected `people/elf-fem-rigger`" means `img` and `prototypeToken.texture.src` both equal `systems/sr2e/tokens/people/elf-fem-rigger.svg`.
- Figures picked from the name (computed with the same hash as `figureFromName`):

  | Name | Figure |
  |---|---|
  | ZZ Art Runner | fem |
  | ZZ Art Items | fem |
  | ZZ Art Dbl | fem |
  | ZZ Rook | fem |
  | ZZ Player Char | fem |
  | ZZ Art Player NPC | fem |
  | ZZ Art Off Y | fem |
  | ZZ Art NPC | masc |
  | ZZ Art Custom | masc |
  | ZZ Art Pin | masc |
  | ZZ Art Linked | masc |
  | ZZ Art Off | masc |
  | ZZ Art Face | masc |

- Possible defects that code reading predicts are marked **[D1]…[D5]**. For each one, record the behaviour you actually see.

---

## 0. Setup (tab G)

**0.1 Helpers.** Paste once per tab, and again after any reload:
```js
window.zzW = ms => new Promise(r => setTimeout(r, ms));
window.zzA = n => game.actors.getName(n);
window.zzS = a => ({ img: a.img.replace('systems/sr2e/tokens/',''), tok: a.prototypeToken.texture.src.replace('systems/sr2e/tokens/',''), fig: a.system.art?.figure, arch: a.system.art?.archetype, def: (game.sr2e.api.defaultArtOf(a) ?? '').replace('systems/sr2e/tokens/','') });
if (!window.zzErr) { window.zzErr = []; window.zzNote = [];
  const oe = console.error; console.error = (...a) => { zzErr.push(a.map(x => x?.stack ?? String(x)).join(' ').slice(0, 400)); oe.apply(console, a); };
  const ow = console.warn;  console.warn  = (...a) => { const s = a.map(String).join(' '); if (/sr2e|valid|permission|lack/i.test(s)) zzErr.push('WARN ' + s.slice(0, 300)); ow.apply(console, a); };
  addEventListener('error', e => zzErr.push('ONERROR ' + e.message));
  addEventListener('unhandledrejection', e => zzErr.push('REJECT ' + (e.reason?.stack ?? e.reason)));
  const n = ui.notifications.notify.bind(ui.notifications);
  ui.notifications.notify = (m, t, o) => { zzNote.push(`${t}: ${m}`); return n(m, t, o); }; }
'ok'
```

**0.2 Preconditions and safety snapshot.**
```js
const sh = game.scenes.getName('Safehouse');
const snap = { actors: game.actors.contents.map(a => [a.id, a.name, a.img, a.prototypeToken.texture.src, a._stats.modifiedTime]),
  tokens: sh.tokens.map(t => [t.id, t.texture.src, t._stats.modifiedTime]), folders: game.folders.map(f => f.id), journals: game.journal.size, scenes: game.scenes.map(s => s.id),
  set: { defaultArt: game.settings.get('sr2e','defaultArt'), portraitFolder: game.settings.get('sr2e','portraitFolder'), portraitTokens: game.settings.get('sr2e','portraitTokens') },
  viewed: canvas.scene?.id, active: game.scenes.active?.id };
localStorage.setItem('zzSnap083', JSON.stringify(snap));
({ version: game.system.version, gm: game.user.isGM, user: game.user.name, paused: game.paused, actors: game.actors.size, zz: game.actors.filter(a => a.name.startsWith('ZZ')).length,
   shTokens: sh.tokens.size, viewed: canvas.scene?.name, set: snap.set, genFolder: !!game.folders.find(f => f.name === 'Generated (SR2e)'), icon: CONFIG.Actor.documentClass.DEFAULT_ICON })
```
Expected:
- `version` is `"0.83.0"`, `gm` is true, `user` is `"GM AI"` and `paused` is true.
- `actors` is 22, `zz` is 0, `shTokens` is 24 and `viewed` is `"Safehouse"`.
- `icon` is `icons/svg/mystery-man.svg`.
- `set.defaultArt` should be true; write down all three settings.
- Write down `genFolder`. If it is already true, clean-up must **not** delete that folder (only the actors added in this test).

**0.3 Safety comparator.** Run it after the risky steps and at the end:
```js
window.zzSafe = () => { const s = JSON.parse(localStorage.getItem('zzSnap083')); const sh = game.scenes.getName('Safehouse');
  const actorsChanged = s.actors.filter(([id, n, img, tok, m]) => { const a = game.actors.get(id); return !a || a.img !== img || a.prototypeToken.texture.src !== tok || a._stats.modifiedTime !== m; }).map(x => x[1]);
  const tokensChanged = s.tokens.filter(([id, src, m]) => { const t = sh.tokens.get(id); return !t || t.texture.src !== src || t._stats.modifiedTime !== m; }).length;
  return { actorsChanged, tokensChanged, shTokens: sh.tokens.size }; };
zzSafe()
```
Expected: `{ actorsChanged: [], tokensChanged: 0, shTokens: 24 }`. This must hold every time it runs.

---

## 1. API and setting

**1.1**
```js
const api = game.sr2e.api; ({ defaultArtOf: typeof api.defaultArtOf, applyDefaultArt: typeof api.applyDefaultArt, defaultArtForAll: typeof api.defaultArtForAll,
  setting: game.settings.settings.get('sr2e.defaultArt') && { scope: game.settings.settings.get('sr2e.defaultArt').scope, def: game.settings.settings.get('sr2e.defaultArt').default, restricted: game.settings.settings.get('sr2e.defaultArt').restricted, name: game.settings.settings.get('sr2e.defaultArt').name } })
```
Expected:
- All three entries are `"function"`. Do **not** call `defaultArtForAll`.
- The setting is `{ scope: "world", def: true, restricted: true, name: "Default token art" }`.

**1.2 Click.** Open Configure Settings, then System Settings (SR2e). Expected: a "Default token art" checkbox is ticked, and its hint starts "New actors get the system's own picture and token…". Close the window without saving.

---

## 2. Every shipped file loads (202 files)

**2.1**
```js
const M=['human','elf','dwarf','ork','troll'],F=['masc','fem'],B=['','samurai','merc','ganger','security','decker','rigger','mage','shaman','adept','talisman','face','suit','fixer','medic','tech'],p=[];
for(const m of M)for(const f of F)for(const b of B)p.push(`people/${m}-${f}${b?'-'+b:''}`);
p.push(...['dog','wolf','cat','bear','awakenedWolf','critter'].map(c=>'critters/'+c),...['elemental-fire','elemental-water','elemental-air','elemental-earth','nature-man','nature-land','nature-water','nature-sky','watcher','ally','free','spirit','toxic','insect'].map(s=>'spirits/'+s),
 ...['car','bike','truck','hovercraft','boat','ship','rotor','fixedWing','vectorThrust','lta','other','drone-ground','drone-rotor','drone-wing','drone-water'].map(v=>'vehicles/'+v),'matrix/ic-white','matrix/ic-gray','matrix/ic-black','matrix/host','misc/barrier','misc/site','misc/safehouse');
window.zzPaths = p.map(x => `systems/sr2e/tokens/${x}.svg`); const bad = [];
await Promise.all(zzPaths.map(async u => { try { const r = await fetch(u, { cache: 'no-store' }); const ct = r.headers.get('content-type') ?? '';
  if (r.status !== 200 || !/svg/.test(ct)) return bad.push([u, r.status, ct]); const i = new Image(); i.src = u; await i.decode(); if (i.naturalWidth !== 256) bad.push([u, 'w=' + i.naturalWidth]); } catch (e) { bad.push([u, String(e)]); } }));
({ n: zzPaths.length, bad })
```
Expected: `n` is 202 and `bad` is `[]`. Each file must return HTTP 200, have an svg content type, decode and be 256 px wide. Check case-sensitive names too, such as `awakenedWolf.svg` and `fixedWing.svg`.

**2.2 Negative control** (shows the check is not vacuous):
```js
[(await fetch('systems/sr2e/tokens/people/human-masc-bogus.svg', { cache: 'no-store' })).status, await (async () => { const i = new Image(); i.src = 'systems/sr2e/tokens/people/nope.svg'; try { await i.decode(); return 'decoded?!'; } catch { return 'rejects'; } })()]
```
Expected: `[404, "rejects"]`.

---

## 3. Lookup on in-memory actors (nothing saved)

**3.1**
```js
const mk = (d) => new Actor.implementation({ name: 'ZZ mem', ...d }); const o = (d) => (game.sr2e.api.defaultArtOf(mk(d)) ?? 'null').replace('systems/sr2e/tokens/','');
const cw = (s) => ({ name: 'ZZ cw', type: 'cyberware', system: s });
({
 c1: o({ type:'character', system:{ metatype:'elf', art:{ figure:'fem' } } }),
 c2: o({ type:'character', system:{ metatype:'troll', art:{ figure:'masc', archetype:'none' } } }),
 c3: o({ type:'character', system:{ metatype:'ork', art:{ figure:'masc', archetype:'medic' } } }),
 c4: o({ type:'character', system:{ metatype:'dwarf', art:{ figure:'fem' }, tradition:'hermetic' } }),
 c5: o({ type:'character', system:{ metatype:'dwarf', art:{ figure:'fem' }, tradition:'shamanic' } }),
 c6: o({ type:'character', system:{ metatype:'dwarf', art:{ figure:'fem' }, tradition:'adept' } }),
 c7: o({ type:'character', system:{ art:{ figure:'fem' } }, items:[cw({ controlRig:1 })] }),
 c8: o({ type:'character', system:{ art:{ figure:'fem' } }, items:[{ name:'ZZ deck', type:'cyberdeck' }] }),
 c9: o({ type:'character', system:{ art:{ figure:'fem' } }, items:[cw({ reflexes:'wired' })] }),
 c10: o({ type:'character', system:{ art:{ figure:'fem' } }, items:[cw({ reflexes:'wired', installed:false })] }),
 c11: o({ type:'character', system:{ art:{ figure:'fem' }, tradition:'hermetic' }, items:[cw({ controlRig:1 }), { name:'d', type:'cyberdeck' }] }),
 c12: o({ type:'character', system:{ metatype:'nonsense', art:{ figure:'fem' } } }),
 n1: o({ type:'npc', system:{ metatype:'ork', art:{ figure:'masc' } }, flags:{ sr2e:{ generated:{ archetype:'guard' } } } }),
 n2: o({ type:'npc', flags:{ sr2e:{ generated:{ archetype:'critter:wolf' } } } }),
 n3: o({ type:'npc', flags:{ sr2e:{ critter:true } } }),
 s1: o({ type:'spirit', system:{ spiritKind:'elemental', element:'Fire' } }),
 s2: o({ type:'spirit', system:{ spiritKind:'nature', spiritType:'City spirit' } }),
 s3: o({ type:'spirit', system:{ spiritKind:'nature', spiritType:'Storm spirit' } }),
 s4: o({ type:'spirit', system:{ spiritKind:'watcher' } }),
 s5: o({ type:'spirit', system:{ spiritKind:'other' } }),
 v1: o({ type:'vehicle', system:{ category:'rotor', drone:true } }),
 v2: o({ type:'vehicle', system:{ category:'boat' } }),
 v3: o({ type:'vehicle', system:{ category:'fixedWing', drone:true } }),
 i1: o({ type:'ic', system:{ category:'black' } }),
 h: o({ type:'host' }), b: o({ type:'barrier' }), si: o({ type:'site' }), sa: o({ type:'safehouse' }),
})
```
Expected:

| Key | Expected path | Why |
|---|---|---|
| c1 | `people/elf-fem` | |
| c2 | `people/troll-masc` | archetype none: no badge |
| c3 | `people/ork-masc-medic` | |
| c4 | `people/dwarf-fem-mage` | |
| c5 | `people/dwarf-fem-shaman` | |
| c6 | `people/dwarf-fem-adept` | |
| c7 | `people/human-fem-rigger` | |
| c8 | `people/human-fem-decker` | |
| c9 | `people/human-fem-samurai` | |
| c10 | `people/human-fem` | uninstalled ware ignored |
| c11 | `people/human-fem-mage` | tradition beats rig and deck |
| c12 | `people/human-fem` | unknown metatype falls back to human |
| n1 | `people/ork-masc-security` | generator `guard` maps to security |
| n2 | `critters/wolf` | |
| n3 | `critters/critter` | |
| s1 | `spirits/elemental-fire` | |
| s2 | `spirits/nature-man` | |
| s3 | `spirits/nature-sky` | |
| s4 | `spirits/watcher` | |
| s5 | `spirits/spirit` | |
| v1 | `vehicles/drone-rotor` | |
| v2 | `vehicles/boat` | |
| v3 | `vehicles/drone-wing` | |
| i1 | `matrix/ic-black` | |
| h | `matrix/host` | |
| b | `misc/barrier` | |
| si | `misc/site` | |
| sa | `misc/safehouse` | |

`zzErr` should still be empty. If the in-memory constructor throws for a type, note it and move on (those types are covered again in section 4).

---

## 4. New actors of every type get their art (preCreateActor)

**4.1**
```js
const C = (d) => Actor.create(d);
const made = await Actor.createDocuments([
 { name:'ZZ Art Runner', type:'character', system:{ metatype:'elf' } },
 { name:'ZZ Art NPC', type:'npc', system:{ metatype:'troll' } },
 { name:'ZZ Art Spirit', type:'spirit', system:{ spiritKind:'elemental', element:'fire' } },
 { name:'ZZ Art Drone', type:'vehicle', system:{ category:'rotor', drone:true } },
 { name:'ZZ Art IC', type:'ic', system:{ category:'black' } },
 { name:'ZZ Art Host', type:'host' }, { name:'ZZ Art Barrier', type:'barrier' }, { name:'ZZ Art Site', type:'site' }, { name:'ZZ Art Safehouse', type:'safehouse' } ]);
await zzW(800); Object.fromEntries(made.map(a => [a.name, zzS(a)]))
```
Expected (`img` and `tok` are equal and match `def` for every row):

| Actor | img / tok | fig |
|---|---|---|
| ZZ Art Runner | `people/elf-fem.svg` | `fem`, stored by preCreate |
| ZZ Art NPC | `people/troll-masc.svg` | `masc` |
| ZZ Art Spirit | `spirits/elemental-fire.svg` | |
| ZZ Art Drone | `vehicles/drone-rotor.svg` | |
| ZZ Art IC | `matrix/ic-black.svg` | |
| ZZ Art Host | `matrix/host.svg` | |
| ZZ Art Barrier | `misc/barrier.svg` | |
| ZZ Art Site | `misc/site.svg` | |
| ZZ Art Safehouse | `misc/safehouse.svg` | |

Both people should have `arch` `''`. If the default attributes happen to make Charisma the highest at 4 or more, a `-face` badge is correct; note it. `zzErr` must be empty, with no `DataModelValidationError`. Also check `game.journal.size` and `game.folders.size` against the snapshot: creating a site or safehouse must not add stray documents (if it does, note them for clean-up).

**4.2 The art follows changes on non-people.**
```js
const s = zzA('ZZ Art Spirit'), v = zzA('ZZ Art Drone'), i = zzA('ZZ Art IC');
await s.update({ 'system.spiritKind': 'watcher' }); await v.update({ 'system.drone': false }); await i.update({ 'system.category': 'gray' }); await zzW(800);
const r1 = [zzS(s).img, zzS(v).img, zzS(i).img];
await s.update({ 'system.spiritKind': 'nature', 'system.spiritType': 'City spirit' }); await v.update({ 'system.category': 'boat' }); await zzW(800);
[r1, zzS(s).img, zzS(v).img, zzS(v).tok]
```
Expected: `[["spirits/watcher.svg","vehicles/rotor.svg","matrix/ic-gray.svg"], "spirits/nature-man.svg", "vehicles/boat.svg", "vehicles/boat.svg"]`.

**4.3 A picture given at creation is kept.**
```js
const a = await Actor.create({ name: 'ZZ Art Custom', type: 'character', img: 'icons/svg/cowled.svg' }); await zzW(500); zzS(a)
```
Expected:
- `img` is `icons/svg/cowled.svg`.
- `tok` is also `icons/svg/cowled.svg` (Foundry copies the custom picture to the token), or Foundry's stand-in. It must not be default art.
- `fig` is `masc`, stored anyway. `def` is `people/human-masc.svg`.

**4.4 No update loop.** Count the updateActor events for one metatype change:
```js
const a = zzA('ZZ Art Runner'); const ev = []; const h = Hooks.on('updateActor', (d, c, o) => { if (d.id === a.id) ev.push(o.sr2eArt ? 'art' : 'user'); });
await a.update({ 'system.metatype': 'dwarf' }); await zzW(1200); Hooks.off('updateActor', h); [ev, zzS(a).img, zzS(a).tok]
```
Expected: `[["user","art"], "people/dwarf-fem.svg", "people/dwarf-fem.svg"]`. Exactly two events; anything more is a loop.

---

## 5. Character sheet: the "Picture and token" section (Bio tab)

**5.1 Open and read.**
```js
const a = zzA('ZZ Art Runner'); await a.sheet.render({ force: true }); await zzW(800); a.sheet.changeTab('bio', 'primary'); await zzW(300);
const el = a.sheet.element, h = [...el.querySelectorAll('h2')].find(x => x.textContent.trim().startsWith('Picture and token'));
({ heading: !!h, help: h?.querySelector('.sr2e-help')?.dataset.sr2eHelp, preview: el.querySelector('.sr2e-art-preview')?.getAttribute('src'),
   fig: [...el.querySelectorAll('select[name="system.art.figure"] option')].map(o => `${o.value}|${o.textContent}${o.selected ? '*' : ''}`),
   arch: [...el.querySelectorAll('select[name="system.art.archetype"] option')].map(o => o.value + (o.selected ? '*' : '')).join(','),
   archAuto: el.querySelector('select[name="system.art.archetype"] option[value=""]')?.textContent, button: !!el.querySelector('[data-action="useDefaultArt"]'),
   hint: el.querySelector('.sr2e-art + p.hint')?.textContent.trim().slice(0, 60) })
```
Expected:
- `heading` is true and `help` is `"token-art"`.
- `preview` is `systems/sr2e/tokens/people/dwarf-fem.svg`.
- `fig` is `["masc|Masculine", "fem|Feminine*"]`. There is no "From the name" entry, because the figure is stored.
- `arch` is `"*,none,samurai,merc,ganger,security,decker,rigger,mage,shaman,adept,talisman,face,suit,fixer,medic,tech"`. That is 17 options with Automatic selected.
- `archAuto` is `"Automatic (none)"`, `button` is true and `hint` starts "The picture and token follow these choices…".

**5.2 Metatype through the sheet** (the header select, which submits on change):
```js
window.zzSel = async (a, name, val) => { const s = a.sheet.element.querySelector(`select[name="${name}"]`); s.value = val; s.dispatchEvent(new Event('change', { bubbles: true })); await zzW(1200); return zzS(a); };
const a = zzA('ZZ Art Runner'); const out = {}; for (const m of ['elf', 'ork', 'troll', 'human']) out[m] = (await zzSel(a, 'system.metatype', m)).img; out
```
Expected: `{ elf: "people/elf-fem.svg", ork: "people/ork-fem.svg", troll: "people/troll-fem.svg", human: "people/human-fem.svg" }`. The token follows each time; also check `zzS(a).tok`.

**5.3 Figure and archetype through the sheet.**
```js
const a = zzA('ZZ Art Runner');
[ (await zzSel(a, 'system.art.figure', 'masc')).img, (await zzSel(a, 'system.art.archetype', 'rigger')).img, (await zzSel(a, 'system.art.archetype', 'none')).img,
  (await zzSel(a, 'system.art.archetype', '')).img, a.sheet.element.querySelector('.sr2e-art-preview').getAttribute('src').split('/').pop() ]
```
Expected: `["people/human-masc.svg", "people/human-masc-rigger.svg", "people/human-masc.svg", "people/human-masc.svg", "human-masc.svg"]`. The preview re-renders with the new choice.

**5.4 Re-renders.** Render three times, then confirm a single "?" and intact controls:
```js
const a = zzA('ZZ Art Runner'); for (let k = 0; k < 3; k++) { await a.sheet.render(); await zzW(400); }
const el = a.sheet.element, h = [...el.querySelectorAll('h2')].find(x => x.textContent.trim().startsWith('Picture and token'));
[h.querySelectorAll('.sr2e-help').length, el.querySelectorAll('[data-action="useDefaultArt"]').length, el.querySelector('select[name="system.art.figure"]').value]
```
Expected: `[1, 1, "masc"]`. Then press the button once (`el.querySelector('[data-action="useDefaultArt"]').click()`) with an updateActor counter like the one in 4.4. Expected: one or no `art` update, no dialog (the art is already default) and no duplicated handlers.

**5.5 The guide link.**
```js
const a = zzA('ZZ Art Runner'), h = [...a.sheet.element.querySelectorAll('h2')].find(x => x.textContent.trim().startsWith('Picture and token'));
h.querySelector('.sr2e-help').click(); await zzW(1000); const w = document.getElementById('sr2e-help');
[!!w, w?.querySelector('.sr2e-help-body')?.textContent.includes('Pictures and tokens'), w?.querySelector('.sr2e-help-body')?.textContent.includes('Use the default art')]
```
Expected: `[true, true, true]`. The guide window opens on the topic "Pictures and tokens". Close it with `foundry.applications.instances.get('sr2e-help')?.close()`.

---

## 6. Automatic archetype from items and tradition

**6.1 Items** (createItem, updateItem and deleteItem hooks):
```js
const a = await Actor.create({ name: 'ZZ Art Items', type: 'character' }); await zzW(500); const r = [zzS(a).img];
const add = async (d) => { const [it] = await a.createEmbeddedDocuments('Item', [d]); await zzW(1000); r.push(zzS(a).img); return it; };
await add({ name: 'ZZ Wired Reflexes', type: 'cyberware', system: { reflexes: 'wired', initiativeDice: 1, reaction: 2, essenceCost: 2 } });
const deck = await add({ name: 'ZZ Deck', type: 'cyberdeck' });
const rig = await add({ name: 'ZZ Control Rig', type: 'cyberware', system: { controlRig: 1, essenceCost: 2 } });
await rig.update({ 'system.installed': false }); await zzW(1000); r.push(zzS(a).img);
await deck.delete(); await zzW(1000); r.push(zzS(a).img); r
```
Expected:
```
["people/human-fem.svg", "people/human-fem-samurai.svg", "people/human-fem-decker.svg", "people/human-fem-rigger.svg", "people/human-fem-decker.svg", "people/human-fem-samurai.svg"]
```
The steps are: plain, then wired reflexes, then deck beats wired, then rig beats deck, then rig uninstalled, then deck removed. The sheet's Automatic label follows: `zzA('ZZ Art Items').sheet.render({force:true})`, Bio tab, then read `option[value=""]` → "Automatic (Street samurai)".

**6.2 Tradition and manual choice.**
```js
const a = zzA('ZZ Art Items'), r = [];
for (const t of ['hermetic', 'shamanic', 'adept', 'none']) { await a.update({ 'system.tradition': t }); await zzW(1000); r.push(zzS(a).img); }
await a.update({ 'system.art.archetype': 'medic' }); await zzW(1000); r.push(zzS(a).img);
await a.createEmbeddedDocuments('Item', [{ name: 'ZZ Deck 2', type: 'cyberdeck' }]); await zzW(1000); r.push(zzS(a).img);
await a.update({ 'system.art.archetype': '' }); await zzW(1000); r.push(zzS(a).img); r
```
Expected:
```
["…-mage.svg", "…-shaman.svg", "…-adept.svg", "…-samurai.svg", "…-medic.svg", "…-medic.svg", "…-decker.svg"]
```
Every entry is under `people/human-fem`. A manual archetype wins and the item hook leaves it alone; back on Automatic, the new deck counts.

**6.3 Face from Charisma.**
```js
const a = await Actor.create({ name: 'ZZ Art Face', type: 'character' }); await zzW(500);
await a.update({ 'system.attributes.body.base': 2, 'system.attributes.quickness.base': 2, 'system.attributes.strength.base': 2, 'system.attributes.intelligence.base': 3, 'system.attributes.willpower.base': 3, 'system.attributes.charisma.base': 6 }); await zzW(1000); zzS(a).img
```
Expected: `people/human-masc-face.svg`. If an attribute `mod` from elsewhere breaks the inequality, note the values `a.system.attributes`.

---

## 7. A custom picture is kept; the button asks first

**7.1 Changes leave a custom picture alone.**
```js
const a = zzA('ZZ Art Custom'); await a.update({ 'system.metatype': 'ork' }); await zzW(1000); zzS(a)
```
Expected: `img` and `tok` are still `icons/svg/cowled.svg`, and `def` is `people/ork-masc.svg`. Open the sheet's Bio tab: the hint reads "This actor has a picture of its own; the default art is used only if you press the button."

**7.2 Button, then cancel.**
```js
const a = zzA('ZZ Art Custom'); await a.sheet.render({ force: true }); await zzW(700); a.sheet.changeTab('bio', 'primary');
a.sheet.element.querySelector('[data-action="useDefaultArt"]').click(); await zzW(800);
window.zzDlg = (t) => [...foundry.applications.instances.values()].filter(x => x.options?.window?.title === t);
const d = zzDlg('Use the default art?'); [d.length, d[0]?.element.textContent.includes("system's default art"), d[0]?.element.classList.contains('sr2e-dialog')]
```
Expected: `[1, true, true]`. Then cancel:
```js
zzDlg('Use the default art?')[0].element.querySelector('button[data-action="no"]').click(); await zzW(800); zzS(zzA('ZZ Art Custom'))
```
Expected: the picture is unchanged (`cowled.svg`).

**7.3 Button, then confirm.** Repeat the click from 7.2, then press `button[data-action="yes"]`. Expected:
- `img` and `tok` are `people/ork-masc.svg`.
- The hint now reads "The picture and token follow these choices…".
- A later `a.update({'system.metatype':'elf'})` swaps the art to `people/elf-masc.svg`.

**7.4 Custom token, default picture (the "pin").**
```js
const a = await Actor.create({ name: 'ZZ Art Pin', type: 'character' }); await zzW(500);
await a.update({ 'prototypeToken.texture.src': 'icons/svg/target.svg' }); await a.update({ 'system.metatype': 'dwarf' }); await zzW(1200); zzS(a)
```
Expected: `img` is `people/dwarf-masc.svg` and `tok` stays `icons/svg/target.svg`. Foundry's copy onto the token is blocked.

**7.5 The API runs in "standin" mode.**
```js
const c = zzA('ZZ Art Custom'); await c.update({ img: 'icons/svg/cowled.svg', 'prototypeToken.texture.src': 'icons/svg/cowled.svg' }, { sr2eArt: true });
[await game.sr2e.api.applyDefaultArt(c), zzS(c).img, await game.sr2e.api.applyDefaultArt(zzA('ZZ Art Runner'))]
```
Expected: `[false, "icons/svg/cowled.svg", false]`. A custom picture is never replaced, and an actor that already has its art changes nothing.

---

## 8. Double-clicks

**8.1 Sheet button, custom picture.** `ZZ Art Custom` still has `cowled.svg` from 7.5. Open its Bio tab, then:
```js
const b = zzA('ZZ Art Custom').sheet.element.querySelector('[data-action="useDefaultArt"]'); b.click(); b.click(); await zzW(800); zzDlg('Use the default art?').length
```
Expected: ideally 1. **[D3]** `useDefaultArt` has no busy guard, unlike the GM panel's `once()`, so 2 dialogs are likely. Record the count. Then cancel every dialog:
```js
for (const d of zzDlg('Use the default art?')) d.element.querySelector('button[data-action="no"]').click(); await zzW(500); [zzDlg('Use the default art?').length, zzS(zzA('ZZ Art Custom')).img]
```
Expected: `[0, "icons/svg/cowled.svg"]`.

**8.2 Sheet button, default art.**
```js
const a = await Actor.create({ name: 'ZZ Art Dbl', type: 'character', system: { metatype: 'troll' } }); await zzW(500);
await a.update({ img: 'icons/svg/mystery-man.svg', 'prototypeToken.texture.src': 'icons/svg/mystery-man.svg' }, { sr2eArt: true });
await a.sheet.render({ force: true }); await zzW(700); a.sheet.changeTab('bio', 'primary');
const b = a.sheet.element.querySelector('[data-action="useDefaultArt"]'); b.click(); b.click(); await zzW(1500); [zzDlg('Use the default art?').length, zzS(a), zzErr.length]
```
Expected:
- 0 dialogs: Foundry's stand-in is replaceable, so no confirm.
- `img` and `tok` are `people/troll-fem.svg`.
- No new errors.

---

## 9. NPC sheet: the folded section

**9.1**
```js
const a = zzA('ZZ Art NPC'); await a.sheet.render({ force: true }); await zzW(800); const el = a.sheet.element;
const d = [...el.querySelectorAll('details')].find(x => x.querySelector(':scope > summary')?.textContent.trim().startsWith('Picture and token'));
d.open = true; ({ found: !!d, help: d?.querySelector(':scope > summary .sr2e-help')?.dataset.sr2eHelp, preview: d?.querySelector('.sr2e-art-preview')?.getAttribute('src'), button: !!d?.querySelector('[data-action="useDefaultArt"]') })
```
Expected: `{ found: true, help: "token-art", preview: ".../people/troll-masc.svg", button: true }`.

- Click the summary's "?". Expected: the guide opens on "Pictures and tokens" and the `<details>` does **not** toggle (the click is captured).
- Change the archetype select to `security`, as in 5.3. Expected: `people/troll-masc-security.svg`.

**9.2 Types without the section.** Open the sheets of `ZZ Art Spirit`, `ZZ Art Drone` and `ZZ Art IC`. Expected: `sheet.element.querySelector('.sr2e-art')` is null on each, and no errors.

---

## 10. Setting off (restore it afterwards)

**10.1**
```js
window.zzOrigArt = game.settings.get('sr2e', 'defaultArt'); await game.settings.set('sr2e', 'defaultArt', false);
const a = await Actor.create({ name: 'ZZ Art Off', type: 'character', system: { metatype: 'elf' } }); await zzW(500);
const r1 = zzS(a); await a.update({ 'system.metatype': 'dwarf' }); await zzW(800); [r1, zzS(a)]
```
Expected:
- Both snapshots show `img` and `tok` as `icons/svg/mystery-man.svg`, and `fig` as `''`.
- The second `def` is `people/dwarf-masc.svg`, with the figure from the name.

**10.2 Sheet with no stored figure.** Open its Bio tab and read the figure options as in 5.1. Expected: the first option is `"|From the name (Masculine)*"`, selected, then Masculine and Feminine.

Note **[D4]**: the hint reads "This actor has a picture of its own…" even though the picture is Foundry's stand-in, because `isDefault` only checks the system's art. Record it as a wording issue if confirmed.

**10.3 The button still works with the setting off.** Click "Use the default art". Expected:
- No dialog, because the stand-in is replaceable.
- `img` and `tok` are `people/dwarf-masc.svg`, and `fig` is now `masc` (stored).
- `a.update({'system.metatype':'ork'})` does **not** swap the art while the setting is off. `img` stays `dwarf-masc`.

**10.4 Restore, then the API.**
```js
await game.settings.set('sr2e', 'defaultArt', zzOrigArt); const a = zzA('ZZ Art Off');
await a.update({ img: 'icons/svg/mystery-man.svg', 'prototypeToken.texture.src': 'icons/svg/mystery-man.svg' }, { sr2eArt: true });
const ok = await game.sr2e.api.applyDefaultArt(a); await a.update({ name: 'ZZ Art Off Y' }); await zzW(800); [game.settings.get('sr2e', 'defaultArt'), ok, zzS(a)]
```
Expected: `[true, true, { img: "people/ork-masc.svg", …, fig: "masc" }]`. The rename to a name whose hash says `fem` does not flip the stored figure.

---

## 11. Portraits by name (v0.67.0) interplay

This uses a **mocked** portrait folder: a client-side stub of `FilePicker.browse`, which a reload undoes. Nothing is written to the Data folder. A real upload (`FilePicker.upload`) would leave a file on the server that cannot be deleted from the console, so use it only if the user agrees; otherwise this mock stands in for the temporary folder.

**11.1 Mock and set.**
```js
const FP = foundry.applications.apps.FilePicker.implementation; window.zzFPorig = FP.browse;
FP.browse = async function (src, target, ...r) { if (String(target).replace(/\/+$/, '') === 'zz-portraits-mock') return { target, files: ['zz-portraits-mock/ZZ Rook.png'], dirs: [] }; return zzFPorig.call(this, src, target, ...r); };
window.zzPF = [game.settings.get('sr2e', 'portraitFolder'), game.settings.get('sr2e', 'portraitTokens')];
await game.settings.set('sr2e', 'portraitFolder', 'zz-portraits-mock'); [zzPF, game.settings.get('sr2e', 'portraitFolder')]
```
Expected: the folder is now `zz-portraits-mock`. Note `zzPF[1]`; the expectations below assume `portraitTokens` is true.

**11.2 A new actor named after the file.**
```js
const a = await Actor.create({ name: 'ZZ Rook', type: 'character' }); await zzW(1500); [zzS(a), a.getFlag('sr2e', 'portraitAuto')]
```
Expected:
- `img` and `tok` are `zz-portraits-mock/ZZ Rook.png`. The file does not exist, so a 404 for it in the network log is expected.
- `portraitAuto` is the same path.
- This shows the default art that preCreate gave (`people/human-fem.svg`) counts as replaceable for `portraitReplaceable`, so "Portraits by name" wins.

**11.3 The portrait is kept.**
```js
const a = zzA('ZZ Rook'); await a.update({ 'system.metatype': 'dwarf' }); await zzW(1000); zzS(a).img
```
Expected: still `zz-portraits-mock/ZZ Rook.png`.

**11.4 Button then portrait again.**
- Press the sheet button. Expected: the confirm shows, because the portrait is custom. Press yes. Expected: `people/dwarf-fem.svg` for both.
- Then run:
  ```js
  [await game.sr2e.api.applyPortrait(zzA('ZZ Rook')), zzS(zzA('ZZ Rook')).img]
  ```
  Expected: `[true, "zz-portraits-mock/ZZ Rook.png"]`. The default art is replaceable by the portrait lookup, which is the direct check of `portraitReplaceable` on default art.

**11.5 Restore immediately.**
```js
await game.settings.set('sr2e', 'portraitFolder', zzPF[0]); await game.settings.set('sr2e', 'portraitTokens', zzPF[1]);
foundry.applications.apps.FilePicker.implementation.browse = zzFPorig; [game.settings.get('sr2e', 'portraitFolder'), game.settings.get('sr2e', 'portraitTokens'), zzSafe()]
```
Expected: the original values, and `zzSafe()` clean.

---

## 12. Map: linked and unlinked tokens on a ZZ scene

**12.1 Scene (viewed, not activated).**
```js
const sc = await Scene.create({ name: 'ZZ Art Map', width: 1400, height: 1000, grid: { size: 100 }, padding: 0 }); await sc.view(); await zzW(1500);
[canvas.scene.name, sc.active, game.scenes.active?.name]
```
Expected: `["ZZ Art Map", false, <the original active scene>]`.

**12.2 Tokens.**
```js
const sc = game.scenes.getName('ZZ Art Map');
const L = await Actor.create({ name: 'ZZ Art Linked', type: 'character', prototypeToken: { actorLink: true } });
const U = await Actor.create({ name: 'ZZ Art Unlinked', type: 'npc', system: { metatype: 'elf' } }); await zzW(600);
const td = [(await L.getTokenDocument({ x: 200, y: 200, actorLink: true })).toObject(), (await U.getTokenDocument({ x: 400, y: 200 })).toObject(),
            (await L.getTokenDocument({ x: 600, y: 200, actorLink: true, texture: { src: 'icons/svg/target.svg' } })).toObject()];
await sc.createEmbeddedDocuments('Token', td); await zzW(800); sc.tokens.map(t => [t.name, t.actorLink, t.texture.src.split('/').pop()])
```
Expected:
- `ZZ Art Linked`: linked, `human-masc.svg`.
- `ZZ Art Unlinked`: unlinked, `elf-fem.svg`.
- `ZZ Art Linked`: linked, `target.svg` (a hand-set map token).

**12.3 Changes reach linked tokens only.**
```js
const sc = game.scenes.getName('ZZ Art Map'); await zzA('ZZ Art Linked').update({ 'system.metatype': 'ork' }); await zzA('ZZ Art Unlinked').update({ 'system.metatype': 'troll' }); await zzW(1500);
[sc.tokens.map(t => [t.name, t.texture.src.split('/').pop()]), zzS(zzA('ZZ Art Unlinked')).img, zzSafe()]
```
Expected:
- The first linked token is `ork-masc.svg`.
- The hand-set linked token stays `target.svg`.
- The unlinked token stays `elf-fem.svg`, while its base actor becomes `people/troll-fem.svg`.
- `zzSafe()` is clean, so the Safehouse tokens are untouched.

**12.4 Button and map tokens.** Press "Use the default art" on `ZZ Art Linked`'s sheet. There is no dialog, because the actor's own art is default. Expected:
- The first token stays `ork-masc.svg`.
- The `target.svg` token is **kept**: force mode applies the "standin" rule to map tokens.

Record whether that matches the guide's "puts the default back"; **[D5]**, minor and by design.

**12.5 Unlinked token's own actor** (ActorDelta):
```js
const t = game.scenes.getName('ZZ Art Map').tokens.find(x => !x.actorLink); const n = zzErr.length;
await t.actor.update({ 'system.metatype': 'dwarf' }); await zzW(1500); [t.actor.img.split('/').pop(), t.texture.src.split('/').pop(), zzA('ZZ Art Unlinked').img.split('/').pop(), zzErr.slice(n)]
```
Expected:
- No errors. Watch especially for any trouble with `prototypeToken` on the delta.
- The base actor is unchanged (`troll-fem.svg`).
- The token texture is unchanged (`elf-fem.svg`).
- Record the synthetic `t.actor.img`; `dwarf-fem.svg` is plausible.

Then open `t.actor.sheet`, press "Use the default art" and check `zzErr` again.

**12.6 Screenshot.** Open `ZZ Art Linked`'s sheet on the Bio tab next to the canvas showing the ZZ scene. Take one screenshot: the preview, the selects and the tokens with the portrait and badge rim.

---

## 13. NPC generator

**13.1** `canvas.scene` must be `ZZ Art Map` (tokens are placed on the viewed scene).
```js
window.zzBefore = new Set(game.actors.map(a => a.id)); const g = game.sr2e.npcGenerator(); await zzW(1000);
Object.assign(g.constructor.state, { kind: 'npc', threat: 2, seed: 4242, archetype: 'guard', metatype: 'ork', magic: 'none', tokens: true, hidden: false, moraleGroup: false });
await g.render({ force: true }); await zzW(800); [canvas.scene.name, g.element.querySelector('.sr2e-npcgen-actions .hint')?.textContent]
```
Expected: the scene is `ZZ Art Map` and the summary mentions "with tokens on the viewed scene". Then:
```js
const g = game.sr2e.npcGenerator(); g.element.querySelector('[data-action="create"]').click(); await zzW(3000);
const nw = game.actors.filter(a => !zzBefore.has(a.id)); for (const a of nw) await a.update({ name: 'ZZ Gen ' + a.name }); await zzW(800);
nw.map(a => [a.name, a.folder?.name, a.flags.sr2e?.generated?.archetype, zzS(a).img, zzS(a).fig])
```
Expected:
- One actor in the folder "Generated (SR2e)" with archetype `guard`.
- `img` is `people/ork-<fig>-security.svg`, with `fig` stored.
- Its token on ZZ Art Map uses the same file:
  ```js
  game.scenes.getName('ZZ Art Map').tokens.filter(t => t.actor?.name?.startsWith('ZZ Gen')).map(t => t.texture.src)
  ```
- The rename did not change the art.

**13.2 Critter and spirit.** Repeat 13.1 with:
- `{ kind:'critter', critter:'wolf', critterCount:1, threat:2, seed:77, tokens:false }`. Expected: `critters/wolf.svg`, and `fig` stays `''`. The sheet has no `.sr2e-art` section, because it is a critter.
- `{ kind:'spirit', spiritKind:'elemental', threat:2, seed:78, tokens:false }`. Expected: `spirits/elemental-<element>.svg` matching `system.element`, or `spirits/spirit.svg` if the element is empty.

Rename each new actor with `ZZ Gen ` as in 13.1. Close the generator.

---

## 14. GM panel "Default token art"

**14.1 Read the section.**
```js
game.sr2e.gmPanel(); await zzW(1000); document.querySelector('#sr2e-gm-panel [data-action="gmTab"][data-tab="setup"]')?.click(); await zzW(1200);
const s = document.querySelector('#sr2e-gm-panel section.sr2e-default-art'); const SI = ['icons/svg/mystery-man.svg', 'icons/svg/mystery-man-black.svg', ''];
const def = (x) => String(x ?? '').startsWith('systems/sr2e/tokens/');
const strict = game.actors.filter(a => game.sr2e.api.defaultArtOf(a) && [a.img, a.prototypeToken.texture.src].some(x => SI.includes(String(x ?? '')))).length;
const loose = game.actors.filter(a => game.sr2e.api.defaultArtOf(a) && [a.img, a.prototypeToken.texture.src].some(x => SI.includes(String(x ?? '')) || def(x))).length;
({ h2: s?.querySelector('h2')?.textContent.trim(), help: s?.querySelector('h2 .sr2e-help')?.dataset.sr2eHelp, text: s?.querySelector('p.hint')?.textContent.trim(), button: !!s?.querySelector('[data-action="defaultArtAll"]'), strict, loose })
```
Expected:
- `h2` is `"Default token art"` and `help` is `"token-art"`.
- `text` starts "New actors get the system's own picture and token (Configure Settings, SR2e: Default token art)." and goes on "N actor(s) still show(s) the stand-in picture or token." or "No actor shows the stand-in." (singular or plural fits N).
- **[D1]** `standInCount` uses `isDefaultPortrait`, which since v0.83.0 also treats the system's own default art as a stand-in. N is then likely `loose` (it counts every ZZ actor with default art) rather than `strict`. The intended number is `strict`. Record N, `strict` and `loose`.
- The button shows only when N > 0.

**14.2 Button, check the dialog, CANCEL.**
```js
const b = document.querySelector('#sr2e-gm-panel [data-action="defaultArtAll"]'); b.click(); b.click(); await zzW(1000);
const d = zzDlg('Default token art'); [d.length, d[0]?.element.querySelector('.window-content')?.textContent.trim()]
```
Expected:
- `d.length` is 1, because the `once('defaultArt')` guard swallows the double click.
- The text is "Give the system's default picture and token to the N actors still showing Foundry's stand-in? Pictures set by hand or found by name are kept.", with N the same as 14.1.

Then **cancel**:
```js
zzDlg('Default token art')[0].element.querySelector('button[data-action="no"]').click(); await zzW(1000); [zzDlg('Default token art').length, zzSafe()]
```
Expected: `[0, { actorsChanged: [], tokensChanged: 0, shTokens: 24 }]`. If `actorsChanged` is non-empty, stop and report it at once.

**14.3 Count changes.**
```js
const a = await Actor.create({ name: 'ZZ Art Standin', type: 'character' }); await zzW(500);
await a.update({ img: 'icons/svg/mystery-man.svg', 'prototypeToken.texture.src': 'icons/svg/mystery-man.svg' }, { sr2eArt: true }); await zzW(1500);
document.querySelector('#sr2e-gm-panel section.sr2e-default-art p.hint')?.textContent
```
Expected:
- N goes up by 1. Re-render the panel with `game.sr2e.gmPanel()` if it did not refresh.
- After `await game.sr2e.api.applyDefaultArt(a)` and a re-render, N should go down by 1 again. Under [D1] it stays the same, because default art also counts.

Record both.

**14.4 Text with the setting off.**
```js
await game.settings.set('sr2e', 'defaultArt', false); game.sr2e.gmPanel(); await zzW(1200);
const t = document.querySelector('#sr2e-gm-panel section.sr2e-default-art p.hint')?.textContent; await game.settings.set('sr2e', 'defaultArt', zzOrigArt); [t, game.settings.get('sr2e', 'defaultArt')]
```
Expected: the text starts "Off: new actors keep Foundry's stand-in…". The setting is back to true afterwards. Close the GM panel.

---

## 15. Player path (tab P, ZZ Testplayer)

**15.0 On tab G**, prepare the observer check and snapshot the tokens:
```js
await zzA('ZZ Art NPC').update({ [`ownership.${game.users.getName('ZZ Testplayer').id}`]: 2 });
window.zzTok = game.scenes.map(s => s.tokens.map(t => [s.id, t.id, t.texture.src, t._stats.modifiedTime])).flat(); zzTok.length
```

**15.1 On tab P**, paste the helpers (0.1), then:
```js
[game.user.name, game.user.isGM, game.user.can('ACTOR_CREATE'), canvas.scene?.name]
```
Expected: `["ZZ Testplayer", false, ?, <the active scene>]`. If `ACTOR_CREATE` is false (Foundry's default role setting), the player cannot create actors and you must **not** change the world's permissions. Instead, on tab G:
```js
await Actor.create({ name: 'ZZ Player Char', type: 'character', ownership: { [game.users.getName('ZZ Testplayer').id]: 3 } })
```
Note that the creation step was done by the GM.

**15.2 Tab P: create** (if allowed):
```js
const a = await Actor.create({ name: 'ZZ Player Char', type: 'character' }); await zzW(800); [zzS(a), zzNote, zzErr]
```
Expected: `img` and `tok` are `people/human-fem.svg`, `fig` is `fem`, and both `zzNote` and `zzErr` are empty.

**15.3 Tab G: a linked token for it** on ZZ Art Map:
```js
const a = zzA('ZZ Player Char'); await game.scenes.getName('ZZ Art Map').createEmbeddedDocuments('Token', [(await a.getTokenDocument({ x: 800, y: 400, actorLink: true })).toObject()])
```

**15.4 Tab P: metatype, archetype, button.**
```js
const a = zzA('ZZ Player Char'); await a.sheet.render({ force: true }); await zzW(900); a.sheet.changeTab('bio', 'primary'); await zzW(300);
const r = [(await zzSel(a, 'system.metatype', 'ork')).img, (await zzSel(a, 'system.art.archetype', 'rigger')).img];
const b = a.sheet.element.querySelector('[data-action="useDefaultArt"]'); b.click(); b.click(); await zzW(1500);
[...r, zzS(a), zzDlg('Use the default art?').length, a.sheet.element.querySelector('h2 .sr2e-help[data-sr2e-help="token-art"]') ? 'help' : 'no help', zzNote, zzErr]
```
Expected:
- `r` is `["people/ork-fem.svg", "people/ork-fem-rigger.svg"]`, and the token follows.
- The button causes no dialog and no change.
- The help link shows (`'help'`; audience "both").
- `zzNote` and `zzErr` are empty: no "lacks permission" warnings and no validation errors.

If the metatype change instead goes into a GM approval request, the character has a creation record. Note that, and use a fresh character.

**15.5 Tab P: custom picture, then the button with confirm.**
```js
const a = zzA('ZZ Player Char'); await a.update({ img: 'icons/svg/cowled.svg', 'prototypeToken.texture.src': 'icons/svg/cowled.svg' }); await zzW(500);
a.sheet.element.querySelector('[data-action="useDefaultArt"]').click(); await zzW(800); zzDlg('Use the default art?').length
```
Expected: 1. Click `button[data-action="yes"]`. Expected: `people/ork-fem-rigger.svg` for both, and no warnings.

**15.6 Tab P: an actor the player only observes.**
```js
const n = zzA('ZZ Art NPC'); await n.sheet.render({ force: true }); await zzW(900);
[n.isOwner, !!n.sheet.element.querySelector('[data-action="useDefaultArt"]'), await game.sr2e.api.applyDefaultArt(n), zzNote, zzErr]
```
Expected: `[false, false, false, [], []]`. The button is hidden and the API does nothing, quietly. Close the sheets on tab P.

**15.7 Tab G: the map after the player's changes.**
```js
const now = game.scenes.map(s => s.tokens.map(t => [s.id, t.id, t.texture.src, t._stats.modifiedTime])).flat(); const was = new Map(zzTok.map(x => [x[1], x]));
[zzSafe(), now.filter(x => was.has(x[1]) && (was.get(x[1])[2] !== x[2] || was.get(x[1])[3] !== x[3])).length,
 game.scenes.getName('ZZ Art Map').tokens.find(t => t.actor?.name === 'ZZ Player Char')?.texture.src]
```
Expected:
- `zzSafe()` is clean and 0 tokens changed, so the player touched no scene tokens.
- **[D2]** The player's linked map token: by code (the token loop is GM-only, and the GM client ignores other users' updates) it stays `people/human-fem.svg` and does not follow to `ork-fem-rigger`. The guide says linked tokens on the map follow. Record which you see.

---

## 16. Errors and notifications

**16.1** On both tabs:
```js
[zzErr, zzNote.filter(n => /^(warning|error)/.test(n))]
```
Expected:
- No `DataModelValidationError`, no "lacks permission", no uncaught errors and no unhandled rejections.
- The only expected warning-level entries are the 404 for `zz-portraits-mock/ZZ Rook.png` (section 11, network only) and anything already noted as a defect.

---

## 17. Clean-up checklist (tab G unless noted)

1. **Tab P.** Close every ZZ sheet and dialog. Optionally reload the tab, which undoes the helper wrappers.
2. **Close windows.** On tab G, close the GM panel, the NPC generator, the guide, and any open dialogs and sheets:
   ```js
   for (const a of [...foundry.applications.instances.values()]) if (a.document?.name?.startsWith?.('ZZ') || ['sr2e-gm-panel', 'sr2e-npc-generator', 'sr2e-help'].includes(a.id) || a instanceof foundry.applications.api.DialogV2) await a.close();
   ```
3. **Settings and mock.** Restore the settings and the FilePicker mock. Expected: equal to `JSON.parse(localStorage.zzSnap083).set`.
   ```js
   const s = JSON.parse(localStorage.getItem('zzSnap083')).set; for (const [k, v] of Object.entries(s)) if (game.settings.get('sr2e', k) !== v) await game.settings.set('sr2e', k, v);
   if (window.zzFPorig) foundry.applications.apps.FilePicker.implementation.browse = zzFPorig; Object.fromEntries(Object.keys(s).map(k => [k, game.settings.get('sr2e', k)]))
   ```
4. **Back to the Safehouse, then delete the ZZ scene.**
   ```js
   await game.scenes.getName('Safehouse').view(); await zzW(1500); await game.scenes.getName('ZZ Art Map')?.delete(); [canvas.scene.name, game.scenes.getName('ZZ Art Map')]
   ```
   Expected: `["Safehouse", undefined]`. The active scene is unchanged.
5. **Delete every test actor.** This covers every `ZZ …` actor, including `ZZ Gen …` and the player's character.
   ```js
   const snapIds = new Set(JSON.parse(localStorage.getItem('zzSnap083')).actors.map(x => x[0]));
   const del = game.actors.filter(a => !snapIds.has(a.id) && (a.name.startsWith('ZZ') || a.folder?.name === 'Generated (SR2e)')).map(a => a.id);
   await Actor.deleteDocuments(del); [del.length, game.actors.size]
   ```
   Expected: `game.actors.size` is 22. Never delete an id that is in the snapshot.
6. **Folders and journals.** Delete the "Generated (SR2e)" folders only if the test created them (not in the snapshot):
   ```js
   const fs = new Set(JSON.parse(localStorage.getItem('zzSnap083')).folders); const nf = game.folders.filter(f => !fs.has(f.id)); for (const f of nf) await f.delete(); [nf.map(f => f.name), game.folders.size, game.journal.size]
   ```
   Expected: `game.journal.size` equals the snapshot's `journals`. If not, list the new journals (`game.journal.filter(j => …)`), and delete only those the test created.
7. **Final safety check.**
   ```js
   [zzSafe(), game.actors.filter(a => a.name.startsWith('ZZ')).length, game.scenes.size === JSON.parse(localStorage.zzSnap083).scenes.length, game.paused]
   ```
   Expected: `[{ actorsChanged: [], tokensChanged: 0, shTokens: 24 }, 0, true, true]`.
8. **Ownership.** The `ZZ Art NPC` ownership change went with the actor. Confirm that no user document was edited: no character was assigned to ZZ Testplayer.
9. **Data folder.** Nothing was uploaded, because the portrait folder was mocked. If a real upload was done instead, tell the user which folder to delete by hand.
10. `localStorage.removeItem('zzSnap083')`, then reload tab G to drop the console wrappers.

## Defects to watch (from code reading)

- **[D1]** GM panel count (`standInCount`) also counts actors showing the system's default art, because `isDefaultPortrait` treats default art as a stand-in. So the text "N actors still show the stand-in" and the confirm dialog overstate the number, and N never drops after the art is given.
- **[D2]** A player's change to their own character updates its picture and prototype token, but not its linked tokens already on the map (the token loop is GM-only and the GM client ignores other users' updates). This contradicts the guide.
- **[D3]** The sheet button "Use the default art" has no busy guard: a double click on an actor with a custom picture opens two confirm dialogs.
- **[D4]** With the setting off, or on old actors, the sheet hint calls Foundry's stand-in "a picture of its own".
- **[D5]** "Use the default art" leaves a hand-set linked token on the map as it is, even after confirming. This is probably intended; note it for the guide's wording.
