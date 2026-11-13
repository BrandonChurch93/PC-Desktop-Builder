// Plays demo reels live, as a person recording would: the asterisk opens the menu, a reel is clicked, it runs to its end.
//
//   node scripts/reel-live.mjs [reel id ...] [--video] [--width 1920] [--height 1080]
//
// For each reel it reports the frame gaps (the worst ones and how many passed 50 ms), whether any program compiled while it
// played, and takes a few live frames to shots/reel/live-<reel>-<seconds>.jpg. Escape must give the bench back as it was.
// --video also records shots/reel/live-<reel>.webm.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { buildIfStale, openBrowser, parseArgs, startPreview, watch } from './shots.mjs';

const { flags, names } = parseArgs(process.argv.slice(2));
const width = Number(flags.width ?? 1920); const height = Number(flags.height ?? 1080);
const dir = path.join('shots', 'reel');
fs.mkdirSync(dir, { recursive: true });

buildIfStale();
const { browser } = await openBrowser(flags);
const preview = await startPreview();
const errors = [];
let failed = false;
try {
  const context = await browser.newContext({ viewport: { width, height }, ...(flags.video ? { recordVideo: { dir, size: { width: 1280, height: 720 } } } : {}) });
  const page = await context.newPage();
  watch(page, errors);
  await page.goto(`http://127.0.0.1:${preview.port}/?hook=1&warm=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__pcb && window.__pcb.ready === true && window.__pcb.warmState().leftAt !== null', null, { timeout: 300000 });
  await page.evaluate(async () => { await window.__pcb.open('none'); await window.__pcb.load('night-rig'); await window.__pcb.set({ power: true }); });
  const before = await page.evaluate(() => window.__pcb.build().code);
  const ids = names.length ? names : await page.evaluate(() => [...document.querySelectorAll('[data-reel]')].map((e) => e.getAttribute('data-reel')));
  await page.keyboard.press('*');
  await page.waitForSelector('[data-reel]');
  const all = names.length ? names : await page.evaluate(() => [...document.querySelectorAll('[data-reel]')].map((e) => e.getAttribute('data-reel')));
  const t0 = Date.now();
  await page.waitForFunction(() => !document.querySelector('[data-reel]')?.hasAttribute('disabled'), null, { timeout: 120000 });
  console.log(`menu ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.screenshot({ path: path.join(dir, 'live-menu.jpg'), type: 'jpeg', quality: 82 });
  await page.keyboard.press('Escape');
  for (const id of ids.length ? ids : all) {
    await page.keyboard.press('*');
    await page.waitForFunction(() => document.querySelector('[data-reel]') && !document.querySelector('[data-reel]').hasAttribute('disabled'), null, { timeout: 120000 });
    const length = await page.evaluate((id) => window.__pcb.demoLength(id), id);
    const programs = await page.evaluate(() => window.__pcb.warmState().programs);
    await page.evaluate(() => {
      const g = (window.__gaps = []); let last = performance.now();
      const tick = () => { const n = performance.now(); g.push([Math.round(n - last), Math.round((n - window.__reelStart) / 100) / 10]); last = n; if (window.__gaps === g) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await page.evaluate((id) => { window.__reelStart = performance.now(); document.querySelector(`[data-reel="${id}"]`).click(); }, id);
    const snaps = [2, length * 0.25, length * 0.5, length * 0.75, length - 1];
    for (const at of snaps) {
      const wait = at * 1000 - (await page.evaluate(() => performance.now() - window.__reelStart));
      if (wait > 0) await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(dir, `live-${id}-${at.toFixed(1)}.jpg`), type: 'jpeg', quality: 80 });
    }
    await page.waitForTimeout(Math.max(0, length * 1000 + 800 - (await page.evaluate(() => performance.now() - window.__reelStart))));
    const r = await page.evaluate(() => { const g = window.__gaps.filter(([, at]) => at > 0.6); window.__gaps = null; return g; });
    const after = await page.evaluate(() => window.__pcb.warmState().programs);
    const worst = [...r].sort((a, b) => b[0] - a[0]).slice(0, 6).map(([ms, at]) => `${ms}ms@${at}s`).join(' ');
    const slow = r.filter(([ms]) => ms > 50).length;
    const median = [...r].map(([ms]) => ms).sort((a, b) => a - b)[Math.floor(r.length / 2)];
    console.log(`${id}: ${length} s, ${r.length} frames, median ${median} ms, ${slow} over 50 ms, worst ${worst}, programs ${programs} -> ${after}`);
    if (after !== programs) failed = true;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => window.__pcb.build().code);
    if (back !== before) { console.log(`${id}: the bench did not come back`); failed = true; }
  }
  await context.close();
} finally {
  preview.stop();
  await browser.close();
}
if (errors.length) { console.log(errors.join('\n')); failed = true; }
if (failed) process.exitCode = 1;
