import { expect, test, type Page } from '@playwright/test';
import { build, hook, noErrors, openApp, settle, watchErrors } from './helpers';

type Place = { key: string; ok: boolean; message: string | null; x: number | null; y: number | null };
const places = (page: Page, category: string, id: string) => hook<Place[]>(page, 'places', category, id);
const card = (page: Page, category: string, id: string) => page.locator(`[data-part="${category}:${id}"] [aria-describedby^="status-"]`).first();

async function openTab(page: Page, category: string) {
  await page.locator(`[role="tab"][id$="-tab-${category}"]`).first().click();
}

/** A real mouse drag from a card to a point, in steps, as a hand moves. */
async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, release = true) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const n = 18;
  for (let i = 1; i <= n; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / n, from.y + ((to.y - from.y) * i) / n);
  if (release) await page.mouse.up();
}

async function center(sel: ReturnType<typeof card>) {
  const b = (await sel.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test('mouse: a graphics card dragged from the tray to its place installs', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'night-rig');
  await hook(page, 'act', { type: 'remove', category: 'gpu' });
  await openTab(page, 'gpu');
  const p = (await places(page, 'gpu', 'apex2x')).find((x) => x.ok)!;
  await mouseDrag(page, await center(card(page, 'gpu', 'apex2x')), { x: p.x!, y: p.y! });
  await settle(page);
  expect((await build(page)).gpu).toBe('apex2x');
  await noErrors(errors);
});

test('mouse: a card too long for the case shows the reason over its place, and nothing installs', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'pocket');
  await hook(page, 'act', { type: 'remove', category: 'gpu' });
  await openTab(page, 'gpu');
  const p = (await places(page, 'gpu', 'apex3x'))[0]!;
  expect(p.ok).toBe(false);
  await mouseDrag(page, await center(card(page, 'gpu', 'apex3x')), { x: p.x!, y: p.y! }, false);
  await expect(page.getByRole('status').filter({ hasText: 'Too long. This card is 322 mm and the case has 310 mm free.' })).toBeVisible();
  await page.mouse.up();
  await settle(page);
  expect((await build(page)).gpu).toBeNull();
  await noErrors(errors);
});

test('mouse: an installed part dragged out of the case is removed', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'night-rig');
  const at = (await hook<{ x: number; y: number }>(page, 'screen', 'gpu'))!;
  // Select it, then drag the selected part out past the case's edge.
  await page.mouse.click(at.x, at.y);
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as { __pcb: { build: () => unknown } }).__pcb && document.querySelector('[role="menu"]') !== null)).toBe(true);
  await mouseDrag(page, at, { x: 60, y: at.y });
  await settle(page);
  expect((await build(page)).gpu).toBeNull();
  await noErrors(errors);
});

test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /** Raw touch input through one CDP session, as a finger: start, moves, end. */
  async function finger(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    return (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: x!, y: y!, id: 1 }] });
  }

  test('a long press, a drag and a drop installs a part', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    await hook(page, 'act', { type: 'remove', category: 'gpu' });
    await page.locator('[role="tab"][id$="-tab-gpu"]').first().tap();
    await card(page, 'gpu', 'apex2x').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const from = await center(card(page, 'gpu', 'apex2x'));
    const p = (await places(page, 'gpu', 'apex2x')).find((x) => x.ok)!;
    const touch = await finger(page);
    await touch('touchStart', from.x, from.y);
    await page.waitForTimeout(350);
    for (let i = 1; i <= 16; i++) { await touch('touchMove', from.x + ((p.x! - from.x) * i) / 16, from.y + ((p.y! - from.y) * i) / 16); await page.waitForTimeout(16); }
    await touch('touchEnd');
    await settle(page);
    expect((await build(page)).gpu).toBe('apex2x');
    await noErrors(errors);
  });

  test('a short swipe on the card row scrolls it and installs nothing', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    await hook(page, 'act', { type: 'remove', category: 'gpu' });
    await page.locator('[role="tab"][id$="-tab-gpu"]').first().tap();
    const row = page.locator('[role="list"]').first();
    const before = await row.evaluate((el) => el.scrollLeft);
    const from = await center(card(page, 'gpu', 'apex3x'));
    const touch = await finger(page);
    await touch('touchStart', from.x, from.y);
    for (let i = 1; i <= 10; i++) { await touch('touchMove', from.x - i * 18, from.y); await page.waitForTimeout(12); }
    await touch('touchEnd');
    await page.waitForTimeout(600);
    expect(await row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before + 20);
    expect((await build(page)).gpu).toBeNull();
    await noErrors(errors);
  });
});
