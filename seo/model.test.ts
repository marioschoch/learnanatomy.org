// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildSite } from './model';
import { testData, testWikidata } from './testData';

const site = buildSite(testData());
const page = (slug: string) => {
  const p = site.bySlug.get(slug);
  if (!p) throw new Error(`no page ${slug}`);
  return p;
};

describe('buildSite', () => {
  it('merges left/right pairs into one page that opens the left side', () => {
    const femur = page('femur');
    expect(femur.ids).toEqual(['femur-l', 'femur-r']);
    expect(femur.sides).toEqual(['left', 'right']);
    expect(femur.openId).toBe('femur-l');
    expect(site.slugOfId.get('femur-r')).toBe('femur');
  });

  it('folds same-named structures into their group', () => {
    const midbrain = page('midbrain');
    expect(midbrain.type).toBe('group');
    expect(midbrain.mergedIds).toEqual(['midbrain-l', 'midbrain-r']);
    expect(site.slugOfId.get('midbrain-l')).toBe('midbrain');
    expect(site.pages.filter((p) => p.names.en === 'Midbrain')).toHaveLength(1);
  });

  it('drops empty groups and landmarks without a description', () => {
    expect(site.bySlug.has('empty-group')).toBe(false);
    expect(site.bySlug.has('linea-aspera')).toBe(false);
    expect(page('femur').landmarks).toEqual([
      { slug: 'greater-trochanter', names: { en: 'Greater trochanter', la: 'Trochanter major' } },
      { names: { en: 'Linea aspera' } },
    ]);
  });

  it('resolves slug clashes by priority (landmark before skin region)', () => {
    expect(page('greater-trochanter').type).toBe('landmark');
    expect(page('greater-trochanter-region').system).toBe('regions');
  });

  it('links hierarchy, siblings and the landmark’s structure', () => {
    expect(page('femur').ancestors).toEqual(['bones-of-lower-limb']);
    expect(page('femur').siblings).toEqual(['tibia']);
    expect(page('bones-of-lower-limb').parts.sort()).toEqual(['femur', 'tibia']);
    expect(page('greater-trochanter').ancestors).toEqual(['bones-of-lower-limb', 'femur']);
    expect(page('greater-trochanter').thumbSlug).toBe('femur');
    expect(page('greater-trochanter').render).toBeUndefined();
  });

  it('lists muscle attachments both ways, matching patches without muscleId by name', () => {
    expect(page('biceps').attachments).toMatchObject({ origins: ['scapula'], insertions: ['radius'] });
    expect(page('long-head-of-biceps').attachments.origins).toEqual(['scapula']);
    expect(page('radius').attachments.insertionOf).toEqual(['biceps']);
    expect(page('scapula').attachments.originOf).toEqual(['long-head-of-biceps']);
  });

  it('chooses what the page image shows', () => {
    expect(page('femur').render).toMatchObject({
      ids: ['femur-l', 'femur-r'],
      view: 'anterior',
      mode: 'context',
    });
    expect(page('humerus').render?.ids).toEqual(['humerus-l']); // sides too far apart
    expect(page('stapes').render?.mode).toBe('isolate');
    expect(page('trapezius').render?.view).toBe('posterior');
    expect(page('greater-trochanter-region').render?.zoomOut).toBeGreaterThan(1);
  });
});

describe('buildSite with Wikidata', () => {
  const wdSite = buildSite({ ...testData(), wikidata: testWikidata() });
  const wdPage = (slug: string) => wdSite.bySlug.get(slug)!;

  it('adds the German article of the English description', () => {
    const femur = wdPage('femur');
    expect(femur.qid).toBe('Q1');
    expect(femur.definitionDe).toMatchObject({
      source: 'Wikipedia',
      sourceUrl: 'https://de.wikipedia.org/wiki/Oberschenkelknochen',
      license: 'CC-BY-SA-4.0',
      reviewed: false,
    });
    expect(femur.definitionDe?.text.de).toMatch(/^Der Oberschenkelknochen/);
  });

  it('lists supply and function, linking targets that have a page', () => {
    const biceps = wdPage('biceps');
    expect(biceps.relations?.innervation).toEqual([
      {
        slug: 'musculocutaneous-nerve',
        label: { en: 'musculocutaneous nerve', de: 'Nervus musculocutaneus' },
      },
      { label: { en: 'radial nerve' } },
    ]);
    expect(biceps.relations?.action).toEqual([
      { label: { en: 'elbow flexion', de: 'Beugung im Ellenbogengelenk' } },
    ]);
    // targets without a page and without a label are left out
    expect(biceps.relations?.arterialSupply).toBeUndefined();
  });

  it('takes supply and function from the page’s own item only (TA2 before the article)', () => {
    const head = wdPage('long-head-of-biceps');
    expect(head.qid).toBe('Q20');
    expect(head.relations).toBeUndefined();
    // the German text still follows the English description's article
    expect(head.definitionDe?.sourceUrl).toBe('https://de.wikipedia.org/wiki/Musculus_biceps_brachii');
  });

  it('builds the same pages without the Wikidata file', () => {
    expect(wdSite.pages.map((p) => p.slug)).toEqual(site.pages.map((p) => p.slug));
    expect(site.pages.some((p) => p.qid || p.relations || p.definitionDe)).toBe(false);
  });
});
