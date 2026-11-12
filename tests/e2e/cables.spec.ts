import { expect, test, type Page } from '@playwright/test';
import { build, hook, noErrors, openApp, watchErrors } from './helpers';

/** How many cable sets the rig holds, and whether the one left is the current set. */
const cableSets = (page: Page) => page.evaluate(() => {
  const w = (window as unknown as { __world: { rig: { group: { children: { name: string }[] }; cables: unknown } } }).__world;
  const live = w.rig.group.children.filter((o) => o.name === 'cables');
  return { count: live.length, current: live.length === 1 && live[0] === w.rig.cables };
});

const pick = (page: Page, id: string) => page.locator(`[data-part="cables:${id}"] [aria-describedby^="status-"]`).first().click();

test.describe('cable colorways', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('picking a colorway in the tray replaces the cables, and switching fast through every colorway leaves only the last', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    await page.locator('[role="tab"][id$="-tab-cables"]').first().click();

    await pick(page, 'onyx');
    expect((await build(page)).cables).toBe('onyx');
    await expect.poll(() => cableSets(page), { timeout: 5000 }).toEqual({ count: 1, current: true });

    for (const id of ['ember', 'frost', 'tide', 'citrine', 'orchid', 'onyx', 'ember']) { await pick(page, id); await page.waitForTimeout(150); }
    expect((await build(page)).cables).toBe('ember');
    await expect.poll(() => cableSets(page), { timeout: 5000 }).toEqual({ count: 1, current: true });
    await noErrors(errors);
  });
});
