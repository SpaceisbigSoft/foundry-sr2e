// Writes the GitHub release notes to stdout: this version's CHANGELOG section, then how to install.
// Run by .github/workflows/release.yml; GITHUB_REPOSITORY and GITHUB_REF_NAME come from GitHub Actions.
import { readFileSync } from 'node:fs';

const version = JSON.parse(readFileSync('public/system.json', 'utf8')).version;
const repo = 'https://github.com/' + (process.env.GITHUB_REPOSITORY ?? 'SpaceisbigSoft/foundry-sr2e');
const ref = process.env.GITHUB_REF_NAME ?? 'v' + version;
const changelog = `${repo}/blob/${ref}/CHANGELOG.md`;

const log = readFileSync('CHANGELOG.md', 'utf8');
const start = log.indexOf(`## v${version} `);
let section = `See the [CHANGELOG](${changelog}) for what changed.`;
if (start >= 0) {
  const rest = log.slice(start);
  const next = rest.indexOf('\n## ', 3);
  section = (next >= 0 ? rest.slice(0, next) : rest).trim().replace(/^## (.*)$/m, '## What is new: $1');
}

const notes = [
  `**Not yet play-tested at a table**, so expect rough edges: please report problems on the [issue tracker](${repo}/issues); the in-game guide's **Report a bug** button collects the details for you.`,
  section,
  '## Install',
  'You need **Foundry VTT v14** and your own copy of the Shadowrun Second Edition rulebook.',
  [
    "1. On Foundry's setup screen, open **Game Systems** and click **Install System**.",
    '2. Paste this into the **Manifest URL** box and click **Install**:',
    `   \`${repo}/releases/latest/download/system.json\``,
    '3. Create a world with **Shadowrun 2nd Edition (Unofficial)**. To try it out, press **Alt+T**, open the **GM panel**, and on its **Setup** tab click **Create the demo**.',
  ].join('\n'),
  `Already installed? Use the **Update** button in Game Systems. More in the [README](${repo}#install) and the full [CHANGELOG](${changelog}).`,
  '---',
  "Built with AI (Anthropic's Claude) under human direction. An unofficial fan project, not affiliated with or endorsed by The Topps Company, Catalyst Game Labs or Black Book Editions; Shadowrun is a trademark of The Topps Company, Inc. Contains no rulebook text.",
];
process.stdout.write(notes.join('\n\n') + '\n');
