/**
 * UI strings (DE/EN). OWNER: Agent C.
 * `initI18n()` is called once in main.tsx. The UI language follows `useAtlasStore.uiLang`
 * (default: browser language; a saved preference is applied by the UI on mount).
 * Anatomical names never go through i18n; they come from the data (see src/state/names.ts).
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { UiLang } from '@/contract';
import { useAtlasStore } from '@/state';
import { de } from './de';
import { en } from './en';

export { en, de };
export type { Messages } from './en';

export const resources = {
  en: { translation: en },
  de: { translation: de },
} as const;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}

let initialized = false;
let unsubscribe: (() => void) | null = null;

function applyDocumentLang(lang: UiLang) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

/** Initialise i18next synchronously (resources are bundled) and follow the store's `uiLang`. */
export function initI18n(lang: UiLang = useAtlasStore.getState().uiLang): typeof i18next {
  if (!initialized) {
    void i18next.use(initReactI18next).init({
      resources,
      lng: lang,
      fallbackLng: 'en',
      supportedLngs: ['en', 'de'],
      interpolation: { escapeValue: false },
      initAsync: false,
    });
    initialized = true;
  } else if (i18next.language !== lang) {
    void i18next.changeLanguage(lang);
  }
  applyDocumentLang(lang);
  unsubscribe?.();
  unsubscribe = useAtlasStore.subscribe(
    (s) => s.uiLang,
    (next) => {
      void i18next.changeLanguage(next);
      applyDocumentLang(next);
    },
  );
  return i18next;
}

/**
 * Translate a key that is only known at runtime (system / region ids). Falls back to `fallback`
 * (the English name from the data) when there is no UI label for that id.
 * Call it during render of a component that uses `useTranslation()` so it re-renders on language change.
 */
export function tDynamic(key: string, fallback: string): string {
  const t = i18next.t as unknown as (k: string, o: { defaultValue: string }) => string;
  return t(key, { defaultValue: fallback });
}
