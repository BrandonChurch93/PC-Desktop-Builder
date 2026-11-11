import { expect, test } from '@playwright/test';
import fixtures from '../../kit/data/fixtures.json' with { type: 'json' };
import { code, hook, noErrors, openApp, settle, watchErrors } from './helpers';

test.describe('smoke', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

  test('C18: loads, shows a preset and installs a part by tap, with no errors @smoke', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await openApp(page);
    // These engines may draw in software here: the phone tier keeps the run quick. Taps and keys only.
    await hook(page, 'set', { quality: 'low' });
    await hook(page, 'load', 'pocket');
    expect(await code(page)).toBe(fixtures.presets.find((p) => p.id === 'pocket')!.encoded);
    await hook(page, 'act', { type: 'remove', category: 'gpu' });
    await hook(page, 'open', 'tab-gpu');
    const card = page.locator('[data-part="gpu:mini"] [aria-describedby^="status-"]');
    await card.scrollIntoViewIfNeeded();
    await card.tap();
    await settle(page);
    expect((await hook<{ build: { gpu: string } }>(page, 'build')).build.gpu).toBe('mini');
    await expect(page.getByRole('status').filter({ hasText: 'installed' }).first()).toBeAttached();
    await noErrors(errors);
  });
});
