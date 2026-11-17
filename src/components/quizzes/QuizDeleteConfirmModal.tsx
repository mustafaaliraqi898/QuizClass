import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useEffect } from 'react';
import type { QuizSummary } from '../../types/quiz';

interface QuizDeleteConfirmModalProps {
  quiz: QuizSummary | null;
  isDeleting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function QuizDeleteConfirmModal({
  quiz,
  isDeleting,
  errorMessage,
  onCancel,
  onConfirm,
}: QuizDeleteConfirmModalProps) {
  useEffect(() => {
    if (!quiz) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [quiz, isDeleting, onCancel]);

  if (!quiz) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-quiz-title"
    >
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
        onClick={() => {
          if (!isDeleting) onCancel();
        }}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3
              id="delete-quiz-title"
              className="font-display text-base font-extrabold text-slate-900 dark:text-white"
            >
              تأكيد حذف المسابقة
            </h3>
          </div>

          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            aria-label="إغلاق"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          هل أنت متأكد من حذف هذه المسابقة نهائياً من قاعدة البيانات؟ لن تتأثر الأسئلة
          الأصلية المحفوظة في بنك الأسئلة.
        </p>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-800 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
          <p className="line-clamp-2">{quiz.title}</p>
          <p className="tabular-nums mt-1 font-medium text-slate-500 dark:text-slate-400">
            تحتوي على {quiz.questionCount} سؤالاً
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => void onConfirm()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-400"
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isDeleting ? 'جارٍ الحذف...' : 'نعم، احذف المسابقة'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
