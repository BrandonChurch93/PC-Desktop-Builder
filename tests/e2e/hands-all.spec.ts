import { expect, test, type Page } from '@playwright/test';
import { build, enterCard, hook, noErrors, openApp, settle, watchErrors } from './helpers';

type Place = { key: string; ok: boolean; x: number | null; y: number | null };
type Pose = { position: number[]; opacity: number } | null;
type Cam = { distance: number; focus: string | null };

/** For each category: how to start (the Night Rig with that part out), the part to put in, and the place it goes. */
const CASES: { category: string; id: string; setup: (page: Page) => Promise<void>; place?: string; check: (b: Record<string, unknown>) => boolean }[] = [
  { category: 'case', id: 'vitrine', setup: (p) => hook(p, 'empty'), check: (b) => (b.case as { id: string } | null)?.id === 'vitrine' },
  { category: 'board', id: 'z7', setup: async (p) => { await hook(p, 'load', 'night-rig'); await hook(p, 'act', { type: 'remove', category: 'board' }); }, check: (b) => b.board === 'z7' },
  { category: 'cpu', id: 'ember8', setup: async (p) => { await hook(p, 'load', 'night-rig'); await hook(p, 'act', { type: 'remove', category: 'cpu' }); }, check: (b) => b.cpu === 'ember8' },
  { category: 'cooler', id: 'tarn360-lux', place: 'cooler:top', setup: async (p) => { await hook(p, 'load', 'night-rig'); await hook(p, 'act', { type: 'remove', category: 'cooler' }); }, check: (b) => (b.cooler as { id: string; mount: string } | null)?.mount === 'top' },
  { category: 'ram', id: 'facet32', setup: async (p) => { await hook(p, 'load', 'night-rig'); await hook(p, 'act', { type: 'remove', category: 'ram', opts: { index: 0 } }); }, check: (b) => (b.ram as string[]).length === 1 },
  { category: 'gpu', id: 'apex3x', setup: async (p) => { await hook(p, 'load', 'night-rig'); await hook(p, 'act', { type: 'remove', category: 'gpu' }); }, check: (b) => b.gpu === 'apex3x' },
  { category: 'storage', id: 'nvme', setup: (p) => hook(p, 'load', 'night-rig'), check: (b) => (b.storage as { nvme: number }).nvme === 2 },
  { category: 'psu', id: 't850', setup: async (p) => { await hook(p, 'load', 'night-rig'); await hook(p, 'act', { type: 'remove', category: 'psu' }); }, check: (b) => b.psu === 't850' },
  { category: 'fan', id: 'gale-lux', place: 'fan:rear-1', setup: async (p) => { await hook(p, 'load', 'night-rig'); await hook(p, 'act', { type: 'remove', category: 'fan', opts: { mount: 'rear-1' } }); }, check: (b) => (b.fans as Record<string, string>)['rear-1'] === 'gale-lux' },
];

const card = (page: Page, category: string, id: string) => page.locator(`[data-part="${category}:${id}"] [aria-describedby^="status-"]`).first();

async function target(page: Page, c: (typeof CASES)[number]) {
  const places = await hook<Place[]>(page, 'places', c.category, c.id);
  return places.find((p) => (c.place ? p.key === c.place : p.ok))!;
}

for (const c of CASES) {
  test(`${c.category}: installs by drag, by tap and by keyboard`, async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    // Drag.
    await c.setup(page);
    await page.locator(`[role="tab"][id$="-tab-${c.category}"]`).first().click();
    await card(page, c.category, c.id).scrollIntoViewIfNeeded();
    const b = (await card(page, c.category, c.id).boundingBox())!;
    const to = await target(page, c);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 16; i++) await page.mouse.move(b.x + b.width / 2 + ((to.x! - b.x - b.width / 2) * i) / 16, b.y + b.height / 2 + ((to.y! - b.y - b.height / 2) * i) / 16);
    await page.mouse.up();
    await settle(page);
    expect(c.check(await build(page)), 'drag').toBe(true);
    // Tap: the card, then the place when the part has more than one.
    await c.setup(page);
    await card(page, c.category, c.id).click();
    await settle(page);
    if (c.place) { const p = await target(page, c); await page.mouse.click(p.x!, p.y!); await settle(page); }
    expect(c.check(await build(page)), 'tap').toBe(true);
    // Keyboard: Enter on the card puts it in the first free place.
    await c.setup(page);
    await enterCard(page, c.category, c.id);
    expect(c.check(await build(page)), 'keyboard').toBe(true);
    await noErrors(errors);
  });
}

/** Starts an action without waiting for it, then samples the part's pose while it plays. */
async function samplesDuring(page: Page, action: Record<string, unknown>, category: string, opts: Record<string, unknown>) {
  return page.evaluate(async ([a, cat, o]) => {
    const pcb = (window as unknown as { __pcb: { act: (x: unknown, y: unknown) => Promise<void>; pose: (c: string, o: unknown) => Pose } }).__pcb;
    const out: Pose[] = [pcb.pose(cat as string, o)];
    const done = pcb.act(a, { instant: false });
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 30)); out.push(pcb.pose(cat as string, o)); }
    await done;
    out.push(pcb.pose(cat as string, o));
    return out;
  }, [action, category, opts] as const);
}

const moved = (a: Pose, b: Pose) => !!a && !!b && Math.hypot(a.position[0]! - b.position[0]!, a.position[1]! - b.position[1]!, a.position[2]! - b.position[2]!) > 1;

const REMOVES: { category: string; opts: Record<string, unknown>; swap?: string }[] = [
  { category: 'board', opts: {} }, { category: 'cpu', opts: {} }, { category: 'cooler', opts: {}, swap: 'tarn240' }, { category: 'ram', opts: { index: 0 }, swap: 'mono32' },
  { category: 'gpu', opts: {}, swap: 'apex2x' }, { category: 'storage', opts: { type: 'nvme' } }, { category: 'psu', opts: {}, swap: 't1000' }, { category: 'fan', opts: { mount: 'rear-1' }, swap: 'petal' },
  { category: 'case', opts: {}, swap: 'vent' },
];

test('C23: remove and swap play a motion in every category, and none with reduced motion', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  for (const r of REMOVES) {
    await hook(page, 'load', 'night-rig');
    const s = await samplesDuring(page, { type: 'remove', category: r.category, opts: r.opts }, r.category, r.opts);
    const start = s[0]!;
    expect(s.slice(1, -1).some((p) => moved(p, start) || (p !== null && p.opacity < 1 && p.opacity > 0)), `remove ${r.category} moves`).toBe(true);
    expect(s[s.length - 1], `remove ${r.category} ends gone`).toBeNull();
    if (r.swap) {
      await hook(page, 'load', 'night-rig');
      const w = await samplesDuring(page, { type: 'swap', category: r.category, opts: r.opts, id: r.swap }, r.category, r.opts);
      const end = w[w.length - 1]!;
      expect(end, `swap ${r.category} ends in place`).not.toBeNull();
      expect(w.slice(1, -1).some((p) => moved(p, end)), `swap ${r.category} travels`).toBe(true);
    }
  }
  // Reduced motion: no travel, only a short fade.
  await hook(page, 'set', { reducedMotion: true });
  for (const r of REMOVES) {
    await hook(page, 'load', 'night-rig');
    const s = await samplesDuring(page, { type: 'remove', category: r.category, opts: r.opts }, r.category, r.opts);
    expect(s.slice(1, -1).filter((p) => p !== null).every((p) => !moved(p, s[0]!)), `reduced ${r.category} has no travel`).toBe(true);
  }
  await noErrors(errors);
});

test('C21: double click focuses a part, Escape and the reset control return, and zoom stops at its caps', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'night-rig');
  await hook(page, 'cam', 'hero');
  const before = await hook<Cam>(page, 'camera');
  const at = (await hook<{ x: number; y: number }>(page, 'screen', 'gpu'))!;
  await page.mouse.dblclick(at.x, at.y);
  await settle(page);
  const focused = await hook<Cam>(page, 'camera');
  expect(focused.focus).toBe('gpu');
  expect(focused.distance).toBeLessThan(before.distance);
  // Zoom in hard: the focused cap is 0.12 m.
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -400);
  await page.waitForTimeout(800);
  expect((await hook<Cam>(page, 'camera')).distance).toBeGreaterThanOrEqual(0.119);
  await page.keyboard.press('Escape');
  await settle(page);
  const back = await hook<Cam>(page, 'camera');
  expect(back.focus).toBeNull();
  expect(Math.abs(back.distance - before.distance)).toBeLessThan(0.02);
  // Again, back by the reset control.
  await page.mouse.dblclick(at.x, at.y);
  await settle(page);
  await page.getByRole('button', { name: 'Reset view' }).click();
  await settle(page);
  expect((await hook<Cam>(page, 'camera')).focus).toBeNull();
  // Free zoom stops at 0.2 m.
  for (let i = 0; i < 60; i++) await page.mouse.wheel(0, -400);
  await page.waitForTimeout(800);
  expect((await hook<Cam>(page, 'camera')).distance).toBeGreaterThanOrEqual(0.199);
  await noErrors(errors);
});
