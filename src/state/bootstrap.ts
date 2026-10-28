/**
 * Chooses the data source at startup and exposes test hooks.
 *
 *  ?data=mock              → mock data (also VITE_DATA_SOURCE=mock)
 *  dev + no manifest.json  → mock data with a console warning (before the pipeline has run)
 *  ?testHooks=1 or dev     → window.__atlas = { store } for Playwright / the QA agent
 */
import type { AtlasDataSource, GlbDecoder } from '@/contract';
import { MODELS_BASE_URL } from '@/config';
import { createMockDataSource } from '@/mocks';
import { createHttpDataSource } from './httpDataSource';
import { useAtlasStore } from './store';

declare global {
  interface Window {
    __atlas?: { store: typeof useAtlasStore; dataSource: AtlasDataSource };
  }
}

export async function chooseDataSource(decodeGlb: GlbDecoder): Promise<AtlasDataSource> {
  const params = new URLSearchParams(window.location.search);
  if (params.get('data') === 'mock' || import.meta.env.VITE_DATA_SOURCE === 'mock') {
    return createMockDataSource({ latencyMs: Number(params.get('mockLatency') ?? 0) });
  }
  const http = createHttpDataSource({ baseUrl: MODELS_BASE_URL, decodeGlb });
  if (import.meta.env.DEV) {
    try {
      const res = await fetch(`${MODELS_BASE_URL}manifest.json`, { method: 'HEAD' });
      const isJson = res.headers.get('content-type')?.includes('json');
      if (!res.ok || !isJson) {
        console.warn(
          '[atlas] public/models/manifest.json not found — using mock data. Run `npm run assets:build`.',
        );
        return createMockDataSource();
      }
    } catch {
      return createMockDataSource();
    }
  }
  return http;
}

export async function bootstrap(decodeGlb: GlbDecoder): Promise<void> {
  const dataSource = await chooseDataSource(decodeGlb);
  const params = new URLSearchParams(window.location.search);
  if (import.meta.env.DEV || params.has('testHooks')) {
    window.__atlas = { store: useAtlasStore, dataSource };
  }
  await useAtlasStore.getState().init(dataSource);
}
