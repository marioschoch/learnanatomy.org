/** Viewer backdrop (CSS behind a transparent canvas) — shared with the screenshot so PNGs look the same. */
export interface Backdrop {
  inner: string;
  mid: string;
  outer: string;
}

export const BACKDROP_LIGHT: Backdrop = { inner: '#f6f7f9', mid: '#dfe2e7', outer: '#c9cdd4' };
export const BACKDROP_DARK: Backdrop = { inner: '#2b3038', mid: '#181b20', outer: '#0e1013' };

export function backdropCss(b: Backdrop): string {
  return `radial-gradient(ellipse 80% 70% at 50% 38%, ${b.inner} 0%, ${b.mid} 62%, ${b.outer} 100%)`;
}

export function paintBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, b: Backdrop): void {
  const cx = w * 0.5;
  const cy = h * 0.38;
  const r = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, b.inner);
  g.addColorStop(0.62, b.mid);
  g.addColorStop(1, b.outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Dark mode is class-based on <html> (set by the UI from the theme preference). */
export function isDarkDocument(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}
