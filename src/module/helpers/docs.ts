/**
 * v0.93.4: popped-out windows. Foundry (or a pop-out module) can move a window into a browser window of its own, with a
 * document of its own: listeners put on the main `document` never hear its clicks and keys, and `document.activeElement`
 * never names its fields. The page-wide listeners register here instead; each one runs for the main document and for
 * every other document a window of ours is seen in.
 */
type Binder = (doc: Document) => void;

const binders: Binder[] = [];
const seen: Document[] = [];

function mainDocument(): Document | null { return typeof document === 'undefined' ? null : document; }

/** Note a document a window was rendered in (the main one is noted the first time a binder registers). */
export function noteDocument(doc: Document | null | undefined): void {
  if (!doc || seen.includes(doc)) return;
  // Closed windows' documents are dropped from the list (they hold no windows any more).
  for (let i = seen.length - 1; i >= 0; i--) { const v = seen[i]!.defaultView; if (v && (v as any).closed) seen.splice(i, 1); }
  seen.push(doc);
  for (const b of binders) { try { b(doc); } catch (err) { console.warn('sr2e | pop-out listeners', err); } }
}

/** Run a page-wide listener setup for the main document now and for each popped-out document when one appears. */
export function onEveryDocument(bind: Binder): void {
  binders.push(bind);
  const main = mainDocument();
  if (main && !seen.includes(main)) { seen.push(main); }
  for (const d of seen) { try { bind(d); } catch (err) { console.warn('sr2e | pop-out listeners', err); } }
}

/** The document an element lives in (its own window's, when popped out). */
export function docOf(el: Node | null | undefined): Document | null {
  return (el as any)?.ownerDocument ?? mainDocument();
}

/** The focused element of the document `el` lives in. */
export function activeIn(el: Node | null | undefined): Element | null {
  return docOf(el)?.activeElement ?? null;
}

/** Whether an element sits in a popped-out window (not the main page). */
export function isPoppedOut(el: Node | null | undefined): boolean {
  const d = (el as any)?.ownerDocument as Document | undefined;
  const main = mainDocument();
  return Boolean(d && main && d !== main);
}

/** The documents seen so far (the main one first, closed windows' dropped). */
export function everyDocument(): Document[] { return seen.filter((d) => !((d.defaultView as any)?.closed)); }

/** For the tests: forget every binder and document. */
export function resetDocuments(): void { binders.length = 0; seen.length = 0; }

/**
 * Watch for windows in other documents: every render of an application notes its document, and the PopOut! module's
 * own hook does so when it moves one.
 */
export function registerPopOutWatch(): void {
  const H: any = (globalThis as any).Hooks;
  if (!H?.on) return;
  H.on('renderApplicationV2', (app: any, el: unknown) => { const root: any = el instanceof Object && (el as any).ownerDocument ? el : app?.element; noteDocument(root?.ownerDocument); });
  H.on('PopOut:popout', (_app: any, win: any) => { noteDocument(win?.document); });
  H.on('PopOut:loaded', (_app: any, node: any) => { noteDocument(node?.ownerDocument); });
}
