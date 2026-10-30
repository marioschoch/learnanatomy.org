/**
 * The small tileable 3D noise texture behind the surface detail of the tissue look (bone pores, muscle fibres,
 * spongy bone; materials.ts). 32³ RGBA8 = 128 kB, generated once (a few ms), repeat-wrapped and mipmapped, so
 * far-away detail averages out instead of shimmering. `CELLS` noise cells per repeat in every channel:
 *   R, G  gradient noise (two seeds), mean 0.5
 *   B     cellular noise F1: distance to the nearest of one random point per cell, in cells (clamped to 1)
 *   A     cellular F2 − F1: small along the borders between cells (walls)
 */
import {
  Data3DTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
} from 'three';

export const NOISE_SIZE = 32;
export const CELLS = 8;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wrap = (i: number) => ((i % CELLS) + CELLS) % CELLS;
const cell = (x: number, y: number, z: number) => (wrap(x) * CELLS + wrap(y)) * CELLS + wrap(z);
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Tileable gradient noise at every texel (lattice units), normalized to mean 0.5, sd 0.17. */
function gradientNoise(random: () => number): Float32Array {
  const g = new Float32Array(CELLS ** 3 * 3);
  for (let i = 0; i < CELLS ** 3; i++) {
    const z = random() * 2 - 1;
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    g.set([r * Math.cos(a), r * Math.sin(a), z], i * 3);
  }
  const s = NOISE_SIZE / CELLS;
  const out = new Float32Array(NOISE_SIZE ** 3);
  let k = 0;
  let sum = 0;
  let sum2 = 0;
  for (let x = 0; x < NOISE_SIZE; x++) {
    for (let y = 0; y < NOISE_SIZE; y++) {
      for (let z = 0; z < NOISE_SIZE; z++) {
        const px = (x + 0.5) / s;
        const py = (y + 0.5) / s;
        const pz = (z + 0.5) / s;
        const ix = Math.floor(px);
        const iy = Math.floor(py);
        const iz = Math.floor(pz);
        const fx = px - ix;
        const fy = py - iy;
        const fz = pz - iz;
        let v = 0;
        for (let c = 0; c < 8; c++) {
          const dx = c & 1;
          const dy = (c >> 1) & 1;
          const dz = (c >> 2) & 1;
          const gi = cell(ix + dx, iy + dy, iz + dz) * 3;
          const dot = g[gi]! * (fx - dx) + g[gi + 1]! * (fy - dy) + g[gi + 2]! * (fz - dz);
          const w =
            (dx ? fade(fx) : 1 - fade(fx)) * (dy ? fade(fy) : 1 - fade(fy)) * (dz ? fade(fz) : 1 - fade(fz));
          v += w * dot;
        }
        out[k++] = v;
        sum += v;
        sum2 += v * v;
      }
    }
  }
  const mean = sum / out.length;
  const sd = Math.sqrt(sum2 / out.length - mean * mean) || 1;
  for (let i = 0; i < out.length; i++) out[i] = 0.5 + ((out[i]! - mean) / sd) * 0.17;
  return out;
}

/** Tileable cellular noise: [F1, F2 − F1] per texel, in cells. */
function cellularNoise(random: () => number): [Float32Array, Float32Array] {
  const pts = new Float32Array(CELLS ** 3 * 3);
  for (let i = 0; i < pts.length; i++) pts[i] = random();
  const s = NOISE_SIZE / CELLS;
  const f1 = new Float32Array(NOISE_SIZE ** 3);
  const f2 = new Float32Array(NOISE_SIZE ** 3);
  let k = 0;
  for (let x = 0; x < NOISE_SIZE; x++) {
    for (let y = 0; y < NOISE_SIZE; y++) {
      for (let z = 0; z < NOISE_SIZE; z++) {
        const px = (x + 0.5) / s;
        const py = (y + 0.5) / s;
        const pz = (z + 0.5) / s;
        const ix = Math.floor(px);
        const iy = Math.floor(py);
        const iz = Math.floor(pz);
        let d1 = Infinity;
        let d2 = Infinity;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              const pi = cell(ix + dx, iy + dy, iz + dz) * 3;
              const qx = ix + dx + pts[pi]! - px;
              const qy = iy + dy + pts[pi + 1]! - py;
              const qz = iz + dz + pts[pi + 2]! - pz;
              const d = qx * qx + qy * qy + qz * qz;
              if (d < d1) {
                d2 = d1;
                d1 = d;
              } else if (d < d2) d2 = d;
            }
          }
        }
        f1[k] = Math.sqrt(d1);
        f2[k] = Math.sqrt(d2) - Math.sqrt(d1);
        k++;
      }
    }
  }
  return [f1, f2];
}

export function createDetailNoise(seed = 7): Data3DTexture {
  const random = mulberry32(seed);
  const r = gradientNoise(random);
  const g = gradientNoise(random);
  const [b, a] = cellularNoise(random);
  const n = NOISE_SIZE ** 3;
  const data = new Uint8Array(n * 4);
  const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  for (let i = 0; i < n; i++) {
    data[i * 4] = byte(r[i]!);
    data[i * 4 + 1] = byte(g[i]!);
    data[i * 4 + 2] = byte(b[i]!);
    data[i * 4 + 3] = byte(a[i]!);
  }
  const tex = new Data3DTexture(data, NOISE_SIZE, NOISE_SIZE, NOISE_SIZE);
  tex.name = 'atlas-detail-noise';
  tex.format = RGBAFormat;
  tex.type = UnsignedByteType;
  tex.wrapS = tex.wrapT = tex.wrapR = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}
