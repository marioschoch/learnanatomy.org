/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { seoPages } from './seo/plugin.ts';
import { ANALYTICS_LOADER } from './src/analytics.ts';

/**
 * The attribution and licence texts live in the repo root (outside public/). Ship them with the site as plain
 * text, so the credits page can link them and the downloadable models keep their licence next to them.
 */
const LICENSE_FILES: Record<string, string> = {
  'licenses/ATTRIBUTION.txt': 'ATTRIBUTION.md',
  'licenses/LICENSE.txt': 'LICENSE',
  'licenses/assets-LICENSE.txt': 'assets.LICENSE',
};
const readRootFile = (name: string) => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)));

function licenseFiles(): Plugin {
  return {
    name: 'atlas-license-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const base = server.config.base;
        const url = req.url?.split('?')[0] ?? '';
        const src = url.startsWith(base) ? LICENSE_FILES[url.slice(base.length)] : undefined;
        if (!src) return next();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(readRootFile(src));
      });
    },
    generateBundle() {
      for (const [fileName, src] of Object.entries(LICENSE_FILES))
        this.emitFile({ type: 'asset', fileName, source: readRootFile(src) });
    },
  };
}

/** Adds the Cloudflare Web Analytics loader to the atlas page (src/analytics.ts; the static pages add it in seo/). */
function analytics(): Plugin {
  return {
    name: 'atlas-analytics',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'script', children: ANALYTICS_LOADER, injectTo: 'head' }],
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), licenseFiles(), seoPages(), analytics()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Main bundle budget is 400 kB gzip (ARCHITECTURE.md §Performance); warn early on raw size.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.{ts,tsx}',
      'pipeline/**/*.test.mjs',
      'seo/**/*.test.ts',
    ],
    css: false,
  },
});
