// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildTa2Index, buildTranslations, matchTa2, parseDefinition, parseTa2Csv } from './texts.mjs';

describe('parseDefinition', () => {
  it('strips the title paragraph and trailing Wikipedia URL', () => {
    const d = parseDefinition(
      '\n\nFEMUR\n\n\nThe femur is a bone.\n\nIt is long.\n\n\nhttps://en.wikipedia.org/wiki/Femur',
    );
    expect(d).toEqual({
      text: 'The femur is a bone.\n\nIt is long.',
      sourceUrl: 'https://en.wikipedia.org/wiki/Femur',
      source: 'Wikipedia',
      license: 'CC-BY-SA-3.0',
      lang: 'en',
    });
  });
  it('handles multi-line titles and empty trailing sections', () => {
    const d = parseDefinition(
      '\n\nSKELETAL SYSTEM/\nSKELETON\n\nHuman:\n\nText.\n\n== Notes ==\n\n\n\n== References ==\n\n\nhttps://en.wikipedia.org/wiki/Skeleton#Humans',
    );
    expect(d.text).toBe('Human:\n\nText.');
    expect(d.sourceUrl).toBe('https://en.wikipedia.org/wiki/Skeleton#Humans');
  });
  it('removes whitespace-only lines', () => {
    const d = parseDefinition(
      'HEAD\n\nA head.\n\n== Gallery ==\n\n\t\t\n\t\t\n\nhttps://en.wikipedia.org/wiki/Head',
    );
    expect(d.text).toBe('A head.');
  });
  it('uses Z-Anatomy / host for other sources', () => {
    expect(parseDefinition('TITLE\n\nSome text.')).toMatchObject({
      source: 'Z-Anatomy',
      license: 'CC-BY-SA-4.0',
      sourceUrl: undefined,
    });
    expect(parseDefinition('TITLE\n\nSome text.\nhttps://ta2viewer.openanatomy.org/?id=1')).toMatchObject({
      source: 'ta2viewer.openanatomy.org',
      license: 'CC-BY-SA-4.0',
    });
    expect(parseDefinition('TITLE\n\nTranslated text.\nhttps://fr.wikipedia.org/wiki/X')).toMatchObject({
      source: 'Wikipedia',
      lang: 'en',
    });
  });
  it('returns null for title-only texts', () => {
    expect(parseDefinition('\n\n(ACCESSORY PANCREAS)\n')).toBeNull();
    expect(parseDefinition('')).toBeNull();
    expect(parseDefinition(undefined)).toBeNull();
  });
  it('keeps a first paragraph with lower-case letters', () => {
    expect(parseDefinition('The liver is an organ.\n\nMore.').text).toBe('The liver is an organ.\n\nMore.');
  });
});

describe('buildTranslations', () => {
  it('maps the columns and keeps the first duplicate', () => {
    const { map, conflicts, languages } = buildTranslations({
      header: ['English', 'Latin', 'Français', 'Español', 'Portugues'],
      rows: [
        ['Femur', 'Os femoris', 'Fémur', 'Hueso Fémur', 'Fêmur'],
        ['Femur ', 'Femur', '', '', ''],
        ['Liver', 'Hepar', 'Foie', 'Hígado', 'Fígado'],
      ],
    });
    expect(map.get('Femur')).toEqual({ la: 'Os femoris', fr: 'Fémur', es: 'Hueso Fémur', pt: 'Fêmur' });
    expect(conflicts).toEqual(['Femur']);
    expect(languages).toEqual(['en', 'la', 'fr', 'es', 'pt']);
  });
});

describe('TA2', () => {
  const csv =
    '\uFEFF\n"TA2ID;English;Latin;Français;Español;Portugues;Italiano;Parsi"\n' +
    '"1360;Femur;Os femoris;Fémur;Fémur;Fêmur;Femore;x"\n' +
    '"10;Medial;Medialis;Médial;Medial;Medial;Mediale;x"\n' +
    '"20;Body;Corpus;Corps;Cuerpo;Corpo;Corpo;x"\n' +
    '"21;Body;Corpus vertebrae;Corps;Cuerpo;Corpo;Corpo;x"\n' +
    '"22;Body;Corpus;Corps;Cuerpo;Corpo;Corpo;x"\n';
  const rows = parseTa2Csv(csv);
  const index = buildTa2Index(rows);
  it('parses the quoted, BOM-prefixed CSV', () => {
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({ id: '1360', en: 'Femur', la: 'Os femoris' });
  });
  it('matches unique English names case/whitespace-insensitively', () => {
    expect(matchTa2(index, ' femur ', undefined)).toMatchObject({ status: 'match', row: { id: '1360' } });
    expect(matchTa2(index, 'Hip bone', 'Os coxae')).toEqual({ status: 'none' });
  });
  it('disambiguates only by an identical Latin name', () => {
    expect(matchTa2(index, 'Body', 'Corpus vertebrae')).toMatchObject({ status: 'match', row: { id: '21' } });
    expect(matchTa2(index, 'Body', 'Corpus')).toEqual({ status: 'ambiguous' });
    expect(matchTa2(index, 'Body', undefined)).toEqual({ status: 'ambiguous' });
  });
  it('is optional', () => {
    expect(matchTa2(null, 'Femur')).toEqual({ status: 'none' });
  });
});
