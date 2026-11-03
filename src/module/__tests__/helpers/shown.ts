/**
 * v0.85.0: a notification's text as the player sees it. Every value in a notification is escaped with `escHtml`
 * (the sweep), and Foundry shows the toast as HTML, so `&#39;` reads as an apostrophe and `&amp;` as `&`. Tests that
 * match the words a player reads compare `shown(text)`.
 */
export function shown(text: unknown): string {
  return String(text ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
