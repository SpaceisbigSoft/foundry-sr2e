import { RULES, type DamageLevel } from './config.ts';
import { DAMAGE_LEVELS as LEVELS, num } from './util.ts';
import { IC_BEHAVIORS, behaviorFromName, type IcBehavior, type SheafStep } from './matrix.ts';

/**
 * Lockdown (v0.61.0): security sheaf steps that launch their IC, and security devices that gas a
 * room when the site goes into lockdown. Values in RULES.SECURITY_V61 (VERIFY). Pure rules; no
 * Foundry: the glue creates the IC actors and exposes tokens to the toxin.
 */

const C = () => RULES.SECURITY_V61;

/** A plain object or null. */
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
type Level = DamageLevel;

// ---------------------------------------------------------------- Sheaf steps launch IC

/** v0.61.0: the IC a sheaf step launches, shaped for SR2Actor.launchIc (plus how many copies). */
export interface SheafIcLaunch {
  name: string;
  icType: string;
  category: 'white' | 'gray' | 'black';
  rating: number;
  behavior: IcBehavior;
  damageLevel: Level;
  damageType: 'physical' | 'stun';
  copies: number;
  /** Trace IC: what happens when the trace completes ('' = the IC's default). */
  traceMode: '' | 'dump' | 'report' | 'burn';
}

/** v0.61.0: most copies one step launches (sheafIc.maxCopies, at least 1). */
const maxCopies = (): number => Math.max(1, Math.floor(num(C().sheafIc.maxCopies)) || 1);

/** v0.61.0: an IC behavior's category from sheafIc.categories (black, gray, else white). */
export function icCategoryOf(behavior: string): 'white' | 'gray' | 'black' {
  const c = C().sheafIc.categories;
  if ((c?.black ?? []).includes(behavior)) return 'black';
  if ((c?.gray ?? []).includes(behavior)) return 'gray';
  return 'white';
}

const isBehavior = (b: string): b is IcBehavior => (IC_BEHAVIORS as readonly string[]).includes(b);
const traceModeOf = (text: string): SheafIcLaunch['traceMode'] => {
  const t = text.toLowerCase();
  if (/\bdump\b/.test(t)) return 'dump';
  if (/\breport\b/.test(t)) return 'report';
  if (/\b(burn|fry)\b/.test(t)) return 'burn';
  return '';
};

/** Words that continue an IC's name ("Tar Baby", "Trace and Dump", "Positive Conditioning"). */
const CONTINUE = new Set(['baby', 'pit', 'dump', 'report', 'burn', 'fry', 'conditioning']);

/** Read an IC out of a step's event text, or null when it names none. */
function parseIcText(text: string): { icType: string; behavior: IcBehavior; black: boolean; rating: number; copies: number; stun: boolean } | null {
  const tokens = text.match(/[A-Za-z]+|\d+|[^\sA-Za-z\d]/g) ?? [];
  const low = tokens.map((t) => t.toLowerCase());
  const hasIc = low.includes('ic');
  const blackAt = low.indexOf('black');
  const black = blackAt >= 0;
  let icType = '';
  let behavior: IcBehavior | null = null;
  let after = -1;
  for (let i = 0; i < tokens.length && !behavior; i++) {
    if (!/^[a-z]+$/.test(low[i]!) || low[i] === 'black' || low[i] === 'ic') continue;
    const words = [tokens[i]!];
    let j = i + 1;
    for (; j < tokens.length; j++) {
      const w = low[j]!;
      if (CONTINUE.has(w)) { words.push(tokens[j]!); continue; }
      if (w === 'and' && CONTINUE.has(low[j + 1] ?? '')) { words.push(tokens[j]!); continue; }
      break;
    }
    const b = behaviorFromName(words.join(' '));
    if (!b || b === 'other') continue;
    // "Access" alone is too common a word: only an Access IC counts.
    if (low[i]!.startsWith('access') && !hasIc) continue;
    behavior = b; icType = words.join(' '); after = j;
  }
  if (!behavior) {
    if (!black) return null;
    behavior = 'killer'; icType = 'Black IC'; after = blackAt + 1;
  }
  // The rating follows the name: "Killer-6 IC", "Killer 6", "Black IC 8", "Probe IC-4".
  let rating = 0;
  for (let k = after, skipped = 0; k < tokens.length && skipped < 4; k++, skipped++) {
    const w = low[k]!;
    if (/^\d+$/.test(w)) { rating = Number(w); break; }
    if (!['-', '–', '—', ':', 'ic', 'rating', 'black'].includes(w)) break;
  }
  const copyM = /\b(\d+)\s*[x×](?=\s|$)/i.exec(text) ?? /(?:^|\s)[x×]\s*(\d+)\b/i.exec(text);
  const copies = copyM ? Number(copyM[1]) : 1;
  return { icType, behavior, black, rating, copies, stun: /\b(non-?lethal|stun)\b/i.test(text) };
}

/**
 * v0.61.0: the IC a security sheaf step launches, or null. A structured `step.ic` with an icType
 * wins (rating 0 = the host's Security Value; category '' = from the behavior); otherwise, when
 * sheafIc.parseEventText, the event text is read ("Killer-6 IC", "Tar Baby", "Black IC 8",
 * "Trace and Dump-5"; no rating = the Security Value). Events naming no IC ("Passive alert",
 * "Shutdown") give null. Copies are clamped to 1..sheafIc.maxCopies. Never throws.
 */
export function icFromStep(step: { event?: string; ic?: unknown }, host: { securityValue: number; name: string }): SheafIcLaunch | null {
  const s = obj(step) ?? {};
  const h = obj(host) ?? {};
  const sv = Math.max(0, Math.floor(num(h['securityValue'])));
  const hostName = str(h['name']).trim();
  const cfg = C().sheafIc;
  const defLevel: Level = (LEVELS as readonly string[]).includes(cfg.defaultDamageLevel) ? cfg.defaultDamageLevel : 'M';
  const blackType: 'physical' | 'stun' = cfg.blackDamageType === 'stun' ? 'stun' : 'physical';
  const rate = (r: number) => (r > 0 ? r : sv > 0 ? sv : 1);
  const copiesOf = (n: number) => Math.min(maxCopies(), Math.max(1, Math.floor(num(n)) || 1));
  const finish = (o: Omit<SheafIcLaunch, 'name'>): SheafIcLaunch => ({ ...o, name: `${o.icType}-${o.rating}${hostName ? ` (${hostName})` : ''}` });

  const ic = obj(s['ic']);
  const icType = str(ic?.['icType']).trim();
  if (ic && icType) {
    const rawB = str(ic['behavior']).trim();
    const behavior: IcBehavior = isBehavior(rawB) ? rawB : behaviorFromName(icType) ?? 'killer';
    const rawC = str(ic['category']).trim();
    const category = rawC === 'white' || rawC === 'gray' || rawC === 'black' ? rawC : /\bblack\b/i.test(icType) ? 'black' : icCategoryOf(behavior);
    const rawL = str(ic['damageLevel']).trim().toUpperCase();
    return finish({
      icType, category, behavior,
      rating: rate(Math.floor(num(ic['rating']))),
      damageLevel: (LEVELS as readonly string[]).includes(rawL) ? (rawL as Level) : defLevel,
      damageType: category === 'black' ? blackType : 'physical',
      copies: copiesOf(num(ic['copies']) || 1),
      traceMode: behavior === 'trace' ? traceModeOf(icType) : '',
    });
  }
  if (!cfg.parseEventText) return null;
  const parsed = parseIcText(str(s['event']));
  if (!parsed) return null;
  const category = parsed.black ? 'black' : icCategoryOf(parsed.behavior);
  return finish({
    icType: parsed.icType, category, behavior: parsed.behavior, rating: rate(parsed.rating), damageLevel: defLevel,
    damageType: category === 'black' ? (parsed.stun ? 'stun' : blackType) : 'physical',
    copies: copiesOf(parsed.copies),
    traceMode: parsed.behavior === 'trace' ? traceModeOf(parsed.icType) : '',
  });
}

/**
 * v0.61.0: the step numbers among `triggered` whose IC has not been launched yet (each step once
 * until the tally is reset), in tally order without repeats. Empty when sheafIc.autoLaunch is off
 * (the GM launches by hand). Whether a step names any IC is icFromStep's job.
 */
export function stepsToLaunch(triggered: SheafStep[], launched: number[]): number[] {
  if (!C().sheafIc.autoLaunch) return [];
  const done = new Set((Array.isArray(launched) ? launched : []).map((n) => num(n)));
  const out: number[] = [];
  const list = (Array.isArray(triggered) ? triggered : []).filter((s) => obj(s) && Number.isFinite(Number(s.step)));
  for (const s of [...list].sort((a, b) => num(a.step) - num(b.step))) {
    const n = num(s.step);
    if (!done.has(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

// ---------------------------------------------------------------- Gas devices

/** v0.61.0: a gas device's toxin, in the shape of a toxin hit (without who it is from). */
export interface GasToxin { name: string; power: number; level: Level; damageType: 'physical' | 'stun'; vector: string; speed: string }

/**
 * v0.61.0: a gas device's toxin, sanitised: each bad or missing field falls back to
 * gas.defaultToxin; the Power falls back to the device's rating when that is set. The vector and
 * speed must be ids in RULES.TOXINS. Never throws.
 */
export function gasDeviceToxin(device: { name?: string; toxin?: unknown; rating?: number }): GasToxin {
  const d = obj(device) ?? {};
  const t = obj(d['toxin']) ?? {};
  const def = C().gas.defaultToxin;
  const vectors = (RULES.TOXINS.vectors ?? []).filter(Boolean);
  const speeds = (RULES.TOXINS.speeds ?? []).map((s) => s.id);
  const level = str(t['level']).trim().toUpperCase();
  const defLevel: Level = (LEVELS as readonly string[]).includes(def.level) ? def.level : 'S';
  const power = Math.floor(num(t['power']));
  const rating = Math.floor(num(d['rating']));
  const vector = str(t['vector']).trim();
  const speed = str(t['speed']).trim();
  const type = str(t['damageType']).trim();
  return {
    name: str(t['name']).trim() || str(def.name) || 'Gas',
    power: power > 0 ? power : rating > 0 ? rating : Math.max(1, Math.floor(num(def.power)) || 1),
    level: (LEVELS as readonly string[]).includes(level) ? (level as Level) : defLevel,
    damageType: type === 'physical' || type === 'stun' ? type : def.damageType === 'physical' ? 'physical' : 'stun',
    vector: vectors.includes(vector) ? vector : vectors.includes(def.vector) ? def.vector : (RULES.TOXINS.inhalantVector ?? 'inhalation'),
    speed: speeds.includes(speed) ? speed : speeds.includes(def.speed) ? def.speed : (speeds[0] ?? 'immediate'),
  };
}

/** v0.61.0: a gas device's cloud radius in metres (0 = its linked regions only); missing = gas.radiusMetres. */
export function gasDeviceRadius(device: { radius?: unknown }): number {
  const d = obj(device) ?? {};
  if (d['radius'] === undefined || d['radius'] === null || d['radius'] === '') return Math.max(0, num(C().gas.radiusMetres));
  return Math.max(0, num(d['radius']));
}

/**
 * v0.61.0: ids of the gas devices that go off on lockdown: kind 'gas', active and not bypassed.
 * Empty when gas.onLockdown is off. Never throws.
 */
export function gasDevicesToRelease(devices: Array<{ id: string; kind: string; active: boolean; bypassed: boolean }>): string[] {
  if (!C().gas.onLockdown) return [];
  const out: string[] = [];
  for (const d of Array.isArray(devices) ? devices : []) {
    if (!obj(d) || d.kind !== 'gas' || d.active !== true || d.bypassed === true) continue;
    const id = str(d.id);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
