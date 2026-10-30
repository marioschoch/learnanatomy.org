/**
 * Per-structure colours (linear working space, as BatchedMesh colour textures expect).
 *
 * Priority: quiz/preview highlight > selected > hovered > base colour. Ghosts are desaturated.
 * Alpha always comes from `structureRender(...).opacity` (src/state/visibility.ts), never from here.
 */
import { Color } from 'three';
import type { HighlightKind } from '@/contract';

export type Tint = 'none' | 'hover' | 'selected' | HighlightKind;

/** Highlight colours (sRGB hex) and how strongly they replace the base colour. */
export const TINTS: Record<Exclude<Tint, 'none'>, { color: string; amount: number }> = {
  hover: { color: '#7cc7ff', amount: 0.32 },
  selected: { color: '#1f8fff', amount: 0.5 },
  'quiz-target': { color: '#f5a524', amount: 0.75 },
  'quiz-correct': { color: '#1fbf5f', amount: 0.8 },
  'quiz-wrong': { color: '#e5484d', amount: 0.8 },
  preview: { color: '#9b7bff', amount: 0.6 },
};

/** Colour of structures without metadata (should not happen with validated assets). */
export const FALLBACK_COLOR = '#c8c2b8';

const cache = new Map<string, Color>();

/** sRGB hex → linear Color (cached; do not mutate the result). */
export function linearColor(hex: string): Color {
  let c = cache.get(hex);
  if (!c) {
    try {
      c = new Color(hex);
    } catch {
      c = new Color(FALLBACK_COLOR);
    }
    cache.set(hex, c);
  }
  return c;
}

const tintColors = Object.fromEntries(
  Object.entries(TINTS).map(([k, v]) => [k, new Color(v.color)]),
) as Record<Exclude<Tint, 'none'>, Color>;

/** Writes the displayed colour of a structure into `out`. */
export function tintedColor(baseHex: string, tint: Tint, ghost: boolean, out: Color): Color {
  out.copy(linearColor(baseHex));
  if (tint !== 'none') out.lerp(tintColors[tint], TINTS[tint].amount);
  if (ghost && tint === 'none') desaturate(out, 0.85);
  return out;
}

/** Mix towards the colour's own luminance, slightly cool, so ghosts read as neutral context. */
export function desaturate(c: Color, amount: number): Color {
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const g = Math.min(1, l * 0.9 + 0.12);
  c.r += (g * 0.96 - c.r) * amount;
  c.g += (g * 0.98 - c.g) * amount;
  c.b += (g * 1.04 - c.b) * amount;
  return c;
}
