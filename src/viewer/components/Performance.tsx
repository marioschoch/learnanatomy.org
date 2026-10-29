/**
 * Frame statistics and adaptive resolution.
 *
 * With frameloop="demand" frames only happen while something changes, so fps is measured over consecutive frames
 * only (gaps > 250 ms end a burst). Stats are published (bus + store.viewerStats) at most every 500 ms.
 *
 * AdaptiveResolution lowers the pixel ratio in steps when sustained frame times are slow (< ~45 fps while
 * orbiting) and raises it again when there is headroom — on phones this keeps orbiting ≥ 30 fps.
 */
import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ViewerStats } from '@/contract';
import { useAtlasStore } from '@/state';
import type { AtlasScene } from '../core/AtlasScene';
import type { LiveStats, ViewerBus } from '../core/ViewerBus';

const BURST_GAP = 0.25;
const PUBLISH_MS = 500;

export function StatsProbe({ scene, bus }: { scene: AtlasScene; bus: ViewerBus }) {
  const gl = useThree((s) => s.gl);
  const deltas = useRef<number[]>([]);
  const dirty = useRef(false);

  // Publish on a timer (not inside the frame) so the numbers settle after the last frame of a burst.
  // renderer.info keeps the last rendered frame's counts until the next render.
  useEffect(() => {
    let lastStore = '';
    const publish = () => {
      if (!dirty.current) return;
      dirty.current = false;
      const d = deltas.current;
      const avg = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
      const info = gl.info;
      const s = scene.stats();
      const live: LiveStats = {
        fps: avg > 0 ? Math.round(1 / avg) : 0,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        dpr: gl.getPixelRatio(),
        batches: s.batches,
        instances: s.instances,
      };
      bus.stats.emit(live);
      const stats: ViewerStats = {
        fps: live.fps,
        drawCalls: live.drawCalls,
        triangles: live.triangles,
        geometries: live.geometries,
        textures: live.textures,
      };
      const key = JSON.stringify(stats);
      if (key !== lastStore) {
        lastStore = key;
        useAtlasStore.getState().setViewerStats(stats);
      }
    };
    const timer = window.setInterval(publish, PUBLISH_MS);
    return () => {
      window.clearInterval(timer);
      useAtlasStore.getState().setViewerStats(null);
    };
  }, [gl, scene, bus]);

  useFrame((_, dt) => {
    if (dt > 0 && dt < BURST_GAP) {
      deltas.current.push(dt);
      if (deltas.current.length > 60) deltas.current.shift();
    }
    dirty.current = true;
  });
  return null;
}

export function AdaptiveResolution() {
  const setDpr = useThree((s) => s.setDpr);
  const gl = useThree((s) => s.gl);
  const samples = useRef<number[]>([]);
  const lastChange = useRef(0);
  const [{ min, max }] = useState(() => {
    const m = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    return { min: Math.min(1, m), max: m };
  });

  useFrame((_, dt) => {
    if (dt <= 0 || dt >= BURST_GAP) {
      samples.current.length = 0;
      return;
    }
    samples.current.push(dt);
    if (samples.current.length < 30) return;
    const avg = samples.current.reduce((a, b) => a + b, 0) / samples.current.length;
    samples.current.length = 0;
    const now = performance.now();
    if (now - lastChange.current < 1500) return;
    const dpr = gl.getPixelRatio();
    if (avg > 1 / 45 && dpr > min) {
      setDpr(Math.max(min, Math.round((dpr - 0.25) * 4) / 4));
      lastChange.current = now;
    } else if (avg < 1 / 58 && dpr < max) {
      setDpr(Math.min(max, Math.round((dpr + 0.25) * 4) / 4));
      lastChange.current = now;
    }
  });
  return null;
}
