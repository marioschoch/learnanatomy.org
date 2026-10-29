/** One-time hint for first visitors (remembered in localStorage, try/catch). */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtlasStore } from '@/state';
import { cx, mutedText, panelClass } from '../components/classes';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui';
import { loadPrefs, savePrefs } from '../lib/prefs';
import { useUiStore } from '../uiStore';

export function FirstVisitHint({ className, touch = false }: { className?: string; touch?: boolean }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => !loadPrefs().hintSeen);
  const ready = useAtlasStore((s) => s.dataStatus === 'loaded');
  const quiz = useAtlasStore((s) => s.mode === 'quiz');
  if (!visible || !ready || quiz) return null;
  const dismiss = () => {
    savePrefs({ hintSeen: true });
    setVisible(false);
  };
  return (
    <div
      role="note"
      aria-label={t('hint.title')}
      className={cx(panelClass, 'flex max-w-sm gap-3 p-3', className)}
    >
      <Icon name="info" className="mt-0.5 size-5 text-teal-700 dark:text-teal-400" />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm">
          <strong className="font-semibold">{t('hint.title')}</strong>{' '}
          <span className={mutedText}>
            {t('hint.body')}
            {touch ? null : ` ${t('search.shortcutHint')}.`}
          </span>
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={dismiss}>
            {t('hint.dismiss')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              dismiss();
              useUiStore.getState().setHelpOpen(true);
            }}
          >
            {t('hint.help')}
          </Button>
        </div>
      </div>
    </div>
  );
}
