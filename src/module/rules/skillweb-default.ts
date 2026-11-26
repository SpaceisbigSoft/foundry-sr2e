/**
 * v0.93.3: the default Skill Web, as links and step counts only (no rulebook text), in parseSkillWeb's format
 * (skills.ts): one link per line, "Skill A - Skill B: steps", "A > B" one-way (A defaults to B), "#" comments.
 * Attributes are written by name (as urrCoreAttributeTn looks them up), always "Attribute > Skill".
 *
 * Only what the rules text gives is here: the diagram itself (SR2 Core p. 69) is a page scan the links could not be
 * read from, so this is partial. Lines marked VERIFY are listed in docs/VERIFY.md ("v0.93.3 default Skill Web").
 * Skill names are the system's own (catalogue.ts COMMON_SKILLS; a B/R skill is the skill's name + " B/R", as
 * everyday.ts guesses it), not always the book's spelling.
 */

/** v0.93.3: false while the default web holds only part of the book's diagram (see the header). */
export const DEFAULT_SKILL_WEB_COMPLETE = false;

export const DEFAULT_SKILL_WEB: string = [
  '# SR2 Core p. 69 (Skill Web diagram; using it: SR2 Core p. 68). Partial: links from the rules text only.',
  '# Each step is one circle passed (+2 TN a step).',
  '',
  '# Build/Repair: one circle from its general skill (SR2 Core pp. 70-75, Build and Repair Skills;',
  '# the errata to pp. 68-69 adds the dots for Firearms, Gunnery, Projectile and Throwing B/R).',
  'Armed Combat - Armed Combat B/R: 1',
  'Firearms - Firearms B/R: 1',
  'Gunnery - Gunnery B/R: 1',
  'Projectile Weapons - Projectile Weapons B/R: 1',
  'Throwing Weapons - Throwing Weapons B/R: 1',
  'Computer - Computer B/R: 1',
  'Electronics - Electronics B/R: 1',
  '',
  '# Vehicle B/R: the book groups these (Ground Vehicles B/R); the system names one per vehicle.',
  '# VERIFY: Car - Car B/R, Bike - Bike B/R (one circle, by the rule above)',
  'Car - Car B/R: 1',
  'Bike - Bike B/R: 1',
  '',
  '# Magical skills (Awakenings p. 94): Sorcery, Conjuring and Enchanting link to Magical Theory and to each other,',
  '# and Willpower defaults to them. The step counts are not in the text.',
  '# VERIFY: every step count in this group (1 between skills = the old flat +2; 2 from Willpower = the old flat +4)',
  'Sorcery - Magical Theory: 1',
  'Conjuring - Magical Theory: 1',
  'Enchanting - Magical Theory: 1',
  'Sorcery - Conjuring: 1',
  'Sorcery - Enchanting: 1',
  'Conjuring - Enchanting: 1',
  'Willpower > Sorcery: 2',
  'Willpower > Conjuring: 2',
  'Willpower > Enchanting: 2',
  '',
].join('\n');
