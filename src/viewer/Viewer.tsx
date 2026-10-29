/**
 * Full-screen 3D viewer, driven only by the store (no props). The canvas code is a lazy chunk; the backdrop and
 * a small "starting" hint render immediately.
 *
 * The root creates its own stacking context (`isolate`), so label z-indices stay below the UI layer.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { BACKDROP_DARK, BACKDROP_LIGHT, backdropCss, isDarkDocument } from './components/background';
import { useViewerStrings } from './components/strings';

const ViewerCanvas = lazy(() => import('./components/ViewerCanvas'));

function useDarkDocument(): boolean {
  const [dark, setDark] = useState(isDarkDocument);
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(isDarkDocument()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function Starting() {
  const s = useViewerStrings();
  return (
    <div className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
      {s.starting}
    </div>
  );
}

export function Viewer() {
  const dark = useDarkDocument();
  return (
    <div
      className="relative isolate h-full w-full overflow-hidden select-none"
      style={{ background: backdropCss(dark ? BACKDROP_DARK : BACKDROP_LIGHT) }}
      data-testid="viewer"
    >
      <Suspense fallback={<Starting />}>
        <ViewerCanvas />
      </Suspense>
    </div>
  );
}
