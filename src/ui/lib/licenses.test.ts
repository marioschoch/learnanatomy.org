import { licenseLabel, licenseUrl } from './licenses';

describe('licences', () => {
  it('formats Creative Commons ids', () => {
    expect(licenseLabel('CC-BY-SA-3.0')).toBe('CC BY-SA 3.0');
    expect(licenseLabel('CC-BY-NC-SA-4.0')).toBe('CC BY-NC-SA 4.0');
    expect(licenseLabel('CC-BY-SA-2.1-JP')).toBe('CC BY-SA 2.1 JP');
    expect(licenseUrl('CC-BY-NC-4.0')).toBe('https://creativecommons.org/licenses/by-nc/4.0/');
    expect(licenseUrl('CC-BY-SA-2.1-JP')).toBe('https://creativecommons.org/licenses/by-sa/2.1/jp/');
    expect(licenseUrl('CC0-1.0')).toContain('publicdomain/zero');
    expect(licenseLabel('Custom')).toBe('Custom');
    expect(licenseUrl('Custom')).toBeUndefined();
  });
});
