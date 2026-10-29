/** Human-readable labels and URLs for the SPDX-like licence ids used in the data. */
export function licenseLabel(id: string): string {
  const cc = /^CC-(BY(?:-NC)?(?:-SA|-ND)?)-(\d\.\d)(?:-([A-Z]+))?$/i.exec(id);
  if (cc) return `CC ${cc[1]!.toUpperCase()} ${cc[2]}${cc[3] ? ` ${cc[3].toUpperCase()}` : ''}`;
  if (/^CC0-1\.0$/i.test(id)) return 'CC0 1.0';
  return id;
}

export function licenseUrl(id: string): string | undefined {
  const cc = /^CC-(BY(?:-NC)?(?:-SA|-ND)?)-(\d\.\d)(?:-([A-Z]+))?$/i.exec(id);
  if (cc)
    return `https://creativecommons.org/licenses/${cc[1]!.toLowerCase()}/${cc[2]}/${cc[3] ? `${cc[3].toLowerCase()}/` : ''}`;
  if (/^CC0-1\.0$/i.test(id)) return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (/^MIT$/i.test(id)) return 'https://opensource.org/license/mit';
  return undefined;
}
