/**
 * Everything layered over the 3D viewer. Talks to the viewer only through the store.
 */
import { useEffect } from 'react';
import { Tooltip } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { useAtlasStore } from '@/state';
import { cx, panelClass } from './components/classes';
import { Icon } from './components/Icon';
import { Button, Spinner } from './components/ui';
import { AboutDialog } from './dialogs/AboutDialog';
import { HelpDialog } from './dialogs/HelpDialog';
import { Toaster } from './dialogs/Toaster';
import { useAppEffects } from './hooks/useAppEffects';
import { useBreakpoint } from './hooks/useMediaQuery';
import { useShortcuts } from './hooks/useShortcuts';
import { SEARCH_INPUT_ID } from './lib/actions';
import { startUrlSync } from './lib/urlSync';
import { PhoneLayout } from './layout/PhoneLayout';
import { WideLayout } from './layout/WideLayout';

export function AppUi() {
  const { t } = useTranslation();
  useAppEffects();
  useShortcuts();
  useEffect(() => startUrlSync(), []);
  const bp = useBreakpoint();

  return (
    <Tooltip.Provider delayDuration={450} skipDelayDuration={200}>
      <div
        className="pointer-events-none absolute inset-0 font-sans text-zinc-900 antialiased dark:text-zinc-100"
        data-testid="app-ui"
        data-breakpoint={bp}
      >
        <a
          href={`#${SEARCH_INPUT_ID}`}
          className="pointer-events-auto absolute top-2 left-2 z-50 -translate-y-20 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white focus:translate-y-0"
        >
          {t('app.skipToSearch')}
        </a>
        {bp === 'phone' ? <PhoneLayout /> : <WideLayout tablet={bp === 'tablet'} />}
        <DataStatus />
      </div>
      <HelpDialog />
      <AboutDialog />
      <Toaster />
    </Tooltip.Provider>
  );
}

function DataStatus() {
  const { t } = useTranslation();
  const status = useAtlasStore((s) => s.dataStatus);
  const error = useAtlasStore((s) => s.dataError);
  if (status === 'loaded') return null;
  if (status === 'error')
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
        <div role="alert" className={cx(panelClass, 'flex max-w-sm flex-col items-start gap-3 p-5')}>
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="alert" className="size-5 text-red-700 dark:text-red-400" />
            {t('app.loadError')}
          </p>
          {error ? <p className="text-xs break-all text-zinc-600 dark:text-zinc-400">{error}</p> : null}
          <Button variant="primary" onClick={() => window.location.reload()}>
            {t('app.reload')}
          </Button>
        </div>
      </div>
    );
  return (
    <div className="absolute inset-x-0 top-1/2 z-30 flex justify-center">
      <p role="status" className={cx(panelClass, 'flex items-center gap-2 rounded-full px-4 py-2 text-sm')}>
        <Spinner /> {t('app.loading')}
      </p>
    </div>
  );
}
