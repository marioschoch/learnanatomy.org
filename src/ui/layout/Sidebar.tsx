/** Left sidebar: Layers + Structure tree tabs. The tree stays mounted (keeps expansion, syncs selection). */
import { Tabs } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { useAtlasStore } from '@/state';
import { cx, focusRing, mutedText } from '../components/classes';
import { Icon } from '../components/Icon';
import { LayersPanel } from '../panels/LayersPanel';
import { StructureTree } from '../tree/StructureTree';
import { useUiStore, type SidebarTab } from '../uiStore';

const tabClass = cx(
  'flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-zinc-950 data-[state=active]:shadow-sm dark:text-zinc-400 dark:hover:text-white dark:data-[state=active]:bg-zinc-700 dark:data-[state=active]:text-white',
  focusRing,
);

export function Sidebar() {
  const { t } = useTranslation();
  const tab = useUiStore((s) => s.sidebarTab);
  const quiz = useAtlasStore((s) => s.mode === 'quiz');
  const value: SidebarTab = quiz ? 'layers' : tab;
  return (
    <Tabs.Root
      value={value}
      onValueChange={(v) => useUiStore.getState().setSidebarTab(v as SidebarTab)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <Tabs.List
        aria-label={t('sidebar.label')}
        className="m-2 mb-0 flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800"
      >
        <Tabs.Trigger value="layers" className={tabClass}>
          <Icon name="layers" className="size-4" />
          {t('sidebar.layers')}
        </Tabs.Trigger>
        <Tabs.Trigger value="tree" className={tabClass} disabled={quiz}>
          <Icon name="tree" className="size-4" />
          {t('sidebar.structures')}
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="layers" className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none">
        <LayersPanel />
      </Tabs.Content>
      <Tabs.Content
        value="tree"
        forceMount
        className="flex min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden"
      >
        {quiz ? <p className={cx('p-4 text-sm', mutedText)}>{t('quiz.hiddenInfo')}</p> : <StructureTree />}
      </Tabs.Content>
    </Tabs.Root>
  );
}
