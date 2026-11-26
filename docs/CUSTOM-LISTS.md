# Skill and attribute lists (v0.93.3)

**Game Settings > Configure Settings > Shadowrun 2e > Skill and attribute lists** (GM only, saved per world).

This sits between the curated house rules and editing the system's code. You can change which skills the system
offers and what the attributes are called, and that's all. None of the rules change.

## What the GM can change

- **Custom skills.** One per line: `Name | attribute | kind | note`. Only the name is required.
  - *attribute*: body, quickness, strength, charisma, intelligence, willpower or reaction. The first three
    letters are enough (`qui`, `rea`). If you leave it out, active skills link to Quickness.
  - *kind*: active (the default), knowledge, language or build/repair (`b/r`). Knowledge and language skills
    always link to Intelligence, the same as the skill picker makes them.
  - *note*: a short reminder for the GM, up to 120 characters.
  - Lines starting with `#` are comments.
  - Names can be up to 60 characters. A name the book list already has (in any letter case, aliases included) is
    skipped, and so is a repeated name. You can have at most 200 custom skills.
  - Custom skills show up in the skill picker's name list (the + on a skill list), and the picker fills in their
    linked attribute. They also show up in the creation wizard's "common skills not taken yet" links.
- **Hidden skills.** One book skill name per line, at most 300. They're left out of the skill picker and the
  creation wizard's suggestions.
- **Attribute labels.** Each attribute can get a display label (up to 30 characters) and an abbreviation (up to 6),
  which the sheets and pickers show. Leave a box empty to keep the default.

If a line can't be read, it's skipped and a warning lists it. The other lines are still saved.

## What it never changes

- **Actors.** Hiding a skill never deletes it from a character that has it, and editing or removing a custom skill
  doesn't touch the skill items already made from it. Those are ordinary skills from then on.
- **Attribute keys and rules.** A renamed attribute keeps its key (`body`, `quickness`, ...). Every rule, house
  rule, roll link, macro and import still uses the key, so `@SR2Test[body]` keeps working whatever Body is called.
- **New attributes can't be added.** The rules are tied to the fixed attribute keys (Initiative, the pools,
  damage resistance, essence and magic, creation points), so a new attribute would have nothing to feed. If you
  want something like one, use a custom knowledge or active skill instead.
- **Typing a name.** The pickers still take any name, hidden or not. The lists only decide what they suggest.
- **The Skill Web.** Defaulting links are still written in the Skill Web window, by name. A custom skill can be
  linked there like any other skill.

## For developers

The pure logic is in `src/module/rules/customlists.ts`: parsing, validation, `skillChoices`, `attributeLabel` /
`attributeAbbr`, and the store `setCustomLists` / `getCustomLists` / `worldSkillChoices` /
`attributeDisplayLabel`. The Foundry glue is in `src/module/applications/customlists.ts`: the `customLists` world
setting, the menu, and the window.
