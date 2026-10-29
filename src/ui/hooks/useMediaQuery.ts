import { useSyncExternalStore } from 'react';

function mql(query: string): MediaQueryList | null {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query)
      : null;
  } catch {
    return null;
  }
}

export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = mql(query);
      if (!m) return () => {};
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => mql(query)?.matches ?? fallback,
    () => fallback,
  );
}

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

/** phone < 640 px ≤ tablet < 1024 px ≤ desktop. Defaults to desktop where matchMedia is unavailable. */
export function useBreakpoint(): Breakpoint {
  const tabletUp = useMediaQuery('(min-width: 640px)', true);
  const desktopUp = useMediaQuery('(min-width: 1024px)', true);
  return desktopUp ? 'desktop' : tabletUp ? 'tablet' : 'phone';
}
