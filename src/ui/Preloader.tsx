import { useApp } from './hooks';
import { catalog } from '../data/catalog';
import { SHOWCASE } from '../data/showcase';
import { store, type Overlay } from '../state/store';
import type { World } from '../world/World';
import { warmBudget } from '../world/warm';
import s from './Preloader.module.css';

const BASE = import.meta.env.BASE_URL;
/** Weights of the preloader's own work against the warm-up's units: a probe frame, a thumbnail. */
const PROBE_UNIT = 0.25;
const THUMB_UNIT = 0.5;
/** After this long the preloader leaves and the rest warms in the background. */
const CAP_MS = 90_000;

/** What the preloader is doing, for the test hook. */
export const preload = { phase: 'idle' as 'idle' | 'core' | 'probe' | 'warm' | 'done', enterShown: false, warmDone: false, left: false, leftAt: null as number | null, percent: 0, error: null as string | null };

/** The thumbnails, decoded and held, so no tray tab pops in. */
const thumbs: HTMLImageElement[] = [];

function thumbUrls(): string[] {
  const out: string[] = [];
  for (const c of catalog.cases) for (const f of c.finishes) out.push(`${BASE}thumbs/case-${c.id}-${f}.jpg`);
  for (const [cat, key] of [['board', 'boards'], ['cpu', 'cpus'], ['cooler', 'coolers'], ['ram', 'ram'], ['gpu', 'gpus'], ['storage', 'storage'], ['psu', 'psus'], ['fan', 'fans']] as const) {
    for (const p of catalog[key] as { id: string }[]) out.push(`${BASE}thumbs/${cat}-${p.id}.jpg`);
  }
  for (const b of SHOWCASE) out.push(`${BASE}thumbs/build-${b.id}.jpg`);
  return out;
}

const $ = (id: string) => document.getElementById(id);

function paint(percent: number, status?: string) {
  const p = Math.max(0, Math.min(100, Math.floor(percent)));
  preload.percent = p;
  const fill = $('pl-fill'); const pct = $('pl-pct'); const bar = $('pl-bar'); const st = $('pl-status');
  if (fill) fill.style.transform = `scaleX(${p / 100})`;
  if (pct) pct.textContent = `${p} percent`;
  if (bar) bar.setAttribute('aria-valuenow', String(p));
  if (st && status) st.textContent = status;
}

function showEnter(onEnter: () => void) {
  const b = $('pl-enter') as HTMLButtonElement | null;
  if (!b || !b.hidden) return;
  b.hidden = false;
  b.onclick = onEnter;
  b.focus({ preventScroll: true });
  preload.enterShown = true;
}

/** Under the test hook the preloader stays out of the way, unless a shot asks for it. */
export function hidePreloaderNow() {
  const p = $('preloader');
  if (p) p.hidden = true;
}

/** A still of the preloader at a share of its work, for the named shots. */
export function showPreloaderAt(percent: number, status: string) {
  const p = $('preloader');
  if (!p) return;
  p.hidden = false;
  delete p.dataset.leaving;
  paint(percent, status);
  const b = $('pl-enter') as HTMLButtonElement | null;
  if (b) b.hidden = false;
}

let controller: AbortController | null = null;

/** Context loss: the warm-up stops and the plain message takes over. */
export function stopPreloader() {
  controller?.abort();
  hidePreloaderNow();
}

/**
 * The first thing a visitor sees, up to the bench: the world's core, the tier probe, then every part and program warmed,
 * and every thumbnail decoded. The Enter control shows once the house build is drawn and its programs exist; warming goes on
 * behind it. Left alone, the preloader leaves when the warm-up ends, or at the cap with the rest warming in the background.
 */
export async function runPreloader(world: World, next: Overlay, restoredName: string | null) {
  controller = new AbortController();
  const signal = controller.signal;
  const units = { probe: 0, probeTotal: 40, warm: 0, warmTotal: warmBudget(), thumbs: 0, thumbTotal: thumbUrls().length };
  let status = restoredName ? `Preparing ${restoredName}` : 'Preparing the bench';
  const update = (st?: string) => {
    if (st) status = st;
    const done = units.probe * PROBE_UNIT + units.warm + units.thumbs * THUMB_UNIT;
    const total = units.probeTotal * PROBE_UNIT + units.warmTotal + units.thumbTotal * THUMB_UNIT;
    if (!preload.left) paint((done / total) * 100, status);
  };
  const leave = () => {
    if (preload.left) return;
    preload.left = true;
    preload.leftAt = performance.now();
    store.setState({ ui: { ...store.getState().ui, overlay: next } });
    const p = $('preloader');
    if (!p) return;
    p.dataset.leaving = 'true';
    const done = () => { p.hidden = true; };
    p.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 700);
  };
  const cap = setTimeout(leave, CAP_MS);

  preload.phase = 'core';
  update(status);
  await world.ready;
  if (signal.aborted) return;
  preload.phase = 'probe';
  update('Measuring this device');
  await world.measureTier((d, t) => { units.probe = d; units.probeTotal = t; update(); });
  update(status);
  // The house build is drawn and its programs exist: the bench can be entered while the rest warms.
  showEnter(leave);

  const urls = thumbUrls();
  units.thumbTotal = urls.length;
  const thumbsDone = Promise.all(urls.map(async (url) => {
    const img = new Image();
    img.src = url;
    thumbs.push(img);
    try { await img.decode(); } catch (e) { console.error(e); }
    units.thumbs++;
    update();
  }));

  preload.phase = 'warm';
  try {
    await world.warm((d, t, st) => { units.warm = d; units.warmTotal = t; update(st); }, signal);
    await thumbsDone;
    preload.warmDone = true;
    preload.phase = 'done';
    units.warm = units.warmTotal;
    update('Ready');
  } catch (e) {
    if ((e as DOMException).name !== 'AbortError') { console.error(e); preload.error = String(e); }
  } finally {
    clearTimeout(cap);
    showEnter(leave);
    if (!signal.aborted) leave();
  }
}

/** When the automatic tier steps down while running: a short note while the new tier warms. */
export function TuningScrim() {
  const on = useApp((st) => st.tuning);
  if (!on) return null;
  return <div className={s.tuning} role="status">Tuning detail for this device</div>;
}
