import { describe, expect, it } from 'vitest';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { BoxGeometry, BufferAttribute, Matrix4, Triangle, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import type { Manifest, SystemStructuresFile } from '@/contract';
import { resetLook } from '../core/tissue';
import { bakeGeometry, decodeGlbImpl } from './decodeGlbImpl';

// tsconfig.app has no Node types; the test runs in Node (vitest), so load fs untyped.
interface MinimalFs {
  existsSync(p: string): boolean;
  readFileSync(p: string, enc: 'utf8'): string;
  readFileSync(p: string): Uint8Array;
}
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as MinimalFs;
const cwd = (globalThis as unknown as { process: { cwd(): string } }).process.cwd;

/**
 * Builds a GLB the way the pipeline does: quantized with one shared (scene) volume + meshopt compression.
 * `tissue` = constant _TISSUE value (uint8 × 4) of every vertex of that box; `extras` = node extras.
 */
async function buildGlb(
  boxes: {
    name: string;
    center: [number, number, number];
    size: number;
    tissue?: [number, number, number, number];
    extras?: Record<string, unknown>;
  }[],
) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  for (const b of boxes) {
    const g = new BoxGeometry(b.size, b.size * 2, b.size).translate(...b.center);
    const pos = doc
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array(g.getAttribute('position').array))
      .setBuffer(buffer);
    const nor = doc
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array(g.getAttribute('normal').array))
      .setBuffer(buffer);
    const idx = doc
      .createAccessor()
      .setType('SCALAR')
      .setArray(new Uint16Array(g.index!.array))
      .setBuffer(buffer);
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', pos)
      .setAttribute('NORMAL', nor)
      .setIndices(idx);
    if (b.tissue) {
      const count = g.getAttribute('position').count;
      const t = new Uint8Array(count * 4);
      for (let i = 0; i < count; i++) t.set(b.tissue, i * 4);
      prim.setAttribute(
        '_TISSUE',
        doc.createAccessor().setType('VEC4').setArray(t).setNormalized(true).setBuffer(buffer),
      );
    }
    const mesh = doc.createMesh(b.name).addPrimitive(prim);
    const node = doc.createNode(b.name).setMesh(mesh);
    if (b.extras) node.setExtras(b.extras);
    scene.addChild(node);
  }
  await MeshoptEncoder.ready;
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize({ quantizationVolume: 'scene' }));
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const glb = await io.writeBinary(doc);
  return { glb: glb.slice().buffer, json: (await io.writeJSON(doc)).json };
}

/** Fraction of triangles whose winding normal points away from the geometry centre (outward). */
function outwardFraction(g: BufferGeometry): number {
  const pos = g.getAttribute('position');
  const idx = g.index!;
  const center = g.boundingSphere!.center;
  const t = new Triangle();
  const n = new Vector3();
  const m = new Vector3();
  let out = 0;
  const tris = idx.count / 3;
  for (let i = 0; i < tris; i++) {
    t.a.fromBufferAttribute(pos, idx.getX(i * 3));
    t.b.fromBufferAttribute(pos, idx.getX(i * 3 + 1));
    t.c.fromBufferAttribute(pos, idx.getX(i * 3 + 2));
    t.getNormal(n);
    t.getMidpoint(m);
    if (n.dot(m.sub(center)) > 0) out++;
  }
  return out / tris;
}

function withLook(query: string) {
  window.history.replaceState(null, '', query);
  resetLook();
}

describe('decodeGlb', () => {
  it('decodes quantized + meshopt GLBs into body-space Float32 geometry, one per node', async () => {
    const { glb, json } = await buildGlb([
      { name: 'box-l', center: [0.2, 1.2, 0.05], size: 0.1 },
      { name: 'box-r', center: [-0.2, 0.4, -0.05], size: 0.05 },
    ]);
    // Sanity: the fixture really is quantized and compressed.
    expect(json.extensionsUsed).toEqual(
      expect.arrayContaining(['KHR_mesh_quantization', 'EXT_meshopt_compression']),
    );
    expect(json.nodes!.some((n) => n.scale || n.translation)).toBe(true);

    const nodes = await decodeGlbImpl(glb, 'test.glb');
    expect(nodes.map((n) => n.nodeName)).toEqual(['box-l', 'box-r']);
    for (const { geometry } of nodes) {
      expect(Object.keys(geometry.attributes).sort()).toEqual(['normal', 'position']);
      expect(geometry.getAttribute('position').array).toBeInstanceOf(Float32Array);
      expect(geometry.getAttribute('normal').array).toBeInstanceOf(Float32Array);
      expect(geometry.getAttribute('position').normalized).toBe(false);
      expect(geometry.index).not.toBeNull();
      expect(outwardFraction(geometry)).toBe(1);
    }
    const [l, r] = nodes.map((n) => n.geometry.boundingBox!);
    // Dequantization transform applied: true body-space coordinates (within quantization error).
    expect(l!.min.x).toBeCloseTo(0.15, 3);
    expect(l!.max.x).toBeCloseTo(0.25, 3);
    expect(l!.max.y).toBeCloseTo(1.3, 3);
    expect(r!.min.x).toBeCloseTo(-0.225, 3);
    expect(r!.min.z).toBeCloseTo(-0.075, 3);
  });

  it('keeps _TISSUE as normalized Uint8 × 4 `tissue`, the same layout on every node of the chunk', async () => {
    const { glb } = await buildGlb([
      { name: 'muscle', center: [0.2, 1.2, 0.05], size: 0.1, tissue: [255, 0, 0, 0] },
      { name: 'bone', center: [-0.2, 1.2, 0.05], size: 0.1, tissue: [0, 128, 0, 0] },
      { name: 'plain', center: [0, 0.4, 0], size: 0.05 },
    ]);
    const nodes = await decodeGlbImpl(glb, 'test.glb');
    const [muscle, bone, plain] = nodes.map((n) => n.geometry.getAttribute('tissue'));
    for (const t of [muscle, bone, plain]) {
      expect(t!.array).toBeInstanceOf(Uint8Array);
      expect(t!.itemSize).toBe(4);
      expect(t!.normalized).toBe(true);
    }
    expect(muscle!.getX(0)).toBeCloseTo(1);
    expect(muscle!.getY(0)).toBe(0);
    expect(bone!.getX(0)).toBe(0);
    expect(bone!.getY(0)).toBeCloseTo(128 / 255);
    expect(plain!.getX(0) + plain!.getY(0)).toBe(0); // filled with zeros

    // Off switch (tissue look disabled): dropped.
    const g = new BoxGeometry(1, 1, 1);
    g.setAttribute(
      '_tissue',
      new BufferAttribute(new Uint8Array(g.getAttribute('position').count * 4), 4, true),
    );
    expect(bakeGeometry(g, new Matrix4(), false).hasAttribute('tissue')).toBe(false);
    expect(bakeGeometry(g, new Matrix4(), true).hasAttribute('tissue')).toBe(true);
  });

  it('passes muscle fibre ends (node extras) on as geometry.userData.fibre while fibres are on', async () => {
    const fibre = [0.1, 1.0, 0.0, 0.12, 1.3, 0.02];
    const { glb } = await buildGlb([
      { name: 'muscle', center: [0.2, 1.2, 0.05], size: 0.1, tissue: [0, 0, 0, 0], extras: { fibre } },
      { name: 'ring', center: [-0.2, 1.2, 0.05], size: 0.1, tissue: [0, 0, 0, 0] },
    ]);
    withLook('/?look=3');
    const [muscle, ring] = await decodeGlbImpl(glb, 'test.glb');
    // Body space as written by the pipeline (the node's dequantization transform does not apply to extras).
    expect(muscle!.geometry.userData.fibre).toEqual(fibre);
    expect(ring!.geometry.userData.fibre).toBeUndefined();
    withLook('/?look=2');
    const [plain] = await decodeGlbImpl(glb, 'test.glb');
    expect(plain!.geometry.userData.fibre).toBeUndefined();
    withLook('/');
  });

  it('keeps outward winding when a node transform mirrors (negative determinant)', () => {
    const g = new BoxGeometry(1, 1, 1).translate(2, 0, 0);
    g.computeBoundingSphere();
    expect(outwardFraction(g)).toBe(1);
    const mirrored = bakeGeometry(g, new Matrix4().makeScale(-1, 1, 1));
    expect(mirrored.boundingBox!.max.x).toBeCloseTo(-1.5);
    expect(outwardFraction(mirrored)).toBe(1);
    const plain = bakeGeometry(g, new Matrix4().makeTranslation(0, 1, 0));
    expect(outwardFraction(plain)).toBe(1);
  });

  // Runs only when the pipeline has produced real assets (public/models is gitignored).
  const models = `${cwd()}/public/models`;
  const manifestPath = `${models}/manifest.json`;
  const hasReal = fs.existsSync(manifestPath);
  // Every real chunk: one geometry per structure, in body space exactly where the metadata bbox says
  // (decode + dequantization correct). Side checks are strict for the skeleton; elsewhere sides derived from
  // names may legitimately sit near the midline (validate.mjs reviews those).
  const manifest = hasReal ? (JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest) : null;
  for (const sys of manifest?.systems ?? [{ id: 'skeletal' } as Manifest['systems'][number]]) {
    it.skipIf(!hasReal)(
      `decodes the real ${sys.id} chunks into body space matching the metadata`,
      async () => {
        const meta = JSON.parse(
          fs.readFileSync(`${models}/${sys.structuresFile}`, 'utf8'),
        ) as SystemStructuresFile;
        const byId = new Map(meta.structures.map((s) => [s.id, s]));
        let decoded = 0;
        // structures with marked tendon (x) / cartilage (y) vertices
        const marked = [0, 0];
        let withTissue = 0;
        // occluded vertices (_TISSUE B > 0) and the largest B, structures with fibre ends
        let occluded = 0;
        let maxOcclusion = 0;
        let withFibres = 0;
        withLook('/?look=3');
        for (const chunk of sys.chunks) {
          const file = fs.readFileSync(`${models}/${chunk.file}`) as Uint8Array;
          // Copy into an ArrayBuffer of this realm (Node Buffers fail GLTFLoader's instanceof check under jsdom).
          const ab = new ArrayBuffer(file.byteLength);
          new Uint8Array(ab).set(file);
          const nodes = await decodeGlbImpl(ab, chunk.file);
          expect(nodes.length).toBe(chunk.structureCount);
          for (const { nodeName, geometry } of nodes) {
            const st = byId.get(nodeName);
            expect(st, nodeName).toBeDefined();
            const c = geometry.boundingBox!.getCenter(new Vector3());
            for (let a = 0; a < 3; a++) {
              const mc = (st!.bbox.min[a]! + st!.bbox.max[a]!) / 2;
              // mm tolerance + quantization error
              expect(Math.abs(c.getComponent(a) - mc), `${nodeName} axis ${a}`).toBeLessThan(0.005);
            }
            if (sys.id === 'skeletal' && st!.side === 'left') expect(c.x).toBeGreaterThan(0);
            if (sys.id === 'skeletal' && st!.side === 'right') expect(c.x).toBeLessThan(0);
            const fibre = geometry.userData.fibre as number[] | undefined;
            if (fibre) {
              withFibres++;
              expect(fibre).toHaveLength(6);
              // both ends lie near the structure (fan-shaped muscles push one end ≈ 3× further out)
              for (const end of [fibre.slice(0, 3), fibre.slice(3)]) {
                expect(Math.hypot(...end.map((v, a) => v - c.getComponent(a))), nodeName).toBeLessThan(1);
              }
            }
            const t = geometry.getAttribute('tissue');
            if (t) {
              withTissue++;
              for (let i = 0; i < t.count; i++) {
                const b = Math.round(t.getComponent(i, 2) * 255);
                if (b > 0) occluded++;
                maxOcclusion = Math.max(maxOcclusion, b);
              }
              for (let ch = 0; ch < 2; ch++) {
                for (let i = 0; i < t.count; i++) {
                  if (t.getComponent(i, ch) > 0) {
                    marked[ch]!++;
                    break;
                  }
                }
              }
            }
            geometry.dispose();
            decoded++;
          }
        }
        expect(decoded).toBe(sys.structureCount);
        // Tendons only on muscles, cartilage only on bones (pipeline/config/systems.json export.tissue).
        const tissueSystem = sys.id === 'muscular' || sys.id === 'skeletal';
        expect(withTissue).toBe(tissueSystem ? sys.structureCount : 0);
        if (sys.id === 'muscular') expect(marked).toEqual([expect.any(Number), 0]);
        if (sys.id === 'muscular') expect(marked[0]).toBeGreaterThan(200);
        if (sys.id === 'skeletal') expect(marked).toEqual([0, expect.any(Number)]);
        if (sys.id === 'skeletal') expect(marked[1]).toBeGreaterThan(150);
        // Baked occlusion in B: 0..31 (pipeline/blender/shading.py OCCLUSION_STEPS), on many vertices.
        if (tissueSystem) expect(maxOcclusion).toBe(31);
        if (tissueSystem) expect(occluded).toBeGreaterThan(10_000);
        // Fibre ends on the muscles that are not ring-shaped, complex or connective tissue.
        if (sys.id === 'muscular') expect(withFibres).toBeGreaterThan(300);
        else expect(withFibres).toBe(0);
        withLook('/');
      },
      180_000,
    );
  }
});
