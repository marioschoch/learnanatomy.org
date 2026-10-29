import { useTranslation } from 'react-i18next';
import { supportPath } from '@/config';
import { useAtlasStore } from '@/state';
import { cx, focusRing, heartClass } from '../components/classes';
import { Icon } from '../components/Icon';

/**
 * "♥ Support" pill at the right end of the top bar. A plain link to the static support page (seo/render.ts), never
 * straight to the payment page. Below 768 px only the heart shows (like the tablet Quiz button), so the search box
 * keeps its width; phones have the link in the menu instead.
 */
export function SupportLink() {
  const { t } = useTranslation();
  const uiLang = useAtlasStore((s) => s.uiLang);
  return (
    <a
      href={supportPath(uiLang)}
      aria-label={t('menu.supportLong')}
      className={cx(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-teal-50 pr-3 pl-2.5 text-sm max-md:px-2.5 font-medium whitespace-nowrap text-teal-800 ring-1 ring-teal-600/20 ring-inset select-none hover:bg-teal-100 dark:bg-teal-400/10 dark:text-teal-200 dark:ring-teal-400/25 dark:hover:bg-teal-400/20 motion-safe:transition-colors',
        focusRing,
      )}
    >
      <Icon name="heart" className={cx('size-3.5', heartClass)} />
      <span className="max-md:sr-only">{t('menu.support')}</span>
    </a>
  );
}
