// Crops a region of an image and enlarges it without smoothing, for judging a shot at its real pixels.
//
//   node scripts/crop.mjs <in.jpg> <out.png> <x> <y> <w> <h> [scale]
import fs from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright';

const [src, out, xs, ys, ws, hs, ss] = process.argv.slice(2);
if (!src || !out || !hs) { console.error('usage: node scripts/crop.mjs <in.jpg> <out.png> <x> <y> <w> <h> [scale]'); process.exit(1); }
const [x, y, w, h] = [xs, ys, ws, hs].map(Number);
const s = Number(ss ?? 4);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: w * s, height: h * s } });
  const data = `data:image/jpeg;base64,${fs.readFileSync(src).toString('base64')}`;
  await page.setContent(`<html><body style="margin:0;background:#111"><div style="width:${w * s}px;height:${h * s}px;overflow:hidden;position:relative"><img src="${data}" style="position:absolute;left:${-x * s}px;top:${-y * s}px;transform-origin:0 0;image-rendering:pixelated;width:auto" id="i"></div></body></html>`);
  await page.evaluate((k) => { const i = document.getElementById('i'); return new Promise((r) => { const go = () => { i.style.width = `${i.naturalWidth * k}px`; r(); }; if (i.complete) go(); else i.onload = go; }); }, s);
  fs.writeFileSync(out, await page.screenshot({ type: 'png' }));
  console.log(`crop: ${out}`);
} finally {
  await browser.close();
}
