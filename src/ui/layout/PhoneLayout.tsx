/**
 * Phone layout (< 640 px): compact top bar + search, bottom bar with Layers / Tree / Views / X-ray /
 * Tools / Info, and bottom sheets capped at ~58 % of the height so the 3D view stays usable above them.
 * A selection shows a small peek card; the full info opens as a sheet.
 */
import { lazy, Suspense, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { displayName, patchKindOf, useAtlasStore } from '@/state';
import { useQuizLauncher } from '@/quiz/launcher';
import { cx, mutedText, panelClass } from '../components/classes';
import { Icon, type IconName } from '../components/Icon';
import { Button, SideBadge, Spinner, SystemChip } from '../components/ui';
import { FirstVisitHint } from '../dialogs/FirstVisitHint';
import { useReportViewInsets } from '../hooks/useViewInsets';
import { copyShareLink, focusSelection, takeScreenshot, toggleIsolate, zoom } from '../lib/actions';
import { findSystem, systemLabel } from '../lib/labels';
import { InfoPanel } from '../panels/InfoPanel';
import { LayersPanel } from '../panels/LayersPanel';
import { MoreMenu, NameLangToggle } from '../panels/Settings';
import { ClippingControls, ExplodeControl, ViewsMenu } from '../panels/Toolbar';
import { SearchBox } from '../search/SearchBox';
import { StructureTree } from '../tree/StructureTree';
import { useUiStore, type PhoneSheet } from '../uiStore';
import { Brand } from './Brand';
import { Sheet } from './Sheet';

const QuizPanel = lazy(() => import('@/quiz/QuizPanel'));

export function PhoneLayout() {
  const { t } = useTranslation();
  const sheet = useUiStore((s) => s.sheet);
  const quizOpen = useQuizLauncher((s) => s.open);
  const quizMode = useAtlasStore((s) => s.mode === 'quiz');
  const hasSelection = useAtlasStore((s) => Boolean(s.selectedId));
  const close = () => useUiStore.getState().setSheet(null);
  const headerRef = useRef<HTMLElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  useReportViewInsets(headerRef, bottomRef);
  const effectiveSheet: PhoneSheet = quizMode && (sheet === 'tree' || sheet === 'info') ? null : sheet;

  let bottom: React.ReactNode;
  if (effectiveSheet === 'layers')
    bottom = (
      <Sheet title={t('sidebar.layers')} onClose={close}>
        <LayersPanel />
      </Sheet>
    );
  else if (effectiveSheet === 'tree')
    bottom = (
      <Sheet title={t('sidebar.structures')} onClose={close} maxHeight="h-[58dvh]">
        <StructureTree />
      </Sheet>
    );
  else if (effectiveSheet === 'tools')
    bottom = (
      <Sheet title={t('phone.tools')} onClose={close}>
        <ToolsSheet />
      </Sheet>
    );
  else if (effectiveSheet === 'info' && hasSelection)
    bottom = (
      <Sheet bare onClose={close}>
        <InfoPanel variant="sheet" />
      </Sheet>
    );
  else if (quizOpen)
    bottom = (
      <Sheet bare maxHeight="max-h-[52dvh]">
        <Suspense
          fallback={
            <p className="flex items-center gap-2 p-4 text-sm">
              <Spinner /> {t('common.loading')}
            </p>
          }
        >
          <QuizPanel variant="sheet" />
        </Suspense>
      </Sheet>
    );
  else if (hasSelection && !quizMode) bottom = <InfoPeek />;
  else bottom = <FirstVisitHint touch />;

  return (
    <>
      <header
        ref={headerRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
      >
        <div className="flex items-center gap-2">
          <div className={cx(panelClass, 'flex h-10 min-w-0 flex-1 items-center rounded-xl px-2.5')}>
            <Brand compact />
          </div>
          <div className={cx(panelClass, 'flex h-10 items-center rounded-xl px-1')}>
            <NameLangToggle size="sm" />
          </div>
          <div className={cx(panelClass, 'flex h-10 items-center rounded-xl')}>
            <MoreMenu />
          </div>
        </div>
        {quizMode ? null : <SearchBox />}
      </header>

      <div
        ref={bottomRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {bottom}
        <PhoneBar active={effectiveSheet} quizMode={quizMode} hasSelection={hasSelection} />
      </div>
    </>
  );
}

function PhoneBar({
  active,
  quizMode,
  hasSelection,
}: {
  active: PhoneSheet;
  quizMode: boolean;
  hasSelection: boolean;
}) {
  const { t } = useTranslation();
  const xray = useAtlasStore((s) => s.xray);
  const toggleSheet = (s: Exclude<PhoneSheet, null>) =>
    useUiStore.getState().setSheet(useUiStore.getState().sheet === s ? null : s);
  const item = (key: Exclude<PhoneSheet, null>, icon: IconName, label: string, disabled = false) => (
    <BarButton
      icon={icon}
      label={label}
      pressed={active === key}
      disabled={disabled}
      onClick={() => toggleSheet(key)}
    />
  );
  return (
    <nav
      data-view-cover
      aria-label={t('toolbar.label')}
      className={cx(panelClass, 'flex items-stretch justify-between gap-0.5 rounded-xl p-1')}
    >
      {item('layers', 'layers', t('phone.layers'))}
      {item('tree', 'tree', t('phone.structures'), quizMode)}
      <ViewsMenu phone />
      <BarButton
        icon="xray"
        label={t('toolbar.xray')}
        pressed={xray}
        onClick={() => useAtlasStore.getState().setXray(!xray)}
      />
      {item('tools', 'tool', t('phone.tools'))}
      {item('info', 'info', t('phone.info'), quizMode || !hasSelection)}
    </nav>
  );
}

function BarButton({
  icon,
  label,
  pressed,
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="h-auto min-h-11 flex-1 flex-col gap-0.5 px-1 py-1 text-[10px] leading-none"
    >
      <Icon name={icon} className="size-5" />
      <span className="max-w-full truncate">{label}</span>
    </Button>
  );
}

function ToolsSheet() {
  const { t } = useTranslation();
  const quiz = useAtlasStore((s) => s.mode === 'quiz');
  const labels = useAtlasStore((s) => s.labelsVisible);
  const isolate = useAtlasStore((s) => s.isolate.mode);
  const hasSelection = useAtlasStore((s) => Boolean(s.selectedId));
  const ui = useUiStore.getState;
  return (
    <div className="flex flex-col gap-4 px-4 pt-1 pb-4">
      <ClippingControls />
      <ExplodeControl />
      <div className="grid grid-cols-2 gap-1.5">
        {!quiz ? (
          <>
            <Button
              size="sm"
              variant="subtle"
              pressed={isolate === 'isolate'}
              disabled={!hasSelection && isolate === 'none'}
              onClick={() => toggleIsolate('isolate')}
            >
              <Icon name="target" className="size-3.5" />
              {isolate !== 'none' ? t('toolbar.exitIsolate') : t('toolbar.isolate')}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              pressed={isolate === 'context'}
              disabled={!hasSelection && isolate === 'none'}
              onClick={() => toggleIsolate('context')}
            >
              <Icon name="layers" className="size-3.5" />
              {t('toolbar.isolateContext')}
            </Button>
            <Button size="sm" variant="subtle" disabled={!hasSelection} onClick={() => focusSelection()}>
              <Icon name="crosshair" className="size-3.5" />
              {t('info.focus')}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              pressed={labels}
              onClick={() => useAtlasStore.getState().setLabelsVisible(!labels)}
            >
              <Icon name="tag" className="size-3.5" />
              {t('toolbar.labels')}
            </Button>
          </>
        ) : null}
        <Button size="sm" variant="subtle" onClick={() => zoom(1.25)}>
          <Icon name="zoomIn" className="size-3.5" />
          {t('toolbar.zoomIn')}
        </Button>
        <Button size="sm" variant="subtle" onClick={() => zoom(0.8)}>
          <Icon name="zoomOut" className="size-3.5" />
          {t('toolbar.zoomOut')}
        </Button>
        <Button size="sm" variant="subtle" onClick={() => void takeScreenshot()}>
          <Icon name="camera" className="size-3.5" />
          {t('toolbar.screenshot')}
        </Button>
        {!quiz ? (
          <Button size="sm" variant="subtle" onClick={() => void copyShareLink()}>
            <Icon name="link" className="size-3.5" />
            {t('toolbar.share')}
          </Button>
        ) : null}
        <Button size="sm" variant="subtle" onClick={() => ui().setHelpOpen(true)}>
          <Icon name="help" className="size-3.5" />
          {t('toolbar.help')}
        </Button>
      </div>
    </div>
  );
}

function InfoPeek() {
  const { t } = useTranslation();
  const selectedId = useAtlasStore((s) => s.selectedId);
  const node = useAtlasStore((s) =>
    s.selectedId
      ? (s.structures[s.selectedId] ?? s.groups[s.selectedId] ?? s.landmarks[s.selectedId])
      : undefined,
  );
  const side = useAtlasStore((s) =>
    s.selectedId ? (s.structures[s.selectedId]?.side ?? s.landmarks[s.selectedId]?.side) : undefined,
  );
  const manifest = useAtlasStore((s) => s.manifest);
  const nameLang = useAtlasStore((s) => s.nameLang);
  if (!selectedId) return null;
  const sys = node ? findSystem(manifest, node.system) : undefined;
  const patchKind = patchKindOf(node);
  const open = () => useUiStore.getState().setSheet('info');
  return (
    <div className={cx(panelClass, 'flex items-center gap-2 rounded-xl p-2 pl-3')} data-testid="info-peek">
      <button
        type="button"
        onClick={open}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        aria-label={t('phone.expand')}
      >
        {sys ? <SystemChip color={sys.color} /> : <Spinner className="size-3.5" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {node ? displayName(node.names, nameLang) : '…'}
            {patchKind ? (
              <span className={cx('font-normal', mutedText)}> · {t(`kind.${patchKind}`)}</span>
            ) : null}
          </span>
          {sys ? <span className={cx('block truncate text-xs', mutedText)}>{systemLabel(sys)}</span> : null}
        </span>
        {side ? <SideBadge side={side} label={t(side === 'left' ? 'side.left' : 'side.right')} /> : null}
        <Icon name="chevronUp" className="size-4 text-zinc-500" />
      </button>
      <Button
        size="iconSm"
        aria-label={t('info.close')}
        onClick={() => useAtlasStore.getState().select(null)}
      >
        <Icon name="x" className="size-4" />
      </Button>
    </div>
  );
}
