/**
 * Layers: one row per system (colour chip, visibility switch, opacity slider, loading state) + presets.
 */
import { useTranslation } from 'react-i18next';
import type { SystemInfo } from '@/contract';
import { useAtlasStore } from '@/state';
import { cx } from '../components/classes';
import { Icon } from '../components/Icon';
import { Button, SectionTitle, Slider, Spinner, Switch, SystemChip } from '../components/ui';
import { sortedSystems, systemLabel } from '../lib/labels';
import { PRESET_IDS, presetAvailable, presetLayers, type PresetId } from './presets';

export function LayersPanel() {
  const { t } = useTranslation();
  const manifest = useAtlasStore((s) => s.manifest);
  const hiddenCount = useAtlasStore((s) => Object.keys(s.hiddenIds).length);
  const xray = useAtlasStore((s) => s.xray);
  const systems = sortedSystems(manifest);

  const applyPreset = (id: PresetId) => {
    const s = useAtlasStore.getState();
    const p = presetLayers(id, manifest);
    if (!p) {
      s.resetLayers();
      return;
    }
    s.applyLayerPreset(p.layers);
    s.setXray(p.xray);
  };

  return (
    <div className="flex flex-col gap-4 p-3">
      <section aria-labelledby="layers-title" className="flex flex-col gap-1">
        <SectionTitle id="layers-title">{t('layers.title')}</SectionTitle>
        <ul className="-mx-1 flex flex-col">
          {systems.map((sys) => (
            <LayerRow key={sys.id} sys={sys} />
          ))}
        </ul>
        {xray ? (
          <p className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <Icon name="xray" className="size-3.5" />
            {t('layers.xrayActive')}
          </p>
        ) : null}
        {hiddenCount > 0 ? (
          <div className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs dark:bg-zinc-800">
            <span>{t('layers.hiddenCount', { count: hiddenCount })}</span>
            <Button size="sm" variant="outline" onClick={() => useAtlasStore.getState().showAllNodes()}>
              <Icon name="eye" className="size-3.5" />
              {t('layers.showAll')}
            </Button>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="presets-title" className="flex flex-col gap-2">
        <SectionTitle id="presets-title">{t('layers.presets')}</SectionTitle>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESET_IDS.map((id) => (
            <Button
              key={id}
              size="sm"
              variant={id === 'reset' ? 'outline' : 'subtle'}
              disabled={!presetAvailable(id, manifest)}
              onClick={() => applyPreset(id)}
              className={cx('justify-start', id === 'reset' && 'col-span-2 justify-center')}
              data-preset={id}
            >
              {id === 'reset' ? <Icon name="reset" className="size-3.5" /> : null}
              {id === 'fullXray' ? <Icon name="xray" className="size-3.5" /> : null}
              {t(`presets.${id}`)}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}

function LayerRow({ sys }: { sys: SystemInfo }) {
  const { t } = useTranslation();
  const layer = useAtlasStore((s) => s.layers[sys.id]);
  const load = useAtlasStore((s) => s.systemLoad[sys.id]);
  const name = systemLabel(sys);
  const visible = Boolean(layer?.visible);
  const opacity = Math.round((layer?.opacity ?? sys.defaultOpacity) * 100);
  const loading = visible && (load?.meta === 'loading' || load?.geometry === 'loading');
  const error = load?.meta === 'error' || load?.geometry === 'error';
  const pct = Math.round((load?.progress ?? 0) * 100);

  return (
    <li
      className={cx('rounded-lg px-1 py-1.5', !visible && 'opacity-80')}
      data-system={sys.id}
      aria-busy={loading || undefined}
    >
      <div className="flex items-center gap-2.5">
        <SystemChip color={sys.color} className="size-3.5" />
        <span
          className={cx(
            'min-w-0 flex-1 truncate text-sm font-medium',
            !visible && 'text-zinc-600 dark:text-zinc-400',
          )}
        >
          {name}
        </span>
        {loading ? (
          <span className="flex items-center gap-1 text-[11px] text-zinc-600 tabular-nums dark:text-zinc-400">
            <Spinner className="size-3.5" label={t('layers.loadingPct', { pct })} />
            {load?.geometry === 'loading' && pct > 0 ? `${pct} %` : null}
          </span>
        ) : null}
        {error ? (
          <span
            role="img"
            aria-label={t('layers.error')}
            title={load?.error ?? t('layers.error')}
            className="text-red-700 dark:text-red-400"
          >
            <Icon name="alert" className="size-4" />
          </span>
        ) : null}
        <Switch
          size="sm"
          checked={visible}
          label={t('layers.toggle', { name })}
          onCheckedChange={(v) => useAtlasStore.getState().setLayerVisible(sys.id, v)}
        />
      </div>
      <div className="mt-1 flex items-center gap-2 pl-6">
        <Slider
          value={opacity}
          step={5}
          label={t('layers.opacity', { name })}
          valueText={`${opacity} %`}
          disabled={!visible}
          onValueChange={(v) => useAtlasStore.getState().setLayerOpacity(sys.id, v / 100)}
        />
        <span className="w-9 shrink-0 text-right text-[11px] text-zinc-600 tabular-nums dark:text-zinc-400">
          {opacity}%
        </span>
      </div>
    </li>
  );
}
