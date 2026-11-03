/**
 * Print the HTML scanner's current `fix` rows as allow-list entries (helpers/html-allow.ts format), so the lead can
 * regenerate a file's list after its code changes and review only the new rows.
 *
 *   npx tsx src/module/__tests__/helpers/scan-dump.mts                 # documents/index.ts (the default)
 *   npx tsx src/module/__tests__/helpers/scan-dump.mts src/module/applications/chat.ts
 *   npx tsx src/module/__tests__/helpers/scan-dump.mts all            # every file
 *
 * Run it from the repo root. Rows already listed keep their reason; new rows print `TODO: review` with the line, and
 * entries that no longer match any row are printed at the end as stale. Notification rows are never listed (they are
 * a separate count ratchet in v0811-scan.test.ts).
 */
import { scanHtml, type HtmlScanRow } from './html-scan.ts';
import { ALLOWED, OPEN, allowKey } from './html-allow.ts';

const want = process.argv[2] ?? 'src/module/documents/index.ts';
const rows = scanHtml(process.cwd()).filter((r) => r.verdict.startsWith('fix') && r.sink !== 'notification' && (want === 'all' || r.file === want));
const byFile = new Map<string, Map<string, HtmlScanRow[]>>();
for (const r of rows) {
  const m = byFile.get(r.file) ?? new Map<string, HtmlScanRow[]>();
  byFile.set(r.file, m);
  const k = allowKey(r);
  m.set(k, [...(m.get(k) ?? []), r]);
}
const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
let todo = 0;
for (const [file, m] of [...byFile].sort()) {
  console.log(`  ${q(file)}: {`);
  for (const [k, rs] of [...m].sort((a, b) => a[1][0]!.line - b[1][0]!.line)) {
    const reason = ALLOWED[file]?.[k] ?? OPEN[file]?.[k];
    if (!reason) todo++;
    console.log(`    ${q(k)}:\n      ${q(reason ?? `TODO: review (line ${rs.map((r) => r.line).join(', ')}: ${rs[0]!.verdict})`)},`);
  }
  console.log('  },');
}
const stale: string[] = [];
for (const list of [ALLOWED, OPEN]) {
  for (const [file, entries] of Object.entries(list)) {
    if (want !== 'all' && file !== want) continue;
    for (const k of Object.keys(entries)) if (!byFile.get(file)?.has(k)) stale.push(`${file}: ${k}`);
  }
}
console.log(`\n// ${rows.length} rows, ${todo} new (TODO), ${stale.length} stale${stale.length ? `:\n//   ${stale.join('\n//   ')}` : ''}`);
