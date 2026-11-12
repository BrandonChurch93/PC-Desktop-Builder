import { expect, test, type Locator, type Page } from '@playwright/test';
import { build, hook, noErrors, openApp, watchErrors } from './helpers';

const row = (page: Page) => page.locator('[role="list"][aria-label$=" parts"]').first();
const tabs = (page: Page) => page.locator('[role="tablist"][aria-label="Part categories"]').first();
const left = (l: Locator) => l.evaluate((el) => el.scrollLeft);
const overflows = (l: Locator) => l.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
/** The scroll positions at which a card sits where snapping puts it, and the end of the row. */
const rests = (l: Locator) => l.evaluate((el) => {
  const pad = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
  const base = el.getBoundingClientRect().left - el.scrollLeft;
  const max = el.scrollWidth - el.clientWidth;
  return [...[...el.children].map((c) => Math.max(0, Math.min(max, c.getBoundingClientRect().left - base - pad))), max];
});

async function openTab(page: Page, category: string) {
  await page.locator(`[role="tab"][id$="-tab-${category}"]`).first().click();
}

async function mouseDrag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const n = 16;
  for (let i = 1; i <= n; i++) await page.mouse.move(from.x + (dx * i) / n, from.y + (dy * i) / n);
}

async function centerOf(l: Locator) {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test.describe('a tray row wider than the window', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('a sideways mouse drag scrolls the row and comes to rest on a card, without picking the part up or clicking it', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await openTab(page, 'case');
    const r = row(page);
    expect(await overflows(r), 'the case row overflows at 1024 px').toBe(true);
    const before = JSON.stringify(await build(page));
    const card = r.locator('[data-part="case:bulwark"]');
    await mouseDrag(page, await centerOf(card), -320, 6);
    expect(await hook(page, 'held'), 'a sideways drag holds nothing').toBeNull();
    await page.mouse.up();
    await expect.poll(() => left(r)).toBeGreaterThan(200);
    await expect.poll(async () => { const at = await left(r); return (await rests(r)).some((p) => Math.abs(p - at) <= 1); }, { message: 'the glide ends on a card edge' }).toBe(true);
    expect(await hook(page, 'held')).toBeNull();
    expect(JSON.stringify(await build(page)), 'the drag did not click a card').toBe(before);

    // Dragging back the other way scrolls back.
    const was = await left(r);
    await mouseDrag(page, await centerOf(r), 260, 0);
    await page.mouse.up();
    await expect.poll(() => left(r)).toBeLessThan(was);
    await noErrors(errors);
  });

  test('an upward mouse drag from a card still picks the part up', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await openTab(page, 'gpu');
    const card = row(page).locator('[data-part="gpu:mini"]');
    await card.scrollIntoViewIfNeeded();
    await mouseDrag(page, await centerOf(card), 10, -220);
    const held = await hook<{ category: string; id: string; how: string } | null>(page, 'held');
    expect(held).toMatchObject({ category: 'gpu', id: 'mini', how: 'drag' });
    await page.mouse.up();
    await noErrors(errors);
  });

  test('a drag that starts sideways and then leaves the row upward picks up the card under the hand', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await openTab(page, 'case');
    const r = row(page);
    const from = await centerOf(r.locator('[data-part="case:bulwark"]'));
    await mouseDrag(page, from, -160, 4);
    expect(await hook(page, 'held'), 'still scrolling').toBeNull();
    expect(await left(r)).toBeGreaterThan(100);
    const top = (await r.boundingBox())!.y;
    const n = 12;
    for (let i = 1; i <= n; i++) await page.mouse.move(from.x - 160, from.y + 4 - ((from.y - top + 120) * i) / n);
    expect(await hook(page, 'held')).toMatchObject({ category: 'case', id: 'bulwark', how: 'drag' });
    await page.mouse.up();
    await noErrors(errors);
  });

  test('a mouse wheel scrolls the row sideways', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await openTab(page, 'case');
    const r = row(page);
    const c = await centerOf(r);
    await page.mouse.move(c.x, c.y);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => left(r)).toBeGreaterThan(100);
    await noErrors(errors);
  });
});

test.describe('category tabs wider than the window', () => {
  test.use({ viewport: { width: 820, height: 1180 } });

  test('a sideways mouse drag scrolls the tabs and does not switch tab', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    const t = tabs(page);
    expect(await overflows(t), 'the tabs overflow at 820 px').toBe(true);
    await t.evaluate((el) => { el.scrollLeft = 0; });
    const active = await t.locator('[aria-selected="true"]').getAttribute('id');
    await mouseDrag(page, await centerOf(t.locator('[role="tab"]').nth(2)), -200, 0);
    await page.mouse.up();
    await expect.poll(() => left(t)).toBeGreaterThan(50);
    expect(await t.locator('[aria-selected="true"]').getAttribute('id'), 'the drag did not click a tab').toBe(active);
    await noErrors(errors);
  });
});

test.describe('touch, as on a tablet', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false });

  test('a swipe across the row scrolls it and holds nothing', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'the swipe is a Chromium input gesture');
    const errors = watchErrors(page);
    await openApp(page);
    await openTab(page, 'case');
    const r = row(page);
    expect(await overflows(r)).toBe(true);
    const c = await centerOf(r);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(c.x), y: Math.round(c.y), xDistance: -400, yDistance: 0, gestureSourceType: 'touch', speed: 1200 });
    await expect.poll(() => left(r)).toBeGreaterThan(150);
    expect(await hook(page, 'held')).toBeNull();
    await noErrors(errors);
  });
});
