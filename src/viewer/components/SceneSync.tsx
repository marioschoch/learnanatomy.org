/**
 * Mounts the AtlasScene into the R3F scene and keeps it in sync with the store:
 *   visibility inputs → applyVisibility (visibility.ts) + lazy geometry loading
 *   selection / hover / highlights → tints
 *   clipping → shared clipping planes
 *   explode → animated instance matrices
 * Every change invalidates one frame (frameloop="demand").
 */
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { AtlasState } from '@/contract';
import { buildVisibilityContext, systemsNeedingGeometry, useAtlasStore } from '@/state';
import type { AtlasScene } from '../core/AtlasScene';
import { clipPlaneSpecs } from '../core/clipping';
import { computeTints } from '../core/tints';
import { GeometryLoader } from '../loading/GeometryLoader';

const visibilityChanged = (a: AtlasState, b: AtlasState) =>
  a.manifest !== b.manifest ||
  a.layers !== b.layers ||
  a.hiddenIds !== b.hiddenIds ||
  a.isolate !== b.isolate ||
  a.xray !== b.xray ||
  a.structures !== b.structures ||
  a.groups !== b.groups ||
  a.landmarks !== b.landmarks ||
  a.childrenOf !== b.childrenOf;

const tintsChanged = (a: AtlasState, b: AtlasState) =>
  a.selectedId !== b.selectedId ||
  a.hoveredId !== b.hoveredId ||
  a.highlights !== b.highlights ||
  a.isolate !== b.isolate ||
  a.structures !== b.structures ||
  a.childrenOf !== b.childrenOf;

export function SceneSync({ scene }: { scene: AtlasScene }) {
  const invalidate = useThree((s) => s.invalidate);
  const threeScene = useThree((s) => s.scene);

  useEffect(() => {
    threeScene.add(scene.root);
    return () => {
      threeScene.remove(scene.root);
    };
  }, [scene, threeScene]);

  useEffect(() => {
    // Build picking BVHs while the browser is idle, so the first hover/click on a big structure does not stall.
    let idleHandle: number | null = null;
    const ric =
      typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback.bind(window) : null;
    const cancelIdle = () => {
      if (idleHandle === null) return;
      if (ric) window.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
      idleHandle = null;
    };
    const scheduleIdle = () => {
      if (idleHandle !== null || scene.isDisposed) return;
      const run = (deadline?: IdleDeadline) => {
        idleHandle = null;
        if (scene.isDisposed) return;
        const until = performance.now() + 8;
        const remaining = deadline ? () => deadline.timeRemaining() : () => until - performance.now();
        if (!scene.buildBvhs(remaining)) scheduleIdle();
      };
      idleHandle = ric ? ric(run, { timeout: 3000 }) : window.setTimeout(() => run(), 100);
    };

    const loader = new GeometryLoader(scene, (batch) => {
      // A newly built chunk gets the current state immediately.
      const st = useAtlasStore.getState();
      scene.applyVisibility(buildVisibilityContext(st), st.structures, [batch]);
      scene.applyTints(computeTints(st), [batch]);
      scheduleIdle();
      invalidate();
    });

    let prev: AtlasState | null = null;
    const apply = (st: AtlasState) => {
      if (scene.isDisposed) return;
      let dirty = false;
      if (!prev || visibilityChanged(st, prev)) {
        scene.applyVisibility(buildVisibilityContext(st), st.structures);
        loader.ensure(systemsNeedingGeometry(st));
        dirty = true;
      }
      if (!prev || tintsChanged(st, prev)) {
        scene.applyTints(computeTints(st));
        dirty = true;
      }
      if (!prev || st.clipping !== prev.clipping || st.manifest !== prev.manifest) {
        scene.setClipping(clipPlaneSpecs(st.clipping, st.manifest?.bodyBounds));
        dirty = true;
      }
      if (!prev || st.explode !== prev.explode) {
        scene.setExplodeTarget(st.explode, st.reducedMotion || !prev);
        dirty = true;
      }
      prev = st;
      if (dirty) invalidate();
    };
    apply(useAtlasStore.getState());
    const unsubscribe = useAtlasStore.subscribe(apply);

    return () => {
      unsubscribe();
      loader.abort();
      cancelIdle();
      // Geometry is owned by this scene; report it as unloaded so a remounted viewer loads it again.
      for (const id of loader.systems) useAtlasStore.getState().setGeometryStatus(id, 'idle', 0);
    };
  }, [scene, invalidate]);

  // Explode animation: keep rendering while instances move.
  useFrame((_, dt) => {
    if (scene.tick(dt, useAtlasStore.getState().reducedMotion)) invalidate();
  });

  return null;
}
