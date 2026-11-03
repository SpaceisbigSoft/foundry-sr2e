/**
 * v0.91.3: the Catalogue (the owner, 25 Oct 2026: "an easily browseable compendium of all the things the players can
 * acquire"): a window to browse what the shop shows (applications/codex.ts), with a page per entry. Pure: which types
 * it lists, and an entry's stats as label/value rows (the new-entry form's fields for its kind, so the page shows what
 * a book's stat line has: rules/newentry.ts).
 */
import { entryFields, entryKindForType, type EntryKind } from './newentry.ts';
import { damageLabel } from './weapons.ts';

/** The tabs: everything a character can get (bought in the shop, or learned: spells and adept powers). */
export const CODEX_TYPES = ['weapon', 'armor', 'gear', 'cyberware', 'focus', 'program', 'cyberdeck', 'spell', 'adeptpower', 'vehicle'] as const;
export const isCodexType = (t: unknown): boolean => (CODEX_TYPES as readonly string[]).includes(String(t));

/** Fields the page shows in its price line, not among the stats. */
const PRICE_FIELDS = new Set(['availability', 'cost', 'streetIndex', 'legality']);

/** One stat on a page. `labelKey`: a language key; `yes`: a ticked box (the page says "Yes"). */
export interface CodexStat { id: string; labelKey: string; value: string; yes?: boolean }

/** The new-entry kind an item is (cyberware marked bioware is bioware). */
export function codexKind(type: string, s: any): EntryKind {
  if (type === 'vehicle') return s?.drone ? 'drone' : 'vehicle';
  return type === 'cyberware' && s?.bioware ? 'bioware' : entryKindForType(type);
}

const get = (s: any, path: string): unknown => path.split('.').reduce((o: any, k) => (o == null ? undefined : o[k]), s);
const n = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const FEED_CODES: Record<string, string> = { clip: 'c', belt: 'b', cylinder: 'cy', internal: 'm', break: 'bk' };

/** A shorthand field written back the way a book's stat line has it ("9M", "(F/2)+1S", "15 (c)", "5/20/40/60"). */
function shorthandText(id: string, type: string, s: any): string {
  switch (id) {
    case 'shDamage': {
      const w = type === 'cyberware' ? s?.weapon ?? {} : s ?? {};
      if (type === 'spell' || type === 'program' || type === 'power') {
        const lv = String(w.damageLevel ?? '');
        return lv ? `${lv}${w.damageType === 'stun' ? ' Stun' : ''}` : '';
      }
      if (!w.strengthPower && !n(w.damagePower)) return '';
      const d = damageLabel({ strengthPower: Boolean(w.strengthPower), damagePower: n(w.damagePower), damageLevel: String(w.damageLevel ?? 'M') as any });
      return `${d}${w.damageType === 'stun' ? ' Stun' : ''}`;
    }
    case 'shDrain': {
      const lv = String(s?.drainLevel ?? '');
      if (!lv) return '';
      const m = n(s?.drainModifier);
      return `(F/2)${m > 0 ? `+${m}` : m < 0 ? `${m}` : ''}${lv}`;
    }
    case 'shAmmo': {
      const cap = n(s?.ammoMax);
      if (!cap) return '';
      const f = FEED_CODES[String(s?.feed ?? '')];
      return f ? `${cap} (${f})` : `${cap}`;
    }
    case 'shRange': {
      const r = s?.range ?? {};
      const xs = [r.short, r.medium, r.long, r.extreme].map(n);
      return xs.some((x) => x > 0) ? xs.join('/') : '';
    }
    case 'shHandling': {
      const h = n(s?.handling), off = n(s?.handlingOffroad);
      return h || off ? (off ? `${h}/${off}` : `${h}`) : '';
    }
    case 'shPersona': {
      const xs = [s?.bod, s?.evasion, s?.masking, s?.sensors].map(n);
      return xs.some((x) => x > 0) ? xs.join('/') : '';
    }
  }
  return '';
}

/**
 * The stats a page shows for an entry, in the form's order: only those with a value (a 0, a blank and an unticked box
 * are left out). The price, Availability, Street Index and legality are the page's price line instead.
 */
export function codexStats(type: string, s: any): CodexStat[] {
  const out: CodexStat[] = [];
  const kind = codexKind(type, s);
  for (const f of entryFields(kind)) {
    if (PRICE_FIELDS.has(f.id) && !(kind === 'adeptpower' && f.id === 'cost')) continue;
    if (f.shorthand) {
      const v = shorthandText(f.id, type, s);
      if (v) out.push({ id: f.id, labelKey: f.labelKey, value: v });
      continue;
    }
    const raw = get(s, f.id);
    if (f.input === 'check') { if (raw === true) out.push({ id: f.id, labelKey: f.labelKey, value: '', yes: true }); continue; }
    if (raw === undefined || raw === null || raw === '' || raw === false) continue;
    if (f.input === 'number') { if (!n(raw)) continue; out.push({ id: f.id, labelKey: f.labelKey, value: String(n(raw)) }); continue; }
    const v = String(raw).trim();
    if (v) out.push({ id: f.id, labelKey: f.labelKey, value: v.slice(0, 120) });
  }
  return out;
}

/** The page a shop row or a link asks for: a tab and an entry key (anything else is ignored). */
export function codexTarget(o: { type?: unknown; key?: unknown } | null | undefined): { type: string; key: string } {
  const type = isCodexType(o?.type) ? String(o!.type) : 'weapon';
  const key = typeof o?.key === 'string' && o.key.length <= 300 ? o.key : '';
  return { type, key };
}
