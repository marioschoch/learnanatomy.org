/**
 * Top search bar: Fuse.js over all names/languages/synonyms, results while typing, ARIA combobox with
 * ↑ ↓ Enter Esc. Picking a result loads the system if needed, then selects and focuses the structure.
 */
import { useDeferredValue, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NameLang } from '@/contract';
import { displayName, useAtlasStore } from '@/state';
import { SEARCH_INPUT_ID } from '../lib/actions';
import { findSystem, systemLabel } from '../lib/labels';
import { cx, focusRing } from '../components/classes';
import { Icon } from '../components/Icon';
import { Badge, Kbd, SideBadge, SystemChip } from '../components/ui';
import { useUiStore } from '../uiStore';
import { createSearchEngine, type SearchHit } from './searchEngine';

const MAX_RESULTS = 30;

export function SearchBox({ className, onPicked }: { className?: string; onPicked?: (id: string) => void }) {
  const { t } = useTranslation();
  const entries = useAtlasStore((s) => s.searchIndex);
  const nameLang = useAtlasStore((s) => s.nameLang);
  const manifest = useAtlasStore((s) => s.manifest);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [armed, setArmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const deferred = useDeferredValue(query);

  // Build the index lazily on first focus (keeps startup fast).
  const engine = useMemo(
    () => (armed && entries.length ? createSearchEngine(entries) : null),
    [armed, entries],
  );
  const hits = useMemo(() => (engine ? engine.search(deferred, MAX_RESULTS) : []), [engine, deferred]);
  const activeIndex = Math.min(active, Math.max(0, hits.length - 1));
  const showList = open && query.trim().length > 0;

  const choose = (hit: SearchHit | undefined) => {
    if (!hit) return;
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    const store = useAtlasStore.getState();
    useUiStore.getState().setSheet(null);
    void store.selectAndFocus(hit.entry.id);
    onPicked?.(hit.entry.id);
  };

  const moveActive = (delta: number) => {
    if (!hits.length) return;
    const next = (activeIndex + delta + hits.length) % hits.length;
    setActive(next);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${next}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(hits[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (query) {
        setQuery('');
        setOpen(false);
      } else inputRef.current?.blur();
    }
  };

  return (
    <div className={cx('pointer-events-auto relative', className)}>
      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
        />
        <input
          ref={inputRef}
          id={SEARCH_INPUT_ID}
          type="search"
          role="combobox"
          aria-label={t('search.label')}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && hits.length ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            setArmed(true);
            setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cx(
            'h-10 w-full rounded-xl border border-zinc-200 bg-white/95 pr-16 pl-9 text-sm text-zinc-900 shadow-lg shadow-zinc-900/10 backdrop-blur-md placeholder:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100 dark:placeholder:text-zinc-400 [&::-webkit-search-cancel-button]:hidden',
            'outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/40 dark:focus-visible:border-teal-400 dark:focus-visible:ring-teal-400/40',
          )}
        />
        <div className="absolute top-1/2 right-2 z-10 flex -translate-y-1/2 items-center gap-1">
          {query ? (
            <button
              type="button"
              aria-label={t('search.clear')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className={cx(
                'rounded-md p-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white',
                focusRing,
              )}
            >
              <Icon name="x" className="size-4" />
            </button>
          ) : (
            <span className="hidden sm:inline-flex" aria-hidden="true">
              <Kbd>/</Kbd>
            </span>
          )}
        </div>
      </div>

      {showList ? (
        <div className="absolute top-full right-0 left-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={t('search.label')}
            className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain py-1"
          >
            {hits.map((hit, i) => (
              <ResultRow
                key={hit.entry.id}
                id={`${listId}-${i}`}
                index={i}
                hit={hit}
                active={i === activeIndex}
                nameLang={nameLang}
                systemColor={findSystem(manifest, hit.entry.system)?.color ?? '#999'}
                systemName={systemLabel(findSystem(manifest, hit.entry.system), hit.entry.system)}
                onHover={() => setActive(i)}
                onChoose={() => choose(hit)}
              />
            ))}
          </ul>
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-sm text-zinc-600 dark:text-zinc-400">{t('search.noResults')}</p>
          ) : null}
          <p
            className="border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
            aria-live="polite"
          >
            {t('search.resultCount', { count: hits.length })} · {t('search.keysHint')}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ResultRow({
  id,
  index,
  hit,
  active,
  nameLang,
  systemColor,
  systemName,
  onHover,
  onChoose,
}: {
  id: string;
  index: number;
  hit: SearchHit;
  active: boolean;
  nameLang: NameLang;
  systemColor: string;
  systemName: string;
  onHover: () => void;
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  const e = hit.entry;
  const primary = displayName(e.names, nameLang);
  const secondary =
    hit.matched !== primary
      ? hit.matched
      : nameLang === 'en'
        ? e.names.la
        : e.names.en !== primary
          ? e.names.en
          : undefined;
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      data-index={index}
      onMouseDown={(ev) => ev.preventDefault()}
      onMouseMove={onHover}
      onClick={onChoose}
      className={cx(
        'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm',
        active ? 'bg-teal-50 dark:bg-teal-400/15' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
      )}
    >
      <span title={systemName} className="inline-flex">
        <SystemChip color={systemColor} className="size-3" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-zinc-900 dark:text-zinc-50">{primary}</span>
        {secondary && secondary !== primary ? (
          <span className="block truncate text-xs text-zinc-600 dark:text-zinc-400">{secondary}</span>
        ) : null}
      </span>
      {e.type !== 'structure' ? (
        <Badge>{e.type === 'group' ? t('search.group') : t('search.landmark')}</Badge>
      ) : e.kind ? (
        <Badge>{t(`kind.${e.kind}`)}</Badge>
      ) : null}
      <span className="hidden max-w-32 truncate text-xs text-zinc-600 md:inline dark:text-zinc-400">
        {systemName}
      </span>
      {e.side ? <SideBadge side={e.side} label={t(e.side === 'left' ? 'side.left' : 'side.right')} /> : null}
    </li>
  );
}
