/**
 * Exploded-view math (pure, unit tested).
 *
 * Two-level explode ("away from the centre of its region/system", PROMPT brief B7):
 *   offset = [ (centroid − regionCentre) × EXPLODE_LOCAL + (regionCentre − systemCentre) × EXPLODE_GLOBAL ] × explode
 * regionCentre = bbox centre of the system's structures in the structure's most specific region (thorax rather
 * than trunk, hand rather than upper limb); structures without a region use the system centre.
 * With EXPLODE_LOCAL === EXPLODE_GLOBAL this is exactly ARCHITECTURE.md §5's (centroid − system centre) × k;
 * the smaller global factor keeps regions together (an exploded thorax spreads its ribs instead of flying off).
 *
 * The offset is applied as a pure translation in the BatchedMesh instance matrix (setMatrixAt). Instance matrices
 * never contain rotation or scale, which lets picking shift the ray instead of inverting matrices and keeps
 * distances identical in local and world space.
 */
import type { BBox, RegionInfo, Vec3 } from '@/contract';

/** Spread of structures around their region centre at explode = 1. */
export const EXPLODE_LOCAL = 0.9;
/** Spread of region centres around the system centre at explode = 1. */
export const EXPLODE_GLOBAL = 0.35;

/** Approach rate of the explode animation (1/s). ~0.4 s to settle. */
export const EXPLODE_RATE = 9;

/** Centre of the union of the given bounding boxes (null when empty). */
export function bboxCenter(boxes: Iterable<BBox>): Vec3 | null {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  let any = false;
  for (const b of boxes) {
    any = true;
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, b.min[i]!);
      max[i] = Math.max(max[i]!, b.max[i]!);
    }
  }
  if (!any) return null;
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
}

/** Single-level offset at explode = 1: (centroid − centre) × scale. */
export function explodeVector(centroid: Readonly<Vec3>, center: Readonly<Vec3>, scale: number): Vec3 {
  return [
    (centroid[0] - center[0]) * scale,
    (centroid[1] - center[1]) * scale,
    (centroid[2] - center[2]) * scale,
  ];
}

export interface ExplodeInput {
  id: string;
  centroid: Vec3;
  bbox: BBox;
  regions: readonly string[];
}

/**
 * Most specific of a structure's regions: drop every region that is an ancestor of another listed region, then
 * prefer the region with the fewest members in this system.
 */
export function specificRegion(
  regions: readonly string[],
  parentOf: ReadonlyMap<string, string | undefined>,
  memberCount: ReadonlyMap<string, number>,
): string | null {
  const ancestors = new Set<string>();
  for (const r of regions) {
    let p = parentOf.get(r);
    for (let guard = 0; p && guard < 16; guard++) {
      ancestors.add(p);
      p = parentOf.get(p);
    }
  }
  let best: string | null = null;
  for (const r of regions) {
    if (ancestors.has(r)) continue;
    if (best === null || (memberCount.get(r) ?? Infinity) < (memberCount.get(best) ?? Infinity)) best = r;
  }
  return best;
}

/** Explode vectors (offset at explode = 1) for all structures of one system. */
export function computeExplodeVectors(
  structures: readonly ExplodeInput[],
  regionInfo: readonly Pick<RegionInfo, 'id' | 'parentId'>[],
  local = EXPLODE_LOCAL,
  global = EXPLODE_GLOBAL,
): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  const systemCenter = bboxCenter(structures.map((s) => s.bbox));
  if (!systemCenter) return out;
  const parentOf = new Map(regionInfo.map((r) => [r.id, r.parentId]));
  const members = new Map<string, BBox[]>();
  for (const s of structures)
    for (const r of s.regions) {
      let list = members.get(r);
      if (!list) members.set(r, (list = []));
      list.push(s.bbox);
    }
  const count = new Map([...members].map(([r, l]) => [r, l.length]));
  const centers = new Map<string, Vec3>();
  for (const [r, boxes] of members) centers.set(r, bboxCenter(boxes)!);
  for (const s of structures) {
    const region = specificRegion(s.regions, parentOf, count);
    const rc = (region && centers.get(region)) || systemCenter;
    const a = explodeVector(s.centroid, rc, local);
    const b = explodeVector(rc, systemCenter, global);
    out.set(s.id, [a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
  }
  return out;
}

/** Offset at a given explode amount (0..1). */
export function explodeOffset(vector: Readonly<Vec3>, explode: number): Vec3 {
  return [vector[0] * explode, vector[1] * explode, vector[2] * explode];
}

/**
 * One animation step from `current` towards `target` (frame-rate independent exponential approach).
 * Snaps when close, and jumps immediately with reduced motion.
 */
export function stepExplode(current: number, target: number, dt: number, reducedMotion: boolean): number {
  if (reducedMotion) return target;
  const k = 1 - Math.exp(-EXPLODE_RATE * Math.max(0, Math.min(dt, 0.1)));
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 1e-4 ? target : next;
}

/** Shift a bbox by an offset (used to focus/label exploded structures at their moved position). */
export function offsetBBox(b: BBox, o: Readonly<Vec3>): BBox {
  return {
    min: [b.min[0] + o[0], b.min[1] + o[1], b.min[2] + o[2]],
    max: [b.max[0] + o[0], b.max[1] + o[1], b.max[2] + o[2]],
  };
}
