/**
 * v0.89.5: the name of a sheet heading for lookups (the guide's "?" link, the section icon, the fold key, the setup
 * warnings' jumps): its `data-heading` attribute, the English text the template gives it (scripts/i18n-headings.mjs),
 * so the lookups work the same in every language; else the text shown (headings built from data, like `{{label}}`).
 */
export function headingName(h: HTMLElement, shown: (h: HTMLElement) => string): string {
  const id = h?.dataset?.['heading'];
  return typeof id === 'string' && id.trim() ? id.trim() : shown(h);
}
