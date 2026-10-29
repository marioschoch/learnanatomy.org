/**
 * Pointer picking on the canvas (our own BVH raycasts, not R3F's event system).
 *  - click / tap (≤ 5 px, ≤ 500 ms, single pointer) → pickStructure(id); empty space clears the selection in
 *    explore mode (never counts as a quiz answer)
 *  - double click on a structure → select + focus
 *  - hover: mouse only, throttled, paused while the camera moves → setHovered
 * Non-pickable things (hidden, ghosts, < 5 % opacity, clipped-away parts) are skipped by AtlasScene.pick.
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Raycaster, Vector2 } from 'three';
import { useAtlasStore } from '@/state';
import type { AtlasScene } from '../core/AtlasScene';
import { ClickDetector } from '../core/clickDetector';
import type { ViewerBus } from '../core/ViewerBus';

const HOVER_INTERVAL_MS = 50;

export function Picking({ scene, bus }: { scene: AtlasScene; bus: ViewerBus }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const clicks = new ClickDetector();
    let lastHover = 0;
    let hoverTimer: number | null = null;
    let lastMouse: { x: number; y: number } | null = null;

    const pickAt = (clientX: number, clientY: number): string | null => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return scene.pick(raycaster.ray, camera.near, camera.far)?.id ?? null;
    };

    const setHover = (id: string | null) => {
      const store = useAtlasStore.getState();
      if (store.hoveredId !== id) store.setHovered(id);
      el.style.cursor = id ? 'pointer' : '';
    };

    const runHover = () => {
      hoverTimer = null;
      if (!lastMouse || clicks.anyDown || bus.cameraBusy) return;
      lastHover = performance.now();
      setHover(pickAt(lastMouse.x, lastMouse.y));
    };

    const onDown = (e: PointerEvent) => {
      clicks.down(e.pointerId, e.clientX, e.clientY, e.timeStamp);
    };
    const onMove = (e: PointerEvent) => {
      clicks.move(e.pointerId, e.clientX, e.clientY);
      if (e.pointerType !== 'mouse') return;
      if (e.buttons !== 0) {
        if (useAtlasStore.getState().hoveredId) setHover(null);
        return;
      }
      lastMouse = { x: e.clientX, y: e.clientY };
      const wait = HOVER_INTERVAL_MS - (performance.now() - lastHover);
      if (hoverTimer === null) hoverTimer = window.setTimeout(runHover, Math.max(0, wait));
    };
    const onUp = (e: PointerEvent) => {
      if (!clicks.up(e.pointerId, e.clientX, e.clientY, e.timeStamp)) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const id = pickAt(e.clientX, e.clientY);
      const store = useAtlasStore.getState();
      if (id) store.pickStructure(id);
      else if (store.mode === 'explore' && store.selectedId) store.select(null);
    };
    const onCancel = (e: PointerEvent) => clicks.cancel(e.pointerId);
    const onLeave = () => {
      lastMouse = null;
      if (hoverTimer !== null) window.clearTimeout(hoverTimer);
      hoverTimer = null;
      setHover(null);
    };
    const onDblClick = (e: MouseEvent) => {
      const store = useAtlasStore.getState();
      if (store.mode !== 'explore') return;
      const id = pickAt(e.clientX, e.clientY);
      if (id) void store.selectAndFocus(id);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('dblclick', onDblClick);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('dblclick', onDblClick);
      if (hoverTimer !== null) window.clearTimeout(hoverTimer);
    };
  }, [gl, camera, scene, bus]);

  return null;
}
