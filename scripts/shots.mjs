// Screenshot harness. Verified at planning time in its --url mode and in its named shot loop.
//
//   node scripts/shots.mjs --url <url> --out <file> [--width 1440] [--height 900]
//     One shot of any page that sets window.__ready = true when it has drawn. Used in Phase 0 on the reference prototype.
//
//   node scripts/shots.mjs <name or prefix> [...more]
//     Named shots from scripts/shot-list.mjs, taken from the preview build with ?hook=1.
//     A word selects every shot whose name starts with it: "rig" is the whole group, "rig/night-rig" is five shots.
//     With no word it takes every shot. Never use * in a name. The shell would expand it.
//     Rebuilds first when any source file is newer than dist/, so a shot never shows an old build.
//
//   Options: --headed forces a visible window. --chrome <path> uses a specific browser binary.
//            --force writes every image even when it matches the one on disk.
//
// Each shot prints its path and the first 12 characters of its sha1. scripts/verdict.mjs records verdicts against that hash.
// A retake that matches the image already on disk prints "same" and leaves the file alone, so its verdicts keep counting.
// Every named shot is also noted in shots/manifest.json with the id of the build it came from. check-shots.mjs reads that.

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildId, distIsStale, readManifest, sha12, writeManifest } from './shot-rules.mjs';
import { SHOTS } from './shot-list.mjs';

const SOFTWARE = /swiftshader|llvmpipe|software/i;
const FIRST_PORT = 5311;
const LAST_PORT = 5319;

function buildIfStale() {
  if (!distIsStale()) return;
  console.log('build: dist is missing or older than the source, building');
  const run = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error('build failed');
}

function parseArgs(argv) {
  const flags = {}; const names = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--headed') flags.headed = true;
    else if (a === '--force') flags.force = true;
    else if (a.startsWith('--')) { flags[a.slice(2)] = argv[i + 1]; i++; }
    else names.push(a);
  }
  return { flags, names };
}

function launchOptions({ headed, chrome }) {
  const args = ['--ignore-gpu-blocklist'];
  if (process.platform === 'darwin') args.push('--enable-gpu', '--use-angle=metal');
  if (chrome) return { executablePath: chrome, headless: !headed, args };
  return { channel: 'chromium', headless: !headed, args };
}

async function rendererOf(page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  });
}

async function openBrowser(flags) {
  let headed = Boolean(flags.headed);
  let browser = await chromium.launch(launchOptions({ headed, chrome: flags.chrome }));
  let probe = await browser.newPage();
  await probe.goto('about:blank');
  let renderer = await rendererOf(probe);
  await probe.close();
  if (!headed && (renderer === 'none' || SOFTWARE.test(renderer))) {
    const headless = renderer;
    await browser.close();
    try {
      headed = true;
      browser = await chromium.launch(launchOptions({ headed, chrome: flags.chrome }));
      probe = await browser.newPage();
      await probe.goto('about:blank');
      renderer = await rendererOf(probe);
      await probe.close();
    } catch {
      headed = false;
      browser = await chromium.launch(launchOptions({ headed, chrome: flags.chrome }));
      renderer = headless;
    }
  }
  const hardware = renderer !== 'none' && !SOFTWARE.test(renderer);
  console.log(`renderer: ${renderer} · ${hardware ? 'hardware' : 'software'} · ${headed ? 'headed' : 'headless'}`);
  return { browser, renderer, hardware };
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
}

async function waitForServer(port, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const up = await new Promise((resolve) => {
      const c = net.connect(port, '127.0.0.1');
      c.once('connect', () => { c.destroy(); resolve(true); });
      c.once('error', () => resolve(false));
    });
    if (up) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview server did not start on port ${port}`);
}

async function startPreview() {
  let port = FIRST_PORT;
  while (port <= LAST_PORT && !(await portFree(port))) port++;
  if (port > LAST_PORT) throw new Error('no free port between 5311 and 5319');
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  await waitForServer(port);
  return { port, stop: () => child.kill() };
}

// Two captures count as the same image when no channel of any pixel differs by more than 16 levels
// and at most one sample in a thousand differs by more than 6. That absorbs encoder and driver noise only.
function sameImage(page, a, b) {
  return page.evaluate(async ([x, y]) => {
    const pixels = async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const g = canvas.getContext('2d');
      g.drawImage(bitmap, 0, 0);
      return g.getImageData(0, 0, bitmap.width, bitmap.height);
    };
    const [p, q] = [await pixels(x), await pixels(y)];
    if (p.width !== q.width || p.height !== q.height) return false;
    let soft = 0;
    for (let i = 0; i < p.data.length; i++) {
      const d = Math.abs(p.data[i] - q.data[i]);
      if (d > 16) return false;
      if (d > 6) soft++;
    }
    return soft <= p.data.length * 0.001;
  }, [a.toString('base64'), b.toString('base64')]);
}

// Returns the hash of the image that is on disk after the capture.
async function capture(browser, page, out, force) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const fresh = await page.screenshot({ type: 'jpeg', quality: 90, timeout: 180000 });
  if (!force && fs.existsSync(out)) {
    const old = fs.readFileSync(out);
    let same = old.equals(fresh);
    if (!same) {
      const bench = await browser.newPage();
      try { same = await sameImage(bench, old, fresh); } catch { same = false; }
      await bench.close();
    }
    if (same) { console.log(`same: ${out} · ${sha12(old)}`); return sha12(old); }
  }
  fs.writeFileSync(out, fresh);
  console.log(`shot: ${out} · ${sha12(fresh)}`);
  return sha12(fresh);
}

function watch(page, errors) {
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console error: ${m.text()}`); });
}

async function main() {
  const { flags, names } = parseArgs(process.argv.slice(2));
  const { browser } = await openBrowser(flags);
  const errors = [];
  let preview = null;
  try {
    if (flags.url) {
      const page = await browser.newPage({ viewport: { width: Number(flags.width || 1440), height: Number(flags.height || 900) }, deviceScaleFactor: 1 });
      watch(page, errors);
      await page.goto(flags.url, { waitUntil: 'load' });
      await page.waitForFunction('window.__ready === true', null, { timeout: 300000 });
      await capture(browser, page, flags.out || 'shots/setup/url.jpg', flags.force);
      await page.close();
    } else {
      const wanted = Object.keys(SHOTS).filter((n) => names.length === 0 || names.some((q) => n.startsWith(q)));
      if (wanted.length === 0) throw new Error('no shots match. Add them to scripts/shot-list.mjs.');
      buildIfStale();
      const build = buildId();
      const manifest = readManifest();
      preview = await startPreview();
      for (const name of wanted) {
        const shot = SHOTS[name];
        const page = await browser.newPage({ viewport: { width: shot.width || 1440, height: shot.height || 900 }, deviceScaleFactor: 1, hasTouch: Boolean(shot.touch) });
        watch(page, errors);
        await page.goto(`http://127.0.0.1:${preview.port}/?hook=1`, { waitUntil: 'load' });
        await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 300000 });
        for (const [method, ...args] of shot.steps) await page.evaluate(([m, a]) => window.__pcb[m](...a), [method, args]);
        await page.evaluate(() => window.__pcb.settle());
        const sha = await capture(browser, page, shot.out || `shots/${name}.jpg`, flags.force);
        manifest[name] = { sha, build };
        writeManifest(manifest);
        await page.close();
      }
    }
  } finally {
    if (preview) preview.stop();
    await browser.close();
  }
  if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
}

// Other scripts, such as scripts/thumbs.mjs, may import these and reuse the same browser, server and capture logic.
export { buildIfStale, capture, openBrowser, parseArgs, startPreview, watch };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
