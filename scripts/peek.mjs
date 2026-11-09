// A look at the app from any set of hook steps, for working on a part. Not a named shot and not in the ledger.
//
//   node scripts/peek.mjs <file.json> [more.json]
//
// Each file holds { "out": "shots/peek/name.jpg", "width": 800, "height": 800, "steps": [["inspect", "ram", "facet32", 0, {}], ["freeze", 3.2]] }
// or a list of those. It rebuilds when the source is newer than dist/ and uses the same browser and server as the harness.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { buildIfStale, openBrowser, startPreview, watch } from './shots.mjs';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node scripts/peek.mjs <file.json>'); process.exit(1); }
const jobs = files.flatMap((f) => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(j) ? j : [j]; });
buildIfStale();
const { browser } = await openBrowser({});
const preview = await startPreview();
const errors = [];
try {
  for (const job of jobs) {
    const page = await browser.newPage({ viewport: { width: job.width || 1440, height: job.height || 900 }, deviceScaleFactor: job.scale || 1 });
    watch(page, errors);
    await page.goto(`http://127.0.0.1:${preview.port}/?hook=1`, { waitUntil: 'load' });
    await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 300000 });
    if (job.before) await page.evaluate(job.before);
    for (const [m, ...a] of job.steps) await page.evaluate(([mm, aa]) => window.__pcb[mm](...aa), [m, a]);
    await page.evaluate(() => window.__pcb.settle());
    if (job.eval) console.log(JSON.stringify(await page.evaluate(job.eval)));
    fs.mkdirSync(path.dirname(job.out), { recursive: true });
    fs.writeFileSync(job.out, await page.screenshot({ type: 'jpeg', quality: 90, ...(job.clip ? { clip: job.clip } : {}) }));
    console.log(`peek: ${job.out}`);
    await page.close();
  }
} finally {
  preview.stop();
  await browser.close();
}
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
