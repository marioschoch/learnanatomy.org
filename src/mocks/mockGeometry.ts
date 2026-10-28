/**
 * Builds BufferGeometries for the mock structures, baked into normalized body space (identity transform),
 * with the same attribute layout the pipeline GLBs use: indexed, `position` + `normal`, no uv.
 */
import { BoxGeometry, CapsuleGeometry, SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';
import type { MockStructureSpec } from './mockData';

export function buildMockGeometry(spec: MockStructureSpec): BufferGeometry {
  const s = spec.shape;
  let g: BufferGeometry;
  if (s.kind === 'box') {
    g = new BoxGeometry(s.size[0], s.size[1], s.size[2]);
  } else if (s.kind === 'sphere') {
    g = new SphereGeometry(s.radius, 32, 20);
    if (s.scale) g.scale(s.scale[0], s.scale[1], s.scale[2]);
  } else {
    g = new CapsuleGeometry(s.radius, s.length, 6, 20);
    if (s.axis === 'x') g.rotateZ(Math.PI / 2);
    if (s.axis === 'z') g.rotateX(Math.PI / 2);
  }
  g.translate(spec.center[0], spec.center[1], spec.center[2]);
  g.deleteAttribute('uv');
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
