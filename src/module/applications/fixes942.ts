/**
 * v0.94.2 (plan item 29, the small-fixes bundle): the Foundry glue.
 * - foldDiceOn(): the GM's world default for folded dice, unless this user chose their own (UI-11.5).
 * - "Add to combat…" in the Actors sidebar (GM): put actors in the tracker without tokens, for play without a map (8.1).
 * - "Clear my targets at the end of my turn" (a client setting, off by default; UI-9.4).
 */
import { SYSTEM } from '../config/system.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';
import { foldDiceFolded, addToCombatRows, turnWasMine } from '../rules/fixes942.ts';

/** Whether test cards fold their dice for this user. */
export function foldDiceOn(): boolean {
  const g: any = game as any;
  let stored: unknown = null;
  try { stored = g.settings?.storage?.get?.('client')?.getItem?.(`${SYSTEM.id}.foldDice`) ?? null; } catch { stored = null; }
  let world = true;
  try { world = g.settings.get(SYSTEM.id, 'foldDiceDefault') !== false; } catch { /* not registered */ }
  let mine = true;
  try { mine = g.settings.get(SYSTEM.id, 'foldDice') !== false; } catch { /* not registered */ }
  return foldDiceFolded(stored, world, mine);
}

/** The GM's "Add to combat" window: tick actors to put in the current combat (one is started if none) without tokens. */
export async function openAddToCombat(): Promise<number> {
  const g: any = game as any;
  if (!g.user?.isGM) return 0;
  const combat: any = g.combat ?? null;
  const inCombat = new Set<string>([...(combat?.combatants ?? [])].map((c: any) => String(c.actorId ?? '')).filter(Boolean));
  const rows = addToCombatRows([...(g.actors ?? [])].map((a: any) => ({ id: a.id, name: a.name, type: a.type, hasPlayerOwner: Boolean(a.hasPlayerOwner) })), inCombat);
  if (!rows.length) { ui.notifications?.info?.(tx('SR2E.Notify.Fixes942.nobodyToAdd')); return 0; }
  const DialogV2: any = (foundry as any).applications.api.DialogV2;
  const picked: string[] | null = await DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Fixes942.addToCombatTitle') },
    content: `<p class="hint">${tx('SR2E.Dialog.Fixes942.addToCombatHint')}</p><fieldset class="sr2e-add-combat">${rows.map((r) => `<label class="sr2e-check"><input type="checkbox" name="who" value="${escHtml(r.id)}" ${r.checked ? 'checked' : ''}> ${escHtml(r.name)}</label>`).join('')}</fieldset>`,
    ok: { label: tx('SR2E.Dialog.Fixes942.addToCombat'), callback: (_e: Event, b: any) => [...b.form.querySelectorAll('input[name="who"]:checked')].map((i: any) => String(i.value)) },
    rejectClose: false,
  });
  const ids = (picked ?? []).filter((id) => g.actors?.get?.(id) && !inCombat.has(id));
  if (!ids.length) return 0;
  let target: any = combat;
  if (!target) {
    const Combat: any = (foundry as any).utils?.getDocumentClass?.('Combat') ?? (globalThis as any).getDocumentClass?.('Combat') ?? (CONFIG as any).Combat?.documentClass;
    target = await Combat.create({ scene: (canvas as any)?.scene?.id ?? null, active: true });
  }
  if (!target) return 0;
  await target.createEmbeddedDocuments('Combatant', ids.map((id) => ({ actorId: id })));
  ui.notifications?.info?.(tx('SR2E.Notify.Fixes942.addedToCombat', { count: tCount(ids.length, 'SR2E.Count.actor') }));
  return ids.length;
}

/** Hooks: the Actors sidebar button, and clearing this user's targets when their combatant's turn ends. */
export function registerFixes942(): void {
  Hooks.on('renderActorDirectory', (_app: any, html: HTMLElement) => {
    try {
      if (!(game as any).user?.isGM) return;
      const root: HTMLElement = (html as any)?.querySelector ? html : (html as any)?.[0];
      if (!root || root.querySelector('[data-sr2e-action="addToCombat"]')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset['sr2eAction'] = 'addToCombat';
      btn.className = 'sr2e-add-to-combat';
      btn.innerHTML = `<i class="fa-solid fa-swords"></i> ${tx('SR2E.Dialog.Fixes942.addToCombatButton')}`;
      btn.addEventListener('click', (ev) => { ev.preventDefault(); void openAddToCombat(); });
      const anchor = root.querySelector('.directory-footer, footer') ?? root.querySelector('.directory-header, header');
      (anchor ?? root).appendChild(btn);
    } catch (err) { console.warn('sr2e | add-to-combat button', err); }
  });
  Hooks.on('combatTurnChange', (combat: any, prior: any) => {
    try {
      const g: any = game as any;
      if (g.settings.get(SYSTEM.id, 'clearTargetsEndTurn') !== true) return;
      const c: any = prior?.combatantId ? combat?.combatants?.get?.(prior.combatantId) : null;
      if (!c) return;
      const who = { isOwner: Boolean(c.actor?.isOwner ?? c.isOwner), hasPlayerOwner: Boolean(c.actor?.hasPlayerOwner ?? c.hasPlayerOwner) };
      if (!turnWasMine(who, Boolean(g.user?.isGM))) return;
      if (!(g.user?.targets?.size > 0)) return;
      if (typeof g.user?.updateTokenTargets === 'function') g.user.updateTokenTargets([]);
      else for (const t of [...(g.user?.targets ?? [])]) (t as any).setTarget?.(false, { releaseOthers: false });
    } catch (err) { console.warn('sr2e | clear targets', err); }
  });
}
