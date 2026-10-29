/**
 * Tells a click/tap apart from a camera drag (pure, unit tested).
 *
 * A pointer-up counts as a click when the same pointer went down ≤ CLICK_MAX_MOVE px away and ≤ CLICK_MAX_MS ago,
 * and no second pointer was down during the gesture (pinch / two-finger pan never select).
 */
export const CLICK_MAX_MOVE = 5;
export const CLICK_MAX_MS = 500;

interface Down {
  x: number;
  y: number;
  t: number;
  /** Set when another pointer went down while this one was down. */
  multi: boolean;
}

export class ClickDetector {
  private downs = new Map<number, Down>();

  down(pointerId: number, x: number, y: number, t: number): void {
    const multi = this.downs.size > 0;
    if (multi) for (const d of this.downs.values()) d.multi = true;
    this.downs.set(pointerId, { x, y, t, multi });
  }

  /** Track movement so a drag that comes back to its start point is not a click. */
  move(pointerId: number, x: number, y: number): void {
    const d = this.downs.get(pointerId);
    if (d && Math.hypot(x - d.x, y - d.y) > CLICK_MAX_MOVE) d.multi = true;
  }

  /** Returns true when this pointer-up is a click. */
  up(pointerId: number, x: number, y: number, t: number): boolean {
    const d = this.downs.get(pointerId);
    this.downs.delete(pointerId);
    if (!d || d.multi) return false;
    return Math.hypot(x - d.x, y - d.y) <= CLICK_MAX_MOVE && t - d.t <= CLICK_MAX_MS;
  }

  cancel(pointerId: number): void {
    this.downs.delete(pointerId);
  }

  get anyDown(): boolean {
    return this.downs.size > 0;
  }
}
