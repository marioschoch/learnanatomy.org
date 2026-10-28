// Minimal typing of the test hook exposed by src/state/bootstrap.ts (window.__atlas) for E2E tests.
// The full types live in src/contract/store.ts; E2E code only reads a few fields.
interface AtlasTestHook {
  store: {
    getState(): Record<string, unknown> & { dataStatus: string };
    setState(partial: Record<string, unknown>): void;
  };
  dataSource: { kind: 'http' | 'mock' };
}

interface Window {
  __atlas?: AtlasTestHook;
}
