/**
 * v0.90.0: the cover picture for the GitHub page and release. The painting (`docs/media/cover-art.jpg`, an original
 * AI-generated image the owner made from Claude's brief: no Shadowrun art, logo or lettering) gets the title on top in
 * the system's own font (Chakra Petch, bundled under the SIL OFL).
 *   npx tsx scripts/build-cover.ts   → docs/media/cover.jpg (1920×1080) and docs/media/social.jpg (1280×640)
 * Pure: returns the title layer as SVG text, sized for the picture it goes on.
 */

const MAGENTA = '#ff2fa0';
const CYAN = '#21e6ff';

/** The title layer: transparent, the title in the dark upper left. `fonts` is CSS with the @font-face rules. */
export function coverTitleSvg(width: number, height: number, fonts = ''): string {
  const s = width / 1920; // everything is laid out for 1920 wide
  const x = Math.round(84 * s);
  const n = (v: number) => Math.round(v * s * 10) / 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <style>${fonts}</style>
  <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#c9d3ff"/><stop offset="0.5" stop-color="#3b2a6e"/><stop offset="0.75" stop-color="#ff7ac8"/><stop offset="1" stop-color="#ffe2f4"/></linearGradient>
  <radialGradient id="shade" cx="0" cy="0" r="1"><stop offset="0" stop-color="#03020a" stop-opacity="0.55"/><stop offset="1" stop-color="#03020a" stop-opacity="0"/></radialGradient>
  <filter id="titleGlow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="${n(9)}" result="b"/><feFlood flood-color="${MAGENTA}" flood-opacity="0.85"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${n(4)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<ellipse cx="0" cy="0" rx="${n(1000)}" ry="${n(520)}" fill="url(#shade)"/>
<g font-family="Chakra Petch" font-weight="700">
  <text x="${x}" y="${n(180)}" font-size="${n(150)}" fill="url(#chrome)" stroke="${MAGENTA}" stroke-width="${n(3)}" letter-spacing="${n(5)}" filter="url(#titleGlow)">SR2e</text>
  <text x="${x + n(6)}" y="${n(232)}" font-size="${n(36)}" fill="${CYAN}" letter-spacing="${n(6)}" filter="url(#glow)">FOR FOUNDRY VTT</text>
  <text x="${x + n(8)}" y="${n(270)}" font-size="${n(18)}" font-weight="600" fill="#ece0ff" letter-spacing="${n(3.5)}">UNOFFICIAL 2ND EDITION RULES</text>
  <text x="${x + n(8)}" y="${n(296)}" font-size="${n(18)}" font-weight="600" fill="#ece0ff" letter-spacing="${n(3.5)}">A FAN PROJECT</text>
</g>
</svg>`;
}
