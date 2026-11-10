import { expect, type Page } from '@playwright/test';

/** Every test fails on a page error or a console error. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console error: ${m.text()}`); });
  return errors;
}

export async function openApp(page: Page, query = '?hook=1') {
  await page.goto(`/${query}`);
  await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 120_000 });
}

export const code = (page: Page) => page.evaluate(() => (window as unknown as { __pcb: { build: () => { code: string } } }).__pcb.build().code);
export const build = (page: Page) => page.evaluate(() => (window as unknown as { __pcb: { build: () => { build: Record<string, unknown> } } }).__pcb.build().build);
export const hook = <T,>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window as unknown as { __pcb: Record<string, (...x: unknown[]) => unknown> }).__pcb[f as string]!(...(a as unknown[])), [fn, args] as const) as Promise<T>;

/** What has keyboard focus, as a short description: a card's part, a tab's name, or the element's label. */
export const focused = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return '';
  const card = el.closest('[data-part]') as HTMLElement | null;
  if (card && el.hasAttribute('aria-describedby')) return `card:${card.dataset.part}`;
  if (el.getAttribute('role') === 'tab') return `tab:${el.id.split('-tab-')[1]}`;
  return `${el.tagName.toLowerCase()}:${el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''}`;
});

/** Presses Tab until focus lands where the predicate says, using only the keyboard. */
export async function tabUntil(page: Page, want: (f: string) => boolean, max = 120) {
  for (let i = 0; i < max; i++) {
    if (want(await focused(page))) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`focus never reached the target; last at ${await focused(page)}`);
}

/** Moves the tray's category with the arrow keys, starting from wherever the tab list has focus. */
export async function chooseCategory(page: Page, category: string) {
  await tabUntil(page, (f) => f.startsWith('tab:'));
  for (let i = 0; i < 12; i++) {
    if ((await focused(page)) === `tab:${category}`) return;
    await page.keyboard.press('ArrowRight');
  }
  throw new Error(`no tab ${category}`);
}

/** With the keyboard alone: open a category, move to a card and press Enter on it. */
export async function enterCard(page: Page, category: string, id: string, times = 1) {
  await chooseCategory(page, category);
  await tabUntil(page, (f) => f === `card:${category}:${id}`);
  for (let i = 0; i < times; i++) await page.keyboard.press('Enter');
  await settle(page);
}

export const settle = (page: Page) => page.evaluate(() => (window as unknown as { __pcb: { settle: () => Promise<void> } }).__pcb.settle());

export async function noErrors(errors: string[]) {
  expect(errors, errors.join('\n')).toEqual([]);
}
