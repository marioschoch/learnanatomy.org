/**
 * Phone bottom sheet: non-modal (the 3D view above stays usable), capped height, Esc closes,
 * focus moves into the sheet when it opens.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx, panelClass } from '../components/classes';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui';

export function Sheet({
  title,
  onClose,
  children,
  maxHeight = 'max-h-[58dvh]',
  bare = false,
}: {
  title?: string;
  onClose?: () => void;
  children: ReactNode;
  maxHeight?: string;
  /** Children bring their own header. */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      ref={ref}
      data-view-cover
      role="dialog"
      aria-modal="false"
      aria-labelledby={title ? titleId : undefined}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onClose) {
          e.stopPropagation();
          onClose();
        }
      }}
      className={cx(panelClass, 'flex min-h-0 flex-col overflow-hidden outline-none', maxHeight)}
    >
      <div className="flex justify-center pt-1.5" aria-hidden="true">
        <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
      </div>
      {bare ? (
        children
      ) : (
        <>
          <div className="flex items-center gap-2 px-4 pt-1 pb-1">
            <h2 id={titleId} className="flex-1 text-sm font-semibold">
              {title}
            </h2>
            {onClose ? (
              <Button size="iconSm" aria-label={t('common.close')} onClick={onClose}>
                <Icon name="x" className="size-4" />
              </Button>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">{children}</div>
        </>
      )}
    </div>
  );
}
