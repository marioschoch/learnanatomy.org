/**
 * Global keyboard shortcuts (listed in the help overlay). Ignored while typing in a field,
 * except Ctrl/Cmd+K which always focuses the search.
 */
import { useEffect } from 'react';
import type { StandardView } from '@/contract';
import { STANDARD_VIEWS } from '@/contract';
import { useAtlasStore } from '@/state';
import {
  focusSearch,
  focusSelection,
  hideSelection,
  resetCamera,
  setView,
  toggleIsolate,
  zoom,
} from '../lib/actions';
import { useUiStore } from '../uiStore';

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (t as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'range', 'submit'].includes(type);
  }
  return false;
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const ui = useUiStore.getState();
      if (ui.helpOpen || ui.aboutOpen) return; // dialogs handle their own keys
      const s = useAtlasStore.getState();
      const quiz = s.mode === 'quiz';
      const key = e.key;
      let handled = true;
      if (key === '/' && !quiz) focusSearch();
      else if (key === '?') ui.setHelpOpen(true);
      else if (key === 'Escape') {
        if (ui.sheet) ui.setSheet(null);
        else if (!quiz && s.isolate.mode !== 'none') s.exitIsolate();
        else if (!quiz && s.selectedId) s.select(null);
        else handled = false;
      } else if (!quiz && /^[1-6]$/.test(key)) setView(STANDARD_VIEWS[Number(key) - 1] as StandardView);
      else if (key === '+' || key === '=') zoom(1.25);
      else if (key === '-' || key === '_') zoom(0.8);
      else if (key === 'r' || key === 'R') resetCamera();
      else if (key === 'x' || key === 'X') s.setXray(!s.xray);
      else if (!quiz && (key === 'l' || key === 'L')) s.setLabelsVisible(!s.labelsVisible);
      else if (!quiz && (key === 'f' || key === 'F')) focusSelection();
      else if (!quiz && (key === 'i' || key === 'I')) toggleIsolate('isolate');
      else if (!quiz && (key === 'h' || key === 'H')) hideSelection();
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
