import { expect, test, type Page } from '@playwright/test';
import catalog from '../../kit/data/catalog.json' with { type: 'json' };
import { SHOWCASE } from '../../src/data/showcase';
import { hook, noErrors, watchErrors } from './helpers';

type WarmState = { enterShown: boolean; warmDone: boolean; left: boolean; error: string | null; programs: number };
const warm = (page: Page) => hook<WarmState>(page, 'warmState');
const programs = (page: Page) => page.evaluate(() => (window as unknown as { __world: { renderer: { info: { programs: unknown[] } } } }).__world.renderer.info.programs.length);

test.describe('addendum 02: preloader and warm-up', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Enter shows before the warm-up ends, the page works after Enter, and no step after the warm-up compiles a program', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await page.goto('/?hook=1&warm=1');
    await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 120_000 });
    const enter = page.getByRole('button', { name: 'Enter the bench' });
    await expect(enter).toBeVisible({ timeout: 120_000 });
    expect((await warm(page)).warmDone, 'Enter shows while the warm-up still runs').toBe(false);
    await expect(page.locator('#pl-pct')).toHaveText(/^\d+ percent$/);

    // Enter: the preloader leaves, the interface takes input, and warming goes on behind it.
    await enter.click();
    await expect(page.locator('#preloader')).toBeHidden();
    const glass = page.getByRole('switch', { name: 'Glass' });
    const was = await glass.getAttribute('aria-checked');
    await glass.click();
    await expect(glass).not.toHaveAttribute('aria-checked', was!);
    await glass.click();

    await expect.poll(async () => { const s = await warm(page); return s.warmDone || s.error !== null; }, { timeout: 300_000, intervals: [1000] }).toBe(true);
    expect((await warm(page)).error).toBeNull();
    const ready = await programs(page);

    // Every preset, every part in the Inspector at its finishes and fan sizes, a held part, a selection, the air streams.
    for (const p of catalog.presets) await hook(page, 'load', p.id);
    // A fresh load is powered, so each preset lit as well.
    for (const p of catalog.presets) { await hook(page, 'load', p.id); await hook(page, 'set', { power: true }); }
    await hook(page, 'set', { power: false });
    // The showcase builds, as the Builds tab puts them on the bench: lit, then picked from, then the next one.
    for (const b of SHOWCASE) { await hook(page, 'load', b.id); await hook(page, 'set', { power: true }); await hook(page, 'select', 'gpu'); }
    await hook(page, 'set', { power: false });
    // A selection, then a new build: the shadow maps redraw, and the outline is the last pass to the screen.
    for (const p of catalog.presets) { await hook(page, 'load', p.id); await hook(page, 'select', 'gpu'); }
    await hook(page, 'load', 'night-rig');
    await page.evaluate(() => (window as unknown as { __pcb: { act: (a: unknown, o: unknown) => Promise<void> } }).__pcb.act({ type: 'swap', category: 'gpu', id: 'mini' }, { instant: false }));
    await page.waitForTimeout(3500);
    await hook(page, 'load', 'night-rig');
    await hook(page, 'hold', 'gpu', 'apex2x', 0);
    await hook(page, 'open', 'none');
    await hook(page, 'select', 'gpu');
    await hook(page, 'set', { airflow: true });
    await hook(page, 'set', { airflow: false });
    const parts = await hook<[string, string, Record<string, unknown>][]>(page, 'warmParts');
    expect(parts.length).toBeGreaterThanOrEqual(55);
    for (const [cat, id, o] of parts) await hook(page, 'inspect', cat, id, 30, o);
    await hook(page, 'open', 'none');
    const after = await programs(page);
    test.info().annotations.push({ type: 'programs', description: `${ready} at the end of the warm-up, ${after} after the cycle` });
    expect(after, `programs grew from ${ready} to ${after}`).toBeLessThanOrEqual(ready);
    await noErrors(errors);
  });
});
