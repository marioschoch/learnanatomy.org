/**
 * One GLB chunk rendered as BatchedMeshes, plus its id maps and picking data.
 *
 * Id maps: every GLB node becomes ONE geometry and ONE instance in `main`. Instance ids are dense 0..n−1 in node
 * order, so `ids[instanceId] = structureId` and `instanceOf.get(structureId) = instanceId`.
 *
 * Views: `prepass` and `ghost` are BatchedMeshes that SHARE `main`'s geometry buffers (no extra GPU memory for
 * vertices) but have their own instance visibility, colours and matrices, because they draw different subsets:
 *   main    – structures in 'normal' render mode (opaque or transparent material)
 *   prepass – same subset as main, depth only; visible only while main is transparent (see materials.ts)
 *   ghost   – structures in 'ghost' mode (isolate with context), transparent, never pickable
 * Views are created with `BatchedMesh.copy()` (copies instance/geometry bookkeeping, keeping instance ids
 * identical) while `main.geometry` is temporarily swapped for an empty placeholder, so the big vertex buffers are
 * never cloned; afterwards the view's geometry is pointed at the shared one.
 *
 * Instance matrices are translations only (explode offsets). Picking relies on that: it shifts the ray by the
 * offset instead of inverting a matrix, and distances are identical in instance and world space.
 */
import { BatchedMesh, BufferGeometry, Color, Matrix4, Ray, Sphere, Vector3, Vector4 } from 'three';
import type { DataTexture, Material, Side } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { BBox, LoadedChunk, Structure, SystemId, Vec3 } from '@/contract';
import type { StructureRender } from '@/state';
import { FALLBACK_COLOR, tintedColor } from './colors';
import type { Tint } from './colors';
import { EXPLODE_LOCAL, explodeVector } from './explode';
import { createFibreEnds } from './materials';
import type { AtlasMaterials, SurfacePair } from './materials';
import { structureColor, surfaceKind } from './tissue';
import type { SurfaceKind } from './tissue';

/**
 * renderOrder of a layer's passes.
 *  - transparent (three's transparent list): inner layers (low layerOrder) first → back-to-front for nested layers
 *  - opaque (three's opaque list, always drawn before anything transparent): OUTER layers first. Outer layers
 *    enclose inner ones, so this is roughly front-to-back and early-z rejects hidden inner fragments
 *    (skin drawn first ⇒ muscles/bones behind it cost almost no shading).
 */
export function layerRenderOrder(layerOrder: number): { opaque: number; prepass: number; color: number } {
  return { opaque: -1 - layerOrder, prepass: 10 + layerOrder * 2, color: 11 + layerOrder * 2 };
}

const MODE_HIDDEN = 0;
const MODE_NORMAL = 1;
const MODE_GHOST = 2;

const _m = new Matrix4();
const _v4 = new Vector4();
const _c = new Color();
const _sphere = new Sphere();
const _ray = new Ray();
const _p = new Vector3();

export interface BatchHit {
  id: string;
  instanceId: number;
  distance: number;
  /** World-space hit point (includes the explode offset). */
  point: Vec3;
}

function createView(source: BatchedMesh, material: Material): BatchedMesh {
  const shared = source.geometry;
  const placeholder = new BufferGeometry();
  source.geometry = placeholder;
  const view = new BatchedMesh(source.maxInstanceCount, 1, 1, material);
  view.copy(source);
  source.geometry = shared;
  view.geometry.dispose(); // clone of the placeholder
  placeholder.dispose();
  view.geometry = shared;
  view.material = material;
  return view;
}

export class ChunkBatch {
  readonly file: string;
  readonly system: SystemId;
  readonly layerOrder: number;
  readonly main: BatchedMesh;
  readonly prepass: BatchedMesh;
  readonly ghost: BatchedMesh;
  /** instanceId → structure id (node name). */
  readonly ids: string[];
  /** structure id → instanceId (the same in main, prepass and ghost). */
  readonly instanceOf = new Map<string, number>();
  /** Structures that have metadata (others are drawn but never pickable). */
  readonly known: Uint8Array;
  readonly triangleCount: number;
  /** Geometry has the `tissue` attribute (tendons/cartilage) → tissue materials (materials.ts). */
  readonly tissue: boolean;
  /** Surface shader of this chunk (tissue.ts surfaceKind). */
  readonly kind: SurfaceKind;
  /** Colour-pass materials (opaque/transparent) of `kind`; muscle chunks with fibres own theirs. */
  readonly surfaces: SurfacePair;
  /** Per-instance fibre ends (node extras "fibre" via decodeGlb) for the fibre shader, or null. */
  private readonly fibreEnds: DataTexture | null;

  private readonly baseColor: string[];
  private readonly geometryIdOf: Int32Array;
  /** Explode vector (offset at explode = 1) per instance, xyz. */
  private readonly explodeVec: Float32Array;
  private readonly mode: Uint8Array;
  private readonly alpha: Float32Array;
  private readonly pickable: Uint8Array;
  private readonly tint: Tint[];
  private readonly bvh: (MeshBVH | null)[];
  private bvhCursor = 0;
  private explode = 0;
  private disposed = false;
  private readonly materials: AtlasMaterials;

  /** Flags from the last `applyRender`. */
  anyNormal = false;
  anyGhost = false;
  transparent = false;

  constructor(opts: {
    chunk: LoadedChunk;
    system: SystemId;
    layerOrder: number;
    structures: Readonly<Record<string, Structure>>;
    systemColor: string;
    /** Offset at explode = 1 per structure id (computeExplodeVectors over the whole system). */
    explodeVectors: ReadonlyMap<string, Vec3>;
    /** Fallback centre for nodes without metadata (system bbox centre). */
    explodeCenter: Readonly<Vec3>;
    materials: AtlasMaterials;
  }) {
    const { chunk, structures } = opts;
    this.file = chunk.file;
    this.system = opts.system;
    this.layerOrder = opts.layerOrder;
    this.materials = opts.materials;

    const nodes = chunk.nodes;
    const n = nodes.length;
    let vertexCount = 0;
    let indexCount = 0;
    for (const node of nodes) {
      const g = node.geometry;
      const pos = g.getAttribute('position');
      vertexCount += pos.count;
      indexCount += g.index ? g.index.count : pos.count;
    }
    this.triangleCount = Math.round(indexCount / 3);
    // decodeGlb gives every node of a chunk the same attributes (BatchedMesh requires it).
    this.tissue = n > 0 && nodes[0]!.geometry.hasAttribute('tissue');
    this.kind = surfaceKind(opts.system, this.tissue);
    this.fibreEnds = opts.materials.needsFibreEnds(this.kind)
      ? createFibreEnds(nodes.map((node) => node.geometry.userData.fibre as number[] | undefined))
      : null;
    this.surfaces = opts.materials.surfaces(this.kind, this.fibreEnds ?? undefined);

    this.main = new BatchedMesh(
      Math.max(1, n),
      Math.max(1, vertexCount),
      Math.max(1, indexCount),
      this.surfaces.opaque,
    );
    this.main.name = `atlas:${chunk.file}`;
    this.ids = new Array<string>(n);
    this.known = new Uint8Array(n);
    this.baseColor = new Array<string>(n);
    this.geometryIdOf = new Int32Array(n);
    this.explodeVec = new Float32Array(n * 3);
    this.mode = new Uint8Array(n);
    this.alpha = new Float32Array(n).fill(1);
    this.pickable = new Uint8Array(n);
    this.tint = new Array<Tint>(n).fill('none');
    this.bvh = new Array<MeshBVH | null>(n).fill(null);

    nodes.forEach((node, i) => {
      const g = node.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (!g.boundingBox) g.computeBoundingBox();
      const geometryId = this.main.addGeometry(g);
      const instanceId = this.main.addInstance(geometryId);
      // Dense ids are an invariant the id maps rely on.
      if (instanceId !== i) throw new Error(`BatchedMesh instance id ${instanceId} ≠ node index ${i}`);
      this.geometryIdOf[i] = geometryId;
      const id = node.nodeName;
      this.ids[i] = id;
      this.instanceOf.set(id, i);
      const st = structures[id];
      this.known[i] = st ? 1 : 0;
      this.baseColor[i] = (st ? structureColor(st) : undefined) ?? opts.systemColor ?? FALLBACK_COLOR;
      const centroid: Vec3 = st?.centroid ?? [
        g.boundingSphere!.center.x,
        g.boundingSphere!.center.y,
        g.boundingSphere!.center.z,
      ];
      this.explodeVec.set(
        opts.explodeVectors.get(id) ?? explodeVector(centroid, opts.explodeCenter, EXPLODE_LOCAL),
        i * 3,
      );
      // Source geometry has been copied into the batch buffers; the viewer owns and frees it.
      g.dispose();
    });
    if (n > 0 && this.instanceOf.size !== n) {
      console.warn(`[viewer] duplicate node names in ${chunk.file}`);
    }

    this.prepass = createView(this.main, opts.materials.depthPrepass);
    this.prepass.name = `atlas:${chunk.file}:prepass`;
    // Depth-only pass: front-to-back is best for early-z (the default would sort a "transparent" material back-to-front).
    this.prepass.setCustomSort(function (list) {
      list.sort((a, b) => a.z - b.z);
    });
    this.ghost = createView(this.main, this.surfaces.transparent);
    this.ghost.name = `atlas:${chunk.file}:ghost`;

    for (const mesh of this.meshes) {
      // Instances are culled one by one (perObjectFrustumCulled); the whole-mesh bounding sphere would go stale
      // when exploding, so whole-mesh culling is off.
      mesh.frustumCulled = false;
      mesh.perObjectFrustumCulled = true;
      mesh.sortObjects = true;
      mesh.visible = false;
    }
    // Picking is done by AtlasScene.pick via our own BVHs; keep three's raycaster away from these meshes.
    for (const mesh of this.meshes) mesh.raycast = () => {};
  }

  get meshes(): BatchedMesh[] {
    return [this.main, this.prepass, this.ghost];
  }

  get size(): number {
    return this.ids.length;
  }

  /** Apply render states (from structureRender) to all instances and pick the pass materials. */
  applyRender(renderOf: (id: string, known: boolean) => StructureRender): void {
    let anyNormal = false;
    let anyGhost = false;
    let minAlpha = 1;
    for (let i = 0; i < this.ids.length; i++) {
      const r = renderOf(this.ids[i]!, this.known[i] === 1);
      const mode = r.mode === 'normal' ? MODE_NORMAL : r.mode === 'ghost' ? MODE_GHOST : MODE_HIDDEN;
      this.mode[i] = mode;
      this.alpha[i] = r.opacity;
      this.pickable[i] = mode === MODE_NORMAL && r.pickable && this.known[i] === 1 ? 1 : 0;
      this.main.setVisibleAt(i, mode === MODE_NORMAL);
      this.prepass.setVisibleAt(i, mode === MODE_NORMAL);
      this.ghost.setVisibleAt(i, mode === MODE_GHOST);
      if (mode === MODE_NORMAL) {
        anyNormal = true;
        minAlpha = Math.min(minAlpha, r.opacity);
      } else if (mode === MODE_GHOST) anyGhost = true;
    }
    this.anyNormal = anyNormal;
    this.anyGhost = anyGhost;
    this.transparent = anyNormal && minAlpha < 0.999;

    // Transparency order (ARCHITECTURE.md §5): opaque meshes go to three's opaque list (drawn first, outer
    // layers before inner ones for early-z). A transparent layer draws its depth pre-pass and then its colour pass; renderOrder by
    // layerOrder makes inner layers draw before outer ones (back-to-front for nested layers).
    const order = layerRenderOrder(this.layerOrder);
    this.main.visible = anyNormal;
    this.main.material = this.transparent ? this.surfaces.transparent : this.surfaces.opaque;
    this.main.renderOrder = this.transparent ? order.color : order.opaque;
    this.prepass.visible = this.transparent;
    this.prepass.renderOrder = order.prepass;
    this.ghost.visible = anyGhost;
    this.ghost.renderOrder = order.color;
    this.writeColors();
  }

  /** Apply highlight tints (selection, hover, quiz) and rewrite colours. */
  applyTints(tintOf: (id: string) => Tint): void {
    for (let i = 0; i < this.ids.length; i++) this.tint[i] = tintOf(this.ids[i]!);
    this.writeColors();
  }

  private writeColors(): void {
    for (let i = 0; i < this.ids.length; i++) {
      const mode = this.mode[i];
      const base = this.baseColor[i]!;
      const tint = this.tint[i]!;
      tintedColor(base, tint, false, _c);
      _v4.set(_c.r, _c.g, _c.b, mode === MODE_NORMAL ? this.alpha[i]! : 1);
      this.main.setColorAt(i, _v4);
      if (mode === MODE_GHOST) {
        tintedColor(base, tint, true, _c);
        _v4.set(_c.r, _c.g, _c.b, this.alpha[i]!);
        this.ghost.setColorAt(i, _v4);
      }
    }
  }

  /** Move every instance to its exploded position (explode 0..1). */
  setExplode(explode: number): void {
    this.explode = explode;
    for (let i = 0; i < this.ids.length; i++) {
      _m.makeTranslation(
        this.explodeVec[i * 3]! * explode,
        this.explodeVec[i * 3 + 1]! * explode,
        this.explodeVec[i * 3 + 2]! * explode,
      );
      this.main.setMatrixAt(i, _m);
      this.prepass.setMatrixAt(i, _m);
      this.ghost.setMatrixAt(i, _m);
    }
  }

  /** Current offset of an instance (world = body space + offset). */
  offsetAt(instanceId: number, explode = this.explode): Vec3 {
    const k = instanceId * 3;
    return [
      this.explodeVec[k]! * explode,
      this.explodeVec[k + 1]! * explode,
      this.explodeVec[k + 2]! * explode,
    ];
  }

  isVisible(instanceId: number): boolean {
    return this.mode[instanceId] === MODE_NORMAL;
  }

  isRendered(instanceId: number): boolean {
    return this.mode[instanceId] !== MODE_HIDDEN;
  }

  isPickable(instanceId: number): boolean {
    return this.pickable[instanceId] === 1;
  }

  /** Geometry-space bounding sphere of an instance (without offset). */
  boundingSphereAt(instanceId: number, target: Sphere): Sphere {
    this.main.getBoundingSphereAt(this.geometryIdOf[instanceId]!, target);
    return target;
  }

  /** BVH of one structure's triangles inside the shared batch geometry (built lazily). */
  bvhAt(instanceId: number): MeshBVH {
    let b = this.bvh[instanceId];
    if (!b) {
      const range = this.main.getGeometryRangeAt(this.geometryIdOf[instanceId]!);
      if (!range) throw new Error(`no geometry range for instance ${instanceId}`);
      // `range` restricts the BVH to this structure's slice of the index buffer. Without `indirect` the BVH
      // reorders triangles inside that slice only — same triangles, so rendering is unaffected.
      b = new MeshBVH(this.main.geometry, {
        range: { start: range.start, count: range.count },
        setBoundingBox: false,
      });
      this.bvh[instanceId] = b;
    }
    return b;
  }

  /** Build a few BVHs ahead of time (idle callback). Returns true when all are built. */
  buildBvhSlice(deadline: () => number): boolean {
    while (this.bvhCursor < this.ids.length) {
      if (deadline() < 2) return false;
      if (!this.disposed) this.bvhAt(this.bvhCursor);
      this.bvhCursor++;
    }
    return true;
  }

  /**
   * Nearest pickable hit along a world-space ray within [near, far]. Hidden, ghosted, transparent-below-5 %
   * and metadata-less structures are skipped (pickable flag from structureRender).
   */
  raycast(ray: Ray, near: number, far: number, side: Side): BatchHit | null {
    let best: BatchHit | null = null;
    let limit = far;
    for (let i = 0; i < this.ids.length; i++) {
      if (this.pickable[i] !== 1) continue;
      const k = i * 3;
      const ox = this.explodeVec[k]! * this.explode;
      const oy = this.explodeVec[k + 1]! * this.explode;
      const oz = this.explodeVec[k + 2]! * this.explode;
      this.boundingSphereAt(i, _sphere);
      _sphere.center.x += ox;
      _sphere.center.y += oy;
      _sphere.center.z += oz;
      if (!ray.intersectsSphere(_sphere)) continue;
      // Entry distance lower bound: skip spheres entirely beyond the current best hit.
      const centerDist = _p.copy(_sphere.center).sub(ray.origin).dot(ray.direction);
      if (centerDist - _sphere.radius > limit) continue;
      _ray.origin.set(ray.origin.x - ox, ray.origin.y - oy, ray.origin.z - oz);
      _ray.direction.copy(ray.direction);
      const hit = this.bvhAt(i).raycastFirst(_ray, side, near, limit);
      if (hit && hit.distance <= limit) {
        limit = hit.distance;
        best = {
          id: this.ids[i]!,
          instanceId: i,
          distance: hit.distance,
          point: [hit.point.x + ox, hit.point.y + oy, hit.point.z + oz],
        };
      }
    }
    return best;
  }

  /** Closest surface point of a structure to a body-space point (without explode offset). */
  closestSurfacePoint(instanceId: number, p: Readonly<Vec3>): Vec3 {
    const res = this.bvhAt(instanceId).closestPointToPoint(new Vector3(p[0], p[1], p[2]));
    if (!res) return [p[0], p[1], p[2]];
    return [res.point.x, res.point.y, res.point.z];
  }

  /** Union bbox (with current offsets) of rendered instances, or null. */
  renderedBounds(): BBox | null {
    let any = false;
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.ids.length; i++) {
      if (this.mode[i] === MODE_HIDDEN) continue;
      this.boundingSphereAt(i, _sphere);
      const o = this.offsetAt(i);
      any = true;
      for (let a = 0; a < 3; a++) {
        const c = _sphere.center.getComponent(a) + o[a]!;
        min[a] = Math.min(min[a]!, c - _sphere.radius);
        max[a] = Math.max(max[a]!, c + _sphere.radius);
      }
    }
    return any ? { min, max } : null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const view of [this.prepass, this.ghost]) {
      // Views share main's geometry: detach before dispose so it is freed exactly once (by main).
      view.geometry = new BufferGeometry();
      view.dispose();
      view.removeFromParent();
    }
    this.main.dispose();
    this.main.removeFromParent();
    this.materials.release(this.surfaces);
    this.fibreEnds?.dispose();
    this.bvh.fill(null);
  }
}
