/**
 * Info panel for the selected structure / group / landmark: names (Latin bold, then English / German),
 * system, regions, side, counterpart, definition (source, "unreviewed" badge, licence), NC licence note,
 * and actions. Hidden during the quiz (AppUi does not render it then).
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Definition, Names, Side } from '@/contract';
import { definitionStoreKey } from '@/contract';
import { structureIdsOfNode, useAtlasStore } from '@/state';
import { useQuizLauncher } from '@/quiz/launcher';
import { cx, mutedText } from '../components/classes';
import { Icon, type IconName } from '../components/Icon';
import { Badge, Button, IconButton, SideBadge, Spinner, SystemChip } from '../components/ui';
import { focusIds, toggleIsolate } from '../lib/actions';
import { findRegion, findSystem, regionLabel, systemLabel } from '../lib/labels';
import { licenseLabel, licenseUrl } from '../lib/licenses';

type NodeType = 'structure' | 'group' | 'landmark';

const OTHER_LANGS = ['fr', 'es', 'pt'] as const;

export function InfoPanel({
  variant = 'panel',
  collapsed = false,
  onToggleCollapsed,
}: {
  variant?: 'panel' | 'sheet';
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { t } = useTranslation();
  const selectedId = useAtlasStore((s) => s.selectedId);
  const structure = useAtlasStore((s) => (s.selectedId ? s.structures[s.selectedId] : undefined));
  const group = useAtlasStore((s) => (s.selectedId ? s.groups[s.selectedId] : undefined));
  const landmark = useAtlasStore((s) => (s.selectedId ? s.landmarks[s.selectedId] : undefined));
  const metaLoading = useAtlasStore((s) => {
    if (!s.selectedId || s.structures[s.selectedId] || s.groups[s.selectedId] || s.landmarks[s.selectedId])
      return false;
    const sys = s.searchIndex.find((e) => e.id === s.selectedId)?.system;
    return sys ? s.systemLoad[sys]?.meta === 'loading' : false;
  });

  if (!selectedId) return null;
  const node = structure ?? group ?? landmark;
  const nodeType: NodeType | null = structure ? 'structure' : group ? 'group' : landmark ? 'landmark' : null;

  return (
    <section
      aria-label={t('info.label')}
      data-testid="info-panel"
      className={cx('flex min-h-0 flex-col', variant === 'panel' && 'max-h-full')}
    >
      {node && nodeType ? (
        <InfoContent
          id={selectedId}
          nodeType={nodeType}
          variant={variant}
          collapsed={collapsed}
          {...(onToggleCollapsed ? { onToggleCollapsed } : {})}
        />
      ) : (
        <div className="flex items-start gap-2 p-4">
          <p className={cx('flex-1 text-sm', mutedText)}>
            {metaLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> {t('info.loading')}
              </span>
            ) : (
              t('info.notFound')
            )}
          </p>
          <IconButton
            icon="x"
            size="iconSm"
            label={t('info.close')}
            onClick={() => useAtlasStore.getState().select(null)}
          />
        </div>
      )}
    </section>
  );
}

function InfoContent({
  id,
  nodeType,
  variant,
  collapsed,
  onToggleCollapsed,
}: {
  id: string;
  nodeType: NodeType;
  variant: 'panel' | 'sheet';
  collapsed: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { t } = useTranslation();
  const manifest = useAtlasStore((s) => s.manifest);
  const uiLang = useAtlasStore((s) => s.uiLang);
  const structures = useAtlasStore((s) => s.structures);
  const groups = useAtlasStore((s) => s.groups);
  const landmarks = useAtlasStore((s) => s.landmarks);
  const childrenOf = useAtlasStore((s) => s.childrenOf);
  const hidden = useAtlasStore((s) => Boolean(s.hiddenIds[id]));
  const pinned = useAtlasStore((s) => s.pinnedIds.includes(id));
  const isolate = useAtlasStore((s) => s.isolate);
  const definitions = useAtlasStore((s) => s.definitions);
  const defStatus = useAtlasStore((s) => s.definitionsStatus);
  const searchIndex = useAtlasStore((s) => s.searchIndex);

  const structure = nodeType === 'structure' ? structures[id] : undefined;
  const group = nodeType === 'group' ? groups[id] : undefined;
  const landmark = nodeType === 'landmark' ? landmarks[id] : undefined;
  const node = (structure ?? group ?? landmark)!;
  const owner = landmark ? structures[landmark.structureId] : undefined;
  const system = findSystem(manifest, node.system);

  const partIds = useMemo(
    () => (group ? structureIdsOfNode({ structures, groups, landmarks, childrenOf }, id) : []),
    [group, structures, groups, landmarks, childrenOf, id],
  );
  const regions = useMemo(() => {
    if (structure) return structure.regions;
    if (owner) return owner.regions;
    const set = new Set<string>();
    for (const pid of partIds) for (const r of structures[pid]?.regions ?? []) set.add(r);
    return [...set];
  }, [structure, owner, partIds, structures]);

  const side: Side | undefined = structure?.side ?? landmark?.side;
  const counterpartId = structure?.pairId ?? landmarkCounterpart(id, landmark?.side, landmarks, searchIndex);
  const parentId = structure?.parentId ?? group?.parentId;
  const parent = parentId ? (groups[parentId] ?? structures[parentId]) : undefined;

  const definitionKey = node.definitionKey ?? owner?.definitionKey;
  const defSystem = node.system;
  useEffect(() => {
    void useAtlasStore.getState().ensureDefinitions(defSystem);
  }, [defSystem]);
  const definition = definitionKey ? definitions[definitionStoreKey(defSystem, definitionKey)] : undefined;
  const defLoading =
    defStatus[defSystem] === 'loading' || (defStatus[defSystem] === undefined && Boolean(definitionKey));

  const attributionId = structure?.attribution ?? owner?.attribution;
  const attribution = attributionId ? manifest?.attributions[attributionId] : undefined;
  const nonCommercial =
    Boolean(structure?.nonCommercial ?? owner?.nonCommercial) || Boolean(attribution?.nonCommercial);

  const isolatedHere = isolate.mode !== 'none' && isolate.ids.includes(id);
  const kindLabel =
    nodeType === 'group'
      ? t('info.group')
      : nodeType === 'landmark'
        ? t('info.landmark')
        : structure?.kind === 'origin'
          ? t('info.kindOrigin')
          : structure?.kind === 'insertion'
            ? t('info.kindInsertion')
            : null;

  const store = useAtlasStore.getState;
  const go = (target: string) => void store().selectAndFocus(target);

  return (
    <>
      <header className={cx('flex items-start gap-2 px-4 pt-3', collapsed ? 'pb-3' : 'pb-2')}>
        <div className="min-w-0 flex-1">
          {kindLabel ? (
            <p className={cx('mb-0.5 text-[11px] font-semibold tracking-wide uppercase', mutedText)}>
              {kindLabel}
            </p>
          ) : null}
          <NamesBlock names={node.names} side={side} />
        </div>
        {onToggleCollapsed ? (
          <IconButton
            icon={collapsed ? 'chevronDown' : 'chevronUp'}
            size="iconSm"
            label={collapsed ? t('common.expandPanel') : t('common.collapsePanel')}
            aria-expanded={!collapsed}
            onClick={onToggleCollapsed}
          />
        ) : null}
        <IconButton icon="x" size="iconSm" label={t('info.close')} onClick={() => store().select(null)} />
      </header>

      {collapsed ? null : (
        <div
          className={cx(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4',
            variant === 'sheet' && 'pb-6',
          )}
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className={mutedText}>{t('info.system')}</dt>
            <dd className="flex min-w-0 items-center gap-1.5">
              {system ? <SystemChip color={system.color} /> : null}
              <span className="truncate">{systemLabel(system, node.system)}</span>
            </dd>
            {regions.length ? (
              <>
                <dt className={mutedText}>{t('info.regions')}</dt>
                <dd>{regions.map((r) => regionLabel(findRegion(manifest, r), r)).join(', ')}</dd>
              </>
            ) : null}
            {side ? (
              <>
                <dt className={mutedText}>{t('info.side')}</dt>
                <dd>
                  {t(side === 'left' ? 'side.left' : 'side.right')}{' '}
                  <span className={cx('text-xs', mutedText)}>({t('side.patient')})</span>
                </dd>
              </>
            ) : null}
            {counterpartId ? (
              <>
                <dt className={mutedText}>{t('info.counterpart')}</dt>
                <dd>
                  <LinkButton onClick={() => go(counterpartId)} icon="swap">
                    {t('info.showCounterpart', {
                      side: t(side === 'left' ? 'side.right' : 'side.left').toLowerCase(),
                    })}
                  </LinkButton>
                </dd>
              </>
            ) : null}
            {owner ? (
              <>
                <dt className={mutedText}>{t('info.landmarkOn')}</dt>
                <dd>
                  <LinkButton onClick={() => go(owner.id)}>
                    <NodeName names={owner.names} />
                  </LinkButton>
                </dd>
              </>
            ) : null}
            {parent ? (
              <>
                <dt className={mutedText}>{t('info.partOf')}</dt>
                <dd className="min-w-0">
                  <LinkButton onClick={() => go(parent.id)}>
                    <NodeName names={parent.names} />
                  </LinkButton>
                </dd>
              </>
            ) : null}
            {structure?.muscleId && structures[structure.muscleId] ? (
              <>
                <dt className={mutedText}>{t('info.muscle')}</dt>
                <dd>
                  <LinkButton onClick={() => go(structure.muscleId!)}>
                    <NodeName names={structures[structure.muscleId]!.names} />
                  </LinkButton>
                </dd>
              </>
            ) : null}
            {structure?.boneId && structures[structure.boneId] ? (
              <>
                <dt className={mutedText}>{t('info.bone')}</dt>
                <dd>
                  <LinkButton onClick={() => go(structure.boneId!)}>
                    <NodeName names={structures[structure.boneId]!.names} />
                  </LinkButton>
                </dd>
              </>
            ) : null}
            {group ? (
              <>
                <dt className={mutedText}>{t('info.group')}</dt>
                <dd>{t('info.groupParts', { count: partIds.length })}</dd>
              </>
            ) : null}
          </dl>

          <Actions
            id={id}
            nodeType={nodeType}
            hidden={hidden}
            pinned={pinned}
            isolatedMode={isolatedHere ? isolate.mode : 'none'}
            quizScope={{ systems: [node.system], regions }}
          />

          <DefinitionBlock definition={definition} loading={defLoading && !definition} uiLang={uiLang} />

          {nonCommercial ? (
            <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-950 dark:bg-amber-400/10 dark:text-amber-100">
              <Icon name="alert" className="mt-px size-4" />
              <span>
                <strong className="font-semibold">{t('info.nonCommercial')}.</strong>{' '}
                {t('info.nonCommercialHint')}
                {attribution ? <> {attribution.text}</> : null}
              </span>
            </p>
          ) : null}

          {attribution ? (
            <p className={cx('mt-3 text-[11px] leading-snug', mutedText)}>
              {t('info.modelLicense')}: {attribution.text}
              {attribution.license && attribution.licenseUrl ? (
                <>
                  {' · '}
                  <ExternalLink href={attribution.licenseUrl}>
                    {licenseLabel(attribution.license)}
                  </ExternalLink>
                </>
              ) : null}
            </p>
          ) : null}

          <OtherNames names={node.names} />
        </div>
      )}
    </>
  );
}

function landmarkCounterpart(
  id: string,
  side: Side | undefined,
  landmarks: Record<string, unknown>,
  index: { id: string }[],
): string | undefined {
  if (!side) return undefined;
  const m = /^(.*)-(l|r)$/.exec(id);
  if (!m) return undefined;
  const other = `${m[1]}-${m[2] === 'l' ? 'r' : 'l'}`;
  return other in landmarks || index.some((e) => e.id === other) ? other : undefined;
}

/** Latin bold, then English and German (when present and different). Never translated. */
function NamesBlock({ names, side }: { names: Names; side?: Side | undefined }) {
  const { t } = useTranslation();
  const latin = names.la;
  const title = latin ?? names.en;
  const rows: { lang: string; value: string }[] = [];
  if (latin && names.en && names.en !== latin) rows.push({ lang: t('info.english'), value: names.en });
  if (names.de && names.de !== title) rows.push({ lang: t('info.german'), value: names.de });
  return (
    <div className="min-w-0">
      <h2 className="flex items-start gap-2 text-lg leading-snug font-bold break-words text-zinc-950 dark:text-white">
        <span lang={latin ? 'la' : 'en'} className="min-w-0">
          {title}
        </span>
        {/* Keeps the heading text "Os femoris L"; whitespace between flex items is not rendered. */}
        {side ? ' ' : null}
        {side ? (
          <span className="mt-1">
            <SideBadge side={side} label={t(side === 'left' ? 'side.left' : 'side.right')} />
          </span>
        ) : null}
      </h2>
      {rows.map((r) => (
        <p key={r.lang} className="text-sm text-zinc-700 dark:text-zinc-300">
          <span className="sr-only">{r.lang}: </span>
          {r.value}
        </p>
      ))}
    </div>
  );
}

function NodeName({ names }: { names: Names }) {
  const nameLang = useAtlasStore((s) => s.nameLang);
  return <>{names[nameLang] ?? names.la ?? names.en}</>;
}

function OtherNames({ names }: { names: Names }) {
  const { t } = useTranslation();
  const entries = OTHER_LANGS.filter((l) => names[l]).map((l) => [l, names[l]!] as const);
  if (!entries.length) return null;
  return (
    <details className="mt-3 text-xs">
      <summary className={cx('cursor-pointer select-none', mutedText)}>{t('info.otherLanguages')}</summary>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {entries.map(([l, v]) => (
          <div key={l} className="contents">
            <dt className={mutedText}>{t(`nameLangs.${l}`)}</dt>
            <dd lang={l}>{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function DefinitionBlock({
  definition,
  loading,
  uiLang,
}: {
  definition: Definition | undefined;
  loading: boolean;
  uiLang: 'de' | 'en';
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const text = definition
    ? (definition.text[uiLang] ?? definition.text.en ?? Object.values(definition.text)[0])
    : undefined;
  const textLang = definition?.text[uiLang] ? uiLang : 'en';
  const long = (text?.length ?? 0) > 420;
  return (
    <section
      className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700/80"
      aria-labelledby="def-title"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h3 id="def-title" className="text-sm font-semibold">
          {t('info.definition')}
        </h3>
        {definition && !definition.reviewed ? (
          <Badge tone="warn" title={t('info.unreviewedHint')}>
            {t('info.unreviewed')}
          </Badge>
        ) : null}
        {definition?.machineTranslated ? <Badge tone="info">{t('info.machineTranslated')}</Badge> : null}
      </div>
      {loading ? (
        <p className={cx('flex items-center gap-2 text-sm', mutedText)}>
          <Spinner /> {t('info.definitionLoading')}
        </p>
      ) : text ? (
        <>
          <p
            lang={textLang}
            className={cx(
              'text-sm leading-relaxed text-zinc-800 dark:text-zinc-200',
              !expanded && long && 'line-clamp-6',
            )}
          >
            {text}
          </p>
          {long ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-teal-800 hover:underline dark:text-teal-300"
              aria-expanded={expanded}
            >
              {expanded ? t('common.collapsePanel') : t('common.more')}
            </button>
          ) : null}
          {uiLang === 'de' && textLang !== 'de' ? (
            <p className={cx('mt-1 text-[11px] italic', mutedText)}>{t('info.definitionEnglishOnly')}</p>
          ) : null}
          <p className={cx('mt-2 text-[11px] leading-snug', mutedText)}>
            {t('info.source')}:{' '}
            {definition!.sourceUrl ? (
              <ExternalLink href={definition!.sourceUrl}>{definition!.source}</ExternalLink>
            ) : (
              definition!.source
            )}{' '}
            · {t('info.licenseText')}:{' '}
            {licenseUrl(definition!.license) ? (
              <ExternalLink href={licenseUrl(definition!.license)!}>
                {licenseLabel(definition!.license)}
              </ExternalLink>
            ) : (
              licenseLabel(definition!.license)
            )}
          </p>
        </>
      ) : (
        <p className={cx('text-sm', mutedText)}>{t('info.noDefinition')}</p>
      )}
    </section>
  );
}

function Actions({
  id,
  nodeType,
  hidden,
  pinned,
  isolatedMode,
  quizScope,
}: {
  id: string;
  nodeType: NodeType;
  hidden: boolean;
  pinned: boolean;
  isolatedMode: 'none' | 'isolate' | 'context';
  quizScope: { systems: string[]; regions: string[] };
}) {
  const { t } = useTranslation();
  const s = useAtlasStore.getState;
  const actions: {
    key: string;
    icon: IconName;
    label: string;
    onClick: () => void;
    pressed?: boolean;
    disabled?: boolean;
    wide?: boolean;
  }[] = [
    { key: 'focus', icon: 'crosshair', label: t('info.focus'), onClick: () => focusIds([id]) },
    {
      key: 'isolate',
      icon: 'target',
      label: isolatedMode === 'isolate' ? t('info.exitIsolate') : t('info.isolate'),
      pressed: isolatedMode === 'isolate',
      onClick: () => toggleIsolate('isolate', [id]),
    },
    {
      key: 'hide',
      icon: hidden ? 'eye' : 'eyeOff',
      label: hidden ? t('info.show') : t('info.hide'),
      disabled: nodeType === 'landmark',
      onClick: () => s().setNodeHidden(id, !hidden),
    },
    {
      key: 'pin',
      icon: 'pin',
      label: pinned ? t('info.unpin') : t('info.pin'),
      pressed: pinned,
      onClick: () => s().togglePinned(id),
    },
    {
      key: 'context',
      icon: 'layers',
      label: isolatedMode === 'context' ? t('info.exitIsolate') : t('info.isolateContext'),
      pressed: isolatedMode === 'context',
      onClick: () => toggleIsolate('context', [id]),
      wide: true,
    },
  ];
  return (
    <div className="mt-3" role="group" aria-label={t('info.actions')}>
      <div className="grid grid-cols-2 gap-1.5">
        {actions.map((a) => (
          <Button
            key={a.key}
            size="sm"
            variant="subtle"
            pressed={a.pressed}
            disabled={a.disabled}
            onClick={a.onClick}
            className={cx('justify-start', a.wide && 'col-span-2')}
            title={a.label}
            data-action={a.key}
          >
            <Icon name={a.icon} className="size-3.5" />
            <span className="truncate">{a.label}</span>
          </Button>
        ))}
        <Button
          size="sm"
          variant="primary"
          className="col-span-2"
          data-action="quiz"
          onClick={() => useQuizLauncher.getState().openQuiz(quizScope)}
        >
          <Icon name="quiz" className="size-3.5" />
          {t('info.quizRegion')}
        </Button>
      </div>
    </div>
  );
}

function LinkButton({
  onClick,
  children,
  icon,
}: {
  onClick: () => void;
  children: React.ReactNode;
  icon?: IconName;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1 text-left text-teal-800 underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none dark:text-teal-300"
    >
      {icon ? <Icon name={icon} className="size-3.5" /> : null}
      <span className="truncate">{children}</span>
    </button>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-teal-800 underline underline-offset-2 hover:no-underline dark:text-teal-300"
    >
      {children}
      <Icon name="external" className="size-3" />
    </a>
  );
}
