import { RULES } from './config.ts';
import type { TargetNumberModifier } from './dice.ts';
import { visibilityModifier, smokeModifier, type LightLevel, type Vision } from './weapons.ts';
import { socialDesiredRows, socialDesiredPick } from './docs79-social-core.ts';
import { own } from './util.ts';
import { t as tx } from '../helpers/i18n.ts';

/**
 * v0.50.0: target-number automation. Pure rules for the modifiers the system reads from the canvas,
 * the scene and the actors by itself (RULES.TN_AUTO).
 */

const A = () => RULES.TN_AUTO;

export const LIGHT_LABELS: Record<LightLevel, string> = { normal: 'Normal light', partial: 'Partial light', minimal: 'Minimal light', darkness: 'Total darkness' };
export const VISION_LABELS: Record<string, string> = { lowLight: 'low-light', thermographic: 'thermographic', ultrasound: 'ultrasound', normal: '' };

/** The light modifier for someone looking, labelled with the vision used. */
export function lightModifier(light: LightLevel | null | undefined, vision: Vision = {}): TargetNumberModifier | null {
  if (!light) return null;
  const v = visibilityModifier(light, vision);
  if (!v.value) return null;
  const using = VISION_LABELS[v.using] ?? '';
  return { label: `${LIGHT_LABELS[light]}${using ? ` (${using})` : ''}`, value: v.value };
}

/** The smoke modifier for someone looking, labelled. */
export function smokeLook(kind: 'none' | 'smoke' | 'thermal' | 'heavySmoke' | 'heavyThermal' | null | undefined, vision: Vision = {}, source = ''): TargetNumberModifier | null {
  if (!kind || kind === 'none') return null;
  const v = smokeModifier(kind, vision);
  if (!v.value) return null;
  const using = VISION_LABELS[v.using] ?? '';
  // v0.79.0: heavy smoke (RULES.DOCS_V79.visionSmokeRows).
  const name = kind === 'thermal' ? tx('SR2E.Card.Situation.thermalSmoke') : kind === 'heavySmoke' ? tx('SR2E.Card.Situation.heavySmoke') : kind === 'heavyThermal' ? tx('SR2E.Card.Situation.heavyThermalSmoke') : tx('SR2E.Card.Situation.smoke');
  return { label: `${name}${source ? ` (${source})` : ''}${using ? ` (${using})` : ''}`, value: v.value };
}

/** Perception at a distance (RULES.TN_AUTO.perception.range); null when unmeasured or +0. */
export function perceptionRangeModifier(metres: number | null | undefined): TargetNumberModifier | null {
  if (metres == null || !Number.isFinite(metres)) return null;
  const band = A().perception.range.find((b) => metres <= b.upTo + 1e-9);
  if (!band || !band.value) return null;
  return { label: band.label || tx('SR2E.Card.Mod.mAway', { metres: Math.round(metres) }), value: band.value };
}

/** The senses a living observer has, best first: visual always, then low-light and thermal by their vision. */
export function livingSenses(vision: Vision = {}): string[] {
  return ['visual', ...(vision.lowLight ? ['lowLight'] : []), ...(vision.thermographic ? ['thermal'] : [])];
}

/**
 * Concealment on the observed person against living eyes (RULES.TN_AUTO.perception.living): the
 * observer uses whichever sense it fools least. 'blind' only if every sense is fooled.
 */
export function livingConcealment(vision: Vision, list: ReadonlyArray<{ kind: string; rating: number; source?: string }>): { blind: boolean; modifier: TargetNumberModifier | null; label: string } {
  const table = A().perception.living;
  if (!list.length) return { blind: false, modifier: null, label: '' };
  let best: { blind: boolean; value: number; label: string } | null = null;
  for (const sense of livingSenses(vision)) {
    const row = table[sense] ?? {};
    // The worst concealment against this sense.
    let worst = { blind: false, value: 0, label: '' };
    for (const c of list) {
      const e = row[c.kind];
      const label = `${c.source ?? c.kind} ${c.rating}`;
      if (e === 'blind' && c.rating > 0) { worst = { blind: true, value: 0, label }; break; }
      const v = Math.floor((Number(e) || 0) * Math.max(0, c.rating || 0));
      if (v > worst.value) worst = { blind: false, value: v, label };
    }
    const better = !best || (best.blind && !worst.blind) || (best.blind === worst.blind && worst.value < best.value);
    if (better) best = worst;
  }
  if (!best) return { blind: false, modifier: null, label: '' };
  return { blind: best.blind, modifier: !best.blind && best.value ? { label: best.label, value: best.value } : null, label: best.label };
}

export interface SightInput {
  light?: LightLevel | null;
  vision?: Vision;
  /** Line of sight between the tokens: true, false (walls block it) or null (unknown). */
  los?: boolean | null;
  smoke?: { kind: 'none' | 'smoke' | 'thermal'; source?: string } | null;
  metres?: number | null;
  /** The observer is blinded. */
  blind?: boolean;
  /** Concealment worn or sustained on the observed person. */
  concealment?: ReadonlyArray<{ kind: string; rating: number; source?: string }>;
  weather?: TargetNumberModifier | null;
}

/**
 * Everything that makes someone harder to notice, for the observer's Perception test.
 * `unseen`: they can't be seen at all (walls, blinded, invisible): by RULES.TN_AUTO.perception.noSight
 * the observer then hears only (+ hearingTn, light, smoke and weather drop out), or can't notice them.
 */
export function perceptionSightModifiers(o: SightInput): { modifiers: TargetNumberModifier[]; unseen: boolean; blocked: boolean; why: string } {
  const p = A().perception;
  const vision = o.vision ?? {};
  const conceal = livingConcealment(vision, o.concealment ?? []);
  const why = o.blind ? tx('SR2E.Text.Situation.blinded') : o.los === false ? tx('SR2E.Text.Situation.wallsInTheWay') : conceal.blind ? conceal.label : '';
  const unseen = Boolean(why) && p.noSight !== 'ignore';
  const out: TargetNumberModifier[] = [];
  const range = perceptionRangeModifier(o.metres);
  if (unseen) {
    if (p.noSight === 'block') return { modifiers: [], unseen: true, blocked: true, why };
    out.push({ label: tx('SR2E.Card.Mod.canTSeeThemByEar', { why }), value: p.hearingTn });
    if (range) out.push(range);
    return { modifiers: out, unseen: true, blocked: false, why };
  }
  if (p.light) { const l = lightModifier(o.light, vision); if (l) out.push(l); }
  const s = smokeLook(o.smoke?.kind, vision, o.smoke?.source ?? '');
  if (s) out.push(s);
  if (o.weather) out.push(o.weather);
  if (range) out.push(range);
  if (conceal.modifier) out.push(conceal.modifier);
  return { modifiers: out, unseen: false, blocked: false, why: '' };
}

/** A sneaker's movement this Combat Turn on their Stealth test. */
export function stealthMovementModifier(state: 'none' | 'walking' | 'running' | null | undefined): TargetNumberModifier | null {
  const m = A().perception.sneakerMoving;
  const v = state === 'running' ? m.running : state === 'walking' ? m.walking : 0;
  return v ? { label: state === 'running' ? tx('SR2E.Card.Mod.sneakerRunning') : tx('SR2E.Card.Mod.sneakerWalking'), value: v } : null;
}

/**
 * Attack visibility without double counting (RULES.TN_AUTO.attack.blindNotStacked): blind fire
 * (walls, full cover, an unseen target) and a blinded attacker are one problem, so the worse counts,
 * and light, smoke and weather drop out once the attacker can't see at all.
 */
export function attackVisibility(o: {
  light?: TargetNumberModifier | null; smoke?: TargetNumberModifier | null; weather?: TargetNumberModifier | null;
  blindFire?: TargetNumberModifier | null; blinded?: TargetNumberModifier | null; concealment?: TargetNumberModifier | null;
}): TargetNumberModifier[] {
  const sightless = [o.blindFire, o.blinded].filter((m): m is TargetNumberModifier => Boolean(m && m.value));
  if (!A().attack.blindNotStacked) return [o.light, o.blindFire, o.blinded, o.smoke, o.weather, o.concealment].filter((m): m is TargetNumberModifier => Boolean(m && m.value));
  if (sightless.length) return [sightless.reduce((a, b) => (b.value > a.value ? b : a))];
  return [o.light, o.smoke, o.weather, o.concealment].filter((m): m is TargetNumberModifier => Boolean(m && m.value));
}

/** Metatype prejudice between a speaker and a listener (RULES.TN_AUTO.social.prejudice), either way round. */
export function metatypePrejudice(speaker: string | null | undefined, listener: string | null | undefined): TargetNumberModifier | null {
  const a = String(speaker ?? '').toLowerCase(), b = String(listener ?? '').toLowerCase();
  if (!a || !b || a === b) return null;
  const row = A().social.prejudice.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  if (!row || !row.value) return null;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return { id: 'prejudice', label: tx('SR2E.Card.Mod.prejudiceVs', { b: cap(b), a: cap(a) }), value: row.value };
}

/** The attitude to pre-pick: a stored attitude id, else from a token disposition (RULES.TN_AUTO.social.disposition). */
export function attitudeFor(stored: string | null | undefined, disposition: number | null | undefined): string {
  const ids = RULES.STREET.social.attitudes.map((x) => x.id);
  if (stored && ids.includes(stored)) return stored;
  if (!A().social.attitudeFromToken || disposition == null) return 'neutral';
  const id = own(A().social.disposition, String(disposition)) ?? 'neutral';
  return ids.includes(id) ? id : 'neutral';
}

/**
 * Poor visibility for a driver or a vehicle's sensors (RULES.TN_AUTO.rigging): from light at the
 * vehicle and smoke on it. The weather's own driving modifier replaces it (the worse counts, never both).
 */
export function drivingVisibility(o: { light?: LightLevel | null; vision?: Vision; smoke?: boolean; weather?: TargetNumberModifier | null; manual?: boolean }): TargetNumberModifier[] {
  const r = A().rigging;
  const poor = RULES.VEHICLES.drivingModifiers.find((m) => m.id === 'poorVisibility');
  const dark = o.light ? visibilityModifier(o.light, o.vision ?? {}).value >= r.poorVisibilityFrom : false;
  const smoky = Boolean(o.smoke) && r.smokeIsPoorVisibility;
  const why = dark ? LIGHT_LABELS[o.light!].toLowerCase() : smoky ? tx('SR2E.Card.Situation.smoke2') : '';
  const own: TargetNumberModifier | null = poor && (dark || smoky || o.manual) ? { label: why ? `${poor.label} (${why})` : poor.label, value: poor.value } : null;
  const w = o.weather && o.weather.value ? o.weather : null;
  if (own && w) return [own.value >= w.value ? own : w];
  return [own, w].filter((m): m is TargetNumberModifier => Boolean(m));
}

/** Sensor range band for a vehicle's Sensor rating: 0 = short; each band beyond adds RULES.TN_AUTO.rigging.sensorRange.tnPerBand. */
export function sensorRangeModifier(metres: number | null | undefined, sensorRating: number): TargetNumberModifier | null {
  if (metres == null || !Number.isFinite(metres)) return null;
  const s = A().rigging.sensorRange;
  const r = Math.max(1, Math.floor(sensorRating || 0));
  const limits = s.metresPerRating.map((m) => m * r);
  let band = limits.findIndex((l) => metres <= l);
  if (band < 0) band = limits.length;
  const v = band * s.tnPerBand;
  return v ? { label: tx('SR2E.Card.Mod.sensorRangeM', { metres: Math.round(metres) }), value: v } : null;
}

/** The vision a vehicle test uses: the vehicle's sensors when jumped in or on autopilot, else the driver's eyes. */
export function vehicleTestVision(o: { mode: string; jumped?: boolean; sensors?: Vision; driver?: Vision }): Vision {
  return o.jumped || o.mode === 'autopilot' || o.mode === 'jumped' ? { ...(o.sensors ?? {}) } : { ...(o.driver ?? {}) };
}

/**
 * v0.50.0: modifiers a test of this kind could take, for the GM's "Change target number" checklist
 * (grouped; the dialog leaves out any already applied). Taken from the system's own tables.
 */
export function tnCandidates(kind: string): Array<{ group: string; rows: TargetNumberModifier[]; id?: string }> {
  const groups: Array<{ group: string; rows: TargetNumberModifier[]; id?: string }> = [];
  // v0.89.4: rows keep their ids (modifierIs), and a group the code looks for has one (its name is translated)
  const add = (group: string, rows: ReadonlyArray<{ label: string; value: number; id?: string }>, id?: string) => {
    const r = rows.filter((m) => m && m.value).map((m) => ({ ...(m.id ? { id: m.id } : {}), label: m.label, value: m.value }));
    if (r.length) groups.push({ ...(id ? { id } : {}), group, rows: r });
  };
  const vis = RULES.VISIBILITY.filter((v) => v.value);
  const smoke = [{ id: 'smoke2', label: tx('SR2E.Card.Mod.smoke2'), value: RULES.COMBAT.smoke.smoke.normal }, { id: 'thermalSmoke', label: tx('SR2E.Card.Mod.thermalSmoke'), value: RULES.COMBAT.smoke.thermal.normal }];
  const weather = RULES.HEALTH.weather.filter((w) => w.id !== 'clear').map((w) => ({ label: w.label, value: w.normal }));
  const blinded = [{ id: 'blinded', label: tx('SR2E.Card.Mod.blinded'), value: Math.max(RULES.STATUSES.blind.attackTn, RULES.STATUSES.blind.otherTn) }];
  const sustain = [{ id: 'sustaining', label: tx('SR2E.Card.Mod.sustainingASpell'), value: RULES.MAGIC.sustainedTnMod }];
  const p = RULES.COMBAT.prone;
  if (kind === 'attack' || kind === 'defend') {
    add(tx('SR2E.Card.Situation.situation'), RULES.SITUATIONAL_MODIFIERS);
    add(tx('SR2E.Card.Situation.visibility'), [...vis, { id: 'blindFireNoLineOfSight', label: tx('SR2E.Card.Mod.blindFireNoLineOfSight'), value: RULES.COMBAT.cover.blindFireTn }]);
    add(tx('SR2E.Card.Situation.smoke'), smoke);
    add(tx('SR2E.Card.Situation.position'), [{ id: 'targetProneRanged', label: tx('SR2E.Card.Mod.targetProneRanged'), value: p.targetRanged }, { id: 'targetProneMelee', label: tx('SR2E.Card.Mod.targetProneMelee'), value: p.targetMelee },
      { id: 'attackerProneRanged', label: tx('SR2E.Card.Mod.attackerProneRanged'), value: p.attackerRanged }, { id: 'attackerProneMelee', label: tx('SR2E.Card.Mod.attackerProneMelee'), value: p.attackerMelee },
      { id: 'charging', label: tx('SR2E.Card.Mod.charging'), value: RULES.COMBAT.charging.tn }, { id: 'friendsInMelee1', label: tx('SR2E.Card.Mod.friendsInMelee1'), value: RULES.COMBAT.friendsInMelee.tnPerFriend }]);
    add(tx('SR2E.Card.Situation.weather'), weather);
    add(tx('SR2E.Card.Situation.theAttacker'), [...blinded, ...sustain]);
  } else if (['spell', 'conjure', 'banish', 'dispel', 'barrier', 'track', 'heal', 'enchant', 'quest', 'cleanse', 'divine', 'invoke', 'design', 'notice'].includes(kind)) {
    add(tx('SR2E.Card.Situation.magic'), [...sustain, { id: 'astralPerception', label: tx('SR2E.Card.Mod.astralPerception'), value: RULES.ASTRAL.perceivingTnMod }, ...blinded]);
    if (A().magic.environment !== 'off') { add(tx('SR2E.Card.Situation.visibility'), vis); add(tx('SR2E.Card.Situation.smoke'), smoke); add(tx('SR2E.Card.Situation.weather'), weather); }
  } else if (kind === 'drive' || kind === 'sensor' || kind === 'install') {
    add(tx('SR2E.Card.Situation.driving'), RULES.VEHICLES.drivingModifiers);
    add(tx('SR2E.Card.Situation.terrain'), RULES.VEHICLES.terrain);
    add(tx('SR2E.Card.Situation.weatherDriving'), RULES.HEALTH.weather.filter((w) => w.driving).map((w) => ({ label: tx('SR2E.Card.Mod.driving', { label: w.label }), value: w.driving })));
  } else if (kind === 'perceive' || kind === 'sneak') {
    add(tx('SR2E.Card.Situation.perception'), RULES.STREET.perception);
    add(tx('SR2E.Card.Situation.visibility'), vis);
    add(tx('SR2E.Card.Situation.smoke'), smoke);
    add(tx('SR2E.Card.Situation.weather'), weather);
    add(tx('SR2E.Card.Situation.distance'), A().perception.range.filter((b) => b.value && b.label));
    add(tx('SR2E.Card.Situation.sight'), [{ id: 'canTSeeThemByEar2', label: tx('SR2E.Card.Mod.canTSeeThemByEar2'), value: A().perception.hearingTn }, { id: 'sneakerRunning', label: tx('SR2E.Card.Mod.sneakerRunning'), value: A().perception.sneakerMoving.running }]);
  } else if (kind === 'social') {
    add(tx('SR2E.Card.Situation.attitude'), RULES.STREET.social.attitudes.map((a) => ({ id: `attitude:${a.id}`, label: tx('SR2E.Card.Mod.attitude', { label: a.label }), value: a.value })));
    // v0.79.0 (RULES.DOCS_V79.socialDesired): the Social Skill Table's desired-result scale, or the old house rows.
    if (socialDesiredPick()) add(tx('SR2E.Card.Situation.desiredResult'), socialDesiredRows().filter((r) => r.value).map((r) => ({ label: tx('SR2E.Card.Mod.desiredResult', { rowLabel: r.label }), value: r.value })));
    else add(tx('SR2E.Card.Situation.situation'), RULES.STREET.social.situations);
  } else {
    add(tx('SR2E.Card.Situation.visibility'), vis);
    add(tx('SR2E.Card.Situation.weather'), weather);
    add(tx('SR2E.Card.Situation.theRoller'), [...blinded, ...sustain]);
  }
  add(tx('SR2E.Card.Situation.skill'), [{ id: 'defaultingToAttribute', label: tx('SR2E.Card.Mod.defaultingToAttribute'), value: RULES.ATTRIBUTE_DEFAULT_TN_MOD }], 'skill');
  return groups;
}
