import { Loader2, RefreshCw, X } from 'lucide-react';
import { useEffect } from 'react';
import type { LinkedQuizSummary, QuestionRecord } from '../../types/questionBank';

interface QuestionSyncConfirmModalProps {
  pendingSync: {
    question: QuestionRecord;
    summary: LinkedQuizSummary;
  } | null;
  isSyncing: boolean;
  errorMessage?: string | null;
  onKeepCurrent: () => void;
  onConfirmSync: () => Promise<void>;
}

function formatQuizCountArabic(count: number): string {
  if (count === 1) return 'مسابقة واحدة';
  if (count === 2) return 'مسابقتين';
  if (count >= 3 && count <= 10) return `${count} مسابقات`;
  return `${count} مسابقة`;
}

export function QuestionSyncConfirmModal({
  pendingSync,
  isSyncing,
  errorMessage,
  onKeepCurrent,
  onConfirmSync,
}: QuestionSyncConfirmModalProps) {
  useEffect(() => {
    if (!pendingSync) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSyncing) {
        onKeepCurrent();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pendingSync, isSyncing, onKeepCurrent]);

  if (!pendingSync) return null;

  const { question, summary } = pendingSync;
  const visibleQuizzes = summary.updatableQuizzes.slice(0, 5);
  const remainingCount = summary.updatableQuizzes.length - visibleQuizzes.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-quizzes-modal-title"
    >
      <div
        className="fixed inset-0 bg-backdrop backdrop-blur-xs"
        onClick={() => {
          if (!isSyncing) onKeepCurrent();
        }}
      />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-line bg-modal p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-selected-line bg-selected text-accent">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="sync-quizzes-modal-title"
                className="font-display text-base font-extrabold text-ink"
              >
                تحديث المسابقات المرتبطة
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                تحديث اختياري لنسخ السؤال المحفوظة داخل المسابقات
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSyncing}
            onClick={onKeepCurrent}
            aria-label="إغلاق"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-row-hover hover:text-ink disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm font-bold leading-relaxed text-ink">
          تم تعديل السؤال بنجاح في بنك الأسئلة. هذا السؤال موجود في{' '}
          <span className="tabular-nums text-accent">
            {formatQuizCountArabic(summary.updatableQuizCount)}
          </span>
          . هل ترغب بتحديث نسخه في المسابقات المرتبطة؟
        </p>

        <div className="mt-3 space-y-2 rounded-xl border border-line bg-surface-subtle p-3.5 text-xs">
          <p className="line-clamp-2 font-bold text-ink">{question.prompt}</p>

          {visibleQuizzes.length > 0 && (
            <div className="border-t border-line pt-2 text-ink-muted">
              <p className="font-bold text-ink">المسابقات المرتبطة:</p>
              <ul className="mt-1 space-y-1">
                {visibleQuizzes.map((qz) => (
                  <li key={qz.id} className="truncate">
                    · {qz.title}
                  </li>
                ))}
              </ul>
              {remainingCount > 0 && (
                <p className="tabular-nums mt-1 text-ink-muted">
                  و {remainingCount} مسابقات أخرى
                </p>
              )}
            </div>
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-ink-muted">
          تحديث المسابقات اختياري؛ عند التحديث يتم تحديث نص السؤال ونوعه وخياراته وإجابته
          وصوره وتصنيفاته مع الاحتفاظ بترتيبه ووقته المحدد في كل مسابقة. كما أن اختيار «الاحتفاظ
          بالنسخ الحالية» لا يلغي تعديل السؤال في بنك الأسئلة.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-danger-line bg-danger-soft p-3 text-xs font-bold text-danger-ink"
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            disabled={isSyncing}
            onClick={onKeepCurrent}
            className="qc-btn-secondary h-10 rounded-xl px-4 text-xs font-bold disabled:opacity-50"
          >
            الاحتفاظ بالنسخ الحالية
          </button>

          <button
            type="button"
            disabled={isSyncing}
            onClick={() => void onConfirmSync()}
            className="qc-btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold disabled:opacity-60"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>{isSyncing ? 'جارٍ التحديث...' : 'تحديث المسابقات المرتبطة'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
