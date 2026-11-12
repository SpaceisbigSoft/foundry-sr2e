/**
 * v0.92.2 (RULES.CLOCK_V922, the owner's choice, 12 Nov 2026): a big jump of world time outside combat. The lead GM is
 * asked whether it counts as time passed or only changes the date (the system's clock keeps its whole days off). The
 * system's ticks wait for the answer (they run in the same queue, after it).
 */
import { SYSTEM } from '../config/system.ts';
import { RULES, isBigJump, nextClock, undoesLast, describeSpan, wholeDays } from '../rules/index.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx } from '../helpers/i18n.ts';
import { CLOCK_SETTING, clockState } from '../helpers/clock.ts';
import { isLeadGm } from './leader.ts';

/** The GM's answer (closing the window keeps the date only: nothing comes due by surprise). */
async function askGm(dt: number): Promise<'date' | 'count'> {
  try {
    const r = await (foundry as any).applications.api.DialogV2.wait({
      window: { title: tx('SR2E.Dialog.Clock.bigJumpTitle') },
      content: `<p>${tx('SR2E.Dialog.Clock.bigJumpBody', { span: escHtml(describeSpan(Math.abs(dt))), way: dt < 0 ? tx('SR2E.Dialog.Clock.back') : tx('SR2E.Dialog.Clock.forward') })}</p><p>${tx('SR2E.Dialog.Clock.bigJumpHint')}</p>`,
      buttons: [
        { action: 'date', label: tx('SR2E.Dialog.Clock.dateOnly'), default: true },
        { action: 'count', label: tx('SR2E.Dialog.Clock.countIt') },
      ],
      rejectClose: false,
    });
    return r === 'count' ? 'count' : 'date';
  } catch { return 'date'; }
}

/**
 * Settle a change of world time before the system's ticks run (call inside the tick queue). Returns when the clock
 * state is stored; only the lead GM asks and stores, everyone else returns at once.
 */
export async function settleClock(worldTime: number, dt: number, options: any): Promise<void> {
  if (!(game as any).user?.isGM || !isLeadGm()) return;
  const to = Number(worldTime ?? 0);
  const from = to - Number(dt ?? 0);
  const state = clockState();
  // The same jump back as the last date-only one (an undo, or the GM putting the date back) takes its days off again.
  if (undoesLast(state, from, to)) { await (game as any).settings.set(SYSTEM.id, CLOCK_SETTING, nextClock(state, from, to, 'count')); return; }
  const inCombat = Boolean((game as any).combat?.started);
  if (!isBigJump(dt, { inCombat, marked: options?.sr2eTime === 'count' }, RULES.CLOCK_V922)) return;
  const answer = await askGm(dt);
  const next = nextClock(state, from, to, answer);
  if (next.offset !== state.offset || answer === 'date') await (game as any).settings.set(SYSTEM.id, CLOCK_SETTING, next);
  const gms = [...((game as any).users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);
  await (globalThis as any).ChatMessage?.create?.({ whisper: gms, speaker: { alias: tx('SR2E.Card.Clock.alias') },
    content: `<p>${answer === 'date'
      ? tx('SR2E.Card.Clock.dateOnly', { span: escHtml(describeSpan(Math.abs(wholeDays(dt)))) })
      : tx('SR2E.Card.Clock.counted', { span: escHtml(describeSpan(Math.abs(dt))) })}</p>` });
}
