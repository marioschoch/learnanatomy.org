import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { STANDARD_VIEWS } from '@/contract';
import type { StandardView, Vec3 } from '@/contract';
import { GIZMO_AXES, screenAxes, viewPosition } from './views';

const target: Vec3 = [0, 1, 0];

/** Screen right/up of a real three.js camera placed for a view (what the user actually sees). */
function threeScreen(view: StandardView) {
  const cam = new PerspectiveCamera();
  cam.position.set(...viewPosition(view, target, 3));
  cam.up.set(0, 1, 0);
  cam.lookAt(new Vector3(...target));
  cam.updateMatrixWorld();
  const right = new Vector3(1, 0, 0).transformDirection(cam.matrixWorld);
  const up = new Vector3(0, 1, 0).transformDirection(cam.matrixWorld);
  return { right, up };
}

describe('standard views (critical: left/right)', () => {
  it('anterior view: patient’s left (+X) on the screen’s right, superior up', () => {
    const { right, up } = threeScreen('anterior');
    expect(right.x).toBeCloseTo(1);
    expect(up.y).toBeCloseTo(1);
  });

  it('posterior view: patient’s left on the screen’s left', () => {
    expect(threeScreen('posterior').right.x).toBeCloseTo(-1);
  });

  it('left lateral view looks at the left side (camera at +X), anterior on the screen’s left', () => {
    expect(viewPosition('left', target, 3)[0]).toBeGreaterThan(0);
    expect(threeScreen('left').right.z).toBeCloseTo(-1);
    expect(viewPosition('right', target, 3)[0]).toBeLessThan(0);
    expect(threeScreen('right').right.z).toBeCloseTo(1);
  });

  it('superior and inferior views have anterior (+Z) at the top of the screen', () => {
    const sup = threeScreen('superior');
    expect(viewPosition('superior', target, 3)[1]).toBeGreaterThan(target[1] + 2.9);
    expect(sup.up.z).toBeCloseTo(1, 2);
    const inf = threeScreen('inferior');
    expect(viewPosition('inferior', target, 3)[1]).toBeLessThan(target[1] - 2.9);
    expect(inf.up.z).toBeCloseTo(1, 2);
    // Inferior view like axial CT: patient's left on the screen's right.
    expect(inf.right.x).toBeCloseTo(1, 2);
    expect(sup.right.x).toBeCloseTo(-1, 2);
  });

  it('screenAxes matches three.js lookAt for every view', () => {
    for (const view of STANDARD_VIEWS) {
      const a = screenAxes(viewPosition(view, target, 3), target);
      const b = threeScreen(view);
      expect(a.right[0]).toBeCloseTo(b.right.x, 4);
      expect(a.right[2]).toBeCloseTo(b.right.z, 4);
      expect(a.up[1]).toBeCloseTo(b.up.y, 4);
      expect(a.up[2]).toBeCloseTo(b.up.z, 4);
    }
  });

  it('gizmo letters are patient-relative: L = +X, R = −X, A = +Z, P = −Z, S = +Y, I = −Y', () => {
    const byLetter = Object.fromEntries(GIZMO_AXES.map((a) => [a.letter, a]));
    expect(byLetter.L!.dir).toEqual([1, 0, 0]);
    expect(byLetter.R!.dir).toEqual([-1, 0, 0]);
    expect(byLetter.A!.dir).toEqual([0, 0, 1]);
    expect(byLetter.P!.dir).toEqual([0, 0, -1]);
    expect(byLetter.S!.dir).toEqual([0, 1, 0]);
    expect(byLetter.I!.dir).toEqual([0, -1, 0]);
    // Clicking a letter looks from that side.
    for (const a of GIZMO_AXES) {
      const p = viewPosition(a.view, [0, 0, 0], 1);
      expect(p[0] * a.dir[0] + p[1] * a.dir[1] + p[2] * a.dir[2]).toBeGreaterThan(0.99);
    }
  });
});
