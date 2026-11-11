import { expect, test, type Page } from '@playwright/test';
import fixtures from '../../kit/data/fixtures.json' with { type: 'json' };
import catalog from '../../kit/data/catalog.json' with { type: 'json' };
import { build, code, hook, noErrors, openApp, settle, watchErrors } from './helpers';

type Place = { key: string; ok: boolean; message: string | null; x: number | null; y: number | null };
type Build = { case: { id: string } | null; board: string | null; cpu: string | null; cooler: { id: string; mount: string | null } | null; ram: string[]; gpu: string | null; psu: string | null; fans: Record<string, string>; storage: Record<string, number>; name: string };
const card = (page: Page, category: string, id: string) => page.locator(`[data-part="${category}:${id}"] [aria-describedby^="status-"]`).first();
const openTab = (page: Page, category: string) => page.locator(`[role="tab"][id$="-tab-${category}"]`).first().click();
const label = (page: Page) => page.getByRole('status').filter({ hasText: /\S/ });
const getBuild = async (page: Page) => (await build(page)) as unknown as Build;

async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, release = true) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 18; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 18, from.y + ((to.y - from.y) * i) / 18);
  if (release) await page.mouse.up();
}
const centerOf = async (l: ReturnType<typeof card>) => { await l.scrollIntoViewIfNeeded(); const b = (await l.boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

test.use({ viewport: { width: 1440, height: 900 } });

/** kit/03-RULES.md's sentences for the five codes, filled from the catalog here, not from the app. */
const cub = catalog.cases.find((c) => c.id === 'cub')!;
const pillar = catalog.coolers.find((c) => c.id === 'pillar')!;
const twin = catalog.coolers.find((c) => c.id === 'twin')!;
const crown = catalog.ram.find((r) => r.id === 'crown96')!;
const apex3x = catalog.gpus.find((g) => g.id === 'apex3x')!;
const BLOCKED: { code: string; preset: string; remove: string | null; category: string; id: string; want: string }[] = [
  { code: 'GPU_LENGTH', preset: 'pocket', remove: 'gpu', category: 'gpu', id: 'apex3x', want: `Too long. This card is ${apex3x.length} mm and the case has ${cub.gpuMaxLength} mm free.` },
  { code: 'COOLER_HEIGHT', preset: 'pocket', remove: 'cooler', category: 'cooler', id: 'pillar', want: `Too tall. This cooler is ${pillar.height} mm and the case fits ${cub.coolerMaxHeight} mm.` },
  { code: 'RAM_CLEARANCE', preset: 'windbreak', remove: null, category: 'ram', id: 'crown96', want: `Too tall. The cooler leaves ${twin.ramClearance} mm over the memory and this kit is ${crown.height} mm.` },
  { code: 'PSU_FORM', preset: 'pocket', remove: 'psu', category: 'psu', id: 't850', want: `Wrong size. This case takes ${catalog.labels.psuForm.sfx} supplies.` },
  { code: 'BOARD_SIZE', preset: 'pocket', remove: null, category: 'board', id: 'z7', want: `Too large. This case takes ${catalog.labels.boardSize.itx} boards.` },
];

for (const b of BLOCKED) {
  test(`C4: a blocked drag shows ${b.code}'s message and changes nothing`, async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', b.preset);
    if (b.remove) await hook(page, 'act', { type: 'remove', category: b.remove });
    const before = await code(page);
    await openTab(page, b.category);
    const p = (await hook<Place[]>(page, 'places', b.category, b.id)).find((x) => !x.ok && x.x !== null)!;
    expect(p, 'a blocked place on screen').toBeTruthy();
    expect(p.message).toBe(b.want);
    await mouseDrag(page, await centerOf(card(page, b.category, b.id)), { x: p.x!, y: p.y! }, false);
    await expect(label(page).filter({ hasText: b.want }).first()).toBeVisible();
    await page.mouse.up();
    await settle(page);
    expect(await code(page)).toBe(before);
    await noErrors(errors);
  });
}

test('C5: a case swap removes parts with the notice, Undo restores it exactly and Redo applies it again', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'night-rig');
  const before = await code(page);
  await openTab(page, 'case');
  await card(page, 'case', 'cub').click();
  await settle(page);
  const after = await code(page);
  await expect(page.getByText(/^Removed \d+ parts$/)).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
  await settle(page);
  expect(await code(page)).toBe(before);
  await page.getByRole('button', { name: 'Redo' }).click();
  await settle(page);
  expect(await code(page)).toBe(after);
  await noErrors(errors);
});

test('C6: remove by the selection menu, by dragging out, by Delete, and by the spec sheet', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'night-rig');
  // The selection menu.
  await hook(page, 'select', 'gpu');
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await settle(page);
  expect((await getBuild(page)).gpu).toBeNull();
  // Delete on the selected part.
  await hook(page, 'select', 'psu');
  await page.keyboard.press('Delete');
  await settle(page);
  expect((await getBuild(page)).psu).toBeNull();
  // Dragging the selected cooler out of the case.
  const at = (await hook<{ x: number; y: number }>(page, 'screen', 'cooler'))!;
  await hook(page, 'select', 'cooler');
  await mouseDrag(page, at, { x: 60, y: 120 });
  await settle(page);
  expect((await getBuild(page)).cooler).toBeNull();
  // The full sheet's Remove.
  await hook(page, 'open', 'sheet');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /^Remove .*Calyra Facet 32 GB/ }).click();
  await settle(page);
  expect((await getBuild(page)).ram).toEqual([]);
  await noErrors(errors);
});

test('C9: a link with unknown parts loads the rest and says parts were left out', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const d = fixtures.decodes.find((x) => x.name === 'unknown ids are dropped')!;
  await hook(page, 'link', d.encoded);
  await expect(page.getByText('Some parts in this link are not in this version and were left out.')).toBeVisible();
  const b = await getBuild(page);
  const want = (d.expect as { build: Build }).build;
  expect(b.case).toEqual(want.case);
  expect(b.board).toEqual(want.board);
  await noErrors(errors);
});

test('C13: Showcase, Exploded, Airflow, Glass and the Inspector open and close from the interface and by shortcuts', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'night-rig');
  const state = () => page.evaluate(() => { const w = window as unknown as { __pcb: { build: () => { build: { glass: boolean } } } }; return w.__pcb.build().build.glass; });
  const mode = () => page.getByRole('radiogroup', { name: 'Mode' }).getByRole('radio', { checked: true }).innerText();
  // Interface.
  await page.getByRole('radio', { name: 'Showcase' }).click(); expect(await mode()).toBe('Showcase');
  await page.getByRole('radio', { name: 'Exploded' }).click(); expect(await mode()).toBe('Exploded');
  await page.getByRole('radio', { name: 'Build' }).click(); expect(await mode()).toBe('Build');
  const airflow = page.getByRole('switch', { name: 'Airflow' });
  await airflow.click(); await expect(airflow).toHaveAttribute('aria-checked', 'true');
  await airflow.click(); await expect(airflow).toHaveAttribute('aria-checked', 'false');
  const glass = page.getByRole('switch', { name: 'Glass' });
  await glass.click(); expect(await state()).toBe(false);
  await glass.click(); expect(await state()).toBe(true);
  await openTab(page, 'gpu');
  await page.getByRole('button', { name: 'Inspect Veltrin Apex 3X' }).click();
  await expect(page.getByRole('region', { name: 'Inspector' })).toBeVisible();
  await page.getByRole('button', { name: 'Close the Inspector' }).click();
  await expect(page.getByRole('region', { name: 'Inspector' })).toHaveCount(0);
  // Shortcuts, with focus on the page and not in a field.
  await page.locator('canvas').focus().catch(() => undefined);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('s'); expect(await mode()).toBe('Showcase');
  await page.keyboard.press('e'); expect(await mode()).toBe('Exploded');
  await page.keyboard.press('b'); expect(await mode()).toBe('Build');
  await page.keyboard.press('a'); await expect(airflow).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('a'); await expect(airflow).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('g'); expect(await state()).toBe(false);
  await page.keyboard.press('g'); expect(await state()).toBe(true);
  await hook(page, 'select', 'gpu');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('i');
  await expect(page.getByRole('region', { name: 'Inspector' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Inspector' })).toHaveCount(0);
  await noErrors(errors);
});

test('C15: fans install per mount, fill and clear, and a radiator taking their mounts removes them with a notice', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'night-rig');
  await openTab(page, 'fan');
  await page.getByRole('button', { name: 'Clear fans' }).click();
  await settle(page);
  expect((await getBuild(page)).fans).toEqual({});
  await card(page, 'fan', 'gale').click();
  const rear = (await hook<Place[]>(page, 'places', 'fan', 'gale')).find((p) => p.key.includes('rear-1') && p.ok)!;
  await page.mouse.click(rear.x!, rear.y!);
  await settle(page);
  expect((await getBuild(page)).fans).toEqual({ 'rear-1': 'gale' });
  await card(page, 'fan', 'gale').click({ position: { x: 4, y: 4 } }).catch(() => undefined);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Fill empty mounts' }).click();
  await settle(page);
  const L = catalog.cases.find((c) => c.id === 'vitrine')!;
  const taken = fixtures.presets.find((p) => p.id === 'night-rig')!.occupiedFanMounts as string[];
  expect(Object.keys((await getBuild(page)).fans).sort()).toEqual(L.fanMounts.map((m) => m.id).filter((m) => !taken.includes(m)).sort());
  // The radiator moves to the front mounts, where three fans sit: they leave with the radiator's reason.
  await hook(page, 'act', { type: 'install', category: 'cooler', id: 'tarn360-lux', opts: { mount: 'front' } }, { instant: false });
  await expect(page.getByText(/^Removed 3 parts$/)).toBeVisible();
  await expect(page.getByText(/3 × Kestrane Gale · the radiator uses its mount/).first()).toBeVisible();
  await noErrors(errors);
});

test('C16: storage steppers stop at each limit with the right message as the board and case change', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'night-rig');
  await openTab(page, 'storage');
  const plus = (type: string) => page.locator(`[data-part="storage:${type}"]`).getByRole('button', { name: /^One more/ });
  const count = async (type: string) => (await getBuild(page)).storage[type] ?? 0;
  const z7 = catalog.boards.find((b) => b.id === 'z7')!;
  while (await plus('nvme').isEnabled()) { await plus('nvme').click(); await settle(page); }
  expect(await count('nvme')).toBe(z7.m2Slots);
  await expect(plus('nvme')).toHaveAttribute('title', `All ${z7.m2Slots} M.2 slots on this board are in use.`);
  // A smaller board: the drives beyond its slots leave, and the stepper stops at its count.
  await hook(page, 'act', { type: 'install', category: 'board', id: 'z7i' });
  const z7i = catalog.boards.find((b) => b.id === 'z7i')!;
  expect(await count('nvme')).toBe(z7i.m2Slots);
  await expect(plus('nvme')).toBeDisabled();
  await expect(plus('nvme')).toHaveAttribute('title', z7i.m2Slots === 1 ? 'The only M.2 slot on this board is in use.' : `All ${z7i.m2Slots} M.2 slots on this board are in use.`);
  // The 3.5 inch bays of the case.
  await hook(page, 'load', 'night-rig');
  const vit = catalog.cases.find((c) => c.id === 'vitrine')!;
  while (await plus('hdd').isEnabled()) { await plus('hdd').click(); await settle(page); }
  expect(await count('hdd')).toBe(vit.bays35);
  await expect(plus('hdd')).toHaveAttribute('title', vit.bays35 === 1 ? 'The only 3.5 inch bay in this case is in use.' : `All ${vit.bays35} 3.5 inch bays in this case are in use.`);
  await noErrors(errors);
});

test('E4 and E5: no request leaves the app\'s origin and the app\'s own code logs no warning during a full flow', async ({ page, baseURL }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  const outside: string[] = [];
  const warnings: string[] = [];
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(baseURL!) && !u.startsWith('data:') && !u.startsWith('blob:')) outside.push(u); });
  page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
  await openApp(page);
  for (const p of fixtures.presets) await hook(page, 'load', p.id);
  await hook(page, 'load', 'night-rig');
  await hook(page, 'set', { power: true, airflow: true, load: 0.5 });
  await page.getByRole('radio', { name: 'Showcase' }).click();
  await page.getByRole('radio', { name: 'Exploded' }).click();
  await page.getByRole('radio', { name: 'Build' }).click();
  await hook(page, 'act', { type: 'remove', category: 'gpu' }, { instant: false });
  await hook(page, 'act', { type: 'install', category: 'gpu', id: 'apex3x' }, { instant: false });
  await hook(page, 'inspect', 'cooler', 'pillar', 30);
  await hook(page, 'open', 'none');
  await hook(page, 'open', 'share');
  await hook(page, 'open', 'none');
  expect(outside).toEqual([]);
  // No warning at all: three's own warnings are about how the app calls it, so they count as the app's.
  expect(warnings, warnings.join('\n')).toEqual([]);
  await noErrors(errors);
  test.info().annotations.push({ type: 'warnings', description: warnings.join(' | ') || 'none' });
});

test('G3: build actions are announced in the live region with the right sentence', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'night-rig');
  await hook(page, 'act', { type: 'remove', category: 'gpu' });
  await openTab(page, 'gpu');
  await card(page, 'gpu', 'apex3x').click();
  await settle(page);
  const live = page.locator('[role="status"][aria-live="polite"]').last();
  // kit/05-DESIGN.md's example sentence, with the card's length and the case's clearance from the catalog.
  const vit = catalog.cases.find((c) => c.id === 'vitrine')!;
  await expect(live).toHaveText(`Veltrin Apex 3X installed. Graphics clearance ${apex3x.length} of ${vit.gpuMaxLength} mm.`);
  await noErrors(errors);
});

test('G6: the canvas has a descriptive label and the full sheet lists every installed part with a Remove button', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'flagship');
  const lbl = await page.locator('canvas').getAttribute('aria-label');
  expect(lbl && lbl.length > 30 && /PC build/.test(lbl)).toBe(true);
  await hook(page, 'open', 'sheet');
  const dialog = page.getByRole('dialog');
  const b = await getBuild(page);
  const kits = b.ram.length; const fans = Object.keys(b.fans).length;
  // Each drive has its own row: its slot or bay.
  const drives = Object.values(b.storage).reduce((a, n) => a + n, 0);
  const singles = ['case', 'board', 'cpu', 'cooler', 'gpu', 'psu'].filter((k) => (b as unknown as Record<string, unknown>)[k]).length;
  await expect(dialog.getByRole('button', { name: /^Remove / })).toHaveCount(singles + kits + fans + drives);
  await noErrors(errors);
});

test('F05: the Inspector turns and zooms by hand, shows the specs and installs the part', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'night-rig');
  await hook(page, 'act', { type: 'remove', category: 'gpu' });
  await openTab(page, 'gpu');
  await page.getByRole('button', { name: 'Inspect Veltrin Apex 2X' }).click();
  const region = page.getByRole('region', { name: 'Inspector' });
  await expect(region).toBeVisible();
  await expect(region.getByText('Length')).toBeVisible();
  const read = () => page.evaluate(() => { const i = (window as unknown as { __world: { inspector: { angle: number; zoom: number } } }).__world.inspector; return { angle: i.angle, zoom: i.zoom }; });
  const a = await read();
  await page.mouse.move(700, 300); await page.mouse.down(); await page.mouse.move(820, 300, { steps: 6 }); await page.mouse.up();
  const b = await read();
  expect(b.angle).not.toBe(a.angle);
  await page.mouse.move(700, 300); await page.mouse.wheel(0, -400);
  const c = await read();
  expect(c.zoom).toBeGreaterThan(b.zoom);
  await region.getByRole('button', { name: 'Install' }).click();
  await settle(page);
  expect((await getBuild(page)).gpu).toBe('apex2x');
  await expect(region).toHaveCount(0);
  await noErrors(errors);
});

test('F01: the intro plays and any input skips it to the start overlay', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  // Not awaited: the hook's open waits for motion to settle, and the intro would play to its end.
  await page.evaluate(() => { void (window as unknown as { __pcb: { open: (n: string) => Promise<void> } }).__pcb.open('intro'); });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __world: { introTl: unknown } }).__world.introTl !== null)).toBe(true);
  await page.keyboard.press('Space');
  await expect(page.locator('#start-title')).toBeVisible();
  await page.getByRole('button', { name: 'Start with this build' }).click();
  await expect(page.locator('#start-title')).toHaveCount(0);
  await noErrors(errors);
});
