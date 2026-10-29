import { act } from '@testing-library/react';
import i18next from 'i18next';
import { resetAtlasStore, useAtlasStore } from '@/state';
import { de, en, initI18n, tDynamic } from './index';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n', () => {
  beforeEach(() => resetAtlasStore());

  it('German and English have exactly the same keys', () => {
    expect(keys(de).sort()).toEqual(keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const dict of [en, de]) {
      for (const k of keys(dict)) {
        const value = k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], dict);
        expect(typeof value === 'string' && value.trim().length > 0, k).toBe(true);
      }
    }
  });

  it('follows the store uiLang', () => {
    initI18n('en');
    expect(i18next.t('presets.skeleton')).toBe('Skeleton');
    act(() => useAtlasStore.getState().setUiLang('de'));
    expect(i18next.t('presets.skeleton')).toBe('Skelett');
    expect(document.documentElement.lang).toBe('de');
    act(() => useAtlasStore.getState().setUiLang('en'));
    expect(i18next.t('presets.skeleton')).toBe('Skeleton');
  });

  it('labels unknown system ids with the fallback from the data', () => {
    initI18n('en');
    expect(tDynamic('systems.skeletal', 'x')).toBe('Skeletal system');
    expect(tDynamic('systems.unknown-system', 'From data')).toBe('From data');
  });
});
