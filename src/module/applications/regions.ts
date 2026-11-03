/**
 * v0.60.0: scene regions as SR2 environments (Foundry glue). The GM gives a Region an SR2e environment in its
 * config window (flags.sr2e.env, see rules/regions.ts); tests then read the background count, environment
 * tags, weather, light and smoke where each token stands; wards stop astral forms at their edge; cameras and
 * sensors watching a region notice who walks in.
 */
import { SYSTEM_ID } from '../config/system.ts';
import {
  RULES, readRegionEnv, hasRegionEnv, shapesContain, shapesArea, regionLight, darknessWithBehaviors, segmentSamples, smokeAlong,
  crossedRegions, enteredRegions, wardStops, deviceWatches, type RegionHit, type RegionEnv, type LightLevel,
  wardPresence, barrierStopsMover,
} from '../rules/index.ts';
import { escHtml } from '../rules/html.ts';
import { isLeadGm } from './leader.ts';
import { t as tx } from '../helpers/i18n.ts';

/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;

function setting(key: string, fallback: string): string {
  try { return String((game as any).settings.get(SYSTEM_ID, key) ?? fallback); } catch { return fallback; }
}

/** A region document's shapes as plain data. */
function shapesOf(doc: any): any[] {
  return [...(doc?.shapes ?? [])].map((s: any) => (typeof s?.toObject === 'function' ? s.toObject() : s));
}

/** Whether a region document contains a point (Foundry's own test when there is one, else the shapes). */
export function regionHas(doc: any, p: { x: number; y: number; elevation?: number }): boolean {
  try {
    if (typeof doc?.testPoint === 'function') return Boolean(doc.testPoint({ x: p.x, y: p.y, elevation: Number(p.elevation ?? 0) }));
  } catch { /* fall back to the shapes */ }
  return shapesContain(shapesOf(doc), p, doc?.elevation ?? undefined);
}

/** The regions with an SR2 environment on a scene. */
export function envRegions(scene: any): any[] {
  return [...(scene?.regions ?? [])].filter((r: any) => hasRegionEnv(readRegionEnv(r?.flags?.[SYSTEM_ID]?.env)));
}

function hitOf(doc: any): RegionHit {
  let area: number | undefined;
  try { area = shapesArea(shapesOf(doc)); } catch { area = undefined; }
  return { id: String(doc.id), name: String(doc.name ?? 'Region'), env: readRegionEnv(doc.flags?.[SYSTEM_ID]?.env), ...(area !== undefined ? { area } : {}) };
}

/** The SR2 environment regions a point on a scene is in. */
export function regionsAt(scene: any, p: { x: number; y: number; elevation?: number }): RegionHit[] {
  if (!scene) return [];
  return envRegions(scene).filter((r: any) => regionHas(r, p)).map(hitOf);
}

/** A token's centre (placeable or document) in pixels, and its elevation. */
export function tokenPoint(t: any): { x: number; y: number; elevation: number } | null {
  if (!t) return null;
  if (t.center && Number.isFinite(t.center.x)) return { x: t.center.x, y: t.center.y, elevation: Number(t.document?.elevation ?? t.elevation ?? 0) };
  const doc = t.document ?? t;
  const size = Number(doc.parent?.grid?.size ?? (globalThis as any).canvas?.grid?.size ?? 100) || 100;
  if (!Number.isFinite(Number(doc.x))) return null;
  return { x: Number(doc.x) + (Number(doc.width ?? 1) * size) / 2, y: Number(doc.y) + (Number(doc.height ?? 1) * size) / 2, elevation: Number(doc.elevation ?? 0) };
}

function sceneOfToken(t: any): any {
  return t?.document?.parent ?? t?.parent ?? (globalThis as any).canvas?.scene ?? null;
}

/** The SR2 environment regions a token stands in. */
export function regionsAtToken(t: any): RegionHit[] {
  const p = tokenPoint(t);
  return p ? regionsAt(sceneOfToken(t), p) : [];
}

/** The token an actor acts from on the canvas (the same choice the tests make), or null. */
function tokenForActor(actor: any): any {
  try {
    const cls: any = (CONFIG as any).Actor?.documentClass;
    const t = cls?.tokenFor?.(actor);
    if (t) return t;
  } catch { /* none */ }
  try { return actor?.getActiveTokens?.()?.[0] ?? actor?.token ?? null; } catch { return null; }
}

/** The SR2 environment regions an actor's token stands in (none when it has no token). */
export function regionsForActor(actor: any): RegionHit[] {
  try { return regionsAtToken(tokenForActor(actor)); } catch { return []; }
}

/** The light a token's regions give (an SR2 light level, or a darkness level after Foundry's own darkness behaviours). */
export function regionLightAt(t: any, sceneDarkness: number): { light: LightLevel | null; darkness: number; from: string } {
  const p = tokenPoint(t);
  const scene = sceneOfToken(t);
  if (!p || !scene) return { light: null, darkness: sceneDarkness, from: '' };
  const hits = regionsAt(scene, p);
  const light = regionLight(hits);
  // Foundry's own "Adjust Darkness Level" behaviours on any region the token is in.
  const behaviors: Array<{ mode: number; modifier: number }> = [];
  let from = '';
  for (const r of [...(scene.regions ?? [])]) {
    const list = [...(r.behaviors ?? [])].filter((b: any) => b?.type === 'adjustDarknessLevel' && !b.disabled);
    if (!list.length || !regionHas(r, p)) continue;
    for (const b of list) behaviors.push({ mode: Number(b.system?.mode ?? 0), modifier: Number(b.system?.modifier ?? 0) });
    from ||= String(r.name ?? '');
  }
  const darkness = behaviors.length ? darknessWithBehaviors(sceneDarkness, behaviors) : sceneDarkness;
  return { light, darkness, from: light ? (hits.find((h) => h.env.light)?.name ?? '') : from };
}

/** The worst region smoke on the line between two tokens (or points) on a scene. */
export function regionSmokeBetween(a: any, b: any): { kind: 'none' | 'smoke' | 'thermal'; source: string } {
  const pa = tokenPoint(a), pb = tokenPoint(b);
  const scene = sceneOfToken(a);
  if (!pa || !pb || !scene) return { kind: 'none', source: '' };
  const smoky = envRegions(scene).filter((r: any) => readRegionEnv(r.flags?.[SYSTEM_ID]?.env).smoke);
  if (!smoky.length) return { kind: 'none', source: '' };
  const size = Number(scene.grid?.size ?? 100) || 100;
  const step = Math.max(5, size / 4);
  const hits = new Map<string, RegionHit>(smoky.map((r: any) => [String(r.id), hitOf(r)]));
  const samples = segmentSamples(pa, pb, step).map((pt) => smoky.filter((r: any) => regionHas(r, { ...pt, elevation: pa.elevation })).map((r: any) => hits.get(String(r.id))!));
  return smokeAlong(samples);
}

/** Ward regions whose edge lies between two tokens: the barrier actors (rating above 0), highest first. */
export function wardsBetween(a: any, b: any): any[] {
  const pa = tokenPoint(a), pb = tokenPoint(b);
  const scene = sceneOfToken(a);
  if (!pa || !pb || !scene || sceneOfToken(b) !== scene) return [];
  const wards = envRegions(scene).filter((r: any) => readRegionEnv(r.flags?.[SYSTEM_ID]?.env).wardUuid);
  if (!wards.length) return [];
  // Every edge the line crosses (in and out again counts), from points along it.
  const size = Number(scene.grid?.size ?? 100) || 100;
  const pts = segmentSamples(pa, pb, Math.max(5, size / 4));
  const crossed = new Set<string>();
  let prev = wards.filter((r: any) => regionHas(r, { ...pts[0]!, elevation: pa.elevation })).map((r: any) => String(r.id));
  for (const pt of pts.slice(1)) {
    const now = wards.filter((r: any) => regionHas(r, { ...pt, elevation: pa.elevation })).map((r: any) => String(r.id));
    for (const id of crossedRegions(prev, now)) crossed.add(id);
    prev = now;
  }
  const out = new Map<string, any>();
  for (const r of wards) {
    if (!crossed.has(r.id)) continue;
    let bar: any = null;
    try { bar = (globalThis as any).fromUuidSync?.(readRegionEnv(r.flags[SYSTEM_ID].env).wardUuid); } catch { bar = null; }
    if (bar?.type === 'barrier' && Number(bar.system?.rating ?? 0) > 0) out.set(bar.uuid, bar);
  }
  return [...out.values()].sort((x: any, y: any) => Number(y.system.rating) - Number(x.system.rating));
}

/** Whether an actor is an astral form a ward stops (projecting, or a spirit that isn't materialized). */
export function astralForm(actor: any): boolean {
  if (!actor) return false;
  if (actor.type === 'spirit') return actor.system?.materialized === false;
  return actor.system?.derived?.astralMode === 'projecting';
}

// ---------------------------------------------------------------- the region config window

/** v0.89.6: the choices are made when the window is, in the user's language. */
const LIGHT_CHOICES = (): Array<[string, string]> => [['', tx('SR2E.App.Regions.theScenes')], ['normal', tx('SR2E.App.Regions.normalLight')], ['partial', tx('SR2E.App.Regions.partialLight')], ['minimal', tx('SR2E.App.Regions.minimalLight')], ['darkness', tx('SR2E.App.Regions.totalDarkness')]];
const SMOKE_CHOICES = (): Array<[string, string]> => [['', tx('SR2E.App.Regions.none')], ['smoke', tx('SR2E.App.Regions.smoke')], ['thermal', tx('SR2E.App.Regions.thermalSmoke')]];

/** The SR2e environment fieldset for a region's config window (HTML). */
export function regionEnvFields(env: RegionEnv, o: { barriers: Array<{ uuid: string; name: string }>; devices: Array<{ siteUuid: string; deviceId: string; name: string }> }): string {
  const opt = (v: string, label: string, cur: string) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
  const p = `flags.${SYSTEM_ID}.env`;
  const weathers: Array<[string, string]> = [['', tx('SR2E.App.Regions.theScenes')], ...RULES.HEALTH.weather.map((w) => [w.id, w.id === 'clear' ? tx('SR2E.App.Regions.clearShelteredOrIndoors') : w.label] as [string, string])];
  const devVal = env.siteUuid && env.deviceId ? `${env.siteUuid}#${env.deviceId}` : '';
  return `<fieldset class="sr2e-region-env"><legend>${tx('SR2E.App.Regions.sr2eEnvironment')}</legend>
    <p class="hint">${tx('SR2E.App.Regions.whatThisRegionDoesTo')}</p>
    <div class="form-group"><label>${tx('SR2E.App.Regions.backgroundCount')}</label><div class="form-fields"><input type="number" name="${p}.backgroundCount" value="${env.backgroundCount}" min="0" max="20" step="1"></div></div>
    <div class="form-group"><label>${tx('SR2E.App.Regions.aspectedTo')}</label><div class="form-fields"><input type="text" name="${p}.backgroundAspect" value="${esc(env.backgroundAspect)}" placeholder="${tx('SR2E.App.Regions.eGHermeticBear')}"></div></div>
    <div class="form-group"><label>${tx('SR2E.App.Regions.toxic')}</label><div class="form-fields"><input type="checkbox" name="${p}.backgroundToxic" ${env.backgroundToxic ? 'checked' : ''}></div></div>
    <div class="form-group"><label>${tx('SR2E.App.Regions.environmentTags')}</label><div class="form-fields"><input type="text" name="${p}.environment" value="${esc(env.environment)}" placeholder="${tx('SR2E.App.Regions.eGForestUrban')}"></div></div>
    <div class="form-group"><label>${tx('SR2E.App.Regions.weatherInside')}</label><div class="form-fields"><select name="${p}.weather">${weathers.map(([v, l]) => opt(v, l, env.weather)).join('')}</select></div></div>
    <div class="form-group"><label>${tx('SR2E.App.Regions.lightInside')}</label><div class="form-fields"><select name="${p}.light">${LIGHT_CHOICES().map(([v, l]) => opt(v, l, env.light)).join('')}</select></div></div>
    <div class="form-group"><label>${tx('SR2E.App.Regions.smoke')}</label><div class="form-fields"><select name="${p}.smoke">${SMOKE_CHOICES().map(([v, l]) => opt(v, l, env.smoke)).join('')}</select></div></div>
    <div class="form-group"><label>${tx('SR2E.App.Regions.wardOrBarrierItsEdge')}</label><div class="form-fields"><select name="${p}.wardUuid">${opt('', tx('SR2E.App.Regions.none2'), env.wardUuid)}${o.barriers.map((b) => opt(b.uuid, b.name, env.wardUuid)).join('')}</select></div></div>
    <div class="form-group"><label>${tx('SR2E.App.Regions.watchedBy')}</label><div class="form-fields"><select data-sr2e-device>${opt('', tx('SR2E.App.Regions.noCameraOrSensor'), devVal)}${o.devices.map((d) => opt(`${d.siteUuid}#${d.deviceId}`, d.name, devVal)).join('')}</select></div></div>
    <input type="hidden" name="${p}.siteUuid" value="${esc(env.siteUuid)}"><input type="hidden" name="${p}.deviceId" value="${esc(env.deviceId)}">
  </fieldset>`;
}

function decorateRegionConfig(app: any, htmlIn: HTMLElement): void {
  if (!(game as any).user?.isGM) return;
  const html: HTMLElement = (htmlIn as any)?.querySelector ? htmlIn : (htmlIn as any)?.[0];
  const doc: any = app?.document ?? app?.object;
  if (!html || !doc || html.querySelector('.sr2e-region-env')) return;
  const form: HTMLElement | null = html.tagName === 'FORM' ? html : html.querySelector('form');
  if (!form) return;
  const env = readRegionEnv(doc.flags?.[SYSTEM_ID]?.env);
  const actors: any[] = [...((game as any).actors ?? [])];
  const barriers = actors.filter((a: any) => a.type === 'barrier').map((a: any) => ({ uuid: a.uuid, name: `${a.name} (${a.system?.barrierKind ?? 'ward'} ${a.system?.rating ?? 0})` }));
  const devices = actors.filter((a: any) => a.type === 'site').flatMap((s: any) => [...(s.system?.devices ?? [])]
    .filter((d: any) => ['camera', 'sensor', 'scanner', 'alarm', 'other'].includes(String(d.kind)))
    .map((d: any) => ({ siteUuid: s.uuid, deviceId: String(d.id), name: `${s.name}: ${d.name || d.kind} (${d.kind} ${d.rating})` })));
  const wrap = document.createElement('div');
  wrap.innerHTML = regionEnvFields(env, { barriers, devices });
  const fs = wrap.firstElementChild as HTMLElement;
  // The identity tab when there is one (v13+ region config has tabs), else above the footer.
  const tab = form.querySelector('.tab[data-tab="identity"]') ?? form.querySelector('.tab[data-tab]');
  const footer = form.querySelector('footer, .form-footer, .sheet-footer');
  if (tab) tab.appendChild(fs); else if (footer) footer.before(fs); else form.appendChild(fs);
  // The device picker fills the two hidden fields.
  const pick = fs.querySelector<HTMLSelectElement>('select[data-sr2e-device]');
  pick?.addEventListener('change', () => {
    const [site, dev] = String(pick.value || '#').split('#');
    const s = fs.querySelector<HTMLInputElement>(`input[name="flags.${SYSTEM_ID}.env.siteUuid"]`);
    const d = fs.querySelector<HTMLInputElement>(`input[name="flags.${SYSTEM_ID}.env.deviceId"]`);
    if (s) s.value = site ?? '';
    if (d) d.value = dev ?? '';
    s?.dispatchEvent(new Event('change', { bubbles: true }));
  });
  try { app.setPosition?.({ height: 'auto' }); } catch { /* fixed size */ }
}

// ---------------------------------------------------------------- wards and cameras on the move

/** The regions (ids) each token was last seen in, on the active GM's client (cameras: who walked in). */
const lastSeen = new Map<string, string[]>();

function watchedIdsAt(scene: any, p: { x: number; y: number; elevation?: number }): string[] {
  return envRegions(scene).filter((r: any) => { const e = readRegionEnv(r.flags?.[SYSTEM_ID]?.env); return e.siteUuid && e.deviceId; })
    .filter((r: any) => regionHas(r, p)).map((r: any) => String(r.id));
}

function seedSeen(scene: any): void {
  try {
    for (const t of [...(scene?.tokens ?? [])]) { const p = tokenPoint(t); if (p) lastSeen.set(String(t.uuid), watchedIdsAt(scene, p)); }
  } catch { /* no scene */ }
}

/** A camera's region: someone walked in (the active GM's client). Posts a GM card, or rolls detection (setting). */
async function noticeEntry(tokenDoc: any, region: any): Promise<void> {
  const mode = setting('regionDetect', 'prompt');
  if (mode === 'off') return;
  const env = readRegionEnv(region.flags?.[SYSTEM_ID]?.env);
  const site: any = await (globalThis as any).fromUuid?.(env.siteUuid);
  const actor: any = tokenDoc?.actor;
  if (!site || site.type !== 'site' || !actor) return;
  const d: any = [...(site.system?.devices ?? [])].find((x: any) => String(x.id) === env.deviceId);
  if (!d) return;
  const guard = [...(site.system?.guards ?? [])].includes(actor.uuid) || (!actor.isToken && [...(site.system?.guards ?? [])].includes(`Actor.${actor.id}`)) || site.system?.riggerUuid === actor.uuid;
  if (!deviceWatches({ active: Boolean(d.active), bypassed: Boolean(d.bypassed), guard, hidden: Boolean(tokenDoc.hidden), astral: astralForm(actor), sense: String(d.sense ?? '') })) return;
  if (mode === 'auto') { await site.detect?.(d.id, actor.uuid, {}); return; }
  const gms = [...((game as any).users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);
  await (globalThis as any).ChatMessage.create({
    speaker: { alias: site.name },
    whisper: gms,
    content: `<p><em>${tx('SR2E.Card.Regions.gmOnly')}</em> · <strong>${esc(d.name || d.kind)}</strong> ${tx('SR2E.Card.Regions.watches')} <em>${esc(region.name)}</em>${tx('SR2E.Card.Regions.walksIn', { tokenDocName: esc(tokenDoc.name) })}</p><p><button type="button" data-sr2e-action="regionDetect">${tx('SR2E.Card.Regions.detectionTest')}</button></p>`,
    flags: { [SYSTEM_ID]: { regionDetect: { siteUuid: site.uuid, deviceId: d.id, intruderUuid: actor.uuid } } },
  });
}

/** A token's move across a ward's edge (setting `wardsStopAstral`): false stops it. */
function wardMove(doc: any, change: any, userId: string): boolean {
  if (userId !== (game as any).user?.id || (change?.x === undefined && change?.y === undefined)) return true;
  const mode = setting('wardsStopAstral', 'block');
  // v0.72.0 (O19): anything with an astral presence (dual-natured critters, materialized spirits) meets a ward;
  // a physical barrier (O17) stops bodies (MAGIC_V72.wardPresence). Off: only astral forms, as before.
  const a: any = doc.actor;
  const presence = wardPresence(a ? { type: a.type, materialized: a.system?.materialized, astralMode: a.system?.derived?.astralMode, dualNatured: Boolean(a.system?.derived?.dualNatured) } : null);
  if (!presence.astral && !presence.physical) return true;
  const scene = doc.parent;
  const from = tokenPoint(doc);
  if (!from || !scene) return true;
  const to = tokenPoint({ ...((typeof doc.toObject === 'function' ? doc.toObject() : doc)), parent: scene, x: change.x ?? doc.x, y: change.y ?? doc.y, elevation: change.elevation ?? doc.elevation });
  if (!to) return true;
  for (const w of wardsBetween({ document: doc, center: from, parent: scene }, { document: doc, center: to, parent: scene })) {
    const kind = String(w.system?.barrierKind ?? 'ward');
    if (!barrierStopsMover(presence, kind)) continue;
    // The wardsStopAstral setting covers astral barriers; a physical barrier always blocks bodies (the GM passes with a note).
    const m = kind === 'physical barrier' ? 'block' : mode;
    if (m === 'off') continue;
    const v = wardStops({ astral: true, rating: Number(w.system?.rating ?? 0), mode: m, gm: Boolean((game as any).user?.isGM) });
    if (v === 'pass') continue;
    const plane = kind === 'physical barrier' ? tx('SR2E.Card.Regions.inThePhysicalWorld') : tx('SR2E.Card.Regions.onTheAstralPlane');
    if (v === 'stop') {
      ui.notifications?.warn?.(tx('SR2E.Notify.Regions.canTPassRatingBreachIt', { docName: escHtml(doc.name), wName: escHtml(w.name), wRating: escHtml(w.system.rating), plane }));
      return false;
    }
    ui.notifications?.info?.(tx('SR2E.Notify.Regions.crossesRating', { docName: escHtml(doc.name), wName: escHtml(w.name), wRating: escHtml(w.system.rating), plane }));
  }
  return true;
}

export function registerRegionHooks(): void {
  Hooks.on('renderRegionConfig', (app: any, html: HTMLElement) => {
    try { decorateRegionConfig(app, html); } catch (err) { console.warn('sr2e | region config', err); }
  });
  // What's saved is cleaned (numbers clamped, unknown values dropped), merged with what was there.
  Hooks.on('preUpdateRegion', (doc: any, change: any) => {
    const env = change?.flags?.[SYSTEM_ID]?.env;
    if (!env) return;
    const merged = readRegionEnv({ ...(doc.flags?.[SYSTEM_ID]?.env ?? {}), ...env });
    change.flags[SYSTEM_ID].env = merged;
  });
  // Wards stop astral forms at their edge (setting `wardsStopAstral`).
  Hooks.on('preUpdateToken', (doc: any, change: any, _options: any, userId: string) => (wardMove(doc, change, userId) ? undefined : false));
  // Cameras and sensors watching a region notice who walks in (the active GM's client).
  // v0.85.0: every GM window keeps the record (so a window that takes over has it); only the lead one notices.
  const gmWindow = (): boolean => Boolean((game as any).user?.isGM) || isLeadGm();
  Hooks.on('canvasReady', (c: any) => { if (gmWindow()) seedSeen(c?.scene); });
  Hooks.on('createToken', (doc: any) => { const p = tokenPoint(doc); if (p) lastSeen.set(String(doc.uuid), watchedIdsAt(doc.parent, p)); });
  Hooks.on('deleteToken', (doc: any) => { lastSeen.delete(String(doc.uuid)); });
  // A camera region drawn (or moved) over someone already standing there doesn't count as them walking in.
  const reseed = (r: any) => { if (gmWindow()) seedSeen(r?.parent); };
  Hooks.on('createRegion', reseed);
  Hooks.on('updateRegion', reseed);
  Hooks.on('deleteRegion', reseed);
  // Where the mover's client saw the token before the move (the GM's own record may be missing after a reload).
  Hooks.on('preUpdateToken', (doc: any, change: any, options: any) => {
    if (change?.x === undefined && change?.y === undefined && change?.elevation === undefined) return;
    const p = tokenPoint(doc);
    if (p) options.sr2eWatchedBefore = watchedIdsAt(doc.parent, p);
  });
  Hooks.on('updateToken', (doc: any, change: any, options: any) => {
    if (change?.x === undefined && change?.y === undefined && change?.elevation === undefined) return;
    if (!gmWindow()) return;
    const p = tokenPoint(doc);
    if (!p) return;
    const now = watchedIdsAt(doc.parent, p);
    const before = lastSeen.get(String(doc.uuid)) ?? (Array.isArray(options?.sr2eWatchedBefore) ? options.sr2eWatchedBefore : now);
    lastSeen.set(String(doc.uuid), now);
    if (!isLeadGm()) return;
    for (const id of enteredRegions(before, now)) {
      const r = doc.parent?.regions?.get?.(id);
      if (r) void noticeEntry(doc, r);
    }
  });
}
