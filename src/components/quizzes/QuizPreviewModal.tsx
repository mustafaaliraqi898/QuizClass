import { CheckCircle2, Clock, Edit3, Loader2, Play, X } from 'lucide-react';
import { useEffect } from 'react';
import type { QuizRecord } from '../../types/quiz';
import {
  DIFFICULTY_LABELS,
  formatDurationArabic,
  formatQuizDate,
} from './quizFormatters';

interface QuizPreviewModalProps {
  quiz: QuizRecord | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onEdit?: (quizId: string) => void;
  onLaunchLive?: (quizId: string) => void;
}

export function QuizPreviewModal({
  quiz,
  isLoading = false,
  errorMessage = null,
  onClose,
  onEdit,
  onLaunchLive,
}: QuizPreviewModalProps) {
  const isOpen = Boolean(quiz) || isLoading || Boolean(errorMessage);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-preview-modal-title"
    >
      <div
        className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h3
              id="quiz-preview-modal-title"
              className="font-display text-base font-extrabold text-slate-900 dark:text-white"
            >
              معاينة المسابقة والأسئلة المحفوظة
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              نسخة مستقلة محفوظة داخل المسابقة
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق المعاينة"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
              <p className="mt-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                جارٍ تحميل تفاصيل المسابقة...
              </p>
            </div>
          ) : errorMessage ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {errorMessage}
            </div>
          ) : quiz ? (
            <div className="space-y-6">
              <div className="space-y-2 border-b border-slate-200 pb-5 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {quiz.subject && <span>{quiz.subject}</span>}
                  {quiz.subject && quiz.grade && <span aria-hidden="true">·</span>}
                  {quiz.grade && <span>{quiz.grade}</span>}
                  {(quiz.subject || quiz.grade) && <span aria-hidden="true">·</span>}
                  <span className="tabular-nums">{quiz.questionCount} سؤالاً</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    إجمالي الزمن: {formatDurationArabic(quiz.totalDurationSeconds)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">أُنشئت في {formatQuizDate(quiz.createdAt)}</span>
                </div>

                <h4 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">
                  {quiz.title}
                </h4>

                {quiz.description && (
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {quiz.description}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {quiz.questions.map((question, index) => {
                  const meta = [
                    question.type === 'multiple_choice' ? 'اختيار من متعدد' : 'صح أو خطأ',
                    question.subject,
                    question.grade,
                    question.topic,
                    question.difficulty ? DIFFICULTY_LABELS[question.difficulty] : null,
                  ].filter((item): item is string => Boolean(item));

                  return (
                    <article
                      key={question.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <span className="tabular-nums font-extrabold text-indigo-600 dark:text-indigo-400">
                            سؤال {index + 1}
                          </span>
                          {meta.map((part, idx) => (
                            <span key={`${question.id}-m-${idx}`} className="inline-flex items-center gap-2">
                              <span aria-hidden="true">·</span>
                              <span>{part}</span>
                            </span>
                          ))}
                        </div>

                        <span className="tabular-nums inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{question.timeLimitSeconds} ثانية</span>
                        </span>
                      </div>

                      <p className="mt-2 font-display text-sm font-bold leading-relaxed text-slate-900 dark:text-white">
                        {question.prompt}
                      </p>

                      {question.imageUrl && (
                        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                          <img
                            src={question.imageUrl}
                            alt={`صورة السؤال ${index + 1}`}
                            referrerPolicy="no-referrer"
                            className="max-h-56 w-full object-contain"
                          />
                        </div>
                      )}

                      {question.type === 'true_false' ? (
                        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>
                            الإجابة الصحيحة: {question.correctBoolean ? 'صح' : 'خطأ'}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {question.options.map((option, optIndex) => (
                            <div
                              key={option.id}
                              className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                                option.isCorrect
                                  ? 'border-emerald-300 bg-emerald-50/80 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                              }`}
                            >
                              <span className="tabular-nums font-bold text-slate-400">
                                {optIndex + 1}.
                              </span>
                              <div className="min-w-0 flex-1 space-y-1.5">
                                {option.optionText && (
                                  <p className="font-semibold leading-snug">{option.optionText}</p>
                                )}
                                {option.imageUrl && (
                                  <img
                                    src={option.imageUrl}
                                    alt={`صورة الاختيار ${optIndex + 1}`}
                                    referrerPolicy="no-referrer"
                                    className="max-h-24 rounded-md border border-slate-200 object-contain dark:border-slate-700"
                                  />
                                )}
                              </div>
                              {option.isCorrect && (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          {quiz && onLaunchLive && (
            <button
              type="button"
              disabled={quiz.questionCount === 0}
              onClick={() => {
                const targetId = quiz.id;
                onClose();
                onLaunchLive(targetId);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <Play className="h-4 w-4" />
              <span>تشغيل مباشر</span>
            </button>
          )}
          {quiz && onEdit && (
            <button
              type="button"
              onClick={() => {
                const targetId = quiz.id;
                onClose();
                onEdit(targetId);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <Edit3 className="h-4 w-4" />
              <span>تعديل المسابقة</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
