// Vite plugin: on `vite build`, writes the static structure pages (/en/<slug>, /de/<slug>), the system and
// language indexes, 404.html and sitemap.xml next to the app. Input is the pipeline output in public/models/;
// without it (fresh clone, mock data) the plugin only warns. Page images come from public/thumbs/
// (seo/thumbnails.ts); pages are written without an image when they are missing.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { buildSite, cardPath, loadSiteData, PAGE_LANGS, SYSTEMS_SEGMENT, thumbPath } from './model.ts';
import {
  renderLanguageIndex,
  renderNotFound,
  renderPage,
  renderSitemap,
  renderSystemIndex,
  systemsWithPages,
  type RenderContext,
} from './render.ts';

export function seoPages(): Plugin {
  let publicDir = '';
  return {
    name: 'atlas-seo-pages',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle() {
      const data = loadSiteData(join(publicDir, 'models'));
      if (!data) {
        this.warn(
          'public/models/manifest.json not found: structure pages, sitemap and 404 page are skipped.',
        );
        return;
      }
      const site = buildSite(data);
      const ctx: RenderContext = {
        site,
        hasThumb: (slug) => existsSync(join(publicDir, thumbPath(slug))),
        hasCard: (slug) => existsSync(join(publicDir, cardPath(slug))),
        lastmod: data.manifest.generatedAt.slice(0, 10),
      };
      const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source });
      for (const lang of PAGE_LANGS) {
        emit(`${lang}/index.html`, renderLanguageIndex(lang, ctx));
        for (const system of systemsWithPages(site))
          emit(`${lang}/${SYSTEMS_SEGMENT}/${system}.html`, renderSystemIndex(system, lang, ctx));
        for (const page of site.pages) emit(`${lang}/${page.slug}.html`, renderPage(page, lang, ctx));
      }
      emit('404.html', renderNotFound(ctx));
      emit('sitemap.xml', renderSitemap(ctx));
      const withThumb = site.pages.filter((p) => p.thumbSlug && ctx.hasThumb(p.thumbSlug)).length;
      this.info(
        `${site.pages.length} structure pages × ${PAGE_LANGS.length} languages (${withThumb} with an image), sitemap.xml, 404.html`,
      );
    },
  };
}
