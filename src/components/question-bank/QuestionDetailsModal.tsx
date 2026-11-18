import { CheckCircle2, Edit3, Trash2, X } from 'lucide-react';
import { useEffect } from 'react';
import type { QuestionDifficulty, QuestionRecord } from '../../types/questionBank';

interface QuestionDetailsModalProps {
  question: QuestionRecord | null;
  onClose: () => void;
  onEdit?: (question: QuestionRecord) => void;
  onDelete?: (question: QuestionRecord) => void;
}

const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
};

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

export function QuestionDetailsModal({
  question,
  onClose,
  onEdit,
  onDelete,
}: QuestionDetailsModalProps) {
  useEffect(() => {
    if (!question) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [question, onClose]);

  if (!question) return null;

  const classificationItems = [
    question.subject ? `المادة: ${question.subject}` : null,
    question.grade ? `الصف: ${question.grade}` : null,
    question.topic ? `الموضوع: ${question.topic}` : null,
    question.difficulty ? `الصعوبة: ${DIFFICULTY_LABELS[question.difficulty]}` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-details-title"
    >
      <div className="fixed inset-0 bg-backdrop backdrop-blur-xs" onClick={onClose} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-modal shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h3
              id="question-details-title"
              className="font-display text-base font-extrabold text-ink"
            >
              تفاصيل السؤال
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              {question.type === 'multiple_choice' ? 'اختيار من متعدد' : 'صح أو خطأ'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق تفاصيل السؤال"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-row-hover hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {classificationItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
              {classificationItems.map((item, idx) => (
                <span key={item} className="inline-flex items-center gap-2">
                  {idx > 0 && (
                    <span aria-hidden="true" className="text-line-strong">
                      ·
                    </span>
                  )}
                  <span>{item}</span>
                </span>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <h4 className="font-display text-lg font-bold leading-relaxed text-ink">
              {question.prompt}
            </h4>

            {question.imageUrl && (
              <div className="overflow-hidden rounded-xl border border-line bg-surface-subtle p-3">
                <img
                  src={question.imageUrl}
                  alt="صورة السؤال"
                  referrerPolicy="no-referrer"
                  className="mx-auto max-h-72 w-auto rounded-lg object-contain"
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-ink-muted">
              {question.type === 'multiple_choice' ? 'الاختيارات' : 'الإجابة الصحيحة'}
            </p>

            {question.type === 'true_false' ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: true, label: 'صح' },
                  { value: false, label: 'خطأ' },
                ].map((choice) => {
                  const isCorrect = question.correctBoolean === choice.value;
                  return (
                    <div
                      key={choice.label}
                      className={`flex items-center justify-between rounded-xl border p-4 ${
                        isCorrect
                          ? 'border-success-line bg-success-soft text-success-ink'
                          : 'border-line bg-surface-subtle text-ink-muted'
                      }`}
                    >
                      <span className="font-display text-sm font-bold">{choice.label}</span>
                      {isCorrect && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-success-ink">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>الإجابة الصحيحة</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2.5">
                {question.options.map((opt, index) => (
                  <div
                    key={opt.id}
                    className={`rounded-xl border p-4 ${
                      opt.isCorrect
                        ? 'border-success-line bg-success-soft'
                        : 'border-line bg-surface-subtle'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            opt.isCorrect
                              ? 'bg-success text-white'
                              : 'border border-line bg-input text-ink-muted'
                          }`}
                        >
                          {OPTION_LETTERS[index] ?? index + 1}
                        </span>
                        <div className="min-w-0 space-y-2">
                          {opt.optionText && (
                            <p className="text-sm font-bold text-ink">{opt.optionText}</p>
                          )}
                          {opt.imageUrl && (
                            <img
                              src={opt.imageUrl}
                              alt={`صورة الاختيار ${OPTION_LETTERS[index] ?? index + 1}`}
                              referrerPolicy="no-referrer"
                              className="max-h-40 rounded-lg border border-line bg-surface object-contain"
                            />
                          )}
                        </div>
                      </div>

                      {opt.isCorrect && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-success-ink">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>الإجابة الصحيحة</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(question);
                }}
                className="qc-btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-bold"
              >
                <Edit3 className="h-4 w-4" />
                <span>تعديل السؤال</span>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(question);
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-danger-line bg-danger-soft px-4 text-xs font-bold text-danger-ink transition-colors hover:brightness-95"
              >
                <Trash2 className="h-4 w-4" />
                <span>حذف</span>
              </button>
            )}
          </div>

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
