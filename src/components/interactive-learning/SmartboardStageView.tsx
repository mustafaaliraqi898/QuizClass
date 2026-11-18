import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  HelpCircle,
  ImageOff,
  Maximize2,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { InteractiveActivityRecord } from '../../types/interactiveLearning';
import {
  createInitialSmartboardState,
  extractRealQuestionExplanation,
  extractSmartboardCorrectAnswerText,
  hasActiveSelection,
  navigateSmartboardQuestion,
  retrySmartboardQuestion,
  revealSmartboardCorrectAnswer,
  selectSmartboardChoice,
  verifySmartboardAnswer,
  type SmartboardQuestionState,
} from './interactiveLearningLogic';

interface SmartboardStageViewProps {
  activity: InteractiveActivityRecord;
  onExitToActivities: () => void;
}

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

export function SmartboardStageView({
  activity,
  onExitToActivities,
}: SmartboardStageViewProps) {
  const [stageState, setStageState] = useState<SmartboardQuestionState>(() =>
    createInitialSmartboardState()
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenNote, setFullscreenNote] = useState<string | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const questions = activity.questions;
  const totalQuestions = questions.length;
  const currentQuestion = questions[stageState.currentIndex] ?? null;

  // Reset stage state if teacher opens a different activity
  useEffect(() => {
    setStageState(createInitialSmartboardState());
    setFailedImageUrl(null);
  }, [activity.id]);

  // Keep local fullscreen state synced with browser fullscreen events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (active) {
        setFullscreenNote(null);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Attempt optional auto-fullscreen when launching an activity configured with autoFullscreen
  useEffect(() => {
    if (!activity.autoFullscreen) return;
    if (typeof document === 'undefined' || document.fullscreenElement) return;

    const target = stageRef.current;
    if (!target || typeof target.requestFullscreen !== 'function') {
      return;
    }

    target.requestFullscreen().catch(() => {
      // Browser blocked auto-fullscreen; continue activity normally and show unobtrusive hint
      setFullscreenNote(
        'لم يتم تفعيل ملء الشاشة تلقائياً بسبب قيود المتصفح — يمكنك الضغط على زر ملء الشاشة يدوياً.'
      );
    });
  }, [activity.id, activity.autoFullscreen]);

  const handleToggleFullscreen = () => {
    setFullscreenNote(null);
    if (typeof document === 'undefined') return;

    if (!document.fullscreenElement) {
      const target = stageRef.current;
      if (!target || typeof target.requestFullscreen !== 'function') {
        setFullscreenNote('المتصفح الحالي لا يدعم وضع ملء الشاشة لهذا العرض.');
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
    if (typeof document !== 'undefined' && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(() => {});
    }
    onExitToActivities();
  };

  if (totalQuestions === 0) {
    return (
      <div className="qc-card rounded-3xl p-10 text-center">
        <HelpCircle className="mx-auto h-12 w-12 text-ink-muted" />
        <h2 className="font-display mt-3 text-xl font-extrabold text-ink">
          لا توجد أسئلة متاحة في هذا النشاط
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          أضف أسئلة من بنك الأسئلة لتتمكن من عرضها على السبورة التفاعلية.
        </p>
        <button
          type="button"
          onClick={handleExit}
          className="qc-btn-primary mt-5 inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-extrabold"
        >
          العودة إلى قائمة الأنشطة
        </button>
      </div>
    );
  }

  // Final Question Completion View (Non-competitive educational wrap-up)
  if (stageState.completedSession || !currentQuestion) {
    return (
      <div
        ref={stageRef}
        data-testid="smartboard-completion"
        className={`flex flex-col items-center justify-center p-8 sm:p-14 text-center ${
          isFullscreen ? 'min-h-screen bg-canvas' : 'qc-card rounded-3xl'
        }`}
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-success-soft text-success">
          <CheckCircle2 className="h-11 w-11" />
        </div>

        <h2 className="font-display mt-5 text-2xl sm:text-3xl font-black text-ink">
          اكتمل استعراض جميع أسئلة النشاط
        </h2>
        <p className="mt-2 max-w-xl text-sm sm:text-base font-medium text-ink-muted">
          أتمّ الصف استعراض ومناقشة {totalQuestions} أسئلة ضمن نشاط «{activity.title}».
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() =>
              setStageState(navigateSmartboardQuestion(stageState, totalQuestions - 1, totalQuestions))
            }
            className="qc-btn-secondary inline-flex h-13 items-center gap-2 rounded-2xl px-6 text-sm font-extrabold whitespace-nowrap"
          >
            <ArrowRight className="h-5 w-5" />
            <span>العودة إلى آخر سؤال</span>
          </button>

          <button
            type="button"
            onClick={() => setStageState(createInitialSmartboardState())}
            className="inline-flex h-13 items-center gap-2 rounded-2xl border border-selected-line bg-selected px-6 text-sm font-extrabold text-accent transition-opacity hover:opacity-85 whitespace-nowrap"
          >
            <RotateCcw className="h-5 w-5" />
            <span>إعادة النشاط من البداية</span>
          </button>

          <button
            type="button"
            onClick={handleExit}
            className="qc-btn-primary inline-flex h-13 items-center gap-2 rounded-2xl px-7 text-sm font-extrabold whitespace-nowrap"
          >
            <span>إنهاء النشاط</span>
          </button>
        </div>
      </div>
    );
  }

  const questionNumber = stageState.currentIndex + 1;
  const isLastQuestion = questionNumber === totalQuestions;
  const canCheck =
    hasActiveSelection(stageState.selection) &&
    (stageState.status === 'selected' || stageState.status === 'idle');
  const isRevealed = stageState.status === 'revealed';
  const isCheckedCorrect = stageState.status === 'checked_correct';
  const isCheckedWrong = stageState.status === 'checked_wrong';
  const isLockedAfterResult = isCheckedCorrect || isCheckedWrong || isRevealed;

  const actualCorrectText = extractSmartboardCorrectAnswerText(currentQuestion);
  const realExplanation = extractRealQuestionExplanation(currentQuestion);
  const progressPercent = Math.round((questionNumber / totalQuestions) * 100);
  const hasQuestionImage =
    Boolean(currentQuestion.imageUrl) && failedImageUrl !== currentQuestion.imageUrl;

  const metaLine = [currentQuestion.subject, currentQuestion.grade, currentQuestion.topic]
    .filter((item): item is string => Boolean(item))
    .join(' · ');

  return (
    <div
      ref={stageRef}
      data-testid="smartboard-stage"
      data-question-index={stageState.currentIndex}
      data-answer-status={stageState.status}
      className={`flex flex-col justify-between gap-5 transition-colors ${
        isFullscreen ? 'qc-tv-stage qc-tv-smartboard' : ''} ${
        isFullscreen
          ? 'min-h-screen overflow-y-auto bg-canvas p-5 sm:p-8'
          : 'qc-card rounded-3xl p-5 sm:p-8'
      }`}
    >
      {/* Top Smartboard Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExit}
              className="qc-btn-secondary inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-extrabold whitespace-nowrap shrink-0"
            >
              <ArrowRight className="h-4 w-4" />
              <span>الرجوع إلى الأنشطة</span>
            </button>

            <div className="min-w-0">
              <p className="font-display truncate text-sm sm:text-base font-extrabold text-ink">
                {activity.title}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink-muted">
                <span className="tabular-nums text-accent">
                  السؤال {questionNumber} من {totalQuestions}
                </span>
                {metaLine && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{metaLine}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleFullscreen}
              data-testid="smartboard-fullscreen-btn"
              className="qc-btn-secondary inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-extrabold whitespace-nowrap shrink-0"
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

            <button
              type="button"
              onClick={handleExit}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-danger-line bg-danger-soft px-4 text-sm font-extrabold text-danger-ink transition-opacity hover:opacity-85 whitespace-nowrap shrink-0"
            >
              <span>إنهاء النشاط</span>
            </button>
          </div>
        </div>

        {/* Clean Progress Line */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
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

      {/* Main Question + Options Canvas */}
      <main
        key={currentQuestion.id}
        className="qc-smartboard-question-enter flex flex-1 flex-col justify-center space-y-6 py-2"
      >
        {/* Question Prompt & Optional Image */}
        <div
          className={`grid grid-cols-1 gap-6 ${
            currentQuestion.imageUrl ? 'lg:grid-cols-12 lg:items-center' : ''
          }`}
        >
          <div
            className={`rounded-3xl border border-line bg-surface-subtle p-6 sm:p-8 ${
              currentQuestion.imageUrl ? 'lg:col-span-7' : 'text-center'
            }`}
          >
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black leading-relaxed text-ink">
              {currentQuestion.prompt}
            </h1>
          </div>

          {currentQuestion.imageUrl && (
            <div className="flex items-center justify-center rounded-3xl border border-line bg-surface p-4 lg:col-span-5">
              {hasQuestionImage ? (
                <img
                  src={currentQuestion.imageUrl}
                  alt="صورة السؤال التوضيحية"
                  referrerPolicy="no-referrer"
                  onError={() => setFailedImageUrl(currentQuestion.imageUrl)}
                  className="mx-auto max-h-[34vh] w-auto rounded-2xl object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink-muted">
                  <ImageOff className="h-9 w-9" />
                  <span className="text-xs font-bold">تعذر عرض الصورة المحلية</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Educational Feedback Callout (Checked / Revealed) */}
        {(isCheckedCorrect || isCheckedWrong || isRevealed) && (
          <div
            role="status"
            aria-live="polite"
            data-testid="smartboard-feedback"
            className={`rounded-2xl border-2 px-6 py-4 ${
              isCheckedCorrect
                ? 'qc-smartboard-success-pop border-success bg-success-soft text-success-ink'
                : isCheckedWrong
                  ? 'qc-smartboard-wrong-shake border-danger bg-danger-soft text-danger-ink'
                  : 'qc-smartboard-success-pop border-success bg-success-soft text-success-ink'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {isCheckedWrong ? (
                  <XCircle className="h-8 w-8 shrink-0 text-danger" />
                ) : (
                  <CheckCircle2 className="h-8 w-8 shrink-0 text-success" />
                )}
                <div>
                  <p className="font-display text-lg sm:text-2xl font-black">
                    {isCheckedCorrect
                      ? 'إجابة صحيحة!'
                      : isCheckedWrong
                        ? 'إجابة خاطئة!'
                        : `الإجابة الصحيحة: ${actualCorrectText ?? ''}`}
                  </p>
                  {isCheckedWrong && (
                    <p className="text-xs sm:text-sm font-bold opacity-85">
                      يمكن للطلاب إعادة المحاولة أو الضغط على «كشف الإجابة الصحيحة» للمناقشة.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Real explanation shown ONLY when actually stored on the question */}
            {isRevealed && realExplanation && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{realExplanation}</span>
              </div>
            )}
          </div>
        )}

        {/* Large Touch-Friendly Options */}
        {currentQuestion.type === 'multiple_choice' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 sm:gap-5">
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = stageState.selection.selectedOptionId === opt.id;
              const highlightCorrect =
                (isCheckedCorrect && isSelected) || (isRevealed && opt.isCorrect);
              const highlightWrong = isCheckedWrong && isSelected;

              let cardClasses =
                'border-line bg-surface text-ink hover:border-selected-line hover:bg-selected/50';
              let letterClasses =
                'bg-surface-subtle text-ink-muted';

              if (highlightCorrect) {
                cardClasses =
                  'border-success bg-success-soft text-success-ink ring-4 ring-success/20';
                letterClasses = 'bg-success text-white';
              } else if (highlightWrong) {
                cardClasses =
                  'border-danger bg-danger-soft text-danger-ink ring-4 ring-danger/20';
                letterClasses = 'bg-danger text-white';
              } else if (isSelected) {
                cardClasses =
                  'border-primary bg-selected text-ink ring-4 ring-primary/20';
                letterClasses = 'bg-primary text-white';
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isLockedAfterResult}
                  data-testid={`smartboard-option-${idx}`}
                  data-selected={isSelected ? 'true' : 'false'}
                  onClick={() =>
                    setStageState((prev) =>
                      selectSmartboardChoice(prev, { selectedOptionId: opt.id })
                    )
                  }
                  className={`flex min-h-[96px] sm:min-h-[118px] w-full items-center gap-4 rounded-2xl border-2 p-5 text-start transition-all active:scale-[0.99] disabled:cursor-default ${cardClasses}`}
                >
                  <span
                    className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl font-display text-xl sm:text-2xl font-black transition-colors ${letterClasses}`}
                  >
                    {OPTION_LETTERS[idx] ?? idx + 1}
                  </span>

                  <div className="min-w-0 flex-1 space-y-2">
                    {opt.optionText && (
                      <span className="block font-display text-lg sm:text-2xl font-extrabold leading-snug">
                        {opt.optionText}
                      </span>
                    )}
                    {opt.imageUrl && (
                      <img
                        src={opt.imageUrl}
                        alt={`صورة الاختيار ${OPTION_LETTERS[idx] ?? idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="max-h-32 w-auto rounded-xl border border-line bg-surface object-contain"
                      />
                    )}
                  </div>

                  {highlightCorrect && (
                    <CheckCircle2 className="h-8 w-8 shrink-0 text-success" />
                  )}
                  {highlightWrong && (
                    <XCircle className="h-8 w-8 shrink-0 text-danger" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {[
              { value: true, label: 'صح' },
              { value: false, label: 'خطأ' },
            ].map((tf) => {
              const isSelected = stageState.selection.selectedBoolean === tf.value;
              const isTrueAnswer = currentQuestion.correctBoolean === tf.value;
              const highlightCorrect =
                (isCheckedCorrect && isSelected) || (isRevealed && isTrueAnswer);
              const highlightWrong = isCheckedWrong && isSelected;

              let cardClasses = tf.value
                ? 'border-line bg-surface text-ink hover:border-success hover:bg-success-soft/60'
                : 'border-line bg-surface text-ink hover:border-danger hover:bg-danger-soft/60';

              if (highlightCorrect) {
                cardClasses =
                  'border-success bg-success-soft text-success-ink ring-4 ring-success/20';
              } else if (highlightWrong) {
                cardClasses =
                  'border-danger bg-danger-soft text-danger-ink ring-4 ring-danger/20';
              } else if (isSelected) {
                cardClasses =
                  'border-primary bg-selected text-ink ring-4 ring-primary/20';
              }

              return (
                <button
                  key={String(tf.value)}
                  type="button"
                  disabled={isLockedAfterResult}
                  data-testid={`smartboard-tf-${tf.value ? 'true' : 'false'}`}
                  data-selected={isSelected ? 'true' : 'false'}
                  onClick={() =>
                    setStageState((prev) =>
                      selectSmartboardChoice(prev, { selectedBoolean: tf.value })
                    )
                  }
                  className={`flex min-h-[124px] sm:min-h-[156px] w-full items-center justify-center gap-4 rounded-3xl border-2 p-6 font-display text-2xl sm:text-4xl font-black transition-all active:scale-[0.99] disabled:cursor-default ${cardClasses}`}
                >
                  {tf.value ? (
                    <CheckCircle2
                      className={`h-9 w-9 sm:h-11 sm:w-11 shrink-0 ${
                        highlightWrong ? 'text-danger' : 'text-success'
                      }`}
                    />
                  ) : (
                    <XCircle
                      className={`h-9 w-9 sm:h-11 sm:w-11 shrink-0 ${
                        highlightCorrect ? 'text-success' : 'text-danger'
                      }`}
                    />
                  )}
                  <span>{tf.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Teacher Action & Navigation Dock */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {/* Evaluation & Retry Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canCheck}
            data-testid="smartboard-check-btn"
            onClick={() =>
              setStageState((prev) => verifySmartboardAnswer(prev, currentQuestion))
            }
            className="qc-btn-primary inline-flex h-13 items-center gap-2 rounded-2xl px-6 text-sm sm:text-base font-extrabold disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="h-5 w-5" />
            <span>تحقق من الإجابة</span>
          </button>

          <button
            type="button"
            disabled={isRevealed}
            data-testid="smartboard-reveal-btn"
            onClick={() => setStageState((prev) => revealSmartboardCorrectAnswer(prev))}
            className="inline-flex h-13 items-center gap-2 rounded-2xl border border-success-line bg-success-soft px-5 text-sm sm:text-base font-extrabold text-success-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <Eye className="h-5 w-5" />
            <span>كشف الإجابة الصحيحة</span>
          </button>

          <button
            type="button"
            disabled={!hasActiveSelection(stageState.selection) && stageState.status === 'idle'}
            data-testid="smartboard-retry-btn"
            onClick={() => setStageState((prev) => retrySmartboardQuestion(prev))}
            className="qc-btn-secondary inline-flex h-13 items-center gap-2 rounded-2xl px-5 text-sm sm:text-base font-extrabold disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-5 w-5" />
            <span>إعادة المحاولة</span>
          </button>
        </div>

        {/* Navigation Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={stageState.currentIndex === 0}
            data-testid="smartboard-prev-btn"
            onClick={() => {
              setFailedImageUrl(null);
              setStageState((prev) =>
                navigateSmartboardQuestion(prev, prev.currentIndex - 1, totalQuestions)
              );
            }}
            className="qc-btn-secondary inline-flex h-13 items-center gap-2 rounded-2xl px-5 text-sm sm:text-base font-extrabold disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <ArrowRight className="h-5 w-5" />
            <span>السؤال السابق</span>
          </button>

          <button
            type="button"
            data-testid="smartboard-next-btn"
            onClick={() => {
              setFailedImageUrl(null);
              setStageState((prev) =>
                navigateSmartboardQuestion(prev, prev.currentIndex + 1, totalQuestions)
              );
            }}
            className="inline-flex h-13 items-center gap-2 rounded-2xl bg-ink px-6 text-sm sm:text-base font-extrabold text-surface transition-opacity hover:opacity-90 whitespace-nowrap shrink-0 dark:bg-primary dark:text-white dark:hover:bg-primary-hover"
          >
            <span>{isLastQuestion ? 'إنهاء الأسئلة' : 'السؤال التالي'}</span>
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
