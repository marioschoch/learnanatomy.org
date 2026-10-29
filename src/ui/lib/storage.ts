/**
 * localStorage access that never throws (private mode, blocked storage, quota, SSR).
 * Used only for small UI preferences and the quiz's Leitner boxes — no cookies, nothing leaves the browser.
 */
const PREFIX = 'oaa.';

export function readJson<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    globalThis.localStorage?.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
