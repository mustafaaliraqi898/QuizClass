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
  'border-indigo-300 bg-indigo-50/70 dark:border-indigo-800 dark:bg-indigo-950/40',
  'border-sky-300 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/40',
  'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/40',
  'border-violet-300 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/40',
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
          badgeClass:
            'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
        };
      case 'answering':
        return {
          label: 'استقبال الإجابات جارٍ الآن',
          badgeClass:
            'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        };
      case 'question_results':
        return {
          label: 'كشف الإجابة ونتائج السؤال',
          badgeClass:
            'border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
        };
      default:
        return {
          label: 'المسابقة المباشرة',
          badgeClass:
            'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
        };
    }
  })();

  return (
    <div
      ref={containerRef}
      className={`space-y-5 ${
        isFullscreen
          ? 'min-h-screen overflow-y-auto bg-slate-50 p-4 sm:p-8 dark:bg-slate-950'
          : 'rounded-3xl bg-slate-50/50 p-2 sm:p-4 dark:bg-slate-950/50'
      }`}
    >
      {/* شريط الحالة والتحكم العلوي */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-extrabold ${phaseMeta.badgeClass}`}
              >
                <Radio className="h-3.5 w-3.5" />
                <span>{phaseMeta.label}</span>
              </span>

              <span className="tabular-nums rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-extrabold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                السؤال {questionNumber} من {session.questionCount}
              </span>

              <span className="tabular-nums rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                رمز PIN: {session.pinCode}
              </span>

              <span
                className={`inline-flex items-center gap-1 text-xs font-bold ${
                  socketConnected
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
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

            <h2 className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl dark:text-white">
              {session.quizTitle}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800">
              <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-slate-500 dark:text-slate-400">المشاركون:</span>
              <span className="tabular-nums font-extrabold text-slate-900 dark:text-white">
                {session.connectedParticipantCount}/{session.participantCount}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold dark:border-emerald-900/60 dark:bg-emerald-950/40">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-700 dark:text-emerald-300">الإجابات:</span>
              <span className="tabular-nums font-extrabold text-emerald-900 dark:text-emerald-200">
                {session.answeredCount}/{session.participantCount}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span>{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
            </button>

            {!confirmEndOpen ? (
              <button
                type="button"
                disabled={isMutating}
                onClick={() => setConfirmEndOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
              >
                <StopCircle className="h-4 w-4" />
                <span>إنهاء المسابقة</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-1.5 dark:border-red-800 dark:bg-red-950/60">
                <span className="text-xs font-bold text-red-800 dark:text-red-200">
                  تأكيد الإنهاء؟
                </span>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => {
                    setConfirmEndOpen(false);
                    void onCompleteSession();
                  }}
                  className="h-7 rounded-lg bg-red-600 px-2.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  نعم، إنهاء
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => setConfirmEndOpen(false)}
                  className="h-7 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          {/* المؤقت الكبير وشريط التقدم */}
          <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-2xl font-black tabular-nums sm:h-20 sm:w-20 sm:text-3xl ${
                  session.currentPhase === 'question_intro'
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    : remainingSeconds <= 5
                      ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/60 dark:text-red-300'
                      : 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                }`}
              >
                {remainingSeconds}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {session.currentPhase === 'question_intro'
                    ? 'ستظهر الاختيارات خلال'
                    : 'الوقت المتبقي للإجابة'}
                </p>
                <p className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
                  {remainingSeconds} ثانية
                </p>
              </div>
            </div>

            <div className="w-full flex-1 sm:max-w-md">
              <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                <span>
                  {session.currentPhase === 'question_intro'
                    ? 'المرحلة التمهيدية لقراءة السؤال'
                    : `زمن السؤال: ${currentQuestion.timeLimitSeconds} ثانية`}
                </span>
                <span className="tabular-nums">{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    session.currentPhase === 'question_intro'
                      ? 'bg-amber-500'
                      : remainingSeconds <= 5
                        ? 'bg-red-500'
                        : 'bg-indigo-600 dark:bg-indigo-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* نص السؤال وصورته */}
          <div className="py-8 text-center">
            <h3 className="font-display mx-auto max-w-4xl text-2xl leading-relaxed font-extrabold text-slate-900 sm:text-4xl dark:text-white">
              {currentQuestion.prompt}
            </h3>

            {currentQuestion.imageUrl && (
              <div className="mt-6 flex justify-center">
                <img
                  src={currentQuestion.imageUrl}
                  alt="صورة السؤال"
                  className="max-h-72 rounded-2xl border border-slate-200 object-contain shadow-xs dark:border-slate-700"
                />
              </div>
            )}
          </div>

          {session.currentPhase === 'question_intro' && (
            <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
              <Clock className="mx-auto h-7 w-7 text-amber-600 dark:text-amber-400" />
              <p className="font-display mt-2 text-base font-extrabold text-amber-900 dark:text-amber-200">
                اقرؤوا السؤال جيداً!
              </p>
              <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
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
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white font-display text-lg font-black text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white">
                        {OPTION_LETTERS[idx] ?? idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        {option.optionText && (
                          <p className="font-display text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
                            {option.optionText}
                          </p>
                        )}
                        {option.imageUrl && (
                          <img
                            src={option.imageUrl}
                            alt={`صورة الاختيار ${idx + 1}`}
                            className="mt-2 max-h-32 rounded-xl border border-slate-200 object-contain bg-white dark:border-slate-700"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-center gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-6 dark:border-emerald-800 dark:bg-emerald-950/40">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-display text-2xl font-extrabold text-emerald-950 dark:text-emerald-100">
                      صح
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-3 rounded-2xl border-2 border-red-300 bg-red-50/70 p-6 dark:border-red-800 dark:bg-red-950/40">
                    <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                    <span className="font-display text-2xl font-extrabold text-red-950 dark:text-red-100">
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
        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between dark:border-slate-800">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <Trophy className="h-3.5 w-3.5" />
                <span className="tabular-nums">نقاط السؤال: {results.points} نقطة</span>
              </span>
              <h3 className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl dark:text-white">
                {results.prompt}
              </h3>
            </div>

            {results.imageUrl && (
              <img
                src={results.imageUrl}
                alt="صورة السؤال"
                className="max-h-28 rounded-xl border border-slate-200 object-contain dark:border-slate-700"
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <span>الإجابات الصحيحة</span>
              </div>
              <p className="tabular-nums font-display mt-2 text-3xl font-black text-emerald-900 dark:text-emerald-200">
                {results.correctCount}
              </p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/60 dark:bg-red-950/30">
              <div className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-300">
                <XCircle className="h-4 w-4" />
                <span>الإجابات الخاطئة</span>
              </div>
              <p className="tabular-nums font-display mt-2 text-3xl font-black text-red-900 dark:text-red-200">
                {results.wrongCount}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                <HelpCircle className="h-4 w-4" />
                <span>لم يجيبوا</span>
              </div>
              <p className="tabular-nums font-display mt-2 text-3xl font-black text-slate-900 dark:text-white">
                {results.unansweredCount}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
              الإجابة الصحيحة وتوزيع اختيارات الطلاب:
            </p>

            {results.type === 'multiple_choice' ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {results.options.map((opt, idx) => (
                  <div
                    key={opt.id}
                    className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-4 ${
                      opt.isCorrect
                        ? 'border-emerald-500 bg-emerald-50/90 dark:border-emerald-400 dark:bg-emerald-950/50'
                        : 'border-slate-200 bg-slate-50/70 opacity-80 dark:border-slate-800 dark:bg-slate-950/40'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-black ${
                          opt.isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {OPTION_LETTERS[idx] ?? idx + 1}
                      </span>
                      <div className="min-w-0">
                        {opt.optionText && (
                          <p className="font-display text-base font-bold text-slate-900 dark:text-white">
                            {opt.optionText}
                          </p>
                        )}
                        {opt.imageUrl && (
                          <img
                            src={opt.imageUrl}
                            alt={`اختيار ${idx + 1}`}
                            className="mt-1.5 max-h-20 rounded-lg border border-slate-200 object-contain bg-white"
                          />
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums rounded-lg bg-white px-2.5 py-1 text-xs font-extrabold text-slate-700 shadow-xs dark:bg-slate-900 dark:text-slate-200">
                        {opt.selectionCount} اختيار
                      </span>
                      {opt.isCorrect && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
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
                          ? 'border-emerald-500 bg-emerald-50/90 dark:border-emerald-400 dark:bg-emerald-950/50'
                          : 'border-slate-200 bg-slate-50/70 opacity-80 dark:border-slate-800 dark:bg-slate-950/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-slate-400" />
                        )}
                        <span className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
                          {tf.label}
                        </span>
                      </div>
                      <span className="tabular-nums rounded-lg bg-white px-2.5 py-1 text-xs font-extrabold text-slate-700 shadow-xs dark:bg-slate-900 dark:text-slate-200">
                        {tf.count} طالب
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/40">
            <h4 className="font-display text-sm font-extrabold text-slate-900 dark:text-white">
              الطلاب الذين أجابوا إجابة صحيحة ({results.correctParticipantNames.length})
            </h4>
            {results.correctParticipantNames.length === 0 ? (
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
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
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-extrabold text-emerald-800 shadow-2xs dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300"
                    >
                      <span className="text-base">{avatar.emoji}</span>
                      <span>{name}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-5 sm:flex-row dark:border-slate-800">
            {session.settings.advanceMode === 'auto' ? (
              <div className="flex w-full items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-5 py-3.5 dark:border-indigo-900/60 dark:bg-indigo-950/40">
                <div className="flex items-center gap-2.5 text-xs font-extrabold text-indigo-900 sm:text-sm dark:text-indigo-200">
                  <Clock className="h-5 w-5 animate-pulse text-indigo-600 dark:text-indigo-400" />
                  <span>
                    {isLastQuestion
                      ? `الانتقال تلقائياً إلى النتائج النهائية خلال ${remainingSeconds} ثوانٍ...`
                      : `الانتقال تلقائياً إلى السؤال التالي خلال ${remainingSeconds} ثوانٍ...`}
                  </span>
                </div>
                <span className="tabular-nums font-display text-xl font-black text-indigo-700 dark:text-indigo-300">
                  {remainingSeconds}s
                </span>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  الوضع اليدوي مُفعّل — اضغط للانتقال عندما تكون جاهزاً مع طلابك.
                </p>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => void onNextQuestion()}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-extrabold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap dark:bg-indigo-500 dark:hover:bg-indigo-400"
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
