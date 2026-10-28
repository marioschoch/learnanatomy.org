import { useAtlasStore } from '@/state';

/** Phase 0 placeholder. Agent B replaces this with the real viewer. */
export function Viewer() {
  const status = useAtlasStore((s) => s.dataStatus);
  const kind = useAtlasStore((s) => s.dataSource?.kind);
  return (
    <div className="flex h-full items-center justify-center bg-neutral-900 text-sm text-neutral-400">
      Viewer placeholder · data: {status} {kind ? `(${kind})` : ''}
    </div>
  );
}
