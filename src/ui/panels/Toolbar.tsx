/**
 * Bottom toolbar: views, X-ray, cutting planes, explode, isolate, labels, zoom, screenshot, share, help.
 * The controls are also reused by the phone "Tools" sheet.
 */
import { DropdownMenu, Popover } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import type { PlaneAxis, StandardView } from '@/contract';
import { STANDARD_VIEWS } from '@/contract';
import { useAtlasStore } from '@/state';
import { cx, mutedText, panelClass } from '../components/classes';
import { Icon } from '../components/Icon';
import { Button, IconButton, Kbd, SectionTitle, Slider, Switch, Tip } from '../components/ui';
import { copyShareLink, resetCamera, setView, takeScreenshot, toggleIsolate, zoom } from '../lib/actions';
import { useUiStore } from '../uiStore';

const AXES: PlaneAxis[] = ['sagittal', 'coronal', 'transverse'];

const menuItemClass = cx(
  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-800',
);
const menuContentClass = cx(panelClass, 'z-50 min-w-48 p-1');

export function Toolbar({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const xray = useAtlasStore((s) => s.xray);
  const labels = useAtlasStore((s) => s.labelsVisible);
  const quiz = useAtlasStore((s) => s.mode === 'quiz');
  const clipActive = useAtlasStore((s) => AXES.some((a) => s.clipping[a].enabled));
  const explode = useAtlasStore((s) => s.explode);

  return (
    <div
      role="toolbar"
      aria-label={t('toolbar.label')}
      className={cx(panelClass, 'flex items-center gap-0.5 p-1', compact && 'overflow-x-auto')}
    >
      <ViewsMenu />
      <Divider />
      <IconButton
        icon="xray"
        label={t('toolbar.xray')}
        shortcut="X"
        pressed={xray}
        onClick={() => useAtlasStore.getState().setXray(!xray)}
      />
      <Popover.Root>
        <Tip label={t('toolbar.clipping')}>
          <Popover.Trigger asChild>
            <Button size="icon" aria-label={t('toolbar.clipping')} pressed={clipActive}>
              <Icon name="scissors" className="size-[18px]" />
            </Button>
          </Popover.Trigger>
        </Tip>
        <Popover.Portal>
          <Popover.Content side="top" sideOffset={10} className={cx(panelClass, 'z-50 w-80 p-3')}>
            <ClippingControls />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Popover.Root>
        <Tip label={t('toolbar.explode')}>
          <Popover.Trigger asChild>
            <Button size="icon" aria-label={t('toolbar.explode')} pressed={explode > 0}>
              <Icon name="explode" className="size-[18px]" />
            </Button>
          </Popover.Trigger>
        </Tip>
        <Popover.Portal>
          <Popover.Content side="top" sideOffset={10} className={cx(panelClass, 'z-50 w-72 p-3')}>
            <ExplodeControl />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {quiz ? null : <IsolateMenu />}
      {quiz ? null : (
        <IconButton
          icon="tag"
          label={t('toolbar.labels')}
          shortcut="L"
          pressed={labels}
          onClick={() => useAtlasStore.getState().setLabelsVisible(!labels)}
        />
      )}
      <Divider />
      <IconButton icon="zoomOut" label={t('toolbar.zoomOut')} shortcut="−" onClick={() => zoom(0.8)} />
      <IconButton icon="zoomIn" label={t('toolbar.zoomIn')} shortcut="+" onClick={() => zoom(1.25)} />
      <Divider />
      <IconButton icon="camera" label={t('toolbar.screenshot')} onClick={() => void takeScreenshot()} />
      {quiz ? null : (
        <IconButton icon="link" label={t('toolbar.share')} onClick={() => void copyShareLink()} />
      )}
      <IconButton
        icon="help"
        label={t('toolbar.help')}
        shortcut="?"
        onClick={() => useUiStore.getState().setHelpOpen(true)}
      />
    </div>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-0.5 h-6 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />;
}

export function ViewsMenu({ phone = false }: { phone?: boolean }) {
  const { t } = useTranslation();
  const trigger = phone ? (
    <DropdownMenu.Trigger asChild>
      <Button className="h-auto min-h-11 flex-1 flex-col gap-0.5 px-1 py-1 text-[10px] leading-none">
        <Icon name="cube" className="size-5" />
        <span className="max-w-full truncate">{t('toolbar.views')}</span>
      </Button>
    </DropdownMenu.Trigger>
  ) : (
    <Tip label={t('toolbar.views')}>
      <DropdownMenu.Trigger asChild>
        <Button size="md" aria-label={t('toolbar.views')} className="px-2">
          <Icon name="cube" className="size-[18px]" />
          <Icon name="chevronUp" className="size-3 opacity-70" />
        </Button>
      </DropdownMenu.Trigger>
    </Tip>
  );
  return (
    <DropdownMenu.Root>
      {trigger}
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="top" sideOffset={10} align="start" className={menuContentClass}>
          <DropdownMenu.Label
            className={cx('px-2.5 pt-1 pb-1.5 text-[11px] font-semibold uppercase', mutedText)}
          >
            {t('toolbar.views')}
          </DropdownMenu.Label>
          {STANDARD_VIEWS.map((v: StandardView, i) => (
            <DropdownMenu.Item key={v} className={menuItemClass} onSelect={() => setView(v)}>
              <span className="flex-1">{t(`views.${v}`)}</span>
              <Kbd>{i + 1}</Kbd>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          <DropdownMenu.Item className={menuItemClass} onSelect={() => resetCamera()}>
            <Icon name="reset" className="size-3.5" />
            <span className="flex-1">{t('views.reset')}</span>
            <Kbd>R</Kbd>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function IsolateMenu() {
  const { t } = useTranslation();
  const mode = useAtlasStore((s) => s.isolate.mode);
  const hasSelection = useAtlasStore((s) => Boolean(s.selectedId));
  if (mode !== 'none') {
    return (
      <Button
        size="md"
        pressed
        onClick={() => useAtlasStore.getState().exitIsolate()}
        aria-label={t('toolbar.exitIsolate')}
        title={t('toolbar.exitIsolate')}
      >
        <Icon name="target" className="size-[18px]" />
        <span className="hidden text-xs lg:inline">{t('toolbar.exitIsolate')}</span>
      </Button>
    );
  }
  return (
    <DropdownMenu.Root>
      <Tip label={hasSelection ? t('toolbar.isolate') : t('toolbar.isolateNeedsSelection')}>
        <DropdownMenu.Trigger asChild disabled={!hasSelection}>
          <Button size="icon" aria-label={t('toolbar.isolate')} disabled={!hasSelection}>
            <Icon name="target" className="size-[18px]" />
          </Button>
        </DropdownMenu.Trigger>
      </Tip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="top" sideOffset={10} className={menuContentClass}>
          <DropdownMenu.Item className={menuItemClass} onSelect={() => toggleIsolate('isolate')}>
            <span className="flex-1">{t('toolbar.isolate')}</span>
            <Kbd>I</Kbd>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItemClass} onSelect={() => toggleIsolate('context')}>
            {t('toolbar.isolateContext')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ClippingControls() {
  const { t } = useTranslation();
  const clipping = useAtlasStore((s) => s.clipping);
  const any = AXES.some((a) => clipping[a].enabled);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionTitle>{t('clip.title')}</SectionTitle>
        <Button
          size="sm"
          variant="ghost"
          disabled={!any}
          onClick={() => useAtlasStore.getState().resetClipping()}
        >
          <Icon name="reset" className="size-3.5" />
          {t('clip.reset')}
        </Button>
      </div>
      {AXES.map((axis) => {
        const c = clipping[axis];
        const plane = t(`clip.${axis}`);
        const pct = Math.round(c.position * 1000) / 10;
        return (
          <div key={axis} className="flex flex-col gap-1.5" data-axis={axis}>
            <div className="flex items-center gap-2">
              <Switch
                size="sm"
                checked={c.enabled}
                label={t('clip.enable', { plane })}
                onCheckedChange={(v) => useAtlasStore.getState().setClipPlane(axis, { enabled: v })}
              />
              <span className="flex-1 text-sm font-medium">{plane}</span>
              <span className={cx('text-xs tabular-nums', mutedText)}>{pct.toFixed(0)} %</span>
              <IconButton
                icon="flip"
                size="iconSm"
                iconClassName="size-3.5"
                label={t('clip.flip')}
                pressed={c.flipped}
                disabled={!c.enabled}
                onClick={() => useAtlasStore.getState().setClipPlane(axis, { flipped: !c.flipped })}
              />
            </div>
            <Slider
              value={pct}
              step={0.5}
              disabled={!c.enabled}
              label={t('clip.position', { plane })}
              valueText={`${pct} %`}
              onValueChange={(v) => useAtlasStore.getState().setClipPlane(axis, { position: v / 100 })}
            />
          </div>
        );
      })}
      <p className={cx('text-[11px]', mutedText)}>{t('clip.hint')}</p>
    </div>
  );
}

export function ExplodeControl() {
  const { t } = useTranslation();
  const explode = useAtlasStore((s) => s.explode);
  const pct = Math.round(explode * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <SectionTitle>{t('toolbar.explode')}</SectionTitle>
        <span className={cx('text-xs tabular-nums', mutedText)}>{pct} %</span>
      </div>
      <Slider
        value={pct}
        label={t('toolbar.explodeAmount')}
        valueText={`${pct} %`}
        onValueChange={(v) => useAtlasStore.getState().setExplode(v / 100)}
      />
    </div>
  );
}
