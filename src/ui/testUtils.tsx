/** Test helpers for UI component tests (jsdom): mock data store, i18n, small DOM polyfills. */
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { createMockDataSource } from '@/mocks';
import { initI18n } from '@/i18n';
import { resetAtlasStore, useAtlasStore } from '@/state';
import { useQuizLauncher } from '@/quiz/launcher';
import { useUiStore } from './uiStore';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

export function installDomStubs(height = 600): void {
  const g = globalThis as unknown as { ResizeObserver?: unknown };
  if (!g.ResizeObserver) g.ResizeObserver = ResizeObserverStub;
  // jsdom has no layout: give scroll containers a size so the virtualizer renders rows.
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => height });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 320 });
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
}

/** Fresh atlas store on mock data (manifest, search index, default-visible systems loaded), English UI. */
export async function initMockStore(lang: 'en' | 'de' = 'en'): Promise<void> {
  installDomStubs();
  resetAtlasStore();
  useUiStore.setState({
    sidebarOpen: null,
    sidebarTab: 'layers',
    sheet: null,
    helpOpen: false,
    aboutOpen: false,
    toast: null,
  });
  useQuizLauncher.setState({ open: false, seq: 0, initialScope: null });
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  useAtlasStore.getState().setUiLang(lang);
  initI18n(lang);
  await useAtlasStore.getState().init(createMockDataSource());
}

/** render() inside the providers AppUi normally supplies (Radix Tooltip). */
export function renderUi(ui: ReactElement) {
  return render(<Tooltip.Provider>{ui}</Tooltip.Provider>);
}
