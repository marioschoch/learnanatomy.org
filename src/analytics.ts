/**
 * Cloudflare Web Analytics, embedded by the site itself (the dashboard's "Enable with JS Snippet installation")
 * instead of injected by Cloudflare, because only an embedded beacon can turn off SPA tracking. The atlas rewrites
 * its URL after every selection and camera move (src/ui/lib/urlSync.ts); with SPA tracking each rewrite counted as
 * a page view. With `spa=false` a page view is a page load.
 *
 * The beacon loads only on learnanatomy.org and its subdomains, so previews (*.pages.dev), local builds and the
 * e2e runs stay out of the stats (and out of the console: the beacon endpoint refuses other hostnames).
 * Free of Vite-only code, so the build (vite.config.ts, seo/) can import it.
 */
export const ANALYTICS_TOKEN = 'b11153fed29347e196acca969572dfe1';

/** Hostnames the beacon reports from. */
export const ANALYTICS_HOSTS = /(^|\.)learnanatomy\.org$/;

export const ANALYTICS_BEACON_URL = 'https://static.cloudflareinsights.com/beacon.min.js';

/**
 * Beacon settings, as Cloudflare's snippet passes them: `spa: false` stops counting history.pushState/replaceState
 * and soft navigations as page views. They must sit in the tag's data-cf-beacon attribute: the beacon finds its tag
 * with `document.currentScript`, which is null for module scripts, or else `querySelector('script[data-cf-beacon]')`.
 * Without the attribute it finds no token and silently reports nothing (also when the token is in the query string).
 */
export const ANALYTICS_CONFIG = JSON.stringify({ token: ANALYTICS_TOKEN, spa: false });

/** Inline script (without the <script> tag) that adds the beacon on the hostnames above. */
export const ANALYTICS_LOADER =
  `if(${ANALYTICS_HOSTS}.test(location.hostname)){` +
  `var s=document.createElement('script');s.type='module';s.src=${JSON.stringify(ANALYTICS_BEACON_URL)};` +
  `s.setAttribute('data-cf-beacon',${JSON.stringify(ANALYTICS_CONFIG)});document.head.appendChild(s)}`;
