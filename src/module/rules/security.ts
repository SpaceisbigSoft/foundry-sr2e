import { RULES } from './config.ts';
import { own } from './util.ts';
import { veh923 } from './vehicles.ts';

/** Building security (v0.26.0). Pure rules, no Foundry dependency. Values in RULES.SECURITY. */

export type SiteAlert = 'none' | 'passive' | 'active' | 'lockdown';

export interface SiteStep {
  step: number;
  event: string;
  alert: SiteAlert | '';
}

function alertIndex(a: string | null | undefined): number {
  const i = RULES.SECURITY.alerts.indexOf((a ?? 'none') as SiteAlert);
  return i < 0 ? 0 : i;
}

/** The higher of two alert levels (alerts only rise). */
export function higherAlert(a: string | null | undefined, b: string | null | undefined): SiteAlert {
  return RULES.SECURITY.alerts[Math.max(alertIndex(a), alertIndex(b))] as SiteAlert;
}

/** Whether an alert level is at least another. */
export function alertAtLeast(a: string | null | undefined, min: string): boolean {
  return alertIndex(a) >= alertIndex(min);
}

/** Add points to the security tally: the new tally, the steps crossed, and the alert after them (and `minAlert`). */
export function siteTally(o: { tally: number; add: number; alert: string; steps: readonly SiteStep[]; minAlert?: string }): { tally: number; triggered: SiteStep[]; alert: SiteAlert } {
  const tally = Math.max(0, o.tally) + Math.max(0, o.add);
  const triggered = o.steps.filter((s) => s.step > o.tally && s.step <= tally).sort((a, b) => a.step - b.step);
  let alert = higherAlert(o.alert, o.minAlert ?? 'none');
  for (const s of triggered) if (s.alert) alert = higherAlert(alert, s.alert);
  return { tally, triggered, alert };
}

/** Detection TNs: the device rolls vs the intruder's Stealth; the intruder rolls vs the device rating. */
export function detectionTargets(o: { deviceRating: number; stealthRating: number }): { deviceTn: number; intruderTn: number } {
  const d = RULES.SECURITY.detection;
  return { deviceTn: Math.max(d.minTn, o.stealthRating), intruderTn: Math.max(RULES.MIN_TARGET_NUMBER, o.deviceRating) };
}

/** The outcome of an opposed detection test. */
export function detectionOutcome(deviceSuccesses: number, intruderSuccesses: number): { detected: boolean; net: number; tally: number; minAlert: string } {
  const d = RULES.SECURITY.detection;
  const net = deviceSuccesses - intruderSuccesses;
  const detected = net > 0;
  return { detected, net, tally: detected ? net * d.tallyPerNet : 0, minAlert: detected ? d.detectedAlert : '' };
}

/** The outcome of a lock bypass test. */
export function bypassOutcome(successes: number, disaster: boolean, step?: 'casing' | 'circuit' | 'voice', o: { passkey?: boolean } = {}): { opened: boolean; tally: number; minAlert: string } {
  const b = RULES.SECURITY.bypass;
  if (successes > 0) return { opened: true, tally: 0, minAlert: '' };
  // v0.92.3 (RULES.VEHICLES_V923.circuitFail 'passive', CSH p. 100): no successes on the circuit trips a passive alert.
  // v0.92.3 review fix (RULES.VEHICLES_V923.passkey 'book', CSH p. 100): a passkey with no successes trips the alarm too.
  const passive = step === 'circuit' && (veh923('circuitFail') === 'passive' || (Boolean(o.passkey) && veh923('passkey') === 'book'));
  const minAlert = disaster ? b.disasterAlert : '';
  return { opened: false, tally: b.failTally, minAlert: passive && (!minAlert || minAlert === 'passive') ? 'passive' : minAlert };
}

/**
 * When the response arrives, once the alert reaches active: a Combat Turn in combat, else a world time.
 * v0.71.0 (R6): a site's own response time (`own`, 0 or missing = the world's RULES.SECURITY.response).
 */
export function responseDue(o: { round: number | null; worldTime: number; own?: { turns?: number; minutes?: number } }): { round: number | null; worldTime: number; turns: number; minutes: number } {
  const r = responseTimes(o.own);
  return { round: o.round != null ? o.round + r.turns : null, worldTime: o.worldTime + r.minutes * 60, ...r };
}

/** v0.71.0 (R6): a site's response time: its own where set (above 0), else the world's. */
export function responseTimes(own?: { turns?: number; minutes?: number }): { turns: number; minutes: number } {
  const r = RULES.SECURITY.response;
  const t = Math.floor(Number(own?.turns ?? 0));
  const m = Number(own?.minutes ?? 0);
  return { turns: t > 0 ? t : r.turns, minutes: m > 0 ? m : r.minutes };
}

/** The Matrix host alert a site alert maps to, and back. */
export function hostAlertFor(site: string): string {
  return own(RULES.SECURITY.hostAlert, site) ?? 'none';
}
export function siteAlertForHost(host: string): SiteAlert {
  const entry = Object.entries(RULES.SECURITY.hostAlert).find(([, h]) => h === host);
  return (entry?.[0] ?? 'none') as SiteAlert;
}
