import { describe, expect, it } from 'vitest';
import { layoutLabels } from './labelLayout';

const box = (key: string, x: number, y: number) => ({ key, x, y, width: 120, height: 24 });

function intersects(a: number[], b: number[]) {
  return a[0]! < b[2]! && a[2]! > b[0]! && a[1]! < b[3]! && a[3]! > b[1]!;
}

describe('label layout', () => {
  it('pushes labels outwards from the screen centre', () => {
    const [l, r] = layoutLabels([box('a', 100, 300), box('b', 900, 300)], 1000);
    expect(l!.side).toBe('left');
    expect(l!.box[2]).toBeLessThan(100);
    expect(r!.side).toBe('right');
    expect(r!.box[0]).toBeGreaterThan(900);
  });

  it('separates labels whose anchors are close together', () => {
    const labels = [box('a', 800, 300), box('b', 805, 304), box('c', 798, 296), box('d', 810, 310)];
    const placed = layoutLabels(labels, 1000);
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++)
        expect(intersects(placed[i]!.box, placed[j]!.box)).toBe(false);
  });

  it('keeps the first (selected) label at its default spot', () => {
    const [first] = layoutLabels([box('sel', 700, 400), box('pin', 700, 400)], 1000);
    expect(first!.key).toBe('sel');
    expect(first!.dy).toBe(-28);
  });
});
