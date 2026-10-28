import { APP_NAME } from '@/config';

/** Phase 0 placeholder. Agent C replaces this with the real UI. */
export function AppUi() {
  return (
    <header className="pointer-events-none absolute top-0 left-0 p-4 text-lg font-semibold text-white">
      <h1>{APP_NAME}</h1>
    </header>
  );
}
