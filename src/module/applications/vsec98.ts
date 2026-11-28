/**
 * v0.98.0 rules completeness, building security and vehicle upkeep: the Foundry glue for RULES.VSEC_V98 (pure logic:
 * rules/vsec98.ts). The repair card's parts line, the rigger's decking TN, motion and vibration sensors in a site's
 * detection, the GM's "Security and vehicle upkeep" tool (a site's CCSS values and security levels, the security
 * rigger's Perception Test, a request to access the rigged system, rigger combat, the vehicle design calculator), and
 * their card buttons.
 *
 * Security: a site and its devices are GM-owned and written only on a GM's client. The tool is the GM's. An intruder's
 * access step is rolled by their owner from the GM's request card; the GM's Apply on that roll's card takes the dice,
 * TN and successes needed from the GM-authored request, checks that the roll card's author owns the intruder, and
 * counts the successes again from the card's own dice. Rigger combat's damage card is the GM's; only the loser's owner
 * (or a GM) resists it. Every value put into HTML is escaped.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { RULES, type DamageLevel } from '../rules/config.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';
import { allActors } from '../helpers/actors.ts';
import { successTest, type SuccessTestResult, type TargetNumberModifier } from '../rules/dice.ts';
import { DAMAGE_LEVELS } from '../rules/util.ts';
import { VSEC_CHASSIS_98 } from '../rules/config98/vsec.ts';
import * as X from '../rules/vsec98.ts';
import { authorIsGm, authorOwns, gmMay } from './trust.ts';
import { movedThisTurn } from './canvas.ts';

const G = (): any => (globalThis as any).game;
const isGm = (): boolean => Boolean(G()?.user?.isGM);
const dialogs = (): any => (globalThis as any).foundry?.applications?.api?.DialogV2;
const warn = (text: string): void => { (globalThis as any).ui?.notifications?.warn?.(text); };
const post = (content: string, extra: Record<string, unknown> = {}): Promise<any> => (globalThis as any).ChatMessage.create({ content, ...extra });
const speaker = (actor: any): any => { try { return (globalThis as any).ChatMessage.getSpeaker({ actor }); } catch { return {}; } };
const name = (a: any): string => escHtml(String(a?.name ?? ''));
const int = (v: unknown, min: number, max: number, d = min): number => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
const uuidOk = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 400;
const sync = (uuid: unknown): any => { try { return uuidOk(uuid) ? (globalThis as any).fromUuidSync?.(uuid) ?? null : null; } catch { return null; } };
const actorClass = (): any => (globalThis as any).CONFIG?.Actor?.documentClass;
const users = (): any[] => [...(G()?.users ?? [])];
const gmIds = (): string[] => users().filter((u: any) => u.isGM).map((u: any) => u.id);
const ownerIds = (a: any): string[] => users().filter((u: any) => !u.isGM && a?.testUserPermission?.(u, 'OWNER')).map((u: any) => u.id);
const flag = (a: any, k: string): unknown => (typeof a?.getFlag === 'function' ? a.getFlag(SYSTEM_ID, k) : a?.flags?.[SYSTEM_ID]?.[k]);
const total = (a: any, k: string): number => Math.max(0, Math.floor(Number(a?.system?.attributes?.[k]?.total ?? 0)));
const skillOf = (a: any, n: string): number => Math.max(0, Math.floor(Number(a?.findSkill?.(n)?.system?.rating ?? 0)));
const SELECTED = ' selected';
const optionHtml = (v: string, l: string, cur: string): string => `<option value="${escHtml(v)}"${v === cur ? SELECTED : ''}>${escHtml(l)}</option>`;
const sel = (opts: Array<[string, string]>, n: string, cur = ''): string => {
  const inner = opts.map(([v, l]) => optionHtml(v, l, cur)).join('');
  return `<select name="${n}">${inner}</select>`;
};
const numIn = (label: string, n: string, v: number, min = 0, max = 99): string =>
  `<div class="form-group"><label>${escHtml(label)}</label><input name="${n}" type="number" value="${escHtml(String(v))}" min="${min}" max="${max}"></div>`;
const row = (label: string, inner: string): string => `<div class="form-group"><label>${escHtml(label)}</label>${inner}</div>`;

/** Dice rolled with Foundry (shown by Dice So Nice through the card's rolls). */
function roller(sink: any[]): (count: number) => Promise<number[]> {
  return async (count: number) => {
    const roll = await new (globalThis as any).Roll(`${count}d6`).evaluate();
    sink.push(roll);
    return (roll.dice ?? []).flatMap((term: any) => term.results.map((r: any) => Number(r.result)));
  };
}
const diceText = (r: SuccessTestResult): string => r.dice.map((d) => Number(d.total)).join(', ');
function rollLine(label: string, r: SuccessTestResult): string {
  return `<p>${label}: ${tx('SR2E.VSec98.roll', { dice: escHtml(diceText(r) || '-'), tn: r.targetNumber, successes: r.successes })}</p>`;
}

/** The flag on a site (GM-owned) with its CCSS values, levels and the intruders' access steps. */
export const SITE_FLAG = 'vsec98';
/** On a rigger combat loser: the damage cards they have resisted (their own character only). */
export const RESISTED_FLAG = 'vsec98Resisted';
const keyOf = (uuid: string): string => String(uuid).replace(/\./g, '_').slice(0, 200);

// ================================================================ Hooks in shared code

/** The repair card's parts line (Rigger 2 p. 26), or ''. */
export function repairPartsLine(vehicle: any, boxes: number): string {
  const cost = X.repairPartsCost(boxes, X.vehicleTotalCost(vehicle?.system ?? {}));
  if (cost == null) return '';
  const avail = String(vehicle?.system?.availability ?? '').slice(0, 40);
  return `<p class="hint">${tx('SR2E.VSec98.Repair.parts', { cost: cost.toLocaleString(), boxes: Math.max(0, Math.floor(Number(boxes) || 0)), percent: RULES.VSEC_V98.repairPartsPercent, availability: avail ? escHtml(avail) : tx('SR2E.VSec98.Repair.noAvailability') })}</p>`;
}

/** The installed cyberware's names (for the two-datajack exception). */
function wareNames(actor: any): string[] {
  return [...(actor?.items ?? [])].filter((i: any) => ['cyberware', 'bioware'].includes(String(i?.type)) && i.system?.installed).map((i: any) => String(i.name ?? ''));
}

/** A rigger decking (Rigger 2 p. 16): +1 TN on their Matrix tests. Their own character's values only. */
export function riggerDeckingMods(actor: any): TargetNumberModifier[] {
  const p = X.riggerDeckingPenalty({ vcr: Number(actor?.system?.derived?.rigging?.vcr ?? 0), datajacks: X.datajackCount(wareNames(actor)) });
  return p.tn ? [{ id: 'riggerDecking98', label: tx('SR2E.VSec98.Decking.tn'), value: p.tn }] : [];
}

/**
 * A motion or vibration sensor's test (CSH pp. 99–100), from the site's detect (the GM's client): the intruder's
 * Stealth (their sneaking side, without its walking/running modifier) against the device's rating plus the movement
 * modifier; one success gets past it, none (or too fast for a vibration detector) sets it off.
 */
export async function sensorDetect(site: any, d: any, intruder: any, extra: TargetNumberModifier[] = []): Promise<{ detected: boolean }> {
  const kind = X.sensorTestKind(String(d?.sense ?? '')) ?? 'motion';
  let metres: number | null = null;
  try { const tok = actorClass()?.tokenFor?.(intruder); metres = tok && G()?.combat?.started ? movedThisTurn(tok) : null; } catch { metres = null; }
  const t = X.sensorTest(kind, Number(d?.rating ?? 0), metres);
  const side = intruder?.stealthSide?.() ?? { dice: total(intruder, 'quickness'), modifiers: [] };
  const moving = new Set([tx('SR2E.Card.Mod.sneakerRunning'), tx('SR2E.Card.Mod.sneakerWalking')]);
  const mods: TargetNumberModifier[] = [...(side.modifiers ?? []).filter((m: any) => !moving.has(String(m?.label ?? ''))), ...extra,
    ...(t.move ? [{ id: 'sensorMove98', label: tx('SR2E.VSec98.Sensor.move', { metres: metres == null ? 0 : Math.round(metres * 100) / 100 }), value: t.move }] : [])];
  const rolls: any[] = [];
  const r = t.auto ? null : await successTest({ dice: Math.max(0, Math.floor(Number(side.dice) || 0)), targetNumber: t.tn, modifiers: mods, roll: roller(rolls) });
  const passed = X.sensorPassed(r?.successes ?? 0, t.auto);
  const hp = { device: escHtml(String(d?.name ?? '')), rating: Math.floor(Number(d?.rating) || 0), intruder: name(intruder) };
  const body = t.auto ? `<p>${tx('SR2E.VSec98.Sensor.tooFast', { metres: metres == null ? 0 : Math.round(metres * 100) / 100 })}</p>` : rollLine(tx('SR2E.VSec98.Sensor.stealth', { intruder: name(intruder) }), r!);
  const unknown = metres == null ? `<p class="hint">${tx('SR2E.VSec98.Sensor.unknownMove')}</p>` : '';
  await post(`<p><em>${tx('SR2E.VSec98.gmOnly')}</em> ${kind === 'vibration' ? tx('SR2E.VSec98.Sensor.vibration', { device: hp.device, rating: hp.rating, intruder: hp.intruder }) : tx('SR2E.VSec98.Sensor.motion', { device: hp.device, rating: hp.rating, intruder: hp.intruder })}</p>${body}${unknown}<p><strong>${passed ? tx('SR2E.VSec98.Sensor.passed', { intruder: name(intruder) }) : tx('SR2E.VSec98.Sensor.tripped', { intruder: name(intruder) })}</strong></p>`,
    { speaker: { alias: String(site?.name ?? '') }, rolls, whisper: gmIds(), blind: true });
  if (!passed) {
    const det = RULES.SECURITY.detection;
    await actorClass()?.changeSite?.(site, { add: Math.max(0, Number(det.tallyPerNet) || 0), minAlert: det.detectedAlert }, tx('SR2E.VSec98.Sensor.label', { device: String(d?.name ?? ''), intruder: String(intruder?.name ?? '') }), String(site?.uuid ?? ''));
  }
  return { detected: !passed };
}

// ================================================================ A site's CCSS values (GM side)

/** The site's stored values (bounded). */
export function siteValues(site: any): X.SiteCcss {
  return X.siteCcss(flag(site, SITE_FLAG));
}

/** Write a site's values (a GM's client only). */
async function saveSite(site: any, v: X.SiteCcss): Promise<boolean> {
  if (!isGm() || site?.type !== 'site') return false;
  await site.update({ [`flags.${SYSTEM_ID}.${SITE_FLAG}`]: { technical: v.technical, vigilance: v.vigilance, levels: v.levels, oslMod: v.oslMod, access: v.access } });
  return true;
}

/** The site's security rigger (assigned, jumped in or not) and their RC deck rating. */
function riggerOf(site: any): any {
  return sync(site?.system?.riggerUuid);
}

/** The site panel's info lines: CCSS limits, OSL and the CCSS rating. */
export function sitePanelInfo(site: any, v: X.SiteCcss = siteValues(site)): string {
  const lines: string[] = [];
  const rigger = riggerOf(site);
  const lim = rigger ? X.ccssLimits({ intelligence: total(rigger, 'intelligence'), rcDeck: Number(rigger?.system?.derived?.rigging?.rcd ?? 0) }) : null;
  if (lim) {
    const devices = Number((site?.system?.devices ?? []).length);
    const drones = Number((site?.system?.slaved ?? []).length);
    lines.push(`<p class="hint">${tx('SR2E.VSec98.Site.limits', { rigger: name(rigger), devices: lim.devices, drones: lim.drones, haveDevices: devices, haveDrones: drones })}</p>`);
    if (drones > lim.drones) lines.push(`<p class="hint">${tx('SR2E.VSec98.Site.overDrones', { over: drones - lim.drones })}</p>`);
    if (devices + drones > lim.devices) lines.push(`<p class="hint">${tx('SR2E.VSec98.Site.overDevices')}</p>`);
  } else if (X.on('ccss')) lines.push(`<p class="hint">${tx('SR2E.VSec98.Site.noRigger')}</p>`);
  const osl = X.overallSecurityLevel(v.levels, v.oslMod);
  if (osl != null) lines.push(`<p class="hint">${tx('SR2E.VSec98.Site.osl', { osl, ccss: X.ccssRating98(v.levels) })}</p>`);
  return lines.join('');
}

/** Set each rated device's rating by the site's levels (CSH p. 100). Returns how many changed. */
export async function applyRatings(site: any, v: X.SiteCcss, o: { exterior?: boolean; high?: boolean } = {}): Promise<number> {
  if (!isGm() || site?.type !== 'site') return 0;
  let n = 0;
  const devices = [...(site.system?.devices ?? [])].map((d: any) => {
    const r = X.deviceRating98(d, v.levels, o);
    if (r == null || r === Number(d.rating)) return { ...d };
    n++;
    return { ...d, rating: r };
  });
  if (n) await site.update({ 'system.devices': devices });
  return n;
}

const sites = (): any[] => allActors().filter((a: any) => a.type === 'site');
const people = (): any[] => allActors().filter((a: any) => ['character', 'npc'].includes(a.type));
const controlled = (): any[] => [...((globalThis as any).canvas?.tokens?.controlled ?? [])].map((t: any) => t.actor).filter(Boolean);

async function pickSite(title: string): Promise<any | null> {
  const list = sites();
  if (!list.length) { warn(tx('SR2E.VSec98.noSites')); return null; }
  if (list.length === 1) return list[0];
  const r = await dialogs()?.prompt?.({
    window: { title },
    content: row(tx('SR2E.VSec98.site'), sel(list.map((s: any) => [String(s.uuid), String(s.name)]), 'site')),
    ok: { label: tx('SR2E.VSec98.ok'), callback: (_e: Event, b: any) => String(b.form.elements.site.value) },
    rejectClose: false,
  });
  return r ? sync(r) : null;
}

/** The site panel: CCSS values, security levels, and (CSH p. 100) the device ratings by level. */
async function sitePanel(): Promise<void> {
  const site = await pickSite(tx('SR2E.VSec98.Site.title'));
  if (!site) return;
  const v = siteValues(site);
  const vig = Object.keys(X.VIGILANCE).map((k) => [k, tKey(`SR2E.VSec98.Vigilance.${k}`)] as [string, string]);
  const levels = X.on('ratings') ? X.LEVEL_KEYS.map((k) => numIn(tKey(`SR2E.VSec98.Level.${k}`), `lv_${k}`, v.levels[k] ?? 0, 0, 4)).join('') + numIn(tx('SR2E.VSec98.Site.oslMod'), 'oslMod', v.oslMod, -5, 5) : '';
  const r = await dialogs()?.wait?.({
    window: { title: tx('SR2E.VSec98.Site.titleOf', { name: String(site.name ?? '') }) },
    content: `${sitePanelInfo(site, v)}${X.on('access') || X.on('riggerCombat') ? numIn(tx('SR2E.VSec98.Site.technical'), 'technical', v.technical, 1, 10) + row(tx('SR2E.VSec98.Site.vigilance'), sel(vig, 'vigilance', v.vigilance)) : ''}${levels}
      ${X.on('ratings') ? `<label class="sr2e-check"><input type="checkbox" name="exterior"> ${tx('SR2E.VSec98.Site.exterior')}</label><label class="sr2e-check"><input type="checkbox" name="high"> ${tx('SR2E.VSec98.Site.high')}</label>` : ''}`,
    buttons: [
      { action: 'save', label: tx('SR2E.VSec98.Site.save'), callback: (_e: Event, b: any) => ({ op: 'save', el: b.form.elements }) },
      ...(X.on('ratings') ? [{ action: 'rate', label: tx('SR2E.VSec98.Site.rate'), callback: (_e: Event, b: any) => ({ op: 'rate', el: b.form.elements }) }] : []),
      { action: 'cancel', label: tx('SR2E.VSec98.cancel'), callback: () => null },
    ],
    rejectClose: false,
  }) as { op: string; el: any } | null;
  if (!r) return;
  const el = r.el;
  const lv: Record<string, number> = { ...v.levels };
  for (const k of X.LEVEL_KEYS) if (el[`lv_${k}`]) lv[k] = int(el[`lv_${k}`].value, 0, 4, 0);
  const next: X.SiteCcss = X.siteCcss({ ...v, technical: el.technical ? int(el.technical.value, 1, 10, 1) : v.technical, vigilance: el.vigilance ? String(el.vigilance.value) : v.vigilance, levels: lv, oslMod: el.oslMod ? int(el.oslMod.value, -5, 5, 0) : v.oslMod });
  await saveSite(site, next);
  let note = tx('SR2E.VSec98.Site.saved', { name: name(site) });
  if (r.op === 'rate') note += ` ${tx('SR2E.VSec98.Site.rated', { n: await applyRatings(site, next, { exterior: Boolean(el.exterior?.checked), high: Boolean(el.high?.checked) }) })}`;
  await post(`<p><em>${tx('SR2E.VSec98.gmOnly')}</em> ${note}</p>${sitePanelInfo(site, next)}`, { whisper: gmIds() });
}

// ================================================================ The security rigger's Perception Test (Rigger 2 p. 77)

/** The GM's secret Perception Test for the site's rigger on a trigger. */
export async function riggerPerception(site: any, trigger: string, tamperSuccesses = 0): Promise<SuccessTestResult | null> {
  const rigger = riggerOf(site);
  if (!rigger) { warn(tx('SR2E.VSec98.Site.noRigger')); return null; }
  const t = X.riggerPerceptionTn(trigger, { tamperSuccesses, onAlert: X.siteOnAlert(String(site?.system?.alert ?? 'none')) });
  if (t.why) { warn(escHtml(tKey(t.why))); return null; }
  const label = tKey(`SR2E.VSec98.Trigger.${trigger}`);
  if (t.tn == null) {
    await post(`<p><em>${tx('SR2E.VSec98.gmOnly')}</em> ${tx('SR2E.VSec98.Perception.auto', { rigger: name(rigger), trigger: escHtml(label) })}</p>`, { whisper: gmIds() });
    return null;
  }
  const pd = rigger.perceptionDice?.() ?? { dice: total(rigger, 'intelligence'), modifiers: [] };
  const rolls: any[] = [];
  const r = await successTest({ dice: Math.max(0, Math.floor(Number(pd.dice) || 0)), targetNumber: t.tn, modifiers: pd.modifiers ?? [], roll: roller(rolls) });
  await post(`<p><em>${tx('SR2E.VSec98.gmOnly')}</em> ${tx('SR2E.VSec98.Perception.head', { rigger: name(rigger), trigger: escHtml(label), site: name(site) })}</p>${rollLine(tx('SR2E.VSec98.Perception.test'), r)}<p><strong>${r.successes > 0 ? tx('SR2E.VSec98.Perception.notices', { rigger: name(rigger) }) : tx('SR2E.VSec98.Perception.misses', { rigger: name(rigger) })}</strong></p>`,
    { rolls, whisper: gmIds(), blind: true });
  return r;
}

async function perceptionTool(): Promise<void> {
  const site = await pickSite(tx('SR2E.VSec98.Perception.title'));
  if (!site) return;
  const r = await dialogs()?.prompt?.({
    window: { title: tx('SR2E.VSec98.Perception.title') },
    content: `${row(tx('SR2E.VSec98.Perception.trigger'), sel(X.PERCEPTION_TRIGGERS.map((k) => [k, tKey(`SR2E.VSec98.Trigger.${k}`)]), 'trigger'))}${numIn(tx('SR2E.VSec98.Perception.tamper'), 'tamper', 1, 0, 20)}`,
    ok: { label: tx('SR2E.VSec98.roll2'), callback: (_e: Event, b: any) => ({ trigger: String(b.form.elements.trigger.value), tamper: int(b.form.elements.tamper.value, 0, 20, 1) }) },
    rejectClose: false,
  });
  if (r) await riggerPerception(site, r.trigger, r.tamper);
}

// ================================================================ Accessing a rigged system (Rigger 2 p. 79)

/** The GM's request card for an access step: the intruder's owner rolls it. */
export async function requestAccess(site: any, intruder: any, step: string, device: number): Promise<any | null> {
  if (!isGm() || site?.type !== 'site' || !intruder) return null;
  const v = siteValues(site);
  const t = X.accessTest(step, { device, electronics: skillOf(intruder, RULES.SECURITY.bypass.skill), intelligence: total(intruder, 'intelligence'), technical: v.technical, vigilance: v.vigilance });
  if (t.why) { warn(escHtml(tKey(t.why))); return null; }
  const req = { siteUuid: String(site.uuid), intruderUuid: String(intruder.uuid), step, dice: t.dice, tn: t.tn, need: t.need, alertOnFail: t.alertOnFail };
  return post(`<p>${tx('SR2E.VSec98.Access.request', { intruder: name(intruder), step: escHtml(tKey(`SR2E.VSec98.Step.${step}`)), dice: t.dice, tn: t.tn, need: t.need })}</p><p><button type="button" data-sr2e-action="vsec98Roll">${tx('SR2E.VSec98.Access.roll')}</button></p>`,
    { speaker: { alias: String(site.name ?? '') }, whisper: [...gmIds(), ...ownerIds(intruder)], flags: { [SYSTEM_ID]: { vsec98Req: req } } });
}

/** A request card's values, bounded (only a GM's card is read). */
function reqOf(message: any): { siteUuid: string; intruderUuid: string; step: X.AccessStep; dice: number; tn: number; need: number; alertOnFail: boolean } | null {
  if (!authorIsGm(message)) return null;
  const q: any = message?.flags?.[SYSTEM_ID]?.vsec98Req;
  if (!q || !uuidOk(q.siteUuid) || !uuidOk(q.intruderUuid) || !(X.ACCESS_STEPS as readonly string[]).includes(q.step)) return null;
  return { siteUuid: q.siteUuid, intruderUuid: q.intruderUuid, step: q.step, dice: int(q.dice, 0, 40, 0), tn: int(q.tn, 2, 30, 2), need: int(q.need, 1, 4, 1), alertOnFail: q.alertOnFail === true };
}

/**
 * Count a roll card's successes again from its own dice (null when its dice don't make exactly this test): each roll
 * the test asks for (the first throw, then each throw of the sixes re-rolled) must be the card's next Roll, with
 * exactly that many dice, none of them other than 1–6, and no Roll left over.
 */
export async function replayTest(message: any, dice: number, tn: number): Promise<SuccessTestResult | null> {
  const throws: number[][] = [...(message?.rolls ?? [])].map((r: any) => [...(r?.dice ?? [])].flatMap((t: any) => [...(t?.results ?? [])].map((x: any) => Math.floor(Number(x?.result)))));
  if (throws.some((t) => t.some((f) => !(f >= 1 && f <= 6)))) return null;
  let i = 0;
  let bad = false;
  const r = await successTest({ dice, targetNumber: tn, roll: async (n: number) => {
    const t = throws[i++];
    if (!t || t.length !== n) { bad = true; return new Array(n).fill(1); }
    return t;
  } });
  return bad || i !== throws.length ? null : r;
}

async function accessTool(): Promise<void> {
  const site = await pickSite(tx('SR2E.VSec98.Access.title'));
  if (!site) return;
  const picked = controlled().filter((a: any) => ['character', 'npc'].includes(a.type));
  const list = picked.length ? picked : people();
  const r = await dialogs()?.prompt?.({
    window: { title: tx('SR2E.VSec98.Access.title') },
    content: `${row(tx('SR2E.VSec98.intruder'), sel(list.map((a: any) => [String(a.uuid), String(a.name)]), 'intruder'))}${row(tx('SR2E.VSec98.Access.step'), sel(X.ACCESS_STEPS.map((k) => [k, tKey(`SR2E.VSec98.Step.${k}`)]), 'step'))}${numIn(tx('SR2E.VSec98.Access.device'), 'device', 3, 0, 20)}
      <p class="hint">${tx('SR2E.VSec98.Access.hint')}</p>`,
    ok: { label: tx('SR2E.VSec98.Access.send'), callback: (_e: Event, b: any) => ({ intruder: String(b.form.elements.intruder.value), step: String(b.form.elements.step.value), device: int(b.form.elements.device.value, 0, 20, 0) }) },
    rejectClose: false,
  });
  if (r) await requestAccess(site, sync(r.intruder), r.step, r.device);
}

// ================================================================ Rigger combat (Rigger 2 pp. 79–80; CSH p. 105)

const attrLabel = (a: string): string => tKey(`SR2E.VSec98.Attr.${a}`);

/** A side of rigger combat from an actor (a decker: their emulation utility's rating). */
function sideOf(a: any, decker: boolean, emulation = 0): X.CombatSide {
  return { willpower: total(a, 'willpower'), body: total(a, 'body'), pool: Number(a?.system?.derived?.controlPoolLeft ?? 0), decker, emulation };
}

/** One exchange of rigger combat, rolled by the GM: the opposed Willpower Test and the loser's damage card. */
export async function riggerCombat(o: { attacker: any; defender: any; attackerDecker?: boolean; defenderDecker?: boolean; emulation?: number; pool?: number }): Promise<{ winner: string | null } | null> {
  if (!isGm() || !X.on('riggerCombat') || !o.attacker || !o.defender) return null;
  const A = sideOf(o.attacker, Boolean(o.attackerDecker), o.emulation ?? 0), D = sideOf(o.defender, Boolean(o.defenderDecker), o.emulation ?? 0);
  const pool = Math.min(Math.max(0, Math.floor(Number(o.pool) || 0)), X.combatPoolCap(A, 'attack'));
  const t = X.combatTests(A, D, pool);
  const rolls: any[] = [];
  const ra = await successTest({ dice: t.attacker.dice, targetNumber: t.attacker.tn, roll: roller(rolls) });
  const rd = await successTest({ dice: t.defender.dice, targetNumber: t.defender.tn, roll: roller(rolls) });
  if (pool > 0 && !A.decker) await o.attacker.spendControl98?.(pool);
  const out = X.combatOutcome(ra.successes, rd.successes, A, D);
  const deckerNote = A.decker || D.decker ? `<p class="hint">${tx('SR2E.VSec98.Combat.deckerNote', { init: X.DECKER_INIT_98 })}</p>` : '';
  let body = `<p><strong>${tx('SR2E.VSec98.Combat.head', { attacker: name(o.attacker), defender: name(o.defender) })}</strong></p>${rollLine(tx('SR2E.VSec98.Combat.attack', { name: name(o.attacker), pool }), ra)}${rollLine(tx('SR2E.VSec98.Combat.defend', { name: name(o.defender) }), rd)}${deckerNote}`;
  const flags: Record<string, unknown> = {};
  if (!out.winner) body += `<p>${tx('SR2E.VSec98.Combat.tie')}</p>`;
  else {
    const loser = out.winner === 'attacker' ? o.defender : o.attacker;
    const L = out.winner === 'attacker' ? D : A;
    const res = X.combatResistance(L, out.power);
    body += `<p>${tx('SR2E.VSec98.Combat.hit', { winner: name(out.winner === 'attacker' ? o.attacker : o.defender), loser: name(loser), power: out.power, level: out.level, net: out.net })}</p><p><button type="button" data-sr2e-action="vsec98Resist">${tx('SR2E.VSec98.Combat.resist', { attribute: escHtml(attrLabel(res.attribute)), tn: res.tn })}</button></p>`;
    flags.vsec98Hit = { loserUuid: String(loser.uuid), tn: res.tn, level: out.level, attribute: res.attribute, poolCap: res.poolCap };
  }
  await post(body, { rolls, flags: { [SYSTEM_ID]: flags } });
  return { winner: out.winner };
}

async function combatTool(): Promise<void> {
  const site = await pickSite(tx('SR2E.VSec98.Combat.title'));
  const rigger = site ? riggerOf(site) : null;
  const list = people();
  if (!list.length) return;
  const picked = controlled().filter((a: any) => ['character', 'npc'].includes(a.type));
  const opts = list.map((a: any) => [String(a.uuid), String(a.name)] as [string, string]);
  const access = site ? siteValues(site).access : {};
  const r = await dialogs()?.prompt?.({
    window: { title: tx('SR2E.VSec98.Combat.title') },
    content: `${row(tx('SR2E.VSec98.intruder'), sel(opts, 'intruder', String(picked[0]?.uuid ?? '')))}${row(tx('SR2E.VSec98.Combat.securityRigger'), sel(opts, 'rigger', String(rigger?.uuid ?? '')))}
      ${row(tx('SR2E.VSec98.Combat.who'), sel([['intruder', tx('SR2E.VSec98.intruder')], ['rigger', tx('SR2E.VSec98.Combat.securityRigger')]], 'who'))}
      <label class="sr2e-check"><input type="checkbox" name="decker"> ${tx('SR2E.VSec98.Combat.decker')}</label>${numIn(tx('SR2E.VSec98.Combat.emulation'), 'emulation', 0, 0, 20)}${numIn(tx('SR2E.VSec98.Combat.pool'), 'pool', 0, 0, 30)}
      <p class="hint">${tx('SR2E.VSec98.Combat.hint')}</p>`,
    ok: { label: tx('SR2E.VSec98.roll2'), callback: (_e: Event, b: any) => { const e = b.form.elements; return { intruder: String(e.intruder.value), rigger: String(e.rigger.value), who: String(e.who.value), decker: Boolean(e.decker.checked), emulation: int(e.emulation.value, 0, 20, 0), pool: int(e.pool.value, 0, 30, 0) }; } },
    rejectClose: false,
  });
  if (!r) return;
  const intruder = sync(r.intruder), sec = sync(r.rigger);
  if (!intruder || !sec || intruder === sec) return;
  // The intruder should have finished the access steps first (the site's own record; the GM decides).
  if (site && X.on('access') && (access[keyOf(String(intruder.uuid))] ?? 0) < (r.decker ? 2 : 3)) warn(tx('SR2E.VSec98.Combat.noAccess', { name: name(intruder) }));
  const intrAttacks = r.who === 'intruder';
  await riggerCombat({ attacker: intrAttacks ? intruder : sec, defender: intrAttacks ? sec : intruder, attackerDecker: intrAttacks && r.decker, defenderDecker: !intrAttacks && r.decker, emulation: r.emulation, pool: r.pool });
}

// ================================================================ Vehicle design (Rigger 2 pp. 108–114, 170–171)

async function designTool(): Promise<void> {
  const ch = VSEC_CHASSIS_98.map((c) => [c.id, tKey(`SR2E.VSec98.Chassis.${c.id}`)] as [string, string]);
  const specials = Object.keys(X.SPECIAL_98);
  const r = await dialogs()?.prompt?.({
    window: { title: tx('SR2E.VSec98.Design.title') },
    content: `${row(tx('SR2E.VSec98.Design.chassis'), sel(ch, 'chassis'))}${numIn(tx('SR2E.VSec98.Design.plant'), 'plant', 0, 0, 100000)}${numIn(tx('SR2E.VSec98.Design.options'), 'options', 0, 0, 1000000)}
      ${numIn(tx('SR2E.VSec98.Design.markupMod'), 'markupMod', 0, 0, 10)}<label class="sr2e-check"><input type="checkbox" name="spHigh"> ${tx('SR2E.VSec98.Design.high')}</label>
      ${specials.map((k) => `<label class="sr2e-check"><input type="checkbox" name="sp_${escHtml(k)}"> ${escHtml(tKey(`SR2E.VSec98.Special.${k}`))}</label>`).join('')}
      <p class="hint">${tx('SR2E.VSec98.Design.hint')}</p>`,
    ok: { label: tx('SR2E.VSec98.Design.work'), callback: (_e: Event, b: any) => { const e = b.form.elements; return { chassis: String(e.chassis.value), plant: int(e.plant.value, 0, 100000, 0), options: int(e.options.value, 0, 1000000, 0), mod: Number(e.markupMod.value) || 0, high: Boolean(e.spHigh?.checked), sp: specials.filter((k) => e[`sp_${k}`]?.checked) }; } },
    rejectClose: false,
  });
  if (!r) return;
  const c = X.chassis98(r.chassis);
  if (!c) return;
  // The special-design multipliers: each range's low end, or (ticked) its high end; the GM may round in between.
  const specs = (r.sp as string[]).map((id) => { const [lo, hi] = X.SPECIAL_98[id]!; return { id, value: r.high ? hi : lo }; });
  const dpv: number = Math.max(0, Number(c.dp ?? 0)) + Number(r.plant) + Number(r.options);
  const p = X.designPrice({ dpv, category: c.cat, modifiers: Math.max(0, r.mod), specials: specs });
  if (!p) return;
  const na = tx('SR2E.VSec98.Design.na');
  const show = (v: number | null): string => (v == null ? na : String(v));
  await post(`<p><em>${tx('SR2E.VSec98.gmOnly')}</em> <strong>${escHtml(tKey(`SR2E.VSec98.Chassis.${c.id}`))}</strong></p><p>${tx('SR2E.VSec98.Design.stats', { handling: c.ho ? `${c.h}/${c.ho}` : String(c.h), body: show(c.body), armor: show(c.armor), cf: show(c.cf), cfMax: show(c.cfMax), autonav: show(c.autonav), pilot: show(c.pilot), sensor: show(c.sensor), dp: show(c.dp) })}</p>
    <p>${tx('SR2E.VSec98.Design.price', { dpv, factor: p.factor, price: p.price.toLocaleString() })}</p>`, { whisper: gmIds() });
}

// ================================================================ The GM's tool

/** The GM's "Security and vehicle upkeep (book)" tool: the operations whose switches are at the book's way. */
export async function openVsecTool(): Promise<void> {
  if (!isGm()) return;
  const ops: Array<[string, boolean, () => Promise<void>]> = [
    ['site', X.on('ccss') || X.on('ratings') || X.on('access') || X.on('riggerCombat'), sitePanel],
    ['perception', X.on('perception'), perceptionTool],
    ['access', X.on('access'), accessTool],
    ['combat', X.on('riggerCombat'), combatTool],
    ['design', X.on('design'), designTool],
  ];
  const live = ops.filter(([, ok]) => ok);
  if (!live.length) { warn(tx('SR2E.VSec98.allOff')); return; }
  const pick = await dialogs()?.wait?.({
    window: { title: tx('SR2E.VSec98.Tool.title') },
    content: `<p>${tx('SR2E.VSec98.Tool.intro')}</p>`,
    buttons: [...live.map(([id]) => ({ action: id, label: tKey(`SR2E.VSec98.Tool.${id}`), callback: () => id })), { action: 'cancel', label: tx('SR2E.VSec98.cancel'), callback: () => null }],
    rejectClose: false,
  }) as string | null;
  const op = live.find(([id]) => id === pick);
  if (op) await op[2]();
}

// ================================================================ Card buttons

export async function onCard(message: any, button: HTMLButtonElement, action: string): Promise<void> {
  const flags: any = message?.flags?.[SYSTEM_ID] ?? {};
  if (action === 'vsec98Roll') {
    const q = reqOf(message);
    if (!q) { warn(tx('SR2E.VSec98.gmCardOnly')); return; }
    const intruder: any = await (globalThis as any).fromUuid(q.intruderUuid);
    if (!intruder) return;
    if (!isGm() && !intruder.isOwner) { warn(tx('SR2E.VSec98.ownerOnly', { name: name(intruder) })); return; }
    button.disabled = true;
    const rolls: any[] = [];
    const r = await successTest({ dice: q.dice, targetNumber: q.tn, roll: roller(rolls) });
    const ok = X.accessOutcome(r.successes, q).done;
    await post(`${rollLine(tx('SR2E.VSec98.Access.rolled', { intruder: name(intruder), step: escHtml(tKey(`SR2E.VSec98.Step.${q.step}`)) }), r)}<p><strong>${ok ? tx('SR2E.VSec98.Access.done', { need: q.need }) : tx('SR2E.VSec98.Access.failed', { need: q.need })}</strong></p><p><button type="button" data-sr2e-action="vsec98Apply">${tx('SR2E.VSec98.Access.apply')}</button></p>`,
      { speaker: speaker(intruder), rolls, whisper: [...gmIds(), ...ownerIds(intruder)], flags: { [SYSTEM_ID]: { vsec98Res: { reqId: String(message.id ?? '') } } } });
    return;
  }
  if (action === 'vsec98Apply') {
    if (!isGm()) { warn(tx('SR2E.VSec98.gmOnlyButton')); return; }
    await applyAccess(message);
    return;
  }
  if (action === 'vsec98Resist') {
    if (!authorIsGm(message)) { warn(tx('SR2E.VSec98.gmCardOnly')); return; }
    const h: any = flags.vsec98Hit;
    const loser: any = uuidOk(h?.loserUuid) ? await (globalThis as any).fromUuid(h.loserUuid) : null;
    if (!loser) return;
    if (!isGm() && !loser.isOwner) { warn(tx('SR2E.VSec98.ownerOnly', { name: name(loser) })); return; }
    const done: string[] = Array.isArray(flag(loser, RESISTED_FLAG)) ? (flag(loser, RESISTED_FLAG) as unknown[]).map(String) : [];
    if (message.getFlag?.(SYSTEM_ID, 'vsec98Done') || done.includes(String(message.id))) { warn(tx('SR2E.VSec98.already')); return; }
    const level: DamageLevel = (DAMAGE_LEVELS as readonly string[]).includes(h.level) ? h.level : 'L';
    const cap = Math.min(int(h.poolCap, 0, 30, 0), Number(loser.system?.derived?.controlPoolLeft ?? 0));
    let pool = 0;
    if (cap > 0) {
      const p = await dialogs()?.prompt?.({
        window: { title: tx('SR2E.VSec98.Combat.resistTitle') },
        content: numIn(tx('SR2E.VSec98.Combat.resistPool', { cap }), 'pool', 0, 0, cap),
        ok: { label: tx('SR2E.VSec98.roll2'), callback: (_e: Event, b: any) => int(b.form.elements.pool.value, 0, cap, 0) },
        rejectClose: false,
      });
      if (p == null) return;
      pool = p;
    }
    button.disabled = true;
    await loser.resistRiggerCombat98?.({ tn: int(h.tn, 2, 40, 2), level, attribute: h.attribute === 'willpower' ? 'willpower' : 'body', pool });
    if (message.isOwner) await message.setFlag(SYSTEM_ID, 'vsec98Done', true);
    else await loser.setFlag(SYSTEM_ID, RESISTED_FLAG, [...done, String(message.id)].slice(-40));
  }
}

/** The first roll card posted for a request by the intruder's owner (or a GM), in chat order; null if none is found. */
function firstRollFor(reqId: string, intruderUuid: string): any | null {
  const all: any = G()?.messages;
  const list: any[] = all?.contents ?? (all && typeof all[Symbol.iterator] === 'function' ? [...all] : []);
  return list.find((m: any) => String(m?.flags?.[SYSTEM_ID]?.vsec98Res?.reqId ?? '') === reqId && authorOwns(m, intruderUuid)) ?? null;
}

/**
 * The GM applies an access roll: the request must be a GM's card, the roll card's author must own the intruder, and
 * the successes are counted again from the roll card's dice with the request's dice and TN. Done: the site records
 * the step; failed decryption or protocols: the site goes on alert. Once per roll card.
 */
export async function applyAccess(message: any): Promise<boolean> {
  if (!isGm()) return false;
  if (message?.getFlag?.(SYSTEM_ID, 'vsec98Applied')) { warn(tx('SR2E.VSec98.already')); return false; }
  const reqId = String(message?.flags?.[SYSTEM_ID]?.vsec98Res?.reqId ?? '');
  const req = reqId ? G()?.messages?.get?.(reqId) : null;
  const q = req ? reqOf(req) : null;
  if (!q) { warn(tx('SR2E.VSec98.gmCardOnly')); return false; }
  if (!authorOwns(message, q.intruderUuid)) { warn(tx('SR2E.VSec98.Access.notTheirs')); return false; }
  // One roll per request: the request is used up once applied, and only the intruder side's first roll card counts.
  if (req.getFlag?.(SYSTEM_ID, 'vsec98Used')) { warn(tx('SR2E.VSec98.already')); return false; }
  const first = firstRollFor(reqId, q.intruderUuid);
  if (first && first !== message) { warn(tx('SR2E.VSec98.Access.notFirst')); return false; }
  const r = await replayTest(message, q.dice, q.tn);
  if (!r) { warn(tx('SR2E.VSec98.Access.badRoll')); return false; }
  const site: any = await (globalThis as any).fromUuid(q.siteUuid);
  const intruder: any = sync(q.intruderUuid);
  if (site?.type !== 'site') return false;
  const out = X.accessOutcome(r.successes, q);
  // The GM sees what the re-counted roll does before the site changes (a player's card; trust.ts gmMay).
  const what = tx('SR2E.VSec98.Access.confirm', { intruder: String(intruder?.name ?? ''), step: tKey(`SR2E.VSec98.Step.${q.step}`), successes: r.successes, need: q.need });
  if (!(await gmMay(message, { title: tx('SR2E.VSec98.Access.title'), lines: [what], sources: [q.intruderUuid] }))) return false;
  const v = siteValues(site);
  const k = keyOf(q.intruderUuid);
  let note: string;
  if (out.done) {
    await saveSite(site, { ...v, access: { ...v.access, [k]: Math.max(v.access[k] ?? 0, X.stepIndex(q.step)) } });
    note = tx('SR2E.VSec98.Access.recorded', { intruder: name(intruder), step: escHtml(tKey(`SR2E.VSec98.Step.${q.step}`)) });
  } else if (out.alert) {
    await actorClass()?.changeSite?.(site, { minAlert: out.alert }, tx('SR2E.VSec98.Access.alertLabel', { intruder: String(intruder?.name ?? '') }), String(site.uuid));
    note = tx('SR2E.VSec98.Access.alerted', { alert: escHtml(out.alert) });
  } else note = tx('SR2E.VSec98.Access.noEffect');
  await message.setFlag(SYSTEM_ID, 'vsec98Applied', true);
  await req.setFlag?.(SYSTEM_ID, 'vsec98Used', true);
  await post(`<p><em>${tx('SR2E.VSec98.gmOnly')}</em> ${note}</p>`, { whisper: gmIds() });
  return true;
}
