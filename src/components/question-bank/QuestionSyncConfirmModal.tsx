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
        className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs"
        onClick={() => {
          if (!isSyncing) onKeepCurrent();
        }}
      />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="sync-quizzes-modal-title"
                className="font-display text-base font-extrabold text-slate-900 dark:text-white"
              >
                تحديث المسابقات المرتبطة
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                تحديث اختياري لنسخ السؤال المحفوظة داخل المسابقات
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSyncing}
            onClick={onKeepCurrent}
            aria-label="إغلاق"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm font-bold leading-relaxed text-slate-800 dark:text-slate-100">
          تم تعديل السؤال بنجاح في بنك الأسئلة. هذا السؤال موجود في{' '}
          <span className="tabular-nums text-indigo-600 dark:text-indigo-400">
            {formatQuizCountArabic(summary.updatableQuizCount)}
          </span>
          . هل ترغب بتحديث نسخه في المسابقات المرتبطة؟
        </p>

        <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-950/60">
          <p className="line-clamp-2 font-bold text-slate-800 dark:text-slate-200">
            {question.prompt}
          </p>

          {visibleQuizzes.length > 0 && (
            <div className="border-t border-slate-200 pt-2 text-slate-600 dark:border-slate-800 dark:text-slate-400">
              <p className="font-bold text-slate-700 dark:text-slate-300">المسابقات المرتبطة:</p>
              <ul className="mt-1 space-y-1">
                {visibleQuizzes.map((qz) => (
                  <li key={qz.id} className="truncate">
                    · {qz.title}
                  </li>
                ))}
              </ul>
              {remainingCount > 0 && (
                <p className="tabular-nums mt-1 text-slate-500 dark:text-slate-400">
                  و {remainingCount} مسابقات أخرى
                </p>
              )}
            </div>
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          تحديث المسابقات اختياري؛ عند التحديث يتم تحديث نص السؤال ونوعه وخياراته وإجابته
          وصوره وتصنيفاته مع الاحتفاظ بترتيبه ووقته المحدد في كل مسابقة. كما أن اختيار «الاحتفاظ
          بالنسخ الحالية» لا يلغي تعديل السؤال في بنك الأسئلة.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            disabled={isSyncing}
            onClick={onKeepCurrent}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            الاحتفاظ بالنسخ الحالية
          </button>

          <button
            type="button"
            disabled={isSyncing}
            onClick={() => void onConfirmSync()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
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
