/** Help overlay: mouse/touch controls, keyboard shortcuts and the left/right convention. */
import { useTranslation } from 'react-i18next';
import { cx, mutedText } from '../components/classes';
import { Kbd, SectionTitle } from '../components/ui';
import { useUiStore } from '../uiStore';
import { Modal } from './Modal';

export function HelpDialog() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.helpOpen);
  const controls: [string, string][] = [
    [t('help.rotate'), t('help.rotateHow')],
    [t('help.pan'), t('help.panHow')],
    [t('help.zoom'), t('help.zoomHow')],
    [t('help.select'), t('help.selectHow')],
  ];
  const shortcuts: [string[], string][] = [
    [['/', 'Ctrl K'], t('help.kSearch')],
    [['Esc'], t('help.kEscape')],
    [['F'], t('help.kFocus')],
    [['I'], t('help.kIsolate')],
    [['H'], t('help.kHide')],
    [['X'], t('help.kXray')],
    [['L'], t('help.kLabels')],
    [['R'], t('help.kReset')],
    [['1', '…', '6'], t('help.kViews')],
    [['+', '−'], t('help.kZoom')],
    [['?'], t('help.kHelp')],
  ];
  return (
    <Modal open={open} onOpenChange={(o) => useUiStore.getState().setHelpOpen(o)} title={t('help.title')}>
      <div className="flex flex-col gap-5 text-sm">
        <section className="flex flex-col gap-2">
          <SectionTitle>{t('help.controls')}</SectionTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {controls.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-medium">{k}</dt>
                <dd className={mutedText}>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="flex flex-col gap-2">
          <SectionTitle>{t('help.shortcuts')}</SectionTitle>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5">
            {shortcuts.map(([keys, v]) => (
              <div key={v} className="contents">
                <dt className="flex gap-1">
                  {keys.map((k) => (k === '…' ? <span key={k}>…</span> : <Kbd key={k}>{k}</Kbd>))}
                </dt>
                <dd className={mutedText}>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <p className={cx('rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-800', mutedText)}>
          {t('help.orientation')}
        </p>
      </div>
    </Modal>
  );
}
