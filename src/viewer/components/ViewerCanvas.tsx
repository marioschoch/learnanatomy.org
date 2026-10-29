/**
 * The R3F canvas and everything inside it. Loaded lazily by ../Viewer.tsx (keeps R3F/drei/three-mesh-bvh out of
 * the main bundle).
 *
 * Rendering is on demand (frameloop="demand"): store changes, camera motion and animations call invalidate().
 * The canvas is transparent over a CSS backdrop; renderer.localClippingEnabled is on for the section planes.
 */
import { Component, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { NeutralToneMapping } from 'three';
import { AtlasScene } from '../core/AtlasScene';
import { ViewerBus } from '../core/ViewerBus';
import { CameraRig, DEFAULT_FOV } from './CameraRig';
import { Labels } from './Labels';
import { Lighting } from './Lighting';
import { OrientationGizmo } from './OrientationGizmo';
import { LoadingProgress, StatsOverlay } from './Overlays';
import { AdaptiveResolution, StatsProbe } from './Performance';
import { Picking } from './Picking';
import { SceneSync } from './SceneSync';
import { useViewerStrings } from './strings';

// Module constants: R3F re-applies Canvas config whose identity changes.
const GL = {
  antialias: true,
  alpha: true,
  stencil: false,
  powerPreference: 'high-performance',
  toneMapping: NeutralToneMapping,
  localClippingEnabled: true,
} as const;
const DPR: [number, number] = [1, 2];
const CAMERA = { fov: DEFAULT_FOV, near: 0.01, far: 100, position: [0, 1, 4] as [number, number, number] };

class CanvasErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { error: boolean }
> {
  override state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  override componentDidCatch(error: unknown) {
    console.error('[viewer] 3D view failed:', error);
  }
  override render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}

function WebGlError() {
  const s = useViewerStrings();
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-neutral-600 dark:text-neutral-300">
      {s.webglError}
    </div>
  );
}

/**
 * The scene outlives StrictMode's simulated unmount/remount: dispose is deferred one tick and cancelled when the
 * component mounts again with the same scene.
 */
function useDeferredDispose(scene: AtlasScene) {
  useEffect(() => {
    const t = scene as AtlasScene & { __disposeTimer?: number };
    if (t.__disposeTimer !== undefined) {
      window.clearTimeout(t.__disposeTimer);
      t.__disposeTimer = undefined;
    }
    return () => {
      t.__disposeTimer = window.setTimeout(() => scene.dispose(), 0);
    };
  }, [scene]);
}

const showStats = () =>
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('stats'));

export default function ViewerCanvas() {
  const [bus] = useState(() => new ViewerBus());
  const [scene] = useState(() => new AtlasScene());
  const [stats] = useState(showStats);
  useDeferredDispose(scene);

  return (
    <>
      <CanvasErrorBoundary fallback={<WebGlError />}>
        <Canvas
          frameloop="demand"
          dpr={DPR}
          gl={GL}
          camera={CAMERA}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
          data-testid="viewer-canvas"
        >
          <Lighting />
          <SceneSync scene={scene} />
          <CameraRig scene={scene} bus={bus} />
          <Picking scene={scene} bus={bus} />
          <Labels scene={scene} />
          <StatsProbe scene={scene} bus={bus} />
          <AdaptiveResolution />
        </Canvas>
      </CanvasErrorBoundary>
      <OrientationGizmo bus={bus} />
      <LoadingProgress />
      {stats && <StatsOverlay bus={bus} />}
    </>
  );
}
