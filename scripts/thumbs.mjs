// Renders a thumbnail of every part for the tray, from the Inspector at the part's front shot angle.
//
//   node scripts/thumbs.mjs              every part
//   node scripts/thumbs.mjs gpu ram      these categories only
//   node scripts/thumbs.mjs --force      write files even when the picture did not change
//
// Writes public/thumbs/<category>-<id>.jpg, and public/thumbs/case-<id>-<finish>.jpg for each finish of a case.
// The angle, zoom and fan size come from the part's front shot in scripts/shot-list.mjs, so a thumbnail always matches
// the view a verdict was given on. Thumbnails are 240 px squares drawn at twice the pixel density.
import fs from 'node:fs';
import process from 'node:process';
import { buildIfStale, capture, openBrowser, parseArgs, startPreview, watch } from './shots.mjs';
import { SHOTS } from './shot-list.mjs';

const SIZE = 240;
const OUT = 'public/thumbs';
const catalog = JSON.parse(fs.readFileSync('kit/data/catalog.json', 'utf8'));
const CATEGORIES = { case: 'cases', board: 'boards', cpu: 'cpus', cooler: 'coolers', ram: 'ram', gpu: 'gpus', storage: 'storage', psu: 'psus', fan: 'fans' };

const { flags, names } = parseArgs(process.argv.slice(2));
const jobs = [];
for (const [cat, key] of Object.entries(CATEGORIES)) {
  if (names.length && !names.includes(cat)) continue;
  for (const part of catalog[key]) {
    const front = SHOTS[`part/${cat}-${part.id}-front`];
    if (!front) throw new Error(`no front shot for ${cat} ${part.id}`);
    // A part not modeled yet (its front shot has never been taken) gets its thumbnail when it is built.
    if (!fs.existsSync(`shots/part/${cat}-${part.id}-front.jpg`)) { console.log(`skip: ${cat} ${part.id} is not built yet`); continue; }
    const inspect = front.steps.find((s) => s[0] === 'inspect');
    const rest = front.steps.filter((s) => s[0] !== 'inspect');
    const finishes = cat === 'case' ? part.finishes : [null];
    for (const finish of finishes) {
      const opts = { ...inspect[4], ...(finish ? { finish } : {}) };
      const file = finish ? `${OUT}/case-${part.id}-${finish}.jpg` : `${OUT}/${cat}-${part.id}.jpg`;
      jobs.push({ file, steps: [['inspect', cat, part.id, inspect[3], opts], ...rest] });
    }
  }
}

buildIfStale();
const { browser } = await openBrowser(flags);
const preview = await startPreview();
const errors = [];
try {
  for (const job of jobs) {
    const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 2 });
    watch(page, errors);
    await page.goto(`http://127.0.0.1:${preview.port}/?hook=1`, { waitUntil: 'load' });
    await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 300000 });
    for (const [method, ...args] of job.steps) await page.evaluate(([m, a]) => window.__pcb[m](...a), [method, args]);
    await page.evaluate(() => window.__pcb.settle());
    await capture(browser, page, job.file, flags.force);
    await page.close();
  }
} finally {
  preview.stop();
  await browser.close();
}
console.log(`thumbs: ${jobs.length}`);
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
