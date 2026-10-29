/**
 * App-wide effects of the UI: saved preferences, theme class, reduced motion, persistence.
 */
import { useEffect, useLayoutEffect } from 'react';
import { useAtlasStore } from '@/state';
import { applyStoredPrefs, loadPrefs, savePrefs } from '../lib/prefs';
import { useMediaQuery } from './useMediaQuery';

export function useAppEffects(): void {
  // Saved preferences before the first paint.
  useLayoutEffect(() => {
    applyStoredPrefs();
  }, []);

  // Persist preference changes.
  useEffect(
    () =>
      useAtlasStore.subscribe(
        (s) => [s.uiLang, s.nameLang, s.theme] as const,
        ([uiLang, nameLang, theme]) => savePrefs({ uiLang, nameLang, theme }),
        { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] },
      ),
    [],
  );

  // Theme → `.dark` on <html> (Tailwind class-based dark mode) + native color-scheme.
  const theme = useAtlasStore((s) => s.theme);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  // Follow the OS reduced-motion setting unless the user chose explicitly.
  const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  useEffect(() => {
    if (loadPrefs().reducedMotion !== undefined) return;
    const s = useAtlasStore.getState();
    if (s.reducedMotion !== prefersReduced) s.setReducedMotion(prefersReduced);
  }, [prefersReduced]);
}
