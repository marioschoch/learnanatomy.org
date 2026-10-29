/**
 * Quiz UI (code-split, loaded on first open): scope picker → questions (Locate / Identify / Name it) →
 * summary with mistakes and "retry mistakes". Spaced repetition via Leitner boxes (localStorage).
 * While running, the atlas is in mode 'quiz': labels and the info panel are hidden, 3D picks arrive as quizPick.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Structure, SystemInfo } from '@/contract';
import { displayName, useAtlasStore } from '@/state';
import { cx, inputClass, mutedText } from '@/ui/components/classes';
import { Icon } from '@/ui/components/Icon';
import {
  Button,
  IconButton,
  SectionTitle,
  Segmented,
  SideBadge,
  Spinner,
  SystemChip,
} from '@/ui/components/ui';
import { findRegion, regionLabel, sortedSystems, systemLabel } from '@/ui/lib/labels';
import { enterQuizMode, exitQuizMode, presentFeedback, presentQuestion } from './director';
import { checkTypedAnswer } from './fuzzy';
import {
  buildPool,
  generateQuiz,
  QUESTION_TYPES,
  type Question,
  type QuestionType,
  type SideFilter,
} from './generate';
import { loadDeck, review, saveDeck, weakIds, type LeitnerDeck } from './leitner';
import { useQuizLauncher } from './launcher';
import { isCorrect, mistakesOf, scoreOf, useQuizStore, type QuizAnswer } from './quizStore';

const COUNTS = [5, 10, 20, 40] as const;

function allLoadedStructures(): Structure[] {
  return Object.values(useAtlasStore.getState().structures);
}

function sideSuffix(st: Structure, t: (k: 'side.left' | 'side.right') => string): string {
  if (!st.side || st.sideSource === 'name') return '';
  return ` (${t(st.side === 'left' ? 'side.left' : 'side.right').toLowerCase()})`;
}

export default function QuizPanel({ variant = 'panel' }: { variant?: 'panel' | 'sheet' }) {
  const { t } = useTranslation();
  const phase = useQuizStore((s) => s.phase);
  const index = useQuizStore((s) => s.index);
  const total = useQuizStore((s) => s.questions.length);
  const score = useQuizStore(scoreOf);
  const answered = useQuizStore((s) => Object.keys(s.answers).length);
  const launchSeq = useQuizLauncher((s) => s.seq);

  // Apply the launcher's initial scope (e.g. "Quiz me on this region") when opened.
  useEffect(() => {
    const { initialScope } = useQuizLauncher.getState();
    const quiz = useQuizStore.getState();
    if (quiz.phase !== 'setup') return;
    const atlas = useAtlasStore.getState();
    const visible = sortedSystems(atlas.manifest)
      .filter((s) => atlas.layers[s.id]?.visible)
      .map((s) => s.id);
    quiz.setScope({
      systems: initialScope?.systems?.length
        ? initialScope.systems
        : quiz.scope.systems.length
          ? quiz.scope.systems
          : visible,
      regions: initialScope ? (initialScope.regions ?? []) : quiz.scope.regions,
    });
  }, [launchSeq]);

  const close = () => {
    exitQuizMode();
    useQuizStore.getState().backToSetup();
    useQuizLauncher.getState().closeQuiz();
  };

  return (
    <section aria-label={t('quiz.title')} data-testid="quiz-panel" className="flex min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-700/80">
        <Icon name="quiz" className="size-5 text-teal-700 dark:text-teal-400" />
        <h2 className="flex-1 text-base font-semibold">
          {phase === 'setup'
            ? t('quiz.setupTitle')
            : phase === 'summary'
              ? t('quiz.summaryTitle')
              : t('quiz.title')}
        </h2>
        {phase === 'running' ? (
          <span className={cx('text-xs tabular-nums', mutedText)} aria-live="polite">
            {t('quiz.progress', { current: index + 1, total })} ·{' '}
            {t('quiz.score', { score, total: answered })}
          </span>
        ) : null}
        <IconButton
          icon="x"
          size="iconSm"
          label={phase === 'running' ? t('quiz.end') : t('common.close')}
          onClick={close}
        />
      </header>
      <div
        className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain p-4', variant === 'sheet' && 'pb-6')}
      >
        {phase === 'setup' ? <QuizSetup /> : phase === 'running' ? <QuizRunning /> : <QuizSummary />}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ setup

function QuizSetup() {
  const { t } = useTranslation();
  const manifest = useAtlasStore((s) => s.manifest);
  const structures = useAtlasStore((s) => s.structures);
  const systemLoad = useAtlasStore((s) => s.systemLoad);
  const nameLang = useAtlasStore((s) => s.nameLang);
  const scope = useQuizStore((s) => s.scope);
  const [deck] = useState<LeitnerDeck>(() => loadDeck());
  const [startingWeak, setStartingWeak] = useState(false);
  const systems = sortedSystems(manifest);
  const regions = useMemo(() => manifest?.regions ?? [], [manifest]);

  // Load metadata of the selected systems (to know the pool).
  useEffect(() => {
    for (const id of scope.systems) void useAtlasStore.getState().ensureSystemMeta(id);
  }, [scope.systems]);

  const loading = scope.systems.some(
    (id) => systemLoad[id]?.meta === 'loading' || systemLoad[id]?.meta === 'idle',
  );
  const pool = useMemo(
    () => buildPool(Object.values(structures), scope, regions),
    [structures, scope, regions],
  );
  const weak = useMemo(() => weakIds(deck), [deck]);
  const setScope = useQuizStore.getState().setScope;

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const start = () => {
    const questions = generateQuiz(pool, scope, { rng: Math.random, nameLang });
    if (!questions.length) return;
    enterQuizMode(scope.systems);
    useQuizStore.getState().start(questions, { poolIds: pool.map((s) => s.id) });
  };

  const startWeak = async () => {
    setStartingWeak(true);
    try {
      const atlas = useAtlasStore.getState();
      const nodes = await Promise.all(weak.slice(0, 200).map((id) => atlas.ensureNodeMeta(id)));
      const targets = nodes.filter(
        (n): n is NonNullable<typeof n> & { nodeType: 'structure' } => n?.nodeType === 'structure',
      );
      if (!targets.length) return;
      const sysIds = [...new Set(targets.map((n) => n.system))];
      const weakPool = buildPool(
        allLoadedStructures(),
        { systems: sysIds, regions: [], side: 'both' },
        regions,
      );
      const types = scope.types.length ? scope.types : [...QUESTION_TYPES];
      const chosen = targets.slice(0, Math.max(scope.count, 1));
      const questions = generateQuiz(
        weakPool,
        { ...scope, systems: sysIds, types },
        {
          rng: Math.random,
          nameLang,
          targets: chosen.map((n, i) => ({ id: n.id, type: types[i % types.length]! })),
        },
      );
      if (!questions.length) return;
      enterQuizMode(sysIds);
      useQuizStore.getState().start(questions, { weakMode: true, poolIds: weakPool.map((s) => s.id) });
    } finally {
      setStartingWeak(false);
    }
  };

  const topRegions = regions.filter((r) => !r.parentId);
  const childrenOf = (id: string) => regions.filter((r) => r.parentId === id);

  return (
    <div className="flex flex-col gap-5 text-sm">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5">
          <SectionTitle>{t('quiz.systems')}</SectionTitle>
        </legend>
        {systems.map((sys: SystemInfo) => (
          <label
            key={sys.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <input
              type="checkbox"
              checked={scope.systems.includes(sys.id)}
              onChange={() => setScope({ systems: toggle(scope.systems, sys.id) })}
              className="size-4 accent-teal-700 dark:accent-teal-400"
            />
            <SystemChip color={sys.color} />
            <span className="flex-1">{systemLabel(sys)}</span>
          </label>
        ))}
      </fieldset>

      {regions.length ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5">
            <SectionTitle>{t('quiz.regions')}</SectionTitle>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            <Chip pressed={scope.regions.length === 0} onClick={() => setScope({ regions: [] })}>
              {t('quiz.allRegions')}
            </Chip>
            {topRegions
              .flatMap((r) => [r, ...childrenOf(r.id)])
              .map((r) => (
                <Chip
                  key={r.id}
                  pressed={scope.regions.includes(r.id)}
                  onClick={() => setScope({ regions: toggle(scope.regions, r.id) })}
                  sub={Boolean(r.parentId)}
                >
                  {regionLabel(r)}
                </Chip>
              ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="flex flex-col gap-1.5">
          <SectionTitle>{t('quiz.side')}</SectionTitle>
          <Segmented<SideFilter>
            size="sm"
            label={t('quiz.side')}
            value={scope.side}
            onValueChange={(side) => setScope({ side })}
            options={[
              { value: 'both', label: t('quiz.sideBoth') },
              { value: 'left', label: t('quiz.sideLeft') },
              { value: 'right', label: t('quiz.sideRight') },
            ]}
          />
          <p className={cx('max-w-48 text-[11px]', mutedText)}>{t('quiz.sideHint')}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <SectionTitle>{t('quiz.count')}</SectionTitle>
          <Segmented<string>
            size="sm"
            label={t('quiz.count')}
            value={String(scope.count)}
            onValueChange={(v) => setScope({ count: Number(v) })}
            options={COUNTS.map((c) => ({ value: String(c), label: String(c) }))}
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5">
          <SectionTitle>{t('quiz.types')}</SectionTitle>
        </legend>
        {QUESTION_TYPES.map((type) => (
          <label
            key={type}
            className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <input
              type="checkbox"
              checked={scope.types.includes(type)}
              onChange={() => setScope({ types: toggle(scope.types, type) as QuestionType[] })}
              className="mt-0.5 size-4 accent-teal-700 dark:accent-teal-400"
            />
            <span>
              <span className="font-medium">{t(TYPE_LABEL[type])}</span>
              <span className={cx('block text-xs', mutedText)}>{t(TYPE_HINT[type])}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <p className={cx('text-xs', mutedText)} aria-live="polite" data-testid="quiz-pool">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Spinner className="size-3.5" /> {t('quiz.poolLoading')}
            </span>
          ) : pool.length ? (
            t('quiz.poolSize', { count: pool.length })
          ) : (
            t('quiz.poolEmpty')
          )}
        </p>
        <Button
          variant="primary"
          onClick={start}
          disabled={!pool.length || !scope.types.length || loading}
          data-testid="quiz-start"
        >
          <Icon name="quiz" className="size-4" />
          {t('quiz.start')}
        </Button>
        <Button variant="outline" onClick={() => void startWeak()} disabled={!weak.length || startingWeak}>
          {startingWeak ? <Spinner className="size-3.5" /> : null}
          {t('quiz.practiceWeak')} {weak.length ? `(${weak.length})` : ''}
        </Button>
        {!weak.length ? <p className={cx('text-[11px]', mutedText)}>{t('quiz.noWeak')}</p> : null}
        <p className={cx('text-[11px]', mutedText)}>
          {t('quiz.hiddenInfo')} {t('quiz.leitnerNote')}
        </p>
      </div>
    </div>
  );
}

const TYPE_LABEL = {
  locate: 'quiz.typeLocate',
  identify: 'quiz.typeIdentify',
  name: 'quiz.typeName',
} as const;
const TYPE_HINT = {
  locate: 'quiz.typeLocateHint',
  identify: 'quiz.typeIdentifyHint',
  name: 'quiz.typeNameHint',
} as const;

function Chip({
  pressed,
  onClick,
  children,
  sub,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  sub?: boolean;
}) {
  return (
    <Button
      size="sm"
      variant="subtle"
      pressed={pressed}
      onClick={onClick}
      className={cx('rounded-full', sub && 'font-normal')}
    >
      {children}
    </Button>
  );
}

// ------------------------------------------------------------------------------------------------ running

function recordLeitner(targetId: string, correct: boolean) {
  saveDeck(review(loadDeck(), targetId, correct));
}

function submit(q: Question, answer: QuizAnswer) {
  const quiz = useQuizStore.getState();
  if (quiz.answers[q.id]) return;
  quiz.answer(q.id, answer);
  recordLeitner(q.targetId, isCorrect(answer));
  presentFeedback(q, answer);
}

function QuizRunning() {
  const { t } = useTranslation();
  const question = useQuizStore((s) => s.questions[s.index]);
  const answer = useQuizStore((s) => (question ? s.answers[question.id] : undefined));
  const target = useAtlasStore((s) => (question ? s.structures[question.targetId] : undefined));
  const nameLang = useAtlasStore((s) => s.nameLang);
  const nextRef = useRef<HTMLButtonElement>(null);
  const isLast = useQuizStore((s) => s.index + 1 >= s.questions.length);

  // Present each question once.
  const qid = question?.id;
  useEffect(() => {
    const q = useQuizStore.getState().questions[useQuizStore.getState().index];
    if (q && !useQuizStore.getState().answers[q.id]) presentQuestion(q);
  }, [qid]);

  // Locate: evaluate 3D picks (the store routes clicks to quizPick while mode === 'quiz').
  useEffect(() => {
    if (!question || question.type !== 'locate') return;
    return useAtlasStore.subscribe(
      (s) => s.quizPick,
      (pick) => {
        if (!pick.id || useQuizStore.getState().answers[question.id]) return;
        const st = useAtlasStore.getState().structures[question.targetId];
        const verdict =
          pick.id === question.targetId ? 'correct' : st?.pairId === pick.id ? 'wrong-side' : 'wrong';
        submit(question, { verdict, givenId: pick.id });
      },
    );
  }, [question]);

  useEffect(() => {
    if (answer) nextRef.current?.focus();
  }, [answer]);

  if (!question || !target) {
    return (
      <p className={cx('flex items-center gap-2 text-sm', mutedText)}>
        <Spinner /> {t('common.loading')}
      </p>
    );
  }

  const targetName = displayName(target.names, nameLang) + sideSuffix(target, t);

  return (
    <div className="flex flex-col gap-4" data-question-type={question.type} data-testid="quiz-question">
      {question.type === 'locate' ? (
        <div>
          <p className={cx('text-xs font-semibold tracking-wide uppercase', mutedText)}>
            {t('quiz.typeLocate')}
          </p>
          <p className="mt-1 text-lg leading-snug">
            {t('quiz.locatePrompt')} <strong className="font-bold">{targetName}</strong>
          </p>
          {!answer ? (
            <p className={cx('mt-2 flex items-center gap-2 text-sm', mutedText)}>
              <Icon name="crosshair" className="size-4" />
              {t('quiz.locateWaiting')}
            </p>
          ) : null}
        </div>
      ) : question.type === 'identify' ? (
        <IdentifyQuestion question={question} answer={answer} />
      ) : (
        <NameQuestion question={question} target={target} answer={answer} />
      )}

      {answer ? <Feedback question={question} answer={answer} target={target} /> : null}

      <div className="flex gap-2">
        {answer ? (
          <Button
            ref={nextRef}
            variant="primary"
            className="flex-1"
            onClick={() => advance()}
            data-testid="quiz-next"
          >
            {isLast ? t('common.done') : t('common.next')}
            <Icon name="chevronRight" className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" onClick={() => submit(question, { verdict: 'skipped' })}>
            {t('quiz.skip')}
          </Button>
        )}
      </div>
    </div>
  );
}

function advance() {
  const quiz = useQuizStore.getState();
  quiz.next();
  if (useQuizStore.getState().phase === 'summary') exitQuizMode();
}

function IdentifyQuestion({ question, answer }: { question: Question; answer: QuizAnswer | undefined }) {
  const { t } = useTranslation();
  const structures = useAtlasStore((s) => s.structures);
  const nameLang = useAtlasStore((s) => s.nameLang);
  const options = useMemo(() => question.options ?? [], [question.options]);

  useEffect(() => {
    if (answer) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > options.length) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      const id = options[n - 1]!;
      submit(question, { verdict: id === question.targetId ? 'correct' : 'wrong', givenId: id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, options, question]);

  return (
    <div>
      <p className={cx('text-xs font-semibold tracking-wide uppercase', mutedText)}>
        {t('quiz.typeIdentify')}
      </p>
      <p className="mt-1 mb-3 text-lg leading-snug">{t('quiz.identifyPrompt')}</p>
      <div className="flex flex-col gap-2" role="group" aria-label={t('quiz.identifyPrompt')}>
        {options.map((id, i) => {
          const st = structures[id];
          const label = st ? displayName(st.names, nameLang) : id;
          const isTarget = id === question.targetId;
          const chosen = answer?.givenId === id;
          return (
            <Button
              key={id}
              variant="outline"
              disabled={Boolean(answer)}
              onClick={() => submit(question, { verdict: isTarget ? 'correct' : 'wrong', givenId: id })}
              className={cx(
                'h-auto min-h-10 justify-start py-2 text-left whitespace-normal disabled:opacity-100',
                answer &&
                  isTarget &&
                  'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-400/15 dark:text-emerald-50',
                answer &&
                  chosen &&
                  !isTarget &&
                  'border-red-600 bg-red-50 text-red-950 dark:border-red-400 dark:bg-red-400/15 dark:text-red-50',
              )}
              data-option={id}
            >
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-zinc-100 text-[11px] font-semibold dark:bg-zinc-800">
                {i + 1}
              </span>
              <span className="flex-1">{label}</span>
              {answer && isTarget ? <Icon name="check" className="size-4" /> : null}
              {answer && chosen && !isTarget ? <Icon name="x" className="size-4" /> : null}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function NameQuestion({
  question,
  target,
  answer,
}: {
  question: Question;
  target: Structure;
  answer: QuizAnswer | undefined;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!answer) inputRef.current?.focus({ preventScroll: true });
  }, [question.id, answer]);

  const check = () => {
    if (!text.trim()) return;
    const accepted = [target.names.la, target.names.en, target.names.de].filter((n): n is string =>
      Boolean(n),
    );
    const r = checkTypedAnswer(text, accepted);
    submit(question, {
      verdict: r.verdict === 'exact' ? 'correct' : r.verdict,
      givenText: text.trim(),
      distance: r.distance,
      tolerance: r.tolerance,
      expected: r.expected,
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        check();
      }}
    >
      <p className={cx('text-xs font-semibold tracking-wide uppercase', mutedText)}>{t('quiz.typeName')}</p>
      <label htmlFor="quiz-name-input" className="mt-1 mb-3 block text-lg leading-snug">
        {t('quiz.namePrompt')}
        {target.side && target.sideSource !== 'name' ? (
          <span className="ml-2 align-middle">
            <SideBadge side={target.side} label={t(target.side === 'left' ? 'side.left' : 'side.right')} />
          </span>
        ) : null}
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="quiz-name-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={Boolean(answer)}
          placeholder={t('quiz.nameInputHint')}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={inputClass}
        />
        {!answer ? (
          <Button type="submit" variant="primary" disabled={!text.trim()}>
            {t('quiz.submit')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Feedback({
  question,
  answer,
  target,
}: {
  question: Question;
  answer: QuizAnswer;
  target: Structure;
}) {
  const { t } = useTranslation();
  const structures = useAtlasStore((s) => s.structures);
  const nameLang = useAtlasStore((s) => s.nameLang);
  const ok = isCorrect(answer);
  const correctName = displayName(target.names, nameLang) + sideSuffix(target, t);
  const given = answer.givenId ? structures[answer.givenId] : undefined;
  const title =
    answer.verdict === 'correct'
      ? t('quiz.correct')
      : answer.verdict === 'typo'
        ? t('quiz.correctTypo')
        : answer.verdict === 'wrong-side'
          ? t('quiz.wrongSide')
          : answer.verdict === 'skipped'
            ? t('quiz.skipped')
            : t('quiz.wrong');
  return (
    <div
      role="status"
      data-testid="quiz-feedback"
      data-verdict={answer.verdict}
      className={cx(
        'rounded-xl border p-3 text-sm',
        ok
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-50'
          : 'border-red-300 bg-red-50 text-red-950 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-50',
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        <Icon name={ok ? 'check' : 'x'} className="size-4" />
        {title}
      </p>
      {question.type === 'locate' && given && answer.givenId !== question.targetId ? (
        <p className="mt-1">
          {t('quiz.youClicked')} {displayName(given.names, nameLang)}
          {sideSuffix(given, t)}
        </p>
      ) : null}
      {question.type === 'name' && answer.givenText ? (
        <p className="mt-1">
          {t('quiz.youAnswered')} <q>{answer.givenText}</q>
        </p>
      ) : null}
      {answer.verdict === 'typo' ? (
        <p className="mt-1">
          {t('quiz.correctSpelling')} <strong>{answer.expected}</strong>{' '}
          <span className="text-xs opacity-80">
            ({t('quiz.typoTolerance', { count: answer.distance ?? 0 })})
          </span>
        </p>
      ) : null}
      {!ok || question.type !== 'name' ? (
        <p className="mt-1">
          {t('quiz.answer')} <strong>{correctName}</strong>
          {question.type === 'name' && target.names.la && target.names.en !== target.names.la ? (
            <span className="opacity-80"> · {nameLang === 'en' ? target.names.la : target.names.en}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ summary

function QuizSummary() {
  const { t } = useTranslation();
  const questions = useQuizStore((s) => s.questions);
  const answers = useQuizStore((s) => s.answers);
  const poolIds = useQuizStore((s) => s.poolIds);
  const scope = useQuizStore((s) => s.scope);
  const structures = useAtlasStore((s) => s.structures);
  const nameLang = useAtlasStore((s) => s.nameLang);
  const manifest = useAtlasStore((s) => s.manifest);
  const score = scoreOf({ answers });
  const mistakes = mistakesOf({ answers, questions });

  const retry = () => {
    const pool = poolIds.map((id) => structures[id]).filter((s): s is Structure => Boolean(s));
    const qs = generateQuiz(pool, scope, {
      rng: Math.random,
      nameLang,
      targets: mistakes.map((q) => ({ id: q.targetId, type: q.type })),
    });
    if (!qs.length) return;
    enterQuizMode([...new Set(pool.filter((p) => qs.some((q) => q.targetId === p.id)).map((p) => p.system))]);
    useQuizStore.getState().start(qs, { poolIds });
  };

  const regionNames = scope.regions.map((r) => regionLabel(findRegion(manifest, r), r)).join(', ');

  return (
    <div className="flex flex-col gap-4 text-sm" data-testid="quiz-summary">
      <div className="rounded-xl bg-zinc-100 p-4 text-center dark:bg-zinc-800">
        <p className="text-3xl font-bold tabular-nums">
          {score}
          <span className="text-lg font-semibold text-zinc-500"> / {questions.length}</span>
        </p>
        <p className={mutedText}>{t('quiz.summaryScore', { score, total: questions.length })}</p>
        {regionNames ? (
          <p className={cx('mt-1 text-xs', mutedText)}>{t('quiz.regionScope', { region: regionNames })}</p>
        ) : null}
      </div>
      <section aria-labelledby="mistakes-title" className="flex flex-col gap-2">
        <SectionTitle id="mistakes-title">{t('quiz.mistakes')}</SectionTitle>
        {mistakes.length === 0 ? (
          <p className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <Icon name="check" className="size-4" />
            {t('quiz.noMistakes')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {mistakes.map((q) => {
              const st = structures[q.targetId];
              const a = answers[q.id]!;
              const given = a.givenId ? structures[a.givenId] : undefined;
              return (
                <li key={q.id} className="px-3 py-2" data-mistake={q.targetId}>
                  <p className="font-medium">
                    {st ? displayName(st.names, nameLang) + sideSuffix(st, t) : q.targetId}
                    <span className={cx('ml-2 text-xs font-normal', mutedText)}>{t(TYPE_LABEL[q.type])}</span>
                  </p>
                  <p className={cx('text-xs', mutedText)}>
                    {a.verdict === 'skipped'
                      ? t('quiz.skipped')
                      : `${q.type === 'locate' ? t('quiz.youClicked') : t('quiz.youAnswered')} ${
                          a.givenText ??
                          (given
                            ? displayName(given.names, nameLang) + sideSuffix(given, t)
                            : t('quiz.nothing'))
                        }`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <div className="flex flex-col gap-2">
        {mistakes.length ? (
          <Button variant="primary" onClick={retry} data-testid="quiz-retry">
            <Icon name="reset" className="size-4" />
            {t('quiz.retryMistakes')}
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => useQuizStore.getState().backToSetup()}>
          {t('quiz.newQuiz')}
        </Button>
      </div>
    </div>
  );
}
