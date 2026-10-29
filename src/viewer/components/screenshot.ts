/**
 * PNG of the canvas. The WebGL drawing buffer is not preserved (cheaper), so we render synchronously and copy it
 * in the same task. The canvas is transparent (CSS backdrop), so the backdrop is painted underneath unless a
 * transparent background was requested. HTML labels are not part of the image.
 */
import { Vector2 } from 'three';
import type { Camera, Scene, WebGLRenderer } from 'three';
import { BACKDROP_DARK, BACKDROP_LIGHT, isDarkDocument, paintBackdrop } from './background';

const MAX_EDGE = 8192;

export function takeScreenshot(
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  opts: { scale?: number; transparentBackground?: boolean },
): { dataUrl: string; width: number; height: number } {
  const size = gl.getSize(new Vector2());
  const prevRatio = gl.getPixelRatio();
  let scale = Number.isFinite(opts.scale) && opts.scale! > 0 ? Math.min(4, opts.scale!) : 1;
  const edge = Math.max(size.x, size.y) * prevRatio * scale;
  if (edge > MAX_EDGE) scale *= MAX_EDGE / edge;
  const changed = Math.abs(scale - 1) > 1e-6;
  if (changed) gl.setPixelRatio(prevRatio * scale);
  try {
    gl.render(scene, camera);
    const src = gl.domElement;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    if (!opts.transparentBackground)
      paintBackdrop(ctx, out.width, out.height, isDarkDocument() ? BACKDROP_DARK : BACKDROP_LIGHT);
    ctx.drawImage(src, 0, 0);
    return { dataUrl: out.toDataURL('image/png'), width: out.width, height: out.height };
  } finally {
    if (changed) {
      gl.setPixelRatio(prevRatio);
      gl.render(scene, camera);
    }
  }
}
