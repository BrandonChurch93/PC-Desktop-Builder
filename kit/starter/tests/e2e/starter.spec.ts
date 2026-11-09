import { expect, test } from '@playwright/test';

test('the app loads @smoke', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main')).toContainText('Desktop PC Builder');
});
