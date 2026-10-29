/**
 * Agent D (independent QA) — anatomy sanity on the REAL data (desktop only; the data is the same on phone).
 *
 * For 28 well-known structures it checks, independently of the pipeline's own validator:
 *  1. metadata as loaded by the app (system, side, Latin/English name)
 *  2. the position of the ACTUAL decoded geometry (vertex centroid of the GLB node via the app's data source)
 *     against textbook relations (left/right, above/below, anterior/posterior)
 *  3. what the user sees: the structure isolated in the anterior view must appear on the correct screen half
 *     (patient's left = screen right), and mirrored in the posterior view
 *  4. the info panel shows the right name, side and system
 * Orientation convention: +X = patient's left, +Y = up, +Z = anterior.
 */
import { expect, test, type Page } from '@playwright/test';
import { boot, canvasShot, saveDataUrl, settle, shot, st, waitGeometry } from './qa-helpers';

test.describe.configure({ timeout: 600_000 });
if (process.env.QA_GPU)
  test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
test.skip(({ isMobile }) => isMobile, 'data checks run once (desktop)');

type V = [number, number, number];
interface Geo {
  id: string;
  system: string;
  side: string | null;
  la: string | null;
  en: string;
  centroid: V; // vertex centroid of the decoded GLB geometry
  meta: V; // Structure.centroid from structures/<system>.json
  min: V;
  max: V;
  nc: boolean;
}

/** Expected facts. `side` undefined = must have no side. */
const SPOT: { id: string; system: string; side?: 'left' | 'right'; la?: string; en: string }[] = [
  { id: 'femur-l', system: 'skeletal', side: 'left', la: 'Os femoris', en: 'Femur' },
  { id: 'femur-r', system: 'skeletal', side: 'right', la: 'Os femoris', en: 'Femur' },
  { id: 'humerus-l', system: 'skeletal', side: 'left', la: 'Humerus', en: 'Humerus' },
  { id: 'humerus-r', system: 'skeletal', side: 'right', la: 'Humerus', en: 'Humerus' },
  { id: 'patella-l', system: 'skeletal', side: 'left', la: 'Patella', en: 'Patella' },
  { id: 'calcaneus-r', system: 'skeletal', side: 'right', la: 'Calcaneus', en: 'Calcaneus' },
  { id: 'frontal-bone', system: 'skeletal', la: 'Os frontale', en: 'Frontal bone' },
  { id: 'occipital-bone', system: 'skeletal', la: 'Os occipitale', en: 'Occipital bone' },
  { id: 'liver', system: 'visceral', la: 'Hepar', en: 'Liver' },
  { id: 'gallbladder', system: 'visceral', la: 'Vesica biliaris', en: 'Gallbladder' },
  { id: 'stomach', system: 'visceral', la: 'Gaster', en: 'Stomach' },
  { id: 'spleen', system: 'lymphoid', la: 'Lien', en: 'Spleen' },
  { id: 'pancreas', system: 'visceral', la: 'Pancreas', en: 'Pancreas' },
  { id: 'vermiform-appendix', system: 'visceral', la: 'Appendix vermiformis', en: 'Vermiform appendix' },
  { id: 'ascending-colon', system: 'visceral', la: 'Colon ascendens', en: 'Ascending colon' },
  { id: 'descending-colon', system: 'visceral', la: 'Colon descendens', en: 'Descending colon' },
  { id: 'kidney-l', system: 'visceral', side: 'left', la: 'Ren', en: 'Kidney' },
  { id: 'kidney-r', system: 'visceral', side: 'right', la: 'Ren', en: 'Kidney' },
  {
    id: 'middle-lobe-of-right-lung',
    system: 'visceral',
    side: 'right',
    la: 'Lobus medius pulmonis dextri',
    en: 'Middle lobe of right lung',
  },
  {
    id: 'superior-lobe-of-left-lung',
    system: 'visceral',
    side: 'left',
    la: 'Lobus superior pulmonis sinistri',
    en: 'Superior lobe of left lung',
  },
  { id: 'trachea', system: 'visceral', la: 'Trachea', en: 'Trachea' },
  { id: 'oesophagus', system: 'visceral', la: 'Oesophagus', en: 'Oesophagus' },
  {
    id: 'left-ventricle',
    system: 'cardiovascular',
    side: 'left',
    la: 'Ventriculus sinister',
    en: 'Left ventricle',
  },
  { id: 'right-atrium', system: 'cardiovascular', side: 'right', la: 'Atrium dextrum', en: 'Right atrium' },
  { id: 'aortic-arch', system: 'cardiovascular', la: 'Arcus aortae', en: 'Aortic arch' },
  { id: 'superior-vena-cava', system: 'cardiovascular', la: 'Vena cava superior', en: 'Superior vena cava' },
  {
    id: 'long-head-of-biceps-brachii-l',
    system: 'muscular',
    side: 'left',
    la: 'Caput longum musculi bicipitis brachii',
    en: 'Long head of biceps brachii',
  },
  {
    id: 'gluteus-maximus-muscle-r',
    system: 'muscular',
    side: 'right',
    la: 'Musculus gluteus maximus',
    en: 'Gluteus maximus muscle',
  },
  {
    id: 'rectus-abdominis-muscle-l',
    system: 'muscular',
    side: 'left',
    la: 'Musculus rectus abdominis',
    en: 'Rectus abdominis muscle',
  },
  { id: 'sciatic-nerve-l', system: 'nervous', side: 'left', la: 'Nervus ischiadicus', en: 'Sciatic nerve' },
  { id: 'cochlea-r', system: 'nervous', side: 'right', la: 'Cochlea', en: 'Cochlea' },
];

const SYSTEMS = ['skeletal', 'visceral', 'cardiovascular', 'lymphoid', 'muscular', 'nervous'];

/** Decode the systems' GLB chunks through the app's own data source and measure the requested nodes. */
async function measure(page: Page, ids: string[]): Promise<Record<string, Geo>> {
  return page.evaluate(
    async ([wanted, systems]) => {
      type Attr = {
        count: number;
        getX(i: number): number;
        getY(i: number): number;
        getZ(i: number): number;
      };
      const hook = window.__atlas! as unknown as {
        store: { getState(): Record<string, unknown> };
        dataSource: {
          loadChunk(
            sys: unknown,
            chunk: unknown,
          ): Promise<{
            nodes: { nodeName: string; geometry: { attributes: { position: Attr }; dispose(): void } }[];
          }>;
        };
      };
      const s = hook.store.getState() as unknown as {
        manifest: { systems: { id: string; chunks: unknown[] }[] };
        structures: Record<
          string,
          {
            system: string;
            side?: string;
            names: { la?: string; en: string };
            centroid: number[];
            nonCommercial?: boolean;
          }
        >;
      };
      const want = new Set(wanted);
      const out: Record<string, unknown> = {};
      for (const sys of s.manifest.systems.filter((x) => systems.includes(x.id))) {
        for (const chunk of sys.chunks) {
          const res = await hook.dataSource.loadChunk(sys, chunk);
          for (const n of res.nodes) {
            if (want.has(n.nodeName)) {
              const p = n.geometry.attributes.position;
              let x = 0,
                y = 0,
                z = 0;
              const min = [Infinity, Infinity, Infinity];
              const max = [-Infinity, -Infinity, -Infinity];
              for (let i = 0; i < p.count; i++) {
                const v = [p.getX(i), p.getY(i), p.getZ(i)];
                x += v[0]!;
                y += v[1]!;
                z += v[2]!;
                for (let k = 0; k < 3; k++) {
                  min[k] = Math.min(min[k]!, v[k]!);
                  max[k] = Math.max(max[k]!, v[k]!);
                }
              }
              const st = s.structures[n.nodeName]!;
              out[n.nodeName] = {
                id: n.nodeName,
                system: st.system,
                side: st.side ?? null,
                la: st.names.la ?? null,
                en: st.names.en,
                centroid: [x / p.count, y / p.count, z / p.count],
                meta: st.centroid,
                min,
                max,
                nc: Boolean(st.nonCommercial),
              };
            }
            n.geometry.dispose();
          }
        }
      }
      return out;
    },
    [ids, SYSTEMS] as const,
  ) as Promise<Record<string, Geo>>;
}

test('QA-11 anatomy spot check: metadata, decoded geometry and on-screen side of 31 structures', async ({
  page,
}, testInfo) => {
  await boot(page);
  for (const id of SYSTEMS) await st(page, 's.ensureSystemMeta(a)', id);
  const g = await measure(
    page,
    SPOT.map((x) => x.id),
  );
  const report: string[] = [];
  const fmt = (v: V) => v.map((n) => n.toFixed(3)).join(', ');

  // 1. metadata + geometry exists
  for (const e of SPOT) {
    const m = g[e.id];
    expect.soft(m, `${e.id} exists with geometry`).toBeTruthy();
    if (!m) continue;
    report.push(
      `${e.id.padEnd(30)} ${m.system.padEnd(14)} ${String(m.side ?? '-').padEnd(5)} la="${m.la}" en="${m.en}" centroid(${fmt(m.centroid)})`,
    );
    expect.soft(m.system, `${e.id} system`).toBe(e.system);
    expect.soft(m.side, `${e.id} side`).toBe(e.side ?? null);
    expect.soft(m.en, `${e.id} English name`).toBe(e.en);
    if (e.la) expect.soft(m.la, `${e.id} Latin name`).toBe(e.la);
    // metadata centroid agrees with the decoded geometry (≤ 5 mm)
    const dm = Math.max(...m.centroid.map((v, i) => Math.abs(v - m.meta[i]!)));
    expect.soft(dm, `${e.id} metadata centroid vs geometry`).toBeLessThan(0.005);
    // the side, if any, matches the geometry (patient's left = +X)
    if (e.side === 'left')
      expect.soft(m.centroid[0], `${e.id} lies on the patient's left (x > 0)`).toBeGreaterThan(0);
    if (e.side === 'right')
      expect.soft(m.centroid[0], `${e.id} lies on the patient's right (x < 0)`).toBeLessThan(0);
  }
  const c = (id: string) => g[id]!.centroid;
  const rel = (label: string, ok: boolean) => {
    report.push(`${ok ? 'OK  ' : 'FAIL'} ${label}`);
    expect.soft(ok, label).toBe(true);
  };
  // 2. textbook relations on the decoded geometry
  rel("liver on the patient's right (x < 0)", c('liver')[0] < 0);
  rel(
    'liver: most of its volume right of the midline (bbox max x < |bbox min x|)',
    g.liver!.max[0] < -g.liver!.min[0],
  );
  rel('gallbladder on the right (x < 0)', c('gallbladder')[0] < 0);
  rel('stomach on the left (x > 0)', c('stomach')[0] > 0);
  rel('spleen on the left (x > 0) and lateral to the stomach', c('spleen')[0] > c('stomach')[0]);
  rel('spleen posterior to the stomach', c('spleen')[2] < c('stomach')[2]);
  rel(
    'pancreas crosses the midline (head right, tail left)',
    g.pancreas!.min[0] < 0 && g.pancreas!.max[0] > 0,
  );
  rel('pancreatic tail reaches toward the spleen (max x > 0.05)', g.pancreas!.max[0] > 0.05);
  rel(
    'appendix in the right lower quadrant (x < 0, below the liver)',
    c('vermiform-appendix')[0] < 0 && c('vermiform-appendix')[1] < c('liver')[1],
  );
  rel(
    'ascending colon right, descending colon left',
    c('ascending-colon')[0] < 0 && c('descending-colon')[0] > 0,
  );
  rel('kidneys: left at x > 0, right at x < 0', c('kidney-l')[0] > 0 && c('kidney-r')[0] < 0);
  rel('right kidney lower than the left kidney', c('kidney-r')[1] < c('kidney-l')[1]);
  rel(
    'kidneys posterior to the liver and stomach',
    c('kidney-l')[2] < c('stomach')[2] && c('kidney-r')[2] < c('liver')[2],
  );
  rel('femur pair mirrors (|x_l + x_r| < 5 mm)', Math.abs(c('femur-l')[0] + c('femur-r')[0]) < 0.005);
  rel('humerus pair mirrors', Math.abs(c('humerus-l')[0] + c('humerus-r')[0]) < 0.005);
  rel("femur-l at x > 0 (patient's left)", c('femur-l')[0] > 0.05);
  rel('patella anterior to the femur', c('patella-l')[2] > c('femur-l')[2]);
  rel('calcaneus at the bottom (min y < 0.03)', g['calcaneus-r']!.min[1] < 0.03);
  rel(
    'frontal bone above the femur and anterior to the occipital bone',
    c('frontal-bone')[1] > 1.5 && c('frontal-bone')[2] > c('occipital-bone')[2],
  );
  rel('left ventricle left of the right atrium', c('left-ventricle')[0] > c('right-atrium')[0]);
  rel(
    'left ventricle at x > 0, right atrium at x < 0',
    c('left-ventricle')[0] > 0 && c('right-atrium')[0] < 0,
  );
  rel(
    'aortic arch above the left ventricle and arches to the left (x ≥ 0)',
    c('aortic-arch')[1] > c('left-ventricle')[1] && c('aortic-arch')[0] >= 0,
  );
  rel('superior vena cava right of the midline', c('superior-vena-cava')[0] < 0);
  rel('right lung has a middle lobe on the right', c('middle-lobe-of-right-lung')[0] < 0);
  rel('oesophagus posterior to the trachea', c('oesophagus')[2] < c('trachea')[2]);
  rel(
    'biceps (long head) anterior to the humerus',
    c('long-head-of-biceps-brachii-l')[2] > c('humerus-l')[2],
  );
  rel('gluteus maximus posterior (z < femur z)', c('gluteus-maximus-muscle-r')[2] < c('femur-r')[2]);
  rel('rectus abdominis anterior (z > liver z)', c('rectus-abdominis-muscle-l')[2] > c('liver')[2]);
  rel('sciatic nerve posterior to the femur', c('sciatic-nerve-l')[2] < c('femur-l')[2]);
  rel('cochlea-r is flagged non-commercial', g['cochlea-r']!.nc);
  rel('kidney-l is flagged non-commercial', g['kidney-l']!.nc);

  // Heart: union of the g-heart group's structures (the heart has no single mesh).
  const heart = await st<{ n: number; cx: number; apex: V | null }>(
    page,
    `(() => {
      const ids = []; const walk = (id) => { for (const k of s.childrenOf[id] ?? []) { if (s.structures[k]) ids.push(k); walk(k); } };
      walk('g-heart');
      let x = 0; for (const id of ids) x += s.structures[id].centroid[0];
      // apex ≈ lowest point of the left ventricle bbox
      const lv = s.structures['left-ventricle'];
      return { n: ids.length, cx: ids.length ? x / ids.length : 0, apex: lv ? [ (lv.bbox.min[0] + lv.bbox.max[0]) / 2, lv.bbox.min[1], lv.bbox.max[2] ] : null };
    })()`,
  );
  report.push(`heart group: ${heart.n} parts, mean centroid x = ${heart.cx.toFixed(3)}`);
  rel('heart (g-heart parts) lies mostly left of the midline (mean x > 0)', heart.n > 0 && heart.cx > 0);

  testInfo.annotations.push({ type: 'anatomy', description: report.join('\n') });
  console.log(report.join('\n'));

  // 3. what the user sees: isolate → anterior view → mean x of the drawn pixels
  for (const id of SYSTEMS) await st(page, 's.setLayerVisible(a, true)', id);
  await waitGeometry(page, 300_000);
  const onScreen: string[] = [];
  const screenSide = async (ids: string[], view: 'anterior' | 'posterior') => {
    await st(page, 's.setIsolate("isolate", a)', ids);
    await st(page, `s.requestViewer({ type: 'resetCamera', animate: false })`);
    await st(page, `s.requestViewer({ type: 'setView', view: a, animate: false })`, view);
    await settle(page, 600);
    const shotRes = await canvasShot(page);
    const target = await st<number[]>(page, 's.camera.target');
    return { cx: shotRes.cx, coverage: shotRes.coverage, tx: target[0]!, dataUrl: shotRes.dataUrl };
  };
  const leftOfPatient = [
    'femur-l',
    'humerus-l',
    'kidney-l',
    'stomach',
    'spleen',
    'descending-colon',
    'left-ventricle',
    'sciatic-nerve-l',
    'superior-lobe-of-left-lung',
  ];
  const rightOfPatient = [
    'femur-r',
    'humerus-r',
    'kidney-r',
    'liver',
    'gallbladder',
    'vermiform-appendix',
    'ascending-colon',
    'right-atrium',
    'superior-vena-cava',
    'cochlea-r',
    'middle-lobe-of-right-lung',
  ];
  for (const id of [...leftOfPatient, ...rightOfPatient]) {
    const r = await screenSide([id], 'anterior');
    const left = leftOfPatient.includes(id);
    onScreen.push(
      `${id}: anterior cx=${r.cx.toFixed(3)} (camera target x=${r.tx.toFixed(3)}, coverage ${(r.coverage * 100).toFixed(2)} %)`,
    );
    expect.soft(r.coverage, `${id} is drawn when isolated`).toBeGreaterThan(0);
    if (left)
      expect
        .soft(r.cx, `${id} (patient's left) on the screen's right in the anterior view`)
        .toBeGreaterThan(0.5);
    else
      expect
        .soft(r.cx, `${id} (patient's right) on the screen's left in the anterior view`)
        .toBeLessThan(0.5);
  }
  for (const id of ['femur-l', 'liver']) {
    const r = await screenSide([id], 'posterior');
    onScreen.push(`${id}: posterior cx=${r.cx.toFixed(3)}`);
    if (id === 'femur-l')
      expect.soft(r.cx, 'femur-l on the screen left in the posterior view').toBeLessThan(0.5);
    else expect.soft(r.cx, 'liver on the screen right in the posterior view').toBeGreaterThan(0.5);
  }
  testInfo.annotations.push({ type: 'on-screen', description: onScreen.join('\n') });
  console.log(onScreen.join('\n'));

  // Pictures to look at: abdominal organs + heart, anterior; kidneys posterior.
  const organs = [
    'liver',
    'gallbladder',
    'stomach',
    'spleen',
    'pancreas',
    'vermiform-appendix',
    'g-heart',
    'kidney-l',
    'kidney-r',
  ];
  const organShot = await screenSide(organs, 'anterior');
  saveDataUrl(testInfo, 'qa11-organs-anterior-canvas', organShot.dataUrl);
  await st(page, `s.requestViewer({ type: 'focus', ids: a, animate: false })`, organs);
  await settle(page, 600);
  await shot(page, testInfo, 'qa11-organs-anterior-focused');
  await screenSide(['kidney-l', 'kidney-r', 'spleen', 'liver'], 'posterior');
  await st(
    page,
    `s.requestViewer({ type: 'focus', ids: ['kidney-l', 'kidney-r', 'spleen', 'liver'], animate: false })`,
  );
  await settle(page, 600);
  await shot(page, testInfo, 'qa11-kidneys-spleen-liver-posterior');
  await st(page, 's.exitIsolate()');

  // 4. info panel: names, side, system, counterpart
  for (const [id, heading, side, system] of [
    ['femur-l', 'Os femoris', 'Left', 'Skeletal system'],
    ['kidney-r', 'Ren', 'Right', 'Visceral systems'],
    ['spleen', 'Lien', null, 'Lymphoid organs'],
    ['left-ventricle', 'Ventriculus sinister', 'Left', 'Cardiovascular system'],
    ['sciatic-nerve-r', 'Nervus ischiadicus', 'Right', 'Nervous system & sense organs'],
  ] as const) {
    await st(page, 's.selectAndFocus(a)', id);
    const info = page.getByTestId('info-panel');
    // The h2 also holds the side badge (L/R), so match the start.
    await expect(info.getByRole('heading', { level: 2 })).toHaveText(new RegExp(`^${heading}`));
    await expect(info).toContainText(system);
    if (side)
      await expect(
        info.locator('dt', { hasText: /^Side$/ }).locator('xpath=following-sibling::dd[1]'),
      ).toContainText(side);
    else await expect(info.locator('dt', { hasText: /^Side$/ })).toHaveCount(0);
  }
  await st(page, 's.selectAndFocus("femur-l")');
  const info = page.getByTestId('info-panel');
  await info.getByRole('button', { name: /counterpart/ }).click();
  await expect.poll(() => st(page, 's.selectedId')).toBe('femur-r');
  await shot(page, testInfo, 'qa11-femur-r-info');
});

test('QA-12 vagus nerves: x of the geometry per height band (cervical / thoracic / abdominal)', async ({
  page,
}, testInfo) => {
  await boot(page);
  await st(page, 's.ensureSystemMeta("nervous")');
  const bands = await page.evaluate(async () => {
    type Attr = { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number };
    const hook = window.__atlas! as unknown as {
      store: { getState(): { manifest: { systems: { id: string; chunks: unknown[] }[] } } };
      dataSource: {
        loadChunk(
          a: unknown,
          b: unknown,
        ): Promise<{
          nodes: { nodeName: string; geometry: { attributes: { position: Attr }; dispose(): void } }[];
        }>;
      };
    };
    const sys = hook.store.getState().manifest.systems.find((x) => x.id === 'nervous')!;
    const out: Record<
      string,
      Record<string, { n: number; meanX: number; minX: number; maxX: number; meanZ: number }>
    > = {};
    const edges: [string, number, number][] = [
      ['neck y 1.40–1.55', 1.4, 1.55],
      ['upper thorax y 1.30–1.40', 1.3, 1.4],
      ['lower thorax y 1.15–1.30', 1.15, 1.3],
      ['abdomen y < 1.15', 0, 1.15],
    ];
    for (const chunk of sys.chunks) {
      const res = await hook.dataSource.loadChunk(sys, chunk);
      for (const n of res.nodes) {
        if (n.nodeName === 'vagus-nerve-x-l' || n.nodeName === 'vagus-nerve-x-r') {
          const p = n.geometry.attributes.position;
          const b: Record<string, { n: number; sx: number; sz: number; minX: number; maxX: number }> = {};
          for (let i = 0; i < p.count; i++) {
            const y = p.getY(i);
            const e = edges.find(([, lo, hi]) => y >= lo && y < hi);
            if (!e) continue;
            const k = (b[e[0]] ??= { n: 0, sx: 0, sz: 0, minX: Infinity, maxX: -Infinity });
            const x = p.getX(i);
            k.n++;
            k.sx += x;
            k.sz += p.getZ(i);
            k.minX = Math.min(k.minX, x);
            k.maxX = Math.max(k.maxX, x);
          }
          out[n.nodeName] = Object.fromEntries(
            Object.entries(b).map(([k, v]) => [
              k,
              { n: v.n, meanX: v.sx / v.n, minX: v.minX, maxX: v.maxX, meanZ: v.sz / v.n },
            ]),
          );
        }
        n.geometry.dispose();
      }
    }
    return out;
  });
  const lines: string[] = [];
  for (const [id, b] of Object.entries(bands))
    for (const [k, v] of Object.entries(b))
      lines.push(
        `${id} ${k}: n=${v.n} mean x=${v.meanX.toFixed(3)} [${v.minX.toFixed(3)} … ${v.maxX.toFixed(3)}] mean z=${v.meanZ.toFixed(3)}`,
      );
  console.log(lines.join('\n'));
  testInfo.annotations.push({ type: 'vagus bands', description: lines.join('\n') });
  // Picture: both vagus nerves + oesophagus/trachea for reference, anterior view, right vagus selected.
  await st(page, 's.setLayerVisible("nervous", true)');
  await waitGeometry(page, 120_000);
  await st(
    page,
    's.setIsolate("isolate", ["vagus-nerve-x-l", "vagus-nerve-x-r", "oesophagus", "trachea", "aortic-arch"])',
  );
  await st(page, 's.select("vagus-nerve-x-r")');
  await st(
    page,
    `s.requestViewer({ type: 'focus', ids: ['vagus-nerve-x-l', 'vagus-nerve-x-r'], animate: false })`,
  );
  await st(page, `s.requestViewer({ type: 'setView', view: 'anterior', animate: false })`);
  await settle(page, 800);
  await shot(page, testInfo, 'qa12-vagus-anterior-right-selected');
  await st(page, `s.requestViewer({ type: 'setView', view: 'posterior', animate: false })`);
  await settle(page, 800);
  await shot(page, testInfo, 'qa12-vagus-posterior-right-selected');
});
