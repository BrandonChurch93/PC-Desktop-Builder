import { expect, test, type Page } from '@playwright/test';
import catalog from '../../kit/data/catalog.json' with { type: 'json' };
import { build, code, hook, noErrors, openApp, settle, watchErrors } from './helpers';

type Profile = { effect: string; speed: number; brightness: number; direction: number; stops: string[] };
type Lighting = Profile & { overrides: Record<string, Profile | 'off'> };
type Zone = { part: string; target: string; colors: number[][] };

const lighting = async (page: Page) => (await build(page)).lighting as Lighting;
const panel = (page: Page) => page.locator('section[aria-labelledby="lighting-title"]');

async function reloadKeeps(page: Page) {
  await page.waitForTimeout(600);
  const before = await code(page);
  const l = await lighting(page);
  await page.reload();
  await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 120_000 });
  await hook(page, 'open', 'none');
  expect(await code(page)).toBe(before);
  expect(await lighting(page)).toEqual(l);
}

/** One control: what it does to the lighting, checked on the build and on its share code, and kept across a reload. */
async function step(page: Page, act: () => Promise<void>, want: (l: Lighting, before: Lighting) => void) {
  const before = await lighting(page);
  const c0 = await code(page);
  await act();
  await settle(page);
  const after = await lighting(page);
  want(after, before);
  expect(await code(page), 'the share code changes with the lighting').not.toBe(c0);
  await reloadKeeps(page);
}

const presetProfile = (id: string) => {
  const p = catalog.lighting.presets.find((x) => x.id === id)!;
  return { effect: p.effect, speed: p.speed, brightness: p.brightness, direction: p.direction, stops: p.stops };
};

test.describe('lighting', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('C11: every lighting control changes the build and its share code, and survives a reload', async ({ page }) => {
    test.setTimeout(400_000);
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    await hook(page, 'act', { type: 'name', name: 'Lit' });
    await hook(page, 'set', { power: true });
    const P = panel(page);

    await step(page, () => P.getByRole('radio', { name: 'Static' }).click(), (l) => expect(l.effect).toBe('static'));
    await step(page, () => P.getByRole('radio', { name: 'Wave' }).click(), (l) => expect(l.effect).toBe('wave'));
    await step(page, () => P.getByRole('radio', { name: 'Reverse' }).click(), (l) => expect(l.direction).toBe(-1));
    await step(page, async () => { await P.getByLabel('Speed').focus(); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight'); },
      (l, b) => expect(l.speed).toBe(Math.min(catalog.lighting.speed.max, b.speed + 5)));
    await step(page, async () => { await P.getByLabel('Brightness').focus(); for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft'); },
      (l, b) => expect(l.brightness).toBe(b.brightness - 3));
    await step(page, () => P.getByRole('button', { name: 'Add a color' }).click(), (l, b) => { expect(l.stops.length).toBe(b.stops.length + 1); expect(l.stops.slice(0, b.stops.length)).toEqual(b.stops); });
    await step(page, async () => {
      await P.getByRole('option').first().click();
      const hex = P.getByLabel('Hex color');
      await hex.fill('#12AB34');
      await hex.press('Enter');
    }, (l, b) => { expect(l.stops[0]).toBe('#12ab34'); expect(l.stops.slice(1)).toEqual(b.stops.slice(1)); });
    await step(page, async () => {
      await P.getByRole('option').first().click();
      await P.getByRole('button', { name: 'Remove the selected color' }).click();
    }, (l, b) => expect(l.stops).toEqual(b.stops.slice(1)));
    await step(page, () => P.getByRole('button', { name: /^Ember$/ }).click(), (l) => {
      const { overrides, ...main } = l;
      expect(main).toEqual(presetProfile('ember'));
      expect(overrides).toEqual({});
    });

    // Targets: memory gets its own profile, then its own effect; the main profile does not move. Which profile the panel
    // edits is interface state, not part of the build, so after each reload the test chooses Memory again.
    const memory = () => P.getByRole('list', { name: 'Lighting targets' }).getByRole('button', { name: /^Memory/ }).click();
    await memory();
    await step(page, () => P.getByRole('radiogroup', { name: 'Memory lighting' }).getByRole('radio', { name: 'Own' }).click(), (l) => {
      const { overrides, ...main } = l;
      expect(overrides.ram).toEqual(main);
    });
    await memory();
    await step(page, () => P.getByRole('radio', { name: 'Static' }).click(), (l, b) => {
      expect((l.overrides.ram as Profile).effect).toBe('static');
      expect(l.effect).toBe(b.effect);
    });
    await memory();
    await step(page, () => P.getByRole('radiogroup', { name: 'Memory lighting' }).getByRole('radio', { name: 'Off' }).click(), (l) => expect(l.overrides.ram).toBe('off'));
    await step(page, () => P.getByRole('switch', { name: 'Synced' }).click(), (l) => expect(l.overrides).toEqual({}));
    await noErrors(errors);
  });

  test('C11: an override changes only its target\'s zones, and Off turns only that target dark', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    await hook(page, 'set', { power: true, ui: false });
    await hook(page, 'freeze', 3.2);
    const zones = () => hook<Zone[]>(page, 'zones');
    const byTarget = (zs: Zone[]) => new Set(zs.map((z) => z.target));
    const before = await zones();
    for (const t of ['ram', 'gpu']) expect(byTarget(before).has(t), `the Night Rig has lit ${t} zones`).toBe(true);
    expect(before.some((z) => z.colors.some((c) => c.some((v) => v > 0.01))), 'the rig is lit').toBe(true);

    await hook(page, 'act', { type: 'scopeLighting', target: 'ram', patch: { effect: 'static', stops: ['#ff9a1f', '#ff3b1f'] } });
    await hook(page, 'freeze', 3.2);
    const own = await zones();
    expect(own.length).toBe(before.length);
    own.forEach((z, i) => {
      const was = before[i]!;
      expect(z.part).toBe(was.part);
      if (z.target === 'ram') expect(z.colors, `${z.part} takes memory's own profile`).not.toEqual(was.colors);
      else expect(z.colors, `${z.part} is untouched`).toEqual(was.colors);
    });

    await hook(page, 'act', { type: 'targetMode', target: 'gpu', mode: 'off' });
    await hook(page, 'freeze', 3.2);
    const off = await zones();
    off.forEach((z, i) => {
      if (z.target === 'gpu') expect(z.colors.flat().every((v) => v === 0), `${z.part} is dark`).toBe(true);
      else expect(z.colors, `${z.part} is untouched by Off`).toEqual(own[i]!.colors);
    });
    await noErrors(errors);
  });
});

test.describe('power', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  const chip = (page: Page) => page.getByRole('switch', { name: 'Power' });
  const reason = (page: Page) => page.locator('#power-reason');

  test('C12: Power is disabled with the reason on an incomplete build and on a build over its supply', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'empty');
    await hook(page, 'act', { type: 'install', category: 'case', id: 'vitrine' });
    await hook(page, 'act', { type: 'install', category: 'board', id: 'z7' });
    await expect(chip(page)).toBeDisabled();
    // kit/03-RULES.md: "Needs {list} to power on.", the missing parts in the sheet's order, joined with commas and "and".
    const L = catalog.labels.missing;
    await expect(reason(page)).toHaveText(`Needs ${L.cpu}, ${L.cooler}, ${L.ram} and ${L.psu} to power on.`);

    await hook(page, 'load', 'night-rig');
    await hook(page, 'act', { type: 'swap', category: 'gpu', id: 'crest' });
    await hook(page, 'act', { type: 'swap', category: 'psu', id: 't650' });
    const sh = await hook<{ drawW: number }>(page, 'sheet');
    const cap = catalog.psus.find((p) => p.id === 't650')!.capacity;
    expect(sh.drawW).toBeGreaterThan(cap);
    await expect(chip(page)).toBeDisabled();
    await expect(reason(page)).toHaveText(`Not enough power. The build draws ${sh.drawW} W and the supply gives ${cap} W.`);
    await noErrors(errors);
  });

  test('C12: Power turns on and off on every preset', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    for (const p of catalog.presets) {
      await hook(page, 'load', p.id);
      await hook(page, 'open', 'none');
      const c = chip(page);
      await expect(c, p.id).toBeEnabled();
      await expect(c).toHaveAttribute('aria-checked', 'false');
      await c.click();
      await expect(c).toHaveAttribute('aria-checked', 'true');
      await page.waitForTimeout(2200);
      const lit = await hook<Zone[]>(page, 'zones');
      // A preset whose lighting has brightness 0 (Blackout) is dark when powered, by its data.
      const bright = ((await build(page)).lighting as Lighting).brightness > 0;
      if (lit.length > 0 && bright) expect(lit.some((z) => z.colors.flat().some((v) => v > 0.005)), `${p.id} lights up`).toBe(true);
      await c.click();
      await expect(c).toHaveAttribute('aria-checked', 'false');
      await page.waitForTimeout(3500);
      const dark = await hook<Zone[]>(page, 'zones');
      expect(dark.every((z) => z.colors.flat().every((v) => v === 0)), `${p.id} goes dark`).toBe(true);
    }
    await noErrors(errors);
  });
});
