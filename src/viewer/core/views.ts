/**
 * Standard anatomical views (pure, unit tested). ARCHITECTURE.md §2:
 *
 *   view       camera at   screen-up
 *   anterior   +Z          +Y        → patient's left (+X) is on the screen's RIGHT
 *   posterior  −Z          +Y
 *   left       +X          +Y        (patient's left lateral)
 *   right      −X          +Y        (patient's right lateral)
 *   superior   +Y          +Z        (anterior at the top of the screen)
 *   inferior   −Y          +Z        (anterior at the top; patient's left on screen right, like axial CT)
 *
 * CameraControls orbits around world +Y, so the superior/inferior views sit at the poles where the screen-up is
 * decided by the azimuth: a camera directly above the target with a tiny tilt towards −Z has +Z as screen-up;
 * below the target the tilt must go towards +Z. POLE_TILT is that tilt (radians, invisible on screen).
 */
import type { StandardView, Vec3 } from '@/contract';

export const POLE_TILT = 1e-3;

/** Unit vector from the target to the camera for a view. */
export function viewDirection(view: StandardView): Vec3 {
  switch (view) {
    case 'anterior':
      return [0, 0, 1];
    case 'posterior':
      return [0, 0, -1];
    case 'left':
      return [1, 0, 0];
    case 'right':
      return [-1, 0, 0];
    case 'superior':
      return [0, Math.cos(POLE_TILT), -Math.sin(POLE_TILT)];
    case 'inferior':
      return [0, -Math.cos(POLE_TILT), Math.sin(POLE_TILT)];
  }
}

/** Camera position for a view at a distance from the target. */
export function viewPosition(view: StandardView, target: Readonly<Vec3>, distance: number): Vec3 {
  const d = viewDirection(view);
  return [target[0] + d[0] * distance, target[1] + d[1] * distance, target[2] + d[2] * distance];
}

/**
 * Screen axes of a camera at `position` looking at `target` with world up +Y (what three.js `lookAt` does):
 * right = forward × up', up' = world-up made orthogonal to forward. Used by tests to prove the
 * orientation table above and by the orientation gizmo.
 */
export function screenAxes(position: Readonly<Vec3>, target: Readonly<Vec3>): { right: Vec3; up: Vec3 } {
  const f = normalize([target[0] - position[0], target[1] - position[1], target[2] - position[2]]);
  const right = normalize(cross(f, [0, 1, 0]));
  const up = cross(right, f);
  return { right, up };
}

export function cross(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function normalize(v: Readonly<Vec3>): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Orientation gizmo axes: patient-relative letters on body axes (ARCHITECTURE.md §2). */
export const GIZMO_AXES: readonly { letter: string; dir: Vec3; view: StandardView }[] = [
  { letter: 'L', dir: [1, 0, 0], view: 'left' },
  { letter: 'R', dir: [-1, 0, 0], view: 'right' },
  { letter: 'S', dir: [0, 1, 0], view: 'superior' },
  { letter: 'I', dir: [0, -1, 0], view: 'inferior' },
  { letter: 'A', dir: [0, 0, 1], view: 'anterior' },
  { letter: 'P', dir: [0, 0, -1], view: 'posterior' },
];
