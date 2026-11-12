/**
 * v0.60.0: native Token Action HUD (Core 2.x) support. Pure: the HUD's layout and groups, and the action
 * list for a plain summary of an actor. The Foundry glue (applications/tah.ts) builds the summary, turns
 * each entry into a TAH action and runs it on click. No Foundry globals here.
 */
import { t as tx, tKey } from '../helpers/i18n.ts';
import { isCarried } from './tweaks.ts';

/** Subgroup ids (distinct from the top-level tab ids, so TAH's id lookups never hit a tab). */
export type HudGroupId =
  | 'stats' | 'tests'
  | 'activeSkills' | 'knowledgeSkills' | 'languageSkills'
  | 'weapons' | 'combatActions'
  | 'spells' | 'critterPowers' | 'adeptPowers' | 'astral'
  | 'matrixActions'
  | 'riggingActions' | 'mountedWeapons'
  | 'utilityActions';

/**
 * What a click does.
 * - sheet: run an action of the actor's sheet (payload.action, payload.dataset; payload.itemId opens the
 *   item's sheet on right-click; payload.onProgramOwner: on a frame's / agent's owner, with its frameUuid)
 * - vehicle: run an action of the rigged vehicle's sheet (same payload)
 * - defend: press Defend on the newest attack card aimed at the actor
 * - astral: set the astral state (payload.mode)
 * - initiative: roll initiative into the current combat
 * - open: open the actor's sheet (payload.tab: a tab to show) or the vehicle's (payload.target 'vehicle')
 * - info: show payload.text (a value with no roll of its own)
 */
export type HudKind = 'sheet' | 'vehicle' | 'defend' | 'astral' | 'initiative' | 'open' | 'info';

export interface HudAction {
  groupId: HudGroupId;
  /** Unique within one actor's list; never contains the TAH delimiter '|'. */
  id: string;
  name: string;
  info?: string;
  tooltip?: string;
  img?: string;
  kind: HudKind;
  payload: Record<string, any>;
}

export interface HudItem {
  id: string;
  type: string;
  name: string;
  img?: string;
  system?: Record<string, any>;
}

export interface HudVehicle {
  name: string;
  /** This actor is at the controls (not just linked). */
  controlling?: boolean;
  jumpedIn?: boolean;
  /** The user owns the vehicle too (its own sheet's actions: sensors, mounted weapons, opening it). */
  owned?: boolean;
  weapons?: Array<{ id: string; name: string; img?: string; info?: string }>;
}

export interface HudFlags {
  /** A combat encounter exists (initiative can be rolled into it). */
  hasCombat?: boolean;
  /** A started combat with this actor in it. */
  inCombat?: boolean;
  /** It is this actor's phase now. */
  myTurn?: boolean;
  delaying?: boolean;
  actingNow?: boolean;
  fullDefense?: boolean;
  prone?: boolean;
  /** The weapon name of the newest attack card aimed at this actor with Defend still showing. */
  pendingAttack?: string | null;
  hasDeck?: boolean;
  jackedIn?: boolean;
  hasAttackUtility?: boolean;
  isAstral?: boolean;
  canPerceive?: boolean;
  canProject?: boolean;
  /** The vehicle this actor drives or rigs. */
  vehicle?: HudVehicle | null;
  /** IC actor: a frame or agent (it acts through its owner's System operation). */
  icProgram?: boolean;
}

export interface HudActorSummary {
  type: string;
  name?: string;
  attributes?: Record<string, { total?: number } | undefined>;
  derived?: { reaction?: number; initiativeDice?: number; magic?: number; essence?: number; astralMode?: string };
  tradition?: string;
  items: HudItem[];
  /** Cyberweapons (implant blades, spurs): attacked with by id like a weapon. */
  cyberWeapons?: Array<{ id: string; name: string; system?: Record<string, any> }>;
  flags: HudFlags;
}

export const HUD_ATTRIBUTES = ['body', 'quickness', 'strength', 'charisma', 'intelligence', 'willpower'] as const;
export const HUD_ACTOR_TYPES = ['character', 'npc', 'spirit', 'vehicle', 'ic'] as const;
const PEOPLE = ['character', 'npc', 'spirit'];

export const HUD_GROUPS: Record<HudGroupId, { id: HudGroupId; name: string }> = {
  stats: { id: 'stats', name: 'Attributes' },
  tests: { id: 'tests', name: 'Tests' },
  activeSkills: { id: 'activeSkills', name: 'Active skills' },
  knowledgeSkills: { id: 'knowledgeSkills', name: 'Knowledge skills' },
  languageSkills: { id: 'languageSkills', name: 'Languages' },
  weapons: { id: 'weapons', name: 'Weapons' },
  combatActions: { id: 'combatActions', name: 'Actions' },
  spells: { id: 'spells', name: 'Spells' },
  critterPowers: { id: 'critterPowers', name: 'Powers' },
  adeptPowers: { id: 'adeptPowers', name: 'Adept powers' },
  astral: { id: 'astral', name: 'Astral' },
  matrixActions: { id: 'matrixActions', name: 'Matrix' },
  riggingActions: { id: 'riggingActions', name: 'Rigging' },
  mountedWeapons: { id: 'mountedWeapons', name: 'Mounted weapons' },
  utilityActions: { id: 'utilityActions', name: 'Utility' },
};

/** The HUD's tabs (top-level groups) and the subgroups in each. */
export const HUD_LAYOUT: Array<{ id: string; name: string; groups: HudGroupId[] }> = [
  { id: 'attributes', name: 'Attributes', groups: ['stats', 'tests'] },
  { id: 'skills', name: 'Skills', groups: ['activeSkills', 'knowledgeSkills', 'languageSkills'] },
  { id: 'combat', name: 'Combat', groups: ['weapons', 'combatActions'] },
  { id: 'magic', name: 'Magic', groups: ['spells', 'critterPowers', 'adeptPowers', 'astral'] },
  { id: 'matrix', name: 'Matrix', groups: ['matrixActions'] },
  { id: 'rigging', name: 'Rigging', groups: ['riggingActions', 'mountedWeapons'] },
  { id: 'utility', name: 'Utility', groups: ['utilityActions'] },
];

/**
 * TAH's registerDefaults shape: `layout` (tabs with nested groups, nestIds `tab_group`) and `groups`
 * (every subgroup, for the HUD's group picker). Names are plain English.
 */
export function hudDefaults(): { layout: any[]; groups: any[] } {
  const groups = Object.values(HUD_GROUPS).map((g) => ({ id: g.id, name: g.name, listName: tx('SR2E.Text.Hudactions.groupName', { name: g.name }), type: 'system' }));
  const layout = HUD_LAYOUT.map((tab) => ({
    nestId: tab.id,
    id: tab.id,
    name: tab.name,
    groups: tab.groups.map((gid) => {
      const g = groups.find((x) => x.id === gid)!;
      return { ...g, nestId: `${tab.id}_${gid}` };
    }),
  }));
  return { layout, groups };
}

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);

/** The damage code of a weapon's system data: "9M", "(STR+2)M", with "Stun" when it does stun. */
export function hudDamageLabel(w: Record<string, any> | undefined): string {
  if (!w) return '';
  const p = num(w['damagePower']);
  const level = String(w['damageLevel'] ?? '');
  const power = w['strengthPower'] ? `(STR${p > 0 ? `+${p}` : p < 0 ? `${p}` : ''})` : String(p);
  return w['damageType'] === 'stun' ? tx('SR2E.Text.Hudactions.damageStun', { damage: `${power}${level}` }) : `${power}${level}`;
}

/** A weapon's info text: ammo (loaded / capacity), firing modes, and jammed. */
export function hudWeaponInfo(w: Record<string, any> | undefined): string {
  if (!w) return '';
  const parts: string[] = [];
  if (num(w['ammoMax']) > 0) parts.push(`${num(w['ammo'])}/${num(w['ammoMax'])}`);
  const modes = String(w['modes'] ?? '').trim();
  if (modes && !w['melee']) parts.push(modes);
  if (w['jammed']) parts.push(tx('SR2E.Text.Hudactions.jammed'));
  return parts.join(' · ');
}

function itemAction(groupId: HudGroupId, it: HudItem, action: string, info?: string, extra: Partial<HudAction> = {}): HudAction {
  return {
    groupId,
    id: `item-${it.id}`,
    name: it.name,
    ...(info ? { info } : {}),
    ...(it.img ? { img: it.img } : {}),
    kind: 'sheet',
    payload: { action, dataset: { itemId: it.id }, itemId: it.id },
    ...extra,
  };
}

function sheet(groupId: HudGroupId, id: string, name: string, action: string, extra: Partial<HudAction> = {}, dataset: Record<string, string> = {}): HudAction {
  return { groupId, id, name, kind: 'sheet', payload: { action, dataset }, ...extra };
}

/** Attribute rolls (and Reaction, Magic, Essence as values). */
function attributeActions(s: HudActorSummary): HudAction[] {
  const out: HudAction[] = [];
  for (const key of HUD_ATTRIBUTES) {
    const total = s.attributes?.[key]?.total;
    out.push({ groupId: 'stats', id: `attribute-${key}`, name: tKey(`SR2E.Attribute.${key}`), ...(total !== undefined ? { info: String(total) } : {}), kind: 'sheet', payload: { action: 'rollAttribute', dataset: { attribute: key } } });
  }
  const d = s.derived ?? {};
  if (d.reaction !== undefined) {
    const dice = num(d.initiativeDice);
    out.push({ groupId: 'stats', id: 'stat-reaction', name: tx('SR2E.Text.Hudactions.reaction'), info: String(num(d.reaction)), kind: 'info', payload: { text: dice ? tx('SR2E.Text.Hudactions.reactionInitiative', { reaction: num(d.reaction), dice }) : tx('SR2E.Text.Hudactions.reactionValue', { reaction: num(d.reaction) }) } });
  }
  if (s.type !== 'spirit' && num(d.magic) > 0) out.push({ groupId: 'stats', id: 'stat-magic', name: tx('SR2E.Text.Hudactions.magic'), info: String(num(d.magic)), kind: 'info', payload: { text: tx('SR2E.Text.Hudactions.magicValue', { value: num(d.magic) }) } });
  if (s.type !== 'spirit' && d.essence !== undefined) {
    const e = Math.round(num(d.essence) * 100) / 100;
    out.push({ groupId: 'stats', id: 'stat-essence', name: tx('SR2E.Text.Hudactions.essence'), info: String(e), kind: 'info', payload: { text: tx('SR2E.Text.Hudactions.essenceValue', { value: e }) } });
  }
  return out;
}

function testActions(): HudAction[] {
  return [
    sheet('tests', 'test-perceive', tx('SR2E.Text.Hudactions.perception'), 'perceive', { tooltip: tx('SR2E.Text.Hudactions.perceptionAgainstSomeoneSneaking') }),
    sheet('tests', 'test-notice', tx('SR2E.Text.Hudactions.notice'), 'notice', { tooltip: tx('SR2E.Text.Hudactions.aPlainPerceptionTest') }),
    sheet('tests', 'test-sneak', tx('SR2E.Text.Hudactions.sneak'), 'sneak'),
    sheet('tests', 'test-athletics', tx('SR2E.Text.Hudactions.athletics'), 'athletics', { tooltip: tx('SR2E.Text.Hudactions.climbSwimOrJump') }),
    sheet('tests', 'test-social', tx('SR2E.Text.Hudactions.social'), 'socialTest'),
    sheet('tests', 'test-soak', tx('SR2E.Text.Hudactions.resistDamage'), 'resistDamage', { tooltip: tx('SR2E.Text.Hudactions.soakADamageCode') }),
  ];
}

function skillActions(s: HudActorSummary): HudAction[] {
  const group = (kind: string): HudGroupId => (kind === 'knowledge' ? 'knowledgeSkills' : kind === 'language' ? 'languageSkills' : 'activeSkills');
  return s.items.filter((i) => i.type === 'skill').sort(byName).map((i) => {
    const sys = i.system ?? {};
    const spec = sys['specialization'] && num(sys['specializationRating']) > 0 ? ` (${sys['specialization']} ${num(sys['specializationRating'])})` : '';
    return itemAction(group(String(sys['kind'] ?? 'active')), i, 'rollSkill', `${num(sys['rating'])}${spec}`);
  });
}

function weaponActions(s: HudActorSummary): HudAction[] {
  // v0.92.2: a weapon left behind (RULES.SHEET_V921.carried) isn't offered: it can't attack.
  const out: HudAction[] = s.items.filter((i) => i.type === 'weapon' && isCarried(i)).sort(byName)
    .map((i) => itemAction('weapons', i, 'attackWeapon', hudWeaponInfo(i.system), { tooltip: `${i.name}: ${hudDamageLabel(i.system)}` }));
  for (const c of [...(s.cyberWeapons ?? [])].sort(byName)) {
    out.push({ groupId: 'weapons', id: `cyberweapon-${c.id}`, name: c.name, info: hudDamageLabel(c.system), kind: 'sheet', payload: { action: 'attackWeapon', dataset: { itemId: c.id } } });
  }
  if (PEOPLE.includes(s.type)) out.push({ groupId: 'weapons', id: 'weapon-unarmed', name: tx('SR2E.Text.Hudactions.unarmed'), kind: 'sheet', payload: { action: 'attackWeapon', dataset: { itemId: 'unarmed' } } });
  return out;
}

function combatActions(s: HudActorSummary): HudAction[] {
  const f = s.flags;
  const out: HudAction[] = [sheet('combatActions', 'combat-attack', tx('SR2E.Text.Hudactions.attack'), 'quickAttack', { tooltip: tx('SR2E.Text.Hudactions.pickAWeaponThenAttack') })];
  if (s.items.some((i) => i.type === 'spell')) out.push(sheet('combatActions', 'combat-cast', tx('SR2E.Text.Hudactions.cast'), 'quickCast', { tooltip: tx('SR2E.Text.Hudactions.pickASpellThenCast') }));
  if (s.items.some((i) => i.type === 'weapon' && isCarried(i) && num(i.system?.['ammoMax']) > 0)) out.push(sheet('combatActions', 'combat-reload', tx('SR2E.Text.Hudactions.reload'), 'quickReload'));
  const jammed = s.items.find((i) => i.type === 'weapon' && isCarried(i) && i.system?.['jammed']);
  if (jammed) out.push(sheet('combatActions', 'combat-clearjam', tx('SR2E.Text.Hudactions.clearJam', { name: jammed.name }), 'clearJam', {}, { itemId: jammed.id }));
  if (f.pendingAttack) out.push({ groupId: 'combatActions', id: 'combat-defend', name: tx('SR2E.Text.Hudactions.defend', { attack: f.pendingAttack }), kind: 'defend', payload: {}, tooltip: tx('SR2E.Text.Hudactions.defendAgainstTheNewestAttack') });
  out.push(sheet('combatActions', 'combat-fulldefense', tx('SR2E.Text.Hudactions.fullDefense'), 'fullDefense', f.fullDefense ? { info: tx('SR2E.Text.Hudactions.on') } : {}));
  if (f.inCombat) {
    if (f.actingNow) out.push(sheet('combatActions', 'combat-enddelay', tx('SR2E.Text.Hudactions.doneDelayedAction'), 'endDelayed'));
    else if (f.delaying) out.push(sheet('combatActions', 'combat-actnow', tx('SR2E.Text.Hudactions.actNow'), 'actNow', { info: tx('SR2E.Text.Hudactions.delaying') }));
    else if (f.myTurn) out.push(sheet('combatActions', 'combat-delay', tx('SR2E.Text.Hudactions.delay'), 'delayAction'));
  }
  if (f.prone) out.push(sheet('combatActions', 'combat-standup', tx('SR2E.Text.Hudactions.standUp'), 'standUp'));
  return out;
}

function magicActions(s: HudActorSummary): HudAction[] {
  const out: HudAction[] = [];
  for (const i of s.items.filter((x) => x.type === 'spell').sort(byName)) {
    const sys = i.system ?? {};
    out.push(itemAction('spells', i, 'castSpell', tx('SR2E.Text.Hudactions.forceShort', { force: num(sys['learnedForce']) }), { tooltip: `${i.name}: ${cap(String(sys['category'] ?? ''))}, ${String(sys['spellType'] ?? '')}` }));
  }
  const unusable = ['allergy', 'vulnerability', 'essenceLoss', 'regeneration', 'dualNatured', 'infection'];
  for (const i of s.items.filter((x) => x.type === 'power').sort(byName)) {
    const sys = i.system ?? {};
    if (!sys['active'] || unusable.includes(String(sys['special'] ?? ''))) continue;
    out.push(itemAction('critterPowers', i, 'usePower'));
  }
  for (const i of s.items.filter((x) => x.type === 'adeptpower').sort(byName)) {
    const sys = i.system ?? {};
    const lvl = num(sys['level']);
    out.push(itemAction('adeptPowers', i, 'toggleActive', `${lvl > 1 ? `${lvl} · ` : ''}${sys['active'] ? tx('SR2E.Text.Hudactions.on') : tx('SR2E.Text.Hudactions.off')}`, { tooltip: sys['active'] ? tx('SR2E.Text.Hudactions.clickToSwitchOff', { name: i.name }) : tx('SR2E.Text.Hudactions.clickToSwitchOn', { name: i.name }) }));
  }
  const f = s.flags;
  const mode = s.derived?.astralMode ?? 'physical';
  if (s.type !== 'spirit') {
    if (f.canPerceive && mode !== 'projecting') {
      out.push({ groupId: 'astral', id: 'astral-perceive', name: tx('SR2E.Text.Hudactions.astralPerception'), ...(mode === 'perceiving' ? { info: tx('SR2E.Text.Hudactions.on') } : {}), kind: 'astral', payload: { mode: mode === 'perceiving' ? 'physical' : 'perceiving' } });
    }
    if (f.canProject) {
      out.push({ groupId: 'astral', id: 'astral-project', name: mode === 'projecting' ? tx('SR2E.Text.Hudactions.returnToBody') : tx('SR2E.Text.Hudactions.astralProjection'), ...(mode === 'projecting' ? { info: tx('SR2E.Text.Hudactions.on') } : {}), kind: 'astral', payload: { mode: mode === 'projecting' ? 'physical' : 'projecting' } });
    }
  }
  if (f.isAstral) {
    out.push(sheet('astral', 'astral-assense', tx('SR2E.Text.Hudactions.assense'), 'assense'));
    out.push(sheet('astral', 'astral-attack', tx('SR2E.Text.Hudactions.astralAttack'), 'astralAttack'));
  }
  return out;
}

function matrixActions(s: HudActorSummary): HudAction[] {
  const f = s.flags;
  if (!f.hasDeck) return [];
  const out: HudAction[] = [sheet('matrixActions', 'matrix-jackin', f.jackedIn ? tx('SR2E.Text.Hudactions.moveJackInElsewhere') : tx('SR2E.Text.Hudactions.jackIn'), 'jackIn')];
  if (f.jackedIn) {
    out.push(sheet('matrixActions', 'matrix-jackout', tx('SR2E.Text.Hudactions.jackOut'), 'jackOut'));
    out.push(sheet('matrixActions', 'matrix-operation', tx('SR2E.Text.Hudactions.systemOperation'), 'systemTest'));
    out.push(sheet('matrixActions', 'matrix-perceive', tx('SR2E.Text.Hudactions.matrixPerception'), 'matrixPerceive'));
    out.push(sheet('matrixActions', 'matrix-maneuver', tx('SR2E.Text.Hudactions.maneuver'), 'matrixManeuver'));
    if (f.hasAttackUtility) out.push(sheet('matrixActions', 'matrix-attack', tx('SR2E.Text.Hudactions.cybercombat'), 'matrixAttack'));
  }
  return out;
}

function riggingActions(s: HudActorSummary): HudAction[] {
  const v = s.flags.vehicle;
  if (!v) return [];
  const out: HudAction[] = [];
  if (v.controlling) out.push(sheet('riggingActions', 'rig-drive', tx('SR2E.Text.Hudactions.driveVehicle', { name: v.name }), 'driveVehicle'));
  out.push(sheet('riggingActions', 'rig-jump', v.jumpedIn ? tx('SR2E.Text.Hudactions.jumpOut') : tx('SR2E.Text.Hudactions.jumpIn'), 'toggleJump', v.jumpedIn ? { info: tx('SR2E.Text.Hudactions.jumpedIn') } : {}));
  out.push(sheet('riggingActions', 'rig-release', tx('SR2E.Text.Hudactions.releaseVehicle'), 'releaseVehicle'));
  if (v.owned === false) return out;
  out.push({ groupId: 'riggingActions', id: 'rig-sensors', name: tx('SR2E.Text.Hudactions.sensorTest'), kind: 'vehicle', payload: { action: 'sensorTest', dataset: {} } });
  out.push({ groupId: 'riggingActions', id: 'rig-open', name: tx('SR2E.Text.Hudactions.openVehicle', { name: v.name }), kind: 'open', payload: { target: 'vehicle' } });
  for (const w of [...(v.weapons ?? [])].sort(byName)) {
    out.push({ groupId: 'mountedWeapons', id: `mounted-${w.id}`, name: w.name, ...(w.info ? { info: w.info } : {}), ...(w.img ? { img: w.img } : {}), kind: 'vehicle', payload: { action: 'fireMounted', dataset: { itemId: w.id } } });
  }
  return out;
}

function utilityActions(s: HudActorSummary): HudAction[] {
  const out: HudAction[] = [];
  if (s.flags.hasCombat) out.push({ groupId: 'utilityActions', id: 'util-initiative', name: tx('SR2E.Text.Hudactions.rollInitiative'), kind: 'initiative', payload: {} });
  if (s.type === 'spirit') out.push(sheet('utilityActions', 'util-service', tx('SR2E.Text.Hudactions.useAService'), 'useService'));
  out.push({ groupId: 'utilityActions', id: 'util-sheet', name: tx('SR2E.Text.Hudactions.openSheet'), kind: 'open', payload: { target: 'actor' } });
  if (PEOPLE.includes(s.type)) out.push({ groupId: 'utilityActions', id: 'util-effects', name: tx('SR2E.Text.Hudactions.effects'), kind: 'open', payload: { target: 'actor', tab: 'effects' }, tooltip: tx('SR2E.Text.Hudactions.openTheSheetOnIts') });
  return out;
}

/** A vehicle actor's own HUD: drive, ram, sensors, its mounted weapons. */
function vehicleActorActions(s: HudActorSummary): HudAction[] {
  const out: HudAction[] = [
    sheet('riggingActions', 'veh-drive', tx('SR2E.Text.Hudactions.drive'), 'driveVehicle'),
    sheet('riggingActions', 'veh-sensors', tx('SR2E.Text.Hudactions.sensorTest'), 'sensorTest'),
    sheet('riggingActions', 'veh-ram', tx('SR2E.Text.Hudactions.ram'), 'ramVehicle'),
  ];
  for (const i of s.items.filter((x) => x.type === 'weapon').sort(byName)) out.push(itemAction('mountedWeapons', i, 'fireMounted', hudWeaponInfo(i.system)));
  return out;
}

/** IC: act, locate. A frame or agent runs an operation through its owner (as the tracker's Act button). */
function icActions(s: HudActorSummary): HudAction[] {
  if (s.flags.icProgram) return [{ groupId: 'matrixActions', id: 'ic-act', name: tx('SR2E.Text.Hudactions.runAnOperation'), kind: 'sheet', payload: { action: 'systemTest', dataset: {}, onProgramOwner: true } }];
  return [
    sheet('matrixActions', 'ic-act', tx('SR2E.Text.Hudactions.act'), 'icAttack'),
    sheet('matrixActions', 'ic-locate', tx('SR2E.Text.Hudactions.locate'), 'icLocate'),
  ];
}

/** Every HUD action for one actor (empty for types the HUD has nothing for). */
export function hudActions(s: HudActorSummary): HudAction[] {
  if (!s || !HUD_ACTOR_TYPES.includes(s.type as any)) return [];
  if (s.type === 'vehicle') return [...vehicleActorActions(s), ...utilityActions(s)];
  if (s.type === 'ic') return [...icActions(s), ...utilityActions(s)];
  return [
    ...attributeActions(s),
    ...testActions(),
    ...skillActions(s),
    ...weaponActions(s),
    ...combatActions(s),
    ...magicActions(s),
    ...matrixActions(s),
    ...riggingActions(s),
    ...utilityActions(s),
  ];
}

/** Several tokens selected: the attribute rolls and initiative, each run for every selected actor. */
export function hudMultiActions(opts: { hasCombat?: boolean } = {}): HudAction[] {
  const out: HudAction[] = HUD_ATTRIBUTES.map((key) => ({ groupId: 'stats' as HudGroupId, id: `attribute-${key}`, name: tKey(`SR2E.Attribute.${key}`),
 kind: 'sheet' as HudKind, payload: { action: 'rollAttribute', dataset: { attribute: key } } }));
  if (opts.hasCombat) out.push({ groupId: 'utilityActions', id: 'util-initiative', name: tx('SR2E.Text.Hudactions.rollInitiative'), kind: 'initiative', payload: {} });
  return out;
}

/** The TAH encodedValue of an action (`kind|id`): the fallback when an action reaches the roll handler without its onClick. */
export function encodeHudAction(a: Pick<HudAction, 'kind' | 'id'>, delimiter = '|'): string {
  return `${a.kind}${delimiter}${a.id}`;
}

/** Split an encodedValue back into kind and id (null when it isn't ours). */
export function decodeHudValue(value: unknown, delimiter = '|'): { kind: HudKind; id: string } | null {
  if (typeof value !== 'string' || !value) return null;
  const at = value.indexOf(delimiter);
  if (at <= 0) return null;
  const kind = value.slice(0, at) as HudKind;
  const id = value.slice(at + delimiter.length);
  if (!id || !['sheet', 'vehicle', 'defend', 'astral', 'initiative', 'open', 'info'].includes(kind)) return null;
  return { kind, id };
}

/** Find the action an encodedValue names in a (re)built list. */
export function findHudAction(list: HudAction[], value: unknown, delimiter = '|'): HudAction | null {
  const d = decodeHudValue(value, delimiter);
  if (!d) return null;
  return list.find((a) => a.id === d.id && a.kind === d.kind) ?? null;
}
