/** Centered modal dialog (Radix Dialog) with title, close button and scrollable body. */
import type { ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { cx, panelClass } from '../components/classes';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui';

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cx(
            panelClass,
            'fixed top-1/2 left-1/2 z-50 flex max-h-[min(88vh,52rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            wide ? 'max-w-2xl' : 'max-w-lg',
          )}
        >
          <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-3 dark:border-zinc-700/80">
            <Dialog.Title className="flex-1 text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button size="iconSm" aria-label={t('common.close')}>
                <Icon name="x" className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
