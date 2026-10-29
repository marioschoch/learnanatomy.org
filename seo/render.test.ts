// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildSite } from './model';
import {
  excerpt,
  parseBlocks,
  renderNotFound,
  renderPage,
  renderSitemap,
  tidy,
  truncate,
  type RenderContext,
} from './render';
import { testData } from './testData';

const site = buildSite(testData());
const ctx = (images = false): RenderContext => ({
  site,
  hasThumb: () => images,
  hasCard: () => images,
  lastmod: '2026-10-29',
});
const femur = site.bySlug.get('femur')!;

describe('description text', () => {
  it('tidies upstream artefacts', () => {
    expect(tidy('The femur (, pl. femora ), or thigh bone ( ) .')).toBe(
      'The femur (pl. femora), or thigh bone.',
    );
  });
  it('parses headings and lists', () => {
    expect(parseBlocks('Intro.\n-One\n-Two\n\n== Notes ==\n\nMore')).toEqual([
      { kind: 'p', text: 'Intro.' },
      { kind: 'ul', items: ['One', 'Two'] },
      { kind: 'h', text: 'Notes' },
      { kind: 'p', text: 'More' },
    ]);
  });
  it('shows only the lead of Wikipedia texts', () => {
    const { blocks, more } = excerpt(femur.definition!);
    expect(blocks).toHaveLength(2);
    expect(more).toBe(true);
  });
  it('truncates at a word boundary', () => {
    expect(truncate('one two three four', 12)).toBe('one two…');
    expect(truncate('short', 12)).toBe('short');
  });
});

describe('renderPage', () => {
  it('writes title, canonical, hreflang, breadcrumbs and the 3D link', () => {
    const html = renderPage(femur, 'en', ctx());
    expect(html).toContain('<title>Femur (Os femoris) – 3D anatomy | Open Anatomy Atlas</title>');
    expect(html).toContain('<link rel="canonical" href="https://learnanatomy.org/en/femur">');
    expect(html).toContain('<link rel="alternate" hreflang="de" href="https://learnanatomy.org/de/femur">');
    expect(html).toContain('href="/?s=femur-l"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('It is &lt;long&gt;.');
    expect(html).not.toContain('<long>');
    expect(html).toContain('<meta property="og:image" content="https://learnanatomy.org/og-image.jpg">');
    expect(html).not.toContain('<figure>');
  });

  it('uses the page image and social card when they exist', () => {
    const html = renderPage(femur, 'en', ctx(true));
    expect(html).toContain('<img src="/thumbs/femur.webp"');
    expect(html).toContain('content="https://learnanatomy.org/thumbs/og/femur.jpg"');
  });

  it('leads with the Latin name on German pages', () => {
    const html = renderPage(femur, 'de', ctx());
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('<h1 lang="la">Os femoris</h1>');
    expect(html).toContain('In 3D öffnen');
    expect(html).toContain('Beschreibungen gibt es nur auf Englisch.');
  });

  it('shows a landmark with its structure', () => {
    const html = renderPage(site.bySlug.get('greater-trochanter')!, 'en', ctx(true));
    expect(html).toContain('<img src="/thumbs/femur.webp"');
    expect(html).toContain('<dt>Landmark on</dt><dd><a href="/en/femur"');
  });
});

describe('sitemap and 404', () => {
  it('lists every page in both languages', () => {
    const xml = renderSitemap(ctx());
    expect(xml.match(/<url>/g)).toHaveLength(1 + 2 * (1 + 4 + site.pages.length));
    expect(xml).toContain('<loc>https://learnanatomy.org/de/femur</loc>');
  });
  it('keeps the 404 page out of the index', () => {
    expect(renderNotFound(ctx())).toContain('<meta name="robots" content="noindex">');
  });
});
