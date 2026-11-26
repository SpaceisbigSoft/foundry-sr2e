/**
 * v0.93.3: the GM's world lists window (report item 36): custom skills, hidden book skills and attribute labels.
 * The rules (parsing, validation, the merged picker lists) are in rules/customlists.ts; this file is the Foundry
 * glue: the world setting `customLists` (restricted to the GM, its onChange keeps the rules store current), the
 * settings menu and the ApplicationV2 form. Saving never touches an actor: hiding a skill only leaves it out of
 * the pickers, and a renamed attribute keeps its key (every rule reads the key, never the label).
 */
import { SYSTEM } from '../config/system.ts';
import { RULES, COMMON_SKILLS, canonicalSkillNames } from '../rules/index.ts';
import {
  parseCustomSkills, parseHidden, normalizeLists, formatCustomSkills, cleanOverride, setCustomLists, getCustomLists,
  defaultAttributeLabel, attributeAbbr, LABELLED_ATTRIBUTES, LIST_LIMITS, EMPTY_LISTS,
  type CustomLists, type ListProblem,
} from '../rules/customlists.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';

const esc = escHtml;
export const CUSTOM_LISTS_SETTING = 'customLists';

/** v0.93.3: every book skill name the pickers know (the picker's common list, its aliases, the starter list). */
/** v0.93.3: each problem's reason, by literal key (the i18n scans want literal keys). */
const REASON_TEXT: Record<string, () => string> = {
  name: () => tx('SR2E.Text.CustomLists.reason.name'), attribute: () => tx('SR2E.Text.CustomLists.reason.attribute'),
  kind: () => tx('SR2E.Text.CustomLists.reason.kind'), duplicate: () => tx('SR2E.Text.CustomLists.reason.duplicate'),
  book: () => tx('SR2E.Text.CustomLists.reason.book'), limit: () => tx('SR2E.Text.CustomLists.reason.limit'),
};

export function bookSkillNames(): string[] {
  const common = Object.values(COMMON_SKILLS).flat();
  const starters = ((RULES as any).STREET_V61?.starterSkills ?? []).map((s: any) => String(s?.name ?? ''));
  const aliases = Object.keys((RULES as any).CHARACTERS_V73?.skillNames?.aliases ?? {});
  return [...new Set([...common, ...canonicalSkillNames(common), ...starters, ...aliases].filter(Boolean))];
}

/** v0.93.3: the stored lists, re-validated (the store's source at ready and on every change). */
function readLists(): CustomLists {
  try { return normalizeLists((game as any).settings.get(SYSTEM.id, CUSTOM_LISTS_SETTING), bookSkillNames()); } catch { return EMPTY_LISTS; }
}

/** v0.93.3: a problem as one line of the warning (plain text; escaped where it is shown). */
function problemText(p: ListProblem): string {
  return tx('SR2E.Text.CustomLists.problemLine', { line: p.line, text: p.text, reason: REASON_TEXT[p.reason]?.() ?? p.reason });
}

/** v0.93.3: the window's form (every value escaped where it is written). */
export function customListsHtml(l: CustomLists): string {
  const attrRows = LABELLED_ATTRIBUTES.map((k) => {
    const o = l.attributes[k] ?? {};
    const def = defaultAttributeLabel(k);
    return `<div class="form-group"><label>${esc(def)} <code>${esc(k)}</code></label><div class="form-fields">
      <input type="text" name="label-${esc(k)}" value="${esc(o.label ?? '')}" placeholder="${esc(def)}" maxlength="${LIST_LIMITS.label}" aria-label="${esc(tx('SR2E.App.CustomLists.labelFor', { name: def }))}">
      <input type="text" name="abbr-${esc(k)}" value="${esc(o.abbr ?? '')}" placeholder="${esc(attributeAbbr(k, {}))}" maxlength="${LIST_LIMITS.abbr}" style="max-width:5em" aria-label="${esc(tx('SR2E.App.CustomLists.abbrFor', { name: def }))}">
    </div></div>`;
  }).join('');
  return `<div class="standard-form sr2e-custom-lists">
    <p class="hint">${esc(tx('SR2E.App.CustomLists.intro'))}</p>
    <fieldset><legend>${esc(tx('SR2E.App.CustomLists.skillsHeading'))}</legend>
      <p class="hint">${esc(tx('SR2E.App.CustomLists.skillsHint', { max: LIST_LIMITS.skills }))} <code>Name | quickness | active | note</code></p>
      <textarea name="skills" rows="9" spellcheck="false" style="font-family: monospace">${esc(formatCustomSkills(l.skills))}</textarea>
    </fieldset>
    <fieldset><legend>${esc(tx('SR2E.App.CustomLists.hiddenHeading'))}</legend>
      <p class="hint">${esc(tx('SR2E.App.CustomLists.hiddenHint'))}</p>
      <textarea name="hidden" rows="6" spellcheck="false" style="font-family: monospace">${esc(l.hidden.join('\n'))}</textarea>
    </fieldset>
    <fieldset><legend>${esc(tx('SR2E.App.CustomLists.attributesHeading'))}</legend>
      <p class="hint">${esc(tx('SR2E.App.CustomLists.attributesHint'))}</p>
      ${attrRows}
    </fieldset>
    <footer class="form-footer"><button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${esc(tx('SR2E.App.CustomLists.save'))}</button></footer>
  </div>`;
}

/** v0.93.3: the GM's world lists editor. */
export class CustomListsConfig extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'sr2e-custom-lists',
    tag: 'form',
    window: { title: 'SR2E.Window.Settings.sr2eCustomLists', icon: 'fa-solid fa-list-check', resizable: true },
    position: { width: 560, height: 720 },
    form: { handler: CustomListsConfig.#onSubmit, closeOnSubmit: true },
  };

  async _renderHTML(): Promise<HTMLElement> {
    const div = document.createElement('div');
    div.innerHTML = customListsHtml(getCustomLists());
    return div;
  }

  _replaceHTML(result: HTMLElement, content: HTMLElement): void {
    content.replaceChildren(...Array.from(result.childNodes)); // v0.93.3: an array (the type-check has no DOM iterables)
  }

  static async #onSubmit(_event: Event, form: HTMLFormElement): Promise<void> {
    const el: any = form.elements;
    const book = bookSkillNames();
    const s = parseCustomSkills(String(el.skills?.value ?? ''), book);
    const h = parseHidden(String(el.hidden?.value ?? ''));
    const attributes: CustomLists['attributes'] = {};
    for (const k of LABELLED_ATTRIBUTES) {
      const o = cleanOverride({ label: el[`label-${k}`]?.value, abbr: el[`abbr-${k}`]?.value });
      if (o) attributes[k] = o;
    }
    const lists: CustomLists = { skills: s.skills, hidden: h.hidden, attributes };
    await (game as any).settings.set(SYSTEM.id, CUSTOM_LISTS_SETTING, lists);
    const problems = [...s.problems, ...h.problems];
    if (problems.length) {
      const shown = problems.slice(0, 5).map(problemText).join('; ');
      ui.notifications?.warn?.(tx('SR2E.Notify.CustomLists.skipped', { count: problems.length, lines: escHtml(shown) }));
    } else ui.notifications?.info?.(tx('SR2E.Notify.CustomLists.saved', { skills: lists.skills.length, hidden: lists.hidden.length }));
  }
}

/**
 * v0.93.3: register the world setting and the GM's menu, and fill the rules store. Call it from settings.ts's
 * registerSettings (beside the Skill Web's registration), after the rules tables are in place.
 */
export function registerCustomListSettings(): void {
  (game as any).settings.register(SYSTEM.id, CUSTOM_LISTS_SETTING, {
    scope: 'world', config: false, type: Object, default: { skills: [], hidden: [], attributes: {} },
    onChange: () => { setCustomLists(readLists()); refreshOpenSheets(); },
  });
  (game as any).settings.registerMenu(SYSTEM.id, 'customListsMenu', {
    name: 'SR2E.Settings.customListsMenu.Name', label: 'SR2E.Settings.customListsMenu.Label', hint: 'SR2E.Settings.customListsMenu.Hint',
    icon: 'fa-solid fa-list-check', type: CustomListsConfig, restricted: true,
  });
  setCustomLists(readLists());
}

/** v0.93.3: open actor sheets show a renamed attribute at once. */
function refreshOpenSheets(): void {
  const inst: any = (foundry as any).applications?.instances;
  for (const app of (inst?.values ? [...inst.values()] : Object.values(inst ?? {}))) {
    const a: any = app;
    if (a?.rendered && a.document?.documentName === 'Actor') a.render?.();
  }
}
