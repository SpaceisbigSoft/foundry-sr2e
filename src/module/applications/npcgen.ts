/**
 * The NPC generator window (v0.52.0): pick what to generate and a Threat Level (0–5), see a preview,
 * roll again until it fits, then Create (actors, tokens, a GM journal for organisations and jobs,
 * a contact on a character) or post it to the GMs. The rolling is in `rules/npcgen.ts`.
 */
import { SYSTEM } from '../config/system.ts';
import {
  RULES, makeRng, generateNpc, generateGroup, generateOrg, generateContact, generateSpirit, generateCritter, generateJob, generateNames,
  npcActorData, spiritActorData, critterActorData, hostActorData, planHtml, ARCHETYPES, GROUP_KINDS,
  type NpcPlan, type GroupPlan, type OrgPlan, type ContactPlan, type SpiritPlan, type JobPlan, type GroupKind,
  vehicleActorData,
} from '../rules/index.ts';
import { CONTACT_ROLES } from '../rules/npcdata.ts';
import { escHtml } from '../rules/html.ts';
import { t as tx, tCount } from '../helpers/i18n.ts';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export type GenKind = 'npc' | 'group' | 'org' | 'contact' | 'spirit' | 'critter' | 'job' | 'names';
type Plan = NpcPlan | GroupPlan | OrgPlan | ContactPlan | SpiritPlan | JobPlan | { kind: 'names'; list: ReturnType<typeof generateNames> };

/** v0.89.6: the labels are made when shown, in the user's language. */
export const GEN_KINDS: Array<{ id: GenKind; label: () => string }> = [
  { id: 'npc', label: () => tx('SR2E.App.Npcgen.aPerson') }, { id: 'group', label: () => tx('SR2E.App.Npcgen.aGroupGangSecurityTeam') }, { id: 'org', label: () => tx('SR2E.App.Npcgen.anOrganisationOrCorporation') },
  { id: 'contact', label: () => tx('SR2E.App.Npcgen.aContact') }, { id: 'spirit', label: () => tx('SR2E.App.Npcgen.aSpirit') }, { id: 'critter', label: () => tx('SR2E.App.Npcgen.aCritterAnimal') },
  { id: 'job', label: () => tx('SR2E.App.Npcgen.aFixersJob') }, { id: 'names', label: () => tx('SR2E.App.Npcgen.streetNamesAndDescriptions') },
];

/** The generator's choices (kept while the window is open and between openings). */
export interface GenState {
  kind: GenKind; threat: number; seed: number;
  archetype: string; metatype: string; magic: 'auto' | 'none' | 'yes';
  groupKind: GroupKind; oneSheet: boolean; corporation: 'random' | 'corp' | 'other';
  contactRole: string; contactFor: string; makeContactActor: boolean;
  spiritKind: 'random' | 'nature' | 'elemental'; critter: string; critterCount: number; names: number;
  tokens: boolean; hidden: boolean; moraleGroup: boolean; makePeople: boolean; makeHost: boolean;
}

export const DEFAULT_STATE: GenState = {
  kind: 'npc', threat: 2, seed: 1, archetype: '', metatype: 'random', magic: 'auto', groupKind: 'gang', oneSheet: true, corporation: 'random',
  contactRole: '', contactFor: '', makeContactActor: true, spiritKind: 'random', critter: '', critterCount: 1, names: 10,
  tokens: true, hidden: true, moraleGroup: true, makePeople: false, makeHost: false,
};

/** Roll the plan for the current choices (the same seed rolls the same result). */
export function planFor(s: GenState): Plan {
  const r = makeRng(s.seed);
  const t = s.threat;
  switch (s.kind) {
    case 'npc': return generateNpc({ threat: t, ...(s.archetype ? { archetype: s.archetype } : {}), metatype: s.metatype, magic: s.magic }, r);
    case 'group': return generateGroup({ threat: t, groupKind: s.groupKind, oneSheet: s.oneSheet, metatype: s.metatype }, r);
    case 'org': return generateOrg({ threat: t, ...(s.corporation === 'random' ? {} : { corporation: s.corporation === 'corp' }) }, r);
    case 'contact': return generateContact({ threat: t, ...(s.contactRole ? { roleId: s.contactRole } : {}) }, r);
    case 'spirit': return generateSpirit({ threat: t, ...(s.spiritKind === 'random' ? {} : { spiritKind: s.spiritKind }) }, r);
    case 'critter': return generateCritter({ threat: t, ...(s.critter ? { critter: s.critter } : {}), grunts: s.critterCount }, r);
    case 'job': return generateJob({ threat: t }, r);
    case 'names': return { kind: 'names', list: generateNames(s.names, r) };
    default: return generateNpc({ threat: t }, r);
  }
}

/** A kind the generator knows (anything else is a person). */
export const genKind = (k: unknown): GenKind => (GEN_KINDS.some((g) => g.id === k) ? (k as GenKind) : 'npc');

/** A-15: the shared escape helper (rules/html.ts). */
const esc = escHtml;

/** A plan's preview HTML (names as a table). */
export function previewHtml(p: Plan): string {
  if (p.kind === 'names') return `<table class="sr2e-group"><tr><th>${tx('SR2E.App.Npcgen.name')}</th><th>${tx('SR2E.App.Npcgen.streetName')}</th><th>${tx('SR2E.App.Npcgen.look')}</th></tr>${p.list.map((n) => `<tr><td>${esc(n.name)}</td><td>${esc(n.streetName)}</td><td>${esc(n.look)}</td></tr>`).join('')}</table>`;
  return planHtml(p);
}

/** What Create will make, in words. */
export function createSummary(p: Plan, s: GenState): string {
  const tok = s.tokens ? tx('SR2E.App.Npcgen.withTokensOnTheViewedScene') : '';
  switch (p.kind) {
    case 'npc': {
      const critter = p.archetype.startsWith('critter:');
      if (p.grunts > 1) return critter ? tx('SR2E.App.Npcgen.createsTheCritterActorGroup', { grunts: p.grunts, tok }) : tx('SR2E.App.Npcgen.createsTheNpcActorGroup', { grunts: p.grunts, tok });
      return critter ? tx('SR2E.App.Npcgen.createsTheCritterActor', { tok }) : tx('SR2E.App.Npcgen.createsTheNpcActor', { tok });
    }
    case 'group': return tx('SR2E.App.Npcgen.createsActorsTheLeader', { count: 2 + p.extras.length - 1 + (p.oneSheet ? 1 : p.grunts.length),
      members: p.oneSheet ? tx('SR2E.App.Npcgen.oneGruntGroupSheetFor', { grunts: p.grunts[0]?.grunts ?? 0 }) : tx('SR2E.App.Npcgen.members', { count: p.grunts.length }),
      extras: p.extras.length ? tCount(p.extras.length, 'SR2E.App.Npcgen.specialists') : '', tok, morale: s.tokens && s.moraleGroup ? tx('SR2E.App.Npcgen.groupedForMorale') : '' });
    case 'org': return s.makePeople ? (s.makeHost ? tx('SR2E.App.Npcgen.writesAGmJournalEntryPeopleHost') : tx('SR2E.App.Npcgen.writesAGmJournalEntryPeople')) : s.makeHost ? tx('SR2E.App.Npcgen.writesAGmJournalEntryHost') : tx('SR2E.App.Npcgen.writesAGmJournalEntry');
    case 'contact': return s.makeContactActor ? (s.contactFor ? tx('SR2E.App.Npcgen.createsTheContactsNpcActorAdds') : tx('SR2E.App.Npcgen.createsTheContactsNpcActor')) : s.contactFor ? tx('SR2E.App.Npcgen.makesNoActorAdds') : tx('SR2E.App.Npcgen.makesNoActor');
    case 'spirit': return tx('SR2E.App.Npcgen.createsTheSpiritActor', { tok });
    case 'job': return s.makePeople ? tx('SR2E.App.Npcgen.writesAGmJournalEntryJohnson') : tx('SR2E.App.Npcgen.writesAGmJournalEntry');
    case 'names': return tx('SR2E.App.Npcgen.postsTheListToTheGms');
  }
}

export class SR2NpcGenerator extends HandlebarsApplicationMixin(ApplicationV2) {
  static state: GenState = { ...DEFAULT_STATE, seed: Math.floor(Math.random() * 1e9) };
  static DEFAULT_OPTIONS: Record<string, any> = {
    id: 'sr2e-npc-generator',
    classes: ['sr2e', 'sr2e-npcgen'],
    window: { title: 'SR2E.Window.Npcgen.sr2eNpcGenerator', resizable: true, icon: 'fa-solid fa-user-plus' },
    position: { width: 620, height: 760 },
    actions: {
      reroll: SR2NpcGenerator.#onReroll,
      create: SR2NpcGenerator.#onCreate,
      postGm: SR2NpcGenerator.#onPostGm,
    },
  };
  static PARTS: Record<string, any> = { main: { template: `${SYSTEM.PATH.TEMPLATES}/npc-generator.hbs`, scrollable: [''] } };

  static #instance: SR2NpcGenerator | null = null;
  static open(kind?: GenKind): SR2NpcGenerator | null {
    if (!game.user?.isGM) { ui.notifications.warn(tx('SR2E.Notify.Npcgen.theNpcGeneratorIsForGms')); return null; }
    if (kind) SR2NpcGenerator.state.kind = genKind(kind);
    SR2NpcGenerator.#instance ??= new SR2NpcGenerator();
    void SR2NpcGenerator.#instance.render({ force: true });
    return SR2NpcGenerator.#instance;
  }

  #plan: Plan | null = null;

  async _prepareContext(_options: any): Promise<any> {
    const s = SR2NpcGenerator.state;
    const plan = planFor(s);
    this.#plan = plan;
    const sel = (list: Array<{ id: string; label: string }>, cur: string) => list.map((o) => ({ ...o, selected: o.id === cur }));
    const pcs = [...((game as any).actors ?? [])].filter((a: any) => a.type === 'character').map((a: any) => ({ id: a.uuid, label: a.name }));
    return {
      s, kinds: sel(GEN_KINDS.map((g) => ({ id: g.id, label: g.label() })), s.kind), is: { [s.kind]: true },
      threats: RULES.NPCGEN.threat.map((t, i) => ({ id: String(i), label: `${i}: ${t.label}`, selected: i === s.threat })),
      archetypes: sel([{ id: '', label: tx('SR2E.App.Npcgen.random') }, ...ARCHETYPES.map((a) => ({ id: a.id, label: a.label }))], s.archetype),
      metatypes: sel([{ id: 'random', label: tx('SR2E.App.Npcgen.random') }, ...Object.entries(RULES.METATYPES.types).map(([id, m]) => ({ id, label: m.label }))], s.metatype),
      magics: sel([{ id: 'auto', label: tx('SR2E.App.Npcgen.byRoleAndChance') }, { id: 'none', label: tx('SR2E.App.Npcgen.never') }, { id: 'yes', label: tx('SR2E.App.Npcgen.alwaysIfTheRoleAllows') }], s.magic),
      groupKinds: sel(GROUP_KINDS.map((g) => ({ id: g.id, label: g.label })), s.groupKind),
      corps: sel([{ id: 'random', label: tx('SR2E.App.Npcgen.random') }, { id: 'corp', label: tx('SR2E.App.Npcgen.aCorporation') }, { id: 'other', label: tx('SR2E.App.Npcgen.anotherKindOfOrganisation') }], s.corporation),
      roles: sel([{ id: '', label: tx('SR2E.App.Npcgen.random') }, ...CONTACT_ROLES.map((c) => ({ id: c.id, label: c.label }))], s.contactRole),
      pcs: sel([{ id: '', label: tx('SR2E.App.Npcgen.nobodyJustTheNpc') }, ...pcs], s.contactFor),
      spiritKinds: sel([{ id: 'random', label: tx('SR2E.App.Npcgen.random') }, { id: 'nature', label: tx('SR2E.App.Npcgen.natureSpirit') }, { id: 'elemental', label: tx('SR2E.App.Npcgen.elemental') }], s.spiritKind),
      critters: sel([{ id: '', label: tx('SR2E.App.Npcgen.byThreatLevel') }, { id: 'dog', label: tx('SR2E.App.Npcgen.guardDog') }, { id: 'wolf', label: tx('SR2E.App.Npcgen.wolf') }, { id: 'cat', label: tx('SR2E.App.Npcgen.bigCat') }, { id: 'bear', label: tx('SR2E.App.Npcgen.bear') }, { id: 'awakenedWolf', label: tx('SR2E.App.Npcgen.awakenedWolf') }], s.critter),
      preview: previewHtml(plan),
      summary: createSummary(plan, s),
      scene: (game as any).scenes?.viewed?.name ?? '',
    };
  }

  async _onRender(context: any, options: any): Promise<void> {
    await (super._onRender as any)?.(context, options);
    const root: HTMLElement = (this as any).element;
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-gen]').forEach((el) => el.addEventListener('change', () => {
      const k = el.dataset['gen'] as keyof GenState;
      if (k === 'kind') { SR2NpcGenerator.state.kind = genKind(el.value); void this.render(); return; }
      const v: any = (el as HTMLInputElement).type === 'checkbox' ? (el as HTMLInputElement).checked
        : ['threat', 'critterCount', 'names'].includes(k) ? Math.floor(Number(el.value) || 0) : el.value;
      (SR2NpcGenerator.state as any)[k] = k === 'threat' ? Math.max(0, Math.min(5, v)) : k === 'critterCount' ? Math.max(1, Math.min(RULES.GRUNTS.maxSize, v)) : k === 'names' ? Math.max(1, Math.min(50, v)) : v;
      void this.render();
    }));
  }

  static #onReroll(this: SR2NpcGenerator) {
    SR2NpcGenerator.state.seed = Math.floor(Math.random() * 1e9);
    void this.render();
  }

  static async #onPostGm(this: SR2NpcGenerator) {
    const plan = this.#plan ?? planFor(SR2NpcGenerator.state);
    const gms = [...((game as any).users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);
    await ChatMessage.create({ speaker: { alias: tx('SR2E.Card.Npcgen.npcGenerator') }, whisper: gms, content: `<div class="sr2e-npcgen-card">${previewHtml(plan)}</div>` });
  }

  static #busy = false;
  static async #onCreate(this: SR2NpcGenerator) {
    // One Create at a time (a double-click would make everything twice).
    if (SR2NpcGenerator.#busy) return;
    SR2NpcGenerator.#busy = true;
    const plan = this.#plan ?? planFor(SR2NpcGenerator.state);
    try {
      const made = await createFromPlan(plan, SR2NpcGenerator.state);
      ui.notifications.info(escHtml(made));
      // A fresh roll for the next one.
      SR2NpcGenerator.state.seed = Math.floor(Math.random() * 1e9);
      void this.render();
    } catch (err) {
      console.error('sr2e | NPC generator', err);
      ui.notifications.error(tx('SR2E.Notify.Npcgen.couldNotCreateIt', { errMessage: escHtml((err as Error)?.message ?? err) }));
    } finally { SR2NpcGenerator.#busy = false; }
  }
}

// ---------------------------------------------------------------- Creating

/** The "Generated" actor folder (made once, even when two creates ask at the same moment). */
const folderMaking = new Map<string, Promise<string | null>>();
function folder(type: 'Actor' | 'JournalEntry'): Promise<string | null> {
  const name = 'Generated (SR2e)';
  const existing = [...((game as any).folders ?? [])].find((f: any) => f.type === type && f.name === name);
  if (existing) return Promise.resolve(existing.id);
  if (!folderMaking.has(type)) {
    folderMaking.set(type, (async () => {
      try { const f = await (globalThis as any).Folder.create({ name, type, color: '#7a2f2f' }); return f?.id ?? null; } catch { return null; } finally { folderMaking.delete(type); }
    })());
  }
  return folderMaking.get(type)!;
}

/** Create actors (with items), then optionally place their tokens around the view's centre. */
async function makeActors(list: Array<{ actor: any; items?: any[] }>, s: GenState): Promise<any[]> {
  const fid = await folder('Actor');
  const data = list.map((x) => ({ ...x.actor, ...(x.items ? { items: x.items } : {}), ...(fid ? { folder: fid } : {}) }));
  const actors: any[] = (await (CONFIG.Actor.documentClass as any).createDocuments(data)) ?? [];
  if (s.tokens && actors.length) await placeTokens(actors, s);
  return actors;
}

async function placeTokens(actors: any[], s: GenState): Promise<void> {
  const scene: any = (canvas as any)?.scene;
  if (!scene) return;
  const grid = Number(scene.grid?.size ?? 100);
  const centre = (canvas as any).stage?.pivot ?? { x: (scene.dimensions?.width ?? 2000) / 2, y: (scene.dimensions?.height ?? 2000) / 2 };
  const per = Math.ceil(Math.sqrt(actors.length));
  const docs: any[] = [];
  for (const [i, a] of actors.entries()) {
    let x = Math.round(centre.x + ((i % per) - (per - 1) / 2) * grid - grid / 2);
    let y = Math.round(centre.y + (Math.floor(i / per) - (per - 1) / 2) * grid - grid / 2);
    // On the grid's squares (gridless scenes keep the point).
    try { const snapped = scene.grid?.getSnappedPoint?.({ x, y }, { mode: (globalThis as any).CONST?.GRID_SNAPPING_MODES?.TOP_LEFT_VERTEX ?? 16 }); if (snapped) ({ x, y } = snapped); } catch { /* old API */ }
    // Hidden by default: the GM reveals the opposition when the players see it.
    docs.push({ ...(await a.getTokenDocument({ x, y })).toObject(), hidden: Boolean(s.hidden) });
  }
  const toks: any[] = (await scene.createEmbeddedDocuments('Token', docs)) ?? [];
  if (s.moraleGroup && toks.length > 1) {
    // The person being guarded is not part of the guards' morale.
    const people = toks.filter((t: any) => ['npc', 'character'].includes(t.actor?.type) && !/principal/i.test(String(t.actor?.flags?.sr2e?.generated?.role ?? '')));
    if (people.length > 1) { try { await (CONFIG.Actor.documentClass as any).setMoraleGroup(people, true); } catch { /* no morale groups */ } }
  }
}

async function journal(name: string, html: string): Promise<any> {
  const fid = await folder('JournalEntry');
  const J: any = (globalThis as any).JournalEntry;
  return J.create({ name, ...(fid ? { folder: fid } : {}), ownership: { default: 0 }, pages: [{ name, type: 'text', text: { content: html, format: 1 } }] });
}

/**
 * v0.61.0: a rigger's vehicles and drones (from the plan): created as actors next to them (named after the rigger),
 * drones subscribed to the rigger's remote control deck. `made` are the actors created for `plans` (matched by name).
 */
async function rigVehicles(pairs: Array<{ plan: NpcPlan; name: string }>, made: any[], s: GenState): Promise<number> {
  let n = 0;
  const used = new Set<string>();
  for (const { plan, name } of pairs) {
    if (!plan.vehicles?.length) continue;
    const rigger = made.find((a: any) => a?.name === name && !used.has(a.id));
    if (!rigger) continue;
    used.add(rigger.id);
    const vs = await makeActors(plan.vehicles.map((v) => { const d = vehicleActorData(v); return { actor: { ...d, name: `${d.name} (${plan.name})`, ownership: { ...(rigger.ownership ?? {}) } } }; }), s);
    n += vs.length;
    const drones = vs.filter((a: any) => a?.system?.drone).map((a: any) => a.uuid);
    if (drones.length) {
      try {
        // The remote control deck must hold them all (RULES.RIGGING.remote.dronesPerRating per point).
        const per = Math.max(1, Number(RULES.RIGGING.remote.dronesPerRating ?? 2));
        const need = Math.ceil(drones.length / per);
        const rcd: any = [...(rigger.items ?? [])].find((i: any) => i.type === 'gear' && Number(i.system?.rcdRating ?? 0) > 0);
        if (rcd && Number(rcd.system.rcdRating) < need) await rcd.update({ 'system.rcdRating': need });
        await rigger.update({ 'system.rigging.subscribed': drones });
      } catch (err) { console.warn('sr2e | subscribe drones', err); }
    }
  }
  return n;
}

/** Make what the plan describes; returns a one-line summary. */
export async function createFromPlan(p: Plan, s: GenState): Promise<string> {
  switch (p.kind) {
    case 'npc': {
      const d = actorDataFor(p);
      const a = await makeActors([d], s);
      const v = await rigVehicles([{ plan: p, name: d.actor.name }], a, s);
      return v ? tCount(v, 'SR2E.Card.Npcgen.createdAndVehicles', { name: a[0]?.name ?? p.name }) : tx('SR2E.Card.Npcgen.created', { name: a[0]?.name ?? p.name });
    }
    case 'group': {
      const plans = [p.leader, ...p.grunts, ...p.extras];
      const list = plans.map(npcActorData);
      for (const x of list) if (!x.actor.name.startsWith(p.name)) x.actor.name = `${x.actor.name} (${p.name})`;
      const a = await makeActors(list, s);
      const v = await rigVehicles(plans.map((pl, i) => ({ plan: pl, name: list[i]!.actor.name })), a, s);
      return tx('SR2E.Card.Npcgen.createdActorsFor', { length: a.length, name: p.name, part: v ? tCount(v, 'SR2E.Card.Npcgen.andVehicles2') : '' });
    }
    case 'org': {
      await journal(p.name, previewHtml(p));
      if (s.makePeople) await makeActors(p.people.map(npcActorData), { ...s, tokens: false });
      if (s.makeHost) {
        const fid = await folder('Actor');
        await (CONFIG.Actor.documentClass as any).create({ ...hostActorData(p), ...(fid ? { folder: fid } : {}) });
      }
      return s.makePeople ? (s.makeHost ? tx('SR2E.Card.Npcgen.wroteTheJournalEntryForPeopleAndHost', { name: p.name }) : tx('SR2E.Card.Npcgen.wroteTheJournalEntryForPeople', { name: p.name })) : s.makeHost ? tx('SR2E.Card.Npcgen.wroteTheJournalEntryForHost', { name: p.name }) : tx('SR2E.Card.Npcgen.wroteTheJournalEntryFor', { name: p.name });
    }
    case 'contact': {
      if (s.makeContactActor) await makeActors([npcActorData(p.npc)], { ...s, tokens: false });
      const pc: any = s.contactFor ? await fromUuid(s.contactFor) : null;
      if (pc) {
        const id = (foundry as any).utils.randomID();
        const entry = { id, name: p.npc.name, level: p.level, role: p.role, notes: p.npc.description, loyalty: p.loyalty, skills: p.skills, fee: p.fee, dice: 0, favours: 0 };
        await pc.update({ 'system.contacts': [...(pc.system.contacts ?? []), entry] });
      }
      return `${s.makeContactActor ? tx('SR2E.Card.Npcgen.created2', { npcName: p.npc.name }) : p.npc.name}${pc ? tx('SR2E.Card.Npcgen.nowAContactOf', { pcName: pc.name }) : ''}.`;
    }
    case 'spirit': {
      // A spirit template of that type (one the GM keeps, with its powers) lends its adjustments and powers.
      const data: any = spiritActorData(p);
      const tpl: any = (CONFIG.Actor.documentClass as any).spiritTemplateFor?.(p.spiritType);
      const items = tpl ? [...(tpl.items ?? [])].filter((i: any) => i.type === 'power').map((i: any) => { const o = i.toObject(); delete o._id; return o; }) : [];
      if (tpl) data.actor.system.offsets = { ...(tpl.system?.offsets ?? {}) };
      const a = await makeActors([{ actor: data.actor, items }], s);
      return tpl ? tx('SR2E.Card.Npcgen.createdWithPowers', { name: a[0]?.name ?? p.name, tplName: tpl.name }) : tx('SR2E.Card.Npcgen.createdNoPowers', { name: a[0]?.name ?? p.name });
    }
    case 'job': {
      await journal(p.title, previewHtml(p));
      if (s.makePeople) {
        await makeActors([npcActorData(p.johnson)], { ...s, tokens: false });
        const g = p.opposition;
        await makeActors([npcActorData(g.leader), ...g.grunts.map(npcActorData), ...g.extras.map(npcActorData)].map((x) => ({ ...x, actor: { ...x.actor, name: `${x.actor.name} (${g.name})` } })), { ...s, tokens: false });
      }
      return s.makePeople ? tx('SR2E.Card.Npcgen.wroteTheJobAndPeople', { title: p.title }) : tx('SR2E.Card.Npcgen.wroteTheJob', { title: p.title });
    }
    case 'names': {
      const gms = [...((game as any).users ?? [])].filter((u: any) => u.isGM).map((u: any) => u.id);
      await ChatMessage.create({ speaker: { alias: tx('SR2E.Card.Npcgen.npcGenerator') }, whisper: gms, content: previewHtml(p) });
      return tx('SR2E.Card.Npcgen.postedTheNamesToTheGms');
    }
  }
  return '';
}

/** A critter plan is an npc plan made by generateCritter (its archetype starts with "critter:"). */
export function actorDataFor(p: NpcPlan) { return p.archetype.startsWith('critter:') ? critterActorData(p) : npcActorData(p); }
