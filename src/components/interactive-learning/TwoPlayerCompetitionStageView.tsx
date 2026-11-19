import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  ImageOff,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  InteractiveActivityRecord,
  InteractiveLearningQuestion,
} from '../../types/interactiveLearning';
import { AnimatedFullBodyAvatar } from '../live/AnimatedFullBodyAvatar';
import {
  hasActiveSelection,
  type SmartboardSelection,
} from './interactiveLearningLogic';
import {
  areBothPlayersAnswered,
  canRevealTwoPlayerRound,
  createInitialTwoPlayerSession,
  determineTwoPlayerWinner,
  ensureQuestionOptionOrderInMap,
  extractTwoPlayerCorrectAnswerText,
  getPlayerOrderedOptionsForSession,
  navigateTwoPlayerSession,
  POINTS_PER_CORRECT_ANSWER,
  revealTwoPlayerRound,
  selectPlayerChoiceInRound,
  toggleTwoPlayerPause,
  type TwoPlayerConfig,
  type TwoPlayerQuestionOutcome,
  type TwoPlayerRoundPhase,
  type TwoPlayerSessionState,
} from './twoPlayerCompetitionLogic';

export interface TwoPlayerCompetitionStageViewProps {
  activity: InteractiveActivityRecord;
  playerConfig: TwoPlayerConfig;
  initialSession?: TwoPlayerSessionState;
  onExitToActivities: () => void;
  onBackToSetup?: () => void;
}

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

const CONFETTI_PIECES = [
  { leftClass: 'left-[5%]', colorClass: 'bg-warning', sizeClass: 'h-3 w-2 rounded-sm', delayClass: '', alt: false },
  { leftClass: 'left-[12%]', colorClass: 'bg-sky-500', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-150', alt: true },
  { leftClass: 'left-[19%]', colorClass: 'bg-emerald-500', sizeClass: 'h-3 w-1.5 rounded-sm', delayClass: 'delay-300', alt: false },
  { leftClass: 'left-[26%]', colorClass: 'bg-danger', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-500', alt: true },
  { leftClass: 'left-[33%]', colorClass: 'bg-icon-soft', sizeClass: 'h-3 w-2 rounded-sm', delayClass: 'delay-200', alt: false },
  { leftClass: 'left-[41%]', colorClass: 'bg-[#E5B85C]', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-700', alt: true },
  { leftClass: 'left-[49%]', colorClass: 'bg-sky-500', sizeClass: 'h-3 w-2 rounded-sm', delayClass: 'delay-100', alt: false },
  { leftClass: 'left-[57%]', colorClass: 'bg-danger', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-300', alt: true },
  { leftClass: 'left-[64%]', colorClass: 'bg-emerald-500', sizeClass: 'h-3 w-1.5 rounded-sm', delayClass: 'delay-500', alt: false },
  { leftClass: 'left-[72%]', colorClass: 'bg-warning', sizeClass: 'h-3 w-2 rounded-sm', delayClass: 'delay-150', alt: true },
  { leftClass: 'left-[80%]', colorClass: 'bg-icon-soft', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-700', alt: false },
  { leftClass: 'left-[88%]', colorClass: 'bg-[#E5B85C]', sizeClass: 'h-3 w-2 rounded-sm', delayClass: 'delay-200', alt: true },
  { leftClass: 'left-[94%]', colorClass: 'bg-emerald-500', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-500', alt: false },
] as const;

export interface PlayerPanelFeedbackBarProps {
  playerNumber: 1 | 2;
  outcome: TwoPlayerQuestionOutcome;
  correctAnswerText: string | null;
}

export function PlayerPanelFeedbackBar({
  playerNumber,
  outcome,
  correctAnswerText,
}: PlayerPanelFeedbackBarProps) {
  const isCorrect = outcome === 'correct';
  const isWrong = outcome === 'wrong';

  const containerStyle = isCorrect
    ? 'border-emerald-300 bg-emerald-600 text-white shadow-emerald-950/20 dark:border-emerald-400 dark:bg-emerald-600'
    : isWrong
      ? 'border-red-300 bg-red-600 text-white shadow-red-950/20 dark:border-red-400 dark:bg-red-600'
      : 'border-amber-300 bg-amber-500 text-[#292929] shadow-amber-950/15 dark:border-amber-400 dark:bg-amber-500';

  const title = isCorrect
    ? 'إجابة صحيحة! أحسنت'
    : isWrong
      ? 'إجابة خاطئة، حاول مرة أخرى في السؤال القادم'
      : 'لم يتم تسجيل إجابة';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={`p${playerNumber}-feedback-bar`}
      data-outcome={outcome}
      className={`qc-feedback-slide-in rounded-2xl border-2 px-4 py-3 shadow-lg ${containerStyle}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isCorrect || isWrong ? 'bg-white/20 text-white' : 'bg-[#292929]/15 text-[#292929]'
          }`}
        >
          {isCorrect ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : isWrong ? (
            <XCircle className="h-6 w-6" />
          ) : (
            <Clock className="h-6 w-6" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-sm sm:text-base font-black leading-snug">
              {title}
            </p>
            {isCorrect && (
              <span className="tabular-nums shrink-0 rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-black text-white">
                +{POINTS_PER_CORRECT_ANSWER} نقطة
              </span>
            )}
          </div>

          {!isCorrect && correctAnswerText && (
            <p
              className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                isWrong ? 'bg-[#292929]/20 text-white' : 'bg-[#292929]/15 text-[#292929]'
              }`}
            >
              الإجابة الصحيحة: {correctAnswerText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface IndependentPlayerPanelProps {
  playerNumber: 1 | 2;
  playerName: string;
  avatarId: string;
  score: number;
  selection: SmartboardSelection;
  outcome: TwoPlayerQuestionOutcome | null;
  phase: TwoPlayerRoundPhase;
  question: InteractiveLearningQuestion;
  orderedOptions: InteractiveLearningQuestion['options'];
  correctAnswerText: string | null;
  failedImageUrl: string | null;
  onImageError: (url: string) => void;
  onSelectChoice: (choice: {
    selectedOptionId?: string | null;
    selectedBoolean?: boolean | null;
  }) => void;
}

function IndependentPlayerPanel({
  playerNumber,
  playerName,
  avatarId,
  score,
  selection,
  outcome,
  phase,
  question,
  orderedOptions,
  correctAnswerText,
  failedImageUrl,
  onImageError,
  onSelectChoice,
}: IndependentPlayerPanelProps) {
  const isP1 = playerNumber === 1;
  const isAnswering = phase === 'answering';
  const isRevealed = phase === 'revealed';
  const hasSelected = hasActiveSelection(selection);
  const hasQuestionImage =
    Boolean(question.imageUrl) && failedImageUrl !== question.imageUrl;

  const panelThemeClasses = isP1
    ? 'border-sky-300 bg-sky-50/85 dark:border-sky-700/80 dark:bg-sky-950/35'
    : 'border-emerald-300 bg-emerald-50/85 dark:border-emerald-700/80 dark:bg-emerald-950/35';

  const headerBorderClasses = isP1
    ? 'border-sky-200/90 dark:border-sky-800/70'
    : 'border-emerald-200/90 dark:border-emerald-800/70';

  const scoreBoxClasses = isP1
    ? 'border-sky-200 bg-white/90 text-sky-900 dark:border-sky-700/70 dark:bg-surface dark:text-sky-200'
    : 'border-emerald-200 bg-white/90 text-emerald-900 dark:border-emerald-700/70 dark:bg-surface dark:text-emerald-200';

  const identitySubtitle = isP1 ? 'القسم الأيمن' : 'القسم الأيسر';

  let statusLabel = 'في انتظار الاختيار';
  if (isRevealed) {
    statusLabel =
      outcome === 'correct'
        ? 'إجابة صحيحة'
        : outcome === 'wrong'
          ? 'إجابة خاطئة'
          : 'لم يتم تسجيل إجابة';
  } else if (phase === 'time_up') {
    statusLabel = hasSelected ? 'تم قفل الاختيار' : 'انتهى الوقت دون اختيار';
  } else if (hasSelected) {
    statusLabel = 'تم تسجيل الاختيار';
  }

  return (
    <section
      data-testid={`player-${playerNumber}-panel`}
      data-player-theme={isP1 ? 'blue' : 'green'}
      className={`flex flex-col justify-between gap-4 rounded-3xl border-2 p-4 sm:p-6 shadow-sm ${panelThemeClasses}`}
    >
      {/* Player Header: Avatar + Name + Status + Score */}
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-3.5 ${headerBorderClasses}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-14 w-13 shrink-0 items-center justify-center rounded-2xl border border-line bg-white/90 p-1 shadow-2xs dark:bg-surface">
            <AnimatedFullBodyAvatar
              avatarId={avatarId}
              size="sm"
              animated={isRevealed && outcome === 'correct'}
            />
          </div>
          <div className="min-w-0">
            <h3
              data-testid={`p${playerNumber}-display-name`}
              className="font-display truncate text-base sm:text-lg font-black text-ink"
            >
              {playerName}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-ink-muted">
              <span className={isP1 ? 'text-sky-700 dark:text-sky-300' : 'text-emerald-700 dark:text-emerald-300'}>
                {identitySubtitle}
              </span>
              <span aria-hidden="true">·</span>
              <span data-testid={`p${playerNumber}-status-text`}>{statusLabel}</span>
            </div>
          </div>
        </div>

        <div
          data-testid={`p${playerNumber}-score`}
          className={`tabular-nums rounded-2xl border px-4 py-2 font-display text-base sm:text-lg font-black shadow-2xs ${scoreBoxClasses}`}
        >
          {score} <span className="text-xs font-bold opacity-80">نقطة</span>
        </div>
      </div>

      {/* Animated Result Banner (ONLY shown after Teacher clicks Reveal) */}
      {isRevealed && outcome && (
        <PlayerPanelFeedbackBar
          playerNumber={playerNumber}
          outcome={outcome}
          correctAnswerText={correctAnswerText}
        />
      )}

      {/* Duplicated Full Question & Image INSIDE This Player's Panel */}
      <div className="space-y-4 flex-1 flex flex-col justify-center">
        <div className="rounded-2xl border border-line/80 bg-white/95 p-4 sm:p-5 shadow-2xs dark:bg-surface">
          <h2
            data-testid={`p${playerNumber}-question-prompt`}
            className="font-display text-lg sm:text-xl font-black leading-relaxed text-ink"
          >
            {question.prompt}
          </h2>

          {question.imageUrl && (
            <div className="mt-3 flex items-center justify-center rounded-xl border border-line bg-surface-subtle p-2">
              {hasQuestionImage ? (
                <img
                  src={question.imageUrl}
                  alt="صورة السؤال"
                  referrerPolicy="no-referrer"
                  onError={() => onImageError(question.imageUrl!)}
                  className="mx-auto max-h-40 w-auto rounded-lg object-contain"
                />
              ) : (
                <div className="flex items-center gap-2 py-4 text-xs font-bold text-ink-muted">
                  <ImageOff className="h-4 w-4" />
                  <span>تعذر عرض صورة السؤال</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* All Answer Options Inside This Player's Panel */}
        {question.type === 'multiple_choice' ? (
          <div className="grid grid-cols-1 gap-2.5">
            {orderedOptions.map((opt, idx) => {
              const isSelected = selection.selectedOptionId === opt.id;
              const highlightCorrect = isRevealed && opt.isCorrect;
              const highlightWrong = isRevealed && isSelected && !opt.isCorrect;

              // قبل الكشف: لا ألوان خضراء أو حمراء ولا علامات صح/خطأ
              let optionClasses =
                'border-line bg-white/95 text-ink hover:border-line-strong dark:bg-surface';
              let letterClasses = 'bg-surface-subtle text-ink-muted';

              if (highlightCorrect) {
                optionClasses =
                  'border-emerald-600 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-500/35 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-100';
                letterClasses = 'bg-emerald-600 text-white';
              } else if (highlightWrong) {
                optionClasses =
                  'border-red-600 bg-red-100 text-red-950 ring-2 ring-red-500/35 dark:border-red-400 dark:bg-red-950/60 dark:text-red-100';
                letterClasses = 'bg-red-600 text-white';
              } else if (isSelected) {
                optionClasses = isP1
                  ? 'border-sky-600 bg-sky-200/75 text-sky-950 ring-2 ring-sky-500/30 dark:border-sky-400 dark:bg-sky-900/60 dark:text-sky-50'
                  : 'border-teal-700 bg-teal-200/70 text-teal-950 ring-2 ring-teal-600/30 dark:border-teal-400 dark:bg-teal-900/60 dark:text-teal-50';
                letterClasses = isP1
                  ? 'bg-sky-700 text-white dark:bg-sky-500'
                  : 'bg-teal-800 text-white dark:bg-teal-500';
              }

              return (
                <button
                  key={`p${playerNumber}-opt-${opt.id}`}
                  type="button"
                  disabled={!isAnswering}
                  data-testid={`p${playerNumber}-option-${idx}`}
                  data-option-id={opt.id}
                  data-selected={isSelected ? 'true' : 'false'}
                  onClick={() => onSelectChoice({ selectedOptionId: opt.id })}
                  className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-start transition-all active:scale-[0.99] disabled:cursor-default ${optionClasses}`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-base font-black transition-colors ${letterClasses}`}
                  >
                    {OPTION_LETTERS[idx] ?? idx + 1}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    {opt.optionText && (
                      <span className="block font-display text-sm sm:text-base font-extrabold leading-snug">
                        {opt.optionText}
                      </span>
                    )}
                    {opt.imageUrl && (
                      <img
                        src={opt.imageUrl}
                        alt={`صورة الاختيار ${OPTION_LETTERS[idx] ?? idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="max-h-20 w-auto rounded-lg border border-line bg-surface object-contain"
                      />
                    )}
                  </div>

                  {!isRevealed && isSelected && (
                    <span className="shrink-0 text-xs font-extrabold opacity-80 whitespace-nowrap">
                      تم الاختيار
                    </span>
                  )}
                  {highlightCorrect && (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {highlightWrong && (
                    <XCircle className="h-6 w-6 shrink-0 text-red-600 dark:text-red-400" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { val: true, label: 'صح' },
              { val: false, label: 'خطأ' },
            ].map((tf) => {
              const isSelected = selection.selectedBoolean === tf.val;
              const isTrueAnswer = question.correctBoolean === tf.val;
              const highlightCorrect = isRevealed && isTrueAnswer;
              const highlightWrong = isRevealed && isSelected && !isTrueAnswer;

              let tfClasses =
                'border-line bg-white/95 text-ink hover:border-line-strong dark:bg-surface';

              if (highlightCorrect) {
                tfClasses =
                  'border-emerald-600 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-500/35 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-100';
              } else if (highlightWrong) {
                tfClasses =
                  'border-red-600 bg-red-100 text-red-950 ring-2 ring-red-500/35 dark:border-red-400 dark:bg-red-950/60 dark:text-red-100';
              } else if (isSelected) {
                tfClasses = isP1
                  ? 'border-sky-600 bg-sky-200/75 text-sky-950 ring-2 ring-sky-500/30 dark:border-sky-400 dark:bg-sky-900/60 dark:text-sky-50'
                  : 'border-teal-700 bg-teal-200/70 text-teal-950 ring-2 ring-teal-600/30 dark:border-teal-400 dark:bg-teal-900/60 dark:text-teal-50';
              }

              return (
                <button
                  key={`p${playerNumber}-tf-${String(tf.val)}`}
                  type="button"
                  disabled={!isAnswering}
                  data-testid={`p${playerNumber}-tf-${tf.val ? 'true' : 'false'}`}
                  data-selected={isSelected ? 'true' : 'false'}
                  onClick={() => onSelectChoice({ selectedBoolean: tf.val })}
                  className={`flex min-h-[96px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-4 font-display text-xl sm:text-2xl font-black transition-all active:scale-[0.99] disabled:cursor-default ${tfClasses}`}
                >
                  <div className="flex items-center gap-2">
                    {highlightCorrect && (
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    )}
                    {highlightWrong && (
                      <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    )}
                    <span>{tf.label}</span>
                  </div>
                  {!isRevealed && isSelected && (
                    <span className="text-[11px] font-bold opacity-80">تم الاختيار</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function TwoPlayerCompetitionStageView({
  activity,
  playerConfig,
  initialSession,
  onExitToActivities,
  onBackToSetup,
}: TwoPlayerCompetitionStageViewProps) {
  const [session, setSession] = useState<TwoPlayerSessionState>(() => {
    if (initialSession) {
      const currentQ = activity.questions[initialSession.currentIndex];
      return {
        ...initialSession,
        optionOrdersByQuestion: ensureQuestionOptionOrderInMap(
          initialSession.optionOrdersByQuestion,
          currentQ
        ),
      };
    }
    return createInitialTwoPlayerSession(
      playerConfig.roundDurationSeconds,
      activity.questions
    );
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenNote, setFullscreenNote] = useState<string | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [replayNonce, setReplayNonce] = useState(0);

  // Persistent reference to the single outer container to preserve Fullscreen API binding
  const stageRef = useRef<HTMLDivElement | null>(null);

  // References for fluid 60fps timer bar animation
  const totalDurationMs = playerConfig.roundDurationSeconds * 1000;
  const remainingMsRef = useRef<number>(session.timeLeft * 1000);
  const lastTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const questions = activity.questions;
  const totalQuestions = questions.length;
  const currentQuestion = questions[session.currentIndex] ?? null;

  // ضمان وجود ترتيب اختيارات ثابت ومستقل لكل طالب عند عرض السؤال دون إعادة خلطه
  useEffect(() => {
    if (!currentQuestion || currentQuestion.type !== 'multiple_choice') return;
    setSession((prev) => {
      const nextMap = ensureQuestionOptionOrderInMap(
        prev.optionOrdersByQuestion,
        currentQuestion
      );
      if (nextMap === prev.optionOrdersByQuestion) return prev;
      return { ...prev, optionOrdersByQuestion: nextMap };
    });
  }, [currentQuestion]);

  // Sync fullscreen state with browser events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (active) setFullscreenNote(null);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    if (typeof document !== 'undefined') {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Optional auto-fullscreen on launch if activity is configured with autoFullscreen
  useEffect(() => {
    if (!activity.autoFullscreen) return;
    if (typeof document === 'undefined' || document.fullscreenElement) return;
    const target = stageRef.current;
    if (!target || typeof target.requestFullscreen !== 'function') return;

    target.requestFullscreen().catch(() => {
      setFullscreenNote(
        'لم يتم تفعيل ملء الشاشة تلقائياً بسبب قيود المتصفح — يمكنك الضغط على زر ملء الشاشة يدوياً.'
      );
    });
  }, [activity.id, activity.autoFullscreen]);

  const timeLeftRef = useRef<number>(session.timeLeft);
  useEffect(() => {
    timeLeftRef.current = session.timeLeft;
  }, [session.timeLeft]);

  // Sync remainingMs on question index or duration changes
  useEffect(() => {
    remainingMsRef.current = session.timeLeft * 1000;
    lastTimeRef.current = null;
    if (progressBarRef.current) {
      const pct = Math.max(0, Math.min(100, (remainingMsRef.current / totalDurationMs) * 100));
      progressBarRef.current.style.width = `${pct}%`;
    }
  }, [session.currentIndex, session.roundDurationSeconds, totalDurationMs]);

  // Continuous fluid timer animation via requestAnimationFrame
  useEffect(() => {
    if (
      session.completed ||
      session.isPaused ||
      session.roundState.phase !== 'answering'
    ) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    if (typeof window === 'undefined') return;

    const loop = (timestamp: number) => {
      if (lastTimeRef.current !== null) {
        const delta = timestamp - lastTimeRef.current;
        remainingMsRef.current = Math.max(0, remainingMsRef.current - delta);
      }
      lastTimeRef.current = timestamp;

      const remMs = remainingMsRef.current;
      const pct = Math.max(0, Math.min(100, (remMs / totalDurationMs) * 100));

      // Direct element width update gives continuous, stutter-free movement without React re-render lag
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${pct}%`;
      }

      // Update whole-second counter only when the second integer changes
      const nextSec = Math.max(0, Math.ceil(remMs / 1000));
      if (nextSec !== timeLeftRef.current) {
        timeLeftRef.current = nextSec;
        setSession((prev) => (prev.timeLeft !== nextSec ? { ...prev, timeLeft: nextSec } : prev));
      }

      if (remMs <= 0) {
        lastTimeRef.current = null;
        if (progressBarRef.current) {
          progressBarRef.current.style.width = '0%';
        }
        setSession((prev) => {
          if (prev.roundState.phase !== 'answering') return prev;
          return {
            ...prev,
            timeLeft: 0,
            isPaused: false,
            roundState: {
              ...prev.roundState,
              phase: 'time_up',
            },
          };
        });
        return;
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      lastTimeRef.current = null;
    };
  }, [
    session.completed,
    session.isPaused,
    session.roundState.phase,
    session.currentIndex,
    totalDurationMs,
  ]);

  const handleToggleFullscreen = () => {
    setFullscreenNote(null);
    if (typeof document === 'undefined') return;

    if (!document.fullscreenElement) {
      const target = stageRef.current;
      if (!target || typeof target.requestFullscreen !== 'function') {
        setFullscreenNote('المتصفح الحالي لا يدعم وضع ملء الشاشة.');
        return;
      }
      target.requestFullscreen().catch(() => {
        setFullscreenNote('تعذر تفعيل وضع ملء الشاشة من المتصفح، وسيستمر العرض بشكل اعتيادي.');
      });
    } else if (typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleExit = () => {
    if (
      typeof document !== 'undefined' &&
      document.fullscreenElement &&
      typeof document.exitFullscreen === 'function'
    ) {
      document.exitFullscreen().catch(() => {});
    }
    onExitToActivities();
  };

  const handleReplay = () => {
    setFailedImageUrl(null);
    setReplayNonce((n) => n + 1);
    remainingMsRef.current = playerConfig.roundDurationSeconds * 1000;
    lastTimeRef.current = null;
    if (progressBarRef.current) {
      progressBarRef.current.style.width = '100%';
    }
    setSession(createInitialTwoPlayerSession(playerConfig.roundDurationSeconds, questions));
  };

  const handleTogglePause = () => {
    setSession((prev) => toggleTwoPlayerPause(prev));
  };

  const handleReveal = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    lastTimeRef.current = null;
    setSession((prev) => {
      if (!currentQuestion) return prev;
      return {
        ...prev,
        isPaused: false,
        roundState: revealTwoPlayerRound(prev.roundState, currentQuestion),
      };
    });
  }, [currentQuestion]);

  const handleNextQuestion = () => {
    setFailedImageUrl(null);
    remainingMsRef.current = playerConfig.roundDurationSeconds * 1000;
    lastTimeRef.current = null;
    if (progressBarRef.current) {
      progressBarRef.current.style.width = '100%';
    }
    setSession((prev) =>
      navigateTwoPlayerSession(prev, prev.currentIndex + 1, totalQuestions, questions)
    );
  };

  if (totalQuestions === 0) {
    return (
      <div className="qc-card rounded-3xl p-10 text-center">
        <Users className="mx-auto h-12 w-12 text-ink-muted" />
        <h2 className="font-display mt-3 text-xl font-extrabold text-ink">
          لا توجد أسئلة متاحة في هذا النشاط
        </h2>
        <button
          type="button"
          onClick={handleExit}
          className="qc-btn-primary mt-5 inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-extrabold"
        >
          العودة إلى الأنشطة
        </button>
      </div>
    );
  }

  const questionNumber = session.currentIndex + 1;
  const isLastQuestion = questionNumber === totalQuestions;
  const { roundState } = session;
  const isAnswering = roundState.phase === 'answering';
  const isTimeUp = roundState.phase === 'time_up';
  const isRevealed = roundState.phase === 'revealed';
  const bothAnswered = areBothPlayersAnswered(roundState);
  const canReveal = canRevealTwoPlayerRound(roundState);
  const p1OrderedOptions = currentQuestion
    ? getPlayerOrderedOptionsForSession(session, currentQuestion, 1)
    : [];
  const p2OrderedOptions = currentQuestion
    ? getPlayerOrderedOptionsForSession(session, currentQuestion, 2)
    : [];
  const p1CorrectAnswerText = currentQuestion
    ? extractTwoPlayerCorrectAnswerText(currentQuestion, p1OrderedOptions)
    : null;
  const p2CorrectAnswerText = currentQuestion
    ? extractTwoPlayerCorrectAnswerText(currentQuestion, p2OrderedOptions)
    : null;

  return (
    <div
      ref={stageRef}
      data-testid="two-player-stage"
      data-question-index={session.currentIndex}
      data-round-phase={roundState.phase}
      data-is-fullscreen={isFullscreen ? 'true' : 'false'}
      className={`flex flex-col justify-between gap-4 sm:gap-5 transition-colors ${
        isFullscreen
          ? 'min-h-screen overflow-y-auto bg-canvas p-4 sm:p-6'
          : 'qc-card rounded-3xl p-4 sm:p-6'
      }`}
    >
      {/* 1. Festive End-of-Competition & Winner Podium Screen (Keeps the SAME stageRef mounted to preserve Fullscreen) */}
      {session.completed ? (
        (() => {
          const winnerSummary = determineTwoPlayerWinner(
            roundState,
            playerConfig.p1Name,
            playerConfig.p2Name
          );
          const isTie = winnerSummary.result === 'tie';
          const p1Wins = winnerSummary.result === 'p1';

          const winnerName = p1Wins ? playerConfig.p1Name : playerConfig.p2Name;
          const winnerAvatarId = p1Wins ? playerConfig.p1AvatarId : playerConfig.p2AvatarId;
          const winnerScore = p1Wins ? roundState.p1Score : roundState.p2Score;
          const winnerCorrect = p1Wins ? roundState.p1CorrectCount : roundState.p2CorrectCount;
          const winnerWrong = p1Wins ? roundState.p1WrongCount : roundState.p2WrongCount;
          const winnerUnanswered = p1Wins
            ? roundState.p1UnansweredCount
            : roundState.p2UnansweredCount;

          const runnerUpName = p1Wins ? playerConfig.p2Name : playerConfig.p1Name;
          const runnerUpAvatarId = p1Wins ? playerConfig.p2AvatarId : playerConfig.p1AvatarId;
          const runnerUpScore = p1Wins ? roundState.p2Score : roundState.p1Score;
          const runnerUpCorrect = p1Wins ? roundState.p2CorrectCount : roundState.p1CorrectCount;
          const runnerUpWrong = p1Wins ? roundState.p2WrongCount : roundState.p1WrongCount;

          return (
            <div
              key={`celebration-${replayNonce}`}
              data-testid="two-player-completion"
              data-winner-result={winnerSummary.result}
              className="relative overflow-hidden flex flex-1 flex-col items-center justify-center p-6 sm:p-12 text-center"
            >
              {/* Top Bar for Fullscreen Control in Celebration View */}
              <div className="absolute top-0 inset-x-0 flex items-center justify-between p-2 z-30">
                <div />
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  data-testid="celebration-fullscreen-btn"
                  className="qc-btn-secondary inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-extrabold whitespace-nowrap"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="h-4 w-4 text-accent" />
                      <span>الخروج من ملء الشاشة</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4 text-accent" />
                      <span>ملء الشاشة</span>
                    </>
                  )}
                </button>
              </div>

              {/* Ambient Spotlight Glows */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-20 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-warning/20 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-sky-500/15 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl"
              />

              {/* Confetti Shower */}
              <div
                aria-hidden="true"
                data-testid="two-player-confetti"
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-80 overflow-hidden"
              >
                {CONFETTI_PIECES.map((piece, idx) => (
                  <span
                    key={idx}
                    className={`${piece.alt ? 'quizclass-confetti-alt' : 'quizclass-confetti'} ${piece.delayClass} absolute top-0 ${piece.leftClass} ${piece.sizeClass} ${piece.colorClass}`}
                  />
                ))}
              </div>

              <div className="relative z-20 mx-auto w-full max-w-4xl space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-warning-line bg-warning-soft px-4 py-1.5 text-xs font-black text-warning-ink shadow-2xs">
                  <Sparkles className="h-4 w-4 text-warning" />
                  <span>
                    {isTie
                      ? 'تعادل بطولي رائع بين المتنافسين!'
                      : `تتويج بطل منافسة «${activity.title}»!`}
                  </span>
                </div>

                {isTie ? (
                  /* TIE CELEBRATION: Both AnimatedFullBodyAvatars side-by-side */
                  <div data-testid="tie-celebration" className="space-y-6">
                    <div className="flex flex-wrap items-end justify-center gap-6 sm:gap-12 pt-2">
                      <div className="qc-enter-hop-in flex flex-col items-center">
                        <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-black text-sky-900 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200">
                          <Crown className="h-3.5 w-3.5 text-warning" />
                          <span>{playerConfig.p1Name}</span>
                        </div>
                        <AnimatedFullBodyAvatar
                          avatarId={playerConfig.p1AvatarId}
                          celebration="jump"
                          showCrown={true}
                          size="xl"
                          animated={true}
                        />
                      </div>

                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-warning-line bg-warning-soft font-display text-lg font-black text-warning-ink shadow-sm self-center">
                        تعادل
                      </div>

                      <div className="qc-enter-run-in flex flex-col items-center">
                        <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">
                          <Crown className="h-3.5 w-3.5 text-warning" />
                          <span>{playerConfig.p2Name}</span>
                        </div>
                        <AnimatedFullBodyAvatar
                          avatarId={playerConfig.p2AvatarId}
                          celebration="jump"
                          showCrown={true}
                          size="xl"
                          animated={true}
                        />
                      </div>
                    </div>

                    <h2 className="font-display text-2xl sm:text-4xl font-black text-ink">
                      انتهت المنافسة بالتعادل بـ {roundState.p1Score} نقطة لكل طالب!
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
                      <div className="rounded-3xl border-2 border-sky-300 bg-sky-50/80 p-5 dark:border-sky-700/80 dark:bg-sky-950/35">
                        <p className="font-display text-lg font-black text-ink">{playerConfig.p1Name}</p>
                        <p className="tabular-nums font-display text-3xl font-black text-sky-700 dark:text-sky-300 mt-1">
                          {roundState.p1Score} نقطة
                        </p>
                        <p className="tabular-nums mt-2 text-xs font-bold text-ink-muted">
                          {roundState.p1CorrectCount} صحيح · {roundState.p1WrongCount} خطأ · {roundState.p1UnansweredCount} لم يجب
                        </p>
                      </div>

                      <div className="rounded-3xl border-2 border-emerald-300 bg-emerald-50/80 p-5 dark:border-emerald-700/80 dark:bg-emerald-950/35">
                        <p className="font-display text-lg font-black text-ink">{playerConfig.p2Name}</p>
                        <p className="tabular-nums font-display text-3xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                          {roundState.p2Score} نقطة
                        </p>
                        <p className="tabular-nums mt-2 text-xs font-bold text-ink-muted">
                          {roundState.p2CorrectCount} صحيح · {roundState.p2WrongCount} خطأ · {roundState.p2UnansweredCount} لم يجب
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* WINNER CELEBRATION: Center Champion Showcase + Runner-up Card */
                  <div data-testid="winner-celebration" className="space-y-6">
                    <div className="qc-enter-hero-leap mx-auto flex max-w-md flex-col items-center rounded-3xl border-2 border-warning-line bg-surface-subtle/90 px-6 py-7 shadow-md">
                      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-warning-line bg-warning-soft px-3.5 py-1 text-xs font-black text-warning-ink">
                        <Crown className="h-4 w-4 text-warning" />
                        <span>المركز الأول · الفائز بالمنافسة</span>
                      </div>

                      <div className="my-2">
                        <AnimatedFullBodyAvatar
                          avatarId={winnerAvatarId}
                          celebration="victory"
                          showCrown={true}
                          size="xl"
                          animated={true}
                        />
                      </div>

                      <h2 className="font-display text-3xl sm:text-4xl font-black text-ink">
                        {winnerName}
                      </h2>
                      <p className="tabular-nums mt-1 font-display text-2xl sm:text-3xl font-black text-warning-ink">
                        {winnerScore} <span className="text-sm font-bold text-ink-muted">نقطة</span>
                      </p>
                      <p className="tabular-nums mt-2 text-xs font-bold text-ink-muted">
                        {winnerCorrect} صحيح · {winnerWrong} خطأ · {winnerUnanswered} لم يجب
                      </p>
                    </div>

                    {/* Runner-Up Card */}
                    <div className="mx-auto flex max-w-md items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-3.5 shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-14 w-13 shrink-0 items-center justify-center rounded-xl bg-surface-subtle">
                          <AnimatedFullBodyAvatar
                            avatarId={runnerUpAvatarId}
                            celebration="clap"
                            size="sm"
                            animated={true}
                          />
                        </div>
                        <div className="text-start min-w-0">
                          <span className="block text-[11px] font-bold text-ink-muted">المركز الثاني</span>
                          <p className="font-display truncate text-base font-black text-ink">
                            {runnerUpName}
                          </p>
                        </div>
                      </div>

                      <div className="text-end shrink-0">
                        <p className="tabular-nums font-display text-xl font-black text-accent">
                          {runnerUpScore} نقطة
                        </p>
                        <p className="tabular-nums text-[11px] font-bold text-ink-muted">
                          {runnerUpCorrect} صحيح · {runnerUpWrong} خطأ
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Celebration Action Buttons (Manual Exit without accidental fullscreen loss) */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleReplay}
                    data-testid="replay-two-player-btn"
                    className="qc-btn-primary inline-flex h-13 items-center gap-2 rounded-2xl px-7 text-sm sm:text-base font-black whitespace-nowrap shadow-sm"
                  >
                    <RotateCcw className="h-5 w-5" />
                    <span>إعادة المنافسة</span>
                  </button>

                  {onBackToSetup && (
                    <button
                      type="button"
                      onClick={onBackToSetup}
                      className="qc-btn-secondary inline-flex h-13 items-center gap-2 rounded-2xl px-6 text-sm font-extrabold whitespace-nowrap"
                    >
                      <Users className="h-4 w-4" />
                      <span>تغيير الطالبين</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleExit}
                    data-testid="exit-two-player-btn"
                    className="qc-btn-secondary inline-flex h-13 items-center gap-2 rounded-2xl px-7 text-sm sm:text-base font-extrabold whitespace-nowrap"
                  >
                    <ArrowRight className="h-5 w-5" />
                    <span>إنهاء والعودة إلى الأنشطة</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        /* 2. Active Competition Arena View */
        <>
          {/* Top Compact Bar: Activity Title + Question Count + Shared Timer + Fullscreen */}
          <header className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={handleExit}
                  className="qc-btn-secondary inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0"
                >
                  <ArrowRight className="h-4 w-4" />
                  <span>الأنشطة</span>
                </button>

                <div className="min-w-0">
                  <p className="font-display truncate text-sm sm:text-base font-black text-ink">
                    {activity.title}
                  </p>
                  <p className="tabular-nums text-xs font-bold text-ink-muted">
                    السؤال {questionNumber} من {totalQuestions}
                  </p>
                </div>
              </div>

              {/* Shared Countdown Timer Display */}
              <div
                data-testid="two-player-timer"
                className={`inline-flex items-center gap-2.5 rounded-2xl border-2 px-5 py-2 font-display text-sm sm:text-base font-black tabular-nums transition-colors ${
                  isRevealed
                    ? 'border-success-line bg-success-soft text-success-ink'
                    : isTimeUp
                      ? 'border-warning-line bg-warning-soft text-warning-ink'
                      : bothAnswered
                        ? 'border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100'
                        : session.isPaused
                          ? 'border-line bg-surface-subtle text-ink-muted'
                          : session.timeLeft <= 5
                            ? 'border-danger bg-danger-soft text-danger-ink'
                            : 'border-selected-line bg-selected text-accent'
                }`}
              >
                <Clock className="h-5 w-5 shrink-0" />
                <span>
                  {isRevealed
                    ? 'تم كشف النتيجة'
                    : isTimeUp
                      ? 'انتهى الوقت — اضغط إظهار النتيجة'
                      : session.isPaused
                        ? `متوقف مؤقتاً (${session.timeLeft} ث)`
                        : bothAnswered
                          ? `${session.timeLeft} ثانية (اكتملت الإجابات)`
                          : `${session.timeLeft} ثانية`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  data-testid="two-player-fullscreen-btn"
                  className="qc-btn-secondary inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="h-4 w-4 text-accent" />
                      <span>إغلاق ملء الشاشة</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4 text-accent" />
                      <span>ملء الشاشة</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Continuous Smooth Timer Progress Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
              <div
                ref={progressBarRef}
                className={`h-full rounded-full ${
                  isRevealed
                    ? 'bg-success transition-all duration-300'
                    : session.timeLeft <= 5
                      ? 'bg-danger'
                      : 'bg-primary'
                }`}
                style={{
                  width: isRevealed
                    ? '100%'
                    : `${Math.max(0, Math.min(100, (session.timeLeft / playerConfig.roundDurationSeconds) * 100))}%`,
                }}
              />
            </div>

            {fullscreenNote && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-warning-line bg-warning-soft px-4 py-2 text-xs font-bold text-warning-ink">
                <span>{fullscreenNote}</span>
                <button
                  type="button"
                  onClick={() => setFullscreenNote(null)}
                  className="underline whitespace-nowrap shrink-0"
                >
                  إخفاء
                </button>
              </div>
            )}
          </header>

          {/* Main Split-Screen Arena: Duplicated Questions & Options in BOTH Panels */}
          {currentQuestion && (
            <main
              key={currentQuestion.id}
              className="qc-smartboard-question-enter grid flex-1 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 items-stretch"
            >
              {/* Right Half in RTL: Player 1 (Blue Identity) */}
              <IndependentPlayerPanel
                playerNumber={1}
                playerName={playerConfig.p1Name}
                avatarId={playerConfig.p1AvatarId}
                score={roundState.p1Score}
                selection={roundState.p1Selection}
                outcome={roundState.p1Outcome}
                phase={roundState.phase}
                question={currentQuestion}
                orderedOptions={p1OrderedOptions}
                correctAnswerText={p1CorrectAnswerText}
                failedImageUrl={failedImageUrl}
                onImageError={(url) => setFailedImageUrl(url)}
                onSelectChoice={(choice) =>
                  setSession((prev) => ({
                    ...prev,
                    roundState: selectPlayerChoiceInRound(prev.roundState, 1, choice),
                  }))
                }
              />

              {/* Left Half in RTL: Player 2 (Green Identity) */}
              <IndependentPlayerPanel
                playerNumber={2}
                playerName={playerConfig.p2Name}
                avatarId={playerConfig.p2AvatarId}
                score={roundState.p2Score}
                selection={roundState.p2Selection}
                outcome={roundState.p2Outcome}
                phase={roundState.phase}
                question={currentQuestion}
                orderedOptions={p2OrderedOptions}
                correctAnswerText={p2CorrectAnswerText}
                failedImageUrl={failedImageUrl}
                onImageError={(url) => setFailedImageUrl(url)}
                onSelectChoice={(choice) =>
                  setSession((prev) => ({
                    ...prev,
                    roundState: selectPlayerChoiceInRound(prev.roundState, 2, choice),
                  }))
                }
              />
            </main>
          )}

          {/* Bottom Teacher Controls Dock */}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Early Finish vs Time-Up Reveal vs Disabled Waiting Button */}
              {isAnswering && bothAnswered ? (
                /* Both students answered early -> Prominent teacher button to finish question immediately */
                <button
                  type="button"
                  data-testid="two-player-finish-early-btn"
                  onClick={handleReveal}
                  className="qc-btn-primary inline-flex h-13 items-center gap-2 rounded-2xl px-6 text-sm sm:text-base font-black shadow-md whitespace-nowrap animate-pulse"
                >
                  <ShieldCheck className="h-5 w-5" />
                  <span>إنهاء السؤال وكشف الإجابة</span>
                </button>
              ) : isTimeUp ? (
                /* Time is up -> Teacher button to reveal results and verify */
                <button
                  type="button"
                  data-testid="two-player-reveal-btn"
                  onClick={handleReveal}
                  className="qc-btn-primary inline-flex h-13 items-center gap-2 rounded-2xl px-6 text-sm sm:text-base font-black shadow-md whitespace-nowrap"
                >
                  <ShieldCheck className="h-5 w-5" />
                  <span>إظهار النتيجة والتحقق</span>
                </button>
              ) : (
                /* Still answering and not both answered -> disabled button with clear intent */
                <button
                  type="button"
                  disabled={true}
                  data-testid="two-player-reveal-btn"
                  className="qc-btn-primary inline-flex h-13 items-center gap-2 rounded-2xl px-6 text-sm sm:text-base font-black disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
                >
                  <ShieldCheck className="h-5 w-5" />
                  <span>
                    {hasActiveSelection(roundState.p1Selection) || hasActiveSelection(roundState.p2Selection)
                      ? 'أجاب طالب واحد (بانتظار الآخر أو انتهاء الوقت)'
                      : 'بانتظار إجابة الطالبين أو انتهاء الوقت'}
                  </span>
                </button>
              )}

              {/* Pause / Resume Button while Answering */}
              {isAnswering && (
                <button
                  type="button"
                  data-testid="two-player-pause-btn"
                  onClick={handleTogglePause}
                  className="qc-btn-secondary inline-flex h-13 items-center gap-2 rounded-2xl px-5 text-sm font-extrabold whitespace-nowrap shrink-0"
                >
                  {session.isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                  <span>{session.isPaused ? 'استئناف المؤقت' : 'إيقاف مؤقت'}</span>
                </button>
              )}
            </div>

            {/* Next Question Button appears ONLY after result is revealed */}
            {isRevealed && (
              <button
                type="button"
                data-testid="two-player-next-btn"
                onClick={handleNextQuestion}
                className="inline-flex h-13 items-center gap-2 rounded-2xl bg-ink px-7 text-sm sm:text-base font-black text-surface transition-opacity hover:opacity-90 whitespace-nowrap shrink-0 dark:bg-primary dark:text-white"
              >
                <span>{isLastQuestion ? 'عرض النتائج والتتويج' : 'السؤال التالي'}</span>
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
          </footer>
        </>
      )}
    </div>
  );
}
