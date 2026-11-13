import { expect, test } from '@playwright/test';
import { REELS, reelLength } from '../../src/world/reels';
import { build, code, hook, noErrors, openApp, watchErrors } from './helpers';

test.describe('demo reels', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the asterisk opens the menu, a reel plays from Prism with the pointer hidden, and Escape gives the bench back', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    await hook(page, 'set', { power: false, glass: false });
    const before = await code(page);

    await page.keyboard.press('*');
    const menu = page.getByRole('dialog', { name: 'Demo reels' });
    await expect(menu).toBeVisible();
    await expect(menu.locator('[data-reel]')).toHaveCount(REELS.length);
    for (const r of REELS) await expect(menu.locator(`[data-reel="${r.id}"]`)).toContainText(`${Math.round(reelLength(r))} s`);
    await expect(menu.locator('[data-reel]').first()).toBeEnabled({ timeout: 120_000 });

    // Typed shortcuts do not reach the bench while the menu is up.
    await page.keyboard.press('g');
    expect((await build(page)).glass).toBe(false);

    await menu.locator(`[data-reel="${REELS[0]!.id}"]`).click();
    await expect(menu).toHaveCount(0);
    const shield = page.locator('[class*="shield"]');
    await expect(shield).toHaveCSS('cursor', 'none');
    await expect.poll(async () => (await build(page)).name).toBe('Prism');
    const now = await build(page);
    expect(now.glass).toBe(true);
    await expect(page.locator('[role="switch"]', { hasText: 'Power' }).first()).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('p');
    await expect(page.locator('[role="switch"]', { hasText: 'Power' }).first()).toHaveAttribute('aria-checked', 'true');

    await page.keyboard.press('Escape');
    await expect(shield).toHaveCount(0);
    await expect.poll(() => code(page)).toBe(before);
    await noErrors(errors);
  });

  test('a still in the middle of a reel carries the cuts before it, and demoEnd puts everything back', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    const before = await code(page);
    const reel = REELS.find((r) => r.id === 'power')!;
    // Into the lighting run: Prism in Build mode on its third effect.
    const start = reel.shots[0]!.dur + reel.shots[1]!.dur;
    await hook(page, 'demo', 'power', start + 6.5);
    const b = await build(page);
    expect(b.name).toBe('Prism');
    expect((b.lighting as { effect: string }).effect).toBe('starlight');
    await hook(page, 'demoEnd');
    expect(await code(page)).toBe(before);
    await noErrors(errors);
  });
});
