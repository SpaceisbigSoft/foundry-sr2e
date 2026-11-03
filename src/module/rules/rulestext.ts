/**
 * v0.89.4: the text inside the rules tables (RULES and the Revamp's patch): labels, notes and the like, shown in
 * dialogs, sheets and cards. The tables are built when the module loads, before Foundry has its languages, so they
 * keep their English in the code and are translated in place once the languages are loaded (`localizeRules`, called
 * from settings.ts on the i18nInit hook). Each text's key comes from where it sits: `SR2E.Rules.<path>`, an array
 * item by its `id` (or its index when it has none), e.g. `SR2E.Rules.SITUATIONAL_MODIFIERS.attackerWalking.label`.
 * In English nothing changes (lang/en.json holds the same text, written from the tables by scripts/i18n-rules.ts).
 * Only these fields are text for people; names, skills, ids and patterns are data and are never touched.
 */

/** The fields that hold text for people. */
export const RULES_TEXT_FIELDS: ReadonlySet<string> = new Set(['label', 'note', 'text', 'skillHint', 'spiritLabel']);
/** Objects whose every string value is text for people (the GM's disaster suggestions by test kind). */
const TEXT_OBJECTS: ReadonlySet<string> = new Set([['DISASTERS', 'suggestions'].join('.')]);

/** A path segment for an item of an array: its `id` when that is a plain, unique name; else its index. */
function segmentOf(arr: readonly unknown[], i: number): string {
  const it: any = arr[i];
  const id = it && typeof it === 'object' && typeof it.id === 'string' ? it.id : null;
  if (id && /^[A-Za-z0-9_-]+$/.test(id) && arr.filter((x: any) => x && typeof x === 'object' && x.id === id).length === 1) return id;
  return String(i);
}
/** Whether a segment can be part of a key (Foundry splits keys on dots). */
const okSegment = (s: string): boolean => /^[A-Za-z0-9_-]+$/.test(s);

export interface RulesText { key: string; holder: Record<string, unknown>; field: string; text: string }

/**
 * Pure: every text for people in a rules object, with its key. `prefix` is the key's start (`SR2E.Rules`); `path` the
 * object's own place (a patch entry's path, `STREET.athletics.climb`). Objects seen twice are listed once.
 */
export function rulesTexts(o: unknown, prefix: string, path: string[] = [], seen: Set<unknown> = new Set()): RulesText[] {
  const out: RulesText[] = [];
  if (!o || typeof o !== 'object' || seen.has(o)) return out;
  seen.add(o);
  const textObject = TEXT_OBJECTS.has(path.join('.'));
  if (Array.isArray(o)) {
    o.forEach((v, i) => { if (v && typeof v === 'object') out.push(...rulesTexts(v, prefix, [...path, segmentOf(o, i)], seen)); });
    return out;
  }
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === 'string') {
      if ((RULES_TEXT_FIELDS.has(k) || textObject) && okSegment(k) && path.every(okSegment) && /[A-Za-z]/.test(v)) out.push({ key: `${prefix}.${[...path, k].join('.')}`, holder: o as Record<string, unknown>, field: k, text: v });
    } else if (v && typeof v === 'object') out.push(...rulesTexts(v, prefix, [...path, k], seen));
  }
  return out;
}

/**
 * Translate a rules object's texts in place: each text whose key `lookup` knows becomes its translation (a key the
 * language file lacks keeps the text there). Returns how many changed.
 */
export function localizeRules(o: unknown, prefix: string, lookup: (key: string) => string | null, path: string[] = []): number {
  let n = 0;
  for (const t of rulesTexts(o, prefix, path)) {
    const v = lookup(t.key);
    if (typeof v === 'string' && v && v !== t.key && v !== t.text) { t.holder[t.field] = v; n++; }
  }
  return n;
}

/** The Revamp's patch: each entry's path is where its value sits (`{ 'STREET.athletics.climb': [ … ] }`). */
export function patchTexts(patch: Record<string, unknown>, prefix: string): RulesText[] {
  const out: RulesText[] = [];
  for (const [p, v] of Object.entries(patch)) {
    const segs = p.split('.');
    if (v && typeof v === 'object') out.push(...rulesTexts(v, prefix, segs));
    // a patch entry that is itself one text (`'X.y.label': 'Text'`)
    else if (typeof v === 'string' && RULES_TEXT_FIELDS.has(segs[segs.length - 1]!) && segs.every(okSegment) && /[A-Za-z]/.test(v)) out.push({ key: `${prefix}.${p}`, holder: patch as Record<string, unknown>, field: p, text: v });
  }
  return out;
}
export function localizePatch(patch: Record<string, unknown>, prefix: string, lookup: (key: string) => string | null): number {
  let n = 0;
  for (const t of patchTexts(patch, prefix)) {
    const v = lookup(t.key);
    if (typeof v === 'string' && v && v !== t.key && v !== t.text) { t.holder[t.field] = v; n++; }
  }
  return n;
}

// ---------------------------------------------------------------- other tables built at load (v0.89.4)

/**
 * A table outside RULES whose text is translated in place the same way (rules/texttables.ts lists them): `key` is its
 * place under `SR2E.Tables`; `fields` the text fields of its objects (any depth); `all` when every string in it is text
 * (a list of flavour lines, a map of labels); `idField` names the field that identifies an array's items (else `id`).
 */
export interface TextTable { key: string; table: unknown; fields?: readonly string[]; all?: boolean; idField?: string }

function itemSegment(arr: readonly unknown[], i: number, idField: string): string {
  const it: any = arr[i];
  const id = it && typeof it === 'object' && typeof it[idField] === 'string' ? it[idField] : null;
  if (id && okSegment(id) && arr.filter((x: any) => x && typeof x === 'object' && x[idField] === id).length === 1) return id;
  return String(i);
}

/** Pure: every text of a listed table, with its key (`SR2E.Tables.<key>.<path>`). */
export function tableTexts(t: TextTable): RulesText[] {
  const out: RulesText[] = [];
  const fields = new Set(t.fields ?? []);
  const idField = t.idField ?? 'id';
  const seen = new Set<unknown>();
  const walk = (o: unknown, path: string[]): void => {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    const entries: Array<[string, unknown]> = Array.isArray(o) ? o.map((v, i) => [itemSegment(o, i, idField), v]) : Object.entries(o as Record<string, unknown>);
    entries.forEach(([seg, v], i) => {
      const field = Array.isArray(o) ? i : seg;
      if (typeof v === 'string') {
        if ((t.all || fields.has(seg)) && okSegment(seg) && path.every(okSegment) && /[A-Za-z]/.test(v)) out.push({ key: `SR2E.Tables.${t.key}.${[...path, seg].join('.')}`, holder: o as Record<string, unknown>, field: String(field), text: v });
      } else if (v && typeof v === 'object') walk(v, [...path, seg]);
    });
  };
  walk(t.table, []);
  return out;
}
export function localizeTable(t: TextTable, lookup: (key: string) => string | null): number {
  let n = 0;
  for (const x of tableTexts(t)) {
    const v = lookup(x.key);
    if (typeof v === 'string' && v && v !== x.key && v !== x.text) { x.holder[x.field] = v; n++; }
  }
  return n;
}
