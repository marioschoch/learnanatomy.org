import { describe, expect, it } from 'vitest';
import { ClickDetector } from './clickDetector';

describe('click vs drag', () => {
  it('a short, still press is a click', () => {
    const c = new ClickDetector();
    c.down(1, 100, 100, 0);
    expect(c.up(1, 102, 101, 120)).toBe(true);
  });

  it('dragging the camera is not a click, even when the pointer returns to its start', () => {
    const c = new ClickDetector();
    c.down(1, 100, 100, 0);
    expect(c.up(1, 140, 100, 200)).toBe(false);
    c.down(1, 100, 100, 0);
    c.move(1, 160, 120);
    expect(c.up(1, 100, 100, 300)).toBe(false);
  });

  it('a long press is not a click', () => {
    const c = new ClickDetector();
    c.down(1, 10, 10, 0);
    expect(c.up(1, 10, 10, 900)).toBe(false);
  });

  it('multi-touch gestures never select', () => {
    const c = new ClickDetector();
    c.down(1, 10, 10, 0);
    c.down(2, 200, 200, 10);
    expect(c.up(2, 200, 200, 50)).toBe(false);
    expect(c.up(1, 10, 10, 60)).toBe(false);
  });

  it('ignores ups without downs', () => {
    expect(new ClickDetector().up(7, 0, 0, 0)).toBe(false);
  });
});
