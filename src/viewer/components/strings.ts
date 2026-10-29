/**
 * The few UI strings the viewer renders itself (DE/EN, follows `uiLang`). View names and system names come
 * from the shared i18n dictionary (src/i18n, Agent C) where they already exist.
 */
import type { PatchKind } from '@/contract';
import { useAtlasStore } from '@/state';

export interface ViewerStrings {
  orientation: string;
  loadingSystem: string;
  loadError: string;
  webglError: string;
  starting: string;
  kind: Record<PatchKind, string>;
}

const STRINGS: Record<'en' | 'de', ViewerStrings> = {
  en: {
    orientation: 'Orientation in the patient’s directions — click a letter for that view',
    loadingSystem: 'Loading',
    loadError: 'could not be loaded',
    webglError: 'The 3D view needs WebGL 2, which is not available in this browser.',
    starting: 'Starting 3D view…',
    kind: { origin: 'origin', insertion: 'insertion' },
  },
  de: {
    orientation: 'Orientierung in Patientenrichtungen — Buchstabe anklicken für diese Ansicht',
    loadingSystem: 'Lade',
    loadError: 'konnte nicht geladen werden',
    webglError: 'Die 3D-Ansicht benötigt WebGL 2, das in diesem Browser nicht verfügbar ist.',
    starting: '3D-Ansicht wird gestartet…',
    kind: { origin: 'Ursprung', insertion: 'Ansatz' },
  },
};

export function useViewerStrings(): ViewerStrings {
  const lang = useAtlasStore((s) => s.uiLang);
  return STRINGS[lang] ?? STRINGS.en;
}
