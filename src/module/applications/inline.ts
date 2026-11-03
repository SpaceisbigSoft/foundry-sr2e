/**
 * v0.60.0: inline success tests. `@SR2Test[spec]{label}` in journals, item descriptions and chat
 * renders a link that rolls the test (shift-click skips the dialog); `/sr2 spec` (or `/sr2e`) in
 * chat rolls it for the speaker. The spec grammar lives in rules/inlinetest.ts.
 */
import {
  parseInlineTest, inlineTestLabel, inlineTestSummary, inlineTestSubject, matchInlineSkill, chatCommandSpec,
  signedText, INLINE_TEST_PATTERN, inlineTestUsage, ROLLABLE_ATTRIBUTES, type InlineTest,
} from '../rules/inlinetest.ts';
import { successTest, noticeTest, guessSkillAttribute, type TargetNumberModifier, type SuccessTestResult } from '../rules/index.ts';
import { withRollMode } from '../documents/index.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

let registered = false;

/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;

/** Enriched source is HTML: undo the entities an editor puts in a spec (quotes, ampersands, spaces). */
function unescapeSpec(t: string): string {
  return t.replace(/&nbsp;|&#160;/g, ' ').replace(/&quot;|&#34;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** The link for one `@SR2Test[...]` (a marked-up span when the spec can't be read). */
export function inlineTestElement(spec: string, label?: string | null): HTMLElement {
  const raw = unescapeSpec(spec).trim();
  const custom = label ? unescapeSpec(label).trim() : '';
  const invalid = (why: string): HTMLElement => {
    const bad = document.createElement('span');
    bad.className = 'sr2e-inline-test sr2e-inline-invalid';
    bad.title = why;
    bad.textContent = custom || `@SR2Test[${raw}]`;
    return bad;
  };
  // v0.81.1 (RC2-5): no spec may break an enrichment (`@SR2Test[constructor]` threw in the label code, on every client
  // that rendered the message or page): anything that fails is shown as an unreadable test.
  try {
    const parsed = parseInlineTest(raw);
    if (typeof parsed === 'string') return invalid(parsed);
    const title = tx('SR2E.App.Inline.clickToRollShiftClickTo', { summary: inlineTestSummary(parsed) });
    const text = custom || inlineTestLabel(parsed);
    if (typeof title !== 'string' || typeof text !== 'string') return invalid(tx('SR2E.App.Inline.thatTestCantBeRead'));
    const a = document.createElement('a');
    a.className = 'sr2e-inline-test';
    a.dataset['spec'] = raw;
    if (custom) a.dataset['label'] = custom;
    a.title = title;
    a.setAttribute('role', 'button');
    a.innerHTML = '<i class="fa-solid fa-dice-six"></i> ';
    a.append(document.createTextNode(text));
    return a;
  } catch (err) {
    console.warn('sr2e | inline test', raw, err);
    return invalid(tx('SR2E.App.Inline.thatTestCantBeRead'));
  }
}


/** Who rolls a clicked test: the first controlled token's actor (if owned), else the user's character. */
function rollingActor(): any | null {
  const a = canvas?.tokens?.controlled?.[0]?.actor ?? null;
  if (a?.isOwner) return a;
  return game.user?.character ?? null;
}

/** Who rolls a `/sr2` command: the chat speaker (if owned), else as for a click. */
function speakerActor(chatData: any): any | null {
  try {
    const a = chatData?.speaker ? ChatMessage.getSpeakerActor?.(chatData.speaker) : null;
    if (a?.isOwner) return a;
  } catch { /* no speaker */ }
  return rollingActor();
}

/** TN, modifier and pool dice, with the spec's values filled in. Null when cancelled. */
async function confirmTest(t: InlineTest, actor: any): Promise<{ tn: number; mod: number; pool: number } | null> {
  const poolLeft = actor && (t.kind === 'attribute' || t.kind === 'skill') ? Number(actor.system?.derived?.combatPoolLeft ?? 0) : 0;
  const showPool = t.kind === 'dice' || poolLeft > 0 || t.pool > 0;
  const r = await foundry.applications.api.DialogV2.prompt({
    window: { title: tx('SR2E.Dialog.Inline.roll2', { inlineTestLabel: inlineTestLabel(t) }) },
    content: `<p>${esc(actor ? `${actor.name}: ` : '')}${esc(inlineTestSubject(t))}</p>
      <div class="form-group"><label>${tx('SR2E.Dialog.Inline.targetNumber')}</label><input name="tn" type="number" value="${t.tn}" min="1" max="99" autofocus></div>
      <div class="form-group"><label>${tx('SR2E.Dialog.Inline.tnModifier')}</label><input name="mod" type="number" value="${t.mod}"></div>
      ${showPool ? `<div class="form-group"><label>${t.kind === 'dice' ? tx('SR2E.Dialog.Inline.extraDice') : tx('SR2E.Dialog.Inline.combatPoolDiceLeft', { poolLeft })}</label><input name="pool" type="number" value="${t.pool}" min="0"></div>` : ''}`,
    ok: { label: tx('SR2E.Dialog.Inline.roll'), callback: (_e: Event, b: any) => { const el = b.form.elements; return { tn: Number(el.tn.value) || t.tn, mod: Number(el.mod.value) || 0, pool: el.pool ? Math.max(0, Number(el.pool.value) || 0) : t.pool }; } },
    rejectClose: false,
  });
  return r && typeof r === 'object' ? r as { tn: number; mod: number; pool: number } : null;
}

function foundryDice(sink: any[]): (count: number) => Promise<number[]> {
  return async (count: number) => {
    const roll = await new Roll(`${count}d6`).evaluate();
    sink.push(roll);
    return roll.dice[0].results.map((r: any) => r.result as number);
  };
}

/** A plain card (a bare number of dice, or a derived attribute): no Karma buttons. */
async function plainTest(actor: any | null, label: string, dice: number, tn: number, modifiers: TargetNumberModifier[], extra: number): Promise<SuccessTestResult> {
  const rolls: any[] = [];
  // v0.70.0: a bare number's "pool N" is extra dice, not a dice pool: rolled as ordinary dice (before, the card counted
  // them as pool dice that no pool paid for). Attribute and skill tests spend the real Combat Pool through the actor.
  const r = await successTest({ dice: dice + Math.max(0, Math.floor(Number(extra) || 0)), poolDice: 0, targetNumber: tn, modifiers, roll: foundryDice(rolls) });
  const mods = esc(r.modifiers.map((m) => `${m.label} ${signedText(m.value)}`).join(', '));
  const breakdown = tx('SR2E.Card.Inline.base', { baseTargetNumber: r.baseTargetNumber, part: mods ? `; ${mods}` : '', part2: r.targetNumberClamped ? tx('SR2E.Card.Inline.tnMinimum2') : '' });
  const faces = r.dice.map((d) => `<span class="sr2e-die ${d.success ? 'hit' : 'miss'}">${esc(d.faces.join('+'))}${d.faces.length > 1 ? `=${d.total}` : ''}</span>`).join(' ');
  const outcome = r.botch ? `<strong class="sr2e-botch">${tx('SR2E.Card.Inline.disasterEveryDieIsA1')}</strong>` : `<strong>${tCount(r.successes, 'SR2E.Card.Inline.successes')}</strong>`;
  const banner = r.botch ? `<div class="sr2e-banner sr2e-banner-disaster">${tx('SR2E.Card.Inline.disaster')}</div>`
    : r.successes > 0 ? `<div class="sr2e-banner sr2e-banner-ok">${tx('SR2E.Card.Inline.success', { successes: r.successes })}</div>` : `<div class="sr2e-banner sr2e-banner-miss">${tx('SR2E.Card.Inline.failed')}</div>`;
  await ChatMessage.create(withRollMode({
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker(),
    rolls,
    flags: { sr2e: { privacyKind: 'plain' } },
    content: `${banner}<div class="sr2e-roll">
      <h3>${esc(label)}</h3>
      ${r.botch ? `<div class="sr2e-count sr2e-count-botch"><b>✕</b><span>${tx('SR2E.Card.Inline.disaster2')}</span></div>` : `<div class="sr2e-count"><b>${r.successes}</b><span>${tCount(r.successes, 'SR2E.Card.Inline.successes2')}</span></div>`}
      <details class="sr2e-fold"><summary title="${tx('SR2E.Card.Inline.tn', { breakdown })}">${tx('SR2E.Card.Inline.diceVsTn', { totalDice: r.totalDice })} <strong>${r.targetNumber}</strong><span class="sr2e-sum-out"> · ${outcome}</span></summary>
      ${mods || r.targetNumberClamped ? `<p class="sr2e-breakdown"><em>${breakdown}</em></p>` : ''}
      <p class="sr2e-dice">${faces || `<em>${tx('SR2E.Card.Inline.noDice')}</em>`}</p></details>
    </div>`,
  }));
  return r;
}

/** A skill stand-in rated 0, so `rollSkill` defaults to the linked attribute (+4 TN). */
function defaultingSkill(name: string): any {
  return { id: null, name, type: 'skill', system: { rating: 0, attribute: guessSkillAttribute(name), specialization: '', specializationRating: 0, kind: 'active' } };
}

/**
 * Roll a parsed inline test. `quick` skips the TN dialog; `label` overrides the card's label.
 * Attribute and skill tests go through the actor's own methods, so they get normal SR2 cards.
 */
export async function rollInlineTest(test: InlineTest, o: { actor: any | null; quick?: boolean; label?: string | null }): Promise<SuccessTestResult | null> {
  const t: InlineTest = { ...test, ...(o.label?.trim() ? { label: o.label.trim() } : {}) };
  const actor = o.actor;
  if (!actor && t.kind !== 'dice') {
    ui.notifications?.warn?.(tx('SR2E.Notify.Inline.selectATokenYouOwnOr', { inlineTestSummary: escHtml(inlineTestSummary(t)) }));
    return null;
  }
  const c = o.quick ? { tn: t.tn, mod: t.mod, pool: t.pool } : await confirmTest(t, actor);
  if (!c) return null;
  const mods: TargetNumberModifier[] = c.mod ? [{ id: 'modifier', label: tx('SR2E.Card.Mod.modifier'), value: c.mod }] : [];
  const label = t.label?.trim() || null;

  if (t.kind === 'dice') {
    return plainTest(actor, label ?? tCount(t.dice, 'SR2E.Card.Inline.dice'), t.dice, c.tn, mods, c.pool);
  }
  if (t.kind === 'attribute') {
    if (ROLLABLE_ATTRIBUTES.includes(t.attribute)) {
      // v0.81.1 (D1-10, FX-DOC wiring): a resistance roll ("… to resist …") isn't blocked by an exclusive spell.
      return actor.rollAttribute(t.attribute, { targetNumber: c.tn, modifiers: mods, ...(label ? { label } : {}), ...(c.pool ? { poolDice: c.pool } : {}), ...(/\bresist/i.test(String(label ?? '')) ? { resist: true } : {}) });
    }
    // Reaction, Magic and Essence: no actor test for them; the actor's usual penalties still count.
    const value = t.attribute === 'reaction' ? actor.system?.derived?.reaction : t.attribute === 'magic' ? actor.system?.derived?.magic : actor.system?.derived?.essence;
    const dice = Math.max(0, Math.floor(Number(value ?? 0)));
    const auto: TargetNumberModifier[] = (() => { try { return actor.previewModifiers?.() ?? []; } catch { return []; } })();
    return plainTest(actor, label ?? `${inlineTestSubject(t)} ${dice}`, dice, c.tn, [...auto, ...mods], 0);
  }
  if (t.kind === 'perception') {
    // notice() sets its own base TN; the spec's TN is a shift from it.
    const base = noticeTest({ intelligence: 0 }).tn;
    const shift: TargetNumberModifier[] = c.tn !== base ? [{ label: tx('SR2E.Card.Mod.targetNumber', { tn: c.tn }), value: c.tn - base }] : [];
    if (typeof actor.notice !== 'function') { ui.notifications?.warn?.(tx('SR2E.Notify.Inline.canTMakeAPerceptionTest', { actorName: escHtml(actor.name) })); return null; }
    return actor.notice({ modifiers: [...shift, ...mods], ...(label ? { what: label } : {}) });
  }

  // A skill: the actor's skill items by name (or specialization), then skillsofts and possession.
  const items = [...(actor.items ?? [])].filter((i: any) => i.type === 'skill');
  const match = matchInlineSkill(items, t, (i: any) => ({ name: String(i.name ?? ''), specialization: i.system?.specialization ?? '', specializationRating: Number(i.system?.specializationRating ?? 0) }));
  let skill: any = match?.skill ?? null;
  const useSpecialization = Boolean(match?.useSpecialization);
  if (!skill) skill = actor.findSkill?.(t.specialization ? `${t.skill} (${t.specialization})` : t.skill) ?? actor.findSkill?.(t.skill) ?? null;
  if (!skill) {
    const attr = guessSkillAttribute(t.skill);
    const yes = await foundry.applications.api.DialogV2.confirm({
      window: { title: tx('SR2E.Dialog.Inline.noSkill', { skill: t.skill }) },
      content: `<p>${tx('SR2E.Dialog.Inline.hasNoSkillDefaultTo4', { actorName: esc(actor.name), skill: esc(t.skill), value: esc(attr.charAt(0).toUpperCase() + attr.slice(1)) })}</p>`,
      rejectClose: false,
    }).catch(() => false);
    if (!yes) { ui.notifications?.warn?.(tx('SR2E.Notify.Inline.hasNoSkill', { actorName: escHtml(actor.name), tSkill: escHtml(t.skill) })); return null; }
    skill = defaultingSkill(t.skill);
  } else if (match?.specializationMissing && t.specialization) {
    ui.notifications?.info?.(tx('SR2E.Notify.Inline.hasNoSpecializationInRollingThe', { actorName: escHtml(actor.name), tSpecialization: escHtml(t.specialization), skillName: escHtml(skill.name) }));
  }
  return actor.rollSkill(skill, { targetNumber: c.tn, modifiers: mods, useSpecialization, ...(label ? { label } : {}), ...(c.pool ? { poolDice: c.pool } : {}) });
}

/** Parse and roll a spec; warns (with the usage line) and returns null when it can't be read. */
export async function rollInlineSpec(spec: string, o: { actor: any | null; quick?: boolean; label?: string | null }): Promise<SuccessTestResult | null> {
  const parsed = parseInlineTest(spec);
  if (typeof parsed === 'string') {
    ui.notifications?.warn?.(`${escHtml(parsed)} ${escHtml(inlineTestUsage())}`);
    return null;
  }
  return rollInlineTest(parsed, o);
}

async function onClick(ev: MouseEvent): Promise<void> {
  const el = (ev.target as Element | null)?.closest?.('a.sr2e-inline-test') as HTMLElement | null;
  if (!el) return;
  ev.preventDefault();
  ev.stopPropagation();
  const spec = el.dataset['spec'] ?? '';
  if (!spec) return;
  // v0.81.1 round 2 (FIX2-BRIEF D): a link in anyone's message rolls for the clicker's own character (rollingActor),
  // its spec bounded by the parser; it can't target or write anyone else's document. A full-screen invisible link is
  // stopped by the chat style filter (chat.ts stripCardStyles).
  try {
    await rollInlineSpec(spec, { actor: rollingActor(), quick: ev.shiftKey, label: el.dataset['label'] ?? null });
  } catch (err) {
    console.error('sr2e | inline test failed', err);
    ui.notifications?.error?.(tx('SR2E.Notify.Inline.theTestFailed', { errMessage: escHtml((err as Error)?.message ?? err) }));
  }
}

/** Add the `@SR2Test` enricher, the click listener and the `/sr2` chat command (once, at init). */
export function registerInlineTests(): void {
  if (registered) return;
  registered = true;

  CONFIG.TextEditor ??= {};
  CONFIG.TextEditor.enrichers ??= [];
  CONFIG.TextEditor.enrichers.push({
    id: 'sr2eInlineTest',
    pattern: new RegExp(INLINE_TEST_PATTERN.source, INLINE_TEST_PATTERN.flags),
    enricher: async (match: RegExpMatchArray, _options: any) => inlineTestElement(match[1] ?? '', match[2] ?? null),
  });

  document.addEventListener('click', (ev) => { void onClick(ev); });

  Hooks.on('chatMessage', (_chatLog: any, message: string, chatData: any) => {
    const spec = chatCommandSpec(message);
    if (spec === null) return true;
    if (!spec) { ui.notifications?.warn?.(escHtml(inlineTestUsage())); return false; }
    const parsed = parseInlineTest(spec);
    if (typeof parsed === 'string') { ui.notifications?.warn?.(`${escHtml(parsed)} ${escHtml(inlineTestUsage())}`); return false; }
    void rollInlineTest(parsed, { actor: speakerActor(chatData), quick: true }).catch((err) => {
      console.error('sr2e | /sr2 failed', err);
      ui.notifications?.error?.(tx('SR2E.Notify.Inline.theTestFailed', { errMessage: escHtml((err as Error)?.message ?? err) }));
    });
    return false;
  });
}
