import { AppUi } from './ui';
import { Viewer } from './viewer';

/**
 * Root layout: the 3D viewer fills the screen, the UI is layered on top.
 * Viewer (src/viewer, Agent B) and UI (src/ui, Agent C) communicate only through the store.
 */
export function App() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0" data-testid="viewer-root">
        <Viewer />
      </div>
      <AppUi />
    </div>
  );
}
