/**
 * v0.92.1: weapon accessories read from the description (the owner, 2 Nov 2026: "read automatically" when a weapon arrives
 * and when its description is edited; RULES.SHEET_V921.accessories). A recognised accessory fills its field only while
 * that field is still at its default, so a value set by hand is never overwritten; negations ("no silencer", "sold
 * separately", "can mount a scope") are skipped; an accessory with no field of its own becomes a note tweak.
 *
 * Pure: the reading (`readAccessories`) and the plan against a weapon's current values (`accessoryPlan`). The glue is in
 * documents/index.ts (SR2Item._preCreate/_preUpdate) and applications/sheets.ts (the "From the description" line and Undo).
 * English words only: the descriptions people paste from their books are English (other languages just find nothing).
 */

/** The weapon fields an accessory can fill, with their defaults (models/index.ts WeaponDataModel). */
export const ACCESSORY_DEFAULTS: Readonly<Record<string, unknown>> = {
  recoilComp: 0, muzzle: '', laserSight: false, scope: 0, scopeVision: '', shockPad: false, support: 'none', gyro: 0, smartgun: false, quickDraw: false,
};

/** The language keys of each accessory's name and each field's label (literal, so the translation checks see them). */
export const ACCESSORY_NAME_KEYS: Readonly<Record<string, string>> = {
  gasVent: 'SR2E.Text.Accessories.names.gasVent', recoilComp: 'SR2E.Text.Accessories.names.recoilComp', suppressor: 'SR2E.Text.Accessories.names.suppressor',
  silencer: 'SR2E.Text.Accessories.names.silencer', smartgun: 'SR2E.Text.Accessories.names.smartgun', laserSight: 'SR2E.Text.Accessories.names.laserSight',
  scopeVision: 'SR2E.Text.Accessories.names.scopeVision', scope: 'SR2E.Text.Accessories.names.scope', shockPad: 'SR2E.Text.Accessories.names.shockPad',
  tripod: 'SR2E.Text.Accessories.names.tripod', bipod: 'SR2E.Text.Accessories.names.bipod', gyro: 'SR2E.Text.Accessories.names.gyro',
  quickDraw: 'SR2E.Text.Accessories.names.quickDraw', foldingStock: 'SR2E.Text.Accessories.names.foldingStock', flashSuppressor: 'SR2E.Text.Accessories.names.flashSuppressor',
  bayonet: 'SR2E.Text.Accessories.names.bayonet', sling: 'SR2E.Text.Accessories.names.sling', hipPad: 'SR2E.Text.Accessories.names.hipPad',
  extendedClip: 'SR2E.Text.Accessories.names.extendedClip', underBarrel: 'SR2E.Text.Accessories.names.underBarrel',
};
export const ACCESSORY_FIELD_KEYS: Readonly<Record<string, string>> = {
  recoilComp: 'SR2E.Text.Accessories.fields.recoilComp', muzzle: 'SR2E.Text.Accessories.fields.muzzle', laserSight: 'SR2E.Text.Accessories.fields.laserSight',
  scope: 'SR2E.Text.Accessories.fields.scope', scopeVision: 'SR2E.Text.Accessories.fields.scopeVision', shockPad: 'SR2E.Text.Accessories.fields.shockPad',
  support: 'SR2E.Text.Accessories.fields.support', gyro: 'SR2E.Text.Accessories.fields.gyro', smartgun: 'SR2E.Text.Accessories.fields.smartgun',
  quickDraw: 'SR2E.Text.Accessories.fields.quickDraw',
};

export interface AccessoryHit {
  /** A stable id (the accessory), for the sheet's line and an undo. */
  id: string;
  /** The weapon field it fills and the value; absent for an accessory with no field (a note). */
  field?: string;
  value?: unknown;
  /** Words from the description, for the sheet's line (short). */
  text: string;
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
const numberOf = (s: string | undefined): number | null => {
  if (!s) return null;
  const k = s.toLowerCase();
  if (ROMAN[k] !== undefined) return ROMAN[k]!;
  const n = Number(k);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

/** The description as plain text (tags out, entities and spaces tidied). */
export function plainText(html: unknown): string {
  return String(html ?? '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|div|h\d|tr)>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Words just before a mention that say the weapon doesn't have it, or only could. The window stops at punctuation and
 * at "and", "with", "has" and "but" (review: "a no-frills pistol with a laser sight" has one).
 */
const NEG_BEFORE = /\b(no|not|without|lacks?|cannot|can't|accepts?|optional(ly)?|possible|room for|mounts? for|threaded for|compatible with|instead of|except|can (mount|take|accept|fit|be fitted with)|could (mount|take|have)|may (mount|take|have))\b(?:(?!\b(and|with|has|have|but|plus)\b)[^.;,]){0,24}$/i;
/** Words after a mention that say the same ("sold separately", "version available", "-ready", "compatible"). */
const NEG_AFTER = /^[^.;]{0,60}?\b(sold separately|not included|optional|extra cost|at extra|available separately|can be (added|fitted|mounted)|may be (added|fitted|mounted)|is available|available|compatible)\b|^\s*(versions?|variants?|models?|ready|compatible|adapters?)\b|^[- ]?(ready|compatible)\b/i;

interface Rule { id: string; re: RegExp; hit: (m: RegExpExecArray) => Omit<AccessoryHit, 'id' | 'text'> | null }

/** Each accessory, most specific first (a suppressor before a silencer; a smartgun before a scope's "smart"). */
const RULES_LIST: Rule[] = [
  // v0.92.2: also plural ("gas vents 3"), a bracketed rating ("gas vent (2)", "(rating 3)") and ", rating 2" (digits only
  // after a comma, so "gas vent, i.e." reads no rating).
  { id: 'gasVent', re: /\bgas[- ]?vents?(?:\s*(?:system|compensator)s?)?(?:\s*,\s*rating\s*(\d)\b|\s*\(\s*(?:rating\s*)?(\d|iii|ii|iv|vi|v|i)\s*\)|\s*(?:rating\s*)?(\d|iii|ii|iv|vi|v|i)\b)?/gi,
    // Review (v0.92.2): a bracketed rating needs its closing bracket, so "gas vent (I think)" reads none.
    hit: (m) => { const n = numberOf(m[1] ?? m[2] ?? m[3]); return n ? { field: 'recoilComp', value: n } : {}; } },
  { id: 'recoilComp', re: /\b(?:recoil\s+comp(?:ensation|ensator)?|rc)\s*(?:of\s*)?[+:]?\s*\(?\s*(?:rating\s*)?(\d)\b|\b(\d)\s+(?:points?\s+of\s+)?recoil\s+comp(?:ensation)?\b/gi,
    hit: (m) => { const n = numberOf(m[1] ?? m[2]); return n ? { field: 'recoilComp', value: n } : null; } },
  { id: 'suppressor', re: /\b(?:sound\s+)?suppressor\b/gi, hit: () => ({ field: 'muzzle', value: 'suppressor' }) },
  { id: 'silencer', re: /\bsilencer\b|\bsilenced\b/gi, hit: () => ({ field: 'muzzle', value: 'silencer' }) },
  { id: 'smartgun', re: /\bsmart[- ]?gun(?:\s+(?:link|system|adapter))?\b|\bsmart[- ]?link(?:ed)?\b|\bsmart\s+system\b/gi, hit: () => ({ field: 'smartgun', value: true }) },
  { id: 'laserSight', re: /\blaser\s+sight\b|\blaser\s+pointer\b/gi, hit: () => ({ field: 'laserSight', value: true }) },
  { id: 'scopeVision', re: /\b(low[- ]?light|thermo(?:graphic)?|thermal)\s+(?:imaging\s+)?scope\b|\bscope\s*\(\s*(low[- ]?light|thermo(?:graphic)?|thermal)\b/gi,
    hit: (m) => ({ field: 'scopeVision', value: /low/i.test(m[1] ?? m[2] ?? '') ? 'lowLight' : 'thermographic' }) },
  { id: 'scope', re: /\b(?:imaging\s+|telescopic\s+|optical\s+)?scope\b(?:\s*\(\s*(\d)\s*\)|[^.;]{0,24}?\b(?:magnification|mag\.?)\s*(\d))?|\b(?:magnification|mag\.?)\s*(\d)\s+scope\b|\b(\d)\s*x\s+scope\b/gi,
    // v0.92.2: "scope (2)" is magnification 2.
    hit: (m) => { const n = numberOf(m[1] ?? m[2] ?? m[3] ?? m[4]); return { field: 'scope', value: Math.min(3, n ?? 1) }; } },
  { id: 'shockPad', re: /\bshock\s+pad\b/gi, hit: () => ({ field: 'shockPad', value: true }) },
  { id: 'tripod', re: /\btripod\b/gi, hit: () => ({ field: 'support', value: 'tripod' }) },
  { id: 'bipod', re: /\bbipod\b/gi, hit: () => ({ field: 'support', value: 'bipod' }) },
  { id: 'gyro', re: /\bgyro(?:[- ]?stabili[sz](?:ed|ation|er)|scopic)?(?:\s+(?:mount|harness|stabili[sz](?:er|ation)))?(?:\s*\(?\s*(?:rating\s*)?(\d))?\b/gi,
    hit: (m) => { const n = numberOf(m[1]); return n ? { field: 'gyro', value: n } : {}; } },
  { id: 'quickDraw', re: /\bquick[- ]?draw\s+holster\b/gi, hit: () => ({ field: 'quickDraw', value: true }) },
  // Recognised, with no field of their own: notes (custom tweaks the owner can turn into numbers).
  { id: 'foldingStock', re: /\bfolding\s+stock\b/gi, hit: () => ({}) },
  { id: 'flashSuppressor', re: /\bflash\s+(?:suppressor|hider)\b/gi, hit: () => ({}) },
  { id: 'bayonet', re: /\bbayonet\b/gi, hit: () => ({}) },
  { id: 'sling', re: /\bsling\b/gi, hit: () => ({}) },
  { id: 'hipPad', re: /\bhip[- ]?pad\b/gi, hit: () => ({}) },
  { id: 'extendedClip', re: /\bextended\s+(?:clip|magazine)\b/gi, hit: () => ({}) },
  { id: 'underBarrel', re: /\bunder[- ]?barrel\s+(?:grenade\s+launcher|launcher|shotgun|weapon)\b/gi, hit: () => ({}) },
];

/** Accessories a description names (each once, the first plain mention; negated mentions skipped). */
export function readAccessories(description: unknown): AccessoryHit[] {
  const text = plainText(description);
  if (!text) return [];
  const out: AccessoryHit[] = [];
  const taken: Array<[number, number]> = [];
  const overlaps = (a: number, b: number) => taken.some(([x, y]) => a < y && b > x);
  const fieldsDone = new Set<string>();
  for (const r of RULES_LIST) {
    r.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = r.re.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      const before = text.slice(Math.max(0, start - 40), start);
      const after = text.slice(end, end + 40);
      // The mention is used up either way, so a negated "no silencer" doesn't leave "silencer" for a later rule.
      taken.push([start, end]);
      if (NEG_BEFORE.test(before) || NEG_AFTER.test(after)) continue;
      const h = r.hit(m);
      if (!h) continue;
      if (h.field && fieldsDone.has(h.field)) break;
      if (h.field) fieldsDone.add(h.field);
      out.push({ id: r.id, ...h, text: m[0].trim().slice(0, 40) });
      break;
    }
  }
  // A low-light or thermographic scope is a scope too (magnification 1 unless the text says more).
  const vision = out.find((h) => h.id === 'scopeVision');
  // v0.92.2: a magnification just after it counts ("scope (low-light, magnification 2)").
  if (vision && !out.some((h) => h.field === 'scope')) {
    const at = text.toLowerCase().indexOf(vision.text.toLowerCase());
    const near = at >= 0 ? text.slice(at + vision.text.length, at + vision.text.length + 32) : '';
    // Review: "magnification N" within the phrase, or "(N)" / ", N x" straight after (not "and 2 x spare clips").
    const mag = /^[^.;]*?\b(?:magnification|mag\.?)\s*(\d)|^\s*\(\s*(\d)\s*\)|^\s*,?\s*(\d)\s*x\b/i.exec(near);
    out.push({ id: 'scope', field: 'scope', value: Math.min(3, Math.max(1, numberOf(mag?.[1] ?? mag?.[2] ?? mag?.[3]) ?? 1)), text: vision.text });
  }
  return out;
}

export interface AccessoryPlan {
  /** Weapon fields to set (`system.<field>` → value): only those still at their default. */
  set: Record<string, unknown>;
  /** The values they had (for the undo). */
  before: Record<string, unknown>;
  /** What filled each field, and the accessories without a field (notes). */
  filled: AccessoryHit[];
  notes: AccessoryHit[];
  /** Found but kept: the field already held a value someone set. */
  kept: AccessoryHit[];
}

/**
 * The plan for a weapon: the accessories its description names, against its current values. `dismissed` are accessory
 * ids an undo took back (they aren't filled again); `noted` are note ids already added.
 */
export function accessoryPlan(description: unknown, system: Record<string, unknown> | null | undefined, o: { dismissed?: readonly string[]; noted?: readonly string[] } = {}): AccessoryPlan {
  const s = system ?? {};
  const plan: AccessoryPlan = { set: {}, before: {}, filled: [], notes: [], kept: [] };
  const dismissed = new Set(o.dismissed ?? []);
  const noted = new Set(o.noted ?? []);
  for (const h of readAccessories(description)) {
    if (dismissed.has(h.id)) continue;
    if (!h.field) { if (!noted.has(h.id)) plan.notes.push(h); continue; }
    const def = ACCESSORY_DEFAULTS[h.field];
    const cur = s[h.field];
    const atDefault = cur === undefined || cur === null || cur === def || (typeof def === 'number' && Number(cur) === def);
    if (!atDefault) { if (cur !== h.value) plan.kept.push(h); continue; }
    if (cur === h.value) continue;
    plan.set[`system.${h.field}`] = h.value;
    plan.before[`system.${h.field}`] = cur ?? def;
    plan.filled.push(h);
  }
  return plan;
}
