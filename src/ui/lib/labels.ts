/**
 * UI labels for systems and regions (keyed by id in i18n, falling back to the English name from the data)
 * and small text helpers. Anatomical structure names always come from the data via displayName().
 */
import type { Manifest, NameLang, RegionInfo, SystemInfo } from '@/contract';
import { tDynamic } from '@/i18n';

export function systemLabel(sys: Pick<SystemInfo, 'id' | 'names'> | undefined, fallbackId = ''): string {
  if (!sys) return fallbackId;
  return tDynamic(`systems.${sys.id}`, sys.names.en);
}

export function regionLabel(region: Pick<RegionInfo, 'id' | 'names'> | undefined, fallbackId = ''): string {
  if (!region) return fallbackId;
  return tDynamic(`regions.${region.id}`, region.names.en);
}

export function findSystem(manifest: Manifest | null, id: string): SystemInfo | undefined {
  return manifest?.systems.find((s) => s.id === id);
}

export function findRegion(manifest: Manifest | null, id: string): RegionInfo | undefined {
  return manifest?.regions.find((r) => r.id === id);
}

/** Systems in render order (inner → outer), which is also a sensible reading order. */
export function sortedSystems(manifest: Manifest | null): SystemInfo[] {
  return [...(manifest?.systems ?? [])].sort((a, b) => a.layerOrder - b.layerOrder);
}

/**
 * Name languages offered in the toggle: Latin and English always, German only when the data has it
 * (ARCHITECTURE.md §12.1). fr/es/pt stay in the metadata and are shown in the info panel.
 */
export function nameLangOptions(manifest: Manifest | null): NameLang[] {
  const langs: NameLang[] = ['la', 'en'];
  if (manifest?.languages.includes('de')) langs.push('de');
  return langs;
}

/** Lowercase, strip diacritics, collapse whitespace. Used for filtering and answer checks. */
export function normalizeText(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
