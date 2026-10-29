/** About / credits dialog. The content is code-split (React.lazy) and loaded on first open. */
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../components/ui';
import { useUiStore } from '../uiStore';
import { Modal } from './Modal';

const CreditsContent = lazy(() => import('./CreditsContent'));

export function AboutDialog() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.aboutOpen);
  return (
    <Modal
      open={open}
      onOpenChange={(o) => useUiStore.getState().setAboutOpen(o)}
      title={t('credits.title')}
      wide
    >
      {open ? (
        <Suspense
          fallback={
            <p className="flex items-center gap-2 text-sm">
              <Spinner /> {t('credits.loading')}
            </p>
          }
        >
          <CreditsContent />
        </Suspense>
      ) : null}
    </Modal>
  );
}
