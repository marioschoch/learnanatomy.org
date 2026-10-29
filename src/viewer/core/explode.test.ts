import { describe, expect, it } from 'vitest';
import type { BBox, Vec3 } from '@/contract';
import {
  bboxCenter,
  computeExplodeVectors,
  explodeOffset,
  explodeVector,
  offsetBBox,
  specificRegion,
  stepExplode,
} from './explode';

const cube = (c: Vec3, h = 0.05): BBox => ({
  min: [c[0] - h, c[1] - h, c[2] - h],
  max: [c[0] + h, c[1] + h, c[2] + h],
});

describe('explode math', () => {
  it('centre is the centre of the union bbox', () => {
    expect(
      bboxCenter([
        { min: [-1, 0, 0], max: [0, 1, 1] },
        { min: [0, 2, -1], max: [3, 3, 0] },
      ]),
    ).toEqual([1, 1.5, 0]);
    expect(bboxCenter([])).toBeNull();
  });

  it('moves structures away from the centre along (centroid − centre)', () => {
    const v = explodeVector([0.2, 1.5, 0.1], [0, 1, 0], 1);
    expect(v[0]).toBeCloseTo(0.2);
    expect(v[1]).toBeCloseTo(0.5);
    expect(v[2]).toBeCloseTo(0.1);
    expect(explodeOffset(v, 0)).toEqual([0, 0, 0]);
    const half = explodeOffset(v, 0.5);
    expect(half[1]).toBeCloseTo(0.25);
    // A structure on the patient's left stays on the left (moves further +X).
    expect(explodeOffset(explodeVector([0.1, 1, 0], [0, 1, 0], 1), 1)[0]).toBeGreaterThan(0);
    // A structure at the centre does not move.
    expect(explodeVector([0, 1, 0], [0, 1, 0], 1)).toEqual([0, 0, 0]);
  });

  it('picks the most specific region (thorax over trunk, smallest member count otherwise)', () => {
    const parent = new Map<string, string | undefined>([
      ['thorax', 'trunk'],
      ['trunk', undefined],
      ['neck', undefined],
      ['back', 'trunk'],
    ]);
    const count = new Map([
      ['thorax', 10],
      ['trunk', 30],
      ['neck', 4],
      ['back', 8],
    ]);
    expect(specificRegion(['trunk', 'thorax'], parent, count)).toBe('thorax');
    expect(specificRegion(['neck', 'back'], parent, count)).toBe('neck');
    expect(specificRegion([], parent, count)).toBeNull();
  });

  it('two-level explode equals (centroid − system centre) × k when both factors are equal', () => {
    const structures = [
      { id: 'a', centroid: [0.1, 1.3, 0] as Vec3, bbox: cube([0.1, 1.3, 0]), regions: ['thorax'] },
      { id: 'b', centroid: [-0.1, 1.2, 0] as Vec3, bbox: cube([-0.1, 1.2, 0]), regions: ['thorax'] },
      { id: 'c', centroid: [0.1, 0.3, 0] as Vec3, bbox: cube([0.1, 0.3, 0]), regions: ['lower-limb'] },
      { id: 'd', centroid: [0, 0.8, 0] as Vec3, bbox: cube([0, 0.8, 0]), regions: [] },
    ];
    const center = bboxCenter(structures.map((s) => s.bbox))!;
    const same = computeExplodeVectors(structures, [], 0.7, 0.7);
    for (const s of structures) {
      const expected = explodeVector(s.centroid, center, 0.7);
      same.get(s.id)!.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!));
    }
    // Default factors: thorax members spread around the thorax centre, the region moves less than its members.
    const v = computeExplodeVectors(structures, []);
    expect(v.get('a')![0]).toBeGreaterThan(0); // patient's left stays left
    expect(v.get('b')![0]).toBeLessThan(0);
    expect(v.get('a')![1]).toBeGreaterThan(v.get('b')![1]); // upper member moves up relative to the lower one
    expect(v.get('c')![1]).toBeLessThan(0); // lower limb moves down
  });

  it('animates towards the target, frame-rate independent, and snaps at the end', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = stepExplode(a, 1, 1 / 60, false);
    let b = 0;
    for (let i = 0; i < 30; i++) b = stepExplode(b, 1, 1 / 30, false);
    expect(a).toBeCloseTo(b, 5);
    let t = 0;
    for (let i = 0; i < 600 && t !== 1; i++) t = stepExplode(t, 1, 1 / 60, false);
    expect(t).toBe(1);
    expect(stepExplode(0.2, 0.8, 0.016, true)).toBe(0.8);
  });

  it('shifts a bbox by an offset', () => {
    expect(offsetBBox({ min: [0, 0, 0], max: [1, 1, 1] }, [1, -1, 0.5])).toEqual({
      min: [1, -1, 0.5],
      max: [2, 0, 1.5],
    });
  });
});
