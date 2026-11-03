/**
 * v0.91.2: the shop's categories (the owner, 25 Oct 2026: "add checkboxes to sort by things like melee/ranged,
 * pistol/smg/rifle… for all the different categories"). Pure: each entry of a tab gets one group, read from its data
 * (flags and fields first, then its skill, specialization and name); the window shows a check box per group present,
 * and ticking some shows only those. The labels are `SR2E.App.Shop.group.<id>` (`SHOP_GROUP_KEYS`).
 */
/** The groups of each tab, in the order they are listed (and the list is sorted). */
export const SHOP_GROUPS: Readonly<Record<string, readonly string[]>> = {
  weapon: ['melee', 'pistol', 'smg', 'rifle', 'shotgun', 'heavy', 'launcher', 'grenade', 'thrown', 'bow', 'otherWeapon'],
  armor: ['body', 'helmet', 'shield', 'addon'],
  gear: ['ammo', 'accessories', 'medical', 'drugs', 'electronics', 'media', 'vision', 'surveillance', 'chips', 'explosives', 'survival', 'ids', 'magic', 'otherGear'],
  cyberware: ['headware', 'bodyware', 'limb', 'cyberweapon', 'bioware'],
  focus: ['focusSpell', 'focusSustaining', 'focusSpirit', 'focusPower', 'focusWeapon'],
  program: ['progCombat', 'progOperation', 'progSpecial'],
  cyberdeck: ['deckLow', 'deckMid', 'deckHigh'],
  spell: ['spellCombat', 'spellDetection', 'spellHealth', 'spellIllusion', 'spellManipulation'],
  // v0.91.4: vehicles by kind, then drones by where they go.
  vehicle: ['car', 'bike', 'truck', 'hovercraft', 'boat', 'aircraft', 'otherVehicle', 'droneGround', 'droneAir', 'droneWater', 'droneOther'],
};

/** Each group's label key (literal, so the language file's keys can be checked against the code). */
export const SHOP_GROUP_KEYS: Readonly<Record<string, string>> = {
  car: 'SR2E.App.Shop.group.car', bike: 'SR2E.App.Shop.group.bike', truck: 'SR2E.App.Shop.group.truck', hovercraft: 'SR2E.App.Shop.group.hovercraft',
  boat: 'SR2E.App.Shop.group.boat', aircraft: 'SR2E.App.Shop.group.aircraft', otherVehicle: 'SR2E.App.Shop.group.otherVehicle',
  droneGround: 'SR2E.App.Shop.group.droneGround', droneAir: 'SR2E.App.Shop.group.droneAir', droneWater: 'SR2E.App.Shop.group.droneWater', droneOther: 'SR2E.App.Shop.group.droneOther',
  melee: 'SR2E.App.Shop.group.melee', pistol: 'SR2E.App.Shop.group.pistol', smg: 'SR2E.App.Shop.group.smg', rifle: 'SR2E.App.Shop.group.rifle',
  shotgun: 'SR2E.App.Shop.group.shotgun', heavy: 'SR2E.App.Shop.group.heavy', launcher: 'SR2E.App.Shop.group.launcher', grenade: 'SR2E.App.Shop.group.grenade',
  thrown: 'SR2E.App.Shop.group.thrown', bow: 'SR2E.App.Shop.group.bow', otherWeapon: 'SR2E.App.Shop.group.otherWeapon',
  body: 'SR2E.App.Shop.group.body', helmet: 'SR2E.App.Shop.group.helmet', shield: 'SR2E.App.Shop.group.shield', addon: 'SR2E.App.Shop.group.addon',
  ammo: 'SR2E.App.Shop.group.ammo', accessories: 'SR2E.App.Shop.group.accessories', media: 'SR2E.App.Shop.group.media', survival: 'SR2E.App.Shop.group.survival', ids: 'SR2E.App.Shop.group.ids', medical: 'SR2E.App.Shop.group.medical', drugs: 'SR2E.App.Shop.group.drugs', electronics: 'SR2E.App.Shop.group.electronics',
  vision: 'SR2E.App.Shop.group.vision', surveillance: 'SR2E.App.Shop.group.surveillance', chips: 'SR2E.App.Shop.group.chips', explosives: 'SR2E.App.Shop.group.explosives',
  magic: 'SR2E.App.Shop.group.magic', otherGear: 'SR2E.App.Shop.group.otherGear',
  headware: 'SR2E.App.Shop.group.headware', bodyware: 'SR2E.App.Shop.group.bodyware', limb: 'SR2E.App.Shop.group.limb', cyberweapon: 'SR2E.App.Shop.group.cyberweapon',
  bioware: 'SR2E.App.Shop.group.bioware',
  focusSpell: 'SR2E.App.Shop.group.focusSpell', focusSustaining: 'SR2E.App.Shop.group.focusSustaining', focusSpirit: 'SR2E.App.Shop.group.focusSpirit',
  focusPower: 'SR2E.App.Shop.group.focusPower', focusWeapon: 'SR2E.App.Shop.group.focusWeapon',
  progCombat: 'SR2E.App.Shop.group.progCombat', progOperation: 'SR2E.App.Shop.group.progOperation', progSpecial: 'SR2E.App.Shop.group.progSpecial',
  deckLow: 'SR2E.App.Shop.group.deckLow', deckMid: 'SR2E.App.Shop.group.deckMid', deckHigh: 'SR2E.App.Shop.group.deckHigh',
  spellCombat: 'SR2E.App.Shop.group.spellCombat', spellDetection: 'SR2E.App.Shop.group.spellDetection', spellHealth: 'SR2E.App.Shop.group.spellHealth',
  spellIllusion: 'SR2E.App.Shop.group.spellIllusion', spellManipulation: 'SR2E.App.Shop.group.spellManipulation',
};

const low = (v: unknown) => String(v ?? '').toLowerCase();
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Words of a weapon's skill, specialization and name, for telling its class. */
function weaponWords(name: string, s: any): string {
  return `${low(s?.skill)} | ${low(s?.specialization)} | ${low(name)}`;
}

/** A weapon's group: melee, a firearm class, heavy, launcher, grenade, thrown, bow or other. */
export function weaponGroup(name: string, s: any): string {
  const w = weaponWords(name, s);
  const n = low(name);
  if (s?.melee) return 'melee';
  // v0.91.2 review (B1, B2, B3): launchers before grenades, flamers and heavy guns before thrown weapons and SMGs.
  if (/launch|\brocket|missile|mortar/.test(w)) return 'launcher';
  if (s?.areaKind === 'flame' || /flamethrower|flamer/.test(w)) return 'heavy';
  if (s?.blast) return 'grenade';
  if (s?.heavy || s?.antiVehicle || /gunnery|(?<!sub)machine ?gun|\b[lmh]mg\b|cannon|minigun|vindicator/.test(w)) return 'heavy';
  if (/\bthrow/.test(low(s?.skill)) || /shuriken|throwing/.test(n)) return 'thrown';
  if (/\bbow\b|crossbow|projectile/.test(w)) return 'bow';
  if (s?.shotgun || /shotgun/.test(w)) return 'shotgun';
  if (/smg|submachine|machine pistol|\bmp\b/.test(w)) return 'smg';
  if (/pistol|revolver|hold-?out|taser|super shock|stun gun/.test(w)) return 'pistol';
  if (/rifle|carbine|sniper|sporting|\bar\b|combat gun/.test(w)) return 'rifle';
  if (/armed combat|edged|club|whip|pole|staff|unarmed|blade|sword|knife|axe/.test(w)) return 'melee';
  // v0.91.2 review (R2): a firearm with no specialization: a well-hidden single-shot one is a pistol, a well-hidden
  // automatic one an SMG, any other a rifle.
  if (/firearm/.test(low(s?.skill))) {
    const conceal = num(s?.concealability);
    const auto = /BF|FA/.test(String(s?.modes ?? ''));
    if (conceal >= 5 && !auto) return 'pistol';
    if (auto && conceal >= 4) return 'smg';
    return 'rifle';
  }
  return 'otherWeapon';
}

/** An armor's group: a shield, a helmet, an add-on (adds to other armor), or body armor. */
export function armorGroup(name: string, s: any): string {
  const n = low(name);
  if (num(s?.parry) > 0 || /shield/.test(n)) return 'shield';
  if (/helmet|\bhelm\b/.test(n)) return 'helmet';
  if (s?.adds) return 'addon';
  return 'body';
}

/** A piece of gear's group, from what it does (its fields), else its name. */
export function gearGroup(name: string, s: any): string {
  const n = low(name);
  if (s?.ammoType || /ammo|ammunition|\brounds?\b|cartridge|spare clips?|\bclips?\b|magazine|missile|rocket|arrow|\bbolts?\b|darts?\b/.test(n)) return 'ammo';
  // v0.91.2 review (B4): a sniffer or detector is electronics, whatever it sniffs.
  if (/sniffer|detector|scanner/.test(n)) return 'electronics';
  if (num(s?.explosive?.power) > 0 || /explosive|detonator|plastique|\bc-?4\b|\bcharges?\b|flash-?pak/.test(n)) return 'explosives';
  if (/laser sight|silencer|suppressor|gyro|bipod|tripod|smartgun|holster|shock pad|designator|rangefinder|mount\b|stabiliz|\bscopes?\b/.test(n)) return 'accessories';
  if (s?.toxin?.kind || /drug|toxin|poison|venom|anthrax|\bdoom\b/.test(n)) return 'drugs';
  if (num(s?.medkitRating) > 0 || s?.patch?.kind || /medkit|med kit|first aid|surg|patch|trauma|biomonitor|doc ?wagon|antibac|binder|gene therapy|immuniz|interferon|dmso|fluorocarbon|organic replacement|carcerand|l[eé]oniz|therap/.test(n)) return 'medical';
  if (s?.chip?.kind || /chip|skillsoft|activesoft|knowsoft|linguasoft/.test(n)) return 'chips';
  if (s?.material || /fetish|telesma|reagent|radical|lodge|(?<!data ?)library|magical|hermetic|shamanic|circle|orichalcum|conjur|casting material|enchanting|ritual|spell formula/.test(n)) return 'magic';
  if (/credstick|\bsin\b|licen[cs]e|permit|\bid\b/.test(n)) return 'ids';
  if (/climb|rope|grapple|harness|rappel|survival|ration|respirator|chemsuit|gas mask|restraint|chameleon|gas-vent|pressure regulator|flare/.test(n)) return 'survival';
  if (s?.optics?.lowLight || s?.optics?.thermographic || num(s?.optics?.magnification) > 0 || /goggle|binocular|monocular|glasses|(?<!fiber ?)optics?\b|vision|light amp/.test(n)) return 'vision';
  if (/\bbug\b|\btap\b|tracer|tracker|tracking|surveillance|laser mic|shotgun mic|signal locator|voice identifier|white noise|squealer/.test(n)) return 'surveillance';
  if (/cam\b|camera|cybercam|portacam|camcorder|polycorder|sampler|speaker|amplifier|mixer|synthesi|synthlink|music|video|trideo|asist|dir-x|\bact\b|dream|simsense|sim\b|realsense|holo-edit|imaging|tridlink|steadicam|enabler|engram|ddo|digital output|reality-500|inner-i|paradiso|tridmixer|netsynth|musical instrument/.test(n)) return 'media';
  if (num(s?.radio?.rating) > 0 || num(s?.rcdRating) > 0 || num(s?.jammer) > 0 || s?.scanner?.kind || num(s?.signal) > 0 || num(s?.suite) > 0
    || /radio|phone|telecom|comm|jammer|scanner|detector|computer|rcd|remote control|transceiver|transmitter|maglock|electronic|tool|signal|data|encryption|codebreaker|uplink|link\b|secretary|printer|storage|gps|nav-dat|timer|battletac|voice mask|reprogrammer|panicbutton/.test(n)) return 'electronics';
  return 'otherGear';
}

/** Cyberware's group: bioware, a cyberweapon, a cyberlimb, headware or bodyware. */
export function cyberGroup(name: string, s: any): string {
  const n = low(name);
  const kind = String(s?.kind ?? '');
  if (s?.bioware) return 'bioware';
  if (kind === 'cyberweapon' || num(s?.weapon?.damagePower) > 0 || s?.weapon?.strengthPower || /spur|razor|blade|claw|cyber ?gun/.test(n)) return 'cyberweapon';
  if (kind === 'cyberlimb' || s?.limb?.location || /\b(arm|leg|hand|foot|limb|torso)\b/.test(n)) return 'limb';
  if (['datajack', 'chipjack', 'skillwires', 'eyes', 'ears', 'encephalon', 'memory', 'iccm'].includes(kind) || s?.lowLight || s?.thermographic || num(s?.magnification) > 0
    || num(s?.hearingAmp) > 0 || s?.ultrasound || num(s?.controlRig) > 0 || /eye|\bears?\b|head|jack|memory|data|chip|radio|phone|tooth|voice|olfactory|taste|orientation|clock|control rig|\bvcr\b/.test(n)) return 'headware';
  return 'bodyware';
}

const FOCUS_GROUPS: Record<string, string> = { spell: 'focusSpell', sustaining: 'focusSustaining', spirit: 'focusSpirit', power: 'focusPower', weapon: 'focusWeapon' };
const PROGRAM_COMBAT = new Set(['attack', 'armor', 'shield', 'medic', 'mirrors', 'smoke', 'cloak', 'lock-on', 'slow']);
const PROGRAM_SPECIAL = new Set(['agent', 'frame', 'smart-frame', 'other']);
const SPELL_GROUPS: Record<string, string> = { combat: 'spellCombat', detection: 'spellDetection', health: 'spellHealth', illusion: 'spellIllusion', manipulation: 'spellManipulation' };

/** An entry's group on its tab ('' when the tab has no groups). */
export function shopGroupOf(type: string, name: string, system: any): string {
  const s = system ?? {};
  switch (type) {
    case 'weapon': return weaponGroup(name, s);
    case 'armor': return armorGroup(name, s);
    case 'gear': return gearGroup(name, s);
    case 'cyberware': return cyberGroup(name, s);
    case 'focus': return FOCUS_GROUPS[String(s.focusType ?? 'spell')] ?? 'focusSpell';
    case 'program': { const k = String(s.kind ?? 'other'); return PROGRAM_COMBAT.has(k) ? 'progCombat' : PROGRAM_SPECIAL.has(k) ? 'progSpecial' : 'progOperation'; }
    case 'cyberdeck': { const m = num(s.mpcp); return m >= 9 ? 'deckHigh' : m >= 5 ? 'deckMid' : 'deckLow'; }
    case 'spell': return SPELL_GROUPS[String(s.category ?? '')] ?? 'spellManipulation';
    case 'vehicle': return vehicleGroup(s);
    default: return '';
  }
}

/** v0.91.4: a vehicle's group by its category (rules/config.ts VEHICLES.categories); a drone's by where it goes. */
export function vehicleGroup(s: any): string {
  const c = String(s?.category ?? 'car');
  if (s?.drone) {
    if (['rotor', 'fixedWing', 'vectorThrust', 'lta'].includes(c)) return 'droneAir';
    if (['boat', 'ship'].includes(c)) return 'droneWater';
    if (['car', 'bike', 'truck', 'hovercraft'].includes(c)) return 'droneGround';
    return 'droneOther';
  }
  if (['car', 'bike', 'truck', 'hovercraft'].includes(c)) return c;
  if (['boat', 'ship'].includes(c)) return 'boat';
  if (['rotor', 'fixedWing', 'vectorThrust', 'lta'].includes(c)) return 'aircraft';
  return 'otherVehicle';
}

/** Where a group sorts on its tab (unknown last). */
export function shopGroupRank(type: string, group: string): number {
  const list = SHOP_GROUPS[type] ?? [];
  const i = list.indexOf(group);
  return i < 0 ? list.length : i;
}

/** Does a row pass the ticked groups? None ticked shows every row. */
export function passesGroups(group: string, ticked: ReadonlySet<string> | readonly string[]): boolean {
  const set = ticked instanceof Set ? ticked : new Set(ticked as readonly string[]);
  return set.size === 0 || set.has(group);
}

/** For tests and the guide: the groups a tab has. */
export const shopGroupsFor = (type: string): readonly string[] => SHOP_GROUPS[type] ?? [];

