/** Minimal toast (polite live region), auto-dismiss after a few seconds. */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cx, panelClass } from '../components/classes';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/ui';
import { useUiStore } from '../uiStore';

export function Toaster() {
  const { t } = useTranslation();
  const toast = useUiStore((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => useUiStore.getState().dismissToast(), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4"
    >
      {toast ? (
        <div
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          className={cx(panelClass, 'flex max-w-md items-center gap-2 py-2 pr-1.5 pl-3 text-sm')}
        >
          <Icon
            name={toast.tone === 'error' ? 'alert' : 'check'}
            className={cx(
              'size-4',
              toast.tone === 'error' ? 'text-red-700 dark:text-red-400' : 'text-teal-700 dark:text-teal-400',
            )}
          />
          <span className="flex-1">{toast.message}</span>
          <IconButton
            icon="x"
            size="iconSm"
            label={t('common.close')}
            onClick={() => useUiStore.getState().dismissToast()}
          />
        </div>
      ) : null}
    </div>
  );
}
