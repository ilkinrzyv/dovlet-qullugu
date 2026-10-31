// Renders the app icons (a columned public building on the book's teal) to PNG with Chromium.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const OUT = path.join(__dirname, 'icons');
fs.mkdirSync(OUT, { recursive: true });
const BG = '#0F6B7A', FG = '#F5F3EC';

function glyph(scale) {
  // drawn on a 512 grid; pediment, four columns and a stepped base span ~100..412, centred on 256
  return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)" fill="none" stroke="${FG}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M110 190L256 108L402 190Z" stroke-width="28" fill="${FG}" fill-opacity=".16"/>
    <path d="M158 236V340M222 236V340M290 236V340M354 236V340" stroke-width="32"/>
    <path d="M118 380H394" stroke-width="30"/>
    <path d="M100 414H412" stroke-width="22" stroke-opacity=".7"/>
  </g>`;
}
function svg(rounded, scale, size) {
  const dim = size ? ` width="${size}" height="${size}"` : '';
  const bg = rounded ? `<rect width="512" height="512" rx="112" fill="${BG}"/>` : `<rect width="512" height="512" fill="${BG}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"${dim}>${bg}${glyph(scale)}</svg>`;
}

const JOBS = [
  ['icon-192.png', 192, true, 1],
  ['icon-512.png', 512, true, 1],
  ['maskable-192.png', 192, false, 0.76],
  ['maskable-512.png', 512, false, 0.76],
  ['apple-touch-icon.png', 180, false, 0.8],
  ['favicon-32.png', 32, true, 1.08],
];

(async () => {
  fs.writeFileSync(path.join(OUT, 'icon.svg'), svg(true, 1.04));
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size, rounded, scale] of JOBS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg(rounded, scale, size)}</body></html>`);
    await page.screenshot({ path: path.join(OUT, name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  }
  // preview sheet for review
  await page.setViewportSize({ width: 1100, height: 240 });
  await page.setContent(`<!doctype html><html><body style="margin:0;padding:20px;display:flex;gap:24px;align-items:center;background:#ddd">
    ${JOBS.map(([n]) => `<figure style="margin:0;text-align:center;font:12px sans-serif"><img src="data:image/png;base64,${fs.readFileSync(path.join(OUT, n)).toString('base64')}" style="max-width:150px;${n.startsWith('maskable') ? 'border-radius:50%' : ''}"><figcaption>${n}</figcaption></figure>`).join('')}
  </body></html>`);
  await page.screenshot({ path: path.join(__dirname, 'shots', 'icons-preview.png') });
  await browser.close();
  console.log('icons done');
})();
