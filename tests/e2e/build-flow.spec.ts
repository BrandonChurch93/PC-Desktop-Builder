import { expect, test } from '@playwright/test';
import fixtures from '../../kit/data/fixtures.json' with { type: 'json' };
import catalog from '../../kit/data/catalog.json' with { type: 'json' };
import { build, code, enterCard, hook, noErrors, openApp, settle, tabUntil, watchErrors } from './helpers';

const night = fixtures.presets.find((p) => p.id === 'night-rig')!;

/** The short reasons from kit/03-RULES.md, written out here so the test does not lean on the app's own table. */
const SHORT: Record<string, string> = {
  NEED_CASE: 'needs a case', NEED_BOARD: 'needs a board', NEED_CPU: 'needs a processor', BOARD_SIZE: 'too large for this case',
  CPU_PLATFORM: 'wrong socket for this board', COOLER_HEIGHT: 'too tall for this case', NO_RAD_MOUNT: 'no radiator mount that size',
  RAM_CLEARANCE: 'too tall under this cooler', RAM_SLOTS: 'no free slots', GPU_LENGTH: 'too long for this case', GPU_THICKNESS: 'too thick for this case',
  M2_SLOTS: 'no place left', BAYS_25: 'no place left', BAYS_35: 'no place left', SATA_PORTS: 'no place left', PSU_FORM: 'wrong size for this case',
  PSU_LENGTH: 'too long for this case', FAN_MOUNT_TAKEN: 'the radiator uses its mount', FAN_MOUNT_UNKNOWN: 'no such mount in this case', UNKNOWN_PART: 'not in this version',
};
const LISTS: Record<string, string> = { board: 'boards', cpu: 'cpus', cooler: 'coolers', ram: 'ram', gpu: 'gpus', psu: 'psus', fan: 'fans', case: 'cases' };
function partName(category: string, id: string): string {
  const brand = (b: string) => catalog.brands.find((x) => x.id === b)!.name;
  if (category === 'storage') { const st = catalog.storage.find((x) => x.type === id)!; return `${brand(st.brand)} ${st.name}`; }
  const p = (catalog as unknown as Record<string, { id: string; brand: string; name: string }[]>)[LISTS[category]!]!.find((x) => x.id === id)!;
  return `${brand(p.brand)} ${p.name}`;
}
/** The cascade notice for a removed list, as kit/03-RULES.md describes it. */
function expectedNotice(removed: { category: string; id: string; code: string; count?: number }[]) {
  const n = removed.reduce((t, r) => t + (r.category === 'storage' ? r.count ?? 1 : 1), 0);
  const groups = new Map<string, number>();
  for (const r of removed) { const k = `${partName(r.category, r.id)} · ${SHORT[r.code]}`; groups.set(k, (groups.get(k) ?? 0) + (r.category === 'storage' ? r.count ?? 1 : 1)); }
  return { title: n === 1 ? 'Removed 1 part' : `Removed ${n} parts`, lines: [...groups].map(([k, t]) => (t > 1 ? `${t} × ${k}` : k)) };
}

/** The Night Rig, part by part, in the order a builder would go; the cooler goes in before the fans. */
const STEPS: [string, string, number?][] = [
  ['case', 'vitrine'], ['board', 'z7'], ['cpu', 'ember8'], ['cooler', 'tarn360-lux'], ['ram', 'facet32'], ['gpu', 'apex3x'],
  ['storage', 'nvme'], ['storage', 'hdd'], ['psu', 't850'], ['fan', 'gale-lux', 4], ['cables', 'orchid'],
];

async function specNumbers(page: import('@playwright/test').Page) {
  const panel = page.getByRole('region', { name: 'Spec sheet' }).or(page.locator('section[aria-labelledby="spec-title"]'));
  return (await panel.first().innerText()).replace(/\s+/g, ' ');
}

test('keyboard only: the Night Rig from an empty bench, part by part, matches the fixture', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'empty');
  for (const [cat, id, times] of STEPS) await enterCard(page, cat, id, times ?? 1);
  await tabUntil(page, (f) => f.startsWith('button:Build name'));
  await page.keyboard.press('Enter');
  await page.keyboard.type('Night Rig');
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await code(page)).toBe(night.encoded);
  const text = await specNumbers(page);
  for (const want of [`${night.sheet.memoryGb} GB`, `${night.sheet.ramSlotsUsed} of ${night.sheet.ramSlots} slots`, `${night.sheet.storageTb} TB`, `${night.sheet.drawW} W`, `of ${night.sheet.psuCapacityW} W · ${night.sheet.loadPercent} percent`, `${night.sheet.gpuLength} mm`, `of ${night.sheet.gpuMaxLength} mm clearance`]) {
    expect(text.replace(/ (GB|TB|W|mm)/g, ' $1')).toContain(want.replace(/^(\d+) /, '$1 '));
  }
  await noErrors(errors);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('touch taps: the Night Rig from an empty bench matches the fixture', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'empty');
    for (const [cat, id, times] of STEPS) {
      await page.locator(`[role="tab"][id$="-tab-${cat}"]`).first().tap();
      const card = page.locator(`[data-part="${cat}:${id}"] [aria-describedby^="status-"]`).first();
      if (cat === 'fan') {
        // A fan card with several free mounts shows the places first; each tap on a place installs one there.
        for (const mount of ['front-1', 'front-2', 'front-3', 'rear-1'].slice(0, times ?? 1)) {
          await card.tap();
          await page.locator(`[data-socket="fan:${mount}"]`).tap();
          await settle(page);
        }
        continue;
      }
      await card.tap();
      // A liquid cooler with two radiator mounts asks where; the Night Rig puts it on the top.
      if (cat === 'cooler') await page.locator('[data-socket="cooler:top"]').tap();
      await settle(page);
    }
    await page.getByRole('button', { name: /^Build name/ }).tap();
    await page.keyboard.type('Night Rig');
    await page.keyboard.press('Enter');
    await settle(page);
    expect(await code(page)).toBe(night.encoded);
    await hook(page, 'open', 'half');
    await hook(page, 'open', 'specs');
    const text = (await page.locator('section[aria-label="Build sheet"]').innerText()).replace(/\s+/g, ' ');
    for (const want of [`${night.sheet.memoryGb}`, `${night.sheet.drawW}`, `of ${night.sheet.psuCapacityW} W · ${night.sheet.loadPercent} percent`, `of ${night.sheet.gpuMaxLength} mm clearance`]) expect(text).toContain(want);
    await noErrors(errors);
  });
});

test('a case swap that removes parts lists them, and Undo restores the exact build', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'night-rig');
  const before = await code(page);
  const check = fixtures.checks.find((c) => c.name === 'case swap to cub removes what cannot follow')!;
  const want = expectedNotice(check.expect.removed as { category: string; id: string; code: string; count?: number }[]);
  await page.locator('[role="tab"][id$="-tab-case"]').first().click();
  await page.locator('[data-part="case:cub"] [aria-describedby^="status-"]').click();
  await settle(page);
  const notice = page.getByRole('alertdialog');
  await expect(notice).toContainText(want.title);
  for (const line of want.lines) await expect(notice).toContainText(line);
  await notice.getByRole('button', { name: 'Undo' }).click();
  await settle(page);
  expect(await code(page)).toBe(before);
  await expect(notice).toHaveCount(0);
  await noErrors(errors);
});

test('a reload restores the build', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await hook(page, 'load', 'flagship');
  await hook(page, 'act', { type: 'name', name: 'Kept' });
  await page.waitForTimeout(700);
  const before = await code(page);
  await page.reload();
  await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 120_000 });
  expect(await code(page)).toBe(before);
  await noErrors(errors);
});

test('with browser storage blocked the app still runs', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    const deny = () => { throw new DOMException('blocked', 'SecurityError'); };
    Object.defineProperty(window, 'localStorage', { get: deny, configurable: true });
  });
  await openApp(page);
  await page.locator('[role="tab"][id$="-tab-gpu"]').first().click();
  await page.locator('[data-part="gpu:apex2x"] [aria-describedby^="status-"]').click();
  await settle(page);
  expect((await build(page)).gpu).toBe('apex2x');
  await page.reload();
  await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 120_000 });
  await noErrors(errors);
});

test.describe('taps', () => {
  test.use({ hasTouch: true });

  test('C20: one place installs at once; a fan with several free mounts shows its places first', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    await page.locator('[role="tab"][id$="-tab-gpu"]').first().tap();
    await page.locator('[data-part="gpu:apex2x"] [aria-describedby^="status-"]').tap();
    await settle(page);
    expect((await build(page)).gpu).toBe('apex2x');
    await hook(page, 'act', { type: 'clearFans' });
    await page.locator('[role="tab"][id$="-tab-fan"]').first().tap();
    const before = await code(page);
    await page.locator('[data-part="fan:gale"] [aria-describedby^="status-"]').tap();
    await settle(page);
    expect(await code(page)).toBe(before);
    await expect(page.locator('[data-socket^="fan:"]').first()).toBeVisible();
    await page.locator('[data-socket="fan:front-2"]').tap();
    await settle(page);
    expect((await build(page)).fans).toEqual({ 'front-2': 'gale' });
    await noErrors(errors);
  });

  test('C20: Enter on a fan card four times fills four different mounts', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await hook(page, 'load', 'night-rig');
    await hook(page, 'act', { type: 'clearFans' });
    await enterCard(page, 'fan', 'gale', 4);
    const fans = (await build(page)).fans as Record<string, string>;
    expect(Object.keys(fans).length).toBe(4);
    expect(new Set(Object.keys(fans)).size).toBe(4);
    await noErrors(errors);
  });
});
