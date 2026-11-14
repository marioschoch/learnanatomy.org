// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ANALYTICS_LOADER } from '../src/analytics';
import { DONATION_URL } from '../src/donation';
import { buildSite } from './model';
import {
  excerpt,
  parseBlocks,
  renderNotFound,
  renderPage,
  renderSitemap,
  renderSupport,
  renderThanks,
  tidy,
  truncate,
  type RenderContext,
} from './render';
import { testData, testWikidata } from './testData';

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
    expect(html).toContain('<title>Femur (Os femoris) – 3D anatomy | learnanatomy.org</title>');
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
    expect(html).toContain('Diese Beschreibung gibt es nur auf Englisch.');
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
    expect(xml.match(/<url>/g)).toHaveLength(1 + 2 * (1 + 1 + 4 + site.pages.length));
    expect(xml).toContain('<loc>https://learnanatomy.org/de/femur</loc>');
    expect(xml).toContain('<loc>https://learnanatomy.org/support</loc>');
    expect(xml).toContain('<loc>https://learnanatomy.org/de/support</loc>');
    expect(xml).not.toContain('/thanks');
  });
  it('keeps the 404 page out of the index', () => {
    expect(renderNotFound(ctx())).toContain('<meta name="robots" content="noindex">');
  });
});

describe('analytics', () => {
  it('loads the analytics beacon on every static page, once', () => {
    const pages = [
      renderPage(femur, 'en', ctx()),
      renderPage(femur, 'de', ctx()),
      renderSupport('en', { site }),
      renderThanks({ site }),
      renderNotFound(ctx()),
    ];
    for (const html of pages) expect(html.split(`<script>${ANALYTICS_LOADER}</script>`)).toHaveLength(2);
  });
});

describe('support', () => {
  it('links the support page from every header and footer, in the page language', () => {
    const en = renderPage(femur, 'en', ctx());
    expect(en).toContain('<a class="pill" href="/support" aria-label="Support the atlas">');
    expect(en).toMatch(/you can <a href="\/support"><svg class="heart"[^>]*aria-hidden="true"/);
    const de = renderPage(femur, 'de', ctx());
    expect(de).toContain('<a class="pill" href="/de/support"');
    expect(de).toContain('kannst du es <a href="/de/support">');
  });

  it('writes the support page with the donation link, canonical and alternates', () => {
    const html = renderSupport('en', { site });
    expect(html).toContain('<title>Support the atlas | learnanatomy.org</title>');
    expect(html).toContain('<h1>Keep learnanatomy.org free</h1>');
    expect(html).toContain(`<a class="btn" href="${DONATION_URL}">Donate with TWINT or card →</a>`);
    expect(html.split(DONATION_URL)).toHaveLength(2);
    expect(html).toContain('<link rel="canonical" href="https://learnanatomy.org/support">');
    expect(html).toContain('<link rel="alternate" hreflang="de" href="https://learnanatomy.org/de/support">');
    expect(html).toContain('href="/support" aria-label="Support the atlas" aria-current="page"');
    expect(html).not.toContain('class="support"');
    expect(renderSupport('de')).toContain('Mit TWINT oder Karte spenden');
  });

  it('keeps the thank-you page out of the index and links back to the atlas', () => {
    const html = renderThanks();
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain('<a class="btn" href="/">Back to the 3D atlas →</a>');
    expect(html).toContain('<section lang="de"><h1>Danke!</h1>');
  });
});

describe('pages with Wikidata', () => {
  const wdSite = buildSite({ ...testData(), wikidata: testWikidata() });
  const wdCtx: RenderContext = { ...ctx(), site: wdSite };
  const render = (slug: string, lang: 'en' | 'de') => renderPage(wdSite.bySlug.get(slug)!, lang, wdCtx);

  it('shows the German article on the German page and the English one on the English page', () => {
    const de = render('femur', 'de');
    expect(de).toContain('<div lang="de">');
    expect(de).toContain('Der Oberschenkelknochen (lateinisch Os femoris) ist der längste Knochen');
    expect(de).toContain('href="https://de.wikipedia.org/wiki/Oberschenkelknochen"');
    expect(de).toContain('CC BY-SA 4.0');
    expect(de).not.toContain('nur auf Englisch');
    expect(de).toMatch(/<meta name="description" content="Der Oberschenkelknochen/);
    const en = render('femur', 'en');
    expect(en).toContain('The femur (pl. femora), or thigh bone');
    expect(en).not.toContain('Oberschenkelknochen');
  });

  it('keeps the English text with a note on German pages without a German article', () => {
    const html = renderPage(femur, 'de', ctx());
    expect(html).toContain('<div lang="en">');
    expect(html).toContain('nur auf Englisch');
  });

  it('renders supply and function with links, labels and the source', () => {
    const en = render('biceps', 'en');
    expect(en).toContain('<h2>Supply and function</h2>');
    expect(en).toContain(
      '<dt>Nerve supply</dt><dd><a href="/en/musculocutaneous-nerve" lang="en">Musculocutaneous nerve</a>, <span lang="en">Radial nerve</span></dd>',
    );
    expect(en).toContain('<dt>Action</dt><dd><span lang="en">Elbow flexion</span></dd>');
    expect(en).toContain('href="https://www.wikidata.org/wiki/Q10"');
    const de = render('biceps', 'de');
    expect(de).toContain('<h2>Versorgung und Funktion</h2>');
    expect(de).toContain('<a href="/de/musculocutaneous-nerve" lang="la">Nervus musculocutaneus</a>');
    expect(de).toContain('<span lang="de">Beugung im Ellenbogengelenk</span>');
    expect(de).toContain('<span lang="en">Radial nerve</span>');
  });

  it('describes pages without a lead paragraph by their supply and function', () => {
    const page = { ...wdSite.bySlug.get('biceps')!, definition: undefined, definitionDe: undefined };
    expect(renderPage(page, 'en', wdCtx)).toContain(
      '<meta name="description" content="Biceps (Musculus biceps). Nerve supply: Musculocutaneous nerve, Radial nerve. Action: Elbow flexion.">',
    );
  });
});
