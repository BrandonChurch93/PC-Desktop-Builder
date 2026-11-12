// Opens the app with the warm-up, waits for it, and measures shader programs before and after a cycle through every preset,
// every part in the Inspector, a held part, a selection and the airflow view. Prints the numbers as JSON.
//
//   node scripts/warm-check.mjs [--cycle]
import process from 'node:process';
import { buildIfStale, openBrowser, startPreview, watch } from './shots.mjs';

const cycle = process.argv.includes('--cycle');
buildIfStale();
const { browser } = await openBrowser({});
const preview = await startPreview();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page, errors);
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${preview.port}/?hook=1&warm=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 300000 });
  const enterAt = await page.waitForFunction('window.__pcb.warmState().enterShown', null, { timeout: 300000 }).then(() => Date.now() - t0);
  const midWarm = await page.evaluate(() => window.__pcb.warmState().warmDone);
  await page.waitForFunction('window.__pcb.warmState().warmDone || window.__pcb.warmState().error', null, { timeout: 600000, polling: 500 });
  const warmAt = Date.now() - t0;
  const st = await page.evaluate(() => window.__pcb.warmState());
  const out = { enterShownMs: enterAt, enterBeforeWarmDone: !midWarm, warmDoneMs: warmAt, programsAtWarm: st.programs, error: st.error, timing: await page.evaluate(() => window.__pcb.timing()), slowest: [...st.timings].sort((a, b) => b.ms - a.ms).slice(0, 12) };
  if (cycle) {
    out.cycle = await page.evaluate(async () => {
      const p = window.__pcb; const w = window.__world; const n = () => w.renderer.info.programs.length;
      const log = [];
      for (const id of ['night-rig', 'white-out', 'windbreak', 'flagship', 'pocket', 'open-frame']) { await p.load(id); log.push([`preset ${id}`, n()]); }
      await p.load('night-rig');
      await p.hold('gpu', 'apex2x', 0); log.push(['held', n()]);
      await p.open('none');
      await p.select('gpu'); log.push(['select', n()]);
      await p.set({ airflow: true }); log.push(['airflow', n()]);
      await p.set({ airflow: false });
      return log;
    });
    out.inspect = await page.evaluate(async (parts) => {
      const p = window.__pcb; const w = window.__world; const n = () => w.renderer.info.programs.length; const log = [];
      for (const [cat, id, o] of parts) { await p.inspect(cat, id, 30, o); log.push([`${cat} ${id}`, n()]); }
      await p.open('none');
      return log;
    }, await page.evaluate(() => window.__pcb.warmParts()));
    out.programsAfter = await page.evaluate(() => window.__world.renderer.info.programs.length);
  }
  console.log(JSON.stringify(out, null, 1));
} finally {
  preview.stop();
  await browser.close();
}
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
