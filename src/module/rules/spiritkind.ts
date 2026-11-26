/**
 * v0.93.3: catch a spirit whose Kind does not fit what it is (a "Fire Elemental" left at the model's default Kind,
 * 'nature'). Pure: no Foundry. The inputs are the spirit actor's own fields: its name, `system.spiritKind`,
 * `system.spiritType` ("Fire elemental", "Forest spirit"), `system.element` and `system.domain`.
 */

/** The four hermetic elements, as the generator stores them in `system.element` (npcgen.ts ELEMENTS). */
export const SPIRIT_ELEMENTS: readonly string[] = ['fire', 'water', 'air', 'earth'];

/** Why a spirit's Kind looks wrong; translated as `SR2E.Text.SpiritKind.<key>`. */
export type SpiritKindMismatch = '' | 'nameSaysElemental' | 'elementSet';

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
const saysElemental = (s: unknown) => /\belementals?\b/i.test(String(s ?? ''));
const isElement = (s: unknown) => SPIRIT_ELEMENTS.includes(norm(s));

/**
 * v0.93.3: '' when the Kind fits, otherwise a short reason key: a 'nature' spirit whose name (or type) says
 * elemental, or whose element (or domain) is one of the four elements. Only 'nature' is checked: it is the model's
 * default, so a spirit nobody set lands there; the other kinds were chosen on purpose.
 */
export function kindMismatch(o: { kind: string; name?: string; element?: string; domain?: string; spiritType?: string }): SpiritKindMismatch {
  if (norm(o.kind) !== 'nature') return '';
  if (saysElemental(o.name) || saysElemental(o.spiritType)) return 'nameSaysElemental';
  if (isElement(o.element) || isElement(o.domain)) return 'elementSet';
  return '';
}

/**
 * v0.93.3: the Kind a new spirit most likely is, from its name (or type) and element: 'elemental' when the name says
 * elemental or the element is fire, water, air or earth; null = no guess (keep what it has).
 */
export function guessSpiritKind(name: string, element?: string): 'elemental' | null {
  return saysElemental(name) || isElement(element) ? 'elemental' : null;
}
