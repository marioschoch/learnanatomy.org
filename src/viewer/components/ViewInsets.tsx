/**
 * Makes the uncovered part of the canvas (store `viewInsets`) act as the viewport: the projection gets a view
 * offset so CameraControls fits and centres views there, while the covered rest still renders around it. Picking
 * (Raycaster.setFromCamera) and labels (Vector3.project) read the projection matrix and stay correct.
 *
 * The camera is marked `manual`, so R3F no longer sets its aspect on resize; this component does.
 */
import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { useAtlasStore } from '@/state';

/** Insets are scaled down so at least this share of each canvas dimension stays the viewport. */
const MIN_SHARE = 0.3;

function clampPair(a: number, b: number, total: number): [number, number] {
  const lo = Math.max(0, a);
  const hi = Math.max(0, b);
  const max = total * (1 - MIN_SHARE);
  const k = lo + hi > max ? max / (lo + hi) : 1;
  return [lo * k, hi * k];
}

export function ViewInsets() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera & { manual?: boolean };
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);
  const insets = useAtlasStore((s) => s.viewInsets);

  useLayoutEffect(() => {
    if (width <= 0 || height <= 0) return;
    camera.manual = true;
    const [top, bottom] = clampPair(insets.top, insets.bottom, height);
    const [left, right] = clampPair(insets.left, insets.right, width);
    if (top + bottom + left + right < 0.5) {
      camera.aspect = width / height;
      camera.clearViewOffset();
    } else {
      // The uncovered rect is the "full" view (fov and aspect describe it); the canvas window extends past it.
      camera.setViewOffset(width - left - right, height - top - bottom, -left, -top, width, height);
    }
    invalidate();
  }, [camera, width, height, insets, invalidate]);

  return null;
}
