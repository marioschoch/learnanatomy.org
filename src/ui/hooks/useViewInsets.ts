import { useLayoutEffect, type RefObject } from 'react';
import { useAtlasStore } from '@/state';

const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Reports the canvas area covered by a top bar and a bottom area (store `viewInsets`), so the viewer centres the
 * body and focused structures in the visible rest. In the bottom area only elements marked `data-view-cover`
 * count (sheets, the bottom bar); the small selection peek and the one-time hint are left out, so a tap or
 * dismissing the hint does not shift the view. Insets are reset when the layout unmounts.
 */
export function useReportViewInsets(
  header: RefObject<HTMLElement | null>,
  bottom: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    const h = header.current;
    const b = bottom.current;
    if (!h || !b) return;
    const report = () => {
      const frame = (h.offsetParent ?? document.documentElement).getBoundingClientRect();
      let coverTop = frame.bottom;
      for (const el of b.querySelectorAll<HTMLElement>('[data-view-cover]'))
        coverTop = Math.min(coverTop, el.getBoundingClientRect().top);
      useAtlasStore.getState().setViewInsets({
        top: Math.max(0, Math.round(h.getBoundingClientRect().bottom - frame.top)),
        right: 0,
        bottom: Math.max(0, Math.round(frame.bottom - coverTop)),
        left: 0,
      });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(h);
    ro.observe(b);
    window.addEventListener('resize', report);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', report);
      useAtlasStore.getState().setViewInsets(ZERO);
    };
  }, [header, bottom]);
}
