import { describe, expect, it } from 'vitest';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { BoxGeometry, Matrix4, Triangle, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import type { Manifest, SystemStructuresFile } from '@/contract';
import { bakeGeometry, decodeGlbImpl } from './decodeGlbImpl';

// tsconfig.app has no Node types; the test runs in Node (vitest), so load fs untyped.
interface MinimalFs {
  existsSync(p: string): boolean;
  readFileSync(p: string, enc: 'utf8'): string;
  readFileSync(p: string): Uint8Array;
}
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as MinimalFs;
const cwd = (globalThis as unknown as { process: { cwd(): string } }).process.cwd;

/** Builds a GLB the way the pipeline does: quantized with one shared (scene) volume + meshopt compression. */
async function buildGlb(boxes: { name: string; center: [number, number, number]; size: number }[]) {
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
    const mesh = doc.createMesh(b.name).addPrimitive(prim);
    scene.addChild(doc.createNode(b.name).setMesh(mesh));
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
            geometry.dispose();
            decoded++;
          }
        }
        expect(decoded).toBe(sys.structureCount);
      },
      180_000,
    );
  }
});
