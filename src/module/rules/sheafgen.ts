/**
 * v0.71.0 (R9): a Virtual Realities 2.0-style security sheaf generator. Pure: no Foundry.
 *
 * A host's sheaf is a list of trigger steps on the security tally. From memory of VR2 (VERIFY all
 * of it; no rulebook text here):
 * - Trigger steps come every 1d3 + N tally points, N smaller for higher security codes, so a Red
 *   host's sheaf is denser than a Blue one's.
 * - At each trigger step roll 1d6 + a code modifier on the event table for the host's alert state
 *   (no alert, passive alert, active alert): white IC, gray IC, black IC, or the next alert.
 * - The passive alert comes by the `passiveBy`-th trigger step at the latest, the active alert
 *   `activeAfter` steps after it at the latest.
 * - The IC category a code allows is capped (Blue: white only; Green: up to gray; Orange and
 *   above: black too), and black IC turns up only once an alert is on.
 * - Codes with `shutdown` end with a Shutdown step `afterActive` trigger steps after the active
 *   alert; others end after `maxTriggers` trigger steps.
 * IC rating 0 means "the host's Security Value" (as rules/lockdown.ts icFromStep reads it). The
 * IC's category is the one in `SHEAF_GEN.ic` (the review's VR2 reading: Killer, Crippler, Probe and
 * Scout white; Blaster, Ripper, Sparky, Tar Baby, Tar Pit and Trace gray). VERIFY.
 */
import { makeRng, type Rng } from './npcgen.ts';
import type { AlertLevel } from './matrix.ts';
import { t as tx } from '../helpers/i18n.ts';

/** One generated sheaf step, in the HostDataModel `sheaf` shape. */
export interface GeneratedSheafStep {
  step: number;
  event: string;
  alert: AlertLevel | '';
  ic: { icType: string; category: '' | 'white' | 'gray' | 'black'; rating: number; behavior: string; damageLevel: 'L' | 'M' | 'S' | 'D'; copies: number };
}

type Code = 'blue' | 'green' | 'orange' | 'red' | 'black';
type EventKind = 'white' | 'gray' | 'black' | 'alert';
type IcEntry = { icType: string; behavior: string };

/**
 * The generator's tables (VERIFY: VR2 from memory). v0.81.0: a module constant, not part of RULES, so
 * house rules and the advanced overrides can't reach it yet (moving it to RULES.MATRIX needs config.ts).
 */
export const SHEAF_GEN = {
  /** Trigger step interval: 1d3 + this, by security code. */
  interval: { blue: 4, green: 3, orange: 2, red: 1, black: 1 } as Record<Code, number>,
  /** Added to the 1d6 event roll, by security code. */
  eventMod: { blue: -1, green: 0, orange: 1, red: 2, black: 3 } as Record<Code, number>,
  /** Event tables by alert state: the first row whose `upTo` is ≥ the roll. */
  events: {
    none: [{ upTo: 3, kind: 'white' }, { upTo: 5, kind: 'gray' }, { upTo: 99, kind: 'alert' }],
    passive: [{ upTo: 2, kind: 'white' }, { upTo: 4, kind: 'gray' }, { upTo: 6, kind: 'black' }, { upTo: 99, kind: 'alert' }],
    active: [{ upTo: 2, kind: 'white' }, { upTo: 5, kind: 'gray' }, { upTo: 99, kind: 'black' }],
  } as Record<'none' | 'passive' | 'active', ReadonlyArray<{ upTo: number; kind: EventKind }>>,
  /** The highest IC category each code fields (a roll above it gives this category instead). */
  maxCategory: { blue: 'white', green: 'gray', orange: 'black', red: 'black', black: 'black' } as Record<Code, 'white' | 'gray' | 'black'>,
  /** The passive alert comes by this trigger step at the latest; the active alert this many steps after it. */
  passiveBy: 4,
  activeAfter: 3,
  /** Codes whose sheaf ends in a shutdown, this many trigger steps after the active alert. */
  shutdown: { blue: false, green: false, orange: true, red: true, black: true } as Record<Code, boolean>,
  afterActive: { blue: 4, green: 3, orange: 3, red: 2, black: 2 } as Record<Code, number>,
  /** Trigger steps at most (a shutdown code puts its shutdown here if it hasn't come yet). */
  maxTriggers: 12,
  /** Attack IC damage level by code. */
  damageLevel: { blue: 'M', green: 'M', orange: 'S', red: 'S', black: 'D' } as Record<Code, 'L' | 'M' | 'S' | 'D'>,
  /** IC lists by category (behavior ids from RULES.MATRIX / IC_BEHAVIORS). Guards (barrier, scramble) are not launched. */
  ic: {
    white: [
      { icType: 'Probe', behavior: 'probe' }, { icType: 'Killer', behavior: 'killer' },
      { icType: 'Crippler', behavior: 'crippler' }, { icType: 'Scout', behavior: 'scout' },
    ],
    gray: [
      { icType: 'Blaster', behavior: 'blaster' }, { icType: 'Ripper', behavior: 'ripper' }, { icType: 'Sparky', behavior: 'sparky' },
      { icType: 'Tar Baby', behavior: 'tarBaby' }, { icType: 'Tar Pit', behavior: 'tarPit' },
      { icType: 'Trace and Dump', behavior: 'trace' }, { icType: 'Trace and Report', behavior: 'trace' }, { icType: 'Trace and Burn', behavior: 'trace' },
    ],
    black: [
      { icType: 'Black IC', behavior: 'killer' }, { icType: 'Black IC', behavior: 'killer' },
      { icType: 'Psychotropic Black IC', behavior: 'psychotropic' },
    ],
  } as Record<'white' | 'gray' | 'black', ReadonlyArray<IcEntry>>,
};

const CODES: readonly Code[] = ['blue', 'green', 'orange', 'red', 'black'];
const CAT_ORDER = ['white', 'gray', 'black'] as const;
const NO_IC: GeneratedSheafStep['ic'] = { icType: '', category: '', rating: 0, behavior: '', damageLevel: 'M', copies: 1 };

/** A 32-bit FNV-1a hash of a string, for string seeds. */
export function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

const d = (r: Rng, sides: number) => 1 + Math.floor(r() * sides);

/**
 * v0.71.0 (R9): generate a host's security sheaf from its code and Security Value. Deterministic for
 * a given seed (a number or a string; `rng` wins over `seed`; with neither the seed is
 * "code-value"). Steps come in tally order; IC steps have a structured `ic` (rating 0 = the Security
 * Value) that rules/lockdown.ts icFromStep launches. Unknown codes count as orange.
 */
export function generateSheaf(o: { securityCode: string; securityValue: number; seed?: number | string; rng?: () => number }): GeneratedSheafStep[] {
  const code: Code = (CODES as readonly string[]).includes(o.securityCode) ? (o.securityCode as Code) : 'orange';
  const sv = Math.max(0, Math.floor(Number(o.securityValue) || 0));
  const seed = o.seed ?? `${code}-${sv}`;
  const r: Rng = o.rng ?? makeRng(typeof seed === 'number' ? seed : seedFromString(String(seed)));
  const G = SHEAF_GEN;
  const maxCat = CAT_ORDER.indexOf(G.maxCategory[code] ?? 'black');
  const out: GeneratedSheafStep[] = [];
  let tally = 0;
  let alert: 'none' | 'passive' | 'active' = 'none';
  let passiveAt = -1; // trigger index of the passive alert
  let activeAt = -1;
  const maxTriggers = Math.max(1, Math.floor(G.maxTriggers));
  for (let n = 1; n <= maxTriggers; n++) {
    tally += d(r, 3) + Math.max(0, Math.floor(G.interval[code] ?? 2));
    const roll = d(r, 6) + (G.eventMod[code] ?? 0);
    // The shutdown, when this code has one and its time has come (or the sheaf is about to end).
    const shutdownDue = G.shutdown[code] && alert === 'active' && (n - activeAt >= Math.max(1, G.afterActive[code] ?? 2) || n === maxTriggers);
    // v0.81.0: `>=` (as forceActive), so the shutdown is exactly `afterActive` trigger steps after the active alert (it was one later).
    if (shutdownDue) {
      out.push({ step: tally, event: tx('SR2E.Text.Sheafgen.shutdown'), alert: 'shutdown', ic: { ...NO_IC } });
      break;
    }
    const forcePassive = alert === 'none' && n >= Math.max(1, G.passiveBy);
    const forceActive = alert === 'passive' && n - passiveAt >= Math.max(1, G.activeAfter);
    // The end of a shutdown code's sheaf with no active alert yet: raise alerts in turn.
    const late = G.shutdown[code] && n >= maxTriggers - (alert === 'none' ? 2 : 1);
    let kind: EventKind = forcePassive || forceActive || (late && alert !== 'active')
      ? 'alert'
      : (G.events[alert].find((row) => roll <= row.upTo)?.kind ?? 'alert');
    if (kind === 'alert' && alert === 'active') kind = 'black';
    if (kind === 'alert') {
      alert = alert === 'none' ? 'passive' : 'active';
      if (alert === 'passive') passiveAt = n; else activeAt = n;
      out.push({ step: tally, event: alert === 'passive' ? tx('SR2E.Text.Sheafgen.passiveAlert') : tx('SR2E.Text.Sheafgen.activeAlert'), alert, ic: { ...NO_IC } });
      continue;
    }
    // Black IC only once an alert is on; and no higher than the code allows.
    let cat = CAT_ORDER.indexOf(kind);
    if (cat === 2 && alert === 'none') cat = 1;
    cat = Math.min(cat, maxCat);
    const category = CAT_ORDER[cat]!;
    const list = G.ic[category];
    const ic = list[Math.floor(r() * list.length)] ?? { icType: 'Killer', behavior: 'killer' };
    const icText = `${ic.icType}${sv ? `-${sv}` : ''}`;
    out.push({
      step: tally,
      event: category === 'white' ? tx('SR2E.Text.Sheafgen.whiteIc', { ic: icText }) : category === 'gray' ? tx('SR2E.Text.Sheafgen.grayIc', { ic: icText }) : icText,

      alert: '',
      ic: { icType: ic.icType, category, rating: 0, behavior: ic.behavior, damageLevel: G.damageLevel[code] ?? 'M', copies: 1 },
    });
  }
  return out;
}

/**
 * v0.71.0 (R9): a sheaf for a host actor's system data (the host sheet's "Generate sheaf" button):
 * `generateSheaf` with the host's code and Security Value and this seed.
 */
export function sheafFor(host: { securityCode?: string; securityValue?: number } | null | undefined, seed?: number | string): GeneratedSheafStep[] {
  return generateSheaf({ securityCode: String(host?.securityCode ?? 'orange'), securityValue: Number(host?.securityValue ?? 0), ...(seed !== undefined ? { seed } : {}) });
}
