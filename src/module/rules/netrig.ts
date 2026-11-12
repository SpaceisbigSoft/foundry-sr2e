import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { utilitySize, IC_BEHAVIORS, type IcBehavior } from './matrix.ts';
import { deckPartBook } from './matrix923.ts';
import { dsDeviceEccm } from './urr80-drones-security.ts';
import { fluxRangeKm } from './docs79-drones-magic.ts';
import { bearingDiff, own } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';

/**
 * Matrix and rigging (v0.46.0). Pure rules, no Foundry dependency. Values in RULES.MATRIX (party,
 * construct, numbers, agentSearch, programming, deckBuilding, tortoise, iccm, otaku), RULES.SIGNAL,
 * RULES.VEHICLES (sensorModes, arcs, cargo, autosofts, modifications), RULES.RIGGING.jamming and
 * RULES.SECURITY (senses, concealment, tamper, bypassTime). All VERIFY.
 */

// ---------------------------------------------------------------- IC: parties and constructs

/** The initiative a party acts on: its best member's score (null when nobody has rolled). */
export function partyInitiative(scores: ReadonlyArray<number | null | undefined>): number | null {
  const s = scores.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return s.length ? Math.max(...s) : null;
}

/**
 * Party initiative updates: for every party (combatants sharing a non-empty party name), each
 * member whose score differs from the party's best gets that best score.
 */
export function partyInitiativeUpdates(entries: ReadonlyArray<{ id: string; party: string; initiative: number | null }>): Array<{ _id: string; initiative: number }> {
  if (!RULES.MATRIX.party.sharedInitiative) return [];
  const byParty = new Map<string, Array<{ id: string; initiative: number | null }>>();
  for (const e of entries) {
    const p = String(e.party ?? '').trim();
    if (!p) continue;
    if (!byParty.has(p)) byParty.set(p, []);
    byParty.get(p)!.push(e);
  }
  const out: Array<{ _id: string; initiative: number }> = [];
  for (const members of byParty.values()) {
    if (members.length < 2) continue;
    const best = partyInitiative(members.map((m) => m.initiative));
    if (best === null) continue;
    for (const m of members) if (m.initiative !== best) out.push({ _id: m.id, initiative: best });
  }
  return out;
}

/** The behaviors a construct IC can act as: its own first, then its components (known, unique, capped). */
export function constructBehaviors(own: string, construct: readonly string[] | null | undefined): IcBehavior[] {
  const known = new Set<string>(IC_BEHAVIORS);
  const list = [own, ...(construct ?? [])].filter((b) => known.has(b));
  return [...new Set(list)].slice(0, Math.max(1, RULES.MATRIX.construct.maxComponents)) as IcBehavior[];
}

// ---------------------------------------------------------------- LTG numbers

/** An LTG number in a comparable form (letters and digits only, upper case). */
export function normalizeNumber(n: string | null | undefined): string {
  return String(n ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Whether a dialled number reaches a node with this number. */
export function numberMatches(dialled: string | null | undefined, node: string | null | undefined): boolean {
  const a = normalizeNumber(dialled);
  return a.length > 0 && a === normalizeNumber(node);
}

/** Add numbers to a known list (unique, in their written form). */
export function learnNumbers(known: readonly string[], found: readonly string[]): string[] {
  const out = [...known];
  for (const f of found) {
    if (!normalizeNumber(f)) continue;
    if (!out.some((k) => numberMatches(k, f))) out.push(f.trim());
  }
  return out;
}

// ---------------------------------------------------------------- Signal range

/**
 * How far a signal of this rating reaches, in km. v0.79.0 (RULES.DOCS_V79.signalFlux, Rigger 2 flux range table):
 * past the end of RULES.SIGNAL.rangeKm, (2 × flux) + 10 km (perFlux and plusKm 0: the last entry, as before).
 */
export function signalRangeKm(rating: number): number {
  return fluxRangeKm(rating);
}

export interface SignalCheck { checked: boolean; inRange: boolean; far: boolean; rangeKm: number; km: number; modifiers: TargetNumberModifier[]; note: string }

/**
 * A wireless link of this signal rating over this distance: in range, near its edge (+TN), or out.
 * A distance of 0 or less is not checked (nothing entered, no tokens to measure).
 */
export function signalCheck(rating: number, km: number, kind: 'flux' | 'matrix' = 'flux'): SignalCheck {
  // v0.79.0: a decker's Matrix link keeps the old table (RULES.SIGNAL.matrixRangeKm); rigging uses the Rigger 2 flux table.
  const mt = RULES.SIGNAL.matrixRangeKm;
  const rangeKm = kind === 'matrix' ? Number(mt[Math.max(0, Math.min(mt.length - 1, Math.floor(rating)))] ?? 0) : signalRangeKm(rating);
  const d = Math.max(0, Number(km) || 0);
  if (!(d > 0)) return { checked: false, inRange: true, far: false, rangeKm, km: d, modifiers: [], note: '' };
  const s = RULES.SIGNAL;
  const inRange = d <= rangeKm;
  const far = inRange && rangeKm > 0 && d > rangeKm * s.farFraction;
  const fmt = (n: number) => (n < 1 ? `${Math.round(n * 1000)} m` : `${Math.round(n * 10) / 10} km`);
  const note = inRange ? (far ? tx('SR2E.Text.Netrig.ofSignalNearTheEdge', { distance: fmt(d), range: fmt(rangeKm), rating }) : tx('SR2E.Text.Netrig.ofSignal', { distance: fmt(d), range: fmt(rangeKm), rating })) : tx('SR2E.Text.Netrig.outOfRangeSignal', { distance: fmt(d), range: fmt(rangeKm), rating });
  return { checked: true, inRange, far, rangeKm, km: d, modifiers: far && s.farTn ? [{ id: 'weakSignal', label: tx('SR2E.Card.Mod.weakSignal'), value: s.farTn }] : [], note };
}

/** Whether a Matrix connection is a wireless one that range applies to. */
export function wirelessConnection(connection: string): boolean {
  return RULES.SIGNAL.wirelessConnections.includes(connection);
}

// ---------------------------------------------------------------- Programming and deck building

/** Writing a program: its size (book formula), the TN and the base time in days. */
export function programDesign(o: { kind: string; rating: number; damageLevel?: string }): { size: number; tn: number; baseDays: number } {
  const p = RULES.MATRIX.programming;
  const rating = Math.max(1, Math.floor(o.rating || 1));
  const size = utilitySize(o.kind, rating, o.damageLevel ?? 'M');
  return { size, tn: Math.max(RULES.MIN_TARGET_NUMBER, rating + p.tnMod), baseDays: Math.max(1, size) * p.daysPerMp };
}

/** Days a job of `baseDays` takes for these successes (null: no successes, no result). */
export function workDays(baseDays: number, successes: number): number | null {
  if (!(successes > 0)) return null;
  return Math.max(1, Math.ceil(Math.max(0, baseDays) / successes));
}

export type DeckPart = 'mpcp' | 'bod' | 'evasion' | 'masking' | 'sensors' | 'hardening' | 'responseIncrease' | 'activeMemory' | 'storageMemory' | 'ioSpeed';
export const DECK_PARTS: readonly DeckPart[] = ['mpcp', 'bod', 'evasion', 'masking', 'sensors', 'hardening', 'responseIncrease', 'activeMemory', 'storageMemory', 'ioSpeed'];

/**
 * Building a deck part at a rating (v0.49.0: by design size and materials): the TN, its design size
 * in Mp, base days (size × daysPerMp), materials cost (size × costPerMp; memory parts: Mp × costPerMp)
 * and any warnings. A memory part's rating is the Mp (or Mp per turn) it adds.
 */
export function deckPartPlan(part: string, rating: number, mpcp: number): { tn: number; baseDays: number; cost: number; size: number; label: string; memory: boolean; warnings: string[] } | null {
  const db = RULES.MATRIX.deckBuilding;
  const def = own(db.parts, part);
  if (!def) return null;
  const r = Math.max(1, Math.floor(rating || 1));
  const warnings: string[] = [];
  if (def.memory) {
    // `?? 100`: a guard for a row without mpPerSize (not a rules value).
    const size = Math.max(1, Math.ceil(r / Math.max(1, def.mpPerSize ?? 100)));
    return { tn: Math.max(RULES.MIN_TARGET_NUMBER, def.tn), baseDays: Math.max(1, Math.ceil(size * db.daysPerMp)), cost: Math.round(r * def.costPerMp), size, label: def.label, memory: true, warnings };
  }
  const mult = def.squared ? r * r : r;
  // v0.92.3: the book's design sizes and TNs (VR2 pp. 83–87; RULES.MATRIX_V923.deckBuilding).
  const book = deckPartBook(part, r, mpcp);
  const size = book ? book.size : Math.max(1, Math.ceil(def.size * mult));
  if (['bod', 'evasion', 'masking', 'sensors'].includes(part) && r > mpcp) warnings.push(tx('SR2E.Text.Netrig.isAboveTheDecksMpcp', { label: def.label, rating: r, mpcp }));
  if (part === 'responseIncrease' && r > RULES.MATRIX.maxResponseIncrease) warnings.push(tx('SR2E.Text.Netrig.responseIncreaseCountsOnly', { max: RULES.MATRIX.maxResponseIncrease }));
  return { tn: Math.max(RULES.MIN_TARGET_NUMBER, book ? book.tn : r + def.tn), baseDays: Math.max(1, Math.ceil(size * db.daysPerMp)), cost: Math.round(size * def.costPerMp), size, label: def.label, memory: false, warnings };
}

// ---------------------------------------------------------------- Tortoises, ICCM, otaku

/** A tortoise's Hacking Pool. */
export function tortoisePool(pool: number): number {
  return Math.max(0, Math.floor(Math.max(0, pool) * RULES.MATRIX.tortoise.hackingPool));
}

/** Extra resistance dice from an ICCM filter of this rating. */
export function iccmDice(rating: number): number {
  return Math.max(0, Math.floor(Math.max(0, rating || 0) * RULES.MATRIX.iccm.dicePerRating));
}

/** An otaku's living persona from their attribute totals (RULES.MATRIX.otaku). */
export function otakuPersona(attrs: Record<string, number>): { mpcp: number; bod: number; evasion: number; masking: number; sensors: number; hardening: number; responseIncrease: number; activeMemory: number } {
  const o = RULES.MATRIX.otaku;
  const sum = o.mpcp.reduce((s, k) => s + Math.max(0, attrs[k] ?? 0), 0);
  // v0.92.3: rounded up (VR2 p. 145; RULES.MATRIX_V923.otaku).
  const mpcp = Math.max(1, (RULES.MATRIX_V923.otaku !== 'v922' ? Math.ceil : Math.floor)(sum / Math.max(1, o.divisor)));
  const p = (k: string) => Math.min(mpcp, Math.max(0, attrs[o.persona[k] ?? 'intelligence'] ?? 0));
  return { mpcp, bod: p('bod'), evasion: p('evasion'), masking: p('masking'), sensors: p('sensors'), hardening: 0, responseIncrease: 0, activeMemory: mpcp * o.memoryPerMpcp };
}

// ---------------------------------------------------------------- Jamming and sensors

/** The TN to jam a remote link: its signal rating (+ the drone's ECCM). */
export function jamTarget(o: { signal: number; eccm?: number }): number {
  // v0.80.0 (RULES.URR_V80.dsCommsEccm, URR): comms gear has ECCM 1 unless set higher (book 0: its own ECCM).
  const eccm = RULES.RIGGING.jamming.eccmAddsTn ? dsDeviceEccm(o.eccm ?? 0) : 0;
  return Math.max(RULES.MIN_TARGET_NUMBER, Math.max(0, o.signal) + eccm);
}

/** Sensor test modifiers for the sensor mode, and whether ECD can notice the scan. */
export function sensorModeEffect(mode: string): { modifiers: TargetNumberModifier[]; noticeable: boolean } {
  const s = RULES.VEHICLES.sensorModes;
  if (mode !== 'passive') return { modifiers: [], noticeable: true };
  return { modifiers: s.passiveTn ? [{ id: 'passiveSensors', label: tx('SR2E.Card.Mod.passiveSensors'), value: s.passiveTn }] : [], noticeable: !s.passiveHidden };
}

// ---------------------------------------------------------------- Firing arcs

export type ArcSide = '' | 'front' | 'rear' | 'left' | 'right';
export const ARC_SIDES: readonly ArcSide[] = ['', 'front', 'rear', 'left', 'right'];
const ARC_CENTRE: Record<string, number> = { front: 0, right: 90, rear: 180, left: 270 };

/** Compass bearing (degrees clockwise from the top of the scene) from one point to another; canvas y grows downwards. */
export function bearingDeg(dx: number, dy: number): number {
  const a = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (a + 360) % 360;
}

/** Whether a bearing is inside a mount's arc, for a vehicle token turned `rotation` degrees. */
export function inArc(arc: string, rotation: number, bearing: number): { inside: boolean; offBy: number } {
  if (!arc || !Object.hasOwn(ARC_CENTRE, arc)) return { inside: true, offBy: 0 };
  const a = RULES.VEHICLES.arcs;
  const facing = ((Number(rotation) || 0) + a.facingOffset + ARC_CENTRE[arc]!) % 360;
  const diff = bearingDiff(bearing, facing);
  const half = a.degrees / 2;
  return { inside: diff <= half + 1e-9, offBy: Math.max(0, Math.round(diff - half)) };
}

// ---------------------------------------------------------------- Cargo

/**
 * A vehicle's load: what it carries (kg) against its Load, and (v0.49.0) its bulk (CF units, people
 * at RULES.VEHICLES.cargo.personCf each) against its Cargo Factor. Over either is overloaded.
 */
export function cargoLoad(o: { itemsKg: number; people: number; load: number; itemsCf?: number; cargoFactor?: number }): { kg: number; load: number; over: boolean; tracked: boolean; cf: number; cargoFactor: number; overCf: boolean; overKg: boolean } {
  const c = RULES.VEHICLES.cargo;
  const kg = Math.max(0, o.itemsKg) + Math.max(0, o.people) * c.personKg;
  const cf = Math.max(0, o.itemsCf ?? 0) + Math.max(0, o.people) * (c.personCf ?? 0);
  const cargoFactor = Math.max(0, o.cargoFactor ?? 0);
  const overKg = o.load > 0 && kg > o.load;
  const overCf = cargoFactor > 0 && cf > cargoFactor;
  return { kg: Math.round(kg * 10) / 10, load: o.load, over: overKg || overCf, tracked: o.load > 0 || cargoFactor > 0, cf: Math.round(cf * 10) / 10, cargoFactor, overCf, overKg };
}

// ---------------------------------------------------------------- Autosofts

/** An autosoft's dice for the vehicle's autopilot (capped at its Pilot/Autonav rating). */
export function autosoftDice(rating: number, autopilot: number): number {
  const r = Math.max(0, Math.floor(rating || 0));
  return RULES.VEHICLES.autosofts.capAtPilot ? Math.min(r, Math.max(0, autopilot)) : r;
}

// ---------------------------------------------------------------- Modifications

export type ModificationDef = (typeof RULES.VEHICLES.modifications)[number];

export function modificationDef(kind: string): ModificationDef | null {
  return RULES.VEHICLES.modifications.find((m) => m.id === kind) ?? null;
}

/** The stat a modification changes and by how much, and its cost, for a vehicle of this Body. */
export function modificationEffect(kind: string, rating: number, body: number): { stat: string; delta: number; cost: number; label: string } {
  const d = modificationDef(kind);
  const r = Math.max(0, Math.floor(rating || 0));
  if (!d) return { stat: '', delta: 0, cost: 0, label: kind };
  // v0.78.0 (RULES.BOOK_V78.adaptation 'text'): the rigger adaptation is a flat price on top of the remote adaptation.
  if (kind === 'adaptation' && RULES.BOOK_V78.adaptation === 'text') return { stat: d.stat, delta: 0, cost: RULES.BOOK_V78.riggerAdaptationCost * Math.max(1, r), label: d.label };
  return { stat: d.stat, delta: d.perRating * r, cost: d.cost * r * (d.perBody ? Math.max(1, body) : 1), label: d.label };
}

/** v0.78.0 (RULES.BOOK_V78.adaptation 'text'): what must be installed first (the remote adaptation before the rigger's), or null. */
export function modPrerequisite(kind: string, installedKinds: readonly string[]): string | null {
  if (kind !== 'adaptation' || RULES.BOOK_V78.adaptation !== 'text') return null;
  return (installedKinds ?? []).includes('remote') ? null : (modificationDef('remote')?.label ?? tx('SR2E.Text.Netrig.remoteAdaptation'));
}

/** A stat after a change, never below 0 (Handling at least 1). */
export function applyStatDelta(stat: string, value: number, delta: number): number {
  const v = Math.round((Number(value) || 0) + delta);
  return Math.max(stat === 'handling' ? 1 : 0, v);
}

// ---------------------------------------------------------------- Security: senses, tamper alarms, bypass time

/** How a concealment works against a device's sense: blind, a TN modifier, or nothing. */
export function concealmentEffect(sense: string, kind: string, rating: number): { blind: boolean; modifiers: TargetNumberModifier[] } {
  if (!sense || !kind) return { blind: false, modifiers: [] };
  const e = own(own(RULES.SECURITY.concealment, sense), kind);
  const labels: Record<string, string> = { invisibility: tx('SR2E.Card.Netrig.invisibility'), improvedInvisibility: tx('SR2E.Card.Netrig.improvedInvisibility'), chameleon: tx('SR2E.Card.Netrig.chameleonSuit'), thermal: tx('SR2E.Card.Netrig.thermalMasking'), silence: tx('SR2E.Card.Netrig.silence') };
  if (e === 'blind') return { blind: Math.max(0, rating) > 0, modifiers: [] };
  const v = Math.floor((Number(e) || 0) * Math.max(0, rating || 0));
  return { blind: false, modifiers: v ? [{ label: `${labels[kind] ?? kind} ${rating}`, value: v }] : [] };
}

/** Guess a concealment kind from a spell or gear name (Improved Invisibility, chameleon suit…). */
export function concealmentFromName(name: string): string {
  const n = String(name ?? '').toLowerCase();
  if (/improved\s*invis/.test(n)) return 'improvedInvisibility';
  if (/invisib/.test(n)) return 'invisibility';
  if (/chameleon|ruthenium/.test(n)) return 'chameleon';
  if (/thermal/.test(n)) return 'thermal';
  // v0.49.0: masking spells other than invisibility.
  if (/silence|stealth\b|hush/.test(n)) return 'silence';
  if (/physical\s*mask/.test(n)) return 'physicalMask';
  if (/\bmask\b/.test(n)) return 'mask';
  return '';
}

/** A tamper alarm's TN against this bypasser. */
export function tamperTn(skillRating: number): number {
  const t = RULES.SECURITY.tamper;
  return Math.max(RULES.MIN_TARGET_NUMBER, t.tnFrom === 'skill' ? Math.floor(skillRating || 0) : t.fixedTn);
}

/** Whether a tamper alarm trips: as many successes as the bypass, or more. */
export function tamperTrips(tamperSuccesses: number, bypassSuccesses: number): boolean {
  return tamperSuccesses > 0 && tamperSuccesses >= bypassSuccesses;
}

/** How long a bypass takes for its successes: Combat Turns and seconds (null: it did not open). */
export function bypassTime(kind: string, successes: number): { turns: number; seconds: number } | null {
  if (!(successes > 0)) return null;
  const b = RULES.SECURITY.bypassTime;
  // `?? 10`: a guard for an override without an 'other' row.
  const base = own(b.baseTurns, kind) ?? b.baseTurns['other'] ?? 10;
  const turns = Math.max(1, Math.ceil(base / successes));
  return { turns, seconds: turns * b.secondsPerTurn };
}

// ---------------------------------------------------------------- Chases on the canvas

/** Where to put the pursuer so it is `metres` behind the quarry on the line between them. */
export function chasePlacement(quarry: { x: number; y: number }, pursuer: { x: number; y: number }, metres: number, pxPerMetre: number): { x: number; y: number } {
  let dx = pursuer.x - quarry.x, dy = pursuer.y - quarry.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) { dx = 0; dy = 1; } else { dx /= len; dy /= len; }
  const d = Math.max(0, metres) * Math.max(0, pxPerMetre);
  return { x: Math.round(quarry.x + dx * d), y: Math.round(quarry.y + dy * d) };
}
