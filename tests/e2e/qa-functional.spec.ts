/**
 * Agent D (independent QA) — functional E2E on the REAL data (public/models), desktop 1440×900 and phone 390×844.
 * UI is driven like a user would (roles / labels); the store is only read through the test hook, except where noted
 * (e.g. Locate answers in the quiz, which need a 3D pick).
 */
import { expect, test, type Page } from '@playwright/test';
import {
  boot,
  canvasShot,
  closePhoneSheet,
  isPhone,
  menuItem,
  openPhoneSheet,
  pixelDiff,
  saveDataUrl,
  search,
  settle,
  shot,
  st,
  trackErrors,
  waitGeometry,
} from './qa-helpers';

test.describe.configure({ timeout: 600_000 });
// SwiftShader cannot keep up with several real systems (frames of many seconds block the page). QA_GPU=1 runs the
// same tests on the machine's GPU; the UI behaviour under test is identical.
if (process.env.QA_GPU)
  test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });

const SYSTEM_LABELS: Record<string, string> = {
  skeletal: 'Skeletal system',
  insertions: 'Muscle attachments',
  joints: 'Joints & ligaments',
  muscular: 'Muscular system',
  cardiovascular: 'Cardiovascular system',
  lymphoid: 'Lymphoid organs',
  nervous: 'Nervous system & sense organs',
  visceral: 'Visceral systems',
  regions: 'Skin & body regions',
};

async function openLayers(page: Page) {
  if (isPhone(page)) await openPhoneSheet(page, 'Layers');
  else await page.getByRole('tab', { name: 'Layers' }).click();
}

test('QA-01 initial load (real data): UI, default layers, rendered skeleton, no errors', async ({
  page,
}, testInfo) => {
  const errors = trackErrors(page);
  const t0 = Date.now();
  await boot(page, '', { prefs: false });
  const loadMs = Date.now() - t0;
  testInfo.annotations.push({ type: 'load-ms (SwiftShader)', description: String(loadMs) });

  await expect(page.getByRole('combobox', { name: 'Search anatomical structures' })).toBeVisible();
  // First-visit hint shown on a fresh profile.
  await expect(page.getByRole('note', { name: 'Welcome!' })).toBeVisible();
  expect(await st(page, 's.dataSource ? s.dataSource.kind : null')).toBe('http');
  // Default layers from the manifest: skeletal + visceral.
  const visible = await st<string[]>(
    page,
    'Object.entries(s.layers).filter(([, l]) => l.visible).map(([id]) => id).sort()',
  );
  expect(visible).toEqual(['skeletal', 'visceral']);
  await settle(page, 500);
  const c = await canvasShot(page);
  expect(c.ok).toBe(true);
  expect(c.coverage).toBeGreaterThan(0.02);
  saveDataUrl(testInfo, 'qa01-initial-canvas', c.dataUrl);
  await shot(page, testInfo, 'qa01-initial');
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('note', { name: 'Welcome!' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('QA-02 toggle each layer on and off from the Layers panel (all 9 systems)', async ({
  page,
}, testInfo) => {
  const errors = trackErrors(page);
  await boot(page);
  await openLayers(page);
  const base = await canvasShot(page);
  const ids = await st<string[]>(page, 's.manifest.systems.map((x) => x.id)');
  expect(ids.sort()).toEqual(Object.keys(SYSTEM_LABELS).sort());
  const results: string[] = [];
  for (const id of ids) {
    if (id === 'skeletal' || id === 'visceral') continue;
    const sw = page.getByRole('switch', { name: `Show ${SYSTEM_LABELS[id]}` });
    const before = await canvasShot(page);
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => st(page, `s.layers[${JSON.stringify(id)}].visible`)).toBe(true);
    await waitGeometry(page, 120_000);
    await settle(page, 400);
    const after = await canvasShot(page);
    const diff = await pixelDiff(page, before.dataUrl, after.dataUrl);
    results.push(`${id}: +${(diff * 100).toFixed(1)} % pixels changed`);
    // Inner systems (e.g. lymphoid organs behind bones and organs) change only a few pixels.
    expect.soft(diff, `turning on ${id} changes the rendered image`).toBeGreaterThan(0);
  }
  testInfo.annotations.push({ type: 'layer pixel diffs', description: results.join('; ') });
  const all = await canvasShot(page);
  saveDataUrl(testInfo, 'qa02-all-layers-canvas', all.dataUrl);
  await shot(page, testInfo, 'qa02-all-layers');
  // Every system can be switched off again, including the defaults.
  for (const id of ids) {
    await page.getByRole('switch', { name: `Show ${SYSTEM_LABELS[id]}` }).click();
    await expect.poll(() => st(page, `s.layers[${JSON.stringify(id)}].visible`)).toBe(false);
  }
  await settle(page, 400);
  const none = await canvasShot(page);
  expect(none.coverage).toBeLessThan(0.001);
  // Back to the defaults: the image matches the initial one.
  for (const id of ['skeletal', 'visceral'])
    await page.getByRole('switch', { name: `Show ${SYSTEM_LABELS[id]}` }).click();
  await settle(page, 600);
  const again = await canvasShot(page);
  expect(await pixelDiff(page, base.dataUrl, again.dataUrl)).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});

test('QA-03 layer opacity slider (muscles 60 % over bones, skin 20 % over muscles)', async ({
  page,
}, testInfo) => {
  await boot(page);
  await openLayers(page);
  await page.getByRole('switch', { name: 'Show Muscular system' }).click();
  await waitGeometry(page, 120_000);
  await settle(page, 400);
  const opaque = await canvasShot(page);
  const thumb = page.getByRole('slider', { name: 'Opacity of Muscular system' });
  await thumb.focus();
  for (let i = 0; i < 8; i++) await thumb.press('ArrowLeft');
  await expect.poll(() => st(page, 's.layers.muscular.opacity')).toBeCloseTo(0.6, 5);
  await expect(thumb).toHaveAttribute('aria-valuenow', '60');
  await settle(page, 400);
  const sixty = await canvasShot(page);
  expect(await pixelDiff(page, opaque.dataUrl, sixty.dataUrl)).toBeGreaterThan(0.02);
  await page.getByRole('switch', { name: 'Show Skin & body regions' }).click();
  await waitGeometry(page, 120_000);
  const skin = page.getByRole('slider', { name: 'Opacity of Skin & body regions' });
  await skin.focus();
  for (let i = 0; i < 16; i++) await skin.press('ArrowLeft');
  await expect.poll(() => st(page, 's.layers.regions.opacity')).toBeCloseTo(0.2, 5);
  await settle(page, 600);
  if (isPhone(page)) await closePhoneSheet(page);
  const xr = await canvasShot(page);
  saveDataUrl(testInfo, 'qa03-skin20-muscle60-bone100-canvas', xr.dataUrl);
  await shot(page, testInfo, 'qa03-opacity');
  // Opacity 0 → layer is not drawn.
  if (isPhone(page)) await openLayers(page);
  await skin.focus();
  await skin.press('Home');
  await thumb.focus();
  await thumb.press('Home');
  await expect.poll(() => st(page, '[s.layers.regions.opacity, s.layers.muscular.opacity]')).toEqual([0, 0]);
});

test('QA-04 search "femur" → select → isolate → exit isolate restores the view', async ({
  page,
}, testInfo) => {
  await boot(page);
  const options = await search(page, 'femur');
  const texts = await options.allInnerTexts();
  testInfo.annotations.push({ type: 'femur results', description: texts.slice(0, 8).join(' | ') });
  const femurL = options
    .filter({ hasText: 'Os femoris' })
    .filter({ has: page.locator('abbr', { hasText: 'L' }) });
  await expect(femurL.first()).toBeVisible();
  await femurL.first().click();
  await expect.poll(() => st(page, 's.selectedId')).toBe('femur-l');
  if (isPhone(page)) {
    await expect(page.getByTestId('info-peek')).toContainText('Os femoris');
    await page.getByTestId('info-peek').getByRole('button', { name: 'Show details' }).click();
  }
  const info = page.getByTestId('info-panel');
  // The h2 also contains the side badge ("L"), so match the start.
  await expect(info.getByRole('heading', { level: 2 })).toHaveText(/^Os femoris/);
  testInfo.annotations.push({
    type: 'h2 text',
    description: await info.getByRole('heading', { level: 2 }).innerText(),
  });
  await expect(info).toContainText('Femur');
  await expect(info).toContainText('Skeletal system');
  await expect(info).toContainText('Left');
  await expect(info).toContainText('Unreviewed');
  await settle(page, 600);
  await shot(page, testInfo, 'qa04-femur-selected');
  if (isPhone(page)) await closePhoneSheet(page);

  const before = await st<{ layers: unknown; hidden: unknown; cam: { position: number[] } }>(
    page,
    '({ layers: s.layers, hidden: s.hiddenIds, cam: s.camera })',
  );
  const beforeShot = await canvasShot(page);
  if (isPhone(page)) {
    await openPhoneSheet(page, 'Tools');
    await page.getByRole('dialog').getByRole('button', { name: 'Isolate', exact: true }).click();
    await closePhoneSheet(page);
  } else {
    await page
      .getByRole('toolbar', { name: 'View tools' })
      .getByRole('button', { name: 'Isolate', exact: true })
      .click();
    await page.getByRole('menuitem').filter({ hasNotText: 'context' }).click();
  }
  await expect.poll(() => st(page, 's.isolate')).toMatchObject({ mode: 'isolate', ids: ['femur-l'] });
  await settle(page, 800);
  const iso = await canvasShot(page);
  saveDataUrl(testInfo, 'qa04-femur-isolated-canvas', iso.dataUrl);
  await shot(page, testInfo, 'qa04-femur-isolated');
  expect(iso.coverage).toBeGreaterThan(0.002);
  // Only the femur is drawn: its bone colour, no organs.
  const others = await st<number>(page, 'Object.keys(s.structures).length');
  expect(others).toBeGreaterThan(100);

  if (isPhone(page)) {
    await openPhoneSheet(page, 'Tools');
    await page.getByRole('dialog').getByRole('button', { name: 'Exit isolate', exact: true }).click();
    await closePhoneSheet(page);
  } else {
    await page
      .getByRole('toolbar', { name: 'View tools' })
      .getByRole('button', { name: 'Exit isolate' })
      .click();
  }
  await expect.poll(() => st(page, 's.isolate.mode')).toBe('none');
  const after = await st<{ layers: unknown; hidden: unknown; cam: { position: number[] } }>(
    page,
    '({ layers: s.layers, hidden: s.hiddenIds, cam: s.camera })',
  );
  expect(after.layers).toEqual(before.layers);
  expect(after.hidden).toEqual(before.hidden);
  await expect
    .poll(async () => {
      const c = await st<{ position: number[] } | null>(page, 's.camera');
      return c ? Math.max(...c.position.map((v, i) => Math.abs(v - before.cam.position[i]!))) : 1;
    })
    .toBeLessThan(0.005);
  await settle(page, 800);
  const restored = await canvasShot(page);
  expect(await pixelDiff(page, beforeShot.dataUrl, restored.dataUrl)).toBeLessThan(0.02);
});

test('QA-05 search in Latin ("Musculus biceps brachii") and in English ("biceps brachii", "liver")', async ({
  page,
}, testInfo) => {
  await boot(page);
  let options = await search(page, 'Musculus biceps brachii');
  const latin = await options.allInnerTexts();
  testInfo.annotations.push({ type: 'latin results', description: latin.slice(0, 6).join(' | ') });
  console.log(
    `[${testInfo.project.name}] "Musculus biceps brachii" →\n  ${latin
      .slice(0, 8)
      .join('\n  ')
      .replace(/\n(?! {2})/g, ' · ')}`,
  );
  await expect(options.first()).toContainText('Musculus biceps brachii');
  // Finding check: Enter (= top hit) should open the muscle, not one of its attachment patches.
  await page.keyboard.press('Enter');
  await expect.poll(() => st(page, 's.selectedId')).not.toBeNull();
  const top = await st<string>(page, 's.selectedId');
  testInfo.annotations.push({ type: 'Enter selects', description: top });
  expect.soft(top, 'top hit for the exact Latin muscle name is the muscle').toBe('g-biceps-brachii-muscle');
  await settle(page, 600);
  await shot(page, testInfo, 'qa05-enter-on-musculus-biceps-brachii');
  options = await search(page, 'Musculus biceps brachii');
  await options.filter({ hasText: 'Group' }).first().click();
  await expect.poll(() => st(page, 's.selectedId')).toBe('g-biceps-brachii-muscle');
  await expect.poll(() => st(page, 's.layers.muscular.visible')).toBe(true);
  await waitGeometry(page, 120_000);
  if (isPhone(page))
    await page.getByTestId('info-peek').getByRole('button', { name: 'Show details' }).click();
  const info = page.getByTestId('info-panel');
  await expect(info.getByRole('heading', { level: 2 })).toHaveText(/^Musculus biceps brachii/);
  await expect(info).toContainText('Biceps brachii muscle');
  await expect(info).toContainText('Muscular system');
  await settle(page, 800);
  await shot(page, testInfo, 'qa05-biceps-latin');
  if (isPhone(page)) await closePhoneSheet(page);

  options = await search(page, 'biceps brachii');
  const english = await options.allInnerTexts();
  testInfo.annotations.push({ type: 'english results', description: english.slice(0, 6).join(' | ') });
  console.log(
    `[${testInfo.project.name}] "biceps brachii" →\n  ${english
      .slice(0, 8)
      .join('\n  ')
      .replace(/\n(?! {2})/g, ' · ')}`,
  );
  expect(english.join('\n')).toContain('Biceps brachii muscle');
  await page.keyboard.press('Escape');

  options = await search(page, 'liver');
  await expect(options.first()).toContainText('Hepar');
  await options.first().click();
  await expect.poll(() => st(page, 's.selectedId')).toBe('liver');
  if (isPhone(page))
    await page.getByTestId('info-peek').getByRole('button', { name: 'Show details' }).click();
  await expect(info.getByRole('heading', { level: 2 })).toHaveText(/^Hepar/);
  await expect(info).toContainText('Visceral systems');
  // Name language toggle: English names.
  if (isPhone(page)) await closePhoneSheet(page);
  await page.getByRole('radio', { name: 'English' }).first().click();
  await expect.poll(() => st(page, 's.nameLang')).toBe('en');
  // The 3D label follows the name language; the info panel keeps Latin bold first by design (PROMPT §6-C.5).
  await expect(page.locator('[data-testid="viewer-label"][data-label-id="liver"]')).toContainText('Liver');
  if (isPhone(page)) {
    await expect(page.getByTestId('info-peek')).toContainText('Liver');
    await page.getByTestId('info-peek').getByRole('button', { name: 'Show details' }).click();
  }
  await expect(info.getByRole('heading', { level: 2 })).toHaveText(/^Hepar/);
  await expect(info).toContainText('Liver');
});

async function openClipping(page: Page) {
  if (isPhone(page)) await openPhoneSheet(page, 'Tools');
  else
    await page
      .getByRole('toolbar', { name: 'View tools' })
      .getByRole('button', { name: 'Cutting planes' })
      .click();
}
async function closeTools(page: Page) {
  if (isPhone(page)) await closePhoneSheet(page);
  else await page.keyboard.press('Escape');
}
const setView = (page: Page, view: string) =>
  st(page, `s.requestViewer({ type: 'setView', view: a, animate: false })`, view);

test('QA-06 clipping on all three planes: enable, move, flip; kept side matches the contract', async ({
  page,
}, testInfo) => {
  await boot(page);
  await setView(page, 'anterior');
  await settle(page, 500);
  const full = await canvasShot(page);
  const report: string[] = [`none: cx=${full.cx.toFixed(3)} cy=${full.cy.toFixed(3)}`];

  // Sagittal (⟂ x). Not flipped keeps x > plane = patient's LEFT = viewer's right in the anterior view.
  await openClipping(page);
  await page.getByRole('switch', { name: 'Cut along the Sagittal plane' }).click();
  await expect.poll(() => st(page, 's.clipping.sagittal.enabled')).toBe(true);
  await closeTools(page);
  await settle(page, 600);
  let c = await canvasShot(page);
  saveDataUrl(testInfo, 'qa06-sagittal-50-canvas', c.dataUrl);
  await shot(page, testInfo, 'qa06-sagittal-50');
  report.push(`sagittal 50: cx=${c.cx.toFixed(3)}`);
  expect(c.cx).toBeGreaterThan(full.cx + 0.01);
  await openClipping(page);
  await page.locator('[data-axis="sagittal"]').getByRole('button', { name: 'Flip side' }).click();
  await expect.poll(() => st(page, 's.clipping.sagittal.flipped')).toBe(true);
  await closeTools(page);
  await settle(page, 600);
  c = await canvasShot(page);
  report.push(`sagittal 50 flipped: cx=${c.cx.toFixed(3)}`);
  expect(c.cx).toBeLessThan(full.cx - 0.01);
  await openClipping(page);
  const sagPos = page.getByRole('slider', { name: 'Position of the Sagittal plane' });
  await sagPos.focus();
  await sagPos.press('PageUp');
  await expect.poll(() => st(page, 's.clipping.sagittal.position')).toBeCloseTo(0.55, 3);
  await page.getByRole('switch', { name: 'Cut along the Sagittal plane' }).click();

  // Transverse (⟂ y). Not flipped keeps y > plane = superior half → pixels in the upper half.
  await page.getByRole('switch', { name: 'Cut along the Transverse plane' }).click();
  await expect.poll(() => st(page, 's.clipping.transverse.enabled')).toBe(true);
  await closeTools(page);
  await settle(page, 600);
  c = await canvasShot(page);
  saveDataUrl(testInfo, 'qa06-transverse-50-canvas', c.dataUrl);
  report.push(`transverse 50: cy=${c.cy.toFixed(3)} (none ${full.cy.toFixed(3)})`);
  expect(c.cy).toBeLessThan(full.cy - 0.1);
  await openClipping(page);
  await page.locator('[data-axis="transverse"]').getByRole('button', { name: 'Flip side' }).click();
  await closeTools(page);
  await settle(page, 600);
  c = await canvasShot(page);
  report.push(`transverse 50 flipped: cy=${c.cy.toFixed(3)}`);
  expect(c.cy).toBeGreaterThan(full.cy + 0.1);
  await openClipping(page);
  await page.getByRole('switch', { name: 'Cut along the Transverse plane' }).click();

  // Coronal (⟂ z). Not flipped keeps z > plane = anterior part. Left lateral view: anterior is on screen left.
  await page.getByRole('switch', { name: 'Cut along the Coronal plane' }).click();
  await expect.poll(() => st(page, 's.clipping.coronal.enabled')).toBe(true);
  await closeTools(page);
  await setView(page, 'left');
  await settle(page, 600);
  await st(page, 's.setClipPlane("coronal", { enabled: false })');
  await settle(page, 600);
  const lateral = await canvasShot(page);
  await st(page, 's.setClipPlane("coronal", { enabled: true })');
  await settle(page, 600);
  c = await canvasShot(page);
  saveDataUrl(testInfo, 'qa06-coronal-50-left-view-canvas', c.dataUrl);
  await shot(page, testInfo, 'qa06-coronal-50-left-view');
  report.push(`coronal 50 (left view): cx=${c.cx.toFixed(3)} (unclipped ${lateral.cx.toFixed(3)})`);
  expect(c.cx).toBeLessThan(lateral.cx - 0.01);
  await openClipping(page);
  await page.locator('[data-axis="coronal"]').getByRole('button', { name: 'Flip side' }).click();
  await closeTools(page);
  await settle(page, 600);
  c = await canvasShot(page);
  report.push(`coronal 50 flipped (left view): cx=${c.cx.toFixed(3)}`);
  expect(c.cx).toBeGreaterThan(lateral.cx + 0.01);

  // All three at once, then reset.
  await st(
    page,
    's.setClipPlane("sagittal", { enabled: true }) || s.setClipPlane("transverse", { enabled: true })',
  );
  await setView(page, 'anterior');
  await settle(page, 600);
  await shot(page, testInfo, 'qa06-all-three-planes');
  await openClipping(page);
  await page.getByRole('button', { name: 'Reset planes' }).click();
  await expect
    .poll(() =>
      st(page, '[s.clipping.sagittal.enabled, s.clipping.coronal.enabled, s.clipping.transverse.enabled]'),
    )
    .toEqual([false, false, false]);
  testInfo.annotations.push({ type: 'clip centroids', description: report.join('; ') });
});

async function clickCentre(page: Page) {
  const centre = await page.evaluate(() => {
    const cnv = document.querySelector('[data-testid="viewer"] canvas')!;
    const r = cnv.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    return { x, y, onTop: document.elementFromPoint(x, y) === cnv };
  });
  if (!centre.onTop) return false;
  if (isPhone(page)) await page.touchscreen.tap(centre.x, centre.y);
  else await page.mouse.click(centre.x, centre.y);
  return true;
}

test('QA-07 explode slider; picking hits the exploded positions', async ({ page }, testInfo) => {
  await boot(page);
  // Baseline (not exploded): focus the liver and click its centre.
  await st(page, `s.requestViewer({ type: 'focus', ids: ['liver'], animate: false })`);
  await settle(page, 800);
  if (await clickCentre(page)) {
    await expect.poll(() => st(page, 's.selectedId'), { timeout: 20_000 }).not.toBeNull();
    const hit = await st<string>(page, 's.selectedId');
    testInfo.annotations.push({ type: 'click on focused liver (no explode)', description: hit });
    expect.soft(hit, 'clicking the focused liver selects the liver').toBe('liver');
    await shot(page, testInfo, 'qa07-click-liver-not-exploded');
  }
  await st(page, 's.select(null)');
  await st(page, `s.requestViewer({ type: 'resetCamera', animate: false })`);
  await setView(page, 'anterior');
  await settle(page, 500);
  const before = await canvasShot(page);
  if (isPhone(page)) await openPhoneSheet(page, 'Tools');
  else
    await page.getByRole('toolbar', { name: 'View tools' }).getByRole('button', { name: 'Explode' }).click();
  const slider = page.getByRole('slider', { name: 'Explode amount' });
  await slider.focus();
  for (let i = 0; i < 6; i++) await slider.press('PageUp');
  await expect.poll(() => st(page, 's.explode')).toBeCloseTo(0.6, 5);
  await closeTools(page);
  await settle(page, 1500);
  const ex = await canvasShot(page);
  saveDataUrl(testInfo, 'qa07-explode-60-canvas', ex.dataUrl);
  await shot(page, testInfo, 'qa07-explode-60');
  expect(await pixelDiff(page, before.dataUrl, ex.dataUrl)).toBeGreaterThan(0.02);
  // Pick at the screen position of the (exploded) liver: focus it, click the canvas centre.
  await st(page, `s.requestViewer({ type: 'focus', ids: ['liver'], animate: false })`);
  await st(page, 's.select(null)');
  await settle(page, 800);
  const centre = await page.evaluate(() => {
    const cnv = document.querySelector('[data-testid="viewer"] canvas')!;
    const r = cnv.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    return { x, y, onTop: document.elementFromPoint(x, y) === cnv };
  });
  if (centre.onTop) {
    if (isPhone(page)) await page.touchscreen.tap(centre.x, centre.y);
    else await page.mouse.click(centre.x, centre.y);
    await expect.poll(() => st(page, 's.selectedId'), { timeout: 20_000 }).not.toBeNull();
    const hit = await st<string>(page, 's.selectedId');
    testInfo.annotations.push({ type: 'click on focused liver (explode 60 %)', description: hit });
    expect.soft(hit, 'clicking the focused, exploded liver selects the liver').toBe('liver');
    await shot(page, testInfo, 'qa07-click-liver-exploded');
  } else {
    testInfo.annotations.push({ type: 'skip', description: 'canvas centre covered by UI' });
  }
  await st(page, 's.setExplode(0)');
});

// ------------------------------------------------------------------------------------------------ quiz

async function openQuiz(page: Page) {
  if (isPhone(page)) await menuItem(page, 'Quiz');
  else await page.getByRole('button', { name: 'Quiz', exact: true }).click();
  const panel = page.getByTestId('quiz-panel');
  await expect(panel).toBeVisible();
  return panel;
}

async function startQuiz(page: Page, type: 'Locate' | 'Identify' | 'Name it') {
  const panel = await openQuiz(page);
  for (const t of ['Locate', 'Identify', 'Name it']) {
    const cb = panel.getByRole('checkbox', { name: new RegExp(`^${t}`) });
    if (t === type) await cb.check();
    else await cb.uncheck();
  }
  await panel.getByRole('radio', { name: '5', exact: true }).click();
  await expect(panel.getByTestId('quiz-pool')).toContainText('structures in scope', { timeout: 30_000 });
  await panel.getByTestId('quiz-start').click();
  await expect.poll(() => st(page, '[s.mode, s.labelsVisible, s.selectedId]')).toEqual(['quiz', false, null]);
  await expect(page.getByTestId('info-panel')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Search anatomical structures' })).toHaveCount(0);
  return panel;
}

/** Structures whose Locate label ("<name> (<kind>, <side>)") equals the prompt. */
async function locateCandidates(page: Page, label: string) {
  return st<string[]>(
    page,
    `(() => {
      const out = [];
      for (const x of Object.values(s.structures)) {
        if (!s.layers[x.system] || !s.layers[x.system].visible) continue;
        const base = x.names[s.nameLang] ?? x.names.la ?? x.names.en;
        const parts = [];
        if (x.kind === 'origin' || x.kind === 'insertion') parts.push(x.kind);
        if (x.side && x.sideSource !== 'name') parts.push(x.side);
        if (base + (parts.length ? ' (' + parts.join(', ') + ')' : '') === a) out.push(x.id);
      }
      return out;
    })()`,
    label,
  );
}

const quizTarget = (page: Page) =>
  st<string>(page, `Object.entries(s.highlights).find(([, k]) => k === 'quiz-target')?.[0] ?? null`);

async function finishAndCheckSummary(page: Page, expectedScore: number, total: number) {
  const panel = page.getByTestId('quiz-panel');
  const summary = panel.getByTestId('quiz-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(`${expectedScore} of ${total} correct`);
  await expect(summary.locator('[data-mistake]')).toHaveCount(total - expectedScore);
  await expect.poll(() => st(page, 's.mode')).toBe('explore');
  return summary;
}

test('QA-08a quiz: one full Locate quiz (3D click + simulated picks), review and retry', async ({
  page,
}, testInfo) => {
  await boot(page);
  const layersBefore = await st(page, 's.layers');
  const panel = await startQuiz(page, 'Locate');
  let score = 0;
  const log: string[] = [];
  for (let i = 0; i < 5; i++) {
    const q = panel.getByTestId('quiz-question');
    await expect(q).toHaveAttribute('data-question-type', 'locate');
    await expect(q).toContainText(`Click the`);
    expect(await st(page, 'Object.keys(s.highlights).length')).toBe(0); // nothing highlighted → no give-away
    const label = (await q.locator('strong').first().innerText()).trim();
    const cands = await locateCandidates(page, label);
    log.push(`${label} → ${cands.join('/')}`);
    expect(cands.length, `prompt "${label}" identifies exactly one structure`).toBeGreaterThanOrEqual(1);
    expect.soft(cands.length, `prompt "${label}" is unambiguous`).toBe(1);
    const target = cands[0]!;
    let verdict: string;
    if (i === 0) {
      // Real 3D pick: bring the target to the canvas centre, then click / tap it.
      await st(page, `s.requestViewer({ type: 'focus', ids: [a], animate: false })`, target);
      await settle(page, 800);
      const c = await page.evaluate(() => {
        const cnv = document.querySelector('[data-testid="viewer"] canvas')!;
        const r = cnv.getBoundingClientRect();
        const x = Math.round(r.left + r.width / 2);
        const y = Math.round(r.top + r.height / 2);
        return { x, y, onTop: document.elementFromPoint(x, y) === cnv };
      });
      if (c.onTop) {
        if (isPhone(page)) await page.touchscreen.tap(c.x, c.y);
        else await page.mouse.click(c.x, c.y);
      } else await st(page, 's.pickStructure(a)', target);
      await expect(panel.getByTestId('quiz-feedback')).toBeVisible({ timeout: 20_000 });
      verdict = (await panel.getByTestId('quiz-feedback').getAttribute('data-verdict')) ?? '';
      log.push(`  real ${c.onTop ? 'click' : 'pick'}: ${verdict}`);
      if (verdict === 'correct') score++;
    } else if (i === 1) {
      const pair = await st<string | null>(page, 's.structures[a].pairId ?? null', target);
      const other =
        pair ??
        (await st<string>(
          page,
          `Object.keys(s.structures).find((id) => id !== a && s.layers[s.structures[id].system].visible)`,
          target,
        ));
      await st(page, 's.pickStructure(a)', other);
      verdict = (await panel.getByTestId('quiz-feedback').getAttribute('data-verdict')) ?? '';
      expect(verdict).toBe(pair ? 'wrong-side' : 'wrong');
      expect(await st(page, 's.highlights')).toMatchObject({
        [target]: 'quiz-correct',
        [other]: 'quiz-wrong',
      });
    } else {
      await st(page, 's.pickStructure(a)', target);
      await expect(panel.getByTestId('quiz-feedback')).toHaveAttribute('data-verdict', 'correct');
      score++;
    }
    if (i === 1) await shot(page, testInfo, 'qa08a-locate-feedback');
    await panel.getByTestId('quiz-next').click();
  }
  testInfo.annotations.push({ type: 'locate log', description: log.join('; ') });
  console.log(`[${testInfo.project.name}] locate: ${log.join(' | ')}`);
  await finishAndCheckSummary(page, score, 5);
  await shot(page, testInfo, 'qa08a-locate-summary');
  expect(await st(page, 's.layers')).toEqual(layersBefore);
  // Retry mistakes runs only the missed questions.
  await panel.getByTestId('quiz-retry').click();
  await expect(panel.getByTestId('quiz-question')).toBeVisible();
  await expect(panel).toContainText(`Question 1 of ${5 - score}`);
  await panel.getByRole('button', { name: 'End quiz' }).click();
  await expect.poll(() => st(page, 's.mode')).toBe('explore');
  expect(await page.evaluate(() => localStorage.getItem('oaa.quiz.leitner.v1'))).not.toBeNull();
});

test('QA-08b quiz: one full Identify quiz (options, distractors, keyboard), review', async ({
  page,
}, testInfo) => {
  await boot(page);
  const panel = await startQuiz(page, 'Identify');
  const log: string[] = [];
  for (let i = 0; i < 5; i++) {
    const q = panel.getByTestId('quiz-question');
    await expect(q).toHaveAttribute('data-question-type', 'identify');
    await expect.poll(() => quizTarget(page)).not.toBeNull();
    const target = await quizTarget(page);
    expect(await st(page, 's.isolate')).toMatchObject({ mode: 'context', ids: [target] });
    const opts = q.locator('[data-option]');
    const ids = await opts.evaluateAll((els) => els.map((e) => e.getAttribute('data-option')!));
    const labels = (await opts.allInnerTexts()).map((t) => t.replace(/^\d+\s*/, '').trim());
    log.push(`${target}: ${labels.join(' / ')}`);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
    expect(new Set(labels).size).toBe(4);
    expect(ids).toContain(target);
    const pair = await st<string | null>(page, 's.structures[a].pairId ?? null', target);
    if (pair) expect(ids).not.toContain(pair);
    const sys = await st<string[]>(page, 'a.map((id) => s.structures[id].system)', ids);
    expect(new Set(sys).size).toBe(1); // distractors from the same system
    if (i === 0) {
      // The highlighted target must not sit under the quiz panel / sheet. Measured on the rendered image: centroid
      // of the 'quiz-target' orange pixels (lead re-run: the viewer now centres views in the uncovered canvas
      // area, so the canvas centre is no longer the target position).
      const shotTarget = await canvasShot(page);
      const geo = await page.evaluate(async (dataUrl) => {
        const cnv = document.querySelector('[data-testid="viewer"] canvas')!.getBoundingClientRect();
        const qp = document.querySelector('[data-testid="quiz-panel"]')!.getBoundingClientRect();
        const img = new Image();
        img.src = dataUrl;
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
        for (let i = 0; i < d.length; i += 4) {
          const [r, g, b, a] = [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
          if (a > 200 && r > 90 && g > 0.5 * r && g < 0.85 * r && b < 0.45 * r) {
            n++;
            sx += (i / 4) % c.width;
            sy += Math.floor(i / 4 / c.width);
          }
        }
        const k = cnv.width / c.width;
        const cx = n ? cnv.left + (sx / n) * k : NaN;
        const cy = n ? cnv.top + (sy / n) * k : NaN;
        const covered = !n || (cx >= qp.left && cx <= qp.right && cy >= qp.top && cy <= qp.bottom);
        return {
          targetPixels: n,
          cx: Math.round(cx),
          cy: Math.round(cy),
          panel: [qp.left, qp.top, qp.right, qp.bottom].map(Math.round),
          covered,
        };
      }, shotTarget.dataUrl);
      testInfo.annotations.push({ type: 'target vs quiz panel', description: JSON.stringify(geo) });
      console.log(`[${testInfo.project.name}] quiz target centre vs panel: ${JSON.stringify(geo)}`);
      expect
        .soft(geo.covered, 'highlighted quiz target is visible and not covered by the quiz panel')
        .toBe(false);
      await shot(page, testInfo, 'qa08b-identify-question');
      await q.locator(`[data-option]:not([data-option="${target}"])`).first().click();
      await expect(panel.getByTestId('quiz-feedback')).toHaveAttribute('data-verdict', 'wrong');
    } else if (i === 2) {
      await page.keyboard.press(String(ids.indexOf(target) + 1));
      await expect(panel.getByTestId('quiz-feedback')).toHaveAttribute('data-verdict', 'correct');
    } else {
      await q.locator(`[data-option="${target}"]`).click();
      await expect(panel.getByTestId('quiz-feedback')).toHaveAttribute('data-verdict', 'correct');
    }
    await panel.getByTestId('quiz-next').click();
  }
  testInfo.annotations.push({ type: 'identify log', description: log.join('; ') });
  await finishAndCheckSummary(page, 4, 5);
  await shot(page, testInfo, 'qa08b-identify-summary');
});

test('QA-08c quiz: one full Name-it quiz (exact Latin, typo, English, wrong, skip), review', async ({
  page,
}, testInfo) => {
  await boot(page);
  const panel = await startQuiz(page, 'Name it');
  let score = 0;
  const log: string[] = [];
  for (let i = 0; i < 5; i++) {
    const q = panel.getByTestId('quiz-question');
    await expect(q).toHaveAttribute('data-question-type', 'name');
    await expect.poll(() => quizTarget(page)).not.toBeNull();
    const target = await quizTarget(page);
    const names = await st<{ la?: string; en: string }>(page, 's.structures[a].names', target);
    const input = q.locator('#quiz-name-input');
    let answer = '';
    let expected = '';
    if (i === 0) {
      answer = names.la ?? names.en;
      expected = 'correct';
    } else if (i === 1) {
      const base = names.la ?? names.en;
      const letters = [...base].map((ch, k) => (/[a-z]/i.test(ch) ? k : -1)).filter((k) => k >= 0);
      const k = letters[Math.floor(letters.length / 2)]!;
      answer = base.slice(0, k) + (base[k]!.toLowerCase() === 'x' ? 'y' : 'x') + base.slice(k + 1);
      expected = base.replace(/[^a-z]/gi, '').length > 4 ? 'typo' : 'wrong';
    } else if (i === 2) {
      answer = names.en;
      expected = 'correct';
    } else if (i === 3) {
      answer = 'qwertzuiop asdfgh';
      expected = 'wrong';
    }
    if (i < 4) {
      await input.fill(answer);
      await q.getByRole('button', { name: 'Check' }).click();
    } else {
      await q.getByRole('button', { name: 'Skip' }).click();
      expected = 'skipped';
    }
    await expect(panel.getByTestId('quiz-feedback')).toHaveAttribute('data-verdict', expected);
    if (expected === 'correct' || expected === 'typo') score++;
    log.push(`${target}: "${answer}" → ${expected}`);
    if (i === 1) await shot(page, testInfo, 'qa08c-name-typo-feedback');
    await panel.getByTestId('quiz-next').click();
  }
  testInfo.annotations.push({ type: 'name log', description: log.join('; ') });
  await finishAndCheckSummary(page, score, 5);
  await shot(page, testInfo, 'qa08c-name-summary');
});

// ------------------------------------------------------------------------------------------------ URL state

test.describe('URL state', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('QA-09 URL round trip: "Copy link", open the link, same state and same picture', async ({
    page,
    context,
  }, testInfo) => {
    await boot(page);
    const options = await search(page, 'liver');
    await options.first().click();
    await expect.poll(() => st(page, 's.selectedId')).toBe('liver');
    await st(page, 's.setLayerVisible("cardiovascular", true)');
    await waitGeometry(page, 120_000);
    await st(page, 's.setLayerOpacity("visceral", 0.5)');
    await st(page, 's.setXray(true)');
    await st(page, 's.setClipPlane("sagittal", { enabled: true, position: 0.6, flipped: true })');
    await st(page, 's.setExplode(0.3)');
    await st(page, 's.setNameLang("en")');
    await st(page, 's.togglePinned("femur-l")');
    await st(page, 's.setNodeHidden("stomach", true)');
    await st(page, `s.requestViewer({ type: 'setView', view: 'left', animate: false })`);
    await st(page, `s.requestViewer({ type: 'zoom', factor: 1.25 })`);
    await settle(page, 1200);
    await expect.poll(() => new URL(page.url()).searchParams.has('cam'), { timeout: 10_000 }).toBe(true);

    if (isPhone(page)) {
      await openPhoneSheet(page, 'Tools');
      await page.getByRole('dialog').getByRole('button', { name: 'Copy link' }).click();
      await closePhoneSheet(page);
    } else {
      await page
        .getByRole('toolbar', { name: 'View tools' })
        .getByRole('button', { name: 'Copy link' })
        .click();
    }
    await expect(page.getByText('Link copied')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    testInfo.annotations.push({ type: 'copied link', description: copied });
    expect(new URL(copied).search).toBe(new URL(page.url()).search);
    const pick = `({ sel: s.getShareableState().selectedId, layers: Object.fromEntries(Object.entries(s.layers).filter(([, l]) => l.visible).map(([k, l]) => [k, Math.round(l.opacity * 100)])),
      hidden: Object.keys(s.hiddenIds).sort(), iso: s.isolate.mode, clip: s.clipping, explode: s.explode, xray: s.xray, n: s.nameLang, pins: s.pinnedIds, cam: s.camera })`;
    type Snap = { cam: { position: number[]; target: number[] } } & Record<string, unknown>;
    const a = await st<Snap>(page, pick);
    await settle(page, 500);
    const shotA = await canvasShot(page);
    saveDataUrl(testInfo, 'qa09-before-canvas', shotA.dataUrl);

    const page2 = await context.newPage();
    await page2.goto(copied);
    await expect.poll(() => st(page2, 's.dataStatus'), { timeout: 60_000 }).toBe('loaded');
    await expect.poll(() => st(page2, 's.viewerReady'), { timeout: 60_000 }).toBe(true);
    await waitGeometry(page2, 120_000);
    await expect.poll(() => st(page2, 's.camera !== null'), { timeout: 30_000 }).toBe(true);
    await settle(page2, 1500);
    const b = await st<Snap>(page2, pick);
    const { cam: camA, ...restA } = a;
    const { cam: camB, ...restB } = b;
    expect(restB).toEqual(restA);
    const d = (x: number[], y: number[]) => Math.max(...x.map((v, i) => Math.abs(v - y[i]!)));
    expect(d(camB.position, camA.position)).toBeLessThan(0.003);
    expect(d(camB.target, camA.target)).toBeLessThan(0.003);
    const shotB = await canvasShot(page2);
    saveDataUrl(testInfo, 'qa09-after-canvas', shotB.dataUrl);
    await shot(page2, testInfo, 'qa09-reopened');
    const diff = await pixelDiff(page2, shotA.dataUrl, shotB.dataUrl);
    testInfo.annotations.push({ type: 'pixel diff', description: diff.toFixed(4) });
    // Sub-pixel differences of thin transparent vessels after the mm-rounded camera (DPR 2 on phone).
    expect(diff).toBeLessThan(0.06);

    // Isolate with context also survives a reload.
    await st(page2, 's.setIsolate("context", ["liver"])');
    await expect.poll(() => new URL(page2.url()).searchParams.get('i')).toBe('c:liver');
    await page2.reload();
    await expect.poll(() => st(page2, 's.dataStatus'), { timeout: 60_000 }).toBe('loaded');
    await expect
      .poll(() => st(page2, 's.isolate'), { timeout: 30_000 })
      .toMatchObject({ mode: 'context', ids: ['liver'] });
  });
});

// ------------------------------------------------------------------------------------------------ credits / licences

test('QA-10 credits page reachable; attribution, licences and NC flags visible in the app', async ({
  page,
  request,
}, testInfo) => {
  await boot(page);
  if (isPhone(page)) await menuItem(page, 'About');
  else await page.getByRole('button', { name: 'About' }).click();
  const about = page.getByRole('dialog', { name: 'About' });
  await expect(about).toBeVisible();
  await expect(about).toContainText('Educational use only');
  await expect(about).toContainText('not be used for diagnosis');
  await expect(about).toContainText('nonprofit');
  for (const t of [
    'Z-Anatomy - The libre 3D atlas of anatomy',
    'BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan',
    'Wikipedia - CC-BY-SA 3.0',
    'Anatomy of the Inner Ear - by University of Dundee School of Medicine - CC-BY-NC-SA 4.0',
    'Kidney - by Lissie Cowley - CC-BY-NC 4.0',
    'Application code: MIT',
    'CC BY-SA 4.0',
  ])
    await expect(about).toContainText(t);
  await expect(about.getByText('non-commercial', { exact: true })).toHaveCount(2);
  // Upstream also credits these (ATTRIBUTION.md); the in-app credits should too.
  expect
    .soft(await about.innerText(), 'in-app credits name "Cranial Nerves and Foramina" (CC BY 4.0)')
    .toContain('Cranial Nerves and Foramina');
  expect
    .soft(
      await about.getByRole('link', { name: /ATTRIBUTION/ }).count(),
      'credits link to the full ATTRIBUTION text',
    )
    .toBeGreaterThan(0);
  await about.evaluate((el) => (el.scrollTop = 0));
  await shot(page, testInfo, 'qa10-about');
  await page.keyboard.press('Escape');

  // Are the full attribution / licence files published with the site? (lead fix for H2: shipped as text files
  // under /licenses/, see vite.config.ts)
  for (const f of ['/licenses/ATTRIBUTION.txt', '/licenses/LICENSE.txt', '/licenses/assets-LICENSE.txt']) {
    const r = await request.get(f);
    const type = r.headers()['content-type'] ?? '';
    testInfo.annotations.push({ type: `GET ${f}`, description: `${r.status()} ${type}` });
    expect.soft(r.ok() && !type.includes('html'), `${f} is served by the site`).toBe(true);
  }

  // NC structure: kidney-l shows the NC notice and its upstream attribution.
  await st(page, 's.selectAndFocus("kidney-l")');
  await expect.poll(() => st(page, 's.selectedId')).toBe('kidney-l');
  if (isPhone(page))
    await page.getByTestId('info-peek').getByRole('button', { name: 'Show details' }).click();
  const info = page.getByTestId('info-panel');
  await expect(info).toContainText('Non-commercial licence');
  await expect(info).toContainText('Kidney - by Lissie Cowley');
  await expect(info).toContainText('Left');
  await shot(page, testInfo, 'qa10-kidney-nc-info');
  if (isPhone(page)) await closePhoneSheet(page);
  // A normal structure has no NC notice; its definition shows source, licence and the unreviewed badge.
  await st(page, 's.selectAndFocus("femur-r")');
  await expect.poll(() => st(page, 's.selectedId')).toBe('femur-r');
  if (isPhone(page))
    await page.getByTestId('info-peek').getByRole('button', { name: 'Show details' }).click();
  await expect(info).toContainText('Right');
  await expect(info).not.toContainText('Non-commercial licence');
  await expect(info).toContainText('Unreviewed');
  await expect(info).toContainText('Wikipedia');
  await expect(info).toContainText('CC BY-SA 3.0');
  await expect(info.getByRole('link', { name: /wikipedia/i }).first()).toHaveAttribute(
    'href',
    /wikipedia\.org/,
  );
});
