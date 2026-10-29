import { APP_NAME } from '@/config';
import { useTranslation } from 'react-i18next';
import { cx } from '../components/classes';

/** Logo mark + app name (the name lives in src/config.ts → APP_NAME). */
export function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 items-center gap-2" title={t('app.tagline')}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className={cx('shrink-0', compact ? 'size-6' : 'size-7')}>
        <rect width="32" height="32" rx="8" className="fill-teal-700 dark:fill-teal-400" />
        <g
          className="fill-none stroke-white dark:stroke-zinc-950"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="16" cy="8.5" r="2.6" />
          <path d="M16 12v8M10.5 14.5l5.5 2 5.5-2M12.5 26l3.5-6 3.5 6" />
        </g>
      </svg>
      <h1 className={cx('truncate font-semibold tracking-tight', compact ? 'text-sm' : 'text-[15px]')}>
        {APP_NAME}
      </h1>
    </div>
  );
}
