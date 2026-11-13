// Stills of a demo reel, for checking its shots without recording it.
//
//   node scripts/reel-stills.mjs <reel id> [--every 1] [--at 3,7.5] [--width 1920] [--height 1080]
//
// Writes shots/reel/<reel>-<seconds>.jpg for each time, and shots/reel/<reel>-sheet.jpg with all of them.
// Each still has the reel's bench and camera set at once at that time, on a frozen clock.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { buildIfStale, openBrowser, parseArgs, startPreview, watch } from './shots.mjs';

const { flags, names } = parseArgs(process.argv.slice(2));
const id = names[0];
if (!id) { console.error('usage: node scripts/reel-stills.mjs <reel id> [--every 1] [--at 3,7.5]'); process.exit(1); }
const width = Number(flags.width ?? 1920); const height = Number(flags.height ?? 1080);
const dir = path.join('shots', 'reel');
fs.mkdirSync(dir, { recursive: true });

buildIfStale();
const { browser } = await openBrowser(flags);
const preview = await startPreview();
const errors = [];
const files = [];
try {
  const page = await browser.newPage({ viewport: { width, height } });
  watch(page, errors);
  await page.goto(`http://127.0.0.1:${preview.port}/?hook=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 300000 });
  await page.evaluate(() => window.__pcb.open('none'));
  const length = await page.evaluate((id) => window.__pcb.demoLength(id), id);
  const every = Number(flags.every ?? 1);
  const times = flags.at ? String(flags.at).split(',').map(Number) : Array.from({ length: Math.floor(length / every) + 1 }, (_, i) => Math.min(length - 0.05, i * every + 0.05));
  for (const t of times) {
    await page.evaluate(async ([id, t]) => { await window.__pcb.demo(id, t); await window.__pcb.freeze(t); }, [id, t]);
    const file = path.join(dir, `${id}-${t.toFixed(2).padStart(5, '0')}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
    files.push(file);
    console.log(file);
  }
} finally {
  preview.stop();
  await browser.close();
}
if (errors.length) { console.log(errors.join('\n')); process.exitCode = 1; }
const sheet = spawnSync('node', ['scripts/sheet.mjs', path.join(dir, `${id}-sheet.jpg`), '4', '480', ...files], { stdio: 'inherit' });
if (sheet.status !== 0) process.exitCode = 1;
