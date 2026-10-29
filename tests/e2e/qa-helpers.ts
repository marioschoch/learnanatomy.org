/**
 * Agent D (independent QA) — shared helpers for the qa-*.spec.ts files.
 * Everything goes through the public UI or the documented test hook (window.__atlas, ?testHooks=1).
 */
import { expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const SHOT_DIR = path.join('tests', 'e2e', 'qa-screenshots');

/** Evaluate an expression with `s` = store state and `a` = argument. Promises are awaited. */
export function st<T = unknown>(page: Page, expr: string, arg?: unknown): Promise<T> {
  return page.evaluate(
    ([e, a]) => new Function('s', 'a', `return (${e});`)(window.__atlas!.store.getState(), a),
    [expr, arg] as const,
  ) as Promise<T>;
}

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 640;

/** Real data (production build) with test hooks. `prefs` skips the first-visit hint and pins the UI to English. */
export async function boot(page: Page, query = '', opts: { prefs?: boolean; reducedMotion?: boolean } = {}) {
  const { prefs = true, reducedMotion = true } = opts;
  if (prefs) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('oaa.prefs.v1', JSON.stringify({ hintSeen: true, uiLang: 'en' }));
      } catch {
        // ignore
      }
    });
  }
  await page.goto(`/?testHooks=1${query}`);
  await expect.poll(() => st(page, 's.dataStatus'), { timeout: 60_000 }).toBe('loaded');
  await expect.poll(() => st(page, 's.viewerReady'), { timeout: 60_000 }).toBe(true);
  if (reducedMotion) await st(page, 's.setReducedMotion(true)');
  await waitGeometry(page);
}

/** Every visible layer has its geometry loaded. */
export async function waitGeometry(page: Page, timeout = 90_000) {
  await expect
    .poll(
      () =>
        st(
          page,
          `Object.entries(s.layers).every(([id, l]) => !l.visible || (s.systemLoad[id] && s.systemLoad[id].geometry === 'loaded'))`,
        ),
      { timeout },
    )
    .toBe(true);
}

/** Two animation frames + slack so the demand frameloop has rendered the latest state. */
export async function settle(page: Page, ms = 250) {
  await page.evaluate(
    (t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))),
    ms,
  );
}

export interface CanvasShot {
  ok: boolean;
  width: number;
  height: number;
  /** Fraction of pixels with alpha > 0 (transparent background). */
  coverage: number;
  /** Mean x / y of covered pixels, normalised to 0..1 (0 = left / top). */
  cx: number;
  cy: number;
  /** Mean RGB of covered pixels. */
  rgb: [number, number, number];
  dataUrl: string;
}

/** Viewer screenshot command with a transparent background, analysed in the page. */
export async function canvasShot(page: Page): Promise<CanvasShot> {
  return page.evaluate(async () => {
    const s = window.__atlas!.store.getState() as unknown as {
      requestViewer(c: unknown): Promise<{ ok: boolean; dataUrl?: string; width?: number; height?: number }>;
    };
    const res = await s.requestViewer({ type: 'screenshot', transparentBackground: true });
    if (!res.ok || !res.dataUrl)
      return { ok: false, width: 0, height: 0, coverage: 0, cx: 0, cy: 0, rgb: [0, 0, 0], dataUrl: '' };
    const img = new Image();
    img.src = res.dataUrl;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    let sx = 0;
    let sy = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3]! > 8) {
        const p = i / 4;
        n++;
        sx += p % c.width;
        sy += Math.floor(p / c.width);
        r += d[i]!;
        g += d[i + 1]!;
        b += d[i + 2]!;
      }
    }
    return {
      ok: true,
      width: c.width,
      height: c.height,
      coverage: n / (c.width * c.height),
      cx: n ? sx / n / c.width : 0,
      cy: n ? sy / n / c.height : 0,
      rgb: n ? [r / n, g / n, b / n] : [0, 0, 0],
      dataUrl: res.dataUrl,
    } as const;
  }) as Promise<CanvasShot>;
}

/** Fraction of differing pixels between two PNG data URLs (same size), computed in the page. */
export async function pixelDiff(page: Page, a: string, b: string): Promise<number> {
  return page.evaluate(
    async ([x, y]) => {
      const load = async (u: string) => {
        const img = new Image();
        img.src = u;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height);
      };
      const [p, q] = await Promise.all([load(x), load(y)]);
      if (p.width !== q.width || p.height !== q.height) return 1;
      let diff = 0;
      for (let i = 0; i < p.data.length; i += 4) {
        const dd =
          Math.abs(p.data[i]! - q.data[i]!) +
          Math.abs(p.data[i + 1]! - q.data[i + 1]!) +
          Math.abs(p.data[i + 2]! - q.data[i + 2]!) +
          Math.abs(p.data[i + 3]! - q.data[i + 3]!);
        if (dd > 40) diff++;
      }
      return diff / (p.width * p.height);
    },
    [a, b] as const,
  );
}

/** Full-page screenshot into tests/e2e/qa-screenshots/<project>-<name>.png (and attached to the report). */
export async function shot(page: Page, testInfo: TestInfo, name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, `${testInfo.project.name}-${name}.png`);
  await page.screenshot({ path: file });
  await testInfo.attach(name, { path: file, contentType: 'image/png' });
  return file;
}

/** Save a viewer screenshot data URL. */
export function saveDataUrl(testInfo: TestInfo, name: string, dataUrl: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, `${testInfo.project.name}-${name}.png`);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'));
  return file;
}

/** Phone: open a bottom sheet from the bottom bar. Desktop: no-op for 'layers' (sidebar is open). */
export async function openPhoneSheet(page: Page, name: 'Layers' | 'Tree' | 'Tools' | 'Info') {
  const nav = page.getByRole('navigation', { name: 'View tools' });
  await nav.getByRole('button', { name, exact: true }).click();
}

/** Close the open phone sheet without touching the selection ("Close information" would deselect). */
export async function closePhoneSheet(page: Page) {
  const dlg = page.getByRole('dialog').last();
  const btn = dlg.getByRole('button', { name: 'Close', exact: true });
  if (await btn.count()) await btn.first().click();
  else {
    await dlg.focus();
    await page.keyboard.press('Escape');
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Type into the search box and return the visible option texts. */
export async function search(page: Page, text: string) {
  const box = page.getByRole('combobox', { name: 'Search anatomical structures' });
  await box.click();
  await box.fill(text);
  const options = page.getByRole('option');
  await expect(options.first()).toBeVisible({ timeout: 20_000 });
  return options;
}

/** Collect page errors and console errors. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Open the main menu (phone/tablet) and click an item. */
export async function menuItem(page: Page, name: string) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name }).click();
}
