/**
 * Name-language toggle (Latin / English / German-if-in-data), UI-language toggle (DE/EN), theme menu and
 * the compact "menu" used on phones and tablets.
 */
import { DropdownMenu } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import type { NameLang, ThemePref, UiLang } from '@/contract';
import { useAtlasStore } from '@/state';
import { useQuizLauncher } from '@/quiz/launcher';
import { cx, mutedText, panelClass } from '../components/classes';
import { Icon, type IconName } from '../components/Icon';
import { Button, IconButton, Segmented, Tip } from '../components/ui';
import { nameLangOptions } from '../lib/labels';
import { savePrefs } from '../lib/prefs';
import { useUiStore } from '../uiStore';

const THEME_ICON: Record<ThemePref, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' };

export function NameLangToggle({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  const manifest = useAtlasStore((s) => s.manifest);
  const nameLang = useAtlasStore((s) => s.nameLang);
  const options = nameLangOptions(manifest);
  const value = options.includes(nameLang) ? nameLang : 'la';
  return (
    <Segmented<NameLang>
      size={size}
      label={t('settings.nameLangHint')}
      value={value}
      onValueChange={(v) => useAtlasStore.getState().setNameLang(v)}
      options={options.map((l) => ({
        value: l,
        label: t(`nameLangsShort.${l}`),
        title: t(`nameLangs.${l}`),
      }))}
    />
  );
}

export function UiLangToggle({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  const uiLang = useAtlasStore((s) => s.uiLang);
  return (
    <Segmented<UiLang>
      size={size}
      label={t('settings.uiLang')}
      value={uiLang}
      onValueChange={(v) => useAtlasStore.getState().setUiLang(v)}
      options={[
        { value: 'de', label: 'DE', title: 'Deutsch' },
        { value: 'en', label: 'EN', title: 'English' },
      ]}
    />
  );
}

const itemClass =
  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-800';

export function ThemeMenu() {
  const { t } = useTranslation();
  const theme = useAtlasStore((s) => s.theme);
  return (
    <DropdownMenu.Root>
      <Tip label={t('settings.theme')} side="bottom">
        <DropdownMenu.Trigger asChild>
          <Button size="icon" aria-label={t('settings.theme')}>
            <Icon name={THEME_ICON[theme]} className="size-[18px]" />
          </Button>
        </DropdownMenu.Trigger>
      </Tip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className={cx(panelClass, 'z-50 min-w-40 p-1')}>
          <ThemeRadio />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ThemeRadio() {
  const { t } = useTranslation();
  const theme = useAtlasStore((s) => s.theme);
  const labels: Record<ThemePref, string> = {
    system: t('settings.themeSystem'),
    light: t('settings.themeLight'),
    dark: t('settings.themeDark'),
  };
  return (
    <DropdownMenu.RadioGroup
      value={theme}
      onValueChange={(v) => useAtlasStore.getState().setTheme(v as ThemePref)}
    >
      {(['system', 'light', 'dark'] as ThemePref[]).map((v) => (
        <DropdownMenu.RadioItem key={v} value={v} className={itemClass}>
          <Icon name={THEME_ICON[v]} className="size-4" />
          <span className="flex-1">{labels[v]}</span>
          <DropdownMenu.ItemIndicator>
            <Icon name="check" className="size-3.5" />
          </DropdownMenu.ItemIndicator>
        </DropdownMenu.RadioItem>
      ))}
    </DropdownMenu.RadioGroup>
  );
}

/** Everything from the top bar in one menu (phones, small tablets). */
export function MoreMenu() {
  const { t } = useTranslation();
  const reducedMotion = useAtlasStore((s) => s.reducedMotion);
  const ui = useUiStore.getState;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton icon="more" label={t('menu.more')} tooltipSide="bottom" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className={cx(panelClass, 'z-50 w-64 p-1.5')}>
          <div className="flex flex-col gap-2 px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className={cx('text-xs font-medium', mutedText)}>{t('settings.nameLang')}</span>
              <NameLangToggle size="sm" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={cx('text-xs font-medium', mutedText)}>{t('settings.uiLang')}</span>
              <UiLangToggle size="sm" />
            </div>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          <DropdownMenu.Label className={cx('px-2.5 py-1 text-[11px] font-semibold uppercase', mutedText)}>
            {t('settings.theme')}
          </DropdownMenu.Label>
          <ThemeRadio />
          <DropdownMenu.CheckboxItem
            className={itemClass}
            checked={reducedMotion}
            onCheckedChange={(v) => {
              useAtlasStore.getState().setReducedMotion(v);
              savePrefs({ reducedMotion: v });
            }}
          >
            <span className="flex-1">{t('settings.reducedMotion')}</span>
            <DropdownMenu.ItemIndicator>
              <Icon name="check" className="size-3.5" />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          <DropdownMenu.Item className={itemClass} onSelect={() => useQuizLauncher.getState().openQuiz()}>
            <Icon name="quiz" className="size-4" />
            {t('menu.quiz')}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={itemClass} onSelect={() => ui().setHelpOpen(true)}>
            <Icon name="help" className="size-4" />
            {t('menu.help')}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={itemClass} onSelect={() => ui().setAboutOpen(true)}>
            <Icon name="info" className="size-4" />
            {t('menu.about')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
