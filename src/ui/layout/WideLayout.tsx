/**
 * Desktop (≥ 1024 px) and tablet (640–1023 px) layout: top bar (brand, search, settings), left sidebar
 * (Layers / Structures), right info or quiz panel, bottom toolbar. Panels float over the 3D view; the
 * wrapper is pointer-events-none so the canvas stays interactive between them. On tablets the sidebar is
 * collapsed by default and the settings live in a menu.
 */
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtlasStore } from '@/state';
import { useQuizLauncher } from '@/quiz/launcher';
import { cx, panelClass } from '../components/classes';
import { Icon } from '../components/Icon';
import { Button, IconButton, Spinner } from '../components/ui';
import { FirstVisitHint } from '../dialogs/FirstVisitHint';
import { InfoPanel } from '../panels/InfoPanel';
import { MoreMenu, NameLangToggle, ThemeMenu, UiLangToggle } from '../panels/Settings';
import { Toolbar } from '../panels/Toolbar';
import { SearchBox } from '../search/SearchBox';
import { useUiStore } from '../uiStore';
import { Brand } from './Brand';
import { Sidebar } from './Sidebar';

const QuizPanel = lazy(() => import('@/quiz/QuizPanel'));

const TOP = 'top-[4.25rem]';
const BOTTOM = 'bottom-[4.5rem]';

export function WideLayout({ tablet }: { tablet: boolean }) {
  const { t } = useTranslation();
  const sidebarPref = useUiStore((s) => s.sidebarOpen);
  const infoCollapsed = useUiStore((s) => s.infoCollapsed);
  const sidebarOpen = sidebarPref ?? !tablet;
  const quizOpen = useQuizLauncher((s) => s.open);
  const quizMode = useAtlasStore((s) => s.mode === 'quiz');
  const hasSelection = useAtlasStore((s) => Boolean(s.selectedId));
  const showInfo = !quizOpen && !quizMode && hasSelection;

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-3">
        <div className={cx(panelClass, 'flex h-11 shrink-0 items-center gap-1 rounded-xl pr-3 pl-1')}>
          <IconButton
            icon="panelLeft"
            label={sidebarOpen ? t('sidebar.hide') : t('sidebar.show')}
            tooltipSide="bottom"
            aria-expanded={sidebarOpen}
            aria-controls="atlas-sidebar"
            onClick={() => useUiStore.getState().setSidebarOpen(!sidebarOpen)}
          />
          <Brand compact={tablet} />
        </div>
        <div className="flex min-w-0 flex-1 justify-center">
          {quizMode ? null : <SearchBox className="w-full max-w-xl" />}
        </div>
        <div className={cx(panelClass, 'flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-1')}>
          {tablet ? null : (
            <>
              <NameLangToggle />
              <UiLangToggle />
              <ThemeMenu />
            </>
          )}
          <Button
            variant={quizOpen ? 'subtle' : 'ghost'}
            pressed={quizOpen}
            onClick={() => (quizOpen ? undefined : useQuizLauncher.getState().openQuiz())}
            aria-label={t('menu.quiz')}
          >
            <Icon name="quiz" className="size-[18px]" />
            <span className={tablet ? 'sr-only' : undefined}>{t('menu.quiz')}</span>
          </Button>
          {tablet ? (
            <MoreMenu />
          ) : (
            <IconButton
              icon="info"
              label={t('menu.about')}
              tooltipSide="bottom"
              onClick={() => useUiStore.getState().setAboutOpen(true)}
            />
          )}
        </div>
      </header>

      {sidebarOpen ? (
        <aside
          id="atlas-sidebar"
          aria-label={t('sidebar.label')}
          className={cx(panelClass, 'absolute left-3 z-10 flex w-80 flex-col', TOP, BOTTOM)}
        >
          <Sidebar />
        </aside>
      ) : null}

      {quizOpen ? (
        <aside
          data-right-panel="quiz"
          className={cx(
            panelClass,
            'absolute right-3 z-10 flex w-96 max-w-[calc(100vw-1.5rem)] flex-col',
            TOP,
            'max-h-[calc(100%-9rem)]',
          )}
        >
          <Suspense
            fallback={
              <p className="flex items-center gap-2 p-4 text-sm">
                <Spinner /> {t('common.loading')}
              </p>
            }
          >
            <QuizPanel />
          </Suspense>
        </aside>
      ) : showInfo ? (
        <aside
          data-right-panel="info"
          className={cx(
            panelClass,
            'absolute right-3 z-10 flex w-80 flex-col',
            TOP,
            'max-h-[calc(100%-9rem)]',
          )}
        >
          <InfoPanel
            collapsed={infoCollapsed}
            onToggleCollapsed={() => useUiStore.getState().setInfoCollapsed(!infoCollapsed)}
          />
        </aside>
      ) : null}

      {hasSelection || quizOpen ? null : <FirstVisitHint className={cx('absolute right-3 z-10', BOTTOM)} />}

      <footer className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
        <Toolbar compact={tablet} />
      </footer>
    </>
  );
}
