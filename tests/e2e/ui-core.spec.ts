import { expect, test, type Page } from '@playwright/test';

// Agent C — UI smoke tests on mock data. They drive the UI and read the store through the test hook;
// they do not depend on what the 3D canvas renders.

const state = (page: Page, expr: string) =>
  page.evaluate((e) => {
    return new Function('s', `return (${e});`)(window.__atlas!.store.getState()) as unknown;
  }, expr);

async function boot(page: Page, query = '') {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('oaa.prefs.v1', JSON.stringify({ hintSeen: true, uiLang: 'en' }));
    } catch {
      // ignore
    }
  });
  await page.goto(`/?data=mock&testHooks=1${query}`);
  await expect.poll(() => state(page, 's.dataStatus')).toBe('loaded');
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 640;

test('search → select → info, and the URL reproduces the selection', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('/');
  await expect(page.getByRole('combobox', { name: 'Search anatomical structures' })).toBeFocused();
  await page.keyboard.type('hepar');
  await expect(page.getByRole('option').first()).toContainText('Hepar');
  await page.keyboard.press('Enter');
  await expect.poll(() => state(page, 's.selectedId')).toBe('liver');

  if (isPhone(page)) {
    await expect(page.getByTestId('info-peek')).toContainText('Hepar');
    await page.getByTestId('info-peek').getByRole('button', { name: 'Show details' }).click();
  }
  const info = page.getByTestId('info-panel');
  await expect(info.getByRole('heading', { level: 2 })).toHaveText('Hepar');
  await expect(info).toContainText('Liver');
  await expect(info).toContainText('Visceral systems');
  await expect(info).toContainText('Unreviewed');

  await expect.poll(() => new URL(page.url()).searchParams.get('s')).toBe('liver');
  await page.reload();
  await expect.poll(() => state(page, 's.dataStatus')).toBe('loaded');
  await expect.poll(() => state(page, 's.selectedId')).toBe('liver');
});

test('a shared link restores layers, opacity, X-ray, clipping, explode and name language', async ({
  page,
}) => {
  await boot(page, '&s=femur-l&l=skeletal.60,muscular.40&x=1&c=s50,t32.5f&e=40&n=en&p=femur-l');
  await expect
    .poll(() =>
      state(
        page,
        `[s.layers.skeletal.visible, s.layers.skeletal.opacity, s.layers.visceral.visible, s.layers.muscular.opacity,
          s.xray, s.clipping.sagittal.enabled, s.clipping.transverse.flipped, s.explode, s.nameLang, s.pinnedIds.join(), s.selectedId]`,
      ),
    )
    .toEqual([true, 0.6, false, 0.4, true, true, true, 0.4, 'en', 'femur-l', 'femur-l']);
  // The URL keeps these values (non-defaults only) and unrelated parameters.
  await page.waitForTimeout(600);
  const q = new URL(page.url()).searchParams;
  expect(q.get('data')).toBe('mock');
  expect(q.get('l')).toBe('skeletal.60,muscular.40');
  expect(q.get('x')).toBe('1');
  expect(q.get('n')).toBe('en');
});

test('layers panel toggles a system and applies presets', async ({ page }) => {
  await boot(page);
  if (isPhone(page)) await page.getByRole('navigation').getByRole('button', { name: 'Layers' }).click();
  await page.getByRole('switch', { name: 'Show Muscular system' }).click();
  await expect.poll(() => state(page, 's.layers.muscular.visible')).toBe(true);
  await page.getByRole('button', { name: 'Full X-ray' }).click();
  await expect.poll(() => state(page, 's.xray')).toBe(true);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect.poll(() => state(page, '[s.xray, s.layers.muscular.visible]')).toEqual([false, false]);
  await expect.poll(() => new URL(page.url()).searchParams.has('l')).toBe(false);
});

test('quiz: locate question via a 3D pick, labels and info hidden, view restored at the end', async ({
  page,
}) => {
  await boot(page, '&s=heart');
  if (isPhone(page)) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Quiz' }).click();
  } else {
    await page.getByRole('button', { name: 'Quiz', exact: true }).click();
  }
  const panel = page.getByTestId('quiz-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('checkbox', { name: /Identify/ }).uncheck();
  await panel.getByRole('checkbox', { name: /Name it/ }).uncheck();
  await panel.getByRole('radio', { name: '5', exact: true }).click();
  await expect(panel.getByTestId('quiz-pool')).toContainText('structures in scope');
  await panel.getByTestId('quiz-start').click();

  await expect
    .poll(() => state(page, '[s.mode, s.labelsVisible, s.selectedId]'))
    .toEqual(['quiz', false, null]);
  await expect(page.getByTestId('info-panel')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Search anatomical structures' })).toHaveCount(0);
  await expect(panel.getByTestId('quiz-question')).toHaveAttribute('data-question-type', 'locate');

  // Simulate the viewer's pick (the store routes it to quizPick in quiz mode).
  await page.evaluate(() =>
    (window.__atlas!.store.getState().pickStructure as (id: string | null) => void)('sternum'),
  );
  await expect(panel.getByTestId('quiz-feedback')).toBeVisible();
  await expect.poll(() => state(page, 'Object.values(s.highlights).includes("quiz-correct")')).toBe(true);

  await panel.getByRole('button', { name: 'End quiz' }).click();
  await expect
    .poll(() => state(page, '[s.mode, s.labelsVisible, s.selectedId]'))
    .toEqual(['explore', true, 'heart']);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('oaa.quiz.leitner.v1'))).not.toBeNull();
});

test('help overlay, about page (lazy) and keyboard shortcuts', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'Help' });
  await expect(help).toBeVisible();
  await expect(help).toContainText('Keyboard shortcuts');
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();

  await page.keyboard.press('x');
  await expect.poll(() => state(page, 's.xray')).toBe(true);

  if (isPhone(page)) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'About' }).click();
  } else {
    await page.getByRole('button', { name: 'About' }).click();
  }
  const about = page.getByRole('dialog', { name: 'About' });
  await expect(about).toContainText('Educational use only');
  await expect(about).toContainText('not be used for diagnosis');
  await expect(about.locator('[data-attribution]')).toHaveCount(1);
});

test('UI language and name language toggles', async ({ page }) => {
  await boot(page, '&s=liver');
  if (isPhone(page)) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('radio', { name: 'Deutsch' }).click();
    await page.keyboard.press('Escape');
  } else {
    await page.getByRole('radio', { name: 'Deutsch' }).click();
  }
  await expect(page.getByRole('combobox', { name: 'Anatomische Strukturen suchen' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('de');
  // German is not in the mock data's name languages → only Latin / English are offered.
  await expect(page.getByRole('radio', { name: 'Deutsch', exact: true })).toHaveCount(isPhone(page) ? 0 : 1);
  await page.getByRole('radio', { name: 'Englisch' }).first().click();
  await expect.poll(() => state(page, 's.nameLang')).toBe('en');
  await expect.poll(() => new URL(page.url()).searchParams.get('n')).toBe('en');
});
