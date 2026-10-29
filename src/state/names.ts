import type { Lang, Names, PatchKind, StructureKind } from '@/contract';

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

/** Origin/insertion patches share their muscle's name; callers show this kind next to the name. */
export function patchKindOf(node: object | null | undefined): PatchKind | undefined {
  const kind = node && 'kind' in node ? (node.kind as StructureKind | undefined) : undefined;
  return kind === 'origin' || kind === 'insertion' ? kind : undefined;
}
