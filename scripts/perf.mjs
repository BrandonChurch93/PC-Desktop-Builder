// Measures section P of kit/09-QA-GAUNTLET.md on the lit Night Rig hero through the hook, and the bundle and thumbnail sizes.
//
//   node scripts/perf.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildIfStale, openBrowser, startPreview } from './shots.mjs';

const lit = async (page, quality) => page.evaluate(async (q) => {
  const p = window.__pcb;
  await p.set({ quality: q });
  await p.load('night-rig');
  await p.mode('showcase');
  await p.set({ ui: false, glass: true, power: true, load: 0 });
  await p.cam('hero');
  await p.settle();
}, quality);

buildIfStale();
const { browser, renderer } = await openBrowser({});
const preview = await startPreview();
const url = `http://127.0.0.1:${preview.port}/?hook=1`;
const out = { renderer };
try {
  for (const [name, q, w, h] of [['P1 high', 'high', 1440, 900], ['P2 medium', 'medium', 1440, 900], ['P3 low', 'low', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url);
    await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 300000 });
    await lit(page, q);
    out[name] = await page.evaluate(() => window.__pcb.stats(5));
    out[name].tier = await page.evaluate(() => window.__pcb.tier());
    if (q === 'high') {
      // P4: power off, nothing moving, no input.
      await page.evaluate(async () => { await window.__pcb.mode('build'); await window.__pcb.set({ power: false }); await window.__pcb.settle(); });
      await page.waitForTimeout(1500);
      out['P4 idle'] = await page.evaluate(() => window.__pcb.stats(2));
    }
    await page.close();
  }
  // P7: a second load, so the browser's caches are warm.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (let i = 0; i < 2; i++) {
    await page.goto(url);
    await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 300000 });
  }
  out['P7 firstFrameMs'] = await page.evaluate(() => window.__pcb.timing().firstFrameMs);
  await ctx.close();
} finally {
  preview.stop();
  await browser.close();
}
const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : [path.join(d, e.name)]));
const js = files('dist').filter((f) => f.endsWith('.js'));
out['P6 js gzip bytes'] = js.reduce((a, f) => a + zlib.gzipSync(fs.readFileSync(f)).length, 0);
out['P6 thumbs bytes'] = files('public/thumbs').reduce((a, f) => a + fs.statSync(f).size, 0);
console.log(JSON.stringify(out, null, 1));
