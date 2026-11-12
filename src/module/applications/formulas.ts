/**
 * v0.91.8: the spell formula dialogs (RULES.FORMULA_V918). A formula is a gear item (rules/formulas.ts), sold through a
 * formula key (`formula:<force>:<tradition>:<the spell's key>`, read back by applications/shop.ts `resolveFormulaKey`),
 * so it is found, haggled, bought, queued and delivered like any other gear:
 * - **Buy a formula…** (a spell row in the shop or the Add window; a Catalogue page's Learn… opens the Add window): the Force and tradition, then Find & buy (a
 *   player character out of creation), Buy now or, for the GM, Give it free;
 * - **Learn from this formula…** (a formula's item sheet): the Force, up to the formula's;
 * - **Learn from a teacher…** (the Magic tab): a character who knows the spell; their Instruction test's card offers
 *   the learning test with its help.
 * The actor methods check everything again (`findFromShop`, `buyFromShop`, `learnFromFormula`, `learnFromTeacher`).
 */
import { RULES } from '../rules/index.ts';
import { formulaKey, formulaForce, formulaPrice, formulaAvailability, learnerTradition, isFormula, teachersOn, teacherFee, normTradition } from '../rules/formulas.ts';
import { buysByFinding } from '../rules/shop.ts';
import { inCreation } from './approvals.ts';
import { askFindThrough } from './through.ts';
import { resolveShopKey } from './shop.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';

/** The Force and tradition part of the buy dialog (exported for the tests). */
export function buyFormulaForm(o: { spell: string; category: string; force: number; tradition: string }): string {
  const trad = normTradition(o.tradition) || 'hermetic';
  const opt = (v: string, label: string) => `<option value="${v}"${v === trad ? ' selected' : ''}>${escHtml(label)}</option>`;
  return `<p>${tx('SR2E.Dialog.Formula.buyIntro', { spell: escHtml(o.spell) })}</p>
    <div class="form-group"><label>${tx('SR2E.Dialog.Formula.force')}</label><input name="force" type="number" value="${formulaForce(o.force)}" min="1" max="12"></div>
    <div class="form-group"><label>${tx('SR2E.Dialog.Formula.tradition')}</label><select name="tradition">${opt('hermetic', tx('SR2E.Text.Formula.hermetic'))}${opt('shamanic', tx('SR2E.Text.Formula.shamanic'))}</select></div>
    <p class="hint">${tx('SR2E.Dialog.Formula.buyHint', { price: formulaPrice(o.category, 1).toLocaleString(), avail: formulaAvailability(1) })}</p>`;
}

/**
 * Buy a spell's formula for `actor`: `spellKey` is the spell's shop or Catalogue key. A player character out of
 * creation finds it first (the Availability test, with the "Find through…" choice); anyone else buys it now; the GM
 * may also give it free.
 */
export async function buyFormula(actor: any, spellKey: string, spell: { name: string; category?: string; force?: number }): Promise<boolean> {
  if (!actor || !spellKey) return false;
  const isGM = Boolean(game.user?.isGM);
  const finds = buysByFinding({ isGM, actorType: String(actor.type ?? ''), inCreation: inCreation(actor) });
  const buttons: any[] = [{ action: finds ? 'find' : 'buy', label: finds ? tx('SR2E.App.Shop.findAndBuy') : tx('SR2E.Dialog.Formula.buyNow'), default: true, callback: (_e: Event, b: any) => ({ how: finds ? 'find' : 'buy', f: b.form.elements }) }];
  if (isGM) buttons.push({ action: 'free', label: tx('SR2E.Dialog.Formula.giveFree'), callback: (_e: Event, b: any) => ({ how: 'free', f: b.form.elements }) });
  const r: any = await foundry.applications.api.DialogV2.wait({
    window: { title: tx('SR2E.Dialog.Formula.buyTitle', { spell: spell.name }) },
    content: buyFormulaForm({ spell: spell.name, category: String(spell.category ?? ''), force: Number(spell.force ?? 1), tradition: learnerTradition(actor.system?.tradition) }),
    buttons, rejectClose: false,
  });
  if (!r || typeof r !== 'object') return false;
  const key = formulaKey(Number(r.f?.force?.value), String(r.f?.tradition?.value ?? ''), spellKey);
  if (r.how === 'find') {
    const through = await askFindThrough(actor);
    if (through === false) return false;
    return Boolean(await actor.findFromShop(key, { through }));
  }
  if (r.how === 'free') {
    const t = await resolveShopKey(key);
    if (!t) { ui.notifications?.warn?.(tx('SR2E.Notify.Shop.notInTheShopAny')); return false; }
    const made = await actor.createEmbeddedDocuments('Item', [foundry.utils.deepClone(t.data)]);
    return Boolean(made?.length);
  }
  return Boolean(await actor.buyFromShop(key));
}

/** Learn from one of the actor's formula items: the Force, up to the formula's. */
export async function learnFromFormulaDialog(actor: any, item: any): Promise<boolean> {
  if (!actor || !item || !isFormula(item.system)) return false;
  const f = item.system.formula;
  const top = formulaForce(f.force);
  const known: any = [...actor.items].find((i: any) => i.type === 'spell' && i.name === f.spell);
  const r: any = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Formula.learnTitle', { spell: f.spell }) },
    content: `<p>${tx('SR2E.Dialog.Formula.learnIntro', { spell: escHtml(f.spell), force: top })}${known ? ` ${tx('SR2E.Dialog.Formula.knownAt', { force: Number(known.system?.learnedForce ?? 0) })}` : ''}</p>
      <div class="form-group"><label>${tx('SR2E.Dialog.Formula.force')}</label><input name="force" type="number" value="${top}" min="1" max="${top}"></div>
      <p class="hint">${RULES.MAGIC_V56.learning.enabled ? tx('SR2E.Dialog.Formula.learnHintTest', { skill: escHtml(RULES.MAGIC_V56.learning.skill) }) : tx('SR2E.Dialog.Formula.learnHintPlain')}</p>`,
    ok: { label: tx('SR2E.Dialog.Formula.learn'), callback: (_e: Event, b: any) => ({ force: Number(b.form.elements.force?.value) }) },
    rejectClose: false,
  });
  if (!r) return false;
  return Boolean(await actor.learnFromFormula(item.id, r.force));
}

/** Who could teach this actor: other actors that know at least one spell (exported for the tests). */
export function teacherChoices(actor: any, actors: Iterable<any>): Array<{ value: string; label: string; force: number; fee: number }> {
  const out: Array<{ value: string; label: string; force: number; fee: number }> = [];
  for (const a of actors) {
    if (!a || a.uuid === actor?.uuid || !['character', 'npc', 'spirit'].includes(String(a.type))) continue;
    // Review (R8): only actors this user may see (a hidden NPC's spells stay hidden).
    if (typeof a.testUserPermission === 'function' && !a.testUserPermission(game.user, 'LIMITED')) continue;
    for (const s of [...(a.items ?? [])].filter((i: any) => i.type === 'spell')) {
      const force = Math.floor(Number(s.system?.learnedForce ?? 0)) || 0;
      if (force < 1) continue;
      out.push({ value: `${a.uuid}|${s.name}`, label: tx('SR2E.Dialog.Formula.teacherOption', { teacher: a.name, spell: s.name, force }), force, fee: teacherFee(1, Boolean(a.hasPlayerOwner)) });
    }
  }
  return out.sort((x, y) => x.label.localeCompare(y.label));
}

/** Learn from a teacher: pick the teacher and spell, and the Force (up to theirs). */
export async function learnFromTeacherDialog(actor: any): Promise<boolean> {
  if (!actor) return false;
  if (!teachersOn()) { ui.notifications?.warn?.(tx('SR2E.Notify.Formula.teachersOff')); return false; }
  const choices = teacherChoices(actor, (game as any).actors ?? []);
  if (!choices.length) { ui.notifications?.warn?.(tx('SR2E.Notify.Formula.noTeachers')); return false; }
  const opts = choices.map((c) => `<option value="${escHtml(c.value)}" data-force="${c.force}">${escHtml(c.label)}</option>`).join('');
  const r: any = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Formula.teacherTitle', { name: actor.name }) },
    content: `<div class="form-group"><label>${tx('SR2E.Dialog.Formula.teacher')}</label><select name="who">${opts}</select></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Formula.force')}</label><input name="force" type="number" value="1" min="1" max="12"></div>
      <p class="hint">${tx('SR2E.Dialog.Formula.teacherHint', { skill: RULES.CHARACTERS_V58.training.instructionSkill, sorcery: RULES.MAGIC_V56.learning.skill, fee: Number(RULES.FORMULA_V918.feePerForce).toLocaleString() })}</p>`,
    ok: { label: tx('SR2E.Dialog.Formula.teach'), callback: (_e: Event, b: any) => ({ who: String(b.form.elements.who?.value ?? ''), force: Number(b.form.elements.force?.value) }) },
    rejectClose: false,
  });
  if (!r?.who) return false;
  const bar = r.who.indexOf('|');
  if (bar < 0) return false;
  const res = await actor.learnFromTeacher(r.who.slice(0, bar), r.who.slice(bar + 1), formulaForce(r.force));
  return Boolean(res);
}
