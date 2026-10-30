/**
 * GLB → LoadedNode[] (GLTFLoader.parse + MeshoptDecoder). Loaded lazily through ../decodeGlb.ts so three's loader
 * code stays out of the main bundle.
 *
 * Pipeline GLBs (ARCHITECTURE.md §4.4) use KHR_mesh_quantization with quantizationVolume 'scene': attributes are
 * normalized integers and every node carries the same dequantization transform. The contract wants geometry in
 * body space with an identity transform, so for each glTF node we
 *   1. merge its primitives (normally exactly one),
 *   2. convert position/normal to plain Float32 attributes (dequantizes normalized ints, de-interleaves),
 *   3. bake the node's world matrix (dequantization + any authored transform) into the vertices,
 *   4. flip triangle winding if that matrix mirrors (negative determinant) so front faces stay outward —
 *      the viewer's cut-face shading depends on it.
 * Every geometry ends up with the same layout (indexed, `position` + `normal`, Float32), as BatchedMesh requires.
 * Chunks with the pipeline's `_TISSUE` attribute (muscular, skeletal) also get `tissue` (Uint8 × 4, normalized) on
 * every node while the tissue look is on (../core/tissue.ts); otherwise it is dropped. Muscle nodes' fibre ends
 * (node extras "fibre", six numbers in body space) go to `geometry.userData.fibre` while fibres are on.
 */
import { BufferAttribute, BufferGeometry } from 'three';
import type { Mesh, Object3D, Matrix4 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GlbDecoder, LoadedNode } from '@/contract';
import { look, tissueLookEnabled } from '../core/tissue';

let loader: GLTFLoader | null = null;

async function getLoader(): Promise<GLTFLoader> {
  if (!loader) {
    await MeshoptDecoder.ready;
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

/** Float32, non-interleaved copy of an attribute (handles normalized ints and interleaved buffers). */
function toFloat32(attr: BufferGeometry['attributes'][string]): BufferAttribute {
  const { count, itemSize } = attr;
  const out = new Float32Array(count * itemSize);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < itemSize; c++) out[i * itemSize + c] = attr.getComponent(i, c);
  }
  return new BufferAttribute(out, itemSize);
}

/** Uint8 × 4 normalized, non-interleaved copy of a [0, 1] attribute (missing components are 0). */
function toUnorm8x4(attr: BufferGeometry['attributes'][string]): BufferAttribute {
  const { count } = attr;
  const size = Math.min(4, attr.itemSize);
  const out = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < size; c++) out[i * 4 + c] = Math.round(attr.getComponent(i, c) * 255);
  }
  return new BufferAttribute(out, 4, true);
}

/** Normalized copy of a primitive: position + normal (Float32) [+ tissue] + index, in body space. */
export function bakeGeometry(
  source: BufferGeometry,
  matrixWorld: Matrix4,
  keepTissue = tissueLookEnabled(),
): BufferGeometry {
  const g = new BufferGeometry();
  const pos = source.getAttribute('position');
  if (!pos) throw new Error('primitive without POSITION');
  g.setAttribute('position', toFloat32(pos));
  const normal = source.getAttribute('normal');
  if (normal) g.setAttribute('normal', toFloat32(normal));
  const tissue = keepTissue ? source.getAttribute('_tissue') : undefined;
  if (tissue) g.setAttribute('tissue', toUnorm8x4(tissue));

  let index: Uint32Array | Uint16Array;
  if (source.index) {
    const src = source.index;
    index = pos.count > 65535 ? new Uint32Array(src.count) : new Uint16Array(src.count);
    for (let i = 0; i < src.count; i++) index[i] = src.getX(i);
  } else {
    index = pos.count > 65535 ? new Uint32Array(pos.count) : new Uint16Array(pos.count);
    for (let i = 0; i < pos.count; i++) index[i] = i;
  }

  // Baking a mirroring matrix would turn triangles inside out; swap two corners to keep outward winding.
  if (matrixWorld.determinant() < 0) {
    for (let i = 0; i + 2 < index.length; i += 3) {
      const t = index[i + 1]!;
      index[i + 1] = index[i + 2]!;
      index[i + 2] = t;
    }
  }
  g.setIndex(new BufferAttribute(index, 1));
  g.applyMatrix4(matrixWorld); // also transforms + renormalizes normals
  if (!normal) g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Name of the glTF node an object was created for (exact JSON name, not three's sanitized name). */
function nodeNameOf(
  obj: Object3D,
  associations: Map<unknown, { nodes?: number } | undefined>,
  nodeNames: (string | undefined)[],
): { name: string; object: Object3D } | null {
  let cur: Object3D | null = obj;
  while (cur) {
    const assoc = associations.get(cur);
    if (assoc && assoc.nodes !== undefined) {
      const name = nodeNames[assoc.nodes];
      if (name) return { name, object: cur };
    }
    cur = cur.parent;
  }
  return null;
}

export const decodeGlbImpl: GlbDecoder = async (buffer, file) => {
  const l = await getLoader();
  const gltf = await l.parseAsync(buffer, '');
  const json = gltf.parser.json as { nodes?: { name?: string }[] };
  const nodeNames = (json.nodes ?? []).map((n) => n.name);
  const associations = gltf.parser.associations as unknown as Map<unknown, { nodes?: number } | undefined>;
  gltf.scene.updateMatrixWorld(true);

  // Collect primitives per node name (a node with several primitives becomes a Group of Meshes in three).
  const perNode = new Map<string, BufferGeometry[]>();
  const fibreOf = new Map<string, number[]>();
  const keepFibres = look().fibres;
  const order: string[] = [];
  gltf.scene.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const owner = nodeNameOf(mesh, associations, nodeNames);
    if (!owner) {
      console.warn(`[viewer] ${file}: mesh without a named node skipped`);
      return;
    }
    const baked = bakeGeometry(mesh.geometry, mesh.matrixWorld);
    const fibre: unknown = owner.object.userData.fibre;
    if (keepFibres && Array.isArray(fibre) && fibre.length === 6) fibreOf.set(owner.name, fibre as number[]);
    let list = perNode.get(owner.name);
    if (!list) {
      list = [];
      perNode.set(owner.name, list);
      order.push(owner.name);
    }
    list.push(baked);
    mesh.geometry.dispose();
  });

  // One layout per chunk: if any primitive has `tissue`, give the others zeros (validate.mjs makes this rare).
  const all = [...perNode.values()].flat();
  if (all.some((g) => g.hasAttribute('tissue'))) {
    for (const g of all) {
      if (!g.hasAttribute('tissue')) {
        const count = g.getAttribute('position').count;
        g.setAttribute('tissue', new BufferAttribute(new Uint8Array(count * 4), 4, true));
      }
    }
  }

  const nodes: LoadedNode[] = [];
  for (const name of order) {
    const parts = perNode.get(name)!;
    let geometry = parts[0]!;
    if (parts.length > 1) {
      const merged = mergeGeometries(parts, false);
      if (!merged) throw new Error(`${file}: could not merge primitives of node ${name}`);
      for (const p of parts) p.dispose();
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      geometry = merged;
    }
    const fibre = fibreOf.get(name);
    if (fibre) geometry.userData.fibre = fibre;
    nodes.push({ nodeName: name, geometry });
  }
  return nodes;
};
