import { expect, test, type Page } from '@playwright/test';
import { SHOWCASE } from '../../src/data/showcase';
import { build, hook, noErrors, openApp, watchErrors } from './helpers';

const sw = (page: Page, name: string) => page.locator('[role="switch"]', { hasText: name }).first();
const card = (page: Page, id: string) => page.locator(`[data-build="${id}"]`).first();

test.describe('the Builds tab', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('comes before Case, and each card puts its build on the bench lit with the glass on, undoable', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    await hook(page, 'set', { power: false, glass: false });

    const tabs = page.locator('[role="tablist"][aria-label="Part categories"]').first().locator('[role="tab"]');
    await expect(tabs.nth(0)).toHaveText('Builds');
    await expect(tabs.nth(1)).toHaveText(/^Case/);
    await tabs.nth(0).click();
    await expect(page.locator('[data-build]')).toHaveCount(SHOWCASE.length);

    for (const b of SHOWCASE) {
      await card(page, b.id).locator('button').click();
      await expect(card(page, b.id).locator(`#status-build-${b.id}`)).toHaveText('On the bench');
      const now = await build(page);
      expect(now.name).toBe(b.name);
      expect(now.case).toEqual(b.build.case);
      expect(now.gpu).toBe(b.build.gpu);
      expect(now.fans).toEqual(b.build.fans);
      expect((now.lighting as { stops: string[] }).stops).toEqual(b.build.lighting.stops);
      await expect(sw(page, 'Power')).toHaveAttribute('aria-checked', 'true');
      await expect(sw(page, 'Glass')).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('[data-build][class*="cardOn"]')).toHaveCount(1);
    }

    // Undo takes the last build back off; the card before it is on the bench again.
    await page.getByRole('button', { name: 'Undo' }).first().click();
    const prev = SHOWCASE[SHOWCASE.length - 2]!;
    await expect(card(page, prev.id).locator(`#status-build-${prev.id}`)).toHaveText('On the bench');

    // Any change makes it the user's own build: no card is on the bench.
    await page.locator('[role="tab"][id$="-tab-cables"]').first().click();
    await page.locator('[data-part="cables:frost"] [aria-describedby^="status-"]').first().click();
    await tabs.nth(0).click();
    await expect(page.locator('[data-build][class*="cardOn"]')).toHaveCount(0);
    await noErrors(errors);
  });

  test('a sideways drag over the cards scrolls the row and loads nothing', async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 820, height: 900 });
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    await hook(page, 'open', 'tab-builds');
    const row = page.locator('[role="list"][aria-label="Showcase builds"]').first();
    const box = (await row.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 40, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width - 40 - i * 40, y);
    await page.mouse.up();
    await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    expect((await build(page)).name).not.toBe(SHOWCASE[0]!.name);
    expect((await build(page)).case).toEqual({ id: 'vitrine', finish: 'onyx' });
    await noErrors(errors);
  });
});
