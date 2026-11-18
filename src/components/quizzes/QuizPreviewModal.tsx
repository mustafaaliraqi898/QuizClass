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
        className="fixed inset-0 bg-backdrop backdrop-blur-xs"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-modal shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h3
              id="quiz-preview-modal-title"
              className="font-display text-base font-extrabold text-ink"
            >
              معاينة المسابقة والأسئلة المحفوظة
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              نسخة مستقلة محفوظة داخل المسابقة
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق المعاينة"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-row-hover hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="mt-3 text-xs font-bold text-ink-muted">
                جارٍ تحميل تفاصيل المسابقة...
              </p>
            </div>
          ) : errorMessage ? (
            <div
              role="alert"
              className="rounded-xl border border-danger-line bg-danger-soft p-4 text-xs font-bold text-danger-ink"
            >
              {errorMessage}
            </div>
          ) : quiz ? (
            <div className="space-y-6">
              <div className="space-y-2 border-b border-line pb-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
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

                <h4 className="font-display text-xl font-extrabold text-ink">{quiz.title}</h4>

                {quiz.description && (
                  <p className="text-sm leading-relaxed text-ink-muted">{quiz.description}</p>
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
                      className="rounded-xl border border-line bg-surface-subtle p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
                          <span className="tabular-nums font-extrabold text-accent">
                            سؤال {index + 1}
                          </span>
                          {meta.map((part, idx) => (
                            <span
                              key={`${question.id}-m-${idx}`}
                              className="inline-flex items-center gap-2"
                            >
                              <span aria-hidden="true">·</span>
                              <span>{part}</span>
                            </span>
                          ))}
                        </div>

                        <span className="tabular-nums inline-flex items-center gap-1 text-xs font-bold text-ink-muted">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{question.timeLimitSeconds} ثانية</span>
                        </span>
                      </div>

                      <p className="mt-2 font-display text-sm font-bold leading-relaxed text-ink">
                        {question.prompt}
                      </p>

                      {question.imageUrl && (
                        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
                          <img
                            src={question.imageUrl}
                            alt={`صورة السؤال ${index + 1}`}
                            referrerPolicy="no-referrer"
                            className="max-h-56 w-full object-contain"
                          />
                        </div>
                      )}

                      {question.type === 'true_false' ? (
                        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-success-ink">
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
                                  ? 'border-success-line bg-success-soft text-success-ink'
                                  : 'border-line bg-surface text-ink'
                              }`}
                            >
                              <span className="tabular-nums font-bold text-ink-muted">
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
                                    className="max-h-24 rounded-md border border-line object-contain"
                                  />
                                )}
                              </div>
                              {option.isCorrect && (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-ink" />
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

        <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
          {quiz && onLaunchLive && (
            <button
              type="button"
              disabled={quiz.questionCount === 0}
              onClick={() => {
                const targetId = quiz.id;
                onClose();
                onLaunchLive(targetId);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-success px-4 text-xs font-bold text-white transition-colors hover:bg-success-hover disabled:opacity-60"
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
              className="qc-btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold"
            >
              <Edit3 className="h-4 w-4" />
              <span>تعديل المسابقة</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="qc-btn-secondary h-10 rounded-xl px-4 text-xs font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
