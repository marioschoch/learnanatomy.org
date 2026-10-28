import type { Lang, Names } from '@/contract';

/**
 * Name to display for the preferred language. Falls back Latin → English. Never translates.
 */
export function displayName(names: Names, lang: Lang): string {
  return names[lang] ?? names.la ?? names.en;
}

/** All distinct names of a node (for search and the info panel), preferred language first. */
export function allNames(names: Names, lang: Lang): string[] {
  const out = [displayName(names, lang)];
  for (const value of Object.values(names)) {
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}
