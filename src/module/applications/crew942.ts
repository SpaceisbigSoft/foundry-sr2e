/**
 * v0.94.2 (improvement plan item 42): crew stations on the vehicle sheet (Foundry glue; the pure parts are in
 * rules/crew942.ts).
 *
 * - A "Crew stations" panel under the vehicle's status strip, with a tab per station (driver, each gunner, sensors,
 *   commander). The user's own stations come first and open by default.
 * - Each tab shows who sits there, its ready mark, and that station's actions. The actions are the sheet's own buttons
 *   (`driveVehicle`, `pushSpeed`, `crashTest`, `ramVehicle`, `fireMounted`, `sensorTest`, `clearLock`, `jamLink`):
 *   nothing is rolled here.
 * - The driver's seat is the vehicle's controller (setController). The other seats and the ready marks are the flag
 *   `crew942` on the vehicle. A user who can't write the vehicle (a crew member aboard someone else's vehicle) asks the
 *   GM's client over the relay (op `crewStation`), which checks the request against the sender (never the payload).
 * - When the last occupied station is marked ready, the GMs get a whispered line. The GM clears the marks.
 * - World setting `crewStations` (on by default) shows the panel.
 */
import { SYSTEM_ID } from '../config/system.ts';
import { t as tx } from '../helpers/i18n.ts';
import { escHtml } from '../rules/html.ts';
import { replaceFlag } from '../helpers/flags.ts';
import { onRelay, requestGm } from './socket.ts';
import {
  CREW_FLAG, stationsFor, crewOf, seatOf, stationsOfActor, seat, markReady, clearReady, allReady, stationGuns, stationOrder, crewMay, validStation,
  type CrewState, type Station,
} from '../rules/crew942.ts';

/** Whether the panel shows (world setting; on when the setting isn't registered). */
export function crewStationsOn(): boolean {
  try { return game.settings.get(SYSTEM_ID, 'crewStations') !== false; } catch { return true; }
}

const fromUuidQuiet = (u: string): any => { try { return u ? (globalThis as any).fromUuidSync?.(u) ?? null : null; } catch { return null; } };
const owns = (doc: any, user: any): boolean => Boolean(doc?.testUserPermission?.(user, 'OWNER'));

/** The vehicle's mounted weapons (id, name, mount). */
function mountedWeapons(vehicle: any): Array<{ id: string; name: string; mount: string }> {
  return [...(vehicle?.items ?? [])].filter((i: any) => i.type === 'weapon' && i.system?.mount && i.system.mount !== 'none')
    .map((i: any) => ({ id: String(i.id), name: String(i.name), mount: String(i.system.mount) }));
}

export function vehicleStations(vehicle: any): Station[] {
  return stationsFor(mountedWeapons(vehicle).map((w) => w.mount));
}

export function crewStateOf(vehicle: any): CrewState {
  return crewOf(vehicle?.flags?.[SYSTEM_ID]?.[CREW_FLAG] ?? null);
}

const controllerOf = (vehicle: any): string => String(vehicle?.system?.controllerUuid ?? '');

/** The station's label ("Gunner 2"). */
export function stationLabel(s: Station, count: number): string {
  const base = tx(`SR2E.Crew.Station.${s.role}`);
  return s.role === 'gunner' && count > 1 ? tx('SR2E.Crew.numbered', { label: base, n: s.n }) : base;
}

/** The actors this user may seat: their own characters and NPCs (the GM: all, those aboard first). */
function seatable(vehicle: any): any[] {
  const actors = [...((game as any).actors ?? [])].filter((a: any) => ['character', 'npc'].includes(a.type) && (game.user?.isGM || a.isOwner));
  const aboard = new Set((vehicle.system?.occupants ?? []) as string[]);
  return actors.sort((a: any, b: any) => Number(aboard.has(b.uuid)) - Number(aboard.has(a.uuid)));
}

// ---------------------------------------------------------------- applying a change (here, or on the GM's client)

type CrewOp = { vehicleUuid: string; op: 'seat' | 'ready' | 'clear'; station?: string; actorUuid?: string; on?: boolean };

/**
 * Pure-ish: whether `user` may make this change to `vehicle` (the relay judges the sender with it; the sheet the
 * local user). Seating someone else is 'assign'; seating one's own actor at a free station is 'claim'; emptying a
 * station is 'leave'.
 */
export function crewOpAllowed(vehicle: any, user: any, req: CrewOp): boolean {
  if (!vehicle || vehicle.type !== 'vehicle' || !user) return false;
  const isGM = Boolean(user.isGM), ownsVehicle = owns(vehicle, user);
  if (req.op === 'clear') return isGM;
  if (!validStation(req.station)) return false;
  const state = crewStateOf(vehicle);
  const sitting = seatOf(state, req.station, controllerOf(vehicle));
  if (req.op === 'ready') return crewMay('ready', { isGM, ownsVehicle, ownsActor: owns(fromUuidQuiet(sitting), user), aboard: false, free: false }) && Boolean(sitting);
  const actor = req.actorUuid ? fromUuidQuiet(req.actorUuid) : null;
  if (!req.actorUuid) return crewMay('leave', { isGM, ownsVehicle, ownsActor: owns(fromUuidQuiet(sitting), user), aboard: false, free: false });
  if (!actor || !['character', 'npc'].includes(actor.type)) return false;
  const ownsActor = owns(actor, user);
  const aboard = Boolean(vehicle.isAboard?.(actor)) || controllerOf(vehicle) === actor.uuid;
  return crewMay('claim', { isGM, ownsVehicle, ownsActor, aboard, free: !sitting }) || crewMay('assign', { isGM, ownsVehicle, ownsActor, aboard, free: !sitting });
}

/** Make the change on this client (it can write the vehicle). True when done. */
async function applyCrewOp(vehicle: any, req: CrewOp, userName: string): Promise<boolean> {
  const before = crewStateOf(vehicle);
  const stations = vehicleStations(vehicle);
  let next: CrewState = before;
  if (req.op === 'clear') next = clearReady(before);
  else if (req.op === 'ready') next = markReady(before, req.station!, Boolean(req.on));
  else if (req.station === 'driver') {
    // The driver's seat is the controller: the vehicle's own method (it keeps the driver's rigging in step and says so).
    const actor = req.actorUuid ? fromUuidQuiet(req.actorUuid) : null;
    if (!(await vehicle.setController(actor, 'manual'))) return false;
    next = markReady(seat(before, 'driver', ''), 'driver', false);
    // A driver keeps no other seat.
    if (actor) for (const k of stationsOfActor(next, actor.uuid, '')) next = seat(next, k, '');
  } else {
    next = seat(before, req.station!, req.actorUuid ?? '');
    const actor = req.actorUuid ? fromUuidQuiet(req.actorUuid) : null;
    // A gunner fires from aboard (SR2Actor.mountedRole): someone seated who isn't aboard is put aboard.
    if (actor && !vehicle.isAboard?.(actor) && controllerOf(vehicle) !== actor.uuid) {
      await vehicle.update({ 'system.occupants': [...((vehicle.system?.occupants ?? []) as string[]), actor.uuid] });
    }
    // Seated elsewhere means not driving any more.
    if (actor && controllerOf(vehicle) === actor.uuid) { await vehicle.setController(null); next = markReady(next, 'driver', false); }
  }
  await replaceFlag(vehicle, CREW_FLAG, { seats: next.seats, ready: next.ready });
  if (req.op === 'ready' && req.on && !allReady(before, stations, controllerOf(vehicle)) && allReady(next, stations, controllerOf(vehicle))) {
    const gms = [...((game as any).users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: vehicle }), whisper: gms, content: `<p>${tx('SR2E.Crew.allReady', { name: escHtml(vehicle.name), by: escHtml(userName) })}</p>` });
  }
  return true;
}

/** Ask for a change: made here when this user may write the vehicle, else by the GM's client. */
async function crewRequest(vehicle: any, req: CrewOp): Promise<void> {
  if (!crewOpAllowed(vehicle, game.user, req)) { ui.notifications?.warn?.(tx('SR2E.Crew.notAllowed')); return; }
  // The driver's seat also writes the old and new drivers (setController): here only when this user owns them too.
  const driverDocs = req.op === 'seat' && req.station === 'driver' ? [fromUuidQuiet(req.actorUuid ?? ''), fromUuidQuiet(controllerOf(vehicle))].filter(Boolean) : [];
  if (vehicle.isOwner && driverDocs.every((a: any) => a.isOwner)) {
    await applyCrewOp(vehicle, req, String(game.user?.name ?? ''));
    return;
  }
  const r = await requestGm('crewStation', req);
  if (!r.ok) ui.notifications?.warn?.(r.note ? escHtml(r.note) : tx('SR2E.Crew.notAllowed'));
}

// The GM's client: the sender is judged, never the payload's claims.
onRelay('crewStation', async (d, user) => {
  const vehicle: any = fromUuidQuiet(String(d?.vehicleUuid ?? ''));
  const op = ['seat', 'ready', 'clear'].includes(String(d?.op)) ? (String(d.op) as CrewOp['op']) : null;
  if (!vehicle || !op) return { ok: false, note: tx('SR2E.Crew.notAllowed') };
  const req: CrewOp = { vehicleUuid: String(vehicle.uuid), op, ...(validStation(d?.station) ? { station: d.station } : {}), ...(typeof d?.actorUuid === 'string' && d.actorUuid.length <= 400 ? { actorUuid: d.actorUuid } : {}), on: d?.on === true };
  if (!crewOpAllowed(vehicle, user, req)) return { ok: false, note: tx('SR2E.Crew.notAllowed') };
  return { ok: await applyCrewOp(vehicle, req, String(user?.name ?? '')) };
});

// ---------------------------------------------------------------- the panel

/** Which tab each open sheet shows (by the sheet's id), kept across re-renders. */
const openTab = new Map<string, string>();

const btn = (action: string, icon: string, label: string, extra = ''): string =>
  `<button type="button" data-action="${action}"${extra}><i class="fa-solid ${icon}" aria-hidden="true"></i> ${escHtml(label)}</button>`;

/** One station's actions: the sheet's own buttons. */
function stationActions(vehicle: any, s: Station, gunnerCount: number): string {
  const weapons = mountedWeapons(vehicle);
  const guns = stationGuns(s, weapons, gunnerCount).map((w) => btn('fireMounted', 'fa-crosshairs', tx('SR2E.Crew.fire', { name: w.name }), ` data-item-id="${escHtml(w.id)}"`)).join(' ');
  if (s.role === 'driver') {
    return [btn('driveVehicle', 'fa-car', tx('SR2E.Crew.drive')), btn('pushSpeed', 'fa-gauge-high', tx('SR2E.Crew.push')), btn('crashTest', 'fa-triangle-exclamation', tx('SR2E.Crew.crashTest')),
      btn('ramVehicle', 'fa-car-side', tx('SR2E.Crew.ram')), guns].filter(Boolean).join(' ');
  }
  if (s.role === 'gunner') return guns || `<em>${tx('SR2E.Crew.noGuns')}</em>`;
  if (s.role === 'sensors') {
    const locks = ((vehicle.system?.locks ?? []) as any[]).map((l) => `<span class="sr2e-chip">${escHtml(l.targetName ?? '')} (${Number(l.successes ?? 0)}) <a data-action="clearLock" data-uuid="${escHtml(l.targetUuid ?? '')}" title="${tx('SR2E.Crew.dropLock')}"><i class="fa-solid fa-xmark"></i></a></span>`).join(' ');
    return [btn('sensorTest', 'fa-satellite-dish', tx('SR2E.Crew.sensorTest')), Number(vehicle.system?.ecm ?? 0) > 0 ? btn('jamLink', 'fa-tower-broadcast', tx('SR2E.Crew.jam')) : '', locks].filter(Boolean).join(' ');
  }
  return `<em>${tx('SR2E.Crew.commanderHint')}</em>`;
}

/** The panel's HTML for this user (exported for the glue tests). */
export function crewPanelHtml(vehicle: any, sheetId = ''): string {
  const stations = vehicleStations(vehicle);
  const state = crewStateOf(vehicle);
  const ctl = controllerOf(vehicle);
  const gunnerCount = stations.filter((s) => s.role === 'gunner').length;
  const isGM = Boolean(game.user?.isGM);
  const mine = stations.filter((s) => { const a = fromUuidQuiet(seatOf(state, s.id, ctl)); return a && !isGM && a.isOwner; }).map((s) => s.id);
  const ordered = stationOrder(stations, mine);
  const active = ordered.find((s) => s.id === openTab.get(sheetId))?.id ?? ordered[0]!.id;
  const everyone = allReady(state, stations, ctl);
  const tabs = ordered.map((s) => {
    const who = fromUuidQuiet(seatOf(state, s.id, ctl));
    const ready = state.ready[s.id] === true;
    return `<a class="sr2e-crew-tab${s.id === active ? ' active' : ''}${mine.includes(s.id) ? ' mine' : ''}" data-action="crewTab" data-station="${s.id}" role="tab" aria-selected="${s.id === active}">${escHtml(stationLabel(s, gunnerCount))}${who ? ` <small>${escHtml(who.name)}</small>` : ''}${ready ? ` <i class="fa-solid fa-circle-check sr2e-crew-ready" title="${tx('SR2E.Crew.ready')}"></i>` : ''}</a>`;
  }).join('');
  const panels = ordered.map((s) => {
    const uuid = seatOf(state, s.id, ctl);
    const who = fromUuidQuiet(uuid);
    const free = !uuid;
    const ready = state.ready[s.id] === true;
    const user = game.user;
    const mayReady = Boolean(who) && crewMay('ready', { isGM, ownsVehicle: Boolean(vehicle.isOwner), ownsActor: Boolean(who?.isOwner), aboard: false, free: false });
    const mayLeave = Boolean(uuid) && crewMay('leave', { isGM, ownsVehicle: Boolean(vehicle.isOwner), ownsActor: Boolean(who?.isOwner), aboard: false, free: false });
    const mayClaim = free && seatable(vehicle).some((a: any) => crewOpAllowed(vehicle, user, { vehicleUuid: vehicle.uuid, op: 'seat', station: s.id, actorUuid: a.uuid }));
    const controls = [
      mayClaim ? btn('crewClaim', 'fa-chair', tx('SR2E.Crew.claim'), ` data-station="${s.id}"`) : '',
      (isGM || vehicle.isOwner) ? btn('crewAssign', 'fa-user-plus', tx('SR2E.Crew.assign'), ` data-station="${s.id}"`) : '',
      mayLeave ? btn('crewLeave', 'fa-person-walking-arrow-right', tx('SR2E.Crew.leave'), ` data-station="${s.id}"`) : '',
      mayReady ? `<a class="sr2e-crew-readybox${ready ? ' on' : ''}" data-action="crewReady" data-station="${s.id}" data-on="${ready ? '' : '1'}" role="button" aria-pressed="${ready}"><i class="fa-regular ${ready ? 'fa-square-check' : 'fa-square'}" aria-hidden="true"></i> ${tx('SR2E.Crew.readyMark')}</a>` : (who ? `<span class="hint">${ready ? tx('SR2E.Crew.ready') : tx('SR2E.Crew.notReady')}</span>` : ''),
    ].filter(Boolean).join(' ');
    return `<div class="sr2e-crew-panel${s.id === active ? ' active' : ''}" data-station="${s.id}" role="tabpanel">
      <p class="sr2e-crew-seat">${who ? `<a data-action="openActor" data-uuid="${escHtml(who.uuid)}"><strong>${escHtml(who.name)}</strong></a>` : `<em>${tx('SR2E.Crew.free')}</em>`} ${controls}</p>
      <div class="sr2e-row sr2e-crew-actions">${stationActions(vehicle, s, gunnerCount)}</div></div>`;
  }).join('');
  const head = `<h3 data-heading="Crew stations">${tx('SR2E.Crew.title')}${everyone ? ` <span class="sr2e-chip sr2e-crew-allready">${tx('SR2E.Crew.allReadyChip')}</span>` : ''}${isGM ? ` <a data-action="crewClearReady" title="${tx('SR2E.Crew.clearReady')}"><i class="fa-solid fa-eraser"></i></a>` : ''}</h3>`;
  return `${head}<nav class="sr2e-crew-tabs" role="tablist">${tabs}</nav>${panels}`;
}

/** Put the panel into a rendered vehicle sheet (under the status strip). */
export function decorateCrewStations(app: any): void {
  try {
    const vehicle: any = app?.document;
    const root: HTMLElement | null = app?.element ?? null;
    if (!vehicle || vehicle.type !== 'vehicle' || !root || !crewStationsOn()) return;
    root.querySelector('.sr2e-crew')?.remove();
    const box = document.createElement('section');
    box.className = 'sr2e-crew';
    box.innerHTML = crewPanelHtml(vehicle, String(app.id ?? ''));
    const strip = root.querySelector('.sr2e-vehicle .sr2e-stuck');
    if (strip) strip.after(box); else root.querySelector('.sr2e-vehicle')?.prepend(box);
  } catch (err) { console.warn('sr2e | crew stations', err); }
}

/** Seat-picker: the actors this user may put at the station. */
async function pickActor(vehicle: any, station: string, mode: 'claim' | 'assign'): Promise<string | null> {
  const list = seatable(vehicle).filter((a: any) => crewOpAllowed(vehicle, game.user, { vehicleUuid: vehicle.uuid, op: 'seat', station, actorUuid: a.uuid }) && (mode === 'assign' || a.isOwner));
  if (!list.length) { ui.notifications?.warn?.(tx('SR2E.Crew.nobodyToSeat')); return null; }
  if (list.length === 1 && mode === 'claim') return String(list[0].uuid);
  const r = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Crew.pickTitle', { name: vehicle.name }) },
    content: `<div class="form-group"><label>${tx('SR2E.Crew.who')}</label><select name="who" autofocus>${list.map((a: any) => `<option value="${escHtml(a.uuid)}">${escHtml(a.name)}</option>`).join('')}</select></div>`,
    ok: { label: tx('SR2E.Crew.seatIt'), callback: (_e: Event, b: any) => String(b.form.elements.who.value ?? '') },
    rejectClose: false,
  });
  return typeof r === 'string' && r ? r : null;
}

/** The sheet's actions for the panel (spread into SR2VehicleSheet's actions). */
export const CREW_ACTIONS: Record<string, (this: any, e: Event, t: HTMLElement) => any> = {
  crewTab(this: any, _e: Event, t: HTMLElement) {
    const id = String(t.dataset['station'] ?? '');
    openTab.set(String(this.id ?? ''), id);
    const box = t.closest('.sr2e-crew');
    box?.querySelectorAll('.sr2e-crew-tab').forEach((el) => { el.classList.toggle('active', (el as HTMLElement).dataset['station'] === id); el.setAttribute('aria-selected', String((el as HTMLElement).dataset['station'] === id)); });
    box?.querySelectorAll('.sr2e-crew-panel').forEach((el) => el.classList.toggle('active', (el as HTMLElement).dataset['station'] === id));
  },
  async crewClaim(this: any, _e: Event, t: HTMLElement) {
    const station = String(t.dataset['station'] ?? '');
    const who = await pickActor(this.document, station, 'claim');
    if (who) await crewRequest(this.document, { vehicleUuid: this.document.uuid, op: 'seat', station, actorUuid: who });
  },
  async crewAssign(this: any, _e: Event, t: HTMLElement) {
    const station = String(t.dataset['station'] ?? '');
    const who = await pickActor(this.document, station, 'assign');
    if (who) await crewRequest(this.document, { vehicleUuid: this.document.uuid, op: 'seat', station, actorUuid: who });
  },
  async crewLeave(this: any, _e: Event, t: HTMLElement) {
    await crewRequest(this.document, { vehicleUuid: this.document.uuid, op: 'seat', station: String(t.dataset['station'] ?? '') });
  },
  async crewReady(this: any, _e: Event, t: HTMLElement) {
    await crewRequest(this.document, { vehicleUuid: this.document.uuid, op: 'ready', station: String(t.dataset['station'] ?? ''), on: t.dataset['on'] === '1' });
  },
  async crewClearReady(this: any) {
    if (!game.user?.isGM) return;
    await crewRequest(this.document, { vehicleUuid: this.document.uuid, op: 'clear' });
  },
};
