/**
 * v0.96.4: where a token document stands for the rules.
 *
 * In Foundry v14 a TokenDocument's `x` and `y` follow the movement animation: inside `updateToken` (and for a moment
 * after) they still give an old or in-between spot, while `_source` and the update's `change` already hold where the
 * token is going. Rules that look at a move read this instead. In `preUpdateToken` (no change passed) it is the spot
 * the token moves from.
 */
export function storedXY(doc: any, change?: any): { x: number; y: number } {
  const src = doc?._source;
  const x = change?.x ?? src?.x ?? doc?.x;
  const y = change?.y ?? src?.y ?? doc?.y;
  return { x: Number(x) || 0, y: Number(y) || 0 };
}
