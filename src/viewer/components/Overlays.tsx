/**
 * DOM overlays next to the canvas: per-system loading progress and the dev-only stats panel.
 * Positions are overridable with CSS custom properties on an ancestor:
 *   --atlas-progress-bottom (default 152px), --atlas-stats-top (default 72px), --atlas-stats-left (default 12px)
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtlasStore } from '@/state';
import type { ViewerBus } from '../core/ViewerBus';
import { useViewerStrings } from './strings';

export function LoadingProgress() {
  const { t } = useTranslation();
  const strings = useViewerStrings();
  const manifest = useAtlasStore((s) => s.manifest);
  const systemLoad = useAtlasStore((s) => s.systemLoad);
  const rows = (manifest?.systems ?? []).filter((sys) => {
    const g = systemLoad[sys.id]?.geometry;
    return g === 'loading' || g === 'error';
  });
  if (rows.length === 0) return null;
  const name = (id: string, fallback: string) =>
    (t as unknown as (k: string, o: { defaultValue: string }) => string)(`systems.${id}`, {
      defaultValue: fallback,
    });
  return (
    <div
      className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5"
      style={{ bottom: 'var(--atlas-progress-bottom, 152px)' }}
      role="status"
      aria-live="polite"
      data-testid="viewer-loading"
    >
      {rows.map((sys) => {
        const st = systemLoad[sys.id]!;
        const pct = Math.round((st.progress ?? 0) * 100);
        const label = name(sys.id, sys.names.en);
        return (
          <div
            key={sys.id}
            className="flex min-w-48 items-center gap-2 rounded-full border border-neutral-300/70 bg-white/85 px-3 py-1 text-xs text-neutral-800 shadow-sm backdrop-blur dark:border-neutral-600/70 dark:bg-neutral-900/85 dark:text-neutral-100"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sys.color }} />
            {st.geometry === 'error' ? (
              <span className="text-red-700 dark:text-red-400">
                {label} {strings.loadError}
              </span>
            ) : (
              <>
                <span className="grow">
                  {strings.loadingSystem} {label}
                </span>
                <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-sky-500 transition-[width] duration-200"
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </span>
                <span className="w-8 text-right tabular-nums">{pct}%</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Dev-only (or ?stats=1): fps, draw calls, triangles and memory from renderer.info. */
export function StatsOverlay({ bus }: { bus: ViewerBus }) {
  const el = useRef<HTMLPreElement>(null);
  useEffect(
    () =>
      bus.stats.on((s) => {
        if (!el.current || !s) return;
        el.current.textContent =
          `${s.fps} fps · ${s.drawCalls} calls · ${(s.triangles / 1000).toFixed(1)}k tris\n` +
          `geo ${s.geometries} · tex ${s.textures} · dpr ${s.dpr.toFixed(2)} · ${s.batches} chunks / ${s.instances} inst`;
      }),
    [bus],
  );
  return (
    <pre
      ref={el}
      className="pointer-events-none absolute m-0 rounded bg-black/60 px-2 py-1 font-mono text-[10px] leading-4 text-lime-300"
      style={{ top: 'var(--atlas-stats-top, 72px)', left: 'var(--atlas-stats-left, 12px)' }}
      data-testid="viewer-stats"
    />
  );
}
