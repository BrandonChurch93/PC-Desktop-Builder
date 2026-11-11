// Prints the average color of a small square in each image, for comparing a region between two shots.
//
//   node scripts/pixel.mjs <x> <y> <size> <a.jpg> [b.jpg ...]
import fs from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright';

const [xs, ys, ss, ...files] = process.argv.slice(2);
const [x, y, s] = [xs, ys, ss].map(Number);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const f of files) {
    const data = `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`;
    const c = await page.evaluate(async ([src, x, y, s]) => {
      const img = new Image(); img.src = src; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(x, y, s, s).data; const t = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) { t[0] += d[i]; t[1] += d[i + 1]; t[2] += d[i + 2]; }
      return t.map((v) => Math.round(v / (s * s)));
    }, [data, x, y, s]);
    console.log(`${f}: rgb(${c.join(', ')})`);
  }
} finally { await browser.close(); }
