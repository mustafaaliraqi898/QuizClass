import { AlertTriangle, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import type { TeacherLiveSessionDetails } from '../../types/liveSession';

interface LiveSessionConflictModalProps {
  existingSession: TeacherLiveSessionDetails | null;
  isResolving?: boolean;
  errorMessage?: string | null;
  onResumeExisting: (session: TeacherLiveSessionDetails) => void;
  onReplaceSession: (session: TeacherLiveSessionDetails) => void;
  onCancel: () => void;
}

export function LiveSessionConflictModal({
  existingSession,
  isResolving = false,
  errorMessage = null,
  onResumeExisting,
  onReplaceSession,
  onCancel,
}: LiveSessionConflictModalProps) {
  if (!existingSession) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-conflict-modal-title"
    >
      <div
        className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs"
        onClick={isResolving ? undefined : onCancel}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="live-conflict-modal-title"
                className="font-display text-base font-extrabold text-slate-900 dark:text-white"
              >
                توجد جلسة مباشرة نشطة لهذه المسابقة
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                لا يمكن تشغيل جلستين متعارضتين لنفس المسابقة في الوقت نفسه.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isResolving}
            onClick={onCancel}
            aria-label="إغلاق"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950/50">
          <p className="font-display font-bold text-slate-900 dark:text-white">
            {existingSession.quizTitle}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
            <span className="tabular-nums font-bold">رمز الدخول: {existingSession.pinCode}</span>
            <span aria-hidden="true">·</span>
            <span>
              الحالة:{' '}
              {existingSession.status === 'running' ? 'قيد التشغيل' : 'في انتظار الطلاب'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              المنضمون: {existingSession.participantCount}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            disabled={isResolving}
            onClick={() => onResumeExisting(existingSession)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <ExternalLink className="h-4 w-4" />
            <span>فتح الجلسة النشطة الحالية</span>
          </button>

          <button
            type="button"
            disabled={isResolving}
            onClick={() => onReplaceSession(existingSession)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950"
          >
            {isResolving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>إلغاء الجلسة السابقة وبدء جلسة جديدة</span>
          </button>

          <button
            type="button"
            disabled={isResolving}
            onClick={onCancel}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
