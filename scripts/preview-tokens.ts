/**
 * v0.83.0: renders a contact sheet of token art for checking by eye.
 *   npx tsx scripts/preview-tokens.ts <out.png> <module> [<module>...]
 * Each module exports `files(): ArtFile[]` (or `previewFiles()`). Shows each token at 160 px and 56 px
 * (about a token on the map at normal zoom), with its file name.
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? 'playwright');
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [out, ...mods] = process.argv.slice(2);
if (!out || !mods.length) { console.error('usage: preview-tokens <out.png> <module>...'); process.exit(1); }
const all: Array<{ file: string; svg: string }> = [];
for (const m of mods) {
  const mod: any = await import(pathToFileURL(resolve(m)).href);
  const list = (mod.previewFiles ?? mod.files)();
  all.push(...list);
}
const cells = all.map((f) => {
  const src = 'data:image/svg+xml;base64,' + Buffer.from(f.svg).toString('base64');
  return `<figure><img src="${src}" width="160" height="160"><img src="${src}" width="56" height="56"><figcaption>${f.file} · ${(f.svg.length / 1024).toFixed(1)} KB</figcaption></figure>`;
}).join('');
const html = `<!doctype html><html><body style="margin:0;background:#3a4048;font:12px sans-serif;color:#eee">
<div style="display:grid;grid-template-columns:repeat(5,240px);gap:8px;padding:8px">${cells}</div>
<style>figure{margin:0;display:flex;flex-wrap:wrap;align-items:end;gap:6px;background:#2a2f36;padding:6px}figcaption{width:100%;word-break:break-all}</style></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1250, height: 600 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`${all.length} tokens → ${out}`);
