/**
 * Small UI preferences persisted in localStorage (try/catch via storage.ts): UI language, name language,
 * theme and an explicit reduced-motion choice. Nothing else is stored (quiz progress has its own key).
 */
import type { NameLang, ThemePref, UiLang } from '@/contract';
import { useAtlasStore } from '@/state';
import { readJson, writeJson } from './storage';

const KEY = 'prefs.v1';

export interface StoredPrefs {
  uiLang?: UiLang;
  nameLang?: NameLang;
  theme?: ThemePref;
  reducedMotion?: boolean;
  hintSeen?: boolean;
}

const UI_LANGS: UiLang[] = ['de', 'en'];
const NAME_LANGS: NameLang[] = ['la', 'en', 'de', 'fr', 'es', 'pt'];
const THEMES: ThemePref[] = ['light', 'dark', 'system'];

export function loadPrefs(): StoredPrefs {
  const raw = readJson<Record<string, unknown>>(KEY);
  if (!raw || typeof raw !== 'object') return {};
  const out: StoredPrefs = {};
  if (UI_LANGS.includes(raw.uiLang as UiLang)) out.uiLang = raw.uiLang as UiLang;
  if (NAME_LANGS.includes(raw.nameLang as NameLang)) out.nameLang = raw.nameLang as NameLang;
  if (THEMES.includes(raw.theme as ThemePref)) out.theme = raw.theme as ThemePref;
  if (typeof raw.reducedMotion === 'boolean') out.reducedMotion = raw.reducedMotion;
  if (raw.hintSeen === true) out.hintSeen = true;
  return out;
}

export function savePrefs(patch: StoredPrefs): void {
  writeJson(KEY, { ...loadPrefs(), ...patch });
}

/** Apply saved preferences to the store (once, on mount). The URL may override nameLang later. */
export function applyStoredPrefs(): StoredPrefs {
  const p = loadPrefs();
  const s = useAtlasStore.getState();
  if (p.uiLang && p.uiLang !== s.uiLang) s.setUiLang(p.uiLang);
  if (p.nameLang && p.nameLang !== s.nameLang) s.setNameLang(p.nameLang);
  if (p.theme && p.theme !== s.theme) s.setTheme(p.theme);
  if (p.reducedMotion !== undefined && p.reducedMotion !== s.reducedMotion)
    s.setReducedMotion(p.reducedMotion);
  return p;
}
