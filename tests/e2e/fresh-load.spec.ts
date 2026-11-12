import { expect, test, type Page } from '@playwright/test';
import { hook, noErrors, openApp, watchErrors } from './helpers';

const sw = (page: Page, name: string) => page.locator('[role="switch"]', { hasText: name }).first();

/** The real app, as a visitor opens it: the preloader, then Enter the bench. */
async function openForReal(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the bench' }).click({ timeout: 120_000 });
  await expect(page.locator('#preloader')).toBeHidden();
}

test.describe('a fresh load', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a returning visitor whose build was saved with the glass off and the power off gets both on', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    await sw(page, 'Glass').click();
    await expect(sw(page, 'Glass')).toHaveAttribute('aria-checked', 'false');
    const saved = await page.evaluate(() => (window as unknown as { __pcb: { build: () => { code: string } } }).__pcb.build().code);
    await page.evaluate((code) => localStorage.setItem('dpcb.v1.current', code), saved);

    await openForReal(page);
    await expect(sw(page, 'Glass')).toHaveAttribute('aria-checked', 'true');
    await expect(sw(page, 'Power')).toHaveAttribute('aria-checked', 'true');
    await noErrors(errors);
  });

  test('a returning visitor with nothing saved sees the start overlay over a lit rig', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await page.goto('/?hook=1');
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dpcb.v1.settings', JSON.stringify({ quality: 'auto', reducedMotion: 'system', introSeen: true })); });
    await openForReal(page);
    await expect(sw(page, 'Glass')).toHaveAttribute('aria-checked', 'true');
    await expect(sw(page, 'Power')).toHaveAttribute('aria-checked', 'true');
    await noErrors(errors);
  });
});
