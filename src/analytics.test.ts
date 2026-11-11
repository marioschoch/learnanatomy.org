import { ANALYTICS_HOSTS, ANALYTICS_LOADER, ANALYTICS_TOKEN } from './analytics';

/** Runs the inline loader as the page would, with `location.hostname` set to `hostname`. */
function runLoader(hostname: string): HTMLScriptElement[] {
  document.head.innerHTML = '';
  new Function('location', 'document', ANALYTICS_LOADER)({ hostname }, document);
  return [...document.head.querySelectorAll('script')];
}

describe('analytics loader', () => {
  it('reports from learnanatomy.org and its subdomains only', () => {
    for (const host of ['learnanatomy.org', 'www.learnanatomy.org'])
      expect(ANALYTICS_HOSTS.test(host)).toBe(true);
    for (const host of [
      'localhost',
      'open-anatomy-atlas.pages.dev',
      'bones-only.open-anatomy-atlas.pages.dev',
      'notlearnanatomy.org',
      'learnanatomy.org.example.com',
    ])
      expect(ANALYTICS_HOSTS.test(host)).toBe(false);
  });

  it('adds the beacon with SPA tracking off on the live site', () => {
    const [script, ...rest] = runLoader('learnanatomy.org');
    expect(rest).toHaveLength(0);
    expect(script!.type).toBe('module');
    expect(script!.src).toBe('https://static.cloudflareinsights.com/beacon.min.js');
    // The beacon finds its settings like this (document.currentScript is null for module scripts).
    const found = document.querySelector('script[data-cf-beacon]');
    expect(found).toBe(script);
    expect(JSON.parse(found!.getAttribute('data-cf-beacon')!)).toEqual({
      token: ANALYTICS_TOKEN,
      spa: false,
    });
  });

  it('adds nothing on previews and local builds', () => {
    expect(runLoader('localhost')).toHaveLength(0);
    expect(runLoader('open-anatomy-atlas.pages.dev')).toHaveLength(0);
  });
});
