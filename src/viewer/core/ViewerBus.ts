/**
 * Viewer-internal pub/sub between components inside the <Canvas> (camera, renderer) and DOM overlays next to it
 * (orientation gizmo, stats overlay). One instance per mounted viewer; never shared with other modules —
 * the UI talks to the viewer only through the store.
 */
import { Quaternion } from 'three';
import type { ViewerStats } from '@/contract';

type Listener<T> = (value: T) => void;

class Channel<T> {
  private listeners = new Set<Listener<T>>();
  last: T;
  constructor(initial: T) {
    this.last = initial;
  }
  emit(value: T): void {
    this.last = value;
    for (const l of this.listeners) l(value);
  }
  on(l: Listener<T>): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export interface LiveStats extends ViewerStats {
  dpr: number;
  batches: number;
  instances: number;
}

export class ViewerBus {
  /** Camera orientation, emitted on every rendered frame where it changed. */
  readonly camera = new Channel<Quaternion>(new Quaternion());
  readonly stats = new Channel<LiveStats | null>(null);
  /** True while the user drags/zooms or a camera transition runs (hover picking pauses). */
  cameraBusy = false;
}
