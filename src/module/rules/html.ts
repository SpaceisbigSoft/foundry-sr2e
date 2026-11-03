/**
 * v0.81.0: the one HTML-escaping helper (the security review found 30 hand-written copies that escaped different
 * characters). Use `escHtml` for any text that goes into HTML: element content AND attribute values (it escapes
 * both quote kinds). Never put document names, labels or anything a player typed into HTML without it.
 *
 * Foundry v14 cleans ChatMessage content, DialogV2 content, notifications and tooltips of scripts and event handlers
 * (checked live), but the system's own windows that write `innerHTML` are not cleaned, and unescaped text still breaks
 * the markup or forges buttons. So: always escape.
 */
const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for HTML content or a quoted attribute value. null/undefined become ''. */
export function escHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] as string);
}

/** Escape text for use inside a RegExp (a name matched literally). */
export function escRegExp(value: unknown): string {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
