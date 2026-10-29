/**
 * Agent D (independent QA) — performance against PROMPT.md §9, on the REAL GPU (not SwiftShader).
 *
 * Opt-in: QA_PERF=1 PW_PORT=4184 npx playwright test tests/e2e/qa-perf.spec.ts --project=desktop
 * Run it against a production build (the Playwright web server builds one into .e2e/<port>).
 * Measured over localhost: network time is NOT included unless the throttled run is used.
 *
 * Independent instrumentation (does not trust the app's own stats):
 *  - every WebGL draw call (incl. WEBGL_multi_draw) is counted; frames = rAF intervals that contained draws
 *  - Resource Timing transferSize for bytes
 *  - the app's viewerStats (renderer.info) are read as a second opinion
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { st } from './qa-helpers';

const GPU_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
test.use({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  launchOptions: { args: GPU_ARGS },
});
test.describe.configure({ timeout: 600_000, mode: 'serial' });
test.skip(() => !process.env.QA_PERF, 'set QA_PERF=1 to run the performance measurements');
test.skip(({ isMobile }) => isMobile, 'desktop GPU measurements');

const OUT = path.join('tests', 'e2e', 'qa-screenshots', 'perf-results.json');
const results: Record<string, unknown> = {};

const INSTRUMENT = () => {
  const qa = {
    firstDraw: null as number | null,
    draws: 0,
    frameDraws: 0,
    frames: [] as [number, number][],
    marks: {} as Record<string, number>,
    longTasks: [] as number[],
  };
  (window as unknown as { __qa: typeof qa }).__qa = qa;
  const count = () => {
    qa.draws++;
    qa.frameDraws++;
    if (qa.firstDraw === null) qa.firstDraw = performance.now();
  };
  const wrap = (obj: Record<string, unknown>, name: string) => {
    const orig = obj[name] as ((...a: unknown[]) => unknown) | undefined;
    if (typeof orig !== 'function') return;
    obj[name] = function (this: unknown, ...a: unknown[]) {
      count();
      return orig.apply(this, a);
    };
  };
  for (const P of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype])
    for (const n of [
      'drawElements',
      'drawArrays',
      'drawElementsInstanced',
      'drawArraysInstanced',
      'drawRangeElements',
    ])
      wrap(P as unknown as Record<string, unknown>, n);
  for (const P of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    const ge = P.getExtension;
    (P as unknown as { getExtension: (n: string) => unknown }).getExtension = function (
      this: WebGL2RenderingContext,
      name: string,
    ) {
      const ext = (ge as (this: unknown, n: string) => unknown).call(this, name) as Record<
        string,
        unknown
      > | null;
      if (ext && /multi_draw/i.test(name) && !ext.__qa) {
        ext.__qa = true;
        for (const n of Object.keys(Object.getPrototypeOf(ext)).concat(Object.keys(ext)))
          if (/^multiDraw/.test(n)) wrap(ext, n);
      }
      return ext;
    };
  }
  const mark = (k: string) => {
    if (qa.marks[k] === undefined) qa.marks[k] = performance.now();
  };
  const loop = (t: number) => {
    const drew = qa.frameDraws;
    if (drew > 0) qa.frames.push([t, drew]);
    qa.frameDraws = 0;
    const atlas = (window as unknown as { __atlas?: { store: { getState(): Record<string, unknown> } } })
      .__atlas;
    const s = atlas?.store.getState() as
      | {
          dataStatus: string;
          viewerReady: boolean;
          layers: Record<string, { visible: boolean }>;
          systemLoad: Record<string, { geometry: string }>;
        }
      | undefined;
    if (document.querySelector('[role="combobox"]')) mark('uiShell');
    if (s) {
      if (s.dataStatus === 'loaded') mark('dataLoaded');
      if (s.viewerReady) mark('viewerReady');
      if (s.dataStatus === 'loaded' && s.viewerReady && document.querySelector('[role="combobox"]'))
        mark('interactive');
      if (s.systemLoad?.skeletal?.geometry === 'loaded') {
        mark('skeletalLoaded');
        if (drew > 0 && qa.marks.skeletalLoaded! < t) mark('skeletonVisible');
      }
      const vis = Object.entries(s.layers ?? {}).filter(([, l]) => l.visible);
      if (vis.length && vis.every(([id]) => s.systemLoad?.[id]?.geometry === 'loaded')) {
        mark('defaultLoaded');
        if (drew > 0 && qa.marks.defaultLoaded! < t) mark('defaultVisible');
      }
    }
    if (qa.firstDraw !== null) mark('firstDraw');
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) qa.longTasks.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    // ignore
  }
};

type Marks = Record<string, number>;
interface Res {
  name: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  responseEnd: number;
}

async function coldLoad(page: Page, throttle?: { latency: number; mbps: number }) {
  await page.addInitScript(INSTRUMENT);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('oaa.prefs.v1', JSON.stringify({ hintSeen: true, uiLang: 'en' }));
    } catch {
      // ignore
    }
  });
  if (throttle) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: throttle.latency,
      downloadThroughput: (throttle.mbps * 1e6) / 8,
      uploadThroughput: (10 * 1e6) / 8,
    });
  }
  await page.goto('/?testHooks=1');
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __qa: { marks: Marks } }).__qa.marks.defaultLoaded ?? null,
        ),
      {
        timeout: 120_000,
      },
    )
    .not.toBeNull();
  await page.waitForTimeout(1500);
  return page.evaluate(() => {
    const qa = (
      window as unknown as {
        __qa: { marks: Marks; longTasks: number[]; firstDraw: number; frames: [number, number][] };
      }
    ).__qa;
    // "Visible" = first rAF interval with draw calls that ends after the geometry was reported loaded
    // (draws are attributed to the following rAF callback, so allow one frame of slack).
    const after = (t: number | undefined) => {
      if (t === undefined) return undefined;
      const f = qa.frames.find(([ft]) => ft >= t - 17);
      return f ? f[0] : undefined;
    };
    const sv = after(qa.marks.skeletalLoaded);
    const dv = after(qa.marks.defaultLoaded);
    if (sv !== undefined) qa.marks.skeletonVisible = sv;
    if (dv !== undefined) qa.marks.defaultVisible = dv;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const res = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map((r) => ({
      name: new URL(r.name).pathname,
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
      decodedBodySize: r.decodedBodySize,
      responseEnd: r.responseEnd,
    }));
    return {
      marks: qa.marks,
      longTasks: qa.longTasks,
      nav: {
        transferSize: nav.transferSize,
        responseEnd: nav.responseEnd,
        domContentLoaded: nav.domContentLoadedEventEnd,
      },
      res,
    };
  });
}

const sumUntil = (res: Res[], navBytes: number, t: number) =>
  navBytes + res.filter((r) => r.responseEnd <= t).reduce((a, r) => a + r.transferSize, 0);

async function gpuName(page: Page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')!;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });
}

/** Drag-orbit for `ms` and count rendered frames + draw calls per frame. */
async function orbit(page: Page, ms = 6000) {
  const box = (await page.locator('[data-testid="viewer"] canvas').boundingBox())!;
  const x0 = Math.round(box.x + box.width * 0.62);
  const y0 = Math.round(box.y + box.height * 0.5);
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.tagName, [x0, y0])).toBe(
    'CANVAS',
  );
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const t0 = await page.evaluate(() => performance.now());
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < ms) {
    i++;
    await page.mouse.move(x0 + Math.round(180 * Math.sin(i / 25)), y0 + Math.round(40 * Math.sin(i / 40)));
    await page.waitForTimeout(8);
  }
  const t1 = await page.evaluate(() => performance.now());
  await page.mouse.up();
  await page.waitForTimeout(700);
  return page.evaluate(
    ([a, b]) => {
      const qa = (window as unknown as { __qa: { frames: [number, number][] } }).__qa;
      const f = qa.frames.filter(([t]) => t >= a! && t <= b!);
      const dts = f.slice(1).map(([t], k) => t - f[k]![0]);
      const sorted = [...dts].sort((p, q) => p - q);
      const draws = f.map(([, d]) => d).sort((p, q) => p - q);
      const s = (
        window as unknown as { __atlas: { store: { getState(): { viewerStats: unknown } } } }
      ).__atlas.store.getState();
      return {
        seconds: (b! - a!) / 1000,
        frames: f.length,
        fps: f.length / ((b! - a!) / 1000),
        p95FrameMs: sorted.length ? sorted[Math.floor(sorted.length * 0.95)]! : null,
        worstFrameMs: sorted.length ? sorted[sorted.length - 1]! : null,
        drawsPerFrameMedian: draws.length ? draws[Math.floor(draws.length / 2)]! : null,
        viewerStats: s.viewerStats,
      };
    },
    [t0, t1],
  );
}

async function allLoaded(page: Page) {
  await expect
    .poll(
      () =>
        st(
          page,
          `Object.entries(s.layers).every(([id, l]) => !l.visible || (s.systemLoad[id] && s.systemLoad[id].geometry === 'loaded'))`,
        ),
      { timeout: 300_000 },
    )
    .toBe(true);
}

test.afterAll(() => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
});

test('PERF-1 cold start over localhost (3 runs): first render, skeleton visible, bytes', async ({
  browser,
}) => {
  type Run = {
    firstDrawMs: number;
    interactiveMs: number;
    skeletonVisibleMs: number;
    defaultVisibleMs: number;
    bytesUntilSkeleton: number;
    bytesUntilDefaultView: number;
    longTasksOver50: number;
    longestTaskMs: number;
    files: string[] | undefined;
  };
  const runs: Run[] = [];
  for (let k = 0; k < 3; k++) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    if (k === 0) results.gpu = await gpuName(page);
    const r = await coldLoad(page);
    const m = r.marks;
    runs.push({
      firstDrawMs: Math.round(m.firstDraw!),
      interactiveMs: Math.round(m.interactive!),
      skeletonVisibleMs: Math.round(m.skeletonVisible!),
      defaultVisibleMs: Math.round(m.defaultVisible!),
      bytesUntilSkeleton: sumUntil(r.res, r.nav.transferSize, m.skeletonVisible!),
      bytesUntilDefaultView: sumUntil(r.res, r.nav.transferSize, m.defaultVisible!),
      longTasksOver50: r.longTasks.length,
      longestTaskMs: Math.max(0, ...r.longTasks),
      files:
        k === 0
          ? r.res.filter((x) => x.responseEnd <= m.defaultVisible!).map((x) => `${x.name} ${x.transferSize}`)
          : undefined,
    });
    await ctx.close();
  }
  results.coldStartLocalhost = runs;
  console.log(JSON.stringify(runs, null, 1));
  const med = (k: 'skeletonVisibleMs' | 'interactiveMs' | 'bytesUntilSkeleton') =>
    runs.map((r) => r[k]).sort((a, b) => a - b)[1]!;
  expect.soft(med('interactiveMs'), 'first interactive view ≤ 3 s (localhost)').toBeLessThanOrEqual(3000);
  expect.soft(med('skeletonVisibleMs'), 'skeleton visible ≤ 4 s (localhost)').toBeLessThanOrEqual(4000);
  expect.soft(med('bytesUntilSkeleton'), 'startup download ≤ 5 MB').toBeLessThanOrEqual(5_000_000);
});

test('PERF-2 cold start with an emulated 25 Mbit/s, 40 ms RTT connection', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const r = await coldLoad(page, { latency: 40, mbps: 25 });
  const m = r.marks;
  results.coldStart25Mbit = {
    firstDrawMs: Math.round(m.firstDraw!),
    interactiveMs: Math.round(m.interactive!),
    skeletonVisibleMs: Math.round(m.skeletonVisible!),
    defaultVisibleMs: Math.round(m.defaultVisible!),
    bytesUntilSkeleton: sumUntil(r.res, r.nav.transferSize, m.skeletonVisible!),
  };
  console.log(JSON.stringify(results.coldStart25Mbit));
  await ctx.close();
});

test('PERF-3 orbit fps + draw calls: default layers, all 9 systems, all systems + X-ray; memory on toggling', async ({
  page,
}) => {
  await page.addInitScript(INSTRUMENT);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('oaa.prefs.v1', JSON.stringify({ hintSeen: true, uiLang: 'en' }));
    } catch {
      // ignore
    }
  });
  await page.goto('/?testHooks=1');
  await expect.poll(() => st(page, 's.viewerReady'), { timeout: 60_000 }).toBe(true);
  await allLoaded(page);
  await page.waitForTimeout(3000);
  const def = await orbit(page);
  results.orbitDefault = def;

  const ids = await st<string[]>(page, 's.manifest.systems.map((x) => x.id)');
  const t0 = Date.now();
  for (const id of ids) await st(page, 's.setLayerVisible(a, true)', id);
  await allLoaded(page);
  results.loadAllSystemsMs = Date.now() - t0;
  await page.waitForTimeout(8000); // let idle BVH builds finish
  const all = await orbit(page);
  results.orbitAllSystems = all;
  await st(page, 's.setXray(true)');
  await page.waitForTimeout(1500);
  const xr = await orbit(page);
  results.orbitAllSystemsXray = xr;
  await st(page, 's.setXray(false)');

  // Memory: toggling a system repeatedly must not grow renderer.info.memory.geometries
  const geo = async () => {
    await st(page, `s.requestViewer({ type: 'zoom', factor: 1 })`);
    await page.waitForTimeout(900);
    return st<{ geometries: number; textures: number }>(page, 's.viewerStats');
  };
  const g0 = await geo();
  const heap0 = await page.evaluate(
    () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0,
  );
  for (let k = 0; k < 6; k++) {
    await st(page, 's.setLayerVisible("muscular", false)');
    await page.waitForTimeout(150);
    await st(page, 's.setLayerVisible("muscular", true)');
    await page.waitForTimeout(150);
  }
  const g1 = await geo();
  const heap1 = await page.evaluate(
    () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0,
  );
  results.memory = { before: g0, after: g1, heapBeforeMB: heap0 / 1e6, heapAfterMB: heap1 / 1e6 };
  console.log(JSON.stringify({ def, all, xr, memory: results.memory }, null, 1));

  expect.soft(all.fps, 'orbit with all systems ≥ 50 fps').toBeGreaterThanOrEqual(50);
  expect.soft(def.drawsPerFrameMedian ?? 99, 'draw calls in the default view ≤ 30').toBeLessThanOrEqual(30);
  expect.soft(g1.geometries, 'no geometry growth on toggling').toBe(g0.geometries);
});

test('PERF-4 indicative phone run: 390×844 @ DPR 2.625, 4× CPU throttle, default layers (laptop GPU!)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2.625,
    isMobile: false,
    hasTouch: false,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const r = await coldLoad(page);
  await page.waitForTimeout(3000);
  // Orbit on the phone layout: drag in the free area above the bottom bar.
  const box = (await page.locator('[data-testid="viewer"] canvas').boundingBox())!;
  const x0 = Math.round(box.x + box.width * 0.5);
  const y0 = Math.round(box.y + box.height * 0.55);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const t0 = await page.evaluate(() => performance.now());
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < 6000) {
    i++;
    await page.mouse.move(x0 + Math.round(120 * Math.sin(i / 25)), y0);
    await page.waitForTimeout(8);
  }
  const t1 = await page.evaluate(() => performance.now());
  await page.mouse.up();
  const fps = await page.evaluate(
    ([a, b]) => {
      const qa = (window as unknown as { __qa: { frames: [number, number][] } }).__qa;
      const f = qa.frames.filter(([t]) => t >= a! && t <= b!);
      return { frames: f.length, fps: f.length / ((b! - a!) / 1000) };
    },
    [t0, t1],
  );
  const dpr = await st(page, 's.viewerStats');
  results.phoneIndicative = {
    interactiveMs: Math.round(r.marks.interactive!),
    skeletonVisibleMs: Math.round(r.marks.skeletonVisible!),
    orbit: fps,
    viewerStats: dpr,
  };
  console.log(JSON.stringify(results.phoneIndicative));
  await ctx.close();
});
