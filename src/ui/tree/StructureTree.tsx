/**
 * Structure tree: system → group → structure, virtualized (@tanstack/react-virtual) for thousands of rows.
 * ARIA tree with aria-activedescendant (focus stays on the scroll container, so virtualization never loses
 * focus): ↑ ↓ move · → expand / first child · ← collapse / parent · Home/End · Enter select · Space show/hide.
 * Stays in sync with the selection: expands the path and scrolls the selected node into view.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAtlasStore } from '@/state';
import { cx, focusRing, inputClass } from '../components/classes';
import { Icon } from '../components/Icon';
import { Badge, Button, SideBadge, Spinner, SystemChip } from '../components/ui';
import { findSystem, sortedSystems, systemLabel } from '../lib/labels';
import { buildTreeRows, expansionPathFor, filterTree, type TreeRow } from './treeModel';

const ROW_HEIGHT = 30;
const INDENT = 14;

const domId = (key: string) => `treeitem-${key.replace(/^@/, 'sys--')}`;

export function StructureTree() {
  const { t } = useTranslation();
  const manifest = useAtlasStore((s) => s.manifest);
  const childrenOf = useAtlasStore((s) => s.childrenOf);
  const structures = useAtlasStore((s) => s.structures);
  const groups = useAtlasStore((s) => s.groups);
  const landmarks = useAtlasStore((s) => s.landmarks);
  const layers = useAtlasStore((s) => s.layers);
  const hiddenIds = useAtlasStore((s) => s.hiddenIds);
  const systemLoad = useAtlasStore((s) => s.systemLoad);
  const nameLang = useAtlasStore((s) => s.nameLang);
  const selectedId = useAtlasStore((s) => s.selectedId);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<{ key: string; seq: number } | null>(null);
  const scrolledSeq = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const systems = useMemo(() => sortedSystems(manifest), [manifest]);
  const input = useMemo(
    () => ({
      systems,
      childrenOf,
      structures,
      groups,
      layers,
      hiddenIds,
      systemLoad,
      nameLang,
      systemLabel: (sys: Parameters<typeof systemLabel>[0]) => systemLabel(sys),
    }),
    [systems, childrenOf, structures, groups, layers, hiddenIds, systemLoad, nameLang],
  );
  const rows = useMemo(
    () => buildTreeRows(input, expanded, deferredFilter),
    [input, expanded, deferredFilter],
  );
  const unloaded = useMemo(
    () => (deferredFilter.trim() ? filterTree(input, deferredFilter).unloadedSystems : []),
    [input, deferredFilter],
  );

  // Selection → expand its path and scroll to it (state adjusted during render, React's documented pattern).
  const syncKey = `${selectedId ?? ''}|${selectedId && (structures[selectedId] || groups[selectedId] || landmarks[selectedId]) ? 1 : 0}`;
  const [prevSync, setPrevSync] = useState('');
  if (syncKey !== prevSync) {
    setPrevSync(syncKey);
    const target = selectedId ? (landmarks[selectedId]?.structureId ?? selectedId) : null;
    if (target) {
      const path = expansionPathFor({ structures, groups }, target);
      if (path.length) {
        if (!path.every((k) => expanded.has(k))) setExpanded(new Set([...expanded, ...path]));
        setActiveKey(target);
        setScrollTarget({ key: target, seq: (scrollTarget?.seq ?? 0) + 1 });
      }
    }
  }

  // TanStack Virtual returns non-memoizable functions; we do not use the React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  useEffect(() => {
    if (!scrollTarget || scrolledSeq.current === scrollTarget.seq) return;
    const idx = rows.findIndex((r) => r.key === scrollTarget.key);
    if (idx >= 0) {
      scrolledSeq.current = scrollTarget.seq;
      virtualizer.scrollToIndex(idx, { align: 'auto' });
    }
  }, [scrollTarget, rows, virtualizer]);

  const activeIndex = activeKey ? rows.findIndex((r) => r.key === activeKey) : -1;

  const toggleExpanded = (row: TreeRow, open = !row.expanded) => {
    if (row.kind === 'system' && open) void useAtlasStore.getState().ensureSystemMeta(row.systemId);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(row.key);
      else next.delete(row.key);
      return next;
    });
  };

  const toggleVisible = (row: TreeRow) => {
    const s = useAtlasStore.getState();
    if (row.kind === 'system') s.setLayerVisible(row.systemId, !row.checked);
    else s.setNodeHidden(row.id, row.checked !== false);
  };

  const activate = (row: TreeRow) => {
    setActiveKey(row.key);
    if (row.kind === 'system') toggleExpanded(row);
    else void useAtlasStore.getState().selectAndFocus(row.id);
  };

  const moveTo = (idx: number) => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, idx))];
    if (!row) return;
    setActiveKey(row.key);
    virtualizer.scrollToIndex(rows.indexOf(row), { align: 'auto' });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!rows.length) return;
    const cur = activeIndex >= 0 ? activeIndex : 0;
    const row = rows[cur]!;
    let handled = true;
    switch (e.key) {
      case 'ArrowDown':
        moveTo(activeIndex < 0 ? 0 : cur + 1);
        break;
      case 'ArrowUp':
        moveTo(cur - 1);
        break;
      case 'Home':
        moveTo(0);
        break;
      case 'End':
        moveTo(rows.length - 1);
        break;
      case 'ArrowRight':
        if (row.hasChildren && !row.expanded) toggleExpanded(row, true);
        else if (row.expanded) moveTo(cur + 1);
        break;
      case 'ArrowLeft':
        if (row.expanded) toggleExpanded(row, false);
        else {
          for (let i = cur - 1; i >= 0; i--) {
            if (rows[i]!.depth < row.depth) {
              moveTo(i);
              break;
            }
          }
        }
        break;
      case 'Enter':
        activate(row);
        break;
      case ' ':
        toggleVisible(row);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const loadAll = () => {
    for (const id of unloaded) void useAtlasStore.getState().ensureSystemMeta(id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 p-3 pb-2">
        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
          />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && filter) {
                e.stopPropagation();
                setFilter('');
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                scrollRef.current?.focus();
                moveTo(0);
              }
            }}
            placeholder={t('tree.filterPlaceholder')}
            aria-label={t('tree.filter')}
            className={cx(inputClass, 'h-8 pl-8 text-[13px]')}
          />
        </div>
        {unloaded.length ? (
          <div className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <span>{t('tree.filterUnloaded', { count: unloaded.length })}</span>
            <Button size="sm" variant="outline" onClick={loadAll}>
              {t('tree.loadAll')}
            </Button>
          </div>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        role="tree"
        aria-label={t('tree.label')}
        aria-activedescendant={activeIndex >= 0 ? domId(rows[activeIndex]!.key) : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (activeIndex < 0 && rows.length) setActiveKey(rows[0]!.key);
        }}
        className={cx(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-2',
          focusRing,
          'focus-visible:ring-inset focus-visible:ring-offset-0',
        )}
        title={t('tree.keysHint')}
      >
        {rows.length === 0 ? (
          <p className="px-2 py-4 text-sm text-zinc-600 dark:text-zinc-400">{t('tree.empty')}</p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const row = rows[vi.index]!;
              return (
                <TreeRowView
                  key={row.key}
                  row={row}
                  top={vi.start}
                  active={row.key === activeKey}
                  selected={
                    row.key === selectedId ||
                    (row.kind !== 'system' && landmarks[selectedId ?? '']?.structureId === row.id)
                  }
                  color={findSystem(manifest, row.systemId)?.color ?? '#999'}
                  onActivate={() => activate(row)}
                  onToggleExpand={() => toggleExpanded(row)}
                  onToggleVisible={() => toggleVisible(row)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeRowView({
  row,
  top,
  active,
  selected,
  color,
  onActivate,
  onToggleExpand,
  onToggleVisible,
}: {
  row: TreeRow;
  top: number;
  active: boolean;
  selected: boolean;
  color: string;
  onActivate: () => void;
  onToggleExpand: () => void;
  onToggleVisible: () => void;
}) {
  const { t } = useTranslation();
  const loading = row.kind === 'system' && row.loadStatus === 'loading';
  const notLoaded = row.kind === 'system' && row.loadStatus !== 'loaded' && !loading;
  return (
    <div
      id={domId(row.key)}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      aria-selected={selected}
      aria-busy={loading || undefined}
      data-key={row.key}
      onClick={onActivate}
      style={{ transform: `translateY(${top}px)`, height: ROW_HEIGHT, paddingLeft: 4 + row.depth * INDENT }}
      className={cx(
        'absolute top-0 left-0 flex w-full cursor-pointer items-center gap-1 rounded-md pr-1.5 text-[13px]',
        selected
          ? 'bg-teal-100 text-teal-950 dark:bg-teal-400/20 dark:text-teal-50'
          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
        active && 'ring-1 ring-teal-600/60 ring-inset dark:ring-teal-400/60',
        row.hiddenByParent && !selected && 'text-zinc-500 dark:text-zinc-500',
      )}
    >
      {row.hasChildren ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={row.expanded ? t('tree.collapse') : t('tree.expand')}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="flex size-5 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
        >
          <Icon name={row.expanded ? 'chevronDown' : 'chevronRight'} className="size-3.5" />
        </button>
      ) : (
        <span className="size-5 shrink-0" />
      )}
      <input
        type="checkbox"
        tabIndex={-1}
        checked={row.checked !== false}
        ref={(el) => {
          if (el) el.indeterminate = row.checked === 'mixed';
        }}
        onChange={onToggleVisible}
        onClick={(e) => e.stopPropagation()}
        aria-label={t('tree.toggleVisible', { name: row.label })}
        title={row.hiddenByParent ? t('tree.hiddenByParent') : undefined}
        className="size-3.5 shrink-0 cursor-pointer accent-teal-700 dark:accent-teal-400"
      />
      {row.kind === 'system' ? <SystemChip color={color} className="ml-1 size-2.5" /> : null}
      <span
        className={cx(
          'ml-1 min-w-0 flex-1 truncate',
          row.kind === 'system' && 'font-semibold',
          row.kind === 'group' && 'font-medium',
          row.match && 'underline decoration-teal-600/60 decoration-2 underline-offset-2',
        )}
        title={row.label}
      >
        {row.label}
      </span>
      {loading ? <Spinner className="size-3.5" /> : null}
      {notLoaded && row.expanded ? (
        <span className="text-[11px] text-zinc-500">{t('tree.loading')}</span>
      ) : null}
      {row.patchKind ? <Badge>{t(`kind.${row.patchKind}`)}</Badge> : null}
      {row.side ? (
        <SideBadge side={row.side} label={t(row.side === 'left' ? 'side.left' : 'side.right')} />
      ) : null}
    </div>
  );
}
