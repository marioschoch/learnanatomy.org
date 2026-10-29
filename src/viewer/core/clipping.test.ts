import { describe, expect, it } from 'vitest';
import { Plane, Vector3 } from 'three';
import type { BBox, ClipPlaneState, PlaneAxis } from '@/contract';
import { clipPlaneSpecs, clipRayInterval, isPointClipped, planeCoordinate } from './clipping';

const bounds: BBox = { min: [-0.3, 0, -0.15], max: [0.3, 1.7, 0.15] };
const off: ClipPlaneState = { enabled: false, position: 0.5, flipped: false };
const clip = (patch: Partial<Record<PlaneAxis, Partial<ClipPlaneState>>>) => ({
  sagittal: { ...off, ...patch.sagittal },
  coronal: { ...off, ...patch.coronal },
  transverse: { ...off, ...patch.transverse },
});

describe('clipping planes', () => {
  it('maps position 0..1 across bodyBounds on the right axis', () => {
    expect(planeCoordinate('sagittal', 0, bounds)).toBeCloseTo(-0.3);
    expect(planeCoordinate('sagittal', 0.5, bounds)).toBeCloseTo(0);
    expect(planeCoordinate('transverse', 1, bounds)).toBeCloseTo(1.7);
    expect(planeCoordinate('coronal', 0.25, bounds)).toBeCloseTo(-0.075);
  });

  it('produces no planes when none is enabled or bounds are missing', () => {
    expect(clipPlaneSpecs(clip({}), bounds)).toEqual([]);
    expect(clipPlaneSpecs(clip({ sagittal: { enabled: true } }), null)).toEqual([]);
  });

  it('unflipped sagittal plane removes the patient’s right (−X) and keeps the left (+X)', () => {
    const specs = clipPlaneSpecs(clip({ sagittal: { enabled: true } }), bounds);
    expect(specs).toHaveLength(1);
    expect(isPointClipped(specs, [-0.1, 1, 0])).toBe(true); // right side
    expect(isPointClipped(specs, [0.1, 1, 0])).toBe(false); // left side
  });

  it('unflipped coronal removes posterior, transverse removes inferior; flip keeps the other part', () => {
    const coronal = clipPlaneSpecs(clip({ coronal: { enabled: true } }), bounds);
    expect(isPointClipped(coronal, [0, 1, -0.05])).toBe(true);
    expect(isPointClipped(coronal, [0, 1, 0.05])).toBe(false);
    const transverse = clipPlaneSpecs(clip({ transverse: { enabled: true, position: 0.5 } }), bounds);
    expect(isPointClipped(transverse, [0, 0.5, 0])).toBe(true);
    expect(isPointClipped(transverse, [0, 1.2, 0])).toBe(false);
    const flipped = clipPlaneSpecs(clip({ transverse: { enabled: true, flipped: true } }), bounds);
    expect(isPointClipped(flipped, [0, 0.5, 0])).toBe(false);
    expect(isPointClipped(flipped, [0, 1.2, 0])).toBe(true);
  });

  it('matches three.js Plane semantics (kept side has distance ≥ 0)', () => {
    const [spec] = clipPlaneSpecs(
      clip({ coronal: { enabled: true, position: 0.75, flipped: true } }),
      bounds,
    );
    const plane = new Plane(new Vector3(...spec!.normal), spec!.constant);
    for (const z of [-0.1, 0, 0.07, 0.1]) {
      const p = new Vector3(0, 1, z);
      expect(plane.distanceToPoint(p) < 0).toBe(isPointClipped([spec!], [0, 1, z]));
    }
  });

  it('several planes keep only the intersection of their kept sides', () => {
    const specs = clipPlaneSpecs(
      clip({ sagittal: { enabled: true }, transverse: { enabled: true } }),
      bounds,
    );
    expect(isPointClipped(specs, [0.1, 1.2, 0])).toBe(false);
    expect(isPointClipped(specs, [-0.1, 1.2, 0])).toBe(true);
    expect(isPointClipped(specs, [0.1, 0.4, 0])).toBe(true);
  });

  it('clips a ray to the kept interval', () => {
    const specs = clipPlaneSpecs(clip({ sagittal: { enabled: true } }), bounds); // keep x ≥ 0
    // Ray from the patient's right going left (+X): enters the kept side at x = 0.
    expect(clipRayInterval(specs, [-1, 1, 0], [1, 0, 0])).toEqual([1, Infinity]);
    // Ray going right (−X) from x = 0.5: leaves the kept side at x = 0.
    expect(clipRayInterval(specs, [0.5, 1, 0], [-1, 0, 0])).toEqual([0, 0.5]);
    // Parallel ray on the removed side: nothing visible.
    expect(clipRayInterval(specs, [-0.2, 1, 5], [0, 0, -1])).toBeNull();
    // No planes: untouched.
    expect(clipRayInterval([], [0, 0, 0], [0, 0, 1], 0.1, 10)).toEqual([0.1, 10]);
  });
});
