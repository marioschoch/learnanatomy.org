// Geometry helpers on gltf-transform primitives: stats in world (body) space and careful simplification.
import { compactPrimitive } from '@gltf-transform/functions';

function transformPoint(m, x, y, z, out) {
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

export function det3(m) {
  return (
    m[0] * (m[5] * m[10] - m[9] * m[6]) -
    m[4] * (m[1] * m[10] - m[9] * m[2]) +
    m[8] * (m[1] * m[6] - m[5] * m[2])
  );
}

/**
 * World-space stats of a node's primitives: triangles, vertex centroid (mean of unique positions),
 * bbox, vertex count. `matrix` = node world matrix (column-major mat4).
 */
export function nodeStats(node) {
  const mesh = node.getMesh();
  const m = node.getWorldMatrix();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const sum = [0, 0, 0];
  let unique = 0;
  let triangles = 0;
  let vertices = 0;
  const el = [0, 0, 0];
  const w = [0, 0, 0];
  for (const prim of mesh?.listPrimitives() ?? []) {
    const pos = prim.getAttribute('POSITION');
    const idx = prim.getIndices();
    triangles += (idx ? idx.getCount() : pos.getCount()) / 3;
    vertices += pos.getCount();
    const seen = new Set();
    const arr = pos.getArray();
    for (let i = 0; i < pos.getCount(); i++) {
      const key = `${arr[i * 3]},${arr[i * 3 + 1]},${arr[i * 3 + 2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pos.getElement(i, el);
      transformPoint(m, el[0], el[1], el[2], w);
      for (let k = 0; k < 3; k++) {
        sum[k] += w[k];
        if (w[k] < min[k]) min[k] = w[k];
        if (w[k] > max[k]) max[k] = w[k];
      }
      unique++;
    }
  }
  const centroid = unique ? sum.map((v) => v / unique) : [0, 0, 0];
  return { triangles, vertices, uniqueVertices: unique, centroid, bbox: { min, max } };
}

export function round6(v) {
  return Math.round(v * 1e6) / 1e6;
}

export function roundVec(v) {
  return v.map(round6);
}

/**
 * Simplify one triangle primitive with meshoptimizer in absolute units (metres), keeping borders locked so
 * that adjacent patches (skin regions, split organs) stay watertight against each other. No pruning: small
 * disconnected parts survive. The result is rejected (original kept) when the bounding box moves by more
 * than 2 × error or when too few triangles would remain.
 * Returns { before, after, applied, reason? }.
 */
export function simplifyPrimitiveAbsolute(prim, simplifier, { error, minTriangles = 64, minKeepRatio = 0 }) {
  const pos = prim.getAttribute('POSITION');
  const idxAcc = prim.getIndices();
  const before = idxAcc.getCount() / 3;
  if (before < minTriangles) return { before, after: before, applied: false, reason: 'small' };
  const positions =
    pos.getArray() instanceof Float32Array ? pos.getArray() : new Float32Array(pos.getArray());
  const indices = new Uint32Array(idxAcc.getArray());
  const [dst] = simplifier.simplify(indices, positions, 3, 0, error, ['ErrorAbsolute', 'LockBorder']);
  const after = dst.length / 3;
  if (after === 0) return { before, after: before, applied: false, reason: 'empty' };
  if (after / before < minKeepRatio) return { before, after: before, applied: false, reason: 'ratio' };
  // bbox guard
  const bb = (ix) => {
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < ix.length; i++) {
      const v = ix[i] * 3;
      for (let k = 0; k < 3; k++) {
        const c = positions[v + k];
        if (c < mn[k]) mn[k] = c;
        if (c > mx[k]) mx[k] = c;
      }
    }
    return [mn, mx];
  };
  const [a0, a1] = bb(indices);
  const [b0, b1] = bb(dst);
  for (let k = 0; k < 3; k++) {
    if (Math.abs(a0[k] - b0[k]) > 2 * error || Math.abs(a1[k] - b1[k]) > 2 * error) {
      return { before, after: before, applied: false, reason: 'bbox' };
    }
  }
  idxAcc.setArray(dst);
  compactPrimitive(prim);
  return { before, after, applied: after < before };
}

/**
 * Fraction of triangle area whose winding (counter-clockwise = front) agrees with the stored vertex normals.
 * ≈ 1 for consistently wound, outward-facing meshes; ≈ 0 when the winding is inverted (e.g. a mirrored
 * instance baked without flipping).
 */
export function windingAgreement(node) {
  let agree = 0;
  let total = 0;
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const c = [0, 0, 0];
  const na = [0, 0, 0];
  const nb = [0, 0, 0];
  const nc = [0, 0, 0];
  for (const prim of node.getMesh()?.listPrimitives() ?? []) {
    const pos = prim.getAttribute('POSITION');
    const nrm = prim.getAttribute('NORMAL');
    const idx = prim.getIndices();
    if (!pos || !nrm || !idx) continue;
    const ix = idx.getArray();
    for (let t = 0; t < ix.length; t += 3) {
      pos.getElement(ix[t], a);
      pos.getElement(ix[t + 1], b);
      pos.getElement(ix[t + 2], c);
      const e1x = b[0] - a[0],
        e1y = b[1] - a[1],
        e1z = b[2] - a[2];
      const e2x = c[0] - a[0],
        e2y = c[1] - a[1],
        e2z = c[2] - a[2];
      const gx = e1y * e2z - e1z * e2y;
      const gy = e1z * e2x - e1x * e2z;
      const gz = e1x * e2y - e1y * e2x;
      const area = Math.hypot(gx, gy, gz);
      if (area === 0) continue;
      nrm.getElement(ix[t], na);
      nrm.getElement(ix[t + 1], nb);
      nrm.getElement(ix[t + 2], nc);
      const d = gx * (na[0] + nb[0] + nc[0]) + gy * (na[1] + nb[1] + nc[1]) + gz * (na[2] + nb[2] + nc[2]);
      total += area;
      if (d > 0) agree += area;
    }
  }
  return total ? agree / total : 1;
}
