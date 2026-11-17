import { CheckCircle2, Edit3, Trash2, X } from 'lucide-react';
import { useEffect } from 'react';
import type { QuestionDifficulty, QuestionRecord } from '../../types/questionBank';

interface QuestionDetailsModalProps {
  question: QuestionRecord | null;
  onClose: () => void;
  onEdit: (question: QuestionRecord) => void;
  onDelete: (question: QuestionRecord) => void;
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
      <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h3
              id="question-details-title"
              className="font-display text-base font-extrabold text-slate-900 dark:text-white"
            >
              تفاصيل السؤال
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {question.type === 'multiple_choice' ? 'اختيار من متعدد' : 'صح أو خطأ'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق تفاصيل السؤال"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {classificationItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              {classificationItems.map((item, idx) => (
                <span key={item} className="inline-flex items-center gap-2">
                  {idx > 0 && (
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                      ·
                    </span>
                  )}
                  <span>{item}</span>
                </span>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <h4 className="font-display text-lg font-bold leading-relaxed text-slate-900 dark:text-white">
              {question.prompt}
            </h4>

            {question.imageUrl && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
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
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
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
                          ? 'border-emerald-300 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400'
                      }`}
                    >
                      <span className="font-display text-sm font-bold">{choice.label}</span>
                      {isCorrect && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
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
                        ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/40'
                        : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            opt.isCorrect
                              ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {OPTION_LETTERS[index] ?? index + 1}
                        </span>
                        <div className="min-w-0 space-y-2">
                          {opt.optionText && (
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {opt.optionText}
                            </p>
                          )}
                          {opt.imageUrl && (
                            <img
                              src={opt.imageUrl}
                              alt={`صورة الاختيار ${OPTION_LETTERS[index] ?? index + 1}`}
                              referrerPolicy="no-referrer"
                              className="max-h-40 rounded-lg border border-slate-200 bg-white object-contain dark:border-slate-700 dark:bg-slate-900"
                            />
                          )}
                        </div>
                      </div>

                      {opt.isCorrect && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(question);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <Edit3 className="h-4 w-4" />
              <span>تعديل السؤال</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onDelete(question);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
            >
              <Trash2 className="h-4 w-4" />
              <span>حذف</span>
            </button>
          </div>

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
