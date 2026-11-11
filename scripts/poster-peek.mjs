// Exports a preset's poster in both formats through the real dialog and saves the downloads, for looking at them.
//
//   node scripts/poster-peek.mjs [preset]
import fs from 'node:fs';
import process from 'node:process';
import { buildIfStale, openBrowser, startPreview, watch } from './shots.mjs';

const preset = process.argv[2] ?? 'night-rig';
buildIfStale();
const { browser } = await openBrowser({});
const preview = await startPreview();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  watch(page, errors);
  await page.goto(`http://127.0.0.1:${preview.port}/?hook=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 300000 });
  await page.evaluate(async (p) => { await window.__pcb.load(p); await window.__pcb.act({ type: 'name', name: 'Night Rig' }); await window.__pcb.open('poster'); }, preset);
  fs.mkdirSync('shots/peek', { recursive: true });
  for (const format of ['Portrait', 'Landscape']) {
    await page.getByRole('radio', { name: format }).click();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByRole('button', { name: 'Export poster' }).click()]);
    const out = `shots/peek/poster-${format.toLowerCase()}.png`;
    await dl.saveAs(out);
    const b = fs.readFileSync(out);
    console.log(`poster: ${out} · ${dl.suggestedFilename()} · ${b.readUInt32BE(16)} × ${b.readUInt32BE(20)}`);
  }
} finally {
  preview.stop();
  await browser.close();
}
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
