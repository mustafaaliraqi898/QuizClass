import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Radio,
  StopCircle,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getStudentAvatar } from '../../data/studentAvatars';
import { useServerSyncedCountdown } from '../../hooks/useServerSyncedCountdown';
import type { TeacherLiveSessionDetails } from '../../types/liveSession';

interface LiveBoardViewProps {
  session: TeacherLiveSessionDetails;
  socketConnected: boolean;
  isMutating: boolean;
  onNextQuestion: () => Promise<void>;
  onCompleteSession: () => Promise<void>;
}

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const OPTION_ACCENTS = [
  'border-selected-line bg-selected',
  'border-success-line bg-success-soft',
  'border-warning-line bg-warning-soft',
  'border-danger-line bg-danger-soft',
];

export function LiveBoardView({
  session,
  socketConnected,
  isMutating,
  onNextQuestion,
  onCompleteSession,
}: LiveBoardViewProps) {
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (session.settings.fullScreenMode && !document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, [session.settings.fullScreenMode]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const { remainingSeconds, progressPercent } = useServerSyncedCountdown(
    session.phaseStartedAt,
    session.phaseEndsAt,
    session.phaseDurationMs,
    session.remainingMs
  );

  const currentQuestion = session.currentQuestion;
  const results = session.questionResults;
  const questionNumber = Math.max(1, session.currentQuestionIndex + 1);
  const isLastQuestion = questionNumber >= session.questionCount;

  const phaseMeta = (() => {
    switch (session.currentPhase) {
      case 'question_intro':
        return {
          label: 'عرض السؤال قبل الاختيارات',
          badgeClass: 'border-warning-line bg-warning-soft text-warning-ink',
        };
      case 'answering':
        return {
          label: 'استقبال الإجابات جارٍ الآن',
          badgeClass: 'border-success-line bg-success-soft text-success-ink',
        };
      case 'question_results':
        return {
          label: 'كشف الإجابة ونتائج السؤال',
          badgeClass: 'border-selected-line bg-selected text-accent',
        };
      default:
        return {
          label: 'المسابقة المباشرة',
          badgeClass: 'border-line bg-surface-subtle text-ink',
        };
    }
  })();

  return (
    <div
      ref={containerRef}
      className={`space-y-5 ${
        isFullscreen
          ? 'min-h-screen overflow-y-auto bg-canvas p-4 sm:p-8'
          : 'rounded-3xl bg-surface-subtle p-2 sm:p-4'
      }`}
    >
      {/* شريط الحالة والتحكم العلوي */}
      <section className="qc-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-extrabold ${phaseMeta.badgeClass}`}
              >
                <Radio className="h-3.5 w-3.5" />
                <span>{phaseMeta.label}</span>
              </span>

              <span className="tabular-nums rounded-lg border border-line bg-surface-subtle px-2.5 py-1 text-xs font-extrabold text-ink">
                السؤال {questionNumber} من {session.questionCount}
              </span>

              <span className="tabular-nums rounded-lg border border-line bg-surface-subtle px-2.5 py-1 text-xs font-bold text-ink-muted">
                رمز PIN: {session.pinCode}
              </span>

              <span
                className={`inline-flex items-center gap-1 text-xs font-bold ${
                  socketConnected ? 'text-success-ink' : 'text-warning-ink'
                }`}
              >
                {socketConnected ? (
                  <>
                    <Wifi className="h-3.5 w-3.5" />
                    <span>متصل لحظياً</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5" />
                    <span>جارٍ إعادة الاتصال...</span>
                  </>
                )}
              </span>
            </div>

            <h2 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
              {session.quizTitle}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-subtle px-3.5 py-2 text-xs font-bold">
              <Users className="h-4 w-4 text-accent" />
              <span className="text-ink-muted">المشاركون:</span>
              <span className="tabular-nums font-extrabold text-ink">
                {session.connectedParticipantCount}/{session.participantCount}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-success-line bg-success-soft px-3.5 py-2 text-xs font-bold">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-success-ink">الإجابات:</span>
              <span className="tabular-nums font-extrabold text-success-ink">
                {session.answeredCount}/{session.participantCount}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
              className="qc-btn-secondary inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span>{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
            </button>

            {!confirmEndOpen ? (
              <button
                type="button"
                disabled={isMutating}
                onClick={() => setConfirmEndOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-danger-line bg-danger-soft px-3.5 text-xs font-bold text-danger-ink transition-colors hover:opacity-90 disabled:opacity-60"
              >
                <StopCircle className="h-4 w-4" />
                <span>إنهاء المسابقة</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-danger-line bg-danger-soft px-3 py-1.5">
                <span className="text-xs font-bold text-danger-ink">
                  تأكيد الإنهاء؟
                </span>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => {
                    setConfirmEndOpen(false);
                    void onCompleteSession();
                  }}
                  className="h-7 rounded-lg bg-danger px-2.5 text-xs font-bold text-white transition-colors hover:bg-danger-hover disabled:opacity-60"
                >
                  نعم، إنهاء
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => setConfirmEndOpen(false)}
                  className="qc-btn-secondary h-7 rounded-lg px-2.5 text-xs font-bold"
                >
                  تراجع
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* شاشة العرض الرئيسية للسبورة */}
      {currentQuestion && session.currentPhase !== 'question_results' && (
        <section className="qc-card rounded-3xl p-6 sm:p-8">
          {/* المؤقت الكبير وشريط التقدم */}
          <div className="flex flex-col items-center justify-between gap-4 border-b border-line pb-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-2xl font-black tabular-nums sm:h-20 sm:w-20 sm:text-3xl ${
                  session.currentPhase === 'question_intro'
                    ? 'border-warning-line bg-warning-soft text-warning-ink'
                    : remainingSeconds <= 5
                      ? 'border-danger-line bg-danger-soft text-danger-ink'
                      : 'border-selected-line bg-selected text-accent'
                }`}
              >
                {remainingSeconds}
              </div>
              <div>
                <p className="text-xs font-bold text-ink-muted">
                  {session.currentPhase === 'question_intro'
                    ? 'ستظهر الاختيارات خلال'
                    : 'الوقت المتبقي للإجابة'}
                </p>
                <p className="font-display text-lg font-extrabold text-ink">
                  {remainingSeconds} ثانية
                </p>
              </div>
            </div>

            <div className="w-full flex-1 sm:max-w-md">
              <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-ink-muted">
                <span>
                  {session.currentPhase === 'question_intro'
                    ? 'المرحلة التمهيدية لقراءة السؤال'
                    : `زمن السؤال: ${currentQuestion.timeLimitSeconds} ثانية`}
                </span>
                <span className="tabular-nums">{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-input">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    session.currentPhase === 'question_intro'
                      ? 'bg-warning'
                      : remainingSeconds <= 5
                        ? 'bg-danger'
                        : 'bg-primary'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* نص السؤال وصورته */}
          <div className="py-8 text-center">
            <h3 className="font-display mx-auto max-w-4xl text-2xl leading-relaxed font-extrabold text-ink sm:text-4xl">
              {currentQuestion.prompt}
            </h3>

            {currentQuestion.imageUrl && (
              <div className="mt-6 flex justify-center">
                <img
                  src={currentQuestion.imageUrl}
                  alt="صورة السؤال"
                  className="max-h-72 rounded-2xl border border-line bg-surface-subtle object-contain shadow-xs"
                />
              </div>
            )}
          </div>

          {session.currentPhase === 'question_intro' && (
            <div className="mx-auto max-w-xl rounded-2xl border border-warning-line bg-warning-soft p-5 text-center">
              <Clock className="mx-auto h-7 w-7 text-warning" />
              <p className="font-display mt-2 text-base font-extrabold text-warning-ink">
                اقرؤوا السؤال جيداً!
              </p>
              <p className="mt-1 text-xs font-medium text-warning-ink">
                ستظهر الاختيارات على السبورة وهواتف الطلاب فور انتهاء العد التنازلي التمهيدي.
              </p>
            </div>
          )}

          {session.currentPhase === 'answering' && (
            <div className="mt-2">
              {currentQuestion.type === 'multiple_choice' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {currentQuestion.options.map((option, idx) => (
                    <div
                      key={option.id}
                      className={`flex items-center gap-4 rounded-2xl border-2 p-5 ${
                        OPTION_ACCENTS[idx % OPTION_ACCENTS.length]
                      }`}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface font-display text-lg font-black text-ink shadow-xs">
                        {OPTION_LETTERS[idx] ?? idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        {option.optionText && (
                          <p className="font-display text-lg font-bold text-ink sm:text-xl">
                            {option.optionText}
                          </p>
                        )}
                        {option.imageUrl && (
                          <img
                            src={option.imageUrl}
                            alt={`صورة الاختيار ${idx + 1}`}
                            className="mt-2 max-h-32 rounded-xl border border-line bg-surface object-contain"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-center gap-3 rounded-2xl border-2 border-success-line bg-success-soft p-6">
                    <CheckCircle2 className="h-7 w-7 text-success" />
                    <span className="font-display text-2xl font-extrabold text-success-ink">
                      صح
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-3 rounded-2xl border-2 border-danger-line bg-danger-soft p-6">
                    <XCircle className="h-7 w-7 text-danger" />
                    <span className="font-display text-2xl font-extrabold text-danger-ink">
                      خطأ
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* نتائج السؤال وكشف الإجابة والتحكم بالانتقال */}
      {session.currentPhase === 'question_results' && results && (
        <section className="qc-card space-y-6 rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-selected px-2.5 py-1 text-xs font-extrabold text-accent">
                <Trophy className="h-3.5 w-3.5" />
                <span className="tabular-nums">نقاط السؤال: {results.points} نقطة</span>
              </span>
              <h3 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
                {results.prompt}
              </h3>
            </div>

            {results.imageUrl && (
              <img
                src={results.imageUrl}
                alt="صورة السؤال"
                className="max-h-28 rounded-xl border border-line bg-surface-subtle object-contain"
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-success-line bg-success-soft p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-success-ink">
                <CheckCircle2 className="h-4 w-4" />
                <span>الإجابات الصحيحة</span>
              </div>
              <p className="tabular-nums font-display mt-2 text-3xl font-black text-success-ink">
                {results.correctCount}
              </p>
            </div>

            <div className="rounded-2xl border border-danger-line bg-danger-soft p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-danger-ink">
                <XCircle className="h-4 w-4" />
                <span>الإجابات الخاطئة</span>
              </div>
              <p className="tabular-nums font-display mt-2 text-3xl font-black text-danger-ink">
                {results.wrongCount}
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-surface-subtle p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-ink-muted">
                <HelpCircle className="h-4 w-4" />
                <span>لم يجيبوا</span>
              </div>
              <p className="tabular-nums font-display mt-2 text-3xl font-black text-ink">
                {results.unansweredCount}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-extrabold text-ink-muted">
              الإجابة الصحيحة وتوزيع اختيارات الطلاب:
            </p>

            {results.type === 'multiple_choice' ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {results.options.map((opt, idx) => (
                  <div
                    key={opt.id}
                    className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-4 ${
                      opt.isCorrect
                        ? 'border-success bg-success-soft'
                        : 'border-line bg-surface-subtle opacity-85'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-black ${
                          opt.isCorrect
                            ? 'bg-success text-white'
                            : 'bg-input text-ink-muted'
                        }`}
                      >
                        {OPTION_LETTERS[idx] ?? idx + 1}
                      </span>
                      <div className="min-w-0">
                        {opt.optionText && (
                          <p className="font-display text-base font-bold text-ink">
                            {opt.optionText}
                          </p>
                        )}
                        {opt.imageUrl && (
                          <img
                            src={opt.imageUrl}
                            alt={`اختيار ${idx + 1}`}
                            className="mt-1.5 max-h-20 rounded-lg border border-line bg-surface object-contain"
                          />
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-extrabold text-ink">
                        {opt.selectionCount} اختيار
                      </span>
                      {opt.isCorrect && (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { value: true, label: 'صح', count: results.trueSelectedCount },
                  { value: false, label: 'خطأ', count: results.falseSelectedCount },
                ].map((tf) => {
                  const isCorrect = results.correctBoolean === tf.value;
                  return (
                    <div
                      key={String(tf.value)}
                      className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-4 ${
                        isCorrect
                          ? 'border-success bg-success-soft'
                          : 'border-line bg-surface-subtle opacity-85'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <XCircle className="h-5 w-5 text-ink-muted" />
                        )}
                        <span className="font-display text-lg font-extrabold text-ink">
                          {tf.label}
                        </span>
                      </div>
                      <span className="tabular-nums rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-extrabold text-ink">
                        {tf.count} طالب
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-surface-subtle p-5">
            <h4 className="font-display text-sm font-extrabold text-ink">
              الطلاب الذين أجابوا إجابة صحيحة ({results.correctParticipantNames.length})
            </h4>
            {results.correctParticipantNames.length === 0 ? (
              <p className="mt-2 text-xs font-medium text-ink-muted">
                لم يجب أي طالب إجابة صحيحة في هذا السؤال.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {results.correctParticipantNames.map((name, idx) => {
                  const participant = session.participants.find((p) => p.displayName === name);
                  const avatar = getStudentAvatar(participant?.avatarId);
                  return (
                    <span
                      key={`${name}-${idx}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-success-line bg-surface px-3.5 py-1.5 text-xs font-extrabold text-success-ink shadow-2xs"
                    >
                      <span className="text-base">{avatar.emoji}</span>
                      <span>{name}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-line pt-5 sm:flex-row">
            {session.settings.advanceMode === 'auto' ? (
              <div className="flex w-full items-center justify-between gap-4 rounded-2xl border border-selected-line bg-selected px-5 py-3.5">
                <div className="flex items-center gap-2.5 text-xs font-extrabold text-ink sm:text-sm">
                  <Clock className="h-5 w-5 animate-pulse text-accent" />
                  <span>
                    {isLastQuestion
                      ? `الانتقال تلقائياً إلى النتائج النهائية خلال ${remainingSeconds} ثوانٍ...`
                      : `الانتقال تلقائياً إلى السؤال التالي خلال ${remainingSeconds} ثوانٍ...`}
                  </span>
                </div>
                <span className="tabular-nums font-display text-xl font-black text-accent">
                  {remainingSeconds}s
                </span>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-ink-muted">
                  الوضع اليدوي مُفعّل — اضغط للانتقال عندما تكون جاهزاً مع طلابك.
                </p>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => void onNextQuestion()}
                  className="qc-btn-primary inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-extrabold disabled:opacity-60 whitespace-nowrap"
                >
                  {isMutating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowLeft className="h-4 w-4" />
                  )}
                  <span>{isLastQuestion ? 'عرض النتائج النهائية' : 'السؤال التالي'}</span>
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
