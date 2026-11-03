/**
 * v0.66.0: the player guide inside Foundry. A "?" after each section heading on SR2e's windows opens the
 * guide at the topic that explains it; `openHelp()` with no topic opens the whole guide (the GM panel's
 * Player guide button, and the Guide button in every SR2e sheet's title bar: sheets.ts `addGuideButton`).
 * The topics are `rules/guide.ts`, their text `SR2E.Guide` in lang/en.json (v0.89.7; the English is docs/PLAYER-GUIDE.md).
 * v0.82.0: folded sections (`<details><summary>`) get a "?" too, and a heading can name its topic with
 * `data-help="<topic id>"` (or `data-help="none"`: no "?"). A player who follows a link to a GM topic is told it is
 * for the GM instead of landing silently on the first topic.
 */
import { SYSTEM } from '../config/system.ts';
import { GUIDE_TOPICS, matchesSearch, guideGroups, guideTopicFor, helpTopicFor, HELP_HEADING_SELECTOR } from '../rules/index.ts';
import { escHtml } from '../rules/html.ts';
import { openBugReport } from './bugreport.ts';
import { headingName } from '../helpers/heading.ts';
import { t as tx } from '../helpers/i18n.ts';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;

/** The guide window: topics on the left, the open topic on the right, a search. */
export class SR2Help extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: Record<string, any> = {
    id: 'sr2e-help',
    classes: ['sr2e', 'sr2e-help-window'],
    window: { title: 'SR2E.Window.Help.sr2eGuide', resizable: true, icon: 'fa-solid fa-circle-question' },
    position: { width: 720, height: 620 },
    // v0.89.8: the SR2e tools window, through the API (tools.ts imports this file).
    actions: { helpTopic: SR2Help.#onTopic, bugReport: () => { openBugReport(); }, openTools: () => { void (game as any).sr2e?.api?.openTools?.(); } },
  };
  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/help.hbs`, scrollable: ['.sr2e-help-body', '.sr2e-help-topics'] } };

  static #instance: SR2Help | null = null;
  topic = GUIDE_TOPICS[0]?.id ?? '';
  query = '';

  /** Open (or bring forward) the guide, at a topic. */
  static show(topic?: string): SR2Help {
    SR2Help.#instance ??= new SR2Help();
    const w = SR2Help.#instance;
    if (topic && GUIDE_TOPICS.some((t) => t.id === topic)) w.topic = topic;
    void w.render({ force: true });
    return w;
  }

  async close(options?: any): Promise<any> {
    SR2Help.#instance = null;
    return super.close(options);
  }

  async _prepareContext(_options: any): Promise<any> {
    const gm = Boolean((game as any).user?.isGM);
    const list = GUIDE_TOPICS.filter((t) => gm || t.audience !== 'gm');
    // v0.82.0: a GM topic reached by a player (a link) shows a note saying so; an unknown id opens the first topic.
    const shown = guideTopicFor(this.topic, gm);
    const open = shown ? { id: this.topic, ...shown } : list[0] ? { id: list[0].id, title: list[0].title, body: list[0].body } : null;
    return {
      query: this.query,
      // v0.76.0: grouped by category (guide.ts GUIDE_CATEGORIES); a group whose topics all miss the search is hidden.
      groups: guideGroups(gm).map((g) => {
        const topics = g.topics.map((t) => {
          const search = `${t.title} ${t.headings.join(' ')} ${t.body.replace(/<[^>]+>/g, ' ')}`;
          return { id: t.id, title: t.title, active: t.id === open?.id, search, hidden: !matchesSearch(search, this.query) };
        });
        return { label: g.label, topics, hidden: topics.every((t) => t.hidden) };
      }),
      title: open?.title ?? '',
      body: open?.body ?? `<p>${tx('SR2E.App.Help.noGuideText')}</p>`,
    };
  }

  async _onRender(context: any, options: any): Promise<void> {
    await (super._onRender as any)?.(context, options);
    const root: HTMLElement | null = (this as any).element ?? null;
    const search = root?.querySelector<HTMLInputElement>('.sr2e-help-search');
    search?.addEventListener('input', () => {
      this.query = search.value;
      for (const li of Array.from(root!.querySelectorAll<HTMLElement>('[data-topic-text]'))) li.hidden = !matchesSearch(li.dataset['topicText'] ?? '', this.query);
      for (const sec of Array.from(root!.querySelectorAll<HTMLElement>('[data-help-group]'))) sec.hidden = Array.from(sec.querySelectorAll<HTMLElement>('[data-topic-text]')).every((li) => li.hidden);
    });
    // Links between topics (#topic-id) stay in the window.
    for (const a of Array.from(root?.querySelectorAll<HTMLAnchorElement>('.sr2e-help-body a[href^="#"]') ?? [])) {
      a.addEventListener('click', (ev) => { ev.preventDefault(); this.topic = a.getAttribute('href')!.slice(1); void this.render(); });
    }
  }

  static #onTopic(this: SR2Help, _e: Event, t: HTMLElement) {
    this.topic = t.dataset['topic'] ?? this.topic;
    void this.render();
  }
}

/** Open the guide (at a topic). */
export function openHelp(topic?: string): SR2Help { return SR2Help.show(topic); }

/** The text of a heading without its controls (+ links, badges, our own ?). */
function headingText(h: HTMLElement): string {
  const c = h.cloneNode(true) as HTMLElement;
  for (const el of Array.from(c.querySelectorAll('a, button, .sr2e-badge, .hint, input, select'))) el.remove();
  return (c.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Put a "?" after each heading of an SR2e window that the guide explains (once per heading). */
export function decorateHelp(root: HTMLElement): number {
  let n = 0;
  for (const h of Array.from(root.querySelectorAll<HTMLElement>(HELP_HEADING_SELECTOR))) {
    if (h.querySelector(':scope > .sr2e-help') || h.closest('.sr2e-rich, .editor-content, .sr2e-help-window')) continue;
    // v0.82.0: a summary only when it is the summary line of a folded section.
    if (h.tagName === 'SUMMARY' && h.parentElement?.tagName !== 'DETAILS') continue;
    const topic = helpTopicFor(h.dataset['help'], headingName(h, headingText));
    if (!topic) continue;
    if (topic.audience === 'gm' && !(game as any).user?.isGM) continue;
    const a = document.createElement('a');
    a.className = 'sr2e-help';
    a.dataset['sr2eHelp'] = topic.id;
    a.title = tx('SR2E.App.Help.helpFor', { title: topic.title });
    a.setAttribute('aria-label', a.title);
    a.innerHTML = '<i class="fa-regular fa-circle-question"></i>';
    h.appendChild(a);
    n++;
  }
  return n;
}

export function registerHelp(): void {
  // Our windows only (class sr2e), after every render.
  Hooks.on('renderApplicationV2', (app: any, el: HTMLElement) => {
    const root: HTMLElement | null = el instanceof HTMLElement ? el : app?.element ?? null;
    if (!root?.classList?.contains('sr2e') || root.classList.contains('sr2e-help-window')) return;
    try { decorateHelp(root); } catch (err) { console.warn('sr2e | help links', err); }
  });
  // Capture: the heading's own click (folding the section) mustn't run when the ? is clicked.
  document.addEventListener('click', (ev) => {
    const a = (ev.target as HTMLElement | null)?.closest?.('[data-sr2e-help]') as HTMLElement | null;
    if (!a) return;
    ev.preventDefault();
    ev.stopPropagation();
    openHelp(a.dataset['sr2eHelp']);
  }, true);
}

export { esc as helpEscape };
