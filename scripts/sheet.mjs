// Tiles images into one sheet with a caption under each, for reviewing many shots at once and for the brand contact sheets.
//
//   node scripts/sheet.mjs <out.jpg> <columns> <tile width px> <image> [image ...]
//
// Captions are the file names without folder or extension. The sheet is drawn by Chromium from data URLs, no server needed.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const [out, colsArg, tileArg, ...files] = process.argv.slice(2);
const cols = Number(colsArg); const tile = Number(tileArg);
if (!out || !cols || !tile || files.length === 0) {
  console.error('usage: node scripts/sheet.mjs <out.jpg> <columns> <tile width px> <image> [image ...]');
  process.exit(1);
}
const missing = files.filter((f) => !fs.existsSync(f));
if (missing.length) { console.error(`missing: ${missing.join(', ')}`); process.exit(1); }

const cells = files.map((f) => {
  const ext = path.extname(f).slice(1).toLowerCase() === 'png' ? 'png' : 'jpeg';
  const data = fs.readFileSync(f).toString('base64');
  return `<figure><img src="data:image/${ext};base64,${data}"><figcaption>${path.basename(f).replace(/\.[^.]+$/, '')}</figcaption></figure>`;
}).join('');
const html = `<!doctype html><html><head><style>
  html, body { margin: 0; background: #121219; color: #c9ccd6; font: 500 13px system-ui, sans-serif; }
  main { display: grid; grid-template-columns: repeat(${cols}, ${tile}px); gap: 10px; padding: 10px; width: max-content; }
  figure { margin: 0; } img { display: block; width: ${tile}px; height: auto; }
  figcaption { padding: 4px 2px 0; }
</style></head><body><main>${cells}</main></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  const main = await page.$('main');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await main.screenshot({ path: out, type: 'jpeg', quality: 90 });
  console.log(`sheet: ${out} · ${files.length} images`);
} finally {
  await browser.close();
}
