/**
 * Tissue look: what makes muscle and bone surfaces look like tissue instead of flat plastic.
 *
 *  stage 1  tendons on muscles and joint cartilage on bones, plus a slight per-muscle colour variation so that
 *           neighbouring muscles can be told apart
 *  stage 2  baked creases and hollows (darker where structures meet), a bone surface texture (colour variation,
 *           sparse pores) and spongy bone on bone cut faces
 *  stage 3  muscle fibres (a plain texture for ring-shaped and complex muscles)
 *
 * Tendons and cartilage come from the source: Z-Anatomy assigns them as a second material on some faces. The
 * pipeline keeps them as the `_TISSUE` vertex attribute of the muscular and skeletal chunks
 * (pipeline/blender/export.py; R = tendon, G = cartilage, B = baked occlusion, A reserved), read here as `tissue`.
 * Nothing is estimated: a muscle without marked tendon faces has zeros and stays fully red. Fibre directions come
 * from the pipeline as well (node extras "fibre": the two ends the fibres run between, pipeline/blender/shading.py).
 *
 * Off switches: TISSUE_LOOK (everything), SURFACE_DETAIL (stages 2 + 3), MUSCLE_FIBRES (stage 3). To compare in the
 * browser, open the app with `?look=plain` (source colours only) or `?look=1|2|3` (up to that stage). The textures
 * of stages 2 and 3 are left out on weak devices unless a stage is asked for explicitly with `?look=`.
 */
import { Color, SRGBColorSpace } from 'three';
import type { HSL } from 'three';
import type { Structure } from '@/contract';

export const TISSUE_LOOK = true;
export const SURFACE_DETAIL = true;
export const MUSCLE_FIBRES = true;

export interface Look {
  /** Stage 1: tendons, cartilage, muscle colour variation. Without it the decoder drops `tissue`. */
  tissue: boolean;
  /** Stage 2: baked creases and hollows (_TISSUE B). */
  occlusion: boolean;
  /** Stage 2: bone surface texture and spongy bone on cut faces. */
  bone: boolean;
  /** Stage 3: muscle fibres. */
  fibres: boolean;
}

/**
 * Weak device: little memory or few cores (Android exposes deviceMemory; iPhones have ≥ 6 cores). Their GPUs have
 * no headroom for the per-pixel texture lookups of stages 2 and 3.
 */
export function weakDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (memory !== undefined && memory < 4) return true;
  const cores = navigator.hardwareConcurrency;
  return cores > 0 && cores < 4;
}

let current: Look | null = null;

/** The look for this session (fixed on first use so every chunk is drawn the same way). */
export function look(): Look {
  if (current) return current;
  const param =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('look') : null;
  const asked =
    param === 'plain' ? 0 : param === '1' || param === '2' || param === '3' ? Number(param) : null;
  // highest stage the switches allow
  const max = !TISSUE_LOOK ? 0 : !SURFACE_DETAIL ? 1 : !MUSCLE_FIBRES ? 2 : 3;
  const stage = Math.min(asked ?? max, max);
  const textures = asked !== null || !weakDevice();
  current = {
    tissue: stage >= 1,
    occlusion: stage >= 2,
    bone: stage >= 2 && textures,
    fibres: stage >= 3 && textures,
  };
  return current;
}

/** Forget the session look (tests change the URL). */
export function resetLook(): void {
  current = null;
}

export function tissueLookEnabled(): boolean {
  return look().tissue;
}

/**
 * Surface of the marked faces (sRGB colour). `mix` is how far the displayed structure colour moves towards it,
 * so selection and quiz tints still show faintly on tendons. Lower roughness = smoother, glossier highlight
 * (materials.ts uses 0.55 for everything else).
 */
export const TENDON = { color: '#efe5dc', mix: 0.85, roughness: 0.42 };
export const CARTILAGE = { color: '#c2d6f0', mix: 0.85, roughness: 0.3 };
/**
 * smoothstep range over the attribute. 0.5 is the material border of the source faces; border vertices lie at
 * ≈ 0.33–0.67 depending on the triangulation, so a narrow range turns the border into jagged spikes.
 */
export const TISSUE_EDGE: [number, number] = [0, 1];

/**
 * Baked occlusion (stage 2): how much darker a fully occluded point gets. `specular` also dims highlights in
 * creases. The pipeline maps its occlusion so that open surfaces are exactly 0 and stores it in `steps` steps
 * (_TISSUE B = 0..31, pipeline/blender/shading.py OCCLUSION_STEPS).
 */
export const OCCLUSION = { muscle: 0.45, bone: 0.5, specular: 0.7, steps: 31 };

/**
 * Surface texture (stages 2 + 3) from one small tileable 3D noise texture (detailNoise.ts: 8 noise cells per
 * repeat). Lengths in metres. Detail fades out between DETAIL_FADE noise cells per pixel (zoomed out it would only
 * shimmer).
 */
export const DETAIL_FADE: [number, number] = [0.3, 0.7];

/**
 * Bone surface. Pores: dark pits where the cellular noise is below `pores` cells — at 0.24 about 5 % of the
 * surface; more or darker and bone starts to look like pumice. `depth` is the bump height (pits, grain).
 */
export const BONE_SURFACE = {
  period: 0.008,
  pores: 0.24,
  poreDarken: 0.14,
  grain: 0.05,
  depth: 0.00006,
  /** Large, soft colour variation: brightness ± blotch, yellower/greyer ± warmth. */
  blotchPeriod: 0.07,
  blotch: 0.07,
  warmth: 0.06,
};

/**
 * Spongy bone on cut faces: pale trabeculae (cellular-noise borders below `wall` cells) around darker marrow
 * spaces tinted towards `marrow`.
 */
export const SPONGY = {
  period: 0.018,
  wall: 0.16,
  soft: 0.08,
  marrow: '#a0614a',
  marrowMix: 0.35,
  marrowShade: 0.62,
};

/**
 * Muscle fibres. The pipeline gives each muscle the two ends its fibres run between; every fibre is a circular
 * arc through both (a spindle: fibres bulge in the belly and converge into the tendons; fan-shaped muscles get a
 * far-away second end so their fibres fan out from the apex). The texture is the noise stretched along the fibres
 * (it changes `stretch` times as fast along them as across: 0.05 = 20× longer streaks), with thin darker seams
 * between fascicles. Muscles without ends (ring-shaped and
 * complex ones, connective tissue) get the `plain` texture.
 */
export const FIBRES = {
  period: 0.012,
  /** Upper bound of the convergence towards the ends (keeps the texture finite at the tips). */
  converge: 4,
  stretch: 0.05,
  contrast: 0.1,
  /** Darkening of the seams; they are about a pixel wide at any zoom (antialiased contour lines of the noise). */
  seams: 0.08,
  depth: 0.00004,
  plain: { period: 0.03, contrast: 0.05 },
};

/**
 * Bone colour. The source paints bones a saturated tan; the viewer draws them in a paler ivory, closer to real bone
 * and to other anatomy atlases. Only structures with exactly the source bone colour change: teeth and cartilage of
 * the skeletal system keep their own colours.
 */
export const BONE = { system: 'skeletal', source: '#e7c397', color: '#ead9bb' };

/**
 * Per-structure colour offset in the muscular system, seeded by the English name (= the Blender object name without
 * its .l/.r suffix, so left and right match): hue ± hueDegrees, sRGB brightness × (1 ± brightness). Brightness
 * scales the RGB values rather than the HSL lightness, which would saturate pale structures (e.g. the near-white
 * linea alba turns cyan).
 */
export const MUSCLE_VARIATION = { system: 'muscular', hueDegrees: 4, brightness: 0.07 };

/** 32-bit FNV-1a with a murmur3 finalizer (well mixed low and high halves). */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const _c = new Color();
const _hsl: HSL = { h: 0, s: 0, l: 0 };
const _rgb = { r: 0, g: 0, b: 0 };

/** sRGB hex with the deterministic offset for `seed` (hue in degrees, brightness relative). */
export function variedColor(
  hex: string,
  seed: string,
  { hueDegrees, brightness } = MUSCLE_VARIATION,
): string {
  const h = hash32(seed);
  const a = ((h & 0xffff) / 0xffff) * 2 - 1;
  const b = ((h >>> 16) / 0xffff) * 2 - 1;
  _c.set(hex).getHSL(_hsl, SRGBColorSpace);
  _c.setHSL((_hsl.h + (a * hueDegrees) / 360 + 1) % 1, _hsl.s, _hsl.l, SRGBColorSpace);
  _c.getRGB(_rgb, SRGBColorSpace);
  const k = 1 + b * brightness;
  _c.setRGB(Math.min(1, _rgb.r * k), Math.min(1, _rgb.g * k), Math.min(1, _rgb.b * k), SRGBColorSpace);
  return `#${_c.getHexString()}`;
}

/** Base colour the viewer draws for a structure (sRGB hex). */
export function structureColor(st: Pick<Structure, 'color' | 'system' | 'names' | 'id'>): string {
  if (!tissueLookEnabled() || !st.color) return st.color;
  if (st.system === BONE.system && st.color === BONE.source) return BONE.color;
  if (st.system !== MUSCLE_VARIATION.system) return st.color;
  return variedColor(st.color, st.names?.en ?? st.id);
}

/** Which surface shader a chunk gets (materials.ts): by system, once its geometry carries `tissue`. */
export type SurfaceKind = 'plain' | 'tissue' | 'bone' | 'muscle';

export function surfaceKind(system: string, hasTissue: boolean): SurfaceKind {
  if (!hasTissue) return 'plain';
  const l = look();
  if (system === 'skeletal' && (l.occlusion || l.bone)) return 'bone';
  if (system === 'muscular' && (l.occlusion || l.fibres)) return 'muscle';
  return 'tissue';
}
