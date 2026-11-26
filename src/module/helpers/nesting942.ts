/**
 * v0.94.2 (plan items 39 and 44): the derived-data side of nested items (rules/nesting942.ts), for models/index.ts.
 *
 * Each weapon, armor and program rebuilds a few values from its STORED data (`_source`) every time it is prepared, so
 * nothing stale survives a detach and the stored fields are never written:
 *  - a weapon's accessory fields become the effective values (stored fields merged with its attached accessories,
 *    `mergeAccessories`); a weapon packed in a container is not ready (it has to be drawn: drawing takes it out);
 *  - armor packed in a container isn't worn;
 *  - a program stored on a deck that isn't in use isn't loaded.
 * Every reader of those fields (attacks, recoil, vision, the sheets, tweaks, Matrix memory) sees the effective value.
 * `formSystem942` gives the item sheet the stored values for those fields, so saving the form never writes an
 * effective value back.
 */
import { mergeAccessories, accessoryOf, childrenOf, lookupFromItem, isStowed, programMayLoad, programDeck, ACCESSORY_FIELD_DEFAULTS } from '../rules/nesting942.ts';

/**
 * The fields the item sheet's form shows as stored, by item type. A program's `loaded` isn't here: its sheet compares the
 * box with the effective value and loads through Swap Memory (an off-deck program shows unloaded and saves as such).
 */
export const SHADOWED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  weapon: [...Object.keys(ACCESSORY_FIELD_DEFAULTS), 'ready'],
  armor: ['worn'],
};

/** Rebuild an item's nesting-derived values (call from its data model's prepareDerivedData; `system` is the model). */
export function nestDerived942(system: any): void {
  try {
    const item: any = system?.parent;
    const src: any = item?._source?.system;
    if (!item || !src) return;
    const lookup = lookupFromItem(item);
    switch (item.type) {
      case 'weapon': {
        const all: any[] = lookup ? [...(item.parent?.items ?? [])] : [];
        const attached = all.length ? childrenOf(item.id, all, 'mounted')
          .filter((c: any) => !c.system?.damaged && Number(c.system?.quantity ?? 1) > 0)
          .map((c: any) => ({ name: String(c.name ?? ''), spec: accessoryOf(c) })) : [];
        const merged = mergeAccessories(src, attached);
        Object.assign(system, merged.values);
        const stowed = isStowed(item, lookup);
        system.ready = Boolean(src.ready) && !stowed;
        system.nest942Derived = { from: merged.from, attached: attached.length, stowed };
        break;
      }
      case 'armor': {
        const stowed = isStowed(item, lookup);
        system.worn = Boolean(src.worn) && !stowed;
        system.nest942Derived = { stowed };
        break;
      }
      case 'program': {
        const may = programMayLoad(item, lookup);
        system.loaded = Boolean(src.loaded) && may;
        system.nest942Derived = { offDeck: !may, deckId: programDeck(item, lookup)?.id ?? '' };
        break;
      }
      default: break;
    }
  } catch (err) { console.warn('sr2e | nested item data', err); }
}

/**
 * The `system` the item sheet's form shows: the item's own, but with the stored values for the fields nesting can
 * change (so a submitted form writes back only what the user typed).
 */
export function formSystem942(item: any): any {
  const sys = item?.system;
  const keys = SHADOWED_FIELDS[String(item?.type ?? '')];
  const src = item?._source?.system;
  if (!sys || !keys || !src || typeof sys !== 'object') return sys;
  const set = new Set(keys);
  return new Proxy(sys, {
    get: (t, k) => (typeof k === 'string' && set.has(k) && k in src ? src[k] : Reflect.get(t, k)),
  });
}
