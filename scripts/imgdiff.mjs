// Compares two images: prints how many pixels differ by more than 16 levels and where, and writes the difference
// amplified eight times as an image, for tracking down frames that are not the same from run to run.
//
//   node scripts/imgdiff.mjs <a.jpg> <b.jpg> <out.png>
import fs from 'node:fs';
import process from 'node:process';
import { openBrowser } from './shots.mjs';

const [a, b, out] = process.argv.slice(2);
if (!a || !b || !out) { console.error('usage: node scripts/imgdiff.mjs <a.jpg> <b.jpg> <out.png>'); process.exit(1); }
const { browser } = await openBrowser({});
try {
  const page = await browser.newPage();
  const res = await page.evaluate(async ([x, y]) => {
    const load = async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bm = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
      const c = new OffscreenCanvas(bm.width, bm.height); const g = c.getContext('2d'); g.drawImage(bm, 0, 0);
      return g.getImageData(0, 0, bm.width, bm.height);
    };
    const p = await load(x); const q = await load(y);
    const w = p.width; const h = p.height;
    const outC = new OffscreenCanvas(w, h); const og = outC.getContext('2d'); const od = og.createImageData(w, h);
    let n = 0; let x0 = w; let y0 = h; let x1 = -1; let y1 = -1; let max = 0;
    for (let i = 0; i < w * h; i++) {
      let m = 0;
      for (let k = 0; k < 3; k++) m = Math.max(m, Math.abs(p.data[i * 4 + k] - q.data[i * 4 + k]));
      max = Math.max(max, m);
      if (m > 16) { n++; const px = i % w; const py = (i / w) | 0; x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
      const v = Math.min(255, m * 8);
      od.data[i * 4] = v; od.data[i * 4 + 1] = v; od.data[i * 4 + 2] = v; od.data[i * 4 + 3] = 255;
    }
    og.putImageData(od, 0, 0);
    const blob = await outC.convertToBlob({ type: 'image/png' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (const c of buf) s += String.fromCharCode(c);
    return { n, max, box: [x0, y0, x1, y1], png: btoa(s) };
  }, [fs.readFileSync(a).toString('base64'), fs.readFileSync(b).toString('base64')]);
  fs.writeFileSync(out, Buffer.from(res.png, 'base64'));
  console.log(`imgdiff: ${res.n} pixels over 16 · max ${res.max} · box ${res.box.join(',')} · ${out}`);
} finally {
  await browser.close();
}
