import { expect, test, type Page } from '@playwright/test';
import fixtures from '../../kit/data/fixtures.json' with { type: 'json' };
import catalog from '../../kit/data/catalog.json' with { type: 'json' };
import { code, hook, noErrors, openApp, watchErrors } from './helpers';

/** The two link messages and the empty bench offer, as kit/03-RULES.md words them. */
const MESSAGES = { BAD_LINK: 'This link does not hold a build.', NEWER_LINK: 'This link comes from a newer version.' };
const EMPTY = 'Start from an empty bench';

const pngSize = (b: Buffer) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });

async function openFresh(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 120_000 });
}

test.describe('links', () => {
  test.use({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });

  test('the copied link for each preset rebuilds it in a fresh context, with the fixture\'s share code', async ({ page, browser, baseURL }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await openApp(page);
    for (const p of fixtures.presets) {
      await hook(page, 'load', p.id);
      await hook(page, 'open', 'none');
      await page.getByRole('button', { name: 'Share' }).click();
      await page.getByRole('button', { name: 'Copy link' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Link copied.' }).first()).toBeVisible();
      const url = await page.evaluate(() => navigator.clipboard.readText());
      expect(url).toContain('#b=');
      await page.keyboard.press('Escape');
      // A fresh browser context: nothing saved, the link alone carries the build.
      const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
      const fresh = await ctx.newPage();
      const freshErrors = watchErrors(fresh);
      await openFresh(fresh, `${url.split('#')[0]}?hook=1#${url.split('#')[1]}`);
      expect(await code(fresh), p.id).toBe(p.encoded);
      await expect(fresh.getByRole('region', { name: 'Shared build' })).toBeVisible();
      await noErrors(freshErrors);
      await ctx.close();
    }
    await noErrors(errors);
  });

  test('a bad link and a newer version link each show their message and offer the empty bench', async ({ page }) => {
    const errors = watchErrors(page);
    for (const [name, error] of [['garbage string', 'BAD_LINK'], ['newer version', 'NEWER_LINK']] as const) {
      const d = fixtures.decodes.find((x) => x.name === name)!;
      expect(d.expect).toEqual({ error });
      await openFresh(page, `/?hook=1#b=${d.encoded}`);
      await hook(page, 'link', d.encoded);
      const notice = page.getByRole('status').filter({ hasText: MESSAGES[error] }).or(page.getByText(MESSAGES[error]));
      await expect(notice.first()).toBeVisible();
      const offer = page.getByRole('button', { name: EMPTY });
      await expect(offer).toBeVisible();
      await offer.click();
      await expect.poll(async () => (await hook<{ build: { case: unknown } }>(page, 'build')).build.case).toBeNull();
    }
    await noErrors(errors);
  });
});

test.describe('poster', () => {
  test.use({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });

  test('a poster in each format downloads at its stated pixel size', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    await hook(page, 'act', { type: 'name', name: 'Night Rig' });
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Export poster' }).click();
    // kit/05-DESIGN.md: portrait 2400 × 3000 and landscape 3840 × 2160.
    for (const [format, w, h] of [['Portrait', 2400, 3000], ['Landscape', 3840, 2160]] as const) {
      await page.getByRole('radio', { name: format }).click();
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export poster' }).click()]);
      expect(dl.suggestedFilename()).toBe('night-rig.png');
      const path = await dl.path();
      const { readFileSync } = await import('node:fs');
      expect(pngSize(readFileSync(path!)), format).toEqual({ w, h });
    }
    await noErrors(errors);
  });
});

test.describe('saved builds', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('save, rename, load and delete a build, and saving at the limit asks before replacing the oldest', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await openApp(page);
    const open = async () => { await page.getByRole('button', { name: 'Menu' }).click(); await page.getByRole('menuitem', { name: 'Saved builds' }).click(); };
    const dialog = page.getByRole('dialog', { name: 'Saved builds' });

    await hook(page, 'load', 'pocket');
    await hook(page, 'act', { type: 'name', name: 'First' });
    const first = await code(page);
    await open();
    await expect(dialog.getByText('No saved builds yet.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Save this build' }).click();
    await expect(dialog.getByText('First')).toBeVisible();

    await dialog.getByRole('button', { name: 'Rename' }).click();
    const input = dialog.getByRole('textbox', { name: 'New name' });
    await input.fill('Kept');
    await input.press('Enter');
    await expect(dialog.getByText('Kept')).toBeVisible();
    await page.keyboard.press('Escape');

    await hook(page, 'load', 'windbreak');
    await open();
    await dialog.getByRole('button', { name: 'Load' }).click();
    const loaded = await hook<{ build: { name: string; case: { id: string } } }>(page, 'build');
    expect(loaded.build.name).toBe('Kept');
    expect(loaded.build.case.id).toBe(fixtures.presets.find((p) => p.id === 'pocket')!.build.case!.id);
    expect(await code(page)).not.toBe(first);

    await open();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(dialog.getByText('No saved builds yet.')).toBeVisible();

    // Fill the list to its limit, then one more asks before replacing the oldest.
    for (let i = 0; i < catalog.constants.maxSavedBuilds; i++) {
      await hook(page, 'act', { type: 'name', name: `Build ${i + 1}` });
      await dialog.getByRole('button', { name: 'Save this build' }).click();
    }
    await expect(dialog.getByRole('listitem')).toHaveCount(catalog.constants.maxSavedBuilds);
    await hook(page, 'act', { type: 'name', name: 'One more' });
    await dialog.getByRole('button', { name: 'Save this build' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Replace the oldest?');
    await expect(dialog.getByRole('listitem')).toHaveCount(catalog.constants.maxSavedBuilds);
    await dialog.getByRole('button', { name: 'Replace the oldest' }).click();
    await expect(dialog.getByRole('listitem')).toHaveCount(catalog.constants.maxSavedBuilds);
    await expect(dialog.getByText('One more')).toBeVisible();
    await expect(dialog.getByText('Build 1', { exact: true })).toHaveCount(0);
    await noErrors(errors);
  });
});
