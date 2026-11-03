/**
 * v0.90.0: the cover pictures: the painting (docs/media/cover-art.jpg) with the title (src/art/cover.ts) in the bundled
 * Chakra Petch font.
 *   npm run cover   → docs/media/cover.jpg (1920×1080: the README; also copied to public/media/ for system.json's media
 *                     and background) and docs/media/social.jpg (1280×640, GitHub's social preview)
 * Needs Playwright with Chromium (a developer tool, not a package dependency: `npx playwright install chromium`).
 */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { coverTitleSvg } from '../src/art/cover.ts';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? 'playwright');

const outDir = resolve(process.argv[2] ?? 'docs/media');
const art = `data:image/jpeg;base64,${readFileSync(resolve('docs/media/cover-art.jpg')).toString('base64')}`;
const font = (file: string, weight: number) => `@font-face{font-family:'Chakra Petch';font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(resolve('public/fonts', file)).toString('base64')}) format('woff2');}`;
const fonts = font('chakra-petch-latin-700-normal.woff2', 700) + font('chakra-petch-latin-600-normal.woff2', 600);

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
for (const [name, w, h] of [['cover.jpg', 1920, 1080], ['social.jpg', 1280, 640]] as const) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  // The painting fills the frame (cropped evenly top and bottom for the wider social picture); the title sits on top.
  await page.setContent(`<!doctype html><html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;position:relative;background:#000">
    <img src="${art}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%">
    <div style="position:absolute;inset:0">${coverTitleSvg(w, h, fonts)}</div></body></html>`);
  await page.evaluate(() => (document as any).fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, name), type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
  console.log(`${name} → ${join(outDir, name)}`);
}
await browser.close();
if (!process.argv[2]) { mkdirSync(resolve('public/media'), { recursive: true }); copyFileSync(join(outDir, 'cover.jpg'), resolve('public/media/cover.jpg')); console.log('cover.jpg → public/media/cover.jpg'); }
