import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useEffect } from 'react';
import type { QuestionRecord } from '../../types/questionBank';

interface DeleteConfirmModalProps {
  question: QuestionRecord | null;
  isDeleting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmModal({
  question,
  isDeleting,
  errorMessage,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  useEffect(() => {
    if (!question) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [question, isDeleting, onCancel]);

  if (!question) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-question-title"
    >
      <div
        className="fixed inset-0 bg-backdrop backdrop-blur-xs"
        onClick={() => {
          if (!isDeleting) onCancel();
        }}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-modal p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-danger-line bg-danger-soft text-danger-ink">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3
              id="delete-question-title"
              className="font-display text-base font-extrabold text-ink"
            >
              تأكيد حذف السؤال
            </h3>
          </div>

          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            aria-label="إغلاق"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-row-hover hover:text-ink disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          هل أنت متأكد من حذف هذا السؤال نهائياً من قاعدة البيانات؟ سيتم أيضاً حذف الصور
          المرتبطة به إذا لم تكن مستخدمة في سؤال آخر.
        </p>

        <div className="mt-3 rounded-xl border border-line bg-surface-subtle p-3 text-xs font-bold text-ink">
          <p className="line-clamp-2">{question.prompt}</p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-danger-line bg-danger-soft p-3 text-xs font-bold text-danger-ink"
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="qc-btn-secondary h-10 rounded-xl px-4 text-xs font-bold disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => void onConfirm()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-danger px-4 text-xs font-bold text-white transition-colors hover:bg-danger-hover disabled:opacity-60"
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isDeleting ? 'جارٍ الحذف...' : 'نعم، احذف السؤال'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
