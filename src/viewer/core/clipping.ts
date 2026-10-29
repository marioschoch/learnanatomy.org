/**
 * Clipping / cross-section math (pure, unit tested).
 *
 * Anatomical planes in body space (ARCHITECTURE.md §2, §5):
 *   sagittal   ⟂ x  (left / right)      position across bodyBounds.x
 *   transverse ⟂ y  (superior / inferior) position across bodyBounds.y
 *   coronal    ⟂ z  (anterior / posterior) position across bodyBounds.z
 *
 * A plane is stored like three.js `Plane`: normal · p + constant. three.js keeps a fragment when that value is
 * ≥ 0 for every plane (clipIntersection = false) and discards it otherwise, so
 *   flipped = false → normal = +axis, constant = −pos → keeps the part with the LARGER coordinate
 *                     (removes the patient's right / posterior / inferior part, as the store contract says)
 *   flipped = true  → normal = −axis, constant = +pos → keeps the other part.
 */
import type { BBox, ClipPlaneState, PlaneAxis, Vec3 } from '@/contract';

export const PLANE_AXES: readonly PlaneAxis[] = ['sagittal', 'coronal', 'transverse'];

/** Component index of the coordinate a plane cuts across. */
export const AXIS_INDEX: Record<PlaneAxis, 0 | 1 | 2> = { sagittal: 0, transverse: 1, coronal: 2 };

export interface ClipPlaneSpec {
  axis: PlaneAxis;
  normal: Vec3;
  constant: number;
}

/** Plane position in metres along its axis: bodyBounds.min + position × size. */
export function planeCoordinate(axis: PlaneAxis, position: number, bounds: BBox): number {
  const i = AXIS_INDEX[axis];
  const min = bounds.min[i]!;
  const max = bounds.max[i]!;
  const t = Math.min(1, Math.max(0, Number.isFinite(position) ? position : 0.5));
  return min + t * (max - min);
}

/** Enabled planes as (normal, constant) in body space, in a stable order (sagittal, coronal, transverse). */
export function clipPlaneSpecs(
  clipping: Record<PlaneAxis, ClipPlaneState>,
  bounds: BBox | null | undefined,
): ClipPlaneSpec[] {
  if (!bounds) return [];
  const out: ClipPlaneSpec[] = [];
  for (const axis of PLANE_AXES) {
    const c = clipping[axis];
    if (!c?.enabled) continue;
    const i = AXIS_INDEX[axis];
    const coord = planeCoordinate(axis, c.position, bounds);
    const normal: Vec3 = [0, 0, 0];
    normal[i] = c.flipped ? -1 : 1;
    out.push({ axis, normal, constant: c.flipped ? coord : -coord });
  }
  return out;
}

/** Signed distance of a point to a plane (≥ 0 = kept side). */
export function planeDistance(spec: ClipPlaneSpec, p: Readonly<Vec3>): number {
  return spec.normal[0] * p[0] + spec.normal[1] * p[1] + spec.normal[2] * p[2] + spec.constant;
}

/** True when the point is removed by at least one enabled plane. `epsilon` tolerates points on the cut. */
export function isPointClipped(specs: readonly ClipPlaneSpec[], p: Readonly<Vec3>, epsilon = 1e-6): boolean {
  for (const s of specs) if (planeDistance(s, p) < -epsilon) return true;
  return false;
}

/**
 * Interval [tNear, tFar] of the ray o + t·d (t ≥ near) that lies on the kept side of all planes, or null when the
 * whole ray is clipped away. The kept region is an intersection of half-spaces (convex), so the kept part of a ray
 * is always one interval. Picking raycasts only inside it, so hits on clipped-away geometry are skipped and the
 * first visible surface (often a cut back face) is found.
 */
export function clipRayInterval(
  specs: readonly ClipPlaneSpec[],
  origin: Readonly<Vec3>,
  dir: Readonly<Vec3>,
  near = 0,
  far = Infinity,
): [number, number] | null {
  let t0 = near;
  let t1 = far;
  for (const s of specs) {
    const dist = planeDistance(s, origin);
    const nd = s.normal[0] * dir[0] + s.normal[1] * dir[1] + s.normal[2] * dir[2];
    if (Math.abs(nd) < 1e-12) {
      if (dist < 0) return null; // parallel and entirely on the removed side
      continue;
    }
    const t = -dist / nd;
    if (nd > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}
