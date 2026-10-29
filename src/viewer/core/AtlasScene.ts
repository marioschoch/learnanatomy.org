/**
 * Imperative scene manager: owns every ChunkBatch, the shared materials, the structure → (batch, instance) map,
 * clipping planes and the explode animation. React components feed it store state (SceneSync) and ask it for
 * picks, offsets and bounds. No React and no WebGL calls here, so it is unit tested in jsdom.
 */
import type { Ray } from 'three';
import { Group, Plane, Vector3 } from 'three';
import type { BBox, LoadedChunk, RegionInfo, Structure, SystemInfo, Vec3 } from '@/contract';
import { structureRender } from '@/state';
import type { VisibilityContext } from '@/state';
import { ChunkBatch } from './ChunkBatch';
import type { BatchHit } from './ChunkBatch';
import { clipRayInterval, isPointClipped } from './clipping';
import type { ClipPlaneSpec } from './clipping';
import type { Tint } from './colors';
import { bboxCenter, computeExplodeVectors, stepExplode } from './explode';
import { AtlasMaterials } from './materials';

export interface StructureLocation {
  batch: ChunkBatch;
  instanceId: number;
}

export class AtlasScene {
  readonly root = new Group();
  readonly materials = new AtlasMaterials();
  private readonly batches: ChunkBatch[] = [];
  private readonly locations = new Map<string, StructureLocation>();
  private clipSpecs: ClipPlaneSpec[] = [];
  private explodeCurrent = 0;
  private explodeTarget = 0;
  private disposed = false;

  constructor() {
    this.root.name = 'atlas-root';
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  get chunkFiles(): string[] {
    return this.batches.map((b) => b.file);
  }

  get allBatches(): readonly ChunkBatch[] {
    return this.batches;
  }

  get explode(): number {
    return this.explodeCurrent;
  }

  get clipping(): readonly ClipPlaneSpec[] {
    return this.clipSpecs;
  }

  hasChunk(file: string): boolean {
    return this.batches.some((b) => b.file === file);
  }

  /**
   * Build the BatchedMeshes for a loaded chunk. `systemStructures` (all structures of the system, from metadata)
   * define the explode centres, so every chunk of a split system explodes around the same points.
   */
  addChunk(
    system: SystemInfo,
    chunk: LoadedChunk,
    structures: Readonly<Record<string, Structure>>,
    systemStructures: readonly Structure[],
    regions: readonly RegionInfo[] = [],
  ): ChunkBatch {
    if (this.disposed) throw new Error('AtlasScene is disposed');
    const center = bboxCenter(systemStructures.map((s) => s.bbox)) ?? [0, 0, 0];
    const explodeVectors = computeExplodeVectors(systemStructures, regions);
    const batch = new ChunkBatch({
      chunk,
      system: system.id,
      layerOrder: system.layerOrder,
      structures,
      systemColor: system.color,
      explodeVectors,
      explodeCenter: center,
      materials: this.materials,
    });
    batch.setExplode(this.explodeCurrent);
    this.batches.push(batch);
    for (let i = 0; i < batch.size; i++) {
      const id = batch.ids[i]!;
      if (this.locations.has(id)) console.warn(`[viewer] structure ${id} occurs in more than one chunk`);
      else this.locations.set(id, { batch, instanceId: i });
    }
    for (const mesh of batch.meshes) this.root.add(mesh);
    return batch;
  }

  locate(id: string): StructureLocation | undefined {
    return this.locations.get(id);
  }

  /** Visibility, opacity and pickability for every instance, straight from visibility.ts. */
  applyVisibility(
    ctx: VisibilityContext,
    structures: Readonly<Record<string, Structure>>,
    batches: readonly ChunkBatch[] = this.batches,
  ): void {
    for (const batch of batches) {
      batch.applyRender((id) => structureRender(ctx, structures[id] ?? { id, system: batch.system }));
    }
  }

  applyTints(tints: ReadonlyMap<string, Tint>, batches: readonly ChunkBatch[] = this.batches): void {
    for (const batch of batches) batch.applyTints((id) => tints.get(id) ?? 'none');
  }

  setClipping(specs: ClipPlaneSpec[]): void {
    this.clipSpecs = specs;
    this.materials.setPlanes(specs.map((s) => new Plane(new Vector3(...s.normal), s.constant)));
  }

  setExplodeTarget(target: number, immediate: boolean): void {
    this.explodeTarget = target;
    if (immediate && this.explodeCurrent !== target) {
      this.explodeCurrent = target;
      for (const b of this.batches) b.setExplode(target);
    }
  }

  /** Advance the explode animation. Returns true while still animating (caller keeps invalidating). */
  tick(dt: number, reducedMotion: boolean): boolean {
    if (this.explodeCurrent === this.explodeTarget) return false;
    this.explodeCurrent = stepExplode(this.explodeCurrent, this.explodeTarget, dt, reducedMotion);
    for (const b of this.batches) b.setExplode(this.explodeCurrent);
    return this.explodeCurrent !== this.explodeTarget;
  }

  /** Current explode offset of a structure ([0,0,0] when it is not loaded). */
  offsetOf(id: string, atTarget = false): Vec3 {
    const loc = this.locations.get(id);
    if (!loc) return [0, 0, 0];
    return loc.batch.offsetAt(loc.instanceId, atTarget ? this.explodeTarget : this.explodeCurrent);
  }

  /** True when the structure is drawn in 'normal' mode (not hidden, not ghost). */
  isVisible(id: string): boolean {
    const loc = this.locations.get(id);
    return loc ? loc.batch.isVisible(loc.instanceId) : false;
  }

  isClipped(p: Readonly<Vec3>): boolean {
    return isPointClipped(this.clipSpecs, p);
  }

  /**
   * First pickable structure along a world-space ray, ignoring geometry on the clipped side of any plane.
   * Exploded positions are honoured (rays are shifted per instance).
   */
  pick(ray: Ray, near = 0, far = Infinity): BatchHit | null {
    const o: Vec3 = [ray.origin.x, ray.origin.y, ray.origin.z];
    const d: Vec3 = [ray.direction.x, ray.direction.y, ray.direction.z];
    const interval = clipRayInterval(this.clipSpecs, o, d, near, far);
    if (!interval) return null;
    let best: BatchHit | null = null;
    const side = this.materials.side;
    for (const batch of this.batches) {
      if (!batch.anyNormal) continue;
      const hit = batch.raycast(ray, interval[0], best ? best.distance : interval[1], side);
      if (hit && (!best || hit.distance < best.distance)) best = hit;
    }
    return best;
  }

  /** Closest surface point to `p` on a structure, in world space (with offset). */
  surfacePoint(id: string, p: Readonly<Vec3>): Vec3 | null {
    const loc = this.locations.get(id);
    if (!loc) return null;
    const o = loc.batch.offsetAt(loc.instanceId);
    const q = loc.batch.closestSurfacePoint(loc.instanceId, [p[0] - o[0], p[1] - o[1], p[2] - o[2]]);
    return [q[0] + o[0], q[1] + o[1], q[2] + o[2]];
  }

  /** Closest surface point in body space (assembled position, no explode offset). */
  bodySurfacePoint(id: string, p: Readonly<Vec3>): Vec3 | null {
    const loc = this.locations.get(id);
    return loc ? loc.batch.closestSurfacePoint(loc.instanceId, p) : null;
  }

  /** Union bbox of everything currently drawn (normal + ghost), with offsets. */
  renderedBounds(): BBox | null {
    let out: BBox | null = null;
    for (const b of this.batches) {
      const bb = b.renderedBounds();
      if (!bb) continue;
      if (!out) out = { min: [...bb.min], max: [...bb.max] };
      else
        for (let i = 0; i < 3; i++) {
          out.min[i] = Math.min(out.min[i]!, bb.min[i]!);
          out.max[i] = Math.max(out.max[i]!, bb.max[i]!);
        }
    }
    return out;
  }

  /** Spend idle time building picking BVHs. Returns true when everything is built. */
  buildBvhs(timeRemaining: () => number): boolean {
    for (const b of this.batches) if (!b.buildBvhSlice(timeRemaining)) return false;
    return true;
  }

  stats(): { batches: number; instances: number; triangles: number } {
    let instances = 0;
    let triangles = 0;
    for (const b of this.batches) {
      instances += b.size;
      triangles += b.triangleCount;
    }
    return { batches: this.batches.length, instances, triangles };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const b of this.batches) b.dispose();
    this.batches.length = 0;
    this.locations.clear();
    this.materials.dispose();
    this.root.clear();
  }
}
