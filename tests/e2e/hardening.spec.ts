import { expect, test, type Page } from '@playwright/test';
import { build, hook, noErrors, openApp, settle, watchErrors } from './helpers';

type TierInfo = { setting: string; active: string };
type Cam = { distance: number; position: [number, number, number]; target: [number, number, number] };

async function reloadReady(page: Page) {
  await page.reload();
  await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 120_000 });
}

test.describe('tiers', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('C22: forcing High, Medium and Low in Settings each takes effect and survives a reload', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await openApp(page);
    for (const [label, tier] of [['Medium', 'medium'], ['Low', 'low'], ['High', 'high']] as const) {
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('menuitem', { name: 'Settings' }).click();
      await page.getByRole('dialog', { name: 'Settings' }).getByRole('radio', { name: label }).click();
      await settle(page);
      expect(await hook<TierInfo>(page, 'tier')).toEqual({ setting: tier, active: tier });
      await page.keyboard.press('Escape');
      await reloadReady(page);
      expect(await hook<TierInfo>(page, 'tier'), `${tier} after a reload`).toEqual({ setting: tier, active: tier });
      // The build is the same one, rebuilt at the tier's detail: still lit, still every part.
      expect((await build(page)).case).not.toBeNull();
    }
    await noErrors(errors);
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('C17: no travel in transitions, the intro is a still and the tour does not run', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openApp(page);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('switch', { name: /Follows the system|On/ }).click();
    await page.keyboard.press('Escape');

    // An install crossfades in place: every sampled pose is the part's home.
    await hook(page, 'act', { type: 'remove', category: 'gpu' });
    const card = page.locator('[data-part="gpu:apex3x"] [aria-describedby^="status-"]');
    await hook(page, 'open', 'tab-gpu');
    await card.click();
    const poses: number[][] = [];
    for (let i = 0; i < 12; i++) { const p = await hook<{ position: number[] } | null>(page, 'pose', 'gpu'); if (p) poses.push(p.position); await page.waitForTimeout(15); }
    await settle(page);
    const home = (await hook<{ position: number[] }>(page, 'pose', 'gpu')).position;
    expect(poses.length).toBeGreaterThan(0);
    for (const p of poses) expect(p).toEqual(home);

    // The intro is a still: its end frame at once.
    await hook(page, 'open', 'intro');
    const intro = await page.evaluate(() => { const w = (window as unknown as { __world: { intro: { title: number }; introTl: unknown } }).__world; return { title: w.intro.title, running: w.introTl !== null }; });
    expect(intro).toEqual({ title: 1, running: false });
    await expect(page.locator('#start-title')).toBeVisible({ timeout: 5000 });
    await hook(page, 'open', 'none');

    // Showcase leaves the camera where it is: no tour.
    await page.getByRole('radio', { name: 'Showcase' }).click();
    const a = await hook<Cam>(page, 'camera');
    await page.waitForTimeout(4500);
    const b = await hook<Cam>(page, 'camera');
    expect(b.position).toEqual(a.position);
    await noErrors(errors);
  });

  test('without reduced motion the Showcase tour moves the camera, and any input takes it', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openApp(page);
    await page.getByRole('radio', { name: 'Showcase' }).click();
    const a = await hook<Cam>(page, 'camera');
    await page.waitForTimeout(4500);
    const b = await hook<Cam>(page, 'camera');
    expect(b.position).not.toEqual(a.position);
    await page.mouse.move(720, 450);
    await page.mouse.down();
    await page.mouse.move(740, 455, { steps: 4 });
    await page.mouse.up();
    // The orbit eases out with damping after the hand lets go.
    await page.waitForTimeout(2000);
    const c = await hook<Cam>(page, 'camera');
    await page.waitForTimeout(1500);
    const d = await hook<Cam>(page, 'camera');
    expect(d.position.map((v) => Math.round(v * 1000))).toEqual(c.position.map((v) => Math.round(v * 1000)));
    await noErrors(errors);
  });
});

test.describe('failure states', () => {
  test('C19: with WebGL 2 unavailable the app shows its plain message and a still image, with no errors', async ({ page }) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === 'webgl2') return null;
        return (get as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof get;
    });
    await page.goto('/');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('WebGL 2');
    const img = alert.getByRole('img');
    await expect(img).toBeVisible();
    expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    await noErrors(errors);
  });

  test('a lost context keeps the build, says so and offers a reload', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'pocket');
    await hook(page, 'act', { type: 'name', name: 'Kept' });
    await page.evaluate(() => { const c = document.querySelector('canvas')!; (c.getContext('webgl2') as WebGL2RenderingContext).getExtension('WEBGL_lose_context')!.loseContext(); });
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Your build is saved');
    await alert.getByRole('button', { name: 'Reload' }).click();
    await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 120_000 });
    expect((await build(page)).name).toBe('Kept');
    // Losing the context logs a warning from the browser, not an error from the app.
    await noErrors(errors.filter((e) => !/CONTEXT_LOST|context lost/i.test(e)));
  });
});

test.describe('keyboard', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('G1: every interactive element is reachable by Tab and shows a focus ring', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openApp(page);
    const seen = new Set<string>();
    const missing: string[] = [];
    await page.locator('body').focus();
    for (let i = 0; i < 260; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const after = getComputedStyle(el, '::after');
        const has = (c: CSSStyleDeclaration) => (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2) || /0px 0px 0px [2-9]px/.test(c.boxShadow);
        // A card draws its ring on a layer over the whole card.
        const ring = has(cs) || has(after);
        const id = `${el.tagName}|${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? ''}|${Math.round(el.getBoundingClientRect().x)},${Math.round(el.getBoundingClientRect().y)}`;
        return { id, ring };
      });
      if (!f) continue;
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      if (!f.ring) missing.push(f.id);
    }
    // The bar, the panels, the tray tabs and cards are all in the walk.
    const all = [...seen].join('\n');
    // The mode switch and other radio groups use roving focus: the chosen option is the one Tab stop, arrows move within.
    for (const want of ['Glass', 'Power', 'Airflow', 'Build', 'Share', 'Menu', 'Wave', 'Open full sheet', 'Case']) expect(all, want).toContain(want);
    expect(missing, missing.join('\n')).toEqual([]);
    await noErrors(errors);
  });

  test('G2: dialogs trap focus, close on Escape and return focus', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    const share = page.getByRole('button', { name: 'Share' });
    await share.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Share this build' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(share).toBeFocused();
    await noErrors(errors);
  });
});
