/** Shared class strings (Tailwind) and a tiny class-name joiner. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-teal-400 dark:focus-visible:ring-offset-zinc-900';

export const panelClass =
  'pointer-events-auto rounded-2xl border border-zinc-200 bg-white/95 text-zinc-900 shadow-xl shadow-zinc-900/10 backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:text-zinc-100 dark:shadow-black/40';

export const mutedText = 'text-zinc-600 dark:text-zinc-400';

export const inputClass =
  'h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/40 dark:focus-visible:border-teal-400 dark:focus-visible:ring-teal-400/40';
