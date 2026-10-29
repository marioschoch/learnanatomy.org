import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Viewer smoke tests on the mock scene (Agent B). SwiftShader renders slowly: no fps assertions, tolerant images.
// Each test cold-starts the app; shader compilation + PMREM under SwiftShader (with other agents' runs in
// parallel) can take most of the default 60 s.
test.describe.configure({ timeout: 180_000 });

// Loose typing of the store as seen through window.__atlas (full types: src/contract/store.ts).
type AnyStore = {
  getState(): Record<string, unknown> & {
    [k: string]: unknown;
  };
};

const store = (page: Page) => ({
  get: <T>(fn: string, ...args: unknown[]) =>
    page.evaluate(
      ([f, a]) => {
        const s = (window.__atlas!.store as unknown as AnyStore).getState() as Record<
          string,
          (...x: unknown[]) => unknown
        >;
        return s[f as string]!(...(a as unknown[])) as unknown;
      },
      [fn, args] as const,
    ) as Promise<T>,
  read: <T>(key: string) =>
    page.evaluate((k) => (window.__atlas!.store.getState() as Record<string, unknown>)[k], key) as Promise<T>,
});

async function openMockScene(page: Page) {
  await page.goto('/?data=mock&testHooks=1');
  await expect
    .poll(() => page.evaluate(() => window.__atlas?.store.getState().viewerReady), { timeout: 30_000 })
    .toBe(true);
  await page.evaluate(() =>
    (window.__atlas!.store.getState() as unknown as { setReducedMotion(b: boolean): void }).setReducedMotion(
      true,
    ),
  );
  await waitGeometry(page);
}

async function waitGeometry(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = window.__atlas!.store.getState() as unknown as {
            layers: Record<string, { visible: boolean }>;
            systemLoad: Record<string, { geometry: string }>;
          };
          return Object.entries(s.layers).every(
            ([id, l]) => !l.visible || s.systemLoad[id]?.geometry === 'loaded',
          );
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
}

/** Two animation frames + a little slack, so the demand frameloop has rendered the latest state. */
const settle = (page: Page) =>
  page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150)))),
  );

/** Centre of the canvas in page coordinates, and the element actually on top there. */
async function canvasCenter(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector('[data-testid="viewer"] canvas')!;
    const r = c.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    return { x, y, onTop: document.elementFromPoint(x, y) === c };
  });
}

test('mock scene renders, selection highlights and labels, screenshot works', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openMockScene(page);
  const s = store(page);

  // Budget: draw calls in the default view (stats are published from renderer.info).
  await s.get('requestViewer', { type: 'zoom', factor: 1 });
  await expect
    .poll(async () => (await s.read<{ drawCalls: number } | null>('viewerStats'))?.drawCalls ?? 0)
    .toBeGreaterThan(0);
  const stats = await s.read<{ drawCalls: number; triangles: number }>('viewerStats');
  expect(stats.drawCalls).toBeLessThanOrEqual(30);

  await s.get('select', 'femur-l');
  await settle(page);
  const label = page.locator('[data-testid="viewer-label"][data-label-id="femur-l"] button');
  await expect(label).toBeVisible();
  await expect(label).toContainText('Femur');

  // The canvas really contains rendered geometry (transparent background → count opaque pixels).
  const shot = await s.get<{ ok: boolean; dataUrl: string; width: number; height: number }>('requestViewer', {
    type: 'screenshot',
    transparentBackground: true,
  });
  expect(shot.ok).toBe(true);
  expect(shot.dataUrl.startsWith('data:image/png')).toBe(true);
  const coverage = await page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return n / (c.width * c.height);
  }, shot.dataUrl);
  expect(coverage).toBeGreaterThan(0.005);

  await page.screenshot({ path: testInfo.outputPath('viewer-mock-selected.png') });
  await testInfo.attach('viewer-mock-selected', { path: testInfo.outputPath('viewer-mock-selected.png') });
  expect(errors).toEqual([]);
});

test('click selects the structure under the pointer; a drag does not', async ({ page }, testInfo) => {
  await openMockScene(page);
  const s = store(page);
  // Focus puts the structure at the canvas centre.
  const res = await s.get<{ ok: boolean }>('requestViewer', {
    type: 'focus',
    ids: ['liver'],
    animate: false,
  });
  expect(res.ok).toBe(true);
  await s.get('select', null);
  await settle(page);

  const c = await canvasCenter(page);
  test.skip(!c.onTop, 'UI covers the canvas centre in this layout');
  const tap = testInfo.project.name === 'phone';
  if (tap) await page.touchscreen.tap(c.x, c.y);
  else await page.mouse.click(c.x, c.y);
  await expect.poll(() => s.read<string | null>('selectedId')).toBe('liver');

  // Dragging (orbit) must not select.
  await s.get('select', null);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 80, c.y + 20, { steps: 6 });
  await page.mouse.up();
  await settle(page);
  expect(await s.read<string | null>('selectedId')).toBeNull();

  // A layer below 5 % opacity is not pickable: the click goes through / hits nothing.
  await s.get('requestViewer', { type: 'focus', ids: ['liver'], animate: false });
  await s.get('setLayerOpacity', 'visceral', 0.04);
  await settle(page);
  const c2 = await canvasCenter(page);
  await page.mouse.click(c2.x, c2.y);
  await settle(page);
  expect(await s.read<string | null>('selectedId')).not.toBe('liver');
});

test('isolate with context and exit restore the scene; toggling layers does not leak geometry', async ({
  page,
}) => {
  await openMockScene(page);
  const s = store(page);
  const geometries = async () => {
    await s.get('requestViewer', { type: 'zoom', factor: 1 });
    await settle(page);
    await page.waitForTimeout(600); // stats publish interval
    return (await s.read<{ geometries: number }>('viewerStats')).geometries;
  };

  await s.get('setLayerVisible', 'muscular', true);
  await waitGeometry(page);
  const before = await geometries();
  for (let i = 0; i < 4; i++) {
    await s.get('setLayerVisible', 'muscular', false);
    await settle(page);
    await s.get('setLayerVisible', 'muscular', true);
    await settle(page);
  }
  expect(await geometries()).toBe(before);

  await s.get('select', 'heart');
  await s.get('setIsolate', 'context', ['heart']);
  await settle(page);
  await expect(page.locator('[data-testid="viewer-label"][data-label-id="heart"] button')).toBeVisible();
  await s.get('exitIsolate');
  await settle(page);
  expect(await s.read<{ mode: string }>('isolate')).toMatchObject({ mode: 'none' });
});

test('standard views keep the patient’s left on the screen’s right in the anterior view', async ({
  page,
}) => {
  await openMockScene(page);
  const s = store(page);
  await s.get('requestViewer', { type: 'setView', view: 'anterior', animate: false });
  await settle(page);
  // Project the patient's left femur and right femur with the reported camera: left must be right of right.
  const cam = await s.read<{ position: number[]; target: number[] }>('camera');
  expect(cam.position[2]).toBeGreaterThan(cam.target[2]!); // camera in front (+Z)
  const gizmoL = await page.locator('[data-gizmo-axis="L"]').boundingBox();
  const gizmoR = await page.locator('[data-gizmo-axis="R"]').boundingBox();
  expect(gizmoL && gizmoR && gizmoL.x > gizmoR.x).toBe(true);
  await page.locator('[data-gizmo-axis="P"]').dispatchEvent('click');
  await expect
    .poll(async () => (await s.read<{ position: number[] }>('camera')).position[2])
    .toBeLessThan(cam.target[2]!);
});
