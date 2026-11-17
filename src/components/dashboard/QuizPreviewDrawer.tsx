import { CheckCircle2, Clock, Edit3, Loader2, Play, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { httpQuizService } from '../../services/quizService';
import type { NavSectionId } from '../../types/dashboard';
import type { QuizRecord, QuizSummary } from '../../types/quiz';
import { formatDurationArabic, formatQuizDate } from '../quizzes/quizFormatters';

interface QuizPreviewDrawerProps {
  quiz: QuizSummary | null;
  onClose: () => void;
  onNavigate: (section: NavSectionId) => void;
  onEditQuiz?: (quizId: string) => void;
  onLaunchLive?: (quizId: string) => void;
}

export function QuizPreviewDrawer({
  quiz,
  onClose,
  onNavigate,
  onEditQuiz,
  onLaunchLive,
}: QuizPreviewDrawerProps) {
  const [fullQuiz, setFullQuiz] = useState<QuizRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!quiz) {
      setFullQuiz(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setFullQuiz(null);

    httpQuizService
      .getQuizById(quiz.id)
      .then((record) => {
        if (!cancelled) {
          setFullQuiz(record);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل تفاصيل المسابقة من قاعدة البيانات.';
          setLoadError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [quiz]);

  useEffect(() => {
    if (!quiz) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quiz, onClose]);

  if (!quiz) {
    return null;
  }

  const metaParts = [
    quiz.subject,
    quiz.grade,
    `أُنشئت ${formatQuizDate(quiz.createdAt)}`,
  ].filter((part): part is string => Boolean(part));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full w-full max-w-lg flex-col justify-between border-s border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            معاينة تفاصيل المسابقة
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="إغلاق المعاينة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {metaParts.map((part, idx) => (
                <span key={`${quiz.id}-dm-${idx}`} className="inline-flex items-center gap-2">
                  {idx > 0 && <span aria-hidden="true">·</span>}
                  <span>{part}</span>
                </span>
              ))}
            </div>
            <h4 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">
              {quiz.title}
            </h4>
            {quiz.description && (
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {quiz.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 border-y border-slate-200 py-4 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">عدد الأسئلة</p>
              <p className="font-display tabular-nums mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {quiz.questionCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">المدة الكلية</p>
              <p className="font-display tabular-nums mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {formatDurationArabic(quiz.totalDurationSeconds)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">الوقت الافتراضي</p>
              <p className="font-display tabular-nums mt-1 text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {quiz.defaultTimeSeconds} ث
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600 dark:text-indigo-400" />
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {loadError}
            </div>
          ) : fullQuiz ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                الأسئلة المحفوظة داخل المسابقة
              </p>
              {fullQuiz.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                      سؤال {idx + 1} · {q.type === 'multiple_choice' ? 'اختيار من متعدد' : 'صح أو خطأ'}
                    </span>
                    <span className="tabular-nums inline-flex items-center gap-1 font-bold">
                      <Clock className="h-3 w-3" />
                      {q.timeLimitSeconds} ث
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-bold leading-relaxed text-slate-900 dark:text-white">
                    {q.prompt}
                  </p>
                  {q.imageUrl && (
                    <img
                      src={q.imageUrl}
                      alt={`صورة السؤال ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="mt-2 max-h-28 rounded-lg border border-slate-200 object-contain dark:border-slate-700"
                    />
                  )}
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {q.type === 'true_false'
                        ? `الإجابة: ${q.correctBoolean ? 'صح' : 'خطأ'}`
                        : `الإجابة: ${
                            q.options.find((o) => o.isCorrect)?.optionText || 'اختيار مصوّر'
                          }`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          {onLaunchLive && (
            <button
              type="button"
              disabled={quiz.questionCount === 0}
              onClick={() => {
                const targetId = quiz.id;
                onClose();
                onLaunchLive(targetId);
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <Play className="h-3.5 w-3.5" />
              <span>تشغيل مباشر</span>
            </button>
          )}
          {onEditQuiz ? (
            <button
              type="button"
              onClick={() => {
                const targetId = quiz.id;
                onClose();
                onEditQuiz(targetId);
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>تعديل المسابقة</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('quizzes');
              }}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              عرض جميع المسابقات
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
