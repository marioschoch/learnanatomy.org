import { beforeEach, describe, expect, it } from 'vitest';
import { Ray, Vector3, Vector4 } from 'three';
import type { AtlasDataSource, Structure, Vec3 } from '@/contract';
import { createMockDataSource } from '@/mocks';
import { buildVisibilityContext, resetAtlasStore, useAtlasStore } from '@/state';
import { AtlasScene } from './AtlasScene';
import { layerRenderOrder } from './ChunkBatch';
import { clipPlaneSpecs } from './clipping';

const s = () => useAtlasStore.getState();

async function buildScene(systems: string[]): Promise<AtlasScene> {
  const ds = s().dataSource as AtlasDataSource;
  const scene = new AtlasScene();
  for (const id of systems) {
    await s().ensureSystemMeta(id);
    const sys = s().manifest!.systems.find((x) => x.id === id)!;
    const st = s();
    const systemStructures = (st.structureIdsBySystem[id] ?? []).map((sid) => st.structures[sid]!);
    for (const chunk of sys.chunks) {
      const loaded = await ds.loadChunk(sys, chunk);
      scene.addChunk(sys, loaded, st.structures, systemStructures, st.manifest!.regions);
    }
  }
  return scene;
}

function sync(scene: AtlasScene) {
  scene.applyVisibility(buildVisibilityContext(s()), s().structures);
}

/** Ray from the front (+Z) straight back through (x, y). */
const frontRay = (x: number, y: number) => new Ray(new Vector3(x, y, 5), new Vector3(0, 0, -1));
const at = (id: string): Vec3 => s().structures[id]!.centroid;

describe('AtlasScene on mock data', () => {
  let scene: AtlasScene;

  beforeEach(async () => {
    resetAtlasStore();
    await s().init(createMockDataSource());
    scene = await buildScene(['skeletal', 'visceral', 'muscular']);
    sync(scene);
  });

  it('builds one BatchedMesh (+2 views) per chunk and a complete id map', () => {
    expect(scene.allBatches).toHaveLength(3);
    expect(scene.root.children).toHaveLength(9);
    const all = Object.values(s().structures) as Structure[];
    expect(all.length).toBe(32);
    for (const st of all) {
      const loc = scene.locate(st.id);
      expect(loc, st.id).toBeDefined();
      expect(loc!.batch.ids[loc!.instanceId]).toBe(st.id);
      expect(loc!.batch.instanceOf.get(st.id)).toBe(loc!.instanceId);
      expect(loc!.batch.system).toBe(st.system);
    }
  });

  it('follows layer visibility: hidden systems are not drawn', () => {
    const muscular = scene.allBatches.find((b) => b.system === 'muscular')!;
    expect(muscular.main.visible).toBe(false);
    expect(scene.isVisible('femur-l')).toBe(true);
    expect(scene.isVisible('biceps-brachii-l')).toBe(false);
    s().setLayerVisible('muscular', true);
    sync(scene);
    expect(muscular.main.visible).toBe(true);
    expect(muscular.main.getVisibleAt(muscular.instanceOf.get('biceps-brachii-l')!)).toBe(true);
  });

  it('picks the correct structure and side (critical)', () => {
    const femurL = at('femur-l');
    const femurR = at('femur-r');
    expect(scene.pick(frontRay(femurL[0], femurL[1]))?.id).toBe('femur-l');
    expect(scene.pick(frontRay(femurR[0], femurR[1]))?.id).toBe('femur-r');
    const liver = at('liver');
    expect(scene.pick(frontRay(liver[0], liver[1]))?.id).toBe('liver');
    expect(scene.pick(frontRay(2, 2))).toBeNull();
  });

  it('ignores invisible and nearly transparent (< 5 %) structures, picks through them', () => {
    s().setLayerVisible('muscular', true);
    sync(scene);
    const quad = at('quadriceps-femoris-l');
    expect(scene.pick(frontRay(quad[0], quad[1]))?.id).toBe('quadriceps-femoris-l');
    s().setLayerOpacity('muscular', 0.04);
    sync(scene);
    expect(scene.pick(frontRay(quad[0], quad[1]))?.id).toBe('femur-l');
    s().setLayerVisible('skeletal', false);
    sync(scene);
    expect(scene.pick(frontRay(quad[0], quad[1]))).toBeNull();
  });

  it('isolate with context: ghosts are drawn but not pickable', () => {
    s().setIsolate('context', ['heart']);
    sync(scene);
    const visceral = scene.allBatches.find((b) => b.system === 'visceral')!;
    const skeletal = scene.allBatches.find((b) => b.system === 'skeletal')!;
    expect(visceral.main.visible).toBe(true);
    expect(visceral.ghost.visible).toBe(true);
    expect(skeletal.main.visible).toBe(false);
    expect(skeletal.ghost.visible).toBe(true);
    const liver = at('liver');
    expect(scene.pick(frontRay(liver[0], liver[1]))).toBeNull();
    const heart = at('heart');
    expect(scene.pick(frontRay(heart[0], heart[1]))?.id).toBe('heart');
    s().exitIsolate();
    sync(scene);
    expect(skeletal.ghost.visible).toBe(false);
    expect(skeletal.main.visible).toBe(true);
  });

  it('orders transparent layers inner → outer with a depth pre-pass each', () => {
    s().setLayerVisible('muscular', true);
    s().setLayerOpacity('muscular', 0.2);
    s().setLayerOpacity('visceral', 0.6);
    sync(scene);
    const by = (id: string) => scene.allBatches.find((b) => b.system === id)!;
    expect(by('skeletal').transparent).toBe(false);
    expect(by('skeletal').main.material).toBe(scene.materials.opaque);
    expect(by('visceral').transparent).toBe(true);
    expect(by('visceral').main.material).toBe(scene.materials.transparent);
    expect(by('visceral').prepass.visible).toBe(true);
    const v = layerRenderOrder(3);
    const m = layerRenderOrder(7);
    expect(by('visceral').prepass.renderOrder).toBe(v.prepass);
    expect(by('visceral').main.renderOrder).toBe(v.color);
    expect(v.color).toBeLessThan(m.prepass);
    expect(by('muscular').main.renderOrder).toBe(m.color);
    // Per-instance alpha comes from structureRender.
    const c = new Vector4();
    by('muscular').main.getColorAt(0, c);
    expect(c.w).toBeCloseTo(0.2);
    expect(scene.materials.transparent.depthWrite).toBe(false);
    expect(scene.materials.depthPrepass.colorWrite).toBe(false);
  });

  it('raycasts hit exploded positions', () => {
    const femurL = at('femur-l');
    scene.setExplodeTarget(1, true);
    const o = scene.offsetOf('femur-l');
    expect(Math.hypot(...o)).toBeGreaterThan(0.05);
    expect(o[0]).toBeGreaterThan(0); // left femur moves further to the patient's left
    expect(scene.pick(frontRay(femurL[0] + o[0], femurL[1] + o[1]))?.id).toBe('femur-l');
    const hit = scene.pick(frontRay(femurL[0], femurL[1]));
    expect(hit?.id).not.toBe('femur-l');
  });

  it('animates explode over several ticks', () => {
    scene.setExplodeTarget(1, false);
    expect(scene.explode).toBe(0);
    expect(scene.tick(1 / 60, false)).toBe(true);
    expect(scene.explode).toBeGreaterThan(0);
    for (let i = 0; i < 400; i++) scene.tick(1 / 60, false);
    expect(scene.explode).toBe(1);
    expect(scene.tick(1 / 60, false)).toBe(false);
  });

  it('skips geometry on the clipped side and hits what is behind the cut', () => {
    const liver = at('liver'); // x < 0: patient's right
    s().setClipPlane('sagittal', { enabled: true, position: 0.5 }); // removes the right half
    scene.setClipping(clipPlaneSpecs(s().clipping, s().manifest!.bodyBounds));
    expect(scene.materials.planes).toHaveLength(1);
    expect(scene.materials.opaque.side).toBe(2); // DoubleSide while cutting
    expect(scene.pick(frontRay(liver[0], liver[1]))?.id).not.toBe('liver');
    // Looking from the patient's right (−X) towards +X through the liver's height: the first visible surface is
    // past the cut (x ≥ 0) — never the liver.
    const side = new Ray(new Vector3(-2, liver[1], liver[2]), new Vector3(1, 0, 0));
    const hit = scene.pick(side);
    expect(hit?.id).not.toBe('liver');
    if (hit) expect(hit.point[0]).toBeGreaterThanOrEqual(-1e-6);
    scene.setClipping([]);
    expect(scene.materials.opaque.side).toBe(0);
    expect(scene.pick(frontRay(liver[0], liver[1]))?.id).toBe('liver');
  });

  it('tints the selected structure and leaves others alone', () => {
    const loc = scene.locate('femur-l')!;
    const before = new Vector4();
    loc.batch.main.getColorAt(loc.instanceId, before);
    scene.applyTints(new Map([['femur-l', 'selected']]));
    const after = new Vector4();
    loc.batch.main.getColorAt(loc.instanceId, after);
    expect(after.z).toBeGreaterThan(before.z); // pulled towards blue
    const other = scene.locate('femur-r')!;
    const o = new Vector4();
    other.batch.main.getColorAt(other.instanceId, o);
    expect(o.x).toBeCloseTo(before.x);
  });

  it('finds a surface point for labels and disposes cleanly', () => {
    const c = at('cranium');
    const p = scene.surfacePoint('cranium', [c[0], c[1] + 1, c[2]])!;
    expect(p[1]).toBeGreaterThan(c[1]); // top of the skull
    expect(p[1]).toBeLessThan(c[1] + 0.1);
    scene.dispose();
    expect(scene.root.children).toHaveLength(0);
    expect(scene.isDisposed).toBe(true);
  });
});
