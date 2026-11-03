/**
 * v0.91.6: the "Find through…" dialog (RULES.SHOP_V916.through). Before a character's find (the shop's Find & buy,
 * Find… on an item, an item sheet's Buy that finds first) a character with contacts chooses how: on their own,
 * helped by a contact (as legwork: closer contacts, paid dice, a favour, the contact's own dice), or let a contact
 * marked as a fixer find it (the fixer's roll, for a cut of the price and more time). The choice is only a request:
 * `SR2Actor.#findCore` checks it against the character's contacts again (rules/fixers.ts `throughPlan`).
 */
import { RULES } from '../rules/index.ts';
import { throughOn, isFixer, fixerDice, type FindThrough } from '../rules/fixers.ts';
import { legworkLevelDice } from '../rules/upkeep.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';

/** Does this actor get the choice (the rule is on, a player character with at least one contact)? */
export function offersThrough(actor: any): boolean {
  return throughOn() && actor?.type === 'character' && ((actor?.system?.contacts as any[] | undefined) ?? []).length > 0;
}

/** Read the dialog's form into a choice (null = on their own). Exported for the tests. */
export function readThrough(e: Record<string, any>): FindThrough | null {
  const how = String(e['how']?.value ?? 'self');
  const m = /^(help|fixer):(.+)$/.exec(how);
  if (!m) return null;
  return {
    mode: m[1] as 'help' | 'fixer', contactId: m[2]!,
    pay: Math.max(0, Math.floor(Number(e['pay']?.value) || 0)),
    favour: Boolean(e['favour']?.checked),
    digs: e['digs'] ? Boolean(e['digs'].checked) : true,
  };
}

/** The dialog's form (exported for the tests). */
export function throughForm(contacts: any[], o: { count?: number } = {}): string {
  const S = RULES.SHOP_V916;
  const C = RULES.STREET.contacts;
  const levels = RULES.UPKEEP.contacts.levels;
  const lvl = (c: any) => levels.find((l) => l.level === c.level)?.label ?? String(c.level ?? 1);
  const opts: string[] = [`<option value="self" selected>${tx('SR2E.Dialog.Through.self')}</option>`];
  for (const c of contacts) {
    const closer = legworkLevelDice(Number(c.level) || 1);
    opts.push(`<option value="help:${escHtml(c.id)}">${tx('SR2E.Dialog.Through.help', { name: escHtml(c.name), level: escHtml(lvl(c)), dice: closer ? ` +${closer}` : '' })}</option>`);
  }
  for (const c of contacts.filter(isFixer)) {
    opts.push(`<option value="fixer:${escHtml(c.id)}">${tx('SR2E.Dialog.Through.fixer', { name: escHtml(c.name), dice: fixerDice(c) })}</option>`);
  }
  const anyDice = contacts.some((c) => (Number(c.dice) || 0) > 0) && C.ownDice !== 'off';
  const percent = Math.round((Number(S.fixerFee) || 0) * 100);
  const legal = Math.round((Number(S.contactLegalShare) || 0) * 100);
  return `<div class="form-group"><label>${tx('SR2E.Dialog.Through.how')}</label><select name="how">${opts.join('')}</select></div>
    <div class="form-group"><label>${tx('SR2E.Dialog.Through.pay', { nuyenPerDie: C.nuyenPerDie })}</label><input name="pay" type="number" value="0" min="0" step="${C.nuyenPerDie}"></div>
    <label class="sr2e-check"><input type="checkbox" name="favour"> ${tx('SR2E.Dialog.Through.favour', { dice: C.favourDice })}</label>
    ${anyDice ? `<label class="sr2e-check"><input type="checkbox" name="digs" checked> ${tx('SR2E.Dialog.Through.digs')}</label>` : ''}
    <p class="hint">${tx('SR2E.Dialog.Through.hint', { legal, percent, time: S.fixerTime })}${(o.count ?? 1) > 1 ? ` ${tx('SR2E.Dialog.Through.each', { count: o.count ?? 1 })}` : ''}</p>`;
}

/**
 * Ask how to find it: a choice (through a contact or a fixer), null (on their own: also when there is no choice to
 * make), or false (the dialog was closed: don't find anything).
 */
export async function askFindThrough(actor: any, o: { count?: number } = {}): Promise<FindThrough | null | false> {
  if (!offersThrough(actor)) return null;
  const contacts = [...((actor.system.contacts as any[] | undefined) ?? [])];
  const r = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Through.title', { name: actor.name }) },
    content: throughForm(contacts, o),
    ok: { label: tx('SR2E.Dialog.Through.find'), callback: (_e: Event, b: any) => ({ choice: readThrough(b.form.elements) }) },
    rejectClose: false,
  });
  if (!r) return false;
  return (r as any).choice ?? null;
}
