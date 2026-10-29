#!/usr/bin/env node
// Renders the images of the static structure pages in the real 3D viewer (Vite dev server + Playwright, GPU):
//   public/thumbs/<slug>.webp     800×800, the figure on the page (structure and group pages)
//   public/thumbs/og/<slug>.jpg   1200×630 social card with the names (og:image); landmark pages get a card
//                                 with their structure's image
//   public/og-image.jpg           the site-wide card (home page, indexes)
//
//   node seo/thumbnails.ts [--force] [--only femur,heart]
//
// Needs the assets (npm run assets:build) and a GPU; all pages take about 20–30 minutes. Existing images are
// kept unless --force. public/thumbs/ is gitignored (reproducible); public/og-image.jpg is committed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { APP_NAME } from '../src/appName.ts';
import type { BBox, Names } from '../src/contract/anatomy.ts';
import type { CameraPose, ViewerCommand, ViewerCommandResult } from '../src/contract/viewerApi.ts';
import {
  buildSite,
  CARD_SIZE,
  cardPath,
  loadSiteData,
  THUMB_SIZE,
  thumbPath,
  type Page,
  type RenderSpec,
} from './model.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const SITE_CARD = join(PUBLIC, 'og-image.jpg');
const GPU_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
/** Matches DEFAULT_FOV in src/viewer/components/CameraRig.tsx. */
const FOV = 35;
/** The viewer's near plane is 1 cm; tiny structures are shot from here at 4× and cropped instead. */
const MIN_DISTANCE = 0.04;

interface CardText {
  kicker: string;
  title: string;
  sub?: string;
  footer: string;
}

/** Store surface used here (window.__atlas, exposed in dev). */
interface Store {
  dataStatus: string;
  viewerReady: boolean;
  layers: Record<string, { visible: boolean; opacity: number }>;
  systemLoad: Record<string, { geometry: string } | undefined>;
  structures: Record<string, { system: string } | undefined>;
  ensureNodeMeta(id: string): Promise<unknown>;
  setIsolate(mode: 'isolate' | 'context', ids: string[]): void;
  exitIsolate(): void;
  setReducedMotion(on: boolean): void;
  applyLayerPreset(layers: Record<string, { visible?: boolean; opacity?: number }>): void;
  resetLayers(): void;
  requestViewer(c: ViewerCommand): Promise<ViewerCommandResult>;
}

interface Helpers {
  /** Transparent PNG of the view. `crop`: render at 4× and cut to the drawn pixels (isolated tiny structures). */
  shoot(spec: { ids: string[]; mode: RenderSpec['mode']; pose: CameraPose; crop?: boolean }): Promise<string>;
  thumb(shot: string): Promise<string>;
  card(shot: string, text: CardText): Promise<string>;
}

declare global {
  interface Window {
    __thumbs?: Helpers;
  }
}

/** Camera straight in front of / behind / beside the box, close enough that the box fills ~85 % of the view. */
export function poseFor(bbox: BBox, view: RenderSpec['view'], zoomOut = 1): CameraPose {
  const c = [0, 1, 2].map((i) => (bbox.min[i]! + bbox.max[i]!) / 2) as [number, number, number];
  const half = [0, 1, 2].map((i) => (bbox.max[i]! - bbox.min[i]!) / 2);
  const axis = view === 'left' || view === 'right' ? 0 : 2;
  const across = Math.max(half[1]!, half[axis === 0 ? 2 : 0]!);
  const fit = half[axis]! + (across * 1.18 * zoomOut) / Math.tan((FOV / 2) * (Math.PI / 180));
  const dist = Math.max(MIN_DISTANCE, fit) * (view === 'posterior' || view === 'right' ? -1 : 1);
  const position: [number, number, number] = [...c];
  position[axis] += dist;
  return { position, target: c, fov: FOV };
}

/** Installed in the page once (serialised by Playwright, so self-contained). */
function installHelpers(cfg: { thumb: number; card: { width: number; height: number }; name: string }) {
  const store = () =>
    (window as unknown as { __atlas: { store: { getState(): Store } } }).__atlas.store.getState();
  const frames = (ms: number) =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, ms))));
  const image = (src: string) =>
    new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  const stage = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    const g = ctx.createRadialGradient(x + w / 2, y + h * 0.45, 0, x + w / 2, y + h / 2, w * 0.75);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#e9ecef');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  };
  const lines = (ctx: CanvasRenderingContext2D, text: string, width: number) => {
    const out: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  };
  const LOGO = new Path2D('M16 12v8M10.5 14.5l5.5 2 5.5-2M12.5 26l3.5-6 3.5 6');

  const helpers: Helpers = {
    async shoot({ ids, mode, pose, crop }) {
      const s = store();
      for (const id of ids) await s.ensureNodeMeta(id);
      s.setIsolate(mode, ids);
      const systems = new Set(ids.map((id) => store().structures[id]?.system).filter(Boolean) as string[]);
      const loaded = () => {
        const st = store();
        const visible = mode === 'context' ? Object.keys(st.layers).filter((k) => st.layers[k]!.visible) : [];
        return [...systems, ...visible].every((k) => st.systemLoad[k]?.geometry === 'loaded');
      };
      for (const t = Date.now(); !loaded();) {
        if (Date.now() - t > 60_000) throw new Error(`geometry not loaded: ${[...systems].join(', ')}`);
        await new Promise((r) => setTimeout(r, 100));
      }
      await store().requestViewer({ type: 'setCameraPose', pose, animate: false });
      await frames(120);
      const shot = await store().requestViewer({
        type: 'screenshot',
        transparentBackground: true,
        scale: crop ? 4 : 1,
      });
      if (!shot.ok || shot.type !== 'screenshot') throw new Error(shot.ok ? 'no screenshot' : shot.error);
      if (!crop) return shot.dataUrl;

      const img = await image(shot.dataUrl);
      const src = document.createElement('canvas');
      src.width = img.width;
      src.height = img.height;
      const sctx = src.getContext('2d', { willReadFrequently: true })!;
      sctx.drawImage(img, 0, 0);
      const { data } = sctx.getImageData(0, 0, src.width, src.height);
      let [x0, y0, x1, y1] = [src.width, src.height, -1, -1];
      for (let y = 0; y < src.height; y++)
        for (let x = 0; x < src.width; x++)
          if (data[(y * src.width + x) * 4 + 3]! > 8) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (x1 < 0) throw new Error('nothing drawn');
      const side = Math.min(src.width, Math.max(x1 - x0, y1 - y0) * 1.35);
      const sx = Math.max(0, Math.min(src.width - side, (x0 + x1 - side) / 2));
      const sy = Math.max(0, Math.min(src.height - side, (y0 + y1 - side) / 2));
      const out = document.createElement('canvas');
      out.width = out.height = cfg.thumb;
      out.getContext('2d')!.drawImage(src, sx, sy, side, side, 0, 0, cfg.thumb, cfg.thumb);
      return out.toDataURL('image/png');
    },

    async thumb(shot) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = cfg.thumb;
      const ctx = canvas.getContext('2d')!;
      stage(ctx, 0, 0, cfg.thumb, cfg.thumb);
      ctx.drawImage(await image(shot), 0, 0, cfg.thumb, cfg.thumb);
      return canvas.toDataURL('image/webp', 0.82);
    },

    async card(shot, text) {
      await document.fonts.load('700 52px "Inter Variable"');
      const { width: W, height: H } = cfg.card;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      stage(ctx, 0, 0, H, H);
      ctx.drawImage(await image(shot), 0, 0, H, H);

      const x = H + 56;
      const w = W - x - 56;
      // logo + name
      ctx.save();
      ctx.translate(x, 56);
      ctx.scale(44 / 32, 44 / 32);
      ctx.fillStyle = '#0f766e';
      ctx.beginPath();
      ctx.roundRect(0, 0, 32, 32, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.arc(16, 8.5, 2.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.stroke(LOGO);
      ctx.restore();
      ctx.fillStyle = '#18181b';
      ctx.textBaseline = 'middle';
      ctx.font = '600 26px "Inter Variable", sans-serif';
      ctx.fillText(cfg.name, x + 58, 79);

      // names, shrunk until they fit
      ctx.textBaseline = 'alphabetic';
      let size1 = 56;
      let title: string[] = [];
      for (; size1 >= 34; size1 -= 4) {
        ctx.font = `700 ${size1}px "Inter Variable", sans-serif`;
        title = lines(ctx, text.title, w);
        if (title.length <= 3) break;
      }
      ctx.font = '400 30px "Inter Variable", sans-serif';
      const sub = text.sub ? lines(ctx, text.sub, w).slice(0, 3) : [];
      const block = 34 + title.length * size1 * 1.12 + (sub.length ? 14 + sub.length * 38 : 0);
      let y = Math.max(170, (H - block) / 2 + 10);
      ctx.fillStyle = '#52525b';
      ctx.font = '600 20px "Inter Variable", sans-serif';
      ctx.fillText(text.kicker.toUpperCase(), x, y);
      y += 34 + size1 * 0.9;
      ctx.fillStyle = '#18181b';
      ctx.font = `700 ${size1}px "Inter Variable", sans-serif`;
      for (const l of title.slice(0, 4)) {
        ctx.fillText(l, x, y);
        y += size1 * 1.12;
      }
      ctx.fillStyle = '#52525b';
      ctx.font = '400 30px "Inter Variable", sans-serif';
      y += 14 - size1 * 0.12;
      for (const l of sub) {
        ctx.fillText(l, x, y);
        y += 38;
      }
      ctx.fillStyle = '#0f766e';
      ctx.font = '600 22px "Inter Variable", sans-serif';
      ctx.fillText(text.footer, x, H - 52);
      return canvas.toDataURL('image/jpeg', 0.86);
    },
  };
  window.__thumbs = helpers;
}

const decode = (dataUrl: string) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
function write(rel: string, dataUrl: string) {
  const file = join(PUBLIC, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, decode(dataUrl));
}

const SYSTEM_LABELS: Record<string, string> = JSON.parse(
  readFileSync(join(PUBLIC, 'models', 'manifest.json'), 'utf8'),
).systems.reduce(
  (acc: Record<string, string>, s: { id: string; names: Names }) => ({ ...acc, [s.id]: s.names.en }),
  {},
);

function cardText(page: Page, kicker?: string): CardText {
  const sub = page.names.la && page.names.la !== page.names.en ? page.names.la : undefined;
  return {
    kicker: kicker ?? SYSTEM_LABELS[page.system] ?? page.system,
    title: page.names.en,
    ...(sub ? { sub } : {}),
    footer: 'Interactive 3D anatomy',
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const onlyArg = argv[argv.indexOf('--only') + 1];
  const only = argv.includes('--only') && onlyArg ? new Set(onlyArg.split(',')) : null;

  const data = loadSiteData(join(PUBLIC, 'models'));
  if (!data) throw new Error('public/models/manifest.json not found. Run `npm run assets:build` first.');
  const site = buildSite(data);
  const wanted = (p: Page) => !only || only.has(p.slug);
  const done = (slug: string) =>
    existsSync(join(PUBLIC, thumbPath(slug))) && existsSync(join(PUBLIC, cardPath(slug)));
  const todo = site.pages.filter((p) => p.render && wanted(p) && (force || !done(p.slug)));
  const landmarks = site.pages.filter(
    (p) =>
      p.type === 'landmark' &&
      p.thumbSlug &&
      wanted(p) &&
      (force || !existsSync(join(PUBLIC, cardPath(p.slug)))),
  );

  // no watcher / HMR: an edit elsewhere in the repo must not reload the page halfway through
  const server = await createServer({
    root: ROOT,
    logLevel: 'error',
    server: { port: 5190, watch: null, hmr: false },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0] ?? 'http://localhost:5190/';
  const browser = await chromium.launch({ args: GPU_ARGS });
  try {
    const page = await browser.newPage({
      viewport: { width: THUMB_SIZE, height: THUMB_SIZE },
      deviceScaleFactor: 1,
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('oaa.prefs.v1', JSON.stringify({ hintSeen: true, uiLang: 'en' }));
      } catch {
        // ignore
      }
    });
    await page.goto(`${url}?testHooks=1`);
    await page.waitForFunction(
      () => {
        const s = (
          window as unknown as { __atlas?: { store: { getState(): Store } } }
        ).__atlas?.store.getState();
        return s?.dataStatus === 'loaded' && s.viewerReady;
      },
      null,
      { timeout: 120_000 },
    );
    await page.evaluate(installHelpers, { thumb: THUMB_SIZE, card: CARD_SIZE, name: APP_NAME });
    await page.evaluate(() => {
      (window as unknown as { __atlas: { store: { getState(): Store } } }).__atlas.store
        .getState()
        .setReducedMotion(true);
    });

    console.log(
      `[thumbs] ${todo.length} structure/group images, ${landmarks.length} landmark cards (${url})`,
    );
    const t0 = Date.now();
    const failed: string[] = [];
    for (const [i, p] of todo.entries()) {
      const r = p.render!;
      try {
        const shot = await page.evaluate((a) => window.__thumbs!.shoot(a), {
          ids: r.ids,
          mode: r.mode,
          pose: poseFor(r.bbox, r.view, r.zoomOut),
          crop: r.mode === 'isolate',
        });
        write(thumbPath(p.slug), await page.evaluate((s) => window.__thumbs!.thumb(s), shot));
        const kicker = p.type === 'group' ? `${SYSTEM_LABELS[p.system]} · group` : undefined;
        write(
          cardPath(p.slug),
          await page.evaluate(([s, t]) => window.__thumbs!.card(s, t), [shot, cardText(p, kicker)] as const),
        );
      } catch (e) {
        failed.push(p.slug);
        console.warn(`[thumbs] ${p.slug}: ${(e as Error).message}`);
      }
      if ((i + 1) % 50 === 0 || i === todo.length - 1) {
        const per = (Date.now() - t0) / (i + 1);
        console.log(
          `[thumbs] ${i + 1}/${todo.length} · ${Math.round(((todo.length - i - 1) * per) / 60000)} min left`,
        );
      }
    }

    for (const p of landmarks) {
      const owner = site.bySlug.get(p.thumbSlug!)!;
      const file = join(PUBLIC, thumbPath(owner.slug));
      if (!existsSync(file)) continue;
      const shot = `data:image/webp;base64,${readFileSync(file).toString('base64')}`;
      const text = cardText(p, `Landmark · ${owner.names.en}`);
      try {
        write(
          cardPath(p.slug),
          await page.evaluate(([s, t]) => window.__thumbs!.card(s, t), [shot, text] as const),
        );
      } catch (e) {
        failed.push(p.slug);
        console.warn(`[thumbs] ${p.slug}: ${(e as Error).message}`);
      }
    }

    if (!only || force || !existsSync(SITE_CARD)) {
      // site card: skeleton and muscles, head to pelvis
      const b = data.manifest.bodyBounds;
      const box: BBox = { min: [b.min[0], b.max[1] * 0.52, b.min[2]], max: [b.max[0], b.max[1], b.max[2]] };
      const shot = await page.evaluate(
        async ([pose]) => {
          const s = (
            window as unknown as { __atlas: { store: { getState(): Store } } }
          ).__atlas.store.getState();
          s.exitIsolate();
          s.applyLayerPreset({ skeletal: { visible: true }, muscular: { visible: true, opacity: 1 } });
          return window.__thumbs!.shoot({ ids: [], mode: 'context', pose });
        },
        [poseFor(box, 'anterior')] as const,
      );
      const card = await page.evaluate(([s, t]) => window.__thumbs!.card(s, t), [
        shot,
        {
          kicker: 'Free · open source',
          title: 'Free interactive 3D anatomy atlas',
          sub: 'Bones, muscles, organs, vessels and nerves with Latin and English names',
          footer: 'No sign-up · runs in the browser',
        },
      ] as const);
      writeFileSync(SITE_CARD, decode(card));
    }

    console.log(
      `[thumbs] done in ${Math.round((Date.now() - t0) / 1000)} s${failed.length ? `, ${failed.length} failed: ${failed.join(', ')}` : ''}`,
    );
    if (failed.length) process.exitCode = 1;
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
