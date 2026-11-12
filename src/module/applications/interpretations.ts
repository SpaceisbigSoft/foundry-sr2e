/**
 * v0.92.0: the Interpretations window (rules/interpretations.ts): every place the rules as written aren't clear and the
 * system uses the creator's interpretation, grouped by area, each with what is unclear, how it is resolved, the sources
 * and its house-rule switch (the GM: a button to the house rules). A † anywhere (a value, a card's line) opens it at
 * its entry: a capture-phase click and an Enter on `[data-sr2e-interp]`, registered once (`registerInterpretations`).
 */
import { SYSTEM } from '../config/system.ts';
import { RULES } from '../rules/index.ts';
import { INTERPRETATIONS, interpText, ruleValue, interpretation } from '../rules/interpretations.ts';
import { t as tx, tKey } from '../helpers/i18n.ts';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const TEMPLATE = 'interpretations.hbs';

export class SR2Interpretations extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: Record<string, any> = {
    id: 'sr2e-interpretations',
    classes: ['sr2e', 'sr2e-interp-window'],
    window: { title: 'SR2E.Window.Interpretations.title', resizable: true, icon: 'fa-solid fa-scale-unbalanced' },
    position: { width: 640, height: 620 },
    actions: { interpHouseRules: SR2Interpretations.#onHouseRules },
  };
  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/${TEMPLATE}`, scrollable: ['.sr2e-interp-list'] } };

  /** The entry to open at (its id). */
  focusId = '';

  /** Open the window (one), at an entry when asked. */
  static open(id = ''): SR2Interpretations {
    const known = interpretation(id) ? String(id) : '';
    const cur = [...((foundry as any).applications?.instances?.values?.() ?? [])].find((a: any) => a instanceof SR2Interpretations) as SR2Interpretations | undefined;
    const w = cur ?? new SR2Interpretations();
    w.focusId = known;
    void w.render({ force: true });
    if (cur) cur.bringToFront?.();
    return w;
  }

  async _prepareContext(): Promise<any> {
    const areas = ['magic', 'street'] as const;
    return {
      isGM: Boolean(game.user?.isGM),
      areas: areas.map((area) => ({
        area,
        label: tKey(`SR2E.Interp.Area.${area}`),
        entries: INTERPRETATIONS.filter((i) => i.area === area).map((i) => {
          const t = interpText(i.id);
          const v = ruleValue(RULES, i.rule);
          return { id: i.id, ...t, rule: i.rule, value: v === undefined ? '' : String(v), open: i.id === this.focusId };
        }),
      })),
    };
  }

  async _onRender(context: any, options: any): Promise<void> {
    await super._onRender(context, options);
    if (!this.focusId) return;
    const el = (this.element as HTMLElement | undefined)?.querySelector(`[data-interp-id="${CSS.escape(this.focusId)}"]`) as HTMLElement | null;
    el?.scrollIntoView?.({ block: 'start' });
  }

  static #onHouseRules(this: SR2Interpretations) {
    if (!game.user?.isGM) return;
    const menu: any = (game as any).settings?.menus?.get?.(`${SYSTEM.id}.houseRulesMenu`);
    if (menu?.type) new menu.type().render(true);
  }
}

let registered = false;
/** Clicks and Enter on any † open the window at its entry (once). */
export function registerInterpretations(): void {
  if (registered || typeof document === 'undefined') return;
  registered = true;
  const go = (ev: Event) => {
    // Review (N8): only the system's own marks, never inside an editor or a field.
    const t = ev.target as HTMLElement | null;
    if (!t || t.isContentEditable || t.closest?.('input, textarea, select, prose-mirror, .editor-content')) return;
    const el = t.closest?.('a.sr2e-interp[data-sr2e-interp]') as HTMLElement | null;
    if (!el) return;
    if (ev instanceof KeyboardEvent && ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault(); ev.stopPropagation();
    SR2Interpretations.open(String(el.dataset['sr2eInterp'] ?? ''));
  };
  document.addEventListener('click', go, true);
  document.addEventListener('keydown', go, true);
}

/** For the guide and the tools window: a line saying what the window is. */
export function interpretationsHint(): string { return tx('SR2E.Interp.windowHint'); }
