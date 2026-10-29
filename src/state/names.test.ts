import { displayName, patchKindOf } from './names';

describe('names', () => {
  it('falls back Latin → English and never translates', () => {
    expect(displayName({ en: 'Femur', la: 'Os femoris' }, 'de')).toBe('Os femoris');
    expect(displayName({ en: 'Femur' }, 'la')).toBe('Femur');
  });

  it('reports the kind of origin/insertion patches only', () => {
    expect(patchKindOf({ kind: 'origin' })).toBe('origin');
    expect(patchKindOf({ kind: 'insertion' })).toBe('insertion');
    expect(patchKindOf({ kind: 'structure' })).toBeUndefined();
    expect(patchKindOf({ id: 'g-heart' })).toBeUndefined();
    expect(patchKindOf(undefined)).toBeUndefined();
  });
});
