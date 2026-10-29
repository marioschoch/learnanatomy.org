/**
 * Camera: drei CameraControls (damping, touch gestures, zoom limits) + the viewer command queue.
 *
 * Commands arrive through the store (`viewerQueue`, ARCHITECTURE.md §6) and are executed one at a time; each is
 * completed with `completeViewerCommand`. Animations are skipped with reduced motion. When the camera comes to
 * rest its pose is reported with `setCamera` (URL state).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraControls } from '@react-three/drei';
import type { CameraControlsImpl } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { Box3, Sphere, Vector3 } from 'three';
import type { BBox, CameraPose, QueuedViewerCommand, ViewerCommand, ViewerCommandResult } from '@/contract';
import { structureIdsOfNode, useAtlasStore } from '@/state';
import type { AtlasScene } from '../core/AtlasScene';
import { offsetBBox } from '../core/explode';
import { viewPosition } from '../core/views';
import type { ViewerBus } from '../core/ViewerBus';
import { takeScreenshot } from './screenshot';

export const DEFAULT_FOV = 35;
/** Extra room around a focused structure (UI panels overlap the canvas edges). */
const FOCUS_PADDING = 1.6;
const MIN_FOCUS_RADIUS = 0.025;
const TRANSITION_TIMEOUT_MS = 4000;

const _v = new Vector3();
const _t = new Vector3();

function poseOf(controls: CameraControlsImpl): CameraPose {
  controls.getPosition(_v, true);
  controls.getTarget(_t, true);
  const fov = (controls.camera as PerspectiveCamera).fov;
  return { position: [_v.x, _v.y, _v.z], target: [_t.x, _t.y, _t.z], fov };
}

/** Resolve after a camera transition, but never hang (hidden tab, interrupted transition). */
function settle(p: Promise<unknown>): Promise<void> {
  return Promise.race([
    p.then(() => undefined),
    new Promise<void>((r) => setTimeout(r, TRANSITION_TIMEOUT_MS)),
  ]);
}

export function CameraRig({ scene, bus }: { scene: AtlasScene; bus: ViewerBus }) {
  const ref = useRef<CameraControlsImpl>(null);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const threeScene = useThree((s) => s.scene);
  const manifest = useAtlasStore((s) => s.manifest);
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  // Survive effect re-runs (StrictMode) so a queued command is never executed twice.
  const handled = useRef(new Set<number>());
  const chain = useRef(Promise.resolve());

  const reportPose = useCallback(() => {
    const c = ref.current;
    if (c) useAtlasStore.getState().setCamera(poseOf(c));
  }, []);

  /** Whole body, anterior view. */
  const resetCamera = useCallback(async (animate: boolean) => {
    const c = ref.current;
    const b = useAtlasStore.getState().manifest?.bodyBounds;
    if (!c || !b) return;
    const cam = c.camera as PerspectiveCamera;
    if (cam.fov !== DEFAULT_FOV) {
      cam.fov = DEFAULT_FOV;
      cam.updateProjectionMatrix();
    }
    const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] as const;
    const target: [number, number, number] = [
      (b.min[0] + b.max[0]) / 2,
      (b.min[1] + b.max[1]) / 2,
      (b.min[2] + b.max[2]) / 2,
    ];
    // Room for the UI bars above and below the body.
    const dist = c.getDistanceToFitBox(size[0], size[1], size[2]) * 1.22;
    const pos = viewPosition('anterior', target, dist);
    await settle(c.setLookAt(...pos, ...target, animate));
  }, []);

  // Zoom limits and pan boundary from the body bounds; initial anterior view.
  useEffect(() => {
    const c = ref.current;
    if (!c || !manifest) return;
    const b = manifest.bodyBounds;
    const height = Math.max(0.1, b.max[1] - b.min[1]);
    c.minDistance = 0.02;
    c.maxDistance = height * 4;
    const margin = height * 0.25;
    c.setBoundary(
      new Box3(
        new Vector3(b.min[0] - margin, b.min[1] - margin, b.min[2] - margin),
        new Vector3(b.max[0] + margin, b.max[1] + margin, b.max[2] + margin),
      ),
    );
    if (!initialized.current) {
      initialized.current = true;
      void resetCamera(false).then(() => {
        reportPose();
        setReady(true);
      });
      invalidate();
    }
  }, [manifest, resetCamera, reportPose, invalidate]);

  useEffect(() => {
    if (!ready) return;
    useAtlasStore.getState().setViewerReady(true);
    return () => useAtlasStore.getState().setViewerReady(false);
  }, [ready]);

  const run = useCallback(
    async (cmd: ViewerCommand): Promise<ViewerCommandResult> => {
      const c = ref.current;
      if (!c) return { ok: false, type: cmd.type, error: 'viewer not ready' };
      const st = useAtlasStore.getState();
      const animate = 'animate' in cmd ? cmd.animate !== false && !st.reducedMotion : !st.reducedMotion;
      invalidate();
      switch (cmd.type) {
        case 'focus': {
          for (const id of cmd.ids) await useAtlasStore.getState().ensureNodeMeta(id);
          const s = useAtlasStore.getState();
          const ids = [...new Set(cmd.ids.flatMap((id) => structureIdsOfNode(s, id)))];
          let box: BBox | null = null;
          for (const id of ids) {
            const st2 = s.structures[id];
            if (!st2) continue;
            const b = offsetBBox(st2.bbox, scene.offsetOf(id, true));
            if (!box) box = { min: [...b.min], max: [...b.max] };
            else
              for (let i = 0; i < 3; i++) {
                box.min[i] = Math.min(box.min[i]!, b.min[i]!);
                box.max[i] = Math.max(box.max[i]!, b.max[i]!);
              }
          }
          if (!box) return { ok: false, type: 'focus', error: `nothing to focus: ${cmd.ids.join(', ')}` };
          const b3 = new Box3(new Vector3(...box.min), new Vector3(...box.max));
          const sphere = b3.getBoundingSphere(new Sphere());
          sphere.radius = Math.max(MIN_FOCUS_RADIUS, sphere.radius * FOCUS_PADDING);
          await settle(c.fitToSphere(sphere, animate));
          break;
        }
        case 'setView': {
          c.getTarget(_t, true);
          const dist = c.distance;
          const pos = viewPosition(cmd.view, [_t.x, _t.y, _t.z], dist);
          await settle(c.setLookAt(...pos, _t.x, _t.y, _t.z, animate));
          break;
        }
        case 'setCameraPose': {
          const { position: p, target: t, fov } = cmd.pose;
          const cam = c.camera as PerspectiveCamera;
          if (fov && Number.isFinite(fov) && fov > 5 && fov < 120 && cam.fov !== fov) {
            cam.fov = fov;
            cam.updateProjectionMatrix();
          }
          await settle(c.setLookAt(p[0], p[1], p[2], t[0], t[1], t[2], animate));
          break;
        }
        case 'resetCamera':
          await resetCamera(animate);
          break;
        case 'zoom': {
          const f = Number.isFinite(cmd.factor) && cmd.factor > 0 ? cmd.factor : 1;
          await settle(c.dollyTo(c.distance / f, !st.reducedMotion));
          break;
        }
        case 'screenshot': {
          const shot = takeScreenshot(gl, threeScene, camera, cmd);
          return { ok: true, type: 'screenshot', ...shot };
        }
      }
      reportPose();
      return { ok: true, type: cmd.type };
    },
    [scene, gl, threeScene, camera, invalidate, resetCamera, reportPose],
  );

  // Drain the command queue (one command at a time, in order) once the initial view is set.
  useEffect(() => {
    if (!ready) return;
    const drain = (queue: QueuedViewerCommand[]) => {
      for (const item of queue) {
        if (handled.current.has(item.id)) continue;
        handled.current.add(item.id);
        chain.current = chain.current.then(async () => {
          let result: ViewerCommandResult;
          try {
            result = await run(item.command);
          } catch (e) {
            result = {
              ok: false,
              type: item.command.type,
              error: e instanceof Error ? e.message : String(e),
            };
          }
          useAtlasStore.getState().completeViewerCommand(item.id, result);
        });
      }
    };
    drain(useAtlasStore.getState().viewerQueue);
    return useAtlasStore.subscribe((s, p) => {
      if (s.viewerQueue !== p.viewerQueue) drain(s.viewerQueue);
    });
  }, [ready, run]);

  // Feed the orientation gizmo.
  useFrame(() => {
    if (!bus.camera.last.equals(camera.quaternion)) bus.camera.emit(camera.quaternion.clone());
  });

  return (
    <CameraControls
      ref={ref}
      makeDefault
      smoothTime={0.22}
      draggingSmoothTime={0.06}
      dollyToCursor
      dollySpeed={0.6}
      azimuthRotateSpeed={0.9}
      polarRotateSpeed={0.9}
      onControlStart={() => {
        bus.cameraBusy = true;
      }}
      onTransitionStart={() => {
        bus.cameraBusy = true;
      }}
      onRest={() => {
        bus.cameraBusy = false;
        reportPose();
      }}
      onSleep={() => {
        bus.cameraBusy = false;
      }}
    />
  );
}
