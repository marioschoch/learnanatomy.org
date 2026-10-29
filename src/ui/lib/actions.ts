/**
 * UI actions shared by the toolbar, info panel, phone sheets and keyboard shortcuts.
 * They only call public store actions and viewer commands (never the viewer directly).
 */
import type { IsolateMode, StandardView, ViewerCommandResult } from '@/contract';
import { APP_NAME } from '@/config';
import i18next from 'i18next';
import { useAtlasStore } from '@/state';
import { useUiStore } from '../uiStore';
import { currentShareUrl } from './urlSync';

const store = () => useAtlasStore.getState();
const animate = () => !store().reducedMotion;

export const SEARCH_INPUT_ID = 'atlas-search';

export function focusSearch(): void {
  const el = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
  el?.focus();
  el?.select();
}

export function focusIds(ids: string[]): void {
  if (ids.length) void store().requestViewer({ type: 'focus', ids, animate: animate() });
}

export function focusSelection(): void {
  const id = store().selectedId;
  if (id) focusIds([id]);
}

export function setView(view: StandardView): void {
  void store().requestViewer({ type: 'setView', view, animate: animate() });
}

export function resetCamera(): void {
  void store().requestViewer({ type: 'resetCamera', animate: animate() });
}

export function zoom(factor: number): void {
  void store().requestViewer({ type: 'zoom', factor });
}

/** Isolate `ids` (default: selection) in `mode`; the same isolate again exits. */
export function toggleIsolate(mode: Exclude<IsolateMode, 'none'> = 'isolate', ids?: string[]): void {
  const s = store();
  const target = ids ?? (s.selectedId ? [s.selectedId] : []);
  if (s.isolate.mode === mode && sameIds(s.isolate.ids, target)) {
    s.exitIsolate();
    return;
  }
  if (target.length === 0) {
    if (s.isolate.mode !== 'none') s.exitIsolate();
    return;
  }
  s.setIsolate(mode, target);
  focusIds(target);
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function hideSelection(): void {
  const s = store();
  const id = s.selectedId;
  if (!id || s.landmarks[id]) return;
  s.setNodeHidden(id, true);
  s.select(null);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

export async function takeScreenshot(): Promise<void> {
  const res: ViewerCommandResult | null = await withTimeout(
    store().requestViewer({ type: 'screenshot', scale: 2 }),
    10_000,
  );
  if (res && res.ok && res.type === 'screenshot') {
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    a.href = res.dataUrl;
    a.download = `${APP_NAME.toLowerCase().replace(/\s+/g, '-')}-${stamp}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    useUiStore.getState().showToast(i18next.t('toolbar.screenshotFailed'), 'error');
  }
}

export async function copyShareLink(): Promise<void> {
  const url = currentShareUrl();
  try {
    await navigator.clipboard.writeText(url);
    useUiStore.getState().showToast(i18next.t('toolbar.shareCopied'));
  } catch {
    useUiStore.getState().showToast(i18next.t('toolbar.shareFailed'), 'error');
  }
}
