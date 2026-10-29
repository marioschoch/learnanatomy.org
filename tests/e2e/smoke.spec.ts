import { expect, test } from '@playwright/test';

// Phase 0 smoke test: the app boots on mock data and the store is reachable through the test hook.
test('app boots with mock data', async ({ page }) => {
  await page.goto('/?data=mock&testHooks=1');
  await expect(page.getByRole('heading', { name: 'learnanatomy.org' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__atlas?.store.getState().dataStatus)).toBe('loaded');
  const kind = await page.evaluate(() => window.__atlas?.dataSource.kind);
  expect(kind).toBe('mock');
});
